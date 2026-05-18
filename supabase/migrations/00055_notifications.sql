-- =============================================================================
-- Migration 00055 — Notifications subsystem
-- =============================================================================
--
-- Adds a first-class notification engine for BMEDIS:
--   - notification_events:        normalized raw event records (one row per
--                                 source event, before fan-out)
--   - notifications:              user-facing in-app notifications
--                                 (one row per recipient per event)
--   - notification_rule_logs:     developer diagnostics for rule processing
--   - notification_deliveries:    delivery logs for external channels
--                                 (Telegram + Telegram monitor)
--   - telegram_connections:       optional profile -> Telegram chat mapping
--                                 (Developer Lab can manage these)
--
-- Notes:
--   - In-app notifications are the source of truth. Telegram is only a phone
--     delivery channel.
--   - RLS: every user can read/update only their own notifications.
--     Developer/admin/bme_head can read diagnostics (rule logs and delivery
--     logs). Telegram connections are owner-readable and developer-managed.
--   - Notification failures must not break the primary workflow; the service
--     layer wraps writes in try/catch. This migration only sets up storage.
--   - This migration is idempotent: if any of these tables already exist with
--     missing columns from a partial earlier attempt, ALTER TABLE ADD COLUMN
--     IF NOT EXISTS backfills the schema before indexes/constraints/policies
--     are created. Policies are dropped if present before being created.
-- =============================================================================

BEGIN;

-- ─── notification_events ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  source_table TEXT,
  source_id TEXT,
  asset_id UUID REFERENCES equipment_assets(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  priority TEXT NOT NULL CHECK (priority IN ('critical','high','medium','low','info')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT,
  processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending','processed','failed','skipped')),
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill missing columns on a pre-existing notification_events table.
ALTER TABLE notification_events
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS source_table TEXT,
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS asset_id UUID,
  ADD COLUMN IF NOT EXISTS department_id UUID,
  ADD COLUMN IF NOT EXISTS priority TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_error TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Enforce CHECK constraints idempotently.
ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS chk_notification_events_priority;
ALTER TABLE notification_events
  ADD CONSTRAINT chk_notification_events_priority
  CHECK (priority IS NULL OR priority IN ('critical','high','medium','low','info'));

ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS chk_notification_events_processing_status;
ALTER TABLE notification_events
  ADD CONSTRAINT chk_notification_events_processing_status
  CHECK (processing_status IN ('pending','processed','failed','skipped'));

CREATE INDEX IF NOT EXISTS idx_notification_events_type_created
  ON notification_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_events_status_created
  ON notification_events (processing_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_events_asset
  ON notification_events (asset_id)
  WHERE asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_events_department
  ON notification_events (department_id)
  WHERE department_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_events_dedupe
  ON notification_events (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Developer/admin/bme_head read notification_events" ON notification_events;
CREATE POLICY "Developer/admin/bme_head read notification_events"
  ON notification_events
  FOR SELECT
  USING (
    auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
  );

DROP POLICY IF EXISTS "Privileged insert notification_events" ON notification_events;
CREATE POLICY "Privileged insert notification_events"
  ON notification_events
  FOR INSERT
  WITH CHECK (
    auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
    OR auth_user_has_role('technician')
    OR auth_user_has_role('store_user')
    OR auth_user_has_role('department_head')
    OR auth_user_has_role('department_user')
  );

DROP POLICY IF EXISTS "Privileged update notification_events" ON notification_events;
CREATE POLICY "Privileged update notification_events"
  ON notification_events
  FOR UPDATE
  USING (
    auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
  );

-- ─── notifications ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_role TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('critical','high','medium','low','info')),
  category TEXT NOT NULL CHECK (category IN (
    'critical','task','request','compliance','stock','procurement',
    'replacement','offline','qr','system','management'
  )),
  source_type TEXT,
  source_id TEXT,
  event_id UUID REFERENCES notification_events(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES equipment_assets(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  action_href TEXT,
  action_label TEXT,
  status TEXT NOT NULL DEFAULT 'unread'
    CHECK (status IN ('unread','read','reviewed','dismissed')),
  dedupe_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS recipient_profile_id UUID,
  ADD COLUMN IF NOT EXISTS recipient_role TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS event_id UUID,
  ADD COLUMN IF NOT EXISTS asset_id UUID,
  ADD COLUMN IF NOT EXISTS department_id UUID,
  ADD COLUMN IF NOT EXISTS action_href TEXT,
  ADD COLUMN IF NOT EXISTS action_label TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'unread',
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

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

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_status;
ALTER TABLE notifications
  ADD CONSTRAINT chk_notifications_status
  CHECK (status IN ('unread','read','reviewed','dismissed'));

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_status_created
  ON notifications (recipient_profile_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_priority_created
  ON notifications (priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_category_created
  ON notifications (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_source
  ON notifications (source_type, source_id)
  WHERE source_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON notifications (dedupe_key)
  WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_asset
  ON notifications (asset_id)
  WHERE asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_department
  ON notifications (department_id)
  WHERE department_id IS NOT NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own + privileged read notifications" ON notifications;
CREATE POLICY "Own + privileged read notifications"
  ON notifications
  FOR SELECT
  USING (
    recipient_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
  );

DROP POLICY IF EXISTS "Privileged insert notifications" ON notifications;
CREATE POLICY "Privileged insert notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (
    auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
    OR auth_user_has_role('technician')
    OR auth_user_has_role('store_user')
    OR auth_user_has_role('department_head')
    OR auth_user_has_role('department_user')
  );

DROP POLICY IF EXISTS "Own update notifications" ON notifications;
CREATE POLICY "Own update notifications"
  ON notifications
  FOR UPDATE
  USING (
    recipient_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
  );

-- ─── notification_rule_logs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_rule_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES notification_events(id) ON DELETE SET NULL,
  rule_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('matched','skipped','failed')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_rule_logs
  ADD COLUMN IF NOT EXISTS event_id UUID,
  ADD COLUMN IF NOT EXISTS rule_name TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS recipient_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE notification_rule_logs DROP CONSTRAINT IF EXISTS chk_notification_rule_logs_status;
ALTER TABLE notification_rule_logs
  ADD CONSTRAINT chk_notification_rule_logs_status
  CHECK (status IS NULL OR status IN ('matched','skipped','failed'));

CREATE INDEX IF NOT EXISTS idx_notification_rule_logs_event
  ON notification_rule_logs (event_id);
CREATE INDEX IF NOT EXISTS idx_notification_rule_logs_status_created
  ON notification_rule_logs (status, created_at DESC);

ALTER TABLE notification_rule_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Developer/admin/bme_head read rule logs" ON notification_rule_logs;
CREATE POLICY "Developer/admin/bme_head read rule logs"
  ON notification_rule_logs
  FOR SELECT
  USING (
    auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
  );

DROP POLICY IF EXISTS "Privileged insert rule logs" ON notification_rule_logs;
CREATE POLICY "Privileged insert rule logs"
  ON notification_rule_logs
  FOR INSERT
  WITH CHECK (
    auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
    OR auth_user_has_role('technician')
    OR auth_user_has_role('store_user')
    OR auth_user_has_role('department_head')
    OR auth_user_has_role('department_user')
  );

-- ─── notification_deliveries ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('telegram','telegram_monitor')),
  recipient_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_role TEXT,
  delivery_target TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','sent','skipped','failed')),
  skip_reason TEXT,
  error_message TEXT,
  provider_message_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_deliveries
  ADD COLUMN IF NOT EXISTS notification_id UUID,
  ADD COLUMN IF NOT EXISTS channel TEXT,
  ADD COLUMN IF NOT EXISTS recipient_profile_id UUID,
  ADD COLUMN IF NOT EXISTS recipient_role TEXT,
  ADD COLUMN IF NOT EXISTS delivery_target TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS skip_reason TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE notification_deliveries DROP CONSTRAINT IF EXISTS chk_notification_deliveries_channel;
ALTER TABLE notification_deliveries
  ADD CONSTRAINT chk_notification_deliveries_channel
  CHECK (channel IS NULL OR channel IN ('telegram','telegram_monitor'));

ALTER TABLE notification_deliveries DROP CONSTRAINT IF EXISTS chk_notification_deliveries_status;
ALTER TABLE notification_deliveries
  ADD CONSTRAINT chk_notification_deliveries_status
  CHECK (status IS NULL OR status IN ('pending','sent','skipped','failed'));

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification
  ON notification_deliveries (notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status_created
  ON notification_deliveries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_channel_created
  ON notification_deliveries (channel, created_at DESC);

ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Developer/admin/bme_head read deliveries" ON notification_deliveries;
CREATE POLICY "Developer/admin/bme_head read deliveries"
  ON notification_deliveries
  FOR SELECT
  USING (
    auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
  );

DROP POLICY IF EXISTS "Privileged insert deliveries" ON notification_deliveries;
CREATE POLICY "Privileged insert deliveries"
  ON notification_deliveries
  FOR INSERT
  WITH CHECK (
    auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
    OR auth_user_has_role('technician')
    OR auth_user_has_role('store_user')
    OR auth_user_has_role('department_head')
    OR auth_user_has_role('department_user')
  );

DROP POLICY IF EXISTS "Privileged update deliveries" ON notification_deliveries;
CREATE POLICY "Privileged update deliveries"
  ON notification_deliveries
  FOR UPDATE
  USING (
    auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
  );

-- ─── telegram_connections ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telegram_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  telegram_chat_id TEXT NOT NULL,
  telegram_username TEXT,
  verified_at TIMESTAMPTZ,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id)
);

ALTER TABLE telegram_connections
  ADD COLUMN IF NOT EXISTS profile_id UUID,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_username TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_telegram_connections_profile
  ON telegram_connections (profile_id);

ALTER TABLE telegram_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own + privileged read telegram_connections" ON telegram_connections;
CREATE POLICY "Own + privileged read telegram_connections"
  ON telegram_connections
  FOR SELECT
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
  );

DROP POLICY IF EXISTS "Privileged insert telegram_connections" ON telegram_connections;
CREATE POLICY "Privileged insert telegram_connections"
  ON telegram_connections
  FOR INSERT
  WITH CHECK (
    auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
  );

DROP POLICY IF EXISTS "Privileged update telegram_connections" ON telegram_connections;
CREATE POLICY "Privileged update telegram_connections"
  ON telegram_connections
  FOR UPDATE
  USING (
    auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
  );

DROP POLICY IF EXISTS "Privileged delete telegram_connections" ON telegram_connections;
CREATE POLICY "Privileged delete telegram_connections"
  ON telegram_connections
  FOR DELETE
  USING (
    auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
  );

COMMIT;
