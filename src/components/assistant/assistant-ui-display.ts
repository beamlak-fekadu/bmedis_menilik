import type { AssistantContent } from '@/types/chatbot';

const DISPLAY_REPAIR_SUMMARY =
  "I could not finish formatting a response. Try rephrasing, or open the relevant page (asset, work order, report) and ask again.";
const EMPTY_SUMMARY =
  "I do not have enough context to answer that yet. Open the asset, work order, request, or report you want help with and ask again.";

export function displayableAssistantSummary(summary: string | undefined) {
  const raw = (summary ?? '').trim();
  if (!raw) return EMPTY_SUMMARY;
  if (/^```/.test(raw)) return DISPLAY_REPAIR_SUMMARY;
  if (/^\{[\s\S]*\}$/.test(raw)) return DISPLAY_REPAIR_SUMMARY;
  if (/"summary"\s*:|{"decision"|{"title"/i.test(raw)) return DISPLAY_REPAIR_SUMMARY;
  // Defensive client-side guard for [object Object] and bare "undefined"/"null"
  // tokens that can sneak into provider text fields.
  const cleaned = raw
    .replace(/\[object Object\]/g, '')
    .replace(/\bundefined\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!cleaned) return EMPTY_SUMMARY;
  return cleaned;
}

export function buildAssistantCopyText(assistant: AssistantContent) {
  const sections = [
    assistant.title ? `Title: ${assistant.title}` : '',
    `Summary: ${displayableAssistantSummary(assistant.summary)}`,
    assistant.key_findings?.length ? `Key findings:\n- ${assistant.key_findings.join('\n- ')}` : '',
    assistant.recommended_actions?.length ? `Recommended actions:\n- ${assistant.recommended_actions.join('\n- ')}` : '',
    assistant.priority_reasoning?.length ? `Priority reasoning:\n- ${assistant.priority_reasoning.join('\n- ')}` : '',
    assistant.likely_causes?.length ? `Likely causes:\n- ${assistant.likely_causes.join('\n- ')}` : '',
    assistant.troubleshooting_steps?.length ? `Troubleshooting steps:\n- ${assistant.troubleshooting_steps.join('\n- ')}` : '',
    assistant.maintenance_tips?.length ? `Maintenance tips:\n- ${assistant.maintenance_tips.join('\n- ')}` : '',
    assistant.required_tools_or_parts?.length ? `Required tools or parts:\n- ${assistant.required_tools_or_parts.join('\n- ')}` : '',
    assistant.evidence_used?.length ? `Evidence used:\n- ${assistant.evidence_used.join('\n- ')}` : '',
    assistant.links?.length ? `Links:\n- ${assistant.links.map((link) => `${link.label}: ${link.href}`).join('\n- ')}` : '',
    assistant.limitations?.length ? `Limitations:\n- ${assistant.limitations.join('\n- ')}` : '',
    assistant.source_tables?.length ? `Source tables: ${assistant.source_tables.join(', ')}` : '',
    assistant.data_freshness ? `Data freshness: ${assistant.data_freshness}` : '',
    assistant.escalation_recommendation ? `Escalation recommendation: ${assistant.escalation_recommendation}` : '',
    assistant.intelligence_mode ? `Intelligence mode: ${assistant.intelligence_mode}` : '',
    assistant.proactive_signals?.length ? `Operational signals:\n- ${assistant.proactive_signals.join('\n- ')}` : '',
  ];
  return sections.filter(Boolean).join('\n\n');
}
