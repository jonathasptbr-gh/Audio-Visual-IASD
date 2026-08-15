// ============================================================================
// SÉRIES DO YOUTUBE — a regra que decide o que entra num álbum da Biblioteca
//
// Uma "série" é um canal do YouTube que publica UM episódio por semana e
// organiza o ano em playlists por PERÍODO. O primeiro caso é o Provai e Vede
// (@provaievedeoficial), mas nada aqui é sobre ele: o que o módulo sabe é
// "prefixo + ano + período", e um catálogo com uma linha a mais dá uma série
// nova sem código novo.
//
// A segunda série provou isso e cobrou o preço (v5.244). O **Informativo
// Mundial das Missões** (@daniellocutor) tem a MESMA natureza — um episódio por
// sábado, o ano inteiro num álbum — e mesmo assim quebrou três suposições que
// só pareciam universais porque havia uma série só:
//
//  1. **A playlist é do TRIMESTRE, não do mês.** "Informativo | 3º Trimestre
//     2026" traz 13 episódios de julho a setembro. Daí o campo [periodo]: quem
//     dá o mês de cada item continua sendo a data do TÍTULO, e o período só
//     ordena as playlists e serve de piso para quem não declarar data.
//  2. **O título não tem nome de episódio.** "Informativo Mundial das Missões |
//     15 AGOSTO 2026" é a série mais a data, e a história ("O Sonho de Enoc")
//     vive na MINIATURA. Herdar o "o nome é o que vem antes da barra" do Provai
//     e Vede daria 52 linhas idênticas dizendo "Informativo Mundial das
//     Missões" — a metade que não distingue nada ocupando a largura da lista,
//     que é exatamente o que [tituloDoEpisodio] existe para evitar. Daí o campo
//     [titulo].
//  3. **O canal publica a MESMA série em quatro idiomas.** Ver a armadilha 7.
//
// Nenhuma das três é um `if` por série: são campos declarados no catálogo, e a
// terceira nem isso — ela virou uma recusa global, ao lado da de Libras.
//
// ## Por que isto é um arquivo à parte, e PURO
//
// Ele não toca no DOM, não faz rede e não conhece o `controle.js`. Duas razões,
// e as duas são deste projeto:
//
//  1. **É ele que decide o que vai ao telão.** Um erro aqui não é pixel errado:
//     é o vídeo errado — ou o mês inteiro ausente — na frente da congregação, e
//     sem nada que o denuncie. Coisa assim tem oráculo (`tools/serie.test.mjs`,
//     Node puro, no `apk.yml` **sem `continue-on-error`**).
//  2. **A decisão é de CONTEÚDO, então ela é do lado web** (invariante 5). O
//     shell só entrega listas cruas (`ytCanalPlaylists`/`ytPlaylist`); quem
//     olha para os nomes é este arquivo. Escrever a regra em Kotlin custaria um
//     degrau de `SHELL_VERSION` a cada ajuste de nomenclatura do canal — e a
//     nomenclatura de um canal muda sem avisar ninguém, que é exatamente o que
//     as armadilhas abaixo provam.
//
// ## As armadilhas, medidas nos prints dos canais (v5.228, v5.230, v5.244)
//
// Nenhuma delas é hipótese: todas aparecem na aba Playlists ou na aba Vídeos de
// um dos dois canais, e cada uma quebraria a regra ÓBVIA em silêncio.
//
//  1. **O HÍFEN NÃO É GARANTIDO.** As playlists são "Provai e Vede - Agosto
//     2026", mas uma delas é "Provai e Vede Agosto 2026" (sem o hífen). Um
//     `^Provai e Vede - ` teria descartado a playlist inteira, e o mês sumiria
//     da Biblioteca sem erro nenhum. Daí a regra não casar SEPARADOR nenhum:
//     ela pede o prefixo no começo e depois procura mês e ano **em qualquer
//     posição**. O hífen é opcional por construção, não por um `?` no lugar
//     certo — que é o que sobrevive à próxima variação.
//  2. **ESPAÇO DUPLO.** "Provai e Vede  2026 (15/Ago)" — dois espaços, nos dois
//     vídeos daquele sábado. Toda comparação passa por [normalizar], que
//     colapsa espaço.
//  3. **O MARCADOR DE LIBRAS MUDA DE FORMA ENTRE OS DOIS NÍVEIS:** `(Libras)`
//     na playlist, `- Libras` no vídeo. Testar qualquer uma das duas formas
//     literais deixa a outra passar. O teste é pela PALAVRA, sem acento e sem
//     caixa, e cobre as duas mais a próxima.
//  4. **A DURAÇÃO NÃO SEPARA NADA:** 4:54 × 4:55 num par e 5:07 × 5:07 noutro.
//     Se alguém pensar em desempatar por duração, não dá — está dito aqui para
//     não ser tentado de novo.
//  5. **O `uploaderName` NÃO É O CANAL:** os vídeos vêm creditados como
//     "Provai e Vede | Oficial e Adventist…" (colaboração entre canais).
//     Filtrar por essa string derrubaria tudo, então ela não é consultada.
//  6. **A DATA TEM DUAS FORMAS, e o mesmo episódio usa as duas** — a compacta
//     "(03/Jan)" e a por extenso "sábado 3 janeiro". Está documentada onde ela
//     é tratada, em [dataDoVideo]. O @daniellocutor acrescentou uma terceira
//     escrita da MESMA forma por extenso ("15 AGOSTO 2026"), que a regra já
//     lia — ver lá.
//  7. **UM CANAL PUBLICA A MESMA SÉRIE EM VÁRIOS IDIOMAS**, e a aba Playlists
//     do @daniellocutor os põe lado a lado: "Informativo | 3º Trimestre 2026"
//     (português), "Misiones | 3º Trimestre 2026" (espanhol), "Mission Stories
//     | 2º Quarter 2026" (inglês) e "【聖工消息】2026 第三季" (chinês). O
//     prefixo separa as playlists — mas ele NÃO separa os vídeos: em espanhol
//     eles se chamam "Informativo Mundial **de las Misiones**", isto é, começam
//     com a mesma palavra. Daí [ehOutroIdioma], que é o irmão do [ehLibras] e
//     está pelo mesmo motivo: um único vídeo posto por engano na playlist de
//     português iria ao telão do culto num idioma que a congregação não fala,
//     e não há nada no id, na duração ou na miniatura que o denuncie.
//
// ## A regra de ouro deste arquivo
//
// **Quem prova pertencimento é a PLAYLIST; o título é só rótulo.** Um vídeo
// entra por estar numa playlist aceita — nunca por casar um padrão de título.
// A data `(15/Ago)` serve para ORDENAR e para nomear, e quando ela não casa o
// vídeo entra do mesmo jeito, com a ordem em que veio. Errar para o lado de um
// nome feio é recuperável; errar para o lado de um episódio ausente é o
// operador descobrindo no sábado que o vídeo do culto não está lá.
//
// **A exceção da regra de ouro é o IDIOMA, e ela é declarada em vez de
// escorregar:** [ehLibras] e [ehOutroIdioma] recusam pelo TÍTULO, contra tudo o
// que o parágrafo acima diz. As duas estão aqui porque o erro que elas evitam
// não é recuperável no sábado de manhã — é a projeção rodando em espanhol, ou
// com o intérprete na tela, na frente de todo mundo, e sem nada que o operador
// possa fazer a não ser parar o culto. O preço é conhecido e está escrito no
// KDoc de cada uma: um episódio que FALE de Libras ou de missões em espanhol é
// recusado, e ele volta à mão pela busca do YouTube.
//
// **E o áudio em português é OUTRA pergunta, respondida noutro lugar.** O
// YouTube dubla vídeo sozinho, e a dublagem não muda o título — ela é uma faixa
// de áudio a mais dentro do MESMO vídeo. Quem escolhe a trilha é o shell, em
// `TrilhaAudio.kt` (v5.242), e ele já a decide pelo idioma antes de qualquer
// outra coisa. Nada aqui tem como ver isso, e é por isso que este arquivo não
// tenta.
//
// Exposto como window.AVSerie.
// ============================================================================

(function (global) {
  'use strict';

  // Sem acento e em minúsculas — é assim que [normalizar] entrega tudo.
  const MESES = [
    'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  // As três primeiras letras, que é como a data do título abrevia ("15/Ago").
  // Derivadas de [MESES] em vez de digitadas: duas listas à mão divergem no
  // primeiro que alguém editar, e "mar"/"marco" seria o primeiro a divergir.
  const MESES_ABREV = MESES.map((m) => m.slice(0, 3));
  // Só para RÓTULO (a lista da Biblioteca) — nunca para comparar.
  const MES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // Como as playlists de uma série fatiam o ano. É o que [mesDaPlaylist] lê.
  const PERIODO_MES = 'mes';              // "Provai e Vede - Agosto 2026"
  const PERIODO_TRIMESTRE = 'trimestre';  // "Informativo | 3º Trimestre 2026"

  // Onde mora o NOME do episódio dentro do título do vídeo. Ver a suposição 2
  // no topo e o KDoc de [tituloDoEpisodio].
  const TITULO_ESQUERDA = 'esquerda';     // "Match point | Provai e Vede 2026 (01/Ago)"
  const TITULO_NENHUM = 'nenhum';         // "Informativo Mundial das Missões | 15 AGOSTO 2026"

  // O CATÁLOGO. Uma linha por série; o `id` é o `coll.id` do card e por isso
  // não pode mudar depois de publicado (é ele que nomeia a pasta no OPFS e
  // liga os downloads já feitos ao card). Ele começa com `serie-` porque é
  // assim que o `controle.js` sabe que a coleção é de VÍDEO e não pode herdar a
  // média de bytes por segundo do acervo de áudio (`ehColecaoDeVideo`).
  //
  // O ANO fica explícito, e é deliberado: "o ano corrente" faria o álbum do
  // operador trocar de conteúdo sozinho na virada de dezembro, no meio da
  // programação de janeiro. Quando 2027 chegar, é uma linha nova aqui e um
  // push em `main` — o OTA leva em minutos, e é justamente para isso que ele
  // existe neste projeto.
  //
  // `periodo` e `titulo` têm padrão (mês, nome à esquerda) e por isso a linha
  // do Provai e Vede podia ter ficado sem eles. Estão escritos assim mesmo:
  // enquanto havia uma série só, essas duas escolhas não pareciam escolhas — e
  // é exatamente essa a leitura que a segunda série desmentiu.
  const SERIES = [
    {
      id: 'serie-provai-vede-2026',
      name: 'Provai e Vede 2026',
      canal: 'https://www.youtube.com/@provaievedeoficial',
      prefixo: 'Provai e Vede',
      ano: 2026,
      periodo: PERIODO_MES,
      titulo: TITULO_ESQUERDA,
    },
    {
      id: 'serie-informativo-missoes-2026',
      name: 'Informativo Mundial das Missões 2026',
      canal: 'https://www.youtube.com/@daniellocutor',
      // O prefixo é UMA palavra, e é ela que separa os quatro idiomas na aba
      // Playlists: as outras versões se chamam "Misiones", "Mission Stories" e
      // "【聖工消息】". Pedir "Informativo Mundial das Missões" aqui seria pedir
      // o nome do VÍDEO, que não é como as playlists se chamam.
      prefixo: 'Informativo',
      ano: 2026,
      periodo: PERIODO_TRIMESTRE,
      titulo: TITULO_NENHUM,
    },
  ];

  /**
   * A forma canônica de comparação: sem acento, minúscula, espaço colapsado.
   *
   * O `NFD` + remoção de diacríticos é o que faz "Março" casar com `marco` — e
   * é também o que faz a palavra "Libras" ser encontrada venha ela como
   * "(Libras)", "- Libras" ou "LIBRAS".
   */
  function normalizar(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * A tradução em LIBRAS desta série — que o operador NÃO quer no álbum.
   *
   * Pela PALAVRA, não pela pontuação em volta dela (armadilha 3). O `\b` casa
   * tanto o parêntese da playlist quanto o hífen do vídeo.
   *
   * **O falso positivo possível está dito em vez de escondido:** um episódio
   * que fosse SOBRE Libras e trouxesse a palavra no título seria recusado. O
   * custo disso é um vídeo a menos, que o operador vê e resolve à mão; o custo
   * do erro oposto — a versão em Libras entrar no álbum — é a projeção do culto
   * com o intérprete na tela sem ninguém ter pedido, e ela chega em par com a
   * versão certa, dobrando a lista inteira.
   */
  function ehLibras(nome) {
    return /\blibras\b/.test(normalizar(nome));
  }

  /**
   * As ESCRITAS que um título em português brasileiro não usa.
   *
   * Um caractere basta, e é por isso que o teste é pelo alfabeto e não por
   * palavra: "【聖工消息】2026 第三季" não tem uma sílaba que dê para procurar.
   * As faixas cobrem cirílico, hebraico, árabe, tailandês, a pontuação e os
   * silabários japoneses, os ideogramas CJK e o hangul.
   *
   * Emoji ficam de FORA da lista de propósito (eles vivem acima de U+1F000, e
   * as faixas param antes): um título em português com um emoji é comum, e
   * recusá-lo por isso seria o episódio ausente que este arquivo inteiro
   * existe para evitar.
   */
  // Escrita com `\u` e não com os caracteres literais: uma faixa digitada em
  // ideogramas é ilegível para quem revisa e some numa cópia que erre a
  // codificação — e o que sumiria em silêncio é uma RECUSA.
  const ESCRITAS_DE_FORA = new RegExp(
    '[\\u0400-\\u04ff'    // cirílico
    + '\\u0590-\\u05ff'   // hebraico
    + '\\u0600-\\u06ff'   // árabe
    + '\\u0e00-\\u0e7f'   // tailandês
    + '\\u3000-\\u30ff'   // pontuação CJK (o 【】 do canal) e os silabários
    + '\\u3400-\\u4dbf'   // ideogramas, extensão A
    + '\\u4e00-\\u9fff'   // ideogramas
    + '\\uac00-\\ud7af'   // hangul
    + '\\uff00-\\uffef]', // formas de largura fixa
  );

  /**
   * As MARCAS de outro idioma latino — as que não dá para ver pelo alfabeto.
   *
   * Comparadas contra [normalizar], então já vêm sem acento: "Misión" é
   * `mision` e "Missões" é `missoes`. As duas palavras não se cruzam em
   * nenhuma flexão, e é isso que torna o teste possível sem apagar português.
   */
  const IDIOMAS_DE_FORA = [
    /\bmision(es)?\b/,   // espanhol — "Informativo Mundial de las Misiones"
    /\bde las\b/,        // espanhol — não existe em português, em posição nenhuma
    /\bmissions?\b/,     // inglês — "Mission Stories", "Mission Spotlight"
  ];

  /**
   * O título é de OUTRO idioma? (armadilha 7)
   *
   * O irmão do [ehLibras], e pelo mesmo motivo: um vídeo posto por engano na
   * playlist de português vai ao telão sem que nada o denuncie — o id, a
   * duração, a miniatura e o canal são idênticos aos dos legítimos.
   *
   * **O falso positivo possível está dito em vez de escondido:** um episódio
   * em português que cite "mission" ou "misiones" no título — o nome de um
   * projeto, uma citação — seria recusado. O custo é um vídeo a menos, que o
   * operador vê na lista e resolve pela busca do YouTube; o custo do erro
   * oposto é o testemunho do sábado projetado em espanhol.
   *
   * **Ela é GLOBAL, e não um campo do catálogo.** Uma série de um canal só em
   * português nunca casa nenhuma destas regras, então ligá-la por série seria
   * escolher, para cada linha nova, se a proteção vale — e a resposta é sempre
   * a mesma. O @provaievedeoficial passa por ela sem uma recusa.
   */
  function ehOutroIdioma(nome) {
    const bruto = String(nome == null ? '' : nome);
    if (ESCRITAS_DE_FORA.test(bruto)) return true;
    const n = normalizar(bruto);
    return IDIOMAS_DE_FORA.some((re) => re.test(n));
  }

  /**
   * O mês em que o PERÍODO da playlist começa (1..12), ou 0 quando ela não é
   * desta série.
   *
   * Quatro perguntas, nesta ordem, e nenhuma delas casa separador (armadilha
   * 1): o nome COMEÇA com o prefixo, não fala de Libras nem de outro idioma,
   * traz o ano, e declara um período em qualquer posição.
   *
   * **Ele devolve o PRIMEIRO mês do período, não "o mês da playlist"**, e é
   * essa a única concessão que o trimestre pediu. O valor tem dois usos, e os
   * dois continuam certos: ele ORDENA as playlists entre si (julho antes de
   * outubro) e é o PISO de quem não declarar data no título — um episódio sem
   * data numa playlist de trimestre cai no começo daquele trimestre, que é a
   * coisa mais precisa que se pode afirmar sobre ele. Quem dá o mês de verdade
   * de cada item é a data do TÍTULO (ver [itensDaPlaylist]).
   */
  function mesDaPlaylist(nome, serie) {
    const s = serie || {};
    const n = normalizar(nome);
    if (!n || !s.prefixo || !s.ano) return 0;
    if (!n.startsWith(normalizar(s.prefixo))) return 0;
    if (ehLibras(n) || ehOutroIdioma(nome)) return 0;
    // O ano como PALAVRA: sem o `\b`, "2026" casaria dentro de "12026" e, pior,
    // o ano de uma série futura casaria pedaço do de outra.
    if (!new RegExp('\\b' + String(s.ano) + '\\b').test(n)) return 0;
    return s.periodo === PERIODO_TRIMESTRE ? mesDoTrimestre(n) : mesDoNome(n);
  }

  /** O mês escrito por extenso em qualquer posição do nome já normalizado. */
  function mesDoNome(n) {
    for (let i = 0; i < MESES.length; i++) {
      if (new RegExp('\\b' + MESES[i] + '\\b').test(n)) return i + 1;
    }
    return 0;
  }

  /**
   * "3º Trimestre" → 7 (o mês em que o trimestre começa); 0 quando não há.
   *
   * O ordinal é opcional e aceita as três formas que o canal usa ("3º", "3o",
   * "3") — `normalizar` não desmonta o `º` (ele não é diacrítico, e o NFD não o
   * decompõe), então ele chega aqui inteiro e é consumido no lugar certo.
   *
   * **A palavra `trimestre` é exigida em PORTUGUÊS, e isso é de graça:** a
   * playlist em inglês do mesmo canal se chama "2º Quarter 2026", então o
   * idioma da palavra já é, sozinho, uma segunda recusa — sobre a que o prefixo
   * e o [ehOutroIdioma] já fazem.
   */
  function mesDoTrimestre(n) {
    const m = n.match(/\b([1-4])\s*[º°o]?\.?\s*trimestre\b/);
    return m ? (parseInt(m[1], 10) - 1) * 3 + 1 : 0;
  }

  /**
   * As playlists desta série, do período mais ANTIGO para o mais novo.
   *
   * A ordem do canal é o inverso (o mais recente em cima) e ela não serve: o
   * álbum representa o ANO, e uma lista que começa em setembro e termina em
   * janeiro não se lê. Empate (o canal republicou, ou duas playlists caem no
   * mesmo trimestre) resolve pela ordem em que veio, que ao menos é estável.
   */
  function playlistsDaSerie(lista, serie) {
    const out = [];
    (Array.isArray(lista) ? lista : []).forEach((pl, i) => {
      const mes = mesDaPlaylist(pl && pl.name, serie);
      if (mes) out.push({ url: pl.url, name: pl.name, count: pl.count || 0, mes, ordem: i });
    });
    out.sort((a, b) => (a.mes - b.mes) || (a.ordem - b.ordem));
    return out;
  }

  /**
   * O dia e o mês que o título do vídeo declara — "(15/Ago)" → `{dia:15,mes:8}`.
   *
   * Devolve `null` quando não casa, e **isso não é uma recusa**: quem chama usa
   * o resultado só para ordenar e rotular (ver a regra de ouro no topo).
   */
  function dataDoVideo(titulo) {
    const n = normalizar(titulo);
    // FORMA 1, a compacta entre parênteses: "(15/Ago)", "(03/Jan)".
    const par = n.match(/\((\d{1,2})\s*\/\s*([a-z]+)\s*\)/);
    if (par) {
      const d = montarData(par[1], par[2]);
      if (d) return d;
    }
    // FORMA 2, a POR EXTENSO: "sábado 3 janeiro", "3 de janeiro", "1º de
    // fevereiro" (v5.230) — e "15 AGOSTO 2026", que é como o @daniellocutor
    // escreve o Informativo (v5.244). A terceira não custou uma linha: ela é a
    // segunda sem o dia da semana na frente, e o `\b` do dia já a alcançava.
    // Fica registrado porque a leitura natural, ao ver um canal novo, é supor
    // que ele precisa de um ramo novo — e supor formato foi justamente o erro
    // da v5.228.
    //
    // **O MESMO CANAL usa as duas, no MESMO episódio.** No dia 03/Jan/2026 a
    // versão em Libras saiu como "… 2026 (03/Jan) - Libras" e a de português
    // como "… 2026 sábado 3 janeiro" — o operador achou o vídeo na lista sem
    // data nenhuma, no fim de janeiro, fora de ordem. Supor um formato só era
    // a aposta errada; o que este arquivo já sabia é que **o título é só
    // rótulo**, e é por isso que o vídeo entrou mesmo assim.
    //
    // O dia opcionalmente traz o ordinal ("1º"): `normalizar` não o remove (o
    // NFD não decompõe `º`, e ele não é diacrítico), então ele é consumido
    // aqui. O "de" também é opcional — o canal escreve das duas maneiras.
    //
    // **O `o` do ordinal tem de estar COLADO no dia, e isto é uma correção**
    // (v5.244). Escrito como `[ºo°]?` depois de um `\s*`, ele comia a primeira
    // letra do único mês que começa com "o": "03 outubro" casava com o dia 03,
    // o ordinal "o" e o mês "utubro" — que não é mês nenhum. O regex ACERTAVA
    // (a captura satisfaz tudo o que ele pede, então não há retrocesso) e quem
    // recusava era o [montarData], lá fora, sem nada que dissesse por quê. O
    // defeito estava aqui desde a v5.230 e só apareceu com o Informativo, cuja
    // playlist do 4º trimestre é OUTUBRO, novembro e dezembro — o mês inteiro
    // teria entrado sem data e no fim da lista.
    //
    // E a varredura é de TODOS os candidatos, não do primeiro: um título que
    // traga um número antes da data ("Parte 2 | … | 15 AGOSTO 2026") casaria o
    // primeiro e devolveria `null` para uma data que está escrita ali. Custa um
    // laço que quase sempre dá uma volta, e cobre a próxima variação em vez de
    // esperar por ela.
    const EXTENSO = /\b(\d{1,2})(?:\s*[º°]|o)?\s*(?:de\s+)?([a-z]{3,})\b/g;
    let ext;
    while ((ext = EXTENSO.exec(n))) {
      const d = montarData(ext[1], ext[2]);
      if (d) return d;
    }
    return null;
  }

  /**
   * `("3", "janeiro")` → `{ dia: 3, mes: 1 }`; qualquer coisa fora, `null`.
   *
   * O mês casa pelas TRÊS primeiras letras, o que cobre "jan" e "janeiro" com
   * uma comparação só — e recusa o que não é mês, que é o que impede o "2026"
   * de um título virar dia de um mês inventado.
   */
  function montarData(diaTexto, mesTexto) {
    const dia = parseInt(diaTexto, 10);
    const mes = MESES_ABREV.indexOf(String(mesTexto).slice(0, 3)) + 1;
    if (!dia || dia > 31 || !mes) return null;
    // O nome tem de SER um mês, não apenas começar como um: sem isto,
    // "3 marcos" (um nome próprio) viraria 3 de março.
    const nome = String(mesTexto);
    if (nome.length > 3 && nome !== MESES[mes - 1]) return null;
    return { dia, mes };
  }

  /**
   * O nome do episódio dentro do título do vídeo — ou '' quando não há um.
   *
   * **Padrão (`TITULO_ESQUERDA`): o que vem ANTES da barra vertical.** "Quando
   * o evangelho sussurra | Provai e Vede 2026 (15/Ago)" tem a metade direita
   * repetida em todos os 52 itens — é justamente a parte que não distingue um
   * do outro, e ocupa a largura da linha na lista. Mesmo problema (e mesma
   * solução) do `tituloLimpo` do `YoutubeGrab`, que tira o nome do canal da
   * frente do título. Sem a barra, devolve o título inteiro: um rótulo
   * comprido é melhor que um rótulo vazio.
   *
   * **`TITULO_NENHUM`: a série não põe nome de episódio no título.** No
   * Informativo o título é a série mais a data ("Informativo Mundial das
   * Missões | 15 AGOSTO 2026") e o nome da história vive na MINIATURA, que o
   * índice guarda e a gaveta do item desenha (v5.236). Aplicar o padrão aqui
   * daria 52 linhas idênticas — a metade constante ocupando a lista inteira,
   * exatamente o defeito que o padrão existe para corrigir, ao contrário.
   * Devolvendo '', quem rotula é [nomeDoItem] com a DATA, que é por onde o
   * operador procura o sábado.
   *
   * Um terceiro caso — o nome à DIREITA da barra — não existe em canal nenhum
   * lido até aqui, e por isso não está escrito: seria um ramo que nada alcança.
   */
  function tituloDoEpisodio(titulo, serie) {
    const t = String(titulo == null ? '' : titulo).replace(/\s+/g, ' ').trim();
    if (!t) return '';
    if (serie && serie.titulo === TITULO_NENHUM) return '';
    const i = t.indexOf('|');
    const esq = i > 0 ? t.slice(0, i).trim() : '';
    return esq || t;
  }

  /** "15/Ago" — o prefixo pelo qual o operador procura o sábado. */
  function rotuloData(d) {
    return d ? String(d.dia).padStart(2, '0') + '/' + MES_CURTO[d.mes - 1] : '';
  }

  /**
   * Os itens de uma playlist, prontos para virar faixas do álbum.
   *
   * `mesDaPlaylist` é a autoridade sobre o mês — a data do título só confirma.
   * Quando as duas discordam (um vídeo de 01/Ago pendurado na playlist de
   * julho, que acontece quando a semana vira no meio), vale a **data do
   * título**: é ela que o operador lê no telão e no cronograma.
   */
  function itensDaPlaylist(videos, mesDaLista, serie) {
    const out = [];
    (Array.isArray(videos) ? videos : []).forEach((v, i) => {
      if (!v || !v.id) return;
      // Segunda linha de defesa (armadilha 3). Hoje ela nunca dispara: as
      // playlists PT e Libras são espelhos 1:1, então a de português já vem só
      // com português. Ela fica porque um único vídeo acrescentado por engano
      // na playlist oficial iria direto ao telão, e essa é a falha que não se
      // pode correr por economia de três linhas.
      //
      // E no @daniellocutor esta segunda linha É a primeira (armadilha 7): o
      // prefixo separa as PLAYLISTS por idioma, mas os vídeos em espanhol
      // começam com a mesma palavra que os em português ("Informativo Mundial
      // de las Misiones"), então aqui embaixo é o único lugar em que eles têm
      // como ser recusados.
      if (ehLibras(v.name) || ehOutroIdioma(v.name)) return;
      const d = dataDoVideo(v.name);
      out.push({
        id: v.id,
        url: v.url,
        titulo: tituloDoEpisodio(v.name, serie),
        nomeOriginal: v.name,
        seconds: v.seconds || 0,
        thumb: v.thumb || '',
        dia: d ? d.dia : 0,
        mes: d ? d.mes : mesDaLista,
        // Desempate final: sem data no título, a ordem dentro da playlist é a
        // única informação de sequência que existe.
        ordem: i,
        ano: serie.ano,
      });
    });
    return out;
  }

  /**
   * A ordem do álbum: cronológica. Item sem dia (`0`) vai para o fim do mês
   * dele — ele não tem como ser posicionado, e enfiá-lo no dia 1 mentiria.
   */
  function ordenarItens(itens) {
    return itens.slice().sort((a, b) =>
      (a.mes - b.mes) || ((a.dia || 99) - (b.dia || 99)) || (a.ordem - b.ordem));
  }

  /**
   * O nome que vai para a lista: "15/Ago · Quando o evangelho sussurra".
   *
   * A data vem PRIMEIRO porque é por ela que se procura — ninguém lembra o
   * título do episódio de sábado passado, todo mundo sabe a data do culto.
   *
   * Os três casos degenerados, e nenhum deles pode devolver linha vazia:
   *
   *  - **só a data** (`TITULO_NENHUM`, o Informativo): "15/Ago". Numa lista de
   *    52 episódios anuais a data é única, e é a pergunta inteira que aquele
   *    álbum responde. O que ela não diz — de que história é o episódio — a
   *    gaveta do item responde com a miniatura e a duração.
   *  - **só o título**: o vídeo não declarou data nenhuma (a regra de ouro
   *    mandou ele entrar assim mesmo).
   *  - **nem um nem outro**: sobra o título CRU do YouTube. É feio e é longo,
   *    e é infinitamente melhor que uma linha em branco no meio da lista do
   *    culto — que seria intocável e inexplicável.
   */
  function nomeDoItem(item) {
    const d = rotuloData(item.dia ? { dia: item.dia, mes: item.mes } : null);
    const t = item.titulo || '';
    if (d && t) return d + ' · ' + t;
    return d || t || String(item.nomeOriginal || '');
  }

  /**
   * A IMPRESSÃO DIGITAL DA REGRA (v5.233) — e ela existe por um defeito
   * relatado no aparelho, não por elegância.
   *
   * O índice da série é GUARDADO com os nomes já formados ("03/Jan · Não há
   * órfãos de Deus"), e a atualização é pulada quando a assinatura das
   * playlists do canal bate com a guardada — a economia que evita doze
   * extrações por retomada. Só que aquela assinatura fala do que o CANAL
   * publicou, e não sabe nada sobre a regra que transformou aquilo em nome e em
   * ORDEM. Quando a v5.230 ensinou o `dataDoVideo` a ler "sábado 3 janeiro", o
   * canal não tinha mudado uma vírgula: a assinatura continuou batendo, o
   * índice guardado nunca foi refeito, e o episódio ficou **preso** sem data e
   * fora de ordem — inclusive depois de limpar o cache e recarregar, porque o
   * índice mora no IndexedDB e não no cache do WebView.
   *
   * É a lição da v5.220 num lugar novo: **um valor DERIVADO que sobrevive à
   * mudança da regra que o derivou é um valor errado com carimbo de atual.**
   *
   * A impressão é tirada do PRÓPRIO CÓDIGO das funções que decidem (mais o
   * catálogo), e não de um número escrito à mão: um contador que alguém precise
   * lembrar de subir é a mesma classe de sincronização manual que este projeto
   * recusa em toda parte — e quem esquecesse de subi-lo reproduziria
   * exatamente o defeito acima. Mudou a regra, muda a impressão, o índice é
   * refeito UMA vez. Não mudou, nada é reextraído.
   *
   * O hash é o FNV-1a de 32 bits: não é criptografia, é um dedo-de-prosa curto
   * que muda quando o texto muda — que é tudo o que uma chave de cache precisa.
   * (Se um dia este bundle passar por um minificador, a impressão muda a cada
   * build e o custo vira doze extrações por versão. Hoje ele não passa: a base
   * web é publicada como está escrita.)
   *
   * `extra` (v5.236) é o mesmo argumento visto do outro lado do arquivo: quem
   * decide o que o índice GUARDA não é só a regra daqui — é também a função do
   * `controle.js` que transforma o item desta regra na faixa que vai para o
   * `collState`. Ela mora lá porque é lá que a coleção existe; se ela passar a
   * guardar um campo novo (a miniatura, a duração), o índice antigo fica tão
   * obsoleto quanto se a regra tivesse mudado — e sem esta fresta o defeito da
   * v5.233 voltaria pela porta de trás, com o mesmo sintoma mudo. Quem chama
   * passa o CÓDIGO daquela função, nunca um número: a razão é a do parágrafo
   * acima, sem uma vírgula de diferença.
   */
  function impressao(extra) {
    const fonte = [
      JSON.stringify(SERIES),
      String(mesDaPlaylist), String(playlistsDaSerie),
      String(dataDoVideo), String(montarData), String(rotuloData),
      String(itensDaPlaylist), String(ordenarItens), String(nomeDoItem),
      String(tituloDoEpisodio), String(ehLibras), String(normalizar),
      String(mesDoNome), String(mesDoTrimestre),
      // As duas RECUSAS por idioma são DADOS e não código, e por isso entram
      // pelo valor: mudar uma marca (ou uma faixa de escrita) muda o que o
      // álbum contém, exatamente como mudar uma função — e sem isto o índice
      // guardado sobreviveria à correção, que é o defeito da v5.233 por
      // inteiro.
      String(ehOutroIdioma), String(ESCRITAS_DE_FORA), String(IDIOMAS_DE_FORA),
      extra == null ? '' : String(extra),
    ].join('\u0000');
    let h = 0x811c9dc5;
    for (let i = 0; i < fonte.length; i++) {
      h ^= fonte.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return 'r' + h.toString(36);
  }

  global.AVSerie = {
    SERIES,
    PERIODO_MES, PERIODO_TRIMESTRE, TITULO_ESQUERDA, TITULO_NENHUM,
    normalizar, ehLibras, ehOutroIdioma,
    mesDaPlaylist, playlistsDaSerie,
    dataDoVideo, tituloDoEpisodio, rotuloData,
    itensDaPlaylist, ordenarItens, nomeDoItem,
    impressao,
  };
})(this);
