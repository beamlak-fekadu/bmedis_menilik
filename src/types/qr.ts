// App-level types for the QR identity foundation (Phase 1).
//
// Kept outside src/types/database.ts so that regenerating Supabase types does
// not overwrite them. The DB columns themselves live in migration 00045.

export const QR_LABEL_STATUSES = [
  'not_generated',
  'generated',
  'printed',
  'attached',
  'needs_replacement',
  'revoked',
] as const;

export type QrLabelStatus = (typeof QR_LABEL_STATUSES)[number];

export const QR_SCAN_SOURCES = ['web', 'mobile', 'pwa', 'unknown'] as const;
export type QrScanSource = (typeof QR_SCAN_SOURCES)[number];

export const QR_ONLINE_STATUSES = ['online', 'offline_queued', 'synced_later', 'unknown'] as const;
export type QrOnlineStatus = (typeof QR_ONLINE_STATUSES)[number];

export const QR_TOKEN_PREFIX = 'qra_';

export const QR_SCAN_DEDUP_WINDOW_MINUTES = 5;

export type EquipmentQrIdentity = {
  qr_token: string | null;
  qr_generated_at: string | null;
  qr_label_status: QrLabelStatus;
  qr_label_printed_at: string | null;
  qr_label_attached_at: string | null;
  qr_label_replaced_at: string | null;
  qr_token_regenerated_at: string | null;
};

export type QrCoverageStats = {
  totalActiveAssets: number;
  withoutToken: number;
  generated: number;
  printed: number;
  attached: number;
  needsReplacement: number;
  revoked: number;
  recentScanCount: number;
};

export const QR_READINESS_STATES = [
  'ready_to_scan',
  'needs_label_generation',
  'needs_printing',
  'needs_attachment',
  'needs_replacement',
  'invalid_revoked',
] as const;

export type QrReadinessState = (typeof QR_READINESS_STATES)[number];

export type QrReadinessInput = {
  qr_token: string | null;
  qr_label_status: QrLabelStatus | string | null | undefined;
};

export function getQrReadinessState(input: QrReadinessInput): QrReadinessState {
  if (input.qr_label_status === 'revoked') return 'invalid_revoked';
  if (!input.qr_token || input.qr_label_status === 'not_generated') return 'needs_label_generation';
  if (input.qr_label_status === 'attached') return 'ready_to_scan';
  if (input.qr_label_status === 'printed') return 'needs_attachment';
  if (input.qr_label_status === 'needs_replacement') return 'needs_replacement';
  return 'needs_printing';
}

export function formatQrReadinessState(state: QrReadinessState): string {
  switch (state) {
    case 'ready_to_scan':
      return 'Ready to Scan';
    case 'needs_label_generation':
      return 'Needs Label Generation';
    case 'needs_printing':
      return 'Needs Printing';
    case 'needs_attachment':
      return 'Needs Attachment';
    case 'needs_replacement':
      return 'Needs Replacement';
    case 'invalid_revoked':
      return 'Invalid / Revoked';
  }
}

const STATUS_LABELS: Record<QrLabelStatus, string> = {
  not_generated: 'Not Generated',
  generated: 'Generated',
  printed: 'Printed',
  attached: 'Attached',
  needs_replacement: 'Needs Replacement',
  revoked: 'Revoked',
};

export function formatQrLabelStatus(status: QrLabelStatus | string | null | undefined): string {
  if (!status) return STATUS_LABELS.not_generated;
  return STATUS_LABELS[status as QrLabelStatus] ?? String(status);
}

// Maps to the Badge variant union used across the dashboard UI.
export type QrLabelBadgeVariant = 'success' | 'info' | 'warning' | 'error' | 'default';

export function getQrLabelStatusBadgeVariant(
  status: QrLabelStatus | string | null | undefined,
): QrLabelBadgeVariant {
  switch (status) {
    case 'attached':
      return 'success';
    case 'printed':
      return 'info';
    case 'generated':
      return 'info';
    case 'needs_replacement':
      return 'warning';
    case 'revoked':
      return 'error';
    case 'not_generated':
    default:
      return 'default';
  }
}

export function isQrLabelStatus(value: unknown): value is QrLabelStatus {
  return typeof value === 'string' && (QR_LABEL_STATUSES as readonly string[]).includes(value);
}

// ─── Phase 2 — label asset shapes ──────────────────────────────────────────
// Used by Equipment Detail QR panel, QR Label Sheet (/equipment/qr-labels),
// and Developer Lab Phase 2 entry points.

export type QrLabelAsset = {
  id: string;
  asset_code: string;
  name: string;
  department_name: string | null;
  category_name: string | null;
  criticality_level: string | null;
  qr_token: string | null;
  qr_label_status: QrLabelStatus;
  qr_generated_at: string | null;
  qr_label_printed_at: string | null;
  qr_label_attached_at: string | null;
  qr_label_replaced_at: string | null;
  qr_token_regenerated_at: string | null;
};

export type QrLabelSize = 'sm' | 'md' | 'lg';

export type QrLabelRenderOptions = {
  size?: QrLabelSize;
  /** Suppresses the small "Login required" footer note when set to false. */
  showFooterNote?: boolean;
};

export const QR_LABEL_FILTER_VALUES = [
  'all',
  'generated',
  'printed',
  'attached',
  'needs_replacement',
  'revoked',
  'missing_token',
] as const;

export type QrLabelFilter = (typeof QR_LABEL_FILTER_VALUES)[number];

export function isQrLabelFilter(value: unknown): value is QrLabelFilter {
  return typeof value === 'string' && (QR_LABEL_FILTER_VALUES as readonly string[]).includes(value);
}

// ─── Phase 6 — scan evidence shapes ────────────────────────────────────────

export type QrScanHistoryFilters = {
  dateFrom?: string;
  dateTo?: string;
  role?: string;
  departmentId?: string;
  assetId?: string;
  onlineStatus?: QrOnlineStatus | string;
  scanSource?: QrScanSource | string;
  actionTaken?: string;
  limit?: number;
};

export type QrScanHistoryRow = {
  id: string;
  asset_id: string;
  asset_code: string | null;
  asset_name: string | null;
  department_id: string | null;
  department_name: string | null;
  scanned_by: string | null;
  scanned_by_name: string;
  scanned_by_email: string | null;
  role_name: string | null;
  scanned_at: string;
  scan_source: QrScanSource | string | null;
  online_status: QrOnlineStatus | string | null;
  action_taken: string | null;
  metadata_route: string | null;
  created_at: string | null;
};

export type AssetQrScanSummary = {
  totalScans: number;
  lastScannedAt: string | null;
  lastScannedBy: string | null;
  roles: string[];
  recentScans: QrScanHistoryRow[];
};

export type QrScanCoverageStats = {
  totalScans: number;
  scansLast7Days: number;
  attachedAssetsNeverScanned: number;
  mostScannedAsset: {
    assetId: string;
    assetCode: string | null;
    assetName: string | null;
    count: number;
  } | null;
  scansByRole: Array<{ label: string; count: number }>;
  scansByDepartment: Array<{ label: string; count: number }>;
  recentScans: QrScanHistoryRow[];
  attachedNeverScannedAssets: QrLabelAsset[];
  revokedOrNeedsReplacementRecentScans: QrScanHistoryRow[];
};

export type QrAssetScanMetric = {
  assetId: string;
  totalScans: number;
  lastScannedAt: string | null;
  lastScannedByRole: string | null;
  scansLast30Days: number;
};
