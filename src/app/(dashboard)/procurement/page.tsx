'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, ClipboardCheck, PackageCheck, Truck, Timer, CircleDollarSign } from 'lucide-react';
import { PageHeader, StatCard, Card, CardHeader, CardTitle, DataTable, Badge, Button, Modal, Input, Select, Textarea } from '@/components/ui';
import { getProcurementPipeline } from '@/services/procurement.service';
import { createProcurementRequestAction } from '@/actions/procurement.actions';
import { procurementRequestSchema } from '@/utils/validation/operations';
import { useToast } from '@/components/ui/Toast';
import { AskAiButton } from '@/components/assistant/AskAiButton';
import { procurementDetail } from '@/app/(dashboard)/command/_lib/command-center-routes';
import { useRole } from '@/hooks/useRole';

type ProcurementRow = {
  id: string;
  request_number: string;
  title: string;
  status: string;
  priority: string;
  justification?: string | null;
  expected_delivery_date: string | null;
  created_at: string;
};
type ProcurementTableRow = ProcurementRow & Record<string, unknown>;

export default function ProcurementPage() {
  const { toast } = useToast();
  const { canManageParts, primaryRole } = useRole();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<ProcurementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayTime] = useState(() => Date.now());
  const source = searchParams.get('source');
  const hasPrefill = Boolean(source);
  const [modalOpen, setModalOpen] = useState(hasPrefill);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(() => {
    const itemName = searchParams.get('itemName') ?? 'spare part';
    const currentStock = searchParams.get('currentStock');
    const reorderLevel = searchParams.get('reorderLevel');
    const suggestedQuantity = searchParams.get('suggestedQuantity');
    const reason = searchParams.get('reason') ?? 'Stock below reorder level';
    return {
      title: hasPrefill ? `Procure ${itemName}` : '',
      justification: hasPrefill
        ? [
            reason,
            currentStock ? `Current stock: ${currentStock}` : null,
            reorderLevel ? `Reorder level: ${reorderLevel}` : null,
            suggestedQuantity ? `Suggested quantity: ${suggestedQuantity}` : null,
            searchParams.get('workOrderId') ? `Linked work order: ${searchParams.get('workOrderId')}` : null,
            searchParams.get('assetId') ? `Linked asset: ${searchParams.get('assetId')}` : null,
            source ? `Source: ${source.replace(/-/g, ' ')}` : null,
          ].filter(Boolean).join('\n')
        : '',
      status: 'requested',
      priority: currentStock === '0' ? 'critical' : hasPrefill ? 'high' : 'medium',
      expected_delivery_date: '',
    };
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

  function isDelayed(row: ProcurementRow) {
    return Boolean(row.expected_delivery_date && new Date(row.expected_delivery_date).getTime() < todayTime && !['delivered', 'canceled'].includes(row.status));
  }

  function delayDays(row: ProcurementRow) {
    if (!row.expected_delivery_date || !isDelayed(row)) return 0;
    return Math.max(0, Math.ceil((todayTime - new Date(row.expected_delivery_date).getTime()) / 86_400_000));
  }

  function sourceLabel(row: ProcurementRow) {
    const text = `${row.title ?? ''}\n${row.justification ?? ''}`.toLowerCase();
    if (text.includes('replacement')) return 'Replacement';
    if (text.includes('work order')) return 'Work Order';
    if (text.includes('spare') || text.includes('stock') || text.includes('reorder')) return 'Spare Parts';
    if (text.includes('command center')) return 'Command Center';
    return 'Procurement';
  }

  function isStockLinked(row: ProcurementRow) {
    return ['Spare Parts', 'Command Center'].includes(sourceLabel(row)) && Boolean(`${row.justification ?? ''}`.toLowerCase().match(/stock|reorder|spare/));
  }

  function isReplacementLinked(row: ProcurementRow) {
    return sourceLabel(row) === 'Replacement';
  }

  function isLinked(row: ProcurementRow) {
    return Boolean(`${row.justification ?? ''}`.toLowerCase().match(/linked|source|stock|replacement|work order|asset/));
  }

  function impactLabel(row: ProcurementRow) {
    if (isDelayed(row)) return `Delayed ${delayDays(row)} day${delayDays(row) === 1 ? '' : 's'}`;
    if (isStockLinked(row)) return 'Stock blocker / reorder support';
    if (isReplacementLinked(row)) return 'Replacement planning dependency';
    if (row.priority === 'critical') return 'Critical biomedical dependency';
    return 'Operational procurement';
  }

  function actionFor(row: ProcurementRow) {
    if (!canManageParts) return { label: 'View', href: procurementDetail(row.id) };
    if (isDelayed(row)) return { label: 'Escalate', href: procurementDetail(row.id, 'escalate') };
    if (row.status === 'requested') return { label: 'Review', href: procurementDetail(row.id, 'review') };
    if (row.status === 'approved') return { label: 'Order', href: procurementDetail(row.id, 'mark-ordered') };
    if (row.status === 'ordered') return { label: 'Delivery', href: procurementDetail(row.id, 'update-delivery') };
    if (row.status === 'in_transit') return { label: 'Receive', href: procurementDetail(row.id, 'receive') };
    if (row.status === 'delivered') return { label: 'Receipt', href: procurementDetail(row.id) };
    return { label: 'View', href: procurementDetail(row.id) };
  }

  const summary = {
    requested: rows.filter((r) => r.status === 'requested').length,
    approved: rows.filter((r) => r.status === 'approved').length,
    ordered: rows.filter((r) => r.status === 'ordered').length,
    inTransit: rows.filter((r) => r.status === 'in_transit').length,
    delivered: rows.filter((r) => r.status === 'delivered').length,
    delayed: rows.filter((r) => isDelayed(r)).length,
    criticalLinked: rows.filter((r) => ['critical', 'high'].includes(r.priority) && isLinked(r)).length,
    stockBlockers: rows.filter((r) => isStockLinked(r)).length,
    replacementLinked: rows.filter((r) => isReplacementLinked(r)).length,
  };
  const delayedRows = rows.filter((r) => isDelayed(r)).sort((a, b) => delayDays(b) - delayDays(a));
  const pipelineSteps = [
    { id: 'requested', label: 'Requested', count: summary.requested, desc: 'Needs BME review and approval.' },
    { id: 'approved', label: 'Approved', count: summary.approved, desc: 'Ready to place order.' },
    { id: 'ordered', label: 'Ordered', count: summary.ordered, desc: 'Supplier follow-up and delivery tracking.' },
    { id: 'in_transit', label: 'In Transit', count: summary.inTransit, desc: 'Prepare receipt and stock update.' },
    { id: 'delivered', label: 'Delivered', count: summary.delivered, desc: 'Receive into stock and close evidence.' },
  ];

  const columns = [
    { key: 'request_number', header: 'Request #', sortable: true },
    { key: 'title', header: 'Title', sortable: true },
    {
      key: 'source',
      header: 'Source',
      render: (row: ProcurementTableRow) => <Badge variant="info">{sourceLabel(row as ProcurementRow)}</Badge>,
    },
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
      key: 'delay',
      header: 'Delay',
      render: (row: ProcurementTableRow) => isDelayed(row as ProcurementRow) ? <Badge variant="error">{delayDays(row as ProcurementRow)}d</Badge> : '—',
    },
    {
      key: 'impact',
      header: 'Impact',
      render: (row: ProcurementTableRow) => <span className="text-sm text-[var(--text-muted)]">{impactLabel(row as ProcurementRow)}</span>,
    },
    {
      key: 'created_at',
      header: 'Submitted',
      render: (row: ProcurementTableRow) => new Date(row.created_at).toLocaleDateString(),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row: ProcurementTableRow) => {
        const action = actionFor(row as ProcurementRow);
        return <Link className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)]" href={action.href}>{action.label}</Link>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procurement Tracking"
        description="Track procurement request pipeline from request through delivery."
        actions={
          <div className="flex items-center gap-2">
            <AskAiButton
              moduleLabel="Procurement"
              label="Ask AI pipeline risk"
              seedPrompt="Summarize procurement blockers and what should be prioritized today."
            />
            {canManageParts ? <Button onClick={() => setModalOpen(true)}>New Procurement Request</Button> : <Badge variant="info">{primaryRole === 'viewer' ? 'Read-only' : 'View access'}</Badge>}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Requested" value={summary.requested} icon={<ClipboardCheck className="h-6 w-6" />} color="yellow" />
        <StatCard label="Approved" value={summary.approved} icon={<ClipboardCheck className="h-6 w-6" />} color="blue" />
        <StatCard label="Ordered" value={summary.ordered} icon={<PackageCheck className="h-6 w-6" />} color="purple" />
        <StatCard label="In Transit" value={summary.inTransit} icon={<Timer className="h-6 w-6" />} color="orange" />
        <StatCard label="Delivered" value={summary.delivered} icon={<Truck className="h-6 w-6" />} color="green" />
        <StatCard label="Delayed" value={summary.delayed} icon={<AlertTriangle className="h-6 w-6" />} color="red" />
        <StatCard label="Critical Linked" value={summary.criticalLinked} icon={<AlertTriangle className="h-6 w-6" />} color="red" />
        <StatCard label="Stock Blockers" value={summary.stockBlockers} icon={<CircleDollarSign className="h-6 w-6" />} color="yellow" />
        <StatCard label="Replacement Linked" value={summary.replacementLinked} icon={<PackageCheck className="h-6 w-6" />} color="gray" />
      </div>
      <section className="panel-surface rounded-lg p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">Pipeline and Blockers</h2>
            <p className="text-sm text-[var(--text-muted)]">Delayed or linked procurement can block stock recovery, repair completion, and replacement planning.</p>
          </div>
          {delayedRows.length > 0 && <Badge variant="error">{delayedRows.length} delayed</Badge>}
        </div>
        <div className="grid gap-3 lg:grid-cols-5">
          {pipelineSteps.map((step) => (
            <div key={step.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">{step.label}</p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{step.count}</p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">{step.desc}</p>
            </div>
          ))}
        </div>
        {delayedRows.length > 0 && (
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {delayedRows.slice(0, 3).map((row) => (
              <Link key={row.id} href={procurementDetail(row.id, 'escalate')} className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm hover:border-red-400/60">
                <p className="font-medium text-[var(--foreground)]">{row.request_number}</p>
                <p className="truncate text-[var(--text-muted)]">{row.title}</p>
                <p className="mt-2 font-medium text-red-300">Escalate · {delayDays(row)}d delayed</p>
              </Link>
            ))}
          </div>
        )}
      </section>
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
                const result = await createProcurementRequestAction({
                  title: parsed.data.title,
                  justification: parsed.data.justification,
                  status: parsed.data.status,
                  priority: parsed.data.priority,
                  expected_delivery_date: parsed.data.expected_delivery_date || null,
                });
                setSubmitting(false);
                if (!result.success) {
                  toast('error', result.error ?? 'Failed to create procurement request');
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
