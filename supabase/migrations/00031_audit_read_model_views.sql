-- Migration 00031: Read-model views — exclude soft-deleted equipment; COALESCE nullable analytics joins

CREATE OR REPLACE VIEW v_open_work_orders AS
SELECT
  wo.id,
  wo.work_order_number,
  wo.status,
  wo.priority,
  wo.work_type,
  wo.created_at,
  wo.started_at,
  ea.asset_code,
  ea.name AS asset_name,
  d.name AS department_name,
  p.full_name AS assigned_to_name
FROM work_orders wo
JOIN equipment_assets ea ON wo.asset_id = ea.id AND ea.deleted_at IS NULL
LEFT JOIN departments d ON ea.department_id = d.id
LEFT JOIN profiles p ON wo.assigned_to = p.id
WHERE wo.status NOT IN ('completed', 'canceled');

CREATE OR REPLACE VIEW v_overdue_pm AS
SELECT
  ps.id,
  ps.scheduled_date,
  ps.status,
  pp.name AS plan_name,
  ea.asset_code,
  ea.name AS asset_name,
  d.name AS department_name,
  ec.name AS category_name,
  p.full_name AS assigned_to_name,
  CURRENT_DATE - ps.scheduled_date AS days_overdue
FROM pm_schedules ps
JOIN pm_plans pp ON ps.plan_id = pp.id
JOIN equipment_assets ea ON ps.asset_id = ea.id AND ea.deleted_at IS NULL
LEFT JOIN departments d ON ea.department_id = d.id
LEFT JOIN equipment_categories ec ON ea.category_id = ec.id
LEFT JOIN profiles p ON ps.assigned_to = p.id
WHERE ps.status = 'overdue'
   OR (ps.status = 'scheduled' AND ps.scheduled_date < CURRENT_DATE)
ORDER BY ps.scheduled_date ASC;

CREATE OR REPLACE VIEW v_calibration_due AS
SELECT
  cr.id,
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

CREATE OR REPLACE VIEW v_replacement_decision
WITH (security_invoker = true) AS
SELECT DISTINCT ON (rps.asset_id)
  rps.asset_id,
  e.asset_code,
  e.name AS asset_name,
  dep.name AS department_name,
  rps.age_score,
  rps.failure_score,
  rps.availability_score,
  rps.maintenance_burden_score,
  rps.spare_part_score,
  rps.risk_score,
  rps.cost_score,
  rps.replacement_priority_index,
  rps.rank AS replacement_rank,
  rps.justification,
  rps.computed_at,
  COALESCE(ers.rpn, 0)::INT AS current_rpn,
  COALESCE(ers.risk_level, 'low') AS current_risk_level,
  COALESCE(erm.availability_ratio, 0)::DECIMAL(5,4) AS current_availability,
  COALESCE(pmc.pmc_percentage, 0)::DECIMAL(5,2) AS current_pmc
FROM replacement_priority_scores rps
JOIN equipment_assets e ON e.id = rps.asset_id AND e.deleted_at IS NULL
LEFT JOIN departments dep ON dep.id = e.department_id
LEFT JOIN LATERAL (
  SELECT x.rpn, x.risk_level
  FROM equipment_risk_scores x
  WHERE x.asset_id = rps.asset_id
  ORDER BY x.assessed_at DESC
  LIMIT 1
) ers ON true
LEFT JOIN LATERAL (
  SELECT x.availability_ratio
  FROM equipment_reliability_metrics x
  WHERE x.asset_id = rps.asset_id
  ORDER BY x.computed_at DESC
  LIMIT 1
) erm ON true
LEFT JOIN LATERAL (
  SELECT x.pmc_percentage
  FROM pm_compliance_metrics x
  WHERE x.asset_id = rps.asset_id
  ORDER BY x.computed_at DESC
  LIMIT 1
) pmc ON true
ORDER BY rps.asset_id, rps.computed_at DESC;

CREATE OR REPLACE VIEW v_maintenance_risk_context
WITH (security_invoker = true) AS
SELECT
  e.id AS asset_id,
  e.asset_code,
  e.name AS asset_name,
  dep.name AS department_name,
  COALESCE(wo.open_cnt, 0)::INT AS open_work_orders_count,
  COALESCE(pm.overdue_days_max, 0)::INT AS overdue_pm_max_days,
  fail_agg.top_failure_code,
  fail_agg.failure_events_365d,
  lp.last_pm_completed_at,
  lr.rpn AS latest_rpn,
  lr.risk_level AS latest_risk_level,
  COALESCE(la.availability_ratio, 0)::DECIMAL(5,4) AS latest_availability,
  COALESCE(ps.shortage_flags, 0)::INT AS open_part_shortage_flags
FROM equipment_assets e
LEFT JOIN departments dep ON dep.id = e.department_id
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INT AS open_cnt
  FROM work_orders wo
  WHERE wo.asset_id = e.id
    AND wo.status IN ('open', 'assigned', 'in_progress', 'on_hold')
) wo ON true
LEFT JOIN LATERAL (
  SELECT MAX(GREATEST(0, (CURRENT_DATE - ps.scheduled_date)))::INT AS overdue_days_max
  FROM pm_schedules ps
  WHERE ps.asset_id = e.id
    AND ps.status = 'overdue'
) pm ON true
LEFT JOIN LATERAL (
  SELECT f.code AS top_failure_code, agg.cnt::INT AS failure_events_365d
  FROM (
    SELECT me.failure_code_id, COUNT(*) AS cnt
    FROM maintenance_events me
    WHERE me.asset_id = e.id
      AND me.failure_date >= CURRENT_DATE - INTERVAL '365 days'
      AND me.failure_code_id IS NOT NULL
    GROUP BY me.failure_code_id
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ) agg
  JOIN failure_codes f ON f.id = agg.failure_code_id
) fail_agg ON true
LEFT JOIN LATERAL (
  SELECT MAX(pc.completion_date) AS last_pm_completed_at
  FROM pm_completions pc
  JOIN pm_schedules psch ON psch.id = pc.schedule_id
  WHERE psch.asset_id = e.id
) lp ON true
LEFT JOIN LATERAL (
  SELECT x.rpn, x.risk_level
  FROM equipment_risk_scores x
  WHERE x.asset_id = e.id
  ORDER BY x.assessed_at DESC
  LIMIT 1
) lr ON true
LEFT JOIN LATERAL (
  SELECT x.availability_ratio
  FROM equipment_reliability_metrics x
  WHERE x.asset_id = e.id
  ORDER BY x.computed_at DESC
  LIMIT 1
) la ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INT AS shortage_flags
  FROM recommendation_flags rf
  WHERE rf.asset_id = e.id
    AND rf.is_acknowledged = false
    AND rf.flag_type IN ('part_shortage', 'low_stock')
) ps ON true
WHERE e.deleted_at IS NULL
  AND e.status = 'active';
