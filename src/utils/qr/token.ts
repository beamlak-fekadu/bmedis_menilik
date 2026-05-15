// QR token utilities (Phase 1).
//
// Tokens are random URL-safe lookup identifiers prefixed with "qra_". They
// identify an asset, not a session — they do NOT authorize anything.
// Token generation is server-only; never invoke from client components.

import { randomBytes } from 'crypto';
import { QR_TOKEN_PREFIX } from '@/types/qr';

// 24 bytes of randomness → 32 base64url characters (~144 bits of entropy).
// This is more than enough to make QR tokens unguessable while keeping the
// printed label short.
const DEFAULT_TOKEN_BYTES = 24;

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Generate a fresh random QR token. Uses Node crypto (CSPRNG); never Math.random.
 * Format: qra_<base64url>.
 */
export function generateQrToken(byteLength: number = DEFAULT_TOKEN_BYTES): string {
  const bytes = randomBytes(byteLength);
  return `${QR_TOKEN_PREFIX}${base64UrlEncode(bytes)}`;
}

const TOKEN_PATTERN = new RegExp(`^${QR_TOKEN_PREFIX}[A-Za-z0-9_-]{16,}$`);

/**
 * Returns true if the given string looks like a well-formed QR token.
 * This is a structural check, not an authorization check.
 */
export function isValidQrTokenFormat(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

/**
 * Trim and normalize a possibly user-supplied token. Returns null when the
 * input cannot be coerced into a valid token shape.
 */
export function normalizeQrToken(token: unknown): string | null {
  if (typeof token !== 'string') return null;
  const trimmed = token.trim();
  return isValidQrTokenFormat(trimmed) ? trimmed : null;
}

/**
 * Display helper for admin UIs: shows the prefix and last 4 characters so the
 * full token never ends up in logs/screenshots verbatim.
 */
export function maskQrToken(token: string | null | undefined): string {
  if (!token) return '—';
  if (token.length <= QR_TOKEN_PREFIX.length + 4) return token;
  return `${token.slice(0, QR_TOKEN_PREFIX.length + 2)}…${token.slice(-4)}`;
}
