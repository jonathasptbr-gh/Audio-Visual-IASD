#!/usr/bin/env node
// ============================================================================
// A IMPRESSÃO DO GUIA DE SONOPLASTIA EM A4 (site/sonoplastia; lote sem versão)
//
// O botão "Imprimir" do guia abre um diálogo com a prévia: o guia escolhido
// ("Por um dia" ou "Tempo integral") paginado em folhas A4 retrato, na ordem
// natural, em dois formatos — "A4 simples" (margens 18/18 mm) e "A4 fichário"
// (25 mm do lado do furo e 11 do outro, espelhadas nas páginas pares). A
// área útil (174 × 264 mm) tem DUAS colunas de 83,5 mm — a largura de um
// celular — com um vão de 7 mm: o texto enche a da esquerda, depois a da
// direita, e cada figura fica na largura da SUA coluna. Os capítulos seguem
// em sequência, sem página nova. Uma faixa de largura total leva o cabeçalho
// da trilha (no alto) e a tabela larga demais para uma coluna (4 colunas ou
// mais), onde ela cair: o que já está na página se reparte em duas colunas
// acima dela. A prévia É o que se imprime. O que este arquivo trava:
//  A. o diálogo tem só 2 guias × 2 formatos e abre em "Por um dia · A4 simples";
//     a caixa de cima tem o "?" (Como imprimir) no topo esquerdo e o fechar no
//     direito, numa faixa só deles, UMA linha de informação (páginas, folhas e
//     o ajuste da impressora) e o Imprimir por último, na base direita;
//  B. o PDF tem uma página A4 retrato (595 × 842 pt) por página do guia
//     (`window.livreto.paginas`), sem folha em branco a mais — o modo de
//     falhar calado é uma caixa 1 px mais alta que a folha;
//  C. com a mídia de impressão, cada página mede 210 × 297 mm e o texto fica
//     dentro das margens do formato, sem invadir a margem do furo; as duas
//     colunas medem 83,5 mm com 7 mm de vão e nada do que mora numa coluna
//     passa da largura dela (nada atravessa o vão); toda seta,
//     recorte, textura e <use> da prévia aponta para um recurso DENTRO do
//     diálogo e renderizado (o original em `main` some na impressão);
//  D. os dois formatos do mesmo guia, paginados do zero, dão o mesmo nº de
//     páginas e o mesmo índice (a área útil é a mesma);
//  E. nenhuma página vazia nem texto cortado no rodapé; cada capítulo começa
//     na coluna onde o anterior terminou, salvo quando o título e o 1º bloco
//     não cabem no resto dela; nenhum título de capítulo fica órfão no pé da
//     coluna; o índice aponta para a página onde o capítulo começa; a ordem
//     de leitura é a do guia e a coluna da esquerda enche antes da direita;
//     figura na largura da sua coluna e centrada nela, nunca na faixa; a faixa
//     só leva o cabeçalho da trilha e tabela larga; caixa, cartão, cartão de
//     problema, figura e tabela nunca partidos;
//  F. capa e rodapé com o nome real da trilha; sem aviso "não coube" do
//     motor nem erro de JavaScript;
//  G. o título "Imprimir o guia" fica no meio, entre o "?" e o fechar;
//     a 390 px nada rola de lado e, a 320, nada no diálogo (a página embaixo
//     ainda sobra 18 px no CI: fila, Pacote 8.2); com `?app=1` a faixa do "?"
//     e o tutorial desviam do "fechar" nativo (52 × 56 px), guia e formato
//     ficam abaixo dele, e o tutorial manda abrir no navegador.
//
//   node tools/guia-impressao.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas, RAIZ_SITE } from './arnes.mjs';

const servidor = servirEstatico(RAIZ_SITE);
await new Promise((r) => servidor.listen(0, r));
const GUIA = 'http://localhost:' + servidor.address().port + '/sonoplastia/';
const navegador = await abrirNavegador();
const avisos = [], erros = [];

// Páginas e tamanhos do PDF, lidos do próprio arquivo (o Chromium grava os
// dicionários de página sem compressão).
function lerPdf(buf) {
  const t = buf.toString('latin1');
  const paginas = [...t.matchAll(/\/Type\s*\/Page(?![s\w])/g)].length;
  const caixas = [...t.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)]
    .map((m) => [m[3] - m[1], m[4] - m[2]]);
  return { paginas, foraDoA4: caixas.filter(([w, h]) => Math.abs(w - 595.3) > 1.5 || Math.abs(h - 841.9) > 1.5).length, caixas: caixas.length };
}

// Geometria de cada página com a mídia de impressão (sem a escala da prévia).
const medirPaginas = (pg) => pg.evaluate(() => {
  const MM = 96 / 25.4;
  return [...document.querySelectorAll('#caderno-escala .pag')].map((p) => {
    const a = p.getBoundingClientRect(), c = p.querySelector('.pag-conteudo'), b = c.getBoundingClientRect();
    let esq = Infinity, dir = -Infinity, fundo = -Infinity;
    c.querySelectorAll('*').forEach((k) => {
      if (k instanceof SVGElement && k.tagName.toLowerCase() !== 'svg') return;
      const r = k.getBoundingClientRect();
      if (!r.width || !r.height) return;
      esq = Math.min(esq, r.left); dir = Math.max(dir, r.right); fundo = Math.max(fundo, r.bottom);
    });
    // o que mora numa coluna não passa da largura dela: nada atravessa o vão
    const cols = [...c.querySelectorAll(':scope > .pag-col')], vazam = [];
    cols.forEach((col) => {
      const q = col.getBoundingClientRect();
      col.querySelectorAll('*').forEach((k) => {
        if (k instanceof SVGElement && k.tagName.toLowerCase() !== 'svg') return;
        const r = k.getBoundingClientRect();
        if (r.width && r.height && (r.left < q.left - 0.5 || r.right > q.right + 0.5) && vazam.length < 3)
          vazam.push(k.tagName + ' ' + ((r.left - q.left) / MM).toFixed(1) + '/' + ((q.right - r.right) / MM).toFixed(1));
      });
    });
    return { w: a.width / MM, h: a.height / MM, esq: (esq - a.left) / MM, dir: (a.right - dir) / MM,
      corte: (fundo - b.bottom) / MM, vazam,
      cols: cols.map((k) => { const r = k.getBoundingClientRect(); return [(r.left - a.left) / MM, r.width / MM]; }),
      filhos: c.matches('.pag-capa') ? c.children.length : c.querySelectorAll(':scope > .pag-col > *, :scope > .pag-faixa > *').length };
  });
});

// Margens esperadas por página (1-based): simples 18/18; fichário 25/11 na ímpar e 11/25 na par.
const margens = (fmt, n) => (fmt === 'simples' ? [18, 18] : n % 2 ? [25, 11] : [11, 25]);

async function escolher(pg, attr, valor) {
  await pg.click(`.caderno-opc[${attr}="${valor}"]`);
  const chave = attr === 'data-guia' ? 'guia' : 'formato';
  await pg.waitForFunction(([k, v]) => window.livreto && window.livreto[k] === v, [chave, valor], { timeout: 60000 });
}

async function conferir(pg, guia, fmt, rotulo) {
  const L = await pg.evaluate(() => ({ ...window.livreto }));
  const pdf = lerPdf(await pg.pdf({ preferCSSPageSize: true, printBackground: true }));
  checar(pdf.paginas === L.paginas && pdf.caixas === L.paginas && pdf.foraDoA4 === 0,
    `B · ${rotulo}: o PDF tem ${L.paginas} páginas A4 retrato, uma por página do guia`, JSON.stringify({ pdf, paginas: L.paginas }));
  await pg.emulateMedia({ media: 'print' });
  const pags = await medirPaginas(pg);
  // seta (marker), recorte (clipPath), textura (pattern) e <use>: o alvo tem de morar no diálogo e
  // estar renderizado — o original fica em `main`, que some na impressão, e aí a seta não pinta
  const refs = await pg.evaluate(() => {
    const cad = document.getElementById('caderno'), SVG = 'http://www.w3.org/2000/svg';
    let n = 0; const ruins = [];
    document.querySelectorAll('#caderno-escala *').forEach((el) => {
      const ids = [];
      for (const a of el.attributes) {
        for (const m of a.value.matchAll(/url\(\s*['"]?#([^'")\s]+)/g)) ids.push(m[1]);
        if (a.name === 'href' && el.namespaceURI === SVG && a.value[0] === '#') ids.push(a.value.slice(1));
      }
      ids.forEach((id) => {
        n += 1;
        const t = document.getElementById(id);
        let ok = !!t && cad.contains(t);
        for (let q = t; ok && q; q = q.parentElement) if (getComputedStyle(q).display === 'none') ok = false;
        if (!ok && ruins.length < 4) ruins.push(el.tagName + ' → #' + id + (!t ? ' (inexistente)' : cad.contains(t) ? ' (oculto)' : ' (fora do diálogo)'));
      });
    });
    return { n, ruins };
  });
  await pg.emulateMedia({ media: null });          // 'screen' faria o page.pdf() seguinte sair com a mídia de tela
  checar(refs.n > 0 && refs.ruins.length === 0,
    `C · ${rotulo}: as ${refs.n} referências SVG da prévia (seta, recorte, textura, <use>) resolvem dentro do diálogo, renderizadas na impressão`,
    JSON.stringify(refs));
  const foraDoTamanho = pags.map((p, i) => [i + 1, p]).filter(([, p]) => Math.abs(p.w - 210) > 0.3 || Math.abs(p.h - 297) > 0.3);
  checar(pags.length === L.paginas && foraDoTamanho.length === 0,
    `C · ${rotulo}: na impressão cada página mede 210 × 297 mm`, JSON.stringify(foraDoTamanho.slice(0, 3)));
  // a capa é centrada: a régua das margens vale do índice em diante
  const invadem = pags.map((p, i) => [i + 1, p]).filter(([n, p]) => {
    if (n === 1) return false;
    const [e, d] = margens(fmt, n);
    return p.esq < e - 0.3 || p.dir < d - 0.3;
  });
  const encostam = { impar: Math.min(...pags.filter((_, i) => i > 0 && i % 2 === 0).map((p) => p.esq)),
    par: Math.min(...pags.filter((_, i) => i % 2 === 1).map((p) => p.esq)) };
  const [ei, ep] = [margens(fmt, 3)[0], margens(fmt, 2)[0]];
  checar(invadem.length === 0 && Math.abs(encostam.impar - ei) < 0.5 && Math.abs(encostam.par - ep) < 0.5,
    `C · ${rotulo}: o texto começa a ${ei} mm da borda nas ímpares e a ${ep} mm nas pares, sem invadir a margem`,
    JSON.stringify({ encostam, invadem: invadem.slice(0, 3) }));
  // da 2ª página em diante: pares de colunas de 83,5 mm, a da esquerda na margem, 7 mm de vão
  // (a faixa no meio da página abre um segundo par, abaixo dela)
  const colunasTortas = pags.map((p, i) => [i + 1, p]).filter(([n, p]) => {
    if (n === 1) return false;
    const e = margens(fmt, n)[0];
    return !p.cols.length || p.cols.length % 2
      || p.cols.some(([x, w], j) => Math.abs(x - (j % 2 ? e + 90.5 : e)) > 0.3 || Math.abs(w - 83.5) > 0.3);
  });
  const vazantes = pags.map((p, i) => (p.vazam.length ? (i + 1) + ': ' + p.vazam.join(', ') : 0)).filter(Boolean);
  checar(colunasTortas.length === 0 && vazantes.length === 0,
    `C · ${rotulo}: duas colunas de 83,5 mm com 7 mm de vão, e nada passa da largura da sua coluna (nem atravessa o vão)`,
    JSON.stringify({ colunasTortas: colunasTortas.slice(0, 2), vazantes: vazantes.slice(0, 3) }));
  const vazias = pags.map((p, i) => (p.filhos ? 0 : i + 1)).filter(Boolean);
  const cortadas = pags.map((p, i) => (p.corte > 0.3 ? (i + 1) + ':' + p.corte.toFixed(1) : 0)).filter(Boolean);
  checar(vazias.length === 0 && cortadas.length === 0,
    `E · ${rotulo}: nenhuma página vazia e nada passa da área útil (texto cortado no rodapé)`, JSON.stringify({ vazias, cortadas }));
  return L;
}

// Capítulos, índice, figuras e o que não se parte — mede a prévia montada.
const estrutura = (pg, guia) => pg.evaluate((guia) => {
  const MM = 96 / 25.4, esc = document.getElementById('caderno-escala');
  const pags = [...esc.querySelectorAll('.pag')];
  const oid = window.livreto.oidPag;
  const caps = Object.keys(oid).filter((k) => /^[di]\d+$/.test(k));
  const original = caps.length === document.querySelectorAll('#' + guia + ' > section.cap').length;
  // capítulos em sequência: medidas do motor (altura com margens; o que sobra numa coluna)
  const colsTodas = [...esc.querySelectorAll('.pag-col')];
  const LINHA = parseFloat(getComputedStyle(colsTodas[0]).lineHeight) || 20;
  const altK = (k) => { const cs = getComputedStyle(k); return k.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom); };
  const livreDe = (c) => c.clientHeight - [...c.children].reduce((t, k) => t + altK(k), 0);
  const comRespiro = esc.querySelector('.pag-col > .lb-cap:not(:first-child)');
  const respiro = comRespiro ? parseFloat(getComputedStyle(comRespiro).marginTop) : 0;
  const ordemCaps = [...document.querySelectorAll('#' + guia + ' > section.cap')].map((s) => s.id).filter((k) => k in oid);
  const titulos = [...esc.querySelectorAll('.pag-col h2 .cod, .pag-faixa h2 .cod')];
  const pulos = [], orfaos = [], capPag = {};
  ordemCaps.forEach((k, idx) => {
    const c = titulos.find((x) => x.textContent.trim() === k.toUpperCase()), h = c && c.closest('h2');
    if (!h) { pulos.push(k + ': sem título'); return; }
    capPag[k] = pags.indexOf(h.closest('.pag')) + 1;
    const col = h.closest('.pag-col');
    if (!col) return;
    let topo = h; while (topo.parentElement !== col) topo = topo.parentElement;
    // órfão: logo depois do título, na mesma coluna, tem de vir o 1º bloco (fora o resumo) ou ~3 linhas
    const depois = [];
    for (let n = h; n && n !== col; n = n.parentElement) for (let x = n.nextElementSibling; x; x = x.nextElementSibling) depois.push(x);
    const ult = col.lastElementChild, abaixo = ult.offsetTop + ult.offsetHeight - (h.offsetTop + h.offsetHeight);
    if (!depois.some((x) => !x.matches('p.resumo')) && abaixo < 2.7 * LINHA) orfaos.push(k + ': ' + Math.round(abaixo) + ' px');
    // pulou: abriu uma coluna nova (não logo depois de uma faixa) com espaço na anterior para título + 1º bloco
    if (idx === 0 || topo.previousElementSibling) return;
    if (col.previousElementSibling && col.previousElementSibling.matches('.pag-faixa')) return;
    const ant = colsTodas[colsTodas.indexOf(col) - 1];
    if (!ant) return;
    const prox = topo.nextElementSibling;
    const precisa = altK(topo) + respiro + Math.max(prox ? altK(prox) : 0, 3 * LINHA), livre = livreDe(ant);
    if (livre >= precisa + 3) pulos.push(k + ': sobravam ' + Math.round(livre) + ' px para ' + Math.round(precisa));
  });
  const indice = [...esc.querySelectorAll('.lb-ind li')].map((li) =>
    [li.querySelector('.ic').textContent.trim().toLowerCase(), li.querySelector('.lb-pg').textContent.replace(/\D/g, '')]);
  const indiceErrado = indice.filter(([k, n]) => String(oid[k]) !== n || String(capPag[k]) !== n);
  // figura: na largura da SUA coluna e centrada nela (a prévia está escalada: k)
  const figuras = [...esc.querySelectorAll('figure.ilus > svg')].map((s) => {
    const col = s.closest('.pag-col');
    if (!col) return { faixa: true };
    const r = s.getBoundingClientRect(), b = col.getBoundingClientRect();
    const pag = s.closest('.pag'), k = pag.getBoundingClientRect().width / pag.offsetWidth;
    return { larg: r.width / k / MM, col: b.width / k / MM, desvio: Math.abs((r.left - b.left) - (b.right - r.right)) / k / MM };
  });
  const conta = (raiz, s) => raiz.querySelectorAll(s).length;
  const orig = document.getElementById(guia);
  // ordem de leitura: os ids do guia aparecem na prévia (faixa, coluna da esquerda, da direita) na ordem do original
  const pos = new Map([...orig.querySelectorAll('[id]')].map((e, i) => [e.id, i]));
  const seq = [...esc.querySelectorAll('[data-oid]')].map((e) => pos.get(e.getAttribute('data-oid'))).filter((i) => i !== undefined);
  const foraDeOrdem = seq.filter((v, i) => i && v < seq[i - 1]).length;
  // a da esquerda enche antes: com a direita ocupada, o que sobrou embaixo na esquerda é menor que o 1º bloco
  // da direita (+ 90 px de folga); se esse 1º bloco é um título, ele foi junto com o começo do bloco seguinte
  // (nunca órfão): conta-se o título, o respiro e o bloco seguinte. O índice de uma página se reparte nas duas
  // colunas de propósito e fica de fora
  const alt = (k) => { const cs = getComputedStyle(k); return k.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom); };
  const esqDepois = [];
  pags.forEach((p, i) => {
    const cs = [...p.querySelectorAll(':scope > .pag-conteudo > .pag-col')];
    for (let j = 0; j + 1 < cs.length; j += 2) {
      const e = cs[j], d = cs[j + 1];
      if (!d.childElementCount || p.querySelector('.lb-ind')) continue;
      if (!e.childElementCount) { esqDepois.push((i + 1) + ': esquerda vazia'); continue; }
      const d0 = d.firstElementChild, livre = e.clientHeight - [...e.children].reduce((t, k) => t + alt(k), 0);
      let prim = alt(d0);
      if (d0.matches('.lb-cap') || /^H[1-6]$/.test(d0.tagName)) {
        prim += (d0.matches('.lb-cap') ? respiro : 0) + Math.max(d0.nextElementSibling ? alt(d0.nextElementSibling) : 0, 3 * LINHA);
      }
      if (livre >= prim + 94) esqDepois.push((i + 1) + ': sobram ' + Math.round(livre) + ' px para ' + Math.round(prim));
    }
  });
  // faixa: só o cabeçalho da trilha e a tabela larga (4 colunas ou mais, ou que passa da largura de uma coluna)
  const faixas = [...esc.querySelectorAll('.pag-faixa')];
  const largaDeVerdade = (t) => {
    const tr = t.querySelector('thead tr') || t.querySelector('tr');
    if (tr && tr.children.length >= 4) return true;
    const c = t.cloneNode(true), col = t.closest('.pag').querySelector('.pag-col');
    col.appendChild(c); const passa = c.querySelector('table').offsetWidth > c.clientWidth + 1; c.remove();
    return passa;
  };
  const tabFaixa = faixas.flatMap((f) => [...f.querySelectorAll('.tabela')]);
  const faixaMal = faixas.filter((f) => f.querySelector('figure, svg, img') || !(f.querySelector('.trilha-cab') || f.querySelector('.tabela'))).length
    + tabFaixa.filter((t) => !largaDeVerdade(t)).length;
  return {
    caps: caps.length, original, pulos, orfaos, indice: indice.length, indiceErrado,
    figLarga: figuras.filter((f) => !f.faixa && f.larg > f.col + 0.3).length, figTorta: figuras.filter((f) => !f.faixa && f.desvio > 1).length,
    figFaixa: figuras.filter((f) => f.faixa).length, figuras: figuras.length,
    larguraCol: Math.max(0, ...figuras.filter((f) => !f.faixa).map((f) => f.col)),
    foraDeOrdem, ordenados: seq.length, esqDepois, faixas: faixas.length, tabFaixa: tabFaixa.length, faixaMal,
    inteiros: ['.box', '.cartao', 'details', 'figure.ilus', '.tabela', '.d-10s'].map((s) => [s, conta(orig, s), conta(esc, s + ':not(.lb-fat)')]),
    fatias: conta(esc, '.lb-fat'),
    capa: pags[0].querySelector('h1').textContent.trim(),
    rodape: pags[2].querySelector('.pag-rod').textContent.replace(/\s+/g, ' ').trim(),
    trilha: document.querySelector('#' + guia + ' .trilha-cab h2').textContent.replace(/^Trilha\s+\d+\s*·\s*/, '').trim(),
  };
}, guia);

try {
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 800 } });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') avisos.push(m.text().slice(0, 160)); });
  await pg.goto(GUIA, { waitUntil: 'load' });
  await pg.click('#btn-imp');
  await pg.waitForFunction(() => window.livreto && window.livreto.paginas > 2, null, { timeout: 60000 });

  const barra = await pg.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    const tut = document.getElementById('caderno-tut'), cab = r('.caderno-cab'), bar = r('.caderno-bar'), imp = r('#caderno-print');
    const botoes = [...document.querySelectorAll('.caderno-bar button')];
    const resto = [...document.querySelectorAll('.caderno-bar *')].filter((e) => e.id !== 'caderno-print' && e.getClientRects().length);
    return {
      opcoes: [...document.querySelectorAll('.caderno-bar .caderno-opc')].map((b) => b.textContent.trim() + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')),
      outros: document.querySelectorAll('.caderno-bar select, [data-modo], [data-met]').length,
      tutorial: tut.textContent.trim() + '|' + tut.getAttribute('aria-label'),
      rotulo: document.getElementById('btn-imp').getAttribute('aria-label'),
      info: document.getElementById('caderno-info').textContent,
      linhas: document.querySelectorAll('.caderno-bar p, .caderno-bar span:not(.caderno-tit):not(.caderno-grupo-t), .caderno > p, #caderno-dica').length,
      cab: [...document.querySelectorAll('.caderno-cab button')].map((b) => b.id).join(','),
      cantos: [Math.round(r('#caderno-tut').left - cab.left), Math.round(cab.right - r('#caderno-x').right)],
      ultimo: botoes[botoes.length - 1].id,
      imp: [Math.round(bar.right - imp.right), Math.round(Math.max(...resto.map((e) => e.getBoundingClientRect().bottom)) - imp.bottom),
        Math.round(imp.top - r('.caderno-grupos').bottom)],
    };
  });
  checar(barra.opcoes.join('|') === 'Por um dia*|Tempo integral|A4 simples*|A4 fichário' && barra.outros === 0,
    'A · só 2 guias × 2 formatos, e o diálogo abre em "Por um dia · A4 simples"', JSON.stringify(barra.opcoes));
  checar(barra.tutorial === '?|Como imprimir' && barra.rotulo === 'Imprimir o guia em folhas A4',
    'A · o "Como imprimir" é um "?" compacto e o botão do guia se anuncia como impressão em folhas A4', JSON.stringify(barra));
  checar(barra.cab === 'caderno-tut,caderno-x' && barra.cantos.every((d) => d <= 1),
    'A · o "?" no topo esquerdo e o fechar no topo direito, numa faixa só deles', JSON.stringify(barra));
  checar(barra.ultimo === 'caderno-print' && barra.imp[0] <= 12 && barra.imp[1] <= 1 && barra.imp[2] >= 0,
    'A · o Imprimir é o último da caixa: base direita, abaixo de guia e formato', JSON.stringify(barra.imp));
  checar(barra.linhas === 1 && /^\d+ páginas: \d+ folhas numa face ou \d+ em frente e verso \(borda longa\)\. Imprima em A4 retrato, escala 100%, margens padrão\.$/.test(barra.info),
    'A · UMA linha de informação: páginas, folhas e o ajuste da impressora', JSON.stringify(barra));

  // dia: paginado no simples · integral: paginado no fichário · e o cruzado de cada um
  const dS = await conferir(pg, 'dia', 'simples', 'Por um dia · A4 simples');
  const eDia = await estrutura(pg, 'dia');
  await escolher(pg, 'data-fmt', 'fich');
  await conferir(pg, 'dia', 'fich', 'Por um dia · A4 fichário');
  checar(/^\d+ páginas: \d+ folhas em frente e verso, virando na borda longa\. Imprima em A4 retrato, escala 100%, margens padrão\.$/.test(await pg.textContent('#caderno-info')),
    'A · no fichário a linha conta folhas em frente e verso e pede a borda longa', await pg.textContent('#caderno-info'));
  await escolher(pg, 'data-guia', 'integral');
  const iF = await conferir(pg, 'integral', 'fich', 'Tempo integral · A4 fichário');
  const eInt = await estrutura(pg, 'integral');
  await escolher(pg, 'data-guia', 'dia');
  const dF = await pg.evaluate(() => ({ ...window.livreto }));
  await escolher(pg, 'data-fmt', 'simples');
  await escolher(pg, 'data-guia', 'integral');
  const iS = await conferir(pg, 'integral', 'simples', 'Tempo integral · A4 simples');
  for (const [nome, a, b] of [['Por um dia', dS, dF], ['Tempo integral', iS, iF]]) {
    checar(a.paginas === b.paginas && JSON.stringify(a.oidPag) === JSON.stringify(b.oidPag),
      `D · ${nome}: paginado do zero nos dois formatos, mesmo nº de páginas e mesmo índice`,
      JSON.stringify({ simples: a.paginas, fichario: b.paginas }));
  }

  for (const [nome, e] of [['Por um dia', eDia], ['Tempo integral', eInt]]) {
    checar(e.original && e.pulos.length === 0,
      `E · ${nome}: os ${e.caps} capítulos seguem em sequência: cada um começa na coluna onde o anterior terminou, salvo quando o título e o 1º bloco não cabem no resto dela`,
      JSON.stringify({ pulos: e.pulos.slice(0, 4), original: e.original }));
    checar(e.orfaos.length === 0,
      `E · ${nome}: nenhum título de capítulo fica órfão no pé da coluna (vem com o 1º bloco ou ~3 linhas)`, JSON.stringify(e.orfaos.slice(0, 4)));
    checar(e.indice === e.caps && e.indiceErrado.length === 0,
      `E · ${nome}: o índice aponta para a página onde cada capítulo começa`, JSON.stringify(e.indiceErrado.slice(0, 4)));
    checar(e.figuras > 0 && e.figLarga === 0 && e.figTorta === 0 && e.figFaixa === 0 && Math.abs(e.larguraCol - 83.5) < 0.5,
      `E · ${nome}: as ${e.figuras} figuras ficam na largura da sua coluna (83,5 mm), centradas nela, e nenhuma na faixa`,
      JSON.stringify({ figLarga: e.figLarga, figTorta: e.figTorta, figFaixa: e.figFaixa, larguraCol: e.larguraCol }));
    checar(e.ordenados > 50 && e.foraDeOrdem === 0 && e.esqDepois.length === 0,
      `E · ${nome}: a ordem de leitura é a do guia (${e.ordenados} trechos) e a coluna da esquerda enche antes da direita`,
      JSON.stringify({ foraDeOrdem: e.foraDeOrdem, esqDepois: e.esqDepois.slice(0, 3) }));
    checar(e.faixas >= 1 && e.faixaMal === 0,
      `E · ${nome}: a faixa de largura total só leva o cabeçalho da trilha e tabela larga (${e.faixas} faixas, ${e.tabFaixa} tabelas)`,
      JSON.stringify({ faixas: e.faixas, tabFaixa: e.tabFaixa, faixaMal: e.faixaMal }));
    const partidos = e.inteiros.filter(([, o, p]) => o !== p);
    checar(partidos.length === 0 && e.fatias === 0,
      `E · ${nome}: nenhuma caixa, cartão, cartão de problema, figura ou tabela partida`, JSON.stringify({ partidos, fatias: e.fatias }));
    checar(e.capa === e.trilha && e.rodape.includes(e.trilha) && /· 3$/.test(e.rodape),
      `F · ${nome}: capa e rodapé com o nome da trilha ("${e.trilha}") e o nº da página`, JSON.stringify({ capa: e.capa, rodape: e.rodape }));
  }
  await ctx.close();

  // G. celular: sem rolagem de lado; pelo app, o desvio do "fechar" nativo (52 × 56) e o aviso
  for (const [larg, app] of [[390, false], [390, true], [320, true]]) {
    const c = await navegador.newContext({ viewport: { width: larg, height: 844 } });
    await semRedeExterna(c);
    const p = await c.newPage();
    p.on('pageerror', (e) => erros.push(e.message));
    await p.goto(GUIA + (app ? '?app=1' : ''), { waitUntil: 'load' });
    await p.click('#btn-imp');
    await p.waitForFunction(() => window.livreto && window.livreto.paginas > 2, null, { timeout: 60000 });
    await p.click('#caderno-tut');
    const m = await p.evaluate(() => ({
      sobra: document.documentElement.scrollWidth - innerWidth,
      // só caixa que ROLA conta (a prévia corta o lado de propósito: overflow-x hidden)
      dialogo: Math.max(0, ...['#caderno', '#caderno-corpo', '#caderno-tut-p', '.tut-painel', '.tut-corpo']
        .map((s) => document.querySelector(s)).filter((e) => e && /auto|scroll/.test(getComputedStyle(e).overflowX))
        .map((e) => e.scrollWidth - e.clientWidth)),
      barra: (() => { const b = document.querySelector('.caderno-bar'); return b.scrollWidth - b.clientWidth; })(),
      recuo: parseFloat(getComputedStyle(document.querySelector('.caderno-cab')).paddingLeft),
      recuoTut: parseFloat(getComputedStyle(document.querySelector('.tut-cab')).paddingLeft),
      grupos: Math.round(document.querySelector('.caderno-grupos').getBoundingClientRect().top),
      titulo: Math.round(document.querySelector('.caderno-tit').getBoundingClientRect().width),
      // o meio do texto do título × o meio entre o "?" e o fechar
      centro: (() => {
        const t = document.querySelector('.caderno-tit'), rg = document.createRange(); rg.selectNodeContents(t);
        const x = rg.getBoundingClientRect(), a = document.getElementById('caderno-tut').getBoundingClientRect(),
          b = document.getElementById('caderno-x').getBoundingClientRect();
        return Math.round(((x.left + x.right) / 2 - (a.right + b.left) / 2) * 10) / 10;
      })(),
      aviso: getComputedStyle(document.querySelector('.tut-so-app')).display !== 'none',
      secoes: document.querySelectorAll('#caderno-tut-p .tut-met svg').length,
    }));
    // a 320 px a PÁGINA embaixo do diálogo ainda sobra 18 px no CI (fila, Pacote 8.2;
    // quem a cobra é o `guia-no-app` E): a essa largura mede-se só o diálogo
    checar(m.dialogo <= 1 && m.barra <= 1 && (larg < 390 || m.sobra <= 1) && m.secoes === 2 && m.titulo >= 90,
      `G · a ${larg} px${app ? ' (app)' : ''} o diálogo e o tutorial não rolam de lado e o título cabe`, JSON.stringify(m));
    checar(Math.abs(m.centro) <= 2,
      `G · a ${larg} px${app ? ' (app)' : ''} o título "Imprimir o guia" fica no meio, entre o "?" e o fechar`, JSON.stringify({ centro: m.centro }));
    checar(app ? m.recuo >= 51 && m.recuoTut >= 51 && m.grupos >= 56 && m.aviso : m.recuo < 51 && !m.aviso,
      app ? `G · a ${larg} px pelo app, a faixa do "?" e o tutorial desviam do "fechar" nativo, guia e formato ficam abaixo dele, e o tutorial manda abrir no navegador`
        : 'G · no navegador, sem recuo e sem o aviso do app', JSON.stringify(m));
    await c.close();
  }

  checar(!avisos.some((a) => /não coube|montagem falhou/.test(a)), 'F · o motor não avisa "não coube" nem falha', avisos.join(' | '));
  checar(erros.length === 0, 'F · sem erro de JavaScript', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
