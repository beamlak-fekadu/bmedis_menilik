-- Migration 00003: Asset / Inventory Tables
-- Equipment assets, locations, status history, documents, and installation records.

-- =============================================================================
-- EQUIPMENT ASSETS
-- =============================================================================
CREATE TABLE equipment_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code TEXT NOT NULL UNIQUE,
    serial_number TEXT,
    name TEXT NOT NULL,
    model_id UUID REFERENCES equipment_models(id),
    category_id UUID NOT NULL REFERENCES equipment_categories(id),
    department_id UUID NOT NULL REFERENCES departments(id),
    manufacturer_id UUID REFERENCES manufacturers(id),
    vendor_id UUID REFERENCES vendors(id),
    supplier_id UUID REFERENCES suppliers(id),
    installation_date DATE,
    warranty_expiry DATE,
    service_contract_expiry DATE,
    condition TEXT NOT NULL DEFAULT 'functional' CHECK (condition IN ('functional', 'needs_repair', 'non_functional', 'under_maintenance', 'decommissioned')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'disposed', 'in_storage')),
    purchase_date DATE,
    purchase_cost DECIMAL(15,2),
    source TEXT,
    notes TEXT,
    photo_url TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_equipment_assets_department ON equipment_assets(department_id);
CREATE INDEX idx_equipment_assets_category ON equipment_assets(category_id);
CREATE INDEX idx_equipment_assets_status ON equipment_assets(status);
CREATE INDEX idx_equipment_assets_condition ON equipment_assets(condition);
CREATE TRIGGER trg_equipment_assets_updated_at BEFORE UPDATE ON equipment_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- EQUIPMENT LOCATIONS (movement tracking)
-- =============================================================================
CREATE TABLE equipment_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id),
    building TEXT,
    floor TEXT,
    room TEXT,
    moved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    moved_by UUID REFERENCES profiles(id),
    notes TEXT
);

CREATE INDEX idx_equipment_locations_asset ON equipment_locations(asset_id);

-- =============================================================================
-- ASSET STATUS HISTORY
-- =============================================================================
CREATE TABLE asset_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    old_condition TEXT,
    new_condition TEXT,
    changed_by UUID REFERENCES profiles(id),
    reason TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_asset_status_history_asset ON asset_status_history(asset_id);

-- =============================================================================
-- EQUIPMENT DOCUMENTS
-- =============================================================================
CREATE TABLE equipment_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES equipment_assets(id) ON DELETE SET NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('manual', 'specification', 'sop', 'certificate', 'warranty', 'service_contract', 'photo', 'other')),
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    uploaded_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_equipment_documents_asset ON equipment_documents(asset_id);

-- =============================================================================
-- INSTALLATION RECORDS
-- =============================================================================
CREATE TABLE installation_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
    installed_by TEXT,
    installation_date DATE NOT NULL,
    commissioning_date DATE,
    acceptance_checklist JSONB DEFAULT '[]',
    go_live_date DATE,
    initial_training_done BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_installation_records_updated_at BEFORE UPDATE ON installation_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
