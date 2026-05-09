-- Migration 00039: Add completion outcome and final equipment condition to work orders
-- This prevents equipment from being silently set to Functional on every work order close.
-- Technician/BME Head must explicitly select the resolution outcome.

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS completion_outcome text
    CHECK (completion_outcome IN ('resolved', 'partially_resolved', 'not_resolved', 'awaiting_parts_or_vendor') OR completion_outcome IS NULL),
  ADD COLUMN IF NOT EXISTS final_equipment_condition text
    CHECK (final_equipment_condition IN ('functional', 'needs_repair', 'non_functional', 'under_maintenance') OR final_equipment_condition IS NULL);

COMMENT ON COLUMN work_orders.completion_outcome IS
  'Resolution outcome at work order completion. '
  'resolved = issue fixed (equipment functional). '
  'partially_resolved = partial fix (needs_repair). '
  'not_resolved = no fix achieved (non_functional). '
  'awaiting_parts_or_vendor = blocked (under_maintenance).';

COMMENT ON COLUMN work_orders.final_equipment_condition IS
  'Equipment condition as assessed by the technician at completion time. '
  'Used to set equipment_assets.condition. '
  'Defaults from completion_outcome but can be adjusted by the technician.';
