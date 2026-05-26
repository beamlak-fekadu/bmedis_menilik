import { requireRole } from '@/lib/auth/helpers';
import { getQrLabelAssets, getQrCoverageStats } from '@/services/qr.service';
import { isQrLabelFilter, type QrLabelFilter } from '@/types/qr';
import { getQrBaseUrl } from '@/utils/qr/url';
import QrLabelSheetClient from './QrLabelSheetClient';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readFilter(value: string | string[] | undefined): QrLabelFilter {
  if (Array.isArray(value)) value = value[0];
  return isQrLabelFilter(value) ? value : 'all';
}

function readAssetIds(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join(',') : value;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default async function QrLabelsPage({ searchParams }: { searchParams: SearchParams }) {
  // Server-side role gate matches the equipment.edit capability surface.
  await requireRole(['admin', 'bme_head']);
  const params = await searchParams;

  const initialFilter = readFilter(params.status);
  const preselected = readAssetIds(params.assets);
  const autoPrint = params.print === '1';

  const [assets, coverage] = await Promise.all([
    getQrLabelAssets(),
    getQrCoverageStats(),
  ]);
  const qrBaseUrl = getQrBaseUrl();

  return (
    <QrLabelSheetClient
      assets={assets}
      coverage={coverage}
      initialFilter={initialFilter}
      preselectedIds={preselected}
      autoPrint={autoPrint}
      qrBaseUrl={qrBaseUrl}
    />
  );
}
