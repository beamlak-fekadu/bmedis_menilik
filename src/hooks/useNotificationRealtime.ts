'use client';

import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getMyNotificationIdentityAction } from '@/actions/notifications.actions';
import { createClient } from '@/lib/supabase/client';
import { subscribeToNotificationUpdates } from '@/lib/notifications/client-events';

export function useNotificationRealtime(onChange: () => void) {
  const callbackRef = useRef(onChange);

  useEffect(() => {
    callbackRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    return subscribeToNotificationUpdates(() => {
      void callbackRef.current();
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    const supabase = createClient();

    async function subscribe() {
      const identity = await getMyNotificationIdentityAction();
      const profileId = (identity.data as { profile_id?: string } | undefined)?.profile_id;
      if (!identity.success || !profileId || cancelled) return;

      channel = supabase
        .channel(`notifications:${profileId}:${crypto.randomUUID()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_profile_id=eq.${profileId}`,
          },
          () => {
            void callbackRef.current();
          },
        );

      channel.subscribe();
    }

    void subscribe();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);
}

