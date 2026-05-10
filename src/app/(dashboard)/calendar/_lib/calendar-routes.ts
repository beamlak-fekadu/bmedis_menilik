import { procurementDetail, replacementEvidence } from '../../command/_lib/command-center-routes';

function withParams(path: string, params: Record<string, string | null | undefined>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}

export function pmCalendarHref(id: string) {
  return `/pm/schedules/${id}`;
}

export function workOrderCalendarHref(id: string) {
  return `/maintenance/work-orders/${id}`;
}

export function maintenanceRequestCalendarHref(id: string) {
  return `/maintenance/requests/${id}`;
}

export function calibrationCalendarHref(params: { recordId?: string | null; requestId?: string | null; assetId?: string | null }) {
  return withParams('/calibration', {
    calibrationId: params.recordId ?? params.requestId ?? null,
    requestId: params.requestId ?? null,
    assetId: params.assetId ?? null,
    source: 'calendar',
  });
}

export function trainingCalendarHref(params: { sessionId?: string | null; requestId?: string | null; assetId?: string | null }) {
  return withParams('/training', {
    sessionId: params.sessionId ?? null,
    requestId: params.requestId ?? null,
    assetId: params.assetId ?? null,
    source: 'calendar',
  });
}

export function installationRequestCalendarHref(id: string) {
  return `/installation/requests/${id}`;
}

export function installationRecordCalendarHref(id: string, assetId?: string | null) {
  return withParams('/installation', {
    installationId: id,
    assetId: assetId ?? null,
    tab: 'records',
    source: 'calendar',
  });
}

export function procurementCalendarHref(id: string) {
  return procurementDetail(id);
}

export function disposalCalendarHref(id: string) {
  return withParams('/disposal', {
    requestId: id,
    source: 'calendar',
  });
}

export function disposedAssetCalendarHref(id: string, requestId?: string | null) {
  return withParams('/disposal', {
    disposedAssetId: id,
    requestId: requestId ?? null,
    source: 'calendar',
  });
}

export function replacementCalendarHref(assetId: string) {
  return replacementEvidence(assetId);
}

export function documentCalendarHref(params: { requestId?: string | null; documentId?: string | null; assetId?: string | null }) {
  if (params.requestId) return `/documents/specification-requests/${params.requestId}`;
  return withParams('/documents', {
    documentId: params.documentId ?? null,
    assetId: params.assetId ?? null,
    source: 'calendar',
  });
}
