#!/usr/bin/env node
// ============================================================================
// AS SEÇÕES TEMÁTICAS DO HINÁRIO 2022 — a tabela que não pode ter buraco
//
// ## Por que ele existe
//
// `controle/hinario.js` traduz o NÚMERO de um hino na SEÇÃO dele. Não há campo
// no banco que diga isso (`pt_hymnal` traz número, nome, duração e playback, e
// mais nada), então o que identifica a seção é a POSIÇÃO — uma tabela de 35
// faixas transcrita do índice publicado pela CPB.
//
// **O modo de errar é mudo, e é por isso que a tabela precisa de oráculo.** Um
// limite digitado errado não quebra nada: a lista continua completa, na ordem
// certa, e um cabeçalho passa a mentir sobre os hinos abaixo dele. Não há erro
// de console, não há requisição falhando, não há teste de comportamento que
// note. Quem descobre é o operador, no sábado de manhã, com a congregação na
// frente.
//
// As metades, e nenhuma sozinha prova a tabela:
//
//  1. **A COBERTURA É CONTÍGUA de 1 a 600** — sem lacuna e sem sobreposição. É
//     a única propriedade que pega erro de digitação num limite: encurtar uma
//     faixa abre um buraco, esticá-la invade a vizinha, e as duas coisas são
//     invisíveis olhando a tabela linha a linha.
//  2. **Os 8 blocos são derivados, não uma segunda lista** — e as 28 seções
//     doutrinárias são as 28 crenças fundamentais.
//  3. **`comecaSecao` só responde no PRIMEIRO número** — é ele que decide onde
//     um cabeçalho é desenhado, e um "mudou de seção?" comparando com a linha
//     anterior daria o resultado errado na primeira linha de cada PÁGINA da
//     lista (ela chega de 100 em 100).
//  4. **A FAIXA INFANTIL concorda com o `sorteio.js`** — os dois arquivos têm
//     os mesmos dois números escritos neles, de propósito (módulo puro não
//     importa módulo puro para ler constante), e é aqui que a divergência é
//     pega. Sem esta metade, mudar a tabela e esquecer o sorteio faria o filtro
//     "sem infantis" recusar cinquenta hinos escolhidos ao acaso.
//
// Node puro, sem rede e sem navegador: entra no `apk.yml` **sem
// `continue-on-error`**.
//
//   node tools/hinario.test.mjs
// ============================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checar, falhas } from './checar.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(raiz, 'app/src/main/assets/web/controle/hinario.js');
const SRC_SORTEIO = join(raiz, 'app/src/main/assets/web/controle/sorteio.js');

// Mesma carga do `serie.test.mjs` e do `sorteio.test.mjs`: a IIFE recebe o
// global pelo `this` do `.call`. Zero navegador — se um dia o arquivo passar a
// depender de `document`, isto falha alto, que é o que se quer.
const janela = {};
new Function(readFileSync(SRC, 'utf8')).call(janela);
const H = janela.AVHinario;

checar(!!H, 'o módulo publica AVHinario');
if (!H) { console.log('\n1 FALHA(S)'); process.exit(1); }

// ── 1. A COBERTURA ──────────────────────────────────────────────────────────
const S = H.SECOES;
checar(S.length === 35, 'a tabela tem as 35 seções do hinário', S.length);
checar(S[0].de === 1, 'ela começa no hino 1', S[0].de);
checar(S[S.length - 1].ate === 600, 'e termina no 600 — o hinário novo tem 600 hinos',
  S[S.length - 1].ate);

// A propriedade que pega o erro de digitação. Uma faixa encurtada abre um
// buraco; esticada, invade a vizinha. Nenhuma das duas se vê linha a linha.
const buracos = [];
for (let i = 1; i < S.length; i++) {
  if (S[i].de !== S[i - 1].ate + 1) {
    buracos.push(`${S[i - 1].nome} termina em ${S[i - 1].ate} e ${S[i].nome} começa em ${S[i].de}`);
  }
}
checar(buracos.length === 0,
  'A COBERTURA É CONTÍGUA: cada seção começa exatamente onde a anterior terminou '
  + '— sem lacuna e sem sobreposição', buracos);

// E a outra ponta da mesma pergunta, feita pelo consumidor em vez da tabela:
// TODO número de 1 a 600 tem seção, e uma só.
const semSecao = [];
for (let n = 1; n <= 600; n++) {
  const achadas = S.filter((s) => n >= s.de && n <= s.ate);
  if (achadas.length !== 1) semSecao.push({ n, achadas: achadas.length });
}
checar(semSecao.length === 0,
  'e os 600 hinos caem em EXATAMENTE uma seção cada', semSecao.slice(0, 5));

checar(H.secaoDe(0) === null && H.secaoDe(601) === null && H.secaoDe(-1) === null,
  'fora da faixa devolve null — um hino 601 aparece SEM cabeçalho, que é muito '
  + 'melhor que herdar o rótulo do vizinho');

// Faixas nomeadas, contra a transcrição. São as pontas de cada bloco: se a
// tabela inteira andar uma casa, é aqui que aparece.
const AMOSTRA = [
  [1, 'A Trindade'], [14, 'A Trindade'], [15, 'O Pai'],
  [58, 'As Escrituras Sagradas'], [59, 'A Criação'],
  [70, 'O Grande Conflito'], [293, 'O Sábado'], [315, 'Conduta Cristã'],
  [407, 'Conduta Cristã'], [408, 'O Casamento e a Família'],
  [491, 'A Nova Terra'], [507, 'A Nova Terra'],
  [508, 'Infantis'], [557, 'Infantis'], [558, 'Introito'],
  [587, 'Oração Pastoral'], [588, 'Adoração Infantil'], [600, 'Despedida'],
];
const erradas = AMOSTRA.filter(([n, nome]) => (H.secaoDe(n) || {}).nome !== nome)
  .map(([n, nome]) => `${n} devia ser ${nome}, veio ${(H.secaoDe(n) || {}).nome}`);
checar(erradas.length === 0,
  'e as pontas conferem com o índice publicado (18 números, um par por bloco)', erradas);

// ── 2. OS BLOCOS ────────────────────────────────────────────────────────────
checar(H.BLOCOS.length === 8, 'são 8 blocos: as 6 doutrinas, os infantis e os litúrgicos',
  H.BLOCOS);
const doutrinarias = S.filter((s) => /^A Doutrina/.test(s.bloco)).length;
checar(doutrinarias === 28,
  'e as seções doutrinárias são 28 — as 28 crenças fundamentais', doutrinarias);

// Os blocos são DERIVADOS: cada seção de um bloco é contígua às irmãs, senão a
// derivação teria produzido o mesmo nome duas vezes.
checar(new Set(H.BLOCOS).size === H.BLOCOS.length,
  'nenhum bloco aparece duas vezes — as seções de um bloco são contíguas, e é '
  + 'isso que permite os blocos serem derivados da tabela em vez de uma segunda lista',
  H.BLOCOS);

const idx = H.indice();
checar(idx.length === 8 && idx.reduce((n, b) => n + b.secoes.length, 0) === 35,
  'o índice agrupado devolve os 8 blocos com as 35 seções dentro',
  idx.map((b) => [b.bloco, b.secoes.length]));

// ── 3. O CABEÇALHO SÓ NASCE NO PRIMEIRO NÚMERO ──────────────────────────────
checar(!!H.comecaSecao(290) && H.comecaSecao(290).nome === 'O Sábado',
  '`comecaSecao` responde no primeiro número da seção');
checar(H.comecaSecao(291) === null && H.comecaSecao(299) === null,
  'e NÃO responde no meio nem no fim dela — um cabeçalho por seção, não um por linha');
const inicios = [];
for (let n = 1; n <= 600; n++) if (H.comecaSecao(n)) inicios.push(n);
checar(inicios.length === 35,
  'ao varrer os 600 números saem exatamente 35 cabeçalhos', inicios.length);
checar(inicios.join(',') === S.map((s) => s.de).join(','),
  'e eles caem nos 35 inícios da tabela, nesta ordem');

// ── 4. A FAIXA INFANTIL CONCORDA COM O SORTEIO ──────────────────────────────
const fonteSorteio = readFileSync(SRC_SORTEIO, 'utf8');
const de = /const INFANTIL_DE\s*=\s*(\d+)/.exec(fonteSorteio);
const ate = /const INFANTIL_ATE\s*=\s*(\d+)/.exec(fonteSorteio);
checar(!!de && !!ate,
  'o `sorteio.js` continua declarando INFANTIL_DE/INFANTIL_ATE — se ele parar, '
  + 'esta comparação vira um no-op silencioso e é ESTE checar que avisa');
if (de && ate) {
  const infantil = S.find((s) => s.bloco === 'Hinos Infantis');
  checar(infantil && Number(de[1]) === infantil.de && Number(ate[1]) === infantil.ate,
    'e os dois arquivos concordam sobre a faixa infantil (a duplicação é '
    + 'deliberada; a divergência é o que não pode passar)',
    { sorteio: [Number(de[1]), Number(ate[1])], hinario: infantil && [infantil.de, infantil.ate] });
  checar(H.ehInfantil(Number(de[1])) && H.ehInfantil(Number(ate[1]))
    && !H.ehInfantil(Number(de[1]) - 1) && !H.ehInfantil(Number(ate[1]) + 1),
    '`ehInfantil` é INCLUSIVO nas duas pontas, e só nelas');
}

console.log('');
if (falhas.length) {
  console.log('FALHARAM ' + falhas.length + ':');
  falhas.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('Todos passaram.');
