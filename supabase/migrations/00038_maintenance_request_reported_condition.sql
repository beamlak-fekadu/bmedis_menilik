-- Migration 00038: Store reported equipment condition on maintenance requests
-- This enables auditability of what condition was observed at request creation time.

ALTER TABLE maintenance_requests
  ADD COLUMN IF NOT EXISTS reported_condition text
    CHECK (reported_condition IN ('functional_issue', 'needs_repair', 'non_functional') OR reported_condition IS NULL),
  ADD COLUMN IF NOT EXISTS reported_condition_source text DEFAULT NULL;

COMMENT ON COLUMN maintenance_requests.reported_condition IS
  'Condition reported by the requester at time of request creation. '
  'functional_issue = equipment operates but issue observed (no condition change). '
  'needs_repair = equipment needs repair (syncs to equipment_assets.condition). '
  'non_functional = equipment is non-functional (syncs to equipment_assets.condition).';

COMMENT ON COLUMN maintenance_requests.reported_condition_source IS
  'Origin of the reported condition: equipment, command-center, maintenance, manual.';
