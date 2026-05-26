-- Migration 00042: PM schedule evidence and defer support
-- PM Schedule = one planned task instance.
-- PM Completion = evidence that the task was performed.

ALTER TABLE pm_schedules
  DROP CONSTRAINT IF EXISTS pm_schedules_status_check;

ALTER TABLE pm_schedules
  ADD CONSTRAINT pm_schedules_status_check
  CHECK (status IN ('scheduled', 'completed', 'overdue', 'skipped', 'deferred', 'in_progress', 'canceled'));

ALTER TABLE pm_schedules
  ADD COLUMN IF NOT EXISTS result TEXT
    CHECK (result IS NULL OR result IN ('pass', 'issue_found', 'failed')),
  ADD COLUMN IF NOT EXISTS completion_checklist JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS completion_notes TEXT,
  ADD COLUMN IF NOT EXISTS final_equipment_condition TEXT
    CHECK (
      final_equipment_condition IS NULL
      OR final_equipment_condition IN ('functional', 'needs_repair', 'non_functional', 'under_maintenance')
    ),
  ADD COLUMN IF NOT EXISTS corrective_action_needed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS skipped_reason TEXT,
  ADD COLUMN IF NOT EXISTS deferred_until DATE,
  ADD COLUMN IF NOT EXISTS deferred_reason TEXT,
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pm_schedules_assigned_to ON pm_schedules(assigned_to);
CREATE INDEX IF NOT EXISTS idx_pm_schedules_completed_at ON pm_schedules(completed_at);

-- PostgreSQL cannot change existing view column names/order with CREATE OR REPLACE VIEW.
-- Drop and recreate the view so the updated column structure is applied cleanly.
DROP VIEW IF EXISTS v_overdue_pm;

CREATE VIEW v_overdue_pm AS
SELECT
    ps.id,
    ps.asset_id,
    ps.scheduled_date,
    ps.status,
    pp.name AS plan_name,
    ea.asset_code,
    ea.name AS asset_name,
    d.name AS department_name,
    ec.name AS category_name,
    ec.criticality_level,
    p.full_name AS assigned_to_name,
    CURRENT_DATE - ps.scheduled_date AS days_overdue
FROM pm_schedules ps
JOIN pm_plans pp ON ps.plan_id = pp.id
JOIN equipment_assets ea ON ps.asset_id = ea.id
LEFT JOIN departments d ON ea.department_id = d.id
LEFT JOIN equipment_categories ec ON ea.category_id = ec.id
LEFT JOIN profiles p ON ps.assigned_to = p.id
WHERE ps.status IN ('overdue', 'in_progress')
   OR (ps.status = 'scheduled' AND ps.scheduled_date < CURRENT_DATE)
ORDER BY ps.scheduled_date ASC;