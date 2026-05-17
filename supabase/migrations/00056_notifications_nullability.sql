-- =============================================================================
-- Migration 00056 — Relax NOT NULL on notification columns that the engine
-- expects to be nullable.
-- =============================================================================
--
-- Some deployments created `notifications` / `notification_events` from an
-- earlier (different) schema where columns like `event_id`, `source_type`,
-- `action_href`, etc. were NOT NULL. Migration 00055's
-- `ADD COLUMN IF NOT EXISTS` cannot change the nullability of an already-
-- existing column, so the runtime insert path fails with:
--   `null value in column "event_id" of relation "notifications" violates
--    not-null constraint`.
--
-- This migration explicitly drops NOT NULL on every column that the
-- application service code passes as nullable. It is safe: existing rows are
-- preserved, and the not-null constraint is removed only on columns that
-- never had to be populated by the new engine.
-- =============================================================================

BEGIN;

-- ─── notifications: drop NOT NULL on optional / engine-derived columns ─────
ALTER TABLE notifications ALTER COLUMN recipient_role DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN source_type DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN source_id DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN event_id DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN asset_id DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN department_id DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN action_href DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN action_label DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN dedupe_key DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN read_at DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN reviewed_at DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN dismissed_at DROP NOT NULL;

-- ─── notification_events: drop NOT NULL on optional columns ────────────────
ALTER TABLE notification_events ALTER COLUMN source_table DROP NOT NULL;
ALTER TABLE notification_events ALTER COLUMN source_id DROP NOT NULL;
ALTER TABLE notification_events ALTER COLUMN asset_id DROP NOT NULL;
ALTER TABLE notification_events ALTER COLUMN department_id DROP NOT NULL;
ALTER TABLE notification_events ALTER COLUMN dedupe_key DROP NOT NULL;
ALTER TABLE notification_events ALTER COLUMN processed_at DROP NOT NULL;
ALTER TABLE notification_events ALTER COLUMN processing_error DROP NOT NULL;
ALTER TABLE notification_events ALTER COLUMN created_by DROP NOT NULL;

-- ─── notification_rule_logs: drop NOT NULL on optional columns ─────────────
ALTER TABLE notification_rule_logs ALTER COLUMN event_id DROP NOT NULL;
ALTER TABLE notification_rule_logs ALTER COLUMN error_message DROP NOT NULL;

-- ─── notification_deliveries: drop NOT NULL on optional columns ────────────
ALTER TABLE notification_deliveries ALTER COLUMN notification_id DROP NOT NULL;
ALTER TABLE notification_deliveries ALTER COLUMN recipient_profile_id DROP NOT NULL;
ALTER TABLE notification_deliveries ALTER COLUMN recipient_role DROP NOT NULL;
ALTER TABLE notification_deliveries ALTER COLUMN delivery_target DROP NOT NULL;
ALTER TABLE notification_deliveries ALTER COLUMN skip_reason DROP NOT NULL;
ALTER TABLE notification_deliveries ALTER COLUMN error_message DROP NOT NULL;
ALTER TABLE notification_deliveries ALTER COLUMN provider_message_id DROP NOT NULL;
ALTER TABLE notification_deliveries ALTER COLUMN sent_at DROP NOT NULL;

-- ─── telegram_connections: drop NOT NULL on optional columns ──────────────
ALTER TABLE telegram_connections ALTER COLUMN telegram_username DROP NOT NULL;
ALTER TABLE telegram_connections ALTER COLUMN verified_at DROP NOT NULL;

COMMIT;
