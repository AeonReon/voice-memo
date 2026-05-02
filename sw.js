// Voice Memo — Service Worker
// All audio is stored in IndexedDB on the device — nothing is fetched.
// SW only caches the static shell so the app opens offline.
//
// Cache name is rewritten by server.js on each /sw.js request — see the
// /sw.js handler. The literal __CACHE_VERSION__ token is replaced with the
// current build-stamp, so every deploy invalidates the prior cache cleanly.
// (When this file is loaded directly from disk in dev, the literal stays
//  in place and the cache simply doesn't roll over — fine for dev.)

const CACHE = 'voice-memo-__CACHE_VERSION__';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/images/apple-touch-icon.png',
  '/images/favicon.png',
];

// Treat HTML / JS / SW-update endpoints as network-first so reloads always
// deliver fresh code. Static assets (images, manifest) stay cache-first.
const NETWORK_FIRST = new Set(['/', '/index.html', '/build-stamp']);

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  if (NETWORK_FIRST.has(url.pathname)) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for static assets — fall back to network, then update cache.
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networked = fetch(e.request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || networked;
    })
  );
});

// Page can ask SW to take over immediately (used after a code update lands).
self.addEventListener('message', event => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
