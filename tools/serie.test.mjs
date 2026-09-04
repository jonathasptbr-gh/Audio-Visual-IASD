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
import { checar, falhas } from './checar.mjs';

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

// ── 3-B. O CANAL ATRAVESSA A REGRA (v1.5.21) ────────────────────────────────
//
// O `author` chega do shell em TODO item de playlist (`anexarVideo` o põe por
// item) e era descartado aqui — a regra lia o `name` e nada mais. Ele é o
// "canal" da gaveta de detalhe, e o que o torna interessante é que ele é
// exatamente a string que a ARMADILHA 5 proíbe de usar como critério: os vídeos
// desta série vêm como COLABORAÇÃO, com dois canais no nome. Filtrar por ele
// derrubaria o álbum inteiro; MOSTRÁ-LO é dizer a verdade sobre quem publicou.
//
// As duas metades, e nenhuma basta sozinha: sem a primeira o campo pode nascer
// sempre vazio e ninguém nota (a gaveta simplesmente não desenha a linha); sem
// a segunda, um `canal: v.author` sem o `|| ''` deixa `undefined` viajar para
// dentro do índice guardado e daí para a tela.
const VERBATIM_AUTOR = 'Provai e Vede | Oficial e Adventist Mission';
const comAutor = S.itensDaPlaylist(
  [{ id: 'c1', url: 'y/c1', name: 'Match point | Provai e Vede 2026 (01/Ago)', seconds: 319,
    author: VERBATIM_AUTOR }], 8, SERIE);
checar(comAutor[0].canal === VERBATIM_AUTOR,
  'o CANAL sobrevive à regra, VERBATIM — inclusive a colaboração de dois nomes que a ARMADILHA 5 '
  + 'proíbe de virar filtro: aqui ele é TRANSPORTE, e o que decide pertencimento continua sendo a playlist',
  comAutor[0].canal);
checar(comAutor.length === 1,
  'e ele não decide NADA: o mesmo item entra com o autor que for — a regra de ouro fica intacta',
  comAutor.length);
checar(videosAgosto.every((v) => v.author === undefined) && itens.every((i) => i.canal === ''),
  'AUSENTE ele vira string VAZIA, nunca `undefined`: é a diferença entre a gaveta não desenhar a '
  + 'linha e a gaveta escrever "undefined" num card que o operador lê',
  itens.map((i) => JSON.stringify(i.canal)));

// E o TÍTULO CRU continua ao lado do rótulo. Ele já viajava (`nomeOriginal`) e
// nunca foi afirmado como DADO — só como negativa ("nenhum menciona Libras").
// É ele o "nome completo" do pedido do operador, e a razão de existir é que o
// rótulo da lista é PODADO por construção: a data na frente, o pedaço à
// esquerda da barra — e no `TITULO_SERIE` o nome do episódio some inteiro.
checar(ordenados[0].nomeOriginal === 'Match point | Provai e Vede 2026 (01/Ago)'
  && ordenados[0].titulo === 'Match point',
  'o TÍTULO CRU e o rótulo PODADO convivem no mesmo item — é a diferença entre eles que faz a '
  + 'linha do card valer a pena', [ordenados[0].nomeOriginal, ordenados[0].titulo]);
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
// v5.271: o item saía com SÓ A DATA. O relato do operador é que o
// item SAI do álbum — mandado ao Cronograma ou aos Favoritos, ele perde o
// cabeçalho que dizia qual é a série e vira "15/Ago · YouTube", sem nada em
// lugar nenhum que o identifique. `TITULO_SERIE` põe o nome da série no lugar
// do nome de episódio que aquele canal não publica.
checar(INFO && INFO.titulo === S.TITULO_SERIE,
  'e o nome do episódio é a PRÓPRIA SÉRIE — aquele canal não publica um',
  INFO && INFO.titulo);
checar(INFO && INFO.rotulo === 'Informativo Mundial das Missões',
  'com o rótulo SEM o ano: ele já está na data ao lado', INFO && INFO.rotulo);

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
// O `hoje` é FIXO nos casos abaixo: o Informativo esconde o que ainda não saiu
// (secção 7g), e sem uma data de referência este arquivo passaria ou reprovaria
// conforme o dia em que fosse rodado — que é a definição de teste instável.
const FIM_DE_ANO = new Date(2026, 11, 31);
const itensInfo = S.ordenarItens(S.itensDaPlaylist(videosQ3, 7, INFO, FIM_DE_ANO));
checar(itensInfo.length === 3, 'os três episódios entram', itensInfo.length);
// O TÍTULO CRU (v1.5.21) — e é AQUI que ele prova o seu valor, não no Provai e
// Vede. No `TITULO_SERIE` o nome do episódio é descartado INTEIRO: o rótulo da
// lista vira "15/Ago · Informativo Mundial das Missões", que é a mesma frase em
// 52 linhas. O cru é a única coisa que distingue um episódio do outro fora da
// data, e sem ele a gaveta de detalhe não teria o que dizer.
checar(itensInfo[1].nomeOriginal === 'Informativo Mundial das Missões | 15 AGOSTO 2026',
  'o TÍTULO CRU sobrevive inteiro à regra, com a barra e a data que o rótulo já consumiu',
  itensInfo[1].nomeOriginal);
checar(S.nomeDoItem(itensInfo[1]) !== itensInfo[1].nomeOriginal,
  'e ele DIFERE do rótulo formatado — é essa diferença que a gaveta desenha, e é por isso que o '
  + 'card compara os dois em vez de escrever o cru sempre',
  [S.nomeDoItem(itensInfo[1]), itensInfo[1].nomeOriginal]);
checar(itensInfo.map((i) => i.mes + '/' + i.dia).join(',') === '7/4,8/15,9/26',
  'a data do TÍTULO dá o mês de cada um — o trimestre da playlist é só o piso',
  itensInfo.map((i) => i.mes + '/' + i.dia));
checar(itensInfo.map((i) => S.nomeDoItem(i)).join(' | ')
  === '04/Jul · Informativo Mundial das Missões | 15/Ago · Informativo Mundial das Missões'
    + ' | 26/Set · Informativo Mundial das Missões',
  'o nome da lista é a DATA e a SÉRIE — a data ordena, a série identifica quando '
  + 'o item sai do álbum', itensInfo.map(S.nomeDoItem));
checar(itensInfo.every((i) => /Informativo Mundial/.test(S.nomeDoItem(i))),
  'e ela está em TODOS: dentro do álbum é repetição, no Cronograma é a única '
  + 'coisa que distingue aquele item de outro vídeo qualquer');

// A abreviação de três letras, que é como o print TRUNCADO deixa em dúvida.
const abrev = S.itensDaPlaylist(
  [{ id: 'i4', url: 'd/i4', name: 'Informativo Mundial das Missões | 08 AGO 2026', seconds: 175 }],
  7, INFO, FIM_DE_ANO);
checar(abrev.length === 1 && abrev[0].dia === 8 && abrev[0].mes === 8,
  '"08 AGO 2026" (a forma abreviada) lê a mesma data que "08 AGOSTO 2026"', abrev[0]);
checar(S.nomeDoItem(abrev[0]) === '08/Ago · Informativo Mundial das Missões',
  'e produz o mesmo rótulo', S.nomeDoItem(abrev[0]));

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
  [{ id: 'i9', url: 'd/i9', name: 'Especial de encerramento do trimestre', seconds: 300 }],
  7, INFO, FIM_DE_ANO);
checar(semNada.length === 1, 'REGRA DE OURO: sem data e fora do padrão, o vídeo entra assim mesmo');
checar(semNada[0].mes === 7 && semNada[0].dia === 0,
  'sem data, ele cai no COMEÇO do trimestre da playlist', semNada[0]);
// Sem data, sobra a SÉRIE — e é ela que o `nomeDoItem` usa, não o título cru.
// A regra de ouro continua intacta: o vídeo ENTRA, e com uma linha que se lê.
checar(S.nomeDoItem(semNada[0]) === 'Informativo Mundial das Missões',
  'e o nome cai na SÉRIE — nunca numa linha vazia, que seria intocável na lista',
  S.nomeDoItem(semNada[0]));

// ── 7c-1. O ITEM SEM NOME NENHUM: entra, e a linha NÃO fica em branco ──────
// `name` vazio vindo do extrator. A regra de ouro decide o que fazer com ele: o
// vídeo é PROJETÁVEL (id, url, duração e miniatura vieram inteiros), então
// recusá-lo seria trocar uma linha feia pelo sábado sem o vídeo do culto. O que
// não pode existir é a linha VAZIA — intocável e inexplicável na lista.
const semNome = S.itensDaPlaylist([
  { id: 'v0', url: 'y/v0', name: '', seconds: 300 },
  { id: 'v1', url: 'y/v1', name: '   ', seconds: 300 },
], 8, SERIE);
checar(semNome.length === 2, 'REGRA DE OURO: sem nome nenhum, os vídeos ENTRAM assim mesmo', semNome.length);
checar(S.nomeDoItem(semNome[0]) === 'vídeo v0',
  'e o rótulo cai no ID do vídeo, que é o último identificador que sempre existe',
  S.nomeDoItem(semNome[0]));
checar(S.nomeDoItem(semNome[1]) === 'vídeo v1',
  'nome só de espaços é a mesma linha em branco, e cai no mesmo lugar',
  S.nomeDoItem(semNome[1]));
checar(S.avaliarVideo({ id: '', url: 'y/x', name: '' }, SERIE).motivo === S.MOTIVO_SEM_ID,
  'e sem ID ele nem chega ao rótulo: a recusa é a que já existia');

// ── 7d. O IDIOMA DO VÍDEO — a recusa que o prefixo NÃO faz ──────────────────
// Em espanhol o vídeo começa com a MESMA palavra ("Informativo Mundial de las
// Misiones"), então dentro da playlist de português ele seria indistinguível.
// Um só que passe vai ao telão do culto num idioma que a congregação não fala.
const misturado = S.itensDaPlaylist([
  { id: 'm1', url: 'd/m1', name: 'Informativo Mundial das Missões | 15 AGOSTO 2026', seconds: 155 },
  { id: 'm2', url: 'd/m2', name: 'Informativo Mundial de las Misiones | 15 AGOSTO 2026', seconds: 155 },
  { id: 'm3', url: 'd/m3', name: 'Mission Spotlight | 15 AUGUST 2026', seconds: 155 },
  { id: 'm4', url: 'd/m4', name: '【聖工消息】2026年8月15日', seconds: 155 },
], 7, INFO, FIM_DE_ANO);
checar(misturado.length === 1 && misturado[0].id === 'm1',
  'dos 4 idiomas na MESMA playlist, só o português entra', misturado.map((i) => i.id));

// ── 7d-1. O FALSO POSITIVO QUE CUSTOU UM EPISÓDIO (v5.252) ──────────────────
// [registro] Primeira varredura em aparelho de verdade. A regra recusou este
// título — um episódio em PORTUGUÊS, do canal certo, na playlist certa — porque
// o marcador de inglês era a palavra solta `mission`. O sábado 27 de junho
// simplesmente não estava na lista, que é o erro que este arquivo inteiro
// existe para evitar.
//
// Ele está no topo desta seção de propósito: é o caso que decide a régua. Uma
// marca de idioma tem de ser IMPOSSÍVEL na língua que se quer manter, não
// apenas típica da que se quer recusar — e títulos em português usam palavras
// em inglês o tempo todo.
const REFOCUS = 'Mission Refocus | Provai e Vede  2026 (27/Jun)';
checar(!S.ehOutroIdioma(REFOCUS),
  '[registro] "Mission Refocus" é um episódio EM PORTUGUÊS e não pode ser recusado');
const junho = S.itensDaPlaylist([{ id: 'r1', url: 'y/r1', name: REFOCUS, seconds: 300 }], 6, SERIE);
checar(junho.length === 1 && junho[0].dia === 27 && junho[0].mes === 6,
  '[registro] ele ENTRA, com a data de 27 de junho', JSON.stringify(junho[0] || null));
checar(junho.length === 1 && S.nomeDoItem(junho[0]) === '27/Jun · Mission Refocus',
  '[registro] e com o rótulo que o operador procura', junho.length && S.nomeDoItem(junho[0]));

// E as recusas que continuam valendo, pelo NOME DO PROGRAMA — todos [registro],
// lidos da aba de playlists do @daniellocutor.
checar(S.ehOutroIdioma('Mission Stories | 2º Quarter 2026'), '[registro] inglês: "Mission Stories"');
checar(S.ehOutroIdioma('World Mission | 1º Quarter 2025'), '[registro] inglês: "World Mission"');
checar(S.ehOutroIdioma('Mission Spotlight | 15 AUGUST 2026'), 'inglês: "Mission Spotlight"');
checar(S.ehOutroIdioma('Missionnaire - 1e Trimestre 2026'), '[registro] francês: "Missionnaire"');
checar(!S.ehOutroIdioma('Missionário de fé | Provai e Vede 2026 (10/Mai)'),
  'e "missionário" em português NÃO é "missionnaire"');

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

// ── 7d-2. LARGURA FIXA: pontuação NÃO é escrita — EM PAR com a que é ───────
// A faixa das formas de largura fixa (U+FF00-FFEF) tem duas metades opostas, e
// a régua tem de separá-las. E a régua NÃO é "escrita sim, pontuação não" — a
// pontuação CJK (【】。「」、・) fica na lista de recusa de propósito, porque ela
// só existe em título CJK. É outra coisa: no começo da faixa mora o ASCII de
// largura fixa (｜！＠…), que UM TECLADO PORTUGUÊS PRODUZ e aparece em título
// copiado de qualquer lugar; a partir de FF61 moram o katakana e o hangul de
// meia-largura, que não aparecem em português nunca.
// Recusar a metade de baixo é o defeito da v5.252 ("Mission Refocus") outra
// vez: o episódio some do sábado por causa de um caractere de enfeite.
//
// Os dois lados JUNTOS, sempre: afrouxar a faixa até engolir o katakana devolve
// o erro oposto — o vídeo em japonês no telão do culto.
const PIPE_LARGO = 'A missão de Enoc ｜ Provai e Vede 2026 (15/Ago)';
checar(!S.ehOutroIdioma(PIPE_LARGO),
  'o "｜" de largura fixa um teclado português digita: o episódio não pode ser recusado');
const pipe = S.itensDaPlaylist([{ id: 'w1', url: 'y/w1', name: PIPE_LARGO, seconds: 300 }], 8, SERIE);
// Ele ENTRA, com a data — que é o que a correção compra. O `tituloDoEpisodio`
// continua cortando só na barra ASCII, então o rótulo sai comprido; é o
// desfecho que o KDoc dele já declara ("um rótulo comprido é melhor que um
// rótulo vazio"), e comprido o operador lê, ausente ele não.
checar(pipe.length === 1 && pipe[0].dia === 15 && pipe[0].mes === 8,
  'e ele ENTRA, com a data de 15 de agosto', JSON.stringify(pipe[0] || null));
checar(pipe.length === 1 && S.nomeDoItem(pipe[0]).startsWith('15/Ago · A missão de Enoc'),
  'e o rótulo começa pela data, que é por onde o operador procura o sábado',
  pipe.length && S.nomeDoItem(pipe[0]));
checar(S.ehOutroIdioma('ﾐｯｼｮﾝ ﾆｭｰｽ 2026'),
  'e o katakana de MEIA-LARGURA (ff61-ff9f) continua recusado — ele não aparece em português');
checar(S.ehOutroIdioma('ﾡﾢﾣ 2026'),
  'o mesmo para o hangul de meia-largura (ffa0-ffdc)');

// ── 7f. A ABA REAL DOS DOIS CANAIS, verbatim do registro do aparelho ────────
// A primeira varredura de verdade devolveu **94 playlists** no
// @provaievedeoficial e **145** no @daniellocutor — números que nenhuma
// suposição minha tinha alcançado, e que trouxeram nomenclaturas que eu não
// teria inventado. Estas são as que ensinam alguma coisa:
const ABA_REAL = [
  // [registro] espaço duplo ANTES do hífen, no meio do nome (armadilha 2).
  ['Provai e Vede  - Agosto 2025 (Libras)', 'pv', 0, 'espaço duplo antes do hífen'],
  // [registro] "vede" em minúscula.
  ['Provai e vede - Junho 2025 (Libras)', 'pv', 0, 'a caixa do nome varia no próprio canal'],
  // [registro] ANO ANTES DO MÊS — a ordem que a regra não casa de propósito.
  ['Provai e Vede 2024 - Março (Libras)', 'pv', 0, 'ano antes do mês, e ainda assim lido'],
  // [registro] espaço duplo antes do parêntese.
  ['Provai e Vede - Fevereiro 2026  (Libras)', 'pv', 0, 'Libras com espaço duplo antes'],
  // [registro] as nove que de fato entraram.
  ['Provai e Vede - Janeiro 2026', 'pv', 1, 'janeiro entra'],
  ['Provai e Vede - Setembro 2026', 'pv', 9, 'setembro entra'],
  // [registro] o mesmo mês de outro ano NÃO entra.
  ['Provai e Vede - Setembro 2025', 'pv', 0, 'o mesmo mês de 2025 fica fora'],
  // [registro] @daniellocutor: as quatro aceitas e as vizinhas perigosas.
  ['Informativo | 1º Trimestre 2026', 'info', 1, '1º trimestre entra'],
  ['Informativo | 4º Trimestre 2026', 'info', 10, '4º trimestre entra'],
  ['Informativo | 2º Trimestre 2025', 'info', 0, 'o MESMO nome de 2025 fica fora'],
  ['Missionnaire - 1e Trimestre 2026', 'info', 0, 'o francês fica fora'],
  ['Mission Stories | 1º Quarter 2026', 'info', 0, 'o inglês fica fora'],
  ['Misiones | 2º Trimestre 2026', 'info', 0, 'o espanhol fica fora'],
  ['【聖工消息】2026 第三季 (3 Quarter 26)', 'info', 0, 'o chinês fica fora'],
  ['时事通讯 - 2024 年第二季度 (2nd Quarter 24)', 'info', 0, 'o chinês simplificado também'],
  ['Curso de Locução', 'info', 0, 'outra coisa do mesmo canal fica fora'],
  ['Provai e Vede 2023', 'info', 0, 'e a OUTRA SÉRIE, que este canal também publica'],
];
let abaOk = 0;
for (const [nome, qual, esperado, oque] of ABA_REAL) {
  const alvo = qual === 'pv' ? SERIE : INFO;
  const obtido = S.mesDaPlaylist(nome, alvo);
  if (obtido === esperado) abaOk++;
  else checar(false, '[registro] ' + oque + ' — "' + nome + '"', obtido);
}
checar(abaOk === ABA_REAL.length,
  '[registro] as ' + ABA_REAL.length + ' playlists REAIS dos dois canais são classificadas como devem',
  abaOk + '/' + ABA_REAL.length);

// E a que mais importa das dezessete: o canal do Informativo publica o Provai e
// Vede TAMBÉM. Sem o prefixo, uma série entraria na outra.
checar(S.mesDaPlaylist('Provai e Vede 2023', INFO) === 0
  && S.mesDaPlaylist('Informativo | 1º Trimestre 2026', SERIE) === 0,
  '[registro] as duas séries convivem no mesmo canal sem se misturar');

// ── 7g. O QUE AINDA NÃO SAIU NÃO ENTRA NA LISTA (v5.255) ────────────────────
//
// Relato do operador: *"o informativo mundial das missões só libera apenas o
// informativo referente a aquela semana e dos passados. Exemplo: hoje é sábado
// 15 de agosto, então eu só tenho o 15 de agosto e os anteriores."* O canal sobe
// o trimestre inteiro e libera um sábado por vez; os que faltam ficam como
// "prioridade para membros" — aparecem na playlist e não tocam.
//
// O caso é escrito com a data do relato, e o corte é INCLUSIVO nela: o episódio
// de hoje é o do culto de hoje.
const SABADO_15 = new Date(2026, 7, 15);
const trimestreQ3 = [
  { id: 'q1', url: 'd/q1', name: 'Informativo Mundial das Missões | 08 AGOSTO 2026', seconds: 175 },
  { id: 'q2', url: 'd/q2', name: 'Informativo Mundial das Missões | 15 AGOSTO 2026', seconds: 155 },
  { id: 'q3', url: 'd/q3', name: 'Informativo Mundial das Missões | 22 AGOSTO 2026', seconds: 160 },
  { id: 'q4', url: 'd/q4', name: 'Informativo Mundial das Missões | 26 SETEMBRO 2026', seconds: 179 },
];
// Estes casos falam da JANELA DE DATAS, não do nome: comparar o nome inteiro os
// faria reprovar a cada ajuste de nomenclatura (foi o que a v5.271 provocou).
// A DATA é o que eles medem, e é só ela que entra na comparação.
const nomes = (arr) => arr.map((i) => S.rotuloData({ dia: i.dia, mes: i.mes })).join(' ~ ');
const ate15 = S.ordenarItens(S.itensDaPlaylist(trimestreQ3, 7, INFO, SABADO_15));
checar(nomes(ate15) === '08/Ago ~ 15/Ago',
  '[relato] em 15/Ago a lista vai até 15/Ago — o de hoje ENTRA, o de 22 ainda não',
  nomes(ate15));

// ── A JANELA É A SEMANA, E SÓ ELA (v5.256 → v1.2.19 → v1.4.16) ─────────────
//
// A v5.256 atendeu a *"pode deixar para que o acesso ao vídeo já fique
// disponível na quarta-feira antes do sábado"* com uma contagem de TRÊS DIAS, e
// esses casos cobravam a fronteira na quarta — inclusive a metade negativa, que
// exigia o episódio AUSENTE na terça.
//
// **Esse caso mudou de veredito por relato do operador, e a supersessão está
// escrita aqui para ninguém "consertá-lo" de volta:** *"não está buscando o
// vídeo disponível para o próximo sábado/sábado atual… já confirmei que o vídeo
// está disponível na fonte, mas ele não está listado"* — num DOMINGO. A régua
// de três dias e a semana adventista do [sabadoDaSemana] discordavam em três
// dos sete dias (domingo, segunda e terça): a lista escondia o episódio que o
// destaque do topo declarava o desta semana, e o topo dizia "Aguardando
// lançamento" sobre um vídeo já liberado.
//
// A janela passou a ser a SEMANA CORRENTE, e na v1.4.16 o piso de três dias
// SAIU — o operador enunciou a data de corte do canal (*"a liberação começa na
// virada da meia noite de sábado para domingo… quando acaba aquela semana, na
// virada do sábado para o domingo, já libera a próxima"*), e o piso era a única
// coisa capaz de contrariá-la. MEDIDO antes de tirar: sobre os 365×365 pares
// dia × episódio de 2026 ele mudava o veredito em 312, e em ZERO deles o
// episódio caía num SÁBADO — que é o único dia em que estes canais publicam.
//
// Os casos abaixo cobram as duas metades — o que a semana abre, e o que ela
// continua fechando, que é a razão de o campo `futuros` existir.
const domingo16 = S.itensDaPlaylist(trimestreQ3, 7, INFO, new Date(2026, 7, 16));
checar(nomes(S.ordenarItens(domingo16)) === '08/Ago ~ 15/Ago ~ 22/Ago',
  '[relato] no DOMINGO o episódio do sábado desta semana JÁ está na lista',
  nomes(S.ordenarItens(domingo16)));
const terca18 = S.itensDaPlaylist(trimestreQ3, 7, INFO, new Date(2026, 7, 18));
checar(nomes(S.ordenarItens(terca18)) === '08/Ago ~ 15/Ago ~ 22/Ago',
  'e na TERÇA também — é a mesma semana, e a semana é a janela',
  nomes(S.ordenarItens(terca18)));
const quarta19 = S.itensDaPlaylist(trimestreQ3, 7, INFO, new Date(2026, 7, 19));
checar(nomes(S.ordenarItens(quarta19)) === '08/Ago ~ 15/Ago ~ 22/Ago',
  '[relato] na QUARTA antes do sábado ele APARECE — é quando o roteiro é montado',
  nomes(S.ordenarItens(quarta19)));
checar(!('DIAS_DE_ANTECEDENCIA' in S),
  'e não há mais piso de dias: a semana é a régua inteira, como o operador a enunciou');
const sabado22 = S.ordenarItens(S.itensDaPlaylist(trimestreQ3, 7, INFO, new Date(2026, 7, 22)));
checar(nomes(sabado22) === '08/Ago ~ 15/Ago ~ 22/Ago',
  'e no próprio sábado ele continua lá — a janela abre, não pisca', nomes(sabado22));

// A METADE QUE FECHA, e sem ela a correção acima viraria um apagador do campo
// `futuros`: a SEMANA QUE VEM continua escondida. No sábado 15 o episódio de 22
// ainda é de outra semana; ele entra no domingo 16, e não antes.
checar(S.aindaNaoSaiu({ dia: 22, mes: 8 }, INFO, SABADO_15),
  'no SÁBADO 15 o episódio de 22/Ago ainda NÃO aparece — é da semana seguinte');
checar(!S.aindaNaoSaiu({ dia: 22, mes: 8 }, INFO, new Date(2026, 7, 16)),
  'e um dia depois, no domingo, a semana dele começou e ele entra');

// AS DUAS REGRAS CONCORDAM AGORA, e é essa concordância que o defeito quebrou:
// o que o destaque do topo chama de "o desta semana" não pode estar fora da
// lista que ele encabeça. Os SETE dias da semana, porque foram três deles que
// discordavam — medir um só aprovaria o mundo anterior.
let concordam = 0;
for (let d = 16; d <= 22; d++) {
  const hoje = new Date(2026, 7, d);
  const alvo = { dia: 22, mes: 8 };
  if (S.ehDoSabadoAtual(alvo, INFO, hoje) && !S.aindaNaoSaiu(alvo, INFO, hoje)) concordam++;
}
checar(concordam === 7,
  'o episódio DESTA semana está na lista nos sete dias dela — destaque e lista não discordam',
  concordam);

// A CONTAGEM DE DIAS, isolada: é o primitivo de calendário do módulo (a lista o
// usa pela semana, o aviso de falha o compara com ZERO), e é ele que atravessa
// o fim do mês.
checar(S.diasAte({ dia: 22, mes: 8 }, INFO, new Date(2026, 7, 19)) === 3, '19/Ago → 22/Ago são 3 dias');
checar(S.diasAte({ dia: 1, mes: 9 }, INFO, new Date(2026, 7, 30)) === 2,
  'a virada do MÊS não confunde a conta (30/Ago → 01/Set = 2 dias)',
  S.diasAte({ dia: 1, mes: 9 }, INFO, new Date(2026, 7, 30)));
checar(S.diasAte({ dia: 15, mes: 8 }, INFO, new Date(2026, 7, 22)) === -7,
  'e o que já passou conta NEGATIVO — é assim que o aviso sabe que não é o caso',
  S.diasAte({ dia: 15, mes: 8 }, INFO, new Date(2026, 7, 22)));

// A VIRADA DO ANO, que é onde uma comparação por instante erraria: em 2027 o
// álbum de 2026 está todo no passado.
checar(S.itensDaPlaylist(trimestreQ3, 7, INFO, new Date(2027, 0, 1)).length === 4,
  'no ano seguinte o álbum de 2026 aparece inteiro');
// E o mês/dia sozinhos não bastam: 26 de SETEMBRO ainda é futuro em 26 de AGOSTO.
checar(S.itensDaPlaylist(trimestreQ3, 7, INFO, new Date(2026, 7, 26)).length === 3,
  'o mês entra na conta: 26/Set continua no futuro em 26/Ago');

// O PROVAI E VEDE PASSOU A ESCONDER TAMBÉM (v1.4.15), e a medição que o mantinha
// mostrando estava ERRADA. Ela dizia "em 15/Ago a playlist já tinha até 26/Set, e
// aqueles episódios TOCAM": a primeira metade era verdade, a segunda nunca foi
// verificada — o que se olhou foi a LISTA, não a reprodução. O campo desmentiu em
// 29/08/2026, com o Registro devolvendo `ContentNotAvailableException` para um
// episódio de 22/Set.
const pvSetembro = S.itensDaPlaylist(
  [{ id: 's1', url: 'y/s1', name: 'Uma decisão difícil | Provai e Vede 2026 (05/Set)', seconds: 300 }],
  9, SERIE, SABADO_15);
checar(pvSetembro.length === 0,
  'o Provai e Vede esconde o que não saiu: em 15/Ago o episódio de 05/Set fica fora');

// E A METADE QUE IMPEDE ISTO DE VIRAR UM APAGADOR: o corte é do CAMPO, não de uma
// regra global. Provado com uma série SINTÉTICA — os dois valores exercitados
// sobre a MESMA entrada, no mesmo dia. Amarrar a asserção aos valores que o
// catálogo tem hoje mediria a POLÍTICA (que muda quando um canal muda) em vez do
// MECANISMO (que é o que não pode quebrar).
const comoMostrar = Object.assign({}, SERIE, { futuros: S.FUTUROS_MOSTRAR });
const pvMostrando = S.itensDaPlaylist(
  [{ id: 's1', url: 'y/s1', name: 'Uma decisão difícil | Provai e Vede 2026 (05/Set)', seconds: 300 }],
  9, comoMostrar, SABADO_15);
checar(pvMostrando.length === 1,
  'e com `FUTUROS_MOSTRAR` a MESMA entrada, no MESMO dia, continua na lista — a '
  + 'diferença é um CAMPO declarado no catálogo, não um `if` por série');
checar(SERIE.futuros === S.FUTUROS_ESCONDER && INFO.futuros === S.FUTUROS_ESCONDER,
  'hoje as duas séries cortam o futuro: os dois canais sobem o período inteiro e '
  + 'liberam um sábado por vez, e agora isso está MEDIDO nos dois');

// SEM DATA NO TÍTULO, NUNCA É ESCONDIDO. Ele é o achado da regra de ouro, e
// esconder o que não se sabe julgar trocaria um item feio por um item ausente.
const semDataFuturo = S.itensDaPlaylist(
  [{ id: 'z1', url: 'd/z1', name: 'Informativo Mundial das Missões | especial', seconds: 200 }],
  10, INFO, SABADO_15);
checar(semDataFuturo.length === 1,
  'um episódio SEM data entra mesmo com o corte ligado — não há como julgá-lo');

// E o VEREDITO sai nomeado, que é o que o Registro imprime.
const verFut = S.avaliarVideo(trimestreQ3[3], INFO, SABADO_15);
checar(verFut.motivo === S.MOTIVO_FUTURO && verFut.data && verFut.data.mes === 9,
  'o motivo é "futuro" e a DATA vem junto — é ela que o Registro ordena', JSON.stringify(verFut));
checar(S.aindaNaoSaiu({ dia: 22, mes: 8 }, INFO, SABADO_15)
  && !S.aindaNaoSaiu({ dia: 15, mes: 8 }, INFO, SABADO_15),
  'a fronteira, isolada: em 15/Ago o de 22 ainda não saiu e o de hoje saiu');
checar(!S.aindaNaoSaiu({ dia: 22, mes: 8 }, INFO, new Date(2026, 7, 19)),
  'e na quarta ele está na lista — não por antecedência, mas porque a quarta 19 '
  + 'e o sábado 22 são a MESMA semana');

// ── 7d-bis. A DATA DE CORTE, DITA PELO OPERADOR (v1.4.16) ───────────────────
//
// *"A liberação começa na virada da meia noite de sábado para domingo, no caso o
// domingo é o primeiro dia da semana e já oferece a mídia para o sábado de sua
// semana, e quando acaba aquela semana, na virada do sábado para o domingo, já
// libera a próxima."*
//
// Os casos acima medem DIAS ESCOLHIDOS; este mede a REGRA, sobre o ano inteiro.
// E ele a escreve **por fora da implementação**: o domingo que abre a semana do
// episódio sai da data DELE (recuo até o `getDay() === 0`), não da janela que o
// `aindaNaoSaiu` usa — uma asserção derivada da mesma conta provaria só que a
// função concorda consigo mesma.
//
// É esta propriedade que o piso de três dias quebrava, e é por isso que ela
// entrou no lote que o removeu: quem o reintroduzir vê 312 pares reprovarem.
const ANO = new Date(2026, 0, 1);
const domingoDaSemanaDe = (d) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  return x.getTime();
};
let cedo = 0; let tarde = 0; let pares = 0; const exemploCedo = [];
for (let t = 0; t < 365; t++) {
  const hoje = new Date(ANO.getFullYear(), 0, 1 + t);
  for (let e = 0; e < 365; e++) {
    const ep = new Date(ANO.getFullYear(), 0, 1 + e);
    const escondido = S.aindaNaoSaiu({ mes: ep.getMonth() + 1, dia: ep.getDate() }, INFO, hoje);
    // A regra do operador: está na lista a partir do domingo que abre a semana
    // do episódio, e nunca antes.
    const semanaAberta = hoje.getTime() >= domingoDaSemanaDe(ep);
    pares++;
    if (!escondido && !semanaAberta) {
      cedo++;
      if (exemploCedo.length < 3) {
        exemploCedo.push({ hoje: hoje.toDateString(), episodio: ep.toDateString() });
      }
    }
    if (escondido && semanaAberta) tarde++;
  }
}
checar(pares === 365 * 365, 'o ano inteiro é varrido — 365 dias × 365 episódios', pares);
checar(cedo === 0,
  '[relato] NENHUM episódio aparece antes do domingo que abre a semana dele — '
  + 'a virada de sábado para domingo é a data de corte', exemploCedo);
checar(tarde === 0,
  'e nenhum fica escondido depois dela: a virada LIBERA, não adia', tarde);

// ── 7e. A IMPRESSÃO DIGITAL enxerga as recusas de idioma ────────────────────
// Sem isto, corrigir uma marca de idioma deixaria de pé todo índice já escrito
// — com o vídeo em espanhol dentro dele, para sempre. É o defeito da v5.233,
// que custou uma versão inteira para ser diagnosticado.
checar(/^r[0-9a-z]+$/.test(S.impressao()), 'a impressão é uma string curta e estável', S.impressao());
checar(S.impressao() !== S.impressao('outra função'),
  'e ela muda quando o montador da faixa muda (a fresta da v5.236)');

// ── 8. O SÁBADO DESTA SEMANA (v1.1.21) ─────────────────────────────────────
//
// É a régua do destaque no topo da lista da série. **A SEMANA COMEÇA NO
// DOMINGO** — a semana adventista, e a que o operador vive: no domingo ele já
// monta o culto do sábado que vem. Uma semana começando na segunda faria o
// domingo de manhã destacar o sábado que ACABOU de passar, que é o único dia em
// que ninguém procura por ele.
//
// Os `hoje` são FIXOS. Uma regra de calendário que leia o relógio não tem
// oráculo — e o que ela decide é o que aparece no topo da lista do culto.
const SEM = { ano: 2026 };
const DIAS = [
  ['domingo', new Date(2026, 7, 16)], ['segunda', new Date(2026, 7, 17)],
  ['quarta', new Date(2026, 7, 19)], ['sexta', new Date(2026, 7, 21)],
  ['sábado', new Date(2026, 7, 22)],
];
const errados = DIAS.filter(([, d]) => {
  const s = S.sabadoDaSemana(d);
  return !(s.ano === 2026 && s.mes === 8 && s.dia === 22);
}).map(([n]) => n);
checar(errados.length === 0,
  'de domingo a sábado, a semana inteira aponta para o MESMO sábado (22/Ago) — '
  + 'inclusive o próprio sábado, que é hoje e não a semana que vem',
  JSON.stringify(errados));
checar(S.sabadoDaSemana(new Date(2026, 7, 23)).dia === 29,
  'e no domingo seguinte ela vira: o destaque acompanha a semana, não o mês');
// A VIRADA DE MÊS e a de ANO saem de graça do `new Date(y, m, d + n)`, e é por
// isso que a conta é feita assim — e não com aritmética sobre o dia.
checar(S.sabadoDaSemana(new Date(2026, 7, 30)).mes === 9
  && S.sabadoDaSemana(new Date(2026, 7, 30)).dia === 5,
  'a virada de MÊS sai certa (30/Ago → 05/Set)');
const ano = S.sabadoDaSemana(new Date(2026, 11, 28));
checar(ano.ano === 2027 && ano.mes === 1 && ano.dia === 2,
  'e a de ANO também (28/Dez/2026 → 02/Jan/2027)', JSON.stringify(ano));

// A JANELA É A SEMANA, e isso é defesa e não frouxidão: a régua deste módulo é
// a data do TÍTULO, e o canal escreve a data que quiser. Exigir o dia exato
// faria um episódio datado de sexta sumir do destaque e a tela dizer "Aguardando
// lançamento" sobre um vídeo que está na lista logo abaixo.
const naSemana = (dia, hoje) => S.ehDoSabadoAtual({ mes: 8, dia }, SEM, hoje);
checar(naSemana(22, new Date(2026, 7, 19)) && naSemana(21, new Date(2026, 7, 19))
  && naSemana(16, new Date(2026, 7, 19)),
  'na quarta, a semana inteira casa: domingo (16), sexta (21) e o sábado (22)');
checar(!naSemana(15, new Date(2026, 7, 19)) && !naSemana(23, new Date(2026, 7, 19)),
  'e nada fora dela: nem o sábado passado (15), nem o domingo seguinte (23)');
checar(naSemana(22, new Date(2026, 7, 22)) && !naSemana(23, new Date(2026, 7, 22)),
  'NO PRÓPRIO SÁBADO o episódio de hoje casa, e o de amanhã não — a janela fecha '
  + 'no sábado, não depois dele');
checar(naSemana(16, new Date(2026, 7, 22)),
  'e o domingo que ABRIU esta semana ainda casa: a janela é a semana toda');
checar(!S.ehDoSabadoAtual(null, SEM, new Date(2026, 7, 19)),
  'sem data no título, nunca é o destaque — a mesma regra do `aindaNaoSaiu`: '
  + 'esconder o que não se sabe julgar seria transformar um item feio num ausente');

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
