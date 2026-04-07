-- Migration 00007: Logistics / Spare Parts Tables
-- Spare parts catalog, stock receipts, stock issues.

-- =============================================================================
-- SPARE PARTS
-- =============================================================================
CREATE TABLE spare_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    unit TEXT NOT NULL DEFAULT 'piece',
    reorder_level INTEGER NOT NULL DEFAULT 5,
    current_stock INTEGER NOT NULL DEFAULT 0,
    unit_cost DECIMAL(12,2),
    compatible_categories JSONB DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_spare_parts_updated_at BEFORE UPDATE ON spare_parts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add FK to maintenance_parts_used now that spare_parts exists
ALTER TABLE maintenance_parts_used
    ADD CONSTRAINT fk_maintenance_parts_spare_part
    FOREIGN KEY (spare_part_id) REFERENCES spare_parts(id);

-- =============================================================================
-- STOCK RECEIPTS
-- =============================================================================
CREATE TABLE stock_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id UUID NOT NULL REFERENCES spare_parts(id),
    quantity INTEGER NOT NULL,
    received_by UUID REFERENCES profiles(id),
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_id UUID REFERENCES suppliers(id),
    invoice_ref TEXT,
    unit_cost DECIMAL(12,2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_receipts_part ON stock_receipts(part_id);

-- =============================================================================
-- STOCK ISSUES
-- =============================================================================
CREATE TABLE stock_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id UUID NOT NULL REFERENCES spare_parts(id),
    quantity INTEGER NOT NULL,
    issued_to_event_id UUID REFERENCES maintenance_events(id),
    issued_by UUID REFERENCES profiles(id),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    department_id UUID REFERENCES departments(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_issues_part ON stock_issues(part_id);
CREATE INDEX idx_stock_issues_event ON stock_issues(issued_to_event_id);
