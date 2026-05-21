-- Migration 00072: calibration_requests INSERT policy helper
--
-- Follow-up to 00071. The first fix expressed the department check as an
-- inline EXISTS against equipment_assets. This version moves the check into a
-- SECURITY DEFINER helper so the policy does not depend on nested RLS behavior
-- while evaluating the target asset's department. The effective rule is the
-- same:
--   * developer/admin/bme_head/technician can create calibration requests
--   * department_head/department_user can create only for assets in their own
--     profile.department_id
--   * store_user/viewer remain denied

CREATE OR REPLACE FUNCTION can_create_calibration_request_for_asset(p_asset_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_department_id UUID;
BEGIN
  IF p_asset_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
    OR auth_user_has_role('technician') THEN
    RETURN TRUE;
  END IF;

  IF NOT (auth_user_has_role('department_head') OR auth_user_has_role('department_user')) THEN
    RETURN FALSE;
  END IF;

  v_department_id := auth_profile_department_id();
  IF v_department_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM equipment_assets ea
    WHERE ea.id = p_asset_id
      AND ea.department_id = v_department_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION can_create_calibration_request_for_asset(UUID) TO authenticated;

DROP POLICY IF EXISTS insert_calibration_requests ON calibration_requests;
CREATE POLICY insert_calibration_requests ON calibration_requests
FOR INSERT TO authenticated
WITH CHECK (can_create_calibration_request_for_asset(asset_id));
