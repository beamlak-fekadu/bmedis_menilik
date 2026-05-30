export type ReplacementRankable = {
  rank?: number | null;
  replacement_rank?: number | null;
  rpi?: number | null;
  replacement_priority_index?: number | null;
  priority_index?: number | null;
  asset_code?: string | null;
  asset_name?: string | null;
  name?: string | null;
  id?: string | null;
  asset_id?: string | null;
  asset?: {
    asset_code?: string | null;
    name?: string | null;
  } | null;
  equipment_assets?: {
    asset_code?: string | null;
    name?: string | null;
  } | null;
};

function validRank(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function numericValue(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stableKey(row: ReplacementRankable): string {
  return (
    row.asset_code ??
    row.asset?.asset_code ??
    row.equipment_assets?.asset_code ??
    row.asset_name ??
    row.asset?.name ??
    row.equipment_assets?.name ??
    row.name ??
    row.asset_id ??
    row.id ??
    ''
  );
}

export function compareReplacementCandidatesByRank<T extends ReplacementRankable>(a: T, b: T): number {
  const aRank = validRank(a.rank ?? a.replacement_rank);
  const bRank = validRank(b.rank ?? b.replacement_rank);

  if (aRank != null || bRank != null) {
    if (aRank == null) return 1;
    if (bRank == null) return -1;
    if (aRank !== bRank) return aRank - bRank;
  }

  const aRpi = numericValue(a.rpi ?? a.replacement_priority_index ?? a.priority_index);
  const bRpi = numericValue(b.rpi ?? b.replacement_priority_index ?? b.priority_index);

  if (aRpi !== bRpi) {
    return bRpi - aRpi;
  }

  return stableKey(a).localeCompare(stableKey(b));
}

export function sortReplacementCandidatesByRank<T extends ReplacementRankable>(rows: T[]): T[] {
  return [...rows].sort(compareReplacementCandidatesByRank);
}
