// O BOOT COMO O APP O FAZ — a base web com a PONTE presente.
//
// ## Por que ele existe
//
// O `smoke.mjs` sobe a base web num Chromium sem `__AVBridge`, e isso é
// deliberado: ali se verifica o que vale nos dois contextos. O preço, que
// ninguém tinha cobrado até a v5.195, é que **todo caminho guardado por
// `window.__NATIVE__` nunca é executado por teste nenhum** — e esses caminhos
// são exatamente os que só rodam no aparelho, onde não há console para olhar.
//
// A v5.195 saiu com um `const` lido na CARGA do módulo e declarado 14 mil
// linhas abaixo. A leitura mora dentro de `if (espelhoDisponivel())`, que é
// FALSO num navegador — então o `smoke.mjs` passou verde, o bundle foi para o
// OTA, e o aparelho abriu em PRETO: `ReferenceError` por zona morta temporal,
// `controle.js` abortado, o watchdog do OTA descartando o bundle no lançamento
// seguinte e o app caindo no embutido do APK. Três sintomas em sequência
// (tela preta → tela pela metade → a versão antiga de volta) para uma causa só,
// e nenhum teste tinha como vê-la.
//
// Este arquivo fecha esse buraco pelo caminho mais barato que existe: injeta um
// `__AVBridge` DE MENTIRA antes de a página carregar e pergunta a mesma coisa
// que o watchdog do OTA pergunta — **o app ficou de pé?** (`otaAppIsUp`, em
// `shared/native.js`). Se ficou, o bundle boota no aparelho; se não, ele
// abriria em preto lá.
//
// ## O que ele NÃO é
//
// Não é teste dos recursos nativos: a ponte responde valores vazios e
// plausíveis, não simula Presentation, download, nem servidor. O que se afirma
// aqui é só o boot — que é precisamente o que o watchdog decide, e o que custa
// um culto quando falha.
//
//   node tools/boot-nativo.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
function checar(cond, msg) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg); falhas.push(msg); }
}

// A PONTE DE MENTIRA. A lista de métodos sai de um `grep` em `shared/native.js`
// (todo `B.<nome>(`) — um método novo lá que este arquivo não conheça responde
// `undefined`, que é o mesmo que um shell antigo faria, e o `try` do
// `native.js` já trata. O contrato do lado Kotlin é assíncrono por `callId`:
// quem chama espera `window.__avResolve(id, json)`, então os métodos com
// `callId` resolvem sozinhos no próximo tique.
const ponteCom = (espelho, telas) => `(() => {
  const vazio = { displays: ${JSON.stringify(telas || [])}, listFolder: [], pickDoc: [], ytSearch: [],
    espelhoEstado: ${JSON.stringify(espelho)}, espelhoDiag: {},
    espelhoCertEstado: { temCert: false }, castTarget: { label: 'Tela de teste' } };
  const comCallId = new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','requestMic','castTarget',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','espelhoCertImportar','espelhoCertApagar',
    'apkProcurar','apkInstalar','otaPending','otaApply','otaCheck','otaDiag','ytDiag']);
  const B = {
    shellVersion: () => 39,
    role: () => 'controle',
    appVersion: () => '1.90-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','castTarget',
    'deckDiscard','deckExportUrl','deckPages','displays','espelhoAprovar','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply',
    'otaCheck','otaDiag','otaPending','pickDoc','pickFolder','requestMic','systemVolume',
    'temaClaro','ytCancel','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio','ytSearch',
    'ytStream'];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      if (!comCallId.has(n)) return undefined;
      // O primeiro argumento é o \`callId\` nas chamadas com Promise.
      const id = args[0];
      if (typeof id === 'string') {
        const v = Object.prototype.hasOwnProperty.call(vazio, n) ? vazio[n] : null;
        setTimeout(() => { try { window.__avResolve(id, v); } catch (_) {} }, 0);
      }
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

// O DESLIGADO é o estado de partida; o segundo cenário é o do OPERADOR.
const PONTE = ponteCom({ ligado: false, telas: [] }, []);

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
const pg = await ctx.newPage();
const base = `http://localhost:${porta}`;

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;
pg.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
  erros.push(t);
});
pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });

  checar(await pg.evaluate(() => window.__NATIVE__ === true),
    'a base entra em MODO APP (a ponte foi vista)');
  checar(await pg.evaluate(() => (window.__SHELL_VERSION__ | 0) >= 32),
    'e enxerga um shell que tem o espelho — é este ramo que o navegador nunca executa');

  // A MESMA PERGUNTA DO WATCHDOG. `otaAppIsUp` é o que decide, no aparelho, se
  // um bundle baixado é carimbado como bom ou descartado no lançamento
  // seguinte: papel `controle`, os três módulos compartilhados, o `__avBack` do
  // fim do `controle.js` e um `<li>` na playlist (que só existe depois de o
  // `init()` assíncrono terminar). Reusá-la é não inventar um segundo critério
  // que envelheceria à parte do primeiro.
  let deuPe = false;
  try {
    await pg.waitForFunction(
      () => window.AVDB && window.AVStream && window.createStage
        && typeof window.__avBack === 'function'
        && !!document.querySelector('#playlist li'),
      null, { timeout: 25000 },
    );
    deuPe = true;
  } catch (_) { deuPe = false; }
  checar(deuPe, 'O APP FICOU DE PÉ com a ponte presente (o critério do watchdog do OTA)');

  // E o bloco de conexão do Modo Fácil, que é o caminho que a v5.195 quebrou:
  // com shell >= 32 ele mostra as DUAS formas de conectar, não só o espelhar.
  const conn = await pg.evaluate(() => {
    const c = document.getElementById('castConn');
    const rede = document.getElementById('castNetRow');
    return {
      achou: !!c,
      pai: c && c.parentElement ? (c.parentElement.id || c.parentElement.className) : '',
      redeVisivel: !!rede && !rede.hidden,
      preso: document.getElementById('simpleMode').classList.contains('locked'),
    };
  });
  checar(conn.achou && conn.preso && conn.pai === 'simpleConn',
    'o bloco de conexão está NA TELA do Modo Fácil bloqueado (pai: ' + conn.pai + ')');
  checar(conn.redeVisivel,
    'e ele oferece as DUAS formas — espelhar para a TV e transmitir para navegador');

  // ---- O ESTADO EM QUE O OPERADOR DE FATO OPERA -------------------------
  //
  // Transmissão LIGADA, telas na rede recebendo, e NENHUMA TV. É a
  // configuração normal desta igreja desde a v5.187 (sem TV, as telas da rede
  // SÃO a projeção) — e é uma combinação que o primeiro percurso não cobre: lá
  // o espelho nasce desligado, então metade do `renderCast`, o
  // `acertarEnqueteDeFundo` e o caminho DESTRAVADO do Modo Fácil nunca correm.
  //
  // Uma página NOVA, e não um `mirrorEstado = …` na de cima: o que se quer
  // provar é que o bundle SOBE assim, com o estado presente desde o primeiro
  // instante — que é como o aparelho o encontra ao abrir com a transmissão já
  // no ar. Mexer no estado de uma página já de pé provaria outra coisa.
  const pg2 = await ctx.newPage();
  const erros2 = [];
  pg2.on('pageerror', (e) => erros2.push('pageerror: ' + e.message));
  pg2.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros2.push(t);
  });
  await pg2.addInitScript(ponteCom(
    { ligado: true, endereco: 'http://192.168.0.14:8787',
      telas: [{ rotulo: 'tela A', conectadaMs: 90000, pronta: true }] },
    [],
  ));
  await pg2.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  let deuPe2 = false;
  try {
    await pg2.waitForFunction(
      () => window.AVDB && window.AVStream && window.createStage
        && typeof window.__avBack === 'function'
        && !!document.querySelector('#playlist li'),
      null, { timeout: 25000 },
    );
    deuPe2 = true;
  } catch (_) { deuPe2 = false; }
  checar(deuPe2, 'O APP FICA DE PÉ com a transmissão JÁ LIGADA e telas na rede');

  // E o bloqueio do Modo Fácil tem de estar ABERTO: sem TV, as telas da rede
  // são a projeção (v5.193). Era este o caso que ficava trancado para sempre.
  const destravado = await pg2.evaluate(() => ({
    preso: document.getElementById('simpleMode').classList.contains('locked'),
    modo: appMode,
  }));
  checar(!destravado.preso,
    'e o Modo Fácil NÃO fica trancado: sem TV, as telas da rede são a projeção');
  checar(erros2.length === 0,
    'nenhum erro de console no percurso com a transmissão ligada'
    + (erros2.length ? ':\n        ' + erros2.join('\n        ') : ''));
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

checar(erros.length === 0, 'nenhum erro de console' + (erros.length ? ':\n        ' + erros.join('\n        ') : ''));

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
