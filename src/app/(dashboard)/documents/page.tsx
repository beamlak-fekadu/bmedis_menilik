'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Upload, Download, Trash2, Eye } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { getDocuments, uploadDocument, deleteDocument } from '@/services/documents.service';
import { getEquipmentList } from '@/services/equipment.service';
import type { EquipmentDocument, DocumentType, EquipmentAsset } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

type DocumentRow = EquipmentDocument & { [key: string]: unknown };

const DOCUMENT_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'specification', label: 'Specification' },
  { value: 'sop', label: 'SOP' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'service_contract', label: 'Service Contract' },
  { value: 'photo', label: 'Photo' },
  { value: 'other', label: 'Other' },
];

const docTypeBadgeVariant: Record<DocumentType, 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'> = {
  manual: 'info',
  specification: 'purple',
  sop: 'success',
  certificate: 'warning',
  warranty: 'error',
  service_contract: 'default',
  photo: 'default',
  other: 'default',
};

function formatLabel(val: string) {
  return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DocumentsPage() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [assets, setAssets] = useState<EquipmentAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EquipmentDocument | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formAssetId, setFormAssetId] = useState('');
  const [formDocType, setFormDocType] = useState<DocumentType>('manual');
  const [formTitle, setFormTitle] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: assetData } = await getEquipmentList();
      const typedAssets = (assetData || []) as unknown as EquipmentAsset[];
      setAssets(typedAssets);

      const allDocs: DocumentRow[] = [];
      if (typedAssets.length > 0) {
        const results = await Promise.all(
          typedAssets.map((asset) => getDocuments(asset.id))
        );
        results.forEach((r) => {
          if (r.data) allDocs.push(...(r.data as DocumentRow[]));
        });
      }
      setDocuments(allDocs);
    } catch {
      toast('error', 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpload = async () => {
    if (!formAssetId || !formTitle || !formFile) {
      toast('warning', 'Please fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await uploadDocument(formFile, formAssetId, {
        document_type: formDocType,
        title: formTitle,
      });
      if (error) throw error;
      toast('success', 'Document uploaded successfully');
      setUploadOpen(false);
      resetForm();
      loadData();
    } catch {
      toast('error', 'Failed to upload document');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const { error } = await deleteDocument(deleteTarget.id);
      if (error) throw error;
      toast('success', 'Document deleted');
      setDeleteTarget(null);
      loadData();
    } catch {
      toast('error', 'Failed to delete document');
    } finally {
      setSubmitting(false);
    }
  };

  const handleView = async (doc: EquipmentDocument) => {
    const supabase = createClient();
    const { data } = supabase.storage
      .from('equipment-documents')
      .getPublicUrl(doc.file_path);
    if (data?.publicUrl) window.open(data.publicUrl, '_blank');
  };

  const resetForm = () => {
    setFormAssetId('');
    setFormDocType('manual');
    setFormTitle('');
    setFormFile(null);
  };

  const assetMap = new Map(assets.map((a) => [a.id, a]));

  const columns = [
    { key: 'title', header: 'Title', sortable: true },
    {
      key: 'document_type',
      header: 'Type',
      sortable: true,
      render: (row: EquipmentDocument) => (
        <Badge variant={docTypeBadgeVariant[row.document_type]}>
          {formatLabel(row.document_type)}
        </Badge>
      ),
    },
    {
      key: 'asset_id',
      header: 'Asset',
      render: (row: EquipmentDocument) => {
        const asset = assetMap.get(row.asset_id || '');
        return asset ? (
          <Link href={`/inventory/${asset.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
            {asset.name}
          </Link>
        ) : '—';
      },
    },
    {
      key: 'file_size',
      header: 'Size',
      render: (row: EquipmentDocument) =>
        row.file_size ? `${(row.file_size / 1024).toFixed(1)} KB` : '—',
    },
    {
      key: 'created_at',
      header: 'Uploaded',
      sortable: true,
      render: (row: EquipmentDocument) => new Date(row.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: EquipmentDocument) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleView(row)} title="View">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleView(row)} title="Download">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(row)} title="Delete">
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Document Repository"
        description="Manage equipment manuals, certificates, and other documents"
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" />
            Upload Document
          </Button>
        }
      />

      <DataTable<DocumentRow>
        columns={columns}
        data={documents}
        searchPlaceholder="Search documents..."
        emptyMessage="No documents uploaded yet"
      />

      <Modal
        open={uploadOpen}
        onClose={() => { setUploadOpen(false); resetForm(); }}
        title="Upload Document"
        footer={
          <>
            <Button variant="outline" onClick={() => { setUploadOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleUpload} loading={submitting}>Upload</Button>
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
          <Select
            label="Document Type *"
            options={DOCUMENT_TYPE_OPTIONS}
            value={formDocType}
            onChange={(e) => setFormDocType(e.target.value as DocumentType)}
          />
          <Input
            label="Title *"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Enter document title"
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              File *
            </label>
            <input
              type="file"
              onChange={(e) => setFormFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:text-gray-400 dark:file:bg-blue-900/30 dark:file:text-blue-400"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Document"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={submitting}
      />
    </div>
  );
}
