// ============================================================================
// A COLETÂNEA DE VÍDEOS DO LOUVORJA — canal → playlist → vídeo virando
// coletânea → álbum → faixa
//
// ## O que este arquivo é
//
// O LouvorJA mantém, ao lado do acervo de ÁUDIO que este app já consome
// (`pt_hymnal`, `pt_categories`, `music_<id>`), um segundo acervo: uma
// CURADORIA de vídeos do YouTube, organizada em três tabelas —
// `online_videos_channels`, `online_videos_playlists`, `online_videos` — e
// servida inteira, de uma vez, por `GET /{lang}/collections/online`.
//
// Este módulo é a REGRA que lê aquele payload e devolve o que a Biblioteca
// desenha. Ele é PURO: sem rede, sem DOM, sem IndexedDB e sem ponte — quem
// busca é `louvorja.js`, quem desenha é `controle.js`. Oráculo em
// `tools/online.test.mjs`.
//
// ## A regra de ouro, herdada das SÉRIES
//
// **A PLAYLIST PROVA O PERTENCIMENTO; O TÍTULO É SÓ RÓTULO.** Um vídeo entra
// num álbum por ter `playlist_id` de uma playlist aceita, jamais por casar um
// padrão de título. É a mesma regra do `serie.js`, e aqui ela é ainda mais
// barata de honrar: lá a playlist precisava ser reconhecida pelo NOME (o canal
// renomeia sem avisar), aqui o vínculo é uma CHAVE ESTRANGEIRA que o banco do
// LouvorJA já resolveu. Nada neste arquivo lê título para decidir pertencimento.
//
// ## Por que uma COLETÂNEA e não um card de raiz como as séries
//
// A hierarquia da fonte e a da Biblioteca são a MESMA, com três níveis:
//
//     canal      1—N  playlist   1—N  vídeo
//     coletânea  1—N  álbum      1—N  faixa
//
// A série precisou de card de RAIZ porque ela é UMA playlist mensal por vez,
// descoberta na aba do canal — não há nível acima. Aqui há, e desperdiçá-lo
// achataria dezenas de playlists numa lista sem divisão.
//
// **MAS O CANAL NÃO VIRA SEÇÃO, e a razão é MEDIDA.** O `coletanea.js` registra
// a medição que dissolveu o "Celebra SP": com 5 coletâneas (10 blocos) a lista
// de abertura da Biblioteca ROLA, com 4 (9 blocos) não. O payload não declara
// quantos canais tem, e não há como perguntar — um canal novo do lado do
// LouvorJA acrescentaria uma seção à tela de abertura de todo aparelho, sem
// nada aqui que pudesse decidir se cabe. **Uma seção só**, com o canal como
// SUBTÍTULO do card, é a leitura que não deixa o número de blocos da Biblioteca
// nas mãos de um curador de outro projeto.
//
// ## O que este arquivo NÃO faz, de propósito
//
// - **Não filtra por `status`.** O endpoint já serve só `validated` (ver
//   `CollectionController@online`). Repetir o filtro aqui seria uma segunda
//   opinião sobre uma decisão que já foi tomada — e, se um dia o campo vier no
//   payload, um filtro nosso desatualizado apagaria o acervo em silêncio.
// - **Não decide idioma.** O `lang` é do caminho da URL, e quem o escolhe é
//   quem busca.
// - **Não ordena canal por relevância.** Não há campo para isso; inventar uma
//   é editorializar um acervo de terceiro.
//
// ## As cinco recusas, e por que cada uma tem NOME
//
// Falhar vazio é proibido neste projeto porque cada motivo pede uma AÇÃO
// diferente de quem lê o Registro: "o canal não publicou" e "o app recusou o
// que veio" chegam iguais numa lista curta demais. Os motivos são
// `MOTIVO_SEM_ID`, `MOTIVO_ID_INVALIDO`, `MOTIVO_ORFAO`, `MOTIVO_VAZIA` e
// `MOTIVO_REPETIDA` — cada um com o KDoc do que o operador (ou quem lê o
// diário dele) deve concluir. O registro SEM TÍTULO não está entre eles: ele
// ENTRA, com um rótulo derivado do id, e vira uma CONTAGEM (`diario.semNome`).
//
// Exposto como window.AVOnline.
// ============================================================================

(function (global) {
  'use strict';

  // O PREFIXO DO `coll.id`, e ele é contrato com o `controle.js` em DOIS
  // pontos, não um: é por ele que `ehColecaoDeVideo` sabe que a estimativa de
  // peso deste card sai da média de VÍDEO (um episódio de ~300 MB contra uma
  // faixa de ~5 MB — herdar a média do áudio erra por duas ordens de grandeza),
  // e é ele que nomeia a pasta no OPFS. **Não pode mudar depois de publicado:**
  // mudá-lo desliga os downloads já feitos dos cards que os mostram, e o
  // operador vê o acervo dele zerar sem nada na tela dizendo por quê.
  const PREFIXO_ID = 'online-';

  // O NOME DA SEÇÃO na Biblioteca. Ele fala com o OPERADOR, e por isso não é
  // "On-line" (a palavra que o LouvorJA usa no app dele): lá o vídeo toca
  // direto do YouTube e a palavra descreve o que acontece; AQUI o app BAIXA
  // pelo aparelho antes de projetar (a transmissão direta saiu na v1.7.7), e
  // "on-line" prometeria o oposto do que o toque faz. O que o operador precisa
  // saber é de onde o material vem e o que ele é.
  const NOME_COLETANEA = 'Vídeos do YouTube';

  // O IDIOMA padrão do catálogo. `pt` e `es` são os dois que o backend
  // segmenta; só o primeiro interessa aqui, e ele é parâmetro para que o
  // oráculo possa exercitar o outro sem editar o módulo.
  const LANG_PADRAO = 'pt';

  // ===== OS MOTIVOS DE RECUSA =====
  //
  // Cada um responde a uma pergunta DIFERENTE de quem lê o Registro, e é por
  // isso que são cinco e não um "inválido".

  /** Registro sem `playlist_id`/`video_id` nenhum — o banco mandou uma linha
   *  sem a chave que a identifica no YouTube. Não há o que tentar: nem abrir,
   *  nem baixar, nem procurar. É defeito da ORIGEM, e a ação é avisar o
   *  LouvorJA. */
  const MOTIVO_SEM_ID = 'sem-id';

  /** O id existe mas não tem a FORMA de um id do YouTube (veio HTML, uma URL
   *  inteira, um espaço no meio). Distinto do anterior de propósito: aqui
   *  alguém escreveu ALGUMA coisa, e saber o quê é o começo do conserto. */
  const MOTIVO_ID_INVALIDO = 'id-invalido';

  /** Vídeo cujo `playlist_id` não casa com playlist nenhuma do payload. É o
   *  caso que a regra de ouro governa: sem playlist que o reivindique, o vídeo
   *  NÃO TEM ÁLBUM — e adivinhar um pelo título é exatamente o que este arquivo
   *  se recusa a fazer. Acontece de verdade: o `CollectionController` devolve
   *  `playlist_id: null` quando a relação do Eloquent não resolve. */
  const MOTIVO_ORFAO = 'orfao';

  /** Playlist sem NENHUM vídeo aceito. Ela não vira card: um álbum que abre
   *  vazio é pior que álbum nenhum — o operador toca, não acontece nada, e não
   *  há como distinguir isso de uma falha do app. */
  const MOTIVO_VAZIA = 'vazia';

  /** `playlist_id` repetido no payload. A coluna é `UNIQUE` no banco, então
   *  isto é uma anomalia — e ela não pode passar calada: duas entradas com o
   *  mesmo id virariam dois cards com o MESMO `coll.id`, isto é, dois cards
   *  disputando a mesma pasta do OPFS e o mesmo índice. Fica a PRIMEIRA. */
  const MOTIVO_REPETIDA = 'repetida';

  // ===== AS FERRAMENTAS =====

  // Sem acento e em minúsculas. **Cópia deliberada** da mesma função em
  // `serie.js` e `coletanea.js` — módulo puro não importa módulo neste
  // projeto, e a divergência entre as cópias é o que o oráculo compara (ver o
  // bloco final do `coletanea.test.mjs`).
  function normalizar(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * ISTO TEM A FORMA DE UM ID DO YOUTUBE?
   *
   * **Deliberadamente FROUXA no comprimento e ESTRITA no alfabeto**, e a
   * assimetria é a decisão. Um id de vídeo tem 11 caracteres e um de playlist
   * 34 há muitos anos — mas os dois são opacos por contrato do YouTube, e
   * travar o comprimento é apostar que ele nunca muda. A regra do projeto para
   * esse tipo de aposta está escrita no `SERIES.md`: *errar para um nome feio é
   * recuperável; errar para um episódio ausente é o operador descobrindo no
   * sábado que o vídeo do culto não está lá.* Um id de 12 caracteres recusado
   * por esta função é um vídeo que some da Biblioteca sem erro em lugar nenhum.
   *
   * O ALFABETO, ao contrário, não é aposta: é o que o YouTube usa
   * (base64url) e é o que pode ir para dentro de uma URL sem escapar. Um valor
   * com `/`, `?`, `<` ou espaço não é um id que veio torto — é outra coisa
   * (uma URL inteira, um fragmento de HTML, uma mensagem de erro), e deixá-lo
   * passar produz um item que existe na lista e nunca baixa.
   *
   * O piso de 5 existe só para separar "não é id" de "é id": nada abaixo disso
   * identifica vídeo nenhum, e sem piso a string `"-"` seria aceita.
   */
  function ehIdValido(id) {
    return /^[A-Za-z0-9_-]{5,64}$/.test(String(id == null ? '' : id));
  }

  /** O id, limpo das pontas. Devolve `''` para o que não é utilizável — é o
   *  chamador que decide se isso é [MOTIVO_SEM_ID] ou [MOTIVO_ID_INVALIDO]. */
  function idLimpo(v) {
    return String(v == null ? '' : v).trim();
  }

  /**
   * A URL do vídeo, na forma que o resto do app já consome.
   *
   * `youtube.com/watch?v=<id>` e não `youtu.be/<id>`: é a forma que o
   * `ytFetch` do shell recebe em todo outro caminho (busca, share, série), e um
   * segundo formato aqui seria uma variação que só este arquivo produz — a
   * primeira coisa a quebrar no dia em que o extrator ficar exigente.
   */
  function urlDoVideo(videoId) {
    return 'https://www.youtube.com/watch?v=' + videoId;
  }

  /**
   * A MINIATURA DE UM VÍDEO — a URL remota, e **nunca o `data:` embutido**.
   *
   * O banco manda as duas formas na mesma passada (`OnlineVideos.php`):
   * `default_image` é uma URL do `i.ytimg.com` e `default_image_base64` é um
   * `data:` URI da MESMA imagem (o thumbnail `default`, 120×90), embutido.
   *
   * **O embutido é recusado por TAMANHO, e a conta é do índice inteiro.** Ele
   * sempre desenha, inclusive sem internet — a tentação é óbvia —, mas o que o
   * aparelho guarda aqui não é uma imagem, são CENTENAS: o catálogo lido vai
   * para o IndexedDB com uma entrada por vídeo do acervo. Um `data:` URI por
   * faixa multiplica o índice guardado por alguns kB cada, e o que ele compra é
   * uma ilustração.
   *
   * **E ela é ILUSTRAÇÃO, nunca dado** — é a mesma régua que a série já aplica
   * (`s.thumb = it.thumb`, uma URL remota): ela mora na gaveta de detalhe de um
   * item, onde responde *"é este mesmo?"*, e a gaveta continua inteira sem a
   * foto (nome, canal, ordem). Quem a desenha remove o `<img>` no `error`, que
   * é o que torna a ausência de rede invisível em vez de quebrada.
   *
   * **NÃO HÁ MINIATURA DE CARD**, e por isso não há uma segunda função aqui: o
   * quadrado à esquerda de um card da Biblioteca é a SETA desde a v5.244 (*"nas
   * raízes mais altas o ideal é a seta, pois ela representa que pode abrir mais
   * listagens"*), e um `default_image_base64` de playlist guardado para ninguém
   * desenhar seria peso morto no IndexedDB de todo aparelho.
   *
   * **E NÃO HÁ RECUO PARA O EMBUTIDO, porque ele é INALCANÇÁVEL** — conferido
   * na origem: `OnlineVideos.php` só escreve `default_image_base64` DENTRO de
   * `if (isset($data["snippet"]["thumbnails"]["default"]["url"]))`, que é
   * exatamente a condição que preenche o `default_image`. Um registro com o
   * embutido e sem a URL não existe. Escrever o recuo seria um ramo que nada
   * alcança, com um comentário afirmando um caso que a origem não produz — e o
   * preço dele não é a linha morta, é o próximo leitor protegendo o lugar
   * errado.
   */
  function miniaturaDoVideo(reg) {
    if (!reg) return '';
    return String(reg.default_image || '').trim();
  }

  /** O rótulo de um registro sem título. Nunca vazio: uma linha em branco na
   *  lista é indistinguível de um defeito de desenho. */
  function nomeDeReserva(id) {
    return 'Vídeo ' + String(id || '').slice(0, 11);
  }

  // ===== A LEITURA DO PAYLOAD =====

  /**
   * OS CANAIS, indexados por `channel_id`.
   *
   * Devolve um `Map` id → `{ id, nome, arroba }`. Canal sem id é descartado
   * aqui mesmo: ele não pode ser referenciado por playlist nenhuma, então
   * mantê-lo seria carregar uma entrada que nada alcança.
   *
   * **Canal ausente NÃO é recusa de playlist** — ver [lerPlaylists]. Ele é só
   * o subtítulo, e uma playlist sem subtítulo continua sendo um álbum inteiro.
   */
  function lerCanais(payload) {
    const canais = new Map();
    const lista = (payload && Array.isArray(payload.channels)) ? payload.channels : [];
    for (const c of lista) {
      const id = idLimpo(c && c.channel_id);
      if (!id || canais.has(id)) continue;
      canais.set(id, {
        id,
        nome: String((c && c.title) || '').trim(),
        // O `@handle` do canal. Guardado porque é a única forma ESTÁVEL de
        // chegar ao canal no YouTube (o `channel_id` funciona, mas o handle é
        // o que uma pessoa consegue conferir) — e porque é de graça: ele já
        // veio no payload.
        arroba: String((c && c.custom_url) || '').trim(),
      });
    }
    return canais;
  }

  /**
   * AS PLAYLISTS, indexadas por `playlist_id` — o esqueleto dos álbuns.
   *
   * Cada uma vira `{ id, playlistId, nome, canal, canalId, itens: [] }`,
   * com `itens` vazio: são os vídeos que o preenchem, em [distribuirVideos], e
   * é lá que a playlist que ficar vazia é descartada.
   *
   * **A ordem do `Map` é a do payload**, e é ela que [ordenarAlbuns] reordena
   * depois — nunca aqui: a ordem de inserção é o que dá estabilidade ao
   * desempate, e perdê-la faria dois álbuns de mesmo nome trocarem de lugar
   * entre duas aberturas.
   */
  function lerPlaylists(payload, canais, diario) {
    const playlists = new Map();
    const lista = (payload && Array.isArray(payload.playlists)) ? payload.playlists : [];
    for (const p of lista) {
      const id = idLimpo(p && p.playlist_id);
      if (!id) { diario.recusadas.push({ nome: String((p && p.title) || ''), motivo: MOTIVO_SEM_ID }); continue; }
      if (!ehIdValido(id)) { diario.recusadas.push({ nome: id, motivo: MOTIVO_ID_INVALIDO }); continue; }
      if (playlists.has(id)) { diario.recusadas.push({ nome: id, motivo: MOTIVO_REPETIDA }); continue; }
      const canalId = idLimpo(p && p.channel_id);
      const canal = canais.get(canalId) || null;
      const nome = String((p && p.title) || '').trim();
      if (!nome) diario.semNome.push(id);
      playlists.set(id, {
        // O `coll.id` do card. DERIVADO do `playlist_id` e de mais nada: ele
        // nomeia a pasta do OPFS, e um id derivado do NOME mudaria de valor no
        // dia em que o curador corrigisse um acento — desligando os downloads
        // já feitos do card que os mostra.
        id: PREFIXO_ID + id,
        playlistId: id,
        nome: nome || ('Playlist ' + id.slice(0, 12)),
        canal: canal ? canal.nome : '',
        canalId: canalId,
        itens: [],
      });
    }
    return playlists;
  }

  /**
   * OS VÍDEOS, distribuídos nas playlists que os reivindicam.
   *
   * É aqui que a REGRA DE OURO age: o vínculo é `video.playlist_id`, e um vídeo
   * que não case com playlist nenhuma é [MOTIVO_ORFAO] — nunca adotado por
   * semelhança de título.
   *
   * **A DUPLICATA DENTRO DA MESMA PLAYLIST é descartada em silêncio, e só ela.**
   * O banco tem `UNIQUE(id_online_video_playlist, video_id)`, então ela não
   * deveria existir; o mesmo vídeo em DUAS playlists, ao contrário, é legítimo
   * e comum (um louvor que está no álbum do ano e numa coletânea temática) —
   * ele entra nas duas, e os dois cards o baixam para as pastas deles, como
   * dois álbuns do acervo de áudio que compartilham uma faixa.
   */
  function distribuirVideos(payload, playlists, diario) {
    const lista = (payload && Array.isArray(payload.videos)) ? payload.videos : [];
    const vistos = new Map(); // playlistId → Set(videoId)
    for (const v of lista) {
      diario.total++;
      const id = idLimpo(v && v.video_id);
      const plId = idLimpo(v && v.playlist_id);
      if (!id) { diario.recusados.push({ nome: String((v && v.title) || ''), motivo: MOTIVO_SEM_ID }); continue; }
      if (!ehIdValido(id)) { diario.recusados.push({ nome: id, motivo: MOTIVO_ID_INVALIDO }); continue; }
      const alvo = playlists.get(plId);
      if (!alvo) {
        diario.recusados.push({ nome: String((v && v.title) || '') || id, motivo: MOTIVO_ORFAO });
        continue;
      }
      let doAlbum = vistos.get(plId);
      if (!doAlbum) { doAlbum = new Set(); vistos.set(plId, doAlbum); }
      if (doAlbum.has(id)) continue;
      doAlbum.add(id);
      const nome = String((v && v.title) || '').trim();
      if (!nome) diario.semNome.push(id);
      alvo.itens.push({
        // O id da FAIXA dentro da coleção. É o id do YouTube, como na série —
        // é ele que o `songRowKey` compõe com a coleção, e é ele que liga o
        // arquivo baixado à linha.
        id,
        videoId: id,
        url: urlDoVideo(id),
        nome: nome || nomeDeReserva(id),
        // A ORDEM DECLARADA PELO CURADOR. `sequence` é o campo que o LouvorJA
        // escreve ao ingerir a playlist, e é a única ordem que este acervo tem
        // — ver [ordenarVideos] para o que se faz quando ela falta.
        seq: Number(v && v.sequence),
        thumb: miniaturaDoVideo(v),
      });
    }
  }

  /**
   * A ORDEM DAS FAIXAS DENTRO DE UM ÁLBUM.
   *
   * Por `sequence`, que é a ordem em que o curador montou a playlist — e é a
   * ordem em que a congregação espera vê-la, porque é a do YouTube.
   *
   * **O QUE NÃO TEM `sequence` VAI PARA O FIM, e não para o começo.** Um
   * `Number(undefined)` é `NaN`, e toda comparação com `NaN` é falsa: um
   * comparador ingênuo (`a.seq - b.seq`) devolve `NaN` e deixa a ordem
   * ENTREGUE AO MOTOR — o `Array.prototype.sort` é estável desde a ES2019, mas
   * só para pares que o comparador diz serem iguais, e `NaN` não diz nada. O
   * que sai disso é uma lista que muda de ordem entre dois aparelhos com o
   * mesmo acervo, sem erro nenhum. Aqui o sem-ordem é empurrado para o fim
   * explicitamente e desempatado pelo NOME, que é determinístico.
   */
  function ordenarVideos(itens) {
    const posicao = (x) => (Number.isFinite(x.seq) ? x.seq : Number.MAX_SAFE_INTEGER);
    return itens.slice().sort((a, b) => {
      const d = posicao(a) - posicao(b);
      if (d) return d;
      return normalizar(a.nome).localeCompare(normalizar(b.nome));
    });
  }

  /**
   * A ORDEM DOS ÁLBUNS DENTRO DA SEÇÃO: canal, depois nome.
   *
   * **Por CANAL primeiro**, e é a única decisão editorial deste arquivo: o
   * payload não declara ordem nenhuma para playlists (não há coluna `order`,
   * ao contrário do pivô categoria↔álbum do acervo de áudio), então ela tem de
   * ser inventada — e a que agrupa o material do mesmo publicador é a que
   * responde à pergunta que o operador faz olhando a lista. Alfabética pura
   * intercalaria dois canais, e o subtítulo (o nome do canal) passaria a ser a
   * única coisa distinguindo linhas vizinhas.
   *
   * O álbum SEM canal vai para o fim pelo motivo de [ordenarVideos]: um grupo
   * sem nome no meio da lista não se explica.
   */
  function ordenarAlbuns(albuns) {
    return albuns.slice().sort((a, b) => {
      const ca = normalizar(a.canal), cb = normalizar(b.canal);
      if (ca !== cb) {
        if (!ca) return 1;
        if (!cb) return -1;
        return ca.localeCompare(cb);
      }
      return normalizar(a.nome).localeCompare(normalizar(b.nome));
    });
  }

  /**
   * O CORAÇÃO: o payload cru de `/{lang}/collections/online` vira a lista de
   * álbuns que a Biblioteca desenha, mais o DIÁRIO do que foi recusado.
   *
   * **O diário não é opcional e não é enfeite.** Este acervo é curado por
   * OUTRO projeto: o que se vê na Biblioteca é o que o LouvorJA publicou, e
   * quando faltar alguma coisa a primeira pergunta é *"o curador não publicou,
   * ou o app recusou?"*. Sem as contagens, as duas chegam como a mesma lista
   * curta. Ele guarda o VEREDITO desta função — nunca uma segunda opinião — e
   * é a mesma regra do diário das séries.
   *
   * Devolve sempre a mesma FORMA, inclusive diante de um payload que não é
   * objeto: `{ albuns: [], diario: {...} }`. Lançar aqui obrigaria todo
   * chamador a um `try` e, pior, faria um campo renomeado do lado do LouvorJA
   * derrubar a Biblioteca inteira em vez de esvaziar uma seção dela.
   */
  function lerCatalogo(payload) {
    const diario = {
      // O que o payload ANUNCIOU, antes de qualquer recusa. É a única
      // referência externa desta função, e é ela que torna visível a diferença
      // entre "veio pouco" e "recusamos muito".
      canaisNoPayload: (payload && Array.isArray(payload.channels)) ? payload.channels.length : 0,
      playlistsNoPayload: (payload && Array.isArray(payload.playlists)) ? payload.playlists.length : 0,
      videosNoPayload: (payload && Array.isArray(payload.videos)) ? payload.videos.length : 0,
      total: 0,
      canais: [],      // `{ id, nome, arroba }` — a PROCEDÊNCIA, para o Registro
      recusadas: [],   // playlists
      recusados: [],   // vídeos
      vazias: [],      // playlists sem nenhum vídeo aceito
      // IDS QUE VIERAM SEM TÍTULO. **Não é recusa** — eles entram, com um rótulo
      // derivado do id (uma linha em branco na lista é indistinguível de um
      // defeito de desenho). É uma CONTAGEM porque um acervo inteiro sem nome é
      // o sintoma de um payload lido pelo campo errado, e sem ela isso chega
      // como "funcionou".
      semNome: [],
      aceitos: 0,
      albuns: 0,
    };

    const canais = lerCanais(payload);
    // OS CANAIS VÃO PARA O DIÁRIO, e é aqui que o `arroba` deixa de ser um
    // campo sem consumidor: a primeira pergunta diante de uma curadoria que
    // parece errada é *"de QUEM é este material?"*, e o `@handle` é a única
    // forma que uma PESSOA consegue conferir (o `channel_id` funciona e não se
    // lê). O bloco do Registro os imprime; o catálogo guardado não os carrega.
    diario.canais = [...canais.values()].map((c) => ({ id: c.id, nome: c.nome, arroba: c.arroba }));
    const playlists = lerPlaylists(payload, canais, diario);
    distribuirVideos(payload, playlists, diario);

    const albuns = [];
    for (const pl of playlists.values()) {
      if (!pl.itens.length) {
        diario.vazias.push(pl.nome);
        diario.recusadas.push({ nome: pl.nome, motivo: MOTIVO_VAZIA });
        continue;
      }
      pl.itens = ordenarVideos(pl.itens);
      diario.aceitos += pl.itens.length;
      albuns.push(pl);
    }

    const ordenados = ordenarAlbuns(albuns);
    diario.albuns = ordenados.length;
    return { albuns: ordenados, diario };
  }

  /**
   * ESTE `coll.id` É DESTA COLETÂNEA?
   *
   * Pergunta de UM lugar só, porque a resposta governa três coisas espalhadas
   * pelo `controle.js` (a estimativa de peso em bytes de vídeo, o tipo do item
   * e o caminho do índice). `String(...)` e não `id.startsWith` direto: o
   * chamador nem sempre tem um id na mão.
   */
  function ehDestaColetanea(id) {
    return String(id == null ? '' : id).startsWith(PREFIXO_ID);
  }

  /**
   * A IMPRESSÃO DA REGRA — a assinatura que invalida um índice guardado.
   *
   * Ela existe pela armadilha que já mordeu as séries TRÊS vezes, e o KDoc do
   * `fetchSerieIndex` a descreve inteira: o índice guarda nomes JÁ FORMADOS e a
   * ordem JÁ decidida. Mudar a REGRA sem mudar a fonte deixa todo aparelho com
   * o índice velho de pé PARA SEMPRE, no IndexedDB, onde limpar o cache não
   * alcança — o payload não mudou, a contagem bate, e nada refaz a lista.
   *
   * **O número sobe A MÃO, no mesmo lote que mudar o que esta função produz**
   * — o que a faixa guarda, a ordem, o rótulo de reserva, a escolha de
   * miniatura. Derivá-lo do código (um hash do arquivo) invalidaria o índice de
   * toda a frota a cada ajuste de comentário.
   */
  const IMPRESSAO = 'online-1';

  // A SUPERFÍCIE É A QUE TEM CHAMADOR, e o resto fica de dentro: `lerCanais`,
  // `lerPlaylists`, `distribuirVideos`, `ordenarVideos` e `ordenarAlbuns` são
  // as etapas de `lerCatalogo`, e exportá-las seria convidar um chamador que
  // pula o DIÁRIO — que é metade desta regra. `normalizar` fica pela razão dos
  // irmãos: as três cópias (aqui, `serie.js`, `coletanea.js`) são comparadas
  // entre si, e a divergência é o que não pode passar.
  global.AVOnline = {
    PREFIXO_ID, NOME_COLETANEA, LANG_PADRAO, IMPRESSAO,
    MOTIVO_SEM_ID, MOTIVO_ID_INVALIDO, MOTIVO_ORFAO,
    MOTIVO_VAZIA, MOTIVO_REPETIDA,
    normalizar, ehIdValido, urlDoVideo, miniaturaDoVideo,
    lerCatalogo, ehDestaColetanea,
  };
})(this);
