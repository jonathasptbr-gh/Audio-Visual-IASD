#!/usr/bin/env node
// ============================================================================
// A NOTIFICAÇÃO DE "PREPARANDO APRESENTAÇÃO" TEM DE ANDAR.
//
// ## O defeito, e por que ele não tem sintoma
//
// `pptxImportar` e `deckImportar` abriam a tarefa com `bgTaskStart(…, 1)` e
// **nunca chamavam `bgTaskStep`**. O `onProgresso` existia e alimentava só o
// cartão da tela; a notificação nascia em `0 de 1` e ficava ali até o
// `bgTaskEnd`. Barra parada em 0% do começo ao fim, e estimativa em ZERO —
// `bgTaskEta` precisa de pelo menos um passo para ter média.
//
// É o mesmo defeito que o download de vídeo teve até a v5.117 (e que o
// `bgTaskBytes` corrigiu lá), sobrevivendo neste caminho. E ele é mudo por
// construção: nada lança, nada aparece no console, a apresentação é importada
// e fica correta no fim. O que falha é a única janela que existe com o app
// minimizado — e o caso em que ela importa é justamente o longo (dezenas de
// páginas, minutos de espera), que é quando ninguém está olhando a tela.
//
// Um teste do DESFECHO passa nas duas versões: a apresentação nasce igual.
// Por isso este oráculo mede o que a PONTE recebeu — `AVNative.bgProgress` —, e
// traz a REVERSÃO ao lado: com o `bgTaskStep` neutralizado, o mesmo import tem
// de produzir a corrente degenerada de antes.
//
//   node tools/notificacao-apresentacao.test.mjs
// ============================================================================
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)),
  '..', 'app', 'src', 'main', 'assets', 'web');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

/** Quantas páginas a apresentação de mentira tem. */
const PAGINAS = 8;
/** Espaço entre uma página e a seguinte. Tem de ser MAIOR que o piso de envio
 *  da notificação (`BG_NOTIF_MIN_MS`, 700 ms), senão o próprio freio engoliria
 *  os passos e o oráculo mediria o freio em vez do defeito. */
const PASSO_MS = 400;

// Um PNG 1×1 de verdade: o `makeThumb` decodifica a primeira página, e um
// arquivo inválido faria o import falhar por outro motivo.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

// A ponte de mentira. Duas coisas ela faz de verdade: guarda TUDO o que o
// `bgProgress` recebeu (é o que se mede) e empurra o progresso da rasterização
// pelo `__avDeckProgress`, como o Kotlin empurra.
const PONTE = `(() => {
  window.__bg = [];
  const B = {
    shellVersion: () => 60,
    role: () => 'controle',
    appVersion: () => '1.99-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    // O que chega aqui é a STRING que o Kotlin recebe: o native.js remonta o
    // objeto campo a campo e serializa. Ler o mesmo que o SyncService lê é o
    // nível certo — um campo que não atravessasse a ponte não apareceria aqui.
    bgProgress: (s) => { try { window.__bg.push(JSON.parse(String(s))); } catch (_) {} },
    // O caminho do PDF: N páginas rasterizadas pelo shell, uma a cada
    // ${PASSO_MS} ms, e depois as URLs servíveis.
    deckPages: (id) => {
      let i = 0;
      const passo = () => {
        i++;
        try { window.__avDeckProgress(id, i, ${PAGINAS}); } catch (_) {}
        if (i < ${PAGINAS}) { setTimeout(passo, ${PASSO_MS}); return; }
        const pages = [];
        for (let k = 0; k < ${PAGINAS}; k++) pages.push('/pagina.png?p=' + k);
        try { window.__avResolve(id, { name: 'Roteiro', pages }); } catch (_) {}
      };
      setTimeout(passo, ${PASSO_MS});
    },
  };
  const nomes = ['apkInstalar','apkProcurar','captureVolumeKeys','projecaoLocal','castTarget',
    'cifraDiag','cifraHtml','deckDiscard','deckExportUrl','displays','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','espelhoLigarEm','espelhoDerrubar','farolEstado','keepAlive',
    'listFolder','micDiag','nowPlaying','openCast','openExternal','otaApply','otaCheck','otaDiag',
    'otaPending','pickDoc','pickFolder','requestMic','salvarTexto','systemVolume','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio','ytStream',
    'ytPlaylist','ytSearch','ytDiag','areaTransferencia','atualizacaoEstado'];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...a) => {
      const id = a[0];
      if (typeof id === 'string') setTimeout(() => { try { window.__avResolve(id, null); } catch (_) {} }, 0);
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/pagina.png') {
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': PNG.length });
    res.end(PNG); return;
  }
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
      + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);

try {
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => falhas.push('pageerror: ' + e.message));
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function',
    null, { timeout: 20000 });
  await pg.evaluate(() => setAppMode('full'));

  // A rasterização do `.pptx` de mentira: o mesmo contrato de `AVDeck`, sem um
  // arquivo de terceiro no repositório — o que se mede aqui é a LIGAÇÃO entre o
  // `onProgresso` e a notificação, e ela não depende do que há dentro do zip.
  // UM argumento, sempre: `page.evaluate(fn, x)` entrega `x` inteiro ao
  // primeiro parâmetro — dois parâmetros deixariam o segundo `undefined`, o
  // laço não rodaria e o oráculo mediria uma apresentação de ZERO páginas.
  const SEMEAR_DECK = ({ passo, paginas }) => {
    window.AVDeck.paginasDoPptx = async (file, onProgresso) => {
      const pages = [];
      for (let i = 1; i <= paginas; i++) {
        await new Promise((r) => setTimeout(r, passo));
        const cv = document.createElement('canvas');
        cv.width = cv.height = 4;
        const c = cv.getContext('2d');
        c.fillStyle = '#fff'; c.fillRect(0, 0, 4, 4);
        pages.push(await new Promise((r) => cv.toBlob(r, 'image/png')));
        onProgresso(i, paginas);
      }
      return { pages, truncado: false };
    };
  };

  // ---- a corrente que a notificação recebeu, só o que é da tarefa ----
  const corrente = () => pg.evaluate(() => window.__bg.filter((p) => p.total > 0));

  // =========================================================================
  // 1. O `.pptx`
  // =========================================================================
  await pg.evaluate(SEMEAR_DECK, { passo: PASSO_MS, paginas: PAGINAS });
  await pg.evaluate(() => { window.__bg = []; });
  const importar = pg.evaluate(() => pptxImportar(
    new Blob([new Uint8Array([1, 2, 3])], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }),
    'Semana da Familia'));

  // ESPERA PELO FATO, não por um relógio: o que se afirma é que a notificação
  // recebeu o total REAL e um passo maior que zero. O prazo cobre o pior
  // caminho legítimo (as ${PAGINAS} páginas espaçadas mais o piso de envio).
  const andou = await pg.waitForFunction(
    () => window.__bg.some((p) => p.total > 1 && p.done > 0),
    null, { timeout: 30000 },
  ).then(() => true).catch(() => false);
  checar(andou,
    'A NOTIFICAÇÃO RECEBE O TOTAL DE PÁGINAS E UM PASSO — sem isto ela fica em '
    + '`0 de 1` do começo ao fim, que é o defeito relatado',
    await corrente());

  const antesDoFim = await corrente();
  await importar;

  const daTarefa = antesDoFim.filter((p) => p.total > 1);
  checar(daTarefa.length > 0 && daTarefa.every((p) => p.total === PAGINAS),
    '  ↳ e o total é o número de PÁGINAS, não o `1` do nascimento da tarefa',
    daTarefa.map((p) => p.total));
  checar(daTarefa.every((p, i) => i === 0 || p.done >= daTarefa[i - 1].done),
    '  ↳ e o `done` nunca anda para trás', daTarefa.map((p) => p.done));
  checar(antesDoFim.some((p) => (p.items || []).includes('Semana da Familia')),
    '  ↳ e a linha diz QUAL apresentação — com o app minimizado esta é a única '
    + 'tela que existe, e "Preparando apresentação" sozinho não nomeia nada',
    antesDoFim.map((p) => p.items));

  // =========================================================================
  // 2. A REVERSÃO — sem o passo, a corrente degenera
  // =========================================================================
  await pg.evaluate(() => {
    window.__bgStepReal = window.bgTaskStep;
    window.bgTaskStep = () => {};
    window.__bg = [];
  });
  await pg.evaluate(SEMEAR_DECK, { passo: 40, paginas: 3 });
  await pg.evaluate(() => pptxImportar(
    new Blob([new Uint8Array([1, 2, 3])], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }),
    'Sem passo'));
  const semPasso = await corrente();
  checar(semPasso.length > 0 && semPasso.every((p) => p.total === 1 && p.done === 0),
    'REVERSÃO: com o `bgTaskStep` neutralizado a notificação fica em `0 de 1` — '
    + 'é o que prova que as asserções acima têm dente',
    semPasso.map((p) => p.done + '/' + p.total));
  await pg.evaluate(() => { window.bgTaskStep = window.__bgStepReal; });

  // =========================================================================
  // 3. O PDF — o mesmo, pelo caminho do shell, mais a fase de CÓPIA
  // =========================================================================
  await pg.evaluate(() => { window.__bg = []; });
  const importarPdf = pg.evaluate(() => deckImportar(
    'https://appassets.androidplatform.net/saf/tok', 'Roteiro do culto'));
  const andouPdf = await pg.waitForFunction(
    () => window.__bg.some((p) => p.total > 1 && p.done > 0),
    null, { timeout: 30000 },
  ).then(() => true).catch(() => false);
  checar(andouPdf, 'o PDF (rasterizado pelo shell) anda pela mesma via',
    await corrente());
  const durantePdf = await corrente();
  await importarPdf;

  const pdfTarefa = durantePdf.filter((p) => p.total > 1);
  checar(pdfTarefa.every((p) => p.total === PAGINAS + 1),
    '  ↳ e o total é `páginas + 1`: a CÓPIA para a biblioteca é a última fatia '
    + 'do trabalho, e sem ela na conta a barra fecharia em 100% com o operador '
    + 'ainda esperando', pdfTarefa.map((p) => p.total));
  const todosPdf = await corrente();
  checar(todosPdf.some((p) => /[Gg]uardando/.test(p.label || '')),
    '  ↳ e a fase de cópia FALA: ela era silenciosa, e silêncio ali não é '
    + 'neutro — `idleMs` cresce e a notificação passa a dizer "sem resposta há X" '
    + 'justamente enquanto tudo vai bem',
    todosPdf.map((p) => p.label));
} finally {
  await ctx.close();
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.error('\n' + falhas.length + ' asserção(ões) reprovada(s).');
  process.exit(1);
}
console.log('\ntudo certo.');
