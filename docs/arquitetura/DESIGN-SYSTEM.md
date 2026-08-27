<!-- Capítulo de docs/ARQUITETURA-WEB.md. O índice e as regras
     de desenvolvimento ficam lá; este arquivo é só este capítulo. -->

## Design System — a identidade oficial IASD, em dois temas

Toda a UI sai de um conjunto fixo de **tokens** (variáveis CSS). **Regra: não
usar valor literal solto na folha; sempre referenciar um token.**

### A identidade é a OFICIAL

As matizes vêm do pacote oficial da identidade visual adventista — o mesmo de que
saiu o símbolo do wallpaper padrão. Os dezoito valores:

```
black     #000000     denim     #2F557F  ← o NÚCLEO da identidade (PMS 302)
bluejay   #2E6DE7     earth     #5E3929
campfire  #CD4900     emperor   #4B207F
cave      #255760     forest    #355724
grapevine #712551     iris      #9013FE
lily      #D41583     ming      #007F98
night     #4A4A4A     scarlett  #D0021B
treefrog  #2B8500     velvet    #782832
white     #FFFFFF     winter    #717171
```

**Duas coisas que a leitura natural inverte:**

1. **Nem todo token é um valor oficial.** Os dezoito foram desenhados para papel
   e para fundo BRANCO — medidos, todos passam AA sobre branco (o pior é
   campfire, 4,62:1) e **NENHUM** passa AA como texto sobre o quase-preto do tema
   escuro (bluejay dá 3,97:1; treefrog, 4,02:1). Onde clarear (ou escurecer, no
   claro) foi preciso, o comentário de `tokens.css` diz de QUAL oficial o valor
   saiu, e a matiz é preservada.
2. **A escala categórica da Bíblia precisa de mais matizes do que a identidade
   tem.** Os dezoito cobrem sete famílias em pares claro/escuro, e a tela de
   livros precisa de DEZ grupos separados por pelo menos 20°: cinco são oficiais
   e cinco preenchem os vãos. O `scarlett` fica FORA da escala de propósito —
   vermelho é atenção neste app, e um grupo de livros vermelho competiria com
   "está no ar" na mesma tela.

> **O âmbar que já foi "a marca" nunca foi oficial.** Ele entrou por um argumento
> de CONTRASTE, não de identidade: a paleta azul anterior usava UM valor para os
> dois papéis (fundo preenchido e texto), e era esse par que reprovava — não o
> azul. A saída certa era separar os papéis
> (`--accent`/`--accent-fill`/`--on-accent`), e com eles no lugar o azul oficial
> passa com folga nos dois temas.

#### A montagem dos dois temas

```css
:root                      /* o PALCO e o que não muda com o tema */
:root                      /* o tema ESCURO — o padrão, sem atributo nenhum */
:root[data-tema="claro"]   /* o tema CLARO — 0,2,0 vence o 0,1,0 acima */
```

O claro é um **DELTA**: o que ele não redeclara cai no escuro. Três coisas
precisam estar ditas:

- **O PALCO NÃO TEM TEMA.** `--stage-*`, `--wallpaper`, `--lyrics-frame-bg`, as
  sombras e o `--scrim` moram no bloco compartilhado. O Display já ficaria escuro
  por omissão (ele nunca escreve o atributo); o que a separação garante é a
  **preview do Controle**, que roda no documento que TEM tema e existe para
  ESPELHAR o telão. Um telão claro num salão às escuras cega a congregação, e uma
  preview clara deixaria de cumprir seu papel exatamente no tema em que o
  operador mais precisa dela.
- **Um token que exista SÓ no claro não está definido no tema padrão.** O `var()`
  computaria para o valor inicial da propriedade — sem aviso, sem log —, e quem
  escreveu acabaria de ver a cor certa na tela porque estava com o claro ligado.
  `tools/tokens.test.mjs` trava isso.
- **A escolha é lida antes do primeiro quadro**, do `localStorage` (`av.tema`),
  pela razão do modo do app: uma leitura do IndexedDB é assíncrona e o app já
  teria pintado. O shell faz só o que o CSS não alcança — os ÍCONES das barras de
  sistema e o `windowBackground` (ver `AVNative.temaClaro`).

**No tema claro os valores oficiais entram quase todos verbatim, e isso não é
sorte:** eles foram desenhados para pousar sobre BRANCO, que é o fundo dos
cartões desse tema. Escurecer só foi preciso onde a cor pousa sobre o CINZA da
página.

**O degrau de elevação se INVERTE no claro, e a régua muda junto.** No escuro
"mais alto" é "mais claro"; no claro o painel já é branco e não há para onde
subir, então `--panel-2` DESCE (um campo dentro de um cartão é um recesso, a
convenção de toda UI clara). A consequência é que `--panel-2` e `--bg` ficam
praticamente na mesma luminância — deliberado, e o mesmo que Material e iOS
fazem. O piso de 1,30:1 entre superfícies grandes foi escrito para um salão no
ESCURO, onde sombra não se vê; no claro ele vale só para o par que importa, fundo
× painel (1,29:1).

### As três famílias

A paleta tem **três matizes fazendo três trabalhos**, e nada além disso:

- **azul denim** — marca IASD, navegação, seleção, progresso. Uma família só: o
  accent **é** a marca (`--brand` e `--accent` têm o mesmo valor), então não há
  dois azuis disputando significado. Os dois nomes coexistem para a folha
  distinguir "isto é marca/metadado" de "isto é navegação/seleção".
- **vermelho** (`scarlett`) — atenção, e a **intensidade carrega o tipo**:
  saturado = está no ar agora; suave = ação destrutiva ou aviso.
- **verde** (`treefrog`) — concluído, conectado. E **só** isso.

O que motivou essa disciplina: quatro estados chegaram a ser pintados por duas
famílias de cor cada — "está no telão agora" era vermelho em quatro lugares e
VERDE em dois; "selecionado" era accent em dezenove e verde em dois; e um único
token de marca acumulava 27 usos cobrindo marca, aviso, erro, cancelar, destaque
de busca e rótulo de estrofe, sem um `--warn` separado dele.

**A contrapartida conhecida:** o aviso (`campfire`, 21°) e o vermelho de atenção
(`scarlett`, 353°) ficam a ~28° de matiz. A regra que a torna aceitável é que o
aviso **nunca é cor pura solta** — sempre fundo suave + ícone. Um aviso que se
anuncia só pela matiz não sobrevive a um celular com brilho baixo, nem a quem não
distingue duas matizes vizinhas.

### Onde ficam os tokens

- **`shared/tokens.css`** — **a paleta inteira**, e só ela. Carregada pelos DOIS
  apps, antes da folha de cada um.
- **`controle/controle.css`** — o `:root` do que **não é cor**: raio, escala de
  ícone, curva de toque e as medidas de layout que o JS também lê
  (`--deck-pv-h`, `--fader-cap`). São decisões da UI densa do Controle, e o
  Display (que não tem UI) não teria o que fazer com elas.
- **`display/display.css`** — **nenhum token de cor**. Ele consome de
  `tokens.css`, e a lista está no topo da folha para ser conferida: se ela e um
  `grep var(--` divergirem, é a lista que está errada. **O Display nunca escreve
  `data-tema`**, então fica no bloco escuro por omissão.

**Por que uma folha só.** Os tokens de marca já foram mantidos à mão nas DUAS
folhas, com o comentário de ambas admitindo que "a sincronização é manual" —
sincronização manual entre dois arquivos é uma classe de bug, não um processo:
basta um ajuste entrar de um lado para o telão e a preview do Controle, que
existe justamente para ESPELHÁ-LO, mostrarem coisas diferentes.
### Tokens

Os valores abaixo são de `shared/tokens.css`, que é a fonte; as razões são
medidas (luminância relativa WCAG, com as superfícies `rgba` compostas contra o
fundo real de cada contexto). **Duas colunas de valor**, uma por tema; onde há
só uma, o token está no bloco COMPARTILHADO e vale nos dois.

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--bg` | `#0e1215` | `#dfe3e7` | fundo do app. A matiz é a do denim (211°) em vez de um cinza puro: um cinza neutro ao lado de um accent azul lê como esverdeado |
| `--bar` | `#252b33` | `#ffffff` | bottombar / trilho de abas |
| `--panel` / `--panel-2` | `#2c343c` / `#3b4550` | `#ffffff` / `#dee2e8` | cartões e linhas de lista / o item ativo ou selecionado. **A direção se inverte no claro** (ver "A montagem dos dois temas") |
| `--line` | `#4f5966` | `#97a5b4` | **todas** as bordas e separadores — 2,65:1 contra o fundo no escuro, 1,95:1 no claro |
| `--surface` / `--surface-2` | `rgba(255,255,255,.12)` / `.18` | `rgba(255,255,255,.70)` / `.92` | botão / chip-campo-badge **sobre o fundo do app** (ver R1). Branco com alfa nos DOIS temas: o controle FLUTUA sobre a página |
| `--surface-sunk` / `--surface-2-sunk` | `rgba(0,0,0,.24)` / `.14` | `rgba(0,0,0,.06)` / `.10` | os mesmos dois **dentro de um cartão**, onde o sinal se inverte e o controle AFUNDA. Eram literais em `controle.css` até a v5.192 — os últimos pedaços de cor fora da fonte única, e o tema claro herdaria um recesso de 24% de preto sobre um cartão branco |
| `--text` / `--muted` | `#dce0e5` / `#b0b7bf` | `#4a4a4a` / `#5c636c` | texto (14,19:1 sobre o fundo · 9,52:1 sobre painel no escuro; 6,87:1 · 8,86:1 no claro) / secundário. **No claro o `--text` é o `night` OFICIAL**; o `--muted` é derivado, porque o `winter` oficial (#717171) passa sobre branco (4,88:1) e cai para 3,81:1 sobre o cinza da página |
| `--accent` | `#8fb1f3` | `#2f557f` | o azul como **texto, ícone e borda**. No escuro é o `bluejay` CLAREADO (o oficial dá 3,97:1 sobre o fundo e reprova): 8,74:1 sobre o fundo, 5,86:1 sobre painel. No claro é o `denim` OFICIAL: 7,70:1 sobre painel, 5,97:1 sobre a página |
| `--accent-fill` | `#2f557f` | `#2f557f` | o **`denim` OFICIAL** como fundo de elemento preenchido (aba ativa, botão primário), nos dois temas. 2,44:1 contra o fundo escuro — exatamente o peso que o preenchido âmbar tinha (2,59:1) |
| `--on-accent` | `#e8edf3` | `#ffffff` | o que se escreve **em cima** de `--accent-fill` — 6,54:1 e 7,70:1. O par branco-sobre-denim é o que a própria identidade recomenda; no escuro vale a regra do off-white, e a folga sobra nos dois |
| `--accent-soft` | `rgba(143,177,243,.16)` | `rgba(47,85,127,.12)` | fundo suave de estado ativo |
| `--accent-glow` | `rgba(143,177,243,.32)` | `rgba(47,85,127,.28)` | halo do `.start-pill` do Display. Segue a MATIZ do accent, não o `--accent-fill`: um halo na cor do preenchimento (escuro por definição) sobre o fundo escuro seria invisível. **Saiu do botão de conectar do simplificado bloqueado na v5.75** — ali quem separa o botão do fundo é a cortina embaçada |
| `--brand` / `--brand-soft` / `--brand-text` | `#8fb1f3` / `rgba(143,177,243,.16)` / `#c2d4f8` | `#2f557f` / `rgba(47,85,127,.12)` / `#24446a` | marca ("IASD"): logo, capa da letra, pill "Ligar Sistema", rótulo de estrofe, destaque da busca por letra. Mesmo valor do accent — os dois nomes existem para distinguir marca de navegação na folha |
| `--live` / `--danger` | `#d0021b` | `#d0021b` | o **`scarlett` OFICIAL**, e **só** como preenchimento/borda de "está no ar agora" (ou de superfície destrutiva, que hoje não existe). Como texto ele reprova: 3,32:1 sobre o fundo escuro |
| `--on-live` | `#f6eeef` | `#ffffff` | o que se escreve sobre `--live` — 4,96:1 e 5,67:1 |
| `--live-strong` / `--danger-strong` | `#f97a7e` | `#b80419` | **o vermelho que se lê como vermelho** (v5.76): ícone, borda e marca preenchida. Derivado do `scarlett` (matiz 358°/353°), clareado no escuro e escurecido no claro. Escuro: 7,27:1 sobre `--bg`, 6,59:1 sobre o soft, 4,88:1 sobre `--panel`, **3,77:1 sobre `--panel-2`** — este passa o piso de borda e reprova o de texto, e é por isso que quem veste este vermelho veste junto o fundo suave da própria família. Claro: 4,63:1 sobre o soft, 6,84:1 sobre o painel |
| `--danger-text` | `#e98d83` | `#93382e` | o salmão, para os TRÊS casos em que o `-strong` não serve: a falha na miniatura do YouTube, o pulso de erro e o aviso de falha pousado direto no painel — 5,17:1 sobre `--panel` no escuro, 7,38:1 no claro |
| `--live-soft` / `--danger-soft` | `rgba(208,2,27,.22)` | `rgba(208,2,27,.08)` | fundo suave de "no ar" / destrutivo. O alfa é MUITO menor no claro: qualquer tinta ali escurece a base e derruba o contraste do texto que pousa em cima |
| `--warn` / `--warn-text` / `--warn-soft` | `#ef853f` / `#e5a86c` / `rgba(205,73,0,.18)` | `#bd520a` / `#934410` / `rgba(205,73,0,.08)` | aviso: borda/ícone, texto, fundo. Derivados do **`campfire` OFICIAL** (matiz 21°) — 6,34:1 e 7,95:1 sobre o próprio suave no escuro; 3,38:1 (piso de ícone) e 4,81:1 no claro |
| `--ok` / `--ok-soft` | `#80bd64` / `rgba(43,133,0,.20)` | `#216900` / `rgba(33,105,0,.08)` | concluído/conectado. Derivado do **`treefrog` OFICIAL** (matiz 101°), clareado e DESSATURADO no escuro — no talo ele vira um limão que grita mais que o accent. 5,64:1 sobre painel · 8,41:1 sobre o fundo; no claro 6,81:1 sobre o painel |
| `--stage-bg` / `--stage-text` | `#000` / `#fff` | *(idem)* | **o palco**, não a UI, e por isso NÃO tem tema: o preto é preto de verdade (as barras do letterbox têm de sumir na moldura da TV) e o texto projetado é branco pleno — num telão a legibilidade vem de luminância máxima, não de um off-white calibrado para uma tela a 30 cm do rosto |
| `--stage-text-soft` / `--stage-text-dim` | `rgba(255,255,255,.9)` / `.72` | *(idem)* | marca sobre o wallpaper / linha auxiliar da letra |
| `--scrim` | `rgba(0,0,0,.6)` | *(idem)* | cortina de modal (bottom-sheets e diálogo). Preta nos dois temas — é assim que um modal se destaca em qualquer UI, e no claro ela é o único elemento que precisa vencer uma página branca |
| `--shadow-cap` / `--shadow-card` / `--shadow-ink` | `rgba(0,0,0,.5)` / `.55` / `.9` | *(idem)* | as três elevações nomeadas. Compartilhadas porque sombra é preto com alfa nos dois temas, e os consumidores de `--shadow-ink`/`--shadow-card` pousam sobre a preview (mídia arbitrária), onde clarear a sombra é apagá-la |
| `--veil` / `--veil-solid` | `rgba(14,18,21,.55)` / `.92` | `rgba(223,227,231,.55)` / `.92` | cortina do bloqueio do modo simplificado. É o `--bg` com alfa, e os dois têm de andar **juntos**: senão o véu vira um retângulo mais escuro (ou mais claro) que o app inteiro, justamente na tela que abre por padrão sem TV conectada. A variante sólida cobre o caso sem `backdrop-filter` |
| `--wallpaper` | `#04070d` | *(idem)* | a cor de BASE por baixo do desenho padrão do telão (o símbolo oficial sobre denim profundo, em `shared/wallpaper-padrao.svg`). **A URL não pode morar no token**: um `url()` substituído por `var()` resolve contra a PÁGINA, não contra a folha — quem aponta para o SVG são `display.css` e `controle.css`, com o mesmo caminho relativo |
| `--lyrics-frame-bg` | `rgba(0,0,0,.62)` | *(idem)* | fundo da faixa da letra (modo imagem). **Sem borda**: o contorno branco desenhava um retângulo que competia com a letra, e quem separa o texto da foto é a faixa. A densidade foi escolhida pelo PIOR caso — uma foto branca: `.40` deixava o fundo em ~`#999` (**2,85:1** com o texto branco, reprovado); `.62` põe em ~`#616161`, **6,2:1** |
| `--b-*` / `--bt-*` | dez pares | dez pares | ladrilhos da Bíblia: tinta + a matiz da faixa lateral, invertidas entre os temas. Ver "Ladrilhos da Bíblia" |
| `--cell-chapter{,-text}` / `--cell-verse{,-text}` | `#283543`/`#d6e0eb` · `#433a28`/`#ede5d4` | `#cedff3`/`#183d67` · `#f4e5c7`/`#654310` | células de número da Bíblia. Tons distintos **de propósito** — capítulo frio (a matiz do denim), versículo quente: as duas grades são iguais em forma e conteúdo (só números) e ficam uma sobre a outra na mesma tela |

(Os tokens `--yt`/`--yt-soft` saíram com o selo `.yt-badge` na v5.118, quando a
origem do item virou o subtítulo `.row-sub`; `--live-text` saiu na v5.76 e o
valor dele vive em `--danger-text`.)

Fora de `tokens.css`, no `:root` do Controle (não são cor):

| Token | Valor | Uso |
|---|---|---|
| `--radius-btn` / `--radius-card` / `--radius-pill` | `8px` / `10px` / `999px` | botões e controles / cartões e painéis / badges, chips, pills |
| `--radius-sheet` | `18px` | folha deslizante — raio MAIOR que o de cartão, e só nos cantos voltados para dentro da tela. É o que lê como "folha que deslizou de fora" em vez de "cartão grande". Eram três `18px` literais, três chances de divergirem. **De QUE lado ficam os cantos é a regra de origem da v1.2.3** (ver abaixo) |
| `--radius-xs` | `4px` | marcas menores que um botão (badge de 1px de padding, realce de uma linha de letra, a linha-guia de arraste). Com `--radius-btn` elas viram cápsulas; sem raio nenhum, cortes secos no meio do texto |
| `--deck-pv-h` | `130px` | altura da faixa da preview na grade do `.deck` — é token porque a LARGURA da preview sai dela (altura × proporção do telão) |
| `--fader-cap` | `26px` | espessura do cap do fader — **dois** faders a usam (mixer e modo simplificado), e a posição do número sai dela |
| `--icon-sm` / `--icon-md` / `--icon-lg` | `20` / `22` / `24px` | escala dos **glifos de fonte** (`.msym`). Os SVGs inline trazem `width`/`height` no próprio HTML e nunca estiveram sob ela; o modo simplificado tem escala própria, porque ali o alvo é o polegar de quem está de pé |
| `--press` | `scale(.96)` | feedback de toque padrão: todo `:active` usa `transform: var(--press)` |
| `--kb` | `0px` | altura coberta pelo teclado virtual, escrita pelo JS (ver "Deslocamento com o teclado virtual") |

### Métodos/convenções visuais padronizados

- **Feedback de toque:** todo elemento interativo usa
  `:active { transform: var(--press); }` (antes havia `scale(.95/.96/.97/.98)`
  misturados — unificados em `.96`). A regra é **UMA SÓ**, um `:is(...)` com a
  lista de seletores logo depois do bloco `:root`. Antes ela estava repetida em
  17 lugares e, ainda assim, nove controles ficavam de fora (voltar, abas,
  seleção múltipla, botões de linha, fechar popup, escolher pasta,
  preenchimento, linha de música…): como o `*` zera o tap-highlight, esses
  ficavam **totalmente mudos ao toque** no aparelho. Com a lista única, um botão
  novo entra acrescentando um nome — não copiando uma regra.
- **Tamanho de ícone:** três degraus — `--icon-sm` (20px, botões de
  linha/cabeçalho/popup), `--icon-md` (22px, abas e transporte) e `--icon-lg`
  (24px, miniatura-ícone, dicas de deslize e barras largas de ação). Antes havia
  oito tamanhos (19…27px), cinco deles usados uma única vez. **Desde a v5.49 a
  escala governa também os SVGs inline**, por dois `:is(...)` logo depois do
  bloco de feedback de toque: até ali ela valia só para os GLIFOS de fonte
  (`.msym`, via `font-size`), e os SVGs traziam `width`/`height` escritos no
  HTML e no JS — 14, 16, 17, 19, 20, 22, 26, 28, 30 e 44 px espalhados por dois
  arquivos. O efeito não era teórico: o `#addDirBtn` (19px, SVG) e o `#backBtn`
  (20px, glifo) são vizinhos no mesmo cabeçalho, com a mesma caixa de 34px, e o
  ícone de um saía menor que o do outro sem que nada na folha dissesse por quê.
  O atributo do elemento continua no HTML como valor de partida (vale antes de
  o CSS carregar), mas quem manda é a regra. **Duas exceções**, cada uma dita
  no lugar onde mora: os ícones nos cantos da preview (`.pv-fab`, 24px — sem
  moldura, o ícone É o botão) e o modo simplificado (28px nas teclas, 44px no botão de
  conectar), onde o alvo é o polegar de quem está de pé. "Três degraus **e só
  eles**" era a frase antiga, e ela era desmentida por dezenas de valores no
  HTML; agora ela é verificável.
- **Alvo de toque:** dois degraus, e desde a v5.49 são **tokens** — `--hit`
  (34px) e `--hit-nav` (38px, a faixa de navegação: `.tab` e `.tab-add`). O piso
  de 34px vale para `.row-btn`, `.row-handle`, `.popup-close`, `.back-btn`,
  `.add-dir-btn`, `.sel-btn`, `.coll-bar-dl`, `.coll-group-btn` e `.pv-fab`.
  Nada abaixo disso — o `.back-btn` já teve 20×20 px sendo a única saída da tela
  de Favoritos e da navegação da Bíblia, com o `#addDirBtn` (que abre o SAF)
  logo ao lado. Antes o 34 estava escrito literal em sete regras e, ainda assim,
  dois controles ficavam fora da escala por descuido: `.sel-btn` com 36px e o
  botão do acervo com 42×38 — sete literais é o que faz uma escala de duas
  medidas render quatro tamanhos na mesma tela. Os dois botões de baixar
  (`.coll-bar-dl` no card e `.coll-group-btn` no cabeçalho de grupo) têm o
  **mesmo** alvo de propósito: alinhados na mesma coluna, tamanhos diferentes
  fariam os centros discordarem.
- **Receita repetida vira seletor agrupado, não cópia:** os estados de cor são
  declarados por ESTADO (`.view-blocked`/`.muted`/`.danger` num bloco,
  `.active` noutro), a coluna "nome + subtítulo" das linhas de lista é uma regra
  para `.coll-bar-info, .bible-ver-main, .hymn-info`, e `.tab-add` divide a
  caixa de `.tab` (`flex:1`, `--hit-nav`, mesmo raio) em vez de reescrevê-la.
- **Ordem importa quando a especificidade empata:** `.pv-text { z-index: 2 }`
  precisa vir DEPOIS de `.pv-layer { z-index: 1 }` (o elemento tem as duas
  classes). Já esteve antes, e o cartão de texto só ficava acima do iframe do
  YouTube por acaso, pela ordem no DOM.
- **Realce de toque:** `-webkit-tap-highlight-color: transparent` e
  `user-select: none` ficam **só no seletor `*`** (topo da folha) — **não
  repetir** por elemento (era redundante em ~12 regras, removido).
- **Exceção de seleção de texto:** só `input, textarea` no Controle (o campo de
  busca precisa ser editável) — ver "Regras de desenvolvimento".
- **A FOLHA ENTRA PELA BORDA DO BOTÃO QUE A ABRE** (v1.2.3). Uma folha que
  desliza da borda oposta à do botão atravessa a tela inteira para responder a um
  toque, e o olho a perde no caminho. Hoje **descem do teto** as duas cujo botão
  está no alto — Configurações (a engrenagem foi para o cabeçalho na v1.2.0) e a
  playlist automática (o dado, na barra de busca da Biblioteca) —, e **sobem da
  base** as demais, cujos botões moram na barra de controles.

  São TRÊS declarações que precisam concordar, e nenhuma sozinha basta: de onde
  ela ENTRA (`translateY(±100%)`), onde ela ENCOSTA (`align-items`) e de que lado
  ficam os CANTOS — uma folha colada no teto com o raio embaixo é um cartão
  flutuando fora de lugar. Vêm juntas em `.popup-backdrop--topo` +
  `.popup-sheet--topo`, e o oráculo (`tools/smoke.mjs`) mede o RENDERIZADO, não a
  classe: com a classe presente e uma declaração faltando, `classList` continua
  concordando consigo mesma.
- **Cantos:** botões/controles = `--radius-btn`; contêineres = `--radius-card`;
  pills/badges = `--radius-pill`; folhas deslizantes = `--radius-sheet`; marcas
  menores que um botão = `--radius-xs`. Os dois últimos existem porque três
  `18px` e vários `4px` literais eram três (e vários) chances de divergirem no
  primeiro ajuste. **Quatro botões largos violavam a primeira metade da regra**
  e foram corrigidos na v5.49 (`.import-btn`, `.msg-add-btn`, `.new-folder-btn`
  e `.folder-pick-btn` usavam `--radius-card`): a maioria dos botões largos do
  app — `.misc-project`, `.mic-btn`, `.chrono-btn`, `.draw-go`
  — sempre usou `--radius-btn`, então eram esses quatro que destoavam, e dois
  deles ("Importar arquivos" e "+ Nova mensagem") são o mesmo tipo de botão
  tracejado em telas diferentes. Na mesma passada o tracejado de `.msg-add-btn`
  virou `--accent` como o de `.import-btn`: dois botões de "acrescentar" com
  bordas de cores diferentes. Casos especiais deliberados que continuam fora do
  sistema: `border-radius: 0` da faixa da letra ("vídeo de louvor", cantos
  retos) e `50%` do thumb do fader.
- **Cor literal fora do sistema: nenhuma.** As duas folhas não contêm `#fff`
  nem `#000` soltos — o preto do palco é `--stage-bg`, o branco projetado é
  `--stage-text`, e até o halo do `.start-pill` virou `--accent-glow`. É a
  regra R3.

### O RISCADO é o corte; a cor confirma; o rótulo nomeia a ação

Regra única para os dois cortes do app — o som e a imagem —, na tela **e** na
notificação nativa: **o ícone riscado significa CORTADO**. Alto-falante riscado =
mudo; imagem riscada = telão coberto. Na tela quem reforça é a COR (`.view-blocked`,
`.muted`, `.blocked`), que pinta o botão inteiro; na notificação, onde não há cor
de estado, quem nomeia a ação é o RÓTULO ("Cobrir telão" / "Mostrar mídia").

| Estado | Ícone | Cor |
|---|---|---|
| mídia no ar | imagem inteira | neutra |
| telão coberto | **imagem riscada** | vermelha (`.view-blocked`) |
| som ligado | alto-falante inteiro | neutra |
| mudo | **alto-falante riscado** | vermelha (`.muted`) |
| áudio bloqueado no Display | **alto-falante riscado** | âmbar pulsante (`.blocked`) |

Os dois últimos compartilham o ícone de propósito: nos dois **não sai som**, que
é o que o riscado diz. O que os distingue — mudo do operador × bloqueio do
navegador — é a cor, e essa distinção só importa para saber o que o toque vai
tentar (mutar × pedir liberação), que é o que o `title` diz.

> A regra já foi a OPOSTA ("o ícone é o que o toque vai fazer"), e o problema que
> ela atacava era real — estado e ação conviviam misturados. Mas ela gastava o
> RISCADO, o símbolo universal de "cortado" (o mesmo que o Android usa na própria
> tecla de volume), para dizer que NADA está cortado. Invertendo não se perde
> nada: a cor já carrega o estado sozinha.

**O ▶/⏸ segue sendo AÇÃO**, e não é inconsistência: ali a convenção é de
plataforma (todo player mostra ▶ quando está pausado), o botão não tem cor de
estado, e o par não é "cortado/não cortado".

**A exceção é o `repeat`**, e ela é de forma: o botão CICLA por quatro modos
(off → all → one → shuffle). Num ciclo só cabe um glifo, e mostrar o PRÓXIMO
apagaria da tela qual está valendo — a cor distingue ligado de desligado, não
qual dos três.

Botões de **função** (engrenagem, folha da leitura auxiliar) e **segmentados**
ficam fora da regra por natureza: não alternam duas ações opostas.

**⏮/⏭ foram um terceiro caso até a v1.3.5** — o único em que a cor não dizia um
estado do sistema e sim o EIXO do botão: `.slide-mode` (contorno em accent) = "o
toque curto passa estrofe"; `.axis-end` (esmaecido) = "esse caminho acabou, o
toque longo ainda troca de mídia". As duas classes saíram com o eixo duplo do
transporte: quem passa slide são dois botões PRÓPRIOS ao lado da preview, e um
botão com um significado só não tem eixo a anunciar. O que diz "não há para onde
ir" ali voltou a ser o `disabled` de sempre.

### Só preenchimento, nenhum contorno

Nenhuma regra do app desenha `border`/`outline`. O que sobrevive são dois
DESENHOS, nomeados um a um no oráculo — nunca detectados por heurística, porque
uma heurística deixaria a próxima borda entrar chamando-se desenho:

- o aro do `.dl-ring` e o do `.av-stage-busy` — eles **são** círculos, não a
  moldura de um elemento;
- o ✓ do `.song-menu-check` (duas bordas em L, giradas 45°) — é o glifo que falta
  no subset da fonte de ícones.

**São DOIS oráculos, e nenhum basta sozinho.** `tools/tokens.test.mjs` varre a
FONTE e prova que nenhuma regra NOSSA desenha contorno; `tools/smoke.mjs` mede o
RENDERIZADO e prova que nada desenha borda na tela. O segundo existe porque o
primeiro é cego por construção para o defeito real: **o padrão do navegador não é
"sem borda"** — a folha do UA dá a todo `<button>` um `border: 2px outset` (um
bisel, duas cores) e a todo campo um `2px inset`, então tirar a NOSSA declaração
não removia borda nenhuma, deixava passar a dele. O `appearance: none` não cobre
isso: ele desliga o desenho nativo do controle, não a borda do UA. A correção é
`border: 0` no **reset universal**, e ela mora ali e não em cada componente
porque o esquecimento não aparece na folha — aparece no aparelho.

E a varredura é da FONTE, não do renderizado, de propósito: metade das bordas
morava em regras de ESTADO (`.active`, `.no-ar`, `.expanded`) e em
pseudo-elementos, que uma caminhada pelo DOM só alcançaria se o teste soubesse
encenar cada estado.

#### O que substituiu cada contorno

| Era | Virou |
|---|---|
| linha `.active`/`.selected` de uma linha de lista | `--sel-fill`, um fundo OPACO |
| linha `.no-ar` (vermelha) | `--live-fill`, idem |
| `--ok` contornando "já conectado" | `--ok-fill`, idem |
| tracejado de "espaço a preencher" (`.import-btn`, `.selbar`, `.pl-pack`) | preenchimento em `--accent-soft` |
| segmentado/chip marcado (`--accent-soft` + borda) | `--accent-fill` + `--on-accent`, o par que a aba ativa já usava |
| filetes separadores | ESPAÇO |
| faixa lateral do grupo na Bíblia e da estrofe no ar | `linear-gradient` — os mesmos pixels, declarados como o preenchimento que sempre foram |
| anel externo da célula ativa da Bíblia (`outline`) | a célula inteira em `--accent-fill` |
| moldura da preview (`outline`) | `box-shadow: 0 0 0 2px var(--camada)` — uma faixa preenchida que não entra no `aspect-ratio` |
| anel do eco (`.btn-eco`) | `box-shadow` de mesma espessura |
| aresta de 1px do tema claro (`--control-edge`) | `--surface-sunk`/`--surface-2-sunk` mais fundos (.14/.20): **1,32:1** e **1,51:1** contra o painel branco, contra os 1,14:1 que motivaram a aresta |

#### Os três fundos de ESTADO são OPACOS, e a razão é medida

`--sel-fill`, `--live-fill` e `--ok-fill` substituíram o par "contorno + tinta
com alfa". Serem opacos não é preferência: **`--accent-soft` a 16% sobre o painel
compõe `#3d4959`, que é o `--panel-2` desta paleta** — uma linha SELECIONADA
ficava com a cor exata do nível de baixo da árvore, e o que a distinguia era só a
borda que saiu. Opacos, os três valem o mesmo em qualquer nível: **um estado SAI
da escada em vez de ocupar um degrau dela.**

E o sinal principal deles é a MATIZ, não a claridade — `--live-fill` fica a
1,03:1 do painel de propósito. Uma linha vermelha entre linhas cinzas se acha sem
precisar ser mais clara, e é a matiz que sobrevive ao brilho baixo de um salão
escuro, onde meio degrau de luminância não sobrevive.

#### A regra do vermelho é a INTENSIDADE, não o preenchimento

- **saturado** (`--live` + `--on-live`) = está no ar agora, e só isso — o
  microfone aberto, o ponto de projetando. É o vermelho que não pode ter
  concorrente na tela;
- **suave** (`--live-fill` numa linha, `--danger-soft` num chip ou botão) = ação
  destrutiva, ou "no ar" numa lista.

(Antes de as bordas saírem a régua era "preenchido = no ar · contornado =
destrutivo"; sem contorno, o eixo passou a ser a intensidade do mesmo
preenchimento.)
### Escada de elevação, e a regra que faltava

O que separa duas camadas não é a cor de cada uma, é o **degrau** entre elas:
no celular, com brilho baixo no salão, uma escala quase plana faz botão e fundo
virarem a mesma mancha escura. Degraus da paleta atual:

| Par | Razão | Piso |
|---|---|---|
| fundo × barra de abas | **1,32:1** | 1,30 |
| fundo × painel (nível 1) | **1,49:1** | 1,30 |
| painel × painel-2 (nível 2) | **1,33:1** | 1,30 |
| fundo × `--surface` (botão sobre o fundo) | **1,38:1** | 1,30 |
| painel × `--surface` recuada (botão DENTRO do cartão) | 1,18:1 | assumido |
| painel × `--surface-2` recuada (chip dentro do cartão) | 1,11:1 | assumido |

**O par `--panel` × `--panel-2` cumpre o piso desde a v5.267, e a mudança tem
causa.** Ele valia 1,28:1 e o texto que estava aqui assumia isso com um
argumento que caiu junto com as bordas: *"ele não carrega o estado sozinho em
lugar nenhum — quem diz 'selecionado' é sempre a borda em `--accent`"*. Sem
borda em lugar nenhum do app, este degrau passou a ser o ÚNICO separador entre
uma seção da Biblioteca e o card de álbum dentro dela, e um piso não se cumpre
"quase". `--muted` e `--accent` foram clareados um degrau na mesma conta — no
valor antigo o accent caía a **4,40:1** sobre o painel-2 novo, e reprova AA.

`--line` saiu da tabela porque saiu do papel: não há mais filete nem contorno em
lugar nenhum. Ele sobrevive como TINTA de dois desenhos (a estrela vazada de
favorito, a barra de rolagem das grades da Bíblia).

#### R0 — a escada tem TRÊS degraus, e o quarto é o espaço

Um quarto tom obrigaria o nível mais interno a subir até ~`#4c5865` no tema
escuro, onde `--muted` mede **3,59:1** e `--accent` **3,37:1** — os dois
reprovam AA para texto pequeno, que é exatamente o tamanho do texto de uma linha
de lista. Então a árvore para em três, e quem carrega o quarto nível é o
ESPAÇO: uma faixa dentro de um álbum aberto não tem caixa nenhuma, e o que a
separa da vizinha é o tom do próprio álbum aparecendo entre elas.

No tema CLARO a escada **não é monotônica**, e isso é aritmética e não descuido:
a página é cinza e o nível 1 é branco (a convenção de toda UI clara), então o
primeiro degrau sobe e os seguintes só podem descer — `#dfe3e7` → `#ffffff` →
`#d4dae2`. Folha e card ficam a 1,09:1 um do outro e isso não se lê como
ambiguidade, porque os dois **nunca se encostam**: entre eles há sempre a
moldura branca da seção. `tools/smoke.mjs` mede os pares ADJACENTES (piso 1,28)
e exige apenas que nenhum par coincida (piso 1,05) — a primeira versão daquele
caso exigia monotonia e reprovava um desenho correto.

#### R1 — a superfície AFUNDA dentro de um cartão

O ponto estrutural desta versão. `--surface`/`--surface-2` são branco com alfa
**de propósito**: um botão mantém o mesmo degrau relativo esteja ele sobre o
fundo do app ou sobre a barra — três valores fixos divergiriam no primeiro
ajuste. Mas alfa **EMPILHA**: 12% de branco sobre `--bg` dá `#2f2e2e`, e o
MESMO token sobre `--panel` dá `#4c4b49` — os canais sobem 1,6× e a **luminância
relativa mais que dobra** (2,6×), que é o que o contraste enxerga.
Era essa a causa raiz do pior contraste do app — todo texto e ícone colorido
dentro de um cartão reprovava AA porque a base dele era muito mais clara do que
a folha supunha. O pior caso medido: o ícone de cancelar um download, **2,32:1**.

**Não existe alfa que resolva.** Para o botão manter degrau ≥ 1,30:1 contra o
fundo do app é preciso α ≥ .10; para o texto colorido passar AA dentro do
cartão é preciso α ≤ .08. São incompatíveis, porque um único overlay não pode
servir a duas bases.

A saída é **inverter o sinal dentro do cartão** — que também é a convenção
correta de UI escura (o cartão já está elevado, então o controle dentro dele é
**recesso**) e ainda emite menos luz, o que importa num salão no escuro:

```css
.row-item, .lib-item, .hymnal-card, .msg-item, .bible-vsec,
.dialog-card, .popup-sheet, .fade-row, .simple-lyrics, .simple-key,
.coll-group--drop, #hymnSearchPopup .hymn-search-bar {
  --surface:   var(--surface-sunk);
  --surface-2: var(--surface-2-sunk);
}
```

Como custom properties **herdam**, essa regra só precisa marcar os elementos
que de fato pintam `--panel` de fundo: toda a descendência vem junto, não há
componente a ajustar, e um componente novo nasce coberto.

Os VALORES saíram daqui na v5.192 e viraram `--surface-sunk`/`--surface-2-sunk`
em `tokens.css` (o tema claro precisa de outros dois alfas). E o par FLUTUANTE
ganhou nome próprio na v5.267 — `--surface-alta`/`--surface-2-alta` — porque
passou a existir um caminho de VOLTA: a folha da Biblioteca é nível 0, então os
controles lá dentro flutuam de novo, e um override do mesmo nome não daria isso
(`--surface: var(--surface-alta)` funciona; `--surface: var(--surface)` é um
ciclo, que o CSS descarta).

#### R1.1 — `--camada`: o tom que um bloco veste é decisão do PAI (v5.267)

Pedido do operador: as ramificações da Biblioteca *"visualmente se parecem
muito, dificultando discernir se estou em uma camada ou subcamada"*.

O degrau de tom era só metade do defeito. A outra era que **o mesmo componente
ocupava níveis diferentes da árvore conforme a tela, e pintava sempre a mesma
cor**: uma `.lib-item` na tela principal está sobre `--bg`; a mesma `.lib-item`
dentro da folha da playlist está sobre `--panel` — e pintava `--panel` também,
dois tons idênticos encostados. Escrever isso como seletores descendentes daria
uma regra por combinação, e a próxima tela nasceria com a combinação faltando.

`--camada` é UMA propriedade com um significado só: **o tom que um bloco filho
DESTE contêiner deve vestir.**

```css
:root { --camada: var(--panel); }                    /* página → nível 1 */
.popup-sheet, .dialog-card, .simple-conn { --camada: var(--panel-2); }
.popup-sheet--full { --camada: var(--panel); }       /* é uma TELA, não um cartão */
.coll-group-corpo { --camada: var(--panel-2); }
.hymnal-card { --camada: var(--panel-2); }           /* a EXCEÇÃO — ver abaixo */
.coll-songs { --camada: transparent; }               /* não há nível 3 */
```

**Quem a declara é o CONTÊINER, nunca quem pinta**, e isso não é estilo: uma
propriedade escrita no próprio elemento vence na hora de ELE resolver
`var(--camada)`, então um bloco que reservasse o tom dos filhos em si mesmo
passaria a vestir aquele tom. A primeira versão desta regra pôs
`.coll-group--drop` na lista e a seção passou a vestir a cor do card — isto é, o
defeito da v5.241 de volta, e foi o oráculo da escada que o pegou, nos dois
temas.

**A EXCEÇÃO É O `.hymnal-card`** (v1.0.1), e ela é o caso de um bloco que quer o
MESMO degrau para si e para os filhos. Com as coleções fixas na RAIZ, o card
nasce em dois lugares — solto na folha e dentro de uma seção — e ler o pai o
deixava em `--panel` num e `--panel-2` no outro: o mesmo álbum trocando de cor
conforme alguém o tivesse agrupado, com a escada inteira de dentro dele descendo
um degrau junto. Medido no escuro com o card em `--panel`: a faixa (`--item-fill`,
recesso de 24% sobre a base do card) compunha rgb(33,40,46) e a gaveta aberta —
que já está no CHÃO da paleta (`--gaveta-bg` = `--bg`) — ficava a **1,26:1**
dela, abaixo do piso de 1,28.

Ela não revoga a regra: nenhum filho veste por engano o que o card reservou —
quem lê `--camada` ali dentro é a tampa do card aberto
(`.hymnal-card.expanded .coll-bar`), que é o próprio card, e a `.coll-songs` zera
o degrau seguinte. E o card continua sem coincidir com o que está atrás: a barra
de uma seção lê `--camada` e fica em `--panel`.

A árvore da Biblioteca fica assim, e é a mesma da tela principal um nível acima:

```
folha de tela cheia   --bg          nível 0   (era --panel até a v5.267)
  ├ seção             --panel       nível 1   (barra + corpo, UM bloco sólido)
  │   └ card do álbum --panel-2     nível 2
  │       └ faixa     (sem fundo)   separada da vizinha pelo ESPAÇO
  └ coleção fixa      --panel-2     nível 2   NA RAIZ, e com o MESMO tom (v1.0.1)
      └ faixa         (sem fundo)
```

**O preço, medido e assumido:** o degrau recuado contra o cartão cai para
1,18:1 (botão) e 1,11:1 (chip). Ali, diferente do fundo do app, o degrau não é
o que anuncia o controle — dentro de um cartão o botão tem ícone, e a linha em
`--line` do próprio cartão já o separa do resto. O que **não** era negociável
era o texto: nenhum par colorido dentro de cartão reprova AA depois desta
regra, e o ícone de cancelar download vai de 2,32:1 para **7,36:1**.

### Uma cor não serve aos dois papéis (accent / accent-fill / on-accent)

`--accent` já foi um valor único usado como **cor de texto** e como **fundo com
texto por cima**. Isso é contradição aritmética, não questão de gosto: para ser
legível COMO TEXTO sobre fundo escuro a cor precisa ser clara; para RECEBER
texto por cima precisa ser escura. Daí três tokens, um por papel:

- **`--accent-fill`** — fundo de elemento preenchido (aba ativa, botão
  primário). É o par **fundo/texto** que reprovava na paleta anterior, e não a
  cor como texto: o azul preenchido com branco por cima passava raspando
  (**4,63:1**), mas o mesmo desenho aplicado ao vermelho — o botão "no ar",
  `--danger` cheio com `#fff` — ficava em **4,23:1**, abaixo dos 4,5 exigidos.
  Separar o papel de fundo do papel de traço é o que torna esse par uma decisão
  em vez de um acidente.
- **`--on-accent`** — o que se escreve em cima de `--accent-fill`. Hoje
  **5,37:1**.
- **`--accent`** — texto, ícone e borda sobre fundo escuro: 8,65:1 sobre o
  fundo, 5,84:1 sobre painel. Elemento **decorativo** sem texto por cima (barra
  de progresso, linha de arraste, trilho de scroll) também usa este, que é o
  que os destaca.

> O texto normativo anterior citava um contraste de **2,66:1 para o azul como
> TEXTO**, e esse número não correspondia a medição nenhuma — o azul antigo
> (`#58a6ff`) dava 7,42:1 sobre o fundo. Ele fazia a régua da decisão parecer
> outra: sugeria que o problema estava no azul como texto, quando estava no
> par fundo/branco. Registrado aqui porque foi essa leitura errada que
> sobreviveu em três lugares da documentação.

### Regras do sistema

- **R1 — a superfície afunda dentro do cartão.** Acima.
- **R2 — `--live`/`--danger` NUNCA são cor de texto, ícone ou borda.** São
  escuros por construção: existem para receber `--on-live` por cima. Texto,
  ícone e borda de "no ar" ou de destrutivo usam `--live-strong`/`--danger-strong`
  (ou `--danger-text`, quando não há fundo suave da própria família).
  Usá-los como cor de traço é literalmente o defeito que produzia o 2,32:1.
- **R3 — branco literal não existe.** Sobre `--accent-fill` use `--on-accent`;
  sobre `--live` use `--on-live`; no resto, `--text`. Nenhuma das duas folhas
  contém `#fff` nem um `rgb(255,255,255)` opaco — as únicas ocorrências de
  branco são os `rgba` nomeados em `tokens.css` (`--surface`, `--stage-text*`).
- **R4 — um estado, uma cor.** A tabela de colisões acima é normativa: no ar =
  vermelho preenchido; selecionado = âmbar; concluído = verde; aviso = laranja
  suave + ícone.
- **R5 — os tokens de cor moram em `shared/tokens.css`**, carregado pelos dois
  apps. Não há mais o que dessincronizar.
- **R6 — texto secundário DENTRO de um controle preenchido herda a cor do
  rótulo com alfa, nunca `--muted`.** O cinza é calibrado contra as superfícies
  do app (fundo, painel, `--surface`), não contra o denim de `--accent-fill`:
  medido no tema claro, um "· 3/6" em `--muted` ao lado de um rótulo
  `--on-accent` ficava praticamente ilegível. Herdando com alfa, ele acompanha o
  botão em qualquer variante (normal, aviso, destrutiva) sem uma regra por
  variante.
- **R7 — um destrutivo só fica sem rótulo se for CONFIRMADO.** Quem nomeia o
  dano é o diálogo, e o `title`/`aria-label` guarda a frase para o ponteiro e
  para o leitor de tela. E o peso visual acompanha o que a peça faz: reduzido ao
  ícone, o destrutivo é o MENOR dos irmãos da linha — um alvo de um símbolo não
  ocupa a largura de um controle que carrega ação, estado e progresso.

### Contraste — o que foi medido

Todo par foi recalculado pelo algoritmo de luminância relativa da WCAG, com as
superfícies `rgba` **compostas contra o fundo real de cada contexto** — que é
justamente o passo que faltava antes. Pisos adotados: **4,5:1** para texto
pequeno, **3:1** para ícone/borda que carrega informação, **~1,30:1** para o
degrau entre duas superfícies grandes.

| Par | Antes | Agora |
|---|---|---|
| fundo × barra de abas | 1,19 ✕ | 1,32 |
| fundo × painel | 1,31 | 1,48 |
| painel × painel ativo | 1,22 ✕ | 1,28 (assumido) |
| fundo × borda | 1,95 | 2,64 |
| texto × fundo | 16,73 | 12,09 |
| rótulo apagado (`--muted`) sobre chip (`--surface-2`) no fundo do app | 4,31 ✕ | 5,06 |
| ícone de cancelar download (dentro do cartão) | 2,32 ✕ | 7,36 |
| rótulo sobre bloco de accent | 4,63 | 5,37 |
| rótulo sobre botão "no ar" | 4,23 ✕ | 4,74 |
| pior ladrilho da Bíblia | 3,94 ✕ | 8,66 |

Todas as combinações de **texto colorido contra todos os fundos do app** passam
AA, incluindo os oito fundos possíveis (fundo do app, cartão, cartão ativo,
botão e chip sobre o fundo, botão e chip dentro do cartão, botão no cartão
ativo).

### Ladrilhos da Bíblia

Deixaram de ser dez blocos saturados e passaram a ser **tinta escura + faixa
lateral de 3px com a matiz do grupo** (`--b-<grupo>` e `--bt-<grupo>`). Três
razões, e a primeira é a que motivou tudo:

- **Luz.** É a única tela do app que preenche o visor inteiro de cor, e é
  justamente a que o operador abre NO ESCURO no meio da pregação. Medida, ela
  emitia **16,3% de luminância média** contra 2,3% de um painel comum — 7×
  mais. Com a tinta são **2,8%**, ou seja **5,8× menos luz**.
- **Contraste.** Cinco dos dez grupos tinham o rótulo abaixo de AA, o pior em
  **3,94:1**. Com a tinta o pior rótulo vai a **8,66:1**, e a faixa mantém
  3,2:1 contra a própria tinta — suficiente para ela carregar a informação de
  agrupamento.
- **As matizes se sobrepunham.** `.bg-lei` e `.bg-evangelhos` ficavam a **1,4°
  de matiz** uma da outra: indistinguíveis. As novas foram redistribuídas com
  **18° de separação mínima**.

**AS MATIZES FORAM REANCORADAS NA IDENTIDADE OFICIAL (v5.192)**, e cinco delas
não puderam ser: a identidade adventista tem SETE famílias de matiz e esta
escala precisa de DEZ grupos separáveis. Cinco são oficiais e cinco preenchem os
vãos, com a separação mínima subindo para **20°**:

| Grupo | Matiz | Origem |
|---|---|---|
| lei | 220° | `bluejay` **oficial** |
| evangelhos | 240° | derivada — o vão entre bluejay e emperor |
| pmaiores | 272° | `emperor` **oficial** (a mesma matiz do `iris`) |
| pmenores | 304° | derivada — o vão entre emperor e lily |
| apocalipse | 48° | derivada — o dourado que este grupo sempre teve; a identidade não tem amarelo |
| historicos | 21° | `campfire` **oficial** |
| gerais | 101° | `treefrog` **oficial** (a mesma matiz do `forest`) |
| paulinas | 141° | derivada — o vão entre treefrog e ming |
| poeticos | 168° | derivada — idem, do outro lado |
| atos | 189° | `ming` **oficial** (a mesma matiz do `cave`) |

O `scarlett` fica **fora da escala de propósito**: vermelho é atenção neste app,
e um grupo de livros vermelho competiria com "está no ar" na mesma tela.

**No tema CLARO a tinta se inverte** — ladrilho claro, rótulo em `--text`. O
alvo do rótulo lá é **6,5:1**, e não os 8,7:1 do escuro, por aritmética: o texto
do tema claro é o `night` (#4A4A4A), não um off-white, então um ladrilho com
8,7:1 contra ele seria branco puro e a matiz do grupo sumiria — que é o oposto
do que a tela existe para fazer. Medido: pior rótulo 6,46:1, pior faixa 3,28:1
contra a própria tinta.

### Ao adicionar/alterar estilo

1. Existe token pro valor? Use-o. Não existe e o valor se repete? **Crie um
   token** — cor em `shared/tokens.css`, o resto no `:root` do Controle.
2. Fundo em accent? Escolha pelo **papel**: `--accent-fill` se houver texto por
   cima (e aí o texto é `--on-accent`), `--accent` se for texto/ícone/borda ou
   decoração.
3. Está pintando "no ar" ou "destrutivo"? R2: o traço é `--live-strong` /
   `--danger-text`, nunca `--live` / `--danger`.
4. Botão novo → acrescentar o seletor à lista `:is(...)` do feedback de toque;
   nada de tap-highlight nem de `:active` próprio.
5. Botão que alterna → ícone = ação, cor = estado (ver acima).
6. Atualizar esta seção e incrementar a versão (os três lugares — ver "Regras
   de desenvolvimento").

### Ao mexer em cor: NÃO há teste automatizado de CONTRASTE

**Não existe teste medindo contraste neste repositório**, e agora são DOIS temas
a medir à mão. O que existe, e não se confunde com isso, são dois oráculos que
pegam a classe de falha *silenciosa* do CSS: `tools/tokens.test.mjs` garante que
todo `var(--x)` sem fallback aponta para um token que EXISTE (um `var()`
inválido computa para o valor inicial da propriedade, sem aviso nenhum — foi
assim que os dois botões da folha de conectar ficaram com cantos retos na
v5.171) e que **nenhum token exista só no tema claro**; `tools/smoke.mjs` trava
o efeito RENDERIZADO nos dois temas, o palco que não os segue, a superfície que
afunda dentro do cartão e a escolha que sobrevive à recarga. Nenhum dos dois
mede razão de contraste.

O texto abaixo é de quando não havia oráculo nenhum, e o alerta continua valendo
para a COR em si. A documentação
anterior afirmava que existia ("há teste medindo isso na
tela renderizada — mudar um token para baixo desses valores falha"), e essa
frase é exatamente o motivo pelo qual dois pares (`--bg`×`--bar` em 1,19 e
`--panel`×`--panel-2` em 1,22) ficaram abaixo do piso declarado sem ninguém
notar: quem confia no doc conclui que uma regressão seria barrada no CI e
ajusta um token sem medir.

Enquanto não houver o teste, **meça à mão** antes de mudar um token: luminância
relativa WCAG, com as superfícies `rgba` compostas contra o fundo real do
contexto — **inclusive o caso "dentro de um cartão"**, que é onde as regressões
aparecem (R1).

---

## Fonte de ícones (Material Symbols)

Versão subconjuntada (~2.2 KB woff2): peso 400, **29 glifos + o espaço, todos
usados** na UI — referenciados por codepoint via o mapa `ICON` em `controle.js`
**ou** direto como entidade HTML `&#x…;` no `controle/index.html`.
**Só o Controle carrega a fonte** — o Display é só wallpaper + mídia, sem
nenhum glifo (por isso `display/index.html` não inclui
`material-symbols.css`/`.woff2`).

**Codepoints no subset** (v5.112):
```
E034 E037 E03B E03D E040 E041 E043 E044 E045 E047
E04F E050 E145 E14C E150 E251 E2C7 E2C8 E2CC E3A1
E3AD E5C4 E5CA E616 E838 E872 E945 EA5D EB80 F116
```

`E5CA` (check) entrou na v5.112 para o **pulso de confirmação**: o `✓` e o `✕`
eram os caracteres Unicode, desenhados pela fonte do SISTEMA (num Android
qualquer, a Roboto) — traço de caneta, com entrada e saída afinando e a perna do
✓ curvando. Ao lado de vinte ícones geométricos de traço constante, o sinal de
confirmação era a única coisa "desenhada à mão" da tela. Agora são `check` e
`close`, retos e do mesmo peso — e o ✕ do erro passou a ser literalmente o mesmo
glifo do botão de fechar.

A v5.110 fez a primeira limpeza real do subset: **saíram** `E5CF`
(expand_more), `E86C` (check_circle) e `E8F5` (visibility_off) — os três
estavam no woff2 sem uma única referência no código, e a varredura por
codepoint (caractere literal, `&#x…;` e `\uXXXX`) confirmou — mais `E413`
(photo_library), aposentado com a troca do ícone da aba. **Entraram** `E616`
(event_note), `EA5D` (more_time) e `E145` (add), pelas razões da caixa abaixo.
Resultado: um terço menor e sem nenhum glifo morto.

#### Cronograma × playlist: dois destinos, dois símbolos (v5.110)

Três ícones eram a mesma pilha de linhas com uma marquinha diferente no canto —
e a marquinha é justamente o que não se lê num toque:

| Onde | Antes | Depois |
|---|---|---|
| aba **Cronograma** | `photo_library` (pilha de fotos) | **`event_note`** — a agenda |
| **adicionar ao Cronograma** | `playlist_add` | **`more_time`** — relógio com `+` |
| **acrescentar à playlist** | `playlist_add` | `playlist_add` (segue) |
| playlist (transporte, `#plBtn`) | `queue_music` | `queue_music` (segue) |

O caso mais grave era o mesmo glifo (`playlist_add`) servindo aos DOIS destinos:
o botão `+` de uma linha mandava para o Cronograma e o da barra de seleção,
idêntico, para a playlist. Agora o Cronograma é a família do **tempo** — sem
linha nenhuma, então se separa da pilha à distância — e diz o que a lista é: a
ORDEM do culto, não uma fila de reprodução. A pilha de fotos, além de parecida
com as outras, nomeava a lista pelo que ela era antes da v5.103: hoje o
Cronograma guarda versículo, mensagem e contagem, não só arquivos com bytes.

O botão de adicionar da linha do acervo (`.hymn-add-btn`) virou o **`add`
neutro**: ele não escolhia destino nenhum, abria a folha que perguntava qual — e
carregar o ícone de um dos três destinos era prometer um caminho que o toque não
faz. (Ele SAIU na v5.285 com o ▶; o princípio migrou intacto para a gaveta, onde
os três destinos aparecem escritos em vez de adivinhados.)

#### Como regerar o subset

Não há dependência nova: o `.woff2` é versionado, e as ferramentas abaixo rodam
uma vez, à mão, na máquina de quem mexe.

```bash
npm pack material-symbols            # a fonte variável Outlined, do npm
pip install fonttools brotli
```

```python
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset
f = TTFont('material-symbols-outlined.woff2')
# PRENDER OS EIXOS é o que faz os glifos antigos saírem idênticos aos do subset
# anterior — a família é variável, e um `wght` diferente redesenha TUDO.
f = instancer.instantiateVariableFont(f, {'FILL': 0, 'GRAD': 0, 'opsz': 24, 'wght': 400})
o = subset.Options(); o.flavor = 'woff2'; o.layout_features = []; o.notdef_outline = False
s = subset.Subsetter(options=o); s.populate(unicodes=CPS); s.subset(f)
f.flavor = 'woff2'; f.save('material-symbols.woff2')
```

Depois **compare o antigo e o novo lado a lado** antes de trocar o arquivo: é a
única forma de perceber que um eixo ficou solto e mexeu em vinte ícones que
ninguém pretendia tocar.

**Ícones fora do subset → SVG inline.** Quando um ícone necessário não está no
subset e re-gerar o woff2 não vale a pena (ou o ambiente não tem `fontTools`),
usa-se um `<svg>` inline direto no HTML, com `fill/stroke: currentColor` (herda
a cor do botão). Hoje: o botão de **volume** do mixer (`#volToggle`, ícone de
faders/mixer), a **lupa** da busca do acervo (`#hymnSearchBtn`), a antena de
**Wi-Fi** dos cards de coleção (`wifiIconEl`), o **fone de ouvido** da mesa de
som (`#pvSoundBtn`, hoje sobre a preview), a **folha com linhas** da leitura
auxiliar (`#lyricsViewBtn`, que substituiu a flor do antigo botão de fundo da
letra), a **engrenagem** de Configurações (`#settingsBtn` — desde a v5.250 no
cabeçalho do Modo Fácil, e desde a v1.2.0 no cabeçalho dos DOIS modos), o
**relógio com a seta anti-horária** do histórico do culto (`#icoHistorico`,
v1.2.0 — `history` também está fora do subset), os **três pontos** do menu
de uma linha (`dotsIconSvg`, v5.258 — `more_vert` não está no subset), o
ícone **"arquivos+"** (documento com `+`) do botão de importar no fim do
Cronograma (`.import-btn`), que diferencia importar ARQUIVOS de abrir os
FAVORITOS (estrela, no botão ao lado — e a mesma estrela na "Nova pasta"),
os dois botões flutuantes da preview (**cast** e
**expandir** — `#pvCastBtn`/`#pvFullBtn`),
e nos **cards de coleção** a **seta de baixar** (`downloadAllIconSvg`), o **✕**
de cancelar (`closeIconSvg`), as **setas circulares** de sincronizar
(`syncIconSvg`), o **check** de "completo offline" (`checkIconSvg`), a
**engrenagem** de opções (`gearIconSvg`) com a **seta para cima** que a
substitui enquanto elas estão à mostra (`chevronUpIconSvg`) e o ícone de
**lista** (`listIconSvg`); e nos resultados da busca os botões de tocar
**voz/microfone** (Cantado, `voiceIconSvg`) e **nota musical** (Playback,
`noteIconSvg`); e o **livro com uma cruz** da aba **Bíblia**
(`.tab[data-tab="bible"]`), mais a **grade de módulos** da aba **Ferramentas** —
que substituiu o microfone quando a aba deixou de ter uma ferramenta só.

> **Borda nativa dos `<button>`**: `.tab-add` e `.pv-fab` zeram
> `border`/`appearance` explicitamente — sem isso, um `<button>` (ex.:
> `#hymnSearchBtn`) herda a **borda 3D bicolor (bevel)** do sistema, fora do
> padrão do app. O mesmo motivo do `appearance:none` no `.lib-search`
> (`type="search"`).

---
