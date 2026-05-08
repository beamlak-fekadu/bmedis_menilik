import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { RoleName } from '@/types/database';

export type ActionResult<T = unknown> = {
  success: boolean;
  error?: string;
  data?: T;
};

export type ActionProfile = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  department_id: string | null;
  roleNames: string[];
};

export async function getActionContext(allowedRoles: RoleName[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, profile: null, error: 'Not authenticated' };
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('id, user_id, full_name, email, department_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || !profileRow) {
    return { supabase, profile: null, error: profileError?.message ?? 'Authenticated user is missing profile linkage' };
  }

  const { data: rolesRows } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', profileRow.id as string);

  const roleNames = ((rolesRows ?? []) as Array<Record<string, unknown>>)
    .map((row) => ((row.roles as { name?: string } | null)?.name ?? null))
    .filter(Boolean) as string[];

  const hasAccess = roleNames.includes('developer') || allowedRoles.some((role) => roleNames.includes(role));
  if (!hasAccess) {
    return { supabase, profile: null, error: 'Insufficient permissions' };
  }

  return {
    supabase,
    profile: {
      ...(profileRow as Omit<ActionProfile, 'roleNames'>),
      roleNames,
    } as ActionProfile,
    error: null,
  };
}

export async function logServerAuditEvent(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  profileId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
}) {
  const { error } = await params.supabase.from('audit_logs').insert({
    user_id: params.profileId,
    performed_by: params.profileId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    old_values: params.oldValues ?? null,
    new_values: params.newValues ?? null,
    details: params.details ?? null,
  });

  if (error) {
    console.error('[audit] Failed to write audit log:', error.message);
  }
}

export function revalidateMany(paths: string[]) {
  for (const path of paths) revalidatePath(path);
}

export function actionError(error: unknown, fallback = 'Action failed'): ActionResult {
  if (typeof error === 'string') return { success: false, error };
  if (error && typeof error === 'object' && 'message' in error) {
    return { success: false, error: String((error as { message: unknown }).message) };
  }
  return { success: false, error: fallback };
}

export function nullIfEmpty(value: unknown) {
  return value === '' ? null : value;
}
