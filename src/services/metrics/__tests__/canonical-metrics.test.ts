import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEquipmentConditionStats,
  computePMComplianceStats,
  computeCalibrationComplianceStats,
  computeWorkOrderStats,
  computeMaintenanceEventStats,
  buildReportMetadata,
} from '@/services/metrics/canonical-metrics';

// R11 + R28: dashboards and reports share these. Same row array → identical
// KPI numbers across surfaces. Tests lock that contract.

test('computeEquipmentConditionStats on empty array', () => {
  const s = computeEquipmentConditionStats([]);
  assert.equal(s.total, 0);
  assert.equal(s.functional, 0);
  assert.equal(s.functionalPercentage, 0);
});

test('computeEquipmentConditionStats counts each condition correctly', () => {
  const rows = [
    { condition: 'functional' },
    { condition: 'functional' },
    { condition: 'needs_repair' },
    { condition: 'non_functional' },
    { condition: 'under_maintenance' },
  ];
  const s = computeEquipmentConditionStats(rows);
  assert.equal(s.total, 5);
  assert.equal(s.functional, 2);
  assert.equal(s.needsRepair, 1);
  assert.equal(s.nonFunctional, 1);
  assert.equal(s.underMaintenance, 1);
  assert.equal(s.functionalPercentage, 40);
});

test('computePMComplianceStats matches thesis equation 5', () => {
  const rows = [
    { status: 'completed' },
    { status: 'completed' },
    { status: 'completed' },
    { status: 'overdue' },
    { status: 'scheduled' },
  ];
  const s = computePMComplianceStats(rows);
  assert.equal(s.total, 5);
  assert.equal(s.completed, 3);
  assert.equal(s.overdue, 1);
  assert.equal(s.compliancePercentage, 60);
});

test('computeCalibrationComplianceStats counts pass/fail/adjusted/overdue', () => {
  const now = new Date('2026-05-19T00:00:00Z');
  const rows = [
    { result: 'pass', next_due_date: '2026-12-01' }, // not overdue
    { result: 'pass', next_due_date: '2026-01-01' }, // overdue
    { result: 'fail', next_due_date: null },
    { result: 'adjusted', next_due_date: '2026-12-01' },
  ];
  const s = computeCalibrationComplianceStats(rows, now);
  assert.equal(s.total, 4);
  assert.equal(s.pass, 2);
  assert.equal(s.fail, 1);
  assert.equal(s.adjusted, 1);
  assert.equal(s.overdue, 1);
  assert.equal(s.passPercentage, 50);
});

test('computeWorkOrderStats uses canonical active-status set', () => {
  const rows = [
    { status: 'open', priority: 'low' },
    { status: 'assigned', priority: 'high' },
    { status: 'in_progress', priority: 'critical' },
    { status: 'on_hold', priority: 'medium' },
    { status: 'completed', priority: 'low' },
    { status: 'canceled', priority: 'low' },
  ];
  const s = computeWorkOrderStats(rows);
  assert.equal(s.total, 6);
  assert.equal(s.active, 4);
  assert.equal(s.completed, 1);
  assert.equal(s.criticalOrHigh, 2);
});

test('computeMaintenanceEventStats average ignores rows with null repair_duration_hours', () => {
  const rows = [
    { repair_duration_hours: 2, service_cost: 100, event_type: 'corrective' },
    { repair_duration_hours: 4, service_cost: 200, event_type: 'corrective' },
    { repair_duration_hours: null, service_cost: null, event_type: 'preventive' },
  ];
  const s = computeMaintenanceEventStats(rows);
  assert.equal(s.total, 3);
  assert.equal(s.withRepairHours, 2);
  assert.equal(s.avgRepairHours, 3); // (2 + 4) / 2
  assert.equal(s.totalServiceCost, 300);
  assert.equal(s.eventTypes, 2);
});

test('computeMaintenanceEventStats avgRepairHours is null when no row has a duration', () => {
  const s = computeMaintenanceEventStats([
    { repair_duration_hours: null, service_cost: 0, event_type: 'inspection' },
  ]);
  assert.equal(s.avgRepairHours, null);
});

test('buildReportMetadata always includes generatedAt and dataSource', () => {
  const meta = buildReportMetadata({ dataSource: 'equipment_assets / live' });
  assert.ok(meta.generatedAt);
  assert.equal(meta.dataSource, 'equipment_assets / live');
  assert.ok(meta.freshnessNote);
});

test('buildReportMetadata surfaces last analytics refresh when supplied', () => {
  const meta = buildReportMetadata({
    dataSource: 'pm_compliance_metrics',
    lastAnalyticsRefresh: '2026-05-19T10:30:00Z',
  });
  assert.match(meta.freshnessNote ?? '', /Last analytics refresh/);
});
