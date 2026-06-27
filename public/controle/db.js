/**
 * MediaDB — helper de IndexedDB compartilhado entre os dois PWAs.
 * Como /controle/ e /display/ têm a MESMA origem, ambos enxergam este
 * mesmo banco. O Controle grava os vídeos (Blob); o Display lê pelo id.
 * Cópia idêntica existe em /display/db.js (para o cache offline de cada
 * Service Worker funcionar dentro do seu próprio escopo).
 */
(function () {
  const DB_NAME = 'iasd-av';
  const DB_VERSION = 1;
  const STORE = 'media';

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function tx(db, mode) {
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  async function addMedia({ name, type, blob }) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = tx(db, 'readwrite').add({ name, type, blob, addedAt: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getMedia(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = tx(db, 'readonly').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAllMedia() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = tx(db, 'readonly').getAll();
      req.onsuccess = () => resolve((req.result || []).sort((a, b) => a.addedAt - b.addedAt));
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteMedia(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = tx(db, 'readwrite').delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  window.MediaDB = { addMedia, getMedia, getAllMedia, deleteMedia };
})();
