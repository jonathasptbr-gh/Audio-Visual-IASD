#!/usr/bin/env node
// ============================================================================
// UM STUB DA PONTE QUE NÃO RESOLVE (revisão A6)
//
// A ponte falsa de um oráculo de Chromium é uma allowlist: o método que chama
// `__avResolve` responde, e o que existe mas NÃO chama devolve `undefined` e
// some. Do lado web a Promise fica pendurada até o `CALL_TIMEOUT_MS` do
// `native.js` — UM MINUTO —, resolve `null`, e quase sempre é o mesmo desfecho
// que a allowlist teria dado: nada reprova, nada aparece no log, o oráculo só
// demora (o `pacoteDiag` do `abertura-e-transferencia` custou 60,0 s dos 70,9 s
// do arquivo; `docs/BUILD.md`, "UM STUB DA PONTE QUE NÃO RESOLVE").
//
// Um método AUSENTE do stub não trava: `B.x(id)` lança, e o `call()` do
// `native.js` resolve `null` na hora. Só o PRESENTE-E-MUDO trava, em duas formas:
//
//  - CONSTANTE — `takeShare: () => ''` escrito no objeto: devolve a string e
//    nunca chama `__avResolve`;
//  - FORA DO `comCallId` — o laço de preenchimento cria o método para todo nome
//    da lista (ou, num `Proxy`, para QUALQUER nome), mas só resolve os do
//    `comCallId`. Um nome que o `native.js` chama com id e que não está lá fica
//    mudo.
//
// "Chamado com id" é lido do próprio `native.js` (`B.<nome>(id`), nunca de uma
// lista digitada aqui: método novo na ponte entra na varredura sozinho.
//
// O LIMITE, declarado: a leitura é TEXTUAL, sobre as formas que os 45 fixtures
// usam hoje (`const B = {…}`, `new Proxy({…}`, `const nomes = …`,
// `const comCallId = new Set([…])`). Um fixture escrito de outro jeito não é
// lido — e a asserção de PREMISSA abaixo exige que a varredura tenha achado
// fixtures das três formas, para uma mudança de estilo não a esvaziar calada.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS = path.join(RAIZ, 'tools');
const nativo = fs.readFileSync(path.join(RAIZ, 'app/src/main/assets/web/shared/native.js'), 'utf8');
const COM_ID = new Set([...nativo.matchAll(/\bB\.(\w+)\(id\b/g)].map((m) => m[1]));

checar(COM_ID.has('takeShare') && COM_ID.has('pacoteDiag') && COM_ID.size >= 30,
  'premissa: o native.js chama com id os métodos de Promise (`B.<nome>(id`)', [...COM_ID].length);

// O trecho entre a chave que abre em `ini` e a que a fecha (strings e
// comentários de linha pulados — o fixture é um template literal, e o que
// importa é a profundidade das chaves do objeto).
function bloco(src, ini) {
  let d = 0;
  for (let i = ini; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '{') d++;
    else if (c === '}' && --d === 0) return src.slice(ini + 1, i);
  }
  return '';
}

// As chaves do primeiro nível de um objeto e o texto do valor de cada uma.
function propriedades(corpo) {
  const props = new Map();
  let d = 0, chave = null, ini = 0;
  const fecha = (fim) => { if (chave) props.set(chave, corpo.slice(ini, fim).trim()); chave = null; };
  for (let i = 0; i < corpo.length; i++) {
    const c = corpo[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < corpo.length && corpo[i] !== c; i++) if (corpo[i] === '\\') i++;
      continue;
    }
    if (c === '/' && corpo[i + 1] === '/') { while (i < corpo.length && corpo[i] !== '\n') i++; continue; }
    if ('{[('.includes(c)) d++;
    else if ('}])'.includes(c)) d--;
    else if (d === 0 && c === ',') { fecha(i); continue; }
    if (d === 0 && chave === null) {
      const m = /^\s*(\w+)\s*(:|\()/.exec(corpo.slice(i));
      if (m && (i === 0 || /[\s,{]/.test(corpo[i - 1]))) { chave = m[1]; ini = i + m[0].length - (m[2] === '(' ? 1 : 0); i += m[0].length - 1; if (m[2] === '(') d++; }
    }
  }
  fecha(corpo.length);
  return props;
}

const nomesLiterais = (txt) => [...txt.matchAll(/'(\w+)'/g)].map((m) => m[1]);

let lidos = 0, comProxy = 0, comLista = 0;
const travas = [];
for (const arq of fs.readdirSync(TOOLS).filter((f) => f.endsWith('.mjs')).sort()) {
  if (arq === 'stub-da-ponte.test.mjs') continue;
  const src = fs.readFileSync(path.join(TOOLS, arq), 'utf8');
  if (!src.includes('__AVBridge')) continue;
  // Um arquivo pode montar mais de uma ponte (`ponte.test.mjs`, por papel).
  const inicios = [...src.matchAll(/(?:const B\s*=\s*(new Proxy\(\s*)?|__AVBridge\s*=\s*(new Proxy\(\s*)?)\{/g)];
  if (!inicios.length) continue;
  lidos++;
  const mCC = /comCallId\s*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(src);
  const comCallId = mCC ? new Set(nomesLiterais(mCC[1])) : null;
  const mNomes = /const nomes\s*=\s*([\s\S]*?\]\)?);/.exec(src);
  for (const m of inicios) {
    const proxy = !!(m[1] || m[2]);
    const props = propriedades(bloco(src, m.index + m[0].length - 1));
    for (const [k, v] of props) {
      if (!COM_ID.has(k)) continue;
      // Uma função que não resolve nem DELEGA a quem resolve: o valor não cita
      // `__avResolve` nem passa o id adiante para outra função.
      const m2 = /^(?:async\s*)?\(([^)]*)\)\s*=>\s*([\s\S]*)$/.exec(v) || /^\(([^)]*)\)\s*\{([\s\S]*)\}$/.exec(v);
      if (!m2) continue;
      const id = (m2[1].split(',')[0] || '').replace(/^\.\.\./, '').trim();
      const resolve = /__avResolve/.test(m2[2]) || (id && new RegExp('\\b' + id + '\\b').test(m2[2]));
      if (!resolve) travas.push(`${arq}: \`${k}\` é CONSTANTE (\`${v.slice(0, 40)}\`) e o native.js espera resposta`);
    }
    if (!comCallId) continue;
    if (proxy) comProxy++;
    let lista;
    if (proxy) lista = [...COM_ID];
    else if (mNomes) {
      comLista++;
      lista = nomesLiterais(mNomes[1]);
      if (/\.\.\.comCallId/.test(mNomes[1])) lista.push(...comCallId);
    } else continue;
    for (const n of new Set(lista)) {
      if (!COM_ID.has(n) || props.has(n) || comCallId.has(n)) continue;
      travas.push(`${arq}: \`${n}\` é preenchido pelo laço mas está FORA do \`comCallId\` — fica mudo`);
    }
  }
}

checar(lidos >= 40 && comProxy >= 1 && comLista >= 5,
  'premissa: a varredura leu os fixtures das três formas (objeto, Proxy, lista + comCallId)',
  { lidos, comProxy, comLista });
checar(travas.length === 0,
  'nenhum stub da ponte fica MUDO diante de um método que o native.js espera (60 s calados cada)',
  travas.join('\n        '));

if (falhas.length) { console.log(`\n${falhas.length} falha(s)`); process.exit(1); }
console.log('\nstub-da-ponte: OK');
