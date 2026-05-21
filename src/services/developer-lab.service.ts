import type { createClient } from '@/lib/supabase/server';
import {
  EXPECTED_DEMO_USERS,
  validateDemoRoleMappings,
  type DemoRoleValidationInput,
  type DemoRoleValidationResult,
} from '@/utils/developer-lab/demo-role-validation';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface RpcDemoRoleRow {
  email: string;
  auth_user_id: string | null;
  profile_id: string | null;
  profile_user_id: string | null;
  full_name: string | null;
  job_title: string | null;
  department_name: string | null;
  assigned_roles: string[] | null;
  primary_reason: string | null;
  reasons: string[] | null;
}

function normalizeRpcDemoRow(row: RpcDemoRoleRow): DemoRoleValidationInput {
  return {
    email: row.email,
    authUserId: row.auth_user_id,
    profileId: row.profile_id,
    profileUserId: row.profile_user_id,
    fullName: row.full_name,
    jobTitle: row.job_title,
    departmentName: row.department_name,
    assignedRoles: row.assigned_roles ?? [],
  };
}

/**
 * Phase 1 invariants: high-level checks the developer can run from
 * /developer-lab to verify the live database has the migrations and
 * helpers Phase 1 depends on. Cannot replace true E2E browser validation
 * but rules out the most common "migrations not applied" footgun before
 * the evaluator hits an obscure RLS denial in the UI.
 */
export interface Phase1Invariant {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'fail';
  detail?: string;
}

export async function getPhase1RlsInvariants(
  supabase: SupabaseServerClient,
): Promise<Phase1Invariant[]> {
  const results: Phase1Invariant[] = [];

  // Migration 00073 — viewer self-test notification RLS.
  try {
    const { error } = await (supabase.rpc as never as (fn: string) => Promise<{ error: { message: string } | null }>)(
      'auth_profile_department_id',
    );
    // The helper from 00060 must exist as a sanity precondition for 00071/00073.
    results.push({
      id: 'helper_auth_profile_department_id',
      label: 'auth_profile_department_id() helper exists (migration 00060)',
      status: error ? 'fail' : 'ok',
      detail: error?.message,
    });
  } catch (err) {
    results.push({
      id: 'helper_auth_profile_department_id',
      label: 'auth_profile_department_id() helper exists (migration 00060)',
      status: 'fail',
      detail: err instanceof Error ? err.message : 'rpc call threw',
    });
  }

  // Calibration request INSERT helper (00072).
  try {
    // We can't INSERT here (we don't know an asset_id), but we can probe
    // for the helper's existence by calling it with a known NULL.
    const { error } = await (supabase.rpc as never as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>)(
      'can_create_calibration_request_for_asset',
      { p_asset_id: null },
    );
    results.push({
      id: 'helper_can_create_calibration_request',
      label: 'can_create_calibration_request_for_asset() helper exists (00072)',
      status: error && !/null/i.test(error.message) ? 'fail' : 'ok',
      detail: error?.message,
    });
  } catch (err) {
    results.push({
      id: 'helper_can_create_calibration_request',
      label: 'can_create_calibration_request_for_asset() helper exists (00072)',
      status: 'fail',
      detail: err instanceof Error ? err.message : 'rpc call threw',
    });
  }

  // offline_sync_events has the Phase 3 columns (00046).
  try {
    const { error } = await supabase
      .from('offline_sync_events')
      .select('reported_status, resolution_status, conflict_type, conflict_reason, role_name, source_route, asset_id, retry_count, resolved_by, resolved_at')
      .limit(1);
    results.push({
      id: 'offline_sync_events_phase3_columns',
      label: 'offline_sync_events has Phase 3 columns (migration 00046)',
      status: error ? 'fail' : 'ok',
      detail: error?.message,
    });
  } catch (err) {
    results.push({
      id: 'offline_sync_events_phase3_columns',
      label: 'offline_sync_events has Phase 3 columns (migration 00046)',
      status: 'fail',
      detail: err instanceof Error ? err.message : 'select threw',
    });
  }

  // notifications.recipient_profile_id column exists.
  try {
    const { error } = await supabase
      .from('notifications')
      .select('recipient_profile_id, dedupe_key, source_type, action_href')
      .limit(1);
    results.push({
      id: 'notifications_schema',
      label: 'notifications table is the expected shape (migration 00055)',
      status: error ? 'fail' : 'ok',
      detail: error?.message,
    });
  } catch (err) {
    results.push({
      id: 'notifications_schema',
      label: 'notifications table is the expected shape (migration 00055)',
      status: 'fail',
      detail: err instanceof Error ? err.message : 'select threw',
    });
  }

  // Department scope helper (00060).
  try {
    const { error } = await (supabase.rpc as never as (fn: string) => Promise<{ error: { message: string } | null }>)(
      'is_dept_scoped_role',
    );
    results.push({
      id: 'helper_is_dept_scoped_role',
      label: 'is_dept_scoped_role() helper exists (migration 00060)',
      status: error ? 'fail' : 'ok',
      detail: error?.message,
    });
  } catch (err) {
    results.push({
      id: 'helper_is_dept_scoped_role',
      label: 'is_dept_scoped_role() helper exists (migration 00060)',
      status: 'fail',
      detail: err instanceof Error ? err.message : 'rpc call threw',
    });
  }

  return results;
}

export async function getDemoRoleIntegrityDiagnostics(supabase: SupabaseServerClient): Promise<{
  rows: DemoRoleValidationResult[];
  source: 'validate_demo_role_integrity_rpc' | 'profiles_fallback';
  warning: string | null;
}> {
  const rpc = await (supabase.rpc as never as (fn: string) => Promise<{ data: RpcDemoRoleRow[] | null; error: { message: string } | null }>)(
    'validate_demo_role_integrity',
  );

  if (!rpc.error && rpc.data) {
    return {
      rows: validateDemoRoleMappings(rpc.data.map(normalizeRpcDemoRow)),
      source: 'validate_demo_role_integrity_rpc',
      warning: null,
    };
  }

  const emails = EXPECTED_DEMO_USERS.map((user) => user.email);
  const { data } = await supabase
    .from('profiles')
    // PostgREST FK hint: user_roles has two FKs to profiles (user_id,
    // assigned_by). Without it, demo-role validation silently returns 0 rows.
    .select('id, email, full_name, job_title, user_id, departments(name), user_roles!user_roles_user_id_fkey(id, roles(name))')
    .in('email', emails);

  const fallbackRows = ((data ?? []) as Array<Record<string, unknown>>).map((row): DemoRoleValidationInput => {
    const roles = ((row.user_roles as Array<{ roles?: { name?: string } | Array<{ name?: string }> | null }> | null) ?? [])
      .flatMap((ur) => {
        if (!ur.roles) return [];
        if (Array.isArray(ur.roles)) return ur.roles.map((role) => role.name).filter(Boolean);
        return [ur.roles.name].filter(Boolean);
      }) as string[];
    const department = Array.isArray(row.departments)
      ? row.departments[0]
      : row.departments as { name?: string | null } | null;

    return {
      email: String(row.email),
      authUserId: null,
      profileId: String(row.id),
      profileUserId: (row.user_id as string | null) ?? null,
      fullName: (row.full_name as string | null) ?? null,
      jobTitle: (row.job_title as string | null) ?? null,
      departmentName: department?.name ?? null,
      assignedRoles: roles,
    };
  });

  return {
    rows: validateDemoRoleMappings(fallbackRows),
    source: 'profiles_fallback',
    warning: `Auth user diagnostics unavailable: ${rpc.error?.message ?? 'validate_demo_role_integrity RPC returned no data'}. Apply migration 00058 before evaluating auth.users linkage.`,
  };
}

async function latestTimestamp(
  query: PromiseLike<{ data: Record<string, unknown> | null; error: { message: string } | null }>,
  columns: string[],
) {
  const { data, error } = await query;
  if (error || !data) return null;
  for (const column of columns) {
    const value = data[column];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

export async function getScoreSnapshotTimestamps(supabase: SupabaseServerClient): Promise<Record<string, string | null>> {
  const [
    risk,
    replacement,
    health,
    readiness,
    pm,
    reliability,
  ] = await Promise.all([
    latestTimestamp(
      supabase
        .from('equipment_risk_scores')
        .select('computed_at, assessed_at')
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle() as never,
      ['computed_at', 'assessed_at'],
    ),
    latestTimestamp(
      supabase
        .from('replacement_priority_scores')
        .select('computed_at')
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle() as never,
      ['computed_at'],
    ),
    latestTimestamp(
      supabase
        .from('equipment_health_snapshots')
        .select('created_at, snapshot_date')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as never,
      ['created_at', 'snapshot_date'],
    ),
    latestTimestamp(
      supabase
        .from('clinical_readiness_snapshots')
        .select('created_at, snapshot_date')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as never,
      ['created_at', 'snapshot_date'],
    ),
    latestTimestamp(
      supabase
        .from('pm_compliance_metrics')
        .select('computed_at')
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle() as never,
      ['computed_at'],
    ),
    latestTimestamp(
      supabase
        .from('equipment_reliability_metrics')
        .select('computed_at')
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle() as never,
      ['computed_at'],
    ),
  ]);

  return {
    rpn_fmea: risk,
    replacement_priority: replacement,
    equipment_health: health,
    department_clinical_readiness: readiness,
    pm_compliance: pm,
    availability: reliability,
    mtbf: reliability,
    mttr: reliability,
  };
}

export async function getNotificationRoleDependencyDiagnostics(supabase: SupabaseServerClient): Promise<{
  roleRecipientCounts: Array<{ role: string; count: number; telegramConnected: number }>;
  telegramConnectionsWithMissingProfile: number | null;
  warnings: string[];
}> {
  const expectedRoles = Array.from(new Set(EXPECTED_DEMO_USERS.map((user) => user.expectedRole)));

  // R14: count Telegram connections per role by joining telegram_connections
  // → profiles → user_roles → roles. A role with N profiles but 0 telegram
  // connections is functional in-app but won't get any Telegram delivery —
  // exactly the kind of silent gap R14 was filed to surface.
  const roleRecipientCounts = await Promise.all(expectedRoles.map(async (role) => {
    const [profilesRes, telegramRes] = await Promise.all([
      supabase
        .from('profiles')
        // PostgREST FK hint: user_roles has two FKs to profiles (user_id,
        // assigned_by). Without it PGRST201 silently zeros every count.
        .select('id, user_roles!user_roles_user_id_fkey!inner(roles!inner(name))', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('user_roles.roles.name', role),
      supabase
        .from('telegram_connections')
        .select('id, profiles!inner(id, is_active, user_roles!user_roles_user_id_fkey!inner(roles!inner(name)))', { count: 'exact', head: true })
        .eq('profiles.is_active', true)
        .eq('profiles.user_roles.roles.name', role),
    ]);
    return {
      role,
      count: profilesRes.error ? 0 : profilesRes.count ?? 0,
      telegramConnected: telegramRes.error ? 0 : telegramRes.count ?? 0,
    };
  }));

  let telegramConnectionsWithMissingProfile: number | null = null;
  const orphanRes = await supabase
    .from('telegram_connections')
    .select('id, profile_id, profiles!telegram_connections_profile_id_fkey(id)')
    .limit(1000);
  if (!orphanRes.error) {
    telegramConnectionsWithMissingProfile = ((orphanRes.data ?? []) as Array<Record<string, unknown>>)
      .filter((row) => {
        const profile = row.profiles;
        if (Array.isArray(profile)) return profile.length === 0;
        return !profile;
      }).length;
  }

  const warnings: string[] = [];
  for (const row of roleRecipientCounts) {
    if (row.count === 0) warnings.push(`Notification recipient resolver found zero active profiles for role ${row.role}.`);
    if (row.count > 0 && row.telegramConnected === 0) {
      // R14: explicit silent-gap warning. A role that has active profiles
      // but zero Telegram connections will get in-app notifications but
      // never any Telegram delivery — operationally fine, but the gap
      // should be visible to whoever is reviewing pre-validation readiness.
      warnings.push(`Role ${row.role} has ${row.count} active profile(s) but zero Telegram connection(s). Telegram-eligible notifications for this role will skip with no_chat_id.`);
    }
  }
  if (telegramConnectionsWithMissingProfile && telegramConnectionsWithMissingProfile > 0) {
    warnings.push(`${telegramConnectionsWithMissingProfile} Telegram connection(s) point to a missing profile.`);
  }
  if (telegramConnectionsWithMissingProfile === null) {
    warnings.push('Telegram connection diagnostics unavailable; table may be missing in this environment.');
  }

  return { roleRecipientCounts, telegramConnectionsWithMissingProfile, warnings };
}
