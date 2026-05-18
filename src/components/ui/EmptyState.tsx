import { type ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import LottiePlayer, { LOTTIE_PATHS, type LottieKey } from './LottiePlayer';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /**
   * Optional Lottie animation key. Falls back to the lucide icon (or `icon`
   * prop) when the asset is missing — see `public/lottie/README.md` for the
   * list of expected files.
   */
  lottie?: LottieKey;
  /** Compact variant — used inline (e.g. inside a card) with smaller padding. */
  compact?: boolean;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  lottie,
  compact = false,
}: EmptyStateProps) {
  const fallbackIcon = (
    <div className="mb-4 text-[var(--text-subtle)]">
      {icon || <Inbox className="h-12 w-12" />}
    </div>
  );

  const visual = lottie ? (
    <LottiePlayer
      src={LOTTIE_PATHS[lottie]}
      style={{ width: compact ? 96 : 140, height: compact ? 96 : 140 }}
      fallback={fallbackIcon}
    />
  ) : (
    fallbackIcon
  );

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--border-subtle)] text-center ${
        compact ? 'py-8' : 'py-16'
      }`}
    >
      {visual}
      <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
