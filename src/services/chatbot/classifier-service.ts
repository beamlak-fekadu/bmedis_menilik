import type { ChatIntent, ClassifiedRequest } from '@/types/chatbot';

const OUT_OF_SCOPE_PATTERNS = [
  /\bdiagnos(is|e)\b/i,
  /\btreatment\b/i,
  /\bprescrib(e|ing|ed)\b/i,
  /\bmedication\b/i,
  /\bdrug dose\b/i,
  /\bpatient\b/i,
  /\bclinical diagnosis\b/i,
];

const UNSAFE_PATTERNS = [
  /\bbypass\b/i,
  /\boverride\b/i,
  /\bdisable safety\b/i,
  /\bhack\b/i,
  /\bservice mode\b/i,
  /\bboard[-\s]?level\b/i,
  /\bfirmware patch\b/i,
];

const TOO_DETAILED_PATTERNS = [
  /\bexact error code\b/i,
  /\bwhat does.*error code\b/i,
  /\bwhich board\b/i,
  /\bcalibrate this model\b/i,
  /\benter service mode\b/i,
  /\bmanufacturer procedure\b/i,
];

const INTENT_PATTERNS: Array<{ intent: ChatIntent; patterns: RegExp[] }> = [
  {
    intent: 'maintenance_tip',
    patterns: [/\bpm\b/i, /\bpreventive maintenance\b/i, /\bmaintenance tips?\b/i, /\bchecklist\b/i],
  },
  {
    intent: 'troubleshooting',
    patterns: [
      /\btroubleshoot/i,
      /\bfault\b/i,
      /\bnot working\b/i,
      /\bfailure\b/i,
      /\bfirst[-\s]?line checks?\b/i,
      /\bwhat should i check (next|first)\b/i,
      /\blikely causes?\b/i,
      /\bescalat(e|ion)\b/i,
    ],
  },
  {
    intent: 'work_order_help',
    patterns: [
      /\bwork order\b/i,
      /\bsummarize\b/i,
      /\bdraft note\b/i,
      /\bmaintenance note\b/i,
      /\bclosure note\b/i,
      /\btechnician handoff\b/i,
      /\bnext step\b/i,
    ],
  },
  {
    intent: 'equipment_lookup',
    patterns: [/\bequipment status\b/i, /\basset\b/i, /\bdevice status\b/i],
  },
  {
    intent: 'analytics_explanation',
    patterns: [
      /\bmttr\b/i,
      /\bmtbf\b/i,
      /\bavailability\b/i,
      /\brisk\b/i,
      /\brpn\b/i,
      /\breplacement priority\b/i,
      /\bpm compliance\b/i,
      /\bpriority score\b/i,
      /\bwhy is .* high risk\b/i,
      /\boverdue pm\b/i,
      /\bdecision support\b/i,
    ],
  },
  {
    intent: 'calibration_or_logistics',
    patterns: [/\bcalibration\b/i, /\blogistics\b/i, /\bspare parts?\b/i, /\bstock\b/i, /\bprocurement\b/i],
  },
];

export function classifyChatRequest(message: string): ClassifiedRequest {
  const reasons: string[] = [];
  const normalized = message.trim();

  if (OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    reasons.push('Detected patient-care or diagnosis language.');
    return { intent: 'out_of_scope', reasons };
  }

  if (UNSAFE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    reasons.push('Detected unsafe internal repair or bypass language.');
    return { intent: 'unsafe', reasons };
  }

  if (TOO_DETAILED_PATTERNS.some((pattern) => pattern.test(normalized))) {
    reasons.push('Detected request for unsupported model-specific technical detail.');
    return { intent: 'too_detailed', reasons };
  }

  for (const intentPattern of INTENT_PATTERNS) {
    if (intentPattern.patterns.some((pattern) => pattern.test(normalized))) {
      reasons.push(`Matched heuristic for ${intentPattern.intent}.`);
      return { intent: intentPattern.intent, reasons };
    }
  }

  reasons.push('Defaulted to maintenance_tip for operational guidance.');
  return { intent: 'maintenance_tip', reasons };
}
