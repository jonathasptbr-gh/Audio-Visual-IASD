class AVReceiver {
  constructor() {
    this.els = {
      waitingScreen: document.getElementById('waiting-screen'),
      displayScreen: document.getElementById('display-screen'),
      displayImage: document.getElementById('display-image'),
      overlay: document.getElementById('transition-overlay'),
      connIndicator: document.getElementById('conn-indicator'),
      connLabel: document.getElementById('conn-label'),
    };

    this.init();
  }

  async init() {
    this.initWebSocket();

    if (navigator.presentation?.receiver) {
      this.initPresentationReceiver();
    }
  }

  // --- WebSocket transport (always active as fallback) ---

  initWebSocket() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}`;

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'hello', role: 'receiver' }));
          this.showConnectionIndicator('via rede local');
        };

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            this.handleMessage(msg);
          } catch {}
        };

        ws.onclose = () => setTimeout(connect, 3000);
      } catch {}
    };

    connect();
  }

  // --- Presentation API transport ---

  async initPresentationReceiver() {
    try {
      const connectionList = await navigator.presentation.receiver.connectionList;
      connectionList.connections.forEach((c) => this.handlePresentationConnection(c));
      connectionList.addEventListener('connectionavailable', (e) => {
        this.handlePresentationConnection(e.connection);
      });
    } catch (err) {
      console.error('Receiver init error:', err);
    }
  }

  handlePresentationConnection(connection) {
    this.showConnectionIndicator('via Presentation API');

    connection.addEventListener('message', (e) => {
      try {
        const msg = JSON.parse(e.data);
        this.handleMessage(msg);
      } catch {}
    });

    connection.addEventListener('close', () => this.onPresentationDisconnect());
    connection.addEventListener('terminate', () => this.onPresentationDisconnect());
  }

  onPresentationDisconnect() {
    // WebSocket still active, don't hide indicator
  }

  // --- Shared message handler ---

  handleMessage(msg) {
    if (msg.type === 'image') {
      this.showImage(msg.data);
    }
  }

  showImage(src) {
    this.els.overlay.classList.add('active');

    setTimeout(() => {
      this.els.displayImage.src = src;
      this.els.displayImage.onload = () => {
        this.els.waitingScreen.classList.add('hidden');
        this.els.displayScreen.classList.add('visible');
        this.els.overlay.classList.remove('active');
      };
    }, 250);
  }

  showConnectionIndicator(label) {
    if (this.els.connLabel) this.els.connLabel.textContent = label;
    this.els.connIndicator.style.display = 'flex';
    clearTimeout(this._fadeTimer);
    this._fadeTimer = setTimeout(() => {
      this.els.connIndicator.classList.add('fade');
    }, 4000);
  }
}

document.addEventListener('DOMContentLoaded', () => new AVReceiver());
