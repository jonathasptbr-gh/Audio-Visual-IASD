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
//   F · o botão de Configurações refaz o tour do modo ATUAL; o guia de
//       sonoplastia abre `#dia` no Fácil e o começo da página no avançado.
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
  const passo = AVTour.TOURS[e.qual].filter((p) => !p.opcional || (Array.isArray(p.alvo) ? p.alvo : [p.alvo])
    .some((s) => { const n = document.querySelector(s); return n && n.getBoundingClientRect().width > 0; }))[e.passo];
  const vis = (n) => {
    if (!n || n.closest('[hidden]')) return false;
    const r = n.getBoundingClientRect(); const cs = getComputedStyle(n);
    return r.width >= 1 && r.height >= 1 && cs.visibility !== 'hidden' && cs.display !== 'none'
      && r.bottom > 0 && r.top < innerHeight;
  };
  const els = (Array.isArray(passo.alvo) ? passo.alvo : [passo.alvo]).map((s) => document.querySelector(s)).filter(vis);
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
    cont: raiz.querySelector('.tour-cont').textContent, texto: raiz.querySelector('#tourTexto').textContent,
    centro: raiz.classList.contains('tour--centro'),
    peca, recorte: rr && { l: rr.left, t: rr.top, r: rr.right, b: rr.bottom },
    balao: { l: br.left, t: br.top, r: br.right, b: br.bottom },
    vw: innerWidth, vh: innerHeight, botoes,
    papel: bal.getAttribute('role'), focoDentro: bal.contains(document.activeElement),
    veu: getComputedStyle(rec).boxShadow, veuFundo: getComputedStyle(raiz).backgroundColor,
    token: getComputedStyle(document.documentElement).getPropertyValue('--tour-veu').trim(),
  };
});

// A cor do véu: a sombra computada do recorte (`rgba(0, 0, 0, 0.68)`) contra o token
// (`rgba(0, 0, 0, .68)`), comparadas como NÚMEROS.
const nums = (t) => ((String(t).match(/rgba?\(([^)]*)\)/) || [])[1] || '').split(',').map((x) => +x);
const veuBate = (m) => { const a = nums(m.veu), b = nums(m.token); return a.length === 4 && b.length === 4 && a.every((v, k) => Math.abs(v - b[k]) < 0.005); };

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

// Percorre o tour inteiro pelo "Próximo", medindo cada passo.
async function percorrer(pg) {
  const passos = [];
  for (let k = 0; k < 20; k++) {
    await pg.waitForTimeout(320);   // o vigia (250 ms) reposiciona: a pílula de volume entra com transição
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
    checar(['#simpleBarra+#libBar', '.simple-song', '.simple-keys', '#volPill', '#simpleSettingsBtn'].every((a) => alvos.includes(a)),
      'B · Biblioteca, letra, teclas, volume e Configurações estão no tour', alvos.join(' '));
    const semMidia = pb.filter((m) => ['.simple-song', '.simple-keys'].includes(m.alvo));
    checar(semMidia.length === 2 && semMidia.every((m) => m.centro && !m.recorte && m.veuFundo !== 'rgba(0, 0, 0, 0)' && /tocando/.test(m.texto)),
      'B · sem mídia no ar, a letra e as teclas viram balão CENTRAL que explica', JSON.stringify(semMidia.map((m) => [m.alvo, m.centro, m.texto])));
    const comPeca = pb.filter((m) => !semMidia.includes(m));
    const ruinsB = comPeca.filter((m) => !recorteBate(m));
    checar(ruinsB.length === 0, 'B · os outros passos recortam a peça certa (o volume inclusive)',
      JSON.stringify(ruinsB.map((m) => [m.alvo, m.peca, m.recorte])));
    // O volume: aparece no passo dele e some ao sair.
    await pg.click('#tour .tour-voltar');
    await pg.waitForTimeout(320);
    let m = await medir(pg);
    while (m.alvo !== '#volPill' && m.i > 0) { await pg.click('#tour .tour-voltar'); await pg.waitForTimeout(320); m = await medir(pg); }
    const noVol = await pg.evaluate(() => document.getElementById('volPill').classList.contains('visivel'));
    await pg.click('#tour .tour-voltar');
    const depoisVol = await pg.evaluate(() => document.getElementById('volPill').classList.contains('visivel'));
    checar(m.alvo === '#volPill' && noVol && !depoisVol, 'B · o passo do volume MOSTRA a pílula e o tour a esconde ao sair do passo',
      JSON.stringify({ alvo: m.alvo, noVol, depoisVol }));
    // O voltar do Android é o degrau 0.
    const volta = await pg.evaluate(() => ({ r: window.__avBack(), aberto: AVTour.aberto(), oculto: document.getElementById('tour').hidden }));
    checar(volta.r === true && !volta.aberto && volta.oculto, 'B · o voltar do Android fecha o tour (e só ele)', JSON.stringify(volta));

    // ---------------- F · Configurações, no Fácil ----------------
    await pg.evaluate(() => { window.__abertos = []; window.open = (u) => { window.__abertos.push(u); return null; }; });
    await pg.click('#simpleSettingsBtn');
    await esperar(pg, () => document.getElementById('fadePopup').classList.contains('open'));
    const lado = await pg.evaluate(() => {
      const t = document.getElementById('tourBtn'), s = document.getElementById('guiaSomBtn');
      const a = t.getBoundingClientRect(), b = s.getBoundingClientRect();
      return { vis: a.width > 0 && b.width > 0, mesmaLinha: Math.abs(a.top - b.top) < 2, corta: [t, s].some((x) => x.scrollWidth > x.clientWidth + 1) };
    });
    checar(lado.vis && lado.mesmaLinha && !lado.corta, 'F · "Tour do app" e "Guia de sonoplastia" estão em Configurações, lado a lado, sem cortar', JSON.stringify(lado));
    await pg.click('#guiaSomBtn');
    const urlFacil = await pg.evaluate(() => window.__abertos.slice(-1)[0]);
    checar(urlFacil === 'https://audiovisualiasd.com.br/sonoplastia/#dia',
      'F · no Modo Fácil o guia abre direto em "Sonoplasta por um dia"', urlFacil);
    await pg.click('#tourBtn');
    const rf = await esperarTour(pg, 'simples', 5000);
    checar(rf === true && await pg.evaluate(() => !document.getElementById('fadePopup').classList.contains('open')),
      'F · no Fácil destravado o botão fecha Configurações e refaz o tour dos CONTROLES', porque(rf));
    await pg.click('#tour .tour-pular');
    await pg.evaluate(() => { setTocarNoCelular(false); renderSimpleGate(); });
    await esperar(pg, () => simpleModeEl.classList.contains('sem-tela'));
    await pg.evaluate(() => openFadePopup());
    await esperar(pg, () => document.getElementById('fadePopup').classList.contains('open'));
    await pg.click('#tourBtn');
    const rc = await esperarTour(pg, 'conexao', 5000);
    checar(rc === true, 'F · com a cortina de volta, o mesmo botão refaz o tour da CONEXÃO', porque(rc));
    await pg.click('#tour .tour-pular');
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
    await pg.evaluate(() => localStorage.setItem('av.tour', '{"conexao":1,"simples":1}'));
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
    await pg.click('#tour .tour-pular');

    // ---------------- F · Configurações, no avançado ----------------
    await pg.evaluate(() => { window.__abertos = []; window.open = (u) => { window.__abertos.push(u); return null; }; });
    await pg.click('#settingsBtn');
    await esperar(pg, () => document.getElementById('fadePopup').classList.contains('open'));
    await pg.click('#guiaSomBtn');
    const urlAv = await pg.evaluate(() => window.__abertos.slice(-1)[0]);
    checar(urlAv === 'https://audiovisualiasd.com.br/sonoplastia/', 'F · no avançado o guia abre no começo da página', urlAv);
    await pg.click('#tourBtn');
    const ra = await esperarTour(pg, 'avancado', 5000);
    checar(ra === true, 'F · no avançado o botão refaz o tour COMPLETO', porque(ra));
    await pg.click('#tour .tour-pular');
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
