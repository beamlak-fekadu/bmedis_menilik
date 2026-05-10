'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, CheckCircle, ClipboardList, Gauge, Plus, ShieldAlert, Wrench } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import Tabs from '@/components/ui/Tabs';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import StatCard from '@/components/ui/StatCard';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Table from '@/components/ui/Table';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useRole } from '@/hooks/useRole';
import {
  getCalibrationRecords,
  getCalibrationRequests,
  getUpcomingCalibrations,
} from '@/services/calibration.service';
import { createCalibrationRecordAction, createCalibrationRequestAction } from '@/actions/calibration.actions';
import { getEquipmentList } from '@/services/equipment.service';
import * as settingsService from '@/services/settings.service';
import type { CalibrationResult, CalibrationRequestStatus, Urgency } from '@/types/domain';

const resultVariant: Record<CalibrationResult, 'success' | 'error' | 'warning'> = {
  pass: 'success',
  fail: 'error',
  adjusted: 'warning',
};

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'> = {
  pending: 'warning',
  approved: 'info',
  in_progress: 'purple',
  completed: 'success',
  rejected: 'error',
  canceled: 'default',
};

function formatLabel(val: string) {
  return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

type CalRecord = Record<string, unknown>;
type CalRequest = Record<string, unknown>;
type CalibrationAsset = {
  id?: string;
  asset_code?: string;
  name?: string;
  departments?: { name?: string; code?: string } | null;
  equipment_categories?: { name?: string; criticality_level?: string | null } | null;
};

function calibrationAsset(row: CalRecord | CalRequest): CalibrationAsset | null {
  return (row.equipment_assets as CalibrationAsset | null) ?? null;
}

function daysFromToday(dateValue: unknown) {
  if (!dateValue) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateValue as string);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function isCriticalCalibration(row: CalRecord) {
  const asset = calibrationAsset(row);
  const criticality = String(asset?.equipment_categories?.criticality_level ?? '').toLowerCase();
  const department = `${asset?.departments?.name ?? ''} ${asset?.departments?.code ?? ''}`.toLowerCase();
  const assetText = `${asset?.asset_code ?? ''} ${asset?.name ?? ''} ${asset?.equipment_categories?.name ?? ''}`.toLowerCase();
  return criticality === 'critical'
    || /(icu|intensive care|operating|theater|emergency)/.test(department)
    || /(ventilator|anesthesia|defibrillator|infusion|monitor)/.test(assetText);
}

function calibrationPriority(row: CalRecord) {
  const days = Math.abs(Math.min(daysFromToday(row.next_due_date), 0));
  const result = String(row.result ?? '');
  return (isCriticalCalibration(row) ? 0 : 20)
    + (['fail', 'adjusted'].includes(result) ? 0 : 8)
    + (days > 90 ? 0 : days > 30 ? 4 : 8);
}

export default function CalibrationPage() {
  const { toast } = useToast();
  const { canManageMaintenance, primaryRole } = useRole();
  const searchParams = useSearchParams();
  const [records, setRecords] = useState<CalRecord[]>([]);
  const [requests, setRequests] = useState<CalRequest[]>([]);
  const [upcoming, setUpcoming] = useState<CalRecord[]>([]);
  const [assets, setAssets] = useState<{ value: string; label: string }[]>([]);
  const [calTypes, setCalTypes] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Record form
  const [recAssetId, setRecAssetId] = useState('');
  const [recTypeId, setRecTypeId] = useState('');
  const [recDate, setRecDate] = useState('');
  const [recNextDue, setRecNextDue] = useState('');
  const [recResult, setRecResult] = useState<CalibrationResult>('pass');
  const [recCalibratedBy, setRecCalibratedBy] = useState('');
  const [recNotes, setRecNotes] = useState('');

  // Request form
  const [reqAssetId, setReqAssetId] = useState('');
  const [reqTypeId, setReqTypeId] = useState('');
  const [reqUrgency, setReqUrgency] = useState<Urgency>('medium');
  const [reqNotes, setReqNotes] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, reqRes, upRes, assetRes, typeRes] = await Promise.all([
        getCalibrationRecords(),
        getCalibrationRequests(),
        getUpcomingCalibrations(90),
        getEquipmentList(),
        settingsService.getAll('calibration_types'),
      ]);

      setRecords((recRes.data || []) as CalRecord[]);
      setRequests((reqRes.data || []) as CalRequest[]);
      setUpcoming((upRes.data || []) as CalRecord[]);
      setAssets(
        (assetRes.data || []).map((a: Record<string, unknown>) => ({
          value: a.id as string,
          label: `${a.asset_code} — ${a.name}`,
        }))
      );
      setCalTypes(
        (typeRes.data || []).map((t: Record<string, unknown>) => ({
          value: t.id as string,
          label: t.name as string,
        }))
      );
    } catch {
      toast('error', 'Failed to load calibration data');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (searchParams.get('source') === 'requests-hub' && searchParams.get('action') === 'new-request') {
      setRequestModalOpen(true);
    }
    const assetId = searchParams.get('assetId');
    if (assetId) {
      setReqAssetId(assetId);
      setRecAssetId(assetId);
    }
    if (searchParams.get('action') === 'record-result') setRecordModalOpen(true);
    if (searchParams.get('action') === 'new-request') setRequestModalOpen(true);
  }, [searchParams]);

  const handleCreateRecord = async () => {
    if (!recAssetId || !recDate) {
      toast('warning', 'Asset and date are required');
      return;
    }
    setSubmitting(true);
    try {
      const result = await createCalibrationRecordAction({
        asset_id: recAssetId,
        calibration_type_id: recTypeId || null,
        calibrated_by: recCalibratedBy || null,
        calibration_date: recDate,
        next_due_date: recNextDue || null,
        result: recResult,
        certificate_path: null,
        notes: recNotes || null,
      });
      if (!result.success) throw new Error(result.error ?? 'Failed to create calibration record');
      toast('success', 'Calibration record created');
      setRecordModalOpen(false);
      resetRecordForm();
      loadData();
    } catch {
      toast('error', 'Failed to create calibration record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!reqAssetId) {
      toast('warning', 'Asset is required');
      return;
    }
    setSubmitting(true);
    try {
      const result = await createCalibrationRequestAction({
        asset_id: reqAssetId,
        requested_by: null,
        calibration_type_id: reqTypeId || null,
        urgency: reqUrgency,
        status: 'pending' as CalibrationRequestStatus,
        notes: reqNotes || null,
      });
      if (!result.success) throw new Error(result.error ?? 'Failed to create calibration request');
      toast('success', 'Calibration request submitted');
      setRequestModalOpen(false);
      resetRequestForm();
      loadData();
    } catch {
      toast('error', 'Failed to create calibration request');
    } finally {
      setSubmitting(false);
    }
  };

  const resetRecordForm = () => {
    setRecAssetId(''); setRecTypeId(''); setRecDate('');
    setRecNextDue(''); setRecResult('pass'); setRecCalibratedBy(''); setRecNotes('');
  };

  const resetRequestForm = () => {
    setReqAssetId(''); setReqTypeId(''); setReqUrgency('medium'); setReqNotes('');
  };

  const recordColumns = [
    {
      key: 'asset',
      header: 'Asset',
      sortable: true,
      render: (row: CalRecord) => {
        const asset = row.equipment_assets as { asset_code: string; name: string } | null;
        return asset ? `${asset.asset_code} — ${asset.name}` : '—';
      },
    },
    {
      key: 'type',
      header: 'Type',
      render: (row: CalRecord) => {
        const type = row.calibration_types as { name: string } | null;
        return type?.name || '—';
      },
    },
    {
      key: 'calibration_date',
      header: 'Date',
      sortable: true,
      render: (row: CalRecord) => new Date(row.calibration_date as string).toLocaleDateString(),
    },
    {
      key: 'result',
      header: 'Result',
      render: (row: CalRecord) => (
        <Badge variant={resultVariant[row.result as CalibrationResult]}>
          {formatLabel(row.result as string)}
        </Badge>
      ),
    },
    {
      key: 'next_due_date',
      header: 'Next Due',
      sortable: true,
      render: (row: CalRecord) =>
        row.next_due_date ? new Date(row.next_due_date as string).toLocaleDateString() : '—',
    },
    { key: 'calibrated_by', header: 'Calibrated By' },
    {
      key: 'action',
      header: 'Action',
      render: (row: CalRecord) => {
        const asset = calibrationAsset(row);
        return (
          <div className="flex flex-wrap gap-1.5">
            <Link className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)]" href={`/calibration?recordId=${row.id as string}&source=calibration-record`}>
              Evidence
            </Link>
            {['fail', 'adjusted'].includes(row.result as string) && asset?.id && (
              <Link className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)]" href={`/maintenance/requests/new?assetId=${asset.id}&source=calibration&reportedCondition=needs_repair`}>
                Request
              </Link>
            )}
          </div>
        );
      },
    },
  ];

  const requestColumns = [
    {
      key: 'request_number',
      header: 'Request #',
      sortable: true,
    },
    {
      key: 'asset',
      header: 'Asset',
      render: (row: CalRequest) => {
        const asset = row.equipment_assets as { asset_code: string; name: string } | null;
        return asset ? `${asset.asset_code} — ${asset.name}` : '—';
      },
    },
    {
      key: 'type',
      header: 'Type',
      render: (row: CalRequest) => {
        const type = row.calibration_types as { name: string } | null;
        return type?.name || '—';
      },
    },
    {
      key: 'urgency',
      header: 'Urgency',
      render: (row: CalRequest) => (
        <Badge variant={statusVariant[row.urgency as string] || 'default'}>
          {formatLabel(row.urgency as string)}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: CalRequest) => (
        <Badge variant={statusVariant[row.status as string] || 'default'}>
          {formatLabel(row.status as string)}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Requested',
      sortable: true,
      render: (row: CalRequest) => new Date(row.created_at as string).toLocaleDateString(),
    },
    {
      key: 'action',
      header: 'Next Action',
      render: (row: CalRequest) => {
        const label = row.status === 'pending' ? 'Review' : row.status === 'approved' ? 'Schedule' : row.status === 'completed' ? 'View Evidence' : 'View';
        return (
          <Link className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)]" href={`/calibration?requestId=${row.id as string}&action=${label.toLowerCase().replace(/\s+/g, '-')}`}>
            {label}
          </Link>
        );
      },
    },
  ];

  const upcomingColumns = [
    {
      key: 'asset',
      header: 'Asset',
      sortable: true,
      render: (row: CalRecord) => {
        const asset = calibrationAsset(row);
        return (
          <div>
            <p className="font-medium">{asset?.asset_code ?? '—'}</p>
            <p className="text-xs text-[var(--text-muted)]">{asset?.name ?? 'Unknown asset'}</p>
          </div>
        );
      },
    },
    {
      key: 'department',
      header: 'Department',
      render: (row: CalRecord) => calibrationAsset(row)?.departments?.name ?? '—',
    },
    {
      key: 'type',
      header: 'Type',
      render: (row: CalRecord) => {
        const type = row.calibration_types as { name: string } | null;
        return type?.name || '—';
      },
    },
    {
      key: 'next_due_date',
      header: 'Due Date',
      sortable: true,
      render: (row: CalRecord) => {
        const due = row.next_due_date as string;
        const days = daysFromToday(due);
        const isOverdue = days < 0;
        return (
          <span className={isOverdue ? 'font-semibold text-red-600' : ''}>
            {new Date(due).toLocaleDateString()}
            {isOverdue && ` (${Math.abs(days)}d overdue)`}
          </span>
        );
      },
    },
    {
      key: 'days_overdue',
      header: 'Days',
      render: (row: CalRecord) => {
        const days = daysFromToday(row.next_due_date);
        return days < 0 ? <Badge variant={Math.abs(days) > 90 ? 'error' : 'warning'}>{Math.abs(days)} overdue</Badge> : `${days} until due`;
      },
    },
    {
      key: 'last_result',
      header: 'Last Result',
      render: (row: CalRecord) => (
        <Badge variant={resultVariant[row.result as CalibrationResult]}>
          {formatLabel(row.result as string)}
        </Badge>
      ),
    },
    {
      key: 'risk',
      header: 'Risk',
      render: (row: CalRecord) => (
        <Badge variant={isCriticalCalibration(row) ? 'error' : 'info'}>
          {isCriticalCalibration(row) ? 'Critical' : 'Routine'}
        </Badge>
      ),
    },
    {
      key: 'action',
      header: 'Next Action',
      render: (row: CalRecord) => {
        const asset = calibrationAsset(row);
        const due = row.next_due_date ? new Date(row.next_due_date as string) : null;
        const overdue = due ? due < new Date() : false;
        const label = overdue ? 'Record' : 'Schedule';
        return (
          <div className="flex flex-wrap gap-1.5">
            {canManageMaintenance && (
              <button
                type="button"
                onClick={() => {
                  if (asset?.id) setRecAssetId(asset.id);
                  setRecordModalOpen(true);
                }}
                className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)]"
              >
                {label}
              </button>
            )}
            {asset?.id && (
              <Link className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)]" href={`/equipment/${asset.id}`}>
                Asset
              </Link>
            )}
          </div>
        );
      },
    },
  ];

  if (loading) return <PageLoader />;

  const now = new Date();
  const overdueRows = upcoming.filter((row) => row.next_due_date && new Date(row.next_due_date as string) < now);
  const criticalOverdueRows = overdueRows.filter(isCriticalCalibration);
  const failedAdjustedOverdueRows = overdueRows.filter((row) => ['fail', 'adjusted'].includes(String(row.result ?? '')));
  const sortedUpcoming = [...upcoming].sort((a, b) => calibrationPriority(a) - calibrationPriority(b) || daysFromToday(a.next_due_date) - daysFromToday(b.next_due_date));
  const longestOverdueRows = [...overdueRows].sort((a, b) => daysFromToday(a.next_due_date) - daysFromToday(b.next_due_date)).slice(0, 3);
  const dueSoonRows = upcoming.filter((row) => {
    if (!row.next_due_date) return false;
    const due = new Date(row.next_due_date as string);
    const days = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
    return days >= 0 && days <= 30;
  });
  const failedAdjusted = records.filter((row) => ['fail', 'adjusted'].includes(row.result as string));
  const completedThisMonth = records.filter((row) => {
    if (!row.calibration_date) return false;
    const date = new Date(row.calibration_date as string);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const externalCalibration = records.filter((row) => {
    const by = String(row.calibrated_by ?? '').toLowerCase();
    const notes = String(row.notes ?? '').toLowerCase();
    return by.includes('vendor') || by.includes('external') || notes.includes('vendor') || notes.includes('external');
  });
  const requestedTab = searchParams.get('tab');
  const defaultTab = requestedTab && ['records', 'requests', 'upcoming'].includes(requestedTab)
    ? requestedTab
    : overdueRows.length > 0 ? 'upcoming' : 'records';

  const tabs = [
    {
      id: 'records',
      label: 'Records',
      count: records.length,
      content: (
        <DataTable
          columns={recordColumns}
          data={records}
          searchPlaceholder="Search calibration records..."
          emptyMessage="No calibration records found"
          actions={
            <Button onClick={() => setRecordModalOpen(true)}>
              <Plus className="h-4 w-4" />
              New Record
            </Button>
          }
        />
      ),
    },
    {
      id: 'requests',
      label: 'Requests',
      count: requests.length,
      content: (
        <DataTable
          columns={requestColumns}
          data={requests}
          searchPlaceholder="Search calibration requests..."
          emptyMessage="No calibration requests found"
          actions={
            <Button onClick={() => setRequestModalOpen(true)}>
              <ClipboardList className="h-4 w-4" />
              New Request
            </Button>
          }
        />
      ),
    },
    {
      id: 'upcoming',
      label: 'Upcoming / Overdue',
      count: upcoming.length,
      content: (
        <Table
          columns={upcomingColumns}
          data={sortedUpcoming}
          emptyMessage="No upcoming calibrations in the next 90 days"
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calibration"
        description="Accuracy and safety compliance control center for due, overdue, failed, adjusted, and requested calibrations."
        actions={canManageMaintenance ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setRequestModalOpen(true)} variant="outline"><ClipboardList className="h-4 w-4" /> New Request</Button>
            <Button onClick={() => setRecordModalOpen(true)}><Plus className="h-4 w-4" /> New Record</Button>
          </div>
        ) : <Badge variant="info">{primaryRole === 'viewer' ? 'Read-only' : 'View access'}</Badge>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Calibration Records" value={records.length} icon={<Gauge className="h-6 w-6" />} color="blue" />
        <StatCard label="Calibration Requests" value={requests.length} icon={<ClipboardList className="h-6 w-6" />} color="purple" />
        <StatCard label="Due Soon" value={dueSoonRows.length} icon={<CalendarClock className="h-6 w-6" />} color="yellow" />
        <StatCard label="Overdue" value={overdueRows.length} icon={<AlertTriangle className="h-6 w-6" />} color="red" />
        <StatCard label="Failed / Adjusted" value={failedAdjusted.length} icon={<ShieldAlert className="h-6 w-6" />} color="orange" />
        <StatCard label="Critical Overdue" value={criticalOverdueRows.length} icon={<AlertTriangle className="h-6 w-6" />} color="red" />
        <StatCard label="External Calibration" value={externalCalibration.length} icon={<Wrench className="h-6 w-6" />} color="gray" />
        <StatCard label="Completed This Month" value={completedThisMonth.length} icon={<CheckCircle className="h-6 w-6" />} color="green" />
      </div>

      {(overdueRows.length > 0 || failedAdjusted.length > 0) && (
        <section className="panel-surface rounded-lg p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--foreground)]">Calibration Triage</h2>
              <p className="text-sm text-[var(--text-muted)]">Overdue calibration affects safety, accuracy, and FMEA detectability. The queue is ordered by criticality, failed/adjusted evidence, and days overdue.</p>
            </div>
            <Badge variant="warning">{overdueRows.length} overdue</Badge>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {[
              { title: 'Critical Overdue', rows: criticalOverdueRows.slice(0, 3), empty: 'No high-critical overdue items.' },
              { title: 'Failed / Adjusted Last Result', rows: failedAdjustedOverdueRows.slice(0, 3), empty: 'No failed or adjusted overdue results.' },
              { title: 'Longest Overdue', rows: longestOverdueRows, empty: 'No overdue calibration rows.' },
            ].map((group) => (
              <div key={group.title} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">{group.title}</h3>
                <div className="mt-3 space-y-2">
                  {group.rows.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">{group.empty}</p>
                  ) : group.rows.map((row) => {
                    const asset = calibrationAsset(row);
                    return (
                      <div key={String(row.id)} className="rounded-md bg-[var(--surface-2)]/70 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[var(--foreground)]">{asset?.asset_code ?? 'Asset'} · {asset?.name ?? 'Unknown'}</p>
                            <p className="text-xs text-[var(--text-muted)]">{Math.abs(daysFromToday(row.next_due_date))}d overdue · {formatLabel(String(row.result ?? 'unknown'))}</p>
                          </div>
                          {asset?.id && <Link className="text-xs font-medium text-[var(--brand)] hover:underline" href={`/equipment/${asset.id}`}>Asset</Link>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Tabs tabs={tabs} defaultTab={defaultTab} />

      {/* New Record Modal */}
      <Modal
        open={recordModalOpen}
        onClose={() => { setRecordModalOpen(false); resetRecordForm(); }}
        title="New Calibration Record"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setRecordModalOpen(false); resetRecordForm(); }}>Cancel</Button>
            <Button onClick={handleCreateRecord} loading={submitting}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Asset *" options={assets} placeholder="Select asset" value={recAssetId} onChange={(e) => setRecAssetId(e.target.value)} />
          <Select label="Calibration Type" options={calTypes} placeholder="Select type" value={recTypeId} onChange={(e) => setRecTypeId(e.target.value)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Calibration Date *" type="date" value={recDate} onChange={(e) => setRecDate(e.target.value)} />
            <Input label="Next Due Date" type="date" value={recNextDue} onChange={(e) => setRecNextDue(e.target.value)} />
          </div>
          <Select
            label="Result *"
            options={[
              { value: 'pass', label: 'Pass' },
              { value: 'fail', label: 'Fail' },
              { value: 'adjusted', label: 'Adjusted' },
            ]}
            value={recResult}
            onChange={(e) => setRecResult(e.target.value as CalibrationResult)}
          />
          <Input label="Calibrated By" value={recCalibratedBy} onChange={(e) => setRecCalibratedBy(e.target.value)} placeholder="Technician or vendor name" />
          <Textarea label="Notes" value={recNotes} onChange={(e) => setRecNotes(e.target.value)} placeholder="Additional notes..." />
        </div>
      </Modal>

      {/* New Request Modal */}
      <Modal
        open={requestModalOpen}
        onClose={() => { setRequestModalOpen(false); resetRequestForm(); }}
        title="New Calibration Request"
        footer={
          <>
            <Button variant="outline" onClick={() => { setRequestModalOpen(false); resetRequestForm(); }}>Cancel</Button>
            <Button onClick={handleCreateRequest} loading={submitting}>Submit Request</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Asset *" options={assets} placeholder="Select asset" value={reqAssetId} onChange={(e) => setReqAssetId(e.target.value)} />
          <Select label="Calibration Type" options={calTypes} placeholder="Select type" value={reqTypeId} onChange={(e) => setReqTypeId(e.target.value)} />
          <Select
            label="Urgency"
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'critical', label: 'Critical' },
            ]}
            value={reqUrgency}
            onChange={(e) => setReqUrgency(e.target.value as Urgency)}
          />
          <Textarea label="Notes" value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} placeholder="Reason for request..." />
        </div>
      </Modal>
    </div>
  );
}
