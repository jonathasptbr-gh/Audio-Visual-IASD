// ============================================================================
// SÉRIES DO YOUTUBE — a regra que decide o que entra num álbum da Biblioteca
//
// Uma "série" é um canal do YouTube que publica UM episódio por semana e
// organiza o ano em **uma playlist por mês**. O primeiro caso é o Provai e Vede
// (@provaievedeoficial), mas nada aqui é sobre ele: o que o módulo sabe é
// "prefixo + ano", e um catálogo com uma linha a mais dá uma série nova sem
// código novo.
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
// ## As cinco armadilhas, medidas nos prints do canal (v5.228)
//
// Nenhuma delas é hipótese: todas aparecem na aba Playlists e na aba Vídeos do
// @provaievedeoficial, e cada uma quebraria a regra ÓBVIA em silêncio.
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

  // O CATÁLOGO. Uma linha por série; o `id` é o `coll.id` do card e por isso
  // não pode mudar depois de publicado (é ele que nomeia a pasta no OPFS e
  // liga os downloads já feitos ao card).
  //
  // O ANO fica explícito, e é deliberado: "o ano corrente" faria o álbum do
  // operador trocar de conteúdo sozinho na virada de dezembro, no meio da
  // programação de janeiro. Quando 2027 chegar, é uma linha nova aqui e um
  // push em `main` — o OTA leva em minutos, e é justamente para isso que ele
  // existe neste projeto.
  const SERIES = [
    {
      id: 'serie-provai-vede-2026',
      name: 'Provai e Vede 2026',
      canal: 'https://www.youtube.com/@provaievedeoficial',
      prefixo: 'Provai e Vede',
      ano: 2026,
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
   * O mês (1..12) da playlist desta série, ou 0 quando ela não é da série.
   *
   * Três perguntas, nesta ordem, e nenhuma delas casa separador (armadilha 1):
   * o nome COMEÇA com o prefixo, não fala de Libras, e traz o ano e um mês em
   * qualquer posição.
   */
  function mesDaPlaylist(nome, prefixo, ano) {
    const n = normalizar(nome);
    if (!n) return 0;
    if (!n.startsWith(normalizar(prefixo))) return 0;
    if (ehLibras(n)) return 0;
    // O ano como PALAVRA: sem o `\b`, "2026" casaria dentro de "12026" e, pior,
    // o ano de uma série futura casaria pedaço do de outra.
    if (!new RegExp('\\b' + String(ano) + '\\b').test(n)) return 0;
    for (let i = 0; i < MESES.length; i++) {
      if (new RegExp('\\b' + MESES[i] + '\\b').test(n)) return i + 1;
    }
    return 0;
  }

  /**
   * As playlists desta série, do mês mais ANTIGO para o mais novo.
   *
   * A ordem do canal é o inverso (o mais recente em cima) e ela não serve: o
   * álbum representa o ANO, e uma lista que começa em setembro e termina em
   * janeiro não se lê. Empate de mês (o canal republicou) resolve pela ordem em
   * que veio, que ao menos é estável.
   */
  function playlistsDaSerie(lista, serie) {
    const out = [];
    (Array.isArray(lista) ? lista : []).forEach((pl, i) => {
      const mes = mesDaPlaylist(pl && pl.name, serie.prefixo, serie.ano);
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
    // fevereiro" (v5.230).
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
    const ext = n.match(/\b(\d{1,2})\s*[ºo°]?\s*(?:de\s+)?([a-z]{3,})\b/);
    if (ext) {
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
   * O nome do episódio: o que vem ANTES da barra vertical.
   *
   * "Quando o evangelho sussurra | Provai e Vede 2026 (15/Ago)" tem a metade
   * direita repetida em todos os 52 itens — é justamente a parte que não
   * distingue um do outro, e ocupa a largura da linha na lista. Mesmo problema
   * (e mesma solução) do `tituloLimpo` do `YoutubeGrab`, que tira o nome do
   * canal da frente do título.
   *
   * Sem a barra, devolve o título inteiro: um rótulo comprido é melhor que um
   * rótulo vazio.
   */
  function tituloDoEpisodio(titulo) {
    const t = String(titulo == null ? '' : titulo).replace(/\s+/g, ' ').trim();
    if (!t) return '';
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
      if (ehLibras(v.name)) return;
      const d = dataDoVideo(v.name);
      out.push({
        id: v.id,
        url: v.url,
        titulo: tituloDoEpisodio(v.name),
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
   */
  function nomeDoItem(item) {
    const d = rotuloData(item.dia ? { dia: item.dia, mes: item.mes } : null);
    return d ? d + ' · ' + item.titulo : item.titulo;
  }

  global.AVSerie = {
    SERIES,
    normalizar, ehLibras,
    mesDaPlaylist, playlistsDaSerie,
    dataDoVideo, tituloDoEpisodio, rotuloData,
    itensDaPlaylist, ordenarItens, nomeDoItem,
  };
})(this);
