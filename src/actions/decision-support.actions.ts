'use server';

// R3 + R25: canonical analytics refresh orchestrator.
//
// Why this exists: before this module, every workflow action called
// `recompute_equipment_analytics` or `refresh_decision_support_snapshots`
// best-effort and swallowed failures. There was no single surface that told
// us (a) which metric tables actually updated, (b) when each table was last
// refreshed, (c) whether a refresh succeeded or partially failed.
//
// This action runs the same RPCs but wraps each table in a before/after
// max(updated_at) probe. The returned shape:
//
//   { metric, status, beforeMaxUpdatedAt, afterMaxUpdatedAt, error? }
//
// is what Developer Lab consumes for the "Refresh diagnostics" surface. Row
// counts are NOT invented when the underlying RPC doesn't return them — the
// plan's guardrail #2 (no silent fallback presented as truth) applies here.
//
// Existing best-effort callers (refreshDecisionSupportSnapshotsBestEffort)
// remain in place — they're a fire-and-forget background refresh tied to
// workflow writes. This action is the explicit developer-driven path that
// returns proof of what happened.

import { createClient } from '@/lib/supabase/server';
import {
  getActionContextForCapability,
  logServerAuditEvent,
  actionError,
  type ActionResult,
} from './_shared';

export type MetricKey =
  | 'rpn_fmea'
  | 'replacement_priority'
  | 'equipment_health'
  | 'department_clinical_readiness'
  | 'pm_compliance'
  | 'reliability_metrics';

export interface RefreshResult {
  metric: MetricKey;
  table: string;
  status: 'updated' | 'unchanged' | 'error' | 'skipped';
  beforeMaxUpdatedAt: string | null;
  afterMaxUpdatedAt: string | null;
  error?: string;
}

interface MetricBinding {
  metric: MetricKey;
  table: string;
  timestampColumn: 'computed_at' | 'created_at' | 'snapshot_date';
}

// Maps each canonical metric to the table whose latest timestamp proves
// whether the refresh moved the needle. The RPC may touch additional tables;
// these are the ones the score-registry treats as the authoritative source.
const METRIC_BINDINGS: MetricBinding[] = [
  { metric: 'rpn_fmea', table: 'equipment_risk_scores', timestampColumn: 'computed_at' },
  { metric: 'replacement_priority', table: 'replacement_priority_scores', timestampColumn: 'computed_at' },
  { metric: 'equipment_health', table: 'equipment_health_snapshots', timestampColumn: 'created_at' },
  { metric: 'department_clinical_readiness', table: 'clinical_readiness_snapshots', timestampColumn: 'created_at' },
  { metric: 'pm_compliance', table: 'pm_compliance_metrics', timestampColumn: 'computed_at' },
  { metric: 'reliability_metrics', table: 'equipment_reliability_metrics', timestampColumn: 'computed_at' },
];

async function maxUpdatedAt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  column: string,
): Promise<{ value: string | null; error?: string }> {
  // Generic max-timestamp probe. Returns null when the table has zero rows,
  // and surfaces the error message when the query itself fails.
  const { data, error } = await (
    supabase
      .from(table)
      .select(column)
      .order(column, { ascending: false })
      .limit(1)
      .maybeSingle() as unknown as Promise<{ data: Record<string, string | null> | null; error: { message: string } | null }>
  );
  if (error) return { value: null, error: error.message };
  if (!data) return { value: null };
  const value = data[column];
  return { value: typeof value === 'string' ? value : null };
}

// Scope-aware companion to `refreshDecisionSupportSnapshotsAction` (in
// developer-lab.actions.ts). That one runs an unscoped, multi-step pipeline
// for the Developer Lab cockpit. This one is the narrower path: scope to a
// specific asset and / or specific metric subset, then report per-metric
// before/after timestamps. Used by Phase 2 workflow callers and the
// Copilot's `metric_debug` tool to answer "did refreshing this asset
// actually move the needle?".
export async function refreshDecisionSupportScopedAction(
  options: { assetId?: string | null; metrics?: MetricKey[] | null } = {},
): Promise<ActionResult<{ runId: string | null; results: RefreshResult[] }>> {
  try {
    // Developer-only by design: this is a debugging / observability surface.
    // Workflow-triggered refreshes still flow through the existing best-effort
    // helper without requiring this capability.
    const { supabase, profile, error } = await getActionContextForCapability('developer.refresh_snapshots');
    if (error || !profile) return { success: false, error };

    const scopedMetrics = options.metrics?.length
      ? METRIC_BINDINGS.filter((b) => options.metrics!.includes(b.metric))
      : METRIC_BINDINGS;

    // BEFORE probe — capture the max timestamp on each scoped metric table.
    const beforeMap = new Map<MetricKey, { value: string | null; error?: string }>();
    for (const binding of scopedMetrics) {
      beforeMap.set(binding.metric, await maxUpdatedAt(supabase, binding.table, binding.timestampColumn));
    }

    // Start a refresh log row so the run is visible in Developer Lab even if
    // the orchestrator itself dies mid-flight.
    const { data: logRow } = await supabase
      .from('decision_support_refresh_log')
      .insert({
        scope: options.assetId ? 'asset' : 'all',
        asset_id: options.assetId ?? null,
        triggered_by: profile.id,
        status: 'running',
      })
      .select('id')
      .single();
    const runId = (logRow as { id?: string } | null)?.id ?? null;

    // Run the underlying RPC. When scoped to a single asset, prefer the
    // per-asset RPC which is cheaper.
    let rpcError: string | null = null;
    if (options.assetId) {
      const { error: err } = await supabase.rpc('recompute_equipment_analytics', { p_asset_id: options.assetId });
      if (err) rpcError = err.message;
    } else {
      const { error: err } = await supabase.rpc('recompute_all_equipment_analytics');
      if (err) rpcError = err.message;
    }

    // AFTER probe.
    const results: RefreshResult[] = [];
    for (const binding of scopedMetrics) {
      const before = beforeMap.get(binding.metric) ?? { value: null };
      const after = await maxUpdatedAt(supabase, binding.table, binding.timestampColumn);
      let status: RefreshResult['status'];
      let err: string | undefined;
      if (rpcError) {
        status = 'error';
        err = rpcError;
      } else if (before.error || after.error) {
        status = 'error';
        err = after.error ?? before.error;
      } else if (before.value === after.value) {
        status = 'unchanged';
      } else {
        status = 'updated';
      }
      results.push({
        metric: binding.metric,
        table: binding.table,
        status,
        beforeMaxUpdatedAt: before.value,
        afterMaxUpdatedAt: after.value,
        error: err,
      });
    }

    if (runId) {
      await supabase
        .from('decision_support_refresh_log')
        .update({
          finished_at: new Date().toISOString(),
          status: rpcError ? 'error' : 'success',
          error_message: rpcError,
        })
        .eq('id', runId);
    }

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: rpcError
        ? 'decision_support.canonical_refresh_failed'
        : 'decision_support.canonical_refresh',
      entityType: 'decision_support_refresh_log',
      entityId: runId,
      details: {
        scope: options.assetId ? 'asset' : 'all',
        asset_id: options.assetId ?? null,
        metrics: scopedMetrics.map((b) => b.metric),
        rpc_error: rpcError,
        results,
      },
    });

    return {
      success: !rpcError,
      error: rpcError ?? undefined,
      data: { runId, results },
    };
  } catch (err) {
    return actionError(err, 'Canonical decision-support refresh failed') as ActionResult<{ runId: string | null; results: RefreshResult[] }>;
  }
}
