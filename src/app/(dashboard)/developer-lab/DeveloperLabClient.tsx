'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { RefreshCcw, RotateCcw } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, useToast } from '@/components/ui';
import {
  recomputeAllAnalyticsDeveloperAction,
  refreshDecisionSupportSnapshotsAction,
  refreshFmeaRiskScoresAction,
  type DecisionSupportRefreshSummary,
} from '@/actions/developer-lab.actions';
import {
  NOT_WEIGHT_ADJUSTABLE_SCORES,
  SENSITIVITY_SUPPORTED_SCORES,
  getDefaultWeightMap,
  type ScoreRegistryEntry,
} from '@/utils/analytics/score-registry';

type ReplacementScoreKey =
  | 'ageScore'
  | 'failureScore'
  | 'availabilityScore'
  | 'maintenanceBurdenScore'
  | 'sparePartScore'
  | 'riskScore'
  | 'costScore';

const RPI_SCORE_LABELS: Record<ReplacementScoreKey, string> = {
  ageScore: 'Age',
  failureScore: 'Failures',
  availabilityScore: 'Availability',
  maintenanceBurdenScore: 'Maintenance burden',
  sparePartScore: 'Spare support',
  riskScore: 'FMEA risk',
  costScore: 'Lifecycle cost',
};

export interface LabReplacementRow {
  assetId: string;
  assetCode: string;
  assetName: string;
  departmentName: string;
  rank: number | null;
  priorityIndex: number | null;
  scores: Record<ReplacementScoreKey, number | null>;
}

interface Props {
  replacementRows: LabReplacementRow[];
}

type BasicActionResult = {
  success: boolean;
  error?: string;
  data?: unknown;
};

function buildInitialWeights() {
  return Object.fromEntries(
    SENSITIVITY_SUPPORTED_SCORES.map((score) => [score.key, getDefaultWeightMap(score)]),
  ) as Record<string, Record<string, number>>;
}

function computeRpi(row: LabReplacementRow, weights: Record<string, number>) {
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (totalWeight <= 0) return 0;
  const weighted = (Object.keys(RPI_SCORE_LABELS) as ReplacementScoreKey[]).reduce((sum, key) => {
    const value = row.scores[key] ?? 0;
    return sum + value * (weights[key] ?? 0);
  }, 0);
  return weighted / totalWeight;
}

function runLabel(delta: number | null) {
  if (delta == null || delta === 0) return 'No movement';
  return delta > 0 ? `Up ${delta}` : `Down ${Math.abs(delta)}`;
}

function scoreBadgeVariant(score: ScoreRegistryEntry) {
  if (score.dataMode === 'Live') return 'success';
  if (score.dataMode === 'Snapshot' || score.dataMode === 'Mixed') return 'info';
  if (score.dataMode === 'Sandbox') return 'warning';
  return 'error';
}

export default function DeveloperLabClient({ replacementRows }: Props) {
  const { toast } = useToast();
  const [pendingAction, startTransition] = useTransition();
  const [weightsByScore, setWeightsByScore] = useState<Record<string, Record<string, number>>>(buildInitialWeights);
  const [activeScoreKey, setActiveScoreKey] = useState(SENSITIVITY_SUPPORTED_SCORES[0]?.key ?? 'replacement_priority');
  const [lastRefreshSummary, setLastRefreshSummary] = useState<DecisionSupportRefreshSummary | null>(null);

  const activeScore = SENSITIVITY_SUPPORTED_SCORES.find((score) => score.key === activeScoreKey) ?? SENSITIVITY_SUPPORTED_SCORES[0];
  const activeWeights = weightsByScore[activeScore.key] ?? getDefaultWeightMap(activeScore);
  const totalWeight = Object.values(activeWeights).reduce((sum, value) => sum + value, 0);
  const isRpiSandbox = activeScore.key === 'replacement_priority';

  const simulated = isRpiSandbox
    ? replacementRows
      .map((row) => ({ ...row, simulatedRpi: computeRpi(row, activeWeights), simulatedRank: 0, rankDelta: null as number | null }))
      .sort((a, b) => b.simulatedRpi - a.simulatedRpi)
      .map((row, index) => {
        const simulatedRank = index + 1;
        return {
          ...row,
          simulatedRank,
          rankDelta: row.rank == null ? null : row.rank - simulatedRank,
        };
      })
    : [];

  const topMovement = simulated
    .filter((row) => row.rankDelta !== 0 && row.rankDelta != null)
    .sort((a, b) => Math.abs(b.rankDelta ?? 0) - Math.abs(a.rankDelta ?? 0))
    .slice(0, 8);
  const stability = topMovement.length === 0
    ? 'Stable: top candidates unchanged'
    : topMovement.some((row) => Math.abs(row.rankDelta ?? 0) >= 5)
      ? 'Sensitive: top candidates changed significantly'
      : 'Moderate movement: some rank order changes';

  function setWeight(scoreKey: string, weightKey: string, value: number) {
    setWeightsByScore((current) => ({
      ...current,
      [scoreKey]: {
        ...(current[scoreKey] ?? {}),
        [weightKey]: value,
      },
    }));
  }

  function resetActiveWeights() {
    setWeightsByScore((current) => ({
      ...current,
      [activeScore.key]: getDefaultWeightMap(activeScore),
    }));
  }

  function runAction(label: string, action: () => Promise<BasicActionResult>) {
    startTransition(async () => {
      const result = await action();
      if (label === 'Decision-support snapshot refresh' && result.data) {
        setLastRefreshSummary(result.data as DecisionSupportRefreshSummary);
      }
      if (result.success) {
        toast('success', `${label} completed`);
      } else {
        toast('error', result.error ?? `${label} failed`);
      }
    });
  }

  return (
    <div className="space-y-6">

      <Card>
        <CardHeader className="items-start">
          <div>
            <CardTitle>Sensitivity Sandbox</CardTitle>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Operational pages use Live or Snapshot metrics only. Sandbox values are developer simulations and never modify operational pages.
            </p>
          </div>
          <div className="text-right text-xs text-[var(--text-muted)]">
            <p>Total weight</p>
            <p className={totalWeight === 100 ? 'text-lg font-semibold text-emerald-300' : 'text-lg font-semibold text-amber-300'}>
              {totalWeight}%
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {SENSITIVITY_SUPPORTED_SCORES.map((score) => (
              <button
                key={score.key}
                type="button"
                onClick={() => setActiveScoreKey(score.key)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${activeScore.key === score.key ? 'border-[var(--brand)] bg-[var(--surface-2)] text-[var(--foreground)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--brand)]/50'}`}
              >
                {score.displayName}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-[var(--foreground)]">{activeScore.displayName}</h3>
                  <Badge variant={scoreBadgeVariant(activeScore)}>{activeScore.dataMode}</Badge>
                  <Badge>Simulation only</Badge>
                </div>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{activeScore.sandboxMessage}</p>
              </div>
              <Button size="sm" variant="outline" onClick={resetActiveWeights}>
                <RotateCcw className="h-4 w-4" />
                Reset Sandbox
              </Button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-[var(--border-subtle)]/70 p-3 text-sm">
                <p className="text-xs text-[var(--text-muted)]">Formula</p>
                <p className="mt-1 text-[var(--foreground)]">{activeScore.formulaSummary}</p>
              </div>
              <div className="rounded-md border border-[var(--border-subtle)]/70 p-3 text-sm">
                <p className="text-xs text-[var(--text-muted)]">Source of truth</p>
                <p className="mt-1 text-[var(--foreground)]">{activeScore.sourceOfTruth}</p>
              </div>
              <div className="rounded-md border border-[var(--border-subtle)]/70 p-3 text-sm">
                <p className="text-xs text-[var(--text-muted)]">Used on pages</p>
                <p className="mt-1 text-[var(--foreground)]">{activeScore.operationalConsumers.join(', ')}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(activeScore.weights ?? []).map((weight) => (
              <label key={weight.key} className="rounded-lg border border-[var(--border-subtle)] p-3">
                <span className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-[var(--foreground)]">{weight.label}</span>
                  <span className="text-[var(--text-muted)]">{activeWeights[weight.key] ?? weight.defaultWeight}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(120, weight.defaultWeight * 2)}
                  step={1}
                  value={activeWeights[weight.key] ?? weight.defaultWeight}
                  onChange={(event) => setWeight(activeScore.key, weight.key, Number(event.target.value))}
                  className="w-full accent-[var(--brand)]"
                  aria-label={`${weight.label} simulated weight`}
                />
                <p className="mt-2 text-xs text-[var(--text-muted)]">{weight.explanation}</p>
                {weight.sourceField ? <p className="mt-1 font-mono text-[10px] text-[var(--text-subtle)]">{weight.sourceField}</p> : null}
              </label>
            ))}
          </div>

          {totalWeight !== 100 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
              Simulated weights currently total {totalWeight}%. Operational formulas keep their current production weights.
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            {activeScore.criteria.map((criterion) => (
              <div key={`${activeScore.key}-${criterion.label}`} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3 text-sm">
                <p className="font-medium text-[var(--foreground)]">{criterion.label}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{criterion.source}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{criterion.explanation}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {isRpiSandbox ? (
        <Card>
          <CardHeader>
            <CardTitle>RPI Ranking Comparison</CardTitle>
            <Badge variant={stability.startsWith('Sensitive') ? 'warning' : stability.startsWith('Stable') ? 'success' : 'info'}>{stability}</Badge>
          </CardHeader>
          <CardContent>
            {topMovement.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--text-muted)]">The top candidates are unchanged under the current simulated RPI weights. Simulated RPI is still recalculated from the slider values.</p>
                <div className="grid gap-2 md:grid-cols-5">
                  {simulated.slice(0, 5).map((row) => (
                    <Link key={row.assetId} href={`/command/drilldown/replacement/${row.assetId}`} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3 hover:border-[var(--brand)]/50">
                      <p className="text-xs text-[var(--text-muted)]">#{row.simulatedRank}</p>
                      <p className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">{row.assetCode}</p>
                      <p className="truncate text-xs text-[var(--text-muted)]">{row.assetName}</p>
                      <p className="mt-2 text-xs font-medium text-[var(--brand)]">RPI {row.simulatedRpi.toFixed(3)}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs uppercase text-[var(--text-muted)]">
                    <tr>
                      <th className="py-2 pr-4">Asset</th>
                      <th className="py-2 pr-4">Current</th>
                      <th className="py-2 pr-4">Simulated</th>
                      <th className="py-2 pr-4">Movement</th>
                      <th className="py-2 pr-4">Simulated RPI</th>
                      <th className="py-2">Evidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {topMovement.map((row) => (
                      <tr key={row.assetId}>
                        <td className="py-3 pr-4">
                          <p className="font-medium text-[var(--foreground)]">{row.assetCode} - {row.assetName}</p>
                          <p className="text-xs text-[var(--text-muted)]">{row.departmentName}</p>
                        </td>
                        <td className="py-3 pr-4">#{row.rank ?? '-'}</td>
                        <td className="py-3 pr-4">#{row.simulatedRank}</td>
                        <td className="py-3 pr-4">{runLabel(row.rankDelta)}</td>
                        <td className="py-3 pr-4">{row.simulatedRpi.toFixed(3)}</td>
                        <td className="py-3">
                          <Link className="text-xs text-[var(--brand)] hover:underline" href={`/command/drilldown/replacement/${row.assetId}`}>
                            Open evidence
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="items-start">
          <div>
            <CardTitle>Not Weight-adjustable</CardTitle>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              These operational metrics are formulas, ratios, live views, or threshold classifications. They are tracked here so weighted scores do not hide outside the registry.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {NOT_WEIGHT_ADJUSTABLE_SCORES.map((score) => (
              <div key={score.key} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-[var(--foreground)]">{score.displayName}</p>
                  <Badge variant={scoreBadgeVariant(score)}>{score.dataMode}</Badge>
                </div>
                <p className="mt-2 text-xs text-[var(--text-muted)]">{score.formulaSummary}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{score.notWeightAdjustableReason ?? 'No adjustable weights are defined for this score.'}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="items-start">
          <div>
            <CardTitle>Snapshot Refresh Center</CardTitle>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              These actions run real refresh paths and report partial failures. They do not mark a metric refreshed unless the underlying RPC runs.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              loading={pendingAction}
              onClick={() => runAction('FMEA risk refresh', refreshFmeaRiskScoresAction)}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh FMEA Risk Scores
            </Button>
            <Button
              variant="outline"
              loading={pendingAction}
              onClick={() => runAction('Decision-support snapshot refresh', refreshDecisionSupportSnapshotsAction)}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh Decision Support Snapshots
            </Button>
            <Button
              variant="outline"
              loading={pendingAction}
              onClick={() => runAction('Full analytics recompute', recomputeAllAnalyticsDeveloperAction)}
            >
              <RefreshCcw className="h-4 w-4" />
              Recompute Analytics
            </Button>
          </div>

          {lastRefreshSummary ? (
            <div className="panel-surface overflow-x-auto rounded-lg">
              <table className="w-full min-w-[840px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
                    <th className="px-3 py-2">Metric</th>
                    <th className="px-3 py-2">Attempted</th>
                    <th className="px-3 py-2">Result</th>
                    <th className="px-3 py-2">Before</th>
                    <th className="px-3 py-2">After</th>
                    <th className="px-3 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]/60">
                  {lastRefreshSummary.metrics.map((metric) => (
                    <tr key={metric.metricKey}>
                      <td className="px-3 py-2 font-medium text-[var(--foreground)]">{metric.displayName}</td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{metric.refreshAttempted ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2">
                        <Badge variant={metric.success ? 'success' : 'error'}>{metric.success ? 'Success' : 'Failed'}</Badge>
                      </td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{metric.lastRefreshBefore ?? 'No timestamp'}</td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{metric.lastRefreshAfter ?? 'No timestamp'}</td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{metric.error ?? (metric.warnings.join(' ') || 'OK')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
