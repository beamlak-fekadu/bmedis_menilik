'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { QrCode, RefreshCw, Stamp, Wrench, ShieldOff, AlertTriangle, Printer, Download, ExternalLink, Copy } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { useRole } from '@/hooks/useRole';
import { getEquipmentQrIdentityClient } from '@/services/equipment.service';
import {
  ensureAssetQrTokenAction,
  regenerateAssetQrTokenAction,
  markQrLabelPrintedAction,
  markQrLabelAttachedAction,
  markQrLabelNeedsReplacementAction,
  revokeQrTokenAction,
  getAssetQrScanSummaryAction,
} from '@/actions/qr.actions';
import {
  formatQrLabelStatus,
  getQrLabelStatusBadgeVariant,
  isQrLabelStatus,
  type QrLabelStatus,
  type AssetQrScanSummary,
} from '@/types/qr';
import { maskQrToken } from '@/utils/qr/token';
import { buildAssetQrPath, buildAssetQrUrlFromBase, getQrBaseUrl } from '@/utils/qr/url';
import { QRCodeCanvas } from 'qrcode.react';
import QrLabelPreview from '@/components/qr/QrLabelPreview';
import {
  renderQrLabelToDataUrl,
  createQrLabelFileName,
  triggerDataUrlDownload,
} from '@/utils/qr/render';
import QrScanHistoryTable from '@/components/qr/QrScanHistoryTable';

type Props = {
  assetId: string;
  assetCode?: string;
  assetName?: string;
  departmentName?: string | null;
  categoryName?: string | null;
  criticalityLevel?: string | null;
};

type Identity = {
  qr_token: string | null;
  qr_generated_at: string | null;
  qr_label_status: QrLabelStatus;
  qr_label_printed_at: string | null;
  qr_label_attached_at: string | null;
  qr_label_replaced_at: string | null;
  qr_token_regenerated_at: string | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function QrIdentityPanel({
  assetId,
  assetCode,
  assetName,
  departmentName,
  categoryName,
  criticalityLevel,
}: Props) {
  const { isDeveloper, isAdmin, isBmeHead } = useRole();
  const canAdmin = isDeveloper || isAdmin || isBmeHead;
  const downloadCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scanSummary, setScanSummary] = useState<AssetQrScanSummary | null>(null);
  const [scanEvidenceOpen, setScanEvidenceOpen] = useState(false);
  const [qrBaseUrl, setQrBaseUrl] = useState<string | null | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchQrBaseUrl() {
      try {
        const response = await fetch('/api/qr/base-url', { cache: 'no-store' });
        if (!response.ok) throw new Error('QR base URL endpoint failed');
        const payload = (await response.json()) as { baseUrl?: unknown };
        if (!cancelled) {
          setQrBaseUrl(typeof payload.baseUrl === 'string' ? payload.baseUrl : null);
        }
      } catch {
        if (!cancelled) setQrBaseUrl(getQrBaseUrl());
      }
    }
    void fetchQrBaseUrl();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchIdentity() {
      const { data, error } = await getEquipmentQrIdentityClient(assetId);
      if (cancelled) return;
      if (error) {
        setErrorMessage(error.message);
        setIdentity(null);
      } else if (data) {
        const status = isQrLabelStatus(data.qr_label_status) ? data.qr_label_status : 'not_generated';
        setIdentity({
          qr_token: data.qr_token ?? null,
          qr_generated_at: data.qr_generated_at ?? null,
          qr_label_status: status,
          qr_label_printed_at: data.qr_label_printed_at ?? null,
          qr_label_attached_at: data.qr_label_attached_at ?? null,
          qr_label_replaced_at: data.qr_label_replaced_at ?? null,
          qr_token_regenerated_at: data.qr_token_regenerated_at ?? null,
        });
      } else {
        setIdentity(null);
      }
      setLoading(false);
    }
    fetchIdentity();
    return () => {
      cancelled = true;
    };
  }, [assetId, reloadKey]);

  useEffect(() => {
    if (!canAdmin) return;
    let cancelled = false;
    async function fetchScanSummary() {
      const result = await getAssetQrScanSummaryAction(assetId);
      if (cancelled) return;
      if (result.success && result.data) setScanSummary(result.data);
    }
    void fetchScanSummary();
    return () => {
      cancelled = true;
    };
  }, [assetId, canAdmin, reloadKey]);

  const reload = () => setReloadKey((v) => v + 1);

  const runAction = (label: string, action: () => Promise<{ success: boolean; error?: string }>) => {
    setMessage(null);
    setErrorMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setErrorMessage(result.error ?? `${label} failed`);
        return;
      }
      setMessage(`${label} succeeded.`);
      reload();
    });
  };

  if (loading) {
    return (
      <div className="panel-surface rounded-lg p-4 text-sm text-[var(--text-muted)]">
        Loading QR identity…
      </div>
    );
  }

  const hasToken = !!identity?.qr_token;
  const status: QrLabelStatus = identity?.qr_label_status ?? 'not_generated';
  const qrUrl = buildAssetQrUrlFromBase(identity?.qr_token ?? null, qrBaseUrl ?? null);
  const qrPath = buildAssetQrPath(identity?.qr_token ?? null);
  const canPrintLabel = hasToken && status !== 'revoked' && !!qrUrl;
  const qrUrlConfigurationMissing = hasToken && status !== 'revoked' && qrBaseUrl !== undefined && !qrUrl;
  const printRoute = `/equipment/qr-labels?assets=${encodeURIComponent(assetId)}&print=1`;
  const displayAssetCode = assetCode ?? 'ASSET';
  const displayAssetName = assetName ?? 'Equipment';

  const handleDownloadPng = () => {
    if (!canPrintLabel) return;
    setMessage(null);
    setErrorMessage(null);
    try {
      const dataUrl = renderQrLabelToDataUrl({
        qrSource: downloadCanvasRef.current,
        info: {
          assetCode: displayAssetCode,
          assetName: displayAssetName,
          departmentName: departmentName ?? null,
        },
      });
      triggerDataUrlDownload(dataUrl, createQrLabelFileName(displayAssetCode, displayAssetName));
      setMessage('QR label PNG downloaded. Mark Printed once the sticker is actually printed.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to render label PNG');
    }
  };

  // Non-admin roles only see a minimal read-only status line.
  if (!canAdmin) {
    return (
      <div className="panel-surface rounded-lg p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-md bg-[var(--surface-2)] p-2 text-[var(--brand)]">
            <QrCode className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">QR Label</h2>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-muted)]">Status</span>
          <Badge variant={getQrLabelStatusBadgeVariant(status)}>{formatQrLabelStatus(status)}</Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-surface rounded-lg p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[var(--surface-2)] p-2 text-[var(--brand)]">
            <QrCode className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">QR Identity</h2>
        </div>
        <Badge variant={getQrLabelStatusBadgeVariant(status)}>{formatQrLabelStatus(status)}</Badge>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[var(--text-muted)]">Token</span>
          <span className="font-mono text-xs text-[var(--foreground)]">{hasToken ? maskQrToken(identity!.qr_token) : 'Not generated'}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[var(--text-muted)]">Generated</span>
          <span className="text-xs text-[var(--foreground)]">{formatDate(identity?.qr_generated_at)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[var(--text-muted)]">Printed</span>
          <span className="text-xs text-[var(--foreground)]">{formatDate(identity?.qr_label_printed_at)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[var(--text-muted)]">Attached</span>
          <span className="text-xs text-[var(--foreground)]">{formatDate(identity?.qr_label_attached_at)}</span>
        </div>
        {identity?.qr_token_regenerated_at && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--text-muted)]">Last regenerated</span>
            <span className="text-xs text-[var(--foreground)]">{formatDate(identity.qr_token_regenerated_at)}</span>
          </div>
        )}
        {identity?.qr_label_replaced_at && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--text-muted)]">Label replaced</span>
            <span className="text-xs text-[var(--foreground)]">{formatDate(identity.qr_label_replaced_at)}</span>
          </div>
        )}
      </div>

      {hasToken && qrUrl && (
        <div className="mt-4 grid gap-4 sm:grid-cols-[260px_1fr]">
          <div className="flex items-start justify-center">
            <QrLabelPreview
              qrUrl={qrUrl}
              assetCode={displayAssetCode}
              assetName={displayAssetName}
              departmentName={departmentName}
              categoryName={categoryName}
              criticalityLevel={criticalityLevel}
            />
          </div>
          <div className="space-y-2 text-xs text-[var(--text-muted)]">
            <p>
              <span className="font-semibold text-[var(--foreground)]">QR URL: </span>
              <span className="font-mono">{qrPath}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={qrPath ?? '#'} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" disabled={!qrPath || status === 'revoked'}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open QR Page
                </Button>
              </Link>
              <Button
                size="sm"
                variant="ghost"
                disabled={!qrUrl}
                onClick={async () => {
                  if (!qrUrl) return;
                  try {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      await navigator.clipboard.writeText(qrUrl);
                      setMessage('QR URL copied to clipboard.');
                    } else {
                      setErrorMessage('Clipboard is not available in this browser.');
                    }
                  } catch (err) {
                    setErrorMessage(err instanceof Error ? err.message : 'Failed to copy URL');
                  }
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy URL
              </Button>
            </div>
            {status === 'revoked' && (
              <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-200">
                This QR token is revoked. Regenerate a new token before printing or attaching a new label.
              </p>
            )}
            {status === 'needs_replacement' && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-200">
                The current label is flagged for replacement. You can print a fresh label using the current
                token, or regenerate the token first if the label was compromised.
              </p>
            )}
            <p>
              Printing here only outputs the label. Use <em>Mark Printed</em> after physically printing
              the sticker so the lifecycle stays accurate.
            </p>
          </div>
          {/* Offscreen canvas used by Download PNG. Kept tiny via display:none so layout isn't disrupted. */}
          <div className="hidden">
            <QRCodeCanvas value={qrUrl} size={420} level="M" bgColor="#ffffff" fgColor="#0a0a0a" marginSize={2} ref={downloadCanvasRef} />
          </div>
        </div>
      )}

      {qrUrlConfigurationMissing && (
        <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          QR preview, copy, download, and print are disabled because no stable QR base URL is
          configured. Set NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL to the production domain
          before printing labels.
        </div>
      )}

      {message && (
        <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {message}
        </div>
      )}
      {errorMessage && (
        <div className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {errorMessage}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {!hasToken && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => runAction('Generate QR token', () => ensureAssetQrTokenAction(assetId))}
          >
            <QrCode className="h-4 w-4" />
            Generate QR Token
          </Button>
        )}
        {hasToken && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (typeof window !== 'undefined') {
                const ok = window.confirm(
                  'Regenerating will issue a new QR token. The current printed label will become invalid once Phase 3 routing is live. Continue?',
                );
                if (!ok) return;
              }
              runAction('Regenerate QR token', () => regenerateAssetQrTokenAction(assetId));
            }}
          >
            <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
            Regenerate Token
          </Button>
        )}
        {canPrintLabel && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={handleDownloadPng}
            >
              <Download className="h-4 w-4" />
              Download PNG
            </Button>
            <Link href={printRoute} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" disabled={pending}>
                <Printer className="h-4 w-4" />
                Print Label
              </Button>
            </Link>
          </>
        )}
        {hasToken && status !== 'revoked' && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => runAction('Mark printed', () => markQrLabelPrintedAction(assetId))}
            >
              <Stamp className="h-4 w-4" />
              Mark Printed
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => runAction('Mark attached', () => markQrLabelAttachedAction(assetId))}
            >
              <Wrench className="h-4 w-4" />
              Mark Attached
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => runAction('Flag for replacement', () => markQrLabelNeedsReplacementAction(assetId))}
            >
              <AlertTriangle className="h-4 w-4" />
              Needs Replacement
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (typeof window !== 'undefined') {
                  const ok = window.confirm(
                    'Revoking will mark the current QR token as revoked. Phase 3 routing will reject scans of this token. Continue?',
                  );
                  if (!ok) return;
                }
                runAction('Revoke QR token', () => revokeQrTokenAction(assetId));
              }}
            >
              <ShieldOff className="h-4 w-4" />
              Revoke
            </Button>
          </>
        )}
      </div>

      <div className="mt-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]/60 p-3">
        <button
          type="button"
          onClick={() => setScanEvidenceOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="block text-sm font-semibold text-[var(--foreground)]">QR Scan Evidence</span>
            <span className="text-xs text-[var(--text-muted)]">
              {scanSummary
                ? `${scanSummary.totalScans} scan record${scanSummary.totalScans === 1 ? '' : 's'}${scanSummary.lastScannedAt ? ` · last ${formatDate(scanSummary.lastScannedAt)}` : ''}`
                : 'Loading scan evidence...'}
            </span>
          </span>
          <Badge variant="info">{scanEvidenceOpen ? 'Hide' : 'Show'}</Badge>
        </button>
        {scanEvidenceOpen && (
          <div className="mt-3 space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-md bg-[var(--surface-2)] p-2">
                <p className="text-xs text-[var(--text-muted)]">Total scans</p>
                <p className="text-lg font-semibold text-[var(--foreground)]">{scanSummary?.totalScans ?? 0}</p>
              </div>
              <div className="rounded-md bg-[var(--surface-2)] p-2">
                <p className="text-xs text-[var(--text-muted)]">Last scanned by</p>
                <p className="text-sm font-semibold text-[var(--foreground)]">{scanSummary?.lastScannedBy ?? 'No scans recorded'}</p>
              </div>
              <div className="rounded-md bg-[var(--surface-2)] p-2">
                <p className="text-xs text-[var(--text-muted)]">Roles seen</p>
                <p className="text-sm font-semibold text-[var(--foreground)]">{scanSummary?.roles.join(', ') || 'No roles yet'}</p>
              </div>
            </div>
            <QrScanHistoryTable
              scans={scanSummary?.recentScans ?? []}
              compact
              showAsset={false}
              emptyMessage="No QR scans recorded for this asset."
            />
            <div className="flex justify-end">
              <Link href={`/equipment/qr-scans?asset=${encodeURIComponent(assetId)}`}>
                <Button size="sm" variant="outline">Open Full Scan History</Button>
              </Link>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-[var(--text-muted)]">
        QR token identifies the asset only — it never grants permissions. Role-based access still applies to
        anything the scanner sees or does. Scan evidence is online QR activity only; offline/PWA logging is
        outside the current QR implementation.
      </p>
    </div>
  );
}
