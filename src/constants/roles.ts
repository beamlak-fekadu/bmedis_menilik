import type { RoleName } from '@/types/database';

export interface RoleConfig {
  label: string;
  shortLabel: string;
  dashboardFocus: string;
  accessLevel: string;
  description: string;
}

export const ROLE_CONFIG = {
  developer: {
    label: 'Developer',
    shortLabel: 'Thesis Developer',
    dashboardFocus: 'Full-system validation, thesis controls, debug tooling, and demo operations.',
    accessLevel: 'Developer-only full access',
    description: 'Owns research/demo configuration, diagnostics, reset tooling, telemetry checks, and all operational modules.',
  },
  admin: {
    label: 'Legacy System Admin',
    shortLabel: 'Admin',
    dashboardFocus: 'Backward-compatible administrative oversight across users, settings, operations, and reports.',
    accessLevel: 'Broad administrative access',
    description: 'Maintains the legacy full-access administrator role while the real-user testing model is introduced.',
  },
  bme_head: {
    label: 'Biomedical Engineering Head',
    shortLabel: 'BME Head',
    dashboardFocus: 'Operational biomedical management, reliability, decision support, and departmental coordination.',
    accessLevel: 'Operational leadership access',
    description: 'Oversees equipment, maintenance, PM, calibration, lifecycle decisions, alerts, reports, and team workflows.',
  },
  technician: {
    label: 'Biomedical Engineer / Technician',
    shortLabel: 'Technician',
    dashboardFocus: 'Hands-on maintenance, work orders, PM, calibration, equipment updates, and spare parts usage.',
    accessLevel: 'Operational execution access',
    description: 'Executes biomedical engineering work while seeing the operational modules needed for daily service delivery.',
  },
  department_head: {
    label: 'Department Head',
    shortLabel: 'Dept Head',
    dashboardFocus: 'Department-level readiness, equipment visibility, request tracking, work orders, training, and reports.',
    accessLevel: 'Department leadership access',
    description: 'Reviews department equipment health and follows requests/work orders with broader visibility than a department user.',
  },
  department_user: {
    label: 'Department User / Equipment Focal Person',
    shortLabel: 'Dept User',
    dashboardFocus: 'Department equipment visibility, maintenance requests, training requests, reports, and support channels.',
    accessLevel: 'Department request access',
    description: 'Submits and follows department equipment support needs without administrative or technical mutation access.',
  },
  store_user: {
    label: 'Store / Logistics Officer',
    shortLabel: 'Store',
    dashboardFocus: 'Spare parts, logistics, procurement, equipment reference, reports, and supply support.',
    accessLevel: 'Logistics access',
    description: 'Manages spare-part and logistics workflows while retaining read access to related equipment context.',
  },
  viewer: {
    label: 'Hospital Management / Evaluator',
    shortLabel: 'Viewer',
    dashboardFocus: 'Read-only command center, decision support, equipment visibility, replacement priorities, and reports.',
    accessLevel: 'Read-only evaluation access',
    description: 'Reviews operational and decision-support evidence without access to create, edit, or administer records.',
  },
} satisfies Record<RoleName, RoleConfig>;
