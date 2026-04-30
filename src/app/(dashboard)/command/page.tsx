import Link from 'next/link';
import {
  AlertTriangle, ArrowUpDown, CalendarCheck, CheckCircle2,
  ClipboardList, Info, ShieldAlert, Wrench,
} from 'lucide-react';
import { getServerProfile } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/ui';
import { RefreshButton } from './_components/RefreshButton';
import { AcknowledgeButton } from './_components/AcknowledgeButton';
import { RiskBandDrilldown, type RiskBand } from './_components/RiskBandDrilldown';

// ─── types ────────────────────────────────────────────────────────────────────

interface TriageRow {
  id: string;
  flag_id: string | null;
  asset_id: string;
  asset_name: string;
  asset_code: string;
  department_name: string;
  flag_type: string;
  severity: string;
  message: string;
  score: number;
}

interface DeptReadiness {
  department_id: string;
  department_name: string;
  essential_total: number;
  essential_functional: number;
  readiness_score: number;
}

interface WorkInProgress {
  open_work_orders: number;
  in_progress: number;
  assigned: number;
  on_hold: number;
  overdue_pm: number;
  overdue_pm_gt30: number;
  calibration_due_30d: number;
}

interface RiskScoreRow {
  asset_id: string;
  asset_name: string;
  asset_code: string;
  department_name: string;
  rpn: number;
  risk_level: string;
}

interface ReplacementRow {
  asset_id: string;
  asset_name: string;
  asset_code: string;
  department_name: string;
  priority_index: number;
  rank: number;
  justification: string | null;
}

// ─── action button mapping ────────────────────────────────────────────────────

function actionForFlagType(flagType: string, assetId: string): { label: string; href: string } {
  switch (flagType) {
    case 'recurring_failure':
      return { label: 'Schedule diagnostic', href: `/maintenance?asset=${assetId}` };
    case 'replacement_candidate':
      return { label: 'Add to replacement plan', href: `/replacement?asset=${assetId}` };
    case 'part_shortage':
      return { label: 'Open procurement', href: `/procurement?asset=${assetId}` };
    case 'overdue_pm':
      return { label: 'Schedule PM', href: `/pm?asset=${assetId}` };
    case 'calibrate_soon':
      return { label: 'Schedule calibration', href: `/calibration?asset=${assetId}` };
    case 'prioritize_pm':
      return { label: 'Reschedule PM', href: `/pm?asset=${assetId}` };
    case 'monitor_closely':
      return { label: 'View details', href: `/equipment/${assetId}` };
    case 'low_availability':
      return { label: 'View maintenance history', href: `/equipment/${assetId}?tab=history` };
    default:
      return { label: 'View asset', href: `/equipment/${assetId}` };
  }
}

function severityScore(severity: string): number {
  if (severity === 'critical') return 45;
  if (severity === 'high') return 25;
  if (severity === 'medium') return 10;
  return 4;
}

// ─── readiness colour ─────────────────────────────────────────────────────────

function readinessColor(score: number): { ring: string; text: string } {
  if (score >= 90) return { ring: 'border-emerald-500 bg-emerald-500/10', text: 'text-emerald-300' };
  if (score >= 70) return { ring: 'border-amber-500 bg-amber-500/10', text: 'text-amber-300' };
  return { ring: 'border-rose-500 bg-rose-500/10', text: 'text-rose-300' };
}

// ─── RPN band helpers ─────────────────────────────────────────────────────────

function rpnBand(rpn: number): RiskBand['key'] {
  if (rpn <= 100) return 'low';
  if (rpn <= 200) return 'medium';
  if (rpn <= 500) return 'high';
  return 'critical';
}

const BAND_META: Record<RiskBand['key'], { label: string; range: string; colorClass: string; textClass: string }> = {
  low:      { label: 'Low',      range: '1–100',   colorClass: 'bg-emerald-500/20', textClass: 'text-emerald-300' },
  medium:   { label: 'Medium',   range: '101–200', colorClass: 'bg-amber-500/20',   textClass: 'text-amber-300' },
  high:     { label: 'High',     range: '201–500', colorClass: 'bg-orange-500/20',  textClass: 'text-orange-300' },
  critical: { label: 'Critical', range: '501+',    colorClass: 'bg-rose-500/20',    textClass: 'text-rose-300' },
};

// ─── data fetchers ────────────────────────────────────────────────────────────

async function fetchTriageData(supabase: Awaited<ReturnType<typeof createClient>>, userId: string | null, primaryRole: string): Promise<{ rows: TriageRow[]; totalFlags: number }> {
  // Fetch all unacknowledged flags, joined with asset and department.
  // LIMIT 500 to bound query cost on large installs — we sort and slice to 10 in JS.
  let query = supabase
    .from('recommendation_flags')
    .select('id, asset_id, flag_type, severity, message, equipment_assets(id, asset_code, name, departments(name))')
    .eq('is_acknowledged', false)
    .order('generated_at', { ascending: false })
    .limit(500); // performance guard; still covers full seed dataset

  // For technician role: cross-filter to assets where they have an open work order assigned.
  // Fetch their assigned asset_ids first, then apply the filter.
  let techAssetIds: string[] | null = null;
  if (primaryRole === 'technician' && userId) {
    const { data: woRows } = await supabase
      .from('work_orders')
      .select('asset_id')
      .eq('assigned_to', userId)
      .in('status', ['open', 'assigned', 'in_progress', 'on_hold']);
    techAssetIds = (woRows ?? []).map((r) => r.asset_id as string).filter(Boolean);
  }

  const { data, error } = await query;
  if (error) {
    if (process.env.NODE_ENV === 'development') console.warn('[Command/Section1] triage query error:', error);
    return { rows: [], totalFlags: 0 };
  }

  const all = (data ?? []) as Array<Record<string, unknown>>;

  // Score each flag and group per asset (highest severity per asset wins).
  const assetMap = new Map<string, TriageRow>();
  for (const row of all) {
    const asset = row.equipment_assets as { id: string; asset_code: string; name: string; departments?: { name: string } | null } | null;
    if (!asset) continue;
    const assetId = asset.id;

    // Technician sees only their assigned assets.
    if (techAssetIds !== null && !techAssetIds.includes(assetId)) continue;

    const score = severityScore(row.severity as string);
    const existing = assetMap.get(assetId);
    if (!existing || score > existing.score) {
      assetMap.set(assetId, {
        id: row.id as string,
        flag_id: row.id as string,
        asset_id: assetId,
        asset_name: asset.name,
        asset_code: asset.asset_code,
        department_name: asset.departments?.name ?? 'Unknown',
        flag_type: row.flag_type as string,
        severity: row.severity as string,
        message: row.message as string,
        score,
      });
    }
  }

  const sorted = Array.from(assetMap.values()).sort((a, b) => b.score - a.score);
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Command/Section1] total unacknowledged flags: ${all.length}, unique assets: ${assetMap.size}`);
  }

  return { rows: sorted.slice(0, 10), totalFlags: assetMap.size };
}

async function fetchReadinessData(supabase: Awaited<ReturnType<typeof createClient>>): Promise<DeptReadiness[]> {
  // Fetch all active equipment with their category criticality and department.
  const { data, error } = await supabase
    .from('equipment_assets')
    .select('id, condition, status, department_id, departments(id, name), equipment_categories(criticality_level)')
    .is('deleted_at', null)
    .limit(500); // performance guard; full seed is 80 rows

  if (error) {
    if (process.env.NODE_ENV === 'development') console.warn('[Command/Section2] readiness query error:', error);
    return [];
  }

  const map = new Map<string, DeptReadiness>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const dept = row.departments as { id: string; name: string } | null;
    const cat = row.equipment_categories as { criticality_level: string } | null;
    if (!dept) continue;

    const criticality = cat?.criticality_level ?? 'low';
    const isEssential = ['high', 'critical'].includes(criticality);
    if (!isEssential) continue;

    const existing = map.get(dept.id) ?? {
      department_id: dept.id,
      department_name: dept.name,
      essential_total: 0,
      essential_functional: 0,
      readiness_score: 0,
    };
    existing.essential_total += 1;
    if (row.condition === 'functional' && row.status === 'active') existing.essential_functional += 1;
    map.set(dept.id, existing);
  }

  const rows = Array.from(map.values()).map((r) => ({
    ...r,
    readiness_score: r.essential_total > 0 ? Math.round((r.essential_functional / r.essential_total) * 100) : 0,
  }));

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Command/Section2] departments with essential equipment: ${rows.length}`);
  }

  return rows.sort((a, b) => a.department_name.localeCompare(b.department_name));
}

async function fetchWorkInProgress(supabase: Awaited<ReturnType<typeof createClient>>): Promise<WorkInProgress> {
  const today = new Date().toISOString().slice(0, 10);
  const in30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [woRes, pmRes, calRes] = await Promise.all([
    supabase
      .from('v_open_work_orders')
      .select('id, status')
      .limit(500), // performance guard; count all open WOs in the system
    supabase
      .from('v_overdue_pm')
      .select('id, scheduled_date')
      .limit(500), // performance guard; count all overdue PMs
    supabase
      .from('v_calibration_due')
      .select('id')
      .lte('next_due_date', in30d)
      .gte('next_due_date', today)
      .limit(500), // performance guard; count calibration due within 30 days
  ]);

  const woRows = (woRes.data ?? []) as Array<{ id: string; status: string }>;
  const pmRows = (pmRes.data ?? []) as Array<{ id: string; scheduled_date: string }>;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Command/Section3] open WOs: ${woRows.length}, overdue PM: ${pmRows.length}, cal due: ${(calRes.data ?? []).length}`);
  }

  return {
    open_work_orders: woRows.length,
    in_progress: woRows.filter((r) => r.status === 'in_progress').length,
    assigned: woRows.filter((r) => r.status === 'assigned').length,
    on_hold: woRows.filter((r) => r.status === 'on_hold').length,
    overdue_pm: pmRows.length,
    overdue_pm_gt30: pmRows.filter((r) => r.scheduled_date <= thirtyDaysAgo).length,
    calibration_due_30d: (calRes.data ?? []).length,
  };
}

async function fetchRiskData(supabase: Awaited<ReturnType<typeof createClient>>): Promise<{ rows: RiskScoreRow[]; totalAssets: number }> {
  const [riskRes, assetCountRes] = await Promise.all([
    supabase
      .from('equipment_risk_scores')
      .select('asset_id, rpn, risk_level, equipment_assets(asset_code, name, departments(name))')
      .order('rpn', { ascending: false })
      .limit(500), // performance guard; covers all scored equipment
    supabase
      .from('equipment_assets')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null),
  ]);

  const rows = ((riskRes.data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const asset = row.equipment_assets as { asset_code: string; name: string; departments?: { name: string } | null } | null;
    return {
      asset_id: row.asset_id as string,
      asset_name: asset?.name ?? 'Unknown',
      asset_code: asset?.asset_code ?? 'N/A',
      department_name: asset?.departments?.name ?? 'Unknown',
      rpn: Number(row.rpn ?? 0),
      risk_level: (row.risk_level as string) ?? 'low',
    };
  });

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Command/Section4] risk score rows: ${rows.length}, total assets: ${assetCountRes.count ?? 0}`);
  }

  return { rows, totalAssets: assetCountRes.count ?? 0 };
}

async function fetchReplacementData(supabase: Awaited<ReturnType<typeof createClient>>): Promise<{ rows: ReplacementRow[]; total: number }> {
  // Fetch full table ordered by priority, slice to top 5 for display.
  const { data, error } = await supabase
    .from('replacement_priority_scores')
    .select('asset_id, replacement_priority_index, rank, justification, equipment_assets(asset_code, name, departments(name))')
    .order('replacement_priority_index', { ascending: false })
    .limit(500); // performance guard; returns all candidates for total count

  if (error) {
    if (process.env.NODE_ENV === 'development') console.warn('[Command/Section5] replacement query error:', error);
    return { rows: [], total: 0 };
  }

  const all = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const asset = row.equipment_assets as { asset_code: string; name: string; departments?: { name: string } | null } | null;
    return {
      asset_id: row.asset_id as string,
      asset_name: asset?.name ?? 'Unknown',
      asset_code: asset?.asset_code ?? 'N/A',
      department_name: asset?.departments?.name ?? 'Unknown',
      priority_index: Number(row.replacement_priority_index ?? 0),
      rank: Number(row.rank ?? 0),
      justification: (row.justification as string | null) ?? null,
    };
  });

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Command/Section5] replacement priority rows: ${all.length}`);
  }

  return { rows: all.slice(0, 5), total: all.length }; // top 5 by design; total for footer
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function CommandCenterPage() {
  const profile = await getServerProfile();
  const primaryRole = profile?.roleNames?.[0] ?? 'viewer';
  const userId = profile ? (profile as unknown as Record<string, unknown>).user_id as string ?? null : null;

  const supabase = await createClient();

  let triage: { rows: TriageRow[]; totalFlags: number } = { rows: [], totalFlags: 0 };
  let readiness: DeptReadiness[] = [];
  let wip: WorkInProgress = { open_work_orders: 0, in_progress: 0, assigned: 0, on_hold: 0, overdue_pm: 0, overdue_pm_gt30: 0, calibration_due_30d: 0 };
  let risk: { rows: RiskScoreRow[]; totalAssets: number } = { rows: [], totalAssets: 0 };
  let replacement: { rows: ReplacementRow[]; total: number } = { rows: [], total: 0 };

  try {
    [triage, readiness, wip, risk, replacement] = await Promise.all([
      fetchTriageData(supabase, userId, primaryRole),
      fetchReadinessData(supabase),
      fetchWorkInProgress(supabase),
      fetchRiskData(supabase),
      fetchReplacementData(supabase),
    ]);
  } catch (err) {
    console.error('[Command] Top-level data fetch error:', err);
  }

  // Build RPN bands from the full risk rows set.
  const bandCounts = { low: 0, medium: 0, high: 0, critical: 0 };
  const bandAssets: Record<RiskBand['key'], RiskScoreRow[]> = { low: [], medium: [], high: [], critical: [] };
  for (const row of risk.rows) {
    const band = rpnBand(row.rpn);
    bandCounts[band]++;
    if (bandAssets[band].length < 5) bandAssets[band].push(row);
  }
  const totalAssessed = risk.rows.length;

  const bands: RiskBand[] = (['low', 'medium', 'high', 'critical'] as RiskBand['key'][]).map((key) => ({
    key,
    ...BAND_META[key],
    count: bandCounts[key],
    percentage: totalAssessed > 0 ? Math.round((bandCounts[key] / totalAssessed) * 100) : 0,
    topAssets: bandAssets[key],
  }));

  const triageHeading = primaryRole === 'technician' ? 'Your urgent items' : 'Hospital triage';
  const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Command Center"
        description={`Live operational status — ${now}`}
        actions={<RefreshButton />}
      />

      {/* ── Section 1: Today's Triage ─────────────────────────────────────── */}
      <section aria-label="Triage queue">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-rose-400" />
                  {triageHeading}
                </span>
              </CardTitle>
              {triage.totalFlags > 10 && (
                <Link href="/command/triage" className="text-xs text-violet-300 hover:text-violet-200">
                  View all →
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {triage.rows.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
                <p className="text-sm font-medium text-[var(--foreground)]">No urgent items right now</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">All systems within normal parameters</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] text-left">
                        <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">Asset</th>
                        <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">Department</th>
                        <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">Reason</th>
                        <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">Score</th>
                        <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">Action</th>
                        <th className="pb-2 font-medium text-[var(--text-muted)]">Ack</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]">
                      {triage.rows.map((row) => {
                        const action = actionForFlagType(row.flag_type, row.asset_id);
                        return (
                          <tr key={row.id} className="group">
                            <td className="py-3 pr-4">
                              <Link href={`/equipment/${row.asset_id}`} className="font-medium text-[var(--foreground)] hover:text-violet-300">
                                {row.asset_name}
                              </Link>
                              <p className="text-xs text-[var(--text-muted)]">{row.asset_code}</p>
                            </td>
                            <td className="py-3 pr-4 text-[var(--text-muted)]">{row.department_name}</td>
                            <td className="py-3 pr-4 max-w-[200px]">
                              <p className="truncate text-[var(--foreground)]">{row.message}</p>
                            </td>
                            <td className="py-3 pr-4">
                              <Badge variant={row.severity === 'critical' ? 'error' : row.severity === 'high' ? 'warning' : 'info'}>
                                {row.severity}
                              </Badge>
                            </td>
                            <td className="py-3 pr-4">
                              <Link
                                href={action.href}
                                className="inline-flex items-center rounded-md border border-[var(--border-color)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] transition hover:border-violet-400 hover:text-violet-300"
                              >
                                {action.label}
                              </Link>
                            </td>
                            <td className="py-3">
                              {row.flag_id && <AcknowledgeButton flagId={row.flag_id} label={`Acknowledge flag for ${row.asset_name}`} />}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-right text-xs text-[var(--text-muted)]">
                  Showing top {triage.rows.length} of {triage.totalFlags} urgent item{triage.totalFlags !== 1 ? 's' : ''}
                  {triage.totalFlags > 10 && (
                    <> — <Link href="/command/triage" className="text-violet-300 hover:text-violet-200">View all</Link></>
                  )}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Section 2: Hospital Readiness Strip ───────────────────────────── */}
      <section aria-label="Department readiness">
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-violet-400" />
                Department readiness
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {readiness.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--text-muted)]">No essential equipment data available</p>
            ) : (
              <>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {readiness.map((dept) => {
                    const colors = readinessColor(dept.readiness_score);
                    return (
                      <Link
                        key={dept.department_id}
                        href={`/equipment?department=${dept.department_id}`}
                        className={`flex min-w-[140px] flex-col items-center rounded-xl border-2 p-4 transition hover:opacity-80 ${colors.ring}`}
                        aria-label={`${dept.department_name}: ${dept.readiness_score}% ready`}
                      >
                        <span className={`text-3xl font-bold ${colors.text}`}>{dept.readiness_score}%</span>
                        <span className="mt-1 text-center text-xs font-medium text-[var(--foreground)]">{dept.department_name}</span>
                        <span className="mt-1 text-center text-[10px] text-[var(--text-muted)]">
                          {dept.essential_functional}/{dept.essential_total} essential functional
                        </span>
                      </Link>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-[var(--text-muted)]">{readiness.length} departments monitored</p>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Section 3: Work In Progress ───────────────────────────────────── */}
      <section aria-label="Work in progress">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-[var(--text-muted)]">Work in progress</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Open Work Orders */}
          <Link href="/work-orders?status=open" className="panel-surface rounded-2xl p-5 transition hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Open Work Orders</p>
                <p className="mt-1 text-3xl font-bold text-[var(--foreground)]">{wip.open_work_orders}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {wip.in_progress > 0 && <span className="text-xs text-[var(--text-muted)]">{wip.in_progress} in progress</span>}
                  {wip.assigned > 0 && <span className="text-xs text-[var(--text-muted)]">{wip.assigned} assigned</span>}
                  {wip.on_hold > 0 && <span className="text-xs text-amber-400">{wip.on_hold} on hold</span>}
                </div>
              </div>
              <div className="rounded-lg bg-blue-500/15 p-3 text-blue-300">
                <ClipboardList className="h-6 w-6" />
              </div>
            </div>
          </Link>

          {/* Overdue PM */}
          <Link href="/pm?status=overdue" className="panel-surface rounded-2xl p-5 transition hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Overdue PM</p>
                <p className="mt-1 text-3xl font-bold text-[var(--foreground)]">{wip.overdue_pm}</p>
                {wip.overdue_pm_gt30 > 0 && (
                  <p className="mt-2 text-xs text-rose-400">{wip.overdue_pm_gt30} overdue &gt;30 days</p>
                )}
              </div>
              <div className="rounded-lg bg-amber-500/15 p-3 text-amber-300">
                <CalendarCheck className="h-6 w-6" />
              </div>
            </div>
          </Link>

          {/* Calibration Due */}
          <Link href="/calibration?due_within=30" className="panel-surface rounded-2xl p-5 transition hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Calibration Due (30d)</p>
                <p className="mt-1 text-3xl font-bold text-[var(--foreground)]">{wip.calibration_due_30d}</p>
              </div>
              <div className="rounded-lg bg-violet-500/15 p-3 text-violet-300">
                <Wrench className="h-6 w-6" />
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ── Section 4: Risk Distribution ──────────────────────────────────── */}
      <section aria-label="Equipment risk distribution">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>
                <span className="inline-flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-orange-400" />
                  Equipment by risk priority (RPN)
                </span>
              </CardTitle>
              <span className="text-xs text-[var(--text-muted)]">
                Total: {totalAssessed} of {risk.totalAssets} equipment assessed
                {risk.totalAssets > totalAssessed && (
                  <span
                    title="Some equipment has not yet been risk-scored. Complete a maintenance event to trigger scoring."
                    className="ml-1 inline-flex cursor-help items-center text-amber-400"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </span>
                )}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {totalAssessed === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--text-muted)]">No risk scores computed yet</p>
            ) : (
              <>
                <RiskBandDrilldown bands={bands} totalAssessed={totalAssessed} />
                <p className="mt-4 text-xs text-[var(--text-muted)]">
                  Methodology: RPN = Severity × Occurrence × Detectability —{' '}
                  <Link href="/reports" className="text-violet-300 hover:text-violet-200">methodology reference</Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Section 5: Replacement Watchlist ──────────────────────────────── */}
      <section aria-label="Replacement watchlist">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                <span className="inline-flex items-center gap-2">
                  <ArrowUpDown className="h-5 w-5 text-amber-400" />
                  Top replacement candidates
                </span>
              </CardTitle>
              {replacement.total > 0 && (
                <Link href="/replacement" className="text-xs text-violet-300 hover:text-violet-200">
                  View full ranking ({replacement.total} candidates) →
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {replacement.rows.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--text-muted)]">No replacement candidates scored yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] text-left">
                      <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">Rank</th>
                      <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">Asset</th>
                      <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">Department</th>
                      <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">Priority Index</th>
                      <th className="pb-2 font-medium text-[var(--text-muted)]">Key Driver</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {replacement.rows.map((row) => (
                      <tr key={row.asset_id}>
                        <td className="py-3 pr-4">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-300">
                            {row.rank}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <Link href={`/equipment/${row.asset_id}`} className="font-medium text-[var(--foreground)] hover:text-violet-300">
                            {row.asset_name}
                          </Link>
                          <p className="text-xs text-[var(--text-muted)]">{row.asset_code}</p>
                        </td>
                        <td className="py-3 pr-4 text-[var(--text-muted)]">{row.department_name}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="warning">{row.priority_index.toFixed(1)}</Badge>
                        </td>
                        <td className="py-3 max-w-[200px]">
                          <p className="truncate text-xs text-[var(--text-muted)]">
                            {row.justification ?? 'Multi-factor scoring'}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* TODO Task 6: sensitivity analysis sliders */}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
