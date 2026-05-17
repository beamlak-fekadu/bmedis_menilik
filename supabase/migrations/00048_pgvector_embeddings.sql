-- Migration 00048: pgvector semantic search for equipment + document chunks
--
-- Goals:
--   - Enable the pgvector extension.
--   - Add an embedding column (vector(768)) to equipment_assets so the
--     copilot can do semantic search over asset name + description /
--     manufacturer / category context.
--   - Create equipment_document_chunks: each row is one embeddable text
--     chunk extracted from an uploaded equipment_documents row (manual,
--     SOP, specification, etc.).
--   - Add IVFFlat indexes for cosine similarity search on both embeddings.
--   - Add match_equipment_documents() RPC for the embeddings service to
--     call from the application layer.
--   - Add conservative RLS aligned with 00012 / 00045 patterns:
--       SELECT  -> any authenticated user (consistent with equipment_documents)
--       INSERT  -> admin / technician / store_user / developer / bme_head
--       UPDATE  -> admin / technician / developer / bme_head
--       DELETE  -> admin / developer
--
-- Dimension: 768 matches Gemini's text-embedding-004 native output.
-- Distance: cosine (vector_cosine_ops); similarity = 1 - distance.

-- =============================================================================
-- 1. Extension
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- 2. equipment_assets embedding column
-- =============================================================================
ALTER TABLE equipment_assets
    ADD COLUMN IF NOT EXISTS embedding vector(768),
    ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN equipment_assets.embedding IS
    'Gemini text-embedding-004 vector (768) over name + description + model + manufacturer + category. Populated by src/services/embeddings.ts; nullable until first index pass.';

-- =============================================================================
-- 3. equipment_document_chunks table
-- =============================================================================
CREATE TABLE IF NOT EXISTS equipment_document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_document_id UUID NOT NULL REFERENCES equipment_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    chunk_text TEXT NOT NULL,
    source_label TEXT,
    embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (equipment_document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_equipment_document_chunks_document
    ON equipment_document_chunks(equipment_document_id);

COMMENT ON TABLE equipment_document_chunks IS
    'Embeddable text chunks extracted from rows in equipment_documents. One uploaded document fans out to N chunks. Used by the BMERMS copilot semantic search; never the source of truth for the underlying document.';

-- =============================================================================
-- 4. IVFFlat cosine indexes
-- =============================================================================
-- Small dataset (~80 assets, doc chunks bounded by uploads). lists=100 is
-- generous; IVFFlat trains on existing rows when the index is built, so
-- backfill embeddings before relying on the index for production traffic.
CREATE INDEX IF NOT EXISTS idx_equipment_assets_embedding
    ON equipment_assets
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_equipment_document_chunks_embedding
    ON equipment_document_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- =============================================================================
-- 5. match_equipment_documents RPC
-- =============================================================================
-- Returns chunks ranked by cosine similarity. similarity = 1 - cosine_distance.
-- match_threshold filters out weak matches (0.0 = no filter, 1.0 = exact).
CREATE OR REPLACE FUNCTION match_equipment_documents(
    query_embedding vector(768),
    match_threshold FLOAT,
    match_count INT
)
RETURNS TABLE (
    chunk_id UUID,
    equipment_document_id UUID,
    asset_id UUID,
    chunk_index INTEGER,
    chunk_text TEXT,
    source_label TEXT,
    similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        c.id AS chunk_id,
        c.equipment_document_id,
        d.asset_id,
        c.chunk_index,
        c.chunk_text,
        c.source_label,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM equipment_document_chunks c
    JOIN equipment_documents d ON d.id = c.equipment_document_id
    WHERE c.embedding IS NOT NULL
      AND (1 - (c.embedding <=> query_embedding)) >= match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
$$;

COMMENT ON FUNCTION match_equipment_documents IS
    'Cosine-similarity ranking of equipment_document_chunks. RLS still applies because the function is STABLE and not SECURITY DEFINER.';

-- =============================================================================
-- 6. RLS for equipment_document_chunks
-- =============================================================================
-- Pattern mirrors 00012 operational-table style plus 00045 inline policies.
-- Auth funnel: app server actions remain the authoritative gate; RLS is the
-- defense-in-depth boundary.

ALTER TABLE equipment_document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_equipment_document_chunks
    ON equipment_document_chunks
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY insert_equipment_document_chunks
    ON equipment_document_chunks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth_user_has_role('admin')
        OR auth_user_has_role('technician')
        OR auth_user_has_role('store_user')
        OR auth_user_has_role('developer')
        OR auth_user_has_role('bme_head')
    );

CREATE POLICY update_equipment_document_chunks
    ON equipment_document_chunks
    FOR UPDATE
    TO authenticated
    USING (
        auth_user_has_role('admin')
        OR auth_user_has_role('technician')
        OR auth_user_has_role('developer')
        OR auth_user_has_role('bme_head')
    );

CREATE POLICY delete_equipment_document_chunks
    ON equipment_document_chunks
    FOR DELETE
    TO authenticated
    USING (
        auth_user_has_role('admin')
        OR auth_user_has_role('developer')
    );
