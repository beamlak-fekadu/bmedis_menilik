// Notification delivery service.
//
// Handles external delivery (Telegram + Telegram monitor copy) and writes a
// notification_deliveries row for every attempt. The in-app notification is
// already created by the engine before delivery is attempted; failures here
// never block the in-app record.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  formatTelegramMonitorMessage,
  formatTelegramNotification,
  getTelegramMonitorChatId,
  isTelegramConfigured,
  isTelegramMonitorConfigured,
  sendTelegramMessage,
} from './telegram-provider';
import type { NotificationRow, RecipientProfile } from '@/types/notifications';
import { getProfileById } from './recipient-resolver';

type DbClient = SupabaseClient;

const TELEGRAM_MIN_PRIORITY = (process.env.TELEGRAM_MIN_PRIORITY ?? 'high').toLowerCase();

const PRIORITY_LEVELS: Record<string, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function meetsMinPriority(priority: string): boolean {
  const level = PRIORITY_LEVELS[priority] ?? 0;
  const min = PRIORITY_LEVELS[TELEGRAM_MIN_PRIORITY] ?? 3;
  return level >= min;
}

const ALWAYS_ELIGIBLE_CATEGORIES = new Set(['critical']);
const ALWAYS_ELIGIBLE_SOURCES = new Set<string>([
  'work_order.assigned',
  'work_order.stock_blocked',
  'offline_sync.conflict',
  'spare_part.stockout',
  'qr.label_needs_replacement',
  'qr.revoked_scanned',
  'system.test_notification',
  'notification.rule_failed',
]);

export function isTelegramEligible(notification: NotificationRow): boolean {
  if (notification.status === 'dismissed' || notification.status === 'reviewed') {
    return false;
  }
  if (notification.priority === 'critical' || notification.priority === 'high') return true;
  if (ALWAYS_ELIGIBLE_CATEGORIES.has(notification.category)) return true;
  if (notification.source_type && ALWAYS_ELIGIBLE_SOURCES.has(notification.source_type)) {
    return true;
  }
  if ((process.env.TELEGRAM_SEND_LOW_PRIORITY ?? 'false').toLowerCase() === 'true') {
    return true;
  }
  return meetsMinPriority(notification.priority);
}

async function insertDeliveryLog(
  client: DbClient,
  row: {
    notification_id: string;
    channel: 'telegram' | 'telegram_monitor';
    recipient_profile_id?: string | null;
    recipient_role?: string | null;
    delivery_target?: string | null;
    status: 'pending' | 'sent' | 'skipped' | 'failed';
    skip_reason?: string | null;
    error_message?: string | null;
    provider_message_id?: string | null;
    attempt_count?: number;
    sent_at?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const payload = {
    notification_id: row.notification_id,
    channel: row.channel,
    recipient_profile_id: row.recipient_profile_id ?? null,
    recipient_role: row.recipient_role ?? null,
    delivery_target: row.delivery_target ?? null,
    status: row.status,
    skip_reason: row.skip_reason ?? null,
    error_message: row.error_message ?? null,
    provider_message_id: row.provider_message_id ?? null,
    attempt_count: row.attempt_count ?? 1,
    sent_at: row.sent_at ?? null,
    metadata: row.metadata ?? {},
  };
  const { error } = await client.from('notification_deliveries').insert(payload as never);
  if (error) {
    console.error('[notifications] failed to write delivery log:', error.message);
  }
}

export interface DeliverResult {
  telegram?: {
    status: 'sent' | 'skipped' | 'failed';
    skipReason?: string;
    error?: string;
    providerMessageId?: string | null;
  };
  monitor?: {
    status: 'sent' | 'skipped' | 'failed';
    skipReason?: string;
    error?: string;
    providerMessageId?: string | null;
  };
}

export async function deliverTelegramIfEligible(
  client: DbClient,
  notification: NotificationRow,
  recipient?: RecipientProfile | null,
): Promise<DeliverResult> {
  const result: DeliverResult = {};

  if (!isTelegramConfigured()) {
    // We still want to record a skip + monitor attempt so diagnostics show
    // something happened.
    await insertDeliveryLog(client, {
      notification_id: notification.id,
      channel: 'telegram',
      recipient_profile_id: notification.recipient_profile_id,
      recipient_role: notification.recipient_role,
      status: 'skipped',
      skip_reason: 'telegram_disabled_or_missing_token',
    });
    result.telegram = { status: 'skipped', skipReason: 'telegram_disabled_or_missing_token' };
    return result;
  }

  if (!isTelegramEligible(notification)) {
    await insertDeliveryLog(client, {
      notification_id: notification.id,
      channel: 'telegram',
      recipient_profile_id: notification.recipient_profile_id,
      recipient_role: notification.recipient_role,
      status: 'skipped',
      skip_reason: 'not_eligible_priority_or_category',
    });
    result.telegram = { status: 'skipped', skipReason: 'not_eligible_priority_or_category' };
    return result;
  }

  let recipientProfile = recipient ?? null;
  if (!recipientProfile) {
    recipientProfile = await getProfileById(client, notification.recipient_profile_id);
  }

  // Look up an enabled chat-id for the recipient.
  const { data: connection } = (await client
    .from('telegram_connections')
    .select('telegram_chat_id, is_enabled')
    .eq('profile_id', notification.recipient_profile_id)
    .eq('is_enabled', true)
    .maybeSingle()) as {
    data: { telegram_chat_id: string | null; is_enabled: boolean } | null;
  };

  let actual: { status: 'sent' | 'skipped' | 'failed'; skipReason?: string | null; error?: string | null; providerMessageId?: string | null } = {
    status: 'skipped',
    skipReason: 'no_chat_id',
  };

  if (connection?.telegram_chat_id) {
    const text = formatTelegramNotification(notification, recipientProfile);
    const sendResult = await sendTelegramMessage(connection.telegram_chat_id, text);
    if (sendResult.ok) {
      actual = {
        status: 'sent',
        providerMessageId: sendResult.providerMessageId ?? null,
      };
      await insertDeliveryLog(client, {
        notification_id: notification.id,
        channel: 'telegram',
        recipient_profile_id: notification.recipient_profile_id,
        recipient_role: notification.recipient_role,
        delivery_target: connection.telegram_chat_id,
        status: 'sent',
        provider_message_id: sendResult.providerMessageId ?? null,
        sent_at: new Date().toISOString(),
        metadata: { masked_chat_id: maskChatId(connection.telegram_chat_id) },
      });
    } else if (sendResult.status === 'skipped') {
      actual = { status: 'skipped', skipReason: sendResult.skipReason ?? 'skipped' };
      await insertDeliveryLog(client, {
        notification_id: notification.id,
        channel: 'telegram',
        recipient_profile_id: notification.recipient_profile_id,
        recipient_role: notification.recipient_role,
        delivery_target: connection.telegram_chat_id,
        status: 'skipped',
        skip_reason: sendResult.skipReason ?? 'skipped',
      });
    } else {
      actual = {
        status: 'failed',
        error: sendResult.error ?? 'send_failed',
      };
      await insertDeliveryLog(client, {
        notification_id: notification.id,
        channel: 'telegram',
        recipient_profile_id: notification.recipient_profile_id,
        recipient_role: notification.recipient_role,
        delivery_target: connection.telegram_chat_id,
        status: 'failed',
        error_message: sendResult.error ?? 'send_failed',
      });
    }
  } else {
    await insertDeliveryLog(client, {
      notification_id: notification.id,
      channel: 'telegram',
      recipient_profile_id: notification.recipient_profile_id,
      recipient_role: notification.recipient_role,
      status: 'skipped',
      skip_reason: 'no_chat_id',
    });
  }

  result.telegram = {
    status: actual.status,
    skipReason: actual.skipReason ?? undefined,
    error: actual.error ?? undefined,
    providerMessageId: actual.providerMessageId ?? undefined,
  };

  // Developer monitor copy — fires regardless of actual recipient success so
  // developer can verify role-aware notifications without each role having a
  // Telegram account connected.
  if (isTelegramMonitorConfigured()) {
    const monitorChatId = getTelegramMonitorChatId();
    if (monitorChatId) {
      const monitorText = formatTelegramMonitorMessage(
        notification,
        recipientProfile,
        {
          status: actual.status,
          skipReason: actual.skipReason ?? null,
          error: actual.error ?? null,
        },
      );
      const sendResult = await sendTelegramMessage(monitorChatId, monitorText);
      if (sendResult.ok) {
        await insertDeliveryLog(client, {
          notification_id: notification.id,
          channel: 'telegram_monitor',
          recipient_profile_id: notification.recipient_profile_id,
          recipient_role: notification.recipient_role,
          delivery_target: monitorChatId,
          status: 'sent',
          provider_message_id: sendResult.providerMessageId ?? null,
          sent_at: new Date().toISOString(),
          metadata: {
            masked_chat_id: maskChatId(monitorChatId),
            actual_delivery_status: actual.status,
          },
        });
        result.monitor = { status: 'sent', providerMessageId: sendResult.providerMessageId ?? null };
      } else if (sendResult.status === 'skipped') {
        await insertDeliveryLog(client, {
          notification_id: notification.id,
          channel: 'telegram_monitor',
          recipient_profile_id: notification.recipient_profile_id,
          recipient_role: notification.recipient_role,
          delivery_target: monitorChatId,
          status: 'skipped',
          skip_reason: sendResult.skipReason ?? 'skipped',
        });
        result.monitor = { status: 'skipped', skipReason: sendResult.skipReason ?? 'skipped' };
      } else {
        await insertDeliveryLog(client, {
          notification_id: notification.id,
          channel: 'telegram_monitor',
          recipient_profile_id: notification.recipient_profile_id,
          recipient_role: notification.recipient_role,
          delivery_target: monitorChatId,
          status: 'failed',
          error_message: sendResult.error ?? 'monitor_send_failed',
        });
        result.monitor = { status: 'failed', error: sendResult.error ?? 'monitor_send_failed' };
      }
    }
  }

  return result;
}

function maskChatId(chatId: string | null | undefined): string | null {
  if (!chatId) return null;
  const t = String(chatId).trim();
  if (t.length === 0) return null;
  if (t.length <= 4) return '••' + t.slice(-2);
  return '••' + t.slice(-4);
}
