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
// > **A v1.4.26 mudou o MECANISMO dessa segunda metade, não o resultado.** Ela
// > era um `return ['deck']` que excluía todo o resto; hoje a lista é a PILHA
// > do que está em exibição, e uma apresentação continua sozinha porque um deck
// > não tem letra nem acorde — não porque a regra cale os outros. A asserção
// > continua valendo ao pé da letra do pedido, e quem mede a pilha em si é o
// > `leitor-camadas.test.mjs`.
//
// E a v1.4.26 acrescentou o TOQUE: *"preciso da capacidade de tocar nos slides
// para passar ou pular diretamente para um slide em específico"*. A metade que
// falha calada ali é a OUTRA — um toque numa folha aberta da Biblioteca não
// pode projetar nada, e "nada aqui projeta" é a promessa inteira do `lvAlvo`.
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
  // O BARRAMENTO, gravado: o que prova um salto de página é o COMANDO que sai,
  // não a classe que mudou — a classe é o que a folha desenha, e o telão só
  // sabe do `page`.
  await pg.evaluate(() => {
    window.__cmds = [];
    const real = AVDB.sendCommand.bind(AVDB);
    AVDB.sendCommand = (o) => { window.__cmds.push(o); return real(o); };
  });

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

  // ── 2b. O SELO SOBRE A MINIATURA, E O "● NO AR" NA PÁGINA EM CENA ─────────
  //
  // Pedido do operador (v1.4.35): *"coloque o número da página sobreposto ao
  // slide, para o slide poder ficar centralizado, e use um 'no ar', ao lado do
  // indicador de página para indicar a página atual, assim como já usamos em
  // diversos elementos no app"*.
  //
  // As duas metades são MEDIDAS NO RENDERIZADO, e nenhuma delas tem teste de
  // classe possível: um selo com a classe certa e sem a regra de CSS continua
  // desenhando o número numa coluna à esquerda, e um `.row-live` presente em
  // toda linha (é assim que ele nasce — ver `lvBuildDeck`) "existe" em todas
  // elas se a pergunta for pelo nó em vez de pelo `display`.
  const selo = await pg.evaluate(() => {
    const linhas = [...document.querySelectorAll('#lyricsViewBody .lv-row--slide')];
    const cur = document.querySelector('#lyricsViewBody .lv-row--slide.current');
    const cr = cur.getBoundingClientRect();
    const img = cur.querySelector('.lv-slide').getBoundingClientRect();
    const sel = cur.querySelector('.lv-selo').getBoundingClientRect();
    const cs = getComputedStyle(cur.querySelector('.lv-selo'));
    // A COR MEDIDA CONTRA O TOKEN, e não contra um literal: um `rgb(...)` escrito
    // aqui envelhece na primeira troca de paleta e passa a reprovar um app certo.
    const sonda = document.createElement('span');
    document.body.appendChild(sonda);
    sonda.style.background = 'var(--live-fill)';
    const live = getComputedStyle(sonda).backgroundColor;
    sonda.style.background = 'var(--accent-fill)';
    const accent = getComputedStyle(sonda).backgroundColor;
    sonda.remove();
    const outra = linhas.find((l) => !l.classList.contains('current'));
    return {
      // SOBREPOSTO: a caixa do selo cabe dentro da caixa da imagem.
      dentroDaImagem: sel.left >= img.left - 0.5 && sel.top >= img.top - 0.5
        && sel.right <= img.right + 0.5 && sel.bottom <= img.bottom + 0.5,
      // CENTRALIZADO: a miniatura ocupa a linha inteira — nenhuma coluna de
      // número roubando largura à esquerda.
      imgLargura: Math.round(img.width), linhaLargura: Math.round(cr.width),
      fundo: cs.backgroundColor, live, accent,
      liveNaAtual: getComputedStyle(cur.querySelector('.row-live')).display,
      liveNaOutra: getComputedStyle(outra.querySelector('.row-live')).display,
      textoAtual: cur.querySelector('.lv-selo').textContent.replace(/\s+/g, ' ').trim(),
      // O selo não pode roubar o toque da linha.
      cliques: cs.pointerEvents,
    };
  });
  checar(selo.dentroDaImagem,
    'O NÚMERO É SOBREPOSTO À MINIATURA — a caixa do selo cabe dentro da caixa da '
    + 'imagem, e não numa coluna ao lado dela', selo);
  checar(selo.imgLargura >= selo.linhaLargura - 20,
    '  ↳ e por isso a MINIATURA ocupa a linha: sem a coluna do número não há o '
    + 'que compensar, e uma página 4:3 aparece centrada pelo `object-fit`',
    { img: selo.imgLargura, linha: selo.linhaLargura });
  checar(selo.liveNaAtual !== 'none' && selo.liveNaOutra === 'none'
    && /No ar/.test(selo.textoAtual),
    'O "● NO AR" APARECE AO LADO DO NÚMERO, e só na página em cena. Ele nasce em '
    + 'TODA linha e quem o revela é o CSS — `lvMarkCurrent` move a classe sem '
    + 'redesenhar, e criá-lo no JS seria um segundo lugar para divergir', selo);
  checar(selo.fundo === selo.live && selo.fundo !== selo.accent,
    '  ↳ e o selo em cena veste o par das LISTAS (`--live-fill`), não o '
    + '`--accent-fill` da v1.4.24: acento é ESCOLHA entre alternativas, vermelho '
    + 'saturado é *está no ar agora* — e uma página projetada é o segundo caso',
    selo);
  checar(selo.cliques === 'none',
    '  ↳ e o selo não rouba o toque da linha: ele é RÓTULO, e quem pula a página '
    + 'é o toque na linha inteira', selo.cliques);

  // A GRADE DE DUAS COLUNAS É DO MODO FÁCIL, E SÓ DELE. Aqui a altura é a de um
  // bottom-sheet, e a miniatura larga é o que faz a página se reconhecer — foi
  // por isso que ela ocupa a largura desde a v1.4.24. Sem esta metade, aplicar a
  // grade ao app inteiro passaria no oráculo do outro modo e encolheria a folha
  // que o pedido não menciona.
  const umaColuna = await pg.evaluate(() => {
    const zona = document.getElementById('lyricsViewBody');
    const linhas = [...zona.querySelectorAll('.lv-row--slide')];
    return {
      display: getComputedStyle(zona).display,
      ladoALado: Math.abs(linhas[0].getBoundingClientRect().top
        - linhas[1].getBoundingClientRect().top) < 2,
    };
  });
  checar(umaColuna.display !== 'grid' && !umaColuna.ladoALado,
    '  ↳ e AQUI as páginas continuam em UMA coluna: a grade de duas é do Modo '
    + 'Fácil, onde a altura é curta. Nesta folha a miniatura larga é o que faz a '
    + 'página se reconhecer', umaColuna);

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

  // ── 3b. O TOQUE PULA DIRETO PARA A PÁGINA ─────────────────────────────────
  const tocou = await pg.evaluate(() => {
    window.__cmds = [];
    const linhas = [...document.querySelectorAll('#lyricsViewBody .lv-row')];
    linhas[6].click();
    return {
      pagina: deckPagina,
      atual: [...document.querySelectorAll('#lyricsViewBody .lv-row')]
        .findIndex((l) => l.classList.contains('current')),
      cmds: window.__cmds.filter((c) => c.type === 'page'),
      tocavel: linhas.every((l) => l.classList.contains('lv-row--tocavel')),
    };
  });
  checar(tocou.pagina === 6 && tocou.atual === 6,
    'O TOQUE NUMA PÁGINA PULA DIRETO PARA ELA — o pedido, e o salto é para '
    + 'FRENTE e para trás sem passar pelas do meio', tocou);
  checar(tocou.cmds.length === 1 && tocou.cmds[0].page === 6,
    '  ↳ e o que sai é UM comando `page` para o telão, pelo mesmo caminho do '
    + '⏮/⏭ (`deckIr`) — não um segundo jeito de saltar', tocou.cmds);
  checar(tocou.tocavel,
    '  ↳ com a apresentação em cena TODA linha é tocável', tocou.tocavel);

  // ── 3c. E UMA FOLHA DA BIBLIOTECA NÃO PROJETA NADA ────────────────────────
  // É a promessa inteira do `lvAlvo`: abrir uma mídia para ler sem que a
  // congregação veja. Um toque que mandasse `page` a partir dali a romperia — e
  // em silêncio, porque quem está lendo não olha o telão.
  const daBiblioteca = await pg.evaluate(async () => {
    closeLyricsPopup();
    const pages = [];
    for (let i = 0; i < 3; i++) {
      const cv = document.createElement('canvas');
      cv.width = 160; cv.height = 90;
      cv.getContext('2d').fillRect(0, 0, 160, 90);
      pages.push(await new Promise((r) => cv.toBlob(r, 'image/png')));
    }
    const outra = { id: 'outra', name: 'Outra apresentação', kind: 'deck', pages };
    openLyricsPopup(outra);
    window.__cmds = [];
    const linhas = [...document.querySelectorAll('#lyricsViewBody .lv-row')];
    linhas[2].click();
    return {
      tocavel: linhas.some((l) => l.classList.contains('lv-row--tocavel')),
      cmds: window.__cmds.length,
      pagina: deckPagina,
      marcada: linhas.findIndex((l) => l.classList.contains('current')),
    };
  });
  checar(!daBiblioteca.tocavel && daBiblioteca.cmds === 0 && daBiblioteca.pagina === 6,
    'e a folha de uma apresentação da BIBLIOTECA não projeta nada: as linhas '
    + 'não são tocáveis, o toque não emite comando e a página em cena não se '
    + 'mexe — "nada aqui projeta" é a promessa do `lvAlvo`', daBiblioteca);
  checar(daBiblioteca.marcada === -1,
    '  ↳ e nenhuma página é marcada nela: aquela apresentação não está no ar, e '
    + 'destacar uma seria inventar uma referência', daBiblioteca.marcada);

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
