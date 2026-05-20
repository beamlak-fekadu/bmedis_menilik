-- Migration 00061: Reliability evidence pipeline (R2 / Phase 2)
--
-- Goal: every completed work order must produce the evidence that the
-- reliability functions (fn_compute_mttr / fn_compute_mtbf /
-- fn_compute_availability) read from. Before this migration, completing a
-- work order only flipped status to 'completed' — it did not write a
-- maintenance_events row, did not write a downtime_logs row, and the
-- analytics functions had nothing new to read. MTTR/MTBF/availability
-- stayed stale.
--
-- Two changes here:
--
--   1) Trigger sync_downtime_logs_from_event(): every INSERT or UPDATE of
--      maintenance_events that has both downtime_start and downtime_end
--      auto-generates / refreshes the matching downtime_logs row. This is
--      the canonical answer to the R2 question "downtime_logs writer path
--      is unclear" — events are the single source of truth, downtime_logs
--      is a derived materialization (fn_compute_mtbf reads from
--      downtime_logs, so the data has to land there one way or another).
--
--   2) v_work_orders_missing_reliability_evidence: view that surfaces
--      completed work orders without a linked maintenance_events row
--      carrying repair_duration_hours. Used by the equipment detail card
--      and Developer Lab to be honest about gaps rather than silently
--      showing stale metrics.

-- ============================================================================
-- 1) Downtime sync trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_downtime_logs_from_event()
RETURNS TRIGGER AS $$
DECLARE
  v_duration_hours DECIMAL(8,2);
BEGIN
  -- Only act when the event carries both a start and an end timestamp.
  IF NEW.downtime_start IS NULL OR NEW.downtime_end IS NULL THEN
    RETURN NEW;
  END IF;

  -- Reject inverted ranges defensively — these would corrupt MTBF.
  IF NEW.downtime_end < NEW.downtime_start THEN
    RAISE EXCEPTION 'maintenance_events downtime_end (%) is before downtime_start (%)',
      NEW.downtime_end, NEW.downtime_start;
  END IF;

  v_duration_hours := EXTRACT(EPOCH FROM (NEW.downtime_end - NEW.downtime_start)) / 3600.0;

  -- Upsert one downtime_logs row per event_id. If the event is later updated
  -- (corrected timestamps), the derived row is refreshed in place. No drift.
  INSERT INTO downtime_logs (asset_id, event_id, start_time, end_time, duration_hours, reason)
  VALUES (
    NEW.asset_id,
    NEW.id,
    NEW.downtime_start,
    NEW.downtime_end,
    v_duration_hours,
    COALESCE(NEW.notes, 'Derived from maintenance_event.downtime_start/end')
  )
  ON CONFLICT (event_id) DO UPDATE
    SET asset_id = EXCLUDED.asset_id,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        duration_hours = EXCLUDED.duration_hours,
        reason = EXCLUDED.reason;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ON CONFLICT (event_id) requires a unique constraint on event_id. The original
-- downtime_logs table doesn't have one, so add a partial unique index that
-- treats NULL event_id (manual rows) separately.
DROP INDEX IF EXISTS idx_downtime_logs_event_id_unique;
CREATE UNIQUE INDEX idx_downtime_logs_event_id_unique
  ON downtime_logs(event_id)
  WHERE event_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_sync_downtime_logs ON maintenance_events;
CREATE TRIGGER trg_sync_downtime_logs
  AFTER INSERT OR UPDATE OF downtime_start, downtime_end, asset_id ON maintenance_events
  FOR EACH ROW EXECUTE FUNCTION sync_downtime_logs_from_event();

-- ============================================================================
-- 2) Missing-evidence view (governance, not enforcement)
-- ============================================================================
--
-- The application warns when this view shows rows for the asset the user is
-- looking at. We don't *block* completion at the DB layer — Phase 2 already
-- enforces completion_outcome + final_equipment_condition at the action layer
-- (see updateWorkOrderAction R2 guard). This view is for observability.

CREATE OR REPLACE VIEW v_work_orders_missing_reliability_evidence AS
SELECT
  wo.id                 AS work_order_id,
  wo.work_order_number,
  wo.asset_id,
  wo.completed_at,
  wo.work_type,
  wo.completion_outcome,
  wo.final_equipment_condition,
  ea.name               AS asset_name,
  ea.asset_code,
  ea.department_id
FROM work_orders wo
JOIN equipment_assets ea ON ea.id = wo.asset_id
LEFT JOIN LATERAL (
  SELECT 1
  FROM maintenance_events me
  WHERE me.work_order_id = wo.id
    AND me.repair_duration_hours IS NOT NULL
  LIMIT 1
) evidence ON TRUE
WHERE wo.status = 'completed'
  AND wo.work_type = 'corrective'
  AND evidence IS NULL;

GRANT SELECT ON v_work_orders_missing_reliability_evidence TO authenticated;
