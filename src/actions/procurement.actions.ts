'use server';

import { z } from 'zod';
import { getActionContext, logServerAuditEvent, revalidateMany, actionError, nullIfEmpty, type ActionResult } from './_shared';

const procurementPaths = ['/procurement', '/logistics', '/calendar', '/command'];
const procurementStatus = z.enum(['requested', 'approved', 'ordered', 'in_transit', 'delivered', 'canceled']);

export async function createProcurementRequestAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'store_user', 'technician']);
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      title: z.string().trim().min(5),
      justification: z.string().trim().min(15),
      status: procurementStatus.optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      requested_by: z.string().optional().nullable(),
      department_id: z.string().optional().nullable(),
      expected_delivery_date: z.string().optional().nullable(),
    }).parse(payload);
    const data = { ...parsed, request_number: `PR-${Date.now().toString(36).toUpperCase()}`, requested_by: nullIfEmpty(parsed.requested_by) ?? profile.id, department_id: nullIfEmpty(parsed.department_id) ?? profile.department_id, status: parsed.status ?? 'requested', priority: parsed.priority ?? 'medium', expected_delivery_date: nullIfEmpty(parsed.expected_delivery_date) };
    const result = await supabase.from('procurement_requests').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'procurement_request.create', entityType: 'procurement_requests', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    revalidateMany(procurementPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create procurement request');
  }
}

export async function updateProcurementStatusAction(id: string, status: string): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'store_user']);
    if (error || !profile) return { success: false, error };
    const parsedStatus = procurementStatus.parse(status);
    const oldRow = await supabase.from('procurement_requests').select('*').eq('id', id).maybeSingle();
    const result = await supabase.from('procurement_requests').update({ status: parsedStatus } as never).eq('id', id).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'procurement_request.status_update', entityType: 'procurement_requests', entityId: id, oldValues: oldRow.data as Record<string, unknown> | null, newValues: result.data as Record<string, unknown> });
    revalidateMany(procurementPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to update procurement status');
  }
}
