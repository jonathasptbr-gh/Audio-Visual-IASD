// Camada de dados compartilhada entre os dois PWAs (Controle e Display).
// Mesmo domínio/origin => compartilham IndexedDB, OPFS e BroadcastChannel.
//
// Modelo:
//   - store "media": blobs importados (imagens/vídeos/áudios) e itens de URL.
//   - store "files": catálogo dos arquivos guardados no OPFS (só metadados +
//     thumbnail; os bytes ficam no Origin Private File System).
//   - listas (em "state"): "imports", "playlist" = arrays de ids.
//   - um blob de "media" só é apagado quando não está em NENHUMA lista (gc);
//     registros de "files" pertencem à sua pasta OPFS e não passam pelo gc.
//
// Exposto como window.AVDB.

(function (global) {
  'use strict';

  const DB_NAME = 'av-iasd';
  const DB_VERSION = 2;
  const STORE_MEDIA = 'media';
  const STORE_STATE = 'state';
  const STORE_FILES = 'files';
  const CHANNEL_NAME = 'av-iasd';
  const LISTS = ['imports', 'playlist'];

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_MEDIA)) db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_STATE)) db.createObjectStore(STORE_STATE);
        if (!db.objectStoreNames.contains(STORE_FILES)) {
          const fs = db.createObjectStore(STORE_FILES, { keyPath: 'id' });
          fs.createIndex('folder', 'folder');
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
  // Busca em "media" e, se não achar, no catálogo OPFS "files" — assim um id
  // de arquivo sincronizado pode entrar em listas/pastas e tocar no Display
  // sem cópia temporária.
  async function getMedia(id) {
    const s = await store(STORE_MEDIA, 'readonly');
    const rec = await asPromise(s.get(id));
    if (rec) return rec;
    return fileGet(id);
  }
  // Armazena um registro de URL temporário sem blob e sem adicioná-lo a nenhuma lista.
  async function storeUrlTemp(urlStr, meta) {
    const record = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      blob: null,
      url: urlStr,
      thumb: (meta && meta.thumb) || null,
      type: (meta && meta.type) || 'audio/mpeg',
      kind: (meta && meta.kind) || 'audio',
      name: (meta && meta.name) || 'sem-nome',
      youtubeId: null,
      createdAt: Date.now(),
    };
    const s = await store(STORE_MEDIA, 'readwrite');
    await asPromise(s.add(record));
    return record;
  }
  // Armazena um blob temporário sem adicioná-lo a nenhuma lista (para pastas vinculadas).
  async function storeMediaTemp(blob, meta) {
    const record = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      blob,
      url: null,
      thumb: (meta && meta.thumb) || null,
      type: blob.type,
      kind: (meta && meta.kind) || kindFromType(blob.type),
      name: (meta && meta.name) || 'sem-nome',
      youtubeId: null,
      createdAt: Date.now(),
    };
    const s = await store(STORE_MEDIA, 'readwrite');
    await asPromise(s.add(record));
    return record;
  }
  // Exclui diretamente um registro de mídia pelo ID (usado para limpar temp de pastas vinculadas).
  async function deleteMedia(id) {
    const s = await store(STORE_MEDIA, 'readwrite');
    return asPromise(s.delete(id));
  }
  async function renameMedia(id, name) {
    // get + put na mesma transação para garantir atomicidade.
    const [s] = await storeTx(STORE_MEDIA, 'readwrite');
    const record = await asPromise(s.get(id));
    if (record) {
      record.name = name;
      return asPromise(s.put(record));
    }
    // Registro do catálogo OPFS: renomeia só o nome de exibição (o path fica).
    const [fs] = await storeTx(STORE_FILES, 'readwrite');
    const f = await asPromise(fs.get(id));
    if (!f) return;
    f.name = name;
    return asPromise(fs.put(f));
  }

  // ---- catálogo OPFS (store "files") ----
  async function fileAdd(record) {
    const s = await store(STORE_FILES, 'readwrite');
    return asPromise(s.put(record));
  }
  async function fileGet(id) {
    const s = await store(STORE_FILES, 'readonly');
    return asPromise(s.get(id));
  }
  async function fileDelete(id) {
    const s = await store(STORE_FILES, 'readwrite');
    return asPromise(s.delete(id));
  }
  async function filesByFolder(folder) {
    const s = await store(STORE_FILES, 'readonly');
    return asPromise(s.index('folder').getAll(folder));
  }
  async function filesAll() {
    const s = await store(STORE_FILES, 'readonly');
    return asPromise(s.getAll());
  }

  // ---- OPFS (Origin Private File System) ----
  // Os bytes dos arquivos sincronizados moram aqui; nunca pedem permissão e
  // são visíveis para os dois PWAs (mesmo origin). Paths no formato "a/b/c.mp4".
  function opfsSupported() {
    return !!(navigator.storage && navigator.storage.getDirectory);
  }
  function splitPath(path) {
    return String(path).split('/').filter(Boolean);
  }
  async function opfsDir(parts, create) {
    let dir = await navigator.storage.getDirectory();
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: !!create });
    return dir;
  }
  async function opfsGetFile(path) {
    const parts = splitPath(path);
    const name = parts.pop();
    const dir = await opfsDir(parts, false);
    const fh = await dir.getFileHandle(name);
    return fh.getFile();
  }
  async function opfsWriteFile(path, blob) {
    const parts = splitPath(path);
    const name = parts.pop();
    const dir = await opfsDir(parts, true);
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
  }
  async function opfsDeleteFile(path) {
    const parts = splitPath(path);
    const name = parts.pop();
    try {
      const dir = await opfsDir(parts, false);
      await dir.removeEntry(name);
    } catch (_) {}
  }
  async function opfsDeleteDir(path) {
    const parts = splitPath(path);
    const name = parts.pop();
    try {
      const dir = await opfsDir(parts, false);
      await dir.removeEntry(name, { recursive: true });
    } catch (_) {}
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
    addMedia, addUrlMedia, getMedia, storeUrlTemp, storeMediaTemp, deleteMedia, renameMedia,
    listIds, listSet, listItems, listHas, listAdd, listRemove, gc,
    fileAdd, fileGet, fileDelete, filesByFolder, filesAll,
    opfsSupported, opfsGetFile, opfsWriteFile, opfsDeleteFile, opfsDeleteDir,
    kindFromType, sendCommand, onCommand,
  };
})(this);
