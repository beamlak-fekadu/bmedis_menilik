import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildAssetQrUrl, getQrBaseUrl } from '@/utils/qr/url';

const repoRoot = process.cwd();
const TOKEN = 'qra_95Yn7hxLv1X07YttO807GNqtYnOPyk74';
const ENV_KEYS = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_VERCEL_URL',
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_URL',
  'NODE_ENV',
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

function withEnv(patch: Partial<Record<EnvKey, string>>, run: () => void) {
  const previous = new Map<EnvKey, string | undefined>();
  for (const key of ENV_KEYS) {
    previous.set(key, process.env[key]);
    const next = patch[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }

  try {
    run();
  } finally {
    for (const key of ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function readSource(rel: string): string {
  return readFileSync(path.resolve(repoRoot, rel), 'utf8');
}

test('QR URL uses the configured canonical app URL', () => {
  withEnv({
    NODE_ENV: 'production',
    NEXT_PUBLIC_APP_URL: 'bmedis.example.com/',
    NEXT_PUBLIC_VERCEL_URL: 'bmedis-branch-user-projects.vercel.app',
  }, () => {
    assert.equal(getQrBaseUrl(), 'https://bmedis.example.com');
    assert.equal(buildAssetQrUrl(TOKEN), `https://bmedis.example.com/qr/a/${TOKEN}`);
  });
});

test('QR URL falls back to the stable Menelik Vercel URL, not branch URLs', () => {
  withEnv({
    NODE_ENV: 'production',
    NEXT_PUBLIC_VERCEL_URL: 'bmedis-branch-user-projects.vercel.app',
    VERCEL_URL: 'bmedis-branch-user-projects.vercel.app',
  }, () => {
    assert.equal(getQrBaseUrl(), 'https://bmedis-menilik.vercel.app');
    assert.equal(buildAssetQrUrl(TOKEN), `https://bmedis-menilik.vercel.app/qr/a/${TOKEN}`);
  });
});

test('QR URL uses the stable Menelik Vercel URL in production when no canonical URL is configured', () => {
  withEnv({ NODE_ENV: 'production' }, () => {
    assert.equal(getQrBaseUrl(), 'https://bmedis-menilik.vercel.app');
    assert.equal(buildAssetQrUrl(TOKEN), `https://bmedis-menilik.vercel.app/qr/a/${TOKEN}`);
  });
});

test('QR middleware canonicalizes /qr/a scans while preserving path and search', () => {
  const src = readSource('src/middleware.ts');
  assert.match(src, /function canonicalQrRedirect/);
  assert.match(src, /pathname\.startsWith\('\/qr\/a\/'\)/);
  assert.match(src, /url\.pathname = request\.nextUrl\.pathname/);
  assert.match(src, /url\.search = request\.nextUrl\.search/);
  assert.match(src, /NextResponse\.redirect\(url, \{ status: 308 \}\)/);

  const helperStart = src.indexOf('function getCanonicalQrBaseUrl');
  const helperEnd = src.indexOf('function isLocalRequest');
  const helper = src.slice(helperStart, helperEnd);
  assert.doesNotMatch(helper, /NEXT_PUBLIC_VERCEL_URL/);
  assert.match(helper, /bmedis-menilik\.vercel\.app/);
});
