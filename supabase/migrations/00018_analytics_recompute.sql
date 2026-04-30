-- Migration 00018: On-demand analytics recompute functions
-- Adds recompute_equipment_analytics(UUID) and recompute_all_equipment_analytics()
-- to recompute reliability metrics and PM compliance from live operational data,
-- then propagate changes to the decision-support snapshot layer.
-- Does not modify any existing table schema.

-- =============================================================================
-- INTERNAL HELPER: per-asset recompute without triggering snapshot refresh.
-- Called by recompute_all_equipment_analytics to avoid N redundant refreshes.
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
BEGIN
    v_period_end   := CURRENT_DATE;
    v_period_start := CURRENT_DATE - INTERVAL '365 days';

    -- -------------------------------------------------------------------------
    -- Reliability metrics via existing fn_* functions from migration 00011
    -- (same logic: MTBF = T_operational / N_failures, MTTR = T_maintenance / N_repairs,
    --  Availability = MTBF / (MTBF + MTTR))
    -- -------------------------------------------------------------------------
    v_mtbf         := fn_compute_mtbf(p_asset_id, v_period_start, v_period_end);
    v_mttr         := fn_compute_mttr(p_asset_id, v_period_start, v_period_end);
    v_availability := fn_compute_availability(p_asset_id, v_period_start, v_period_end);

    -- Raw supporting values required by equipment_reliability_metrics columns
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

    -- UPSERT into equipment_reliability_metrics
    -- (unique constraint on asset_id, period_start, period_end declared in 00010)
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

    -- -------------------------------------------------------------------------
    -- PMC for this asset over the same rolling period.
    -- fn_compute_pmc (00011) does not accept asset_id so we query directly,
    -- mirroring its logic: PMC = (completed / scheduled) * 100.
    -- pm_compliance_metrics has no unique constraint on (asset_id, period_start,
    -- period_end), so we use UPDATE ... IF NOT FOUND INSERT.
    -- -------------------------------------------------------------------------
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
               computed_at     = now()
         WHERE asset_id    = p_asset_id
           AND period_start = v_period_start
           AND period_end   = v_period_end;

        IF NOT FOUND THEN
            INSERT INTO pm_compliance_metrics (
                asset_id, period_start, period_end,
                scheduled_count, completed_count, computed_at
            ) VALUES (
                p_asset_id, v_period_start, v_period_end,
                v_scheduled_count, v_completed_count, now()
            );
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PUBLIC: Recompute analytics for a single asset, then refresh snapshots.
-- Called after work order closure or PM task completion via server action.
-- =============================================================================
CREATE OR REPLACE FUNCTION recompute_equipment_analytics(p_asset_id UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM _recompute_asset_metrics(p_asset_id);
    PERFORM refresh_decision_support_snapshots();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PUBLIC: Recompute analytics for all active assets, refresh snapshots once.
-- Loops over every non-deleted active asset without triggering N refreshes.
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

    -- Single refresh after all assets are recomputed
    PERFORM refresh_decision_support_snapshots();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
