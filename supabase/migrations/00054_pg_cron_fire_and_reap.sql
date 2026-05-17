-- Migration 00054: split trigger_snapshot_refresh into fire + reap
--
-- Why: pg_cron on this Supabase project enforces a ~2 minute statement
-- timeout for cron-fired commands. The 00051-style sync-poll loop in
-- trigger_snapshot_refresh() exceeds that and gets cancelled at line 73
-- (the pg_sleep). Cancellation rolls back the whole function including
-- the net.http_post queue insert, so nothing fires at all.
--
-- New shape:
--   trigger_snapshot_refresh()         -> fire-only. Returns in <100ms:
--                                         queue HTTP request + insert
--                                         cron_job_log row with status
--                                         'triggered' + request_id.
--   reap_snapshot_refresh_responses()  -> runs every minute via pg_cron.
--                                         Joins triggered rows against
--                                         net._http_response and updates
--                                         them to success / error. Also
--                                         marks rows older than 10 min
--                                         without a response as 'timeout'.

-- ---------------------------------------------------------------------------
-- 1. Fire-only trigger_snapshot_refresh
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_snapshot_refresh()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_service_role_key text;
    v_function_url     text;
    v_request_id       bigint;
    v_log_id           uuid := gen_random_uuid();
    v_started_at       timestamptz := clock_timestamp();
BEGIN
    SELECT decrypted_secret INTO v_service_role_key
      FROM vault.decrypted_secrets
     WHERE name = 'service_role_key';

    SELECT decrypted_secret INTO v_function_url
      FROM vault.decrypted_secrets
     WHERE name = 'snapshot_refresh_url';

    IF v_service_role_key IS NULL OR v_function_url IS NULL THEN
        INSERT INTO cron_job_log (
            id, job_name, triggered_at, finished_at, status, error_message
        ) VALUES (
            v_log_id,
            'nightly-analytics-refresh',
            v_started_at,
            clock_timestamp(),
            'error',
            'Missing vault secret(s): service_role_key and/or snapshot_refresh_url.'
        );
        RETURN v_log_id;
    END IF;

    SELECT net.http_post(
        url := v_function_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key,
            'X-Cron-Secret', (
                SELECT decrypted_secret
                  FROM vault.decrypted_secrets
                 WHERE name = 'cron_shared_secret'
            )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
    ) INTO v_request_id;

    INSERT INTO cron_job_log (
        id, job_name, triggered_at, status, request_id
    ) VALUES (
        v_log_id,
        'nightly-analytics-refresh',
        v_started_at,
        'triggered',
        v_request_id
    );

    RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION trigger_snapshot_refresh IS
    'v4: fire-only. Inserts a triggered row with request_id and returns immediately. Pair with reap_snapshot_refresh_responses() to populate final status.';

REVOKE ALL ON FUNCTION trigger_snapshot_refresh() FROM public;
REVOKE ALL ON FUNCTION trigger_snapshot_refresh() FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Reaper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reap_snapshot_refresh_responses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
    v_resolved integer := 0;
    v_timed_out integer := 0;
BEGIN
    -- Resolve triggered rows whose response has landed.
    WITH updated AS (
        UPDATE cron_job_log l
           SET finished_at    = clock_timestamp(),
               status         = CASE
                                  WHEN r.status_code BETWEEN 200 AND 299 THEN 'success'
                                  ELSE 'error'
                                END,
               response_status = r.status_code,
               error_message   = r.error_msg
          FROM net._http_response r
         WHERE l.status = 'triggered'
           AND l.request_id IS NOT NULL
           AND r.id = l.request_id
        RETURNING l.id
    )
    SELECT count(*) INTO v_resolved FROM updated;

    -- Mark triggered rows that never got a response as 'timeout' after 10 min.
    -- (pg_net retains responses ~5 days, so if the row isn't there in 10 min
    -- something is wrong upstream.)
    WITH expired AS (
        UPDATE cron_job_log
           SET finished_at = clock_timestamp(),
               status       = 'timeout',
               error_message = 'No response in net._http_response within 10 minutes of trigger; check pg_net queue and edge function logs.'
         WHERE status = 'triggered'
           AND triggered_at < now() - interval '10 minutes'
        RETURNING id
    )
    SELECT count(*) INTO v_timed_out FROM expired;

    RETURN v_resolved + v_timed_out;
END;
$$;

COMMENT ON FUNCTION reap_snapshot_refresh_responses IS
    'Updates triggered cron_job_log rows with results from net._http_response. Idempotent; runs once a minute via pg_cron.';

REVOKE ALL ON FUNCTION reap_snapshot_refresh_responses() FROM public;
REVOKE ALL ON FUNCTION reap_snapshot_refresh_responses() FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Schedule reaper
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    PERFORM cron.unschedule('reap-snapshot-refresh-responses');
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
    'reap-snapshot-refresh-responses',
    '* * * * *',
    $cron$SELECT public.reap_snapshot_refresh_responses();$cron$
);
