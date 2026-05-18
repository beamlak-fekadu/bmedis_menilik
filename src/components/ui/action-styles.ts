// Canonical action button style classes for row-level actions across BMEDIS
// operational pages. Use these instead of one-off color choices so every page
// agrees on what red/amber/emerald/brand "means".
//
// Reference standard: Command Center, Equipment, Maintenance, Work Orders, PM.
//
// Semantics:
//  - brand/primary  → primary workflow action (assign, create, schedule, open the next step)
//  - danger         → urgent/destructive/blocker (stockout, escalate, delete)
//  - warning        → review/escalation/attention (review, low stock, delay)
//  - success        → success/complete/issue (complete WO, issue part, mark done)
//  - neutral        → secondary/evidence/view-only (open record, view evidence)
//  - developer      → developer-only / debug surfaces

export const actionButtonClass = {
  brand:
    'inline-flex items-center gap-1 rounded-md bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:cursor-not-allowed disabled:bg-[var(--surface-3)] disabled:text-[var(--text-muted)]',
  danger:
    'inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:bg-[var(--surface-3)] disabled:text-[var(--text-muted)]',
  warning:
    'inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:bg-[var(--surface-3)] disabled:text-[var(--text-muted)]',
  warningSubtle:
    'inline-flex items-center gap-1 rounded-md border border-amber-500/60 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
  success:
    'inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-[var(--surface-3)] disabled:text-[var(--text-muted)]',
  neutral:
    'inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-3)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
  developer:
    'inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
} as const;

export type ActionTone = keyof typeof actionButtonClass;
