/* Service worker — smoke test.
   Precaches the whole site on install so airplane mode works.
   Bump CACHE when files change, or phones keep serving the old copy. */

const CACHE = 'trip-guide-smoke-v1';

/* sw.js is deliberately NOT in this list. The browser manages the worker script
   itself, and precaching it can strand a phone on an old worker forever. */
const ASSETS = [
  './',
  'index.html',
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

/* Cache first. The whole point is that the network is optional.
   Falls back to index.html for navigations so a deep link still opens offline. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
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
          return new Response('', {status: 504, statusText: 'Offline'});
        });
    })
  );
});
