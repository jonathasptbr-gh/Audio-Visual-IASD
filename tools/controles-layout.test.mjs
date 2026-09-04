#!/usr/bin/env node
// ============================================================================
// O DECK: OS DOIS BOTÕES DE SLIDE E A COLUNA DE OPERAÇÃO SOBRE A PREVIEW
//
// ## Por que ele existe
//
// A v1.3.5 mexeu no layout dos controles a pedido do operador, e as quatro
// mudanças falham CALADAS — nenhuma delas dá erro de console, e três produzem
// uma tela que continua parecendo certa:
//
//  1. **⏮/⏭ do transporte perderam o eixo de estrofe.** Se a troca não pegar,
//     o botão continua passando ESTROFE quando há letra no ar — o operador
//     toca em "próxima mídia" e a música não troca. É o defeito mais caro:
//     acontece no meio de um louvor e não deixa rastro nenhum.
//  2. **Os dois botões de slide voltaram à tela**, um de cada lado da preview.
//     Eles já existiam no DOM (ocultos) e já eram o ponto único onde
//     `applySlideLimits` guarda "dá para passar slide agora?" — mas um botão
//     desenhado do lado ERRADO da miniatura é um par que se opera invertido.
//  3. **A ARMADILHA DO `<use>`.** A cortina e o mudo trocam de desenho por
//     `.ico-base`/`.ico-alt`, e o conteúdo clonado por um `<use>` mora numa
//     árvore-SOMBRA que a folha do documento NÃO alcança. Um único `<symbol>`
//     com os dois desenhos dentro compilaria, carregaria e desenharia — os
//     DOIS ao mesmo tempo, um por cima do outro. Daí cada estado ser um
//     símbolo e o consumidor pendurar dois `<use>`, que são elementos da
//     árvore de luz. A asserção é QUAL SÍMBOLO está no ar em cada estado —
//     ver a seção 4 para as duas asserções mais óbvias que foram tentadas e
//     APROVAM a armadilha (a contagem de nós e a foto do botão).
//  4. **O Modo Fácil não pode herdar a coluna de operação.** A preview é UM nó
//     só e MUDA DE CASA (`hostPreview`): tudo o que se pendura nela viaja
//     junto. Lá o mudo já é uma tecla grande própria, e o resto do modo existe
//     justamente para não ter controles.
//
// ## O que ele NÃO cobre
//
// A ESTÉTICA. Ele mede posição relativa (quem está à esquerda de quem), não
// pixel — a base pede `system-ui, sans-serif` e quem responde é a fonte da
// máquina. Ver "Um oráculo não pode medir o runner" no CLAUDE.md.
//
//   node tools/controles-layout.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

// A ponte de mentira: o modo avançado é o território deste oráculo, e sem
// `__NATIVE__` metade das guardas do deck nem roda.
const PONTE = `(() => {
  const B = {
    shellVersion: () => 55,
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal','castTarget',
    'cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages','displays',
    'espelhoCertApagar','espelhoCertEstado','espelhoCertImportar','espelhoDerrubar',
    'espelhoDesligar','espelhoDiag','espelhoEstado','espelhoLigar','keepAlive','listFolder',
    'micDiag','nowPlaying','openCast','openExternal','otaApply','otaCheck','otaDiag',
    'otaPending','pickDoc','pickFolder','requestMic','salvarTexto','systemVolume','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio',
    'ytPlaylist','ytSearch','ytStream','areaTransferencia','atualizacaoEstado'];
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
const servidor = servirEstatico(RAIZ);

await new Promise((r) => servidor.listen(0, r));
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = 'http://localhost:' + servidor.address().port;

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  // O mesmo critério do watchdog do OTA: o `init()` é assíncrono e termina
  // DEPOIS do `load`. Plantar cena antes disso é correr contra a inicialização.
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );
  // O modo avançado, que é onde o deck existe: o app abre no Modo Fácil e a
  // barra de transporte inteira nasce `display: none`.
  await pg.evaluate(() => setAppMode('full'));

  // ── 1. UM VÃO SÓ, E SETE CÉLULAS IGUAIS ────────────────────────────────
  //
  // A asserção é a INVARIANTE, não um retrato: **todo vão do deck mede
  // `--deck-gap`, e as sete células da linha de baixo são idênticas**. Antes
  // eram três valores de vão (.6rem entre colunas, .45rem entre linhas, .35rem
  // no transporte) mais duas folgas que ninguém declarou — a faixa fixa de
  // 150px em volta de uma preview de 128, e a coluna do meio mais larga que a
  // miniatura que mora nela.
  //
  // MEDE EM DUAS PROPORÇÕES DE TELÃO, e isso é o oráculo, não cenário: as duas
  // folgas apareciam em regimes OPOSTOS. Com uma TV larga (2,16:1) a preview é
  // limitada pela LARGURA e sobrava faixa em cima e embaixo; com 16:9 ela era
  // limitada pela ALTURA e sobrava coluna dos dois lados. Uma proporção só
  // aprova metade do defeito.
  //
  // `--pv-ar` no `documentElement` é onde o próprio app a escreve, a partir de
  // `AVNative.displays()` — é uma TV conectada, não um truque.
  const medirDeck = () => pg.evaluate(() => {
    const cx = (sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return { esq: +r.left.toFixed(2), dir: +r.right.toFixed(2), topo: +r.top.toFixed(2),
        base: +r.bottom.toFixed(2), alto: +r.height.toFixed(2), larg: +r.width.toFixed(2) };
    };
    const seis = [...document.querySelectorAll('.transport .t-btn')].map((e) => {
      const r = e.getBoundingClientRect();
      return { esq: +r.left.toFixed(2), dir: +r.right.toFixed(2), topo: +r.top.toFixed(2),
        base: +r.bottom.toFixed(2), alto: +r.height.toFixed(2), larg: +r.width.toFixed(2) };
    });
    return {
      vao: parseFloat(getComputedStyle(document.querySelector('.deck')).rowGap),
      deck: cx('.deck'), np: cx('.nowplaying'), tr: cx('.transport'),
      seek: cx('#seek'), cur: cx('#curTime'), dur: cx('#durTime'),
      titulo: cx('#npNameInner'),
      pv: cx('.preview'), ant: cx('#slidePrevBtn'), prox: cx('#slideNextBtn'),
      // A SÉTIMA CÉLULA. Ela mudou de ocupante na v1.4.31 (era o histórico,
      // hoje é o auxiliar de leitura) e a REGRA que este bloco trava não
      // mudou: a sétima é uma de sete células idênticas, e é ela que fecha a
      // direita do deck junto com o botão de passar slide.
      hist: cx('#lyricsViewBtn'), seis,
      // ===== O CARTÃO DA LINHA DO TEMPO (v1.5.13) =====
      // O fundo EFETIVO dela e o de um botão do transporte, para o par abaixo.
      // Os dois são `--surface`, que é tinta com ALFA: `backgroundColor`
      // devolve o alfa, então quem responde "que cor o navegador pintou?" é a
      // pilha composta até o primeiro fundo opaco.
      ...(() => {
        // ===== O PARSE É POR CANVAS, E NÃO POR REGEX (v1.5.15) =====
        // `color-mix` COMPUTA como `color(srgb 1 1 1 / 0.042)`, cujos canais vão
        // de 0 a 1 — uma regex de números sobre essa string devolve (1, 1, 1) e
        // o oráculo passa a medir preto quase puro. Não erra alto: ele reprova
        // com um número plausível, e quem lê o log conclui que o app quebrou.
        // O canvas resolve QUALQUER sintaxe de cor que o navegador aceite, que
        // é exatamente a pergunta ("o que o navegador pintou?").
        const cv = document.createElement('canvas'); cv.width = cv.height = 1;
        const g2 = cv.getContext('2d', { willReadFrequently: true });
        const rgba = (c) => { g2.globalCompositeOperation = 'copy';
          g2.fillStyle = c; g2.fillRect(0, 0, 1, 1);
          const d = g2.getImageData(0, 0, 1, 1).data;
          return [d[0], d[1], d[2], d[3] / 255]; };
        // O VÉU DO PRÓPRIO ELEMENTO entra na conta (v1.5.15): um `:disabled`
        // deste app é `opacity: var(--op-inativo)`, e o que ele PINTA é a
        // superfície dele composta contra o pai. Sem isto o oráculo leria a
        // superfície CHEIA de um botão apagado — a cor que ele não tem na tela.
        const empilhar = (el, comVeu) => { const pil = []; let e = el; let veu = 1;
          while (e) { const cs = getComputedStyle(e);
            if (comVeu && e === el) veu = parseFloat(cs.opacity) || 1;
            const v = rgba(cs.backgroundColor);
            if (v[3] > 0) pil.push(v); if (v[3] === 1) break; e = e.parentElement; }
          let o = pil.pop() || [255, 255, 255, 1];
          while (pil.length) { const t = pil.pop();
            o = [0, 1, 2].map((i) => t[3] * t[i] + (1 - t[3]) * o[i]).concat([1]); }
          return [o, veu]; };
        const efetivo = (el) => {
          if (!el) return null;
          const [o, veu] = empilhar(el, true);
          let cor = o;
          if (veu < 1 && el.parentElement) {
            const pai = empilhar(el.parentElement, false)[0];
            cor = [0, 1, 2].map((i) => o[i] * veu + pai[i] * (1 - veu));
          }
          return 'rgb(' + cor.slice(0, 3).map(Math.round).join(', ') + ')'; };
        const np = document.querySelector('.nowplaying');
        const btn = document.querySelector('.transport .t-btn');
        const slide = document.getElementById('slidePrevBtn');
        return {
          npFundo: efetivo(np),
          npFundoCru: getComputedStyle(np).backgroundColor,
          npRaio: getComputedStyle(np).borderRadius,
          npPadX: [getComputedStyle(np).paddingLeft, getComputedStyle(np).paddingRight],
          btnFundo: btn ? efetivo(btn) : null,
          // O botão de slide APAGADO — a régua que o operador nomeou — e o mesmo
          // botão sem o véu, que é o tom que o cartão tinha até a v1.5.14.
          slideOff: slide && slide.disabled ? efetivo(slide) : null,
          slideCheio: slide ? (() => {
            const antes = slide.disabled; slide.disabled = false;
            const c = efetivo(slide); slide.disabled = antes; return c; })() : null,
          barFundo: efetivo(document.querySelector('.bottombar')),
        };
      })(),
    };
  });
  const perto = (a, b) => Math.abs(a - b) < 0.6;

  for (const ar of ['2.16', '1.7778']) {
    const nome = ar === '2.16' ? 'TV 2,16:1' : 'TV 16:9';
    await pg.evaluate((v) => document.documentElement.style.setProperty('--pv-ar', v), ar);
    await pg.waitForTimeout(120);
    const g = await medirDeck();

    checar(g.ant.dir <= g.pv.esq && g.prox.esq >= g.pv.dir,
      `a preview é FLANQUEADA pelos dois botões de slide (${nome})`, g);

    // TODO vão do deck é o mesmo — os cinco que cercam a preview mais o que
    // separa a sétima célula do botão de voltar.
    const vaos = {
      'nowplaying→preview': g.pv.topo - g.np.base,
      'preview→transporte': g.tr.topo - g.pv.base,
      'voltar→preview': g.pv.esq - g.ant.dir,
      'preview→passar': g.prox.esq - g.pv.dir,
      'passar→sétima': g.hist.topo - g.prox.base,
      'transporte→sétima': g.hist.esq - g.seis[5].dir,
      'entre dois do transporte': g.seis[1].esq - g.seis[0].dir,
    };
    for (const [onde, v] of Object.entries(vaos)) {
      checar(perto(v, g.vao), `o vão ${onde} é o do deck (${nome})`,
        { medido: +v.toFixed(2), esperado: g.vao });
    }

    // AS SETE CÉLULAS DA LINHA DE BAIXO. Com a coluna lateral em 56px fixos os
    // seis do transporte mediam 52,3 e o do volume 44,8 — e o vão até ele era
    // 15,2 contra os 5,6 dos outros. Era esse conjunto que se lia como "o botão
    // do volume está fora do lugar".
    const larguras = [...g.seis.map((b) => b.larg), g.hist.larg];
    const alturas = [...g.seis.map((b) => b.alto), g.hist.alto];
    checar(Math.max(...larguras) - Math.min(...larguras) < 0.6,
      `as SETE células da linha de baixo têm a mesma largura (${nome})`, larguras);
    checar(Math.max(...alturas) - Math.min(...alturas) < 0.6,
      `e a mesma altura (${nome})`, alturas);
    checar(perto(g.hist.topo, g.seis[0].topo) && perto(g.hist.base, g.seis[0].base),
      `o HISTÓRICO está na mesma linha dos seis do transporte (${nome})`,
      { hist: [g.hist.topo, g.hist.base], t: [g.seis[0].topo, g.seis[0].base] });

    // AS COLUNAS LATERAIS TÊM A LARGURA DE UM BOTÃO DO TRANSPORTE, e é isso
    // que faz as bordas do deck baterem em cima e embaixo.
    checar(perto(g.ant.larg, g.seis[0].larg) && perto(g.prox.larg, g.hist.larg),
      `os botões de slide têm a largura de um botão do transporte (${nome})`,
      { ant: g.ant.larg, prox: g.prox.larg, t: g.seis[0].larg });
    checar(perto(g.ant.esq, g.deck.esq) && perto(g.ant.esq, g.seis[0].esq),
      `a borda ESQUERDA do deck é uma só: voltar, transporte e deck (${nome})`,
      { ant: g.ant.esq, t: g.seis[0].esq, deck: g.deck.esq });
    checar(perto(g.prox.dir, g.deck.dir) && perto(g.prox.dir, g.hist.dir),
      `e a DIREITA: passar, a sétima célula e o deck (${nome})`,
      { prox: g.prox.dir, hist: g.hist.dir, deck: g.deck.dir });

    // A FAIXA É A PREVIEW: os três da linha do meio começam e terminam juntos.
    for (const [q, b] of [['VOLTAR', g.ant], ['PASSAR', g.prox]]) {
      checar(perto(b.alto, g.pv.alto) && perto(b.topo, g.pv.topo) && perto(b.base, g.pv.base),
        `o botão de ${q} tem a ALTURA da preview, topo e base juntos (${nome})`,
        { botao: [b.topo, b.base, b.alto], preview: [g.pv.topo, g.pv.base, g.pv.alto] });
    }

    // ===== A BARRA DE PROGRESSO CAI NAS COLUNAS DO DECK (v1.3.8) =====
    // Ela parava na coluna 2 (a 3 era da sétima célula), então não batia com a
    // miniatura logo abaixo e o título nascia descentrado — centrado numa
    // caixa que não era a do deck. As três asserções são as três peças.
    checar(perto(g.seek.esq, g.pv.esq) && perto(g.seek.dir, g.pv.dir),
      `a BARRA começa e termina com a preview (${nome})`,
      { seek: [g.seek.esq, g.seek.dir], preview: [g.pv.esq, g.pv.dir] });
    checar(perto(g.cur.esq, g.ant.esq) && perto(g.cur.dir, g.ant.dir),
      `o tempo DECORRIDO cai sobre o botão de voltar slide (${nome})`,
      { cur: [g.cur.esq, g.cur.dir], ant: [g.ant.esq, g.ant.dir] });
    checar(perto(g.dur.esq, g.prox.esq) && perto(g.dur.dir, g.prox.dir),
      `o tempo TOTAL cai sobre o de passar (${nome})`,
      { dur: [g.dur.esq, g.dur.dir], prox: [g.prox.esq, g.prox.dir] });
    checar(perto((g.titulo.esq + g.titulo.dir) / 2, (g.deck.esq + g.deck.dir) / 2),
      `e o TÍTULO está centrado na largura inteira do deck (${nome})`,
      { titulo: (g.titulo.esq + g.titulo.dir) / 2, deck: (g.deck.esq + g.deck.dir) / 2 });

    // ===== E ELA É UM CARTÃO (v1.5.13) =====
    // Pedido do operador: *"coloque a seção da barra de progresso da mídia …
    // dentro de um card, pois é o único elemento visual do controle que não
    // está dentro de um elemento visual. por causa da barra de buscas, ali se
    // tornou um buraco no design"*.
    //
    // TRÊS metades, e nenhuma basta sozinha:
    //
    // 1. ELA PINTA. Uma regra que só trocasse classe passaria num teste de
    //    classe e continuaria sendo um buraco na tela, então a régua é o fundo
    //    EFETIVO contra o da caixa que a hospeda.
    checar(g.npFundo !== g.barFundo,
      `a linha do tempo PINTA: ela não é mais a única peça da caixa pousada `
      + `direto no fundo (${nome})`, { cartao: g.npFundo, caixa: g.barFundo });
    // 2. E ELA PINTA O TOM DE UM CONTROLE INATIVO (v1.5.15), não um tom novo.
    //    A v1.5.13 cobrava o tom de um botão ATIVO e o operador apontou a
    //    diferença: *"ajuste o cinza dela para o mesmo cinza claro dos botões
    //    inativos de próximo e anterior slide"*. A régua continua sendo um
    //    botão RENDERIZADO — `--surface` lido de volta provaria só que a folha
    //    declara o que declara —, e é ela que impede a correção de inaugurar um
    //    degrau: no tema CLARO `--bar` é branco e `--panel` também, então um
    //    cartão em `--panel` mediria 1,00:1 contra a caixa e não existiria (a
    //    mesma aritmética da borda do campo, na v1.5.5).
    //
    //    A RÉGUA É O BOTÃO APAGADO, com o véu de `--op-inativo` composto: os
    //    dois lados do `===` saem do MESMO caminho de medição, então um véu que
    //    mude num lugar só reprova aqui em vez de sair na tela.
    checar(g.slideOff !== null && g.npFundo === g.slideOff,
      `e ela veste o tom de um controle INATIVO — o cinza dos botões de slide `
      + `apagados, e não o do botão aceso (${nome})`,
      { cartao: g.npFundo, slideApagado: g.slideOff, slideAceso: g.slideCheio });
    // 2-bis. E A REVERSÃO: o tom do botão ACESO é outro. Sem esta metade, um
    //    `--op-inativo` que fosse a 1 (ou o véu apagado por engano) devolveria
    //    a v1.5.13 e a asserção acima continuaria passando — os dois lados
    //    voltariam a ser a mesma superfície cheia, concordando em silêncio.
    checar(g.slideCheio !== null && g.slideOff !== g.slideCheio
      && g.npFundo !== g.slideCheio,
      `e o INATIVO é de fato outro tom que o ATIVO — o véu existe (${nome})`,
      { cartao: g.npFundo, slideApagado: g.slideOff, slideAceso: g.slideCheio });
    // 3. E O RECUO É SÓ VERTICAL. Um `padding` horizontal aqui comprime a grade
    //    do `.np-seek`, e as três asserções logo acima deixam de bater — mas
    //    elas reprovam DEPOIS do estrago, com três mensagens que falam de
    //    colunas e não da causa. Esta diz a causa.
    checar(parseFloat(g.npPadX[0]) === 0 && parseFloat(g.npPadX[1]) === 0,
      `e o recuo do cartão é só VERTICAL: na horizontal ele comprimiria as `
      + `colunas do deck e a barra sairia de cima da preview (${nome})`,
      g.npPadX);

    // E A PROPORÇÃO DO TELÃO SOBREVIVE A TUDO ISSO. É a única coisa que a
    // miniatura não pode falsear — ela existe para o operador conferir o que
    // vai ao ar —, e é o que um `max-height` que mordesse teria quebrado:
    // clamparia a altura sem clampar a largura.
    checar(Math.abs((g.pv.larg / g.pv.alto) - parseFloat(ar)) < 0.02,
      `e a preview mantém a proporção do telão, não a da caixa (${nome})`,
      { medida: +(g.pv.larg / g.pv.alto).toFixed(3), telao: ar });
  }
  await pg.evaluate(() => document.documentElement.style.removeProperty('--pv-ar'));

  // ── 2. A COLUNA DE OPERAÇÃO, SOBRE a preview e à esquerda ───────────────
  //
  // SÃO DOIS DESDE A v1.4.31 — a leitura auxiliar saiu para a sétima célula do
  // deck (ver o bloco 6). O que ficou é a metade que OPERA A CENA: a cortina
  // muda o que a congregação vê, o mudo muda o que ela ouve. O que saiu abria
  // uma folha no celular, e é essa a linha que separa os dois grupos.
  const col = await pg.evaluate(() => {
    const pv = document.querySelector('.preview').getBoundingClientRect();
    const um = (sel) => {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        dentro: r.left >= pv.left - 1 && r.right <= pv.right + 1
          && r.top >= pv.top - 1 && r.bottom <= pv.bottom + 1,
        naEsquerda: r.left + r.width / 2 < pv.left + pv.width / 2,
        fundo: cs.backgroundColor, borda: cs.borderTopWidth,
        temGlifo: !!el.querySelector('.msym'),
      };
    };
    return {
      cortina: um('#viewToggle'), mudo: um('#muteToggle'),
      // A LEITURA AUXILIAR SAIU DAQUI, e a asserção é essa: ela não pode estar
      // nas DUAS casas. Um botão duplicado continua funcionando nos dois
      // lugares e não erra em teste de comportamento nenhum — o que se perde é
      // a razão da mudança (a coluna homogênea), em silêncio.
      leitura: um('#lyricsViewBtn'),
      naColuna: !!document.querySelector('.pv-fabs--esq #lyricsViewBtn'),
      ordem: [...document.querySelectorAll('.pv-fabs--esq .pv-fab')].map((b) => b.id),
    };
  });
  for (const [nome, b] of [['cortina', col.cortina], ['mudo', col.mudo]]) {
    checar(b.dentro && b.naEsquerda,
      `o botão de ${nome} está SOBRE a preview, na metade esquerda`, b);
    // "Sem botão, apenas ícones": o desenho da miniatura é o traço com as três
    // `drop-shadow`; uma pastilha ali viraria o único botão "de verdade".
    checar(/rgba\(0, 0, 0, 0\)|transparent/.test(b.fundo) && b.borda === '0px',
      `e ele é só ÍCONE — sem pastilha e sem contorno (${nome})`, b);
    checar(b.temGlifo === false,
      `e o desenho é SVG, não glifo da fonte — um \`.msym\` não tem traço para as três sombras do \`.pv-fab\` (${nome})`, b);
  }
  checar(col.naColuna === false && col.leitura.dentro === false,
    'e a leitura auxiliar NÃO está mais sobre a preview: ela mudou de casa, '
    + 'não ganhou uma segunda', col);
  checar(col.ordem.join(',') === 'viewToggle,muteToggle',
    'a ordem da coluna é cortina → mudo, e a CORTINA está no topo — o canto que '
    + 'a leitura auxiliar deixou vago (v1.4.31)', col.ordem);

  // TOPO e BASE — não um bloco no centro. É o alinhamento da coluna do
  // player ao lado (cast em cima, tela cheia embaixo), e sem ele os dois liam
  // como um agrupamento solto no meio da miniatura. Falha calada: eles
  // continuam ali, continuam funcionando, só param de ter relação com nada.
  const espalho = await pg.evaluate(() => {
    const pv = document.querySelector('.preview').getBoundingClientRect();
    const ic = [...document.querySelectorAll('.pv-fabs--esq .pv-fab')]
      .map((e) => e.getBoundingClientRect());
    return {
      alturaPv: pv.height, quantos: ic.length,
      topo: ic[0].top - pv.top,
      base: pv.bottom - ic[ic.length - 1].bottom,
      // O vão entre vizinhos: com `space-between` ele é o que sobra; num bloco
      // centrado é o `gap`, muito menor. É a assinatura das duas formas.
      vao: ic[1].top - ic[0].bottom,
    };
  });
  checar(espalho.topo >= 0 && espalho.topo <= 4,
    'o primeiro ícone encosta no TOPO da preview', espalho);
  checar(espalho.base >= 0 && espalho.base <= 4,
    'o último encosta na BASE — e nenhum dos dois vaza para fora dela', espalho);
  // A prova de que é `space-between` e não dois botões colados no centro: o vão
  // entre vizinhos tem de ser o que SOBRA da altura, não um `gap` fixo.
  checar(espalho.vao > (espalho.alturaPv - espalho.quantos * 34) / 2 - 4,
    'os dois estão ESPALHADOS pela altura, não agrupados num bloco', espalho);

  // ── 2b. O TOQUE SOBRE A PREVIEW ACENDE O TRAÇO; ELE NÃO AFUNDA (v1.4.33) ─
  //
  // Relato do operador: os botões de mudo e da cortina *"ainda estão
  // erroneamente com o feedback tátil de quando ainda estavam na barra"*.
  //
  // `--press` é `translateY(2px)` e encena **a tecla que afunda** — e aqui não
  // há tecla: o `.pv-fab` não tem pastilha, ele É o traço branco sobre o que
  // estiver projetado. E a LUZ que acompanha o recuo não salva o desenho:
  // MEDIDO no `#muteToggle`, `brightness(1.35)` levava o traço de 240,6 a
  // **238,3** (branco já está no teto, então ela só DESBOTA o halo) e o fundo
  // de 14,3 a 14,5 — os dois invisíveis. Sobrava só o deslocamento.
  //
  // As TRÊS metades, e nenhuma basta sozinha:
  //  · a caixa NÃO se move — é o que o operador relatou;
  //  · mas ele RESPONDE, e a prova é o RENDERIZADO: uma regra que só trocasse
  //    uma classe passaria num teste de classe e continuaria muda na tela, que
  //    é o pior desfecho (o design system chama um controle mudo ao toque de
  //    defeito, não de sobriedade);
  //  · e o botão DA BARRA continua afundando — sem esta, apagar o `--press` do
  //    app inteiro passaria nas duas primeiras.
  const toque = await (async () => {
    const alvos = ['#viewToggle', '#muteToggle', '#pvFullBtn'];
    const out = {};
    for (const sel of alvos) {
      const caixa = (s2) => pg.evaluate((x) => {
        const r = document.querySelector(x).getBoundingClientRect();
        return [+r.x.toFixed(2), +r.y.toFixed(2), +r.width.toFixed(2), +r.height.toFixed(2)].join(',');
      }, s2);
      const c = await pg.evaluate((x) => {
        const r = document.querySelector(x).getBoundingClientRect();
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }, sel);
      const antes = await caixa(sel);
      const pena = (s2) => pg.evaluate((x) =>
        getComputedStyle(document.querySelector(x).querySelector('svg')).strokeWidth, s2);
      const penaAntes = await pena(sel);
      const fotoAntes = await pg.locator(sel).screenshot();
      await pg.mouse.move(c.x, c.y);
      await pg.mouse.down();
      const durante = await pg.evaluate((x) => getComputedStyle(document.querySelector(x)).transform, sel);
      const depois = await caixa(sel);
      const penaDepois = await pena(sel);
      const fotoDepois = await pg.locator(sel).screenshot();
      // SOLTAR FORA DO ALVO. Um `mouse.up()` em cima do botão dispara o CLIQUE,
      // e estes três AGEM: o `#pvFullBtn` entra em tela cheia e o bloco 5 deste
      // arquivo passa a clicar num botão que não está mais visível. O que se
      // mede aqui é o `:active`, não o efeito — então o dedo sai antes de soltar.
      await pg.mouse.move(1, 1);
      await pg.mouse.up();
      out[sel] = {
        parado: durante === 'none' && antes === depois,
        engrossou: parseFloat(penaDepois) > parseFloat(penaAntes),
        // O RENDERIZADO mudou? Um botão que não muda um pixel é um botão mudo.
        pintou: Buffer.compare(fotoAntes, fotoDepois) !== 0,
        pena: penaAntes + ' → ' + penaDepois,
      };
    }
    return out;
  })();
  for (const [sel, r] of Object.entries(toque)) {
    checar(r.parado,
      `o toque em ${sel} NÃO desloca a caixa: sobre a preview não há tecla para `
      + 'afundar, e um ícone que pula por cima da imagem no ar não se lê como "apertei"', r);
    checar(r.engrossou && r.pintou,
      `e ${sel} RESPONDE mesmo assim — o traço ganha pena e o halo engrossa, que é `
      + 'o que se vê sobre um fundo desconhecido (um slide branco, um wallpaper '
      + 'escuro, um vídeo); a luz não servia: num traço branco ela não tem para onde subir', r);
  }
  // A METADE DE VOLTA: quem TEM tecla continua afundando.
  const naBarra = await (async () => {
    const c = await pg.evaluate(() => {
      const r = document.querySelector('#next').getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    });
    await pg.mouse.move(c.x, c.y);
    await pg.mouse.down();
    const t = await pg.evaluate(() => getComputedStyle(document.querySelector('#next')).transform);
    await pg.mouse.move(1, 1);
    await pg.mouse.up();
    return t;
  })();
  checar(/matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*2\)/.test(naBarra),
    'e o botão DA BARRA continua afundando os 2px: o que mudou é o desenho SEM '
    + 'pastilha, não a regra do app', naBarra);

  // ── 2b-bis. A SETA DO ACORDEÃO DA BIBLIOTECA (v1.5.14) ──────────────────
  //
  // Ela estava nomeada nas GUARDAS do `--press` — as que zeram o recuo da barra
  // quando o dedo pousa num botão dela — e NÃO estava na lista `:is()`, nem
  // tinha `:active` próprio. Tocá-la CANCELAVA o feedback do vizinho sem dar
  // nenhum no lugar, enquanto o comentário logo acima da guarda afirmava o
  // contrário: *"o dedo pousa num deles e é ELE que responde, não a linha
  // inteira por baixo"*. O efeito na mão é o pior tipo de inconsistência — o
  // MESMO gesto responde ou não conforme onde o dedo cai: a barra afunda, a
  // seta a dois milímetros dali não.
  //
  // DUAS COISAS FORAM MEDIDAS ESCREVENDO ESTE CASO, e nenhuma é óbvia:
  // 1. O recuo tem de COMPOR com o giro. `transform` é uma propriedade só, e a
  //    seta de uma seção FECHADA já gira 180° — a lista do `--press` a apagaria
  //    (a seta daria um pulo de meia-volta ao ser tocada). E a ORDEM importa:
  //    `rotate(180deg) translateY(2px)` translada no sistema JÁ GIRADO e a seta
  //    SOBE — medido, `matrix(…, 0, -2)` contra o `(…, 0, 2)` que se quer.
  // 2. A medição espera a TRANSIÇÃO. `.coll-group-icon` tem
  //    `transition: transform`, então amostrar no instante do `mouse.down`
  //    devolve o valor de PARTIDA e aprova uma regra que não existe — foi
  //    exatamente o que a primeira escrita deste caso fez.
  const seta = await (async () => {
    const alvo = '#hymnResults > .coll-group--drop:not(.aberto) .coll-group-icon';
    const p0 = await pg.evaluate(async (sel) => {
      if (!hymnSearchPopupEl.classList.contains('open')) openHymnSearch();
      await new Promise((r) => setTimeout(r, 250));
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
        w: Math.round(r.width), h: Math.round(r.height),
        t: getComputedStyle(el).transform };
    }, alvo);
    if (!p0) return null;
    await pg.mouse.move(p0.x, p0.y);
    await pg.mouse.down();
    await pg.waitForTimeout(350);
    const d = await pg.evaluate((sel) => {
      const el = document.querySelector(sel);
      return { t: getComputedStyle(el).transform, f: getComputedStyle(el).filter };
    }, alvo);
    await pg.mouse.move(1, 1);
    await pg.mouse.up();
    await pg.evaluate(() => { closeHymnSearch(); });
    await pg.waitForTimeout(200);
    return { antes: p0, durante: d };
  })();
  checar(!!seta, 'a seta de uma seção FECHADA da Biblioteca foi encontrada', seta);
  if (seta) {
    const m = /matrix\(([^)]+)\)/.exec(seta.durante.t);
    const ty = m ? parseFloat(m[1].split(',')[5]) : 0;
    const giradaAntes = seta.antes.t.startsWith('matrix(-1');
    const giradaDurante = seta.durante.t.startsWith('matrix(-1');
    checar(ty === 2 && seta.durante.f !== 'none',
      'A SETA DO ACORDEÃO RESPONDE AO TOQUE: afunda os 2px e acende. Ela estava '
      + 'nas guardas que zeram o recuo da barra e fora da lista do `--press` — '
      + 'tocá-la apagava o feedback do vizinho sem dar nenhum',
      'antes ' + seta.antes.t + ' · durante ' + seta.durante.t + ' · ' + seta.durante.f);
    checar(giradaAntes === giradaDurante,
      '  ↳ e o GIRO sobrevive ao recuo: `transform` é uma propriedade só, e a '
      + 'seta de uma seção fechada aponta para baixo — o `--press` sozinho a '
      + 'endireitaria no meio do toque',
      'girada antes: ' + giradaAntes + ' · durante: ' + giradaDurante);
    checar(seta.antes.w >= 34 && seta.antes.h >= 34,
      '  ↳ e ela alcança o `--hit`: era 32×32, o único alvo da Biblioteca abaixo '
      + 'do piso de toque do próprio app, no controle mais tocado daquela tela',
      seta.antes.w + '×' + seta.antes.h);
  }

  // ── 2c. O ANEL DE FOCO É DO TECLADO, E SÓ DELE (v1.4.34) ────────────────
  //
  // Relato do operador, DEPOIS da v1.4.33: *"ainda estou vendo a onda azulada
  // de feedback de toque tanto no botão de mudo quanto no botão da cortina"*.
  //
  // `outline-style: auto` faz o Chromium desenhar o anel DELE — azul no WebView
  // do Android —, e um `<button>` fica com `:focus` depois do toque: ele não
  // pisca, GRUDA até o foco sair. Daí o relato nomear justamente estes dois
  // (são os que ficam sob o dedo; o de tela cheia e o de cast saem da tela).
  //
  // ===== O QUE ESTE ORÁCULO **NÃO** PROVA, e está dito porque importa =====
  //
  // A metade do PONTEIRO é INALCANÇÁVEL aqui: MEDIDO por reversão, o Chromium
  // de mesa já não desenha anel num foco de ponteiro (o `:focus-visible` dele é
  // falso), então a asserção passava COM e SEM a regra — uma tautologia. Quem
  // desenha o anel azul é o WebView do aparelho, e este arnês não é ele.
  //
  // Fica então a natureza que o `rotina-cede-a-vez.test.mjs` já declara: a
  // FORMA (a regra existe e é ESCOPADA a `:not(:focus-visible)`) mais o
  // COMPORTAMENTO que é alcançável — o anel do TECLADO sobrevive. É essa
  // segunda que impede o conserto de virar outro defeito: um `outline: none`
  // seco deixaria quem navega por teclas sem saber onde está, e ela reprova
  // exatamente isso.
  const regraDoAnel = await pg.evaluate(() => {
    for (const folha of document.styleSheets) {
      let regras; try { regras = folha.cssRules; } catch (_) { continue; }
      for (const r of regras) {
        if (r.selectorText && /:focus\b/.test(r.selectorText) && /outline/.test(r.style.cssText || '')) {
          return { seletor: r.selectorText, corpo: r.style.cssText };
        }
      }
    }
    return null;
  });
  checar(!!regraDoAnel && /:not\(:focus-visible\)/.test(regraDoAnel.seletor)
    && /outline:\s*none/.test(regraDoAnel.corpo),
    'o anel de foco é apagado SÓ fora do teclado (`:focus:not(:focus-visible)`) — '
    + 'no aparelho ele é AZUL e GRUDA depois que o dedo sai, e não é feedback de '
    + 'toque: é um estado pendurado', regraDoAnel);
  const anel = { ponteiro: 'inalcançável no Chromium de mesa — ver o comentário' };
  await pg.evaluate(() => {
    const e = document.querySelector('#muteToggle');
    e.blur();
    window.__lerAnel = () => {
      const cs = getComputedStyle(e);
      return { visivel: e.matches(':focus-visible'), estilo: cs.outlineStyle, largura: cs.outlineWidth };
    };
    e.focus({ preventScroll: true });
  });
  // TECLADO DE VERDADE: `focus({focusVisible:true})` NÃO é honrado (medido — o
  // `:focus-visible` continuou falso), e uma asserção por cima dele reprovaria
  // um app que está certo. Quem decide é a heurística do navegador, e ela lê a
  // navegação por Tab.
  await pg.keyboard.press('Tab');
  await pg.keyboard.press('Shift+Tab');
  anel.teclado = await pg.evaluate(() => ({
    foco: document.activeElement === document.querySelector('#muteToggle'),
    ...window.__lerAnel(),
  }));
  await pg.evaluate(() => { document.querySelector('#muteToggle').blur(); delete window.__lerAnel; });
  checar(anel.teclado.visivel && anel.teclado.estilo !== 'none',
    'e o foco vindo do TECLADO continua com anel: a folha deixa `outline` de fora '
    + 'do reset de propósito, e quem navega por teclas precisa saber onde está', anel);

  // ── 2d. O ECO NÃO É DE QUEM TROCA O DESENHO (v1.4.36) ───────────────────
  //
  // Relato do operador, identificando o que sobrava: *"é um realce de toque, um
  // efeito após o toque… uma onda azul a partir da borda do botão… mesmo formato
  // dos botões, retangulares com bordas arredondadas… uma linha azul de borda
  // que se expande e vai desaparecendo. é animação"*. É o `.btn-eco`, entrado
  // nestes dois na v1.3.14.
  //
  // Ele desenha `inset: 0` + `border-radius: inherit` — **a caixa do botão**. Um
  // `.t-btn` tem uma; um `.pv-fab` tem `background: none` e é só o traço sobre a
  // projeção, então o eco materializa um retângulo AZUL (`--accent`, um token de
  // cromo) em volta de um ícone solto, em cima da imagem no ar.
  //
  // E ele era REDUNDANTE ali: a cortina e o mudo são alternadores — o ícone vira
  // o oposto no mesmo instante do toque. Isso já É "o comando saiu".
  //
  // A METADE DE VOLTA é o que impede o conserto de virar outro defeito: o
  // TRANSPORTE continua ecoando, e é lá que o eco não tem substituto — os ⏮/▶/⏭
  // não trocam de desenho, e com as telas da rede a resposta real está a ~1 s.
  const eco = await pg.evaluate(async () => {
    const bater = (sel) => {
      const b = document.querySelector(sel);
      b.click();
      const tem = b.classList.contains('btn-eco');
      const anelDesenhado = tem ? getComputedStyle(b, '::before').boxShadow : '';
      return { tem, anelDesenhado };
    };
    const r = {
      cortina: bater('#viewToggle'),
      mudo: bater('#muteToggle'),
      transporte: bater('#next'),
    };
    // DESFAZ os dois alternadores — este bloco mede o eco, não muda a cena para
    // quem vier depois.
    document.querySelector('#viewToggle').click();
    document.querySelector('#muteToggle').click();
    return r;
  });
  checar(eco.cortina.tem === false && eco.mudo.tem === false,
    'a cortina e o mudo NÃO ecoam: o eco desenha a CAIXA do botão, e um `.pv-fab` '
    + 'não tem caixa — o que aparecia era um retângulo azul em volta de um ícone '
    + 'solto, por cima da projeção', eco);
  checar(eco.transporte.tem === true && !!eco.transporte.anelDesenhado
    && eco.transporte.anelDesenhado !== 'none',
    'e o TRANSPORTE continua ecoando: lá o eco não tem substituto — os ⏮/▶/⏭ não '
    + 'trocam de desenho, e com as telas da rede a resposta real está a ~1 s', eco);

  // ── 3-A. A COLUNA DA TELA CHEIA: NASCE ACESA, E O TOQUE É INTERRUPTOR ───
  //
  // Sem TV a preview em tela cheia É a projeção, então tudo o que se pinta aqui
  // a congregação vê — e foi por isso que a coluna nasceu apagada. O preço era
  // o problema que ela veio resolver: uma superfície que não se anuncia. Quem
  // não soubesse que basta tocar ficava com uma projeção sem saída à vista.
  //
  // AS DUAS METADES FALHAM CALADAS, e de jeitos opostos:
  //  - nascer apagada não é erro nenhum na tela — é a ausência de um quadro;
  //  - e o interruptor pode "funcionar" pela metade: se o toque num BOTÃO
  //    também apagasse, cada comando fecharia a coluna, e a sequência normal do
  //    culto (passar três estrofes) exigiria um toque de reabertura entre cada
  //    dois. Por isso a asserção do meio é a que mais importa aqui.
  //
  // A tela cheia é REAL (`requestFullscreen` a partir de um clique de verdade),
  // e não uma classe simulada: quem revela a coluna é `.preview:fullscreen`, um
  // seletor que só existe quando o navegador de fato entrou.
  //
  // E O QUE SE ESPERA É O EVENTO, nunca `document.fullscreenElement`: MEDIDO, o
  // Chromium publica a propriedade ANTES de despachar `fullscreenchange`, e a
  // enquete do Playwright cai no vão — o oráculo lia a coluna apagada e
  // reprovava um app que estava certo. Esperar pelo `.visivel` seria a outra
  // ponta do erro: uma tautologia, esperar exatamente o que se vai afirmar.
  const fsVis = () => pg.evaluate(() => {
    const el = document.getElementById('pvFsCtl');
    const cs = getComputedStyle(el);
    return {
      montada: cs.display !== 'none',
      acesa: el.classList.contains('visivel'),
      naTelaCheia: !!document.fullscreenElement,
      qual: document.fullscreenElement && document.fullscreenElement.id,
      eventos: window.__fsEventos || 0,
    };
  });
  await pg.evaluate(() => {
    window.__fsEventos = 0;
    document.addEventListener('fullscreenchange', () => { window.__fsEventos++; });
  });
  const esperarEvento = (n) => pg.waitForFunction(
    (alvo) => window.__fsEventos >= alvo, n, { timeout: 10000 },
  ).catch(() => {});

  await pg.click('#pvFullBtn');
  await esperarEvento(1);
  const fs1 = await fsVis();
  checar(fs1.naTelaCheia && fs1.montada && fs1.acesa,
    'entrar na tela cheia ACENDE a coluna — ela se anuncia em vez de esperar um toque no escuro', fs1);

  // Um toque NUM BOTÃO comanda e RENOVA; jamais apaga.
  await pg.click('#fsPlay');
  const fs2 = await fsVis();
  checar(fs2.acesa,
    'tocar num BOTÃO da coluna não a apaga — senão cada comando cobraria um toque de reabertura', fs2);

  // Um toque FORA dela apaga. O alvo é a própria projeção, longe da coluna
  // (ela mora encostada na direita).
  const cxPreview = await pg.evaluate(() => {
    const r = document.querySelector('.preview').getBoundingClientRect();
    return { x: Math.round(r.left + r.width * 0.2), y: Math.round(r.top + r.height / 2) };
  });
  await pg.mouse.click(cxPreview.x, cxPreview.y);
  const fs3 = await fsVis();
  checar(!fs3.acesa, 'um toque FORA da coluna a apaga — o mesmo gesto nos dois sentidos', fs3);

  // E o mesmo toque, no mesmo lugar, a traz de volta.
  await pg.mouse.click(cxPreview.x, cxPreview.y);
  const fs4 = await fsVis();
  checar(fs4.acesa, 'e o MESMO toque, no mesmo lugar, a traz de volta', fs4);

  await pg.evaluate(() => document.exitFullscreen && document.exitFullscreen());
  await esperarEvento(2);
  const fs5 = await fsVis();
  checar(!fs5.acesa,
    'sair apaga: reentrar tem de começar do estado limpo, sem o relógio de outra sessão', fs5);

  // ── 3. O SELO DE CAMADAS, na BASE AO CENTRO (v1.3.10) ───────────────────
  const selo = await pg.evaluate(() => {
    document.getElementById('pvCamadaBtn').hidden = false;   // ele só aparece com duas camadas no ar
    const pv = document.querySelector('.preview').getBoundingClientRect();
    const r = document.getElementById('pvCamadaBtn').getBoundingClientRect();
    return {
      desvio: Math.abs((r.left + r.width / 2) - (pv.left + pv.width / 2)),
      naBase: pv.bottom - r.bottom,
      alturaPv: pv.height,
      colideComOperacao: (() => {
        const c = document.querySelector('.pv-fabs--esq').getBoundingClientRect();
        return !(r.right <= c.left || r.left >= c.right || r.bottom <= c.top || r.top >= c.bottom);
      })(),
    };
  });
  checar(selo.desvio < 2, 'o selo de camadas está CENTRADO na horizontal', selo);
  checar(selo.naBase < selo.alturaPv * 0.25, 'e na BASE da preview', selo);
  checar(selo.colideComOperacao === false,
    'e ele não encosta na coluna de operação — é por não fazer coluna com ninguém que ele continua se lendo como estado, e não como controle', selo);

  // ── 3-B. A BASE DA PREVIEW É A REGIÃO DO QUE ESTÁ FORA DO PADRÃO (v1.4.43) ──
  //
  // Pedido do operador: *"essa região inferior no centro da preview vai ser uma
  // região flexível que vai conter elementos passageiros. no caso, agora quando
  // o giro do telão estiver diferente de 0, adicione um botão ali nessa região
  // para cancelar essa modificação, permitindo voltar a posição padrão"*.
  //
  // CINCO METADES, e cada uma falha CALADA por um caminho próprio:
  //
  //  1. ELE APARECE PELO CAMINHO REAL. Quem o mostra é `renderRotBtn`, o render
  //     do ESTADO que ele desfaz — um render próprio, chamado de um lugar só,
  //     deixaria o botão de pé depois de o giro voltar a zero, oferecendo
  //     desfazer o que já não existe. O oráculo aplica o giro por `applyRotate`,
  //     que é a porta única, e não escrevendo `hidden` à mão.
  //  2. O TOQUE VOLTA AO PADRÃO, medido no COMANDO que sai no barramento: é o
  //     telão que tem de girar de volta, e um `applyRotate` que só repintasse o
  //     tile deixaria a projeção girada com a preview dizendo que não está.
  //  3. E ELE SOME DEPOIS. Sem esta, um botão que só acende passaria na 1 e na 2.
  //  4. A COR É A DO VIZINHO — e NÃO a dos botões de player —, medida no
  //     RENDERIZADO (v1.4.45). Os dois moradores da faixa fazem a mesma promessa
  //     (*"o toque daqui TIRA alguma coisa"*), então vestem o mesmo
  //     `--stage-alert`; o que os separa é o DESENHO, e é a asserção 4-B. A
  //     comparação com o branco fica: é a armadilha que o `.pv-fab--camada` já
  //     pagou uma vez — escrita ANTES da `.pv-fab` na folha, a regra perde para o
  //     `color: var(--stage-text)` e o botão sai BRANCO, igual aos de player ao
  //     lado, isto é, sem dizer nada. Um teste de classe aprova as duas versões.
  //  4-B. O ✕ É O MESMO, VERBATIM, e o resto do desenho NÃO É. O ✕ é a marca de
  //     destruição da faixa e tem de ser uma só — um redesenhado dois pixels
  //     adiante é uma segunda opinião sobre a mesma coisa; e o que sobra depois
  //     dele tem de diferir, senão os dois botões são o mesmo botão em vermelho.
  //  5. O NÚMERO CABE. Ele é o ESTADO (uma seta circular sozinha sobre a
  //     projeção leria "girar mais 90°", o oposto do que o toque faz), e é o
  //     único `.pv-fab` mais largo que `--hit`: mantido o `width` fixo dos
  //     irmãos, "180°" sai cortado sem erro em lugar nenhum.
  const giro = await pg.evaluate(async () => {
    const btn = document.getElementById('pvGiroBtn');
    if (!btn) return null;
    // A RÉGUA DO BRANCO É UM VIZINHO RENDERIZADO, nunca o valor do token: o
    // `--stage-text` sai de `getPropertyValue` como `#fff` e a cor computada
    // sai como `rgb(255, 255, 255)` — duas escritas da mesma cor que nunca são
    // iguais como string, e a comparação passa SEMPRE. MEDIDO por reversão: com
    // o `.pv-fab--giro` pintado de `--stage-text` de propósito, a asserção
    // continuava verde. Quem responde é o botão de tela cheia, que é um
    // `.pv-fab` sem cor própria e mora na mesma miniatura.
    const brancoDoPalco = getComputedStyle(document.getElementById('pvFullBtn')).color;
    const cor = (el) => getComputedStyle(el).color;
    const antes = { escondido: btn.hidden };
    await applyRotate(90);
    // Os traços de cada botão, na ordem do documento. `<polyline>` entra junto —
    // o desenho é o conjunto de traços, não só o que é `<path>`.
    const tracos = (el) => [...el.querySelectorAll('path, polyline')]
      .map((n) => (n.getAttribute('d') || n.getAttribute('points') || '').trim());
    const doSelo = tracos(document.getElementById('pvCamadaBtn'));
    const doGiro = tracos(btn);
    const aceso = {
      escondido: btn.hidden,
      num: (document.getElementById('pvGiroNum') || {}).textContent,
      cor: cor(btn),
      corDoSelo: cor(document.getElementById('pvCamadaBtn')),
      // A marca partilhada (o ✕) e o que é próprio de cada um (o assunto).
      comuns: doGiro.filter((d) => doSelo.includes(d)),
      soDoGiro: doGiro.filter((d) => !doSelo.includes(d)),
      soDoSelo: doSelo.filter((d) => !doGiro.includes(d)),
      titulo: btn.title,
      cabe: btn.scrollWidth <= btn.clientWidth + 1,
      largura: Math.round(btn.getBoundingClientRect().width),
      alvo: Math.round(btn.getBoundingClientRect().height),
    };
    // O espião entra no ponto por onde TODO comando passa.
    const vistos = [];
    const original = window.cmd;
    window.cmd = (c) => { vistos.push(c); };
    btn.click();
    // ESPERA PELO FATO, não por um prazo: `applyRotate` grava no banco ANTES de
    // mandar o comando, então o `cmd` sai depois de uma volta ao IndexedDB —
    // um `setTimeout(0)` restaura o espião antes de ele ver alguma coisa, e o
    // que sobra é uma lista vazia lida como "o app não mandou nada".
    for (let i = 0; i < 200 && !vistos.length; i++) {
      await new Promise((r) => requestAnimationFrame(() => r()));
    }
    window.cmd = original;
    return {
      antes, aceso, brancoDoPalco,
      comandos: vistos.map((c) => c.type + ':' + c.rotate),
      depois: { escondido: btn.hidden, rot: mediaRot },
      naBase: (() => {
        const faixa = btn.closest('.pv-fabs--base');
        return !!faixa && faixa.contains(document.getElementById('pvCamadaBtn'));
      })(),
    };
  });
  if (!giro) {
    checar(false, 'a base da preview tem o botão de desfazer o giro do telão');
  } else {
    checar(giro.antes.escondido && !giro.aceso.escondido,
      'o DESFAZER DO GIRO nasce escondido e aparece quando o giro sai de 0 — pelo '
      + 'render do estado que ele desfaz, não por um `hidden` escrito à mão', giro.antes);
    checar(giro.aceso.num === '90°',
      'e ele diz o ÂNGULO: o número é o estado, sem o qual a seta circular sobre a '
      + 'projeção se leria como "girar mais 90°"', giro.aceso.num);
    checar(/volta à posição padrão/.test(giro.aceso.titulo || ''),
      'e o `title` diz a AÇÃO — a divisão de sempre: o desenho mostra o estado, a frase diz o toque',
      giro.aceso.titulo);
    checar(giro.comandos.includes('rotate:0'),
      'o toque manda o TELÃO de volta ao padrão (um `rotate: 0` no barramento) — '
      + 'repintar só o tile deixaria a projeção girada', giro.comandos);
    checar(giro.depois.rot === 0 && giro.depois.escondido,
      'e o botão SOME depois: um que só acende passaria nas duas de cima e ficaria '
      + 'oferecendo desfazer o que já não existe', giro.depois);
    checar(giro.aceso.cor === giro.aceso.corDoSelo && giro.aceso.cor !== giro.brancoDoPalco,
      'a COR dele é a MESMA do selo de camadas, e não o branco dos botões de '
      + 'player: os dois moradores da faixa fazem a mesma promessa — o toque daqui '
      + 'TIRA alguma coisa. Medida no RENDERIZADO, porque uma regra escrita ANTES '
      + 'da `.pv-fab` perde para o `--stage-text` e o botão sai branco, sem dizer '
      + 'nada', giro.aceso);
    checar(giro.aceso.comuns.length === 2,
      'e ele carrega o ✕ DO VIZINHO, verbatim (os dois traços) — a marca de '
      + 'destruição da faixa é uma só, e um ✕ redesenhado dois pixels adiante é '
      + 'uma segunda opinião sobre a mesma coisa',
      JSON.stringify(giro.aceso.comuns));
    checar(giro.aceso.soDoGiro.length > 0 && giro.aceso.soDoSelo.length > 0,
      'e o resto do desenho é PRÓPRIO de cada um: com a cor igual, é o ícone que '
      + 'diz o que o ✕ destrói — sem esta metade, dois botões idênticos em '
      + 'vermelho passariam nas duas de cima',
      JSON.stringify([giro.aceso.soDoGiro, giro.aceso.soDoSelo]));
    checar(giro.aceso.cabe && giro.aceso.largura > giro.aceso.alvo,
      'e o número CABE: ele é o único `.pv-fab` mais largo que `--hit`, e com a '
      + 'largura fixa dos irmãos "180°" sairia cortado sem erro nenhum', giro.aceso);
    checar(giro.naBase,
      'e ele mora na MESMA faixa do selo de camadas — a base ao centro é a região '
      + 'do que está fora do padrão, não uma barra de ferramentas nova');
  }

  // ── 4. A ARMADILHA DO `<use>`: o desenho tem de TROCAR ─────────────────
  //
  // A asserção é QUAL desenho está no ar em cada estado, e não a contagem de
  // nós nem uma foto do botão. As duas alternativas foram tentadas e as duas
  // aprovam a armadilha:
  //
  //  • CONTAGEM de filhos visíveis do `<svg>`: com um `<symbol>` único o
  //    consumidor continua tendo UM `<use>` visível, e as duas camadas saem
  //    empilhadas por baixo dele — a conta dá 1 nos dois estados;
  //  • FOTO do botão: ele é transparente e mora SOBRE a preview, que muda de
  //    conteúdo no mesmo `renderControls` (a cortina troca a mídia pelo
  //    wallpaper). A foto sai diferente por causa do FUNDO, e não do ícone.
  //
  // O que resta é perguntar ao DOM qual símbolo cada `<use>` visível aponta.
  // MEDIDO em Chromium (e é a razão de cada estado ser um símbolo separado):
  // um `<symbol>` com `.ico-base`/`.ico-alt` dentro NÃO responde à folha do
  // documento — o conteúdo clonado mora numa árvore-sombra que o seletor não
  // atravessa, e o botão desenha os dois ao mesmo tempo, para sempre.
  const noAr = () => pg.evaluate(() => {
    const um = (id) => [...document.getElementById(id).querySelectorAll('svg > use')]
      .filter((u) => getComputedStyle(u).display !== 'none')
      .map((u) => u.getAttribute('href'));
    return { cortina: um('viewToggle'), mudo: um('muteToggle') };
  });
  const antes = await noAr();
  const desenhos = await pg.evaluate(() => {
    const antesCor = getComputedStyle(document.getElementById('muteToggle')).color;
    view = 'wallpaper'; muted = true; renderControls();
    return {
      antesCor,
      depoisCor: getComputedStyle(document.getElementById('muteToggle')).color,
      cortina: document.getElementById('viewToggle').classList.contains('alternado'),
      mudo: document.getElementById('muteToggle').classList.contains('alternado'),
      tituloCortina: document.getElementById('viewToggle').title,
      tituloMudo: document.getElementById('muteToggle').title,
      // A metade ESTRUTURAL, que diz POR QUE quando a de cima reprova: cada
      // alternador tem de pendurar os DOIS `<use>` na árvore de LUZ, porque é
      // só neles que a folha do documento pega.
      usos: ['viewToggle', 'muteToggle'].map((id) => [...document.getElementById(id)
        .querySelectorAll('svg > use')].map((u) => u.getAttribute('class')).join('+')),
    };
  });
  const depois = await noAr();
  await pg.evaluate(() => { view = 'visual'; muted = false; renderControls(); });

  for (const [nome, a, d] of [['a CORTINA', antes.cortina, depois.cortina],
    ['o MUDO', antes.mudo, depois.mudo]]) {
    checar(a.length === 1 && d.length === 1,
      `${nome} desenha UM símbolo por estado, nunca dois empilhados`, { a, d });
    checar(a[0] !== d[0],
      `e o símbolo TROCA entre os dois estados — é o que prova que a folha alcança os dois \`<use>\``, { a, d });
  }
  checar(desenhos.usos.every((u) => u === 'ico-base+ico-alt'),
    'cada alternador pendura DOIS `<use>` na árvore de luz — um `<symbol>` com as duas camadas dentro ficaria fora do alcance da folha', desenhos.usos);
  checar(desenhos.cortina && desenhos.mudo,
    'a troca é a classe `.alternado`, a mesma chave do `#fsView` da tela cheia', desenhos);
  // O ÍCONE mostra o ESTADO; o `title`, a AÇÃO.
  checar(desenhos.tituloMudo === 'Tirar o mudo'
    && desenhos.tituloCortina === 'Mostrar a mídia no telão',
    'e o `title` continua nomeando a AÇÃO, não o estado', desenhos);
  // Sem pastilha, o estado só pode ser a COR DO TRAÇO — e se ela não mudar, um
  // telão mudo fica indistinguível de um telão com som.
  checar(desenhos.antesCor !== desenhos.depoisCor,
    'e o MUDO muda a cor do traço: sem pastilha, é a única coisa que carrega o estado', desenhos);

  // ── 5. ⏮/⏭ DO TRANSPORTE PASSAM MÍDIA, E SÓ ────────────────────────────
  // A metade que mais custa se falhar. Com uma letra NO AR, o ⏭ tinha de
  // passar estrofe; agora tem de trocar de mídia — e quem passa estrofe é o
  // `#slideNextBtn`. A prova é o COMANDO que sai no barramento: um `seek` é a
  // estrofe andando, um `load` é a mídia trocando.
  const eixo = await pg.evaluate(async () => {
    currentItem = {
      id: 'cena', name: 'Louvor Em Cena', kind: 'audio', seconds: 200,
      lyrics: [{ time: 0, cover: true }, { time: 10, text: 'primeira' }, { time: 20, text: 'segunda' }],
    };
    currentId = 'cena';
    renderSlideNav();
    const alvo = slideTarget();
    // O espião entra no ponto por onde TODO comando passa.
    const vistos = [];
    const original = window.cmd;
    window.cmd = (c) => { vistos.push(c.type); };
    const espiar = (fn) => { vistos.length = 0; fn(); return vistos.slice(); };
    // `step` é o que os ⏮/⏭ do transporte chamam agora — sem toque longo.
    const doTransporte = espiar(() => nextEl.click());
    const doSlide = espiar(() => slideNextBtnEl.click());
    window.cmd = original;
    return {
      alvo, doTransporte, doSlide,
      classesTransporte: [...nextEl.classList],
      tituloTransporte: nextEl.title,
      tituloSlide: slideNextBtnEl.title,
      slideHabilitado: !slideNextBtnEl.disabled,
    };
  });
  checar(eixo.alvo === 'lyrics',
    'o cenário tem uma LETRA no ar — o caso em que o ⏭ passava estrofe', eixo.alvo);
  checar(!eixo.doTransporte.includes('seek'),
    'o ⏭ do transporte NÃO passa mais estrofe (nenhum `seek` saiu)', eixo.doTransporte);
  checar(eixo.doSlide.includes('seek'),
    'e quem passa estrofe é o botão de slide ao lado da preview', eixo.doSlide);
  checar(!eixo.classesTransporte.includes('slide-mode') && !eixo.classesTransporte.includes('axis-end'),
    'o transporte perdeu as classes que anunciavam o eixo — um botão com um significado só não tem eixo a anunciar', eixo.classesTransporte);
  checar(eixo.tituloTransporte === 'Próxima mídia',
    'e o `title` dele diz MÍDIA, sem a dica do toque longo', eixo.tituloTransporte);
  checar(eixo.tituloSlide === 'Próxima estrofe' && eixo.slideHabilitado,
    'o botão de slide diz o SUBSTANTIVO da cena, e está habilitado porque há para onde ir', eixo);

  // O que a cena não passa, o botão diz DESABILITADO — a leitura de sempre, e
  // a que substituiu o `.axis-end` que esmaecia o ⏮/⏭.
  const semAlvo = await pg.evaluate(() => {
    currentItem = { id: 'so-audio', name: 'Sem Letra', kind: 'audio', seconds: 90 };
    renderSlideNav();
    return {
      alvo: slideTarget(),
      ant: slidePrevBtnEl.disabled, prox: slideNextBtnEl.disabled,
      titulo: slideNextBtnEl.title,
    };
  });
  checar(semAlvo.alvo === null && semAlvo.ant && semAlvo.prox,
    'sem slide na cena os dois ficam DESABILITADOS — o esmaecido de sempre', semAlvo);
  checar(semAlvo.titulo === 'Próximo slide',
    'e com o nome genérico: um nome específico ali prometeria uma cena que não está no ar', semAlvo.titulo);

  // ── 6. O FADER FICOU; O BOTÃO QUE O ABRIA É QUE SAIU ───────────────────
  //
  // A distinção é o recurso inteiro, e ela já foi entendida ao contrário uma
  // vez: o operador dispensou o BOTÃO DE TELA que abria o fader, não o fader.
  // Ele é o que mantém o painel de volume do ANDROID fora da projeção — o app
  // consome a tecla, e quem não consome deixa o sistema desenhar o painel dele
  // SOBRE o que a congregação está vendo.
  //
  // As três metades: o botão não existe, o fader existe e nasce escondido, e a
  // TECLA o acende. Mais a que originou o relato — o botão de VOLTAR slide não
  // some junto.
  const faderCx = () => pg.evaluate(() => {
    const cx = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        vis: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0,
        topo: +r.top.toFixed(2), base: +r.bottom.toFixed(2),
        esq: +r.left.toFixed(2), dir: +r.right.toFixed(2),
      };
    };
    return {
      fader: cx('.fader-wrap'), prox: cx('#slideNextBtn'), ant: cx('#slidePrevBtn'),
      pv: cx('.preview'), hist: cx('#lyricsViewBtn'),
      // O BOTÃO que abria o fader — este sim tinha de sair.
      botoes: ['#volToggle', '#volClose'].filter((sel) => document.querySelector(sel)),
      temFader: !!document.querySelector('#volSlider'),
    };
  });
  const fechado = await faderCx();
  checar(fechado.botoes.length === 0,
    'não há botão de tela que abra o fader — era só ele que o operador dispensou', fechado.botoes);
  checar(fechado.temFader && fechado.fader.vis === false,
    'o fader EXISTE e nasce escondido: a única porta dele é a tecla física', fechado);
  checar(fechado.prox.vis,
    'com ele escondido, o botão de passar slide ocupa a célula', fechado.prox);

  // A TECLA ACENDE. `peekVolume` é o que `__avVolumeKey` chama; medir por ela é
  // medir o caminho de verdade, não um estado forçado à mão.
  await pg.evaluate(() => peekVolume());
  await pg.waitForFunction(() => {
    const t = getComputedStyle(document.querySelector('.fader-wrap')).transform;
    return t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)';
  }, null, { timeout: 5000 }).catch(() => {});
  const aberto = await faderCx();
  checar(aberto.fader.vis,
    'a tecla física ACENDE o fader (`peekVolume`)', aberto.fader);
  checar(perto(aberto.fader.topo, aberto.pv.topo) && perto(aberto.fader.base, aberto.pv.base),
    'e ele ocupa exatamente a faixa da preview, na coluna do passar slide',
    { fader: [aberto.fader.topo, aberto.fader.base], pv: [aberto.pv.topo, aberto.pv.base] });
  checar(aberto.prox.vis === false,
    'o botão de passar slide dá lugar a ele — os dois dividem a célula', aberto.prox);
  // ESTA É A ASSERÇÃO DO RELATO: o de VOLTAR não some junto. Ele sumia por uma
  // regra deliberada (`.deck.vol-open .slide-side`), e o operador viu.
  checar(aberto.ant.vis,
    'e o de VOLTAR slide FICA no ar — era o sumiço dele que o operador relatou', aberto.ant);
  checar(aberto.hist.vis,
    'a sétima célula também fica: ela não tem nada a ver com volume', aberto.hist);

  // E SOME SOZINHO. Sem botão que feche, o relógio é a única saída — se ele
  // falhar, o fader fica no lugar do botão de passar slide para sempre.
  await pg.evaluate(() => {
    // Encurta a espera SEM tocar na máquina: fecha pelo mesmo caminho do
    // relógio, que é o que `peekVolume` agenda.
    fecharFader();
  });
  await pg.waitForFunction(() => !document.querySelector('.deck').classList.contains('vol-open'),
    null, { timeout: 5000 }).catch(() => {});
  const devolta = await faderCx();
  checar(devolta.fader.vis === false && devolta.prox.vis,
    'fechado, a célula volta a ser do botão de passar slide', devolta);

  // ── 6b. A ORDEM DA LINHA DE BAIXO, E A CAIXA DO HISTÓRICO ──────────────
  const linha = await pg.evaluate(() => {
    const ids = [...document.querySelectorAll('.transport .t-btn'), document.getElementById('lyricsViewBtn')]
      .map((e) => e.id);
    const caixa = (sel) => {
      const cs = getComputedStyle(document.querySelector(sel));
      return { fundo: cs.backgroundColor, raio: cs.borderTopLeftRadius };
    };
    return { ids, hist: caixa('#lyricsViewBtn'), vizinho: caixa('#next') };
  });
  // A ORDEM MUDOU NA v1.5.6, a pedido do operador: *"ajuste a ordem dos controles
  // da mídia na linha abaixo do preview. Está: …, música anterior, play/pause,
  // stop, próxima música. Coloque o stop após o 'próxima música'"*. O parar
  // estava ENTRE o ▶ e o ⏭, isto é, no meio do trio de navegação — o dedo que vai
  // do play para a próxima passa por cima do único botão da fileira que ENCERRA a
  // cena. Fora do trio, ⏮ ▶ ⏭ ficam contíguos e o parar é o fim da linha.
  checar(linha.ids.join(',') === 'repeat,plBtn,prev,playpause,next,stop,lyricsViewBtn',
    'a ordem é repetir → playlist → anterior → play → próximo → parar → auxiliar de leitura',
    linha.ids);
  checar(linha.hist.fundo === linha.vizinho.fundo && linha.hist.raio === linha.vizinho.raio,
    'e a sétima veste a MESMA caixa dos vizinhos — um chapado sozinho numa fileira de seis com fundo lê como um que ficou de fora',
    linha);

  // ── 7. O MODO FÁCIL NÃO HERDA A COLUNA DE OPERAÇÃO ──────────────────────
  // A preview é UM nó só e MUDA DE CASA: tudo o que se pendura nela viaja.
  const facil = await pg.evaluate(() => {
    setAppMode('simple');
    const vis = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    };
    const r = {
      mudouDeCasa: document.querySelector('.preview').closest('.simple-stage') !== null,
      operacao: vis('.pv-fabs--esq'),
      selo: vis('.pv-fabs--base'),
      teclaPropria: vis('#simpleMute'),
    };
    setAppMode('full');
    return r;
  });
  checar(facil.mudouDeCasa, 'a preview de fato mudou de casa no Modo Fácil', facil);
  checar(facil.operacao === false && facil.teclaPropria,
    'e a coluna de operação NÃO foi junto — lá o mudo já é uma tecla grande própria', facil);
  checar(facil.selo,
    'o SELO de camadas fica: ele é a única saída da camada de cima, e não há gêmeo dele lá', facil);

  // ---- O CARTÃO DE ESPERA É CENTRADO NA PREVIEW (v1.4.9) --------------------
  //
  // Duas coisas que falham CALADAS, e a segunda saiu de dentro da primeira.
  //
  // O `#pvBusy` cobre a preview inteira (`inset: 0`) e centra o cartão com
  // `justify-content: center` — que centra no CONTEÚDO, não na caixa. A folga
  // que mantém o cartão fora das colunas de `.pv-fab` era só à DIREITA (de
  // quando só existia a coluna do player), então o centro do conteúdo não era o
  // centro da preview: MEDIDO, 15px à esquerda, em toda largura e com todo nome.
  // Ninguém relata 15px; lê-se como desalinho e não se sabe de quê.
  //
  // E a folga que faltava do outro lado é literalmente o que ela existe para
  // impedir: a coluna de OPERAÇÃO entrou à esquerda na v1.3.5 e ninguém refez a
  // conta. MEDIDO a 360px com um nome longo, o cartão entrava 28px sob ela — e
  // as colunas são `z-index: 5` contra 4, então o botão da cortina era desenhado
  // POR CIMA do aro de espera.
  //
  // As DUAS asserções são necessárias: uma folga simétrica GRANDE demais centra
  // e afasta, uma PEQUENA demais centra e deixa invadir — só a de centro
  // aprovaria a segunda.
  const cartao = await pg.evaluate(async () => {
    const el = document.getElementById('pvBusy');
    // Sem `previewBusy` de propósito: o que se mede é a CAIXA, e o cartão pode
    // nascer no modo em que aquela função devolve o stub.
    el.classList.add('on');
    document.getElementById('pvBusyLabel').textContent =
      'Provai e Vede 2026 — o episódio de sábado, com um nome bem comprido';
    await new Promise((r) => requestAnimationFrame(r));
    const cx = (b) => b.left + b.width / 2;
    const pv = document.querySelector('.preview').getBoundingClientRect();
    const card = document.querySelector('.pv-busy-card').getBoundingClientRect();
    const col = (sel) => {
      const c = document.querySelector(sel);
      if (!c || getComputedStyle(c).display === 'none') return null;
      return c.getBoundingClientRect();
    };
    const esq = col('.pv-fabs--esq');
    const dir = col('.pv-fabs:not(.pv-fabs--esq):not(.pv-fabs--base)');
    el.classList.remove('on');
    document.getElementById('pvBusyLabel').textContent = '';
    return {
      desvio: +(cx(card) - cx(pv)).toFixed(1),
      sobEsq: esq ? +(esq.right - card.left).toFixed(1) : null,
      sobDir: dir ? +(card.right - dir.left).toFixed(1) : null,
    };
  });
  // Um pixel de tolerância: a preview tem largura fracionária (a proporção do
  // telão manda nela), e meio pixel de arredondamento não é descentralização.
  checar(Math.abs(cartao.desvio) <= 1,
    'o cartão de espera é CENTRADO na preview — `justify-content: center` centra '
    + 'no conteúdo, e uma folga só de um lado o desloca em toda largura e com '
    + 'todo nome', cartao);
  checar(cartao.sobEsq !== null && cartao.sobEsq <= 0 && cartao.sobDir <= 0,
    'e ele não passa por baixo de NENHUMA das duas colunas de `.pv-fab` — elas '
    + 'são `z-index: 5` contra 4, então o que invade não é coberto: é coberto '
    + 'POR ELAS', cartao);
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
