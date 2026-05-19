export type DemoRoleValidationReason =
  | 'MISSING_AUTH_USER'
  | 'MISSING_PROFILE'
  | 'PROFILE_NOT_LINKED_TO_AUTH'
  | 'WRONG_NAME'
  | 'WRONG_JOB_TITLE'
  | 'WRONG_DEPARTMENT'
  | 'MISSING_ROLE'
  | 'WRONG_ROLE'
  | 'MULTIPLE_ROLES'
  | 'OK';

export interface ExpectedDemoUser {
  email: string;
  expectedFullName: string;
  expectedJobTitle: string;
  expectedRole: string;
  expectedDepartmentName: string | null;
  navigationFocus: string;
}

export interface DemoRoleValidationInput {
  email: string;
  authUserId: string | null;
  profileId: string | null;
  profileUserId: string | null;
  fullName: string | null;
  jobTitle: string | null;
  departmentName: string | null;
  assignedRoles: string[];
}

export interface DemoRoleValidationResult extends DemoRoleValidationInput {
  expectedFullName: string;
  expectedJobTitle: string;
  expectedRole: string;
  expectedDepartmentName: string | null;
  navigationFocus: string;
  primaryReason: DemoRoleValidationReason;
  reasons: DemoRoleValidationReason[];
}

export const EXPECTED_DEMO_USERS: ExpectedDemoUser[] = [
  {
    email: 'developer@bmerms-demo.local',
    expectedFullName: 'BMEDIS Developer',
    expectedJobTitle: 'Thesis Developer',
    expectedRole: 'developer',
    expectedDepartmentName: null,
    navigationFocus: 'Everything plus Developer Lab',
  },
  {
    email: 'bme.head@bmerms-demo.local',
    expectedFullName: 'Ermias Tadesse',
    expectedJobTitle: 'Biomedical Engineering Head',
    expectedRole: 'bme_head',
    expectedDepartmentName: null,
    navigationFocus: 'All operational modules; no Developer Lab',
  },
  {
    email: 'technician@bmerms-demo.local',
    expectedFullName: 'Hanna Gebremedhin',
    expectedJobTitle: 'Clinical Engineer',
    expectedRole: 'technician',
    expectedDepartmentName: null,
    navigationFocus: 'Work execution, PM, calibration, parts, and notifications',
  },
  {
    email: 'department.head@bmerms-demo.local',
    expectedFullName: 'Tigist Worku',
    expectedJobTitle: 'ICU Head',
    expectedRole: 'department_head',
    expectedDepartmentName: 'Intensive Care Unit',
    navigationFocus: 'Department equipment, requests, readiness, and reports',
  },
  {
    email: 'department.user@bmerms-demo.local',
    expectedFullName: 'Dr. Fitsum Haile',
    expectedJobTitle: 'Radiologist',
    expectedRole: 'department_user',
    expectedDepartmentName: 'Radiology and Imaging',
    navigationFocus: 'Create and view department requests',
  },
  {
    email: 'store.user@bmerms-demo.local',
    expectedFullName: 'Ato Biniam Teshome',
    expectedJobTitle: 'Medical Equipment Store Officer',
    expectedRole: 'store_user',
    expectedDepartmentName: null,
    navigationFocus: 'Spare parts, logistics, procurement, and notifications',
  },
  {
    email: 'viewer@bmerms-demo.local',
    expectedFullName: 'Dr. Amanuel Kifle',
    expectedJobTitle: 'Medical Director',
    expectedRole: 'viewer',
    expectedDepartmentName: null,
    navigationFocus: 'Read-only Command Center and reports',
  },
];

const DEMO_BY_EMAIL = new Map(EXPECTED_DEMO_USERS.map((user) => [user.email, user]));

function normalizeRoles(roles: string[] | null | undefined) {
  return Array.from(new Set((roles ?? []).map((role) => role.trim()).filter(Boolean)));
}

export function validateDemoRoleMapping(input: DemoRoleValidationInput): DemoRoleValidationResult {
  const expected = DEMO_BY_EMAIL.get(input.email);
  if (!expected) {
    throw new Error(`Unknown demo user email: ${input.email}`);
  }

  const roles = normalizeRoles(input.assignedRoles);
  const reasons: DemoRoleValidationReason[] = [];

  if (!input.authUserId) reasons.push('MISSING_AUTH_USER');
  if (!input.profileId) reasons.push('MISSING_PROFILE');
  if (input.profileId && (!input.profileUserId || (input.authUserId && input.profileUserId !== input.authUserId))) {
    reasons.push('PROFILE_NOT_LINKED_TO_AUTH');
  }
  if (input.profileId && input.fullName !== expected.expectedFullName) reasons.push('WRONG_NAME');
  if (input.profileId && input.jobTitle !== expected.expectedJobTitle) reasons.push('WRONG_JOB_TITLE');
  if (input.profileId && (input.departmentName ?? null) !== expected.expectedDepartmentName) reasons.push('WRONG_DEPARTMENT');
  if (input.profileId && roles.length === 0) reasons.push('MISSING_ROLE');
  if (input.profileId && roles.length > 0 && !roles.includes(expected.expectedRole)) reasons.push('WRONG_ROLE');
  if (input.profileId && roles.length > 1) reasons.push('MULTIPLE_ROLES');

  const finalReasons = reasons.length > 0 ? reasons : (['OK'] as DemoRoleValidationReason[]);

  return {
    ...input,
    assignedRoles: roles,
    expectedFullName: expected.expectedFullName,
    expectedJobTitle: expected.expectedJobTitle,
    expectedRole: expected.expectedRole,
    expectedDepartmentName: expected.expectedDepartmentName,
    navigationFocus: expected.navigationFocus,
    primaryReason: finalReasons[0],
    reasons: finalReasons,
  };
}

export function validateDemoRoleMappings(rows: DemoRoleValidationInput[]): DemoRoleValidationResult[] {
  const rowsByEmail = new Map(rows.map((row) => [row.email, row]));
  return EXPECTED_DEMO_USERS.map((expected) => validateDemoRoleMapping(
    rowsByEmail.get(expected.email) ?? {
      email: expected.email,
      authUserId: null,
      profileId: null,
      profileUserId: null,
      fullName: null,
      jobTitle: null,
      departmentName: null,
      assignedRoles: [],
    },
  ));
}

export function demoRoleIntegritySummary(rows: DemoRoleValidationResult[]) {
  const ok = rows.filter((row) => row.primaryReason === 'OK').length;
  return {
    ok,
    total: EXPECTED_DEMO_USERS.length,
    hasFailures: ok !== EXPECTED_DEMO_USERS.length,
    missingAuthUsers: rows.filter((row) => row.reasons.includes('MISSING_AUTH_USER')).length,
    missingProfiles: rows.filter((row) => row.reasons.includes('MISSING_PROFILE')).length,
    roleFailures: rows.filter((row) => row.reasons.some((reason) => ['MISSING_ROLE', 'WRONG_ROLE', 'MULTIPLE_ROLES'].includes(reason))).length,
  };
}
