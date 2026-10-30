<!-- Parte do capítulo do Controle (o índice das partes está em CONTROLE.md;
     o mapa geral, em docs/ARQUITETURA-WEB.md). Partida do CONTROLE.md na
     revisão A3 (2026-10-30): o texto foi MOVIDO verbatim. -->

## Controle — o layout geral e o transporte

> Parte do capítulo do Controle — o índice das partes e as regras que valem
> para o Controle inteiro estão em [`CONTROLE.md`](CONTROLE.md).

**Nesta parte:** [Layout geral](#layout-geral) · [Um par de botões, dois eixos — e onde ele ainda vale](#um-par-de-botões-dois-eixos--e-onde-ele-ainda-vale) · [Os dois botões de slide](#os-dois-botões-de-slide) · [Onde o Display roda](#onde-o-display-roda)


### Layout geral

```
┌─────────────────────────────────────────────────────────┐
│                    CRONOGRAMA                    [Cfg]  │ ← .list-header (topo; sem appbar)
│  ┌───────────────────────────────────────────────────┐  │
│  │  item 1                                           │  │  ← .lib-list
│  │  item 2                                           │  │     (área scrollável)
│  └───────────────────────────────────────────────────┘  │
│  [  📖 Bíblia  ]  [  ⠿ Ferramentas  ]                    │ ← #listFoot (fixo, não rola)
│   ↑ na seleção múltipla, a #selbar ocupa esta mesma fatia │
│   ↑ Ferramentas abre a FOLHA, que sobe cobrindo a .lib-list│
│     e o #listFoot — e só eles; na LISTA ela tem a largura │
│     da porta (v1.13.5)                                    │
├─────────────────────────────────────────────────────────┤
│ [Cronograma] [Bíblia] [🔍]                              │  ← .tabs (dentro da barra)
│  ┌─────────────────────────────────────┬──────┐         │  ← .bottombar (base fixa)
│  │  Nome da mídia atual  [seek bar]    │ Hist │         │
│  │─────────────────────────────────────│ Wall │         │
│  │    Preview (proporção do telão)     │ Letra│         │
│  │─────────────────────────────────────│ Mudo │         │
│  │  🔁  ⏮  ▶/⏸  ⏹  ⏭  [Playlist]    │ Vol  │         │
│  └─────────────────────────────────────┴──────┘         │
│  [margem segura para navegação por gestos]              │
└─────────────────────────────────────────────────────────┘
```
**Sem barra de topo (`.appbar`):** o app começa no cabeçalho da lista, e `main`
ganhou `padding-top` com `env(safe-area-inset-top)`.

**Cabeçalho da lista (`.list-header`):** o `#listTitle` centrado, o
`#settingsBtn` à direita e, só na navegação da Bíblia, o `#backBtn` à esquerda. A
faixa já teve SEIS elementos, e o sintoma de estar disputada era objetivo: numa
tela de 360px a raiz dos Favoritos cortava o próprio título com reticências.

**O RESPIRO DELA É PARTIDO EM DOIS** (v1.8.80). Relato do operador: *"a margem
abaixo dos botões de configurações e de limpar cronograma está muito rasa em
relação a margem superior… todos os itens dessa barra estão descentralizados
para baixo"*. MEDIDO: o `padding-bottom` era **zero**, e a linha de `--hit`
encostava na fronteira — 9,59px de vão acima e 0 abaixo a 430×900; 12,47 e 0 a
360×640 com a fonte do sistema em 1,3×. O `--sp-5` que era todo de cima virou
metade em cada lado, e a CAIXA não muda um pixel: crescer a barra para
simetrizá-la custaria altura de LISTA, que é o conteúdo desta tela. O
`env(safe-area-inset-top)` não é partido — ele é o recorte do sistema, e mora
inteiro do lado em que o recorte está. Oráculo:
`barra-do-topo-e-titulos.test.mjs`.

**A ENGRENAGEM SUBIU PARA CÁ NA v1.2.0** (pedido do operador: *"jogue o botão de
configurações no modo avançado para o topo da tela, na mesma posição que ele já
ocupa no modo fácil"*). Ela morava na fatia de cima da coluna da direita, encostada
na BASE — o canto oposto ao do gêmeo do Modo Fácil —, e trocar de modo trocava o
canto em que a mesma porta se abre. Agora é o mesmo gesto nos dois: canto
superior direito, mesma caixa (`--hit`), mesma cor (`--accent`, a do `#backBtn`
em frente — a regra do app é que navegação/acesso é chapado e em accent).

O lugar já estava reservado: esta é a trilha 3, aberta pela v5.309 como um VÃO só
para o título não sair do eixo, e que previa este dia por escrito. O que ficou
vago virou o `#historyBtn` — que na v1.3.8 desceu para a linha do transporte,
liberando a barra de progresso, e na **v1.4.31** saiu de lá para dentro de
Configurações (ver "O histórico do culto"). Quem herdou a sétima célula foi o
**auxiliar de leitura**, que morava sobre a preview.

O título é `.84rem` (em .72rem o único texto que responde "onde eu estou" era
menor que o subtítulo de qualquer linha).

**A FAIXA É UMA GRADE DE TRILHAS FIXAS NOS DOIS EIXOS** (v5.309 · v5.310) —
`--hit`, `minmax(0,1fr)` e `--hit` nas colunas, `--hit` na linha, com as três
posições declaradas uma a uma. Como flex ela centrava o título no espaço que
SOBRAVA, e o voltar entra e sai do fluxo conforme a tela da Bíblia: o nome da
tela pulava ~19px para a direita toda vez que o operador entrava num livro.

**A REGRA É UMA SÓ NOS DOIS EIXOS: a caixa da faixa não pode depender de quem
está dentro dela.** Numa grade a trilha do voltar continua reservada quando ele
está `hidden`, porque quem ocupa uma trilha é a POSIÇÃO EXPLÍCITA e um item
`display: none` não desloca ninguém — então o `[hidden] { display: none
!important }` do topo da folha segue valendo inteiro.

- **As COLUNAS** (v5.309). A trilha 3 existe porque reservar só a do voltar
  deixaria o título fora do eixo da faixa em toda a interface: trocaria um
  deslocamento por um desalinhamento. Com auto-placement o ocupante dela cairia
  na coluna 1 justamente nas telas sem voltar — o defeito de volta, com outro
  nome. Ela nasceu como o vão vazio `.list-head-vao` e desde a v1.2.0 é a casa da
  ENGRENAGEM; a trilha não mudou de tamanho, porque o botão é `--hit`, que é a
  medida que ela sempre teve.
- **A LINHA** (v5.310). Sem `grid-template-rows` a altura é IMPLÍCITA, isto é, a
  do item mais alto: 15px com só o texto e os 34px de `--hit` quando o voltar
  entra. MEDIDO: o título descia 9px e **a lista inteira descia 19px**, que é o
  pulo que se vê. Reservar `--hit` custa esses 19px de lista nas telas sem
  voltar e é o preço certo — encolher o botão para a altura do texto devolveria
  ao voltar o menor alvo de toque do app, que é o que o esqueleto de `--hit`
  existe para impedir.

O `min-width: 0` do título e o `minmax(0,1fr)` da trilha são as duas metades da
mesma defesa contra o nome comprido de uma pasta. Medido em `tools/smoke.mjs`
("O NOME DA TELA NÃO SE MEXE"), **nos dois eixos**: a v5.309 reservou só as
colunas e afirmou só o `x`, e o defeito voltou pelo eixo que o oráculo não media.

**Controles (`.bottombar`):** fixados na base, e eles **começam na faixa de
abas** — a barra é um `flex` em coluna com dois filhos, a `.tabs` e o `.deck`.
Antes a faixa flutuava sobre o fundo do app, separada por dois espaços e um
degrau de cor: duas superfícies para duas coisas que o polegar usa no mesmo
movimento. Ela **não tem `border-top` nem sombra**: com a fileira encostada no
topo, as duas cairiam sobre a emenda entre a aba ativa e o conteúdo, que é onde
os dois precisam ser a mesma superfície. O `padding-bottom` usa
`max(env(safe-area-inset-bottom), 12px)`, contra acionamento acidental pela
navegação por gestos.

**Grade real (CSS Grid), não flex aproximado:** `.deck` é um `grid` de **3
colunas** (`var(--deck-col)` / `minmax(0, 1fr)` / `var(--deck-col)`) × 3 linhas
(todas `auto`), com **sete itens DIRETOS** e nenhuma grade aninhada:
`.nowplaying` (atravessa as três), `.slide-side`, `.preview-row`,
`.slide-side--dir`, `.transport` (atravessa as duas primeiras) e `#historyBtn`.
Desde a v1.3.8 não há `subgrid`: cada botão da coluna da direita cai na faixa do
vizinho da esquerda por estar na MESMA linha da grade, não por um alinhamento
calculado à parte.

**A terceira coluna nasceu na v1.3.5**, quando a preview passou a ser
FLANQUEADA pelos dois botões de slide (ver "Um par de botões, dois eixos"). Ela
tem a mesma largura da direita porque os dois botões precisam ser **gêmeos** —
um par que não tem a mesma caixa não se lê como par. O `.transport` atravessa a
coluna da esquerda (`grid-column: 1 / 3`), senão sobraria um vão lateral onde
não há botão nenhum; a `.nowplaying` atravessa as TRÊS desde a v1.3.8, e é isso
que põe os tempos sobre os botões de slide.

A coluna do meio é `minmax(0, 1fr)`, **não** `1fr`: uma faixa `1fr` tem mínimo
automático igual ao min-content, e o título (`#npName`, `white-space: nowrap`)
tem min-content do texto INTEIRO mesmo já cortado por ellipsis — um nome longo
inflava a coluna, esmagava a lateral e fazia a largura da preview depender do
título.

As duas `.slide-side` **não precisam de máquina nenhuma**: o único filho de cada
uma é o botão, e ele não tem como inflar a faixa acima da preview.

#### Um vão só, sete células iguais e a faixa que É a preview (v1.3.7)

**Três medidas de vão viraram uma** (`--deck-gap`, `.35rem`): entre as colunas
eram `.6rem`, entre as linhas `.45rem` e no transporte `.35rem`, mais um
`padding: 0 .35rem` dentro das colunas laterais. O que o olho lia era o botão do
volume "com margem diferente" — MEDIDO, 15,2px até o vizinho contra os 5,6px que
os outros seis usavam entre si.

**A coluna lateral vale `(100% - 6 vãos) / 7`**, e isso não é aproximação: é a
largura que faz as SETE células da linha de baixo (os seis do transporte mais o
volume) saírem idênticas, e ela se demonstra. O transporte atravessa as colunas
1-2, isto é `W - col - vão`; seis botões com cinco vãos dão
`(W - col - 6·vão)/6`, e substituindo `col = (W - 6·vão)/7` isso volta a ser
`col`. Com 56px fixos os do transporte mediam 52,3 e o do volume 44,8.

**A faixa da preview é `auto`, e a preview PREENCHE a coluna.** Ela era fixa em
150px enquanto a miniatura dentro dela era dimensionada pela proporção do
telão — as duas quase nunca coincidiam, e sobrava vazio num eixo ou no outro.
MEDIDO em 430px: com uma TV 2,16:1 a preview dava 128px numa faixa de 150 (11px
em cima e embaixo); com uma 16:9 dava 267px de largura numa coluna de 289 (11px
de cada lado). Na tela isso vira um vão de 18px em volta da preview onde todos
os outros medem 5,6.

- **Não há realimentação**: a largura da coluna não depende da faixa, e a altura
  da preview não depende da faixa — ela sai da largura e da proporção. Por isso
  a faixa pode ser `auto` sem ciclo, e **sem medir nada em JavaScript** (a
  v1.3.6 media com um `ResizeObserver`; a v1.3.7 tirou a medição do caminho).
- **Não há teto de altura, de propósito.** Um `max-height` que mordesse
  clamparia a altura sem clampar a largura — a caixa preta sairia mais larga que
  a proporção, que é precisamente a mentira que a proporção existe para
  impedir. O preço é a preview crescer com a coluna: MEDIDO em 430px, 135px numa
  TV 2,16:1 e 163px numa 16:9. `--pv-ar` vem de um display de verdade e o padrão
  do CSS é 16/9, então esse é o pior caso real.
- **`flex: 1` e não `height: 100%`** nos dois botões de slide: uma porcentagem
  contra uma faixa `auto` é indefinida enquanto a própria faixa está sendo
  dimensionada, e o botão sairia com a altura do ícone.

#### A coluna da direita: dois botões soltos (v1.3.8)

Aqui morava o `#mixer`, um `subgrid` de três fatias com os botões dentro de um
`.mixer-stack` **absoluto**. Toda essa máquina existia por UMA razão: o fader de
volume atravessava duas linhas, e um item no fluxo de um subgrid contribuiria
para as faixas do PAI — era essa contribuição que deformava o deck ao abrir o
volume.

**Sem o fader não há o que atravessar.** Sobraram dois botões, cada um numa
linha, e eles são itens diretos da grade do deck como todos os outros:

| item | coluna | linha |
|---|---|---|
| `#slideNextBtn` (`.slide-side--dir`) | 3 | 2 (a faixa da preview) |
| `.fader-wrap` (só enquanto aceso) | 3 | 2 — a MESMA célula, e é por isso que um esconde o outro |
| `#historyBtn` | 3 | 3 (a faixa do transporte) |

Saíram com o subgrid: `.mixer`, `.mixer-slot`, `.mixer-stack`,
`.mixer-top/mid/bottom`, `.vol-btn` e `.vol-close`. O FADER ficou (v1.3.9) e é
item da grade como os outros; o que sobrou dos estados é `vol-open`/`vol-closing`
no `.deck`.

**O `#historyBtn` mudou de fatia**, da de cima para a que era do botão de
volume. A linha de baixo tem sete células iguais e a sétima ficou vaga — e era
ele, na fatia de cima, que impedia a barra de progresso de usar a largura
inteira do deck (ver "A barra de progresso segue a grade", abaixo).

**E ele veste a mesma caixa dos vizinhos** (`.t-btn`, v1.3.9, a pedido do
operador). Era CHAPADO (`.settings-btn`) enquanto morava numa fatia só dele,
onde a distinção "abre uma lista" × "opera o culto" separava dois grupos. Na
linha de baixo ele é uma de sete células iguais, ao lado da **playlist** — que
também só abre uma lista e sempre teve fundo. Um único chapado numa fileira de
seis com fundo não se lê como distinção: lê-se como um botão que ficou de fora.

**A ORDEM da linha** (v1.3.9 → v1.5.6, pedida nas duas vezes): repetir →
playlist → anterior → play → **próximo → parar** → a sétima célula. Os dois que
ABREM uma folha ficam nas pontas do grupo, e o miolo é o transporte contínuo.

**O PARAR SAIU DE DENTRO DO TRIO** (v1.5.6): *"coloque o stop após o 'próxima
música'"*. Ele estava entre o ▶ e o ⏭, isto é, no meio da navegação — o dedo que
vai do play para a próxima passa por cima do único botão da fileira que ENCERRA a
cena, e num culto isso é a projeção caindo por um alvo de 53px errado. Fora do
trio, ⏮ ▶ ⏭ ficam contíguos e o parar é o fim da linha, que é onde uma ação de
encerramento se lê. Oráculo: `controles-layout.test.mjs`, que trava a ordem
inteira.

**A SÉTIMA CÉLULA TROCOU DE OCUPANTE na v1.4.31**, e a regra que a governa não
mudou: quem ocupa a ponta é o que abre uma folha, não o que opera a cena. Era o
**histórico** (que foi para Configurações); hoje é o **auxiliar de leitura**,
vindo da coluna sobre a preview. O motivo é o mesmo dos dois lados — a coluna da
preview passou a ser só o que muda o que a congregação vê e ouve (cortina e
mudo), e o que abre uma leitura no celular desceu para a fileira das folhas.

#### O fader ficou; o BOTÃO que o abria é que saiu (v1.3.8 → v1.3.9)

Pedido do operador, e a distinção é o recurso inteiro — ela já foi entendida ao
contrário uma vez: *"eu não queria que removesse o sistema de slide de volume
interno do nosso app, pois ele é o que impede alguns controles de volume de
aparecer no display. o que eu queria era apenas remover o método usando o botão
na tela para acessar o slide de volume […] mas ainda manter a função do slide
aparecer e ser controlado pelas teclas físicas do volume."*

- **O QUE SAIU** (v1.3.8): `#volToggle` e `#volClose`, o botão de tela que abria
  e fechava o fader, mais `cancelVolPeek`/`bumpVolPeek` — a máquina do caso
  "aberto na mão", que deixou de existir.
- **O QUE FICOU**: o fader (`.fader-wrap`, `#volSlider`, `#volValue`,
  `syncFader`), a interceptação das teclas físicas e o `peekVolume` que as
  acende. **A tecla é a ÚNICA porta, e o relógio dela a única saída** (2,8 s).
- **POR QUE O APP CONSOME A TECLA**, que é o ponto: quem não consome deixa o
  Android desenhar o painel de volume dele, e com espelhamento ativo esse painel
  aparece **sobre a projeção**, na frente da congregação. Este fader é o que o
  substitui — mora no celular, some sozinho, e nada disso chega ao telão.
- **O número não é o volume do aparelho:** `applyVolume` e o comando `volume`
  viajam para as **telas da rede**, que são outros aparelhos, e o volume de
  mídia do celular não as alcança.
- **E o de VOLTAR slide NÃO some mais.** O fader ocupa a célula do
  `#slideNextBtn` (coluna 3, a faixa da preview) e só o esconde; uma regra
  (`.deck.vol-open .slide-side`) escondia o da outra ponta junto, "para não
  deixar meia dupla no ar". Foi esse sumiço que o operador relatou, e ela **não
  voltou** com o fader.

#### A barra de progresso segue a grade do deck (v1.3.8)

`.nowplaying` atravessa as **três** colunas (`grid-column: 1 / 4`), e `.np-seek`
é uma grade com as MESMAS colunas e o MESMO vão:

| peça | cai sobre |
|---|---|
| `#curTime` | o botão de voltar slide |
| `#seek` | a preview |
| `#durTime` | o botão de passar slide |

Ela parava na coluna 2 porque a 3 era da sétima célula: a barra não batia com a
miniatura logo abaixo, e o título nascia descentrado — centrado numa caixa que
não era a do deck. Era um `flex` com `gap: .5rem` e `min-width: 32px` nos
tempos, números que não vinham de lugar nenhum.

**`--deck-col` é herdado do `.deck`**, então esta grade não repete a conta: se a
largura da coluna lateral mudar, os tempos acompanham no mesmo lote.

**O TÍTULO é o único que ignora as colunas**: `text-align: center` na largura
inteira, que é onde o olho o procura.

#### E ela é um CARTÃO (v1.5.13)

*"coloque a seção da barra de progresso da mídia, que tem o título, barra de
progresso e tempo atual e total… coloque isso tudo dentro de um card, pois é o
único elemento visual do controle que não está dentro de um elemento visual. por
causa da barra de buscas, ali se tornou um buraco no design"*.

O diagnóstico é exato, e o **"por causa da barra de buscas"** é a parte que
explica por que isto virou defeito agora: até a v1.5.2 o topo da caixa de
controles era a faixa de abas, e o título nascia logo abaixo de uma peça
pintada. Com a barra da Biblioteca repousando ali — e ela não pinta nada
fechada —, o que ficou acima do título passou a ser o próprio `--bar`, e a linha
do tempo virou a única peça da caixa pousada direto no fundo: preview, botões de
slide e transporte todos têm superfície.

- **O tom é `--surface`, o MESMO dos botões ao lado, e não `--panel`.** No tema
  CLARO `--bar` é branco e `--panel` também: um cartão em `--panel` mediria
  1,00:1 contra a caixa e não existiria — a mesma aritmética que obrigou a borda
  do campo de busca na v1.5.5. Com o tom dos vizinhos o cartão entra no sistema
  da caixa em vez de inaugurar um degrau.
- **O RECUO É SÓ VERTICAL, e isso é invariante.** Um `padding` horizontal aqui
  comprime a grade do `.np-seek` e a barra deixa de bater com a miniatura logo
  abaixo — o defeito exato que esta seção descreve. O respiro lateral já existe
  por construção: os tempos são centrados em colunas de `--deck-col` (~56px),
  então o texto nasce a meia coluna da borda. Quem PODE recuar é o título, que é
  o único que ignora as colunas — e ele precisa, senão a reticência de um nome
  longo encosta na borda.
- **O `controles-layout.test.mjs` trava as três metades**, e a terceira existe
  para dar a CAUSA: sem ela, um recuo horizontal reprova nas três asserções de
  coluna acima, que falam de alinhamento e não do que o produziu.


**A linha da preview é só a preview**, e a partir da v1.3.5 ela é FLANQUEADA de
novo — mas por fora, em colunas da grade, e não dentro da linha. Desde a v1.3.7
a preview PREENCHE a coluna do meio e a altura dela sai da proporção do telão
(ver "Um vão só…", acima). O botão de **repetir** (`#repeat`) é o primeiro de
`.transport`, com o de playlist por último.

### Um par de botões, dois eixos — e onde ele ainda vale

Até a v5.48 a tela tinha **quatro** botões para duas ações vizinhas: estrofe
(flanqueando a preview) e mídia (no transporte). Quatro alvos disputando a mesma
faixa estreita — e os de estrofe passavam a maior parte do culto **desabilitados**,
porque sem letra, versículo ou mensagem no ar eles não fazem nada.

A v5.49 respondeu com **um par só**, com os eixos separados pelo TEMPO do toque
(`attachTransportStep`):

| Toque | O que faz |
|---|---|
| **curto** | o eixo da CENA: passa estrofe quando há estrofe a passar (letra, versículo ou mensagem no ar); passa de mídia quando não há |
| **longo** (`LONGPRESS`, 450 ms) | **sempre** mídia — a saída para trocar de música com uma letra em cena |

**ISSO NÃO VALE MAIS PARA O TRANSPORTE (v1.3.5).** Lá o par voltou a ter um
significado só — **mídia** anterior/próxima —, porque a preview passou a ser
flanqueada por dois botões de slide de **altura inteira**: um eixo escondido
atrás do tempo do toque não se justifica quando o outro tem botão próprio a dois
centímetros dali. `#prev`/`#next` recebem um `click` direto para `step(dir)`, e
saíram com eles as duas classes que anunciavam o eixo (`.slide-mode` e o
`.axis-end` que esmaecia no fim da letra).

O par de eixos continua vivo nas **duas superfícies em que não há botão de slide
nenhum**, e nas duas `attachTransportStep` segue sendo o mecanismo:

| Superfície | Por que o par continua lá |
|---|---|
| **tela cheia da prévia** (`#fsPrev`/`#fsNext`, ao lado do ▶/⏸ desde a v1.12.42) | sem TV a preview em tela cheia É a projeção, e tudo o que se pinta ali a congregação vê — não cabe um par a mais |
| **notificação nativa** | o eixo é dito no RÓTULO do botão (`slideMode`/`slideLabel` em `pushNowPlaying`); ali cabe rótulo, então o modo nunca precisa ser adivinhado |

### Os dois botões de slide

| Botão | Onde |
|---|---|
| `#slidePrevBtn` | `.slide-side`, a coluna 1 da grade — à esquerda da preview |
| `#slideNextBtn` | `.slide-side--dir`, a coluna 3 — à direita da preview |

- **São os MESMOS de sempre.** Da v5.49 à v1.3.4 eles estiveram ocultos no DOM
  (`.slide-anchor`), e o que os acionava era o toque curto em ⏮/⏭, o gesto da
  tela cheia e a notificação, todos por `.click()`. Voltaram à tela sem mudar de
  papel: é neles que `applySlideLimits` guarda "dá para passar slide agora?", e
  um botão `disabled` é um no-op natural. A tela cheia e a notificação continuam
  chamando `.click()` neles, sem saber de nada.
- **Quem decide o alvo é `slideTarget()`**, a MESMA função das outras duas
  superfícies. A regra existia em um lugar só e continua assim.
- **O que muda com a cena é o SUBSTANTIVO do rótulo**, não o eixo
  (`renderTransportAxis`): "Próxima estrofe", "Próximo versículo", "Próxima
  mensagem", "Próxima página". Sem alvo eles ficam com o nome genérico
  ("Próximo slide") **e desabilitados** — um nome específico ali prometeria uma
  cena que não está no ar.
  - **As três tabelas de rótulo (`SLIDE_AXIS_NAME`/`_PREV`/`_NEXT`) precisam
    cobrir TODOS os alvos de `slideTarget()`.** Elas são indexadas pelo alvo, e
    um alvo ausente não dá erro: vira `undefined` e o `title` passa a dizer
    literalmente "undefined". Faltavam `deck` (desde a v5.97) e `songlyrics` até
    a v5.102 — justamente o alvo em que eles são o ÚNICO jeito de passar página.
    Alvo novo em `slideTarget()` = três linhas novas aqui.
- **E DESDE A v1.9.4 HÁ DOIS ALVOS QUE NÃO PASSAM NADA: ELES ACIONAM.** Com o
  cronômetro (`'chrono'`) ou o sorteio (`'draw'`) no ar, o par vira o transporte
  DAQUELA ferramenta — esquerdo ZERA, direito INICIA/PAUSA ou SORTEIA —, e o
  desenho troca junto. Eles ficam **fora** das três tabelas de propósito: elas
  devolvem o SUBSTANTIVO de um eixo de navegação, e aqui o par é ASSIMÉTRICO
  (cada botão é uma ação diferente). Quem responde por eles é `EIXO_DE_ACAO`, uma
  tabela de FUNÇÕES — o ▶ vira ⏸ com a contagem correndo, o sortear vira "de
  novo" depois do primeiro.
  - **O QUE ISTO CONSERTA É A CENA VINDA DO CRONOGRAMA.** Ali o rodapé da folha
    de Ferramentas nunca chegou a ser montado, e não havia NENHUM botão na tela
    para iniciar a contagem. As cinco funções-alvo (`chronoStart`, `chronoPause`,
    `chronoReset`, `doDraw`, `drawReset`) não dependem da folha: medido com ela
    fechada, nenhuma lança e cada uma emite o comando ao telão.
  - **O RELÓGIO CONTINUA SEM EIXO** — ele não se pausa nem se zera (o rodapé
    dele traz os dois seletores de formato no lugar do transporte), e um par
    aceso ali é o botão inerte da v1.8.50.
  - **A RÉGUA DO `disabled` É UMA SÓ:** `chronoRunApagado`, `drawGoApagado` e
    `drawResetApagado` respondem ao par E aos quadrados do rodapé. Reescrevê-las
    aqui faria um botão aceso de um lado da tela e apagado do outro para a MESMA
    ação, e divergiria calado no primeiro ajuste.
  - **O DESENHO TROCA PELO NÓ, e a caixa fica com o CSS**
    (`desenharBotaoDeEixo`): `icoSprite()` sem atributo de caixa, ou `msym()` —
    MEDIDO, dentro de um `.ctl-btn` os dois computam 22px e os dois seguem
    `--icon-md`. Ele guarda a marca em `dataset.desenho` e **só repinta quando
    ela muda**: `renderTransportAxis` roda no pulso do `renderSlideNav`, que o
    `timeupdate` da preview dispara a ~4 Hz.
  - **NENHUM MUTADOR REDESENHAVA O EIXO** (medido: zero chamadas de
    `renderSlideNav` em cinco execuções), então o ▶ do par continuaria ▶ depois
    de iniciar. Quem os alcança é `renderEixoDoPar()` — só `applySlideLimits` +
    `renderTransportAxis` — chamado do fim do `renderFoot` (o pulso que
    TODO mutador dos dois já toca) e do `atualizarChronoRun`, porque
    `chronoSetDuration` não passa pelo rodapé (a roleta está sob o dedo).
  - **E O PAR DE AÇÃO É DO PAINEL, E DE MAIS NINGUÉM** (`eixoForaDoPainel`).
    Três superfícies roteavam por *"o eixo é truthy?"*: a coluna da TELA CHEIA
    (`attachTransportStep`), os ⏮/⏭ da NOTIFICAÇÃO (`onRemote`) e o `slideMode`
    que o `pushNowPlaying` publica. Nas duas primeiras **o desenho é OUTRO** — a
    seta com barra, copiada inline no `index.html` —, e deixá-las ver o alvo novo
    faria a tela de bloqueio ZERAR a contagem com "mídia anterior" desenhado na
    frente. Elas continuam no eixo de MÍDIA, que é o que aquele desenho promete.
- **A ALTURA DELES É A DA FAIXA, e a faixa É a preview** (v1.3.7 — ver "Um vão
  só…", acima). Eles nasceram vestindo uma faixa FIXA de 150px enquanto a
  miniatura dentro dela era dimensionada pela proporção do telão: MEDIDO, em
  360px com uma TV 2,17:1, preview de 95px ao lado de botões de 150, com 27px de
  folga em cima e embaixo de cada um. A v1.3.6 corrigiu isso MEDINDO a preview
  num `ResizeObserver`; a v1.3.7 tirou a medição do caminho — sem faixa fixa não
  há o que medir.
  - **OS DOIS LADOS SÃO A MESMA REGRA** desde a v1.3.8, e é isso que os mantém
    gêmeos. Já foram duas: o da direita morava no mixer e caía num
    `.mixer-slot .ctl-btn { flex: 1 }` que empatava em especificidade e vencia
    pela ORDEM do arquivo — MEDIDO, a esquerda vestindo a preview e a direita
    ainda com a faixa inteira, sem nada no console. E `flex: 1` não era
    contornável por `height`: num contêiner de coluna o `flex-basis` É o tamanho
    principal, então a altura declarada sumia em silêncio. Uma regra só não tem
    como empatar consigo mesma.
- **O fim do caminho é o `disabled` de sempre** — o esmaecido que a v5.49 tinha
  trocado pelo `.axis-end`, e que voltou a valer quando o botão passou a ter um
  significado só.
- **O de VOLTAR NÃO SOME MAIS** (v1.3.8). O fader ocupa a célula do
  `#slideNextBtn` e o esconde — os dois dividem aquela caixa —, mas uma regra
  (`.deck.vol-open .slide-side`) escondia o da OUTRA ponta junto, "para não
  deixar meia dupla no ar". Foi esse sumiço que o operador relatou, e a regra
  saiu. Ela **não voltou** quando o fader ficou (v1.3.9): o oráculo acende o
  fader por `peekVolume` e afirma que o botão de VOLTAR continua no ar.

Oráculo: **`tools/controles-layout.test.mjs`** — a geometria (quem flanqueia
quem, e com que caixa), o eixo do transporte medido pelo COMANDO que sai no
barramento (`seek` é estrofe andando, e ele não pode mais sair de `#next`) e o
par sumindo junto com o fader. Provado por reversão. O par de AÇÃO tem oráculo
PRÓPRIO — **`tools/eixo-de-acao.test.mjs`** —, e ele mede pelo COMANDO que sai no
barramento, nunca pela classe ou pelo `title`: o modo de falhar de uma
implementação incompleta é MUDO (o ramo genérico de `stepSlide` e de
`applySlideLimits` engole um alvo desconhecido sem lançar, e o que se vê é o par
apagado e inerte).

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

**Controles sobre a preview** (`.pv-fabs`, `setupPreviewGestures`): **quatro
grupos**, todos só-ícone, sem moldura, com a mesma `drop-shadow` tripla no traço
(ver "Layout de player", abaixo). Cada botão ocupa uma caixa de `--hit`, e o
tamanho do ícone vem do CSS (`24px`), não do atributo do `<svg>`.

| Grupo | Onde | O quê | Pergunta que ele responde |
|---|---|---|---|
| `.pv-fabs` | coluna DIREITA | cast em cima, tela cheia embaixo | *para onde eu mando isto?* |
| `.pv-fabs--esq` | coluna ESQUERDA (v1.3.5) | letra → cortina → mudo | *como eu opero a cena?* |
| `.pv-fabs--base` | BASE, ao centro (v1.3.10) | o que está FORA DO PADRÃO agora: o selo de camadas (`#pvCamadaBtn`) e o desfazer do giro (`#pvGiroBtn`) | *o que eu desfaço daqui?* |
| `.pv-fabs--topo` | TOPO, ao centro (v1.11.7) | a seta que recolhe e expande a prévia (`#pvRecolherBtn`) | *quanto de tela a prévia ocupa?* |

> O selo já morou no canto superior esquerdo, e no topo ao centro (v1.3.5).
> Desceu para a base a pedido do operador. Em qualquer das três posições a regra
> é a mesma: **ele não faz coluna com ninguém** — a faixa horizontal que ocupa
> existe só para centrá-lo, e é isso que o separa dos três da esquerda (os três
> OPERAM a cena; este DIZ um estado dela).

##### A base é a REGIÃO DO QUE ESTÁ FORA DO PADRÃO (v1.4.43)

Pedido do operador: *"essa região inferior no centro da preview vai ser uma
região flexível que vai conter elementos passageiros"*.

**A regra de admissão é uma:** entra aqui o que **saiu do padrão AGORA e o toque
desfaz**. É o contrário de uma barra de ferramentas — as três laterais OPERAM a
cena e estão sempre lá; estas aparecem porque há o que desfazer e somem quando
não há. Daí `justify-content: center` e não uma coluna: a faixa é uma FILA de
zero, um ou dois itens, e o centro é o único alinhamento que não promete lugar
fixo a ninguém. Com os dois no ar, **nenhum está centrado — o PAR está**.

**Quem mostra cada um é o render do ESTADO que ele desfaz**
(`renderCamadaBtn`, `renderRotBtn`), nunca um render próprio: é a única
disciplina que impede o botão de sobreviver ao fato que ele nomeia.

| morador | quando aparece | o que o ícone diz |
|---|---|---|
| `#pvCamadaBtn` | há Camada de Texto projetando | uma pilha de folhas + ✕ |
| `#pvGiroBtn` | `mediaRot !== 0` | uma seta de giro + ✕, e o ÂNGULO ao lado |

**OS DOIS SÃO VERMELHOS** (`--stage-alert`) e **carregam o MESMO ✕** — os dois
`<path>` verbatim, não um parecido. A v1.4.43 pintou o giro de denim com o
argumento de que vermelho neste app quer dizer "está no ar agora"; a v1.4.45
reverteu a pedido do operador (*"ele deve ser vermelho e ter em seu design o 'x'
indicando que o toque destroi tal configuração atual"*), e o argumento antigo
lia o token estreito demais: o que o `--stage-alert` diz aqui não é "no ar", é
***"o toque daqui TIRA alguma coisa"*** — que é a definição da faixa. Duas
promessas iguais em cores diferentes ensinavam que a cor ali significa outra
coisa, e não significa.

**O que os separa é o DESENHO**, que é a regra de sempre: o ícone mostra o
ESTADO, o ✕ diz o que o toque FAZ. Um ✕ redesenhado dois pixels adiante seria
uma segunda opinião sobre a mesma marca — daí o oráculo cobrar os traços
comuns e os próprios, os dois.

**O desfazer do giro** existe porque o giro era a única preferência que muda a
projeção **e não tinha porta de volta onde se vê o efeito**: o tile de
Configurações CICLA 90° por vez, então voltar de 90° custava abrir a folha e
tocar três vezes — olhando para a folha, não para a projeção.

- **O ÂNGULO é o estado**, e é ele que separa este botão do tile. Com o número
  ao lado a frase fecha: *está a 90°* (estado) + *toque volta ao padrão* (`title`)
  — e, com a cor igual à do vizinho, é ele que diz o que ESTE ✕ destrói.
- **A seta é INLINE, e não um símbolo do sprite** (v1.4.45). Arco de raio 6 em
  torno de (10,10), ocupando 4→16 — o canto inferior direito, de 16,4 a 21,5, é
  do ✕. A razão escrita então era *"o dia em que um dos dois mudar de forma o
  outro não pode ir junto"*, e a v1.7.6 cobrou: o tile trocou a seta circular
  pelo QUADRO DE PAISAGEM e nada aqui teve de mudar. **A seta fica**, porque as
  duas peças respondem perguntas diferentes — o tile mostra o ESTADO (a paisagem
  na posição em que ela está) e este botão é a AÇÃO (*desfaça*), com o estado ao
  lado, no número. O vizinho é inline pela mesma razão.
- **É o único `.pv-fab` mais largo que `--hit`** (`width: auto` +
  `min-width`), e a exceção é o número: mantido o `width` fixo dos irmãos,
  "180°" sai cortado sem erro nenhum. A altura não muda — o alvo continua no
  piso do app.
- **O `<span>` do número tem `text-shadow` próprio**, irmão das três
  `drop-shadow` do `.pv-fab svg`: aquelas acompanham o TRAÇO do SVG e não
  alcançam um `<span>`. Sem ele o ângulo sumiria sobre um slide claro
  exatamente onde o ícone ao lado continua legível.
- **A regra da cor vem DEPOIS da `.pv-fab`** na folha, pela razão que o selo de
  camadas já mediu: as duas medem 0,1,0 e quem vence é a última do arquivo —
  escrita antes, o `color: var(--stage-text)` ganha e o botão sai BRANCO, igual
  aos de player ao lado, isto é, sem dizer nada.

##### A coluna de operação (v1.3.5)

Os três moravam na fatia do meio da coluna do mixer, com moldura de botão, FORA
da preview; vieram para cima dela a pedido do operador, e o espaço que deixaram
virou o `#slideNextBtn`. Quatro consequências, e nenhuma é cosmética:

- **TOPO, MEIO e BASE** (`justify-content: space-between`, v1.3.6), o mesmo
  alinhamento da coluna do player ao lado: o de cima encosta na altura do cast,
  o de baixo na do tela cheia. Em bloco no centro — como nasceram — os três liam
  como um agrupamento solto no meio da miniatura, sem relação com nada, e a
  lateral direita, a dois dedos dali, já usa as pontas.
  - **Os botões daqui são ENCOLHÍVEIS** (`flex: 0 1 var(--hit)`), porque a
    preview pode ficar baixa: MEDIDO, 95px em 360px com uma TV 2,17:1 e 77px em
    320px — três alvos de 34px não cabem em nenhum dos dois. **O piso é o
    tamanho do ÍCONE** (24px): abaixo dele a caixa fica menor que o desenho que
    ela contém, e o que se ganha em folga se perde em ícone saindo do botão. Com
    26px o terceiro ainda vazava 3,3px por baixo da miniatura a 320px, medido.
- **O desenho passou a ser SVG do sprite, não glifo da fonte.** O `.pv-fab`
  pendura três `drop-shadow` no TRAÇO do `<svg>`, e um `.msym` não tem traço
  para sombrear — perderia justamente o contraste que mantém o ícone legível
  sobre um slide branco.
- **O estado virou COR DE TRAÇO.** Sem pastilha não há o que pintar de
  `--danger-soft`: mudo e telão coberto vestem `--stage-alert` (o vermelho de
  TRAÇO do palco, o mesmo do selo de camadas — o território é o PALCO, que não
  tem tema), e o áudio bloqueado veste `--warn-text` com a pulsação de sempre.
  A tecla grande do Modo Fácil, que TEM moldura, continua com o par
  fundo-suave + cor.
- **Eles NÃO aparecem no Modo Fácil, e desde a v1.11.11 nada da prévia aparece lá.** A prévia
  não muda mais de casa (`hostPreview`): o nó fica na casa do avançado, escondido
  pelo `<main>`, só porque o `stage` dele toca o som quando o som é deste aparelho.
  O selo de camadas, a seta e o ícone de cast da prévia não existem lá — ver
  "O Modo Fácil sem prévia", abaixo.

**A ARMADILHA DO `<use>`, e ela é a razão de cada estado ser um símbolo
separado.** A cortina e o mudo trocam de desenho por `.ico-base`/`.ico-alt`,
alternadas pela classe `.alternado` — a mesma chave do `#fsView` da tela cheia.
O conteúdo clonado por um `<use>` mora numa **árvore-sombra que a folha do
documento NÃO atravessa** (MEDIDO em Chromium): um `<symbol>` único com os dois
desenhos dentro carrega, não erra e desenha **os dois empilhados, para sempre**.
Por isso `#icoImagem`/`#icoImagemOff` e `#icoSom`/`#icoSomOff` são quatro
símbolos, e o consumidor pendura dois `<use>` — que são elementos da árvore de
LUZ, e é neles que o seletor pega. `#fsView` passou a usar o mesmo par, matando
a cópia byte a byte que ele mantinha do desenho da cortina.

##### O selo de camadas foi para o centro (v1.3.5 no topo, v1.3.10 na base)

Ele ocupava o canto superior esquerdo, e aquela lateral virou a coluna de
operação: no alto daquela pilha, um selo vermelho leria como mais um controle
dela — que é exatamente o que ele não é (os três operam a cena; este DIZ um
estado dela). No centro ele não faz coluna com ninguém, e aparecer já é metade
da mensagem. Desceu para a BASE na v1.3.10, pelo alcance do polegar — e é essa
faixa que virou a região do que está fora do padrão (ver acima).

Oráculo das três coisas: **`tools/controles-layout.test.mjs`**. As duas
asserções mais óbvias para a armadilha do `<use>` — contar nós visíveis e
fotografar o botão — **aprovam a armadilha**, e está medido no cabeçalho dele: a
contagem porque o consumidor continua com um `<use>` visível, e a foto porque o
botão é transparente e o fundo (a preview) muda no mesmo `renderControls`. O que
ele pergunta é qual SÍMBOLO está no ar em cada estado.

Passaram por três arranjos antes deste — e os dois primeiros foram **com quatro
botões**, que é o detalhe que explica por que eles não valem como precedente
contra o atual. Um **em cada canto**: dispersos, o olho procurava cada um num
lugar diferente, e um deles tampava a parte da miniatura onde costuma estar o
texto projetado. Uma **fileira na base**: sobrava vazio dos dois lados, já que
quatro botões não chegavam perto da largura da preview. Uma **coluna de vidro à
direita**, cada botão `flex:1` pela altura toda: com quatro, era a única forma
que cabia; com dois, virou uma barra de ferramentas grande demais para o que
tinha dentro.

Com **dois**, o canto voltou a ser a resposta certa (v5.67), e sem os dois
problemas de antes: não há dispersão com dois alvos na mesma borda, e o de cima
é o cast — não um botão qualquer no meio do caminho do texto, mas o mesmo canto
que todo player usa.

| Ordem (de cima) | Botão | Ação |
|---|---|---|
| 1 | `#pvCastBtn` (cast) | seletor de espelhamento do Android (`AVNative.openCast()`) — **só no app nativo**; oculto no navegador |
| 2 | `#pvFullBtn` (expandir) | **tela cheia** da preview (`requestFullscreen` + trava de paisagem) |

> Eram **três**: a engrenagem (`#pvSettingsBtn`) abria o popup de Exibição.
> Saiu na v5.49, quando Configurações ganhou um botão fixo no topo do mixer (que
> na v1.2.0 subiu para o cabeçalho da tela) —
> duas portas para a mesma tela, uma delas escondível por um toque na preview,
> é espaço gasto sem informação nova (o mesmo argumento que aposentou a aba de
> Álbuns na v5.44). E uma **configuração** que some com um toque acidental na
> miniatura é a que ninguém acha.

> Havia um quarto (`#pvMsgBtn`, mensagem na tela). Ele saiu na v5.31: Mensagens
> virou uma seção da aba **Ferramentas**. Enquanto era a única ferramenta avulsa o
> FAB se justificava; com três delas, ter uma em cima da preview e duas numa aba
> era a mesma pergunta ("que aviso eu ponho na tela?") respondida em dois
> lugares — e o espaço sobre a preview é o que menos sobra.

São a única indicação de que essas ações existem, e a preview fica na base da
tela o tempo todo; escondê-los por omissão devolvia o problema dos gestos
invisíveis que eles substituíram (toque = tela cheia, toque longo = popup), que
nada na tela anunciava.

#### Layout de player: os cantos, sem moldura, permanentes (v5.67)

Eram dois retângulos de vidro (`--glass-bg` + borda + `backdrop-filter`)
**empilhados numa coluna** à direita, ocupando a altura inteira da miniatura em
partes iguais. Isso é desenho de barra de ferramentas, e ele compete com a
imagem justamente onde ela é pequena. Hoje são **só ícones**, um em cada canto
da direita: **cast em cima, tela cheia embaixo** — onde todo player os põe, e
fora do caminho do que está projetado.

- **A caixa continua sendo `--hit`** (o piso de alvo de toque do app). O que
  sumiu foi a moldura, não o alvo.
- **A tela cheia vai ao rodapé por `margin-top: auto`**, não por
  `justify-content: space-between`: no navegador o cast nem existe (`[hidden]`),
  e com um item só o `space-between` o jogaria de volta para o topo — o botão
  trocaria de canto conforme o contexto.
- **A legibilidade virou problema do ícone**, e a resposta é uma `drop-shadow`
  tripla no `<svg>`: ela acompanha o TRAÇO (uma `box-shadow` sombrearia a caixa
  vazia do botão). Duas sombras coladas e quase opacas empilham-se num contorno
  escuro — é o que salva o ícone branco sobre um slide branco, onde não há
  contraste nenhum —, e uma terceira, larga e difusa, o descola de uma textura
  movimentada. Contorno por sombra, e não `paint-order: stroke`, porque estes
  SVGs são desenhados a traço (`fill: none`) e não há preenchimento em volta do
  qual pintar um contorno. Os tokens `--glass-bg`/`--glass-line` saíram da
  paleta junto com a moldura: ninguém mais os usava.
- **O toque na preview não os esconde mais.** Esconder era resposta ao desenho
  errado — a coluna de vidro de fato tampava a miniatura. Sem ela não há o que
  atrapalhar, e o que sobrava era um estado escondido: uma preview sem botão
  nenhum não anuncia que basta tocar nela para trazê-los, que é o problema dos
  gestos invisíveis de volta, com um passo a mais. Errar o alvo por 2px também
  deixou de custar caro: antes o toque caía no reconhecedor de gestos e sumia
  com a coluna inteira, obrigando a tocar de novo só para recuperá-la. Fora da
  tela cheia a preview passou a **não ter ação própria**.

Ficam **sempre ocultos em tela cheia** (`.preview:fullscreen .pv-fabs {
display:none }`): sem TV conectada, a tela cheia É a projeção, e um botão
sobreposto iria junto para o telão. `.pv-fabs` é `pointer-events:none` (só os
botões recebem toque), senão a coluna cobriria parte da preview e o toque nunca
chegaria ao reconhecedor de gestos.

A **tela cheia** (`requestFullscreen` no `#preview` + `screen.orientation.lock
('landscape')`, permitida só já em fullscreen — padrão de player de vídeo,
destravada no `fullscreenchange`) é a **projeção quando não há telão
conectado**. CSS: `.preview:fullscreen` preenche a tela (cantos retos, sem
borda, `touch-action:none`; as camadas internas já são `inset:0` +
`object-fit`). O popup de **Configurações** (`#fadePopup`, aberto pelo
`#settingsBtn` no cabeçalho da tela) é o **painel rápido** descrito logo abaixo.
Chamava-se "Exibição" enquanto
guardava só como o telão se PARECE; com a mesa de som vinda do mixer, o que
reúne as linhas passou a ser "o que se decide uma vez, ao montar o culto" —
aparência do telão E roteamento do áudio. Nenhuma delas se opera durante o
culto, que é o critério de estar aqui e não na coluna do mixer. O `id` segue
`fadePopup` por herança (os controles de fade que lhe deram o nome saíram há
versões): renomeá-lo tocaria dezenas de referências sem mudar nada visível. As
transições (fade) **não têm controle ali** — são inerentes ao sistema (ver o
state `fade`).

#### Os controles DENTRO do fullscreen: botões, não gestos (v1.0.7)

**Botões sobre a projeção** (`#pvFsCtl`). Eles **nascem acesos** ao entrar na
tela cheia, **4 s sem toque apagam** (`FSCTL_MS`), e o toque em qualquer lugar
da projeção é um **INTERRUPTOR** — as duas últimas coisas são da v1.3.10, a
pedido do operador. Foram uma COLUNA na lateral direita da v1.0.7 à v1.12.41;
desde a v1.12.42 são o MODELO ÚNICO abaixo, nos dois modos.

Ela substituiu um mapa de **gestos invisíveis** — toque por terço, deslizes nos
quatro sentidos, arrasto de volume no terço direito. O motivo daquele desenho era
bom e continua valendo: sem TV conectada, **a preview em tela cheia É a
projeção**, e tudo o que se pinta aqui a congregação vê. O que ele não tinha era
como se anunciar: quem não decorasse o mapa não tinha como descobri-lo, e um
toque no lugar errado fazia outra coisa em cima do culto.

A coluna preserva a razão e paga o preço de outro jeito: **passageira** (só ao
toque, some sozinha) e **translúcida** (`.72`).

| Botão | Onde (v1.12.42) | Ação | Como |
|---|---|---|---|
| ▶/⏸ | **CENTRO**, 60px (`--fs-play`, 1,5× os outros) | play/pause | `playPauseEl.click()` |
| ⏮ | à ESQUERDA do ▶/⏸ (só avançado) | estrofe anterior · **segurar**: mídia anterior | `attachTransportStep(btn, -1)` |
| ⏭ | à DIREITA do ▶/⏸ (só avançado) | próxima estrofe · **segurar**: próxima mídia | `attachTransportStep(btn, 1)` |
| Sair | canto **INFERIOR direito**, na linha do tempo | fecha a tela cheia | `exitFullscreen()` |
| Cortina | canto **SUPERIOR direito**, na faixa do título (só avançado) | wallpaper on/off | `viewToggleEl.click()` |

**E O MODELO TEM TRÊS COMPANHEIRAS, nos dois modos** (v1.12.41 no Modo Fácil,
v1.12.42 no avançado): o NOME da mídia numa faixa no topo (`#pvFsTopo`), a LINHA
DO TEMPO numa faixa na base (`#pvFsBase`, o mesmo `ligarBarraDeTempo` da barra do
card, escrita por `renderFsTempo`) e o VOLUME em pé na borda esquerda
(`#pvVolume`). As duas faixas reservam à direita o recuo do botão do canto
(`--fs-recuo`), e é por isso que o sair e a cortina moram NA LINHA delas sem
cobrir nada. Pedido do operador: *"unificar o modelo do modo de tela cheia do
modo simples, também para o modo avançado … botões como anterior e próximo vão
ficar no centro da tela a esquerda e direita do botão de play/pause. E deixe o
botão de desativar imagem no canto superior direito"*.

**Nada é reimplementado** (invariante 5). O ⏮/⏭ daqui recebe
`attachTransportStep`, que é o par de dois eixos — e desde a v1.3.5 esta coluna
e a notificação nativa são as ÚNICAS superfícies que ainda o usam: na barra de
transporte o par voltou a ser só mídia, porque lá existem dois botões de slide
próprios ao lado da preview. Aqui não existem, e não podem: sem TV a tela cheia
É a projeção, e tudo o que se pinta nela a congregação vê.

**O VOLUME NÃO ESTÁ AQUI** (v1.1.2, pedido do operador: *"pode remover os botões
de volume na tela cheia do preview, para volume usamos apenas os botões físicos
do smartphone"*). Ele é o único controle desta coluna com um alvo **melhor fora
da tela**: os botões FÍSICOS do aparelho, que `captureVolumeKeys` já entrega ao
MESMO fader (`__avVolumeKey` → `applyVolume`). Eles se acham no escuro, sem tirar
o olho da projeção, e não custam os 4 s de espera até a coluna acender — o par na
tela era a alternativa pior das duas. As duas vagas viraram vão entre os cinco
que ficaram. (O `peekVolume` que a tecla dispara mora no mixer, **fora** do
elemento em tela cheia: ali a tecla muda o volume sem mostrar o fader, como já
acontecia antes deste lote.)

**Os dois botões de ESTADO espelham os controles de verdade** (`renderFsCtl`,
chamado de `renderControls` e `setPlaying` — os dois únicos pontos que escrevem
esse estado). Eles LEEM os botões de lá em vez de reler o estado por conta
própria: uma segunda leitura divergiria no primeiro caso de borda.

**A camada (`.pv-fsctl`, `inset: 0`) NUNCA recebe toque, e os botões só
ACESOS** (`.pv-fsctl.visivel .pv-fab { pointer-events: auto }`). A regra dos
apagados (`.pv-fsctl .pv-fab { pointer-events: none }`) é obrigatória e não
óbvia: o `.pv-fab` declara `pointer-events: auto`, e isso VENCE o `none`
herdado do pai — até a v1.12.41 um toque onde um botão escondido estava o
ACIONAVA além de acender (raro na lateral; com o ▶/⏸ no centro seria todo
toque que acende). Oráculo: `video-tela-cheia` I8.

**Os vãos são MAIORES que os botões**: o ⏮/⏭ fica a `--fs-vao` (44px) do ▶/⏸,
e num alvo que se opera sem olhar (quem está em tela cheia olha a projeção)
esse vão é a única coisa que separa um controle do seguinte. O alvo é **40px**
(contra os 34px de `--hit`) e o ícone **28px** — o ▶/⏸ **60px** com ícone de
**42px**: aqui o aparelho está no suporte e o toque é de raspão, ao contrário
dos `.pv-fab` dos cantos da miniatura.

**A folga das bordas é de 10px** (v1.1.3), e ela **não** acompanha os 2px
dos `.pv-fabs` dos cantos: aqueles moram numa miniatura de poucos centímetros,
onde 2px a mais custam mídia visível; aqui a tela inteira é a projeção e o que
sobra é espaço. Encostado na borda, o alvo divide lugar com a moldura
arredondada do aparelho e — em paisagem — com o recorte da câmera numa das
laterais.

**Errar o alvo custa um toque, nunca uma ação errada:** desde a v1.12.42 o dedo
que cai num vão atravessa para a projeção e APAGA os controles (a coluna acesa
era `pointer-events: auto` inteira e o vão renovava; com os botões espalhados
pela tela a camada não pode receber toque, senão comeria a projeção toda). O
toque num BOTÃO chega ao botão, e o `pointerdown` que borbulha até a `.preview`
apenas RENOVA os 4 s.

##### Ela NASCE ACESA, e o toque é um INTERRUPTOR (v1.3.10)

*"Quando se chego no preview em tela cheia, eu preciso ver os botões, e depois
eles desaparecem. Atualmente eles vêm apagados e não dizem que existem. E o toque
para vê-los deve ser o mesmo toque em qualquer lugar que faz eles desaparecerem
quando visíveis."*

Duas correções, e as duas devolvem à coluna o que ela veio dar:

- **Entrar ACENDE** (`fullscreenchange` → `esconderFsCtl()` e, se entrou,
  `acenderFsCtl()`). Nascer apagada devolvia o problema dos gestos invisíveis com
  um passo a mais: nada na tela dizia que havia o que tocar, e a única descoberta
  possível era tocar no escuro. Mostrar UMA vez e sumir é o que ensina sem cobrar
  tela — os 4 s seguintes já são a projeção limpa. O `esconderFsCtl()` vem SEMPRE
  primeiro, inclusive ao entrar: é ele que garante que a reentrada não herde o
  relógio da sessão anterior.
- **O toque ALTERNA.** Antes ele só acendia, e sumir era coisa do relógio: quem
  quisesse a tela limpa antes dos 4 s não tinha o que tocar, e tocar de novo só
  reiniciava a contagem — o gesto existia num sentido só.

**O que sustenta o interruptor é a regra que já existia:** o toque que ACENDE não
é o que ACIONA. Apagada, a coluna é `pointer-events: none` e o toque atravessa
até o reconhecedor da `.preview`; acesa, o toque num BOTÃO chega ao botão, e esse
`pointerdown` precisa RENOVAR em vez de apagar — senão comandar a projeção
fecharia a coluna a cada comando, e passar três estrofes exigiria um toque de
reabertura entre cada duas. Só o toque que cai **fora** dela esconde
(`e.target.closest('.pv-fsctl, .pv-fsbase')`). **O vão entre os botões contava
como DENTRO até a v1.12.41**; desde a v1.12.42 ele é fora (ver acima).

Oráculo: as quatro asserções de tela cheia em `tools/controles-layout.test.mjs`.
Elas esperam pelo **evento** `fullscreenchange`, nunca por
`document.fullscreenElement` — MEDIDO, o Chromium publica a propriedade ANTES de
despachar o evento, e a enquete do Playwright cai no vão: o oráculo lia a coluna
apagada e reprovava um app que estava certo. Esperar pelo `.visivel` seria a
outra ponta do erro (uma tautologia).

**SVG e não `.msym`:** a fonte é um subset de 31 codepoints, e o `.pv-fab`
pendura três `drop-shadow` no TRAÇO do SVG — é o que mantém o ícone legível
sobre um slide branco. Um glifo perderia a sombra e o contraste junto.

A config de
preenchimento é persistida em `state.fit`, aplicada ao vivo via comando (`fit`,
Display + preview) e recarregada do state ao inicializar. A de fade **não
existe mais**: é fixa e compartilhada (`createStage.FADE`), sem state nem
comando (ver a chave legada `fade`).

### Onde o Display roda

O Display **não é mais um app que se abre**. No aparelho ele é a
`android.app.Presentation` que o shell nativo cria sozinho na TV assim que uma
tela de apresentação aparece — e recria quando o dongle cai e volta (o WebView
recarrega `/display/`, dispara `display-ready` e o Controle reenvia o estado
atual). Por isso o rodapé do popup de Configurações (`#openDisplayBtn`) é um
**indicador de estado**, alimentado ao vivo por `AVNative.displays()` +
`onDisplayChange`: "Telão conectado: <nome> (<w>×<h>)" ou "Nenhum telão
conectado".

**Sem telão conectado**, a projeção é a **preview em tela cheia** (botão de
expandir sobre a preview) — o operador espelha a tela inteira do celular, o que
funciona em qualquer aparelho. É por isso que a tela cheia e seus gestos
invisíveis continuam existindo.

No **navegador** não há Presentation: o mesmo rodapé volta a ser um atalho
(`window.open('../display/', '_blank')`) para abrir a tela do Display numa
janela à parte — útil para desenvolver a base web fora do app, e nada mais.

