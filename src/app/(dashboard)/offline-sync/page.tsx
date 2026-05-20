import { requireRole } from '@/lib/auth/helpers';
import { PageHeader, Badge } from '@/components/ui';
import AssistantPageContextBridge from '@/components/assistant/AssistantPageContextBridge';
import { getOfflineSyncServerSummary, listOfflineSyncEvents } from '@/services/offline-sync.service';
import SyncReviewCenterClient from './SyncReviewCenterClient';

export const dynamic = 'force-dynamic';

export default async function SyncReviewCenterPage() {
  const profile = await requireRole(['admin', 'bme_head']);
  const [summary, events] = await Promise.all([
    getOfflineSyncServerSummary(),
    listOfflineSyncEvents({ limit: 250 }),
  ]);

  const isDeveloper = profile.roleNames.includes('developer');
  const pendingCount = summary.reportedStatusCounts.find((row) => row.status === 'pending' || row.status === 'queued')?.count ?? 0;
  const failedCount = summary.recentFailedEvents.length;
  const conflictCount = summary.inferredConflictEvents.length;
  const syncedCount = summary.reportedStatusCounts.find((row) => row.status === 'synced')?.count ?? 0;
  const lastSuccessfulSyncAt = summary.recentEvents.find((row) => row.synced_at)?.synced_at ?? null;

  return (
    <div className="space-y-6">
      <AssistantPageContextBridge
        moduleLabel="Offline Sync"
        pageLabel="Sync Review Center"
        offlineStatus="unknown"
        queueStatus={{
          queued: pendingCount,
          failed: failedCount,
          conflict: conflictCount,
          lastSyncedAt: lastSuccessfulSyncAt,
        }}
        pageSummary="Offline sync review page for queued actions, failed syncs, conflicts, stale cached data, and retry or discard evidence."
        visibleCounts={{
          serverEvents: events.length,
          pending: pendingCount,
          failed: failedCount,
          conflicts: conflictCount,
          synced: syncedCount,
        }}
        availableEvidenceLinks={[{ label: 'Offline Sync', href: '/offline-sync', type: 'offline' }]}
        quickPrompts={['Show failed offline sync conflicts.', 'Explain these conflicts.', 'Identify failed sync causes.']}
      />
      <PageHeader
        title="Sync Review Center"
        description="Review, retry, and resolve offline actions that need attention across this hospital's BMEDIS devices."
        actions={<Badge variant="purple">{isDeveloper ? 'Developer' : 'BME Head / Admin'}</Badge>}
      />
      <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
        Sync Review Center is restricted to BME Head, Admin, and Developer roles. Local queue rows shown below are
        scoped to this device only. Server sync events are visible across users. No raw payload editing is
        permitted; resolve a draft by retrying after server-side issues are fixed, or by discarding the local
        action.
      </p>
      <p className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 text-xs text-[var(--text-muted)]">
        <strong className="text-[var(--foreground)]">How offline sync works:</strong> BMEDIS uses a foreground
        IndexedDB queue with replay-on-reconnect. The queue runs when this device reconnects to the network AND
        the BMEDIS app is open in a tab. There is no Background Sync API integration, no server-side queue,
        and no browser push notifications — closing the app or losing power while offline preserves the queue
        but no sync happens until the app is reopened with network access.
      </p>
      <SyncReviewCenterClient
        serverSummary={summary}
        serverEvents={events}
        isDeveloper={isDeveloper}
        currentProfileId={profile.id}
      />
    </div>
  );
}
