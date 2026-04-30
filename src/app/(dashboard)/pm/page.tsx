'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, AlertTriangle } from 'lucide-react';
import { PageHeader, DataTable, Tabs, Table, Button, Badge, Spinner } from '@/components/ui';
import { PMStatusBadge } from '@/components/ui/StatusBadge';
import { getPMPlans, getPMSchedules, getOverduePMSchedules } from '@/services/pm.service';
import { getPMComplianceMetrics } from '@/services/analytics.service';
import { useToast } from '@/components/ui/Toast';
import type { PMPlan, PMSchedule } from '@/types/database';

interface PMComplianceDeptRow {
  department_id: string;
  department_name: string;
  avg_pmc: number;
  plan_count: number;
}
import { AskAiButton } from '@/components/assistant/AskAiButton';

type PlanWithJoins = PMPlan & {
  equipment_assets?: { id: string; asset_code: string; name: string };
  pm_templates?: { id: string; name: string; frequency_days: number };
  [key: string]: unknown;
};

type ScheduleWithJoins = PMSchedule & {
  pm_plans?: { id: string; name: string; frequency_days: number };
  equipment_assets?: { id: string; asset_code: string; name: string };
  profiles?: { id: string; full_name: string; email: string };
  [key: string]: unknown;
};

interface OverduePM {
  id: string;
  scheduled_date: string;
  status: string;
  plan_name: string;
  asset_code: string;
  asset_name: string;
  department_name: string;
  category_name: string;
  assigned_to_name: string | null;
  days_overdue: number;
  [key: string]: unknown;
}

export default function PMPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [plans, setPlans] = useState<PlanWithJoins[]>([]);
  const [schedules, setSchedules] = useState<ScheduleWithJoins[]>([]);
  const [overdue, setOverdue] = useState<OverduePM[]>([]);
  const [deptCompliance, setDeptCompliance] = useState<PMComplianceDeptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [planRes, schedRes, overdueRes, pmcRes] = await Promise.all([
        getPMPlans(),
        getPMSchedules(),
        getOverduePMSchedules(),
        getPMComplianceMetrics(), // fetch all rows; grouped by department in component
      ]);
      if (planRes.error) toast('error', 'Failed to load PM plans');
      if (schedRes.error) toast('error', 'Failed to load PM schedules');
      if (overdueRes.error) toast('error', 'Failed to load overdue PMs');
      setPlans((planRes.data ?? []) as unknown as PlanWithJoins[]);
      setSchedules((schedRes.data ?? []) as unknown as ScheduleWithJoins[]);
      setOverdue((overdueRes.data ?? []) as unknown as OverduePM[]);

      // Aggregate pm_compliance_metrics by department — every department with at least one PM plan
      const pmcRows = (pmcRes.data ?? []) as Array<{
        department_id?: string;
        pmc_percentage?: number;
        departments?: { name?: string } | null;
      }>;
      const deptMap = new Map<string, { name: string; totalPmc: number; count: number }>();
      for (const row of pmcRows) {
        if (!row.department_id) continue;
        const name = row.departments?.name ?? 'Unknown';
        const existing = deptMap.get(row.department_id) ?? { name, totalPmc: 0, count: 0 };
        existing.totalPmc += row.pmc_percentage ?? 0;
        existing.count += 1;
        deptMap.set(row.department_id, existing);
      }
      setDeptCompliance(
        Array.from(deptMap.entries()).map(([id, { name, totalPmc, count }]) => ({
          department_id: id,
          department_name: name,
          avg_pmc: count > 0 ? totalPmc / count : 0,
          plan_count: count,
        })).sort((a, b) => a.department_name.localeCompare(b.department_name))
      );
      setLoading(false);
    }
    load();
  }, [toast]);

  const planColumns = [
    { key: 'name', header: 'Plan Name', sortable: true },
    {
      key: 'asset',
      header: 'Asset',
      render: (row: PlanWithJoins) =>
        row.equipment_assets
          ? `${row.equipment_assets.asset_code} — ${row.equipment_assets.name}`
          : '—',
    },
    {
      key: 'frequency_days',
      header: 'Frequency',
      sortable: true,
      render: (row: PlanWithJoins) => `Every ${row.frequency_days} days`,
    },
    {
      key: 'next_due_date',
      header: 'Next Due',
      sortable: true,
      render: (row: PlanWithJoins) =>
        row.next_due_date ? new Date(row.next_due_date).toLocaleDateString() : '—',
    },
    {
      key: 'last_completed_date',
      header: 'Last Completed',
      sortable: true,
      render: (row: PlanWithJoins) =>
        row.last_completed_date ? new Date(row.last_completed_date).toLocaleDateString() : 'Never',
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row: PlanWithJoins) =>
        row.is_active
          ? <Badge variant="success">Active</Badge>
          : <Badge variant="default">Inactive</Badge>,
    },
  ];

  const scheduleColumns = [
    {
      key: 'scheduled_date',
      header: 'Scheduled Date',
      sortable: true,
      render: (row: ScheduleWithJoins) => new Date(row.scheduled_date).toLocaleDateString(),
    },
    {
      key: 'asset',
      header: 'Asset',
      render: (row: ScheduleWithJoins) =>
        row.equipment_assets
          ? `${row.equipment_assets.asset_code} — ${row.equipment_assets.name}`
          : '—',
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (row: ScheduleWithJoins) => row.pm_plans?.name ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row: ScheduleWithJoins) => <PMStatusBadge status={row.status} />,
    },
    {
      key: 'assigned_to',
      header: 'Assigned To',
      render: (row: ScheduleWithJoins) => row.profiles?.full_name ?? 'Unassigned',
    },
  ];

  const overdueColumns = [
    {
      key: 'asset_name',
      header: 'Asset',
      render: (row: OverduePM) => `${row.asset_code} — ${row.asset_name}`,
    },
    { key: 'plan_name', header: 'Plan' },
    {
      key: 'scheduled_date',
      header: 'Scheduled',
      render: (row: OverduePM) => new Date(row.scheduled_date).toLocaleDateString(),
    },
    {
      key: 'days_overdue',
      header: 'Days Overdue',
      render: (row: OverduePM) => (
        <span className="font-semibold text-red-600 dark:text-red-400">{row.days_overdue}</span>
      ),
    },
    {
      key: 'assigned_to_name',
      header: 'Assigned To',
      render: (row: OverduePM) => row.assigned_to_name ?? 'Unassigned',
    },
    { key: 'department_name', header: 'Department' },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Preventive Maintenance"
        description="Manage PM plans, schedules, and track overdue tasks"
        breadcrumbs={[{ label: 'Command Center', href: '/command' }, { label: 'Preventive Maintenance' }]}
        actions={
          <AskAiButton
            moduleLabel="Preventive Maintenance"
            label="Explain PM issues"
            seedPrompt="Explain overdue PM concerns and what should be prioritized first."
          />
        }
      />

      {/* PM Compliance by Department */}
      {deptCompliance.length > 0 && (
        <div className="mb-6 panel-surface rounded-lg p-5">
          <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">PM Compliance by Department</h2>
          <div className="space-y-2">
            {deptCompliance.map((dept) => (
              <div key={dept.department_id} className="flex items-center gap-3">
                <span className="w-40 truncate text-sm text-[var(--foreground)]">{dept.department_name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full ${dept.avg_pmc >= 80 ? 'bg-emerald-500' : dept.avg_pmc >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(100, dept.avg_pmc)}%` }}
                    aria-label={`${dept.avg_pmc.toFixed(0)}%`}
                  />
                </div>
                <span className={`w-12 text-right text-sm font-medium ${dept.avg_pmc >= 80 ? 'text-emerald-300' : dept.avg_pmc >= 60 ? 'text-amber-300' : 'text-rose-300'}`}>
                  {dept.avg_pmc.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs
        tabs={[
          {
            id: 'plans',
            label: 'Plans',
            count: plans.length,
            content: (
              <DataTable<PlanWithJoins>
                columns={planColumns}
                data={plans}
                searchPlaceholder="Search plans…"
                emptyMessage="No PM plans found"
                actions={
                  <Link href="/pm/plans/new">
                    <Button size="sm">
                      <Plus className="h-4 w-4" />
                      New Plan
                    </Button>
                  </Link>
                }
              />
            ),
          },
          {
            id: 'schedules',
            label: 'Schedules',
            count: schedules.length,
            content: (
              <DataTable<ScheduleWithJoins>
                columns={scheduleColumns}
                data={schedules}
                searchPlaceholder="Search schedules…"
                onRowClick={(row) => router.push(`/pm/schedules/${row.id}`)}
                emptyMessage="No PM schedules found"
              />
            ),
          },
          {
            id: 'overdue',
            label: 'Overdue',
            count: overdue.length,
            content: overdue.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-16 text-center dark:border-gray-700">
                <AlertTriangle className="mb-4 h-12 w-12 text-gray-400 dark:text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">No Overdue PMs</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">All preventive maintenance is up to date.</p>
              </div>
            ) : (
              <Table<OverduePM>
                columns={overdueColumns}
                data={overdue}
                onRowClick={(row) => router.push(`/pm/schedules/${row.id}`)}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
