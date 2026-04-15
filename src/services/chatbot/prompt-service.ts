import type { ChatDecision, ChatEvidence, ChatIntent } from '@/types/chatbot';

export const CHATBOT_SYSTEM_PROMPT = `
You are a hospital biomedical equipment assistant.
You only answer within medical equipment management workflows.
Allowed scope: maintenance tips, preventive maintenance, safe first-line troubleshooting, work-order support, equipment status explanation, analytics explanation, calibration/logistics explanation.
Never provide manufacturer-specific repair steps, exact error-code meanings, calibration service-mode procedures, board-level servicing, bypass or override instructions unless explicitly grounded in provided context.
If context is insufficient, say:
"I can't provide that reliably from the available information. Check the equipment manual or escalate to a qualified biomedical engineer/vendor."
Prefer check-manual or escalation over guessing.
Keep responses concise, operational, and professional.
Return JSON only.
`.trim();

export function buildPromptPayload(params: {
  message: string;
  intent: ChatIntent;
  decision: ChatDecision;
  evidence: ChatEvidence;
}) {
  const { message, intent, decision, evidence } = params;

  const groundingContext = {
    intent,
    requiredDecision: decision,
    evidence: {
      equipment: evidence.equipment,
      workOrder: evidence.workOrder,
      department: evidence.department,
      maintenanceHistory: evidence.maintenanceHistory,
      pmSnapshot: evidence.pmSnapshot,
      calibrationStatus: evidence.calibrationStatus,
      logisticsSnapshot: evidence.logisticsSnapshot,
      analyticsSnapshot: evidence.analyticsSnapshot,
      manualOrSopTexts: evidence.manualOrSopTexts,
      evidenceSignals: evidence.evidenceSignals,
    },
    outputContract: {
      decision: 'answer | limited_answer | check_manual | escalate | refuse',
      summary: 'string',
      likely_causes: 'string[]',
      troubleshooting_steps: 'string[]',
      maintenance_tips: 'string[]',
      required_tools_or_parts: 'string[]',
      escalation_recommendation: 'string | optional',
      reason_for_limit: 'string | optional',
      answer_basis: 'system_data | manual_or_sop | general_safe_guidance | insufficient_data',
      confidence: 'high | medium | low',
      escalation_required: 'boolean',
    },
  };

  const userPrompt = `
User request:
${message}

Grounding context (JSON):
${JSON.stringify(groundingContext)}

Instructions:
- Respect requiredDecision.
- Do not add unsupported technical details.
- Keep list fields concise and practical.
- If requiredDecision is check_manual/escalate/refuse, make summary direct and operational.
- Never claim model-specific or manufacturer-specific procedures unless explicit manualOrSopTexts evidence exists.
- Include reason_for_limit whenever requiredDecision is limited_answer, check_manual, escalate, or refuse.
- If decision is limited_answer, provide only safe first-line checks and clearly recommend escalation criteria.
- Return JSON only and match outputContract keys exactly.
`.trim();

  return {
    systemPrompt: CHATBOT_SYSTEM_PROMPT,
    userPrompt,
  };
}
