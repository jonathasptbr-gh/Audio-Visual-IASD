// Camada de dados compartilhada entre os dois PWAs (Controle e Display).
// Mesmo domínio/origin => compartilham IndexedDB e BroadcastChannel.
//
// Modelo:
//   - store "media": todos os blobs (imagens/vídeos/áudios).
//   - listas (em "state"): "imports", "favorites", "playlist" = arrays de ids.
//   - um blob só é apagado quando não está em NENHUMA das três listas (gc).
//
// Exposto como window.AVDB.

(function (global) {
  'use strict';

  const DB_NAME = 'av-iasd';
  const DB_VERSION = 1;
  const STORE_MEDIA = 'media';
  const STORE_STATE = 'state';
  const CHANNEL_NAME = 'av-iasd';
  const LISTS = ['imports', 'favorites', 'playlist'];

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_MEDIA)) db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_STATE)) db.createObjectStore(STORE_STATE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function store(name, mode) {
    return openDB().then((db) => db.transaction(name, mode).objectStore(name));
  }
  // Retorna [objectStore, transaction] para operações que precisam de atomicidade (get+put).
  function storeTx(name, mode) {
    return openDB().then((db) => {
      const tx = db.transaction(name, mode);
      return [tx.objectStore(name), tx];
    });
  }
  function asPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  function kindFromType(type) {
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    return 'other';
  }

  // ---- state genérico ----
  async function setState(key, value) {
    const s = await store(STORE_STATE, 'readwrite');
    return asPromise(s.put(value, key));
  }
  async function getState(key) {
    const s = await store(STORE_STATE, 'readonly');
    return asPromise(s.get(key));
  }

  // ---- media ----
  async function addMedia(blob, meta) {
    const record = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      blob,
      url: null,
      thumb: (meta && meta.thumb) || null,
      type: blob.type,
      kind: kindFromType(blob.type),
      name: (meta && meta.name) || 'sem-nome',
      youtubeId: null,
      createdAt: Date.now(),
    };
    const s = await store(STORE_MEDIA, 'readwrite');
    await asPromise(s.add(record));
    await listAdd('imports', record.id);
    return record;
  }
  // Item de URL externa (sem blob local); kind pode ser 'image','video','audio','youtube'.
  async function addUrlMedia(url, meta) {
    const record = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      blob: null,
      url,
      thumb: (meta && meta.thumb) || null,
      type: (meta && meta.type) || 'url/unknown',
      kind: (meta && meta.kind) || 'url',
      name: (meta && meta.name) || url,
      youtubeId: (meta && meta.youtubeId) || null,
      createdAt: Date.now(),
    };
    const s = await store(STORE_MEDIA, 'readwrite');
    await asPromise(s.add(record));
    await listAdd('imports', record.id);
    return record;
  }
  async function getMedia(id) {
    const s = await store(STORE_MEDIA, 'readonly');
    return asPromise(s.get(id));
  }
  async function renameMedia(id, name) {
    // get + put na mesma transação para garantir atomicidade.
    const [s] = await storeTx(STORE_MEDIA, 'readwrite');
    const record = await asPromise(s.get(id));
    if (!record) return;
    record.name = name;
    return asPromise(s.put(record));
  }

  // ---- listas ----
  async function listIds(name) {
    let ids = await getState(name);
    // Migração: "imports" herda o antigo "order".
    if (ids == null && name === 'imports') ids = await getState('order');
    return Array.isArray(ids) ? ids.slice() : [];
  }
  async function listSet(name, ids) {
    return setState(name, ids);
  }
  async function listItems(name) {
    const ids = await listIds(name);
    if (ids.length === 0) return [];
    // Busca todos os registros em paralelo (uma transação por get, mas sem sequencialização desnecessária).
    const records = await Promise.all(ids.map((id) => getMedia(id)));
    // Preserva a ordem da lista e descarta ids que não têm mais registro.
    return records.filter(Boolean);
  }
  async function listHas(name, id) {
    return (await listIds(name)).includes(id);
  }
  async function listAdd(name, id) {
    const ids = await listIds(name);
    if (!ids.includes(id)) { ids.push(id); await listSet(name, ids); }
  }
  async function listRemove(name, id) {
    const before = await listIds(name);
    const after = before.filter((x) => x !== id);
    // Só grava e chama gc se o id estava de fato na lista.
    if (after.length === before.length) return;
    await listSet(name, after);
    await gc(id);
  }
  // Apaga o blob se não estiver referenciado por nenhuma lista.
  async function gc(id) {
    // Lê todas as listas em paralelo para reduzir latência.
    const all = await Promise.all(LISTS.map((l) => listIds(l)));
    if (all.some((ids) => ids.includes(id))) return;
    const s = await store(STORE_MEDIA, 'readwrite');
    await asPromise(s.delete(id));
  }

  // ---- canal de comandos ----
  const channel = 'BroadcastChannel' in global ? new BroadcastChannel(CHANNEL_NAME) : null;
  function sendCommand(command) { if (channel) channel.postMessage(command); }
  function onCommand(handler) { if (channel) channel.addEventListener('message', (e) => handler(e.data)); }

  global.AVDB = {
    openDB, setState, getState,
    addMedia, addUrlMedia, getMedia, renameMedia,
    listIds, listSet, listItems, listHas, listAdd, listRemove, gc,
    kindFromType, sendCommand, onCommand,
  };
})(this);
