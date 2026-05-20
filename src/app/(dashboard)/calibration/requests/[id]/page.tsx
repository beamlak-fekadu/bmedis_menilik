import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/helpers';
import CalibrationRequestActions from './_components/CalibrationRequestActions';
import AssistantPageContextBridge from '@/components/assistant/AssistantPageContextBridge';

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ action?: string }>;
type RawRow = Record<string, unknown>;

function formatLabel(value: unknown) {
  return String(value ?? 'unknown').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusVariant(status: unknown): 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' {
  if (status === 'pending') return 'warning';
  if (status === 'approved') return 'info';
  if (status === 'in_progress') return 'purple';
  if (status === 'completed') return 'success';
  if (status === 'rejected') return 'error';
  return 'default';
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3">
      <dt className="text-xs font-medium text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

export default async function CalibrationRequestDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const { action } = await searchParams;
  const supabase = await createClient();
  const profile = await requireRole(['admin', 'developer', 'bme_head', 'technician', 'viewer']);
  const canMutate = !profile.roleNames.includes('viewer');

  const { data } = await supabase
    .from('calibration_requests')
    .select(`
      id, request_number, asset_id, requested_by, calibration_type_id, urgency, status, notes, created_at, updated_at,
      equipment_assets(id, asset_code, name, departments(id, name, code), equipment_categories(id, name, criticality_level)),
      calibration_types(id, name, interval_months),
      requested_by_profile:profiles!calibration_requests_requested_by_fkey(id, full_name, email)
    `)
    .eq('id', id)
    .maybeSingle();

  if (!data) notFound();
  const row = data as RawRow;
  const asset = row.equipment_assets as RawRow | null;
  const department = asset?.departments as RawRow | null | undefined;
  const category = asset?.equipment_categories as RawRow | null | undefined;
  const calibrationType = row.calibration_types as RawRow | null;
  const requester = row.requested_by_profile as RawRow | null;

  const relatedRecord = await supabase
    .from('calibration_records')
    .select('id, calibration_date, result, next_due_date')
    .eq('asset_id', row.asset_id as string)
    .eq('calibration_type_id', (row.calibration_type_id as string | null) ?? '')
    .order('calibration_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <AssistantPageContextBridge
        moduleLabel="Calibration"
        pageLabel={`Request ${String(row.request_number ?? '')}`}
        selectedRecordType="calibration_request"
        selectedRecordId={id}
        selectedRecordLabel={String(row.request_number ?? '')}
        contextRefs={row.asset_id ? { equipmentId: row.asset_id as string } : undefined}
        pageSummary="Calibration request detail with asset, calibration type, urgency, status, requester, and any linked calibration record."
        visibleCounts={{
          status: String(row.status ?? ''),
          urgency: String(row.urgency ?? ''),
          has_linked_record: Boolean(relatedRecord.data?.id),
        }}
        pageDataHints={[
          `Status: ${formatLabel(row.status)}`,
          `Urgency: ${formatLabel(row.urgency)}`,
          asset ? `Asset: ${asset.asset_code ?? ''} ${asset.name ?? ''}` : 'Asset: unknown',
          `Calibration type: ${calibrationType?.name ?? 'General calibration'}`,
          relatedRecord.data?.id
            ? `Latest calibration record: ${String(relatedRecord.data.result ?? '')} on ${String(relatedRecord.data.calibration_date ?? '')}`
            : 'No prior calibration record found for this asset/type.',
        ]}
        availableEvidenceLinks={[
          { label: 'Calibration Request', href: `/calibration/requests/${id}`, type: 'calibration_request' },
          ...(asset?.id ? [{ label: 'Asset', href: `/equipment/${asset.id}`, type: 'equipment' }] : []),
          ...(relatedRecord.data?.id ? [{ label: 'Calibration Record', href: `/calibration/records/${relatedRecord.data.id}`, type: 'calibration_record' }] : []),
          { label: 'Calibration Center', href: '/calibration', type: 'module' },
        ]}
        quickPrompts={[
          'Summarize this calibration request.',
          'Why is this request urgent?',
          'What happens after the calibration is recorded?',
          'What evidence does the next step need?',
        ]}
      />
      <PageHeader
        title={`Calibration Request ${String(row.request_number ?? '')}`}
        description={`${asset?.asset_code ?? 'Asset'} · ${asset?.name ?? 'Unknown asset'} · ${formatLabel(row.status)}`}
        breadcrumbs={[{ label: 'Calibration', href: '/calibration' }, { label: 'Request Detail' }]}
        actions={<CalibrationRequestActions requestId={id} assetId={row.asset_id as string} calibrationTypeId={row.calibration_type_id as string | null} status={String(row.status ?? '')} canMutate={canMutate} />}
      />

      {action === 'schedule' && (
        <div className="rounded-lg border border-[var(--brand)]/40 bg-[var(--brand)]/10 p-3 text-sm text-[var(--foreground)]">
          Schedule this approved request by recording the calibration result. The form is prefilled with the asset and calibration type.
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <DetailItem label="Status" value={<Badge variant={statusVariant(row.status)}>{formatLabel(row.status)}</Badge>} />
        <DetailItem label="Urgency" value={<Badge variant={row.urgency === 'critical' ? 'error' : row.urgency === 'high' ? 'warning' : 'info'}>{formatLabel(row.urgency)}</Badge>} />
        <DetailItem label="Requested Date" value={row.created_at ? new Date(row.created_at as string).toLocaleString() : 'Unknown'} />
        <DetailItem label="Asset" value={`${asset?.asset_code ?? 'N/A'} — ${asset?.name ?? 'Unknown asset'}`} />
        <DetailItem label="Department" value={String(department?.name ?? 'No department')} />
        <DetailItem label="Calibration Type" value={String(calibrationType?.name ?? 'General calibration')} />
        <DetailItem label="Requested By" value={String(requester?.full_name ?? requester?.email ?? 'Unknown user')} />
        <DetailItem label="Asset Criticality" value={formatLabel(category?.criticality_level ?? 'routine')} />
        <DetailItem label="Updated" value={row.updated_at ? new Date(row.updated_at as string).toLocaleString() : 'Unknown'} />
      </section>

      <Card>
        <CardHeader><CardTitle>Workflow State</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-[var(--text-muted)]">
            {row.status === 'pending' && 'Pending requests need BME review before calibration work is scheduled.'}
            {row.status === 'approved' && 'Approved requests should be scheduled or converted into a calibration result record.'}
            {row.status === 'in_progress' && 'Calibration work is in progress; record the result when complete.'}
            {row.status === 'completed' && 'This request is complete and should retain linked evidence for audit.'}
            {row.status === 'rejected' && 'This request was rejected; notes should explain why calibration was not required.'}
          </p>
          {row.notes ? <p className="rounded-lg bg-[var(--surface-2)] p-3 text-[var(--foreground)]">{String(row.notes)}</p> : <p className="text-[var(--text-muted)]">No request notes were captured.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Related Calibration Evidence</CardTitle></CardHeader>
        <CardContent>
          {relatedRecord.data ? (
            <Link className="text-sm font-medium text-[var(--brand)] hover:underline" href={`/calibration/records/${String((relatedRecord.data as RawRow).id)}`}>
              Open latest calibration evidence from {new Date(String((relatedRecord.data as RawRow).calibration_date)).toLocaleDateString()}
            </Link>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">No completed calibration record is linked yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
