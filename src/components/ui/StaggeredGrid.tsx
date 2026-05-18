'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cardItem, cardStagger } from '@/lib/ui/motion-presets';

// Tiny client-side wrapper that lets server-rendered pages opt into the
// shared `cardStagger` reveal without converting the entire page to a client
// component. Pass `as="div"` to control the wrapper element (default `div`).
//
// Usage:
//   <StaggeredGrid className="grid gap-3 md:grid-cols-4">
//     <StaggeredItem><Card>…</Card></StaggeredItem>
//     <StaggeredItem><Card>…</Card></StaggeredItem>
//   </StaggeredGrid>

type StaggeredGridProps = {
  children: ReactNode;
  className?: string;
};

export function StaggeredGrid({ children, className }: StaggeredGridProps) {
  return (
    <motion.div
      variants={cardStagger}
      initial="initial"
      animate="animate"
      className={className}
    >
      {children}
    </motion.div>
  );
}

type StaggeredItemProps = {
  children: ReactNode;
  className?: string;
};

export function StaggeredItem({ children, className }: StaggeredItemProps) {
  return (
    <motion.div variants={cardItem} className={className}>
      {children}
    </motion.div>
  );
}
