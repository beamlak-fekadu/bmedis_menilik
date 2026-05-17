-- Migration 00052: add X-Cron-Secret header to trigger_snapshot_refresh()
--
-- Identical to 00051 (v2) except the net.http_post headers jsonb now also
-- carries an X-Cron-Secret value pulled inline from vault.decrypted_secrets.
-- This pairs with verify_jwt=false on the refresh-analytics-snapshot
-- function and a matching CRON_SHARED_SECRET env var on the function side.
--
-- Setup (one-time):
--   SELECT vault.create_secret(
--     '<random hex from `openssl rand -hex 32`>',
--     'cron_shared_secret',
--     'X-Cron-Secret value passed to refresh-analytics-snapshot'
--   );
--   npx supabase secrets set CRON_SHARED_SECRET=<same value>

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
    v_max_attempts     constant integer := 180;
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

REVOKE ALL ON FUNCTION trigger_snapshot_refresh() FROM public;
REVOKE ALL ON FUNCTION trigger_snapshot_refresh() FROM anon, authenticated;
