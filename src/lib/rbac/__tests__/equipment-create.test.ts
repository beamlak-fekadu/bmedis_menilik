import test from 'node:test';
import assert from 'node:assert/strict';
import { hasCapability } from '@/lib/rbac';

// Migration 00066 fix: equipment.create must match the RLS write policy on
// equipment_assets (developer / admin / bme_head). If this test fails after
// a capability-matrix edit, the DB policy in migration 00066 must be updated
// in lock-step.

test('equipment.create is granted to developer / admin / bme_head', () => {
  for (const role of ['developer', 'admin', 'bme_head']) {
    assert.equal(
      hasCapability([role], 'equipment.create'),
      true,
      `${role} must have equipment.create`,
    );
  }
});

test('equipment.create is denied to non-write roles', () => {
  for (const role of [
    'technician',
    'store_user',
    'department_head',
    'department_user',
    'viewer',
  ]) {
    assert.equal(
      hasCapability([role], 'equipment.create'),
      false,
      `${role} must NOT have equipment.create`,
    );
  }
});
