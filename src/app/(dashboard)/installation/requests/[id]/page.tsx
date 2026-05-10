import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/ui';
import { requireRole } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { InstallationRequestActions } from './_components/InstallationRequestActions';

type RawRow = Record<string, unknown>;

function asText(value: unknown, fallback = '—') {
  const text = String(value ?? '').trim();
  return text ? text : fallback;
}

function asOptionalText(value: unknown) {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function asBoolean(value: unknown) {
  return value === true;
}

function formatLabel(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return '—';
  return text.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value: unknown) {
  if (!value) return '—';
  try {
    return new Date(String(value)).toLocaleDateString();
  } catch {
    return String(value);
  }
}

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' {
  if (status === 'completed') return 'success';
  if (status === 'rejected' || status === 'cancelled') return 'error';
  if (status === 'in_progress') return 'purple';
  if (status === 'approved' || status === 'scheduled' || status === 'assigned') return 'info';
  return 'warning';
}

export default async function InstallationRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, profile] = await Promise.all([
    params,
    requireRole(['developer', 'admin', 'bme_head', 'technician', 'department_head', 'department_user', 'store_user', 'viewer']),
  ]);

  const supabase = await createClient();
  const { data } = await supabase
    .from('installation_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const row = (data ?? null) as RawRow | null;

  if (!row) {
    return (
      <div className="space-y-4">
        <Link href="/installation" className="inline-flex items-center gap-1 text-sm text-[var(--brand)]">
          <ArrowLeft className="h-4 w-4" /> Installation
        </Link>
        <Card>
          <CardHeader><CardTitle>Installation Request not found</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--text-muted)]">This installation request does not exist or has been removed.</p>
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
  const installationRecordId = asOptionalText(row.installation_record_id);

  const [assetRes, requesterRes, assigneeRes, departmentRes, procurementRes] = await Promise.all([
    assetId
      ? supabase.from('equipment_assets').select('id, asset_code, name').eq('id', assetId).maybeSingle()
      : Promise.resolve({ data: null }),
    requesterId
      ? supabase.from('profiles').select('id, full_name, email').eq('id', requesterId).maybeSingle()
      : Promise.resolve({ data: null }),
    assigneeId
      ? supabase.from('profiles').select('id, full_name, email').eq('id', assigneeId).maybeSingle()
      : Promise.resolve({ data: null }),
    departmentId
      ? supabase.from('departments').select('id, name').eq('id', departmentId).maybeSingle()
      : Promise.resolve({ data: null }),
    procurementRequestId
      ? supabase.from('procurement_requests').select('id, request_number, title').eq('id', procurementRequestId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const asset = assetRes.data as RawRow | null;
  const requester = requesterRes.data as RawRow | null;
  const assignee = assigneeRes.data as RawRow | null;
  const department = departmentRes.data as RawRow | null;
  const procurementRequest = procurementRes.data as RawRow | null;
  const requestNumber = asText(row.request_number, id);
  const status = asText(row.status, 'submitted');
  const priority = asText(row.priority, 'medium');
  const equipmentName = asOptionalText(row.equipment_name);
  const vendor = asOptionalText(row.vendor);
  const installationReason = asText(row.installation_reason);
  const notes = asOptionalText(row.notes);
  const commissioningRequired = asBoolean(row.commissioning_required);
  const userTrainingRequired = asBoolean(row.user_training_required);
  const canMutate = (profile.roleNames as string[]).some((r) => ['developer', 'admin', 'bme_head', 'technician'].includes(r));

  return (
    <div className="space-y-6">
      <Link href="/installation" className="inline-flex items-center gap-1 text-sm text-[var(--brand)]">
        <ArrowLeft className="h-4 w-4" /> Installation
      </Link>
      <PageHeader
        title={requestNumber}
        description="Installation Request"
        breadcrumbs={[
          { label: 'Installation', href: '/installation' },
          { label: requestNumber },
        ]}
        actions={
          <Link
            href={`/requests/installation/${id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)]"
          >
            <ExternalLink className="h-4 w-4" />
            View in Requests Hub
          </Link>
        }
      />

      {/* Status + quick facts */}
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
          <CardHeader><CardTitle className="text-xs text-[var(--text-muted)]">Commissioning</CardTitle></CardHeader>
          <CardContent><span className="font-semibold">{commissioningRequired ? 'Required' : 'Not required'}</span></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-xs text-[var(--text-muted)]">Training</CardTitle></CardHeader>
          <CardContent><span className="font-semibold">{userTrainingRequired ? 'Required' : 'Not required'}</span></CardContent>
        </Card>
      </div>

      {/* Main details */}
      <Card>
        <CardHeader><CardTitle>Request Details</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Request Number</dt>
              <dd className="font-medium">{requestNumber}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Registered Asset</dt>
              <dd className="font-medium">
                {asset
                  ? <Link href={`/equipment/${assetId}`} className="text-[var(--brand)] hover:underline">{asText(asset.asset_code)} — {asText(asset.name)}</Link>
                  : equipmentName ?? '—'}
              </dd>
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
              <dt className="text-xs text-[var(--text-muted)]">Vendor / Supplier</dt>
              <dd className="font-medium">{vendor ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Submitted By</dt>
              <dd className="font-medium">{requester ? asText(requester.full_name ?? requester.email) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Assigned To</dt>
              <dd className="font-medium">{assignee ? asText(assignee.full_name ?? assignee.email) : 'Unassigned'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Received Date</dt>
              <dd className="font-medium">{formatDate(row.received_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Requested Installation</dt>
              <dd className="font-medium">{formatDate(row.requested_installation_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Target Go-Live</dt>
              <dd className="font-medium">{formatDate(row.target_go_live_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Submitted</dt>
              <dd className="font-medium">{formatDate(row.created_at)}</dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-xs text-[var(--text-muted)]">Installation Reason</dt>
              <dd className="whitespace-pre-wrap text-sm">{installationReason}</dd>
            </div>
            {notes ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs text-[var(--text-muted)]">Notes</dt>
                <dd className="whitespace-pre-wrap text-sm">{notes}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      {/* Actions for BME/admin */}
      {canMutate && (
        <InstallationRequestActions requestId={id} currentStatus={status} />
      )}

      {/* Link to installation record if completed */}
      {installationRecordId ? (
        <Card>
          <CardHeader><CardTitle>Installation Record</CardTitle></CardHeader>
          <CardContent>
            <Link
              href={`/installation?tab=records&installationId=${installationRecordId}`}
              className="text-sm text-[var(--brand)] hover:underline"
            >
              View Installation / Commissioning Record →
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
