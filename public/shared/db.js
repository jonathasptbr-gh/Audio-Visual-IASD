// Camada de dados compartilhada entre os dois PWAs (Controle e Display).
// Mesmo domínio/origin => compartilham:
//   - IndexedDB        -> mídias (imagens, vídeos, áudios) + ordem da playlist
//   - BroadcastChannel -> comandos em tempo real entre os apps
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

  function kindFromType(type) {
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    return 'other';
  }

  // ---- Estado (chave/valor) ----------------------------------------------

  async function setState(key, value) {
    const s = await store(STORE_STATE, 'readwrite');
    return asPromise(s.put(value, key));
  }

  async function getState(key) {
    const s = await store(STORE_STATE, 'readonly');
    return asPromise(s.get(key));
  }

  // ---- Mídias + playlist --------------------------------------------------

  async function addMedia(blob, meta) {
    const record = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      blob,
      type: blob.type,
      kind: kindFromType(blob.type),
      name: (meta && meta.name) || 'sem-nome',
      createdAt: Date.now(),
    };
    const s = await store(STORE_MEDIA, 'readwrite');
    await asPromise(s.add(record));

    const order = (await getState('order')) || [];
    order.push(record.id);
    await setState('order', order);

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

  async function deleteMedia(id) {
    const s = await store(STORE_MEDIA, 'readwrite');
    await asPromise(s.delete(id));
    const order = (await getState('order')) || [];
    await setState('order', order.filter((x) => x !== id));
  }

  // Retorna as mídias já na ordem da playlist.
  async function getPlaylist() {
    const s = await store(STORE_MEDIA, 'readonly');
    const all = await asPromise(s.getAll());
    const byId = new Map(all.map((m) => [m.id, m]));

    let order = (await getState('order')) || [];
    // Mantém só ids existentes...
    order = order.filter((id) => byId.has(id));
    // ...e acrescenta qualquer mídia que tenha ficado de fora (segurança).
    for (const m of all) if (!order.includes(m.id)) order.push(m.id);

    return order.map((id) => byId.get(id));
  }

  async function setOrder(ids) {
    return setState('order', ids);
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
    setState,
    getState,
    addMedia,
    getMedia,
    renameMedia,
    deleteMedia,
    getPlaylist,
    setOrder,
    kindFromType,
    sendCommand,
    onCommand,
  };
})(this);
