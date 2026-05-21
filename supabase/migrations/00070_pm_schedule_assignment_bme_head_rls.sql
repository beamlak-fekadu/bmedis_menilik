-- Migration 00070: PM schedule assignment RLS for BME Head
--
-- App capability `pm.assign` is granted to developer / admin / bme_head.
-- The legacy pm_schedules write policies from 00012/00026 allowed admin,
-- technician, and developer but omitted bme_head. That mismatch caused
-- `UPDATE pm_schedules ... SELECT ... .single()` to see zero visible rows for
-- BME Head and surface PostgREST's singular JSON coercion error.
--
-- Keep department-scoped SELECT policies from 00060 intact. This migration only
-- aligns pm_schedules write access with the PM capability matrix, then adds a
-- column-specific assignment guard. Technicians retain PM execution updates but
-- cannot change assigned_to directly.

DROP POLICY IF EXISTS insert_pm_schedules ON pm_schedules;
DROP POLICY IF EXISTS update_pm_schedules ON pm_schedules;
DROP POLICY IF EXISTS delete_pm_schedules ON pm_schedules;

CREATE POLICY insert_pm_schedules ON pm_schedules
FOR INSERT TO authenticated
WITH CHECK (
  auth_user_has_role('developer')
  OR auth_user_has_role('admin')
  OR auth_user_has_role('bme_head')
  OR auth_user_has_role('technician')
);

CREATE POLICY update_pm_schedules ON pm_schedules
FOR UPDATE TO authenticated
USING (
  auth_user_has_role('developer')
  OR auth_user_has_role('admin')
  OR auth_user_has_role('bme_head')
  OR auth_user_has_role('technician')
)
WITH CHECK (
  auth_user_has_role('developer')
  OR auth_user_has_role('admin')
  OR auth_user_has_role('bme_head')
  OR auth_user_has_role('technician')
);

CREATE POLICY delete_pm_schedules ON pm_schedules
FOR DELETE TO authenticated
USING (
  auth_user_has_role('developer')
  OR auth_user_has_role('admin')
);

CREATE OR REPLACE FUNCTION prevent_unauthorized_pm_schedule_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
    AND NOT (
      auth_user_has_role('developer')
      OR auth_user_has_role('admin')
      OR auth_user_has_role('bme_head')
    )
  THEN
    RAISE EXCEPTION 'Only developer, admin, or bme_head can assign PM schedules'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_unauthorized_pm_schedule_assignment ON pm_schedules;
CREATE TRIGGER trg_prevent_unauthorized_pm_schedule_assignment
BEFORE UPDATE OF assigned_to ON pm_schedules
FOR EACH ROW
EXECUTE FUNCTION prevent_unauthorized_pm_schedule_assignment();
