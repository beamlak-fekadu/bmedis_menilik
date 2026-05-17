// Notification dedupe / noise control.
//
// Dedupe key:
//   recipient_profile_id + event_type + source_type + source_id (best effort)
//
// If an unread notification with the same dedupe_key was created within the
// cooldown window, we update the existing row (message, metadata, count,
// created_at) instead of inserting a new one. Telegram delivery is suppressed
// when this happens unless the priority increased to critical.

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateNotificationInput,
  NotificationPriority,
  NotificationRow,
} from '@/types/notifications';

type DbClient = SupabaseClient;

export const DEFAULT_NOTIFICATION_COOLDOWN_MINUTES = 10;

export interface DedupeResult {
  matched: boolean;
  existing?: NotificationRow;
  updated?: NotificationRow;
  shouldSuppressTelegram?: boolean;
}

export function computeDedupeKey(input: {
  recipient_profile_id: string;
  source_type?: string | null;
  source_id?: string | null;
  event_type?: string | null;
}): string {
  const parts = [
    input.recipient_profile_id,
    input.event_type ?? '_',
    input.source_type ?? '_',
    input.source_id ?? '_',
  ];
  return parts.join(':');
}

const PRIORITY_ORDER: NotificationPriority[] = ['info', 'low', 'medium', 'high', 'critical'];

function priorityRank(p: NotificationPriority | null | undefined): number {
  if (!p) return -1;
  return PRIORITY_ORDER.indexOf(p);
}

export async function applyDedupe(
  client: DbClient,
  input: CreateNotificationInput,
  options?: { cooldownMinutes?: number },
): Promise<DedupeResult> {
  if (!input.dedupe_key) return { matched: false };
  const cooldownMinutes = options?.cooldownMinutes ?? DEFAULT_NOTIFICATION_COOLDOWN_MINUTES;
  const since = new Date(Date.now() - cooldownMinutes * 60_000).toISOString();

  const { data: existingRows, error } = (await client
    .from('notifications')
    .select('*')
    .eq('recipient_profile_id', input.recipient_profile_id)
    .eq('dedupe_key', input.dedupe_key)
    .in('status', ['unread', 'read'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)) as { data: NotificationRow[] | null; error: unknown };
  if (error || !existingRows || existingRows.length === 0) return { matched: false };

  const existing = existingRows[0];
  const incomingRank = priorityRank(input.priority);
  const existingRank = priorityRank(existing.priority);
  const newPriority: NotificationPriority =
    incomingRank > existingRank ? input.priority : existing.priority;

  const oldCount =
    typeof existing.metadata?.count === 'number' ? (existing.metadata.count as number) : 1;
  const newCount = oldCount + 1;

  const mergedMetadata = {
    ...(existing.metadata ?? {}),
    ...(input.metadata ?? {}),
    count: newCount,
    last_event_at: new Date().toISOString(),
  };

  const updatePayload: Record<string, unknown> = {
    message: input.message,
    priority: newPriority,
    metadata: mergedMetadata,
    // Re-surface the notification to the top of the inbox.
    created_at: new Date().toISOString(),
    // If user had marked it read, demote back to unread so the bell counts.
    status: existing.status === 'read' ? 'unread' : existing.status,
    read_at: null,
  };

  const { data: updated } = (await client
    .from('notifications')
    .update(updatePayload as never)
    .eq('id', existing.id)
    .select('*')
    .single()) as { data: NotificationRow | null };

  const priorityIncreasedToCritical =
    newPriority === 'critical' && existing.priority !== 'critical';

  return {
    matched: true,
    existing,
    updated: updated ?? undefined,
    shouldSuppressTelegram: !priorityIncreasedToCritical,
  };
}
