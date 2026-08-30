#!/usr/bin/env node
// ============================================================================
// A ROTINA DE ACERVO CEDE A VEZ AO QUE ESTÁ NO AR (v1.4.19)
//
// ## O defeito
//
// `syncLyrics` e `syncCifrasAcervo` saem da abertura SEM `await`, portanto
// correm juntas: `NET_CONCURRENCY` é 6, então são até **12 requisições
// concorrentes** a dois hosts de terceiros, sobre o acervo inteiro (MEDIDO:
// 309 + 145 hinos numa passada). O único freio era `networkType() ===
// 'cellular'` — nada consultava a cena.
//
// **Por que é estabilidade e não desempenho.** O uso normal é abrir o app
// minutos antes do culto e tocar o primeiro item. Nesse instante os fragmentos
// do MSE disputam a Wi-Fi da igreja com as 12 requisições — e a MEDIDA DE BANDA
// que escolhe o degrau do louvor inteiro é feita justamente durante a disputa
// (`talvezTrocarDegrau` roda antes do primeiro quadro, uma vez, para sempre).
// A varredura do acervo podia rebaixar a resolução do louvor.
//
// ## As duas naturezas de asserção, e por que a segunda existe
//
// A metade de COMPORTAMENTO é a que importa: com cena no ar, as duas rotinas
// voltam sem abrir tarefa nenhuma.
//
// A metade de FORMA (o gate aparecendo nos cinco pontos) existe porque o ponto
// que mais importa — o de DENTRO do `runLimited` — é inalcançável sem semear um
// acervo inteiro, e é justamente ele que cobre o caso NORMAL do culto: o app é
// aberto vazio, a varredura parte, e só ENTÃO o operador toca o primeiro item.
// Sem ele, a guarda da porta seria decorativa. É a mesma técnica que o
// `cifra-offline` já usa para provar que `syncCifrasAcervo` está na rotina de
// abertura: onde o comportamento não é alcançável, a forma é o que resta — e é
// dito, não escondido.
//
//   node tools/rotina-cede-a-vez.test.mjs
// ============================================================================
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

const PONTE = `(() => {
  const B = {
    shellVersion: () => 60, role: () => 'controle', appVersion: () => '1.98-teste',
    takeShare: () => '', busPost: () => {}, otaConfirm: () => {},
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal',
    'castTarget','cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages','displays',
    'espelhoCertApagar','espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag',
    'espelhoEstado','espelhoLigar','keepAlive','listFolder','nowPlaying','openCast','openExternal',
    'otaApply','otaCheck','otaDiag','otaPending','pickDoc','pickFolder','requestMic','systemVolume',
    'temaClaro','ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte',
    'ytFetchAudio','ytPlaylist','ytSearch','ytStream','areaTransferencia','atualizacaoEstado',
    'farolEstado','micDiag','salvarTexto','espelhoDerrubar'];
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
const porta = servidor.address().port;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();

try {
  await pg.addInitScript(PONTE);
  await pg.goto(`http://localhost:${porta}/controle/`, { waitUntil: 'domcontentloaded' });
  // Espera pelo APP DE PÉ, com as mesmas condições do watchdog de boot do OTA —
  // nunca por um prazo: a inicialização é assíncrona e zera o que se semear
  // antes dela.
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );

  // ── 1. O PREDICADO responde à cena ──────────────────────────────────────
  const predicado = await pg.evaluate(() => {
    const antes = midiaNoAr;
    midiaNoAr = false; const vazio = rotinaDeAcervoPodeCorrer();
    midiaNoAr = true; const cheio = rotinaDeAcervoPodeCorrer();
    midiaNoAr = antes;
    return { vazio, cheio };
  });
  checar(predicado.vazio === true && predicado.cheio === false,
    'a rotina pode correr com o palco vazio e NÃO pode com cena no ar', predicado);

  // ── 2. COM CENA NO AR, nenhuma das duas abre tarefa ─────────────────────
  // `lyricSyncRunning`/`cifraSyncRodando` são levantados logo antes do
  // `bgTaskStart`: se eles nunca sobem, nem a notificação nem a fila de rede
  // chegaram a existir. É a asserção de COMPORTAMENTO, e ela não precisa de
  // acervo semeado — a saída acontece antes de qualquer leitura de lista.
  const comCena = await pg.evaluate(async () => {
    midiaNoAr = true;
    await syncLyrics().catch(() => {});
    await syncCifrasAcervo().catch(() => {});
    const r = { letras: lyricSyncRunning, cifras: cifraSyncRodando };
    midiaNoAr = false;
    return r;
  });
  checar(comCena.letras === false && comCena.cifras === false,
    'com cena no ar as duas rotinas voltam SEM abrir tarefa — nem notificação, '
    + 'nem fila de rede', comCena);

  // ── 3. A FORMA: o gate está nos CINCO pontos ────────────────────────────
  // Ver o cabeçalho. O ponto de dentro do `runLimited` é o que cobre o caso
  // normal do culto, e é o único inalcançável sem semear o acervo inteiro.
  const forma = await pg.evaluate(() => {
    const g = /rotinaDeAcervoPodeCorrer\(\)/g;
    const conta = (f) => (String(f).match(g) || []).length;
    return {
      lyrics: conta(syncLyrics),
      cifrasColecao: conta(syncCifrasColecao),
      cifrasAcervo: conta(syncCifrasAcervo),
    };
  });
  checar(forma.lyrics >= 2,
    'o `syncLyrics` consulta o gate na PORTA e DENTRO do laço — a porta cobre '
    + '"começar com cena no ar"; o laço cobre o caso normal, em que a cena entra '
    + 'DEPOIS de a varredura partir', forma);
  checar(forma.cifrasColecao >= 2,
    'e o `syncCifrasColecao` também, pelos mesmos dois motivos', forma);
  checar(forma.cifrasAcervo >= 1,
    'e o laço de coleções para entre uma coleção e a seguinte', forma);
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
