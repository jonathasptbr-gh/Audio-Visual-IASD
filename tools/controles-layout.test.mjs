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
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','castTarget',
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

  // ── 1. GEOMETRIA: a preview FLANQUEADA pelos dois botões de slide ───────
  const geo = await pg.evaluate(() => {
    const cx = (sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return { esq: r.left, dir: r.right, meio: r.left + r.width / 2, alto: r.height, larg: r.width };
    };
    return { pv: cx('.preview'), ant: cx('#slidePrevBtn'), prox: cx('#slideNextBtn') };
  });
  checar(geo.ant.dir <= geo.pv.esq,
    'o botão de VOLTAR slide fica à esquerda da preview, fora dela', geo);
  checar(geo.prox.esq >= geo.pv.dir,
    'o de PASSAR slide fica à direita, na fatia que os três controles deixaram vaga', geo);
  checar(Math.abs(geo.ant.larg - geo.prox.larg) < 2 && Math.abs(geo.ant.alto - geo.prox.alto) < 2,
    'e os dois têm a MESMA caixa — um par que não é gêmeo não se lê como par', geo);
  // "Botão inteiro nesse espaço": ele acompanha a faixa da preview, não a
  // altura de um ícone. Sem piso, uma regra perdida devolve um `.ctl-btn` de
  // 34px boiando numa coluna de 150 — e a tela continua parecendo certa.
  checar(geo.ant.alto > geo.pv.alto * 0.7,
    'e cada um ocupa a fatia INTEIRA da própria coluna, não a altura de um ícone', geo);

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

  // ── 3. O SELO DE CAMADAS, no TOPO AO CENTRO ─────────────────────────────
  const selo = await pg.evaluate(() => {
    document.getElementById('pvCamadaBtn').hidden = false;   // ele só aparece com duas camadas no ar
    const pv = document.querySelector('.preview').getBoundingClientRect();
    const r = document.getElementById('pvCamadaBtn').getBoundingClientRect();
    return {
      desvio: Math.abs((r.left + r.width / 2) - (pv.left + pv.width / 2)),
      noAlto: r.top - pv.top,
      alturaPv: pv.height,
      colideComOperacao: (() => {
        const c = document.querySelector('.pv-fabs--esq').getBoundingClientRect();
        return !(r.right <= c.left || r.left >= c.right || r.bottom <= c.top || r.top >= c.bottom);
      })(),
    };
  });
  checar(selo.desvio < 2, 'o selo de camadas está CENTRADO na horizontal', selo);
  checar(selo.noAlto < selo.alturaPv * 0.25, 'e no ALTO da preview', selo);
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

  // ── 6. O FADER ENGOLE A FATIA DO PASSAR — e o par some junto ────────────
  const fader = await pg.evaluate(() => {
    openVolume();
    const vis = (sel) => {
      const el = document.querySelector(sel);
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
    };
    const aberto = { ant: vis('#slidePrevBtn'), prox: vis('#slideNextBtn') };
    mixerEl.classList.remove('vol-open', 'vol-closing', 'vol-revealing');
    deckEl.classList.remove('vol-open');
    return { aberto, fechado: { ant: vis('#slidePrevBtn'), prox: vis('#slideNextBtn') } };
  });
  checar(fader.aberto.ant === false && fader.aberto.prox === false,
    'com o fader aberto o PAR de slide some junto — meia dupla é pior que dupla nenhuma', fader.aberto);
  checar(fader.fechado.ant && fader.fechado.prox,
    'e volta junto ao fechar', fader.fechado);

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
      selo: vis('.pv-fabs--topo'),
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
