-- Migration 00062: work_order_parts_needed (R19 / Phase 2)
--
-- Background: maintenance_parts_used links to maintenance_events (an EVENT
-- that has already happened — i.e. parts that were consumed). Phase 2 R19
-- requires the inverse: parts a technician declares NEEDED for an open work
-- order, BEFORE any maintenance event is logged. The Command Center stock
-- blocker query uses this to surface "WO X is blocked on Part Y (currently
-- 0 in stock)" — the most important operational signal between maintenance
-- and store.
--
-- A separate table (not a status column on maintenance_parts_used) because:
--   - parts_used requires a NOT NULL event_id, but needed-parts must exist
--     before the event;
--   - we want to keep "this part was actually consumed" and "this part is
--     declared as needed" as cleanly separated concepts. They can both
--     coexist (technician declares need → installs part → logs event with
--     parts_used).

CREATE TABLE work_order_parts_needed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  spare_part_id UUID NOT NULL REFERENCES spare_parts(id),
  quantity_needed INTEGER NOT NULL DEFAULT 1 CHECK (quantity_needed > 0),
  notes TEXT,
  declared_by UUID REFERENCES profiles(id),
  -- Lifecycle: open (declared, not yet fulfilled), fulfilled (parts issued
  -- via stock_issues), canceled (technician determined the part is no longer
  -- needed). The Command Center blocker query only considers 'open' rows.
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'fulfilled', 'canceled')),
  fulfilled_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hot-path indexes for blocker query (by part, by work order).
CREATE INDEX idx_wo_parts_needed_wo ON work_order_parts_needed(work_order_id);
CREATE INDEX idx_wo_parts_needed_part_open
  ON work_order_parts_needed(spare_part_id)
  WHERE status = 'open';

-- A single open need per (work_order, part) prevents duplicate-row noise.
CREATE UNIQUE INDEX idx_wo_parts_needed_unique_open
  ON work_order_parts_needed(work_order_id, spare_part_id)
  WHERE status = 'open';

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE work_order_parts_needed ENABLE ROW LEVEL SECURITY;

-- Read: same broad pattern as the other operational tables (developer/admin/
-- bme_head/technician/store_user/viewer see everything; department roles see
-- only their department's WO needs via the linked work-order asset).
CREATE POLICY select_wo_parts_needed ON work_order_parts_needed
  FOR SELECT TO authenticated
  USING (NOT is_dept_scoped_role());

CREATE POLICY select_wo_parts_needed_dept_scope ON work_order_parts_needed
  FOR SELECT TO authenticated
  USING (
    is_dept_scoped_role()
    AND EXISTS (
      SELECT 1 FROM work_orders wo
      JOIN equipment_assets ea ON ea.id = wo.asset_id
      WHERE wo.id = work_order_parts_needed.work_order_id
        AND ea.department_id = auth_profile_department_id()
    )
  );

-- Write: technicians who have work_order.add_event (i.e. can act on a work
-- order) can declare needs; BME Head / admin can manage all states.
CREATE POLICY insert_wo_parts_needed ON work_order_parts_needed
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
    OR auth_user_has_role('technician')
  );

CREATE POLICY update_wo_parts_needed ON work_order_parts_needed
  FOR UPDATE TO authenticated
  USING (
    auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
    OR auth_user_has_role('technician')
    OR auth_user_has_role('store_user') -- store fulfills needs when issuing stock
  );

CREATE POLICY delete_wo_parts_needed ON work_order_parts_needed
  FOR DELETE TO authenticated
  USING (auth_user_has_role('developer') OR auth_user_has_role('admin'));

-- ============================================================================
-- updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION touch_wo_parts_needed_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_touch_wo_parts_needed
  BEFORE UPDATE ON work_order_parts_needed
  FOR EACH ROW EXECUTE FUNCTION touch_wo_parts_needed_updated_at();
