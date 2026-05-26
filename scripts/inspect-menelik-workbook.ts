/**
 * Menelik II Hospital Workbook Inspection Script
 *
 * Reads the Excel workbook and produces a structured inspection report
 * with sheet metadata, data quality issues, and cross-reference analysis.
 *
 * Usage: npm run inspect:menelik
 */

import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

const WORKBOOK_PATH = path.resolve(
  process.cwd(),
  'supabase/menelikII-data/Menelik_II_Medical_Equipment_Management.xlsx'
);
const REPORT_PATH = path.resolve(
  process.cwd(),
  'supabase/menelikII-data/inspection-report.json'
);

const HEADER_ROW = 3; // Row 1 = merged title, Row 2 = source note, Row 3 = column headers
const DATA_START_ROW = 4;

interface SheetInspection {
  name: string;
  totalRows: number;
  dataRows: number;
  headers: { col: number; value: string }[];
  sourceNote: string;
  uniqueValues: Record<string, string[]>;
  emptyCells: Record<string, number>;
  qualityIssues: string[];
}

interface InspectionReport {
  workbookPath: string;
  inspectedAt: string;
  sheets: SheetInspection[];
  departments: { raw: string; count: number }[];
  statuses: string[];
  manufacturers: { raw: string; count: number; likelyType: string }[];
  whoCategories: { raw: string; count: number }[];
  duplicateSerialNumbers: { serial: string; rows: number[] }[];
  duplicateInventoryNumbers: { inventory: string; rows: number[] }[];
  dateFormats: string[];
  summary: {
    totalSheets: number;
    totalEquipment: number;
    totalWorkOrders: number;
    totalPerformanceVerification: number;
    totalPreventiveMaintenance: number;
    totalTraining: number;
    totalCalibration: number;
    totalAcceptanceTesting: number;
    skippedSheets: string[];
  };
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

function getHeaders(ws: ExcelJS.Worksheet): { col: number; value: string }[] {
  const row = ws.getRow(HEADER_ROW);
  const headers: { col: number; value: string }[] = [];
  for (let c = 1; c <= ws.columnCount; c++) {
    const val = getCellString(row.getCell(c));
    if (val) headers.push({ col: c, value: val });
  }
  return headers;
}

function getSourceNote(ws: ExcelJS.Worksheet): string {
  const row = ws.getRow(2);
  return getCellString(row.getCell(1));
}

function countDataRows(ws: ExcelJS.Worksheet): number {
  let count = 0;
  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    let hasValue = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (getCellString(cell) !== '') hasValue = true;
    });
    if (hasValue) count++;
  }
  return count;
}

const KNOWN_MANUFACTURERS = new Set([
  'rossmax', 'riester', 'helmer', 'cepheid', 'sakura',
  'yuyue', 'yuye', 'fazzini', 'gima', 'keeler',
  'tuttnauer', 'stryker', 'stryeker', 'cisa', 'bdfacs',
]);

function classifyManufacturerValue(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (KNOWN_MANUFACTURERS.has(lower)) return 'manufacturer';
  if (/^\d{3,}$/.test(raw) || /^\d+[-/]\d+/.test(raw)) return 'likely_serial_or_model';
  if (/^[A-Z]{2,}\d+/.test(raw) || /^\d+[A-Z]/.test(raw)) return 'likely_model';
  if (raw.includes('-') && raw.length > 8) return 'likely_serial';
  if (raw.length <= 3) return 'likely_code';
  return 'unknown';
}

function inspectSheet(ws: ExcelJS.Worksheet): SheetInspection {
  const headers = getHeaders(ws);
  const dataRows = countDataRows(ws);
  const sourceNote = getSourceNote(ws);
  const uniqueValues: Record<string, string[]> = {};
  const emptyCells: Record<string, number> = {};
  const qualityIssues: string[] = [];

  for (const h of headers) {
    const vals = new Set<string>();
    let emptyCount = 0;
    for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      let rowHasData = false;
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (getCellString(cell) !== '') rowHasData = true;
      });
      if (!rowHasData) continue;

      const v = getCellString(row.getCell(h.col));
      if (v === '' || v === '—' || v === '-') {
        emptyCount++;
      } else {
        vals.add(v);
      }
    }
    if (vals.size <= 50) {
      uniqueValues[h.value] = [...vals].sort();
    } else {
      uniqueValues[h.value] = [`(${vals.size} unique values — too many to list)`];
    }
    emptyCells[h.value] = emptyCount;

    if (emptyCount > dataRows * 0.5 && dataRows > 0) {
      qualityIssues.push(
        `Column "${h.value}" is >50% empty (${emptyCount}/${dataRows} rows)`
      );
    }
  }

  return {
    name: ws.name,
    totalRows: ws.rowCount,
    dataRows,
    headers,
    sourceNote,
    uniqueValues,
    emptyCells,
    qualityIssues,
  };
}

async function main() {
  console.log('Menelik II Hospital Workbook Inspection');
  console.log('=======================================\n');

  if (!fs.existsSync(WORKBOOK_PATH)) {
    console.error(`Workbook not found: ${WORKBOOK_PATH}`);
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(WORKBOOK_PATH);

  const sheets: SheetInspection[] = [];
  const sheetDataRows: Record<string, number> = {};

  wb.eachSheet((ws) => {
    const inspection = inspectSheet(ws);
    sheets.push(inspection);
    sheetDataRows[ws.name] = inspection.dataRows;
    console.log(`Sheet: ${ws.name}`);
    console.log(`  Data rows: ${inspection.dataRows}`);
    console.log(`  Headers: ${inspection.headers.map((h) => h.value).join(', ')}`);
    console.log(`  Source: ${inspection.sourceNote.substring(0, 80)}`);
    if (inspection.qualityIssues.length > 0) {
      console.log(`  Quality issues:`);
      inspection.qualityIssues.forEach((q) => console.log(`    - ${q}`));
    }
    console.log();
  });

  // Equipment Inventory deep analysis
  const invSheet = wb.getWorksheet('Equipment Inventory');
  const departments: Record<string, number> = {};
  const statuses = new Set<string>();
  const manufacturers: Record<string, number> = {};
  const categories: Record<string, number> = {};
  const serialNumbers: Record<string, number[]> = {};
  const inventoryNumbers: Record<string, number[]> = {};
  const dateFormats = new Set<string>();

  if (invSheet) {
    for (let r = DATA_START_ROW; r <= invSheet.rowCount; r++) {
      const row = invSheet.getRow(r);
      const name = getCellString(row.getCell(3));
      if (!name) continue;

      const dept = getCellString(row.getCell(6));
      const status = getCellString(row.getCell(10));
      const mfr = getCellString(row.getCell(7));
      const cat = getCellString(row.getCell(4));
      const serial = getCellString(row.getCell(9));
      const invNum = getCellString(row.getCell(2));

      if (dept) departments[dept] = (departments[dept] || 0) + 1;
      if (status) statuses.add(status);
      if (mfr) manufacturers[mfr] = (manufacturers[mfr] || 0) + 1;
      if (cat) categories[cat] = (categories[cat] || 0) + 1;

      if (serial && serial !== '—') {
        if (!serialNumbers[serial]) serialNumbers[serial] = [];
        serialNumbers[serial].push(r);
      }
      if (invNum) {
        if (!inventoryNumbers[invNum]) inventoryNumbers[invNum] = [];
        inventoryNumbers[invNum].push(r);
      }
    }
  }

  // Check all sheets for date-like values
  wb.eachSheet((ws) => {
    for (let r = DATA_START_ROW; r <= Math.min(ws.rowCount, 20); r++) {
      const row = ws.getRow(r);
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = getCellString(cell);
        if (/\d{2}\/\d{2}\/\d{4}/.test(v)) dateFormats.add('DD/MM/YYYY');
        if (/\d{4}-\d{2}-\d{2}/.test(v)) dateFormats.add('YYYY-MM-DD');
        if (/E\.C\./.test(v) || /\d{4}\s*E\.C/.test(v)) dateFormats.add('Ethiopian Calendar (E.C.)');
        if (/\d{2}:\d{2}/.test(v) && v.length <= 5) dateFormats.add('HH:MM (time only)');
        if (/[A-Za-z]+\s+\d{4}/.test(v)) dateFormats.add('Month YYYY');
      });
    }
  });

  const duplicateSerials = Object.entries(serialNumbers)
    .filter(([, rows]) => rows.length > 1)
    .map(([serial, rows]) => ({ serial, rows }));

  const duplicateInventory = Object.entries(inventoryNumbers)
    .filter(([, rows]) => rows.length > 1)
    .map(([inventory, rows]) => ({ inventory, rows }));

  // Print summary
  console.log('=== DEPARTMENTS ===');
  Object.entries(departments)
    .sort((a, b) => b[1] - a[1])
    .forEach(([d, c]) => console.log(`  ${String(c).padStart(4)}  ${d}`));

  console.log('\n=== STATUSES ===');
  [...statuses].sort().forEach((s) => console.log(`  ${s}`));

  console.log('\n=== WHO CATEGORIES ===');
  Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([c, n]) => console.log(`  ${String(n).padStart(4)}  ${c}`));

  console.log('\n=== MANUFACTURER COLUMN ANALYSIS ===');
  const mfrEntries = Object.entries(manufacturers)
    .map(([raw, count]) => ({
      raw,
      count,
      likelyType: classifyManufacturerValue(raw),
    }))
    .sort((a, b) => b.count - a.count);
  const realMfrs = mfrEntries.filter((m) => m.likelyType === 'manufacturer');
  const notMfrs = mfrEntries.filter((m) => m.likelyType !== 'manufacturer');
  console.log(`  Recognized manufacturers: ${realMfrs.length}`);
  realMfrs.forEach((m) => console.log(`    ${String(m.count).padStart(3)}x ${m.raw}`));
  console.log(`  Non-manufacturer values: ${notMfrs.length}`);
  notMfrs.slice(0, 15).forEach((m) =>
    console.log(`    ${String(m.count).padStart(3)}x ${m.raw} (${m.likelyType})`)
  );
  if (notMfrs.length > 15) console.log(`    ... and ${notMfrs.length - 15} more`);

  console.log('\n=== DATE FORMATS DETECTED ===');
  [...dateFormats].forEach((f) => console.log(`  ${f}`));

  if (duplicateSerials.length > 0) {
    console.log(`\n=== DUPLICATE SERIAL NUMBERS (${duplicateSerials.length}) ===`);
    duplicateSerials.forEach((d) =>
      console.log(`  ${d.serial} appears in rows: ${d.rows.join(', ')}`)
    );
  }

  if (duplicateInventory.length > 0) {
    console.log(`\n=== DUPLICATE INVENTORY NUMBERS (${duplicateInventory.length}) ===`);
    duplicateInventory.forEach((d) =>
      console.log(`  ${d.inventory} appears in rows: ${d.rows.join(', ')}`)
    );
  }

  const report: InspectionReport = {
    workbookPath: WORKBOOK_PATH,
    inspectedAt: new Date().toISOString(),
    sheets,
    departments: Object.entries(departments)
      .map(([raw, count]) => ({ raw, count }))
      .sort((a, b) => b.count - a.count),
    statuses: [...statuses].sort(),
    manufacturers: mfrEntries,
    whoCategories: Object.entries(categories)
      .map(([raw, count]) => ({ raw, count }))
      .sort((a, b) => b.count - a.count),
    duplicateSerialNumbers: duplicateSerials,
    duplicateInventoryNumbers: duplicateInventory,
    dateFormats: [...dateFormats],
    summary: {
      totalSheets: sheets.length,
      totalEquipment: sheetDataRows['Equipment Inventory'] || 0,
      totalWorkOrders: sheetDataRows['Work Orders'] || 0,
      totalPerformanceVerification: sheetDataRows['Performance Verification'] || 0,
      totalPreventiveMaintenance: sheetDataRows['Preventive Maintenance'] || 0,
      totalTraining: sheetDataRows['Training Records'] || 0,
      totalCalibration: sheetDataRows['Calibration'] || 0,
      totalAcceptanceTesting: sheetDataRows['Acceptance Testing'] || 0,
      skippedSheets: ['Dashboard', 'Acceptance Testing', 'Calibration'],
    },
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nInspection report written to: ${REPORT_PATH}`);

  console.log('\n=== SUMMARY ===');
  console.log(`  Equipment: ${report.summary.totalEquipment} rows`);
  console.log(`  Work Orders: ${report.summary.totalWorkOrders} rows`);
  console.log(`  Performance Verification: ${report.summary.totalPerformanceVerification} rows`);
  console.log(`  Preventive Maintenance: ${report.summary.totalPreventiveMaintenance} rows`);
  console.log(`  Training: ${report.summary.totalTraining} rows`);
  console.log(`  Calibration: ${report.summary.totalCalibration} rows (placeholder — skip)`);
  console.log(`  Acceptance Testing: ${report.summary.totalAcceptanceTesting} rows (template — skip)`);
  console.log(`  Skipped sheets: ${report.summary.skippedSheets.join(', ')}`);
}

main().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
