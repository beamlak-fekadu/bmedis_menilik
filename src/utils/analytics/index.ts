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

export {
  SCORE_REGISTRY,
  SENSITIVITY_SUPPORTED_SCORES,
  NOT_WEIGHT_ADJUSTABLE_SCORES,
  SNAPSHOT_FRESH_HOURS,
  SNAPSHOT_VERY_STALE_HOURS,
  evaluateSnapshotFreshness,
  formatLastRefresh,
  getDefaultWeightMap,
  getScoreRegistryEntry,
  scoreFreshnessBadgeVariant,
  type OperationalImplementation,
  type ScoreCriterion,
  type ScoreDataMode,
  type ScoreFreshness,
  type ScoreRefreshMode,
  type ScoreRegistryEntry,
  type ScoreWeight,
} from './score-registry';
