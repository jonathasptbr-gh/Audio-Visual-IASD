const CACHE = 'controle-v4.23';
const ASSETS = [
  './',
  './index.html',
  './controle.css',
  './controle.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
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
          // Apaga qualquer cache deste app (inclusive os antigos "iasd-controle-*")
          // sem tocar nos caches do Display.
          keys
            .filter((k) => k.includes('controle') && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Armazena os dados de share em IDB (state['pending-share']) para o app principal processar.
function storePendingShare(data) {
  return new Promise((resolve, reject) => {
    // Sem número de versão: abre a versão atual do banco (evita VersionError
    // quando o schema é atualizado em shared/db.js).
    const req = indexedDB.open('av-iasd');
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put(data, 'pending-share');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

async function handleShare(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('media');
    const sharedUrl = formData.get('url') || '';
    const sharedText = formData.get('text') || '';
    const sharedTitle = formData.get('title') || '';

    // Extrai a primeira URL do campo text (suporta texto antes/depois da URL)
    const textUrl = (sharedText.match(/https?:\/\/\S+/) || [])[0] || '';
    // Prioridade: campo url > URL extraída de text
    const urlToProcess = sharedUrl || textUrl;

    await storePendingShare({
      files: files.filter((f) => f && f.size > 0),
      url: urlToProcess,
      title: sharedTitle || sharedText,
      ts: Date.now(),
    });
  } catch (err) {
    // Se falhar ao processar, ignora e redireciona mesmo assim
  }
  // Redireciona para o app (abre/foca o Controle)
  return Response.redirect('./', 303);
}

self.addEventListener('fetch', (e) => {
  // Intercepta o POST do Web Share Target
  if (e.request.method === 'POST' && new URL(e.request.url).pathname.endsWith('/share-target')) {
    e.respondWith(handleShare(e.request));
    return;
  }
  if (e.request.method !== 'GET') return;
  // Busca SOMENTE no cache próprio deste app, evitando servir conteúdo
  // velho que tenha sobrado em caches de versões antigas.
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((cached) => cached || fetch(e.request))
    )
  );
});
