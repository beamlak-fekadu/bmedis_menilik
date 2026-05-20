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
export interface RuleScanResult {
  ruleId: 'pm_overdue' | 'aging_work_orders' | 'low_stock' | 'calibration_overdue';
  scanned: number;
  eventsCreated: number;
  error: string | null;
}

export interface RuleCheckOutcome {
  ok: boolean;
  events_created: number;
  errors: string[];
  // R1: per-scan diagnostics. Developer Lab renders this directly — a
  // single aggregate "success" hid sub-scan failures before. With this
  // shape, an overdue-PM scan that errors does not get masked by a healthy
  // stock scan.
  scans: RuleScanResult[];
}

export async function runNotificationRuleCheck(): Promise<RuleCheckOutcome> {
  const client = await db();
  const errors: string[] = [];
  const scans: RuleScanResult[] = [];

  const { emitNotificationEvent } = await import('./notification-engine');

  // ---- Overdue PM (R1 + R20) ----
  // View column was renamed from `schedule_id` → `id` in migration 00044.
  // The scanner used to select `schedule_id` and silently emit zero events.
  {
    const scan: RuleScanResult = { ruleId: 'pm_overdue', scanned: 0, eventsCreated: 0, error: null };
    try {
      const { data: overduePm, error: pmErr } = (await client
        .from('v_overdue_pm')
        .select('id, asset_id, department_id, days_overdue')
        .limit(50)) as {
        data: Array<{
          id: string | null;
          asset_id: string | null;
          department_id: string | null;
          days_overdue: number | null;
        }> | null;
        error: { message: string } | null;
      };
      if (pmErr) throw new Error(pmErr.message);
      scan.scanned = overduePm?.length ?? 0;
      for (const row of overduePm ?? []) {
        if (!row.id || !row.asset_id) continue;
        await emitNotificationEvent({
          event_type: 'pm.overdue',
          source_table: 'pm_schedules',
          source_id: row.id,
          asset_id: row.asset_id,
          department_id: row.department_id ?? null,
          priority: 'high',
          payload: { days_overdue: row.days_overdue ?? 0 },
        });
        scan.eventsCreated++;
      }
    } catch (err) {
      scan.error = err instanceof Error ? err.message : 'unknown';
      errors.push(`pm_overdue: ${scan.error}`);
    }
    scans.push(scan);
  }

  // ---- Low-stock / stockout (R1 + R9 fallback) ----
  // spare_parts uses `reorder_level`, not `minimum_stock_level`. R9's
  // direct emission from the stock_issue RPC is the primary path; this
  // scan exists as a backstop (e.g. for stock that drifted via direct
  // DB writes outside the action layer).
  {
    const scan: RuleScanResult = { ruleId: 'low_stock', scanned: 0, eventsCreated: 0, error: null };
    try {
      const { data: parts, error: partsErr } = (await client
        .from('spare_parts')
        .select('id, name, current_stock, reorder_level, is_active')
        .eq('is_active', true)
        .limit(500)) as {
        data: Array<{
          id: string;
          name: string;
          current_stock: number | null;
          reorder_level: number | null;
          is_active: boolean | null;
        }> | null;
        error: { message: string } | null;
      };
      if (partsErr) throw new Error(partsErr.message);
      scan.scanned = parts?.length ?? 0;
      for (const part of parts ?? []) {
        const onHand = part.current_stock ?? 0;
        const reorder = part.reorder_level ?? 0;
        if (onHand <= 0) {
          await emitNotificationEvent({
            event_type: 'spare_part.stockout',
            source_table: 'spare_parts',
            source_id: part.id,
            priority: 'high',
            payload: { part_id: part.id, part_name: part.name, on_hand: onHand, reorder_level: reorder },
          });
          scan.eventsCreated++;
        } else if (reorder > 0 && onHand <= reorder) {
          await emitNotificationEvent({
            event_type: 'spare_part.low_stock',
            source_table: 'spare_parts',
            source_id: part.id,
            priority: 'medium',
            payload: { part_id: part.id, part_name: part.name, on_hand: onHand, reorder_level: reorder },
          });
          scan.eventsCreated++;
        }
      }
    } catch (err) {
      scan.error = err instanceof Error ? err.message : 'unknown';
      errors.push(`low_stock: ${scan.error}`);
    }
    scans.push(scan);
  }

  // ---- Aging work orders (>14d open) (R1) ----
  // View column was renamed from `work_order_id` → `id` in migration 00044.
  {
    const scan: RuleScanResult = { ruleId: 'aging_work_orders', scanned: 0, eventsCreated: 0, error: null };
    try {
      const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data: aging, error: agingErr } = (await client
        .from('v_open_work_orders')
        .select('id, asset_id, department_id, created_at, status, work_order_number, asset_name, asset_code')
        .lt('created_at', cutoff)
        .limit(50)) as {
        data: Array<{
          id: string;
          asset_id: string | null;
          department_id: string | null;
          created_at: string;
          status: string;
          work_order_number: string | null;
          asset_name: string | null;
          asset_code: string | null;
        }> | null;
        error: { message: string } | null;
      };
      if (agingErr) throw new Error(agingErr.message);
      scan.scanned = aging?.length ?? 0;
      for (const wo of aging ?? []) {
        await emitNotificationEvent({
          event_type: 'work_order.aging_or_overdue',
          source_table: 'work_orders',
          source_id: wo.id,
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
        scan.eventsCreated++;
      }
    } catch (err) {
      scan.error = err instanceof Error ? err.message : 'unknown';
      errors.push(`aging_work_orders: ${scan.error}`);
    }
    scans.push(scan);
  }

  // ---- Overdue calibration (R1) ----
  // New scan — was missing from the previous implementation. Uses
  // v_calibration_due (exposes asset_id via migration 00043) and the
  // canonical `result` column (not `last_result`).
  {
    const scan: RuleScanResult = { ruleId: 'calibration_overdue', scanned: 0, eventsCreated: 0, error: null };
    try {
      const { data: due, error: dueErr } = (await client
        .from('v_calibration_due')
        .select('id, asset_id, next_due_date, result, asset_name, asset_code, days_until_due')
        .lt('days_until_due', 0)
        .limit(50)) as {
        data: Array<{
          id: string;
          asset_id: string | null;
          next_due_date: string | null;
          result: string | null;
          asset_name: string | null;
          asset_code: string | null;
          days_until_due: number | null;
        }> | null;
        error: { message: string } | null;
      };
      if (dueErr) throw new Error(dueErr.message);
      scan.scanned = due?.length ?? 0;
      for (const cal of due ?? []) {
        if (!cal.asset_id) continue;
        await emitNotificationEvent({
          event_type: 'calibration.overdue',
          source_table: 'calibration_records',
          source_id: cal.id,
          asset_id: cal.asset_id,
          priority: 'high',
          payload: {
            next_due_date: cal.next_due_date,
            last_result: cal.result,
            asset_name: cal.asset_name,
            asset_code: cal.asset_code,
            days_overdue: cal.days_until_due != null ? Math.abs(cal.days_until_due) : null,
          },
        });
        scan.eventsCreated++;
      }
    } catch (err) {
      scan.error = err instanceof Error ? err.message : 'unknown';
      errors.push(`calibration_overdue: ${scan.error}`);
    }
    scans.push(scan);
  }

  const eventsCreated = scans.reduce((acc, s) => acc + s.eventsCreated, 0);
  return { ok: errors.length === 0, events_created: eventsCreated, errors, scans };
}
