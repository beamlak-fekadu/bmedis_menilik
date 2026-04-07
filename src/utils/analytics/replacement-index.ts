/**
 * Replacement Priority Index computation.
 * Uses normalized weighted multi-criteria scoring from the proposal's
 * replacement prioritization model (Equations 6-7 applied).
 *
 * Criteria aligned with lifecycle and performance considerations:
 * - age: equipment age relative to expected lifespan
 * - failure_rate: annualized failure frequency (higher = worse)
 * - availability: equipment availability ratio (lower = worse, so inverted for replacement urgency)
 * - maintenance_burden: total repair hours / cost burden
 * - spare_part_support: spare part availability (lower = worse)
 * - risk_rpn: FMEA risk priority number
 * - cost: lifecycle maintenance cost relative to replacement cost (optional)
 */

import { minMaxNormalize, minMaxNormalizeInverse } from './normalization';
import { computeWeightedScore, type CriterionScore } from './composite-scoring';

export interface ReplacementCriteriaInput {
  assetId: string;
  age: number;
  failureCount: number;
  availability: number;
  totalRepairHours: number;
  sparePartAvailabilityScore: number;
  rpn: number;
  maintenanceCost?: number;
}

export interface ReplacementPriorityResult {
  assetId: string;
  ageScore: number;
  failureScore: number;
  availabilityScore: number;
  maintenanceBurdenScore: number;
  sparePartScore: number;
  riskScore: number;
  costScore: number;
  replacementPriorityIndex: number;
  rank: number;
}

const DEFAULT_REPLACEMENT_WEIGHTS: Record<string, number> = {
  age: 0.15,
  failure_rate: 0.15,
  availability: 0.20,
  maintenance_burden: 0.15,
  spare_parts: 0.10,
  risk: 0.15,
  cost: 0.10,
};

/**
 * Compute replacement priority indices for a set of equipment.
 * Higher index = higher urgency for replacement.
 */
export function computeReplacementPriorities(
  inputs: ReplacementCriteriaInput[],
  weights: Record<string, number> = DEFAULT_REPLACEMENT_WEIGHTS
): ReplacementPriorityResult[] {
  if (inputs.length === 0) return [];

  const ages = inputs.map(i => i.age);
  const failures = inputs.map(i => i.failureCount);
  const avails = inputs.map(i => i.availability);
  const repairHours = inputs.map(i => i.totalRepairHours);
  const spares = inputs.map(i => i.sparePartAvailabilityScore);
  const rpns = inputs.map(i => i.rpn);
  const costs = inputs.map(i => i.maintenanceCost ?? 0);

  const minMax = (arr: number[]) => ({ min: Math.min(...arr), max: Math.max(...arr) });
  const ageRange = minMax(ages);
  const failRange = minMax(failures);
  const availRange = minMax(avails);
  const repairRange = minMax(repairHours);
  const spareRange = minMax(spares);
  const rpnRange = minMax(rpns);
  const costRange = minMax(costs);

  const results: ReplacementPriorityResult[] = inputs.map(input => {
    // Higher age = higher replacement priority
    const ageScore = minMaxNormalize(input.age, ageRange.min, ageRange.max) ?? 0.5;
    // More failures = higher replacement priority
    const failureScore = minMaxNormalize(input.failureCount, failRange.min, failRange.max) ?? 0.5;
    // Lower availability = higher replacement priority (invert)
    const availabilityScore = minMaxNormalizeInverse(input.availability, availRange.min, availRange.max) ?? 0.5;
    // More repair hours = higher replacement priority
    const maintenanceBurdenScore = minMaxNormalize(input.totalRepairHours, repairRange.min, repairRange.max) ?? 0.5;
    // Lower spare part availability = higher replacement priority (invert)
    const sparePartScore = minMaxNormalizeInverse(input.sparePartAvailabilityScore, spareRange.min, spareRange.max) ?? 0.5;
    // Higher RPN = higher replacement priority
    const riskScore = minMaxNormalize(input.rpn, rpnRange.min, rpnRange.max) ?? 0.5;
    // Higher cost = higher replacement priority
    const costScore = minMaxNormalize(input.maintenanceCost ?? 0, costRange.min, costRange.max) ?? 0.5;

    const criteria: CriterionScore[] = [
      { criterion: 'age', normalizedValue: ageScore, weight: weights.age ?? 0.15 },
      { criterion: 'failure_rate', normalizedValue: failureScore, weight: weights.failure_rate ?? 0.15 },
      { criterion: 'availability', normalizedValue: availabilityScore, weight: weights.availability ?? 0.20 },
      { criterion: 'maintenance_burden', normalizedValue: maintenanceBurdenScore, weight: weights.maintenance_burden ?? 0.15 },
      { criterion: 'spare_parts', normalizedValue: sparePartScore, weight: weights.spare_parts ?? 0.10 },
      { criterion: 'risk', normalizedValue: riskScore, weight: weights.risk ?? 0.15 },
      { criterion: 'cost', normalizedValue: costScore, weight: weights.cost ?? 0.10 },
    ];

    const replacementPriorityIndex = computeWeightedScore(criteria);

    return {
      assetId: input.assetId,
      ageScore,
      failureScore,
      availabilityScore,
      maintenanceBurdenScore,
      sparePartScore,
      riskScore,
      costScore,
      replacementPriorityIndex,
      rank: 0,
    };
  });

  results.sort((a, b) => b.replacementPriorityIndex - a.replacementPriorityIndex);
  results.forEach((r, i) => { r.rank = i + 1; });

  return results;
}
