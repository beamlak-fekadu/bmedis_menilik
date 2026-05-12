import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/server';

type Params = Promise<{ id: string }>;
type RawRow = Record<string, unknown>;

function formatLabel(value: unknown) {
  return String(value ?? 'unknown').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3">
      <dt className="text-xs font-medium text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

export default async function CalibrationRecordDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('calibration_records')
    .select(`
      id, asset_id, calibration_type_id, calibrated_by, calibration_date, next_due_date, result, certificate_path, notes, created_at, updated_at,
      equipment_assets(id, asset_code, name, departments(id, name, code), equipment_categories(id, name, criticality_level)),
      calibration_types(id, name, interval_months)
    `)
    .eq('id', id)
    .maybeSingle();

  if (!data) notFound();
  const row = data as RawRow;
  const asset = row.equipment_assets as RawRow | null;
  const department = asset?.departments as RawRow | null | undefined;
  const calibrationType = row.calibration_types as RawRow | null;

  const prior = await supabase
    .from('calibration_records')
    .select('id, calibration_date, result, next_due_date')
    .eq('asset_id', row.asset_id as string)
    .neq('id', id)
    .order('calibration_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const request = await supabase
    .from('calibration_requests')
    .select('id, request_number, status')
    .eq('asset_id', row.asset_id as string)
    .eq('calibration_type_id', (row.calibration_type_id as string | null) ?? '')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const failedOrAdjusted = ['fail', 'adjusted'].includes(String(row.result ?? ''));
  const followUpParams = new URLSearchParams({
    assetId: String(row.asset_id),
    calibrationTypeId: String(row.calibration_type_id ?? ''),
    source: 'calibration-follow-up',
    action: 'record-result',
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calibration Evidence"
        description={`${asset?.asset_code ?? 'Asset'} · ${asset?.name ?? 'Unknown asset'} · ${formatLabel(row.result)}`}
        breadcrumbs={[{ label: 'Calibration', href: '/calibration' }, { label: 'Record Evidence' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/equipment/${row.asset_id as string}`}><Button variant="outline" size="sm">Open Asset Profile</Button></Link>
            {failedOrAdjusted && (
              <Link href={`/maintenance/requests/new?assetId=${row.asset_id as string}&source=calibration-failed&reportedCondition=needs_repair&description=${encodeURIComponent(`Calibration ${String(row.result)} for ${asset?.asset_code ?? 'asset'} requires corrective review.`)}`}>
                <Button variant="warning" size="sm">Create Maintenance Request</Button>
              </Link>
            )}
            <Link href={`/calibration/records/new?${followUpParams.toString()}`}><Button size="sm">Record Follow-up Calibration</Button></Link>
            {request.data && <Link href={`/calibration/requests/${String((request.data as RawRow).id)}`}><Button variant="outline" size="sm">Open Related Request</Button></Link>}
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-3">
        <DetailItem label="Asset" value={`${asset?.asset_code ?? 'N/A'} — ${asset?.name ?? 'Unknown asset'}`} />
        <DetailItem label="Department" value={String(department?.name ?? 'No department')} />
        <DetailItem label="Calibration Type" value={String(calibrationType?.name ?? 'General calibration')} />
        <DetailItem label="Calibration Date" value={new Date(row.calibration_date as string).toLocaleDateString()} />
        <DetailItem label="Result" value={<Badge variant={row.result === 'pass' ? 'success' : row.result === 'adjusted' ? 'warning' : 'error'}>{formatLabel(row.result)}</Badge>} />
        <DetailItem label="Next Due Date" value={row.next_due_date ? new Date(row.next_due_date as string).toLocaleDateString() : 'Not set'} />
        <DetailItem label="Calibrated By" value={String(row.calibrated_by ?? 'Unknown technician/vendor')} />
        <DetailItem label="Certificate / Reference" value={row.certificate_path ? String(row.certificate_path) : 'No certificate reference captured'} />
        <DetailItem label="Recorded" value={row.created_at ? new Date(row.created_at as string).toLocaleString() : 'Unknown'} />
      </section>

      <Card>
        <CardHeader><CardTitle>Evidence Notes</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {row.notes ? <p className="rounded-lg bg-[var(--surface-2)] p-3 text-[var(--foreground)]">{String(row.notes)}</p> : <p className="text-[var(--text-muted)]">No calibration notes were captured.</p>}
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-100">
            Failed/adjusted/overdue calibration increases detectability risk because weak calibration control makes issues harder to detect before clinical impact.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Prior Result Context</CardTitle></CardHeader>
        <CardContent className="text-sm text-[var(--text-muted)]">
          {prior.data ? (
            <p>Previous result was {formatLabel((prior.data as RawRow).result)} on {new Date(String((prior.data as RawRow).calibration_date)).toLocaleDateString()}.</p>
          ) : (
            <p>No prior calibration result is available for this asset.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
