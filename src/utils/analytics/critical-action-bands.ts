// R30: critical action score transparency.
//
// `buildCriticalActions` (in command-center-data.ts) sums a category base
// weight with the item's own score and classifies the result into an urgency
// band. This module is the canonical, documented version of those bands so
// reports, tests, Copilot's metric_debug tool, and the score-registry all
// reference the same numbers.
//
// Priority order is intentional and reflects clinical-engineering reality:
//   corrective > needs_request > calibration > pm > stock > risk_watch >
//   installation > replacement > procurement > training
// Anything that physically blocks current work outranks lifecycle planning.
// Calibration sits above PM because failed calibration is a safety event.
//
// Bands are absolute (not percentile). 180+ = critical; 150+ = high; 100+ =
// medium; else low. Combined with the base weights this gives clinical
// engineers a stable, explainable rank order even when the per-item `score`
// varies.

export type CriticalActionCategory =
  | 'corrective'
  | 'needs_request'
  | 'calibration'
  | 'pm'
  | 'stock'
  | 'risk_watch'
  | 'installation'
  | 'replacement'
  | 'procurement'
  | 'training';

export type CriticalActionUrgency = 'critical' | 'high' | 'medium' | 'low';

export const CRITICAL_ACTION_CATEGORY_WEIGHTS: Record<CriticalActionCategory, number> = {
  corrective: 100,
  needs_request: 90,
  calibration: 85,
  pm: 75,
  stock: 70,
  risk_watch: 65,
  installation: 60,
  replacement: 55,
  procurement: 45,
  training: 35,
};

export const CRITICAL_ACTION_URGENCY_BANDS = {
  critical: 180,
  high: 150,
  medium: 100,
} as const;

// Map a combined (base + item) score to its urgency band. Below 100 falls to
// 'low' — keep these out of the BME Head's Critical Action Strip by default.
export function urgencyBandFor(combinedScore: number): CriticalActionUrgency {
  if (combinedScore >= CRITICAL_ACTION_URGENCY_BANDS.critical) return 'critical';
  if (combinedScore >= CRITICAL_ACTION_URGENCY_BANDS.high) return 'high';
  if (combinedScore >= CRITICAL_ACTION_URGENCY_BANDS.medium) return 'medium';
  return 'low';
}

// Canonical priority order. When sorting actions of equal combined score,
// fall back to category index so the tiebreaker is deterministic.
export const CRITICAL_ACTION_CATEGORY_ORDER: CriticalActionCategory[] = [
  'corrective',
  'needs_request',
  'calibration',
  'pm',
  'stock',
  'risk_watch',
  'installation',
  'replacement',
  'procurement',
  'training',
];

export function categoryOrderIndex(category: CriticalActionCategory): number {
  const idx = CRITICAL_ACTION_CATEGORY_ORDER.indexOf(category);
  return idx === -1 ? CRITICAL_ACTION_CATEGORY_ORDER.length : idx;
}
