class AVDisplay {
  constructor() {
    this.images = [];      // [{ url, name }]
    this.index = -1;
    this.controlsTimer = null;
    this.wakeLock = null;

    this.els = {
      stageImage: document.getElementById('stage-image'),
      blackout: document.getElementById('blackout'),
      emptyState: document.getElementById('empty-state'),
      fileInput: document.getElementById('file-input'),
      btnPick: document.getElementById('btn-pick'),
      controls: document.getElementById('controls'),
      counter: document.getElementById('counter'),
      btnPrev: document.getElementById('btn-prev'),
      btnNext: document.getElementById('btn-next'),
      btnAdd: document.getElementById('btn-add'),
      btnBlack: document.getElementById('btn-black'),
      tapHint: document.getElementById('tap-hint'),
    };

    this.init();
  }

  init() {
    this.els.btnPick.addEventListener('click', () => this.els.fileInput.click());
    this.els.btnAdd.addEventListener('click', () => this.els.fileInput.click());
    this.els.fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));

    this.els.btnPrev.addEventListener('click', (e) => { e.stopPropagation(); this.prev(); });
    this.els.btnNext.addEventListener('click', (e) => { e.stopPropagation(); this.next(); });
    this.els.btnBlack.addEventListener('click', (e) => { e.stopPropagation(); this.toggleBlackout(); });

    // Tap on the stage toggles the control bar
    document.querySelector('.stage').addEventListener('click', () => this.toggleControls());

    // Keep controls open while interacting with them
    this.els.controls.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('keydown', (e) => this.handleKey(e));

    this.registerSW();
  }

  async handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;

    const startEmpty = this.images.length === 0;

    for (const file of files) {
      const url = URL.createObjectURL(file);
      this.images.push({ url, name: file.name });
    }

    this.els.fileInput.value = '';
    this.els.emptyState.classList.add('hidden');

    // Try to maximize the projected area + keep screen awake
    this.enterFullscreen();
    this.requestWakeLock();

    if (startEmpty) {
      this.show(0);
      this.flashTapHint();
    } else {
      this.updateCounter();
      this.showControls();
    }
  }

  show(i) {
    if (i < 0 || i >= this.images.length) return;
    this.index = i;

    const img = this.els.stageImage;
    img.classList.remove('visible');

    // brief fade, then swap
    setTimeout(() => {
      img.src = this.images[i].url;
      img.onload = () => img.classList.add('visible');
    }, 120);

    this.updateCounter();
  }

  next() {
    if (this.index < this.images.length - 1) this.show(this.index + 1);
    this.showControls();
  }

  prev() {
    if (this.index > 0) this.show(this.index - 1);
    this.showControls();
  }

  toggleBlackout() {
    const active = this.els.blackout.classList.toggle('active');
    this.els.btnBlack.classList.toggle('active', active);
    this.showControls();
  }

  updateCounter() {
    this.els.counter.textContent =
      this.images.length ? `${this.index + 1} / ${this.images.length}` : '';
    this.els.btnPrev.disabled = this.index <= 0;
    this.els.btnNext.disabled = this.index >= this.images.length - 1;
  }

  // ---------- Controls visibility ----------

  toggleControls() {
    if (this.els.controls.classList.contains('visible')) this.hideControls();
    else this.showControls();
  }

  showControls() {
    this.els.controls.classList.add('visible');
    clearTimeout(this.controlsTimer);
    this.controlsTimer = setTimeout(() => this.hideControls(), 3500);
  }

  hideControls() {
    this.els.controls.classList.remove('visible');
    clearTimeout(this.controlsTimer);
  }

  flashTapHint() {
    this.els.tapHint.classList.add('show');
    setTimeout(() => this.els.tapHint.classList.remove('show'), 3000);
  }

  // ---------- Keyboard (for desktop / paired keyboard) ----------

  handleKey(e) {
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': case ' ': this.next(); break;
      case 'ArrowLeft': case 'PageUp': this.prev(); break;
      case 'b': case 'B': this.toggleBlackout(); break;
    }
  }

  // ---------- Platform helpers ----------

  enterFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  }

  async requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.requestWakeLock();
      });
    } catch {}
  }

  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new AVDisplay());
