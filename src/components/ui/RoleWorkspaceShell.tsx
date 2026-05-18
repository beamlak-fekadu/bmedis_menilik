'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Shield } from 'lucide-react';
import { pageFade } from '@/lib/ui/motion-presets';
import { getRoleAccent } from '@/lib/ui/role-theme';
import type { RoleName } from '@/types/roles';

// Role-aware wrapper for the body of a role-tailored dashboard (Command
// Center, Field Workbench, Logistics Control, etc).
//
// The shell:
//  - tags the workspace with a role chip and short subtitle,
//  - applies a `pageFade` mount transition,
//  - renders an optional dense-mode notice when used by non-developer roles
//    (in case a Tier 1 page accidentally surfaces developer-grade tables).
//
// It does NOT replace `PageHeader`. Mount this *inside* the page after the
// PageHeader for the role-specific section.

type RoleWorkspaceShellProps = {
  role: RoleName | null | undefined;
  /** Overrides the default role label (e.g. "BME Command Center"). */
  label?: string;
  /** Overrides the default role subtitle. */
  subtitle?: string;
  /** Optional right-side meta (e.g. live timestamp, refresh button). */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function RoleWorkspaceShell({
  role,
  label,
  subtitle,
  meta,
  children,
  className,
}: RoleWorkspaceShellProps) {
  const accent = getRoleAccent(role);
  return (
    <motion.section
      variants={pageFade}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`flex flex-col gap-4 ${className ?? ''}`}
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
            style={{
              background: accent.accentSoft,
              color: accent.accentText,
              boxShadow: `inset 0 0 0 1px ${accent.accent}33`,
            }}
          >
            <Shield className="h-3 w-3" />
            {label ?? accent.workspaceLabel}
          </span>
          <p className="hidden text-xs text-[var(--text-muted)] sm:block">
            {subtitle ?? accent.workspaceSubtitle}
          </p>
        </div>
        {meta && <div className="text-xs text-[var(--text-muted)]">{meta}</div>}
      </header>
      <div className="sm:hidden">
        <p className="text-xs text-[var(--text-muted)]">{subtitle ?? accent.workspaceSubtitle}</p>
      </div>
      <div>{children}</div>
    </motion.section>
  );
}
