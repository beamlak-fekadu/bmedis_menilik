// Notification read/update service. All callers go through server actions;
// this file provides the actual database operations on behalf of the
// authenticated user.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type {
  NotificationCategory,
  NotificationDiagnostics,
  NotificationDeliveryRow,
  NotificationEventRow,
  NotificationPriority,
  NotificationRow,
  NotificationRuleLogRow,
  NotificationStatus,
  NotificationSummary,
} from '@/types/notifications';
import {
  getTelegramMonitorChatId,
  isTelegramConfigured,
  isTelegramMonitorConfigured,
  maskTelegramChatId,
} from './telegram-provider';

type DbClient = SupabaseClient;

async function db(): Promise<DbClient> {
  return await createClient();
}

export interface NotificationFilters {
  status?: NotificationStatus | 'any';
  priority?: NotificationPriority;
  category?: NotificationCategory;
  search?: string;
  since?: string;
  limit?: number;
}

async function getCallerProfileId(client: DbClient): Promise<string | null> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const { data } = (await client
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()) as { data: { id: string } | null };
  return data?.id ?? null;
}

export async function getMyNotifications(
  filters: NotificationFilters = {},
): Promise<NotificationRow[]> {
  const client = await db();
  const profileId = await getCallerProfileId(client);
  if (!profileId) return [];
  let query = client
    .from('notifications')
    .select('*')
    .eq('recipient_profile_id', profileId)
    .order('created_at', { ascending: false });

  if (filters.status && filters.status !== 'any') {
    query = query.eq('status', filters.status);
  }
  if (filters.priority) query = query.eq('priority', filters.priority);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.since) query = query.gte('created_at', filters.since);
  if (filters.search) {
    const escaped = filters.search.replace(/[%_]/g, ' ');
    query = query.or(`title.ilike.%${escaped}%,message.ilike.%${escaped}%`);
  }
  query = query.limit(filters.limit ?? 200);
  const { data, error } = (await query) as { data: NotificationRow[] | null; error: unknown };
  if (error) {
    console.error('[notifications] read error:', error);
    return [];
  }
  return data ?? [];
}

export async function getMyNotificationSummary(): Promise<NotificationSummary> {
  const client = await db();
  const profileId = await getCallerProfileId(client);
  if (!profileId) {
    return {
      unread_total: 0,
      unread_critical: 0,
      unread_by_category: {},
      latest_unread_at: null,
    };
  }
  const { data } = (await client
    .from('notifications')
    .select('priority, category, created_at, status')
    .eq('recipient_profile_id', profileId)
    .eq('status', 'unread')
    .order('created_at', { ascending: false })
    .limit(500)) as {
    data: Array<{
      priority: NotificationPriority;
      category: NotificationCategory;
      created_at: string;
      status: NotificationStatus;
    }> | null;
  };
  const rows = data ?? [];
  const byCategory: Partial<Record<NotificationCategory, number>> = {};
  let critical = 0;
  for (const r of rows) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    if (r.priority === 'critical') critical++;
  }
  return {
    unread_total: rows.length,
    unread_critical: critical,
    unread_by_category: byCategory,
    latest_unread_at: rows[0]?.created_at ?? null,
  };
}

export async function markNotificationStatus(
  notificationId: string,
  next: NotificationStatus,
): Promise<{ ok: boolean; error?: string }> {
  if (!notificationId) return { ok: false, error: 'notification_id_required' };
  const client = await db();
  const profileId = await getCallerProfileId(client);
  if (!profileId) return { ok: false, error: 'not_authenticated' };
  const updateData: Record<string, unknown> = { status: next };
  if (next === 'read') updateData.read_at = new Date().toISOString();
  if (next === 'reviewed') updateData.reviewed_at = new Date().toISOString();
  if (next === 'dismissed') updateData.dismissed_at = new Date().toISOString();
  const { error } = await client
    .from('notifications')
    .update(updateData as never)
    .eq('id', notificationId)
    .eq('recipient_profile_id', profileId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markAllMyNotificationsRead(): Promise<{ ok: boolean; updated: number; error?: string }> {
  const client = await db();
  const profileId = await getCallerProfileId(client);
  if (!profileId) return { ok: false, updated: 0, error: 'not_authenticated' };
  const { data, error } = await client
    .from('notifications')
    .update({ status: 'read', read_at: new Date().toISOString() } as never)
    .eq('recipient_profile_id', profileId)
    .eq('status', 'unread')
    .select('id');
  if (error) return { ok: false, updated: 0, error: error.message };
  return { ok: true, updated: (data?.length as number | undefined) ?? 0 };
}

export async function getNotificationDiagnostics(): Promise<NotificationDiagnostics> {
  const client = await db();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  const [
    eventsTodayRes,
    eventsFailedTodayRes,
    eventsPendingRes,
    notificationsTodayRes,
    notificationsUnreadRes,
    notificationsCriticalRes,
    ruleFailuresTodayRes,
    deliveriesTodayRes,
    deliveriesSentRes,
    deliveriesSkippedRes,
    deliveriesFailedRes,
    monitorDeliveriesRes,
  ] = await Promise.all([
    client.from('notification_events').select('id', { count: 'exact', head: true }).gte('created_at', todayIso),
    client.from('notification_events').select('id', { count: 'exact', head: true }).eq('processing_status', 'failed').gte('created_at', todayIso),
    client.from('notification_events').select('id', { count: 'exact', head: true }).eq('processing_status', 'pending'),
    client.from('notifications').select('id', { count: 'exact', head: true }).gte('created_at', todayIso),
    client.from('notifications').select('id', { count: 'exact', head: true }).eq('status', 'unread'),
    client.from('notifications').select('id', { count: 'exact', head: true }).eq('status', 'unread').eq('priority', 'critical'),
    client.from('notification_rule_logs').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', todayIso),
    client.from('notification_deliveries').select('id', { count: 'exact', head: true }).gte('created_at', todayIso),
    client.from('notification_deliveries').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('created_at', todayIso),
    client.from('notification_deliveries').select('id', { count: 'exact', head: true }).eq('status', 'skipped').gte('created_at', todayIso),
    client.from('notification_deliveries').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', todayIso),
    client.from('notification_deliveries').select('id', { count: 'exact', head: true }).eq('channel', 'telegram_monitor').gte('created_at', todayIso),
  ]);

  const [recentEventsRes, recentRuleFailuresRes, recentDeliveriesRes] = await Promise.all([
    client.from('notification_events').select('*').order('created_at', { ascending: false }).limit(10),
    client.from('notification_rule_logs').select('*').eq('status', 'failed').order('created_at', { ascending: false }).limit(10),
    client.from('notification_deliveries').select('*').order('created_at', { ascending: false }).limit(20),
  ]);

  return {
    events_today: eventsTodayRes.count ?? 0,
    events_failed_today: eventsFailedTodayRes.count ?? 0,
    events_pending: eventsPendingRes.count ?? 0,
    notifications_today: notificationsTodayRes.count ?? 0,
    notifications_unread_total: notificationsUnreadRes.count ?? 0,
    notifications_unread_critical: notificationsCriticalRes.count ?? 0,
    rule_failures_today: ruleFailuresTodayRes.count ?? 0,
    deliveries_today: deliveriesTodayRes.count ?? 0,
    deliveries_sent_today: deliveriesSentRes.count ?? 0,
    deliveries_skipped_today: deliveriesSkippedRes.count ?? 0,
    deliveries_failed_today: deliveriesFailedRes.count ?? 0,
    monitor_deliveries_today: monitorDeliveriesRes.count ?? 0,
    telegram_enabled: isTelegramConfigured(),
    telegram_bot_token_present: (process.env.TELEGRAM_BOT_TOKEN ?? '').trim().length > 0,
    telegram_monitor_enabled: isTelegramMonitorConfigured(),
    telegram_monitor_chat_id_present: !!getTelegramMonitorChatId(),
    telegram_monitor_chat_id_masked: maskTelegramChatId(getTelegramMonitorChatId() ?? null),
    recent_events: (recentEventsRes.data as NotificationEventRow[]) ?? [],
    recent_rule_failures: (recentRuleFailuresRes.data as NotificationRuleLogRow[]) ?? [],
    recent_deliveries: (recentDeliveriesRes.data as NotificationDeliveryRow[]) ?? [],
  };
}

export interface ListDeliveriesFilters {
  channel?: 'telegram' | 'telegram_monitor';
  status?: 'sent' | 'skipped' | 'failed';
  limit?: number;
}

export async function listNotificationDeliveries(
  filters: ListDeliveriesFilters = {},
): Promise<NotificationDeliveryRow[]> {
  const client = await db();
  let q = client.from('notification_deliveries').select('*').order('created_at', { ascending: false });
  if (filters.channel) q = q.eq('channel', filters.channel);
  if (filters.status) q = q.eq('status', filters.status);
  q = q.limit(filters.limit ?? 100);
  const { data, error } = (await q) as { data: NotificationDeliveryRow[] | null; error: unknown };
  if (error) {
    console.error('[notifications] deliveries read error:', error);
    return [];
  }
  return data ?? [];
}

export async function listNotificationRuleLogs(
  options: { limit?: number; statusFilter?: 'matched' | 'skipped' | 'failed' } = {},
): Promise<NotificationRuleLogRow[]> {
  const client = await db();
  let q = client.from('notification_rule_logs').select('*').order('created_at', { ascending: false });
  if (options.statusFilter) q = q.eq('status', options.statusFilter);
  q = q.limit(options.limit ?? 100);
  const { data, error } = (await q) as { data: NotificationRuleLogRow[] | null; error: unknown };
  if (error) {
    console.error('[notifications] rule logs read error:', error);
    return [];
  }
  return data ?? [];
}

// Best-effort scheduled-condition scan. Looks for currently overdue PM,
// stockouts, etc., and creates events for them. Cooldown + dedupe keep the
// noise level acceptable when the developer reruns the check.
export async function runNotificationRuleCheck(): Promise<{
  ok: boolean;
  events_created: number;
  errors: string[];
}> {
  const client = await db();
  const errors: string[] = [];
  let eventsCreated = 0;

  const { emitNotificationEvent } = await import('./notification-engine');

  // Overdue PM
  try {
    const { data: overduePm } = (await client
      .from('v_overdue_pm')
      .select('schedule_id, asset_id, department_id, days_overdue')
      .limit(50)) as {
      data: Array<{
        schedule_id: string | null;
        asset_id: string | null;
        department_id: string | null;
        days_overdue: number | null;
      }> | null;
    };
    for (const row of overduePm ?? []) {
      if (!row.schedule_id || !row.asset_id) continue;
      await emitNotificationEvent({
        event_type: 'pm.overdue',
        source_table: 'pm_schedules',
        source_id: row.schedule_id,
        asset_id: row.asset_id,
        department_id: row.department_id ?? null,
        priority: 'high',
        payload: { days_overdue: row.days_overdue ?? 0 },
      });
      eventsCreated++;
    }
  } catch (err) {
    errors.push(`pm_overdue: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  // Stockouts
  try {
    const { data: parts } = (await client
      .from('spare_parts')
      .select('id, name, current_stock, minimum_stock_level, is_active')
      .eq('is_active', true)
      .limit(500)) as {
      data: Array<{
        id: string;
        name: string;
        current_stock: number | null;
        minimum_stock_level: number | null;
        is_active: boolean | null;
      }> | null;
    };
    for (const part of parts ?? []) {
      const onHand = part.current_stock ?? 0;
      const min = part.minimum_stock_level ?? 0;
      if (onHand <= 0) {
        await emitNotificationEvent({
          event_type: 'spare_part.stockout',
          source_table: 'spare_parts',
          source_id: part.id,
          priority: 'high',
          payload: { part_id: part.id, part_name: part.name, on_hand: onHand },
        });
        eventsCreated++;
      } else if (min > 0 && onHand <= min) {
        await emitNotificationEvent({
          event_type: 'spare_part.low_stock',
          source_table: 'spare_parts',
          source_id: part.id,
          priority: 'medium',
          payload: {
            part_id: part.id,
            part_name: part.name,
            on_hand: onHand,
            minimum_level: min,
          },
        });
        eventsCreated++;
      }
    }
  } catch (err) {
    errors.push(`spare_parts: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  // Aging work orders (>14d open)
  try {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: aging } = (await client
      .from('v_open_work_orders')
      .select('work_order_id, asset_id, department_id, created_at, status, work_order_number, asset_name, asset_code')
      .lt('created_at', cutoff)
      .limit(50)) as {
      data: Array<{
        work_order_id: string;
        asset_id: string | null;
        department_id: string | null;
        created_at: string;
        status: string;
        work_order_number: string | null;
        asset_name: string | null;
        asset_code: string | null;
      }> | null;
    };
    for (const wo of aging ?? []) {
      await emitNotificationEvent({
        event_type: 'work_order.aging_or_overdue',
        source_table: 'work_orders',
        source_id: wo.work_order_id,
        asset_id: wo.asset_id ?? null,
        department_id: wo.department_id ?? null,
        priority: 'high',
        payload: {
          work_order_number: wo.work_order_number,
          asset_name: wo.asset_name,
          asset_code: wo.asset_code,
          status: wo.status,
        },
      });
      eventsCreated++;
    }
  } catch (err) {
    errors.push(`aging_wo: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  return { ok: errors.length === 0, events_created: eventsCreated, errors };
}
