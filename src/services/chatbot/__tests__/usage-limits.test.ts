import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateTokensFromChars, formatApproxTokens, getCopilotUsageLimits } from '@/services/chatbot/usage-limits';

test('usage estimation uses documented one-token-per-four-chars approximation', () => {
  assert.equal(estimateTokensFromChars(0), 0);
  assert.equal(estimateTokensFromChars(1), 1);
  assert.equal(estimateTokensFromChars(4), 1);
  assert.equal(estimateTokensFromChars(5), 2);
  assert.equal(estimateTokensFromChars(4000), 1000);
});

test('usage token display is compact and approximate', () => {
  assert.equal(formatApproxTokens(999), '999');
  assert.equal(formatApproxTokens(4200), '4.2k');
  assert.equal(formatApproxTokens(12000), '12k');
});

test('usage limits default to warnings without hard blocking', () => {
  const original = process.env.COPILOT_HARD_LIMIT_ENABLED;
  delete process.env.COPILOT_HARD_LIMIT_ENABLED;
  const limits = getCopilotUsageLimits();
  assert.equal(limits.hardLimitEnabled, false);
  assert.equal(limits.dailyRequestLimitPerUser, 100);
  assert.equal(limits.dailyTokenLimitPerUser, 100000);
  if (original === undefined) delete process.env.COPILOT_HARD_LIMIT_ENABLED;
  else process.env.COPILOT_HARD_LIMIT_ENABLED = original;
});

