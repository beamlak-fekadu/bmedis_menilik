import { SCORE_REGISTRY, type ScoreDataMode } from './score-registry';

// Analytics Truth Map - BMEDIS decision-support metrics.
//
// The canonical metadata now lives in score-registry.ts so Developer Lab,
// Copilot diagnostics, reports, and tests can agree on data mode, refresh mode,
// operational consumers, and sandbox scope.

export type MetricStatus = Lowercase<Extract<ScoreDataMode, 'Live' | 'Snapshot' | 'Sandbox' | 'Mixed'>> | 'not_implemented';

export interface MetricTruth {
  key: string;
  name: string;
  formula: string;
  sourceTables: string[];
  sourceViews?: string[];
  sourceFunctions?: string[];
  refreshMechanism: string;
  status: MetricStatus;
  pages: string[];
  missingDataBehavior: string;
  staleBehavior: string;
  knownLimitations?: string;
  dataMode: ScoreDataMode;
  sourceOfTruth: string;
  operationalConsumers: string[];
  affectsLiveDecisions: 'Yes' | 'No' | 'Developer-only' | 'N/A';
  sandboxChangesAffectLive: 'No' | 'Yes' | 'N/A';
}

function toMetricStatus(mode: ScoreDataMode): MetricStatus {
  if (mode === 'Not Implemented') return 'not_implemented';
  return mode.toLowerCase() as MetricStatus;
}

export const ANALYTICS_TRUTH_MAP: MetricTruth[] = SCORE_REGISTRY.map((score) => ({
  key: score.key,
  name: score.displayName,
  formula: score.formulaSummary,
  sourceTables: score.sourceTables,
  sourceViews: score.sourceViews,
  sourceFunctions: score.sourceFunctions,
  refreshMechanism: `${score.refreshMode}. ${score.refreshImplementation?.notes ?? score.sourceOfTruth}`,
  status: toMetricStatus(score.dataMode),
  pages: score.operationalConsumers,
  missingDataBehavior: score.operationalImplementation === 'no'
    ? 'Shown as Not Implemented with the missing source listed.'
    : 'Shown as unavailable or empty; Developer Lab exposes the source and freshness state.',
  staleBehavior: score.dataMode === 'Live'
    ? 'No snapshot needed.'
    : score.dataMode === 'Sandbox'
      ? 'Simulation only; no operational freshness.'
      : 'Developer Lab evaluates snapshot freshness using the canonical 24h/72h thresholds.',
  knownLimitations: score.limitations,
  dataMode: score.dataMode,
  sourceOfTruth: score.sourceOfTruth,
  operationalConsumers: score.operationalConsumers,
  affectsLiveDecisions: score.affectsLiveDecisions,
  sandboxChangesAffectLive: score.sandboxChangesAffectLive,
}));

export function getMetricTruth(name: string): MetricTruth | undefined {
  return ANALYTICS_TRUTH_MAP.find((m) => m.name === name);
}

export const OPERATIONAL_METRICS = ANALYTICS_TRUTH_MAP.filter((m) => m.status !== 'sandbox');
export const SANDBOX_METRICS = ANALYTICS_TRUTH_MAP.filter((m) => m.status === 'sandbox');
