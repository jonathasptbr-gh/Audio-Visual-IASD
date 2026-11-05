#!/usr/bin/env node
// ============================================================================
// O TEXTO DE UM CAPÍTULO DA BÍBLIA — `controle/bible.js` (revisão W3)
//
// O versículo vem de servidor de terceiro (o banco do LouvorJA) com marcação
// HTML, e o `stripHtml` o reduz a texto puro. Os dois modos de errar são
// MUDOS, e cada um já foi consertado sem oráculo:
//
//  1. **Uma entidade numérica fora da faixa LANÇA.** `String.fromCodePoint`
//     estoura acima de 0x10FFFF, a exceção sobe pelo `parseChapter` e leva o
//     capítulo INTEIRO — e o chamador lê o desfecho como falha de rede. A
//     entidade inválida fica VISÍVEL (a regra do `cifra.js`), o resto chega.
//  2. **`&amp;` decodificado antes das outras desescapa EM DOBRO**:
//     `&amp;lt;` virava `<`, um sinal que o texto original não tem.
//
// E a forma do capítulo: `[{ n, text }]` ORDENADO pelo número, sem versículo
// vazio, aceitando o mapa `{ num: texto }`, um array, e o valor-objeto.
//
//   node tools/bible.test.mjs
// ============================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checar, falhas } from './checar.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const janela = {};
new Function(readFileSync(join(raiz, 'app/src/main/assets/web/controle/bible.js'), 'utf8')).call(janela);
const B = janela.Bible;
checar(!!B && typeof B.parseChapter === 'function', 'o módulo publica `Bible.parseChapter`');
if (!B) process.exit(1);

// ── 1. A ENTIDADE FORA DA FAIXA NÃO DERRUBA O CAPÍTULO ──────────────────────
let cap = null;
let erro = null;
try {
  cap = B.parseChapter({ 1: 'No princípio', 2: 'texto &#99999999; ruim', 3: 'e &#x110000; outro' });
} catch (e) { erro = String(e); }
checar(!erro && Array.isArray(cap) && cap.length === 3,
  'um código acima de 0x10FFFF não lança: os versículos íntegros chegam junto do defeituoso',
  erro || cap);
checar(!!cap && cap[1].text === 'texto &#99999999; ruim' && cap[2].text === 'e &#x110000; outro',
  'e a entidade inválida fica VISÍVEL, não vira um caractere mudo', cap && cap.map((v) => v.text));
checar(B.stripHtml('&#233; &#xE9;') === 'é é', 'a entidade numérica válida é decodificada (decimal e hexa)',
  B.stripHtml('&#233; &#xE9;'));

// ── 2. `&amp;` POR ÚLTIMO ───────────────────────────────────────────────────
checar(B.stripHtml('a &amp;lt;b&amp;gt; c') === 'a &lt;b&gt; c',
  'o escape em DOBRO desce um degrau só — `&amp;lt;` vira `&lt;`, nunca `<`',
  B.stripHtml('a &amp;lt;b&amp;gt; c'));
checar(B.stripHtml('Deus &amp; o homem') === 'Deus & o homem', 'e `&amp;` simples vira `&`');

// ── 3. A FORMA DO CAPÍTULO ──────────────────────────────────────────────────
const ord = B.parseChapter({ 10: 'dez', 2: '<b>dois</b>', 1: 'um<br/>linha', x: 'lixo', 3: '<i></i>' });
checar(ord.map((v) => v.n).join(',') === '1,2,10',
  'ordenado pelo NÚMERO (10 depois de 2), sem chave não numérica e sem versículo vazio',
  ord.map((v) => v.n));
checar(ord[0].text === 'um linha' && ord[1].text === 'dois', 'as tags saem e o `<br>` vira espaço', ord);
checar(B.parseChapter(['a', 'b']).map((v) => v.n + v.text).join() === '1a,2b',
  'um ARRAY numera a partir de 1');
checar(B.parseChapter({ 1: { text: 'objeto' }, 2: { verse: 'verso' } }).map((v) => v.text).join() === 'objeto,verso',
  'o valor-objeto é lido por `text` ou `verse`');
checar(B.parseChapter(null).length === 0, 'resposta vazia devolve capítulo vazio');

console.log('');
if (falhas.length) {
  console.log('FALHARAM ' + falhas.length + ':');
  falhas.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('Todos passaram.');
