'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Download, Printer, ArrowLeft, RefreshCw, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import FilterBar from '@/components/ui/FilterBar';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { BarChart, DoughnutChart, HorizontalBarChart, ChartCard, LineChart } from '@/components/charts';
import * as reportsService from '@/services/reports.service';
import * as settingsService from '@/services/settings.service';
import type { ReportFilters } from '@/services/reports.service';
import { exportToCSV, exportToPDF } from '@/utils/export';
import { prepareReportSnapshotAction } from '@/actions/reports.actions';

type Row = Record<string, unknown>;

interface ReportConfig {
  title: string;
  description: string;
  methodologyNote: string;
  filterDefs: string[];
  fetchData: (filters: ReportFilters) => Promise<{ data: unknown[] | null; error: unknown }>;
  columns: { key: string; header: string; sortable?: boolean; render?: (row: Row) => React.ReactNode }[];
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

function formatLabel(val: string) {
  return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const resultVariant: Record<string, 'success' | 'error' | 'warning'> = {
  pass: 'success',
  fail: 'error',
  adjusted: 'warning',
};

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'> = {
  pending: 'warning',
  approved: 'info',
  scheduled: 'purple',
  in_progress: 'purple',
  completed: 'success',
  rejected: 'error',
  canceled: 'default',
  overdue: 'error',
  open: 'warning',
  assigned: 'info',
  on_hold: 'default',
  skipped: 'default',
  active: 'success',
  inactive: 'default',
  disposed: 'error',
  in_storage: 'info',
  functional: 'success',
  needs_repair: 'warning',
  non_functional: 'error',
  under_maintenance: 'purple',
  decommissioned: 'default',
};

/* Maps URL slug → internal data type for fetchData selection */
function normalizeReportType(type: string): string {
  return (
    ({
      'biomedical-operations': 'equipment',
      'department-readiness': 'equipment',
      'evaluation-demo': 'evaluation-demo',
      'decision-support-methodology': 'replacement-planning',
      evaluation: 'equipment',
      'maintenance-performance': 'maintenance',
      'pm-compliance': 'pm',
      'calibration-compliance': 'calibration',
      'spare-parts-stock': 'spare-parts',
      'training-competency': 'training',
      'disposal-lifecycle': 'disposal',
      'technician-workload': 'work-orders',
      replacement: 'replacement-planning',
      procurement: 'procurement-pipeline',
    } as Record<string, string>)[type] ?? type
  );
}

/* ── KPI cards ────────────────────────────────────────────────────────────── */

type KpiCard = { label: string; value: string | number; color: string; sub?: string };

function buildReportKPIs(type: string, rows: Row[]): KpiCard[] {
  if (!rows.length) return [];

  const slug = type;

  if (['equipment', 'biomedical-operations', 'department-readiness', 'evaluation-demo'].includes(slug)) {
    const functional = rows.filter((r) => r.condition === 'functional').length;
    const needsRepair = rows.filter((r) => r.condition === 'needs_repair').length;
    const nonFunctional = rows.filter((r) => r.condition === 'non_functional').length;
    const underMaintenance = rows.filter((r) => r.condition === 'under_maintenance').length;
    return [
      { label: 'Total Assets', value: rows.length, color: 'blue' },
      { label: 'Functional', value: functional, color: 'green', sub: `${Math.round((functional / rows.length) * 100)}%` },
      { label: 'Needs Repair', value: needsRepair, color: 'yellow' },
      { label: 'Non-Functional / Under Maint.', value: nonFunctional + underMaintenance, color: nonFunctional > 0 ? 'red' : 'yellow' },
    ];
  }

  if (slug === 'maintenance-performance') {
    const withHours = rows.filter((r) => r.repair_duration_hours != null);
    const avgRepair = withHours.length
      ? withHours.reduce((acc, r) => acc + Number(r.repair_duration_hours ?? 0), 0) / withHours.length
      : null;
    const totalCost = rows.reduce((acc, r) => acc + Number(r.service_cost ?? 0), 0);
    return [
      { label: 'Total Events', value: rows.length, color: 'blue' },
      { label: 'Avg Repair Hours', value: avgRepair != null ? avgRepair.toFixed(1) : 'Insufficient data', color: 'yellow' },
      { label: 'Total Service Cost (ETB)', value: totalCost > 0 ? totalCost.toLocaleString() : '—', color: 'orange' },
      { label: 'Event Types', value: new Set(rows.map((r) => r.event_type)).size, color: 'purple' },
    ];
  }

  if (slug === 'pm-compliance') {
    const completed = rows.filter((r) => r.status === 'completed').length;
    const overdue = rows.filter((r) => r.status === 'overdue').length;
    const compliance = rows.length ? Math.round((completed / rows.length) * 100) : 0;
    return [
      { label: 'Total Scheduled', value: rows.length, color: 'blue' },
      { label: 'Completed', value: completed, color: 'green' },
      { label: 'Overdue', value: overdue, color: overdue > 0 ? 'red' : 'green', sub: overdue > 0 ? 'Requires action' : 'None' },
      { label: 'PM Compliance', value: `${compliance}%`, color: compliance >= 80 ? 'green' : compliance >= 60 ? 'yellow' : 'red' },
    ];
  }

  if (slug === 'calibration-compliance') {
    const pass = rows.filter((r) => r.result === 'pass').length;
    const fail = rows.filter((r) => r.result === 'fail').length;
    const adjusted = rows.filter((r) => r.result === 'adjusted').length;
    const overdue = rows.filter((r) => r.next_due_date && new Date(String(r.next_due_date)) < new Date()).length;
    return [
      { label: 'Total Records', value: rows.length, color: 'blue' },
      { label: 'Pass', value: pass, color: 'green', sub: `${rows.length ? Math.round((pass / rows.length) * 100) : 0}% pass rate` },
      { label: 'Fail', value: fail, color: fail > 0 ? 'red' : 'green' },
      { label: 'Adjusted', value: adjusted, color: adjusted > 0 ? 'yellow' : 'green' },
      { label: 'Overdue', value: overdue, color: overdue > 0 ? 'red' : 'green' },
    ].slice(0, 4);
  }

  if (slug === 'work-orders' || slug === 'technician-workload') {
    const active = rows.filter((r) => ['open', 'assigned', 'in_progress', 'on_hold'].includes(String(r.status ?? ''))).length;
    const completed = rows.filter((r) => r.status === 'completed').length;
    const criticalHigh = rows.filter((r) => ['critical', 'high'].includes(String(r.priority ?? ''))).length;
    return [
      { label: 'Total Work Orders', value: rows.length, color: 'blue' },
      { label: 'Active', value: active, color: 'yellow' },
      { label: 'Completed', value: completed, color: 'green' },
      { label: 'Critical / High Priority', value: criticalHigh, color: criticalHigh > 5 ? 'red' : 'yellow' },
    ];
  }

  if (slug === 'replacement-planning' || slug === 'decision-support-methodology') {
    const strong = rows.filter((r) => Number(r.replacement_priority_index ?? 0) >= 0.7).length;
    const review = rows.filter((r) => {
      const rpi = Number(r.replacement_priority_index ?? 0);
      return rpi >= 0.55 && rpi < 0.7;
    }).length;
    const monitor = rows.length - strong - review;
    return [
      { label: 'Total Assessed', value: rows.length, color: 'blue' },
      { label: 'Strong Candidates (≥0.70)', value: strong, color: strong > 0 ? 'red' : 'green', sub: 'Replacement recommended' },
      { label: 'Review Candidates (0.55–0.69)', value: review, color: review > 0 ? 'yellow' : 'green' },
      { label: 'Monitor (<0.55)', value: monitor, color: 'gray' },
    ];
  }

  if (slug === 'procurement-pipeline') {
    const active = rows.filter((r) => !['delivered', 'canceled'].includes(String(r.status ?? ''))).length;
    const delivered = rows.filter((r) => r.status === 'delivered').length;
    const criticalHigh = rows.filter((r) => ['critical', 'high'].includes(String(r.priority ?? ''))).length;
    return [
      { label: 'Total Requests', value: rows.length, color: 'blue' },
      { label: 'Active Pipeline', value: active, color: 'yellow' },
      { label: 'Delivered', value: delivered, color: 'green' },
      { label: 'Critical / High Priority', value: criticalHigh, color: criticalHigh > 0 ? 'red' : 'green' },
    ];
  }

  if (slug === 'spare-parts-stock') {
    const stockout = rows.filter((r) => Number(r.current_stock ?? 0) === 0).length;
    const lowStock = rows.filter((r) => {
      const s = Number(r.current_stock ?? 0);
      const rl = Number(r.reorder_level ?? 0);
      return s > 0 && s <= rl;
    }).length;
    const totalValue = rows.reduce((acc, r) => acc + Number(r.current_stock ?? 0) * Number(r.unit_cost ?? 0), 0);
    return [
      { label: 'Total Parts', value: rows.length, color: 'blue' },
      { label: 'Stockout', value: stockout, color: stockout > 0 ? 'red' : 'green', sub: stockout > 0 ? 'Check blockers' : 'None' },
      { label: 'Low Stock', value: lowStock, color: lowStock > 0 ? 'yellow' : 'green' },
      { label: 'Stock Value (ETB)', value: totalValue > 0 ? totalValue.toLocaleString() : '—', color: 'purple' },
    ];
  }

  if (slug === 'disposal-lifecycle') {
    const pending = rows.filter((r) => r.status === 'pending').length;
    const approved = rows.filter((r) => r.status === 'approved').length;
    const completed = rows.filter((r) => r.status === 'completed').length;
    return [
      { label: 'Total Requests', value: rows.length, color: 'blue' },
      { label: 'Pending Review', value: pending, color: pending > 0 ? 'yellow' : 'gray' },
      { label: 'Approved', value: approved, color: 'yellow' },
      { label: 'Completed Disposals', value: completed, color: 'green' },
    ];
  }

  if (slug === 'training-competency') {
    const totalAttendees = rows.reduce((acc, r) => {
      const records = r.staff_training_records as unknown[];
      return acc + (Array.isArray(records) ? records.length : 0);
    }, 0);
    const categories = new Set(
      rows.map((r) => {
        const cat = r.equipment_categories as { name?: string } | null;
        return cat?.name ?? 'General';
      })
    ).size;
    return [
      { label: 'Total Sessions', value: rows.length, color: 'blue' },
      { label: 'Total Attendees', value: totalAttendees > 0 ? totalAttendees : 'No records', color: 'green' },
      { label: 'Equipment Categories', value: categories, color: 'purple' },
    ];
  }

  if (slug === 'risk-fmea') {
    const critical = rows.filter((r) => r.risk_level === 'critical').length;
    const high = rows.filter((r) => r.risk_level === 'high').length;
    const withRPN = rows.filter((r) => r.rpn != null);
    const avgRPN = withRPN.length
      ? withRPN.reduce((acc, r) => acc + Number(r.rpn ?? 0), 0) / withRPN.length
      : null;
    return [
      { label: 'Total Assets', value: rows.length, color: 'blue' },
      { label: 'Critical Risk', value: critical, color: critical > 0 ? 'red' : 'green', sub: critical > 0 ? 'Immediate review' : 'None' },
      { label: 'High Risk', value: high, color: high > 0 ? 'yellow' : 'green' },
      { label: 'Avg RPN', value: avgRPN != null ? avgRPN.toFixed(0) : 'No RPN data', color: 'purple' },
    ];
  }

  if (slug === 'audit-security') {
    const highRiskKeywords = ['delete', 'role_change', 'password', 'settings', 'permission'];
    const highRisk = rows.filter((r) =>
      highRiskKeywords.some((k) => String(r.action ?? '').toLowerCase().includes(k))
    ).length;
    const uniqueActors = new Set(
      rows.map((r) => {
        const p = r.profiles as { id?: string } | null;
        return p?.id ?? 'system';
      })
    ).size;
    return [
      { label: 'Total Events', value: rows.length, color: 'blue' },
      { label: 'High-Risk Events', value: highRisk, color: highRisk > 0 ? 'red' : 'green' },
      { label: 'Unique Actors', value: uniqueActors, color: 'purple' },
    ];
  }

  return [{ label: 'Records', value: rows.length, color: 'blue' }];
}

/* ── priority findings ────────────────────────────────────────────────────── */

type Finding = { severity: 'critical' | 'warning' | 'info'; finding: string };

function buildPriorityFindings(type: string, rows: Row[]): Finding[] {
  if (!rows.length) return [];
  const findings: Finding[] = [];

  if (['equipment', 'biomedical-operations', 'department-readiness', 'evaluation-demo'].includes(type)) {
    const nonFunctional = rows.filter((r) => r.condition === 'non_functional').length;
    const needsRepair = rows.filter((r) => r.condition === 'needs_repair').length;
    const functional = rows.filter((r) => r.condition === 'functional').length;
    const pct = Math.round((functional / rows.length) * 100);
    if (nonFunctional > 0) findings.push({ severity: 'critical', finding: `${nonFunctional} asset${nonFunctional > 1 ? 's' : ''} are non-functional and require immediate attention.` });
    if (needsRepair > 0) findings.push({ severity: 'warning', finding: `${needsRepair} asset${needsRepair > 1 ? 's' : ''} need repair.` });
    findings.push({ severity: pct >= 80 ? 'info' : 'warning', finding: `${pct}% of tracked assets are functional (${functional} of ${rows.length}).` });
  }

  if (type === 'pm-compliance') {
    const overdue = rows.filter((r) => r.status === 'overdue').length;
    const completed = rows.filter((r) => r.status === 'completed').length;
    const compliance = rows.length ? Math.round((completed / rows.length) * 100) : 0;
    if (overdue > 0) findings.push({ severity: 'critical', finding: `${overdue} PM task${overdue > 1 ? 's' : ''} are overdue and require scheduling.` });
    findings.push({ severity: compliance >= 80 ? 'info' : 'warning', finding: `Overall PM compliance is ${compliance}% (${completed} completed of ${rows.length} scheduled).` });
  }

  if (type === 'calibration-compliance') {
    const fail = rows.filter((r) => r.result === 'fail').length;
    const adjusted = rows.filter((r) => r.result === 'adjusted').length;
    const overdue = rows.filter((r) => r.next_due_date && new Date(String(r.next_due_date)) < new Date()).length;
    if (fail > 0) findings.push({ severity: 'critical', finding: `${fail} calibration${fail > 1 ? 's' : ''} failed. Immediate follow-up required.` });
    if (adjusted > 0) findings.push({ severity: 'warning', finding: `${adjusted} calibration${adjusted > 1 ? 's' : ''} required adjustment. Accuracy should be reviewed.` });
    if (overdue > 0) findings.push({ severity: 'warning', finding: `${overdue} asset${overdue > 1 ? 's' : ''} have passed their calibration due date.` });
    if (fail === 0 && adjusted === 0 && overdue === 0) findings.push({ severity: 'info', finding: 'No failed, adjusted, or overdue calibrations in this snapshot.' });
  }

  if (type === 'replacement-planning' || type === 'decision-support-methodology') {
    const strong = rows.filter((r) => Number(r.replacement_priority_index ?? 0) >= 0.7).length;
    const review = rows.filter((r) => {
      const rpi = Number(r.replacement_priority_index ?? 0);
      return rpi >= 0.55 && rpi < 0.7;
    }).length;
    if (strong > 0) findings.push({ severity: 'critical', finding: `${strong} asset${strong > 1 ? 's' : ''} meet the strong replacement threshold (RPI ≥ 0.70). BME Head review recommended.` });
    if (review > 0) findings.push({ severity: 'warning', finding: `${review} asset${review > 1 ? 's' : ''} are in the review zone (RPI 0.55–0.69).` });
    if (strong === 0 && review === 0) findings.push({ severity: 'info', finding: 'No assets exceed the replacement threshold in this snapshot. All are in the monitor category.' });
    findings.push({ severity: 'info', finding: 'Prototype thresholds: RPI ≥ 0.70 = strong candidate, 0.55–0.69 = review, <0.55 = monitor. Thresholds do not auto-approve replacement.' });
  }

  if (type === 'risk-fmea') {
    const critical = rows.filter((r) => r.risk_level === 'critical').length;
    const high = rows.filter((r) => r.risk_level === 'high').length;
    const top = rows.filter((r) => r.rpn != null).sort((a, b) => Number(b.rpn ?? 0) - Number(a.rpn ?? 0)).slice(0, 1);
    if (critical > 0) findings.push({ severity: 'critical', finding: `${critical} asset${critical > 1 ? 's' : ''} are classified as critical risk (RPN-based). Immediate FMEA review recommended.` });
    if (high > 0) findings.push({ severity: 'warning', finding: `${high} asset${high > 1 ? 's' : ''} are classified as high risk.` });
    if (top.length > 0) {
      const a = top[0].equipment_assets as { asset_code?: string; name?: string } | null;
      findings.push({ severity: 'info', finding: `Highest RPN: ${a?.asset_code ?? 'Unknown'} — ${a?.name ?? ''} (RPN: ${top[0].rpn}).` });
    }
  }

  if (type === 'spare-parts-stock') {
    const stockout = rows.filter((r) => Number(r.current_stock ?? 0) === 0).length;
    const lowStock = rows.filter((r) => {
      const s = Number(r.current_stock ?? 0);
      const rl = Number(r.reorder_level ?? 0);
      return s > 0 && s <= rl;
    }).length;
    if (stockout > 0) findings.push({ severity: 'critical', finding: `${stockout} part${stockout > 1 ? 's' : ''} are completely out of stock. Check for work-order blockers.` });
    if (lowStock > 0) findings.push({ severity: 'warning', finding: `${lowStock} part${lowStock > 1 ? 's' : ''} are at or below reorder level.` });
    if (stockout === 0 && lowStock === 0) findings.push({ severity: 'info', finding: 'All parts are above reorder level in this snapshot.' });
  }

  if (type === 'maintenance-performance') {
    const total = rows.length;
    const corrective = rows.filter((r) => String(r.event_type ?? '').includes('corrective') || String(r.event_type ?? '').includes('repair')).length;
    if (total === 0) return [];
    findings.push({ severity: 'info', finding: `${total} maintenance event${total > 1 ? 's' : ''} recorded. ${corrective > 0 ? `${corrective} corrective/repair events.` : ''}` });
  }

  return findings;
}

/* ── charts ───────────────────────────────────────────────────────────────── */

type ChartSpec = {
  title: string;
  description: string;
  type: 'doughnut' | 'bar' | 'hbar' | 'line';
  labels: string[];
  values: number[];
  colors?: string[];
  datasets?: { label: string; data: number[]; borderColor?: string }[];
};

function countBy(rows: Row[], keyFn: (r: Row) => string): [string, number][] {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = keyFn(row);
    if (key) counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function statusColor(label: string) {
  const l = label.toLowerCase();
  if (['completed', 'pass', 'functional', 'active', 'delivered', 'attended', 'certified', 'adequate'].some((k) => l.includes(k))) return 'rgb(34, 197, 94)';
  if (['fail', 'non_functional', 'overdue', 'rejected', 'canceled', 'critical', 'disposed', 'stockout'].some((k) => l.includes(k))) return 'rgb(239, 68, 68)';
  if (['adjusted', 'needs_repair', 'in_progress', 'pending', 'high', 'delayed', 'low stock'].some((k) => l.includes(k))) return 'rgb(234, 179, 8)';
  if (['approved', 'info', 'scheduled', 'ordered', 'in_transit', 'medium'].some((k) => l.includes(k))) return 'rgb(59, 130, 246)';
  return 'rgb(168, 85, 247)';
}

const PALETTE = ['rgb(37,99,235)', 'rgb(34,197,94)', 'rgb(234,179,8)', 'rgb(168,85,247)', 'rgb(239,68,68)', 'rgb(20,184,166)', 'rgb(249,115,22)', 'rgb(14,165,233)'];

function buildReportCharts(type: string, rows: Row[]): ChartSpec[] {
  if (!rows.length) return [];

  switch (type) {
    case 'equipment':
    case 'biomedical-operations':
    case 'department-readiness':
    case 'evaluation-demo': {
      const conditionCounts = countBy(rows, (r) => formatLabel(String(r.condition ?? r.status ?? 'unknown')));
      const deptCounts = countBy(rows, (r) => {
        const d = r.departments as { name?: string } | null;
        return d?.name ?? String(r.department ?? 'Unknown');
      }).slice(0, 10);
      const catCounts = countBy(rows, (r) => {
        const c = r.equipment_categories as { name?: string } | null;
        return c?.name ?? 'Unknown';
      }).slice(0, 8);
      const statusCounts = countBy(rows, (r) => formatLabel(String(r.status ?? 'unknown')));
      return [
        {
          title: 'Condition Distribution',
          description: 'Asset count by operational condition',
          type: 'doughnut',
          labels: conditionCounts.map(([l]) => l),
          values: conditionCounts.map(([, v]) => v),
          colors: conditionCounts.map(([l]) => statusColor(l.toLowerCase())),
        },
        {
          title: 'Assets per Department',
          description: 'Equipment count by hospital department',
          type: 'bar',
          labels: deptCounts.map(([l]) => l),
          values: deptCounts.map(([, v]) => v),
          colors: deptCounts.map(() => 'rgb(37,99,235)'),
        },
        {
          title: 'Assets by Category',
          description: 'Equipment count by equipment category',
          type: 'bar',
          labels: catCounts.map(([l]) => l),
          values: catCounts.map(([, v]) => v),
          colors: catCounts.map((_, i) => PALETTE[i % PALETTE.length]),
        },
        {
          title: 'Lifecycle Status',
          description: 'Assets grouped by lifecycle/registration status',
          type: 'doughnut',
          labels: statusCounts.map(([l]) => l),
          values: statusCounts.map(([, v]) => v),
          colors: statusCounts.map(([l]) => statusColor(l.toLowerCase())),
        },
      ];
    }

    case 'maintenance-performance': {
      const typeCounts = countBy(rows, (r) => formatLabel(String(r.event_type ?? 'maintenance')));
      const costByType = Object.fromEntries(
        Object.entries(
          rows.reduce<Record<string, number>>((acc, r) => {
            const key = formatLabel(String(r.event_type ?? 'maintenance'));
            acc[key] = (acc[key] ?? 0) + Number(r.service_cost ?? 0);
            return acc;
          }, {})
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
      );
      const monthCounts: Record<string, number> = {};
      for (const row of rows) {
        const d = row.completion_date ?? row.failure_date;
        if (d) {
          const dt = new Date(String(d));
          const key = `${dt.toLocaleString('default', { month: 'short' })} ${dt.getFullYear()}`;
          monthCounts[key] = (monthCounts[key] ?? 0) + 1;
        }
      }
      const monthEntries = Object.entries(monthCounts).slice(-8);
      return [
        {
          title: 'Events by Type',
          description: 'Maintenance event count by type',
          type: 'doughnut',
          labels: typeCounts.map(([l]) => l),
          values: typeCounts.map(([, v]) => v),
          colors: typeCounts.map((_, i) => PALETTE[i % PALETTE.length]),
        },
        {
          title: 'Service Cost by Event Type (ETB)',
          description: 'Cumulative service cost per event type',
          type: 'bar',
          labels: Object.keys(costByType),
          values: Object.values(costByType),
          colors: Object.keys(costByType).map(() => 'rgb(234,179,8)'),
        },
        ...(monthEntries.length > 1
          ? [
              {
                title: 'Monthly Maintenance Events',
                description: 'Event count trend over time',
                type: 'bar' as const,
                labels: monthEntries.map(([l]) => l),
                values: monthEntries.map(([, v]) => v),
                colors: monthEntries.map(() => 'rgb(249,115,22)'),
              },
            ]
          : []),
      ];
    }

    case 'pm-compliance': {
      const statusCounts = countBy(rows, (r) => formatLabel(String(r.status ?? 'unknown')));
      const assignedCount = rows.filter((r) => {
        const a = r.assigned_to_profile as { full_name?: string } | null;
        return a?.full_name;
      }).length;
      const deptCounts = countBy(rows, (r) => {
        const asset = r.equipment_assets as { departments?: { name?: string } } | null;
        const dept = asset?.departments as { name?: string } | null;
        return dept?.name ?? 'Unknown';
      }).slice(0, 8);
      return [
        {
          title: 'PM Status Distribution',
          description: 'PM schedule rows by status',
          type: 'doughnut',
          labels: statusCounts.map(([l]) => l),
          values: statusCounts.map(([, v]) => v),
          colors: statusCounts.map(([l]) => statusColor(l.toLowerCase())),
        },
        {
          title: 'Assignment Coverage',
          description: 'Assigned vs unassigned PM tasks',
          type: 'doughnut',
          labels: ['Assigned', 'Unassigned'],
          values: [assignedCount, rows.length - assignedCount],
          colors: ['rgb(34,197,94)', 'rgb(239,68,68)'],
        },
        ...(deptCounts.length > 1
          ? [
              {
                title: 'PM Tasks by Department',
                description: 'Scheduled PM tasks per department',
                type: 'bar' as const,
                labels: deptCounts.map(([l]) => l),
                values: deptCounts.map(([, v]) => v),
                colors: deptCounts.map(() => 'rgb(34,197,94)'),
              },
            ]
          : []),
      ];
    }

    case 'calibration-compliance': {
      const resultCounts = countBy(rows, (r) => formatLabel(String(r.result ?? 'unknown')));
      const typeCounts = countBy(rows, (r) => {
        const t = r.calibration_types as { name?: string } | null;
        return t?.name ?? 'General';
      }).slice(0, 8);
      const deptCounts = countBy(rows, (r) => {
        const asset = r.equipment_assets as { departments?: { name?: string } } | null;
        const dept = asset?.departments as { name?: string } | null;
        return dept?.name ?? 'Unknown';
      }).slice(0, 8);
      return [
        {
          title: 'Result Distribution',
          description: 'Calibration records by result (pass/fail/adjusted)',
          type: 'doughnut',
          labels: resultCounts.map(([l]) => l),
          values: resultCounts.map(([, v]) => v),
          colors: resultCounts.map(([l]) => statusColor(l.toLowerCase())),
        },
        {
          title: 'Records by Calibration Type',
          description: 'Count of records per calibration type',
          type: 'bar',
          labels: typeCounts.map(([l]) => l),
          values: typeCounts.map(([, v]) => v),
          colors: typeCounts.map(() => 'rgb(168,85,247)'),
        },
        ...(deptCounts.length > 1
          ? [
              {
                title: 'Calibrations by Department',
                description: 'Records grouped by equipment department',
                type: 'bar' as const,
                labels: deptCounts.map(([l]) => l),
                values: deptCounts.map(([, v]) => v),
                colors: deptCounts.map(() => 'rgb(14,165,233)'),
              },
            ]
          : []),
      ];
    }

    case 'work-orders':
    case 'technician-workload': {
      const statusCounts = countBy(rows, (r) => formatLabel(String(r.status ?? 'unknown')));
      const priorityCounts = countBy(rows, (r) => formatLabel(String(r.priority ?? 'unknown')));
      const techCounts = countBy(rows, (r) => {
        const profile = r.profiles as { full_name?: string } | null;
        return profile?.full_name ?? 'Unassigned';
      }).slice(0, 10);
      return [
        {
          title: 'Work Order Status',
          description: 'Work orders by execution status',
          type: 'doughnut',
          labels: statusCounts.map(([l]) => l),
          values: statusCounts.map(([, v]) => v),
          colors: statusCounts.map(([l]) => statusColor(l.toLowerCase())),
        },
        {
          title: 'Priority Distribution',
          description: 'Work orders by priority level',
          type: 'doughnut',
          labels: priorityCounts.map(([l]) => l),
          values: priorityCounts.map(([, v]) => v),
          colors: priorityCounts.map(([l]) => statusColor(l.toLowerCase())),
        },
        ...(techCounts.length > 1
          ? [
              {
                title: 'Work Orders by Technician',
                description: 'Assignment load per technician',
                type: 'hbar' as const,
                labels: techCounts.map(([l]) => l),
                values: techCounts.map(([, v]) => v),
                colors: techCounts.map(() => 'rgb(37,99,235)'),
              },
            ]
          : []),
      ];
    }

    case 'replacement-planning':
    case 'decision-support-methodology': {
      const top10 = [...rows]
        .filter((r) => r.replacement_priority_index != null)
        .sort((a, b) => Number(a.rank ?? 9999) - Number(b.rank ?? 9999))
        .slice(0, 10);
      const bandCounts = countBy(rows, (r) => {
        const rpi = Number(r.replacement_priority_index ?? 0);
        return rpi >= 0.7 ? 'Strong Candidate' : rpi >= 0.55 ? 'Review Candidate' : 'Monitor';
      });
      const deptCounts = countBy(rows, (r) => {
        const asset = r.equipment_assets as { departments?: { name?: string } } | null;
        const dept = asset?.departments as { name?: string } | null;
        return dept?.name ?? 'Unknown';
      }).slice(0, 8);
      return [
        {
          title: 'Top 10 Assets by RPI Score',
          description: 'Replacement priority index (%) for top 10 ranked assets',
          type: 'hbar',
          labels: top10.map((r) => {
            const a = r.equipment_assets as { asset_code?: string } | null;
            return a?.asset_code ?? String(r.asset_id ?? '').slice(0, 8);
          }),
          values: top10.map((r) => Math.round(Number(r.replacement_priority_index ?? 0) * 100)),
          colors: top10.map((r) => {
            const rpi = Number(r.replacement_priority_index ?? 0);
            return rpi >= 0.7 ? 'rgb(239,68,68)' : rpi >= 0.55 ? 'rgb(234,179,8)' : 'rgb(34,197,94)';
          }),
        },
        {
          title: 'Candidate Band Distribution',
          description: 'Assets by prototype replacement decision threshold',
          type: 'doughnut',
          labels: bandCounts.map(([l]) => l),
          values: bandCounts.map(([, v]) => v),
          colors: bandCounts.map(([l]) =>
            l === 'Strong Candidate' ? 'rgb(239,68,68)' : l === 'Review Candidate' ? 'rgb(234,179,8)' : 'rgb(34,197,94)'
          ),
        },
        ...(deptCounts.length > 1
          ? [
              {
                title: 'Replacement Candidates by Department',
                description: 'Distribution of assessed assets by department',
                type: 'bar' as const,
                labels: deptCounts.map(([l]) => l),
                values: deptCounts.map(([, v]) => v),
                colors: deptCounts.map(() => 'rgb(249,115,22)'),
              },
            ]
          : []),
      ];
    }

    case 'procurement-pipeline': {
      const statusCounts = countBy(rows, (r) => formatLabel(String(r.status ?? 'unknown')));
      const priorityCounts = countBy(rows, (r) => formatLabel(String(r.priority ?? 'unknown')));
      return [
        {
          title: 'Pipeline by Status',
          description: 'Procurement requests by pipeline stage',
          type: 'doughnut',
          labels: statusCounts.map(([l]) => l),
          values: statusCounts.map(([, v]) => v),
          colors: statusCounts.map(([l]) => statusColor(l.toLowerCase())),
        },
        {
          title: 'Requests by Priority',
          description: 'Count of procurement requests per priority level',
          type: 'bar',
          labels: priorityCounts.map(([l]) => l),
          values: priorityCounts.map(([, v]) => v),
          colors: priorityCounts.map(([l]) => statusColor(l.toLowerCase())),
        },
      ];
    }

    case 'spare-parts-stock': {
      const lowStockTop = [...rows]
        .filter((r) => Number(r.current_stock ?? 0) <= Number(r.reorder_level ?? 0))
        .sort((a, b) => Number(a.current_stock ?? 0) - Number(b.current_stock ?? 0))
        .slice(0, 10);
      const stockStatusCounts = countBy(rows, (r) => {
        const stock = Number(r.current_stock ?? 0);
        const reorder = Number(r.reorder_level ?? 0);
        return stock === 0 ? 'Stockout' : stock <= reorder ? 'Low Stock' : 'Adequate';
      });
      return [
        {
          title: 'Stock Health',
          description: 'Parts by stock status (stockout / low / adequate)',
          type: 'doughnut',
          labels: stockStatusCounts.map(([l]) => l),
          values: stockStatusCounts.map(([, v]) => v),
          colors: stockStatusCounts.map(([l]) =>
            l === 'Stockout' ? 'rgb(239,68,68)' : l === 'Low Stock' ? 'rgb(234,179,8)' : 'rgb(34,197,94)'
          ),
        },
        ...(lowStockTop.length > 0
          ? [
              {
                title: 'Top Low-Stock Parts',
                description: 'Current stock level for parts at or below reorder level',
                type: 'hbar' as const,
                labels: lowStockTop.map((r) => String(r.name ?? r.part_code ?? '').slice(0, 24)),
                values: lowStockTop.map((r) => Number(r.current_stock ?? 0)),
                colors: lowStockTop.map((r) =>
                  Number(r.current_stock ?? 0) === 0 ? 'rgb(239,68,68)' : 'rgb(234,179,8)'
                ),
              },
            ]
          : []),
      ];
    }

    case 'disposal-lifecycle': {
      const statusCounts = countBy(rows, (r) => formatLabel(String(r.status ?? 'unknown')));
      const methodCounts = countBy(rows, (r) =>
        formatLabel(String(r.disposal_method_proposed ?? r.disposal_method ?? 'unknown'))
      );
      return [
        {
          title: 'Disposal Status',
          description: 'Disposal requests by current approval status',
          type: 'doughnut',
          labels: statusCounts.map(([l]) => l),
          values: statusCounts.map(([, v]) => v),
          colors: statusCounts.map(([l]) => statusColor(l.toLowerCase())),
        },
        {
          title: 'Proposed Disposal Method',
          description: 'Breakdown of disposal approach by method type',
          type: 'doughnut',
          labels: methodCounts.map(([l]) => l),
          values: methodCounts.map(([, v]) => v),
          colors: methodCounts.map((_, i) => PALETTE[i % PALETTE.length]),
        },
      ];
    }

    case 'training-competency': {
      const typeCounts = countBy(rows, (r) => {
        const cat = r.equipment_categories as { name?: string } | null;
        return cat?.name ?? 'General Training';
      });
      const monthCounts: Record<string, number> = {};
      for (const row of rows) {
        if (row.training_date) {
          const d = new Date(String(row.training_date));
          const key = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
          monthCounts[key] = (monthCounts[key] ?? 0) + 1;
        }
      }
      const monthEntries = Object.entries(monthCounts).slice(-8);
      return [
        {
          title: 'Sessions by Equipment Category',
          description: 'Training sessions linked to equipment category',
          type: 'doughnut',
          labels: typeCounts.slice(0, 6).map(([l]) => l),
          values: typeCounts.slice(0, 6).map(([, v]) => v),
          colors: typeCounts.slice(0, 6).map((_, i) => PALETTE[i % PALETTE.length]),
        },
        ...(monthEntries.length > 1
          ? [
              {
                title: 'Sessions per Month',
                description: 'Training session count by calendar month',
                type: 'bar' as const,
                labels: monthEntries.map(([l]) => l),
                values: monthEntries.map(([, v]) => v),
                colors: monthEntries.map(() => 'rgb(37,99,235)'),
              },
            ]
          : []),
      ];
    }

    case 'risk-fmea': {
      const bandCounts = countBy(rows, (r) => formatLabel(String(r.risk_level ?? 'unknown')));
      const top10 = [...rows]
        .filter((r) => r.rpn != null)
        .sort((a, b) => Number(b.rpn ?? 0) - Number(a.rpn ?? 0))
        .slice(0, 10);
      const deptCounts = countBy(rows, (r) => {
        const asset = r.equipment_assets as { departments?: { name?: string } } | null;
        const dept = asset?.departments as { name?: string } | null;
        return dept?.name ?? 'Unknown';
      }).slice(0, 8);
      return [
        {
          title: 'Risk Band Distribution',
          description: 'Assets by FMEA risk classification',
          type: 'doughnut',
          labels: bandCounts.map(([l]) => l),
          values: bandCounts.map(([, v]) => v),
          colors: bandCounts.map(([l]) => statusColor(l.toLowerCase())),
        },
        ...(top10.length > 0
          ? [
              {
                title: 'Top 10 Assets by RPN',
                description: 'Highest Risk Priority Number assets',
                type: 'hbar' as const,
                labels: top10.map((r) => {
                  const a = r.equipment_assets as { asset_code?: string } | null;
                  return a?.asset_code ?? String(r.asset_id ?? '').slice(0, 8);
                }),
                values: top10.map((r) => Number(r.rpn ?? 0)),
                colors: top10.map((r) =>
                  Number(r.rpn ?? 0) >= 100 ? 'rgb(239,68,68)' : Number(r.rpn ?? 0) >= 60 ? 'rgb(234,179,8)' : 'rgb(34,197,94)'
                ),
              },
            ]
          : []),
        ...(deptCounts.length > 1
          ? [
              {
                title: 'Risk Distribution by Department',
                description: 'Number of risk-scored assets per department',
                type: 'bar' as const,
                labels: deptCounts.map(([l]) => l),
                values: deptCounts.map(([, v]) => v),
                colors: deptCounts.map(() => 'rgb(239,68,68)'),
              },
            ]
          : []),
      ];
    }

    case 'audit-security': {
      const actionCounts = countBy(rows, (r) => String(r.action ?? 'unknown').split('.')[0]).slice(0, 8);
      const entityCounts = countBy(rows, (r) => formatLabel(String(r.entity_type ?? 'unknown'))).slice(0, 8);
      return [
        {
          title: 'Events by Module',
          description: 'Audit events grouped by top-level action category',
          type: 'bar',
          labels: actionCounts.map(([l]) => formatLabel(l)),
          values: actionCounts.map(([, v]) => v),
          colors: actionCounts.map(() => 'rgb(168,85,247)'),
        },
        {
          title: 'Events by Entity Type',
          description: 'Audit trail distribution across entity types',
          type: 'doughnut',
          labels: entityCounts.map(([l]) => l),
          values: entityCounts.map(([, v]) => v),
          colors: entityCounts.map((_, i) => PALETTE[i % PALETTE.length]),
        },
      ];
    }

    default:
      return [];
  }
}

/* ── executive summary ────────────────────────────────────────────────────── */

function buildExecutiveSummary(type: string, rows: Row[]): string {
  if (!rows.length) return 'No data is available in this snapshot for the selected filters.';

  if (['equipment', 'biomedical-operations'].includes(type)) {
    const functional = rows.filter((r) => r.condition === 'functional').length;
    const needsRepair = rows.filter((r) => r.condition === 'needs_repair').length;
    const nonFunctional = rows.filter((r) => r.condition === 'non_functional').length;
    return `This snapshot covers ${rows.length} registered equipment assets. ${functional} are functional (${Math.round((functional / rows.length) * 100)}%), ${needsRepair} need repair, and ${nonFunctional} are non-functional. Department and category breakdowns are shown in the charts below.`;
  }

  if (type === 'department-readiness') {
    const functional = rows.filter((r) => r.condition === 'functional').length;
    return `This snapshot covers ${rows.length} assets across hospital departments. ${functional} are functional. Department readiness charts below show the distribution and condition of equipment by service area.`;
  }

  if (type === 'evaluation-demo') {
    return `This evaluation snapshot covers ${rows.length} active equipment assets demonstrating the BMERMS inventory management capability. The system supports condition tracking, risk analysis, PM compliance, calibration, procurement, and training modules across all hospital departments.`;
  }

  if (type === 'maintenance-performance') {
    const totalCost = rows.reduce((acc, r) => acc + Number(r.service_cost ?? 0), 0);
    const withHours = rows.filter((r) => r.repair_duration_hours != null);
    const avgHours = withHours.length ? (withHours.reduce((acc, r) => acc + Number(r.repair_duration_hours ?? 0), 0) / withHours.length).toFixed(1) : null;
    return `This maintenance evidence snapshot contains ${rows.length} maintenance events. ${avgHours ? `Average repair duration is ${avgHours} hours.` : ''} ${totalCost > 0 ? `Total service cost: ETB ${totalCost.toLocaleString()}.` : ''} Event types and cost distribution are shown below.`;
  }

  if (type === 'pm-compliance') {
    const completed = rows.filter((r) => r.status === 'completed').length;
    const overdue = rows.filter((r) => r.status === 'overdue').length;
    const compliance = rows.length ? Math.round((completed / rows.length) * 100) : 0;
    return `This PM compliance snapshot contains ${rows.length} scheduled PM task rows. ${completed} are completed (${compliance}% compliance), ${overdue} are overdue. Completed evidence counts as PM compliance; skipped/deferred rows are tracked separately.`;
  }

  if (type === 'calibration-compliance') {
    const pass = rows.filter((r) => r.result === 'pass').length;
    const fail = rows.filter((r) => r.result === 'fail').length;
    const adjusted = rows.filter((r) => r.result === 'adjusted').length;
    return `This calibration snapshot contains ${rows.length} calibration records. ${pass} passed, ${fail} failed, ${adjusted} required adjustment. Failed and adjusted results remain as evidence for safety follow-up.`;
  }

  if (type === 'replacement-planning' || type === 'decision-support-methodology') {
    const strong = rows.filter((r) => Number(r.replacement_priority_index ?? 0) >= 0.7).length;
    const review = rows.filter((r) => { const rpi = Number(r.replacement_priority_index ?? 0); return rpi >= 0.55 && rpi < 0.7; }).length;
    if (strong === 0 && review === 0) return `This replacement planning snapshot ranks ${rows.length} assets by RPI. No assets exceed the replacement threshold (0.70). All are in the monitor category (<0.55). Showing top-ranked assets for lifecycle review.`;
    return `This replacement planning snapshot ranks ${rows.length} assets. ${strong} meet the strong replacement threshold (RPI ≥ 0.70) and ${review} are in the review zone (0.55–0.69). These are prototype decision thresholds — they support BME Head review and do not auto-approve replacement.`;
  }

  if (type === 'procurement-pipeline') {
    const delivered = rows.filter((r) => r.status === 'delivered').length;
    const active = rows.filter((r) => !['delivered', 'canceled'].includes(String(r.status ?? ''))).length;
    return `This procurement snapshot contains ${rows.length} requests. ${active} are active in the pipeline and ${delivered} have been delivered.`;
  }

  if (type === 'spare-parts-stock') {
    const stockout = rows.filter((r) => Number(r.current_stock ?? 0) === 0).length;
    const lowStock = rows.filter((r) => { const s = Number(r.current_stock ?? 0); const rl = Number(r.reorder_level ?? 0); return s > 0 && s <= rl; }).length;
    return `This stock snapshot covers ${rows.length} spare parts. ${stockout > 0 ? `${stockout} part${stockout > 1 ? 's' : ''} are out of stock.` : 'No stockouts.'} ${lowStock > 0 ? `${lowStock} part${lowStock > 1 ? 's' : ''} are below reorder level.` : 'All other parts are above reorder level.'}`;
  }

  if (type === 'risk-fmea') {
    const critical = rows.filter((r) => r.risk_level === 'critical').length;
    const high = rows.filter((r) => r.risk_level === 'high').length;
    return `This FMEA snapshot covers ${rows.length} risk-scored assets. ${critical} are classified as critical risk and ${high} as high risk based on RPN = Severity × Occurrence × Detectability.`;
  }

  if (type === 'audit-security') {
    return `This audit snapshot contains ${rows.length} audit events covering role changes, settings, equipment, and workflow actions for governance and traceability evidence.`;
  }

  return `This report contains ${rows.length} operational evidence rows from the source tables used by BMERMS workflows.`;
}

/* ── methodology ──────────────────────────────────────────────────────────── */

function methodologyFor(type: string): string {
  if (['pm-compliance'].includes(type)) return 'PM compliance evidence comes from generated pm_schedule rows. Completed schedules count as completed evidence. Skipped, deferred, and overdue rows remain visible for audit. PM Compliance = completed ÷ total scheduled × 100.';
  if (['calibration-compliance'].includes(type)) return 'Calibration compliance uses calibration_records, result status, and next_due_date. Failed and adjusted results remain as evidence for follow-up work. Overdue detection compares next_due_date to the snapshot generation time.';
  if (['replacement-planning', 'decision-support-methodology'].includes(type)) return 'Replacement planning uses RPI = Σ(wⱼ × sᵢⱼ) where components are age, failure history, availability, maintenance burden, spare-part support, and FMEA risk score. Component scores are min-max normalized. Thresholds: ≥0.70 strong candidate, 0.55–0.69 review, <0.55 monitor. These are prototype thresholds for demonstration and sensitivity testing.';
  if (['risk-fmea'].includes(type)) return 'FMEA reporting uses RPN = Severity × Occurrence × Detectability (each 1–10). Risk bands: RPN ≥ 100 = critical, 60–99 = high, 30–59 = medium, <30 = low. Assignment method (seed/computed/override) and explanation are included for traceability.';
  if (['procurement-pipeline'].includes(type)) return 'Procurement evidence follows each request through requested → approved → ordered → in_transit → delivered → canceled stages. Priority, expected delivery, delay, and contextual justification are preserved for each row.';
  if (['maintenance-performance'].includes(type)) return 'Maintenance events come from maintenance_events joined to equipment_assets. MTTR = total repair hours ÷ completed repairs. MTBF = operational time ÷ failure count. These values require failure date and repair duration data to be recorded accurately.';
  if (['audit-security'].includes(type)) return 'Audit events are recorded in audit_logs for all significant system actions including logins, equipment updates, work order completions, role changes, and settings modifications. Events are sorted by timestamp descending.';
  if (['biomedical-operations', 'department-readiness', 'evaluation-demo', 'equipment'].includes(type)) return 'Equipment data comes from equipment_assets joined to departments, equipment_categories, manufacturers, and equipment_models. Condition reflects the latest operational state. Deleted assets (deleted_at IS NOT NULL) are excluded.';
  return 'Rows come from the operational source tables for this module. Filters narrow evidence; exports use the same filtered row set shown on screen.';
}

/* ── report configs ───────────────────────────────────────────────────────── */

function getReportConfig(type: string): ReportConfig | null {
  switch (type) {
    case 'biomedical-operations':
      return {
        title: 'Biomedical Engineering Operations Report',
        description: 'Unified executive snapshot: equipment condition, department readiness, compliance, risk, and critical actions.',
        methodologyNote: methodologyFor('biomedical-operations'),
        filterDefs: ['department', 'category'],
        fetchData: reportsService.getEquipmentReport,
        columns: [
          { key: 'asset_code', header: 'Asset Code', sortable: true },
          { key: 'name', header: 'Name', sortable: true },
          { key: 'serial_number', header: 'Serial #' },
          { key: 'department', header: 'Department', render: (row: Row) => { const d = row.departments as { name: string } | null; return d?.name || '—'; } },
          { key: 'category', header: 'Category', render: (row: Row) => { const c = row.equipment_categories as { name: string } | null; return c?.name || '—'; } },
          { key: 'condition', header: 'Condition', render: (row: Row) => <Badge variant={statusVariant[row.condition as string] || 'default'}>{formatLabel(String(row.condition ?? ''))}</Badge> },
          { key: 'status', header: 'Status', render: (row: Row) => <Badge variant={statusVariant[row.status as string] || 'default'}>{formatLabel(String(row.status ?? ''))}</Badge> },
          { key: 'purchase_cost', header: 'Purchase Cost (ETB)', render: (row: Row) => row.purchase_cost != null ? `${(row.purchase_cost as number).toLocaleString()}` : '—' },
        ],
      };

    case 'evaluation-demo':
      return {
        title: 'Evaluation / Demo Evidence Report',
        description: 'System capability evidence: implemented modules, workflow coverage, decision-support scores, and data health.',
        methodologyNote: methodologyFor('evaluation-demo'),
        filterDefs: ['department', 'category'],
        fetchData: reportsService.getEquipmentReport,
        columns: [
          { key: 'asset_code', header: 'Asset Code', sortable: true },
          { key: 'name', header: 'Name', sortable: true },
          { key: 'department', header: 'Department', render: (row: Row) => { const d = row.departments as { name: string } | null; return d?.name || '—'; } },
          { key: 'category', header: 'Category', render: (row: Row) => { const c = row.equipment_categories as { name: string } | null; return c?.name || '—'; } },
          { key: 'condition', header: 'Condition', render: (row: Row) => <Badge variant={statusVariant[row.condition as string] || 'default'}>{formatLabel(String(row.condition ?? ''))}</Badge> },
          { key: 'status', header: 'Status', render: (row: Row) => <Badge variant={statusVariant[row.status as string] || 'default'}>{formatLabel(String(row.status ?? ''))}</Badge> },
          { key: 'installation_date', header: 'Installed', render: (row: Row) => row.installation_date ? new Date(row.installation_date as string).toLocaleDateString() : '—' },
        ],
      };

    case 'department-readiness':
      return {
        title: 'Department Readiness Report',
        description: 'Equipment readiness by hospital department: essential asset availability, condition, and risk exposure.',
        methodologyNote: methodologyFor('department-readiness'),
        filterDefs: ['department', 'category'],
        fetchData: reportsService.getEquipmentReport,
        columns: [
          { key: 'asset_code', header: 'Asset Code', sortable: true },
          { key: 'name', header: 'Name', sortable: true },
          { key: 'department', header: 'Department', render: (row: Row) => { const d = row.departments as { name: string } | null; return d?.name || '—'; } },
          { key: 'condition', header: 'Condition', render: (row: Row) => <Badge variant={statusVariant[row.condition as string] || 'default'}>{formatLabel(String(row.condition ?? ''))}</Badge> },
          { key: 'category', header: 'Category', render: (row: Row) => { const c = row.equipment_categories as { name: string } | null; return c?.name || '—'; } },
        ],
      };

    case 'decision-support-methodology':
      return {
        title: 'Decision-Support Methodology Report',
        description: 'Formulas, scoring criteria, component weights, source tables, and explainability evidence for thesis review.',
        methodologyNote: methodologyFor('decision-support-methodology'),
        filterDefs: [],
        fetchData: () => reportsService.getReplacementReport(),
        columns: [
          { key: 'rank', header: 'Rank', sortable: true },
          { key: 'asset', header: 'Asset', render: (row: Row) => { const a = row.equipment_assets as { asset_code: string; name: string } | null; return a ? `${a.asset_code} — ${a.name}` : '—'; } },
          { key: 'replacement_priority_index', header: 'RPI Score', render: (row: Row) => row.replacement_priority_index == null ? '—' : `${Math.round(Number(row.replacement_priority_index) * 100)}/100` },
          { key: 'failure_score', header: 'Failure (S₁)' },
          { key: 'availability_score', header: 'Availability (S₂)' },
          { key: 'maintenance_burden_score', header: 'Maint. Burden (S₃)' },
          { key: 'spare_part_score', header: 'Spare Support (S₄)' },
          { key: 'risk_score', header: 'Risk (S₅)' },
          { key: 'justification', header: 'Generated Justification' },
        ],
      };

    case 'equipment':
      return {
        title: 'Inventory and Asset Condition Report',
        description: 'Complete asset inventory with department, category, condition, cost, warranty status, and installation date.',
        methodologyNote: methodologyFor('equipment'),
        filterDefs: ['department', 'category', 'status'],
        fetchData: reportsService.getEquipmentReport,
        columns: [
          { key: 'asset_code', header: 'Asset Code', sortable: true },
          { key: 'name', header: 'Name', sortable: true },
          { key: 'serial_number', header: 'Serial #' },
          { key: 'department', header: 'Department', render: (row: Row) => { const d = row.departments as { name: string } | null; return d?.name || '—'; } },
          { key: 'category', header: 'Category', render: (row: Row) => { const c = row.equipment_categories as { name: string } | null; return c?.name || '—'; } },
          { key: 'condition', header: 'Condition', render: (row: Row) => <Badge variant={statusVariant[row.condition as string] || 'default'}>{formatLabel(String(row.condition ?? ''))}</Badge> },
          { key: 'status', header: 'Status', render: (row: Row) => <Badge variant={statusVariant[row.status as string] || 'default'}>{formatLabel(String(row.status ?? ''))}</Badge> },
          { key: 'installation_date', header: 'Installed', render: (row: Row) => row.installation_date ? new Date(row.installation_date as string).toLocaleDateString() : '—' },
          { key: 'purchase_cost', header: 'Purchase Cost (ETB)', render: (row: Row) => row.purchase_cost != null ? `${(row.purchase_cost as number).toLocaleString()}` : '—' },
        ],
      };

    case 'maintenance-performance':
      return {
        title: 'Maintenance Performance Report',
        description: 'Maintenance events, MTTR, repair costs, recurring failures, and corrective maintenance reliability evidence.',
        methodologyNote: methodologyFor('maintenance-performance'),
        filterDefs: ['date_range'],
        fetchData: reportsService.getMaintenanceReport,
        columns: [
          { key: 'asset', header: 'Asset', render: (row: Row) => { const a = row.equipment_assets as { asset_code: string; name: string } | null; return a ? `${a.asset_code} — ${a.name}` : '—'; } },
          { key: 'event_type', header: 'Type', render: (row: Row) => <Badge variant="info">{formatLabel(String(row.event_type ?? ''))}</Badge> },
          { key: 'failure_date', header: 'Failure Date', sortable: true, render: (row: Row) => row.failure_date ? new Date(row.failure_date as string).toLocaleDateString() : '—' },
          { key: 'repair_duration_hours', header: 'Repair Hours', render: (row: Row) => row.repair_duration_hours != null ? `${row.repair_duration_hours}h` : '—' },
          { key: 'action_taken', header: 'Action Taken' },
          { key: 'service_cost', header: 'Cost (ETB)', render: (row: Row) => row.service_cost != null ? `${(row.service_cost as number).toFixed(2)}` : '—' },
          { key: 'completion_date', header: 'Completed', sortable: true, render: (row: Row) => row.completion_date ? new Date(row.completion_date as string).toLocaleDateString() : '—' },
        ],
      };

    case 'pm-compliance':
      return {
        title: 'PM Compliance Report',
        description: 'PM schedules, completion status, overdue tasks, skipped/deferred evidence, and department-level compliance.',
        methodologyNote: methodologyFor('pm-compliance'),
        filterDefs: ['status', 'date_range'],
        fetchData: reportsService.getPMReport,
        columns: [
          { key: 'asset', header: 'Asset', render: (row: Row) => { const a = row.equipment_assets as { asset_code: string; name: string } | null; return a ? `${a.asset_code} — ${a.name}` : '—'; } },
          { key: 'plan', header: 'PM Plan', render: (row: Row) => { const p = row.pm_plans as { name: string } | null; return p?.name || '—'; } },
          { key: 'scheduled_date', header: 'Scheduled', sortable: true, render: (row: Row) => new Date(row.scheduled_date as string).toLocaleDateString() },
          { key: 'status', header: 'Status', render: (row: Row) => <Badge variant={statusVariant[row.status as string] || 'default'}>{formatLabel(String(row.status ?? ''))}</Badge> },
          { key: 'assigned_to', header: 'Assigned To', render: (row: Row) => { const rel = row.assigned_to_profile as { full_name: string } | { full_name: string }[] | null; const p = Array.isArray(rel) ? rel[0] : rel; return p?.full_name || '—'; } },
        ],
      };

    case 'calibration-compliance':
      return {
        title: 'Calibration Compliance Report',
        description: 'Calibration records, pass/fail/adjusted results, next due dates, overdue assets, and safety follow-up evidence.',
        methodologyNote: methodologyFor('calibration-compliance'),
        filterDefs: ['date_range'],
        fetchData: reportsService.getCalibrationReport,
        columns: [
          { key: 'asset', header: 'Asset', render: (row: Row) => { const a = row.equipment_assets as { asset_code: string; name: string } | null; return a ? `${a.asset_code} — ${a.name}` : '—'; } },
          { key: 'type', header: 'Type', render: (row: Row) => { const t = row.calibration_types as { name: string } | null; return t?.name || '—'; } },
          { key: 'calibration_date', header: 'Date', sortable: true, render: (row: Row) => new Date(row.calibration_date as string).toLocaleDateString() },
          { key: 'result', header: 'Result', render: (row: Row) => <Badge variant={resultVariant[row.result as string] || 'default'}>{formatLabel(String(row.result ?? ''))}</Badge> },
          { key: 'next_due_date', header: 'Next Due', sortable: true, render: (row: Row) => row.next_due_date ? new Date(row.next_due_date as string).toLocaleDateString() : '—' },
          { key: 'calibrated_by', header: 'Calibrated By' },
        ],
      };

    case 'training-competency':
      return {
        title: 'Training and Equipment Safety Report',
        description: 'Training sessions, pending requests, attendees, equipment category linkage, and competency evidence.',
        methodologyNote: 'Training data comes from training_sessions joined to equipment_categories and staff_training_records for attendance. Attendance count reflects linked staff_training_record rows.',
        filterDefs: ['category', 'date_range'],
        fetchData: reportsService.getTrainingReport,
        columns: [
          { key: 'title', header: 'Session', sortable: true },
          { key: 'trainer', header: 'Trainer' },
          { key: 'training_date', header: 'Date', sortable: true, render: (row: Row) => new Date(row.training_date as string).toLocaleDateString() },
          { key: 'duration_hours', header: 'Duration', render: (row: Row) => row.duration_hours ? `${row.duration_hours}h` : '—' },
          { key: 'attendees', header: 'Attendees', render: (row: Row) => { const r = row.staff_training_records as unknown[]; return Array.isArray(r) ? r.length : 0; } },
          { key: 'location', header: 'Location' },
        ],
      };

    case 'spare-parts-stock':
      return {
        title: 'Spare Parts and Stock Control Report',
        description: 'Part inventory, stockout alerts, low-stock items, procurement recovery status, and work-order blockers.',
        methodologyNote: 'Spare parts data comes from spare_parts. Stock status is derived by comparing current_stock to reorder_level. Stockout = current_stock = 0; low stock = current_stock > 0 and ≤ reorder_level.',
        filterDefs: ['category'],
        fetchData: reportsService.getSparePartsReport,
        columns: [
          { key: 'part_code', header: 'Part Code', sortable: true },
          { key: 'name', header: 'Name', sortable: true },
          { key: 'category', header: 'Category' },
          { key: 'current_stock', header: 'Stock', sortable: true },
          { key: 'reorder_level', header: 'Reorder Level' },
          { key: 'unit_cost', header: 'Unit Cost (ETB)', render: (row: Row) => row.unit_cost != null ? `${(row.unit_cost as number).toFixed(2)}` : '—' },
          { key: 'stock_value', header: 'Stock Value (ETB)', render: (row: Row) => { const s = row.current_stock as number; const c = row.unit_cost as number | null; return c != null ? `${(s * c).toFixed(2)}` : '—'; } },
        ],
      };

    case 'disposal-lifecycle':
      return {
        title: 'Disposal / Lifecycle Report',
        description: 'Disposal requests, approvals, disposal methods, completed disposals, and end-of-life evidence.',
        methodologyNote: 'Disposal data comes from disposal_requests joined to equipment_assets and disposed_assets. Disposal status tracks the formal request workflow. Completed disposal records the method, value, and disposal authority.',
        filterDefs: ['status', 'date_range'],
        fetchData: reportsService.getDisposalReport,
        columns: [
          { key: 'request_number', header: 'Request #', sortable: true },
          { key: 'asset', header: 'Asset', render: (row: Row) => { const a = row.equipment_assets as { asset_code: string; name: string } | null; return a ? `${a.asset_code} — ${a.name}` : '—'; } },
          { key: 'disposal_method_proposed', header: 'Method', render: (row: Row) => row.disposal_method_proposed ? formatLabel(row.disposal_method_proposed as string) : '—' },
          { key: 'status', header: 'Status', render: (row: Row) => <Badge variant={statusVariant[row.status as string] || 'default'}>{formatLabel(String(row.status ?? ''))}</Badge> },
          { key: 'disposal_value', header: 'Value (ETB)', render: (row: Row) => { const d = row.disposed_assets as { disposal_value: number }[] | null; const v = d?.[0]?.disposal_value; return v != null ? `${v.toFixed(2)}` : '—'; } },
          { key: 'created_at', header: 'Date', sortable: true, render: (row: Row) => new Date(row.created_at as string).toLocaleDateString() },
        ],
      };

    case 'work-orders':
      return {
        title: 'Work Order Execution Report',
        description: 'Open, assigned, in-progress, on-hold, and completed work orders with outcome, technician, and evidence trace.',
        methodologyNote: 'Work order data comes from work_orders joined to equipment_assets, profiles (assigned technician), and maintenance_requests (originating request). Completion outcome and final equipment condition are recorded at work order close.',
        filterDefs: ['status', 'date_range'],
        fetchData: reportsService.getWorkOrderReport,
        columns: [
          { key: 'work_order_number', header: 'WO #', sortable: true },
          { key: 'asset', header: 'Asset', render: (row: Row) => { const a = row.equipment_assets as { asset_code: string; name: string } | null; return a ? `${a.asset_code} — ${a.name}` : '—'; } },
          { key: 'priority', header: 'Priority', render: (row: Row) => <Badge variant={row.priority === 'critical' ? 'error' : row.priority === 'high' ? 'warning' : 'info'}>{formatLabel(String(row.priority ?? ''))}</Badge> },
          { key: 'status', header: 'Status', render: (row: Row) => <Badge variant={statusVariant[row.status as string] || 'default'}>{formatLabel(String(row.status ?? ''))}</Badge> },
          { key: 'assigned_to', header: 'Assigned To', render: (row: Row) => { const p = row.profiles as { full_name?: string } | null; return p?.full_name ?? 'Unassigned'; } },
          { key: 'created_at', header: 'Created', sortable: true, render: (row: Row) => new Date(row.created_at as string).toLocaleDateString() },
          { key: 'completed_at', header: 'Completed', render: (row: Row) => row.completed_at ? new Date(row.completed_at as string).toLocaleDateString() : '—' },
        ],
      };

    case 'procurement-pipeline':
      return {
        title: 'Procurement Pipeline Report',
        description: 'Procurement requests across all pipeline stages, delays, priority, and delivery evidence.',
        methodologyNote: methodologyFor('procurement-pipeline'),
        filterDefs: ['status', 'date_range'],
        fetchData: reportsService.getProcurementReport,
        columns: [
          { key: 'request_number', header: 'Request #', sortable: true },
          { key: 'title', header: 'Title', sortable: true },
          { key: 'priority', header: 'Priority', render: (row: Row) => <Badge variant={row.priority === 'critical' ? 'error' : row.priority === 'high' ? 'warning' : 'info'}>{formatLabel(String(row.priority ?? ''))}</Badge> },
          { key: 'status', header: 'Status', render: (row: Row) => <Badge variant="purple">{formatLabel(String(row.status ?? ''))}</Badge> },
          { key: 'expected_delivery_date', header: 'Expected Delivery', render: (row: Row) => row.expected_delivery_date ? new Date(row.expected_delivery_date as string).toLocaleDateString() : 'TBD' },
          { key: 'justification', header: 'Justification' },
        ],
      };

    case 'replacement-planning':
      return {
        title: 'Replacement Planning Report',
        description: 'RPI rankings, component scores, lifecycle drivers, and prototype decision thresholds.',
        methodologyNote: methodologyFor('replacement-planning'),
        filterDefs: [],
        fetchData: () => reportsService.getReplacementReport(),
        columns: [
          { key: 'rank', header: 'Rank', sortable: true },
          { key: 'asset', header: 'Asset', render: (row: Row) => { const a = row.equipment_assets as { asset_code: string; name: string } | null; return a ? `${a.asset_code} — ${a.name}` : '—'; } },
          { key: 'replacement_priority_index', header: 'RPI', render: (row: Row) => row.replacement_priority_index == null ? '—' : `${Math.round(Number(row.replacement_priority_index) * 100)}/100` },
          { key: 'failure_score', header: 'Failure' },
          { key: 'availability_score', header: 'Availability' },
          { key: 'maintenance_burden_score', header: 'Maintenance' },
          { key: 'spare_part_score', header: 'Spare Support' },
          { key: 'risk_score', header: 'Risk' },
          { key: 'justification', header: 'Justification' },
        ],
      };

    case 'risk-fmea':
      return {
        title: 'Risk and FMEA Report',
        description: 'RPN scores, severity, occurrence, detectability, risk bands, and risk driver explanations.',
        methodologyNote: methodologyFor('risk-fmea'),
        filterDefs: [],
        fetchData: () => reportsService.getRiskFmeaReport(),
        columns: [
          { key: 'asset', header: 'Asset', render: (row: Row) => { const a = row.equipment_assets as { asset_code: string; name: string } | null; return a ? `${a.asset_code} — ${a.name}` : '—'; } },
          { key: 'severity', header: 'S', sortable: true },
          { key: 'occurrence', header: 'O', sortable: true },
          { key: 'detectability', header: 'D', sortable: true },
          { key: 'rpn', header: 'RPN', sortable: true },
          { key: 'risk_level', header: 'Risk Band', render: (row: Row) => <Badge variant={statusVariant[row.risk_level as string] || 'default'}>{formatLabel(String(row.risk_level ?? ''))}</Badge> },
          { key: 'assignment_method', header: 'Method' },
          { key: 'explanation', header: 'Explanation' },
        ],
      };

    case 'technician-workload':
      return {
        title: 'Technician Workload Report',
        description: 'Assignment load by technician, completion evidence, critical task distribution, and workload balance.',
        methodologyNote: 'Work order data comes from work_orders joined to profiles (assigned technician) and equipment_assets. Unassigned work orders are included. Completed work orders show outcome evidence.',
        filterDefs: ['status', 'date_range'],
        fetchData: reportsService.getWorkOrderReport,
        columns: [
          { key: 'work_order_number', header: 'WO #', sortable: true },
          { key: 'asset', header: 'Asset', render: (row: Row) => { const a = row.equipment_assets as { asset_code: string; name: string } | null; return a ? `${a.asset_code} — ${a.name}` : '—'; } },
          { key: 'assigned_to', header: 'Technician', render: (row: Row) => { const p = row.profiles as { full_name?: string } | null; return p?.full_name ?? 'Unassigned'; } },
          { key: 'priority', header: 'Priority', render: (row: Row) => <Badge variant={row.priority === 'critical' ? 'error' : row.priority === 'high' ? 'warning' : 'info'}>{formatLabel(String(row.priority ?? ''))}</Badge> },
          { key: 'status', header: 'Status', render: (row: Row) => <Badge variant={statusVariant[row.status as string] || 'default'}>{formatLabel(String(row.status ?? ''))}</Badge> },
          { key: 'created_at', header: 'Created', sortable: true, render: (row: Row) => new Date(row.created_at as string).toLocaleDateString() },
        ],
      };

    case 'audit-security':
      return {
        title: 'Audit and Security Report',
        description: 'Audit trail for role changes, settings, equipment condition, workflow completion, and security events.',
        methodologyNote: methodologyFor('audit-security'),
        filterDefs: ['date_range'],
        fetchData: reportsService.getAuditSecurityReport,
        columns: [
          { key: 'created_at', header: 'Timestamp', sortable: true, render: (row: Row) => new Date(row.created_at as string).toLocaleString() },
          { key: 'actor', header: 'Actor', render: (row: Row) => { const p = row.profiles as { full_name?: string; email?: string } | null; return p?.full_name ?? p?.email ?? 'System'; } },
          { key: 'action', header: 'Action' },
          { key: 'entity_type', header: 'Entity' },
          { key: 'entity_id', header: 'Record' },
        ],
      };

    default:
      return null;
  }
}

/* ── KPI card colors ──────────────────────────────────────────────────────── */

const kpiColorMap: Record<string, string> = {
  blue: 'bg-blue-500/10 border-blue-500/25 text-blue-400',
  green: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
  red: 'bg-rose-500/10 border-rose-500/25 text-rose-400',
  yellow: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
  orange: 'bg-orange-500/10 border-orange-500/25 text-orange-400',
  purple: 'bg-violet-500/10 border-violet-500/25 text-violet-400',
  gray: 'bg-slate-500/10 border-slate-500/25 text-slate-400',
};

/* ── page ─────────────────────────────────────────────────────────────────── */

export default function ReportTypePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const reportType = params.type as string;

  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<{ value: string; label: string }[]>([]);
  const [categoriesList, setCategoriesList] = useState<{ value: string; label: string }[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [generatedAt, setGeneratedAt] = useState(() => new Date().toISOString());
  const [refreshStatus, setRefreshStatus] = useState('pending');

  const config = useMemo(() => getReportConfig(reportType), [reportType]);

  const reportKPIs = useMemo(() => buildReportKPIs(reportType, data), [reportType, data]);
  const reportCharts = useMemo(() => buildReportCharts(reportType, data), [reportType, data]);
  const priorityFindings = useMemo(() => buildPriorityFindings(reportType, data), [reportType, data]);
  const executiveSummary = useMemo(() => buildExecutiveSummary(reportType, data), [reportType, data]);

  const loadReferenceData = useCallback(async () => {
    try {
      const [deptRes, catRes] = await Promise.all([
        settingsService.getAll('departments'),
        settingsService.getAll('equipment_categories'),
      ]);
      setDepartments((deptRes.data || []).map((d: Record<string, unknown>) => ({ value: d.id as string, label: d.name as string })));
      setCategoriesList((catRes.data || []).map((c: Record<string, unknown>) => ({ value: c.id as string, label: c.name as string })));
    } catch {
      // non-critical
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    try {
      const snapshot = await prepareReportSnapshotAction(reportType);
      if (snapshot.success && snapshot.data) {
        setGeneratedAt(snapshot.data.generatedAt);
        setRefreshStatus(snapshot.data.refreshStatus);
      } else {
        setGeneratedAt(new Date().toISOString());
        setRefreshStatus('warning: refresh unavailable');
      }
      const filters: ReportFilters = {};
      if (filterValues.department_id) filters.department_id = filterValues.department_id;
      if (filterValues.category_id) filters.category_id = filterValues.category_id;
      if (filterValues.status) filters.status = filterValues.status;
      if (filterValues.date_from) filters.date_from = filterValues.date_from;
      if (filterValues.date_to) filters.date_to = filterValues.date_to;

      const { data: result, error } = await config.fetchData(filters);
      if (error) throw error;
      setData((result || []) as Row[]);
    } catch {
      toast('error', 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [config, filterValues, reportType, toast]);

  useEffect(() => { loadReferenceData(); }, [loadReferenceData]);
  useEffect(() => { loadData(); }, [loadData]);

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg font-medium text-[var(--foreground)]">Report type not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/reports')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Reports
        </Button>
      </div>
    );
  }

  /* ── filter options ── */
  const pmStatusOptions = [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'completed', label: 'Completed' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'skipped', label: 'Skipped' },
    { value: 'in_progress', label: 'In Progress' },
  ];
  const disposalStatusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'completed', label: 'Completed' },
  ];
  const equipmentStatusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'disposed', label: 'Disposed' },
    { value: 'in_storage', label: 'In Storage' },
  ];
  const workOrderStatusOptions = [
    { value: 'open', label: 'Open' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'completed', label: 'Completed' },
    { value: 'canceled', label: 'Canceled' },
  ];
  const procurementStatusOptions = [
    { value: 'requested', label: 'Requested' },
    { value: 'approved', label: 'Approved' },
    { value: 'ordered', label: 'Ordered' },
    { value: 'in_transit', label: 'In Transit' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'canceled', label: 'Canceled' },
  ];

  const filterDefs = config.filterDefs.flatMap((f) => {
    switch (f) {
      case 'department': return [{ key: 'department_id', label: 'Department', options: departments }];
      case 'category': return [{ key: 'category_id', label: 'Category', options: categoriesList }];
      case 'status': {
        const norm = normalizeReportType(reportType);
        return [{
          key: 'status', label: 'Status',
          options: norm === 'pm' ? pmStatusOptions
            : norm === 'disposal' ? disposalStatusOptions
            : norm === 'equipment' ? equipmentStatusOptions
            : norm === 'work-orders' ? workOrderStatusOptions
            : norm === 'procurement-pipeline' ? procurementStatusOptions
            : [],
        }];
      }
      case 'date_range': return [];
      default: return [];
    }
  });

  const showDateFilters = config.filterDefs.includes('date_range');
  const freshnessFail = refreshStatus.startsWith('warning');

  const handleFilterChange = (key: string, value: string) => setFilterValues((prev) => ({ ...prev, [key]: value }));
  const handleFilterReset = () => setFilterValues({});

  const handleExportCSV = () => {
    const result = exportToCSV(data, config.columns, reportType, {
      reportTitle: config.title,
      generatedAt,
    });
    if (!result.success) { toast('warning', result.error ?? 'No rows to export'); return; }
    toast('success', 'Report exported as CSV');
  };

  const handleExportPDF = () => {
    const result = exportToPDF({ data, columns: config.columns, filename: reportType, title: config.title, filters: filterValues, generatedAt });
    if (!result.success) { toast('warning', result.error ?? 'No rows to export'); return; }
    toast('success', 'Report exported as PDF');
  };

  const handlePrint = () => window.print();

  const snapshotTs = new Date(generatedAt).toLocaleString();

  return (
    <div className="space-y-6">
      {/* Print-only header — hidden on screen */}
      <div className="report-print-header hidden">
        <h1 className="text-xl font-bold">{config.title}</h1>
        <p className="text-sm">Yekatit-12 Hospital Medical College — BMERMS</p>
        <p className="text-sm">Generated: {snapshotTs}</p>
        <hr className="my-2" />
      </div>

      <PageHeader
        title={config.title}
        description={config.description}
        breadcrumbs={[{ label: 'Reports', href: '/reports' }, { label: config.title }]}
      />

      {/* Export actions — no-print */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => router.push('/reports')}>
          <ArrowLeft className="h-4 w-4" /> Back to Reports
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={loading || data.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={loading || data.length === 0}>
            <Download className="h-4 w-4" /> Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={loading}>
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Snapshot notice */}
      <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${freshnessFail ? 'border-amber-500/40 bg-amber-500/8' : 'border-[var(--border-subtle)] bg-[var(--surface-2)]'}`}>
        <Info className={`mt-0.5 h-4 w-4 shrink-0 ${freshnessFail ? 'text-amber-400' : 'text-[var(--text-muted)]'}`} />
        <div className="space-y-0.5">
          <p className="text-sm text-[var(--foreground)]">
            This report represents a system snapshot generated at <strong>{snapshotTs}</strong>.
            Operational metrics and evidence are read from the current BMERMS database state. Charts, summaries, and tables reflect available records at generation time.
          </p>
          {freshnessFail && (
            <p className="text-xs text-amber-400">
              Live analytics refresh was unavailable. Report uses the latest available operational records.
            </p>
          )}
          {!freshnessFail && (
            <p className="text-xs text-[var(--text-muted)]">
              Decision-support analytics were refreshed before this report was assembled.
            </p>
          )}
        </div>
      </div>

      {/* Executive summary */}
      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5">
        <h2 className="mb-2 text-base font-semibold text-[var(--foreground)]">Executive Summary</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {loading ? 'Generating summary from snapshot data…' : executiveSummary}
        </p>
      </section>

      {/* KPI cards */}
      {!loading && reportKPIs.length > 0 && (
        <section className="report-kpi-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {reportKPIs.map((kpi) => (
            <div key={kpi.label} className={`rounded-xl border p-4 ${kpiColorMap[kpi.color] ?? kpiColorMap.blue}`}>
              <p className="text-xs font-medium opacity-80">{kpi.label}</p>
              <p className="mt-1 text-2xl font-bold">{kpi.value}</p>
              {kpi.sub && <p className="mt-0.5 text-xs opacity-70">{kpi.sub}</p>}
            </div>
          ))}
        </section>
      )}
      {loading && (
        <section className="report-kpi-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]" />
          ))}
        </section>
      )}

      {/* Charts */}
      {!loading && reportCharts.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">Visual Analytics</h2>
          <div className={`report-chart-grid grid gap-4 ${reportCharts.length === 1 ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
            {reportCharts.map((chart) => (
              <ChartCard key={chart.title} title={chart.title} description={chart.description}>
                {chart.labels.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-sm text-[var(--text-muted)]">
                    No data available for this chart in the current snapshot.
                  </div>
                ) : (
                  <>
                    {chart.type === 'doughnut' && <DoughnutChart labels={chart.labels} data={chart.values} colors={chart.colors} height={250} />}
                    {chart.type === 'bar' && <BarChart labels={chart.labels} datasets={[{ label: chart.title, data: chart.values, backgroundColor: chart.colors }]} height={250} />}
                    {chart.type === 'hbar' && <HorizontalBarChart labels={chart.labels} values={chart.values} colors={chart.colors} height={Math.max(220, chart.labels.length * 30)} />}
                    {chart.type === 'line' && chart.datasets && <LineChart labels={chart.labels} datasets={chart.datasets} height={250} />}
                  </>
                )}
              </ChartCard>
            ))}
          </div>
        </section>
      )}
      {!loading && data.length > 0 && reportCharts.length === 0 && (
        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-muted)]">
          No visual analytics are available for this report type.
        </section>
      )}

      {/* Priority findings */}
      {!loading && priorityFindings.length > 0 && (
        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5">
          <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">Priority Findings</h2>
          <ul className="space-y-2">
            {priorityFindings.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                {f.severity === 'critical' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />}
                {f.severity === 'warning' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />}
                {f.severity === 'info' && <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />}
                <span className={`text-sm ${f.severity === 'critical' ? 'text-rose-300' : f.severity === 'warning' ? 'text-amber-300' : 'text-[var(--text-muted)]'}`}>
                  {f.finding}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Methodology */}
      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5">
        <h2 className="mb-2 text-base font-semibold text-[var(--foreground)]">Methodology & Interpretation</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">{config.methodologyNote}</p>
        {(type => ['replacement-planning', 'decision-support-methodology'].includes(type))(reportType) && (
          <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-sm text-amber-300">
            Prototype Decision Thresholds: RPI ≥ 0.70 = Strong replacement candidate. RPI 0.55–0.69 = Review candidate. RPI &lt; 0.55 = Monitor. These thresholds are used for demonstration and sensitivity testing and do not automatically approve replacement.
          </p>
        )}
        {freshnessFail && (
          <p className="mt-2 text-sm text-amber-400">
            Freshness note: {refreshStatus}
          </p>
        )}
      </section>

      {/* Evidence table */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">Evidence Table</h2>

        {/* Filters — no-print */}
        {(filterDefs.length > 0 || showDateFilters) && (
          <div className="no-print mb-4 flex flex-wrap items-end gap-4">
            {filterDefs.length > 0 && (
              <FilterBar filters={filterDefs} values={filterValues} onChange={handleFilterChange} onReset={handleFilterReset} />
            )}
            {showDateFilters && (
              <div className="flex items-end gap-3">
                <div className="w-44">
                  <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">From</label>
                  <input
                    type="date"
                    className="block w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    value={filterValues.date_from || ''}
                    onChange={(e) => handleFilterChange('date_from', e.target.value)}
                  />
                </div>
                <div className="w-44">
                  <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">To</label>
                  <input
                    type="date"
                    className="block w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    value={filterValues.date_to || ''}
                    onChange={(e) => handleFilterChange('date_to', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <p className="mb-3 text-sm text-[var(--text-muted)]">
          {loading ? 'Loading…' : data.length === 0 ? 'No records found for this evidence section.' : `${data.length} record${data.length !== 1 ? 's' : ''} in this snapshot`}
        </p>

        <DataTable
          columns={config.columns}
          data={data}
          loading={loading}
          searchPlaceholder={`Search ${config.title.toLowerCase()}…`}
          emptyMessage="No records found for this evidence section."
        />
      </section>
    </div>
  );
}
