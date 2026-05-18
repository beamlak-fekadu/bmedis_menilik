'use client';

import { useEffect, useState } from 'react';
import { animated, useSpring } from '@react-spring/web';

// Compact circular gauge backed by react-spring. Used for readiness, PM/cal
// compliance, availability, replacement risk, etc.
//
// `tone` keys map to BMEDIS status colours. Pass a numeric 0–100 value (the
// component clamps internally). When out of range or NaN, it renders a neutral
// "no data" arc.

export type GaugeTone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const TONE_VAR: Record<GaugeTone, string> = {
  brand: 'var(--brand)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--chart-3)',
  muted: 'var(--text-subtle)',
};

export type SpringGaugeProps = {
  /** 0–100. Values outside the range are clamped. NaN/undefined → no-data state. */
  value: number | null | undefined;
  /** Visual size in px. Default 96. */
  size?: number;
  /** Arc stroke thickness. Default 8. */
  thickness?: number;
  /** Tone — defaults to `brand`, or auto-resolved from value via `autoTone`. */
  tone?: GaugeTone;
  /** When true, pick tone from value (>=85 success, >=60 brand, >=40 warning, else danger). */
  autoTone?: boolean;
  /** Display label below the value (e.g. "PM compliance"). */
  label?: string;
  /** Optional unit appended to the number ("%" by default). */
  unit?: string;
  /** Decimal places for the centre number. Default 0. */
  decimals?: number;
  /** Accessible label for the gauge as a whole. */
  ariaLabel?: string;
};

function resolveAutoTone(value: number): GaugeTone {
  if (value >= 85) return 'success';
  if (value >= 60) return 'brand';
  if (value >= 40) return 'warning';
  return 'danger';
}

export default function SpringGauge({
  value,
  size = 96,
  thickness = 8,
  tone,
  autoTone = false,
  label,
  unit = '%',
  decimals = 0,
  ariaLabel,
}: SpringGaugeProps) {
  const hasValue = typeof value === 'number' && Number.isFinite(value);
  const clamped = hasValue ? Math.max(0, Math.min(100, value as number)) : 0;
  const resolvedTone: GaugeTone = hasValue
    ? autoTone && !tone
      ? resolveAutoTone(clamped)
      : tone ?? 'brand'
    : 'muted';

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

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  const spring = useSpring({
    from: { dash: circumference },
    to: { dash: circumference - (clamped / 100) * circumference },
    config: { tension: 180, friction: 26, duration: reduce ? 0 : undefined },
  });

  const centerText = hasValue ? `${clamped.toFixed(decimals)}${unit}` : '—';

  return (
    <div
      className="inline-flex flex-col items-center gap-1.5"
      role="img"
      aria-label={ariaLabel ?? `${label ?? 'Gauge'}: ${centerText}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth={thickness}
          />
          <animated.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={TONE_VAR[resolvedTone]}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={spring.dash}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[15px] font-semibold tabular-nums text-[var(--foreground)]"
            style={{ fontSize: Math.max(13, size * 0.18) }}
          >
            {centerText}
          </span>
        </div>
      </div>
      {label && (
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </span>
      )}
    </div>
  );
}
