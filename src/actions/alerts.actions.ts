'use server';

import { getActionContext, logServerAuditEvent, revalidateMany, actionError, type ActionResult } from './_shared';

const alertPaths = ['/alerts', '/command', '/command/triage', '/command/health', '/helpdesk'];

export async function acknowledgeAlertFlagAction(id: string): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician']);
    if (error || !profile) return { success: false, error };

    const oldRow = await supabase.from('recommendation_flags').select('*').eq('id', id).maybeSingle();
    const result = await supabase
      .from('recommendation_flags')
      .update({
        is_acknowledged: true,
        acknowledged_by: profile.id,
        acknowledged_at: new Date().toISOString(),
      } as never)
      .eq('id', id)
      .select('*')
      .single();

    if (result.error) return { success: false, error: result.error.message };

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'recommendation_flag.acknowledge',
      entityType: 'recommendation_flags',
      entityId: id,
      oldValues: oldRow.data as Record<string, unknown> | null,
      newValues: result.data as Record<string, unknown>,
    });
    revalidateMany(alertPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to acknowledge alert');
  }
}
