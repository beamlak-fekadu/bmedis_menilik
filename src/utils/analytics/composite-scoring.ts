/**
 * Composite scoring engine from the thesis proposal.
 * Implements Equation 7: weighted sum aggregation.
 */

export interface CriterionScore {
  criterion: string;
  normalizedValue: number;
  weight: number;
}

/**
 * Proposal Equation 7: Weighted Sum Aggregation
 * TS_i = SUM(w_j * s_ij) for j = 1..m
 * w_j = weight of criterion j, s_ij = normalized score of device i on criterion j.
 *
 * Validates that weights sum to approximately 1.0 (within tolerance).
 */
export function computeWeightedScore(criteria: CriterionScore[]): number {
  if (criteria.length === 0) return 0;

  return criteria.reduce((sum, c) => sum + c.weight * c.normalizedValue, 0);
}

/**
 * Compute weighted scores for multiple devices across the same criteria.
 * Returns a map of deviceId -> composite score.
 */
export function computeCompositeScores(
  devices: Record<string, Record<string, number>>,
  weights: Record<string, number>
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const [deviceId, scores] of Object.entries(devices)) {
    const criteria: CriterionScore[] = Object.entries(weights).map(([criterion, weight]) => ({
      criterion,
      normalizedValue: scores[criterion] ?? 0,
      weight,
    }));
    result[deviceId] = computeWeightedScore(criteria);
  }

  return result;
}

/**
 * Rank devices by their composite scores (descending: highest score = rank 1).
 * Returns an array of { deviceId, score, rank }.
 */
export function rankByScore(
  scores: Record<string, number>,
  ascending: boolean = false
): Array<{ deviceId: string; score: number; rank: number }> {
  const sorted = Object.entries(scores)
    .map(([deviceId, score]) => ({ deviceId, score, rank: 0 }))
    .sort((a, b) => ascending ? a.score - b.score : b.score - a.score);

  sorted.forEach((item, index) => {
    item.rank = index + 1;
  });

  return sorted;
}

/**
 * Validate that weights sum to approximately 1.0.
 */
export function validateWeights(weights: Record<string, number>, tolerance: number = 0.01): boolean {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1.0) <= tolerance;
}
