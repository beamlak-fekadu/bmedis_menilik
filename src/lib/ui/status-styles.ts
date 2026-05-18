// Semantic status styles. Sits *next to* `src/components/ui/action-styles.ts`
// which is button-focused — this module is for badge/chip/border/text styling
// of a status itself (e.g. critical risk, overdue PM, low stock).
//
// Keep this in one place so every page renders "critical", "overdue", etc.
// with the same color meaning.

export type SemanticTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'brand'
  | 'developer';

export const toneBadgeClass: Record<SemanticTone, string> = {
  neutral:
    'inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-3)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]',
  info:
    'inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklab,var(--chart-3)_40%,transparent)] bg-[color-mix(in_oklab,var(--chart-3)_16%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--chart-3)]',
  success:
    'inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklab,var(--success)_40%,transparent)] bg-[color-mix(in_oklab,var(--success)_16%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--success)]',
  warning:
    'inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklab,var(--warning)_40%,transparent)] bg-[color-mix(in_oklab,var(--warning)_16%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--warning)]',
  danger:
    'inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklab,var(--danger)_40%,transparent)] bg-[color-mix(in_oklab,var(--danger)_16%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--danger)]',
  brand:
    'inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklab,var(--brand)_40%,transparent)] bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand)]',
  developer:
    'inline-flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-400',
};

export const toneRingClass: Record<SemanticTone, string> = {
  neutral: 'ring-1 ring-inset ring-[var(--border-subtle)]',
  info: 'ring-1 ring-inset ring-[color-mix(in_oklab,var(--chart-3)_40%,transparent)]',
  success: 'ring-1 ring-inset ring-[color-mix(in_oklab,var(--success)_40%,transparent)]',
  warning: 'ring-1 ring-inset ring-[color-mix(in_oklab,var(--warning)_40%,transparent)]',
  danger: 'ring-1 ring-inset ring-[color-mix(in_oklab,var(--danger)_40%,transparent)]',
  brand: 'ring-1 ring-inset ring-[color-mix(in_oklab,var(--brand)_40%,transparent)]',
  developer: 'ring-1 ring-inset ring-violet-500/40',
};

export const toneDotClass: Record<SemanticTone, string> = {
  neutral: 'bg-[var(--text-subtle)]',
  info: 'bg-[var(--chart-3)]',
  success: 'bg-[var(--success)]',
  warning: 'bg-[var(--warning)]',
  danger: 'bg-[var(--danger)]',
  brand: 'bg-[var(--brand)]',
  developer: 'bg-violet-500',
};

// Common status string → tone mapping. Pages can extend or override as needed.
const STATUS_TONE: Record<string, SemanticTone> = {
  critical: 'danger',
  overdue: 'danger',
  blocked: 'danger',
  stockout: 'danger',
  revoked: 'danger',
  failed: 'danger',
  conflict: 'danger',

  high: 'warning',
  warning: 'warning',
  low_stock: 'warning',
  needs_repair: 'warning',
  deferred: 'warning',
  delayed: 'warning',
  pending: 'warning',
  under_review: 'warning',

  medium: 'info',
  upcoming: 'info',
  scheduled: 'info',
  in_progress: 'info',
  approved: 'info',
  syncing: 'info',
  queued: 'info',

  low: 'success',
  ok: 'success',
  healthy: 'success',
  functional: 'success',
  completed: 'success',
  resolved: 'success',
  synced: 'success',
  resolved_synced: 'success',
  current: 'success',

  developer: 'developer',
};

export function statusTone(status: string | null | undefined): SemanticTone {
  if (!status) return 'neutral';
  return STATUS_TONE[status.toLowerCase()] ?? 'neutral';
}
