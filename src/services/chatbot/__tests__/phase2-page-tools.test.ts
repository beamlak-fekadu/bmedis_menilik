import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatRequestSchema, type UserChatProfile } from '@/types/chatbot';
import { copilotRoutes } from '@/services/chatbot/route-link-builder';
import { executeCopilotTool } from '@/services/chatbot/tools/tool-executor';
import { getCopilotToolDefinition } from '@/services/chatbot/tools/tool-registry';

function profile(roleNames: string[], departmentId: string | null = 'dept-a'): UserChatProfile {
  return {
    profileId: 'profile-a',
    userId: 'user-a',
    roleNames,
    departmentId,
  };
}

test('phase 2 module context schema accepts bounded page-aware fields', () => {
  const parsed = ChatRequestSchema.safeParse({
    message: 'summarize this page',
    moduleContext: {
      moduleLabel: 'Equipment',
      pageLabel: 'Asset profile',
      pathname: '/equipment/00000000-0000-0000-0000-000000000001',
      selectedRecordType: 'equipment',
      selectedRecordId: '00000000-0000-0000-0000-000000000001',
      selectedRecordLabel: 'EQ-001 · Ventilator',
      activeTab: 'maintenance',
      currentFilters: { condition: 'needs_repair' },
      visibleCounts: { openWorkOrders: 1, overduePm: 0 },
      availableEvidenceLinks: [{ label: 'Asset profile', href: '/equipment/00000000-0000-0000-0000-000000000001', type: 'equipment' }],
    },
  });
  assert.equal(parsed.success, true);
});

test('route link builder emits exact BMEDIS evidence routes', () => {
  assert.deepEqual(copilotRoutes.equipment('asset-1'), { label: 'Open equipment', href: '/equipment/asset-1', type: 'equipment' });
  assert.deepEqual(copilotRoutes.workOrder('wo-1'), { label: 'Open work order', href: '/maintenance/work-orders/wo-1', type: 'work_order' });
  assert.deepEqual(copilotRoutes.maintenanceRequest('req-1'), { label: 'Open maintenance request', href: '/maintenance/requests/req-1', type: 'maintenance_request' });
  assert.deepEqual(copilotRoutes.report('qr-coverage'), { label: 'Open report', href: '/reports/qr-coverage', type: 'report' });
});

test('developer tools are denied before any database access for non-developers', async () => {
  const result = await executeCopilotTool({} as never, 'read_provider_trace', {
    profile: profile(['bme_head']),
    moduleContext: { moduleLabel: 'Developer Lab' },
  });
  assert.equal(result.ok, false);
  assert.match(result.deniedReason ?? '', /not allowed|Developer diagnostics/i);
});

test('tool registry keeps phase 2 tools read-only except explicit future draft/write metadata', () => {
  const tool = getCopilotToolDefinition('read_qr_asset_context');
  assert.equal(tool.access, 'read');
  assert.equal(tool.category, 'qr');
  assert.equal(getCopilotToolDefinition('read_offline_sync_summary').access, 'read');
  assert.equal(getCopilotToolDefinition('read_current_page_context').dataSources.includes('moduleContext'), true);
});
