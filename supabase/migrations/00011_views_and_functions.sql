-- Migration 00011: Views and Database Functions
-- Useful views for dashboards, reports, and analytics computations.

-- =============================================================================
-- VIEW: Equipment summary with department and category info
-- =============================================================================
CREATE OR REPLACE VIEW v_equipment_summary AS
SELECT
    ea.id,
    ea.asset_code,
    ea.name,
    ea.serial_number,
    ea.condition,
    ea.status,
    ea.installation_date,
    ea.warranty_expiry,
    ea.purchase_cost,
    d.name AS department_name,
    d.code AS department_code,
    ec.name AS category_name,
    ec.criticality_level,
    m.name AS manufacturer_name,
    em.name AS model_name,
    EXTRACT(YEAR FROM age(COALESCE(ea.installation_date, ea.purchase_date, ea.created_at::date))) AS age_years
FROM equipment_assets ea
LEFT JOIN departments d ON ea.department_id = d.id
LEFT JOIN equipment_categories ec ON ea.category_id = ec.id
LEFT JOIN manufacturers m ON ea.manufacturer_id = m.id
LEFT JOIN equipment_models em ON ea.model_id = em.id
WHERE ea.deleted_at IS NULL;

-- =============================================================================
-- VIEW: Open work orders with asset and technician info
-- =============================================================================
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
JOIN equipment_assets ea ON wo.asset_id = ea.id
LEFT JOIN departments d ON ea.department_id = d.id
LEFT JOIN profiles p ON wo.assigned_to = p.id
WHERE wo.status NOT IN ('completed', 'canceled');

-- =============================================================================
-- VIEW: Overdue PM schedules
-- =============================================================================
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
JOIN equipment_assets ea ON ps.asset_id = ea.id
LEFT JOIN departments d ON ea.department_id = d.id
LEFT JOIN equipment_categories ec ON ea.category_id = ec.id
LEFT JOIN profiles p ON ps.assigned_to = p.id
WHERE ps.status = 'overdue'
   OR (ps.status = 'scheduled' AND ps.scheduled_date < CURRENT_DATE)
ORDER BY ps.scheduled_date ASC;

-- =============================================================================
-- VIEW: Calibration due soon
-- =============================================================================
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
JOIN equipment_assets ea ON cr.asset_id = ea.id
LEFT JOIN departments d ON ea.department_id = d.id
LEFT JOIN calibration_types ct ON cr.calibration_type_id = ct.id
WHERE cr.next_due_date IS NOT NULL
  AND cr.next_due_date <= CURRENT_DATE + INTERVAL '90 days'
ORDER BY cr.next_due_date ASC;

-- =============================================================================
-- VIEW: Spare parts low stock alerts
-- =============================================================================
CREATE OR REPLACE VIEW v_low_stock_parts AS
SELECT
    sp.id,
    sp.part_code,
    sp.name,
    sp.category,
    sp.current_stock,
    sp.reorder_level,
    sp.unit_cost,
    sp.reorder_level - sp.current_stock AS deficit
FROM spare_parts sp
WHERE sp.current_stock <= sp.reorder_level
  AND sp.is_active = true
ORDER BY (sp.reorder_level - sp.current_stock) DESC;

-- =============================================================================
-- VIEW: Dashboard statistics
-- =============================================================================
CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM equipment_assets WHERE deleted_at IS NULL AND status = 'active') AS total_equipment,
    (SELECT COUNT(*) FROM equipment_assets WHERE deleted_at IS NULL AND condition = 'functional') AS functional_count,
    (SELECT COUNT(*) FROM equipment_assets WHERE deleted_at IS NULL AND condition IN ('needs_repair', 'non_functional')) AS non_functional_count,
    (SELECT COUNT(*) FROM work_orders WHERE status NOT IN ('completed', 'canceled')) AS open_work_orders,
    (SELECT COUNT(*) FROM pm_schedules WHERE status = 'overdue' OR (status = 'scheduled' AND scheduled_date < CURRENT_DATE)) AS overdue_pm,
    (SELECT COUNT(*) FROM calibration_records WHERE next_due_date IS NOT NULL AND next_due_date <= CURRENT_DATE + INTERVAL '30 days') AS calibration_due_soon,
    (SELECT COUNT(*) FROM spare_parts WHERE current_stock <= reorder_level AND is_active = true) AS low_stock_parts,
    (SELECT COUNT(*) FROM disposal_requests WHERE status = 'pending') AS pending_disposals,
    (SELECT COUNT(*) FROM recommendation_flags WHERE is_acknowledged = false AND severity IN ('high', 'critical')) AS active_critical_alerts;

-- =============================================================================
-- FUNCTION: Compute MTTR for an asset over a period
-- Implements Proposal Equation 4: MTTR = T_maintenance / N_repairs
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_compute_mttr(
    p_asset_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS DECIMAL AS $$
DECLARE
    total_repair_hours DECIMAL;
    repair_count INTEGER;
BEGIN
    SELECT
        COALESCE(SUM(repair_duration_hours), 0),
        COUNT(*)
    INTO total_repair_hours, repair_count
    FROM maintenance_events
    WHERE asset_id = p_asset_id
      AND completion_date BETWEEN p_start_date AND p_end_date
      AND repair_duration_hours IS NOT NULL;

    IF repair_count = 0 THEN
        RETURN NULL;
    END IF;

    RETURN total_repair_hours / repair_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Compute MTBF for an asset over a period
-- Implements Proposal Equation 3: MTBF = T_operational / N_failures
-- =============================================================================
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
    period_hours := EXTRACT(EPOCH FROM (p_end_date - p_start_date)) / 3600.0;

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

-- =============================================================================
-- FUNCTION: Compute Availability for an asset over a period
-- Implements Proposal Equation 2: A = MTBF / (MTBF + MTTR)
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_compute_availability(
    p_asset_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS DECIMAL AS $$
DECLARE
    v_mtbf DECIMAL;
    v_mttr DECIMAL;
BEGIN
    v_mtbf := fn_compute_mtbf(p_asset_id, p_start_date, p_end_date);
    v_mttr := fn_compute_mttr(p_asset_id, p_start_date, p_end_date);

    IF v_mtbf IS NULL OR v_mttr IS NULL THEN
        RETURN NULL;
    END IF;

    IF (v_mtbf + v_mttr) = 0 THEN
        RETURN NULL;
    END IF;

    RETURN v_mtbf / (v_mtbf + v_mttr);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Compute PMC for a department/category over a period
-- Implements Proposal Equation 5: PMC = (PM_completed / PM_scheduled) * 100
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_compute_pmc(
    p_department_id UUID DEFAULT NULL,
    p_category_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
) RETURNS DECIMAL AS $$
DECLARE
    scheduled_count INTEGER;
    completed_count INTEGER;
BEGIN
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE ps.status = 'completed')
    INTO scheduled_count, completed_count
    FROM pm_schedules ps
    JOIN equipment_assets ea ON ps.asset_id = ea.id
    WHERE (p_department_id IS NULL OR ea.department_id = p_department_id)
      AND (p_category_id IS NULL OR ea.category_id = p_category_id)
      AND (p_start_date IS NULL OR ps.scheduled_date >= p_start_date)
      AND (p_end_date IS NULL OR ps.scheduled_date <= p_end_date);

    IF scheduled_count = 0 THEN
        RETURN NULL;
    END IF;

    RETURN (completed_count::DECIMAL / scheduled_count) * 100;
END;
$$ LANGUAGE plpgsql;
