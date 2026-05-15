'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui';
import type { QrScanHistoryRow } from '@/types/qr';

type Props = {
  scans: QrScanHistoryRow[];
  compact?: boolean;
  showAsset?: boolean;
  emptyMessage?: string;
};

function fmt(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function label(value: string | null | undefined): string {
  return value ? value.replace(/_/g, ' ') : '-';
}

function sourceVariant(value: string | null | undefined) {
  if (value === 'online') return 'success' as const;
  if (value === 'offline_queued' || value === 'synced_later') return 'warning' as const;
  return 'default' as const;
}

export default function QrScanHistoryTable({
  scans,
  compact = false,
  showAsset = true,
  emptyMessage = 'No QR scans recorded.',
}: Props) {
  const minWidth = compact ? 'min-w-[760px]' : 'min-w-[1100px]';

  return (
    <div className="overflow-x-auto rounded-md border border-[var(--border-subtle)]">
      <table className={`w-full ${minWidth} text-left text-sm`}>
        <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-1)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
          <tr>
            <th className="px-3 py-2">Scanned At</th>
            {showAsset && <th className="px-3 py-2">Asset</th>}
            {showAsset && <th className="px-3 py-2">Asset Code</th>}
            {!compact && <th className="px-3 py-2">Department</th>}
            <th className="px-3 py-2">Scanned By</th>
            <th className="px-3 py-2">Role</th>
            {!compact && <th className="px-3 py-2">Source</th>}
            <th className="px-3 py-2">Online Status</th>
            {!compact && <th className="px-3 py-2">Action</th>}
            {!compact && <th className="px-3 py-2">Evidence</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]/60">
          {scans.length === 0 ? (
            <tr>
              <td colSpan={compact ? (showAsset ? 6 : 4) : (showAsset ? 10 : 8)} className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            scans.map((scan) => (
              <tr key={scan.id}>
                <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{fmt(scan.scanned_at)}</td>
                {showAsset && (
                  <td className="px-3 py-2">
                    <Link href={`/equipment/${scan.asset_id}#qr-identity`} className="font-medium text-[var(--brand)] hover:underline">
                      {scan.asset_name ?? 'Unknown asset'}
                    </Link>
                  </td>
                )}
                {showAsset && <td className="px-3 py-2 font-mono text-xs">{scan.asset_code ?? '-'}</td>}
                {!compact && <td className="px-3 py-2 text-[var(--text-muted)]">{scan.department_name ?? '-'}</td>}
                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    <span>{scan.scanned_by_name}</span>
                    {scan.scanned_by_email && <span className="text-xs text-[var(--text-muted)]">{scan.scanned_by_email}</span>}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Badge variant="info">{label(scan.role_name)}</Badge>
                </td>
                {!compact && <td className="px-3 py-2">{label(scan.scan_source)}</td>}
                <td className="px-3 py-2">
                  <Badge variant={sourceVariant(scan.online_status)}>{label(scan.online_status)}</Badge>
                </td>
                {!compact && <td className="px-3 py-2">{label(scan.action_taken)}</td>}
                {!compact && <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{scan.metadata_route ?? '-'}</td>}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
