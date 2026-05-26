-- Migration 00044: Expose asset_id and department_id from operational views
--
-- PostgreSQL cannot change existing view column names/order using CREATE OR REPLACE VIEW.
-- Drop and recreate the views so asset_id and department_id can be exposed safely.

-- ── v_open_work_orders ────────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_open_work_orders;

CREATE VIEW v_open_work_orders AS
SELECT
  wo.id,
  wo.work_order_number,
  wo.status,
  wo.priority,
  wo.work_type,
  wo.created_at,
  wo.started_at,
  wo.asset_id,
  ea.department_id,
  ea.asset_code,
  ea.name          AS asset_name,
  d.name           AS department_name,
  p.full_name      AS assigned_to_name
FROM work_orders wo
JOIN equipment_assets ea ON wo.asset_id = ea.id AND ea.deleted_at IS NULL
LEFT JOIN departments   d ON ea.department_id = d.id
LEFT JOIN profiles      p ON wo.assigned_to   = p.id
WHERE wo.status NOT IN ('completed', 'canceled');


-- ── v_overdue_pm ──────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_overdue_pm;

CREATE VIEW v_overdue_pm AS
SELECT
    ps.id,
    ps.asset_id,
    ps.scheduled_date,
    ps.status,
    ea.department_id,
    pp.name          AS plan_name,
    ea.asset_code,
    ea.name          AS asset_name,
    d.name           AS department_name,
    ec.name          AS category_name,
    ec.criticality_level,
    p.full_name      AS assigned_to_name,
    CURRENT_DATE - ps.scheduled_date AS days_overdue
FROM pm_schedules ps
JOIN pm_plans pp        ON ps.plan_id  = pp.id
JOIN equipment_assets ea ON ps.asset_id = ea.id
LEFT JOIN departments   d  ON ea.department_id = d.id
LEFT JOIN equipment_categories ec ON ea.category_id = ec.id
LEFT JOIN profiles      p  ON ps.assigned_to   = p.id
WHERE ps.status IN ('overdue', 'in_progress')
   OR (ps.status = 'scheduled' AND ps.scheduled_date < CURRENT_DATE)
ORDER BY ps.scheduled_date ASC;