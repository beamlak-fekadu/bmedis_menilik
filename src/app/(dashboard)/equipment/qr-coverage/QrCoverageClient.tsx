'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Printer, QrCode, RefreshCw, Stamp, Wrench } from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import {
  bulkGenerateMissingQrTokensAction,
  ensureAssetQrTokenAction,
  markQrLabelAttachedAction,
  markQrLabelNeedsReplacementAction,
  markQrLabelPrintedAction,
  markQrLabelsAttachedBulkAction,
  markQrLabelsNeedsReplacementBulkAction,
  markQrLabelsPrintedBulkAction,
  regenerateAssetQrTokenAction,
  revokeQrTokenAction,
} from '@/actions/qr.actions';
import {
  formatQrLabelStatus,
  formatQrReadinessState,
  getQrLabelStatusBadgeVariant,
  getQrReadinessState,
  type QrCoverageStats,
  type QrAssetScanMetric,
  type QrLabelAsset,
} from '@/types/qr';

type Props = {
  assets: QrLabelAsset[];
  coverage: QrCoverageStats;
  scanMetrics: Record<string, QrAssetScanMetric>;
};

type SectionKey =
  | 'missing'
  | 'generated'
  | 'printed'
  | 'needs_replacement'
  | 'revoked'
  | 'regenerated'
  | 'never_scanned'
  | 'scanned_recently'
  | 'attached_never_scanned'
  | 'revoked_recent_scan';

function fmt(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function lastLifecycleUpdate(asset: QrLabelAsset): string | null {
  return [
    asset.qr_token_regenerated_at,
    asset.qr_label_replaced_at,
    asset.qr_label_attached_at,
    asset.qr_label_printed_at,
    asset.qr_generated_at,
  ].filter(Boolean).sort().at(-1) ?? null;
}

function statusLabel(asset: QrLabelAsset): string {
  if (!asset.qr_token || asset.qr_label_status === 'not_generated') return 'No Token';
  return formatQrLabelStatus(asset.qr_label_status);
}

function canPrint(asset: QrLabelAsset): boolean {
  return !!asset.qr_token && asset.qr_label_status !== 'revoked';
}

export default function QrCoverageClient({ assets, coverage, scanMetrics }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState<SectionKey>('missing');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const groups = useMemo(() => {
    const regenerated = assets
      .filter((asset) => !!asset.qr_token_regenerated_at)
      .sort((a, b) => String(b.qr_token_regenerated_at).localeCompare(String(a.qr_token_regenerated_at)))
      .slice(0, 50);
    return {
      missing: assets.filter((asset) => !asset.qr_token || asset.qr_label_status === 'not_generated'),
      generated: assets.filter((asset) => !!asset.qr_token && asset.qr_label_status === 'generated'),
      printed: assets.filter((asset) => asset.qr_label_status === 'printed'),
      needs_replacement: assets.filter((asset) => asset.qr_label_status === 'needs_replacement'),
      revoked: assets.filter((asset) => asset.qr_label_status === 'revoked'),
      regenerated,
      never_scanned: assets.filter((asset) => (scanMetrics[asset.id]?.totalScans ?? 0) === 0),
      scanned_recently: assets.filter((asset) => (scanMetrics[asset.id]?.scansLast30Days ?? 0) > 0),
      attached_never_scanned: assets.filter((asset) => asset.qr_label_status === 'attached' && (scanMetrics[asset.id]?.totalScans ?? 0) === 0),
      revoked_recent_scan: assets.filter((asset) => asset.qr_label_status === 'revoked' && (scanMetrics[asset.id]?.scansLast30Days ?? 0) > 0),
    };
  }, [assets, scanMetrics]);

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selected.has(asset.id)),
    [assets, selected],
  );
  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const printableSelectedIds = selectedAssets.filter(canPrint).map((asset) => asset.id);
  const visibleRows = groups[activeSection];
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((asset) => selected.has(asset.id));

  const cards = [
    { key: 'total', label: 'Total Active Assets', value: coverage.totalActiveAssets, tone: 'info' },
    { key: 'missing', label: 'Assets Without QR Token', value: coverage.withoutToken, tone: coverage.withoutToken > 0 ? 'warning' : 'success' },
    { key: 'generated', label: 'Generated Labels', value: coverage.generated, tone: 'info' },
    { key: 'printed', label: 'Printed Labels', value: coverage.printed, tone: 'warning' },
    { key: 'attached', label: 'Attached Labels', value: coverage.attached, tone: 'success' },
    { key: 'needs-replacement', label: 'Needs Replacement', value: coverage.needsReplacement, tone: coverage.needsReplacement > 0 ? 'warning' : 'success' },
    { key: 'revoked', label: 'Revoked', value: coverage.revoked, tone: coverage.revoked > 0 ? 'error' : 'success' },
    { key: 'scans', label: 'Scan Records Existing', value: coverage.recentScanCount, tone: 'info' },
  ] as const;

  const sections: Array<{ key: SectionKey; label: string; count: number }> = [
    { key: 'missing', label: 'Missing QR Tokens', count: groups.missing.length },
    { key: 'generated', label: 'Generated Not Printed', count: groups.generated.length },
    { key: 'printed', label: 'Printed Not Attached', count: groups.printed.length },
    { key: 'needs_replacement', label: 'Needs Replacement', count: groups.needs_replacement.length },
    { key: 'revoked', label: 'Revoked Labels', count: groups.revoked.length },
    { key: 'regenerated', label: 'Recently Regenerated', count: groups.regenerated.length },
    { key: 'never_scanned', label: 'Never Scanned', count: groups.never_scanned.length },
    { key: 'scanned_recently', label: 'Scanned Recently', count: groups.scanned_recently.length },
    { key: 'attached_never_scanned', label: 'Attached Never Scanned', count: groups.attached_never_scanned.length },
    { key: 'revoked_recent_scan', label: 'Revoked Recently Scanned', count: groups.revoked_recent_scan.length },
  ];

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setVisibleSelected(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      visibleRows.forEach((asset) => {
        if (checked) next.add(asset.id);
        else next.delete(asset.id);
      });
      return next;
    });
  }

  function runAction(label: string, action: () => Promise<{ success: boolean; error?: string }>, clearSelection = false) {
    setMessage(null);
    setErrorMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setErrorMessage(result.error ?? `${label} failed`);
        return;
      }
      setMessage(`${label} succeeded.`);
      if (clearSelection) setSelected(new Set());
      router.refresh();
    });
  }

  function runSelected(label: string, action: (ids: string[]) => Promise<{ success: boolean; error?: string }>) {
    if (selectedIds.length === 0) {
      setErrorMessage('Select at least one asset first.');
      return;
    }
    runAction(label, () => action(selectedIds), true);
  }

  function printSelected() {
    if (printableSelectedIds.length === 0) {
      setErrorMessage('Select at least one tokenized, non-revoked asset before printing labels.');
      return;
    }
    router.push(`/equipment/qr-labels?assets=${encodeURIComponent(printableSelectedIds.join(','))}&print=1`);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.key}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--text-muted)]">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{card.value}</p>
              </div>
              <Badge variant={card.tone}>
                <QrCode className="h-3.5 w-3.5" />
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
        QR readiness is physical label readiness only. Ready to Scan requires an existing token, label status attached, and no revoked status. Scan metrics below are online scan records only; offline/PWA evidence is not implemented.
      </div>

      <div className="panel-surface space-y-3 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <p className="text-sm font-semibold text-[var(--foreground)]">Bulk QR Actions</p>
            <p className="text-xs text-[var(--text-muted)]">{selected.size} selected, {printableSelectedIds.length} printable.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => runAction('Generate missing QR tokens', () => bulkGenerateMissingQrTokensAction())} disabled={pending || coverage.withoutToken === 0}>
            <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
            Generate Missing ({coverage.withoutToken})
          </Button>
          <Button size="sm" variant="outline" onClick={printSelected} disabled={pending || printableSelectedIds.length === 0}>
            <Printer className="h-4 w-4" />
            Print Selected
          </Button>
          <Button size="sm" variant="outline" onClick={() => runSelected('Mark selected printed', markQrLabelsPrintedBulkAction)} disabled={pending || selected.size === 0}>
            <Stamp className="h-4 w-4" />
            Mark Printed
          </Button>
          <Button size="sm" variant="outline" onClick={() => runSelected('Mark selected attached', markQrLabelsAttachedBulkAction)} disabled={pending || selected.size === 0}>
            <Wrench className="h-4 w-4" />
            Mark Attached
          </Button>
          <Button size="sm" variant="outline" onClick={() => runSelected('Flag selected for replacement', markQrLabelsNeedsReplacementBulkAction)} disabled={pending || selected.size === 0}>
            <AlertTriangle className="h-4 w-4" />
            Needs Replacement
          </Button>
        </div>
        {message && <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div>}
        {errorMessage && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{errorMessage}</div>}
      </div>

      <div className="flex flex-wrap gap-2">
        {sections.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => setActiveSection(section.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              activeSection === section.key
                ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--brand)]/40'
            }`}
          >
            {section.label} ({section.count})
          </button>
        ))}
      </div>

      <div className="panel-surface overflow-hidden rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-[var(--surface-3)] bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all visible QR coverage rows"
                    checked={allVisibleSelected}
                    onChange={(event) => setVisibleSelected(event.target.checked)}
                  />
                </th>
                <th className="px-3 py-2">Asset Code</th>
                <th className="px-3 py-2">Asset Name</th>
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Criticality</th>
                <th className="px-3 py-2">QR Status</th>
                <th className="px-3 py-2">Generated At</th>
                <th className="px-3 py-2">Printed At</th>
                <th className="px-3 py-2">Attached At</th>
                <th className="px-3 py-2">Last Lifecycle Update</th>
                <th className="px-3 py-2">Total Scans</th>
                <th className="px-3 py-2">Last Scanned</th>
                <th className="px-3 py-2">Last Role</th>
                <th className="px-3 py-2">Scans Last 30d</th>
                <th className="px-3 py-2">Next Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]/60">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
                    No assets in this QR coverage group.
                  </td>
                </tr>
              ) : (
                visibleRows.map((asset) => {
                  const readiness = getQrReadinessState(asset);
                  const scanMetric = scanMetrics[asset.id];
                  return (
                    <tr key={asset.id}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${asset.asset_code}`}
                          checked={selected.has(asset.id)}
                          onChange={() => toggleSelected(asset.id)}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{asset.asset_code}</td>
                      <td className="px-3 py-2">{asset.name}</td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{asset.department_name ?? '-'}</td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{asset.category_name ?? '-'}</td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{asset.criticality_level ?? '-'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <Badge variant={asset.qr_token ? getQrLabelStatusBadgeVariant(asset.qr_label_status) : 'default'}>
                            {statusLabel(asset)}
                          </Badge>
                          <span className="text-[10px] text-[var(--text-muted)]">{formatQrReadinessState(readiness)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{fmt(asset.qr_generated_at)}</td>
                      <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{fmt(asset.qr_label_printed_at)}</td>
                      <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{fmt(asset.qr_label_attached_at)}</td>
                      <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{fmt(lastLifecycleUpdate(asset))}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-[var(--foreground)]">{scanMetric?.totalScans ?? 0}</td>
                      <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{fmt(scanMetric?.lastScannedAt)}</td>
                      <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{scanMetric?.lastScannedByRole ?? '-'}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-[var(--foreground)]">{scanMetric?.scansLast30Days ?? 0}</td>
                      <td className="px-3 py-2">
                        <div className="flex min-w-[280px] flex-wrap gap-1.5">
                          <Link href={`/equipment/${asset.id}#qr-identity`} className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)]">
                            QR Panel
                          </Link>
                          {!asset.qr_token ? (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => runAction('Generate QR token', () => ensureAssetQrTokenAction(asset.id))}
                              className="rounded-lg bg-[var(--brand)] px-2 py-1 text-xs font-medium text-white hover:bg-[var(--brand-strong)] disabled:opacity-50"
                            >
                              Generate Token
                            </button>
                          ) : (
                            <>
                              {asset.qr_label_status !== 'revoked' && (
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => router.push(`/equipment/qr-labels?assets=${encodeURIComponent(asset.id)}&print=1`)}
                                  className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)] disabled:opacity-50"
                                >
                                  Print Label
                                </button>
                              )}
                              {asset.qr_label_status !== 'revoked' && (
                                <>
                                  <button type="button" disabled={pending} onClick={() => runAction('Mark printed', () => markQrLabelPrintedAction(asset.id))} className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50">Mark Printed</button>
                                  <button type="button" disabled={pending} onClick={() => runAction('Mark attached', () => markQrLabelAttachedAction(asset.id))} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">Mark Attached</button>
                                  <button type="button" disabled={pending} onClick={() => runAction('Flag for replacement', () => markQrLabelNeedsReplacementAction(asset.id))} className="rounded-lg bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50">Needs Replacement</button>
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => {
                                      if (window.confirm('Regenerate this asset QR token and reset its label lifecycle?')) {
                                        runAction('Regenerate QR token', () => regenerateAssetQrTokenAction(asset.id));
                                      }
                                    }}
                                    className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)] disabled:opacity-50"
                                  >
                                    Regenerate
                                  </button>
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => {
                                      if (window.confirm('Revoke this QR token? Scans of this label will be rejected.')) {
                                        runAction('Revoke QR token', () => revokeQrTokenAction(asset.id));
                                      }
                                    }}
                                    className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                                  >
                                    Revoke
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
