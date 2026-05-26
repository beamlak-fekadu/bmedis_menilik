-- Migration 00024: Demo PM seed disabled for Menelik II real-data deployment
--
-- Original purpose:
-- This migration previously inserted additional demo preventive-maintenance plans,
-- schedules, completions, and PM compliance aggregates for demo departments/assets.
--
-- Menelik II deployment decision:
-- Demo asset IDs are not available in the real-data Supabase project, and this
-- deployment must not depend on demo data. Therefore, this migration is intentionally
-- converted into a no-op migration so the schema migration sequence can continue.
--
-- Real PM schedules, completions, and compliance metrics should be imported later
-- from Menelik II Hospital records through the Menelik import pipeline, after:
-- 1. equipment_assets are imported,
-- 2. departments and categories are mapped,
-- 3. auth users/profiles/roles are created,
-- 4. real PM/performance-verification records are converted to system tables.

DO $$
BEGIN
    RAISE NOTICE 'Migration 00024 skipped: demo PM seed data disabled for Menelik II real-data deployment.';
END $$;