-- Migration 00009: Disposal Tables
-- Disposal requests and disposed assets tracking.

-- =============================================================================
-- DISPOSAL REQUESTS
-- =============================================================================
CREATE TABLE disposal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT NOT NULL UNIQUE,
    asset_id UUID NOT NULL REFERENCES equipment_assets(id),
    requested_by UUID REFERENCES profiles(id),
    reason TEXT NOT NULL,
    disposal_method_proposed TEXT CHECK (disposal_method_proposed IN ('auction', 'donation', 'recycling', 'destruction', 'return_to_vendor', 'other')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'canceled')),
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_disposal_requests_asset ON disposal_requests(asset_id);
CREATE INDEX idx_disposal_requests_status ON disposal_requests(status);
CREATE TRIGGER trg_disposal_requests_updated_at BEFORE UPDATE ON disposal_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- DISPOSED ASSETS
-- =============================================================================
CREATE TABLE disposed_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES equipment_assets(id),
    disposal_request_id UUID REFERENCES disposal_requests(id),
    disposal_date DATE NOT NULL,
    disposal_method TEXT NOT NULL,
    disposal_value DECIMAL(15,2),
    disposed_by UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_disposed_assets_asset ON disposed_assets(asset_id);
