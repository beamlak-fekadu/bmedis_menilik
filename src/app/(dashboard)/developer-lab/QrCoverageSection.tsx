'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QrCode, RefreshCw, Printer, Sheet, ListChecks, History, FileDown } from 'lucide-react';
import { Badge, Button, Card, AnimatedMetric } from '@/components/ui';
import { motion } from 'framer-motion';
import { cardItem, cardStagger } from '@/lib/ui/motion-presets';
import { bulkGenerateMissingQrTokensAction } from '@/actions/qr.actions';
import QrScanHistoryTable from '@/components/qr/QrScanHistoryTable';
import type { QrCoverageStats, QrScanCoverageStats } from '@/types/qr';

type Props = {
  stats: QrCoverageStats;
  scanStats: QrScanCoverageStats;
};

export default function QrCoverageSection({ stats, scanStats }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleBulkGenerate = () => {
    setMessage(null);
    setErrorMessage(null);
    startTransition(async () => {
      const result = await bulkGenerateMissingQrTokensAction();
      if (!result.success) {
        setErrorMessage(result.error ?? 'Bulk generate failed');
        return;
      }
      const data = result.data;
      setMessage(
        data
          ? `Generated ${data.generated} new QR token${data.generated === 1 ? '' : 's'}. Skipped ${data.skipped}. Failed ${data.failed}.`
          : 'Bulk generate complete.',
      );
      router.refresh();
    });
  };

  const cards: Array<{ label: string; value: number; tone?: 'critical' | 'warning' | 'ok' | 'info' }> = [
    { label: 'Active assets', value: stats.totalActiveAssets, tone: 'info' },
    { label: 'Without QR token', value: stats.withoutToken, tone: stats.withoutToken > 0 ? 'warning' : 'ok' },
    { label: 'Generated', value: stats.generated, tone: 'info' },
    { label: 'Printed', value: stats.printed, tone: 'info' },
    { label: 'Attached', value: stats.attached, tone: 'ok' },
    { label: 'Needs replacement', value: stats.needsReplacement, tone: stats.needsReplacement > 0 ? 'warning' : 'ok' },
    { label: 'Revoked', value: stats.revoked, tone: stats.revoked > 0 ? 'critical' : 'ok' },
    { label: 'QR scans recorded', value: stats.recentScanCount, tone: 'info' },
  ];

  function badgeVariant(tone?: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
    if (tone === 'ok') return 'success';
    if (tone === 'warning') return 'warning';
    if (tone === 'critical') return 'error';
    if (tone === 'info') return 'info';
    return 'default';
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">QR Coverage &amp; Field Readiness</h2>
          <p className="text-sm text-[var(--text-muted)]">
            QR identity (Phase 1) and QR label generation/management (Phase 2). The /qr/a/[token] scan
            landing route is delivered in Phase 3; offline scan logging is out of scope for the current
            QR plan. Printing labels does not automatically mark them printed — use Mark Printed after
            physical printing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleBulkGenerate} disabled={pending || stats.withoutToken === 0} size="sm">
            <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
            {stats.withoutToken === 0 ? 'All assets covered' : `Generate ${stats.withoutToken} missing token${stats.withoutToken === 1 ? '' : 's'}`}
          </Button>
          <Link href="/equipment/qr-labels">
            <Button variant="outline" size="sm">
              <Sheet className="h-4 w-4" />
              Open QR Label Sheet
            </Button>
          </Link>
          <Link href="/equipment/qr-coverage">
            <Button variant="outline" size="sm">
              <ListChecks className="h-4 w-4" />
              Open QR Coverage
            </Button>
          </Link>
          <Link href="/equipment/qr-scans">
            <Button variant="outline" size="sm">
              <History className="h-4 w-4" />
              Open Scan History
            </Button>
          </Link>
          <Link href="/reports/qr-scan-evidence">
            <Button variant="outline" size="sm">
              <FileDown className="h-4 w-4" />
              Scan Evidence Report
            </Button>
          </Link>
          <Link href="/equipment/qr-labels?status=generated&print=1" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" disabled={stats.generated === 0}>
              <Printer className="h-4 w-4" />
              Print Generated ({stats.generated})
            </Button>
          </Link>
          <Link href="/equipment/qr-labels?status=needs_replacement&print=1" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" disabled={stats.needsReplacement === 0}>
              <Printer className="h-4 w-4" />
              Print Needs Replacement ({stats.needsReplacement})
            </Button>
          </Link>
          <Link href="/equipment">
            <Button variant="ghost" size="sm">Open Equipment</Button>
          </Link>
        </div>
      </div>

      {message && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {message}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {errorMessage}
        </div>
      )}

      <motion.div
        variants={cardStagger}
        initial="initial"
        animate="animate"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {cards.map((card) => (
          <motion.div key={card.label} variants={cardItem}>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-[var(--text-muted)]">{card.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
                    <AnimatedMetric value={card.value} />
                  </p>
                </div>
                <Badge variant={badgeVariant(card.tone)}>
                  <QrCode className="h-3.5 w-3.5" />
                </Badge>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
        Phase state: identity complete (Phase 1), labels complete (Phase 2), online landing complete
        (Phase 3), role-specific scan experience complete (Phase 4), coverage expansion current
        (Phase 5), and scan logging/evidence complete in Phase 6. Offline/PWA support is not implemented
        in the six-phase QR plan. Counts above are computed from real <code>equipment_assets</code>
        and <code>equipment_qr_scans</code> rows; nothing is hardcoded or simulated.
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--foreground)]">QR Scan Evidence</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Online scan records from authenticated QR page renders. Refresh duplicates are deduped within the configured window.
          </p>
        </div>
        <motion.div
        variants={cardStagger}
        initial="initial"
        animate="animate"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
          {[
            { label: 'Total QR Scans', value: scanStats.totalScans, tone: 'info' },
            { label: 'Scans Last 7 Days', value: scanStats.scansLast7Days, tone: 'info' },
            { label: 'Attached Never Scanned', value: scanStats.attachedAssetsNeverScanned, tone: scanStats.attachedAssetsNeverScanned > 0 ? 'warning' : 'ok' },
            {
              label: 'Most Scanned Asset',
              value: scanStats.mostScannedAsset ? scanStats.mostScannedAsset.count : 0,
              tone: 'info',
              sub: scanStats.mostScannedAsset
                ? `${scanStats.mostScannedAsset.assetCode ?? 'Asset'} · ${scanStats.mostScannedAsset.assetName ?? 'Unnamed'}`
                : 'No scans recorded',
            },
          ].map((card) => (
            <motion.div key={card.label} variants={cardItem}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-[var(--text-muted)]">{card.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
                      <AnimatedMetric value={card.value} />
                    </p>
                    {'sub' in card && card.sub ? <p className="mt-1 text-xs text-[var(--text-muted)]">{card.sub}</p> : null}
                  </div>
                  <Badge variant={badgeVariant(card.tone)}>
                    <History className="h-3.5 w-3.5" />
                  </Badge>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h4 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Scans by Role</h4>
            {scanStats.scansByRole.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No QR scans recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {scanStats.scansByRole.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-muted)]">{row.label}</span>
                    <span className="font-semibold text-[var(--foreground)]">{row.count}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <h4 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Scans by Department</h4>
            {scanStats.scansByDepartment.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No QR scans recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {scanStats.scansByDepartment.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-muted)]">{row.label}</span>
                    <span className="font-semibold text-[var(--foreground)]">{row.count}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-[var(--foreground)]">Recent QR Scans</h4>
          <QrScanHistoryTable scans={scanStats.recentScans} emptyMessage="No QR scans recorded yet." />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h4 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Attached Assets Never Scanned</h4>
            {scanStats.attachedNeverScannedAssets.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No attached assets are missing scan evidence.</p>
            ) : (
              <div className="space-y-2">
                {scanStats.attachedNeverScannedAssets.map((asset) => (
                  <Link key={asset.id} href={`/equipment/${asset.id}#qr-identity`} className="flex items-center justify-between gap-3 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm hover:bg-[var(--surface-2)]">
                    <span>
                      <span className="block font-mono text-xs">{asset.asset_code}</span>
                      <span className="text-[var(--foreground)]">{asset.name}</span>
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{asset.department_name ?? 'No department'}</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <h4 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Revoked / Replacement Scan Risks</h4>
            {scanStats.revokedOrNeedsReplacementRecentScans.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No recent scans for revoked or needs-replacement labels.</p>
            ) : (
              <QrScanHistoryTable scans={scanStats.revokedOrNeedsReplacementRecentScans} compact />
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}
