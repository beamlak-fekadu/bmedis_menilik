-- Migration 00015: Safe chatbot persistence tables + RLS

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  equipment_id UUID NULL REFERENCES equipment_assets(id) ON DELETE SET NULL,
  work_order_id UUID NULL REFERENCES work_orders(id) ON DELETE SET NULL,
  department_id UUID NULL REFERENCES departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  intent TEXT NULL,
  decision TEXT NULL CHECK (decision IN ('answer', 'limited_answer', 'check_manual', 'escalate', 'refuse')),
  answer_basis TEXT NULL CHECK (answer_basis IN ('system_data', 'manual_or_sop', 'general_safe_guidance', 'insufficient_data')),
  confidence TEXT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_created_at
  ON chat_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created_at
  ON chat_messages (session_id, created_at);

CREATE OR REPLACE FUNCTION set_chat_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER trg_chat_sessions_updated_at
BEFORE UPDATE ON chat_sessions
FOR EACH ROW
EXECUTE FUNCTION set_chat_sessions_updated_at();

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat sessions ownership and admin visibility
CREATE POLICY select_own_chat_sessions ON chat_sessions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = chat_sessions.user_id
      AND p.user_id = auth.uid()
  )
  OR auth_user_has_role('admin')
);

CREATE POLICY insert_own_chat_sessions ON chat_sessions
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = chat_sessions.user_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY update_own_chat_sessions ON chat_sessions
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = chat_sessions.user_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY delete_own_chat_sessions ON chat_sessions
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = chat_sessions.user_id
      AND p.user_id = auth.uid()
  )
  OR auth_user_has_role('admin')
);

-- Chat messages ownership through session ownership; admin can read all
CREATE POLICY select_own_chat_messages ON chat_messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM chat_sessions cs
    JOIN profiles p ON p.id = cs.user_id
    WHERE cs.id = chat_messages.session_id
      AND p.user_id = auth.uid()
  )
  OR auth_user_has_role('admin')
);

CREATE POLICY insert_own_chat_messages ON chat_messages
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM chat_sessions cs
    JOIN profiles p ON p.id = cs.user_id
    WHERE cs.id = chat_messages.session_id
      AND p.user_id = auth.uid()
  )
);
