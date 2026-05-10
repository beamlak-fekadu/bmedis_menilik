'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, Download, Trash2, Eye, FileSearch, FolderOpen } from 'lucide-react';
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
import { getDocuments } from '@/services/documents.service';
import { deleteDocumentAction, uploadDocumentAction } from '@/actions/documents.actions';
import { getEquipmentList } from '@/services/equipment.service';
import type { EquipmentDocument, DocumentType, EquipmentAsset } from '@/types/domain';
import { createClient } from '@/lib/supabase/client';

type DocumentRow = EquipmentDocument & { [key: string]: unknown };

type SpecRequestRow = {
  id: string;
  request_number: string;
  title: string;
  status: string;
  priority: string;
  required_by: string | null;
  created_at: string;
  linked_document_id: string | null;
  equipment_category: string | null;
  [key: string]: unknown;
};

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

function specStatusVariant(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' {
  if (status === 'completed') return 'success';
  if (status === 'rejected' || status === 'cancelled') return 'error';
  if (status === 'in_progress') return 'purple';
  if (status === 'in_review') return 'info';
  return 'warning';
}

export default function DocumentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const defaultTab = tabParam === 'specification-requests' || tabParam === 'spec-requests' ? 'spec-requests' : 'documents';

  const [activeTab, setActiveTab] = useState<'documents' | 'spec-requests'>(defaultTab);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [specRequests, setSpecRequests] = useState<SpecRequestRow[]>([]);
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
      const supabase = createClient();
      const { data: assetData } = await getEquipmentList();
      const typedAssets = (assetData || []) as unknown as EquipmentAsset[];
      setAssets(typedAssets);

      const allDocs: DocumentRow[] = [];
      if (typedAssets.length > 0) {
        const results = await Promise.all(typedAssets.map((asset) => getDocuments(asset.id)));
        results.forEach((r) => { if (r.data) allDocs.push(...(r.data as DocumentRow[])); });
      }
      setDocuments(allDocs);

      const specRes = await supabase
        .from('specification_requests')
        .select('id, request_number, title, status, priority, required_by, created_at, linked_document_id, equipment_category')
        .order('created_at', { ascending: false });
      setSpecRequests((specRes.data ?? []) as unknown as SpecRequestRow[]);
    } catch {
      toast('error', 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (searchParams.get('action') === 'upload-specification' || searchParams.get('uploadType') === 'specification') {
      setFormDocType('specification');
      setUploadOpen(true);
    }
  }, [searchParams]);

  const handleUpload = async () => {
    if (!formAssetId || !formTitle || !formFile) {
      toast('warning', 'Please fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('assetId', formAssetId);
      formData.append('document_type', formDocType);
      formData.append('title', formTitle);
      formData.append('file', formFile);
      const result = await uploadDocumentAction(formData);
      if (!result.success) throw new Error(result.error ?? 'Failed to upload document');
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
      const result = await deleteDocumentAction(deleteTarget.id);
      if (!result.success) throw new Error(result.error ?? 'Failed to delete document');
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
    const { data } = supabase.storage.from('equipment-documents').getPublicUrl(doc.file_path);
    if (data?.publicUrl) window.open(data.publicUrl, '_blank');
  };

  const resetForm = () => {
    setFormAssetId('');
    setFormDocType('manual');
    setFormTitle('');
    setFormFile(null);
  };

  const assetMap = new Map(assets.map((a) => [a.id, a]));

  const documentColumns = [
    { key: 'title', header: 'Title', sortable: true },
    {
      key: 'document_type',
      header: 'Type',
      sortable: true,
      render: (row: EquipmentDocument) => (
        <Badge variant={docTypeBadgeVariant[row.document_type]}>{formatLabel(row.document_type)}</Badge>
      ),
    },
    {
      key: 'asset_id',
      header: 'Asset',
      render: (row: EquipmentDocument) => {
        const asset = assetMap.get(row.asset_id || '');
        return asset ? (
          <Link href={`/equipment/${asset.id}`} className="text-blue-600 hover:underline dark:text-blue-400">{asset.name}</Link>
        ) : '—';
      },
    },
    {
      key: 'file_size',
      header: 'Size',
      render: (row: EquipmentDocument) => row.file_size ? `${(row.file_size / 1024).toFixed(1)} KB` : '—',
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
          <Button variant="ghost" size="icon" onClick={() => handleView(row)} title="View"><Eye className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => handleView(row)} title="Download"><Download className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(row)} title="Delete"><Trash2 className="h-4 w-4 text-red-500" /></Button>
        </div>
      ),
    },
  ];

  const specRequestColumns = [
    {
      key: 'request_number',
      header: 'Request #',
      sortable: true,
      render: (row: SpecRequestRow) => (
        <Link href={`/documents/specification-requests/${row.id}`} className="font-medium text-[var(--brand)] hover:underline" onClick={(e) => e.stopPropagation()}>
          {row.request_number}
        </Link>
      ),
    },
    { key: 'title', header: 'Title', sortable: true },
    {
      key: 'equipment_category',
      header: 'Category',
      render: (row: SpecRequestRow) => row.equipment_category ?? '—',
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (row: SpecRequestRow) => formatLabel(row.priority),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row: SpecRequestRow) => <Badge variant={specStatusVariant(row.status)}>{formatLabel(row.status)}</Badge>,
    },
    {
      key: 'required_by',
      header: 'Required By',
      render: (row: SpecRequestRow) => row.required_by ? new Date(row.required_by).toLocaleDateString() : '—',
    },
    {
      key: 'linked_document',
      header: 'Document',
      render: (row: SpecRequestRow) =>
        row.linked_document_id
          ? <span className="text-xs font-medium text-emerald-400">Linked</span>
          : <span className="text-xs text-[var(--text-muted)]">Pending</span>,
    },
    {
      key: 'action',
      header: 'Action',
      render: (row: SpecRequestRow) => {
        const label = row.linked_document_id ? 'Retrieve' : row.status === 'submitted' ? 'Review' : row.status === 'in_progress' ? 'Upload Doc' : 'View';
        return (
          <Link
            href={`/documents/specification-requests/${row.id}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-md bg-[var(--brand)]/10 px-2.5 py-1 text-xs font-medium text-[var(--brand)] hover:bg-[var(--brand)]/20"
          >
            {label}
          </Link>
        );
      },
    },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents & Specifications"
        description="Document repository and specification request tracking"
        breadcrumbs={[{ label: 'Command Center', href: '/command' }, { label: 'Documents' }]}
        actions={
          activeTab === 'documents' ? (
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" />
              Upload Document
            </Button>
          ) : (
            <Button onClick={() => router.push('/documents/specification-requests/new')}>
              <FileSearch className="h-4 w-4" />
              New Specification Request
            </Button>
          )
        }
      />

      {/* Tabs */}
      <div className="panel-surface overflow-hidden rounded-xl">
        <div className="flex border-b border-[var(--surface-3)]">
          {([
            { id: 'documents' as const, label: 'Document Repository', count: documents.length, Icon: FolderOpen },
            { id: 'spec-requests' as const, label: 'Specification Requests', count: specRequests.length, Icon: FileSearch },
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
          {activeTab === 'documents' ? (
            <DataTable<DocumentRow>
              columns={documentColumns}
              data={documents}
              searchPlaceholder="Search documents..."
              emptyMessage="No documents uploaded yet"
            />
          ) : (
            <DataTable<SpecRequestRow>
              columns={specRequestColumns}
              data={specRequests}
              searchPlaceholder="Search specification requests..."
              emptyMessage="No specification requests yet. Click New Specification Request to create one."
              onRowClick={(row) => router.push(`/documents/specification-requests/${row.id}`)}
            />
          )}
        </div>
      </div>

      {/* Upload Document Modal */}
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
          <Input label="Title *" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Enter document title" />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">File *</label>
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
