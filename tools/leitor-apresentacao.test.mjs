#!/usr/bin/env node
// ============================================================================
// O AUXILIAR DE LEITURA DE UMA APRESENTAÇÃO (v1.4.24)
//
// Pedido do operador, em duas metades que se sustentam:
//
//   1. *"um visualizador futuro dos slides de toda a apresentação e a
//      referência do slide atual (do mesmo molde vertical que já temos nos
//      versos da bíblia na aba da bíblia)"*;
//   2. *"assim como o resto do sistema do auxiliar de leitura, ele deve mostrar
//      apenas o auxiliar referente à mídia em exibição, ou seja, durante uma
//      apresentação, não quero botões de letra, ou de cifras nessa tela"*.
//
// A segunda é a que falha CALADA, e por isso ela tem asserção própria: a folha
// abre, mostra páginas, e um botão "Letra" sobrando ao lado abre a letra de
// OUTRA mídia — nada quebra, nada aparece no console, e o operador lê o hino de
// antes durante o sermão.
//
// ## As três coisas que este oráculo mede e um teste de comportamento não pega
//
//  - **A EXCLUSIVIDADE**, medida na transição que o operador de fato faz: com
//    uma música em cena a folha tem Letra; mandando a apresentação, o seletor
//    inteiro some. Medir só o estado final aprovaria uma folha que nunca
//    tivesse tido as outras abas.
//  - **A ALTURA RESERVADA da miniatura**, no RENDERIZADO. As imagens são
//    `loading="lazy"`, e uma imagem não carregada tem altura ZERO: sem a altura
//    do CSS o `lvScroll` mediria `offsetTop` sobre uma coluna que cresce à
//    medida que as imagens entram, e a página em cena apareceria fora da tela.
//    Um teste de CLASSE passaria; só o layout medido reprova.
//  - **A TROCA DE PÁGINA NÃO REMONTA A LISTA.** O destaque anda por classe. Se
//    a página entrasse na assinatura da folha, cada toque no ⏭ revogaria e
//    recriaria dezenas de URLs de objeto no meio do sermão — e o sintoma seria
//    só "a folha pisca". A prova é a URL da primeira miniatura ser a MESMA
//    antes e depois.
//
//   node tools/leitor-apresentacao.test.mjs
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
const PAGINAS = 9;

const PONTE = `(() => {
  const B = {
    shellVersion: () => 60, role: () => 'controle', appVersion: () => '1.99-teste',
    takeShare: () => '', busPost: () => {}, otaConfirm: () => {},
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal',
    'castTarget','cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages','displays',
    'espelhoCertApagar','espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag',
    'espelhoEstado','espelhoLigar','espelhoLigarEm','espelhoDerrubar','farolContar','farolEstado',
    'keepAlive','listFolder','micDiag','nowPlaying','openCast','openExternal','otaApply','otaCheck',
    'otaDiag','otaPending','pickDoc','pickFolder','requestMic','salvarTexto','systemVolume',
    'temaClaro','ytCancel','ytCanalPlaylists','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio',
    'ytStream','ytPlaylist','ytSearch','ytDiag','areaTransferencia','atualizacaoEstado'];
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
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = 'http://localhost:' + servidor.address().port;

try {
  pg.on('pageerror', (e) => falhas.push('pageerror: ' + e.message));
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );

  // ── 1. A MÚSICA PRIMEIRO — é dela que a exclusividade tem de tirar as abas ──
  const comMusica = await pg.evaluate(() => {
    setAppMode('full');
    currentItem = {
      id: 'cena', name: 'Louvor Em Cena', kind: 'audio', seconds: 200,
      lyrics: [{ cover: true }, { text: 'primeira estrofe' }, { text: 'segunda estrofe' }],
    };
    lvSource = null;
    renderSlideNav();
    openLyricsPopup();
    return {
      fontes: lyricsViewSources(),
      ativa: lvActiveSource(),
      linhas: document.querySelectorAll('#lyricsViewBody .lv-row').length,
    };
  });
  checar(comMusica.fontes.includes('lyrics') && comMusica.ativa === 'lyrics' && comMusica.linhas > 0,
    'ponto de partida: com uma MÚSICA em cena a folha é a da letra', comMusica);

  // ── 2. A APRESENTAÇÃO ENTRA ────────────────────────────────────────────────
  const dado = await pg.evaluate(async (n) => {
    // Páginas de cor sólida, cada uma diferente: são Blob de verdade, que é o
    // que o registro guarda — e é o Blob que obriga a URL de objeto.
    const pages = [];
    for (let i = 0; i < n; i++) {
      const cv = document.createElement('canvas');
      cv.width = 160; cv.height = 90;
      const c = cv.getContext('2d');
      c.fillStyle = 'hsl(' + (i * 37) + ',60%,60%)';
      c.fillRect(0, 0, 160, 90);
      pages.push(await new Promise((r) => cv.toBlob(r, 'image/png')));
    }
    closeLyricsPopup();
    currentItem = { id: 'ap', name: 'Semana da Familia', kind: 'deck', pages };
    deckPagina = 0;
    lvSource = null;
    renderSlideNav();
    // Pelo BOTÃO do transporte, que é a porta de verdade — `openLyricsPopup`
    // direto não exercita o ouvinte (a lição do `leitor-do-transporte`).
    document.getElementById('lyricsViewBtn').click();
    const linhas = [...document.querySelectorAll('#lyricsViewBody .lv-row')];
    const seg = document.getElementById('lyricsViewSeg');
    return {
      fontes: lyricsViewSources(),
      ativa: lvActiveSource(),
      titulo: document.getElementById('lyricsPopupTitle').textContent,
      linhas: linhas.length,
      numeros: linhas.map((l) => l.querySelector('.lv-num').textContent),
      atual: linhas.findIndex((l) => l.classList.contains('current')),
      // A EXCLUSIVIDADE, medida como o operador a vê: o seletor escondido E
      // nenhum botão de outra fonte à mostra.
      segEscondido: seg.hidden,
      botoesVisiveis: [...seg.querySelectorAll('.fit-opt')]
        .filter((b) => !b.hidden).map((b) => b.dataset.lvsrc),
      // A ALTURA RESERVADA, no RENDERIZADO e com a imagem ainda por carregar.
      alturaPrimeira: Math.round(linhas[0].querySelector('.lv-slide').getBoundingClientRect().height),
      lazy: linhas.every((l) => l.querySelector('.lv-slide').getAttribute('loading') === 'lazy'),
      urlPrimeira: linhas[0].querySelector('.lv-slide').getAttribute('src'),
      fonteCtl: document.querySelector('#lyricsPopup .lv-fonte-ctl').hidden,
    };
  }, PAGINAS);

  checar(dado.linhas === PAGINAS,
    'A APRESENTAÇÃO INTEIRA vira uma coluna: uma linha por página', dado.linhas);
  checar(dado.numeros.join(',') === Array.from({ length: PAGINAS }, (_, i) => String(i + 1)).join(','),
    '  ↳ numeradas de 1 a N, como os versículos da Bíblia', dado.numeros);
  checar(dado.atual === 0,
    '  ↳ e a PÁGINA EM CENA é a marcada — é a referência que o pedido nomeia',
    dado.atual);
  checar(dado.titulo === 'Semana da Familia',
    '  ↳ o título é o nome da apresentação (a posição já está no transporte, e '
    + 'repeti-la é criar uma segunda fonte para divergir)', dado.titulo);

  checar(dado.fontes.length === 1 && dado.fontes[0] === 'deck' && dado.ativa === 'deck',
    'A APRESENTAÇÃO É A ÚNICA FONTE — o pedido ao pé da letra', dado);
  // A ASSERÇÃO É O PEDIDO, e não "nenhum botão à mostra": o botão da PRÓPRIA
  // apresentação continua sem o atributo `hidden` (ele é a fonte ativa), e o
  // que o operador vê é governado pelo container. As duas metades juntas são o
  // que ele pediu — nenhuma OUTRA fonte oferecida, e nada na tela.
  const outras = dado.botoesVisiveis.filter((v) => v !== 'deck');
  checar(dado.segEscondido && outras.length === 0,
    '  ↳ e na TELA não sobra botão de Letra nem de Cifra: nenhuma OUTRA fonte '
    + 'oferecida, e o seletor inteiro escondido (é o defeito calado — um botão '
    + 'sobrando abre a leitura de outra mídia)',
    { escondido: dado.segEscondido, outras });

  checar(dado.lazy, '  ↳ as miniaturas são `lazy`: uma apresentação de centenas '
    + 'de páginas não decodifica tudo de uma vez no processo dos dois WebViews');
  checar(dado.alturaPrimeira > 20,
    '  ↳ e mesmo assim a linha TEM ALTURA antes de a imagem carregar — sem isso '
    + 'a rolagem até a página em cena miraria o lugar errado',
    dado.alturaPrimeira);
  checar(dado.fonteCtl === true,
    '  ↳ e o A+/A− SOME: ele dimensiona TEXTO, e a miniatura ocupa a largura da '
    + 'coluna — um par de botões que fica ali sem mudar nada na tela é o que '
    + 'este app não deixa acontecer', dado.fonteCtl);

  // ── 3. VIRAR A PÁGINA MOVE O DESTAQUE, E NÃO REMONTA A LISTA ───────────────
  const depois = await pg.evaluate(() => {
    document.getElementById('slideNextBtn').click();
    document.getElementById('slideNextBtn').click();
    const linhas = [...document.querySelectorAll('#lyricsViewBody .lv-row')];
    return {
      pagina: deckPagina,
      atual: linhas.findIndex((l) => l.classList.contains('current')),
      urlPrimeira: linhas[0].querySelector('.lv-slide').getAttribute('src'),
      linhas: linhas.length,
    };
  });
  checar(depois.pagina === 2 && depois.atual === 2,
    'VIRAR A PÁGINA move o destaque junto com o telão', depois);
  checar(depois.urlPrimeira === dado.urlPrimeira && depois.linhas === PAGINAS,
    '  ↳ e NÃO remonta a lista: a mesma URL de objeto na primeira miniatura. '
    + 'Com a página na assinatura, cada toque no ⏭ revogaria e recriaria dezenas '
    + 'de URLs — e o sintoma seria só "a folha pisca"',
    { antes: dado.urlPrimeira, depois: depois.urlPrimeira });

  // ── 4. AS URLS MORREM COM A FOLHA ─────────────────────────────────────────
  const soltou = await pg.evaluate(async (url) => {
    closeLyricsPopup();
    // Uma URL de objeto revogada não resolve mais: é a prova de que o Blob foi
    // solto, e não uma leitura de variável interna.
    try { await fetch(url); return false; } catch (_) { return true; }
  }, dado.urlPrimeira);
  checar(soltou,
    'FECHAR A FOLHA REVOGA as URLs das miniaturas — sem isso cada abertura '
    + 'segura os Blobs de uma apresentação inteira até a página morrer');

  // ── 5. E A MÚSICA VOLTA A TER AS ABAS DELA ────────────────────────────────
  const volta = await pg.evaluate(() => {
    currentItem = {
      id: 'cena', name: 'Louvor Em Cena', kind: 'audio', seconds: 200,
      lyrics: [{ cover: true }, { text: 'primeira estrofe' }],
    };
    lvSource = null;
    renderSlideNav();
    openLyricsPopup();
    return {
      fontes: lyricsViewSources(), ativa: lvActiveSource(),
      fonteCtl: document.querySelector('#lyricsPopup .lv-fonte-ctl').hidden,
    };
  });
  checar(volta.fonteCtl === false,
    'e o A+/A− VOLTA com a letra — sem esta metade, escondê-lo para sempre '
    + 'passaria na asserção acima', volta.fonteCtl);
  checar(volta.fontes.includes('lyrics') && volta.ativa === 'lyrics',
    'e a exclusividade NÃO VAZA: saindo da apresentação a música recupera a '
    + 'letra — sem esta metade, "esconder tudo" passaria nas asserções acima',
    volta);
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
