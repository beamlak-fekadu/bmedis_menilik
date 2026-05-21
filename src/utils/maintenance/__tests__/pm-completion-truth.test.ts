import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// PM-01: PM completion must be transactionally safe (or fail loud) AND must
// surface all post-insert failures as structured warnings. The old code
// inserted pm_completions BEFORE updating pm_schedules / pm_plans /
// equipment_assets and swallowed every downstream error, so a partial
// completion could exist with a stale schedule, stale plan due date, and
// stale equipment condition — yet the user saw a clean "PM completed".

const repoRoot = process.cwd();

function readSource(rel: string): string {
  return readFileSync(path.resolve(repoRoot, rel), 'utf8');
}

const actionSrc = readSource('src/actions/pm.actions.ts');

test('PM-01: pm_completions is rolled back if pm_schedules update fails', () => {
  // The action must DELETE the completion row when the schedule update
  // fails — without this compensating action, orphan evidence rows pile up.
  assert.match(
    actionSrc,
    /scheduleUpdate\.error[\s\S]{0,500}from\('pm_completions'\)\s*\.\s*delete\(\)/,
  );
  // The rollback must be audited.
  assert.match(actionSrc, /pm_completion\.rolled_back/);
});

test('PM-01: pm_plans update failure surfaces a warning, not a silent skip', () => {
  // Old code used `.update(...).eq(...)` without checking the error.
  // New code captures `planUpdate.error` into the warnings array.
  assert.match(actionSrc, /planUpdate\.error/);
  assert.match(actionSrc, /warnings\.push\([^)]*next_due_date/);
});

test('PM-01: equipment condition update failure surfaces a warning', () => {
  // Old code used `.update(...).eq(...)` without checking the error.
  assert.match(actionSrc, /conditionUpdate\.error/);
  assert.match(actionSrc, /warnings\.push\([^)]*Equipment condition/);
});

test('PM-01: analytics refresh failure inside createPMCompletionAction surfaces a warning', () => {
  // Old code: `await recomputeAssetAnalytics(assetId).catch(() => undefined);`
  // New code: try/catch with explicit warnings push.
  // Locate the analytics block by finding the audit event we added.
  const auditIdx = actionSrc.indexOf('pm_completion.analytics_refresh_failed');
  assert.ok(auditIdx > 0, 'pm_completion.analytics_refresh_failed audit must exist');
  // The surrounding 800 chars must show try { recomputeAssetAnalytics ...
  // catch ... warnings.push pattern.
  const window = actionSrc.slice(auditIdx - 800, auditIdx + 200);
  assert.match(window, /recomputeAssetAnalytics\(assetId\)/);
  assert.match(window, /warnings\.push/);
  assert.match(window, /catch\s*\(/);
});

test('PM-01: action returns warnings array in the success payload', () => {
  // Successful completion with non-empty warnings still success:true,
  // and warnings are populated so the UI can surface them.
  assert.match(actionSrc, /warnings:\s*warnings\.length\s*>\s*0\s*\?\s*warnings\s*:\s*undefined/);
});

test('PM-01: UI surfaces warnings as separate toasts (not buried in success)', () => {
  const pagePath = 'src/app/(dashboard)/pm/schedules/[id]/page.tsx';
  const pageSrc = readSource(pagePath);
  // Extract warnings from completion result.
  assert.match(pageSrc, /completionData\?\.warnings/);
  // Each warning rendered as a 'warning' toast.
  assert.match(pageSrc, /toast\('warning',\s*w\)/);
  // Success message wording is modified when warnings is non-empty.
  assert.match(pageSrc, /with\s+\$\{warnings\.length\}\s+warning/);
});
