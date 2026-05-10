-- Migration 00040: installation_requests table
-- Separates the request/intake workflow from installation_records (completion evidence).
-- Workflow: submitted → approved → scheduled/assigned → in_progress → completed | rejected | cancelled
-- installation_records remain as the completion evidence attached after installation is done.

CREATE TABLE IF NOT EXISTS installation_requests (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number              TEXT UNIQUE NOT NULL,
  asset_id                    UUID REFERENCES equipment_assets(id) ON DELETE SET NULL,
  procurement_request_id      UUID REFERENCES procurement_requests(id) ON DELETE SET NULL,
  department_id               UUID REFERENCES departments(id) ON DELETE SET NULL,
  requested_by                UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Equipment info for items not yet in asset register
  equipment_name              TEXT,
  asset_code_hint             TEXT,
  vendor                      TEXT,
  -- Dates
  received_date               DATE,
  requested_installation_date DATE,
  target_go_live_date         DATE,
  -- Request details
  installation_reason         TEXT,
  commissioning_required      BOOLEAN NOT NULL DEFAULT TRUE,
  user_training_required      BOOLEAN NOT NULL DEFAULT FALSE,
  priority                    TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status                      TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'scheduled', 'assigned', 'in_progress', 'completed', 'rejected', 'cancelled')),
  source                      TEXT,
  notes                       TEXT,
  -- Assignment / completion
  assigned_to                 UUID REFERENCES profiles(id) ON DELETE SET NULL,
  scheduled_date              DATE,
  completed_at                TIMESTAMPTZ,
  -- Link to installation record created on completion
  installation_record_id      UUID REFERENCES installation_records(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installation_requests_status      ON installation_requests(status);
CREATE INDEX IF NOT EXISTS idx_installation_requests_asset_id    ON installation_requests(asset_id);
CREATE INDEX IF NOT EXISTS idx_installation_requests_department  ON installation_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_installation_requests_requested_by ON installation_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_installation_requests_procurement ON installation_requests(procurement_request_id);
CREATE INDEX IF NOT EXISTS idx_installation_requests_assigned_to ON installation_requests(assigned_to);

DROP TRIGGER IF EXISTS trg_installation_requests_updated_at ON installation_requests;
CREATE TRIGGER trg_installation_requests_updated_at
  BEFORE UPDATE ON installation_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE installation_requests ENABLE ROW LEVEL SECURITY;

-- admin / developer / bme_head: full access
CREATE POLICY "installation_requests_admin_all" ON installation_requests
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      JOIN profiles p ON p.id = ur.user_id
      WHERE p.user_id = auth.uid()
        AND r.name IN ('admin', 'developer', 'bme_head')
    )
  );

-- technician: read + status/workflow updates (not delete)
CREATE POLICY "installation_requests_technician_rw" ON installation_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      JOIN profiles p ON p.id = ur.user_id
      WHERE p.user_id = auth.uid()
        AND r.name IN ('technician')
    )
  );

CREATE POLICY "installation_requests_technician_update" ON installation_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      JOIN profiles p ON p.id = ur.user_id
      WHERE p.user_id = auth.uid()
        AND r.name = 'technician'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      JOIN profiles p ON p.id = ur.user_id
      WHERE p.user_id = auth.uid()
        AND r.name = 'technician'
    )
  );

-- department_head / department_user / store_user: see their own requests
CREATE POLICY "installation_requests_dept_own" ON installation_requests
  FOR SELECT TO authenticated
  USING (
    requested_by IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    OR department_id IN (
      SELECT department_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- department_head / department_user / store_user: can insert
CREATE POLICY "installation_requests_dept_insert" ON installation_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      JOIN profiles p ON p.id = ur.user_id
      WHERE p.user_id = auth.uid()
        AND r.name IN ('technician', 'department_head', 'department_user', 'store_user')
    )
  );

-- viewer: read-only all
CREATE POLICY "installation_requests_viewer_read" ON installation_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      JOIN profiles p ON p.id = ur.user_id
      WHERE p.user_id = auth.uid()
        AND r.name = 'viewer'
    )
  );
