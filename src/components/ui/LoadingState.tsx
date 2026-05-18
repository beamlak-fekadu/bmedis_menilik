'use client';

import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import LottiePlayer, { LOTTIE_PATHS, type LottieKey } from './LottiePlayer';

// Page/card-level loading state. Falls back to a spinner when the optional
// Lottie asset is unavailable. Use Spinner for inline button-level loading;
// this component is for "filling a card or page region" loading states.

type LoadingStateProps = {
  title?: string;
  description?: string;
  lottie?: LottieKey;
  size?: 'sm' | 'md' | 'lg';
  /** Compact — fits inside an existing card with reduced padding. */
  compact?: boolean;
};

const SIZE = {
  sm: { lottie: 64, pad: 'py-6' },
  md: { lottie: 96, pad: 'py-10' },
  lg: { lottie: 140, pad: 'py-16' },
};

export default function LoadingState({
  title = 'Loading',
  description,
  lottie = 'aiThinking',
  size = 'md',
  compact = false,
}: LoadingStateProps) {
  const { lottie: lottieSize, pad } = SIZE[size];

  const fallback = (
    <motion.div
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      className="flex flex-col items-center gap-2 text-[var(--text-muted)]"
    >
      <Loader2 className="h-7 w-7 animate-spin" />
    </motion.div>
  );

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-4' : pad
      }`}
      role="status"
      aria-live="polite"
    >
      <LottiePlayer
        src={LOTTIE_PATHS[lottie]}
        style={{ width: lottieSize, height: lottieSize }}
        fallback={fallback}
      />
      <h3 className="mt-3 text-sm font-medium text-[var(--foreground)]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-[var(--text-muted)]">{description}</p>
      )}
    </div>
  );
}
