'use server';

import { z } from 'zod';
import { createMaintenanceEventAction, updateWorkOrderAction } from './maintenance.actions';
import { getActionContextForAnyCapability, logServerAuditEvent, actionError, type ActionResult } from './_shared';

const offlineActionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['update_status', 'log_event']),
  workOrderId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

type SyncResult = { id: string; status: 'synced' | 'failed' | 'skipped'; error?: string };

export async function syncOfflineWorkOrderActionsAction(items: unknown[]): Promise<ActionResult<SyncResult[]>> {
  try {
    // Offline sync replays work-order events; any WO-execution capability suffices.
    const { supabase, profile, error } = await getActionContextForAnyCapability([
      'work_order.start',
      'work_order.complete',
      'work_order.add_event',
    ]);
    if (error || !profile) return { success: false, error };
    const parsedItems = z.array(offlineActionSchema).parse(items);
    const results: SyncResult[] = [];

    for (const item of parsedItems) {
      const existing = await supabase
        .from('offline_sync_events')
        .select('id, sync_status')
        .eq('client_action_id', item.id)
        .eq('sync_status', 'synced')
        .maybeSingle();

      if (existing.data) {
        results.push({ id: item.id, status: 'skipped' });
        continue;
      }

      const actionResult = item.type === 'update_status'
        ? await updateWorkOrderAction(item.workOrderId, { ...item.payload, status: item.payload.status })
        : await createMaintenanceEventAction({ ...item.payload, work_order_id: item.workOrderId });

      const syncStatus = actionResult.success ? 'synced' : 'failed';
      await supabase.from('offline_sync_events').insert({
        client_action_id: item.id,
        actor_user_id: profile.id,
        entity_type: 'work_orders',
        entity_id: item.workOrderId,
        action_type: item.type,
        payload: item.payload,
        sync_status: syncStatus,
        synced_at: actionResult.success ? new Date().toISOString() : null,
      } as never);

      await logServerAuditEvent({
        supabase,
        profileId: profile.id,
        action: `offline_sync.${syncStatus}`,
        entityType: 'offline_sync_events',
        entityId: item.id,
        details: { action_type: item.type, work_order_id: item.workOrderId, error: actionResult.error ?? null },
      });

      results.push({ id: item.id, status: syncStatus, error: actionResult.error });
    }

    return { success: results.every((result) => result.status !== 'failed'), data: results };
  } catch (err) {
    return actionError(err, 'Failed to sync offline work-order actions') as ActionResult<SyncResult[]>;
  }
}
