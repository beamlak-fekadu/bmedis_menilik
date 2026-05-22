-- Migration 00076: notification instant fan-out diagnostics + realtime.
--
-- Primary workflow notifications are emitted synchronously from trusted
-- server actions. This migration makes the diagnostics vocabulary explicit
-- and enables Supabase Realtime on the in-app notifications table so the bell
-- and /notifications page do not depend on long polling.

BEGIN;

ALTER TABLE notification_rule_logs DROP CONSTRAINT IF EXISTS chk_notification_rule_logs_status;
ALTER TABLE notification_rule_logs
  ADD CONSTRAINT chk_notification_rule_logs_status
  CHECK (status IS NULL OR status IN ('matched','skipped','failed','no_recipients','no_rule'));

CREATE INDEX IF NOT EXISTS idx_notification_rule_logs_no_recipient_created
  ON notification_rule_logs (created_at DESC)
  WHERE status IN ('no_recipients','no_rule');

ALTER TABLE notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

COMMIT;

