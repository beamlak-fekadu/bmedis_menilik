import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Migration 00066 fix: the FMEA trigger function must use NEW.id (not
// NEW.asset_id) when the source table is equipment_assets. This regression
// test reads the migration file and locks the shape of the function so a
// future edit cannot silently reintroduce the original bug.

const MIGRATION_PATH = join(
  process.cwd(),
  'supabase/migrations/00066_fix_equipment_asset_insert_triggers.sql',
);

test('00066 patches fn_trigger_refresh_fmea_risk_score', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  assert.match(sql, /CREATE OR REPLACE FUNCTION fn_trigger_refresh_fmea_risk_score/);
});

test('00066 uses NEW.id / OLD.id when TG_TABLE_NAME is equipment_assets', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  // The branch must explicitly handle equipment_assets BEFORE the
  // asset_id branch and must use the id column.
  const equipmentBranch = sql.match(
    /TG_TABLE_NAME\s*=\s*'equipment_assets'[\s\S]*?ELSIF/,
  );
  assert.ok(equipmentBranch, 'equipment_assets branch must exist');
  assert.match(equipmentBranch![0], /OLD\.id/);
  assert.match(equipmentBranch![0], /NEW\.id/);
  assert.doesNotMatch(equipmentBranch![0], /NEW\.asset_id/);
  assert.doesNotMatch(equipmentBranch![0], /OLD\.asset_id/);
});

test('00066 keeps NEW.asset_id for the other asset-bearing tables', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  // The second branch (maintenance_events, work_orders, etc.) still uses
  // NEW.asset_id because those tables actually have an asset_id FK.
  assert.match(
    sql,
    /'maintenance_events',\s*'work_orders',\s*'pm_schedules',\s*'calibration_records',\s*'calibration_requests'/,
  );
  assert.match(sql, /NEW\.asset_id/);
});

test('00066 drops the manual hotfix policy and the legacy manage_equipment', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  assert.match(
    sql,
    /DROP POLICY IF EXISTS "Privileged users can insert equipment assets" ON equipment_assets/,
  );
  assert.match(sql, /DROP POLICY IF EXISTS manage_equipment ON equipment_assets/);
});

test('00066 installs the developer/admin/bme_head write policy', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  assert.match(sql, /CREATE POLICY equipment_assets_privileged_write ON equipment_assets/);
  // technician must NOT appear in the new write allowlist.
  const policyBlock = sql.match(
    /CREATE POLICY equipment_assets_privileged_write[\s\S]*?;/,
  );
  assert.ok(policyBlock, 'new write policy block must be present');
  assert.doesNotMatch(policyBlock![0], /auth_user_has_role\('technician'\)/);
  assert.match(policyBlock![0], /auth_user_has_role\('developer'\)/);
  assert.match(policyBlock![0], /auth_user_has_role\('admin'\)/);
  assert.match(policyBlock![0], /auth_user_has_role\('bme_head'\)/);
  // FOR ALL must include WITH CHECK so INSERT row-check matches USING.
  assert.match(policyBlock![0], /WITH CHECK/);
});
