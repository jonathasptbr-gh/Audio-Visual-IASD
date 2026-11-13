#!/usr/bin/env node
// ============================================================================
// A IMPRESSÃO DO GUIA DE SONOPLASTIA EM A4 (site/sonoplastia; lote sem versão)
//
// O botão "Imprimir" do guia abre um diálogo com a prévia: o guia escolhido
// ("Por um dia" ou "Tempo integral") paginado em folhas A4 retrato, na ordem
// natural, em dois formatos — "A4 simples" (margens 18/18 mm) e "A4 fichário"
// (25 mm do lado do furo e 11 do outro, espelhadas nas páginas pares). A
// prévia É o que se imprime. O que este arquivo trava:
//  A. o diálogo tem só 2 guias × 2 formatos e abre em "Por um dia · A4 simples";
//     a caixa de cima tem o "?" (Como imprimir) no topo esquerdo e o fechar no
//     direito, numa faixa só deles, UMA linha de informação (páginas, folhas e
//     o ajuste da impressora) e o Imprimir por último, na base direita;
//  B. o PDF tem uma página A4 retrato (595 × 842 pt) por página do guia
//     (`window.livreto.paginas`), sem folha em branco a mais — o modo de
//     falhar calado é uma caixa 1 px mais alta que a folha;
//  C. com a mídia de impressão, cada página mede 210 × 297 mm e o texto fica
//     dentro das margens do formato, sem invadir a margem do furo; toda seta,
//     recorte, textura e <use> da prévia aponta para um recurso DENTRO do
//     diálogo e renderizado (o original em `main` some na impressão);
//  D. os dois formatos do mesmo guia, paginados do zero, dão o mesmo nº de
//     páginas e o mesmo índice (a área útil é a mesma);
//  E. nenhuma página vazia nem texto cortado no rodapé; cada capítulo começa
//     em página nova e o índice aponta para ela; figura centrada e com até
//     ~120 mm; caixa, cartão de problema e tabela nunca partidos;
//  F. capa e rodapé com o nome real da trilha; sem aviso "não coube" do
//     motor nem erro de JavaScript;
//  G. a 390 px nada rola de lado e, a 320, nada no diálogo (a página embaixo
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
    return { w: a.width / MM, h: a.height / MM, esq: (esq - a.left) / MM, dir: (a.right - dir) / MM,
      corte: (fundo - b.bottom) / MM, filhos: c.children.length };
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
  const codNa = (n, cod) => pags[n - 1] && [...pags[n - 1].querySelector('.pag-conteudo').children].slice(0, 2)
    .some((k) => [...k.querySelectorAll('.cod')].concat(k.matches('.cod') ? [k] : []).some((c) => c.textContent.trim() === cod));
  const foraDoInicio = caps.filter((k) => !codNa(oid[k], k.toUpperCase()));
  const original = caps.length === document.querySelectorAll('#' + guia + ' > section.cap').length;
  const indice = [...esc.querySelectorAll('.lb-ind li')].map((li) =>
    [li.querySelector('.ic').textContent.trim().toLowerCase(), li.querySelector('.lb-pg').textContent.replace(/\D/g, '')]);
  const indiceErrado = indice.filter(([k, n]) => String(oid[k]) !== n);
  const figuras = [...esc.querySelectorAll('figure.ilus > svg')].map((s) => {
    const r = s.getBoundingClientRect(), c = s.closest('.pag-conteudo'), cs = getComputedStyle(c), b = c.getBoundingClientRect();
    const pag = s.closest('.pag'), k = pag.getBoundingClientRect().width / pag.offsetWidth;   // a prévia está escalada
    const e = (r.left - b.left) / k - parseFloat(cs.paddingLeft), d = (b.right - r.right) / k - parseFloat(cs.paddingRight);
    return { larg: r.width / k / MM, desvio: Math.abs(e - d) / MM };
  });
  const conta = (raiz, s) => raiz.querySelectorAll(s).length;
  const orig = document.getElementById(guia);
  return {
    caps: caps.length, original, foraDoInicio, indice: indice.length, indiceErrado,
    figLarga: figuras.filter((f) => f.larg > 121).length, figTorta: figuras.filter((f) => f.desvio > 1).length, figuras: figuras.length,
    inteiros: ['.box', 'details', 'figure.ilus', '.tabela'].map((s) => [s, conta(orig, s), conta(esc, s + ':not(.lb-fat)')]),
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
    checar(e.original && e.foraDoInicio.length === 0 && e.indice === e.caps && e.indiceErrado.length === 0,
      `E · ${nome}: os ${e.caps} capítulos começam em página nova e o índice aponta para ela`,
      JSON.stringify({ foraDoInicio: e.foraDoInicio, indiceErrado: e.indiceErrado.slice(0, 3), original: e.original }));
    checar(e.figuras > 0 && e.figLarga === 0 && e.figTorta === 0,
      `E · ${nome}: as ${e.figuras} figuras ficam centradas e com até ~120 mm`, JSON.stringify(e));
    const partidos = e.inteiros.filter(([, o, p]) => o !== p);
    checar(partidos.length === 0 && e.fatias === 0,
      `E · ${nome}: nenhuma caixa, cartão de problema, figura ou tabela partida`, JSON.stringify({ partidos, fatias: e.fatias }));
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
      aviso: getComputedStyle(document.querySelector('.tut-so-app')).display !== 'none',
      secoes: document.querySelectorAll('#caderno-tut-p .tut-met svg').length,
    }));
    // a 320 px a PÁGINA embaixo do diálogo ainda sobra 18 px no CI (fila, Pacote 8.2;
    // quem a cobra é o `guia-no-app` E): a essa largura mede-se só o diálogo
    checar(m.dialogo <= 1 && m.barra <= 1 && (larg < 390 || m.sobra <= 1) && m.secoes === 2 && m.titulo >= 90,
      `G · a ${larg} px${app ? ' (app)' : ''} o diálogo e o tutorial não rolam de lado e o título cabe`, JSON.stringify(m));
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
