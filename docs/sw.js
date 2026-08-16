/* Service worker — trip guide.
   Precaches the app shell, the encrypted payload AND the encrypted booking
   documents, so the whole thing works in airplane mode after one successful
   online load.

   Two caches on purpose.

   CACHE holds the shell and guide.enc. Tools/trip-guide-publish.py bumps it on
   every publish, because that is what forces a phone to pick up new guide data
   instead of serving the old blob forever.

   DOCS_CACHE holds d/*.enc, roughly 1.5 MB of booking page images. It is bumped
   ONLY when a document actually changes. If documents shared the shell cache,
   editing one day summary would make both phones re-download every ticket,
   which is the exact cost that made per-document blobs worth building. */

const CACHE = 'trip-guide-v3';
const DOCS_CACHE = 'trip-docs-v2';

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

/* Document page blobs. Everything between the two markers is rewritten by the
   publish script from the DOCS manifest, so adding a booking never means
   hand-editing this file. Do not edit by hand. */
/* DOC_ASSETS:BEGIN */
const DOC_ASSETS = [
  'd/fl01jw-1.enc',
  'd/fl01ma-1.enc',
  'd/fl02jw-1.enc',
  'd/fl02ma-1.enc',
  'd/fl03-1.enc',
  'd/ht01-1.enc',
  'd/ht01-2.enc',
  'd/ht02-1.enc',
  'd/ht02-2.enc',
  'd/ht03-1.enc',
  'd/ht03-2.enc',
  'd/ex01-1.enc',
  'd/ex01-2.enc',
  'd/ex02-1.enc',
  'd/ex02-2.enc'
];
/* DOC_ASSETS:END */

const isDoc = pathname => /\/d\/[^/]+\.enc$/.test(pathname);

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    // The shell must succeed. If it cannot there is no app, and failing loudly
    // is the right outcome.
    const shell = await caches.open(CACHE);
    await shell.addAll(ASSETS);

    // Documents are best effort, one at a time. addAll() rejects the whole
    // batch if any single entry 404s, which would take the entire install down
    // and break offline for everything just because one blob was not published
    // yet. A missing document should cost that document and nothing else.
    const docs = await caches.open(DOCS_CACHE);
    await Promise.allSettled(DOC_ASSETS.map(async path => {
      if (await docs.match(path)) return;      // already held, do not refetch
      const res = await fetch(path, {cache:'reload'});
      if (res && res.status === 200) await docs.put(path, res);
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== DOCS_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* guide.enc: network first, so a phone that is online picks up a new publish
   immediately instead of waiting for the cache to expire. Falls back to cache
   the moment the network is unavailable, which is the normal case abroad.

   d/*.enc: cache first from the documents cache. These change only when the
   publish script says so, and a boarding gate is the worst possible place to
   wait on a network round trip for a ticket the phone already holds.

   Everything else: cache first. The network is optional by design. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (url.pathname.endsWith('/guide.enc')){
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

  if (isDoc(url.pathname)){
    e.respondWith(
      caches.open(DOCS_CACHE).then(c => c.match(e.request).then(hit => {
        if (hit) return hit;
        return fetch(e.request)
          .then(res => {
            if (res && res.status === 200) c.put(e.request, res.clone());
            return res;
          })
          .catch(() => new Response('', {status:504, statusText:'Offline'}));
      }))
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
