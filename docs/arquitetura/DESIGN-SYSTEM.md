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
| `--bg` | `#0b1219` | `#dfe3e7` | fundo do app. A matiz é a do denim (211°) em vez de um cinza puro: um cinza neutro ao lado de um accent azul lê como esverdeado |
| `--bar` | `#1b2632` | `#ffffff` | bottombar / trilho de abas |
| `--panel` / `--panel-2` | `#212f3d` / `#304254` | `#ffffff` / `#dee2e8` | cartões e linhas de lista / o item ativo ou selecionado. **A direção se inverte no claro** (ver "A montagem dos dois temas") |
| `--poco` | `#34475b` | `#cbe0f6` | **a segunda e última superfície** (v1.5.14). A Biblioteca tem quatro níveis e a escada tem três degraus; em vez de empilhar um quarto tom (impossível — ver "A escada"), o nível 1 veste o poço e o nível 2 volta ao PAPEL. Duas superfícies, profundidade ilimitada. 1,43:1 contra a janela no escuro, 1,36:1 no claro. No claro é o `--btn-accent` (o "azul fraco" pedido na v1.5.10) aprofundado até o degrau ser real — aquele mede só 1,21:1 |
| ~~`--line`~~ | — | — | **SAIU na v1.5.14.** Removida a moldura da Biblioteca, ficou com zero consumidores. O comentário dele dizia que *"o que ele NÃO pode voltar a ser é um filete"* enquanto ele era o único filete do app |
| `--divisoria` | `rgba(255,255,255,.20)` | `rgba(0,0,0,.28)` | **a divisória entre faixas IRMÃS** (v1.5.16), a quarta exceção nomeada da regra de contorno — e a única que é um traço. Desde a v1.5.14 a faixa é transparente sobre `--panel`: o vão de 4px entre duas faixas mede **1,00:1** contra os dois lados, que é separação nenhuma. Estes valores dão **1,88:1** e **1,99:1** sobre a placa, contra os 1,78:1 e 2,51:1 da moldura removida. Alfa e não valor fixo porque a placa muda de tom entre os temas; mais forte no claro porque sobre branco o mesmo alfa rende menos (.20 mediria 1,61:1). Consumidor ÚNICO, cobrado por oráculo nos dois sentidos — uma DECLARAÇÃO só, hoje com dois seletores (a faixa de um álbum e a linha de um favorito, v1.5.18) |
| `--surface` / `--surface-2` | `rgba(255,255,255,.12)` / `.18` | `rgba(255,255,255,.70)` / `.92` | botão / chip-campo-badge **sobre o fundo do app** (ver R1). Branco com alfa nos DOIS temas: o controle FLUTUA sobre a página |
| `--surface-sunk` / `--surface-2-sunk` | `rgba(0,0,0,.24)` / `.14` | `rgba(0,0,0,.14)` / `.20` | os mesmos dois **dentro de um cartão**, onde o sinal se inverte e o controle AFUNDA. Eram literais em `controle.css` até a v5.192 — os últimos pedaços de cor fora da fonte única, e o tema claro herdaria um recesso de 24% de preto sobre um cartão branco |
| `--text` / `--muted` | `#dce0e5` / `#b6bdc6` | `#000000` / `#565d66` | texto (14,19:1 sobre o fundo · 9,52:1 sobre painel no escuro; 16,28:1 · 21:1 no claro) / secundário. **No claro o `--text` é PRETO desde a v1.5.12** — o ÚNICO desvio declarado da paleta oficial, a pedido do operador (*"use a cor preta pra os textos e não cinza como me parece ser hoje"*): ele era o `night` OFICIAL (#4a4a4a), que É um cinza escuro e se lia como texto apagado sob a luz de um salão. `--muted` NÃO acompanhou — é ele que mantém a regra NOME × NÚMERO da v1.5.11, e o par abriu de 1,33:1 para 3,15:1. Ele é derivado porque o `winter` oficial (#717171) passa sobre branco (4,88:1) e cai para 3,81:1 sobre o cinza da página |
| `--accent` | `#95b5f4` | `#2f557f` | o azul como **texto e ícone**. No escuro é o `bluejay` CLAREADO (o oficial dá 3,97:1 sobre o fundo e reprova): 9,17:1 sobre o fundo, 6,64:1 sobre painel (medidos contra o fundo DENIM PROFUNDO da v1.5.14). No claro é o `denim` OFICIAL: 7,70:1 sobre painel, 5,97:1 sobre a página |
| `--accent-fill` | `#2f557f` | `#2f557f` | o **`denim` OFICIAL** como fundo de elemento preenchido (aba ativa, botão primário), nos dois temas. 2,44:1 contra o fundo escuro — exatamente o peso que o preenchido âmbar tinha (2,59:1) |
| `--on-accent` | `#e8edf3` | `#ffffff` | o que se escreve **em cima** de `--accent-fill` — 6,54:1 e 7,70:1. O par branco-sobre-denim é o que a própria identidade recomenda; no escuro vale a regra do off-white, e a folga sobra nos dois |
| `--accent-soft` | `rgba(143,177,243,.16)` | `rgba(47,85,127,.12)` | fundo suave de estado ativo |
| `--stage-accent-glow` | `rgba(143,177,243,.32)` | *(idem — é do PALCO, logo sem tema)* | halo do `.start-pill` do Display. Segue a MATIZ do accent, não o `--accent-fill`: um halo na cor do preenchimento (escuro por definição) sobre o fundo escuro seria invisível. **Saiu do botão de conectar do simplificado bloqueado na v5.75** — ali quem separa o botão do fundo é a cortina embaçada |
| `--brand` / `--brand-text` | `#95b5f4` / `#c2d4f8` | `#2f557f` / `#24446a` | marca ("IASD"): logo, capa da letra, pill "Ligar Sistema", rótulo de estrofe, destaque da busca por letra. Mesmo valor do accent — os dois nomes existem para distinguir marca de navegação na folha |
| `--live` | `#d0021b` | `#d0021b` | o **`scarlett` OFICIAL**, e **só** como preenchimento de "está no ar agora". Como texto ele reprova: 3,32:1 sobre o fundo escuro. (O gêmeo `--danger` saiu na v1.5.14: zero consumidores, e a razão escrita para o não-uso — *"ação destrutiva é sempre CONTORNADA"* — tinha morrido com o contorno, na v5.267) |
| `--on-live` | `#f6eeef` | `#ffffff` | o que se escreve sobre `--live` — 4,96:1 e 5,67:1 |
| `--live-strong` / `--danger-strong` | `#f97a7e` | `#b80419` | **o vermelho que se lê como vermelho** (v5.76): ícone, borda e marca preenchida. Derivado do `scarlett` (matiz 358°/353°), clareado no escuro e escurecido no claro. Escuro: 7,27:1 sobre `--bg`, 6,59:1 sobre o soft, 4,88:1 sobre `--panel`, **3,77:1 sobre `--panel-2`** — este passa o piso de borda e reprova o de texto, e é por isso que quem veste este vermelho veste junto o fundo suave da própria família. Claro: 4,63:1 sobre o soft, 6,84:1 sobre o painel |
| `--danger-text` | `#e98d83` | `#93382e` | o salmão, para os TRÊS casos em que o `-strong` não serve: a falha na miniatura do YouTube, o pulso de erro e o aviso de falha pousado direto no painel — 5,17:1 sobre `--panel` no escuro, 7,38:1 no claro |
| `--live-soft` | `rgba(208,2,27,.22)` | `rgba(208,2,27,.14)` | wash de "no ar" — hoje só o `box-shadow` do pulso. **É wash, nunca superfície de controle** (ver `--btn-*`), e foi essa regra que esvaziou a família: dos seis `-soft`, só este tem consumidor. Os outros quatro (`--danger-soft`, `--warn-soft`, `--ok-soft`, e o `--accent-soft` que ficou) eram defendidos por "servem ao wash" — a v1.5.14 mediu e removeu os que não serviam a nenhum |
| `--btn-accent` / `--btn-danger` / `--btn-warn` / `--btn-ok` | `#293d57` / `#5d282e` / `#533423` / `#2a431e` | `#dcebfe` / `#fde3e6` / `#f8e7de` / `#d5f5c6` | **a superfície OPACA de um botão ou chip** em cada família (v1.3.14). Recebem por cima o traço que a família já tinha (`--accent`, `--danger-strong`, `--warn`, `--ok`). Ver "A superfície de uma ação é opaca" |
| `--warn` / `--warn-text` | `#ef853f` / `#e5a86c` | `#bd520a` / `#934410` | aviso: borda/ícone, texto, fundo. Derivados do **`campfire` OFICIAL** (matiz 21°) — 6,34:1 e 7,95:1 sobre o próprio suave no escuro; 3,38:1 (piso de ícone) e 4,81:1 no claro |
| `--ok` | `#80bd64` | `#216900` | concluído/conectado. Derivado do **`treefrog` OFICIAL** (matiz 101°), clareado e DESSATURADO no escuro — no talo ele vira um limão que grita mais que o accent. 5,64:1 sobre painel · 8,41:1 sobre o fundo; no claro 6,81:1 sobre o painel |
| `--stage-bg` / `--stage-text` | `#000` / `#fff` | *(idem)* | **o palco**, não a UI, e por isso NÃO tem tema: o preto é preto de verdade (as barras do letterbox têm de sumir na moldura da TV) e o texto projetado é branco pleno — num telão a legibilidade vem de luminância máxima, não de um off-white calibrado para uma tela a 30 cm do rosto |
| `--stage-text-soft` / `--stage-text-dim` | `rgba(255,255,255,.9)` / `.72` | *(idem)* | marca sobre o wallpaper / linha auxiliar da letra |
| `--scrim` | `rgba(0,0,0,.6)` | *(idem)* | cortina de modal (bottom-sheets e diálogo). Preta nos dois temas — é assim que um modal se destaca em qualquer UI, e no claro ela é o único elemento que precisa vencer uma página branca |
| `--shadow-cap` / `--shadow-card` / `--shadow-ink` | `rgba(0,0,0,.5)` / `.55` / `.9` | *(idem)* | as três elevações nomeadas. Compartilhadas porque sombra é preto com alfa nos dois temas, e os consumidores de `--shadow-ink`/`--shadow-card` pousam sobre a preview (mídia arbitrária), onde clarear a sombra é apagá-la |
| `--veil` / `--veil-solid` | `rgba(14,18,21,.55)` / `.92` | `rgba(223,227,231,.55)` / `.92` | cortina do bloqueio do modo simplificado. É o `--bg` com alfa, e os dois têm de andar **juntos**: senão o véu vira um retângulo mais escuro (ou mais claro) que o app inteiro, justamente na tela que abre por padrão sem TV conectada. A variante sólida cobre o caso sem `backdrop-filter` |
| `--wallpaper` | `#04070d` | *(idem)* | a cor de BASE por baixo do desenho padrão do telão (o símbolo oficial sobre denim profundo, em `shared/wallpaper-padrao.svg`). **A URL não pode morar no token**: um `url()` substituído por `var()` resolve contra a PÁGINA, não contra a folha — quem aponta para o SVG são `display.css` e `controle.css`, com o mesmo caminho relativo |
| `--lyrics-frame-bg` | `rgba(0,0,0,.62)` | *(idem)* | fundo da faixa da letra (modo imagem). **Sem borda**: o contorno branco desenhava um retângulo que competia com a letra, e quem separa o texto da foto é a faixa. A densidade foi escolhida pelo PIOR caso — uma foto branca: `.40` deixava o fundo em ~`#999` (**2,85:1** com o texto branco, reprovado); `.62` põe em ~`#616161`, **6,2:1** |
| `--b-*` | dez | dez | ladrilhos da Bíblia: a tinta do grupo, UMA banda por ladrilho, invertida entre os temas. Ver "Ladrilhos da Bíblia". (Os `--bt-*` da faixa lateral saíram na v1.3.15 com ela) |
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
| `--press` / `--press-luz` | `translateY(2px)` / `brightness(1.35)` · `.88` no claro | feedback de toque: recuo ABSOLUTO mais luz. Ver "Feedback de toque" |
| `--fs-2xs`…`--fs-4xl` (9) + `--fs-display-sm` / `--fs-display` | `.60` `.68` `.74` `.82` `.90` `.95` `1.05` `1.15` `1.25` + `1.6` `2.6` rem | **a escala tipográfica** (v1.5.14). Eram 31 corpos distintos em 126 declarações. Os degraus saíram da DISTRIBUIÇÃO REAL de uso (o pico é `.82rem`, 19 declarações — o corpo de uma linha de lista), e não de uma fórmula: entre cinco escalas candidatas esta é a que move menos pixel — sete declarações mudam mais de 0,65px, e a maior mudança é 0,8px. Consolidar não podia custar um redesenho acidental |
| `--sp-1`…`--sp-6` | `.15` `.25` `.35` `.5` `.6` `.8` rem | **a escala de espaço** (v1.5.14). Eram 16 valores de `gap` quase contínuos em passos de .05, isto é, nenhum ritmo. 71 das 110 declarações caem EXATAS num degrau; o resto se move no máximo 1,6px — o que não se vê numa peça e se sente no conjunto |
| `--dur-rapida` / `--dur-media` / `--dur-lenta` | `.14s` / `.2s` / `.3s` | **a escala de movimento** (v1.5.14). Eram dez durações de transição entre .12s e .3s — faixa em que o olho não distingue os degraus, mas em que peças VIZINHAS animam em tempos diferentes, e isso se nota. As ANIMAÇÕES ficam de fora e mantêm o tempo delas: um pulso de 1,2s não é uma transição de interface |
| `--fw-normal` / `--fw-medio` / `--fw-forte` / `--fw-max` | `400` / `600` / `700` / `800` | **os quatro pesos** (v1.5.14). Eram cinco valores para quatro papéis — o `500`, com três usos, não se distinguia do `600`. Nomeados, a escolha deixa de ser um número e passa a ser um papel |
| `--bar-secao-h` | `calc(var(--hit) + .7rem)` | a altura da barra de uma seção da Biblioteca. É token porque DUAS regras precisam do mesmo número (a barra gruda em `top: 0`, a do álbum logo abaixo dela); escrito duas vezes divergiria, e o sintoma seria o cabeçalho de dentro cobrindo o de fora. Determinístico: o nome é `nowrap` e o recuo é fixo — nada de medição em JS, que a v1.5.3 ensinou a desconfiar. **Era `+ 1.1rem` até a v1.5.16**, e quem o apertou foi o ORÇAMENTO da lista colapsada — não o desenho da barra |
| `--faixa-coluna-texto` | `calc(.5rem + 38px + var(--sp-4))` | onde a coluna do NOME de uma faixa começa — o recuo da linha, mais a miniatura, mais o vão. É token porque é o que RECUA a `--divisoria`, e é isso que a torna *"não borda inteira"*: ela começa no texto, nunca sob a miniatura. Aritmético, não medido — a miniatura tem lado fixo. **SOBRESCRITO na `.fav-itens`** (v1.5.18): lá a miniatura é `--thumb` (40px) e não a `.hymn-play-thumb` de 38 — o valor entra por herança de custom property, nunca copiado para uma segunda regra |
| `--lib-fade-h` | `22px` | a altura de cada véu da borda do scroll da Biblioteca (v1.5.16) |
| `--bar-raiz-max` | `calc(var(--hit) + 2rem)` | **o teto do bloco de raiz que cresce** (v1.5.17). Os blocos colapsados da Biblioteca ganharam `flex-grow` para preencher a altura da tela — o navegador reparte a sobra quando o conteúdo cabe e o crescimento é inerte quando ele transborda. O teto existe porque a lista pode ter POUCOS blocos: sem ele, três coleções dão 183,28px cada, que é o defeito oposto. Anda com `min-height: min-content`, senão um card com subtítulo é RECORTADO (MEDIDO, 45,19 → 40,00 com um teto de 40) |
| `--opcao-recuo-v` / `--opcao-recuo-h` | `.6rem` / `.7rem`, e `--sp-2` / `--sp-5` dentro de `.hymn-gaveta` | **o recuo de uma linha de opção** (v1.5.17). O `.song-menu-btn` é a linha da gaveta E de três folhas modais (destinos, vídeo do YouTube, playlist automática); o operador pediu a densidade *"das listas que temos na biblioteca"*, e apertar o seletor cru levava as três folhas junto (MEDIDO: a de destinos caía de 312,30 para 267,55px). Com o par no `:root` e a GAVETA sobrescrevendo, o alcance é o que o pedido nomeia — quem declara a medida dos filhos é o PAI, a mesma regra da casa do `--camada`. Ele também fecha a duplicação que a folha reclamava: o `min-height` da faixa de confirmação lia o número do botão COPIADO, e um aperto fazia a linha PULAR +11,19px sob o dedo ao perguntar *"excluir?"* |
| `--lib-lista-base` | `var(--sp-5)` | o recuo de baixo da lista da Biblioteca — o MESMO `gap` que separa dois blocos de raiz (v1.5.18): com o crescimento preenchendo o resto, qualquer outro número põe o último bloco a uma distância da borda que nenhum par de vizinhos tem. É token porque o véu de baixo precisa ANULÁ-LO (`bottom: calc(-1 * var(--lib-lista-base))`): sem isso ele gruda acima do recuo e deixa uma faixa de conteúdo nítido embaixo dele. A `env(safe-area-inset-bottom)` entra **só** em `body.mode-simple` e `body.lib-aberta.teclado` — os dois casos em que a janela encosta na base; desde a v1.5.4 ela para na linha dos controles, e a barra de gestos fica abaixo DELES |
| `--op-inativo` | `.35` | **o véu de INATIVO** (v1.5.15). Ele estava escrito em três `:disabled` (`.slide-btn`, `.t-btn`, `.sel-btn`) e ganhou um quarto consumidor que não é um controle: o cartão da linha do tempo, que o operador mandou vestir *"o mesmo cinza claro dos botões inativos de próximo e anterior slide"*. O cartão o consome por `color-mix` sobre `--surface` JÁ RESOLVIDO ali — um token de cor novo teria de repetir a bifurcação inteira do R1 para dizer a mesma coisa |
| `--kb` | `0px` | altura coberta pelo teclado virtual, escrita pelo JS (ver "Deslocamento com o teclado virtual") |

### Métodos/convenções visuais padronizados

- **Feedback de toque: RECUO ABSOLUTO + LUZ, nunca uma fração** (v1.3.14). A
  regra é **UMA SÓ**, um `:is(...)` com a lista de seletores logo depois do
  bloco `:root` — antes ela estava repetida em 17 lugares e, ainda assim, nove
  controles ficavam de fora (voltar, abas, seleção múltipla, botões de linha,
  fechar popup…): como o `*` zera o tap-highlight, esses ficavam **totalmente
  mudos ao toque** no aparelho. Com a lista única, um botão novo entra
  acrescentando um nome.

  O VALOR era `scale(.96)`, e uma FRAÇÃO aplicada a alvos de 34px a 408px não é
  um valor: são doze. MEDIDO, o recuo por lado que ela produzia:

  | alvo | caixa | recuo |
  |---|---|---|
  | `.back-btn` · `.popup-close` | 34×34 | **0,7px** — imperceptível |
  | `.t-btn` | 53×36 | 1,1 lateral · 0,7 vertical |
  | `.bible-cell` | 52×52 | 1,0 |
  | `.tab` | 143×38 | 2,9 lateral · 0,8 vertical |
  | `.dialog-btn` | 157×33 | **3,1 lateral · 0,7 vertical** |
  | `.lib-item` | 408 | **8,2px** — exagerado |

  São as duas queixas do operador de uma vez (*"encolhendo muito os elementos"*
  e *"em diversos casos não há feedback… no caso de botões de confirmar
  exclusão"*), e o `.dialog-btn` É o botão de confirmar exclusão: 3,1px de
  deslocamento LATERAL e 0,7 de vertical — um aperto de lado, que não se lê como
  "apertei".

  Hoje `--press` é **`translateY(2px)`**: o mesmo recuo em qualquer alvo, a
  metáfora da tecla que afunda. Duas consequências de graça — o risco de
  HIT-TEST some (era a razão de o `.coll-bar` não escalar: MEDIDO, 6 de 11
  toques no botão de baixar erravam quando a barra de 408px recuava 8px de
  lado), e some a FRESTA do aninhamento (dois `--press` eram 0,96 × 0,96 e
  deixavam o filho 7px mais estreito que os irmãos; dois recuos são 4px na mesma
  direção, sem mudar de largura).

  E ele vem com **`--press-luz`**, um `filter: brightness()` — `1.35` no escuro,
  `.88` no claro. `filter` e não um overlay de fundo por três razões: não
  precisa saber a cor do controle, responde no que NÃO tem fundo nenhum
  (acendendo o próprio traço) e não disputa propriedade com quem já usa
  `background-image` — a faixa da célula da Bíblia, a pílula do livro, o vazado
  da aba. MEDIDO no escuro: 1,27:1 sobre a superfície de um botão, 1,56:1 sobre
  o preenchido, 1,86:1 num glifo sem fundo.

  **E ELE PEDE UMA TECLA — sobre a PREVIEW não há nenhuma** (v1.4.33). Relato do
  operador: os botões de mudo e da cortina *"ainda estão erroneamente com o
  feedback tátil de quando ainda estavam na barra"*. O `.pv-fab` não tem
  pastilha — ele É o traço branco sobre o que estiver projetado (ver "os ícones
  nos cantos da preview") —, e a metáfora da tecla que afunda precisa de uma
  tecla: ali o recuo se lê como o ícone PULANDO por cima da imagem no ar, e sem
  TV essa imagem é a projeção.

  **E a LUZ não cobre por ele.** MEDIDO no `#muteToggle` sobre o wallpaper:

  | | repouso | pressionado | Δ |
  |---|---|---|---|
  | traço (px claros) | 240,6 | 238,3 | **−2,3** |
  | fundo | 14,3 | 14,5 | +0,26 |

  Um traço BRANCO já está no teto — `brightness` não tem para onde subir, e o
  que ela move é o halo ESCURO, desbotando o contorno. Os `1,86:1` medidos na
  v1.3.14 são de um glifo colorido sem fundo, não de um traço branco.

  Por isso o `.pv-fab` **saiu da lista** e tem resposta própria: a **pena do
  traço** (`stroke-width`), com o halo engrossando junto. É a única coisa que
  responde sobre um fundo DESCONHECIDO — um slide branco, um wallpaper escuro,
  um vídeo. MEDIDO nos dois extremos:

  | fundo | mudo | tela cheia |
  |---|---|---|
  | escuro | média 32,9 → 39,7 (**+21%**) | 28,1 → 33,0 (+17%) |
  | slide branco | 215,0 → 192,9 (**−10%**), +67px de contorno | 212,8 → 183,9 (−14%), +107px |

  **Não é uma escala**, e a regra do recuo absoluto segue intacta: a caixa não
  muda de tamanho (nenhum pixel de alvo, nenhum risco de hit-test) e o valor é o
  mesmo em todo `.pv-fab`, inclusive o de 28px da tela cheia. Quem TEM tecla
  continua afundando os 2px.

  **E O ECO NÃO É DE QUEM TROCA O DESENHO** (v1.4.36). O azul que sobrou não era
  da plataforma: era o `.btn-eco`, o anel que diz *"o comando saiu"* — e ele
  entrou na cortina e no mudo na v1.3.14. Duas razões o tiraram de lá, e cada uma
  bastaria. **Ele é REDUNDANTE:** os dois são alternadores, o ícone vira o oposto
  no mesmo instante do toque, e isso já é o comando saindo. **E ele desenha uma
  CAIXA que não existe:** o anel é `inset: 0` + `border-radius: inherit`, isto é,
  a caixa do botão — um `.t-btn` tem uma, um `.pv-fab` não —, em `--accent`, um
  token de CROMO por cima do palco (a classe de erro que a família `--stage-*`
  existe para impedir). O transporte fica: lá os ⏮/▶/⏭ não trocam de desenho, e é
  por isso que o eco nasceu.

  **E O QUE A PLATAFORMA PINTA POR CIMA** (v1.4.34). Tirado o deslocamento, o
  operador relatou que ainda via *"a onda azulada de feedback de toque"* no mudo
  e na cortina. Nenhum token do app é azul ali — quem pinta é o UA, por dois
  caminhos, e os dois foram fechados:

  - **o realce de toque** (`-webkit-tap-highlight-color`) estava no `*` **sem
    `!important`**, e a declaração AO LADO dele documenta por que isso não basta
    (a folha do UA vence `*` — foi por isso que `user-select` ganhou o seu).
    Invisível sobre a superfície de um `.t-btn`, muito visível sobre um
    `.pv-fab`, que não tem fundo e mora em cima da imagem projetada.
  - **o anel de foco** (`outline-style: auto`, que o Chromium desenha do jeito
    dele — azul no WebView). O `*` deixa `outline` de fora **de propósito**, mas
    a intenção escrita ali é *"é o anel de foco do teclado"*; um `<button>` fica
    com `:focus` depois do toque, então o anel não pisca: ele GRUDA até o foco
    sair. `:focus:not(:focus-visible) { outline: none }` aplica a intenção que já
    estava escrita, sem tirar o anel de quem navega por teclas.

  **O que o oráculo NÃO prova, e está dito:** a metade do PONTEIRO é inalcançável
  no Chromium de mesa — MEDIDO por reversão, ele já não desenha anel num foco de
  ponteiro, então a asserção passava com e sem a regra. Ficou a FORMA (a regra
  existe e é escopada) mais o comportamento alcançável (o anel do TECLADO
  sobrevive), na natureza que o `rotina-cede-a-vez.test.mjs` já declara.

  **Um ANCESTRAL não responde ao toque que foi para um filho** — e as guardas
  suprimem as DUAS partes: matar só a geometria deixaria o bloco inteiro
  acendendo por um toque de 40px, o mesmo defeito por outra propriedade.

  **A LISTA DE GUARDAS É O QUE ENVELHECE, não a regra.** A `.row-acoes` — a
  faixa de opções da linha, que é onde o operador de fato toca — ficou de fora
  dela até a v1.4.25, e o cartão do Cronograma balançava 2px a cada toque no
  excluir (*"um pequeno movimento vertical do card… essa movimentação não faz
  sentido, já que essas opções surgem deslizando dentro do próprio card"*). A
  gaveta dos FAVORITOS já estava coberta por `.hymn-gaveta`, e era só isso que
  fazia o defeito aparecer numa lista e não na outra. **Bloco novo que hospede
  controles entra na lista no MESMO lote em que nasce** — e o caso da faixa é o
  mais forte da regra: ali a resposta ao toque nem é o botão afundando, é a
  faixa TROCANDO DE CONTEÚDO (a pergunta do excluir, o campo do renomear).

  **A regra foi cobrada uma versão depois de escrita**, e vale como exemplo do
  que ela pega: o `.row-slot` da v1.4.27 — a coluna do `⋮` emprestada ao
  processo, que hospeda o ✓ do renomear — vive FORA da `.row-acoes`, e a guarda
  acima cobre a FAIXA. Sem acrescentá-lo à lista, o balanço voltava pelo botão
  novo, no mesmo cartão e pelo mesmo caminho.

  **E DENTRO DA FAIXA O BOTÃO RESPONDE PELA LUZ, não pela geometria** — MEDIDO:
  `.acoes-abertas .row-acoes > * { transform: none }` (0,3,0) vence o `:active`
  da lista de controles (0,2,0), porque ali o `transform` é da animação de
  entrada da própria faixa. É o mesmo arranjo dos outros BLOCOS, e um oráculo
  que cobrasse `transform` ali reprovaria o app que está no ar.
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

#### O ECO é de quem MANDA ALGO PARA A PROJEÇÃO (v1.3.14)

Um anel curto em accent que nasce colado no botão e se abre desaparecendo
(`.btn-eco`, 420 ms). Ele **não é a resposta de toque**, e a distinção é o que o
justifica: `--press` (o recuo mais a luz) diz *"recebi o dedo"* e vale para todo
controle; o eco diz *"o comando saiu"*, e existe porque a resposta de verdade
pode estar a ~1 s quando a projeção são as telas da rede — um botão que fica um
segundo sem responder é tocado de novo, e o comando vai duas vezes. Duas
mensagens, dois sinais, e é por isso que convivem no mesmo botão.

Ele valia para `.transport .t-btn, .mixer-mid button` — e `.mixer-mid` **não
existe** desde a v1.3.8, quando o mixer saiu. Na prática o anel era exclusivo
dos seis botões do transporte, e foi assim que o operador o leu (*"o feedback
único dos botões de play, com bordas flutuantes totalmente exclusivo no app"*).
Ele está certo sobre a exclusividade, e o conserto não é apagar o sinal: a razão
dele vale IGUAL para os outros botões que falam com o telão. O que faltava era a
REGRA.

Recebem o eco (`ECO_SELETOR`, em `controle.js`): o transporte, os dois botões de
slide que flanqueiam a preview, a cortina, o mudo, a coluna da tela cheia e
"Projetar no telão". Ficam de fora navegação, Configurações e a lupa do acervo —
um eco ali prometeria uma viagem que não acontece.

**⏮/⏭ foram um terceiro caso até a v1.3.5** — o único em que a cor não dizia um
estado do sistema e sim o EIXO do botão: `.slide-mode` (contorno em accent) = "o
toque curto passa estrofe"; `.axis-end` (esmaecido) = "esse caminho acabou, o
toque longo ainda troca de mídia". As duas classes saíram com o eixo duplo do
transporte: quem passa slide são dois botões PRÓPRIOS ao lado da preview, e um
botão com um significado só não tem eixo a anunciar. O que diz "não há para onde
ir" ali voltou a ser o `disabled` de sempre.

### Uma linguagem de ESTADO só (v1.3.14)

O app tinha **três** maneiras de dizer "isto está ativo", e a terceira é a que o
operador reclamou (*"o botão de selecionar repetição altera apenas sua cor
interna quando ativo, sendo pouco visível"*):

| como era dito | onde |
|---|---|
| preenchido em `--accent-fill` | `.bible-cell.active`, `.misc-tab/.misc-seg/.misc-chip.active`, `.fit-opt.active` |
| `--sel-fill` opaco na linha | `.lib-item.active`, `.bible-vsec.cur` |
| **só cor de TEXTO** | `#repeat.active`, `.tab.active`, `.bible-ver-row.selected`, `.hymnal-card.expanded`, `.folder-opfs.expanded` |

A regra, e ela responde a QUATRO perguntas diferentes com quatro respostas:

- **ESCOLHIDO entre alternativas** (uma célula, um segmento, um chip, uma aba) →
  **preenchido**: `--accent-fill` + `--on-accent`.
- **LIGADO** (um interruptor de um modo só, sem irmãos disputando) →
  **superfície de ação**: `--btn-accent` + `--accent`. É o caso do `#repeat`, e
  ele é o extremo da regra: em todo outro interruptor do app o DESENHO muda
  junto (a estrela de favorito enche, o `+` da fila vira `✓`) e a cor é reforço;
  ali o glifo não pode mudar, porque ele CICLA por quatro modos e já está
  ocupado dizendo qual está valendo. MEDIDO: o fundo não mudava (1,00:1 entre
  ligado e desligado); hoje são 1,73:1, com o traço a 5,37:1.

  **E DESDE A v1.4.25 A ESTRELA E O `♫+` SEGUEM ESTA LINHA INTEIRA**, não só a
  metade do desenho. Eles diziam "apagado" com `--line` — a cor de LINHA, que
  neste app só o `↑↓` INERTE veste —, e o operador lia o botão como
  indisponível: *"ao invés de modificar o ícone do botão e seus efeitos, foi
  simplesmente ofuscado o botão inteiro, o que dá a impressão de que não está
  disponível a opção"*. Hoje **apagado é o botão de sempre** (`--surface` +
  `--text`) e ligado é `--btn-accent` + `--accent`, com o desenho continuando a
  carregar o estado sozinho. A régua que fica: **ofuscar não diz "desligado",
  diz "indisponível"** — e para isso o app já tem `opacity: .3` + `disabled`.
- **SELECIONADO numa lista** → `--sel-fill`, opaco.
- **ABERTO** → **não é cor.** A seta que gira, o corpo à vista e a sombra da
  tampa já dizem, e gastar a cor de seleção nisso faz o mesmo estado sair de
  duas cores conforme o tipo do bloco (uma SEÇÃO aberta nunca pintou o nome
  dela). No card da Biblioteca quem diz "isto levantou" é o degrau de ELEVAÇÃO.

  **E A LINHA COM GAVETA É A EXCEÇÃO NOMEADA À FRASE ACIMA** (v1.5.17 →
  v1.5.18). O `.lib-item.expanded` pintava um overlay de `--surface-sunk`,
  escrito na v5.271 quando a faixa FECHADA já vinha recuada (`--item-fill`) —
  ele era MAIS UM degrau sobre um degrau existente. A v1.5.14 tirou o
  preenchimento do nível 3 e a premissa caiu: o overlay virou o ÚNICO tom da
  faixa aberta, num lugar que a alternância não tem (`--panel` +
  `rgba(0,0,0,.24)` = rgb(25,36,46), o pixel medido). MEDIDO entre o título e o
  corpo do MESMO item: **1,15:1** no escuro e **1,39:1** no claro — o relato.
  E o achado que decidiu o lote: na lista de BUSCA, onde `--linha` é OPACO e a
  `.row` esconde o overlay, o mesmo par já media **1,00:1**. *O app tinha duas
  leituras da mesma gaveta, e ninguém tinha escolhido entre elas.*

  **A v1.5.17 escolheu a de cima, o operador escolheu a de baixo.** Removido o
  overlay, tampa e corpo do item ficavam os dois em `--panel` — e o relato
  seguinte foi *"as opções de play não estão colorindo o card dono daquelas
  opções … o card titular do item não ganhou a cor de seleção/cor do corpo da
  caixa de opções"*. Para quem opera, o corpo de um item aberto é o POÇO da
  gaveta, a superfície grande que o toque abriu — não o papel dos blocos que
  descansam nela. Hoje a tampa veste **`--gaveta-bg`**: MEDIDO, tampa e poço a
  1,00:1 nos dois temas, e os botões (`--gaveta-btn`) flutuando dentro deles a
  1,196:1 no escuro e 1,338:1 no claro.

  **`background` na `.row`, e não `--linha`.** As quatro listas resolvem esse
  token de jeitos diferentes — transparente no acervo e nos favoritos,
  `--camada` na busca, `--surface` na pasta do aparelho — e uma delas é escopada
  com id; pintar a superfície direto atravessa as quatro com um seletor só. Os
  três `:not()` são a PRECEDÊNCIA DO ESTADO: uma linha NO AR que o operador abra
  continua vermelha. E a `--divisoria` acima dela SOME, de propósito — o traço
  mora sob a `.row` (`z-index: 1`), e ali quem separa passa a ser o
  PREENCHIMENTO, que é a regra já escrita ao lado do token.

  *"Aberto não é cor"* continua descrevendo o ACORDEÃO — a seção, o álbum, a
  pasta —, e a linha com gaveta é a exceção, escrita ao lado da regra para não
  ser apagada por coerência.

**Cor de TEXTO nunca carrega estado sozinha.** Onde ela carregava, ou o estado
ganha superfície, ou ele já é dito pela forma e a cor sai.

#### Quando AÇÃO e ESCOLHA dividem a mesma faixa, o CHEIO fica com a ESCOLHA

O accent cheio serve aos dois papéis em todo o app — é o botão primário
(`.cast-acao`, `.dialog-btn.primary`) e é o segmento escolhido — e fora do
trilho de navegação isso nunca colide, porque os dois não dividem a mesma faixa.
Ali dividiam, e o desempate estava invertido: o cheio ficava com a AÇÃO (a
busca) e a ESCOLHA caía num vazado de **1,32:1** — degrau que o próprio texto
que o defendia admitia ser "pouco num salão escuro", deixando a cor do ícone
carregando o estado sozinha. Era a queixa *"a alternância entre bíblia e
cronograma já não condiz com o sistema de seleção atual"*.

A busca desceu para a superfície de ação (`--btn-accent` + `--accent`), onde
segue destacada — numa fileira em que a aba inativa não tem fundo nenhum, ela é
a única célula com superfície.

**E A ABA ATIVA NÃO É PINTADA** (v1.3.15). A v1.3.14 respondeu ao vazado fraco
com a célula PREENCHIDA, e isso resolveu a leitura criando outro problema —
pedido do operador: *"use um método visual de seleção que seja mais discreto,
menos volumoso, para não disputar a presença visual com o botão de pesquisa; não
pinte todo o botão da aba"*. Ele está certo: numa faixa de três células, duas
manchas cheias de azul disputam, e a que menos deveria disputar é a que só diz
"você está aqui".

Hoje é o que uma aba sempre foi: uma **barra de 3px** encostada na borda de cima
da célula ativa, em `--accent`, com o glifo na mesma cor. Duas marcas de TRAÇO,
nenhuma de área — ela liga a aba à tela que desce dela e não gasta superfície.
A cor não carrega o estado sozinha (é saturada contra o cinza quase neutro do
trilho, e vem acompanhada do glifo), e o `.tab-ind` continua sendo o que sempre
foi: um elemento que DESLIZA entre as células.

**Confirmar uma exclusão não é uma ação primária.** O botão que apaga vestia o
mesmo azul preenchido de "Baixar" e "Entendi" — a única tela do app em que uma
decisão é irreversível era a única em que a cor não dizia isso, enquanto
`.coll-bar-rm`, `.linha-sim` e `.cast-tela-fora` já seguiam a regra. Hoje
`openAppDialog` aceita `perigo: true` e o botão veste o par destrutivo
(`--btn-danger` + `--danger-strong`).

### Só preenchimento, nenhum contorno

Nenhuma regra do app desenha `border`/`outline` para SEPARAR caixas. O que
sobrevive são **quatro exceções, nomeadas uma a uma no oráculo** — nunca
detectadas por heurística, porque uma heurística deixaria a próxima borda entrar
chamando-se desenho.

**Duas são DESENHO** — `border` é também a forma idiomática de desenhar em CSS:

- o aro do `.dl-ring` — ele **é** um círculo, não a moldura de um elemento. O
  irmão dele no palco (`.av-stage-busy`) saiu na v1.4.8, com a folha
  `shared/stage.css`: o palco anuncia a espera e não a desenha mais;
- o ✓ do `.song-menu-check` (duas bordas em L, giradas 45°) — é o glifo que falta
  no subset da fonte de ícones.

**Duas foram PEDIDAS**, e as duas por aritmética, não por gosto:

- **o campo de busca da Biblioteca** (`#hymnSearchInput`, v1.5.5): *"abra uma
  única exceção ao conceito de sem bordas do app, para poder fazer a caixa de
  texto da busca … branca com a borda em cinza"*. No tema claro `--bar` é BRANCO
  e o campo é branco — **1,00:1** —, e sem contorno a caixa de texto não existe
  na tela. A cor sai de `var(--surface)` (v1.5.8: *"o mesmo cinza dos botões a
  sua volta"*), composta sobre a MESMA base por um `background-clip: padding-box`
  — sem ele a tinta comporia sobre o branco do campo e sumiria no tema escuro;
- **a divisória entre faixas irmãs** (v1.5.16): *"a criação de um elemento de
  linha divisória (não borda inteira), na listagem do itens propriamente dos
  álbuns"*. Ela **não é uma `border`** — é um `::before` de 1px pintado em
  `--divisoria`, porque `border-bottom` cobre a caixa inteira e não tem como ser
  RECUADA, e o recuo é literalmente o *"não borda inteira"* do pedido. Isso
  abriria a brecha *"filete pode, desde que não se chame border"*, então o
  oráculo ganhou o PAR no mesmo lote: uma varredura NEGATIVA por qualquer bloco
  de 1px com fundo (reprova todos menos o seletor nomeado) e uma POSITIVA
  exigindo que `--divisoria` tenha um consumidor só.

  **E ela vale nas DUAS listas de faixas desde a v1.5.18** (*"nessa lista de
  favoritos também não há a linha divisória que temos nas outras listas"*): a
  v1.5.16 desenhou o traço para uma `<ul>` só. Continua sendo **um** consumidor
  — a mesma declaração com os dois seletores —, e é isso que mantém a asserção
  positiva de pé. Os dois números que mudam entram por TOKEN: a coluna do nome
  (`--faixa-coluna-texto` sobrescrito na `.fav-itens`, onde a miniatura é
  `--thumb` e não os 38px do álbum) e a metade do vão que a caixa reabsorve (o
  `gap` daquela lista é `--sp-3`, o do álbum é `--sp-2`) — copiar o número do
  álbum descentraria o traço, que é o defeito que a v1.5.17 acabara de corrigir
  do outro lado.

**A diferença entre a divisória e a moldura removida é de OBJETO, não de
espessura.** A moldura era um retângulo por nível, quatro arestas, em três
níveis, e carregava a HIERARQUIA — trabalho que a alternância faz hoje com
degrau real. Esta é uma aresta, num nível só, entre IRMÃS, e faz o que a
alternância por construção não faz.

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

#### E a mesma regra vale para a SUPERFÍCIE DE UMA AÇÃO (v1.3.14)

Os `-soft` da paleta são tinta com alfa, e alfa **empilha** — a aritmética de R1,
que nunca foi estendida às famílias de COR. E elas sofrem pior, porque um botão
de ação nasce em duas bases ao mesmo tempo. MEDIDO no escuro, a deriva do MESMO
botão entre a base mais escura e a mais clara em que ele pousa:

| família | deriva |
|---|---|
| `--accent-soft` | **1,97:1** |
| `--ok-soft` | 1,84:1 |
| `--warn-soft` | 1,83:1 |
| `--danger-soft` | 1,70:1 |

A do accent é **maior que o degrau `--bg` × `--panel`** (1,49:1): o mesmo chevron
variava mais que dois níveis inteiros da escada. Era a queixa do operador —
*"cores diferentes ou inconsistentes entre grupos de hinário, informativos e
coleções"*: o chevron da SEÇÃO compunha `#3d4959` e o do CARD, `#4a596d`.

Daí `--btn-accent`, `--btn-danger`, `--btn-warn` e `--btn-ok`, opacos, um por
família, ancorados na matiz OFICIAL (bluejay 214°, scarlett 353°, campfire 21°,
treefrog 101°). O separador **não é a claridade, é o CROMA**: ~53–58% de
saturação contra os ~27% da escada neutra, com ~1,15:1 das duas bases de cartão
— o mesmo argumento que a paleta já assinou no `--live-fill`.

| superfície | traço | `--bg` | `--panel` | `--panel-2` | traço sobre ela (escuro · claro) |
|---|---|---|---|---|---|
| `--btn-accent` | `--accent` | 1,70 | 1,14 | 1,17 | 5,37 · 6,37 |
| `--btn-danger` | `--danger-strong` | 1,62 | 1,09 | 1,23 | 4,49 · 5,64 |
| `--btn-warn` | `--warn` | 1,69 | 1,13 | 1,18 | **4,30** · 5,68 |
| `--btn-ok` | `--ok` | 1,72 | 1,15 | 1,16 | 4,89 · 5,74 |

O `--btn-warn` é o único abaixo de 4,5:1, e ele é ÍCONE — o piso de 3:1 é o que
vale para quem carrega informação sem ser texto.

**Os `-soft` ficam**, e não são sinônimo destes: eles continuam certos onde a
translucidez é o efeito e não o acidente — o `box-shadow` do pulso de "no ar", o
trilho do `.dl-ring` (um anel desenhado sobre base arbitrária). Superfície de
BOTÃO ou de CHIP usa os `--btn-*`, e `tools/tokens.test.mjs` trava isso.

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

`--line` **saiu do arquivo** na v1.5.14, e não só da tabela: com a moldura fora
ele ficou com zero consumidores, e o comentário do próprio token dizia que ele
*"NÃO pode voltar a ser um filete"* enquanto era o único filete do app. O que
existe hoje é `--divisoria` (v1.5.16), com um consumidor único cobrado por
oráculo — e ele é um traço PINTADO, entre irmãs, não uma cor de linha à
disposição de quem precisar.

#### R0 — a escada tem TRÊS degraus, e o quarto é o espaço

Um quarto tom obrigaria o nível mais interno a subir até ~`#4c5865` no tema
escuro, onde `--muted` mede **3,59:1** e `--accent` **3,37:1** — os dois
reprovam AA para texto pequeno, que é exatamente o tamanho do texto de uma linha
de lista. Então a árvore para em três, e quem carrega o quarto nível é o
ESPAÇO: uma faixa dentro de um álbum aberto não tem caixa nenhuma.

**E o espaço sozinho não separa IRMÃS — desde a v1.5.14 isso é medível.**
Enquanto a faixa teve fundo próprio, o que aparecia no vão era o tom do álbum, e
o vão ERA um degrau. Com a alternância a faixa ficou transparente sobre a placa,
e o vão passou a ser a mesma superfície dos dois lados: **1,00:1**. Daí o quarto
degrau ser hoje espaço **mais** um traço recuado (`--divisoria`, v1.5.16) — a
alternância separa NÍVEIS e por construção não separa vizinhas do mesmo.

**E metade do vão mora DENTRO da caixa** (v1.5.17). O traço tem de ficar em
`top: 0` da faixa de baixo — `.lib-item` é `overflow: hidden` e um traço
desenhado no `gap` é RECORTADO —, então com o vão inteiro fora da caixa ele
pousava no limite INFERIOR: MEDIDO, 6,42px de branco acima e 1,37px abaixo. Não
se move o traço, move-se a CAIXA: metade do `gap` entra como `padding-top` e um
`margin-top` negativo da mesma medida devolve o conteúdo ao lugar. A lista não
muda de altura (`N·(h+2) + (N−1)·4 − 2N` é `N·h + (N−1)·4`), e a borda de cima
da caixa passa a SER o meio do vão. **A conta é por LISTA, não uma constante**
(v1.5.18): nos favoritos o `gap` é `--sp-3`, e a mesma receita entra com esse
número — repetir o do álbum reintroduziria o desvio no outro lugar.

No tema CLARO a escada **não é monotônica**, e isso é aritmética e não descuido:
a página é cinza e o nível 1 é branco (a convenção de toda UI clara), então o
primeiro degrau sobe e os seguintes só podem descer — `#dfe3e7` → `#ffffff` →
`#d4dae2`. Folha e card ficam a 1,09:1 um do outro e isso não se lê como
ambiguidade, porque os dois **nunca se encostam**: entre eles há sempre o poço
da seção. `tools/smoke.mjs` mede os pares ADJACENTES (piso 1,28)
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
componente a ajustar, e um componente novo nasce coberto — **desde que o
CONTÊINER dele entre na lista.**

**E uma lista só protege quem está nela** (v1.3.14). A `.tools-sheet` nasceu na
v1.3.10 pintando `--panel` e nunca entrou aqui. MEDIDO no tema CLARO: o
`.mic-btn` dentro dela saía em `--surface-2` FLUTUANTE (branco a 92%) sobre um
`--panel` que ali é branco pleno — **1,00:1**. A barra de push-to-talk, 56px de
altura, o controle que se procura sem olhar no meio de uma frase, simplesmente
não existia na tela; no escuro o mesmo botão ficava a 12,62:1 da folha, o outro
lado do mesmo erro. `tools/tokens.test.mjs` passou a cobrar a filiação: todo
bloco que pinta `--panel` está na lista **ou** afunda a superfície por conta
própria.

**E um CHIP não é um BLOCO.** Com R1 no lugar o microfone ficaria a 1,19:1 —
correto pela regra e fino demais para um alvo daquele tamanho. `--surface-2` é
o overlay de uma peça DENTRO de um bloco; aquilo é o bloco, e ele passou a ler
`--camada` (1,33:1 no escuro, 1,41:1 no claro). Antes de escolher o alfa,
pergunte de que NÍVEL a peça é.

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

**O `.hymnal-card` FOI a exceção** (v1.0.1) e deixou de ser (v1.3.14) — ver
"O card fechado segue o pai", abaixo. O que segue é o registro do porquê ela
existiu, que é a medição que continua valendo para o card ABERTO.

Ela era o caso de um bloco que quer o MESMO degrau para si e para os filhos. Com as coleções fixas na RAIZ, o card
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

#### O card FECHADO segue o pai; ABERTO ele sobe (v1.3.14)

O preço da exceção acima era o que o operador viu: **na raiz, uma SEÇÃO e um
CARD FIXO são linhas irmãs da mesma lista**, e saíam em tons diferentes
(`--panel` contra `--panel-2`, 1,33:1) sem que nada na tela dissesse por quê.

A medição que forçava o degrau de cima é sobre o INTERIOR do card, e o interior
**só existe ABERTO**. MEDIDO com o card em `--panel`: no escuro a faixa fica a
1,26:1 da gaveta (piso 1,28); no CLARO é pior — `--panel` é branco pleno e
`--item-fill` é branco a 80%, ou seja **1,00:1**: a faixa não existe.

Então a regra distingue os dois estados, porque são dois:

| estado | tom | por quê |
|---|---|---|
| **fechado** | lê `--camada` | ele é só a barra: não há faixa nem gaveta, logo não há escada interna a sustentar. Fica IGUAL à seção na raiz, e um degrau abaixo dela dentro de uma seção |
| **aberto** | `--panel-2` | a escada interna nasce, e o card sobe — o mesmo valor de antes, então nada do que foi medido regride |

E o degrau que aparece ao abrir **não é decoração**: é o sinal de "isto
levantou", e ocupa o lugar do nome em accent que saiu dali — ABERTO deixou de
ser cor, e o que decidiu foi a irmã: uma SEÇÃO aberta nunca pintou o nome dela.

**As COLUNAS também não se encontravam.** MEDIDO em 430px, com uma seção e um
card empilhados: chevron a x=20 contra x=22, nome a x=60 contra x=63, botão de
baixar terminando em 412 contra 408. Três colunas que quase se alinham é o que
se lê como desalinhado — e o texto do `--hit` já afirmava o contrário ("os dois
botões de baixar têm o mesmo alvo de propósito: alinhados na mesma coluna"): o
ALVO era igual (34px), a COLUNA não. Um recuo só (`.55rem .7rem`, o do card) e
um vão só (`.55rem`), e as três batem.

**E DESDE A v1.5.11 OS DOIS SE ESCREVEM IGUAL.** O que os ranqueava era a escala
de rótulo — caixa alta, espaçamento e a cor de metadado no nome da seção —, e
nivelá-la foi tentado e revertido na v1.3.14, com razão: apagaria a distinção que
a v5.296 estabeleceu depois de um relato (cor de RÓTULO e cor de CONTEÚDO são
duas coisas). **O que mudou desde então é que o RANQUEAMENTO saiu da tipografia:**
a v1.5.9 deu MOLDURA ao grupo, e quem diz "isto contém aquilo" passou a ser o
desenho. Pedido do operador: *"Nessas coleções, padronize em caixa alta, ou em
formatação normal"*, e a escolha é a normal pela medição da v5.297 (caixa alta a
14px é mais lenta de ler e mais larga, e os nomes desta lista são longos).

A distinção da v5.296 **não morre, muda de peça**: o `--muted` da barra continua
existindo no CONTADOR, e continua sem alcançar as linhas. A regra que sobra é
mais simples que a que ela substitui — **NOME é `--text`, NÚMERO é `--muted`** —,
e as duas metades têm caso no `smoke.mjs`, medidas contra VIZINHOS RENDERIZADOS
(o título do card ao lado, o contador da própria barra).

*(Branco sobre a tampa foi pedido no mesmo lote e é impossível: MEDIDO, `#bdcada`
no tema claro dá **1,66:1** contra os 4,5:1 de AA. Afastar o texto do azul, ali,
só se faz escurecendo — 4,00:1 em `--muted` para 5,33:1 em `--text`.)*

A árvore da Biblioteca **deixou de ser uma escada na v1.5.14**, e a razão é
aritmética: quatro degraus no piso de 1,28:1 partindo do branco dão
`#ffffff → #e3e3e3 → #cacaca → #b3b3b3`, e o nível 3 — onde mora todo o texto da
lista — cairia no cinza médio que o operador recusou na v1.5.10. **Não existe
escada de TOM que resolva quatro níveis sobre base branca**, e é por isso que
nove lotes seguidos (v1.5.5→v1.5.13) não fecharam a questão: cada um escolhia
qual degrau sub-piso aceitar.

Uma escada ACUMULA e acaba. Uma alternância não:

```
janela da Biblioteca  --panel   nível 0   PAPEL   · cabeçalho GRUDENTO em top:0
  ├ seção             --poco    nível 1   POÇO    · cabeçalho GRUDENTO em top:0
  │   └ card do álbum --panel   nível 2   PAPEL   · cabeçalho em --bar-secao-h
  │       └ faixa     —         nível 3   sem fundo: preenchimento é ESTADO
  │                                        irmãs separadas por `--divisoria`
  └ hinário/série     --poco    nível 1   NA RAIZ: é agrupamento, logo é poço
      └ a PLACA       --panel   nível 2   o `.coll-open`, o papel desta perna
          └ faixa     —         nível 3   a MESMA base da faixa de álbum
```

**Duas superfícies e profundidade ilimitada.** MEDIDO no renderizado: **1,43:1**
em cada degrau no escuro e **1,35:1** no claro — contra sete de sete pares
reprovando o piso no desenho anterior.

**O único traço da tela é a divisória entre faixas IRMÃS** (v1.5.16), e ela é
ORTOGONAL a esta escada: a alternância separa NÍVEIS, e por construção não tem
como separar vizinhas do mesmo nível. Enquanto a faixa teve fundo próprio o vão
entre duas era um degrau (aparecia o tom do álbum); com a faixa transparente ele
virou a MESMA placa dos dois lados — **1,00:1**. *"O quarto degrau é o espaço"*
passou a ser espaço **mais** um traço recuado.

**A regra é por PROFUNDIDADE, nunca por tipo de bloco.** O mesmo `.hymnal-card`
é nível 1 na raiz (poço) e nível 2 dentro de uma seção (papel); escrevê-la por
tipo foi o primeiro corte do lote e mediu 1,00:1 — os hinários da raiz sumiam
sobre a janela branca.

**E A ÁRVORE NÃO TEM PROFUNDIDADE UNIFORME — daí a PLACA** (v1.5.15). Uma seção
contém CARDS; uma coleção da raiz contém FAIXAS. Sem fundo próprio a faixa pousa
no que o bloco pinta, então a MESMA `.hymn-result` saía em duas cores conforme
onde a coleção calha de morar — papel dentro de uma seção, AZUL num hinário ou
numa série da raiz. Relato: *"isso era pra ser assim? fundo azul nos itens do
provai e vede?"*.

A alternância não estava errada; faltava o degrau de baixo dela. A regra
completa é **o poço é a MOLDURA de um agrupamento e o papel é onde o conteúdo
pousa** — e o `.coll-open` de uma coleção da raiz é o nível 2 daquela perna, a
irmã exata da placa dos Favoritos (`.fav-itens`), que já fazia isto no mesmo
lote. A geometria copia a da seção número por número, então a faixa continua
onde estava.

**A placa é o corpo aberto INTEIRO**, e não só a lista: o DESTAQUE do sábado e o
ÍNDICE de temas são os dois únicos blocos do acervo que só existem na raiz, e os
dois pintam contando com papel embaixo — MEDIDO, `--sel-fill` dá **1,31:1** sobre
o papel (o par para que foi desenhado) e **1,03:1** sobre o poço no tema claro.

**E o `top` de uma tampa GRUDENTA é a profundidade dela, nunca o tipo do bloco**
(v1.5.15, a mesma correção pela outra face). A v1.5.14 deu a todo card aberto o
`top` do segundo degrau, os da raiz inclusive — que não têm barra nenhuma acima.
O vão que sobrava não é neutro: **ele É o scrollport**, e a lista rolava por ali
à vista, tanto acima da tampa quanto embaixo dela enquanto a tampa DESGRUDAVA.
Pela mesma aritmética o scroller do acervo não pode ter `padding-top`: padding
de um scroller é scrollport, e uma tampa em `top: 0` para no topo do CONTEÚDO,
que fica abaixo dele.

**E o que carrega a profundidade são três mecanismos NÃO-TONAIS**, que é o que
os torna ilimitados: o cabeçalho GRUDENTO nos dois níveis (o único que continua
respondendo depois de a lista rolar — tom, cor e borda só falam enquanto o topo
do grupo está à vista), o RECUO, e o RANK tipográfico (`--fs-xl` / `--fs-lg` /
`--fs-md`).

**O preço, medido e assumido:** o degrau recuado contra o cartão cai para
1,18:1 (botão) e 1,11:1 (chip). Ali, diferente do fundo do app, o degrau não é
o que anuncia o controle — dentro de um cartão o botão tem ícone, e a própria
superfície do cartão já o separa do resto. O que **não** era negociável
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
- **R6 — a superfície de um CONTROLE é opaca.** Fundo de botão ou de chip usa
  `--btn-accent`/`--btn-danger`/`--btn-warn`/`--btn-ok`. Os `-soft` são wash
  (sombra de pulso, trilho de anel) e nunca superfície: alfa empilha, e o mesmo
  token compõe uma cor por camada. `tokens.test.mjs` trava.
- **R7 — o feedback de toque é ABSOLUTO.** `--press` (2px para baixo) mais
  `--press-luz`; nunca uma escala, que vira doze valores diferentes num app cujos
  alvos vão de 34 a 408px. Um ancestral não responde ao toque que foi para um
  filho — e suprime as DUAS partes.
- **R8 — texto secundário DENTRO de um controle preenchido herda a cor do
  rótulo com alfa, nunca `--muted`.** O cinza é calibrado contra as superfícies
  do app (fundo, painel, `--surface`), não contra o denim de `--accent-fill`:
  medido no tema claro, um "· 3/6" em `--muted` ao lado de um rótulo
  `--on-accent` ficava praticamente ilegível. Herdando com alfa, ele acompanha o
  botão em qualquer variante (normal, aviso, destrutiva) sem uma regra por
  variante.
- **R9 — um destrutivo só fica sem rótulo se for CONFIRMADO.** Quem nomeia o
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

Deixaram de ser dez blocos saturados e passaram a ser **a tinta do grupo**
(`--b-<grupo>`). Três razões, e a primeira é a que motivou tudo:

- **Luz.** É a única tela do app que preenche o visor inteiro de cor, e é
  justamente a que o operador abre NO ESCURO no meio da pregação. Medida, ela
  emitia **16,3% de luminância média** contra 2,3% de um painel comum — 7×
  mais. Com a tinta são **2,8%**, ou seja **5,8× menos luz**.
- **Contraste.** Cinco dos dez grupos tinham o rótulo abaixo de AA, o pior em
  **3,94:1**. Com a tinta o pior rótulo vai a **8,72:1**.
- **As matizes se sobrepunham.** `.bg-lei` e `.bg-evangelhos` ficavam a **1,4°
  de matiz** uma da outra: indistinguíveis. As novas foram redistribuídas com
  **18° de separação mínima**.

#### UMA banda por ladrilho (v1.3.15)

Cada ladrilho teve DUAS bandas de cor até a v1.3.14: a tinta do grupo no fundo e,
sobre ela, uma faixa de 3px na versão saturada da mesma matiz (`--bt-*`). Numa
grade de 66 livros isso são 132 manchas de cor, na única tela do app que preenche
o visor inteiro — e o operador a leu como o que era: *"duas faixas de cores no
mesmo botão"*.

A faixa nasceu na v5.192 para **carregar o agrupamento**, quando a tinta era bem
mais apagada. Hoje ela é redundante, e isso é MEDIDO — a tinta sozinha:

| | escuro | claro |
|---|---|---|
| menor separação de matiz entre quaisquer duas | **19°** | **19°** |
| saturação | 33–35% | ~60% |
| faixa de luminância | 18–30% | 79–91% |
| pior rótulo | 8,72:1 | 6,46:1 |

O piso do projeto é 20° e o par de 19 é arredondamento: as dez se distinguem
pela MATIZ com saturação e luminância uniformes, que é exatamente o trabalho que
a faixa fazia. Tirar a segunda banda não perde informação; perde o ruído. Os dez
`--bt-*` saíram de `tokens.css` junto — eram os únicos consumidores dela.

(A pílula de **Livro** da referência veste a mesma tinta e perdeu a faixa pelo
mesmo motivo, no mesmo lote: ela é a amostra do ladrilho, e amostra que diverge
do original não é amostra.)

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

#### O seletor veste a GRADE que ele abre (v1.3.14)

As quatro pílulas da referência (Livro · Capítulo · Versículo · Versão)
dividiam UMA superfície translúcida (`--surface-2`) e UMA cor de valor
(`--accent`) — quatro botões idênticos —, enquanto as grades que elas abrem são
sólidas e distintas de propósito. Era a queixa *"o seletor de capítulo,
versículo e etc. usa cores transparentes e marcadores de cores sólidas, o que
não faz sentido; podia ser só as sólidas"*.

Hoje a pílula é a AMOSTRA da tela seguinte: o tom frio (`--cell-chapter`) abre a
grade fria, o quente (`--cell-verse`) abre a quente, e a de Livro veste a tinta
do grupo com a faixa de 3px — o mesmo desenho que aquele livro tem no mosaico
(o JS acrescenta a classe `bg-<grupo>`, a mesma de `renderBibleBooks`). A de
Versão não abre grade nenhuma e fica no neutro (`--panel-2`).

Rótulo e valor herdam a cor da pílula (`currentColor`): quem os separa é a
MÉTRICA (.56rem em caixa alta com espaçamento contra .86rem), não a cor — um
`--accent` sobre a tinta quente do versículo não é a mesma leitura que sobre a
fria do capítulo. MEDIDO, pior par entre os dez grupos e as duas grades: valor
8,72:1 no escuro e 6,46:1 no claro; rótulo 6,16:1 e 5,05:1. A opacidade do
rótulo é **.9**, e a razão que a prendia ali era o `--text` do claro ser um
cinza médio (`night`, a .72 caía a 3,42:1). **Essa razão morreu na v1.5.12**,
quando o texto virou PRETO; o valor fica porque nada pede que ele mude, e não
mais porque uma medida o obriga.

**No tema CLARO a tinta se inverte** — ladrilho claro, rótulo em `--text`. Os
ladrilhos foram escolhidos com um alvo de **6,5:1** para o rótulo, contra o
`night` (#4A4A4A) que era o texto do tema; um ladrilho mais claro que isso
devolveria a matiz do grupo ao branco, que é o oposto do que a tela existe para
fazer. **Com o PRETO da v1.5.12 nenhum ladrilho precisou ser retocado**, e não
podia precisar: escurecer o texto só afasta o rótulo do ladrilho. Medido, o pior
rótulo foi de 6,46:1 para **15,31:1**.

### Ao adicionar/alterar estilo

1. Existe token pro valor? Use-o. Não existe e o valor se repete? **Crie um
   token** — cor em `shared/tokens.css`, o resto no `:root` do Controle.
2. Fundo em accent? Escolha pelo **papel**: `--accent-fill` se for uma ESCOLHA
   entre alternativas ou um botão primário (e aí o texto é `--on-accent`),
   `--btn-accent` se for a superfície de um botão/chip de ação ou um
   interruptor LIGADO (e aí o traço é `--accent`), `--accent` se for
   texto/ícone/decoração sem fundo próprio. **Nunca um `-soft`** (R6).
2b. **Ação e escolha na MESMA faixa?** O cheio fica com a ESCOLHA; a ação desce
   para `--btn-accent`.
2c. **Um bloco novo que pinte `--panel`** entra na lista de R1, senão os
   controles dentro dele usam a superfície flutuante e somem no tema claro. E
   pergunte de que NÍVEL a peça é: um chip usa `--surface-2`, um bloco usa
   `--camada`.
3. Está pintando "no ar" ou "destrutivo"? R2: o traço é `--live-strong` /
   `--danger-text`, nunca `--live` / `--danger`.
4. Botão novo → acrescentar o seletor à lista `:is(...)` do feedback de toque;
   nada de tap-highlight nem de `:active` próprio.
5. Botão que alterna → ícone = ação, cor = estado (ver acima). **Interruptor
   cujo glifo não pode mudar** (o `repeat` cicla) → superfície, nunca só cor de
   texto.
5b. O botão **manda algo para a projeção**? Acrescente-o ao `ECO_SELETOR`.
6. Atualizar esta seção e incrementar a versão (os três lugares — ver "Regras
   de desenvolvimento").

### Ao mexer em cor: NÃO há teste automatizado de CONTRASTE

**Não existe teste medindo contraste neste repositório**, e agora são DOIS temas
a medir à mão. O que existe, e não se confunde com isso, são dois oráculos que
pegam a classe de falha *silenciosa* do CSS: `tools/tokens.test.mjs` garante que
todo `var(--x)` sem fallback aponta para um token que EXISTE (um `var()`
inválido computa para o valor inicial da propriedade, sem aviso nenhum — foi
assim que os dois botões da folha de conectar ficaram com cantos retos na
v5.171), que **nenhum token exista só no tema claro**, que **nenhuma superfície
de controle seja uma tinta com alfa** (R6) e que **todo bloco que pinta
`--panel` afunde a superfície dos filhos** (R1) — as duas últimas provadas por
REVERSÃO, e a segunda existe porque a `.tools-sheet` passou três versões fora da
lista com o microfone invisível no tema claro; `tools/smoke.mjs` trava
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
