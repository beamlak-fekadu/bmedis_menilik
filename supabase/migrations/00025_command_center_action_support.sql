-- Migration 00025: Command Center action + audit support
-- Adds explicit command-center fields needed by inline triage workflows.

-- 1) maintenance_requests: explicit request type support (includes diagnostic)
ALTER TABLE maintenance_requests
  ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'corrective';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_maintenance_requests_request_type'
  ) THEN
    ALTER TABLE maintenance_requests
      ADD CONSTRAINT chk_maintenance_requests_request_type
      CHECK (request_type IN ('corrective', 'preventive', 'diagnostic', 'inspection', 'calibration', 'replacement'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_maintenance_requests_request_type
  ON maintenance_requests(request_type);

-- 2) pm_schedules: store command-center prefill context metadata
ALTER TABLE pm_schedules
  ADD COLUMN IF NOT EXISTS source_context JSONB;

-- 3) audit_logs: explicit actor + structured details payload
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS performed_by UUID REFERENCES profiles(id);

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS details JSONB;

UPDATE audit_logs
SET performed_by = user_id
WHERE performed_by IS NULL
  AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by
  ON audit_logs(performed_by);
