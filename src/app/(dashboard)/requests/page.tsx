'use client';

import Link from 'next/link';
import { ClipboardList, PackageCheck, FileSearch, GraduationCap, Wrench, Gauge, Trash2 } from 'lucide-react';
import { PageHeader, Card, Badge } from '@/components/ui';

const REQUEST_MODULES = [
  { label: 'Installation Requests', href: '/installation', icon: PackageCheck, note: 'Track installation planning and completion.' },
  { label: 'Procurement Requests', href: '/procurement', icon: ClipboardList, note: 'Follow procurement request lifecycle and status.' },
  { label: 'Specification Requests', href: '/documents', icon: FileSearch, note: 'Manage specification and document-oriented requests.' },
  { label: 'Training Requests', href: '/training', icon: GraduationCap, note: 'Submit and manage training support requests.' },
  { label: 'Curative Maintenance Requests', href: '/maintenance', icon: Wrench, note: 'Open and follow corrective maintenance requests.' },
  { label: 'Calibration Requests', href: '/calibration', icon: Gauge, note: 'Manage calibration-specific request workflow.' },
  { label: 'Disposal Requests', href: '/disposal', icon: Trash2, note: 'Track disposal recommendation and approval requests.' },
];

export default function RequestsHubPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Requests Hub"
        description="Central request intake aligned with MEMIS 2.0 request categories."
        actions={<Badge variant="info">Role-based visibility enabled</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REQUEST_MODULES.map((item) => (
          <Link key={item.label} href={item.href}>
            <Card className="h-full transition-transform hover:-translate-y-0.5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-[var(--brand)]/20 p-2 text-[var(--brand)]">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{item.label}</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{item.note}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
