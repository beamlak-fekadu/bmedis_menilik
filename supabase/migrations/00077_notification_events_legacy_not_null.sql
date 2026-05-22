-- =============================================================================
-- Migration 00077 — Relax legacy NOT NULL constraints on notification_events.
-- =============================================================================
--
-- Some deployments (the same ones that needed migration 00057 to drop the
-- legacy auto-generated CHECK constraints) created `notification_events`
-- earlier with extra columns marked NOT NULL — most notably `category`. The
-- current in-tree schema (migration 00055) does NOT carry `category` on
-- `notification_events`: category is a per-recipient classification computed
-- inside the notification-rules layer and persisted on `notifications`, not
-- on the upstream event. The engine therefore never writes `category` (nor
-- any of the other legacy candidates below) on `notification_events`, and
-- any deployment that still has the legacy NOT NULL fails every emit with:
--
--   null value in column "category" of relation "notification_events"
--   violates not-null constraint
--
-- The failure cascades through every workflow that emits a notification
-- (maintenance_request.created, maintenance_request.status_changed,
-- work_order.assigned, work_order.created, pm.assigned, pm.completed,
-- calibration.*, procurement.*, spare_part.*, qr.*, offline_sync.*,
-- system.test_notification, notification.rule_failed, …) because they all
-- funnel through the same `createNotificationEvent()` insert.
--
-- This migration unconditionally relaxes the legacy NOT NULL constraints
-- without dropping the columns themselves, preserving any historical row
-- data. CHECK constraints from 00055/00057 stay authoritative; this only
-- removes the unwanted NOT NULL declarations that the codebase never
-- declared.
--
-- The migration is idempotent: each ALTER is wrapped in an existence check
-- so it can be re-run safely.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  legacy_col TEXT;
BEGIN
  -- Columns that earlier deployments declared NOT NULL on notification_events
  -- but which the in-tree schema and engine do NOT populate. Relaxing them
  -- aligns the deployed schema with the codebase. Add new candidates here
  -- if a future emit surfaces a similar "null value in column X" failure.
  FOREACH legacy_col IN ARRAY ARRAY[
    'category',
    'status',
    'severity',
    'channel',
    'type',
    'title',
    'body',
    'message'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'notification_events'
         AND column_name = legacy_col
         AND is_nullable = 'NO'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.notification_events ALTER COLUMN %I DROP NOT NULL',
        legacy_col
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
