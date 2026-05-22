import { enqueueOfflineAction, getOfflineQueue } from './queue';
import { getMostRecentOfflineSessionSnapshot } from './session-snapshot';

export const PENDING_QR_SCANS_KEY = 'bmedis.offline.pending_qr_scans.v1';

export type PendingQrScan = {
  token: string;
  scanned_at: string;
  source_route: string;
  reason: 'unknown_offline' | 'revoked_cached' | 'cached_offline';
  user_agent?: string | null;
};

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getPendingQrScans(): PendingQrScan[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(PENDING_QR_SCANS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.token === 'string') as PendingQrScan[] : [];
  } catch {
    return [];
  }
}

export function savePendingQrScan(scan: PendingQrScan) {
  if (!canUseLocalStorage()) return;
  const existing = getPendingQrScans();
  const duplicate = existing.some((item) => item.token === scan.token && item.scanned_at === scan.scanned_at);
  if (duplicate) return;
  window.localStorage.setItem(PENDING_QR_SCANS_KEY, JSON.stringify([...existing, scan].slice(-100)));
}

function replacePendingQrScans(scans: PendingQrScan[]) {
  if (!canUseLocalStorage()) return;
  if (scans.length === 0) {
    window.localStorage.removeItem(PENDING_QR_SCANS_KEY);
    return;
  }
  window.localStorage.setItem(PENDING_QR_SCANS_KEY, JSON.stringify(scans));
}

export async function flushPendingQrScansToQueue() {
  const snapshot = getMostRecentOfflineSessionSnapshot();
  if (!snapshot) return { enqueued: 0, remaining: getPendingQrScans().length };

  const pending = getPendingQrScans();
  if (pending.length === 0) return { enqueued: 0, remaining: 0 };

  const queue = await getOfflineQueue();
  const queuedTokens = new Set(
    queue
      .filter((item) => item.action_type === 'qr_scan.record')
      .map((item) => `${item.qr_token ?? item.payload.token ?? ''}:${item.payload.scanned_at ?? ''}`),
  );
  const remaining: PendingQrScan[] = [];
  let enqueued = 0;

  for (const scan of pending) {
    const key = `${scan.token}:${scan.scanned_at}`;
    if (queuedTokens.has(key)) continue;
    try {
      await enqueueOfflineAction({
        action_type: 'qr_scan.record',
        entity_type: 'equipment_qr_scans',
        qr_token: scan.token,
        payload: {
          token: scan.token,
          qr_token: scan.token,
          scanned_at: scan.scanned_at,
          source_route: scan.source_route,
          reason: scan.reason,
          user_agent: scan.user_agent ?? null,
        },
        created_by_profile_id: snapshot.profileId,
        role_name: snapshot.primaryRole,
        source_route: scan.source_route,
        metadata: {
          pending_qr_scan: true,
          queued_from: 'offline_unknown_qr',
          retryable: true,
        },
      });
      enqueued += 1;
    } catch {
      remaining.push(scan);
    }
  }

  replacePendingQrScans(remaining);
  return { enqueued, remaining: remaining.length };
}
