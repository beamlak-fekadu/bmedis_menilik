'use client';

import { useEffect, useState } from 'react';
import { animated, useSpring } from '@react-spring/web';

// Spring-animated numeric value. Replaces a static `<span>123</span>` with a
// counter that eases to its current value. Use sparingly — only for headline
// KPI numbers, not every cell in a table.
//
// Honours `prefers-reduced-motion`: when reduced motion is requested, the
// value snaps to its target instantly.

export type AnimatedMetricProps = {
  /** Numeric target value. */
  value: number;
  /** Decimal places to display. Default 0. */
  decimals?: number;
  /** Optional formatter (overrides decimals). e.g. percentage, currency. */
  format?: (value: number) => string;
  /** Suffix appended after the formatted value, e.g. '%'. */
  suffix?: string;
  /** Prefix prepended before the formatted value, e.g. '$'. */
  prefix?: string;
  /** Spring config — default is a calm tension/friction. */
  duration?: number;
  className?: string;
  /** Accessible label override for screen readers (final value). */
  ariaLabel?: string;
};

export default function AnimatedMetric({
  value,
  decimals = 0,
  format,
  suffix,
  prefix,
  duration = 900,
  className,
  ariaLabel,
}: AnimatedMetricProps) {
  const [reduce, setReduce] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduce(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const safeValue = Number.isFinite(value) ? value : 0;
  const spring = useSpring({
    from: { n: 0 },
    to: { n: safeValue },
    config: { duration: reduce ? 0 : duration },
    reset: false,
  });

  const formatted = (n: number) => {
    if (format) return format(n);
    return n.toFixed(decimals);
  };

  const finalDisplay = `${prefix ?? ''}${formatted(safeValue)}${suffix ?? ''}`;

  return (
    <animated.span
      className={className}
      aria-label={ariaLabel ?? finalDisplay}
    >
      {spring.n.to((n) => `${prefix ?? ''}${formatted(Number(n))}${suffix ?? ''}`)}
    </animated.span>
  );
}
