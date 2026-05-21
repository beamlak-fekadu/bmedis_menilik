import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
function readSource(rel: string): string {
  return readFileSync(path.resolve(repoRoot, rel), 'utf8');
}

test('QR-01: migration adds security events for revoked and invalid scan attempts', () => {
  const migration = readSource('supabase/migrations/00074_qr_security_events.sql');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS qr_security_events/);
  assert.ok(migration.includes("scan_status IN ('invalid', 'not_found', 'revoked', 'auth_required', 'deduped')"));
  assert.match(migration, /asset_id\s+UUID REFERENCES equipment_assets\(id\) ON DELETE SET NULL/);
});

test('QR-01: valid scan writes profile id separately from auth user id', () => {
  const service = readSource('src/services/qr.service.ts');
  assert.match(service, /scanned_by: params\.scannedBy/);
  assert.match(service, /auth_user_id: params\.authUserId/);
  assert.match(service, /scan_status: 'valid'/);
});

test('QR-01: revoked QR route logs security evidence and does not expose asset payload', () => {
  const page = readSource('src/app/qr/a/[token]/page.tsx');
  const idx = page.indexOf("resolution.status === 'revoked'");
  assert.ok(idx > 0);
  const block = page.slice(idx, idx + 3500);
  assert.match(block, /scanStatus: 'revoked'/);
  assert.match(block, /scannerProfileId: profileId/);
  assert.match(block, /authUserId: user\?\.id/);
  assert.match(block, /asset_id: null/);
});

test('QR-01: QR scan evidence report reads normal scans and security events', () => {
  const reports = readSource('src/services/reports.service.ts');
  assert.match(reports, /equipment_qr_scans/);
  assert.match(reports, /qr_security_events/);
  assert.match(reports, /qr_security_event/);
});
