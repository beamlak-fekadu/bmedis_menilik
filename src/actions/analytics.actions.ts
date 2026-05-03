'use server';

import { createClient } from '@/lib/supabase/server';

async function getTriggerProfileId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).single();
  return profile?.id ?? null;
}

export async function recomputeAssetAnalytics(
  assetId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const triggeredBy = await getTriggerProfileId();
  let logId: string | null = null;

  try {
    const { data: logRow, error: logInsertError } = await supabase
      .from('decision_support_refresh_log')
      .insert({
        scope: 'asset',
        asset_id: assetId,
        triggered_by: triggeredBy,
        status: 'running',
      })
      .select('id')
      .single();

    if (!logInsertError && logRow?.id) {
      logId = logRow.id as string;
    }

    const { error: rpcError } = await supabase.rpc('recompute_equipment_analytics', {
      p_asset_id: assetId,
    });

    if (rpcError) {
      if (logId) {
        await supabase
          .from('decision_support_refresh_log')
          .update({
            finished_at: new Date().toISOString(),
            status: 'error',
            error_message: rpcError.message,
          })
          .eq('id', logId);
      }
      return { success: false, error: rpcError.message };
    }

    // recompute_equipment_analytics already runs refresh_decision_support_snapshots()

    if (logId) {
      await supabase
        .from('decision_support_refresh_log')
        .update({
          finished_at: new Date().toISOString(),
          status: 'success',
          error_message: null,
        })
        .eq('id', logId);
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during asset analytics recompute';
    if (logId) {
      await supabase
        .from('decision_support_refresh_log')
        .update({
          finished_at: new Date().toISOString(),
          status: 'error',
          error_message: message,
        })
        .eq('id', logId);
    }
    return {
      success: false,
      error: message,
    };
  }
}

export async function recomputeAllAnalytics(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const triggeredBy = await getTriggerProfileId();
  let logId: string | null = null;

  try {
    const { data: logRow, error: logInsertError } = await supabase
      .from('decision_support_refresh_log')
      .insert({
        scope: 'all',
        asset_id: null,
        triggered_by: triggeredBy,
        status: 'running',
      })
      .select('id')
      .single();

    if (!logInsertError && logRow?.id) {
      logId = logRow.id as string;
    }

    const { error: rpcError } = await supabase.rpc('recompute_all_equipment_analytics');

    if (rpcError) {
      if (logId) {
        await supabase
          .from('decision_support_refresh_log')
          .update({
            finished_at: new Date().toISOString(),
            status: 'error',
            error_message: rpcError.message,
          })
          .eq('id', logId);
      }
      return { success: false, error: rpcError.message };
    }

    // recompute_all_equipment_analytics already runs refresh_decision_support_snapshots() once at end

    if (logId) {
      await supabase
        .from('decision_support_refresh_log')
        .update({
          finished_at: new Date().toISOString(),
          status: 'success',
          error_message: null,
        })
        .eq('id', logId);
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during full analytics recompute';
    if (logId) {
      await supabase
        .from('decision_support_refresh_log')
        .update({
          finished_at: new Date().toISOString(),
          status: 'error',
          error_message: message,
        })
        .eq('id', logId);
    }
    return {
      success: false,
      error: message,
    };
  }
}
