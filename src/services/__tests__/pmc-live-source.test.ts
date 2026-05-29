import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeDepartmentPMCompliance,
  summarizeDepartmentPMCompliance,
} from '@/utils/pm/department-compliance';

const root = process.cwd();

test('department PM compliance helper rolls up the same live schedule rows used by BME Head', () => {
  const rows = [
    { id: 's1', status: 'completed', scheduled_date: '2099-01-01', equipment_assets: { department_id: 'd1', departments: { id: 'd1', name: 'ICU' } } },
    { id: 's2', status: 'scheduled', scheduled_date: '2099-01-02', equipment_assets: { department_id: 'd1', departments: { id: 'd1', name: 'ICU' } } },
    { id: 's3', status: 'skipped', scheduled_date: '2099-01-03', equipment_assets: { department_id: 'd2', departments: { id: 'd2', name: 'OR' } } },
  ];

  const compliance = computeDepartmentPMCompliance(rows);
  assert.equal(compliance.length, 2);
  assert.deepEqual(
    compliance.find((row) => row.department_id === 'd1'),
    {
      department_id: 'd1',
      department_name: 'ICU',
      scheduled: 2,
      completed: 1,
      overdue: 0,
      skippedDeferred: 0,
      percentage: 50,
    },
  );
  assert.equal(compliance.find((row) => row.department_id === 'd2')?.skippedDeferred, 1);
});

test('Viewer compliance page uses live pm_schedules helper, not stale completion_rate snapshot', () => {
  const src = fs.readFileSync(path.join(root, 'src/app/(dashboard)/compliance/page.tsx'), 'utf8');
  assert.match(src, /fetchDepartmentPMCompliance/);
  assert.doesNotMatch(src, /completion_rate/);
});

test('Viewer command center uses the same department PM helper source as compliance pages', () => {
  const src = fs.readFileSync(path.join(root, 'src/utils/viewer/executive-metrics.ts'), 'utf8');
  assert.match(src, /fetchDepartmentPMCompliance/);
  assert.match(src, /summarizeDepartmentPMCompliance/);
  assert.doesNotMatch(src, /pm_compliance_metrics/);
});

test('department PM compliance summary is weighted by live scheduled/completed counts', () => {
  const rows = computeDepartmentPMCompliance([
    { id: 's1', status: 'completed', scheduled_date: '2099-01-01', equipment_assets: { department_id: 'd1', departments: { id: 'd1', name: 'ICU' } } },
    { id: 's2', status: 'scheduled', scheduled_date: '2099-01-02', equipment_assets: { department_id: 'd1', departments: { id: 'd1', name: 'ICU' } } },
    { id: 's3', status: 'completed', scheduled_date: '2099-01-03', equipment_assets: { department_id: 'd2', departments: { id: 'd2', name: 'OR' } } },
  ]);

  assert.deepEqual(summarizeDepartmentPMCompliance(rows), {
    scheduled: 3,
    completed: 2,
    percentage: 67,
  });
});
