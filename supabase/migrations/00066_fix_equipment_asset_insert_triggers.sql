-- Migration 00066: Fix equipment_assets insert path
--
-- Two bugs were blocking BME Head from registering new equipment via
-- /equipment/new:
--
-- 1) TRIGGER FUNCTION BUG (from migration 00036)
--    `fn_trigger_refresh_fmea_risk_score()` is wired as an AFTER INSERT /
--    UPDATE trigger on `equipment_assets`. The function unconditionally reads
--    `NEW.asset_id` when TG_TABLE_NAME is in
--    ('maintenance_events', 'work_orders', 'pm_schedules',
--     'calibration_records', 'calibration_requests', 'equipment_assets').
--    Every table in that list has an `asset_id` column EXCEPT
--    `equipment_assets`, whose primary key is `id`. Postgres therefore
--    raised:
--        record "new" has no field "asset_id"
--    Every equipment INSERT failed at the trigger step. We branch on
--    TG_TABLE_NAME so the equipment_assets path uses NEW.id / OLD.id and
--    the other tables keep using NEW.asset_id / OLD.asset_id (which is
--    correct for them).
--
-- 2) RLS INSERT POLICY GAP (from migration 00026)
--    The legacy `manage_equipment` policy granted FOR ALL only to admin,
--    technician, and developer. BME Head was NOT in the allowlist, so
--    `INSERT INTO equipment_assets` returned:
--        new row violates row-level security policy for table "equipment_assets"
--    A temporary fix was applied directly to the Supabase project via the
--    SQL editor; this migration captures that fix in the repo and also
--    tightens the allowlist to match the application capability matrix
--    (`equipment.create` is granted to developer / admin / bme_head only,
--    NOT technician). Technician's only legitimate UPDATE path is the
--    narrow condition update via the SECURITY DEFINER RPC
--    `update_equipment_condition_secure(...)` from migration 00059 — that
--    path bypasses RLS by design.
--
-- Department-scoped SELECT policies from migration 00060 are NOT touched.

-- ============================================================================
-- 1) Fix fn_trigger_refresh_fmea_risk_score() to handle equipment_assets.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_trigger_refresh_fmea_risk_score()
RETURNS TRIGGER AS $$
DECLARE
  v_asset_id UUID;
BEGIN
  -- equipment_assets uses `id` as the asset identifier; every other table in
  -- this branch has its own `asset_id` FK column. Reading NEW.asset_id on
  -- equipment_assets raised "record new has no field asset_id".
  IF TG_TABLE_NAME = 'equipment_assets' THEN
    IF TG_OP = 'DELETE' THEN
      v_asset_id := OLD.id;
    ELSE
      v_asset_id := NEW.id;
    END IF;
  ELSIF TG_TABLE_NAME IN (
    'maintenance_events', 'work_orders', 'pm_schedules',
    'calibration_records', 'calibration_requests'
  ) THEN
    IF TG_OP = 'DELETE' THEN
      v_asset_id := OLD.asset_id;
    ELSE
      v_asset_id := NEW.asset_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'pm_completions' THEN
    SELECT ps.asset_id
    INTO v_asset_id
    FROM pm_schedules ps
    WHERE ps.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.schedule_id ELSE NEW.schedule_id END;
  END IF;

  IF v_asset_id IS NOT NULL THEN
    -- Refresh is best-effort; a failure here must not block the originating
    -- INSERT/UPDATE/DELETE. The recompute path is also reachable from the
    -- server action via recomputeAssetAnalytics() so missing one trigger
    -- pass is recoverable.
    BEGIN
      PERFORM fn_refresh_fmea_risk_score_for_asset(v_asset_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'fn_refresh_fmea_risk_score_for_asset(%) failed: %', v_asset_id, SQLERRM;
    END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2) Tighten equipment_assets INSERT/UPDATE/DELETE RLS to match the app
--    capability matrix (developer / admin / bme_head). Department-scoped
--    SELECT policies from migration 00060 are preserved.
-- ============================================================================

-- Remove the hotfix policy that was applied manually via the Supabase SQL
-- editor (its name had spaces and quoting that doesn't match repo style).
DROP POLICY IF EXISTS "Privileged users can insert equipment assets" ON equipment_assets;

-- Remove the legacy FOR ALL policy that allowed technician but NOT bme_head.
DROP POLICY IF EXISTS manage_equipment ON equipment_assets;

-- Canonical write policy. FOR ALL covers INSERT/UPDATE/DELETE. The default
-- WITH CHECK falls back to USING when omitted, so the same allowlist gates
-- both reads-for-mutation and the new-row check.
CREATE POLICY equipment_assets_privileged_write ON equipment_assets
FOR ALL TO authenticated
USING (
  auth_user_has_role('developer')
  OR auth_user_has_role('admin')
  OR auth_user_has_role('bme_head')
)
WITH CHECK (
  auth_user_has_role('developer')
  OR auth_user_has_role('admin')
  OR auth_user_has_role('bme_head')
);
