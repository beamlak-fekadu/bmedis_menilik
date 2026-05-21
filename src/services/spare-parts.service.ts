import { createClient } from '@/lib/supabase/client';
import type { SparePart, StockReceipt, StockIssue } from '@/types/domain';

export interface SparePartFilters {
  category?: string;
  is_active?: boolean;
  search?: string;
}

const PART_SELECT = `
  id, part_code, name, description, category, unit, reorder_level,
  current_stock, unit_cost, compatible_categories, is_active, created_at, updated_at
`;

export async function getSpareParts(filters: SparePartFilters = {}) {
  const supabase = createClient();
  let query = supabase
    .from('spare_parts')
    .select(PART_SELECT);

  if (filters.category) query = query.eq('category', filters.category);
  if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);
  if (filters.search) query = query.or(`name.ilike.%${filters.search}%,part_code.ilike.%${filters.search}%`);

  return query.order('name', { ascending: true });
}

export async function createSparePart(data: Omit<SparePart, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = createClient();
  return supabase
    .from('spare_parts')
    .insert(data)
    .select(PART_SELECT)
    .single();
}

export async function updateSparePart(id: string, data: Partial<Omit<SparePart, 'id' | 'created_at' | 'updated_at'>>) {
  const supabase = createClient();
  return supabase
    .from('spare_parts')
    .update(data)
    .eq('id', id)
    .select(PART_SELECT)
    .single();
}

export async function getStockReceipts(partId: string) {
  const supabase = createClient();
  return supabase
    .from('stock_receipts')
    .select('id, part_id, quantity, received_by, received_date, supplier_id, invoice_ref, unit_cost, notes, created_at')
    .eq('part_id', partId)
    .order('received_date', { ascending: false });
}

export async function createStockReceipt(data: Omit<StockReceipt, 'id' | 'created_at'>) {
  void data;
  throw new Error(
    'Deprecated unsafe stock mutation path: use createStockReceiptAction(), which calls the record_stock_receipt RPC under a row lock.'
  );
}

export async function getStockIssues(partId: string) {
  const supabase = createClient();
  return supabase
    .from('stock_issues')
    .select('id, part_id, quantity, issued_to_event_id, issued_by, issue_date, department_id, notes, created_at')
    .eq('part_id', partId)
    .order('issue_date', { ascending: false });
}

export async function createStockIssue(data: Omit<StockIssue, 'id' | 'created_at'>) {
  void data;
  throw new Error(
    'Deprecated unsafe stock mutation path: use createStockIssueAction(), which calls the record_stock_issue RPC under a row lock.'
  );
}

export async function getLowStockParts() {
  const supabase = createClient();
  return supabase
    .from('v_low_stock_parts')
    .select('id, part_code, name, category, current_stock, reorder_level, unit_cost, deficit')
    .order('deficit', { ascending: false });
}
