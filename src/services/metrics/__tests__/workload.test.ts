import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyWorkloadStatus,
  WORKLOAD_STATUS_THRESHOLDS,
} from '@/services/metrics/workload.service';

// R29: classifyWorkloadStatus is the canonical rule. Anyone reading workload
// numbers (Command Center, Developer Lab, reports, Copilot) gets the same
// 'available' | 'busy' | 'overloaded' label for the same input.

test('zero work → available', () => {
  assert.equal(
    classifyWorkloadStatus({ openAssignments: 0, criticalTasks: 0 }),
    'available',
  );
});

test('< busy threshold → available', () => {
  assert.equal(
    classifyWorkloadStatus({ openAssignments: WORKLOAD_STATUS_THRESHOLDS.busy - 1, criticalTasks: 0 }),
    'available',
  );
});

test('>= busy threshold, < overloaded → busy', () => {
  assert.equal(
    classifyWorkloadStatus({ openAssignments: WORKLOAD_STATUS_THRESHOLDS.busy, criticalTasks: 0 }),
    'busy',
  );
});

test('>= overloaded threshold → overloaded', () => {
  assert.equal(
    classifyWorkloadStatus({ openAssignments: WORKLOAD_STATUS_THRESHOLDS.overloaded, criticalTasks: 0 }),
    'overloaded',
  );
});

test('any critical task → overloaded regardless of openAssignments count', () => {
  // Even a single critical task at 0 open assignments overrides to overloaded.
  assert.equal(
    classifyWorkloadStatus({ openAssignments: 0, criticalTasks: 1 }),
    'overloaded',
  );
  // And under busy threshold with criticals still flips to overloaded.
  assert.equal(
    classifyWorkloadStatus({ openAssignments: 2, criticalTasks: 1 }),
    'overloaded',
  );
});
