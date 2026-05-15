// Canonical replacement decision thresholds — used by /replacement, /command,
// /developer-lab, and every count/badge that mentions replacement candidacy.
// These are prototype decision thresholds used for demonstration and sensitivity
// testing; they do not automatically approve replacement.

export const REPLACEMENT_STRONG_THRESHOLD = 0.7;
export const REPLACEMENT_REVIEW_THRESHOLD = 0.55;

export type ReplacementBand = 'strong' | 'review' | 'monitor';

export function replacementBand(rpi: number | null | undefined): ReplacementBand {
  const value = typeof rpi === 'number' && Number.isFinite(rpi) ? rpi : 0;
  if (value >= REPLACEMENT_STRONG_THRESHOLD) return 'strong';
  if (value >= REPLACEMENT_REVIEW_THRESHOLD) return 'review';
  return 'monitor';
}

export function isReplacementCandidate(rpi: number | null | undefined): boolean {
  const band = replacementBand(rpi);
  return band === 'strong' || band === 'review';
}

export function isStrongReplacementCandidate(rpi: number | null | undefined): boolean {
  return replacementBand(rpi) === 'strong';
}

// Count helper: only rows that meet the review threshold (Strong + Review).
// Use this anywhere the UI claims "replacement candidates" so counts stay
// consistent across Command Center, Replacement, Reports, and Developer Lab.
export function countReplacementCandidates(rows: Array<{ priority_index?: number | null } | { replacement_priority_index?: number | null }>): number {
  let count = 0;
  for (const row of rows) {
    const rpi =
      (row as { priority_index?: number | null }).priority_index ??
      (row as { replacement_priority_index?: number | null }).replacement_priority_index ??
      0;
    if (isReplacementCandidate(rpi)) count += 1;
  }
  return count;
}
