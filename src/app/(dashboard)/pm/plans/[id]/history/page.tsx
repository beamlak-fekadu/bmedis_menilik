'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, PauseCircle, PlayCircle, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, PageHeader, Spinner, Table } from '@/components/ui';
import { PMStatusBadge } from '@/components/ui/StatusBadge';
import { ScoreExplanation } from '../../../../command/_components/ScoreExplanation';
import { generateNextPMScheduleAction, pausePMPlanAction, resumePMPlanAction } from '@/actions/pm.actions';
import { getPMPlanById, getPMSchedules } from '@/services/pm.service';
import { useRole } from '@/hooks/useRole';
import { useToast } from '@/components/ui/Toast';
import {
  getAssetCriticalityExplanation,
  getPMPlanStatusExplanation,
  getPMScheduleStateExplanation,
  getPMScheduleStatusExplanation,
  getPlanScheduleState,
  isActivePMTask,
  isOverduePMTask,
  type PlanScheduleState,
} from '@/utils/pm/semantics';
import type { PMScheduleStatus } from '@/types/database';

type MaybeArray<T> = T | T[] | null | undefined;
type ProfileLite = { id: string; full_name: string | null; email?: string | null };

type AssetJoin = {
  id: string;
  asset_code: string;
  name: string;
  department_id?: string | null;
  departments?: { id?: string; name?: string } | null;
  equipment_categories?: { id?: string; name?: string; criticality_level?: string | null } | null;
};

type PlanDetail = {
  id: string;
  asset_id: string;
  name: string;
  frequency_days: number;
  next_due_date: string | null;
  last_completed_date: string | null;
  is_active: boolean;
  equipment_assets?: AssetJoin | null;
  [key: string]: unknown;
};

type ScheduleRow = {
  id: string;
  plan_id: string;
  asset_id: string;
  scheduled_date: string;
  status: PMScheduleStatus;
  assigned_to: string | null;
  completed_at?: string | null;
  result?: string | null;
  notes?: string | null;
  completion_notes?: string | null;
  skipped_reason?: string | null;
  deferred_reason?: string | null;
  deferred_until?: string | null;
  assigned_to_profile?: MaybeArray<ProfileLite>;
  completed_by_profile?: MaybeArray<ProfileLite>;
  pm_completions?: Array<{
    completion_date?: string | null;
    notes?: string | null;
    completed_by_profile?: MaybeArray<ProfileLite>;
  }> | null;
  [key: string]: unknown;
};

function firstRelation<T>(value: MaybeArray<T>) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

function formatLabel(value?: string | null) {
  return value ? value.replace(/_/g, ' ') : '-';
}

function ExplainableBadge({
  details,
  children,
  variant = 'default',
}: {
  details: Parameters<typeof ScoreExplanation>[0]['details'];
  children: ReactNode;
  variant?: ComponentProps<typeof Badge>['variant'];
}) {
  return (
    <ScoreExplanation details={details}>
      <Badge variant={variant}>{children}</Badge>
    </ScoreExplanation>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs font-medium uppercase text-[var(--text-muted)]">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
        {sub && <p className="mt-1 text-xs text-[var(--text-muted)]">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function PMPlanHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { isAdmin, isBmeHead } = useRole();
  const canManagePlans = isAdmin || isBmeHead;

  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [planRes, schedulesRes] = await Promise.all([
      getPMPlanById(id),
      getPMSchedules({ plan_id: id }),
    ]);
    if (planRes.error || !planRes.data) {
      toast('error', planRes.error?.message ?? 'PM plan not found');
      setLoading(false);
      return;
    }
    if (schedulesRes.error) toast('error', schedulesRes.error.message);
    setPlan(planRes.data as unknown as PlanDetail);
    setSchedules(((schedulesRes.data ?? []) as unknown as ScheduleRow[]).sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date)));
    setLoading(false);
  }, [id, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const scheduleState = useMemo<PlanScheduleState>(() => getPlanScheduleState(schedules), [schedules]);
  const activeSchedules = useMemo(() => schedules.filter((row) => isActivePMTask(row.status)), [schedules]);
  const overdueSchedules = useMemo(() => schedules.filter(isOverduePMTask), [schedules]);
  const completedSchedules = useMemo(() => schedules.filter((row) => row.status === 'completed'), [schedules]);
  const skippedDeferred = useMemo(() => schedules.filter((row) => row.status === 'skipped' || row.status === 'deferred'), [schedules]);
  const focusActive = searchParams.get('focus') === 'active';
  const asset = plan?.equipment_assets ?? null;
  const criticality = asset?.equipment_categories?.criticality_level ?? null;
  const compliance = schedules.length > 0 ? (completedSchedules.length / schedules.length) * 100 : null;

  async function handleGenerate() {
    if (!plan) return;
    if (!window.confirm(`Generate the next PM task for "${plan.name}"?`)) return;
    setMutating(true);
    const result = await generateNextPMScheduleAction(plan.id);
    setMutating(false);
    if (!result.success) {
      toast('error', result.error ?? 'Failed to generate next PM task');
      return;
    }
    const scheduleId = (result.data as { schedule?: { id?: string }; id?: string; existing?: boolean } | undefined)?.schedule?.id
      ?? (result.data as { id?: string } | undefined)?.id;
    const existing = Boolean((result.data as { existing?: boolean } | undefined)?.existing);
    toast('success', existing ? 'This plan already has an unfinished PM task. Opening it now.' : 'Next PM task generated');
    await load();
    if (scheduleId) router.push(`/pm/schedules/${scheduleId}`);
  }

  async function handlePause() {
    if (!plan) return;
    const reason = window.prompt(`Pause recurring PM generation for "${plan.name}"? Existing PM history and active tasks will remain unchanged. Optional reason:`);
    if (reason === null) return;
    setMutating(true);
    const result = await pausePMPlanAction(plan.id, reason);
    setMutating(false);
    if (!result.success) {
      toast('error', result.error ?? 'Failed to pause PM plan');
      return;
    }
    toast('success', 'PM plan paused');
    await load();
  }

  async function handleResume() {
    if (!plan) return;
    if (!window.confirm(`Resume recurring PM generation for "${plan.name}"?`)) return;
    setMutating(true);
    const result = await resumePMPlanAction(plan.id);
    setMutating(false);
    if (!result.success) {
      toast('error', result.error ?? 'Failed to resume PM plan');
      return;
    }
    toast('success', 'PM plan resumed');
    await load();
  }

  if (loading || !plan) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const historyRows = focusActive ? activeSchedules : schedules;
  const latestActive = scheduleState.primaryTask;

  const columns = [
    { key: 'scheduled_date', header: 'Scheduled Date', render: (row: ScheduleRow) => formatDate(row.scheduled_date) },
    { key: 'status', header: 'Status', render: (row: ScheduleRow) => <ScoreExplanation details={getPMScheduleStatusExplanation(row.status)}><PMStatusBadge status={row.status} /></ScoreExplanation> },
    { key: 'assigned_to', header: 'Assigned To', render: (row: ScheduleRow) => firstRelation(row.assigned_to_profile)?.full_name ?? 'Unassigned' },
    { key: 'completed_at', header: 'Completed Date', render: (row: ScheduleRow) => formatDate(row.completed_at ?? row.pm_completions?.[0]?.completion_date) },
    { key: 'result', header: 'Result', render: (row: ScheduleRow) => formatLabel(row.result) },
    {
      key: 'completed_by',
      header: 'Completed By',
      render: (row: ScheduleRow) => firstRelation(row.completed_by_profile)?.full_name ?? firstRelation(row.pm_completions?.[0]?.completed_by_profile)?.full_name ?? '-',
    },
    {
      key: 'notes',
      header: 'Notes / Evidence',
      render: (row: ScheduleRow) => row.completion_notes ?? row.pm_completions?.[0]?.notes ?? row.skipped_reason ?? row.deferred_reason ?? row.notes ?? '-',
    },
    {
      key: 'action',
      header: 'Action',
      render: (row: ScheduleRow) => (
        <Link href={`/pm/schedules/${row.id}`} onClick={(event) => event.stopPropagation()}>
          <Button size="sm" variant="outline">Open Schedule</Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="PM Plan History"
        description={plan.name}
        breadcrumbs={[
          { label: 'Preventive Maintenance', href: '/pm' },
          { label: 'Plan History' },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/pm')}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {latestActive && (
              <Link href={`/pm/schedules/${latestActive.id}`}>
                <Button size="sm" variant={scheduleState.id === 'overdue' ? 'primary' : 'outline'}>
                  <Eye className="h-4 w-4" />
                  {scheduleState.id === 'overdue' ? 'Open Overdue Task' : 'Open Active Task'}
                </Button>
              </Link>
            )}
            {canManagePlans && plan.is_active && scheduleState.activeTasks.length === 0 && (
              <Button size="sm" onClick={handleGenerate} loading={mutating}>
                <RefreshCw className="h-4 w-4" />
                Generate Next Task
              </Button>
            )}
            {canManagePlans && (
              plan.is_active ? (
                <Button size="sm" variant="ghost" onClick={handlePause} loading={mutating}>
                  <PauseCircle className="h-4 w-4" />
                  Pause Plan
                </Button>
              ) : (
                <Button size="sm" onClick={handleResume} loading={mutating}>
                  <PlayCircle className="h-4 w-4" />
                  Resume Plan
                </Button>
              )
            )}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Plan Summary</CardTitle>
          <div className="flex flex-wrap gap-2">
            <ExplainableBadge variant={plan.is_active ? 'success' : 'default'} details={getPMPlanStatusExplanation(plan.is_active)}>
              {plan.is_active ? 'Plan: Active' : 'Plan: Paused'}
            </ExplainableBadge>
            <ExplainableBadge
              variant={criticality === 'critical' || criticality === 'high' ? 'error' : criticality === 'medium' ? 'warning' : 'default'}
              details={getAssetCriticalityExplanation(criticality)}
            >
              Asset criticality: {criticality ? criticality.replace(/_/g, ' ') : 'Not set'}
            </ExplainableBadge>
            <ExplainableBadge variant={scheduleState.variant} details={getPMScheduleStateExplanation(scheduleState)}>
              {scheduleState.label}
            </ExplainableBadge>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase text-[var(--text-muted)]">Asset</dt>
              <dd className="mt-1 text-sm text-[var(--foreground)]">{asset ? `${asset.asset_code} - ${asset.name}` : '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[var(--text-muted)]">Department</dt>
              <dd className="mt-1 text-sm text-[var(--foreground)]">{asset?.departments?.name ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[var(--text-muted)]">Frequency</dt>
              <dd className="mt-1 text-sm text-[var(--foreground)]">Every {plan.frequency_days} days</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[var(--text-muted)]">Next Due</dt>
              <dd className="mt-1 text-sm text-[var(--foreground)]">{formatDate(plan.next_due_date)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[var(--text-muted)]">Last Completed</dt>
              <dd className="mt-1 text-sm text-[var(--foreground)]">{formatDate(plan.last_completed_date)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[var(--text-muted)]">Latest Active Task</dt>
              <dd className="mt-1 text-sm text-[var(--foreground)]">{latestActive ? `${formatDate(latestActive.scheduled_date)} (${latestActive.status.replace(/_/g, ' ')})` : 'None'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Compliance" value={compliance == null ? 'No history' : `${compliance.toFixed(0)}%`} sub="completed ÷ total records" />
        <StatCard label="Schedule Records" value={schedules.length} sub="historical + active" />
        <StatCard label="Completed" value={completedSchedules.length} />
        <StatCard label="Skipped/Deferred" value={skippedDeferred.length} sub="not completed" />
        <StatCard label="Overdue" value={overdueSchedules.length} />
        <StatCard label="Active Tasks" value={activeSchedules.length} sub="unfinished" />
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        PM Compliance = completed scheduled PM tasks ÷ total scheduled PM tasks × 100. Skipped/deferred PM tasks are tracked separately and do not count as completed.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>{focusActive ? 'Active PM Tasks' : 'Schedule History'}</CardTitle>
          {focusActive && (
            <Link href={`/pm/plans/${plan.id}/history`}>
              <Button size="sm" variant="outline">Show All History</Button>
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="rounded-lg border border-[var(--border-subtle)] p-6 text-sm text-[var(--text-muted)]">
              No PM schedule history exists for this plan yet. Generate the next task to begin tracking.
            </div>
          ) : (
            <Table<ScheduleRow>
              columns={columns}
              data={historyRows}
              emptyMessage={focusActive ? 'No unfinished active PM tasks for this plan.' : 'No PM schedule history exists for this plan yet.'}
              onRowClick={(row) => router.push(`/pm/schedules/${row.id}`)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
