import type { RoleName } from '@/types/roles';

const ROLE_LABELS: Record<RoleName, string> = {
  developer: 'Developer',
  admin: 'Admin',
  bme_head: 'BME Head',
  technician: 'Technician',
  department_head: 'Department Head',
  department_user: 'Department User',
  store_user: 'Store User',
  viewer: 'Viewer',
};

export function formatRoleName(role: string | null | undefined): string {
  if (!role) return 'User';
  if (role in ROLE_LABELS) {
    return ROLE_LABELS[role as RoleName];
  }
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
