import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPECTED_DEMO_USERS,
  demoRoleIntegritySummary,
  validateDemoRoleMapping,
  validateDemoRoleMappings,
} from '@/utils/developer-lab/demo-role-validation';
import {
  NOT_WEIGHT_ADJUSTABLE_SCORES,
  SCORE_REGISTRY,
  SENSITIVITY_SUPPORTED_SCORES,
  evaluateSnapshotFreshness,
} from '@/utils/analytics/score-registry';
import { ANALYTICS_TRUTH_MAP } from '@/utils/analytics/analytics-truth-map';
import { NOTIFICATION_RECIPIENT_IDENTITY_CONTRACT } from '@/services/notifications/recipient-resolver';

const EXPECTED_WEIGHTED_SENSITIVITY_KEYS = [
  'replacement_priority',
  'equipment_health',
  'critical_action_score',
  'stock_blocker_priority',
  'procurement_delay_priority',
  'calibration_risk_priority',
  'pm_triage_priority',
];

test('demo role validation distinguishes auth user id from profile id', () => {
  const result = validateDemoRoleMapping({
    email: 'developer@bmerms-demo.local',
    authUserId: 'auth-user-1',
    profileId: 'profile-1',
    profileUserId: 'auth-user-1',
    fullName: 'BMEDIS Developer',
    jobTitle: 'Thesis Developer',
    departmentName: null,
    assignedRoles: ['developer'],
  });

  assert.equal(result.primaryReason, 'OK');
  assert.equal(result.profileId, 'profile-1');
  assert.equal(result.profileUserId, 'auth-user-1');
});

test('demo role validation gives actionable missing auth/profile reasons', () => {
  const missingAuth = validateDemoRoleMapping({
    email: 'viewer@bmerms-demo.local',
    authUserId: null,
    profileId: 'profile-viewer',
    profileUserId: 'auth-viewer',
    fullName: 'Dr. Amanuel Kifle',
    jobTitle: 'Medical Director',
    departmentName: null,
    assignedRoles: ['viewer'],
  });
  assert.ok(missingAuth.reasons.includes('MISSING_AUTH_USER'));

  const wrongAuthLink = validateDemoRoleMapping({
    email: 'viewer@bmerms-demo.local',
    authUserId: 'auth-viewer',
    profileId: 'profile-viewer',
    profileUserId: 'different-auth-user',
    fullName: 'Dr. Amanuel Kifle',
    jobTitle: 'Medical Director',
    departmentName: null,
    assignedRoles: ['viewer'],
  });
  assert.ok(wrongAuthLink.reasons.includes('PROFILE_NOT_LINKED_TO_AUTH'));

  const missingProfile = validateDemoRoleMappings([]).find(
    (row) => row.email === 'developer@bmerms-demo.local',
  );
  assert.ok(missingProfile);
  assert.equal(missingProfile.primaryReason, 'MISSING_AUTH_USER');
  assert.ok(missingProfile.reasons.includes('MISSING_PROFILE'));
});

test('demo role validation detects wrong and multiple roles', () => {
  const result = validateDemoRoleMapping({
    email: 'technician@bmerms-demo.local',
    authUserId: 'auth-tech',
    profileId: 'profile-tech',
    profileUserId: 'auth-tech',
    fullName: 'Hanna Gebremedhin',
    jobTitle: 'Clinical Engineer',
    departmentName: null,
    assignedRoles: ['viewer', 'store_user'],
  });

  assert.ok(result.reasons.includes('WRONG_ROLE'));
  assert.ok(result.reasons.includes('MULTIPLE_ROLES'));
});

test('demo role validation covers all required seeded users', () => {
  assert.deepEqual(
    EXPECTED_DEMO_USERS.map((user) => user.email),
    [
      'developer@bmerms-demo.local',
      'bme.head@bmerms-demo.local',
      'technician@bmerms-demo.local',
      'department.head@bmerms-demo.local',
      'department.user@bmerms-demo.local',
      'store.user@bmerms-demo.local',
      'viewer@bmerms-demo.local',
    ],
  );

  const rows = EXPECTED_DEMO_USERS.map((user, index) => ({
    email: user.email,
    authUserId: `auth-${index}`,
    profileId: `profile-${index}`,
    profileUserId: `auth-${index}`,
    fullName: user.expectedFullName,
    jobTitle: user.expectedJobTitle,
    departmentName: user.expectedDepartmentName,
    assignedRoles: [user.expectedRole],
  }));
  const summary = demoRoleIntegritySummary(validateDemoRoleMappings(rows));
  assert.equal(summary.ok, 7);
  assert.equal(summary.hasFailures, false);
});

test('score registry accounts for every weighted sensitivity score', () => {
  const sensitivityKeys = SENSITIVITY_SUPPORTED_SCORES.map((score) => score.key);
  for (const key of EXPECTED_WEIGHTED_SENSITIVITY_KEYS) {
    assert.ok(sensitivityKeys.includes(key), `${key} missing from sensitivity sandbox`);
  }

  for (const score of SENSITIVITY_SUPPORTED_SCORES) {
    assert.equal(score.isWeightedComposite, true, `${score.key} must be weighted`);
    assert.ok((score.weights ?? []).length > 0, `${score.key} needs weight metadata`);
    assert.equal(score.sandboxChangesAffectLive, 'No', `${score.key} sandbox must not affect live decisions`);
  }
});

test('non-weighted metrics are explicitly not weight-adjustable', () => {
  const nonWeightedKeys = NOT_WEIGHT_ADJUSTABLE_SCORES.map((score) => score.key);
  for (const key of ['rpn_fmea', 'department_clinical_readiness', 'pm_compliance', 'availability', 'mtbf', 'mttr']) {
    assert.ok(nonWeightedKeys.includes(key), `${key} should be listed as not weight-adjustable`);
  }

  for (const score of NOT_WEIGHT_ADJUSTABLE_SCORES) {
    assert.equal(score.sensitivitySupported, false);
    assert.ok(score.notWeightAdjustableReason || score.dataMode === 'Not Implemented');
  }
});

test('score status metadata uses valid modes and avoids user-facing alerts routes', () => {
  const validDataModes = new Set(['Live', 'Snapshot', 'Sandbox', 'Mixed', 'Not Implemented']);
  const validRefreshModes = new Set(['Live view', 'Triggered snapshot', 'Manual refresh', 'Simulation only', 'Not implemented']);

  for (const score of SCORE_REGISTRY) {
    assert.ok(validDataModes.has(score.dataMode), `${score.key} has invalid data mode`);
    assert.ok(validRefreshModes.has(score.refreshMode), `${score.key} has invalid refresh mode`);
    const userFacingText = [
      score.sourceOfTruth,
      score.limitations,
      score.sandboxMessage,
      ...score.operationalConsumers,
    ].join(' ');
    assert.equal(userFacingText.includes('/alerts'), false, `${score.key} still points users to /alerts`);
    assert.equal(/Appears in Alerts/i.test(userFacingText), false, `${score.key} still says Appears in Alerts`);
  }
});

test('snapshot freshness classifies live, simulation, stale, very stale, and missing timestamps', () => {
  const now = new Date('2026-05-19T12:00:00Z');

  assert.equal(evaluateSnapshotFreshness('Live', 'Live view', null, now), 'No snapshot needed');
  assert.equal(evaluateSnapshotFreshness('Sandbox', 'Simulation only', null, now), 'Simulation only');
  assert.equal(evaluateSnapshotFreshness('Snapshot', 'Triggered snapshot', null, now), 'Missing');
  assert.equal(evaluateSnapshotFreshness('Snapshot', 'Triggered snapshot', '2026-05-18T10:59:59Z', now), 'Stale');
  assert.equal(evaluateSnapshotFreshness('Snapshot', 'Triggered snapshot', '2026-05-16T10:59:59Z', now), 'Very stale');
});

test('sandbox wording for implemented operational scores does not imply disconnection', () => {
  for (const score of SCORE_REGISTRY.filter((entry) => entry.operationalImplementation !== 'no')) {
    assert.equal(/not yet connected|not connected|disconnected/i.test(score.sandboxMessage), false, score.key);
    if (score.sensitivitySupported) {
      assert.match(score.sandboxMessage, /does not modify|Simulation only|simulates/i, score.key);
    }
  }
});

test('snapshot metrics declare refresh implementation instead of fake success semantics', () => {
  const snapshotLike = SCORE_REGISTRY.filter((score) => score.dataMode === 'Snapshot' || score.dataMode === 'Mixed');
  for (const score of snapshotLike) {
    assert.ok(score.refreshImplementation, `${score.key} must declare refresh implementation or limitation`);
    assert.notEqual(score.refreshMode, 'Live view', `${score.key} should not be marked as live view`);
  }
});

test('analytics truth map is derived from score registry and stays off legacy alert routes', () => {
  const registryKeys = new Set(SCORE_REGISTRY.map((score) => score.key));
  for (const metric of ANALYTICS_TRUTH_MAP) {
    assert.ok(registryKeys.has(metric.key), `${metric.key} missing from score registry`);
    assert.equal(metric.pages.some((place) => place.includes('/alerts')), false);
  }
});

test('notification and Telegram recipient routing is anchored on profile ids', () => {
  assert.equal(NOTIFICATION_RECIPIENT_IDENTITY_CONTRACT.recipientProfileId, 'profiles.id');
  assert.equal(NOTIFICATION_RECIPIENT_IDENTITY_CONTRACT.roleAssignment, 'user_roles.user_id = profiles.id');
  assert.equal(NOTIFICATION_RECIPIENT_IDENTITY_CONTRACT.telegramConnection, 'telegram_connections.profile_id = profiles.id');
});
