/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Menelik II Hospital Post-Import Validation Script
 *
 * Validates data integrity, FK consistency, and presentation readiness
 * after the Menelik import pipeline has run.
 *
 * Usage: npm run validate:menelik
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const REPORT_PATH = path.resolve(process.cwd(), 'supabase/menelikII-data/validation-report.json');

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  detail: string;
}

async function main() {
  console.log('\nBMEDIS — Menelik II Post-Import Validation');
  console.log('==========================================\n');

  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const checks: CheckResult[] = [];

  // ─── Row Counts ───────────────────────────────────────────────────────

  console.log('📊 Row counts:');
  const tables = [
    'departments', 'equipment_categories', 'manufacturers', 'equipment_models',
    'equipment_assets', 'maintenance_requests', 'work_orders', 'maintenance_events',
    'downtime_logs', 'pm_plans', 'pm_schedules', 'pm_completions',
    'calibration_records', 'calibration_requests',
    'training_sessions', 'staff_training_records', 'equipment_training_records',
    'profiles', 'roles', 'user_roles',
    'equipment_reliability_metrics', 'equipment_risk_scores',
    'pm_compliance_metrics', 'replacement_priority_scores',
    'spare_parts', 'stock_receipts', 'stock_issues',
  ];

  const counts: Record<string, number> = {};
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    counts[table] = error ? -1 : (count || 0);
    const status = error ? '❌' : (count && count > 0 ? '✅' : '⬚');
    console.log(`  ${status} ${table}: ${error ? `error: ${error.message}` : count}`);
  }

  // ─── Presentation Readiness ───────────────────────────────────────────

  console.log('\n📋 Presentation readiness checks:');

  // Equipment count
  const eqCount = counts['equipment_assets'] || 0;
  checks.push({
    name: 'Equipment assets >= 160',
    status: eqCount >= 160 ? 'pass' : 'fail',
    detail: `${eqCount} equipment assets`,
  });
  console.log(`  ${eqCount >= 160 ? '✅' : '❌'} Equipment assets: ${eqCount} (target: >= 160)`);

  // Department count with equipment
  const { data: deptEquip } = await supabase
    .from('equipment_assets')
    .select('department_id')
    .is('deleted_at', null);
  const uniqueDepts = new Set((deptEquip || []).map((e: any) => e.department_id));
  checks.push({
    name: 'Departments with equipment >= 10',
    status: uniqueDepts.size >= 10 ? 'pass' : uniqueDepts.size >= 5 ? 'warn' : 'fail',
    detail: `${uniqueDepts.size} departments have equipment`,
  });
  console.log(`  ${uniqueDepts.size >= 10 ? '✅' : '⚠️'} Departments with equipment: ${uniqueDepts.size} (target: >= 10)`);

  // Condition variety
  const { data: condData } = await supabase
    .from('equipment_assets')
    .select('condition')
    .is('deleted_at', null);
  const conditions = new Set((condData || []).map((e: any) => e.condition));
  checks.push({
    name: 'Condition variety >= 2',
    status: conditions.size >= 2 ? 'pass' : 'warn',
    detail: `Conditions found: ${[...conditions].join(', ')}`,
  });
  console.log(`  ${conditions.size >= 2 ? '✅' : '⚠️'} Condition variety: ${[...conditions].join(', ')}`);

  // Work orders
  const woCount = counts['work_orders'] || 0;
  checks.push({
    name: 'Work orders >= 10',
    status: woCount >= 10 ? 'pass' : woCount >= 5 ? 'warn' : 'fail',
    detail: `${woCount} work orders`,
  });
  console.log(`  ${woCount >= 10 ? '✅' : '⚠️'} Work orders: ${woCount} (target: >= 10)`);

  // PM evidence
  const pmCount = (counts['pm_schedules'] || 0);
  checks.push({
    name: 'PM/PV evidence rows >= 10',
    status: pmCount >= 10 ? 'pass' : pmCount >= 5 ? 'warn' : 'fail',
    detail: `${pmCount} PM schedule/evidence rows`,
  });
  console.log(`  ${pmCount >= 10 ? '✅' : '⚠️'} PM/PV evidence: ${pmCount} (target: >= 10)`);

  // Training
  const trCount = counts['training_sessions'] || 0;
  checks.push({
    name: 'Training sessions >= 10',
    status: trCount >= 10 ? 'pass' : trCount >= 5 ? 'warn' : 'fail',
    detail: `${trCount} training sessions`,
  });
  console.log(`  ${trCount >= 10 ? '✅' : '⚠️'} Training sessions: ${trCount} (target: >= 10)`);

  // ─── Data Integrity ───────────────────────────────────────────────────

  console.log('\n🔍 Data integrity checks:');

  // Equipment FK: department_id
  const { data: orphanDepts } = await supabase
    .from('equipment_assets')
    .select('id, department_id')
    .is('deleted_at', null);
  const { data: allDepts } = await supabase.from('departments').select('id');
  const deptIds = new Set((allDepts || []).map((d: any) => d.id));
  const orphanedDeptAssets = (orphanDepts || []).filter((e: any) => !deptIds.has(e.department_id));
  checks.push({
    name: 'No orphaned department FK',
    status: orphanedDeptAssets.length === 0 ? 'pass' : 'fail',
    detail: `${orphanedDeptAssets.length} assets with invalid department_id`,
  });
  console.log(`  ${orphanedDeptAssets.length === 0 ? '✅' : '❌'} Orphaned department FK: ${orphanedDeptAssets.length}`);

  // Equipment FK: category_id
  const { data: orphanCats } = await supabase
    .from('equipment_assets')
    .select('id, category_id')
    .is('deleted_at', null);
  const { data: allCats } = await supabase.from('equipment_categories').select('id');
  const catIds = new Set((allCats || []).map((c: any) => c.id));
  const orphanedCatAssets = (orphanCats || []).filter((e: any) => !catIds.has(e.category_id));
  checks.push({
    name: 'No orphaned category FK',
    status: orphanedCatAssets.length === 0 ? 'pass' : 'fail',
    detail: `${orphanedCatAssets.length} assets with invalid category_id`,
  });
  console.log(`  ${orphanedCatAssets.length === 0 ? '✅' : '❌'} Orphaned category FK: ${orphanedCatAssets.length}`);

  // Profile department_id valid
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, department_id, email')
    .not('department_id', 'is', null);
  const invalidProfileDepts = (profiles || []).filter((p: any) => !deptIds.has(p.department_id));
  checks.push({
    name: 'Profile department_id valid',
    status: invalidProfileDepts.length === 0 ? 'pass' : 'warn',
    detail: invalidProfileDepts.length === 0
      ? 'All profile department_ids are valid'
      : `${invalidProfileDepts.length} profiles with invalid department_id: ${invalidProfileDepts.map((p: any) => p.email).join(', ')}`,
  });
  console.log(`  ${invalidProfileDepts.length === 0 ? '✅' : '⚠️'} Profile department FK: ${invalidProfileDepts.length} invalid`);

  // Condition CHECK constraint
  const { data: badCondition } = await supabase
    .from('equipment_assets')
    .select('id, condition')
    .is('deleted_at', null)
    .not('condition', 'in', '(functional,needs_repair,non_functional,under_maintenance,decommissioned)');
  checks.push({
    name: 'Condition values valid',
    status: (badCondition || []).length === 0 ? 'pass' : 'fail',
    detail: `${(badCondition || []).length} assets with invalid condition`,
  });
  console.log(`  ${(badCondition || []).length === 0 ? '✅' : '❌'} Invalid condition values: ${(badCondition || []).length}`);

  // Source tag check
  const { data: sourceAssets } = await supabase
    .from('equipment_assets')
    .select('id, source')
    .is('deleted_at', null)
    .eq('source', 'menelik_ii_2018ec_import');
  const sourceCount = (sourceAssets || []).length;
  checks.push({
    name: 'Source-tagged assets',
    status: sourceCount > 0 ? 'pass' : 'warn',
    detail: `${sourceCount} assets tagged with source='menelik_ii_2018ec_import'`,
  });
  console.log(`  ${sourceCount > 0 ? '✅' : '⚠️'} Source-tagged assets: ${sourceCount}`);

  // Duplicate asset codes
  const { data: allAssets } = await supabase
    .from('equipment_assets')
    .select('asset_code')
    .is('deleted_at', null);
  const codeCounts: Record<string, number> = {};
  (allAssets || []).forEach((a: any) => {
    codeCounts[a.asset_code] = (codeCounts[a.asset_code] || 0) + 1;
  });
  const dupes = Object.entries(codeCounts).filter(([, c]) => c > 1);
  checks.push({
    name: 'No duplicate asset codes',
    status: dupes.length === 0 ? 'pass' : 'fail',
    detail: dupes.length === 0 ? 'No duplicates' : `${dupes.length} duplicate codes: ${dupes.map(([k]) => k).join(', ')}`,
  });
  console.log(`  ${dupes.length === 0 ? '✅' : '❌'} Duplicate asset codes: ${dupes.length}`);

  // ─── Verdict ──────────────────────────────────────────────────────────

  const failures = checks.filter((c) => c.status === 'fail');
  const warnings = checks.filter((c) => c.status === 'warn');
  const passes = checks.filter((c) => c.status === 'pass');
  const presentationReady = failures.length === 0 && eqCount >= 100;

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  VERDICT: ${presentationReady ? '✅ PRESENTATION READY' : '❌ NOT READY'}`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`  Passed: ${passes.length}  |  Warnings: ${warnings.length}  |  Failed: ${failures.length}`);

  if (failures.length > 0) {
    console.log('\n  Failures:');
    failures.forEach((f) => console.log(`    ❌ ${f.name}: ${f.detail}`));
  }
  if (warnings.length > 0) {
    console.log('\n  Warnings:');
    warnings.forEach((w) => console.log(`    ⚠️  ${w.name}: ${w.detail}`));
  }

  const validationReport = {
    validatedAt: new Date().toISOString(),
    supabaseUrl: SUPABASE_URL,
    presentationReady,
    checks,
    counts,
    summary: {
      passed: passes.length,
      warnings: warnings.length,
      failed: failures.length,
    },
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(validationReport, null, 2));
  console.log(`\nValidation report: ${REPORT_PATH}`);
}

main().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});
