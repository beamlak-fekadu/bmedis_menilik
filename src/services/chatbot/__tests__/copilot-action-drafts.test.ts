import test from 'node:test';
import assert from 'node:assert/strict';
import { buildActionDraftsFromContext, isOfflineCapableDraft } from '@/services/chatbot/action-draft-service';
import { CopilotActionDraftSchema } from '@/types/copilot-actions';
import type { UserChatProfile } from '@/types/chatbot';

const BME_HEAD: UserChatProfile = {
  profileId: 'bme-head-1',
  roleNames: ['bme_head'],
  departmentId: null,
};

const DEPT_USER: UserChatProfile = {
  profileId: 'dept-user-1',
  roleNames: ['department_user'],
  departmentId: 'dep-A',
};

const VIEWER: UserChatProfile = {
  profileId: 'viewer-1',
  roleNames: ['viewer'],
  departmentId: null,
};

const TECHNICIAN: UserChatProfile = {
  profileId: 'tech-1',
  roleNames: ['technician'],
  departmentId: null,
};

const STORE: UserChatProfile = {
  profileId: 'store-1',
  roleNames: ['store_user'],
  departmentId: null,
};

test('viewer never gets mutation drafts', () => {
  const drafts = buildActionDraftsFromContext({
    profile: VIEWER,
    capability: 'summarize_equipment',
    message: 'Please create a maintenance request for this monitor, it is not working',
    evidenceSignals: [],
    contextRefs: { equipmentId: 'asset-1' },
  });
  for (const draft of drafts) {
    assert.notEqual(draft.kind, 'maintenance_request_create');
    assert.notEqual(draft.kind, 'department_issue_report');
    assert.notEqual(draft.kind, 'reorder_request_create');
  }
});

test('BME head can draft a maintenance request when an asset is linked', () => {
  const drafts = buildActionDraftsFromContext({
    profile: BME_HEAD,
    capability: 'summarize_equipment',
    message: 'This monitor is not working — please create a maintenance request',
    evidenceSignals: ['equipment: MON-001'],
    contextRefs: { equipmentId: 'asset-1' },
  });
  const maintenanceDraft = drafts.find((draft) => draft.kind === 'maintenance_request_create');
  assert.ok(maintenanceDraft, 'should suggest maintenance_request_create');
  assert.equal(maintenanceDraft.executionMode, 'confirm_then_execute');
  // Must validate against zod schema.
  const parsed = CopilotActionDraftSchema.safeParse(maintenanceDraft);
  assert.equal(parsed.success, true);
});

test('department user gets department_issue_report scoped to their department', () => {
  const drafts = buildActionDraftsFromContext({
    profile: DEPT_USER,
    capability: 'summarize_equipment',
    message: 'Report a problem with this device — it stopped working today.',
    evidenceSignals: [],
    contextRefs: { equipmentId: 'asset-9' },
  });
  const dept = drafts.find((draft) => draft.kind === 'department_issue_report');
  assert.ok(dept, 'should suggest department issue report');
  assert.equal(dept.contextRefs?.departmentId, 'dep-A');
});

test('technician can draft a maintenance event note when work order is linked', () => {
  const drafts = buildActionDraftsFromContext({
    profile: TECHNICIAN,
    capability: 'summarize_work_order',
    message: 'Log a maintenance note for this work order — replaced fuse',
    evidenceSignals: [],
    contextRefs: { workOrderId: 'wo-1', equipmentId: 'asset-2' },
  });
  const note = drafts.find((draft) => draft.kind === 'maintenance_event_note');
  assert.ok(note, 'should suggest maintenance event note');
});

test('store user can draft a reorder request', () => {
  const drafts = buildActionDraftsFromContext({
    profile: STORE,
    capability: 'logistics_status',
    message: 'Please reorder this part — we are running low on stock',
    evidenceSignals: [],
    contextRefs: {},
  });
  const reorder = drafts.find((draft) => draft.kind === 'reorder_request_create');
  assert.ok(reorder, 'should suggest reorder draft');
});

test('non-mutation intent yields no mutation drafts', () => {
  const drafts = buildActionDraftsFromContext({
    profile: BME_HEAD,
    capability: 'summarize_equipment',
    message: 'How does this metric work?',
    evidenceSignals: [],
    contextRefs: {},
  });
  for (const draft of drafts) {
    assert.notEqual(draft.executionMode, 'confirm_then_execute');
  }
});

test('summary request does not show action drafts', () => {
  const drafts = buildActionDraftsFromContext({
    profile: BME_HEAD,
    capability: 'summarize_equipment',
    message: 'Summarize this asset and tell me what is happening',
    evidenceSignals: ['equipment: MON-001'],
    contextRefs: { equipmentId: 'asset-1' },
  });
  assert.deepEqual(drafts, []);
});

test('stock blocker question does not draft procurement unless explicitly requested', () => {
  const drafts = buildActionDraftsFromContext({
    profile: STORE,
    capability: 'logistics_status',
    message: 'Which stockouts are blocking work?',
    evidenceSignals: ['2 low stock rows'],
    contextRefs: {},
  });
  assert.deepEqual(drafts, []);
});

test('isOfflineCapableDraft maps the expected draft kinds', () => {
  assert.equal(isOfflineCapableDraft('maintenance_request_create'), true);
  assert.equal(isOfflineCapableDraft('calibration_request_create'), true);
  assert.equal(isOfflineCapableDraft('training_request_create'), true);
  assert.equal(isOfflineCapableDraft('reorder_request_create'), true);
  assert.equal(isOfflineCapableDraft('maintenance_event_note'), true);
  assert.equal(isOfflineCapableDraft('department_issue_report'), true);
  assert.equal(isOfflineCapableDraft('open_record'), false);
  assert.equal(isOfflineCapableDraft('work_order_closure_note'), false);
});
