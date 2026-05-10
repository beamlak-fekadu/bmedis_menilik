'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { updateInstallationRequestStatusAction } from '@/actions/installation.actions';

const TRANSITIONS: Record<string, { label: string; next: string; variant: 'primary' | 'outline' | 'destructive' }[]> = {
  submitted:   [{ label: 'Approve', next: 'approved', variant: 'primary' }, { label: 'Reject', next: 'rejected', variant: 'destructive' }],
  approved:    [{ label: 'Schedule', next: 'scheduled', variant: 'primary' }, { label: 'Reject', next: 'rejected', variant: 'destructive' }],
  scheduled:   [{ label: 'Start Installation', next: 'in_progress', variant: 'primary' }, { label: 'Cancel', next: 'cancelled', variant: 'destructive' }],
  in_progress: [{ label: 'Mark Completed', next: 'completed', variant: 'primary' }, { label: 'Cancel', next: 'cancelled', variant: 'destructive' }],
};

export function InstallationRequestActions({ requestId, currentStatus }: { requestId: string; currentStatus: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const transitions = TRANSITIONS[currentStatus];

  if (!transitions?.length) return null;

  async function handleTransition(nextStatus: string) {
    setLoading(true);
    const result = await updateInstallationRequestStatusAction(requestId, nextStatus);
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
