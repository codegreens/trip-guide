/* Service worker — trip guide.
   Precaches the app shell AND the encrypted payload, so the whole thing works
   in airplane mode after one successful online load.

   CACHE is bumped automatically by Tools/trip-guide-publish.py on every publish.
   Without that bump, phones keep serving the old guide.enc from cache forever. */

const CACHE = 'trip-guide-v1';

/* sw.js is deliberately NOT in this list. The browser manages the worker script
   itself, and precaching it can strand a phone on an old worker. */
const ASSETS = [
  './',
  'index.html',
  'guide.enc',
  'manifest.webmanifest',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
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

/* guide.enc: network first, so a phone that is online picks up a new publish
   immediately instead of waiting for the cache to expire. Falls back to cache
   the moment the network is unavailable, which is the normal case abroad.

   Everything else: cache first. The network is optional by design. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isPayload = url.pathname.endsWith('/guide.enc');

  if (isPayload){
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200){
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then(hit =>
          hit || new Response('', {status:504, statusText:'Offline and not cached'})))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request)
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic'){
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => {
          if (e.request.mode === 'navigate') return caches.match('index.html');
          return new Response('', {status:504, statusText:'Offline'});
        });
    })
  );
});
