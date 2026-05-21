/**
 * BMEDIS Service Worker
 *
 * Phase 1 fix (OFF-01):
 *   - Successful GET navigations are now cached so the same route can load
 *     while offline.
 *   - Network-first for navigations with stale-cache fallback, then
 *     last-resort `/offline` shell.
 *   - Auth/Supabase/API responses are explicitly not cached.
 *   - Bumped cache version to invalidate old (broken) caches.
 *   - Skips opaque/redirected responses.
 */

const CACHE_VERSION = 'v2';
const APP_SHELL_CACHE = `bmedis-app-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `bmedis-static-${CACHE_VERSION}`;
const PAGES_CACHE = `bmedis-pages-${CACHE_VERSION}`;
const CURRENT_CACHES = [APP_SHELL_CACHE, STATIC_CACHE, PAGES_CACHE];

const APP_SHELL_URLS = [
  '/offline',
  '/manifest.webmanifest',
  '/icons/bmedis-icon.svg',
  '/offline-health.txt',
];

// Routes that must never be cached even if their navigation succeeds.
// Auth pages return user-specific tokens/cookies — caching them across
// users is a security risk.
const NEVER_CACHE_NAV_PATHS = [
  '/login',
  '/auth',
  '/api',
];

function offlineHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BMEDIS is offline</title>
    <style>
      body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #eef2f8; color: #0b1220; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; text-align: center; }
      section { max-width: 520px; }
      h1 { margin: 0 0 12px; font-size: 30px; }
      p { margin: 0 0 10px; color: #475569; line-height: 1.6; }
      a, button { display: inline-flex; margin-top: 14px; border: 1px solid rgba(15,23,42,.18); border-radius: 8px; padding: 10px 14px; background: white; color: #0b1220; text-decoration: none; font-weight: 600; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>BMEDIS is offline</h1>
        <p>Cached pages and queued actions may still be available.</p>
        <p>Reconnect to sync changes.</p>
        <a href="/offline">Open offline shell</a>
      </section>
    </main>
  </body>
</html>`;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !CURRENT_CACHES.includes(key)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function shouldCacheNavigation(url) {
  if (!isSameOrigin(url)) return false;
  for (const prefix of NEVER_CACHE_NAV_PATHS) {
    if (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) {
      return false;
    }
  }
  return true;
}

function shouldCacheStatic(request, url) {
  if (!isSameOrigin(url)) return false;
  if (url.pathname.startsWith('/_next/static/')) return true;
  if (url.pathname.startsWith('/_next/data/')) return false; // user-specific
  if (url.pathname.startsWith('/icons/')) return true;
  if (url.pathname === '/manifest.webmanifest') return true;
  if (url.pathname.startsWith('/lottie/')) return true;
  return ['style', 'script', 'font', 'image'].includes(request.destination);
}

function isCacheableResponse(response) {
  // Skip opaque (CORS), redirected, error responses, partial responses.
  if (!response) return false;
  if (!response.ok) return false;
  if (response.status !== 200) return false;
  if (response.type !== 'basic' && response.type !== 'default') return false;
  if (response.redirected) return false;
  return true;
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch (error) {
    // Static asset offline — propagate failure (browser shows broken asset).
    throw error;
  }
}

async function networkFirstNavigation(request) {
  const url = new URL(request.url);

  try {
    const response = await fetch(request);

    if (isCacheableResponse(response) && shouldCacheNavigation(url)) {
      const cache = await caches.open(PAGES_CACHE);
      // Clone before consuming — the response stream can only be read once.
      cache.put(request, response.clone()).catch(() => undefined);
    }

    return response;
  } catch {
    // Network failed; serve from cache if we have it.
    const cachedExact = await caches.match(request);
    if (cachedExact) return cachedExact;

    // Try ignoring search (different query params for same route still serve).
    const cachedIgnoreSearch = await caches.match(request, { ignoreSearch: true });
    if (cachedIgnoreSearch) return cachedIgnoreSearch;

    // Final fallback — cached /offline shell.
    const cachedOffline = await caches.match('/offline');
    if (cachedOffline) return cachedOffline;

    return new Response(offlineHtml(), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
      status: 200,
    });
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip cross-origin (Supabase, Sentry, etc.) — let the network handle it.
  if (!isSameOrigin(url)) return;

  // Health probe — always hit network.
  if (url.pathname === '/offline-health.txt') {
    event.respondWith(fetch(request));
    return;
  }

  // Never intercept API routes — they need authoritative data.
  if (url.pathname.startsWith('/api/')) return;
  // Never intercept Server Actions / RSC payloads either.
  if (url.searchParams.has('_rsc')) return;

  // Navigation requests (HTML documents).
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Static assets — cache-first.
  if (shouldCacheStatic(request, url)) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'CLEAR_PAGE_CACHE') {
    caches.delete(PAGES_CACHE).catch(() => undefined);
  }
});
