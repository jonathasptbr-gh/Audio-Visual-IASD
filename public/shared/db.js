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
      thumb: (meta && meta.thumb) || null,
      type: blob.type,
      kind: kindFromType(blob.type),
      name: (meta && meta.name) || 'sem-nome',
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
    const s = await store(STORE_MEDIA, 'readwrite');
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
    const out = [];
    for (const id of ids) {
      const m = await getMedia(id);
      if (m) out.push(m);
    }
    return out;
  }
  async function listHas(name, id) {
    return (await listIds(name)).includes(id);
  }
  async function listAdd(name, id) {
    const ids = await listIds(name);
    if (!ids.includes(id)) { ids.push(id); await listSet(name, ids); }
  }
  async function listRemove(name, id) {
    const ids = (await listIds(name)).filter((x) => x !== id);
    await listSet(name, ids);
    await gc(id);
  }
  // Apaga o blob se não estiver referenciado por nenhuma lista.
  async function gc(id) {
    for (const l of LISTS) {
      if ((await listIds(l)).includes(id)) return;
    }
    const s = await store(STORE_MEDIA, 'readwrite');
    await asPromise(s.delete(id));
  }

  // ---- canal de comandos ----
  const channel = 'BroadcastChannel' in global ? new BroadcastChannel(CHANNEL_NAME) : null;
  function sendCommand(command) { if (channel) channel.postMessage(command); }
  function onCommand(handler) { if (channel) channel.addEventListener('message', (e) => handler(e.data)); }

  global.AVDB = {
    openDB, setState, getState,
    addMedia, getMedia, renameMedia,
    listIds, listSet, listItems, listHas, listAdd, listRemove, gc,
    kindFromType, sendCommand, onCommand,
  };
})(this);
