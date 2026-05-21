import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// ANALYTICS-01: action workflows must NOT silently swallow analytics
// refresh failures. Every recomputeAssetAnalytics(...) call must be
// wrapped in a try/catch (or runAnalyticsRefreshOrWarn) that surfaces
// the failure either as a warning attached to the action's data
// payload or as a structured audit event.

const repoRoot = process.cwd();
function readSource(rel: string): string {
  return readFileSync(path.resolve(repoRoot, rel), 'utf8');
}

const SWEEP_FILES = [
  'src/actions/maintenance.actions.ts',
  'src/actions/pm.actions.ts',
  'src/actions/calibration.actions.ts',
  'src/actions/equipment.actions.ts',
];

for (const file of SWEEP_FILES) {
  test(`ANALYTICS-01: ${file} has no .catch(() => undefined) on recomputeAssetAnalytics`, () => {
    const src = readSource(file);
    assert.doesNotMatch(
      src,
      /recomputeAssetAnalytics\([^)]+\)\s*\.catch\(\s*\(\s*\)\s*=>\s*undefined\s*\)/,
      `${file} still contains a silent .catch(() => undefined) on recomputeAssetAnalytics`,
    );
  });

  test(`ANALYTICS-01: ${file} audits analytics refresh failures`, () => {
    const src = readSource(file);
    // Every file that touches recomputeAssetAnalytics must also audit
    // .analytics_refresh_failed when it does.
    if (src.includes('recomputeAssetAnalytics')) {
      assert.match(
        src,
        /analytics_refresh_failed/,
        `${file} touches recomputeAssetAnalytics but never audits analytics_refresh_failed`,
      );
    }
  });
}

test('ANALYTICS-01: _shared.runAnalyticsRefreshOrWarn helper exists and returns null|string', () => {
  const src = readSource('src/actions/_shared.ts');
  assert.match(src, /export async function runAnalyticsRefreshOrWarn/);
  assert.match(src, /Promise<string \| null>/);
  // Helper must call the refresh in try/catch and write an audit row when failing.
  assert.match(src, /try\s*\{[\s\S]{0,200}refresh\(\)/);
  assert.match(src, /audit_logs/);
});

test('ANALYTICS-01: PM completion warnings include analytics refresh', () => {
  const src = readSource('src/actions/pm.actions.ts');
  // pm_completion.analytics_refresh_failed audit + warnings.push pattern.
  assert.match(src, /pm_completion\.analytics_refresh_failed/);
  // The completion action must aggregate warnings into the data payload.
  assert.match(src, /warnings:\s*warnings\.length\s*>\s*0\s*\?\s*warnings/);
});

test('ANALYTICS-01: calibration analytics refresh attaches warning to data', () => {
  const src = readSource('src/actions/calibration.actions.ts');
  // updateCalibrationRequestStatusAction returns analytics_refresh_warning.
  assert.match(src, /analytics_refresh_warning/);
});

test('ANALYTICS-01: maintenance event refresh failure surfaces warning', () => {
  const src = readSource('src/actions/maintenance.actions.ts');
  // createMaintenanceEventAction must include eventAnalyticsWarning logic.
  assert.match(src, /eventAnalyticsWarning|maintenance_event\.analytics_refresh_failed/);
});
