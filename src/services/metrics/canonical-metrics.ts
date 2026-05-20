// R11 + R28: canonical metric computations shared by dashboards and reports.
//
// Before this module, every report had its own inline KPI math in
// `buildReportKPIs` (reports/[type]/ReportTypeClient.tsx) and every
// dashboard card had its own inline math. The two could drift — exactly the
// "same concept, different number" failure R11 was filed to prevent.
//
// These functions are pure, side-effect free, take normalized row arrays,
// and return the same numeric shapes. Dashboard cards AND report KPIs both
// call them. If you find a divergence, fix it here and both surfaces update
// in lock-step.

export interface EquipmentConditionStats {
  total: number;
  functional: number;
  needsRepair: number;
  nonFunctional: number;
  underMaintenance: number;
  functionalPercentage: number; // 0..100, rounded
}

export function computeEquipmentConditionStats(
  rows: ReadonlyArray<{ condition?: string | null }>,
): EquipmentConditionStats {
  const total = rows.length;
  const functional = rows.filter((r) => r.condition === 'functional').length;
  const needsRepair = rows.filter((r) => r.condition === 'needs_repair').length;
  const nonFunctional = rows.filter((r) => r.condition === 'non_functional').length;
  const underMaintenance = rows.filter((r) => r.condition === 'under_maintenance').length;
  const functionalPercentage = total > 0 ? Math.round((functional / total) * 100) : 0;
  return { total, functional, needsRepair, nonFunctional, underMaintenance, functionalPercentage };
}

export interface PMComplianceStats {
  total: number;
  completed: number;
  overdue: number;
  compliancePercentage: number; // 0..100, rounded; equation 5 from the thesis.
}

export function computePMComplianceStats(
  rows: ReadonlyArray<{ status?: string | null }>,
): PMComplianceStats {
  const total = rows.length;
  const completed = rows.filter((r) => r.status === 'completed').length;
  const overdue = rows.filter((r) => r.status === 'overdue').length;
  const compliancePercentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, overdue, compliancePercentage };
}

export interface CalibrationComplianceStats {
  total: number;
  pass: number;
  fail: number;
  adjusted: number;
  overdue: number;
  passPercentage: number; // 0..100, rounded
}

export function computeCalibrationComplianceStats(
  rows: ReadonlyArray<{ result?: string | null; next_due_date?: string | null }>,
  now: Date = new Date(),
): CalibrationComplianceStats {
  const total = rows.length;
  const pass = rows.filter((r) => r.result === 'pass').length;
  const fail = rows.filter((r) => r.result === 'fail').length;
  const adjusted = rows.filter((r) => r.result === 'adjusted').length;
  const overdue = rows.filter(
    (r) => r.next_due_date && new Date(String(r.next_due_date)).getTime() < now.getTime(),
  ).length;
  const passPercentage = total > 0 ? Math.round((pass / total) * 100) : 0;
  return { total, pass, fail, adjusted, overdue, passPercentage };
}

export interface WorkOrderStats {
  total: number;
  active: number;
  completed: number;
  criticalOrHigh: number;
}

const ACTIVE_WO_STATUSES = new Set(['open', 'assigned', 'in_progress', 'on_hold']);

export function computeWorkOrderStats(
  rows: ReadonlyArray<{ status?: string | null; priority?: string | null }>,
): WorkOrderStats {
  const total = rows.length;
  const active = rows.filter((r) => ACTIVE_WO_STATUSES.has(String(r.status ?? ''))).length;
  const completed = rows.filter((r) => r.status === 'completed').length;
  const criticalOrHigh = rows.filter((r) =>
    ['critical', 'high'].includes(String(r.priority ?? '')),
  ).length;
  return { total, active, completed, criticalOrHigh };
}

export interface MaintenanceEventStats {
  total: number;
  withRepairHours: number;
  avgRepairHours: number | null;
  totalServiceCost: number;
  eventTypes: number;
}

export function computeMaintenanceEventStats(
  rows: ReadonlyArray<{
    repair_duration_hours?: number | null;
    service_cost?: number | null;
    event_type?: string | null;
  }>,
): MaintenanceEventStats {
  const total = rows.length;
  const withRepairHours = rows.filter((r) => r.repair_duration_hours != null).length;
  const avgRepairHours = withRepairHours > 0
    ? rows
        .filter((r) => r.repair_duration_hours != null)
        .reduce((acc, r) => acc + Number(r.repair_duration_hours ?? 0), 0) / withRepairHours
    : null;
  const totalServiceCost = rows.reduce((acc, r) => acc + Number(r.service_cost ?? 0), 0);
  const eventTypes = new Set(rows.map((r) => r.event_type).filter(Boolean)).size;
  return { total, withRepairHours, avgRepairHours, totalServiceCost, eventTypes };
}

// Report metadata helpers — surfaced in PDF/CSV exports and report page
// headers per R11+R28: every report shows when it was generated AND the
// snapshot timestamp of its data source.
export interface ReportMetadata {
  generatedAt: string; // ISO timestamp
  dataSource: string; // human label, e.g. "Live query / equipment_assets"
  freshnessNote?: string; // e.g. "Last analytics refresh: 2026-05-19 10:30 UTC"
}

export function buildReportMetadata(input: {
  dataSource: string;
  lastAnalyticsRefresh?: string | null;
}): ReportMetadata {
  return {
    generatedAt: new Date().toISOString(),
    dataSource: input.dataSource,
    freshnessNote: input.lastAnalyticsRefresh
      ? `Last analytics refresh: ${new Date(input.lastAnalyticsRefresh).toLocaleString()}`
      : 'Live query (no snapshot dependency)',
  };
}
