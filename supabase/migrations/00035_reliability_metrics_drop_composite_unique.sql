-- Migration 00035: Drop legacy composite UNIQUE on equipment_reliability_metrics
-- (00034 targeted a name that PG truncated; composite remained until this migration.)

ALTER TABLE equipment_reliability_metrics
  DROP CONSTRAINT IF EXISTS equipment_reliability_metrics_asset_id_period_start_period__key;
