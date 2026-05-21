import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// EMBED-01: high-risk PostgREST embeds in the codebase must use explicit
// FK hints (`profiles!<table>_<col>_fkey(...)`). Bare `profiles(...)` works
// today on most tables, but `user_roles` has TWO FKs to profiles
// (user_id, assigned_by) and PGRST201 ambiguity has historically zeroed
// notifications, technician dropdowns, and assignment writes.
//
// This Phase 1 sweep locks the highest-risk files to explicit FK hints.

const repoRoot = process.cwd();
function readSource(rel: string): string {
  return readFileSync(path.resolve(repoRoot, rel), 'utf8');
}

const TARGETS = [
  // file, expected hint substring
  ['src/services/maintenance.service.ts', 'profiles!work_orders_assigned_to_fkey'],
  ['src/app/(dashboard)/command/_lib/command-center-data.ts', 'profiles!work_orders_assigned_to_fkey'],
  ['src/app/(dashboard)/calendar/_lib/calendar-data.ts', 'profiles!work_orders_assigned_to_fkey'],
  ['src/app/(dashboard)/calendar/_lib/calendar-data.ts', 'profiles!procurement_requests_requested_by_fkey'],
  ['src/services/reports.service.ts', 'profiles!equipment_qr_scans_scanned_by_fkey'],
  ['src/services/reports.service.ts', 'profiles!work_orders_assigned_to_fkey'],
  ['src/services/decision-support.service.ts', 'profiles!work_orders_assigned_to_fkey'],
  ['src/services/decision-support.service.ts', 'profiles!workload_capacity_snapshots_assignee_id_fkey'],
  ['src/services/qr-context.service.ts', 'profiles!work_orders_assigned_to_fkey'],
  ['src/services/developer-lab.service.ts', 'profiles!telegram_connections_profile_id_fkey'],
  ['src/services/notifications/recipient-resolver.ts', 'user_roles!user_roles_user_id_fkey'],
  ['src/actions/maintenance.actions.ts', 'user_roles!user_roles_user_id_fkey'],
] as const;

for (const [file, expected] of TARGETS) {
  test(`EMBED-01: ${file} uses ${expected.split('!')[1].split('(')[0]} hint`, () => {
    const src = readSource(file);
    assert.ok(
      src.includes(expected),
      `${file} must contain the explicit FK hint "${expected}"`,
    );
  });
}

// Defensive: in the files we sweep, there must be no remaining
// bare `profiles(` embed in a .select() string. Inline comments or
// type definitions are allowed.
const SWEPT_FILES = [
  'src/services/maintenance.service.ts',
  'src/services/reports.service.ts',
  'src/services/decision-support.service.ts',
  'src/services/qr-context.service.ts',
  'src/services/developer-lab.service.ts',
  'src/app/(dashboard)/command/_lib/command-center-data.ts',
  'src/app/(dashboard)/calendar/_lib/calendar-data.ts',
];

for (const file of SWEPT_FILES) {
  test(`EMBED-01: ${file} no bare profiles(...) embeds remain inside select strings`, () => {
    const src = readSource(file);
    // Strip comments.
    const stripped = src
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    // Find select(...) calls / SELECT template literals and scan them.
    // Heuristic: locate every occurrence of "profiles(" not preceded by "!".
    const matches = [...stripped.matchAll(/(?<!!)profiles\(/g)];
    // Allow `interface Profiles {` etc. by checking for an enclosing
    // .select( or backtick-template call within 800 chars before.
    const offenders = matches.filter((m) => {
      const idx = m.index ?? 0;
      const window = stripped.slice(Math.max(0, idx - 800), idx);
      return /\.select\s*\(\s*['"`]/.test(window) || /\.select\s*\(\s*`/.test(window);
    });
    assert.equal(
      offenders.length,
      0,
      `${file} still has ${offenders.length} bare profiles(...) embed(s) inside select calls`,
    );
  });
}
