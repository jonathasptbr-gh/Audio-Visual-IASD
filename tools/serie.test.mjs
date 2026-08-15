#!/usr/bin/env node
// ============================================================================
// A REGRA DA SÉRIE — o que entra no álbum "Provai e Vede 2026", e o que não
//
// ## Por que ele existe
//
// `controle/serie.js` decide, a partir de NOMES, quais playlists de um canal do
// YouTube formam um álbum da Biblioteca e quais vídeos entram nele. Não é uma
// conta de layout: é a peça que escolhe **o que vai ao telão no sábado**. Os
// dois modos de errar são silenciosos, e o oráculo cobra os dois:
//
//   - **aceitar demais** → a versão em LIBRAS entra em par com a de português e
//     o álbum dobra de tamanho, com o intérprete aparecendo na projeção sem
//     ninguém ter pedido;
//   - **aceitar de menos** → um mês inteiro não aparece na Biblioteca, sem erro
//     no console e sem nada na tela que o explique. O operador só descobre no
//     sábado, procurando o vídeo do culto.
//
// ## As strings são VERBATIM do canal, não inventadas
//
// Todas as entradas marcadas `[print]` foram lidas das abas Playlists e Vídeos
// do @provaievedeoficial. É isso que dá valor ao teste: uma nomenclatura
// imaginada prova só que o código concorda com quem o escreveu. As cinco
// armadilhas que elas carregam estão documentadas no topo de `serie.js`; as
// duas que mais importam:
//
//   - **"Provai e Vede Agosto 2026" não tem hífen** enquanto todas as outras
//     têm. Um `^Provai e Vede - ` teria descartado o mês inteiro.
//   - **o marcador de Libras muda de forma** entre os dois níveis: `(Libras)`
//     na playlist e `- Libras` no vídeo.
//
// Node puro, sem rede e sem navegador: entra no `apk.yml` **sem
// `continue-on-error`**.
//
//   node tools/serie.test.mjs
// ============================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(raiz, 'app/src/main/assets/web/controle/serie.js');

// `serie.js` é uma IIFE `(function (global) { … })(this)`: o corpo de um
// `new Function` é não-estrito, então o `this` do topo é o receptor do `.call`.
// É assim que o módulo é carregado sem navegador e sem tocar no `globalThis`
// deste processo — se um dia ele passar a depender de `document`, este teste
// falha alto, que é o que se quer.
const janela = {};
new Function(readFileSync(SRC, 'utf8')).call(janela);
const S = janela.AVSerie;

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

checar(!!S, 'serie.js publica window.AVSerie');
if (!S) { process.exit(1); }

const SERIE = S.SERIES.find((x) => x.id === 'serie-provai-vede-2026');
checar(!!SERIE, 'o catálogo traz a série Provai e Vede 2026');
checar(SERIE && /@provaievedeoficial/.test(SERIE.canal),
  'o canal é o @provaievedeoficial (a ÚNICA constante da descoberta)', SERIE && SERIE.canal);

// ── 1. As playlists, verbatim do print ──────────────────────────────────────
const mes = (n) => S.mesDaPlaylist(n, SERIE);

checar(mes('Provai e Vede - Setembro 2026') === 9, '[print] "- Setembro 2026" → mês 9', mes('Provai e Vede - Setembro 2026'));
checar(mes('Provai e Vede - Agosto 2026') === 8, '[print] "- Agosto 2026" → mês 8', mes('Provai e Vede - Agosto 2026'));
checar(mes('Provai e Vede - Julho 2026') === 7, '[print] "- Julho 2026" → mês 7', mes('Provai e Vede - Julho 2026'));

checar(mes('Provai e Vede - Setembro 2026 (Libras)') === 0, '[print] Libras entre parênteses é recusada');
checar(mes('Provai e Vede - Julho 2026 (Libras)') === 0, '[print] Libras de julho é recusada');
checar(mes('Provai e Vede Agosto 2026 (Libras)') === 0, '[print] Libras SEM hífen é recusada (as duas regras juntas)');

// A ARMADILHA 1, isolada: o mesmo nome sem o hífen e sem Libras TEM de entrar.
// É a única do lote que não aparece no print em português — e é justamente por
// isso que ela está aqui: o canal já provou que escreve assim, e no dia em que
// escrever assim num mês de português, o mês não pode sumir.
checar(mes('Provai e Vede Agosto 2026') === 8,
  'ARMADILHA 1: sem o hífen, o mês continua entrando', mes('Provai e Vede Agosto 2026'));

// A ARMADILHA 2, isolada.
checar(mes('Provai e Vede  -  Agosto  2026') === 8,
  'ARMADILHA 2: espaço duplo em qualquer posição não muda nada', mes('Provai e Vede  -  Agosto  2026'));

// Acento: "Março" é o único mês que o `normalizar` precisa desmontar.
checar(mes('Provai e Vede - Março 2026') === 3, 'acento: "Março" → mês 3', mes('Provai e Vede - Março 2026'));
checar(mes('PROVAI E VEDE - MARÇO 2026') === 3, 'caixa alta não muda nada', mes('PROVAI E VEDE - MARÇO 2026'));

// Recusas que protegem o álbum de conteúdo alheio.
checar(mes('Provai e Vede - Agosto 2025') === 0, 'ano errado é recusado');
checar(mes('Semana de Mordomia Cristã 2026') === 0, 'outra série do mesmo canal é recusada');
checar(mes('Provai e Vede - Especial 2026') === 0, 'sem mês não é playlist mensal');
checar(mes('') === 0 && mes(null) === 0 && mes(undefined) === 0, 'nome vazio/ausente não explode e não entra');

// ── 2. A ordem das playlists ────────────────────────────────────────────────
// O canal lista do mais recente para o mais antigo (é o que o print mostra).
const doCanal = [
  { name: 'Provai e Vede - Setembro 2026 (Libras)', url: 'u1', count: 4 },
  { name: 'Provai e Vede - Setembro 2026', url: 'u2', count: 4 },
  { name: 'Provai e Vede Agosto 2026 (Libras)', url: 'u3', count: 5 },
  { name: 'Provai e Vede - Agosto 2026', url: 'u4', count: 5 },
  { name: 'Provai e Vede - Julho 2026 (Libras)', url: 'u5', count: 4 },
  { name: 'Provai e Vede - Julho 2026', url: 'u6', count: 4 },
  { name: 'Semana de Mordomia Cristã 2026', url: 'u7', count: 8 },
];
const pls = S.playlistsDaSerie(doCanal, SERIE);
checar(pls.length === 3, 'das 7 playlists do canal, 3 são da série em português', pls.length);
checar(pls.map((p) => p.mes).join(',') === '7,8,9',
  'a ordem é CRONOLÓGICA (julho→setembro), não a do canal', pls.map((p) => p.mes));
checar(pls.map((p) => p.url).join(',') === 'u6,u4,u2', 'as URLs certas sobrevivem à ordenação', pls.map((p) => p.url));
checar(S.playlistsDaSerie(null, SERIE).length === 0, 'lista ausente devolve vazio em vez de explodir');

// ── 3. Os vídeos, verbatim do print ─────────────────────────────────────────
// Repare no ESPAÇO DUPLO em "Provai e Vede  2026" dos dois de 15/Ago: está no
// print, e por isso está aqui.
const videosAgosto = [
  { id: 'v1', url: 'y/v1', name: 'Quando o evangelho sussurra | Provai e Vede  2026 (15/Ago) - Libras', seconds: 294 },
  { id: 'v2', url: 'y/v2', name: 'Quando o evangelho sussurra | Provai e Vede  2026 (15/Ago)', seconds: 295 },
  { id: 'v3', url: 'y/v3', name: 'Cada centavo conta | Provai e Vede 2026 (08/Ago) - Libras', seconds: 307 },
  { id: 'v4', url: 'y/v4', name: 'Cada centavo conta | Provai e Vede 2026 (08/Ago)', seconds: 307 },
  { id: 'v5', url: 'y/v5', name: 'Match point | Provai e Vede 2026 (01/Ago) - Libras', seconds: 319 },
  { id: 'v6', url: 'y/v6', name: 'Match point | Provai e Vede 2026 (01/Ago)', seconds: 319 },
];
const itens = S.itensDaPlaylist(videosAgosto, 8, SERIE);
checar(itens.length === 3, 'ARMADILHA 3: "- Libras" no vídeo é recusado (3 de 6 entram)', itens.map((i) => i.id));
checar(itens.every((i) => !/libras/i.test(i.nomeOriginal)), 'nenhum item retido menciona Libras');

// ARMADILHA 4, escrita como asserção para ninguém tentar de novo: os pares têm
// durações iguais (307 × 307) ou a de Libras é MENOR (294 < 295). Não há regra
// de duração que separe as duas versões.
checar(videosAgosto[2].seconds === videosAgosto[3].seconds && videosAgosto[0].seconds < videosAgosto[1].seconds,
  'ARMADILHA 4: a duração não distingue português de Libras');

const ordenados = S.ordenarItens(itens);
checar(ordenados.map((i) => i.dia).join(',') === '1,8,15',
  'os itens ficam em ordem cronológica dentro do mês', ordenados.map((i) => i.dia));
checar(ordenados.every((i) => i.mes === 8), 'a data do título dá o mês dos três', ordenados.map((i) => i.mes));

checar(ordenados[0].titulo === 'Match point',
  'o título é o que vem ANTES da barra — o resto se repete em 52 itens', ordenados[0].titulo);
checar(S.nomeDoItem(ordenados[2]) === '15/Ago · Quando o evangelho sussurra',
  'o nome da lista começa pela DATA, que é por onde se procura', S.nomeDoItem(ordenados[2]));

// ── 4. A REGRA DE OURO: a playlist prova o pertencimento, o título só rotula ──
const semData = S.itensDaPlaylist(
  [{ id: 'x1', url: 'y/x1', name: 'Um episódio sem o padrão de sempre', seconds: 300 }], 8, SERIE);
checar(semData.length === 1, 'REGRA DE OURO: título fora do padrão NÃO impede o vídeo de entrar', semData.length);
checar(semData[0].mes === 8 && semData[0].dia === 0,
  'sem data no título, o mês vem da playlist e o dia fica em branco', semData[0]);
checar(semData[0].titulo === 'Um episódio sem o padrão de sempre',
  'sem a barra, o título inteiro vira o rótulo', semData[0].titulo);
checar(S.nomeDoItem(semData[0]) === 'Um episódio sem o padrão de sempre',
  'e o nome da lista não ganha um "0/undefined" na frente', S.nomeDoItem(semData[0]));

// Item sem dia vai para o FIM do mês dele, nunca para o dia 1.
const misto = S.ordenarItens([
  { id: 'a', mes: 8, dia: 0, ordem: 0 }, { id: 'b', mes: 8, dia: 15, ordem: 1 }, { id: 'c', mes: 7, dia: 4, ordem: 2 },
]);
checar(misto.map((i) => i.id).join('') === 'cba', 'item sem dia vai para o fim do mês dele', misto.map((i) => i.id));

// ── 5. A data do título, isolada ────────────────────────────────────────────
checar(JSON.stringify(S.dataDoVideo('x | y 2026 (07/Mar)')) === '{"dia":7,"mes":3}', '"(07/Mar)" → 7 de março');
checar(JSON.stringify(S.dataDoVideo('x | y 2026 (1/jan)')) === '{"dia":1,"mes":1}', 'dia sem zero à esquerda e mês minúsculo');
checar(S.dataDoVideo('x | y 2026 (32/Ago)') === null, 'dia impossível não é aceito');
checar(S.dataDoVideo('x | y 2026 (15/Xyz)') === null, 'mês inexistente não é aceito');
checar(S.dataDoVideo('sem parênteses nenhum') === null, 'sem data devolve null (e não uma data inventada)');

// ── 5b. A data POR EXTENSO — o MESMO canal usa as duas formas ───────────────
// [print] O episódio de 03/Jan/2026 saiu em DUAS versões, e cada uma escreve a
// data de um jeito: a de Libras usa "(03/Jan)" e a de PORTUGUÊS usa
// "sábado 3 janeiro". Foi assim que ele chegou à lista sem data, no fim de
// janeiro, fora de ordem — o relato do operador, palavra por palavra.
const TIT_EXT = 'Não há órfãos de Deus | Provai e Vede 2026 sábado 3 janeiro';
checar(JSON.stringify(S.dataDoVideo(TIT_EXT)) === '{"dia":3,"mes":1}',
  '[print] "sábado 3 janeiro" → 3 de janeiro', JSON.stringify(S.dataDoVideo(TIT_EXT)));
checar(S.tituloDoEpisodio(TIT_EXT) === 'Não há órfãos de Deus',
  '[print] e o título continua sendo o que vem antes da barra', S.tituloDoEpisodio(TIT_EXT));
checar(JSON.stringify(S.dataDoVideo('x | Provai e Vede 2026 (03/Jan) - Libras')) === '{"dia":3,"mes":1}',
  '[print] e a versão em Libras do MESMO episódio usa a forma compacta');

checar(JSON.stringify(S.dataDoVideo('x | y 2026 3 de janeiro')) === '{"dia":3,"mes":1}', '"3 de janeiro" com o "de"');
checar(JSON.stringify(S.dataDoVideo('x | y 2026 1º de fevereiro')) === '{"dia":1,"mes":2}', 'o ordinal "1º" é consumido');
checar(JSON.stringify(S.dataDoVideo('x | y 2026 sabado 28 marco')) === '{"dia":28,"mes":3}', 'sem acento, como o canal às vezes escreve');
checar(JSON.stringify(S.dataDoVideo('x | y sábado 7 mar')) === '{"dia":7,"mes":3}', 'e a abreviação de três letras por extenso');

// A forma por extenso NÃO pode inventar data onde não há.
checar(S.dataDoVideo('Provai e Vede 2026') === null, 'só o ano não é data — "2026" não vira dia de mês nenhum');
checar(S.dataDoVideo('Especial de 3 partes | Provai e Vede') === null, '"3 partes" não é uma data');
checar(S.dataDoVideo('O sonho de 3 marcos | Provai e Vede') === null, '"3 marcos" é nome próprio, não 3 de março');
checar(S.dataDoVideo('x | y 2026 sábado 32 janeiro') === null, 'dia impossível continua recusado na forma extensa');

// E a ORDEM, que é o que o operador perdeu: com a data lida, o episódio de
// janeiro volta para o lugar dele em vez de ir para o fim do mês.
const jan = S.ordenarItens(S.itensDaPlaylist([
  { id: 'j2', url: 'y/j2', name: 'Segundo | Provai e Vede 2026 (10/Jan)', seconds: 300 },
  { id: 'j1', url: 'y/j1', name: TIT_EXT, seconds: 306 },
], 1, SERIE));
checar(jan.map((i) => i.dia).join(',') === '3,10',
  'o episódio com data por extenso ORDENA junto com os outros', JSON.stringify(jan.map((i) => i.dia)));
checar(S.nomeDoItem(jan[0]) === '03/Jan · Não há órfãos de Deus',
  'e ganha o MESMO identificador de data dos outros', S.nomeDoItem(jan[0]));

// ── 6. O marcador de Libras nas duas formas, isolado ─────────────────────────
checar(S.ehLibras('Provai e Vede - Julho 2026 (Libras)'), 'ARMADILHA 3a: "(Libras)" é detectado');
checar(S.ehLibras('Match point | Provai e Vede 2026 (01/Ago) - Libras'), 'ARMADILHA 3b: "- Libras" é detectado');
checar(S.ehLibras('ALGO EM LIBRAS'), 'caixa alta é detectada');
checar(!S.ehLibras('Palavras que libertam'), '"libertam" não é "libras" (a busca é pela PALAVRA)');

// ── 7. A SEGUNDA SÉRIE: o Informativo Mundial das Missões (v5.244) ──────────
//
// @daniellocutor. Ela existe neste arquivo para provar que o catálogo é
// catálogo — mas o que ela de fato prova é o contrário do que se esperava: três
// suposições do Provai e Vede eram suposições, e não regras.
//
//   - a playlist é do TRIMESTRE, não do mês;
//   - o título do vídeo NÃO tem nome de episódio (a história vive na miniatura);
//   - o canal publica a MESMA série em quatro idiomas, lado a lado.
//
// **Sobre o que é verbatim aqui.** Os nomes das PLAYLISTS foram lidos inteiros
// na aba Playlists. Os títulos dos VÍDEOS aparecem TRUNCADOS naquela lista
// ("… | 15 AGO…"); um deles foi lido inteiro na página do vídeo — o de 15 de
// agosto — e é dele que sai a forma completa. Os outros estão reconstruídos, e
// por isso o mês é afirmado nas DUAS escritas possíveis (AGOSTO e AGO): não dá
// para saber, do print, qual delas o canal usa nos demais, e a regra tem de
// aguentar as duas. Fingir certeza aqui seria provar o código contra um canal
// imaginado — a lição da v5.204.
const INFO = S.SERIES.find((x) => x.id === 'serie-informativo-missoes-2026');
checar(!!INFO, 'o catálogo traz a série do Informativo Mundial das Missões');
checar(INFO && /@daniellocutor/.test(INFO.canal),
  'o canal é o @daniellocutor', INFO && INFO.canal);
checar(INFO && INFO.periodo === S.PERIODO_TRIMESTRE,
  'as playlists dela são TRIMESTRAIS', INFO && INFO.periodo);
checar(INFO && INFO.titulo === S.TITULO_NENHUM,
  'e o título do vídeo não carrega nome de episódio', INFO && INFO.titulo);

// ── 7a. A aba Playlists, verbatim do print — QUATRO idiomas lado a lado ─────
const canalInfo = [
  { name: 'Misiones | 3º Trimestre 2026', url: 'd/es3', count: 6 },
  { name: '【聖工消息】2026 第三季 (3 Quarter 26)', url: 'd/zh3', count: 9 },
  { name: 'Informativo | 4º Trimestre 2026', url: 'd/pt4', count: 12 },
  { name: '【聖工消息】2026 第二季 (2 Quarter 26)', url: 'd/zh2', count: 12 },
  { name: 'Informativo | 3º Trimestre 2026', url: 'd/pt3', count: 13 },
  { name: 'Mission Stories | 2º Quarter 2026', url: 'd/en2', count: 13 },
];
const plsInfo = S.playlistsDaSerie(canalInfo, INFO);
checar(plsInfo.length === 2,
  '[print] das 6 playlists do canal, só as 2 em PORTUGUÊS entram', plsInfo.map((p) => p.name));
checar(plsInfo.map((p) => p.url).join(',') === 'd/pt3,d/pt4',
  '[print] e elas vêm em ordem cronológica (3º antes do 4º trimestre)', plsInfo.map((p) => p.url));
checar(plsInfo.map((p) => p.mes).join(',') === '7,10',
  'o trimestre vira o MÊS EM QUE ELE COMEÇA — é isso que ordena e serve de piso',
  plsInfo.map((p) => p.mes));

const mesI = (n) => S.mesDaPlaylist(n, INFO);
checar(mesI('Informativo | 1º Trimestre 2026') === 1, '"1º Trimestre" → mês 1', mesI('Informativo | 1º Trimestre 2026'));
checar(mesI('Informativo | 2º Trimestre 2026') === 4, '"2º Trimestre" → mês 4', mesI('Informativo | 2º Trimestre 2026'));
checar(mesI('Informativo | 3º Trimestre 2026') === 7, '[print] "3º Trimestre" → mês 7', mesI('Informativo | 3º Trimestre 2026'));
checar(mesI('Informativo | 4º Trimestre 2026') === 10, '[print] "4º Trimestre" → mês 10', mesI('Informativo | 4º Trimestre 2026'));
checar(mesI('Informativo | 3o Trimestre 2026') === 7 && mesI('Informativo | 3 Trimestre 2026') === 7,
  'o ordinal é opcional e vale nas três escritas ("3º", "3o", "3")');
checar(mesI('INFORMATIVO  |  4º  TRIMESTRE  2026') === 10,
  'caixa alta e espaço duplo não mudam nada aqui também');

// As RECUSAS, que são a razão de a segunda série ser mais perigosa que a
// primeira: elas não protegem o álbum de outra série, protegem de OUTRO IDIOMA
// da MESMA série — e o par chega completo, semana a semana.
checar(mesI('Misiones | 3º Trimestre 2026') === 0, '[print] a playlist em ESPANHOL é recusada');
checar(mesI('Mission Stories | 2º Quarter 2026') === 0, '[print] a playlist em INGLÊS é recusada');
checar(mesI('【聖工消息】2026 第三季 (3 Quarter 26)') === 0, '[print] a playlist em CHINÊS é recusada');
checar(mesI('Informativo | 3º Trimestre 2025') === 0, 'outro ano é recusado');
checar(mesI('Informativo | 3º Trimestre 2026 (Libras)') === 0, 'e Libras continua recusado nesta série também');
checar(mesI('Informativo Mundial das Missões') === 0, 'sem trimestre e sem ano não é playlist de período');
checar(S.mesDaPlaylist('Provai e Vede - Agosto 2026', INFO) === 0,
  'e a playlist da OUTRA série não entra nesta (o prefixo separa)');

// A trava do período, nos dois sentidos — sem ela, uma série mensal aceitaria
// uma playlist trimestral e vice-versa, calada.
checar(S.mesDaPlaylist('Informativo | Agosto 2026', INFO) === 0,
  'numa série TRIMESTRAL, um nome de mês não vale como período', S.mesDaPlaylist('Informativo | Agosto 2026', INFO));
checar(S.mesDaPlaylist('Provai e Vede - 3º Trimestre 2026', SERIE) === 0,
  'e numa série MENSAL, um trimestre não vale como período');

// ── 7b. Os vídeos: a data é o rótulo, porque o título não tem outro ─────────
// [print] O de 15/Ago foi lido INTEIRO na página do vídeo. Os demais estão
// reconstruídos do print truncado da lista (ver a nota no topo desta seção).
const videosQ3 = [
  { id: 'i1', url: 'd/i1', name: 'Informativo Mundial das Missões | 15 AGOSTO 2026', seconds: 155 },
  { id: 'i2', url: 'd/i2', name: 'Informativo Mundial das Missões | 04 JULHO 2026', seconds: 184 },
  { id: 'i3', url: 'd/i3', name: 'Informativo Mundial das Missões | 26 SETEMBRO 2026', seconds: 179 },
];
const itensInfo = S.ordenarItens(S.itensDaPlaylist(videosQ3, 7, INFO));
checar(itensInfo.length === 3, 'os três episódios entram', itensInfo.length);
checar(itensInfo.map((i) => i.mes + '/' + i.dia).join(',') === '7/4,8/15,9/26',
  'a data do TÍTULO dá o mês de cada um — o trimestre da playlist é só o piso',
  itensInfo.map((i) => i.mes + '/' + i.dia));
checar(itensInfo.map((i) => S.nomeDoItem(i)).join(' | ') === '04/Jul | 15/Ago | 26/Set',
  'o nome da lista é a DATA, e só ela: o título é igual nos 52 episódios',
  itensInfo.map(S.nomeDoItem));
checar(!itensInfo.some((i) => /Informativo Mundial/.test(S.nomeDoItem(i))),
  'a metade constante do título NÃO ocupa a linha — era ela que não distinguia nada');

// A abreviação de três letras, que é como o print TRUNCADO deixa em dúvida.
const abrev = S.itensDaPlaylist(
  [{ id: 'i4', url: 'd/i4', name: 'Informativo Mundial das Missões | 08 AGO 2026', seconds: 175 }], 7, INFO);
checar(abrev.length === 1 && abrev[0].dia === 8 && abrev[0].mes === 8,
  '"08 AGO 2026" (a forma abreviada) lê a mesma data que "08 AGOSTO 2026"', abrev[0]);
checar(S.nomeDoItem(abrev[0]) === '08/Ago', 'e produz o mesmo rótulo', S.nomeDoItem(abrev[0]));

// O ANO no fim do título NÃO pode virar dia de mês nenhum — é a armadilha que
// esta forma de escrever a data cria, e ela não existia no Provai e Vede.
checar(JSON.stringify(S.dataDoVideo('Informativo Mundial das Missões | 15 AGOSTO 2026')) === '{"dia":15,"mes":8}',
  '[print] o "2026" logo depois do mês não desloca a leitura da data',
  JSON.stringify(S.dataDoVideo('Informativo Mundial das Missões | 15 AGOSTO 2026')));
checar(S.dataDoVideo('Informativo Mundial das Missões | 3º Trimestre 2026') === null,
  '"3º Trimestre" não é uma data (o mês tem de SER um mês)');

// OUTUBRO — o mês que o ordinal comia, e o defeito estava aqui desde a v5.230.
// `[ºo°]?` depois de um `\s*` casava o "o" de "outubro" como ordinal e entregava
// o mês "utubro"; o regex ACERTAVA e quem recusava era o `montarData`, calado. O
// Provai e Vede nunca o exercitou (nenhum título de outubro caiu na forma por
// extenso); o Informativo o exercita com um TRIMESTRE inteiro.
checar(JSON.stringify(S.dataDoVideo('Informativo Mundial das Missões | 03 OUTUBRO 2026')) === '{"dia":3,"mes":10}',
  'OUTUBRO: o ordinal não pode comer a primeira letra do mês',
  JSON.stringify(S.dataDoVideo('Informativo Mundial das Missões | 03 OUTUBRO 2026')));
checar(JSON.stringify(S.dataDoVideo('x | Provai e Vede 2026 sábado 3 outubro')) === '{"dia":3,"mes":10}',
  'e a MESMA correção vale para a primeira série, que tinha o mesmo buraco');
checar(JSON.stringify(S.dataDoVideo('x | y 2026 1º de outubro')) === '{"dia":1,"mes":10}',
  'com o ordinal de verdade ("1º") em cima de outubro, os dois convivem');
checar(JSON.stringify(S.dataDoVideo('x | y 2026 3o de outubro')) === '{"dia":3,"mes":10}',
  'e o ordinal escrito com "o" COLADO no dia continua sendo ordinal');
checar(JSON.stringify(S.dataDoVideo('Parte 2 | Informativo Mundial das Missões | 15 AGOSTO 2026')) === '{"dia":15,"mes":8}',
  'um número ANTES da data não faz a data se perder: a varredura tenta todos os candidatos',
  JSON.stringify(S.dataDoVideo('Parte 2 | Informativo Mundial das Missões | 15 AGOSTO 2026')));

// ── 7c. A REGRA DE OURO com o título vazio: a linha NUNCA fica em branco ────
const semNada = S.itensDaPlaylist(
  [{ id: 'i9', url: 'd/i9', name: 'Especial de encerramento do trimestre', seconds: 300 }], 7, INFO);
checar(semNada.length === 1, 'REGRA DE OURO: sem data e fora do padrão, o vídeo entra assim mesmo');
checar(semNada[0].mes === 7 && semNada[0].dia === 0,
  'sem data, ele cai no COMEÇO do trimestre da playlist', semNada[0]);
checar(S.nomeDoItem(semNada[0]) === 'Especial de encerramento do trimestre',
  'e o nome cai no título CRU — nunca numa linha vazia, que seria intocável na lista',
  S.nomeDoItem(semNada[0]));

// ── 7d. O IDIOMA DO VÍDEO — a recusa que o prefixo NÃO faz ──────────────────
// Em espanhol o vídeo começa com a MESMA palavra ("Informativo Mundial de las
// Misiones"), então dentro da playlist de português ele seria indistinguível.
// Um só que passe vai ao telão do culto num idioma que a congregação não fala.
const misturado = S.itensDaPlaylist([
  { id: 'm1', url: 'd/m1', name: 'Informativo Mundial das Missões | 15 AGOSTO 2026', seconds: 155 },
  { id: 'm2', url: 'd/m2', name: 'Informativo Mundial de las Misiones | 15 AGOSTO 2026', seconds: 155 },
  { id: 'm3', url: 'd/m3', name: 'Mission Spotlight | 15 AUGUST 2026', seconds: 155 },
  { id: 'm4', url: 'd/m4', name: '【聖工消息】2026年8月15日', seconds: 155 },
], 7, INFO);
checar(misturado.length === 1 && misturado[0].id === 'm1',
  'dos 4 idiomas na MESMA playlist, só o português entra', misturado.map((i) => i.id));

checar(S.ehOutroIdioma('Informativo Mundial de las Misiones | 15 AGOSTO 2026'), 'espanhol: "de las Misiones"');
checar(S.ehOutroIdioma('Misión en la ciudad'), 'espanhol: "Misión" (o acento não escapa — tudo passa por normalizar)');
checar(S.ehOutroIdioma('Mission Stories | 2º Quarter 2026'), 'inglês: "Mission"');
checar(S.ehOutroIdioma('【聖工消息】2026 第三季'), 'chinês: pela ESCRITA, porque não há palavra que dê para procurar');
checar(S.ehOutroIdioma('Миссия'), 'cirílico é reconhecido pela escrita');

// E a metade NEGATIVA, que é a que impede a recusa de virar "só entra o que eu
// imaginei": nenhum título legítimo dos DOIS canais pode ser recusado.
checar(!S.ehOutroIdioma('Informativo Mundial das Missões | 15 AGOSTO 2026'),
  'e o título em PORTUGUÊS não é recusado — "missões" nunca é "mission"');
checar(!S.ehOutroIdioma('A missão de Enoc | Provai e Vede 2026 (15/Ago)'),
  '"missão" no singular também passa');
checar(!S.ehOutroIdioma('Ação, coração e São Paulo 🙏'),
  'acentos e emoji não são "outro idioma" (as faixas param antes dos emoji)');
checar(videosAgosto.every((v) => !S.ehOutroIdioma(v.name)) && doCanal.every((p) => !S.ehOutroIdioma(p.name)),
  'e NENHUM nome do @provaievedeoficial é recusado pela regra nova — ela não pode cobrar da primeira série');

// ── 7e. A IMPRESSÃO DIGITAL enxerga as recusas de idioma ────────────────────
// Sem isto, corrigir uma marca de idioma deixaria de pé todo índice já escrito
// — com o vídeo em espanhol dentro dele, para sempre. É o defeito da v5.233,
// que custou uma versão inteira para ser diagnosticado.
checar(/^r[0-9a-z]+$/.test(S.impressao()), 'a impressão é uma string curta e estável', S.impressao());
checar(S.impressao() !== S.impressao('outra função'),
  'e ela muda quando o montador da faixa muda (a fresta da v5.236)');

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
