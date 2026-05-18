'use client';

import { useEffect, useState, type CSSProperties } from 'react';

// Thin wrapper around @lottiefiles/dotlottie-react with:
//  - dynamic import so it's not pulled into the server bundle,
//  - graceful fallback when the .lottie asset is missing or fails to load,
//  - prefers-reduced-motion respect (renders nothing if reduced motion).
//
// NOTE: No real .lottie assets ship in this pass. The src paths below are
// placeholders that match the expected `public/lottie/*.lottie` filenames.
// If an asset is missing, the component renders the supplied `fallback` (or
// null) and never crashes — EmptyState / LoadingState wrap this for their
// own icon-based fallbacks.

type LottieProps = {
  src: string;
  loop?: boolean;
  autoplay?: boolean;
  style?: CSSProperties;
  className?: string;
  fallback?: React.ReactNode;
  ariaLabel?: string;
};

export default function LottiePlayer({
  src,
  loop = true,
  autoplay = true,
  style,
  className,
  fallback = null,
  ariaLabel,
}: LottieProps) {
  const [Player, setPlayer] = useState<React.ComponentType<{
    src: string;
    loop?: boolean;
    autoplay?: boolean;
    style?: CSSProperties;
    className?: string;
  }> | null>(null);
  const [failed, setFailed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setReduceMotion(window.matchMedia('(prefers-color-scheme: reduce)').matches === false
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    import('@lottiefiles/dotlottie-react')
      .then((mod) => {
        if (!cancelled) setPlayer(() => mod.DotLottieReact);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Verify the asset exists; HEAD request avoids loading the binary just to check.
  useEffect(() => {
    let cancelled = false;
    if (typeof window === 'undefined') return;
    fetch(src, { method: 'HEAD' })
      .then((res) => {
        if (!cancelled && !res.ok) setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (failed || !Player || reduceMotion) {
    return <>{fallback}</>;
  }

  return (
    <div role={ariaLabel ? 'img' : undefined} aria-label={ariaLabel} className={className} style={style}>
      <Player src={src} loop={loop} autoplay={autoplay} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

// Canonical paths the EmptyState/LoadingState components reference. The actual
// .lottie files are NOT in this pass — see README/AGENTS for the list to add.
export const LOTTIE_PATHS = {
  empty: '/lottie/empty-state.lottie',
  offline: '/lottie/offline.lottie',
  success: '/lottie/success.lottie',
  notification: '/lottie/notification.lottie',
  aiThinking: '/lottie/ai-thinking.lottie',
  scan: '/lottie/scan.lottie',
} as const;

export type LottieKey = keyof typeof LOTTIE_PATHS;
