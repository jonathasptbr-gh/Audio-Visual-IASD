// A SEGUNDA JANELA — o Display fora da `Presentation`.
//
// ## Por que este arquivo existe
//
// MEDIDO neste repositório antes de escrevê-lo: `openWebDisplay` e
// `openDisplayBtn` não apareciam em oráculo nenhum, e `waitForEvent` — a API do
// Playwright para capturar uma janela nova — não era usada em lugar algum de
// `tools/`. Ou seja: **nenhum oráculo jamais abriu uma segunda janela**, e o
// caminho que abre o Display fora do aparelho estava em produção com cobertura
// zero.
//
// Ele não é um caminho secundário. É:
//  - como a base web se desenvolve fora do celular (o único jeito de ver o
//    telão sem uma TV e um dongle);
//  - o que o `simpleDisplay()` já conta como "tela conectada" no navegador
//    (`controle.js`, ramo sem ponte), e portanto o que decide o som local, a
//    cortina do Modo Fácil e o ícone de conexão;
//  - a fundação da casca de Windows, onde as duas janelas são do programa.
//
// ## O que ele mede, e por que cada asserção
//
// Todas as quatro falham CALADAS — nenhuma produz erro de console:
//
//  1. **a janela abre e é o `/display/`** — se o `window.open` parar de
//     funcionar (nome trocado, handler não registrado, popup bloqueado), o
//     toque no botão não faz nada e não há sintoma;
//  2. **o acervo atravessa** — as duas páginas são do MESMO origin, logo
//     dividem IndexedDB. Sem isso o `AVDB.getMedia(cmd.mediaId)` do Display
//     resolve nada e a projeção fica no wallpaper **com o Controle achando que
//     mandou a cena**. É a fundação que o papel `tela` só precisou substituir
//     (por `__rec`) porque lá as duas pontas NÃO compartilham nada;
//  3. **o barramento atravessa** — o `BroadcastChannel` é o único transporte
//     quando não há ponte (o relay nativo é `null`). Um comando que não chega é
//     uma cena que não muda;
//  4. **a janela CONTA como tela conectada, e deixa de contar ao fechar** — é
//     disso que `acertarSaidaDeAudio` depende. Aberta, o som sai dos displays;
//     fechada, volta para este aparelho. O par é o que impede o defeito de
//     ficar preso num dos dois lados.
//
// ## Provado por REVERSÃO (duas, e a segunda é a mais importante)
//
//  1. `simpleDisplay()` devolvendo `null` no ramo de navegador → reprovam as
//     duas asserções da conexão, e o `obtido` mostra `telao: true` ao lado de
//     `simples: false` — isto é, as duas perguntas são caminhos INDEPENDENTES,
//     e o oráculo distingue qual quebrou.
//
//  2. **O `/display/` aberto em `127.0.0.1` em vez de `localhost`** — mesma
//     máquina, mesma porta, mesmos arquivos, só o HOSTNAME diferente → o
//     IndexedDB some e o barramento emudece, enquanto TUDO O MAIS continua
//     verde: a janela abre, carrega o `/display/`, é contada como tela
//     conectada e **não produz um único erro de página**.
//
//     Guarde esta segunda: ela é a demonstração de que *origem diferente* é um
//     defeito COMPLETAMENTE MUDO neste app. É a razão de a origem — host E
//     PORTA — ser tratada como invariante na casca de desktop: "pegar outra
//     porta livre" apagaria a biblioteca do operador sem nada na tela dizendo
//     isso.
//
//   node tools/janela-do-display.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arquivo = path.join(RAIZ, p);
  if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404); res.end('nao'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
});

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg
      + (obtido !== undefined ? '\n        obtido: '
        + (typeof obtido === 'string' ? obtido : JSON.stringify(obtido)) : ''));
    falhas.push(msg);
  }
}

// PRAZO NÃO É VEREDITO. Um `waitForFunction` que estoura diz que o RELÓGIO
// acabou, não que o app errou — e a asserção seguinte, escrita como se falasse
// do app, mentiria. Daí a frase própria (ver "UM ORÁCULO NÃO PODE MEDIR O
// RUNNER", no CLAUDE.md).
async function esperar(pagina, fn, msg, ms = 10000) {
  try { await pagina.waitForFunction(fn, null, { timeout: ms }); return true; }
  catch (_) { checar(false, msg, 'PRAZO de ' + ms + ' ms, não veredito do app'); return false; }
}

await new Promise((r) => servidor.listen(0, r));
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
// Viewport de COMPUTADOR: este caminho é o do operador sentado, e é a forma que
// a casca de Windows vai ter. Nada aqui mede layout — quem faz isso é o
// oráculo do degrau desktop —, mas medir o caminho numa janela de celular
// esconderia um botão que só o desktop alcança.
const ctx = await navegador.newContext({ viewport: { width: 1280, height: 800 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = 'http://localhost:' + servidor.address().port;

const erros = [];
pg.on('pageerror', (e) => erros.push('controle: ' + e.message));

try {
  // SEM `__AVBridge`: o alvo deste oráculo é justamente o caminho de navegador,
  // aquele em que `window.__NATIVE__` é `undefined` e o `#openDisplayBtn` deixa
  // de ser indicador de estado para virar AÇÃO.
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  const dePe = await esperar(
    pg,
    () => window.AVDB && window.createStage && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    'o Controle inicializa no caminho de navegador', 30000,
  );
  if (!dePe) throw new Error('o Controle não subiu');
  checar(true, 'o Controle inicializa no caminho de navegador (sem ponte)');
  checar(await pg.evaluate(() => window.__NATIVE__ === undefined),
    'e ele está mesmo sem ponte — `__NATIVE__` indefinido');

  // O modo avançado é onde o `somLocalDeveEstar()` responde pela CONEXÃO; no
  // Modo Fácil ele depende também do `tocarNoCelular`, que é escolha de ida.
  await pg.evaluate(() => setAppMode('full'));

  // ── 1. A JANELA ABRE, E É O `/display/` ────────────────────────────────
  //
  // `.click()` do DOM para o botão de Configurações (o alvo não é a geometria
  // do cabeçalho), mas CLIQUE DE VERDADE no `#openDisplayBtn`: `window.open`
  // sem ativação transitória é bloqueado pelo Chromium, e um `.click()` do DOM
  // não a concede. Testar por DOM aqui aprovaria um botão que, no navegador de
  // verdade, não abre nada.
  await pg.evaluate(() => document.getElementById('settingsBtn').click());
  await pg.waitForSelector('#fadePopup.open', { timeout: 5000 });
  checar(await pg.isVisible('#openDisplayBtn'),
    'no navegador o botão de abrir o Display é VISÍVEL (no app ele é indicador de estado)');

  const [janela] = await Promise.all([
    pg.waitForEvent('popup', { timeout: 15000 }),
    pg.click('#openDisplayBtn'),
  ]);
  janela.on('pageerror', (e) => erros.push('display: ' + e.message));
  await janela.waitForLoadState('domcontentloaded');
  checar(/\/display\/$|\/display\/index\.html$/.test(new URL(janela.url()).pathname),
    'a segunda janela é o /display/', janela.url());

  const displayDePe = await esperar(
    janela,
    () => window.AVDB && window.createStage && !!document.getElementById('wallpaper'),
    'o Display inicializa na segunda janela', 30000,
  );
  if (displayDePe) checar(true, 'o Display inicializa na segunda janela');

  // ── 2. O ACERVO ATRAVESSA (mesmo origin, mesmo IndexedDB) ──────────────
  //
  // `updateState` e não `setState`: aquele espera o COMMIT (`txDone`), e é o
  // commit que a outra janela precisa enxergar. Com `setState` a promessa
  // resolve na aceitação do request e a leitura do outro lado é uma corrida —
  // exatamente o defeito que o `db-estado.test.mjs` trava noutro contexto.
  const CARIMBO = 'oraculo-janela-' + servidor.address().port;
  await pg.evaluate((v) => window.AVDB.updateState('__oraculo_janela', () => v), CARIMBO);
  const lido = await janela.evaluate(() => window.AVDB.getState('__oraculo_janela'));
  checar(lido === CARIMBO,
    'uma chave gravada no Controle é lida na janela do Display — as duas dividem o IndexedDB',
    lido);

  // ── 3. O BARRAMENTO ATRAVESSA ──────────────────────────────────────────
  //
  // Sem ponte o `__AVBus` é `null` e sobra só o `BroadcastChannel` — que é
  // justamente o transporte original dos dois PWAs. Um ouvinte próprio, e não
  // um efeito de cena: o que se mede aqui é o CANAL, e medir por efeito
  // confundiria "o comando não chegou" com "o motor não reagiu".
  await janela.evaluate(() => {
    window.__oraculoRecebidos = [];
    window.AVDB.onCommand((m) => { window.__oraculoRecebidos.push(m); });
  });
  await pg.evaluate(() => window.AVDB.sendCommand({ type: 'fit', fit: 'contain' }));
  const chegou = await esperar(
    janela,
    () => (window.__oraculoRecebidos || []).some((m) => m && m.type === 'fit'),
    'um comando do Controle chega à janela do Display', 5000,
  );
  if (chegou) checar(true, 'um comando do Controle chega à janela do Display (BroadcastChannel)');

  // ── 4. A JANELA CONTA COMO TELA — E DEIXA DE CONTAR AO FECHAR ──────────
  //
  // O par é o teste. Só a primeira metade aprovaria um app que nunca solta o
  // estado; só a segunda aprovaria um que nunca o assume.
  const comJanela = await pg.evaluate(() => ({
    telao: telaoConectado(),
    simples: !!simpleDisplay(),
    somLocal: somLocalDeveEstar(),
  }));
  checar(comJanela.telao === true && comJanela.simples === true,
    'com a janela aberta o app a conta como tela conectada', comJanela);
  checar(comJanela.somLocal === false,
    'e o som sai dos displays, não deste aparelho', comJanela);

  await janela.close();
  // O `openWebDisplay` descobre o fechamento por RELÓGIO (`closed` não emite
  // evento), a cada 1000 ms — então o prazo aqui precisa caber mais de uma
  // volta. Um prazo curto reprovaria um app que está certo.
  const soltou = await esperar(
    pg,
    () => telaoConectado() === false && !simpleDisplay(),
    'fechar a janela devolve o app ao estado sem tela', 8000,
  );
  if (soltou) {
    checar(true, 'fechar a janela devolve o app ao estado sem tela');
    checar(await pg.evaluate(() => somLocalDeveEstar()) === true,
      'e o som volta para este aparelho');
  }

  checar(erros.length === 0, 'nenhum erro de página nas duas janelas', erros);
} catch (e) {
  checar(false, 'o oráculo chegou ao fim', String(e && e.message || e));
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' reprovação(ões).');
  process.exit(1);
}
console.log('\nTodos passaram.');
