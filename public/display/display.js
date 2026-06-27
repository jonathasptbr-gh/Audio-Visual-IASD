/**
 * App de DISPLAY.
 * - Ouve comandos do Controle via BroadcastChannel.
 * - Lê a mídia (Blob) do IndexedDB compartilhado pelo id.
 * - Reproduz vídeo (ou exibe imagem) em tela cheia.
 * - Envia de volta o estado (currentTime, duração, play/pause) para o Controle.
 * - Botão "Transmitir" usa a Remote Playback API (Android) para mandar o
 *   vídeo para a TV (Miracast/DLNA/Chromecast) sem espelhar a tela.
 */
class Display {
  constructor() {
    this.channel = new BroadcastChannel('tv_cast_channel');
    this.currentId = null;
    this.currentType = null;
    this.objectUrl = null;
    this.unlocked = false;

    this.els = {
      video: document.getElementById('video'),
      image: document.getElementById('image'),
      blackout: document.getElementById('blackout'),
      idle: document.getElementById('idle'),
      castBtn: document.getElementById('cast-btn'),
      pill: document.getElementById('pill'),
      pillText: document.getElementById('pill-text'),
    };

    this.init();
  }

  init() {
    this.channel.onmessage = (e) => this.onCommand(e.data);

    const v = this.els.video;
    v.addEventListener('timeupdate', () => this.reportState());
    v.addEventListener('play', () => this.reportState());
    v.addEventListener('pause', () => this.reportState());
    v.addEventListener('loadedmetadata', () => this.reportState());
    v.addEventListener('ended', () => this.reportState());
    v.addEventListener('volumechange', () => this.reportState());

    // Primeiro toque libera autoplay com áudio e entra em fullscreen
    document.body.addEventListener('click', () => this.unlock(), { once: true });

    this.setupRemotePlayback();

    // Anuncia presença periodicamente
    this.reportState();
    setInterval(() => this.reportState(), 1000);

    this.requestWakeLock();
    this.registerSW();
  }

  // ---------- Comandos do Controle ----------

  async onCommand(msg) {
    if (!msg || typeof msg !== 'object') return;
    const v = this.els.video;

    switch (msg.type) {
      case 'request-state':
        this.reportState();
        break;
      case 'load':
        await this.loadMedia(msg.id);
        break;
      case 'toggle':
        if (this.currentType === 'video') {
          if (v.paused) v.play().catch(() => {}); else v.pause();
        }
        break;
      case 'play':
        if (this.currentType === 'video') v.play().catch(() => {});
        break;
      case 'pause':
        if (this.currentType === 'video') v.pause();
        break;
      case 'seek':
        if (this.currentType === 'video' && v.duration) {
          v.currentTime = msg.ratio != null ? msg.ratio * v.duration : msg.time || 0;
        }
        break;
      case 'volume':
        v.volume = Math.min(1, Math.max(0, msg.value));
        break;
      case 'blackout':
        this.els.blackout.classList.toggle('active', !!msg.value);
        break;
    }
    this.showPill();
  }

  async loadMedia(id) {
    const item = await window.MediaDB.getMedia(id);
    if (!item) return;

    this.currentId = id;
    this.currentType = item.type.startsWith('video/') ? 'video' : 'image';

    if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; }
    this.objectUrl = URL.createObjectURL(item.blob);

    this.els.idle.classList.add('hidden');

    if (this.currentType === 'video') {
      this.els.image.classList.remove('visible');
      this.els.image.removeAttribute('src');
      const v = this.els.video;
      v.src = this.objectUrl;
      v.classList.add('visible');
      v.play().catch(() => {/* aguarda toque para liberar */});
    } else {
      this.els.video.classList.remove('visible');
      this.els.video.removeAttribute('src');
      const img = this.els.image;
      img.src = this.objectUrl;
      img.classList.add('visible');
    }

    this.reportState();
  }

  // ---------- Reporta estado para o Controle ----------

  reportState() {
    const v = this.els.video;
    const isVideo = this.currentType === 'video';
    this.channel.postMessage({
      type: 'state',
      id: this.currentId,
      mediaType: this.currentType,
      playing: isVideo ? !v.paused && !v.ended : false,
      currentTime: isVideo ? v.currentTime : 0,
      duration: isVideo ? (v.duration || 0) : 0,
      volume: isVideo ? v.volume : 1,
    });
  }

  // ---------- Remote Playback API (transmitir para TV) ----------

  setupRemotePlayback() {
    const v = this.els.video;
    if (!('remote' in v) || typeof v.remote.watchAvailability !== 'function') {
      // API indisponível (desktop / navegador sem suporte)
      return;
    }

    v.remote.watchAvailability((available) => {
      this.els.castBtn.classList.toggle('available', available);
    }).catch(() => {});

    v.remote.addEventListener('connect', () => this.els.castBtn.classList.add('connected'));
    v.remote.addEventListener('disconnect', () => this.els.castBtn.classList.remove('connected'));

    this.els.castBtn.addEventListener('click', async () => {
      try {
        await v.remote.prompt();
      } catch (err) {
        // usuário cancelou ou nenhum dispositivo disponível
      }
    });
  }

  // ---------- Plataforma ----------

  unlock() {
    this.unlocked = true;
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
    if (this.currentType === 'video') this.els.video.play().catch(() => {});
  }

  async requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      await navigator.wakeLock.request('screen');
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.requestWakeLock();
      });
    } catch {}
  }

  showPill() {
    this.els.pill.classList.add('show');
    this.els.pill.classList.remove('fade');
    clearTimeout(this._pillTimer);
    this._pillTimer = setTimeout(() => this.els.pill.classList.add('fade'), 2500);
  }

  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new Display());
