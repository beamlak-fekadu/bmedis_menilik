/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Menelik II Hospital Data Import Script
 *
 * Imports real hospital data from the Excel workbook into Supabase.
 * Supports --dry-run mode for preview without DB writes.
 *
 * Usage:
 *   npm run import:menelik:dry-run   (preview only)
 *   npm run import:menelik           (live import)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import ExcelJS from 'exceljs';

// ─── Config ───────────────────────────────────────────────────────────────────

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '\n❌  Missing required environment variables.\n' +
      '    Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local\n'
  );
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const WORKBOOK_PATH = path.resolve(
  process.cwd(),
  'supabase/menelikII-data/Menelik_II_Medical_Equipment_Management.xlsx'
);
const NORMALIZED_DIR = path.resolve(process.cwd(), 'supabase/menelikII-data/normalized');
const REPORT_DIR = path.resolve(process.cwd(), 'supabase/menelikII-data');

const HEADER_ROW = 3;
const DATA_START_ROW = 4;
const SOURCE_TAG = 'menelik_ii_2018ec_import';
const BATCH_SIZE = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deterministicUuid(namespace: string, key: string): string {
  const hash = crypto
    .createHash('md5')
    .update(`${namespace}:${key}`)
    .digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');
}

function getCellString(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object' && 'richText' in cell.value) {
    return (cell.value as ExcelJS.CellRichTextValue).richText
      .map((rt) => rt.text)
      .join('');
  }
  return String(cell.value).trim();
}

function parseDate(raw: string): string | null {
  if (!raw || raw === '—' || raw === '-') return null;
  const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    const year = parseInt(yyyy);
    if (year >= 2000 && year <= 2030) {
      return `${yyyy}-${mm}-${dd}`;
    }
    return null; // likely EC or ambiguous
  }
  if (/E\.C\./.test(raw) || /^\d{4}\s/.test(raw)) return null; // EC date
  return null;
}

// ─── Department Mapping ───────────────────────────────────────────────────────

const DEPARTMENT_GROUPING: Record<string, string> = {
  'adult emergency': 'Emergency Department',
  'pediatric emergency': 'Emergency Department',
  'central triage': 'Emergency Department',
  'eye or': 'Eye Department',
  'eye opd': 'Eye Department',
  'eye emergency': 'Eye Department',
  'eey emergency': 'Eye Department',
  'biometry room(eye opd)': 'Eye Department',
  'gelacoma': 'Eye Department',
  'laboratory': 'Laboratory',
  'microbiology': 'Laboratory',
  'pathology': 'Laboratory',
  'art lab': 'Laboratory',
  'lab,emergency': 'Laboratory',
  'blood bank': 'Laboratory',
  'major or': 'Operating Theater',
  'gyni or': 'Operating Theater',
  'icu': 'ICU',
  'nicu': 'NICU',
  'imaging': 'Radiology and Imaging',
  'delivery room': 'Maternal and Child Health',
  'family planning': 'Maternal and Child Health',
  'abortion(family planning)': 'Maternal and Child Health',
  'dialysis center': 'Dialysis Center',
  'central steralization': 'Central Sterilization',
  'compound pharmacy': 'Pharmacy',
  'dental room': 'Specialty OPD',
  'ent': 'Specialty OPD',
  'orthopedic out patient': 'Specialty OPD',
  'dermathology': 'Specialty OPD',
  '3rd floor': 'Inpatient Ward',
  'medical refral': 'Inpatient Ward',
};

function normalizeDepartment(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (DEPARTMENT_GROUPING[lower]) return DEPARTMENT_GROUPING[lower];
  // Fuzzy matches for case variants
  for (const [key, dept] of Object.entries(DEPARTMENT_GROUPING)) {
    if (lower.includes(key) || key.includes(lower)) return dept;
  }
  return 'Inpatient Ward'; // fallback
}

// ─── Department definitions ───────────────────────────────────────────────────

const MENELIK_DEPARTMENTS = [
  { name: 'Emergency Department', code: 'ED', description: 'Emergency and trauma care services including adult, pediatric, and triage' },
  { name: 'Eye Department', code: 'EYE', description: 'Ophthalmology services including OR, OPD, emergency, biometry, and glaucoma' },
  { name: 'Laboratory', code: 'LAB', description: 'Clinical laboratory, microbiology, pathology, ART lab, and blood bank' },
  { name: 'Operating Theater', code: 'OT', description: 'Major surgical suites and gynecology OR' },
  { name: 'ICU', code: 'ICU', description: 'Intensive care unit for critically ill patients' },
  { name: 'NICU', code: 'NICU', description: 'Neonatal intensive care unit' },
  { name: 'Radiology and Imaging', code: 'RAD', description: 'Diagnostic imaging services' },
  { name: 'Maternal and Child Health', code: 'MCH', description: 'Delivery, family planning, and maternal services' },
  { name: 'Dialysis Center', code: 'DIA', description: 'Renal dialysis services' },
  { name: 'Central Sterilization', code: 'CSSD', description: 'Central sterilization supply department' },
  { name: 'Pharmacy', code: 'PHARM', description: 'Pharmaceutical services' },
  { name: 'Specialty OPD', code: 'SOPD', description: 'Dental, ENT, orthopedic, and dermatology outpatient services' },
  { name: 'Inpatient Ward', code: 'IPW', description: 'General inpatient wards' },
];

// Existing demo departments that may overlap
const EXISTING_DEPT_NAMES: Record<string, string> = {
  'Intensive Care Unit': 'd0000001-0000-0000-0000-000000000001',
  'Operating Theater': 'd0000001-0000-0000-0000-000000000002',
  'Emergency Department': 'd0000001-0000-0000-0000-000000000003',
  'Radiology and Imaging': 'd0000001-0000-0000-0000-000000000004',
  'Laboratory': 'd0000001-0000-0000-0000-000000000005',
  'Pharmacy': 'd0000001-0000-0000-0000-000000000006',
  'Inpatient Ward': 'd0000001-0000-0000-0000-000000000007',
  'Outpatient Clinic': 'd0000001-0000-0000-0000-000000000008',
};

function getDepartmentId(name: string): string {
  // Reuse existing IDs for overlapping departments
  if (name === 'ICU') return EXISTING_DEPT_NAMES['Intensive Care Unit'];
  if (EXISTING_DEPT_NAMES[name]) return EXISTING_DEPT_NAMES[name];
  return deterministicUuid('dept', name);
}

// ─── Category Mapping ─────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, { name: string; code: string; criticality: string }> = {
  'patient monitoring': { name: 'Patient Monitoring', code: 'MON', criticality: 'critical' },
  'life support & respiratory': { name: 'Respiratory and Ventilation', code: 'RESP', criticality: 'critical' },
  'vital signs & diagnostic': { name: 'Vital Signs and Diagnostic', code: 'VSD', criticality: 'high' },
  'surgery & theatre': { name: 'Surgical Equipment', code: 'SURG', criticality: 'high' },
  'diagnostic imaging': { name: 'Diagnostic Imaging', code: 'IMG', criticality: 'high' },
  'laboratory equipment': { name: 'Laboratory Equipment', code: 'LBEQ', criticality: 'high' },
  'sterilization equipment': { name: 'Sterilization Equipment', code: 'STER', criticality: 'high' },
  'ophthalmology': { name: 'Ophthalmology Equipment', code: 'OPH', criticality: 'high' },
  'neonatology': { name: 'Neonatology Equipment', code: 'NEO', criticality: 'critical' },
  'dental equipment': { name: 'Dental Equipment', code: 'DENT', criticality: 'medium' },
  'renal dialysis': { name: 'Renal Dialysis Equipment', code: 'RDI', criticality: 'critical' },
  'physiotherapy & rehabilitation': { name: 'Physiotherapy Equipment', code: 'PHYS', criticality: 'low' },
  'ent equipment': { name: 'ENT Equipment', code: 'ENT', criticality: 'medium' },
};

const EXISTING_CATEGORIES: Record<string, string> = {
  'Patient Monitoring': 'c0000001-0000-0000-0000-000000000001',
  'Surgical Equipment': 'c0000001-0000-0000-0000-000000000003',
  'Diagnostic Imaging': 'c0000001-0000-0000-0000-000000000004',
  'Laboratory Equipment': 'c0000001-0000-0000-0000-000000000005',
  'Sterilization Equipment': 'c0000001-0000-0000-0000-000000000006',
  'Respiratory and Ventilation': 'c0000001-0000-0000-0000-000000000008',
  'Dental Equipment': 'c0000001-0000-0000-0000-000000000010',
  'Physiotherapy Equipment': 'c0000001-0000-0000-0000-000000000011',
};

function getCategoryInfo(raw: string): { id: string; name: string; code: string; criticality: string } {
  const lower = raw.toLowerCase().trim();
  const mapped = CATEGORY_MAP[lower];
  if (!mapped) {
    return {
      id: deterministicUuid('cat', 'General Biomedical Equipment'),
      name: 'General Biomedical Equipment',
      code: 'GEN',
      criticality: 'medium',
    };
  }
  const existingId = EXISTING_CATEGORIES[mapped.name];
  return {
    id: existingId || deterministicUuid('cat', mapped.name),
    ...mapped,
  };
}

// ─── Manufacturer Identification ──────────────────────────────────────────────

const KNOWN_MANUFACTURERS: Record<string, string> = {
  'rossmax': 'Rossmax',
  'riester': 'Riester',
  'helmer': 'Helmer',
  'cepheid': 'Cepheid',
  'sakura': 'Sakura',
  'yuyue': 'Yuyue',
  'yuye': 'Yuyue',
  'fazzini': 'Fazzini',
  'gima': 'Gima',
  'keeler': 'Keeler',
  'tuttnauer': 'Tuttnauer',
  'stryker': 'Stryker',
  'stryeker': 'Stryker',
  'cisa': 'CISA',
};

function identifyManufacturer(raw: string): string | null {
  if (!raw || raw === '—' || raw === '-') return null;
  const lower = raw.toLowerCase().trim();
  for (const [key, name] of Object.entries(KNOWN_MANUFACTURERS)) {
    if (lower === key || lower.includes(key)) return name;
  }
  return null;
}

// ─── Condition / Status Mapping ───────────────────────────────────────────────

const VALID_CONDITIONS = ['functional', 'needs_repair', 'non_functional', 'under_maintenance', 'decommissioned'];
const VALID_STATUSES = ['active', 'inactive', 'disposed', 'in_storage'];

function mapCondition(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (lower === 'functional' || lower === 'working' || lower === 'good') return 'functional';
  if (lower === 'non-functional' || lower === 'non functional' || lower === 'broken') return 'non_functional';
  if (lower === 'to be disposed') return 'decommissioned';
  if (lower === 'under maintenance') return 'under_maintenance';
  return 'functional'; // safe default
}

function mapStatus(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (lower === 'to be disposed') return 'inactive';
  return 'active';
}

// ─── Import Report ────────────────────────────────────────────────────────────

interface ImportReport {
  mode: string;
  startedAt: string;
  completedAt: string;
  preImportSnapshot: Record<string, number>;
  imported: Record<string, number>;
  skipped: { sheet: string; row: number; reason: string }[];
  warnings: string[];
  assetMatching: { matched: number; unmatched: number; details: string[] };
  analyticsRefresh: string;
  limitations: string[];
}

const report: ImportReport = {
  mode: DRY_RUN ? 'dry-run' : 'live',
  startedAt: new Date().toISOString(),
  completedAt: '',
  preImportSnapshot: {},
  imported: {},
  skipped: [],
  warnings: [],
  assetMatching: { matched: 0, unmatched: 0, details: [] },
  analyticsRefresh: 'not attempted',
  limitations: [],
};

// ─── Main Import Logic ────────────────────────────────────────────────────────

async function countTable(supabase: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) return -1;
  return count || 0;
}

async function clearTable(supabase: SupabaseClient, table: string): Promise<boolean> {
  const count = await countTable(supabase, table);
  if (count === 0) {
    console.log(`  ${table}: already empty, skipping`);
    return true;
  }
  console.log(`  ${table}: clearing ${count} rows...`);
  const { error } = await supabase.from(table).delete().gte('created_at', '1900-01-01');
  if (error) {
    // Try alternative delete pattern
    const { error: err2 } = await supabase.from(table).delete().not('id', 'is', null);
    if (err2) {
      console.error(`    ❌ Failed to clear ${table}: ${err2.message}`);
      return false;
    }
  }
  return true;
}

async function preImportSnapshot(supabase: SupabaseClient): Promise<Record<string, number>> {
  const tables = [
    'equipment_assets', 'maintenance_requests', 'work_orders', 'maintenance_events',
    'downtime_logs', 'pm_plans', 'pm_schedules', 'pm_completions',
    'calibration_records', 'calibration_requests', 'training_sessions',
    'staff_training_records', 'equipment_training_records',
    'equipment_reliability_metrics', 'equipment_risk_scores',
    'pm_compliance_metrics', 'replacement_priority_scores',
    'spare_parts', 'stock_receipts', 'stock_issues',
  ];
  const snapshot: Record<string, number> = {};
  for (const t of tables) {
    snapshot[t] = await countTable(supabase, t);
  }
  return snapshot;
}

async function clearOperationalData(supabase: SupabaseClient): Promise<boolean> {
  console.log('\n📋 Clearing operational data...\n');

  const clearOrder = [
    // Phase 1: Analytics
    'equipment_performance_scores', 'replacement_priority_scores',
    'pm_compliance_metrics', 'equipment_reliability_metrics',
    'equipment_risk_scores', 'recommendation_flags',
    'equipment_health_snapshots', 'clinical_readiness_snapshots',
    'triage_action_queue', 'workload_capacity_snapshots',
    'command_center_acknowledgements',
    // Phase 2: Notifications/chat/sync
    'notification_deliveries', 'notification_rule_logs', 'notifications',
    'notification_events', 'copilot_usage_events', 'chat_messages',
    'chat_sessions', 'offline_sync_events', 'equipment_qr_scans',
    // Phase 3: Training/calibration/disposal
    'equipment_training_records', 'staff_training_records',
    'training_sessions', 'training_requests',
    'calibration_certificates', 'calibration_records', 'calibration_requests',
    'specification_requests', 'installation_requests', 'installation_records',
    'disposed_assets', 'disposal_requests',
    // Phase 4: PM
    'pm_completions', 'pm_schedules', 'pm_plans',
    // Phase 5: Maintenance
    'maintenance_parts_used', 'work_order_parts_needed',
    'downtime_logs', 'maintenance_events',
    'work_orders', 'maintenance_requests',
    // Phase 6: Logistics
    'stock_issues', 'stock_receipts', 'procurement_requests', 'spare_parts',
    // Phase 7: Asset supporting
    'equipment_documents',
    // Phase 8: Assets
    'equipment_assets',
  ];

  for (const table of clearOrder) {
    const ok = await clearTable(supabase, table);
    if (!ok) {
      console.error(`\n❌ Clearing failed at ${table}. Stopping.`);
      return false;
    }
  }

  console.log('\n✅ Operational data cleared successfully.');
  return true;
}

async function upsertDepartments(supabase: SupabaseClient): Promise<Map<string, string>> {
  const deptMap = new Map<string, string>();

  for (const dept of MENELIK_DEPARTMENTS) {
    const id = getDepartmentId(dept.name);
    deptMap.set(dept.name, id);

    if (!DRY_RUN) {
      const { error } = await supabase
        .from('departments')
        .upsert({
          id,
          name: dept.name,
          code: dept.code,
          description: dept.description,
          is_active: true,
        }, { onConflict: 'name' });
      if (error) {
        // Try insert if upsert on name fails
        const { error: err2 } = await supabase
          .from('departments')
          .upsert({
            id,
            name: dept.name,
            code: dept.code,
            description: dept.description,
            is_active: true,
          }, { onConflict: 'id' });
        if (err2) console.warn(`  ⚠️  Department upsert failed for ${dept.name}: ${err2.message}`);
      }
    }
  }

  console.log(`  Departments: ${deptMap.size} configured`);
  return deptMap;
}

async function upsertCategories(
  supabase: SupabaseClient,
  workbookCategories: Set<string>
): Promise<Map<string, string>> {
  const catMap = new Map<string, string>();

  for (const raw of workbookCategories) {
    const info = getCategoryInfo(raw);
    catMap.set(raw, info.id);

    if (!DRY_RUN) {
      const { error } = await supabase
        .from('equipment_categories')
        .upsert({
          id: info.id,
          name: info.name,
          code: info.code,
          description: `WHO category: ${raw}`,
          criticality_level: info.criticality,
        }, { onConflict: 'id' });
      if (error) console.warn(`  ⚠️  Category upsert failed for ${info.name}: ${error.message}`);
    }
  }

  console.log(`  Categories: ${catMap.size} configured`);
  return catMap;
}

async function upsertManufacturers(
  supabase: SupabaseClient,
  mfrNames: Set<string>
): Promise<Map<string, string>> {
  const mfrMap = new Map<string, string>();

  for (const name of mfrNames) {
    if (!name) continue;
    const id = deterministicUuid('mfr', name);
    mfrMap.set(name, id);

    if (!DRY_RUN) {
      const { error } = await supabase
        .from('manufacturers')
        .upsert({
          id,
          name,
          is_active: true,
        }, { onConflict: 'id' });
      if (error) console.warn(`  ⚠️  Manufacturer upsert failed for ${name}: ${error.message}`);
    }
  }

  console.log(`  Manufacturers: ${mfrMap.size} configured`);
  return mfrMap;
}

async function importEquipment(
  supabase: SupabaseClient,
  ws: ExcelJS.Worksheet,
  deptMap: Map<string, string>,
  catMap: Map<string, string>,
  mfrMap: Map<string, string>
): Promise<Map<string, string>> {
  const assetMap = new Map<string, string>(); // serial/name → asset_id
  const assets: any[] = [];
  const usedCodes = new Set<string>();

  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = getCellString(row.getCell(3));
    if (!name) {
      report.skipped.push({ sheet: 'Equipment Inventory', row: r, reason: 'No equipment name' });
      continue;
    }

    const invNumber = getCellString(row.getCell(2));
    const whoCategory = getCellString(row.getCell(4));
    const originalName = getCellString(row.getCell(5));
    const rawDept = getCellString(row.getCell(6));
    const rawMfr = getCellString(row.getCell(7));
    const rawModel = getCellString(row.getCell(8));
    const serialNumber = getCellString(row.getCell(9));
    const rawStatus = getCellString(row.getCell(10));

    // Generate unique asset_code
    let assetCode = invNumber || `MNK-${String(r - DATA_START_ROW + 1).padStart(4, '0')}`;
    if (usedCodes.has(assetCode)) {
      assetCode = `${assetCode}-R${r}`;
    }
    usedCodes.add(assetCode);

    // Map references
    const deptName = normalizeDepartment(rawDept);
    const deptId = deptMap.get(deptName);
    const catInfo = getCategoryInfo(whoCategory);
    const mfrName = identifyManufacturer(rawMfr);
    const mfrId = mfrName ? mfrMap.get(mfrName) : null;

    const condition = mapCondition(rawStatus || 'Functional');
    const status = mapStatus(rawStatus || 'Functional');

    if (!VALID_CONDITIONS.includes(condition)) {
      report.warnings.push(`Row ${r}: condition '${condition}' not in schema CHECK`);
    }
    if (!VALID_STATUSES.includes(status)) {
      report.warnings.push(`Row ${r}: status '${status}' not in schema CHECK`);
    }

    const notes = [
      `Imported from Menelik II Hospital records (2018 E.C. inventory).`,
      originalName ? `Original name: ${originalName}.` : null,
      rawDept ? `Source ward: ${rawDept}.` : null,
      rawMfr && !mfrName ? `Original manufacturer/brand value: ${rawMfr}.` : null,
      rawModel ? `Model info: ${rawModel}.` : null,
    ]
      .filter(Boolean)
      .join(' ');

    const id = crypto.randomUUID();
    const asset = {
      id,
      asset_code: assetCode,
      name,
      category_id: catInfo.id,
      department_id: deptId,
      manufacturer_id: mfrId || null,
      serial_number: serialNumber && serialNumber !== '—' ? serialNumber : null,
      condition,
      status,
      source: SOURCE_TAG,
      notes,
    };

    assets.push(asset);

    // Build lookup maps for matching work orders later
    if (serialNumber && serialNumber !== '—') {
      assetMap.set(`serial:${serialNumber}`, id);
    }
    assetMap.set(`name:${name.toLowerCase()}:${deptName.toLowerCase()}`, id);
    // Also store name-only for fuzzy matching (first match wins for a given name)
    const nameKey = `nameonly:${name.toLowerCase()}`;
    if (!assetMap.has(nameKey)) assetMap.set(nameKey, id);
    assetMap.set(`row:${r}`, id);
  }

  // Write normalized JSON
  fs.writeFileSync(
    path.join(NORMALIZED_DIR, 'equipment-assets.json'),
    JSON.stringify(assets, null, 2)
  );

  if (!DRY_RUN) {
    console.log(`  Inserting ${assets.length} equipment assets...`);
    for (let i = 0; i < assets.length; i += BATCH_SIZE) {
      const batch = assets.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('equipment_assets').insert(batch);
      if (error) {
        console.error(`    ❌ Batch ${i / BATCH_SIZE + 1} failed: ${error.message}`);
        report.warnings.push(`Asset batch ${i / BATCH_SIZE + 1} failed: ${error.message}`);
      }
    }
  }

  report.imported['equipment_assets'] = assets.length;
  console.log(`  Equipment assets: ${assets.length} imported`);
  return assetMap;
}

async function importWorkOrders(
  supabase: SupabaseClient,
  ws: ExcelJS.Worksheet,
  assetMap: Map<string, string>,
  deptMap: Map<string, string>
): Promise<void> {
  // Find technician profile for assigned_to
  let technicianProfileId: string | null = null;
  if (!DRY_RUN) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'technician@bmerms-demo.local')
      .maybeSingle();
    technicianProfileId = data?.id || null;
  }

  const requests: any[] = [];
  const workOrders: any[] = [];

  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const woNum = getCellString(row.getCell(1));
    if (!woNum || !woNum.startsWith('WO-')) {
      report.skipped.push({ sheet: 'Work Orders', row: r, reason: 'No WO number' });
      continue;
    }

    const equipName = getCellString(row.getCell(2));
    const model = getCellString(row.getCell(3));
    const serial = getCellString(row.getCell(4));
    const dept = getCellString(row.getCell(5));
    const location = getCellString(row.getCell(6));
    const reportedTime = getCellString(row.getCell(7));
    const issueDesc = getCellString(row.getCell(8));
    const critical = getCellString(row.getCell(9));
    const usabilityImpact = getCellString(row.getCell(10));
    const corrAction = getCellString(row.getCell(11));
    const postResult = getCellString(row.getCell(12));
    const completedBy = getCellString(row.getCell(13));
    const completionDate = getCellString(row.getCell(14));
    const approvedBy = getCellString(row.getCell(15));

    // Match to asset: serial → exact name+dept → name-only → fuzzy partial name
    let assetId: string | null = null;
    if (serial && serial !== '—') {
      assetId = assetMap.get(`serial:${serial}`) || null;
    }
    if (!assetId && equipName && dept) {
      const deptName = normalizeDepartment(dept);
      assetId = assetMap.get(`name:${equipName.toLowerCase()}:${deptName.toLowerCase()}`) || null;
    }
    if (!assetId && equipName) {
      assetId = assetMap.get(`nameonly:${equipName.toLowerCase()}`) || null;
    }
    // Fuzzy: check if WO name is contained in any inventory name or vice versa
    if (!assetId && equipName) {
      const woLower = equipName.toLowerCase();
      for (const [key, id] of assetMap.entries()) {
        if (!key.startsWith('nameonly:')) continue;
        const invName = key.replace('nameonly:', '');
        if (invName.includes(woLower) || woLower.includes(invName)) {
          assetId = id;
          break;
        }
      }
    }

    if (!assetId) {
      report.assetMatching.unmatched++;
      report.assetMatching.details.push(`${woNum}: ${equipName} (serial: ${serial || 'none'}) - no match`);
      report.skipped.push({ sheet: 'Work Orders', row: r, reason: `No matching asset for ${equipName}` });
      continue;
    }

    report.assetMatching.matched++;
    const deptName = normalizeDepartment(dept || 'Inpatient Ward');
    const deptId = deptMap.get(deptName);

    // Determine urgency and status
    const urgency = critical?.toLowerCase() === 'yes' ? 'high' : 'medium';
    const isCompleted = completedBy && completedBy !== '—' && completionDate && completionDate !== '—';
    const requestId = crypto.randomUUID();
    const woId = crypto.randomUUID();

    const requestNotes = [
      `Imported from Menelik II Hospital work order record.`,
      `WO#: ${woNum}.`,
      location ? `Location: ${location}.` : null,
      usabilityImpact ? `Usability impact: ${usabilityImpact}.` : null,
      reportedTime ? `Reported time: ${reportedTime}.` : null,
    ].filter(Boolean).join(' ');

    requests.push({
      id: requestId,
      request_number: `MNK-REQ-${woNum.replace('WO-', '')}`,
      asset_id: assetId,
      department_id: deptId,
      fault_description: issueDesc || `Equipment fault reported (${woNum})`,
      urgency,
      status: isCompleted ? 'completed' : 'approved',
      notes: requestNotes,
      created_at: new Date().toISOString(),
    });

    const woNotes = [
      `Imported from Menelik II Hospital corrective maintenance record.`,
      model ? `Model: ${model}.` : null,
      approvedBy && approvedBy !== '—' ? `Approved by: ${approvedBy}.` : null,
      completedBy && completedBy !== '—' ? `Completed by: ${completedBy}.` : null,
    ].filter(Boolean).join(' ');

    workOrders.push({
      id: woId,
      work_order_number: `MNK-${woNum}`,
      request_id: requestId,
      asset_id: assetId,
      assigned_to: technicianProfileId,
      status: isCompleted ? 'completed' : 'open',
      priority: urgency,
      work_type: 'corrective',
      action_taken: corrAction && corrAction !== '—' ? corrAction : null,
      completion_outcome: isCompleted && postResult?.toLowerCase() === 'pass' ? 'resolved' : null,
      closure_notes: woNotes,
      created_at: new Date().toISOString(),
      completed_at: isCompleted ? new Date().toISOString() : null,
    });
  }

  fs.writeFileSync(path.join(NORMALIZED_DIR, 'work-orders.json'), JSON.stringify({ requests, workOrders }, null, 2));

  if (!DRY_RUN) {
    if (requests.length > 0) {
      const { error } = await supabase.from('maintenance_requests').insert(requests);
      if (error) console.error(`    ❌ Maintenance requests insert failed: ${error.message}`);
    }
    if (workOrders.length > 0) {
      const { error } = await supabase.from('work_orders').insert(workOrders);
      if (error) console.error(`    ❌ Work orders insert failed: ${error.message}`);
    }
  }

  report.imported['maintenance_requests'] = requests.length;
  report.imported['work_orders'] = workOrders.length;
  console.log(`  Maintenance requests: ${requests.length}, Work orders: ${workOrders.length}`);
}

async function importPerformanceVerification(
  supabase: SupabaseClient,
  ws: ExcelJS.Worksheet,
  assetMap: Map<string, string>
): Promise<void> {
  const plans: any[] = [];
  const schedules: any[] = [];
  const completions: any[] = [];

  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const num = getCellString(row.getCell(1));
    if (!num) continue;

    const equipName = getCellString(row.getCell(2));
    const serial = getCellString(row.getCell(5));
    const site = getCellString(row.getCell(6));
    const dateStr = getCellString(row.getCell(7));
    const woType = getCellString(row.getCell(8));
    const duration = getCellString(row.getCell(9));
    const result = getCellString(row.getCell(10));
    const technicians = getCellString(row.getCell(11));
    const testEquip = getCellString(row.getCell(12));
    const remarks = getCellString(row.getCell(13));

    // Try to match asset
    let assetId: string | null = null;
    if (serial && serial !== '—') {
      assetId = assetMap.get(`serial:${serial}`) || null;
    }
    if (!assetId && equipName) {
      assetId = assetMap.get(`nameonly:${equipName.toLowerCase()}`) || null;
    }
    // Fuzzy partial name match
    if (!assetId && equipName) {
      const pvLower = equipName.toLowerCase();
      for (const [key, id] of assetMap.entries()) {
        if (!key.startsWith('nameonly:')) continue;
        const invName = key.replace('nameonly:', '');
        if (invName.includes(pvLower) || pvLower.includes(invName)) {
          assetId = id;
          break;
        }
      }
    }

    if (!assetId) {
      report.skipped.push({ sheet: 'Performance Verification', row: r, reason: `No matching asset for ${equipName}` });
      continue;
    }

    const parsedDate = parseDate(dateStr);
    const scheduleDate = parsedDate || '2024-01-01'; // fallback for required field

    const planId = deterministicUuid('pvplan', `${assetId}-pv`);
    const schedId = crypto.randomUUID();
    const compId = crypto.randomUUID();

    // Only create plan once per asset
    if (!plans.find((p) => p.id === planId)) {
      plans.push({
        id: planId,
        asset_id: assetId,
        name: `Performance Verification — ${equipName}`,
        frequency_days: 180,
        is_active: false, // historical evidence only
      });
    }

    const pvNotes = [
      `Imported from Menelik II Hospital performance verification record.`,
      site ? `Maintenance site: ${site}.` : null,
      woType ? `Work order type: ${woType}.` : null,
      testEquip ? `Test equipment: ${testEquip}.` : null,
      remarks || null,
      !parsedDate && dateStr ? `Original date value: ${dateStr}.` : null,
    ].filter(Boolean).join(' ');

    // Map result to CHECK constraint: pass | issue_found | failed
    let mappedResult: string | null = null;
    if (result) {
      const rLower = result.toLowerCase();
      if (rLower.includes('pass') || rLower.includes('satisf')) mappedResult = 'pass';
      else if (rLower.includes('fail')) mappedResult = 'failed';
      else if (rLower.includes('issue') || rLower.includes('partial')) mappedResult = 'issue_found';
      else mappedResult = 'pass'; // default for completed verification
    }

    schedules.push({
      id: schedId,
      plan_id: planId,
      asset_id: assetId,
      scheduled_date: scheduleDate,
      status: 'completed',
      result: mappedResult,
      completion_notes: pvNotes,
      completed_at: parsedDate ? `${parsedDate}T00:00:00Z` : new Date().toISOString(),
    });

    // Parse duration
    let durationHours: number | null = null;
    if (duration) {
      const minMatch = duration.match(/(\d+)\s*min/);
      if (minMatch) durationHours = parseInt(minMatch[1]) / 60;
    }

    completions.push({
      id: compId,
      schedule_id: schedId,
      completion_date: scheduleDate,
      duration_hours: durationHours,
      notes: `Technicians: ${technicians || 'Unknown'}. Result: ${result || 'Unknown'}. ${pvNotes}`,
    });
  }

  fs.writeFileSync(
    path.join(NORMALIZED_DIR, 'performance-verification-records.json'),
    JSON.stringify({ plans, schedules, completions }, null, 2)
  );

  if (!DRY_RUN) {
    if (plans.length > 0) {
      const { error } = await supabase.from('pm_plans').insert(plans);
      if (error) console.error(`    ❌ PM plans insert failed: ${error.message}`);
    }
    if (schedules.length > 0) {
      const { error } = await supabase.from('pm_schedules').insert(schedules);
      if (error) console.error(`    ❌ PM schedules insert failed: ${error.message}`);
    }
    if (completions.length > 0) {
      const { error } = await supabase.from('pm_completions').insert(completions);
      if (error) console.error(`    ❌ PM completions insert failed: ${error.message}`);
    }
  }

  report.imported['pm_plans'] = plans.length;
  report.imported['pm_schedules'] = schedules.length;
  report.imported['pm_completions'] = completions.length;
  console.log(`  PM plans: ${plans.length}, Schedules: ${schedules.length}, Completions: ${completions.length}`);
}

async function importPreventiveMaintenance(
  supabase: SupabaseClient,
  ws: ExcelJS.Worksheet,
  assetMap: Map<string, string>
): Promise<void> {
  const plans: any[] = [];
  const schedules: any[] = [];
  const completions: any[] = [];

  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const pmNum = getCellString(row.getCell(1));
    if (!pmNum || !pmNum.startsWith('PM-')) continue;

    const equipName = getCellString(row.getCell(2));
    const model = getCellString(row.getCell(3));
    const serial = getCellString(row.getCell(4));
    const dept = getCellString(row.getCell(5));
    const pmDate = getCellString(row.getCell(7));
    const tasks = getCellString(row.getCell(8));
    const frequency = getCellString(row.getCell(9));
    const nextPmDate = getCellString(row.getCell(10));
    const completedBy = getCellString(row.getCell(11));
    const approvedBy = getCellString(row.getCell(12));

    // Match asset
    let assetId: string | null = null;
    if (serial && serial !== '—') {
      assetId = assetMap.get(`serial:${serial}`) || null;
    }
    if (!assetId && equipName) {
      assetId = assetMap.get(`nameonly:${equipName.toLowerCase()}`) || null;
    }
    if (!assetId && equipName) {
      const pmLower = equipName.toLowerCase();
      for (const [key, id] of assetMap.entries()) {
        if (!key.startsWith('nameonly:')) continue;
        const invName = key.replace('nameonly:', '');
        if (invName.includes(pmLower) || pmLower.includes(invName)) {
          assetId = id;
          break;
        }
      }
    }

    if (!assetId) {
      report.skipped.push({ sheet: 'Preventive Maintenance', row: r, reason: `No matching asset for ${equipName}` });
      continue;
    }

    const parsedDate = parseDate(pmDate);
    const scheduleDate = parsedDate || '2024-01-01';

    const freqDays = frequency?.toLowerCase().includes('annual') ? 365 :
      frequency?.toLowerCase().includes('semi') ? 180 : 90;

    const planId = deterministicUuid('pmplan', `${assetId}-pm`);
    const schedId = crypto.randomUUID();
    const compId = crypto.randomUUID();

    if (!plans.find((p) => p.id === planId)) {
      plans.push({
        id: planId,
        asset_id: assetId,
        name: `Preventive Maintenance — ${equipName}`,
        frequency_days: freqDays,
        is_active: false,
      });
    }

    const pmNotes = [
      `Imported from Menelik II Hospital PM record (${pmNum}).`,
      tasks ? `Tasks: ${tasks.substring(0, 200)}` : null,
      completedBy && completedBy !== '—' ? `Completed by: ${completedBy}.` : null,
      approvedBy && approvedBy !== '—' ? `Approved by: ${approvedBy}.` : null,
      !parsedDate && pmDate ? `Original date: ${pmDate}.` : null,
    ].filter(Boolean).join(' ');

    schedules.push({
      id: schedId,
      plan_id: planId,
      asset_id: assetId,
      scheduled_date: scheduleDate,
      status: 'completed',
      result: 'pass',
      completion_notes: pmNotes,
      completed_at: parsedDate ? `${parsedDate}T00:00:00Z` : new Date().toISOString(),
    });

    completions.push({
      id: compId,
      schedule_id: schedId,
      completion_date: scheduleDate,
      notes: pmNotes,
    });
  }

  fs.writeFileSync(
    path.join(NORMALIZED_DIR, 'pm-records.json'),
    JSON.stringify({ plans, schedules, completions }, null, 2)
  );

  if (!DRY_RUN) {
    if (plans.length > 0) {
      const { error } = await supabase.from('pm_plans').insert(plans);
      if (error) console.error(`    ❌ PM plans insert failed: ${error.message}`);
    }
    if (schedules.length > 0) {
      const { error } = await supabase.from('pm_schedules').insert(schedules);
      if (error) console.error(`    ❌ PM schedules insert failed: ${error.message}`);
    }
    if (completions.length > 0) {
      const { error } = await supabase.from('pm_completions').insert(completions);
      if (error) console.error(`    ❌ PM completions insert failed: ${error.message}`);
    }
  }

  report.imported['pm_plans'] = (report.imported['pm_plans'] || 0) + plans.length;
  report.imported['pm_schedules'] = (report.imported['pm_schedules'] || 0) + schedules.length;
  report.imported['pm_completions'] = (report.imported['pm_completions'] || 0) + completions.length;
  console.log(`  PM (from PM sheet): plans=${plans.length}, schedules=${schedules.length}, completions=${completions.length}`);
}

async function importTraining(
  supabase: SupabaseClient,
  ws: ExcelJS.Worksheet,
  assetMap: Map<string, string>
): Promise<void> {
  const sessions: any[] = [];
  const staffRecords: any[] = [];

  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const num = getCellString(row.getCell(1));
    if (!num) continue;

    const dept = getCellString(row.getCell(2));
    const device = getCellString(row.getCell(3));
    const model = getCellString(row.getCell(4));
    const mfr = getCellString(row.getCell(5));
    const traineeName = getCellString(row.getCell(6));
    const position = getCellString(row.getCell(7));
    const trainedBy = getCellString(row.getCell(8));
    const dateStr = getCellString(row.getCell(9));
    const assessDate = getCellString(row.getCell(10));
    const comments = getCellString(row.getCell(11));

    const parsedDate = parseDate(dateStr);
    const trainingDate = parsedDate || '2024-01-01';

    // Try to match asset
    let assetId: string | null = null;
    if (device) {
      assetId = assetMap.get(`nameonly:${device.toLowerCase()}`) || null;
      if (!assetId) {
        const devLower = device.toLowerCase();
        for (const [key, id] of assetMap.entries()) {
          if (!key.startsWith('nameonly:')) continue;
          const invName = key.replace('nameonly:', '');
          if (invName.includes(devLower) || devLower.includes(invName)) {
            assetId = id;
            break;
          }
        }
      }
    }

    const sessionId = crypto.randomUUID();
    const sessionNotes = [
      `Imported from Menelik II Hospital training verification record.`,
      dept ? `Department: ${dept}.` : null,
      model && model !== '—' ? `Model: ${model}.` : null,
      mfr && mfr !== '—' ? `Manufacturer/supplier: ${mfr}.` : null,
      position ? `Trainee position: ${position}.` : null,
      !parsedDate && dateStr ? `Original date: ${dateStr}.` : null,
    ].filter(Boolean).join(' ');

    sessions.push({
      id: sessionId,
      title: `${device || 'Medical Device'} — Operational Training`,
      asset_id: assetId,
      trainer: trainedBy || 'Unknown',
      training_date: trainingDate,
      description: sessionNotes,
    });

    if (traineeName && traineeName !== '—') {
      staffRecords.push({
        id: crypto.randomUUID(),
        session_id: sessionId,
        staff_name: traineeName,
        status: 'attended',
        notes: comments && comments !== '—' ? comments : null,
      });
    }
  }

  fs.writeFileSync(
    path.join(NORMALIZED_DIR, 'training-records.json'),
    JSON.stringify({ sessions, staffRecords }, null, 2)
  );

  if (!DRY_RUN) {
    if (sessions.length > 0) {
      const { error } = await supabase.from('training_sessions').insert(sessions);
      if (error) console.error(`    ❌ Training sessions insert failed: ${error.message}`);
    }
    if (staffRecords.length > 0) {
      const { error } = await supabase.from('staff_training_records').insert(staffRecords);
      if (error) console.error(`    ❌ Staff training records insert failed: ${error.message}`);
    }
  }

  report.imported['training_sessions'] = sessions.length;
  report.imported['staff_training_records'] = staffRecords.length;
  console.log(`  Training sessions: ${sessions.length}, Staff records: ${staffRecords.length}`);
}

async function refreshAnalytics(supabase: SupabaseClient): Promise<void> {
  console.log('\n📊 Refreshing analytics...');

  try {
    const { error } = await supabase.rpc('recompute_all_equipment_analytics');
    if (error) {
      console.warn(`  ⚠️  recompute_all_equipment_analytics: ${error.message}`);
      report.analyticsRefresh = `recompute failed: ${error.message}`;
    } else {
      console.log('  ✅ recompute_all_equipment_analytics completed');
      report.analyticsRefresh = 'completed';
    }
  } catch (e: any) {
    console.warn(`  ⚠️  Analytics refresh skipped: ${e.message}`);
    report.analyticsRefresh = `skipped: ${e.message}`;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  BMEDIS — Menelik II Hospital Data Import`);
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN (no DB writes)' : '⚡ LIVE IMPORT'}`);
  console.log(`${'═'.repeat(60)}\n`);

  if (!fs.existsSync(WORKBOOK_PATH)) {
    console.error(`❌ Workbook not found: ${WORKBOOK_PATH}`);
    process.exit(1);
  }

  fs.mkdirSync(NORMALIZED_DIR, { recursive: true });

  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Step 1: Pre-import snapshot
  console.log('📋 Taking pre-import snapshot...');
  report.preImportSnapshot = await preImportSnapshot(supabase);
  console.log(`  Snapshot: ${Object.entries(report.preImportSnapshot).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join(', ') || '(all tables empty)'}\n`);

  // Step 2: Load workbook
  console.log('📖 Loading workbook...');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(WORKBOOK_PATH);

  // Step 3: Clear operational data (live mode only)
  if (!DRY_RUN) {
    const cleared = await clearOperationalData(supabase);
    if (!cleared) {
      console.error('\n❌ Import aborted due to clearing failure.');
      process.exit(1);
    }
  } else {
    console.log('  [DRY RUN] Skipping data clearing.\n');
  }

  // Step 4: Upsert reference data
  console.log('\n📦 Configuring reference data...');

  // Collect unique categories and manufacturers from workbook
  const invSheet = wb.getWorksheet('Equipment Inventory');
  if (!invSheet) {
    console.error('❌ Equipment Inventory sheet not found');
    process.exit(1);
  }

  const workbookCategories = new Set<string>();
  const workbookMfrs = new Set<string>();

  for (let r = DATA_START_ROW; r <= invSheet.rowCount; r++) {
    const row = invSheet.getRow(r);
    const cat = getCellString(row.getCell(4));
    const mfr = getCellString(row.getCell(7));
    if (cat) workbookCategories.add(cat);
    const mfrName = identifyManufacturer(mfr);
    if (mfrName) workbookMfrs.add(mfrName);
  }

  const deptMap = await upsertDepartments(supabase);
  const catMap = await upsertCategories(supabase, workbookCategories);
  const mfrMap = await upsertManufacturers(supabase, workbookMfrs);

  // Write reference data normalized JSONs
  fs.writeFileSync(
    path.join(NORMALIZED_DIR, 'departments.json'),
    JSON.stringify(MENELIK_DEPARTMENTS.map((d) => ({ ...d, id: getDepartmentId(d.name) })), null, 2)
  );
  fs.writeFileSync(
    path.join(NORMALIZED_DIR, 'categories.json'),
    JSON.stringify([...workbookCategories].map((c) => getCategoryInfo(c)), null, 2)
  );
  fs.writeFileSync(
    path.join(NORMALIZED_DIR, 'manufacturers.json'),
    JSON.stringify([...workbookMfrs].map((m) => ({ name: m, id: deterministicUuid('mfr', m) })), null, 2)
  );

  // Step 5: Import equipment assets
  console.log('\n🏥 Importing equipment assets...');
  const assetMap = await importEquipment(supabase, invSheet, deptMap, catMap, mfrMap);

  // Step 6: Import work orders
  const woSheet = wb.getWorksheet('Work Orders');
  if (woSheet) {
    console.log('\n🔧 Importing work orders...');
    await importWorkOrders(supabase, woSheet, assetMap, deptMap);
  }

  // Step 7: Import performance verification
  const pvSheet = wb.getWorksheet('Performance Verification');
  if (pvSheet) {
    console.log('\n📋 Importing performance verification...');
    await importPerformanceVerification(supabase, pvSheet, assetMap);
  }

  // Step 8: Import preventive maintenance
  const pmSheet = wb.getWorksheet('Preventive Maintenance');
  if (pmSheet) {
    console.log('\n🛠️  Importing preventive maintenance...');
    await importPreventiveMaintenance(supabase, pmSheet, assetMap);
  }

  // Step 9: Import training
  const trSheet = wb.getWorksheet('Training Records');
  if (trSheet) {
    console.log('\n📚 Importing training records...');
    await importTraining(supabase, trSheet, assetMap);
  }

  // Step 10: Skip calibration (placeholder only)
  report.skipped.push({ sheet: 'Calibration', row: 0, reason: 'Only 1 placeholder row referencing physical cover page — no importable calibration data' });
  report.skipped.push({ sheet: 'Acceptance Testing', row: 0, reason: 'Blank template — no real acceptance test data' });
  report.skipped.push({ sheet: 'Dashboard', row: 0, reason: 'Summary only — not source operational data' });

  // Step 11: Refresh analytics
  if (!DRY_RUN) {
    await refreshAnalytics(supabase);
  } else {
    report.analyticsRefresh = 'skipped (dry-run)';
  }

  // Step 12: Write report
  report.completedAt = new Date().toISOString();
  report.limitations = [
    'Calibration data: Only 1 placeholder row — no mature calibration dataset imported.',
    'Acceptance testing: Blank template only — no completed acceptance records.',
    'Dates: DD/MM/YYYY dates that fall in 2015-2019 range may be Ethiopian Calendar; stored in notes without conversion.',
    'Manufacturers: ~85% of "Manufacturer/Brand" column values are model/serial numbers; stored in notes.',
    'PM compliance: Based on 13 performance verification + 2 PM records only — not hospital-wide.',
    'Work order matching: Some WOs may not match to imported assets if serial/name differs from inventory.',
    'Analytics: MTBF/MTTR/availability require accumulated operational history beyond what was imported.',
  ];

  const reportPath = path.join(REPORT_DIR, DRY_RUN ? 'dry-run-report.json' : 'import-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Final summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Import ${DRY_RUN ? 'DRY RUN' : ''} Complete`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`\n  Records imported:`);
  Object.entries(report.imported).forEach(([table, count]) => {
    console.log(`    ${table}: ${count}`);
  });
  console.log(`\n  Skipped: ${report.skipped.length} records`);
  console.log(`  Asset matching: ${report.assetMatching.matched} matched, ${report.assetMatching.unmatched} unmatched`);
  console.log(`  Warnings: ${report.warnings.length}`);
  console.log(`  Analytics: ${report.analyticsRefresh}`);
  console.log(`\n  Report: ${reportPath}`);
  console.log(`  Normalized data: ${NORMALIZED_DIR}/`);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
