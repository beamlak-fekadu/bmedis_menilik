-- Migration 00004: Maintenance Tables
-- Requests, work orders, events, downtime logs, and parts used.

-- =============================================================================
-- MAINTENANCE REQUESTS
-- =============================================================================
CREATE TABLE maintenance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT NOT NULL UNIQUE,
    asset_id UUID NOT NULL REFERENCES equipment_assets(id),
    requested_by UUID REFERENCES profiles(id),
    department_id UUID NOT NULL REFERENCES departments(id),
    fault_description TEXT NOT NULL,
    urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'assigned', 'in_progress', 'completed', 'rejected', 'canceled')),
    resolved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_maintenance_requests_asset ON maintenance_requests(asset_id);
CREATE INDEX idx_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX idx_maintenance_requests_department ON maintenance_requests(department_id);
CREATE TRIGGER trg_maintenance_requests_updated_at BEFORE UPDATE ON maintenance_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- WORK ORDERS
-- =============================================================================
CREATE TABLE work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_number TEXT NOT NULL UNIQUE,
    request_id UUID REFERENCES maintenance_requests(id),
    asset_id UUID NOT NULL REFERENCES equipment_assets(id),
    assigned_to UUID REFERENCES profiles(id),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'on_hold', 'completed', 'canceled')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    work_type TEXT NOT NULL DEFAULT 'corrective' CHECK (work_type IN ('corrective', 'preventive', 'inspection', 'calibration', 'installation')),
    root_cause TEXT,
    action_taken TEXT,
    external_vendor BOOLEAN DEFAULT false,
    external_vendor_name TEXT,
    closure_notes TEXT,
    estimated_hours DECIMAL(6,2),
    actual_hours DECIMAL(6,2),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_orders_asset ON work_orders(asset_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_assigned ON work_orders(assigned_to);
CREATE TRIGGER trg_work_orders_updated_at BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- MAINTENANCE EVENTS (detailed log of each repair action)
-- =============================================================================
CREATE TABLE maintenance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID REFERENCES work_orders(id),
    asset_id UUID NOT NULL REFERENCES equipment_assets(id),
    event_type TEXT NOT NULL DEFAULT 'corrective' CHECK (event_type IN ('corrective', 'preventive', 'inspection', 'emergency')),
    failure_date DATE,
    downtime_start TIMESTAMPTZ,
    downtime_end TIMESTAMPTZ,
    repair_duration_hours DECIMAL(8,2),
    action_taken TEXT,
    failure_code_id UUID REFERENCES failure_codes(id),
    action_code_id UUID REFERENCES maintenance_action_codes(id),
    service_cost DECIMAL(15,2),
    completed_by UUID REFERENCES profiles(id),
    completion_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_maintenance_events_asset ON maintenance_events(asset_id);
CREATE INDEX idx_maintenance_events_work_order ON maintenance_events(work_order_id);
CREATE INDEX idx_maintenance_events_failure_date ON maintenance_events(failure_date);
CREATE TRIGGER trg_maintenance_events_updated_at BEFORE UPDATE ON maintenance_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- DOWNTIME LOGS
-- =============================================================================
CREATE TABLE downtime_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES equipment_assets(id),
    event_id UUID REFERENCES maintenance_events(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_hours DECIMAL(8,2),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_downtime_logs_asset ON downtime_logs(asset_id);

-- =============================================================================
-- MAINTENANCE PARTS USED
-- =============================================================================
CREATE TABLE maintenance_parts_used (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES maintenance_events(id) ON DELETE CASCADE,
    spare_part_id UUID,  -- FK added after spare_parts table creation
    part_name TEXT NOT NULL,
    quantity_used INTEGER NOT NULL DEFAULT 1,
    unit_cost DECIMAL(12,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_maintenance_parts_used_event ON maintenance_parts_used(event_id);
