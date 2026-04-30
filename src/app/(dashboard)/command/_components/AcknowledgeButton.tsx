'use client';

import { useTransition } from 'react';
import { Check } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { acknowledgeFlag } from '@/actions/command.actions';

export function AcknowledgeButton({ flagId, label = 'Acknowledge' }: { flagId: string; label?: string }) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  if (!flagId) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await acknowledgeFlag(flagId);
          if (result.success) {
            toast('success', 'Flag acknowledged');
          } else {
            toast('error', result.error ?? 'Failed to acknowledge');
          }
        });
      }}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-color)] text-[var(--text-muted)] transition hover:border-emerald-400 hover:text-emerald-300 disabled:opacity-50"
      aria-label={label}
      title={label}
    >
      <Check className="h-3.5 w-3.5" />
    </button>
  );
}
