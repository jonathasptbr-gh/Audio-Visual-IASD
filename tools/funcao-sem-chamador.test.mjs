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

// MORTAS DE PROPÓSITO — e a distinção importa: o que este oráculo combate é o
// resto que ninguém DECIDIU deixar. Um símbolo sem chamador cujo comentário
// ADMITE a ausência e diz por que ele fica não é um resto; é uma decisão, e
// apagá-lo seria desfazê-la por conta própria.
//
// Cada entrada tem de apontar o comentário que a sustenta — sem isso a lista
// vira a porta larga por onde todo achado deste oráculo passa a ser silenciado.
const MORTAS_DE_PROPOSITO = new Set([
  // `db.js`: *"SEM CHAMADOR DESDE A v1.7.7, e isto está dito para não ser lido
  // como contrato vivo"*. A transmissão direta saiu do `controle.js` a pedido
  // do operador; o banco continua LENDO registros gravados antes daquele lote,
  // e uma store que sabe ler e não sabe escrever é mais difícil de entender
  // inteira. Ver o cabeçalho de `shared/mse.js`, que é o leitor.
  'addStreamMedia',
  'setMediaStream',
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
  // O RECUO ENTRA NA REGEX (v1.8.46), e sem ele a varredura via só metade da
  // base: `db.js`, `stage.js`, `mse.js` e as outras são um IIFE, e toda função
  // delas nasce indentada. MEDIDO: com a âncora colada no começo da linha, 918
  // funções eram vistas — nenhuma de `shared/`, que é onde mora o banco.
  // Foi assim que o `filesResumo` passou.
  for (const m of txt.matchAll(/^[ \t]*(?:async )?function ([A-Za-z_$][\w$]*)/gm)) {
    const nome = m[1];
    vistas++;
    if (VIVAS_POR_FORA.has(nome) || MORTAS_DE_PROPOSITO.has(nome)) continue;
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

// ============================================================================
// A SUPERFÍCIE PÚBLICA DO BANCO — `global.AVDB = { … }` (v1.8.46)
//
// A contagem acima não alcança um nome EXPORTADO: ele aparece duas vezes (a
// declaração e a linha da exportação), e `> 1` o aprova. Foi assim que o
// `filesResumo` sobreviveu — o único consumidor dele no repositório era um
// espião de oráculo afirmando que ele NÃO é chamado.
//
// Aqui a pergunta é a certa para uma API: **alguém acessa `AVDB.<nome>`?** A
// lista é a do `db.js`, e os consumidores dela chegam todos por esse prefixo
// (278 ocorrências só no `controle.js`), então não há falso positivo a temer.
// Escopada a ELA de propósito: uma varredura genérica por `return { … }` casa
// todo objeto devolvido por qualquer função, e foi o que produziu dois falsos
// positivos ao escrever este bloco.
// ============================================================================
{
  const db = corpo.get(join(WEB, 'shared/db.js')) || '';
  const m = db.match(/global\.AVDB = \{([\s\S]*?)\n  \};/);
  if (!m) {
    nao('achei o `global.AVDB = { … }` no db.js',
      'sem ele este bloco não mede nada — não deixe passar por ausência');
  } else {
    const nomes = [...semComentario(m[1]).matchAll(/([A-Za-z_$][\w$]*)\s*(?=[,\n])/g)]
      .map((x) => x[1]).filter((n2) => !/^(true|false|null|slice)$/.test(n2));
    const orfaos = nomes.filter((n2) => !MORTAS_DE_PROPOSITO.has(n2)
      && !new RegExp('\\.' + n2 + '\\b').test(app.replace(m[0], '')));
    if (nomes.length >= 40) ok('a superfície do `AVDB` foi lida (' + nomes.length + ' nomes)');
    else nao('a superfície do `AVDB` foi lida', 'só ' + nomes.length + ' nome(s)');
    if (!orfaos.length) ok('e todo nome exportado pelo `AVDB` é acessado no app');
    else {
      const soTeste = orfaos.filter((n2) => new RegExp('\\.' + n2 + '\\b').test(oraculos));
      nao('todo nome exportado pelo `AVDB` é acessado no app',
        orfaos.join(', ')
        + (soTeste.length ? '\n\tdesses, SÓ O ORÁCULO usa: ' + soTeste.join(', ') : '')
        + '\n\tconserto: apague o que ninguém chama, ou faça o app usá-lo');
    }
  }
}

console.log('');
if (falhas.length) { console.log(falhas.length + ' FALHA(S).'); process.exit(1); }
console.log('Toda função da base tem chamador no app.');
