'use client';

import { useTransition } from 'react';
import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { refreshCommandCenter } from '@/actions/command.actions';

export function RefreshButton() {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  return (
    <Button
      size="sm"
      variant="outline"
      loading={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await refreshCommandCenter();
          if (result.success) {
            toast('success', 'Command Center refreshed');
          } else {
            toast('error', result.error ?? 'Refresh failed');
          }
        });
      }}
      aria-label="Refresh Command Center data"
    >
      <RefreshCcw className="h-4 w-4" />
      Refresh
    </Button>
  );
}
