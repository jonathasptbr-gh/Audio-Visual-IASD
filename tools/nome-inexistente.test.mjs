#!/usr/bin/env node
// ORÁCULO DE NOME INEXISTENTE (v1.13.56) — a rede que faltava entre o `node
// --check` e o navegador.
//
// A v1.13.52 apagou o `renderSelbar` e a v1.13.55 o `comecarArrasto` no meio de
// uma cirurgia por marcador. Nos dois casos a sintaxe ficou PERFEITA e o defeito
// só apareceu no Chromium, com `pageerror: ... is not defined` — uma rodada de
// CI de ~10 min para uma informação que se lê no código.
//
// O `node --check` prova FORMA, não COMPLETUDE: um arquivo que chama função
// inexistente é parseável. E o `funcao-sem-chamador` prova o sentido inverso
// (toda função tem chamador), não que todo chamador tenha função. Este fecha o
// terceiro lado.
//
// MÉTODO: `acorn` (dependência de desenvolvimento, sem dependências próprias)
// percorre a árvore de verdade e coleta TODA declaração do arquivo — função,
// classe, `var/let/const` com desestruturação, parâmetros de função e de seta,
// `catch`, import — mais as atribuições a nome nu (`x = …`), que num script
// clássico também declaram global. O universo de nomes é a união disso entre
// TODOS os arquivos da base (eles compartilham o escopo global, como no
// WebView) mais os globais do navegador da lista abaixo.
//
// Por que isso não dá falso positivo: a régua é "declarado em algum lugar do
// projeto ou é global do navegador". Ela é CEGA a escopo de propósito — só
// acusa o que não existe em lugar nenhum, e é exatamente essa a classe do
// defeito. Um nome usado fora do escopo errado passaria; o navegador pega esse,
// e ele não é o que se está caçando aqui.
//
// Uso: `node tools/nome-inexistente.test.mjs [arquivo-extra…]`
// Reversão (a prova de que ele tem dentes): criar um arquivo temporário com
// `function nada(){} if (false) funcaoQueNaoExiste();`, rodar com ele como
// argumento extra e conferir que ele REPROVA.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(RAIZ, 'app/src/main/assets/web');

// Globais do navegador e da linguagem. Não é catálogo exaustivo: é a lista do
// que estes arquivos chamam como FUNÇÃO LIVRE. Nome novo aqui é raro e aparece
// como falso positivo, o que é seguro (reprova e se corrige em um minuto).
const GLOBAIS = new Set(`
  setTimeout clearTimeout setInterval clearInterval requestAnimationFrame
  cancelAnimationFrame requestIdleCallback queueMicrotask structuredClone
  fetch alert confirm prompt parseInt parseFloat isNaN isFinite
  encodeURIComponent decodeURIComponent btoa atob reportError
  getComputedStyle matchMedia createImageBitmap createImageData
  open close postMessage print
  String Number Boolean Array Object Math JSON Date RegExp Error TypeError
  RangeError SyntaxError Promise Map Set WeakMap WeakSet Symbol BigInt Intl
  URL URLSearchParams Blob File FileReader FormData Image Audio Worker
  TextEncoder TextDecoder Uint8Array Uint8ClampedArray Uint16Array Uint32Array
  Int8Array Int16Array Int32Array Float32Array Float64Array ArrayBuffer DataView
  OffscreenCanvas MediaSource SourceBuffer AudioContext webkitAudioContext
  AbortController AbortSignal DOMException Event CustomEvent PointerEvent
  TouchEvent KeyboardEvent WheelEvent DragEvent DOMMatrixReadOnly DOMParser
  XMLSerializer Notification MutationObserver ResizeObserver IntersectionObserver
  IDBKeyRange BroadcastChannel MessageChannel Worker
`.trim().split(/\s+/));

function lerArquivosDaBase() {
  const saida = [];
  (function anda(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'vendor') anda(p); }
      else if (e.name.endsWith('.js')) saida.push(p);
    }
  })(WEB);
  return saida;
}

let acorn;
try {
  acorn = await import('acorn');
} catch (e) {
  console.log('não\t`acorn` não está instalado — rode `npm ci` (é dependência de desenvolvimento)');
  console.log('\nPULO: o oráculo não rodou. Não é veredito.');
  process.exit(2);
}

function achado(arquivo, linha, nome) {
  return path.relative(RAIZ, arquivo) + ':' + linha + ' → ' + nome;
}

// Coleta declarações e chamadas de UM arquivo. A varredura é genérica (anda em
// toda propriedade que seja nó ou lista de nós), para não depender de uma lista
// de tipos que envelhece a cada recurso novo da linguagem.
function varrer(ast, arquivo) {
  const declarados = new Set();
  const chamadas = [];          // { nome, linha }
  const anotarPadrao = (no) => {
    if (!no) return;
    switch (no.type) {
      case 'Identifier': declarados.add(no.name); break;
      case 'ObjectPattern': for (const p of no.properties) anotarPadrao(p.value || p.argument); break;
      case 'ArrayPattern': for (const p of no.elements) anotarPadrao(p); break;
      case 'RestElement': anotarPadrao(no.argument); break;
      case 'AssignmentPattern': anotarPadrao(no.left); break;
      default: break;
    }
  };
  const anotarParams = (lista) => { for (const p of lista || []) anotarPadrao(p); };

  (function anda(no) {
    if (!no || typeof no !== 'object') return;
    if (Array.isArray(no)) { for (const n of no) anda(n); return; }
    if (typeof no.type !== 'string') return;

    switch (no.type) {
      case 'FunctionDeclaration': if (no.id) declarados.add(no.id.name); anotarParams(no.params); break;
      case 'FunctionExpression': if (no.id) declarados.add(no.id.name); anotarParams(no.params); break;
      case 'ArrowFunctionExpression': anotarParams(no.params); break;
      case 'ClassDeclaration': case 'ClassExpression': if (no.id) declarados.add(no.id.name); break;
      case 'VariableDeclaration': for (const d of no.declarations) anotarPadrao(d.id); break;
      case 'CatchClause': anotarPadrao(no.param); break;
      case 'ImportDeclaration': for (const s of no.specifiers || []) declarados.add(s.local.name); break;
      case 'AssignmentExpression': if (no.left && no.left.type === 'Identifier') declarados.add(no.left.name); break;
      case 'CallExpression':
        if (no.callee && no.callee.type === 'Identifier') chamadas.push({ nome: no.callee.name, linha: no.loc ? no.loc.start.line : 0 });
        break;
      default: break;
    }
    for (const chave of Object.keys(no)) {
      if (chave === 'loc' || chave === 'range' || chave === 'start' || chave === 'end') continue;
      const v = no[chave];
      if (v && typeof v === 'object') anda(v);
    }
  })(ast);

  return { declarados, chamadas };
}

const arquivos = lerArquivosDaBase().concat(process.argv.slice(2).map((p) => path.resolve(p)));
let conhecidos = new Set(GLOBAIS);
const porArquivo = [];

for (const arquivo of arquivos) {
  const fonte = fs.readFileSync(arquivo, 'utf8');
  let ast;
  try {
    ast = acorn.parse(fonte, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  } catch (_) {
    ast = acorn.parse(fonte, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  }
  const r = varrer(ast, arquivo);
  for (const n of r.declarados) conhecidos.add(n);
  porArquivo.push({ arquivo, chamadas: r.chamadas });
}

const falhas = [];
for (const { arquivo, chamadas } of porArquivo) {
  const vistos = new Set();
  for (const c of chamadas) {
    if (conhecidos.has(c.nome)) continue;
    const chave = c.nome;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    falhas.push(achado(arquivo, c.linha, c.nome));
  }
}

const semAcorn = falhas.length;
console.log('ok\t' + arquivos.length + ' arquivos da base percorridos, ' + conhecidos.size + ' nomes conhecidos');
if (falhas.length) {
  console.log('FALHOU\t' + falhas.length + ' chamada(s) a nome que não existe em lugar nenhum:');
  for (const f of falhas.slice(0, 40)) console.log('        ' + f);
  if (falhas.length > 40) console.log('        … e mais ' + (falhas.length - 40));
}
console.log('\n' + (semAcorn ? semAcorn + ' FALHA(S)' : 'tudo certo'));
process.exit(semAcorn ? 1 : 0);
