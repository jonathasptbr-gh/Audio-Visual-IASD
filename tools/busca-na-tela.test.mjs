#!/usr/bin/env node
// A BUSCA NO VÍDEO DE UMA TELA DA REDE (v1.13.11).
//
// Relato do operador: *"ao tentar escolher o momento de um vídeo… deslizando a
// barra de progresso… o vídeo no computador conectado via navegador apenas
// reinicia, mas não pula realmente para o ponto"*.
//
// A causa é do CHROMIUM, e foi MEDIDA: enquanto o empurrão do Controle anda, a
// rota `/m/<token>` entrega a mídia em chunked, sem faixa (`EspelhoServidor.
// servirMidia`), e o `<video>` marca a fonte como NÃO BUSCÁVEL (`seekable`
// vazio) pela vida daquela URL. O seek é ignorado mesmo depois de o item ficar
// completo e o servidor passar a responder 206 — o elemento nunca mais pergunta.
// O conserto é do `stage.js` (`precisaRecarregar`/`recarregarNoPonto`): um seek
// fora do `seekable` numa fonte de REDE pede a mesma mídia por uma URL nova e
// entra no ponto.
//
// O servidor daqui imita os dois estados do de verdade: `crescendo` = 200 sem
// `Accept-Ranges` (o chunked do item em crescimento); depois, RFC 7233 com 206.
//
//   node tools/busca-na-tela.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { abrirNavegador, servirEstatico, RAIZ_WEB, checar, falhas, esperar, porque } from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = fs.readFileSync(path.join(AQUI, 'fixtures', 'video-20s.mp4'));

let crescendo = true;
const pedidos = [];
const srv = servirEstatico(RAIZ_WEB, (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/teste.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><div id="w"></div><img id="i" hidden>
      <video id="v" playsinline muted hidden></video><script src="/shared/stage.js"></script>`);
    return true;
  }
  if (u.pathname !== '/m/x') return false;
  pedidos.push({ url: req.url, range: req.headers.range || '', crescendo });
  if (crescendo) {
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Cache-Control': 'no-store' });
    res.end(VIDEO);
    return true;
  }
  const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
  if (!m) {
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': VIDEO.length, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
    res.end(VIDEO);
    return true;
  }
  const ini = +m[1], fim = m[2] ? Math.min(+m[2], VIDEO.length - 1) : VIDEO.length - 1;
  res.writeHead(206, {
    'Content-Type': 'video/mp4', 'Content-Length': fim - ini + 1, 'Accept-Ranges': 'bytes',
    'Content-Range': `bytes ${ini}-${fim}/${VIDEO.length}`, 'Cache-Control': 'no-store',
  });
  res.end(VIDEO.subarray(ini, fim + 1));
  return true;
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}`;

const navegador = await abrirNavegador();
const ctx = await navegador.newContext();
await semRedeExterna(ctx);
const pg = await ctx.newPage();

try {
  await pg.goto(BASE + '/teste.html');
  await pg.evaluate((url) => {
    window.AVDB = { getMedia: async (id) => ({ id, kind: 'video', name: id, url }) };
    window.__v = document.getElementById('v');
    window.__stage = window.createStage({ wallpaper: document.getElementById('w'), img: document.getElementById('i'), video: window.__v });
    window.__stage.load('x', 'visual', true, 1);
  }, BASE + '/m/x');
  let r = await esperar(pg, () => window.__v.readyState >= 1 && window.__v.currentTime > 0.3);
  checar(r === true, 'A · a mídia da rede carregou e está tocando', porque(r));

  // O item ficou COMPLETO no servidor — o caso do relato: o operador arrasta a
  // barra minutos depois, com o arquivo inteiro já no celular.
  crescendo = false;
  const antes = await pg.evaluate(() => {
    const s = window.__v.seekable;
    return [...Array(s.length)].map((_, i) => [s.start(i), s.end(i)]);
  });
  checar(!antes.some(([a, b]) => a <= 15 && b >= 15),
    'B · premissa: a fonte entregue sem faixa NÃO é buscável até 15 s para o Chromium', antes);
  await pg.evaluate(() => window.__stage.seek(15));
  r = await esperar(pg, () => window.__v.currentTime >= 14.9, null, 8000);
  checar(r === true, 'C · o seek leva o vídeo ao ponto pedido (15 s), e não o deixa no começo',
    porque(r) || await pg.evaluate(() => window.__v.currentTime));
  const recarga = pedidos.filter((p) => !p.crescendo);
  checar(recarga.length >= 1 && /[?&]r=\d+/.test(recarga[0].url),
    'C · ele chegou lá pedindo a MESMA mídia por uma URL nova (o Chromium não pergunta de novo à antiga)', pedidos);
  const tocando = await pg.evaluate(() => !window.__v.paused);
  checar(tocando, 'C · e continua tocando depois da busca', tocando);

  // O PAR: com a fonte já buscável, o seek é o de sempre — nenhum pedido novo.
  const n = pedidos.length;
  await pg.evaluate(() => window.__stage.seek(3));
  r = await esperar(pg, () => window.__v.currentTime >= 2.9 && window.__v.currentTime < 8, null, 8000);
  checar(r === true, 'D · numa fonte buscável o seek vai direto ao ponto', porque(r));
  const novos = pedidos.slice(n).filter((p) => /[?&]r=/.test(p.url) && p.url !== recarga[recarga.length - 1].url);
  checar(novos.length === 0, 'D · e NÃO recarrega a fonte (a recarga é só para a fonte que não se deixa buscar)', pedidos.slice(n));
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

await navegador.close();
srv.close();
if (falhas.length) {
  console.log(`\n${falhas.length} falha(s).`);
  process.exit(1);
}
console.log('\nTodos passaram.');
