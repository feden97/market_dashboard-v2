// Keep caches private to this app, including in a GitHub Pages subdirectory.
const APP_CACHE_PREFIX = 'dashboard-financiero-';
const scope = new URL(self.registration.scope);
const cachePrefix = `${APP_CACHE_PREFIX}${encodeURIComponent(scope.pathname)}-`;
const BUILD_REVISION = '__BUILD_REVISION__';
const CACHE_NAME = `${cachePrefix}v5-${BUILD_REVISION}`;
const appUrl = (path) => new URL(path, scope).href;
const INDEX_URL = appUrl('index.html');
const STATIC_ASSETS = [
  'manifest.json',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/apple-touch-icon.png',
  'data/snapshot.json',
];

async function remember(cache, request, response) {
  if (response.ok && response.type !== 'opaque') {
    // A full browser cache must never turn a successful request into a failure.
    await cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch(INDEX_URL, { cache: 'reload' });
    if (!response.ok) throw new Error('App shell unavailable');
    await remember(cache, INDEX_URL, response);

    // Vite emits the entire chunk graph, including lazy tabs and their CSS.
    const manifestResponse = await fetch(appUrl('precache-manifest.json'), { cache: 'reload' });
    if (!manifestResponse.ok) throw new Error('Precache manifest unavailable');
    const manifest = await manifestResponse.json();
    if (!Array.isArray(manifest.assets) || !manifest.assets.length) throw new Error('Invalid precache manifest');
    const bundles = manifest.assets.map((asset) => {
      if (typeof asset !== 'string' || !/\.(?:js|css)$/.test(asset)) throw new Error('Invalid precache asset');
      const url = new URL(asset, scope);
      if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) throw new Error('Precache asset outside app scope');
      return url;
    });
    const html = await response.text();
    const entryBundles = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)]
      .map((match) => new URL(match[1], INDEX_URL))
      .filter((url) => url.origin === scope.origin && url.pathname.startsWith(scope.pathname));
    if (entryBundles.some((entry) => !bundles.some((bundle) => bundle.href === entry.href))) {
      throw new Error('App shell and precache manifest do not match');
    }
    await Promise.all([
      ...bundles.map((url) => cache.add(url.href)),
      ...STATIC_ASSETS.map((path) => cache.add(appUrl(path)).catch(() => {})),
    ]);
    // Existing tabs finish on their current worker/bundles before activation.
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name !== CACHE_NAME && (
        name.startsWith(cachePrefix) || /^dashboard-financiero-v2-cache-v\d+$/.test(name)
      ))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await remember(cache, fallbackUrl || request, response);
      return response;
    }
    const cached = await cache.match(fallbackUrl || request);
    return cached || response;
  } catch (error) {
    const cached = await cache.match(fallbackUrl || request);
    if (cached) return cached;
    throw error;
  }
}

async function assetResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  return remember(cache, request, await fetch(request));
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Live API data belongs to the hooks. Never substitute an unrelated snapshot,
  // or label an old cached quote as a successful live response.
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, INDEX_URL));
  } else if (url.pathname.startsWith(new URL('data/', scope).pathname)) {
    event.respondWith(networkFirst(event.request));
  } else if (url.pathname.startsWith(new URL('assets/', scope).pathname)) {
    event.respondWith(assetResponse(event.request));
  } else if (url.href === appUrl('manifest.json')) {
    event.respondWith(networkFirst(event.request));
  }
});
