import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNotificationLink } from '@/services/notifications/notification-links';
import { computeDedupeKey } from '@/services/notifications/notification-dedupe';
import { isTelegramEligible } from '@/services/notifications/notification-delivery.service';
import {
  formatTelegramMonitorMessage,
  formatTelegramNotification,
  isTelegramConfigured,
  maskTelegramChatId,
} from '@/services/notifications/telegram-provider';
import type { NotificationRow } from '@/types/notifications';

function notif(partial: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    recipient_profile_id: 'p1',
    recipient_role: 'technician',
    title: 'Test title',
    message: 'Test message',
    priority: 'high',
    category: 'task',
    source_type: 'work_order.assigned',
    source_id: 'wo-1',
    event_id: null,
    asset_id: 'asset-1',
    department_id: 'dep-1',
    action_href: '/maintenance/work-orders/wo-1',
    action_label: 'Open Work Order',
    status: 'unread',
    dedupe_key: 'p1:work_order.assigned:wo-1',
    metadata: {},
    created_at: new Date().toISOString(),
    read_at: null,
    reviewed_at: null,
    dismissed_at: null,
    ...partial,
  };
}

test('buildNotificationLink routes maintenance request to exact request page', () => {
  const link = buildNotificationLink('maintenance_request.created', {
    source_id: 'req-1',
  });
  assert.deepEqual(link, { href: '/maintenance/requests/req-1', label: 'Open Request' });
});

test('buildNotificationLink routes assigned work order to exact WO page', () => {
  const link = buildNotificationLink('work_order.assigned', {
    source_id: 'wo-1',
    asset_id: 'asset-1',
  });
  assert.deepEqual(link, { href: '/maintenance/work-orders/wo-1', label: 'Open Work Order' });
});

test('buildNotificationLink routes stock blocker to filtered spare parts when no source id', () => {
  const link = buildNotificationLink('work_order.stock_blocked', {
    asset_id: 'asset-1',
  });
  assert.deepEqual(link, { href: '/spare-parts?tab=blockers&asset_id=asset-1', label: 'Open Blocker' });
});

test('buildNotificationLink routes offline conflict to sync review', () => {
  const link = buildNotificationLink('offline_sync.conflict', {});
  assert.deepEqual(link, { href: '/offline-sync', label: 'Open Sync Review' });
});

test('buildNotificationLink routes QR revoked scan to asset QR tab', () => {
  const link = buildNotificationLink('qr.revoked_scanned', { asset_id: 'asset-1' });
  assert.deepEqual(link, { href: '/equipment/asset-1?tab=qr', label: 'Open Asset QR' });
});

test('computeDedupeKey combines recipient, event, source consistently', () => {
  const a = computeDedupeKey({
    recipient_profile_id: 'p1',
    event_type: 'work_order.assigned',
    source_type: 'work_order.assigned',
    source_id: 'wo-1',
  });
  const b = computeDedupeKey({
    recipient_profile_id: 'p1',
    event_type: 'work_order.assigned',
    source_type: 'work_order.assigned',
    source_id: 'wo-1',
  });
  assert.equal(a, b);
  const c = computeDedupeKey({
    recipient_profile_id: 'p2',
    event_type: 'work_order.assigned',
    source_type: 'work_order.assigned',
    source_id: 'wo-1',
  });
  assert.notEqual(a, c);
});

test('isTelegramEligible is true for critical/high notifications', () => {
  assert.equal(isTelegramEligible(notif({ priority: 'critical' })), true);
  assert.equal(isTelegramEligible(notif({ priority: 'high' })), true);
});

test('isTelegramEligible suppresses dismissed/reviewed regardless of priority', () => {
  assert.equal(isTelegramEligible(notif({ status: 'dismissed', priority: 'critical' })), false);
  assert.equal(isTelegramEligible(notif({ status: 'reviewed', priority: 'critical' })), false);
});

test('isTelegramEligible is true for work_order.assigned regardless of low priority', () => {
  assert.equal(
    isTelegramEligible(
      notif({
        priority: 'low',
        source_type: 'work_order.assigned',
      }),
    ),
    true,
  );
});

test('isTelegramConfigured reflects env presence', () => {
  // We cannot mutate env safely in this test, but we can verify the function
  // returns a boolean and does not throw with missing env.
  delete process.env.TELEGRAM_NOTIFICATIONS_ENABLED;
  delete process.env.TELEGRAM_BOT_TOKEN;
  assert.equal(isTelegramConfigured(), false);
});

test('maskTelegramChatId hides everything but last 4 chars', () => {
  assert.equal(maskTelegramChatId('123456789'), '••6789');
  assert.equal(maskTelegramChatId('77'), '••77');
  assert.equal(maskTelegramChatId(null), null);
});

test('formatTelegramNotification includes title, message, and link when present', () => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  const text = formatTelegramNotification(notif(), { full_name: 'Hanna', primaryRole: 'technician' });
  assert.match(text, /Test title/);
  assert.match(text, /Test message/);
  assert.match(text, /Role: technician/);
  assert.match(text, /https:\/\/example\.com\/maintenance\/work-orders\/wo-1/);
});

test('formatTelegramMonitorMessage shows original recipient and delivery status', () => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  const text = formatTelegramMonitorMessage(
    notif({ priority: 'critical', category: 'critical' }),
    { full_name: 'Hanna', primaryRole: 'technician' },
    { status: 'skipped', skipReason: 'no_chat_id' },
  );
  assert.match(text, /BMERMS Notification Monitor/);
  assert.match(text, /Original recipient: Hanna/);
  assert.match(text, /Role: technician/);
  assert.match(text, /Priority: critical/);
  assert.match(text, /skipped — no_chat_id/);
});

test('formatTelegramMonitorMessage handles missing recipient gracefully', () => {
  const text = formatTelegramMonitorMessage(notif(), null, { status: 'failed', error: 'network' });
  assert.match(text, /Original recipient: unknown/);
  assert.match(text, /failed — network/);
});
