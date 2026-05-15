'use client';

import { useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import { hasCapability, hasAnyCapability, type Capability } from '@/lib/rbac';

export function useRole() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);

  const roles = useMemo(() => profile?.roleNames || [], [profile?.roleNames]);
  const primaryRole = profile?.primaryRole || 'viewer';

  const isDeveloper = roles.includes('developer');
  const isAdmin = isDeveloper || roles.includes('admin');
  const isBmeHead = isDeveloper || roles.includes('bme_head');
  const isTechnician = isDeveloper || roles.includes('technician');
  const isDepartmentHead = isDeveloper || roles.includes('department_head');
  const isStoreUser = isDeveloper || roles.includes('store_user');
  const isDepartmentUser = isDeveloper || roles.includes('department_user');
  const isViewer = isDeveloper || roles.includes('viewer');

  // Capability-based checks delegate to the canonical CAPABILITY_MATRIX in
  // src/lib/rbac.ts. Prefer `can(capability)` over the legacy `isX` / `canX`
  // booleans in new code.
  const can = useCallback(
    (capability: Capability) => hasCapability(roles, capability),
    [roles]
  );
  const canAny = useCallback(
    (capabilities: Capability[]) => hasAnyCapability(roles, capabilities),
    [roles]
  );

  // Legacy boolean helpers (kept for back-compat). New code should call `can`.
  const canManageEquipment = can('equipment.create') || can('equipment.edit');
  const canManageMaintenance = can('work_order.assign') || can('maintenance.request.approve') || can('work_order.complete');
  const canManageParts = can('spare_parts.manage');
  const canManageUsers = can('users.manage');
  const canManageSettings = canManageUsers;
  const canViewAnalytics = can('reports.view');
  const canCreateRequests = can('maintenance.request.create') || can('calibration.request.create') || can('training.request.create');

  return {
    roles,
    primaryRole,
    isDeveloper,
    isAdmin,
    isBmeHead,
    isTechnician,
    isDepartmentHead,
    isStoreUser,
    isDepartmentUser,
    isViewer,
    can,
    canAny,
    canManageEquipment,
    canManageMaintenance,
    canManageParts,
    canManageUsers,
    canManageSettings,
    canViewAnalytics,
    canCreateRequests,
  };
}
