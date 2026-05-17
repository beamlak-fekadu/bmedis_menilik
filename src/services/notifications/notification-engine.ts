// Notification engine — orchestrates event creation, rule processing,
// dedupe, insert, and external delivery. Designed so any failure here is
// surfaced via console.error + audit/diagnostics rather than thrown back to
// the caller. Primary workflows must continue if notifications break.

import type { SupabaseClient } from '@supabase/supabase-js';
import { applyNotificationRules } from './notification-rules';
import { applyDedupe } from './notification-dedupe';
import { deliverTelegramIfEligible } from './notification-delivery.service';
import type {
  CreateNotificationInput,
  NotificationEventInput,
  NotificationEventRow,
  NotificationRow,
} from '@/types/notifications';
import { createClient } from '@/lib/supabase/server';

type DbClient = SupabaseClient;

async function getClient(): Promise<DbClient> {
  return await createClient();
}

interface ProcessEventResult {
  event: NotificationEventRow | null;
  notifications: NotificationRow[];
  rule_status: 'matched' | 'skipped' | 'failed';
  rule_name?: string;
  error?: string;
}

export async function createNotificationEvent(
  input: NotificationEventInput,
  options?: { client?: DbClient; createdBy?: string | null; autoProcess?: boolean },
): Promise<ProcessEventResult> {
  const client = options?.client ?? (await getClient());
  const insertPayload = {
    event_type: input.event_type,
    source_table: input.source_table ?? null,
    source_id: input.source_id ?? null,
    asset_id: input.asset_id ?? null,
    department_id: input.department_id ?? null,
    priority: input.priority,
    payload: input.payload ?? {},
    dedupe_key: input.dedupe_key ?? null,
    processing_status: 'pending' as const,
    created_by: options?.createdBy ?? null,
  };
  const { data, error } = (await client
    .from('notification_events')
    .insert(insertPayload as never)
    .select('*')
    .single()) as { data: NotificationEventRow | null; error: { message?: string } | null };

  if (error || !data) {
    const message = error?.message ?? 'unknown_event_insert_error';
    console.error('[notifications] failed to insert event:', message);
    return {
      event: null,
      notifications: [],
      rule_status: 'failed',
      error: message,
    };
  }

  if (options?.autoProcess === false) {
    return { event: data, notifications: [], rule_status: 'skipped' };
  }
  return await processNotificationEvent(data, { client });
}

export async function processNotificationEvent(
  eventOrId: NotificationEventRow | string,
  options?: { client?: DbClient },
): Promise<ProcessEventResult> {
  const client = options?.client ?? (await getClient());
  let event: NotificationEventRow | null;
  if (typeof eventOrId === 'string') {
    const { data } = (await client
      .from('notification_events')
      .select('*')
      .eq('id', eventOrId)
      .maybeSingle()) as { data: NotificationEventRow | null };
    event = data;
  } else {
    event = eventOrId;
  }
  if (!event) {
    return {
      event: null,
      notifications: [],
      rule_status: 'failed',
      error: 'event_not_found',
    };
  }

  // Apply rules — role-aware fan-out.
  const ruleResult = await applyNotificationRules(client, event);

  // Log rule processing
  await logRule(client, {
    event_id: event.id,
    rule_name: ruleResult.rule_name,
    status: ruleResult.status,
    recipient_count: ruleResult.rows.length,
    error_message: ruleResult.error ?? null,
    metadata: {
      event_type: event.event_type,
      priority: event.priority,
    },
  });

  if (ruleResult.status === 'failed') {
    await client
      .from('notification_events')
      .update({
        processing_status: 'failed',
        processing_error: ruleResult.error ?? null,
        processed_at: new Date().toISOString(),
      } as never)
      .eq('id', event.id);
    return {
      event,
      notifications: [],
      rule_status: 'failed',
      rule_name: ruleResult.rule_name,
      error: ruleResult.error,
    };
  }

  // Insert each notification (with dedupe), then attempt delivery.
  const created: NotificationRow[] = [];
  for (const input of ruleResult.rows) {
    const inserted = await createNotificationForProfile(client, {
      ...input,
      event_id: event.id,
    });
    if (inserted) created.push(inserted);
  }

  // Mark event processed.
  await client
    .from('notification_events')
    .update({
      processing_status: ruleResult.status === 'matched' ? 'processed' : 'skipped',
      processed_at: new Date().toISOString(),
    } as never)
    .eq('id', event.id);

  return {
    event,
    notifications: created,
    rule_status: ruleResult.status,
    rule_name: ruleResult.rule_name,
  };
}

export async function createNotificationForProfile(
  client: DbClient,
  input: CreateNotificationInput,
): Promise<NotificationRow | null> {
  try {
    // Dedupe first.
    const dedupe = await applyDedupe(client, input);
    if (dedupe.matched) {
      const updated = dedupe.updated ?? dedupe.existing ?? null;
      if (updated && !dedupe.shouldSuppressTelegram) {
        try {
          await deliverTelegramIfEligible(client, updated);
        } catch (err) {
          console.error('[notifications] dedupe delivery error:', err);
        }
      }
      return updated;
    }
    const payload = {
      recipient_profile_id: input.recipient_profile_id,
      recipient_role: input.recipient_role ?? null,
      title: input.title,
      message: input.message,
      priority: input.priority,
      category: input.category,
      source_type: input.source_type ?? null,
      source_id: input.source_id ?? null,
      event_id: input.event_id ?? null,
      asset_id: input.asset_id ?? null,
      department_id: input.department_id ?? null,
      action_href: input.action_href ?? null,
      action_label: input.action_label ?? null,
      dedupe_key: input.dedupe_key ?? null,
      metadata: input.metadata ?? {},
    };
    const { data, error } = (await client
      .from('notifications')
      .insert(payload as never)
      .select('*')
      .single()) as { data: NotificationRow | null; error: { message?: string } | null };
    if (error || !data) {
      console.error('[notifications] failed to insert notification:', error?.message);
      return null;
    }
    try {
      await deliverTelegramIfEligible(client, data);
    } catch (err) {
      console.error('[notifications] delivery error:', err);
    }
    return data;
  } catch (err) {
    console.error('[notifications] create error:', err);
    return null;
  }
}

async function logRule(
  client: DbClient,
  row: {
    event_id: string | null;
    rule_name: string;
    status: 'matched' | 'skipped' | 'failed';
    recipient_count: number;
    error_message?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const payload = {
    event_id: row.event_id ?? null,
    rule_name: row.rule_name,
    status: row.status,
    recipient_count: row.recipient_count ?? 0,
    error_message: row.error_message ?? null,
    metadata: row.metadata ?? {},
  };
  const { error } = await client.from('notification_rule_logs').insert(payload as never);
  if (error) {
    console.error('[notifications] failed to log rule:', error.message);
  }
}

/**
 * Convenience wrapper: enqueue + process an event in one call, suppressing
 * exceptions so callers can fire-and-forget after their primary action.
 */
export async function emitNotificationEvent(input: NotificationEventInput): Promise<void> {
  try {
    await createNotificationEvent(input);
  } catch (err) {
    console.error('[notifications] emit error:', err);
  }
}
