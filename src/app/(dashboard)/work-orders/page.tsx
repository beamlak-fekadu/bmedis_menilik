'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { PageHeader, DataTable, Button, Spinner } from '@/components/ui';
import { UrgencyBadge, WorkOrderStatusBadge } from '@/components/ui/StatusBadge';
import { getWorkOrders } from '@/services/maintenance.service';
import { useToast } from '@/components/ui/Toast';
import { useRole } from '@/hooks/useRole';
import type { WorkOrder } from '@/types/database';
import { ROUTES } from '@/constants';

type WorkOrderRow = WorkOrder & {
  equipment_assets?: { id: string; asset_code?: string | null; name?: string | null } | Array<{ id: string; asset_code?: string | null; name?: string | null }> | null;
  profiles?: { id: string; full_name?: string | null; email?: string | null } | Array<{ id: string; full_name?: string | null; email?: string | null }> | null;
  [key: string]: unknown;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default function WorkOrdersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { canManageMaintenance } = useRole();
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await getWorkOrders();
      if (error) toast('error', 'Failed to load work orders');
      setWorkOrders((data ?? []) as unknown as WorkOrderRow[]);
      setLoading(false);
    }
    load();
  }, [toast]);

  const columns = [
    { key: 'work_order_number', header: 'WO #', sortable: true },
    {
      key: 'asset_name',
      header: 'Asset',
      sortable: true,
      render: (row: WorkOrderRow) => {
        const asset = firstRelation(row.equipment_assets);
        return asset?.name ?? asset?.asset_code ?? '—';
      },
    },
    {
      key: 'assigned_to_name',
      header: 'Assigned To',
      render: (row: WorkOrderRow) => firstRelation(row.profiles)?.full_name ?? 'Unassigned',
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (row: WorkOrderRow) => <UrgencyBadge urgency={row.priority} />,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row: WorkOrderRow) => <WorkOrderStatusBadge status={row.status} />,
    },
    {
      key: 'work_type',
      header: 'Type',
      sortable: true,
      render: (row: WorkOrderRow) =>
        row.work_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    },
    {
      key: 'started_at',
      header: 'Started',
      sortable: true,
      render: (row: WorkOrderRow) =>
        row.started_at ? new Date(row.started_at).toLocaleDateString() : '—',
    },
    {
      key: 'completed_at',
      header: 'Completed',
      sortable: true,
      render: (row: WorkOrderRow) =>
        row.completed_at ? new Date(row.completed_at).toLocaleDateString() : '—',
    },
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
        title="Work Orders"
        description="Track and manage all corrective and preventive work orders"
        breadcrumbs={[{ label: 'Command Center', href: ROUTES.COMMAND }, { label: 'Work Orders' }]}
        actions={
          canManageMaintenance ? (
            <Link href={`${ROUTES.MAINTENANCE_WORK_ORDERS}/new`}>
              <Button size="sm">
                <Wrench className="h-4 w-4" />
                New Work Order
              </Button>
            </Link>
          ) : undefined
        }
      />

      <DataTable<WorkOrderRow>
        columns={columns}
        data={workOrders}
        searchPlaceholder="Search work orders…"
        onRowClick={(row) => router.push(`${ROUTES.MAINTENANCE_WORK_ORDERS}/${row.id}`)}
        emptyMessage="No work orders found"
        pageSize={25}
      />
    </div>
  );
}
