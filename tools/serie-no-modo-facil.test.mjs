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
// DUAS CAUSAS NO FECHAMENTO, e cada uma tem célula própria:
//  · o REDESENHO no meio do acordeão: o tique do progresso (ou a verificação da semana que
//    abrir a série dispara) refazia o card a partir do estado — ainda ABERTO — e ele voltava
//    inteiro até a animação antiga fechar. O oráculo PROVOCA o redesenho no meio da curva
//    (`renderCollectionsNow`, o caminho do app), para não depender da sorte do relógio;
//  · o RECUO do corpo: `height: 0` não passa do `padding` (border-box), e o card parava
//    ~14px acima da altura fechada no fim da curva até o redesenho.
// A régua é a do `favoritos-fechar`: altura amostrada a cada `requestAnimationFrame`,
// monotonia, tempo PARADO antes do fim e o maior passo contra o percurso.
//
// O CARTÃO A MAIS é medido pela TINTA que fica atrás da linha: o primeiro ancestral com
// fundo, contra o da faixa de um hinário aberto no mesmo modo e tema. Nos dois temas
// (`comTema`); e no avançado o destaque CONTINUA preenchido (ali ele separa a semana da lista
// inteira).
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
  const comCallId = new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
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
    takeShare: () => '',
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
        duration: '3:00', has_instrumental_music: false })) };
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
  const achar = () => [...hymnResultsEl.children].find((b) => {
    const bar = b.querySelector('.coll-bar'); return bar && bar.textContent.includes(nome);
  });
  const out = [[0, achar().getBoundingClientRect().height]];
  const t0 = performance.now();
  achar().querySelector('.coll-bar').click();
  if (redesenharEm) setTimeout(() => renderCollectionsNow(), redesenharEm);
  if (tique) setTimeout(() => { collRefreshTimer = null; tique(); }, tiqueEm);
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
    const ab = await tocar(pg, nome, 0, 0);
    const a = ler(ab.serie);
    checar(ab.aberto && a.fim - a.ini > 40, 'A1 · o card da série ABRIU', a);
    checar(a.volta === 0 && a.salto < SALTO_MAX && a.parado <= PATAMAR_MAX_MS,
      'A2 · ABRIR: o card cresce sem saltar ao tamanho final, mesmo com o tique do progresso caindo no '
      + 'meio da curva (ele espera a animação)', a);
    await pg.waitForTimeout(400);
    const fe = await tocar(pg, nome, 60);
    const f = ler(fe.serie);
    checar(!fe.aberto && f.ini - f.fim > 40, 'A3 · o card da série FECHOU', f);
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
    const { ctx, pg, nome } = await abrir();
    await tocar(pg, nome, 0);
    await pg.waitForTimeout(400);
    const fe = await tocar(pg, nome, 0);
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
    const { ctx, pg, nome } = await abrir({ tema });
    const c = await pg.evaluate((nome) => {
      const fundo = (el) => {
        for (let n = el; n; n = n.parentElement) {
          const bg = getComputedStyle(n).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return { bg, cls: n.className };
        }
        return null;
      };
      const card = (txt) => [...hymnResultsEl.children].find((b) => {
        const bar = b.querySelector('.coll-bar'); return bar && bar.textContent.includes(txt);
      });
      const serie = allCollections().find((x) => x.name === nome);
      ui(serie.id).expanded = true; ui('hymnal-2022').expanded = true; ui('hymnal-2022').shown = 100;
      renderSearchResults('');
      const semana = card(nome).querySelector('.serie-destaque .hymn-result');
      const hino = card('Hinário Adventista 2022').querySelector('.coll-songs > .hymn-result');
      const rs = semana.getBoundingClientRect(); const rh = hino.getBoundingClientRect();
      return {
        tema: document.documentElement.dataset.tema || 'escuro',
        atrasSemana: fundo(semana), atrasHino: fundo(hino),
        destaque: getComputedStyle(card(nome).querySelector('.serie-destaque')).backgroundColor,
        esq: [Math.round(rs.left), Math.round(rh.left)], dir: [Math.round(rs.right), Math.round(rh.right)],
      };
    }, nome);
    checar(c.tema === tema, 'C0 · PREMISSA (' + tema + '): o tema é o que se pediu', c);
    checar(c.atrasSemana && c.atrasHino && c.atrasSemana.bg === c.atrasHino.bg
      && /coll-open/.test(c.atrasSemana.cls) && c.atrasSemana.cls === c.atrasHino.cls,
      'C1 · (' + tema + ') a linha da semana pousa direto no card da coleção, sobre a MESMA tinta da '
      + 'faixa de um hinário — sem um cartão azul no meio', c);
    checar(Math.abs(c.esq[0] - c.esq[1]) <= 1 && Math.abs(c.dir[0] - c.dir[1]) <= 1,
      'C2 · (' + tema + ') e na mesma coluna das faixas do hinário', c);
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
