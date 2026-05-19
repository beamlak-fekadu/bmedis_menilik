'use server';

import { revalidatePath } from 'next/cache';
import { getActionContextForCapability, logServerAuditEvent, actionError, type ActionResult } from './_shared';
import { recomputeAllAnalytics } from './analytics.actions';
import { getScoreSnapshotTimestamps } from '@/services/developer-lab.service';
import { SCORE_REGISTRY, type ScoreDataMode } from '@/utils/analytics/score-registry';

const developerLabPaths = ['/developer-lab', '/command', '/equipment', '/replacement', '/pm', '/calibration', '/reports', '/notifications'];

export interface DecisionSupportRefreshMetricResult {
  metricKey: string;
  displayName: string;
  dataMode: ScoreDataMode;
  refreshAttempted: boolean;
  success: boolean;
  rowsAffected: number | null;
  lastRefreshBefore: string | null;
  lastRefreshAfter: string | null;
  durationMs: number;
  warnings: string[];
  error?: string;
}

export interface DecisionSupportRefreshSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  metrics: DecisionSupportRefreshMetricResult[];
  warnings: string[];
}

function revalidateDeveloperLabPaths() {
  for (const path of developerLabPaths) revalidatePath(path);
}

export async function refreshFmeaRiskScoresAction(): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('developer.refresh_snapshots');
    if (error || !profile) return { success: false, error };

    const result = await (supabase.rpc as never as (fn: string) => Promise<{ error: { message: string } | null }>)(
      'fn_refresh_fmea_risk_scores'
    );
    if (result.error) return { success: false, error: result.error.message };

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'developer_lab.refresh_fmea_risk_scores',
      entityType: 'developer_lab',
      details: { scope: 'all_assets' },
    });
    revalidateDeveloperLabPaths();
    return { success: true };
  } catch (err) {
    return actionError(err, 'Failed to refresh FMEA risk scores');
  }
}

export async function refreshDecisionSupportSnapshotsAction(): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('developer.refresh_snapshots');
    if (error || !profile) return { success: false, error };

    const startedAt = new Date();
    const before = await getScoreSnapshotTimestamps(supabase);
    let logId: string | null = null;

    const logInsert = await supabase
      .from('decision_support_refresh_log')
      .insert({
        scope: 'all',
        asset_id: null,
        triggered_by: profile.id,
        status: 'running',
      } as never)
      .select('id')
      .maybeSingle();
    if (!logInsert.error) logId = (logInsert.data as { id?: string } | null)?.id ?? null;

    async function runRpc(label: string, fn: string) {
      const stepStart = Date.now();
      const result = await (supabase.rpc as never as (rpcName: string) => Promise<{ error: { message: string } | null }>)(fn);
      return {
        label,
        fn,
        durationMs: Date.now() - stepStart,
        success: !result.error,
        error: result.error?.message,
      };
    }

    const steps = [
      await runRpc('RPN / FMEA', 'fn_refresh_fmea_risk_scores'),
      await runRpc('RPI / Replacement Priority', 'compute_replacement_priority_scores_all'),
      await runRpc('Reliability and PM analytics', 'recompute_all_equipment_analytics'),
      await runRpc('Decision-support snapshots', 'refresh_decision_support_snapshots'),
    ];

    const after = await getScoreSnapshotTimestamps(supabase);
    const stepByMetric = new Map<string, typeof steps[number]>([
      ['rpn_fmea', steps[0]],
      ['replacement_priority', steps[1]],
      ['availability', steps[2]],
      ['mtbf', steps[2]],
      ['mttr', steps[2]],
      ['pm_compliance', steps[2]],
      ['equipment_health', steps[3]],
      ['department_clinical_readiness', steps[3]],
    ]);

    const metrics: DecisionSupportRefreshMetricResult[] = SCORE_REGISTRY
      .filter((score) => score.refreshImplementation || score.dataMode === 'Snapshot' || score.dataMode === 'Mixed')
      .map((score) => {
        const step = stepByMetric.get(score.key);
        const refreshAttempted = !!step;
        const warnings: string[] = [];
        if (!score.refreshImplementation && score.dataMode !== 'Live') {
          warnings.push('Missing refresh implementation metadata in score registry.');
        }
        if (refreshAttempted && step?.success && before[score.key] === after[score.key]) {
          warnings.push('Refresh RPC completed, but the latest timestamp did not change. This can be valid if no rows changed, but it should be checked with source data.');
        }
        if (!refreshAttempted) {
          warnings.push('No refresh RPC is currently mapped for this metric.');
        }
        return {
          metricKey: score.key,
          displayName: score.displayName,
          dataMode: score.dataMode,
          refreshAttempted,
          success: refreshAttempted ? !!step?.success : false,
          rowsAffected: null,
          lastRefreshBefore: before[score.key] ?? null,
          lastRefreshAfter: after[score.key] ?? null,
          durationMs: step?.durationMs ?? 0,
          warnings,
          error: step?.error,
        };
      });

    const failedSteps = steps.filter((step) => !step.success);
    const finishedAt = new Date();
    const warnings = [
      ...steps.filter((step) => !step.success).map((step) => `${step.label}: ${step.error ?? 'failed'}`),
      ...metrics.flatMap((metric) => metric.warnings.map((warning) => `${metric.displayName}: ${warning}`)),
    ];

    if (logId) {
      await supabase
        .from('decision_support_refresh_log')
        .update({
          finished_at: finishedAt.toISOString(),
          status: failedSteps.length > 0 ? 'error' : 'success',
          error_message: failedSteps.length > 0 ? failedSteps.map((step) => `${step.fn}: ${step.error}`).join('; ') : null,
        } as never)
        .eq('id', logId);
    }

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'developer_lab.refresh_decision_support_snapshots',
      entityType: 'developer_lab',
      details: {
        scope: 'decision_support',
        steps,
        warnings,
      },
    });
    revalidateDeveloperLabPaths();

    const summary: DecisionSupportRefreshSummary = {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      metrics,
      warnings,
    };

    return failedSteps.length > 0
      ? { success: false, error: 'One or more decision-support refresh steps failed', data: summary }
      : { success: true, data: summary };
  } catch (err) {
    return actionError(err, 'Failed to refresh decision-support snapshots');
  }
}

export async function recomputeAllAnalyticsDeveloperAction(): Promise<ActionResult> {
  try {
    const { profile, error } = await getActionContextForCapability('developer.diagnostics');
    if (error || !profile) return { success: false, error };

    const result = await recomputeAllAnalytics();
    revalidateDeveloperLabPaths();
    return result;
  } catch (err) {
    return actionError(err, 'Failed to recompute analytics');
  }
}
