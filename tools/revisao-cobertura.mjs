#!/usr/bin/env node
// ===== A VISTORIA TEM ESCOPO FIXO: MEDE A COBERTURA DOS DEZ MARCOS =====
//
// **Isto NÃO é oráculo.** Não afirma comportamento do app, não entra no
// `tools/*.test.mjs` nem na suíte de todo push. É ferramenta da revisão geral,
// descrita em `docs/REVISAO-GERAL.md`.
//
// ## Por que ele existe
//
// A revisão de 2026-11-13 disparou sete varreduras e achou 51 coisas. O `site/`
// tinha recebido 52 commits e 8.652 linhas no intervalo — e nenhuma das sete era
// do site, porque o site não era o marco de ninguém. Ninguém pulou por preguiça:
// a área simplesmente não estava na lista. Descobrir isso custou uma sessão
// inteira, dias depois.
//
// A trava é mecânica: o intervalo é repartido nos dez marcos, e cada marco com
// mudança precisa ter ao menos um arquivo dele CITADO no dossiê. O que não se
// mede, não se cobra.
//
// ## Uso
//
//   node tools/revisao-cobertura.mjs --base <sha>                 # o mapa do intervalo
//   node tools/revisao-cobertura.mjs --base <sha> --dossie <arq>  # e a cobertura
//
// Sai com 1 quando algum marco recebeu mudança e o dossiê não cita nenhum
// arquivo dele. Sem `--dossie`, só informa.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const GIT = ['-c', 'safe.directory=*'];
const git = (...a) => execFileSync('git', [...GIT, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });

// ---------------------------------------------------------------------------
// OS DEZ MARCOS. A ORDEM IMPORTA: o primeiro que casa fica com o arquivo, e por
// isso os marcos de documento (M9, M10) vêm ANTES do M7 — senão todo `docs/`
// cairia na documentação genérica e a governança nunca apareceria.
// ---------------------------------------------------------------------------
const MARCOS = [
  ['M4', 'o tour', [
    /^app\/src\/main\/assets\/web\/controle\/tour\.js$/,
    /^tools\/tour\.test\.mjs$/,
    /^docs\/arquitetura\/CONTROLE-TOUR\.md$/,
  ]],
  ['M1', 'o app web', [
    /^app\/src\/main\/assets\/web\/controle\/[^/]+\.js$/,
    /^app\/src\/main\/assets\/web\/(notas|version)\.json$/,
  ]],
  ['M2', 'a base web, o telão e a tela espelho', [
    /^app\/src\/main\/assets\/web\/shared\//,
    /^app\/src\/main\/assets\/web\/controle\/shared\//,
    // O TELÃO E A TELA ESPELHO têm pasta e vida próprias: o catch-all do M5 os
    // engolia como "shell", e é assim que uma área inteira fica sem varredura.
    /^app\/src\/main\/assets\/web\/(display|espelho)\//,
    /tokens\.css$/,
    /^app\/src\/main\/assets\/web\/vendor\//,
  ]],
  ['M3', 'o CSS e o HTML do app', [
    /^app\/src\/main\/assets\/web\/controle\/controle\.css$/,
    /^app\/src\/main\/assets\/web\/controle\/index\.html$/,
  ]],
  ['M5', 'o shell e o build', [
    /^app\/src\/main\/java\//,
    /^app\/src\/main\/res\//,
    /^app\/src\/test\//,
    /AndroidManifest\.xml$/,
    /^app\/(build\.gradle|proguard-rules)/,
    // A RAIZ do build: sem isto, `build.gradle.kts`, `settings.gradle.kts`,
    // `gradle/`, `gradlew` e o `package.json` ficavam sem marco nenhum.
    /^build\.gradle/,
    /^settings\.gradle/,
    /^gradle/,
    /^package(-lock)?\.json$/,
    // o registro do ADI da assinatura mora em `assets/` sem ser base web
    /^app\/src\/main\/assets\/[^/]+\.properties$/,
  ]],
  ['M6', 'o site e as capturas', [/^site\//, /^capturas\//, /^\.github\/workflows\/pages\.yml$/]],
  ['M9', 'os achados antigos', [
    /^docs\/ACHADOS-EM-ABERTO\.md$/,
    /^docs\/AUDITORIA-/,
    /^docs\/RESIDUOS\.md$/,
  ]],
  ['M10', 'a governança', [
    /^docs\/revisao\//,
    /^docs\/PEDIDOS-EM-ESPERA\.md$/,
    /^docs\/REVISAO-GERAL\.md$/,
  ]],
  ['M8', 'as ferramentas e o repositório', [
    /^tools\//,
    /^\.github\/workflows\//,
    /^\.gitignore$/,
    /^LICENSE$/,
    /^AVISOS-DE-TERCEIROS\.md$/,
  ]],
  ['M7', 'a documentação', [/^docs\//, /^CLAUDE\.md$/, /^README\.md$/]],
];

const marcoDe = (arq) => {
  for (const [id, titulo, padroes] of MARCOS) if (padroes.some((p) => p.test(arq))) return id;
  return '—';
};

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const opc = (nome) => {
  const i = args.indexOf('--' + nome);
  return i >= 0 ? args[i + 1] : null;
};
const base = opc('base');
const head = opc('head') || 'HEAD';
const dossie = opc('dossie');

if (!base) {
  console.error('uso: node tools/revisao-cobertura.mjs --base <sha> [--head <sha>] [--dossie <arquivo.md>]');
  process.exit(2);
}
if (dossie && !existsSync(dossie)) {
  console.error('dossiê não encontrado: ' + dossie);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// O intervalo, medido
// ---------------------------------------------------------------------------
const porMarco = new Map(MARCOS.map(([id, titulo]) => [id, { titulo, arqs: [], mais: 0, menos: 0 }]));
porMarco.set('—', { titulo: 'fora dos marcos', arqs: [], mais: 0, menos: 0 });

for (const linha of git('diff', '--numstat', `${base}..${head}`).split('\n')) {
  if (!linha.trim()) continue;
  const [mais, menos, arq] = linha.split('\t');
  // binário não tem conta de linha: entra como arquivo, com zero
  const m = porMarco.get(marcoDe(arq));
  m.arqs.push(arq);
  m.mais += Number(mais) || 0;
  m.menos += Number(menos) || 0;
}

const texto = dossie ? readFileSync(dossie, 'utf8') : null;

// CITAÇÃO = o caminho inteiro OU o nome do arquivo. A régua é frouxa de
// propósito: o que se cobra aqui é ATENÇÃO ao marco, não precisão de citação.
// Quem decide se a atenção foi suficiente é a fração — ver `PISO` abaixo.
// Quantos arquivos mudados têm o mesmo nome: é o que separa `controle.js` (único)
// de `index.html` (quatro: o do app, o do site e dois do site).
const unicos = new Map();
for (const a of [...porMarco.values()].flatMap((m) => m.arqs)) {
  const n = a.split('/').pop();
  unicos.set(n, (unicos.get(n) || 0) + 1);
}

const citado = (arq) => {
  if (!texto) return null;
  const segs = arq.split('/');
  // O CAMINHO SEMPRE VALE — inteiro ou sufixo de duas ou mais partes
  // (`controle/index.html` distingue o app do site).
  for (let i = 0; i <= segs.length - 2; i++) if (texto.includes(segs.slice(i).join('/'))) return true;
  // O NOME SOLTO VALE QUANDO É ÚNICO. É como o repositório cita dentro de um
  // texto sobre a área ("`controle.js:22109`"); exigir caminho sempre tornava o
  // dossiê mais difícil de escrever sem ganhar nada.
  return unicos.get(segs[segs.length - 1]) === 1 && texto.includes(segs[segs.length - 1]);
};

// O PISO: um marco com 8.663 linhas citando 3 arquivos (4,8%) não foi coberto —
// foi roçado. Abaixo disso o relatório acusa, e quem escreve o dossiê tem de
// provar que aqueles poucos arquivos eram o marco inteiro.
const PISO = 0.10;

// ---------------------------------------------------------------------------
// O relatório
// ---------------------------------------------------------------------------
const numero = (n) => n.toLocaleString('pt-BR');
const curto = git('rev-parse', '--short', base).trim() + ' → ' + git('rev-parse', '--short', head).trim();
const total = [...porMarco.values()].reduce((s, m) => s + m.arqs.length, 0);

console.log('\n== revisão geral — cobertura dos dez marcos');
console.log('intervalo ' + curto + ' · ' + total + ' arquivos · '
  + numero([...porMarco.values()].reduce((s, m) => s + m.mais, 0)) + ' linhas somadas');
if (!texto) console.log('(sem --dossie: só o mapa do intervalo, nada é cobrado)\n');
else console.log('dossiê ' + dossie + '\n');

const cab = ['marco', 'arquivos', '+linhas', '-linhas'];
if (texto) cab.push('citados', 'estado');
const larg = [6, 10, 9, 9, 9, 14];
console.log(cab.map((c, i) => c.padEnd(larg[i])).join('').trimEnd());
console.log('-'.repeat(texto ? 52 : 30));

let vazios = [];
for (const [id, m] of porMarco) {
  if (!m.arqs.length) continue;
  const celulas = [id.padEnd(larg[0]), String(m.arqs.length).padEnd(larg[1]),
    numero(m.mais).padEnd(larg[2]), numero(m.menos).padEnd(larg[3])];
  if (texto) {
    const n = m.arqs.filter(citado).length;
    celulas.push(`${n}/${m.arqs.length}`.padEnd(larg[4]));
    const ok = n > 0 && n / m.arqs.length >= PISO;
    celulas.push(ok ? 'ok' : (n === 0 ? 'SEM NINGUÉM' : 'QUASE NADA'));
    if (!ok) vazios.push([id, m]);
  }
  console.log(celulas.join('').trimEnd() + '  ' + m.titulo);
}

if (texto && vazios.length) {
  console.log('\n== MARCO SEM COBERTURA — o dossiê quase não cita arquivo destes:');
  for (const [id, m] of vazios) {
    console.log('\n' + id + ' · ' + m.titulo);
    const sem = m.arqs.filter((a) => !citado(a));
    for (const a of sem.slice(0, 12)) console.log('   ' + a);
    if (sem.length > 12) console.log('   … e mais ' + (sem.length - 12));
  }
}

// As três linhas que a revisão NÃO pode esquecer de declarar
console.log('\n== a revisão precisa dizer, por escrito:');
console.log('   · o que NÃO foi medido (tela, aparelho, JUnit, Chromium)');
console.log('   · o custo em passos e ferramentas');
console.log('   · o resíduo que ficou, em docs/RESIDUOS.md');

if (texto && vazios.length) {
  console.log('\nCOBERTURA INCOMPLETA: ' + vazios.map(([id]) => id).join(', '));
  process.exit(1);
}
if (!texto) {
  console.log('\n(sem --dossie não há cobertura a cobrar: passe o dossiê para medir)');
} else {
  console.log('\nCOBERTURA: todo marco com mudança tem arquivo citado (piso ' + Math.round(PISO * 100) + '%).');
}
