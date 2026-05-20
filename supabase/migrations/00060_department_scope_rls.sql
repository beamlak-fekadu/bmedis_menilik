-- Migration 00060: Department-scoped RLS (R4)
--
-- Purpose: enforce department scoping at the database layer for
-- department_head and department_user roles. Before this migration,
-- department scoping lived only in service-layer filters; any service or
-- direct DB query that forgot the filter could leak cross-department data
-- to department-scoped users. After this migration, RLS itself denies
-- cross-department reads for those two roles.
--
-- Strategy:
--   * Keep the existing broad `select_*` policies but exclude dept-scoped
--     roles from them (`auth_user_has_role('department_*') = FALSE`).
--   * Add a new `select_*_dept_scope` policy that is permissive for
--     dept-scoped roles when the row's department_id matches the caller's
--     profile.department_id (resolved via auth_profile_department_id()).
--   * Multiple permissive SELECT policies are OR'd in Postgres, so
--     developer/admin/bme_head/technician/store_user/viewer continue to read
--     everything via the existing path. department_head / department_user
--     are now constrained.
--
-- Tables covered (per Phase 1 R4 scope):
--   equipment_assets, maintenance_requests, work_orders,
--   pm_schedules, pm_completions, calibration_requests, calibration_records,
--   equipment_risk_scores, equipment_reliability_metrics,
--   replacement_priority_scores.
--
-- Notifications already enforce recipient-only RLS at the row level and do
-- not need a department-scope policy (the recipient is already a profile id).
--
-- Helper functions are wrapped in STABLE SECURITY DEFINER so policy
-- evaluation does not recurse through RLS on the lookup tables themselves.

-- ============================================================================
-- Helper: caller's department_id (from profiles).
-- ============================================================================

CREATE OR REPLACE FUNCTION auth_profile_department_id()
RETURNS UUID AS $$
DECLARE
  v_dept_id UUID;
BEGIN
  SELECT p.department_id
  INTO v_dept_id
  FROM profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
  RETURN v_dept_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION auth_profile_department_id() TO authenticated;

-- A dept-scoped role is constrained iff:
--   1) The caller has department_head OR department_user role.
--   2) The caller's profile has a non-null department_id.
--   3) The row's department_id equals the caller's department_id.
--
-- If (2) is false, the dept-scoped policy fails and the caller sees nothing
-- on that table (a deliberate fail-closed posture for misconfigured profiles).

CREATE OR REPLACE FUNCTION is_dept_scoped_role()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth_user_has_role('department_head') OR auth_user_has_role('department_user');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION is_dept_scoped_role() TO authenticated;

-- ============================================================================
-- equipment_assets
-- ============================================================================

DROP POLICY IF EXISTS select_equipment ON equipment_assets;
DROP POLICY IF EXISTS select_equipment_dept_scope ON equipment_assets;

CREATE POLICY select_equipment ON equipment_assets
  FOR SELECT TO authenticated
  USING (NOT is_dept_scoped_role());

CREATE POLICY select_equipment_dept_scope ON equipment_assets
  FOR SELECT TO authenticated
  USING (
    is_dept_scoped_role()
    AND department_id IS NOT NULL
    AND department_id = auth_profile_department_id()
  );

-- ============================================================================
-- maintenance_requests
-- ============================================================================

DROP POLICY IF EXISTS select_maintenance_requests ON maintenance_requests;
DROP POLICY IF EXISTS select_maintenance_requests_dept_scope ON maintenance_requests;

CREATE POLICY select_maintenance_requests ON maintenance_requests
  FOR SELECT TO authenticated
  USING (NOT is_dept_scoped_role());

CREATE POLICY select_maintenance_requests_dept_scope ON maintenance_requests
  FOR SELECT TO authenticated
  USING (
    is_dept_scoped_role()
    AND department_id IS NOT NULL
    AND department_id = auth_profile_department_id()
  );

-- ============================================================================
-- work_orders (department resolved via linked asset)
-- ============================================================================

DROP POLICY IF EXISTS select_work_orders ON work_orders;
DROP POLICY IF EXISTS select_work_orders_dept_scope ON work_orders;

CREATE POLICY select_work_orders ON work_orders
  FOR SELECT TO authenticated
  USING (NOT is_dept_scoped_role());

CREATE POLICY select_work_orders_dept_scope ON work_orders
  FOR SELECT TO authenticated
  USING (
    is_dept_scoped_role()
    AND EXISTS (
      SELECT 1 FROM equipment_assets ea
      WHERE ea.id = work_orders.asset_id
        AND ea.department_id IS NOT NULL
        AND ea.department_id = auth_profile_department_id()
    )
  );

-- ============================================================================
-- pm_schedules + pm_completions (department via asset)
-- ============================================================================

DROP POLICY IF EXISTS select_pm_schedules ON pm_schedules;
DROP POLICY IF EXISTS select_pm_schedules_dept_scope ON pm_schedules;

CREATE POLICY select_pm_schedules ON pm_schedules
  FOR SELECT TO authenticated
  USING (NOT is_dept_scoped_role());

CREATE POLICY select_pm_schedules_dept_scope ON pm_schedules
  FOR SELECT TO authenticated
  USING (
    is_dept_scoped_role()
    AND EXISTS (
      SELECT 1 FROM equipment_assets ea
      WHERE ea.id = pm_schedules.asset_id
        AND ea.department_id = auth_profile_department_id()
    )
  );

DROP POLICY IF EXISTS select_pm_completions ON pm_completions;
DROP POLICY IF EXISTS select_pm_completions_dept_scope ON pm_completions;

CREATE POLICY select_pm_completions ON pm_completions
  FOR SELECT TO authenticated
  USING (NOT is_dept_scoped_role());

CREATE POLICY select_pm_completions_dept_scope ON pm_completions
  FOR SELECT TO authenticated
  USING (
    is_dept_scoped_role()
    AND EXISTS (
      SELECT 1 FROM pm_schedules ps
      JOIN equipment_assets ea ON ea.id = ps.asset_id
      WHERE ps.id = pm_completions.schedule_id
        AND ea.department_id = auth_profile_department_id()
    )
  );

-- ============================================================================
-- calibration_requests + calibration_records (department via asset)
-- ============================================================================

DROP POLICY IF EXISTS select_calibration_requests ON calibration_requests;
DROP POLICY IF EXISTS select_calibration_requests_dept_scope ON calibration_requests;

CREATE POLICY select_calibration_requests ON calibration_requests
  FOR SELECT TO authenticated
  USING (NOT is_dept_scoped_role());

CREATE POLICY select_calibration_requests_dept_scope ON calibration_requests
  FOR SELECT TO authenticated
  USING (
    is_dept_scoped_role()
    AND EXISTS (
      SELECT 1 FROM equipment_assets ea
      WHERE ea.id = calibration_requests.asset_id
        AND ea.department_id = auth_profile_department_id()
    )
  );

DROP POLICY IF EXISTS select_calibration_records ON calibration_records;
DROP POLICY IF EXISTS select_calibration_records_dept_scope ON calibration_records;

CREATE POLICY select_calibration_records ON calibration_records
  FOR SELECT TO authenticated
  USING (NOT is_dept_scoped_role());

CREATE POLICY select_calibration_records_dept_scope ON calibration_records
  FOR SELECT TO authenticated
  USING (
    is_dept_scoped_role()
    AND EXISTS (
      SELECT 1 FROM equipment_assets ea
      WHERE ea.id = calibration_records.asset_id
        AND ea.department_id = auth_profile_department_id()
    )
  );

-- ============================================================================
-- Analytics: equipment_risk_scores, equipment_reliability_metrics,
-- replacement_priority_scores (department via asset)
-- ============================================================================

DROP POLICY IF EXISTS select_equipment_risk_scores ON equipment_risk_scores;
DROP POLICY IF EXISTS select_equipment_risk_scores_dept_scope ON equipment_risk_scores;

CREATE POLICY select_equipment_risk_scores ON equipment_risk_scores
  FOR SELECT TO authenticated
  USING (NOT is_dept_scoped_role());

CREATE POLICY select_equipment_risk_scores_dept_scope ON equipment_risk_scores
  FOR SELECT TO authenticated
  USING (
    is_dept_scoped_role()
    AND EXISTS (
      SELECT 1 FROM equipment_assets ea
      WHERE ea.id = equipment_risk_scores.asset_id
        AND ea.department_id = auth_profile_department_id()
    )
  );

DROP POLICY IF EXISTS select_equipment_reliability_metrics ON equipment_reliability_metrics;
DROP POLICY IF EXISTS select_equipment_reliability_metrics_dept_scope ON equipment_reliability_metrics;

CREATE POLICY select_equipment_reliability_metrics ON equipment_reliability_metrics
  FOR SELECT TO authenticated
  USING (NOT is_dept_scoped_role());

CREATE POLICY select_equipment_reliability_metrics_dept_scope ON equipment_reliability_metrics
  FOR SELECT TO authenticated
  USING (
    is_dept_scoped_role()
    AND EXISTS (
      SELECT 1 FROM equipment_assets ea
      WHERE ea.id = equipment_reliability_metrics.asset_id
        AND ea.department_id = auth_profile_department_id()
    )
  );

DROP POLICY IF EXISTS select_replacement_priority_scores ON replacement_priority_scores;
DROP POLICY IF EXISTS select_replacement_priority_scores_dept_scope ON replacement_priority_scores;

CREATE POLICY select_replacement_priority_scores ON replacement_priority_scores
  FOR SELECT TO authenticated
  USING (NOT is_dept_scoped_role());

CREATE POLICY select_replacement_priority_scores_dept_scope ON replacement_priority_scores
  FOR SELECT TO authenticated
  USING (
    is_dept_scoped_role()
    AND EXISTS (
      SELECT 1 FROM equipment_assets ea
      WHERE ea.id = replacement_priority_scores.asset_id
        AND ea.department_id = auth_profile_department_id()
    )
  );
