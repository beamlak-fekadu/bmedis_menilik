import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreProcurementDelay } from '@/utils/decision-support/procurement-delay';

// R10: scoring is driven by expected_delivery_date + status + priority.
// Created-at age is a fallback only.

const NOW = new Date('2026-05-19T12:00:00Z');

test('terminal statuses (delivered/canceled) score 0', () => {
  const delivered = scoreProcurementDelay({
    expectedDeliveryDate: '2026-01-01',
    createdAt: '2025-12-01',
    status: 'delivered',
    priority: 'critical',
  }, NOW);
  assert.equal(delivered.score, 0);
  assert.equal(delivered.isDelayed, false);

  const canceled = scoreProcurementDelay({
    expectedDeliveryDate: '2026-01-01',
    createdAt: '2025-12-01',
    status: 'canceled',
    priority: 'critical',
  }, NOW);
  assert.equal(canceled.score, 0);
});

test('past expected_delivery_date → isDelayed=true, score increases with daysPastDue', () => {
  const just1Day = scoreProcurementDelay({
    expectedDeliveryDate: '2026-05-18', // 1 day before NOW
    createdAt: '2026-05-01',
    status: 'ordered',
    priority: 'medium',
  }, NOW);
  const tenDays = scoreProcurementDelay({
    expectedDeliveryDate: '2026-05-09',
    createdAt: '2026-05-01',
    status: 'ordered',
    priority: 'medium',
  }, NOW);
  assert.equal(just1Day.isDelayed, true);
  assert.equal(just1Day.daysPastDue, 1);
  assert.ok(tenDays.score > just1Day.score, 'longer delay must score higher');
});

test('future expected_delivery_date → isDelayed=false, score stays low even for old request', () => {
  // Request created 90 days ago but expected delivery is still 30 days out.
  const r = scoreProcurementDelay({
    expectedDeliveryDate: '2026-06-18',
    createdAt: '2026-02-18',
    status: 'ordered',
    priority: 'medium',
  }, NOW);
  assert.equal(r.isDelayed, false);
  assert.equal(r.daysPastDue, 0);
  // Below medium urgency threshold (60).
  assert.ok(r.score < 60, `score ${r.score} should be below medium threshold`);
  assert.equal(r.urgency, 'low');
});

test('priority boost: critical past-due > medium past-due at same daysPastDue', () => {
  const med = scoreProcurementDelay({
    expectedDeliveryDate: '2026-05-09',
    createdAt: '2026-05-01',
    status: 'ordered',
    priority: 'medium',
  }, NOW);
  const crit = scoreProcurementDelay({
    expectedDeliveryDate: '2026-05-09',
    createdAt: '2026-05-01',
    status: 'ordered',
    priority: 'critical',
  }, NOW);
  assert.ok(crit.score > med.score);
});

test('no expected_delivery_date → fallback to age-based score, usedFallback=true', () => {
  const r = scoreProcurementDelay({
    expectedDeliveryDate: null,
    createdAt: '2026-04-09', // 40 days ago
    status: 'requested',
    priority: 'medium',
  }, NOW);
  assert.equal(r.usedFallback, true);
  assert.equal(r.isDelayed, false);
  assert.equal(r.daysPastDue, null);
  assert.ok(r.score > 0);
});

test('no expected_delivery_date AND no createdAt → bare baseline + priority', () => {
  const r = scoreProcurementDelay({
    expectedDeliveryDate: null,
    createdAt: null,
    status: 'requested',
    priority: 'low',
  }, NOW);
  assert.equal(r.usedFallback, true);
  assert.equal(r.ageDays, null);
  // 25 (base) + 0 (age fallback) + (-10 low priority boost) = 15
  assert.equal(r.score, 15);
});

test('urgency bands map score correctly', () => {
  // Construct inputs that produce specific score bands.
  const lowUrgency = scoreProcurementDelay({
    expectedDeliveryDate: '2026-06-19', // future
    createdAt: '2026-05-01',
    status: 'requested',
    priority: 'low',
  }, NOW);
  assert.equal(lowUrgency.urgency, 'low');

  const criticalUrgency = scoreProcurementDelay({
    expectedDeliveryDate: '2026-01-19', // 120 days past due
    createdAt: '2025-12-01',
    status: 'ordered',
    priority: 'critical',
  }, NOW);
  // 60 + min(120, 120*2=240→120) + 40 = 220 → critical
  assert.equal(criticalUrgency.urgency, 'critical');
});

test('1-day-old request with past expected_delivery_date ranks higher than 90-day-old with future date (R10 core invariant)', () => {
  const new_delayed = scoreProcurementDelay({
    expectedDeliveryDate: '2026-05-18', // 1 day past
    createdAt: '2026-05-18',
    status: 'ordered',
    priority: 'medium',
  }, NOW);
  const old_not_delayed = scoreProcurementDelay({
    expectedDeliveryDate: '2026-07-18', // 60 days future
    createdAt: '2026-02-18', // 90 days old
    status: 'ordered',
    priority: 'medium',
  }, NOW);
  assert.ok(
    new_delayed.score > old_not_delayed.score,
    `R10 invariant: newly delayed request (${new_delayed.score}) must outrank old not-yet-due request (${old_not_delayed.score})`,
  );
});
