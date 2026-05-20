-- Migration 00064: Transactional stock receipt/issue RPCs (R8 / Phase 4)
--
-- Background: createStockReceiptAction and createStockIssueAction did a
-- non-atomic two-step pattern:
--   1) INSERT into stock_receipts (or stock_issues)
--   2) UPDATE spare_parts SET current_stock = (previously-read) +/- quantity
--
-- Two concurrent issues for the same part could both read the same
-- current_stock, both subtract, and corrupt the count. R8 fixes this by
-- doing the movement row insert AND the spare_parts update inside a single
-- SQL function with a SELECT ... FOR UPDATE row lock on the spare_parts
-- row. Sufficient-stock validation happens inside the same lock.
--
-- The RPCs return the inserted row's id plus the updated current_stock so
-- the calling action can emit notifications (stockout/low-stock) based on
-- the authoritative post-update value — no second read needed.
--
-- The RPCs use SECURITY INVOKER so RLS still applies — they don't grant
-- store_user any authority they don't already have.

-- ============================================================================
-- record_stock_receipt
-- ============================================================================

CREATE OR REPLACE FUNCTION record_stock_receipt(
  p_part_id UUID,
  p_quantity INTEGER,
  p_received_by UUID,
  p_received_date DATE,
  p_supplier_id UUID DEFAULT NULL,
  p_invoice_ref TEXT DEFAULT NULL,
  p_unit_cost NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_procurement_id UUID DEFAULT NULL
)
RETURNS TABLE (
  receipt_id UUID,
  part_id UUID,
  new_current_stock INTEGER,
  reorder_level INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_current INTEGER;
  v_reorder INTEGER;
  v_receipt_id UUID;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Stock receipt quantity must be at least 1, got %', p_quantity;
  END IF;

  -- Row lock the spare_parts row so concurrent receipts/issues serialize
  -- on this part. Other parts continue in parallel.
  SELECT current_stock, reorder_level
    INTO v_current, v_reorder
  FROM spare_parts
  WHERE id = p_part_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Spare part % not found', p_part_id;
  END IF;

  -- Insert the movement evidence row.
  INSERT INTO stock_receipts (
    part_id, quantity, received_by, received_date,
    supplier_id, invoice_ref, unit_cost, notes, procurement_id
  )
  VALUES (
    p_part_id, p_quantity, p_received_by, p_received_date,
    p_supplier_id, p_invoice_ref, p_unit_cost, p_notes, p_procurement_id
  )
  RETURNING id INTO v_receipt_id;

  -- Update current_stock inside the same lock.
  UPDATE spare_parts
     SET current_stock = COALESCE(current_stock, 0) + p_quantity
   WHERE id = p_part_id;

  receipt_id := v_receipt_id;
  part_id := p_part_id;
  new_current_stock := COALESCE(v_current, 0) + p_quantity;
  reorder_level := COALESCE(v_reorder, 0);
  RETURN NEXT;
END;
$$;

-- ============================================================================
-- record_stock_issue
-- ============================================================================

CREATE OR REPLACE FUNCTION record_stock_issue(
  p_part_id UUID,
  p_quantity INTEGER,
  p_issued_by UUID,
  p_issue_date DATE,
  p_issued_to_event_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  issue_id UUID,
  part_id UUID,
  new_current_stock INTEGER,
  reorder_level INTEGER,
  crossed_reorder BOOLEAN,
  crossed_zero BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_current INTEGER;
  v_reorder INTEGER;
  v_new_stock INTEGER;
  v_issue_id UUID;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Stock issue quantity must be at least 1, got %', p_quantity;
  END IF;

  SELECT current_stock, reorder_level
    INTO v_current, v_reorder
  FROM spare_parts
  WHERE id = p_part_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Spare part % not found', p_part_id;
  END IF;

  IF COALESCE(v_current, 0) < p_quantity THEN
    -- Surface insufficient-stock as an exception so the calling action can
    -- map it to a friendly error and not partially commit.
    RAISE EXCEPTION 'Insufficient stock: part % has % units, requested %',
      p_part_id, COALESCE(v_current, 0), p_quantity
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO stock_issues (
    part_id, quantity, issued_to_event_id, issued_by, issue_date,
    department_id, notes
  )
  VALUES (
    p_part_id, p_quantity, p_issued_to_event_id, p_issued_by, p_issue_date,
    p_department_id, p_notes
  )
  RETURNING id INTO v_issue_id;

  v_new_stock := COALESCE(v_current, 0) - p_quantity;

  UPDATE spare_parts
     SET current_stock = v_new_stock
   WHERE id = p_part_id;

  issue_id := v_issue_id;
  part_id := p_part_id;
  new_current_stock := v_new_stock;
  reorder_level := COALESCE(v_reorder, 0);
  -- "crossed" means this issue is the one that moved the stock from above
  -- the threshold to at-or-below. The calling action uses this to decide
  -- whether to emit a one-shot stockout / low-stock notification.
  crossed_zero := COALESCE(v_current, 0) > 0 AND v_new_stock <= 0;
  crossed_reorder := COALESCE(v_current, 0) > COALESCE(v_reorder, 0)
                     AND v_new_stock <= COALESCE(v_reorder, 0);
  RETURN NEXT;
END;
$$;

-- ============================================================================
-- Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION record_stock_receipt(UUID, INTEGER, UUID, DATE, UUID, TEXT, NUMERIC, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_stock_issue(UUID, INTEGER, UUID, DATE, UUID, UUID, TEXT) TO authenticated;

-- ============================================================================
-- R21 dependency: stock_receipts.procurement_id (procurement → receipt link)
-- ============================================================================
-- The record_stock_receipt RPC accepts a p_procurement_id argument so that
-- when Store User records a receipt prefilled from the "procurement
-- delivered" notification (R21), the resulting stock_receipts row keeps a
-- hard link back to the procurement request. Schema column added here so
-- Phase 4 can land both R8 and R21 in one migration step.

ALTER TABLE stock_receipts
  ADD COLUMN IF NOT EXISTS procurement_id UUID
    REFERENCES procurement_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_receipts_procurement
  ON stock_receipts(procurement_id)
  WHERE procurement_id IS NOT NULL;
