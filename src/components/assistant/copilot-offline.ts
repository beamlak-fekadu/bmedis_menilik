'use client';

import { enqueueOfflineAction } from '@/lib/offline/queue';
import type { OfflineActionType, JsonSafeObject } from '@/types/offline';
import type { CopilotActionDraft, CopilotActionKind } from '@/types/copilot-actions';

const OFFLINE_KIND_TO_TYPE: Partial<Record<CopilotActionKind, OfflineActionType>> = {
  maintenance_request_create: 'maintenance_request.create',
  department_issue_report: 'maintenance_request.create',
  maintenance_event_note: 'maintenance_event.log',
  calibration_request_create: 'calibration_request.create',
  training_request_create: 'training_request.create',
  reorder_request_create: 'store_reorder.create',
};

export function isOfflineCapableExecutionMode(draft: CopilotActionDraft): boolean {
  return Boolean(OFFLINE_KIND_TO_TYPE[draft.kind]);
}

export async function enqueueOfflineDraft(params: {
  draft: CopilotActionDraft;
  overrides: Record<string, string | number | boolean | null>;
  sessionId?: string;
  messageId?: string;
}): Promise<{ ok: true; clientActionId: string } | { ok: false; error: string }> {
  const { draft, overrides, sessionId, messageId } = params;
  const actionType = OFFLINE_KIND_TO_TYPE[draft.kind];
  if (!actionType) {
    return { ok: false, error: 'This draft cannot be queued offline' };
  }
  const payload: JsonSafeObject = {
    ...(draft.payload as JsonSafeObject),
    ...(overrides as JsonSafeObject),
  };
  try {
    const record = await enqueueOfflineAction({
      action_type: actionType,
      entity_type: draft.kind,
      asset_id: draft.contextRefs?.assetId ?? null,
      entity_id: draft.contextRefs?.requestId ?? null,
      payload,
      source_route: draft.sourceRoute ?? (typeof window !== 'undefined' ? window.location.pathname : null),
      metadata: {
        queued_from: 'copilot',
        copilot_kind: draft.kind,
        copilot_session_id: sessionId ?? null,
        copilot_message_id: messageId ?? null,
        copilot_draft_id: draft.id,
      },
    });
    return { ok: true, clientActionId: record.client_action_id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to queue copilot draft' };
  }
}
