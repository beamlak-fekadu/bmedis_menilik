import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CRITICAL_ACTION_CATEGORY_WEIGHTS,
  CRITICAL_ACTION_CATEGORY_ORDER,
  CRITICAL_ACTION_URGENCY_BANDS,
  urgencyBandFor,
  categoryOrderIndex,
} from '@/utils/analytics/critical-action-bands';
import { SCORE_REGISTRY } from '@/utils/analytics/score-registry';

// R30: critical action ordering + urgency bands.

test('category weights are strictly descending in priority order', () => {
  const sorted = [...CRITICAL_ACTION_CATEGORY_ORDER]
    .map((cat) => CRITICAL_ACTION_CATEGORY_WEIGHTS[cat]);
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(
      sorted[i] < sorted[i - 1],
      `Category at index ${i} (${CRITICAL_ACTION_CATEGORY_ORDER[i]}) weight ${sorted[i]} ` +
      `should be strictly less than previous (${CRITICAL_ACTION_CATEGORY_ORDER[i - 1]}) ${sorted[i - 1]}`,
    );
  }
});

test('corrective is the highest base weight', () => {
  const weights = Object.values(CRITICAL_ACTION_CATEGORY_WEIGHTS);
  const maxWeight = Math.max(...weights);
  assert.equal(CRITICAL_ACTION_CATEGORY_WEIGHTS.corrective, maxWeight);
});

test('calibration outranks PM (safety > preventive)', () => {
  assert.ok(
    CRITICAL_ACTION_CATEGORY_WEIGHTS.calibration > CRITICAL_ACTION_CATEGORY_WEIGHTS.pm,
    'Calibration must outrank PM — failed calibration is a clinical safety event.',
  );
});

test('stock blocker outranks replacement (active work > lifecycle planning)', () => {
  assert.ok(
    CRITICAL_ACTION_CATEGORY_WEIGHTS.stock > CRITICAL_ACTION_CATEGORY_WEIGHTS.replacement,
  );
});

test('urgency bands map combined score to label', () => {
  assert.equal(urgencyBandFor(0), 'low');
  assert.equal(urgencyBandFor(99), 'low');
  assert.equal(urgencyBandFor(CRITICAL_ACTION_URGENCY_BANDS.medium), 'medium');
  assert.equal(urgencyBandFor(149), 'medium');
  assert.equal(urgencyBandFor(CRITICAL_ACTION_URGENCY_BANDS.high), 'high');
  assert.equal(urgencyBandFor(179), 'high');
  assert.equal(urgencyBandFor(CRITICAL_ACTION_URGENCY_BANDS.critical), 'critical');
  assert.equal(urgencyBandFor(500), 'critical');
});

test('a corrective WO with item score 80 lands as critical (100+80=180)', () => {
  const combined = CRITICAL_ACTION_CATEGORY_WEIGHTS.corrective + 80;
  assert.equal(urgencyBandFor(combined), 'critical');
});

test('a procurement-delay with item score 50 stays medium (45+50=95 < 100? no, 95→low)', () => {
  // 45 base + 50 item = 95 → below medium threshold → low. Confirms that
  // procurement delay alone shouldn't reach the operator's attention strip
  // without significant additional item-level urgency.
  const combined = CRITICAL_ACTION_CATEGORY_WEIGHTS.procurement + 50;
  assert.equal(urgencyBandFor(combined), 'low');
});

test('categoryOrderIndex preserves declared order', () => {
  for (let i = 0; i < CRITICAL_ACTION_CATEGORY_ORDER.length; i++) {
    assert.equal(categoryOrderIndex(CRITICAL_ACTION_CATEGORY_ORDER[i]), i);
  }
});

test('score-registry critical_action_score weights match the canonical numbers', () => {
  const entry = SCORE_REGISTRY.find((s) => s.key === 'critical_action_score');
  assert.ok(entry, 'critical_action_score must exist in the score registry');
  const weights = entry!.weights ?? [];
  // Map registry weight keys to canonical category keys (camelCase → snake_case).
  const keyMap: Record<string, keyof typeof CRITICAL_ACTION_CATEGORY_WEIGHTS> = {
    corrective: 'corrective',
    needsRequest: 'needs_request',
    calibration: 'calibration',
    pm: 'pm',
    stock: 'stock',
    riskWatch: 'risk_watch',
    installation: 'installation',
    replacement: 'replacement',
    procurement: 'procurement',
    training: 'training',
  };
  for (const w of weights) {
    const canonicalKey = keyMap[w.key];
    assert.ok(canonicalKey, `Unknown weight key in registry: ${w.key}`);
    assert.equal(
      w.defaultWeight,
      CRITICAL_ACTION_CATEGORY_WEIGHTS[canonicalKey],
      `Registry weight for ${w.key} (${w.defaultWeight}) must match canonical ${canonicalKey} (${CRITICAL_ACTION_CATEGORY_WEIGHTS[canonicalKey]})`,
    );
  }
});
