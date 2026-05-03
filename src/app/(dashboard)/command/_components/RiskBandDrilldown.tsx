'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface RiskBandAsset {
  asset_id: string;
  asset_code: string;
  asset_name: string;
  department_name: string;
  rpn: number;
}

export interface RiskBand {
  key: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  range: string;
  count: number;
  percentage: number;
  colorClass: string;
  textClass: string;
  topAssets: RiskBandAsset[];
}

export function RiskBandDrilldown({ bands, totalAssessed }: { bands: RiskBand[]; totalAssessed: number }) {
  const [expanded, setExpanded] = useState<RiskBand['key'] | null>(null);

  return (
    <div className="space-y-2">
      {bands.map((band) => {
        const isOpen = expanded === band.key;
        const widthPct = totalAssessed > 0 ? (band.count / totalAssessed) * 100 : 0;
        return (
          <div key={band.key} className="rounded-lg border border-[var(--border-subtle)]/60">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : band.key)}
              className="flex w-full flex-col gap-3 p-3 text-left transition hover:bg-[var(--surface-2)]/60 sm:flex-row sm:items-center sm:justify-between"
              aria-expanded={isOpen}
              aria-label={`${band.label} band — ${band.count} equipment, ${band.percentage}%`}
            >
              <div className="flex w-full items-center gap-3 sm:w-64">
                <span className={`inline-flex h-6 min-w-[5rem] items-center justify-center rounded-md px-2 text-xs font-semibold ${band.colorClass} ${band.textClass}`}>
                  {band.label}
                </span>
                <span className="text-xs text-[var(--text-muted)]">RPN {band.range}</span>
              </div>
              <div className="flex w-full items-center gap-4">
                <div className="h-3 min-w-[9rem] flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className={`h-full ${band.colorClass}`}
                    style={{ width: band.count > 0 ? `max(${widthPct.toFixed(2)}%, 12px)` : '0' }}
                    aria-hidden
                  />
                </div>
                <div className="flex w-24 items-baseline justify-end gap-1">
                  <span className="text-lg font-semibold text-[var(--foreground)]">{band.count}</span>
                  <span className="text-xs text-[var(--text-muted)]">({band.percentage}%)</span>
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" /> : <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />}
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-[var(--border-subtle)]/60 p-3">
                {band.topAssets.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">No equipment in this band.</p>
                ) : (
                  <ul className="divide-y divide-[var(--border-subtle)]/60">
                    {band.topAssets.map((asset) => (
                      <li key={asset.asset_id} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <p className="font-medium text-[var(--foreground)]">{asset.asset_name}</p>
                          <p className="text-xs text-[var(--text-muted)]">{asset.asset_code} • {asset.department_name}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-[var(--foreground)]">RPN {asset.rpn}</span>
                          <Link
                            href={`/equipment/${asset.asset_id}`}
                            className="text-xs font-medium text-violet-300 hover:text-violet-200"
                          >
                            View asset →
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
