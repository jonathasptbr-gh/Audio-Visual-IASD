#!/usr/bin/env node
// ============================================================================
// A ROLAGEM `AUTO` PRECISA DE UM RELÓGIO QUE ESTEJA ANDANDO
//
// ## O defeito que ele trava
//
// Relato do operador (v1.2.1): *"o modo automático não está se movendo quando
// usado apenas a letra da música"*.
//
// No modo `auto` a posição da folha é uma FUNÇÃO da posição da música. Sem
// música há o modo LIVRE (px/s constante), e a escolha entre os dois saía de
// `cifraDuracaoNoAr()` — que perguntava à BARRA DE PROGRESSO.
//
// **A barra responde outra pergunta:** `renderNowPlaying` termina em
// `seekEl.disabled = !isTimed`, com `isTimed` saindo do `kind` do item ATUAL. E
// `currentItem` sobrevive de propósito ao Parar, ao fim da faixa e a uma letra
// avulsa — então a barra ficava habilitada, com o `max` da faixa, sobre um telão
// vazio. Com duração, o `auto` ancora a folha em `fracaoDaRolagem(0, dur)` e ela
// não sai mais do lugar: o modo livre, que deveria ter assumido, nunca chega.
//
// O desfecho não é um erro — é uma folha parada. Nada no console, nada na tela.
//
// ## As DUAS metades, e por que nenhuma basta
//
//  - **sem mídia no ar** a folha tem de ANDAR (o modo livre assumiu);
//  - **com mídia no ar** ela NÃO pode andar sozinha — ali quem manda é o
//    relógio, e a abertura da janela segura o começo parado de propósito.
//
// Sem a segunda, "sempre livre" passaria — e isso apagaria o recurso inteiro,
// que é a folha andar no tempo da gravação.
//
// ## E o cenário é o do app, não um nó solto
//
// Ponte injetada, popup ABERTO, fonte ativa `cifra`, folha desenhada pelo mesmo
// caminho que o operador percorre — a lição do `cifra-teclado.test.mjs`, que
// passava com a guarda REMOVIDA enquanto montava a tela à mão.
//
//   node tools/cifra-rolagem.test.mjs
// ============================================================================
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

// A PONTE DE MENTIRA. `cifraHtml` devolve uma folha LONGA de propósito: sem
// conteúdo que estoure a caixa não há `scrollHeight - clientHeight`, e as duas
// metades mediriam zero contra zero — um oráculo que aprova qualquer coisa.
const PONTE = `(() => {
  const LINHAS = [];
  for (let i = 0; i < 220; i++) {
    LINHAS.push('<b>C</b>      <b>G</b>');
    LINHAS.push('linha de marcador numero ' + i);
  }
  const FOLHA = '<pre>' + LINHAS.join('\\n') + '</pre>';
  const B = {
    shellVersion: () => 50,
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    cifraHtml: (id, url) => {
      setTimeout(() => {
        try { window.__avResolve(id, { status: 200, html: FOLHA }); } catch (_) {}
      }, 0);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','castTarget',
    'cifraDiag','deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply',
    'otaCheck','otaDiag','otaPending','pickDoc','pickFolder','requestMic','systemVolume',
    'temaClaro','ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte',
    'ytFetchAudio','ytPlaylist','ytSearch','ytStream','areaTransferencia','atualizacaoEstado'];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      const id = args[0];
      if (typeof id === 'string') setTimeout(() => { try { window.__avResolve(id, null); } catch (_) {} }, 0);
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

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
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

await new Promise((r) => servidor.listen(0, r));
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = 'http://localhost:' + servidor.address().port;

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  // O critério do watchdog do OTA: o `init()` é assíncrono e termina DEPOIS do
  // `load`. Plantar `currentItem` antes disso é correr contra a inicialização,
  // que o zera com toda a razão — e o cenário evapora sem erro nenhum.
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );

  // SEM `window.`: `currentItem` e `lvSource` são `let` no topo de um script
  // clássico — vínculo léxico, não propriedade de `window`.
  const pronto = await pg.evaluate(() => {
    currentItem = {
      id: 'marcador', name: 'Musica De Marcador', kind: 'audio', seconds: 200,
      lyrics: [{ text: 'linha de marcador' }],
    };
    if (!cifraCabe(currentItem)) return 'cifraCabe recusou o item';
    lvSource = 'cifra';
    openLyricsPopup();
    return lvActiveSource();
  });
  checar(pronto === 'cifra', 'a aba de CIFRA é a fonte ativa (o cenário do app)', pronto);
  await pg.waitForSelector('.lv-cifra-acordes', { timeout: 15000 });

  const rolavel = await pg.evaluate(
    () => lyricsViewBodyEl.scrollHeight - lyricsViewBodyEl.clientHeight,
  );
  checar(rolavel > 200,
    'a folha é MAIOR que a caixa — sem isso as duas metades mediriam zero contra '
    + 'zero, e o oráculo aprovaria qualquer coisa', rolavel);

  // A velocidade tem de ser `auto`: é dela que este caso fala. O degrau é
  // persistido, então não se pode supor o que veio do banco.
  await pg.evaluate(() => cifraAdotarVelocidade('auto'));

  // ======================================================================
  // METADE 1 — SEM MÍDIA NO AR: o modo LIVRE assume, e a folha ANDA
  // ======================================================================
  //
  // O ESTADO É O DO RELATO, montado à mão: a barra HABILITADA com a duração da
  // faixa (é o que `renderNowPlaying` deixa depois do Parar, do fim natural e
  // de uma letra avulsa) e NADA no telão. É exatamente aqui que o `auto` ancorava
  // a folha e ela parava para sempre.
  const semAr = await pg.evaluate(async () => {
    midiaNoAr = false;
    seekEl.disabled = false;
    seekEl.max = '200';
    const dur = cifraDuracaoNoAr();
    lyricsViewBodyEl.scrollTop = 0;
    cifraRolarAlternar();
    const t0 = lyricsViewBodyEl.scrollTop;
    await new Promise((r) => setTimeout(r, 1500));
    const t1 = lyricsViewBodyEl.scrollTop;
    const titulo = cifraVelBtnEl ? cifraVelBtnEl.title : '';
    cifraRolarParar();
    return { dur, t0, t1, titulo };
  });
  checar(semAr.dur === 0,
    'sem mídia no ar não há duração a seguir — a barra habilitada não é "no ar"',
    semAr);
  checar(semAr.t1 > semAr.t0 + 5,
    'e a folha ANDA: o modo LIVRE assumiu, que é o que o `auto` sem relógio '
    + 'promete', { t0: semAr.t0, t1: semAr.t1 });
  checar(/ritmo fixo/.test(semAr.titulo),
    'e o botão DIZ isso — o rótulo mostra a escolha, a frase mostra o que está '
    + 'acontecendo', semAr.titulo);

  // ======================================================================
  // METADE 2 — COM MÍDIA NO AR: quem manda é o RELÓGIO, não um px/s
  // ======================================================================
  //
  // Sem ela, "cair sempre no livre" passaria na metade de cima e apagaria o
  // recurso: a folha andaria em ritmo fixo por cima de uma música tocando.
  // A ABERTURA da janela de rolagem segura o começo parado alguns segundos —
  // é ela que faz a prova ser possível sem esperar a música inteira.
  const comAr = await pg.evaluate(async () => {
    midiaNoAr = true;
    seekEl.disabled = false;
    seekEl.max = '200';
    const dur = cifraDuracaoNoAr();
    lyricsViewBodyEl.scrollTop = 0;
    cifraRolarAlternar();
    const t0 = lyricsViewBodyEl.scrollTop;
    await new Promise((r) => setTimeout(r, 1500));
    const t1 = lyricsViewBodyEl.scrollTop;
    const titulo = cifraVelBtnEl ? cifraVelBtnEl.title : '';
    cifraRolarParar();
    midiaNoAr = false;
    return { dur, t0, t1, titulo };
  });
  checar(comAr.dur === 200,
    'com mídia no ar a duração da barra vale — é ela que o `auto` segue', comAr);
  checar(comAr.t1 <= comAr.t0 + 2,
    'e a folha NÃO anda sozinha: a música está no segundo zero, e a ABERTURA '
    + 'segura o começo parado de propósito', { t0: comAr.t0, t1: comAr.t1 });
  checar(/tempo da música/.test(comAr.titulo),
    'e o botão diz que está seguindo a música', comAr.titulo);
} finally {
  await navegador.close();
  servidor.close();
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
