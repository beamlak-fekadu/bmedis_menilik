import type { ChatDecision, ChatEvidence, ChatIntent, SafetyEvaluation, UserChatProfile } from '@/types/chatbot';

export const STANDARD_RESPONSES = {
  checkManual:
    "I can't provide that reliably from the available information. Check the equipment manual or approved service documentation.",
  limitedTechnical:
    "I can suggest safe first-line checks, but I can't reliably interpret that exact technical detail here. Check the manual or escalate.",
  escalate: 'This request needs escalation to a qualified biomedical engineer or vendor.',
  outOfScope:
    "I'm limited to medical equipment management support, including maintenance, troubleshooting, PM, work orders, calibration/logistics, and equipment analytics.",
} as const;

const ROLE_INTENT_BLOCKS: Record<string, ChatIntent[]> = {
  viewer: ['troubleshooting', 'calibration_or_logistics', 'analytics_explanation', 'work_order_help'],
  store_user: ['troubleshooting', 'work_order_help'],
};

const EXACT_ERROR_CODE_PATTERN = /\b(error\s*code|code\s*[a-z]?\d{2,}|E\d{2,})\b/i;
const CALIBRATION_EXACT_PATTERN = /\b(exact|step[-\s]?by[-\s]?step|service mode|calibrat(e|ion)\s+this model)\b/i;
const DEEP_REPAIR_PATTERN = /\b(board|component|pcb|solder|firmware|internal repair|replace board)\b/i;

function roleRestrictedIntent(intent: ChatIntent, roleNames: string[]): boolean {
  for (const role of roleNames) {
    const blocked = ROLE_INTENT_BLOCKS[role];
    if (blocked?.includes(intent)) return true;
  }
  return false;
}

function hasGroundedContext(evidence: ChatEvidence) {
  const analyticsSnapshot = evidence.analyticsSnapshot as
    | {
        risk?: unknown;
        reliability?: unknown;
        replacement?: unknown;
        pmCompliance?: unknown[];
        recommendationFlags?: unknown[];
      }
    | null;

  const hasDepartmentAnalytics = Boolean(
    (Array.isArray(analyticsSnapshot?.pmCompliance) && analyticsSnapshot.pmCompliance.length > 0) ||
      (Array.isArray(analyticsSnapshot?.recommendationFlags) && analyticsSnapshot.recommendationFlags.length > 0)
  );

  return Boolean(
    evidence.equipment ||
      evidence.workOrder ||
      evidence.department ||
      evidence.maintenanceHistory.length > 0 ||
      evidence.pmSnapshot ||
      evidence.calibrationStatus ||
      evidence.logisticsSnapshot ||
      evidence.manualOrSopTexts.length > 0 ||
      analyticsSnapshot?.risk ||
      analyticsSnapshot?.reliability ||
      analyticsSnapshot?.replacement ||
      hasDepartmentAnalytics
  );
}

export function evaluateSafetyDecision(
  message: string,
  intent: ChatIntent,
  profile: UserChatProfile,
  evidence: ChatEvidence
): SafetyEvaluation {
  const normalizedMessage = message.trim();

  if (intent === 'out_of_scope') {
    return {
      decision: 'refuse',
      blocked: true,
      answerBasis: 'insufficient_data',
      confidence: 'low',
      reason: STANDARD_RESPONSES.outOfScope,
      escalationRequired: false,
    };
  }

  if (intent === 'unsafe') {
    return {
      decision: 'escalate',
      blocked: true,
      answerBasis: 'insufficient_data',
      confidence: 'low',
      reason: STANDARD_RESPONSES.escalate,
      escalationRequired: true,
    };
  }

  if (evidence.accessDenied) {
    return {
      decision: 'refuse',
      blocked: true,
      answerBasis: 'insufficient_data',
      confidence: 'low',
      reason: 'I cannot access one or more requested context items with your current permissions.',
      escalationRequired: false,
    };
  }

  if (roleRestrictedIntent(intent, profile.roleNames)) {
    return {
      decision: 'refuse',
      blocked: true,
      answerBasis: 'insufficient_data',
      confidence: 'low',
      reason: 'Your role is limited for this request scope. Please contact a biomedical engineer or administrator.',
      escalationRequired: false,
    };
  }

  if (intent === 'too_detailed') {
    return {
      decision: 'check_manual',
      blocked: true,
      answerBasis: 'insufficient_data',
      confidence: 'low',
      reason: STANDARD_RESPONSES.checkManual,
      escalationRequired: false,
    };
  }

  const hasManualSupport = evidence.manualOrSopTexts.length > 0;
  const hasEvidence = hasGroundedContext(evidence);
  const isDepartmentUser = profile.roleNames.includes('department_user') && !profile.roleNames.includes('admin');
  const asksExactErrorCode = EXACT_ERROR_CODE_PATTERN.test(normalizedMessage);
  const asksExactCalibration = CALIBRATION_EXACT_PATTERN.test(normalizedMessage);
  const asksDeepRepair = DEEP_REPAIR_PATTERN.test(normalizedMessage);

  if ((asksExactErrorCode || asksExactCalibration) && !hasManualSupport) {
    return {
      decision: 'check_manual',
      blocked: true,
      answerBasis: 'insufficient_data',
      confidence: 'low',
      reason: STANDARD_RESPONSES.checkManual,
      escalationRequired: false,
    };
  }

  const equipmentCriticality = ((evidence.equipment?.equipment_categories as { criticality_level?: string } | undefined)?.criticality_level ?? '') as string;
  if (asksDeepRepair && ['high', 'critical'].includes(equipmentCriticality) && !hasManualSupport) {
    return {
      decision: 'escalate',
      blocked: true,
      answerBasis: 'insufficient_data',
      confidence: 'low',
      reason: STANDARD_RESPONSES.escalate,
      escalationRequired: true,
    };
  }

  if (!hasEvidence) {
    return {
      decision: 'check_manual',
      blocked: true,
      answerBasis: 'insufficient_data',
      confidence: 'low',
      reason: STANDARD_RESPONSES.checkManual,
      escalationRequired: false,
    };
  }

  if (intent === 'analytics_explanation' && isDepartmentUser) {
    return {
      decision: 'limited_answer',
      blocked: false,
      answerBasis: 'system_data',
      confidence: 'medium',
      reason: 'Department-level analytics explanation only for this role.',
      escalationRequired: false,
    };
  }

  if (intent === 'troubleshooting' || intent === 'calibration_or_logistics') {
    return {
      decision: 'limited_answer',
      blocked: false,
      answerBasis: hasManualSupport ? 'manual_or_sop' : 'general_safe_guidance',
      confidence: hasManualSupport ? 'medium' : 'low',
      reason: hasManualSupport ? 'Manual snippets found; provide constrained guidance.' : 'Provide only safe first-line checks.',
      escalationRequired: false,
    };
  }

  const decision: ChatDecision = 'answer';
  return {
    decision,
    blocked: false,
    answerBasis: hasManualSupport ? 'manual_or_sop' : 'system_data',
    confidence: hasManualSupport ? 'high' : 'medium',
    reason: 'Sufficient scoped evidence available.',
    escalationRequired: false,
  };
}
