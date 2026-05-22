/**
 * PSOTS Service Worker
 * Sprint 1.5 — PWA Layer 2 (offline support)
 */

const CACHE_VERSION = 'psots-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const NEVER_CACHE_PATHS = [
  '/society/login.html',
  '/society/register.html',
  '/society/admin.html',
  '/society/join.html',
  '/auth/',
  '/admin/',
  '/resident/',
  '/device/',
  '/invite/',
  '/user/',
  '/tenant/',
];

const PRECACHE_ASSETS = [
  '/society/',
  '/society/index.html',
  '/society/about.html',
  '/society/faq.html',
  '/society/privacy.html',
  '/society/terms.html',
  '/assets/psots-icon-192.png',
  '/assets/psots-icon-512.png',
  '/society/manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url => cache.add(url).catch(err => {
          console.warn('[SW] Failed to precache:', url, err);
        }))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => !key.startsWith(CACHE_VERSION))
            .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (!isSameOrigin && !isGoogleFonts) return;
  if (request.method !== 'GET') return;

  const shouldNeverCache = NEVER_CACHE_PATHS.some(path => url.pathname.includes(path));
  if (shouldNeverCache) {
    event.respondWith(fetch(request));
    return;
  }

  if (isGoogleFonts) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  const isStatic = /\.(css|js|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|ico)$/.test(url.pathname);
  if (isStatic) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (url.pathname.startsWith('/society/') || url.pathname === '/society') {
    event.respondWith(staleWhileRevalidate(request, PAGES_CACHE));
    return;
  }

  event.respondWith(networkFirst(request, RUNTIME_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] cacheFirst failed:', request.url, err);
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  const networkPromise = fetch(request).then(response => {
    if (response.ok) {
      const responseToCache = response.clone();
      caches.open(cacheName).then(cache => cache.put(request, responseToCache));
    }
    return response;
  }).catch(err => {
    console.warn('[SW] SWR fetch failed:', request.url, err);
    return cached;
  });

  return cached || networkPromise;
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
