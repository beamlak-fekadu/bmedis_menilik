import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/ui';
import { RefreshButton } from '../_components/RefreshButton';

function row(label: string, value: string | number) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-medium text-[var(--foreground)]">{value}</span>
    </div>
  );
}

export default async function CommandHealthPage() {
  await requireRole(['admin']);
  const supabase = await createClient();

  const [activeAssets, riskCoverage, openTriage, readinessRows, replacementCount, flagRows, lastRefreshRes] = await Promise.all([
    supabase.from('equipment_assets').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'active'),
    supabase.from('equipment_risk_scores').select('asset_id').limit(5000),
    supabase.from('triage_action_queue').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('clinical_readiness_snapshots').select('department_id, snapshot_date').order('snapshot_date', { ascending: false }).limit(1000),
    supabase.from('replacement_priority_scores').select('id', { count: 'exact', head: true }),
    supabase.from('recommendation_flags').select('id, is_acknowledged'),
    supabase.from('decision_support_refresh_log').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const activeAssetCount = activeAssets.count ?? 0;
  const riskDistinct = new Set((riskCoverage.data ?? []).map((r) => r.asset_id)).size;
  const openTriageCount = openTriage.count ?? 0;
  const latestSnapshotDate = readinessRows.data?.[0]?.snapshot_date ?? null;
  const readinessDeptCount = latestSnapshotDate
    ? (readinessRows.data ?? []).filter((r) => r.snapshot_date === latestSnapshotDate).length
    : 0;
  const replacementCandidates = replacementCount.count ?? 0;
  const totalFlags = (flagRows.data ?? []).length;
  const ackFlags = (flagRows.data ?? []).filter((f) => f.is_acknowledged).length;
  const unackFlags = totalFlags - ackFlags;
  const lastRefresh = lastRefreshRes.data;

  const warnings = [
    activeAssetCount !== 80 ? `Active assets expected 80, found ${activeAssetCount}` : null,
    riskDistinct < activeAssetCount ? `Risk score coverage below active assets (${riskDistinct}/${activeAssetCount})` : null,
    readinessDeptCount < 8 ? `Department readiness below target: ${readinessDeptCount}/8` : null,
    replacementCandidates < 8 ? `Replacement candidates below target: ${replacementCandidates}/8` : null,
    totalFlags < 16 ? `Raw recommendation flags below target: ${totalFlags}/16` : null,
    !lastRefresh ? 'No refresh log entries found' : null,
    lastRefresh?.status === 'error' ? 'Latest refresh status is error' : null,
    null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <PageHeader title="Decision Support Health" description="Admin diagnostics for decision-support completeness and freshness." actions={<RefreshButton />} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card><CardHeader><CardTitle>Coverage</CardTitle></CardHeader><CardContent className="space-y-2">{row('Active assets', activeAssetCount)}{row('Risk coverage', `${riskDistinct}/${activeAssetCount}`)}{row('Open triage items', openTriageCount)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Readiness & Replacement</CardTitle></CardHeader><CardContent className="space-y-2">{row('Latest readiness date', latestSnapshotDate ?? '—')}{row('Departments covered', readinessDeptCount)}{row('Replacement candidates', replacementCandidates)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Flags & Refresh</CardTitle></CardHeader><CardContent className="space-y-2">{row('Raw flags', totalFlags)}{row('Acknowledged', ackFlags)}{row('Unacknowledged', unackFlags)}{row('Last refresh', lastRefresh?.started_at ? new Date(lastRefresh.started_at).toLocaleString() : '—')}<div className="pt-1"><Badge variant={lastRefresh?.status === 'error' ? 'error' : 'success'}>{lastRefresh?.status ?? 'none'}</Badge></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Validation Warnings</CardTitle></CardHeader>
        <CardContent>
          {warnings.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-300"><CheckCircle2 className="h-4 w-4" /> All configured health checks passed.</div>
          ) : (
            <ul className="space-y-2">
              {warnings.map((w) => (
                <li key={w} className="flex items-start gap-2 text-sm text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />{w}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
