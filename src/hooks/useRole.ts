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
  const isTechnician = isDeveloper || roles.includes('technician');
  const isStoreUser = isDeveloper || roles.includes('store_user');
  const isDepartmentUser = isDeveloper || roles.includes('department_user');
  const isViewer = isDeveloper || roles.includes('viewer');

  const canManageEquipment = isDeveloper || isAdmin || isTechnician;
  const canManageMaintenance = isDeveloper || isAdmin || isTechnician;
  const canManageParts = isDeveloper || isAdmin || isTechnician || isStoreUser;
  const canManageUsers = isDeveloper || isAdmin;
  const canManageSettings = isDeveloper || isAdmin;
  const canViewAnalytics = isDeveloper || isAdmin || isTechnician || isViewer;
  const canCreateRequests = isDeveloper || isAdmin || isTechnician || isDepartmentUser;

  return {
    roles,
    primaryRole,
    isDeveloper,
    isAdmin,
    isTechnician,
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
