'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  Activity, ArrowUpDown, CalendarCheck, Pencil, ShieldAlert,
  Wrench, CalendarClock, AlertTriangle,
} from 'lucide-react';
import {
  PageHeader, Button, Card, CardHeader, CardTitle, CardContent,
  Tabs, Table, Spinner,
} from '@/components/ui';
import { ConditionBadge, PMStatusBadge, RiskBadge } from '@/components/ui/StatusBadge';
import { getEquipmentById } from '@/services/equipment.service';
import { getMaintenanceEvents, getOpenRequestsForAsset, getOpenWorkOrdersForAsset, getLastCompletedWorkOrderForAsset } from '@/services/maintenance.service';
import { getPMSchedules } from '@/services/pm.service';
import { getCalibrationRecords } from '@/services/calibration.service';
import { getReliabilityMetrics, getRiskScores, getPMComplianceMetrics, getReplacementPriorities } from '@/services/analytics.service';
import { explainRiskScore, type RiskExplanation } from '@/services/risk-assessment.service';
import { ROUTES } from '@/constants';
import { AskAiButton } from '@/components/assistant/AskAiButton';
import {
  workOrderDetail,
  maintenanceRequestDetail,
  createMaintenanceRequestFromAsset,
  replacementEvidence,
} from '@/app/(dashboard)/command/_lib/command-center-routes';
import { formatEquipmentCondition } from '@/utils/equipment/condition-labels';
import {
  getMaintenanceState,
  formatMaintenanceState,
  getMaintenanceStateBadgeClass,
} from '@/utils/equipment/maintenance-state';
import { useRole } from '@/hooks/useRole';
import type {
  EquipmentCondition, PMScheduleStatus, CalibrationResult, RiskLevel,
} from '@/types/database';

interface EquipmentDetail {
  id: string;
  asset_code: string;
  serial_number: string | null;
  name: string;
  condition: EquipmentCondition;
  status: string;
  installation_date: string | null;
  warranty_expiry: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  source: string | null;
  notes: string | null;
  departments: { id: string; name: string } | null;
  equipment_categories: { id: string; name: string; criticality_level: string | null } | null;
  manufacturers: { id: string; name: string; country: string | null } | null;
  equipment_models: { id: string; name: string } | null;
  [key: string]: unknown;
}

interface MaintenanceEventRow {
  id: string;
  event_type: string;
  action_taken: string | null;
  repair_duration_hours: number | null;
  service_cost: number | null;
  completion_date: string | null;
  failure_codes: { code: string; description: string } | null;
  [key: string]: unknown;
}

interface PMScheduleRow {
  id: string;
  scheduled_date: string;
  status: PMScheduleStatus;
  profiles: { full_name: string } | null;
  [key: string]: unknown;
}

interface CalibrationRow {
  id: string;
  calibration_date: string;
  result: CalibrationResult;
  next_due_date: string | null;
  calibrated_by: string | null;
  calibration_types: { name: string } | null;
  [key: string]: unknown;
}

interface ReliabilityRow {
  mttr_hours: number | null;
  mtbf_hours: number | null;
  availability_ratio: number | null;
  failure_count: number;
  repair_count?: number | null;
  total_downtime_hours?: number | null;
  total_operational_hours?: number | null;
  [key: string]: unknown;
}

interface RiskRow {
  severity: number;
  occurrence: number;
  detectability: number;
  rpn: number;
  risk_level: RiskLevel;
  assessed_at: string;
  computed_at?: string | null;
  assignment_method?: 'computed' | 'manual_override' | 'seeded_demo';
  override_reason?: string | null;
  explanation?: RiskExplanation | null;
  [key: string]: unknown;
}

interface PMComplianceRow {
  pmc_percentage: number;
  scheduled_count: number;
  completed_count: number;
  [key: string]: unknown;
}

interface ReplacementRow {
  replacement_priority_index: number;
  rank: number;
  justification: string | null;
  [key: string]: unknown;
}

interface OpenRecord {
  id: string;
  status: string;
  urgency?: string;
  assigned_to?: string | null;
  reported_condition?: string | null;
  reported_condition_source?: string | null;
}

interface LastCompletedWO {
  id: string;
  completion_outcome?: string | null;
  final_equipment_condition?: string | null;
  completed_at?: string | null;
}

function formatDate(val: string | null): string {
  if (!val) return '—';
  return new Date(val).toLocaleDateString();
}

function formatCurrency(val: number | null): string {
  if (val == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ETB' }).format(val);
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-2">
      <dt className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="text-sm text-gray-900 dark:text-white">{value || '—'}</dd>
    </div>
  );
}

function HealthCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="panel-surface rounded-lg p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-md bg-[var(--surface-2)] p-2 text-[var(--brand)]">{icon}</span>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-semibold text-[var(--foreground)]">{value}</span>
    </div>
  );
}

function MetricExplain({ text }: { text: string }) {
  return <p className="text-xs leading-5 text-[var(--text-muted)] italic">{text}</p>;
}

function RiskReasonLine({ label, score, reason }: { label: string; score: number; reason: string }) {
  return (
    <div className="space-y-1 rounded-md bg-[var(--surface-2)]/60 p-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-[var(--text-muted)]">{label}</span>
        <span className="font-semibold text-[var(--foreground)]">{score}</span>
      </div>
      <p className="text-xs leading-5 text-[var(--text-muted)]">{reason}</p>
    </div>
  );
}

function EmptyMetric({ message }: { message: string }) {
  return <p className="text-sm text-[var(--text-muted)]">{message}</p>;
}

export default function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { canCreateRequests } = useRole();
  const [equipment, setEquipment] = useState<EquipmentDetail | null>(null);
  const [events, setEvents] = useState<MaintenanceEventRow[]>([]);
  const [schedules, setSchedules] = useState<PMScheduleRow[]>([]);
  const [calibrations, setCalibrations] = useState<CalibrationRow[]>([]);
  const [reliability, setReliability] = useState<ReliabilityRow | null>(null);
  const [risk, setRisk] = useState<RiskRow | null>(null);
  const [pmCompliance, setPmCompliance] = useState<PMComplianceRow | null>(null);
  const [replacement, setReplacement] = useState<ReplacementRow | null>(null);
  const [openRequest, setOpenRequest] = useState<OpenRecord | null>(null);
  const [openWorkOrder, setOpenWorkOrder] = useState<OpenRecord | null>(null);
  const [lastCompletedWO, setLastCompletedWO] = useState<LastCompletedWO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error: fetchError } = await getEquipmentById(id);
      if (fetchError || !data) {
        setError(fetchError?.message ?? 'Equipment not found');
        setLoading(false);
        return;
      }
      setEquipment(data as unknown as EquipmentDetail);

      const [eventsRes, pmRes, calRes, relRes, riskRes, pmcRes, repRes, reqRes, woRes, lastWORes] = await Promise.all([
        getMaintenanceEvents(id),
        getPMSchedules({ asset_id: id }),
        getCalibrationRecords({ asset_id: id }),
        getReliabilityMetrics({ asset_id: id }),
        getRiskScores({ asset_id: id }),
        getPMComplianceMetrics({ asset_id: id }),
        getReplacementPriorities({ asset_id: id }),
        getOpenRequestsForAsset(id),
        getOpenWorkOrdersForAsset(id),
        getLastCompletedWorkOrderForAsset(id),
      ]);

      setEvents((eventsRes.data as unknown as MaintenanceEventRow[]) ?? []);
      setSchedules((pmRes.data as unknown as PMScheduleRow[]) ?? []);
      setCalibrations((calRes.data as unknown as CalibrationRow[]) ?? []);

      const relData = relRes.data as unknown as ReliabilityRow[] | null;
      if (relData?.length) {
        const best = relData.find(r => r.mtbf_hours != null && r.availability_ratio != null)
          ?? relData.find(r => r.availability_ratio != null)
          ?? relData[0];
        setReliability(best);
      }

      const riskData = riskRes.data as unknown as RiskRow[] | null;
      if (riskData?.length) setRisk(riskData[0]);

      const pmcData = pmcRes.data as unknown as PMComplianceRow[] | null;
      if (pmcData?.length) {
        setPmCompliance(pmcData[0]);
      } else {
        const equip = data as unknown as EquipmentDetail;
        const deptId = equip.departments?.id;
        if (deptId) {
          const { data: deptRows } = await getPMComplianceMetrics({ department_id: deptId });
          const deptPmc = (deptRows ?? []) as unknown as PMComplianceRow[];
          if (deptPmc.length) setPmCompliance(deptPmc[0]);
        }
      }

      const repData = repRes.data as unknown as ReplacementRow[] | null;
      if (repData?.length) setReplacement(repData[0]);

      const reqData = reqRes.data as unknown as OpenRecord[] | null;
      if (reqData?.length) setOpenRequest(reqData[0]);

      const woData = woRes.data as unknown as OpenRecord[] | null;
      if (woData?.length) setOpenWorkOrder(woData[0]);

      if (lastWORes.data) setLastCompletedWO(lastWORes.data as unknown as LastCompletedWO);

      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error || !equipment) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg text-red-600">{error ?? 'Equipment not found'}</p>
        <Link href={ROUTES.EQUIPMENT} className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          Back to Equipment
        </Link>
      </div>
    );
  }

  // Convert to shape expected by utility — urgency may be absent on WO records
  const openReqForState = openRequest ? { id: openRequest.id, status: openRequest.status, urgency: openRequest.urgency ?? 'medium' } : undefined;
  const openWoForState = openWorkOrder ? { id: openWorkOrder.id, status: openWorkOrder.status, assigned_to: openWorkOrder.assigned_to ?? null } : undefined;

  const maintState = getMaintenanceState(equipment.condition, openReqForState, openWoForState);
  const riskReasons = explainRiskScore(risk);

  // Determine primary action for page header
  function getPrimaryAction(): React.ReactNode {
    if (!equipment) return null;
    if (openWorkOrder) {
      const woStatus = openWorkOrder.status;
      const label = woStatus === 'on_hold' ? 'Resolve Blocker' : woStatus === 'in_progress' ? 'View Progress' : 'Open Work Order';
      const action = woStatus === 'on_hold' ? 'resolve-blocker' : undefined;
      return (
        <Link href={workOrderDetail(openWorkOrder.id, action)}>
          <Button variant={woStatus === 'on_hold' ? 'destructive' : 'outline'} size="sm">{label}</Button>
        </Link>
      );
    }
    if (openRequest) {
      return (
        <Link href={maintenanceRequestDetail(openRequest.id)}>
          <Button variant="outline" size="sm">Open Request</Button>
        </Link>
      );
    }
    if ((equipment.condition === 'needs_repair' || equipment.condition === 'non_functional') && canCreateRequests) {
      const urgency = equipment.condition === 'non_functional' ? 'high' : 'medium';
      const desc = `Equipment detail: ${equipment.name} is ${formatEquipmentCondition(equipment.condition)} with no open corrective request.`;
      return (
        <Link href={createMaintenanceRequestFromAsset(id, {
          departmentId: equipment.departments?.id,
          urgency,
          description: desc,
          type: 'corrective',
        }).replace('source=command-center', 'source=equipment') + `&reportedCondition=${equipment.condition}`}>
          <Button size="sm">Create Request</Button>
        </Link>
      );
    }
    if (risk && (risk.risk_level === 'high' || risk.risk_level === 'critical')) {
      return (
        <Link href={replacementEvidence(id)}>
          <Button variant="outline" size="sm">View Evidence</Button>
        </Link>
      );
    }
    return null;
  }

  // Last calibration / next due
  const lastCalibration = calibrations[0] ?? null;
  const calNextDue = lastCalibration?.next_due_date ?? null;
  const calOverdue = calNextDue ? new Date(calNextDue) < new Date() : false;

  // Next PM schedule
  const nextPM = schedules.find(s => s.status === 'scheduled') ?? null;
  const pmOverdue = nextPM ? new Date(nextPM.scheduled_date) < new Date() : false;

  const hasRisk = Boolean(risk && risk.rpn != null && risk.risk_level && risk.severity != null);
  const hasPmCompliance = Boolean(pmCompliance && pmCompliance.scheduled_count > 0 && pmCompliance.pmc_percentage != null);
  const hasReplacement = Boolean(replacement && replacement.rank != null && replacement.replacement_priority_index != null);

  // --- Reliability display helpers ---
  const failureCount = reliability?.failure_count ?? 0;
  const repairCount = reliability?.repair_count ?? 0;

  function renderMTBF(): React.ReactNode {
    if (!reliability || reliability.mtbf_hours == null) {
      return (
        <>
          <MetricLine label="MTBF" value="No recorded failures" />
          <MetricExplain text={`Formula: Operational time ÷ failure count. ${failureCount === 0 ? 'No failure events recorded.' : `Failure count: ${failureCount}.`}`} />
        </>
      );
    }
    return (
      <>
        <MetricLine label="MTBF" value={`${reliability.mtbf_hours.toFixed(1)} h`} />
        <MetricExplain text={`Operational time ÷ ${failureCount} failure${failureCount !== 1 ? 's' : ''}. ${reliability.total_operational_hours != null ? `Total operational: ${(reliability.total_operational_hours as number).toFixed(0)} h.` : ''}`} />
      </>
    );
  }

  function renderMTTR(): React.ReactNode {
    if (!reliability || reliability.mttr_hours == null) {
      return (
        <>
          <MetricLine label="MTTR" value="No completed corrective repairs" />
          <MetricExplain text={`Formula: Total repair time ÷ repair count. ${repairCount === 0 ? 'No repair events recorded.' : `Repair count: ${repairCount}.`}`} />
        </>
      );
    }
    return (
      <>
        <MetricLine label="MTTR" value={`${reliability.mttr_hours.toFixed(1)} h`} />
        <MetricExplain text={`Total repair time ÷ ${repairCount} repair${repairCount !== 1 ? 's' : ''}.`} />
      </>
    );
  }

  function renderAvailability(): React.ReactNode {
    if (!reliability) {
      return (
        <>
          <MetricLine label="Availability" value="Insufficient data" />
          <MetricExplain text="Computed as MTBF ÷ (MTBF + MTTR). Requires at least one failure event." />
        </>
      );
    }
    if (reliability.availability_ratio != null) {
      return (
        <>
          <MetricLine label="Availability" value={`${(reliability.availability_ratio * 100).toFixed(1)}%`} />
          <MetricExplain text={`Formula: MTBF ÷ (MTBF + MTTR). ${reliability.total_downtime_hours != null ? `Total downtime: ${(reliability.total_downtime_hours as number).toFixed(1)} h.` : ''}`} />
        </>
      );
    }
    if (failureCount === 0) {
      return (
        <>
          <MetricLine label="Availability" value="100% (no failures)" />
          <MetricExplain text="No failure events recorded in the observation period. Cannot compute MTBF/MTTR basis." />
        </>
      );
    }
    return (
      <>
        <MetricLine label="Availability" value="Insufficient downtime data" />
        <MetricExplain text={`${failureCount} failure event${failureCount !== 1 ? 's' : ''} recorded but downtime hours not captured. Complete work orders to compute availability.`} />
      </>
    );
  }

  const overviewContent = (
    <Card>
      <CardHeader>
        <CardTitle>Equipment Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
          <DetailRow label="Asset Code" value={equipment.asset_code} />
          <DetailRow label="Serial Number" value={equipment.serial_number} />
          <DetailRow label="Name" value={equipment.name} />
          <DetailRow label="Department" value={equipment.departments?.name} />
          <DetailRow label="Category" value={equipment.equipment_categories?.name} />
          <DetailRow label="Manufacturer" value={equipment.manufacturers?.name} />
          <DetailRow label="Model" value={equipment.equipment_models?.name} />
          <DetailRow
            label="Condition"
            value={<ConditionBadge condition={equipment.condition} />}
          />
          <DetailRow label="Installation Date" value={formatDate(equipment.installation_date)} />
          <DetailRow label="Warranty Expiry" value={formatDate(equipment.warranty_expiry)} />
          <DetailRow label="Purchase Date" value={formatDate(equipment.purchase_date)} />
          <DetailRow label="Purchase Cost" value={formatCurrency(equipment.purchase_cost)} />
          <DetailRow label="Source" value={equipment.source} />
          <div className="sm:col-span-2">
            <DetailRow label="Notes" value={equipment.notes} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const maintenanceColumns = [
    {
      key: 'completion_date',
      header: 'Date',
      sortable: true,
      render: (row: MaintenanceEventRow) => formatDate(row.completion_date),
    },
    {
      key: 'event_type',
      header: 'Type',
      render: (row: MaintenanceEventRow) =>
        row.event_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    },
    { key: 'action_taken', header: 'Action Taken' },
    {
      key: 'repair_duration_hours',
      header: 'Duration (hrs)',
      render: (row: MaintenanceEventRow) =>
        row.repair_duration_hours != null ? `${row.repair_duration_hours}h` : '—',
    },
    {
      key: 'failure_code',
      header: 'Failure Code',
      render: (row: MaintenanceEventRow) => row.failure_codes?.code ?? '—',
    },
    {
      key: 'service_cost',
      header: 'Cost',
      render: (row: MaintenanceEventRow) => formatCurrency(row.service_cost),
    },
  ];

  const pmColumns = [
    {
      key: 'scheduled_date',
      header: 'Scheduled Date',
      sortable: true,
      render: (row: PMScheduleRow) => formatDate(row.scheduled_date),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: PMScheduleRow) => <PMStatusBadge status={row.status} />,
    },
    {
      key: 'completed_by',
      header: 'Assigned To',
      render: (row: PMScheduleRow) => row.profiles?.full_name ?? '—',
    },
  ];

  const calibrationColumns = [
    {
      key: 'calibration_date',
      header: 'Date',
      sortable: true,
      render: (row: CalibrationRow) => formatDate(row.calibration_date),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row: CalibrationRow) => row.calibration_types?.name ?? '—',
    },
    {
      key: 'result',
      header: 'Result',
      render: (row: CalibrationRow) =>
        row.result.replace(/\b\w/g, (c) => c.toUpperCase()),
    },
    {
      key: 'next_due_date',
      header: 'Next Due',
      render: (row: CalibrationRow) => formatDate(row.next_due_date),
    },
    { key: 'calibrated_by', header: 'Calibrated By' },
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', content: overviewContent },
    { id: 'maintenance', label: 'Maintenance History', count: events.length, content: <Table columns={maintenanceColumns} data={events} emptyMessage="No maintenance events recorded for this equipment." /> },
    { id: 'pm', label: 'PM Records', count: schedules.length, content: <Table columns={pmColumns} data={schedules} emptyMessage="No PM schedules found for this equipment." /> },
    { id: 'calibration', label: 'Calibration', count: calibrations.length, content: <Table columns={calibrationColumns} data={calibrations} emptyMessage="No calibration records found for this equipment." /> },
  ];

  return (
    <div>
      <PageHeader
        title={equipment.name}
        breadcrumbs={[
          { label: 'Equipment', href: ROUTES.EQUIPMENT },
          { label: equipment.asset_code },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {getPrimaryAction()}
            <AskAiButton
              moduleLabel="Equipment"
              label="Ask AI about this equipment"
              seedPrompt="Summarize this equipment status, maintenance history, and safe first-line actions."
              contextRefs={{ equipmentId: id }}
            />
            <Link href={`${ROUTES.EQUIPMENT}/${id}/edit`}>
              <Button variant="outline">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </Link>
          </div>
        }
      />

      {/* Metric cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

        {/* 1. Maintenance Status */}
        <HealthCard title="Maintenance Status" icon={<Wrench className="h-4 w-4" />}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)]">Condition</span>
            <ConditionBadge condition={equipment.condition} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)]">State</span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getMaintenanceStateBadgeClass(maintState)}`}>
              {formatMaintenanceState(maintState)}
            </span>
          </div>
          {openWorkOrder && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-muted)]">Work Order</span>
              <a href={workOrderDetail(openWorkOrder.id)} className="text-xs text-[var(--brand)] hover:underline">
                View WO →
              </a>
            </div>
          )}
          {openRequest && !openWorkOrder && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-muted)]">Request</span>
              <a href={maintenanceRequestDetail(openRequest.id)} className="text-xs text-[var(--brand)] hover:underline">
                View request →
              </a>
            </div>
          )}
          {openRequest?.reported_condition && (
            <div className="rounded-md bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-muted)]">
              <span className="font-medium text-[var(--foreground)]">Reported condition: </span>
              {openRequest.reported_condition === 'functional_issue'
                ? 'Functional (issue observed)'
                : openRequest.reported_condition === 'needs_repair'
                ? 'Needs repair'
                : 'Non-functional'}
              {openRequest.reported_condition_source && (
                <span className="ml-1 text-[var(--text-muted)]">· Source: {openRequest.reported_condition_source}</span>
              )}
            </div>
          )}
          {!openRequest && !openWorkOrder && (equipment.condition === 'needs_repair' || equipment.condition === 'non_functional') && canCreateRequests && (
            <a
              href={createMaintenanceRequestFromAsset(id, {
                departmentId: equipment.departments?.id,
                urgency: equipment.condition === 'non_functional' ? 'high' : 'medium',
                type: 'corrective',
              }).replace('source=command-center', 'source=equipment') + `&reportedCondition=${equipment.condition}`}
              className="mt-1 block rounded-md bg-[var(--brand)]/10 px-3 py-2 text-xs font-medium text-[var(--brand)] hover:bg-[var(--brand)]/20 text-center"
            >
              + Create maintenance request
            </a>
          )}
          {lastCompletedWO?.completion_outcome && (
            <div className="rounded-md border border-[var(--surface-3)] bg-[var(--surface-2)] px-3 py-2 text-xs">
              <p className="font-medium text-[var(--text-muted)]">Last completion</p>
              <p className="text-[var(--foreground)]">
                {lastCompletedWO.completion_outcome.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                {lastCompletedWO.final_equipment_condition && (
                  <span className="ml-1 text-[var(--text-muted)]">
                    → {lastCompletedWO.final_equipment_condition.replace(/_/g, ' ')}
                  </span>
                )}
              </p>
              {lastCompletedWO.completed_at && (
                <p className="text-[var(--text-muted)]">{formatDate(lastCompletedWO.completed_at)}</p>
              )}
            </div>
          )}
          {events.length > 0 && (
            <MetricLine label="Last maintenance event" value={formatDate(events[0].completion_date)} />
          )}
        </HealthCard>

        {/* 2. Reliability */}
        <HealthCard title="Reliability" icon={<Activity className="h-4 w-4" />}>
          {renderMTBF()}
          {renderMTTR()}
          {renderAvailability()}
          {!reliability && (
            <MetricExplain text="Complete at least one corrective work order with repair duration to start computing reliability metrics." />
          )}
        </HealthCard>

        {/* 3. Risk */}
        <HealthCard title="Risk (FMEA)" icon={<ShieldAlert className="h-4 w-4" />}>
          {hasRisk ? (
            <>
              <MetricLine label="RPN" value={risk!.rpn} />
              <MetricLine label="Band" value={<RiskBadge level={risk!.risk_level} />} />
              <MetricLine label="Formula" value={`${risk!.severity} × ${risk!.occurrence} × ${risk!.detectability}`} />
              <RiskReasonLine label="Severity" score={risk!.severity} reason={riskReasons.severity} />
              <RiskReasonLine label="Occurrence" score={risk!.occurrence} reason={riskReasons.occurrence} />
              <RiskReasonLine label="Detectability" score={risk!.detectability} reason={riskReasons.detectability} />
              <MetricLine label="Last computed" value={formatDate(risk!.computed_at ?? risk!.assessed_at)} />
              <MetricLine
                label="Method"
                value={
                  <span className={risk!.assignment_method === 'manual_override' ? 'text-amber-400' : undefined}>
                    {(risk!.assignment_method ?? 'computed').replace(/_/g, ' ')}
                  </span>
                }
              />
              {risk!.assignment_method === 'manual_override' && (
                <p className="rounded-md border border-amber-400/30 bg-amber-400/10 p-2 text-xs leading-5 text-amber-200">
                  Override: {risk!.override_reason ?? 'No reason recorded'}
                </p>
              )}
              <MetricExplain text="FMEA RPN = Severity × Occurrence × Detectability. Higher detectability score means weaker PM/calibration controls." />
            </>
          ) : (
            <EmptyMetric message="No risk score computed. Register FMEA values to compute RPN." />
          )}
        </HealthCard>

        {/* 4. PM Compliance */}
        <HealthCard title="PM Compliance" icon={<CalendarCheck className="h-4 w-4" />}>
          {hasPmCompliance ? (
            <>
              <MetricLine label="Compliance" value={`${pmCompliance!.pmc_percentage.toFixed(1)}%`} />
              <MetricLine label="Completed / Scheduled" value={`${pmCompliance!.completed_count} / ${pmCompliance!.scheduled_count}`} />
              <MetricExplain text="PMC = (completed ÷ scheduled) × 100. Includes all schedules for this asset or department." />
            </>
          ) : (
            <EmptyMetric message="No PM schedules found." />
          )}
          {nextPM && (
            <MetricLine
              label="Next PM"
              value={
                <span className={pmOverdue ? 'text-rose-400' : undefined}>
                  {formatDate(nextPM.scheduled_date)} {pmOverdue ? '(overdue)' : ''}
                </span>
              }
            />
          )}
        </HealthCard>

        {/* 5. Calibration */}
        <HealthCard title="Calibration" icon={<CalendarClock className="h-4 w-4" />}>
          {lastCalibration ? (
            <>
              <MetricLine label="Last calibration" value={formatDate(lastCalibration.calibration_date)} />
              <MetricLine label="Result" value={lastCalibration.result.replace(/\b\w/g, c => c.toUpperCase())} />
              {calNextDue && (
                <MetricLine
                  label="Next due"
                  value={
                    <span className={calOverdue ? 'text-rose-400' : undefined}>
                      {formatDate(calNextDue)} {calOverdue ? '(overdue)' : ''}
                    </span>
                  }
                />
              )}
              {lastCalibration.calibration_types?.name && (
                <MetricLine label="Type" value={lastCalibration.calibration_types.name} />
              )}
            </>
          ) : (
            <EmptyMetric message="No calibration records found." />
          )}
        </HealthCard>

        {/* 6. Replacement Priority */}
        <HealthCard title="Replacement Priority" icon={<ArrowUpDown className="h-4 w-4" />}>
          {hasReplacement ? (
            <>
              <MetricLine label="Rank" value={`#${replacement!.rank}`} />
              <MetricLine label="Priority Index" value={`${replacement!.replacement_priority_index.toFixed(2)} / 100`} />
              {replacement!.justification && (
                <MetricExplain text={replacement!.justification} />
              )}
              <MetricExplain text="RPI weighted sum: Availability 20%, Age 15%, Failure rate 15%, Maintenance burden 15%, Risk/RPN 15%, Spare parts 10%, Cost 10%." />
              <a href={replacementEvidence(id)} className="mt-1 block text-center text-xs text-[var(--brand)] hover:underline">
                View replacement evidence →
              </a>
            </>
          ) : (
            <>
              <EmptyMetric message="No replacement priority computed for this asset." />
              <MetricExplain text="Replacement priority is computed system-wide. Ensure reliability and risk data is available." />
            </>
          )}
        </HealthCard>
      </div>

      {/* Risk watch banner if high/critical */}
      {risk && (risk.risk_level === 'high' || risk.risk_level === 'critical') && !openWorkOrder && !openRequest && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-orange-400/30 bg-orange-400/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />
          <div className="text-sm">
            <span className="font-semibold text-orange-200">Risk watch:</span>{' '}
            <span className="text-orange-100">{equipment.name} has a {risk.risk_level} RPN of {risk.rpn}. No corrective request or work order is open.</span>
            {canCreateRequests && (
              <a
                href={createMaintenanceRequestFromAsset(id, {
                  departmentId: equipment.departments?.id,
                  urgency: 'high',
                  description: `Risk watch: ${equipment.name} has ${risk.risk_level} RPN ${risk.rpn}. Review and determine if corrective action is required.`,
                  type: 'corrective',
                }).replace('source=command-center', 'source=equipment')}
                className="ml-2 text-orange-300 underline hover:text-orange-100"
              >
                Create request
              </a>
            )}
          </div>
        </div>
      )}

      <Tabs tabs={tabs} defaultTab="overview" />
    </div>
  );
}
