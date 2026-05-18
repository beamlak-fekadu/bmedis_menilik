-- =============================================================================
-- Migration 00057 — Drop legacy CHECK constraints on notification tables.
-- =============================================================================
--
-- Some deployments created the notification tables earlier with their own
-- CHECK constraints under PostgreSQL's auto-generated names
-- (`<table>_<column>_check`). Migration 00055 added new constraints with
-- the `chk_<table>_<column>` naming scheme but left the legacy ones in place,
-- so inserts can still fail on the old enum set, e.g.:
--   `new row for relation "notifications" violates check constraint
--    "notifications_status_check"`.
--
-- This migration drops the auto-generated legacy CHECKs. The replacement
-- `chk_*` CHECKs added by 00055 remain authoritative.
--
-- DROP CONSTRAINT IF EXISTS is idempotent and safe to re-run.
-- =============================================================================

BEGIN;

-- ─── notifications ─────────────────────────────────────────────────────────
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_status_check;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_priority_check;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_category_check;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_channel_check;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_severity_check;

-- Re-assert the canonical CHECKs (idempotent: drops first, then adds).
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_status;
ALTER TABLE notifications
  ADD CONSTRAINT chk_notifications_status
  CHECK (status IN ('unread','read','reviewed','dismissed'));

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_priority;
ALTER TABLE notifications
  ADD CONSTRAINT chk_notifications_priority
  CHECK (priority IS NULL OR priority IN ('critical','high','medium','low','info'));

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_category;
ALTER TABLE notifications
  ADD CONSTRAINT chk_notifications_category
  CHECK (category IS NULL OR category IN (
    'critical','task','request','compliance','stock','procurement',
    'replacement','offline','qr','system','management'
  ));

-- ─── notification_events ───────────────────────────────────────────────────
ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS notification_events_priority_check;
ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS notification_events_processing_status_check;
ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS notification_events_status_check;
ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS notification_events_event_type_check;

ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS chk_notification_events_priority;
ALTER TABLE notification_events
  ADD CONSTRAINT chk_notification_events_priority
  CHECK (priority IS NULL OR priority IN ('critical','high','medium','low','info'));

ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS chk_notification_events_processing_status;
ALTER TABLE notification_events
  ADD CONSTRAINT chk_notification_events_processing_status
  CHECK (processing_status IN ('pending','processed','failed','skipped'));

-- ─── notification_rule_logs ────────────────────────────────────────────────
ALTER TABLE notification_rule_logs DROP CONSTRAINT IF EXISTS notification_rule_logs_status_check;
ALTER TABLE notification_rule_logs DROP CONSTRAINT IF EXISTS chk_notification_rule_logs_status;
ALTER TABLE notification_rule_logs
  ADD CONSTRAINT chk_notification_rule_logs_status
  CHECK (status IS NULL OR status IN ('matched','skipped','failed'));

-- ─── notification_deliveries ───────────────────────────────────────────────
ALTER TABLE notification_deliveries DROP CONSTRAINT IF EXISTS notification_deliveries_channel_check;
ALTER TABLE notification_deliveries DROP CONSTRAINT IF EXISTS notification_deliveries_status_check;

ALTER TABLE notification_deliveries DROP CONSTRAINT IF EXISTS chk_notification_deliveries_channel;
ALTER TABLE notification_deliveries
  ADD CONSTRAINT chk_notification_deliveries_channel
  CHECK (channel IS NULL OR channel IN ('telegram','telegram_monitor'));

ALTER TABLE notification_deliveries DROP CONSTRAINT IF EXISTS chk_notification_deliveries_status;
ALTER TABLE notification_deliveries
  ADD CONSTRAINT chk_notification_deliveries_status
  CHECK (status IS NULL OR status IN ('pending','sent','skipped','failed'));

COMMIT;
