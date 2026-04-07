'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Wrench, ClipboardList } from 'lucide-react';
import { PageHeader, DataTable, Tabs, Button, Spinner } from '@/components/ui';
import { UrgencyBadge, WorkOrderStatusBadge, RequestStatusBadge } from '@/components/ui/StatusBadge';
import { getMaintenanceRequests, getWorkOrders } from '@/services/maintenance.service';
import { useToast } from '@/components/ui/Toast';
import type { MaintenanceRequest, WorkOrder } from '@/types/database';

export default function MaintenancePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [reqRes, woRes] = await Promise.all([
        getMaintenanceRequests(),
        getWorkOrders(),
      ]);
      if (reqRes.error) toast('error', 'Failed to load maintenance requests');
      if (woRes.error) toast('error', 'Failed to load work orders');
      setRequests((reqRes.data ?? []) as MaintenanceRequest[]);
      setWorkOrders((woRes.data ?? []) as WorkOrder[]);
      setLoading(false);
    }
    load();
  }, [toast]);

  const requestColumns = [
    { key: 'request_number', header: 'Request #', sortable: true },
    {
      key: 'asset_name',
      header: 'Asset',
      sortable: true,
      render: (row: MaintenanceRequest) =>
        (row as unknown as Record<string, unknown>).equipment_assets
          ? ((row as unknown as Record<string, Record<string, string>>).equipment_assets.name)
          : '—',
    },
    {
      key: 'department_name',
      header: 'Department',
      render: (row: MaintenanceRequest) =>
        (row as unknown as Record<string, unknown>).departments
          ? ((row as unknown as Record<string, Record<string, string>>).departments.name)
          : '—',
    },
    {
      key: 'fault_description',
      header: 'Fault Description',
      render: (row: MaintenanceRequest) =>
        row.fault_description.length > 60
          ? `${row.fault_description.slice(0, 60)}…`
          : row.fault_description,
      className: 'max-w-[280px]',
    },
    {
      key: 'urgency',
      header: 'Urgency',
      sortable: true,
      render: (row: MaintenanceRequest) => <UrgencyBadge urgency={row.urgency} />,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row: MaintenanceRequest) => <RequestStatusBadge status={row.status} />,
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (row: MaintenanceRequest) => new Date(row.created_at).toLocaleDateString(),
    },
  ];

  const woColumns = [
    { key: 'work_order_number', header: 'WO #', sortable: true },
    {
      key: 'asset_name',
      header: 'Asset',
      sortable: true,
      render: (row: WorkOrder) =>
        (row as unknown as Record<string, unknown>).equipment_assets
          ? ((row as unknown as Record<string, Record<string, string>>).equipment_assets.name)
          : '—',
    },
    {
      key: 'assigned_to_name',
      header: 'Assigned To',
      render: (row: WorkOrder) =>
        (row as unknown as Record<string, unknown>).profiles
          ? ((row as unknown as Record<string, Record<string, string>>).profiles.full_name)
          : 'Unassigned',
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (row: WorkOrder) => <UrgencyBadge urgency={row.priority} />,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row: WorkOrder) => <WorkOrderStatusBadge status={row.status} />,
    },
    {
      key: 'work_type',
      header: 'Type',
      sortable: true,
      render: (row: WorkOrder) =>
        row.work_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    },
    {
      key: 'started_at',
      header: 'Started',
      sortable: true,
      render: (row: WorkOrder) =>
        row.started_at ? new Date(row.started_at).toLocaleDateString() : '—',
    },
    {
      key: 'completed_at',
      header: 'Completed',
      sortable: true,
      render: (row: WorkOrder) =>
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
        title="Maintenance"
        description="Manage maintenance requests and work orders"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Maintenance' }]}
      />

      <Tabs
        tabs={[
          {
            id: 'requests',
            label: 'Requests',
            count: requests.length,
            content: (
              <DataTable
                columns={requestColumns as any}
                data={requests as unknown as Record<string, unknown>[]}
                searchPlaceholder="Search requests…"
                onRowClick={(row) => router.push(`/maintenance/requests/${(row as Record<string, unknown>).id}`)}
                emptyMessage="No maintenance requests found"
                actions={
                  <Link href="/maintenance/requests/new">
                    <Button size="sm">
                      <ClipboardList className="h-4 w-4" />
                      New Request
                    </Button>
                  </Link>
                }
              />
            ),
          },
          {
            id: 'work-orders',
            label: 'Work Orders',
            count: workOrders.length,
            content: (
              <DataTable
                columns={woColumns as any}
                data={workOrders as unknown as Record<string, unknown>[]}
                searchPlaceholder="Search work orders…"
                onRowClick={(row) => router.push(`/maintenance/work-orders/${(row as Record<string, unknown>).id}`)}
                emptyMessage="No work orders found"
                actions={
                  <Link href="/maintenance/work-orders/new">
                    <Button size="sm">
                      <Wrench className="h-4 w-4" />
                      New Work Order
                    </Button>
                  </Link>
                }
              />
            ),
          },
        ]}
      />
    </div>
  );
}
