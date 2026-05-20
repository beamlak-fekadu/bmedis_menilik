-- Migration 00065: record_stock_receipt returns crossed_up flag (R9 / Phase 5)
--
-- R9 in Phase 5 emits a spare_part.restocked notification when a receipt
-- moves the stock back ABOVE reorder_level. The previous RPC signature
-- (added in migration 00064) returned new_current_stock and reorder_level
-- but did not expose the pre-receipt stock value, so the action layer
-- could not tell "this receipt is the one that crossed back up" from "this
-- receipt landed on a part that was already healthy".
--
-- Mirrors the crossed_reorder / crossed_zero booleans that
-- record_stock_issue already returns. Honest: a receipt that takes a part
-- from at-or-below-reorder to above-reorder emits crossed_up=true exactly
-- once; subsequent receipts on the same now-healthy part emit false.

-- Postgres rejects CREATE OR REPLACE when the RETURNS TABLE shape changes
-- (we're adding a column). Drop the old signature first so the new shape
-- can be installed cleanly. IF EXISTS keeps this idempotent for fresh installs.
DROP FUNCTION IF EXISTS record_stock_receipt(UUID, INTEGER, UUID, DATE, UUID, TEXT, NUMERIC, TEXT, UUID);

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
  reorder_level INTEGER,
  crossed_up BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_current INTEGER;
  v_reorder INTEGER;
  v_new_stock INTEGER;
  v_receipt_id UUID;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Stock receipt quantity must be at least 1, got %', p_quantity;
  END IF;

  SELECT current_stock, reorder_level
    INTO v_current, v_reorder
  FROM spare_parts
  WHERE id = p_part_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Spare part % not found', p_part_id;
  END IF;

  INSERT INTO stock_receipts (
    part_id, quantity, received_by, received_date,
    supplier_id, invoice_ref, unit_cost, notes, procurement_id
  )
  VALUES (
    p_part_id, p_quantity, p_received_by, p_received_date,
    p_supplier_id, p_invoice_ref, p_unit_cost, p_notes, p_procurement_id
  )
  RETURNING id INTO v_receipt_id;

  v_new_stock := COALESCE(v_current, 0) + p_quantity;

  UPDATE spare_parts
     SET current_stock = v_new_stock
   WHERE id = p_part_id;

  receipt_id := v_receipt_id;
  part_id := p_part_id;
  new_current_stock := v_new_stock;
  reorder_level := COALESCE(v_reorder, 0);
  -- crossed_up: this receipt is the one that moved stock from at-or-below
  -- the reorder level to above it. Used by the action layer to emit
  -- spare_part.restocked exactly once per crossing — subsequent receipts
  -- on the same now-healthy part return false.
  crossed_up := COALESCE(v_reorder, 0) > 0
                AND COALESCE(v_current, 0) <= COALESCE(v_reorder, 0)
                AND v_new_stock > COALESCE(v_reorder, 0);
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION record_stock_receipt(UUID, INTEGER, UUID, DATE, UUID, TEXT, NUMERIC, TEXT, UUID) TO authenticated;
