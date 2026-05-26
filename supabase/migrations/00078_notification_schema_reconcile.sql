-- =============================================================================
-- Migration 00078 — Full notification schema reconciliation.
-- Safe for clean Menelik II deployments where some legacy notification columns
-- may not exist.
-- =============================================================================

BEGIN;

-- ── Fix 1: notification_events.entity_type ───────────────────────────────
-- Only alter entity_type if the column exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notification_events'
      AND column_name = 'entity_type'
  ) THEN
    -- Drop NOT NULL if present.
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'notification_events'
        AND column_name = 'entity_type'
        AND is_nullable = 'NO'
    ) THEN
      ALTER TABLE public.notification_events
        ALTER COLUMN entity_type DROP NOT NULL;
    END IF;

    -- Set safe default only when the column exists.
    ALTER TABLE public.notification_events
      ALTER COLUMN entity_type SET DEFAULT '';
  END IF;
END $$;

-- Defensive sweep for other legacy NOT NULL columns that the engine may not write.
-- Only runs if the column exists.
DO $$
DECLARE
  c TEXT;
BEGIN
  FOREACH c IN ARRAY ARRAY[
    'entity_id',
    'action',
    'triggered_by',
    'notification_type',
    'source_record_id',
    'aggregate_key'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'notification_events'
        AND column_name = c
        AND is_nullable = 'NO'
        AND column_default IS NULL
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.notification_events ALTER COLUMN %I DROP NOT NULL',
        c
      );
    END IF;
  END LOOP;
END $$;

-- ── Fix 2: notifications.status default must be 'unread' ─────────────────
-- Only run if notifications.status exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.notifications
      ALTER COLUMN status SET DEFAULT 'unread';
  END IF;
END $$;

-- ── Fix 3: notification_rule_logs CHECK vocabulary ────────────────────────
-- Only run if notification_rule_logs exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'notification_rule_logs'
  ) THEN
    ALTER TABLE public.notification_rule_logs
      DROP CONSTRAINT IF EXISTS chk_notification_rule_logs_status;

    ALTER TABLE public.notification_rule_logs
      ADD CONSTRAINT chk_notification_rule_logs_status
      CHECK (
        status IS NULL
        OR status = ANY (ARRAY[
          'matched'::text,
          'skipped'::text,
          'failed'::text,
          'no_recipients'::text,
          'no_rule'::text
        ])
      );
  END IF;
END $$;

COMMIT;