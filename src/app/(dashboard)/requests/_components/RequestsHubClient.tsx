'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ClipboardList,
  FileSearch,
  Gauge,
  GraduationCap,
  PackageCheck,
  Search,
  Trash2,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Badge, Card, CardHeader, CardTitle, Pagination } from '@/components/ui';
import type { RequestsHubData, RequestHubRow, RequestHubStatus, RequestHubType } from '../_lib/requests-hub-data';

const ICONS: Record<RequestHubType, LucideIcon> = {
  maintenance: Wrench,
  calibration: Gauge,
  training: GraduationCap,
  procurement: ClipboardList,
  disposal: Trash2,
  installation: PackageCheck,
  specification: FileSearch,
};

const STATUS_VARIANT: Record<RequestHubStatus, 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'> = {
  submitted: 'info',
  pending: 'warning',
  approved: 'info',
  assigned: 'purple',
  in_progress: 'purple',
  on_hold: 'warning',
  completed: 'success',
  rejected: 'error',
  cancelled: 'default',
};

const ACTION_LINK =
  'inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand)]';
const PRIMARY_LINK = `${ACTION_LINK} bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]`;
const OUTLINE_LINK = `${ACTION_LINK} border border-[var(--border-subtle)] text-[var(--foreground)] hover:bg-[var(--surface-2)]`;
const GHOST_LINK = `${ACTION_LINK} text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]`;

function matchesScope(row: RequestHubRow, scope: string, profileId: string, departmentId: string | null) {
  if (scope === 'all') return true;
  if (scope === 'mine') return row.submittedById === profileId;
  if (scope === 'my_department') return Boolean(departmentId && row.departmentId === departmentId);
  if (scope === 'pending') return row.normalizedStatus === 'pending' || row.normalizedStatus === 'submitted';
  if (scope === 'in_progress') return row.normalizedStatus === 'in_progress' || row.normalizedStatus === 'on_hold' || row.normalizedStatus === 'assigned';
  if (scope === 'completed') return row.normalizedStatus === 'completed';
  return true;
}

function searchRow(row: RequestHubRow, search: string) {
  if (!search.trim()) return true;
  const haystack = [
    row.requestNumber,
    row.typeLabel,
    row.title,
    row.assetName,
    row.departmentName,
    row.submittedBy,
    row.statusLabel,
    row.owner,
    row.assignee,
  ].join(' ').toLowerCase();
  return haystack.includes(search.toLowerCase());
}

function formatDate(value: string | null) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleDateString();
}

export default function RequestsHubClient({ data }: { data: RequestsHubData }) {
  const defaultScope = data.roleScope.quickFilters[0]?.id ?? 'all';
  const [selectedType, setSelectedType] = useState<RequestHubType | 'all'>('all');
  const [scopeFilter, setScopeFilter] = useState(defaultScope);
  const [statusFilter, setStatusFilter] = useState<RequestHubStatus | 'all'>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const departments = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of data.unifiedRequests) {
      if (row.departmentId && row.departmentName) seen.set(row.departmentId, row.departmentName);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data.unifiedRequests]);

  const filteredRows = useMemo(() => {
    return data.unifiedRequests.filter((row) => {
      if (selectedType !== 'all' && row.type !== selectedType) return false;
      if (statusFilter !== 'all' && row.normalizedStatus !== statusFilter) return false;
      if (departmentFilter !== 'all' && row.departmentId !== departmentFilter) return false;
      if (!matchesScope(row, scopeFilter, data.roleScope.profileId, data.roleScope.departmentId)) return false;
      return searchRow(row, search);
    });
  }, [data.roleScope.departmentId, data.roleScope.profileId, data.unifiedRequests, departmentFilter, scopeFilter, search, selectedType, statusFilter]);

  const totalPages = Math.ceil(filteredRows.length / pageSize);
  const pageRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const setFilter = (setter: () => void) => {
    setter();
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {data.categoryCards.map((card) => {
          const Icon = ICONS[card.type];
          const active = selectedType === card.type;
          return (
            <button
              key={card.type}
              type="button"
              onClick={() => setFilter(() => setSelectedType(active ? 'all' : card.type))}
              className={`panel-surface rounded-lg p-4 text-left transition-colors hover:border-[var(--brand)]/60 ${
                active ? 'border-[var(--brand)]/70 bg-[var(--brand)]/10' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-muted)]">{card.label}</p>
                  <p className="mt-1 text-xl font-bold text-[var(--foreground)] xl:text-2xl">{card.configured ? card.total : '0'}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-[var(--brand)]/15 p-1.5 text-[var(--brand)]">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                {card.configured ? `${card.open} open • ${card.countLabel}` : 'Not configured'}
              </p>
              <p className="mt-1 truncate text-xs text-[var(--text-muted)]">Owner: {card.owner}</p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {data.workflowCards.map((card) => {
          const Icon = ICONS[card.type];
          const canShowMainAction = data.roleScope.canMutate && card.canCreate;
          return (
            <Card key={card.type} className="flex h-full flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-[var(--surface-3)] p-2 text-[var(--brand)]">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{card.type === 'maintenance' ? 'Corrective Maintenance Requests' : card.type === 'specification' ? 'Specification Requests' : `${card.label} ${card.countLabel === 'records' ? '' : 'Requests'}`}</p>
                    <Badge variant={card.configured ? 'info' : 'default'}>{card.configured ? card.pendingActionLabel : 'Not configured'}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{card.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Total</p>
                  <p className="font-semibold text-[var(--foreground)]">{card.total} {card.countLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Pending / Open</p>
                  <p className="font-semibold text-[var(--foreground)]">{card.open}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-[var(--text-muted)]">Owner / Reviewer</p>
                  <p className="font-semibold text-[var(--foreground)]">{card.owner}</p>
                </div>
              </div>

              {card.type === 'disposal' && card.replacementCandidateCount != null ? (
                <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-muted)]">
                  {card.replacementCandidateCount} replacement candidates can inform disposal, but they are not counted as disposal requests.
                </p>
              ) : null}

              <div className="mt-auto flex flex-wrap gap-2">
                {canShowMainAction ? (
                  <Link href={card.mainActionHref} className={PRIMARY_LINK}>
                    {card.mainActionLabel}
                  </Link>
                ) : null}
                {card.canOpenWorkflow ? (
                  <Link href={card.secondaryActionHref} className={OUTLINE_LINK}>
                    {card.secondaryActionLabel}
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => setFilter(() => setSelectedType(card.type))}
                  className={GHOST_LINK}
                >
                  Filter Table
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted)]">{card.note}</p>
            </Card>
          );
        })}
      </div>

      <Card padding={false}>
        <CardHeader className="mb-0 border-b border-[var(--border-subtle)] p-5">
          <div>
            <CardTitle>Unified Request Table</CardTitle>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{data.roleScope.scopeLabel}</p>
          </div>
          <Badge variant="info">Role-based visibility enabled</Badge>
        </CardHeader>

        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            {data.roleScope.quickFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setFilter(() => setScopeFilter(filter.id))}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  scopeFilter === filter.id
                    ? 'border-[var(--brand)] bg-[var(--brand)]/15 text-[var(--foreground)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_220px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={search}
                onChange={(event) => setFilter(() => setSearch(event.target.value))}
                placeholder="Search request #, type, asset, department, owner..."
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] py-2 pl-9 pr-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              />
            </label>
            <select
              value={selectedType}
              onChange={(event) => setFilter(() => setSelectedType(event.target.value as RequestHubType | 'all'))}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            >
              <option value="all">All types</option>
              {data.categoryCards.map((card) => (
                <option key={card.type} value={card.type}>{card.label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setFilter(() => setStatusFilter(event.target.value as RequestHubStatus | 'all'))}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            >
              <option value="all">All statuses</option>
              <option value="submitted">Submitted</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In progress</option>
              <option value="on_hold">On hold</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={departmentFilter}
              onChange={(event) => setFilter(() => setDepartmentFilter(event.target.value))}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            >
              <option value="all">All departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--border-subtle)]">
            <thead className="bg-[var(--surface-3)]/60">
              <tr>
                {['Request #', 'Type', 'Asset / Subject', 'Department', 'Submitted By', 'Status', 'Owner / Assignee', 'Created', 'Next Action'].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-[var(--text-muted)]">
                    No request activity matches the current filters.
                  </td>
                </tr>
              ) : pageRows.map((row) => (
                <tr key={`${row.type}-${row.id}`} className="hover:bg-[var(--surface-3)]/40">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-[var(--foreground)]">
                    <Link href={row.exactHref} className="text-[var(--brand)] hover:underline">{row.requestNumber}</Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--foreground)]">{row.typeLabel}</td>
                  <td className="max-w-xs px-4 py-3 text-sm text-[var(--foreground)]">
                    <p className="line-clamp-2">{row.assetName ?? row.title}</p>
                    {row.assetName ? <p className="mt-1 line-clamp-1 text-xs text-[var(--text-muted)]">{row.title}</p> : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--foreground)]">{row.departmentName ?? 'Not scoped'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--foreground)]">{row.submittedBy ?? 'System / record'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <Badge variant={STATUS_VARIANT[row.normalizedStatus]}>{row.statusLabel}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--foreground)]">
                    {row.assignee ?? row.owner}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--foreground)]">{formatDate(row.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <Link href={row.nextActionHref} className={OUTLINE_LINK}>
                      {row.canMutate ? row.nextActionLabel : row.normalizedStatus === 'completed' ? 'View Result' : 'View Status'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filteredRows.length} pageSize={pageSize} />
      </Card>
    </div>
  );
}
