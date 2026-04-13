'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, CheckCircle2, AlertTriangle, Clock3 } from 'lucide-react';
import { PageHeader, StatCard, Card, CardHeader, CardTitle, DataTable, Badge } from '@/components/ui';
import { WorkOrderStatusBadge, UrgencyBadge } from '@/components/ui/StatusBadge';
import { getMaintenanceRequests, getWorkOrders } from '@/services/maintenance.service';
import type { MaintenanceRequest, WorkOrder } from '@/types/database';

type WorkOrderRow = WorkOrder & Record<string, unknown>;

export default function WorkOrderDashboardPage() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [requestRes, workOrderRes] = await Promise.all([getMaintenanceRequests(), getWorkOrders()]);
      setRequests((requestRes.data ?? []) as MaintenanceRequest[]);
      setWorkOrders((workOrderRes.data ?? []) as WorkOrder[]);
      setLoading(false);
    }
    load();
  }, []);

  const summary = useMemo(() => {
    const completed = workOrders.filter((wo) => wo.status === 'completed').length;
    const open = workOrders.filter((wo) => ['open', 'assigned', 'in_progress', 'on_hold'].includes(wo.status)).length;
    const overdue = workOrders.filter((wo) => wo.status !== 'completed' && wo.status !== 'canceled').length;
    return {
      totalRequests: requests.length,
      completed,
      open,
      overdue,
    };
  }, [requests, workOrders]);

  const statusCounts = workOrders.reduce<Record<string, number>>((acc, wo) => {
    acc[wo.status] = (acc[wo.status] ?? 0) + 1;
    return acc;
  }, {});

  const requestTypeCounts = requests.reduce<Record<string, number>>((acc, req) => {
    const key = req.urgency ?? 'unspecified';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const columns = [
    { key: 'work_order_number', header: 'Work Order', sortable: true },
    {
      key: 'equipment_assets',
      header: 'Asset',
      render: (row: WorkOrderRow) =>
        (row as unknown as { equipment_assets?: { asset_code: string; name: string } }).equipment_assets
          ? `${(row as unknown as { equipment_assets: { asset_code: string; name: string } }).equipment_assets.asset_code} - ${(row as unknown as { equipment_assets: { asset_code: string; name: string } }).equipment_assets.name}`
          : 'N/A',
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (row: WorkOrderRow) => <UrgencyBadge urgency={row.priority} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: WorkOrderRow) => <WorkOrderStatusBadge status={row.status} />,
    },
    {
      key: 'profiles',
      header: 'Assigned To',
      render: (row: WorkOrderRow) =>
        (row as unknown as { profiles?: { full_name: string } }).profiles?.full_name ?? 'Unassigned',
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (row: WorkOrderRow) => new Date(row.created_at).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Order Dashboard"
        description="Operational overview of requests, execution status, and assignment visibility."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Requests" value={summary.totalRequests} icon={<ClipboardList className="h-6 w-6" />} color="blue" />
        <StatCard label="Completed Work Orders" value={summary.completed} icon={<CheckCircle2 className="h-6 w-6" />} color="green" />
        <StatCard label="Open Work Orders" value={summary.open} icon={<Clock3 className="h-6 w-6" />} color="yellow" />
        <StatCard label="Overdue / Active" value={summary.overdue} icon={<AlertTriangle className="h-6 w-6" />} color="red" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Work Orders by Status</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            {Object.entries(statusCounts).map(([key, value]) => (
              <Badge key={key} variant="info">
                {key.replace(/_/g, ' ')}: {value}
              </Badge>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Requests by Urgency</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            {Object.entries(requestTypeCounts).map(([key, value]) => (
              <Badge key={key} variant="warning">
                {key}: {value}
              </Badge>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tracking Table</CardTitle>
        </CardHeader>
        <DataTable<WorkOrderRow>
          columns={columns}
          data={workOrders as unknown as WorkOrderRow[]}
          loading={loading}
          searchPlaceholder="Search work orders..."
          emptyMessage="No work orders found"
        />
      </Card>
    </div>
  );
}
