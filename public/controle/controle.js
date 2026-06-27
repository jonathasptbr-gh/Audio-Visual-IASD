/**
 * App de CONTROLE.
 * - Gerencia a biblioteca de mídia (grava Blobs no IndexedDB compartilhado).
 * - Envia comandos para o Display via BroadcastChannel.
 * - Recebe o estado do Display (currentTime, duração, play/pause) para
 *   atualizar a barra de progresso e os botões.
 */
class Controle {
  constructor() {
    this.channel = new BroadcastChannel('tv_cast_channel');
    this.library = [];
    this.activeId = null;
    this.seeking = false;
    this.displayOnline = false;
    this.lastSeenDisplay = 0;

    this.els = {
      statusBadge: document.getElementById('status-badge'),
      statusText: document.getElementById('status-text'),
      nowPlaying: document.getElementById('now-playing'),
      timeCurrent: document.getElementById('time-current'),
      timeTotal: document.getElementById('time-total'),
      seek: document.getElementById('seek'),
      btnPrev: document.getElementById('btn-prev'),
      btnPlay: document.getElementById('btn-play'),
      btnNext: document.getElementById('btn-next'),
      iconPlay: document.getElementById('icon-play'),
      iconPause: document.getElementById('icon-pause'),
      volume: document.getElementById('volume'),
      btnBlackout: document.getElementById('btn-blackout'),
      libraryList: document.getElementById('library-list'),
      libraryEmpty: document.getElementById('library-empty'),
      btnAdd: document.getElementById('btn-add'),
      fileInput: document.getElementById('file-input'),
    };

    this.init();
  }

  async init() {
    this.bindEvents();
    this.channel.onmessage = (e) => this.onMessage(e.data);

    await this.refreshLibrary();

    // Handshake: pergunta ao Display qual o estado atual
    this.send({ type: 'request-state' });

    // Presença: o Display some se não responde há > 4s
    setInterval(() => {
      const online = Date.now() - this.lastSeenDisplay < 4000;
      if (online !== this.displayOnline) this.setDisplayOnline(online);
      if (!online) this.send({ type: 'request-state' });
    }, 2000);

    this.registerSW();
  }

  bindEvents() {
    this.els.btnAdd.addEventListener('click', () => this.els.fileInput.click());
    this.els.fileInput.addEventListener('change', (e) => this.addFiles(e.target.files));

    this.els.btnPlay.addEventListener('click', () => this.togglePlay());
    this.els.btnPrev.addEventListener('click', () => this.step(-1));
    this.els.btnNext.addEventListener('click', () => this.step(1));

    // Seek: enquanto arrasta não deixa o estado do display sobrescrever
    this.els.seek.addEventListener('input', () => { this.seeking = true; this.updateTimeLabelFromSeek(); });
    this.els.seek.addEventListener('change', () => {
      const ratio = this.els.seek.value / 1000;
      this.send({ type: 'seek', ratio });
      this.seeking = false;
    });

    this.els.volume.addEventListener('input', () => {
      this.send({ type: 'volume', value: this.els.volume.value / 100 });
    });

    this.els.btnBlackout.addEventListener('click', () => {
      const active = this.els.btnBlackout.classList.toggle('active');
      this.send({ type: 'blackout', value: active });
    });
  }

  // ---------- Biblioteca ----------

  async addFiles(fileList) {
    const files = Array.from(fileList).filter(
      (f) => f.type.startsWith('video/') || f.type.startsWith('image/')
    );
    if (!files.length) return;

    for (const file of files) {
      await window.MediaDB.addMedia({ name: file.name, type: file.type, blob: file });
    }
    this.els.fileInput.value = '';
    await this.refreshLibrary();
    this.send({ type: 'library-changed' });
  }

  async refreshLibrary() {
    this.library = await window.MediaDB.getAllMedia();
    this.renderLibrary();
  }

  renderLibrary() {
    const list = this.els.libraryList;
    list.querySelectorAll('.media-item').forEach((n) => n.remove());

    this.els.libraryEmpty.style.display = this.library.length ? 'none' : 'block';

    for (const item of this.library) {
      const isVideo = item.type.startsWith('video/');
      const el = document.createElement('div');
      el.className = 'media-item' + (item.id === this.activeId ? ' active' : '');
      el.innerHTML = `
        <div class="media-thumb">
          ${isVideo
            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>'}
        </div>
        <div class="media-info">
          <div class="media-name">${this.escape(item.name)}</div>
          <div class="media-type">${isVideo ? 'Vídeo' : 'Imagem'}</div>
        </div>
        <button class="media-del" title="Remover" aria-label="Remover">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>`;
      el.querySelector('.media-info').addEventListener('click', () => this.load(item.id));
      el.querySelector('.media-thumb').addEventListener('click', () => this.load(item.id));
      el.querySelector('.media-del').addEventListener('click', (ev) => { ev.stopPropagation(); this.remove(item.id); });
      list.appendChild(el);
    }
  }

  async remove(id) {
    await window.MediaDB.deleteMedia(id);
    if (id === this.activeId) {
      this.activeId = null;
      this.setNowPlaying(null);
    }
    await this.refreshLibrary();
    this.send({ type: 'library-changed' });
  }

  // ---------- Comandos ----------

  load(id) {
    this.activeId = id;
    const item = this.library.find((m) => m.id === id);
    this.setNowPlaying(item);
    this.renderLibrary();
    this.send({ type: 'load', id });
    this.enableTransport(item ? item.type.startsWith('video/') : false);
  }

  togglePlay() {
    this.send({ type: 'toggle' });
  }

  step(dir) {
    if (!this.library.length) return;
    let idx = this.library.findIndex((m) => m.id === this.activeId);
    idx = idx === -1 ? 0 : idx + dir;
    if (idx < 0) idx = 0;
    if (idx > this.library.length - 1) idx = this.library.length - 1;
    this.load(this.library[idx].id);
  }

  // ---------- Recebe estado do Display ----------

  onMessage(msg) {
    if (!msg || typeof msg !== 'object') return;

    // Ignora os próprios comandos ecoados (BroadcastChannel não recebe os
    // que ele mesmo envia, mas outra aba de controle poderia enviar)
    switch (msg.type) {
      case 'state':
        this.lastSeenDisplay = Date.now();
        this.setDisplayOnline(true);
        this.applyState(msg);
        break;
      case 'library-changed':
        this.refreshLibrary();
        break;
    }
  }

  applyState(s) {
    // Sincroniza id ativo
    if (s.id != null && s.id !== this.activeId) {
      this.activeId = s.id;
      const item = this.library.find((m) => m.id === s.id);
      this.setNowPlaying(item);
      this.renderLibrary();
      this.enableTransport(s.mediaType === 'video');
    }

    // Play/pause
    const playing = s.playing;
    this.els.iconPlay.style.display = playing ? 'none' : 'block';
    this.els.iconPause.style.display = playing ? 'block' : 'none';

    // Progresso (não mexe enquanto o usuário arrasta)
    if (!this.seeking && s.duration > 0) {
      this.els.seek.value = Math.round((s.currentTime / s.duration) * 1000);
      this.els.timeCurrent.textContent = this.fmt(s.currentTime);
      this.els.timeTotal.textContent = this.fmt(s.duration);
    }

    if (typeof s.volume === 'number' && document.activeElement !== this.els.volume) {
      this.els.volume.value = Math.round(s.volume * 100);
    }
  }

  // ---------- UI helpers ----------

  setNowPlaying(item) {
    if (item) {
      this.els.nowPlaying.textContent = item.name;
      this.els.nowPlaying.classList.remove('empty');
    } else {
      this.els.nowPlaying.textContent = 'Nenhuma mídia selecionada';
      this.els.nowPlaying.classList.add('empty');
      this.els.timeCurrent.textContent = '0:00';
      this.els.timeTotal.textContent = '0:00';
      this.els.seek.value = 0;
    }
  }

  enableTransport(isVideo) {
    const has = this.activeId != null;
    this.els.btnPlay.disabled = !has || !isVideo;
    this.els.seek.disabled = !has || !isVideo;
    this.els.volume.disabled = !has || !isVideo;
    this.els.btnPrev.disabled = this.library.length < 2;
    this.els.btnNext.disabled = this.library.length < 2;
  }

  setDisplayOnline(online) {
    this.displayOnline = online;
    this.els.statusBadge.classList.toggle('online', online);
    this.els.statusText.textContent = online ? 'Display conectado' : 'Display offline';
  }

  updateTimeLabelFromSeek() {
    const total = this.parseTime(this.els.timeTotal.textContent);
    if (total > 0) this.els.timeCurrent.textContent = this.fmt((this.els.seek.value / 1000) * total);
  }

  fmt(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  parseTime(str) {
    const [m, s] = str.split(':').map(Number);
    return (m || 0) * 60 + (s || 0);
  }

  escape(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  send(msg) { this.channel.postMessage(msg); }

  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new Controle());
