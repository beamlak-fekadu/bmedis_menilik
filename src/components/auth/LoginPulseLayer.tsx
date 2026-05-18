'use client';

import { useEffect, useRef } from 'react';

// Subtle biomedical ECG/heartbeat pulse SVG layered behind the login card.
// Uses GSAP for one isolated effect — never imported anywhere else in the app.
// Honours `prefers-reduced-motion`: when reduce is requested, the path renders
// statically (no animation, no GSAP timeline created).
//
// The path itself is intentionally minimal — a single ECG-shaped polyline drawn
// across the viewport. It complements the `AuthDashboardBackdrop` rather than
// fighting it.

export default function LoginPulseLayer() {
  const pathRef = useRef<SVGPathElement | null>(null);
  const tlRef = useRef<{ kill: () => void } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    let cancelled = false;
    let timeline: { kill: () => void } | null = null;

    // Lazy-import gsap so it never enters the SSR bundle and is only fetched
    // on the login page when the user actually sees it.
    import('gsap')
      .then((mod) => {
        if (cancelled || !pathRef.current) return;
        const gsap = mod.gsap ?? mod.default ?? mod;
        const length = pathRef.current.getTotalLength?.() ?? 1000;
        // Prime the stroke dash so the path "draws" from left to right.
        pathRef.current.style.strokeDasharray = `${length}`;
        pathRef.current.style.strokeDashoffset = `${length}`;
        const tween = gsap.to(pathRef.current, {
          strokeDashoffset: 0,
          duration: 4.2,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
        timeline = { kill: () => tween.kill() };
        tlRef.current = timeline;
      })
      .catch(() => {
        // GSAP failed to load — fine, the SVG just sits there statically.
      });

    return () => {
      cancelled = true;
      tlRef.current?.kill();
      tlRef.current = null;
    };
  }, []);

  return (
    <svg
      className="pointer-events-none absolute inset-x-0 bottom-[28%] hidden h-24 w-full opacity-[0.18] sm:block"
      viewBox="0 0 1200 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bmedis-pulse-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="20%" stopColor="var(--brand)" />
          <stop offset="80%" stopColor="var(--brand-2)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        ref={pathRef}
        d="M0 50 L260 50 L300 50 L320 30 L340 70 L360 10 L380 90 L400 50 L640 50 L680 50 L700 30 L720 70 L740 10 L760 90 L780 50 L1200 50"
        fill="none"
        stroke="url(#bmedis-pulse-gradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
