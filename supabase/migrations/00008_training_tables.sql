-- Migration 00008: Training Tables
-- Training requests, sessions, staff records, and equipment training records.

-- =============================================================================
-- TRAINING REQUESTS
-- =============================================================================
CREATE TABLE training_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT NOT NULL UNIQUE,
    asset_id UUID REFERENCES equipment_assets(id),
    requested_by UUID REFERENCES profiles(id),
    department_id UUID REFERENCES departments(id),
    training_type TEXT NOT NULL DEFAULT 'equipment_operation' CHECK (training_type IN ('equipment_operation', 'maintenance', 'safety', 'calibration', 'refresher', 'other')),
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'scheduled', 'completed', 'rejected', 'canceled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_training_requests_asset ON training_requests(asset_id);
CREATE TRIGGER trg_training_requests_updated_at BEFORE UPDATE ON training_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TRAINING SESSIONS
-- =============================================================================
CREATE TABLE training_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    asset_id UUID REFERENCES equipment_assets(id),
    category_id UUID REFERENCES equipment_categories(id),
    trainer TEXT NOT NULL,
    training_date DATE NOT NULL,
    duration_hours DECIMAL(4,1),
    location TEXT,
    description TEXT,
    max_participants INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_training_sessions_updated_at BEFORE UPDATE ON training_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- STAFF TRAINING RECORDS
-- =============================================================================
CREATE TABLE staff_training_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    staff_user_id UUID REFERENCES profiles(id),
    staff_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'absent', 'certified')),
    certification_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_training_records_session ON staff_training_records(session_id);
CREATE INDEX idx_staff_training_records_staff ON staff_training_records(staff_user_id);

-- =============================================================================
-- EQUIPMENT TRAINING RECORDS
-- =============================================================================
CREATE TABLE equipment_training_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES equipment_assets(id),
    session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    topics_covered TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_equipment_training_records_asset ON equipment_training_records(asset_id);
