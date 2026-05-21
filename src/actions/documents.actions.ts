'use server';

import { z } from 'zod';
import { getActionContext, logServerAuditEvent, revalidateMany, actionError, nullIfEmpty, interpretMissingMutationResult, type ActionResult } from './_shared';

const documentPaths = ['/documents', '/calendar', '/equipment', '/inventory'];
const specRequestPaths = ['/documents', '/requests', '/calendar'];

export async function createSpecificationRequestAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician', 'department_head', 'department_user', 'store_user']);
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      title: z.string().trim().min(3, 'Title must be at least 3 characters'),
      purpose: z.string().optional().nullable(),
      department_id: z.string().optional().nullable(),
      asset_id: z.string().optional().nullable(),
      procurement_request_id: z.string().optional().nullable(),
      replacement_candidate_asset_id: z.string().optional().nullable(),
      equipment_category: z.string().optional().nullable(),
      requested_equipment_name: z.string().optional().nullable(),
      required_by: z.string().optional().nullable(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      source: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(payload);

    const requestNumber = `SR-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const data = {
      ...parsed,
      request_number: requestNumber,
      requested_by: profile.id,
      department_id: nullIfEmpty(parsed.department_id) ?? profile.department_id,
      asset_id: nullIfEmpty(parsed.asset_id),
      procurement_request_id: nullIfEmpty(parsed.procurement_request_id),
      replacement_candidate_asset_id: nullIfEmpty(parsed.replacement_candidate_asset_id),
      equipment_category: nullIfEmpty(parsed.equipment_category),
      requested_equipment_name: nullIfEmpty(parsed.requested_equipment_name),
      purpose: nullIfEmpty(parsed.purpose),
      required_by: nullIfEmpty(parsed.required_by),
      notes: nullIfEmpty(parsed.notes),
      source: nullIfEmpty(parsed.source),
      priority: parsed.priority ?? 'medium',
      status: 'submitted',
    };
    const result = await supabase.from('specification_requests').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'specification_request.create', entityType: 'specification_requests', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    revalidateMany(specRequestPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create specification request');
  }
}

export async function updateSpecificationRequestStatusAction(id: string, status: string): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician']);
    if (error || !profile) return { success: false, error };
    const parsedStatus = z.enum(['submitted', 'in_review', 'in_progress', 'completed', 'rejected', 'cancelled']).parse(status);
    const updateData: Record<string, unknown> = { status: parsedStatus };
    if (parsedStatus === 'completed') updateData.completed_at = new Date().toISOString();
    // SHAPE-01: maybeSingle handles RLS-filtered rows cleanly.
    const result = await supabase.from('specification_requests').update(updateData as never).eq('id', id).select('*').maybeSingle();
    if (result.error) return { success: false, error: result.error.message };
    if (!result.data) {
      return interpretMissingMutationResult({
        entity: 'specification request',
        entityId: id,
        attempted: `status=${parsedStatus}`,
        profileId: profile.id,
      });
    }
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'specification_request.status_update', entityType: 'specification_requests', entityId: id, newValues: result.data as Record<string, unknown> });
    revalidateMany([...specRequestPaths, `/documents/specification-requests/${id}`]);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to update specification request status');
  }
}

export async function uploadDocumentAction(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician']);
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      assetId: z.string().min(1),
      document_type: z.enum(['manual', 'specification', 'sop', 'certificate', 'warranty', 'service_contract', 'photo', 'other']),
      title: z.string().trim().min(1),
      description: z.string().optional().nullable(),
    }).parse({
      assetId: formData.get('assetId'),
      document_type: formData.get('document_type'),
      title: formData.get('title'),
      description: formData.get('description'),
    });
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) return { success: false, error: 'Document file is required' };

    const fileExt = file.name.split('.').pop() || 'bin';
    const filePath = `documents/${parsed.assetId}/${Date.now()}.${fileExt}`;
    const upload = await supabase.storage.from('equipment-documents').upload(filePath, file);
    if (upload.error) return { success: false, error: upload.error.message };

    const result = await supabase.from('equipment_documents').insert({
      asset_id: parsed.assetId,
      document_type: parsed.document_type,
      title: parsed.title,
      description: parsed.description || null,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: profile.id,
    } as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'equipment_document.upload', entityType: 'equipment_documents', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    revalidateMany([...documentPaths, `/equipment/${parsed.assetId}`, `/inventory/${parsed.assetId}`]);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to upload document');
  }
}

export async function deleteDocumentAction(id: string): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician']);
    if (error || !profile) return { success: false, error };
    const oldRow = await supabase.from('equipment_documents').select('*').eq('id', id).maybeSingle();
    const filePath = (oldRow.data as { file_path?: string } | null)?.file_path;
    if (filePath) await supabase.storage.from('equipment-documents').remove([filePath]);
    const result = await supabase.from('equipment_documents').delete().eq('id', id);
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'equipment_document.delete', entityType: 'equipment_documents', entityId: id, oldValues: oldRow.data as Record<string, unknown> | null });
    revalidateMany(documentPaths);
    return { success: true };
  } catch (err) {
    return actionError(err, 'Failed to delete document');
  }
}
