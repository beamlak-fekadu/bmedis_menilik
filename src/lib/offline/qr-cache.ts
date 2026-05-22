import type { QrLandingAsset } from '@/services/qr.service';
import type {
  QrProfileContext,
  QrRoleCategory,
  QrRoleContext,
} from '@/services/qr-context.service';
import {
  getOfflineReadCache,
  saveOfflineReadCache,
  type CachedReadView,
  type OfflineCacheScope,
} from './cache';

export const QR_ASSET_CACHE_PREFIX = 'qr.asset.';

export type CachedQrAction = {
  id: string;
  label: string;
  description?: string;
  href?: string;
  copyText?: string | null;
  icon?: string;
  variant?: string;
};

export type CachedQrAssetContext = {
  kind: 'qr_asset_context';
  token: string;
  asset: QrLandingAsset;
  profile: QrProfileContext;
  context: QrRoleContext;
  actions: CachedQrAction[];
  captured_at: string;
  source_route: string;
};

export function buildQrAssetCacheKey(token: string) {
  return `${QR_ASSET_CACHE_PREFIX}${token}`;
}

export function buildQrAssetCacheScope(
  profile: Pick<QrProfileContext, 'id' | 'department_id'>,
  roleCategory: QrRoleCategory,
): OfflineCacheScope {
  return {
    profileId: profile.id,
    roleName: roleCategory,
    departmentId: profile.department_id ?? null,
  };
}

export async function saveQrAssetOfflineCache(params: {
  token: string;
  asset: QrLandingAsset;
  profile: QrProfileContext;
  context: QrRoleContext;
  actions: CachedQrAction[];
  sourceRoute?: string | null;
}): Promise<CachedReadView<CachedQrAssetContext> | null> {
  const snapshot: CachedQrAssetContext = {
    kind: 'qr_asset_context',
    token: params.token,
    asset: params.asset,
    profile: params.profile,
    context: params.context,
    actions: params.actions,
    captured_at: new Date().toISOString(),
    source_route: params.sourceRoute ?? `/qr/a/${params.token}`,
  };

  return saveOfflineReadCache(
    buildQrAssetCacheKey(params.token),
    snapshot,
    buildQrAssetCacheScope(params.profile, params.context.roleCategory),
    { sourceRoute: snapshot.source_route },
  );
}

export function getQrAssetOfflineCache(
  token: string,
  scope: OfflineCacheScope,
): Promise<CachedReadView<CachedQrAssetContext> | null> {
  return getOfflineReadCache<CachedQrAssetContext>(buildQrAssetCacheKey(token), scope);
}
