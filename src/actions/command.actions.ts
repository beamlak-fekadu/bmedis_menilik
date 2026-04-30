'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recomputeAllAnalytics } from './analytics.actions';

export type ActionResult = { success: boolean; error?: string };

async function getCurrentProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, profile: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  return { supabase, profile };
}

export async function acknowledgeTriageItem(queueId: string): Promise<ActionResult> {
  if (!queueId) return { success: false, error: 'queueId is required' };

  try {
    const { supabase, profile } = await getCurrentProfile();
    if (!profile) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
      .from('triage_action_queue')
      .update({ status: 'dismissed' })
      .eq('id', queueId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/command');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function acknowledgeAssetFlags(assetId: string): Promise<ActionResult> {
  if (!assetId) return { success: false, error: 'assetId is required' };

  try {
    const { supabase, profile } = await getCurrentProfile();
    if (!profile) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
      .from('recommendation_flags')
      .update({
        is_acknowledged: true,
        acknowledged_by: profile.id,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('asset_id', assetId)
      .eq('is_acknowledged', false);

    if (error) return { success: false, error: error.message };

    revalidatePath('/command');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function refreshCommandCenter(): Promise<ActionResult> {
  try {
    const result = await recomputeAllAnalytics();
    revalidatePath('/command');
    return result;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
