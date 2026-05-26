// Canonical QR URL builder (Phase 2).
//
// The QR image encodes the future Phase 3 landing path: /qr/a/<qr_token>.
// Phase 2 generates this URL purely as a payload for the image — the
// landing route itself is not yet implemented.

import { isValidQrTokenFormat } from './token';

const DEFAULT_LOCAL_BASE = 'http://localhost:3000';
const CANONICAL_QR_URL_ENV_KEYS = ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SITE_URL'] as const;

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function withProtocol(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

/**
 * Resolves the public base URL used to encode QR codes. Order of preference:
 *   1. NEXT_PUBLIC_APP_URL
 *   2. NEXT_PUBLIC_SITE_URL
 *   3. http://localhost:3000 fallback for local development only
 *
 * Vercel deployment/branch URLs are intentionally not fallback candidates.
 * Printed QR labels must point at a stable canonical host, not the deployment
 * that happened to render the print sheet.
 */
export function getQrBaseUrl(): string | null {
  const candidates = CANONICAL_QR_URL_ENV_KEYS.map((key) => process.env[key]);
  for (const candidate of candidates) {
    if (candidate && candidate.trim().length > 0) {
      return trimTrailingSlash(withProtocol(candidate.trim()));
    }
  }
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL
  ) {
    return null;
  }
  return DEFAULT_LOCAL_BASE;
}

/**
 * Path-only QR target. Use when you only need the relative path
 * (e.g. when also rendering it as a "QR URL will activate in Phase 3" hint).
 */
export function buildAssetQrPath(qrToken: string | null | undefined): string | null {
  if (!isValidQrTokenFormat(qrToken)) return null;
  return `/qr/a/${qrToken}`;
}

/**
 * Fully-qualified QR target that is encoded into the QR image.
 * Returns null when the token is missing or malformed so callers
 * never accidentally print a "qra_invalid" QR.
 */
export function buildAssetQrUrl(qrToken: string | null | undefined): string | null {
  const path = buildAssetQrPath(qrToken);
  if (!path) return null;
  const baseUrl = getQrBaseUrl();
  if (!baseUrl) return null;
  return `${baseUrl}${path}`;
}
