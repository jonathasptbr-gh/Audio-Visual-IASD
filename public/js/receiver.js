class AVReceiver {
  constructor() {
    this.els = {
      waitingScreen: document.getElementById('waiting-screen'),
      displayScreen: document.getElementById('display-screen'),
      displayImage: document.getElementById('display-image'),
      overlay: document.getElementById('transition-overlay'),
      connIndicator: document.getElementById('conn-indicator'),
    };

    this.init();
  }

  async init() {
    if (!navigator.presentation?.receiver) return;

    try {
      const connectionList = await navigator.presentation.receiver.connectionList;
      connectionList.connections.forEach((c) => this.handleConnection(c));
      connectionList.addEventListener('connectionavailable', (e) => {
        this.handleConnection(e.connection);
      });
    } catch (err) {
      console.error('Receiver init error:', err);
    }
  }

  handleConnection(connection) {
    this.showConnectionIndicator();

    connection.addEventListener('message', (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'image') this.showImage(msg.data);
      } catch {}
    });

    connection.addEventListener('close', () => this.onDisconnect());
    connection.addEventListener('terminate', () => this.onDisconnect());
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

  showConnectionIndicator() {
    this.els.connIndicator.style.display = 'flex';
    clearTimeout(this._fadeTimer);
    this._fadeTimer = setTimeout(() => {
      this.els.connIndicator.classList.add('fade');
    }, 3000);
  }

  onDisconnect() {
    this.els.connIndicator.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => new AVReceiver());
