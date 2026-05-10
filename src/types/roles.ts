export const ROLE_NAMES = [
  'developer',
  'admin',
  'bme_head',
  'technician',
  'department_head',
  'department_user',
  'store_user',
  'viewer',
] as const;

export type RoleName = typeof ROLE_NAMES[number];
