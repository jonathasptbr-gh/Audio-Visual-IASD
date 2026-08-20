<!-- Capítulo de docs/ARQUITETURA-WEB.md. O índice e as regras
     de desenvolvimento ficam lá; este arquivo é só este capítulo. -->

## Modelo de dados (`shared/db.js`)

### IndexedDB — banco `av-iasd` v3

| Object Store | Chave | Conteúdo |
|---|---|---|
| `media` | `id` (UUID), índice `youtubeId` | `{ id, blob, url, thumb, type, kind, name, youtubeId, pages, cue, data, createdAt }` |
| `files` | `id` (UUID), índice `folder` | catálogo OPFS: `{ id, folder, opfsPath, srcName, name, type, kind, size, mtime, thumb, addedAt }` |
| `state` | chave string | valor arbitrário (listas, estado atual, pastas dos Favoritos, transições…) |

Um registro de mídia tem **`blob`, `url`, `opfsPath` OU `pages`** (nunca mais
de um): blobs locais importados, itens de URL externa (link direto, YouTube),
arquivos sincronizados no OPFS ou as páginas de uma apresentação. `thumb` pode
ser um `Blob` (miniatura gerada via Canvas) ou uma **string URL** (ex:
thumbnail `hqdefault.jpg` do YouTube).

**E há um quinto caso, que não tem bytes nenhum: `kind: 'cue'`** — a cena de
roteiro (v5.103). Ver "Cenas de roteiro", logo abaixo do modelo de listas.

**A conexão é memorizada; a FALHA não.** `openDB()` guarda a promise da
conexão, mas zera esse cache no caminho de erro. Até a v5.47 a promise
**rejeitada** também ficava memorizada: uma única falha do `indexedDB.open`
(pressão de armazenamento, renderer se recuperando de um OOM) deixava o `AVDB`
inteiro rejeitando para sempre, e o app ficava sem dados até ser fechado e
reaberto — sem nenhum caminho de recuperação. Zerando o cache, a chamada
seguinte simplesmente tenta de novo. O `forget()` confere se o cache ainda é
*esta* promise antes de anulá-lo, senão um `openDB` posterior abriria uma
terceira conexão à toa.

**Os três eventos de ciclo de vida que faltavam**, e todos os três se resumem
a "não deixar o chamador pendurado":

- `db.onversionchange` — a **outra página** (Controle × Display, mesmo origin)
  pediu um upgrade. Sem fechar a conexão daqui, ela bloqueia o upgrade de lá e
  aquela página fica esperando para sempre, com a tela montada e sem dado
  nenhum. Hoje o caso não chega a acontecer no app (o `beginSession` do shell
  fixa um único bundle por sessão, logo um único `DB_VERSION`) — mas o dia em
  que `DB_VERSION` subir de 2 para 3 é exatamente o dia em que ninguém vai
  lembrar disto.
- `req.onblocked` — a ponta oposta: se ALGUÉM não fechar a conexão velha, este
  é o único aviso que existe. Sem ele o `open` não resolve **nem** rejeita.
- `db.onclose` — o navegador pode fechar a conexão por fora numa falha de
  armazenamento; o handle memorizado está morto e precisa ser reaberto.

> **Atenção:** qualquer código que abra o banco fora de `db.js` deve usar
> `indexedDB.open('av-iasd')` **sem número de versão**, para não quebrar com
> `VersionError` quando o schema for atualizado — e precisa de um
> `onupgradeneeded` que crie ao menos o store `state`, senão numa instalação
> nova o banco nasceria sem nenhum object store e o `transaction('state')`
> lançaria `NotFoundError`. Hoje **não há** nenhum abridor externo (o service
> worker que gravava o share sumiu junto com os andaimes de PWA — ver
> "Compartilhamento"); a regra fica registrada porque o `if (!contains(...))`
> do upgrade 1→2 existe por causa dela.

### OPFS + catálogo (`files`)

Os **bytes** dos arquivos de pastas sincronizadas moram no **OPFS**
(`navigator.storage.getDirectory()`), em `folders/<folderId>/<arquivo>`. O
store `files` do IDB guarda apenas **metadados + thumbnail** — por isso listar
e buscar centenas de arquivos é instantâneo (nunca toca o disco); o arquivo só
é aberto na hora de reproduzir (`opfsGetFile` → `URL.createObjectURL`).

- OPFS pertence ao origin: **nenhuma permissão é pedida** para ler — nem no
  Controle, nem no Display (mesmo origin ⇒ mesmo OPFS).
- `getMedia(id)` procura em `media` e cai para `files` — assim IDs do catálogo
  entram em `playlist`/`imports`/pastas dos Favoritos **sem copiar bytes**.
- O `gc()` das listas só apaga do store `media`; registros de `files`
  pertencem à sua pasta OPFS e só são removidos pela exclusão na pasta.
- `renameMedia` cobre os dois stores (no catálogo, renomeia só a exibição;
  o `opfsPath` não muda).

**QUATRO listas nomeadas** (arrays de IDs guardados em `state`): `imports`,
`playlist`, `avulsos` e `favs`. Migração: `imports` herda o antigo state `order`
se `imports` ainda não existir. (A chave ANTIGA `favorites` é outra coisa e
continua morta — ver o legado nas chaves de `state`.)

**`avulsos` (v5.87) é a única que o operador não vê.** Ela existe porque
"Tocar agora" num resultado do YouTube não tem nada a ver com o Cronograma —
o vídeo só precisa ir ao telão —, mas um registro em lista NENHUMA é
vazamento permanente: o gc só alcança o que alguma lista já segurou (ver a
nota das funções removidas na v5.48). `avulsos` é o detentor dessa mídia, e é uma
prateleira PEQUENA e de tamanho fixo (`AVULSO_MAX` = 3, no Controle): quem
entra empurra o mais ANTIGO para fora, e aí o `listRemove` decide sozinho — o
blob some se ninguém mais o quiser e fica inteiro se o Cronograma, a playlist
ou um Favorito também o tiverem.

O tamanho é a escolha entre dois extremos ruins. Com **um** lugar, voltar ao
vídeo anterior baixa tudo de novo — exatamente o desperdício que a v5.87
existe para acabar. **Sem limite**, a mídia que a tela não mostra vira uma
pilha de centenas de MB que o operador não tem como apagar (não existe tela de
liberar espaço; o rodapé de uso é só informativo). Três cobre o uso real —
alternar entre dois ou três vídeos num mesmo culto. O que ele quiser guardar,
guarda pelas outras duas opções da mesma folha.

##### Uma prateleira invisível que segurava o que já tinha sido excluído (v5.118)

Sintoma relatado do aparelho: um vídeo já removido de TODAS as telas continuava
marcado como "já está aqui" (✓) na lista de resultados do YouTube — e não havia
onde removê-lo.

A causa é o encontro de duas peças que estavam certas separadamente.
`deleteSelected` chama `listRemove(activeTab, id)` — só da aba ATIVA, o que é o
comportamento correto (excluir do Cronograma não pode tirar da playlist). E
`avulsos` conta para o `isReferenced`, o que também é correto — é o que impede o
gc de apagar a mídia projetada. Juntas: quem tocasse "Tocar agora" e depois
adicionasse o mesmo vídeo ao Cronograma ficava com DOIS detentores, e excluir
pelo Cronograma deixava a prateleira segurando o registro. O blob permanecia no
aparelho, invisível em toda tela, e o ✓ da busca — que pergunta `mediaByYoutube`,
isto é, "existe blob?" — continuava aceso, com razão e sem saída.

A regra que faltava: **excluir é uma declaração de intenção, e ela vale para os
detentores que o operador não pode enxergar.** A prateleira é cache, não
biblioteca. `soltarAvulso(id)` roda junto de toda exclusão explícita.

Com **uma** exceção, e ela é o motivo de a função existir em vez de a linha ser
escrita inline: o que está em CENA agora. Ali a prateleira faz exatamente o
trabalho para o qual foi criada, e soltá-la apagaria o blob de baixo de uma
projeção em andamento — o vídeo seguiria tocando (o Display já tem os bytes),
mas uma queda do dongle o traria de volta e o `getMedia` não acharia nada.
Quando essa mídia sair de cena, o rodízio de `fixarAvulso` a solta sozinho.

`soltarAvulso` nunca apaga nada por conta própria: ela chama `listRemove`, que
decide na mesma transação — se o Cronograma, a playlist ou um Favorito ainda
tiverem o id, o blob fica inteiro. Ela só deixa de esconder um detentor.

> **A auditoria que veio junto**, porque a pergunta era "o que mais pode ficar
> órfão?": todo caminho que cria registro passa por `addMedia`/`addUrlMedia`/
> `addDeck`/`addCue`, e os quatro exigem uma lista. As chaves de fato usadas são
> `imports`, `playlist`, `avulsos`, `favs` (as quatro de `LISTS`) e `folder_<id>`
> (que o `isReferenced` alcança pelo índice `folders`). Nenhuma outra. O único
> `listRemove('folders', …)` que aparece no fonte está DENTRO de um comentário,
> descrevendo o bug que a v5.103 corrigiu.

**Subir o `DB_VERSION` tem um preço, e ele não é o upgrade — é a VOLTA.**
`open` com uma versão MENOR do que a do banco lança `VersionError`, e a base
web ANTERIOR é exatamente para onde o watchdog do OTA volta quando um bundle
não confirma (e é a que o APK instalado embute até a Release seguinte). Um
bundle que sobe o `DB_VERSION`, é servido uma vez e depois é descartado deixa a
base antiga sem conseguir ABRIR o banco: um lançamento inteiro sem playlist,
sem Cronograma e sem biblioteca. O caso se cura sozinho — o `check()` seguinte
rebaixa o bundle de novo —, mas o lançamento estragado é real, e num domingo
ele é o culto. Por isso a regra: só subir junto com uma Release, e só quando o
ganho não couber numa chave de `state`, que é onde uma estrutura auxiliar deve
morar.

**O índice `youtubeId` (v5.87)** responde "este vídeo já está no aparelho?"
sem desserializar blob nenhum (`getAllKeys` no índice). Registros com
`youtubeId: null` ficam de fora dele — `null` não é chave IDB válida —, então
o índice contém exatamente os vídeos vindos do YouTube. É ele que faz o
`ytArquivo` do Controle reaproveitar o arquivo em vez de baixar o mesmo vídeo
uma vez por destino escolhido.

O campo `kind` é derivado do `type` (ou definido pelo chamador para itens de URL):

| Origem | `kind` |
|---|---|
| `type` começa com `image/` | `'image'` |
| `type` começa com `video/` | `'video'` |
| `type` começa com `audio/` | `'audio'` |
| link do YouTube | `'youtube'` |
| URL sem extensão reconhecida | `'url'` |
| outro | `'other'` |

### Chaves de `state` em uso

| Chave | Conteúdo |
|---|---|
| `imports` / `playlist` | arrays de IDs de mídia |
| `current` | `{ mediaId, view, muted, volume, at }` — estado de exibição atual. O `mediaId` é **limpo na abertura** (`clearCurrentSelection`): sessão nova começa com o player vazio; volume/mudo/cortina ficam, que são o ajuste da mesa e não uma seleção |
| `repeat` | `'off'` \| `'all'` \| `'one'` \| `'shuffle'` |
| `fade` | legado — as transições visuais (fade in/out) viraram **inerentes ao sistema** (`createStage.FADE`, fixo em `{in:true, out:true, time:0.6}` e compartilhado pelos dois apps, não configurável); esta chave **não é mais lida nem gravada** (fica ignorada se existir de versões antigas). Fade em toda troca visual: mídia, cortina do wallpaper (view toggle), letra e texto bíblico |
| `fit` | `'contain'` \| `'cover'` \| `'fill'` — preenchimento da mídia (ajustar/preencher/esticar) no Display e na preview |
| `lyricsBg` | `'black'` (padrão) \| `'image'` — fundo atrás da letra sincronizada: preto ou as imagens dos slides |
| `wallpaper` | `Blob` da imagem escolhida para a cortina do telão, ou ausente/`null` = gradiente padrão (ver "Wallpaper personalizado") |
| `favs` | array de IDs — **os FAVORITOS** (v5.103): a marcação de um toque, sem grupo nenhum. É uma das `LISTS` de `db.js`, e é isso que a torna um detentor de referência de verdade (favoritar segura o blob; desfavoritar deixa o gc decidir) |
| `folders` / `folder_<id>` | **LEGADO** (as pastas virtuais saíram na v5.254). `folder_<id>` era um detentor de referência como as listas, escrito só por `listAdd`/`listRemove`/`folderDrop` — a regra fica porque `isReferenced` ainda varre essas chaves, e é ela que vale para QUALQUER chave de `state` que passe a guardar ids de mídia |
| `downloadOk` | `true` depois que o operador autorizou o download sob demanda uma vez (modo simplificado — `ensureDownloadConsent`) |
| `messages` | `[{ id, text }]` — mensagens de texto puro da aba Mensagens (ver "Camada de Texto") |
| `opfs-folders` | `[{ id, name, count, syncedAt, handle? }]` — pastas sincronizadas no OPFS (`handle` acelera re-sync) |
| `coll:<id>` | `{ indexSyncedAt, songs: [{ id_music, track, name, duration, has_instrumental_music, fileIdFull, fileIdPlayback }] }` — índice offline de UMA coleção do LouvorJA (`coll:hymnal-2022`, `coll:hymnal-1996`, `coll:album-<id>`) — ver "Coleções de mídia (LouvorJA)" |
| `albumCatalog` | `{ categories: [{ id_category, name, order, albums: [{ id_album, subtitle, order }] }], albums: [{ id_album, name, color }] }` — a hierarquia categoria → álbum de `pt_categories` (ver "Classificação" nas Coleções). Formato antigo (array achatado) é migrado na leitura |
| `bibleVersions` | `[{ id, name }]` — versões/traduções da Bíblia (de `pt_bible_version`), baixadas na 1ª vez — ver "Bíblia" |
| `bibleBooks` | `[{ id, name }]` — livros da Bíblia (de `pt_bible_book`) para casar o `id_bible_book` real; a estrutura de exibição (abreviações/nº de capítulos) é offline em `bible.js` |
| `bibleVersion` | id da versão da Bíblia selecionada pelo operador |
| `bible:<v>_<b>_<c>` | `{ verses: [{ n, text }], syncedAt }` — texto de UM capítulo (`bible_{v}_{b}_{c}`); a versão inteira é baixada na 1ª vez que a aba é usada (e cada capítulo também sob demanda como fallback) |
| `bibleComplete:<v>` | `true` quando a versão `<v>` foi baixada por completo (todos os capítulos) — evita refazer o download em massa |
| `lyrics:<collId>` | acervo de LETRAS por coleção: `{ <id_music>: [{ a: rótulo\|null, l: [linhas] }] }`, ou `0` marcando "esta música não tem letra". É o que a BUSCA consome — ver "Acervo de LETRAS" |
| `chronoPrefs` | preferências do cronômetro/relógio/timer (modo, duração, formato, legenda, mais o campo `v` de versão do registro). A contagem em curso **não** é persistida |
| `drawPrefs` | sorteio: faixa/lista de opções, "não repetir", histórico e o último resultado — este **é** persistido (ver "Ferramentas: sorteio") |
| `migSemNumeroAlbuns` | marca de passagem única: os arquivos já baixados de coleções que não numeram tiveram o prefixo `N. ` removido (ver "O número é do HINÁRIO") |
| `hymnal2022` | legado — migrado para `coll:hymnal-2022` no `loadCollections()` (a chave antiga permanece, ignorada) |
| `pending-share` | legado — era o share que o service worker gravava aguardando processamento. O SW saiu e o share chega pela ponte nativa; a leitura remanescente da chave (que ninguém escrevia desde a v5.48) saiu na limpeza da auditoria de agosto/2026 — hoje ela é ignorada |
| `order` | legado — lido apenas como fallback de `imports` |
| `favorites` | legado — a chave ANTIGA dos favoritos. O recurso existe: hoje ele é a lista `favs` (ver a tabela das listas, acima). Esta chave não é mais lida nem gravada, e é ignorada |
| `linked-folders` | legado (pastas vinculadas por handle) — substituído por `opfs-folders`; ignorado |
| `louvorja-token` / `louvorja-hymnal` | legado (hinário online removido na v2.5); ignorados |

### API exposta (`window.AVDB`)

```js
setState, getState
stateKeys(prefix)             // chaves de `state` com esse prefixo, numa transação
                              // só e SEM ler valor nenhum — presença em massa
addMedia(blob, meta)          // cria registro + adiciona a meta.list (padrão 'imports')
addUrlMedia(url, meta)        // item de URL externa (blob=null), idem
addDeck(pages, meta)          // apresentação: uma imagem por página
addCue(cue, data, meta)       // CENA DE ROTEIRO: item sem bytes (ver abaixo)
getMedia(id), renameMedia(id, name)
mediaByYoutube(youtubeId, kind)  // o registro desse vídeo na FORMA pedida, ou null
listIds, listSet, listItems, listHas, listAdd, listRemove, gc
folderDrop(folderId)          // apaga um ATALHO inteiro, coletando o que ficar sem dono
fileAdd, fileGet, fileDelete, filesByFolder, filesAll   // catálogo OPFS
opfsSupported, opfsGetFile, opfsWriteFile,              // Origin Private
opfsDeleteFile, opfsDeleteDir                           // File System
kindFromType, sendCommand, onCommand
```

**`listSet` tem duas formas, e a diferença é atomicidade:**

- `listSet(name, [ids])` grava o array como veio — read-modify-write PARTIDO: um
  `listAdd` que comite entre a leitura e esta escrita é perdido, e o registro
  criado em `media` fica órfão para sempre (o gc só roda dentro de
  `listRemove`). Hoje nenhum escritor de fundo mexe em listas, então é
  fragilidade estrutural, não defeito em operação.
- `listSet(name, fn)` é a forma ATÔMICA: `fn(listaAtual)` roda dentro da MESMA
  transação de `state` que grava o resultado. `fn` precisa ser SÍNCRONA — um
  `await` deixaria a transação autocommitar antes do `put`.

Prefira a forma com função ao escrever código novo.

Fora da superfície de propósito: `openDB` (expor a conexão crua convida a montar
transações por fora dos helpers, que é onde mora a atomicidade deste arquivo) e
`storeUrlTemp`/`storeMediaTemp`/`deleteMedia` (gravavam em `media` SEM entrar em
lista nenhuma, isto é, criavam registros que NENHUM gc alcança). Quem precisa de
um registro usa `addMedia`/`addUrlMedia`, que já entram numa lista.

#### Garbage collection de blobs

Um registro só é excluído quando **nada mais aponta para ele** — nem lista, nem
pasta dos Favoritos:

```
listRemove(listName, id)
  → isReferenced(id, exceto listName)?  → não; delete no store media (gc)
```

**`isReferenced` é o ponto único da pergunta "posso destruir este blob?"**, e ela
cobre mais que as duas listas fixas: cada pasta guarda ids em
`state['folder_<id>']`, chaves DINÂMICAS. Sem elas o defeito é destrutivo e
silencioso — importar um vídeo, pô-lo num Favorito e excluí-lo do Cronograma
apagava o BLOB; o Favorito seguia com o id, `getMedia` devolvia `undefined` e o
`filter(Boolean)` do Controle descartava sem avisar. **Qualquer chave de `state`
que passe a guardar ids de mídia precisa entrar ali.**

`isReferenced` recebe o objectStore de `state` JÁ ABERTO, para decidir dentro da
transação de quem chamou — é isso que fecha o TOCTOU. O `gc(id)` avulso (sem
chamador; fica como válvula) usa a MESMA função de propósito: foi a duplicação
da regra em dois lugares que deixou os Favoritos de fora.

**Atomicidade (transação única):** `listAdd`, `listRemove` (com o gc embutido) e
`addMedia`/`addUrlMedia` (registro + entrada na lista) fazem o
read-modify-write dentro de UMA só transação IDB. Sem isso há dois defeitos:
*lost update* (duas escritas concorrentes leem o mesmo array e a segunda
sobrescreve a primeira) e *registro órfão* (o `add` em `media` completa, o
`listAdd` falha, e o blob vaza fora de qualquer lista). O gc de `listRemove`
roda na mesma transação da remoção, fechando o TOCTOU em que um `listAdd`
concorrente re-referenciaria o id no intervalo. (`readListIn` lê a lista de um
objectStore já aberto; `txDone(tx)` confirma o commit.)

**REGRA:** chave de `state` que guarda ids de mídia se escreve por
`listAdd`/`listRemove`/`listSet(name, fn)`. `setState` cru numa dessas chaves é
um vazamento esperando acontecer — foi assim que apagar uma pasta dos Favoritos
deixava blobs de centenas de MB no IndexedDB para sempre, invisíveis e sem
caminho de limpeza. Daí `folderDrop(folderId)`, que apaga índice, lista e varre
os ids numa transação só; **a ordem importa** — a pasta sai de `folders` ANTES da
varredura, senão `isReferenced` a encontraria e ela seguraria os próprios ids.

#### Cenas de roteiro (`kind: 'cue'`)

Um **cue** é um item de lista que aponta para uma CENA em vez de para bytes —
contagem regressiva, leitura bíblica, aviso, letra sem música:

```js
{ kind: 'cue', cue: 'verse',      data: { versionId, bookIdx, chapter, verse } }
{ kind: 'cue', cue: 'message',    data: { msgId, text } }
{ kind: 'cue', cue: 'songlyrics', data: { collId, songId } }
{ kind: 'cue', cue: 'chrono',     data: { mode, durationMs, label, secs, h12 } }
{ kind: 'cue', cue: 'draw',       data: { kind, min, max, pool, label } }
{ kind: 'cue', cue: 'group',      data: { ids: [...] } }        // o "pacote"
```

1. **O Display não muda uma linha, e sequer sabe que cues existem.** Um cue
   NUNCA vira `load`: projetá-lo chama a MESMA função que o botão da aba já
   chamava (`projectBibleVerse`, `projectMessage`, `projectChrono`,
   `projectDraw`, `projectSongLyricsOnly`), que manda o `text`/`chrono`/`draw`
   de sempre. Ponteiro novo, nunca lógica de projeção nova.
2. **A guarda mora em `send()`**, não no toque da lista: é por ali que passam o
   avanço automático da playlist, o ⏮/⏭ do transporte, a notificação nativa e o
   pacote. Um cue que chegasse ao `load` APAGARIA o telão (registro sem
   blob/url/pages cai no `clear()` do stage).
3. **A reconexão do telão vem de graça:** projetar um cue deixa a SESSÃO
   montada, e `resendSceneToDisplay` já reenvia sessões.
4. **O descritor é uma REFERÊNCIA, não uma cópia.** O versículo guarda
   `{versão, livro, capítulo, número}` e o texto vem do cache na hora de
   projetar; a mensagem guarda o `msgId` (com o texto como reserva, para o
   roteiro não ficar mudo se ela for apagada). Um cue não envelhece quando a
   mensagem é editada nem duplica a Escritura no banco.

- **O versículo projeta na versão EM USO HOJE**, com a guardada como reserva: a
  referência é do texto, não da tradução — um roteiro de um mês atrás não pode
  arrastar de volta uma versão trocada nem disparar o download dela no domingo.
- **O sorteio guardado é a CONFIGURAÇÃO, nunca um resultado.** Projetar arma o
  sorteio e espera o toque em "Sortear": um ganhador já pronto ao entrar em cena
  tira do momento o que ele tem de público.

**Guardar uma cena é sempre o mesmo par de botões** (`cueSaveBtn`): ⊞ para o
Cronograma, ★ para os favoritos, sempre `.cue-save-btn`, com o rótulo em `title`
+ `aria-label`. (A folha de destinos das músicas continua com texto: ali as
linhas são um MENU e cada uma diz uma coisa diferente.)

#### Vídeo × só áudio, no seletor que já existia

O mesmo segmentado de Cantada/Playback (`.fit-seg`), com **Vídeo** e **Só
áudio** — é a mesma pergunta ("qual faixa deste item?"), e a escolha vale para
as quatro ações em vez de dobrar a folha para oito linhas.

- **Só áudio não é versão degradada:** o YouTube guarda o áudio em faixa
  SEPARADA, e é por isso que o progressivo tem teto de 720p. Pedindo só o áudio,
  esse teto não existe.
- **O registro entra como `kind: 'audio'` e SEM miniatura** — é o `kind` que faz
  o telão manter o wallpaper (ver `semVisual`, na seção do stage).
- **O nome ganha " (áudio)"**, a convenção do "(Cantado)"/"(Playback)": sem o
  sufixo, vídeo e áudio do mesmo link viram duas linhas de nome idêntico.
- **O reaproveitamento é por FORMA:** as duas convivem no banco com o mesmo
  `youtubeId`, então `mediaByYoutube(id, kind)` filtra — quem pediu áudio não
  pode receber o vídeo de 80 MB que já estava aqui.
- **Ponte:** método PRÓPRIO (`ytFetchAudio`), nunca um parâmetro a mais no
  `ytFetch`. A ponte casa o método por nome + aridade, e mudar a assinatura do
  `ytFetch` quebraria o download inteiro num shell antigo que recebesse este
  bundle por OTA. O seletor só é desenhado com `__SHELL_VERSION__ >= 23`.
- **A escolha viaja no FECHO de cada ação**, nunca em `songMenuFor`: o
  `songMenuItem` chama `closeSongMenu()` ANTES da ação, e ele zera aquele objeto
  — consultá-lo lá dentro encontraria null e todo download sairia como vídeo.
##### TRANSMISSÃO DIRETA: o vídeo sem baixar e sem o player do YouTube

O "Tocar agora" de um resultado do YouTube vira um `<video>` COMUM alimentado por
`MediaSource` — daí para a frente ele é mídia como qualquer outra: fade, cortina,
`MediaSession`, barra de progresso e segundo plano, e **zero pixel de YouTube no
telão**. As alternativas cobravam caro: baixar antes são centenas de MB de espera
antes do primeiro quadro, e o player embutido (removido na v5.212) trazia a UI
dele junto — a rodinha de carregamento, o botão grande na pausa e a tela final
**não têm parâmetro que desligue**, porque não são *controles*.

###### As três peças

| Peça | Onde | O que faz |
|---|---|---|
| manifesto | `YoutubeGrab.manifesto` + `AVNative.ytStream` | escolhe as duas faixas adaptativas pela MESMA fila de candidatos do download (visionOS primeiro) e devolve os byte-ranges do DASH |
| proxy | `StreamProxy.kt` | serve o `googlevideo` em `/stream/<token>`, no nosso origin |
| player | `shared/mse.js` | lê o `sidx`, pede os pedaços e os entrega ao `MediaSource` |

**Por que o proxy não é opcional.** Um `fetch` direto ao googlevideo falha por
três motivos independentes, cada um suficiente sozinho: **CORS** (o googlevideo
não manda `Access-Control-Allow-Origin`), o **User-Agent** (uma faixa do visionOS
pedida com o UA do WebView responde 403) e a **invariante 2** (o WebView recusa
buscar fora do origin).

**Por que ele NÃO é um `PathHandler`.** O `WebViewAssetLoader.PathHandler` recebe
só o caminho — os cabeçalhos não chegam lá —, e MSE é feito de requisições por
FAIXA DE BYTES: sem repassar o `Range`, cada pedido traria o arquivo inteiro para
usar 200 kB. Por isso ele é chamado de dentro do `shouldInterceptRequest`, que
recebe o `WebResourceRequest` completo, ANTES de o asset loader ver a URL — é o
único ponto do app que enxerga os cabeçalhos de uma requisição.

Ele vale para os DOIS WebViews, ao contrário do handler `/saf/`: quem projeta é o
telão, então negá-lo ao Display seria negar o recurso inteiro. A exposição é de
outra natureza — um token de stream aponta para uma faixa do vídeo que já está em
cena, não para o índice de uma pasta do aparelho.

###### O `sidx`, e por que ele é a peça testada

O índice DASH é o que torna a coisa viável: com alguns kilobytes o player sabe
onde começa cada fragmento. Sem ele, "tocar aos 3:20" significaria baixar tudo
até os 3:20.

É também a peça que falha em SILÊNCIO (um erro de deslocamento não dá exceção —
dá vídeo que não toca) e a única do caminho que se verifica sem aparelho, porque
os boxes podem ser construídos byte a byte a partir da especificação. Daí
`tools/sidx.test.mjs`: v0 e v1 (o tamanho do cabeçalho MUDA entre as duas, e
errá-lo desloca todas as entradas), `first_offset`, um box anterior ao `sidx`, o
bit de `reference_type` (que sem máscara viraria um tamanho absurdo), buffer
curto, ausência do box e `timescale` zero.

###### O que este player deliberadamente NÃO é

`mse.js` **não** troca de qualidade, **não** lê MPD e **não** faz ABR — ele lê um
índice, pede pedaços e os entrega. Um player DASH de prateleira (dash.js, Shaka)
são centenas de kB de terceiro para um caso que aqui é minúsculo: duas faixas, um
perfil, sem DRM, sem múltiplas qualidades, sem legenda. O preço está declarado:
isto é superfície NOSSA, e por isso cada ponto de falha avisa quem chamou
(`onErro` → `onStreamErro` do stage), e quem chamou tem para onde cair.

###### A recuperação, e quem a faz

As URLs do googlevideo expiram em algumas horas, então um registro de stream é
transitório por natureza. Quando ele falha em cena:

1. **A preview do Controle é a canária** — ela toca o MESMO registro, na mesma
   hora, e é na tela do operador que a falha aparece primeiro.
2. O Controle pede um manifesto NOVO para o mesmo `youtubeId` e o regrava
   (`AVDB.setMediaStream`).
3. **Uma tentativa só.** Falhando a segunda, o problema não é validade — é rede,
   codec ou vídeo restrito —, e a mídia é substituída pelo DOWNLOAD.

**O telão não recupera sozinho**, e não é omissão: ele recebe a ponte com
`host = null` e não pode pedir manifesto nenhum; e duas recuperações
independentes para a mesma cena brigariam entre si.

###### Só em "Tocar agora"

As outras três ações GUARDAM o item, e um manifesto que expira em horas seria
algo que não abre no domingo. Falhando qualquer coisa (shell antigo, vídeo sem
par adaptativo, WebView sem o codec), o caminho segue para o download **sem
avisar nada ao operador**: ele pediu o louvor, não o método.

##### E a QUALIDADE, logo abaixo

Uma segunda linha de segmentos, no mesmo construtor da primeira (`ytSegRow`):
**1080p · 720p · 480p** (mais **Online**, que não baixa nada).

- **Some com "Só áudio" escolhido** — ali não existe resolução nenhuma, e uma
  escolha que não faz nada é pior que escolha nenhuma.
- **O teto nasce no padrão A CADA ITEM.** Um teto que grudasse faria quem
  escolheu 480p numa rede ruim receber, sem aviso, o vídeo principal do domingo
  seguinte em 480p no telão: o atrito de dois toques é visível, a regressão
  silenciosa não seria.
- **360p ficou de fora**: num telão de salão ele é ruim o suficiente para não
  valer ser oferecido.
- **Ponte:** um TERCEIRO destino (`ytFetchAte`), pela regra de aridade do
  `ytFetchAudio`, e **só quando o teto pedido é MENOR que o padrão** — pedir
  1080p continua saindo pelo `ytFetch` de sempre, que existe em toda versão.
- **O progressivo respeita o teto, mas nunca ao ponto de não entregar nada**
  (`melhorProgressivo`): o maior que couber e, não cabendo nenhum, o MENOR que
  existe. Devolver `null` transformaria "quero economizar dados" em "não baixa".
- **O shell devolve a altura e a duração REAIS** do que de fato veio, não do que
  foi pedido — é isso que alimenta o subtítulo da linha.

##### A EXTRAÇÃO: a fila de candidatos, e o cliente que a sustenta

O YouTube protege as faixas ADAPTATIVAS (tudo acima de 720p e todo áudio
separado) com **SABR enforcement**: sem PO Token o CDN responde **403** a todas,
com qualquer par de contêiner, qualquer perfil de UA e com `Range`. Quem abriu
esse portão foi a própria biblioteca, na v0.26.3, com um cliente **visionOS**
buscado incondicionalmente e sem token nenhum — o conserto foi **uma linha de
`build.gradle.kts`**. A lição fica: **antes de reescrever extração à mão, olhar o
CHANGELOG da dependência.**

**O PO Token via WebView não é a saída, e isso foi verificado:**
`PoTokenProvider.getWebClientPoToken()` não tem UMA ÚNICA chamada em nenhuma
versão do extrator (v0.26.0 → v0.26.4 e `dev`) — o cliente web só serve para
metadados, e o `onFetchPage` consome apenas os tokens **ANDROID** e **iOS**. O
token do cliente Android exige o **DroidGuard** do Play Services, atrelado à
assinatura do app oficial. Um WebView rodando BotGuard aqui alimentaria um campo
que ninguém lê.

**O bump sozinho não bastaria**, e é por isso que a escolha é uma FILA: depois
dele o `StreamInfo` traz uma MISTURA — faixas do visionOS (que baixam) ao lado
das do cliente antigo (que respondem 403) —, e pegar "a de maior altura por
contêiner" pode pegar justamente a envenenada. As regras de `tentarJuntar`:

- **Cliente primeiro, altura depois.** Parece invertido e não é: as duas listas
  trazem 1080p e só a do visionOS baixa; ordenar por altura intercalaria as duas
  e gastaria as tentativas no lado que o CDN recusa. Empatados, mp4 antes de
  WebM — o WebView toca H.264 em qualquer aparelho.
- **O áudio é a sonda barata, e vem primeiro** (alguns MB contra centenas). O
  arquivo baixado fica guardado POR CONTÊINER, então um segundo candidato de
  vídeo mp4 reaproveita o m4a que já veio.
- **Tetos assimétricos:** um 403 falha antes do primeiro byte (candidato de vídeo
  custa uma requisição — cabem quatro); uma MONTAGEM que falha já custou o
  download inteiro do vídeo (teto de dois). Isto roda na rede do chip do
  operador, possivelmente minutos antes do culto.
- **O UA acompanha a URL:** `baixarTentando` lê o `c=` da própria URL e tenta
  primeiro o perfil que combina com ela. São **DOIS**: visionOS
  (`UA_VISIONOS`) ou Chrome/Android (`UA`) — o perfil iOS saiu junto com o
  `setFetchIosClient(false)`. A
  constante `UA_VISIONOS` é copiada caractere a caractere do que a biblioteca
  monta — **ao trocar a versão do extrator, conferir `ClientsConstants` e trazer
  os números novos junto**.
- **`adaptativoBloqueado` exige UNANIMIDADE** (todos os candidatos tentados, no
  mínimo dois, mortos com 403). Desligar o caminho adaptativo no primeiro 403
  seria o autogol: com o pool misturado, um 403 isolado é o comportamento NORMAL
  de uma faixa envenenada com uma boa logo atrás. Não é persistido de propósito —
  um estado em disco transformaria a recusa de um dia numa desistência
  permanente.
- **O cliente iOS fica DESLIGADO:** as faixas dele vêm como manifestos HLS, que o
  `isUrl` descarta, e cada faixa a mais é um candidato que a fila pode gastar.
- **O "só áudio" segue a mesma fila**, três candidatos na ordem de cliente, com o
  progressivo no fim.

**O remux** (`MuxMp4.kt`) junta a melhor faixa de vídeo até 1080p (mp4/AVC) com a
melhor de áudio (m4a/AAC) pelo `MediaMuxer` da plataforma — cópia de amostras
comprimidas, não recodificação: sem perda e sem espera. Três guardas:

- **Só monta se for MELHOR que o progressivo** (senão paga dois downloads e um
  muxer para entregar o mesmo de antes).
- **mp4 + m4a, nunca "o melhor" absoluto.** O 1080p vem em AVC (mp4) e VP9
  (WebM), e só o primeiro entra num contêiner MP4 — escolher pelo bitrate e
  descobrir isso no fim seria baixar centenas de MB para falhar no muxer.
- **Uma barra só** para os dois downloads e a montagem (o vídeo pesa 90%, que é a
  proporção real): duas barras que voltam ao zero são indistinguíveis de
  travamento.

O progressivo segue como **piso**: falhando tudo, o app entrega o arquivo de 360p
em vez de nada (um caso conhecido é o vídeo marcado como "made for kids", que o
visionOS não extrai).

###### O diagnóstico da extração, no rodapé de Configurações

`YoutubeGrab.diagnostico` guarda numa linha o que o extrator RECEBEU, de qual
cliente, e o que cada tentativa deu; `AVNative.ytDiag()` a entrega ao rodapé de
Configurações, lido a cada ABERTURA do popup (o valor muda a cada download, e a
graça é comparar antes e depois de um teste). Só no app (shell ≥ 24) e depois da
primeira extração.

```
áudio 5 [m4a 2, webm 3] · vídeo-só 12 [mp4 6 (1080p), webm 6 (1080p)]
  · prog 1 [mp4 1 (360p)] · clientes VISIONOS 17, ANDROID 1
  → juntou 1080p (mp4, 137@VISIONOS/V)
```

- **`clientes VISIONOS n, ANDROID n`** — de qual cliente veio cada faixa LISTADA.
  Sem isso, dezessete faixas parecem a mesma coisa vindo do cliente que funciona
  ou do que só entrega 403.
- **`itag@CLIENTE` em cada tentativa** (`a:` áudio, `v:` vídeo) — uma falha futura
  se correlaciona com o formato exato em vez de virar mais um zero mudo.
- Os dois saem do **`c=` e do `itag=` da própria URL**, não de um campo da
  biblioteca: é o CDN quem os carimba, e o que ele carimbou é o que ele vai
  cobrar no download. De quebra, o diagnóstico não acrescenta superfície de API a
  uma dependência recém-atualizada.
- **`+N manif.`** separa "o YouTube não mandou nada" de "mandou, mas como
  manifesto HLS" — duas leituras que levam a decisões opostas e que sem esse `+`
  apareceriam como o mesmo zero.
- A linha só menciona o itag do ÁUDIO quando ele FALHA; no sucesso nomeia apenas
  o vídeo. Um diagnóstico que narra o caminho feliz vira ruído.

> **ARMADILHA REGISTRADA (v1.46): um diagnóstico pode apontar para o lugar errado
> COM CONFIANÇA.** O `motivo()` procurava três dígitos começando em 4 ou 5 no
> TEXTO da exceção — e `conn.inputStream` lança `FileNotFoundException` cuja
> mensagem é a URL, que carrega `dur=423.061`. O regex leu a duração do vídeo e a
> apresentou como "HTTP 423", um código que nunca aconteceu. Hoje o código vem de
> `conn.responseCode`, lido antes de abrir o fluxo.

> **E a outra: ler uma peça e concluir sobre o conjunto.** A conferência da época
> olhou o *fallback sem token* (que de fato continuava igual) e escreveu que
> "atualizar a biblioteca não resolve" — era exatamente o que resolvia, porque a
> v0.26.3 trouxe um CLIENTE NOVO, que não passa por aquele fallback.
##### Todo campo de log tem botão de copiar (v5.117)

O diagnóstico acima nasceu sem botão, e a primeira leitura chegou aqui como
FOTO DA TELA. Virou regra do projeto (está em `CLAUDE.md`): um campo de
diagnóstico existe para ser repassado, então ele vem com o botão `.log-copy`
(no cabeçalho `.log-head`, sobre a caixa `.diag-box` — o markup nasceu como
`.log-line`/`.log-text`, que a consolidação do Registro no `#diagBox` deixou
para trás) — texto selecionável (contra o `user-select: none` que vale para o
app inteiro) e um botão que não encolhe, porque numa tela estreita quem some
primeiro não pode ser a saída. `copiarTexto` usa `navigator.clipboard` (o app
tem contexto seguro: a base é servida por `https://appassets.androidplatform.
net`) e cai no `execCommand('copy')` se o WebView negar — com o `<textarea>`
posicionado FORA da vista, nunca `display:none`, porque um campo fora do layout
não pode ser selecionado e sem seleção o `copy` copia nada, em silêncio. A
confirmação é o mesmo pulso do resto do app.

**Não exige subir o `DB_VERSION`** (nenhum índice novo; o IDB não tem esquema
por registro), e é isso que o mantém barato: ver o preço da VOLTA descrito em
`DB_VERSION`, em `db.js`. Um bundle anterior que encontre um cue o trata como
mídia sem fonte e cai no `clear()` — nada quebra, nada projeta.

### BroadcastChannel — canal `av-iasd`

Todos os comandos são objetos com um campo `type`.

**Um só ponto de entrega, com a lista de handlers por cima.** `onCommand` só
assina o canal (e o relay nativo) na **primeira** chamada; as seguintes apenas
entram numa lista. O motivo é o `alreadySeen`, que **testa e marca** o `__mid`
na mesma chamada: até a v5.47 cada `onCommand` criava seu próprio `deliver` e
todos compartilhavam o mesmo conjunto de mids, então com dois listeners na
mesma página o primeiro marcava o mid e o segundo via a mensagem como
repetida — o segundo **nunca receberia nada**. E só no app: no navegador não há
relay, não há `__mid`, e os dois funcionariam. Um recurso testado no navegador
que para de funcionar no aparelho é o pior modo de falhar deste projeto. Hoje
há exatamente um `onCommand` por página, então a armadilha estava latente — e é
justamente por isso que seria descoberta tarde, por quem só quisesse observar
`display-status` num módulo novo.

A entrega itera sobre uma **cópia** da lista (um handler que registre outro
durante a entrega não altera a rodada em curso) e envolve cada chamada em
`try/catch`: um handler que lança não pode calar os demais — no telão isso
significaria perder o comando seguinte no meio de um culto.

#### Controle → Display

| `type` | Campos extras | Descrição |
|---|---|---|
| `load` | `mediaId, view, muted, volume, time?, playing?` | Carrega e exibe uma mídia. `time` (segundos) e `playing` (bool) existem para a **reconexão do telão** — ver "Reenvio da cena" |
| `play` | — | Inicia reprodução |
| `pause` | — | Pausa |
| `seek` | `time` (segundos) | Pula para o instante indicado |
| `volume` | `volume` (0.0–1.0) | Altera o volume |
| `mute` | `muted` (bool) | Liga/desliga mudo |
| `view` | `view` (`'visual'`\|`'wallpaper'`) | Alterna entre exibir a mídia ou o wallpaper (com fade, se ativo) |
| `clear` | — | Limpa o Display (volta ao wallpaper, zera `currentId`; com fade-out, se ativo). É o **Parar do transporte**: encerra a CENA INTEIRA, Camada de Texto junto |
| `media-clear` | — | **Tira só a MÍDIA** (v5.178) — o simétrico exato do `text-hide`, e o que faz o stop por camada da lista existir. Com texto em cena o Display manda ao stage `clear-media` (o `fadeOutToBlack`: esmaece o conteúdo **sem tocar na cortina**, porque o cartão de texto vive por BAIXO dela); sem texto, é o `clear` inteiro. Quem escolhe é o DISPLAY, que é quem tem o `textActive`. O ramo vem **antes** do bloco de `textActive` — lá dentro `clear` é justamente o que chama `hideText` |
| `fit` | `fit` (`'contain'`\|`'cover'`\|`'fill'`) | Atualiza ao vivo o preenchimento da mídia (ajustar/preencher/esticar) |
| `lyricsbg` | `mode` (`'black'`\|`'image'`) | Atualiza ao vivo o fundo atrás da letra sincronizada (preto ou imagens dos slides) |
| `wallpaper` | — | Avisa que a imagem do wallpaper mudou. **Sem payload**: o blob mora no state `wallpaper`, que os dois apps compartilham — o Display relê do IDB (ver "Wallpaper personalizado") |
| `text` | `mode, view` + payload conforme o modo | Projeta/atualiza a **Camada de Texto** (ver a seção própria). `mode` = `'verse'` (Bíblia) \| `'message'` (aviso) \| `'chrono'` (relógio/cronômetro/timer) \| `'draw'` (sorteio). Nos dois primeiros o payload é `main` (texto principal) + `sub` (referência dourada abaixo; vazio nas mensagens); nos dois últimos é um **descritor** (`chrono` / `draw`) a partir do qual cada lado calcula o número localmente — ver as seções de Ferramentas. Um novo `text` troca o conteúdo em cena; `view` só liga/desliga a cortina compartilhada. **Independente do áudio**: um `text` NÃO para a mídia do stage — o áudio segue tocando por baixo |
| `text-hide` | — | Encerra a Camada de Texto (Bíblia/Mensagem) sem tocar na mídia de fundo |
| `mic` | `on` (bool) | **Microfone ao vivo** (push-to-talk): o Display abre o microfone e reproduz a voz na projeção. Camada de ÁUDIO independente — não toca na mídia, no texto nem na cortina. Enviado por `AVDB.sendCommand` direto, **nunca** por `cmd()`: a preview é o mesmo aparelho, a centímetros do microfone |
| `audio-retry` | — | Retentativa imediata de liberar o áudio bloqueado (botão de mudo do Controle no estado "sem áudio") |

#### Display → Controle

| `type` | Campos extras | Descrição |
|---|---|---|
| `display-ready` | — | Display pronto; o Controle reenvia a **cena inteira** (ver abaixo) |
| `display-status` | `mediaId, view, muted, volume, playing, currentTime, duration, audioBlocked` | Estado do Display a cada evento de tempo/estado (`audioBlocked`: navegador bloqueou som sem gesto; o Controle avisa o operador) |
| `media-ended` | `mediaId` | Vídeo/áudio chegou ao fim |
| `mic-status` | `on`, `error` | Resultado da abertura do microfone (permissão negada, sem microfone, em uso por outro app…) |

#### Reenvio da cena (`resendSceneToDisplay`)

O Display **sempre** abre no wallpaper e espera um comando — quem sabe o que
estava em cena é o Controle. Quando o dongle cai e volta, o Android destrói e
recria a `Presentation`, o WebView recarrega `/display/` e dispara
`display-ready`; é aí que o Controle reconstitui o telão. Três decisões
sustentam isso, e as duas primeiras nasceram de defeitos vistos em culto:

- **Cena é tudo que está no telão, não "mídia tocando".** A condição de reenvio
  é só `currentId` — qualquer mídia carregada. Ela já foi `playing || isImage`,
  e o que ficava de fora era justamente o caso mais comum de uma queda de
  dongle: o louvor de fundo **pausado** para a oração. Um vídeo pausado mostra
  o quadro congelado, um áudio pausado mantém a letra sincronizada em cena —
  nos dois casos havia algo projetado, e nos dois casos ele sumia para sempre.
- **O `load` leva a POSIÇÃO e o estado de reprodução** (`time`, `playing`). Sem
  eles o telão recarregava do zero: um hino aos 3:20 recomeçava do início na
  frente da congregação, e o `display-status` seguinte chegava com
  `currentTime` 0 e arrastava a preview do Controle junto — o operador perdia
  até a referência de onde estava. O tempo sai da **barra de progresso**
  (`#seek`), a mesma fonte que `pushNowPlaying` usa: é a única que cobre todos
  os tipos, inclusive YouTube, onde `preview.getTime()` não sabe de nada.
  Os campos viajam **dentro do próprio `load`**, e não como um `seek`/`pause`
  enviado logo depois, porque o `onCommand` do Display não serializa: o load é
  assíncrono (`getMedia` → `opfsGetFile` → `mediaReady`) e um comando seguinte
  chegaria a tempo de agir sobre o `<video>` **anterior**, antes de a fonte
  nova entrar.
- **A ordem é mídia primeiro, texto depois.** No Display um `load` **visual**
  encerra a Camada de Texto e um `load` de **áudio** a mantém — mandar o texto
  por último faz as duas combinações caírem no estado certo. Cronômetro e
  sorteio voltam pelo **descritor**, não por um valor: o telão recalcula o
  número a partir do mesmo `startAt`/`rollUntil`, então reaparecem no segundo
  certo (e no mesmo quadro do rolo), não no ponto em que a conexão caiu.

---
