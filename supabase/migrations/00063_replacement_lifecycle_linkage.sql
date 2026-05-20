-- Migration 00063: Replacement → lifecycle action linkage (R32 / Phase 3)
--
-- Background: replacement_priority_scores ranks assets but, before this
-- migration, a high-RPI asset had no governed onward action. BME Head saw
-- the evidence and then had to start a disposal request or procurement spec
-- from scratch in a different module — losing the link between the RPI
-- score and the resulting lifecycle action.
--
-- Phase 3 R32: add `source_replacement_score_id` to disposal_requests,
-- procurement_requests, and specification_requests. When BME Head launches
-- a lifecycle action from /replacement/[assetId], the action prefills the
-- form and the resulting record carries a hard link back to the score it
-- came from. Reports and Copilot can answer "what came of this replacement
-- recommendation?" deterministically.
--
-- No data backfill — historical rows leave the column NULL. Future rows
-- created from the replacement evidence page get the linkage automatically.

-- disposal_requests
ALTER TABLE disposal_requests
  ADD COLUMN IF NOT EXISTS source_replacement_score_id UUID
    REFERENCES replacement_priority_scores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_disposal_requests_replacement_score
  ON disposal_requests(source_replacement_score_id)
  WHERE source_replacement_score_id IS NOT NULL;

-- procurement_requests
ALTER TABLE procurement_requests
  ADD COLUMN IF NOT EXISTS source_replacement_score_id UUID
    REFERENCES replacement_priority_scores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_procurement_requests_replacement_score
  ON procurement_requests(source_replacement_score_id)
  WHERE source_replacement_score_id IS NOT NULL;

-- specification_requests (procurement spec drafts)
ALTER TABLE specification_requests
  ADD COLUMN IF NOT EXISTS source_replacement_score_id UUID
    REFERENCES replacement_priority_scores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_specification_requests_replacement_score
  ON specification_requests(source_replacement_score_id)
  WHERE source_replacement_score_id IS NOT NULL;
