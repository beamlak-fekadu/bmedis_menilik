// Role-aware accent tokens for BMEDIS workspaces.
//
// The base theme tokens (--brand, --surface-*, --success, etc) stay identical
// across roles — we don't want a technician to see a wildly different palette
// from a BME Head. This module only adjusts an *accent hue* and a short
// descriptor that lets role-aware shells / PageHeader put
// a consistent visual tag on top of the shared surface.

import type { RoleName } from '@/types/roles';

export type RoleAccent = {
  /** Display label for the role workspace */
  workspaceLabel: string;
  /** One-line subtitle for role-aware headers */
  workspaceSubtitle: string;
  /** Hex/CSS accent for ring/badge/icon tint */
  accent: string;
  /** Soft background tint (low alpha) for accent badges */
  accentSoft: string;
  /** Accent foreground for text on accent backgrounds */
  accentText: string;
  /** Whether to allow dense diagnostic surfaces (developer only) */
  allowDense: boolean;
};

// Tints are deliberately calm and within the BMEDIS palette. Brand blue stays
// dominant — accents are visible only in the role chip / workspace header.
export const ROLE_ACCENTS: Record<RoleName, RoleAccent> = {
  developer: {
    workspaceLabel: 'Developer Workspace',
    workspaceSubtitle: 'Diagnostics, telemetry, and thesis controls',
    accent: '#7c3aed',
    accentSoft: 'color-mix(in oklab, #7c3aed 16%, transparent)',
    accentText: 'color-mix(in oklab, #7c3aed 80%, white)',
    allowDense: true,
  },
  admin: {
    workspaceLabel: 'Administration',
    workspaceSubtitle: 'Hospital configuration and access control',
    accent: '#2563eb',
    accentSoft: 'color-mix(in oklab, #2563eb 14%, transparent)',
    accentText: '#1d4ed8',
    allowDense: false,
  },
  bme_head: {
    workspaceLabel: 'BME Command Center',
    workspaceSubtitle: 'Priorities, readiness, and decision support',
    accent: '#2563eb',
    accentSoft: 'color-mix(in oklab, #2563eb 14%, transparent)',
    accentText: '#1d4ed8',
    allowDense: false,
  },
  technician: {
    workspaceLabel: 'Field Workbench',
    workspaceSubtitle: 'Your assigned work and on-site evidence',
    accent: '#059669',
    accentSoft: 'color-mix(in oklab, #059669 16%, transparent)',
    accentText: '#047857',
    allowDense: false,
  },
  store_user: {
    workspaceLabel: 'Logistics Control',
    workspaceSubtitle: 'Stock, receipts, issues, and reorder pipeline',
    accent: '#d97706',
    accentSoft: 'color-mix(in oklab, #d97706 16%, transparent)',
    accentText: '#b45309',
    allowDense: false,
  },
  department_head: {
    workspaceLabel: 'Department Oversight',
    workspaceSubtitle: 'Service readiness, requests, and compliance for your department',
    accent: '#0891b2',
    accentSoft: 'color-mix(in oklab, #0891b2 16%, transparent)',
    accentText: '#0e7490',
    allowDense: false,
  },
  department_user: {
    workspaceLabel: 'Department Workspace',
    workspaceSubtitle: 'Report problems and track your requests',
    accent: '#0891b2',
    accentSoft: 'color-mix(in oklab, #0891b2 14%, transparent)',
    accentText: '#0e7490',
    allowDense: false,
  },
  viewer: {
    workspaceLabel: 'Executive Oversight',
    workspaceSubtitle: 'Readiness, risk, and evidence — read-only',
    accent: '#475569',
    accentSoft: 'color-mix(in oklab, #475569 14%, transparent)',
    accentText: '#334155',
    allowDense: false,
  },
};

export function getRoleAccent(role: RoleName | null | undefined): RoleAccent {
  if (!role) return ROLE_ACCENTS.viewer;
  return ROLE_ACCENTS[role] ?? ROLE_ACCENTS.viewer;
}
