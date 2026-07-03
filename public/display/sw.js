const CACHE = 'display-v2.4';
const ASSETS = [
  './',
  './index.html',
  './display.css',
  './display.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  '../shared/db.js',
  '../shared/stage.js',
  '../shared/material-symbols.css',
  '../shared/fonts/material-symbols.woff2',
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
  // Áudio do hinário LouvorJA: re-faz sem Referer para evitar bloqueio por origem.
  if (e.request.url.startsWith('https://api.louvorja.com.br/file/')) {
    e.respondWith(fetch(e.request.url, { mode: 'no-cors', referrerPolicy: 'no-referrer' }));
    return;
  }
  // Busca SOMENTE no cache próprio deste app, evitando servir conteúdo
  // velho que tenha sobrado em caches de versões antigas.
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((cached) => cached || fetch(e.request))
    )
  );
});
