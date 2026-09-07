#!/usr/bin/env node
// ============================================================================
// UMA FUNÇÃO SEM CHAMADOR (v1.8.42)
//
// ## Por que este oráculo existe
//
// A regra deste repositório é *"APAGAR CÓDIGO É APAGAR O QUE O DESCREVE, NO
// MESMO LOTE"*, e ela não tinha rede de segurança nenhuma do lado das FUNÇÕES.
// O modo de falhar é mudo por construção: uma função que ninguém chama não erra,
// não aparece em teste de comportamento nenhum, e viaja no bundle do OTA para
// todo aparelho da frota em toda atualização. O que ela custa não é o byte — é o
// COMENTÁRIO dela, que continua afirmando um mecanismo que já não roda, e que a
// próxima sessão lê como verdade.
//
// Duas foram achadas à mão na revisão de 2026-09-07, e as duas são o padrão:
//
//  - `pacoteIconeSvg` — a v1.8.41 trocou os DOIS chamadores dela (o ícone de um
//    grupo passou a vestir `.coll-bar-icon`, a seta virou `chevronUpIconSvg`) e
//    deixou a função de pé. Pior: o `glifos.test.mjs` varria por
//    `pacoteIconeSvg\('ico…'` como uma das suas DUAS entradas, e com zero
//    chamadas essa alternativa parou de casar — a asserção que existia para
//    provar que a entrada do JS foi lida passou a ser satisfeita pela outra
//    alternativa, e seguia verde afirmando o que já não podia afirmar.
//  - `telaoNoChao` — nasceu na v1.6.6 e NUNCA teve chamador no app; só o
//    `telao-no-chao.test.mjs` a chamava. Enquanto isso o `descreverTelao`
//    reescrevia a mesma pergunta inline, e as duas já divergiam.
//
// ## As duas categorias, e por que elas são separadas
//
// MORTA        — nem o app nem os oráculos usam. Apague, com o comentário.
// SÓ O ORÁCULO — o app não chama; só `tools/` chama. É PIOR que morta: o
//                oráculo prova que uma função que ninguém usa funciona, e a
//                lógica de verdade está escrita em OUTRO lugar, livre para
//                divergir. Ou o app passa a usá-la, ou ela sai com o teste.
//
// ## O limite, declarado
//
// A busca é TEXTUAL (`\bnome\b` sobre todo `.js` e `.html` da base, menos
// `vendor/`) e roda SOBRE O CÓDIGO, com os comentários removidos — sem isso um
// comentário que CITA a função conta como uso, e a citação costuma ser
// justamente a que explica o mecanismo que acabou de morrer. MEDIDO ao escrever
// este arquivo: com os comentários dentro, a reversão do `telaoNoChao` NÃO
// reprovava, porque as duas linhas de comentário que o nomeiam bastavam.
// Ela não enxerga despacho por string (`window[nome]()`), e por isso
// erra para o lado BARULHENTO: acusa uma função viva em vez de deixar passar uma
// morta. Uma acusação falsa se resolve em uma linha — a lista `VIVAS_POR_FORA`
// abaixo —, e cada entrada nela tem de dizer QUEM chama.
//
//   node tools/funcao-sem-chamador.test.mjs
// ============================================================================
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(RAIZ, 'app/src/main/assets/web');

// Chamadas que a busca textual não enxerga. Cada linha diz QUEM chama.
const VIVAS_POR_FORA = new Set([
  // (vazia hoje — acrescente `nome`, com o chamador no comentário ao lado)
]);

const falhas = [];
const ok = (t) => console.log('ok\t' + t);
const nao = (t, extra) => { console.log('FALHOU\t' + t + (extra ? '\n\t' + extra : '')); falhas.push(t); };

const arquivos = [];
(function anda(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'vendor') continue;
    const p = join(d, e.name);
    if (e.isDirectory()) anda(p);
    else if (/\.(js|html)$/.test(e.name)) arquivos.push(p);
  }
})(WEB);

// SEM COMENTÁRIOS — ver o cabeçalho —, e o removedor é DELIBERADAMENTE
// conservador: ele só apaga o que COMEÇA a linha (`//`, `*`, `/*`, `<!--`).
//
// A versão larga (casar `/*…*/` e `//…` em qualquer posição) foi escrita e
// MEDIDA primeiro, e ela engolia CÓDIGO: um `/*` dentro de uma string ou de um
// literal de regex abre um bloco que só fecha muitas linhas adiante, e com ele
// somem chamadas de verdade — `dotsIconSvg`, chamada na linha 8251, saía como
// morta. Errar assim é pior que o furo que o removedor conserta: acusa função
// viva com a confiança de um oráculo.
//
// O que ficou de fora é comentário à direita de código (`foo(); // nota`), e
// ele é inofensivo aqui: o que interessa é a linha ter a CHAMADA, e ela está
// antes do `//`. O que importa apagar são os blocos de documentação deste
// repositório, que são sempre de linha inteira — e são eles que citam o nome da
// função que acabou de morrer.
const semComentario = (t) => t.split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\/\*|<!--)/.test(l))
  .join('\n');

const corpo = new Map(arquivos.map((f) => [f, readFileSync(f, 'utf8')]));
const app = semComentario([...corpo.values()].join('\n'));
const oraculos = semComentario(readdirSync(join(RAIZ, 'tools'))
  .filter((f) => f.endsWith('.mjs'))
  .map((f) => readFileSync(join(RAIZ, 'tools', f), 'utf8')).join('\n'));

const mortas = [];
const soOraculo = [];
let vistas = 0;
for (const [f, txt] of corpo) {
  if (!f.endsWith('.js')) continue;
  const rel = f.slice(RAIZ.length + 1);
  for (const m of txt.matchAll(/^(?:async )?function ([A-Za-z_$][\w$]*)/gm)) {
    const nome = m[1];
    vistas++;
    if (VIVAS_POR_FORA.has(nome)) continue;
    const re = new RegExp('\\b' + nome + '\\b', 'g');
    // > 1 = a declaração mais ao menos um uso.
    if ((app.match(re) || []).length > 1) continue;
    ((oraculos.match(re) || []).length ? soOraculo : mortas).push(nome + ' (' + rel + ')');
  }
}

// A PROVA DE QUE A VARREDURA RODOU: sem ela, um `readdirSync` que devolvesse
// nada deixaria as duas listas vazias e o oráculo passaria por AUSÊNCIA.
if (vistas >= 500) ok('a base foi varrida (' + vistas + ' funções em ' + arquivos.length + ' arquivos)');
else nao('a base foi varrida', 'só ' + vistas + ' função(ões) vista(s) — a varredura não achou o código');

if (!mortas.length) ok('nenhuma função sem chamador nenhum');
else nao('nenhuma função sem chamador nenhum',
  mortas.join('\n\t') + '\n\tconserto: apague a função E o comentário dela, no mesmo lote');

if (!soOraculo.length) ok('nenhuma função existe só para o oráculo chamar');
else nao('nenhuma função existe só para o oráculo chamar',
  soOraculo.join('\n\t')
  + '\n\tconserto: faça o APP usá-la (a lógica de verdade costuma estar'
  + '\n\tduplicada em outro lugar), ou apague-a junto com a asserção');

console.log('');
if (falhas.length) { console.log(falhas.length + ' FALHA(S).'); process.exit(1); }
console.log('Toda função da base tem chamador no app.');
