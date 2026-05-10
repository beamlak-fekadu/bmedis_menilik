'use server';

import { getActionContext, logServerAuditEvent, revalidateMany, actionError, type ActionResult } from './_shared';

const userPaths = ['/settings', '/audit'];

export async function updateProfileAction(id: string, payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin']);
    if (error || !profile) return { success: false, error };
    const oldRow = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    const result = await supabase.from('profiles').update(payload as never).eq('id', id).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'profile.update', entityType: 'profiles', entityId: id, oldValues: oldRow.data as Record<string, unknown> | null, newValues: result.data as Record<string, unknown> });
    revalidateMany(userPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to update profile');
  }
}

export async function assignRoleAction(userId: string, roleId: string): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin']);
    if (error || !profile) return { success: false, error };
    const result = await supabase.from('user_roles').insert({ user_id: userId, role_id: roleId } as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'user_role.assign', entityType: 'user_roles', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    revalidateMany(userPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to assign role');
  }
}

export async function removeRoleAction(userId: string, roleId: string): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin']);
    if (error || !profile) return { success: false, error };
    const oldRow = await supabase.from('user_roles').select('*').eq('user_id', userId).eq('role_id', roleId).maybeSingle();
    const result = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role_id', roleId);
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'user_role.remove', entityType: 'user_roles', entityId: (oldRow.data as { id?: string } | null)?.id ?? null, oldValues: oldRow.data as Record<string, unknown> | null });
    revalidateMany(userPaths);
    return { success: true };
  } catch (err) {
    return actionError(err, 'Failed to remove role');
  }
}
