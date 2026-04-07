export const APP_NAME = 'MedEquip Pro';
export const APP_DESCRIPTION = 'Medical Equipment Management and Decision-Support System';
export const HOSPITAL_NAME = "St. Peter's Specialized Hospital";

export const ROUTES = {
  LOGIN: '/login',
  RESET_PASSWORD: '/reset-password',
  DASHBOARD: '/',
  INVENTORY: '/inventory',
  INVENTORY_NEW: '/inventory/new',
  MAINTENANCE: '/maintenance',
  MAINTENANCE_REQUESTS: '/maintenance/requests',
  MAINTENANCE_WORK_ORDERS: '/maintenance/work-orders',
  PM: '/pm',
  PM_PLANS: '/pm/plans',
  PM_SCHEDULES: '/pm/schedules',
  CALIBRATION: '/calibration',
  SPARE_PARTS: '/spare-parts',
  TRAINING: '/training',
  DISPOSAL: '/disposal',
  REPORTS: '/reports',
  ANALYTICS: '/analytics',
  ANALYTICS_RELIABILITY: '/analytics/reliability',
  ANALYTICS_RISK: '/analytics/risk',
  ANALYTICS_PMC: '/analytics/pmc',
  ANALYTICS_PERFORMANCE: '/analytics/performance',
  REPLACEMENT: '/replacement',
  ALERTS: '/alerts',
  SETTINGS: '/settings',
  USERS: '/users',
  DOCUMENTS: '/documents',
  INSTALLATION: '/installation',
} as const;

export const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: ROUTES.DASHBOARD, icon: 'LayoutDashboard', roles: ['admin', 'technician', 'department_user', 'store_user', 'viewer'] },
      { label: 'Alerts', href: ROUTES.ALERTS, icon: 'Bell', roles: ['admin', 'technician'] },
    ],
  },
  {
    title: 'Asset Management',
    items: [
      { label: 'Equipment Inventory', href: ROUTES.INVENTORY, icon: 'Monitor', roles: ['admin', 'technician', 'department_user', 'store_user', 'viewer'] },
      { label: 'Documents', href: ROUTES.DOCUMENTS, icon: 'FileText', roles: ['admin', 'technician', 'department_user'] },
      { label: 'Installation', href: ROUTES.INSTALLATION, icon: 'PackageCheck', roles: ['admin', 'technician'] },
    ],
  },
  {
    title: 'Maintenance',
    items: [
      { label: 'Maintenance', href: ROUTES.MAINTENANCE, icon: 'Wrench', roles: ['admin', 'technician', 'department_user'] },
      { label: 'Preventive Maintenance', href: ROUTES.PM, icon: 'CalendarCheck', roles: ['admin', 'technician'] },
      { label: 'Calibration', href: ROUTES.CALIBRATION, icon: 'Gauge', roles: ['admin', 'technician'] },
    ],
  },
  {
    title: 'Support',
    items: [
      { label: 'Spare Parts', href: ROUTES.SPARE_PARTS, icon: 'Package', roles: ['admin', 'technician', 'store_user'] },
      { label: 'Training', href: ROUTES.TRAINING, icon: 'GraduationCap', roles: ['admin', 'technician', 'department_user'] },
      { label: 'Disposal', href: ROUTES.DISPOSAL, icon: 'Trash2', roles: ['admin', 'technician'] },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { label: 'Reliability Analytics', href: ROUTES.ANALYTICS_RELIABILITY, icon: 'Activity', roles: ['admin', 'technician', 'viewer'] },
      { label: 'Risk Scoring', href: ROUTES.ANALYTICS_RISK, icon: 'ShieldAlert', roles: ['admin', 'technician', 'viewer'] },
      { label: 'PM Compliance', href: ROUTES.ANALYTICS_PMC, icon: 'CheckCircle', roles: ['admin', 'technician', 'viewer'] },
      { label: 'Performance Scores', href: ROUTES.ANALYTICS_PERFORMANCE, icon: 'BarChart3', roles: ['admin', 'technician', 'viewer'] },
      { label: 'Replacement Priority', href: ROUTES.REPLACEMENT, icon: 'ArrowUpDown', roles: ['admin', 'technician', 'viewer'] },
    ],
  },
  {
    title: 'Reports',
    items: [
      { label: 'Reports', href: ROUTES.REPORTS, icon: 'FileBarChart', roles: ['admin', 'technician', 'department_user', 'viewer'] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Users & Roles', href: ROUTES.USERS, icon: 'Users', roles: ['admin'] },
      { label: 'Settings', href: ROUTES.SETTINGS, icon: 'Settings', roles: ['admin'] },
    ],
  },
] as const;

export const CONDITION_COLORS: Record<string, string> = {
  functional: '#10B981',
  needs_repair: '#F59E0B',
  non_functional: '#EF4444',
  under_maintenance: '#6366F1',
  decommissioned: '#6B7280',
};

export const URGENCY_COLORS: Record<string, string> = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#F97316',
  critical: '#EF4444',
};
