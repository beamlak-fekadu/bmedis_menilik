'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recomputeAllAnalytics } from './analytics.actions';

export type ActionResult = { success: boolean; error?: string };

export async function acknowledgeFlag(flagId: string): Promise<ActionResult> {
  if (!flagId) return { success: false, error: 'flagId is required' };

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const { error } = await supabase
      .from('recommendation_flags')
      .update({
        is_acknowledged: true,
        acknowledged_by: profile?.id ?? null,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', flagId);

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
