#!/usr/bin/env node
// ============================================================================
// A CIFRA DO HINÁRIO GUARDADA NO APARELHO ABRE **SEM REDE**
//
// ## O que ele trava
//
// O download do hinário passou a trazer também as cifras (v1.1.28), guardadas
// em `cifras:<coleção>` no IndexedDB. A promessa é uma só, e é operacional: no
// sábado, com o Wi-Fi da igreja oscilando, a folha abre.
//
// **Uma promessa dessas falha CALADA.** Se a leitura do disco não acontecesse,
// o app cairia no caminho de rede e — com rede — a folha abriria do mesmo
// jeito, com a mesma aparência, pela porta errada. Ninguém veria diferença até
// o dia em que a rede não estivesse lá.
//
// Por isso a asserção não é "a folha apareceu": é **`cifraHtml` não foi
// chamado nenhuma vez**. A ponte de mentira CONTA as chamadas e responde
// `status 0` (sem rede) a todas — assim, se o disco não for lido, não há
// segundo caminho por onde a folha possa vir, e o caso reprova.
//
// A outra metade é o simétrico: uma música que NÃO está guardada tem de ir à
// rede. Sem ela, "nunca chamar a rede" passaria — e o recurso inteiro seria um
// cache que nunca preenche.
//
//   node tools/cifra-offline.test.mjs
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

// A PONTE CONTA as chamadas de rede e responde "sem rede" a todas. É o
// instrumento do caso: com ela, a folha só pode vir do disco.
const PONTE = `(() => {
  window.__nCifraHtml = 0;
  const B = {
    shellVersion: () => 50,
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    cifraHtml: (id) => {
      window.__nCifraHtml++;
      setTimeout(() => { try { window.__avResolve(id, { status: 0, html: '' }); } catch (_) {} }, 0);
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

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
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
const base = `http://localhost:${porta}`;

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  // A MESMA espera do watchdog: plantar cenário antes do fim do `init()` é
  // correr contra a inicialização, que o zera com razão.
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );

  // A COLEÇÃO tem de ser uma do CATÁLOGO — é `cifraGuardavel` que decide, e a
  // regra inteira depende de o endereço ser deduzível.
  const guardavel = await pg.evaluate(() => ({
    hinario: cifraGuardavel({ id: 'hymnal-2022' }),
    album: cifraGuardavel({ id: 'qualquer-album' }),
  }));
  checar(guardavel.hinario === true, 'o Hinário 2022 é guardável (endereço deduzível)');
  checar(guardavel.album === false, 'e um álbum comum não é — não há como deduzir o endereço dele');

  // SEMEAR o disco como o download teria deixado.
  const semeou = await pg.evaluate(async () => {
    const chave = cifraChaveNoDisco('001. Hino De Marcador');
    await AVDB.setState('cifras:hymnal-2022', {
      [chave]: {
        url: 'https://www.cifraclub.com.br/novo-hinario-adventista/hino-de-marcador/',
        em: 1,
        pagina: {
          titulo: 'Hino De Marcador', artista: 'Novo Hinario', tom: 'G',
          linhas: [
            { tipo: 'acordes', texto: 'G       C' },
            { tipo: 'letra', texto: 'linha de marcador' },
          ],
        },
      },
    });
    cifraDiscoColl = ''; cifraDisco = null;   // força a releitura do disco
    return chave;
  });
  checar(!!semeou, 'o disco foi semeado com um hino', semeou);

  // A LEITURA, com a rede respondendo "sem rede" a tudo.
  const r = await pg.evaluate(async () => {
    const item = {
      id: 'h1', name: '001. Hino De Marcador', kind: 'audio',
      hymnAlbum: (allCollections().find((c) => c.id === 'hymnal-2022') || {}).name,
    };
    const antes = window.__nCifraHtml;
    cifraCache.clear();
    cifraGarantir(item);
    for (let i = 0; i < 100; i++) {
      const e = cifraCache.get(cifraChave(item));
      if (e && e.estado !== 'buscando') {
        return { estado: e.estado, tom: e.pagina && e.pagina.tom, rede: window.__nCifraHtml - antes };
      }
      await new Promise((res) => setTimeout(res, 50));
    }
    return { estado: 'nunca resolveu', rede: window.__nCifraHtml - antes };
  });
  checar(r.estado === 'ok', 'a folha abre com a rede toda respondendo "sem rede"', r);
  checar(r.tom === 'G', 'e é a folha guardada (o tom veio do disco)', r.tom);
  checar(r.rede === 0,
    'e NENHUMA requisição saiu — é isso, e não a folha na tela, que prova o offline', r.rede);

  // A OUTRA METADE: o que NÃO está guardado tem de ir à rede. Sem ela, "nunca
  // chamar a rede" passaria e o recurso seria um cache que nunca preenche.
  const r2 = await pg.evaluate(async () => {
    const item = {
      id: 'h2', name: '002. Outro Hino De Marcador', kind: 'audio',
      hymnAlbum: (allCollections().find((c) => c.id === 'hymnal-2022') || {}).name,
    };
    const antes = window.__nCifraHtml;
    cifraGarantir(item);
    for (let i = 0; i < 100; i++) {
      const e = cifraCache.get(cifraChave(item));
      if (e && e.estado !== 'buscando') return { estado: e.estado, rede: window.__nCifraHtml - antes };
      await new Promise((res) => setTimeout(res, 50));
    }
    return { estado: 'nunca resolveu', rede: window.__nCifraHtml - antes };
  });
  checar(r2.rede > 0, 'um hino NÃO guardado vai à rede', r2);
  checar(r2.estado === 'falha', 'e sem rede ele falha, em vez de inventar uma folha', r2.estado);
} finally {
  await navegador.close();
  servidor.close();
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
