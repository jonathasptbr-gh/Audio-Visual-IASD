const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const os = require('os');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/receiver', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'receiver.html'));
});

app.get('/api/info', (req, res) => {
  res.json({ ip: getLocalIP(), port: PORT });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Map: ws -> { role: 'controller' | 'receiver' | 'unknown' }
const clients = new Map();

function broadcastReceiverCount() {
  const count = Array.from(clients.values()).filter((c) => c.role === 'receiver').length;
  clients.forEach((info, client) => {
    if (info.role === 'controller' && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'receivers', count }));
    }
  });
}

wss.on('connection', (ws) => {
  clients.set(ws, { role: 'unknown' });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'hello') {
        clients.get(ws).role = msg.role;
        if (msg.role === 'receiver') broadcastReceiverCount();
        return;
      }

      // Controller sends image → broadcast to all receivers
      if (msg.type === 'image' && clients.get(ws).role === 'controller') {
        const raw = data.toString();
        clients.forEach((info, client) => {
          if (info.role === 'receiver' && client.readyState === WebSocket.OPEN) {
            client.send(raw);
          }
        });
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    const wasReceiver = clients.get(ws)?.role === 'receiver';
    clients.delete(ws);
    if (wasReceiver) broadcastReceiverCount();
  });
});

function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('\n=== IASD AV — Projeção ===');
  console.log(`Local:          http://localhost:${PORT}`);
  console.log(`Rede local:     http://${ip}:${PORT}`);
  console.log(`Receptor (TV):  http://${ip}:${PORT}/receiver.html`);
  console.log('');
  console.log('Abra o controlador no celular pelo IP da rede local acima.');
  console.log('');
});
