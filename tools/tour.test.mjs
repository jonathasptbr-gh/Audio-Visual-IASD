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
//       modo (a do editor de mídia, que só existe no avançado, o Fácil não zera);
//       o guia de sonoplastia abre `#dia` no Fácil e o começo no avançado.
//   L · desligar por inteiro: "Tour do app" é o ÚLTIMO QUADRADO da grade (nasce
//       ligado; tocar desliga, grava `av.tour.off` e a folha segue aberta;
//       desligado, nem o principal nem o de seção abrem sozinhos; tocar de novo
//       liga e refaz o tour). "Pular tour" no balão desliga o MESMO interruptor, e
//       o quadrado acompanha. O "Guia de sonoplastia" leva a seta de "abre outra tela".
//   G · tours de SEÇÃO (v1.14.1): Configurações no Fácil, Ferramentas e o Timer
//       no avançado — sozinhos na primeira abertura, nunca de novo, com o halo.
//   H · o Fácil TOCANDO: a letra e as teclas, na primeira vez que algo toca.
//   I · a varredura: toda seção do avançado acha as próprias peças; I2 · o editor
//       de mídia que já abre no formulário se explica pelo trecho e grava a marca.
//   J · a ORDEM VISUAL (v1.14.3): em todo tour, nos dois modos, a 390×860 e a
//       360×640, os passos com peça vão de cima para baixo e, na mesma faixa, da
//       esquerda para a direita (os fixos — `abertura`/`fecho` — ficam de fora), e a
//       moldura — a peça que CONTÉM outra — vem antes do que está dentro dela (v1.14.21).
//   K · o MOVIMENTO (v1.14.4): entre passos o recorte e o balão têm transição e,
//       no meio dela, o recorte está ENTRE a peça A e a B (sem salto); no fim ele
//       bate com a peça; três "Próximo" rápidos terminam três passos adiante; com
//       `prefers-reduced-motion` a duração é 0 e o passo novo já está no lugar.
//   B2 · a lista da Biblioteca COM a Liturgia e as seções do catálogo (v1.14.20): a fixture põe o mínimo em
//       memória e o app desenha a lista de verdade; cada seção tem passo, na ordem da tela.
//   H2 · `modos` é porteiro: a Biblioteca aberta por cima da leitura, no Fácil, NÃO abre o tour de seção do Avançado.
//   I/J · as seções por ESTADO (a Bíblia em leitura, o formulário do editor, a cifra à vista) e as Mensagens com
//       uma mensagem criada, por fixtures; M · uma marca por vista: a grade da Bíblia e a leitura, a Letra e a
//       Cifra se explicam cada uma, na troca de vista.
//   e nenhum `pageerror` em parte nenhuma.
//   node tools/tour.test.mjs
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperarCortina, esperar, porque, comTema, comModoAvancado,
  checar, falhas, wav,
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
checar(/id="dia"/.test(site) && /Guia de sonoplasta por um dia/.test(site) && fs.readFileSync(path.join(AQUI, '..', 'site', 'CNAME'), 'utf8').trim() === 'audiovisualiasd.com.br',
  'premissa: a página do guia tem o "Guia de sonoplasta por um dia" em `#dia`, no domínio do site');

async function abrir(viewport, { avancado = false, tema = 'escuro', fonte = 1, reduzido = false } = {}) {
  // `reduzido`: o caminho instantâneo do tour (v1.14.4). Quem mede ORDEM (o bloco J) não precisa das
  // transições — quem as mede é o K —, e esperar cada uma custava a maior parte do tempo do arquivo.
  const ctx = await navegador.newContext({ viewport, hasTouch: true, reducedMotion: reduzido ? 'reduce' : 'no-preference' });
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
  // TODOS OS ALVOS VISÍVEIS, sem escolher: o oráculo NÃO repete a escolha do
  // `elementos()` — ele guarda as ocorrências e cobra a PEÇA contra elas (um
  // alvo quando o passo não pede `todos`; a união quando pede). Espelhar a regra
  // do código aprovava o recorte que ela mesma tinha feito (v1.14.17).
  const passo = AVTour.passoAtual();   // o passo NA ORDEM em que o tour o mostra
  const rect = (n) => { const q = n.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
  const seletores = !passo.alvo ? [] : Array.isArray(passo.alvo) ? passo.alvo : [passo.alvo];
  // A SELEÇÃO VEM DO TOUR (`AVTour.alvos()`), não de uma segunda cópia da regra
  // do `elementos()`; os GRUPOS são o que cada seletor tem à vista, para o
  // oráculo cobrar a REGRA (um alvo por seletor, todos com `todos`) sem repetir
  // a escolha. Antes, medir com a mesma regra aprovava o recorte que ela fizera.
  const selecionados = AVTour.alvos();
  const grupos = seletores.map((q) => [...document.querySelectorAll(q)].filter(vis).map(rect));
  const peca = selecionados.reduce((a, q) => (a
    ? { l: Math.min(a.l, q.l), t: Math.min(a.t, q.t), r: Math.max(a.r, q.r), b: Math.max(a.b, q.b) }
    : { ...q }), null);
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
    volume: !!passo.volume,   // a pílula só existe no passo dela: fica fora da regra da ordem (v1.14.20)
    peca, selecionados, grupos, todos: !!passo.todos, folga: AVTour.FOLGA, anel: AVTour.ANEL,
    recorte: rr && { l: rr.left, t: rr.top, r: rr.right, b: rr.bottom },
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

// A PEÇA CONTRA OS ALVOS (v1.14.17): com `todos` ela é a UNIÃO de todos os
// visíveis; sem, é UM deles — nunca a união de dois. Este é o lado independente:
// antes o oráculo media a peça com a MESMA regra do `elementos()`, e aprovava o
// recorte que ela mesma fizera.
const uniaoDe = (rs) => rs.reduce((a, q) => (a
  ? { l: Math.min(a.l, q.l), t: Math.min(a.t, q.t), r: Math.max(a.r, q.r), b: Math.max(a.b, q.b) }
  : { ...q }), null);
const pertoDe = (a, b) => Math.abs(a - b) <= 1.5;
const dentroDe = (peca, r) => r.l >= peca.l - 1.5 && r.t >= peca.t - 1.5
  && r.r <= peca.r + 1.5 && r.b <= peca.b + 1.5;
// A PEÇA É EXATAMENTE A UNIÃO DO QUE ESTÁ DENTRO DELA, e um alvo por seletor —
// salvo `todos`, que pode unir as ocorrências. Assim a régua não repete a
// escolha do `elementos()`: a peça pode unir SELETORES diferentes (a faixa e as
// duas pontas do mesmo controle), nunca as LINHAS de um seletor só.
const pecaDeAlvos = (m) => {
  if (!m.peca || !m.selecionados || !m.selecionados.length || !m.grupos) return false;
  const igual = (a, b) => pertoDe(a.l, b.l) && pertoDe(a.t, b.t) && pertoDe(a.r, b.r) && pertoDe(a.b, b.b);
  // A peça é a UNIÃO do que o tour selecionou.
  if (!igual(m.peca, uniaoDe(m.selecionados))) return false;
  // E a seleção obedece à regra: UM alvo por seletor; com `todos`, todos os
  // visíveis. O que se cobra é a contagem e o pertencimento, não QUAL foi
  // escolhido — é isso que distingue a peça certa da primeira casada.
  return m.grupos.every((g) => {
    const marco = g.filter((r) => m.selecionados.some((e) => igual(r, e)));
    return m.todos ? marco.length === g.length : marco.length === 1;
  });
};

// O recorte É a peça: contém o retângulo dela mais a folga, e recua só o ANEL —
// ele é desenhado por FORA da caixa (`box-shadow: 0 0 0 2px`), então a caixa para
// o ANEL antes da borda e o anel termina exatamente nela (v1.14.11). É a mesma
// régua do foco dos controles: encosta na borda, não fura. AS DUAS CONSTANTES VÊM
// DO CÓDIGO (`AVTour.FOLGA`/`ANEL`), nunca digitadas aqui.
function recorteBate(m) {
  if (!m.peca || !m.recorte || !pecaDeAlvos(m)) return false;
  const FOLGA = m.folga, ANEL = m.anel;
  const lim = (v, max) => Math.min(max - ANEL, Math.max(ANEL, v));
  const p = { l: lim(m.peca.l, m.vw), t: lim(m.peca.t, m.vh), r: lim(m.peca.r, m.vw), b: lim(m.peca.b, m.vh) };
  const e = { l: lim(p.l - FOLGA, m.vw), t: lim(p.t - FOLGA, m.vh), r: lim(p.r + FOLGA, m.vw), b: lim(p.b + FOLGA, m.vh) };
  const perto = (a, b) => Math.abs(a - b) <= 1.5;
  return perto(m.recorte.l, e.l) && perto(m.recorte.t, e.t) && perto(m.recorte.r, e.r) && perto(m.recorte.b, e.b)
    && m.recorte.r - m.recorte.l > 8 && m.recorte.b - m.recorte.t > 8
    && m.recorte.l >= ANEL - 0.5 && m.recorte.t >= ANEL - 0.5
    && m.recorte.r <= m.vw - ANEL + 0.5 && m.recorte.b <= m.vh - ANEL + 0.5;
}
// Há lugar para o balão inteiro acima ou abaixo do recorte (margem 16 + vão 10)?
const cabeAoLado = (m) => { const h = m.balao.b - m.balao.t; return m.recorte.t - 26 >= h || m.vh - m.recorte.b - 26 >= h; };
const dentro = (m) => m.balao.l >= -0.5 && m.balao.t >= -0.5 && m.balao.r <= m.vw + 0.5 && m.balao.b <= m.vh + 0.5;

// Fecha o tour se estiver aberto (numa reprovação ele pode nem ter aberto). NÃO é o
// "Pular tour" do balão — esse DESLIGA o tour por inteiro (v1.14.5) e tem o caso L.
const pular = async (pg) => { if (await pg.evaluate(() => AVTour.aberto())) await pg.evaluate(() => AVTour.fechar()); };

// A ORDEM VISUAL: a faixa é a do `tour.js` — os centros verticais, em ordem, ficam
// na mesma faixa enquanto cada um dista do anterior até max(`linhaPx`, metade da
// altura do menor). `linhaPx` é o `AVTour.LINHA_PX` lido da página: a régua do
// oráculo é a do código. Na sequência mostrada, a faixa não volta para cima e,
// dentro dela, a borda esquerda não volta para a esquerda. Devolve os pares fora de ordem.
function foraDeOrdem(passos, linhaPx) {
  // A PÍLULA DO VOLUME FICA DE FORA (v1.14.20): é o tour que a mostra no passo dela, e a caixa que ela ocupa
  // MUDA entre escondida e mostrada — não há ordem visual da página a respeitar num passo que cria a própria peça.
  const ms = passos.filter((m) => m.peca && !m.fixo && !m.volume).map((m) => ({
    cy: (m.peca.t + m.peca.b) / 2, h: m.peca.b - m.peca.t, l: m.peca.l, p: m.peca, alvo: [].concat(m.alvo).join('+') }));
  // A MOLDURA (v1.14.21): `a` contém `b` quando a caixa de `b` cabe inteira na de `a` (±1,5 px) e `a` é maior.
  const contem = (a, b) => b.l >= a.l - 1.5 && b.t >= a.t - 1.5 && b.r <= a.r + 1.5 && b.b <= a.b + 1.5
    && (a.r - a.l) * (a.b - a.t) > (b.r - b.l) * (b.b - b.t) + 1;
  let faixa = 0, ant = null;
  for (const m of [...ms].sort((a, b) => a.cy - b.cy)) {
    if (ant && m.cy - ant.cy > Math.max(linhaPx, Math.min(ant.h, m.h) / 2)) faixa++;
    m.faixa = faixa; ant = m;
  }
  const ruins = [];
  for (let k = 1; k < ms.length; k++) {
    const a = ms[k - 1], b = ms[k];
    if (contem(a.p, b.p)) continue;   // moldura → peça de dentro: a exceção da faixa
    if (b.faixa < a.faixa || (b.faixa === a.faixa && b.l < a.l - 1)) {
      ruins.push(a.alvo + '(' + Math.round(a.cy) + ',' + Math.round(a.l) + ') → ' + b.alvo + '(' + Math.round(b.cy) + ',' + Math.round(b.l) + ')');
    }
  }
  // E o lado de lá da regra: nenhuma moldura vem DEPOIS de uma peça que está dentro dela.
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 1; j < ms.length; j++) if (contem(ms[j].p, ms[i].p)) ruins.push(ms[i].alvo + ' antes da moldura ' + ms[j].alvo);
  }
  return ruins;
}

// O MOVIMENTO (v1.14.4): o recorte e o balão deslizam — mede-se depois que tudo
// ASSENTOU (`AVTour.quieto()`: sem troca de passo nem transição correndo).
const assentou = (pg) => esperar(pg, () => !window.AVTour || AVTour.quieto(), null, 5000);

// Percorre o tour inteiro pelo "Próximo", medindo cada passo.
async function percorrer(pg) {
  const passos = [];
  for (let k = 0; k < 30; k++) {
    // A ESPERA É A DO PASSO, não uma constante (v1.14.20): o `assentou()` já espera o fato (sem troca
    // nem transição correndo). O que ele NÃO vê é a pílula do volume, mostrada pelo gancho no passo
    // dela: ali ficam os 320 ms do vigia (250 ms) mais a transição; nos outros, 60 ms — o recorte já parou.
    const doVolume = await pg.evaluate(() => !!(window.AVTour && AVTour.passoAtual() && AVTour.passoAtual().volume));
    await pg.waitForTimeout(doVolume ? 320 : 60);
    await assentou(pg);
    if (!(await estado(pg))) { passos.push({ alvo: '(o tour fechou no meio)', i: -1, total: 0 }); break; }
    const m = await medir(pg);
    passos.push(m);
    if (m.i === m.total - 1) break;
    await pg.click('#tour .tour-proximo');
  }
  return passos;
}

// ---------------- as FIXTURES dos estados que só existem depois de uma ação (v1.14.20) ----------------
// A Bíblia em LEITURA, a cifra à vista no auxiliar de leitura, uma mensagem criada, o formulário do editor de
// mídia e a lista da Biblioteca com a Liturgia: sem eles a varredura (I) e a ordem (J) não alcançam as seções
// por ESTADO. Cada receita é uma string para `page.evaluate` (provada a 390×860 e a 360×640) e cada `FECHA`
// desfaz o que o app NÃO desfaz sozinho — a sessão da leitura, a aba da cifra, as mensagens do IDB — para a
// seção seguinte, na mesma página, nascer limpa. `cifraCabe` só nega por falta de `__NATIVE__` (ligá-lo mudaria
// a página inteira): a fixture a troca e a devolve. Sem `${…}` nem crase aqui dentro: são strings de página.
const BIBLIA_LER = `
  const bookIdx = Bible.BOOKS.findIndex((x) => /Naum/i.test(x.name));
  const vs = [];
  for (let i = 1; i <= 19; i++) vs.push({ n: i, text: 'Versículo ' + i + ' de teste com um texto razoavelmente longo.' });
  bibleVersions = [{ id: 'ara', name: 'Almeida Revista e Atualizada (ARA)' }, { id: 'nvi', name: 'Nova Versão Internacional (NVI)' }];
  bibleVersionId = 'ara';
  bibleSel = { bookIdx, chapter: 3 };
  bibleChapterData = { verses: vs };
  startBibleReading(2);`;   // sem `toggleBibleVerse()`: nada vai ao telão
const BIBLIA_ABRE = `(() => { abrirBiblia(); ${BIBLIA_LER} })()`;
const BIBLIA_LEITURA = `(() => { ${BIBLIA_LER} })()`;
const BIBLIA_FECHA = `(async () => {
  fecharBiblia();
  for (let i = 0; i < 40 && bibliaAberta(); i++) await new Promise((r) => setTimeout(r, 25));
  clearBibleSession(); bibleScreen = 'books'; bibleSel = { bookIdx: -1, chapter: 0 };
})()`;
const CIFRA_LETRA = `
  const NL = String.fromCharCode(10);
  const item = { id: 'fx-cifra', name: 'Louvor de Teste', kind: 'audio', seconds: 200, lyrics: [{ text: 'linha de teste' }] };
  const html = '<div>Tom: C</div><pre>' + Array.from({ length: 12 }, (_, i) => '<b>C</b>      <b>G</b>      <b>Am</b>' + NL + 'linha ' + i + ' da cifra de teste').join(NL) + '</pre>';
  window.__fxCifraCabe = window.__fxCifraCabe || cifraCabe; window.cifraCabe = () => true;
  window.__fxCifraItem = item;
  cifraCache.set(cifraChave(item), { estado: 'ok', url: '', pagina: AVCifra.lerPagina(html), motivo: '', semitons: 0 });
  openLyricsPopup(item);`;   // alvo da Biblioteca: não toca em `currentItem`, nada vai ao telão
const CIFRA_ABA = `document.querySelector('#lyricsPopup .fit-opt[data-lvsrc="cifra"]').click();`;   // trocar de alvo ZERA `lvSource`: a aba vem DEPOIS
const CIFRA_ABRE = `(() => { ${CIFRA_LETRA} ${CIFRA_ABA} })()`;
const CIFRA_LETRA_ABRE = `(() => { ${CIFRA_LETRA} })()`;
const CIFRA_FECHA = `(async () => {
  closeLyricsPopup(); lvSource = null;
  cifraCache.delete(cifraChave(window.__fxCifraItem));
  window.cifraCabe = window.__fxCifraCabe;
  for (let i = 0; i < 40 && lyricsPopupEl.classList.contains('open'); i++) await new Promise((r) => setTimeout(r, 25));
})()`;
const MSG_ABRE = `(async () => { messages.length = 0; messages.push({ id: 'fx-msg', text: 'Mensagem de teste para o tour' }); await saveMessages(); abrirFerramenta('msg'); })()`;
const MSG_FECHA = `(async () => { fecharFerramentas(); messages.length = 0; await saveMessages(); })()`;
const LISTA_ABRE = `(() => {
  window.__fxLib = { c22: collState['hymnal-2022'], a7: collState['album-7'], cat: albumCatalog };
  collState['hymnal-2022'] = { indexSyncedAt: Date.now(), songs: [{ track: 533, name: 'Hino de abertura (teste)' }, { track: 572, name: 'Hino do ofertório (teste)' }] };
  albumCatalog = { categories: [{ id_category: 1, name: 'Louvores', order: 1, albums: [{ id_album: 7, subtitle: '', order: 1 }] }], albums: [{ id_album: 7, name: 'Álbum de Teste', color: null }] };
  collState['album-7'] = { indexSyncedAt: 0, songs: [] };
  renderCollectionsNow();
})()`;
const LISTA_FECHA = `(() => {
  const f = window.__fxLib; collState['hymnal-2022'] = f.c22;
  if (f.a7) collState['album-7'] = f.a7; else delete collState['album-7'];
  albumCatalog = f.cat; renderCollectionsNow();
})()`;
// A mídia do editor: criada UMA vez por página (`window.__fxMidia`); o formulário abre com ela na memória.
const WAV6 = wav(6).toString('base64');
const MIDIA_CRIA = async (b64) => {
  const u = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const rec = await AVDB.addMedia(new Blob([u], { type: 'audio/wav' }), { name: 'Trecho', kind: 'audio', list: 'imports', seconds: 6 });
  window.__fxMidia = rec.id;
  return rec.id;
};
// A PLAYLIST AUTOMÁTICA COM A LISTA (v1.14.21): oito faixas no Hinário 2022 (três "no aparelho") — com
// menos de 100 faixas a lista sai sem o aquecimento —, e o que o app não desfaz sozinho volta no `FECHA`.
const SORTEIO_ABRE = `(async () => {
  window.__fxColl = collState['hymnal-2022']; const songs = [];
  for (let i = 0; i < 8; i++) songs.push({ id_music: 'fx' + i, track: i + 1, name: 'Louvor ' + (i + 1),
    duration: '3:00', has_instrumental_music: false, fileIdFull: i < 3 ? 'fx-f' + i : null, fileIdPlayback: null });
  collState['hymnal-2022'] = { songs }; lyricIndex = null;
  await abrirSorteio();
})()`;
const SORTEIO_FECHA = `(() => {
  fecharSorteio();
  const antes = window.__fxColl; delete window.__fxColl;
  if (antes) collState['hymnal-2022'] = antes; else delete collState['hymnal-2022'];
  lyricIndex = null;
})()`;
const EDICAO_FORM_ABRE = `(async () => { const ok = await edicaoCarregarOrigem(window.__fxMidia); abrirFerramenta('edicao'); return ok; })()`;

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
    // A LISTA DA JANELA ABERTA (v1.14.20): o que o navegador desenha sem simulação — o cartão de coleção e a seta de
    // download — já tem passo, e o texto do cartão diz que o toque toca direto (e que no Avançado ele abre as opções).
    const txB = (t) => (pb.find((m) => m.titulo === t) || {}).texto || '';
    checar(['#hymnResults .hymnal-card > .coll-bar', '#hymnResults .coll-bar-dl:not(.coll-bar-rm)'].every((a) => alvos.includes(a))
      && /na TV na hora/.test(txB('Coleções')) && /Avançado/.test(txB('Coleções')) && /avulsa/.test(txB('Baixar')) && /cancela/.test(txB('Baixar')),
      'B · a lista da Biblioteca tem o passo do cartão de coleção (o toque toca direto) e o da seta de download (coleção e música avulsa)', alvos.join(' '));
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

    // ---------------- B2 · a lista da Biblioteca COM a Liturgia e as seções (v1.14.20) ----------------
    // O navegador não desenha a Liturgia (só existe no app) nem as barras do catálogo (vêm da rede): a fixture põe o
    // mínimo em memória — os dois hinos fixos e um catálogo de um álbum — e o app desenha a lista de verdade.
    await pg.evaluate(LISTA_ABRE);
    const listaPronta = await esperar(pg, () => !!document.querySelector('#hymnResults .semana-raiz .hymn-result')
      && !!document.querySelector('#hymnResults .coll-group-bar'), null, 3000);
    await pg.waitForTimeout(450);   // a lista assenta
    const abriuB2 = listaPronta === true && await pg.evaluate(() => AVTour.abrir('simples'));
    const pb2 = abriuB2 ? await percorrer(pg) : [];
    const titulosB2 = pb2.map((m) => m.titulo);
    const ordemB2 = pb2.length ? foraDeOrdem(pb2, await pg.evaluate(() => AVTour.LINHA_PX)) : ['sem passos'];
    checar(abriuB2 && ['Liturgia', 'Coleções', 'Seções', 'Baixar'].every((t) => titulosB2.includes(t))
      // O botão do fim da lista ('Buscar na galeria', v1.14.42) é `opcional`: com ele à vista, depois do Baixar.
      && (!titulosB2.includes('Buscar na galeria') || titulosB2.indexOf('Buscar na galeria') > titulosB2.indexOf('Baixar'))
      && titulosB2.indexOf('Liturgia') < titulosB2.indexOf('Coleções') && titulosB2.indexOf('Coleções') < titulosB2.indexOf('Seções')
      && titulosB2.indexOf('Coleções') < titulosB2.indexOf('Baixar')
      && pb2.filter((m) => m.alvo && !recorteBate(m)).length === 0 && ordemB2.length === 0,
      'B2 · com a Liturgia e as seções à vista, a lista da Biblioteca tem um passo para cada uma (e o "Buscar na galeria", à vista, depois delas — v1.14.42), na ordem da tela, recortando a peça',
      (porque(listaPronta) || 'lista pronta') + ' · ' + titulosB2.join(' · ') + ' ' + ordemB2.join(' | ')
      + ' ' + JSON.stringify(pb2.filter((m) => m.alvo && !recorteBate(m)).map((m) => [m.alvo, m.peca, m.recorte])));
    await pg.evaluate(() => AVTour.aberto() && AVTour.fechar());
    await pg.evaluate(LISTA_FECHA);

    // ---------------- G · a RAIZ de Configurações NÃO tem tour (v1.14.10) ----------------
    // Pedido do operador: *"Desative o tour na primeira aba das configurações …
    // Pode aplicar o tour novamente apenas nas seções complexas das
    // configurações, como o histórico e a transferência."* A raiz e as janelas
    // simples (Tela, Verificar) saem; Histórico e Transferir ficam — e o do
    // Histórico ensina o + que manda o item ao Cronograma.
    const chavesG = await pg.evaluate(() => AVTour.chaves());
    // A FAMÍLIA, e não três nomes que não existem: `s.configuracoes`/`s.cfg-tela`/
    // `s.cfg-teste` nunca estiveram em `SECOES`, então negá-los passava por
    // vacuidade. A régua é a lista FECHADA das seções de Configurações.
    const secoesCfg = chavesG.filter((k) => k.startsWith('s.cfg-')).sort();
    checar(secoesCfg.length === 2 && secoesCfg[0] === 's.cfg-hist' && secoesCfg[1] === 's.cfg-pacote',
      'G · as seções de Configurações são DUAS — Histórico e Transferir —, e a raiz não voltou',
      JSON.stringify(secoesCfg));
    await pg.evaluate(() => {
      // SÓ AS DO PRINCIPAL: pré-marcar TUDO esconderia justamente o tour de raiz
      // que este bloco existe para negar.
      const v = JSON.parse(localStorage.getItem('av.tour') || '{}');
      for (const k of ['conexao', 'simples', 'tocando', 'avancado']) v[k] = 1;
      delete v['s.cfg-hist']; delete v['s.cfg-pacote'];
      localStorage.setItem('av.tour', JSON.stringify(v)); AVTour.armar();
    });
    await pg.click('#simpleSettingsBtn');
    await esperar(pg, () => document.getElementById('fadePopup').classList.contains('open'));
    await pg.waitForTimeout(1500);   // AUSÊNCIA: o de seção leva 0,7 s
    const semRaiz = await pg.evaluate(() => ({ aberto: AVTour.aberto(), secao: secaoDoTour() }));
    checar(!semRaiz.aberto && semRaiz.secao === 'configuracoes',
      'G · abrir Configurações pela raiz NÃO abre tour nenhum', JSON.stringify(semRaiz));

    // O HISTÓRICO: um item plantado no histórico dá o alvo do passo novo.
    await pg.evaluate(() => {
      historico.unshift({ inicio: Date.now(), itens: [{ id: 'tour-hino', nome: 'Hino do culto',
        sub: 'Áudio', hora: Date.now(), vezes: 1, rec: { kind: 'audio' } }] });
      abrirSecao('hist');
    });
    const tourHist = await esperarTour(pg, 's.cfg-hist', 5000);
    const passosHist = tourHist === true ? await percorrer(pg) : [];
    checar(tourHist === true && passosHist.some((m) => m.titulo === 'Adicionar ao Cronograma'
        && m.alvo === '#histList .row-item .row-btn'),
      'G · abrir o Histórico abre o tour dele, com o passo do + que adiciona o item ao Cronograma',
      JSON.stringify(passosHist.map((m) => m.titulo)));
    await pular(pg);
    await pg.evaluate(() => closeFadePopup());
    await esperar(pg, () => !document.getElementById('fadePopup').classList.contains('open') && !AVTour.aberto());

    // A TRANSFERÊNCIA: seleção e peso. A lista do pacote só é desenhada com a
    // ponte (`pacoteAbrirLista` sai cedo no navegador), então o oráculo PLANTA a
    // linha que os passos recortam — o que se mede aqui é o tour, e o
    // agrupamento de verdade é do `pacote-por-grupos`.
    await pg.evaluate(() => {
      openFadePopup();
      abrirSecao('pacote');
      const lista = document.getElementById('pacoteLista');
      lista.innerHTML = '';
      const li = document.createElement('li');
      li.className = 'pacote-linha';
      const sub = document.createElement('span');
      sub.className = 'song-menu-sub';
      sub.textContent = 'até 1 MB';
      li.appendChild(sub);
      lista.appendChild(li);
      // A SEGUNDA LINHA, LONGE: é ela que denuncia o recorte da lista inteira.
      // Esta asserção NÃO espelha o `elementos()` — ela olha o que se vê.
      const li2 = li.cloneNode(true);
      li2.style.marginTop = '260px';
      lista.appendChild(li2);
      window.__alturaDaLinha = li.getBoundingClientRect().height;
      const v = JSON.parse(localStorage.getItem('av.tour') || '{}');
      delete v['s.cfg-pacote'];
      localStorage.setItem('av.tour', JSON.stringify(v));
      AVTour.abrir('s.cfg-pacote');
    });
    await esperar(pg, () => AVTour.aberto());
    const passosPac = await percorrer(pg);
    const titulosPac = passosPac.map((m) => m.titulo);
    checar(titulosPac.includes('Marcar e desmarcar') && titulosPac.includes('O peso de cada escolha'),
      'G · abrir o Transferir abre o tour dele, com os passos de seleção e de peso', JSON.stringify(titulosPac));
    const marcar = passosPac.find((m) => m.titulo === 'Marcar e desmarcar');
    const alt = await pg.evaluate(() => window.__alturaDaLinha);
    checar(!!marcar && !!marcar.recorte && (marcar.recorte.b - marcar.recorte.t) < alt + 40,
      'G · o passo da marca recorta UMA linha do Transferir, não as duas da lista',
      JSON.stringify({ alturaDaLinha: alt, recorte: marcar && marcar.recorte }));
    await pular(pg);
    await pg.evaluate(() => closeFadePopup());
    await esperar(pg, () => !document.getElementById('fadePopup').classList.contains('open'));
    // O bloco F continua de Configurações ABERTA.
    await pg.click('#simpleSettingsBtn');
    await esperar(pg, () => document.getElementById('fadePopup').classList.contains('open'));
    // O F mede o GUIA por `window.open` — a sonda que era plantada pelo antigo
    // bloco G (que testava o tour da raiz) e continua valendo aqui.
    await pg.evaluate(() => { window.__abertos = []; window.open = (u) => { window.__abertos.push(u); return null; }; });

    // ---------------- F · Configurações, no Fácil ----------------
    const lado = await pg.evaluate(() => {
      const t = document.getElementById('tourBtn'), s = document.getElementById('guiaSomBtn');
      const grade = document.querySelector('#fadePopup .qs-grade');
      const irmaos = [...grade.children];
      const a = t.getBoundingClientRect(), b = s.getBoundingClientRect();
      return { vis: a.width > 0 && b.width > 0,
        quadrado: t.classList.contains('qs-tile') && t.closest('.qs-grade') === grade,
        ultimo: irmaos[irmaos.length - 1] === t,
        soGuia: document.querySelectorAll('#fadePopup .cfg-ajuda > *').length === 1 && !!s.closest('.cfg-ajuda'),
        corta: [t, s].some((x) => x.scrollWidth > x.clientWidth + 1),
        diz: /cada janela/.test(t.title),
        // O ESTADO MORA NO DESENHO (v1.14.7): o par de ícones do quadrado, e nenhuma
        // caixa de marcação — ele é um `.qs-tile` como o "Dados móveis".
        desenho: !!t.querySelector('use.ico-base[href="#icoTourOff"]')
          && !!t.querySelector('use.ico-alt[href="#icoTour"]'),
        semCaixa: !t.querySelector('.song-menu-check'),
        seta: !!s.querySelector('svg.cfg-externo use[href="#icoExterno"]') && s.querySelector('svg.cfg-externo').getBoundingClientRect().width > 0 };
    });
    checar(lado.vis && lado.quadrado && lado.ultimo && lado.soGuia && !lado.corta && lado.diz,
      'F · o "Tour do app" é o ÚLTIMO quadrado da grade de Configurações, e o "Guia de sonoplastia" ficou sozinho nos botões de ajuda — nenhum dos dois corta, e o quadrado diz que as janelas voltam a se explicar',
      JSON.stringify(lado));
    checar(lado.desenho && lado.semCaixa && lado.seta,
      'L · o estado do tour mora no DESENHO do quadrado (dois ícones, nenhuma caixa de marcação), e o "Guia de sonoplastia" leva a SETA de "abre outra tela", à vista',
      JSON.stringify(lado));
    await pg.click('#guiaSomBtn');
    const urlFacil = await pg.evaluate(() => window.__abertos.slice(-1)[0]);
    checar(urlFacil === 'https://audiovisualiasd.com.br/sonoplastia/#dia',
      'F · no Modo Fácil o guia abre direto no "Guia de sonoplasta por um dia"', urlFacil);

    // ---------------- L · a caixa "Tour do app" liga e desliga o tour por inteiro ----------------
    const caixa = () => pg.evaluate(() => {
      const b = document.getElementById('tourBtn');
      return { estado: b.dataset.estado, alt: b.classList.contains('qs-alt'), aria: b.getAttribute('aria-label'),
        desenho: !!b.querySelector('use.ico-base[href="#icoTourOff"]') && !!b.querySelector('use.ico-alt[href="#icoTour"]'),
        title: b.title,
        off: localStorage.getItem('av.tour.off'), ativo: AVTour.ativo(), folha: document.getElementById('fadePopup').classList.contains('open') };
    });
    const c0 = await caixa();
    checar(c0.estado === 'on' && c0.alt && /ligado$/.test(c0.aria) && c0.desenho && c0.off === null && c0.ativo,
      'L · o tour nasce LIGADO: o quadrado está aceso, o `data-estado` é `on` e o `aria-label` diz "ligado"', JSON.stringify(c0));
    await pg.click('#tourBtn');
    const c1 = await caixa();
    checar(c1.estado === 'off' && !c1.alt && /desligado$/.test(c1.aria) && c1.off === '1' && !c1.ativo && c1.folha && /desligado/.test(c1.title),
      'L · tocar no quadrado DESLIGA: apaga o desenho, grava a escolha e a folha continua aberta', JSON.stringify(c1));
    await pg.evaluate(() => {
      const v = JSON.parse(localStorage.getItem('av.tour')); delete v.simples;
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
    checar(c2.estado === 'off' && !c2.alt && await estado(pg) === null, 'L · reaberta a folha, o quadrado segue apagado e nada se explica', JSON.stringify(c2));
    // Duas marcas postas antes do refazer do Fácil: a do Histórico (seção dos dois
    // modos — o refazer a zera) e a do editor de mídia (seção só do avançado — a
    // lista das Ferramentas do Fácil não tem o quadrado dele, e o refazer daqui não
    // a toca).
    await pg.evaluate(() => {
      const v = JSON.parse(localStorage.getItem('av.tour')); v['s.cfg-hist'] = 1; v['s.ferr-edicao'] = 1;
      localStorage.setItem('av.tour', JSON.stringify(v));
    });
    await pg.click('#tourBtn');   // liga de novo: fecha a folha e refaz o tour do estado
    const rf = await esperarTour(pg, 'simples', 5000);
    const c3 = await caixa();
    checar(rf === true && c3.ativo && c3.off === null && !c3.folha && c3.estado === 'on',
      'L · tocar de novo LIGA: a folha fecha e o tour da tela abre na hora', porque(rf) || JSON.stringify(c3));
    const zerou = await pg.evaluate(() => JSON.parse(localStorage.getItem('av.tour')));
    checar(rf === true && await pg.evaluate(() => !document.getElementById('fadePopup').classList.contains('open')),
      'F · no Fácil destravado o botão fecha Configurações e refaz o tour dos CONTROLES', porque(rf));
    checar(!zerou['s.cfg-hist'] && !zerou.conexao && zerou['s.ferr-edicao'] === 1,
      'F · e ZERA o Modo Fácil: as seções dele voltam a se explicar ao abrir; a do editor, que só existe no avançado, fica', JSON.stringify(zerou));
    // "Pular tour": o MESMO interruptor, por dentro do balão.
    const rotuloPular = await pg.evaluate(() => document.querySelector('#tour .tour-pular').textContent);
    await pg.click('#tour .tour-pular');
    await esperar(pg, () => !AVTour.aberto());
    const sp = await pg.evaluate(() => ({ off: localStorage.getItem('av.tour.off'), ativo: AVTour.ativo(),
      estado: document.getElementById('tourBtn').dataset.estado, alt: document.getElementById('tourBtn').classList.contains('qs-alt'),
      oculto: document.getElementById('tour').hidden }));
    checar(rotuloPular === 'Pular tour' && sp.off === '1' && !sp.ativo && sp.oculto && sp.estado === 'off' && !sp.alt,
      'L · "Pular tour" fecha o balão e DESLIGA o tour por inteiro; o quadrado de Configurações acompanha', JSON.stringify([rotuloPular, sp]));
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

    // ---------------- H2 · `modos` é porteiro: no Fácil, nenhum tour de seção do Avançado ----------------
    // Com algo no ar a Biblioteca NÃO está encaixada (`simplesBibliotecaDocada()` falso): aberta pelo campo de busca,
    // ela é uma janela por cima da leitura e `secaoDoTour()` devolve `biblioteca` — seção do AVANÇADO (`modos: ['full']`).
    // O vigia só olhava a marca e o bloqueio: o tour dela abria dentro do Fácil, com o texto do Avançado ("voltar ao
    // Cronograma", "as opções"). Medido em 14/11: abria em ~1 s com 4 passos.
    await pg.evaluate(() => { const v = {}; for (const k of AVTour.chaves()) if (k !== 's.biblioteca') v[k] = 1; localStorage.setItem('av.tour', JSON.stringify(v)); AVTour.armar(); });
    await pg.evaluate(() => openHymnSearch());
    const secH2 = await esperar(pg, () => secaoDoTour() === 'biblioteca', null, 3000);
    await pg.waitForTimeout(2500);   // AUSÊNCIA: o automático leva ~1 s (700 ms + o tique de 300 ms)
    const estH2 = await estado(pg);
    checar(secH2 === true && estH2 === null, 'H2 · no Fácil, a Biblioteca aberta por cima da leitura NÃO abre o tour de seção do Avançado (`modos` é porteiro)',
      (porque(secH2) || 'seção biblioteca à vista') + ' · ' + JSON.stringify(estH2));
    await pg.evaluate(() => closeHymnSearch());
    await ctx.close();
  }

  // ---------------- C · avançado, tema claro: o tour COMPLETO ----------------
  {
    const { ctx, pg } = await abrir({ width: 390, height: 860 }, { avancado: true, tema: 'claro' });
    const r = await esperarTour(pg, 'avancado');
    checar(r === true, 'C · no avançado o tour completo abre SOZINHO na primeira vez', porque(r));
    const pc = await percorrer(pg);
    const alvos = pc.map((m) => [].concat(m.alvo).join('+'));
    // O DECK, UM A UM (v1.14.20): a barra, a prévia com as setas, o grupo de tocar (sem o repetir e a
    // playlist, que abrem a fileira) e cada exclusivo do Avançado têm o próprio balão.
    const quer = ['#library', '#cronoTitulo', '#itinBarBtn', '#bibleBtn', '#toolsBtn', '#libBar',
      '.np-seek', '#slidePrevBtn+#preview+#slideNextBtn', '#prev+#playpause+#next+#stop', '#repeat', '#plBtn',
      '#lyricsViewBtn', '#viewToggle', '#muteToggle', '#pvFullBtn', '#pvCastBtn', '#settingsBtn'];
    checar(quer.every((a) => alvos.includes(a)) && !alvos.includes('#seek+.transport') && !alvos.includes('#cronoImportar'),
      'C · Cronograma, troca (e nada de Importar na barra do topo: ele mora na Biblioteca desde a v1.14.40), a porta do Itinerário, Bíblia, Ferramentas, Biblioteca, o deck um a um (barra, prévia e setas, tocar, playlist, repetir, auxiliar, cobrir, mutar, tela cheia), conectar e Configurações', alvos.join(' '));
    // A PORTA DO ITINERÁRIO (Pacote 35): a faixa nasce recolhida e não desenha nada, então o passo é o do
    // `#itinBarBtn`, que mora NA barra do topo, sozinha na trilha 1 (o Importar saiu dela na v1.14.40). O tour
    // mostra na ordem da tela (linha a linha, `left` crescente): a porta, LOGO DEPOIS o nome do cronograma —
    // tudo antes da Bíblia. É o único lugar do tour onde o Itinerário se explica (não é ferramenta).
    const iPorta = alvos.indexOf('#itinBarBtn');
    const iTit = alvos.indexOf('#cronoTitulo');
    checar(iPorta > 0 && iTit === iPorta + 1 && iTit < alvos.indexOf('#bibleBtn')
      && pc[iPorta].titulo === 'Itinerário' && !!pc[iPorta].peca && recorteBate(pc[iPorta])
      && !alvos.includes('#itinBar'),
      'C · a porta do Itinerário (`#itinBarBtn`) tem o passo dela, logo ANTES do nome do cronograma (a ordem da tela) '
      + 'e antes da Bíblia, recortando o botão — e a faixa recolhida não tem passo', alvos.join(' '));
    // A PRÉVIA ANTES DOS BOTÕES QUE MORAM NELA (v1.14.21, pedido do operador): o passo da prévia com as setas
    // CONTÉM o Cobrir, o Mutar e a Tela cheia (e o Conectar, onde ele aparece) — a moldura vem antes.
    const tit = pc.map((m) => m.titulo);
    const iPrev = tit.indexOf('Prévia e setas');
    const naPrevia = pc.filter((m) => m.peca && ['#viewToggle', '#muteToggle', '#pvFullBtn', '#pvCastBtn'].includes([].concat(m.alvo).join('+')));
    checar(iPrev >= 0 && naPrevia.length >= 3 && naPrevia.every((m) => tit.indexOf(m.titulo) > iPrev),
      'C · a prévia com as setas se explica ANTES dos botões que moram sobre ela (Cobrir, Mutar, Tela cheia)', tit.join(' · '));
    // A PLAYLIST À ESQUERDA DO REPETIR (v1.14.21, pedido do operador): na tela e, por isso, no tour.
    const peca = (a) => (pc.find((m) => [].concat(m.alvo).join('+') === a) || {}).peca;
    const pPl = peca('#plBtn'), pRep = peca('#repeat');
    checar(!!pPl && !!pRep && pPl.r <= pRep.l + 1 && tit.indexOf('Playlist') < tit.indexOf('Repetição'),
      'C · a Playlist fica à ESQUERDA do Repetir, e o tour a explica antes', JSON.stringify([pPl, pRep]));
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
    // A LISTA SEM O "FECHAR" E COM O EDITAR MÍDIA (v1.14.20): a seta de sair é o mesmo retângulo da
    // porta que abriu, e o tile do editor (só no avançado) ganhou o passo dele.
    const titulosF = pf.map((m) => m.titulo);
    checar(titulosF.includes('Editar mídia') && !titulosF.includes('Fechar') && pf.length >= 4,
      'G2 · a lista de Ferramentas explica o Editar mídia e NÃO tem o passo "Fechar"', titulosF.join(' · '));
    // UM PASSO POR LINHA, com o tempo (três tiles) num recorte só: o tempo, Mensagens, Sorteio e o Editar mídia — QUATRO. O
    // Itinerário não é ferramenta (é opção do Cronograma, explicada no tour do avançado pelo `#itinBarBtn`), então
    // nenhum passo da lista o cita; a lista fechada reprova tanto o passo que sobra quanto o que falta.
    checar(titulosF.join(' | ') === 'Relógio, Cronômetro e Timer | Mensagens | Sorteio | Editar mídia',
      'G2 · a lista de Ferramentas tem QUATRO passos — o tempo, Mensagens, Sorteio e o Editar mídia — e nenhum é o do Itinerário', titulosF.join(' · '));
    await pular(pg);
    await pg.click('#ferrTile_timer');
    const rt = await esperarTour(pg, 's.ferr-timer');
    checar(rt === true, 'G2 · e abrir o Timer abre o tour DELE', porque(rt));
    const pt = rt === true ? await percorrer(pg) : [];
    checar(pt.length >= 2 && pt.every(recorteBate), 'G2 · o tour do Timer recorta as peças dele', JSON.stringify(pt.map((m) => [m.alvo, !!m.recorte])));
    // A ROLETA ANTES DA LEGENDA, e as três saídas num passo só (v1.14.20).
    const titulosT = pt.map((m) => m.titulo);
    checar(titulosT.includes('Escolher o tempo') && titulosT.indexOf('Escolher o tempo') < titulosT.indexOf('Legenda')
      && titulosT.includes('Telão, Cronograma e Favoritos') && !titulosT.includes('Projetar no telão'),
      'G2 · o tour do Timer explica a roleta ANTES da legenda e junta projetar e guardar num passo só', titulosT.join(' · '));
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
    checar(!zerouAv['s.ferramentas'] && !zerouAv['s.ferr-timer'] && zerouAv.conexao === 1 && zerouAv.avancado === 1,
      'F · e ZERA só o avançado: as seções dele voltam a se explicar; as do Fácil ficam como estavam', JSON.stringify(zerouAv));
    await pular(pg);

    // ---------------- I · a VARREDURA: toda seção do avançado acha as próprias peças ----------------
    // Os seletores das `SECOES` são texto: um id renomeado faria a seção abrir um
    // tour de balões centrais (ou nenhum). Cada uma é aberta como o operador a
    // abriria, e cada passo tem de recortar a peça.
    const VARRER = [
      ['biblia', 'abrirBiblia()', 'fecharBiblia()'],
      ['biblia-leitura', BIBLIA_ABRE, BIBLIA_FECHA],
      ['biblioteca', 'openHymnSearch()', 'closeHymnSearch()'],
      ['cronogramas', 'abrirCronoGaveta()', 'fecharCronoGaveta()'],
      ['conectar', 'abrirCast()', 'fecharCast()'],
      ['playlist', 'openPlPopup()', 'closePlPopup()'],
      ['sorteio', SORTEIO_ABRE, SORTEIO_FECHA],
      ['cfg-hist', 'openFadePopup(); abrirSecao("hist")', 'closeFadePopup()'],
      ['cfg-pacote', 'openFadePopup(); abrirSecao("pacote")', 'closeFadePopup()'],
      ['ferr-clock', 'abrirFerramenta("clock")', 'fecharFerramentas()'],
      ['ferr-stopwatch', 'abrirFerramenta("stopwatch")', 'fecharFerramentas()'],
      ['ferr-msg', MSG_ABRE, MSG_FECHA],
      ['ferr-edicao', 'abrirFerramenta("edicao")', 'fecharFerramentas()'],
      ['ferr-draw', 'abrirFerramenta("draw")', 'fecharFerramentas()'],
      ['letra', 'openLyricsPopup()', 'closeLyricsPopup()'],
      ['letra-cifra', CIFRA_ABRE, CIFRA_FECHA],
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
    // A LISTA DA PLAYLIST AUTOMÁTICA (v1.14.21): com as músicas sorteadas à vista, a lista e a marca de cada
    // linha têm passo — e o passo da lista (a moldura) vem antes do da linha, que mora dentro dela.
    await pg.evaluate((v) => { localStorage.setItem('av.tour', JSON.stringify(v)); AVTour.armar(); }, Object.assign({}, tudo, { 's.sorteio': 0 }));
    await pg.evaluate(SORTEIO_ABRE);
    const rS = await esperarTour(pg, 's.sorteio', 5000);
    const pS = rS === true ? await percorrer(pg) : [];
    const tS = pS.map((m) => m.titulo);
    await pg.evaluate(() => AVTour.aberto() && AVTour.fechar());
    await pg.evaluate(SORTEIO_FECHA);
    await esperar(pg, () => !secaoDoTour(), null, 3000);
    checar(rS === true && ['Músicas sorteadas', 'Marcar músicas', 'Quantas', 'Sortear de novo'].every((t) => tS.includes(t))
      && tS.indexOf('Músicas sorteadas') < tS.indexOf('Marcar músicas') && pS.every((m) => m.peca && recorteBate(m)),
      'I · a Playlist automática explica a lista sorteada e a marca de cada música, recortando a peça', (porque(rS) || 'abriu') + ' · ' + tS.join(' · '));

    // I2 · o editor que já ABRE NO FORMULÁRIO (uma mídia escolhida na memória) tem seção PRÓPRIA (v1.14.20):
    // `ferr-edicao-form` — a mídia, o trecho, os fades, o confirmar e os destinos. Com uma seção só, a marca gravava
    // na primeira abertura (que nasce na escolha) e o formulário nunca se explicava; e uma seção sem passo visível
    // não abre nem grava a marca, com o automático tentando de novo a cada segundo.
    await pg.evaluate((v) => { localStorage.setItem('av.tour', JSON.stringify(v)); AVTour.armar(); }, Object.assign({}, tudo, { 's.ferr-edicao-form': 0 }));
    await pg.evaluate(MIDIA_CRIA, WAV6);
    const origem = await pg.evaluate(EDICAO_FORM_ABRE);
    const rForm = await esperarTour(pg, 's.ferr-edicao-form', 5000);
    const form = await pg.evaluate(() => ({ vista: edicaoVista, passo: AVTour.aberto() ? AVTour.passoAtual().titulo : null,
      marca: JSON.parse(localStorage.getItem('av.tour'))['s.ferr-edicao-form'] || 0 }));
    const psForm = rForm === true ? await percorrer(pg) : [];
    const ruinsForm = psForm.filter((m) => !recorteBate(m)).map((m) => [].concat(m.alvo).join('+'));
    const titulosForm = psForm.map((m) => m.titulo);
    await pg.evaluate(() => AVTour.aberto() && AVTour.fechar());
    checar(origem === true && rForm === true && form.vista === 'form' && form.passo === 'Mídia escolhida' && form.marca === 1
      && ruinsForm.length === 0 && ['Trecho', 'Confirmar', 'Cronograma, playlist e Favoritos'].every((t) => titulosForm.includes(t)),
      'I2 · o editor aberto no formulário abre a seção PRÓPRIA dele (mídia, trecho, confirmar e destinos), recorta cada peça e grava a marca dela',
      'origem ' + origem + ' · ' + (porque(rForm) || 'abriu') + ' · ' + JSON.stringify(form) + ' · ' + titulosForm.join(' · ') + ' ' + ruinsForm.join(' | '));
    await pg.evaluate(() => fecharFerramentas());
    await esperar(pg, () => !ferramentasAbertas());

    // M · UMA MARCA POR VISTA (v1.14.20): a Bíblia abre na grade e o auxiliar de leitura, na Letra; escolher o versículo ou
    // tocar a aba "Cifra" muda o NOME da seção, o tour da vista antiga fecha e o da nova — ainda não visto — abre sozinho.
    // Com uma seção só, a marca gastava na primeira vista e a outra nunca se explicava.
    await pg.evaluate((v) => { localStorage.setItem('av.tour', JSON.stringify(v)); AVTour.armar(); },
      Object.assign({}, tudo, { 's.biblia': 0, 's.biblia-leitura': 0, 's.letra': 0, 's.letra-cifra': 0 }));
    await pg.evaluate('abrirBiblia()');
    const mGrade = await esperarTour(pg, 's.biblia', 5000);
    await pg.evaluate(BIBLIA_LEITURA);
    const mLeitura = await esperarTour(pg, 's.biblia-leitura', 5000);
    const marcasB = await pg.evaluate(() => JSON.parse(localStorage.getItem('av.tour')));
    await pg.evaluate(() => AVTour.aberto() && AVTour.fechar());
    await pg.evaluate(BIBLIA_FECHA);
    await esperar(pg, () => !secaoDoTour(), null, 3000);
    checar(mGrade === true && mLeitura === true && marcasB['s.biblia'] === 1 && marcasB['s.biblia-leitura'] === 1,
      'M · a grade da Bíblia se explica e, ao escolher o versículo, a LEITURA também: uma marca por vista',
      (porque(mGrade) || 'grade') + ' · ' + (porque(mLeitura) || 'leitura') + ' · ' + JSON.stringify([marcasB['s.biblia'], marcasB['s.biblia-leitura']]));
    await pg.evaluate(CIFRA_LETRA_ABRE);
    const mLetra = await esperarTour(pg, 's.letra', 5000);
    await pg.evaluate(CIFRA_ABA);
    const mCifra = await esperarTour(pg, 's.letra-cifra', 5000);
    const marcasC = await pg.evaluate(() => JSON.parse(localStorage.getItem('av.tour')));
    await pg.evaluate(() => AVTour.aberto() && AVTour.fechar());
    await pg.evaluate(CIFRA_FECHA);
    await esperar(pg, () => !secaoDoTour(), null, 3000);
    checar(mLetra === true && mCifra === true && marcasC['s.letra'] === 1 && marcasC['s.letra-cifra'] === 1,
      'M · a Letra se explica e, ao tocar a aba "Cifra", a CIFRA também: uma marca por vista',
      (porque(mLetra) || 'letra') + ' · ' + (porque(mCifra) || 'cifra') + ' · ' + JSON.stringify([marcasC['s.letra'], marcasC['s.letra-cifra']]));
    await ctx.close();
  }

  // ---------------- J · a ORDEM VISUAL, em todo tour, nos dois modos e duas telas ----------------
  // Cada tour é aberto à mão (`AVTour.abrir`) com a janela dele já assentada, e a
  // sequência mostrada é medida passo a passo.
  const AMBOS_J = [
    ['s.cfg-hist', 'openFadePopup(); abrirSecao("hist")', 'closeFadePopup()'],
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
    ['s.biblia-leitura', BIBLIA_ABRE, BIBLIA_FECHA],
    ['s.biblioteca', 'openHymnSearch()', 'closeHymnSearch()'],
    ['s.cronogramas', 'abrirCronoGaveta()', 'fecharCronoGaveta()'],
    ['s.playlist', 'openPlPopup()', 'closePlPopup()'],
    ['s.sorteio', SORTEIO_ABRE, SORTEIO_FECHA],
    ['s.ferramentas', 'abrirFerramentas()', 'fecharFerramentas()'],
    ['s.ferr-clock', 'abrirFerramenta("clock")', 'fecharFerramentas()'],
    ['s.ferr-stopwatch', 'abrirFerramenta("stopwatch")', 'fecharFerramentas()'],
    ['s.ferr-timer', 'abrirFerramenta("timer")', 'fecharFerramentas()'],
    ['s.ferr-msg', MSG_ABRE, MSG_FECHA],
    ['s.ferr-draw', 'abrirFerramenta("draw")', 'fecharFerramentas()'],
    // O editor de mídia é uma FERRAMENTA — a chave do tour é a do painel da folha
    // (`'ferr-' + ferramentaAtual()`) — e só existe no AVANÇADO: a lista das
    // Ferramentas do Fácil não tem o quadrado dele. Aberto sem mídia, é a vista
    // "escolha"; a do formulário (seção própria, `ferr-edicao-form`) vem logo abaixo, com a mídia que o `MIDIA_CRIA`
    // deixa na página — e DEPOIS da escolha, porque o editor reabre no formulário enquanto a mídia estiver na memória.
    ['s.ferr-edicao', 'abrirFerramenta("edicao")', 'fecharFerramentas()'],
    ['s.ferr-edicao-form', EDICAO_FORM_ABRE, 'fecharFerramentas()'],
    ['s.letra', 'openLyricsPopup()', 'closeLyricsPopup()'],
    ['s.letra-cifra', CIFRA_ABRE, CIFRA_FECHA],
  ];
  const ruinsJ = [], vistosJ = [];
  for (const viewport of [{ width: 390, height: 860 }, { width: 360, height: 640 }]) {
    for (const avancado of [false, true]) {
      // MOVIMENTO REDUZIDO: aqui se mede a ORDEM, e o trajeto entre passos é do bloco K. Sem transição,
      // cada passo assenta no quadro seguinte (v1.14.4) — e o arquivo volta a caber no teto do portão.
      const { ctx, pg } = await abrir(viewport, { avancado, reduzido: true });
      await pg.evaluate(() => { const v = {}; for (const k of AVTour.chaves()) v[k] = 1; localStorage.setItem('av.tour', JSON.stringify(v)); });
      if (avancado) await pg.evaluate(MIDIA_CRIA, WAV6);
      const linhaPx = await pg.evaluate(() => AVTour.LINHA_PX);
      if (!(linhaPx > 0)) ruinsJ.push('a régua da faixa não veio da página (AVTour.LINHA_PX = ' + linhaPx + ')');
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
        await pg.waitForTimeout(300);   // a janela assenta (transição) antes de o tour medir a ordem
        const abriu = pronto === true && await pg.evaluate((q) => AVTour.abrir(q), qual);
        if (!abriu) { ruinsJ.push(onde + ': não abriu (' + await pg.evaluate(() => secaoDoTour() + '/' + qualTour()) + ')'); }
        else {
          const ps = await percorrer(pg);
          vistosJ.push(onde + ': ' + ps.map((m) => (m.fixo ? '[' + m.titulo + ']' : m.titulo)).join(' · '));
          for (const r of foraDeOrdem(ps, linhaPx)) ruinsJ.push(onde + ': ' + r);
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
