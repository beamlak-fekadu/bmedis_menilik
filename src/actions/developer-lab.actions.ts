'use server';

import { revalidatePath } from 'next/cache';
import { getActionContext, logServerAuditEvent, actionError, type ActionResult } from './_shared';
import { recomputeAllAnalytics } from './analytics.actions';

const developerLabPaths = ['/developer-lab', '/command', '/alerts', '/replacement', '/reports'];

function revalidateDeveloperLabPaths() {
  for (const path of developerLabPaths) revalidatePath(path);
}

export async function refreshFmeaRiskScoresAction(): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['developer']);
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
    const { supabase, profile, error } = await getActionContext(['developer']);
    if (error || !profile) return { success: false, error };

    const result = await supabase.rpc('refresh_decision_support_snapshots');
    if (result.error) return { success: false, error: result.error.message };

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'developer_lab.refresh_decision_support_snapshots',
      entityType: 'developer_lab',
      details: { scope: 'snapshots_only' },
    });
    revalidateDeveloperLabPaths();
    return { success: true };
  } catch (err) {
    return actionError(err, 'Failed to refresh decision-support snapshots');
  }
}

export async function recomputeAllAnalyticsDeveloperAction(): Promise<ActionResult> {
  try {
    const { profile, error } = await getActionContext(['developer']);
    if (error || !profile) return { success: false, error };

    const result = await recomputeAllAnalytics();
    revalidateDeveloperLabPaths();
    return result;
  } catch (err) {
    return actionError(err, 'Failed to recompute analytics');
  }
}
