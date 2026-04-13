'use client';

import Link from 'next/link';
import { ArrowRightLeft, Boxes, ClipboardCheck, HandHelping, Warehouse } from 'lucide-react';
import { PageHeader, Card, Badge } from '@/components/ui';

const LOGISTICS_AREAS = [
  { title: 'Item Receive', href: '/spare-parts', desc: 'Record inbound stock and supplier receipts.', icon: Warehouse },
  { title: 'Item Request', href: '/requests', desc: 'Capture requests for items and parts support.', icon: HandHelping },
  { title: 'Item Approval / Issue', href: '/spare-parts', desc: 'Issue requested stock with traceability.', icon: ClipboardCheck },
  { title: 'Stock Balance / Bin Card', href: '/spare-parts', desc: 'Review stock balance and movement history.', icon: Boxes },
  { title: 'Usage Linkage', href: '/maintenance', desc: 'Link spare parts consumption to maintenance events.', icon: ArrowRightLeft },
];

export default function LogisticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Logistics"
        description="Store operations for stock receiving, request, issue, and balance control."
        actions={<Badge variant="warning">Stockout visibility active</Badge>}
      />
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
