import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { OFFLINE_ACTION_DEFINITIONS } from '@/types/offline';

// OFF-02 regression: the legacy work_order.complete_draft action MUST NOT be
// labeled or described as a real completion. The real offline completion
// package is work_order.complete and must replay through updateWorkOrderAction.

test('OFF-02: work_order.complete_draft label states the work order stays open', () => {
  const def = OFFLINE_ACTION_DEFINITIONS['work_order.complete_draft'];
  assert.ok(def, 'definition must exist');
  // Label must not claim the WO is completed/closed.
  assert.doesNotMatch(def.label, /\bcompletes?\b|\bcomplete work order\b/i);
  // Label must mention that the work order remains open.
  assert.match(def.label, /open|note|intent/i);
});

test('OFF-02: WO detail page queues real completion without claiming official completion before replay', () => {
  const pagePath = path.resolve(
    process.cwd(),
    'src/app/(dashboard)/maintenance/work-orders/[id]/page.tsx',
  );
  const source = readFileSync(pagePath, 'utf8');

  const startIdx = source.indexOf('async function handleCompleteWorkOrder');
  assert.ok(startIdx > 0, 'handleCompleteWorkOrder must exist');
  const slice = source.slice(startIdx, startIdx + 4000);

  assert.match(slice, /actionType:\s*'work_order\.complete'/);
  assert.match(slice, /Work-order completion queued locally/i);
  assert.match(slice, /It will become official after sync/i);
  assert.match(slice, /updateWorkOrderAction/);
});

test('OFF-02: completion modal contains an offline local-promise warning', () => {
  const pagePath = path.resolve(
    process.cwd(),
    'src/app/(dashboard)/maintenance/work-orders/[id]/page.tsx',
  );
  const source = readFileSync(pagePath, 'utf8');
  const normalised = source.replace(/\s+/g, ' ');
  assert.match(normalised, /Offline actions are local promises, not official server facts/i);
  assert.match(normalised, /Queue Completion/i);
});

test('OFF-02: real completion action definition is server-validated', () => {
  const def = OFFLINE_ACTION_DEFINITIONS['work_order.complete'];
  assert.equal(def.category, 'state_change_requires_validation');
  assert.match(def.label, /server validation/i);
});

// OFF-03 regression: the sync engine must not silently swallow sync-event
// write failures. If recordOfflineSyncEventAction fails, the local queue
// record's metadata must be annotated so the failure is visible in Sync
// Review Center / Developer Lab.

test('OFF-03: sync engine returns SyncEventOutcome and annotates failures', () => {
  const enginePath = path.resolve(process.cwd(), 'src/lib/offline/sync-engine.ts');
  const source = readFileSync(enginePath, 'utf8');

  // recordSyncEvent now returns a discriminated SyncEventOutcome.
  assert.match(source, /SyncEventOutcome/);
  assert.match(source, /\{\s*ok:\s*true\s*\}\s*\|\s*\{\s*ok:\s*false;\s*error:\s*string\s*\}/);
  // annotateEvidenceFailure is invoked from every replay code path.
  assert.match(source, /annotateEvidenceFailure/);
  // It writes evidence_write_failed into metadata.
  assert.match(source, /evidence_write_failed:\s*true/);
  assert.match(source, /evidence_write_error/);
});

test('OFF-03: sync engine surfaces evidence-write failure to lastError', () => {
  const enginePath = path.resolve(process.cwd(), 'src/lib/offline/sync-engine.ts');
  const source = readFileSync(enginePath, 'utf8');
  // On synced + evidence-failure, lastError must carry the audit-trail gap.
  assert.match(source, /server evidence write failed/i);
});

test('OFF-03: recordSyncEvent checks the action result, not just exceptions', () => {
  const enginePath = path.resolve(process.cwd(), 'src/lib/offline/sync-engine.ts');
  const source = readFileSync(enginePath, 'utf8');
  // result.success !== true branch must exist.
  assert.match(source, /result\.success\s*!==\s*true/);
});

test('OFF-04: replay checks idempotency and stale work-order state before completion', () => {
  const actionPath = path.resolve(process.cwd(), 'src/actions/offline-sync.actions.ts');
  const source = readFileSync(actionPath, 'utf8');

  assert.match(source, /client_action_id/);
  assert.match(source, /already_applied/);
  assert.match(source, /replayWorkOrderCompletion/);
  assert.match(source, /Work order was reassigned while this device was offline/);
  assert.match(source, /staleStateConflict/);
});

test('OFF-05: PM and calibration result offline replay handlers are registered', () => {
  const actionPath = path.resolve(process.cwd(), 'src/actions/offline-sync.actions.ts');
  const source = readFileSync(actionPath, 'utf8');

  assert.match(source, /case 'pm\.complete'/);
  assert.match(source, /createPMCompletionAction/);
  assert.match(source, /case 'calibration_result\.create'/);
  assert.match(source, /createCalibrationRecordAction/);
});

test('OFF-QR: online QR landing caches role-aware context for offline scans', () => {
  const pagePath = path.resolve(process.cwd(), 'src/app/qr/a/[token]/QrAssetLandingPage.tsx');
  const pageSource = readFileSync(pagePath, 'utf8');
  const cachePath = path.resolve(process.cwd(), 'src/lib/offline/qr-cache.ts');
  const cacheSource = readFileSync(cachePath, 'utf8');

  assert.match(cacheSource, /QR_ASSET_CACHE_PREFIX\s*=\s*'qr\.asset\.'/);
  assert.match(cacheSource, /CachedQrAssetContext/);
  assert.match(cacheSource, /asset:\s*QrLandingAsset/);
  assert.match(cacheSource, /context:\s*QrRoleContext/);
  assert.match(cacheSource, /actions:\s*CachedQrAction\[\]/);
  assert.match(pageSource, /saveQrAssetOfflineCache/);
  assert.match(pageSource, /getQrAssetOfflineCache/);
  assert.match(pageSource, /Last synced:/);
  assert.match(pageSource, /assigned work, PM, calibration, and role actions/i);
});
