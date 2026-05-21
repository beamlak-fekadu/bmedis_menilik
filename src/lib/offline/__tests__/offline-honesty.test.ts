import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { OFFLINE_ACTION_DEFINITIONS } from '@/types/offline';

// OFF-02 regression: the work_order.complete_draft action MUST NOT be
// labeled or described as a real completion. Replay only logs a
// maintenance event; the WO stays open until the user reconnects online
// and calls Confirm Completion.

test('OFF-02: work_order.complete_draft label states the work order stays open', () => {
  const def = OFFLINE_ACTION_DEFINITIONS['work_order.complete_draft'];
  assert.ok(def, 'definition must exist');
  // Label must not claim the WO is completed/closed.
  assert.doesNotMatch(def.label, /\bcompletes?\b|\bcomplete work order\b/i);
  // Label must mention that the work order remains open.
  assert.match(def.label, /open|note|intent/i);
});

test('OFF-02: WO detail page toast does not falsely claim completion', () => {
  const pagePath = path.resolve(
    process.cwd(),
    'src/app/(dashboard)/maintenance/work-orders/[id]/page.tsx',
  );
  const source = readFileSync(pagePath, 'utf8');

  // Find the saveCompletionDraft function body.
  const startIdx = source.indexOf('async function saveCompletionDraft');
  assert.ok(startIdx > 0, 'saveCompletionDraft must exist');
  const slice = source.slice(startIdx, startIdx + 4000);

  // Must not contain "Completion draft saved" as the success message —
  // that wording falsely implied completion.
  assert.doesNotMatch(slice, /toast\([^)]*['"]Completion draft saved['"]/);
  // Must explicitly say the work order remains open.
  assert.match(slice, /remains open|stays open|work order remains/i);
});

test('OFF-02: completion modal contains an honesty banner about Save Draft', () => {
  const pagePath = path.resolve(
    process.cwd(),
    'src/app/(dashboard)/maintenance/work-orders/[id]/page.tsx',
  );
  const source = readFileSync(pagePath, 'utf8');
  // The modal must explicitly say Save Draft does NOT close the WO.
  // Source may contain multi-line whitespace between "does" and "NOT".
  const normalised = source.replace(/\s+/g, ' ');
  assert.match(normalised, /Save Draft.{0,200}does NOT close/i);
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
