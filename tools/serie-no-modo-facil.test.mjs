#!/usr/bin/env node
// ============================================================================
// A SÉRIE NO MODO FÁCIL: FECHA NUM MOVIMENTO SÓ, E A SEMANA NÃO É UM CARTÃO A MAIS (v1.12.57)
//
// Relato do operador: *"O mesmo problema da coleção travando no último instante antes de
// fechar, ocorre no modo simples com o provai e vede e o informativo das missões. Além disso
// … parece ter dupla camada de card na visualização desses vídeos unitários … no modo
// escuro, os itens estão em fundos escuros, mas o provai e vede tem um card azul sobre esse
// card escuro."*
//
// DESDE A v1.13.15 A SÉRIE NÃO É CARD NO MODO FÁCIL (o vídeo da semana mora num bloco da
// raiz, `blocoSemanasRaiz` — o `semana-item`, bloco I). O que este oráculo guarda continua
// valendo, e por isso ele mudou de ALVO e não saiu:
//  · A e B — o fechamento num movimento só é do ACORDEÃO, não da série: as duas causas
//    (o REDESENHO no meio da curva e o RECUO do corpo) são medidas no card do Hinário 2022,
//    o card que sobra no Modo Fácil. O oráculo PROVOCA o redesenho no meio da curva
//    (`renderCollectionsNow`, o caminho do app), para não depender da sorte do relógio.
//    A régua é a do `favoritos-fechar`: altura amostrada a cada `requestAnimationFrame`,
//    monotonia, tempo PARADO antes do fim e o maior passo contra o percurso;
//  · C — o CARTÃO A MAIS: as linhas da semana pousam direto na TINTA do bloco "Este sábado",
//    a mesma de um card de coleção fechado (o poço da raiz), sem um cartão azul no meio, e na
//    coluna da barra de um card. Nos dois temas (`comTema`);
//  · D — no avançado o destaque CONTINUA preenchido (ali ele separa a semana da lista
//    inteira), e o card da série fecha num movimento só.
//
//   node tools/serie-no-modo-facil.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperar, esperarCortina, checar, falhas,
  comModoAvancado, comTema, RAIZ_WEB,
} from './arnes.mjs';

const PATAMAR_MAX_MS = 60;
const SALTO_MAX = 0.85;
const SERIE = 'serie-provai-vede-2026';

const PONTE = `(() => {
  const comCallId = new Set(['apkInstalar','espelhoLigar','displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','castTarget','saidaDeAudioAlvo',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','apkProcurar','otaPending','otaApply',
    'otaCheck','otaDiag','ytDiag','farolEstado','ytCanalPlaylists','ytPlaylist','ytDetalhes',
    'areaTransferencia','pacoteDiag','cifraHtml','espelhoRedes']);
  const vazio = { displays: [{ id: 1, name: 'TV de teste', telao: true }], listFolder: [], pickDoc: [], ytSearch: [],
    espelhoEstado: { ligado: false, telas: [] }, espelhoDiag: {},
    espelhoCertEstado: { temCert: false }, castTarget: { label: 'Tela de teste' },
    farolEstado: { conta: true, ultimo: 0, diag: 'de teste' } };
  const B = {
    shellVersion: () => 72,
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: (id) => { setTimeout(() => window.__avResolve(id, ''), 0); },
    busPost: () => {},
    otaConfirm: () => {},
  };
  const nomes = Object.keys(vazio).concat([...comCallId], ['apkInstalar','bgProgress',
    'bgConcluido','captureVolumeKeys','deckDiscard','espelhoDesligar','espelhoLigar','keepAlive',
    'nowPlaying','openCast','abrirSaidaDeAudio','openExternal','systemVolume','temaClaro','ytCancel','ytDiscard',
    'projecaoLocal','compartilharTexto','salvarTexto','copiarTexto']);
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      if (!comCallId.has(n)) return undefined;
      const id = args[0];
      if (typeof id === 'string') {
        const v = Object.prototype.hasOwnProperty.call(vazio, n) ? vazio[n] : null;
        setTimeout(() => { try { window.__avResolve(id, v); } catch (_) {} }, 0);
      }
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const erros = [];

function ler(serie) {
  const ini = serie[0][1];
  const fim = serie[serie.length - 1][1];
  const sobe = fim > ini;
  const total = Math.abs(fim - ini);
  let volta = 0; let parado = 0; let salto = 0;
  for (let i = 1; i < serie.length; i++) {
    const [t0, a] = serie[i - 1];
    const [t1, b] = serie[i];
    const passo = sobe ? b - a : a - b;
    if (passo < -0.5) volta = Math.max(volta, -passo);
    salto = Math.max(salto, Math.abs(b - a));
    if (Math.abs(b - a) < 0.5 && Math.abs(a - fim) > 1) parado += t1 - t0;
  }
  return { ini: Math.round(ini), fim: Math.round(fim), volta: Math.round(volta), parado: Math.round(parado),
    salto: total ? +(salto / total).toFixed(2) : 0 };
}

async function abrir({ tema = 'escuro', avancado = false } = {}) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true });
  await semRedeExterna(ctx);
  await comTema(ctx, tema);
  if (avancado) await comModoAvancado(ctx);
  await ctx.addInitScript(PONTE);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  const pronto = await esperar(pg, () => window.AVDB && window.AVSerie && !!document.querySelector('.lib-bar'), null, 30000);
  if (pronto !== true) throw new Error('o app não subiu: ' + pronto);
  if (avancado) await pg.evaluate(() => openHymnSearch(false));
  await esperar(pg, () => document.getElementById('hymnSearchPopup').classList.contains('open'), null, 10000);
  const nome = await pg.evaluate((id) => {
    const coll = allCollections().find((c) => c.id === id);
    const sab = AVSerie.sabadoDaSemana();
    const desloca = (n) => { const d = new Date(coll.serie.ano, sab.mes - 1, sab.dia + n); return { mes: d.getMonth() + 1, dia: d.getDate() }; };
    const faixa = (nome, quando) => ({ id_music: nome, name: nome, ytUrl: 'y/' + nome, seconds: 300, canal: 'Canal', serieData: quando });
    collState[id] = { indexSyncedAt: Date.now(), serieDiarioEm: Date.now(),
      songs: [faixa('passada', desloca(-7)), faixa('semana', desloca(0)), faixa('seguinte', desloca(7))] };
    collState['hymnal-2022'] = { indexSyncedAt: Date.now(), isHymnal: true,
      songs: Array.from({ length: 4 }, (_, i) => ({ id_music: 'h' + (i + 1), track: i + 1, name: 'Hino ' + (i + 1),
        duration: '3:00', has_instrumental_music: false }))
        // OS DOIS ITENS FIXOS do Modo Fácil (v1.13.58): são hinos de VERDADE do
        // Hinário 2022, e sem eles no índice a linha não nasce — o que C3 mede é
        // justamente essa ordem na raiz.
        .concat([
          { id_music: '572', track: 572, name: 'Ofertas de amor', duration: '3:00', has_instrumental_music: false },
          { id_music: '533', track: 533, name: 'Vinde, meninos', duration: '3:00', has_instrumental_music: false },
        ]) };
    // A RAIZ DO MODO FÁCIL (v1.13.57): os hinários e as categorias moram no grupo
    // "Diversas", que nasce FECHADO — o card do Hinário 2022 só existe com ele aberto.
    // No avançado ele continua na raiz, sem grupo.
    if (appMode === 'simple') grupoAberto = 'Diversas';
    // A rotina da semana não roda no oráculo: o redesenho que ela provoca é PROVOCADO à mão.
    ui(id).semanaProxima = Date.now() + 3600e3;
    renderSearchResults('');
    return coll.name;
  }, SERIE);
  await pg.waitForTimeout(400);
  return { ctx, pg, nome };
}

// Toca a barra do card e amostra a altura dele; `redesenharEm` provoca o redesenho do
// acervo (o caminho do tique de progresso) no meio da curva.
const tocar = (pg, nome, redesenharEm, tiqueEm) => pg.evaluate(async ({ nome, redesenharEm, tiqueEm }) => {
  // O TIQUE DO PROGRESSO (`refreshCollectionsIfVisible`) é CAPTURADO e disparado `tiqueEm` ms
  // depois do toque — o código do app, num instante escolhido, e não a sorte do relógio de 400 ms.
  let tique = null;
  if (tiqueEm !== undefined && tiqueEm !== null) {
    const orig = window.setTimeout;
    clearTimeout(collRefreshTimer); collRefreshTimer = null;
    window.setTimeout = (f, ms, ...a) => {
      if (ms === COLL_REFRESH_MS && !tique) { tique = f; return 0; }
      return orig(f, ms, ...a);
    };
    try { refreshCollectionsIfVisible(); } finally { window.setTimeout = orig; }
  }
  // O CARD pode estar na RAIZ (avançado) ou dentro do grupo "Diversas"
  // (fácil, v1.13.57) — o que não muda é ele ser o card da coleção pelo nome.
  const achar = () => [...hymnResultsEl.querySelectorAll('.hymnal-card')].find((b) => {
    const bar = b.querySelector('.coll-bar'); return bar && bar.textContent.includes(nome);
  });
  const out = [[0, achar().getBoundingClientRect().height]];
  const t0 = performance.now();
  achar().querySelector('.coll-bar').click();
  if (redesenharEm) setTimeout(() => renderCollectionsNow(), redesenharEm);
  // `0` = NO MESMO TURNO do toque, antes de qualquer quadro: é o vão entre o desenho do card
  // que abre e o quadro em que a animação começa, o caso mais apertado (e o único determinístico).
  if (tique && tiqueEm === 0) { collRefreshTimer = null; tique(); }
  else if (tique) setTimeout(() => { collRefreshTimer = null; tique(); }, tiqueEm);
  await new Promise((fim) => {
    const f = () => {
      const t = performance.now() - t0; const li = achar();
      out.push([t, li ? li.getBoundingClientRect().height : -1]);
      if (t < 700) requestAnimationFrame(f); else fim();
    };
    requestAnimationFrame(f);
  });
  return { serie: out, aberto: !!achar().querySelector('.coll-open') };
}, { nome, redesenharEm, tiqueEm: tiqueEm ?? null });

try {
  // ======================================================================
  // A · MODO FÁCIL: ABRIR E FECHAR A SÉRIE, COM UM REDESENHO NO MEIO DA CURVA
  // ======================================================================
  {
    const { ctx, pg, nome } = await abrir();
    const prem = await pg.evaluate(() => document.body.classList.contains('mode-simple')
      && document.body.classList.contains('simples-barra'));
    checar(prem, 'A0 · PREMISSA: Modo Fácil com tela, a Biblioteca como tela principal', String(prem));
    const hino = 'Hinário Adventista 2022';
    const ab = await tocar(pg, hino, 0, 0);
    const a = ler(ab.serie);
    checar(ab.aberto && a.fim - a.ini > 40, 'A1 · o card (o Hinário 2022, o que sobra no Modo Fácil) ABRIU', a);
    checar(a.volta === 0 && a.salto < SALTO_MAX && a.parado <= PATAMAR_MAX_MS,
      'A2 · ABRIR: o card cresce sem saltar ao tamanho final, mesmo com o tique do progresso caindo no '
      + 'meio da curva (ele espera a animação)', a);
    await pg.waitForTimeout(400);
    const fe = await tocar(pg, hino, 60);
    const f = ler(fe.serie);
    checar(!fe.aberto && f.ini - f.fim > 40, 'A3 · o card FECHOU', f);
    checar(f.volta === 0,
      'A4 · FECHAR: o card só desce — o redesenho no meio da curva não o devolve aberto e inteiro', f);
    checar(f.parado <= PATAMAR_MAX_MS,
      'A5 · FECHAR: e não PARA antes do fim (' + f.parado + ' ms parado, teto ' + PATAMAR_MAX_MS
      + ') — nem pelo redesenho, nem pelo recuo do corpo no fim da curva', f);
    await ctx.close();
  }

  // ======================================================================
  // B · MODO FÁCIL, SEM REDESENHO: O FIM DA CURVA É O CARD FECHADO
  // ======================================================================
  {
    const { ctx, pg } = await abrir();
    await tocar(pg, 'Hinário Adventista 2022', 0);
    await pg.waitForTimeout(400);
    const fe = await tocar(pg, 'Hinário Adventista 2022', 0);
    const f = ler(fe.serie);
    checar(!fe.aberto && f.volta === 0 && f.parado <= PATAMAR_MAX_MS,
      'B1 · FECHAR sem redesenho: o card desce até a altura fechada sem ficar parado acima dela '
      + '(o recuo do corpo vai a zero com a altura)', f);
    await ctx.close();
  }

  // ======================================================================
  // C · A SEMANA NÃO É UM CARTÃO A MAIS (Modo Fácil, os dois temas)
  // ======================================================================
  for (const tema of ['escuro', 'claro']) {
    const { ctx, pg } = await abrir({ tema });
    const c = await pg.evaluate(() => {
      const fundo = (el) => {
        for (let n = el; n; n = n.parentElement) {
          const bg = getComputedStyle(n).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return { bg, cls: String(n.className) };
        }
        return null;
      };
      const bloco = hymnResultsEl.querySelector(':scope > .semana-raiz');
      const semana = bloco && bloco.querySelector('.semana-raiz-item');
      // O card do Hinário 2022 mora dentro do grupo "Diversas" no Modo Fácil
      // (v1.13.57) — o `tocar`/`abrir` já o abriu. No avançado ele segue na raiz.
      const card = [...hymnResultsEl.querySelectorAll('.hymnal-card')].find((b) => {
        const bar = b.querySelector('.coll-bar'); return bar && bar.textContent.includes('Hinário Adventista 2022');
      });
      // A COLUNA DO ▶ NO DESENHO NOVO (v1.13.58): os cards migraram para dentro dos grupos, então
      // a referência da raiz é a LINHA FIXA do Hinário 2022 — as duas famílias de linha do topo.
      const fixa = [...hymnResultsEl.querySelectorAll('.semana-raiz .semana-raiz-item')]
        .find((li) => li !== semana && (li.querySelector('.hymn-name') || {}).textContent !== '');
      const icone = fixa && fixa.querySelector('.hymn-play-thumb');
      const thumb = semana && semana.querySelector('.hymn-play-thumb');
      // A ORDEM DA RAIZ (v1.13.57/58): o bloco "Este sábado", as DUAS linhas fixas
      // do Hinário 2022 e só então os grupos (no Fácil, os dois da v1.13.57).
      const raiz = [...hymnResultsEl.children].map((li) => {
        if (li.classList.contains('semana-raiz')) return 'semana';
        if (li.classList.contains('bloco-fixo')) {
          const n = li.querySelector('.hymn-name');
          return 'fixo:' + (n ? n.textContent : '?');
        }
        return li.classList.contains('coll-group') ? 'grupo:' + (li.dataset.grupo || '?') : 'outro';
      });
      return {
        tema: document.documentElement.dataset.tema || 'escuro',
        atrasSemana: semana ? fundo(semana) : null, card: getComputedStyle(card).backgroundColor,
        bloco: bloco ? getComputedStyle(bloco).backgroundColor : null,
        esq: [thumb ? Math.round(thumb.getBoundingClientRect().left) : -1, Math.round(icone.getBoundingClientRect().left)],
        raiz,
        fixos: [...hymnResultsEl.querySelectorAll('.semana-raiz')]
          .map((b) => [...b.querySelectorAll('.semana-raiz-item .hymn-name')].map((n) => n.textContent))
          .find((nomes) => nomes.length === 2 && !/Vede|Informativo/.test(nomes.join(' '))) || [],
      };
    });
    checar(c.tema === tema, 'C0 · PREMISSA (' + tema + '): o tema é o que se pediu', c);
    // A TINTA agora é a do BLOCO (v1.13.58): os cards migraram para dentro dos grupos, e a
    // referência da raiz é o próprio bloco — a linha não pode ter cartão azul próprio.
    checar(c.atrasSemana && /semana-raiz/.test(c.atrasSemana.cls) && c.atrasSemana.bg === c.bloco,
      'C1 · (' + tema + ') a linha da semana pousa direto no bloco "Este sábado", sobre a MESMA tinta '
      + 'dele — sem um cartão próprio no meio', c);
    checar(Math.abs(c.esq[0] - c.esq[1]) <= 1,
      'C2 · (' + tema + ') e o ▶ dela fica na coluna do ícone da barra de um card', c);
    // C3 · O QUE VEM LOGO DEPOIS DO BLOCO (v1.13.58): as duas linhas fixas do
    // Hinário 2022 — e ANTES de qualquer grupo. Reversão: sem elas (ou com elas
    // depois dos grupos) a raiz volta a ter o "Este sábado" sozinho no topo.
    // Os dois fixos moram num BLOCO próprio (a mesma caixa do "Este sábado", v1.13.58), por
    // isso a raiz mostra `semana` duas vezes: o bloco da semana e o das linhas fixas.
    checar(JSON.stringify(c.raiz.slice(0, 2)) === JSON.stringify(['semana', 'semana'])
      && JSON.stringify(c.fixos) === JSON.stringify(['Ofertório', 'Abertura da adoração infantil'])
      && /^grupo:/.test(c.raiz[2] || ''),
      'C3 · (' + tema + ') e logo depois do bloco vêm as DUAS linhas fixas do Hinário 2022 '
      + '("Ofertório" e "Abertura da adoração infantil"), antes dos grupos', c.raiz);
    await ctx.close();
  }

  // ======================================================================
  // D · NO AVANÇADO O DESTAQUE CONTINUA PREENCHIDO, E O CARD FECHA NUM MOVIMENTO SÓ
  // ======================================================================
  {
    const { ctx, pg, nome } = await abrir({ avancado: true });
    await tocar(pg, nome, 0);
    const d = await pg.evaluate(() => getComputedStyle(document.querySelector('.serie-destaque')).backgroundColor);
    checar(!/rgba\(0, 0, 0, 0\)|transparent/.test(d),
      'D1 · no avançado o destaque da semana segue preenchido: ali ele separa a semana da lista inteira', d);
    await pg.waitForTimeout(400);
    const fe = await tocar(pg, nome, 60);
    const f = ler(fe.serie);
    checar(!fe.aberto && f.volta === 0 && f.parado <= PATAMAR_MAX_MS,
      'D2 · no avançado o card da série (lista inteira) também fecha sem voltar e sem parar, com um '
      + 'redesenho no meio da curva', f);
    await ctx.close();
  }

  checar(erros.length === 0, 'nenhum erro de página', erros);
} finally {
  await navegador.close();
  servidor.close();
}
process.exit(falhas.length ? 1 : 0);
