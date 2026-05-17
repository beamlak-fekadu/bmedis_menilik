import { createClient } from '@/lib/supabase/server';

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-004';
const GEMINI_DEFAULT_HOST = 'https://generativelanguage.googleapis.com';
const EMBEDDING_DIMENSIONS = 768;

export interface EquipmentDocumentMatch {
  chunk_id: string;
  equipment_document_id: string;
  asset_id: string | null;
  chunk_index: number;
  chunk_text: string;
  source_label: string | null;
  similarity: number;
}

export interface UpsertEquipmentDocumentInput {
  equipmentDocumentId: string;
  chunkText: string;
  sourceLabel: string;
  chunkIndex?: number;
}

interface GeminiEmbedContentResponse {
  embedding?: { values?: number[] };
  error?: { message?: string };
}

function getEmbeddingModel(): string {
  return process.env.GEMINI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
}

function getGeminiNativeHost(): string {
  const base = process.env.GEMINI_BASE_URL?.trim();
  if (!base) return GEMINI_DEFAULT_HOST;
  try {
    const url = new URL(base);
    return `${url.protocol}//${url.host}`;
  } catch {
    return GEMINI_DEFAULT_HOST;
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const trimmed = text?.trim();
  if (!trimmed) {
    throw new Error('generateEmbedding: text is required.');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing or empty.');
  }

  const model = getEmbeddingModel();
  const host = getGeminiNativeHost();
  const endpoint = `${host}/v1beta/models/${encodeURIComponent(model)}:embedContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text: trimmed }] },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Gemini embedding request failed: ${response.status} ${response.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ''}`,
    );
  }

  const data = (await response.json()) as GeminiEmbedContentResponse;
  const values = data.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    const detail = data.error?.message ?? 'no embedding values returned';
    throw new Error(`Gemini embedding response malformed: ${detail}`);
  }
  if (values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Gemini embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${values.length}. Check GEMINI_EMBEDDING_MODEL.`,
    );
  }

  return values;
}

export async function searchEquipmentDocuments(
  query: string,
  matchCount = 5,
  matchThreshold = 0.5,
): Promise<EquipmentDocumentMatch[]> {
  const embedding = await generateEmbedding(query);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('match_equipment_documents', {
    query_embedding: embedding as unknown as string,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) {
    throw new Error(`match_equipment_documents RPC failed: ${error.message}`);
  }

  return (data ?? []) as EquipmentDocumentMatch[];
}

export async function upsertEquipmentDocument(
  input: UpsertEquipmentDocumentInput,
): Promise<{ chunkId: string }> {
  const { equipmentDocumentId, chunkText, sourceLabel, chunkIndex = 0 } = input;
  const trimmed = chunkText?.trim();
  if (!equipmentDocumentId) {
    throw new Error('upsertEquipmentDocument: equipmentDocumentId is required.');
  }
  if (!trimmed) {
    throw new Error('upsertEquipmentDocument: chunkText is required.');
  }

  const embedding = await generateEmbedding(trimmed);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('equipment_document_chunks')
    .upsert(
      {
        equipment_document_id: equipmentDocumentId,
        chunk_index: chunkIndex,
        chunk_text: trimmed,
        source_label: sourceLabel,
        embedding: embedding as unknown as string,
      },
      { onConflict: 'equipment_document_id,chunk_index' },
    )
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`upsertEquipmentDocument insert failed: ${error?.message ?? 'no row returned'}`);
  }

  return { chunkId: data.id as string };
}
