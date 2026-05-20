-- Migration 00059: equipment.condition.update RPC + RLS alignment (R5)
--
-- Purpose: align the application-layer capability gate
-- (`equipment.condition.update`) with the database authorization layer.
--
-- Before this migration:
--   * Application: legacy role gate allowed
--     [admin, bme_head, technician, department_head, department_user] to call
--     updateEquipmentConditionAction.
--   * Database RLS (`manage_equipment` from 00012): allowed only admin OR
--     technician to UPDATE equipment_assets.
--   * Result: bme_head / department_head / department_user condition updates
--     were silently rejected at the DB layer (and the action swallowed the
--     error).
--
-- After this migration:
--   * The application calls update_equipment_condition_secure(asset_id, condition).
--   * The RPC is SECURITY DEFINER, validates the caller's role against the
--     equipment.condition.update capability allowlist (BME Head / admin /
--     technician / department_head / department_user / developer), and
--     updates only the condition column. Other columns are not touched.
--   * Store user and viewer remain denied — by RAISE EXCEPTION inside the RPC
--     and by the absence of equipment.condition.update in their capability
--     sets.
--   * The broader `manage_equipment` RLS policy is intentionally left intact;
--     bme_head / department roles still cannot UPDATE other equipment columns
--     directly. The narrow condition path goes through this RPC only.
--
-- The RPC also writes an audit_logs row so condition changes have governance
-- evidence even when called outside of the standard server-action path.

CREATE OR REPLACE FUNCTION update_equipment_condition_secure(
  p_asset_id UUID,
  p_condition TEXT
)
RETURNS TABLE (
  asset_id UUID,
  old_condition TEXT,
  new_condition TEXT
) AS $$
DECLARE
  v_old_condition TEXT;
  v_caller_profile_id UUID;
  v_allowed_roles TEXT[] := ARRAY[
    'developer',
    'admin',
    'bme_head',
    'technician',
    'department_head',
    'department_user'
  ];
  v_has_role BOOLEAN := FALSE;
BEGIN
  -- Validate condition enum (must match equipment_assets.condition CHECK).
  IF p_condition NOT IN (
    'functional', 'needs_repair', 'non_functional', 'under_maintenance', 'decommissioned'
  ) THEN
    RAISE EXCEPTION 'Invalid condition value: %', p_condition;
  END IF;

  -- Resolve caller's profile id from auth.uid().
  SELECT id INTO v_caller_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_caller_profile_id IS NULL THEN
    RAISE EXCEPTION 'Caller has no linked profile (auth.uid()=%)', auth.uid();
  END IF;

  -- Role allowlist check — capability matrix equivalent for equipment.condition.update.
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_caller_profile_id
      AND r.name = ANY(v_allowed_roles)
  ) INTO v_has_role;

  IF NOT v_has_role THEN
    RAISE EXCEPTION 'Caller lacks equipment.condition.update capability';
  END IF;

  -- Load the prior condition for audit + return value.
  SELECT condition INTO v_old_condition
  FROM equipment_assets
  WHERE id = p_asset_id;

  IF v_old_condition IS NULL THEN
    RAISE EXCEPTION 'Equipment asset % not found', p_asset_id;
  END IF;

  -- Update only the condition column. SECURITY DEFINER bypasses the
  -- manage_equipment RLS UPDATE policy for this narrow path.
  UPDATE equipment_assets
  SET condition = p_condition,
      updated_at = NOW()
  WHERE id = p_asset_id;

  -- Governance evidence — audit row independent of the calling action.
  INSERT INTO audit_logs (
    user_id,
    performed_by,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    details
  ) VALUES (
    v_caller_profile_id,
    v_caller_profile_id,
    'equipment.condition_update.rpc',
    'equipment_assets',
    p_asset_id,
    jsonb_build_object('condition', v_old_condition),
    jsonb_build_object('condition', p_condition),
    jsonb_build_object('source', 'update_equipment_condition_secure')
  );

  RETURN QUERY SELECT p_asset_id, v_old_condition, p_condition;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION update_equipment_condition_secure(UUID, TEXT) TO authenticated;

-- Note: we do NOT alter the existing manage_equipment policy. Broad equipment
-- editing (asset_code, serial_number, etc.) remains restricted to admin /
-- technician. Only the narrow condition path is widened through this RPC.
