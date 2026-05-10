'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRightLeft, Boxes, ClipboardCheck, HandHelping, PackageCheck, Warehouse } from 'lucide-react';
import { PageHeader, Card, Badge, StatCard } from '@/components/ui';
import { AskAiButton } from '@/components/assistant/AskAiButton';
import { getLowStockParts, getSpareParts } from '@/services/spare-parts.service';
import { getProcurementPipeline } from '@/services/procurement.service';
import { createClient } from '@/lib/supabase/client';

export default function LogisticsPage() {
  const [summary, setSummary] = useState({
    lowStock: 0,
    totalParts: 0,
    receipts: 0,
    issues: 0,
    procurementOpen: 0,
    pendingReceiving: 0,
    pendingIssue: 0,
    workOrderIssues: 0,
    latestReceipt: 'No receipts recorded',
    latestIssue: 'No issues recorded',
    latestProcurement: 'No open procurement',
  });

  useEffect(() => {
    async function loadSummary() {
      const supabase = createClient();
      const [lowRes, partsRes, receiptsRes, issuesRes, procurementRes] = await Promise.all([
        getLowStockParts(),
        getSpareParts({ is_active: true }),
        supabase.from('stock_receipts').select('id, quantity, received_date, spare_parts(part_code, name)').order('received_date', { ascending: false }).limit(20),
        supabase.from('stock_issues').select('id, quantity, issue_date, issued_to_event_id, spare_parts(part_code, name)').order('issue_date', { ascending: false }).limit(20),
        getProcurementPipeline(),
      ]);
      const procurementRows = (procurementRes.data ?? []) as Array<{ status?: string }>;
      const receiptRows = (receiptsRes.data ?? []) as Array<{ quantity?: number; received_date?: string; spare_parts?: { part_code?: string; name?: string } | null }>;
      const issueRows = (issuesRes.data ?? []) as Array<{ quantity?: number; issue_date?: string; issued_to_event_id?: string | null; spare_parts?: { part_code?: string; name?: string } | null }>;
      const openProcurement = procurementRows.filter((row) => row.status && !['delivered', 'canceled'].includes(row.status));
      const deliveredNotReceived = procurementRows.filter((row) => row.status === 'delivered').length;
      setSummary({
        lowStock: lowRes.data?.length ?? 0,
        totalParts: partsRes.data?.length ?? 0,
        receipts: receiptRows.length,
        issues: issueRows.length,
        procurementOpen: openProcurement.length,
        pendingReceiving: deliveredNotReceived,
        pendingIssue: lowRes.data?.length ?? 0,
        workOrderIssues: issueRows.filter((row) => row.issued_to_event_id).length,
        latestReceipt: receiptRows[0] ? `${receiptRows[0].spare_parts?.part_code ?? 'Part'} x${receiptRows[0].quantity ?? 0}` : 'No receipts recorded',
        latestIssue: issueRows[0] ? `${issueRows[0].spare_parts?.part_code ?? 'Part'} x${issueRows[0].quantity ?? 0}` : 'No issues recorded',
        latestProcurement: openProcurement[0]?.status ? `Latest status: ${openProcurement[0].status.replace(/_/g, ' ')}` : 'No open procurement',
      });
    }
    void loadSummary();
  }, []);

  const logisticsAreas = [
    {
      title: 'Item Receiving',
      href: '/spare-parts?action=receive&source=logistics',
      desc: 'Record inbound stock from delivered procurement or direct receipts.',
      count: summary.pendingReceiving,
      latest: summary.latestReceipt,
      icon: Warehouse,
      action: 'Receive Item',
    },
    {
      title: 'Item Request',
      href: '/procurement?source=logistics',
      desc: 'Track stock support requests through the central Requests Hub.',
      count: summary.procurementOpen,
      latest: summary.latestProcurement,
      icon: HandHelping,
      action: 'Open Requests',
    },
    {
      title: 'Item Approval / Issue',
      href: '/spare-parts?tab=lowstock&action=issue&source=logistics',
      desc: 'Issue parts to departments or work orders with traceability.',
      count: summary.pendingIssue,
      latest: summary.latestIssue,
      icon: ClipboardCheck,
      action: 'Issue Stock',
    },
    {
      title: 'Stock Balance / Bin Card',
      href: '/spare-parts?tab=catalog&source=logistics',
      desc: 'Review current balances, reorder thresholds, receipts, and issues.',
      count: summary.totalParts,
      latest: `${summary.lowStock} below reorder threshold`,
      icon: Boxes,
      action: 'Review Balance',
    },
    {
      title: 'Usage Linkage',
      href: '/spare-parts?tab=issues&source=logistics&linked=work-orders',
      desc: 'Review stock issues connected to maintenance execution evidence.',
      count: summary.workOrderIssues,
      latest: 'Stock issue records retain work-order linkage where available.',
      icon: ArrowRightLeft,
      action: 'Trace Usage',
    },
  ];

  const todayWork = [
    {
      label: 'Pending issue',
      count: summary.pendingIssue,
      why: 'Low-stock and stockout rows that may prevent maintenance execution.',
      action: 'Issue / procure',
      href: '/spare-parts?tab=blockers&source=logistics',
      tone: 'text-orange-300',
    },
    {
      label: 'Open procurement',
      count: summary.procurementOpen,
      why: 'Purchases that need follow-up before stock can recover.',
      action: 'Open pipeline',
      href: '/procurement?source=logistics',
      tone: 'text-violet-300',
    },
    {
      label: 'Work-order usage links',
      count: summary.workOrderIssues,
      why: 'Issued stock with maintenance execution traceability.',
      action: 'Trace usage',
      href: '/spare-parts?tab=issues&source=logistics&linked=work-orders',
      tone: 'text-cyan-300',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logistics"
        description="Store operations for stock receiving, request, issue, and balance control."
        actions={
          <div className="flex items-center gap-2">
            <AskAiButton
              moduleLabel="Logistics"
              label="Explain stock issues"
              seedPrompt="Explain likely stock risks and what actions to prioritize for logistics continuity."
            />
            <Badge variant="warning">Stockout visibility active</Badge>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Low Stock" value={summary.lowStock} icon={<Boxes className="h-6 w-6" />} color="red" />
        <StatCard label="Active Parts" value={summary.totalParts} icon={<Warehouse className="h-6 w-6" />} color="blue" />
        <StatCard label="Recent Receipts" value={summary.receipts} icon={<ClipboardCheck className="h-6 w-6" />} color="green" />
        <StatCard label="Recent Issues" value={summary.issues} icon={<ArrowRightLeft className="h-6 w-6" />} color="orange" />
        <StatCard label="Open Procurement" value={summary.procurementOpen} icon={<HandHelping className="h-6 w-6" />} color="purple" />
        <StatCard label="Pending Receiving" value={summary.pendingReceiving} icon={<PackageCheck className="h-6 w-6" />} color="yellow" />
        <StatCard label="Pending Issue" value={summary.pendingIssue} icon={<ClipboardCheck className="h-6 w-6" />} color="orange" />
        <StatCard label="Work Order Linked Issues" value={summary.workOrderIssues} icon={<ArrowRightLeft className="h-6 w-6" />} color="blue" />
      </div>
      <section className="panel-surface rounded-lg p-4">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Today Logistics Work</h2>
          <p className="text-sm text-[var(--text-muted)]">Receive arrived stock, issue what can safely be issued, and escalate stock blockers that are delaying work orders.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {todayWork.map((item) => (
            <Link key={item.label} href={item.href} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3 transition hover:border-[var(--brand)]/50">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--foreground)]">{item.label}</p>
                <span className={`text-2xl font-bold ${item.tone}`}>{item.count}</span>
              </div>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{item.why}</p>
              <p className="mt-3 text-sm font-medium text-[var(--brand)]">{item.action}</p>
            </Link>
          ))}
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {logisticsAreas.map((area) => (
          <Link key={area.title} href={area.href}>
            <Card className="h-full transition-transform hover:-translate-y-0.5">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-cyan-500/20 p-2 text-cyan-300">
                  <area.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[var(--foreground)]">{area.title}</p>
                    <Badge variant="info">{area.count}</Badge>
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">{area.desc}</p>
                  <p className="mt-3 text-xs text-[var(--text-muted)]">{area.latest}</p>
                  <p className="mt-2 text-sm font-medium text-[var(--brand)]">{area.action}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
