-- Migration 00034: equipment_reliability_metrics — one row per asset
-- 1) Delete duplicate rows per asset_id, keeping the row with highest computed_at.
-- 2) Drop composite UNIQUE(asset_id, period_start, period_end); add UNIQUE(asset_id).
-- 3) Update _recompute_asset_metrics to ON CONFLICT (asset_id) DO UPDATE so rolling
--    period windows upsert the same row (previously each day created a new row).

DELETE FROM equipment_reliability_metrics
WHERE id NOT IN (
  SELECT DISTINCT ON (asset_id) id
  FROM equipment_reliability_metrics
  ORDER BY asset_id, computed_at DESC
);

-- PG truncates long names (63 chars); deployed DB used equipment_reliability_metrics_asset_id_period_start_period__key
ALTER TABLE equipment_reliability_metrics
  DROP CONSTRAINT IF EXISTS equipment_reliability_metrics_asset_id_period_start_period_end_key;
ALTER TABLE equipment_reliability_metrics
  DROP CONSTRAINT IF EXISTS equipment_reliability_metrics_asset_id_period_start_period__key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reliability_metrics_asset_unique
  ON equipment_reliability_metrics (asset_id);

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
    ON CONFLICT (asset_id) DO UPDATE
        SET period_start            = EXCLUDED.period_start,
            period_end              = EXCLUDED.period_end,
            mttr_hours              = EXCLUDED.mttr_hours,
            mtbf_hours              = EXCLUDED.mtbf_hours,
            availability_ratio      = EXCLUDED.availability_ratio,
            total_downtime_hours    = EXCLUDED.total_downtime_hours,
            total_operational_hours = EXCLUDED.total_operational_hours,
            failure_count           = EXCLUDED.failure_count,
            repair_count            = EXCLUDED.repair_count,
            computed_at             = now();

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
