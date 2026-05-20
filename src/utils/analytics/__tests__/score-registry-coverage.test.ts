import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCORE_REGISTRY,
  SENSITIVITY_SUPPORTED_SCORES,
  NOT_WEIGHT_ADJUSTABLE_SCORES,
  getScoreRegistryEntry,
} from '@/utils/analytics/score-registry';

// R26: every score is either weight-adjustable (with declared weights AND a
// sandbox tab) or explicitly NOT weight-adjustable (with a documented
// reason). No score can sit between — that would be the "looks incomplete"
// state R26 was filed to prevent.

test('every score has a key, displayName, dataMode, formulaSummary, sandboxMessage', () => {
  for (const score of SCORE_REGISTRY) {
    assert.ok(score.key, 'score must have a key');
    assert.ok(score.displayName, `${score.key} must have a displayName`);
    assert.ok(score.dataMode, `${score.key} must have a dataMode`);
    assert.ok(score.formulaSummary, `${score.key} must have a formulaSummary`);
    assert.ok(score.sandboxMessage, `${score.key} must have a sandboxMessage`);
  }
});

test('every weighted/composite score has declared weights AND sensitivitySupported = true', () => {
  for (const score of SCORE_REGISTRY) {
    if (score.isWeightedComposite) {
      assert.ok(
        score.weights && score.weights.length > 0,
        `${score.key} is weighted composite but has no weights declared`,
      );
      assert.equal(
        score.sensitivitySupported, true,
        `${score.key} is weighted composite — sensitivitySupported must be true so the sandbox renders a tab`,
      );
    }
  }
});

test('every non-weighted score declares notWeightAdjustableReason', () => {
  for (const score of NOT_WEIGHT_ADJUSTABLE_SCORES) {
    assert.ok(
      score.notWeightAdjustableReason && score.notWeightAdjustableReason.length > 0,
      `${score.key} is not weight-adjustable but has no notWeightAdjustableReason — fix per R26`,
    );
  }
});

test('weight defaults inside a weighted score sum is finite and positive', () => {
  for (const score of SENSITIVITY_SUPPORTED_SCORES) {
    const sum = (score.weights ?? []).reduce((s, w) => s + (w.defaultWeight ?? 0), 0);
    assert.ok(Number.isFinite(sum) && sum > 0, `${score.key} weight sum must be finite/positive`);
  }
});

test('the operationally critical scores are all present', () => {
  const expectedKeys = [
    'rpn_fmea',
    'replacement_priority',
    'equipment_health',
    'department_clinical_readiness',
    'critical_action_score',
    'stock_blocker_priority',
    'procurement_delay_priority',
    'calibration_risk_priority',
    'pm_triage_priority',
    'pm_compliance',
    'technician_workload_capacity',
    'availability',
    'mtbf',
    'mttr',
  ];
  for (const key of expectedKeys) {
    assert.ok(
      getScoreRegistryEntry(key),
      `Score ${key} is missing from SCORE_REGISTRY (R26 coverage check)`,
    );
  }
});

test('SENSITIVITY_SUPPORTED_SCORES is non-empty and includes RPI', () => {
  assert.ok(SENSITIVITY_SUPPORTED_SCORES.length >= 4);
  assert.ok(SENSITIVITY_SUPPORTED_SCORES.find((s) => s.key === 'replacement_priority'));
});

test('NOT_WEIGHT_ADJUSTABLE_SCORES includes reliability formulas (MTTR/MTBF/availability)', () => {
  for (const key of ['mttr', 'mtbf', 'availability']) {
    assert.ok(NOT_WEIGHT_ADJUSTABLE_SCORES.find((s) => s.key === key),
      `${key} should be classified as not weight-adjustable`);
  }
});

test('every score with sandboxChangesAffectLive declares it explicitly', () => {
  for (const score of SCORE_REGISTRY) {
    assert.ok(
      ['No', 'Yes', 'N/A'].includes(score.sandboxChangesAffectLive),
      `${score.key} must declare sandboxChangesAffectLive`,
    );
    // R26 invariant: sandbox should never silently affect live data.
    if (score.sandboxOnly) {
      assert.equal(
        score.sandboxChangesAffectLive,
        'No',
        `${score.key} is sandbox-only — its sandboxChangesAffectLive must be 'No'`,
      );
    }
  }
});

test('every weighted/composite score lists its operational consumers', () => {
  for (const score of SCORE_REGISTRY) {
    assert.ok(
      Array.isArray(score.operationalConsumers) && score.operationalConsumers.length > 0,
      `${score.key} must declare operationalConsumers`,
    );
  }
});
