'use client';

// Visual representation of a physical QR sticker. Used in:
//   - Equipment detail QrIdentityPanel preview
//   - /equipment/qr-labels print sheet grid
//
// Pure presentational component. No data fetching, no actions.

import QrCodeImage from './QrCodeImage';
import type { QrLabelSize } from '@/types/qr';

type Props = {
  qrUrl: string;
  assetCode: string;
  assetName: string;
  departmentName?: string | null;
  categoryName?: string | null;
  criticalityLevel?: string | null;
  size?: QrLabelSize;
  showFooterNote?: boolean;
  scanInstruction?: string;
};

const SIZE_TOKENS: Record<QrLabelSize, { wrap: string; code: string; name: string; qr: number }> = {
  sm: { wrap: 'w-[220px] p-3', code: 'text-base', name: 'text-xs', qr: 132 },
  md: { wrap: 'w-[260px] p-4', code: 'text-lg', name: 'text-sm', qr: 168 },
  lg: { wrap: 'w-[320px] p-5', code: 'text-2xl', name: 'text-sm', qr: 220 },
};

export default function QrLabelPreview({
  qrUrl,
  assetCode,
  assetName,
  departmentName,
  categoryName,
  criticalityLevel,
  size = 'md',
  showFooterNote = true,
  scanInstruction = 'Scan for service record',
}: Props) {
  const tokens = SIZE_TOKENS[size];
  return (
    <div
      className={`qr-label-preview flex flex-col items-stretch rounded-md border border-black bg-white text-black ${tokens.wrap}`}
      data-qr-label
    >
      <div className="-mx-3 -mt-3 mb-2 flex items-center justify-between bg-black px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white sm:-mx-4 sm:-mt-4 sm:px-4">
        <span>BMERMS</span>
        <span className="opacity-80">Equipment QR</span>
      </div>
      <div className="mb-2">
        <p className={`font-bold leading-tight ${tokens.code}`}>{assetCode}</p>
        <p className={`leading-tight text-neutral-800 ${tokens.name}`}>{assetName}</p>
        {departmentName && (
          <p className="text-xs text-neutral-700">{departmentName}</p>
        )}
        {(categoryName || criticalityLevel) && (
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">
            {[categoryName, criticalityLevel].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      <div className="flex items-center justify-center rounded-sm bg-white p-1">
        <QrCodeImage value={qrUrl} size={tokens.qr} />
      </div>
      <p className="mt-2 text-center text-xs font-semibold text-black">{scanInstruction}</p>
      {showFooterNote && (
        <p className="mt-1 text-center text-[9px] text-neutral-500">
          QR does not grant access. Login required.
        </p>
      )}
    </div>
  );
}
