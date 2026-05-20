import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canQueueOfflineAction,
  canManageOfflineQueue,
  getOfflinePermissionsForRoles,
} from '@/lib/offline/offline-permissions';

// R12: client-side enqueue gating MIRRORS the server replay permission rules.
// A role that cannot queue an action type should NOT be able to add it to
// IndexedDB — the server replay would reject it anyway, and silent late
// failure is worse than upfront refusal.

test('viewer cannot queue any offline action', () => {
  // The viewer role exists in the role list but has zero allowedActions.
  const allActionTypes: Array<Parameters<typeof canQueueOfflineAction>[1]> = [
    'maintenance_request.create',
    'maintenance_event.log',
    'qr_note.create',
    'work_order.start_intent',
    'work_order.complete_draft',
    'stock_receipt.draft',
    'stock_issue.draft',
    'store_reorder.create',
    'calibration_request.create',
    'training_request.create',
    'department_issue.report',
  ];
  for (const actionType of allActionTypes) {
    assert.equal(
      canQueueOfflineAction(['viewer'], actionType),
      false,
      `Viewer must NOT be able to queue ${actionType}`,
    );
  }
});

test('technician can queue maintenance + start_intent + complete_draft + qr_note', () => {
  const allowed = [
    'maintenance_event.log',
    'qr_note.create',
    'maintenance_request.create',
    'work_order.start_intent',
    'work_order.complete_draft',
  ] as const;
  for (const t of allowed) {
    assert.equal(canQueueOfflineAction(['technician'], t), true, `Technician should queue ${t}`);
  }
  // Technician must NOT be able to queue store actions.
  assert.equal(canQueueOfflineAction(['technician'], 'stock_receipt.draft'), false);
  assert.equal(canQueueOfflineAction(['technician'], 'stock_issue.draft'), false);
  assert.equal(canQueueOfflineAction(['technician'], 'store_reorder.create'), false);
});

test('store_user can queue stock drafts + reorder; cannot queue maintenance', () => {
  for (const t of ['store_reorder.create', 'stock_receipt.draft', 'stock_issue.draft'] as const) {
    assert.equal(canQueueOfflineAction(['store_user'], t), true, `Store user should queue ${t}`);
  }
  assert.equal(canQueueOfflineAction(['store_user'], 'maintenance_event.log'), false);
  assert.equal(canQueueOfflineAction(['store_user'], 'work_order.start_intent'), false);
});

test('department_head can queue requests + issue reports; cannot queue execution', () => {
  for (const t of [
    'maintenance_request.create',
    'calibration_request.create',
    'training_request.create',
    'department_issue.report',
  ] as const) {
    assert.equal(canQueueOfflineAction(['department_head'], t), true, `Dept head should queue ${t}`);
  }
  assert.equal(canQueueOfflineAction(['department_head'], 'work_order.start_intent'), false);
  assert.equal(canQueueOfflineAction(['department_head'], 'work_order.complete_draft'), false);
  assert.equal(canQueueOfflineAction(['department_head'], 'maintenance_event.log'), false);
  assert.equal(canQueueOfflineAction(['department_head'], 'stock_receipt.draft'), false);
});

test('canManageOfflineQueue follows the developer/admin/bme_head pattern', () => {
  assert.equal(canManageOfflineQueue(['developer']), true);
  assert.equal(canManageOfflineQueue(['admin']), true);
  assert.equal(canManageOfflineQueue(['bme_head']), true);
  assert.equal(canManageOfflineQueue(['technician']), false);
  assert.equal(canManageOfflineQueue(['viewer']), false);
  assert.equal(canManageOfflineQueue(['store_user']), false);
});

test('getOfflinePermissionsForRoles defaults to viewer when role is unknown', () => {
  const perms = getOfflinePermissionsForRoles(['nonexistent_role']);
  assert.equal(perms.canInspectDiagnostics, false);
  assert.equal(perms.canManageLocalQueue, false);
  assert.deepEqual(perms.futureAllowedActions, []);
});

test('getOfflinePermissionsForRoles short-circuits to developer when developer is present', () => {
  // Even with conflicting lower-priority roles, developer wins.
  const perms = getOfflinePermissionsForRoles(['viewer', 'developer']);
  assert.equal(perms.canInspectDiagnostics, true);
  assert.equal(perms.canManageLocalQueue, true);
});
