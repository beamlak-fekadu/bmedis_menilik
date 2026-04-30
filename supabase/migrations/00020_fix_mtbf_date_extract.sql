-- Migration 00020: Fix MTBF date interval calculation
-- Ensures refresh works even when 00019 was already applied before this fix.

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
