-- Migration 00019: Command Center completeness
-- Completes the Command Center refresh path without modifying historical migrations.

-- Let non-viewer operational roles acknowledge command-center rows and their paired flags.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'triage_action_queue'
      AND policyname = 'acknowledge_triage_action_queue'
  ) THEN
    CREATE POLICY acknowledge_triage_action_queue ON triage_action_queue
      FOR UPDATE TO authenticated
      USING (
        auth_user_has_role('admin')
        OR auth_user_has_role('technician')
        OR auth_user_has_role('department_user')
        OR auth_user_has_role('store_user')
      )
      WITH CHECK (
        auth_user_has_role('admin')
        OR auth_user_has_role('technician')
        OR auth_user_has_role('department_user')
        OR auth_user_has_role('store_user')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recommendation_flags'
      AND policyname = 'acknowledge_recommendation_flags'
  ) THEN
    CREATE POLICY acknowledge_recommendation_flags ON recommendation_flags
      FOR UPDATE TO authenticated
      USING (
        auth_user_has_role('admin')
        OR auth_user_has_role('technician')
        OR auth_user_has_role('department_user')
        OR auth_user_has_role('store_user')
      )
      WITH CHECK (
        auth_user_has_role('admin')
        OR auth_user_has_role('technician')
        OR auth_user_has_role('department_user')
        OR auth_user_has_role('store_user')
      );
  END IF;
END $$;

-- Add one conservative system baseline risk row for active assets that have never
-- been assessed. Existing seeded/manual risk rows remain untouched.
CREATE OR REPLACE FUNCTION _ensure_baseline_risk_scores()
RETURNS VOID AS $$
BEGIN
  WITH active_assets AS (
    SELECT
      e.id,
      e.condition,
      e.status,
      e.installation_date,
      c.criticality_level,
      COALESCE(f.failure_count, 0) AS failure_count,
      COALESCE(pm.has_overdue_pm, false) AS has_overdue_pm,
      COALESCE(cal.has_overdue_calibration, false) AS has_overdue_calibration
    FROM equipment_assets e
    JOIN equipment_categories c ON c.id = e.category_id
    LEFT JOIN (
      SELECT asset_id, COUNT(*)::INT AS failure_count
      FROM maintenance_events
      WHERE failure_date >= CURRENT_DATE - INTERVAL '365 days'
      GROUP BY asset_id
    ) f ON f.asset_id = e.id
    LEFT JOIN (
      SELECT asset_id, true AS has_overdue_pm
      FROM pm_schedules
      WHERE status IN ('overdue', 'scheduled')
        AND scheduled_date < CURRENT_DATE
      GROUP BY asset_id
    ) pm ON pm.asset_id = e.id
    LEFT JOIN (
      SELECT DISTINCT ON (asset_id)
        asset_id,
        (next_due_date IS NOT NULL AND next_due_date < CURRENT_DATE) AS has_overdue_calibration
      FROM calibration_records
      ORDER BY asset_id, calibration_date DESC, created_at DESC
    ) cal ON cal.asset_id = e.id
    WHERE e.deleted_at IS NULL
      AND e.status = 'active'
      AND NOT EXISTS (
        SELECT 1
        FROM equipment_risk_scores ers
        WHERE ers.asset_id = e.id
      )
  ),
  scored AS (
    SELECT
      id,
      LEAST(10, GREATEST(
        CASE criticality_level
          WHEN 'critical' THEN 9
          WHEN 'high' THEN 8
          WHEN 'medium' THEN 5
          ELSE 3
        END,
        CASE
          WHEN condition = 'non_functional' THEN 7
          WHEN condition = 'needs_repair' THEN 6
          WHEN condition = 'under_maintenance' THEN 5
          ELSE 1
        END
      )) AS severity,
      LEAST(10, GREATEST(
        CASE
          WHEN failure_count >= 5 THEN 8
          WHEN failure_count >= 3 THEN 6
          WHEN failure_count >= 1 THEN 4
          ELSE 2
        END,
        CASE
          WHEN condition = 'non_functional' THEN 6
          WHEN condition = 'needs_repair' THEN 5
          ELSE 1
        END,
        CASE
          WHEN installation_date IS NOT NULL AND installation_date <= CURRENT_DATE - INTERVAL '10 years' THEN 5
          WHEN installation_date IS NOT NULL AND installation_date <= CURRENT_DATE - INTERVAL '7 years' THEN 4
          ELSE 1
        END
      )) AS occurrence,
      LEAST(10, GREATEST(
        2
        + CASE WHEN condition IN ('needs_repair', 'non_functional', 'under_maintenance') THEN 2 ELSE 0 END
        + CASE WHEN has_overdue_pm THEN 1 ELSE 0 END
        + CASE WHEN has_overdue_calibration THEN 1 ELSE 0 END,
        1
      )) AS detectability,
      jsonb_build_object(
        'source', 'system_baseline',
        'criticality', criticality_level,
        'condition', condition,
        'failure_count_365d', failure_count,
        'overdue_pm', has_overdue_pm,
        'overdue_calibration', has_overdue_calibration,
        'installation_date', installation_date
      )::TEXT AS note_details
    FROM active_assets
  )
  INSERT INTO equipment_risk_scores (asset_id, severity, occurrence, detectability, assessed_by, assessed_at, notes)
  SELECT
    id,
    severity,
    occurrence,
    detectability,
    NULL,
    now(),
    'System-generated baseline risk score for Command Center completeness. Inputs: ' || note_details
  FROM scored;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration 00011 computed DATE - DATE as an integer, then passed that integer
-- to EXTRACT(EPOCH FROM ...). Replacing the function here keeps old migrations
-- immutable while making the refresh pipeline safe on PostgreSQL.
CREATE OR REPLACE FUNCTION fn_compute_mtbf(
    p_asset_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS DECIMAL AS $$
DECLARE
    operational_hours DECIMAL;
    failure_count INTEGER;
    total_downtime DECIMAL;
    period_hours DECIMAL;
BEGIN
    period_hours := EXTRACT(EPOCH FROM (p_end_date::TIMESTAMP - p_start_date::TIMESTAMP)) / 3600.0;

    SELECT COUNT(*)
    INTO failure_count
    FROM maintenance_events
    WHERE asset_id = p_asset_id
      AND failure_date BETWEEN p_start_date AND p_end_date;

    IF failure_count = 0 THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(SUM(duration_hours), 0)
    INTO total_downtime
    FROM downtime_logs
    WHERE asset_id = p_asset_id
      AND start_time >= p_start_date
      AND start_time <= p_end_date;

    operational_hours := period_hours - total_downtime;

    IF operational_hours <= 0 THEN
        RETURN 0;
    END IF;

    RETURN operational_hours / failure_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_decision_support_snapshots(snapshot_dt DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
BEGIN
  -- Equipment health snapshots
  WITH latest_reliability AS (
      SELECT DISTINCT ON (asset_id)
          asset_id,
          COALESCE(availability_ratio, 0.92) AS availability_ratio
      FROM equipment_reliability_metrics
      ORDER BY asset_id, computed_at DESC
  ),
  latest_pm AS (
      SELECT DISTINCT ON (asset_id)
          asset_id,
          COALESCE(pmc_percentage, 80) AS pmc_percentage
      FROM pm_compliance_metrics
      WHERE asset_id IS NOT NULL
      ORDER BY asset_id, computed_at DESC
  ),
  latest_risk AS (
      SELECT DISTINCT ON (asset_id)
          asset_id,
          COALESCE(rpn, 120) AS rpn
      FROM equipment_risk_scores
      ORDER BY asset_id, assessed_at DESC
  ),
  active_flag_counts AS (
      SELECT asset_id, COUNT(*)::INT AS open_flags
      FROM recommendation_flags
      WHERE is_acknowledged = false
      GROUP BY asset_id
  )
  INSERT INTO equipment_health_snapshots (
      asset_id,
      health_score,
      reliability_component,
      pm_component,
      risk_component,
      status_component,
      explanation,
      snapshot_date
  )
  SELECT
      e.id AS asset_id,
      GREATEST(
          1,
          ROUND((
              COALESCE(r.availability_ratio, 0.92) * 35
              + (COALESCE(p.pmc_percentage, 80) / 100.0) * 25
              + (1 - LEAST(0.35, COALESCE(k.rpn, 120) / 1000.0)) * 25
              + (1 - CASE
                  WHEN e.condition = 'functional' THEN 0
                  WHEN e.condition = 'needs_repair' THEN 0.15
                  ELSE 0.30
                END
                - LEAST(0.25, COALESCE(f.open_flags, 0) * 0.05)) * 15
          )::NUMERIC, 2)
      ) AS health_score,
      ROUND((COALESCE(r.availability_ratio, 0.92) * 100)::NUMERIC, 2) AS reliability_component,
      ROUND(COALESCE(p.pmc_percentage, 80)::NUMERIC, 2) AS pm_component,
      ROUND(COALESCE(k.rpn, 120)::NUMERIC, 2) AS risk_component,
      ROUND(
        ((1 - CASE
            WHEN e.condition = 'functional' THEN 0
            WHEN e.condition = 'needs_repair' THEN 0.15
            ELSE 0.30
          END) * 100)::NUMERIC, 2
      ) AS status_component,
      jsonb_build_object(
          'availability', ROUND((COALESCE(r.availability_ratio, 0.92) * 100)::NUMERIC, 2),
          'pmc_percentage', ROUND(COALESCE(p.pmc_percentage, 80)::NUMERIC, 2),
          'rpn', ROUND(COALESCE(k.rpn, 120)::NUMERIC, 2),
          'open_flags', COALESCE(f.open_flags, 0),
          'condition', e.condition
      ) AS explanation,
      snapshot_dt
  FROM equipment_assets e
  LEFT JOIN latest_reliability r ON r.asset_id = e.id
  LEFT JOIN latest_pm p ON p.asset_id = e.id
  LEFT JOIN latest_risk k ON k.asset_id = e.id
  LEFT JOIN active_flag_counts f ON f.asset_id = e.id
  WHERE e.deleted_at IS NULL
    AND e.status = 'active'
  ON CONFLICT (asset_id, snapshot_date) DO UPDATE
    SET health_score = EXCLUDED.health_score,
        reliability_component = EXCLUDED.reliability_component,
        pm_component = EXCLUDED.pm_component,
        risk_component = EXCLUDED.risk_component,
        status_component = EXCLUDED.status_component,
        explanation = EXCLUDED.explanation;

  -- Department readiness snapshots (essential equipment = high/critical categories)
  INSERT INTO clinical_readiness_snapshots (
      department_id,
      readiness_score,
      essential_total,
      essential_functional,
      details,
      snapshot_date
  )
  SELECT
      d.id,
      CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND((SUM(CASE WHEN e.condition = 'functional' AND e.status = 'active' THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      END AS readiness_score,
      COUNT(*)::INT AS essential_total,
      SUM(CASE WHEN e.condition = 'functional' AND e.status = 'active' THEN 1 ELSE 0 END)::INT AS essential_functional,
      jsonb_build_object(
          'functional_today', SUM(CASE WHEN e.condition = 'functional' AND e.status = 'active' THEN 1 ELSE 0 END)::INT,
          'essential_total', COUNT(*)::INT
      ) AS details,
      snapshot_dt
  FROM departments d
  JOIN equipment_assets e ON e.department_id = d.id AND e.deleted_at IS NULL AND e.status = 'active'
  JOIN equipment_categories c ON c.id = e.category_id
  WHERE c.criticality_level IN ('high', 'critical')
  GROUP BY d.id
  ON CONFLICT (department_id, snapshot_date) DO UPDATE
    SET readiness_score = EXCLUDED.readiness_score,
        essential_total = EXCLUDED.essential_total,
        essential_functional = EXCLUDED.essential_functional,
        details = EXCLUDED.details;

  -- Workload capacity snapshots
  INSERT INTO workload_capacity_snapshots (
      assignee_id,
      snapshot_date,
      open_assignments,
      overdue_assignments,
      estimated_hours,
      capacity_hours,
      backlog_delta
  )
  SELECT
      wo.assigned_to AS assignee_id,
      snapshot_dt,
      COUNT(*)::INT AS open_assignments,
      SUM(CASE WHEN wo.priority IN ('high', 'critical') THEN 1 ELSE 0 END)::INT AS overdue_assignments,
      COALESCE(SUM(wo.estimated_hours), 0)::NUMERIC(8,2) AS estimated_hours,
      8.00::NUMERIC(8,2) AS capacity_hours,
      (COALESCE(SUM(wo.estimated_hours), 0) - 8.00)::NUMERIC(8,2) AS backlog_delta
  FROM work_orders wo
  WHERE wo.assigned_to IS NOT NULL
    AND wo.status IN ('open', 'assigned', 'in_progress', 'on_hold')
  GROUP BY wo.assigned_to
  ON CONFLICT (assignee_id, snapshot_date) DO UPDATE
    SET open_assignments = EXCLUDED.open_assignments,
        overdue_assignments = EXCLUDED.overdue_assignments,
        estimated_hours = EXCLUDED.estimated_hours,
        capacity_hours = EXCLUDED.capacity_hours,
        backlog_delta = EXCLUDED.backlog_delta;

  -- Refresh open triage queue for today
  DELETE FROM triage_action_queue
  WHERE generated_at::DATE = snapshot_dt AND status = 'open';

  WITH latest_risk AS (
      SELECT DISTINCT ON (asset_id) asset_id, COALESCE(rpn, 120) AS rpn
      FROM equipment_risk_scores
      ORDER BY asset_id, assessed_at DESC
  ),
  latest_pm AS (
      SELECT DISTINCT ON (asset_id) asset_id, COALESCE(pmc_percentage, 80) AS pmc_percentage
      FROM pm_compliance_metrics
      WHERE asset_id IS NOT NULL
      ORDER BY asset_id, computed_at DESC
  ),
  latest_replacement AS (
      SELECT DISTINCT ON (asset_id) asset_id, COALESCE(rank, 999) AS rank
      FROM replacement_priority_scores
      ORDER BY asset_id, computed_at DESC
  ),
  active_assignment AS (
      SELECT DISTINCT ON (asset_id)
          asset_id,
          assigned_to
      FROM work_orders
      WHERE assigned_to IS NOT NULL
        AND status IN ('open', 'assigned', 'in_progress', 'on_hold')
      ORDER BY asset_id,
        CASE priority WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC,
        created_at DESC
  ),
  active_flags AS (
      SELECT
          asset_id,
          COUNT(*)::INT AS cnt,
          SUM(CASE WHEN severity = 'critical' THEN 45 WHEN severity = 'high' THEN 25 WHEN severity = 'medium' THEN 10 ELSE 4 END)::NUMERIC AS sev_score,
          (ARRAY_AGG(flag_type ORDER BY CASE severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC, generated_at DESC))[1] AS top_flag_type
      FROM recommendation_flags
      WHERE is_acknowledged = false
      GROUP BY asset_id
  ),
  triage AS (
      SELECT
          e.id AS asset_id,
          ROUND(
            COALESCE(f.sev_score, 0)
            + LEAST(40, COALESCE(r.rpn, 120) / 15.0)
            + GREATEST(0, (80 - COALESCE(p.pmc_percentage, 80)) / 2.0)
            + GREATEST(0, 20 - COALESCE(rep.rank, 999))
          , 2) AS priority_score,
          CASE
              WHEN f.top_flag_type = 'part_shortage' THEN 'Expedite spare part or procurement action'
              WHEN f.top_flag_type = 'urgent_maintenance' THEN 'Create urgent corrective work order'
              WHEN f.top_flag_type = 'recurring_failure' THEN 'Schedule diagnostic for recurring failures'
              WHEN f.top_flag_type = 'replacement_candidate' THEN 'Review replacement priority plan'
              WHEN f.top_flag_type = 'overdue_pm' THEN 'Schedule overdue preventive maintenance'
              WHEN f.top_flag_type = 'calibrate_soon' THEN 'Schedule calibration or QA'
              WHEN COALESCE(r.rpn, 120) >= 500 THEN 'Immediate risk review and escalation'
              WHEN COALESCE(r.rpn, 120) >= 200 THEN 'Schedule risk mitigation'
              ELSE 'Monitor and plan preventive action'
          END AS recommendation,
          jsonb_build_array(
            CONCAT('open_flags=', COALESCE(f.cnt, 0)),
            CONCAT('top_flag=', COALESCE(f.top_flag_type, 'none')),
            CONCAT('rpn=', COALESCE(r.rpn, 120)),
            CONCAT('pmc=', ROUND(COALESCE(p.pmc_percentage, 80)::NUMERIC, 1)),
            CONCAT('replacement_rank=', COALESCE(rep.rank, 999))
          ) AS rationale,
          a.assigned_to
      FROM equipment_assets e
      LEFT JOIN latest_risk r ON r.asset_id = e.id
      LEFT JOIN latest_pm p ON p.asset_id = e.id
      LEFT JOIN latest_replacement rep ON rep.asset_id = e.id
      LEFT JOIN active_flags f ON f.asset_id = e.id
      LEFT JOIN active_assignment a ON a.asset_id = e.id
      WHERE e.deleted_at IS NULL
        AND e.status = 'active'
  )
  INSERT INTO triage_action_queue (asset_id, priority_score, recommendation, rationale, status, generated_at, assigned_to)
  SELECT
      t.asset_id,
      t.priority_score,
      t.recommendation,
      t.rationale,
      'open',
      now(),
      t.assigned_to
  FROM triage t
  ORDER BY t.priority_score DESC
  -- Generously bounded for production safety while covering the full seed/demo active asset set.
  LIMIT 1000;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION recompute_equipment_analytics(p_asset_id UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM _recompute_asset_metrics(p_asset_id);
    PERFORM _ensure_baseline_risk_scores();
    PERFORM refresh_decision_support_snapshots();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION recompute_all_equipment_analytics()
RETURNS VOID AS $$
DECLARE
    v_asset_id UUID;
BEGIN
    FOR v_asset_id IN
        SELECT id
        FROM   equipment_assets
        WHERE  deleted_at IS NULL
          AND  status = 'active'
    LOOP
        PERFORM _recompute_asset_metrics(v_asset_id);
    END LOOP;

    PERFORM _ensure_baseline_risk_scores();
    PERFORM refresh_decision_support_snapshots();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
