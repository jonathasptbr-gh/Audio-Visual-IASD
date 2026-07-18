# Claude Code — Audio Visual IASD

Sistema de projeção de mídia para culto (IASD), dividido em dois PWAs no mesmo
origin — **Controle** (celular do operador) e **Display** (telão via Miracast) —
em JavaScript puro, sem frameworks nem dependências de build. Funciona 100%
offline após a primeira carga.

## Índice

1. [Regra obrigatória após qualquer alteração](#regra-obrigatória-após-qualquer-alteração) — fluxo de git/merge
2. [Regras de desenvolvimento](#regras-de-desenvolvimento) — invariantes do projeto
3. [A ideia](#a-ideia) — por que dois PWAs
4. [Estrutura de arquivos](#estrutura-de-arquivos)
5. [Modelo de dados (`shared/db.js`)](#modelo-de-dados-shareddbjs) — IDB, OPFS, BroadcastChannel
6. [Motor de renderização (`shared/stage.js`)](#motor-de-renderização-sharedstagejs) — cortina, fades, concorrência
7. [PWA Controle](#pwa-controle) — layout, mixer, biblioteca, Hinário 2022, letra sincronizada
8. [PWA Display](#pwa-display) — wallpaper, YouTube, recuperação de áudio
9. [Design System (padrões visuais / CSS)](#design-system-padrões-visuais--css) — **tokens de cor/medida/método**
10. [Servidor (`server.js`)](#servidor-serverjs)
11. [Service Workers e cache](#service-workers-e-cache)
12. [Fonte de ícones (Material Symbols)](#fonte-de-ícones-material-symbols)
13. [Deploy e CI](#deploy-e-ci)
14. [Rodar localmente](#rodar-localmente)
15. [Instalar no Android](#instalar-no-android)

---

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

- **Contexto de execução fixo: os dois apps SEMPRE rodam como PWA instalado,
  sem exceções, e sempre em dispositivos móveis (Android).** Não projetar nem
  otimizar para uso em aba de navegador ou desktop; decisões de UX/autoplay/
  layout assumem PWA mobile instalado (Display espelhado via Miracast,
  Controle no celular do operador).
- Nunca perder funcionalidades existentes ao refatorar.
- **Seleção de texto desligada globalmente nos dois apps** (`user-select: none`
  + `-webkit-touch-callout: none` + `-webkit-tap-highlight-color: transparent`
  no seletor `*`, em `controle.css`/`display.css`) — nenhum dos dois é um
  documento de texto; um toque comprido em botão/linha/telão não deve abrir
  menu de seleção/copiar. Única exceção: `input, textarea` no Controle (o
  campo de busca `#libSearch` precisa continuar editável/selecionável).
- Ao alterar assets estáticos, incrementar a versão nos dois `sw.js` **usando o mesmo número da versão visual** (ex: `controle-v2.6`, `display-v2.6`).
- Toda operação IDB multi-passo que precise de atomicidade deve usar `storeTx()`.
- Não introduzir dependências externas — o projeto usa Node puro no servidor e JavaScript puro no cliente. (Exceção já existente: Display **e** Controle carregam a IFrame Player API oficial do YouTube via `<script src="https://www.youtube.com/iframe_api">` em runtime — não é dependência de build/npm, e o recurso YouTube já depende de rede/youtube.com para tocar o vídeo mesmo sem essa API. O Controle usa isso para a preview de vídeos do YouTube — ver seção do YouTube.)
- Ao atualizar o código, atualizar este CLAUDE.md se a mudança afetar arquitetura, protocolo de comandos ou API pública.
- **A cada atualização de código, incrementar a versão visual exibida no cabeçalho do Controle** (`<span class="app-version">Controle vX.Y</span>` em `controle/index.html`). Usar versionamento incremental simples (2.6, 2.7, 2.8…). **Versão atual: v4.50.**

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
│   ├── material-symbols.css    # Font-face da fonte de ícones (subset offline; só o Controle usa)
│   └── fonts/
│       └── material-symbols.woff2  # ~3.2 KB — 30 glifos
├── controle/
│   ├── index.html              # UI do operador
│   ├── controle.css            # Estilos do Controle
│   ├── controle.js             # Lógica do Controle
│   ├── louvorja.js             # Cliente da API pública do LouvorJA (Hinário 2022 — ver seção própria)
│   ├── icons/                  # icon-{192,512}.svg + .png (PNG obrigatório p/ WebAPK) + icon-maskable-{192,512}.png (ver "Instalar no Android")
│   ├── manifest.json           # PWA manifest (portrait + share_target)
│   └── sw.js                   # Service worker (cache: controle-vX.Y)
└── display/
    ├── index.html              # UI do Display (inclui iframe #youtube)
    ├── display.css             # Estilos do Display
    ├── display.js              # Lógica do Display
    ├── icons/                  # icon-{192,512}.svg + .png (PNG obrigatório p/ WebAPK) + icon-maskable-{192,512}.png (ver "Instalar no Android")
    ├── manifest.json           # PWA manifest (standalone; orientation:"landscape" — ver "Instalar no Android")
    └── sw.js                   # Service worker (cache: display-vX.Y)
server.js                       # Servidor estático mínimo (Node puro, sem deps)
docs/
└── FONTE-DE-DADOS-LOUVORJA.md  # Referência técnica do banco compartilhado (app-ja/LouvorJA)
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
> for atualizado. **Porém** esse open sem versão precisa de um
> `onupgradeneeded` que crie ao menos o store `state`: numa **instalação
> nova** (share recebido ANTES da 1ª abertura do app) o banco ainda não
> existe e nasceria sem nenhum object store, fazendo o `transaction('state')`
> lançar `NotFoundError` e perder o share silenciosamente. O `db.js` completa
> o schema (media/files) no upgrade 1→2 seguinte, que checa
> `if (!contains(...))` — sem conflito com o store criado pelo SW.

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

**Duas listas nomeadas** (arrays de IDs guardados em `state`): `imports`, `playlist`.
Migração: `imports` herda o antigo state `order` se `imports` ainda não existir.
(A antiga lista `favorites` foi removida — ver legado nas chaves de `state`.)

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
| `current` | `{ mediaId, view, muted, volume, at }` — estado de exibição atual |
| `repeat` | `'off'` \| `'all'` \| `'one'` \| `'shuffle'` |
| `fade` | `{ in: bool, out: bool, time: segundos }` — transições de mídia (fade in/out) |
| `fit` | `'contain'` \| `'cover'` \| `'fill'` — preenchimento da mídia (ajustar/preencher/esticar) no Display e na preview |
| `lyricsBg` | `'black'` (padrão) \| `'image'` — fundo atrás da letra sincronizada: preto ou as imagens dos slides |
| `folders` | `[{ id, name }]` — pastas virtuais |
| `folder_<id>` | array de IDs de mídia da pasta |
| `opfs-folders` | `[{ id, name, count, syncedAt, handle? }]` — pastas sincronizadas no OPFS (`handle` acelera re-sync) |
| `hymnal2022` | `{ indexSyncedAt, songs: [{ id_music, track, name, duration, has_instrumental_music, fileIdFull, fileIdPlayback }] }` — catálogo offline do Hinário Adventista 2022 (LouvorJA) — ver seção própria |
| `pending-share` | `{ files, url, title, ts }` — share recebido pelo SW aguardando processamento |
| `order` | legado — lido apenas como fallback de `imports` |
| `favorites` | legado (recurso de favoritos removido) — array de IDs; não é mais lido nem gravado, ignorado |
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

Um registro só é excluído automaticamente quando **não está em nenhuma das duas listas** (`imports`/`playlist`):

```
listRemove(listName, id)
  → se id não aparece em nenhuma outra lista → delete no store media (gc)
```

**Atomicidade (transação única):** `listAdd`, `listRemove` (com o gc embutido)
e `addMedia`/`addUrlMedia` (registro + entrada na lista) fazem o
read-modify-write dentro de **uma só transação IDB** — não em transações
separadas. Sem isso havia dois defeitos: (a) *lost update* — duas escritas
concorrentes (ex: share sendo processado + reordenação) liam o mesmo array e
a segunda gravação sobrescrevia a primeira, perdendo um id; (b) *registro
órfão* — se o `add` em `media` completasse mas o `listAdd` falhasse, sobrava
um blob em `media` fora de qualquer lista, que o gc nunca coletaria (vaza
espaço). O gc de `listRemove` também roda na mesma transação da remoção
(state + media): checa as outras listas e só então apaga o blob, fechando o
TOCTOU em que um `listAdd` concorrente re-referenciaria o id no intervalo.
(`readListIn` lê a lista a partir de um objectStore já aberto, para reuso
dentro dessas transações; `txDone(tx)` confirma o commit.) A regra do projeto
("operação IDB multi-passo atômica usa transação única") agora é honrada por
essas funções — antes elas a violavam.

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
| `fit` | `fit` (`'contain'`\|`'cover'`\|`'fill'`) | Atualiza ao vivo o preenchimento da mídia (ajustar/preencher/esticar) |
| `lyricsbg` | `mode` (`'black'`\|`'image'`) | Atualiza ao vivo o fundo atrás da letra sincronizada (preto ou imagens dos slides) |
| `audio-retry` | — | Retentativa imediata de liberar o áudio bloqueado (botão de mudo do Controle no estado "sem áudio") |

#### Display → Controle

| `type` | Campos extras | Descrição |
|---|---|---|
| `display-ready` | — | Display pronto; Controle reenvia o estado atual (se estiver tocando) |
| `display-status` | `mediaId, view, muted, volume, playing, currentTime, duration, audioBlocked` | Estado do Display a cada evento de tempo/estado (`audioBlocked`: navegador bloqueou som sem gesto; o Controle avisa o operador) |
| `media-ended` | `mediaId` | Vídeo/áudio chegou ao fim |

---

## Motor de renderização (`shared/stage.js`)

`createStage(opts)` retorna um objeto com a API de reprodução. Usado pelo Display
(tela real) e pelo Controle (mini-preview sempre mudo). Suporta blobs locais,
arquivos do OPFS (`opfsPath` — resolvidos via `AVDB.opfsGetFile`, com re-checagem
de `loadSeq` após o await) e itens de URL direta (`blob=null, url=string`).
Itens `kind='youtube'` **não são reproduzidos pelo stage** — ele apenas mostra
a thumbnail no `<img>`; a reprodução real é feita externamente (iframe no
`display.js`, que também **reaproveita a cortina do wallpaper deste mesmo
stage** — ver "Modelo de camadas" abaixo).

### Modelo de camadas: wallpaper é uma cortina por cima de tudo

O wallpaper fica **acima** (z-index maior) de toda mídia — img/video no stage,
e o iframe do YouTube no Display. A mídia toca/troca de conteúdo **livremente
por baixo**, sem nunca precisar saber se está "visível"; o wallpaper só
liga/desliga essa cortina por cima, com fade quando configurado.

Isso existe porque o modelo antigo (mídia por cima, escondida/revelada
conforme a view) exigia que cada tipo de mídia rastreasse "já posso me
revelar?" — para o YouTube isso significava só revelar o iframe quando
`view==='visual'` **e** o vídeo já estivesse tocando; se o vídeo começasse com
o wallpaper ligado, essa condição nunca era satisfeita e o vídeo ficava preso
atrás do wallpaper para sempre, mesmo depois de desligar o wallpaper (o áudio
tocava normalmente, só o vídeo nunca aparecia). Com o wallpaper como cortina
por cima, revelar é sempre só "esconder a cortina" — não depende mais de em
que estado (view) a mídia foi carregada.

- **`coveredNow`** (privado) é a única fonte de verdade sobre se a cortina
  está cobrindo agora. Começa `true` (nada carregado).
- **`computeCover()`**: `!current || ended || view === 'wallpaper'` — a
  cortina deve cobrir sempre que não há mídia, ela "terminou" (`ended`,
  aguardando replay) ou o operador pediu `view='wallpaper'`.
- **`instantCover(show)`** / **`coverIn(rampAudio)`** / **`coverOut()`**: as
  três únicas funções que tocam o elemento do wallpaper. `coverIn`/`coverOut`
  fazem fade (conforme `fadeOut`/`fadeIn` e `fadeTime`) e usam `coverSeq` para
  descartar fades de cortina obsoletos (um pedido mais novo cancela o
  anterior); `instantCover` é imediato (sem fade) e sempre vence.
- `img.hidden`/`video.hidden` (**`applyMedia()`**) passam a depender **só do
  `kind`** da mídia atual — nunca de `view`/`ended`. A mídia continua
  renderizando/tocando por baixo mesmo com a cortina fechada (é assim que o
  áudio do YouTube ou de um vídeo local continua audível com "wallpaper on").
- **`stage.coverIn`/`coverOut`/`instantCover` são expostos publicamente** —
  o Display os chama diretamente para a cortina do YouTube (`ytSetView()`,
  `onPlayerStateChange()`), já que é o **mesmo elemento físico** de wallpaper
  compartilhado. `coverIn(rampAudio=true)` mexe no volume do `<video>` do
  próprio stage — o YouTube **nunca** deve chamá-lo com `rampAudio=true` (sua
  própria rampa de áudio é feita externamente, via `setVolume` do player).

### Opções de criação

```js
createStage({
  wallpaper,    // elemento do wallpaper (cortina, por cima de tudo)
  img,          // elemento <img>
  video,        // elemento <video>
  forceMuted,   // bool — mantém vídeo sempre mudo (preview do Controle)
  onEnded,      // callback quando o vídeo termina
  onTime,       // callback em timeupdate / loadedmetadata / play / pause / ended / volumechange
  onBlocked,    // callback quando autoplay é bloqueado pelo browser (só
                // NotAllowedError; AbortError de um play() interrompido por
                // pause()/load() seguinte — normal em toda troca de mídia —
                // é ignorado, para não disparar recuperação de áudio à toa)
  onError,      // callback no evento 'error' do <video>
})
```

### Estado interno

```
current     → registro da mídia carregada (null = nada)
ended       → flag: vídeo chegou ao fim (permite replay sem recarregar)
view        → 'visual' | 'wallpaper'
muted       → bool (intenção do operador; independe de forceMuted)
volume      → 0.0 – 1.0
url         → object URL do blob OU URL externa em uso
isBlobUrl   → bool — se true, revoga com URL.revokeObjectURL ao trocar/limpar
loadSeq     → contador para descartar loads/fades concorrentes obsoletos
coveredNow  → bool — a cortina do wallpaper está cobrindo agora?
coverSeq    → contador para descartar fades de cortina obsoletos
fadeIn/fadeOut/fadeTime → transições (definidas via comando 'fade')
```

### Transições (fade)

**Regra geral: transição entre mídias é sempre PRETO; o wallpaper só aparece
como ponto final (resting state confirmado), inicial (nada carregado ainda)
ou manipulado explicitamente pelo operador (`view` toggle).** Nunca como parte
de uma troca de conteúdo em andamento — inclusive quando a troca depende de
rede (YouTube) ou é ambígua no momento (fim natural, antes de saber se um
próximo item vem em seguida).

Duas transições **independentes** quando fade está ativo:

- **Fade de CONTEÚDO** (`runFadeOut(rampAudio)` + `mediaReady`/fade-in): troca
  de item enquanto já visível (ex: vídeo A → vídeo B com a cortina já aberta),
  fim natural (`ended`) e troca de TIPO de conteúdo (mídia local ↔ YouTube via
  `fadeOutToBlack()`, ver seção do Display). A mídia atual esmaece até o
  **preto** (não até o wallpaper — a cortina não participa dessa transição);
  a próxima entra com fade-in a partir do preto, só depois de pronta pra
  pintar (`mediaReady`: `img.decode()` / `loadeddata` do vídeo, timeout de
  2,5 s) — sem isso o conteúdo "pipoca" no meio do fade. Vídeo/áudio ramp
  0 → alvo junto (exceto preview `forceMuted`).
- **Fade da CORTINA** (`coverIn`/`coverOut`): cobrir ou revelar a mídia
  (independente de qual mídia é ou de qual tipo) — reservado para os três
  contextos legítimos do wallpaper (ponto final/inicial/manual), nunca para
  uma troca de conteúdo em si. Usado em:
  - **Saída** (`stop`, `clear`, `view→wallpaper`): `coverIn()` — a cortina
    sobe revelando... nada, ela é opaca; a mídia continua tocando
    (des)coberta por baixo. `stop`/`clear` cobrem **com rampa de áudio**
    (`coverIn(true)` — corta a reprodução abruptamente, então o volume desce
    suave); `view` toggle é **sem rampa** nos dois sentidos (só o visual
    muda, o áudio não é afetado).
  - **Entrada** (`load` que revela conteúdo coberto, `view→visual`):
    `coverOut()` — a cortina desce, revelando a mídia que já estava tocando
    por baixo (sem precisar esperar nada dela).
- **`ended` (fim natural)**: esmaece até o **PRETO** (`runFadeOut(false)` —
  sem rampa, o vídeo já parou sozinho), nunca a cortina — ainda não se sabe
  se um próximo item vem em seguida. Só cobre com o wallpaper de fato
  (`instantCover(true)`) **~400 ms depois**, e só se `ended` continuar
  verdadeiro e nenhum `loadSeq` mais novo tiver assumido a cena nesse meio
  tempo — ou seja, só quando fica confirmado que é o ponto final de verdade
  (`repeat='off'` ou Controle fechado). Com avanço automático de playlist, o
  `load` do próximo item (disparado por `onEnded`) chega quase junto e
  assume via `loadSeq` bem antes desse prazo — a marca nunca chega a
  aparecer entre os itens da playlist. `video.hidden` também passa a
  considerar `ended` (além do `kind`): sem isso, o `currentTime=0` do fim
  natural (preparando o replay) mostraria um salto pro primeiro frame antes
  do preto/cortina cobrir.
- `setVolume` do operador cancela qualquer rampa em curso (de conteúdo ou de
  cortina — ambas usam o mesmo `rampTimer` do `<video>`, mutuamente exclusivas
  no tempo); `play`/`stop` restauram o volume alvo (evita ficar preso em
  volume 0 pós fade).

### API exposta

```js
stage.handle(cmd)
stage.load(id, view, muted, volume)
stage.clear()
stage.play() / pause() / stop()
stage.seek(seconds)
stage.setView(v) / setMute(m) / setVolume(vol)
stage.setFade({ fadeIn, fadeOut, time })
stage.setFit(v)        // 'contain' (ajustar) | 'cover' (preencher) | 'fill' (esticar)
stage.setForceMuted(v) // alterna em tempo real se o stage é forçado a ficar sempre mudo
                        // (preview normal) ou toca áudio de verdade (modo "mesa de som"),
                        // com rampa curta de volume (MUTE_RAMP_TIME)
stage.coverIn(rampAudio) / coverOut() / instantCover(show)  // cortina do wallpaper (ver acima)
stage.fadeOutToBlack()  // esmaece até o preto e reseta (current=null) sem tocar a cortina —
                        // usado só na troca de TIPO de conteúdo (mídia local ↔ YouTube)
stage.getCurrent()     // → registro atual ou null
stage.getView()        // → 'visual' | 'wallpaper'
stage.isPlaying()      // → bool
stage.isTimed()        // → bool (true para vídeo/áudio)
stage.getTime()        // → currentTime em segundos
stage.getDuration()    // → duração em segundos
stage.getMuted()       // → bool
stage.getVolume()      // → 0.0 – 1.0
stage.getFit()         // → 'contain' | 'cover' | 'fill'
stage.isForceMuted()   // → bool
```

### Preenchimento da mídia (`setFit`)

`setFit(v)` aplica `object-fit` direto via `style` no `<img>` e no `<video>`
do stage (`'contain'` por padrão, aceita `'cover'`/`'fill'`; qualquer outro
valor cai em `'contain'`) — sobrepõe o `object-fit: contain` fixo do CSS.
Só afeta mídia local (imagem/vídeo do próprio stage); o iframe do YouTube não
usa isso (é conteúdo cross-origin, fora do stage). Persistido em `state.fit`
e propagado pelo comando `fit` — que, tanto no Display quanto no Controle, é
despachado direto para o stage **mesmo com um vídeo do YouTube tocando no
momento** (o roteamento normal de comandos cairia no ramo do YouTube, que
ignora `fit`, e o stage só pegaria o valor novo na próxima mídia local, com
atraso).

### Rampa de mudo (`setMute`)

Mutar/desmutar não corta o áudio na hora — faz uma rampa curta de volume
(`MUTE_RAMP_TIME`, 0,25 s) usando o mesmo `rampTimer` das outras transições
(mutuamente exclusivas no tempo, a mais recente cancela a anterior). Ao
mutar, a rampa desce até 0 e só então `video.muted` é de fato marcado como
`true` (evita o "pop" de um corte abrupto); ao desmutar, `video.muted` volta
a `false` já na hora (senão volume 0 não seria ouvido) e a rampa sobe de 0
até o volume alvo. Um `setTimeout` (`muteApplyTimer`) aplica o `muted` real
ao final da rampa de descida, mas confere `muted` de novo nesse instante —
um `setMute()`/`load()` mais recente pode ter mudado a intenção enquanto a
rampa corria, e a aplicação atrasada não deve "ressuscitar" um mudo já
desfeito. `setVolume()` (o operador arrastando o fader) cancela qualquer
rampa de mudo em andamento, senão o volume ajustado manualmente seria
sobrescrito pelo `muteApplyTimer` pendente. O YouTube no Display usa a mesma
lógica, em paralelo: rampa via `player.setVolume()` (`ytRampVolume`) e só
chama `player.mute()`/`unMute()` no início/fim da rampa, pelos mesmos motivos.

**Fonte única da rampa de volume** (`createStage.rampSteps` /
`createStage.MUTE_RAMP_TIME`): o passo-a-passo do fade sonoro
(`steps = max(2, round(dur*20))`, clamp 0–1) e a duração da rampa de mudo
(0,25 s) ficam definidos **uma vez** no `stage.js` e expostos como
propriedades de `createStage`. Os três "sinks" de áudio do sistema — o
`<video>` do stage (`rampVolume`), o player do YouTube no Display
(`ytRampVolume`) e o da preview no Controle (`ytPreviewRampVolume`) — reusam
esse mesmo `rampSteps`, cada um passando só o seu `apply(v)` (o "onde escrever
o volume"). Antes a matemática e a constante estavam duplicadas nos três
arquivos e podiam divergir. A *orquestração* do mudo (quando mutar de fato,
`muteApplyTimer`) continua por player, pois depende do estado de cada um.

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
│  [Cronograma] [Pastas]  [🔍 Hinário] [+ Importar]        │  ← .tabs (base da seção)
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┬──────┐         │  ← .bottombar (base fixa)
│  │  Nome da mídia atual  [seek bar]    │ Wall │         │
│  │─────────────────────────────────────│ Ltr  │         │
│  │  ⏮ Preview 16:9 ⏭                  │ Mesa │         │
│  │─────────────────────────────────────│ Mudo │         │
│  │  🔁  ⏮  ▶/⏸  ⏹  ⏭  [Playlist]    │ Vol  │         │
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

**Grade real (CSS Grid), não flex aproximado:** `.deck` é um `display:grid` de
2 colunas (`1fr` / `56px` do mixer) × 3 linhas (`auto` / `130px` do preview /
`auto`), com `.nowplaying`, `.preview-row` e `.transport` como itens diretos
da grade (não há mais um `.deck-main` intermediário). O `#mixer` ocupa as 3
linhas (`grid-row: 1 / 4`) e usa `grid-template-rows: subgrid` para **herdar
exatamente essas mesmas 3 faixas de altura** — garante alinhamento pixel a
pixel entre a coluna do mixer e nowplaying/preview/transport, em vez de
depender de flex-basis calculado à parte (a fonte de um desalinhamento
antigo entre as duas colunas). `padding` do `#mixer` é **só horizontal** (`0
.35rem`): padding vertical deslocaria as linhas herdadas do subgrid,
reintroduzindo o desalinhamento.

**Sem "card" de fundo:** os botões do mixer ficam **livres** (cada um só com
o próprio fundo via `.ctl-btn`) — `#mixer` não tem `background`/`border-radius`
próprios, só posiciona pela grade.

O mixer é dividido em 3 "fatias" (`.mixer-slot`), uma por linha da grade:

| Fatia | Linha da grade | Conteúdo |
|---|---|---|
| `.mixer-top` | 1 (mesma de `.nowplaying`) | **visual on/off** (`#viewToggle`) |
| `.mixer-mid` | 2 (mesma de `.preview-row`, 130px) | **fundo da letra** (`#lyricsBgToggle`, ícone de **flor** — SVG inline), **mesa de som** (`#standaloneToggle`, ícone de **fone de ouvido** — SVG inline), **mudo** (`#muteToggle`) — empilhados, cada um com `flex:1` |
| `.mixer-bottom` | 3 (mesma de `.transport`) | **volume** (`#volToggle`/`#volClose`, recolhível) |

Essa ordem (wallpaper no topo, depois fundo da letra/mesa de som/mudo no
meio, volume na base) agrupa os controles de **áudio** (mesa de som + mudo)
perto do volume, na base, e o de **visual** (fundo da letra) perto do
wallpaper, no topo. Cada botão tem `flex:1` dentro da própria fatia — top
(1 botão) e bottom (1 de cada vez) preenchem a fatia inteira; mid (3
botões) a divide em partes iguais.

Tocar no botão de volume liga a classe `.vol-open` no `#mixer`, que troca
**top + mid** (os 4 botões: visual/fundo da letra/mesa de som/mudo) pelo
**fader vertical** (`.fader-wrap`, posicionado via `grid-row: 1 / 3` — ocupa
exatamente o mesmo espaço de top+mid combinados) **+ um botão de ocultar**
(`#volClose`, ícone ✕) que aparece na mesma fatia `.mixer-bottom`, no lugar
de `#volToggle`. O botão da base (volume/ocultar) **não muda de lugar** entre
os dois estados — só troca de característica (ícone/cor) instantaneamente;
quem anima é o que está **acima** dele: o fader entra ao abrir (fade + leve
deslize) e sai ao fechar (`.vol-closing` mantém a classe durante a saída),
e ao voltar os botões de top/mid entram animados (`.vol-revealing`). É só
estado de UI (não persistido; cada abertura começa recolhida). As durações
no JS (`openVolume`/`closeVolume` em `controle.js`) casam com as do CSS
(`@keyframes vol-slide-in/out`). O botão de volume é **preenchido de azul
(accent) com o ícone de mixer/faders em branco** (SVG inline — o ícone não
existe no subset da fonte; ver seção da fonte), visualmente distinto do
mudo. Mexer no volume com mudo ativo desliga o mudo automaticamente. O fader
tem um "botão" (thumb) de 34px (`::-webkit-slider-thumb`), maior que o
padrão do navegador, para facilitar tocar e arrastar. Mutar/desmutar não
corta o volume na hora — faz uma rampa curta (ver `setMute` em `stage.js`).

**Grade também alinha a preview e o transporte:** os dois botões de
navegação de estrofe (`#slidePrevBtn`/`#slideNextBtn`, ver "Letra
sincronizada" abaixo) flanqueiam a preview dentro de `.preview-row` — como
essa linha inteira compartilha a mesma faixa de 130px da grade que
`.mixer-mid`, os três (slide-nav esquerdo, os 3 botões do meio do mixer,
slide-nav direito) ficam com o topo/base exatamente alinhados. O botão de
**repetir** (`#repeat`) é o **primeiro** botão de `.transport` (à esquerda de
⏮ ▶/⏸ ⏹ ⏭, com o de playlist por último à direita) — sendo o primeiro
elemento da linha, seu início (borda esquerda) cai exatamente sob
`#slidePrevBtn` da linha de cima, já que ambas as linhas (`.preview-row` e
`.transport`) começam na mesma coluna da grade.

**Título rolante (now-playing):** o nome da mídia em exibição (`#npName`) tem
um span interno (`#npNameInner`); quando o texto não cabe na largura
disponível, `applyTitleMarquee()` liga a classe `.scrolling` e uma animação
ping-pong (`@keyframes np-marquee`) que rola o título de um lado ao outro para
poder ser lido inteiro (distância e duração calculadas pela medição do
overflow e passadas via `--np-shift`/`--np-dur`). Quando cabe, fica estático e
centralizado (com reticências como fallback). Remedido em cada
`renderNowPlaying()` e no `resize` (debounce).

A preview é um `createStage` com `forceMuted: true` que recebe os mesmos comandos
enviados ao Display (função `cmd()` envia ao canal E aplica na preview). A preview
local comanda a barra de progresso e o avanço automático da playlist. Para itens
YouTube, `cmd()` também dirige um segundo `YT.Player` próprio da preview (mudo,
qualidade mínima) — ver seção do YouTube no Display para os detalhes.

**Tocar na preview** abre o popup de **configurações rápidas de exibição**
(bottom-sheet `#fadePopup`, título "Exibição"): toggles de fade in (entrada) e
fade out (saída/troca) + slider de duração (0.2–5 s), e um seletor de
**preenchimento da mídia** (`#fitSeg` — Ajustar/Preencher/Esticar, ver
`stage.setFit()`). A config de fade é persistida em `state.fade` e a de
preenchimento em `state.fit`; ambas aplicadas ao vivo via comando (`fade`/
`fit`, Display + preview) e recarregadas do state ao inicializar (Controle e
Display).

**Botão ⏹ ("Parar e limpar"):** envia `clear` (volta ao wallpaper) mas mantém
`currentId` — o ▶ recarrega e reproduz do início.

**Botão de playlist (`#plBtn`):** mora na própria linha de transporte
(`.transport`), à direita do botão de repetição — não é mais uma aba
separada (`.tabs`); abre o mesmo bottom-sheet com a fila de reprodução de
sempre. Reaproveita o tamanho/estilo de `.t-btn` (a linha de transporte
cresceu de 5 para 6 botões, cada um um pouco mais estreito). O badge de
contagem (`#plCount`) só aparece a partir do **2º item** (mostra
`count - 1`), e o ícone só fica destacado em azul (`.has-items`) nesse mesmo
caso: com apenas a mídia atual em fila, a playlist é só a reprodução avulsa
e não deve chamar atenção nem com um "1" enganoso nem com o ícone colorido —
fica neutro (branco).

### Feedback (sem alerta flutuante)

Não há mais **toast flutuante**. As informações são transmitidas pela própria
interface (estados de botão, contadores, listas). `flash()`/`dismissFlash()` em
`controle.js` viraram **no-ops** — mantidos só para não mexer nos ~25 pontos de
chamada; qualquer mensagem que antes ia pro toast simplesmente não aparece mais.
O único feedback migrado explicitamente para a UI é a **sincronização do Hinário
2022**: `setHymnalStatus(text, autoClearMs?)` grava um subtítulo (`.hymn-sub`)
na linha do Hinário (`renderHymnalRow`) — "Atualizando lista…", "Baixando N/T…",
"Já completo offline", "Sem internet — falha ao atualizar" etc. `autoClearMs`
limpa mensagens finais/erro sozinho; o progresso fica até a próxima chamada. O
`.toast` do CSS foi removido.

### Deslocamento com o teclado virtual

Para o teclado não cobrir listas/preview: o meta viewport declara
`interactive-widget=resizes-content` (o navegador encolhe o layout ao abrir o
teclado). Como fallback (navegadores que não honram o hint), um handler de
**VisualViewport** (`keyboardShift()` em `controle.js`) mede a altura coberta
pelo teclado (`innerHeight - vv.height - vv.offsetTop`) e escreve em `--kb`, que
`body { height: calc(100svh - var(--kb)) }` (controle.css) usa para encolher o
app pra cima. Quando o layout já é redimensionado pelo navegador (ou o teclado
está fechado), a conta dá ~0 e nada muda — os dois mecanismos convivem.

### Modo "mesa de som" (saída de áudio local)

Botão `#standaloneToggle` no mixer (ícone de **fone de ouvido** — SVG inline,
fora do subset da fonte — reforçando "ouvir o áudio aqui"): liga um modo em que
a **preview do Controle passa a tocar o áudio de verdade pelo próprio
aparelho**, em vez de sempre muda — para quando não há intenção de exibir vídeo,
só tocar música
(ex: o celular do operador ligado direto na mesa de som/caixa de som da
igreja, sem precisar nem abrir o Display).

- **Não mexe em nada da comunicação com o Display** — `cmd()` continua
  enviando todos os comandos normalmente (`AVDB.sendCommand`), exatamente
  como no modo normal. Se o Display estiver aberto, ele continua recebendo e
  reagindo aos comandos como sempre; se não estiver aberto, os comandos
  simplesmente não têm quem escute — o Controle não trata esse caso de forma
  especial, nem precisa saber se o Display está ou não em uso.
- `setStandalone(v)` só alterna a saída de áudio da preview, **com rampa curta**
  (a mesma `MUTE_RAMP_TIME` do mudo, 0,25 s) — ligar/desligar não corta o áudio
  na hora:
  - **Ligar**: `preview.setForceMuted(false)` — a preview deixa de ser sempre
    muda e passa a tocar o volume/mudo real que o operador já tiver ajustado; o
    áudio **sobe em rampa de 0 até o alvo**. Se o item atual for YouTube, o
    player da preview (`ytPreview`) é desmutado e sobe pela mesma rampa
    (`ytPreviewRampVolume`, em paralelo).
  - **Desligar**: o áudio **desce em rampa até 0 e só então muta**
    (`preview.setForceMuted(true)`; para o YouTube, `ytPreviewRampVolume` +
    `player.mute()` ao fim da rampa).
- `stage.js` ganhou `setForceMuted(v)`/`isForceMuted()`: `forceMuted` deixou
  de ser fixado na criação do stage (`const`) e virou alternável em tempo
  real (`let`). A troca faz a mesma rampa do `setMute` (`rampVolume` +
  `MUTE_RAMP_TIME`): ao **desativar**, `forceMuted` só liga no **fim** da rampa
  (senão `rampVolume` abortaria de imediato, pois ignora pedidos com
  `forceMuted` já ligado); ao **ativar**, respeita o mudo do operador. Sem mídia
  tocando, aplica na hora (sem rampa, nada a esmaecer).
- **Não é persistido** — cada abertura do app começa em modo normal (preview
  muda), evitando som inesperado saindo do celular numa sessão nova.

### Abrir o Display a partir do Controle

Botão "Abrir Display" no popup de Exibição (`#openDisplayBtn`): chama
`window.open('../display/', '_blank')`. **Não há garantia** de que isso abra
o Display como app instalado separado — não existe API web para "lançar
outro PWA instalado" de forma confiável; depende do Android reconhecer a
URL como pertencente ao escopo do WebAPK do Display e oferecer abrir nele em
vez de numa aba do Chrome (varia por versão do Android/Chrome — pode só
abrir uma aba comum como fallback).

### Abas e biblioteca

As abas ficam na **base da seção de listas** (ícones):

- **Cronograma** (`imports`) — itens importados; ficam até serem excluídos.
  (O recurso de favoritos foi removido — para agrupar mídias, use pastas
  virtuais via "salvar em pasta" na seleção múltipla.)
- **Pastas** (`folders`) — pastas sincronizadas no OPFS e pastas virtuais
  (agrupam mídias já importadas).
- **Importar** — `<input type="file" multiple accept="image/*,video/*,audio/*">`.

**Navegação persistente:** trocar de aba **não** reseta a pasta aberta nem a
busca — voltar para Pastas retorna exatamente onde estava. A posição de scroll
é guardada por aba/pasta (`scrollPos`, chave `scrollKey()` = aba + id da pasta)
e restaurada ao fim de cada `load()`; `rememberScroll()` é chamado antes de
trocar de aba, abrir pasta ou voltar. (Memória por sessão, em RAM.)

**`load()` tem guarda de sequência** (`loadSeqCtl`, como o `loadSeq` do
stage): é async e disparada fire-and-forget por dezenas de handlers, então
duas chamadas concorrentes poderiam terminar fora de ordem e a mais antiga
sobrescreveria o estado/render da mais nova. `load()` lê tudo do IDB em locais
(as contagens das pastas em `Promise.all`, não mais um `await` sequencial por
pasta a cada micro-mudança) e só aplica ao estado do módulo + renderiza se
`myseq === loadSeqCtl` — senão descarta.

Miniaturas (160×160 px, JPEG 72%) geradas via Canvas no momento da importação.
Vídeos têm thumbnail extraído de um frame perto do início — `min(0,5 s,
duração/3)`, ou seja, 0,5 s para qualquer vídeo acima de ~1,5 s (evita seek
longo/lento; timeout de 3,5 s).
Itens sem blob local exibem badge `URL` ou `YT`.

### Gestos nos itens da biblioteca

| Gesto | Ação |
|---|---|
| Toque simples | **Substitui a playlist por este item** e o exibe no Display |
| Deslize à esquerda | **Adiciona** à playlist (sem substituir) |
| Segurar e arrastar (⠿) | Reordena o item na lista |
| Pressionar e segurar | Entra no modo de seleção múltipla |

**Modo de seleção múltipla:** barra substitui as abas, com contagem e botões de
salvar em pasta, renomear (1 item) e excluir. Os itens selecionados são
indicados **só pelo highlight azul** (`.lib-item.selected` — borda accent), sem
ícone de check; a miniatura fica sempre encostada à esquerda (não há coluna
reservada). Excluir dentro de pasta virtual só remove da pasta; nas demais abas
usa `listRemove` (com gc).

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
    excluído automaticamente. Sem indicador flutuante de progresso (o toast foi
    removido — ver "Feedback / sem alerta flutuante" abaixo); ao terminar, a
    contagem da linha da pasta é re-renderizada com o total atualizado.
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

### Hinário Adventista 2022 (LouvorJA)

Integração com o catálogo público do app **LouvorJA** (`api.louvorja.com.br`,
mesmo backend usado pelo app `app-ja`), para trazer o Hinário Adventista 2022
(módulo `hymnal` do LouvorJA — o de 1996 é `hymnal_1996`, não integrado)
como fonte de mídia offline, sem copiar nenhum código do app-ja (Vue/Vuex) —
só o **protocolo HTTP** dele é reaproveitado, via um cliente próprio e mínimo:
`controle/louvorja.js` (`window.Louvorja`, JS puro, sem dependências).

> 📄 **Referência completa da fonte de dados:**
> [`docs/FONTE-DE-DADOS-LOUVORJA.md`](docs/FONTE-DE-DADOS-LOUVORJA.md) documenta
> **toda** a estrutura técnica classificatória do banco compartilhado (endpoints,
> token, convenção de nomes dos arquivos `json_db` e o schema de cada tipo —
> `music_{id}`, `album_{id}`, listas de músicas/hinários/coletâneas/bíblia,
> `config`, servidor de arquivos). Consulte-o para pedir **qualquer** arquivo do
> sistema sem precisar abrir o repositório do `app-ja`.

- **`Louvorja.fetchList(file)`** — `GET {url-base}/{file}?{YYYYMMDD}` com
  header `Api-Token`, mesmo formato do `Database.js` do app-ja (URL de
  produção + token embutidos no arquivo — já públicos no bundle do app-ja,
  não é um segredo protegido).
- **`Louvorja.fileUrl(path)`** — resolve um campo de URL do banco (ex:
  `url_music`) para a URL completa de download do arquivo.
- Dois tipos de arquivo consumidos: `pt_hymnal` (lista completa e leve dos
  ~600 hinos: `id_music, track, name, duration, has_instrumental_music` — sem
  URLs de mídia) e `music_{id_music}` (registro individual, com
  `url_music`, `url_instrumental_music`, `url_image`).

**Duas camadas, independentes** (`state.hymnal2022`, ver tabela acima):

1. **Índice** (leve, só metadados) — permanece offline assim que sincronizado
   uma vez; é o que alimenta a busca (item 2 abaixo) mesmo antes do download
   pesado terminar.
2. **Download** (pesado) — para cada hino do índice, baixa o áudio Cantado
   (`url_music`) sempre e o Playback/instrumental (`url_instrumental_music`)
   quando existir, mais a capa e as imagens por estrofe (ver "Letra
   sincronizada" abaixo) — grava tudo no **mesmo catálogo OPFS das pastas
   sincronizadas** (`AVDB.fileAdd` + `AVDB.opfsWriteFile`, pasta fixa
   `folders/hymnal-2022/`), então listar, buscar, tocar e excluir dentro dele
   funciona **sem nenhum código novo** — é só mais uma pasta OPFS (ver
   "Pastas" acima), só que a fonte da sincronização é uma API remota em vez
   de `showDirectoryPicker()`.

**UI — cartão informativo, NÃO uma pasta** (`renderHymnalRow()` + `.hymnal-card`
no CSS): no topo da aba **Pastas** aparece um **cartão de "check do sistema"**
do Hinário 2022 (não uma linha de pasta), sempre visível mesmo antes da 1ª
sincronização. Ele **não abre como pasta ao tocar** (o operador acessa/toca os
hinos pela **busca do Hinário**, botão de lupa) — é deliberadamente um painel de
status, não algo navegável como pasta. O cartão mostra: símbolo do hinário
(nota musical, `ICON.music`), título, **linha de status** (progresso de
sincronização via `setHymnalStatus`, ou "✓ Completo offline" em verde quando
`downloaded === total`, ou "Parcial…"/"Não sincronizado"), botão de
**sincronizar** (`syncHymnal2022()`, ícone de setas circulares SVG inline; gira
com `.busy` enquanto sincroniza) e, se já houver algo baixado, botão de
**excluir tudo** (`deleteHymnal2022()`). Abaixo, uma faixa de **estatísticas**
(chips `.hymnal-stat`): **Sincronizados** (`downloaded/total`), **Peso**
(`fmtBytes(hymnalBytes)` — somatório dos `size` do catálogo OPFS via
`updateHymnalBytes`, recalculado sob demanda e cacheado) e **Rede** (Wi-Fi
confirmado × "Aguardando", ícone de Wi-Fi SVG inline — ver `isConfirmedWifi`).
Sincronização é **aditiva e resumível**: interromper e tocar de novo só baixa
o que falta (`fileGet` reconfirma que o arquivo catalogado ainda existe de
fato antes de pular — cobre até exclusões manuais feitas por dentro da
pasta via seleção múltipla).

**Índice sempre em dia, automaticamente** (`fetchHymnalIndex` /
`autoRefreshHymnalIndex`): a lista leve do Hinário 2022 (id/número/nome/
duração/tem-playback — **sem** áudio nenhum) é buscada sozinha, sem esperar
o operador apertar "sincronizar": ao abrir o app (`init()`) e toda vez que o
Controle volta de segundo plano (`visibilitychange`, mesma cadência do check
de versão do service worker) — como é só metadados, é barato o bastante pra
rodar em toda abertura. `autoRefreshHymnalIndex` é **silenciosa**: se não
houver rede no momento, só mantém o índice já em cache da última vez, sem
mostrar erro nenhum ao operador (diferente do botão de sincronizar, que
avisa se falhar). `fetchHymnalIndex` faz o merge preservando
`fileIdFull`/`fileIdPlayback`/`lyrics` já conhecidos de cada hino — usada
tanto por essa atualização automática quanto pela fase 1 da sincronização
completa (`syncHymnal2022`, que só entra na fase pesada depois de chamar a
mesma função). Isso garante que o botão de busca já tenha acesso à lista
**inteira** do que existe no LouvorJA (baixado ou não) assim que o popup é
aberto, independente de já ter sido feita alguma sincronização pesada.

**Botão de busca** (`#hymnSearchBtn`, ícone de lupa — SVG inline, não existe
no subset da fonte — ao lado do "+ Importar" nas abas): abre um popup
(`#hymnSearchPopup`) com campo de busca (por nome ou número do hino) e
resultados do índice já em memória. Diferente dos demais popups (bottom-sheets),
a bandeja da busca do Hinário **desliza a partir do TOPO** (CSS: `#hymnSearchPopup`
com `align-items:flex-start`, `.popup-sheet` com `translateY(-100%)` e cantos
arredondados embaixo) — além de ser o pedido de UX, casa com o teclado, que sobe
da base sem cobrir os resultados. O campo de busca usa `.lib-search`, hoje com
`appearance:none` + supressão das pseudo-partes `::-webkit-search-*` (mata o
visual nativo do `type="search"`, que saía despadronizado dos demais controles).
Resultados vêm do índice já em memória
(`hymnal2022.songs`, filtro em memória, `normalizeForSearch` ignora
acentuação) — funciona sem rede assim que o índice já tiver sido buscado
pelo menos uma vez (ver acima); se o popup estiver aberto no momento em que
o índice atualiza sozinho, a lista de resultados se re-renderiza na hora.
Cada resultado tem dois pares de botão — **▶ Cantado** / **➕** e
**▶ Playback** / **➕** (o segundo só aparece se `has_instrumental_music`) —
tocar substitui a playlist e exibe (mesmo comportamento de toque simples da
biblioteca; baixa o hino na hora se ainda não estiver offline, ver
"Resolução do id de mídia por variante" acima), adicionar entra no
Cronograma (`AVDB.listAdd('imports', id)`).

**Resolução do id de mídia por variante** (`resolveHymnMediaId`) é
**offline-first com download sob demanda**: se a variante já foi baixada
(fase 2 acima), usa o id do catálogo OPFS direto (zero-cópia, mesmo padrão do
botão ➕ das pastas); senão, `ensureHymnDownloaded` baixa o hino **de
verdade** ali mesmo (mesma `downloadHymnalSong` da sincronização em massa —
áudio + capa + letra, pronto pra tocar 100% offline dali em diante), não um
registro temporário/streaming. `hymnDownloadInFlight` (Map por `id_music`,
sessão) evita disparar dois downloads do mesmo hino em paralelo se o
operador tocar/adicionar duas vezes rápido antes do primeiro terminar. Ver
"Wi-Fi vs dados móveis" abaixo para a política de quando cada tipo de
download é permitido.

> **Nota de rede**: a API de produção precisa aceitar CORS para a origin do
> Audio Visual IASD (`https://jonathasptbr-gh.github.io`) — não verificado
> em produção no momento desta implementação (rede da sessão de
> desenvolvimento não tinha acesso a `api.louvorja.com.br` para testar). Se o
> `fetch` falhar por CORS, a sincronização e a busca ao vivo (mas não a busca
> no índice já baixado) param de funcionar.

#### Letra sincronizada (slides + temporizador)

Cada variante baixada (registro em `files`, criado por `downloadHymnalFile`)
ganha campos extras, sem exigir bump de `DB_VERSION` (o `files`/`media` do
`shared/db.js` guarda objetos livres de schema):

- `lyrics`: `Array<{ time, text, auxText, cover, imageOpfsPath, imagePosition }> | null | undefined`
  — sentinela de 3 estados: `undefined` = nunca processado (dispara
  reprocessamento na próxima sincronização, mesmo que o áudio já esteja
  baixado — é o que dá **backfill** aos hinos sincronizados antes desta
  funcionalidade existir, sem rebaixar áudio: `ensureHymnVariant` só
  recalcula e regrava a letra no registro já existente); `null` = já
  processado, mas o hino não tem estrofes com tempo utilizável (não tenta de
  novo à toa); array = primeiro item é sempre o slide de capa (`cover:true`,
  `text:null`, `time:0`, imagem da música), os demais vêm do mapa `lyric` de
  `music_{id}` (filtrados por `show_slide`, tempo do campo certo — `time`
  para Cantado, `instrumental_time` para Playback — convertido pra segundos
  via `parseTimeToSeconds`, ordenados por tempo).
- `hymnName`/`hymnTrack`: título limpo e número do hino (`s.name`/`s.track`,
  sem o prefixo/sufixo que `name` carrega pra exibição na lista) — usados
  pelo Display no slide de capa.

**Quebras de linha vêm da própria API, como `<br>` literal** dentro de
`lyric`/`aux_lyric` (confirmado no app-ja: ele usa `v-html` pra deixar o
navegador interpretar essas tags como quebra real). `buildLyricSlides`
passa `text`/`auxText` por `normalizeLyricText()`, que troca `<br>` (e
variações `<br/>`/`<br />`) por `\n` real — **não** por `innerHTML`/`v-html`
(sem risco de injeção: é só uma troca de string, o resto do texto continua
literal). O CSS (`.lyrics-line`/`.lyrics-aux` no Display,
`.pv-lyrics-line`/`.pv-lyrics-aux` na preview) usa `white-space: pre-line`
para respeitar esse `\n` — sem isso, a quebra pretendida pelo hino se perde
e o navegador quebra a linha sozinho, do jeito errado (ou mostra o `<br>`
literal na tela, já que `textContent` não interpreta HTML).

Imagens por estrofe (`imageOpfsPath`) são baixadas de verdade pro OPFS
(mesma pasta `folders/hymnal-2022/`, `downloadHymnalImage`) — nunca URL
remota direta, preserva o offline. Uma linha sem imagem própria **herda a da
anterior** (fallback "grudento", igual ao app original); imagens iguais
entre linhas/variantes são baixadas uma única vez (`resolveImage`, cache por
URL compartilhado entre Cantado e Playback do mesmo hino, já que costumam
usar as mesmas imagens). Um hino tocado/adicionado antes de qualquer
sincronização em massa passa pelo mesmo `downloadHymnalSong` sob demanda
(ver "Resolução do id de mídia por variante" acima) — já sai dali com letra
sincronizada, igual a um hino baixado em massa.

#### Wi-Fi vs dados móveis

A sincronização em **massa** (`syncHymnal2022`, baixar todos os hinos
pendentes de uma vez) é **gated por Wi-Fi confirmado** (`isConfirmedWifi`,
Network Information API — `navigator.connection.type === 'wifi' || 'ethernet'`;
sem suporte no navegador cai em `'unknown'`, tratado como Wi-Fi **não**
confirmado, postura conservadora). Sem Wi-Fi confirmado, o botão de
sincronizar ainda atualiza a lista leve (metadados, sempre barato), mas
**pula o download pesado** por padrão — um `confirm()` deixa o operador
forçar mesmo assim se quiser gastar dados móveis de propósito. Um indicador
(`.net-badge`, ícone de Wi-Fi inline — fora do subset da fonte) aparece do
lado do botão de sincronizar na linha do Hinário 2022, atualizado ao vivo
(`connection.addEventListener('change', ...)`).

Isso **não afeta** o download individual disparado por tocar/adicionar um
hino específico (`ensureHymnDownloaded`) — esse é sempre permitido,
independente do tipo de rede: é exatamente o hino que o operador pediu pra
usar naquele momento, não um download em massa não solicitado. Na prática,
sem Wi-Fi o hinário vai sendo baixado aos poucos, só com o que de fato for
usado em cada culto, em vez de baixar tudo de uma vez usando dados móveis.

**Display** (`public/display/`): novo layer `#lyrics` (imagem de fundo
`object-fit:cover` + um retângulo central com moldura — `.lyrics-box`: no
padrão visual de "vídeo de louvor" (cantos **retos**, não arredondados;
borda fina e **nítida**, `rgba(255,255,255,.85)`; fundo semitransparente
`rgba(0,0,0,.4)`; sem `box-shadow`), `width`/`height` fixos e margens
(`.lyrics-content`, padding em vh/vw) — a legibilidade do texto vem da
própria moldura, não de um gradiente cobrindo a tela inteira, então
funciona igual independente da imagem por trás), inserido no DOM entre
`#video` e `#youtube`, mesmo `z-index:1` dos demais layers de mídia — a
cortina do wallpaper (`z-index:2`, já existente) cobre/revela esse layer de
graça, **sem nenhuma mudança em `stage.js`** (letra é tratada como camada
paralela, mesmo padrão já usado pela ponte do YouTube). `hideLyrics()` é
chamado incondicionalmente no início do tratamento de `load` (antes do
atalho de YouTube) e em `stop`/`clear` — sem isso, trocar de um hino pra um
vídeo do YouTube não escondia a letra de verdade, só ficava mascarado por
sorte de ordem de pintura no DOM. Depois de `AVDB.getMedia(cmd.mediaId)` (já
existia), se `rec.kind==='audio' && rec.lyrics?.length` → `showLyrics(rec)`.
O avanço de slide reaproveita o `onTime`/`sendStatus()` já existente (sem
timer novo): `updateLyricSlide(t)` acha o último slide cujo `time <= t` e só
mexe no DOM quando o índice muda; a imagem de fundo só é re-resolvida (via
`AVDB.opfsGetFile` + object URL, com guarda de sequência tipo `loadSeq`) se o
`imageOpfsPath` realmente mudou entre um slide e o seguinte. `hymnName`/
`hymnTrack` do item atual ficam guardados à parte (`currentLyricsMeta`, não
só passados como parâmetro do `showLyrics` inicial) — sem isso, o slide de
capa perderia o título ao ser re-renderizado pelo tick de tempo (ex:
operador volta pra estrofe 0 depois de já ter avançado).

**Fundo preto vs. imagens dos slides** (`lyricsBgMode`, state `lyricsBg`,
comando `lyricsbg`): **preto é o padrão** — a imagem de cada slide (baixada
durante a sincronização, ver acima) só é de fato usada como fundo se o
operador ligar o botão `#lyricsBgToggle` no mixer do Controle (ver seção do
Mixer). `applyLyricsImage(slide)` centraliza a decisão: calcula a "chave
efetiva" da imagem (`slide.imageOpfsPath` só se `lyricsBgMode==='image'`,
senão `null`) antes de decidir se resolve/revoga a `object URL` — o resto da
lógica (cache por chave, guarda de sequência) não muda. `setLyricsBgMode(m)`
troca o modo ao vivo e reaplica no slide atual (`applyLyricsImage`) sem
precisar esperar uma troca de estrofe. Persistido em `state.lyricsBg`
(lido no `restore()` do Display e no `load()` do Controle) e propagado ao
vivo pelo comando `lyricsbg` — mesmo padrão de `fade`/`fit`, mas tratado à
parte de `stage.handle()` (letra é camada paralela, não um comando do
stage). A preview aplica o mesmo modo em si mesma via `applyPvLyricsBg()`
(chamado direto em `cmd()`, sem esperar o Display confirmar nada).

**Moldura só no modo imagem**: a borda + fundo semitransparente da caixa
(`.lyrics-box`/`.pv-lyrics-box`) só existem para dar contraste/legibilidade
contra uma imagem de fundo de verdade — no modo preto puro seriam só uma
zona escura flutuando à toa sobre uma tela já preta, sem função nenhuma.
`applyLyricsBgClass()` (Display) / `applyPvLyricsBgClass()` (Controle)
ligam a classe `.imgbg` em `.lyrics-content`/`.pv-lyrics-content` só quando
o modo é `'image'` — `border`/`background` de `.lyrics-box`/`.pv-lyrics-box`
ficam `transparent` por padrão e só ganham cor via
`.lyrics-content.imgbg .lyrics-box`/`.pv-lyrics-content.imgbg .pv-lyrics-box`.
Chamado em `setLyricsBgMode()`/`restore()` (Display) e em
`showPvLyrics()`/`applyPvLyricsBg()` (Controle) — cobre tanto a troca ao
vivo do botão quanto o estado inicial ao abrir um item já com o modo salvo.

**Preview do Controle (mesma visualização, em miniatura)**: a preview
**sempre espelha o telão** — já vale pra imagem/vídeo (via `stage.js`
compartilhado) e pra YouTube (segundo player, ver seção própria); letra
sincronizada segue o mesmo princípio universal do sistema. `#pvLyrics`
dentro de `#preview` reproduz a mesma estrutura visual do Display (fundo +
retângulo com moldura), só que com tamanhos **fixos em px** (não vw/vh, que
aqui seriam relativos à tela toda do celular, não à caixinha pequena da
preview — por isso não dá pra reaproveitar a mesma folha de estilo, embora a
estrutura e a lógica JS sejam praticamente idênticas, no mesmo padrão de
duplicação já usado pela preview do YouTube). `showPvLyrics`/`hidePvLyrics`/
`renderPvLyricSlide`/`updatePvLyricSlide` espelham exatamente as funções do
Display, chamadas nos mesmos pontos: `cmd()` (`load`/`stop`/`clear`, em vez
do tratamento de comando do Display) e `previewTick()` (em vez do
`sendStatus()`). Não existe mais uma legenda de texto solta na
`.nowplaying` (`#npLyric`, removida) — a miniatura visual da preview já
mostra a composição real (fundo + posição do texto), tornando a legenda
redundante.

**Controle**: dois botões de navegação manual de estrofe (`#slidePrevBtn`/
`#slideNextBtn`) flanqueiam a preview (`.preview-row`, preview mantida em
16:9, botões ocupam o espaço horizontal que sobra — e, por compartilharem a
mesma faixa de 130px da grade do `.deck`, ficam com a mesma altura da fatia
`.mixer-mid`, ver seção do Mixer). `stepSlide(delta)` reaproveita o
**comando `seek` já existente** (sem novo tipo no protocolo) — pula pro
`time` do slide vizinho, e tanto o Display quanto a própria preview
sincronizam a letra sozinhos ao reagir ao novo tempo.

**Moldura de tamanho FIXO** (`.lyrics-box`/`.pv-lyrics-box`): a caixa não
cresce/encolhe conforme o texto do slide muda — `width`/`height` fixos (não
`max-width` + altura intrínseca) calculados para caber o pior caso real: as
letras do Hinário 2022 nunca passam de **2 linhas** por estrofe
(`-webkit-line-clamp: 2` em `.lyrics-line`/`.pv-lyrics-line`, tanto no slide
normal quanto no de capa; `.lyrics-aux`/`.pv-lyrics-aux` — rótulo curto de
seção, ex: "Refrão" — fica em **1 linha só**, não 2, o que também mantém a
caixa mais enxuta).

**Redimensionamento por Container Queries (`cq*`), não `vh`/`vw`**:
`.lyrics-content` (Display) e `.pv-lyrics-content` (preview) são
`container-type: size` — tudo dentro deles (moldura, fonte, padding, gap)
usa unidades `cqw`/`cqh`/`cqmin` (relativas ao TAMANHO DO PRÓPRIO
CONTAINER, não ao viewport). Isso resolve dois problemas que a versão
anterior (`vh`/`vw` + pisos/tetos em `rem`/`px`) tinha:
- **Descompasso em telas pequenas**: um piso de fonte em `rem` fixo parava
  de encolher enquanto a caixa (só em `vh`) continuava encolhendo — a fonte
  acabava maior que a caixa, cortando/bugando o texto. Unidades `cq*` puras
  não têm piso/teto absoluto — tudo escala junto, sempre, em qualquer
  tamanho de tela.
- **Fonte grande demais em proporção estreita**: a fonte usa `cqmin` (o
  menor entre a largura e a altura do container — análogo ao `vmin`, mas
  relativo ao container), não `cqh` puro. Só `cqh` cresce com a altura
  mesmo quando a largura é o fator mais apertado (ex: janela redimensionada
  em modo retrato) — a própria linha de texto (não a quebra intencional)
  deixava de caber, consumindo sozinha as 2 linhas do clamp e cortando fora
  a segunda linha (autorizada) inteira. `cqmin` encolhe a fonte junto com a
  dimensão mais apertada, sempre.
- **Padding do container NÃO é percentual**: `.lyrics-content`/
  `.pv-lyrics-content` não têm padding em `cq*` (só
  `padding-bottom: env(safe-area-inset-bottom)` no Display, pela margem de
  gestos) — `.lyrics-box` já é dimensionado como fração desse mesmo
  container (`80cqw`/`36cqh` no Display, `92cqw`/`60cqh` na preview) e o
  espaço que sobra vira margem sozinho via `align-items`/
  `justify-content: center`. Um padding em `cq*` no container encolheria o
  content-box, e a caixa (também em `cq*`, mas relativa a esse content-box
  já menor) ficaria menor que o pretendido — um "encolhimento em dobro"
  (~19% mais estreita que a calibração original) que foi a causa real de um
  regressão só percebida ao testar em tamanhos de tela variados.

**Proporções calibradas por medição em pixel** de um vídeo de louvor de
referência (moldura ~76-80% da largura da tela / ~27-36% da altura; fonte da
letra com cap-height ~8,3% da altura da tela). Valores atuais: `.lyrics-line`
em `8cqmin`, `.lyrics-aux` em `4.2cqmin`, capa em `9.5cqmin`, caixa em
`80cqw`/`36cqh` no Display; na preview (calibrada à parte — sua caixa é
proporcionalmente mais larga, `92cqw`, então a fonte precisa de uma razão
menor pra caber) `.pv-lyrics-line` em `9.3cqmin`, `.pv-lyrics-aux` em
`4.9cqmin`, capa em `10.5cqmin`, caixa em `92cqw`/`60cqh`. `overflow:hidden`
no `.lyrics-box`/`.pv-lyrics-box` junto do `-webkit-line-clamp` em
`.lyrics-line`/`.lyrics-aux` (`.pv-lyrics-line`/`.pv-lyrics-aux` na preview)
são a garantia final: qualquer letra maior que o clamp é cortada com
reticências, nunca estoura a moldura (isso ainda pode acontecer em
proporções extremas, tipo uma janela de teste em modo retrato — o Display é
sempre landscape em produção e a preview é sempre `aspect-ratio:16/9`
travada pela grade, então essa situação não ocorre no uso real).

**Fundo preto sem ícone de "imagem quebrada"**: no modo preto (padrão), a
`<img>` de fundo (`#lyricsImg`/`#pvLyricsImg`) fica **`hidden`** de
propósito, em vez de só sem `src`. Isso sozinho **não bastava**: o seletor
`.lyrics-bg img`/`.pv-lyrics-bg img` (uma classe + um tipo, mais específico
que a regra `[hidden] { display:none }` da folha de estilo padrão do
navegador) vencia e mantinha `display:block` mesmo com o atributo `hidden`
ligado pelo JS — a `<img>` sem `src` continuava renderizando o ícone/borda
padrão de "imagem quebrada" (aparecia como uma linha branca de margem sobre
o preto), no Display e às vezes na preview. A correção precisa de uma regra
própria com especificidade suficiente: `.lyrics-bg img[hidden] { display:
none; }` / `.pv-lyrics-bg img[hidden] { display: none; }`. `.lyrics-bg`/
`.pv-lyrics-bg` têm `background:#000` próprio (preto de verdade,
independente da `<img>`); `applyLyricsImage`/`applyPvLyricsImage` alternam
`hidden` junto com `src` a cada troca de modo/slide.

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

Escuta o BroadcastChannel e repassa os comandos para `stage.handle()` (ou para
a ponte do YouTube). Ao inicializar, **não** recarrega nem toca a última mídia
sozinho — `restore()` só restaura a config de fade (preferência visual) e
envia `display-ready`; o Display abre sempre no wallpaper (ponto inicial),
esperando um comando explícito. A inicialização do sistema precisa ser
**controlada** (nenhuma mídia deve começar a tocar sozinha ao abrir o app) —
quem decide se retoma o que estava tocando é o **Controle**, ao receber
`display-ready` (com base no que ELE sabe que estava tocando, não em algo
persistido pelo próprio Display).

**Toque único ao abrir (`#startBtn`, "Ligar Sistema"):** a área de toque
cobre a tela inteira (z-index acima de tudo, inclusive do wallpaper e do
escudo do YouTube — qualquer toque na tela serve) e some para sempre após o
primeiro toque; um `.start-pill` central (fundo amarelo, cantos arredondados,
sombra) é só a pista visual de "isto é clicável" — sem ele o texto flutuando
no preto não parecia um botão. **Além de ativar o Display, o mesmo gesto abre
o Controle** (`window.open('../controle/', '_blank')` dentro do handler de
clique, para não ser bloqueado como popup) — a contrapartida do botão "Abrir
Display" do Controle. Para o `window.open` conseguir **lançar o WebAPK do
Controle instalado** (em vez de abrir uma aba interna), o Display usa
`display: standalone` no manifest — **não** `fullscreen`: um contexto em
fullscreen prende popups numa Custom Tab dentro do próprio app (por isso o
"Abrir Display" do Controle, que é standalone, já funcionava, mas o inverso
não). (Chegou a existir aqui uma chamada a `requestFullscreen()` + uma trava
de orientação via Screen Orientation API — removida: na prática regrediu o
lançamento do Controle e a tela cheia nunca chegou a engajar de verdade;
ver "Instalar no Android" para o racional completo do que foi tentado e
revertido.) (Ressalva geral: não há API web garantida para lançar outro PWA
instalado — dependendo da versão do Android/Chrome pode cair numa aba comum
como fallback.) Ao tocar, a classe `.confirming` dispara uma
animação rápida (~0,3s: pill cresce levemente e esmaece, fundo vai a
transparente) antes do elemento sumir de fato (`hidden = true` só depois do
`setTimeout` correspondente) — sem esse feedback, o overlay sumia no mesmo
instante do toque e a ação parecia não ter surtido efeito nenhum. Existe
porque autoplay com som em conteúdo de
**terceiros** (o iframe do YouTube) exige um **gesto real do usuário** na
página — diferente da mídia local do stage (mesma origem), que autoplay com
som é liberado automaticamente num PWA instalado (ver abaixo). Esse gesto **não
pode ser simulado via JS** (é assim que o navegador garante que é uma ação
real da pessoa) — por isso o botão, em vez de tentar automatizar. O toque é um
`pointerdown` normal, que já borbulha para o listener de recuperação de áudio
do stage; se um YouTube já tiver sido restaurado (`restore()`) antes do
toque, o clique reaplica mute/volume/play nele imediatamente — mesmo sem
isso, `ytWatchStart()` e a resincronização de mudo em `ytStartTimeLoop()` (ver
seção do YouTube) convergiriam sozinhos em poucos segundos.

**Áudio sem toque (recuperação automática — só mídia local do stage):** ao
contrário do `#startBtn` acima (que existe só por causa do YouTube), mídia
local **não precisa de nenhum toque prévio** — não há overlay de unlock
bloqueante para ela. Se a política de autoplay do navegador bloquear
som sem gesto num vídeo/áudio local, ele **começa mudo** (sempre permitido — o
conteúdo aparece no telão sem toque) e a recuperação automática religa o áudio
em retentativas de ~5 s (`setMute(false)`, detectando se o navegador pausou).
Num **PWA instalado** o navegador costuma liberar autoplay com som — a
primeira retentativa resolve. **Nada é exibido no telão**: o estado vai no
campo `audioBlocked` do `display-status`; no **Controle**, além do toast, o
**botão de mudo do mixer** vira indicador (estado `.blocked`, âmbar pulsante,
ícone de volume off) e **atalho**: o clique envia `audio-retry` (retentativa
imediata) em vez de alternar o mudo. Qualquer gesto real no Display
(toque/tecla — `pointerdown`/`keydown` no documento) religa o áudio na hora. O
comando `mute` do operador encerra a recuperação. **Este mecanismo não se
aplica ao YouTube** — ver seção abaixo.

### YouTube (IFrame Player API oficial)

Ao receber `load` de um item `kind='youtube'` vindo de mídia comum, o Display
esmaece o stage até o **preto** (`stage.fadeOutToBlack()` — nunca a cortina do
wallpaper: é troca de conteúdo, não um stop/clear do operador) e cria um
player usando a **IFrame Player API oficial do YouTube**
(`https://www.youtube.com/iframe_api`, carregada por `loadYtApi()`) em vez de
falar diretamente com o protocolo interno do embed via `postMessage` cru. A
API expõe um objeto `YT.Player` de verdade — eventos garantidos
(`onReady`/`onStateChange`) e métodos reais (`playVideo`, `pauseVideo`,
`seekTo`, `setVolume`, `mute`/`unMute`, `destroy`) — eliminando uma classe
inteira de bugs de timing que a reimplementação manual do protocolo (versão
anterior) sofria.

- **Fetch do script adiantado para a abertura do Display** (`restore()` chama
  `loadYtApi()` sem esperar, antes de enviar `display-ready`): o Cronograma é,
  na prática, sempre usado na sessão em curso, então esse fetch de rede vai
  acontecer de qualquer forma — adiantá-lo tira essa etapa do caminho crítico
  do primeiro vídeo do YouTube tocado (que antes só disparava o fetch no
  próprio `loadYoutube()`). `loadYtApi()` é idempotente e cacheia a promise
  (`ytApiPromise`), então chamadas seguintes em `loadYoutube()` reaproveitam
  o mesmo carregamento sem custo extra. **Não cria nenhum player** — só busca
  o script; não viola a regra de "nenhuma mídia inicia sozinha ao abrir".
  - **Pré-carregar os próprios vídeos (criar players com antecedência) foi
    descartado**: o Cronograma não é a fila de reprodução real (isso é a
    `playlist`, cuja ordem só é previsível em `repeat='all'`/`'one'` — em
    `'shuffle'` ou uso ad-hoc não há "próximo" confiável), e manter múltiplos
    `YT.Player` vivos ao mesmo tempo consome memória/CPU/rede em paralelo no
    mesmo aparelho que já faz o Miracast — risco maior que o ganho, já que o
    `cueVideoById()` tende a só buscar metadados (não bufferizar vídeo de
    verdade) antes do play de qualquer forma.

- **`#youtube` é só um wrapper** (`<div class="layer yt-frame" hidden>`); a
  API cria o `<iframe>` real **dentro** dele a cada vídeo, via um elemento
  host descartável (`createYtHost()` — id incremental `yt-host-N`). O CSS
  (`.yt-frame iframe { width/height:100% }`) estiliza qualquer iframe filho,
  então o wrapper nunca precisa conhecer detalhes do iframe da API.
- **UI mínima**: `playerVars` pede `controls:0`, `disablekb:1`, `fs:0`,
  `iv_load_policy:3`, `rel:0` — sem barra de controles, teclado, fullscreen,
  anotações ou vídeos relacionados ao final. O wrapper tem
  `pointer-events:none` (CSS) — toque/hover no telão nunca invoca overlays;
  todo o transporte vem do Controle. `allow="autoplay; fullscreen;
  encrypted-media; picture-in-picture"` é aplicado programaticamente no
  iframe (`getIframe().setAttribute('allow', …)`, logo após criar o player e
  de novo em `onPlayerReady`), já que a API não garante esse atributo por
  conta própria. Usa a sessão logada do navegador (mesmo domínio
  `youtube.com`) — conta **Premium** é detectada automaticamente (sem
  anúncios).
  - **Truque de escala para minimizar a marca do YouTube** (`.yt-frame
    iframe` em `display.css`, mesmo em `.pv-yt-frame` do Controle — ver
    seção da preview): o que sobra de UI própria do YouTube (logo, botão de
    play do estado "cued", spinner de buffering) tem um piso de tamanho que
    não é exposto por `playerVars` — não escala pra baixo conforme o iframe
    encolhe. O iframe é renderizado a **400% do wrapper**
    (`width/height:400%`, centralizado) e depois encolhido de volta com
    `transform: scale(.25)`: como o CSS transform só afeta a composição
    final (não o layout interno que o iframe usa pra decidir o tamanho da
    própria UI), o iframe "pensa" que está com 4x o tamanho — bem dentro da
    faixa onde essa UI fica proporcional ao vídeo — e só depois a imagem já
    pronta (vídeo + UI) é encolhida de volta pra caber no wrapper. Aplicado
    tanto no Display (já em tela cheia — aqui o objetivo é minimizar ainda
    mais a marca, não corrigir desproporção) quanto na preview do Controle
    (onde a caixa é bem menor que o mínimo recomendado pelo YouTube — 480×270
    pra 16:9 — e por isso a UI ficava visivelmente grande demais antes desse
    truque).
- **Reveal do wrapper independe da view**: o wrapper (`ytShow()`) fica oculto
  só até o primeiro estado `PLAYING` (1) — os estados de carregamento/cued
  mostram título e botão grande, que nunca chegam ao telão (safety: revela às
  cegas em 5 s se nenhum evento tiver chegado ainda). Quem decide se isso
  aparece de fato na tela é a **cortina compartilhada do wallpaper**
  (`stage.coverIn()`/`coverOut()` — ver "Modelo de camadas" na seção do
  motor de renderização), não o wrapper: ao entrar no estado `PLAYING`,
  `onPlayerStateChange()` chama `stage.coverOut()` **só se** `yt.view` for
  `'visual'`; se for `'wallpaper'`, o wrapper já revelado continua tocando
  (com áudio) por baixo da cortina, e `ytSetView('visual')` (chamado depois,
  quando o operador desligar o wallpaper) só precisa abrir a cortina — o vídeo
  já está pronto e visível por baixo. Antes dessa separação, o wrapper só se
  revelava se `view==='visual'` no momento do `PLAYING`; um vídeo que
  começasse com o wallpaper ligado nunca satisfazia essa condição e ficava
  preso atrás do wallpaper para sempre (o áudio tocava normalmente, só o
  vídeo nunca aparecia ao desligar o wallpaper depois).
- **Fim do vídeo** (estado `ENDED`, 0): `ytShield(true)` cobre instantaneamente
  a tela final de "vídeos relacionados" e `stage.instantCover(true)` garante
  o wallpaper já pronto (opaco) por baixo do escudo. Se nenhum `load` de
  avanço automático chegar em ~400 ms, o Display **derruba o player**
  (`destroy()`) e o escudo esmaece (`ytFadeOutPlayer()`), revelando o
  wallpaper já coberto — sem o escudo, o wallpaper (agora por cima de tudo)
  ficaria escondido atrás da tela de "vídeos relacionados" em vez de cobri-la;
  o `#ytShield` por isso tem z-index **acima** do wallpaper. O Controle marca
  `ytEnded` e o ▶ recarrega o item (novo `load`).
- **Pausa e seek seguem o padrão de player normal**: quadro congelado no
  telão; a UI que o YouTube desenhar nesses estados é aceita (sem tela preta).
  `stop`/`clear`/troca **não pausam** o player antes do fade (pausa desenharia
  UI): o fade-out visual corre com **rampa de volume** via `setVolume`
  (`ytRampVolume`) e o player é derrubado ao final.
- **Stop/clear manual com fade out ativo**: o player do Display continua tocando
  (estado `PLAYING`) durante toda a rampa de volume do fade-out. `stopYoutube()`
  marca `yt.stopping=true` e limpa `yt.timeLoop` **antes** de aguardar o fade, e
  `ytStatus()` não envia `display-status` enquanto esse flag estiver ativo —
  evita reportar `playing:true` no meio do stop. No Controle, `stopClear()` marca
  `ytEnded=true` para itens `kind==='youtube'`, garantindo que o próximo ▶ chame
  `send(currentId)` (recarga completa) em vez do `cmd({type:'play'})` genérico
  (no-op sem player vivo). A antiga corrida do `ytStopping` (um `display-status`
  atrasado em trânsito reportando `playing:true` e desfazendo o `ytEnded`,
  exigindo apertar stop duas vezes) foi resolvida de outra forma: o
  `display-status` só zera `ytEnded` junto com um `playing` fresco do item atual
  e o `stopClear()` não é mais desfeito por status em trânsito da mesma forma —
  a flag `ytStopping` foi removida (ver a seção de sincronização da preview do
  YouTube para o modelo Display-como-fonte/preview-fallback).
- **Status e progresso**: ao contrário do protocolo antigo (que empurrava
  `infoDelivery` continuamente), a API oficial só notifica em transições
  discretas de estado — por isso `ytStartTimeLoop()` faz um polling leve
  (a cada 500 ms, via `getCurrentTime()`/`getDuration()`/`getPlayerState()`)
  enquanto o player existir, alimentando `display-status` para a barra de
  progresso do Controle.
- **Recuperação de mudo via fato real, não heurística de tempo**: autoplay com
  som em conteúdo de terceiros exige um gesto do usuário na página (ver
  `#startBtn` acima) — antes desse gesto, o player pode ignorar o `unMute()`
  inicial e ficar mudo mesmo com `yt.muted===false` (intenção do operador é
  som). Diferente da antiga tentativa (removida por gerar falsos positivos:
  media unstarted/cued por tempo demais **não prova** bloqueio, só pode ser
  buffering lento), `ytStartTimeLoop()` (a cada 500 ms) chama
  `player.isMuted()` — um **fato real** relatado pelo player agora, não uma
  suposição — e só reage (reenvia `unMute()` + `setVolume()`) quando isso
  realmente diverge da intenção. Converge assim que a página tiver um gesto
  real: o toque em `#startBtn` (se ainda visível) resolve na hora; sem ele,
  o próprio polling resolve em até ~500 ms depois do primeiro gesto (toque,
  tecla) em qualquer lugar do Display. `onPlayerReady()` ainda faz a
  tentativa inicial de `mute`/`unMute` + `setVolume` + `playVideo` uma vez,
  conforme `yt.muted`, e nunca muta o vídeo por conta própria (fora dessa
  resincronização). `loadYoutube()` encerra qualquer recuperação de áudio do
  **stage** que tenha ficado presa (`endAudioRecovery()`) — sem isso, um
  bloqueio de um vídeo local anterior ficava "grudado" e o indicador de mudo
  do mixer aparecia aceso durante o YouTube sem motivo real.
- **Preto (não wallpaper) enquanto o vídeo carrega**: `loadYoutube()` calcula
  a view desejada (`desiredView`) antes de decidir a cortina —
  `stage.instantCover(desiredView === 'wallpaper')`. Carregar um vídeo do
  YouTube depende de rede e é bem mais lento que mídia local; cobrir com o
  wallpaper **de propósito** (`view='wallpaper'`) continua correto, mas usar
  o wallpaper só porque o vídeo ainda não carregou (`view='visual'`) fazia a
  marca aparecer por vários segundos a cada troca, parecendo que o sistema
  tinha parado em vez de só carregando — por isso, nesse caso, a cortina fica
  fora (preto simples, nada cobrindo) até o vídeo entrar em `PLAYING` e
  `ytShow()`/`stage.coverOut()` revelarem-no.
- **Início garantido sem mexer no mudo**: o primeiro `playVideo()` (em
  `onPlayerReady()`) pode chegar antes do player interno aceitar o comando e
  o vídeo fica parado em unstarted/cued. `ytWatchStart()` reenvia
  `playVideo()` a cada ~2 s (até 4 tentativas) enquanto o estado não avança
  para playing/paused/buffering — sem tocar em mute/volume, só um empurrão
  para o play pegar.
- **Host novo a cada troca (`ytDrop()`)**: em vez de só trocar o `src` de um
  iframe fixo (abordagem antiga, que mantinha o mesmo `contentWindow` entre
  vídeos), cada `loadYoutube()` cria um elemento host novo e a API instancia
  um `<iframe>` novo dentro dele; `ytDrop()` chama `player.destroy()` e limpa
  o wrapper (`innerHTML = ''`). Isso garante que uma mensagem do player
  anterior ainda em trânsito nunca seja confundida com o estado do vídeo
  novo (causa de reinícios/travamentos esporádicos na versão com
  `postMessage` manual) — cada instância de `YT.Player` só entrega eventos
  para os callbacks fechados sobre ela mesma (`if (yt === cur) …`).
- **Transições**: com fade ativo, o reveal do **wrapper** no estado `PLAYING`
  usa fade próprio (opacidade do wrapper); a cortina do wallpaper (se
  aplicável) usa sua própria transição via `stage.coverOut()`/`coverIn()` —
  as duas são independentes. `stop`/`clear`/troca esmaecem o player antes de
  derrubá-lo. `ytSeq` guarda operações assíncronas obsoletas (equivalente ao
  `loadSeq` do stage) — inclusive o carregamento assíncrono da própria API
  (`loadYtApi()`) na primeira vez.
  - **Cancelar um `loadYoutube` em curso quando `yt` ainda é `null`:**
    `loadYoutube()` fica entre `await`s (o `fadeOutToBlack`, que pode durar
    `fadeTime` até 5 s, e o `loadYtApi()`) antes de atribuir `yt`. Um
    `stop`/`clear`/`load` de mídia comum que chegue nessa janela **bumpa
    `ytSeq`** mesmo com `yt` nulo (`if (yt) stopYoutube(); else ++ytSeq;` no
    stop/clear; o `else { ++ytSeq; ytDrop(); }` no load comum) — assim o
    `if (seq !== ytSeq) return` do `loadYoutube` em curso o descarta. Sem isso,
    o player nasceria por cima do novo estado (vídeo tocando depois de um stop,
    ou por cima da mídia comum que entrou) alguns segundos depois. Se falhar o
    `loadYtApi()` (rede), o `try/catch` aborta o load em vez de pendurar.
- **No Controle, a preview do YouTube é um SEGUNDO `YT.Player` independente**
  (`controle.js`: `loadYtPreview()`/`ytPreviewHandle()`/`dropYtPreview()`),
  não uma captura do que está no Display — inevitável, já que o iframe do
  YouTube é cross-origin e não pode ser espelhado por `captureStream()`/canvas
  (bloqueado pela mesma-origin policy), e a Screen Capture API
  (`getDisplayMedia()`) não é confiável no Chrome Android, que é onde o
  Display sempre roda. O player da preview:
  - Vive dentro de `#pvYoutube` (wrapper `.pv-layer` no `#preview`, mesmo
    padrão do `#youtube` do Display: a API cria o `<iframe>` real dentro
    dele). `stage.js` continua tratando `kind='youtube'` só como thumbnail
    (`img.src = rec.thumb`) — `preview.handle()` roda normalmente em paralelo
    (mantém `preview.getCurrent()` em dia, usado pela lógica de play/pause do
    botão de transporte) e serve de placeholder visual até o player real
    assumir por cima (mesmo z-index, depois no DOM).
  - **Sempre mudo** (`mute:1` no `playerVars` + `player.mute()` em
    `onReady`) e pede a **menor qualidade disponível**
    (`setPlaybackQuality('tiny')`) — reforçada em três pontos:
    `onReady`, `onPlaybackQualityChange` (o YouTube pode ignorar o pedido
    inicial) e um **polling a cada 1,5s** enquanto o player existir
    (`ytPreviewForceLowQuality`, limpo por `dropYtPreview()`). O polling
    existe especificamente por causa do truque de escala da UI (acima): como
    o iframe agora é renderizado a 400% do wrapper — bem maior do que o
    tamanho visual de ~130px de altura —, o YouTube decide a qualidade
    padrão pelo tamanho QUE ELE enxerga (400%), então sem reforço contínuo
    esse truque puramente visual poderia silenciosamente puxar uma
    qualidade mais alta (e mais consumo de rede) do que antes dele existir.
  - **Independente do player do Display** (não é o mesmo vídeo "espelhado"
    frame a frame): os dois recebem os mesmos comandos (`cmd()` despacha para
    `AVDB.sendCommand` E para a preview) e por isso tocam/pausam/buscam em
    paralelo, mas cada um busca o stream por conta própria — pequenas
    diferenças de buffering entre os dois são esperadas e não indicam
    problema real no Display.
  - **Custo consciente**: dois players do YouTube tocando ao mesmo tempo (um
    no aparelho do Display, outro no celular do operador) dobram o consumo de
    rede/bateria do celular durante toda a sessão — troca deliberada para
    ganhar a preview de verdade; a qualidade "tiny" existe justamente para
    reduzir esse custo o quanto der.
  - `dropYtPreview()` (`player.destroy()` + limpa `#pvYoutube`) roda em
    `stop`/`clear` e ao trocar para outro item (YouTube ou mídia comum) —
    mesmo padrão de "host novo a cada troca" do Display (`ytDrop()`), evita
    que uma mensagem do player anterior seja confundida com a do novo.
  - Comandos `play`/`pause`/`seek` vão para o player real
    (`ytPreviewHandle()`); `mute`/`volume` nunca chegam até ele (a preview é
    sempre muda, como já era pra mídia local); `fade`/`view` continuam
    indo para `preview.handle()` sempre — é a mesma cortina do wallpaper
    compartilhada com a mídia local, e `stage.js` só pula a revelação
    automática no fim de `load()` para `kind='youtube'` (retorna cedo, só
    marca a thumbnail) — por isso `cmd()` chama
    `preview.instantCover(view === 'wallpaper')` à parte em `loadYtPreview()`,
    igual o Display faz para o player real.
  - **Sincronização do play/pause, progresso e avanço dos itens YouTube: o
    DISPLAY é a fonte de verdade quando presente; a preview é o fallback.** O
    player do Display (a projeção real) manda enquanto envia `display-status`;
    se ele não existir / estiver estrangulado ou fechado (nenhum status há mais
    de `DISPLAY_TIMEOUT`=2,5 s → `ytDisplayActive()` falso), a preview local
    assume. Isso resolve os dois casos opostos:
    - **Controle em 1º plano, Display em 2º** (Display espelhado/estrangulado):
      o status remoto rareia → `ytDisplayActive()` falso → a preview (na tela
      do operador, nunca estrangulada) dirige o ▶/⏸ e o progresso.
    - **Controle minimizado, Display tocando**: a preview é que fica
      estrangulada; o Display segue enviando status → dirige a UI e, via
      `ytResyncPreviewToDisplay()`, **re-alinha a preview** (casa play/pause e,
      se o tempo divergir mais que `SYNC_DRIFT`=1,6 s, busca o instante do
      Display) — sem isso a preview voltava dessincronizada da projeção.
    Mecanismo: `displayStatusAt` marca o último status do item atual
    (`send()` zera para a preview dirigir até o Display confirmar o item novo);
    o player da preview expõe `onStateChange` (▶/⏸ na hora) e um polling de
    500 ms (`ytPreviewTick`) para o progresso — **ambos retornam cedo quando
    `ytDisplayActive()`** (só agem na ausência do Display); o fim natural
    (`ENDED`) dispara `autoAdvance()` só quando a preview é a fonte, senão é o
    `media-ended` remoto que avança. `ytResyncPreviewToDisplay()` não busca em
    "mesa de som" (evita salto audível), só casa play/pause.

**O mesmo princípio vale para mídia comum (áudio/vídeo do `stage.js`), não só
YouTube** — `displayStatusAt`/`DISPLAY_TIMEOUT`/`SYNC_DRIFT` são
compartilhados entre os dois casos (`displayActive()` genérico, sem checar o
`kind`); o que muda é só qual player é re-alinhado: `resyncPreviewToDisplay()`
faz o equivalente de `ytResyncPreviewToDisplay()` pro stage local (`preview`)
— casa play/pause e corrige o tempo via `preview.seek()` se o drift passar de
`SYNC_DRIFT`, também sem buscar em "mesa de som". Isso existe porque o
Display e a preview são **dois decodificadores de áudio/vídeo independentes**
(dois elementos `<audio>`/`<video>` distintos, um em cada app) — mesmo
recebendo o mesmo comando `load` no mesmo instante, cada um tem sua própria
latência de buffering, e o `currentTime` dos dois diverge aos poucos; sem
essa correção periódica, a letra sincronizada (baseada em fronteiras de
tempo) acaba trocando de slide em momentos ligeiramente diferentes no
Display e na preview. `previewTick()` (o `onTime` local do stage da preview)
retorna cedo sempre que `displayActive()` — nesse caso é o handler de
`display-status` em `AVDB.onCommand` que atualiza a UI/letra a partir do
tempo reportado pelo Display (`lastDisplayTime`). `stepSlide()`/
`renderSlideNav()` (navegação manual de estrofe) usam `authoritativeTime()` —
não `preview.getTime()` direto — para calcular o slide atual a partir da
posição "oficial" (a do Display quando ele for a fonte, senão a da própria
preview); sem isso, "estrofe anterior/próxima" calcularia a partir de um
tempo local já desatualizado em relação ao que está de fato no telão.

O **avanço automático de fim de faixa** segue o mesmo princípio: o `onEnded`
do stage da preview também **retorna cedo quando `displayActive()`** — quando
o Display está presente, quem avança é só o `media-ended` remoto (com guarda
de `mediaId`). Sem esse early-return, se o Display chegasse ao fim antes da
preview (drift até `SYNC_DRIFT`), os dois disparariam `autoAdvance()` e uma
faixa seria pulada. É o mesmo padrão de `previewTick`/`ytPreviewTick` aplicado
ao fim natural.

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
outro app. Os dois SWs chamam `skipWaiting()` na instalação e `clients.claim()`
na ativação — o SW novo assume na hora.

### Auto-atualização (recarrega para a versão nova)

Como os apps rodam sempre como PWA instalado (o operador costuma **retomar** do
segundo plano em vez de relançar), cada página busca versões novas por conta
própria: ao carregar e em cada `visibilitychange` visível, chama
`registration.update()`. Quando um SW novo assume o controle (evento
`controllerchange`), a página **recarrega** para exibir a versão nova (guarda
`hadController` evita recarregar na primeira instalação; flag `refreshing` evita
loop). No **Controle** o reload é imediato (não afeta a projeção — o Display é
outro app). No **Display** o reload é **adiado enquanto há mídia em cena**
(`!yt && !stage.isPlaying() && !stage.getCurrent()`) para nunca piscar/
interromper a projeção ao vivo — recarrega só quando volta ao wallpaper (idle),
reavaliando a cada 3 s. Observação: como o auto-atualizador vive no JS da
página (cacheado pelo SW), a **primeira** vez que ele passa a existir exige um
relançamento manual; a partir daí as atualizações chegam sozinhas.

Além do cache, o SW do **Controle** trata o POST em `share-target` → grava
`pending-share` no IDB e redireciona `303 ./` (Web Share Target).

**Ao alterar qualquer asset estático, usar o mesmo número da versão visual do Controle nos dois sw.js.**
Ex: se a versão visual é `v2.6`, os caches ficam `controle-v2.6` e `display-v2.6`.

---

## Design System (padrões visuais / CSS)

Toda a UI segue um conjunto fixo de **tokens** (variáveis CSS em `:root`) — a
fonte única de verdade para cor, superfície, raio e feedback de toque. **Regra:
não usar valor literal solto na folha; sempre referenciar um token.** Isso
existe porque o projeto acumulou muitas alterações estéticas pontuais (cores e
medidas repetidas à mão), que foram consolidadas nestes padrões.

### Onde ficam os tokens

- **`controle/controle.css`** — `:root` completo (o Controle tem toda a UI rica).
- **`display/display.css`** — `:root` **mínimo**, só com os tokens de **marca**
  compartilhados (o Display é só wallpaper + mídia, sem componentes de UI).

> ⚠️ **Não há CSS compartilhado entre os dois apps** (nenhuma folha comum). Os
> tokens de marca abaixo estão **duplicados** nas duas folhas e precisam ser
> mantidos **idênticos manualmente**. Ao mudar um deles, mudar nos dois
> arquivos: `--gold`, `--wallpaper`, `--lyrics-frame-bg`, `--lyrics-frame-border`.

### Tokens

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0a0a0a` | fundo do app |
| `--panel` / `--panel-2` | `#161616` / `#202020` | painéis / item ativo/selecionado |
| `--bar` | `#111111` | appbar / bottombar |
| `--line` | `#1e1e1e` | **todas** as bordas/separadores escuros (unifica os antigos `#1e1e1e/#222/#242424/#333`) |
| `--surface` | `rgba(255,255,255,.06)` | fundo padrão de botão/controle |
| `--surface-2` | `rgba(255,255,255,.07)` | chip/campo/badge levemente mais claro |
| `--text` / `--muted` | `#eaeaea` / `#777777` | texto / texto secundário |
| `--accent` | `#2f81f7` | **marca primária** (azul): ativo, foco, destaque |
| `--accent-soft` | `rgba(47,129,247,.18)` | fundo suave de estado ativo (accent) |
| `--gold` 🔁 | `#fbc02d` | **marca secundária** (dourado "IASD"): logo, capa da letra, pill "Ligar Sistema" |
| `--gold-soft` | `rgba(251,192,45,.18)` | fundo do estado "áudio bloqueado" (âmbar) |
| `--gold-text` | `#ffe082` | texto do estado "áudio bloqueado" |
| `--danger` | `#e53935` | perigo (excluir, mudo, view bloqueada) |
| `--danger-soft` | `rgba(229,57,53,.22)` | fundo suave de perigo |
| `--danger-text` | `#ffcdd2` | texto sobre fundo de perigo |
| `--success` | `#66bb6a` | sucesso / "check do sistema" (cartão do Hinário completo offline) |
| `--success-soft` | `rgba(102,187,106,.18)` | fundo suave de sucesso |
| `--radius-btn` | `8px` | raio de **botões/controles** (unifica os antigos 7/8/9px) |
| `--radius-card` | `10px` | raio de **cartões/painéis** (preview, itens de lista, popups internos, folhas) |
| `--radius-pill` | `999px` | badges, chips, pills |
| `--wallpaper` 🔁 | `radial-gradient(circle at 50% 35%, #14331f, #0a1a10, #050b07)` | cortina do wallpaper (Display + preview) |
| `--lyrics-frame-bg` 🔁 | `rgba(0,0,0,.4)` | fundo da moldura da letra (modo imagem) |
| `--lyrics-frame-border` 🔁 | `rgba(255,255,255,.85)` | borda da moldura da letra (modo imagem) |
| `--press` | `scale(.96)` | **feedback de toque padrão**: todo `:active` usa `transform: var(--press)` |

🔁 = token de marca, duplicado em `display.css` — manter em sync.

### Métodos/convenções visuais padronizados

- **Feedback de toque:** todo elemento interativo usa
  `:active { transform: var(--press); }` (antes havia `scale(.95/.96/.97/.98)`
  misturados — unificados em `.96`).
- **Realce de toque:** `-webkit-tap-highlight-color: transparent` e
  `user-select: none` ficam **só no seletor `*`** (topo da folha) — **não
  repetir** por elemento (era redundante em ~12 regras, removido).
- **Exceção de seleção de texto:** só `input, textarea` no Controle (o campo de
  busca precisa ser editável) — ver "Regras de desenvolvimento".
- **Cantos:** botões/controles = `--radius-btn`; contêineres = `--radius-card`;
  pills/badges = `--radius-pill`. Casos especiais fora do sistema (intencionais):
  `border-radius:0` da moldura da letra ("vídeo de louvor", cantos retos), `50%`
  do thumb do fader, `18px 18px 0 0` das bottom-sheets, `4px` do `.url-badge`.
- **Cores fora do sistema (intencionais):** `#fff` puro em texto de botão, `#000`
  em fundos de mídia/preview e o `box-shadow` dourado do `.start-pill`
  (`rgba(251,192,45,.35)`, alfa próprio) — são one-offs deliberados, não
  candidatos a token.

### Ao adicionar/alterar estilo

1. Existe token pro valor? Use-o. Não existe e o valor se repete? **Crie um token**.
2. Cor/medida de marca nova → adicionar **nos dois** `:root` (Controle + Display) e marcar 🔁 nesta tabela.
3. Botão novo → `:active { transform: var(--press); }` e nada de tap-highlight próprio.
4. Atualizar esta tabela e bumpar a versão visual + caches dos SW.

---

## Fonte de ícones (Material Symbols)

Versão subconjuntada (~3.2 KB woff2): peso 400, 30 glifos no subset (26
efetivamente usados na UI — referenciados por codepoint via o mapa `ICON` em
`controle.js` **ou** direto como entidade HTML `&#x…;` no `controle/index.html`).
**Só o Controle carrega a fonte** — o Display é só wallpaper + mídia, sem
nenhum glifo (por isso `display/index.html` e `display/sw.js` não incluem
`material-symbols.css`/`.woff2`).

**Codepoints no subset:**
```
E034 E037 E03B E03D E040 E041 E043 E044 E045 E047
E04F E050 E14C E150 E251 E2C7 E2C8 E2CC E3A1 E3AD
E413 E5C4 E5CF E838 E86C E872 E8F5 E945 EB80 F116
```

`E5CF` (expand_more), `E8F5` (visibility_off), `E86C` (check_circle — antigo
ícone de seleção múltipla, agora só highlight azul) e `E838` (star — antigo
ícone de favorito, recurso removido) continuam no woff2 mas não têm mais
referência (glifos reservados) — podem sair num próximo re-subset.

Para adicionar ícone: obter codepoint em `fonts.google.com/icons?icon.style=Rounded`
e gerar novo subset com `fontTools`.

**Ícones fora do subset → SVG inline.** Quando um ícone necessário não está no
subset e re-gerar o woff2 não vale a pena (ou o ambiente não tem `fontTools`),
usa-se um `<svg>` inline direto no HTML, com `fill/stroke: currentColor` (herda
a cor do botão). Hoje: o botão de **volume** do mixer (`#volToggle`, ícone de
faders/mixer), a **lupa** da busca do Hinário (`#hymnSearchBtn`), a antena de
**Wi-Fi** da linha do Hinário (`wifiIconEl`), o **fone de ouvido** da mesa de
som (`#standaloneToggle`), a **flor** do fundo da letra (`#lyricsBgToggle`) e o
ícone **"arquivos+"** (documento com `+`) do botão de importar da aba
(`.tab-add` do `#file`), que diferencia importar ARQUIVOS de sincronizar PASTA,
e no **cartão do Hinário 2022** as **setas circulares** de sincronizar
(`syncIconSvg`) e o **check** verde de "completo offline" (`checkIconSvg`).

> **Borda nativa dos `<button>`**: `.tab-add` (e os botões do cartão do Hinário)
> zeram `border`/`appearance` explicitamente — sem isso, um `<button>` (ex.:
> `#hymnSearchBtn`) herda a **borda 3D bicolor (bevel)** do sistema, fora do
> padrão do app. O mesmo motivo do `appearance:none` no `.lib-search`
> (`type="search"`).

---

## Deploy e CI

Push em `main` → GitHub Actions (`.github/workflows/deploy.yml`) publica `public/`
no GitHub Pages.

**URL de produção:** `https://jonathasptbr-gh.github.io/Audio-Visual-IASD/`

**Retentativa automática do deploy:** o backend do GitHub Pages falha de forma
intermitente com "Deployment failed, try again later" (problema conhecido e
em aberto do lado do GitHub — ver [actions/deploy-pages#406](https://github.com/actions/deploy-pages/issues/406)
e [#418](https://github.com/actions/deploy-pages/issues/418) — não é causado
pelo nosso workflow nem pelo aviso de depreciação do Node 20→24 que aparece em
toda run, sucesso ou falha). `deploy-pages@v4` não tem retentativa própria
para esse status "failed" definitivo (`error_count` só cobre erros
transitórios de rede durante o polling de status). O workflow repete a mesma
action oficial até **3 vezes** (com um `sleep 15` entre tentativas) antes de
desistir de vez — sem isso, cada falha exigia redisparo manual
(`workflow_dispatch`).

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

> Instalar o Display como PWA também libera o autoplay **com som** na maioria
> dos casos (política de mídia do Chrome para apps instalados) — sem precisar
> tocar na tela. Se o navegador ainda bloquear, o vídeo começa mudo e o áudio
> é religado automaticamente (aviso discreto na base da tela enquanto isso).

**Ícones em PNG são obrigatórios para o Android reconhecer o app como
instalado de verdade** (WebAPK) — com ícones só em SVG, o gerador de WebAPK do
Chrome falha silenciosamente em alguns casos e o Android volta ao modo
"atalho" (o app abre dentro do Chrome de fato, e por isso aparece com o ícone
do Chrome — não o próprio — na tela dividida e na lista de apps recentes; era
esse o sintoma do Display antes desta correção). Por isso `manifest.json` dos
dois apps lista os ícones **PNG primeiro** (`icon-192.png`/`icon-512.png`,
`purpose: "any"`) e as versões SVG depois, como opção extra — os PNGs foram
gerados a partir dos SVGs existentes (mesmo desenho, só rasterizado) e também
precisam ser adicionados à lista `ASSETS` do `sw.js` correspondente para
entrarem no cache offline.

**Ícones `maskable` com margem de segurança** (`icon-maskable-192.png`/
`icon-maskable-512.png`, `purpose: "maskable"`): o Android pode recortar um
ícone maskable em formatos adaptativos (círculo, esquadria…), então o conteúdo
importante precisa caber dentro de uma "safe zone" central (~66% do canvas) —
usar o mesmo desenho de `icon-512.svg`/`icon-192.svg` sem essa margem faz o
conteúdo ficar cortado nas bordas em alguns launchers. Os arquivos
`icon-maskable-*` reaproveitam o mesmo desenho, mas com um `<g transform="…
scale(0.72)…">` encolhendo o conteúdo em torno do centro e um fundo liso sem
cantos arredondados próprios (a máscara do SO já aplica a forma) — gerados a
partir de `icon-maskable-*.svg` (fonte) via rasterização.

**Se `Display → Controle` abrir só uma aba interna (não o app instalado)
mesmo com os dois PWAs instalados corretamente:** verificar se o Display está
com `display: standalone` no manifest (não `fullscreen` — um contexto
fullscreen prende `window.open` numa Custom Tab dentro do próprio app, mesmo
que o alvo esteja instalado corretamente; ver `#startBtn` na seção do
Display). Trocar o modo de exibição no manifest **não** atualiza um WebAPK já
instalado — é necessário **desinstalar e reinstalar** os dois PWAs (não só
revisitar a URL) para o Android regerar o pacote com o modo novo. Para
diagnosticar sem depender de tentativa e erro, o Chrome tem uma página interna
— `chrome://webapks` — que lista os WebAPKs conhecidos do aparelho com
`Package name`, `Display Mode` e `Update Status` de cada um; abrir/recarregar
essa página também **dispara uma verificação de atualização na hora** (o
próprio campo indica isso: "Update Status (Reload page to get new status)").
Um ícone do Chrome nos apps recentes que **persiste mesmo após reinstalação
completa e reboots**, com o `chrome://webapks` mostrando um `Package name`
próprio e `Update Status: Succeeded`, não é mais o sintoma de "atalho" acima —
é mais provável que seja uma particularidade de exibição do launcher/versão do
Android para WebAPKs "unbound" (o cartão da tarefa em Recentes mostra o ícone
do navegador hospedeiro mesmo com o app corretamente instalado); não há
alavanca conhecida do lado do manifest/PWA para forçar esse ícone específico.

**Os dois PWAs vivem no mesmo domínio, em subpastas próprias** (`/controle/`
e `/display/`) — cada um com seu `manifest.json`, `scope: "./"` e
`start_url: "./"` resolvendo para a própria subpasta (escopos não
sobrepostos: nem um é prefixo do outro) e o service worker registrado sem
`scope` explícito (`register('sw.js')` a partir de cada `index.html` já
recebe, por padrão, o escopo = pasta do próprio script). Ambos declaram
também `id: "./"` — resolvido relativo ao `manifest.json` de cada um (não à
raiz do domínio), então vira um identificador **distinto por app**
(`.../controle/` vs `.../display/`), reforçando de forma explícita a
identidade que o Chrome já deduzia implicitamente do `start_url`. O
`chrome://webapks` (ver acima) confirma que os dois têm `Package name`,
`Manifest Id` e `Update Status` **distintos e saudáveis** — não há colisão de
identidade entre os dois PWAs nesse domínio.

**Teste de elegibilidade a multi-janela (App Pair / painel Edge da Samsung):**
um teste decisivo (adicionar cada PWA a um App Pair) mostrou que **só o
Display falha** (tratado como sessão de navegador), enquanto o **Controle
funciona normalmente** — isso descarta de vez a hipótese de colisão de
domínio (afetaria os dois igualmente) e aponta para algo assimétrico entre os
dois manifests. A única diferença funcional relevante entre eles era
`orientation`: `"portrait"` (Controle) vs `"landscape"` (Display). O Android
não redimensiona apps de orientação travada em modo multi-janela — e o
App Pair/painel Edge organiza os painéis em layout retrato, então um app
travado em paisagem entra em conflito direto com esse layout (ao contrário
de um travado em portrait, que se encaixa sem atrito). Isso bate exatamente
com o padrão observado.

**Por isso, por um tempo, o Display deixou de declarar `orientation` fixo no
manifest** — para o Android considerar a atividade redimensionável (elegível
a multi-janela). Duas tentativas de compensar isso via JS foram testadas em
aparelho real e **descartadas** por não funcionarem na prática:
- `requestFullscreen()` no toque em `#startBtn`, para esconder a barra de
  status: **regrediu** o lançamento do Controle (a prioridade do projeto na
  época) — `window.open()` é uma API "consuming" (gasta a ativação
  transitória do toque) e `requestFullscreen()` é "gating" (só exige, sem
  gastar); inverter a ordem para proteger o fullscreen fez o `window.open()`
  seguinte falhar (o Controle voltou a abrir só numa aba interna do
  Display). Removido.
- Trava de orientação via Screen Orientation API (`screen.orientation.lock`)
  no boot + no toque: nunca chegou a engajar de fato no aparelho testado.
  Removido.

**Decisão revertida**: `orientation: "landscape"` foi **restaurado** no
manifest do Display — trocando a prioridade de volta para nunca deixar a
tela de projeção virar sem querer (ex: um esbarrão no aparelho durante o
culto), aceitando de propósito que isso **reintroduz a falha de elegibilidade
a multi-janela** descrita acima (o Display volta a não funcionar num App
Pair/painel Edge — o Controle continua funcionando normalmente, já que
sempre foi `"portrait"`). Como qualquer mudança de `orientation` no
manifest, **não** atualiza um WebAPK já instalado por si só — é necessário
desinstalar e reinstalar o Display (não só revisitar a URL) para o Android
regerar o pacote com a orientação travada; ver `chrome://webapks` para
confirmar o `Display Mode` depois.

O CSS já usa dimensões relativas (`inset:0`, 100%), então mesmo que o
Android insista em abrir em retrato antes do WebAPK atualizar, o layout não
quebra — só deixa de compor como paisagem larga até a reinstalação.
