-- Phase 2 evaluator handoff fix:
-- Give procurement delivered -> receipt links a structured spare-part context
-- instead of relying on title/justification string matching.

ALTER TABLE procurement_requests
  ADD COLUMN IF NOT EXISTS spare_part_id UUID
    REFERENCES spare_parts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requested_quantity INTEGER;

ALTER TABLE procurement_requests
  DROP CONSTRAINT IF EXISTS chk_procurement_requests_requested_quantity,
  ADD CONSTRAINT chk_procurement_requests_requested_quantity
    CHECK (requested_quantity IS NULL OR requested_quantity > 0);

CREATE INDEX IF NOT EXISTS idx_procurement_requests_spare_part
  ON procurement_requests(spare_part_id)
  WHERE spare_part_id IS NOT NULL;

