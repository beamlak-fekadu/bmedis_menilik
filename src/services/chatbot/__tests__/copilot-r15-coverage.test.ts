import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canCreateCopilotDraft,
  canExecuteCopilotAction,
  canReadAllOperationalCopilotContext,
  getCopilotRoleCategory,
} from '@/services/chatbot/copilot-rbac';
import type { UserChatProfile } from '@/types/chatbot';

// R15: Copilot answers must be role-truthful — every supported role maps
// to a known category, and the most sensitive surfaces (developer
// diagnostics, cross-department reads, executable mutations) are locked
// to the right subset. These tests are the regression baseline that
// keeps Copilot from silently widening its reach as the matrix evolves.

function profile(roleNames: string[], departmentId: string | null = 'dept-a'): UserChatProfile {
  return {
    profileId: 'profile-r15',
    userId: 'user-r15',
    roleNames,
    departmentId,
  };
}

const KNOWN_ROLE_CATEGORIES = [
  'developer',
  'admin',
  'bme_head',
  'technician',
  'department_head',
  'department_user',
  'store_user',
  'viewer',
] as const;

test('every known production role maps to a known Copilot category (no silent unknown)', () => {
  const seen = new Set<string>();
  for (const role of ['developer', 'admin', 'bme_head', 'technician', 'department_head', 'department_user', 'store_user', 'viewer']) {
    const category = getCopilotRoleCategory(profile([role]));
    assert.notEqual(category, 'unknown', `Role ${role} should not fall through to 'unknown' category`);
    seen.add(category);
  }
  for (const cat of seen) {
    assert.ok(
      (KNOWN_ROLE_CATEGORIES as readonly string[]).includes(cat),
      `Unexpected category ${cat} — update KNOWN_ROLE_CATEGORIES or fix the mapping`,
    );
  }
});

test('viewer cannot create ANY mutation draft (Copilot must stay read-only for viewer)', () => {
  for (const draftKind of [
    'maintenance_request',
    'procurement_request',
    'calibration_request',
    'training_request',
    'disposal_request',
  ] as const) {
    assert.equal(
      canCreateCopilotDraft(profile(['viewer']), draftKind),
      false,
      `Viewer must NOT be allowed to draft ${draftKind}`,
    );
  }
});

test('department roles can draft their own department requests but cannot read cross-dept', () => {
  for (const role of ['department_head', 'department_user']) {
    const p = profile([role], 'dept-a');
    assert.equal(canCreateCopilotDraft(p, 'maintenance_request'), true, `${role} can draft maintenance_request`);
    assert.equal(canCreateCopilotDraft(p, 'calibration_request'), true, `${role} can draft calibration_request`);
    assert.equal(canCreateCopilotDraft(p, 'training_request'), true, `${role} can draft training_request`);
    assert.equal(canReadAllOperationalCopilotContext(p), false, `${role} must NOT read all-hospital context`);
  }
});

test('store user can draft procurement requests but not maintenance', () => {
  const p = profile(['store_user']);
  assert.equal(canCreateCopilotDraft(p, 'procurement_request'), true);
  assert.equal(canCreateCopilotDraft(p, 'maintenance_request'), false);
});

test('developer diagnostics actions are developer-only', () => {
  for (const role of ['admin', 'bme_head', 'technician', 'department_head', 'department_user', 'store_user', 'viewer']) {
    assert.equal(
      canExecuteCopilotAction(profile([role]), 'developer_smoke_test'),
      false,
      `${role} must NOT execute developer_smoke_test`,
    );
  }
  assert.equal(canExecuteCopilotAction(profile(['developer']), 'developer_smoke_test'), true);
});

test('mutation execution remains gated (Phase 3 actions still go through their own confirmation)', () => {
  // Even developer must not be able to execute a generic mutation through
  // Copilot without going through the proper action's confirmation modal.
  // canExecuteCopilotAction('execute_mutation') is the catch-all that's
  // locked off for everyone.
  for (const role of ['developer', 'admin', 'bme_head', 'technician', 'department_head', 'department_user', 'store_user', 'viewer']) {
    assert.equal(
      canExecuteCopilotAction(profile([role]), 'execute_mutation'),
      false,
      `${role} must go through proper confirmation flow, not direct Copilot mutation`,
    );
  }
});
