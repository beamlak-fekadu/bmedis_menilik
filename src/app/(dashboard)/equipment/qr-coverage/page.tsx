import Link from 'next/link';
import { requireRole } from '@/lib/auth/helpers';
import { getQrAssetScanMetrics, getQrCoverageStats, getQrLabelAssets } from '@/services/qr.service';
import { Button, PageHeader } from '@/components/ui';
import AssistantPageContextBridge from '@/components/assistant/AssistantPageContextBridge';
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
      <AssistantPageContextBridge
        moduleLabel="QR"
        pageLabel="QR Coverage"
        selectedRecordType="qr_coverage"
        pageSummary="QR readiness page with generated, printed, attached, needs replacement, revoked, scan evidence, and never-scanned asset groups."
        visibleCounts={{
          assets: assets.length,
          totalActiveAssets: coverage.totalActiveAssets,
          withoutToken: coverage.withoutToken,
          generated: coverage.generated,
          printed: coverage.printed,
          attached: coverage.attached,
          needsReplacement: coverage.needsReplacement,
          revoked: coverage.revoked,
          assetsWithScans: Object.keys(scanMetrics).length,
          scansLast30Days: Object.values(scanMetrics).reduce((total, row) => total + row.scansLast30Days, 0),
        }}
        availableEvidenceLinks={[{ label: 'QR Coverage', href: '/equipment/qr-coverage', type: 'qr' }, { label: 'QR Scans', href: '/equipment/qr-scans', type: 'qr' }, { label: 'QR Coverage Report', href: '/reports/qr-coverage', type: 'report' }]}
        quickPrompts={['Check QR coverage issues.', 'Which attached labels have never been scanned?', 'Explain QR readiness gaps.']}
      />
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
