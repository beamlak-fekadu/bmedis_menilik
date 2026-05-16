'use server';

import { createClient } from '@/lib/supabase/server';
import {
  CopilotExecuteDraftRequestSchema,
  type CopilotActionDraft,
  type CopilotActionResult,
} from '@/types/copilot-actions';
import { canCreateCopilotDraft, getCopilotRoleCategory } from '@/services/chatbot/copilot-rbac';
import { createMaintenanceRequestAction, createMaintenanceEventAction } from './maintenance.actions';
import { createCalibrationRequestAction } from './calibration.actions';
import { createTrainingRequestAction } from './training.actions';
import { createProcurementRequestAction } from './procurement.actions';
import { logServerAuditEvent } from './_shared';

type ResultWithRecord = CopilotActionResult & { createdRecordId?: string };

async function loadCopilotActor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, profile: null, error: 'Not authenticated' as const };
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, department_id, full_name, email')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) return { supabase, profile: null, error: 'Profile not found' as const };
  const { data: rolesRows } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', profile.id as string);
  const roleNames = ((rolesRows ?? []) as Array<Record<string, unknown>>)
    .map((row) => ((row.roles as { name?: string } | null)?.name ?? null))
    .filter(Boolean) as string[];
  return {
    supabase,
    profile: {
      id: profile.id as string,
      departmentId: (profile.department_id as string | null) ?? null,
      fullName: (profile.full_name as string | null) ?? null,
      email: (profile.email as string | null) ?? null,
      roleNames,
    },
    error: null,
  };
}

function draftTypeFromKind(draft: CopilotActionDraft) {
  switch (draft.kind) {
    case 'maintenance_request_create':
    case 'department_issue_report':
      return 'maintenance_request';
    case 'calibration_request_create':
      return 'calibration_request';
    case 'training_request_create':
      return 'training_request';
    case 'reorder_request_create':
      return 'procurement_request';
    case 'maintenance_event_note':
    case 'work_order_closure_note':
      return 'work_order_note';
    default:
      return null;
  }
}

function mergePayload(draft: CopilotActionDraft, overrides?: Record<string, unknown>): Record<string, unknown> {
  // Only allow editable fields to be overridden, and only with primitive values.
  const editableNames = new Set(draft.fields.filter((field) => field.editable).map((field) => field.name));
  const merged: Record<string, unknown> = { ...draft.payload };
  if (!overrides) return merged;
  for (const [key, value] of Object.entries(overrides)) {
    if (!editableNames.has(key)) continue;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      merged[key] = value;
    }
  }
  return merged;
}

function recordRoute(draft: CopilotActionDraft, recordId: string | undefined): string | undefined {
  if (!recordId) return undefined;
  switch (draft.kind) {
    case 'maintenance_request_create':
    case 'department_issue_report':
      return `/maintenance/requests/${recordId}`;
    case 'calibration_request_create':
      return `/calibration/requests/${recordId}`;
    case 'training_request_create':
      return `/training?source=copilot`;
    case 'reorder_request_create':
      return `/command/drilldown/procurement/${recordId}`;
    case 'maintenance_event_note':
      return draft.contextRefs?.workOrderId
        ? `/maintenance/work-orders/${draft.contextRefs.workOrderId}`
        : `/maintenance`;
    default:
      return undefined;
  }
}

export async function executeCopilotActionDraftAction(input: unknown): Promise<CopilotActionResult> {
  const parsed = CopilotExecuteDraftRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'failed', error: 'Invalid copilot action draft request' };
  }
  const { draft, sessionId, messageId, overrides } = parsed.data;
  const { supabase, profile, error } = await loadCopilotActor();
  if (error || !profile) {
    return { status: 'failed', error: error ?? 'Unauthorized' };
  }

  const draftType = draftTypeFromKind(draft);
  if (!draftType) {
    return { status: 'failed', error: 'This copilot action cannot be executed server-side. Open the record or copy the draft instead.' };
  }
  // Re-check role at the boundary — copilot UI hides drafts, but server is authority.
  if (!canCreateCopilotDraft({ roleNames: profile.roleNames }, draftType as never)) {
    return { status: 'blocked', error: 'Your role cannot execute this copilot draft' };
  }

  // Department scope guard for department-only roles.
  const roleCategory = getCopilotRoleCategory({ roleNames: profile.roleNames });
  if (
    (roleCategory === 'department_head' || roleCategory === 'department_user') &&
    draft.contextRefs?.departmentId &&
    profile.departmentId &&
    draft.contextRefs.departmentId !== profile.departmentId
  ) {
    return { status: 'blocked', error: 'Action is outside your department scope' };
  }

  // Drafts marked draft_only / link_only cannot be server-executed.
  if (draft.executionMode === 'draft_only' || draft.executionMode === 'link_only') {
    return { status: 'failed', error: 'This draft is review-only and not executed by the copilot.' };
  }

  const payload = mergePayload(draft, overrides);
  let actionResult: { success: boolean; error?: string; data?: unknown } = { success: false, error: 'Unsupported draft' };

  try {
    switch (draft.kind) {
      case 'maintenance_request_create':
      case 'department_issue_report':
        actionResult = await createMaintenanceRequestAction(payload as Record<string, unknown>);
        break;
      case 'calibration_request_create':
        actionResult = await createCalibrationRequestAction(payload as Record<string, unknown>);
        break;
      case 'training_request_create':
        actionResult = await createTrainingRequestAction(payload as Record<string, unknown>);
        break;
      case 'reorder_request_create':
        actionResult = await createProcurementRequestAction(payload as Record<string, unknown>);
        break;
      case 'maintenance_event_note':
        actionResult = await createMaintenanceEventAction(payload as Record<string, unknown>);
        break;
      default:
        actionResult = { success: false, error: 'Unsupported draft kind' };
    }
  } catch (err) {
    actionResult = { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  if (!actionResult.success) {
    // Surface duplicate-open-request conflicts as conflict, not generic failure.
    const data = (actionResult.data ?? null) as { reason?: string; existingRequestId?: string; existingRequestNumber?: string } | null;
    if (data?.reason === 'duplicate_open_request' && data.existingRequestId) {
      return {
        status: 'conflict',
        message: actionResult.error,
        conflictReason: 'duplicate_open_request',
        existingRecordId: data.existingRequestId,
        existingRecordRoute: `/maintenance/requests/${data.existingRequestId}`,
        error: actionResult.error,
      };
    }
    return { status: 'failed', error: actionResult.error ?? 'Copilot draft execution failed' };
  }

  const createdRecord = (actionResult.data ?? null) as { id?: string } | null;
  const createdRecordId = createdRecord?.id;
  // Assistant-assisted action audit log — links draft + chat session/message + record + actor.
  await logServerAuditEvent({
    supabase,
    profileId: profile.id,
    action: `copilot.draft.executed.${draft.kind}`,
    entityType: 'copilot_action_drafts',
    entityId: draft.id,
    newValues: {
      kind: draft.kind,
      record_id: createdRecordId ?? null,
      payload_keys: Object.keys(payload),
    },
    details: {
      source: 'copilot',
      chat_session_id: sessionId ?? null,
      chat_message_id: messageId ?? null,
      draft_id: draft.id,
      action_kind: draft.kind,
      execution_mode: draft.executionMode,
      risk_level: draft.riskLevel,
      evidence_used: draft.evidenceUsed,
      role_category: roleCategory,
      source_route: draft.sourceRoute ?? null,
      profile_id: profile.id,
    },
  }).catch((err) => console.warn('[copilot] audit log failed', err instanceof Error ? err.message : String(err)));

  const route = recordRoute(draft, createdRecordId);
  return {
    status: 'executed',
    message: 'Copilot-assisted action created. Review the created record before closing.',
    createdRecordId,
    createdRecordRoute: route,
  } satisfies ResultWithRecord;
}
