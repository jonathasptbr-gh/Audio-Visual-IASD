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
| `--accent-fill` | `#2f557f` | `#2f557f` | o **`denim` OFICIAL** como fundo de elemento preenchido, nos dois temas. 2,44:1 contra o fundo escuro — exatamente o peso que o preenchido âmbar tinha (2,59:1). **Desde a v1.8.95 ele é SÓ DE BOTÃO** (primário e ação de destaque): ESCOLHIDO entre alternativas desceu para `--btn-accent` + `--accent`, e `tokens.test.mjs` reprova o denim sob um seletor de escolha |
| `--on-accent` | `#e8edf3` | `#ffffff` | o que se escreve **em cima** de `--accent-fill` — 6,54:1 e 7,70:1. O par branco-sobre-denim é o que a própria identidade recomenda; no escuro vale a regra do off-white, e a folga sobra nos dois. **Sobre `--btn-accent` ele NÃO serve** (1,21:1 no tema claro): a escolha que desceu para aquela superfície na v1.8.95 trocou junto a tinta, para `--accent` |
| `--accent-soft` | `rgba(143,177,243,.16)` | `rgba(47,85,127,.12)` | fundo suave de estado ativo |
| `--stage-accent-glow` | `rgba(143,177,243,.32)` | *(idem — é do PALCO, logo sem tema)* | halo do `.start-pill` do Display. Segue a MATIZ do accent, não o `--accent-fill`: um halo na cor do preenchimento (escuro por definição) sobre o fundo escuro seria invisível. **Saiu do botão de conectar do simplificado bloqueado na v5.75** — ali quem separa o botão do fundo é a cortina embaçada |
| `--brand` / `--brand-text` | `#95b5f4` / `#c2d4f8` | `#2f557f` / `#24446a` | marca ("IASD"): logo, capa da letra, pill "Ligar Sistema", rótulo de estrofe, destaque da busca por letra. Mesmo valor do accent — os dois nomes existem para distinguir marca de navegação na folha |
| `--live` | `#d0021b` | `#d0021b` | o **`scarlett` OFICIAL**, e **só** como preenchimento de "está no ar agora". Como texto ele reprova: 3,32:1 sobre o fundo escuro. (O gêmeo `--danger` saiu na v1.5.14: zero consumidores, e a razão escrita para o não-uso — *"ação destrutiva é sempre CONTORNADA"* — tinha morrido com o contorno, na v5.267) |
| `--on-live` | `#f6eeef` | `#ffffff` | o que se escreve sobre `--live` — 4,96:1 e 5,67:1 |
| `--live-strong` / `--danger-strong` | `#f97a7e` | `#b80419` | **o vermelho que se lê como vermelho** (v5.76): ícone, borda e marca preenchida. Derivado do `scarlett` (matiz 358°/353°), clareado no escuro e escurecido no claro. Escuro: 7,27:1 sobre `--bg`, 6,59:1 sobre o soft, 4,88:1 sobre `--panel`, **3,77:1 sobre `--panel-2`** — este passa o piso de borda e reprova o de texto, e é por isso que quem veste este vermelho veste junto o fundo suave da própria família. Claro: 4,63:1 sobre o soft, 6,84:1 sobre o painel |
| `--danger-text` | `#e98d83` | `#93382e` | o salmão, para os TRÊS casos em que o `-strong` não serve: a falha na miniatura do YouTube, o pulso de erro e o aviso de falha pousado direto no painel — 5,17:1 sobre `--panel` no escuro, 7,38:1 no claro |
| `--live-soft` | `rgba(208,2,27,.22)` | `rgba(208,2,27,.14)` | wash de "no ar" — hoje só o `box-shadow` do pulso. **É wash, nunca superfície de controle** (ver `--btn-*`), e foi essa regra que esvaziou a família: dos seis `-soft`, só este tem consumidor. Os outros quatro (`--danger-soft`, `--warn-soft`, `--ok-soft`, e o `--accent-soft` que ficou) eram defendidos por "servem ao wash" — a v1.5.14 mediu e removeu os que não serviam a nenhum |
| `--btn-accent` / `--btn-danger` / `--btn-warn` | `#293d57` / `#5d282e` / `#533423` | `#dcebfe` / `#fde3e6` / `#f8e7de` | **a superfície OPACA de um botão ou chip** em cada família (v1.3.14). Recebem por cima o traço que a família já tinha (`--accent`, `--danger-strong`, `--warn`, `--ok`). Ver "A superfície de uma ação é opaca" |
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
| `--press` / `--press-luz` | `translateY(2px)` / `brightness(1.35)` · `.88` no claro | feedback de toque: recuo ABSOLUTO mais luz no CONTROLE; só a luz, no bloco inteiro, em quem hospeda controles. Ver "Feedback de toque" |
| `--fs-2xs`…`--fs-4xl` (9) + `--fs-display-sm` / `--fs-display` | `.60` `.68` `.74` `.82` `.90` `.95` `1.05` `1.15` `1.25` + `1.6` `2.6` rem | **a escala tipográfica** (v1.5.14). Eram 31 corpos distintos em 126 declarações. Os degraus saíram da DISTRIBUIÇÃO REAL de uso (o pico é `.82rem`, 19 declarações — o corpo de uma linha de lista), e não de uma fórmula: entre cinco escalas candidatas esta é a que move menos pixel — sete declarações mudam mais de 0,65px, e a maior mudança é 0,8px. Consolidar não podia custar um redesenho acidental |
| `--sp-1`…`--sp-6` | `.15` `.25` `.35` `.5` `.6` `.8` rem | **a escala de espaço** (v1.5.14). Eram 16 valores de `gap` quase contínuos em passos de .05, isto é, nenhum ritmo. 71 das 110 declarações caem EXATAS num degrau; o resto se move no máximo 1,6px — o que não se vê numa peça e se sente no conjunto |
| `--dur-rapida` / `--dur-media` / `--dur-lenta` | `.14s` / `.2s` / `.3s` | **a escala de movimento** (v1.5.14). Eram dez durações de transição entre .12s e .3s — faixa em que o olho não distingue os degraus, mas em que peças VIZINHAS animam em tempos diferentes, e isso se nota. As ANIMAÇÕES ficam de fora e mantêm o tempo delas: um pulso de 1,2s não é uma transição de interface |
| `--fw-normal` / `--fw-medio` / `--fw-forte` / `--fw-max` | `400` / `600` / `700` / `800` | **os quatro pesos** (v1.5.14). Eram cinco valores para quatro papéis — o `500`, com três usos, não se distinguia do `600`. Nomeados, a escolha deixa de ser um número e passa a ser um papel |
| `--bar-secao-h` | `calc(var(--hit) + .7rem)` | a altura da barra de uma seção da Biblioteca. É token porque DUAS regras precisam do mesmo número (a barra gruda em `top: 0`, a do álbum logo abaixo dela); escrito duas vezes divergiria, e o sintoma seria o cabeçalho de dentro cobrindo o de fora. Determinístico: o nome é `nowrap` e o recuo é fixo — nada de medição em JS, que a v1.5.3 ensinou a desconfiar. **Era `+ 1.1rem` até a v1.5.16**, e quem o apertou foi o ORÇAMENTO da lista colapsada — não o desenho da barra |
| `--faixa-coluna-texto` | `calc(.5rem + 38px + var(--sp-4))` | onde a coluna do NOME de uma faixa começa — o recuo da linha, mais a miniatura, mais o vão. É token porque é o que RECUA a `--divisoria`, e é isso que a torna *"não borda inteira"*: ela começa no texto, nunca sob a miniatura. Aritmético, não medido — a miniatura tem lado fixo. **SOBRESCRITO na `.fav-itens`** (v1.5.18): lá a miniatura é `--thumb` (40px) e não a `.hymn-play-thumb` de 38 — o valor entra por herança de custom property, nunca copiado para uma segunda regra |
| `--hit-foot` | `42px` | **a fatia do rodapé fixo da lista** — e ela é dividida por DUAS inquilinas: as três portas (Bíblia · Importar · Ferramentas) e a barra de seleção múltipla, que toma o lugar delas. Os dois PRECISAM medir o mesmo, senão a lista pula debaixo do dedo ao entrar na seleção. **Era 44px e estava INERTE** (v1.5.19): MEDIDO, o termo que mandava na altura das portas era o `padding: .45rem`, e varrer o token de 48 a 36px não mudava um pixel — o `#listFoot` pulava **7,77px** ao entrar na seleção, contra a promessa escrita do próprio token. Com `padding: 0 .3rem` nas portas (a forma que a `.selbar` já tinha), o termo vertical passa a ser um só. **PISO do token: 38px** — abaixo disso o conteúdo empilhado (ícone 20 + `--sp-1` + a linha do rótulo = 37,40px) volta a mandar. **VAZAMENTO declarado:** ele governa também o `.yt-search-btn`, alcançável de DENTRO do Modo Fácil, num habitat SUNK |
| `--tampa-h` | escrito em JS | **a altura de um bloco de raiz da Biblioteca com tudo FECHADO** (v1.5.19) — a irmã exata do `--fav-vao`: mesma caixa, mesma régua (a BARRA de cada vizinha é a altura fechada dela), mesmo lugar de chamada. Ela existe porque a tampa de uma coleção MUDAVA de altura ao abrir (MEDIDO na captura do operador, −11,2%), e o teorema fecha as saídas em CSS puro: a tampa só pode ser constante no valor MÍNIMO dela, e a altura de encaixe é função da TELA e do NÚMERO de blocos — não existe como valor. O CSS a lê nos DOIS estados (`height` no fechado, `padding-top` acima da barra no aberto). **Não é uma COORDENADA guardada, é uma ALTURA recomposta a cada render** — a classe de defeito da v1.5.3 não se aplica |
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

  **E O RECUO É DO CONTROLE FOLHA: UM BLOCO RESPONDE SÓ COM A LUZ** (v1.7.4).
  Pedido do operador sobre a Biblioteca: *"Há um efeito de encolhimento que
  distorce os elementos, remova esse efeito, deixe apenas um efeito de
  coloração/sombreamento ao toque sem encolhimento. Também aproveite para
  verificar se está colorindo o corpo do card corretamente e não apenas o
  arrangment/card do texto ou cabeçalho. Pois tem de considerar colorir as zonas
  que formam o corpo real, com margens e bordas circulares."*

  A regra **já estava escrita na `.coll-bar` desde a v5.288** — *"`--press` é
  para CONTROLE FOLHA. Um contêiner que hospeda um controle nunca escala: ele
  responde por PREENCHIMENTO, que não move nada"* —, e a v1.3.14 a contrariou ao
  pôr na lista do `--press` as duas barras que abrem um bloco. As duas metades do
  relato são o mesmo defeito:

  - **a barra é TRANSPARENTE**, então o `filter` acendia só o TEXTO e os ícones —
    o corpo do card, com as margens e os cantos, ficava intocado. Era literalmente
    *"colorindo o arrangment do texto"*;
  - **e ela DESLIZA dentro de um bloco parado**: o `translateY(2px)` move o
    conteúdo da tampa enquanto a pílula em volta fica onde está, e o que se vê é
    a tampa escorregando e sendo recortada.

  Hoje quem responde é o BLOCO — `.hymnal-card`, `.coll-group--drop` e a
  `.lib-item`, que é a linha de lista deste app e o outro contêiner que hospeda
  controles —, com a luz e por inteiro, em qualquer profundidade e nos dois
  estados. A pergunta é `:has(> tampa:active)` e não `:active` no bloco: com o
  card ABERTO o corpo dele é a lista inteira, e `:active` casa em ancestral.

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
- **Alvo de toque:** o token é **`--hit`** (34px, desde a v5.49). O segundo
  degrau, `--hit-nav` (38px), era a faixa de NAVEGAÇÃO — `.tab` e `.tab-add` —,
  e saiu na v1.8.81: a faixa de abas inteira saiu na v1.5.0 e o token sobreviveu
  vinte e nove lotes declarado e sem um único leitor. O piso
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
  para `.coll-bar-info, .bible-ver-main, .hymn-info`. (O exemplo antigo era o
  `.tab-add` dividindo a caixa de `.tab` em vez de reescrevê-la — as duas peças
  saíram com a faixa de abas na v1.5.0.)
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
| preenchido em `--accent-fill` (os MESMOS seletores, hoje em `--btn-accent` — v1.8.95, abaixo) | `.bible-cell.active`, `.misc-tab/.misc-seg/.misc-chip.active`, `.fit-opt.active` |
| `--sel-fill` opaco na linha | `.lib-item.active`, `.bible-vsec.cur` |
| **só cor de TEXTO** | `#repeat.active`, `.tab.active`, `.bible-ver-row.selected`, `.hymnal-card.expanded`, `.folder-opfs.expanded` |

A regra, e ela responde a QUATRO perguntas diferentes — com TRÊS respostas
desde a v1.8.95, quando ESCOLHIDO e LIGADO passaram a vestir o mesmo par:

- **ESCOLHIDO entre alternativas** (uma célula, um segmento, um chip, uma aba) →
  **superfície de ação**: `--btn-accent` + `--accent` (v1.8.95, que revogou esta
  metade da regra). O par era o denim cheio (`--accent-fill` + `--on-accent`), e
  o operador o tirou daí: *"todos esses usam um azul forte, sólido, que deveria
  ser reservado para botões e não seleções. Para seleções, pode usar o mesmo
  azul que usamos nos botões flutuantes sobre o cronograma"* — o `--btn-accent`
  do `--surface-porta`, que é também o do `.qs-tile.qs-on` e o do `.fav-btn.on`,
  o modelo que ele apontou. **Sete regras trocadas** (`.bible-cell.active`,
  `.bible-cell--num.active`, `.misc-tab.active`, `.misc-seg.active`,
  `.misc-chip.active`, `.fit-opt.active`, `.cast-rede.active`) mais o polegar do
  alternador de modo — `.qs-modo::before` no fundo, `.qs-modo .fit-opt.active`
  na tinta.

  **MEDIDO no renderizado:** a tinta sobre o fundo novo dá **5,37:1** no escuro
  e **6,37:1** no claro, contra o piso de 4,5. O que ENCOLHEU foi o
  PREENCHIMENTO contra a pílula apagada — 2,05:1 → **1,43:1** no escuro e
  5,56:1 → **1,14:1** no claro —, de modo que o que separa escolhido de não
  escolhido passou a ser sobretudo a MATIZ (cinza × azul). É o mesmo desfecho
  que o app já aceitava no `.qs-tile.qs-on`, o modelo do pedido.

  **O DENIM FICA NOS BOTÕES** — `.chrono-btn.primary`, `.misc-project`,
  `.draw-go`, `.diag-btn--primario`, `.song-menu-go`, `.dialog-btn.primary`,
  `.cast-acao`/`.cast-acao-linha`, `.ota-row--agora` —, mais o `.popup-count`,
  que é INFORMAÇÃO e já era exceção comentada no CSS. Oráculo:
  `tokens.test.mjs`, bloco *"ESCOLHIDO NÃO É O DENIM"*, que varre por SELETOR
  (toda regra com `.active`, mais o `.qs-modo::before` nomeado à parte) e
  reprova `background`/`color` em `--accent-fill`/`--on-accent`. **A varredura é
  por seletor porque é ele que diz o PAPEL** — uma busca global levaria os
  primários junto.

  **O ARGUMENTO REVOGADO, para não ser refeito:** ESCOLHIDO e LIGADO eram pares
  DISTINTOS para que "um entre irmãos" não se lesse como "um interruptor solto".
  Hoje são o MESMO par, e quem os separa é o contexto — haver ou não irmãos
  disputando a faixa. A colisão é deliberada: o operador apontou justamente o
  tile LIGADO como o modelo da seleção.
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

O accent cheio servia aos dois papéis — era o botão primário (`.cast-acao`,
`.dialog-btn.primary`) e era o segmento escolhido —, e fora do trilho de
navegação isso nunca colidia, porque os dois não dividiam a mesma faixa. **A
colisão deixou de ser possível na v1.8.95**, quando o escolhido desceu para
`--btn-accent` + `--accent` e o denim ficou só com o botão; o trilho que criou a
pergunta saiu na v1.5.0, e o que fica desta seção é o DESEMPATE.
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

> **O DESFECHO DE UMA AÇÃO SAIU DO VERDE NA v1.8.55**, a pedido do operador (*"padronize todos com o efeito de fundo azul claro e ícone em azul sólido, sem nada verde"*). O pulso do botão e a nota na linha vestem `--btn-accent` + `--accent` — o par do `.fav-btn.on`, que o próprio pedido citou como referência —, e MEDIDO o contraste MELHOROU: **5,37:1** no escuro e **6,37:1** no claro, contra 4,89 e 5,74 do verde que saiu. **O que ele viu não era decisão de ninguém: era especificidade.** As variantes do `.btn-pulso` são `(0,1,0)` e perdiam para `.fav-btn.on`, `.row-playlist.on`/`.row-crono.on`, `.qs-tile.qs-on` e `.fav-acoes .row-btn` (o CINZA da queixa) — de modo que acrescentar a uma lista pulsava azul e retirar pulsava verde. A classe DOBRADA as leva a `(0,2,0)` sem `!important`. **O âmbar e o vermelho ficam**: são outras mensagens.

> **E OS DOIS ÚLTIMOS INDICADORES SAÍRAM NA v1.8.56**, pela régua que o operador deu ao ver o resultado: *"verde é para sinal de 'ligado', nesses casos são mensagem de conclusão, não de atividade"*. Ela REVOGA a leitura da v1.8.55, que deixara o ✓ do download do YouTube (`.yt-result .yt-ok`) e o "Completa offline" da Bíblia (`.bible-ver-status.done`) verdes por lê-los como ESTADO — e a régua nova é melhor, porque separa o que dura enquanto a coisa está no ar do que anuncia algo que ACABOU. O contraste melhorou nos dois: o ✓ vai de 4,89/5,74 para **5,37:1 · 6,37:1**, e o "Completa offline" de 6,10/6,81 para **6,63:1 · 7,70:1** sobre o painel (4,92 · 5,87 sobre `--sel-fill`, que é a linha selecionada). O segundo divide a linha com o `.bible-ver-check` — o ✓ que marca a versão ESCOLHIDA, também `--accent` —, e os dois só coexistem na linha selecionada, onde quem carrega a seleção é o FILL e a linha inteira já é accent por herança. **O QUE SOBRA VERDE É ATIVIDADE, e são dois**: a TV no ar (`.cast-acao.connected`, mais o ícone dela) e o ponto do Auxiliar de Leitura (`.lv-badge`). A lista é nomeada no `feedback-de-confirmacao.test.mjs` **nos dois sentidos** — um seletor novo consumindo `--ok` reprova, e um NOME que já não descreve seletor nenhum reprova também: uma lista de permissão que envelhece deixa de dizer o que está permitido.
>
> **E as TRÊS PORTAS do rodapé saíram do `--btn-accent` na v1.5.19**, a pedido do operador (*"discretas, mescladas ao fundo"*): elas vestem `color-mix(in srgb, var(--surface) 70%, transparent)`, com `--surface` como piso de falha aberta. A `.selbar` e o `.msg-add-btn` FICAM — a cor se partiu por HABITAT (sobre `--bg` × sobre `--panel`), não por botão. Ver o capítulo das três portas em `CONTROLE.md`.
>
> **O `.pl-pack` saiu na v1.8.53**, e pelo mesmo argumento caindo pela segunda vez. Ele era pintado por ser *"a única ação do bloco dela"*; o operador pôs o "Limpar" ao lado, e o bloco passou a ter duas — num idioma em que `--btn-accent` + `--accent` quer dizer **LIGADO**, o par lia-se como *"Guardar está ligado, Limpar é neutro"*, uma hierarquia que não existe. Some a razão que decide: com menos de dois itens ele é APAGADO, e **um item é o estado dominante da fila**, de modo que o azul cheio ficaria esmaecido quase o culto inteiro. Hoje os dois vestem a mesma caixa (`--surface`) e a COR os separa — `--accent` × `--danger-text`, MEDIDO 7,66:1 e 6,47:1 no escuro, 5,58:1 e 5,35:1 no claro.
| segmentado/chip marcado (`--accent-soft` + borda) | PREENCHIDO — o denim até a v1.8.94, `--btn-accent` + `--accent` desde a v1.8.95 |
| filetes separadores | ESPAÇO |
| faixa lateral do grupo na Bíblia e da estrofe no ar | `linear-gradient` — os mesmos pixels, declarados como o preenchimento que sempre foram |
| anel externo da célula ativa da Bíblia (`outline`) | a célula inteira preenchida — em `--btn-accent` + `--accent` desde a v1.8.95, era o denim |
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

Daí `--btn-accent`, `--btn-danger` e `--btn-warn`, opacos, um por
família, ancorados na matiz OFICIAL (bluejay 214°, scarlett 353°, campfire 21°,
treefrog 101°). O separador **não é a claridade, é o CROMA**: ~53–58% de
saturação contra os ~27% da escada neutra, com ~1,15:1 das duas bases de cartão
— o mesmo argumento que a paleta já assinou no `--live-fill`.

| superfície | traço | `--bg` | `--panel` | `--panel-2` | traço sobre ela (escuro · claro) |
|---|---|---|---|---|---|
| `--btn-accent` | `--accent` | 1,70 | 1,14 | 1,17 | 5,37 · 6,37 |
| `--btn-danger` | `--danger-strong` | 1,62 | 1,09 | 1,23 | 4,49 · 5,64 |
| `--btn-warn` | `--warn` | 1,69 | 1,13 | 1,18 | **4,30** · 5,68 |

O `--btn-warn` é o único abaixo de 4,5:1, e ele é ÍCONE — o piso de 3:1 é o que
vale para quem carrega informação sem ser texto.

**Os `-soft` ficam**, e não são sinônimo destes: eles continuam certos onde a
translucidez é o efeito e não o acidente — o `box-shadow` do pulso de "no ar", o
trilho do `.dl-ring` (um anel desenhado sobre base arbitrária). Superfície de
BOTÃO ou de CHIP usa os `--btn-*`, e `tools/tokens.test.mjs` trava isso.

#### A regra do vermelho é a INTENSIDADE, não o preenchimento

- **preenchido** (`--live-fill` + `--live-strong`) = está no ar agora, e só
  isso. É o vermelho que não pode ter concorrente na tela;
- **suave** (`--danger-soft` num chip ou botão) = ação destrutiva.

(O grau SATURADO — `--live` + `--on-live` + `--live-soft` — saiu na v1.8.89 com
o microfone ao vivo, que era o último consumidor dos três e a razão de haver um
degrau acima do `--live-fill`: *"o único estado desta aba que precisa ser visto
do outro lado do salão"*. O scarlett oficial #D0021B continua sendo a ÂNCORA de
que os dois graus derivam; ele deixou de ser um token declarado.)

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

**E um CHIP não é um BLOCO.** Com R1 no lugar aquele botão de 56px (a barra do
microfone, que saiu na v1.8.89) ficaria a 1,19:1 — correto pela regra e fino
demais para um alvo daquele tamanho. `--surface-2` é
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

**E ELA SAIU DA BIBLIOTECA** (v1.7.5). A folha do HISTÓRICO tinha o mesmo
defeito medido pela mesma régua — o cabeçalho de um dia e as linhas dele em
`rgb(48, 66, 84)`, **1,00:1** —, e a resposta foi a mesma, inclusive na metade
que não é tom: papel (a folha) → poço (o bloco do dia, `.hist-sessao`) → papel
(a linha, pela `.hist-corpo { --camada: var(--panel) }`). MEDIDO: os mesmos
**1,43:1** e **1,35:1**, pela mesma razão.

**A metade que viaja junto é a FILIAÇÃO.** Dois tons alternados numa lista PLANA
continuam sendo uma corrida de irmãos: é ter CORPO que faz um agrupamento dizer
onde ele acaba. O que NÃO viaja é o `sticky` da barra — ali não há tampa de
nível acima a que se colar, e um cabeçalho grudado dentro de um popup que já
rola inteiro flutuaria sobre a lista de outro dia. Ver `docs/arquitetura/CONTROLE.md`,
"O DIA É UM BLOCO".

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

- **`--accent-fill`** — fundo de elemento preenchido e, desde a v1.8.95, **só
  de BOTÃO** (o item ESCOLHIDO entre alternativas desceu para `--btn-accent`).
  É o par **fundo/texto** que reprovava na paleta anterior, e não a
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
  `--btn-accent`/`--btn-danger`/`--btn-warn`. Os `-soft` são wash
  (sombra de pulso, trilho de anel) e nunca superfície: alfa empilha, e o mesmo
  token compõe uma cor por camada. `tokens.test.mjs` trava.
- **R7 — um CONTROLE responde por RECUO; um BLOCO responde por LUZ.** `--press`
  (2px para baixo, ABSOLUTO — nunca uma escala, que vira doze valores diferentes
  num app cujos alvos vão de 34 a 408px) mais `--press-luz` no controle folha; só
  a luz, e no bloco INTEIRO, em quem hospeda controles (o card de álbum, a seção,
  a `.lib-item`). Um ancestral não responde ao toque que foi para um filho — e
  suprime as DUAS partes.
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
2. Fundo em accent? Escolha pelo **papel**: `--accent-fill` **só para BOTÃO**
   primário ou ação de destaque (e aí o texto é `--on-accent`), `--btn-accent`
   para a superfície de um botão/chip de ação, para um interruptor LIGADO **e
   para o item ESCOLHIDO entre alternativas** (e aí o traço é `--accent`, nunca
   `--on-accent`, que mede 1,21:1 sobre ele no claro), `--accent` se for
   texto/ícone/decoração sem fundo próprio. **Nunca um `-soft`** (R6). O denim
   sob um seletor de escolha reprova em `tokens.test.mjs`.
2b. **Ação e escolha na MESMA faixa?** Desde a v1.8.95 elas não disputam mais a
   mesma tinta — o cheio é da AÇÃO, a escolha veste a superfície —, e o trilho
   de navegação que criou a pergunta saiu na v1.5.0.
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
6. **Caixa nova que hospede texto ou controles?** Passe pelas seis regras de
   GEOMETRIA (seção própria, abaixo): piso de toque que não dependa da fonte,
   corte declarado onde houver corte, rolagem — nunca `overflow` — quando não
   couber, e recorte quando a caixa ANIMAR o conteúdo dela. A régua é `node tools/varredura-geometrica.mjs`, e o portão é o
   `geometria.test.mjs`.
7. Atualizar esta seção e incrementar a versão (os três lugares — ver "Regras
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
lista, com o botão de 56px da base dela invisível no tema claro; `tools/smoke.mjs` trava
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

## Geometria — o padrão seguro para qualquer tela

Pedido do operador: *"faça a varredura completa no layout do app para que ele se
torne responsivo geometricamente. vamos criar um padrão seguro de design."*

O app é **retrato por manifesto**, então "responsivo" aqui não é paisagem: é
sobreviver às DUAS variações que um parque de celulares tem — a **proporção da
tela** (de 360×640 a 430×900, o dobro de altura útil entre as pontas) e a
**escala de fonte do sistema**, que multiplica todo `rem` da folha e que quem
escreve o CSS não tem ligada.

**O app não tem uma media query de largura ou de altura, e não precisa ter.** O
que o segura é o fluxo do CSS, e MEDIDO ele segura bem: na varredura completa
(16 superfícies × 8 combinações de tela e fonte), **13 das 16 saíram limpas nas
oito**. Os defeitos não estavam espalhados — estavam concentrados nos dois
lugares em que o fluxo não tem como decidir sozinho.

### As duas formas de errar, e as duas são MUDAS

| forma | onde ela apareceu | o que se vê |
|---|---|---|
| **contagem fixa numa caixa variável** | a grade de 66 livros da Bíblia (`repeat(11, 1fr)`) | fileira de **16,4px** com letra de 20px: a abreviação cortada ao meio |
| **cromo em `rem` dentro de folha em `px` de tela** | a folha de Ferramentas | o painel espremido a **42,9px** para um botão de 51,1px, cortado |

As duas têm a mesma anatomia: **a caixa é da TELA e encolhe; o conteúdo é da
FONTE e cresce.** Elas se movem em sentidos opostos e nada as apresenta uma à
outra. Nada lança, nada aparece no console, e na tela em que o desenho foi
decidido está tudo certo — que é por que os dois relatos do operador sobre a
folha da Bíblia (v1.7.10) e este lote descrevem o mesmo defeito em quatro
lugares diferentes.

### As seis regras

**G1 · A altura de uma folha é ORÇAMENTO, não sobra.** Onde o conteúdo pode não
caber, quem decide o que sai é uma `@container`, nunca o `overflow`. O
precedente é a folha de leitura da Bíblia (v1.7.10), que esconde a quarta seção
abaixo de 18em, a primeira abaixo de 14em e a terceira abaixo de 11em — três
degraus declarados, em vez de um corte.

**G2 · Toda caixa que corta texto declara COMO corta.** `-webkit-line-clamp` só
corta limpo quando o clamp **cabe**: um `clamp: 6` numa caixa em que cabem duas
linhas não engata, e quem corta é o `overflow`, no meio da linha. Onde o número
de linhas não é previsível, a saída é a MÁSCARA (`mask-image`), que esmaece em
qualquer altura. `overflow: hidden` cru sobre texto é sempre um defeito à espera
de uma tela menor.

**G3 · `--hit` é PISO, e piso não pode depender da métrica da fonte.** Um
controle é `min-height: var(--hit)` — nunca um `height` que possa encolher, e
nunca um `padding` em `rem` que "dá no piso" com a fonte padrão. MEDIDO neste
lote: `.misc-tab` a **32,6px** (1,4px do alvo), `.fit-opt` a **31px**,
`.misc-chip` a **29,5px**, e o `.cue-save-btn` da leitura a **20px**. Nenhum
deles era um número escolhido: os quatro eram o recuo em `rem` caindo onde caiu.

**G4 · Caixa dirigida pela LARGURA não hospeda texto dirigido pela FONTE — uma
das duas tem de ceder.** Ou a caixa ganha piso (`minmax(...)`, `min-height`), ou
o texto passa a seguir a caixa (`min(<teto>, N cqh)` com `container-type: size`).
Na grade de livros foram as duas, e nenhuma sozinha bastava: o piso devolve o
alvo de toque, a letra que segue a célula tira o corte. **A porcentagem do `cqh`
é CALIBRADA, não escolhida** — ela sai da razão entre o teto de fonte e a caixa
de conteúdo do piso, e o `min()` garante que a tela folgada desenhe exatamente o
que desenhava.

**G5 · A resposta a "não cabe" é ROLAR, nunca ESCONDER.** Um piso sem rolagem é
o corte de volta um nível acima: a grade fica maior que a caixa e o `overflow`
come o resto. Quem ganha piso ganha `overflow-y: auto` no mesmo lote.

**G6 · Uma caixa que ANIMA o conteúdo dela recorta.** Um `translateX(±100%)`
num filho é conteúdo passando por fora da caixa por definição; sem
`overflow: hidden` no pai, o que se vê durante o movimento é o conteúdo pintando
sobre o que estiver ao redor. MEDIDO na `.tools-sheet` (v1.8.4): **47,7px** de
grade de livros por cima do Cronograma, durante os 220ms do deslize da Bíblia.
**E o recorte é da caixa a que o conteúdo pertence**, não de um ancestral
distante — o `<main>` já recortava na largura da TELA, e a moldura entre ele e a
folha era exatamente onde o defeito aparecia.

**E o corolário que amarra as cinco: numa folha, o CROMO é o que cede — nunca o
miolo.** Cabeçalho, seletor e rodapé crescem com a fonte dentro de uma caixa que
encolhe com a tela; quando os dois se cruzam, quem fica com zero é o conteúdo,
que é a razão de a folha existir. `min-height: min-content` no miolo é o piso
HONESTO: o que rola sozinho lá dentro contribui zero, então o que sobra na conta
é exatamente o que não pode encolher.

### O que NÃO é regra

- **`px` não é o vilão.** MEDIDO: dos 166 valores em `px` do `controle.css`, os
  que carregam geometria são ícones, pontos e o `--hit` — e `--hit` é `px` de
  propósito, porque um alvo de toque é FÍSICO e não pode encolher quando alguém
  aumenta a fonte. Quem quebra são os 185 em `rem` presos dentro de caixas que
  não são `rem`.
- **Media query de largura não faz falta.** O fluxo resolve a largura; o que ele
  não resolve é a ALTURA, e para isso a ferramenta certa é a `@container`, que
  mede a caixa e não a janela. `display.css` já é assim inteiro (27 unidades
  `cq`, zero media queries) — ele projeta em qualquer TV, e é o mesmo problema.

### Onde o app está hoje

Depois das correções da v1.8.1, a varredura completa (16 superfícies × 9
combinações de tela e fonte, da 360×640 à 430×900 e da fonte padrão ao 1,5× do
"Ampliar" do Android) devolve **as 16 limpas e as cinco sondas em ZERO** —
inclusive a única exceção de piso de toque que existe, que está DECLARADA
(`--hit-denso`, a grade de 66 livros) e por isso não é um achado.

Isso é o estado, não uma garantia: a varredura mede o que ela abre. Superfície
nova entra na lista de `tools/geometria.mjs` no mesmo lote em que nasce — uma
que não é aberta não tem achado nenhum, e um placar limpo sobre uma tela que
não montou é indistinguível de um app correto (por isso o portão também afirma
que toda superfície ABRIU e mostrou nós).

### O que a régua NÃO alcança: o MOVIMENTO

Ela assenta as animações antes de medir (`getAnimations()` + `finished`), e tem
de assentar — uma folha medida no meio do movimento devolve uma caixa que não
existe. **Um defeito que só existe DURANTE uma animação nasce, por construção,
fora do alcance dela** (foi o caso da G6).

E há um segundo limite, que é sobre a RÉGUA e não sobre a janela de tempo:
**geometria não vê recorte de pintura.** `overflow: hidden` clipa o que se
desenha, não o layout — um filho recortado continua devolvendo a caixa inteira
no `getBoundingClientRect`. Onde a pergunta é *"isto está aparecendo onde não
devia?"*, a régua é o PIXEL, não a caixa. O oráculo que faz isso é o
`tools/deslize-nao-vaza.test.mjs`, e ele mede cores distintas numa faixa que em
repouso é lisa.

### A régua: `tools/varredura-geometrica.mjs`

Ele abre cada superfície do app em cada combinação de tela × escala de fonte e
mede cinco coisas: **T1** elemento fora da janela, **T2** irmãos sobrepostos numa
linha, **T3** corte serrado (o `overflow` cortando texto sem clamp engatado e sem
máscara), **T4** alvo abaixo de `--hit`, **T5** camada `fixed` fora da tela.

**Ele não é o oráculo — ele é a régua.** O portão do CI é o
`geometria.test.mjs`, que roda as mesmas sondas e reprova; a régua imprime, e é
com ela que se decide o que a asserção deve dizer. Escrever a asserção antes de
medir é como o desenho da Bíblia nasceu.

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
que substituiu o ícone de microfone quando a aba deixou de ter uma ferramenta
só.

> **Borda nativa dos `<button>`**: `.tab-add` e `.pv-fab` zeram
> `border`/`appearance` explicitamente — sem isso, um `<button>` (ex.:
> `#hymnSearchBtn`) herda a **borda 3D bicolor (bevel)** do sistema, fora do
> padrão do app. O mesmo motivo do `appearance:none` no `.lib-search`
> (`type="search"`).

---

---

<!-- Extraído do `CLAUDE.md` na faxina de 2026-09-07. -->

> **Este bloco saiu do `CLAUDE.md`**, que é lido INTEIRO em toda sessão: eram
> 772 linhas — 14% daquele arquivo — cobradas de toda tarefa, inclusive das que
> nunca escrevem uma cor. **As REGRAS DURAS ficaram lá** (cor nova em
> `tokens.css`, não há contorno, o palco não tem tema, nunca branco literal, o
> recuo absoluto, a escada de camadas, o `colors.xml`), porque quebrá-las é
> possível sem abrir capítulo nenhum. **Aqui está o raciocínio: cada par medido,
> os pisos, o que foi tentado e revogado.**
>
> Ele NÃO sobrepõe o que já estava neste arquivo — MEDIDO na entrada da faxina:
> 6% de coincidência. Os dois foram escritos para dizer coisas diferentes.

## A paleta — o raciocínio inteiro

Mora em **`assets/web/shared/tokens.css`**, fonte única carregada pelos dois
`index.html` **antes** da folha do app. Ela é a **identidade oficial da IASD**,
em **DOIS TEMAS**, com o denim `#2F557F` (PMS 302) como núcleo. O raciocínio
completo (cada par medido, os pisos, os ladrilhos da Bíblia) está na seção de
paleta de `docs/arquitetura/DESIGN-SYSTEM.md`.

**NÃO HÁ CONTORNO EM LUGAR NENHUM — E QUATRO EXCEÇÕES NOMEADAS, DUAS DELAS
PEDIDAS.** Nenhuma regra separa caixas com `border`/`outline`; sobrevivem dois
DESENHOS (o aro que gira — `.dl-ring` — e o ✓ do seletor de destinos) e duas
peças que o operador pediu: **o CAMPO DE BUSCA da Biblioteca** e, mais abaixo, a
**DIVISÓRIA entre faixas irmãs** (v1.5.16), que nem sequer é uma `border`. O
campo de busca entrou na v1.5.5 (*"abra uma única exceção ao conceito de
sem bordas do app, para poder fazer a caixa de texto da busca … branca com a
borda em cinza"*), e o que o autoriza é aritmético: no tema CLARO `--bar` é BRANCO
e o campo é branco — **1,00:1** —, e sem contorno a caixa de texto não existe na
tela; foi a mesma conta que criou a faixa `--field-bar` na v5.270, e a borda a
resolve sem trazer a faixa de volta. A COR sai de `var(--surface)` (v1.5.8, pedido do
operador: *"ele deve ser o mesmo cinza dos botões a sua volta"*) — o MESMO token
que os dois quadrados ao lado pintam, composto sobre a MESMA base por um
`background-clip: padding-box`; sem ele a tinta comporia sobre o branco do campo
e sumiria no tema escuro. **Isto revoga o piso de 3:1 da v1.5.5**, que vinha de um
valor calculado (`--field-borda`, hoje removido): no claro esse cinza dá 1,38:1
contra o campo, que é o MESMO degrau em que os botões vivem contra a mesma barra
— a borda não ficou menos visível que eles, ficou igual a eles. **É o NOME que
segura a lista** — ela não tem regra que a próxima borda possa alegar cumprir,
e é por isso que cada exceção entra escrita à mão no oráculo.

**E A EXCEÇÃO DA BIBLIOTECA SAIU (v1.5.14).** Ela existiu da v1.5.9 à v1.5.13,
por autoridade explícita do operador: *"vou lhe dar autoridade para usar sistemas
visuais de design e organização usando bordas, mas apenas para a biblioteca. pois
temos 3 niveis de listagens na biblioteca e o sistema de separação apenas por cor
sólida de cards está limitando nossas opções"*.

**A autorização era para o PROBLEMA, e o problema tinha causa aritmética.** São
QUATRO níveis (janela → seção → álbum → faixa) sobre uma escada de três degraus,
com a janela tendo gastado o de cima na v1.5.7. MEDIDO no renderizado, o desenho
que a moldura sustentava não cumpria o piso de 1,28:1 em **nenhum** par de
superfícies — sete de sete reprovavam no tema escuro — e três pares valiam
**1,00:1** (no escuro, a tampa de um álbum e as faixas dentro dele eram
pixel-idênticas: `--item-fill` **é** `var(--surface-sunk)`, o mesmo token da
tampa sobre a mesma base). O traço de 1px era a única coisa daquela tela com
contraste de verdade, e era por isso que ele parecia funcionar.

A v1.5.14 troca a **escada** pela **alternância** (ver "A hierarquia da
Biblioteca", abaixo): sem escassez de degrau não há o que a borda resolva, e o
pedido de então — *"poucas bordas, sem traços finos, ou designs visualmente
poluídos"* — a dispensa. Com ela saiu o token `--line`, que tinha ficado com zero
consumidores e cujo próprio comentário dizia que ele *"NÃO pode voltar a ser um
filete"* enquanto era o único filete do app.

**E A DIVISÓRIA ENTRE FAIXAS IRMÃS ENTROU (v1.5.16) — a segunda PEDIDA, e a
única que é um TRAÇO.** Pedido do operador: *"Verifique a criação de um elemento
de linha divisória (não borda inteira), na listagem do itens propriamente dos
álbuns, para melhor distinção entre os itens."*

**Ela não é a moldura voltando, e a distinção é de OBJETO — não de espessura.**
A moldura era um retângulo por nível, quatro arestas, em TRÊS níveis ao mesmo
tempo, e carregava a HIERARQUIA, que é o trabalho que a alternância faz hoje com
degrau de verdade. Esta é UMA aresta, num nível só, entre IRMÃS, e faz o que a
alternância por construção não faz: **separar vizinhas do MESMO nível**. As três
palavras que decidem estão no pedido — *"não borda inteira"*: o operador já sabe
que o app aboliu contorno, e está nomeando a diferença.

**E ela é ARITMÉTICA pela terceira vez nesta seção.** Desde a v1.5.14 a faixa é
transparente e a placa atrás dela é `--panel`: o vão de 4px entre duas faixas
mede **1,00:1** contra os dois lados. Não é pouca separação — é separação
nenhuma. `--divisoria` dá **1,88:1** no escuro e **1,99:1** no claro sobre essa
placa (contra os 1,78:1 e 2,51:1 da moldura removida): mesma ordem de grandeza,
um vigésimo da tinta.

**E ELA NÃO É UMA `border`, o que aqui é a parte perigosa.** `border-bottom`
pinta a caixa inteira e não tem como ser RECUADA, que é literalmente o *"não
borda inteira"* do pedido — a divisória começa na coluna do NOME
(`--faixa-coluna-texto`), nunca sob a miniatura. **A forma sai do pedido; o
precedente é que não podia sair de graça:** um traço pintado como bloco de 1px
passaria pela varredura de contorno sem ninguém decidir nada, e o que entraria no
repositório seria *"filete pode, desde que não se chame border"*. Daí o oráculo
ter ganhado o PAR — uma asserção NEGATIVA que varre a base por qualquer bloco de
1px com fundo e reprova todos os outros, e uma POSITIVA que exige que
`--divisoria` tenha **um** consumidor e que ele seja o seletor nomeado. As duas
provadas por reversão.

**E ELA VALE NAS DUAS LISTAS DE FAIXAS, não numa (v1.5.18).** Relato: *"nessa
lista de favoritos também não há a linha divisória que temos nas outras listas na
biblioteca"*. A v1.5.16 desenhou o traço para a faixa de um ÁLBUM, e os favoritos
são outra `<ul>`. **Continua sendo UM consumidor** — a mesma declaração, com os
dois seletores —, e é isso que mantém a asserção POSITIVA de pé: uma segunda
regra pintando o mesmo token seria a porta larga que ela existe para fechar.
**Os dois números que mudam entram por TOKEN, nunca copiados:** a coluna do nome
(aqui a miniatura é `--thumb`, 40px, contra os 38 da `.hymn-play-thumb`) sai de
um `--faixa-coluna-texto` sobrescrito na `.fav-itens`, e a metade do vão que a
caixa reabsorve sai do `gap` DESTA lista (`--sp-3` contra `--sp-2`) — copiar o
número do álbum descentraria o traço, que é exatamente o defeito que a v1.5.17
tinha acabado de corrigir do outro lado.

Os quatro nomes são cobrados um a um no oráculo
(`tools/tokens.test.mjs`, sem `continue-on-error`), e **não há mais recorte por
escopo** — ele era a única exceção que não nomeava uma peça, e uma exceção por
escopo é a que mais barato se alarga. É ele que faz a regra durar:
uma borda é a coisa mais fácil de acrescentar quando duas caixas não estão se
separando o bastante, e ela não quebra nada, não erra alto e não aparece em teste
de comportamento nenhum.

Fora dessa aresta, **o degrau de tom continua sendo a ÚNICA coisa que separa duas
caixas** — daí o resto desta seção.

### As regras

- **Só COR entra em `tokens.css`.** Raio, escala de ícone, curva de toque e
  medidas de layout ficam no `:root` de `controle.css`: são decisões da UI densa
  do Controle, e o Display não teria o que fazer com elas.
- **Três blocos, nesta ordem:** `:root` com o que NÃO muda, `:root` com o tema
  ESCURO (o padrão, sem atributo) e `:root[data-tema="claro"]` (0,2,0 vence
  0,1,0). O claro é um **DELTA**. **Um token que exista SÓ no claro não está
  definido no tema padrão** — o `var()` computa para o valor inicial da
  propriedade, sem aviso, e quem escreveu acabou de ver a cor certa porque estava
  com o claro ligado. `tokens.test.mjs` trava isso.
- **O PALCO NÃO TEM TEMA**, e é isso que faz o recurso valer. `--stage-*`,
  `--wallpaper`, `--lyrics-frame-bg`, as sombras e o `--scrim` moram no bloco
  compartilhado. O Display ficaria escuro por omissão (ele nunca escreve o
  atributo); o que a separação garante é a **PREVIEW do Controle**, que roda no
  documento que TEM tema e existe para ESPELHAR o telão.
- **E a regra vale para as REGRAS, não só para os tokens.** Nada pintado no palco
  pode ler um token redeclarado em `[data-tema]` — as folhas do palco liam
  `--brand`, `--live-strong`, `--bg` e `--accent-glow`, e com o tema CLARO ligado
  o título do slide de capa saía em denim sobre o preto do palco: **2,73:1**. Daí
  `--stage-accent`, `--stage-accent-glow`, `--stage-on-accent` e `--stage-alert`.
  O `smoke.mjs` compara a COR COMPUTADA de cada camada nos dois temas — a versão
  que comparava NOMES de token deixava o defeito passar por baixo.
- **Três matizes, com papéis que não se misturam.**
  - **Azul denim** é a marca **e** o accent: `--brand` e `--accent` têm o mesmo
    valor de propósito, e os dois nomes existem para distinguir na folha "isto é
    marca" de "isto é navegação".
  - **Vermelho** (`scarlett`) é atenção, em dois papéis separados pela
    INTENSIDADE do preenchimento: saturado (`--live`) = está no ar agora, e não
    pode ter concorrente na tela; suave (`--live-fill` numa linha, `--btn-danger`
    num botão) = ação destrutiva — inclusive o botão que CONFIRMA uma exclusão
    (`openAppDialog({ perigo: true })`), que vestia o azul primário até a v1.4.0.
  - **Verde** (`--ok`, do `treefrog`) é **só** concluído/conectado. Ele já disse
    "está no ar" em dois lugares enquanto outros quatro diziam o mesmo em
    vermelho — duas cores opostas para a mesma mensagem na mesma tela.
- **Os fundos de estado são OPACOS** (`--sel-fill`, `--live-fill`, `--ok-fill`), e
  isso é medido: `--accent-soft` a 16% sobre o painel compõe `#3d4959`, que é o
  `--panel-2` desta paleta — uma linha SELECIONADA ficava com a cor exata do
  nível de baixo da árvore. Opacos, valem o mesmo em qualquer nível: **um estado
  SAI da escada em vez de ocupar um degrau dela**.
- **E A SUPERFÍCIE DE UMA AÇÃO TAMBÉM É OPACA** (`--btn-accent`, `--btn-danger`,
  `--btn-warn`). Os `-soft` são tinta com ALFA, e alfa EMPILHA:
  MEDIDO no escuro, o mesmo botão derivava **1,97:1** entre a base mais escura e
  a mais clara em que ele pousa — mais que o degrau `--bg` × `--panel` (1,49:1).
  O chevron de uma SEÇÃO compunha `#3d4959` e o de um CARD, `#4a596d`: um
  controle, duas cores. Os `-soft` ficam para o que é wash de verdade (a sombra
  do pulso, o trilho do `.dl-ring`); **fundo de botão ou de chip usa `--btn-*`**,
  e `tokens.test.mjs` trava isso.
- **UMA LINGUAGEM DE ESTADO SÓ, e ela responde a quatro perguntas.** O app
  tinha três maneiras de dizer "isto está ativo" (preenchido, `--sel-fill`, e
  **só cor de texto** — a fraca, de que o operador reclamou no botão de
  repetição). Hoje **ESCOLHIDO** entre alternativas e **LIGADO** (interruptor)
  são o MESMO par, `--btn-accent` + `--accent` (v1.8.95, que revogou a metade
  ESCOLHIDO a pedido do operador — *"um azul forte, sólido, que deveria ser
  reservado para botões e não seleções"* —, deixando o denim `--accent-fill` +
  `--on-accent` só nos BOTÕES: 5,37:1 e 6,37:1 de tinta, com o preenchimento
  contra a pílula apagada caindo a 1,43:1 e 1,14:1, e o que separa os estados
  passando a ser a MATIZ; `tokens.test.mjs` trava);
  **SELECIONADO** numa lista = `--sel-fill`; **ABERTO** = não é cor (a seta que
  gira, o corpo à vista, a tampa que gruda e o nome em accent da pasta já
  dizem). **Cor de texto nunca carrega estado sozinha.**
  **E A LINHA COM GAVETA É A EXCEÇÃO NOMEADA, por decisão do operador**
  (v1.5.17 → v1.5.18). O `.lib-item.expanded` pintava um overlay de
  `--surface-sunk`, escrito na v5.271 quando a faixa FECHADA já vinha recuada —
  ele era MAIS UM degrau sobre um degrau que existia. A v1.5.14 tirou o
  preenchimento do nível 3 e ele virou o ÚNICO tom da faixa aberta, num lugar
  que a alternância não tem: MEDIDO, **1,15:1** no escuro e **1,39:1** no claro
  entre o título e o corpo do MESMO item — o relato (*"a zona do título e
  thumbnail está ficando diferente da cor do corpo desse item"*). O achado foi
  que a MESMA gaveta já media **1,00:1** na lista de BUSCA, onde `--linha` é
  opaco e a `.row` escondia o overlay: **o app tinha duas leituras do mesmo
  objeto**, e ninguém tinha escolhido entre elas.

  **A v1.5.17 escolheu a de cima (a tampa vira o papel do item) e o operador
  escolheu a de baixo:** *"as opções de play não estão colorindo o card dono
  daquelas opções … o card titular do item não ganhou a cor de seleção/cor do
  corpo da caixa de opções"*. Para quem opera, o corpo de um item aberto é o
  POÇO — a superfície grande que a gaveta abre —, e não o papel dos blocos que
  descansam nele. Hoje a TAMPA veste `--gaveta-bg`, tampa e corpo são uma
  superfície só, e os botões flutuam dentro dela. Isto vale nas QUATRO listas
  (acervo, favoritos, busca e pasta do aparelho), por `background` na `.row` e
  não por `--linha`: as quatro resolvem esse token de jeitos diferentes, e uma
  delas é escopada com id. Os três `:not()` são a precedência do estado — uma
  linha NO AR que o operador abra continua vermelha. E a divisória acima dela
  SOME, de propósito: o traço mora sob a `.row`, e ali quem separa é o
  preenchimento.
  E quando AÇÃO e ESCOLHA dividiam a MESMA faixa — o trilho de navegação foi o
  único caso, e saiu na v1.5.0 — a ação descia para `--btn-accent` e a ESCOLHA
  era marcada **sem área**: uma barra de 3px em `--accent` na borda de cima da
  aba, mais o glifo na mesma cor (v1.3.15). Duas manchas cheias na mesma faixa
  disputam, e a que menos deve disputar é a que só diz "você está aqui" — régua
  que fica, mesmo com o par de ESCOLHIDO sendo hoje o próprio `--btn-accent`.
  **E UM INTERRUPTOR APAGADO É UM BOTÃO NORMAL** (v1.4.25): a estrela e o
  "à playlist" vestiam `--line` — a cor de LINHA, que já então quase ninguém
  usava e que saiu de vez na v1.5.14 —, e o operador os lia como indisponíveis (*"foi simplesmente
  ofuscado o botão inteiro"*). Apagado é o `.row-btn` de sempre; quem carrega o
  estado é o ÍCONE (vazado × cheio, `+` × `✓`), com a superfície `--btn-accent`
  como reforço. **Ofuscar não é dizer "desligado": é dizer "indisponível", e o
  app já tem uma linguagem para isso** (`opacity: .3` + `disabled`).
  **E NA GRADE DE CONFIGURAÇÕES A REGRA VIROU ABSOLUTA** (v1.7.6): nenhum tile
  apaga, nunca. Pedido do operador — *"todos os botões devem ter o mesmo azul de
  ativo, não temos mais essa diferença, toda diferença de estado é pelo icone,
  não pela cor"*. Os dois que ainda escureciam (o fundo da letra e o giro) já
  tinham o estado no DESENHO, então a luz era a segunda cópia da mesma resposta.
  **A consequência para o próximo tile é a soma de duas remoções** — a palavra
  do estado saiu na v1.7.2, a cor saiu agora: *um estado que não caiba num
  desenho não cabe naquela grade*.
- **E O TEXTO DO TEMA CLARO É PRETO — o ÚNICO desvio declarado da paleta**
  (v1.5.12). Pedido do operador, na terceira rodada sobre a legibilidade da
  Biblioteca: *"use a cor preta pra os textos e não cinza como me parece ser
  hoje"*. `--text` era `#4a4a4a`, o **`night` OFICIAL** — não um cinza escolhido,
  mas A cor de texto da identidade. O operador o leu como cinza duas vezes, e a
  leitura está certa: `night` É um cinza escuro, e sob a luz de um salão ele se
  lê como texto apagado. MEDIDO: 6,87:1 → **16,28:1** sobre a página, 8,86:1 →
  **21:1** sobre o painel branco, 5,33:1 → **12,62:1** sobre a tampa azul da
  Biblioteca. **`--muted` NÃO acompanha** — é ele que mantém a regra NOME ×
  NÚMERO da v1.5.11, e o par abriu de 1,33:1 para 3,15:1. Os ladrilhos da Bíblia
  não foram retocados e não podiam precisar: escurecer o texto só afasta o
  rótulo do ladrilho (pior caso, 6,46:1 → 15,31:1). `smoke.mjs` guarda o desvio
  com um LITERAL, de propósito: quem conferir a paleta contra a marca encontra o
  preto, conclui que é um deslize e o desfaz de boa-fé.
- **Nem todo token é valor oficial, e os derivados estão marcados.** Os dezoito
  oficiais foram desenhados para fundo BRANCO — todos passam AA sobre branco, e
  **nenhum** passa AA como texto sobre o quase-preto do tema escuro (bluejay dá
  3,97:1). Onde clarear/escurecer foi preciso, o comentário de `tokens.css` diz
  de qual oficial o valor saiu, e a matiz é preservada. Nos ladrilhos da Bíblia a
  identidade tem sete famílias de matiz e a tela precisa de DEZ grupos separáveis
  por ≥20°: cinco são oficiais, cinco preenchem os vãos.

### O feedback de toque é um RECUO ABSOLUTO, nunca uma fração

`--press` foi `scale(.96)`, e **uma FRAÇÃO aplicada a alvos de 34px a 408px não
é um valor: são doze**. MEDIDO, o recuo por lado que ela produzia:

| alvo | caixa | recuo |
|---|---|---|
| `.back-btn` · `.popup-close` | 34×34 | **0,7px** — imperceptível |
| `.t-btn` | 53×36 | 1,1 lateral · 0,7 vertical |
| `.tab` | 143×38 | 2,9 lateral · 0,8 vertical |
| `.dialog-btn` | 157×33 | **3,1 lateral · 0,7 vertical** |
| `.lib-item` | 408 | **8,2px** — exagerado |

São as DUAS queixas do operador de uma vez, e o `.dialog-btn` é literalmente o
botão de confirmar exclusão: um aperto de LADO, que não se lê como "apertei".

Hoje **`--press: translateY(2px)`** — o mesmo recuo em qualquer alvo, a metáfora
da tecla que afunda — mais **`--press-luz`**, um `filter: brightness()` (1.35 no
escuro, .88 no claro) que responde até no que não tem fundo, acendendo o próprio
traço. `filter` e não overlay de fundo porque não disputa propriedade com quem
já usa `background-image` (a faixa da célula da Bíblia, a pílula do livro, o
vazado da aba).

**E O RECUO É DO CONTROLE FOLHA; UM BLOCO RESPONDE SÓ COM A LUZ** (v1.7.4).
Pedido do operador sobre a Biblioteca: *"Há um efeito de encolhimento que
distorce os elementos, remova esse efeito, deixe apenas um efeito de
coloração/sombreamento ao toque sem encolhimento. Também aproveite para
verificar se está colorindo o corpo do card corretamente e não apenas o
arrangment/card do texto ou cabeçalho."*

A regra **já estava escrita na `.coll-bar` desde a v5.288** (*"um contêiner que
hospeda um controle nunca escala — ele responde por PREENCHIMENTO, que não move
nada"*), e a v1.3.14 a contrariou ao pôr as duas barras que abrem um bloco na
lista do `--press`. As duas metades do relato são o mesmo defeito:

- **a barra é TRANSPARENTE**, então o `filter` acendia só o TEXTO e os ícones — o
  corpo do card, com as margens e os cantos, ficava intocado;
- **e ela DESLIZA dentro de um bloco parado**: o `translateY(2px)` move o
  conteúdo da tampa enquanto a pílula fica onde está, e o que se vê é a tampa
  escorregando e sendo recortada.

Hoje quem responde é o BLOCO, com a luz e por inteiro — `.hymnal-card`,
`.coll-group--drop` e a `.lib-item` (a linha de lista, que é o outro contêiner
que hospeda controles) —, em qualquer profundidade e nos dois estados. A pergunta
é `:has(> tampa:active)` e não `:active` no bloco: com o card ABERTO o corpo dele
é a lista inteira, e `:active` casa em ancestral.

**E ELE PEDE UMA TECLA — sobre a PREVIEW não há nenhuma** (v1.4.33). Relato do
operador: os botões de mudo e da cortina *"ainda estão erroneamente com o
feedback tátil de quando ainda estavam na barra"*. O `.pv-fab` não tem pastilha:
ele É o traço branco sobre o que estiver projetado, e um recuo ali não se lê
como "apertei" — lê-se como o ícone PULANDO por cima da imagem no ar (sem TV,
essa imagem é a projeção). A LUZ também não salva: MEDIDO no `#muteToggle`, o
`brightness(1.35)` leva o traço de **240,6 a 238,3** (branco já está no teto,
então ela só DESBOTA o halo escuro) e o fundo de 14,3 a 14,5 — os dois
invisíveis, e o que sobrava era só o deslocamento. Por isso o `.pv-fab` saiu da
lista e tem resposta PRÓPRIA: a **pena do traço** (mais o halo, que engrossa
junto). É o que responde sobre um fundo DESCONHECIDO — MEDIDO, +21% de
luminância média sobre o wallpaper escuro e −10% com +67px de contorno sobre um
slide branco. Não é escala: a caixa não muda de tamanho e a regra do recuo
absoluto segue intacta para quem TEM tecla.

**As duas armadilhas que a escala criava morreram com ela:**

- **O HIT-TEST.** A `.coll-bar` do card tem 408px: 4% recuavam a borda direita
  ~8px, e o botão de baixar está colado nela — **MEDIDO, 6 de 11 toques no botão
  de fato baixavam**, e os 5 que erravam eram todos à direita. 2px na VERTICAL
  não tiram dedo nenhum de um alvo de 34px.
- **A FRESTA do aninhamento** (v1.2.27). `:active` casa também nos ANCESTRAIS:
  0,96 × 0,96 deixava o filho 7px mais estreito de cada lado que os irmãos, com
  o fundo do cartão aparecendo nela. Dois recuos são 4px na MESMA direção, sem
  mudar de largura.

**O que fica: um ANCESTRAL não responde ao toque que foi para um filho** — e as
guardas suprimem as DUAS partes (`transform` e `filter`), senão o bloco inteiro
acende por um toque de 40px, que é o mesmo defeito por outra propriedade. Antes
de pôr uma classe na lista, pergunte se um ancestral dela já está lá.

**E A LISTA É UM `:is()`, QUE É FORGIVING — um seletor inválido ali some em
SILÊNCIO** (v1.4.31). A v1.4.27 subiu com uma marca de conflito de merge por
resolver DENTRO desse `:is()`; o navegador descartou os componentes inválidos e
aplicou o resto, então as ~40 classes seguiram recuando ao toque, o CI seguiu
verde por três lotes, e o que se perdeu foram só os DOIS seletores em disputa
(`.row-slot--ok` e `.lv-row--tocavel`), que pararam de responder ao dedo sem
nada na tela dizer por quê. **Um oráculo de COMPORTAMENTO não pega isto** — ele
mede um seletor que sobreviveu. Quem pega é o `tokens.test.mjs`, que varre o
arquivo CRU: nenhuma folha nem HTML da base carrega marca de conflito.

**E A LISTA DE GUARDAS É O QUE ENVELHECE**, não a regra: a `.row-acoes` — a
faixa de opções da linha, que é onde o operador de fato toca — ficou de fora
dela até a v1.4.25, e o cartão do Cronograma balançava 2px a cada toque no
excluir. A dos FAVORITOS já estava coberta (ela mora numa `.hymn-gaveta`), e era
só isso que fazia o defeito aparecer numa lista e não na outra. **Bloco novo que
hospede controles entra na lista no MESMO lote em que nasce**; a régua é a do
parágrafo acima, e ali a resposta ao toque nem é o botão afundando — é a faixa
TROCANDO DE CONTEÚDO (a pergunta do excluir, o campo do renomear). Oráculo:
`smoke.mjs`, medindo `transform` E `filter` do cartão durante uma pressão de
verdade. O `controles-layout.test.mjs` guarda a exceção da
preview, nas três metades: a caixa não anda, o traço responde no RENDERIZADO, e
o botão da BARRA continua afundando.

**E ELA FOI COBRADA UMA VERSÃO DEPOIS DE ESCRITA:** o `.row-slot` da v1.4.27 (o
✓ do renomear, que mora na coluna do `⋮`) vive FORA da `.row-acoes`, e a guarda
acima cobre a FAIXA — sem acrescentá-lo, o balanço voltava pelo botão novo.

### A escada de camadas

- **A superfície AFUNDA dentro de um cartão** (regra no topo de `controle.css`).
  `--surface`/`--surface-2` são branco com alfa, então EMPILHAM: o mesmo token
  sobre `--panel` produz base bem mais clara do que sobre `--bg` — era a causa
  raiz do pior contraste do app. Não existe alfa que resolva os dois casos, então
  dentro do cartão o sinal se INVERTE (o overlay passa a ser preto), que também é
  a convenção certa de UI escura: o cartão já está elevado, logo o controle
  dentro dele é recesso, e emite menos luz num salão escuro. Custom properties
  HERDAM, então a regra só marca os elementos que de fato pintam `--panel`. **O
  SINAL é o mesmo nos dois temas** (flutua sobre a página, afunda dentro do
  cartão); só a intensidade muda, daí `--surface-sunk` ser token. O par FLUTUANTE
  tem nome próprio (`--surface-alta`/`--surface-2-alta`) porque há um caminho de
  VOLTA — a folha da Biblioteca é nível 0 e um controle lá dentro flutua de novo,
  coisa que um override do mesmo nome não daria (`--surface: var(--surface)` é um
  ciclo que o CSS descarta).
- **E A JANELA DA BIBLIOTECA GASTOU O DEGRAU DE CIMA** (v1.5.7). Ela pintava
  `--bg` e passou a pintar `--panel`, a pedido do operador (*"bordas curvas e tom
  branco como base"*) — e com isso sobraram DOIS degraus para TRÊS níveis de
  lista. Qualquer arranjo deixava dois com o mesmo tom: MEDIDO, seção e card a
  **1,00:1**, que é o defeito da v5.241 de volta.

  **A v1.5.7 e a v1.5.8 responderam com COR e o operador reprovou** (três
  capturas): oito matizes por coleção, em ordem de espectro, com três famílias de
  tom cada. *Cor sólida não diz o que está dentro do quê* — e a razão é que cor é
  um encode **nominal** (categoria), não **ordinal** (profundidade). É por isso
  que ela funciona nos ladrilhos da Bíblia, que são uma GRADE PLANA de irmãos
  onde a cor diz *"que grupo de livros"*. A v1.5.9 respondeu com MOLDURA e durou
  cinco lotes.

  **E A v1.5.14 TROCOU A PREMISSA: papel → poço → papel.** A prova de que nenhuma
  das nove tentativas podia fechar é aritmética — quatro degraus no piso de
  1,28:1 partindo do branco dão `#ffffff → #e3e3e3 → #cacaca → #b3b3b3`, e o
  nível 3, onde mora TODO o texto da lista, cairia no cinza médio que o operador
  recusou na v1.5.10. **Não existe escada de TOM que resolva quatro níveis sobre
  base branca.**

  Uma escada ACUMULA e acaba; uma alternância não:

```
janela              PAPEL  (--panel)   cabeçalho GRUDENTO, top 0
  ├ seção           POÇO   (--poco)    cabeçalho GRUDENTO, top 0
  │   └ álbum       PAPEL  (--panel)   cabeçalho GRUDENTO, top --bar-secao-h
  │       └ faixa   —                  sem fundo: preenchimento é ESTADO
  │                                    (irmãs separadas por `--divisoria`)
  └ hinário/série   POÇO   (--poco)    cabeçalho GRUDENTO, top 0
      └ a PLACA     PAPEL  (--panel)   o `.coll-open`, o nível 2 desta perna
          └ faixa   —                  a MESMA base da faixa de álbum
```

  Duas superfícies e profundidade ilimitada. MEDIDO no renderizado: **1,43:1**
  em cada degrau no escuro e **1,35:1** no claro, contra 7/7 e 4/7 reprovando o
  piso antes. O único traço da tela é a divisória entre faixas IRMÃS (v1.5.16),
  e ela é ortogonal a esta escada: a alternância separa NÍVEIS e por construção
  não separa vizinhas do mesmo. **A regra é por PROFUNDIDADE, nunca por tipo de
  bloco**: as coleções fixas e as pastas nascem na RAIZ, são nível 1 e vestem o
  poço; o mesmo `.hymnal-card` dentro de uma seção é nível 2 e veste papel.
  Escrevê-la por tipo (`.hymnal-card { papel }`) foi o primeiro corte do lote e
  MEDIU 1,00:1 — os hinários da raiz sumiam sobre a janela branca.

  **E A ÁRVORE NÃO TEM PROFUNDIDADE UNIFORME — daí a PLACA** (v1.5.15). Uma
  seção contém CARDS; uma coleção da raiz contém FAIXAS. Sem fundo próprio a
  faixa pousa no que o bloco pinta, então a MESMA `.hymn-result` saía em duas
  cores conforme onde a coleção calha de morar — papel dentro de uma seção,
  AZUL num hinário ou numa série da raiz. Relato do operador: *"isso era pra ser
  assim? fundo azul nos itens do provai e vede? e etc...?"*.

  A alternância não estava errada: faltava o degrau de baixo dela. A regra
  completa é **o poço é a MOLDURA de um agrupamento; o papel é onde o conteúdo
  pousa** — e o `.coll-open` de uma coleção da raiz é o nível 2 daquela perna, a
  irmã exata da placa dos Favoritos (`.fav-itens`), que já fazia isto no mesmo
  lote. A GEOMETRIA copia a da seção número por número (a `margin` da placa é o
  que o `.coll-group-corpo` reserva a um card), então a faixa continua onde
  estava.

  **A placa é o CORPO ABERTO INTEIRO, e não só a lista.** O DESTAQUE do sábado e
  o ÍNDICE de temas são os dois únicos blocos do acervo que só existem na raiz, e
  os dois pintam contando com papel embaixo: MEDIDO, `--sel-fill` (o bloco do
  destaque) dá **1,31:1** sobre o papel — o par para que ele foi desenhado — e
  **1,03:1** sobre o poço no tema claro. Deixá-los fora da placa consertaria a
  lista e deixaria o "ESTE SÁBADO" invisível, que é o mesmo defeito um bloco
  acima.

  **E A PROFUNDIDADE É DITA POR TRÊS MECANISMOS NÃO-TONAIS**, que é o que os
  torna ilimitados:
  1. **CABEÇALHO GRUDENTO NOS DOIS NÍVEIS.** É o único que continua respondendo
     DEPOIS de a lista rolar — tom, cor e borda só falam enquanto o topo do grupo
     está à vista, e a queixa do operador (*"dificultando discernir se estou em
     uma camada ou subcamada"*, v5.267) é sobre estar no MEIO de uma lista longa.
     O `.coll-bar` do álbum já grudava desde a v5.242, com o argumento escrito
     lá: *"a outra metade da pergunta 'onde eu estou?'"*. Faltava no nível 1,
     justamente o que ele não distinguia. A altura da barra da seção é token
     (`--bar-secao-h`) porque DUAS regras precisam do mesmo número, e é
     determinística (nome `nowrap` + recuo fixo) — nada de medição em JS, que a
     v1.5.3 ensinou a desconfiar. **O valor é `calc(var(--hit) + .7rem)` desde a
     v1.5.16** (era `+ 1.1rem`), e quem o mudou foi o ORÇAMENTO da lista
     colapsada, não o desenho da barra — ver abaixo.

     **E O `top` DE UMA TAMPA É A PROFUNDIDADE DELA, nunca o tipo do bloco**
     (v1.5.15). A v1.5.14 deu a TODO `.hymnal-card.expanded` o `top` do segundo
     degrau, hinários e séries da RAIZ inclusive — que não têm barra nenhuma
     acima. **O vão que sobrava não é neutro: ele É o scrollport**, e a lista
     rolava por ali À VISTA. Os dois relatos do operador saem dele: *"a lista
     está vazando acima"* (as faixas do próprio card por cima da barra que as
     encabeça) e *"essa sobreposição também permanece, mesmo após terminar a
     lista de um álbum… parecendo que um álbum está pertencendo a outro"* — a
     barra DESGRUDANDO, que sobe do slot dela até sumir e nesse trecho continua
     inteira no topo, pintada por cima das coleções seguintes.

     **E O SCROLLER NÃO PODE TER `padding-top`, pela mesma razão** — padding de
     um scroller é scrollport. Era a metade FINA do mesmo relato (.5rem de
     faixas à mostra acima de QUALQUER tampa colada). Ele foi a zero e não virou
     margem: a caixa da lista tem de começar exatamente onde a barra de busca
     acaba, que é o contrato geométrico da janela e tem oráculo.
  2. **RECUO**, sem traço na coluna vazia.
  3. **RANK TIPOGRÁFICO**: seção `--fs-xl`, card `--fs-lg`, faixa `--fs-md`. Eram
     `.9`/`.88`/`.82` — dois centésimos entre os dois primeiros, que é ruído e
     não hierarquia. A migração para a escala achatou os dois no mesmo degrau e o
     `smoke` pegou; com a moldura fora, o rank virou um dos três mecanismos e
     tinha de ser um degrau de verdade.

  **E OS NOMES SE ESCREVEM TODOS IGUAL** (v1.5.11): a barra da seção perdeu a
  caixa alta e o tracking. Pedido do operador: *"Nessas coleções, padronize em
  caixa alta, ou em formatação normal"* · *"aproveite para pôr o texto em branco
  no tema claro para os textos sobre o azul"*. **Branco era impossível sobre a
  tampa da época** (`#bdcada` no claro dá 1,66:1 contra os 4,5:1 de AA), e o que
  o pedido alcança é o outro lado: escurecer. **`--muted` fica no que é NÚMERO** —
  o contador da seção, o peso do card. A caixa alta podia sair porque o
  ranqueamento que ela carregava passou para o desenho; e devia sair porque caixa
  alta a 14px é mais larga e mais lenta de ler.

  **E O ORÇAMENTO DA LISTA COLAPSADA É UMA CONTA, não uma sensação** (v1.5.16).
  Pedido do operador: *"todas as coleções caibam na tela enquanto estiverem
  colapsadas, sem a necessidade de rolar … reajustar o tamanho dos cards das
  coletâneas e espaços, para que eles aproveitem exatamente esse espaço"*. Duas
  metades, e a primeira é EDITORIAL (uma coletânea a menos — ver
  `controle/coletanea.js`); a segunda é geométrica. MEDIDO a 430×900, com
  **582px** de caixa de lista: antes, 9 blocos davam 553,9px (cabiam) e 10 davam
  615,1px (rolava). Apertar as DUAS barras (`padding` de `.55rem` para `.35rem`,
  e o `--bar-secao-h` acima) leva 10 blocos a 551,1px e 11 a 605,9px.
  - **APERTAR e não ESTICAR, e a razão é o vão dos FAVORITOS.** Esticar até o
    encaixe exato o levaria de 131px a 55px, e a seção passaria a rolar quando
    aberta — desfazendo a v5.273/v5.277, que o operador pediu duas vezes.
  - **O SEGUNDO PREÇO ERA A SOBRA, e ele foi pago na v1.5.17.** Apertar AFASTA
    do enchimento exato em vez de aproximar: com os 9 blocos do acervo
    dissolvido a lista ocupava 496,3 dos 582px e sobravam **~86**, contra os ~28
    que sobrariam sem o aperto. O operador viu a faixa vazia e pediu o oposto —
    *"o aproveitamento da altura não está correto, está sobrando … o tamanho
    deve ser ajustável para se encaixar a altura da tela"*.
  - **E a promessa vale de 430px para cima.** MEDIDO: a 393×786 (entalhe de
    39px, caixa de 436px) cabem 7 blocos nos DOIS desenhos — ali o aperto não
    compra bloco nenhum; a 360×740 (24px, 420px) ele vai de 6 para 7. Com 9
    blocos, os dois continuam rolando.

  **E A SOBRA VIROU CRESCIMENTO (v1.5.17), sem uma linha de JS.** `#hymnResults`
  é uma `.popup-list` — coluna flex — e os blocos de raiz caíam em
  `.popup-list > li { flex-shrink: 0 }` **sem `flex-grow`**: o excedente inteiro
  se acumulava no fim da coluna. `flex-grow: 1` nos blocos de raiz COLAPSADOS é
  a resposta inteira ao pedido, e é ela que torna a altura *ajustável por
  construção* — o navegador reparte a sobra quando o conteúdo cabe e o
  crescimento é **inerte** quando ele transborda. MEDIDO: a 430×900 o bloco vai
  de 45,19px a **54,70px** e a sobra a **zero**; a 360×740 nada muda (45,19px,
  rolando). **Os dois mecanismos convivem e resolvem pontas diferentes:** o
  aperto decide QUANTOS blocos cabem (vale na tela pequena, onde não há sobra a
  repartir), o crescimento decide o que fazer com a sobra (vale na grande).
  - **O seletor nomeia os DOIS blocos que existem na raiz, nunca `> li`**:
    `.acervo` está sempre no `#hymnResults`, e as linhas da BUSCA são filhas
    diretas dele — MEDIDO, com `> li` elas iam de 97,3 para 306,4px. A pasta do
    aparelho fica de fora: ela não é bloco de raiz, e o ouvinte de abrir dela é
    da `.row` — crescer sem mover o alvo devolveria a margem morta.
  - **A BARRA NÃO CRESCE JUNTO**, e isto é invariante e não estética:
    `medirVaoDosFavoritos` soma as BARRAS das vizinhas para escrever
    `--fav-vao`, e uma barra que cresce realimenta a conta até o vão deixar de
    ser dos Favoritos — quem REPROVA essa variante é o `boot-nativo.test.mjs`,
    o único oráculo que lê `--fav-vao`. O bloco cresce, a barra fica em
    `--bar-secao-h` e o rótulo é CENTRADO nela.
  - **E O BLOCO É O ALVO E A RESPOSTA** — senão a faixa de ~4,8px em volta da
    barra vira MARGEM MORTA, que é o que o recuo da `.coll-bar` existe para
    impedir desde a v5.288. Ela falhava de DOIS jeitos: numa SEÇÃO o ouvinte
    morava na barra e o toque ali não fazia NADA (9,5px por bloco); num
    `.hymnal-card` o ouvinte já é do `li`, o toque ABRIA e nada respondia,
    porque quem estava na lista do `--press` era a barra. Hoje o ouvinte da
    seção mora no `li` — com guarda POSITIVA (o `li` ou a barra), senão um toque
    num favorito fecha a seção debaixo do dedo — e o `--press` é do bloco, com a
    barra calada dentro dele. **Regra separada e não mais um nome na lista do
    `--press`:** `:is()` toma a especificidade do argumento mais específico, e um
    seletor com id ali levaria as ~40 classes da lista para (1,x,0) de uma vez.
  - **`--bar-raiz-max` é o TETO** (`--hit + 2rem` = 66px), porque a lista pode
    ter POUCOS blocos: sem teto, três coleções dão 183,28px cada — barras do
    tamanho de um cartão, o defeito oposto. Ele anda com `min-height:
    min-content`, senão um card com subtítulo é RECORTADO (MEDIDO, 45,19 →
    40,00 com um teto de 40).
  - **A lista passa a RESPIRAR ao abrir uma seção** (uma irmã colapsada desce de
    54,28 para 48,64px acompanhando a curva do acordeão). É o recurso, não um
    defeito: evitá-lo com um `:has()` faria a lista PULAR num quadro.
  - **E A TAMPA PASSOU A SER MEDIDA, PARA NÃO ENCOLHER AO ABRIR** (v1.5.19).
    Relato: *"o card do titulo … está encolhendo ou modificando seu tamanho ao
    abrir sua listagem"*. É este crescimento visto pelo outro lado: colapsado o
    bloco cresce até a altura de encaixe com a barra CENTRADA dentro; ao abrir
    ele sai de `:not(.expanded)`, perde a repartição, e a tampa cai para a barra
    nua. MEDIDO na captura do operador: **−11,2%** (51,00 → 45,01), em DOIS
    quadros, enquanto o corpo desliza por 220 ms.
    **O TEOREMA QUE FECHA AS SAÍDAS EM CSS PURO:** a tampa só pode ser CONSTANTE
    no valor MÍNIMO dela — qualquer altura maior tem de caber em toda tela e em
    todo número de blocos, e a "altura de encaixe" é função da TELA e do NÚMERO
    de blocos. Ela **não existe como valor em CSS**. Logo, ou a pílula emagrece
    para 45,19 sempre (e a sobra vai para os vãos, que sobem de 10 para 16–21px),
    ou o número é MEDIDO. **O operador escolheu manter a pílula gorda**, e daí o
    `--tampa-h`: a irmã exata do `--fav-vao` (`medirTampa`, no `controle.js`),
    lida pelo CSS nos DOIS estados — `height` no fechado, `padding-top` acima da
    barra no aberto. MEDIDO: Δ ≤ 0,02px em 24 cenários (4 telas × 2 temas ×
    3/9/20 blocos).
    - **A CLÁUSULA DOS FAVORITOS É OBRIGATÓRIA**, e sem ela o lote não sai: a
      seção deles ABERTA nunca veste `--tampa-h` (ela tem
      `min-height: var(--fav-vao)` e come a folga sozinha, v5.273), e contá-la na
      divisão dá a cada irmã uma fatia da folga que ela já gastou — MEDIDO,
      **81,5px** de transbordo a 430×900 e o `smoke.mjs` reprovando em *"as
      fechadas ficam EMPILHADAS NA BASE"*. Como o `verificar` é `needs` do
      `web-ota`, isso seria o bundle não chegando à frota.
    - **E É SÓ A DELES.** Descontar TODO bloco aberto é a variante óbvia e está
      ERRADA (MEDIDO): ela leva `--tampa-h` ao piso assim que alguém abre um
      hinário, devolvendo o defeito original. Um bloco que o operador abriu
      continua contando como FECHADO — é a hipótese "tudo fechado" que dá a
      altura que a tampa dele tem de manter.
    - **A ORDEM entre as duas medições é obrigatória**: `--tampa-h` lê a altura
      RENDERIZADA dos Favoritos, governada por `--fav-vao`. Não há
      realimentação (o `--fav-vao` soma BARRAS, que `--tampa-h` nunca muda —
      MEDIDO, 1769px antes e depois), mas há ORDEM, e ela sai de graça do
      agendamento: `acertarVaoDosFavoritos` registra o `rAF` DENTRO da passada e
      `acertarTampa` no `finally` dela.
    - **O `max-height` FICA**, inerte no regime normal (o JS já limita pelo mesmo
      teto): é ele que segura o QUADRO PRÉ-MEDIDA — MEDIDO, sem ele três
      coleções dão 184,34px por bloco antes de a medida chegar.
    - **O QUE SAI JUNTO, dito:** a lista deixa de "RESPIRAR" ao abrir uma seção.
      Aquele respiro nasceu como argumento para não combatê-lo com `:has()`,
      nunca como pedido — e é a mesma repartição que produz o salto: em CSS puro
      os dois não são separáveis.
    - **O RESÍDUO, nomeado:** onde a lista JÁ transborda (393×786 e 360×740 com
      9 blocos), abrir uma SEÇÃO ainda aumenta a tampa em **5,59px (+12,4%)**.
      Não é regressão — é o número da própria base —, e a causa é assimétrica e
      está na folha: o `box-shadow` existe na `.coll-bar` de um card aberto e
      **não** na `.coll-group-bar`.
  - **E O QUE SOBROU DEPOIS DELE ERA O RECUO DE BAIXO** (v1.5.18). Relato, já
    com os blocos crescendo: *"há uma margem maior na parte de baixo … o ajuste
    ainda não ficou correto"*. Não havia mais sobra por repartir — o que restava
    era o `padding-bottom` do scroller, `.8rem` MAIS `env(safe-area-inset-bottom)`.
    **A ÁREA SEGURA SÓ VALE ONDE A JANELA ENCOSTA NA BASE**, e desde a v1.5.4 ela
    para na linha dos controles: o recuo reservava lugar para uma barra de gestos
    que não é vizinha dela. Ele volta a valer nos DOIS casos em que a janela vai
    mesmo até o fim (Modo Fácil e teclado no ar). E o valor é **`--sp-5`, o mesmo
    `gap` que separa dois blocos de raiz** — com o crescimento preenchendo o
    resto, qualquer outro número põe o último bloco a uma distância da borda que
    nenhum par de vizinhos tem, que é literalmente o que o relato descreve.

  **E A BORDA DO SCROLL DIZ QUE HÁ MAIS** (v1.5.16 aqui; o app inteiro desde a
  v1.8.58). Pedido do operador: *"que o scroll da biblioteca tenha um efeito de
  blur na borda interna superior ou inferior, quando algum elemento da tela ir
  para debaixo dessa borda"*. São dois `::before`/`::after` `position: sticky`
  DENTRO do scroller.
  - **A TINTA É UMA SOMBRA, e ela não é decisão desta lista.** O primeiro
    desenho foi BLUR, com o argumento de que *"não existe cor certa para o
    véu"* — a alternância papel → poço → papel põe DUAS superfícies sob a mesma
    borda. O que resolveu isso foi a cor ser **alfa** (`--sombra-rolagem`,
    rgba preta), que pousa igual nas duas: MEDIDO, α .30 lê 1,51:1 nos DOIS
    temas. Com isso o `backdrop-filter` saiu, e com ele o custo que prendia o
    efeito a um scroller só. A regra vale para o app inteiro e mora no
    `CLAUDE.md`, na seção da paleta.
  - **A CAMADA MUDOU NA v1.8.59.** A tira era `z-index: 2`, abaixo das tampas
    grudadas (z 3 e 4), para sumir sob elas. Medido, o efeito real era que
    NENHUMA barra `sticky` escurecia — razão 1,0000 contra 1,1553 no fundo a
    26px dela, nos dois temas —, porque `z-index` é do elemento e não do estado
    "colada". Ela subiu para `z-index: 5`.
  - **Ele só existe quando MENTIRIA ao não existir**: `.tem-acima`/`.tem-abaixo`
    saem de um ouvinte de `scroll` em CAPTURA no `document` e de um
    `MutationObserver` do documento inteiro, coalescidos por quadro. As regras
    de desligar já não repetem `.popup-backdrop--lib.open` — com o seletor
    genérico não há a disputa (1,1,0 contra 1,2,0) que uma vez deixou o véu
    aceso no topo da lista, onde ele mente.

  **E O RECUO DE CIMA DA PLACA ESCAPAVA (v1.5.17).** Relato: *"os cards que
  ficam no topo das listas … estão se sobrepondo de forma errada ao espaço em
  que deveriam ficar, ficando para cima do correto, sem margem no topo"*.
  **COLAPSO DE MARGEM:** o `.coll-open` não tem `padding-top` nem borda de cima,
  então a `margin-top` de `.4rem` do primeiro filho — o destaque do sábado, o
  índice de temas ou a própria lista — é ADJACENTE à dele e sai para FORA.
  Enquanto a placa era transparente ninguém via; a v1.5.15 deu a ela FUNDO e
  RAIO, e o recuo passou a cair fora: MEDIDO, o primeiro filho começava a
  **0,00px** do topo da placa (contra os 6,39px da placa irmã dos Favoritos),
  cobrindo por inteiro os cantos arredondados.
  - **`display: flow-root` e não `padding-top`.** Um recuo declarado ali impede
    o colapso e ainda SOMA à margem do filho (5,6 + 6,4 = 12px); e zerar a
    margem dos três filhos mudaria o vão ENTRE eles. O BFC não inventa número
    nenhum — mantém dentro o `.4rem` que o filho já pede, e dá 6,39px, o MESMO
    inset da placa irmã.
  - **Ele já era o desenho certo por 220ms:** `expandAccordion` escreve
    `overflow: hidden`, que É um BFC. De quebra o acordeão passa a medir a
    altura de verdade — `offsetHeight` era lido ANTES do `overflow`, e a
    animação levava a 321px uma caixa que dentro do BFC pede 327.
  - **E o salto do índice mira ABAIXO da tampa** (`.hino-secao { scroll-margin-top:
    var(--bar-secao-h) }`): `scrollIntoView({block:'start'})` mira o topo do
    SCROLLPORT, e o scrollport começa debaixo da tampa grudada — MEDIDO, o
    cabeçalho pousava em 0,39px com a tampa ocupando até 45,19, isto é,
    desaparecia inteiro. `scroll-margin-top` **não é `padding`** e não cria
    scrollport nenhum: o `padding-top` do scroller continua ZERO.

  **E A COLETÂNEA A MENOS É UMA REGRA, não uma linha apagada do catálogo**
  (`controle/coletanea.js`, PURA, com oráculo Node). Pedido do operador: *"os
  albuns do celebra SP, serão individualmente colocados na coleção de
  'diversos'. Não identifiquei independência suficiente para que ele tenha uma
  coleção só para ele."*
  - **DISSOLVER, não remover.** MEDIDO: descartar a categoria deixa os álbuns
    ÓRFÃOS, e o `controle.js` os recolhe em "Outros álbuns" — dez blocos de
    novo, com um nome pior. A regra FUNDE: ela move os álbuns para o destino e
    só então a origem deixa de existir.
  - **Roda no DESENHO, nunca no `fetchAlbumCatalog`.** O catálogo fica no
    IndexedDB por semanas; aplicada na busca, uma correção por OTA só valeria
    depois da próxima sincronização com rede. Aplicada no render, ela vale na
    próxima abertura, inclusive offline. E precisa ser aplicada nos DOIS
    consumidores — o laço das categorias **e** o `claimed` dos órfãos: chamar só
    num deles devolve "Outros álbuns" pela porta dos fundos.
  - **Destino ausente é IDENTIDADE, e a origem FICA na tela.** É a única regra
    do arquivo que decide contra o pedido, e de propósito: um destino renomeado
    no banco faria a origem sumir com os álbuns dentro, e o desfecho seguro é o
    de antes da regra.
  - **A tabela aceita "Diversas" E "Diversos".** O operador escreveu *"diversos"*
    e a seção no aparelho chama-se **"Diversas"** (conferido em
    `site/telas/biblioteca.webp`); nenhuma normalização une as duas, então as
    duas grafias entram na lista de aceitos — a comparação é por IGUALDADE sobre
    o `normalizar` do `serie.js`, nunca `includes`, que casaria "Diversas" com
    "Diversas Antigas".
  - **O Registro tem o bloco** (`blocoColetaneas`), com o motivo de cada
    movimento: uma coletânea que some da tela sem explicação é indistinguível de
    um catálogo que veio menor.
- **A ESCADA TEM TRÊS DEGRAUS, E O QUARTO É O ESPAÇO.** Um quarto tom levaria o
  nível mais interno a ~`#4c5865` no escuro, onde `--muted` mede 3,59:1 e
  `--accent` 3,37:1 — os dois reprovam AA para texto pequeno, que é o tamanho do
  texto de uma linha de lista. Quem carrega o quarto nível é o ESPAÇO: uma faixa
  dentro de um álbum não tem caixa própria.
  **E ONDE A ÁRVORE É MAIS FUNDA QUE TRÊS, NÃO SE ACRESCENTA DEGRAU: ALTERNA-SE**
  (v1.5.14, a Biblioteca). O limite acima é real e não tem conserto por ajuste
  fino — a saída é não empilhar.
  **MAS O ESPAÇO SOZINHO NÃO SEPARA IRMÃS, e desde a v1.5.14 isso é medível.**
  Enquanto a faixa teve fundo próprio, o que aparecia no vão era o tom do álbum,
  e o vão era um degrau; com a faixa transparente ele passou a ser a MESMA placa
  dos dois lados — **1,00:1**, separação nenhuma. Daí o QUARTO DEGRAU ser hoje
  espaço **mais** um traço recuado (`--divisoria`, v1.5.16, a quarta exceção
  nomeada da regra de contorno). A alternância separa NÍVEIS; ela não tem como
  separar VIZINHAS do mesmo nível, e nenhum ajuste de tom nela resolveria isso.
  **E O TRAÇO PRECISA FICAR NO MEIO DO VÃO** (v1.5.17). Ele mora em `top: 0` da
  faixa DE BAIXO — `.lib-item` é `overflow: hidden` e um traço desenhado no
  `gap` é RECORTADO —, então com o vão inteiro fora da caixa ele pousava no
  limite INFERIOR: MEDIDO, 6,42px de branco acima e 1,37px abaixo, que foi o
  relato. **Não se move o traço, move-se a CAIXA:** metade do `gap` entra como
  `padding-top` e um `margin-top` negativo da mesma medida devolve o conteúdo ao
  lugar (`N·(h+2) + (N−1)·4 − 2N` é `N·h + (N−1)·4` para qualquer N — a lista
  não muda de altura e o passo entre faixas não muda). A caixa vai de 42,78 a
  44,78px, ainda abaixo da barra do álbum que a contém.
- **No tema CLARO a escada NÃO é monotônica**, e isso é aritmética: a página é
  cinza e o nível 1 é branco (convenção de toda UI clara), então o primeiro
  degrau sobe e os seguintes só podem descer. Folha e card ficam a 1,09:1 e isso
  não se lê como ambiguidade porque **nunca se encostam** (entre eles há sempre o
  poço da seção). O oráculo mede pares **ADJACENTES** e exige só que
  nenhum par coincida — a primeira versão exigia monotonia e reprovava um desenho
  correto.
- **O TOM DE UM BLOCO É DECISÃO DO PAI** (`--camada`): o mesmo componente ocupa
  níveis diferentes conforme a tela (uma `.lib-item` está sobre `--bg` na tela
  principal e sobre `--panel` dentro de uma folha). `--camada` tem um significado
  só: *o tom que um bloco filho DESTE contêiner deve vestir*. **Quem a declara é
  o contêiner, nunca quem pinta** — uma propriedade escrita no próprio elemento
  vence na hora de ELE resolver `var(--camada)`, e o bloco passaria a vestir o
  tom que reservou para os filhos.
- **Nunca escrever branco literal.** Nenhum `#fff` como valor de cor em
  `controle.css`/`display.css` — o branco pleno era a maior fonte isolada de luz
  emitida do app, e o off-white (`--text`) é o que se usa. **Duas exceções, as
  duas declaradas em `tokens.css`:** o palco (`--stage-text: #fff`, porque num
  telão a legibilidade vem de luminância máxima) e o campo da folha da playlist
  automática (`--field-bg` — pequeno, só existe com a folha aberta, escolha
  explícita de quem opera; num salão escuro é o retângulo mais luminoso da
  tela). No tema CLARO o `--panel` é branco pleno e a regra não se aplica pelo
  motivo dela.
  **E o campo da BARRA DE BUSCA é a terceira** — ele saiu da lista na v1.5.2 e
  VOLTOU na v1.5.5, a pedido do operador, agora com a borda que o torna possível
  no tema claro. O preço da v1.5.2 continua dito e continua sendo pago: ao
  contrário do campo do sorteio, este fica à vista o culto inteiro na base do
  app. **O que muda a conta é a BORDA:** com ela o branco deixa de ser a única
  coisa que separa o campo da barra, então a escolha passou a ser sobre o que se
  quer ver, não sobre o que é legível. As três cores de dentro voltam aos
  `--field-*` junto com o fundo — ver a regra logo abaixo.
- **Uma superfície sem tema arrasta o que vive DENTRO dela** — a regra do palco
  num lugar novo. `--field-bg` vem com `--field-text`, `--field-muted` **e
  `--field-accent`**, no bloco compartilhado: no tema escuro `--text` sobre
  branco dá **1,17:1** e `--accent` dá **2,06:1** (ele é o azul CLARO desenhado
  para o fundo quase-preto do app). Trocar só o fundo apaga o que se digita, e é
  o meio-conserto que o `smoke.mjs` reprova. O terceiro token nasceu quando um
  botão de AÇÃO passou a morar sobre o campo — cada consumidor novo da superfície
  refaz a pergunta, e o nome `--field-*` é o que impede a resposta errada.

### O que vive FORA do CSS e tem de andar junto

- **`res/values/colors.xml` espelha `--bg` à mão, em DOIS valores** (`app_bg`,
  `app_bg_claro`): é o fundo das barras e o `windowBackground` (o que aparece
  ANTES de o WebView carregar). Nada no build detecta divergência, e o OTA troca
  a base sem trocar o APK — mudou o token, muda aqui. **É o único lugar fora de
  `tokens.css` que carrega cor de fundo, e não tem escapatória:** recurso de
  Android não enxerga custom property. Quem escolhe entre os dois é a
  `MainActivity` em runtime (`temaClaro` → `setTemaClaro`), a partir de uma CÓPIA
  guardada em `SharedPreferences` — XML é resolvido antes de existir JavaScript,
  então o primeiro quadro só pode vir de preferência guardada. **Preço: trocar de
  tema tem um lançamento de atraso no fundo do splash, e só nele.** A mesma
  chamada vira `APPEARANCE_LIGHT_STATUS_BARS`, que o Android 15+ **não** ignora
  (ele ignora as CORES das barras, não a aparência dos ícones) — sem ela o tema
  claro fica com relógio e botões brancos sobre branco.
- **O `theme-color` do `<meta>` NÃO é um segundo lugar:** `pintarTema()` o LÊ do
  `--bg` já resolvido (a folha entra no `<head>` e o script no fim do `<body>`),
  e o literal do HTML cobre só o instante anterior a esse script.
- **O ÍCONE DO APP é a paleta** — a mesa de som DE PÉ: três trilhas verticais em
  `--text` e três cabos de fader em `--accent` (retângulos arredondados, a forma
  do cabo real) sobre `--bg`. Ele **não segue o tema claro**, e não tem
  como: é desenhado pela gaveta do sistema com o app fechado. É **VETOR**
  (`res/drawable/ic_launcher_foreground.xml`) porque com `minSdk` 26 o adaptativo
  é o único ícone que chega a ser desenhado — PNGs por densidade eram peso morto
  e mais lugares para a cor divergir. A camada `monochrome` (ícone temático do
  Android 13+) tem vetor próprio: apontada para o PNG de primeiro plano, que tem
  fundo opaco, ela vira um quadrado cheio.

### O que o CI trava, e o que ele NÃO trava

**Não há teste de contraste ABSOLUTO.** Os números nos comentários de
`tokens.css` são medições à mão, e os pares abaixo do piso estão declarados como
tais ali mesmo. **Ao mexer num token, meça — e são DOIS temas.**

O CI trava outra coisa: `tokens.test.mjs` (todo `var(--x)` sem fallback aponta
para token que EXISTE; nenhum token só no claro; nenhum contorno; **nenhuma
superfície de controle é tinta com alfa**; **todo bloco que pinta `--panel`
afunda a superfície dos filhos** — as duas últimas provadas por REVERSÃO) e
`smoke.mjs` (o efeito RENDERIZADO nos dois temas, o palco que não os segue, a
escolha que sobrevive à recarga, a ESCADA DE CAMADAS medindo o degrau ENTRE
níveis — a única parte do contraste que tem oráculo — e a resposta ao
toque, que num BLOCO é a LUZ e nunca a geometria — v1.7.2).

---
