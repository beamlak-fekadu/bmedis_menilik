-- Migration 00006: Calibration Tables
-- Calibration requests, records, and certificates.

-- =============================================================================
-- CALIBRATION REQUESTS
-- =============================================================================
CREATE TABLE calibration_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT NOT NULL UNIQUE,
    asset_id UUID NOT NULL REFERENCES equipment_assets(id),
    requested_by UUID REFERENCES profiles(id),
    calibration_type_id UUID REFERENCES calibration_types(id),
    urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_progress', 'completed', 'rejected', 'canceled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calibration_requests_asset ON calibration_requests(asset_id);
CREATE TRIGGER trg_calibration_requests_updated_at BEFORE UPDATE ON calibration_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- CALIBRATION RECORDS
-- =============================================================================
CREATE TABLE calibration_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES equipment_assets(id),
    calibration_type_id UUID REFERENCES calibration_types(id),
    calibrated_by TEXT,
    calibration_date DATE NOT NULL,
    next_due_date DATE,
    result TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'adjusted')),
    certificate_path TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calibration_records_asset ON calibration_records(asset_id);
CREATE INDEX idx_calibration_records_next_due ON calibration_records(next_due_date);
CREATE TRIGGER trg_calibration_records_updated_at BEFORE UPDATE ON calibration_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- CALIBRATION CERTIFICATES
-- =============================================================================
CREATE TABLE calibration_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES calibration_records(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    issued_by TEXT,
    issue_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
