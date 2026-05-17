'use client';

import Link from 'next/link';
import { Filter, X } from 'lucide-react';

export type AssetFilterChipAsset = {
  id: string;
  asset_code?: string | null;
  name?: string | null;
};

type Props = {
  asset: AssetFilterChipAsset | null;
  clearHref: string;
  source?: string | null;
  className?: string;
};

export default function AssetFilterChip({ asset, clearHref, source, className }: Props) {
  if (!asset) return null;
  const label = `${asset.asset_code ?? 'Asset'}${asset.name ? ` · ${asset.name}` : ''}`;
  const sourceLabel = source === 'qr-scan' ? 'QR scan' : source ?? null;
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-lg border border-[var(--brand)]/40 bg-[var(--brand)]/10 px-3 py-2 text-xs ${className ?? ''}`}
    >
      <Filter className="h-3.5 w-3.5 text-[var(--brand)]" />
      <span className="font-medium text-[var(--foreground)]">Filtered to:</span>
      <span className="truncate text-[var(--foreground)]">{label}</span>
      {sourceLabel ? (
        <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
          {sourceLabel}
        </span>
      ) : null}
      <Link
        href={clearHref}
        className="ml-auto inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] px-2 py-1 text-[11px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
      >
        <X className="h-3 w-3" />
        Clear filter
      </Link>
    </div>
  );
}
