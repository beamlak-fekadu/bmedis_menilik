'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Truck, Timer, CircleDollarSign } from 'lucide-react';
import { PageHeader, StatCard, Card, CardHeader, CardTitle, DataTable, Badge, Button, Modal, Input, Select, Textarea } from '@/components/ui';
import { createProcurementRequest, getProcurementPipeline } from '@/services/procurement.service';
import { procurementRequestSchema } from '@/utils/validation/operations';
import { useToast } from '@/components/ui/Toast';

type ProcurementRow = {
  id: string;
  request_number: string;
  title: string;
  status: string;
  priority: string;
  expected_delivery_date: string | null;
  created_at: string;
};
type ProcurementTableRow = ProcurementRow & Record<string, unknown>;

export default function ProcurementPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ProcurementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    justification: '',
    status: 'requested',
    priority: 'medium',
    expected_delivery_date: '',
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await getProcurementPipeline();
      if (!active) return;
      setRows((data ?? []) as ProcurementRow[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => {
    const requested = rows.filter((r) => r.status === 'requested').length;
    const inProgress = rows.filter((r) => ['approved', 'ordered', 'in_transit'].includes(r.status)).length;
    const delivered = rows.filter((r) => r.status === 'delivered').length;
    return { requested, inProgress, delivered, total: rows.length };
  }, [rows]);

  const columns = [
    { key: 'request_number', header: 'Request #', sortable: true },
    { key: 'title', header: 'Title', sortable: true },
    {
      key: 'priority',
      header: 'Priority',
      render: (row: ProcurementTableRow) => <Badge variant={row.priority === 'critical' ? 'error' : row.priority === 'high' ? 'warning' : 'info'}>{row.priority}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: ProcurementTableRow) => <Badge variant="purple">{row.status.replace(/_/g, ' ')}</Badge>,
    },
    {
      key: 'expected_delivery_date',
      header: 'Expected Delivery',
      render: (row: ProcurementTableRow) => row.expected_delivery_date ? new Date(row.expected_delivery_date).toLocaleDateString() : 'TBD',
    },
    {
      key: 'created_at',
      header: 'Submitted',
      render: (row: ProcurementTableRow) => new Date(row.created_at).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procurement Tracking"
        description="Track procurement request pipeline from request through delivery."
        actions={<Button onClick={() => setModalOpen(true)}>New Procurement Request</Button>}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Requested" value={summary.requested} icon={<ClipboardCheck className="h-6 w-6" />} color="yellow" />
        <StatCard label="In Progress" value={summary.inProgress} icon={<Timer className="h-6 w-6" />} color="blue" />
        <StatCard label="Delivered" value={summary.delivered} icon={<Truck className="h-6 w-6" />} color="green" />
        <StatCard label="Total Pipeline" value={summary.total} icon={<CircleDollarSign className="h-6 w-6" />} color="purple" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Procurement Requests</CardTitle>
        </CardHeader>
        <DataTable<ProcurementTableRow>
          columns={columns}
          data={rows as ProcurementTableRow[]}
          loading={loading}
          searchPlaceholder="Search procurement requests..."
          emptyMessage="No procurement requests found"
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Procurement Request"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              loading={submitting}
              onClick={async () => {
                const parsed = procurementRequestSchema.safeParse(form);
                if (!parsed.success) {
                  toast('warning', parsed.error.issues[0]?.message ?? 'Invalid procurement request');
                  return;
                }
                setSubmitting(true);
                const { error } = await createProcurementRequest({
                  title: parsed.data.title,
                  justification: parsed.data.justification,
                  status: parsed.data.status,
                  priority: parsed.data.priority,
                  expected_delivery_date: parsed.data.expected_delivery_date || null,
                });
                setSubmitting(false);
                if (error) {
                  toast('error', 'Failed to create procurement request');
                  return;
                }
                toast('success', 'Procurement request created');
                setModalOpen(false);
                setForm({
                  title: '',
                  justification: '',
                  status: 'requested',
                  priority: 'medium',
                  expected_delivery_date: '',
                });
                setLoading(true);
                const { data } = await getProcurementPipeline();
                setRows((data ?? []) as ProcurementRow[]);
                setLoading(false);
              }}
            >
              Submit Request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Procurement request title"
          />
          <Textarea
            label="Justification"
            value={form.justification}
            onChange={(e) => setForm((prev) => ({ ...prev, justification: e.target.value }))}
            placeholder="Clinical and operational justification for request"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Priority"
              value={form.priority}
              onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' | 'critical' }))}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'critical', label: 'Critical' },
              ]}
            />
            <Input
              label="Expected Delivery"
              type="date"
              value={form.expected_delivery_date}
              onChange={(e) => setForm((prev) => ({ ...prev, expected_delivery_date: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
