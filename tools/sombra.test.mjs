#!/usr/bin/env node
// ============================================================================
// A SOMBRA — nenhuma função pode redeclarar um nome de módulo da base web
//
// ## O defeito que este oráculo existe para prender
//
// `assets/web/espelho/cliente.js` guardava a `MediaSource` numa variável de
// módulo chamada `ms`. A v5.152 acrescentou, no FIM de `vigiarAudio()`, uma
// linha inocente:
//
//     const ms = Math.round(desvio * 1000 / 50) * 50;
//
// e com ela a PRIMEIRA linha da mesma função —
//
//     if (!sbA || !ms || ms.readyState !== 'open') return;
//
// passou a lançar `ReferenceError: Cannot access 'ms' before initialization`.
// `let`/`const` valem para o BLOCO INTEIRO desde o começo dele (zona morta
// temporal), então a leitura de cima deixou de enxergar a variável do módulo e
// passou a tocar na do bloco, ainda não inicializada.
//
// **`node --check` aprova isso.** É código sintaticamente perfeito. E o erro só
// aparece quando a guarda de cima passa dos primeiros termos — no caso, só em
// telas que tinham LIGADO O SOM —, o que fez o defeito atravessar a rodada em
// aparelho como "travando e dessincronizando" em vez de como uma exceção.
//
// O estrago era o laço de 500 ms inteiro: sem poda (a cota do MSE estoura), sem
// perseguição de borda (o atraso cresce sem teto), sem `setLiveSeekableRange`,
// sem `relatar` — e a ausência do relato é justamente a leitura que o
// `cliente.js` documenta como "o canal de relato quebrou".
//
// ## Por que uma varredura de TEXTO, e por que ela é honesta
//
// A base web não tem dependências e este repositório não aceita uma só por um
// teste (ver as quatro exceções declaradas no `CLAUDE.md`), então não há parser
// de JavaScript à mão. O que existe é uma formatação uniforme: os módulos da
// base são uma IIFE com corpo a dois espaços, ou um script de topo a zero, e
// toda declaração aninhada tem indentação MAIOR. É o bastante para a pergunta
// que interessa — "esta declaração aninhada repete um nome do topo?" — e a
// medição diz que ela não é ruidosa: no bundle inteiro, com a v5.152 no lugar,
// o único achado era o defeito.
//
// A regra que o teste impõe é mais forte que "não crie TDZ": é **nenhuma função
// redeclara um nome de módulo**. Sombra sem TDZ (um `var`, ou um `const`
// declarado antes de qualquer leitura) não quebra nada hoje e vira este mesmo
// defeito no dia em que alguém acrescentar uma linha acima dela — que foi
// exatamente o que aconteceu aqui. Se um nome novo colidir de propósito, o
// conserto é renomear a variável local, que custa uma palavra.
//
// Node puro, determinístico, sem rede e sem navegador: entra no `apk.yml` sem
// `continue-on-error`.
// ============================================================================
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(raiz, 'app/src/main/assets/web');

// A LISTA É VARRIDA, NÃO DIGITADA. Ela já foi escrita à mão, e envelheceu do
// jeito mudo: nomeava `espelho/cliente.js` e `espelho/fmp4.js` (apagados com o
// espelho de pixels, v5.187) e NÃO nomeava `espelho/tela.js` nem
// `controle/sorteio.js`. Um alvo ausente era um `continue`, então o alcance
// encolhia para 9 de 11 e o teste saía verde — **o oráculo media a lista, não a
// base**. E o buraco era o pior possível: `espelho/tela.js` roda no papel
// `tela`, num navegador da LAN onde não há console para ninguém olhar, e o
// watchdog do OTA não cobre as telas da rede (quem confirma o boot é o
// Controle). A ironia é exata — o defeito que este oráculo existe para pegar
// (v5.152) morava no cliente do espelho, a mesma família do arquivo que passou
// a escapar.
//
// A INDENTAÇÃO do corpo do módulo é DEDUZIDA: `0` é um script de topo
// (`display.js`, `controle.js`), `2` é o corpo de uma IIFE. `vendor/` fica de
// fora — é código buildado de terceiro, e a regra é nossa.
function varrer(dir, base = dir) {
  const achados = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'vendor') continue;
      achados.push(...varrer(p, base));
    } else if (e.name.endsWith('.js')) {
      achados.push(relative(base, p).split(sep).join('/'));
    }
  }
  return achados.sort();
}

// A PRIMEIRA linha com código decide, e só ela: um arquivo que ABRE com
// `(function (global) {` (ou `!function`, ou `(() => {`) tem o corpo do módulo
// indentado em 2; o resto vive na coluna 0. Olhar o arquivo inteiro não serve —
// qualquer IIFE interna casaria, e `display.js`/`controle.js`, que são scripts
// de topo, seriam lidos como IIFE (o corpo inteiro deles vira "dentro de
// função" e o oráculo passa a acusar redeclaração em toda variável local).
function indentacaoDe(fonte) {
  const linhas = fonte
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\/\/.*$/, ''));
  const primeira = linhas.find((l) => l.trim());
  return primeira && /^\s*[!(]\s*(?:async\s+)?(?:function\b|\()/.test(primeira) ? 2 : 0;
}

const ARQUIVOS = varrer(WEB).map((rel) => [rel, indentacaoDe(readFileSync(join(WEB, rel), 'utf8'))]);

let falhas = 0;
let arquivos = 0;

function ok(txt) { console.log('ok\t' + txt); }
function falhou(txt) { console.log('FALHOU\t' + txt); falhas++; }

// `let x`, `const x`, `var x` — e também `for (const x of …)` e
// `catch (x)`? Não: só as três formas de declaração, que é onde o defeito mora.
// O nome vem sempre logo depois da palavra-chave.
const DECL = '(?:let|const|var)\\s+([A-Za-z_$][\\w$]*)';

for (const [rel, indent] of ARQUIVOS) {
  const caminho = join(WEB, rel);
  let fonte;
  try {
    fonte = readFileSync(caminho, 'utf8');
  } catch (_) {
    // Não acontece mais: a lista é varrida da árvore, então todo alvo existe.
    // Se acontecer, é uma corrida com o sistema de arquivos, e ela REPROVA —
    // um alvo que some calado é exatamente como este oráculo perdeu dois
    // arquivos de vista.
    falhou(rel + ': sumiu entre a varredura e a leitura');
    continue;
  }
  arquivos++;
  const linhas = fonte.split('\n');

  const topo = new Map();
  const reTopo = new RegExp('^ {' + indent + '}' + DECL);
  linhas.forEach((l, i) => {
    const m = l.match(reTopo);
    if (m && !topo.has(m[1])) topo.set(m[1], i + 1);
  });

  const reDentro = new RegExp('^ {' + (indent + 2) + ',}' + DECL);
  const achados = [];
  linhas.forEach((l, i) => {
    const m = l.match(reDentro);
    if (m && topo.has(m[1])) {
      achados.push('    linha ' + (i + 1) + ': ' + l.trim()
        + '   (o nome "' + m[1] + '" é do módulo, linha ' + topo.get(m[1]) + ')');
    }
  });

  const nome = relative(raiz, caminho);
  // UM TESTE QUE NÃO ENCONTRA NOME NENHUM NÃO ESTÁ TESTANDO NADA — e a causa
  // provável é a indentação errada na tabela acima (um módulo que virou IIFE,
  // ou o contrário). Sem esta guarda o arquivo passaria para sempre, com um
  // "ok" verde por cima de uma varredura vazia.
  if (topo.size === 0) {
    falhou(nome + ': nenhuma declaração de módulo encontrada a ' + indent
      + ' espaço(s) — a indentação da tabela está errada e a varredura foi vazia');
    continue;
  }
  if (!achados.length) {
    ok(nome + ': ' + topo.size + ' nome(s) de módulo, nenhum redeclarado dentro de função');
  } else {
    falhou(nome + ': ' + achados.length + ' nome(s) de módulo redeclarado(s) dentro de função');
    achados.forEach((a) => console.log(a));
  }
}

console.log('');
if (falhas) {
  console.log('Sombra: ' + falhas + ' arquivo(s) com redeclaração. '
    + 'Renomeie a variável LOCAL — uma delas está a uma linha de virar '
    + '"Cannot access X before initialization" em produção.');
  process.exit(1);
}
console.log('Sombra: ' + arquivos + ' arquivo(s), nenhuma redeclaração.');
