import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canCreateCopilotDraft,
  canExecuteCopilotAction,
  canReadAllOperationalCopilotContext,
  canReadCopilotDepartment,
  canUseDeveloperCopilotDiagnostics,
  getCopilotRoleCategory,
} from '@/services/chatbot/copilot-rbac';
import type { UserChatProfile } from '@/types/chatbot';

function profile(roleNames: string[], departmentId: string | null = 'dept-a'): UserChatProfile {
  return {
    profileId: 'profile-a',
    userId: 'user-a',
    roleNames,
    departmentId,
  };
}

test('copilot role category uses safest broadest role across multiple roles', () => {
  assert.equal(getCopilotRoleCategory(profile(['viewer', 'department_user'])), 'department_user');
  assert.equal(getCopilotRoleCategory(profile(['viewer', 'developer'])), 'developer');
  assert.equal(getCopilotRoleCategory(profile(['store_user', 'technician'])), 'technician');
});

test('copilot diagnostics are developer-only', () => {
  assert.equal(canUseDeveloperCopilotDiagnostics(profile(['developer'])), true);
  assert.equal(canUseDeveloperCopilotDiagnostics(profile(['admin'])), false);
  assert.equal(canExecuteCopilotAction(profile(['developer']), 'developer_smoke_test'), true);
  assert.equal(canExecuteCopilotAction(profile(['bme_head']), 'developer_smoke_test'), false);
});

test('department scope does not leak across departments', () => {
  const deptUser = profile(['department_head'], 'dept-a');
  assert.equal(canReadAllOperationalCopilotContext(deptUser), false);
  assert.equal(canReadCopilotDepartment(deptUser, 'dept-a'), true);
  assert.equal(canReadCopilotDepartment(deptUser, 'dept-b'), false);
  assert.equal(canReadCopilotDepartment(profile(['bme_head'], null), 'dept-b'), true);
});

test('draft permissions are role-aligned and actions remain non-executable in phase 1', () => {
  assert.equal(canCreateCopilotDraft(profile(['department_user']), 'maintenance_request'), true);
  assert.equal(canCreateCopilotDraft(profile(['store_user']), 'procurement_request'), true);
  assert.equal(canCreateCopilotDraft(profile(['viewer']), 'maintenance_request'), false);
  assert.equal(canExecuteCopilotAction(profile(['developer']), 'execute_mutation'), false);
});

