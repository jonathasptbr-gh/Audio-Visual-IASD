# Audio Visual IASD

Sistema para **transmitir e controlar multimídia** usando uma arquitetura
**dual-PWA** (dois aplicativos web progressivos no mesmo domínio).

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
- **BroadcastChannel** (`av-channel`) — o Controle envia comandos em tempo real para o Display.

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

### IndexedDB — banco `av-db` v1

| Object Store | Chave | Conteúdo |
|---|---|---|
| `blobs` | `id` (UUID) | `{ id, blob, mime, name, thumb? }` |
| `lists` | `name` | `{ name, items: [id, ...] }` |

**Três listas nomeadas:** `imports`, `favorites`, `playlist`.

#### Garbage collection de blobs

Um blob só é excluído quando **não está em nenhuma das três listas**. Isso garante
que um item favoritado continua existindo mesmo que o usuário limpe os importados,
e que a playlist nunca aponta para um blob que sumiu.

```
deleteFromList(id, listName)
  → se id não aparece em nenhuma outra lista → deleteBlob(id)
```

### BroadcastChannel — canal `av-channel`

Todos os comandos são objetos JSON com um campo `cmd`:

| `cmd` | Campos extras | Descrição |
|---|---|---|
| `load` | `id, view, muted, vol` | Carrega mídia no Display |
| `play` | — | Inicia reprodução |
| `pause` | — | Pausa |
| `stop` | — | Para e volta ao wallpaper |
| `seek` | `time` | Pula para o instante (segundos) |
| `vol` | `value` (0–1) | Altera volume |
| `mute` | `value` (bool) | Liga/desliga mudo |
| `view` | `value` (`'visual'`\|`'wall'`) | Alterna visual/wallpaper |
| `media-ended` | — | Display notifica o Controle que o vídeo acabou |

---

## Motor de renderização (`shared/stage.js`)

`createStage(opts)` retorna um objeto com a API de reprodução. É usado tanto pelo
Display (na tela real) quanto pelo Controle (mini-preview no topo).

### Estado interno

```
current   → item carregado atualmente (null = nada)
ended     → flag: vídeo chegou ao fim (permite replay sem recarregar)
view      → 'visual' | 'wall'
muted     → bool
vol       → 0.0 – 1.0
```

### Comportamento ao fim do vídeo

Quando o vídeo termina (`video.ended`), a flag `ended = true` é ativada e
`applyView()` esconde o vídeo e mostra o wallpaper — **sem chamar `clear()`**.
Isso preserva `current` para que um `play()` subsequente reaproveitamento o mesmo
item (redefine `ended = false` e re-exibe o vídeo desde o início).

### Opções de criação

```js
createStage({
  wallEl,      // elemento do wallpaper
  imgEl,       // elemento <img>
  videoEl,     // elemento <video>
  onEnded,     // callback chamado quando o vídeo termina
  onTimeUpdate // callback(currentTime, duration) para seek bar
})
```

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

**Mixer (coluna direita):**
- Slider vertical de volume (0–100%)
- Botão mudo (vermelho quando ativo)
- Botão visual on/off (alterna `image` ↔ `image_not_supported`)

### Abas e biblioteca

```
[Playlist]  |  [Importados]  [Favoritos]  [+ Importar]
```

- **Playlist** — abre um bottom-sheet com a lista de reprodução e todas as suas funções.
- **Importados** — itens carregados na sessão atual (ficam até serem excluídos).
- **Favoritos** — itens marcados como favorito; persistem entre sessões.
- **Importar** — `<input type="file" multiple accept="image/*,video/*,audio/*">`.

### Gestos nos itens da biblioteca

| Gesto | Ação |
|---|---|
| Toque simples | Carrega e exibe no Display |
| Deslize à esquerda | Adiciona à playlist |
| Deslize à direita | Adiciona/remove dos favoritos |
| Segurar e arrastar (⠿) | Reordena o item |
| Pressionar e segurar | Entra no modo de seleção múltipla |

**Modo de seleção múltipla:** barra no topo mostra contagem; botões de renomear e excluir.

### Popup de Playlist (bottom-sheet)

Abre ao tocar no botão de playlist (esquerda das abas). Exibe badge com contagem.

- Lista completa com drag-to-reorder e remoção por swipe.
- Fechar: botão X ou tocar fora do sheet.

### Modos de repetição

Ciclo ao tocar no botão 🔁:

```
off → repeat-all (🔁) → repeat-one (🔁¹) → shuffle (🔀) → off
```

| Modo | Comportamento ao fim do item |
|---|---|
| `off` | Playlist termina; `currentId` permanece para replay |
| `repeat-all` | Avança para o próximo; ao fim da lista volta ao início |
| `repeat-one` | Recarrega e reproduz o mesmo item |
| `shuffle` | Avança para um item aleatório da playlist |

---

## PWA Display

Interface mínima: wallpaper de fundo + layer de imagem + layer de vídeo.

Na primeira abertura exibe uma tela de **unlock** (overlay com botão de play),
necessária para contornar a política de autoplay dos navegadores — que exige um
gesto do usuário antes de qualquer reprodução com áudio.

Após o unlock, o Display escuta o BroadcastChannel e executa todos os comandos
recebidos. Ao fim de um vídeo, envia `{ cmd: 'media-ended' }` de volta para que
o Controle possa avançar a playlist automaticamente.

---

## Service Workers e cache

Cada PWA tem seu próprio SW com uma constante de versão:

```
controle/sw.js → const CACHE = 'controle-vN'
display/sw.js  → const CACHE = 'display-vN'
```

**Estratégia:** cache-first. Na ativação, o SW apaga todos os caches antigos
que contenham a palavra-chave (`controle` ou `display`) exceto a versão atual,
sem tocar nos caches do outro app.

> **Ao fazer qualquer mudança nos assets estáticos, incremente N em ambos os SWs.**

---

## Fonte de ícones (Material Symbols)

A fonte original (Material Symbols Rounded) tem ~3.8 MB. O projeto usa uma versão
**instantiada e subconjuntada**:

- Peso fixado em 400 com `fontTools varLib.instancer`
- Apenas os 27 glifos usados na UI, subconjuntados por codepoint Unicode
- Resultado: **~2.2 KB** em woff2

**Codepoints ativos:**

```
E034 E037 E03B E03D E040 E041 E043 E044 E045 E047
E04F E050 E14C E150 E251 E2C8 E3A1 E3AD E413 E5CF
E838 E86C E872 E8F5 E945 EB80 F116
```

Para adicionar um novo ícone: obter o codepoint em
`fonts.google.com/icons?icon.style=Rounded`, adicioná-lo à lista e gerar novamente
o subset com `fontTools`.

---

## Telas e interação

### Restrições aplicadas (controle.css global)

```css
* {
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation; /* evita double-tap zoom */
}
```

Exceções:
- `.row` → `touch-action: pan-y` (permite scroll vertical + swipe horizontal)
- `.fader` → `touch-action: none` (captura drag total para o slider vertical)

### Viewport

```html
<meta name="viewport"
  content="width=device-width, initial-scale=1,
           maximum-scale=1, user-scalable=no, viewport-fit=cover">
```

- `user-scalable=no` / `maximum-scale=1` — impede zoom por pinça
- `viewport-fit=cover` — estende até as safe areas (notch, barra de navegação)

---

## Deploy e CI

A cada push em `main`, o GitHub Actions publica a pasta `public/` no GitHub Pages
via o workflow `.github/workflows/deploy.yml`.

**URL de produção:**
```
https://jonathasptbr-gh.github.io/Audio-Visual-IASD/
```

---

## Rodar localmente

```bash
npm start
```

Acessa em `http://localhost:3000`. Service workers funcionam em `localhost`.
Em produção é necessário **HTTPS** (GitHub Pages já fornece).

---

## Instalar no Android

1. Abra a URL no **Chrome** do celular.
2. Acesse **Display** → menu → "Adicionar à tela inicial" → instale.
3. Volte e acesse **Controle** → instale da mesma forma.
4. Os dois aparecem como apps separados na gaveta.
5. Espelhe o **Display** via Miracast/Cast; opere pelo **Controle**.

> O primeiro toque no Display libera o autoplay de áudio — faça isso antes de
> começar a operar pelo Controle.
