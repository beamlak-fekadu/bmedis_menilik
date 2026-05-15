'use server';

import { z } from 'zod';
import { getActionContextForCapability, logServerAuditEvent, revalidateMany, actionError, nullIfEmpty, type ActionResult } from './_shared';

const disposalPaths = ['/disposal', '/replacement', '/calendar', '/reports/disposal'];
const disposalStatus = z.enum(['pending', 'approved', 'rejected', 'completed', 'canceled']);

export async function createDisposalRequestAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('disposal.request.create');
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      asset_id: z.string().min(1),
      requested_by: z.string().optional().nullable(),
      reason: z.string().trim().min(10),
      disposal_method_proposed: z.enum(['auction', 'donation', 'recycling', 'destruction', 'return_to_vendor', 'other']),
      status: disposalStatus.optional(),
      notes: z.string().optional().nullable(),
    }).parse(payload);
    const data = { ...parsed, request_number: `DSP-${Date.now().toString(36).toUpperCase()}`, requested_by: nullIfEmpty(parsed.requested_by) ?? profile.id, status: parsed.status ?? 'pending', notes: nullIfEmpty(parsed.notes) };
    const result = await supabase.from('disposal_requests').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'disposal_request.create', entityType: 'disposal_requests', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    revalidateMany(disposalPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create disposal request');
  }
}

export async function updateDisposalRequestStatusAction(id: string, status: string): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('disposal.approve');
    if (error || !profile) return { success: false, error };
    const parsedStatus = disposalStatus.parse(status);
    const oldRow = await supabase.from('disposal_requests').select('*').eq('id', id).maybeSingle();
    const updateData: Record<string, unknown> = { status: parsedStatus };
    if (parsedStatus === 'approved') {
      updateData.approved_by = profile.id;
      updateData.approved_at = new Date().toISOString();
    }
    const result = await supabase.from('disposal_requests').update(updateData as never).eq('id', id).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'disposal_request.status_update', entityType: 'disposal_requests', entityId: id, oldValues: oldRow.data as Record<string, unknown> | null, newValues: result.data as Record<string, unknown> });
    revalidateMany(disposalPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to update disposal request');
  }
}

export async function createDisposedAssetAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('disposal.record');
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      asset_id: z.string().min(1),
      disposal_request_id: z.string().optional().nullable(),
      disposal_date: z.string().min(1),
      disposal_method: z.enum(['auction', 'donation', 'recycling', 'destruction', 'return_to_vendor', 'other']),
      disposal_value: z.coerce.number().optional().nullable(),
      disposed_by: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(payload);
    const data = { ...parsed, disposal_request_id: nullIfEmpty(parsed.disposal_request_id), disposal_value: parsed.disposal_value ?? null, disposed_by: nullIfEmpty(parsed.disposed_by) ?? profile.id, notes: nullIfEmpty(parsed.notes) };
    const result = await supabase.from('disposed_assets').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'disposed_asset.create', entityType: 'disposed_assets', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    revalidateMany(disposalPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create disposed asset');
  }
}
