import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNotificationLink } from '@/services/notifications/notification-links';
import { isTelegramEligible } from '@/services/notifications/notification-delivery.service';
import type { NotificationRow } from '@/types/notifications';

const root = process.cwd();

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function notification(sourceType: string, priority: NotificationRow['priority'] = 'medium'): NotificationRow {
  return {
    id: 'n1',
    recipient_profile_id: 'p1',
    recipient_role: 'store_user',
    title: 'Title',
    message: 'Message',
    priority,
    category: 'stock',
    source_type: sourceType,
    source_id: 'source-1',
    event_id: 'event-1',
    asset_id: 'asset-1',
    department_id: 'dept-1',
    action_href: null,
    action_label: null,
    status: 'unread',
    dedupe_key: null,
    metadata: {},
    created_at: new Date().toISOString(),
    read_at: null,
    reviewed_at: null,
    dismissed_at: null,
  };
}

test('part requested notification deep-link opens stock issue with work-order and need context', () => {
  const link = buildNotificationLink('work_order.part_requested', {
    source_id: 'need-1',
    payload: {
      work_order_id: 'wo-1',
      part_id: 'part-1',
      quantity_needed: 2,
    },
  });
  assert.ok(link);
  assert.equal(link!.label, 'Issue Part');
  assert.match(link!.href, /^\/spare-parts\?action=issue/);
  assert.match(link!.href, /partId=part-1/);
  assert.match(link!.href, /work_order_id=wo-1/);
  assert.match(link!.href, /need_id=need-1/);
  assert.match(link!.href, /quantity=2/);
});

test('workflow notification events are first-class and Telegram eligible', () => {
  const types = read('src/types/notifications.ts');
  const rules = read('src/services/notifications/notification-rules.ts');
  const maintenanceActions = read('src/actions/maintenance.actions.ts');
  const spareActions = read('src/actions/spare-parts.actions.ts');
  const migration = read('supabase/migrations/00082_notification_event_dedupe.sql');

  assert.match(types, /'work_order\.part_requested'/);
  assert.match(types, /'work_order\.part_issued'/);
  assert.match(rules, /case 'work_order\.part_requested'/);
  assert.match(rules, /case 'work_order\.part_issued'/);
  assert.match(rules, /requested_by/);
  assert.match(maintenanceActions, /work_order\.completed:\$\{row\.id\}/);
  assert.match(maintenanceActions, /maintenance_requests/);
  assert.match(maintenanceActions, /requested_by/);
  assert.match(maintenanceActions, /work_order\.part_requested/);
  assert.match(spareActions, /work_order\.part_issued/);
  assert.match(spareActions, /work_order_parts_needed/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_events_dedupe_key/);

  assert.equal(isTelegramEligible(notification('work_order.completed')), true);
  assert.equal(isTelegramEligible(notification('work_order.part_requested')), true);
  assert.equal(isTelegramEligible(notification('work_order.part_issued')), true);
});
