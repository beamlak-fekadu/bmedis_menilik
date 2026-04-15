'use client';

import { useEffect, useMemo, useState } from 'react';
import { Headphones, ArrowRight, ShieldAlert, Clock3 } from 'lucide-react';
import Link from 'next/link';
import { PageHeader, StatCard, Card, CardHeader, CardTitle, DataTable, Badge, Button } from '@/components/ui';
import { getRecommendationFlags } from '@/services/analytics.service';

type HelpdeskRow = {
  id: string;
  flag_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  generated_at: string;
  is_acknowledged: boolean;
  [key: string]: unknown;
};

export default function HelpdeskPage() {
  const [rows, setRows] = useState<HelpdeskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await getRecommendationFlags();
      setRows((data ?? []) as HelpdeskRow[]);
      setLoading(false);
    }
    load();
  }, []);

  const escalated = rows.filter((r) => ['critical', 'high'].includes(r.severity));
  const unresolved = rows.filter((r) => !r.is_acknowledged);
  const overdue = rows.filter((r) => !r.is_acknowledged && ['critical', 'high'].includes(r.severity));

  const summary = useMemo(
    () => ({
      escalated: escalated.length,
      unresolved: unresolved.length,
      overdue: overdue.length,
    }),
    [escalated.length, overdue.length, unresolved.length]
  );

  const columns = [
    { key: 'flag_type', header: 'Issue Type', render: (row: HelpdeskRow) => row.flag_type.replace(/_/g, ' ') },
    { key: 'message', header: 'Summary' },
    {
      key: 'severity',
      header: 'Severity',
      render: (row: HelpdeskRow) => (
        <Badge variant={row.severity === 'critical' ? 'error' : row.severity === 'high' ? 'warning' : 'info'}>
          {row.severity}
        </Badge>
      ),
    },
    {
      key: 'generated_at',
      header: 'Raised',
      render: (row: HelpdeskRow) => new Date(row.generated_at).toLocaleString(),
    },
    {
      key: 'is_acknowledged',
      header: 'Follow-up',
      render: (row: HelpdeskRow) => <Badge variant={row.is_acknowledged ? 'success' : 'warning'}>{row.is_acknowledged ? 'Tracked' : 'Pending'}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Helpdesk Escalations"
        description="Monitor escalated requests, forwarding pathways, and unresolved support issues."
        actions={
          <Link href="/alerts">
            <Button variant="outline" size="sm">
              Open Alerts Board
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Escalated Issues" value={summary.escalated} icon={<Headphones className="h-6 w-6" />} color="purple" />
        <StatCard label="Unresolved" value={summary.unresolved} icon={<ShieldAlert className="h-6 w-6" />} color="red" />
        <StatCard label="Overdue Follow-up" value={summary.overdue} icon={<Clock3 className="h-6 w-6" />} color="orange" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Escalation Queue</CardTitle>
        </CardHeader>
        <DataTable<HelpdeskRow>
          columns={columns}
          data={rows}
          loading={loading}
          searchPlaceholder="Search escalations..."
          emptyMessage="No escalations found"
        />
      </Card>
    </div>
  );
}
