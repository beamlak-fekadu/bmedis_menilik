import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDemoRoleMapping,
  validateDemoRoleMappings,
  demoRoleIntegritySummary,
  EXPECTED_DEMO_USERS,
} from '@/utils/developer-lab/demo-role-validation';

function inputForDeveloperOk() {
  return {
    email: 'developer@bmerms-demo.local',
    authUserId: '11111111-1111-1111-1111-111111111111',
    profileId: '22222222-2222-2222-2222-222222222222',
    profileUserId: '11111111-1111-1111-1111-111111111111',
    fullName: 'BMEDIS Developer',
    jobTitle: 'Thesis Developer',
    departmentName: null,
    assignedRoles: ['developer'],
  };
}

test('OK row is recognized as integrity-pass', () => {
  const result = validateDemoRoleMapping(inputForDeveloperOk());
  assert.equal(result.primaryReason, 'OK');
  assert.deepEqual(result.reasons, ['OK']);
});

test('MISSING_AUTH_USER fires when authUserId is null', () => {
  const result = validateDemoRoleMapping({ ...inputForDeveloperOk(), authUserId: null });
  assert.ok(result.reasons.includes('MISSING_AUTH_USER'));
  assert.notEqual(result.primaryReason, 'OK');
});

test('PROFILE_NOT_LINKED_TO_AUTH fires when profile.user_id mismatches auth.users.id', () => {
  const result = validateDemoRoleMapping({
    ...inputForDeveloperOk(),
    profileUserId: '99999999-9999-9999-9999-999999999999',
  });
  assert.ok(result.reasons.includes('PROFILE_NOT_LINKED_TO_AUTH'));
});

test('WRONG_ROLE fires when assigned role is not the expected role', () => {
  const result = validateDemoRoleMapping({
    ...inputForDeveloperOk(),
    assignedRoles: ['technician'],
  });
  assert.ok(result.reasons.includes('WRONG_ROLE'));
});

test('MULTIPLE_ROLES fires when more than one role is assigned', () => {
  const result = validateDemoRoleMapping({
    ...inputForDeveloperOk(),
    assignedRoles: ['developer', 'technician'],
  });
  assert.ok(result.reasons.includes('MULTIPLE_ROLES'));
});

test('Department mismatch fires WRONG_DEPARTMENT', () => {
  const deptHead = EXPECTED_DEMO_USERS.find((u) => u.expectedRole === 'department_head')!;
  const result = validateDemoRoleMapping({
    email: deptHead.email,
    authUserId: 'a',
    profileId: 'p',
    profileUserId: 'a',
    fullName: deptHead.expectedFullName,
    jobTitle: deptHead.expectedJobTitle,
    departmentName: 'Wrong Department',
    assignedRoles: [deptHead.expectedRole],
  });
  assert.ok(result.reasons.includes('WRONG_DEPARTMENT'));
});

test('validateDemoRoleMappings fills in missing rows for absent emails', () => {
  const results = validateDemoRoleMappings([inputForDeveloperOk()]);
  assert.equal(results.length, EXPECTED_DEMO_USERS.length);
  const otherRows = results.filter((r) => r.email !== 'developer@bmerms-demo.local');
  for (const row of otherRows) {
    assert.ok(row.reasons.includes('MISSING_AUTH_USER'));
    assert.ok(row.reasons.includes('MISSING_PROFILE'));
  }
});

test('demoRoleIntegritySummary counts OK rows correctly', () => {
  const summary = demoRoleIntegritySummary(validateDemoRoleMappings([inputForDeveloperOk()]));
  assert.equal(summary.ok, 1);
  assert.equal(summary.total, EXPECTED_DEMO_USERS.length);
  assert.equal(summary.hasFailures, true);
  assert.equal(summary.missingAuthUsers, EXPECTED_DEMO_USERS.length - 1);
});
