class AVController {
  constructor() {
    this.connection = null;
    this.presentationRequest = null;
    this.currentImageData = null;
    this.currentFileName = null;

    this.els = {
      statusBadge: document.getElementById('status-badge'),
      statusText: document.getElementById('status-text'),
      btnStart: document.getElementById('btn-start'),
      btnStop: document.getElementById('btn-stop'),
      dropZone: document.getElementById('drop-zone'),
      fileInput: document.getElementById('file-input'),
      previewContainer: document.getElementById('preview-container'),
      previewImage: document.getElementById('preview-image'),
      previewName: document.getElementById('preview-name'),
      btnSend: document.getElementById('btn-send'),
      btnClear: document.getElementById('btn-clear'),
      notSupported: document.getElementById('not-supported'),
    };

    this.init();
  }

  init() {
    if (!('presentation' in navigator)) {
      this.els.notSupported.classList.add('visible');
      this.els.btnStart.disabled = true;
      return;
    }

    const receiverUrl = new URL('/receiver.html', window.location.href).href;
    this.presentationRequest = new PresentationRequest([receiverUrl]);

    this.presentationRequest.getAvailability().then((avail) => {
      this.updateStartButton(avail.value);
      avail.addEventListener('change', () => this.updateStartButton(avail.value));
    }).catch(() => {
      // getAvailability not supported everywhere, keep button enabled
    });

    // Reconnect to existing session if any
    this.presentationRequest.addEventListener('connectionavailable', (e) => {
      this.attachConnection(e.connection);
    });

    this.bindEvents();
    this.registerSW();
  }

  bindEvents() {
    this.els.btnStart.addEventListener('click', () => this.startPresentation());
    this.els.btnStop.addEventListener('click', () => this.stopPresentation());
    this.els.btnSend.addEventListener('click', () => this.sendCurrentImage());
    this.els.btnClear.addEventListener('click', () => this.clearImage());

    // Drop zone
    this.els.dropZone.addEventListener('click', () => this.els.fileInput.click());
    this.els.fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));

    this.els.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.els.dropZone.classList.add('drag-over');
    });
    this.els.dropZone.addEventListener('dragleave', () => {
      this.els.dropZone.classList.remove('drag-over');
    });
    this.els.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.els.dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) this.handleFileSelect(file);
      else this.showToast('Apenas imagens são suportadas.', 'error');
    });
  }

  async startPresentation() {
    if (!this.presentationRequest) return;
    this.setStatus('connecting', 'Conectando...');
    this.els.btnStart.disabled = true;

    try {
      const conn = await this.presentationRequest.start();
      this.attachConnection(conn);
      this.showToast('Segunda tela conectada!', 'success');
    } catch (err) {
      if (err.name !== 'AbortError') {
        this.showToast('Falha ao conectar. Tente novamente.', 'error');
      }
      this.setStatus('idle', 'Desconectado');
      this.els.btnStart.disabled = false;
    }
  }

  stopPresentation() {
    if (this.connection) {
      this.connection.terminate();
    }
  }

  attachConnection(conn) {
    this.connection = conn;

    conn.addEventListener('connect', () => {
      this.setStatus('connected', 'Conectado');
      this.els.btnStart.disabled = true;
      this.els.btnStop.disabled = false;
      this.updateSendButton();
      if (this.currentImageData) this.sendCurrentImage();
    });

    conn.addEventListener('close', () => {
      this.setStatus('idle', 'Desconectado');
      this.resetConnectionUI();
    });

    conn.addEventListener('terminate', () => {
      this.setStatus('idle', 'Desconectado');
      this.resetConnectionUI();
      this.connection = null;
    });

    // If already connected
    if (conn.state === 'connected') {
      this.setStatus('connected', 'Conectado');
      this.els.btnStart.disabled = true;
      this.els.btnStop.disabled = false;
      this.updateSendButton();
      if (this.currentImageData) this.sendCurrentImage();
    }
  }

  resetConnectionUI() {
    this.els.btnStart.disabled = false;
    this.els.btnStop.disabled = true;
    this.updateSendButton();
  }

  async handleFileSelect(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.showToast('Selecione uma imagem válida.', 'error');
      return;
    }

    const MAX_SIZE_MB = 10;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      this.showToast(`Imagem muito grande (máx. ${MAX_SIZE_MB}MB).`, 'error');
      return;
    }

    try {
      const dataUrl = await this.readFileAsDataURL(file);
      this.currentImageData = dataUrl;
      this.currentFileName = file.name;

      this.els.previewImage.src = dataUrl;
      this.els.previewName.textContent = file.name;
      this.els.previewContainer.classList.add('visible');
      this.els.dropZone.style.display = 'none';

      this.updateSendButton();
    } catch (err) {
      this.showToast('Erro ao carregar imagem.', 'error');
    }
  }

  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  clearImage() {
    this.currentImageData = null;
    this.currentFileName = null;
    this.els.previewContainer.classList.remove('visible');
    this.els.dropZone.style.display = '';
    this.els.fileInput.value = '';
    this.updateSendButton();
  }

  sendCurrentImage() {
    if (!this.currentImageData || !this.connection || this.connection.state !== 'connected') return;

    const message = JSON.stringify({
      type: 'image',
      data: this.currentImageData,
      name: this.currentFileName,
    });

    this.connection.send(message);
    this.showToast('Imagem enviada para a tela!', 'success');
  }

  updateSendButton() {
    const canSend = !!this.currentImageData && !!this.connection && this.connection.state === 'connected';
    this.els.btnSend.disabled = !canSend;
  }

  updateStartButton(available) {
    if (!available) {
      this.els.btnStart.title = 'Nenhuma tela secundária detectada';
    }
  }

  setStatus(state, label) {
    const badge = this.els.statusBadge;
    badge.className = 'status-badge ' + state;
    this.els.statusText.textContent = label;
  }

  showToast(message, type = 'info') {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast ${type}`;
    // force reflow
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new AVController());
