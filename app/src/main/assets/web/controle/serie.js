// ============================================================================
// SÉRIES DO YOUTUBE — a regra que decide o que entra num álbum da Biblioteca
//
// Uma "série" é um canal que publica UM episódio por semana e organiza o ano em
// playlists por PERÍODO. Nada aqui é sobre um canal específico: o módulo sabe
// "prefixo + ano + período", e uma linha a mais no catálogo dá uma série nova
// sem código novo. O desenho completo está em "Séries do YouTube" no CLAUDE.md.
//
// ## Por que é um arquivo à parte, e PURO
//
// Não toca no DOM, não faz rede, não conhece o `controle.js`.
//  1. **É ele que decide o que vai ao telão.** Um erro aqui não é pixel errado:
//     é o vídeo errado — ou o mês inteiro ausente — na frente da congregação,
//     sem nada que o denuncie. Daí o oráculo (`tools/serie.test.mjs`, Node
//     puro, no `apk.yml` **sem `continue-on-error`**).
//  2. **A decisão é de CONTEÚDO, então é do lado web** (invariante 5). O shell
//     só entrega listas cruas; escrever isto em Kotlin custaria um degrau de
//     `SHELL_VERSION` a cada ajuste de nomenclatura — e a nomenclatura de um
//     canal muda sem avisar, que é o que as armadilhas abaixo provam.
//
// ## A REGRA DE OURO
//
// **Quem prova pertencimento é a PLAYLIST; o título é só rótulo.** Um vídeo
// entra por estar numa playlist aceita, nunca por casar um padrão de título — e
// não casando a data, ele entra do mesmo jeito, na ordem em que veio. Errar
// para o lado de um nome feio é recuperável; errar para o lado de um episódio
// ausente é o operador descobrindo no sábado que o vídeo do culto não está lá.
//
// ## As armadilhas, LIDAS nas abas dos canais (nenhuma é hipótese)
//
//  1. **O HÍFEN NÃO É GARANTIDO** — uma playlist é "Provai e Vede Agosto 2026",
//     sem o hífen que todas as outras têm. Por isso a regra não casa SEPARADOR:
//     pede o prefixo no começo e procura mês e ano em QUALQUER posição.
//  2. **ESPAÇO DUPLO.** Tudo passa por [normalizar].
//  3. **O MARCADOR DE LIBRAS MUDA DE FORMA ENTRE OS NÍVEIS:** `(Libras)` na
//     playlist, `- Libras` no vídeo — testar uma das formas literais deixa a
//     outra passar. O teste é pela PALAVRA, sem acento e sem caixa.
//  4. **A DURAÇÃO NÃO SEPARA NADA** (4:54 × 4:55 num par, 5:07 × 5:07 noutro):
//     está dito aqui para ninguém ser tentado a desempatar por ela.
//  5. **O `uploaderName` NÃO É O CANAL** — os vídeos vêm creditados como
//     colaboração ("… | Oficial e Adventist…"). Filtrar por ele derruba tudo.
//  6. **A DATA TEM DUAS FORMAS, e o mesmo episódio usa as duas** — ver
//     [dataDoVideo], onde ela é tratada.
//  7. **UM CANAL PUBLICA A MESMA SÉRIE EM VÁRIOS IDIOMAS**, e o prefixo separa
//     as PLAYLISTS mas NÃO os vídeos (em espanhol eles começam com a mesma
//     palavra). Daí [ehOutroIdioma], irmão do [ehLibras] e pelo mesmo motivo:
//     um vídeo posto por engano na playlist de português iria ao telão do culto
//     num idioma que a congregação não fala, e nada no id, na duração ou na
//     miniatura o denuncia.
//
// Os campos [periodo] e [titulo] existem porque a segunda série desmentiu duas
// suposições que só pareciam universais com uma série só (playlist trimestral;
// título SEM nome de episódio). Nenhuma delas é um `if` por série.
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
  // A SÉRIE É O NOME DO EPISÓDIO (v5.271). Vale quando o canal não põe nome de
  // episódio nenhum no título ("Informativo Mundial das Missões | 15 AGOSTO
  // 2026"): em vez de deixar a linha só com a data, ela leva o nome da série.
  const TITULO_SERIE = 'serie';

  // O que fazer com um episódio cujo sábado ainda não chegou. Ver [aindaNaoSaiu]
  // e o campo `futuros` no catálogo.
  const FUTUROS_MOSTRAR = 'mostrar';      // o padrão: a playlist só tem o que saiu
  const FUTUROS_ESCONDER = 'esconder';    // o canal sobe o trimestre e libera aos poucos

  /**
   * O PISO da antecedência: quantos dias antes de um sábado FUTURO o episódio
   * dele já aparece na lista (v5.256).
   *
   * Três, isto é: **a quarta-feira antes daquele sábado**, que foi o pedido do
   * operador — *"a data de corte não pode ser o próprio dia, pois muitos
   * aproveitam para fazer a organização antes"*. O roteiro do culto é montado
   * durante a semana, e uma lista que só mostra o episódio no sábado de manhã
   * chega tarde para quem prepara.
   *
   * É uma contagem de DIAS e não um dia da semana, e é ela que sobrevive ao dia
   * em que o canal publicar num domingo.
   *
   * **É PISO, e não a régua inteira:** o episódio da SEMANA CORRENTE nunca é
   * escondido, venha ele daqui a seis dias — ver [aindaNaoSaiu], onde as duas
   * metades se juntam, e [sabadoDaSemana], de onde sai a semana. Enquanto esta
   * contagem foi a régua inteira, o domingo, a segunda e a terça escondiam o
   * episódio do sábado que vem enquanto o destaque do topo o declarava o desta
   * semana.
   *
   * **O preço está dito e tem remédio:** enquanto o sábado não chega o vídeo
   * pode ainda não estar público, e o download falha. Quem explica isso é o
   * `controle.js`, com a frase que manda esperar chegar mais perto — ver
   * `serieComoYoutube`.
   */
  const DIAS_DE_ANTECEDENCIA = 3;

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
      // A playlist do mês só traz o que já saiu — nada a esconder, e a medição
      // é do registro do aparelho: em 15 de agosto ela tinha até 26 de
      // setembro, e aqueles episódios TOCAM. Ligar isto aqui apagaria da
      // Biblioteca um mês inteiro de vídeos que existem.
      futuros: FUTUROS_MOSTRAR,
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
      // ---------- O ITEM PRECISA DIZER DE QUE SÉRIE ELE É (v5.271) ----------
      // Relato do operador: os vídeos do Informativo saem *"apenas com o nome
      // com a data, mas sem a identificação de 'Informativo Mundial das
      // Missões' em cada item"*.
      //
      // A v5.244 deixou o item só com a DATA, por um argumento que era
      // verdadeiro DENTRO do álbum: ali o cabeçalho já diz qual é a série, e
      // repetir o nome em 52 linhas seria a metade constante ocupando a lista
      // inteira — "exatamente o defeito que aquela regra existe para corrigir,
      // ao contrário".
      //
      // **O que ele não viu é que o item SAI do álbum.** Mandado ao Cronograma
      // ou aos Favoritos, ele perde o cabeçalho que o explicava e vira uma
      // linha "15/Ago" com o subtítulo "YouTube" — e não há nada na tela, em
      // lugar nenhum, que diga de que série ele é. Nas listas do culto é o
      // contrário do álbum: o nome da série é a única coisa que distingue
      // aquele item de qualquer outro vídeo.
      //
      // O `rotulo` é o nome SEM o ano, e não o `name` da série: o ano já está
      // na data ao lado ("15/Ago"), e repeti-lo gastaria a largura que a lista
      // do Cronograma tem de sobra para o resto.
      titulo: TITULO_SERIE,
      rotulo: 'Informativo Mundial das Missões',
      // O CANAL SOBE O TRIMESTRE INTEIRO e libera um sábado por vez (v5.255).
      // Os que ainda não saíram ficam na playlist como "prioridade para
      // membros": aparecem, e não tocam.
      //
      // **O erro possível é assimétrico, e é por isso que o campo existe em vez
      // de a regra ser global.** Esconder cedo demais custa um episódio que já
      // estava liberado — e ele volta sozinho no dia seguinte, sem nada a
      // desfazer. Mostrar de mais custa um item que o operador põe no roteiro
      // do culto e que não toca na hora: o custo é a projeção parada, na frente
      // da congregação, sem o que fazer.
      futuros: FUTUROS_ESCONDER,
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
   * As faixas cobrem as ESCRITAS (cirílico, hebraico, árabe, tailandês, os
   * silabários japoneses, os ideogramas, o hangul) e mais a pontuação CJK
   * (【】。「」、・), que vale por escrita porque só aparece em título CJK. O
   * que fica de FORA é a pontuação de LARGURA FIXA (ver a faixa de
   * meia-largura, abaixo), que um título em português produz. A régua não é
   * "pontuação nunca diz idioma": é que ESTA pontuação não existe fora do CJK
   * e AQUELA um teclado brasileiro digita.
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
    // MEIA-LARGURA, e só ela: katakana (ff61-ff9f) e hangul (ffa0-ffdc) são
    // ESCRITA. O bloco começa antes disso, em ff00-ff60, com o ASCII de largura
    // fixa (｜｀！＂＃…) — e ele fica de fora porque um título em português o
    // PRODUZ: um "｜" no lugar do "|" fazia o episódio ser recusado como "está
    // em outro idioma", o defeito da v5.252 ("Mission Refocus") por outra
    // régua. É a diferença para a pontuação CJK lá de cima (【】。「」、・), que
    // fica DENTRO por não aparecer fora de um título CJK. Os símbolos e moedas
    // de ffe0-ffee saem pelo mesmo lado da régua: nada garante que sejam de lá.
    + '\\uff61-\\uffdc]', // katakana e hangul de MEIA-LARGURA
  );

  /**
   * As MARCAS de outro idioma latino — as que não dá para ver pelo alfabeto.
   *
   * Comparadas contra [normalizar], então já vêm sem acento: "Misión" é
   * `mision` e "Missões" é `missoes`. As duas palavras não se cruzam em
   * nenhuma flexão, e é isso que torna o teste possível sem apagar português.
   */
  // A LIÇÃO ESTÁ NESTA LISTA, e ela custou um episódio (v5.252).
  //
  // O inglês era `\bmissions?\b`, e a primeira varredura em aparelho de verdade
  // recusou **"Mission Refocus | Provai e Vede  2026 (27/Jun)"** — um episódio
  // em PORTUGUÊS, do canal certo, dentro da playlist certa, cujo título tem uma
  // palavra em inglês. O registro o mostrou como "está em outro idioma" e o
  // sábado 27 de junho simplesmente não estava na lista: **o erro que este
  // arquivo inteiro existe para evitar**, cometido pela guarda que eu havia
  // escrito com o custo declarado no KDoc abaixo.
  //
  // O que estava errado não era o alvo, era a RÉGUA. Uma palavra solta em
  // inglês não diz o idioma de um título — títulos em português usam palavras
  // em inglês o tempo todo. O que diz é o NOME DO PROGRAMA: o mesmo material
  // sai como "Mission Spotlight"/"Mission Stories"/"World Mission" em inglês e
  // "Missionnaire" em francês, e essas são expressões que um título brasileiro
  // não produz por acidente. Espanhol continua por PALAVRA porque ali as
  // palavras não se cruzam: "missões" nunca é "misiones", em flexão nenhuma.
  //
  // A regra geral que fica: **uma marca de idioma tem de ser impossível na
  // língua que se quer manter, não apenas típica da que se quer recusar.**
  const IDIOMAS_DE_FORA = [
    /\bmision(es)?\b/,                        // espanhol — "…de las Misiones"
    /\bde las\b/,                             // espanhol — impossível em português
    /\bmissionnaire\b/,                       // francês — "Missionnaire - 1e Trimestre"
    /\bmission (stories|spotlight|report)\b/, // inglês — pelo NOME do programa
    /\bworld mission\b/,                      // inglês — o nome anterior dele
  ];

  /**
   * O título é de OUTRO idioma? (armadilha 7)
   *
   * O irmão do [ehLibras], e pelo mesmo motivo: um vídeo posto por engano na
   * playlist de português vai ao telão sem que nada o denuncie — o id, a
   * duração, a miniatura e o canal são idênticos aos dos legítimos.
   *
   * **O falso positivo que ELA JÁ COMETEU está escrito na lista acima**, e o
   * KDoc que ele desmentiu ficava aqui: eu havia declarado o custo ("um vídeo
   * a menos, que o operador vê na lista e resolve à mão") como se fosse
   * aceitável. Não é — na primeira varredura real ele apagou o episódio de 27
   * de junho, e "o operador vê na lista" supõe que ele saiba que falta alguma
   * coisa. O que de fato mostrou foi o REGISTRO, que nasceu no mesmo dia.
   *
   * O custo residual continua declarado, agora do tamanho certo: um episódio
   * cujo título contenha "Mission Spotlight", "World Mission" ou
   * "Missionnaire" seria recusado. São nomes de PROGRAMA, não palavras — a
   * chance de um episódio brasileiro se chamar assim é o preço, e ele é
   * pequeno o bastante para caber na régua que o erro de junho estabeleceu.
   *
   * **Ela é GLOBAL, e não um campo do catálogo.** Uma série de um canal só em
   * português nunca casa nenhuma destas regras, então ligá-la por série seria
   * escolher, para cada linha nova, se a proteção vale — e a resposta é sempre
   * a mesma. Medido: das 145 playlists e 50 vídeos do @daniellocutor e das 94
   * playlists e 38 vídeos do @provaievedeoficial, ela recusa exatamente o que
   * não é português — e nada mais.
   */
  function ehOutroIdioma(nome) {
    const bruto = String(nome == null ? '' : nome);
    if (ESCRITAS_DE_FORA.test(bruto)) return true;
    const n = normalizar(bruto);
    return IDIOMAS_DE_FORA.some((re) => re.test(n));
  }

  // OS MOTIVOS DE RECUSA, como CÓDIGO e não como frase (v5.249).
  //
  // É a mesma divisão que o `otaDiag` e o `ytDiag` já fazem entre o Kotlin e o
  // `controle.js`, aplicada aqui: **este arquivo devolve DADO, e quem monta a
  // frase é quem desenha o Registro.** Uma regra pura que soubesse escrever
  // "não começa com o prefixo" teria de conhecer o idioma da UI, e o oráculo
  // passaria a comparar prosa.
  const MOTIVO_VAZIO = 'vazio';       // sem nome nenhum
  const MOTIVO_PREFIXO = 'prefixo';   // não começa com o prefixo da série
  const MOTIVO_LIBRAS = 'libras';     // a tradução em Libras (armadilha 3)
  const MOTIVO_IDIOMA = 'idioma';     // outro idioma do mesmo canal (armadilha 7)
  const MOTIVO_ANO = 'ano';           // é da série, mas de outro ano
  const MOTIVO_PERIODO = 'periodo';   // não declara mês nem trimestre
  const MOTIVO_SEM_ID = 'sem-id';     // o extrator não devolveu id de vídeo
  const MOTIVO_FUTURO = 'futuro';     // o sábado dele ainda não chegou (v5.255)

  /**
   * O VEREDITO sobre uma playlist do canal: `{ mes, motivo }`.
   *
   * `motivo` vazio é a aceitação, e `mes` é o mês em que o PERÍODO começa
   * (1..12). Quatro perguntas, nesta ordem, e nenhuma delas casa separador
   * (armadilha 1): o nome COMEÇA com o prefixo, não fala de Libras nem de outro
   * idioma, traz o ano, e declara um período em qualquer posição.
   *
   * **Ele devolve o PRIMEIRO mês do período, não "o mês da playlist"**, e é
   * essa a única concessão que o trimestre pediu. O valor tem dois usos, e os
   * dois continuam certos: ele ORDENA as playlists entre si (julho antes de
   * outubro) e é o PISO de quem não declarar data no título — um episódio sem
   * data numa playlist de trimestre cai no começo daquele trimestre, que é a
   * coisa mais precisa que se pode afirmar sobre ele. Quem dá o mês de verdade
   * de cada item é a data do TÍTULO (ver [itensDaPlaylist]).
   *
   * **A ORDEM das perguntas é o que o Registro vai mostrar**, e por isso ela
   * importa mais do que antes: uma playlist em espanhol de outro ano é
   * reportada como "espanhol", não como "outro ano", porque o primeiro motivo
   * é o que decide. Ela vai do mais estrutural (não é desta série) ao mais
   * específico (é desta série e deste ano, mas não diz de que período é) — que
   * é a ordem em que a resposta muda o que se faz a respeito.
   */
  function avaliarPlaylist(nome, serie) {
    const s = serie || {};
    const n = normalizar(nome);
    if (!n || !s.prefixo || !s.ano) return { mes: 0, motivo: MOTIVO_VAZIO };
    if (!n.startsWith(normalizar(s.prefixo))) return { mes: 0, motivo: MOTIVO_PREFIXO };
    if (ehLibras(n)) return { mes: 0, motivo: MOTIVO_LIBRAS };
    if (ehOutroIdioma(nome)) return { mes: 0, motivo: MOTIVO_IDIOMA };
    // O ano como PALAVRA: sem o `\b`, "2026" casaria dentro de "12026" e, pior,
    // o ano de uma série futura casaria pedaço do de outra.
    if (!new RegExp('\\b' + String(s.ano) + '\\b').test(n)) return { mes: 0, motivo: MOTIVO_ANO };
    const mes = s.periodo === PERIODO_TRIMESTRE ? mesDoTrimestre(n) : mesDoNome(n);
    return mes ? { mes, motivo: '' } : { mes: 0, motivo: MOTIVO_PERIODO };
  }

  /**
   * O mês do período da playlist, ou 0 — a metade de [avaliarPlaylist] que a
   * regra usa quando não está explicando nada a ninguém.
   *
   * **Ela DELEGA em vez de repetir, e essa é a decisão inteira.** Uma segunda
   * escrita das mesmas quatro perguntas — uma para decidir, outra para contar
   * o que decidiu — envelheceria à parte no primeiro ajuste, e o que sairia
   * disso é um diagnóstico que discorda do aparelho: o pior artefato que este
   * projeto pode produzir, porque ele é lido A DISTÂNCIA e por quem não tem
   * como conferir.
   */
  function mesDaPlaylist(nome, serie) {
    return avaliarPlaylist(nome, serie).mes;
  }

  /**
   * O VEREDITO sobre um vídeo: `{ motivo, data }`.
   *
   * `motivo` vazio é a aceitação; `data` é o que o título declarou, ou `null`.
   * **`data` nula NÃO é recusa** — é a regra de ouro em ação (o vídeo entra com
   * o dia em branco). Ela sai daqui porque é o ACHADO que o Registro precisa
   * nomear: um episódio sem data é um episódio fora de ordem e sem rótulo na
   * lista do culto, e é o sintoma exato que o operador relatou na v5.230.
   */
  function avaliarVideo(v, serie, hoje) {
    if (!v || !v.id) return { motivo: MOTIVO_SEM_ID, data: null };
    if (ehLibras(v.name)) return { motivo: MOTIVO_LIBRAS, data: null };
    if (ehOutroIdioma(v.name)) return { motivo: MOTIVO_IDIOMA, data: null };
    const data = dataDoVideo(v.name);
    if (aindaNaoSaiu(data, serie, hoje)) return { motivo: MOTIVO_FUTURO, data };
    return { motivo: '', data };
  }

  /**
   * O episódio é de um sábado que AINDA NÃO CHEGOU? (v5.255)
   *
   * Relato do operador: *"o informativo mundial das missões só libera apenas o
   * informativo referente a aquela semana e dos passados. Exemplo: hoje é
   * sábado 15 de agosto, então eu só tenho o 15 de agosto e os anteriores."*
   *
   * O canal sobe o TRIMESTRE INTEIRO de uma vez e o libera um sábado por vez —
   * os que ainda não saíram ficam na playlist como **prioridade para membros**:
   * têm título, miniatura e duração, aparecem na listagem, e não tocam. A lista
   * do app mostrava até 12 de dezembro em agosto, isto é, dezessete promessas
   * que ela não podia cumprir, e a mais cara delas no meio de um culto.
   *
   * **A régua é a DATA, porque é o único sinal que existe deste lado.** O que
   * decide de verdade é a liberação no YouTube, e o extrator não a publica: o
   * item de um vídeo restrito vem idêntico ao de um liberado. Errar por data é
   * o preço, e ele é assimétrico — ver o campo [futuros] no catálogo.
   *
   * **A comparação é por DIA, nunca por instante.** O episódio de hoje É de
   * hoje, e um `>` sobre milissegundos o esconderia até a meia-noite. As três
   * partes viram um inteiro (`AAAAMMDD`) e a ordem lexicográfica é a
   * cronológica, sem fuso, sem horário de verão e sem `Date` no meio.
   *
   * **Sem data no título, o vídeo NUNCA é escondido.** Ele é o achado da regra
   * de ouro (entra sem rótulo, no fim do mês) e esconder o que não se sabe
   * julgar seria transformar um item feio num item ausente.
   */
  function aindaNaoSaiu(data, serie, hoje) {
    if ((serie || {}).futuros !== FUTUROS_ESCONDER || !data) return false;
    // O EPISÓDIO DESTA SEMANA NUNCA É ESCONDIDO (v1.2.15).
    //
    // Duas regras deste mesmo arquivo respondiam "de que semana é este
    // episódio?" com calendários diferentes: [sabadoDaSemana] abre a semana no
    // DOMINGO (é a semana adventista, e o operador monta o culto a partir dela)
    // e a contagem abaixo só abria a janela na QUARTA. No domingo, na segunda e
    // na terça o episódio do sábado que vem era ESCONDIDO da lista pela segunda
    // enquanto a primeira o declarava o desta semana — e o destaque do topo
    // dizia "Aguardando lançamento" sobre um vídeo que o canal já tinha
    // liberado. Três dos sete dias da semana, e justamente os que o operador
    // usa para preparar.
    //
    // Ela DELEGA em [ehDoSabadoAtual] em vez de recontar os dias: é a mesma
    // razão do [mesDaPlaylist] — duas contas de calendário escritas à parte
    // divergem, e foi a divergência que produziu o defeito.
    if (ehDoSabadoAtual(data, serie, hoje)) return false;
    return diasAte(data, serie, hoje) > DIAS_DE_ANTECEDENCIA;
  }

  /**
   * QUANTOS DIAS FALTAM para o sábado deste episódio — negativo se já passou.
   *
   * Ela é o primitivo dos dois consumidores, e é por isso que existe separada:
   * [aindaNaoSaiu] a compara com [DIAS_DE_ANTECEDENCIA] (o que a lista mostra) e
   * o `controle.js` a compara com ZERO (o que já saiu de fato, para explicar uma
   * falha de download). Duas contas de calendário escritas à mão divergiriam.
   *
   * **`Date.UTC` nas duas pontas, e não subtração de `Date` local.** A conta é
   * de DIAS DE CALENDÁRIO, e um `getTime()` local atravessa o horário de verão:
   * um dia de 23 h faria a diferença arredondar para o vizinho errado
   * exatamente uma vez por ano — o tipo de defeito que aparece num sábado e não
   * se reproduz.
   */
  function diasAte(data, serie, hoje) {
    if (!data) return 0;
    const d = hoje instanceof Date ? hoje : new Date();
    const alvo = Date.UTC((serie || {}).ano || d.getFullYear(), data.mes - 1, data.dia);
    const base = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((alvo - base) / 86400000);
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
   * **`TITULO_SERIE`: a série não põe nome de episódio no título.** No
   * Informativo o título é a série mais a data ("Informativo Mundial das
   * Missões | 15 AGOSTO 2026") e o nome da história vive na MINIATURA, que o
   * índice guarda e a gaveta do item desenha (v5.236). Aplicar o padrão aqui
   * daria 52 linhas idênticas — a metade constante ocupando a lista inteira,
   * exatamente o defeito que o padrão existe para corrigir, ao contrário. No
   * lugar entra o RÓTULO da série, porque o item SAI do álbum: no Cronograma
   * ele perde o cabeçalho que dizia de que série ele é, e a data sozinha não
   * o identifica lá fora (v5.271).
   *
   * Um terceiro caso — o nome à DIREITA da barra — não existe em canal nenhum
   * lido até aqui, e por isso não está escrito: seria um ramo que nada alcança.
   */
  function tituloDoEpisodio(titulo, serie) {
    const t = String(titulo == null ? '' : titulo).replace(/\s+/g, ' ').trim();
    if (!t) return '';
    // A SÉRIE COMO NOME: o título do vídeo é ignorado (ele é a série mais a
    // data, e a data já vem do `nomeDoItem`), e o que fica é o rótulo da série.
    // Ele NÃO sai do `name` por padrão porque aquele carrega o ano.
    if (serie && serie.titulo === TITULO_SERIE) return serie.rotulo || serie.name || '';
    const i = t.indexOf('|');
    const esq = i > 0 ? t.slice(0, i).trim() : '';
    return esq || t;
  }

  /**
   * ===== O SÁBADO DESTA SEMANA (v1.1.21) =====
   *
   * Pedido do operador: *"faça um sistema de destaque que colocasse separado
   * destacado no topo da lista o item referente ao sábado atual; caso não
   * tenha, deixe uma mensagem de Aguardando lançamento"*.
   *
   * **A SEMANA COMEÇA NO DOMINGO** — é a semana adventista, e é a que o
   * operador vive: no domingo ele já está montando o culto do sábado que vem.
   * Daí `6 - getDay()`: domingo devolve 6, sexta devolve 1, sábado devolve 0.
   * Uma semana começando na segunda faria o domingo de manhã destacar o sábado
   * que ACABOU de passar, que é o único dia em que ninguém procura por ele.
   *
   * A data volta como `{ ano, mes, dia }` e não como `Date` porque é isso que o
   * resto deste módulo fala (`dataDoVideo`, `rotuloData`) — e porque quem a
   * consome quer escrevê-la, não fazer conta com ela. O `new Date(y, m, d + n)`
   * normaliza a virada de mês e de ano sozinho.
   */
  function sabadoDaSemana(hoje) {
    const d = hoje instanceof Date ? hoje : new Date();
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (6 - d.getDay()));
    return { ano: s.getFullYear(), mes: s.getMonth() + 1, dia: s.getDate() };
  }

  /**
   * ESTE EPISÓDIO É O DO SÁBADO DESTA SEMANA?
   *
   * **A pergunta é pela SEMANA, não pelo dia exato**, e isso é defesa e não
   * frouxidão: a régua deste módulo inteiro é a data do TÍTULO, e o canal
   * escreve a data que quiser — o `DIAS_DE_ANTECEDENCIA` já existe porque
   * "publica no sábado" não é promessa que se possa cobrar. Exigir
   * `diasAte === diasAteSábado` faria um episódio datado de sexta desaparecer
   * do destaque e a tela dizer "Aguardando lançamento" sobre um vídeo que está
   * na lista logo abaixo — a pior das duas mentiras possíveis aqui.
   *
   * A janela é a semana corrente inteira: de domingo (`-getDay()`) a sábado
   * (`6 - getDay()`). Numa série SEMANAL cai no máximo um item nela.
   *
   * Reusa o `diasAte` de propósito: ele é o primitivo de calendário deste
   * módulo (`Date.UTC` nas duas pontas, imune ao horário de verão), e uma
   * segunda conta escrita à mão divergiria dele exatamente uma vez por ano.
   */
  function ehDoSabadoAtual(data, serie, hoje) {
    if (!data) return false;
    const d = hoje instanceof Date ? hoje : new Date();
    const n = diasAte(data, serie, d);
    return n >= -d.getDay() && n <= 6 - d.getDay();
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
   *
   * `hoje` (um `Date`, ou nada) é o que decide o corte dos episódios que ainda
   * não saíram — ver [aindaNaoSaiu]. Ele é PARÂMETRO e não `new Date()` lá
   * dentro por uma razão só: uma regra que lê o relógio não tem oráculo, e o
   * que ela decide é o que aparece na lista do culto.
   */
  function itensDaPlaylist(videos, mesDaLista, serie, hoje) {
    const out = [];
    (Array.isArray(videos) ? videos : []).forEach((v, i) => {
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
      //
      // Quem responde é [avaliarVideo], e pela mesma razão do [mesDaPlaylist]:
      // o Registro conta o que aconteceu com cada vídeo, e ele tem de contar a
      // decisão que de fato foi tomada — não uma segunda escrita dela.
      const ver = avaliarVideo(v, serie, hoje);
      if (ver.motivo) return;
      const d = ver.data;
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
   *  - **só o título**: o vídeo não declarou data nenhuma (a regra de ouro
   *    mandou ele entrar assim mesmo).
   *  - **nem um nem outro**: sobra o título CRU do YouTube. É feio e é longo,
   *    e é infinitamente melhor que uma linha em branco no meio da lista do
   *    culto — que seria intocável e inexplicável.
   *  - **nem isso**: o extrator devolveu `name` vazio (ou só espaço), e sobra
   *    o ID do vídeo — "vídeo dQw4w9WgXcQ".
   *
   * **Por que o último caso ENTRA, em vez de virar recusa em [avaliarVideo].**
   * Um item sem nome continua PROJETÁVEL: o id, a URL, a duração e a MINIATURA
   * chegaram inteiros, e é a miniatura que a gaveta desenha — o operador
   * reconhece o episódio sem ler rótulo nenhum. Recusar trocaria uma linha feia
   * (que ele resolve à mão) pelo sábado sem o vídeo do culto, que é o erro caro
   * da regra de ouro; e o Registro já mostra o caso, porque um item sem data
   * entra na conta do "entrou SEM data".
   *
   * O id é o último identificador que SEMPRE existe: [avaliarVideo] recusa
   * quem chega sem ele (`MOTIVO_SEM_ID`), e é isso que faz "nunca devolve
   * vazio" ser verdade por construção. O `?` cobre só quem chame esta função
   * de fora do caminho da regra.
   */
  function nomeDoItem(item) {
    const d = rotuloData(item.dia ? { dia: item.dia, mes: item.mes } : null);
    const t = item.titulo || '';
    if (d && t) return d + ' · ' + t;
    // `trim()` no título cru: um nome só de espaços passava no `||` e desenhava
    // a mesma linha em branco que o resto desta função existe para impedir.
    return d || t || String(item.nomeOriginal || '').trim()
      || ('vídeo ' + (String(item.id || '').trim() || '?'));
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
      String(avaliarPlaylist), String(avaliarVideo), String(aindaNaoSaiu), String(diasAte),
      // [ehDoSabadoAtual] entra aqui desde a v1.2.15: ela deixou de ser só o
      // destaque do topo e passou a decidir o que a LISTA contém (é ela que
      // impede o episódio desta semana de ser escondido). Sem ela, mexer na
      // janela da semana deixaria de pé todo índice já guardado.
      String(ehDoSabadoAtual), String(sabadoDaSemana),
      // As duas RECUSAS por idioma são DADOS e não código, e por isso entram
      // pelo valor: mudar uma marca (ou uma faixa de escrita) muda o que o
      // álbum contém, exatamente como mudar uma função — e sem isto o índice
      // guardado sobreviveria à correção, que é o defeito da v5.233 por
      // inteiro.
      String(ehOutroIdioma), String(ESCRITAS_DE_FORA), String(IDIOMAS_DE_FORA),
      // E PELO MESMO ARGUMENTO, os NOMES DOS MESES e a antecedência: eles
      // decidem o que a regra produz tanto quanto uma função. `dataDoVideo`
      // casa o mês pelo nome (`MESES`), `rotuloData` o escreve (`MES_CURTO`), e
      // `aindaNaoSaiu` corta pela `DIAS_DE_ANTECEDENCIA` — mudar qualquer um
      // muda a lista, e sem eles aqui o índice guardado sobreviveria à
      // correção. (`MESES_ABREV` é derivado de `MESES` e vem de graça.)
      JSON.stringify(MESES), JSON.stringify(MES_CURTO), String(DIAS_DE_ANTECEDENCIA),
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
    PERIODO_MES, PERIODO_TRIMESTRE, TITULO_ESQUERDA, TITULO_SERIE,
    FUTUROS_MOSTRAR, FUTUROS_ESCONDER, DIAS_DE_ANTECEDENCIA,
    MOTIVO_VAZIO, MOTIVO_PREFIXO, MOTIVO_LIBRAS, MOTIVO_IDIOMA,
    MOTIVO_ANO, MOTIVO_PERIODO, MOTIVO_SEM_ID, MOTIVO_FUTURO,
    normalizar, ehLibras, ehOutroIdioma, aindaNaoSaiu, diasAte,
    avaliarPlaylist, avaliarVideo,
    mesDaPlaylist, playlistsDaSerie,
    dataDoVideo, tituloDoEpisodio, rotuloData,
    sabadoDaSemana, ehDoSabadoAtual,
    itensDaPlaylist, ordenarItens, nomeDoItem,
    impressao,
  };
})(this);
