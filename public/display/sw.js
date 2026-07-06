const CACHE = 'display-v4.23';
// O Display não usa a fonte de ícones (Material Symbols) — só o Controle a
// carrega/cacheia; aqui a UI é apenas wallpaper + mídia.
const ASSETS = [
  './',
  './index.html',
  './display.css',
  './display.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  '../shared/db.js',
  '../shared/stage.js',
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
          // Apaga qualquer cache deste app (inclusive os antigos "iasd-display-*")
          // sem tocar nos caches do Controle.
          keys
            .filter((k) => k.includes('display') && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Busca SOMENTE no cache próprio deste app, evitando servir conteúdo
  // velho que tenha sobrado em caches de versões antigas.
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((cached) => cached || fetch(e.request))
    )
  );
});
