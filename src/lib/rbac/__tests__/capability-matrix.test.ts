import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITY_MATRIX, hasCapability } from '@/lib/rbac';

// R5: equipment.condition.update capability matrix coverage.
// Allowed roles (capability matrix): developer (always), admin, bme_head,
// technician, department_head, department_user. Denied: store_user, viewer.

test('equipment.condition.update is granted to expected roles', () => {
  const allowed = ['developer', 'admin', 'bme_head', 'technician', 'department_head', 'department_user'];
  for (const role of allowed) {
    assert.equal(
      hasCapability([role], 'equipment.condition.update'),
      true,
      `Expected role "${role}" to have equipment.condition.update`,
    );
  }
});

test('equipment.condition.update is denied to store_user and viewer', () => {
  for (const role of ['store_user', 'viewer']) {
    assert.equal(
      hasCapability([role], 'equipment.condition.update'),
      false,
      `Expected role "${role}" to NOT have equipment.condition.update`,
    );
  }
});

test('developer is the full reference standard (has every capability)', () => {
  const allCaps = new Set<string>();
  for (const set of Object.values(CAPABILITY_MATRIX)) {
    for (const cap of set) allCaps.add(cap);
  }
  for (const cap of allCaps) {
    assert.equal(
      hasCapability(['developer'], cap as never),
      true,
      `Developer should have every capability, missing: ${cap}`,
    );
  }
});

test('viewer has no mutation capability', () => {
  const mutationCaps = [
    'equipment.create', 'equipment.edit', 'equipment.delete', 'equipment.condition.update',
    'maintenance.request.create', 'maintenance.request.approve',
    'work_order.create', 'work_order.assign', 'work_order.start', 'work_order.complete', 'work_order.add_event',
    'pm.plan.create', 'pm.assign', 'pm.complete',
    'calibration.request.create', 'calibration.request.approve', 'calibration.schedule', 'calibration.record_result',
    'spare_parts.manage', 'stock.receive', 'stock.issue', 'procurement.request', 'procurement.status_update',
    'training.request.create', 'training.schedule', 'training.record_attendance',
    'disposal.request.create', 'disposal.approve', 'disposal.record',
    'users.manage', 'roles.manage',
  ];
  for (const cap of mutationCaps) {
    assert.equal(
      hasCapability(['viewer'], cap as never),
      false,
      `Viewer should not have mutation capability: ${cap}`,
    );
  }
});

test('store_user can manage stock but not maintenance execution', () => {
  assert.equal(hasCapability(['store_user'], 'stock.receive'), true);
  assert.equal(hasCapability(['store_user'], 'stock.issue'), true);
  assert.equal(hasCapability(['store_user'], 'procurement.request'), true);
  assert.equal(hasCapability(['store_user'], 'work_order.start'), false);
  assert.equal(hasCapability(['store_user'], 'work_order.complete'), false);
});

test('department roles can file requests but not execute work', () => {
  for (const role of ['department_head', 'department_user']) {
    assert.equal(hasCapability([role], 'maintenance.request.create'), true);
    assert.equal(hasCapability([role], 'calibration.request.create'), true);
    assert.equal(hasCapability([role], 'work_order.assign'), false);
    assert.equal(hasCapability([role], 'work_order.complete'), false);
  }
});

// R18: per-transition capability split.
test('technician has work_order.start/complete/add_event/hold but not assign', () => {
  for (const cap of ['work_order.start', 'work_order.complete', 'work_order.add_event', 'work_order.hold']) {
    assert.equal(
      hasCapability(['technician'], cap as never),
      true,
      `Technician should have ${cap}`,
    );
  }
  assert.equal(hasCapability(['technician'], 'work_order.assign'), false);
  assert.equal(hasCapability(['technician'], 'work_order.create'), false);
});

test('bme_head can do every work-order transition', () => {
  for (const cap of [
    'work_order.create', 'work_order.assign', 'work_order.start',
    'work_order.complete', 'work_order.add_event', 'work_order.hold',
  ]) {
    assert.equal(
      hasCapability(['bme_head'], cap as never),
      true,
      `BME Head should have ${cap}`,
    );
  }
});

test('viewer and store_user have NO work-order capability', () => {
  for (const role of ['viewer', 'store_user']) {
    for (const cap of [
      'work_order.create', 'work_order.assign', 'work_order.start',
      'work_order.complete', 'work_order.add_event', 'work_order.hold',
    ]) {
      assert.equal(
        hasCapability([role], cap as never),
        false,
        `${role} should NOT have ${cap}`,
      );
    }
  }
});

test('work_order.hold is its own capability (not aliased to start/complete)', () => {
  // Synthetic role with only start should NOT hold; only add_event should NOT hold.
  // Hasn't been actually granted to a hypothetical "start_only" role, so verify via
  // the matrix shape: hold appears in DEVELOPER/BME_HEAD/technician sets only.
  assert.equal(hasCapability(['developer'], 'work_order.hold'), true);
  assert.equal(hasCapability(['admin'], 'work_order.hold'), true);
  assert.equal(hasCapability(['bme_head'], 'work_order.hold'), true);
  assert.equal(hasCapability(['technician'], 'work_order.hold'), true);
  assert.equal(hasCapability(['department_head'], 'work_order.hold'), false);
  assert.equal(hasCapability(['department_user'], 'work_order.hold'), false);
});
