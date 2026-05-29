// Server-side store/logistics metric aggregator for the Store User role.
//
// Every value returned here is computed from real loaded rows in the BMEDIS
// database. No generated narrative, no AI-derived prose, no fake counts.
// Returns null where a metric truly cannot be computed.
//
// Source rows / definitions:
//   - spare_parts                 : id, current_stock, reorder_level, unit_cost
//                                   → stockout / low / healthy classification.
//   - stock_receipts              : receipts logged this calendar month.
//   - stock_issues                : issues logged this calendar month,
//                                   issued_to_event_id links to a work order
//                                   event when present.
//   - procurement_requests        : status pipeline (requested → approved →
//                                   ordered → in_transit → delivered, plus
//                                   'delayed').
//   - recommendation_flags        : flag_type in ('low_stock','part_shortage')
//                                   surfaces stock blockers and acknowledged
//                                   flags are excluded.
//   - work_order_parts_needed     : canonical exact parts-blocker rows tied
//                                   to work order + spare part + asset context.
//
// Notes:
//   - "Delivered awaiting receipt" reads procurement_requests where
//     status='delivered'. Receipt rows persist procurement_id, so downstream
//     evidence can answer exactly what was received for a delivered request.
import type { createClient } from '@/lib/supabase/server';
import {
  classifyStock,
  isOpenProcurement,
  isDeliveredProcurement,
  isDelayedProcurement,
} from './stock-state';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface StoreExecutiveMetrics {
  totalParts: number;
  inStockParts: number;
  lowStockParts: number;
  stockoutParts: number;
  blockedWorkOrders: number;
  deliveredItemsToReceive: number; // procurement status='delivered'
  openProcurement: number; // requested + approved + ordered + in_transit
  delayedProcurement: number; // status='delayed'
  recentReceipts: number; // stock_receipts in current month
  recentIssues: number; // stock_issues in current month
}

interface PartRow {
  id: string;
  current_stock: number | null;
  reorder_level: number | null;
}

function monthStartIso(): string {
  const d = new Date();
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), 1).toISOString().slice(0, 10);
}

export async function fetchStoreExecutiveMetrics(supabase: Supabase): Promise<StoreExecutiveMetrics> {
  const monthStart = monthStartIso();

  const [
    partsRes,
    procRes,
    receiptsRes,
    issuesRes,
    partsNeededRes,
  ] = await Promise.all([
    supabase
      .from('spare_parts')
      .select('id, current_stock, reorder_level')
      .eq('is_active', true)
      .limit(5000),
    supabase
      .from('procurement_requests')
      .select('id, status')
      .limit(5000),
    supabase
      .from('stock_receipts')
      .select('id, received_date')
      .gte('received_date', monthStart)
      .limit(5000),
    supabase
      .from('stock_issues')
      .select('id, issue_date')
      .gte('issue_date', monthStart)
      .limit(5000),
    supabase
      .from('work_order_parts_needed')
      .select('id, status')
      .eq('status', 'open')
      .limit(2000),
  ]);

  const parts = (partsRes.data ?? []) as PartRow[];
  let inStock = 0, low = 0, stockout = 0;
  for (const p of parts) {
    const state = classifyStock(p);
    if (state === 'stockout') stockout++;
    else if (state === 'low') low++;
    else inStock++;
  }

  const procRows = (procRes.data ?? []) as Array<{ status: string | null }>;
  let openProcurement = 0;
  let delayedProcurement = 0;
  let deliveredItemsToReceive = 0;
  for (const r of procRows) {
    if (isOpenProcurement(r.status)) openProcurement++;
    if (isDelayedProcurement(r.status)) delayedProcurement++;
    if (isDeliveredProcurement(r.status)) deliveredItemsToReceive++;
  }

  const blockedWorkOrders = (partsNeededRes.data ?? []).length;

  return {
    totalParts: parts.length,
    inStockParts: inStock,
    lowStockParts: low,
    stockoutParts: stockout,
    blockedWorkOrders,
    deliveredItemsToReceive,
    openProcurement,
    delayedProcurement,
    recentReceipts: (receiptsRes.data ?? []).length,
    recentIssues: (issuesRes.data ?? []).length,
  };
}

// Stock risk rows for the Store Command Center / Stock Control table.
export interface StoreStockRiskRow {
  id: string;
  partCode: string;
  name: string;
  category: string | null;
  currentStock: number;
  reorderLevel: number;
  deficit: number;
  unitCost: number | null;
  state: 'stockout' | 'low' | 'healthy';
  openProcurementId: string | null;
  openProcurementStatus: string | null;
}

export async function fetchStoreStockRisk(supabase: Supabase): Promise<StoreStockRiskRow[]> {
  const [partsRes, procRes] = await Promise.all([
    supabase
      .from('spare_parts')
      .select('id, part_code, name, category, current_stock, reorder_level, unit_cost')
      .eq('is_active', true)
      .order('current_stock', { ascending: true })
      .limit(2000),
    supabase
      .from('procurement_requests')
      .select('id, status, title, spare_part_id, created_at')
      .in('status', ['requested', 'approved', 'ordered', 'in_transit', 'delayed'])
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);

  // Best-effort linkage: procurement_requests do not have a partId column in
  // the current schema. We match by the part_code or part name appearing in
  // the procurement title (case-insensitive substring). This is a heuristic
  // that the UI must clearly label — it does not assert a verified linkage.
  const proc = (procRes.data ?? []) as Array<{ id: string; status: string | null; title: string | null; spare_part_id?: string | null }>;

  function findOpenProcurement(partId: string, partCode: string, name: string): { id: string; status: string | null } | null {
    const exact = proc.find((row) => row.spare_part_id === partId);
    if (exact) return { id: exact.id, status: exact.status };
    const codeKey = partCode.toLowerCase();
    const nameKey = name.toLowerCase();
    for (const r of proc) {
      const t = (r.title ?? '').toLowerCase();
      if (t.includes(codeKey) || (nameKey.length > 4 && t.includes(nameKey))) {
        return { id: r.id, status: r.status };
      }
    }
    return null;
  }

  return ((partsRes.data ?? []) as Array<PartRow & { part_code: string; name: string; category: string | null; unit_cost: number | null }>)
    .map((p) => {
      const state = classifyStock(p);
      const open = state === 'healthy' ? null : findOpenProcurement(p.id, p.part_code, p.name);
      return {
        id: p.id,
        partCode: p.part_code,
        name: p.name,
        category: p.category ?? null,
        currentStock: Number(p.current_stock ?? 0),
        reorderLevel: Number(p.reorder_level ?? 0),
        deficit: Math.max(0, Number(p.reorder_level ?? 0) - Number(p.current_stock ?? 0)),
        unitCost: p.unit_cost === null ? null : Number(p.unit_cost),
        state,
        openProcurementId: open?.id ?? null,
        openProcurementStatus: open?.status ?? null,
      };
    });
}

// Receiving queue: procurement requests with status delivered.
export interface StoreReceivingRow {
  id: string;
  requestNumber: string;
  title: string;
  status: string;
  priority: string;
  expectedDeliveryDate: string | null;
  sparePartId: string | null;
  requestedQuantity: number | null;
  createdAt: string | null;
}

export async function fetchStoreReceivingQueue(supabase: Supabase): Promise<StoreReceivingRow[]> {
  const { data } = await supabase
    .from('procurement_requests')
    .select('id, request_number, title, status, priority, expected_delivery_date, spare_part_id, requested_quantity, created_at')
    .eq('status', 'delivered')
    .order('expected_delivery_date', { ascending: true })
    .limit(500);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    requestNumber: (r.request_number as string) ?? '',
    title: (r.title as string) ?? '',
    status: (r.status as string) ?? '',
    priority: (r.priority as string) ?? 'medium',
    expectedDeliveryDate: (r.expected_delivery_date as string | null) ?? null,
    sparePartId: (r.spare_part_id as string | null) ?? null,
    requestedQuantity: typeof r.requested_quantity === 'number' ? (r.requested_quantity as number) : null,
    createdAt: (r.created_at as string | null) ?? null,
  }));
}

// Issue queue: approved maintenance requests that may need parts issued
// downstream. We deliberately surface this as a "handoff" queue, not as a
// strict approved-issue-request queue, because the BMEDIS schema does not
// currently model item issue approvals as a distinct workflow.
function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// Maintenance blockers: work orders on hold + related context.
export interface StoreBlockerRow {
  id: string;
  needId: string;
  workOrderNumber: string | null;
  assetId: string | null;
  assetName: string;
  assetCode: string;
  departmentName: string;
  priority: string | null;
  status: string;
  blockedSince: string | null;
  partId: string | null;
  partCode: string;
  partName: string;
  quantityNeeded: number;
  currentStock: number | null;
  reorderLevel: number | null;
}

export async function fetchStoreBlockers(supabase: Supabase): Promise<StoreBlockerRow[]> {
  const { data } = await supabase
    .from('work_order_parts_needed')
    .select(`
      id, work_order_id, spare_part_id, quantity_needed, created_at, status,
      spare_parts(id, part_code, name, current_stock, reorder_level),
      work_orders(id, work_order_number, asset_id, priority, status, created_at, equipment_assets(asset_code, name, departments(name)))
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .limit(500);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
    const part = firstRelation(r.spare_parts as Record<string, unknown> | Record<string, unknown>[] | null);
    const wo = firstRelation(r.work_orders as Record<string, unknown> | Record<string, unknown>[] | null);
    const eq = firstRelation(wo?.equipment_assets as Record<string, unknown> | Record<string, unknown>[] | null);
    const dept = firstRelation(eq?.departments as Record<string, unknown> | Record<string, unknown>[] | null);
    return {
      id: (wo?.id as string | undefined) ?? (r.work_order_id as string),
      needId: r.id as string,
      workOrderNumber: (wo?.work_order_number as string | null) ?? null,
      assetId: (wo?.asset_id as string | null) ?? null,
      assetName: (eq?.name as string | undefined) ?? 'Unknown',
      assetCode: (eq?.asset_code as string | undefined) ?? '—',
      departmentName: (dept?.name as string | undefined) ?? 'Unknown',
      priority: (wo?.priority as string | null) ?? null,
      status: (wo?.status as string | null) ?? 'open',
      blockedSince: (r.created_at as string | null) ?? null,
      partId: (part?.id as string | null) ?? (r.spare_part_id as string | null) ?? null,
      partCode: (part?.part_code as string | undefined) ?? '—',
      partName: (part?.name as string | undefined) ?? 'Unknown part',
      quantityNeeded: Number(r.quantity_needed ?? 1),
      currentStock: typeof part?.current_stock === 'number' ? (part.current_stock as number) : null,
      reorderLevel: typeof part?.reorder_level === 'number' ? (part.reorder_level as number) : null,
    };
  });
}
