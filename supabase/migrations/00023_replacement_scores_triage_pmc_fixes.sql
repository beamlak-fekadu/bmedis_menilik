-- Migration 00023: Replacement scores for all assets, triage accumulation fix, PMC dept fix
-- Fixes three issues identified after the 2026-05-03 session:
--   1. replacement_priority_scores had only 8 seed rows; adds compute_replacement_priority_scores_all()
--   2. refresh_decision_support_snapshots() only deleted today's triage rows; now deletes all 'open' rows
--   3. _recompute_asset_metrics() omitted department_id/category_id on PMC upsert; /pm chart showed 5/8 depts

-- =============================================================================
-- 1. _recompute_asset_metrics — add department_id + category_id to PMC upsert
-- =============================================================================
CREATE OR REPLACE FUNCTION _recompute_asset_metrics(p_asset_id UUID)
RETURNS VOID AS $$
DECLARE
    v_period_start        DATE;
    v_period_end          DATE;
    v_mtbf                DECIMAL;
    v_mttr                DECIMAL;
    v_availability        DECIMAL;
    v_period_hours        DECIMAL;
    v_total_downtime      DECIMAL;
    v_total_operational   DECIMAL;
    v_failure_count       INTEGER;
    v_repair_count        INTEGER;
    v_scheduled_count     INTEGER;
    v_completed_count     INTEGER;
    v_department_id       UUID;
    v_category_id         UUID;
BEGIN
    v_period_end   := CURRENT_DATE;
    v_period_start := CURRENT_DATE - INTERVAL '365 days';

    v_mtbf         := fn_compute_mtbf(p_asset_id, v_period_start, v_period_end);
    v_mttr         := fn_compute_mttr(p_asset_id, v_period_start, v_period_end);
    v_availability := fn_compute_availability(p_asset_id, v_period_start, v_period_end);

    v_period_hours := EXTRACT(EPOCH FROM (v_period_end::TIMESTAMP - v_period_start::TIMESTAMP)) / 3600.0;

    SELECT COALESCE(SUM(duration_hours), 0)
    INTO   v_total_downtime
    FROM   downtime_logs
    WHERE  asset_id   = p_asset_id
      AND  start_time >= v_period_start
      AND  start_time <= v_period_end;

    v_total_operational := GREATEST(0, v_period_hours - v_total_downtime);

    SELECT COUNT(*)
    INTO   v_failure_count
    FROM   maintenance_events
    WHERE  asset_id     = p_asset_id
      AND  failure_date BETWEEN v_period_start AND v_period_end;

    SELECT COUNT(*)
    INTO   v_repair_count
    FROM   maintenance_events
    WHERE  asset_id              = p_asset_id
      AND  completion_date       BETWEEN v_period_start AND v_period_end
      AND  repair_duration_hours IS NOT NULL;

    INSERT INTO equipment_reliability_metrics (
        asset_id, period_start, period_end,
        mttr_hours, mtbf_hours, availability_ratio,
        total_downtime_hours, total_operational_hours,
        failure_count, repair_count, computed_at
    ) VALUES (
        p_asset_id, v_period_start, v_period_end,
        v_mttr, v_mtbf, v_availability,
        v_total_downtime, v_total_operational,
        v_failure_count, v_repair_count, now()
    )
    ON CONFLICT (asset_id, period_start, period_end) DO UPDATE
        SET mttr_hours              = EXCLUDED.mttr_hours,
            mtbf_hours              = EXCLUDED.mtbf_hours,
            availability_ratio      = EXCLUDED.availability_ratio,
            total_downtime_hours    = EXCLUDED.total_downtime_hours,
            total_operational_hours = EXCLUDED.total_operational_hours,
            failure_count           = EXCLUDED.failure_count,
            repair_count            = EXCLUDED.repair_count,
            computed_at             = now();

    -- Look up department + category for this asset so PMC rows are department-attributed
    SELECT e.department_id, e.category_id
    INTO   v_department_id, v_category_id
    FROM   equipment_assets e
    WHERE  e.id = p_asset_id;

    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE ps.status = 'completed')
    INTO   v_scheduled_count, v_completed_count
    FROM   pm_schedules ps
    WHERE  ps.asset_id       = p_asset_id
      AND  ps.scheduled_date BETWEEN v_period_start AND v_period_end;

    IF v_scheduled_count > 0 THEN
        UPDATE pm_compliance_metrics
           SET scheduled_count = v_scheduled_count,
               completed_count = v_completed_count,
               department_id   = v_department_id,
               category_id     = v_category_id,
               computed_at     = now()
         WHERE asset_id    = p_asset_id
           AND period_start = v_period_start
           AND period_end   = v_period_end;

        IF NOT FOUND THEN
            INSERT INTO pm_compliance_metrics (
                asset_id, period_start, period_end,
                scheduled_count, completed_count,
                department_id, category_id, computed_at
            ) VALUES (
                p_asset_id, v_period_start, v_period_end,
                v_scheduled_count, v_completed_count,
                v_department_id, v_category_id, now()
            );
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 2. compute_replacement_priority_scores_all — new: scores all 80 active assets
-- =============================================================================
CREATE OR REPLACE FUNCTION compute_replacement_priority_scores_all(
    p_period_start DATE DEFAULT (CURRENT_DATE - INTERVAL '15 months')::DATE,
    p_period_end   DATE DEFAULT CURRENT_DATE
)
RETURNS VOID AS $$
BEGIN
    -- Idempotent: remove previous system-computed rows before re-inserting.
    -- Seed rows (weights_profile_id IS NOT NULL) are preserved.
    DELETE FROM replacement_priority_scores WHERE weights_profile_id IS NULL;

    INSERT INTO replacement_priority_scores (
        asset_id, period_start, period_end,
        age_score, failure_score, availability_score, maintenance_burden_score,
        spare_part_score, risk_score, cost_score,
        replacement_priority_index, rank, justification,
        weights_profile_id, computed_at
    )
    WITH active AS (
        SELECT
            id AS asset_id,
            GREATEST(0, EXTRACT(YEAR FROM AGE(CURRENT_DATE,
                COALESCE(installation_date, purchase_date,
                    CURRENT_DATE - INTERVAL '5 years')
            ))) AS age_years
        FROM equipment_assets
        WHERE deleted_at IS NULL AND status = 'active'
    ),
    reliability AS (
        SELECT DISTINCT ON (asset_id)
            asset_id,
            COALESCE(failure_count, 0)         AS failure_count,
            COALESCE(availability_ratio, 0.92) AS availability_ratio,
            COALESCE(total_downtime_hours, 0)  AS downtime_hours
        FROM equipment_reliability_metrics
        ORDER BY asset_id, computed_at DESC
    ),
    risk AS (
        SELECT DISTINCT ON (asset_id)
            asset_id,
            COALESCE(rpn, 120) AS rpn
        FROM equipment_risk_scores
        ORDER BY asset_id, assessed_at DESC
    ),
    spare AS (
        SELECT asset_id, COUNT(*)::NUMERIC AS shortage_flags
        FROM recommendation_flags
        WHERE flag_type = 'part_shortage' AND is_acknowledged = false
        GROUP BY asset_id
    ),
    cost AS (
        SELECT asset_id, COALESCE(SUM(service_cost), 0)::NUMERIC AS maint_cost
        FROM maintenance_events
        WHERE failure_date BETWEEN p_period_start AND p_period_end
          AND service_cost IS NOT NULL
        GROUP BY asset_id
    ),
    raw AS (
        SELECT
            a.asset_id,
            a.age_years,
            COALESCE(r.failure_count, 0)         AS failure_count,
            COALESCE(r.availability_ratio, 0.92) AS availability_ratio,
            COALESCE(r.downtime_hours, 0)        AS downtime_hours,
            COALESCE(s.shortage_flags, 0)        AS shortage_flags,
            COALESCE(k.rpn, 120)::NUMERIC        AS rpn,
            COALESCE(c.maint_cost, 0)            AS maint_cost
        FROM active a
        LEFT JOIN reliability r ON r.asset_id = a.asset_id
        LEFT JOIN risk k        ON k.asset_id = a.asset_id
        LEFT JOIN spare s       ON s.asset_id = a.asset_id
        LEFT JOIN cost c        ON c.asset_id = a.asset_id
    ),
    bounds AS (
        SELECT
            MIN(age_years)          AS age_lo,    MAX(age_years)          AS age_hi,
            MIN(failure_count)      AS fail_lo,   MAX(failure_count)      AS fail_hi,
            MIN(availability_ratio) AS avail_lo,  MAX(availability_ratio) AS avail_hi,
            MIN(downtime_hours)     AS burden_lo, MAX(downtime_hours)     AS burden_hi,
            MIN(shortage_flags)     AS spare_lo,  MAX(shortage_flags)     AS spare_hi,
            MIN(rpn)                AS rpn_lo,    MAX(rpn)                AS rpn_hi,
            MIN(maint_cost)         AS cost_lo,   MAX(maint_cost)         AS cost_hi
        FROM raw
    ),
    norm AS (
        SELECT
            r.asset_id,
            CASE WHEN b.age_hi    > b.age_lo    THEN (r.age_years         - b.age_lo)   / (b.age_hi    - b.age_lo)    ELSE 0.5 END AS age_score,
            CASE WHEN b.fail_hi   > b.fail_lo   THEN (r.failure_count     - b.fail_lo)  / (b.fail_hi   - b.fail_lo)   ELSE 0.5 END AS failure_score,
            -- Inverse: low availability → high replacement urgency
            CASE WHEN b.avail_hi  > b.avail_lo  THEN (b.avail_hi - r.availability_ratio) / (b.avail_hi - b.avail_lo)  ELSE 0.5 END AS avail_score,
            CASE WHEN b.burden_hi > b.burden_lo THEN (r.downtime_hours    - b.burden_lo) / (b.burden_hi - b.burden_lo) ELSE 0.5 END AS burden_score,
            CASE WHEN b.spare_hi  > b.spare_lo  THEN (r.shortage_flags    - b.spare_lo)  / (b.spare_hi  - b.spare_lo)  ELSE 0.5 END AS spare_score,
            CASE WHEN b.rpn_hi    > b.rpn_lo    THEN (r.rpn               - b.rpn_lo)   / (b.rpn_hi    - b.rpn_lo)    ELSE 0.5 END AS risk_score,
            CASE WHEN b.cost_hi   > b.cost_lo   THEN (r.maint_cost        - b.cost_lo)  / (b.cost_hi   - b.cost_lo)   ELSE 0.5 END AS cost_score
        FROM raw r, bounds b
    ),
    scored AS (
        SELECT
            asset_id,
            ROUND(age_score::NUMERIC,     4) AS age_score,
            ROUND(failure_score::NUMERIC, 4) AS failure_score,
            ROUND(avail_score::NUMERIC,   4) AS availability_score,
            ROUND(burden_score::NUMERIC,  4) AS maintenance_burden_score,
            ROUND(spare_score::NUMERIC,   4) AS spare_part_score,
            ROUND(risk_score::NUMERIC,    4) AS risk_score,
            ROUND(cost_score::NUMERIC,    4) AS cost_score,
            -- Weights sum to 1.00 (same as TypeScript weighted-sum formula)
            ROUND((
                age_score     * 0.15 +
                failure_score * 0.15 +
                avail_score   * 0.20 +
                burden_score  * 0.15 +
                spare_score   * 0.10 +
                risk_score    * 0.15 +
                cost_score    * 0.10
            )::NUMERIC, 4) AS replacement_priority_index
        FROM norm
    ),
    ranked AS (
        SELECT *,
            ROW_NUMBER() OVER (ORDER BY replacement_priority_index DESC)::INT AS rank
        FROM scored
    )
    SELECT
        r.asset_id,
        p_period_start,
        p_period_end,
        r.age_score,
        r.failure_score,
        r.availability_score,
        r.maintenance_burden_score,
        r.spare_part_score,
        r.risk_score,
        r.cost_score,
        r.replacement_priority_index,
        r.rank,
        'System-computed: top drivers = availability(' ||
            ROUND(r.availability_score * 0.20, 3) || '), risk(' ||
            ROUND(r.risk_score * 0.15, 3) || '), failure(' ||
            ROUND(r.failure_score * 0.15, 3) || ')',
        NULL::UUID,  -- weights_profile_id NULL distinguishes system-computed from seed rows
        now()
    FROM ranked r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. refresh_decision_support_snapshots — fix DELETE to clear ALL open rows
--    (previously only deleted today's rows, causing unbounded accumulation)
-- =============================================================================
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

  -- Department readiness snapshots
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

  -- Clear ALL open triage rows before re-inserting (fixes prior-day accumulation bug)
  DELETE FROM triage_action_queue WHERE status = 'open';

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
  LIMIT 1000;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 4. recompute_all_equipment_analytics — wire in replacement score computation
-- =============================================================================
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
    PERFORM compute_replacement_priority_scores_all();
    PERFORM refresh_decision_support_snapshots();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
