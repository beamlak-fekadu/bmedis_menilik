'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, RefreshCw, Stamp, Wrench, AlertTriangle, QrCode } from 'lucide-react';
import { PageHeader, Button, Badge, Card } from '@/components/ui';
import QrLabelPrintSheet from '@/components/qr/QrLabelPrintSheet';
import {
  formatQrLabelStatus,
  getQrLabelStatusBadgeVariant,
  QR_LABEL_FILTER_VALUES,
  type QrCoverageStats,
  type QrLabelAsset,
  type QrLabelFilter,
} from '@/types/qr';
import {
  bulkGenerateMissingQrTokensAction,
  markQrLabelsPrintedBulkAction,
  markQrLabelsAttachedBulkAction,
  markQrLabelsNeedsReplacementBulkAction,
} from '@/actions/qr.actions';

type Props = {
  assets: QrLabelAsset[];
  coverage: QrCoverageStats;
  initialFilter: QrLabelFilter;
  preselectedIds: string[];
  autoPrint?: boolean;
  qrBaseUrl: string | null;
};

const FILTER_LABELS: Record<QrLabelFilter, string> = {
  all: 'All',
  generated: 'Generated',
  printed: 'Printed',
  attached: 'Attached',
  needs_replacement: 'Needs Replacement',
  revoked: 'Revoked',
  missing_token: 'Missing Token',
};

function matchesFilter(asset: QrLabelAsset, filter: QrLabelFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'missing_token') return !asset.qr_token;
  return asset.qr_label_status === filter;
}

export default function QrLabelSheetClient({
  assets,
  coverage,
  initialFilter,
  preselectedIds,
  autoPrint,
  qrBaseUrl,
}: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<QrLabelFilter>(initialFilter);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preselectedIds));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autoPrintRanRef = useRef(false);
  const canPrintQrLabels = !!qrBaseUrl;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (!matchesFilter(a, filter)) return false;
      if (!term) return true;
      return (
        a.asset_code.toLowerCase().includes(term) ||
        a.name.toLowerCase().includes(term) ||
        (a.department_name ?? '').toLowerCase().includes(term)
      );
    });
  }, [assets, filter, search]);

  const selectedAssets = useMemo(
    () => assets.filter((a) => selected.has(a.id) && !!a.qr_token),
    [assets, selected],
  );

  const printableNow = selectedAssets.length > 0 ? selectedAssets : filtered.filter((a) => !!a.qr_token);

  useEffect(() => {
    if (!autoPrint || autoPrintRanRef.current) return;
    if (!canPrintQrLabels) return;
    if (printableNow.length === 0) return;
    autoPrintRanRef.current = true;
    const id = setTimeout(() => window.print(), 250);
    return () => clearTimeout(id);
  }, [autoPrint, canPrintQrLabels, printableNow]);

  const togglePick = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setAllVisible = (value: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((a) => {
        if (value && a.qr_token) next.add(a.id);
        else next.delete(a.id);
      });
      return next;
    });
  };

  const triggerPrint = () => {
    setMessage(null);
    setErrorMessage(null);
    if (!canPrintQrLabels) {
      setErrorMessage('QR labels cannot be printed until NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL is set to the stable production domain.');
      return;
    }
    if (printableNow.length === 0) {
      setErrorMessage('No tokenized assets to print. Generate missing tokens or adjust the filter.');
      return;
    }
    window.print();
  };

  const runBulk = (
    label: string,
    action: () => Promise<{ success: boolean; error?: string }>,
  ) => {
    setMessage(null);
    setErrorMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setErrorMessage(result.error ?? `${label} failed`);
        return;
      }
      setMessage(`${label} succeeded.`);
      router.refresh();
    });
  };

  const handleBulkGenerate = () =>
    runBulk('Generate missing tokens', () => bulkGenerateMissingQrTokensAction());

  const handleMarkSelectedPrinted = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      setErrorMessage('Select at least one asset first.');
      return;
    }
    runBulk('Mark selected printed', () => markQrLabelsPrintedBulkAction(ids));
  };

  const handleMarkSelectedAttached = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      setErrorMessage('Select at least one asset first.');
      return;
    }
    runBulk('Mark selected attached', () => markQrLabelsAttachedBulkAction(ids));
  };

  const handleMarkSelectedNeedsReplacement = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      setErrorMessage('Select at least one asset first.');
      return;
    }
    runBulk('Flag selected for replacement', () =>
      markQrLabelsNeedsReplacementBulkAction(ids),
    );
  };

  const totalsCard: Array<{ label: string; value: number }> = [
    { label: 'Active assets', value: coverage.totalActiveAssets },
    { label: 'Without token', value: coverage.withoutToken },
    { label: 'Generated', value: coverage.generated },
    { label: 'Printed', value: coverage.printed },
    { label: 'Attached', value: coverage.attached },
    { label: 'Needs replacement', value: coverage.needsReplacement },
    { label: 'Revoked', value: coverage.revoked },
    { label: 'Visible in filter', value: filtered.length },
  ];

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((a) => selected.has(a.id) || !a.qr_token);

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          title="QR Label Sheet"
          description="Preview, print, and mark lifecycle for equipment QR labels. Phase 2 — local-only generation."
          breadcrumbs={[
            { label: 'Equipment', href: '/equipment' },
            { label: 'QR Labels' },
          ]}
          actions={
            <div className="flex gap-2">
              <Link href="/equipment">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Equipment
                </Button>
              </Link>
              <Link href="/developer-lab">
                <Button variant="ghost" size="sm">Developer Lab</Button>
              </Link>
              <Link href="/equipment/qr-coverage">
                <Button variant="ghost" size="sm">QR Coverage</Button>
              </Link>
            </div>
          }
        />
      </div>

      <div className="no-print grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {totalsCard.map((card) => (
          <Card key={card.label}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--text-muted)]">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{card.value}</p>
              </div>
              <Badge variant="info"><QrCode className="h-3.5 w-3.5" /></Badge>
            </div>
          </Card>
        ))}
      </div>

      <div className="no-print panel-surface space-y-4 rounded-lg p-4">
        {!canPrintQrLabels && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            QR printing is disabled because no stable QR base URL is configured. Set
            NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL to the production domain before printing labels.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Filter</span>
          {QR_LABEL_FILTER_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                filter === value
                  ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--brand)]/40'
              }`}
            >
              {FILTER_LABELS[value]}
            </button>
          ))}
          <div className="ml-auto">
            <input
              type="search"
              placeholder="Search code / name / department"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-72 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={triggerPrint} disabled={!canPrintQrLabels || printableNow.length === 0}>
            <Printer className="h-4 w-4" />
            Print {selectedAssets.length > 0 ? `${selectedAssets.length} selected` : `${printableNow.length} visible`}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleBulkGenerate}
            disabled={pending || coverage.withoutToken === 0}
          >
            <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
            {coverage.withoutToken === 0
              ? 'All assets tokenized'
              : `Generate ${coverage.withoutToken} missing`}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkSelectedPrinted}
            disabled={pending || selected.size === 0}
          >
            <Stamp className="h-4 w-4" />
            Mark Selected Printed
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkSelectedAttached}
            disabled={pending || selected.size === 0}
          >
            <Wrench className="h-4 w-4" />
            Mark Selected Attached
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkSelectedNeedsReplacement}
            disabled={pending || selected.size === 0}
          >
            <AlertTriangle className="h-4 w-4" />
            Flag Selected for Replacement
          </Button>
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

        <div className="overflow-x-auto rounded-md border border-[var(--border-subtle)]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-1)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all visible printable assets"
                    checked={allVisibleSelected}
                    onChange={(e) => setAllVisible(e.target.checked)}
                  />
                </th>
                <th className="px-3 py-2">Asset Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2">QR Status</th>
                <th className="px-3 py-2">Generated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]/60 text-[var(--foreground)]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
                    No assets match this filter.
                  </td>
                </tr>
              )}
              {filtered.map((asset) => (
                <tr key={asset.id}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${asset.asset_code}`}
                      disabled={!asset.qr_token}
                      checked={selected.has(asset.id)}
                      onChange={() => togglePick(asset.id)}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{asset.asset_code}</td>
                  <td className="px-3 py-2">{asset.name}</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">{asset.department_name ?? '—'}</td>
                  <td className="px-3 py-2">
                    {asset.qr_token ? (
                      <Badge variant={getQrLabelStatusBadgeVariant(asset.qr_label_status)}>
                        {formatQrLabelStatus(asset.qr_label_status)}
                      </Badge>
                    ) : (
                      <Badge variant="default">Missing Token</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--text-muted)]">
                    {asset.qr_generated_at
                      ? new Date(asset.qr_generated_at).toLocaleString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
          Printing labels does <strong>not</strong> automatically mark them as printed. Use
          <em> Mark Selected Printed</em> after physical printing. The QR scan landing route is
          delivered in Phase 3. Offline scan logging is out of scope for the QR plan.
        </div>
      </div>

      {/* Print surface — visible on screen so the user can preview before pressing Print. */}
      <section>
        <div className="no-print mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Print Preview ({printableNow.length} label{printableNow.length === 1 ? '' : 's'})
          </h2>
          <span className="text-xs text-[var(--text-muted)]">
            {selectedAssets.length > 0
              ? 'Selected assets only'
              : 'All visible tokenized assets'}
          </span>
        </div>
        <QrLabelPrintSheet assets={printableNow} qrBaseUrl={qrBaseUrl} />
      </section>
    </div>
  );
}
