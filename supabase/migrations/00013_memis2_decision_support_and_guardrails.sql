-- Migration 00013: MEMIS 2.0 operational alignment + decision support extensions
-- Adds additive tables/views for procurement, escalation, readiness, workload, repeat repairs, and offline sync support.

-- =============================================================================
-- Data quality guardrails
-- =============================================================================

-- Enforce unique asset codes among active assets.
CREATE UNIQUE INDEX IF NOT EXISTS ux_equipment_assets_asset_code_active
ON equipment_assets (LOWER(asset_code))
WHERE deleted_at IS NULL;

-- Normalize critical maintenance/work-order text fields from being empty strings.
ALTER TABLE maintenance_requests
  ADD CONSTRAINT chk_maintenance_requests_fault_description_nonempty
  CHECK (length(trim(fault_description)) > 0);

ALTER TABLE work_orders
  ADD CONSTRAINT chk_work_orders_priority_standardized
  CHECK (priority IN ('low', 'medium', 'high', 'critical'));

-- Generic MEMIS lookup dictionary for settings expansion.
CREATE TABLE IF NOT EXISTS memis_lookup_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lookup_group TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lookup_group, code)
);

INSERT INTO memis_lookup_values (lookup_group, code, label, description)
VALUES
  ('organization_unit_category', 'hospital', 'Hospital', 'Hospital organization unit category'),
  ('organization_unit_type', 'tertiary', 'Tertiary Facility', 'Tertiary-level facility'),
  ('administration_type', 'public', 'Public', 'Public administration type'),
  ('facility_type', 'specialized', 'Specialized Hospital', 'Specialized hospital'),
  ('rejection_reason', 'insufficient_budget', 'Insufficient Budget', 'Request rejected due to budget constraints'),
  ('escalation_reason', 'critical_overdue', 'Critical Asset Overdue', 'Critical overdue issue requires escalation'),
  ('procurement_status', 'requested', 'Requested', 'Procurement request submitted'),
  ('procurement_status', 'approved', 'Approved', 'Procurement request approved'),
  ('procurement_status', 'ordered', 'Ordered', 'Purchase order created'),
  ('procurement_status', 'in_transit', 'In Transit', 'Shipment in transit'),
  ('procurement_status', 'delivered', 'Delivered', 'Item delivered')
ON CONFLICT (lookup_group, code) DO NOTHING;

-- =============================================================================
-- Procurement tracking
-- =============================================================================
CREATE TABLE IF NOT EXISTS procurement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  justification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  priority TEXT NOT NULL DEFAULT 'medium',
  requested_by UUID REFERENCES profiles(id),
  department_id UUID REFERENCES departments(id),
  expected_delivery_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_procurement_requests_status
    CHECK (status IN ('requested', 'approved', 'ordered', 'in_transit', 'delivered', 'canceled')),
  CONSTRAINT chk_procurement_requests_priority
    CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

-- =============================================================================
-- Decision-support materializations
-- =============================================================================
CREATE TABLE IF NOT EXISTS equipment_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
  health_score NUMERIC(5,2) NOT NULL,
  reliability_component NUMERIC(5,2),
  pm_component NUMERIC(5,2),
  risk_component NUMERIC(5,2),
  status_component NUMERIC(5,2),
  explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS clinical_readiness_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  readiness_score NUMERIC(5,2) NOT NULL,
  essential_total INT NOT NULL DEFAULT 0,
  essential_functional INT NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS triage_action_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
  priority_score NUMERIC(7,2) NOT NULL,
  recommendation TEXT NOT NULL,
  rationale JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_by TIMESTAMPTZ,
  assigned_to UUID REFERENCES profiles(id),
  CONSTRAINT chk_triage_action_queue_status
    CHECK (status IN ('open', 'scheduled', 'in_progress', 'completed', 'dismissed'))
);

CREATE TABLE IF NOT EXISTS repeat_repair_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
  failure_count_window INT NOT NULL,
  window_days INT NOT NULL DEFAULT 180,
  recommendation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_resolved BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  escalate_to_role TEXT,
  severity TEXT NOT NULL DEFAULT 'high',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_escalation_rules_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

CREATE TABLE IF NOT EXISTS escalation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES escalation_rules(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES equipment_assets(id) ON DELETE SET NULL,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  severity TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  forwarded_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT chk_escalation_events_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT chk_escalation_events_status CHECK (status IN ('open', 'forwarded', 'acknowledged', 'resolved', 'closed'))
);

CREATE TABLE IF NOT EXISTS workload_capacity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  open_assignments INT NOT NULL DEFAULT 0,
  overdue_assignments INT NOT NULL DEFAULT 0,
  estimated_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  capacity_hours NUMERIC(8,2) NOT NULL DEFAULT 8,
  backlog_delta NUMERIC(8,2) NOT NULL DEFAULT 0,
  UNIQUE (assignee_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS inspection_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  grading_scale JSONB NOT NULL DEFAULT '["A","B","C","D"]'::jsonb,
  checklist_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_inspection_templates_type
    CHECK (template_type IN ('inspection', 'calibration', 'maintenance'))
);

CREATE TABLE IF NOT EXISTS offline_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_action_id TEXT NOT NULL,
  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ,
  CONSTRAINT chk_offline_sync_events_status CHECK (sync_status IN ('pending', 'synced', 'failed'))
);

-- =============================================================================
-- Seed baseline escalation rules
-- =============================================================================
INSERT INTO escalation_rules (rule_name, trigger_type, trigger_config, escalate_to_role, severity)
VALUES
  ('Critical ICU overdue work order', 'overdue_work_order', '{"department":"ICU","min_days_overdue":1,"priority":["critical"]}'::jsonb, 'admin', 'critical'),
  ('Repeated unresolved work order', 'repeated_unresolved', '{"repeat_threshold":3,"window_days":60}'::jsonb, 'technician', 'high'),
  ('Calibration overdue on essential equipment', 'calibration_overdue', '{"criticality":["high","critical"],"min_days_overdue":7}'::jsonb, 'admin', 'high')
ON CONFLICT (rule_name) DO NOTHING;
