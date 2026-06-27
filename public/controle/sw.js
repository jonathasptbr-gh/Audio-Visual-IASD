const CACHE = 'controle-v1';
const ASSETS = [
  '/controle/',
  '/controle/index.html',
  '/controle/controle.css',
  '/controle/controle.js',
  '/controle/manifest.json',
  '/controle/icons/icon-192.svg',
  '/controle/icons/icon-512.svg',
  '/shared/db.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('controle-') && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
