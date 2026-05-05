-- Migration 00030: Hot-path indexes (audit remediation I-7, I-8, I-10, I-16, I-17)
-- Plain CREATE INDEX; use CONCURRENTLY manually in large production cutovers if needed.

CREATE INDEX IF NOT EXISTS idx_recommendation_flags_asset_unacked
  ON recommendation_flags (asset_id, generated_at DESC)
  WHERE is_acknowledged = false;

CREATE INDEX IF NOT EXISTS idx_triage_action_queue_open_asset
  ON triage_action_queue (status, asset_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_maintenance_requests_asset_status
  ON maintenance_requests (asset_id, status);

CREATE INDEX IF NOT EXISTS idx_work_orders_assignee_status
  ON work_orders (assigned_to, status)
  WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pm_schedules_asset_status_date
  ON pm_schedules (asset_id, status, scheduled_date);
