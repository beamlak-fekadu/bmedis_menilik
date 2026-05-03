-- Migration 00021: Decision support refresh log + AI-ready read-model views
-- Additive only; security_invoker on views so caller RLS applies.

-- =============================================================================
-- Refresh log (written from server actions after recompute + snapshot refresh)
-- =============================================================================
CREATE TABLE IF NOT EXISTS decision_support_refresh_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
  -- 'running' used only between insert and final update from server actions
  error_message TEXT,
  triggered_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  scope TEXT NOT NULL CHECK (scope IN ('asset', 'all')),
  asset_id UUID REFERENCES equipment_assets(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_decision_support_refresh_log_started
  ON decision_support_refresh_log (started_at DESC);

ALTER TABLE decision_support_refresh_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_decision_support_refresh_log
  ON decision_support_refresh_log FOR SELECT TO authenticated USING (true);

CREATE POLICY insert_decision_support_refresh_log
  ON decision_support_refresh_log FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_has_role('admin')
    OR auth_user_has_role('technician')
  );

CREATE POLICY update_decision_support_refresh_log
  ON decision_support_refresh_log FOR UPDATE TO authenticated
  USING (
    auth_user_has_role('admin')
    OR auth_user_has_role('technician')
  )
  WITH CHECK (
    auth_user_has_role('admin')
    OR auth_user_has_role('technician')
  );

-- =============================================================================
-- v_command_center_triage — triage queue + asset context + top open flag / asset
-- =============================================================================
CREATE OR REPLACE VIEW v_command_center_triage
WITH (security_invoker = true) AS
SELECT
  t.id AS triage_id,
  t.asset_id,
  e.asset_code,
  e.name AS asset_name,
  e.department_id,
  dep.name AS department_name,
  t.priority_score,
  t.recommendation,
  t.rationale,
  t.status,
  t.generated_at,
  t.assigned_to,
  rf.id AS top_flag_id,
  rf.flag_type AS top_flag_type,
  rf.severity AS top_flag_severity,
  rf.generated_at AS top_flag_generated_at
FROM triage_action_queue t
JOIN equipment_assets e ON e.id = t.asset_id AND e.deleted_at IS NULL
LEFT JOIN departments dep ON dep.id = e.department_id
LEFT JOIN LATERAL (
  SELECT f.id, f.flag_type, f.severity, f.generated_at
  FROM recommendation_flags f
  WHERE f.asset_id = t.asset_id
    AND f.is_acknowledged = false
  ORDER BY
    CASE f.severity
      WHEN 'critical' THEN 4
      WHEN 'high' THEN 3
      WHEN 'medium' THEN 2
      ELSE 1
    END DESC,
    f.generated_at DESC
  LIMIT 1
) rf ON true;

-- =============================================================================
-- v_asset_health_summary — latest health snapshot per asset
-- =============================================================================
CREATE OR REPLACE VIEW v_asset_health_summary
WITH (security_invoker = true) AS
SELECT DISTINCT ON (ehs.asset_id)
  ehs.asset_id,
  e.asset_code,
  e.name AS asset_name,
  dep.name AS department_name,
  ehs.health_score,
  ehs.reliability_component,
  ehs.pm_component,
  ehs.risk_component,
  ehs.status_component,
  ehs.explanation,
  ehs.snapshot_date,
  ehs.created_at AS snapshot_created_at
FROM equipment_health_snapshots ehs
JOIN equipment_assets e ON e.id = ehs.asset_id AND e.deleted_at IS NULL
LEFT JOIN departments dep ON dep.id = e.department_id
ORDER BY ehs.asset_id, ehs.snapshot_date DESC, ehs.created_at DESC;

-- =============================================================================
-- v_department_readiness — latest readiness snapshot per department
-- =============================================================================
CREATE OR REPLACE VIEW v_department_readiness
WITH (security_invoker = true) AS
SELECT DISTINCT ON (crs.department_id)
  crs.department_id,
  d.name AS department_name,
  crs.readiness_score,
  crs.essential_total,
  crs.essential_functional,
  crs.details,
  crs.snapshot_date,
  crs.created_at AS snapshot_created_at
FROM clinical_readiness_snapshots crs
JOIN departments d ON d.id = crs.department_id
ORDER BY crs.department_id, crs.snapshot_date DESC, crs.created_at DESC;

-- =============================================================================
-- v_replacement_decision — latest replacement score row per asset + context
-- =============================================================================
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
  ers.rpn AS current_rpn,
  ers.risk_level AS current_risk_level,
  erm.availability_ratio AS current_availability,
  pmc.pmc_percentage AS current_pmc
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

-- =============================================================================
-- v_maintenance_risk_context — per active asset operational + risk summary
-- =============================================================================
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
  la.availability_ratio AS latest_availability,
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
