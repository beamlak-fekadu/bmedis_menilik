/**
 * Data-lineage helper for the BMEDIS Copilot.
 *
 * Maps a Copilot capability + retrieved-evidence state to a structured
 * lineage tag (`live | snapshot | stale | sandbox | missing | unknown`) plus
 * a plain-language freshness sentence and an optional age label.
 *
 * Used by the orchestrator to populate AssistantContent.data_mode /
 * data_freshness / data_age_label so normal roles can see *honestly* whether
 * a number is live, a stored snapshot, a developer-only simulation, stale,
 * or absent. Developer roles still get the technical detail via the score
 * registry / Developer Lab.
 *
 * Mapping rationale:
 *   - Operational lookups (work orders, equipment, requests, calibration,
 *     procurement, logistics, training, disposal, QR, offline sync) read
 *     row-level state at query time → "live".
 *   - Decision-support / readiness / risk / replacement priority / FMEA
 *     compositions are persisted snapshots refreshed by an explicit
 *     refresh job → "snapshot".
 *   - Developer Lab "what if" sensitivity tabs and unsaved weight changes
 *     → "sandbox".
 *   - Empty / no-evidence operational responses → "missing".
 *   - Onboarding / general-conversation / refusal / unknown → "unknown".
 */

import type { AssistantContent, CapabilityId, ChatEvidence } from '@/types/chatbot';

export type DataMode = NonNullable<AssistantContent['data_mode']>;

const SNAPSHOT_CAPABILITIES: ReadonlySet<CapabilityId> = new Set<CapabilityId>([
  'summarize_department_readiness',
  'summarize_alerts',
  'explain_equipment_risk',
  'metric_debug',
]);

const LIVE_CAPABILITIES: ReadonlySet<CapabilityId> = new Set<CapabilityId>([
  'summarize_equipment',
  'summarize_work_order',
  'explain_pm_status',
  'logistics_status',
  'procurement_status',
  'training_status',
  'disposal_status',
  'qr_asset_context',
  'offline_sync_status',
  'report_summary',
  'my_tasks',
  'prioritize_tasks',
  'safe_troubleshooting',
  'maintenance_tips',
]);

const UNKNOWN_CAPABILITIES: ReadonlySet<CapabilityId> = new Set<CapabilityId>([
  'assistant_intro',
  'general_conversation',
  'off_topic_safe',
  'unsafe_or_restricted',
  'general_system_fallback',
  'copilot_diagnostics',
  'usage_status',
]);

export function describeDataModePhrase(mode: DataMode): string {
  switch (mode) {
    case 'live':
      return 'This answer reads current BMEDIS records at the time of the question.';
    case 'snapshot':
      return 'This is a stored snapshot metric; refresh decision-support snapshots in Developer Lab if it looks out of date.';
    case 'stale':
      return 'The underlying snapshot is older than expected. Refresh decision-support snapshots in Developer Lab before relying on it.';
    case 'sandbox':
      return 'This is a developer-only sensitivity simulation. It does not affect operational pages.';
    case 'missing':
      return 'No matching BMEDIS records were retrieved for this scope. The answer is limited to available context.';
    case 'unknown':
    default:
      return 'Data freshness is not applicable to this response.';
  }
}

export interface ResolvedDataLineage {
  data_mode: DataMode;
  data_freshness: string;
  data_age_label?: string;
}

function hasOperationalEvidence(evidence: ChatEvidence | undefined): boolean {
  if (!evidence) return false;
  return Boolean(
    evidence.equipment ||
      evidence.workOrder ||
      evidence.department ||
      evidence.maintenanceHistory.length > 0 ||
      evidence.pmSnapshot ||
      evidence.calibrationStatus ||
      evidence.logisticsSnapshot ||
      evidence.analyticsSnapshot
  );
}

/**
 * Resolve the data lineage of a Copilot response.
 *
 * Inputs:
 *   - capability: the Copilot capability driving the answer.
 *   - evidence: the retrieved BMEDIS evidence object.
 *   - sandboxOverride: set to `true` if the answer was driven by a
 *     developer-only sensitivity tab (Developer Lab simulation).
 *   - explicitMode: if the deterministic or tool layer already knows the
 *     mode (e.g. score-registry dataMode), pass it through.
 *   - ageLabel: optional age string ("computed 38m ago", "as of 2026-05-19").
 */
export function resolveDataLineage(params: {
  capability: CapabilityId;
  evidence?: ChatEvidence;
  sandboxOverride?: boolean;
  explicitMode?: DataMode;
  ageLabel?: string;
}): ResolvedDataLineage {
  const { capability, evidence, sandboxOverride, explicitMode, ageLabel } = params;
  if (explicitMode) {
    return {
      data_mode: explicitMode,
      data_freshness: describeDataModePhrase(explicitMode),
      data_age_label: ageLabel,
    };
  }
  if (sandboxOverride) {
    return {
      data_mode: 'sandbox',
      data_freshness: describeDataModePhrase('sandbox'),
      data_age_label: ageLabel,
    };
  }
  if (UNKNOWN_CAPABILITIES.has(capability)) {
    return {
      data_mode: 'unknown',
      data_freshness: describeDataModePhrase('unknown'),
      data_age_label: ageLabel,
    };
  }

  const hasEvidence = hasOperationalEvidence(evidence);

  if (SNAPSHOT_CAPABILITIES.has(capability)) {
    if (!hasEvidence) {
      return {
        data_mode: 'missing',
        data_freshness: describeDataModePhrase('missing'),
        data_age_label: ageLabel,
      };
    }
    return {
      data_mode: 'snapshot',
      data_freshness: describeDataModePhrase('snapshot'),
      data_age_label: ageLabel,
    };
  }

  if (LIVE_CAPABILITIES.has(capability)) {
    if (!hasEvidence) {
      return {
        data_mode: 'missing',
        data_freshness: describeDataModePhrase('missing'),
        data_age_label: ageLabel,
      };
    }
    return {
      data_mode: 'live',
      data_freshness: describeDataModePhrase('live'),
      data_age_label: ageLabel,
    };
  }

  return {
    data_mode: hasEvidence ? 'live' : 'missing',
    data_freshness: describeDataModePhrase(hasEvidence ? 'live' : 'missing'),
    data_age_label: ageLabel,
  };
}
