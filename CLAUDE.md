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
- Ao alterar assets estáticos, incrementar `N` nos dois `sw.js`.
- Toda operação IDB multi-passo que precise de atomicidade deve usar `storeTx()`.
- Não introduzir dependências externas — o projeto usa Node puro no servidor e JavaScript puro no cliente.
- Ao atualizar o código, atualizar este CLAUDE.md se a mudança afetar arquitetura, protocolo de comandos ou API pública.

---

## A ideia

O Android consegue espelhar via **Miracast** um único app selecionado. Aproveitamos
isso dividindo o sistema em dois PWAs:

| PWA | Caminho | Papel |
|-----|---------|-------|
| **Display** | `/display/` | Tela projetada no telão via Miracast |
| **Controle** | `/controle/` | Interface do operador, sempre no celular |

Como os dois PWAs estão no **mesmo origin**, eles compartilham:

- **IndexedDB** — blobs de mídia armazenados offline, acessíveis pelos dois apps.
- **BroadcastChannel** (`av-iasd`) — o Controle envia comandos em tempo real para o Display.

Cada PWA tem `manifest.json`, `scope` e `start_url` próprios, então o Android os
instala e trata como **dois apps distintos** — permitindo espelhar só o Display.

Tudo funciona **100% offline** depois da primeira carga (service workers com cache-first).

---

## Estrutura de arquivos

```
public/
├── index.html                  # Página inicial com links para os dois PWAs
├── shared/
│   ├── db.js                   # Camada comum: IndexedDB + BroadcastChannel
│   ├── stage.js                # Motor de renderização compartilhado
│   ├── material-symbols.css    # Font-face da fonte de ícones (subset offline)
│   └── fonts/
│       └── material-symbols.woff2  # ~2.2 KB — apenas 27 glifos
├── controle/
│   ├── index.html              # UI do operador
│   ├── controle.css            # Estilos do Controle
│   ├── controle.js             # Lógica do Controle
│   ├── manifest.json           # PWA manifest (orientation: portrait)
│   └── sw.js                   # Service worker (cache: controle-vN)
└── display/
    ├── index.html              # UI do Display
    ├── display.css             # Estilos do Display
    ├── display.js              # Lógica do Display
    ├── manifest.json           # PWA manifest (orientation: landscape, fullscreen)
    └── sw.js                   # Service worker (cache: display-vN)
server.js                       # Servidor estático mínimo (Node puro, sem deps)
```

---

## Modelo de dados (`shared/db.js`)

### IndexedDB — banco `av-iasd` v1

| Object Store | Chave | Conteúdo |
|---|---|---|
| `media` | `id` (UUID) | `{ id, blob, thumb, type, kind, name, createdAt }` |
| `state` | chave string | valor arbitrário (listas, estado atual, modo de repetição…) |

**Três listas nomeadas** (arrays de IDs guardados em `state`): `imports`, `favorites`, `playlist`.

O campo `kind` é derivado do `blob.type`:

| `type` começa com | `kind` |
|---|---|
| `image/` | `'image'` |
| `video/` | `'video'` |
| `audio/` | `'audio'` |
| outro | `'other'` |

#### Garbage collection de blobs

Um blob só é excluído quando **não está em nenhuma das três listas**.

```
listRemove(listName, id)
  → se id não aparece em nenhuma outra lista → deleteBlob(id)
```

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
| `view` | `view` (`'visual'`\|`'wallpaper'`) | Alterna entre exibir a mídia ou o wallpaper |
| `clear` | — | Limpa o Display (volta ao wallpaper, zera `currentId`) |

#### Display → Controle

| `type` | Campos extras | Descrição |
|---|---|---|
| `display-ready` | — | Display pronto; Controle reenvia o estado atual |
| `display-status` | `mediaId, view, muted, volume, playing, currentTime, duration` | Estado do Display a cada evento de tempo/estado |
| `media-ended` | `mediaId` | Vídeo chegou ao fim |

---

## Motor de renderização (`shared/stage.js`)

`createStage(opts)` retorna um objeto com a API de reprodução. Usado pelo Display
(tela real) e pelo Controle (mini-preview sempre mudo).

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
})
```

### Estado interno

```
current   → registro da mídia carregada (null = nada)
ended     → flag: vídeo chegou ao fim (permite replay sem recarregar)
view      → 'visual' | 'wallpaper'
muted     → bool (intenção do operador; independe de forceMuted)
volume    → 0.0 – 1.0
loadSeq   → contador para descartar loads concorrentes obsoletos
```

### API exposta

```js
stage.handle(cmd)
stage.load(id, view, muted, volume)
stage.clear()
stage.play() / pause() / stop()
stage.seek(seconds)
stage.setView(v) / setMute(m) / setVolume(vol)
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

### Layout do topo (sempre visível)

```
┌─────────────────────────────────────────────────┬──────┐
│  Preview 16:9 (espelha o Display em tempo real) │      │
│─────────────────────────────────────────────────│ Mix  │
│  Nome da mídia atual           [barra de seek]  │  er  │
│─────────────────────────────────────────────────│      │
│  ⏮  ▶/⏸  ⏹  ⏭  🔁                            │      │
└─────────────────────────────────────────────────┴──────┘
```

**Mixer (coluna direita):** slider vertical de volume, botão mudo, botão visual on/off.

A preview é um `createStage` com `forceMuted: true` que recebe os mesmos comandos
enviados ao Display — garantindo que ambos mostrem o mesmo conteúdo.

### Abas e biblioteca

```
[Playlist]  |  [Importados]  [Favoritos]  [+ Importar]
```

- **Playlist** — bottom-sheet com a lista de reprodução.
- **Importados** — itens carregados (ficam até serem excluídos).
- **Favoritos** — itens favoritados; persistem entre sessões.
- **Importar** — `<input type="file" multiple accept="image/*,video/*,audio/*">`.

Miniaturas (160×160 px, JPEG 72%) geradas via Canvas no momento da importação.
Vídeos têm thumbnail extraído do frame a ~⅓ da duração.

### Gestos nos itens da biblioteca

| Gesto | Ação |
|---|---|
| Toque simples | Carrega e exibe no Display |
| Deslize à esquerda | Adiciona à playlist |
| Deslize à direita | Adiciona/remove dos favoritos |
| Segurar e arrastar (⠿) | Reordena o item na lista |
| Pressionar e segurar | Entra no modo de seleção múltipla |

**Modo de seleção múltipla:** barra no topo com contagem; botões de renomear e excluir.

### Modos de repetição

Ciclo ao tocar no botão 🔁: `off → all → one → shuffle → off`

| Modo | Comportamento ao fim do item |
|---|---|
| `off` | Playlist para; `currentId` permanece para replay manual |
| `all` | Avança para o próximo; ao fim da lista volta ao início |
| `one` | Recarrega e reproduz o mesmo item |
| `shuffle` | Avança para item aleatório (nunca repete o atual) |

---

## PWA Display

Interface mínima: wallpaper + layer de imagem + layer de vídeo.

Na primeira abertura exibe overlay de **unlock** — necessário para contornar a
política de autoplay dos navegadores. Após o unlock, escuta o BroadcastChannel e
repassa todos os comandos para `stage.handle()`. Ao inicializar, envia
`display-ready` para que o Controle reenvie o estado atual.

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
controle/sw.js → const CACHE = 'controle-vN'
display/sw.js  → const CACHE = 'display-vN'
```

Estratégia: cache-first com fallback para rede. Na ativação apaga caches antigos
da mesma palavra-chave sem tocar nos caches do outro app.

**Ao alterar qualquer asset estático, incrementar N nos dois sw.js.**

---

## Fonte de ícones (Material Symbols)

Versão subconjuntada (~2.2 KB woff2): peso 400, apenas 27 glifos usados na UI.

**Codepoints ativos:**
```
E034 E037 E03B E03D E040 E041 E043 E044 E045 E047
E04F E050 E14C E150 E251 E2C8 E3A1 E3AD E413 E5CF
E838 E86C E872 E8F5 E945 EB80 F116
```

Para adicionar ícone: obter codepoint em `fonts.google.com/icons?icon.style=Rounded`
e gerar novo subset com `fontTools`.

---

## Deploy e CI

Push em `main` → GitHub Actions publica `public/` no GitHub Pages.

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
