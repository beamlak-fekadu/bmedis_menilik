import type { AssistantContent } from '@/types/chatbot';

const DEFAULT_SUMMARY =
  "I couldn't generate a reliably structured response from the AI provider. Please try again or use the equipment manual/escalation path.";

function stringOrUndefined(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function arrayOfStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
}

export function normalizeAssistantPayload(raw: unknown, fallbackSummary?: string): AssistantContent {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const summary = stringOrUndefined(source.summary) ?? fallbackSummary ?? DEFAULT_SUMMARY;

  const decision = stringOrUndefined(source.decision);
  const answerBasis = stringOrUndefined(source.answer_basis) ?? stringOrUndefined(source.answerBasis);
  const confidence = stringOrUndefined(source.confidence);

  return {
    decision: (decision as AssistantContent['decision']) ?? 'limited_answer',
    title: stringOrUndefined(source.title),
    summary: summary.slice(0, 2000),
    key_findings: arrayOfStrings(source.key_findings ?? source.keyFindings),
    recommended_actions: arrayOfStrings(source.recommended_actions ?? source.recommendedActions),
    priority_reasoning: arrayOfStrings(source.priority_reasoning ?? source.priorityReasoning),
    likely_causes: arrayOfStrings(source.likely_causes ?? source.likelyCauses),
    troubleshooting_steps: arrayOfStrings(source.troubleshooting_steps ?? source.troubleshootingSteps),
    maintenance_tips: arrayOfStrings(source.maintenance_tips ?? source.maintenanceTips),
    required_tools_or_parts: arrayOfStrings(source.required_tools_or_parts ?? source.requiredToolsOrParts),
    actions: arrayOfStrings(source.actions),
    insights: arrayOfStrings(source.insights),
    recommendations: arrayOfStrings(source.recommendations),
    entities_referenced: arrayOfStrings(source.entities_referenced ?? source.entitiesReferenced),
    follow_up_suggestions: arrayOfStrings(source.follow_up_suggestions ?? source.followUpSuggestions),
    escalation_recommendation: stringOrUndefined(source.escalation_recommendation ?? source.escalationRecommendation),
    escalation_guidance: stringOrUndefined(source.escalation_guidance ?? source.escalationGuidance),
    reason_for_limit: stringOrUndefined(source.reason_for_limit ?? source.reasonForLimit),
    answer_basis: (answerBasis as AssistantContent['answer_basis']) ?? 'insufficient_data',
    confidence: (confidence as AssistantContent['confidence']) ?? 'low',
    escalation_required:
      typeof source.escalation_required === 'boolean'
        ? source.escalation_required
        : typeof source.escalationRequired === 'boolean'
          ? source.escalationRequired
          : false,
  };
}
