# Claude Code — Audio Visual IASD

## Regra obrigatória após qualquer alteração

**Sempre fazer merge com `main` ao finalizar qualquer atualização nos arquivos.**

Fluxo padrão:
```bash
# 1. Desenvolver na branch designada
git add <arquivos>
git commit -m "mensagem descritiva"
git push -u origin <branch>

# 2. Merge obrigatório para main
git checkout main
git merge <branch> --no-ff -m "Merge: <descrição resumida>"
git push origin main
```

---

## Regras de desenvolvimento

- Nunca perder funcionalidades existentes ao refatorar.
- Ao alterar assets estáticos, incrementar a versão nos dois `sw.js` **usando o mesmo número da versão visual** (ex: `controle-v2.6`, `display-v2.6`).
- Toda operação IDB multi-passo que precise de atomicidade deve usar `storeTx()`.
- Não introduzir dependências externas — o projeto usa Node puro no servidor e JavaScript puro no cliente.
- Ao atualizar o código, atualizar este CLAUDE.md se a mudança afetar arquitetura, protocolo de comandos ou API pública.
- **A cada atualização de código, incrementar a versão visual exibida no cabeçalho do Controle** (`<span class="app-version">Controle vX.Y</span>` em `controle/index.html`). Usar versionamento incremental simples (2.6, 2.7, 2.8…). **Versão atual: v2.8.**

---

## A ideia

O Android consegue espelhar via **Miracast** um único app selecionado. Aproveitamos
isso dividindo o sistema em dois PWAs:

| PWA | Caminho | Papel |
|-----|---------|-------|
| **Display** | `/display/` | Tela projetada no telão via Miracast |
| **Controle** | `/controle/` | Interface do operador, sempre no celular |

Como os dois PWAs estão no **mesmo origin**, eles compartilham:

- **IndexedDB** — metadados, listas e blobs importados, acessíveis pelos dois apps.
- **OPFS** (Origin Private File System) — bytes dos arquivos sincronizados de
  pastas do dispositivo; acesso permanente sem prompts de permissão.
- **BroadcastChannel** (`av-iasd`) — o Controle envia comandos em tempo real para o Display.

Cada PWA tem `manifest.json`, `scope` e `start_url` próprios, então o Android os
instala e trata como **dois apps distintos** — permitindo espelhar só o Display.

Tudo funciona **100% offline** depois da primeira carga (service workers com
cache-first) — exceto recursos que dependem de rede por natureza: vídeos do
YouTube e itens de URL externa.

---

## Estrutura de arquivos

```
public/
├── index.html                  # Página inicial com links para os dois PWAs
├── shared/
│   ├── db.js                   # Camada comum: IndexedDB + OPFS + BroadcastChannel
│   ├── stage.js                # Motor de renderização compartilhado
│   ├── material-symbols.css    # Font-face da fonte de ícones (subset offline)
│   └── fonts/
│       └── material-symbols.woff2  # ~3.2 KB — 30 glifos
├── controle/
│   ├── index.html              # UI do operador
│   ├── controle.css            # Estilos do Controle
│   ├── controle.js             # Lógica do Controle
│   ├── icons/                  # icon-192.svg, icon-512.svg
│   ├── manifest.json           # PWA manifest (portrait + share_target)
│   └── sw.js                   # Service worker (cache: controle-vX.Y)
└── display/
    ├── index.html              # UI do Display (inclui iframe #youtube)
    ├── display.css             # Estilos do Display
    ├── display.js              # Lógica do Display
    ├── icons/                  # icon-192.svg, icon-512.svg
    ├── manifest.json           # PWA manifest (landscape, fullscreen)
    └── sw.js                   # Service worker (cache: display-vX.Y)
server.js                       # Servidor estático mínimo (Node puro, sem deps)
```

---

## Modelo de dados (`shared/db.js`)

### IndexedDB — banco `av-iasd` v2

| Object Store | Chave | Conteúdo |
|---|---|---|
| `media` | `id` (UUID) | `{ id, blob, url, thumb, type, kind, name, youtubeId, createdAt }` |
| `files` | `id` (UUID), índice `folder` | catálogo OPFS: `{ id, folder, opfsPath, srcName, name, type, kind, size, mtime, thumb, addedAt }` |
| `state` | chave string | valor arbitrário (listas, estado atual, pastas, transições…) |

Um registro de mídia tem **`blob`, `url` OU `opfsPath`** (nunca mais de um):
blobs locais importados, itens de URL externa (link direto, YouTube) ou
arquivos sincronizados no OPFS. `thumb` pode ser um `Blob`
(miniatura gerada via Canvas) ou uma **string URL** (ex: thumbnail
`hqdefault.jpg` do YouTube).

> **Atenção:** qualquer código que abra o banco fora de `db.js` (ex:
> `storePendingShare` no SW do Controle) deve usar `indexedDB.open('av-iasd')`
> **sem número de versão**, para não quebrar com `VersionError` quando o schema
> for atualizado.

### OPFS + catálogo (`files`)

Os **bytes** dos arquivos de pastas sincronizadas moram no **OPFS**
(`navigator.storage.getDirectory()`), em `folders/<folderId>/<arquivo>`. O
store `files` do IDB guarda apenas **metadados + thumbnail** — por isso listar
e buscar centenas de arquivos é instantâneo (nunca toca o disco); o arquivo só
é aberto na hora de reproduzir (`opfsGetFile` → `URL.createObjectURL`).

- OPFS pertence ao origin: **nenhuma permissão é pedida** para ler — nem no
  Controle, nem no Display (mesmo origin ⇒ mesmo OPFS).
- `getMedia(id)` procura em `media` e cai para `files` — assim IDs do catálogo
  entram em `playlist`/`imports`/pastas virtuais **sem copiar bytes**.
- O `gc()` das listas só apaga do store `media`; registros de `files`
  pertencem à sua pasta OPFS e só são removidos pela exclusão na pasta.
- `renameMedia` cobre os dois stores (no catálogo, renomeia só a exibição;
  o `opfsPath` não muda).

**Três listas nomeadas** (arrays de IDs guardados em `state`): `imports`, `favorites`, `playlist`.
Migração: `imports` herda o antigo state `order` se `imports` ainda não existir.

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
| `imports` / `favorites` / `playlist` | arrays de IDs de mídia |
| `current` | `{ mediaId, view, muted, volume, at }` — estado de exibição atual |
| `repeat` | `'off'` \| `'all'` \| `'one'` \| `'shuffle'` |
| `fade` | `{ in: bool, out: bool, time: segundos }` — transições de mídia (fade in/out) |
| `folders` | `[{ id, name }]` — pastas virtuais |
| `folder_<id>` | array de IDs de mídia da pasta |
| `opfs-folders` | `[{ id, name, count, syncedAt, handle? }]` — pastas sincronizadas no OPFS (`handle` acelera re-sync) |
| `pending-share` | `{ files, url, title, ts }` — share recebido pelo SW aguardando processamento |
| `order` | legado — lido apenas como fallback de `imports` |
| `linked-folders` | legado (pastas vinculadas por handle) — substituído por `opfs-folders`; ignorado |
| `louvorja-token` / `louvorja-hymnal` | legado (hinário online removido na v2.5); ignorados |

### API exposta (`window.AVDB`)

```js
openDB, setState, getState
addMedia(blob, meta)          // cria registro + adiciona a 'imports'
addUrlMedia(url, meta)        // item de URL externa (blob=null) + adiciona a 'imports'
storeUrlTemp(url, meta)       // registro temporário de URL, fora de qualquer lista
storeMediaTemp(blob, meta)    // blob temporário fora de listas (pastas vinculadas)
getMedia(id), deleteMedia(id), renameMedia(id, name)
listIds, listSet, listItems, listHas, listAdd, listRemove, gc
fileAdd, fileGet, fileDelete, filesByFolder, filesAll   // catálogo OPFS
opfsSupported, opfsGetFile, opfsWriteFile,              // Origin Private
opfsDeleteFile, opfsDeleteDir                           // File System
kindFromType, sendCommand, onCommand
```

#### Garbage collection de blobs

Um registro só é excluído automaticamente quando **não está em nenhuma das três listas**:

```
listRemove(listName, id)
  → se id não aparece em nenhuma outra lista → delete no store media (gc)
```

Registros **temporários** (`storeUrlTemp` / `storeMediaTemp`) não pertencem a
lista alguma — quem cria é responsável por excluí-los com `deleteMedia()`.
Sem consumidores atuais (o hinário, que usava o mecanismo, foi removido na
v2.5); a API permanece disponível.

### BroadcastChannel — canal `av-iasd`

Todos os comandos são objetos com um campo `type`.

#### Controle → Display

| `type` | Campos extras | Descrição |
|---|---|---|
| `load` | `mediaId, view, muted, volume` | Carrega e exibe uma mídia |
| `play` | — | Inicia reprodução |
| `pause` | — | Pausa |
| `stop` | — | Para e volta ao wallpaper |
| `seek` | `time` (segundos) | Pula para o instante indicado |
| `volume` | `volume` (0.0–1.0) | Altera o volume |
| `mute` | `muted` (bool) | Liga/desliga mudo |
| `view` | `view` (`'visual'`\|`'wallpaper'`) | Alterna entre exibir a mídia ou o wallpaper (com fade, se ativo) |
| `clear` | — | Limpa o Display (volta ao wallpaper, zera `currentId`; com fade-out, se ativo) |
| `fade` | `fadeIn, fadeOut, time` | Atualiza ao vivo a configuração de transições do stage |

#### Display → Controle

| `type` | Campos extras | Descrição |
|---|---|---|
| `display-ready` | — | Display pronto; Controle reenvia o estado atual (se estiver tocando) |
| `display-status` | `mediaId, view, muted, volume, playing, currentTime, duration` | Estado do Display a cada evento de tempo/estado |
| `media-ended` | `mediaId` | Vídeo/áudio chegou ao fim |

---

## Motor de renderização (`shared/stage.js`)

`createStage(opts)` retorna um objeto com a API de reprodução. Usado pelo Display
(tela real) e pelo Controle (mini-preview sempre mudo). Suporta blobs locais,
arquivos do OPFS (`opfsPath` — resolvidos via `AVDB.opfsGetFile`, com re-checagem
de `loadSeq` após o await) e itens de URL direta (`blob=null, url=string`).
Itens `kind='youtube'` **não são reproduzidos pelo stage** — ele apenas mostra
a thumbnail no `<img>`; a reprodução real é feita externamente (iframe no
`display.js`).

### Opções de criação

```js
createStage({
  wallpaper,    // elemento do wallpaper
  img,          // elemento <img>
  video,        // elemento <video>
  forceMuted,   // bool — mantém vídeo sempre mudo (preview do Controle)
  onEnded,      // callback quando o vídeo termina
  onTime,       // callback em timeupdate / loadedmetadata / play / pause / ended / volumechange
  onBlocked,    // callback quando autoplay é bloqueado pelo browser
  onError,      // callback no evento 'error' do <video>
})
```

### Estado interno

```
current    → registro da mídia carregada (null = nada)
ended      → flag: vídeo chegou ao fim (permite replay sem recarregar)
view       → 'visual' | 'wallpaper'
muted      → bool (intenção do operador; independe de forceMuted)
volume     → 0.0 – 1.0
url        → object URL do blob OU URL externa em uso
isBlobUrl  → bool — se true, revoga com URL.revokeObjectURL ao trocar/limpar
loadSeq    → contador para descartar loads/fades concorrentes obsoletos
fadeIn/fadeOut/fadeTime → transições (definidas via comando 'fade')
```

### Transições (fade)

Quando ativas, aplicam-se a **entrada, saída e troca** de mídia
(`runFadeOut(toWallpaper, rampAudio)` distingue destino e tratamento do áudio):

- **Troca de mídia** (`load` com mídia visível): a atual esmaece **até o preto**
  (`runFadeOut(false)` força o wallpaper oculto — inclusive se um crossfade de
  entrada interrompido o tinha deixado à mostra); a próxima entra em seguida
  com fade-in a partir do preto. As camadas esmaecidas são escondidas antes de
  restaurar a opacidade, para a mídia antiga não reaparecer durante o `getMedia`.
- **Saída para o wallpaper** (`stop`, `clear`, `view→wallpaper`, `ended` —
  `runFadeOut(true)`): a mídia esmaece revelando o **wallpaper** por trás
  (fade-in visual do wallpaper por crossfade).
- **Entrada a partir do wallpaper** (`load` sem mídia em cena, `view→visual`):
  crossfade — o wallpaper **permanece visível por baixo** enquanto a nova mídia
  entra de opacity 0 → 1 (saída de fade do wallpaper); o cleanup pós fade-in
  (`fadeCleanupTimer` → `applyView`) o esconde ao final.
- **Fade-in em duas fases** (`prepFadeIn`/`startFadeIn`): a mídia é fixada em
  opacity 0 e a transição só dispara quando ela está **pronta para pintar**
  (`mediaReady`: `img.decode()` / `loadeddata` do vídeo, timeout de 2,5 s) —
  sem isso o conteúdo "pipoca" no meio do fade. Vídeo/áudio entra com rampa de
  volume 0 → alvo (exceto preview `forceMuted`). O `fadeCleanupTimer` é
  cancelado por qualquer fade-out/fade-in posterior.
- **`ended` (fim natural)**: com fade-out ativo, esmaece até o wallpaper; o
  `load` do avanço automático da playlist interrompe o fade (`loadSeq`) e
  assume a transição — o wallpaper **não pisca entre itens da playlist**.
  Sem fade-out, instantâneo (como `pause`/`play` de retomada, sempre
  instantâneos).
- **`view` (visual on/off)**: transição **apenas visual** — o áudio continua
  tocando e não sofre rampa (`rampAudio=false`), nos dois sentidos.
- **`stop`**: após o fade marca `ended=true` — volta de fato ao wallpaper,
  mantendo `current` para replay via `play()`.
- Rampas de volume acompanham o fade visual nas trocas/saídas que encerram o
  áudio; guardado por `loadSeq`: um comando mais novo durante o fade descarta
  o anterior. `setVolume` do operador cancela rampa em curso; `play`/`stop`
  restauram o volume alvo (evita ficar preso em volume 0 pós fade-out).

### API exposta

```js
stage.handle(cmd)
stage.load(id, view, muted, volume)
stage.clear()
stage.play() / pause() / stop()
stage.seek(seconds)
stage.setView(v) / setMute(m) / setVolume(vol)
stage.setFade({ fadeIn, fadeOut, time })
stage.getCurrent()     // → registro atual ou null
stage.getView()        // → 'visual' | 'wallpaper'
stage.isPlaying()      // → bool
stage.isTimed()        // → bool (true para vídeo/áudio)
stage.getTime()        // → currentTime em segundos
stage.getDuration()    // → duração em segundos
stage.getMuted()       // → bool
stage.getVolume()      // → 0.0 – 1.0
```

### Concorrência de carregamento

`load()` é assíncrona. O contador `loadSeq` garante que apenas o **último** `load()`
iniciado aplica seu resultado — chamadas anteriores obsoletas são descartadas.

---

## PWA Controle

### Layout geral

```
┌─────────────────────────────────────────────────────────┐
│  Audio Visual IASD                       Controle v2.6  │  ← .appbar (topo fixo)
├─────────────────────────────────────────────────────────┤
│  [←] Título da lista     [busca na pasta]  [sincronizar]│  ← .list-header
│  ┌───────────────────────────────────────────────────┐  │
│  │  item 1                                           │  │  ← .lib-list
│  │  item 2                                           │  │     (área scrollável)
│  └───────────────────────────────────────────────────┘  │
│  [Playlist] │ [Cronograma] [Pastas]  [+ Importar]       │  ← .tabs (base da seção)
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┬──────┐         │  ← .bottombar (base fixa)
│  │  Preview 16:9                       │      │         │
│  │─────────────────────────────────────│ Mix  │         │
│  │  Nome da mídia atual  [seek bar]    │  er  │         │
│  │─────────────────────────────────────│      │         │
│  │  ⏮  ▶/⏸  ⏹  ⏭  🔁               │      │         │
│  └─────────────────────────────────────┴──────┘         │
│  [margem segura para navegação por gestos]              │
└─────────────────────────────────────────────────────────┘
```

**Cabeçalho (`.appbar`):** nome do app à esquerda, versão visual à direita.
A versão visual deve ser incrementada a cada atualização de código.

**Cabeçalho da lista (`.list-header`):** botão voltar (dentro de pasta), título da
aba/pasta, campo de busca (dentro de pasta OPFS) e botão de sincronizar pasta
do dispositivo (só na raiz da aba Pastas).

**Controles (`.bottombar`):** fixados na base da tela. O padding inferior usa
`max(env(safe-area-inset-bottom), 12px)` para garantir margem segura contra
acionamentos acidentais pela navegação por gestos do Android/iOS.

**Mixer (coluna direita):** slider vertical de volume, botão mudo, botão visual on/off.
Mexer no volume com mudo ativo desliga o mudo automaticamente.

A preview é um `createStage` com `forceMuted: true` que recebe os mesmos comandos
enviados ao Display (função `cmd()` envia ao canal E aplica na preview). A preview
local comanda a barra de progresso e o avanço automático da playlist.

**Tocar na preview** abre o popup de **configurações rápidas de transições**
(bottom-sheet `#fadePopup`): toggles de fade in (entrada) e fade out
(saída/troca) + slider de duração (0.2–5 s). A config é persistida em `state`
`fade` e aplicada ao vivo via comando `fade` (Display + preview); o Display
também a lê do state ao inicializar.

**Botão ⏹ ("Parar e limpar"):** envia `clear` (volta ao wallpaper) mas mantém
`currentId` — o ▶ recarrega e reproduz do início.

### Abas e biblioteca

As abas ficam na **base da seção de listas** (ícones):

- **Playlist** (botão com badge de contagem) — abre bottom-sheet com a fila de reprodução.
- **Cronograma** (`imports`) — itens importados; ficam até serem excluídos.
  Itens favoritados exibem estrela (não há mais aba Favoritos; a lista `favorites`
  persiste na camada de dados).
- **Pastas** (`folders`) — pastas sincronizadas no OPFS e pastas virtuais
  (agrupam mídias já importadas).
- **Importar** — `<input type="file" multiple accept="image/*,video/*,audio/*">`.

**Navegação persistente:** trocar de aba **não** reseta a pasta aberta nem a
busca — voltar para Pastas retorna exatamente onde estava. A posição de scroll
é guardada por aba/pasta (`scrollPos`, chave `scrollKey()` = aba + id da pasta)
e restaurada ao fim de cada `load()`; `rememberScroll()` é chamado antes de
trocar de aba, abrir pasta ou voltar. (Memória por sessão, em RAM.)

Miniaturas (160×160 px, JPEG 72%) geradas via Canvas no momento da importação.
Vídeos têm thumbnail extraído do frame a ~⅓ da duração (timeout de 3,5 s).
Itens sem blob local exibem badge `URL` ou `YT`.

### Gestos nos itens da biblioteca

| Gesto | Ação |
|---|---|
| Toque simples | **Substitui a playlist por este item** e o exibe no Display |
| Deslize à esquerda | **Adiciona** à playlist (sem substituir) |
| Segurar e arrastar (⠿) | Reordena o item na lista |
| Pressionar e segurar | Entra no modo de seleção múltipla |

**Modo de seleção múltipla:** barra substitui as abas, com contagem e botões de
salvar em pasta, renomear (1 item) e excluir. Excluir dentro de pasta virtual só
remove da pasta; nas demais abas usa `listRemove` (com gc).

### Pastas

- **Pastas sincronizadas (OPFS)** — o fluxo principal para bibliotecas grandes.
  `window.showDirectoryPicker()` pede permissão **uma única vez**, na
  sincronização: os arquivos de mídia são **copiados em streaming para o OPFS**
  (`folders/<folderId>/<arquivo>`) e catalogados no store `files` (metadados +
  thumbnail gerada na hora). Depois disso, abrir o app, listar, buscar e
  reproduzir **nunca pede permissão** — o catálogo responde na hora e o stage
  resolve os bytes do OPFS sob demanda.
  - **Re-sync** (botão na linha da pasta): tenta reutilizar o handle salvo em
    `opfs-folders` (browsers que persistem permissão nem mostram prompt) e cai
    no picker se necessário. Arquivos com mesmo nome+tamanho+data são pulados;
    novos/alterados são copiados. A sincronização é **aditiva** — nada é
    excluído automaticamente.
    - Toast de progresso `Sincronizando N/T…` via `flash(texto, sticky=true)`.
  - `navigator.storage.persist()` é solicitado na sincronização para proteger
    os arquivos contra descarte do browser; o rodapé da aba mostra o uso via
    `navigator.storage.estimate()`.
  - Itens da pasta têm botão ➕ que adiciona o **id do catálogo** ao Cronograma
    (zero-cópia — `getMedia` resolve pelo fallback). Seleção múltipla permite
    renomear e excluir (exclui do OPFS + catálogo + remove das listas).
  - Excluir a pasta (com `confirm()`) apaga o diretório OPFS inteiro, os
    registros do catálogo e as referências em listas.
- **Pastas virtuais** — criadas pelo usuário (state `folders` + `folder_<id>`);
  recebem itens pelo botão "salvar em pasta" da seleção múltipla (funciona
  também com IDs do catálogo OPFS). Excluir a pasta não exclui as mídias.

### Compartilhamento (Web Share Target)

O manifest do Controle declara `share_target` (POST multipart em `share-target`,
arquivos no campo `media`). O SW intercepta o POST, grava `pending-share` no IDB
e redireciona para o app; `checkPendingShare()` processa no init:

- **Arquivos** → importados como `addMedia` (com thumbnail).
- **URL do YouTube** (youtu.be, youtube.com — `watch?v=`, `/shorts/`, `/live/`,
  `/embed/`, `/v/`; ID de 11 chars validado) → `addUrlMedia` com
  `kind:'youtube'`, `youtubeId` e thumb `hqdefault.jpg` — cai direto no
  **Cronograma** (`imports`), pronto para tocar.
- **Outras URLs** → `kind` detectado pela extensão (`video`/`audio`/`image`/`url`).

### Modos de repetição

Ciclo ao tocar no botão 🔁: `off → all → one → shuffle → off` (persistido em `repeat`).

| Modo | Comportamento ao fim do item |
|---|---|
| `off` | Playlist para; `currentId` permanece para replay manual |
| `all` | Avança para o próximo; ao fim da lista volta ao início |
| `one` | Recarrega e reproduz o mesmo item |
| `shuffle` | Avança para item aleatório (nunca repete o atual) |

---

## PWA Display

Interface mínima: wallpaper + layer de imagem + layer de vídeo + iframe do YouTube.

Na primeira abertura exibe overlay de **unlock** — necessário para contornar a
política de autoplay dos navegadores. Após o unlock, escuta o BroadcastChannel e
repassa os comandos para `stage.handle()`. Ao inicializar, restaura o estado
salvo (`current`) e envia `display-ready` para que o Controle reenvie o estado atual.

### YouTube (player oficial integrado)

Ao receber `load` de um item `kind='youtube'`, o Display limpa o stage (com o
fade do próprio stage — o wallpaper cobre o carregamento, que depende de rede)
e carrega o **embed padrão do youtube.com** no iframe `#youtube`:

```
https://www.youtube.com/embed/<id>?autoplay=1&enablejsapi=1&playsinline=1&rel=0&origin=<origin>
```

- Usa `www.youtube.com` (e **não** `youtube-nocookie.com`) de propósito: o embed
  padrão compartilha a sessão logada do navegador — conta **Premium** é detectada
  automaticamente (sem anúncios). O iframe tem
  `allow="autoplay; fullscreen; encrypted-media; picture-in-picture"`.
- **Ponte postMessage (API de widget)**: o Display faz o handshake
  (`{event:'listening', channel:'widget'}` até a primeira resposta) e então:
  - **Comandos → player**: `play`/`pause` → `playVideo`/`pauseVideo`, `seek` →
    `seekTo`, `volume` → `setVolume(0–100)`, `mute` → `mute`/`unMute`, `view` →
    esconde/revela o iframe com fade (o iframe permanece carregado: áudio
    continua com o visual desligado).
  - **Player → sistema**: `infoDelivery`/`onStateChange` alimentam
    `display-status` (tempo, duração, playing, volume/mudo — inclusive mudanças
    feitas na UI nativa do player) e `media-ended` no estado 0 (fim), habilitando
    o **avanço automático de playlist** com itens YouTube.
- **Transições**: com fade ativo, o player entra invisível e faz crossfade sobre
  o wallpaper no `onReady` (timeout de segurança de 4 s se o handshake falhar);
  `stop`/`clear`/troca esmaecem o player antes de derrubá-lo. `ytSeq` guarda
  operações assíncronas obsoletas (equivalente ao `loadSeq` do stage).
- **Autoplay bloqueado**: se segundos após o `onReady` o player continua em
  unstarted/cued, o overlay de unlock é exibido; o toque envia
  `unMute`+`playVideo`.
- **No Controle**, a preview mostra apenas a **thumbnail** (nunca um segundo
  player); barra de progresso, ícone de play e avanço automático de itens
  YouTube são dirigidos pelo `display-status`/`media-ended` remotos
  (`previewTick` ignora itens youtube). YouTube só toca com o Display aberto
  e com rede.

---

## Servidor (`server.js`)

- Serve `public/` com tipos MIME corretos.
- Diretórios sem extensão resolvidos para `index.html`.
- Proteção contra path traversal: verifica `filePath.startsWith(ROOT + path.sep)`.
- URLs com percent-encoding inválido retornam HTTP 400.
- Service workers recebem `Cache-Control: no-cache`.

---

## Service Workers e cache

```
controle/sw.js → const CACHE = 'controle-vX.Y'
display/sw.js  → const CACHE = 'display-vX.Y'
```

Estratégia: cache-first (somente no cache próprio do app) com fallback para rede.
Na ativação apaga caches antigos da mesma palavra-chave sem tocar nos caches do
outro app.

Além do cache, o SW do **Controle** trata o POST em `share-target` → grava
`pending-share` no IDB e redireciona `303 ./` (Web Share Target).

**Ao alterar qualquer asset estático, usar o mesmo número da versão visual do Controle nos dois sw.js.**
Ex: se a versão visual é `v2.6`, os caches ficam `controle-v2.6` e `display-v2.6`.

---

## Fonte de ícones (Material Symbols)

Versão subconjuntada (~3.2 KB woff2): peso 400, 30 glifos usados na UI
(referenciados por codepoint — ver mapa `ICON` em `controle.js`).

**Codepoints ativos:**
```
E034 E037 E03B E03D E040 E041 E043 E044 E045 E047
E04F E050 E14C E150 E251 E2C7 E2C8 E2CC E3A1 E3AD
E413 E5C4 E5CF E838 E86C E872 E8F5 E945 EB80 F116
```

Para adicionar ícone: obter codepoint em `fonts.google.com/icons?icon.style=Rounded`
e gerar novo subset com `fontTools`.

---

## Deploy e CI

Push em `main` → GitHub Actions (`.github/workflows/deploy.yml`) publica `public/`
no GitHub Pages.

**URL de produção:** `https://jonathasptbr-gh.github.io/Audio-Visual-IASD/`

---

## Rodar localmente

```bash
npm start   # http://localhost:3000
```

Service workers funcionam em `localhost`. Em produção é necessário HTTPS.

---

## Instalar no Android

1. Abrir a URL no Chrome.
2. Acessar **Display** → "Adicionar à tela inicial" → instalar.
3. Acessar **Controle** → instalar da mesma forma.
4. Espelhar o **Display** via Miracast; operar pelo **Controle**.

> O primeiro toque no Display libera o autoplay de áudio — fazer isso antes de
> começar a operar pelo Controle.
