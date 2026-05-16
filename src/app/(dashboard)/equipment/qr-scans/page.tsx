import Link from 'next/link';
import { requireRole } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import QrScanHistoryTable from '@/components/qr/QrScanHistoryTable';
import { getQrScanHistory } from '@/services/qr.service';
import { QR_ONLINE_STATUSES, QR_SCAN_SOURCES, type QrScanHistoryFilters } from '@/types/qr';
import { Button, PageHeader } from '@/components/ui';
import AssistantPageContextBridge from '@/components/assistant/AssistantPageContextBridge';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function readFilters(params: Record<string, string | string[] | undefined>): QrScanHistoryFilters {
  return {
    dateFrom: first(params.from) || undefined,
    dateTo: first(params.to) || undefined,
    role: first(params.role) || undefined,
    departmentId: first(params.department) || undefined,
    assetId: first(params.asset) || undefined,
    onlineStatus: first(params.onlineStatus) || undefined,
    scanSource: first(params.source) || undefined,
    actionTaken: first(params.action) || undefined,
    limit: 500,
  };
}

export default async function QrScansPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole(['admin', 'bme_head']);
  const params = await searchParams;
  const filters = readFilters(params);
  const supabase = await createClient();

  const [scans, departmentsRes, rolesRes] = await Promise.all([
    getQrScanHistory(filters),
    supabase.from('departments').select('id, name').order('name', { ascending: true }).limit(500),
    supabase.from('equipment_qr_scans').select('role_name').not('role_name', 'is', null).limit(1000),
  ]);

  const roles = Array.from(new Set(((rolesRes.data ?? []) as Array<{ role_name: string | null }>).map((row) => row.role_name).filter(Boolean) as string[])).sort();
  const departments = ((departmentsRes.data ?? []) as Array<{ id: string; name: string }>).map((dept) => ({
    value: dept.id,
    label: dept.name,
  }));

  return (
    <div className="space-y-6">
      <AssistantPageContextBridge
        moduleLabel="QR"
        pageLabel="QR Scan History"
        selectedRecordType="qr_scan_history"
        activeTab={filters.role ?? filters.scanSource ?? filters.onlineStatus ?? undefined}
        currentFilters={{
          dateFrom: filters.dateFrom ?? null,
          dateTo: filters.dateTo ?? null,
          role: filters.role ?? null,
          departmentId: filters.departmentId ?? null,
          assetId: filters.assetId ?? null,
          onlineStatus: filters.onlineStatus ?? null,
          scanSource: filters.scanSource ?? null,
          actionTaken: filters.actionTaken ?? null,
        }}
        pageSummary="QR scan evidence page with date, role, department, asset, online status, source, and action filters."
        visibleCounts={{ scans: scans.length, roles: roles.length, departments: departments.length }}
        availableEvidenceLinks={[{ label: 'QR Scan History', href: '/equipment/qr-scans', type: 'qr' }, { label: 'QR Scan Evidence Report', href: '/reports/qr-scan-evidence', type: 'report' }, { label: 'QR Coverage', href: '/equipment/qr-coverage', type: 'qr' }]}
        quickPrompts={['Review QR scan evidence.', 'Which QR scan risks need attention?', 'Explain scan coverage by role.']}
      />
      <PageHeader
        title="QR Scan History"
        description="Admin-only online QR scan activity from authenticated QR page renders. Raw user agents are not shown in this table."
        breadcrumbs={[{ label: 'Equipment', href: '/equipment' }, { label: 'QR Scan History' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/equipment/qr-coverage">
              <Button variant="outline" size="sm">QR Coverage</Button>
            </Link>
            <Link href="/reports/qr-scan-evidence">
              <Button size="sm">Scan Evidence Report</Button>
            </Link>
          </div>
        }
      />

      <form className="panel-surface grid gap-3 rounded-lg p-4 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">From</label>
          <input name="from" type="date" defaultValue={filters.dateFrom ?? ''} className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">To</label>
          <input name="to" type="date" defaultValue={filters.dateTo ?? ''} className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Role</label>
          <select name="role" defaultValue={filters.role ?? ''} className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 text-sm">
            <option value="">All roles</option>
            {roles.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Department</label>
          <select name="department" defaultValue={filters.departmentId ?? ''} className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 text-sm">
            <option value="">All departments</option>
            {departments.map((dept) => <option key={dept.value} value={dept.value}>{dept.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Asset ID</label>
          <input name="asset" defaultValue={filters.assetId ?? ''} placeholder="Exact asset UUID" className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Online Status</label>
          <select name="onlineStatus" defaultValue={filters.onlineStatus ?? ''} className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 text-sm">
            <option value="">All statuses</option>
            {QR_ONLINE_STATUSES.map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Scan Source</label>
          <select name="source" defaultValue={filters.scanSource ?? ''} className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 text-sm">
            <option value="">All sources</option>
            {QR_SCAN_SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Action</label>
          <input name="action" defaultValue={filters.actionTaken ?? ''} placeholder="open_qr_landing" className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 text-sm" />
        </div>
        <div className="flex items-end gap-2 md:col-span-4">
          <Button type="submit" size="sm">Apply Filters</Button>
          <Link href="/equipment/qr-scans">
            <Button type="button" variant="outline" size="sm">Clear</Button>
          </Link>
          <span className="ml-auto text-xs text-[var(--text-muted)]">{scans.length} scan record{scans.length === 1 ? '' : 's'} shown</span>
        </div>
      </form>

      <QrScanHistoryTable scans={scans} emptyMessage="No QR scans recorded for these filters." />
    </div>
  );
}
