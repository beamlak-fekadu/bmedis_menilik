'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { updateSpecificationRequestStatusAction } from '@/actions/documents.actions';

const TRANSITIONS: Record<string, { label: string; next: string; variant: 'primary' | 'outline' | 'destructive' }[]> = {
  submitted:   [{ label: 'Start Review', next: 'in_review', variant: 'primary' }, { label: 'Reject', next: 'rejected', variant: 'destructive' }],
  in_review:   [{ label: 'Mark In Progress', next: 'in_progress', variant: 'primary' }, { label: 'Reject', next: 'rejected', variant: 'destructive' }],
  in_progress: [{ label: 'Mark Completed', next: 'completed', variant: 'primary' }, { label: 'Cancel', next: 'cancelled', variant: 'destructive' }],
};

export function SpecificationRequestActions({ requestId, currentStatus }: { requestId: string; currentStatus: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const transitions = TRANSITIONS[currentStatus];

  if (!transitions?.length) return null;

  async function handleTransition(nextStatus: string) {
    setLoading(true);
    const result = await updateSpecificationRequestStatusAction(requestId, nextStatus);
    setLoading(false);
    if (!result.success) {
      toast('error', result.error ?? 'Failed to update status');
      return;
    }
    toast('success', `Request marked ${nextStatus.replace(/_/g, ' ')}`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {transitions.map((t) => (
        <Button key={t.next} variant={t.variant} size="sm" loading={loading} onClick={() => handleTransition(t.next)}>
          {t.label}
        </Button>
      ))}
    </div>
  );
}
