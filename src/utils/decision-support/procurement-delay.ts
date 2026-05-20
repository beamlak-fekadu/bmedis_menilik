// R10: procurement delay priority scoring.
//
// Before this module, fetchProcurementTriage scored procurement requests by
// `created_at` age alone. That misclassifies two important cases:
//   1) A recently-created request whose expected_delivery_date is already
//      past — should rank as delayed.
//   2) An old request whose expected_delivery_date is still in the future —
//      should NOT rank as delayed just because it's been sitting open.
//
// Canonical signal: how many days past `expected_delivery_date` we are.
// Secondary signal: request priority (critical/high get a boost).
// Tertiary fallback: when `expected_delivery_date` is missing, fall back to
// age from `created_at` so the row is still scoreable, but explicitly mark
// the result as `usedFallback: true`.

export type ProcurementPriority = 'low' | 'medium' | 'high' | 'critical' | null;
export type ProcurementStatus = string | null;

export interface ProcurementDelayInput {
  expectedDeliveryDate: string | null; // ISO date or null
  createdAt: string | null;
  status: ProcurementStatus;
  priority: ProcurementPriority;
}

export interface ProcurementDelayResult {
  // True when expected_delivery_date is past AND status is not delivered/canceled.
  isDelayed: boolean;
  // Days past expected_delivery_date (>=0). Null when no expected date is set
  // — callers should pair with `usedFallback` to surface the difference.
  daysPastDue: number | null;
  // Days since the request was created. Always set if createdAt is present.
  ageDays: number | null;
  // Composite score in roughly 0..200 range. Higher = more urgent.
  score: number;
  // True when the score had to fall back to age-based math because
  // expected_delivery_date was missing. UI should annotate this honestly.
  usedFallback: boolean;
  // Stable urgency band for the strip / report.
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

const TERMINAL_STATUSES = new Set(['delivered', 'canceled']);

const PRIORITY_BOOST: Record<string, number> = {
  critical: 40,
  high: 20,
  medium: 0,
  low: -10,
};

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, Math.floor((to - from) / 86_400_000));
}

export function scoreProcurementDelay(
  input: ProcurementDelayInput,
  now: Date = new Date(),
): ProcurementDelayResult {
  const isTerminal = TERMINAL_STATUSES.has(String(input.status ?? ''));
  const nowIso = now.toISOString();
  const priorityBoost = PRIORITY_BOOST[String(input.priority ?? 'medium')] ?? 0;

  // Age-from-creation is computed regardless — it powers the fallback path
  // and shows up in the operator's narrative.
  const ageDays = input.createdAt ? daysBetween(input.createdAt, nowIso) : null;

  if (isTerminal) {
    // Terminal rows don't belong in the triage strip. Score 0; UI filters.
    return {
      isDelayed: false,
      daysPastDue: null,
      ageDays,
      score: 0,
      usedFallback: false,
      urgency: 'low',
    };
  }

  if (input.expectedDeliveryDate) {
    const daysPastDue = daysBetween(input.expectedDeliveryDate, nowIso);
    const isDelayed = new Date(input.expectedDeliveryDate).getTime() < now.getTime();
    // Base 60 when delayed, 20 when not (to keep priority signals visible
    // even before the expected date passes — but well below delayed rows).
    const base = isDelayed ? 60 : 20;
    const delayWeight = isDelayed ? Math.min(120, daysPastDue * 2) : 0;
    const score = Math.max(0, base + delayWeight + priorityBoost);
    return {
      isDelayed,
      daysPastDue: isDelayed ? daysPastDue : 0,
      ageDays,
      score,
      usedFallback: false,
      urgency: scoreToUrgency(score),
    };
  }

  // Fallback path — no expected_delivery_date set. Use age as secondary.
  const safeAge = ageDays ?? 0;
  const score = Math.max(0, 25 + Math.min(45, safeAge * 0.5) + priorityBoost);
  return {
    isDelayed: false,
    daysPastDue: null,
    ageDays,
    score,
    usedFallback: true,
    urgency: scoreToUrgency(score),
  };
}

function scoreToUrgency(score: number): ProcurementDelayResult['urgency'] {
  if (score >= 150) return 'critical';
  if (score >= 100) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}
