'use server';

import { createClient } from '@/lib/supabase/server';
import { refreshDecisionSupportSnapshots } from '@/services/decision-support.service';

export async function recomputeAssetAnalytics(
  assetId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error: rpcError } = await supabase.rpc('recompute_equipment_analytics', {
      p_asset_id: assetId,
    });

    if (rpcError) {
      return { success: false, error: rpcError.message };
    }

    const { error: refreshError } = await refreshDecisionSupportSnapshots();

    if (refreshError) {
      return { success: false, error: refreshError.message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error during asset analytics recompute',
    };
  }
}

export async function recomputeAllAnalytics(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error: rpcError } = await supabase.rpc('recompute_all_equipment_analytics');

    if (rpcError) {
      return { success: false, error: rpcError.message };
    }

    const { error: refreshError } = await refreshDecisionSupportSnapshots();

    if (refreshError) {
      return { success: false, error: refreshError.message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error during full analytics recompute',
    };
  }
}
