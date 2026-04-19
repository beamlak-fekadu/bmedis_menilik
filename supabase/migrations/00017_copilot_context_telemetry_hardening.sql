-- Migration 00017: Copilot context, memory, and telemetry hardening

ALTER TABLE IF EXISTS chat_sessions
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_last_message
  ON chat_sessions (user_id, last_message_at DESC);

CREATE OR REPLACE FUNCTION touch_chat_session_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions
  SET last_message_at = now(),
      updated_at = now()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_messages_touch_session ON chat_messages;
CREATE TRIGGER trg_chat_messages_touch_session
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION touch_chat_session_last_message();

ALTER TABLE IF EXISTS chat_session_memory
  ADD COLUMN IF NOT EXISTS thread_intent TEXT NULL,
  ADD COLUMN IF NOT EXISTS active_capability TEXT NULL;

ALTER TABLE IF EXISTS chat_telemetry_events
  ADD COLUMN IF NOT EXISTS route TEXT NULL,
  ADD COLUMN IF NOT EXISTS grounded_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS parsing_recovery_used BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS classifier_candidates JSONB NULL,
  ADD COLUMN IF NOT EXISTS resolved_entities JSONB NULL,
  ADD COLUMN IF NOT EXISTS latency_ms INTEGER NULL;

CREATE INDEX IF NOT EXISTS idx_chat_telemetry_route_created
  ON chat_telemetry_events (route, created_at DESC);

