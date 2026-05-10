import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/ui';
import { requireRole } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import type { RequestHubType } from '../../_lib/requests-hub-data';

type RawRow = Record<string, unknown>;

const TYPE_LABELS: Record<RequestHubType, string> = {
  maintenance: 'Corrective Maintenance Request',
  calibration: 'Calibration Request',
  training: 'Training Request',
  procurement: 'Procurement Request',
  disposal: 'Disposal Request',
  installation: 'Installation Request',
  specification: 'Specification Request',
};

const VALID_TYPES: RequestHubType[] = ['maintenance', 'calibration', 'training', 'procurement', 'disposal', 'installation', 'specification'];

function formatLabel(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return 'Not recorded';
  return text.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: unknown) {
  if (!value) return 'Not recorded';
  return new Date(String(value)).toLocaleString();
}

function workflowHref(type: RequestHubType, id: string) {
  if (type === 'maintenance') return `/maintenance/requests/${id}`;
  if (type === 'procurement') return `/command/drilldown/procurement/${id}`;
  if (type === 'calibration') return `/calibration?requestId=${id}&source=requests-hub`;
  if (type === 'training') return `/training?requestId=${id}&source=requests-hub`;
  if (type === 'disposal') return `/disposal?requestId=${id}&source=requests-hub`;
  if (type === 'installation') return `/installation/requests/${id}`;
  return `/documents/specification-requests/${id}`;
}

async function fetchRequestRow(type: RequestHubType, id: string) {
  const supabase = await createClient();
  if (type === 'maintenance') {
    return supabase.from('maintenance_requests').select('id, request_number, asset_id, requested_by, department_id, fault_description, urgency, status, notes, created_at, updated_at').eq('id', id).maybeSingle();
  }
  if (type === 'calibration') {
    return supabase.from('calibration_requests').select('id, request_number, asset_id, requested_by, calibration_type_id, urgency, status, notes, created_at, updated_at').eq('id', id).maybeSingle();
  }
  if (type === 'training') {
    return supabase.from('training_requests').select('id, request_number, asset_id, requested_by, department_id, training_type, description, status, notes, created_at, updated_at').eq('id', id).maybeSingle();
  }
  if (type === 'procurement') {
    return supabase.from('procurement_requests').select('id, request_number, title, justification, status, priority, requested_by, department_id, expected_delivery_date, created_at').eq('id', id).maybeSingle();
  }
  if (type === 'disposal') {
    return supabase.from('disposal_requests').select('id, request_number, asset_id, requested_by, reason, disposal_method_proposed, status, approved_by, approved_at, notes, created_at, updated_at').eq('id', id).maybeSingle();
  }
  if (type === 'installation') {
    return supabase.from('installation_requests').select('id, request_number, asset_id, procurement_request_id, requested_by, department_id, equipment_name, asset_code_hint, vendor, status, priority, installation_reason, commissioning_required, user_training_required, received_date, requested_installation_date, target_go_live_date, assigned_to, installation_record_id, notes, created_at, updated_at').eq('id', id).maybeSingle();
  }
  if (type === 'specification') {
    return supabase.from('specification_requests').select('id, request_number, asset_id, procurement_request_id, replacement_candidate_asset_id, requested_by, department_id, title, purpose, equipment_category, requested_equipment_name, status, priority, required_by, assigned_to, linked_document_id, notes, created_at, updated_at').eq('id', id).maybeSingle();
  }
  return { data: null, error: null };
}

export default async function RequestDetailPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const [{ type, id }, profile] = await Promise.all([
    params,
    requireRole(['developer', 'admin', 'bme_head', 'technician', 'department_head', 'department_user', 'store_user', 'viewer']),
  ]);
  const requestType = type as RequestHubType;
  if (!VALID_TYPES.includes(requestType)) {
    return (
      <div className="space-y-4">
        <Link href="/requests" className="inline-flex items-center gap-1 text-sm text-[var(--brand)]"><ArrowLeft className="h-4 w-4" /> Requests Hub</Link>
        <p className="text-sm text-[var(--text-muted)]">Request type not found.</p>
      </div>
    );
  }

  const { data } = await fetchRequestRow(requestType, id);
  const row = (data ?? null) as RawRow | null;

  if (!row) {
    return (
      <div className="space-y-4">
        <Link href="/requests" className="inline-flex items-center gap-1 text-sm text-[var(--brand)]"><ArrowLeft className="h-4 w-4" /> Requests Hub</Link>
        <Card>
          <CardHeader><CardTitle>{TYPE_LABELS[requestType]} not found</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--text-muted)]">
              This category does not currently have a formal request record for this identifier. Use the module workflow for the latest status.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const [assetRes, departmentRes, requesterRes] = await Promise.all([
    row.asset_id ? supabase.from('equipment_assets').select('id, asset_code, name, department_id').eq('id', String(row.asset_id)).maybeSingle() : Promise.resolve({ data: null }),
    row.department_id ? supabase.from('departments').select('id, name').eq('id', String(row.department_id)).maybeSingle() : Promise.resolve({ data: null }),
    row.requested_by ? supabase.from('profiles').select('id, full_name, email').eq('id', String(row.requested_by)).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const asset = (assetRes.data ?? null) as RawRow | null;
  const department = (departmentRes.data ?? null) as RawRow | null;
  const requester = (requesterRes.data ?? null) as RawRow | null;
  const title = String(row.request_number ?? row.title ?? TYPE_LABELS[requestType]);
  const canMutate = profile.roleNames?.some((role: string) => role !== 'viewer') ?? false;

  return (
    <div className="space-y-6">
      <Link href="/requests" className="inline-flex items-center gap-1 text-sm text-[var(--brand)]"><ArrowLeft className="h-4 w-4" /> Requests Hub</Link>
      <PageHeader
        title={title}
        description={`${TYPE_LABELS[requestType]} detail and routing context`}
        actions={
          <Link href={workflowHref(requestType, id)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-strong)]">
            <ExternalLink className="h-4 w-4" />
            Open Workflow
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Request Status</CardTitle>
          <Badge variant={String(row.status ?? '').includes('completed') || String(row.status ?? '') === 'delivered' ? 'success' : 'info'}>
            {formatLabel(row.status ?? 'pending')}
          </Badge>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-xs text-[var(--text-muted)]">Type</dt><dd className="font-medium text-[var(--foreground)]">{TYPE_LABELS[requestType]}</dd></div>
            <div><dt className="text-xs text-[var(--text-muted)]">Asset</dt><dd className="font-medium text-[var(--foreground)]">{asset ? `${asset.asset_code} — ${asset.name}` : 'Not linked'}</dd></div>
            <div><dt className="text-xs text-[var(--text-muted)]">Department</dt><dd className="font-medium text-[var(--foreground)]">{department?.name ? String(department.name) : 'Not scoped'}</dd></div>
            <div><dt className="text-xs text-[var(--text-muted)]">Submitted by</dt><dd className="font-medium text-[var(--foreground)]">{requester ? String(requester.full_name ?? requester.email) : 'System / record'}</dd></div>
            <div><dt className="text-xs text-[var(--text-muted)]">Created</dt><dd className="font-medium text-[var(--foreground)]">{formatDate(row.created_at ?? row.installation_date)}</dd></div>
            <div><dt className="text-xs text-[var(--text-muted)]">Updated</dt><dd className="font-medium text-[var(--foreground)]">{formatDate(row.updated_at)}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Context</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-4">
            {Object.entries(row)
              .filter(([key]) => !['id', 'asset_id', 'requested_by', 'department_id', 'created_at', 'updated_at'].includes(key))
              .map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-[var(--text-muted)]">{formatLabel(key)}</dt>
                  <dd className="whitespace-pre-wrap text-sm text-[var(--foreground)]">{value == null || value === '' ? 'Not recorded' : String(value)}</dd>
                </div>
              ))}
          </dl>
        </CardContent>
      </Card>

      {!canMutate ? (
        <p className="text-sm text-[var(--text-muted)]">Viewer access is read-only. Use View Status / Open Workflow for evidence without mutation controls.</p>
      ) : null}
    </div>
  );
}
