// A TELA DA REDE num Chromium DE VERDADE — o papel `tela` do telão por
// comandos (docs/TELAO-POR-COMANDOS.md, E3).
//
// O que este arquivo prova, e por que cada asserção existe:
//
//  1. A ENTRADA gasta o gesto: código errado tem frase, código certo abre o
//     SSE e esconde o overlay — e o display-ready da tela sobe pelo dreno,
//     que é o que faz o Controle reenviar a cena (v5.140).
//  2. O TEXTO chega INTACTO: um versículo com acento atravessa o SSE e
//     aparece no DOM — o caminho de comandos não passa por saneamento nenhum
//     (spec §5.2; o sanear() do Kotlin é do Registro e apagaria acentos).
//  3. A CORREÇÃO DE RELÓGIO anula um desvio de 90 s: o cronômetro viaja por
//     DESCRITOR ancorado em Date.now() do celular, e uma tela com o relógio
//     fora contaria errado na frente de todo mundo. O servidor de mentira
//     mente o relógio de propósito e o teste exige a leitura certa.
//  4. O DRENO DE SUBIDA é lista de permissão: diag-ask chega, o display
//     responde diag-dump, e NADA disso sobe — só display-ready e tela-status.
//     (São os N-telas-emitindo que o dreno do papel espelho já calava, na
//     direção oposta.)
//  5. A RECONEXÃO se reapresenta: fluxo derrubado → novo GET /e → NOVO
//     display-ready (sem ele, a tela reconectada ficaria no wallpaper até o
//     operador tocar em algo).
//  6. O ADEUS não é sentença nem martelo: o overlay volta com a frase do
//     operador e NENHUM GET /e novo sai (o código rotaciona a cada ligar —
//     martelar a porta seria inútil e barulhento).
//  7. O BroadcastChannel está neutralizado NO ENVIO: duas abas no mesmo PC
//     não podem se contaminar.
//
//   PW_CHROMIUM=<caminho> node tools/tela-rede.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + obtido : '')); falhas.push(msg); }
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
// `fn` pode devolver Promise (todo pg.$eval devolve) — e uma Promise é truthy:
// sem o await, o poll "passaria" na primeira volta sem olhar o valor. Foi
// exatamente o defeito da primeira versão deste arquivo.
async function ate(fn, ms = 4000, passo = 50) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await fn()) return true; await espera(passo); }
  return await fn();
}

// ---------------------------------------------------------------------------
// O SERVIDOR DE MENTIRA — o contrato da spec §5, e nada além dele.
//
// O RELÓGIO DELE MENTE DE PROPÓSITO: DESVIO_MS à frente do relógio desta
// máquina. É o cenário da Smart TV com o relógio fora — e é exatamente o que
// a correção de relógio do tela.js existe para anular.
// ---------------------------------------------------------------------------
const TOKEN = 'dGVsYS1kZS1jb21hbmRvcy10';
const DESVIO_MS = 90_000;
const agoraDoCelular = () => Date.now() + DESVIO_MS;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const PREFIXOS = { '/display/': 'display', '/shared/': 'shared', '/espelho/': 'espelho' };

let lotado = false;
const visto = { volta: [], gets: 0, pares: [] };
let sse = null;             // a resposta do GET /e em curso
let aoAbrirSse = null;

function json(res, status, obj) {
  const b = Buffer.from(JSON.stringify(obj || {}));
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': b.length, 'Cache-Control': 'no-store' });
  res.end(b);
}
function corpoDe(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => { s += c; });
    req.on('end', () => { try { resolve(JSON.parse(s)); } catch (_) { resolve(null); } });
  });
}

const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');

  for (const [pre, dir] of Object.entries(PREFIXOS)) {
    if (req.method === 'GET' && u.pathname.startsWith(pre)) {
      const alvo = path.join(WEB, dir, u.pathname.slice(pre.length));
      if (!alvo.startsWith(path.join(WEB, dir)) || !fs.existsSync(alvo)) { json(res, 404, {}); return; }
      const b = fs.readFileSync(alvo);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(alvo)] || 'application/octet-stream', 'Content-Length': b.length, 'Cache-Control': 'no-store' });
      res.end(b);
      return;
    }
  }

  if (req.method === 'POST' && u.pathname === '/par') {
    const c = await corpoDe(req);
    visto.pares.push(c);
    // SEM CÓDIGO (v5.189): a porta é o endereço. O servidor de mentira só
    // recusa quando o teste pede que ele recuse (`lotado`), para o caminho da
    // frase continuar coberto.
    if (lotado) { json(res, 403, { estado: 'lotado' }); return; }
    json(res, 200, { t: TOKEN });
    return;
  }

  if (req.method === 'GET' && u.pathname === '/e') {
    if (req.headers.authorization !== 'Bearer ' + TOKEN) { json(res, 404, {}); return; }
    visto.gets++;
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'close' });
    res.write('data: ' + JSON.stringify({ m: 'oi', ms: agoraDoCelular() }) + '\n\n');
    sse = res;
    if (aoAbrirSse) { const f = aoAbrirSse; aoAbrirSse = null; f(res); }
    return;
  }

  if (req.method === 'GET' && u.pathname.startsWith('/m/')) {
    // Um PNG de 1×1 — o bastante para provar que a tela busca a mídia na URL
    // servida pelo celular (o resto do Range é provado por JUnit no shell).
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64');
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length, 'Accept-Ranges': 'bytes' });
    res.end(png);
    return;
  }

  if (req.method === 'POST' && u.pathname === '/r') {
    if (req.headers.authorization !== 'Bearer ' + TOKEN) { json(res, 404, {}); return; }
    visto.volta.push(await corpoDe(req));
    json(res, 200, {});
    return;
  }

  json(res, 404, {});
});

function evento(obj) { if (sse) sse.write('data: ' + JSON.stringify(obj) + '\n\n'); }
function ping() { if (sse) sse.write(': ping ' + agoraDoCelular() + '\n\n'); }
const sts = () => visto.volta.filter((c) => c && c.do === 'st').map((c) => c.st);

await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;

const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
const pg = await ctx.newPage();
const errosConsole = [];
pg.on('console', (m) => {
  const t = m.text();
  if (m.type() !== 'error') return;
  if (/Failed to load resource/.test(t)) return;
  errosConsole.push(t);
});

// ---------------------------------------------------------------------------
// 1. A entrada
// ---------------------------------------------------------------------------
await pg.goto(base + '/display/index.html?tela=1');
await pg.waitForSelector('#telaEntrada', { state: 'visible' });
checar(true, 'o overlay de entrada aparece por cima do display');
checar(await pg.$eval('#startBtn', (e) => e.hidden),
  'e o "Ligar Sistema" do display está escondido — um overlay de gesto só');

// LOTADO tem FRASE, não silêncio — e o overlay CONTINUA de pé, porque não há
// nada por baixo dele para proteger.
lotado = true;
await pg.click('#telaEntrar');
await ate(() => visto.pares.length >= 1);
checar(/limite de telas/i.test(await pg.$eval('#telaMsg', (e) => e.textContent)),
  'lotado tem frase, não silêncio');
checar(await pg.$eval('#telaEntrada', (e) => e.style.display !== 'none'),
  'e o overlay fica de pé — não há nada por baixo para ele cobrir');
checar(!visto.pares.some((c) => c && 'codigo' in c),
  'o pedido de entrada NÃO manda código nenhum — a porta é o endereço (v5.189)');

lotado = false;
await pg.click('#telaEntrar');
await ate(() => visto.gets >= 1, 5000);
checar(visto.gets >= 1, 'o toque em "Ativar esta tela" abre o SSE');
await ate(() => pg.$eval('#telaEntrada', (e) => e.style.display === 'none').catch(() => false), 4000);
checar(await pg.$eval('#telaEntrada', (e) => e.style.display === 'none'),
  'e o overlay some');

// O token nunca em URL — a regra de sempre, no transporte novo.
checar(!visto.pares.some((c) => JSON.stringify(c).includes(TOKEN)),
  'o token não aparece em nenhum corpo de /par');

await ate(() => sts().some((s) => s && s.type === 'display-ready'), 5000);
const pronto = sts().find((s) => s && s.type === 'display-ready');
checar(!!pronto, 'o display-ready da tela SOBE pelo dreno (é ele que traz a cena de volta)');
checar(!!(pronto && pronto.__de), 'e carrega o __de que endereça a resposta', JSON.stringify(pronto));

// ---------------------------------------------------------------------------
// 2. Texto intacto, com acento
// ---------------------------------------------------------------------------
evento({ type: 'text', mode: 'verse', main: 'Porque Deus amou o mundo de tal maneira…', sub: 'João 3:16', view: 'visual', __mid: 'm:1' });
await ate(() => pg.$eval('#textMain', (e) => e.textContent.includes('maneira…')).catch(() => false), 4000);
checar(await pg.$eval('#textMain', (e) => e.textContent.includes('Porque Deus amou o mundo de tal maneira…')),
  'o versículo atravessa o SSE INTACTO — acento e reticências incluídos');
checar(await pg.$eval('#textSub', (e) => e.textContent.includes('João 3:16')),
  'com a referência');

// ---------------------------------------------------------------------------
// 3. A correção de relógio — o cronômetro conta certo com o relógio 90 s fora
// ---------------------------------------------------------------------------
evento({ type: 'text', mode: 'chrono', view: 'visual', chrono: { mode: 'stopwatch', running: true, startAt: agoraDoCelular(), baseMs: 0 }, __mid: 'm:2' });
await espera(1200);
{
  const lido = await pg.$eval('#textMain', (e) => e.textContent.trim());
  const m = lido.match(/(\d+):(\d{2})/);
  const segundos = m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : NaN;
  checar(m !== null && segundos <= 5,
    'o cronômetro lê ~0 s — o desvio de 90 s do relógio da tela foi ANULADO', lido);
}

// ---------------------------------------------------------------------------
// 4. Sorteio, cortina e text-hide
// ---------------------------------------------------------------------------
evento({ type: 'text', mode: 'draw', view: 'visual', draw: { kind: 'number', value: 7, min: 1, max: 10 }, __mid: 'm:3' });
await ate(() => pg.$eval('#textMain', (e) => e.textContent.trim() === '7').catch(() => false), 4000);
checar(await pg.$eval('#textMain', (e) => e.textContent.trim() === '7'), 'o sorteio desenha o número');

evento({ type: 'text-hide', __mid: 'm:4' });
await ate(() => pg.$eval('#text', (e) => e.hidden).catch(() => false), 4000);
checar(await pg.$eval('#text', (e) => e.hidden), 'text-hide tira a Camada de Texto de cena');

// ---------------------------------------------------------------------------
// 5. O dreno de subida é lista de PERMISSÃO
// ---------------------------------------------------------------------------
{
  const antes = visto.volta.length;
  evento({ type: 'diag-ask', __mid: 'm:5' });
  await espera(800);
  const novos = visto.volta.slice(antes).filter((c) => c && c.do === 'st');
  checar(!novos.some((c) => c.st && c.st.type === 'diag-dump'),
    'diag-ask chega, o display responde, e o diag-dump MORRE no dreno');
  const tipos = new Set(sts().map((s) => s && s.type));
  for (const t of tipos) {
    checar(t === 'display-ready' || t === 'tela-status',
      'só display-ready e tela-status sobem — subiu: ' + t);
  }
}

// ---------------------------------------------------------------------------
// 5b. A MÍDIA da E4: o __rec aponta para /m/ e a tela busca DO CELULAR
// ---------------------------------------------------------------------------
{
  evento({
    type: 'load', mediaId: 'img1', view: 'visual', muted: true, volume: 1,
    __rec: { id: 'img1', kind: 'image', name: 'Cartaz', type: 'image/png', url: '/m/tokimg111111111111111' },
    __mid: 'm:6',
  });
  await ate(() => pg.$eval('#img', (e) => !e.hidden && e.src.includes('/m/')).catch(() => false), 5000);
  checar(await pg.$eval('#img', (e) => !e.hidden && e.src.includes('/m/tokimg111111111111111')),
    'o load com __rec toca a mídia da URL /m/ — sem IDB, sem OPFS, do celular');
}

// ---------------------------------------------------------------------------
// 5c. O wallpaper por URL e o aviso de cena-sem-rede
// ---------------------------------------------------------------------------
{
  evento({ type: 'wallpaper', __wp: '/m/tokwp1111111111111111', __mid: 'm:7' });
  await ate(() => pg.$eval('#wallpaper', (e) => e.style.backgroundImage.includes('/m/')).catch(() => false), 4000);
  checar(await pg.$eval('#wallpaper', (e) => e.style.backgroundImage.includes('/m/tokwp1111111111111111')),
    'o wallpaper vem pela URL do comando — o IDB da tela está vazio e não importa');

  // O sentinela 'padrao' (v5.188): o operador voltou ao wallpaper padrão — a
  // tela desfaz o inline e o desenho do CSS (o símbolo oficial) volta a valer.
  evento({ type: 'wallpaper', __wp: 'padrao', __mid: 'm:7b' });
  await ate(() => pg.$eval('#wallpaper', (e) => e.style.backgroundImage === '').catch(() => false), 4000);
  checar(await pg.$eval('#wallpaper', (e) => e.style.backgroundImage === ''),
    "o sentinela 'padrao' devolve o desenho padrão — sem ele a tela ficaria presa na última imagem");

  // A LETRA COM FUNDO (v5.188): o __rec leva `imageUrl` por estrofe (a URL /m/
  // da imagem empurrada) e ele tem de SOBREVIVER ao cache do acervo da tela —
  // é dali que display.js/stage.js releem o registro.
  evento({
    type: 'load', mediaId: 'hino2', muted: true,
    __rec: {
      id: 'hino2', kind: 'audio', name: 'Hino', type: 'audio/mp4', url: '/m/tokhin111111111111111',
      lyrics: [{ time: 0, text: 'Estrofe 1', imageUrl: '/m/tokly1111111111111111' }],
    },
    __mid: 'm:7c',
  });
  await ate(() => pg.evaluate(() => window.AVDB.getMedia('hino2').then((r) => !!r)).catch(() => false), 4000);
  const recLetra = await pg.evaluate(() => window.AVDB.getMedia('hino2'));
  checar(recLetra && recLetra.lyrics && recLetra.lyrics[0].imageUrl === '/m/tokly1111111111111111',
    'o imageUrl da estrofe atravessa o __rec e o getMedia embrulhado — é dele que o fundo da letra sai');

  evento({ type: 'tela-aviso', texto: 'Esta cena não aparece nas telas da rede.', __mid: 'm:8' });
  await ate(() => pg.$eval('#telaAviso', (e) => e.textContent.includes('não aparece')).catch(() => false), 4000);
  checar(await pg.$eval('#telaAviso', (e) => e.textContent.includes('não aparece')),
    'a cena que não vai para a rede é DITA, nunca uma tela vazia sem explicação');
}

// ---------------------------------------------------------------------------
// 6. Reconexão: o fluxo cai e a tela SE REAPRESENTA
// ---------------------------------------------------------------------------
{
  const getsAntes = visto.gets;
  const prontosAntes = sts().filter((s) => s && s.type === 'display-ready').length;
  sse.end();
  sse = null;
  await ate(() => visto.gets > getsAntes, 6000);
  checar(visto.gets > getsAntes, 'o fluxo derrubado reconecta sozinho');
  await ate(() => sts().filter((s) => s && s.type === 'display-ready').length > prontosAntes, 5000);
  checar(sts().filter((s) => s && s.type === 'display-ready').length > prontosAntes,
    'e a tela REANUNCIA o display-ready — sem ele, a cena não voltaria');
}

// ---------------------------------------------------------------------------
// 7. O adeus
// ---------------------------------------------------------------------------
{
  // A TELA NUNCA MAIS É COBERTA depois de ativada (v5.189). O `adeus` do
  // operador tira o FIO, não a mídia: o `<video>` toca um arquivo local
  // (`/m/`) e a letra anda pelo `timeupdate` dele. Um overlay aqui apagaria
  // uma projeção que continua perfeitamente viva.
  const paresAntes = visto.pares.length;
  const getsAntes = visto.gets;
  lotado = true;                 // o celular não devolve token: transmissão desligada
  evento({ m: 'adeus' });
  await espera(2500);
  checar(await pg.$eval('#telaEntrada', (e) => e.style.display === 'none'),
    'depois do adeus o overlay NÃO volta — a mídia em cena não pode ser coberta');
  checar(visto.gets === getsAntes,
    'e NENHUM GET /e novo sai — nada de martelar uma porta fechada');
  // A reentrada é silenciosa e ESPAÇADA (1 s, 3 s, 8 s…): ela existe para a
  // tela voltar sozinha quando o operador religar, sem ninguém atravessar o
  // salão — e não pode virar uma martelada.
  const tentativas = visto.pares.length - paresAntes;
  checar(tentativas >= 1 && tentativas <= 3,
    'a reentrada tenta sozinha, mas espaçada (' + tentativas + ' pedido(s) em 2,5 s)');
  lotado = false;
}

// ---------------------------------------------------------------------------
// 8. O BroadcastChannel está neutralizado no envio
// ---------------------------------------------------------------------------
{
  const vazou = await pg.evaluate(() => new Promise((resolve) => {
    const ouve = new BroadcastChannel('teste-neutro');
    ouve.onmessage = () => resolve(true);
    new BroadcastChannel('teste-neutro').postMessage({ oi: 1 });
    setTimeout(() => resolve(false), 400);
  }));
  checar(vazou === false, 'postMessage do BroadcastChannel é no-op no papel tela');
}

checar(errosConsole.length === 0, 'nenhum erro de console no percurso inteiro',
  errosConsole.join(' | '));

await navegador.close();
servidor.close();
if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
