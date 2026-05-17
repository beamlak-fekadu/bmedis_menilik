'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getEquipmentById } from '@/services/equipment.service';

export type AssetFilterAsset = {
  id: string;
  asset_code: string | null;
  name: string | null;
};

export type AssetFilter = {
  assetId: string | null;
  source: string | null;
  asset: AssetFilterAsset | null;
  clearHref: string;
  loading: boolean;
};

function readParam(params: URLSearchParams, ...names: string[]): string | null {
  for (const name of names) {
    const v = params.get(name);
    if (v) return v;
  }
  return null;
}

function buildClearHref(pathname: string, params: URLSearchParams): string {
  const next = new URLSearchParams(params.toString());
  for (const key of ['asset_id', 'assetId', 'source']) next.delete(key);
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function useAssetFilter(): AssetFilter {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const assetId = readParam(searchParams, 'asset_id', 'assetId');
  const source = searchParams.get('source');
  const clearHref = useMemo(() => buildClearHref(pathname ?? '/', searchParams), [pathname, searchParams]);
  const [asset, setAsset] = useState<AssetFilterAsset | null>(null);
  const [loading, setLoading] = useState<boolean>(!!assetId);

  useEffect(() => {
    let cancelled = false;
    if (!assetId) {
      setAsset((prev) => (prev === null ? prev : null));
      setLoading((prev) => (prev === false ? prev : false));
      return;
    }
    void (async () => {
      try {
        const res = await getEquipmentById(assetId);
        if (cancelled) return;
        const row = (res?.data ?? null) as { id?: string; asset_code?: string | null; name?: string | null } | null;
        if (row?.id) {
          setAsset({ id: row.id, asset_code: row.asset_code ?? null, name: row.name ?? null });
        } else {
          setAsset({ id: assetId, asset_code: null, name: null });
        }
      } catch {
        if (cancelled) return;
        setAsset({ id: assetId, asset_code: null, name: null });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [assetId]);

  return { assetId, source, asset, clearHref, loading };
}
