#!/usr/bin/env node
// ============================================================================
// AS DUAS PORTAS DO RODAPÉ TÊM PRESENÇA, E CABEM (v1.13.7).
//
// Pedido do operador: *"agora que temos mais espaço para os dois botões de biblia
// e ferramentas, verifique se conseguimos aumentar a fonte ou ao menos colocar
// elas em negrito desses dois botões. Sinto que eles estão com pouca presença."*
// As duas coisas: o rótulo em `--fs-lg` (era `--fs-md`) e em `--fw-forte`. O que
// este arquivo trava, nas células do relato e no pior caso comum de fonte:
//  A. o rótulo é NEGRITO (≥ 700) e mede `--fs-lg` (0,9 da raiz) — a presença;
//  B. ele NÃO é cortado: nem reticências, nem serra — "Ferramentas" é a palavra
//     mais longa, e a 360px · 1,3× ela tem ~2px de folga (a régua mede o SPAN
//     contra a própria caixa, que é o que o `text-overflow` corta);
//  C. a ALTURA da porta é a de sempre (`--hit-foot`, 42px) e igual nas duas — é
//     ela que a seta `#toolsFechar` copia, e é ela que a `.selbar` empata;
//  D. o par de tinta não mudou: `--accent` sobre `--surface-porta`.
//
//   node tools/portas-presenca.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, RAIZ_WEB, esperarCortina, esperar, checar, falhas, comModoAvancado, porque,
} from './arnes.mjs';

const TELAS = [
  { w: 430, h: 900, nome: '430×900' },
  { w: 360, h: 640, nome: '360×640' },
  { w: 360, h: 640, fonte: 1.25, nome: '360×640 · 1,25×' },
  { w: 360, h: 640, fonte: 1.30, nome: '360×640 · 1,3×' },
];

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const erros = [];
try {
  for (const t of TELAS) {
    const ctx = await navegador.newContext({ viewport: { width: t.w, height: t.h } });
    await semRedeExterna(ctx);
    await comModoAvancado(ctx);
    if (t.fonte) {
      await ctx.addInitScript((f) => {
        addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = (16 * f) + 'px'; });
      }, t.fonte);
    }
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => erros.push(t.nome + ': ' + e.message));
    await pg.goto(base + '/controle/', { waitUntil: 'load' });
    await esperarCortina(pg);
    const ok = await esperar(pg, () => document.querySelectorAll('#listFoot #bibleBtn, #listFoot #toolsBtn').length === 2, null, 15000);
    const m = await pg.evaluate(() => {
      const raiz = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const sonda = document.createElement('i');
      sonda.style.cssText = 'position:absolute;visibility:hidden;color:var(--accent);background-color:var(--surface-porta)';
      document.body.appendChild(sonda);
      const par = { cor: getComputedStyle(sonda).color, fundo: getComputedStyle(sonda).backgroundColor };
      sonda.remove();
      return {
        raiz, par,
        hitFoot: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit-foot')),
        portas: ['bibleBtn', 'toolsBtn'].map((id) => {
          const b = document.getElementById(id);
          const sp = b.querySelector('span');
          const cs = getComputedStyle(sp);
          const bs = getComputedStyle(b);
          return {
            id, h: Math.round(b.getBoundingClientRect().height * 10) / 10,
            fs: parseFloat(cs.fontSize), fw: +cs.fontWeight,
            spw: sp.scrollWidth, spc: sp.clientWidth,
            ico: Math.round(b.querySelector('svg').getBoundingClientRect().width),
            cor: bs.color, fundo: bs.backgroundColor,
          };
        }),
      };
    });
    console.log(t.nome, JSON.stringify(m.portas.map((p) => [p.id, p.fs + 'px', p.fw, p.spw + '/' + p.spc, p.h + 'px', p.ico + 'px'])));
    checar(ok === true, t.nome + ' · as duas portas estão no rodapé', porque(ok));
    checar(m.portas.every((p) => p.fw >= 700 && Math.abs(p.fs - 0.9 * m.raiz) < 0.05),
      'A · ' + t.nome + ' · o rótulo das duas portas é NEGRITO e mede `--fs-lg` (0,9 da raiz): a presença que o '
      + 'operador pediu', m.portas);
    checar(m.portas.every((p) => p.spw <= p.spc + 0.5),
      'B · ' + t.nome + ' · e o rótulo cabe inteiro, sem reticências ("Ferramentas" é o mais longo)', m.portas);
    checar(m.portas.every((p) => p.h === m.hitFoot) && m.portas[0].h === m.portas[1].h,
      'C · ' + t.nome + ' · e a porta mantém a altura do `--hit-foot`, igual nas duas (a seta das Ferramentas a '
      + 'copia, e a `.selbar` empata com ela)', { hitFoot: m.hitFoot, alturas: m.portas.map((p) => p.h) });
    checar(m.portas.every((p) => p.cor === m.par.cor && p.fundo === m.par.fundo),
      'D · ' + t.nome + ' · e o par de tinta é o de sempre: `--accent` sobre `--surface-porta`', { par: m.par, portas: m.portas });
    await ctx.close();
  }
  checar(erros.length === 0, 'nenhum erro de página', erros);
} catch (e) {
  checar(false, 'o oráculo rodou até o fim', e && e.stack || String(e));
} finally {
  await navegador.close();
  servidor.close();
}
if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
