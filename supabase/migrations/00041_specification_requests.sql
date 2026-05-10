-- Migration 00041: specification_requests table
-- Separates specification requests (workflow/intake) from equipment_documents (output/evidence).
-- Workflow: submitted → in_review → in_progress → completed | rejected | cancelled
-- equipment_documents remain as the output/evidence linked to a completed specification request.

CREATE TABLE IF NOT EXISTS specification_requests (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number                  TEXT UNIQUE NOT NULL,
  requested_by                    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  department_id                   UUID REFERENCES departments(id) ON DELETE SET NULL,
  -- Optional links to related records
  asset_id                        UUID REFERENCES equipment_assets(id) ON DELETE SET NULL,
  procurement_request_id          UUID REFERENCES procurement_requests(id) ON DELETE SET NULL,
  replacement_candidate_asset_id  UUID REFERENCES equipment_assets(id) ON DELETE SET NULL,
  -- Request details
  title                           TEXT NOT NULL,
  purpose                         TEXT,
  equipment_category              TEXT,
  requested_equipment_name        TEXT,
  required_by                     DATE,
  priority                        TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status                          TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'in_review', 'in_progress', 'completed', 'rejected', 'cancelled')),
  source                          TEXT,
  notes                           TEXT,
  -- Assignment / completion
  assigned_to                     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Link to the document that satisfies this request (optional, set on completion)
  linked_document_id              UUID,
  completed_at                    TIMESTAMPTZ,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_specification_requests_status       ON specification_requests(status);
CREATE INDEX IF NOT EXISTS idx_specification_requests_department   ON specification_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_specification_requests_requested_by ON specification_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_specification_requests_asset_id     ON specification_requests(asset_id);
CREATE INDEX IF NOT EXISTS idx_specification_requests_procurement  ON specification_requests(procurement_request_id);
CREATE INDEX IF NOT EXISTS idx_specification_requests_replacement  ON specification_requests(replacement_candidate_asset_id);
CREATE INDEX IF NOT EXISTS idx_specification_requests_document     ON specification_requests(linked_document_id);

DROP TRIGGER IF EXISTS trg_specification_requests_updated_at ON specification_requests;
CREATE TRIGGER trg_specification_requests_updated_at
  BEFORE UPDATE ON specification_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE specification_requests ENABLE ROW LEVEL SECURITY;

-- admin / developer / bme_head: full access
CREATE POLICY "specification_requests_admin_all" ON specification_requests
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

-- technician: read access
CREATE POLICY "specification_requests_technician_read" ON specification_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      JOIN profiles p ON p.id = ur.user_id
      WHERE p.user_id = auth.uid()
        AND r.name = 'technician'
    )
  );

CREATE POLICY "specification_requests_technician_update" ON specification_requests
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

-- department_head / department_user / store_user: see their own + their department's
CREATE POLICY "specification_requests_dept_read" ON specification_requests
  FOR SELECT TO authenticated
  USING (
    requested_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR department_id IN (SELECT department_id FROM profiles WHERE user_id = auth.uid())
  );

-- department_head / department_user / store_user: can create
CREATE POLICY "specification_requests_dept_insert" ON specification_requests
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

-- viewer: read-only
CREATE POLICY "specification_requests_viewer_read" ON specification_requests
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
