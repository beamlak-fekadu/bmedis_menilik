import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

function readSource(rel: string): string {
  return readFileSync(path.resolve(repoRoot, rel), 'utf8');
}

function walk(dir: string): string[] {
  const abs = path.resolve(repoRoot, dir);
  const out: string[] = [];
  for (const entry of readdirSync(abs)) {
    const full = path.join(abs, entry);
    const rel = path.relative(repoRoot, full);
    if (rel.includes('node_modules') || rel.includes('.next')) continue;
    if (statSync(full).isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}

test('STOCK-01: legacy spare-parts service stock writers are guarded, not transactional bypasses', () => {
  const service = readSource('src/services/spare-parts.service.ts');

  assert.doesNotMatch(service, /from\('stock_receipts'\)[\s\S]{0,300}\.insert\(/);
  assert.doesNotMatch(service, /from\('stock_issues'\)[\s\S]{0,300}\.insert\(/);
  assert.doesNotMatch(service, /\.update\(\{\s*current_stock:/);
  assert.match(service, /Deprecated unsafe stock mutation path[\s\S]*record_stock_receipt RPC/);
  assert.match(service, /Deprecated unsafe stock mutation path[\s\S]*record_stock_issue RPC/);
});

test('STOCK-01: canonical stock actions use row-locking RPCs', () => {
  const actions = readSource('src/actions/spare-parts.actions.ts');
  assert.match(actions, /record_stock_receipt/);
  assert.match(actions, /record_stock_issue/);
  assert.doesNotMatch(actions, /from\('stock_receipts'\)[\s\S]{0,300}\.insert\(/);
  assert.doesNotMatch(actions, /from\('stock_issues'\)[\s\S]{0,300}\.insert\(/);
  assert.doesNotMatch(actions, /\.update\(\{\s*current_stock:/);
});

test('STOCK-01: app code does not import deprecated stock mutation wrappers', () => {
  const files = walk('src').filter((file) => /\.(ts|tsx)$/.test(file) && file !== 'src/services/spare-parts.service.ts');
  for (const file of files) {
    const src = readSource(file);
    assert.doesNotMatch(
      src,
      /import\s*\{[^}]*\bcreateStock(?:Issue|Receipt)\b[^}]*\}\s*from ['"]@\/services\/spare-parts\.service['"]/,
      `${file} imports deprecated spare-parts service stock mutation wrapper`,
    );
  }
});

test('REPORT-01: report detail route gates privileged reports server-side', () => {
  const page = readSource('src/app/(dashboard)/reports/[type]/page.tsx');
  assert.match(page, /params:\s*Promise<\{ type: string \}>/);
  assert.match(page, /PRIVILEGED_REPORT_TYPES/);
  assert.match(page, /'audit-security'/);
  assert.match(page, /'offline-sync-evidence'/);
  assert.match(page, /'qr-coverage'/);
  assert.match(page, /'qr-scan-evidence'/);
  assert.match(page, /requireRole\(\['admin', 'bme_head'\]\)/);
});

test('REPORT-01: report exports support BMEDIS PDF and CSV with audit details', () => {
  const client = readSource('src/app/(dashboard)/reports/[type]/ReportTypeClient.tsx');
  const exportUtil = readSource('src/utils/export.ts');
  const action = readSource('src/actions/reports.actions.ts');

  assert.match(client, /exportToPDF/);
  assert.match(client, /exportToCSV/);
  assert.match(client, /Export PDF/);
  assert.match(client, /Export CSV/);
  assert.match(client, /format: 'pdf'/);
  assert.match(client, /format: 'csv'/);
  assert.match(exportUtil, /bmedis-\$\{slug\}-snapshot/);
  assert.match(exportUtil, /Snapshot Generated/);
  assert.match(exportUtil, /Source,BMEDIS operational database/);
  assert.match(action, /action: 'report\.exported'/);
  assert.match(action, /report_type: input\.reportType/);
  assert.match(action, /format: input\.format/);
  assert.match(action, /row_count:/);
  assert.match(action, /actor_profile_id: profile\.id/);
  assert.match(action, /exported_at: new Date\(\)\.toISOString\(\)/);
});

test('MOBILE-01: authenticated shell keeps major overlays scroll-contained on mobile', () => {
  const layout = readSource('src/components/layout/DashboardLayout.tsx');
  const topbar = readSource('src/components/layout/Topbar.tsx');
  const notifications = readSource('src/components/notifications/NotificationBell.tsx');
  const assistant = readSource('src/components/assistant/AssistantPanel.tsx');
  const table = readSource('src/components/ui/Table.tsx');

  assert.match(layout, /overflow-x-hidden/);
  assert.match(layout, /drawerMode/);
  assert.match(topbar, /md:hidden/);
  assert.match(topbar, /GlobalSearchPalette/);
  assert.match(notifications, /fixed left-2 right-2 top-\[4\.25rem\]/);
  assert.match(notifications, /max-h-\[calc\(100dvh-5rem\)\]/);
  assert.match(assistant, /w-full[\s\S]*sm:w-\[min\(92vw,520px\)\]/);
  assert.match(assistant, /min-h-0 flex-1[\s\S]*overflow-y-auto/);
  assert.match(table, /table-scroll-shell/);
  assert.match(table, /overflow-x-auto/);
});

test('BRAND-01: source-facing product copy avoids old BMERMS branding', () => {
  const files = walk('src')
    .concat(walk('public'))
    .filter((file) => /\.(ts|tsx|js|css|html|webmanifest|svg)$/.test(file))
    .filter((file) => file !== 'src/services/__tests__/phase3-hardening.test.ts');
  for (const file of files) {
    const src = readSource(file);
    assert.doesNotMatch(src, /BMERMS|Biomedical Engineering Resource Management System|Biomedical Equipment Resource Management System/);
  }

  const legacyRedirect = readSource('src/app/(dashboard)/alerts/page.tsx');
  assert.doesNotMatch(legacyRedirect, /Alerts moved|Alerts page has been consolidated/);
});
