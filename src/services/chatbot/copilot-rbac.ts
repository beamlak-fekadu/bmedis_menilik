import { hasCapability } from '@/lib/rbac';
import { ROLE_NAMES, type RoleName } from '@/types/roles';
import type { UserChatProfile } from '@/types/chatbot';

export type CopilotRoleCategory =
  | 'developer'
  | 'admin'
  | 'bme_head'
  | 'technician'
  | 'store_user'
  | 'department_head'
  | 'department_user'
  | 'viewer'
  | 'unknown';

export type CopilotDraftType =
  | 'maintenance_request'
  | 'work_order_note'
  | 'procurement_request'
  | 'calibration_request'
  | 'training_request'
  | 'disposal_request'
  | 'report_note';

export type CopilotActionType =
  | 'developer_smoke_test'
  | 'inspect_telemetry'
  | 'create_draft'
  | 'execute_mutation'
  | 'view_usage';

const ROLE_PRIORITY: RoleName[] = [
  'developer',
  'admin',
  'bme_head',
  'technician',
  'store_user',
  'department_head',
  'department_user',
  'viewer',
];

function roleSet(profile: Pick<UserChatProfile, 'roleNames'> | null | undefined) {
  const validRoles = new Set<string>(ROLE_NAMES);
  return new Set((profile?.roleNames ?? []).filter((role) => validRoles.has(role)));
}

export function getCopilotRoleCategory(profile: Pick<UserChatProfile, 'roleNames'> | null | undefined): CopilotRoleCategory {
  const roles = roleSet(profile);
  const selected = ROLE_PRIORITY.find((role) => roles.has(role));
  return selected ?? 'unknown';
}

export function canUseDeveloperCopilotDiagnostics(profile: Pick<UserChatProfile, 'roleNames'> | null | undefined) {
  return hasCapability(profile?.roleNames ?? [], 'developer.diagnostics');
}

export function canReadAllOperationalCopilotContext(profile: Pick<UserChatProfile, 'roleNames'> | null | undefined) {
  const roles = roleSet(profile);
  return roles.has('developer') || roles.has('admin') || roles.has('bme_head') || roles.has('viewer');
}

export function canReadDepartmentCopilotContext(profile: Pick<UserChatProfile, 'roleNames' | 'departmentId'> | null | undefined) {
  const roles = roleSet(profile);
  return canReadAllOperationalCopilotContext(profile) || roles.has('department_head') || roles.has('department_user');
}

export function canUseTechnicianCopilotContext(profile: Pick<UserChatProfile, 'roleNames'> | null | undefined) {
  const roles = roleSet(profile);
  return canReadAllOperationalCopilotContext(profile) || roles.has('technician');
}

export function canUseStoreCopilotContext(profile: Pick<UserChatProfile, 'roleNames'> | null | undefined) {
  const roles = roleSet(profile);
  return canReadAllOperationalCopilotContext(profile) || roles.has('store_user');
}

export function canUseViewerCopilotContext(profile: Pick<UserChatProfile, 'roleNames'> | null | undefined) {
  const roles = roleSet(profile);
  return canReadAllOperationalCopilotContext(profile) || roles.has('viewer');
}

export function requiresDepartmentScope(profile: Pick<UserChatProfile, 'roleNames'> | null | undefined) {
  const roles = roleSet(profile);
  return !canReadAllOperationalCopilotContext(profile) && (roles.has('department_head') || roles.has('department_user'));
}

export function canReadCopilotDepartment(
  profile: Pick<UserChatProfile, 'roleNames' | 'departmentId'> | null | undefined,
  departmentId: string | null | undefined
) {
  if (!departmentId) return true;
  if (canReadAllOperationalCopilotContext(profile)) return true;
  if (requiresDepartmentScope(profile)) return Boolean(profile?.departmentId && profile.departmentId === departmentId);
  return false;
}

export function canCreateCopilotDraft(
  profile: Pick<UserChatProfile, 'roleNames'> | null | undefined,
  draftType: CopilotDraftType
) {
  const roles = profile?.roleNames ?? [];
  if (canUseDeveloperCopilotDiagnostics(profile) || roles.includes('admin') || roles.includes('bme_head')) return true;
  if (draftType === 'work_order_note') return roles.includes('technician');
  if (draftType === 'procurement_request') return roles.includes('store_user') || roles.includes('technician');
  if (draftType === 'maintenance_request' || draftType === 'calibration_request' || draftType === 'training_request') {
    return roles.includes('department_head') || roles.includes('department_user') || roles.includes('technician');
  }
  if (draftType === 'disposal_request') return roles.includes('department_head') || roles.includes('department_user');
  return false;
}

export function canExecuteCopilotAction(
  profile: Pick<UserChatProfile, 'roleNames'> | null | undefined,
  actionType: CopilotActionType
) {
  if (actionType === 'developer_smoke_test') return canUseDeveloperCopilotDiagnostics(profile);
  if (actionType === 'inspect_telemetry') return canInspectCopilotTelemetry(profile);
  if (actionType === 'view_usage') return canSeeCopilotUsageDashboard(profile);
  if (actionType === 'create_draft') return false;
  return false;
}

export function canInspectCopilotTelemetry(profile: Pick<UserChatProfile, 'roleNames'> | null | undefined) {
  const roles = roleSet(profile);
  return roles.has('developer') || roles.has('admin') || roles.has('bme_head');
}

export function canSeeCopilotUsageDashboard(profile: Pick<UserChatProfile, 'roleNames'> | null | undefined) {
  return canInspectCopilotTelemetry(profile);
}
