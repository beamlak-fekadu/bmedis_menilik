// Canonical count definitions for BMERMS.
//
// Every count surfaced in the UI must agree with these definitions. If two
// pages mention "Overdue PM", they must derive that number from
// countOverduePM(...) below — not from inline predicates re-implemented in
// page files. The goal is data trust, not UI polish.
//
// Each helper has a comment block documenting:
//   - WHAT it counts
//   - WHAT it excludes
//   - SOURCE table/view
//   - USED BY (intended call sites; keep this current as you wire pages)
//
// SQL-side: where a Postgres view exists (v_*) you may also query the view
// directly. The TS predicates here must agree with those views. If a view
// drifts, the migration must be updated — do not silently diverge.

import {
  REPLACEMENT_REVIEW_THRESHOLD,
  REPLACEMENT_STRONG_THRESHOLD,
  isReplacementCandidate,
  isStrongReplacementCandidate,
} from './replacement-thresholds';

// ─── Date helpers ──────────────────────────────────────────────────────────

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isBeforeToday(date: unknown): boolean {
  if (!date) return false;
  return String(date) < todayISO();
}

function withinDaysFromNow(date: unknown, days: number): boolean {
  if (!date) return false;
  const target = new Date(String(date));
  if (Number.isNaN(target.getTime())) return false;
  const now = Date.now();
  const horizon = now + days * 24 * 60 * 60 * 1000;
  const t = target.getTime();
  return t >= now && t <= horizon;
}

function isInCurrentMonth(date: unknown): boolean {
  if (!date) return false;
  const d = new Date(String(date));
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
}

// ─── Replacement / lifecycle ───────────────────────────────────────────────

// 1. Replacement candidates = RPI >= 0.55 (Strong + Review).
//    Excludes Monitor band (RPI < 0.55) and unscored rows.
//    Source: v_replacement_decision (replacement_priority_index).
//    Used by: /command summary card + drilldown + replacement watchlist,
//             /replacement candidate filter, /developer-lab,
//             /reports/replacement-planning, /alerts (replacement flags).
export function countReplacementCandidates(
  rows: Array<{ priority_index?: number | null; replacement_priority_index?: number | null }>
): number {
  return rows.filter((row) => isReplacementCandidate(row.priority_index ?? row.replacement_priority_index)).length;
}

// 2. Strong replacement candidates = RPI >= 0.70.
//    Subset of replacement candidates. Treated as the "act now" lifecycle signal.
export function countStrongReplacementCandidates(
  rows: Array<{ priority_index?: number | null; replacement_priority_index?: number | null }>
): number {
  return rows.filter((row) => isStrongReplacementCandidate(row.priority_index ?? row.replacement_priority_index)).length;
}

// 3. Monitored lifecycle assets = RPI < 0.55. Not "candidates" — informational only.
//    Shown on /replacement when no candidates exist or when "Monitor" filter is active.
export function countMonitoredLifecycleAssets(
  rows: Array<{ priority_index?: number | null; replacement_priority_index?: number | null }>
): number {
  return rows.filter((row) => {
    const rpi = row.priority_index ?? row.replacement_priority_index ?? 0;
    return rpi < REPLACEMENT_REVIEW_THRESHOLD;
  }).length;
}

// ─── Disposal ──────────────────────────────────────────────────────────────

// 4. Formal disposal requests = all rows in disposal_requests, regardless of status.
//    Source: disposal_requests.
//    Used by: /disposal "Disposal Requests" card, /requests hub disposal facet,
//             /reports lifecycle counts, /developer-lab if surfaced.
export function countDisposalRequests(rows: Array<{ status?: string | null }>): number {
  return rows.length;
}

// 5. Pending disposal requests = disposal_requests with status 'pending' (review queue).
export function countPendingDisposalRequests(rows: Array<{ status?: string | null }>): number {
  return rows.filter((row) => String(row.status ?? '').toLowerCase() === 'pending').length;
}

// 6. Approved disposal requests = disposal_requests with status 'approved' (awaiting completion).
export function countApprovedDisposalRequests(rows: Array<{ status?: string | null }>): number {
  return rows.filter((row) => String(row.status ?? '').toLowerCase() === 'approved').length;
}

// 7. Completed disposals = rows in disposed_assets (evidence of disposal completion).
//    Source: disposed_assets. NOT to be merged with disposal_requests counts.
export function countDisposedAssets(rows: Array<unknown>): number {
  return rows.length;
}

// 8. Disposal candidates = lifecycle evidence rows that *may* deserve a future
//    disposal request, distinct from formal requests. Examples seen in the app:
//    non-functional/decommissioned assets, high-maintenance-burden assets, and
//    replacement candidates without an open disposal request.
//    Source: composed from equipment_assets + replacement scores; this is
//    intentionally a candidate signal, not a formal request count.
export function countDisposalCandidates(
  assets: Array<{ condition?: string | null; status?: string | null }>,
): number {
  return assets.filter((row) => {
    const condition = String(row.condition ?? '').toLowerCase();
    const status = String(row.status ?? '').toLowerCase();
    return condition === 'non_functional' || condition === 'decommissioned' || status === 'inactive' || status === 'decommissioned';
  }).length;
}

// ─── Calibration ───────────────────────────────────────────────────────────

// 9. Overdue calibration = next_due_date is in the past.
//    Excludes: rows without a next_due_date.
//    Source: calibration_records.next_due_date (or v_calibration_due if used).
//    Note: This may be high in seeded environments because seed dates are
//    historical. The number is honest — explain it in /developer-lab.
export function countOverdueCalibration(
  rows: Array<{ next_due_date?: string | null }>
): number {
  return rows.filter((row) => isBeforeToday(row.next_due_date)).length;
}

// 10. Due soon calibration = next_due_date is between today and 90 days from now.
//     Excludes: overdue rows (they are counted separately) and rows beyond 90 days.
export function countDueSoonCalibration(
  rows: Array<{ next_due_date?: string | null }>,
  days = 90,
): number {
  return rows.filter((row) => withinDaysFromNow(row.next_due_date, days)).length;
}

// 11. Failed / adjusted calibration = latest result is 'fail' or 'adjusted'.
//     Source: calibration_records.result.
export function countFailedOrAdjustedCalibration(
  rows: Array<{ result?: string | null }>
): number {
  return rows.filter((row) => ['fail', 'adjusted'].includes(String(row.result ?? '').toLowerCase())).length;
}

// 12. Critical overdue calibration = overdue AND asset/category criticality is high/critical.
//     Narrower than overall overdue. Caller must supply criticality lookup.
export function countCriticalOverdueCalibration(
  rows: Array<{ next_due_date?: string | null; asset_id?: string | null }>,
  isCriticalAsset: (assetId: string | null | undefined) => boolean,
): number {
  return rows.filter((row) => isBeforeToday(row.next_due_date) && isCriticalAsset(row.asset_id)).length;
}

// 13. Calibration requests by status. Open = pending/approved/in_progress.
export function countOpenCalibrationRequests(rows: Array<{ status?: string | null }>): number {
  return rows.filter((row) => ['pending', 'approved', 'in_progress'].includes(String(row.status ?? '').toLowerCase())).length;
}

// ─── Preventive Maintenance ────────────────────────────────────────────────

const PM_ACTIVE_STATUSES = new Set(['scheduled', 'in_progress', 'overdue', 'deferred']);
const PM_CLOSED_STATUSES = new Set(['completed', 'skipped', 'canceled']);

// 14. Active PM tasks = unfinished schedules requiring action.
//     Statuses: scheduled, in_progress, overdue, deferred.
//     Source: pm_schedules.
export function countActivePMTasks(rows: Array<{ status?: string | null }>): number {
  return rows.filter((row) => PM_ACTIVE_STATUSES.has(String(row.status ?? '').toLowerCase())).length;
}

// 15. Overdue PM = scheduled_date < today AND status not in completed/skipped/canceled/deferred.
//     Deferred is excluded because a deferral has an explicit reason and a new date.
export function countOverduePM(rows: Array<{ status?: string | null; scheduled_date?: string | null }>): number {
  return rows.filter((row) => {
    if (!isBeforeToday(row.scheduled_date)) return false;
    const status = String(row.status ?? '').toLowerCase();
    if (PM_CLOSED_STATUSES.has(status)) return false;
    if (status === 'deferred') return false;
    return true;
  }).length;
}

// 16. PM plans without upcoming task = active PM plans (is_active=true) that have
//     no unfinished schedule (no active status entry). These need "Generate Next Task".
export function countPMPlansWithoutUpcomingTask(
  plans: Array<{ id?: string | null; is_active?: boolean | null }>,
  schedules: Array<{ plan_id?: string | null; status?: string | null }>,
): number {
  const activePlanIds = new Set(
    schedules.filter((row) => PM_ACTIVE_STATUSES.has(String(row.status ?? '').toLowerCase())).map((row) => row.plan_id).filter(Boolean) as string[]
  );
  return plans.filter((plan) => plan.is_active === true && plan.id && !activePlanIds.has(plan.id)).length;
}

// 17. Skipped / deferred PM = status in skipped/deferred. Tracked separately from
//     completed — these do NOT count as PM compliance success.
export function countSkippedOrDeferredPM(rows: Array<{ status?: string | null }>): number {
  return rows.filter((row) => ['skipped', 'deferred'].includes(String(row.status ?? '').toLowerCase())).length;
}

// 18. Completed PM this month = completed_at is in current month.
export function countPMCompletedThisMonth(rows: Array<{ status?: string | null; completed_at?: string | null }>): number {
  return rows.filter((row) => String(row.status ?? '').toLowerCase() === 'completed' && isInCurrentMonth(row.completed_at)).length;
}

// ─── Spare parts / stock / procurement ─────────────────────────────────────

// 19. Low stock = current_stock <= reorder_level AND current_stock > 0.
//     Excludes stockouts (counted separately).
export function countLowStock(rows: Array<{ current_stock?: number | null; reorder_level?: number | null; is_active?: boolean | null }>): number {
  return rows.filter((row) => {
    if (row.is_active === false) return false;
    const stock = Number(row.current_stock ?? 0);
    const reorder = Number(row.reorder_level ?? 0);
    return stock > 0 && stock <= reorder;
  }).length;
}

// 20. Stockout = current_stock <= 0.
export function countStockout(rows: Array<{ current_stock?: number | null; is_active?: boolean | null }>): number {
  return rows.filter((row) => row.is_active !== false && Number(row.current_stock ?? 0) <= 0).length;
}

// 21. Stock blockers = stockouts (parts that block work). Low-stock-with-impact
//     is tracked separately by the spare-parts page's Action Queue.
export function countStockBlockers(rows: Array<{ current_stock?: number | null; is_active?: boolean | null }>): number {
  return countStockout(rows);
}

// 22. Stockout without procurement = stockout rows that do NOT have an open
//     procurement request linked. Caller supplies a hasOpenProcurement predicate
//     since the linkage today is by part name (no FK).
export function countStockoutWithoutProcurement(
  parts: Array<{ id?: string | null; current_stock?: number | null; is_active?: boolean | null }>,
  hasOpenProcurement: (partId: string | null | undefined) => boolean,
): number {
  return parts.filter((row) => row.is_active !== false && Number(row.current_stock ?? 0) <= 0 && !hasOpenProcurement(row.id)).length;
}

const PROCUREMENT_OPEN_STATUSES = new Set(['requested', 'approved', 'ordered', 'in_transit']);

// 23. Open procurement = status in requested/approved/ordered/in_transit.
//     Excludes delivered and canceled.
export function countOpenProcurement(rows: Array<{ status?: string | null }>): number {
  return rows.filter((row) => PROCUREMENT_OPEN_STATUSES.has(String(row.status ?? '').toLowerCase())).length;
}

// 24. Delayed procurement = expected_delivery_date in past AND status not delivered/canceled.
export function countDelayedProcurement(rows: Array<{ status?: string | null; expected_delivery_date?: string | null }>): number {
  return rows.filter((row) => {
    if (!isBeforeToday(row.expected_delivery_date)) return false;
    const status = String(row.status ?? '').toLowerCase();
    return status !== 'delivered' && status !== 'canceled';
  }).length;
}

// 25. Delivered procurement = status delivered.
export function countDeliveredProcurement(rows: Array<{ status?: string | null }>): number {
  return rows.filter((row) => String(row.status ?? '').toLowerCase() === 'delivered').length;
}

// ─── Work orders / maintenance ────────────────────────────────────────────

const WO_CLOSED_STATUSES = new Set(['completed', 'canceled']);
const WO_ACTIVE_STATUSES = new Set(['open', 'assigned', 'in_progress', 'on_hold']);

// 26. Open work orders = not completed/canceled. Same as "active" in operational UI.
export function countOpenWorkOrders(rows: Array<{ status?: string | null }>): number {
  return rows.filter((row) => !WO_CLOSED_STATUSES.has(String(row.status ?? '').toLowerCase())).length;
}

// 27. Active work orders = open/assigned/in_progress/on_hold. Explicit allow-list.
export function countActiveWorkOrders(rows: Array<{ status?: string | null }>): number {
  return rows.filter((row) => WO_ACTIVE_STATUSES.has(String(row.status ?? '').toLowerCase())).length;
}

// 28. Active critical/high work orders = active AND priority critical/high.
export function countActiveCriticalHighWorkOrders(
  rows: Array<{ status?: string | null; priority?: string | null }>,
): number {
  return rows.filter((row) => {
    if (!WO_ACTIVE_STATUSES.has(String(row.status ?? '').toLowerCase())) return false;
    return ['critical', 'high'].includes(String(row.priority ?? '').toLowerCase());
  }).length;
}

// 29. Completed work orders this month.
export function countWorkOrdersCompletedThisMonth(rows: Array<{ status?: string | null; completed_at?: string | null }>): number {
  return rows.filter((row) => String(row.status ?? '').toLowerCase() === 'completed' && isInCurrentMonth(row.completed_at)).length;
}

// 30. Open corrective maintenance requests = pending/approved/assigned/in_progress.
//     Closed: completed/rejected/canceled.
export function countOpenCorrectiveRequests(rows: Array<{ status?: string | null }>): number {
  return rows.filter((row) => ['pending', 'approved', 'assigned', 'in_progress'].includes(String(row.status ?? '').toLowerCase())).length;
}

// ─── Re-exports of the threshold constants for caller convenience ──────────
export { REPLACEMENT_REVIEW_THRESHOLD, REPLACEMENT_STRONG_THRESHOLD };
