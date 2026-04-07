'use client';

import { useAuth } from './useAuth';
import { useProfile } from './useProfile';

export function useRole() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);

  const roles = profile?.roleNames || [];
  const primaryRole = profile?.primaryRole || 'viewer';

  const isAdmin = roles.includes('admin');
  const isTechnician = roles.includes('technician');
  const isStoreUser = roles.includes('store_user');
  const isDepartmentUser = roles.includes('department_user');
  const isViewer = roles.includes('viewer');

  const canManageEquipment = isAdmin || isTechnician;
  const canManageMaintenance = isAdmin || isTechnician;
  const canManageParts = isAdmin || isTechnician || isStoreUser;
  const canManageUsers = isAdmin;
  const canManageSettings = isAdmin;
  const canViewAnalytics = isAdmin || isTechnician || isViewer;
  const canCreateRequests = isAdmin || isTechnician || isDepartmentUser;

  return {
    roles,
    primaryRole,
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
