'use server';

import { z } from 'zod';
import { getActionContext, logServerAuditEvent, revalidateMany, actionError, type ActionResult } from './_shared';

const documentPaths = ['/documents', '/equipment', '/inventory'];

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
