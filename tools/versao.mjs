#!/usr/bin/env node
// =============================================================================
// A VERSÃO EM UM COMANDO — escreve as TRÊS casas de uma vez.
//
// Escrever o número em três arquivos é um passo repetido em TODO lote que toca
// a base web, e ele falha mudo dos dois lados: esquecer o `WEB_VERSION` é o
// erro silencioso (o OTA distribui e o aparelho mostra a versão antiga) e
// esquecer o `version.json` é o mudo (nada chega a aparelho nenhum). O
// `apk.yml` já REPROVA a divergência entre as três; o que faltava era o
// ESCRITOR (auditoria de eficiência, #9) — a rede já existia, a conveniência
// não.
//
// Uso:
//   node tools/versao.mjs 1.14.17        # escreve as três casas
//   node tools/versao.mjs --conferir     # só lê: sai 1 se as três divergirem
//
// Regras que ele cobra, e não só executa:
//   · a forma `MAIOR.INCREMENTAL[.CORREÇÃO]` (o `compareVersions` aceita lixo
//     calado: "1.0.1-rc" compara igual a "1.0.1");
//   · a versão nova é MAIOR que a atual — o OTA ignora, em silêncio, o que não
//     for maior, então escrever a mesma ou uma menor é publicar nada;
//   · `shellTag`, quando declarado, acompanha a versão (`v` + a nova): ele é a
//     promessa de que ESTE bundle espera AQUELA Release.
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const FORM = /^[0-9]+\.[0-9]+(\.[0-9]+)?$/;
const ARQ = { json: 'version.json', js: 'controle/controle.js', html: 'controle/index.html' };
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const RE_JS = /^const WEB_VERSION = '([^']+)';$/m;
const RE_HTML = /(id="appVersion">v)([0-9][0-9.]*)(<)/;

const num = (v) => { const x = v.split('.').map(Number); return x.concat(new Array(Math.max(0, 3 - x.length)).fill(0)); };
const cmp = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

const casas = () => {
  const m = JSON.parse(ler(ARQ.json));
  const js = (ler(ARQ.js).match(RE_JS) || [])[1];
  const html = (ler(ARQ.html).match(RE_HTML) || [])[2];
  return { json: m, vjson: m.version, vjs: js, vhtml: html };
};

const arg = process.argv[2] || '';
const c = casas();
const tres = [c.vjson, c.vjs, c.vhtml];
const iguais = tres.every((v) => v && v === tres[0]);

if (arg === '--conferir' || arg === '') {
  if (!arg) { console.error('uso: node tools/versao.mjs <versão> | --conferir'); process.exit(2); }
  console.log(`version.json ${c.vjson || '?'} · WEB_VERSION ${c.vjs || '?'} · #appVersion ${c.vhtml || '?'}`);
  if (!iguais) { console.error('AS TRÊS CASAS DIVERGEM — rode `node tools/versao.mjs <versão>`'); process.exit(1); }
  process.exit(0);
}

if (!FORM.test(arg)) {
  console.error(`versão malformada: ${JSON.stringify(arg)} — use MAIOR.INCREMENTAL[.CORREÇÃO], ex. 1.14.17`);
  process.exit(2);
}
if (!iguais) {
  console.error('as três casas já divergem — conserte a mão antes de escrever por cima: ' + tres.join(' · '));
  process.exit(2);
}
if (cmp(arg, c.vjson) <= 0) {
  console.error(`a versão ${arg} não é MAIOR que a atual (${c.vjson}) — o OTA ignora o que não for, em silêncio`);
  process.exit(2);
}

const m = { ...c.json, version: arg };
if (m.shellTag) m.shellTag = 'v' + arg;
fs.writeFileSync(path.join(RAIZ, ARQ.json), JSON.stringify(m, null, 2) + '\n');

const js = ler(ARQ.js);
if (!RE_JS.test(js)) { console.error(`WEB_VERSION não encontrado em ${ARQ.js}`); process.exit(2); }
fs.writeFileSync(path.join(RAIZ, ARQ.js), js.replace(RE_JS, `const WEB_VERSION = '${arg}';`));

const html = ler(ARQ.html);
if (!RE_HTML.test(html)) { console.error(`#appVersion não encontrado em ${ARQ.html}`); process.exit(2); }
fs.writeFileSync(path.join(RAIZ, ARQ.html), html.replace(RE_HTML, `$1${arg}$3`));

console.log(`as três casas agora dizem ${arg}` + (m.shellTag ? ` · shellTag ${m.shellTag}` : ''));
