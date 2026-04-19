import type { SupabaseClient } from '@supabase/supabase-js';
import type { TelemetryEvent } from '@/types/chatbot';

export async function logCopilotTelemetry(
  supabase: SupabaseClient,
  event: TelemetryEvent
) {
  try {
    await supabase
      .from('chat_telemetry_events')
      .insert({
        session_id: event.sessionId,
        query: event.query,
        intent: event.intent,
        capability: event.capability,
        confidence_score: event.confidenceScore,
        confidence_label: event.confidenceLabel,
        decision: event.decision,
        blocked: event.blocked,
        fallback_reason: event.fallbackReason ?? null,
        role_names: event.roleNames,
        module_label: event.moduleLabel ?? null,
        route: event.route ?? null,
        evidence_signals: event.evidenceSignals,
        grounded_by: event.groundedBy ?? null,
        parsing_recovery_used: event.parsingRecoveryUsed ?? false,
        classifier_candidates: event.classifierCandidates ?? null,
        resolved_entities: event.resolvedEntities ?? null,
        latency_ms: event.latencyMs ?? null,
        metadata: event.metadata ?? null,
      })
      .throwOnError();
  } catch {
    // Telemetry should never break user-facing request handling.
  }
}
