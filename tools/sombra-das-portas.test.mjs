#!/usr/bin/env node
// ============================================================================
// A SOMBRA DAS TRÊS PORTAS DO CRONOGRAMA SÓ EXISTE COM ITEM POR BAIXO DELAS (v1.12.19; transição v1.12.20)
//
// Pedido do operador: *"as sombras são muito marcantes quando não há itens atrás desses botões.
// Você consegue condicionar a sombra apenas para quando há realmente itens em baixo deles?"*
// A sombra descreve SOBREPOSIÇÃO. O que este arquivo trava, e cada uma falha CALADA:
//  A. lista VAZIA: sem sombra;
//  B. lista CURTA (não chega às portas): sem sombra;
//  C. lista LONGA no topo (itens correndo por baixo): COM sombra — a de sempre, `0 2px 8px`;
//  D. rolada até o FIM: o último item para uma folga ACIMA das portas, e sem item por baixo a sombra sai;
//  E. um pouco antes do fim (o último item volta a cruzar o topo das portas): a sombra VOLTA;
//  F. lista que ENCOLHE (itens apagados) volta ao sem-sombra sem ninguém rolar — o render não dispara
//     `scroll` nem `ResizeObserver`, e é o caminho que uma marca só do scroll perderia;
//  G. a sombra entra e sai por TRANSIÇÃO (v1.12.20, *"surgir de forma gradual"*): declarada nas três portas e,
//     medida quadro a quadro, passa por valores intermediários.
//
//   node tools/sombra-das-portas.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, checar, comModoAvancado } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port + '/controle/index.html';
const navegador = await abrirNavegador();
const erros = [];
try {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
  await semRedeExterna(ctx);
  await comModoAvancado(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base, { waitUntil: 'load' });
  await esperarCortina(pg);

  const sombras = () => pg.evaluate(() => {
    const portas = [...document.querySelectorAll('#listFoot .lib-foot-btn, #listFoot .import-btn, #listFoot .tools-btn')];
    return { n: portas.length, sombras: [...new Set(portas.map((b) => getComputedStyle(b).boxShadow))] };
  });
  const comSombra = (s) => s.n === 3 && s.sombras.length === 1 && s.sombras[0] !== 'none';
  const semSombra = (s) => s.n === 3 && s.sombras.length === 1 && s.sombras[0] === 'none';
  const estado = (alvo) => esperar(pg, (a) => {
    const portas = [...document.querySelectorAll('#listFoot .lib-foot-btn, #listFoot .import-btn, #listFoot .tools-btn')];
    // A sombra entra e sai por TRANSIÇÃO (v1.12.20): o valor calculado passa por
    // intermediários, então "com sombra" só vale ASSENTADA (o 8px do desenho final).
    return portas.length === 3 && portas.every((b) => {
      const v = getComputedStyle(b).boxShadow;
      return a ? v === 'none' : v.includes(' 8px');
    });
  }, alvo, 8000);
  const semear = (n) => pg.evaluate(async (k) => {
    const z = (ms) => new Promise((f) => setTimeout(f, ms));
    for (let i = 0; i < k; i++) {
      await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
        { name: 'Louvor ' + i, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
    }
    await load(); await z(300);
  }, n);

  // A · vazia
  await pg.evaluate(() => { setAppMode('full'); });
  await esperar(pg, () => !!document.querySelector('#listFoot .import-btn'));
  checar(await estado(true) === true && semSombra(await sombras()),
    'A · com a lista VAZIA as três portas ficam sem sombra', JSON.stringify(await sombras()));

  // B · curta
  await semear(2);
  checar(await estado(true) === true && semSombra(await sombras()),
    'B · com DOIS itens (não chegam às portas) elas continuam sem sombra', JSON.stringify(await sombras()));

  // C · longa, no topo
  await semear(40);
  const topo = await estado(false);
  checar(topo === true && comSombra(await sombras()) && (await sombras()).sombras[0].includes('8px'),
    'C · com a lista LONGA no topo (itens correndo por baixo) a sombra de sempre está lá', JSON.stringify(await sombras()));

  // D · até o fim
  await pg.evaluate(() => { const l = document.getElementById('library'); l.scrollTop = l.scrollHeight; });
  checar(await estado(true) === true && semSombra(await sombras()),
    'D · rolada até o FIM o último item para acima das portas e a sombra sai', JSON.stringify(await sombras()));
  const folga = await pg.evaluate(() => {
    const u = document.getElementById('library').lastElementChild.getBoundingClientRect().bottom;
    return Math.round(document.querySelector('#listFoot .import-row').getBoundingClientRect().top - u);
  });
  checar(folga > 0, 'D · (premissa: no fim há folga real entre o último item e as portas, ' + folga + ' px)', String(folga));

  // E · um pouco antes do fim
  await pg.evaluate(() => { const l = document.getElementById('library'); l.scrollTop = l.scrollHeight - l.clientHeight - 120; });
  checar(await estado(false) === true && comSombra(await sombras()),
    'E · 120 px antes do fim o último item volta a passar por baixo e a sombra VOLTA', JSON.stringify(await sombras()));

  // F · encolhe sem rolar (o render troca filhos sem `scroll` nem `ResizeObserver`: só o MutationObserver vê)
  await pg.evaluate(() => { const l = document.getElementById('library'); l.scrollTop = 0; });
  await estado(false);
  await pg.evaluate(() => { const l = document.getElementById('library'); while (l.children.length > 2) l.lastElementChild.remove(); });
  checar(await estado(true) === true && semSombra(await sombras()),
    'F · a lista que ENCOLHE volta a ficar sem sombra sem ninguém rolar', JSON.stringify(await sombras()));

  // G · a entrada é GRADUAL: a transição está declarada e, no meio dela, o valor não é nem 'none' nem o final
  const decl = await pg.evaluate(() => [...document.querySelectorAll('#listFoot .lib-foot-btn, #listFoot .import-btn, #listFoot .tools-btn')]
    .map((b) => { const c = getComputedStyle(b); return c.transitionProperty.includes('box-shadow') && parseFloat(c.transitionDuration) > 0; }));
  checar(decl.length === 3 && decl.every(Boolean), 'G · as três portas declaram transição de sombra com duração', JSON.stringify(decl));
  await semear(40);
  await pg.evaluate(() => { const l = document.getElementById('library'); l.scrollTop = l.scrollHeight; });
  await estado(true);
  const meio = await pg.evaluate(async () => {
    const l = document.getElementById('library');
    const b = document.querySelector('#listFoot .tools-btn');
    l.scrollTop = 0;
    const vistos = new Set();
    const ini = performance.now();
    while (performance.now() - ini < 600) {
      await new Promise((f) => requestAnimationFrame(f));
      vistos.add(getComputedStyle(b).boxShadow);
    }
    return [...vistos];
  });
  checar(meio.length >= 3, 'G · entre "nenhuma" e a sombra final passa por valores intermediários (' + meio.length + ' vistos)', JSON.stringify(meio));

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}
