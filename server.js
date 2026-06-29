const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const ROOT_PREFIX = ROOT + path.sep;

// Proxy para arquivos de áudio do hinário LouvorJA.
// Adiciona Api-Token server-side para evitar CORS preflight no browser.
function proxyLouvorja(req, res, remotePath) {
  const options = {
    hostname: 'api.louvorja.com.br',
    path: remotePath,
    method: 'GET',
    headers: {
      'Api-Token': '02@v2nFB2Dc',
      'User-Agent': 'Mozilla/5.0',
      'Accept': '*/*',
    },
  };
  if (req.headers['range']) options.headers['Range'] = req.headers['range'];
  const proxyReq = https.request(options, (proxyRes) => {
    const fwd = { 'Access-Control-Allow-Origin': '*' };
    ['content-type', 'content-length', 'content-range', 'accept-ranges'].forEach(
      (h) => { if (proxyRes.headers[h]) fwd[h] = proxyRes.headers[h]; }
    );
    res.writeHead(proxyRes.statusCode, fwd);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', () => { res.writeHead(502); res.end('Proxy error'); });
  proxyReq.end();
}

const server = http.createServer((req, res) => {
  // Proxy para áudio do hinário (apenas localhost; produção usa GitHub Pages sem server)
  if (req.method === 'GET' && req.url.startsWith('/louvorja-proxy/')) {
    proxyLouvorja(req, res, req.url.slice('/louvorja-proxy'.length));
    return;
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('URL inválida');
    return;
  }
  let filePath = path.join(ROOT, urlPath);

  // Sem extensão => trata como diretório e serve o index.html dele.
  if (!path.extname(filePath)) filePath = path.join(filePath, 'index.html');

  // Bloqueia path traversal (inclui separador para evitar match em diretório irmão tipo "public-x").
  if (!filePath.startsWith(ROOT_PREFIX)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Proibido');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Nao encontrado');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    // Service workers nao devem ficar presos em cache do navegador.
    if (filePath.endsWith('sw.js')) headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
