-- Migration 00043: Calibration due view asset_id support
-- Keep Command Center and Calibration drilldowns exact by exposing the source asset.
--
-- PostgreSQL cannot change existing view column names/order with CREATE OR REPLACE VIEW.
-- Drop and recreate the view so the updated column structure is applied cleanly.

DROP VIEW IF EXISTS v_calibration_due;

CREATE VIEW v_calibration_due AS
SELECT
  cr.id,
  cr.asset_id,
  cr.calibration_date,
  cr.next_due_date,
  cr.result,
  ea.asset_code,
  ea.name AS asset_name,
  d.name AS department_name,
  ct.name AS calibration_type,
  cr.next_due_date - CURRENT_DATE AS days_until_due
FROM calibration_records cr
JOIN equipment_assets ea ON cr.asset_id = ea.id AND ea.deleted_at IS NULL
LEFT JOIN departments d ON ea.department_id = d.id
LEFT JOIN calibration_types ct ON cr.calibration_type_id = ct.id
WHERE cr.next_due_date IS NOT NULL
  AND cr.next_due_date <= CURRENT_DATE + INTERVAL '90 days'
ORDER BY cr.next_due_date ASC;