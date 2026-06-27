// Camada de dados compartilhada entre os dois PWAs (Controle e Display).
// Como ambos estão no MESMO domínio/origin, eles compartilham:
//   - o mesmo IndexedDB  -> armazena as mídias (imagens) offline
//   - o mesmo BroadcastChannel -> envia comandos em tempo real entre os apps
//
// Exposto globalmente como `window.AVDB`.

(function (global) {
  'use strict';

  const DB_NAME = 'av-iasd';
  const DB_VERSION = 1;
  const STORE_MEDIA = 'media';
  const STORE_STATE = 'state';
  const CHANNEL_NAME = 'av-iasd';

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_STATE)) {
          db.createObjectStore(STORE_STATE);
        }
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

  // ---- Mídias -------------------------------------------------------------

  async function addMedia(blob, meta) {
    const record = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      blob,
      type: blob.type,
      name: (meta && meta.name) || 'sem-nome',
      createdAt: Date.now(),
    };
    const s = await store(STORE_MEDIA, 'readwrite');
    await asPromise(s.add(record));
    return record;
  }

  async function getMedia(id) {
    const s = await store(STORE_MEDIA, 'readonly');
    return asPromise(s.get(id));
  }

  async function getAllMedia() {
    const s = await store(STORE_MEDIA, 'readonly');
    const all = await asPromise(s.getAll());
    return all.sort((a, b) => a.createdAt - b.createdAt);
  }

  async function deleteMedia(id) {
    const s = await store(STORE_MEDIA, 'readwrite');
    return asPromise(s.delete(id));
  }

  // ---- Estado atual (o que o display deve mostrar) ------------------------

  async function setState(key, value) {
    const s = await store(STORE_STATE, 'readwrite');
    return asPromise(s.put(value, key));
  }

  async function getState(key) {
    const s = await store(STORE_STATE, 'readonly');
    return asPromise(s.get(key));
  }

  // ---- Canal de comandos em tempo real ------------------------------------

  const channel = 'BroadcastChannel' in global ? new BroadcastChannel(CHANNEL_NAME) : null;

  function sendCommand(command) {
    if (channel) channel.postMessage(command);
  }

  function onCommand(handler) {
    if (channel) channel.addEventListener('message', (e) => handler(e.data));
  }

  global.AVDB = {
    openDB,
    addMedia,
    getMedia,
    getAllMedia,
    deleteMedia,
    setState,
    getState,
    sendCommand,
    onCommand,
  };
})(this);
