'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentProps, type MouseEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarDays,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import { PageHeader, DataTable, Table, Button, Badge, Spinner, AssetFilterChip, AnimatedMetric } from '@/components/ui';
import { motion } from 'framer-motion';
import { cardItem, cardStagger } from '@/lib/ui/motion-presets';
import AssistantPageContextBridge from '@/components/assistant/AssistantPageContextBridge';
import { useAssetFilter } from '@/hooks/useAssetFilter';
import { PMStatusBadge } from '@/components/ui/StatusBadge';
import { getPMPlans, getPMSchedules, getOverduePMSchedules } from '@/services/pm.service';
import { generateNextPMScheduleAction, pausePMPlanAction, resumePMPlanAction } from '@/actions/pm.actions';
import { useToast } from '@/components/ui/Toast';
import { useRole } from '@/hooks/useRole';
import type { PMScheduleStatus } from '@/types/domain';
import { ScoreExplanation } from '../command/_components/ScoreExplanation';
import {
  COMPLIANCE_THRESHOLD,
  getAssetCriticalityExplanation,
  getPMCountExplanation,
  getPMPlanStatusExplanation,
  getPMScheduleStateExplanation,
  getPMScheduleStatusExplanation,
  getPlanScheduleState,
  isActivePMTask,
  isDueSoonPMTask,
  isOverduePMTask,
  todayDate,
  type PlanScheduleState,
} from '@/utils/pm/semantics';

type TabId = 'plans' | 'schedules' | 'overdue';
type PlanFilter = 'all' | 'active' | 'inactive' | 'due_soon' | 'low_compliance' | 'critical';
type ScheduleFilter = 'all' | 'active' | 'scheduled' | 'due_soon' | 'unassigned' | 'in_progress' | 'completed' | 'skipped_deferred' | 'low_compliance';
type OverdueFilter = 'all' | 'critical' | 'unassigned' | '30_plus' | '90_plus' | 'department_critical';

type AssetJoin = {
  id: string;
  asset_code: string;
  name: string;
  condition?: string | null;
  department_id?: string | null;
  departments?: { id?: string; name?: string } | null;
  equipment_categories?: { id?: string; name?: string; criticality_level?: string | null } | null;
};

type ProfileLite = { id: string; full_name: string | null; email?: string | null };
type MaybeArray<T> = T | T[] | null | undefined;

function firstRelation<T>(value: MaybeArray<T>) {
  return Array.isArray(value) ? value[0] : value;
}

type PlanRow = {
  id: string;
  asset_id: string;
  name: string;
  frequency_days: number;
  next_due_date: string | null;
  last_completed_date: string | null;
  is_active: boolean;
  equipment_assets?: AssetJoin | null;
  pm_templates?: { id: string; name: string; frequency_days: number; checklist_items?: unknown } | null;
  asset_label: string;
  department_name: string;
  department_id: string | null;
  criticality: string | null;
  compliance: number | null;
  overdue_count: number;
  generated_schedule_count: number;
  active_task_count: number;
  active_overdue_count: number;
  completed_count: number;
  skipped_deferred_count: number;
  schedule_state: PlanScheduleState;
  search_text: string;
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
  skipped_reason?: string | null;
  deferred_reason?: string | null;
  deferred_until?: string | null;
  completion_notes?: string | null;
  pm_plans?: { id: string; name: string; frequency_days: number } | null;
  equipment_assets?: AssetJoin | null;
  assigned_to_profile?: MaybeArray<ProfileLite>;
  pm_completions?: Array<{ completion_date?: string | null; notes?: string | null }> | null;
  asset_label: string;
  plan_name: string;
  department_name: string;
  department_id: string | null;
  criticality: string | null;
  completion_label: string;
  action_label: string;
  search_text: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
};

type OverduePM = {
  id: string;
  asset_id?: string;
  scheduled_date: string;
  status: string;
  plan_name: string;
  asset_code: string;
  asset_name: string;
  department_name: string;
  category_name: string;
  criticality_level?: string | null;
  assigned_to_name: string | null;
  days_overdue: number;
  search_text: string;
  [key: string]: unknown;
};

type DeptCompliance = {
  department_id: string;
  department_name: string;
  scheduled: number;
  completed: number;
  overdue: number;
  skippedDeferred: number;
  percentage: number | null;
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

function isDueSoon(date?: string | null) {
  if (!date) return false;
  const target = new Date(`${date}T00:00:00`);
  const today = todayDate();
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 30);
  return target >= today && target <= horizon;
}

function isOverdueSchedule(row: Pick<ScheduleRow, 'scheduled_date' | 'status'>) {
  return isOverduePMTask(row);
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function scheduleAction(row: ScheduleRow) {
  if (row.status === 'completed') return 'View PM Evidence';
  if (row.status === 'skipped' || row.status === 'deferred') return 'View Deferral Reason';
  if (isOverdueSchedule(row)) return row.assigned_to ? 'Complete / Defer PM' : 'Assign Technician';
  if (!row.assigned_to) return 'Assign Technician';
  if (row.status === 'in_progress') return 'Complete PM';
  if (row.status === 'scheduled') return 'Start / Reassign PM';
  if (row.status === 'canceled') return 'View PM Record';
  return 'Open PM Task';
}

function actionHref(row: ScheduleRow) {
  if (row.status === 'completed') return `/pm/schedules/${row.id}`;
  if (row.status === 'skipped' || row.status === 'deferred') return `/pm/schedules/${row.id}`;
  if (isOverdueSchedule(row) && !row.assigned_to) return `/pm/schedules/${row.id}?action=assign`;
  if (isOverdueSchedule(row)) return `/pm/schedules/${row.id}?action=complete`;
  if (!row.assigned_to) return `/pm/schedules/${row.id}?action=assign`;
  if (row.status === 'in_progress') return `/pm/schedules/${row.id}?action=complete`;
  return `/pm/schedules/${row.id}?action=reassign`;
}

function QuickFilters<T extends string>({
  options,
  active,
  onChange,
}: {
  options: Array<{ id: T; label: string; count?: number }>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            active === option.id
              ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
              : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]'
          }`}
        >
          {option.label}
          {option.count !== undefined && <span className="ml-1 opacity-80">({option.count})</span>}
        </button>
      ))}
    </div>
  );
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

export default function PMPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isAdmin, isBmeHead } = useRole();
  const canManagePlans = isAdmin || isBmeHead;
  const assetFilter = useAssetFilter();

  const [activeTab, setActiveTab] = useState<TabId>('plans');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>('all');
  const [overdueFilter, setOverdueFilter] = useState<OverdueFilter>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [plansRaw, setPlansRaw] = useState<PlanRow[]>([]);
  const [schedulesRaw, setSchedulesRaw] = useState<ScheduleRow[]>([]);
  const [overdueRaw, setOverdueRaw] = useState<OverduePM[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [planRes, schedRes, overdueRes] = await Promise.all([
      getPMPlans(),
      getPMSchedules(),
      getOverduePMSchedules(),
    ]);
    if (planRes.error) toast('error', 'Failed to load PM plans');
    if (schedRes.error) toast('error', 'Failed to load PM schedules');
    if (overdueRes.error) toast('error', 'Failed to load overdue PMs');
    setPlansRaw((planRes.data ?? []) as unknown as PlanRow[]);
    setSchedulesRaw((schedRes.data ?? []) as unknown as ScheduleRow[]);
    setOverdueRaw(((overdueRes.data ?? []) as unknown as OverduePM[]).map((row) => ({
      ...row,
      search_text: `${row.asset_code} ${row.asset_name} ${row.plan_name} ${row.department_name} ${row.category_name}`,
    })));
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const scheduleMetrics = useMemo(() => {
    const byPlan = new Map<string, { scheduled: number; completed: number; overdue: number }>();
    const byAsset = new Map<string, { scheduled: number; completed: number }>();
    const byDept = new Map<string, DeptCompliance>();
    const currentMonth = monthKey();

    let dueSoon = 0;
    let unassigned = 0;
    let activeTasks = 0;
    let completedThisMonth = 0;
    let skippedDeferred = 0;

    for (const row of schedulesRaw) {
      const asset = row.equipment_assets;
      const deptId = asset?.departments?.id ?? asset?.department_id ?? 'unknown';
      const deptName = asset?.departments?.name ?? 'Unknown';
      const plan = byPlan.get(row.plan_id) ?? { scheduled: 0, completed: 0, overdue: 0 };
      const assetCompliance = byAsset.get(row.asset_id) ?? { scheduled: 0, completed: 0 };
      const dept = byDept.get(deptId) ?? {
        department_id: deptId,
        department_name: deptName,
        scheduled: 0,
        completed: 0,
        overdue: 0,
        skippedDeferred: 0,
        percentage: null,
      };

      plan.scheduled += 1;
      assetCompliance.scheduled += 1;
      dept.scheduled += 1;

      if (row.status === 'completed') {
        plan.completed += 1;
        assetCompliance.completed += 1;
        dept.completed += 1;
        const completedDate = row.completed_at ?? row.pm_completions?.[0]?.completion_date ?? row.updated_at;
        if (completedDate && monthKey(new Date(completedDate)) === currentMonth) completedThisMonth += 1;
      }
      if (isOverdueSchedule(row)) {
        plan.overdue += 1;
        dept.overdue += 1;
      }
      if (isActivePMTask(row.status)) activeTasks += 1;
      if (isDueSoonPMTask(row)) dueSoon += 1;
      if (!row.assigned_to && isActivePMTask(row.status)) unassigned += 1;
      if (row.status === 'skipped' || row.status === 'deferred') {
        dept.skippedDeferred += 1;
        skippedDeferred += 1;
      }

      byPlan.set(row.plan_id, plan);
      byAsset.set(row.asset_id, assetCompliance);
      byDept.set(deptId, dept);
    }

    for (const dept of byDept.values()) {
      dept.percentage = dept.scheduled > 0 ? (dept.completed / dept.scheduled) * 100 : null;
    }

    return {
      byPlan,
      byAsset,
      deptCompliance: Array.from(byDept.values()).sort((a, b) => a.department_name.localeCompare(b.department_name)),
      activeTasks,
      dueSoon,
      unassigned,
      completedThisMonth,
      skippedDeferred,
    };
  }, [schedulesRaw]);

  const lowComplianceDeptIds = useMemo(
    () => new Set(scheduleMetrics.deptCompliance.filter((dept) => dept.percentage != null && dept.percentage < COMPLIANCE_THRESHOLD).map((dept) => dept.department_id)),
    [scheduleMetrics.deptCompliance],
  );

  const schedules = useMemo<ScheduleRow[]>(() => schedulesRaw.map((row) => {
    const asset = row.equipment_assets;
    const plan = row.pm_plans;
    const assetLabel = asset ? `${asset.asset_code} - ${asset.name}` : 'Unknown asset';
    const planName = plan?.name ?? 'No plan';
    const departmentName = asset?.departments?.name ?? 'Unknown';
    const criticality = asset?.equipment_categories?.criticality_level ?? null;
    const completionDate = row.completed_at ?? row.pm_completions?.[0]?.completion_date ?? null;
    const completionLabel = row.status === 'completed'
      ? `${formatDate(completionDate)}${row.result ? ` / ${String(row.result).replace(/_/g, ' ')}` : ''}`
      : row.status === 'skipped'
        ? row.skipped_reason ?? 'Skipped'
        : row.status === 'deferred'
          ? `${row.deferred_reason ?? 'Deferred'}${row.deferred_until ? ` until ${formatDate(row.deferred_until)}` : ''}`
          : '—';
    return {
      ...row,
      asset_label: assetLabel,
      plan_name: planName,
      department_name: departmentName,
      department_id: asset?.departments?.id ?? asset?.department_id ?? null,
      criticality,
      completion_label: completionLabel,
      action_label: scheduleAction(row),
      search_text: `${assetLabel} ${planName} ${departmentName} ${row.status} ${firstRelation(row.assigned_to_profile)?.full_name ?? ''}`,
    };
  }), [schedulesRaw]);

  const plans = useMemo<PlanRow[]>(() => plansRaw.map((row) => {
    const asset = row.equipment_assets;
    const planStats = scheduleMetrics.byPlan.get(row.id);
    const assetStats = scheduleMetrics.byAsset.get(row.asset_id);
    const planSchedules = schedulesRaw.filter((schedule) => schedule.plan_id === row.id);
    const scheduleState = getPlanScheduleState(planSchedules);
    const compliance = assetStats && assetStats.scheduled > 0 ? (assetStats.completed / assetStats.scheduled) * 100 : null;
    const assetLabel = asset ? `${asset.asset_code} - ${asset.name}` : 'Unknown asset';
    const departmentName = asset?.departments?.name ?? 'Unknown';
    return {
      ...row,
      asset_label: assetLabel,
      department_name: departmentName,
      department_id: asset?.departments?.id ?? asset?.department_id ?? null,
      criticality: asset?.equipment_categories?.criticality_level ?? null,
      compliance,
      overdue_count: planStats?.overdue ?? 0,
      generated_schedule_count: planStats?.scheduled ?? 0,
      active_task_count: scheduleState.activeTasks.length,
      active_overdue_count: scheduleState.overdueTasks.length,
      completed_count: planStats?.completed ?? 0,
      skipped_deferred_count: planSchedules.filter((schedule) => schedule.status === 'skipped' || schedule.status === 'deferred').length,
      schedule_state: scheduleState,
      search_text: `${row.name} ${assetLabel} ${departmentName} ${asset?.equipment_categories?.name ?? ''}`,
    };
  }), [plansRaw, scheduleMetrics.byAsset, scheduleMetrics.byPlan, schedulesRaw]);

  const noHistoryDepartments = useMemo(() => {
    const scheduleDeptIds = new Set(scheduleMetrics.deptCompliance.map((dept) => dept.department_id));
    const planDepartments = new Map<string, string>();
    for (const plan of plans) {
      if (plan.department_id && !scheduleDeptIds.has(plan.department_id)) {
        planDepartments.set(plan.department_id, plan.department_name);
      }
    }
    return Array.from(planDepartments.values()).sort();
  }, [plans, scheduleMetrics.deptCompliance]);

  const filteredPlans = useMemo(() => plans.filter((row) => {
    if (assetFilter.assetId && row.asset_id !== assetFilter.assetId) return false;
    if (departmentFilter && row.department_id !== departmentFilter) return false;
    if (planFilter === 'active') return row.is_active;
    if (planFilter === 'inactive') return !row.is_active;
    if (planFilter === 'due_soon') return isDueSoon(row.next_due_date);
    if (planFilter === 'low_compliance') return row.department_id ? lowComplianceDeptIds.has(row.department_id) : false;
    if (planFilter === 'critical') return row.criticality === 'high' || row.criticality === 'critical';
    return true;
  }), [assetFilter.assetId, departmentFilter, lowComplianceDeptIds, planFilter, plans]);

  const filteredSchedules = useMemo(() => schedules.filter((row) => {
    if (assetFilter.assetId && row.asset_id !== assetFilter.assetId) return false;
    if (departmentFilter && row.department_id !== departmentFilter) return false;
    if (scheduleFilter === 'active') return isActivePMTask(row.status);
    if (scheduleFilter === 'scheduled') return row.status === 'scheduled';
    if (scheduleFilter === 'due_soon') return isDueSoonPMTask(row);
    if (scheduleFilter === 'unassigned') return !row.assigned_to && isActivePMTask(row.status);
    if (scheduleFilter === 'in_progress') return row.status === 'in_progress';
    if (scheduleFilter === 'completed') return row.status === 'completed';
    if (scheduleFilter === 'skipped_deferred') return row.status === 'skipped' || row.status === 'deferred';
    if (scheduleFilter === 'low_compliance') return row.department_id ? lowComplianceDeptIds.has(row.department_id) : false;
    return true;
  }), [assetFilter.assetId, departmentFilter, lowComplianceDeptIds, scheduleFilter, schedules]);

  const filteredOverdue = useMemo(() => overdueRaw.filter((row) => {
    if (assetFilter.assetId && (row as { asset_id?: string | null }).asset_id !== assetFilter.assetId) return false;
    if (departmentFilter && !schedules.some((schedule) => schedule.id === row.id && schedule.department_id === departmentFilter)) return false;
    const critical = row.criticality_level === 'high' || row.criticality_level === 'critical';
    if (overdueFilter === 'critical') return critical;
    if (overdueFilter === 'unassigned') return !row.assigned_to_name;
    if (overdueFilter === '30_plus') return row.days_overdue >= 30;
    if (overdueFilter === '90_plus') return row.days_overdue >= 90;
    if (overdueFilter === 'department_critical') return critical || lowComplianceDeptIds.size > 0;
    return true;
  }), [assetFilter.assetId, departmentFilter, lowComplianceDeptIds.size, overdueFilter, overdueRaw, schedules]);

  const summaryCards = [
    { id: 'active_plans', label: 'Active PM Plans', sublabel: 'Enabled recurring PM plans', count: plans.filter((p) => p.is_active).length, icon: ClipboardCheck, tab: 'plans' as TabId, planFilter: 'active' as PlanFilter },
    { id: 'schedule_records', label: 'PM Schedule Records', sublabel: 'Historical + active generated PM tasks', count: schedules.length, icon: CalendarCheck, tab: 'schedules' as TabId, scheduleFilter: 'all' as ScheduleFilter },
    { id: 'active_tasks', label: 'Active PM Tasks', sublabel: 'Unfinished PM tasks requiring action', count: scheduleMetrics.activeTasks, icon: PlayCircle, tab: 'schedules' as TabId, scheduleFilter: 'active' as ScheduleFilter },
    { id: 'due_soon', label: 'Due Soon', sublabel: 'Due within 30 days', count: scheduleMetrics.dueSoon, icon: Clock, tab: 'schedules' as TabId, scheduleFilter: 'due_soon' as ScheduleFilter },
    { id: 'overdue', label: 'Overdue PM', sublabel: 'Past due and unfinished', count: overdueRaw.length, icon: AlertTriangle, tab: 'overdue' as TabId, overdueFilter: 'all' as OverdueFilter },
    { id: 'unassigned', label: 'Unassigned Active PM', sublabel: 'Active tasks without a technician', count: scheduleMetrics.unassigned, icon: UserRound, tab: 'schedules' as TabId, scheduleFilter: 'unassigned' as ScheduleFilter },
    { id: 'completed_month', label: 'Completed This Month', sublabel: 'Completed schedule evidence this month', count: scheduleMetrics.completedThisMonth, icon: CheckCircle2, tab: 'schedules' as TabId, scheduleFilter: 'completed' as ScheduleFilter },
    { id: 'skipped_deferred', label: 'Skipped/Deferred', sublabel: 'Tracked separately; not counted as completed', count: scheduleMetrics.skippedDeferred, icon: PauseCircle, tab: 'schedules' as TabId, scheduleFilter: 'skipped_deferred' as ScheduleFilter },
  ];

  function activateCard(card: (typeof summaryCards)[number]) {
    setDepartmentFilter(null);
    setActiveTab(card.tab);
    if ('planFilter' in card && card.planFilter) setPlanFilter(card.planFilter);
    if ('scheduleFilter' in card && card.scheduleFilter) setScheduleFilter(card.scheduleFilter);
    if ('overdueFilter' in card && card.overdueFilter) setOverdueFilter(card.overdueFilter);
  }

  async function handlePausePlan(e: MouseEvent, plan: PlanRow) {
    e.stopPropagation();
    const reason = window.prompt(`Pause recurring PM generation for "${plan.name}"? Existing PM history and active tasks will remain unchanged. Optional reason:`);
    if (reason === null) return;
    setMutatingId(plan.id);
    const result = await pausePMPlanAction(plan.id, reason);
    setMutatingId(null);
    if (!result.success) {
      toast('error', result.error ?? 'Failed to pause PM plan');
      return;
    }
    toast('success', 'PM plan paused. Existing PM schedule records were not changed.');
    await load();
  }

  async function handleResumePlan(e: MouseEvent, plan: PlanRow) {
    e.stopPropagation();
    if (!window.confirm(`Resume recurring PM generation for "${plan.name}"?`)) return;
    setMutatingId(plan.id);
    const result = await resumePMPlanAction(plan.id);
    setMutatingId(null);
    if (!result.success) {
      toast('error', result.error ?? 'Failed to resume PM plan');
      return;
    }
    toast('success', 'PM plan resumed');
    await load();
  }

  async function handleGenerate(e: MouseEvent, plan: PlanRow) {
    e.stopPropagation();
    if (!window.confirm(`Generate the next PM task for "${plan.name}"?`)) return;
    setMutatingId(plan.id);
    const result = await generateNextPMScheduleAction(plan.id);
    setMutatingId(null);
    if (!result.success) {
      toast('error', result.error ?? 'Failed to generate schedule');
      return;
    }
    const scheduleId = (result.data as { schedule?: { id?: string }; id?: string; existing?: boolean } | undefined)?.schedule?.id
      ?? (result.data as { id?: string } | undefined)?.id;
    const existing = Boolean((result.data as { existing?: boolean } | undefined)?.existing);
    toast('success', existing ? 'This plan already has an unfinished PM task. Opening it now.' : 'Next PM task generated');
    await load();
    if (scheduleId) router.push(`/pm/schedules/${scheduleId}`);
  }

  const planColumns = [
    { key: 'name', header: 'Plan Name', sortable: true },
    { key: 'asset_label', header: 'Asset', sortable: true },
    { key: 'department_name', header: 'Department', sortable: true },
    { key: 'frequency_days', header: 'Frequency', sortable: true, render: (row: PlanRow) => `Every ${row.frequency_days} days` },
    { key: 'last_completed_date', header: 'Last Completed', sortable: true, render: (row: PlanRow) => formatDate(row.last_completed_date) },
    { key: 'next_due_date', header: 'Next Due', sortable: true, render: (row: PlanRow) => <span className={row.overdue_count > 0 ? 'text-rose-400' : undefined}>{formatDate(row.next_due_date)}</span> },
    { key: 'compliance', header: 'Compliance', sortable: true, render: (row: PlanRow) => row.compliance == null ? 'No history' : `${row.compliance.toFixed(0)}%` },
    {
      key: 'is_active',
      header: 'Status',
      render: (row: PlanRow) => (
        <div className="flex max-w-xl flex-wrap gap-2">
          <ExplainableBadge
            variant={row.is_active ? 'success' : 'default'}
            details={getPMPlanStatusExplanation(row.is_active)}
          >
            {row.is_active ? 'Plan: Active' : 'Plan: Paused'}
          </ExplainableBadge>
          <ExplainableBadge
            variant={row.criticality === 'critical' || row.criticality === 'high' ? 'error' : row.criticality === 'medium' ? 'warning' : 'default'}
            details={getAssetCriticalityExplanation(row.criticality)}
          >
            Asset criticality: {row.criticality ? row.criticality.replace(/_/g, ' ') : 'Not set'}
          </ExplainableBadge>
          <ExplainableBadge
            variant={row.schedule_state.variant}
            details={getPMScheduleStateExplanation(row.schedule_state)}
          >
            {row.schedule_state.label}
          </ExplainableBadge>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row: PlanRow) => (
        <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          {row.is_active && row.schedule_state.primaryTask && row.schedule_state.activeTasks.length === 1 && (
            <Link href={`/pm/schedules/${row.schedule_state.primaryTask.id}`}>
              <Button size="sm" variant={row.schedule_state.id === 'overdue' ? 'primary' : 'outline'}>
                <Eye className="h-4 w-4" />
                {row.schedule_state.id === 'overdue' ? 'Open Overdue Task' : 'Open Upcoming Task'}
              </Button>
            </Link>
          )}
          {row.is_active && row.schedule_state.activeTasks.length > 1 && (
            <Link href={`/pm/plans/${row.id}/history?focus=active`}>
              <Button size="sm" variant="primary">
                <Eye className="h-4 w-4" />
                Review Active Tasks
              </Button>
            </Link>
          )}
          {row.is_active && row.schedule_state.activeTasks.length === 0 && canManagePlans && (
            <Button size="sm" variant="primary" loading={mutatingId === row.id} onClick={(e) => handleGenerate(e, row)}>
              <RefreshCw className="h-4 w-4" />
              Generate Next Task
            </Button>
          )}
          <Link href={`/pm/plans/${row.id}/history`}>
            <Button size="sm" variant="outline">
              <Eye className="h-4 w-4" />
              View History
            </Button>
          </Link>
          {canManagePlans && (
            row.is_active ? (
              <Button size="sm" variant="ghost" loading={mutatingId === row.id} onClick={(e) => handlePausePlan(e, row)}>
                {row.is_active ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                Pause Plan
              </Button>
            ) : (
              <Button size="sm" variant="primary" loading={mutatingId === row.id} onClick={(e) => handleResumePlan(e, row)}>
                <PlayCircle className="h-4 w-4" />
                Resume Plan
              </Button>
            )
          )}
        </div>
      ),
    },
  ];

  const scheduleColumns = [
    { key: 'scheduled_date', header: 'Scheduled Date', sortable: true, render: (row: ScheduleRow) => <span className={isOverdueSchedule(row) ? 'text-rose-400' : undefined}>{formatDate(row.scheduled_date)}</span> },
    { key: 'asset_label', header: 'Asset', sortable: true },
    { key: 'department_name', header: 'Department', sortable: true },
    { key: 'plan_name', header: 'Plan', sortable: true },
    { key: 'status', header: 'Status', sortable: true, render: (row: ScheduleRow) => <ScoreExplanation details={getPMScheduleStatusExplanation(row.status)}><PMStatusBadge status={row.status} /></ScoreExplanation> },
    { key: 'assigned_to', header: 'Assigned To', render: (row: ScheduleRow) => firstRelation(row.assigned_to_profile)?.full_name ?? 'Unassigned' },
    { key: 'completion_label', header: 'Completion Date / Result' },
    {
      key: 'action',
      header: 'Action',
      render: (row: ScheduleRow) => (
        <Link href={actionHref(row)} onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant={row.action_label.includes('Complete') || row.action_label.includes('Assign') ? 'primary' : 'outline'}>
            {row.action_label}
          </Button>
        </Link>
      ),
    },
  ];

  const overdueColumns = [
    { key: 'asset_name', header: 'Asset', render: (row: OverduePM) => `${row.asset_code} - ${row.asset_name}` },
    { key: 'plan_name', header: 'Plan' },
    { key: 'department_name', header: 'Department' },
    { key: 'scheduled_date', header: 'Scheduled Date', render: (row: OverduePM) => formatDate(row.scheduled_date) },
    { key: 'days_overdue', header: 'Days Overdue', render: (row: OverduePM) => <span className="font-semibold text-rose-400">{row.days_overdue}</span> },
    { key: 'category_name', header: 'Risk/Criticality', render: (row: OverduePM) => <span>{row.category_name}{row.criticality_level ? ` / ${row.criticality_level}` : ''}</span> },
    { key: 'assigned_to_name', header: 'Assigned To', render: (row: OverduePM) => row.assigned_to_name ?? 'Unassigned' },
    {
      key: 'action',
      header: 'Action',
      render: (row: OverduePM) => (
        <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          <Link href={`/pm/schedules/${row.id}?action=${row.assigned_to_name ? 'complete' : 'assign'}`}>
            <Button size="sm">{row.assigned_to_name ? 'Complete PM' : 'Assign Technician'}</Button>
          </Link>
          <Link href={`/pm/schedules/${row.id}?action=defer`}>
            <Button size="sm" variant="outline">Defer</Button>
          </Link>
          {row.asset_id && (
            <Link href={`/equipment/${row.asset_id}`}>
              <Button size="sm" variant="ghost">Open Asset Profile</Button>
            </Link>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const activeCardId = summaryCards.find((card) => (
    activeTab === card.tab
    && ('planFilter' in card ? card.planFilter === planFilter : true)
    && ('scheduleFilter' in card ? card.scheduleFilter === scheduleFilter : true)
    && ('overdueFilter' in card ? card.overdueFilter === overdueFilter : true)
  ))?.id;

  return (
    <div className="space-y-6">
      <AssistantPageContextBridge
        moduleLabel="Preventive Maintenance"
        pageLabel="PM control center"
        activeTab={activeTab}
        currentFilters={{
          departmentId: departmentFilter || null,
          planFilter,
          scheduleFilter,
          overdueFilter,
        }}
        pageSummary="Preventive maintenance page with PM plans, active schedules, overdue tasks, assignment state, and compliance signals."
        visibleCounts={{
          plans: plans.length,
          schedules: schedules.length,
          overdue: overdueRaw.length,
          visiblePlans: filteredPlans.length,
          visibleSchedules: filteredSchedules.length,
          visibleOverdue: filteredOverdue.length,
          activeTasks: scheduleMetrics.activeTasks,
          unassigned: scheduleMetrics.unassigned,
        }}
        availableEvidenceLinks={[{ label: 'PM', href: '/pm', type: 'module' }, { label: 'Calendar', href: '/calendar?type=pm', type: 'calendar' }]}
        quickPrompts={['Which PM items are urgent?', 'Explain overdue PM concerns.', 'Which PM work should be assigned first?']}
      />
      <PageHeader
        title="Preventive Maintenance"
        description="Planned-maintenance control center for PM plans, schedules, overdue work, assignment, and compliance impact."
        breadcrumbs={[{ label: 'Command Center', href: '/command' }, { label: 'Preventive Maintenance' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/calendar?type=pm">
              <Button variant="outline" size="sm">
                <CalendarDays className="h-4 w-4" />
                View Calendar
              </Button>
            </Link>
            {canManagePlans && (
              <Link href="/pm/plans/new">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  New Plan
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {assetFilter.assetId ? (
        <AssetFilterChip
          asset={assetFilter.asset}
          clearHref={assetFilter.clearHref}
          source={assetFilter.source}
        />
      ) : null}

      <motion.div
        variants={cardStagger}
        initial="initial"
        animate="animate"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const active = activeCardId === card.id && !departmentFilter;
          return (
            <motion.button
              key={card.id}
              variants={cardItem}
              type="button"
              onClick={() => activateCard(card)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                active
                  ? 'border-[var(--brand)] bg-[var(--brand)]/10'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase text-[var(--text-muted)]">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    <AnimatedMetric value={card.count} />
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{card.sublabel}</p>
                </div>
                <Icon className={active ? 'h-5 w-5 text-[var(--brand)]' : 'h-5 w-5 text-[var(--text-muted)]'} />
              </div>
            </motion.button>
          );
        })}
      </motion.div>
      <p className="text-xs text-[var(--text-muted)]">
        {getPMCountExplanation('records')} {getPMCountExplanation('active')}
      </p>

      <div className="panel-surface rounded-lg p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">PM Compliance by Department</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Last 12 months. PM Compliance = completed scheduled PM tasks ÷ total scheduled PM tasks × 100. {getPMCountExplanation('skipped_deferred')}
            </p>
          </div>
          {departmentFilter && (
            <Button size="sm" variant="outline" onClick={() => setDepartmentFilter(null)}>Clear Department Filter</Button>
          )}
        </div>
        {scheduleMetrics.deptCompliance.length === 0 ? (
          <p className="rounded-lg border border-[var(--border-subtle)] p-4 text-sm text-[var(--text-muted)]">No PM schedule history is recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {scheduleMetrics.deptCompliance.map((dept) => (
              <button
                key={dept.department_id}
                type="button"
                onClick={() => { setDepartmentFilter(dept.department_id); setActiveTab('schedules'); }}
                className="grid w-full gap-2 text-left sm:grid-cols-[180px_1fr_190px]"
              >
                <span className="truncate text-sm text-[var(--foreground)]">{dept.department_name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-white/5">
                  <span
                    className={`block h-full rounded-full ${dept.percentage != null && dept.percentage >= 80 ? 'bg-emerald-500' : dept.percentage != null && dept.percentage >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(100, dept.percentage ?? 0)}%` }}
                  />
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {dept.percentage == null ? 'No history' : `${dept.percentage.toFixed(0)}%`}
                  {' '}({dept.completed}/{dept.scheduled}, overdue {dept.overdue}, skipped/deferred {dept.skippedDeferred})
                </span>
              </button>
            ))}
          </div>
        )}
        {noHistoryDepartments.length > 0 && (
          <p className="mt-4 text-xs text-[var(--text-muted)]">
            No recorded PM history: {noHistoryDepartments.join(', ')}.
          </p>
        )}
      </div>

      <div>
        <div className="border-b border-[var(--border-subtle)]">
          <nav className="-mb-px flex gap-4 overflow-x-auto">
            {[
              { id: 'plans' as TabId, label: 'Plans', count: filteredPlans.length },
              { id: 'schedules' as TabId, label: 'Schedules', count: filteredSchedules.length },
              { id: 'overdue' as TabId, label: 'Overdue', count: filteredOverdue.length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-[var(--brand)] text-[var(--brand)]'
                    : 'border-transparent text-[var(--text-muted)] hover:border-[var(--border-subtle)] hover:text-[var(--foreground)]'
                }`}
              >
                {tab.label}
                <span className="ml-2 rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-xs">{tab.count}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="pt-4">
          {activeTab === 'plans' && (
            <>
              <QuickFilters<PlanFilter>
                active={planFilter}
                onChange={setPlanFilter}
                options={[
                  { id: 'all', label: 'All', count: plans.length },
                  { id: 'active', label: 'Active', count: plans.filter((p) => p.is_active).length },
                  { id: 'inactive', label: 'Inactive/Paused', count: plans.filter((p) => !p.is_active).length },
                  { id: 'due_soon', label: 'Due soon', count: plans.filter((p) => isDueSoon(p.next_due_date)).length },
                  { id: 'low_compliance', label: 'Low compliance', count: plans.filter((p) => p.department_id && lowComplianceDeptIds.has(p.department_id)).length },
                  { id: 'critical', label: 'Critical assets', count: plans.filter((p) => p.criticality === 'high' || p.criticality === 'critical').length },
                ]}
              />
              <DataTable<PlanRow>
                key={`plans-${planFilter}-${departmentFilter ?? 'all'}`}
                columns={planColumns}
                data={filteredPlans}
                searchPlaceholder="Search plans, assets, departments..."
                emptyMessage="No PM plans match this view."
              />
            </>
          )}

          {activeTab === 'schedules' && (
            <>
              <QuickFilters<ScheduleFilter>
                active={scheduleFilter}
                onChange={setScheduleFilter}
                options={[
                  { id: 'all', label: 'All', count: schedules.length },
                  { id: 'active', label: 'Active tasks', count: schedules.filter((s) => isActivePMTask(s.status)).length },
                  { id: 'scheduled', label: 'Scheduled', count: schedules.filter((s) => s.status === 'scheduled').length },
                  { id: 'due_soon', label: 'Due soon', count: schedules.filter(isDueSoonPMTask).length },
                  { id: 'unassigned', label: 'Unassigned', count: schedules.filter((s) => !s.assigned_to && isActivePMTask(s.status)).length },
                  { id: 'in_progress', label: 'In progress', count: schedules.filter((s) => s.status === 'in_progress').length },
                  { id: 'completed', label: 'Completed', count: schedules.filter((s) => s.status === 'completed').length },
                  { id: 'skipped_deferred', label: 'Skipped/Deferred', count: schedules.filter((s) => s.status === 'skipped' || s.status === 'deferred').length },
                ]}
              />
              <DataTable<ScheduleRow>
                key={`schedules-${scheduleFilter}-${departmentFilter ?? 'all'}`}
                columns={scheduleColumns}
                data={filteredSchedules}
                searchPlaceholder="Search schedules, assets, plans..."
                onRowClick={(row) => router.push(`/pm/schedules/${row.id}`)}
                emptyMessage="No PM schedules match this view."
              />
            </>
          )}

          {activeTab === 'overdue' && (
            <>
              <QuickFilters<OverdueFilter>
                active={overdueFilter}
                onChange={setOverdueFilter}
                options={[
                  { id: 'all', label: 'All', count: overdueRaw.length },
                  { id: 'critical', label: 'Critical assets', count: overdueRaw.filter((o) => o.criticality_level === 'high' || o.criticality_level === 'critical').length },
                  { id: 'unassigned', label: 'Unassigned', count: overdueRaw.filter((o) => !o.assigned_to_name).length },
                  { id: '30_plus', label: '30+ days overdue', count: overdueRaw.filter((o) => o.days_overdue >= 30).length },
                  { id: '90_plus', label: '90+ days overdue', count: overdueRaw.filter((o) => o.days_overdue >= 90).length },
                  { id: 'department_critical', label: 'Department critical', count: overdueRaw.filter((o) => o.criticality_level === 'high' || o.criticality_level === 'critical').length },
                ]}
              />
              {filteredOverdue.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--border-subtle)] py-16 text-center">
                  <AlertTriangle className="mb-4 h-12 w-12 text-[var(--text-muted)]" />
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">No Overdue PMs</h3>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">All preventive maintenance in this view is up to date.</p>
                </div>
              ) : (
                <Table<OverduePM>
                  columns={overdueColumns}
                  data={filteredOverdue}
                  onRowClick={(row) => router.push(`/pm/schedules/${row.id}`)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
