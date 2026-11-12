#!/usr/bin/env node
// ============================================================================
// O TOUR GUIADO (v1.14.0) — `controle/tour.js` e os ganchos no `controle.js`.
//
// Um tour por ESTADO DA TELA, automático na primeira vez de cada um e nunca por
// cima de outra coisa: `conexao` (Modo Fácil com a cortina "sem tela"),
// `simples` (Modo Fácil destravado) e `avancado`. Este oráculo parte do APARELHO
// NOVO (`comTour: true` — o arnês marca os três como vistos em todo outro
// oráculo) e cobra:
//   A · Fácil com cortina: o automático é o da CONEXÃO, só com peças da cortina;
//       cada passo acha a peça e o recorte é o retângulo dela (± a folga);
//       recarregar não o reabre.
//   B · destravado: o automático passa a ser o dos CONTROLES; sem mídia, a letra
//       e as teclas viram balão central; o passo do volume mostra a pílula e a
//       esconde ao sair; o voltar do Android (`__avBack`) fecha o tour.
//   C · avançado, tema CLARO: o tour completo; o véu é o `--tour-veu` do tema.
//   D · colisão: um diálogo que abre no meio fecha o tour e o devolve à fila; ele
//       volta quando o diálogo fecha.
//   E · 360×640 com fonte 1,3×: o balão cabe na tela e nenhum botão corta o rótulo.
//   F · o botão de Configurações refaz o tour do modo ATUAL e ZERA as seções do
//       modo; o guia de sonoplastia abre `#dia` no Fácil e o começo no avançado.
//   L · desligar por inteiro (v1.14.5): "Tour do app" é uma CAIXA (nasce marcada;
//       tocar desmarca, grava `av.tour.off` e a folha segue aberta; desligado,
//       nem o principal nem o de seção abrem sozinhos; tocar de novo liga e refaz
//       o tour). "Pular tour" no balão desliga o MESMO interruptor, e a caixa
//       acompanha. O "Guia de sonoplastia" leva a seta de "abre outra tela".
//   G · tours de SEÇÃO (v1.14.1): Configurações no Fácil, Ferramentas e o Timer
//       no avançado — sozinhos na primeira abertura, nunca de novo, com o halo.
//   H · o Fácil TOCANDO: a letra e as teclas, na primeira vez que algo toca.
//   I · a varredura: toda seção do avançado acha as próprias peças.
//   J · a ORDEM VISUAL (v1.14.3): em todo tour, nos dois modos, a 390×860 e a
//       360×640, os passos com peça vão de cima para baixo e, na mesma faixa, da
//       esquerda para a direita (os fixos — `abertura`/`fecho` — ficam de fora).
//   K · o MOVIMENTO (v1.14.4): entre passos o recorte e o balão têm transição e,
//       no meio dela, o recorte está ENTRE a peça A e a B (sem salto); no fim ele
//       bate com a peça; três "Próximo" rápidos terminam três passos adiante; com
//       `prefers-reduced-motion` a duração é 0 e o passo novo já está no lugar.
//   e nenhum `pageerror` em parte nenhuma.
//   node tools/tour.test.mjs
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperarCortina, esperar, porque, comTema, comModoAvancado,
  checar, falhas,
} from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port + '/controle/index.html';
const navegador = await abrirNavegador({ comTour: true });
const erros = [];

// A âncora existe na página do site (a URL do atalho não é inventada).
const site = fs.readFileSync(path.join(AQUI, '..', 'site', 'sonoplastia', 'index.html'), 'utf8');
checar(/id="dia"/.test(site) && /Sonoplasta por um dia/.test(site) && fs.readFileSync(path.join(AQUI, '..', 'site', 'CNAME'), 'utf8').trim() === 'audiovisualiasd.com.br',
  'premissa: a página do guia tem a trilha "por um dia" em `#dia`, no domínio do site');

async function abrir(viewport, { avancado = false, tema = 'escuro', fonte = 1 } = {}) {
  const ctx = await navegador.newContext({ viewport, hasTouch: true });
  await semRedeExterna(ctx);
  await comTema(ctx, tema);
  if (avancado) await comModoAvancado(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' ')));
  await pg.goto(base, { waitUntil: 'load' });
  // A escala de fonte como a `varredura-geometrica` a aplica (o `textZoom` do aparelho).
  if (fonte !== 1) await pg.evaluate((f) => { document.documentElement.style.fontSize = (16 * f) + 'px'; }, fonte);
  await esperarCortina(pg);
  return { ctx, pg };
}

const estado = (pg) => pg.evaluate(() => (window.AVTour ? AVTour.estado() : null));
const esperarTour = (pg, qual, prazo = 8000) => esperar(pg, (q) => {
  const e = window.AVTour && AVTour.estado();
  return !!e && e.qual === q && !document.getElementById('tour').hidden;
}, qual, prazo);

// O passo de agora, medido: a peça (união dos alvos visíveis), o recorte, o balão.
const medir = (pg) => pg.evaluate(() => {
  const e = AVTour.estado();
  const vis = (n) => {
    if (!n || n.closest('[hidden]')) return false;
    const r = n.getBoundingClientRect(); const cs = getComputedStyle(n);
    return r.width >= 1 && r.height >= 1 && cs.visibility !== 'hidden' && cs.display !== 'none'
      && r.bottom > 0 && r.top < innerHeight;
  };
  const todosDe = (p) => (!p.alvo ? [] : Array.isArray(p.alvo) ? p.alvo : [p.alvo]).flatMap((q) => [...document.querySelectorAll(q)]).filter(vis);
  const passo = AVTour.passoAtual();   // o passo NA ORDEM em que o tour o mostra
  const els = todosDe(passo);
  let peca = null;
  for (const n of els) {
    const q = n.getBoundingClientRect();
    peca = peca ? { l: Math.min(peca.l, q.left), t: Math.min(peca.t, q.top), r: Math.max(peca.r, q.right), b: Math.max(peca.b, q.bottom) }
      : { l: q.left, t: q.top, r: q.right, b: q.bottom };
  }
  const raiz = document.getElementById('tour');
  const rec = raiz.querySelector('.tour-recorte');
  const bal = raiz.querySelector('.tour-balao');
  const rr = rec.hidden ? null : rec.getBoundingClientRect();
  const br = bal.getBoundingClientRect();
  const botoes = [...bal.querySelectorAll('button')].map((b) => ({ t: b.textContent, corta: b.scrollWidth > b.clientWidth + 1 }));
  return {
    qual: e.qual, i: e.passo, total: e.total, alvo: passo.alvo, titulo: passo.titulo,
    fixo: passo.abertura ? 'abertura' : passo.fecho ? 'fecho' : null,
    cont: raiz.querySelector('.tour-cont').textContent, texto: raiz.querySelector('#tourTexto').textContent,
    centro: raiz.classList.contains('tour--centro'),
    peca, recorte: rr && { l: rr.left, t: rr.top, r: rr.right, b: rr.bottom },
    balao: { l: br.left, t: br.top, r: br.right, b: br.bottom },
    vw: innerWidth, vh: innerHeight, botoes,
    papel: bal.getAttribute('role'), focoDentro: bal.contains(document.activeElement),
    veu: getComputedStyle(rec).boxShadow, veuFundo: getComputedStyle(raiz).backgroundColor,
    token: getComputedStyle(document.documentElement).getPropertyValue('--tour-veu').trim(),
    halo: getComputedStyle(document.documentElement).getPropertyValue('--tour-halo').trim(),
  };
});

// A cor do véu: a sombra computada do recorte (`rgba(0, 0, 0, 0.68)`) contra o token
// (`rgba(0, 0, 0, .68)`), comparadas como NÚMEROS.
const nums = (t) => ((String(t).match(/rgba?\(([^)]*)\)/) || [])[1] || '').split(',').map((x) => +x);
const cores = (sombra) => (String(sombra).match(/rgba?\([^)]*\)/g) || []).map(nums);
const temCor = (sombra, token) => { const b = nums(token); return b.length === 4 && cores(sombra).some((a) => a.length === 4 && a.every((v, k) => Math.abs(v - b[k]) < 0.005)); };
const veuBate = (m) => temCor(m.veu, m.token);
// O HALO (v1.14.1): o `--tour-halo` está na sombra do recorte, ANTES do véu (por cima dele).
const haloBate = (m) => temCor(m.veu, m.halo) && cores(m.veu).findIndex((a) => a.every((v, k) => Math.abs(v - nums(m.halo)[k]) < 0.005))
  < cores(m.veu).findIndex((a) => a.every((v, k) => Math.abs(v - nums(m.token)[k]) < 0.005));

// O recorte É a peça: contém o retângulo dela e não passa da folga (6px) + 1.
function recorteBate(m) {
  if (!m.peca || !m.recorte) return false;
  const P = 7;
  const lim = (v, max) => Math.max(0, Math.min(max, v));
  const p = { l: lim(m.peca.l, m.vw), t: lim(m.peca.t, m.vh), r: lim(m.peca.r, m.vw), b: lim(m.peca.b, m.vh) };
  return m.recorte.l <= p.l + 0.5 && m.recorte.t <= p.t + 0.5 && m.recorte.r >= p.r - 0.5 && m.recorte.b >= p.b - 0.5
    && p.l - m.recorte.l <= P && p.t - m.recorte.t <= P && m.recorte.r - p.r <= P && m.recorte.b - p.b <= P;
}
// Há lugar para o balão inteiro acima ou abaixo do recorte (margem 12 + vão 10)?
const cabeAoLado = (m) => { const h = m.balao.b - m.balao.t; return m.recorte.t - 22 >= h || m.vh - m.recorte.b - 22 >= h; };
const dentro = (m) => m.balao.l >= -0.5 && m.balao.t >= -0.5 && m.balao.r <= m.vw + 0.5 && m.balao.b <= m.vh + 0.5;

// Fecha o tour se estiver aberto (numa reprovação ele pode nem ter aberto). NÃO é o
// "Pular tour" do balão — esse DESLIGA o tour por inteiro (v1.14.5) e tem o caso L.
const pular = async (pg) => { if (await pg.evaluate(() => AVTour.aberto())) await pg.evaluate(() => AVTour.fechar()); };

// A ORDEM VISUAL: a faixa é a do `tour.js` — os centros verticais, em ordem, ficam
// na mesma faixa enquanto cada um dista do anterior até max(24 px, metade da altura
// do menor). Na sequência mostrada, a faixa não volta para cima e, dentro dela, a
// borda esquerda não volta para a esquerda. Devolve os pares fora de ordem.
function foraDeOrdem(passos) {
  const ms = passos.filter((m) => m.peca && !m.fixo).map((m) => ({
    cy: (m.peca.t + m.peca.b) / 2, h: m.peca.b - m.peca.t, l: m.peca.l, alvo: [].concat(m.alvo).join('+') }));
  let faixa = 0, ant = null;
  for (const m of [...ms].sort((a, b) => a.cy - b.cy)) {
    if (ant && m.cy - ant.cy > Math.max(24, Math.min(ant.h, m.h) / 2)) faixa++;
    m.faixa = faixa; ant = m;
  }
  const ruins = [];
  for (let k = 1; k < ms.length; k++) {
    const a = ms[k - 1], b = ms[k];
    if (b.faixa < a.faixa || (b.faixa === a.faixa && b.l < a.l - 1)) {
      ruins.push(a.alvo + '(' + Math.round(a.cy) + ',' + Math.round(a.l) + ') → ' + b.alvo + '(' + Math.round(b.cy) + ',' + Math.round(b.l) + ')');
    }
  }
  return ruins;
}

// O MOVIMENTO (v1.14.4): o recorte e o balão deslizam — mede-se depois que tudo
// ASSENTOU (`AVTour.quieto()`: sem troca de passo nem transição correndo).
const assentou = (pg) => esperar(pg, () => !window.AVTour || AVTour.quieto(), null, 5000);

// Percorre o tour inteiro pelo "Próximo", medindo cada passo.
async function percorrer(pg) {
  const passos = [];
  for (let k = 0; k < 20; k++) {
    await pg.waitForTimeout(320);   // o vigia (250 ms) reposiciona: a pílula de volume entra com transição
    await assentou(pg);
    if (!(await estado(pg))) { passos.push({ alvo: '(o tour fechou no meio)', i: -1, total: 0 }); break; }
    const m = await medir(pg);
    passos.push(m);
    if (m.i === m.total - 1) break;
    await pg.click('#tour .tour-proximo');
  }
  return passos;
}

try {
  // ---------------- A · Fácil com a cortina: o tour da CONEXÃO ----------------
  {
    const { ctx, pg } = await abrir({ width: 390, height: 860 });
    const premissa = await pg.evaluate(() => ({ modo: appMode, cortina: simpleModeEl.classList.contains('sem-tela'), visto: localStorage.getItem('av.tour') }));
    checar(premissa.modo === 'simple' && premissa.cortina && !premissa.visto,
      'A · premissa: aparelho novo, Modo Fácil com a cortina "sem tela"', JSON.stringify(premissa));
    const r = await esperarTour(pg, 'conexao');
    checar(r === true, 'A · o tour da CONEXÃO abre SOZINHO na primeira vez', porque(r));
    const passos = await percorrer(pg);
    const fora = passos.filter((m) => !(Array.isArray(m.alvo) ? m.alvo : [m.alvo])
      .every((s) => ['#simpleConn', '#castMirrorBtn', '#castNetBtn', '#castLocalBtn'].includes(s)));
    checar(passos.length >= 2 && fora.length === 0,
      'A · ele fala SÓ das opções de conexão (o que está na cortina)', passos.map((m) => m.alvo).join(' '));
    const ruins = passos.filter((m) => !recorteBate(m) || m.centro);
    checar(ruins.length === 0, 'A · cada passo acha a peça e o recorte é o retângulo dela',
      JSON.stringify(ruins.map((m) => [m.alvo, m.peca, m.recorte])));
    checar(passos.every((m) => m.cont === (m.i + 1) + ' de ' + m.total && m.papel === 'dialog' && m.focoDentro && dentro(m)),
      'A · "N de M", `role=dialog`, o foco no balão e o balão dentro da tela',
      JSON.stringify(passos.map((m) => [m.cont, m.papel, m.focoDentro, dentro(m)])));
    checar(passos.every(veuBate) && Math.abs(nums(passos[0].token)[3] - 0.68) < 0.005,
      'A · o véu (escuro) é o `--tour-veu` do tema', passos[0].veu + ' × ' + passos[0].token);
    checar(passos.every(haloBate) && nums(passos[0].halo)[2] === 244,
      'A · em volta do recorte há o HALO azul (`--tour-halo`, derivado do `--accent`), por cima do véu', passos[0].veu + ' × ' + passos[0].halo);
    await pg.click('#tour .tour-proximo');   // Concluir
    const fechou = await pg.evaluate(() => ({ aberto: AVTour.aberto(), oculto: document.getElementById('tour').hidden, v: JSON.parse(localStorage.getItem('av.tour') || '{}') }));
    checar(!fechou.aberto && fechou.oculto && fechou.v.conexao === 1 && !fechou.v.simples,
      'A · "Concluir" fecha e marca SÓ o tour da conexão como visto', JSON.stringify(fechou));
    await pg.reload({ waitUntil: 'load' });
    await esperarCortina(pg);
    await pg.waitForTimeout(2500);   // AUSÊNCIA: o automático leva 1,2 s de tela livre
    checar(await estado(pg) === null, 'A · recarregar NÃO reabre o tour já visto', JSON.stringify(await estado(pg)));

    // ---------------- B · destravado: o tour dos CONTROLES ----------------
    await pg.evaluate(() => { setTocarNoCelular(true); renderSimpleGate(); });
    const rb = await esperarTour(pg, 'simples');
    checar(rb === true, 'B · destravar (sair da cortina) abre SOZINHO o tour dos controles', porque(rb));
    const pb = await percorrer(pg);
    const alvos = pb.map((m) => [].concat(m.alvo).join('+'));
    checar(['#simpleBarra+#libBar', '#volPill', '#simpleSettingsBtn'].every((a) => alvos.includes(a))
      && !alvos.some((a) => /simple-song|simple-keys|simpleStop|simplePlay/.test(a)) && /Quando tocar/.test((pb.find((m) => [].concat(m.alvo).includes('#simpleBarra')) || {}).texto),
      'B · Biblioteca, volume e Configurações estão no tour; a letra e as teclas NÃO (ficam para quando tocar, e o balão diz isso)', alvos.join(' '));
    const ruinsB = pb.filter((m) => m.alvo && !recorteBate(m));
    checar(ruinsB.length === 0, 'B · os outros passos recortam a peça certa (o volume inclusive)',
      JSON.stringify(ruinsB.map((m) => [m.alvo, m.peca, m.recorte])));
    // O volume: aparece no passo dele e some ao sair.
    await pg.click('#tour .tour-voltar');
    await pg.waitForTimeout(320); await assentou(pg);
    let m = await medir(pg);
    while (m.alvo !== '#volPill' && m.i > 0) { await pg.click('#tour .tour-voltar'); await pg.waitForTimeout(320); await assentou(pg); m = await medir(pg); }
    const noVol = await pg.evaluate(() => document.getElementById('volPill').classList.contains('visivel'));
    await pg.click('#tour .tour-voltar');
    const depoisVol = await pg.evaluate(() => document.getElementById('volPill').classList.contains('visivel'));
    checar(m.alvo === '#volPill' && noVol && !depoisVol, 'B · o passo do volume MOSTRA a pílula e o tour a esconde ao sair do passo',
      JSON.stringify({ alvo: m.alvo, noVol, depoisVol }));
    // O voltar do Android é o degrau 0.
    const volta = await pg.evaluate(() => ({ r: window.__avBack(), aberto: AVTour.aberto(), oculto: document.getElementById('tour').hidden }));
    checar(volta.r === true && !volta.aberto && volta.oculto, 'B · o voltar do Android fecha o tour (e só ele)', JSON.stringify(volta));

    // ---------------- G · o tour de SEÇÃO no Fácil: Configurações ----------------
    await pg.evaluate(() => { window.__abertos = []; window.open = (u) => { window.__abertos.push(u); return null; }; });
    await pg.click('#simpleSettingsBtn');
    const rg = await esperarTour(pg, 's.configuracoes');
    checar(rg === true, 'G · abrir Configurações pela primeira vez abre SOZINHO o tour de dentro dela', porque(rg));
    const pg1 = rg === true ? await percorrer(pg) : [];
    const ruinsG = pg1.filter((m) => !recorteBate(m) || !haloBate(m));
    checar(pg1.length >= 3 && ruinsG.length === 0 && pg1.some((m) => /liga ou desliga/.test(m.texto)),
      'G · cada passo recorta uma peça de Configurações, com o halo', JSON.stringify(ruinsG.map((m) => [m.alvo, m.peca, m.recorte])));
    await pg.click('#tour .tour-proximo');   // Concluir
    await pg.evaluate(() => closeFadePopup());
    await esperar(pg, () => !document.getElementById('fadePopup').classList.contains('open') && !AVTour.aberto());
    await pg.click('#simpleSettingsBtn');
    await esperar(pg, () => document.getElementById('fadePopup').classList.contains('open'));
    await pg.waitForTimeout(1500);   // AUSÊNCIA: o de seção leva 0,7 s
    checar(await estado(pg) === null, 'G · abrir Configurações de novo NÃO repete o tour da seção', JSON.stringify(await estado(pg)));

    // ---------------- F · Configurações, no Fácil ----------------
    const lado = await pg.evaluate(() => {
      const t = document.getElementById('tourBtn'), s = document.getElementById('guiaSomBtn');
      const a = t.getBoundingClientRect(), b = s.getBoundingClientRect();
      return { vis: a.width > 0 && b.width > 0, mesmaLinha: Math.abs(a.top - b.top) < 2, corta: [t, s].some((x) => x.scrollWidth > x.clientWidth + 1),
        diz: /cada janela/.test(t.title),
        caixa: t.getAttribute('role') === 'checkbox' && !!t.querySelector('.song-menu-check') && t.querySelector('.song-menu-check').getBoundingClientRect().width > 0,
        seta: !!s.querySelector('svg.cfg-externo use[href="#icoExterno"]') && s.querySelector('svg.cfg-externo').getBoundingClientRect().width > 0 };
    });
    checar(lado.vis && lado.mesmaLinha && !lado.corta && lado.diz, 'F · "Tour do app" e "Guia de sonoplastia" estão em Configurações, lado a lado, sem cortar (e o botão diz que as janelas voltam a se explicar)', JSON.stringify(lado));
    checar(lado.caixa && lado.seta, 'L · "Tour do app" tem a CAIXA de marcação e "Guia de sonoplastia" a SETA de "abre outra tela", à vista', JSON.stringify(lado));
    await pg.click('#guiaSomBtn');
    const urlFacil = await pg.evaluate(() => window.__abertos.slice(-1)[0]);
    checar(urlFacil === 'https://audiovisualiasd.com.br/sonoplastia/#dia',
      'F · no Modo Fácil o guia abre direto em "Sonoplasta por um dia"', urlFacil);

    // ---------------- L · a caixa "Tour do app" liga e desliga o tour por inteiro ----------------
    const caixa = () => pg.evaluate(() => {
      const b = document.getElementById('tourBtn');
      return { role: b.getAttribute('role'), marcada: b.getAttribute('aria-checked'), on: !!b.querySelector('.song-menu-check.on'), title: b.title,
        off: localStorage.getItem('av.tour.off'), ativo: AVTour.ativo(), folha: document.getElementById('fadePopup').classList.contains('open') };
    });
    const c0 = await caixa();
    checar(c0.role === 'checkbox' && c0.marcada === 'true' && c0.on && c0.off === null && c0.ativo,
      'L · o tour nasce LIGADO: a caixa "Tour do app" está marcada', JSON.stringify(c0));
    await pg.click('#tourBtn');
    const c1 = await caixa();
    checar(c1.marcada === 'false' && !c1.on && c1.off === '1' && !c1.ativo && c1.folha && /desligado/.test(c1.title),
      'L · tocar na caixa DESLIGA: desmarca, grava a escolha e a folha continua aberta', JSON.stringify(c1));
    await pg.evaluate(() => {
      const v = JSON.parse(localStorage.getItem('av.tour')); delete v.simples; delete v['s.configuracoes'];
      localStorage.setItem('av.tour', JSON.stringify(v)); AVTour.armar();
    });
    await pg.waitForTimeout(1600);   // AUSÊNCIA: o de seção leva 0,7 s
    checar(await estado(pg) === null, 'L · desligado, nem a seção aberta e não vista se explica sozinha', JSON.stringify(await estado(pg)));
    await pg.evaluate(() => closeFadePopup());
    await esperar(pg, () => !document.getElementById('fadePopup').classList.contains('open'));
    await pg.waitForTimeout(2200);   // AUSÊNCIA: o principal leva 1,2 s de tela livre
    checar(await estado(pg) === null, 'L · desligado, o tour principal não abre sozinho com a tela livre', JSON.stringify(await estado(pg)));
    await pg.click('#simpleSettingsBtn');
    await esperar(pg, () => document.getElementById('fadePopup').classList.contains('open'));
    await pg.waitForTimeout(1000);
    const c2 = await caixa();
    checar(c2.marcada === 'false' && !c2.on && await estado(pg) === null, 'L · reaberta a folha, a caixa segue desmarcada e nada se explica', JSON.stringify(c2));
    await pg.click('#tourBtn');   // liga de novo: fecha a folha e refaz o tour do estado
    const rf = await esperarTour(pg, 'simples', 5000);
    const c3 = await caixa();
    checar(rf === true && c3.ativo && c3.off === null && !c3.folha,
      'L · tocar de novo LIGA: a folha fecha e o tour da tela abre na hora', porque(rf) || JSON.stringify(c3));
    const zerou = await pg.evaluate(() => JSON.parse(localStorage.getItem('av.tour')));
    checar(rf === true && await pg.evaluate(() => !document.getElementById('fadePopup').classList.contains('open')),
      'F · no Fácil destravado o botão fecha Configurações e refaz o tour dos CONTROLES', porque(rf));
    checar(!zerou['s.configuracoes'] && !zerou.conexao,
      'F · e ZERA o Modo Fácil: as seções dele voltam a se explicar ao abrir', JSON.stringify(zerou));
    // "Pular tour": o MESMO interruptor, por dentro do balão.
    const rotuloPular = await pg.evaluate(() => document.querySelector('#tour .tour-pular').textContent);
    await pg.click('#tour .tour-pular');
    await esperar(pg, () => !AVTour.aberto());
    const sp = await pg.evaluate(() => ({ off: localStorage.getItem('av.tour.off'), ativo: AVTour.ativo(), marcada: document.getElementById('tourBtn').getAttribute('aria-checked'),
      on: !!document.querySelector('#tourBtn .song-menu-check.on'), oculto: document.getElementById('tour').hidden }));
    checar(rotuloPular === 'Pular tour' && sp.off === '1' && !sp.ativo && sp.oculto && sp.marcada === 'false' && !sp.on,
      'L · "Pular tour" fecha o balão e DESLIGA o tour por inteiro; a caixa de Configurações acompanha', JSON.stringify([rotuloPular, sp]));
    await pg.evaluate(() => {
      const v = JSON.parse(localStorage.getItem('av.tour')); delete v.simples; localStorage.setItem('av.tour', JSON.stringify(v)); AVTour.armar();
    });
    await pg.waitForTimeout(2200);   // AUSÊNCIA
    checar(await estado(pg) === null, 'L · depois do "Pular tour", nada abre sozinho', JSON.stringify(await estado(pg)));
    await pg.evaluate(() => { setTocarNoCelular(false); renderSimpleGate(); });
    await esperar(pg, () => simpleModeEl.classList.contains('sem-tela'));
    await pg.evaluate(() => { openFadePopup(); document.getElementById('tourBtn').click(); });
    const rc = await esperarTour(pg, 'conexao', 5000);
    checar(rc === true, 'F · com a cortina de volta, o mesmo botão refaz o tour da CONEXÃO', porque(rc));
    await pular(pg);

    // ---------------- H · o Fácil TOCANDO: a letra e as teclas ----------------
    await pg.evaluate(() => { const v = JSON.parse(localStorage.getItem('av.tour')); v.simples = 1; localStorage.setItem('av.tour', JSON.stringify(v)); });
    await pg.evaluate(() => { setTocarNoCelular(true); renderSimpleGate(); });
    const id = await pg.evaluate(async () => (await AVDB.addMedia(new Blob(['x'], { type: 'audio/wav' }),
      { name: 'Louvor de Fundo', type: 'audio/wav', kind: 'audio', list: 'imports' })).id);
    await pg.evaluate(async (i) => {
      await send(i);
      currentItem.lyrics = [{ cover: true }, { time: 0, text: 'primeira' }, { time: 5, text: 'segunda' }];
      renderSlideNav(); renderSimpleGate();
    }, id);
    const rh = await esperarTour(pg, 'tocando');
    checar(rh === true, 'H · a primeira vez que algo toca no Fácil abre SOZINHO o tour da tela tocando', porque(rh)
      || await pg.evaluate(() => simpleModeEl.className + ' ' + qualTour()));
    const ph = rh === true ? await percorrer(pg) : [];
    const alvosH = ph.map((m) => [].concat(m.alvo).join('+'));
    const ruinsH = ph.filter((m) => !recorteBate(m));
    checar(['.simple-song', '#simpleStop', '#simplePlay'].every((a) => alvosH.includes(a)) && ruinsH.length === 0,
      'H · ele recorta a letra, Parar e Play/Pausa (e o que mais estiver à vista)', alvosH.join(' ') + ' ' + JSON.stringify(ruinsH.map((m) => [m.alvo, m.peca, m.recorte])));
    await pular(pg);
    await ctx.close();
  }

  // ---------------- C · avançado, tema claro: o tour COMPLETO ----------------
  {
    const { ctx, pg } = await abrir({ width: 390, height: 860 }, { avancado: true, tema: 'claro' });
    const r = await esperarTour(pg, 'avancado');
    checar(r === true, 'C · no avançado o tour completo abre SOZINHO na primeira vez', porque(r));
    const pc = await percorrer(pg);
    const alvos = pc.map((m) => [].concat(m.alvo).join('+'));
    const quer = ['#library', '#cronoTitulo', '#cronoImportar', '#bibleBtn', '#toolsBtn', '#libBar', '#preview', '#seek+.transport', '#pvCastBtn', '#settingsBtn'];
    checar(quer.every((a) => alvos.includes(a)), 'C · Cronograma, troca, Importar, Bíblia, Ferramentas, Biblioteca, prévia, transporte, conectar e Configurações', alvos.join(' '));
    const ruins = pc.filter((m) => (m.peca ? !recorteBate(m) : !m.centro));
    checar(ruins.length === 0, 'C · cada passo recorta a peça (ou, sem ela à vista, centraliza)',
      JSON.stringify(ruins.map((m) => [m.alvo, m.peca, m.recorte, m.centro])));
    const tema = await pg.evaluate(() => document.documentElement.dataset.tema);
    const comRecorte = pc.find((m) => m.recorte);
    checar(tema === 'claro' && comRecorte && veuBate(comRecorte) && Math.abs(nums(comRecorte.token)[3] - 0.55) < 0.005,
      'C · no tema claro o véu é o `--tour-veu` do claro', tema + ' ' + (comRecorte && comRecorte.veu) + ' × ' + (comRecorte && comRecorte.token));
    await pg.click('#tour .tour-proximo');

    // ---------------- D · colisão com um diálogo ----------------
    // Tudo visto MENOS o tour do avançado (e as Ferramentas, para o G2 logo abaixo).
    await pg.evaluate(() => {
      const v = {}; for (const k of AVTour.chaves()) if (k !== 'avancado' && !/^s\.ferr/.test(k)) v[k] = 1;
      localStorage.setItem('av.tour', JSON.stringify(v));
    });
    await pg.reload({ waitUntil: 'load' });
    await esperarCortina(pg);
    const rd = await esperarTour(pg, 'avancado');
    await pg.evaluate(() => { openAppDialog({ title: 'Teste', message: 'Um diálogo por cima' }); });
    const fechou = await esperar(pg, () => !AVTour.aberto(), null, 3000);
    const devolvido = await pg.evaluate(() => !JSON.parse(localStorage.getItem('av.tour')).avancado);
    checar(rd === true && fechou === true && devolvido, 'D · um diálogo que abre no meio FECHA o tour e o devolve à fila', JSON.stringify({ rd, fechou, devolvido }));
    await pg.waitForTimeout(1800);   // AUSÊNCIA: com o diálogo aberto ele não volta
    checar(await estado(pg) === null, 'D · com o diálogo aberto o tour NÃO reabre por cima dele');
    await pg.evaluate(() => closeAppDialog(false));
    const volta = await esperarTour(pg, 'avancado');
    checar(volta === true, 'D · fechado o diálogo, o tour volta sozinho', porque(volta));
    await pular(pg);

    // ---------------- G2 · os tours de SEÇÃO no avançado: Ferramentas e uma delas ----------------
    await pg.click('#toolsBtn');
    const rf2 = await esperarTour(pg, 's.ferramentas');
    checar(rf2 === true, 'G2 · abrir Ferramentas pela primeira vez abre SOZINHO o tour delas', porque(rf2));
    const pf = rf2 === true ? await percorrer(pg) : [];
    const ruinsF = pf.filter((m) => !recorteBate(m) || !haloBate(m));
    checar(pf.length >= 4 && ruinsF.length === 0, 'G2 · cada ferramenta é recortada na grade, com o halo',
      JSON.stringify(ruinsF.map((m) => [m.alvo, m.peca, m.recorte])));
    await pular(pg);
    await pg.click('#ferrTile_timer');
    const rt = await esperarTour(pg, 's.ferr-timer');
    checar(rt === true, 'G2 · e abrir o Timer abre o tour DELE', porque(rt));
    const pt = rt === true ? await percorrer(pg) : [];
    checar(pt.length >= 2 && pt.every(recorteBate), 'G2 · o tour do Timer recorta as peças dele', JSON.stringify(pt.map((m) => [m.alvo, !!m.recorte])));
    const backT = await pg.evaluate(() => ({ r: window.__avBack(), aberto: AVTour.aberto(), ferr: ferramentasAbertas() }));
    checar(backT.r === true && !backT.aberto && backT.ferr, 'G2 · o voltar fecha SÓ o tour (as Ferramentas continuam abertas)', JSON.stringify(backT));
    await pg.evaluate(() => fecharFerramentas());
    await esperar(pg, () => !ferramentasAbertas());
    await pg.click('#toolsBtn');
    await pg.waitForTimeout(1500);   // AUSÊNCIA
    checar(await estado(pg) === null, 'G2 · abrir Ferramentas de novo NÃO repete o tour', JSON.stringify(await estado(pg)));
    await pg.evaluate(() => fecharFerramentas());
    await esperar(pg, () => !ferramentasAbertas());

    // ---------------- F · Configurações, no avançado ----------------
    await pg.evaluate(() => { window.__abertos = []; window.open = (u) => { window.__abertos.push(u); return null; }; });
    await pg.click('#settingsBtn');
    await esperar(pg, () => document.getElementById('fadePopup').classList.contains('open'));
    await pg.click('#guiaSomBtn');
    const urlAv = await pg.evaluate(() => window.__abertos.slice(-1)[0]);
    checar(urlAv === 'https://audiovisualiasd.com.br/sonoplastia/', 'F · no avançado o guia abre no começo da página', urlAv);
    await pg.click('#tourBtn');   // desliga (o tour estava ligado)…
    await pg.click('#tourBtn');   // …e liga de novo: refaz o tour do modo
    const ra = await esperarTour(pg, 'avancado', 5000);
    checar(ra === true, 'F · no avançado o botão refaz o tour COMPLETO', porque(ra));
    const zerouAv = await pg.evaluate(() => JSON.parse(localStorage.getItem('av.tour')));
    checar(!zerouAv['s.ferramentas'] && !zerouAv['s.ferr-timer'] && !zerouAv['s.configuracoes'] && zerouAv.conexao === 1 && zerouAv.avancado === 1,
      'F · e ZERA só o avançado: as seções dele voltam a se explicar; as do Fácil ficam como estavam', JSON.stringify(zerouAv));
    await pular(pg);

    // ---------------- I · a VARREDURA: toda seção do avançado acha as próprias peças ----------------
    // Os seletores das `SECOES` são texto: um id renomeado faria a seção abrir um
    // tour de balões centrais (ou nenhum). Cada uma é aberta como o operador a
    // abriria, e cada passo tem de recortar a peça.
    const VARRER = [
      ['biblia', 'abrirBiblia()', 'fecharBiblia()'],
      ['biblioteca', 'openHymnSearch()', 'closeHymnSearch()'],
      ['cronogramas', 'abrirCronoGaveta()', 'fecharCronoGaveta()'],
      ['conectar', 'abrirCast()', 'fecharCast()'],
      ['playlist', 'openPlPopup()', 'closePlPopup()'],
      ['sorteio', 'abrirSorteio()', 'fecharSorteio()'],
      ['cfg-tela', 'openFadePopup(); abrirSecao("tela")', 'closeFadePopup()'],
      ['cfg-hist', 'openFadePopup(); abrirSecao("hist")', 'closeFadePopup()'],
      ['cfg-teste', 'openFadePopup(); abrirSecao("teste")', 'closeFadePopup()'],
      ['ferr-clock', 'abrirFerramenta("clock")', 'fecharFerramentas()'],
      ['ferr-stopwatch', 'abrirFerramenta("stopwatch")', 'fecharFerramentas()'],
      ['ferr-itinerario', 'abrirFerramenta("itinerario")', 'fecharFerramentas()'],
      ['ferr-msg', 'abrirFerramenta("msg")', 'fecharFerramentas()'],
      ['ferr-draw', 'abrirFerramenta("draw")', 'fecharFerramentas()'],
    ];
    const tudo = await pg.evaluate(() => { const v = {}; for (const k of AVTour.chaves()) v[k] = 1; return v; });
    const ruinsI = [];
    for (const [sec, abre, fecha] of VARRER) {
      await pg.evaluate((v) => { localStorage.setItem('av.tour', JSON.stringify(v)); AVTour.armar(); }, Object.assign({}, tudo, { ['s.' + sec]: 0 }));
      await pg.evaluate(abre);
      const r = await esperarTour(pg, 's.' + sec, 5000);
      if (r !== true) { ruinsI.push(sec + ': não abriu (' + await pg.evaluate(() => secaoDoTour()) + ')'); }
      else {
        for (const m of await percorrer(pg)) if (!recorteBate(m)) ruinsI.push(sec + ' ' + [].concat(m.alvo).join('+'));
        await pg.evaluate(() => AVTour.aberto() && AVTour.fechar());
      }
      await pg.evaluate(fecha);
      await esperar(pg, () => !secaoDoTour(), null, 3000);
    }
    checar(ruinsI.length === 0, 'I · toda seção do avançado abre o próprio tour, e cada passo recorta uma peça real', ruinsI.join(' | '));
    await ctx.close();
  }

  // ---------------- J · a ORDEM VISUAL, em todo tour, nos dois modos e duas telas ----------------
  // Cada tour é aberto à mão (`AVTour.abrir`) com a janela dele já assentada, e a
  // sequência mostrada é medida passo a passo.
  const AMBOS_J = [
    ['s.configuracoes', 'openFadePopup()', 'closeFadePopup()'],
    ['s.cfg-tela', 'openFadePopup(); abrirSecao("tela")', 'closeFadePopup()'],
    ['s.cfg-hist', 'openFadePopup(); abrirSecao("hist")', 'closeFadePopup()'],
    ['s.cfg-teste', 'openFadePopup(); abrirSecao("teste")', 'closeFadePopup()'],
    ['s.cfg-edicao', 'openFadePopup(); abrirSecao("edicao")', 'closeFadePopup()'],
    ['s.cfg-pacote', 'openFadePopup(); abrirSecao("pacote")', 'closeFadePopup()'],
    ['s.conectar', 'abrirCast()', 'fecharCast()'],
  ];
  const SO_FACIL = [
    ['conexao', '', ''],
    ['simples', 'setTocarNoCelular(true); renderSimpleGate()', ''],
    ['tocando', 'TOCAR', ''],
  ];
  const SO_AVANCADO = [
    ['avancado', '', ''],
    ['s.biblia', 'abrirBiblia()', 'fecharBiblia()'],
    ['s.biblioteca', 'openHymnSearch()', 'closeHymnSearch()'],
    ['s.cronogramas', 'abrirCronoGaveta()', 'fecharCronoGaveta()'],
    ['s.playlist', 'openPlPopup()', 'closePlPopup()'],
    ['s.sorteio', 'abrirSorteio()', 'fecharSorteio()'],
    ['s.ferramentas', 'abrirFerramentas()', 'fecharFerramentas()'],
    ['s.ferr-clock', 'abrirFerramenta("clock")', 'fecharFerramentas()'],
    ['s.ferr-stopwatch', 'abrirFerramenta("stopwatch")', 'fecharFerramentas()'],
    ['s.ferr-timer', 'abrirFerramenta("timer")', 'fecharFerramentas()'],
    ['s.ferr-itinerario', 'abrirFerramenta("itinerario")', 'fecharFerramentas()'],
    ['s.ferr-msg', 'abrirFerramenta("msg")', 'fecharFerramentas()'],
    ['s.ferr-draw', 'abrirFerramenta("draw")', 'fecharFerramentas()'],
  ];
  const ruinsJ = [], vistosJ = [];
  for (const viewport of [{ width: 390, height: 860 }, { width: 360, height: 640 }]) {
    for (const avancado of [false, true]) {
      const { ctx, pg } = await abrir(viewport, { avancado });
      await pg.evaluate(() => { const v = {}; for (const k of AVTour.chaves()) v[k] = 1; localStorage.setItem('av.tour', JSON.stringify(v)); });
      for (const [qual, abre, fecha] of (avancado ? SO_AVANCADO : SO_FACIL).concat(AMBOS_J)) {
        const onde = viewport.width + '×' + viewport.height + (avancado ? ' avançado ' : ' fácil ') + qual;
        if (abre === 'TOCAR') {
          const id = await pg.evaluate(async () => (await AVDB.addMedia(new Blob(['x'], { type: 'audio/wav' }),
            { name: 'Louvor de Fundo', type: 'audio/wav', kind: 'audio', list: 'imports' })).id);
          await pg.evaluate(async (i) => {
            await send(i);
            currentItem.lyrics = [{ cover: true }, { time: 0, text: 'primeira' }, { time: 5, text: 'segunda' }];
            renderSlideNav(); renderSimpleGate();
          }, id);
        } else if (abre) await pg.evaluate(abre);
        const pronto = await esperar(pg, (q) => (q.startsWith('s.') ? secaoDoTour() === q.slice(2) : qualTour() === q), qual, 5000);
        await pg.waitForTimeout(450);   // a janela assenta (transição) antes de o tour medir a ordem
        const abriu = pronto === true && await pg.evaluate((q) => AVTour.abrir(q), qual);
        if (!abriu) { ruinsJ.push(onde + ': não abriu (' + await pg.evaluate(() => secaoDoTour() + '/' + qualTour()) + ')'); }
        else {
          const ps = await percorrer(pg);
          vistosJ.push(onde + ': ' + ps.map((m) => (m.fixo ? '[' + m.titulo + ']' : m.titulo)).join(' · '));
          for (const r of foraDeOrdem(ps)) ruinsJ.push(onde + ': ' + r);
          await pg.evaluate(() => AVTour.aberto() && AVTour.fechar());
        }
        if (fecha) { await pg.evaluate(fecha); await esperar(pg, () => !secaoDoTour(), null, 3000); }
      }
      await ctx.close();
    }
  }
  if (process.env.TOUR_ORDEM) console.log(vistosJ.join('\n'));
  checar(ruinsJ.length === 0 && vistosJ.length >= 40,
    'J · em todo tour, nos dois modos, a 390×860 e a 360×640, os passos vão de cima para baixo e, na faixa, da esquerda para a direita',
    ruinsJ.join(' | ') + ' (' + vistosJ.length + ' tours medidos)');

  // ---------------- K · o MOVIMENTO entre passos (v1.14.4) ----------------
  {
    const { ctx, pg } = await abrir({ width: 390, height: 860 }, { avancado: true });
    const r = await esperarTour(pg, 'avancado');
    await pg.waitForTimeout(320); await assentou(pg);
    const a = r === true ? await medir(pg) : null;
    // As transições declaradas: computadas, e não 0.
    const trans = () => pg.evaluate(() => {
      const de = (el) => { const cs = getComputedStyle(el);
        return { props: cs.transitionProperty.split(',').map((x) => x.trim()),
          durs: cs.transitionDuration.split(',').map((x) => parseFloat(x) * (/ms/.test(x) ? 1 : 1000)) }; };
      return { rec: de(document.querySelector('#tour .tour-recorte')), bal: de(document.querySelector('#tour .tour-balao')) };
    });
    // Em repouso vale o trajeto CURTO dos reposicionamentos (`--dur-rapida`); na
    // troca de passo, o inteiro (`--tour-mov`) — medido abaixo, no meio dela.
    const t1 = await trans();
    const dur = (x, p) => x.durs[x.props.indexOf(p) % x.durs.length];
    const temTrans = (t, min) => ['left', 'top', 'width', 'height', 'border-radius'].every((p) => dur(t.rec, p) >= min)
      && dur(t.bal, 'transform') >= min && dur(t.bal, 'height') >= min;
    // No MEIO da troca (as transições pausadas na metade), o recorte está entre A e B.
    await pg.click('#tour .tour-proximo');
    const meio = await pg.evaluate(async () => {
      const raiz = document.getElementById('tour');
      const rec = raiz.querySelector('.tour-recorte'), bal = raiz.querySelector('.tour-balao');
      const ate = performance.now() + 3000;
      let an = [];
      while (performance.now() < ate && !an.length) {
        an = rec.getAnimations().filter((x) => /^(left|top|width|height)$/.test(x.transitionProperty || ''));
        if (!an.length) await new Promise((ok) => requestAnimationFrame(ok));
      }
      if (!an.length) return null;
      const todas = raiz.getAnimations({ subtree: true });
      for (const x of todas) { x.pause(); x.currentTime = x.effect.getTiming().duration / 2; }
      const q = rec.getBoundingClientRect();
      const de = (el) => { const cs = getComputedStyle(el);
        return { props: cs.transitionProperty.split(',').map((x) => x.trim()),
          durs: cs.transitionDuration.split(',').map((x) => parseFloat(x) * (/ms/.test(x) ? 1 : 1000)) }; };
      const trans = { rec: de(rec), bal: de(bal) };
      const balAnim = bal.getAnimations().some((x) => x.transitionProperty === 'transform');
      for (const x of todas) x.play();
      return { recorte: { l: q.left, t: q.top, r: q.right, b: q.bottom }, balAnim, trans };
    });
    checar(temTrans(t1, 100) && !!meio && temTrans(meio.trans, 300),
      'K · o recorte (posição, tamanho e raio) e o balão (posição e altura) têm transição: ≥ 300 ms na troca de passo, curta no reposicionamento',
      JSON.stringify({ repouso: t1, troca: meio && meio.trans }));
    await assentou(pg); await pg.waitForTimeout(320); await assentou(pg);
    const b = await medir(pg);
    const muda = a && b.recorte ? ['l', 't', 'r', 'b'].filter((k) => Math.abs(a.recorte[k] - b.recorte[k]) > 8) : [];
    const entre = !!meio && muda.length > 0 && muda.every((k) => meio.recorte[k] > Math.min(a.recorte[k], b.recorte[k]) + 0.5
      && meio.recorte[k] < Math.max(a.recorte[k], b.recorte[k]) - 0.5);
    const balMuda = a && (Math.abs(a.balao.t - b.balao.t) > 8 || Math.abs(a.balao.l - b.balao.l) > 8);
    checar(entre && (!balMuda || meio.balAnim),
      'K · no meio da troca o recorte está ENTRE a peça A e a B (desliza, não salta) e o balão anda junto',
      JSON.stringify({ a: a && a.recorte, meio, b: b.recorte, muda }));
    checar(recorteBate(b) && haloBate(b), 'K · no fim da troca o recorte bate com a peça nova, com o halo', JSON.stringify([b.alvo, b.peca, b.recorte]));
    // Três "Próximo" rápidos, no meio do movimento: o último vence, três passos adiante.
    const i0 = b.i;
    await pg.evaluate(async () => {
      const bt = document.querySelector('#tour .tour-proximo');
      for (let k = 0; k < 3; k++) { bt.click(); await new Promise((ok) => setTimeout(ok, 40)); }
    });
    await assentou(pg); await pg.waitForTimeout(320); await assentou(pg);
    const c = await medir(pg);
    checar(c.i === i0 + 3 && c.titulo === await pg.evaluate(() => document.getElementById('tourTitulo').textContent)
      && c.cont === (c.i + 1) + ' de ' + c.total && (c.peca ? recorteBate(c) : c.centro),
      'K · três "Próximo" rápidos terminam três passos adiante, com texto, contador e recorte do passo certo',
      JSON.stringify({ i0, i: c.i, titulo: c.titulo, cont: c.cont, alvo: c.alvo, peca: c.peca, recorte: c.recorte }));
    // Movimento reduzido: duração 0, e o passo novo já está no lugar no mesmo instante.
    await pg.emulateMedia({ reducedMotion: 'reduce' });
    const t2 = await trans();
    await pg.evaluate(() => document.querySelector('#tour .tour-voltar').click());
    const d = await medir(pg);
    checar([...t2.rec.durs, ...t2.bal.durs].every((x) => x < 1) && d.i === c.i - 1 && (d.peca ? recorteBate(d) : d.centro),
      'K · com `prefers-reduced-motion` a duração é 0 e o recorte já está na peça logo depois do toque',
      JSON.stringify({ rec: t2.rec.durs, bal: t2.bal.durs, i: d.i, alvo: d.alvo, peca: d.peca, recorte: d.recorte }));
    await ctx.close();
  }

  // ---------------- E · 360×640 com fonte 1,3× ----------------
  for (const avancado of [true, false]) {
    const { ctx, pg } = await abrir({ width: 360, height: 640 }, { avancado, fonte: 1.3 });
    const qual = avancado ? 'avancado' : 'conexao';
    const r = await esperarTour(pg, qual);
    const pe = r === true ? await percorrer(pg) : [];
    const ruins = pe.filter((m) => !dentro(m) || m.botoes.some((b) => b.corta)
      || (m.recorte && cabeAoLado(m) && !(m.balao.b <= m.recorte.t + 0.5 || m.balao.t >= m.recorte.b - 0.5)));
    checar(r === true && pe.length > 1 && ruins.length === 0,
      'E · ' + qual + ' a 360×640 × 1,3: o balão cabe na tela, não cobre a peça quando há lugar ao lado e nenhum botão corta o rótulo',
      porque(r) || JSON.stringify(ruins.map((m) => [m.alvo, m.balao, m.recorte, m.botoes])));
    await ctx.close();
  }
} finally {
  await navegador.close();
  servidor.close();
}

checar(erros.length === 0, 'nenhum pageerror', erros.join(' | '));
if (falhas.length) { console.log(`\n${falhas.length} falha(s)`); process.exit(1); }
console.log('\ntour: OK');
