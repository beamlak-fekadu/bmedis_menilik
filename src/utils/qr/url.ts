// Canonical QR URL builder (Phase 2).
//
// The QR image encodes the future Phase 3 landing path: /qr/a/<qr_token>.
// Phase 2 generates this URL purely as a payload for the image — the
// landing route itself is not yet implemented.

import { isValidQrTokenFormat } from './token';

const DEFAULT_LOCAL_BASE = 'http://localhost:3000';

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
 *   3. NEXT_PUBLIC_VERCEL_URL (prefixed with https://)
 *   4. http://localhost:3000 fallback for local development
 * Never hardcodes a production domain.
 */
export function getQrBaseUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_VERCEL_URL,
  ];
  for (const candidate of candidates) {
    if (candidate && candidate.trim().length > 0) {
      return trimTrailingSlash(withProtocol(candidate.trim()));
    }
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
  return `${getQrBaseUrl()}${path}`;
}
