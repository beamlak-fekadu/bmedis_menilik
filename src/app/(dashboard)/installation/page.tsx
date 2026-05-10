'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, CheckCircle, XCircle, ClipboardList, Package } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { getEquipmentList } from '@/services/equipment.service';
import { createClient } from '@/lib/supabase/client';
import type { InstallationRecord, EquipmentAsset } from '@/types/domain';
import { createInstallationRecordAction } from '@/actions/installation.actions';

type InstallationRow = InstallationRecord & {
  equipment_assets?: Array<{ id: string; asset_code: string; name: string }> | null;
  [key: string]: unknown;
};

type InstallationRequestRow = {
  id: string;
  request_number: string;
  asset_id: string | null;
  equipment_name: string | null;
  vendor: string | null;
  status: string;
  priority: string;
  commissioning_required: boolean;
  user_training_required: boolean;
  received_date: string | null;
  requested_installation_date: string | null;
  target_go_live_date: string | null;
  installation_reason: string | null;
  created_at: string;
  equipment_assets?: Array<{ id: string; asset_code: string; name: string }> | null;
  [key: string]: unknown;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    submitted: 'bg-blue-500/15 text-blue-300',
    approved: 'bg-emerald-500/15 text-emerald-300',
    scheduled: 'bg-violet-500/15 text-violet-300',
    assigned: 'bg-sky-500/15 text-sky-300',
    in_progress: 'bg-amber-500/15 text-amber-300',
    completed: 'bg-emerald-500/15 text-emerald-400',
    rejected: 'bg-rose-500/15 text-rose-300',
    cancelled: 'bg-slate-500/15 text-slate-300',
  };
  const cls = map[status] ?? 'bg-slate-500/15 text-slate-300';
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export default function InstallationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') === 'records' ? 'records' : 'requests';

  const [activeTab, setActiveTab] = useState<'requests' | 'records'>(defaultTab);
  const [records, setRecords] = useState<InstallationRow[]>([]);
  const [requests, setRequests] = useState<InstallationRequestRow[]>([]);
  const [assets, setAssets] = useState<EquipmentAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Record form fields
  const [formAssetId, setFormAssetId] = useState('');
  const [formInstalledBy, setFormInstalledBy] = useState('');
  const [formInstallDate, setFormInstallDate] = useState('');
  const [formCommissionDate, setFormCommissionDate] = useState('');
  const [formGoLiveDate, setFormGoLiveDate] = useState('');
  const [formTrainingDone, setFormTrainingDone] = useState(false);
  const [formNotes, setFormNotes] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [installRes, requestsRes, assetRes] = await Promise.all([
        supabase
          .from('installation_records')
          .select('id, asset_id, installed_by, installation_date, commissioning_date, acceptance_checklist, go_live_date, initial_training_done, notes, created_at, updated_at, equipment_assets(id, asset_code, name)')
          .order('installation_date', { ascending: false }),
        supabase
          .from('installation_requests')
          .select('id, request_number, asset_id, equipment_name, vendor, status, priority, commissioning_required, user_training_required, received_date, requested_installation_date, target_go_live_date, installation_reason, created_at, equipment_assets(id, asset_code, name)')
          .order('created_at', { ascending: false }),
        getEquipmentList(),
      ]);
      setRecords((installRes.data || []) as unknown as InstallationRow[]);
      setRequests((requestsRes.data || []) as unknown as InstallationRequestRow[]);
      setAssets((assetRes.data || []) as unknown as EquipmentAsset[]);
    } catch {
      toast('error', 'Failed to load installation data');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async () => {
    if (!formAssetId || !formInstallDate) {
      toast('warning', 'Asset and installation date are required');
      return;
    }
    setSubmitting(true);
    try {
      const result = await createInstallationRecordAction({
        asset_id: formAssetId,
        installed_by: formInstalledBy || null,
        installation_date: formInstallDate,
        commissioning_date: formCommissionDate || null,
        go_live_date: formGoLiveDate || null,
        initial_training_done: formTrainingDone,
        notes: formNotes || null,
        acceptance_checklist: [],
      });
      if (!result.success) throw new Error(result.error ?? 'Failed to create installation record');
      toast('success', 'Installation record created');
      setModalOpen(false);
      resetForm();
      loadData();
    } catch {
      toast('error', 'Failed to create installation record');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormAssetId('');
    setFormInstalledBy('');
    setFormInstallDate('');
    setFormCommissionDate('');
    setFormGoLiveDate('');
    setFormTrainingDone(false);
    setFormNotes('');
  };

  const recordColumns = [
    {
      key: 'asset_code',
      header: 'Asset Code',
      sortable: true,
      render: (row: InstallationRow) => row.equipment_assets?.[0]?.asset_code || '—',
    },
    {
      key: 'asset_name',
      header: 'Asset Name',
      render: (row: InstallationRow) => row.equipment_assets?.[0]?.name || '—',
    },
    { key: 'installed_by', header: 'Installed By', sortable: true },
    {
      key: 'installation_date',
      header: 'Installation Date',
      sortable: true,
      render: (row: InstallationRow) => new Date(row.installation_date).toLocaleDateString(),
    },
    {
      key: 'commissioning_date',
      header: 'Commissioning Date',
      render: (row: InstallationRow) =>
        row.commissioning_date ? new Date(row.commissioning_date).toLocaleDateString() : '—',
    },
    {
      key: 'go_live_date',
      header: 'Go-Live Date',
      render: (row: InstallationRow) =>
        row.go_live_date ? new Date(row.go_live_date).toLocaleDateString() : '—',
    },
    {
      key: 'initial_training_done',
      header: 'Training Done',
      render: (row: InstallationRow) =>
        row.initial_training_done ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <XCircle className="h-5 w-5 text-gray-300 dark:text-gray-600" />
        ),
    },
  ];

  const requestColumns = [
    {
      key: 'request_number',
      header: 'Request #',
      sortable: true,
      render: (row: InstallationRequestRow) => (
        <a
          href={`/installation/requests/${row.id}`}
          className="font-medium text-[var(--brand)] hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.request_number}
        </a>
      ),
    },
    {
      key: 'asset',
      header: 'Equipment',
      render: (row: InstallationRequestRow) => {
        const asset = row.equipment_assets?.[0];
        if (asset) return `${asset.asset_code} — ${asset.name}`;
        return row.equipment_name ?? '—';
      },
    },
    {
      key: 'vendor',
      header: 'Vendor',
      render: (row: InstallationRequestRow) => row.vendor ?? '—',
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (row: InstallationRequestRow) => row.priority.charAt(0).toUpperCase() + row.priority.slice(1),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row: InstallationRequestRow) => <StatusBadge status={row.status} />,
    },
    {
      key: 'commissioning_required',
      header: 'Commissioning',
      render: (row: InstallationRequestRow) =>
        row.commissioning_required ? (
          <CheckCircle className="h-4 w-4 text-emerald-400" />
        ) : (
          <XCircle className="h-4 w-4 text-[var(--text-muted)]" />
        ),
    },
    {
      key: 'target_go_live_date',
      header: 'Target Go-Live',
      render: (row: InstallationRequestRow) =>
        row.target_go_live_date ? new Date(row.target_go_live_date).toLocaleDateString() : '—',
    },
    {
      key: 'action',
      header: 'Action',
      render: (row: InstallationRequestRow) => {
        const s = row.status;
        const label = s === 'submitted' ? 'Review' : s === 'approved' ? 'Schedule' : s === 'in_progress' ? 'View Progress' : s === 'completed' ? 'View Record' : 'View';
        return (
          <a
            href={`/installation/requests/${row.id}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-md bg-[var(--brand)]/10 px-2.5 py-1 text-xs font-medium text-[var(--brand)] hover:bg-[var(--brand)]/20"
          >
            {label}
          </a>
        );
      },
    },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Installation & Commissioning"
        description="Manage installation requests and completion records"
        breadcrumbs={[{ label: 'Command Center', href: '/command' }, { label: 'Installation' }]}
        actions={
          activeTab === 'requests' ? (
            <Button onClick={() => router.push('/installation/requests/new')}>
              <Plus className="h-4 w-4" />
              New Installation Request
            </Button>
          ) : (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Installation / Commissioning Record
            </Button>
          )
        }
      />

      {/* Tabs */}
      <div className="panel-surface overflow-hidden rounded-xl">
        <div className="flex border-b border-[var(--surface-3)]">
          {([
            { id: 'requests' as const, label: 'Installation Requests', count: requests.length, Icon: ClipboardList },
            { id: 'records' as const, label: 'Commissioning Records', count: records.length, Icon: Package },
          ]).map(({ id, label, count, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors -mb-px ${
                activeTab === id
                  ? 'border-[var(--brand)] text-[var(--foreground)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              <span className={`rounded-full px-2 py-px text-[11px] ${activeTab === id ? 'bg-[var(--brand)]/20 text-[var(--brand)]' : 'bg-[var(--surface-3)] text-[var(--text-muted)]'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'requests' ? (
            <DataTable<InstallationRequestRow>
              columns={requestColumns}
              data={requests}
              searchPlaceholder="Search installation requests..."
              emptyMessage="No installation requests found. Click New Installation Request to create one."
              onRowClick={(row) => router.push(`/installation/requests/${row.id}`)}
            />
          ) : (
            <DataTable<InstallationRow>
              columns={recordColumns}
              data={records}
              searchPlaceholder="Search installation records..."
              emptyMessage="No installation records found"
            />
          )}
        </div>
      </div>

      {/* Add Installation Record Modal (records tab only) */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title="Add Installation / Commissioning Record"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSubmit} loading={submitting}>Create Record</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">
            Record completed installation/commissioning evidence. To request new installation, use the{' '}
            <Link href="/installation/requests/new" className="text-[var(--brand)] hover:underline">Installation Requests</Link> tab.
          </p>
          <Select
            label="Asset *"
            options={assets.map((a) => ({ value: a.id, label: `${a.asset_code} — ${a.name}` }))}
            placeholder="Select asset"
            value={formAssetId}
            onChange={(e) => setFormAssetId(e.target.value)}
          />
          <Input
            label="Installed By"
            value={formInstalledBy}
            onChange={(e) => setFormInstalledBy(e.target.value)}
            placeholder="Name of installer / company"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Installation Date *" type="date" value={formInstallDate} onChange={(e) => setFormInstallDate(e.target.value)} />
            <Input label="Commissioning Date" type="date" value={formCommissionDate} onChange={(e) => setFormCommissionDate(e.target.value)} />
            <Input label="Go-Live Date" type="date" value={formGoLiveDate} onChange={(e) => setFormGoLiveDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="training-done" checked={formTrainingDone} onChange={(e) => setFormTrainingDone(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <label htmlFor="training-done" className="text-sm font-medium text-gray-700 dark:text-gray-300">Initial training completed</label>
          </div>
          <Textarea label="Notes" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Additional notes..." />
        </div>
      </Modal>
    </div>
  );
}
