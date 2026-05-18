// Shared framer-motion presets for BMEDIS.
//
// Rules:
//  - Subtle, fast, professional — no cinematic bouncing.
//  - All transitions short (≤ 280ms) so operational UIs stay snappy.
//  - Consumers should pair these with the `useReducedMotionSafe` hook below
//    when wrapping non-essential motion; the hook returns a no-op variant
//    when the user prefers reduced motion.

import { useReducedMotion, type Transition, type Variants } from 'framer-motion';

const easeOutSoft: Transition['ease'] = [0.22, 0.61, 0.36, 1];
const easeInOutSoft: Transition['ease'] = [0.4, 0, 0.2, 1];

export const transitions = {
  fast: { duration: 0.16, ease: easeOutSoft } satisfies Transition,
  default: { duration: 0.22, ease: easeOutSoft } satisfies Transition,
  slow: { duration: 0.28, ease: easeInOutSoft } satisfies Transition,
  spring: { type: 'spring', stiffness: 340, damping: 32, mass: 0.9 } satisfies Transition,
};

export const pageFade: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: transitions.default },
  exit: { opacity: 0, y: -2, transition: transitions.fast },
};

export const slideUp: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: transitions.default },
  exit: { opacity: 0, y: 6, transition: transitions.fast },
};

export const cardStagger: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
  exit: {},
};

export const cardItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: transitions.default },
  exit: { opacity: 0, y: 4, transition: transitions.fast },
};

export const drawerSlideRight: Variants = {
  initial: { x: '100%', opacity: 0.6 },
  animate: { x: 0, opacity: 1, transition: transitions.slow },
  exit: { x: '100%', opacity: 0.6, transition: transitions.default },
};

export const drawerSlideLeft: Variants = {
  initial: { x: '-100%', opacity: 0.6 },
  animate: { x: 0, opacity: 1, transition: transitions.slow },
  exit: { x: '-100%', opacity: 0.6, transition: transitions.default },
};

export const modalScale: Variants = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1, transition: transitions.default },
  exit: { opacity: 0, scale: 0.98, transition: transitions.fast },
};

export const tabCrossfade: Variants = {
  initial: { opacity: 0, y: 2 },
  animate: { opacity: 1, y: 0, transition: transitions.fast },
  exit: { opacity: 0, y: -2, transition: { duration: 0.12 } },
};

export const subtleHover = {
  whileHover: { y: -1 },
  whileTap: { y: 0, scale: 0.995 },
  transition: transitions.fast,
};

// Use only for critical/attention surfaces (e.g. unread critical notification).
// Keep loop subtle — no flashing.
export const attentionPulse: Variants = {
  initial: { opacity: 0.8 },
  animate: {
    opacity: [0.8, 1, 0.8],
    transition: { duration: 2.4, repeat: Infinity, ease: easeInOutSoft },
  },
};

// Returns the given variants, or `noMotion` variants when reduced motion is
// requested. The result is still a valid framer-motion Variants object so call
// sites don't need to branch on a boolean.
export const noMotion: Variants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 1 },
};

export function useMotionVariants(variants: Variants): Variants {
  const reduce = useReducedMotion();
  return reduce ? noMotion : variants;
}
