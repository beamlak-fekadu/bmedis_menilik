'use client';

import { useTransition } from 'react';
import { Check } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { acknowledgeAssetFlags, acknowledgeTriageItem } from '@/actions/command.actions';

export function AcknowledgeButton({
  queueId,
  assetId,
  hasActiveFlag,
  label = 'Acknowledge',
}: {
  queueId: string;
  assetId: string;
  hasActiveFlag?: boolean;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  if (!queueId) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await acknowledgeTriageItem(queueId);
          if (result.success && hasActiveFlag) {
            const flagsResult = await acknowledgeAssetFlags(assetId);
            if (!flagsResult.success) {
              toast('error', flagsResult.error ?? 'Triage dismissed, but flags were not acknowledged');
              return;
            }
          }
          if (result.success) {
            toast('success', 'Triage item acknowledged');
          } else {
            toast('error', result.error ?? 'Failed to acknowledge');
          }
        });
      }}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-subtle)] text-[var(--text-muted)] transition hover:border-emerald-400 hover:text-emerald-300 disabled:opacity-50"
      aria-label={label}
      title={label}
    >
      <Check className="h-3.5 w-3.5" />
    </button>
  );
}
