-- Migration 00074: QR security scan evidence
--
-- equipment_qr_scans remains the asset-linked evidence table for valid
-- authenticated scans. Revoked, invalid, unknown-token, auth-required, and
-- deduped attempts are security evidence and can be recorded without leaking
-- asset details to the public QR route.

ALTER TABLE equipment_qr_scans
  ADD COLUMN IF NOT EXISTS scan_status TEXT NOT NULL DEFAULT 'valid',
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS deduped_from_scan_id UUID REFERENCES equipment_qr_scans(id) ON DELETE SET NULL;

ALTER TABLE equipment_qr_scans
  DROP CONSTRAINT IF EXISTS equipment_qr_scans_scan_status_check;

ALTER TABLE equipment_qr_scans
  ADD CONSTRAINT equipment_qr_scans_scan_status_check
  CHECK (scan_status IN ('valid', 'deduped'));

CREATE INDEX IF NOT EXISTS idx_equipment_qr_scans_scan_status
  ON equipment_qr_scans(scan_status);

CREATE TABLE IF NOT EXISTS qr_security_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash          TEXT NOT NULL,
  masked_token        TEXT NOT NULL,
  scan_status         TEXT NOT NULL,
  asset_id            UUID REFERENCES equipment_assets(id) ON DELETE SET NULL,
  scanner_profile_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  auth_user_id        UUID,
  role_name           TEXT,
  scan_source         TEXT NOT NULL DEFAULT 'web',
  online_status       TEXT NOT NULL DEFAULT 'online',
  user_agent          TEXT,
  ip_address          INET,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qr_security_events_scan_status_check
    CHECK (scan_status IN ('invalid', 'not_found', 'revoked', 'auth_required', 'deduped')),
  CONSTRAINT qr_security_events_scan_source_check
    CHECK (scan_source IN ('web', 'mobile', 'pwa', 'unknown')),
  CONSTRAINT qr_security_events_online_status_check
    CHECK (online_status IN ('online', 'offline_queued', 'synced_later', 'unknown'))
);

CREATE INDEX IF NOT EXISTS idx_qr_security_events_token_hash
  ON qr_security_events(token_hash);
CREATE INDEX IF NOT EXISTS idx_qr_security_events_asset
  ON qr_security_events(asset_id)
  WHERE asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qr_security_events_scanner
  ON qr_security_events(scanner_profile_id)
  WHERE scanner_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qr_security_events_status_created
  ON qr_security_events(scan_status, created_at DESC);

ALTER TABLE qr_security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qr_security_events_select ON qr_security_events;
CREATE POLICY qr_security_events_select
  ON qr_security_events
  FOR SELECT
  TO authenticated
  USING (
    auth_user_has_role('developer')
    OR auth_user_has_role('admin')
    OR auth_user_has_role('bme_head')
    OR scanner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS qr_security_events_anon_insert ON qr_security_events;
CREATE POLICY qr_security_events_anon_insert
  ON qr_security_events
  FOR INSERT
  TO anon
  WITH CHECK (
    asset_id IS NULL
    AND scanner_profile_id IS NULL
    AND auth_user_id IS NULL
  );

DROP POLICY IF EXISTS qr_security_events_authenticated_insert ON qr_security_events;
CREATE POLICY qr_security_events_authenticated_insert
  ON qr_security_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON TABLE qr_security_events IS
  'Security/audit evidence for QR scan attempts that are not normal valid asset scans: invalid, not_found, revoked, auth_required, and deduped attempts. Public-facing QR pages never display asset details from this table.';
