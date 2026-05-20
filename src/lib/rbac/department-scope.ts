// R4: centralized department-scope helper.
//
// Why this exists:
//   Before Phase 1, RLS allowed broad authenticated SELECT on most operational
//   tables. Department-scoped roles (department_head / department_user) were
//   only constrained by ad-hoc service-layer `eq('department_id', ...)`
//   filters. Any service or page that forgot the filter could leak data
//   across departments to a department user.
//
//   Migration 00060 closes the hole at the DB layer for the highest-risk
//   tables (equipment_assets, maintenance_requests, work_orders, PM,
//   calibration, analytics). This module is the matching app-layer helper —
//   one place to ask "for this caller, what department filter should this
//   query receive?" and one place to verify a department user has a
//   department assignment.
//
// Pattern:
//   const scope = departmentScopeFor({ roleNames, departmentId });
//   if (scope.kind === 'denied') return { rows: [], denied: scope.reason };
//   const q = supabase.from('equipment_assets').select('*');
//   const scoped = applyDepartmentScope(q, 'department_id', scope);
//   const { data } = await scoped;
//
//   The helper is exhaustive over the role categories. If a caller has no
//   roles, scope is 'denied' rather than silently falling through.

import type { RoleName } from '@/types/roles';

const CROSS_DEPARTMENT_ROLES = new Set<RoleName>([
  'developer',
  'admin',
  'bme_head',
  'technician',
  'store_user',
  'viewer',
]);

const DEPARTMENT_SCOPED_ROLES = new Set<RoleName>([
  'department_head',
  'department_user',
]);

export type DepartmentScopeInput = {
  roleNames: string[];
  departmentId: string | null;
};

export type DepartmentScope =
  | { kind: 'unrestricted' }
  | { kind: 'department'; departmentId: string }
  | { kind: 'denied'; reason: DepartmentScopeDenialReason };

export type DepartmentScopeDenialReason =
  | 'no_roles'
  | 'department_user_missing_department';

export function departmentScopeFor(input: DepartmentScopeInput): DepartmentScope {
  const roles = input.roleNames ?? [];
  if (roles.length === 0) return { kind: 'denied', reason: 'no_roles' };

  // Cross-department roles (including developer/admin/bme_head/technician/
  // store_user/viewer) win even if the caller also has a department role —
  // matches the existing capability matrix behavior where the broadest role
  // grants access.
  if (roles.some((r) => CROSS_DEPARTMENT_ROLES.has(r as RoleName))) {
    return { kind: 'unrestricted' };
  }

  if (roles.some((r) => DEPARTMENT_SCOPED_ROLES.has(r as RoleName))) {
    if (!input.departmentId) {
      return { kind: 'denied', reason: 'department_user_missing_department' };
    }
    return { kind: 'department', departmentId: input.departmentId };
  }

  // Unknown role names — fail closed.
  return { kind: 'denied', reason: 'no_roles' };
}

// Apply a department filter to a Supabase query builder. Returns the (possibly
// modified) query. For 'unrestricted' callers the query is returned unchanged.
// For 'denied' callers the query is also returned unchanged — callers must
// branch on scope.kind === 'denied' BEFORE invoking this helper to short-circuit
// the request. The helper itself is intentionally permissive so it cannot
// silently turn a denial into a successful empty result.
//
// Generic over the query builder because @supabase/postgrest-js returns
// many parameterized types depending on the select shape.
export function applyDepartmentScope<Q extends { eq: (col: string, val: string) => Q }>(
  query: Q,
  departmentColumn: string,
  scope: DepartmentScope,
): Q {
  if (scope.kind === 'department') {
    return query.eq(departmentColumn, scope.departmentId);
  }
  return query;
}

// Convenience: returns true iff the caller is a department-scoped role with
// a valid department. Useful for UI surfaces ("show department badge").
export function isDepartmentScoped(scope: DepartmentScope): scope is { kind: 'department'; departmentId: string } {
  return scope.kind === 'department';
}

// Convenience: human-readable denial copy for surface error banners.
export function denialMessage(reason: DepartmentScopeDenialReason): string {
  switch (reason) {
    case 'no_roles':
      return 'Your account has no assigned roles. Please contact an administrator.';
    case 'department_user_missing_department':
      return 'Your account has a department role but no department assignment. Please contact an administrator.';
  }
}
