// Camada de dados compartilhada entre os dois PWAs (Controle e Display).
// Mesmo domínio/origin => compartilham IndexedDB, OPFS e BroadcastChannel.
//
// Modelo:
//   - store "media": blobs importados (imagens/vídeos/áudios), itens de URL e
//     apresentações (kind 'deck': um array de Blobs, uma imagem por página).
//   - store "files": catálogo dos arquivos guardados no OPFS (só metadados +
//     thumbnail; os bytes ficam no Origin Private File System).
//   - listas (em "state"): "imports", "playlist", "avulsos", "favs" = arrays de
//     ids ("avulsos" é a prateleira invisível da mídia que está em cena sem
//     pertencer a lista nenhuma; "favs" é a marcação de um toque — ver LISTS).
//   - Atalhos (organização opcional dentro dos Favoritos): "folders" =
//     [{id,name}] e um array de ids por atalho em "folder_<id>". São detentores
//     de referência como as listas.
//   - um blob de "media" só é apagado quando NADA mais aponta para ele — nem
//     lista, nem Favorito, nem a CENA (`state.current.mediaId`), nem um cue que
//     o carregue em `data.ids` (o PACOTE; ver `lerDetentores`); registros de
//     "files" pertencem à sua pasta OPFS e não passam pelo gc.
//
// Exposto como window.AVDB.

(function (global) {
  'use strict';

  const DB_NAME = 'av-iasd';
  // 3: índice `youtubeId` em "media" (v5.87) — ver `mediaByYoutube`.
  //
  // SUBIR ISTO TEM UM PREÇO, e ele não é o upgrade: é a VOLTA. `open` com uma
  // versão MENOR do que a do banco lança VersionError, e a base web anterior é
  // exatamente para onde o watchdog do OTA volta quando um bundle não confirma
  // (e é o que o APK instalado embute até a Release seguinte). Um bundle que
  // sobe o DB_VERSION, é servido uma vez e depois é descartado deixa a base
  // antiga sem conseguir ABRIR o banco: um lançamento inteiro sem playlist,
  // sem Cronograma e sem biblioteca. O caso se cura sozinho (o `check()`
  // seguinte rebaixa o bundle de novo), mas o lançamento estragado é real.
  // Portanto: só suba junto com uma Release, e só quando o ganho não couber
  // numa chave de `state` — que é onde uma estrutura auxiliar deve morar.
  const DB_VERSION = 3;
  const STORE_MEDIA = 'media';
  const STORE_STATE = 'state';
  const STORE_FILES = 'files';
  const CHANNEL_NAME = 'av-iasd';
  // As listas FIXAS. NÃO é a lista completa de quem referencia um id de mídia —
  // os Favoritos moram em chaves dinâmicas (`folder_<id>`). Quem decide se um
  // blob pode ser apagado é `isReferenced`, não esta constante.
  //
  // "avulsos" (v5.87) é a única que o operador NÃO vê: é o detentor da mídia em
  // cena sem pertencer a lista nenhuma — "Tocar agora" num resultado do YouTube
  // não tem nada a ver com o Cronograma, mas um registro em NENHUMA lista é
  // vazamento permanente (o gc só alcança o que uma lista já segurou). Ela é
  // PEQUENA e de tamanho fixo (`AVULSO_MAX`, no Controle): quem entra empurra o
  // mais antigo para fora, e aí o gc decide.
  //
  // "favs" (v5.103) é a marcação de UM TOQUE: um id está favoritado ou não, sem
  // pertencer a grupo nenhum. Ela entra aqui — e não numa chave à parte — porque
  // é isto que a torna um DETENTOR DE REFERÊNCIA de verdade: `isReferenced`
  // varre esta constante, então favoritar passa a segurar o blob e desfavoritar
  // passa a poder coletá-lo, sem uma linha nova de gc. Os atalhos
  // (`folder_<id>`) existem ao lado dela como organização OPCIONAL — ver
  // `folderDrop`.
  const LISTS = ['imports', 'playlist', 'avulsos', 'favs'];

  let dbPromise = null;

  // A conexão é memorizada, mas a FALHA não: até a v5.48 `dbPromise` guardava
  // também a promise REJEITADA, então uma única falha do `indexedDB.open`
  // (pressão de armazenamento, renderer se recuperando de um OOM) deixava todo
  // o AVDB rejeitando para sempre — o app ficava sem dados até ser fechado e
  // reaberto, sem nenhum caminho de recuperação. Zerando `dbPromise` no
  // caminho de erro, a próxima chamada simplesmente tenta de novo.
  function openDB() {
    if (dbPromise) return dbPromise;
    const p = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        // O store pode já existir (upgrade 2 → 3): aí o objectStore vem da
        // transação do próprio upgrade, e não de um `createObjectStore` — que
        // lançaria ConstraintError e deixaria o app sem banco nenhum.
        const ms = db.objectStoreNames.contains(STORE_MEDIA)
          ? req.transaction.objectStore(STORE_MEDIA)
          : db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
        // Registros com `youtubeId: null` ficam FORA do índice (null não é
        // chave IDB válida), que é exatamente o que se quer: o índice só tem
        // os vídeos baixados do YouTube, e a busca por um id devolve ou o
        // registro dele ou nada.
        if (!ms.indexNames.contains('youtubeId')) ms.createIndex('youtubeId', 'youtubeId');
        if (!db.objectStoreNames.contains(STORE_STATE)) db.createObjectStore(STORE_STATE);
        if (!db.objectStoreNames.contains(STORE_FILES)) {
          const fs = db.createObjectStore(STORE_FILES, { keyPath: 'id' });
          fs.createIndex('folder', 'folder');
        }
      };
      // Só invalida o cache se ele ainda for ESTA promise: um `openDB`
      // posterior pode já ter posto outra no lugar, e zerá-la faria a próxima
      // chamada abrir uma terceira conexão à toa.
      const forget = () => { if (dbPromise === p) dbPromise = null; };
      req.onsuccess = () => {
        const db = req.result;
        // A OUTRA página (Controle × Display, mesmo origin) pediu um upgrade.
        // Sem fechar aqui, a conexão velha BLOQUEIA o upgrade dela e a outra
        // página fica esperando para sempre, com a tela montada e sem dado
        // nenhum — no meio de um culto. No app o caso não chega a acontecer
        // (o `beginSession` fixa um único bundle por sessão, logo um único
        // DB_VERSION); no navegador, com as duas páginas abertas, é o que
        // segura a subida de 2 para 3 da v5.87 — que é justamente o dia em que
        // ninguém lembraria disto.
        db.onversionchange = () => { db.close(); forget(); };
        // Conexão fechada por fora (o navegador pode forçar em falha de
        // armazenamento): o handle memorizado está morto, reabrir na próxima.
        db.onclose = forget;
        resolve(db);
      };
      const fail = (err) => { forget(); reject(err || new Error('IndexedDB indisponível')); };
      req.onerror = () => fail(req.error);
      // A ponta oposta do `onversionchange`: se ALGUÉM não fechar a conexão
      // velha, `onblocked` é o único aviso que existe. Sem ele o `open` não
      // resolve NEM rejeita, e quem chamou fica pendurado sem erro nenhum.
      req.onblocked = () => fail(new Error('IndexedDB bloqueado por outra conexão (upgrade pendente)'));
    });
    dbPromise = p;
    return p;
  }

  function store(name, mode) {
    return openDB().then((db) => db.transaction(name, mode).objectStore(name));
  }
  // Retorna [objectStore, transaction] para operações que precisam de atomicidade (get+put).
  function storeTx(name, mode) {
    return openDB().then((db) => {
      const tx = db.transaction(name, mode);
      return [tx.objectStore(name), tx];
    });
  }
  function asPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  // Resolve quando a transação inteira commita — usado nas operações
  // multi-passo (read-modify-write) que precisam confirmar a atomicidade.
  function txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('transação abortada'));
    });
  }
  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
  }
  // Constrói um registro de "media" a partir de campos padrão + overrides do
  // chamador (evita repetir a mesma estrutura em addMedia/addUrlMedia/temp).
  function makeMediaRecord(fields) {
    return Object.assign({
      id: uid(),
      blob: null,
      url: null,
      thumb: null,
      type: 'url/unknown',
      kind: 'other',
      name: 'sem-nome',
      youtubeId: null,
      // APRESENTAÇÃO: um array de Blobs, uma imagem por página (kind 'deck').
      // Dentro do PRÓPRIO registro, e não em arquivos soltos no OPFS, porque
      // assim o gc que já existe leva as páginas junto quando o item sai da
      // última lista — páginas no OPFS pediriam uma faxina paralela, que é
      // exatamente o tipo de bookkeeping duplicado que vaza espaço em silêncio.
      // O IndexedDB guarda Blob por REFERÊNCIA: ler o registro não traz os
      // bytes de dezenas de páginas para a memória.
      pages: null,
      // OS VÍDEOS QUE ESTAVAM DENTRO DA APRESENTAÇÃO: `{ página: id }`. Aqui
      // vai o ID e não o Blob, ao contrário do `pages`: um vídeo de dezenas de
      // MB é mídia de primeira classe (tem transporte, barra, cortina e
      // MediaSession), e enfiá-lo dentro do registro do deck o esconderia de
      // tudo isso. Quem segura os bytes é o coletor, que trata a apresentação
      // como DETENTORA deles — ver `lerDetentores`.
      videos: null,
      // CENA DE ROTEIRO (kind 'cue', v5.103): o item do Cronograma que não tem
      // bytes — um versículo, uma mensagem, a letra de um hino, o cronômetro de
      // abertura, um sorteio ou um pacote de mídias. `cue` é o subtipo e `data`
      // o DESCRITOR (a referência do que projetar), nunca o conteúdo: o texto do
      // versículo continua vindo do cache da Bíblia na hora de projetar, e o que
      // vai ao telão continua sendo o MESMO comando `text`/`chrono`/`draw` que o
      // Display já entende — nenhuma lógica de projeção nova, nem no shell nem
      // no Display (que sequer sabe que cues existem: um cue nunca vira `load`).
      cue: null,
      data: null,
      // ALTURA em pixels do vídeo, quando conhecida (v5.118). É o subtítulo da
      // linha do Cronograma — "Vídeo · 1080p" —, e ela existe como CAMPO porque
      // a única outra forma de saber a resolução de um blob é decodificá-lo, o
      // que significaria abrir um `<video>` por linha a cada render. Quem sabe
      // é quem gravou: o shell devolve a altura do que de fato baixou, e a
      // importação de arquivo a lê do mesmo `<video>` que já monta a miniatura.
      // `null` quando não se sabe — e aí o subtítulo diz só o tipo.
      height: null,
      // DURAÇÃO em segundos, pela mesma razão e com a mesma regra. Ela é o
      // detalhe do subtítulo de um ÁUDIO, que não tem resolução para mostrar.
      seconds: null,
      // O CANAL que publicou (v1.5.21), quando o item veio do YouTube. Mesma
      // regra dos dois acima: quem sabe é quem gravou, e não há como redescobrir
      // isso de um blob — nem de um link, que sem rede é só uma URL.
      //
      // NÃO exige `DB_VERSION` nova: o store não tem esquema por registro (o
      // mesmo argumento já escrito para `cue`), e ninguém indexa por ele. Um
      // registro antigo simplesmente não tem o campo, e quem o lê já trata a
      // ausência — que é o caso normal deste campo, não a exceção.
      canal: null,
      // TRANSMISSÃO DIRETA (v5.120): o manifesto das duas faixas adaptativas —
      // URLs servíveis pelo próprio origin e os byte-ranges do DASH. Uma mídia
      // com este campo não tem `blob` nem `url`: quem a toca é o `MediaSource`
      // (ver shared/mse.js), e o `stage.js` a trata como vídeo em tudo o mais.
      //
      // Ela é TRANSITÓRIA por natureza, e isso não é descuido: as URLs do
      // googlevideo expiram em algumas horas. Um registro de stream que
      // sobreviva à expiração falha ao tocar — e é o `onStreamErro` do Controle
      // que pede um manifesto novo e o regrava aqui.
      stream: null,
      createdAt: Date.now(),
    }, fields);
  }
  // Lê o array de ids de uma lista a partir de um objectStore de "state" já
  // aberto (para uso DENTRO de uma transação existente, sem abrir outra).
  // Cobre a migração "imports" ← "order".
  async function readListIn(stateStore, name) {
    let ids = await asPromise(stateStore.get(name));
    if (ids == null && name === 'imports') ids = await asPromise(stateStore.get('order'));
    return Array.isArray(ids) ? ids.slice() : [];
  }
  function kindFromType(type) {
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    return 'other';
  }

  // ---- state genérico ----
  async function setState(key, value) {
    const s = await store(STORE_STATE, 'readwrite');
    return asPromise(s.put(value, key));
  }
  async function getState(key) {
    const s = await store(STORE_STATE, 'readonly');
    return asPromise(s.get(key));
  }
  // LEITURA E ESCRITA DE UMA CHAVE DE `state` NUMA TRANSAÇÃO SÓ.
  //
  // O par `getState` + calcular + `setState` é um read-modify-write com DUAS
  // transações e um vão entre elas, e a regra deste projeto é que toda operação
  // IDB multi-passo que precise de atomicidade use uma transação única. O vão
  // não é teórico em nenhum dos consumidores:
  //
  //  - o DIÁRIO da varredura das séries grava em duas metades (canal, vídeos) e
  //    duas varreduras da mesma série correm juntas com facilidade — a abertura
  //    dispara `autoRefreshCollections()` sem `await` e "Atualizar a lista" é um
  //    toque por cima disso;
  //  - as INTENÇÕES de download são uma lista que ganha item no começo de cada
  //    download e perde item no `finally` de cada um.
  //
  // Nos dois casos quem leu primeiro grava por último e apaga o que o outro
  // acabou de escrever — sem erro, sem log, e com o sintoma aparecendo longe
  // dali (um bloco do Registro que some, um download que não é reclamado).
  //
  // Duas transações `readwrite` de mesmo escopo NÃO se intercalam no IDB, e é
  // isso que faz este `get` seguido de `put` ser seguro onde o par não era.
  //
  // E ELA CONFIRMA O COMMIT (`await txDone(tx)`), que é a SEGUNDA razão de
  // existir e vale sozinha. `setState` devolve a promise do REQUEST: ela
  // resolve quando o IDB aceita a escrita, com a transação ainda em voo. Quem
  // grava e em seguida MATA O DOCUMENTO — `aplicarAtualizacao` grava a intenção
  // e chama `otaApply()`, que recarrega as duas páginas — perde a transação
  // junto com a conexão, e o que se perde é exatamente a metade do lote que a
  // intenção existia para salvar. Escrita que precisa sobreviver ao próximo
  // instante vem por aqui.
  //
  // `fn` É SÍNCRONA, e não por gosto: uma transação do IDB fecha sozinha quando
  // um turno de microtarefas passa sem requisição pendente, então um `await`
  // aqui dentro perderia a atomicidade que a função existe para dar — e a
  // perderia em silêncio, que é o modo de falhar deste arquivo inteiro.
  async function updateState(key, fn) {
    const [s, tx] = await storeTx(STORE_STATE, 'readwrite');
    const novo = fn(await asPromise(s.get(key)));
    await asPromise(s.put(novo, key));
    await txDone(tx);
    return novo;
  }
  // Chaves de `state` que começam com `prefix`, numa transação só e sem
  // desserializar valor nenhum. Existe para testar PRESENÇA em massa: a Bíblia
  // precisa saber quais dos 1189 capítulos já estão em cache, e fazer isso com
  // 1189 `getState` significava 1189 transações lendo o capítulo inteiro (~30
  // versículos de texto) só para descartar o conteúdo.
  async function stateKeys(prefix) {
    const s = await store(STORE_STATE, 'readonly');
    // '￿' é maior que qualquer caractere possível no sufixo, então o
    // intervalo cobre exatamente as chaves que começam com o prefixo.
    const range = IDBKeyRange.bound(prefix, prefix + '￿', false, false);
    return asPromise(s.getAllKeys(range));
  }

  // ---- media ----
  // Insere o registro em "media" E o adiciona à lista numa ÚNICA transação
  // (media + state) — sem isso, uma falha entre o add e o listAdd deixaria um
  // registro órfão em "media" que o gc() nunca coleta (nunca esteve numa
  // lista) e que vaza espaço no IDB indefinidamente.
  async function addMediaToList(record, listName) {
    const db = await openDB();
    const tx = db.transaction([STORE_MEDIA, STORE_STATE], 'readwrite');
    await asPromise(tx.objectStore(STORE_MEDIA).add(record));
    const st = tx.objectStore(STORE_STATE);
    const ids = await readListIn(st, listName);
    if (!ids.includes(record.id)) { ids.push(record.id); await asPromise(st.put(ids, listName)); }
    await txDone(tx);
    return record;
  }
  // `meta.type`/`meta.kind` são opcionais e só existem porque nem toda origem
  // de bytes informa um MIME confiável: provedores de documentos do Android
  // (SAF/share por intent) costumam devolver `application/octet-stream`, que
  // classificaria a mídia como 'other' e a tornaria inutilizável. Quem tem
  // uma fonte melhor (a extensão do arquivo) passa aqui; o padrão continua
  // sendo o tipo do próprio blob.
  //
  // `meta.list` escolhe QUAL lista recebe o registro; o padrão continua sendo
  // "imports" (o Cronograma), que é onde toda importação sempre entrou. Ele
  // existe porque nem toda mídia baixada pertence ao Cronograma: "Tocar agora"
  // num vídeo do YouTube entra em "avulsos" e "Adicionar à playlist" entra
  // direto na playlist. Continua sendo UMA transação — a lista é escolhida,
  // não dispensada, justamente para o registro nunca nascer órfão.
  async function addMedia(blob, meta) {
    const type = (meta && meta.type) || blob.type;
    const record = makeMediaRecord({
      blob,
      type,
      kind: (meta && meta.kind) || kindFromType(type),
      thumb: (meta && meta.thumb) || null,
      name: (meta && meta.name) || 'sem-nome',
      youtubeId: (meta && meta.youtubeId) || null,
      height: (meta && meta.height) || null,
      seconds: (meta && meta.seconds) || null,
      canal: (meta && meta.canal) || null,
      stream: (meta && meta.stream) || null,
    });
    return addMediaToList(record, (meta && meta.list) || 'imports');
  }
  // Uma mídia de TRANSMISSÃO DIRETA: sem bytes no aparelho, sem URL única — o
  // que ela tem é o manifesto das faixas. Não passa por `addMedia`, que deriva
  // tipo e kind de um blob que aqui não existe.
  //
  // SEM CHAMADOR DESDE A v1.7.6, e isto está dito para não ser lido como
  // contrato vivo: a transmissão direta saiu do `controle.js` a pedido do
  // operador, e nada no app cria um registro de stream. Elas ficam porque o
  // banco continua LENDO registros gravados antes daquele lote (o `stage.js` os
  // reconhece pelo campo `stream`), e uma store que sabe ler e não sabe
  // escrever é mais fácil de entender inteira. Ver o cabeçalho de
  // `shared/mse.js`, que é o leitor.
  //
  // `kind: 'video'` de propósito, e não um kind novo: para todo o resto do app
  // isto É um vídeo — a cortina, o fade, o transporte, a barra de progresso e a
  // sessão de mídia não têm por que saber de onde vêm os bytes. Um kind próprio
  // obrigaria cada um desses lugares a aprender um caso a mais.
  async function addStreamMedia(stream, meta) {
    // SÓ ÁUDIO é um KIND, não um detalhe do manifesto: é o `kind` que faz o
    // telão manter o wallpaper em vez de trocar de imagem, que escolhe o
    // arquivo certo no reaproveitamento por forma (`mediaByYoutube`) e que diz
    // ao fallback qual download pedir se a transmissão morrer. Mesma regra do
    // `ytFetchAudio`, e pelo mesmo motivo — inclusive a MINIATURA, que aqui não
    // entra: um registro de áudio com thumb faria o telão trocar de imagem.
    const soAudio = !!(meta && meta.somenteAudio);
    const record = makeMediaRecord({
      stream,
      thumb: soAudio ? null : ((meta && meta.thumb) || null),
      type: soAudio ? 'audio/mp4' : 'video/mp4',
      kind: soAudio ? 'audio' : 'video',
      name: (meta && meta.name) || 'Vídeo',
      youtubeId: (meta && meta.youtubeId) || null,
      height: (meta && meta.height) || null,
      seconds: (meta && meta.seconds) || null,
    });
    return addMediaToList(record, (meta && meta.list) || 'avulsos');
  }

  // Regrava o manifesto de uma mídia de transmissão — o caminho de recuperação
  // quando as URLs expiram. Get + put na MESMA transação, como o `renameMedia`.
  async function setMediaStream(id, stream) {
    const [st, tx] = await storeTx(STORE_MEDIA, 'readwrite');
    const record = await asPromise(st.get(id));
    if (!record) return null;
    record.stream = stream || null;
    await asPromise(st.put(record));
    await txDone(tx);
    return record;
  }

  // Uma APRESENTAÇÃO: as páginas já rasterizadas (ver SlideDeck.kt, no shell).
  // Ela não tem `blob` nem `url` — a mídia É a lista de páginas —, e por isso
  // não passa por `addMedia`, que deriva tipo e kind de um blob que aqui não
  // existe.
  async function addDeck(pages, meta) {
    const record = makeMediaRecord({
      pages: Array.isArray(pages) ? pages : [],
      thumb: (meta && meta.thumb) || null,
      type: 'application/pdf',
      kind: 'deck',
      name: (meta && meta.name) || 'Apresentação',
      // OS VÍDEOS DA APRESENTAÇÃO: `{ página: id da mídia }`. Só um `.pptx` com
      // vídeo embutido o traz; um PDF e um `.pptx` sem vídeo continuam sem o
      // campo, e `deckVideoDaPagina` lê ausente como "não há" — um bundle
      // ANTERIOR a este que encontre o campo simplesmente o ignora, e o que ele
      // perde é a automação, nunca a apresentação.
      videos: (meta && meta.videos) || null,
    });
    return addMediaToList(record, (meta && meta.list) || 'imports');
  }
  // Uma CENA DE ROTEIRO (ver `cue` em makeMediaRecord). Entra numa lista pela
  // mesma transação de tudo o mais — um cue órfão seria tão invisível quanto um
  // blob órfão, e o gc o coleta pelas mesmas regras (ele é um registro de
  // "media" como outro qualquer, só que sem bytes).
  //
  // NÃO exige subir o DB_VERSION: nenhum índice novo, e o IndexedDB não tem
  // esquema por registro. Um bundle ANTERIOR a esta versão que encontre um cue
  // o trata como mídia sem blob/url — `stage.load` cai no `clear()` e o telão
  // fica no wallpaper, que é a degradação certa (nada quebra, nada projeta).
  async function addCue(cue, data, meta) {
    const record = makeMediaRecord({
      cue,
      data: data || {},
      kind: 'cue',
      type: 'cue/' + cue,
      name: (meta && meta.name) || 'Cena',
    });
    return addMediaToList(record, (meta && meta.list) || 'imports');
  }

  // O vídeo do YouTube que já está no aparelho, ou null. É o que impede o app
  // de baixar o MESMO vídeo de novo a cada destino escolhido (tocar, playlist,
  // Cronograma) — um download de dezenas de MB repetido por engano, em rede de
  // celular, no meio de um culto.
  //
  // `getAllKeys` no índice devolve só as chaves primárias: nenhum blob é
  // desserializado para responder a pergunta. Entre vários registros do mesmo
  // vídeo (o link importado como item de player e o arquivo baixado depois),
  // ganha o que tem BLOB — é ele que toca em segundo plano e não depende da
  // rede.
  // `kind` OPCIONAL (v5.112): o mesmo vídeo do YouTube pode existir aqui em
  // duas formas — o arquivo de vídeo e o de SÓ ÁUDIO —, e as duas carregam o
  // mesmo `youtubeId`. Sem o filtro, quem pediu o áudio podia receber o vídeo
  // que já estava baixado (e vice-versa), o que é justamente o contrário do que
  // o operador escolheu. Omitido, o comportamento é o de sempre: serve
  // qualquer forma, que é o que a marca de "já está aqui" na lista de
  // resultados quer saber.
  async function mediaByYoutube(youtubeId, kind) {
    if (!youtubeId) return null;
    const s = await store(STORE_MEDIA, 'readonly');
    const ids = await asPromise(s.index('youtubeId').getAllKeys(IDBKeyRange.only(youtubeId)));
    if (!ids || !ids.length) return null;
    let recs = (await Promise.all(ids.map((id) => getMedia(id)))).filter(Boolean);
    if (kind) recs = recs.filter((r) => r.kind === kind);
    return recs.find((r) => r.blob) || recs[0] || null;
  }
  // Item de URL externa (sem blob local); kind pode ser 'image','video','audio','youtube'.
  async function addUrlMedia(url, meta) {
    const record = makeMediaRecord({
      url,
      thumb: (meta && meta.thumb) || null,
      type: (meta && meta.type) || 'url/unknown',
      kind: (meta && meta.kind) || 'url',
      name: (meta && meta.name) || url,
      youtubeId: (meta && meta.youtubeId) || null,
      // OS TRÊS QUE O LINK TAMBÉM SABE (v1.5.21). Os slots já existiam em
      // `makeMediaRecord` e `addMedia` já os repassava; aqui eles eram DESCARTADOS
      // — um item de PLAYER nascia sem duração e sem canal mesmo quando quem o
      // criou tinha os dois na mão (a busca do YouTube devolve `seconds` e
      // `author`, e o índice da série guarda os mesmos).
      //
      // E é o link que MAIS precisa deles: um arquivo baixado pode ser medido
      // decodificando os bytes, um link não tem bytes — sem rede, o que o app
      // sabe sobre ele é exatamente o que foi gravado aqui.
      height: (meta && meta.height) || null,
      seconds: (meta && meta.seconds) || null,
      canal: (meta && meta.canal) || null,
    });
    return addMediaToList(record, (meta && meta.list) || 'imports');
  }
  // Busca em "media" e, se não achar, no catálogo OPFS "files" — assim um id
  // de arquivo sincronizado pode entrar em listas/pastas e tocar no Display
  // sem cópia temporária.
  async function getMedia(id) {
    const s = await store(STORE_MEDIA, 'readonly');
    const rec = await asPromise(s.get(id));
    if (rec) return rec;
    return fileGet(id);
  }
  // Um registro de mídia que não entre em LISTA nenhuma nasce sem detentor, e
  // é o `gcOrfaos` da abertura seguinte que o apaga. Quem precisar de um usa
  // `addMedia`/`addUrlMedia`, que gravam registro e lista na MESMA transação.
  async function renameMedia(id, name) {
    // get + put na mesma transação para garantir atomicidade (o await entre os
    // dois mantém a transação viva pois ambos são requests IDB encadeados).
    const [s, tx] = await storeTx(STORE_MEDIA, 'readwrite');
    const record = await asPromise(s.get(id));
    if (record) {
      record.name = name;
      await asPromise(s.put(record));
      return txDone(tx);
    }
    // Registro do catálogo OPFS: renomeia só o nome de exibição (o path fica).
    const [fs, ftx] = await storeTx(STORE_FILES, 'readwrite');
    const f = await asPromise(fs.get(id));
    if (!f) return;
    f.name = name;
    await asPromise(fs.put(f));
    return txDone(ftx);
  }

  // ===== O QUE O PACOTE DE TRANSFERÊNCIA PRECISA (v1.7.0) =====
  //
  // Três primitivas que nenhum caminho de culto usa e que o `controle.js` não
  // teria como escrever de fora: elas mexem nos stores DIRETO. Estão aqui, e
  // não lá, porque este arquivo é o único dono do esquema — a regra vale desde
  // o primeiro dia e é o que impede uma segunda opinião sobre o que é um
  // registro válido.

  /** Os ids de "media", sem trazer registro nenhum. É a lista do que o pacote
   *  vai percorrer, e ela precisa ser BARATA: o `getAll` traria a letra inteira
   *  e a miniatura de cada faixa do acervo só para contar. */
  async function mediaChaves() {
    const s = await store(STORE_MEDIA, 'readonly');
    return asPromise(s.getAllKeys());
  }

  /**
   * O RESUMO DO ACERVO — id e TAMANHO de cada registro, numa transação só.
   *
   * Ele existe porque a alternativa media o aparelho, não o acervo: a
   * exportação precisava do peso de cada item para montar o plano e fazia
   * `getMedia` por id — uma transação por registro, milhares delas em fila. O
   * cursor percorre a store INTEIRA de uma vez e devolve só dois campos por
   * item; o registro não é guardado, e é isso que separa isto de um `getAll`
   * (que materializaria a letra e a miniatura de tudo num array só, num
   * processo que hospeda dois WebViews e a `Presentation`).
   *
   * LER UM REGISTRO NÃO LÊ OS BYTES DO BLOB — o IndexedDB o guarda por
   * referência e o que volta é uma alça —, então o custo aqui é o do metadado,
   * e `blob.size` é exato sem tocar em disco.
   */
  async function mediaResumo() {
    const s = await store(STORE_MEDIA, 'readonly');
    return new Promise((resolve, reject) => {
      const out = [];
      const req = s.openCursor();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const c = req.result;
        if (!c) { resolve(out); return; }
        const r = c.value || {};
        let bytes = 0;
        if (r.blob) bytes += r.blob.size || 0;
        if (r.thumb) bytes += r.thumb.size || 0;
        if (Array.isArray(r.pages)) for (const pg of r.pages) if (pg) bytes += pg.size || 0;
        out.push({ id: c.key, bytes });
        c.continue();
      };
    });
  }

  /**
   * Grava um registro de "media" COMO ELE VEIO, preservando o `id`.
   *
   * É o oposto do `addMedia`, que CUNHA um id — e é por isso que ele existe: um
   * pacote importado precisa manter os ids, senão nenhuma lista (`imports`,
   * `playlist`, `favs`) do outro aparelho encontraria o que aponta.
   *
   * `add` e não `put`: ele FALHA quando o id já existe, e é essa falha que o
   * importador lê como "este item já está aqui". A alternativa — `put` — passaria
   * por cima do registro local em silêncio, e a promessa do recurso é que
   * importar só ACRESCENTA.
   */
  async function mediaAdd(record) {
    const s = await store(STORE_MEDIA, 'readwrite');
    return asPromise(s.add(record));
  }

  /**
   * TODOS os arquivos do OPFS, com caminho e tamanho — a varredura recursiva.
   *
   * O catálogo (`files`) NÃO responde isso, e a diferença não é teórica: o
   * download de uma coleção grava dois tipos de arquivo na mesma pasta — os
   * áudios, que viram registro no catálogo, e as IMAGENS DE FUNDO DA LETRA, que
   * não viram (elas são referenciadas de dentro dos slides). Um pacote montado
   * pelo catálogo chegaria ao outro aparelho com o hinário inteiro e as estrofes
   * sobre preto — o mesmo argumento que já obrigou o `opfsFolderSize` a somar o
   * DISCO em vez do catálogo.
   *
   * Um arquivo que suma no meio da varredura é PULADO, não fatal: o operador
   * pode estar sincronizando uma coleção enquanto exporta.
   */
  async function opfsTodosOsArquivos() {
    if (!opfsSupported()) return [];
    const out = [];
    async function andar(dir, prefixo) {
      for await (const [nome, handle] of dir.entries()) {
        const caminho = prefixo ? prefixo + '/' + nome : nome;
        if (handle.kind === 'directory') {
          try { await andar(handle, caminho); } catch (_) { /* pasta que sumiu */ }
          continue;
        }
        try {
          const f = await handle.getFile();
          out.push({ caminho, tamanho: f.size || 0, tipo: f.type || '' });
        } catch (_) { /* arquivo que sumiu no meio */ }
      }
    }
    try { await andar(await navigator.storage.getDirectory(), ''); } catch (_) { return out; }
    return out;
  }

  // ---- catálogo OPFS (store "files") ----
  async function fileAdd(record) {
    const s = await store(STORE_FILES, 'readwrite');
    return asPromise(s.put(record));
  }
  async function fileGet(id) {
    const s = await store(STORE_FILES, 'readonly');
    return asPromise(s.get(id));
  }
  async function fileDelete(id) {
    const s = await store(STORE_FILES, 'readwrite');
    return asPromise(s.delete(id));
  }
  async function filesByFolder(folder) {
    const s = await store(STORE_FILES, 'readonly');
    return asPromise(s.index('folder').getAll(folder));
  }
  async function filesAll() {
    const s = await store(STORE_FILES, 'readonly');
    return asPromise(s.getAll());
  }

  // ---- OPFS (Origin Private File System) ----
  // Os bytes dos arquivos sincronizados moram aqui; nunca pedem permissão e
  // são visíveis para os dois PWAs (mesmo origin). Paths no formato "a/b/c.mp4".
  function opfsSupported() {
    return !!(navigator.storage && navigator.storage.getDirectory);
  }
  function splitPath(path) {
    return String(path).split('/').filter(Boolean);
  }
  async function opfsDir(parts, create) {
    let dir = await navigator.storage.getDirectory();
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: !!create });
    return dir;
  }
  async function opfsGetFile(path) {
    const parts = splitPath(path);
    const name = parts.pop();
    const dir = await opfsDir(parts, false);
    const fh = await dir.getFileHandle(name);
    return fh.getFile();
  }
  async function opfsWriteFile(path, blob) {
    const parts = splitPath(path);
    const name = parts.pop();
    const dir = await opfsDir(parts, true);
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
  }
  async function opfsDeleteFile(path) {
    const parts = splitPath(path);
    const name = parts.pop();
    try {
      const dir = await opfsDir(parts, false);
      await dir.removeEntry(name);
    } catch (_) {}
  }
  /**
   * Quanto uma pasta OCUPA de verdade, em bytes — somando o que está NO DISCO.
   *
   * É a medida autoritativa, e existe porque a soma pelo catálogo (`files`) não
   * é: o download de uma coleção grava DOIS tipos de arquivo na mesma pasta —
   * os áudios, que viram registro no catálogo, e as imagens de fundo da letra,
   * que não viram (elas são referenciadas de dentro dos slides, não são mídia
   * da biblioteca). Somar o catálogo, portanto, ignorava as imagens: numa
   * coleção com centenas de hinos, centenas de MB invisíveis.
   *
   * E é BARATA, ao contrário da soma pelo catálogo: aqui só se pergunta o
   * tamanho de cada arquivo, sem desserializar registro nenhum — o `getAll` do
   * catálogo trazia thumbnail e letra inteira de cada faixa só para somar um
   * campo. Isso é o que permite reconferir o peso com frequência em vez de
   * confiar num acumulador que só cresce.
   */
  async function opfsFolderSize(path) {
    if (!opfsSupported()) return 0;
    let dir;
    try { dir = await opfsDir(splitPath(path), false); } catch (_) { return 0; }
    let total = 0;
    try {
      for await (const [, handle] of dir.entries()) {
        if (handle.kind !== 'file') continue;
        try { total += (await handle.getFile()).size || 0; } catch (_) { /* sumiu no meio */ }
      }
    } catch (_) { return total; }
    return total;
  }

  async function opfsDeleteDir(path) {
    const parts = splitPath(path);
    const name = parts.pop();
    try {
      const dir = await opfsDir(parts, false);
      await dir.removeEntry(name, { recursive: true });
    } catch (_) {}
  }

  // ---- listas ----
  async function listIds(name) {
    let ids = await getState(name);
    // Migração: "imports" herda o antigo "order".
    if (ids == null && name === 'imports') ids = await getState('order');
    return Array.isArray(ids) ? ids.slice() : [];
  }
  // Duas formas, e a diferença entre elas é ATOMICIDADE:
  //
  //   listSet(name, [ids])   grava o array como veio. O chamador leu a lista
  //                          ANTES, fora de transação, então é um
  //                          read-modify-write partido: um `listAdd` que
  //                          commite no meio é perdido, e o registro que o
  //                          `addMediaToList` criou fica órfão para sempre.
  //                          Hoje nenhum escritor de fundo mexe em listas (a
  //                          sincronização usa `fileAdd`), então é fragilidade
  //                          estrutural, não defeito em operação — mas o
  //                          primeiro escritor de fundo sobre `listAdd` a
  //                          transforma em perda de item.
  //
  //   listSet(name, fn)      forma ATÔMICA: `fn(listaAtual)` roda dentro da
  //                          MESMA transação que grava o resultado, igual ao
  //                          `listAdd`. `fn` precisa ser SÍNCRONA — um await
  //                          deixaria a transação autocommitar antes do `put`.
  //
  // Prefira a forma com função ao escrever código novo.
  //
  // ELE TAMBÉM COLETA (v5.131), e esta era a fonte de órfãos que faltava. Até
  // aqui o `listSet` gravava a lista nova e ia embora: todo id que SAÍSSE dela
  // virava um registro que nenhuma lista aponta e que nenhum gc alcança (ele só
  // rodava dentro de `listRemove`/`folderDrop`) — o mesmo defeito que o
  // `folderDrop` tinha até a v5.103.
  //
  // Não é hipotético: `listSet('playlist', [rec.id])` (tocar um item "só ele")
  // substitui a playlist INTEIRA, e cada item que ela tinha e que não estivesse
  // no Cronograma ou nos Favoritos ficava para trás. O sintoma que chegou do
  // aparelho: um resultado do YouTube marcado como "download pronto" — porque
  // `mediaByYoutube` acha o registro pelo índice — sem o item existir em seção
  // usável nenhuma, com o blob ocupando disco para sempre.
  //
  // A varredura é sobre o que SAIU, pela mesma `isReferenced` de todo o resto:
  // reordenar não apaga nada, e um id que saiu daqui mas está no Cronograma, num
  // Favorito ou no slot avulso continua inteiro.
  async function listSet(name, ids) {
    const db = await openDB();
    const tx = db.transaction([STORE_STATE, STORE_MEDIA], 'readwrite');
    const st = tx.objectStore(STORE_STATE);
    const antes = await readListIn(st, name);
    const bruto = typeof ids === 'function' ? ids(antes) : ids;
    const depois = Array.isArray(bruto) ? bruto.slice() : [];
    await asPromise(st.put(depois, name));
    const ms = tx.objectStore(STORE_MEDIA);
    // Detentores lidos UMA vez para o lote inteiro (ver lerDetentores) —
    // depois do put, então a própria lista nova já conta como detentora do
    // que ficou (irrelevante aqui porque `depois` é pulado pelo continue,
    // mas é o mesmo instante que o isReferenced por id enxergava).
    const donos = await lerDetentores(st, name);
    for (const id of antes) {
      if (depois.includes(id)) continue;
      if (!donos.has(id)) await asPromise(ms.delete(id));
    }
    return txDone(tx);
  }
  async function listItems(name) {
    const ids = await listIds(name);
    if (ids.length === 0) return [];
    // Busca todos os registros em paralelo (uma transação por get, mas sem sequencialização desnecessária).
    const records = await Promise.all(ids.map((id) => getMedia(id)));
    // Preserva a ordem da lista e descarta ids que não têm mais registro.
    return records.filter(Boolean);
  }
  async function listHas(name, id) {
    return (await listIds(name)).includes(id);
  }
  // Read-modify-write atômico: lê a lista, grava a versão modificada e só
  // então commita, tudo numa transação de "state" — evita o lost update de
  // duas escritas concorrentes (ex: share sendo processado + reordenação).
  async function listAdd(name, id) {
    const [s, tx] = await storeTx(STORE_STATE, 'readwrite');
    const ids = await readListIn(s, name);
    if (ids.includes(id)) return;
    ids.push(id);
    await asPromise(s.put(ids, name));
    await txDone(tx);
  }
  // TODOS os detentores de referência a um id de "media" — a pergunta que o gc
  // precisa acertar antes de destruir um blob.
  //
  // Até a v5.48 o gc só olhava LISTS, e os Favoritos ficaram de fora: o Controle
  // guarda cada atalho em `state['folder_<id>']` (índice em `state['folders']`),
  // que são listas de ids como qualquer outra, em chaves que o gc não conhecia.
  // O resultado era destrutivo e silencioso: importar um vídeo, pô-lo num
  // Favorito e excluí-lo do Cronograma apagava o BLOB — o Favorito continuava
  // com o id, `getMedia` devolvia undefined, o `filter(Boolean)` do Controle
  // descartava sem avisar, e o item sumia do atalho para sempre.
  //
  // Roda DENTRO da transação de quem chamou (recebe o objectStore de "state" já
  // aberto), porque a decisão de apagar precisa enxergar o mesmo instante da
  // remoção — ver o TOCTOU descrito em listRemove.
  //
  // NOTA: qualquer chave de `state` — ou campo de registro — que passe a guardar
  // ids de mídia precisa entrar AQUI. É o ponto único.
  //
  // Devolve um Set com TODOS os ids detidos, lendo cada lista UMA vez — a forma
  // que os laços multi-id (listSet, folderDrop, gcOrfaos) consomem. Reperguntar
  // por id, como era, relia todas as listas + `folders` + cada `folder_<id>` a
  // CADA mídia varrida: O(mídias × detentores) numa transação só, e o gcOrfaos
  // varre o banco inteiro. Ler uma vez vale o mesmo (a transação readwrite é
  // exclusiva) e vira passada linear.
  async function lerDetentores(stateStore, exceptList) {
    const donos = new Set();
    for (const l of LISTS) {
      if (l === exceptList) continue;
      for (const id of await readListIn(stateStore, l)) donos.add(id);
    }
    const folders = await asPromise(stateStore.get('folders'));
    if (Array.isArray(folders)) {
      for (const f of folders) {
        if (!f || f.id == null) continue;
        for (const id of await readListIn(stateStore, 'folder_' + f.id)) donos.add(id);
      }
    }
    // A CENA TAMBÉM É DETENTORA. `state.current.mediaId` é o `currentId` do
    // Controle, gravado por `persistCurrent` ANTES de o `load` sair — logo a
    // mídia projetada já está aqui quando qualquer coletor pergunta.
    //
    // Sem isto, um item com UM ÚNICO detentor (o vídeo baixado direto para a
    // playlist) era destruído ENQUANTO TOCAVA: o ✕ da linha → `listRemove` →
    // ninguém mais aponta → `delete(id)` na mesma transação. A projeção segue
    // (o telão já tem os bytes) e nada avisa; a queda do dongle ou um OTA faz o
    // `resendSceneToDisplay` pedir um `getMedia` que não existe mais.
    //
    // NÃO é lista, e é isso que faz a regra valer: `exceptList` nunca a exclui,
    // então sair da ÚLTIMA lista continua segurando o blob. O item fica órfão
    // ATÉ A CENA MUDAR — daí é órfão comum, e o `gcOrfaos` da abertura seguinte
    // o recolhe (`clearCurrentSelection` zera esta chave ANTES de `varrerRestos`).
    // `noAr` e não `mediaId` sozinho: a seleção SOBREVIVE ao fim da mídia (é o
    // que o ▶ repete), e prender por ela deixaria o último item tocado
    // indestrutível — excluí-lo tiraria a linha da tela e deixaria os bytes,
    // sem lugar visível onde removê-los. Quem escreve a bandeira é o
    // `persistCurrent` do Controle, e `pararMidia`/`resetAfterEnd` a derrubam.
    //
    // Bundle antigo (sem o campo) cai em `undefined` e a cena não conta — o
    // comportamento de antes deste conserto, que é o lado seguro de errar aqui:
    // apagar cedo demais custa um download, prender para sempre custa o espaço
    // do aparelho e não tem porta de saída.
    const cena = await asPromise(stateStore.get('current'));
    if (cena && cena.noAr && cena.mediaId) donos.add(cena.mediaId);
    // UM CUE TAMBÉM É DETENTOR — do que ele carrega em `data.ids`. O cue
    // `group` (o "Guardar pacote" da fila) guarda uma FILA inteira de ids que
    // podem não estar em lista nenhuma: sem descer neles, salvar a fila no
    // Cronograma e depois TROCAR a fila apaga as mídias e deixa o pacote de pé
    // apontando para bytes que não existem — `abrirPacote` só descobre em "as
    // mídias saíram do aparelho", no sábado. (O pacote do SORTEIO escapava
    // disto por acidente: os ids dele vivem no store `files`, que o coletor não
    // toca. O da fila aceita importados e downloads do YouTube, que vivem aqui.)
    //
    // Só desce nos cues que JÁ SÃO detidos — um pacote órfão não segura nada, e
    // morre com os ids dele na mesma passada. Uma passada só, sobre o instantâneo
    // de `donos`: um pacote não contém pacote (`guardarPacote` filtra cues), e se
    // um dia contiver, o de dentro apenas vaza — que é o lado seguro de errar
    // aqui. Testar `data.ids` e não o subtipo faz um cue novo com ids nascer
    // protegido em vez de nascer destrutivo.
    //
    // Lê do store "media" da MESMA transação: todo chamador tem de abri-la com
    // STORE_MEDIA no escopo (todos já abrem — é lá que a mídia é apagada).
    // E UMA APRESENTAÇÃO É DETENTORA DOS VÍDEOS DELA (v1.6.2), pela mesma
    // passada e pelo mesmo argumento. Os vídeos que saem de dentro de um
    // `.pptx` não entram em lista nenhuma de propósito — o operador pediu que
    // eles toquem SOZINHOS na página em que estavam, não que virem itens
    // soltos no Cronograma. Sem esta linha eles nasceriam órfãos e o
    // `gcOrfaos` da abertura seguinte os recolheria: a apresentação continuaria
    // na lista, as páginas continuariam desenhando, e o vídeo simplesmente não
    // tocaria mais — no sábado, sem erro em lugar nenhum.
    //
    // O percurso da morte é o MESMO dos ids de um `cue`, e vale dizê-lo porque
    // ele não é o intuitivo: `listRemove` coleta o id que saiu e só ele, então
    // tirar a apresentação da última lista a mata na hora e deixa os vídeos
    // ÓRFÃOS — quem os recolhe é o `gcOrfaos` da abertura seguinte. Ninguém
    // precisa lembrar de apagá-los, e nada fica para sempre.
    const midias = stateStore.transaction.objectStore(STORE_MEDIA);
    for (const id of Array.from(donos)) {
      const rec = await asPromise(midias.get(id));
      if (!rec) continue;
      if (rec.kind === 'cue' && rec.data && Array.isArray(rec.data.ids)) {
        for (const dep of rec.data.ids) donos.add(dep);
      }
      if (rec.kind === 'deck' && rec.videos) {
        for (const p in rec.videos) if (rec.videos[p]) donos.add(rec.videos[p]);
      }
    }
    return donos;
  }

  // A pergunta de UM id só (listRemove, gc): mesma varredura, mesmo ponto
  // único de detentores — só muda a forma da resposta.
  async function isReferenced(stateStore, id, exceptList) {
    return (await lerDetentores(stateStore, exceptList)).has(id);
  }
  // Remoção + gc na MESMA transação (state + media): sem isso, um listAdd
  // concorrente entre a remoção e a checagem do gc poderia re-referenciar o
  // id e o gc apagaria o blob mesmo assim (TOCTOU).
  async function listRemove(name, id) {
    const db = await openDB();
    const tx = db.transaction([STORE_STATE, STORE_MEDIA], 'readwrite');
    const st = tx.objectStore(STORE_STATE);
    const before = await readListIn(st, name);
    const after = before.filter((x) => x !== id);
    if (after.length === before.length) return; // não estava na lista
    await asPromise(st.put(after, name));
    // gc: o id ainda está referenciado em algum outro lugar (outra lista ou um
    // Favorito)? `name` é excluído da varredura porque acabou de sair dela.
    if (!(await isReferenced(st, id, name))) await asPromise(tx.objectStore(STORE_MEDIA).delete(id));
    await txDone(tx);
  }
  // Apaga um ATALHO inteiro (`folders` + `folder_<id>`), coletando o que ficar
  // sem dono. Numa transação só, e pela mesma `isReferenced` de todo o resto.
  //
  // ISTO ERA UM VAZAMENTO SILENCIOSO até a v5.103. O Controle apagava o atalho
  // com dois `setState` crus — tirava a entrada de `folders` e gravava a lista
  // vazia — e nada mais acontecia: uma mídia cujo ÚLTIMO detentor era aquele
  // atalho virava um registro que nenhuma lista apontava e que nenhum gc
  // alcançava (a faxina do `gcOrfaos` ainda não existia). O blob ficava no
  // IndexedDB para sempre, invisível na tela e sem caminho de limpeza — um
  // vídeo de centenas de MB "sumia" e continuava ocupando o disco do aparelho.
  //
  // A ordem importa: o atalho sai de `folders` ANTES da varredura, senão
  // `isReferenced` o encontraria no índice e ele seguraria os próprios ids.
  async function folderDrop(folderId) {
    const db = await openDB();
    const tx = db.transaction([STORE_STATE, STORE_MEDIA], 'readwrite');
    const st = tx.objectStore(STORE_STATE);
    const key = 'folder_' + folderId;
    const ids = await readListIn(st, key);
    const folders = await asPromise(st.get('folders'));
    const restantes = Array.isArray(folders) ? folders.filter((f) => f && f.id !== folderId) : [];
    await asPromise(st.put(restantes, 'folders'));
    await asPromise(st.delete(key));
    const ms = tx.objectStore(STORE_MEDIA);
    // A leitura dos detentores vem DEPOIS do put/delete acima, preservando a
    // ordem que o comentário do cabeçalho exige: o atalho já saiu de
    // `folders`, então lerDetentores não o encontra no índice e ele não
    // segura os próprios ids. Uma vez para o lote inteiro (ver lerDetentores).
    const donos = await lerDetentores(st, null);
    for (const id of ids) {
      if (!donos.has(id)) await asPromise(ms.delete(id));
    }
    await txDone(tx);
  }

  /**
   * A FAXINA DO QUE JÁ FICOU PARA TRÁS (v5.131) — os restos que os buracos
   * anteriores do gc criaram e que nenhum caminho normal alcança.
   *
   * Consertar o `listSet` impede órfãos NOVOS; não desfaz os que já estão no
   * aparelho. E eles não são invisíveis: um vídeo do YouTube baixado no
   * domingo passado, sem lista nenhuma hoje, continua aparecendo na busca como
   * "download pronto" (o `mediaByYoutube` o acha pelo índice) e continua
   * ocupando centenas de MB.
   *
   * Só apaga o que NENHUM detentor aponta, pela mesma `isReferenced` de todo o
   * resto — listas fixas e Favoritos, incluindo o slot `avulsos`, que é quem
   * segura a mídia em cena sem lista. Não há janela de corrida: `addMediaToList`
   * grava o registro e a lista na MESMA transação, então um registro recém-nascido
   * nunca está listless nem por um instante.
   *
   * Tudo numa transação só: uma varredura em duas etapas poderia apagar algo que
   * entrou numa lista no meio dela.
   *
   * Devolve quantos apagou, para o Registro poder dizer o que fez.
   */
  async function gcOrfaos() {
    const db = await openDB();
    const tx = db.transaction([STORE_STATE, STORE_MEDIA], 'readwrite');
    const st = tx.objectStore(STORE_STATE);
    const ms = tx.objectStore(STORE_MEDIA);
    const ids = await asPromise(ms.getAllKeys());
    // Os detentores são lidos UMA vez e a varredura corre contra o Set (ver
    // lerDetentores): reperguntar por id relia todas as listas para CADA
    // mídia do banco — quadrático justamente na função que varre tudo. Mesma
    // transação, mesma semântica: nada escreve nas listas no meio.
    const donos = await lerDetentores(st, null);
    let apagados = 0;
    for (const id of (ids || [])) {
      if (donos.has(id)) continue;
      await asPromise(ms.delete(id));
      apagados++;
    }
    await txDone(tx);
    return apagados;
  }

  // Apaga o blob se não estiver referenciado por lista nem por Favorito.
  // TEM UM chamador: a troca de link→arquivo no Cronograma (controle.js, ver
  // `gc(` por lá) — a remoção normal (listRemove) coleta na própria transação
  // e não passa por aqui. Usa a MESMA `isReferenced` de propósito, para que um
  // detentor novo não precise ser lembrado em dois lugares (foi essa
  // duplicação que deixou os Favoritos de fora do gc).
  async function gc(id) {
    const db = await openDB();
    const tx = db.transaction([STORE_STATE, STORE_MEDIA], 'readwrite');
    const st = tx.objectStore(STORE_STATE);
    if (await isReferenced(st, id, null)) return; // referenciado — não apaga
    await asPromise(tx.objectStore(STORE_MEDIA).delete(id));
    await txDone(tx);
  }

  // ---- canal de comandos ----
  // No navegador: só BroadcastChannel, como sempre.
  //
  // No app nativo: os dois WebViews (Controle e Display) são same-origin no
  // mesmo processo, então BroadcastChannel *deve* funcionar — mas o
  // isolamento de sites do WebView pode surpreender, e uma falha aí derrubaria
  // o comando do telão no meio de um culto. Em vez de detectar (handshake com
  // janela de corrida), o relay nativo (window.__AVBus, ver shared/native.js)
  // roda SEMPRE em paralelo: cada comando sai pelos dois caminhos e a cópia
  // repetida é descartada aqui pelo `__mid`. O resto do sistema não sabe de
  // nada — sendCommand/onCommand mantêm exatamente a mesma assinatura.
  const channel = 'BroadcastChannel' in global ? new BroadcastChannel(CHANNEL_NAME) : null;
  const bus = global.__AVBus || null;

  // Identidade de mensagem: origem única desta página + contador. Só é usada
  // quando há relay (no navegador nenhum campo extra é adicionado).
  const MID_PREFIX = Math.random().toString(36).slice(2, 8);
  let midSeq = 0;

  // Janela de deduplicação: os ids vistos recentemente. O comando mais
  // frequente (display-status) sai a ~4 Hz com mídia local (o emissor é o
  // `timeupdate` do <video>) e a 2 Hz com YouTube (polling de 500 ms do
  // ytStartTimeLoop) — mesmo no pior caso, algumas centenas de ids cobrem com
  // folga qualquer diferença de latência entre os dois caminhos.
  const seenMids = new Set();
  const MID_LIMIT = 400;

  function alreadySeen(mid) {
    if (!mid) return false;
    if (seenMids.has(mid)) return true;
    seenMids.add(mid);
    if (seenMids.size > MID_LIMIT) {
      // Set preserva ordem de inserção: descarta os mais antigos.
      const drop = seenMids.size - MID_LIMIT;
      let i = 0;
      for (const old of seenMids) {
        if (i++ >= drop) break;
        seenMids.delete(old);
      }
    }
    return false;
  }

  function sendCommand(command) {
    let msg = command;
    if (bus) {
      // Marca a mensagem para o outro lado poder deduplicar as duas cópias —
      // numa CÓPIA, nunca no objeto do chamador: escrever `__mid` no argumento
      // vazava um campo interno do canal para quem reutiliza o objeto (um
      // reenvio ganharia o MESMO mid e seria descartado como duplicata). As
      // duas vias levam a mesma cópia, senão a deduplicação não casa.
      msg = Object.assign({}, command, { __mid: MID_PREFIX + ':' + (++midSeq) });
      bus.post(msg);
    }
    if (channel) channel.postMessage(msg);
  }

  // Uma ÚNICA assinatura dos dois caminhos, com a lista de handlers por cima.
  //
  // O motivo é o `alreadySeen`, que TESTA E MARCA na mesma chamada: até a
  // v5.48 cada `onCommand` criava seu próprio `deliver`, e todos
  // compartilhavam o mesmo conjunto de mids. Com dois listeners na mesma
  // página, o `deliver` do primeiro marcava o mid e o do segundo via a
  // mensagem como repetida — o segundo listener NUNCA receberia nada. E só no
  // app nativo: no navegador não há `bus`, não há `__mid`, e os dois
  // funcionariam. Um recurso testado no navegador que para de funcionar no
  // aparelho é o pior modo de falhar deste projeto.
  //
  // Hoje há exatamente um `onCommand` por página (controle.js e display.js),
  // então a armadilha estava latente — e é justamente por isso que ela seria
  // descoberta tarde, por quem só quisesse observar `display-status` num
  // módulo novo.
  const cmdHandlers = [];
  let cmdSubscribed = false;

  function deliverCommand(msg) {
    if (!msg) return;
    // Deduplica UMA vez por MENSAGEM (as duas cópias do relay), não uma vez
    // por listener.
    if (bus && alreadySeen(msg.__mid)) return;
    // Cópia da lista: um handler que registre outro durante a entrega não
    // altera a rodada em curso.
    for (const fn of cmdHandlers.slice()) {
      // Um handler que lança não pode calar os demais — no telão isso
      // significaria perder o comando seguinte no meio de um culto.
      try { fn(msg); } catch (e) { console.error('[AVDB] handler de comando falhou', e); }
    }
  }

  function onCommand(handler) {
    cmdHandlers.push(handler);
    if (cmdSubscribed) return;
    cmdSubscribed = true;
    if (channel) channel.addEventListener('message', (e) => deliverCommand(e.data));
    if (bus) bus.recv(deliverCommand);
  }

  // `openDB` saiu da superfície pública na v5.48: não tinha chamador fora
  // daqui, e expor a conexão crua convida a montar transações por fora dos
  // helpers — que é exatamente onde mora a atomicidade deste arquivo.
  global.AVDB = {
    setState, getState, updateState, stateKeys,
    addMedia, addUrlMedia, addStreamMedia, setMediaStream, addDeck, addCue,
    getMedia, mediaByYoutube, renameMedia,
    listIds, listSet, listItems, listHas, listAdd, listRemove, gc, gcOrfaos, folderDrop,
    fileAdd, fileGet, fileDelete, filesByFolder, filesAll,
    opfsSupported, opfsGetFile, opfsWriteFile, opfsDeleteFile, opfsDeleteDir, opfsFolderSize,
    mediaChaves,
    mediaResumo, mediaAdd, opfsTodosOsArquivos,
    kindFromType, sendCommand, onCommand,
  };
})(this);
