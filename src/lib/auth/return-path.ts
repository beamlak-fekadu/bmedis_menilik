export const DEFAULT_AUTH_RETURN_PATH = '/command';
export const AUTH_RETURN_PARAM = 'returnTo';
export const AUTH_NEXT_PARAM = 'next';

function hasUnsafePrefix(value: string): boolean {
  return (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/\\') ||
    value.includes('\\')
  );
}

export function safeReturnPath(
  value: string | null | undefined,
  fallback: string | null = null,
): string | null {
  if (!value || typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (trimmed !== value || trimmed.length === 0) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return fallback;
  if (hasUnsafePrefix(trimmed)) return fallback;
  return trimmed;
}

export function getSafeReturnPathFromSearchParams(
  searchParams: Pick<URLSearchParams, 'get'>,
  fallback: string | null = null,
): string | null {
  return (
    safeReturnPath(searchParams.get(AUTH_RETURN_PARAM), null) ??
    safeReturnPath(searchParams.get(AUTH_NEXT_PARAM), fallback)
  );
}

export function currentPathWithSearch(pathname: string, search?: string | null): string {
  const suffix = search && search !== '?' ? search : '';
  return `${pathname}${suffix}`;
}

export function loginPathForReturnTo(returnTo: string): string {
  const safe = safeReturnPath(returnTo, DEFAULT_AUTH_RETURN_PATH) ?? DEFAULT_AUTH_RETURN_PATH;
  return `/login?${AUTH_RETURN_PARAM}=${encodeURIComponent(safe)}`;
}
