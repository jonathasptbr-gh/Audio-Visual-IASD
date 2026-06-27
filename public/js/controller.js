class AVController {
  constructor() {
    this.presentationConn = null;
    this.presentationRequest = null;
    this.wsConn = null;
    this.wsConnected = false;
    this.wsReceiverCount = 0;
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
      receiverUrl: document.getElementById('receiver-url'),
    };

    this.init();
  }

  init() {
    this.initWebSocket();
    this.loadReceiverUrl();

    if ('presentation' in navigator) {
      this.initPresentation();
    } else {
      // Presentation API not available — WebSocket-only mode still works
      this.els.notSupported.classList.add('visible');
      this.els.btnStart.disabled = true;
      this.els.btnStop.disabled = true;
    }

    this.bindEvents();
    this.registerSW();
  }

  // --- WebSocket transport (always active) ---

  initWebSocket() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}`;
    const MAX_ATTEMPTS = 5;

    const connect = (attempt = 0) => {
      if (attempt >= MAX_ATTEMPTS) return; // servidor sem WS (ex: GitHub Pages)
      try {
        this.wsConn = new WebSocket(wsUrl);

        this.wsConn.onopen = () => {
          this.wsConnected = true;
          this.wsConn.send(JSON.stringify({ type: 'hello', role: 'controller' }));
          this.updateStatus();
          this.updateSendButton();
        };

        this.wsConn.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'receivers') {
              this.wsReceiverCount = msg.count;
              this.updateStatus();
              this.updateSendButton();
            }
          } catch {}
        };

        this.wsConn.onopen = (orig => function () {
          orig.call(this);
          // reset attempt counter on successful open
        })(this.wsConn.onopen);

        this.wsConn.onclose = () => {
          const wasConnected = this.wsConnected;
          this.wsConnected = false;
          this.wsReceiverCount = 0;
          this.updateStatus();
          this.updateSendButton();
          // Reconectar com backoff exponencial só se já tinha conectado antes
          const delay = wasConnected ? 3000 : Math.min(30000, 1000 * 2 ** attempt);
          setTimeout(() => connect(wasConnected ? 0 : attempt + 1), delay);
        };
      } catch {}
    };

    connect();
  }

  async loadReceiverUrl() {
    if (!this.els.receiverUrl) return;
    try {
      const res = await fetch('/api/info');
      const { ip, port } = await res.json();
      const url = `http://${ip}:${port}/receiver.html`;
      this.els.receiverUrl.textContent = url;
      this.els.receiverUrl.href = url;
    } catch {
      const url = `${window.location.origin}/receiver.html`;
      this.els.receiverUrl.textContent = url;
      this.els.receiverUrl.href = url;
    }
  }

  // --- Presentation API transport ---

  initPresentation() {
    const receiverUrl = new URL('./receiver.html', window.location.href).href;
    this.presentationRequest = new PresentationRequest([receiverUrl]);

    this.presentationRequest.getAvailability().then((avail) => {
      avail.addEventListener('change', () => this.updateStatus());
    }).catch(() => {});

    this.presentationRequest.addEventListener('connectionavailable', (e) => {
      this.attachPresentationConnection(e.connection);
    });
  }

  async startPresentation() {
    if (!this.presentationRequest) return;
    this.els.btnStart.disabled = true;

    try {
      const conn = await this.presentationRequest.start();
      this.attachPresentationConnection(conn);
    } catch (err) {
      if (err.name !== 'AbortError') {
        this.showToast('Falha ao conectar à tela. Tente novamente.', 'error');
      }
      this.els.btnStart.disabled = false;
    }
  }

  stopPresentation() {
    if (this.presentationConn) this.presentationConn.terminate();
  }

  attachPresentationConnection(conn) {
    this.presentationConn = conn;

    const onConnected = () => {
      this.els.btnStart.disabled = true;
      this.els.btnStop.disabled = false;
      this.updateStatus();
      this.updateSendButton();
      if (this.currentImageData) this.sendCurrentImage();
    };

    const onDisconnected = () => {
      this.presentationConn = null;
      this.els.btnStart.disabled = false;
      this.els.btnStop.disabled = true;
      this.updateStatus();
      this.updateSendButton();
    };

    conn.addEventListener('connect', onConnected);
    conn.addEventListener('close', onDisconnected);
    conn.addEventListener('terminate', onDisconnected);

    if (conn.state === 'connected') onConnected();
  }

  // --- Shared ---

  bindEvents() {
    this.els.btnStart.addEventListener('click', () => this.startPresentation());
    this.els.btnStop.addEventListener('click', () => this.stopPresentation());
    this.els.btnSend.addEventListener('click', () => this.sendCurrentImage());
    this.els.btnClear.addEventListener('click', () => this.clearImage());

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

  async handleFileSelect(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.showToast('Selecione uma imagem válida.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.showToast('Imagem muito grande (máx. 10MB).', 'error');
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
    } catch {
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
    if (!this.currentImageData) return;

    const message = JSON.stringify({
      type: 'image',
      data: this.currentImageData,
      name: this.currentFileName,
    });

    let sent = false;

    if (this.presentationConn?.state === 'connected') {
      this.presentationConn.send(message);
      sent = true;
    }

    if (this.wsConnected && this.wsConn?.readyState === WebSocket.OPEN) {
      this.wsConn.send(message);
      sent = true;
    }

    if (sent) this.showToast('Imagem enviada para a tela!', 'success');
    else this.showToast('Nenhuma tela conectada.', 'error');
  }

  updateSendButton() {
    const presentationReady = this.presentationConn?.state === 'connected';
    // WebSocket: enabled when connected to server (receiver.html pode estar aberta na TV)
    const wsReady = this.wsConnected;
    this.els.btnSend.disabled = !this.currentImageData || (!presentationReady && !wsReady);
  }

  updateStatus() {
    const presentationReady = this.presentationConn?.state === 'connected';

    if (presentationReady) {
      this.setStatus('connected', 'Tela conectada');
      return;
    }
    if (this.wsReceiverCount > 0) {
      this.setStatus('connected', `${this.wsReceiverCount} receptor${this.wsReceiverCount > 1 ? 'es' : ''} via rede`);
      return;
    }
    if (this.wsConnected) {
      this.setStatus('idle', 'Servidor ativo');
      return;
    }
    this.setStatus('idle', 'Desconectado');
  }

  setStatus(state, label) {
    this.els.statusBadge.className = 'status-badge ' + state;
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
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new AVController());
