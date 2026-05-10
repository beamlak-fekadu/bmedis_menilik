import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/ui';
import { requireRole } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { SpecificationRequestActions } from './_components/SpecificationRequestActions';

type RawRow = Record<string, unknown>;

function asText(value: unknown, fallback = '—') {
  const text = String(value ?? '').trim();
  return text ? text : fallback;
}

function asOptionalText(value: unknown) {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function formatLabel(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return '—';
  return text.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value: unknown) {
  if (!value) return '—';
  try { return new Date(String(value)).toLocaleDateString(); } catch { return String(value); }
}

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' {
  if (status === 'completed') return 'success';
  if (status === 'rejected' || status === 'cancelled') return 'error';
  if (status === 'in_progress') return 'purple';
  if (status === 'in_review') return 'info';
  return 'warning';
}

export default async function SpecificationRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, profile] = await Promise.all([
    params,
    requireRole(['developer', 'admin', 'bme_head', 'technician', 'department_head', 'department_user', 'store_user', 'viewer']),
  ]);

  const supabase = await createClient();
  const { data } = await supabase.from('specification_requests').select('*').eq('id', id).maybeSingle();
  const row = (data ?? null) as RawRow | null;

  if (!row) {
    return (
      <div className="space-y-4">
        <Link href="/documents" className="inline-flex items-center gap-1 text-sm text-[var(--brand)]">
          <ArrowLeft className="h-4 w-4" /> Documents
        </Link>
        <Card>
          <CardHeader><CardTitle>Specification Request not found</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--text-muted)]">This specification request does not exist or has been removed.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const assetId = asOptionalText(row.asset_id);
  const requesterId = asOptionalText(row.requested_by);
  const assigneeId = asOptionalText(row.assigned_to);
  const departmentId = asOptionalText(row.department_id);
  const procurementRequestId = asOptionalText(row.procurement_request_id);
  const replacementCandidateAssetId = asOptionalText(row.replacement_candidate_asset_id);
  const linkedDocumentId = asOptionalText(row.linked_document_id);

  const [assetRes, requesterRes, assigneeRes, departmentRes, procurementRes, replacementAssetRes] = await Promise.all([
    assetId ? supabase.from('equipment_assets').select('id, asset_code, name').eq('id', assetId).maybeSingle() : Promise.resolve({ data: null }),
    requesterId ? supabase.from('profiles').select('id, full_name, email').eq('id', requesterId).maybeSingle() : Promise.resolve({ data: null }),
    assigneeId ? supabase.from('profiles').select('id, full_name, email').eq('id', assigneeId).maybeSingle() : Promise.resolve({ data: null }),
    departmentId ? supabase.from('departments').select('id, name').eq('id', departmentId).maybeSingle() : Promise.resolve({ data: null }),
    procurementRequestId ? supabase.from('procurement_requests').select('id, request_number, title').eq('id', procurementRequestId).maybeSingle() : Promise.resolve({ data: null }),
    replacementCandidateAssetId ? supabase.from('equipment_assets').select('id, asset_code, name').eq('id', replacementCandidateAssetId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const asset = assetRes.data as RawRow | null;
  const requester = requesterRes.data as RawRow | null;
  const assignee = assigneeRes.data as RawRow | null;
  const department = departmentRes.data as RawRow | null;
  const procurementRequest = procurementRes.data as RawRow | null;
  const replacementAsset = replacementAssetRes.data as RawRow | null;
  const requestNumber = asText(row.request_number, id);
  const title = asText(row.title, 'Specification request');
  const status = asText(row.status, 'submitted');
  const priority = asText(row.priority, 'medium');
  const purpose = asOptionalText(row.purpose);
  const equipmentCategory = asOptionalText(row.equipment_category);
  const requestedEquipmentName = asOptionalText(row.requested_equipment_name);
  const notes = asOptionalText(row.notes);
  const canMutate = (profile.roleNames as string[]).some((r) => ['developer', 'admin', 'bme_head', 'technician'].includes(r));

  return (
    <div className="space-y-6">
      <Link href="/documents" className="inline-flex items-center gap-1 text-sm text-[var(--brand)]">
        <ArrowLeft className="h-4 w-4" /> Documents
      </Link>
      <PageHeader
        title={requestNumber}
        description="Specification Request"
        breadcrumbs={[
          { label: 'Documents', href: '/documents' },
          { label: 'Specification Requests', href: '/documents?tab=specification-requests' },
          { label: requestNumber },
        ]}
        actions={
          <Link
            href={`/requests/specification/${id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)]"
          >
            <ExternalLink className="h-4 w-4" />
            View in Requests Hub
          </Link>
        }
      />

      {/* Status strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-xs text-[var(--text-muted)]">Status</CardTitle></CardHeader>
          <CardContent><Badge variant={statusVariant(status)}>{formatLabel(status)}</Badge></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-xs text-[var(--text-muted)]">Priority</CardTitle></CardHeader>
          <CardContent><span className="font-semibold">{formatLabel(priority)}</span></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-xs text-[var(--text-muted)]">Required By</CardTitle></CardHeader>
          <CardContent><span className="font-semibold">{formatDate(row.required_by)}</span></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-xs text-[var(--text-muted)]">Assigned To</CardTitle></CardHeader>
          <CardContent><span className="font-semibold">{assignee ? asText(assignee.full_name ?? assignee.email) : 'Unassigned'}</span></CardContent>
        </Card>
      </div>

      {/* Details */}
      <Card>
        <CardHeader><CardTitle>Specification Request Details</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Request Number</dt>
              <dd className="font-medium">{requestNumber}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Title</dt>
              <dd className="font-medium">{title}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Submitted By</dt>
              <dd className="font-medium">{requester ? asText(requester.full_name ?? requester.email) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Department</dt>
              <dd className="font-medium">{department ? asText(department.name) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Procurement Request</dt>
              <dd className="font-medium">
                {procurementRequest ? `${asText(procurementRequest.request_number)} — ${asText(procurementRequest.title)}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Related Asset</dt>
              <dd className="font-medium">
                {asset
                  ? <Link href={`/equipment/${assetId}`} className="text-[var(--brand)] hover:underline">{asText(asset.asset_code)} — {asText(asset.name)}</Link>
                  : requestedEquipmentName ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Equipment Category</dt>
              <dd className="font-medium">{equipmentCategory ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Replacement Candidate</dt>
              <dd className="font-medium">
                {replacementAsset ? `${asText(replacementAsset.asset_code)} — ${asText(replacementAsset.name)}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Submitted</dt>
              <dd className="font-medium">{formatDate(row.created_at)}</dd>
            </div>
            {purpose ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs text-[var(--text-muted)]">Purpose / Context</dt>
                <dd className="whitespace-pre-wrap text-sm">{purpose}</dd>
              </div>
            ) : null}
            {notes ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs text-[var(--text-muted)]">Notes</dt>
                <dd className="whitespace-pre-wrap text-sm">{notes}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      {/* Actions */}
      {canMutate && (
        <SpecificationRequestActions requestId={id} currentStatus={status} />
      )}

      {/* Linked document if completed */}
      {linkedDocumentId ? (
        <Card>
          <CardHeader><CardTitle>Linked Specification Document</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--text-muted)]">
              Document ID: {linkedDocumentId}.{' '}
              <Link href="/documents" className="text-[var(--brand)] hover:underline">View in Documents →</Link>
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Upload prompt if no document yet */}
      {canMutate && !linkedDocumentId && status !== 'rejected' && status !== 'cancelled' ? (
        <Card>
          <CardHeader><CardTitle>Specification Document</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--text-muted)] mb-3">
              No specification document has been linked yet. When ready, upload the specification document via the Documents module.
            </p>
            <Link
              href={`/documents?action=upload-specification&document_type=specification&source=spec-request&specRequestId=${id}`}
              className="inline-flex items-center rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Upload Specification Document
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
