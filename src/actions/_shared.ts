import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { RoleName } from '@/types/roles';
import { hasCapability, hasAnyCapability, type Capability } from '@/lib/rbac';
import { departmentScopeFor, type DepartmentScope } from '@/lib/rbac/department-scope';

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
  // R4: every action context carries its department scope by construction.
  // Mutations on dept-scoped tables should branch on this BEFORE writing so
  // dept users cannot operate on assets outside their department even when a
  // request targets a foreign asset_id.
  departmentScope: DepartmentScope;
};

type AuthorizeFn = (roleNames: string[]) => boolean;

async function loadActionContext(authorize: AuthorizeFn) {
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

  if (!authorize(roleNames)) {
    return { supabase, profile: null, error: 'Insufficient permissions' };
  }

  return {
    supabase,
    profile: {
      ...(profileRow as Omit<ActionProfile, 'roleNames' | 'departmentScope'>),
      roleNames,
      departmentScope: departmentScopeFor({
        roleNames,
        departmentId: (profileRow as { department_id: string | null }).department_id,
      }),
    } as ActionProfile,
    error: null,
  };
}

// Legacy role-array gate. Kept for backwards compatibility with un-migrated
// callers. New code should prefer getActionContextForCapability().
export async function getActionContext(allowedRoles: RoleName[]) {
  return loadActionContext((roleNames) =>
    roleNames.includes('developer') || allowedRoles.some((role) => roleNames.includes(role)),
  );
}

// Capability-based gate. Authorizes the caller if their roles grant the given
// capability via CAPABILITY_MATRIX. Developer always passes (hasCapability
// short-circuits on developer). Viewer fails every mutation capability because
// CAPABILITY_MATRIX.viewer contains no mutation entries.
export async function getActionContextForCapability(capability: Capability) {
  return loadActionContext((roleNames) => hasCapability(roleNames, capability));
}

// Variant when a single action endpoint needs ANY of several capabilities
// (e.g., create-or-approve flows where either capability suffices).
export async function getActionContextForAnyCapability(capabilities: Capability[]) {
  return loadActionContext((roleNames) => hasAnyCapability(roleNames, capabilities));
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

export async function refreshDecisionSupportSnapshotsBestEffort(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  profileId: string;
  reason: string;
  entityType?: string;
  entityId?: string | null;
}) {
  const startedAt = new Date();
  const { error } = await params.supabase.rpc('refresh_decision_support_snapshots');
  const finishedAt = new Date();

  await logServerAuditEvent({
    supabase: params.supabase,
    profileId: params.profileId,
    action: error ? 'decision_support.refresh_after_workflow_failed' : 'decision_support.refresh_after_workflow',
    entityType: params.entityType ?? 'decision_support',
    entityId: params.entityId ?? null,
    details: {
      reason: params.reason,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      error: error?.message ?? null,
    },
  });

  if (error) {
    console.error('[decision-support] Post-workflow snapshot refresh failed:', error.message);
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

/**
 * SHAPE-01: detect PostgREST's "single row required but 0 returned" error.
 *
 * When an UPDATE...select().single() targets a row that RLS filters out
 * (or that no longer exists), PostgREST returns:
 *   { code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object' }
 *
 * This message leaks into the UI as a confusing string. Callers should use
 * .maybeSingle() and then call interpretMissingMutationResult() to convert
 * a null data result into a clean user-facing error.
 */
export function isPostgrestNoRowsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const row = error as { code?: unknown; message?: unknown };
  if (row.code === 'PGRST116') return true;
  return /Cannot coerce the result to a single JSON object/i.test(String(row.message ?? ''));
}

/**
 * Translate a 0-row UPDATE/DELETE/INSERT-returning-maybeSingle into a
 * structured user-facing error. The console.error preserves the raw cause
 * for developers; the returned message is safe to show in the UI.
 */
export function interpretMissingMutationResult(params: {
  entity: string;
  entityId?: string | null;
  attempted?: string;
  profileId?: string | null;
}): ActionResult {
  console.error(`[shape-01] ${params.entity} mutation returned 0 rows; likely RLS or already deleted`, {
    entityId: params.entityId ?? null,
    attempted: params.attempted ?? null,
    profileId: params.profileId ?? null,
  });
  return {
    success: false,
    error: `You do not have permission to change this ${params.entity}, or the ${params.entity} no longer exists.`,
  };
}

/**
 * ANALYTICS-01: run a best-effort analytics refresh and ALWAYS surface
 * failures as a structured warning instead of swallowing them with
 * `.catch(() => undefined)`.
 *
 * Callers should propagate the returned warning string into their action
 * result so the UI can warn "Action completed; analytics refresh failed,
 * metrics may be stale". The action's primary workflow MUST NOT be
 * blocked by refresh failure — analytics is downstream of the truth.
 *
 * @returns null on success, error message string on failure
 */
export async function runAnalyticsRefreshOrWarn(params: {
  refresh: () => Promise<unknown>;
  label: string;
  audit?: {
    supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>;
    profileId: string;
    action: string;
    entityType: string;
    entityId: string | null;
    details?: Record<string, unknown>;
  };
}): Promise<string | null> {
  try {
    await params.refresh();
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    const warning = `${params.label} refresh failed: ${message}. Metrics may be stale until the next scheduled refresh.`;
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[analytics-01] ${warning}`);
    }
    if (params.audit) {
      try {
        await params.audit.supabase.from('audit_logs').insert({
          performed_by: params.audit.profileId,
          action: params.audit.action,
          entity_type: params.audit.entityType,
          entity_id: params.audit.entityId,
          details: { ...(params.audit.details ?? {}), error: message },
        } as never);
      } catch {
        // Audit failure itself is best-effort. The warning still surfaces.
      }
    }
    return warning;
  }
}
