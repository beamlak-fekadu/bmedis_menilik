import test from 'node:test';
import assert from 'node:assert/strict';
import { sortReplacementCandidatesByRank } from '@/utils/decision-support/replacement-ranking';

test('replacement candidates are ordered by stored global rank before display limits', () => {
  const rows = [1, 5, 3, 2, 6].map((rank) => ({
    asset_id: `asset-${rank}`,
    asset_code: `EQ-${rank}`,
    rank,
    replacement_priority_index: 0.57,
  }));

  const sorted = sortReplacementCandidatesByRank(rows);

  assert.deepEqual(sorted.map((row) => row.rank), [1, 2, 3, 5, 6]);
});

test('replacement candidate ordering falls back to RPI then asset code when rank is missing', () => {
  const rows = [
    { asset_id: 'b', asset_code: 'EQ-B', rank: null, replacement_priority_index: 0.61 },
    { asset_id: 'a', asset_code: 'EQ-A', rank: null, replacement_priority_index: 0.61 },
    { asset_id: 'c', asset_code: 'EQ-C', rank: null, replacement_priority_index: 0.72 },
  ];

  const sorted = sortReplacementCandidatesByRank(rows);

  assert.deepEqual(sorted.map((row) => row.asset_code), ['EQ-C', 'EQ-A', 'EQ-B']);
});
