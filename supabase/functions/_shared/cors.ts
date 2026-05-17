// Shared CORS helpers for BMERMS Supabase Edge Functions.
//
// The dashboard origin is read from ALLOWED_ORIGIN at deploy time (falls
// back to '*' for local development). Browsers calling from the Next.js
// app go through src/app/api/* routes, but direct browser fetches must
// still satisfy CORS preflight.

const FALLBACK_ORIGIN = '*';

export function getAllowedOrigin(): string {
  return Deno.env.get('ALLOWED_ORIGIN')?.trim() || FALLBACK_ORIGIN;
}

export function buildCorsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(),
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

export function handlePreflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: buildCorsHeaders() });
}

export function jsonResponse(
  body: unknown,
  init: { status?: number } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      ...buildCorsHeaders(),
      'content-type': 'application/json; charset=utf-8',
    },
  });
}
