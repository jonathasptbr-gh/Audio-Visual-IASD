#!/usr/bin/env node
// ============================================================================
// TODO SCRIPT DO CONTROLE TEM O GLOBAL DELE NO WATCHDOG DO OTA (revisão W1)
//
// `otaAppIsUp()` (shared/native.js) só carimba um bundle como bom se cada
// script do Controle tiver publicado o próprio global — a ÚLTIMA linha de cada
// arquivo. Todo uso dos módulos no `controle.js` está DENTRO de função, então um
// erro de topo num módulo que FALTE na lista deixa o app de pé, o watchdog
// confirma, e o recurso daquele arquivo morre calado PARA SEMPRE (sem recuo no
// lançamento seguinte). A regra "módulo novo entra na lista no mesmo lote" não
// tinha porta: o `AVSerie`/`AVSorteio` ficaram versões fora dela.
//
// Lê a ordem REAL dos `<script src>` do `controle/index.html`, tira de cada
// arquivo o último `global.X =`/`window.X =` e exige `global.X` no corpo do
// `otaAppIsUp` (sem comentários). O `controle.js` é exigido pelo `__avBack`,
// que é o contrato dele ali (o último global do arquivo é outro).
//
//   node tools/watchdog-modulos.test.mjs
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app/src/main/assets/web');
const html = fs.readFileSync(path.join(WEB, 'controle/index.html'), 'utf8');
const nativo = fs.readFileSync(path.join(WEB, 'shared/native.js'), 'utf8');

const semComentario = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

const scripts = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1]);
const i = nativo.indexOf('function otaAppIsUp()');
const fim = nativo.indexOf('\n  }\n', i);
const corpo = i >= 0 && fim > i ? semComentario(nativo.slice(i, fim)) : '';

checar(scripts.length >= 14 && scripts[0] === '../shared/native.js' && scripts[scripts.length - 1] === 'controle.js',
  'premissa: os `<script src>` do Controle foram lidos (native.js primeiro, controle.js por último)', scripts.join(' '));
checar(/global\.AVDB/.test(corpo) && /__avSplash/.test(corpo),
  'premissa: o corpo do `otaAppIsUp` foi recortado do native.js', corpo.slice(0, 80));

const faltam = [];
for (const src of scripts) {
  if (src === '../shared/native.js') continue;
  const arq = path.join(WEB, 'controle', src);
  const texto = semComentario(fs.readFileSync(arq, 'utf8'));
  let nome;
  if (src === 'controle.js') nome = '__avBack';
  else {
    const todos = [...texto.matchAll(/\b(?:global|window)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)];
    nome = todos.length ? todos[todos.length - 1][1] : null;
  }
  if (!nome) { faltam.push(src + ' (não publica global nenhum)'); continue; }
  if (!new RegExp('global\\.' + nome.replace(/\$/g, '\\$') + '\\b').test(corpo)) faltam.push(src + ' → ' + nome);
}
checar(faltam.length === 0,
  'todo script do Controle tem o global dele exigido pelo `otaAppIsUp` — fora da lista, um erro de topo nele é carimbado como bom',
  faltam.join(', '));

if (falhas.length) { console.log(`\n${falhas.length} falha(s)`); process.exit(1); }
console.log('\nwatchdog-modulos: OK');
