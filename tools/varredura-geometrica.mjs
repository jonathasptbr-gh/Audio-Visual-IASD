#!/usr/bin/env node
// ============================================================================
// A VARREDURA GEOMÉTRICA — o app inteiro, em toda tela planejada.
//
// ## Por que ele existe
//
// Pedido do operador: *"faça a varredura completa no layout do app para que ele
// se torne responsivo geometricamente. vamos criar um padrão seguro de
// design."*
//
// O app não tem UMA media query de largura ou de altura. O que o segura hoje é
// o fluxo do CSS — que resolve quase tudo — mais 426 literais em `px` e 416 em
// `rem` espalhados pela folha do Controle. Isso funciona na tela em que cada
// desenho foi decidido e falha CALADO nas outras: nada lança, nada aparece no
// console, e o que sai é texto cortado no meio da linha ou dois controles
// pintados um por cima do outro. Foi assim que a folha da Bíblia chegou ao
// aparelho do operador com os dois defeitos de uma vez (v1.7.10).
//
// **Este arquivo NÃO é um oráculo — é uma RÉGUA.** Ele não reprova nada: abre
// cada superfície do app em cada combinação de tela × escala de fonte e
// IMPRIME o que mediu. O portão do CI vem depois, e vem sobre o que esta
// varredura tiver mostrado ser verdade — escrever a asserção antes de medir é
// como o desenho da Bíblia nasceu.
//
// ## As cinco sondas, e por que cada uma
//
//  · **T1 · FORA DA JANELA.** Elemento visível cuja caixa passa da borda
//    lateral da tela, sem nenhum ancestral que role na horizontal. É o defeito
//    que o operador vê como "cortado".
//  · **T2 · IRMÃOS SOBREPOSTOS NUMA LINHA.** Dois filhos EM FLUXO de um
//    contêiner `flex-direction: row` cujas caixas se cruzam. É a barra da
//    Bíblia pintando por cima dos botões de guardar, e é sempre falta de
//    espaço — nunca uma escolha.
//  · **T3 · CORTE SERRADO.** Caixa com `overflow` escondido cujo conteúdo não
//    cabe, SEM `-webkit-line-clamp` engatado (o clamp maior que o número de
//    linhas que cabem NÃO engata: quem corta é o `overflow`, no meio da linha)
//    e sem máscara. O corte existe; o que se pergunta é se ele foi desenhado.
//  · **T4 · ALVO DE TOQUE.** Controle visível abaixo do piso `--hit`.
//  · **T5 · CAIXA FIXA FORA DA TELA.** Uma camada `fixed` cuja caixa não cabe
//    na janela: conteúdo inalcançável, porque `fixed` não rola.
//
// As sondas, as superfícies e o cenário moram em `tools/geometria.mjs`, que
// este arquivo divide com o PORTÃO (`tools/geometria.test.mjs`) — duas cópias
// divergiriam no primeiro ajuste, e a divergência seria muda. A prova de que
// cada sonda está VIVA está no cabeçalho de lá.
//
// ## O que ele NÃO mede
//
// Paisagem (o app é retrato por manifesto), contraste (é do `smoke.mjs`) e
// qualquer coisa que dependa de rede — `semRedeExterna` corta a saída, e o
// cenário é semeado à mão.
//
//   node tools/varredura-geometrica.mjs            # tudo
//   node tools/varredura-geometrica.mjs biblia     # só as superfícies que casam
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperar, esperarCortina } from './arnes.mjs';
import { TELAS, SUPERFICIES, SONDA, SEMENTE, ROTULO, PISOS } from './geometria.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)),
  '..', 'app', 'src', 'main', 'assets', 'web');



const filtro = process.argv[2] || '';
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();



// ---------------------------------------------------------------------------
const relatorio = [];
for (const t of TELAS) {
  const ctx = await navegador.newContext({ viewport: { width: t.w, height: t.h } });
  await semRedeExterna(ctx);
  await ctx.addInitScript(() => {
    try { localStorage.setItem('av.appMode', 'full'); } catch (_) { /* storage bloqueado */ }
  });
  if (t.fonte) {
    await ctx.addInitScript((f) => {
      addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.fontSize = (16 * f) + 'px';
      });
    }, t.fonte);
  }
  for (const s of SUPERFICIES) {
    if (filtro && !s.nome.includes(filtro)) continue;
    const pg = await ctx.newPage();
    const erros = [];
    pg.on('pageerror', (e) => erros.push(e.message));
    await pg.goto(base + '/controle/', { waitUntil: 'load' });
    await esperarCortina(pg);
    await esperar(pg, () => window.AVDB && typeof window.__avBack === 'function', null, 30000);
    try {
      await pg.evaluate(SEMENTE);
      await pg.evaluate(s.abrir);
    } catch (e) {
      relatorio.push({ tela: t.nome, sup: s.nome, falha: 'não abriu: ' + e.message });
      await pg.close();
      continue;
    }
    // ASSENTAR É `getAnimations()`, nunca um relógio: uma folha medida no meio
    // do movimento devolve uma caixa que não existe (a regra do `smoke.mjs`).
    const pronto = await esperar(pg, (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      return !document.querySelectorAll('*').length
        || ![...document.querySelectorAll('*')].some((n) => n.getAnimations()
          .some((a) => a.playState === 'running'));
    }, s.alvo, 12000);
    if (pronto !== true) {
      relatorio.push({ tela: t.nome, sup: s.nome, falha: 'não assentou (' + s.alvo + ')' });
      await pg.close();
      continue;
    }
    await pg.waitForFunction(() => document.fonts.status === 'loaded').catch(() => {});
    const r = await pg.evaluate(SONDA, { pisos: PISOS });
    relatorio.push({ tela: t.nome, sup: s.nome, achados: r.achados, nos: r.nos, erros });
    await pg.close();
  }
  await ctx.close();
}
await navegador.close();
servidor.close();

// ---------------------------------------------------------------------------
// O RELATÓRIO
// ---------------------------------------------------------------------------
let total = 0;
const porChave = new Map();   // "T1 | onde | txt" -> {t, onde, txt, telas:[], pior}
for (const l of relatorio) {
  if (l.falha) { console.log('⚠  ' + l.sup + ' @ ' + l.tela + ' — ' + l.falha); continue; }
  for (const e of l.erros || []) console.log('⚠  pageerror em ' + l.sup + ' @ ' + l.tela + ': ' + e);
  for (const a of l.achados) {
    total++;
    const k = a.t + '|' + l.sup + '|' + a.onde + '|' + (a.txt || '');
    if (!porChave.has(k)) {
      porChave.set(k, { ...a, sup: l.sup, telas: [], pior: 0 });
    }
    const v = porChave.get(k);
    v.telas.push(l.tela);
    if (a.px > v.pior) { v.pior = a.px; v.piorTela = l.tela; }
  }
}

const porSup = new Map();
for (const v of porChave.values()) {
  if (!porSup.has(v.sup)) porSup.set(v.sup, []);
  porSup.get(v.sup).push(v);
}

// QUANTOS NÓS CADA SUPERFÍCIE MOSTROU. Uma que renderizou nada tem zero achado,
// e sem este número ela é indistinguível de uma que está limpa — que é o jeito
// mais silencioso de uma varredura mentir sobre si mesma.
const nosPorSup = new Map();
for (const l of relatorio) {
  if (l.falha) continue;
  const v = nosPorSup.get(l.sup) || { min: Infinity, max: 0, telas: 0 };
  v.min = Math.min(v.min, l.nos); v.max = Math.max(v.max, l.nos); v.telas++;
  nosPorSup.set(l.sup, v);
}

console.log('\n════════ VARREDURA GEOMÉTRICA ════════');
console.log(TELAS.length + ' telas × ' + SUPERFICIES.length + ' superfícies · '
  + total + ' ocorrências, ' + porChave.size + ' distintas\n');

if (PISOS.length) {
  console.log('── EXCEÇÕES AO PISO DE TOQUE (declaradas) ' + '─'.repeat(16));
  for (const p of PISOS) console.log('  ' + p.sel + ' → ' + p.piso + 'px\n    ' + p.porque);
  console.log('');
}

console.log('── O QUE CADA SUPERFÍCIE MOSTROU ' + '─'.repeat(25));
for (const s of SUPERFICIES) {
  const v = nosPorSup.get(s.nome);
  const n = porSup.get(s.nome);
  if (!v) { console.log('  ' + s.nome.padEnd(26) + '  — não abriu em tela nenhuma'); continue; }
  console.log('  ' + s.nome.padEnd(26) + '  ' + String(v.telas).padStart(2) + '/'
    + TELAS.length + ' telas · ' + (v.min === v.max ? v.min : v.min + '–' + v.max)
    + ' nós visíveis · ' + (n ? n.length + ' achado(s)' : 'limpa'));
}
console.log('');

for (const s of SUPERFICIES) {
  const lista = porSup.get(s.nome);
  if (!lista) continue;
  console.log('── ' + s.nome.toUpperCase() + ' ' + '─'.repeat(Math.max(2, 56 - s.nome.length)));
  lista.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : b.pior - a.pior));
  for (const v of lista) {
    const todas = v.telas.length === TELAS.length ? 'TODAS' : v.telas.join(', ');
    console.log('  [' + v.t + '] ' + ROTULO[v.t] + '  ' + v.pior + 'px  (' + v.piorTela + ')');
    console.log('       ' + v.onde + (v.extra ? '   · ' + v.extra : ''));
    if (v.txt) console.log('       “' + v.txt + '”');
    console.log('       telas: ' + todas);
  }
  console.log('');
}

const porTipo = new Map();
for (const v of porChave.values()) porTipo.set(v.t, (porTipo.get(v.t) || 0) + 1);
console.log('── PLACAR POR SONDA ' + '─'.repeat(38));
for (const t of Object.keys(ROTULO)) {
  console.log('  ' + t + ' ' + ROTULO[t].padEnd(24) + (porTipo.get(t) || 0));
}
