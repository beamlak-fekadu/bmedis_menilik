'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
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
import type { InstallationRecord, EquipmentAsset } from '@/types/database';

type InstallationRow = InstallationRecord & {
  equipment_assets?: Array<{ id: string; asset_code: string; name: string }> | null;
  [key: string]: unknown;
};

export default function InstallationPage() {
  const { toast } = useToast();
  const [records, setRecords] = useState<InstallationRow[]>([]);
  const [assets, setAssets] = useState<EquipmentAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      const [installRes, assetRes] = await Promise.all([
        supabase
          .from('installation_records')
          .select(`
            id, asset_id, installed_by, installation_date, commissioning_date,
            acceptance_checklist, go_live_date, initial_training_done, notes, created_at, updated_at,
            equipment_assets(id, asset_code, name)
          `)
          .order('installation_date', { ascending: false }),
        getEquipmentList(),
      ]);

      setRecords((installRes.data || []) as unknown as InstallationRow[]);
      setAssets((assetRes.data || []) as unknown as EquipmentAsset[]);
    } catch {
      toast('error', 'Failed to load installation records');
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
      const supabase = createClient();
      const { error } = await supabase.from('installation_records').insert({
        asset_id: formAssetId,
        installed_by: formInstalledBy || null,
        installation_date: formInstallDate,
        commissioning_date: formCommissionDate || null,
        go_live_date: formGoLiveDate || null,
        initial_training_done: formTrainingDone,
        notes: formNotes || null,
        acceptance_checklist: [],
      });
      if (error) throw error;
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

  const columns = [
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

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Installation & Commissioning"
        description="Track equipment installation, commissioning, and go-live records"
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            New Record
          </Button>
        }
      />

      <DataTable<InstallationRow>
        columns={columns}
        data={records}
        searchPlaceholder="Search installation records..."
        emptyMessage="No installation records found"
      />

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title="New Installation Record"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSubmit} loading={submitting}>Create Record</Button>
          </>
        }
      >
        <div className="space-y-4">
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
            <Input
              label="Installation Date *"
              type="date"
              value={formInstallDate}
              onChange={(e) => setFormInstallDate(e.target.value)}
            />
            <Input
              label="Commissioning Date"
              type="date"
              value={formCommissionDate}
              onChange={(e) => setFormCommissionDate(e.target.value)}
            />
            <Input
              label="Go-Live Date"
              type="date"
              value={formGoLiveDate}
              onChange={(e) => setFormGoLiveDate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="training-done"
              checked={formTrainingDone}
              onChange={(e) => setFormTrainingDone(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="training-done" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Initial training completed
            </label>
          </div>
          <Textarea
            label="Notes"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            placeholder="Additional notes..."
          />
        </div>
      </Modal>
    </div>
  );
}
