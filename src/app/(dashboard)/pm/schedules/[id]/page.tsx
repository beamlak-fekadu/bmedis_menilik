'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Clock, PauseCircle, PlayCircle, UserRound } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Input,
  Textarea,
  Select,
  Modal,
  Spinner,
  Badge,
  Table,
} from '@/components/ui';
import { ConditionBadge, PMStatusBadge, RiskBadge } from '@/components/ui/StatusBadge';
import { getPMScheduleById, getPMScheduleHistory } from '@/services/pm.service';
import { getActiveTechnicians } from '@/services/users.service';
import { getMaintenanceEvents, getWorkOrders } from '@/services/maintenance.service';
import { getRiskScores } from '@/services/analytics.service';
import {
  assignPMScheduleAction,
  createPMCompletionAction,
  deferOrSkipPMScheduleAction,
  startPMScheduleAction,
} from '@/actions/pm.actions';
import { useToast } from '@/components/ui/Toast';
import { useRole } from '@/hooks/useRole';
import type { EquipmentCondition, PMChecklistItem, PMScheduleStatus, RiskLevel } from '@/types/domain';
import { ScoreExplanation } from '../../../command/_components/ScoreExplanation';
import { getPMScheduleStatusExplanation } from '@/utils/pm/semantics';

const DEFAULT_CHECKLIST: PMChecklistItem[] = [
  { task: 'Visual inspection completed', required: true, completed: false },
  { task: 'Cleaning performed', required: true, completed: false },
  { task: 'Safety checks completed', required: true, completed: false },
  { task: 'Functional test completed', required: true, completed: false },
  { task: 'Accessories/consumables checked', required: false, completed: false },
  { task: 'Performance verified', required: true, completed: false },
  { task: 'User feedback reviewed', required: false, completed: false },
];

const REASON_OPTIONS = [
  { value: 'equipment unavailable', label: 'Equipment unavailable' },
  { value: 'department access unavailable', label: 'Department access unavailable' },
  { value: 'technician unavailable', label: 'Technician unavailable' },
  { value: 'spare part unavailable', label: 'Spare part unavailable' },
  { value: 'external vendor required', label: 'External vendor required' },
  { value: 'safety/clinical use conflict', label: 'Safety/clinical use conflict' },
  { value: 'other', label: 'Other' },
];

type ProfileLite = { id: string; full_name: string | null; email?: string | null };
type MaybeArray<T> = T | T[] | null | undefined;

function firstRelation<T>(value: MaybeArray<T>) {
  return Array.isArray(value) ? value[0] : value;
}

type AssetJoin = {
  id: string;
  asset_code: string;
  name: string;
  condition: EquipmentCondition;
  department_id?: string | null;
  departments?: { id?: string; name?: string } | null;
  equipment_categories?: { id?: string; name?: string; criticality_level?: string | null } | null;
};

type ScheduleDetail = {
  id: string;
  plan_id: string;
  asset_id: string;
  scheduled_date: string;
  status: PMScheduleStatus;
  assigned_to: string | null;
  notes: string | null;
  result?: 'pass' | 'issue_found' | 'failed' | null;
  completion_checklist?: PMChecklistItem[] | null;
  completion_notes?: string | null;
  final_equipment_condition?: EquipmentCondition | null;
  corrective_action_needed?: boolean;
  skipped_reason?: string | null;
  deferred_until?: string | null;
  deferred_reason?: string | null;
  completed_by?: string | null;
  completed_at?: string | null;
  started_at?: string | null;
  created_at: string;
  updated_at: string;
  pm_plans?: {
    id: string;
    name: string;
    frequency_days: number;
    next_due_date?: string | null;
    last_completed_date?: string | null;
    is_active?: boolean;
    pm_templates?: { id?: string; name?: string; checklist_items?: PMChecklistItem[] | null } | null;
  } | null;
  equipment_assets?: AssetJoin | null;
  assigned_to_profile?: MaybeArray<ProfileLite>;
  completed_by_profile?: MaybeArray<ProfileLite>;
  pm_completions?: Array<{
    id: string;
    completed_by: string | null;
    completion_date: string;
    duration_hours: number | null;
    notes: string | null;
    checklist_results: PMChecklistItem[] | null;
    completed_by_profile?: MaybeArray<ProfileLite>;
  }> | null;
  [key: string]: unknown;
};

type RiskRow = {
  rpn: number;
  risk_level: RiskLevel;
  severity: number;
  occurrence: number;
  detectability: number;
  explanation?: Record<string, unknown> | null;
};

type MaintenanceEventRow = {
  id: string;
  event_type: string;
  failure_date: string | null;
  completion_date?: string | null;
  notes?: string | null;
};

type WorkOrderRow = {
  id: string;
  work_order_number: string;
  asset_id: string;
  work_type: string;
  status: string;
  completed_at?: string | null;
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

function daysOverdue(date: string, status: string) {
  if (status === 'completed' || status === 'skipped' || status === 'deferred' || status === 'canceled') return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  return Math.max(0, Math.ceil((today.getTime() - target.getTime()) / 86400000));
}

function conditionForResult(result: string): EquipmentCondition {
  if (result === 'failed') return 'non_functional';
  if (result === 'issue_found') return 'needs_repair';
  return 'functional';
}

function checklistFromSchedule(schedule: ScheduleDetail | null) {
  const templateItems = schedule?.pm_plans?.pm_templates?.checklist_items;
  if (Array.isArray(templateItems) && templateItems.length > 0) {
    return templateItems.map((item) => ({ ...item, completed: item.completed ?? false }));
  }
  return DEFAULT_CHECKLIST;
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 text-sm text-[var(--foreground)]">{value || '—'}</dd>
    </div>
  );
}

export default function PMScheduleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { canManageMaintenance } = useRole();

  const [schedule, setSchedule] = useState<ScheduleDetail | null>(null);
  const [history, setHistory] = useState<ScheduleDetail[]>([]);
  const [technicians, setTechnicians] = useState<ProfileLite[]>([]);
  const [risk, setRisk] = useState<RiskRow | null>(null);
  const [events, setEvents] = useState<MaintenanceEventRow[]>([]);
  const [lastCorrective, setLastCorrective] = useState<WorkOrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [deferModalOpen, setDeferModalOpen] = useState(false);
  const [deferMode, setDeferMode] = useState<'defer' | 'skip'>('defer');
  const [assignment, setAssignment] = useState('');
  const [completionForm, setCompletionForm] = useState({
    completion_date: new Date().toISOString().split('T')[0],
    completed_by: '',
    duration_hours: '',
    result: 'pass',
    notes: '',
    final_equipment_condition: 'functional' as EquipmentCondition,
    corrective_action_needed: false,
    create_corrective_request: false,
  });
  const [checklist, setChecklist] = useState<PMChecklistItem[]>(DEFAULT_CHECKLIST);
  const [deferForm, setDeferForm] = useState({
    reason: 'equipment unavailable',
    new_scheduled_date: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const scheduleRes = await getPMScheduleById(id);
    if (scheduleRes.error || !scheduleRes.data) {
      toast('error', scheduleRes.error?.message ?? 'Schedule not found');
      setLoading(false);
      return;
    }

    const loaded = scheduleRes.data as unknown as ScheduleDetail;
    setSchedule(loaded);
    setAssignment(loaded.assigned_to ?? '');

    const [historyRes, techRes, riskRes, eventRes, workOrderRes] = await Promise.all([
      getPMScheduleHistory({ asset_id: loaded.asset_id, plan_id: loaded.plan_id }),
      getActiveTechnicians(),
      getRiskScores({ asset_id: loaded.asset_id }),
      getMaintenanceEvents(loaded.asset_id),
      getWorkOrders(),
    ]);

    setHistory(((historyRes.data ?? []) as unknown as ScheduleDetail[]).filter((item) => item.id !== id));
    setTechnicians((techRes.data ?? []) as unknown as ProfileLite[]);
    setRisk(((riskRes.data ?? []) as unknown as RiskRow[])[0] ?? null);
    setEvents((eventRes.data ?? []) as unknown as MaintenanceEventRow[]);
    const workOrders = (workOrderRes.data ?? []) as unknown as WorkOrderRow[];
    setLastCorrective(workOrders.find((wo) => wo.asset_id === loaded.asset_id && wo.work_type === 'corrective' && wo.status === 'completed') ?? null);
    setLoading(false);
  }, [id, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const openCompletionModal = useCallback(() => {
    if (!schedule) return;
    const completedBy = schedule.assigned_to ?? '';
    setCompletionForm({
      completion_date: new Date().toISOString().split('T')[0],
      completed_by: completedBy,
      duration_hours: '',
      result: 'pass',
      notes: '',
      final_equipment_condition: 'functional',
      corrective_action_needed: false,
      create_corrective_request: false,
    });
    setChecklist(checklistFromSchedule(schedule));
    setCompletionModalOpen(true);
  }, [schedule]);

  useEffect(() => {
    if (!schedule) return;
    const timer = setTimeout(() => {
      const action = searchParams.get('action');
      if (action === 'assign' || action === 'reassign') setAssignmentModalOpen(true);
      if (action === 'complete' || action === 'checklist') openCompletionModal();
      if (action === 'defer') {
        setDeferMode('defer');
        setDeferModalOpen(true);
      }
      if (action === 'skip') {
        setDeferMode('skip');
        setDeferModalOpen(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [schedule, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const overdueDays = schedule ? daysOverdue(schedule.scheduled_date, schedule.status) : 0;
  const completion = schedule?.pm_completions?.[0] ?? null;
  const assignedProfile = firstRelation(schedule?.assigned_to_profile);
  const completedProfile = firstRelation(schedule?.completed_by_profile);
  const completionProfile = firstRelation(completion?.completed_by_profile);
  const canMutate = canManageMaintenance;
  const canComplete = schedule && ['scheduled', 'overdue', 'in_progress'].includes(schedule.status);
  const asset = schedule?.equipment_assets;
  const checklistEvidence = schedule?.completion_checklist?.length ? schedule.completion_checklist : completion?.checklist_results;

  const failureEvents = useMemo(
    () => events.filter((event) => event.event_type === 'corrective' || event.event_type === 'emergency').slice(0, 5),
    [events],
  );

  async function handleAssign() {
    if (!schedule) return;
    setActionLoading(true);
    const result = await assignPMScheduleAction(schedule.id, assignment || null);
    setActionLoading(false);
    if (!result.success) {
      toast('error', result.error ?? 'Failed to assign PM');
      return;
    }
    toast('success', assignment ? 'PM assignment updated' : 'PM assignment cleared');
    setAssignmentModalOpen(false);
    await load();
  }

  async function handleStart() {
    if (!schedule) return;
    setActionLoading(true);
    const result = await startPMScheduleAction(schedule.id);
    setActionLoading(false);
    if (!result.success) {
      toast('error', result.error ?? 'Failed to start PM');
      return;
    }
    toast('success', 'PM marked in progress');
    await load();
  }

  async function handleComplete() {
    if (!schedule) return;
    setActionLoading(true);
    const result = await createPMCompletionAction({
      schedule_id: schedule.id,
      completed_by: completionForm.completed_by || null,
      completion_date: completionForm.completion_date,
      duration_hours: completionForm.duration_hours ? Number(completionForm.duration_hours) : null,
      result: completionForm.result,
      checklist_results: checklist,
      notes: completionForm.notes || null,
      final_equipment_condition: completionForm.final_equipment_condition,
      corrective_action_needed: completionForm.corrective_action_needed,
      create_corrective_request: completionForm.create_corrective_request,
    });
    setActionLoading(false);
    if (!result.success) {
      toast('error', result.error ?? 'Failed to record completion');
      return;
    }

    const correctiveRequestId = (result.data as { correctiveRequestId?: string | null } | undefined)?.correctiveRequestId;
    toast('success', correctiveRequestId ? 'PM completed and corrective request opened' : 'PM completion evidence recorded');
    setCompletionModalOpen(false);
    if (correctiveRequestId) {
      router.push(`/maintenance/requests/${correctiveRequestId}`);
      return;
    }
    await load();
  }

  async function handleDeferSkip() {
    if (!schedule) return;
    if (deferMode === 'defer' && !deferForm.new_scheduled_date) {
      toast('warning', 'Choose a new scheduled date for deferred PM');
      return;
    }
    setActionLoading(true);
    const result = await deferOrSkipPMScheduleAction({
      schedule_id: schedule.id,
      action_type: deferMode,
      reason: deferForm.reason,
      new_scheduled_date: deferMode === 'defer' ? deferForm.new_scheduled_date : null,
      notes: deferForm.notes || null,
    });
    setActionLoading(false);
    if (!result.success) {
      toast('error', result.error ?? `Failed to ${deferMode} PM`);
      return;
    }
    toast('success', deferMode === 'defer' ? 'PM deferred with reason' : 'PM skipped with reason');
    setDeferModalOpen(false);
    await load();
  }

  if (loading || !schedule) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const historyColumns = [
    { key: 'scheduled_date', header: 'Scheduled Date', render: (row: ScheduleDetail) => formatDate(row.scheduled_date) },
    { key: 'status', header: 'Status', render: (row: ScheduleDetail) => <ScoreExplanation details={getPMScheduleStatusExplanation(row.status)}><PMStatusBadge status={row.status} /></ScoreExplanation> },
    { key: 'result', header: 'Result', render: (row: ScheduleDetail) => row.result?.replace(/_/g, ' ') ?? '—' },
    { key: 'completed_by', header: 'Completed By', render: (row: ScheduleDetail) => firstRelation(row.completed_by_profile)?.full_name ?? firstRelation(row.pm_completions?.[0]?.completed_by_profile)?.full_name ?? '—' },
    { key: 'completion_notes', header: 'Notes / Finding', render: (row: ScheduleDetail) => row.completion_notes ?? row.pm_completions?.[0]?.notes ?? row.skipped_reason ?? row.deferred_reason ?? '—' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="PM Execution Detail"
        description={schedule.pm_plans?.name ?? 'Preventive maintenance schedule'}
        breadcrumbs={[
          { label: 'Command Center', href: '/command' },
          { label: 'Preventive Maintenance', href: '/pm' },
          { label: 'Schedule Detail' },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push('/pm')}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>PM Schedule Summary</CardTitle>
            <ScoreExplanation details={getPMScheduleStatusExplanation(schedule.status)}>
              <PMStatusBadge status={schedule.status} />
            </ScoreExplanation>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <DetailRow label="Schedule ID" value={schedule.id.slice(0, 8)} />
              <DetailRow label="Plan" value={schedule.pm_plans?.name} />
              <DetailRow label="Frequency" value={schedule.pm_plans ? `Every ${schedule.pm_plans.frequency_days} days` : '—'} />
              <DetailRow label="Asset" value={asset ? `${asset.asset_code} - ${asset.name}` : '—'} />
              <DetailRow label="Department" value={asset?.departments?.name} />
              <DetailRow label="Scheduled Date" value={formatDate(schedule.scheduled_date)} />
              <DetailRow label="Assigned Technician" value={assignedProfile?.full_name ?? 'Unassigned'} />
              <DetailRow label="Days Overdue" value={overdueDays > 0 ? <span className="text-rose-400">{overdueDays}</span> : 'Not overdue'} />
              <DetailRow label="Created / Updated" value={`${formatDate(schedule.created_at)} / ${formatDate(schedule.updated_at)}`} />
            </dl>
          </CardContent>
          {canMutate && (
            <CardFooter className="flex-wrap">
              {!schedule.assigned_to && schedule.status !== 'completed' && (
                <Button onClick={() => setAssignmentModalOpen(true)}>
                  <UserRound className="h-4 w-4" />
                  Assign
                </Button>
              )}
              {schedule.assigned_to && schedule.status !== 'completed' && (
                <Button variant="outline" onClick={() => setAssignmentModalOpen(true)}>
                  <UserRound className="h-4 w-4" />
                  Reassign
                </Button>
              )}
              {schedule.status === 'scheduled' && (
                <Button variant="outline" onClick={handleStart} loading={actionLoading}>
                  <PlayCircle className="h-4 w-4" />
                  Start
                </Button>
              )}
              {canComplete && (
                <Button onClick={openCompletionModal}>
                  <CheckCircle className="h-4 w-4" />
                  Complete PM
                </Button>
              )}
              {schedule.status !== 'completed' && schedule.status !== 'skipped' && schedule.status !== 'deferred' && (
                <>
                  <Button variant="outline" onClick={() => { setDeferMode('defer'); setDeferModalOpen(true); }}>
                    <Clock className="h-4 w-4" />
                    Defer
                  </Button>
                  <Button variant="ghost" onClick={() => { setDeferMode('skip'); setDeferModalOpen(true); }}>
                    <PauseCircle className="h-4 w-4" />
                    Skip
                  </Button>
                </>
              )}
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Info</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <DetailRow label="Last Completed" value={formatDate(schedule.pm_plans?.last_completed_date)} />
              <DetailRow label="Next Due" value={formatDate(schedule.pm_plans?.next_due_date)} />
              <DetailRow label="Compliance Impact" value={schedule.status === 'completed' ? 'Counts as completed PM' : schedule.status === 'skipped' || schedule.status === 'deferred' ? 'Tracked separately, not counted completed' : 'Open scheduled task'} />
              {schedule.status === 'deferred' && <DetailRow label="Deferred Until" value={formatDate(schedule.deferred_until)} />}
              {(schedule.skipped_reason || schedule.deferred_reason) && <DetailRow label="Reason" value={schedule.skipped_reason ?? schedule.deferred_reason} />}
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Asset Context</CardTitle>
            {asset && (
              <Link href={`/equipment/${asset.id}`}>
                <Button size="sm" variant="outline">View Equipment</Button>
              </Link>
            )}
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              {asset?.condition && <DetailRow label="Condition" value={<ConditionBadge condition={asset.condition} />} />}
              <DetailRow label="Category / Criticality" value={`${asset?.equipment_categories?.name ?? '—'} / ${asset?.equipment_categories?.criticality_level ?? '—'}`} />
              <DetailRow label="RPN / Risk" value={risk ? <span className="inline-flex items-center gap-2">{risk.rpn}<RiskBadge level={risk.risk_level} /></span> : 'No risk score'} />
              <DetailRow label="FMEA Formula" value={risk ? `${risk.severity} × ${risk.occurrence} × ${risk.detectability}` : '—'} />
              <DetailRow label="Recent Failures" value={failureEvents.length} />
              <DetailRow label="Last Corrective WO" value={lastCorrective ? `${lastCorrective.work_order_number} (${lastCorrective.status})` : 'No completed corrective WO found'} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <p className="text-[var(--text-muted)]">Current technician</p>
              <p className="text-lg font-semibold text-[var(--foreground)]">{assignedProfile?.full_name ?? 'Unassigned'}</p>
              {canMutate ? (
                <Button variant="outline" onClick={() => setAssignmentModalOpen(true)}>
                  <UserRound className="h-4 w-4" />
                  {schedule.assigned_to ? 'Reassign Technician' : 'Assign Technician'}
                </Button>
              ) : (
                <Badge variant="default">Read only</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PM Checklist / Evidence</CardTitle>
          {schedule.result && <Badge variant={schedule.result === 'pass' ? 'success' : 'warning'}>{schedule.result.replace(/_/g, ' ')}</Badge>}
        </CardHeader>
        <CardContent>
          {schedule.status === 'completed' ? (
            <div className="space-y-4">
              <dl className="grid gap-4 sm:grid-cols-4">
                <DetailRow label="Completed Date" value={formatDate(schedule.completed_at ?? completion?.completion_date)} />
                <DetailRow label="Completed By" value={completedProfile?.full_name ?? completionProfile?.full_name ?? '—'} />
                <DetailRow label="Final Condition" value={schedule.final_equipment_condition ? <ConditionBadge condition={schedule.final_equipment_condition} /> : '—'} />
                <DetailRow label="Corrective Needed" value={schedule.corrective_action_needed ? 'Yes' : 'No'} />
              </dl>
              <div className="grid gap-2 sm:grid-cols-2">
                {(checklistEvidence ?? []).map((item, idx) => (
                  <div key={`${item.task}-${idx}`} className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">
                    <span className={item.completed ? 'text-emerald-400' : 'text-[var(--text-muted)]'}>{item.completed ? 'Done' : 'Not done'}</span>
                    <span className="ml-2 text-[var(--foreground)]">{item.task}</span>
                    {item.notes && <p className="mt-1 text-xs text-[var(--text-muted)]">{item.notes}</p>}
                  </div>
                ))}
              </div>
              {schedule.completion_notes && <p className="whitespace-pre-wrap rounded-lg bg-[var(--surface-2)] p-3 text-sm text-[var(--foreground)]">{schedule.completion_notes}</p>}
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--border-subtle)] p-4 text-sm text-[var(--text-muted)]">
              Completion evidence has not been recorded. Completing PM will capture result, checklist, notes, technician, final equipment condition, and optional corrective request evidence.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PM History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table<ScheduleDetail>
            columns={historyColumns}
            data={history}
            emptyMessage="No previous PM schedules found for this plan and asset."
            onRowClick={(row) => router.push(`/pm/schedules/${row.id}`)}
          />
        </CardContent>
      </Card>

      <Modal
        open={assignmentModalOpen}
        onClose={() => setAssignmentModalOpen(false)}
        title={schedule.assigned_to ? 'Reassign PM' : 'Assign PM'}
        footer={
          <>
            <Button variant="outline" onClick={() => setAssignmentModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} loading={actionLoading}>Save Assignment</Button>
          </>
        }
      >
        <Select
          label="Technician"
          value={assignment}
          onChange={(e) => setAssignment(e.target.value)}
          options={[
            { value: '', label: 'Unassigned' },
            ...technicians.map((tech) => ({ value: tech.id, label: tech.full_name ?? tech.email ?? tech.id })),
          ]}
        />
      </Modal>

      <Modal
        open={completionModalOpen}
        onClose={() => setCompletionModalOpen(false)}
        title="Complete PM With Evidence"
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setCompletionModalOpen(false)}>Cancel</Button>
            <Button onClick={handleComplete} loading={actionLoading}>
              <CheckCircle className="h-4 w-4" />
              Record Completion
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Completion Date"
              type="date"
              value={completionForm.completion_date}
              onChange={(e) => setCompletionForm((prev) => ({ ...prev, completion_date: e.target.value }))}
            />
            <Select
              label="Completed By"
              value={completionForm.completed_by}
              onChange={(e) => setCompletionForm((prev) => ({ ...prev, completed_by: e.target.value }))}
              options={[
                { value: '', label: assignedProfile?.full_name ? `Assigned: ${assignedProfile.full_name}` : 'Current user' },
                ...technicians.map((tech) => ({ value: tech.id, label: tech.full_name ?? tech.email ?? tech.id })),
              ]}
            />
            <Input
              label="Duration (hours)"
              type="number"
              step="0.5"
              value={completionForm.duration_hours}
              onChange={(e) => setCompletionForm((prev) => ({ ...prev, duration_hours: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Result"
              value={completionForm.result}
              onChange={(e) => {
                const result = e.target.value;
                const finalCondition = conditionForResult(result);
                setCompletionForm((prev) => ({
                  ...prev,
                  result,
                  final_equipment_condition: finalCondition,
                  corrective_action_needed: result !== 'pass',
                  create_corrective_request: result !== 'pass',
                }));
              }}
              options={[
                { value: 'pass', label: 'Pass' },
                { value: 'issue_found', label: 'Issue found' },
                { value: 'failed', label: 'Failed' },
              ]}
            />
            <Select
              label="Final Equipment Condition"
              value={completionForm.final_equipment_condition}
              onChange={(e) => setCompletionForm((prev) => ({ ...prev, final_equipment_condition: e.target.value as EquipmentCondition }))}
              options={[
                { value: 'functional', label: 'Functional' },
                { value: 'needs_repair', label: 'Needs repair' },
                { value: 'non_functional', label: 'Non-functional' },
                { value: 'under_maintenance', label: 'Under maintenance' },
              ]}
            />
          </div>

          <div>
            <h4 className="mb-2 text-sm font-medium text-[var(--foreground)]">Checklist</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {checklist.map((item, idx) => (
                <label key={`${item.task}-${idx}`} className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">
                  <span className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={item.completed ?? false}
                      onChange={(e) => {
                        const updated = [...checklist];
                        updated[idx] = { ...updated[idx], completed: e.target.checked };
                        setChecklist(updated);
                      }}
                      className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-[var(--foreground)]">
                      {item.task}
                      {item.required && <span className="ml-1 text-rose-400">*</span>}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <Textarea
            label="Notes / Findings"
            value={completionForm.notes}
            onChange={(e) => setCompletionForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Summarize work performed, findings, measurements, user feedback, and recommended next action."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] p-3 text-sm text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={completionForm.corrective_action_needed}
                onChange={(e) => setCompletionForm((prev) => ({ ...prev, corrective_action_needed: e.target.checked }))}
              />
              Corrective action needed
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] p-3 text-sm text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={completionForm.create_corrective_request}
                onChange={(e) => setCompletionForm((prev) => ({ ...prev, create_corrective_request: e.target.checked }))}
              />
              Create/open corrective request
            </label>
          </div>
        </div>
      </Modal>

      <Modal
        open={deferModalOpen}
        onClose={() => setDeferModalOpen(false)}
        title={deferMode === 'defer' ? 'Defer PM With Reason' : 'Skip PM With Reason'}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeferModalOpen(false)}>Cancel</Button>
            <Button onClick={handleDeferSkip} loading={actionLoading}>{deferMode === 'defer' ? 'Defer PM' : 'Skip PM'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Reason"
            value={deferForm.reason}
            onChange={(e) => setDeferForm((prev) => ({ ...prev, reason: e.target.value }))}
            options={REASON_OPTIONS}
          />
          {deferMode === 'defer' && (
            <Input
              label="New Scheduled Date"
              type="date"
              value={deferForm.new_scheduled_date}
              onChange={(e) => setDeferForm((prev) => ({ ...prev, new_scheduled_date: e.target.value }))}
            />
          )}
          <Textarea
            label="Notes"
            value={deferForm.notes}
            onChange={(e) => setDeferForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Add operational context or approval note."
          />
          <p className="text-xs text-[var(--text-muted)]">Skipped/deferred PM is tracked separately and does not count as completed PM compliance.</p>
        </div>
      </Modal>
    </div>
  );
}
