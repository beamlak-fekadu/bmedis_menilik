'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import Tabs from '@/components/ui/Tabs';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import {
  getDisposalRequests,
  createDisposalRequest,
  updateDisposalRequestStatus,
} from '@/services/disposal.service';
import { getEquipmentList } from '@/services/equipment.service';
import { createClient } from '@/lib/supabase/client';
import type { DisposalMethod, DisposalRequestStatus } from '@/types/database';

type DisposalRow = Record<string, unknown>;
type DisposedRow = Record<string, unknown>;

const disposalMethodOptions: { value: DisposalMethod; label: string }[] = [
  { value: 'auction', label: 'Auction' },
  { value: 'donation', label: 'Donation' },
  { value: 'recycling', label: 'Recycling' },
  { value: 'destruction', label: 'Destruction' },
  { value: 'return_to_vendor', label: 'Return to Vendor' },
  { value: 'other', label: 'Other' },
];

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'> = {
  pending: 'warning',
  approved: 'info',
  rejected: 'error',
  completed: 'success',
  canceled: 'default',
};

function formatLabel(val: string) {
  return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DisposalPage() {
  const { toast } = useToast();
  const [disposalRequests, setDisposalRequests] = useState<DisposalRow[]>([]);
  const [disposedAssets, setDisposedAssets] = useState<DisposedRow[]>([]);
  const [assets, setAssets] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<DisposalRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<DisposalRow | null>(null);

  // Form
  const [formAssetId, setFormAssetId] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formMethod, setFormMethod] = useState<DisposalMethod>('recycling');
  const [formNotes, setFormNotes] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [reqRes, disposedRes, assetRes] = await Promise.all([
        getDisposalRequests(),
        supabase
          .from('disposed_assets')
          .select(`
            id, asset_id, disposal_request_id, disposal_date, disposal_method,
            disposal_value, disposed_by, notes, created_at,
            equipment_assets(id, asset_code, name)
          `)
          .order('disposal_date', { ascending: false }),
        getEquipmentList(),
      ]);

      setDisposalRequests((reqRes.data || []) as DisposalRow[]);
      setDisposedAssets((disposedRes.data || []) as DisposedRow[]);
      setAssets(
        (assetRes.data || []).map((a: Record<string, unknown>) => ({
          value: a.id as string,
          label: `${a.asset_code} — ${a.name}`,
        }))
      );
    } catch {
      toast('error', 'Failed to load disposal data');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!formAssetId || !formReason) {
      toast('warning', 'Asset and reason are required');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await createDisposalRequest({
        asset_id: formAssetId,
        requested_by: null,
        reason: formReason,
        disposal_method_proposed: formMethod,
        status: 'pending' as DisposalRequestStatus,
        notes: formNotes || null,
      });
      if (error) throw error;
      toast('success', 'Disposal request created');
      setCreateOpen(false);
      resetForm();
      loadData();
    } catch {
      toast('error', 'Failed to create disposal request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    setSubmitting(true);
    try {
      const { error } = await updateDisposalRequestStatus(
        approveTarget.id as string,
        'approved'
      );
      if (error) throw error;
      toast('success', 'Disposal request approved');
      setApproveTarget(null);
      loadData();
    } catch {
      toast('error', 'Failed to approve request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setSubmitting(true);
    try {
      const { error } = await updateDisposalRequestStatus(
        rejectTarget.id as string,
        'rejected'
      );
      if (error) throw error;
      toast('success', 'Disposal request rejected');
      setRejectTarget(null);
      loadData();
    } catch {
      toast('error', 'Failed to reject request');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormAssetId(''); setFormReason(''); setFormMethod('recycling'); setFormNotes('');
  };

  const requestColumns = [
    { key: 'request_number', header: 'Request #', sortable: true },
    {
      key: 'asset',
      header: 'Asset',
      render: (row: DisposalRow) => {
        const asset = row.equipment_assets as { asset_code: string; name: string } | null;
        return asset ? `${asset.asset_code} — ${asset.name}` : '—';
      },
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row: DisposalRow) => {
        const reason = row.reason as string;
        return reason?.length > 50 ? `${reason.slice(0, 50)}...` : reason || '—';
      },
    },
    {
      key: 'disposal_method_proposed',
      header: 'Proposed Method',
      render: (row: DisposalRow) =>
        row.disposal_method_proposed ? formatLabel(row.disposal_method_proposed as string) : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: DisposalRow) => (
        <Badge variant={statusVariant[row.status as string] || 'default'}>
          {formatLabel(row.status as string)}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (row: DisposalRow) => new Date(row.created_at as string).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: DisposalRow) => {
        if (row.status !== 'pending') return null;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); setApproveTarget(row); }}
              title="Approve"
            >
              <CheckCircle className="h-4 w-4 text-green-500" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); setRejectTarget(row); }}
              title="Reject"
            >
              <XCircle className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        );
      },
    },
  ];

  const disposedColumns = [
    {
      key: 'asset',
      header: 'Asset',
      render: (row: DisposedRow) => {
        const asset = row.equipment_assets as { asset_code: string; name: string } | null;
        return asset ? `${asset.asset_code} — ${asset.name}` : '—';
      },
    },
    {
      key: 'disposal_date',
      header: 'Disposal Date',
      sortable: true,
      render: (row: DisposedRow) => new Date(row.disposal_date as string).toLocaleDateString(),
    },
    {
      key: 'disposal_method',
      header: 'Method',
      render: (row: DisposedRow) => formatLabel(row.disposal_method as string),
    },
    {
      key: 'disposal_value',
      header: 'Value',
      render: (row: DisposedRow) =>
        row.disposal_value != null ? `$${(row.disposal_value as number).toFixed(2)}` : '—',
    },
    { key: 'disposed_by', header: 'Disposed By' },
  ];

  if (loading) return <PageLoader />;

  const tabs = [
    {
      id: 'requests',
      label: 'Requests',
      count: disposalRequests.length,
      content: (
        <DataTable
          columns={requestColumns}
          data={disposalRequests}
          searchPlaceholder="Search disposal requests..."
          emptyMessage="No disposal requests found"
          actions={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New Request
            </Button>
          }
        />
      ),
    },
    {
      id: 'disposed',
      label: 'Disposed',
      count: disposedAssets.length,
      content: (
        <DataTable
          columns={disposedColumns}
          data={disposedAssets}
          searchPlaceholder="Search disposed assets..."
          emptyMessage="No disposed assets found"
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Disposal Management"
        description="Manage equipment disposal requests, approvals, and completed disposals"
      />

      <Tabs tabs={tabs} />

      {/* New Request Modal */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); resetForm(); }}
        title="New Disposal Request"
        footer={
          <>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleCreate} loading={submitting}>Submit Request</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Asset *" options={assets} placeholder="Select asset" value={formAssetId} onChange={(e) => setFormAssetId(e.target.value)} />
          <Textarea label="Reason for Disposal *" value={formReason} onChange={(e) => setFormReason(e.target.value)} placeholder="Why should this equipment be disposed?" />
          <Select label="Proposed Method" options={disposalMethodOptions} value={formMethod} onChange={(e) => setFormMethod(e.target.value as DisposalMethod)} />
          <Textarea label="Notes" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Additional notes..." />
        </div>
      </Modal>

      {/* Approve Dialog */}
      <ConfirmDialog
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        onConfirm={handleApprove}
        title="Approve Disposal Request"
        description={`Are you sure you want to approve disposal request ${approveTarget?.request_number}?`}
        confirmLabel="Approve"
        loading={submitting}
        destructive={false}
      />

      {/* Reject Dialog */}
      <ConfirmDialog
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
        title="Reject Disposal Request"
        description={`Are you sure you want to reject disposal request ${rejectTarget?.request_number}?`}
        confirmLabel="Reject"
        loading={submitting}
      />
    </div>
  );
}
