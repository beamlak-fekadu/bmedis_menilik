'use client';

import Link from 'next/link';
import { Fragment, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CalendarCheck, CheckCircle2, ClipboardList, Wrench, X } from 'lucide-react';
import { Badge, Button, Input, Modal, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { AcknowledgeButton } from './AcknowledgeButton';
import {
  createCommandPMSchedule,
  createDiagnosticMaintenanceRequest,
  createReplacementDisposalRequest,
  getDepartmentReadinessDetail,
  getTriageAssetDetail,
  getWorkInProgressDetail,
} from '@/actions/command.actions';
import { generateTriageReason } from '@/utils/decision-support/explanations';

type TriageRow = {
  id: string;
  flag_id: string | null;
  flag_type: string | null;
  flag_severity: string | null;
  asset_id: string;
  asset_name: string;
  asset_code: string;
  department_id: string | null;
  department_name: string;
  recommendation: string;
  rationale: string[];
  score: number;
};

type DeptReadiness = {
  department_id: string;
  department_name: string;
  essential_total: number;
  essential_functional: number;
  readiness_score: number;
};

type WorkInProgress = {
  open_work_orders: number;
  in_progress: number;
  assigned: number;
  on_hold: number;
  overdue_pm: number;
  overdue_pm_gt30: number;
  calibration_due_30d: number;
};

type TriageDetail = {
  queue_id: string;
  asset_id: string;
  asset_name: string;
  asset_code: string;
  department_id: string | null;
  department_name: string;
  age_years: number | null;
  last_maintenance_date: string | null;
  rpn: number | null;
  pmc_percentage: number | null;
  availability_percentage: number | null;
  mtbf_hours: number | null;
  flag_type: string | null;
  priority_score: number;
  rationale: string[];
  recommendation: string;
};

type DepartmentDetail = {
  department_id: string;
  assets: Array<{
    asset_id: string;
    asset_name: string;
    asset_code: string;
    health_status: string;
    health_score: number | null;
    rpn: number | null;
  }>;
  pm_compliance_percentage: number | null;
  open_work_orders: number;
};

type WipKind = 'work_orders' | 'overdue_pm' | 'calibration_due';
type WipDetail = {
  kind: WipKind;
  work_orders?: Array<{
    id: string;
    work_order_number: string;
    asset_name: string;
    status: string;
    assigned_to_name: string | null;
    created_at: string;
  }>;
  overdue_pm?: Array<{
    id: string;
    asset_name: string;
    asset_code: string;
    scheduled_date: string;
    days_overdue: number;
  }>;
  calibration_due?: Array<{
    id: string;
    asset_name: string;
    asset_code: string;
    next_due_date: string;
    calibration_date: string | null;
  }>;
};

type ActionKind = 'diagnostic' | 'replacement' | 'pm';

type Props = {
  triageRows: TriageRow[];
  triageTotalItems: number;
  triageHeading: string;
  canMutate: boolean;
  readiness: DeptReadiness[];
  wip: WorkInProgress;
  primaryRole: string;
  departmentId: string | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function readinessMessage(score: number): string[] {
  if (score < 60) {
    return [
      'Critical — schedule emergency PM for all overdue assets.',
      'Escalate unresolved corrective work orders in this department.',
      'Review high-risk assets and assign immediate technicians.',
    ];
  }
  if (score <= 80) {
    return [
      'Review and reschedule missed PM tasks.',
      'Close aging work orders that are blocking readiness recovery.',
      'Prioritize assets with medium/high RPN for follow-up.',
    ];
  }
  return [
    'Readiness good — maintain schedule.',
    'Continue proactive PM execution and calibration cadence.',
    'Monitor flagged assets to prevent readiness drift.',
  ];
}

function actionLabel(kind: ActionKind): string {
  if (kind === 'diagnostic') return 'Schedule Diagnostic';
  if (kind === 'replacement') return 'Request Replacement';
  return 'Schedule PM';
}

export default function CommandCenterInteractive({
  triageRows,
  triageTotalItems,
  triageHeading,
  canMutate,
  readiness,
  wip,
  primaryRole,
  departmentId,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [expandedQueueId, setExpandedQueueId] = useState<string | null>(null);
  const [detailByQueueId, setDetailByQueueId] = useState<Record<string, TriageDetail>>({});
  const [detailLoadingQueueId, setDetailLoadingQueueId] = useState<string | null>(null);
  const [acknowledgedRows, setAcknowledgedRows] = useState<Set<string>>(new Set());

  const [expandedDepartment, setExpandedDepartment] = useState<string | null>(null);
  const [departmentDetails, setDepartmentDetails] = useState<Record<string, DepartmentDetail>>({});
  const [departmentLoading, setDepartmentLoading] = useState<string | null>(null);

  const [wipPanelOpen, setWipPanelOpen] = useState(false);
  const [wipKind, setWipKind] = useState<WipKind>('work_orders');
  const [wipDetail, setWipDetail] = useState<WipDetail | null>(null);
  const [wipLoading, setWipLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<ActionKind>('diagnostic');
  const [modalQueueId, setModalQueueId] = useState<string | null>(null);
  const [issueDescription, setIssueDescription] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [disposalMethod, setDisposalMethod] = useState<'auction' | 'donation' | 'recycling' | 'destruction' | 'return_to_vendor' | 'other'>('other');
  const [scheduledDate, setScheduledDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const rowByQueueId = useMemo(() => {
    const map = new Map<string, TriageRow>();
    for (const row of triageRows) map.set(row.id, row);
    return map;
  }, [triageRows]);

  const getRecommendedActions = (row: TriageRow, detail?: TriageDetail): ActionKind[] => {
    const actions: ActionKind[] = [];
    const flagType = detail?.flag_type ?? row.flag_type ?? '';
    const pmc = detail?.pmc_percentage ?? null;
    const priority = detail?.priority_score ?? row.score;
    if (['recurring_failure', 'urgent_maintenance', 'monitor_closely', 'low_availability'].includes(flagType) || priority >= 55) actions.push('diagnostic');
    if (flagType === 'replacement_candidate' || priority >= 70) actions.push('replacement');
    if (['overdue_pm', 'prioritize_pm'].includes(flagType) || (pmc != null && pmc < 80)) actions.push('pm');
    if (actions.length === 0) actions.push('diagnostic');
    return Array.from(new Set(actions));
  };

  const fetchTriageDetail = async (queueId: string, assetId: string) => {
    setDetailLoadingQueueId(queueId);
    const result = await getTriageAssetDetail(assetId, queueId);
    setDetailLoadingQueueId(null);
    if (!result.success || !result.data) {
      toast('error', result.error ?? 'Failed to load triage detail');
      return;
    }
    setDetailByQueueId((prev) => ({ ...prev, [queueId]: result.data as TriageDetail }));
  };

  const toggleTriageRow = async (queueId: string, assetId: string) => {
    if (expandedQueueId === queueId) {
      setExpandedQueueId(null);
      return;
    }
    setExpandedQueueId(queueId);
    if (!detailByQueueId[queueId]) await fetchTriageDetail(queueId, assetId);
  };

  const openActionModal = (queueId: string, action: ActionKind) => {
    const row = rowByQueueId.get(queueId);
    const detail = detailByQueueId[queueId];
    if (!row) return;
    setModalAction(action);
    setModalQueueId(queueId);
    setIssueDescription(detail?.recommendation ?? generateTriageReason({
      flagType: row.flag_type,
      rationale: row.rationale,
      fallbackRecommendation: row.recommendation,
    }));
    setUrgency('high');
    setDisposalMethod('other');
    setScheduledDate(new Date().toISOString().slice(0, 10));
    setModalOpen(true);
  };

  const closeModal = () => {
    if (isPending) return;
    setModalOpen(false);
    setModalQueueId(null);
  };

  const submitModal = () => {
    const queueId = modalQueueId;
    if (!queueId) return;
    const row = rowByQueueId.get(queueId);
    const detail = detailByQueueId[queueId];
    if (!row) return;

    startTransition(async () => {
      let result: { success: boolean; error?: string } = { success: false, error: 'Unknown action' };
      if (modalAction === 'diagnostic') {
        const deptId = detail?.department_id ?? row.department_id;
        if (!deptId) {
          toast('error', 'Department is required for maintenance request');
          return;
        }
        result = await createDiagnosticMaintenanceRequest({
          asset_id: row.asset_id,
          department_id: deptId,
          issue_description: issueDescription.trim() || row.recommendation,
          urgency,
        });
      } else if (modalAction === 'replacement') {
        result = await createReplacementDisposalRequest({
          asset_id: row.asset_id,
          issue_description: issueDescription.trim() || row.recommendation,
          disposal_method_proposed: disposalMethod,
        });
      } else {
        if (!scheduledDate) {
          toast('error', 'Scheduled date is required');
          return;
        }
        result = await createCommandPMSchedule({
          asset_id: row.asset_id,
          issue_description: issueDescription.trim() || row.recommendation,
          scheduled_date: scheduledDate,
        });
      }

      if (!result.success) {
        toast('error', result.error ?? 'Action failed');
        return;
      }

      toast('success', `${actionLabel(modalAction)} created successfully`);
      closeModal();
      router.refresh();
    });
  };

  const toggleDepartment = async (deptId: string) => {
    if (expandedDepartment === deptId) {
      setExpandedDepartment(null);
      return;
    }
    setExpandedDepartment(deptId);
    if (departmentDetails[deptId]) return;
    setDepartmentLoading(deptId);
    const result = await getDepartmentReadinessDetail(deptId);
    setDepartmentLoading(null);
    if (!result.success || !result.data) {
      toast('error', result.error ?? 'Failed to load department details');
      return;
    }
    setDepartmentDetails((prev) => ({ ...prev, [deptId]: result.data as DepartmentDetail }));
  };

  const openWipPanel = async (kind: WipKind) => {
    setWipKind(kind);
    setWipPanelOpen(true);
    setWipLoading(true);
    const result = await getWorkInProgressDetail(kind);
    setWipLoading(false);
    if (!result.success || !result.data) {
      toast('error', result.error ?? 'Failed to load detail');
      return;
    }
    setWipDetail(result.data);
  };

  const activeModalRow = modalQueueId ? rowByQueueId.get(modalQueueId) ?? null : null;
  const activeModalDetail = modalQueueId ? detailByQueueId[modalQueueId] : undefined;
  const wipViewAllHref = wipKind === 'work_orders' ? '/work-orders?status=open' : wipKind === 'overdue_pm' ? '/pm?status=overdue' : '/calibration?due_within=30';

  return (
    <>
      <section aria-label="Triage queue">
        <div className="panel-surface rounded-lg">
          <div className="border-b border-[var(--border-subtle)]/60 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]">
                <AlertTriangle className="h-5 w-5 text-rose-400" />
                {triageHeading}
              </h2>
              {triageTotalItems > 10 && <Link href="/command/triage" className="text-xs text-violet-300 hover:text-violet-200">View all →</Link>}
            </div>
          </div>
          <div className="px-6 py-4">
            {triageRows.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
                <p className="text-sm font-medium text-[var(--foreground)]">No urgent items right now</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">All systems within normal parameters</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-[980px] w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)]/60 text-left">
                        <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">Asset</th>
                        <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">Department</th>
                        <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">Reason</th>
                        <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">Score</th>
                        <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">Actions</th>
                        {canMutate && <th className="pb-2 font-medium text-[var(--text-muted)]">Ack</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]/60">
                      {triageRows.map((row) => {
                        const isExpanded = expandedQueueId === row.id;
                        const detail = detailByQueueId[row.id];
                        const isAcknowledged = acknowledgedRows.has(row.id);
                        const actions = getRecommendedActions(row, detail);
                        return (
                          <Fragment key={row.id}>
                            <tr
                              key={row.id}
                              className={`cursor-pointer transition ${isAcknowledged ? 'opacity-55' : 'hover:bg-[var(--surface-2)]/40'}`}
                              onClick={() => void toggleTriageRow(row.id, row.asset_id)}
                              aria-expanded={isExpanded}
                            >
                              <td className="sticky left-0 z-10 bg-[var(--background)] py-3 pr-4">
                                <p className="font-medium text-[var(--foreground)]">{row.asset_name}</p>
                                <p className="text-xs text-[var(--text-muted)]">{row.asset_code}</p>
                              </td>
                              <td className="py-3 pr-4 text-[var(--text-muted)]">{row.department_name}</td>
                              <td className="py-3 pr-4">{generateTriageReason({ flagType: row.flag_type, rationale: row.rationale, fallbackRecommendation: row.recommendation })}</td>
                              <td className="py-3 pr-4">
                                <Badge variant={row.score >= 75 ? 'error' : row.score >= 45 ? 'warning' : 'info'}>{row.score.toFixed(1)}</Badge>
                                {isAcknowledged && <Badge className="ml-2">Acknowledged</Badge>}
                              </td>
                              <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                                <div className="flex flex-wrap gap-2">
                                  {actions.map((action) => (
                                    <Button key={`${row.id}-${action}`} type="button" size="sm" variant="outline" onClick={() => openActionModal(row.id, action)}>
                                      {actionLabel(action)}
                                    </Button>
                                  ))}
                                </div>
                              </td>
                              {canMutate && (
                                <td className="py-3" onClick={(e) => e.stopPropagation()}>
                                  <AcknowledgeButton
                                    queueId={row.id}
                                    assetId={row.asset_id}
                                    hasActiveFlag={Boolean(row.flag_id)}
                                    label={`Acknowledge triage item for ${row.asset_name}`}
                                    disabled={isAcknowledged}
                                    onAcknowledged={() => setAcknowledgedRows((prev) => new Set(prev).add(row.id))}
                                  />
                                </td>
                              )}
                            </tr>
                            {isExpanded && (
                              <tr key={`${row.id}-detail`}>
                                <td colSpan={canMutate ? 6 : 5} className="bg-[var(--surface-2)]/30 px-4 py-4">
                                  {detailLoadingQueueId === row.id ? (
                                    <p className="text-sm text-[var(--text-muted)]">Loading triage detail…</p>
                                  ) : detail ? (
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                                        <div className="rounded-md border border-[var(--border-subtle)]/60 p-3"><p className="text-xs text-[var(--text-muted)]">Asset</p><p className="font-medium">{detail.asset_name}</p><p className="text-xs text-[var(--text-muted)]">{detail.asset_code}</p></div>
                                        <div className="rounded-md border border-[var(--border-subtle)]/60 p-3"><p className="text-xs text-[var(--text-muted)]">Department</p><p className="font-medium">{detail.department_name}</p><p className="text-xs text-[var(--text-muted)]">Age: {detail.age_years ?? '—'} years</p></div>
                                        <div className="rounded-md border border-[var(--border-subtle)]/60 p-3"><p className="text-xs text-[var(--text-muted)]">Last maintenance</p><p className="font-medium">{formatDate(detail.last_maintenance_date)}</p></div>
                                        <div className="rounded-md border border-[var(--border-subtle)]/60 p-3"><p className="text-xs text-[var(--text-muted)]">Flag type</p><p className="font-medium">{detail.flag_type ?? 'none'}</p></div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3 xl:grid-cols-6">
                                        <div className="rounded-md border border-[var(--border-subtle)]/60 p-3"><p className="text-xs text-[var(--text-muted)]">RPN</p><p className="font-semibold">{detail.rpn ?? '—'}</p></div>
                                        <div className="rounded-md border border-[var(--border-subtle)]/60 p-3"><p className="text-xs text-[var(--text-muted)]">PMC</p><p className="font-semibold">{detail.pmc_percentage != null ? `${detail.pmc_percentage.toFixed(1)}%` : '—'}</p></div>
                                        <div className="rounded-md border border-[var(--border-subtle)]/60 p-3"><p className="text-xs text-[var(--text-muted)]">Availability</p><p className="font-semibold">{detail.availability_percentage != null ? `${detail.availability_percentage.toFixed(1)}%` : '—'}</p></div>
                                        <div className="rounded-md border border-[var(--border-subtle)]/60 p-3"><p className="text-xs text-[var(--text-muted)]">MTBF</p><p className="font-semibold">{detail.mtbf_hours != null ? `${detail.mtbf_hours.toFixed(1)} h` : '—'}</p></div>
                                        <div className="rounded-md border border-[var(--border-subtle)]/60 p-3"><p className="text-xs text-[var(--text-muted)]">Priority score</p><p className="font-semibold">{detail.priority_score.toFixed(1)}</p></div>
                                        <div className="rounded-md border border-[var(--border-subtle)]/60 p-3"><p className="text-xs text-[var(--text-muted)]">Flag type</p><p className="font-semibold">{detail.flag_type ?? 'none'}</p></div>
                                      </div>

                                      <div className="rounded-md border border-[var(--border-subtle)]/60 bg-[var(--surface-2)]/40 p-3 text-sm">
                                        <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Explanation</p>
                                        <p className="mt-1 text-[var(--foreground)]">{generateTriageReason({ flagType: detail.flag_type, rationale: detail.rationale, fallbackRecommendation: detail.recommendation })}</p>
                                      </div>

                                      <div className="flex flex-wrap gap-2">
                                        {actions.map((action) => (
                                          <Button key={`detail-${row.id}-${action}`} type="button" size="sm" variant="outline" onClick={() => openActionModal(row.id, action)}>
                                            {actionLabel(action)}
                                          </Button>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-[var(--text-muted)]">No detail found.</p>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-right text-xs text-[var(--text-muted)]">
                  Showing top {triageRows.length} of {triageTotalItems} unique asset{triageTotalItems !== 1 ? 's' : ''}
                  {triageTotalItems > 10 && <> — <Link href="/command/triage" className="text-violet-300 hover:text-violet-200">View all</Link></>}
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Department readiness">
        <div className="panel-surface rounded-lg">
          <div className="border-b border-[var(--border-subtle)]/60 px-6 py-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Department readiness</h2>
          </div>
          <div className="px-6 py-4">
            {readiness.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--text-muted)]">No essential equipment data available</p>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {readiness.map((dept) => {
                    const isExpanded = expandedDepartment === dept.department_id;
                    const isFocusedDepartment = primaryRole === 'department_user' && departmentId === dept.department_id;
                    const textColor = dept.readiness_score >= 90 ? 'text-emerald-300' : dept.readiness_score >= 70 ? 'text-amber-300' : 'text-rose-300';
                    const cardClass = dept.readiness_score >= 90 ? 'border-emerald-500 bg-emerald-500/10' : dept.readiness_score >= 70 ? 'border-amber-500 bg-amber-500/10' : 'border-rose-500 bg-rose-500/10';
                    return (
                      <button
                        key={dept.department_id}
                        type="button"
                        className={`flex min-w-[160px] flex-col items-center rounded-lg border p-4 text-left transition hover:opacity-80 ${cardClass} ${isFocusedDepartment ? 'ring-2 ring-[var(--brand)] ring-offset-2 ring-offset-[var(--background)]' : ''}`}
                        onClick={() => void toggleDepartment(dept.department_id)}
                      >
                        <span className={`text-3xl font-bold ${textColor}`}>{dept.readiness_score}%</span>
                        <span className="mt-1 text-center text-xs font-medium text-[var(--foreground)]">{dept.department_name}</span>
                        <span className="mt-1 text-center text-[10px] text-[var(--text-muted)]">{dept.essential_functional}/{dept.essential_total} essential functional</span>
                        <span className="mt-2 text-[10px] text-violet-300">{isExpanded ? 'Hide details' : 'View details'}</span>
                      </button>
                    );
                  })}
                </div>

                {expandedDepartment && (
                  <div className="rounded-lg border border-[var(--border-subtle)]/60 p-4">
                    {departmentLoading === expandedDepartment ? (
                      <p className="text-sm text-[var(--text-muted)]">Loading department data…</p>
                    ) : (() => {
                      const detail = departmentDetails[expandedDepartment];
                      const dept = readiness.find((d) => d.department_id === expandedDepartment);
                      if (!detail || !dept) return <p className="text-sm text-[var(--text-muted)]">No detail available.</p>;
                      return (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="rounded-md border border-[var(--border-subtle)]/60 p-3 text-sm"><p className="text-xs text-[var(--text-muted)]">PM compliance</p><p className="font-semibold">{detail.pm_compliance_percentage != null ? `${detail.pm_compliance_percentage.toFixed(1)}%` : '—'}</p></div>
                            <div className="rounded-md border border-[var(--border-subtle)]/60 p-3 text-sm"><p className="text-xs text-[var(--text-muted)]">Open work orders</p><p className="font-semibold">{detail.open_work_orders}</p></div>
                            <div className="rounded-md border border-[var(--border-subtle)]/60 p-3 text-sm"><p className="text-xs text-[var(--text-muted)]">Tracked assets</p><p className="font-semibold">{detail.assets.length}</p></div>
                          </div>
                          <div>
                            <p className="mb-2 text-xs uppercase tracking-wide text-[var(--text-muted)]">Recommended actions</p>
                            <ul className="space-y-1 text-sm text-[var(--foreground)]">{readinessMessage(dept.readiness_score).map((message) => <li key={message}>• {message}</li>)}</ul>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-sm">
                              <thead>
                                <tr className="border-b border-[var(--border-subtle)]/60 text-left">
                                  <th className="pb-2 pr-4 text-[var(--text-muted)]">Asset</th>
                                  <th className="pb-2 pr-4 text-[var(--text-muted)]">Health status</th>
                                  <th className="pb-2 pr-4 text-[var(--text-muted)]">Health score</th>
                                  <th className="pb-2 text-[var(--text-muted)]">RPN</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border-subtle)]/60">
                                {detail.assets.map((asset) => (
                                  <tr key={asset.asset_id}>
                                    <td className="py-2 pr-4"><p className="font-medium text-[var(--foreground)]">{asset.asset_name}</p><p className="text-xs text-[var(--text-muted)]">{asset.asset_code}</p></td>
                                    <td className="py-2 pr-4">{asset.health_status}</td>
                                    <td className="py-2 pr-4">{asset.health_score ?? '—'}</td>
                                    <td className="py-2">{asset.rpn ?? '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
                <p className="text-xs text-[var(--text-muted)]">{readiness.length} departments monitored</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Work in progress">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-[var(--text-muted)]">Work in progress</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <button type="button" onClick={() => void openWipPanel('work_orders')} className="panel-surface rounded-lg p-5 text-left transition hover:border-[var(--brand)]/50">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Open Work Orders</p>
                <p className="mt-1 text-3xl font-bold text-[var(--foreground)]">{wip.open_work_orders}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {wip.in_progress > 0 && <span className="text-xs text-[var(--text-muted)]">{wip.in_progress} in progress</span>}
                  {wip.assigned > 0 && <span className="text-xs text-[var(--text-muted)]">{wip.assigned} assigned</span>}
                  {wip.on_hold > 0 && <span className="text-xs text-amber-400">{wip.on_hold} on hold</span>}
                </div>
              </div>
              <div className="rounded-lg bg-blue-500/15 p-3 text-blue-300"><ClipboardList className="h-6 w-6" /></div>
            </div>
          </button>
          <button type="button" onClick={() => void openWipPanel('overdue_pm')} className="panel-surface rounded-lg p-5 text-left transition hover:border-[var(--brand)]/50">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Overdue PM</p>
                <p className="mt-1 text-3xl font-bold text-[var(--foreground)]">{wip.overdue_pm}</p>
                {wip.overdue_pm_gt30 > 0 && <p className="mt-2 text-xs text-rose-400">{wip.overdue_pm_gt30} overdue &gt;30 days</p>}
              </div>
              <div className="rounded-lg bg-amber-500/15 p-3 text-amber-300"><CalendarCheck className="h-6 w-6" /></div>
            </div>
          </button>
          <button type="button" onClick={() => void openWipPanel('calibration_due')} className="panel-surface rounded-lg p-5 text-left transition hover:border-[var(--brand)]/50">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Calibration Due (30d)</p>
                <p className="mt-1 text-3xl font-bold text-[var(--foreground)]">{wip.calibration_due_30d}</p>
              </div>
              <div className="rounded-lg bg-violet-500/15 p-3 text-violet-300"><Wrench className="h-6 w-6" /></div>
            </div>
          </button>
        </div>
      </section>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={activeModalRow ? `${actionLabel(modalAction)} — ${activeModalRow.asset_name}` : actionLabel(modalAction)}
        size="lg"
        footer={(
          <>
            <Button variant="ghost" onClick={closeModal} disabled={isPending}>Cancel</Button>
            <Button variant="primary" loading={isPending} onClick={submitModal}>{actionLabel(modalAction)}</Button>
          </>
        )}
      >
        {activeModalRow && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input label="Asset ID" value={activeModalRow.asset_id} readOnly />
              <Input label="Department ID" value={activeModalDetail?.department_id ?? activeModalRow.department_id ?? '—'} readOnly />
            </div>
            <Textarea label="Issue description" value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} rows={4} />
            {modalAction === 'diagnostic' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Urgency</label>
                <select value={urgency} onChange={(e) => setUrgency(e.target.value as 'low' | 'medium' | 'high' | 'critical')} className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--foreground)]">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                </select>
              </div>
            )}
            {modalAction === 'replacement' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Disposal method (proposed)</label>
                <select value={disposalMethod} onChange={(e) => setDisposalMethod(e.target.value as 'auction' | 'donation' | 'recycling' | 'destruction' | 'return_to_vendor' | 'other')} className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--foreground)]">
                  <option value="other">Other</option><option value="auction">Auction</option><option value="donation">Donation</option><option value="recycling">Recycling</option><option value="destruction">Destruction</option><option value="return_to_vendor">Return to vendor</option>
                </select>
              </div>
            )}
            {modalAction === 'pm' && <Input label="Scheduled date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />}
          </div>
        )}
      </Modal>

      {wipPanelOpen && (
        <div className="fixed inset-0 z-40 flex">
          <button type="button" className="flex-1 bg-black/40" aria-label="Close panel backdrop" onClick={() => setWipPanelOpen(false)} />
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-[var(--border-subtle)] bg-[var(--background)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">{wipKind === 'work_orders' ? 'Open work orders' : wipKind === 'overdue_pm' ? 'Overdue PM items' : 'Calibration due items'}</h3>
              <Button variant="ghost" size="icon" onClick={() => setWipPanelOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            {wipLoading ? (
              <p className="text-sm text-[var(--text-muted)]">Loading…</p>
            ) : (
              <div className="space-y-3">
                {wipDetail?.kind === 'work_orders' && (wipDetail.work_orders ?? []).map((item) => (
                  <div key={item.id} className="rounded-lg border border-[var(--border-subtle)]/60 p-3 text-sm">
                    <p className="font-medium">{item.asset_name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{item.work_order_number}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--text-muted)]"><span>Status: {item.status}</span><span>Assigned: {item.assigned_to_name ?? 'Unassigned'}</span><span>Created: {formatDate(item.created_at)}</span></div>
                  </div>
                ))}
                {wipDetail?.kind === 'overdue_pm' && (wipDetail.overdue_pm ?? []).map((item) => (
                  <div key={item.id} className="rounded-lg border border-[var(--border-subtle)]/60 p-3 text-sm">
                    <p className="font-medium">{item.asset_name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{item.asset_code}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--text-muted)]"><span>Scheduled: {formatDate(item.scheduled_date)}</span><span>Overdue: {item.days_overdue} days</span></div>
                  </div>
                ))}
                {wipDetail?.kind === 'calibration_due' && (wipDetail.calibration_due ?? []).map((item) => (
                  <div key={item.id} className="rounded-lg border border-[var(--border-subtle)]/60 p-3 text-sm">
                    <p className="font-medium">{item.asset_name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{item.asset_code}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--text-muted)]"><span>Due: {formatDate(item.next_due_date)}</span><span>Last calibrated: {formatDate(item.calibration_date)}</span></div>
                  </div>
                ))}
                <div className="pt-2"><Link href={wipViewAllHref} className="text-sm font-medium text-violet-300 hover:text-violet-200">View all →</Link></div>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
