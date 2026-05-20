'use server';

import { z } from 'zod';
import { getActionContextForCapability, logServerAuditEvent, refreshDecisionSupportSnapshotsBestEffort, revalidateMany, actionError, nullIfEmpty, type ActionResult } from './_shared';

const procurementPaths = ['/procurement', '/logistics', '/calendar', '/command'];
const procurementStatus = z.enum(['requested', 'approved', 'ordered', 'in_transit', 'delivered', 'canceled']);

export async function createProcurementRequestAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('procurement.request');
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      title: z.string().trim().min(5),
      justification: z.string().trim().min(15),
      status: procurementStatus.optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      requested_by: z.string().optional().nullable(),
      department_id: z.string().optional().nullable(),
      expected_delivery_date: z.string().optional().nullable(),
      // R32: when launched from /replacement/[assetId] evidence panel.
      source_replacement_score_id: z.string().uuid().optional().nullable(),
    }).parse(payload);
    const data = {
      ...parsed,
      request_number: `PR-${Date.now().toString(36).toUpperCase()}`,
      requested_by: nullIfEmpty(parsed.requested_by) ?? profile.id,
      department_id: nullIfEmpty(parsed.department_id) ?? profile.department_id,
      status: parsed.status ?? 'requested',
      priority: parsed.priority ?? 'medium',
      expected_delivery_date: nullIfEmpty(parsed.expected_delivery_date),
      source_replacement_score_id: nullIfEmpty(parsed.source_replacement_score_id),
    };
    const result = await supabase.from('procurement_requests').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'procurement_request.create', entityType: 'procurement_requests', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    await refreshDecisionSupportSnapshotsBestEffort({
      supabase,
      profileId: profile.id,
      reason: 'procurement_request.create',
      entityType: 'procurement_requests',
      entityId: (result.data as { id?: string }).id ?? null,
    }).catch(() => undefined);
    revalidateMany(procurementPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create procurement request');
  }
}

export async function updateProcurementStatusAction(id: string, status: string): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('procurement.status_update');
    if (error || !profile) return { success: false, error };
    const parsedStatus = procurementStatus.parse(status);
    const oldRow = await supabase.from('procurement_requests').select('*').eq('id', id).maybeSingle();
    const result = await supabase.from('procurement_requests').update({ status: parsedStatus } as never).eq('id', id).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'procurement_request.status_update', entityType: 'procurement_requests', entityId: id, oldValues: oldRow.data as Record<string, unknown> | null, newValues: result.data as Record<string, unknown> });

    if (parsedStatus === 'delivered') {
      try {
        const row = result.data as Record<string, unknown>;
        const description = (row.description as string) ?? (row.title as string) ?? 'Procurement request';
        const { emitNotificationEvent } = await import('@/services/notifications/notification-engine');

        // R21: delivered does NOT auto-update spare_parts.current_stock —
        // the part_id and exact quantity on a procurement request are not
        // structured fields, so blindly summing would be wrong. Instead we
        // emit a dedicated 'procurement.delivered_pending_receipt' event
        // that links Store User to a prefilled stock-receipt form. The
        // receipt action then transactionally bumps stock AND persists
        // stock_receipts.procurement_id so future queries can answer
        // "what came of procurement X" without guessing.
        await emitNotificationEvent({
          event_type: 'procurement.delivered_pending_receipt',
          source_table: 'procurement_requests',
          source_id: id,
          priority: 'medium',
          payload: {
            description,
            status: parsedStatus,
            request_number: (row.request_number as string | null) ?? null,
            // Action link for the notification deep-link. Store User clicks
            // through to /spare-parts with the receipt modal prefilled.
            stock_receipt_prefill_href:
              `/spare-parts?action=record-receipt&procurement_id=${encodeURIComponent(id)}&source=procurement-delivery`,
          },
        });

        // Existing event preserved for downstream consumers that already
        // subscribe to the legacy name. The pending-receipt event above is
        // the new signal Store User should act on.
        await emitNotificationEvent({
          event_type: 'procurement.delivered',
          source_table: 'procurement_requests',
          source_id: id,
          priority: 'medium',
          payload: {
            description,
            status: parsedStatus,
          },
        });
      } catch (e) {
        console.error('[notifications] procurement.delivered emit failed:', e);
      }
    }

    await refreshDecisionSupportSnapshotsBestEffort({
      supabase,
      profileId: profile.id,
      reason: `procurement_request.status_update.${parsedStatus}`,
      entityType: 'procurement_requests',
      entityId: id,
    }).catch(() => undefined);
    revalidateMany(procurementPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to update procurement status');
  }
}
