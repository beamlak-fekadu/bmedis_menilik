-- Migration 00049: pg_cron + pg_net schedule for nightly analytics refresh
--
-- Schedules a nightly POST to the refresh-analytics-snapshot Edge Function
-- and persists the result to cron_job_log so the dashboard can show
-- "Snapshots last refreshed: N hours ago".
--
-- Edge function called:
--   https://fgqyszbxzpmqzpqvdivx.supabase.co/functions/v1/refresh-analytics-snapshot
--   POST, no body, requires Bearer <service_role_key>
--
-- Secrets are read from Supabase Vault, never inlined. Before this migration
-- can do real work in production, run ONCE in the Supabase SQL editor:
--
--   SELECT vault.create_secret(
--     '<your service_role_key>',
--     'service_role_key',
--     'Used by trigger_snapshot_refresh() in 00049');
--   SELECT vault.create_secret(
--     'https://fgqyszbxzpmqzpqvdivx.supabase.co/functions/v1/refresh-analytics-snapshot',
--     'snapshot_refresh_url',
--     'Target URL for trigger_snapshot_refresh() in 00049');
--
-- If either secret is missing the trigger function records an 'error' row
-- in cron_job_log instead of attempting a half-authenticated HTTP call.
--
-- RLS for cron_job_log lives in migration 00050.

-- =============================================================================
-- 1. Extensions
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =============================================================================
-- 2. cron_job_log table
-- =============================================================================
CREATE TABLE IF NOT EXISTS cron_job_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('triggered', 'success', 'error', 'timeout')),
    response_status INTEGER,
    error_message TEXT,
    request_id BIGINT
);

CREATE INDEX IF NOT EXISTS idx_cron_job_log_job_triggered
    ON cron_job_log(job_name, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_cron_job_log_status
    ON cron_job_log(status);

COMMENT ON TABLE cron_job_log IS
    'Audit trail for scheduled jobs that call Edge Functions via pg_net. Read-only for admin per RLS in migration 00050. request_id maps to net._http_response.id for deeper inspection.';

-- =============================================================================
-- 3. trigger_snapshot_refresh()
-- =============================================================================
-- pg_net.http_post is asynchronous: it queues a request and returns the
-- request_id immediately. We sync-poll net._http_response for up to ~60s
-- so cron_job_log captures the real HTTP status in a single row. If the
-- response doesn't arrive in time we record status='timeout' and the
-- request_id is still queryable via net._http_response later.
--
-- SECURITY DEFINER is required to read vault.decrypted_secrets. The function
-- is OWNED BY postgres and not exposed to PostgREST (no GRANT to anon/authenticated).
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
    v_max_attempts     constant integer := 120;  -- 120 * 500ms = 60s
    v_found            boolean := false;
BEGIN
    -- 1. Pull secrets from Vault
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
            'Missing vault secret(s): service_role_key and/or snapshot_refresh_url. See migration 00049 header for setup.'
        );
        RETURN v_log_id;
    END IF;

    -- 2. Fire the POST. pg_net.http_post returns the request id immediately.
    SELECT net.http_post(
        url := v_function_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
    ) INTO v_request_id;

    -- 3. Sync-poll the response table.
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
        PERFORM pg_sleep(0.5);
        v_attempts := v_attempts + 1;
    END LOOP;

    -- 4. Persist outcome
    IF v_found THEN
        INSERT INTO cron_job_log (
            id, job_name, triggered_at, finished_at,
            status, response_status, error_message, request_id
        ) VALUES (
            v_log_id,
            'nightly-analytics-refresh',
            v_started_at,
            clock_timestamp(),
            CASE
                WHEN v_status_code BETWEEN 200 AND 299 THEN 'success'
                ELSE 'error'
            END,
            v_status_code,
            v_error_msg,
            v_request_id
        );
    ELSE
        INSERT INTO cron_job_log (
            id, job_name, triggered_at, finished_at,
            status, error_message, request_id
        ) VALUES (
            v_log_id,
            'nightly-analytics-refresh',
            v_started_at,
            clock_timestamp(),
            'timeout',
            'No response in net._http_response within 60s; check pg_net queue.',
            v_request_id
        );
    END IF;

    RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION trigger_snapshot_refresh IS
    'Wrapper used by pg_cron to POST the refresh-analytics-snapshot Edge Function and log the outcome to cron_job_log. SECURITY DEFINER for vault access.';

REVOKE ALL ON FUNCTION trigger_snapshot_refresh() FROM public;
REVOKE ALL ON FUNCTION trigger_snapshot_refresh() FROM anon, authenticated;

-- =============================================================================
-- 4. Schedule via pg_cron
-- =============================================================================
-- 23:00 UTC = 02:00 Addis Ababa next day (UTC+3, no DST).
-- Idempotent: unschedule any prior job with this name first.
DO $$
BEGIN
    PERFORM cron.unschedule('nightly-analytics-refresh');
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
    'nightly-analytics-refresh',
    '0 23 * * *',
    $cron$SELECT public.trigger_snapshot_refresh();$cron$
);
