-- Migration 00050: RLS for cron_job_log
--
-- Pattern mirrors 00012: enable RLS, then per-policy CREATE POLICY using
-- the auth_user_has_role() helper.
--
-- Access model:
--   SELECT  -> admin only (and developer, which is admin-equivalent for
--              ops surfaces per migration 00022 + 00026).
--   INSERT  -> nobody via RLS. Rows are written by trigger_snapshot_refresh(),
--              which runs SECURITY DEFINER and bypasses RLS.
--   UPDATE  -> nobody via RLS.
--   DELETE  -> nobody via RLS. Retention is managed manually or by a future
--              cleanup job.

ALTER TABLE cron_job_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_cron_job_log
    ON cron_job_log
    FOR SELECT
    TO authenticated
    USING (
        auth_user_has_role('admin')
        OR auth_user_has_role('developer')
    );
