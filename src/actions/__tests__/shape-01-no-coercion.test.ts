import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isPostgrestNoRowsError, interpretMissingMutationResult } from '@/actions/_shared';

// SHAPE-01: every RLS-filterable UPDATE...select().single() path should use
// .maybeSingle() and translate 0 rows into a structured user-facing error.
//
// PostgREST's PGRST116 "Cannot coerce the result to a single JSON object"
// leaks into the UI otherwise. Phase 1 sweep covers the highest-risk modules
// (maintenance, PM, calibration, procurement, disposal, installation,
// specification requests, spare parts, equipment, profiles).

const repoRoot = process.cwd();

function readSource(rel: string): string {
  return readFileSync(path.resolve(repoRoot, rel), 'utf8');
}

test('SHAPE-01: isPostgrestNoRowsError detects PGRST116', () => {
  assert.equal(isPostgrestNoRowsError({ code: 'PGRST116', message: 'foo' }), true);
  assert.equal(
    isPostgrestNoRowsError({ message: 'Cannot coerce the result to a single JSON object' }),
    true,
  );
  assert.equal(isPostgrestNoRowsError({ code: 'OTHER' }), false);
  assert.equal(isPostgrestNoRowsError(null), false);
  assert.equal(isPostgrestNoRowsError(undefined), false);
});

test('SHAPE-01: interpretMissingMutationResult returns clean error', () => {
  const res = interpretMissingMutationResult({
    entity: 'maintenance request',
    entityId: 'req-uuid-1',
    profileId: 'prof-1',
  });
  assert.equal(res.success, false);
  assert.ok(typeof res.error === 'string');
  assert.match(res.error!, /maintenance request/);
  // Must NOT leak the raw PostgREST PGRST116 string to the user.
  assert.doesNotMatch(res.error!, /coerce|PGRST116/);
});

const SWEEP_TARGETS = [
  // file, expected interpretMissingMutationResult entity label
  ['src/actions/maintenance.actions.ts', 'work order'],
  ['src/actions/maintenance.actions.ts', 'maintenance request'],
  ['src/actions/pm.actions.ts', 'PM schedule'],
  ['src/actions/pm.actions.ts', 'PM plan'],
  ['src/actions/calibration.actions.ts', 'calibration request'],
  ['src/actions/installation.actions.ts', 'installation request'],
  ['src/actions/disposal.actions.ts', 'disposal request'],
  ['src/actions/documents.actions.ts', 'specification request'],
  ['src/actions/spare-parts.actions.ts', 'spare part'],
  ['src/actions/procurement.actions.ts', 'procurement request'],
  ['src/actions/equipment.actions.ts', 'equipment asset'],
  ['src/actions/users.actions.ts', 'user profile'],
] as const;

for (const [file, entity] of SWEEP_TARGETS) {
  test(`SHAPE-01: ${file} uses interpretMissingMutationResult for ${entity}`, () => {
    const src = readSource(file);
    assert.match(
      src,
      new RegExp(`interpretMissingMutationResult[\\s\\S]{0,200}entity:\\s*'${entity.replace(/ /g, '\\s*')}'`),
      `${file} must call interpretMissingMutationResult for ${entity}`,
    );
  });
}

// Verify the most dangerous historical pattern is gone from sweep targets:
// `.update(...).select('*').single()` returns PGRST116 on RLS-filtered rows.
test('SHAPE-01: no UPDATE...select(*).single() remains in swept action files', () => {
  const sweptFiles = [
    'src/actions/pm.actions.ts',
    'src/actions/calibration.actions.ts',
    'src/actions/installation.actions.ts',
    'src/actions/disposal.actions.ts',
    'src/actions/documents.actions.ts',
    'src/actions/spare-parts.actions.ts',
    'src/actions/procurement.actions.ts',
    'src/actions/equipment.actions.ts',
    'src/actions/users.actions.ts',
  ];
  for (const file of sweptFiles) {
    const src = readSource(file);
    // Allow the pattern only inside comments/old code that's not actually
    // executed. The simplest correct heuristic: no `.update(`-then-`.single()`
    // chain on the same statement.
    const pattern = /\.update\([^)]+\)[\s\S]{0,400}\.select\(\s*'\*'\s*\)\s*\.single\(\)/;
    assert.doesNotMatch(
      src,
      pattern,
      `${file} still contains unsafe .update(...).select('*').single() pattern`,
    );
  }
});
