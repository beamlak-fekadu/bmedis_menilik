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
    .select('id, user_roles(roles(name))')
    .eq('user_id', user.id)
    .single();

  return { supabase, profile };
}

function canMutateCommandCenter(profile: Record<string, unknown> | null): boolean {
  if (!profile) return false;
  const roles = ((profile.user_roles as Array<Record<string, unknown>> | null) ?? [])
    .map((row) => (row.roles as { name?: string } | null)?.name)
    .filter(Boolean);
  return roles.some((role) => role !== 'viewer');
}

export async function acknowledgeTriageItem(queueId: string): Promise<ActionResult> {
  if (!queueId) return { success: false, error: 'queueId is required' };

  try {
    const { supabase, profile } = await getCurrentProfile();
    if (!profile) return { success: false, error: 'Not authenticated' };
    if (!canMutateCommandCenter(profile as Record<string, unknown>)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    const { error } = await supabase
      .from('triage_action_queue')
      .update({ status: 'dismissed' })
      .eq('id', queueId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/command');
    revalidatePath('/command/triage');
    revalidatePath('/command/health');
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
    if (!canMutateCommandCenter(profile as Record<string, unknown>)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    const { error } = await supabase
      .from('recommendation_flags')
      .update({
        is_acknowledged: true,
        acknowledged_by: profile.id as string,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('asset_id', assetId)
      .eq('is_acknowledged', false);

    if (error) return { success: false, error: error.message };

    revalidatePath('/command');
    revalidatePath('/command/triage');
    revalidatePath('/command/health');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function refreshCommandCenter(): Promise<ActionResult> {
  try {
    const { profile } = await getCurrentProfile();
    if (!profile) return { success: false, error: 'Not authenticated' };
    if (!canMutateCommandCenter(profile as Record<string, unknown>)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    const result = await recomputeAllAnalytics();
    revalidatePath('/command');
    revalidatePath('/command/triage');
    revalidatePath('/command/health');
    return result;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
