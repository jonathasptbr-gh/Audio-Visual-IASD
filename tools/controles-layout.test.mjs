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
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

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
      hist: cx('#historyBtn'), seis,
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
    // separa o histórico do botão de voltar.
    const vaos = {
      'nowplaying→preview': g.pv.topo - g.np.base,
      'preview→transporte': g.tr.topo - g.pv.base,
      'voltar→preview': g.pv.esq - g.ant.dir,
      'preview→passar': g.prox.esq - g.pv.dir,
      'passar→histórico': g.hist.topo - g.prox.base,
      'transporte→histórico': g.hist.esq - g.seis[5].dir,
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
      `e a DIREITA: passar, histórico e deck (${nome})`,
      { prox: g.prox.dir, hist: g.hist.dir, deck: g.deck.dir });

    // A FAIXA É A PREVIEW: os três da linha do meio começam e terminam juntos.
    for (const [q, b] of [['VOLTAR', g.ant], ['PASSAR', g.prox]]) {
      checar(perto(b.alto, g.pv.alto) && perto(b.topo, g.pv.topo) && perto(b.base, g.pv.base),
        `o botão de ${q} tem a ALTURA da preview, topo e base juntos (${nome})`,
        { botao: [b.topo, b.base, b.alto], preview: [g.pv.topo, g.pv.base, g.pv.alto] });
    }

    // ===== A BARRA DE PROGRESSO CAI NAS COLUNAS DO DECK (v1.3.8) =====
    // Ela parava na coluna 2 (a 3 era do histórico), então não batia com a
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
      letra: um('#lyricsViewBtn'), cortina: um('#viewToggle'), mudo: um('#muteToggle'),
      ordem: [...document.querySelectorAll('.pv-fabs--esq .pv-fab')].map((b) => b.id),
    };
  });
  for (const [nome, b] of [['leitura auxiliar', col.letra], ['cortina', col.cortina], ['mudo', col.mudo]]) {
    checar(b.dentro && b.naEsquerda,
      `o botão de ${nome} está SOBRE a preview, na metade esquerda`, b);
    // "Sem botão, apenas ícones": o desenho da miniatura é o traço com as três
    // `drop-shadow`; uma pastilha ali viraria o único botão "de verdade".
    checar(/rgba\(0, 0, 0, 0\)|transparent/.test(b.fundo) && b.borda === '0px',
      `e ele é só ÍCONE — sem pastilha e sem contorno (${nome})`, b);
    checar(b.temGlifo === false,
      `e o desenho é SVG, não glifo da fonte — um \`.msym\` não tem traço para as três sombras do \`.pv-fab\` (${nome})`, b);
  }
  checar(col.ordem.join(',') === 'lyricsViewBtn,viewToggle,muteToggle',
    'a ordem da coluna é leitura → cortina → mudo (o mais consultado no topo)', col.ordem);

  // TOPO, MEIO e BASE — não um bloco no centro. É o alinhamento da coluna do
  // player ao lado (cast em cima, tela cheia embaixo), e sem ele os três liam
  // como um agrupamento solto no meio da miniatura. Falha calada: eles
  // continuam ali, continuam funcionando, só param de ter relação com nada.
  const espalho = await pg.evaluate(() => {
    const pv = document.querySelector('.preview').getBoundingClientRect();
    const ic = [...document.querySelectorAll('.pv-fabs--esq .pv-fab')]
      .map((e) => e.getBoundingClientRect());
    return {
      alturaPv: pv.height,
      topo: ic[0].top - pv.top,
      base: pv.bottom - ic[ic.length - 1].bottom,
      desvioDoMeio: ((ic[1].top + ic[1].bottom) / 2) - ((pv.top + pv.bottom) / 2),
      // O vão entre vizinhos: com `space-between` ele é o que sobra; num bloco
      // centrado é o `gap`, muito menor. É a assinatura das duas formas.
      vao: ic[1].top - ic[0].bottom,
    };
  });
  checar(espalho.topo >= 0 && espalho.topo <= 4,
    'o primeiro ícone encosta no TOPO da preview', espalho);
  checar(espalho.base >= 0 && espalho.base <= 4,
    'o último encosta na BASE — e nenhum dos dois vaza para fora dela', espalho);
  checar(Math.abs(espalho.desvioDoMeio) < 2,
    'e o do meio fica no MEIO', espalho);
  // A prova de que é `space-between` e não três botões colados no centro: o vão
  // entre vizinhos tem de ser o que SOBRA da altura, não um `gap` fixo.
  checar(espalho.vao > (espalho.alturaPv - 3 * 34) / 2 - 4,
    'os três estão ESPALHADOS pela altura, não agrupados num bloco', espalho);

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
      pv: cx('.preview'), hist: cx('#historyBtn'),
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
    'o histórico também fica: ele não tem nada a ver com volume', aberto.hist);

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
    const ids = [...document.querySelectorAll('.transport .t-btn'), document.getElementById('historyBtn')]
      .map((e) => e.id);
    const caixa = (sel) => {
      const cs = getComputedStyle(document.querySelector(sel));
      return { fundo: cs.backgroundColor, raio: cs.borderTopLeftRadius };
    };
    return { ids, hist: caixa('#historyBtn'), vizinho: caixa('#next') };
  });
  checar(linha.ids.join(',') === 'repeat,plBtn,prev,playpause,stop,next,historyBtn',
    'a ordem é repetir → playlist → anterior → play → parar → próximo → histórico',
    linha.ids);
  checar(linha.hist.fundo === linha.vizinho.fundo && linha.hist.raio === linha.vizinho.raio,
    'e o histórico veste a MESMA caixa dos vizinhos — um chapado sozinho numa fileira de seis com fundo lê como um que ficou de fora',
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
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
