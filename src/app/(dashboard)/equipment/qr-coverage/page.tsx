import Link from 'next/link';
import { requireRole } from '@/lib/auth/helpers';
import { getQrAssetScanMetrics, getQrCoverageStats, getQrLabelAssets } from '@/services/qr.service';
import { Button, PageHeader } from '@/components/ui';
import QrCoverageClient from './QrCoverageClient';

export default async function QrCoveragePage() {
  await requireRole(['admin', 'bme_head']);

  const [assets, coverage, scanMetrics] = await Promise.all([
    getQrLabelAssets(),
    getQrCoverageStats(),
    getQrAssetScanMetrics(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR Coverage"
        description="Administrative QR readiness: generated, printed, attached, replacement, and revoked label states."
        breadcrumbs={[{ label: 'Equipment', href: '/equipment' }, { label: 'QR Coverage' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/equipment">
              <Button variant="outline" size="sm">Equipment List</Button>
            </Link>
            <Link href="/equipment/qr-labels">
              <Button variant="outline" size="sm">QR Label Sheet</Button>
            </Link>
            <Link href="/equipment/qr-scans">
              <Button variant="outline" size="sm">Scan History</Button>
            </Link>
            <Link href="/reports/qr-coverage">
              <Button size="sm">QR Evidence Report</Button>
            </Link>
          </div>
        }
      />
      <QrCoverageClient assets={assets} coverage={coverage} scanMetrics={scanMetrics} />
    </div>
  );
}
