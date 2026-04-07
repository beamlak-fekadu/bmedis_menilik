'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  UserPlus,
  MoreVertical,
  ShieldCheck,
  ShieldOff,
  UserCog,
  Users,
} from 'lucide-react';
import * as usersService from '@/services/users.service';
import {
  PageHeader,
  DataTable,
  Button,
  Badge,
  Modal,
  Select,
  Dropdown,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { PageLoader } from '@/components/ui/Spinner';

interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department_id: string | null;
  job_title: string | null;
  is_active: boolean;
  created_at: string;
  departments: { id: string; name: string; code: string } | null;
  user_roles: {
    id: string;
    role_id: string;
    assigned_at: string;
    roles: { id: string; name: string; description: string | null; permissions: string[] };
  }[];
}

interface RoleOption {
  id: string;
  name: string;
  description: string | null;
}

const ROLE_VARIANT: Record<string, 'info' | 'purple' | 'warning' | 'success' | 'default'> = {
  admin: 'purple',
  technician: 'info',
  department_user: 'warning',
  store_user: 'success',
  viewer: 'default',
};

export default function UsersPage() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ProfileRow | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [saving, setSaving] = useState(false);

  const [toggleTarget, setToggleTarget] = useState<ProfileRow | null>(null);
  const [toggling, setToggling] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, rolesRes] = await Promise.all([
        usersService.getProfiles(),
        usersService.getRoles(),
      ]);
      if (profilesRes.data) setProfiles(profilesRes.data as unknown as ProfileRow[]);
      if (rolesRes.data) setRoles(rolesRes.data as unknown as RoleOption[]);
    } catch {
      toast('error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openRoleModal = (user: ProfileRow) => {
    setSelectedUser(user);
    setSelectedRoleId('');
    setRoleModalOpen(true);
  };

  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRoleId) {
      toast('warning', 'Please select a role');
      return;
    }

    const alreadyHas = selectedUser.user_roles.some((ur) => ur.roles.id === selectedRoleId);
    if (alreadyHas) {
      toast('warning', 'User already has this role');
      return;
    }

    setSaving(true);
    try {
      const { error } = await usersService.assignRole(selectedUser.user_id, selectedRoleId);
      if (error) throw error;
      toast('success', 'Role assigned successfully');
      setRoleModalOpen(false);
      fetchData();
    } catch {
      toast('error', 'Failed to assign role');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveRole = async (user: ProfileRow, roleId: string) => {
    try {
      const { error } = await usersService.removeRole(user.user_id, roleId);
      if (error) throw error;
      toast('success', 'Role removed successfully');
      fetchData();
    } catch {
      toast('error', 'Failed to remove role');
    }
  };

  const handleToggleActive = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      const { error } = await usersService.updateProfile(toggleTarget.id, {
        is_active: !toggleTarget.is_active,
      });
      if (error) throw error;
      toast('success', `User ${toggleTarget.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchData();
    } catch {
      toast('error', 'Failed to update user status');
    } finally {
      setToggling(false);
      setToggleTarget(null);
    }
  };

  const columns = [
    {
      key: 'full_name',
      header: 'Name',
      sortable: true,
      searchable: true,
      render: (row: Record<string, unknown>) => {
        const user = row as unknown as ProfileRow;
        return (
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{user.full_name}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        );
      },
    },
    {
      key: 'departments',
      header: 'Department',
      render: (row: Record<string, unknown>) => {
        const user = row as unknown as ProfileRow;
        return user.departments?.name ?? '—';
      },
    },
    {
      key: 'job_title',
      header: 'Job Title',
    },
    {
      key: 'user_roles',
      header: 'Roles',
      render: (row: Record<string, unknown>) => {
        const user = row as unknown as ProfileRow;
        if (!user.user_roles || user.user_roles.length === 0) {
          return <span className="text-gray-400">No roles</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {user.user_roles.map((ur) => (
              <Badge
                key={ur.id}
                variant={ROLE_VARIANT[ur.roles.name] ?? 'default'}
              >
                {ur.roles.name.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row: Record<string, unknown>) => {
        const user = row as unknown as ProfileRow;
        return (
          <Badge variant={user.is_active ? 'success' : 'default'}>
            {user.is_active ? 'Active' : 'Inactive'}
          </Badge>
        );
      },
    },
    {
      key: '_actions',
      header: '',
      sortable: false,
      searchable: false,
      className: 'w-12',
      render: (row: Record<string, unknown>) => {
        const user = row as unknown as ProfileRow;
        return (
          <Dropdown
            trigger={
              <button className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
                <MoreVertical className="h-4 w-4" />
              </button>
            }
            items={[
              {
                label: 'Manage Roles',
                icon: <UserCog className="h-4 w-4" />,
                onClick: () => openRoleModal(user),
              },
              {
                label: user.is_active ? 'Deactivate' : 'Activate',
                icon: user.is_active ? (
                  <ShieldOff className="h-4 w-4" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                ),
                destructive: user.is_active,
                onClick: () => setToggleTarget(user),
              },
            ]}
          />
        );
      },
    },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        description="Manage user accounts, roles, and permissions"
        actions={
          <Button onClick={() => setAddModalOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={profiles as unknown as Record<string, unknown>[]}
        searchPlaceholder="Search users by name or email..."
        emptyMessage="No users found"
      />

      {/* Add User Placeholder Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add User"
        footer={
          <Button variant="outline" onClick={() => setAddModalOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="rounded-full bg-blue-50 p-4 dark:bg-blue-900/20">
            <Users className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              User Registration
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              New users are created through Supabase Auth. Invite users via the authentication
              provider, and they will appear here after their first login.
            </p>
          </div>
        </div>
      </Modal>

      {/* Assign Role Modal */}
      <Modal
        open={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        title={`Manage Roles — ${selectedUser?.full_name ?? ''}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setRoleModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAssignRole} loading={saving}>
              Assign Role
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Current roles */}
          {selectedUser && selectedUser.user_roles.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Current Roles
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedUser.user_roles.map((ur) => (
                  <span
                    key={ur.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-3 pr-1 text-sm dark:bg-gray-800"
                  >
                    {ur.roles.name.replace(/_/g, ' ')}
                    <button
                      onClick={() => handleRemoveRole(selectedUser, ur.role_id)}
                      className="ml-1 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-red-600 dark:hover:bg-gray-700"
                      title="Remove role"
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <Select
            label="Add Role"
            placeholder="Select a role..."
            options={roles.map((r) => ({ value: r.id, label: r.name.replace(/_/g, ' ') }))}
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
          />
        </div>
      </Modal>

      {/* Toggle Active Confirmation */}
      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggleActive}
        title={toggleTarget?.is_active ? 'Deactivate User' : 'Activate User'}
        description={
          toggleTarget?.is_active
            ? `Are you sure you want to deactivate ${toggleTarget?.full_name}? They will lose access to the system.`
            : `Are you sure you want to activate ${toggleTarget?.full_name}? They will regain access to the system.`
        }
        confirmLabel={toggleTarget?.is_active ? 'Deactivate' : 'Activate'}
        loading={toggling}
        destructive={!!toggleTarget?.is_active}
      />
    </div>
  );
}
