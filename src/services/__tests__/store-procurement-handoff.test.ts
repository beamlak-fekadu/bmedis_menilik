import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { storeCreateReorderLink, storeIssueLink, storeReceiveLink } from '@/utils/store/store-evidence-links';
import { buildNotificationLink } from '@/services/notifications/notification-links';

const repoRoot = process.cwd();
function readSource(rel: string): string {
  return readFileSync(path.resolve(repoRoot, rel), 'utf8');
}

test('STORE-01: store links carry exact receipt, issue, and reorder context', () => {
  assert.equal(
    storeReceiveLink('proc-1'),
    '/spare-parts?action=record-receipt&source=store-console&procurement_id=proc-1',
  );
  assert.match(storeIssueLink('part-1', { workOrderId: 'wo-1', needId: 'need-1' }), /work_order_id=wo-1/);
  assert.match(storeIssueLink('part-1', { workOrderId: 'wo-1', needId: 'need-1' }), /need_id=need-1/);
  const reorder = storeCreateReorderLink(
    { id: 'part-1', name: 'Filter', part_code: 'FIL-1', current_stock: 0, reorder_level: 2 },
    { workOrderId: 'wo-1', assetId: 'asset-1', needId: 'need-1', quantityNeeded: 3 },
  );
  assert.match(reorder, /partId=part-1/);
  assert.match(reorder, /workOrderId=wo-1/);
  assert.match(reorder, /assetId=asset-1/);
  assert.match(reorder, /needId=need-1/);
  assert.match(reorder, /suggestedQuantity=3/);
});

test('PROC-01: procurement delivered notification link preserves part and quantity context', () => {
  const link = buildNotificationLink('procurement.delivered_pending_receipt', {
    source_id: 'proc-1',
    payload: {
      spare_part_id: 'part-1',
      requested_quantity: 4,
    },
  });
  assert.ok(link);
  assert.equal(link!.label, 'Record Stock Receipt');
  assert.match(link!.href, /procurement_id=proc-1/);
  assert.match(link!.href, /partId=part-1/);
  assert.match(link!.href, /quantity=4/);
});

test('PROC-01: migration and actions persist structured procurement spare-part context', () => {
  const migration = readSource('supabase/migrations/00075_procurement_spare_part_context.sql');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS spare_part_id UUID/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS requested_quantity INTEGER/);

  const action = readSource('src/actions/procurement.actions.ts');
  assert.match(action, /spare_part_id:/);
  assert.match(action, /requested_quantity:/);
  assert.match(action, /stock_receipt_prefill_href/);
});

test('STORE-01: store blocker UI reads canonical work_order_parts_needed rows', () => {
  const component = readSource('src/app/(dashboard)/maintenance/_components/StoreMaintenanceBlockers.tsx');
  assert.match(component, /from\('work_order_parts_needed'\)/);
  assert.match(component, /quantity_needed/);
  assert.match(component, /storeIssueLink/);
  assert.match(component, /storeCreateReorderLink/);
});

test('STORE-02: command center does not surface the fake approved-items issue metric', () => {
  const component = readSource('src/app/(dashboard)/command/_components/StoreOperationsCommandCenter.tsx');
  const metrics = readSource('src/utils/store/store-metrics.ts');
  const commandPage = readSource('src/app/(dashboard)/command/page.tsx');

  assert.doesNotMatch(component, /Approved Items to Issue|Issue Approved Requests|pending parts handoff/);
  assert.doesNotMatch(component, /issueQueue|StoreIssueRow/);
  assert.doesNotMatch(metrics, /approvedItemsToIssue|fetchStoreIssueQueue|StoreIssueRow/);
  assert.doesNotMatch(commandPage, /fetchStoreIssueQueue|approvedItemsToIssue/);
});

test('STORE-03: legacy Hanna demo login is removed while Menelik Hanna remains', () => {
  const legacyEmail = `technician@${'bmer'}${'ms'}-demo.local`;
  const menelikEmail = `technician@${'bme'}${'dis'}-menelik.local`;
  const setupLegacy = readSource('scripts/setup-demo-users.ts');
  const seedDemo = readSource('supabase/seed/100_demo_role_users.sql');
  const linkAuth = readSource('supabase/seed/99_link_auth_users.sql');
  const menelikSetup = readSource('scripts/setup-menelik-users.ts');
  const migration = readSource(`supabase/migrations/00083_remove_wrong_${'bmer'}${'ms'}_hanna_account.sql`);

  assert.doesNotMatch(setupLegacy, new RegExp(legacyEmail.replace('.', '\\.')));
  assert.doesNotMatch(seedDemo, new RegExp(legacyEmail.replace('.', '\\.')));
  assert.doesNotMatch(linkAuth, new RegExp(legacyEmail.replace('.', '\\.')));
  assert.match(migration, new RegExp(`WHERE lower\\(email\\) = '${legacyEmail.replace('.', '\\.')}'`));
  assert.match(menelikSetup, new RegExp(menelikEmail.replace('.', '\\.')));
  assert.match(menelikSetup, /Hanna Gebremedhin/);
});
