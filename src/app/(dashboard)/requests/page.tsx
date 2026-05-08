'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClipboardList, PackageCheck, FileSearch, GraduationCap, Wrench, Gauge, Trash2 } from 'lucide-react';
import { PageHeader, Card, Badge, StatCard } from '@/components/ui';
import { getMaintenanceRequests } from '@/services/maintenance.service';
import { getCalibrationRequests } from '@/services/calibration.service';
import { getTrainingRequests } from '@/services/training.service';
import { getDisposalRequests } from '@/services/disposal.service';
import { getProcurementPipeline } from '@/services/procurement.service';

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
  const [counts, setCounts] = useState({ maintenance: 0, calibration: 0, training: 0, disposal: 0, procurement: 0 });

  useEffect(() => {
    async function loadCounts() {
      const [maintenance, calibration, training, disposal, procurement] = await Promise.all([
        getMaintenanceRequests(),
        getCalibrationRequests(),
        getTrainingRequests(),
        getDisposalRequests(),
        getProcurementPipeline(),
      ]);
      setCounts({
        maintenance: maintenance.data?.length ?? 0,
        calibration: calibration.data?.length ?? 0,
        training: training.data?.length ?? 0,
        disposal: disposal.data?.length ?? 0,
        procurement: procurement.data?.length ?? 0,
      });
    }
    void loadCounts();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requests Hub"
        description="Central request intake aligned with MEMIS 2.0 request categories."
        actions={<Badge variant="info">Role-based visibility enabled</Badge>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Maintenance" value={counts.maintenance} icon={<Wrench className="h-6 w-6" />} color="blue" />
        <StatCard label="Calibration" value={counts.calibration} icon={<Gauge className="h-6 w-6" />} color="purple" />
        <StatCard label="Training" value={counts.training} icon={<GraduationCap className="h-6 w-6" />} color="green" />
        <StatCard label="Disposal" value={counts.disposal} icon={<Trash2 className="h-6 w-6" />} color="red" />
        <StatCard label="Procurement" value={counts.procurement} icon={<ClipboardList className="h-6 w-6" />} color="orange" />
      </div>

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
