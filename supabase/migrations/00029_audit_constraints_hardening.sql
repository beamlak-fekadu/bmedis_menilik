-- Migration 00029: Constraint hardening (audit remediation I-1, I-4, I-5, I-19)
-- I-19: recommendation_flags.flag_type must allow low_stock (used by v_maintenance_risk_context).

ALTER TABLE recommendation_flags
  DROP CONSTRAINT IF EXISTS recommendation_flags_flag_type_check;

ALTER TABLE recommendation_flags
  ADD CONSTRAINT recommendation_flags_flag_type_check CHECK (flag_type IN (
    'urgent_maintenance', 'monitor_closely', 'prioritize_pm', 'calibrate_soon',
    'replacement_candidate', 'recurring_failure', 'part_shortage', 'high_risk',
    'low_availability', 'overdue_pm', 'warranty_expiring', 'contract_expiring',
    'low_stock'
  ));

-- I-5: non-negative repair duration when present
ALTER TABLE maintenance_events
  DROP CONSTRAINT IF EXISTS chk_maintenance_events_repair_duration_nonneg;

ALTER TABLE maintenance_events
  ADD CONSTRAINT chk_maintenance_events_repair_duration_nonneg
  CHECK (repair_duration_hours IS NULL OR repair_duration_hours >= 0);

-- I-2 / downtime: non-negative duration when present
ALTER TABLE downtime_logs
  DROP CONSTRAINT IF EXISTS chk_downtime_logs_duration_nonneg;

ALTER TABLE downtime_logs
  ADD CONSTRAINT chk_downtime_logs_duration_nonneg
  CHECK (duration_hours IS NULL OR duration_hours >= 0);

-- I-4: unique asset_code among non-deleted assets only (allows reuse after soft-delete)
ALTER TABLE equipment_assets DROP CONSTRAINT IF EXISTS equipment_assets_asset_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_assets_asset_code_active
  ON equipment_assets (asset_code)
  WHERE deleted_at IS NULL;

-- I-1: one PMC row per (department, category, asset, period) grain; dedupe then enforce
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY department_id, category_id, asset_id, period_start, period_end
      ORDER BY computed_at DESC NULLS LAST, id
    ) AS rn
  FROM pm_compliance_metrics
)
DELETE FROM pm_compliance_metrics p
USING ranked r
WHERE p.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pm_compliance_metrics_grain
  ON pm_compliance_metrics (department_id, category_id, asset_id, period_start, period_end)
  NULLS NOT DISTINCT;
