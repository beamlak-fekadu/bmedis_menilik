'use client';

import { useAuth } from './useAuth';
import { useProfile } from './useProfile';

export function useRole() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);

  const roles = profile?.roleNames || [];
  const primaryRole = profile?.primaryRole || 'viewer';

  const isDeveloper = roles.includes('developer');
  const isAdmin = isDeveloper || roles.includes('admin');
  const isBmeHead = isDeveloper || roles.includes('bme_head');
  const isTechnician = isDeveloper || roles.includes('technician');
  const isDepartmentHead = isDeveloper || roles.includes('department_head');
  const isStoreUser = isDeveloper || roles.includes('store_user');
  const isDepartmentUser = isDeveloper || roles.includes('department_user');
  const isViewer = isDeveloper || roles.includes('viewer');

  const canManageEquipment = isDeveloper || isAdmin || isBmeHead || isTechnician;
  const canManageMaintenance = isDeveloper || isAdmin || isBmeHead || isTechnician;
  const canManageParts = isDeveloper || isAdmin || isBmeHead || isTechnician || isStoreUser;
  const canManageUsers = isDeveloper || isAdmin;
  const canManageSettings = isDeveloper || isAdmin;
  const canViewAnalytics = isDeveloper || isAdmin || isBmeHead || isTechnician || isDepartmentHead || isViewer;
  const canCreateRequests = isDeveloper || isAdmin || isBmeHead || isTechnician || isDepartmentHead || isDepartmentUser;

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
    canManageEquipment,
    canManageMaintenance,
    canManageParts,
    canManageUsers,
    canManageSettings,
    canViewAnalytics,
    canCreateRequests,
  };
}
