#!/usr/bin/env node
// ============================================================================
// O NOME DA MÍDIA E A BARRA DE PROGRESSO DO MODO FÁCIL SÃO UM CARD (v1.11.16)
//
// Pedido do operador, verbatim: *"colocar a seção de nome de mídia atual e barra de
// progresso que temos no modo simples dentro de um card. Semelhante ao que já é feito na
// seção controles do modo avançado. Onde cada seção fica em um card"*.
//
// O `.nowplaying` do avançado já é um cartão (superfície, `--radius-card`, nome e barra
// empilhados); o Modo Fácil era a única tela em que o nome flutuava sobre o fundo enquanto a
// placa da letra e as teclas eram cartões.
//
// O que este arquivo trava, e cada uma falha CALADA (a tela continua tocando):
//  B1 · o nome e a barra moram DENTRO de `.simple-nowplaying`, e ele é irmão da placa da letra,
//       ACIMA dela, dentro de `.simple-song` — a zona que a Biblioteca mede.
//  B2 · o card PINTA: superfície opaca igual à da placa da letra (a das vizinhas desta tela),
//       com o mesmo raio de cartão, e diferente do fundo do app.
//  B3 · o conteúdo respira dentro dele (o nome e a barra não encostam nas bordas) e o card
//       ENCOLHE para o nome quando a mídia não tem duração (a barra sai).
//  B4 · o vão entre o card e a placa é o vão entre as seções desta tela — um só.
//  B5 · dentro do card a superfície AFUNDA: o trilho da barra é o `--surface-sunk`, e não o
//       `--surface` flutuante (que sobre um cartão pinta outro tom).
//  B6 · a placa da letra continua preenchendo o que sobra (nada vazou nem sobrou vão embaixo).
//  B7 · um nome longo é cortado com reticências DENTRO do card, num celular estreito.
//  B8 · a barra segue interativa: tocar no trilho salta para o ponto.
//  B9 · a Biblioteca como tela principal esconde o card junto com a leitura.
//
//   node tools/modo-facil-card.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperar, esperarCortina, porque, checar, falhas, comTema,
} from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;
const navegador = await abrirNavegador();
const erros = [];

async function abrir(tema, largura) {
  const ctx = await navegador.newContext({ viewport: { width: largura, height: 780 }, hasTouch: true });
  await semRedeExterna(ctx);
  await comTema(ctx, tema);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push(tema + '/' + largura + ' · pageerror: ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  // Sem tela o Modo Fácil é o modo BLOQUEADO; com a tela de mentira a leitura é a tela.
  await pg.evaluate(() => { webDisplayWin = { closed: false }; renderSimpleCast(); });
  return { ctx, pg };
}

// Põe uma mídia no ar. `comDuracao` escolhe o WAV de verdade ou um blob sem duração.
async function projetar(pg, nome, comDuracao) {
  const id = await pg.evaluate(async ({ nome, comDuracao }) => {
    // Um WAV de verdade (8 kHz, mono, silêncio): só ele tem DURAÇÃO, e é ela que acende a barra.
    const wav = (seg) => {
      const sr = 8000, n = sr * seg, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
      const w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true);
      v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
      v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
      return new Blob([b], { type: 'audio/wav' });
    };
    const blob = comDuracao ? wav(40) : new Blob(['x'], { type: 'audio/wav' });
    const m = await AVDB.addMedia(blob, { name: nome, type: 'audio/wav', kind: 'audio', list: 'imports' });
    return m.id;
  }, { nome, comDuracao });
  await pg.evaluate(async (id) => {
    await send(id);
    currentItem.lyrics = [{ cover: true }, { time: 0, text: 'primeira estrofe da letra' }, { time: 5, text: 'segunda estrofe da letra' }];
    renderSlideNav();
  }, id);
  const ok = await esperar(pg, (n) => document.getElementById('simpleNpName').textContent === n
    && getComputedStyle(document.querySelector('.simple-song')).visibility !== 'hidden', nome, 15000);
  return ok;
}

const medir = (pg) => pg.evaluate(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right, h: b.height }; };
  const card = document.querySelector('.simple-nowplaying');
  const song = document.querySelector('.simple-song');
  const lyr = document.getElementById('simpleLyrics');
  const nome = document.getElementById('simpleNpName');
  const tempo = document.getElementById('simpleTime');
  const trilho = document.querySelector('.simple-time-bar');
  // O tom que `--surface-sunk` resolve NESTE card: uma sonda filha dele, que herda a mesma cascata.
  const sonda = document.createElement('div');
  sonda.style.cssText = 'position:absolute;width:1px;height:1px;background:var(--surface-sunk);visibility:hidden';
  card.appendChild(sonda);
  const sunk = getComputedStyle(sonda).backgroundColor;
  sonda.remove();
  // O `--surface` FLUTUANTE é o de fora de qualquer cartão: a mesma sonda, filha da raiz da tela.
  const fora = document.createElement('div');
  fora.style.cssText = 'position:absolute;width:1px;height:1px;background:var(--surface);visibility:hidden';
  document.getElementById('simpleMode').appendChild(fora);
  const flutuante = getComputedStyle(fora).backgroundColor;
  fora.remove();
  const cs = getComputedStyle(card);
  return {
    existe: !!card,
    pai: card && card.parentElement === song,
    antesDaPlaca: card && lyr && (card.compareDocumentPosition(lyr) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    nomeDentro: card && card.contains(nome),
    tempoDentro: card && card.contains(tempo),
    bg: cs.backgroundColor, raio: cs.borderTopLeftRadius,
    bgPlaca: getComputedStyle(lyr).backgroundColor, raioPlaca: getComputedStyle(lyr).borderTopLeftRadius,
    bgApp: getComputedStyle(document.getElementById('simpleMode')).backgroundColor,
    gapApp: parseFloat(getComputedStyle(document.getElementById('simpleMode')).rowGap),
    gapSong: parseFloat(getComputedStyle(song).rowGap),
    card: r(card), nome: r(nome), tempoR: r(tempo), lyr: r(lyr), song: r(song),
    tempoOculto: tempo.hidden,
    trilho: getComputedStyle(trilho).backgroundColor, sunk, flutuante,
    cortado: nome.scrollWidth > nome.clientWidth,
    reticencias: getComputedStyle(nome).textOverflow,
    nomeDentroDoCard: r(nome).l >= r(card).l - 0.5 && r(nome).r <= r(card).r + 0.5,
  };
});

try {
  for (const tema of ['escuro', 'claro']) {
    const { ctx, pg } = await abrir(tema, 390);
    try {
      const ok = await projetar(pg, 'Louvor de Fundo', true);
      checar(ok === true, tema + ' · PREMISSA: a mídia com duração entra no ar e a leitura é a tela', porque(ok));
      const barra = await esperar(pg, () => !document.getElementById('simpleTime').hidden, null, 15000);
      checar(barra === true, tema + ' · PREMISSA: a barra de progresso aparece (a mídia tem duração)', porque(barra));
      const m = await medir(pg);

      checar(m.existe && m.pai && m.antesDaPlaca,
        'B1 · ' + tema + ' · existe `.simple-nowplaying`, filho de `.simple-song` e ACIMA da placa da letra', JSON.stringify(m));
      checar(m.nomeDentro && m.tempoDentro,
        'B1 · ' + tema + ' · o NOME e a BARRA moram dentro dele', JSON.stringify({ n: m.nomeDentro, t: m.tempoDentro }));
      const transparente = /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)|transparent/.test(m.bg);
      checar(!transparente && m.bg === m.bgPlaca && m.bg !== m.bgApp,
        'B2 · ' + tema + ' · o card PINTA a superfície das vizinhas (a da placa da letra) e ela difere do '
        + 'fundo do app — um cartão, e não texto solto', JSON.stringify({ card: m.bg, placa: m.bgPlaca, app: m.bgApp }));
      checar(m.raio === m.raioPlaca && parseFloat(m.raio) > 0,
        'B2 · ' + tema + ' · e tem o MESMO raio de cartão da placa da letra', m.raio + ' contra ' + m.raioPlaca);

      checar(m.nome.l - m.card.l >= 8 && m.card.r - m.nome.r >= 8 && m.nome.t - m.card.t >= 4 && m.card.b - m.tempoR.b >= 4,
        'B3 · ' + tema + ' · o conteúdo RESPIRA dentro do card: o nome e a barra não encostam nas bordas',
        JSON.stringify({ esq: m.nome.l - m.card.l, dir: m.card.r - m.nome.r, topo: m.nome.t - m.card.t, base: m.card.b - m.tempoR.b }));
      checar(!m.tempoOculto && m.tempoR.t >= m.nome.b - 0.5,
        'B3 · ' + tema + ' · a barra fica ABAIXO do nome, dentro do mesmo card', JSON.stringify({ nomeB: m.nome.b, tempoT: m.tempoR.t }));

      checar(Math.abs((m.lyr.t - m.card.b) - m.gapApp) <= 0.6 && Math.abs(m.gapSong - m.gapApp) <= 0.1,
        'B4 · ' + tema + ' · o vão entre o card e a placa é o das outras seções desta tela (um só)',
        JSON.stringify({ vao: m.lyr.t - m.card.b, secoes: m.gapApp, song: m.gapSong }));

      checar(m.trilho === m.sunk && m.sunk !== m.flutuante,
        'B5 · ' + tema + ' · dentro do card a superfície AFUNDA: o trilho da barra é o `--surface-sunk` e não '
        + 'o `--surface` flutuante de fora do cartão (que sobre ele pinta outro tom)', JSON.stringify({ trilho: m.trilho, sunk: m.sunk, flutuante: m.flutuante }));

      checar(Math.abs(m.lyr.b - m.song.b) <= 0.6 && m.card.t - m.song.t <= 0.6,
        'B6 · ' + tema + ' · o card abre a zona de leitura e a placa vai até o fundo dela (nada vazou, '
        + 'nada sobrou)', JSON.stringify({ placaB: m.lyr.b, zonaB: m.song.b, cardT: m.card.t, zonaT: m.song.t }));

      // B8 · tocar no trilho SALTA — o card não pode ter tirado a interatividade.
      const salto = await pg.evaluate(async () => {
        const hit = document.getElementById('simpleTimeHit');
        const rc = hit.getBoundingClientRect();
        const x = rc.left + rc.width * 0.5, y = rc.top + rc.height / 2;
        const topo = document.elementFromPoint(x, y);
        return { alcanca: !!topo && (topo === hit || hit.contains(topo)), x, y };
      });
      checar(salto.alcanca,
        'B8 · ' + tema + ' · o trilho continua ALCANÇÁVEL (hit-test no meio dele devolve a faixa de toque): '
        + 'nenhuma camada do card ficou por cima', JSON.stringify(salto));
    } finally { await ctx.close(); }
  }

  // B3b · SEM DURAÇÃO (imagem, texto, mídia ainda sem metadados) a barra sai e o card ENCOLHE para o nome.
  {
    const { ctx, pg } = await abrir('escuro', 390);
    try {
      const ok = await projetar(pg, 'Sem Duração', false);
      checar(ok === true, 'B3b · PREMISSA: a mídia sem duração entra no ar', porque(ok));
      const m = await medir(pg);
      checar(m.tempoOculto && m.card.h > 0,
        'B3b · sem duração o `#simpleTime` fica escondido e o card CONTINUA (só o nome)', JSON.stringify({ oculto: m.tempoOculto, h: m.card.h }));
      checar(m.nome.t - m.card.t >= 4 && m.card.b - m.nome.b >= 4 && m.card.h < 50,
        'B3b · e ele ENCOLHE para o nome, com folga dos dois lados (nada de vão onde a barra estava)',
        JSON.stringify({ topo: m.nome.t - m.card.t, base: m.card.b - m.nome.b, h: m.card.h }));
    } finally { await ctx.close(); }
  }

  // B7 · UM NOME LONGO NUM CELULAR ESTREITO é cortado com reticências, DENTRO do card.
  {
    const { ctx, pg } = await abrir('escuro', 320);
    try {
      const ok = await projetar(pg, 'Um nome de mídia muito comprido para provar o corte com reticências dentro do card', true);
      checar(ok === true, 'B7 · PREMISSA: o nome longo entra no ar', porque(ok));
      const m = await medir(pg);
      checar(m.cortado && m.reticencias === 'ellipsis' && m.nomeDentroDoCard,
        'B7 · um nome longo é cortado com reticências e fica DENTRO do card (320px)', JSON.stringify({ cortado: m.cortado, to: m.reticencias, dentro: m.nomeDentroDoCard }));
    } finally { await ctx.close(); }
  }

  // B9 · SEM MÍDIA, A BIBLIOTECA É A TELA PRINCIPAL e a leitura inteira (o card junto) fica por baixo.
  {
    const { ctx, pg } = await abrir('escuro', 390);
    try {
      await pg.waitForTimeout(600);
      const v = await pg.evaluate(() => ({
        card: getComputedStyle(document.querySelector('.simple-nowplaying')).visibility,
        song: getComputedStyle(document.querySelector('.simple-song')).visibility,
        principal: document.body.classList.contains('simples-principal'),
      }));
      checar(v.principal && v.song === 'hidden' && v.card === 'hidden',
        'B9 · sem mídia no ar a Biblioteca é a tela principal e o card some junto com a leitura '
        + '(`visibility` herdada de `.simple-song`)', JSON.stringify(v));
    } finally { await ctx.close(); }
  }

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
