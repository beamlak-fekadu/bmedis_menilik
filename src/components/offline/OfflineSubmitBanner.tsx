'use client';

import { Wifi, WifiOff, Ban } from 'lucide-react';
import { useOfflineSync } from './SyncEngineProvider';
import { useRole } from '@/hooks/useRole';
import { canQueueOfflineAction } from '@/lib/offline/offline-permissions';
import type { OfflineActionType } from '@/types/offline';

interface Props {
  actionLabel: string;
  // R12: when supplied, the banner becomes role-aware. If the current user's
  // role can't queue this action type offline (server replay would reject
  // it anyway), surface that up-front instead of letting the user submit
  // and discover the conflict at replay time.
  actionType?: OfflineActionType;
}

export default function OfflineSubmitBanner({ actionLabel, actionType }: Props) {
  const { isOnline, summary } = useOfflineSync();
  const { roles } = useRole();
  const roleCanQueue = actionType ? canQueueOfflineAction(roles, actionType) : true;
  const showOnlineOnlyWarning = !isOnline && actionType && !roleCanQueue;

  if (showOnlineOnlyWarning) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-800 dark:text-rose-200">
        <div className="flex items-start gap-2">
          <Ban className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Online-only for your role:</strong> {actionLabel} cannot be queued offline by users
            with your role. Reconnect to the network to submit, or ask BME Head / Admin to take this
            action.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-3 text-xs ${
      isOnline
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
    }`}>
      <div className="flex items-start gap-2">
        {isOnline ? <Wifi className="mt-0.5 h-4 w-4 shrink-0" /> : <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />}
        <p>
          {isOnline
            ? `${actionLabel} will submit online now. If the network drops during submit, it can be saved locally.`
            // R13: honest phrasing. "Foreground replay" means the queue
            // syncs when this device is online AND the app is open.
            // It is NOT a background-sync API integration.
            : `${actionLabel} will be saved offline and queued. The queue replays when this device reconnects with the app open.`}
          {summary.queued > 0 ? ` ${summary.queued} action${summary.queued === 1 ? '' : 's'} already pending on this device.` : ''}
        </p>
      </div>
    </div>
  );
}
