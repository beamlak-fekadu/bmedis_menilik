export {
  computeRPN,
  classifyRiskLevel,
  computeAvailability,
  computeMTBF,
  computeMTTR,
  computePMC,
  computeDowntimeBurden,
  computeAnnualizedFailureRate,
} from './formulas';

export {
  minMaxNormalize,
  minMaxNormalizeInverse,
  normalizeArray,
  normalizeRecord,
} from './normalization';

export {
  computeWeightedScore,
  computeCompositeScores,
  rankByScore,
  validateWeights,
  type CriterionScore,
} from './composite-scoring';

export {
  computeReplacementPriorities,
  type ReplacementCriteriaInput,
  type ReplacementPriorityResult,
} from './replacement-index';

export {
  generateRecommendations,
  type RecommendationInput,
  type GeneratedRecommendation,
} from './recommendations';
