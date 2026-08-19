// ============================================================================
// SORTEIO TEMÁTICO — a regra que decide o que pode ser sorteado da Biblioteca
//
// O operador digita uma PALAVRA TEMA ("natal", "cruz", "gratidão"), marca dois
// ou três filtros e recebe UMA faixa no telão ou uma FILA montada na hora. Este
// arquivo responde à única pergunta difícil disso: **quais faixas do acervo
// podem sair no sorteio, e por quê as outras não podem.**
//
// ## Por que é um arquivo à parte, e PURO
//
// Não toca no DOM, não faz rede, não conhece o `controle.js` — as três coisas
// de que ele precisa (normalizar texto, saber se a coleção é de música, saber
// se a letra casa) chegam INJETADAS em `cap`. As razões são as do `serie.js`:
//
//  1. **É ele que decide o que vai ao telão**, e sem ninguém conferindo: o
//     operador toca UM botão e a faixa entra em cena. Um erro aqui não é pixel
//     errado — é o playback tocando onde se esperava a cantada, ou a lista
//     vindo vazia num sábado de manhã. Daí o oráculo (`tools/sorteio.test.mjs`,
//     Node puro, no `apk.yml` **sem `continue-on-error`**).
//  2. **A decisão é de CONTEÚDO, logo é do lado web** (invariante 5): ela chega
//     por OTA em minutos, com oráculo em Node.
//
// ## As capacidades são INJETADAS, e isso não é cerimônia
//
// `normalizeForSearch` é o normalizador ÚNICO da Biblioteca inteira, e
// `lyricMatch` é o casamento por letra que a busca já usa. Reescrever qualquer
// um dos dois aqui faria o sorteio achar um conjunto e a busca achar outro,
// para a mesma palavra, na mesma tela — o pior desfecho possível, porque os
// dois pareceriam certos. Por isso este módulo não normaliza nada: ele PEDE.
//
// ## A regra de ouro: o que entra é o que TOCA
//
// Uma faixa entra por ter a variante pedida E casar o tema. Não casando o tema
// ela fica de fora — mas a recusa é CONTADA e NOMEADA (ver [montarPool]),
// porque "nada encontrado" tem cinco causas indistinguíveis da tela: a coleção
// não tem índice, o filtro de hinário levou tudo, a variante não existe na
// origem, o tema não casa, ou nada está no aparelho. As cinco pedem ações
// opostas do operador, e é o Registro que as separa.
//
// ## As armadilhas do acervo, que a regra tem de conhecer
//
//  1. **`has_instrumental_music` diz que a ORIGEM tem playback**, não que o
//     playback está no aparelho — e ele é `false` para toda série (o `coll` de
//     série nem chega aqui, ver [avaliarColecao], mas a distinção vale para
//     álbum). Perguntar "tem playback?" pelo campo errado monta uma fila que
//     falha faixa a faixa na hora de baixar.
//  2. **`semAudio`/`semPlayback` marcam "a ORIGEM não tem esta variante"**, e
//     são o único jeito de saber isso ANTES de tentar baixar. Sem elas a faixa
//     entra no sorteio, o download não acha URL, e o cartão da preview diz "sem
//     internet para baixar" — a frase errada, para um problema que não é de
//     rede.
//  3. **`fileIdFull`/`fileIdPlayback` são o critério BARATO de "já está no
//     aparelho"** (o mesmo de `levantarColecao`). O autoritativo é
//     `songVariantsNeeded`, que vai ao IDB — e ir ao IDB por faixa varreria o
//     acervo inteiro a cada tecla digitada. O erro possível aqui é o SEGURO:
//     uma faixa marcada como presente que precise de um retoque de download
//     apenas passa pelo caminho de download de sempre.
//  4. **A LETRA não mora na faixa.** Ela vive no índice de letras, que é
//     montado sob demanda e pode não estar pronto — daí `cap.letraCasa` poder
//     responder `false` por ausência de índice, e daí o chamador ter de esperar
//     o índice ANTES de sortear (na busca isso vira um redesenho tardio; aqui
//     não haveria redesenho: a faixa já foi para o telão).
//
// ## O que este arquivo NÃO faz, de propósito
//
// Não baixa, não toca, não escreve lista. Ele devolve `{ coll, s, variante }` e
// quem os transforma em mídia é o caminho de download/projeção que já existe
// (`resolveSongMediaId` → `send`). Um segundo caminho de projeção seria a
// invariante 5 quebrada de dentro para fora.
//
// Exposto como window.AVSorteio.
// ============================================================================

(function (global) {
  'use strict';

  // ---- OS DOIS EIXOS DA ESCOLHA ----
  // O MODO responde "quanto?" e a VARIANTE responde "o quê?". São perguntas
  // independentes: sortear uma cantada e montar uma fila de playbacks são os
  // dois cantos úteis do mesmo quadrado.
  const MODO_UMA = 'uma';
  const MODO_PLAYLIST = 'playlist';

  // AS STRINGS SÃO AS DO `resolveSongMediaId`, e isto é trava, não coincidência:
  // lá qualquer valor DIFERENTE de `'full'` resolve o `fileIdPlayback` — não há
  // `=== 'playback'`. Uma terceira variante inventada aqui ('cantada', 'letra')
  // sairia como playback no telão, em silêncio.
  const VARIANTE_CANTADA = 'full';
  const VARIANTE_PLAYBACK = 'playback';

  // ---- OS MOTIVOS DE RECUSA ----
  // Eles são o produto MAIS IMPORTANTE deste módulo depois da lista em si: uma
  // lista vazia sem motivo é indistinguível de um defeito. Quem monta a frase é
  // o `controle.js` (regra do projeto: Kotlin e regra devolvem dado, a UI
  // escreve a frase).
  const MOTIVO_SEM_MUSICA = 'sem-musica';   // coleção: não é acervo de música
  const MOTIVO_HINARIO = 'hinario';         // coleção: o filtro pediu sem hinário
  const MOTIVO_SEM_INDICE = 'sem-indice';   // coleção: nenhuma faixa indexada
  const MOTIVO_VARIANTE = 'variante';       // faixa: a origem não tem esta variante
  const MOTIVO_TEMA = 'tema';               // faixa: não casa a palavra tema
  const MOTIVO_FORA = 'fora-do-aparelho';   // faixa: o filtro pediu só o baixado

  // ---- ONDE O TEMA CASOU ----
  // Vira o subtítulo da linha ("casou na letra") e a contagem do Registro. É a
  // única coisa que explica ao operador por que um louvor que ele não associa
  // ao tema apareceu na fila.
  const CASOU_NOME = 'nome';
  const CASOU_ALBUM = 'album';
  const CASOU_LETRA = 'letra';
  const CASOU_SEM_TEMA = 'sem-tema';        // sem palavra digitada: o acervo todo

  // Quantas faixas a fila pode ter. É um TETO com nome porque, sem ele, um tema
  // genérico ("Deus" casa em quase toda letra) montaria uma fila de centenas —
  // e, no pior caso, centenas de downloads antes de a primeira nota tocar.
  const QUANTIDADES = [3, 5, 10, 15, 20];
  const QUANTIDADE_PADRAO = 5;

  // ---- O ESTADO SANEADO ----
  // Campo a campo e por TIPO, como `applyDrawPrefs`: isto lê o que voltou do
  // IndexedDB, que pode ter sido gravado por uma versão anterior do app. Um
  // campo ausente cai no padrão; um campo com o tipo errado também. O que NÃO
  // pode acontecer é um `variante: 'cantada'` guardado por engano atravessar
  // até o `resolveSongMediaId` (ver a nota das duas strings, acima).
  function sanear(f) {
    const p = f || {};
    return {
      modo: p.modo === MODO_PLAYLIST ? MODO_PLAYLIST : MODO_UMA,
      tema: typeof p.tema === 'string' ? p.tema : '',
      variante: p.variante === VARIANTE_PLAYBACK ? VARIANTE_PLAYBACK : VARIANTE_CANTADA,
      semHinario: p.semHinario === true,
      soNoAparelho: p.soNoAparelho === true,
      quantos: QUANTIDADES.includes(p.quantos | 0) ? (p.quantos | 0) : QUANTIDADE_PADRAO,
    };
  }

  // A ORIGEM tem esta variante? (≠ "está no aparelho", ver a armadilha 1.)
  //
  // A pergunta do playback é DUPLA de propósito: `has_instrumental_music` diz
  // que o banco publica um, e `semPlayback` diz que já tentamos e não havia.
  // Perguntar só a primeira monta filas que quebram no download; perguntar só a
  // segunda deixa passar toda faixa que nunca foi tentada.
  function temVariante(s, variante) {
    if (!s) return false;
    if (variante === VARIANTE_PLAYBACK) return !!s.has_instrumental_music && !s.semPlayback;
    return !s.semAudio;
  }

  // ---- A COLEÇÃO ENTRA? ----
  //
  // A ORDEM das três perguntas é contrato, porque é ela que o Registro imprime:
  // uma série recusada sai como "não é acervo de música", nunca como "sem
  // índice" — mesmo que também não tenha índice. A pergunta mais estrutural vem
  // primeiro, e a que o operador pode CONSERTAR vem por último.
  //
  // `cap.ehMusica` é o `temLetra` do `controle.js`, e o nome muda aqui de
  // propósito: o que interessa ao sorteio não é a letra, é ser um acervo de
  // MÚSICA — com faixa de áudio, variante e download por faixa. Perguntar pela
  // CAPACIDADE (e não por `coll.kind === 'serie'`) é o que deixa o terceiro
  // modelo de coleção entrar sem um `if` novo aqui.
  //
  // As pastas do aparelho e os Favoritos não aparecem nesta varredura por
  // construção: eles não são coleções (`allCollections` não os conhece), são
  // listas. Fica escrito porque "por que meus favoritos não entram no sorteio?"
  // é a primeira pergunta que a tela provoca.
  function avaliarColecao(coll, filtros, cap) {
    if (!coll) return { entra: false, motivo: MOTIVO_SEM_MUSICA };
    if (!cap.ehMusica(coll)) return { entra: false, motivo: MOTIVO_SEM_MUSICA };
    if (filtros.semHinario && cap.ehHinario(coll)) return { entra: false, motivo: MOTIVO_HINARIO };
    if (!cap.faixas(coll).length) return { entra: false, motivo: MOTIVO_SEM_INDICE };
    return { entra: true, motivo: '' };
  }

  // ---- ONDE O TEMA CASA ----
  //
  // Três lugares, do mais específico ao mais amplo — e a ordem é a mesma da
  // busca da Biblioteca (título antes de letra), pela mesma razão: quem digita
  // "natal" quer primeiro o louvor CHAMADO Natal.
  //
  // O ÁLBUM no meio é a diferença entre "busca" e "tema": um álbum inteiro
  // chamado "Natal" É o tema, e as faixas dele raramente repetem a palavra no
  // título. `temaNoAlbum` é calculado UMA vez por coleção pelo chamador — aqui
  // ele chega pronto, senão seriam N normalizações do mesmo nome.
  //
  // A LETRA é a mais cara e a mais frouxa, e quem a limita é o `cap.letraCasa`
  // (o `lyricMatch`, que já recusa buscas curtas demais pelo `LYRIC_MIN_Q`).
  // Sem esse piso, "de" e "ao" casariam em quase todo hino do acervo.
  function ondeCasa(coll, s, q, temaNoAlbum, cap) {
    if (!q) return CASOU_SEM_TEMA;
    if (cap.nomeNorm(s).includes(q)) return CASOU_NOME;
    if (temaNoAlbum) return CASOU_ALBUM;
    if (cap.letraCasa(coll, s, q)) return CASOU_LETRA;
    return '';
  }

  // ---- A FAIXA ENTRA? ----
  //
  // A ORDEM também é contrato aqui, e a razão é o Registro de novo: uma faixa
  // sem playback recusada com o filtro "Playback" ligado sai como "a origem não
  // tem esta variante" — que é acionável ("troque para Cantada") — e não como
  // "não casa o tema", que mandaria o operador reescrever a palavra à toa.
  //
  // `noAparelho` é DEVOLVIDO mesmo quando a faixa é recusada por ele: é o que
  // permite ao contador dizer "12 casam · 3 já no aparelho" e ao operador
  // entender o que o filtro está custando.
  function avaliarFaixa(coll, s, filtros, cap, q, temaNoAlbum) {
    if (!temVariante(s, filtros.variante)) {
      return { entra: false, motivo: MOTIVO_VARIANTE, casou: '', noAparelho: false };
    }
    const casou = ondeCasa(coll, s, q, temaNoAlbum, cap);
    if (!casou) return { entra: false, motivo: MOTIVO_TEMA, casou: '', noAparelho: false };
    const noAparelho = !!cap.noAparelho(coll, s, filtros.variante);
    if (filtros.soNoAparelho && !noAparelho) {
      return { entra: false, motivo: MOTIVO_FORA, casou, noAparelho };
    }
    return { entra: true, motivo: '', casou, noAparelho };
  }

  // ---- O POOL ----
  //
  // Uma passada só sobre o acervo inteiro, devolvendo a lista E a prestação de
  // contas. Os contadores não são enfeite de log: eles são a única coisa que
  // separa as cinco causas de "não achei nada" (ver o cabeçalho).
  //
  // Devolve `itens` na ordem do acervo — NÃO embaralhados. Quem embaralha é
  // [sortear], e as duas coisas são separadas porque o contador da tela precisa
  // do pool a cada tecla digitada, e embaralhar a cada tecla seria trabalho
  // jogado fora dezenas de vezes por palavra.
  function montarPool(colecoes, filtros, cap) {
    const f = sanear(filtros);
    const q = cap.norm(f.tema).trim();
    const itens = [];
    const recusas = Object.create(null);
    const casaram = Object.create(null);
    const colecoesRecusadas = [];
    let colecoesVistas = 0;
    let colecoesUsadas = 0;
    let faixasVistas = 0;
    let noAparelho = 0;

    for (const coll of colecoes || []) {
      colecoesVistas++;
      const v = avaliarColecao(coll, f, cap);
      if (!v.entra) {
        colecoesRecusadas.push({ nome: (coll && coll.name) || '', motivo: v.motivo });
        continue;
      }
      colecoesUsadas++;
      // UMA normalização por coleção, não uma por faixa: `coll.name` não muda
      // dentro do laço, e a busca da Biblioteca já pagou esse preço uma vez
      // (é a razão de o `_norm` da faixa existir).
      const temaNoAlbum = !!q && cap.norm(coll.name || '').includes(q);
      for (const s of cap.faixas(coll)) {
        faixasVistas++;
        const r = avaliarFaixa(coll, s, f, cap, q, temaNoAlbum);
        if (!r.entra) {
          recusas[r.motivo] = (recusas[r.motivo] || 0) + 1;
          continue;
        }
        casaram[r.casou] = (casaram[r.casou] || 0) + 1;
        if (r.noAparelho) noAparelho++;
        itens.push({ coll, s, variante: f.variante, casou: r.casou, noAparelho: r.noAparelho });
      }
    }
    return {
      itens, recusas, casaram, colecoesRecusadas,
      colecoesVistas, colecoesUsadas, faixasVistas, noAparelho,
      tema: q, filtros: f,
    };
  }

  // Fisher-Yates com a fonte de acaso INJETADA. Ela é injetada por uma razão
  // só: sem isso o oráculo não teria como afirmar nada sobre o resultado, e um
  // sorteio sem oráculo é a metade não testável do recurso.
  function embaralhar(lista, rnd) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---- O SORTEIO ----
  //
  // **O QUE JÁ ESTÁ NO APARELHO VEM PRIMEIRO, SEMPRE.** Não é otimização: uma
  // fila de dez faixas que precisam ser baixadas é a congregação esperando o
  // download no meio do culto, e a rede da igreja é a mais frágil das
  // dependências deste app. Com o acervo baixado o sorteio responde no ato;
  // sem ele — aparelho recém-configurado — a partição vazia simplesmente não
  // contribui e tudo vem do que falta baixar, que é o comportamento certo lá.
  //
  // A preferência é ABSOLUTA (concatenar, não intercalar) e o preço está dito:
  // com três faixas baixadas e nenhum filtro, "sortear uma" sai dessas três até
  // que outras sejam baixadas. É por isso que o contador da tela mostra as duas
  // metades ("12 casam · 3 já no aparelho") em vez de um número só, e é por isso
  // que o chip "Só no aparelho" existe: ele torna a escolha explícita em vez de
  // deixá-la implícita na ordenação.
  //
  // Embaralha as DUAS partições, e não só a primeira: quando a de cima não
  // enche a fila, o que completa também tem de ser sorteado — senão o resto da
  // lista sai na ordem do acervo, isto é, sempre o mesmo álbum.
  function sortear(itens, quantos, rnd) {
    const n = Math.max(1, quantos | 0);
    const r = typeof rnd === 'function' ? rnd : Math.random;
    const lista = Array.isArray(itens) ? itens : [];
    const perto = embaralhar(lista.filter((i) => i && i.noAparelho), r);
    const longe = embaralhar(lista.filter((i) => i && !i.noAparelho), r);
    return perto.concat(longe).slice(0, n);
  }

  global.AVSorteio = {
    MODO_UMA, MODO_PLAYLIST,
    VARIANTE_CANTADA, VARIANTE_PLAYBACK,
    MOTIVO_SEM_MUSICA, MOTIVO_HINARIO, MOTIVO_SEM_INDICE,
    MOTIVO_VARIANTE, MOTIVO_TEMA, MOTIVO_FORA,
    CASOU_NOME, CASOU_ALBUM, CASOU_LETRA, CASOU_SEM_TEMA,
    QUANTIDADES, QUANTIDADE_PADRAO,
    sanear, temVariante, avaliarColecao, ondeCasa, avaliarFaixa,
    montarPool, embaralhar, sortear,
  };
})(this);
