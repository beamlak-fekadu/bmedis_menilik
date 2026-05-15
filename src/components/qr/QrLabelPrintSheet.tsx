'use client';

// Print-friendly grid of QR labels. Layout uses CSS grid with auto-fill so
// labels reflow cleanly across A4 pages in print preview. The outer
// `qr-print-sheet` wrapper is targeted by a small print stylesheet to ensure
// the rest of the dashboard is hidden when window.print() runs.

import QrLabelPreview from './QrLabelPreview';
import type { QrLabelAsset } from '@/types/qr';
import { buildAssetQrUrl } from '@/utils/qr/url';

type Props = {
  assets: QrLabelAsset[];
};

export default function QrLabelPrintSheet({ assets }: Props) {
  const printable = assets.filter((asset) => !!asset.qr_token);
  if (printable.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 text-center text-sm text-[var(--text-muted)]">
        No assets with QR tokens to print. Use Generate Missing Tokens first.
      </div>
    );
  }
  return (
    <div className="qr-print-sheet grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
      {printable.map((asset) => {
        const qrUrl = buildAssetQrUrl(asset.qr_token);
        if (!qrUrl) return null;
        return (
          <div key={asset.id} className="flex justify-center break-inside-avoid">
            <QrLabelPreview
              qrUrl={qrUrl}
              assetCode={asset.asset_code}
              assetName={asset.name}
              departmentName={asset.department_name}
              categoryName={asset.category_name}
              criticalityLevel={asset.criticality_level}
              size="md"
            />
          </div>
        );
      })}
    </div>
  );
}
