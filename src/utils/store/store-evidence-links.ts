// Store-User read-only / store-safe link helpers.
//
// All non-store mutation flows route through these helpers so Store User
// pages never accidentally surface a Create Work Order / Approve / Assign
// path. Reorder/receive/issue links carry source=store-console so the target
// page can prefill correctly.

export function storePartDetail(partId: string): string {
  return `/spare-parts?partId=${encodeURIComponent(partId)}&source=store-console`;
}

export function storeProcurementDetail(procurementId: string): string {
  return `/command/drilldown/procurement/${procurementId}`;
}

export function storeWorkOrderEvidence(workOrderId: string): string {
  return `/maintenance/work-orders/${workOrderId}`;
}

export function storeEquipmentDetail(assetId: string): string {
  return `/equipment/${assetId}`;
}

export function storeReceiveLink(procurementId?: string | null): string {
  const params = new URLSearchParams({
    action: 'record-receipt',
    source: 'store-console',
  });
  if (procurementId) params.set('procurement_id', procurementId);
  return `/spare-parts?${params.toString()}`;
}

export function storeIssueLink(partId?: string | null, options: { workOrderId?: string | null; needId?: string | null } = {}): string {
  const params = new URLSearchParams({ action: 'issue', source: 'store-console' });
  if (partId) params.set('partId', partId);
  if (options.workOrderId) params.set('work_order_id', options.workOrderId);
  if (options.needId) params.set('need_id', options.needId);
  return `/spare-parts?${params.toString()}`;
}

export function storeBinCardLink(partId?: string | null): string {
  const params = new URLSearchParams({ source: 'store-console' });
  if (partId) params.set('partId', partId);
  return `/logistics?workflow=bin-card&${params.toString()}`;
}

// Reorder request prefill — Store User's primary mutation. Carries enough
// context for the procurement-request creation flow to populate item, reason,
// linked part, and desired quantity from canonical stock data.
export function storeCreateReorderLink(
  part: { id: string; name?: string | null; part_code?: string | null; reorder_level?: number | null; current_stock?: number | null },
  options: { workOrderId?: string | null; assetId?: string | null; needId?: string | null; quantityNeeded?: number | null } = {},
): string {
  const reorderLevel = Number(part.reorder_level ?? 0);
  const current = Number(part.current_stock ?? 0);
  const desired = Math.max(Number(options.quantityNeeded ?? 0), reorderLevel - current, reorderLevel, 1);
  const itemName = part.part_code && part.name ? `${part.part_code} ${part.name}` : part.name ?? part.part_code ?? 'spare part';
  const reason = current <= 0
    ? `Stockout for ${itemName}. Reorder to restore stock to reorder_level.`
    : `Low stock for ${itemName}. Current ${current} ≤ reorder ${reorderLevel}.`;
  const params = new URLSearchParams({
    source: 'store-console',
    partId: part.id,
    itemName,
    quantity: String(desired),
    reason,
  });
  params.set('suggestedQuantity', String(desired));
  params.set('currentStock', String(current));
  params.set('reorderLevel', String(reorderLevel));
  if (options.workOrderId) params.set('workOrderId', options.workOrderId);
  if (options.assetId) params.set('assetId', options.assetId);
  if (options.needId) params.set('needId', options.needId);
  return `/procurement/requests/new?${params.toString()}`;
}

export function storeReport(reportType: string): string {
  return `/reports/${reportType}`;
}
