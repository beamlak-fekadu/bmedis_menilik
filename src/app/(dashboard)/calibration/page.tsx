'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, ClipboardList } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import Tabs from '@/components/ui/Tabs';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Table from '@/components/ui/Table';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import {
  getCalibrationRecords,
  getCalibrationRequests,
  getUpcomingCalibrations,
} from '@/services/calibration.service';
import { createCalibrationRecordAction, createCalibrationRequestAction } from '@/actions/calibration.actions';
import { getEquipmentList } from '@/services/equipment.service';
import * as settingsService from '@/services/settings.service';
import type { CalibrationResult, CalibrationRequestStatus, Urgency } from '@/types/database';

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

export default function CalibrationPage() {
  const { toast } = useToast();
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
  ];

  const upcomingColumns = [
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
      key: 'next_due_date',
      header: 'Due Date',
      sortable: true,
      render: (row: CalRecord) => {
        const due = row.next_due_date as string;
        const isOverdue = new Date(due) < new Date();
        return (
          <span className={isOverdue ? 'font-semibold text-red-600' : ''}>
            {new Date(due).toLocaleDateString()}
            {isOverdue && ' (Overdue)'}
          </span>
        );
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
  ];

  if (loading) return <PageLoader />;

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
          data={upcoming}
          emptyMessage="No upcoming calibrations in the next 90 days"
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Calibration Management"
        description="Track calibration records, requests, and upcoming due dates"
      />

      <Tabs tabs={tabs} />

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
