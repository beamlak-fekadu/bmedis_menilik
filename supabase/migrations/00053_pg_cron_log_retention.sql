-- Migration 00053: cron_job_log + net._http_response retention
--
-- After a few months of nightly runs cron_job_log accumulates ~100 rows
-- and net._http_response is auto-pruned by pg_net at ~5 days. We keep
-- 90 days of run history in cron_job_log, then drop the rest.
--
-- Two scheduled jobs added:
--   * cleanup-cron-job-log          — daily 03:00 UTC
--   * cleanup-net-http-response     — daily 03:05 UTC (defensive backup;
--                                     pg_net usually prunes already)
--
-- Function trigger_snapshot_refresh() stores request_id, so a row in
-- cron_job_log can outlive its corresponding net._http_response row. That
-- is intentional — the response_status and error_message are mirrored
-- into cron_job_log at write time, so the dashboard still has its
-- evidence after net._http_response is gone.

CREATE OR REPLACE FUNCTION cleanup_cron_job_log()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted integer;
BEGIN
    DELETE FROM cron_job_log
     WHERE triggered_at < now() - interval '90 days';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION cleanup_cron_job_log IS
    'Deletes cron_job_log rows older than 90 days. Scheduled daily at 03:00 UTC.';

REVOKE ALL ON FUNCTION cleanup_cron_job_log() FROM public;
REVOKE ALL ON FUNCTION cleanup_cron_job_log() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION cleanup_net_http_response()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
    v_deleted integer;
BEGIN
    -- pg_net normally prunes net._http_response on its own (~5 day window).
    -- This is a safety net in case the project's pg_net retention is longer
    -- than we want to keep — drop anything past 30 days.
    DELETE FROM net._http_response
     WHERE created < now() - interval '30 days';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION cleanup_net_http_response IS
    'Deletes net._http_response rows older than 30 days. Scheduled daily at 03:05 UTC.';

REVOKE ALL ON FUNCTION cleanup_net_http_response() FROM public;
REVOKE ALL ON FUNCTION cleanup_net_http_response() FROM anon, authenticated;

-- Idempotent schedule — unschedule any prior job first.
DO $$
BEGIN
    PERFORM cron.unschedule('cleanup-cron-job-log');
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('cleanup-net-http-response');
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
    'cleanup-cron-job-log',
    '0 3 * * *',
    $cron$SELECT public.cleanup_cron_job_log();$cron$
);

SELECT cron.schedule(
    'cleanup-net-http-response',
    '5 3 * * *',
    $cron$SELECT public.cleanup_net_http_response();$cron$
);
