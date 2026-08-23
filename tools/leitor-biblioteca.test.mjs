#!/usr/bin/env node
// ============================================================================
// O LEITOR DA BIBLIOTECA: A MESMA FOLHA, SEM TELÃO
//
// A folha de letra/cifra nasceu presa ao `currentItem` — ela era o auxiliar de
// leitura da CENA —, e por isso ler uma música exigia PROJETÁ-LA. O músico quer
// o contrário: abrir a cifra no ensaio sem que a congregação veja nada.
//
// Três coisas podem falhar aqui, e as três calam:
//
//  1. a folha mostrar a música ERRADA (a da cena, não a que se pediu);
//  2. alguma coisa ir ao TELÃO — o defeito que o recurso existe para não ter,
//     e o único que não deixa rastro na tela de quem abriu a folha;
//  3. o relógio da cena governar a rolagem de OUTRA música, o que não erra
//     alto: a folha anda, só que no compasso errado.
//
//   node tools/leitor-biblioteca.test.mjs
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

// O SITE DE MENTIRA, por FORMA de endereço — é a cadeia de tentativas que está
// sendo medida, e ela se distingue justamente pelo caminho que monta.
//
//  - `/novo-hinario-adventista/…` responde uma folha  → o degrau do CATÁLOGO
//  - `/marcador-um/…`             responde uma folha  → o degrau do ÁLBUM
//  - `/marcador-tres/…`           responde 200 ILEGÍVEL → o caso da radiografia
//  - o resto                      responde 404          → a falha completa
//
// A folha é SINTÉTICA, como todas as fixtures deste recurso: nenhum conteúdo
// de terceiro entra neste repositório.
const PONTE = `(() => {
  window.__urls = [];
  const FOLHA = '<h1>Musica Marcador</h1><h2>Artista Marcador</h2>'
    + '<span class="cifra_tom"><a>G</a></span>'
    + '<pre><b>G</b>      <b>C</b>\\nlinha de marcador\\n</pre>';
  // A PÁGINA QUE NÃO ABRE: existe, tem título, e nenhuma folha nem marcador de
  // letra — é o "não entendi", e é dela que a radiografia interessa.
  const ILEGIVEL = '<title>Musica Marcador - Cifra Club</title>'
    + '<h1>Musica Marcador</h1><h2>Artista Marcador</h2>'
    + '<div class="folha-nova">sem folha nenhuma aqui</div>';
  // E A PÁGINA DE LETRA: o site tem a música, sem os acordes. Outro desfecho,
  // outra ação — e a radiografia dela NÃO deve ser colhida.
  const SO_LETRA = '<title>Musica Marcador - Artista (letra da música) - Cifra Club</title>'
    + '<h1>Musica Marcador</h1><h2>Artista Marcador</h2>'
    + '<div class="letra"><p>uma linha de marcador</p></div>';
  const B = {
    shellVersion: () => 51,
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    cifraHtml: (id, url) => {
      window.__urls.push(url);
      let r = { status: 404, html: '' };
      if (/\\/novo-hinario-adventista\\//.test(url) || /\\/marcador-um\\//.test(url)) r = { status: 200, html: FOLHA };
      else if (/\\/marcador-tres\\//.test(url)) r = { status: 200, html: ILEGIVEL };
      else if (/\\/marcador-quatro\\//.test(url)) r = { status: 200, html: SO_LETRA };
      setTimeout(() => { try { window.__avResolve(id, r); } catch (_) {} }, 0);
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

const collSongsNome = 'Um Numero 1';
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
  // A MESMA espera do watchdog de boot: plantar cenário antes do fim do
  // `init()` é correr contra a inicialização, que o zera com razão.
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );

  // ---- O ACERVO PLANTADO -------------------------------------------------
  // Um hinário (endereço deduzível pelo catálogo) e três álbuns, um por
  // desfecho. Três faixas em cada, para o teto de duas por álbum ter o que
  // recusar.
  await pg.evaluate(() => {
    const faixas = (p) => Array.from({ length: 3 }, (_, i) => ({
      id_music: p + i, track: i + 1, name: p + ' Numero ' + (i + 1),
      duration: '3:00', has_instrumental_music: false, fileIdFull: null, fileIdPlayback: null,
    }));
    albumCatalog.albums = [
      { id_album: 'a1', name: 'Marcador Um' },
      { id_album: 'a2', name: 'Marcador Dois' },
      { id_album: 'a3', name: 'Marcador Tres' },
      { id_album: 'a4', name: 'Marcador Quatro' },
    ];
    collState['hymnal-2022'] = { songs: faixas('Hino') };
    collState['album-a1'] = { songs: faixas('Um') };
    collState['album-a2'] = { songs: faixas('Dois') };
    collState['album-a3'] = { songs: faixas('Tres') };
    collState['album-a4'] = { songs: faixas('Quatro') };
    // Os OUTROS acervos ficam de fora: um álbum sem faixa não entra na bateria,
    // e o hinário de 1996 sem faixas plantadas também não.
    delete collState['hymnal-1996'];
  });

  // ---- O LEITOR DA BIBLIOTECA: A MESMA FOLHA, SEM TELÃO (v1.2.14) --------
  //
  // A folha nasceu presa ao `currentItem`, então ler uma música exigia
  // PROJETÁ-LA. O músico quer o contrário: abrir a cifra no ensaio sem que a
  // congregação veja nada.
  //
  // Três coisas podem falhar aqui, e as três calam:
  //  1. a folha mostrar a música ERRADA (a da cena, não a que se pediu);
  //  2. alguma coisa ir ao TELÃO — o defeito que o recurso existe para não ter;
  //  3. o relógio da cena governar a rolagem de OUTRA música, o que não erra
  //     alto: a folha anda, só que no compasso errado.
  const leitor = await pg.evaluate(async () => {
    const enviados = [];
    const orig = AVDB.sendCommand;
    AVDB.sendCommand = (c) => { enviados.push(c && c.type); return orig.call(AVDB, c); };
    // A CENA: outra música, com duração, para o relógio existir de verdade.
    currentItem = {
      id: 'da-cena', name: 'Musica Da Cena', kind: 'audio', seconds: 200,
      lyrics: [{ text: 'linha da cena' }],
    };
    // O RELÓGIO DA CENA, DE VERDADE: sem isto o `cifraDuracaoNoAr` devolveria 0
    // por outro motivo (barra desabilitada) e a guarda que este caso mede nunca
    // seria exercitada — o oráculo aprovaria a remoção dela.
    midiaNoAr = true;
    seekEl.disabled = false;
    seekEl.max = '200';
    const coll = allCollections().find((c) => c.id === 'album-a1');
    const faixa = collSongs('album-a1')[0];
    const alvo = await lvItemDaBiblioteca(coll, faixa);
    openLyricsPopup(alvo, 'cifra');
    const r = {
      titulo: lyricsPopupTitleEl.textContent,
      fonte: lvActiveSource(),
      naCena: lvNaCena(),
      nome: cifraNomeDoItem(lvItem()),
      colecao: (cifraColecaoDoItem(lvItem()) || {}).id || '',
      relogio: cifraDuracaoNoAr(),
      indice: lvCurrentIndex('lyrics'),
      enviados: enviados.slice(),
    };
    // E a CENA continua com relógio — a prova de que o 0 acima veio da guarda,
    // não de a barra estar desabilitada.
    closeLyricsPopup();
    r.relogioDaCena = cifraDuracaoNoAr();
    r.depoisDeFechar = lvNaCena();
    midiaNoAr = false; seekEl.disabled = true;
    AVDB.sendCommand = orig;
    return r;
  });
  checar(leitor.nome === collSongsNome, 'a folha abre para a faixa da BIBLIOTECA, não para a da cena',
    { nome: leitor.nome, titulo: leitor.titulo });
  checar(leitor.colecao === 'album-a1',
    'e ela reencontra a coleção — é dela que saem o catálogo e o arquivo no aparelho',
    leitor.colecao);
  checar(leitor.fonte === 'cifra', 'abre na CIFRA, que é o que o músico foi buscar', leitor.fonte);
  checar(leitor.naCena === false, 'e a folha sabe que NÃO é a cena', leitor.naCena);
  // 2. NADA VAI AO TELÃO. É a promessa inteira do recurso, e a única que falha
  // sem deixar rastro na tela de quem abriu a folha.
  checar(leitor.enviados.length === 0,
    'NENHUM comando foi ao telão — ler não é projetar', leitor.enviados);
  // 3. E O RELÓGIO DA CENA NÃO GOVERNA ESTA FOLHA. Com duração, o modo `auto`
  // vira uma função de `authoritativeTime()` — que aqui é o tempo de OUTRA
  // música. Sem relógio ele cai no livre, que é o que um ensaio quer.
  checar(leitor.relogio === 0,
    'a rolagem automática não segue o relógio de outra música', leitor.relogio);
  checar(leitor.relogioDaCena === 200,
    'e o relógio EXISTIA — o zero acima é a guarda, não uma barra desabilitada',
    leitor.relogioDaCena);
  checar(leitor.indice === -1,
    'e nenhuma estrofe é destacada: sem cena não há posição', leitor.indice);
  checar(leitor.depoisDeFechar === true,
    'fechar a folha devolve o leitor à cena — o alvo é o desvio de UMA leitura',
    leitor.depoisDeFechar);

} finally {
  await navegador.close();
  servidor.close();
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
