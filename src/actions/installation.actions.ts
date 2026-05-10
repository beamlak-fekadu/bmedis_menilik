'use server';

import { z } from 'zod';
import { getActionContext, logServerAuditEvent, revalidateMany, actionError, nullIfEmpty, type ActionResult } from './_shared';

const installationPaths = ['/installation', '/requests', '/calendar', '/command'];

export async function createInstallationRequestAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician', 'department_head', 'department_user', 'store_user']);
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      asset_id: z.string().optional().nullable(),
      procurement_request_id: z.string().optional().nullable(),
      department_id: z.string().optional().nullable(),
      equipment_name: z.string().optional().nullable(),
      asset_code_hint: z.string().optional().nullable(),
      vendor: z.string().optional().nullable(),
      received_date: z.string().optional().nullable(),
      requested_installation_date: z.string().optional().nullable(),
      target_go_live_date: z.string().optional().nullable(),
      installation_reason: z.string().trim().min(5, 'Reason must be at least 5 characters'),
      commissioning_required: z.boolean().optional(),
      user_training_required: z.boolean().optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      source: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(payload);

    const requestNumber = `IR-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const data = {
      ...parsed,
      request_number: requestNumber,
      requested_by: profile.id,
      department_id: nullIfEmpty(parsed.department_id) ?? profile.department_id,
      asset_id: nullIfEmpty(parsed.asset_id),
      procurement_request_id: nullIfEmpty(parsed.procurement_request_id),
      equipment_name: nullIfEmpty(parsed.equipment_name),
      asset_code_hint: nullIfEmpty(parsed.asset_code_hint),
      vendor: nullIfEmpty(parsed.vendor),
      received_date: nullIfEmpty(parsed.received_date),
      requested_installation_date: nullIfEmpty(parsed.requested_installation_date),
      target_go_live_date: nullIfEmpty(parsed.target_go_live_date),
      notes: nullIfEmpty(parsed.notes),
      source: nullIfEmpty(parsed.source),
      commissioning_required: parsed.commissioning_required ?? true,
      user_training_required: parsed.user_training_required ?? false,
      priority: parsed.priority ?? 'medium',
      status: 'submitted',
    };
    const result = await supabase.from('installation_requests').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'installation_request.create', entityType: 'installation_requests', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    revalidateMany(installationPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create installation request');
  }
}

export async function updateInstallationRequestStatusAction(id: string, status: string): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician']);
    if (error || !profile) return { success: false, error };
    const parsedStatus = z.enum(['submitted', 'approved', 'scheduled', 'assigned', 'in_progress', 'completed', 'rejected', 'cancelled']).parse(status);
    const updateData: Record<string, unknown> = { status: parsedStatus };
    if (parsedStatus === 'completed') updateData.completed_at = new Date().toISOString();
    const result = await supabase.from('installation_requests').update(updateData as never).eq('id', id).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'installation_request.status_update', entityType: 'installation_requests', entityId: id, newValues: result.data as Record<string, unknown> });
    revalidateMany([...installationPaths, `/installation/requests/${id}`]);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to update installation request status');
  }
}

export async function createInstallationRecordAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician']);
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      asset_id: z.string().min(1),
      installed_by: z.string().trim().min(1),
      installation_date: z.string().min(1),
      commissioning_date: z.string().optional().nullable(),
      go_live_date: z.string().optional().nullable(),
      initial_training_done: z.boolean().optional(),
      acceptance_checklist: z.unknown().optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(payload);
    const data = { ...parsed, commissioning_date: nullIfEmpty(parsed.commissioning_date), go_live_date: nullIfEmpty(parsed.go_live_date), initial_training_done: parsed.initial_training_done ?? false, acceptance_checklist: parsed.acceptance_checklist ?? [], notes: nullIfEmpty(parsed.notes) };
    const result = await supabase.from('installation_records').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'installation_record.create', entityType: 'installation_records', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    revalidateMany(['/installation', '/calendar', '/equipment', '/inventory', '/command']);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create installation record');
  }
}
