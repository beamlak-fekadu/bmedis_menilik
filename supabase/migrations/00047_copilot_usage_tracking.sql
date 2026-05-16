-- Migration 00047: AI copilot app-tracked Gemini usage

ALTER TABLE IF EXISTS chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_answer_basis_check;

ALTER TABLE IF EXISTS chat_messages
  ADD CONSTRAINT chat_messages_answer_basis_check
  CHECK (
    answer_basis IS NULL OR answer_basis IN (
      'system_data',
      'system_capabilities',
      'manual_or_sop',
      'general_safe_guidance',
      'insufficient_data',
      'model_output',
      'format_recovery'
    )
  );

CREATE TABLE IF NOT EXISTS copilot_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID NULL,
  session_id UUID NULL REFERENCES chat_sessions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  capability TEXT NULL,
  role_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  route TEXT NULL,
  prompt_chars INTEGER NOT NULL DEFAULT 0 CHECK (prompt_chars >= 0),
  completion_chars INTEGER NOT NULL DEFAULT 0 CHECK (completion_chars >= 0),
  prompt_tokens INTEGER NULL CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0),
  completion_tokens INTEGER NULL CHECK (completion_tokens IS NULL OR completion_tokens >= 0),
  total_tokens INTEGER NULL CHECK (total_tokens IS NULL OR total_tokens >= 0),
  estimated_tokens INTEGER NULL CHECK (estimated_tokens IS NULL OR estimated_tokens >= 0),
  usage_source TEXT NOT NULL CHECK (usage_source IN ('provider_reported', 'estimated')),
  provider_status TEXT NOT NULL CHECK (provider_status IN ('success', 'fallback', 'failure')),
  fallback_reason TEXT NULL,
  latency_ms INTEGER NULL CHECK (latency_ms IS NULL OR latency_ms >= 0),
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copilot_usage_profile_created
  ON copilot_usage_events (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_copilot_usage_provider_created
  ON copilot_usage_events (provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_copilot_usage_capability_created
  ON copilot_usage_events (capability, created_at DESC);

ALTER TABLE copilot_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_copilot_usage_events ON copilot_usage_events;
CREATE POLICY select_copilot_usage_events ON copilot_usage_events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = copilot_usage_events.profile_id
      AND p.user_id = auth.uid()
  )
  OR auth_user_has_role('developer')
  OR auth_user_has_role('admin')
  OR auth_user_has_role('bme_head')
);

DROP POLICY IF EXISTS insert_own_copilot_usage_events ON copilot_usage_events;
CREATE POLICY insert_own_copilot_usage_events ON copilot_usage_events
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = copilot_usage_events.profile_id
      AND p.user_id = auth.uid()
  )
);
