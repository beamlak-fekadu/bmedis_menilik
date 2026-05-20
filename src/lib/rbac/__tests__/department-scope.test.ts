import test from 'node:test';
import assert from 'node:assert/strict';
import {
  departmentScopeFor,
  applyDepartmentScope,
  isDepartmentScoped,
  denialMessage,
} from '@/lib/rbac/department-scope';

// Tiny fluent stub of the bits of the Supabase query builder the helper uses.
function stubQuery() {
  const filters: Array<{ col: string; val: string }> = [];
  const builder = {
    eq(col: string, val: string) {
      filters.push({ col, val });
      return builder;
    },
    _filters: filters,
  };
  return builder;
}

test('developer/admin/bme_head/technician/store_user/viewer are unrestricted', () => {
  for (const role of ['developer', 'admin', 'bme_head', 'technician', 'store_user', 'viewer']) {
    const scope = departmentScopeFor({ roleNames: [role], departmentId: null });
    assert.equal(scope.kind, 'unrestricted', `role ${role} should be unrestricted`);
  }
});

test('department_head/user with department_id are scoped to that department', () => {
  for (const role of ['department_head', 'department_user']) {
    const scope = departmentScopeFor({ roleNames: [role], departmentId: 'dep-123' });
    assert.equal(scope.kind, 'department');
    if (scope.kind === 'department') {
      assert.equal(scope.departmentId, 'dep-123');
    }
  }
});

test('department_head/user without department_id are denied', () => {
  for (const role of ['department_head', 'department_user']) {
    const scope = departmentScopeFor({ roleNames: [role], departmentId: null });
    assert.equal(scope.kind, 'denied');
    if (scope.kind === 'denied') {
      assert.equal(scope.reason, 'department_user_missing_department');
    }
  }
});

test('no roles → denied', () => {
  const scope = departmentScopeFor({ roleNames: [], departmentId: 'dep-1' });
  assert.equal(scope.kind, 'denied');
});

test('unknown roles → denied (fail closed)', () => {
  const scope = departmentScopeFor({ roleNames: ['some_legacy_role'], departmentId: 'dep-1' });
  assert.equal(scope.kind, 'denied');
});

test('cross-department role wins over department role on the same account', () => {
  // E.g. a developer also assigned department_head for testing remains unrestricted.
  const scope = departmentScopeFor({
    roleNames: ['developer', 'department_head'],
    departmentId: 'dep-1',
  });
  assert.equal(scope.kind, 'unrestricted');
});

test('applyDepartmentScope only adds a filter for department scope', () => {
  const q1 = stubQuery();
  applyDepartmentScope(q1, 'department_id', { kind: 'unrestricted' });
  assert.equal(q1._filters.length, 0, 'unrestricted should add no filter');

  const q2 = stubQuery();
  applyDepartmentScope(q2, 'department_id', { kind: 'department', departmentId: 'dep-9' });
  assert.deepEqual(q2._filters, [{ col: 'department_id', val: 'dep-9' }]);

  const q3 = stubQuery();
  applyDepartmentScope(q3, 'department_id', { kind: 'denied', reason: 'no_roles' });
  assert.equal(q3._filters.length, 0, 'denied should not silently add a filter');
});

test('isDepartmentScoped is true only for department-scoped scope', () => {
  assert.equal(isDepartmentScoped({ kind: 'unrestricted' }), false);
  assert.equal(isDepartmentScoped({ kind: 'denied', reason: 'no_roles' }), false);
  assert.equal(isDepartmentScoped({ kind: 'department', departmentId: 'd' }), true);
});

test('denialMessage covers both reasons', () => {
  assert.ok(denialMessage('no_roles').length > 0);
  assert.ok(denialMessage('department_user_missing_department').length > 0);
});
