-- Migration 00051: widen trigger_snapshot_refresh() poll budget
--
-- 00049 polled net._http_response for up to 60s. In practice cold-start
-- of the refresh-analytics-snapshot Edge Function plus recompute_all
-- regularly takes 55-60s, so the poll window expired ~10ms before the
-- response landed and the row was logged as 'timeout' even when the call
-- ultimately succeeded.
--
-- This migration:
--   * raises the poll budget to ~3 minutes (180 * 1s)
--   * raises the pg_net http timeout to 120s
--   * sleeps 1s per attempt (was 0.5s) so we make ~half as many round
--     trips to net._http_response
--   * stores the request_id in cron_job_log BEFORE polling, so even if
--     the function is killed mid-poll the request_id is recoverable.

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
    v_status_code      integer;
    v_error_msg        text;
    v_attempts         integer := 0;
    v_max_attempts     constant integer := 180;  -- 180 * 1s = 3 min
    v_found            boolean := false;
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

    -- Fire the POST
    SELECT net.http_post(
        url := v_function_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
    ) INTO v_request_id;

    -- Persist request_id immediately so it survives a poll-loop kill.
    INSERT INTO cron_job_log (
        id, job_name, triggered_at, status, request_id
    ) VALUES (
        v_log_id,
        'nightly-analytics-refresh',
        v_started_at,
        'triggered',
        v_request_id
    );

    -- Poll for response
    LOOP
        SELECT status_code, error_msg
          INTO v_status_code, v_error_msg
          FROM net._http_response
         WHERE id = v_request_id;

        IF FOUND THEN
            v_found := true;
            EXIT;
        END IF;

        EXIT WHEN v_attempts >= v_max_attempts;
        PERFORM pg_sleep(1);
        v_attempts := v_attempts + 1;
    END LOOP;

    IF v_found THEN
        UPDATE cron_job_log
           SET finished_at    = clock_timestamp(),
               status         = CASE
                                  WHEN v_status_code BETWEEN 200 AND 299 THEN 'success'
                                  ELSE 'error'
                                END,
               response_status = v_status_code,
               error_message   = v_error_msg
         WHERE id = v_log_id;
    ELSE
        UPDATE cron_job_log
           SET finished_at  = clock_timestamp(),
               status       = 'timeout',
               error_message = 'No response in net._http_response within 180s; check pg_net queue and edge function logs.'
         WHERE id = v_log_id;
    END IF;

    RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION trigger_snapshot_refresh IS
    'Wrapper used by pg_cron to POST the refresh-analytics-snapshot Edge Function and log the outcome to cron_job_log. SECURITY DEFINER for vault access. v2: 180s poll budget, 120s HTTP timeout, request_id persisted before polling.';

REVOKE ALL ON FUNCTION trigger_snapshot_refresh() FROM public;
REVOKE ALL ON FUNCTION trigger_snapshot_refresh() FROM anon, authenticated;
