'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRightLeft, Boxes, ClipboardCheck, HandHelping, Warehouse } from 'lucide-react';
import { PageHeader, Card, Badge, StatCard } from '@/components/ui';
import { AskAiButton } from '@/components/assistant/AskAiButton';
import { getLowStockParts, getSpareParts } from '@/services/spare-parts.service';
import { getProcurementPipeline } from '@/services/procurement.service';
import { createClient } from '@/lib/supabase/client';

const LOGISTICS_AREAS = [
  { title: 'Item Receive', href: '/spare-parts', desc: 'Record inbound stock and supplier receipts.', icon: Warehouse },
  { title: 'Item Request', href: '/requests', desc: 'Capture requests for items and parts support.', icon: HandHelping },
  { title: 'Item Approval / Issue', href: '/spare-parts', desc: 'Issue requested stock with traceability.', icon: ClipboardCheck },
  { title: 'Stock Balance / Bin Card', href: '/spare-parts', desc: 'Review stock balance and movement history.', icon: Boxes },
  { title: 'Usage Linkage', href: '/maintenance', desc: 'Link spare parts consumption to maintenance events.', icon: ArrowRightLeft },
];

export default function LogisticsPage() {
  const [summary, setSummary] = useState({ lowStock: 0, totalParts: 0, receipts: 0, issues: 0, procurementOpen: 0 });

  useEffect(() => {
    async function loadSummary() {
      const supabase = createClient();
      const [lowRes, partsRes, receiptsRes, issuesRes, procurementRes] = await Promise.all([
        getLowStockParts(),
        getSpareParts({ is_active: true }),
        supabase.from('stock_receipts').select('id').limit(5),
        supabase.from('stock_issues').select('id').limit(5),
        getProcurementPipeline(),
      ]);
      const procurementRows = (procurementRes.data ?? []) as Array<{ status?: string }>;
      setSummary({
        lowStock: lowRes.data?.length ?? 0,
        totalParts: partsRes.data?.length ?? 0,
        receipts: receiptsRes.data?.length ?? 0,
        issues: issuesRes.data?.length ?? 0,
        procurementOpen: procurementRows.filter((row) => row.status && !['delivered', 'canceled'].includes(row.status)).length,
      });
    }
    void loadSummary();
  }, []);

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
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {LOGISTICS_AREAS.map((area) => (
          <Link key={area.title} href={area.href}>
            <Card className="h-full transition-transform hover:-translate-y-0.5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-cyan-500/20 p-2 text-cyan-300">
                  <area.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{area.title}</p>
                  <p className="text-sm text-[var(--text-muted)]">{area.desc}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
