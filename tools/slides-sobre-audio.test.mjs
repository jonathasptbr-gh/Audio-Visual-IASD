#!/usr/bin/env node
// ============================================================================
// A APRESENTAÇÃO É UMA CAMADA, E A MÚSICA TOCA POR BAIXO (v1.4.28)
//
// Pedido do operador, verbatim:
//
//   *"adicione a possibilidade de música atrás dos slides. Atualmente são
//   concorrentes, mas os slides devem ser tratados como camada, assim como as
//   imagens ou os textos e mensagens."*
//
// É o irmão do `imagem-sobre-audio.test.mjs`, e nasce pela mesma razão: **a
// regra é uma AUSÊNCIA** — nenhum `load` sai deste caminho —, e ausência não
// tem sintoma de tela nem erro no console. O motor tem UM slot de mídia
// (`loadInner` faz `video.pause()` + `removeAttribute('src')` sem condição), e
// por isso qualquer `load` mata o louvor. Daí medir o `currentTime` em DOIS
// instantes: *"não pausou"* é fraco (um `<video>` sem `src` também responde
// `paused:false` por um átimo); *"andou"* prova que é o MESMO áudio correndo
// por baixo do cartão.
//
// ## O que ele mede que o irmão não mede
//
// Uma imagem não tem para onde ir; **um deck tem PÁGINAS**, e é isso que este
// arquivo existe para prender:
//
//  - **O ⏮/⏭ volta a ter eixo** (`slideTarget` devolve `'deck'` onde a imagem
//    devolve `null`), e passar página **não** pode tocar no áudio.
//  - **A página anda por um caminho DIFERENTE.** Como mídia, o deck está no
//    slot do motor e a página anda por `page`; como CAMADA, ela anda reenviando
//    o `text`. Um `page` mandado para a camada não acha deck nenhum no motor e
//    **não faz NADA** — sem erro, com o operador apertando o botão na frente da
//    congregação.
//  - **AS TRÊS METADES QUE PINTAM.** O telão (`pintarTextImg`), a PREVIEW
//    (`pintarPvTextImg`) e a folha do auxiliar escolhem o blob da página cada
//    uma por sua conta. É a armadilha do `fundo-da-letra`: *ler cada lado
//    isolado aprova os dois* — sem a metade da preview, ela mostraria a página
//    1 para sempre enquanto o telão passa slides, e SEM TV a preview É a
//    projeção.
//  - **E O AUXILIAR PASSA A OFERECER AS DUAS CAMADAS.** É a consequência
//    direta do pedido anterior (v1.4.26): com a apresentação por cima do
//    louvor, Páginas E Letra E Cifra estão em exibição.
//
// ## E a ORDEM DAS ABAS, que é o outro pedido do mesmo lote
//
//   *"a aba da bíblia está entre a letra e a cifra, coloque ela à esquerda,
//   pois letra e cifra são irmãs, sempre juntas quando ambas existem"*.
//
// A ordem certa já existia — é a pilha do `lyricsViewSources`. O que havia era
// uma SEGUNDA ordem, a do HTML estático, que divergiu em silêncio. A asserção é
// sobre o DOM, e não sobre a lista: a lista já estava certa quando a tela
// estava errada, e é exatamente por isso que ela não prova nada aqui.
//
//   node tools/slides-sobre-audio.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');

const servidor = servirEstatico(RAIZ);

const PAGINAS = 5;

// O acervo: um WAV de 20 s (longo de propósito — uma faixa que acabasse no meio
// responderia `paused:true` por ter ACABADO, indistinguível de interrompida) e
// uma apresentação de páginas de COR DIFERENTE. A cor é o que faz a asserção da
// página valer: com páginas idênticas, "pintou a página 3" e "continuou na 1"
// produzem o mesmo pixel.
const SEMEAR = `
  const sr = 8000, secs = 20, n = sr * secs;
  const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  wr(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
  const a = await AVDB.addMedia(new Blob([buf], { type: 'audio/wav' }), {
    name: 'Louvor de fundo', type: 'audio/wav', kind: 'audio', list: 'imports',
  });
  const pages = [];
  for (let i = 0; i < ${PAGINAS}; i++) {
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 18;
    const c = cv.getContext('2d');
    c.fillStyle = 'hsl(' + (i * 61) + ',70%,50%)';
    c.fillRect(0, 0, 32, 18);
    pages.push(await new Promise((r) => cv.toBlob(r, 'image/png')));
  }
  // addDeck, e nao addMedia com um campo a mais: o registro de uma apresentacao
  // e feito por essa porta no app inteiro, e makeMediaRecord so guarda os campos
  // que ela nomeia — um pages passado ao addMedia some em SILENCIO, e o que se
  // mediria seria uma imagem com nome de deck.
  const d = await AVDB.addDeck(pages, { name: 'Semana da Familia', list: 'imports' });
`;

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;
function ouvir(pg, rotulo) {
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(rotulo + ': ' + t);
  });
  pg.on('pageerror', (e) => erros.push(rotulo + ' pageerror: ' + e.message));
}

try {
  // ======================================================================
  // METADE 1 — O CONTROLE sobrepõe em vez de substituir
  // ======================================================================
  const pg = await ctx.newPage();
  ouvir(pg, 'controle');
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 20000 });

  const ids = await pg.evaluate(new Function('return (async () => {'
    + 'setAppMode("full");' + SEMEAR + 'await load(); return { audio: a.id, deck: d.id }; })()'));

  // O BARRAMENTO, gravado: o que prova a AUSÊNCIA de `load` é o que sai por
  // ele. Um teste do desfecho de tela não distingue "sobrepôs" de "substituiu e
  // por acaso ainda não pausou".
  await pg.evaluate(() => {
    window.__cmds = [];
    const real = AVDB.sendCommand.bind(AVDB);
    AVDB.sendCommand = (o) => { window.__cmds.push(o); return real(o); };
  });

  const espiar = () => pg.evaluate(() => {
    const v = document.querySelector('#preview video') || document.querySelector('video');
    const im = document.getElementById('pvTextImg');
    return {
      pausado: v ? v.paused : null,
      tempo: v ? v.currentTime : null,
      cartao: !document.getElementById('pvText').hidden,
      imgSrc: (im && !im.hidden) ? (im.getAttribute('src') || '') : '',
      kind: currentItem ? currentItem.kind : null,
      currentId,
      camada: visualSobreProjetando(),
      deckDaCamada: deckSobreProjetando(),
      pagina: deckPagina,
      eixo: slideTarget(),
      cmds: window.__cmds.map((c) => c.type + (c.page !== undefined ? ':' + c.page : '')),
    };
  });

  await pg.evaluate((id) => send(id), ids.audio);
  await pg.waitForTimeout(1200);
  // A LETRA vai no registro EM MEMÓRIA: `makeMediaRecord` não guarda `lyrics`
  // (quem as escreve no acervo é o `syncLyrics`, por uma transação que o `AVDB`
  // não expõe), e é do registro em memória que o auxiliar lê. É o mesmo atalho
  // do `leitor-camadas.test.mjs`.
  await pg.evaluate(() => {
    currentItem.lyrics = [{ cover: true }, { time: 0, text: 'primeira estrofe' },
      { time: 9, text: 'segunda estrofe' }];
  });
  const p0 = await espiar();
  checar(!p0.pausado && p0.tempo > 0 && p0.kind === 'audio',
    'ponto de partida: o louvor de fundo está tocando', p0);

  // ── O TOQUE NA APRESENTAÇÃO ───────────────────────────────────────────────
  await pg.evaluate(() => { window.__cmds = []; });
  await pg.evaluate((id) => send(id), ids.deck);
  await pg.waitForTimeout(700);
  const p1 = await espiar();
  await pg.waitForTimeout(900);
  const p2 = await espiar();

  checar(!p1.cmds.includes('load'),
    'A APRESENTAÇÃO NÃO EMITE `load` — a regra é uma AUSÊNCIA, e é ela que '
    + 'impede o slot único do motor de matar o louvor', p1.cmds);
  checar(p1.cmds.some((c) => c.startsWith('text:')),
    '  ↳ o que sai é um `text` com a PÁGINA: a apresentação entra pela Camada '
    + 'de Texto, como a imagem e o versículo', p1.cmds);
  checar(p1.camada && p1.deckDaCamada && p1.currentId === ids.audio,
    '  ↳ e o item EM CENA continua sendo o áudio: o deck está na camada, não no '
    + 'slot da mídia', p1);
  checar(!p2.pausado && p2.tempo > p1.tempo + 0.4,
    'O LOUVOR CONTINUA ANDANDO por baixo dos slides — medido em dois instantes, '
    + 'porque "não pausou" é fraco', { t1: p1.tempo, t2: p2.tempo });
  checar(p1.cartao && p1.imgSrc,
    '  ↳ e a PREVIEW desenha a página (sem TV ela É a projeção)', p1);

  // ── O EIXO DO ⏮/⏭ VOLTA, E PASSAR PÁGINA NÃO TOCA NO ÁUDIO ────────────────
  checar(p1.eixo === 'deck',
    'O ⏮/⏭ VOLTA A TER EIXO: uma imagem não tem para onde ir e devolve `null`; '
    + 'uma apresentação tem PÁGINAS', p1.eixo);

  await pg.evaluate(() => { window.__cmds = []; document.getElementById('slideNextBtn').click(); });
  await pg.waitForTimeout(400);
  const p3 = await espiar();
  checar(p3.pagina === 1 && !p3.cmds.includes('page') && p3.cmds.includes('text:1'),
    'PASSAR PÁGINA NA CAMADA reenvia o `text` com o número novo, e NÃO manda '
    + '`page` — um `page` não acha deck nenhum no motor e não faria NADA, sem '
    + 'erro, com o operador apertando o botão', p3);
  checar(p3.imgSrc && p3.imgSrc !== p1.imgSrc,
    '  ↳ e a PREVIEW repinta a página nova. Sem esta metade ela ficaria na '
    + 'página 1 para sempre enquanto o telão passa slides — *ler cada lado '
    + 'isolado aprova os dois*', { antes: p1.imgSrc, depois: p3.imgSrc });
  await pg.waitForTimeout(800);
  const p4 = await espiar();
  checar(!p4.pausado && p4.tempo > p3.tempo + 0.4,
    '  ↳ e o louvor segue andando depois da virada', { t3: p3.tempo, t4: p4.tempo });

  // ── O AUXILIAR OFERECE AS DUAS CAMADAS, NA ORDEM DA PILHA ─────────────────
  const folha = await pg.evaluate(() => {
    openLyricsPopup();
    const seg = document.getElementById('lyricsViewSeg');
    return {
      fontes: lyricsViewSources(),
      ativa: lvActiveSource(),
      // A ORDEM NO DOM, que é o que o operador vê — e não a lista, que já
      // estava certa quando a tela estava errada.
      ordemNaTela: [...seg.querySelectorAll('.fit-opt')]
        .filter((b) => !b.hidden).map((b) => b.dataset.lvsrc),
      linhas: document.querySelectorAll('#lyricsViewBody .lv-row--slide').length,
      marcada: [...document.querySelectorAll('#lyricsViewBody .lv-row')]
        .findIndex((l) => l.classList.contains('current')),
    };
  });
  // SEM A CIFRA, e é o app estando certo: `cifraCabe` exige `window.__NATIVE__`,
  // e este oráculo não injeta ponte — ele toca ÁUDIO DE VERDADE e abre o
  // `/display/` real, e uma ponte de mentira mudaria os dois. Quem mede a pilha
  // com as três é o `leitor-camadas.test.mjs`, que tem ponte e não tem áudio.
  checar(folha.fontes.join(',') === 'deck,lyrics' && folha.ativa === 'deck',
    'O AUXILIAR OFERECE AS DUAS CAMADAS — Páginas por cima, a Letra do louvor '
    + 'de fundo por baixo — e abre nas Páginas', folha);
  checar(folha.linhas === PAGINAS && folha.marcada === 1,
    '  ↳ a coluna é a da apresentação SOBREPOSTA, e a página em cena é a '
    + 'marcada: `lvItem()` aqui é a MÚSICA, e perguntar páginas a ela devolveria '
    + 'nada', folha);
  checar(folha.ordemNaTela.join(',') === 'deck,lyrics',
    '  ↳ e a ordem NA TELA é a da pilha, não a do HTML estático — onde "Letra" '
    + 'vem ANTES de "Páginas"', folha.ordemNaTela);

  // ── A BÍBLIA POR CIMA DE TUDO: o pedido da ordem das abas ─────────────────
  const tresCamadas = await pg.evaluate(() => {
    closeLyricsPopup();
    bibleSession = {
      versionId: 'nvi', bookIdx: 18, bookId: 'sal', bookName: 'Salmos', chapter: 23,
      verses: [{ n: 1, text: 'O Senhor é o meu pastor.' }, { n: 2, text: 'Nada me faltará.' }],
      idx: 0, projecting: true,
    };
    renderSlideNav();
    openLyricsPopup();
    const seg = document.getElementById('lyricsViewSeg');
    const vis = [...seg.querySelectorAll('.fit-opt')].filter((b) => !b.hidden)
      .map((b) => b.dataset.lvsrc);
    return { ordemNaTela: vis, ativa: lvActiveSource() };
  });
  checar(tresCamadas.ordemNaTela[0] === 'bible',
    'A BÍBLIA FICA À ESQUERDA — o pedido: ela é a camada da frente, e a aba da '
    + 'frente é a primeira', tresCamadas.ordemNaTela);
  checar(tresCamadas.ordemNaTela.join(',') === 'bible,deck,lyrics',
    '  ↳ e a TELA inteira segue a pilha, camada por camada: o versículo, o '
    + 'slide, a música por baixo. No HTML estático esta ordem é "Letra, Bíblia, '
    + 'Páginas" — a segunda lista, que ninguém tinha razão para manter em dia',
    tresCamadas.ordemNaTela);
  checar(tresCamadas.ativa === 'bible',
    '  ↳ e a folha abre na Bíblia, que é o que está por cima', tresCamadas.ativa);

  // ── TIRAR A CAMADA DEIXA O LOUVOR NO AR ───────────────────────────────────
  const saiu = await pg.evaluate(() => {
    closeLyricsPopup();
    bibleSession = null;
    hideVisualSobre();
    return { camada: visualSobreProjetando(), currentId, eixo: slideTarget() };
  });
  await pg.waitForTimeout(700);
  const p5 = await espiar();
  await pg.waitForTimeout(800);
  const p6 = await espiar();
  checar(!saiu.camada && saiu.currentId === ids.audio && !p5.cartao,
    'TIRAR A APRESENTAÇÃO deixa o louvor no ar — é a mesma porta da imagem '
    + '(`text-hide`), e o áudio nunca esteve no caminho dela', { saiu, p5 });
  checar(!p6.pausado && p6.tempo > p5.tempo + 0.4,
    '  ↳ e ele continua andando depois disso', { t5: p5.tempo, t6: p6.tempo });

  // ── A REVERSÃO QUE IMPEDE "SOBREPOR SEMPRE" ───────────────────────────────
  // Sem áudio no ar, uma apresentação continua entrando como MÍDIA, com `load`
  // e com `page`. Sem esta metade, trocar o caminho por completo passaria em
  // tudo acima e a apresentação sozinha nunca mais projetaria.
  const semAudio = await pg.evaluate(async (id) => {
    retirarDoAr();
    await new Promise((r) => setTimeout(r, 300));
    window.__cmds = [];
    await send(id);
    await new Promise((r) => setTimeout(r, 400));
    window.__cmds = [];
    document.getElementById('slideNextBtn').click();
    return {
      kind: currentItem ? currentItem.kind : null,
      camada: visualSobreProjetando(),
      pagina: deckPagina,
      cmds: window.__cmds.map((c) => c.type + (c.page !== undefined ? ':' + c.page : '')),
      eixo: slideTarget(),
    };
  }, ids.deck);
  checar(semAudio.kind === 'deck' && !semAudio.camada && semAudio.eixo === 'deck',
    'SEM ÁUDIO NO AR a apresentação continua entrando como MÍDIA — sem esta '
    + 'metade, "sobrepor sempre" passaria em tudo acima', semAudio);
  checar(semAudio.cmds.includes('page:1'),
    '  ↳ e ali a página anda por `page`, que é o caminho do motor', semAudio.cmds);

  // ======================================================================
  // METADE 2 — O TELÃO pinta a PÁGINA, e o áudio dele sobrevive
  // ======================================================================
  const tv = await ctx.newPage();
  ouvir(tv, 'display');
  await tv.goto(base + '/display/', { waitUntil: 'load' });
  await tv.waitForFunction(() => !!window.AVDB && !!document.getElementById('textImg'), null, { timeout: 20000 });

  const idsTv = await tv.evaluate(new Function('return (async () => {' + SEMEAR
    + 'return { audio: a.id, deck: d.id }; })()'));

  const mandar = (c) => tv.evaluate((cmd) => {
    const bc = new BroadcastChannel('av-iasd');
    bc.postMessage(cmd); bc.close();
  }, c);

  // A COR do pixel é a prova de QUAL página está na tela — com páginas
  // idênticas, "pintou a 3" e "continuou na 1" dariam o mesmo resultado.
  const olhar = () => tv.evaluate(async () => {
    const v = document.getElementById('video');
    const im = document.getElementById('textImg');
    let cor = null;
    if (im && !im.hidden && im.getAttribute('src')) {
      try {
        await im.decode();
        const cv = document.createElement('canvas');
        cv.width = 1; cv.height = 1;
        cv.getContext('2d').drawImage(im, 0, 0, 1, 1);
        cor = [...cv.getContext('2d').getImageData(0, 0, 1, 1).data].slice(0, 3).join(',');
      } catch (_) { cor = 'erro'; }
    }
    return {
      pausado: v ? v.paused : null,
      tempo: v ? v.currentTime : null,
      cartao: !document.getElementById('text').hidden,
      modoImg: document.getElementById('text').classList.contains('mode-img'),
      textoVazio: !document.getElementById('textMain').textContent.trim(),
      cor,
    };
  });

  await mandar({ type: 'load', mediaId: idsTv.audio, view: 'visual', muted: true, volume: 0 });
  await tv.waitForTimeout(1400);
  const t0 = await olhar();
  checar(!t0.pausado && t0.tempo > 0, 'no TELÃO o louvor está tocando (ponto de partida)', t0);

  await mandar({ type: 'text', mode: 'image', mediaId: idsTv.deck, page: 0, sub: '', view: 'visual' });
  await tv.waitForTimeout(900);
  const t1 = await olhar();
  checar(t1.cartao && t1.modoImg && t1.textoVazio && t1.cor && t1.cor !== 'erro',
    'o TELÃO desenha a PÁGINA da apresentação (e não um cartão de texto vazio: '
    + 'um `mode` desconhecido cai no ramo `verse` e pinta preto)', t1);

  await mandar({ type: 'text', mode: 'image', mediaId: idsTv.deck, page: 3, sub: '', view: 'visual' });
  await tv.waitForTimeout(900);
  const t2 = await olhar();
  checar(t2.cor && t2.cor !== 'erro' && t2.cor !== t1.cor,
    '  ↳ e a PÁGINA 4 é OUTRA imagem: a prova é a COR do pixel, porque com '
    + 'páginas idênticas "pintou a 4" e "continuou na 1" são o mesmo resultado',
    { pagina1: t1.cor, pagina4: t2.cor });
  await tv.waitForTimeout(800);
  const t3 = await olhar();
  checar(!t3.pausado && t3.tempo > t2.tempo + 0.4,
    '  ↳ e o louvor do TELÃO continua andando por baixo dos slides',
    { t2: t2.tempo, t3: t3.tempo });

  await mandar({ type: 'text-hide' });
  await tv.waitForTimeout(600);
  const t4 = await olhar();
  await tv.waitForTimeout(800);
  const t5 = await olhar();
  checar(!t4.cartao && !t4.modoImg && t4.cor === null,
    'o `text-hide` tira a apresentação do telão e solta a imagem', t4);
  checar(!t5.pausado && t5.tempo > t4.tempo + 0.4,
    '  ↳ e o áudio do telão segue tocando depois disso', { t4: t4.tempo, t5: t5.tempo });

  checar(erros.length === 0, 'nenhum erro de console nas duas metades', erros.slice(0, 4));
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
