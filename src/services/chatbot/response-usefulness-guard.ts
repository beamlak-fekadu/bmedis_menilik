import type { AssistantContent, CapabilityId } from '@/types/chatbot';

type GuardParams = {
  assistant: AssistantContent;
  deterministic: AssistantContent | null;
  capability: CapabilityId;
  evidenceAvailable: boolean;
  providerFallback?: boolean;
  parserRecoveryUsed?: boolean;
};

const GENERIC_PATTERNS = [
  /\byou should review (the )?(dashboard|records|system)\b/i,
  /\bcheck critical equipment\b/i,
  /\bplease provide more information\b/i,
  /\bplease provide (the )?(asset|work order|equipment)/i,
  /\bI (?:could not|couldn't) (?:generate|load|find)\b/i,
  /\bAI (?:unavailable|service is busy|temporarily unavailable)\b/i,
  /\btry again in a few seconds\b/i,
  /\bopen the related asset, work order, or report page\b/i,
  /\bI need a bit more context\b/i,
  /\bI cleaned up internal metadata\b/i,
  /\btry rephrasing if the answer feels incomplete\b/i,
];

function uniqueStrings(items: string[], max: number) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, max);
}

function uniqueLinks(links: AssistantContent['links']) {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.label}:${link.href}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}

function looksGeneric(assistant: AssistantContent) {
  const text = [assistant.title ?? '', assistant.summary, ...assistant.recommended_actions, ...assistant.key_findings].join(' ');
  if (GENERIC_PATTERNS.some((pattern) => pattern.test(text))) return true;
  if (assistant.answer_basis === 'insufficient_data' && assistant.confidence === 'low') return true;
  if (assistant.summary.length < 80 && assistant.evidence_used.length === 0 && assistant.links.length === 0) return true;
  return false;
}

function cleanUncertainLanguage(summary: string, evidenceAvailable: boolean) {
  if (!evidenceAvailable) return summary;
  return summary
    .replace(/\bI think\b/gi, 'Based on current system records,')
    .replace(/\bProbably\b/g, 'The available evidence suggests')
    .replace(/\bprobably\b/g, 'the available evidence suggests')
    .replace(/\bMaybe\b/g, 'This appears to be possible from the available evidence:')
    .replace(/\bmaybe\b/g, 'this appears possible from the available evidence');
}

function mergeEvidence(assistant: AssistantContent, deterministic: AssistantContent): AssistantContent {
  return {
    ...assistant,
    summary: cleanUncertainLanguage(assistant.summary, deterministic.evidence_used.length > 0),
    evidence_used: uniqueStrings([...assistant.evidence_used, ...deterministic.evidence_used], 12),
    links: uniqueLinks([...(assistant.links ?? []), ...(deterministic.links ?? [])]),
    limitations: uniqueStrings([...assistant.limitations, ...deterministic.limitations], 8),
    source_tables: uniqueStrings([...assistant.source_tables, ...deterministic.source_tables], 12),
    data_freshness: assistant.data_freshness ?? deterministic.data_freshness,
    answer_basis: assistant.answer_basis === 'model_output' && deterministic.answer_basis === 'system_data'
      ? 'system_data'
      : assistant.answer_basis,
    confidence: assistant.confidence === 'low' && deterministic.confidence !== 'low' ? deterministic.confidence : assistant.confidence,
  };
}

function replacementReason(params: GuardParams) {
  if (params.providerFallback) return 'Gemini did not complete, so BMERMS used retrieved system context.';
  if (params.parserRecoveryUsed) return 'Provider output needed recovery, so BMERMS used retrieved system context.';
  return 'Model response was too generic for the available system evidence.';
}

export function applyResponseUsefulnessGuard(params: GuardParams): AssistantContent {
  const { assistant, deterministic, evidenceAvailable, providerFallback, parserRecoveryUsed } = params;
  if (!deterministic) return { ...assistant, summary: cleanUncertainLanguage(assistant.summary, evidenceAvailable) };

  const shouldReplace =
    providerFallback ||
    parserRecoveryUsed ||
    (evidenceAvailable && looksGeneric(assistant)) ||
    (deterministic.answer_basis === 'system_data' && assistant.answer_basis === 'insufficient_data');

  if (shouldReplace) {
    return {
      ...deterministic,
      decision: assistant.decision,
      action_drafts: assistant.action_drafts ?? [],
      routing_explanation: uniqueStrings([
        ...deterministic.routing_explanation,
        ...assistant.routing_explanation,
        replacementReason(params),
      ], 8),
      limitations: uniqueStrings([...deterministic.limitations, ...assistant.limitations], 8),
      reason_for_limit: assistant.reason_for_limit ?? deterministic.reason_for_limit,
    };
  }

  return mergeEvidence(assistant, deterministic);
}
