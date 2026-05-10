import { createClient } from '@/lib/supabase/client';
import type { DocumentType } from '@/types/domain';

const DOCUMENT_SELECT = `
  id, asset_id, document_type, title, description,
  file_path, file_size, mime_type, uploaded_by, created_at
`;

export async function getDocuments(assetId: string) {
  const supabase = createClient();
  return supabase
    .from('equipment_documents')
    .select(DOCUMENT_SELECT)
    .eq('asset_id', assetId)
    .order('created_at', { ascending: false });
}

export interface DocumentMetadata {
  document_type: DocumentType;
  title: string;
  description?: string;
  uploaded_by?: string;
}

export async function uploadDocument(file: File, assetId: string, metadata: DocumentMetadata) {
  const supabase = createClient();
  const fileExt = file.name.split('.').pop();
  const filePath = `documents/${assetId}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('equipment-documents')
    .upload(filePath, file);

  if (uploadError) return { data: null, error: uploadError };

  return supabase
    .from('equipment_documents')
    .insert({
      asset_id: assetId,
      document_type: metadata.document_type,
      title: metadata.title,
      description: metadata.description ?? null,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: metadata.uploaded_by ?? null,
    })
    .select(DOCUMENT_SELECT)
    .single();
}

export async function deleteDocument(id: string) {
  const supabase = createClient();

  const { data: doc } = await supabase
    .from('equipment_documents')
    .select('file_path')
    .eq('id', id)
    .single();

  if (doc?.file_path) {
    await supabase.storage
      .from('equipment-documents')
      .remove([doc.file_path]);
  }

  return supabase
    .from('equipment_documents')
    .delete()
    .eq('id', id);
}
