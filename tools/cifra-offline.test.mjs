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

  // O GATILHO EXISTE FORA DO DOWNLOAD (v1.1.30). A v1.1.28 pendurou a busca no
  // fim do `syncCollection` — e um hinário JÁ COMPLETO faz aquela função
  // retornar em "Já completo offline" muito antes do gancho. MEDIDO em dois
  // Registros seguidos: `0 de 601` depois de o operador sincronizar. Quem
  // remover `syncCifrasHinarios` da rotina de abertura reproduz isso.
  checar(await pg.evaluate(() => typeof syncCifrasHinarios === 'function'),
    'existe um caminho que NÃO depende de o hinário estar sendo baixado');
  const naRotina = await pg.evaluate(() => /syncCifrasHinarios\(\)/.test(String(autoRefreshCollections)));
  checar(naRotina, 'e ele é chamado pela rotina de abertura, ao lado do syncLyrics', naRotina);

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

  // ---- A GRAVAÇÃO MESCLA; ELA NUNCA SUBSTITUI (v1.2.10) -------------------
  //
  // MEDIDO num aparelho: `275 de 601` virou `0 de 601`, e a cada abertura o app
  // recomeçava o download do zero. A gravação era `setState` do mapa INTEIRO a
  // partir de um slot de módulo cuja identidade mora noutra variável — bastava
  // o slot não ser o daquela coleção (ou ser `null`) para o acervo guardado ser
  // apagado por um `{}`.
  //
  // A asserção é a PROPRIEDADE, não o interleaving: **uma mescla não pode
  // produzir zero a partir de 275**. O cenário abaixo é o pior caso do defeito
  // — o slot de memória VAZIO na hora de gravar — e com a substituição de volta
  // ele reprova.
  const mesclou = await pg.evaluate(async () => {
    await AVDB.setState('cifras:hymnal-2022', {
      a: { pagina: { tom: 'A', linhas: [] }, url: 'u-a', em: 1 },
      b: { pagina: { tom: 'B', linhas: [] }, url: 'u-b', em: 1 },
      c: { pagina: { tom: 'C', linhas: [] }, url: 'u-c', em: 1 },
    });
    // O SLOT VAZIO: é o estado em que a substituição escrevia `{}` por cima.
    cifraDiscoColl = ''; cifraDisco = null;
    const novas = { d: { pagina: { tom: 'D', linhas: [] }, url: 'u-d', em: 2 } };
    await cifraDiscoMesclar('hymnal-2022', novas);
    const disco = (await AVDB.getState('cifras:hymnal-2022')) || {};
    return { chaves: Object.keys(disco).sort(), sobrouPendente: Object.keys(novas).length };
  });
  checar(mesclou.chaves.join(',') === 'a,b,c,d',
    'a gravação MESCLA: as três guardadas sobrevivem e a nova entra', mesclou.chaves);
  checar(mesclou.sobrouPendente === 0,
    'e o que foi para o disco sai da fila de pendentes — senão o lote seguinte o reenvia',
    mesclou.sobrouPendente);

  // E O SLOT DE LEITURA ACOMPANHA — quando é o DESTA coleção. Sem isto a aba
  // iria à rede por uma cifra que a passada acabou de guardar; e escrevê-lo sem
  // conferir de quem ele é seria o defeito original de novo, por outra porta.
  const slot = await pg.evaluate(async () => {
    const semDono = (cifraDiscoColl === 'hymnal-2022');   // ainda vazio: não é dela
    await cifraDiscoDe('hymnal-2022');                    // agora o slot é dela
    await cifraDiscoMesclar('hymnal-2022', {
      e: { pagina: { tom: 'E', linhas: [] }, url: 'u-e', em: 3 },
    });
    return { semDono, chaves: Object.keys(cifraDisco || {}).sort().join(',') };
  });
  checar(slot.semDono === false,
    'a mescla NÃO escreve num slot que é de outra coleção — era esse o defeito', slot.semDono);
  checar(slot.chaves === 'a,b,c,d,e',
    'e escreve no slot quando ele é o desta coleção', slot.chaves);
} finally {
  await navegador.close();
  servidor.close();
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
