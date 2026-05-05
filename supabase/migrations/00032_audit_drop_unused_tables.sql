-- Migration 00032: Drop confirmed-unused tables (grep-gated: no references under src/)
-- repeat_repair_flags — superseded by recommendation_flags.recurring_failure narrative
-- equipment_locations — no application reads/writes (location tracked elsewhere)

DROP POLICY IF EXISTS select_repeat_repair_flags ON repeat_repair_flags;
DROP POLICY IF EXISTS manage_repeat_repair_flags ON repeat_repair_flags;
DROP TABLE IF EXISTS repeat_repair_flags;

DROP POLICY IF EXISTS select_equipment_locations ON equipment_locations;
DROP POLICY IF EXISTS manage_equipment_locations ON equipment_locations;
DROP TABLE IF EXISTS equipment_locations;
