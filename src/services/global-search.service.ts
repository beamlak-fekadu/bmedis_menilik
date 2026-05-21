import type { SupabaseClient } from '@supabase/supabase-js';
import { hasCapability } from '@/lib/rbac';
import { departmentScopeFor } from '@/lib/rbac/department-scope';

export type GlobalSearchGroupId =
  | 'equipment'
  | 'requests'
  | 'work_orders'
  | 'spare_parts'
  | 'pm'
  | 'calibration'
  | 'procurement'
  | 'departments'
  | 'reports';

export type GlobalSearchResult = {
  id: string;
  group: GlobalSearchGroupId;
  title: string;
  subtitle: string;
  href: string;
  departmentId?: string | null;
  keywords?: string[];
};

export type GlobalSearchGroup = {
  id: GlobalSearchGroupId;
  label: string;
  results: GlobalSearchResult[];
};

export type GlobalSearchProfile = {
  id: string;
  department_id: string | null;
  roleNames: string[];
};

type Client = SupabaseClient;
type Row = Record<string, unknown>;

const GROUP_LABELS: Record<GlobalSearchGroupId, string> = {
  equipment: 'Equipment',
  requests: 'Requests',
  work_orders: 'Work Orders',
  spare_parts: 'Spare Parts',
  pm: 'PM',
  calibration: 'Calibration',
  procurement: 'Procurement',
  departments: 'Departments',
  reports: 'Reports',
};

const REPORTS: Array<{ title: string; subtitle: string; href: string; keywords: string[] }> = [
  { title: 'Equipment Report', subtitle: 'Asset inventory, condition, department, category', href: '/reports/equipment', keywords: ['equipment', 'asset', 'inventory', 'condition'] },
  { title: 'Maintenance Report', subtitle: 'Work orders, requests, reliability evidence', href: '/reports/maintenance', keywords: ['maintenance', 'work order', 'request', 'mttr', 'mtbf'] },
  { title: 'PM Report', subtitle: 'Preventive maintenance compliance and overdue tasks', href: '/reports/pm', keywords: ['pm', 'preventive', 'maintenance', 'overdue'] },
  { title: 'Calibration Report', subtitle: 'Calibration due, failed, adjusted, record evidence', href: '/reports/calibration', keywords: ['calibration', 'failed', 'adjusted', 'due'] },
  { title: 'Spare Parts Report', subtitle: 'Stock, receipts, issues, low stock, blockers', href: '/reports/spare-parts', keywords: ['spare', 'parts', 'stock', 'blocker', 'receipt'] },
  { title: 'Procurement Report', subtitle: 'Procurement pipeline, delivered items, delays', href: '/reports/procurement', keywords: ['procurement', 'delivery', 'delayed', 'receipt'] },
  { title: 'QR Scan Evidence', subtitle: 'Authenticated QR scan and security evidence', href: '/reports/qr-scan-evidence', keywords: ['qr', 'scan', 'evidence', 'revoked'] },
  { title: 'QR Coverage', subtitle: 'QR label lifecycle and readiness', href: '/reports/qr-coverage', keywords: ['qr', 'coverage', 'label', 'attached'] },
];

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function normalizeGlobalSearchTerm(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/[,%()_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function like(term: string) {
  return `%${term.replace(/[%_]/g, ' ')}%`;
}

export function canSearchGroup(profile: GlobalSearchProfile, group: GlobalSearchGroupId): boolean {
  const roles = profile.roleNames;
  switch (group) {
    case 'equipment':
      return hasCapability(roles, 'nav.equipment') || hasCapability(roles, 'nav.command') || hasCapability(roles, 'reports.view');
    case 'departments':
      if (roles.includes('store_user') && !roles.some((role) => role === 'developer' || role === 'admin' || role === 'bme_head')) return false;
      return hasCapability(roles, 'nav.command') || hasCapability(roles, 'reports.view');
    case 'requests':
      return hasCapability(roles, 'nav.maintenance') || hasCapability(roles, 'nav.requests');
    case 'work_orders':
      return hasCapability(roles, 'nav.maintenance') || hasCapability(roles, 'nav.work_orders') || roles.includes('store_user');
    case 'spare_parts':
      return hasCapability(roles, 'nav.spare_parts') || hasCapability(roles, 'nav.logistics');
    case 'pm':
      return hasCapability(roles, 'nav.pm');
    case 'calibration':
      return hasCapability(roles, 'nav.calibration');
    case 'procurement':
      return hasCapability(roles, 'nav.procurement');
    case 'reports':
      return hasCapability(roles, 'reports.view');
  }
}

export function resultAllowedForDepartment(profile: GlobalSearchProfile, result: { departmentId?: string | null }): boolean {
  const scope = departmentScopeFor({ roleNames: profile.roleNames, departmentId: profile.department_id });
  if (scope.kind === 'denied') return false;
  if (scope.kind === 'department') return result.departmentId === scope.departmentId;
  return true;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function relationDepartmentId(row: Row): string | null {
  const asset = pickOne(row.equipment_assets as Row | Row[] | null | undefined);
  return text(asset?.department_id, '') || text(row.department_id, '') || null;
}

function relationAssetLabel(row: Row): string {
  const asset = pickOne(row.equipment_assets as Row | Row[] | null | undefined);
  const code = text(asset?.asset_code);
  const name = text(asset?.name);
  return [code, name].filter(Boolean).join(' · ');
}

function group(id: GlobalSearchGroupId, results: GlobalSearchResult[]): GlobalSearchGroup {
  return { id, label: GROUP_LABELS[id], results };
}

function keepScoped(profile: GlobalSearchProfile, results: GlobalSearchResult[]) {
  return results.filter((result) => resultAllowedForDepartment(profile, result));
}

async function findMatchingAssetRows(client: Client, profile: GlobalSearchProfile, term: string): Promise<Row[]> {
  if (!canSearchGroup(profile, 'equipment')) return [];
  const scope = departmentScopeFor({ roleNames: profile.roleNames, departmentId: profile.department_id });
  if (scope.kind === 'denied') return [];
  let query = client
    .from('equipment_assets')
    .select('id, asset_code, serial_number, name, department_id, departments(id, name)')
    .is('deleted_at', null)
    .or(`asset_code.ilike.${like(term)},name.ilike.${like(term)},serial_number.ilike.${like(term)}`)
    .order('asset_code', { ascending: true })
    .limit(8);
  if (scope.kind === 'department') query = query.eq('department_id', scope.departmentId);
  const { data, error } = await query;
  if (error) throw new Error(`equipment search failed: ${error.message}`);
  return ((data ?? []) as unknown) as Row[];
}

async function rowsForAssetIds(
  client: Client,
  table: string,
  select: string,
  assetIds: string[],
): Promise<Row[]> {
  if (assetIds.length === 0) return [];
  const { data, error } = await client.from(table).select(select).in('asset_id', assetIds).limit(8);
  if (error) throw new Error(`${table} asset search failed: ${error.message}`);
  return ((data ?? []) as unknown) as Row[];
}

function mergeRows(rows: Row[], key = 'id'): Row[] {
  const map = new Map<string, Row>();
  for (const row of rows) {
    const id = text(row[key]);
    if (id && !map.has(id)) map.set(id, row);
  }
  return Array.from(map.values());
}

export async function runGlobalSearch(
  client: Client,
  profile: GlobalSearchProfile,
  rawTerm: string,
): Promise<GlobalSearchGroup[]> {
  const term = normalizeGlobalSearchTerm(rawTerm);
  if (term.length < 2) return [];

  const assetRows = await findMatchingAssetRows(client, profile, term);
  const assetIds = assetRows.map((row) => text(row.id)).filter(Boolean);
  const searches: Array<Promise<GlobalSearchGroup | null>> = [];

  if (canSearchGroup(profile, 'equipment')) {
    searches.push(Promise.resolve(group('equipment', keepScoped(profile, assetRows.map((row) => ({
      id: text(row.id),
      group: 'equipment',
      title: [text(row.asset_code, 'Asset'), text(row.name)].filter(Boolean).join(' · '),
      subtitle: text(row.serial_number) ? `Serial ${text(row.serial_number)}` : 'Equipment asset',
      href: `/equipment/${text(row.id)}`,
      departmentId: text(row.department_id) || null,
    }))))));
  }

  if (canSearchGroup(profile, 'requests')) {
    searches.push((async () => {
      const [direct, byAsset] = await Promise.all([
        client
          .from('maintenance_requests')
          .select('id, request_number, fault_description, status, urgency, department_id, asset_id, equipment_assets(id, asset_code, name, department_id)')
          .or(`request_number.ilike.${like(term)},fault_description.ilike.${like(term)}`)
          .order('created_at', { ascending: false })
          .limit(8),
        rowsForAssetIds(client, 'maintenance_requests', 'id, request_number, fault_description, status, urgency, department_id, asset_id, equipment_assets(id, asset_code, name, department_id)', assetIds),
      ]);
      if (direct.error) throw new Error(`request search failed: ${direct.error.message}`);
      const rows = mergeRows([...(direct.data ?? []) as Row[], ...byAsset]).slice(0, 8);
      return group('requests', keepScoped(profile, rows.map((row) => ({
        id: text(row.id),
        group: 'requests',
        title: text(row.request_number, `Request ${text(row.id).slice(0, 8)}`),
        subtitle: [text(row.status), text(row.urgency), relationAssetLabel(row)].filter(Boolean).join(' · '),
        href: `/maintenance/requests/${text(row.id)}`,
        departmentId: relationDepartmentId(row),
      }))));
    })());
  }

  if (canSearchGroup(profile, 'work_orders')) {
    searches.push((async () => {
      const [direct, byAsset] = await Promise.all([
        client
          .from('work_orders')
          .select('id, work_order_number, status, priority, asset_id, equipment_assets(id, asset_code, name, department_id)')
          .or(`work_order_number.ilike.${like(term)},status.ilike.${like(term)},priority.ilike.${like(term)}`)
          .order('created_at', { ascending: false })
          .limit(8),
        rowsForAssetIds(client, 'work_orders', 'id, work_order_number, status, priority, asset_id, equipment_assets(id, asset_code, name, department_id)', assetIds),
      ]);
      if (direct.error) throw new Error(`work order search failed: ${direct.error.message}`);
      const rows = mergeRows([...(direct.data ?? []) as Row[], ...byAsset]).slice(0, 8);
      return group('work_orders', keepScoped(profile, rows.map((row) => ({
        id: text(row.id),
        group: 'work_orders',
        title: text(row.work_order_number, `WO ${text(row.id).slice(0, 8)}`),
        subtitle: [text(row.status), text(row.priority), relationAssetLabel(row)].filter(Boolean).join(' · '),
        href: `/maintenance/work-orders/${text(row.id)}`,
        departmentId: relationDepartmentId(row),
      }))));
    })());
  }

  if (canSearchGroup(profile, 'spare_parts')) {
    searches.push((async () => {
      const { data, error } = await client
        .from('spare_parts')
        .select('id, part_code, name, current_stock, reorder_level')
        .or(`part_code.ilike.${like(term)},name.ilike.${like(term)}`)
        .order('part_code', { ascending: true })
        .limit(8);
      if (error) throw new Error(`spare parts search failed: ${error.message}`);
      return group('spare_parts', ((data ?? []) as Row[]).map((row) => ({
        id: text(row.id),
        group: 'spare_parts',
        title: [text(row.part_code, 'Part'), text(row.name)].filter(Boolean).join(' · '),
        subtitle: `Stock ${Number(row.current_stock ?? 0)} · reorder ${Number(row.reorder_level ?? 0)}`,
        href: `/spare-parts?partId=${encodeURIComponent(text(row.id))}`,
      })));
    })());
  }

  if (canSearchGroup(profile, 'pm')) {
    searches.push((async () => {
      const rows = await rowsForAssetIds(client, 'pm_schedules', 'id, status, scheduled_date, asset_id, equipment_assets(id, asset_code, name, department_id), pm_plans(id, name)', assetIds);
      return group('pm', keepScoped(profile, rows.map((row) => {
        const plan = pickOne(row.pm_plans as Row | Row[] | null | undefined);
        return {
          id: text(row.id),
          group: 'pm',
          title: text(plan?.name, 'PM schedule'),
          subtitle: [text(row.status), text(row.scheduled_date), relationAssetLabel(row)].filter(Boolean).join(' · '),
          href: `/pm/schedules/${text(row.id)}`,
          departmentId: relationDepartmentId(row),
        };
      })));
    })());
  }

  if (canSearchGroup(profile, 'calibration')) {
    searches.push((async () => {
      const [requests, records] = await Promise.all([
        client
          .from('calibration_requests')
          .select('id, request_number, status, urgency, asset_id, equipment_assets(id, asset_code, name, department_id)')
          .or(`request_number.ilike.${like(term)},status.ilike.${like(term)},urgency.ilike.${like(term)}`)
          .order('created_at', { ascending: false })
          .limit(5),
        rowsForAssetIds(client, 'calibration_records', 'id, result, calibration_date, next_due_date, asset_id, equipment_assets(id, asset_code, name, department_id)', assetIds),
      ]);
      if (requests.error) throw new Error(`calibration request search failed: ${requests.error.message}`);
      const requestResults = ((requests.data ?? []) as Row[]).map((row) => ({
        id: text(row.id),
        group: 'calibration' as const,
        title: text(row.request_number, `Calibration request ${text(row.id).slice(0, 8)}`),
        subtitle: [text(row.status), text(row.urgency), relationAssetLabel(row)].filter(Boolean).join(' · '),
        href: `/calibration/requests/${text(row.id)}`,
        departmentId: relationDepartmentId(row),
      }));
      const recordResults = records.map((row) => ({
        id: text(row.id),
        group: 'calibration' as const,
        title: `Calibration ${text(row.result, 'record')}`,
        subtitle: [text(row.calibration_date), relationAssetLabel(row)].filter(Boolean).join(' · '),
        href: `/calibration/records/${text(row.id)}`,
        departmentId: relationDepartmentId(row),
      }));
      return group('calibration', keepScoped(profile, [...requestResults, ...recordResults]).slice(0, 8));
    })());
  }

  if (canSearchGroup(profile, 'procurement')) {
    searches.push((async () => {
      const { data, error } = await client
        .from('procurement_requests')
        .select('id, request_number, title, status, priority, department_id')
        .or(`request_number.ilike.${like(term)},title.ilike.${like(term)},status.ilike.${like(term)}`)
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw new Error(`procurement search failed: ${error.message}`);
      return group('procurement', keepScoped(profile, ((data ?? []) as Row[]).map((row) => ({
        id: text(row.id),
        group: 'procurement',
        title: text(row.request_number, `PR ${text(row.id).slice(0, 8)}`),
        subtitle: [text(row.title), text(row.status), text(row.priority)].filter(Boolean).join(' · '),
        href: `/command/drilldown/procurement/${text(row.id)}`,
        departmentId: text(row.department_id) || null,
      }))));
    })());
  }

  if (canSearchGroup(profile, 'departments')) {
    searches.push((async () => {
      const scope = departmentScopeFor({ roleNames: profile.roleNames, departmentId: profile.department_id });
      if (scope.kind === 'denied') return group('departments', []);
      let query = client
        .from('departments')
        .select('id, name, code')
        .or(`name.ilike.${like(term)},code.ilike.${like(term)}`)
        .order('name', { ascending: true })
        .limit(6);
      if (scope.kind === 'department') query = query.eq('id', scope.departmentId);
      const { data, error } = await query;
      if (error) throw new Error(`department search failed: ${error.message}`);
      return group('departments', ((data ?? []) as Row[]).map((row) => ({
        id: text(row.id),
        group: 'departments',
        title: text(row.name, 'Department'),
        subtitle: text(row.code, 'Department'),
        href: `/command?department_id=${encodeURIComponent(text(row.id))}`,
        departmentId: text(row.id) || null,
      })));
    })());
  }

  if (canSearchGroup(profile, 'reports')) {
    const q = term.toLowerCase();
    searches.push(Promise.resolve(group('reports', REPORTS
      .filter((report) => `${report.title} ${report.subtitle} ${report.keywords.join(' ')}`.toLowerCase().includes(q))
      .slice(0, 6)
      .map((report) => ({
        id: report.href,
        group: 'reports' as const,
        title: report.title,
        subtitle: report.subtitle,
        href: report.href,
      })))));
  }

  const groups = (await Promise.all(searches)).filter(Boolean) as GlobalSearchGroup[];
  return groups.filter((item) => item.results.length > 0);
}
