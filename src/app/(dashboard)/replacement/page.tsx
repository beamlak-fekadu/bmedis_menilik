'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Replace,
  AlertTriangle,
  ListOrdered,
  Trophy,
} from 'lucide-react';
import { getReplacementPriorities } from '@/services/analytics.service';
import { PageHeader, StatCard, DataTable, Badge } from '@/components/ui';
import { PageLoader } from '@/components/ui/Spinner';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ChartCard, HorizontalBarChart } from '@/components/charts';
import { generateReplacementDriver } from '@/utils/decision-support/explanations';
import ExpandableText from '@/components/ui/ExpandableText';

interface AssetInfo {
  id: string;
  asset_code: string;
  name: string;
  department_id: string | null;
}

interface ReplacementRow {
  id: string;
  asset_id: string;
  age_score: number | null;
  failure_score: number | null;
  availability_score: number | null;
  maintenance_burden_score: number | null;
  spare_part_score: number | null;
  risk_score: number | null;
  cost_score: number | null;
  replacement_priority_index: number | null;
  rank: number | null;
  justification: string | null;
  computed_at?: string | null;
  equipment_assets: AssetInfo;
  [key: string]: unknown;
}

const SCORE_CRITERIA = [
  { key: 'age_score', label: 'Age', color: '#6366f1' },
  { key: 'failure_score', label: 'Failure', color: '#ef4444' },
  { key: 'availability_score', label: 'Availability', color: '#f97316' },
  { key: 'maintenance_burden_score', label: 'Maint. Burden', color: '#eab308' },
  { key: 'spare_part_score', label: 'Spare Parts', color: '#14b8a6' },
  { key: 'risk_score', label: 'Risk', color: '#dc2626' },
  { key: 'cost_score', label: 'Cost', color: '#8b5cf6' },
] as const;

type ScoreKey = typeof SCORE_CRITERIA[number]['key'];

type SimulatedReplacementRow = ReplacementRow & {
  simulated_rpi: number;
  simulated_rank: number;
  rank_delta: number | null;
};

const DEFAULT_WEIGHTS: Record<ScoreKey, number> = {
  age_score: 15,
  failure_score: 20,
  availability_score: 15,
  maintenance_burden_score: 15,
  spare_part_score: 10,
  risk_score: 15,
  cost_score: 10,
};

function rpiColor(index: number): string {
  if (index >= 0.7) return '#ef4444';
  if (index >= 0.4) return '#f97316';
  return '#22c55e';
}

function computeSimulatedRpi(row: ReplacementRow, weights: Record<ScoreKey, number>): number {
  const totalWeight = SCORE_CRITERIA.reduce((sum, criterion) => sum + weights[criterion.key], 0);
  if (totalWeight <= 0) return 0;

  const weightedScore = SCORE_CRITERIA.reduce((sum, criterion) => {
    const value = row[criterion.key] as number | null;
    return sum + (value ?? 0) * weights[criterion.key];
  }, 0);

  return weightedScore / totalWeight;
}

function formatRankDelta(delta: number | null) {
  if (delta == null || delta === 0) return 'No change';
  return delta > 0 ? `Up ${delta}` : `Down ${Math.abs(delta)}`;
}

export default function ReplacementPage() {
  const [data, setData] = useState<ReplacementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [weights, setWeights] = useState<Record<ScoreKey, number>>(DEFAULT_WEIGHTS);

  useEffect(() => {
    async function load() {
      try {
        const { data: rows } = await getReplacementPriorities();
        if (rows) setData(rows as unknown as ReplacementRow[]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const ranked = useMemo(() => [...data]
    .filter((d) => d.replacement_priority_index != null)
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)), [data]);

  const simulatedRanked = useMemo<SimulatedReplacementRow[]>(() => {
    const withScores = ranked.map((row) => ({
      ...row,
      simulated_rpi: computeSimulatedRpi(row, weights),
      simulated_rank: 0,
      rank_delta: null,
    }));

    return withScores
      .sort((a, b) => b.simulated_rpi - a.simulated_rpi)
      .map((row, idx) => {
        const simulatedRank = idx + 1;
        const baselineRank = row.rank ?? null;
        return {
          ...row,
          simulated_rank: simulatedRank,
          rank_delta: baselineRank == null ? null : baselineRank - simulatedRank,
        };
      });
  }, [ranked, weights]);

  const totalWeight = SCORE_CRITERIA.reduce((sum, criterion) => sum + weights[criterion.key], 0);
  const simulatedRecommendedRows = simulatedRanked.filter((d) => d.simulated_rpi >= 0.7);
  const top3 = simulatedRanked.filter((d) => d.simulated_rpi >= 0.7).slice(0, 3);

  if (loading) return <PageLoader />;

  const columns = [
    {
      key: 'rank',
      header: '#',
      sortable: true,
      render: (row: SimulatedReplacementRow) => (
        <span className="font-bold text-gray-700 dark:text-gray-300">{row.rank ?? '—'}</span>
      ),
    },
    {
      key: 'asset_code',
      header: 'Asset Code',
      sortable: true,
      render: (row: SimulatedReplacementRow) => row.equipment_assets?.asset_code ?? '—',
    },
    {
      key: 'asset_name',
      header: 'Name',
      sortable: true,
      render: (row: SimulatedReplacementRow) => row.equipment_assets?.name ?? '—',
    },
    {
      key: 'age_score',
      header: 'Age',
      sortable: true,
      render: (row: SimulatedReplacementRow) => row.age_score?.toFixed(2) ?? '—',
    },
    {
      key: 'failure_score',
      header: 'Failure',
      sortable: true,
      render: (row: SimulatedReplacementRow) => row.failure_score?.toFixed(2) ?? '—',
    },
    {
      key: 'availability_score',
      header: 'Avail.',
      sortable: true,
      render: (row: SimulatedReplacementRow) => row.availability_score?.toFixed(2) ?? '—',
    },
    {
      key: 'maintenance_burden_score',
      header: 'Maint.',
      sortable: true,
      render: (row: SimulatedReplacementRow) => row.maintenance_burden_score?.toFixed(2) ?? '—',
    },
    {
      key: 'spare_part_score',
      header: 'Parts',
      sortable: true,
      render: (row: SimulatedReplacementRow) => row.spare_part_score?.toFixed(2) ?? '—',
    },
    {
      key: 'risk_score',
      header: 'Risk',
      sortable: true,
      render: (row: SimulatedReplacementRow) => row.risk_score?.toFixed(2) ?? '—',
    },
    {
      key: 'replacement_priority_index',
      header: 'RPI',
      sortable: true,
      render: (row: SimulatedReplacementRow) => {
        if (row.replacement_priority_index == null) return '—';
        const rpi = row.replacement_priority_index;
        return (
          <Badge variant={rpi >= 0.7 ? 'error' : rpi >= 0.4 ? 'warning' : 'success'}>
            {rpi.toFixed(3)}
          </Badge>
        );
      },
    },
    {
      key: 'simulated_rpi',
      header: 'Sim. RPI',
      sortable: true,
      render: (row: SimulatedReplacementRow) => (
        <Badge variant={row.simulated_rpi >= 0.7 ? 'error' : row.simulated_rpi >= 0.4 ? 'warning' : 'success'}>
          {row.simulated_rpi.toFixed(3)}
        </Badge>
      ),
    },
    {
      key: 'simulated_rank',
      header: 'Sim. Rank',
      sortable: true,
      render: (row: SimulatedReplacementRow) => (
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">#{row.simulated_rank}</span>
      ),
    },
    {
      key: 'rank_delta',
      header: 'Rank Change',
      render: (row: SimulatedReplacementRow) => (
        <span className={row.rank_delta && row.rank_delta > 0 ? 'text-green-600 dark:text-green-400' : row.rank_delta && row.rank_delta < 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500'}>
          {formatRankDelta(row.rank_delta)}
        </span>
      ),
    },
    {
      key: 'justification',
      header: 'Key Driver',
      render: (row: SimulatedReplacementRow) => (
        <span className="max-w-[250px] text-sm text-gray-600 dark:text-gray-400">
          <ExpandableText text={generateReplacementDriver(row)} lines={2} />
        </span>
      ),
    },
    {
      key: 'computed_at',
      header: 'Computed',
      render: (row: SimulatedReplacementRow) => row.computed_at ? new Date(row.computed_at).toLocaleString() : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Replacement Priority Ranking"
        description="Multi-criteria replacement model: RPI = Σ(wᵢ × criterionᵢ) based on age, failures, availability, maintenance burden, risk, and cost"
        breadcrumbs={[
          { label: 'Command Center', href: '/command' },
          { label: 'Replacement Priority Ranking' },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Assets Ranked"
          value={ranked.length}
          icon={<ListOrdered className="h-6 w-6" />}
          color="blue"
        />
        <StatCard
          label="Top Priority RPI"
          value={ranked[0]?.replacement_priority_index?.toFixed(3) ?? '—'}
          icon={<AlertTriangle className="h-6 w-6" />}
          color="red"
        />
        <StatCard
          label="Simulated Recommended"
          value={simulatedRecommendedRows.length}
          icon={<Replace className="h-6 w-6" />}
          color="orange"
        />
        <StatCard
          label="Lowest RPI"
          value={ranked[ranked.length - 1]?.replacement_priority_index?.toFixed(3) ?? '—'}
          icon={<Trophy className="h-6 w-6" />}
          color="green"
        />
      </div>

      <Card>
        <CardHeader className="items-start">
          <div>
            <CardTitle>Sensitivity Analysis</CardTitle>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Adjust criteria weights to simulate replacement priority changes. This does not write to Supabase.
            </p>
          </div>
          <div className="text-right text-xs text-gray-500 dark:text-gray-400">
            <p>Total weight</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{totalWeight}%</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {SCORE_CRITERIA.map((criterion) => (
              <label key={criterion.key} className="rounded-lg border border-[var(--border-subtle)] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{criterion.label}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{weights[criterion.key]}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={1}
                  value={weights[criterion.key]}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setWeights((prev) => ({ ...prev, [criterion.key]: value }));
                  }}
                  className="w-full accent-[var(--brand)]"
                  aria-label={`${criterion.label} weight`}
                />
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Scores with missing values contribute 0 in the simulation; weights are normalized automatically by total weight.
          </p>
        </CardContent>
      </Card>

      {top3.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-red-700 dark:text-red-400">
            <Replace className="h-5 w-5" />
            Recommended for Replacement
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {top3.map((item, idx) => (
              <Card key={item.id} className="border-red-200 dark:border-red-800">
                <CardHeader>
                  <CardTitle>
                    <span className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        {idx + 1}
                      </span>
                      {item.equipment_assets?.asset_code ?? item.asset_id}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-2 text-sm font-medium text-gray-900 dark:text-white">
                    {item.equipment_assets?.name ?? 'Unknown Asset'}
                  </p>
                  <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                    {generateReplacementDriver(item)}
                  </p>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">RPI</span>
                    <Badge variant="error">
                    {item.simulated_rpi.toFixed(3)}
                    </Badge>
                  </div>
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="text-gray-500">Baseline RPI</span>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {item.replacement_priority_index?.toFixed(3) ?? '—'} · {formatRankDelta(item.rank_delta)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {SCORE_CRITERIA.map((c) => {
                      const val = item[c.key as keyof ReplacementRow] as number | null;
                      return (
                        <div key={c.key} className="flex items-center gap-2">
                          <span className="w-20 text-xs text-gray-500">{c.label}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${((val ?? 0) * 100).toFixed(0)}%`,
                                backgroundColor: c.color,
                              }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                            {val?.toFixed(2) ?? '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <ChartCard
        title="Replacement Priority Index"
        description="All ranked assets by simulated replacement priority"
      >
        {simulatedRanked.length > 0 ? (
          <HorizontalBarChart
            labels={simulatedRanked.map((d) => d.equipment_assets?.asset_code ?? d.asset_id)}
            values={simulatedRanked.map((d) => d.simulated_rpi)}
            colors={simulatedRanked.map((d) => rpiColor(d.simulated_rpi))}
            height={Math.max(300, simulatedRanked.length * 28)}
          />
        ) : (
          <p className="py-12 text-center text-sm text-gray-500">No replacement data</p>
        )}
      </ChartCard>

      <DataTable<SimulatedReplacementRow>
        columns={columns}
        data={simulatedRanked}
        keyField="id"
        searchPlaceholder="Search assets..."
        emptyMessage="No replacement priorities found"
        pageSize={15}
      />
    </div>
  );
}
