'use client';

import { X } from 'lucide-react';

interface ClearFiltersButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

/**
 * Subtle "Reset view" affordance shown only when a UI filter is active.
 * Clears local UI state (tabs, chips, card filters, search) without affecting
 * data. Page-level reset wiring is the caller's responsibility.
 */
export default function ClearFiltersButton({ onClick, label = 'Reset view', className = '' }: ClearFiltersButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-1 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--brand)]/50 hover:text-[var(--foreground)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${className}`}
    >
      <X className="h-3 w-3" />
      {label}
    </button>
  );
}
