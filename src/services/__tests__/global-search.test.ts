import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  canSearchGroup,
  normalizeGlobalSearchTerm,
  resultAllowedForDepartment,
  type GlobalSearchProfile,
} from '@/services/global-search.service';

const repoRoot = process.cwd();
function readSource(rel: string): string {
  return readFileSync(path.resolve(repoRoot, rel), 'utf8');
}

test('SEARCH-01: normalizes evaluator search input without wildcard leakage', () => {
  assert.equal(normalizeGlobalSearchTerm('  INF-001_%  '), 'INF-001');
  assert.equal(normalizeGlobalSearchTerm('WO-123, ventilator'), 'WO-123 ventilator');
});

test('SEARCH-01: department scoped result guard blocks cross-department rows', () => {
  const profile: GlobalSearchProfile = {
    id: 'profile-1',
    department_id: 'dept-a',
    roleNames: ['department_user'],
  };
  assert.equal(resultAllowedForDepartment(profile, { departmentId: 'dept-a' }), true);
  assert.equal(resultAllowedForDepartment(profile, { departmentId: 'dept-b' }), false);
});

test('SEARCH-01: store user search is limited to store-safe groups', () => {
  const profile: GlobalSearchProfile = {
    id: 'profile-store',
    department_id: null,
    roleNames: ['store_user'],
  };
  assert.equal(canSearchGroup(profile, 'spare_parts'), true);
  assert.equal(canSearchGroup(profile, 'procurement'), true);
  assert.equal(canSearchGroup(profile, 'work_orders'), true);
  assert.equal(canSearchGroup(profile, 'departments'), false);
});

test('SEARCH-01: topbar uses real global search palette instead of a fake input', () => {
  const topbar = readSource('src/components/layout/Topbar.tsx');
  assert.match(topbar, /GlobalSearchPalette/);
  assert.match(topbar, /setSearchOpen\(true\)/);
});

test('SEARCH-01: search API calls scoped global search service', () => {
  const route = readSource('src/app/api/search/route.ts');
  assert.match(route, /runGlobalSearch/);
  assert.match(route, /user_roles/);
  assert.match(route, /department_id/);
});

