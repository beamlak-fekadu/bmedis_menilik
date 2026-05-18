'use client';

import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui';

// Shared shell for Nivo charts. Handles:
//  - title/description above the chart,
//  - explicit responsive height (Nivo needs a sized container),
//  - empty state when no data, instead of a blank chart,
//  - optional `footer` slot for legend or "as of …" caption.
//
// Use this for every Nivo chart so density and empty-state behaviour stay
// consistent across the app.

type NivoChartShellProps = {
  title?: string;
  description?: string;
  height?: number;
  /** When true, renders the EmptyState instead of children. */
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  footer?: ReactNode;
  /** Right-side meta (e.g. a link to drilldown or a small filter). */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

export default function NivoChartShell({
  title,
  description,
  height = 280,
  isEmpty = false,
  emptyTitle = 'No chart data available',
  emptyDescription = 'There is not enough data to render this chart right now.',
  footer,
  action,
  className,
  children,
}: NivoChartShellProps) {
  return (
    <div className={`panel-surface rounded-2xl p-4 ${className ?? ''}`}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div style={{ height }} className="relative">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState title={emptyTitle} description={emptyDescription} compact />
          </div>
        ) : (
          children
        )}
      </div>
      {footer && (
        <div className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-muted)]">
          {footer}
        </div>
      )}
    </div>
  );
}
