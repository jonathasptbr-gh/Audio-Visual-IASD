<!-- Parte do capítulo do Controle (o índice das partes está em CONTROLE.md;
     o mapa geral, em docs/ARQUITETURA-WEB.md). Partida do CONTROLE.md na
     revisão A3 (2026-10-30): o texto foi MOVIDO verbatim. -->

## Controle — a navegação (uma tela, duas folhas e uma janela)

> Parte do capítulo do Controle — o índice das partes e as regras que valem
> para o Controle inteiro estão em [`CONTROLE.md`](CONTROLE.md).

**Nesta parte:** [A navegação: uma tela, duas folhas e uma janela](#a-navegação-uma-tela-duas-folhas-e-uma-janela-v150--v151)


### A navegação: uma tela, duas folhas e uma janela (v1.5.0 → v1.5.1)

Pedido do operador: *"vamos fazer uma alteração grande de design: agora o
cronograma vai ser a tela padrão e única."*

```
 ┌─────────────────────────────────────────┐
 │  Cronograma  (a lista, sempre)      ⚙   │
 │ ┌─────────────────────────────────────┐ │  ← #toolsSheet · #bibleSheet
 │ │  folha (Ferramentas | Bíblia)       │ │    cobrem SÓ o corpo da lista
 │ └─────────────────────────────────────┘ │
 │  [ 📖 Bíblia ]      [ ⠿ Ferramentas ]    │  ← as duas portas (v1.13.5)
 ├─────────────────────────────────────────┤
 │  🎲  [ buscar…            ]   ↑ / ✕     │  ← a .lib-bar: a CABEÇA da janela,
 │  transporte · preview · mixer           │    pousada no TOPO desta caixa
 └─────────────────────────────────────────┘
   A Biblioteca é a janela INTEIRA: fechada, só a barra dela aparece; aberta,
   ela sobe até o topo e a barra vira a cabeça dela — e para na LINHA DA BARRA,
   com a caixa de controles à vista por baixo (v1.5.4).
```

**A FAIXA DE ABAS SAIU INTEIRA**, e com ela o vazado deslizante (`.tab-ind` e o
`moveTabIndicator` que o media), o carrossel horizontal, o fantasma da troca de
tela e o `switchTab`. Nada disso tem para onde apontar: há um lugar e duas
janelas, e abrir uma janela não é um passo lateral.

**`activeTab` deixou de existir.** Ela tinha dois valores porque havia duas telas
de lista; o que sobrou é `bibliaNoAr` — *a folha está aberta?* Todos os
`activeTab === 'imports'` que ela sustentava eram, na verdade, *"o Cronograma
está à vista?"*, que hoje é sempre verdade: **a folha COBRE a lista, não a
substitui.** É um booleano e não `!bibleSheetEl.hidden` porque o `hidden` só cai
no fim da animação de saída.

**O TÍTULO DE CADA JANELA FICA NO CENTRO, E PARADO** (v1.8.80) — *"centralizar o
título de cada janela dessas… E tome cuidado para que ele permaneça imóvel mesmo
alternando entre telas da mesma janela"*. As duas metades são uma só, e é isso
que escolheu o mecanismo: com `flex: 1` o título era o ESPAÇADOR da linha —
encostava à esquerda e, na Bíblia, ANDAVA quando o voltar aparecia (MEDIDO,
39,6px a 430×900 e 41,2px a 360×640 · 1,3×, entre a lista de livros e a leitura).
Um `text-align: center` sozinho não alcança a segunda: a caixa dele continuaria
sendo "o que sobra", e o que sobra muda de tamanho com o vizinho. A grade é a da
`.list-header`, verbatim — um botão `hidden` some do layout mas não apaga a
trilha que o template declara, e é por isso que trocar de tela não move o
título. O `grid-column` de cada morador é explícito: sem ele, a folha de
Ferramentas (que não tem voltar) poria o título na trilha 1.

| peça | o que é |
|---|---|
| `#toolsSheet` · `#bibleSheet` | as duas folhas, filhas do `.list-body`, cobrindo só a lista |
| `.tools-head` | a barra de cada uma: **uma grade de três trilhas**, com o título no centro (v1.8.80) |
| `.portas-row` | as duas portas (v1.13.5; eram três): `#bibleBtn` · `#toolsBtn` |
| `.lib-bar` | a barra da Biblioteca — a CABEÇA da janela, à vista no topo da caixa de controles |
| `#hymnSearchPopup` | a JANELA da Biblioteca — `fixed`, do topo até a LINHA DA BARRA, sobe da barra |

#### As portas do rodapé (duas desde a v1.13.5)

Eram TRÊS da v1.5.0 à v1.13.4 — *"na base dela se mantém o botão de importar
arquivos no centro, a esquerda o botão de bíblia e a direita o botão de
ferramentas"* —, e o IMPORTAR foi para a trilha 1 da barra do topo
(`#cronoImportar`, ver "Os cronogramas múltiplos"): *"no lugar do esvaziar lista
de cronograma, mova o botão de importar arquivo para o cronograma … Deixando na
base, apenas bíblia e ferramentas"*.

A ordem é a da leitura: o que se **consulta** à esquerda, o que se **produz** à
direita. `flex: 1 1 0` — base ZERO, porque com `auto` "Ferramentas" partiria maior
que "Bíblia" e ficaria maior depois de repartida a sobra; e a largura da porta de
Ferramentas é a da LISTA dela (ver "A LISTA DAS FERRAMENTAS").

**Ícone À ESQUERDA do rótulo** (v1.13.5): *"ajuste para que o icone fique a
esquerda dos titulos dos dois botões"*. Os dois são UM grupo centrado na porta
(`flex-direction: row`, `justify-content: center`, `gap: --sp-3` desde a v1.13.7). A pilha de antes
(ícone em cima, a do `.qs-tile`) existia pela largura de UM TERÇO — MEDIDO em 360px,
três rótulos em linha não cabiam; numa METADE cabem (de 320 a 430px, o 9-H do
`ferramentas-folha`). As alturas (`--hit-foot`), a tinta (`--surface-porta` +
`--accent`) e a sombra (`acertarSombraDasPortas`, `.livre`) não mudaram.

**O RÓTULO TEM PRESENÇA** (v1.13.7): *"agora que temos mais espaço para os dois
botões de biblia e ferramentas, verifique se conseguimos aumentar a fonte ou ao menos
colocar elas em negrito … sinto que eles estão com pouca presença"*. As duas coisas:
`--fs-lg` (era `--fs-md`; 13,12 → 14,4px a 1×) e `--fw-forte` (o peso de botão da
escala). O que paga a largura é o vão (`--sp-3`, era `--sp-4`), e o ícone fica em
`--icon-sm`: o degrau a mais deixava "Ferramentas" com 0,4px de folga a 360px · 1,3×.
MEDIDO com uma fonte da métrica da Arial ("Ferramentas" / a caixa dele, a altura): 430×900
89/89, 42px; 360×640 89/89, 42px; 360×640 · 1,25× 111/111, 42px; 360×640 · 1,3× 116 em
118,4, 42px. **A LARGURA DA PALAVRA É DA FONTE**: com a DejaVu do CI ela é 16% maior
(134 em 118 a 1,3×). Onde não cabe, o `--porta-fs-teto` da `.portas-row`
(`acertarLetraDasPortas`, o `tetoQueCabe` da lista das Ferramentas, comum às duas
portas) baixa o corpo até caber — nunca reticências, piso 11px. Oráculo:
`portas-presenca`.

**Com a folha aberta na LISTA, a porta de Ferramentas vira SETA** (v1.13.6): a folha
cobre a porta, e no retângulo exato dela mora o `#toolsFechar`, que fecha a folha —
ver "A LISTA DAS FERRAMENTAS", linha "a seta".

##### E AS TRÊS FICARAM QUIETAS E BAIXAS (v1.5.19)

*"padronize os botões de biblia, importar e ferramentas da aba de cronograma,
para que tenham uma cor mais proxima a cor de fundo, para que não se destaquem …
preciso que sejam opções discretas, mescladas ao fundo"* + *"veja se consegue
alguma opção de deixar eles mais baixos. pois estão muito altos e volumosos."*

**A DO MEIO SALTAVA POR CROMA, NÃO POR CLARIDADE — e isso decide a correção.**
MEDIDO no tema CLARO, o da captura dele, o azul mede **1,07:1** contra o fundo,
MENOS que as laterais (1,20:1): em luminância ele já era o mais mesclado dos
três. O que o fazia saltar era o croma (ΔC* **+8,5** no claro, **+12,7** no
escuro) — exatamente o que a paleta assinou em *"o separador aqui NÃO é a
claridade: é o CROMA"*. O `--btn-accent` estava funcionando como projetado.
Corolário operacional: **uma correção que só mexesse na luminância não
resolveria o relato.**

**E O ARGUMENTO QUE O PINTAVA DE AZUL CAIU SOZINHO.** Ele era *"quem ENTRA com
conteúdo é a do meio, e ela é a única AÇÃO da faixa"* — escrito quando as
laterais eram quadrados MUDOS de 44px. Desde a v1.5.0 as três têm RÓTULO, e a do
meio é a única cuja palavra é um VERBO: *Importar* × *Bíblia* × *Ferramentas*.
A redundância já existia, e é gramatical. Some um segundo argumento, MEDIDO: dos
treze consumidores de `background: var(--btn-accent)` na folha, este era o ÚNICO
a pintar uma porta de NAVEGAÇÃO permanente sobre a página — e o `CLAUDE.md`
escreve que *"**LIGADO** (interruptor) = `--btn-accent` + `--accent`"*. O rodapé
dizia "ligado" o culto inteiro, num idioma em que isso quer dizer outra coisa.

**A COR: 70% de `--surface` nas três**, por `color-mix` sobre o valor JÁ
RESOLVIDO (a receita do `.nowplaying` da v1.5.15) — `--surface` não tem valor
único, porque a regra R1 o troca por `--surface-sunk` dentro de um bloco que
pinta `--panel`, e um token novo teria de repetir a bifurcação inteira. MEDIDO:
a faixa vai de 1,37/1,70 (escuro) e 1,20/1,07 (claro) para **1,23** e **1,14**
nas TRÊS, com a soma de ΔE00 caindo 44% e 39%. **Falha ABERTA**: um WebView sem
`color-mix` descarta a segunda declaração e fica com o desenho de ontem.

**A ALTURA: 51,77 → 42,00px (−18,9%), e ela corrige um defeito LATENTE.** MEDIDO,
o termo que mandava não era o `--hit-foot` (44px) e sim o `padding: .45rem` —
varrer o token de 48 a 36px **não mudava um pixel**. Isto é: as duas inquilinas
da fatia do rodapé **não mediam o mesmo**, e o `#listFoot` PULAVA **7,77px** ao
entrar na seleção múltipla — exatamente o que o comentário do `--hit-foot`
promete por escrito que não acontece (*"a lista dava um pulo debaixo do dedo"*).
Com `padding: 0 .3rem` — a forma que a `.selbar` já tinha — o termo vertical
passa a ser um só, e "mais baixo" vira **um número num lugar só**.

**A `.selbar` NÃO ENTROU NA COR, e a razão é um nível abaixo.** Os `.sel-btn`
que moram EM CIMA dela são `--surface-2` (branco a .92) e só são legíveis porque
a barra debaixo é TINTA: sobre uma superfície quieta, o par habilitado ×
desabilitado cai a ΔE **2,11** no tema claro — abaixo do limiar de percepção, e o
app perderia a distinção entre disponível e INDISPONÍVEL na barra que hospeda o
EXCLUIR. Entrar em seleção **é** trocar de modo, e a fatia trocar de tom ali é o
desenho. (O `border-radius` continua UM SÓ para as quatro peças: a `.selbar` base
declara `--radius-card` e é a regra agrupada que a põe em `--radius-btn` — tirá-la
de lá junto com a cor devolveria 10px sem erro e sem oráculo.)

**E "PADRONIZE" COBROU DOIS EIXOS QUE NINGUÉM TINHA OLHADO:**

- **o ÍCONE não saía do mesmo lugar.** Só a do meio estava na lista `:is()` do
  `svg`; o das laterais vivia do atributo `width="20"` do `botaoDoRodape`, e as
  três coincidiam por acidente (`--icon-sm` é 20px). MEDIDO forçando 26px: a do
  meio ia a 26 e as laterais ficavam em 20, **e a altura não denunciava** —
  a `.import-row` é `align-items: stretch` e as três esticam para a mais alta.
  Fechar custou dois nomes e é NO-OP hoje, de propósito;
- **a do meio não herdava a fonte do app, e SÓ NO APP.** No navegador ela é um
  `<label>` e herda do `body`; no app é um `<button>` (`usaSeletorNativo`), e a
  folha do agente de usuário entrega a família — que o `font-size` sobrescreve e
  a `font-family` não. MEDIDO criando o `<button>` que o app cria: `Arial` contra
  `system-ui`, **14%** de diferença na largura do MESMO rótulo. **Nenhum oráculo
  enxergava isto**, porque eles rodam no navegador: é a armadilha do `__tela`
  num lugar novo.

**OS PREÇOS, ditos.** No tema ESCURO o `--press-luz` fica INERTE nas três (Δ**1**
nível contra os Δ30 que a do meio tinha), porque `brightness(1.35)` não move
tinta branca — sobram os 2px de `translateY`, que é a metade que o `.pv-fab` da
v1.4.33 não tinha quando saiu da lista. E o `--hit-foot` governa também o
`.yt-search-btn`, alcançável DE DENTRO do Modo Fácil (44 → 42px), num habitat
SUNK — o token passa a valer em dois habitats opostos.

**O PISO, para quem for mexer no número:** abaixo de **mix 50%** a caixa deixa de
ser encontrável no tema claro (ΔE 2,40, o limiar de percepção), e o tom do
`--op-inativo` — a linguagem do INDISPONÍVEL — fica em 1,10:1 / 1,07:1. Se o
pedido voltar por mais discrição, o parâmetro é o **mix** e nunca a altura:
descer dos 42px reabre o pulo da fatia.

#### A folha da Bíblia

*"a bíblia vai ser uma janela igual o que é hoje a seção de ferramentas, no mesmo
molde."* Mesmo molde, medido: não invade o cabeçalho nem a caixa de controles,
cobre a lista inteira, mesma entrada e mesma saída. O que ela tem a mais:

- **HOST PRÓPRIO** (`#bibleBody`). Ela desenhava dentro do `#library` — o mesmo
  `<ul>` do Cronograma —, e era por isso que `renderLibrary` tinha um desvio por
  aba no topo. Com host próprio as duas listas deixam de disputar um nó, e o
  Cronograma continua desenhado por baixo.
- **O VOLTAR DELA** (`#bibleBack`), na barra da folha. O `#backBtn` do cabeçalho
  só servia à Bíblia e hoje nasce sempre oculto: um voltar na faixa do app
  apontando para dentro de uma janela é o app dizendo que a janela é ele. O
  degrau 2.6 do `__avBack` acompanha — ele SOBE dentro da folha antes de fechar.
- **O DESLIZE** (`deslizarNaFolha`), o que sobrou do carrossel: a navegação
  DENTRO dela é o único movimento lateral que restou no app.

**As duas folhas não se empilham:** são as portas do MESMO rodapé, e uma sobre a
outra teria dois títulos e dois ✕ na mesma caixa.

#### A barra da Biblioteca, e as duas portas dela

*"a barra de buscas e playlist automática como um todo, deve ser uma barra de
lado a lado da tela, sem estar dentro de um card de bordas arredondadas"*
(v1.5.1) · *"vamos mover essa barra de volta para o topo da seção de controles,
onde estava, acima do nome da mídia em exibição"* (v1.5.2).

Os mesmos três elementos, na ordem que a v5.305 fixou — *sortear* · *procurar* ·
*sair*. Uma barra só: duas seriam duas verdades sobre o mesmo campo, e a de
dentro sumiria atrás da de fora no instante em que a Biblioteca abrisse.

**Ela é uma FAIXA, não um cartão**: sem raio, sem margem, de lado a lado. A
v1.5.0 a desenhou como cartão dentro da caixa de controles, e cartão é o que ela
nunca foi — ela é a cabeça de uma janela, e cabeça encosta nas bordas do que ela
encabeça.

**E ELA NÃO PINTA NADA** (v1.5.2): *"vamos remover esse zoneamento de tom
cinza/azul que tem atrás da barra de buscas"*. A superfície própria
(`--field-bar`, v5.270) existia porque o campo era BRANCO nos dois temas — e
campo branco sobre a caixa de controles branca do tema claro dá **1,00:1**. O
token saiu do `tokens.css` com o último consumidor.

**E AS TRÊS PEÇAS DELA FORAM AJUSTADAS UMA VEZ MAIS** (v1.5.5). Os quadrados
viraram botões do controle sem ressalva; o campo voltou a ser branco, agora com
borda. É a mesma pergunta da v1.5.2 respondida com mais precisão: aquele lote
levou a barra INTEIRA para o tom dos botões, e o campo não é um botão.

- **OS DOIS QUADRADOS SÃO O `.t-btn`, E NADA ALÉM DELE.** Relato do operador:
  *"o botão de playlist automática está com botão cinza e ícone azulado, mas os
  botões dessa seção de controles são cinzas com preto … o mesmo para o botão de
  abrir biblioteca, que está um botão azul"*. Os dois perderam a regra própria —
  o `#sorteioBtn` tinha `--accent` desde a v5.303 (*"numa barra de quadrados
  iguais o que os distingue é a cor"*) e o `#hymnSearchToggle` tinha
  `--btn-accent` desde a v1.5.2 (*"ele é a AÇÃO da linha"*). **O argumento dos
  dois era sobre a barra olhada SOZINHA, e ela não está sozinha:** mora colada na
  caixa de controles, onde seis botões iguais ensinam que aceso quer dizer
  LIGADO (o `#repeat.active`). Dois acesos em permanência a dois centímetros
  deles ensinam a não confiar no sinal. O que distingue os dois passa a ser o
  DESENHO, que é a gramática do resto do app.
- **A LARGURA DELES É A COLUNA DO TRANSPORTE** (`--deck-col`): *"que tenham suas
  larguras alinhadas a grade dos botões do próprio controle logo abaixo"*. **Isto
  revoga o QUADRADO da v5.277**, e revoga porque as duas coisas não podem valer
  juntas — o lado do quadrado era `--campo-alt`, FIXO, e a coluna é
  PROPORCIONAL: MEDIDO, 53,4px a 430px e 43,4px a 360px contra os 40 fixos. Uma
  medida fixa alinha com uma grade proporcional numa largura de tela, por
  acidente, e erra em todas as outras. `--deck-col` subiu para o `:root` neste
  lote porque a barra não é descendente do `.deck`, e repetir a fórmula seria a
  sincronização manual que este projeto recusa; o `100%` dela resolve contra a
  caixa de conteúdo de quem a usa, e as duas têm a mesma largura porque têm o
  MESMO recuo lateral. A ALTURA continua sendo `--campo-alt`: quem manda na linha
  é o campo.
- **O CAMPO É BRANCO OUTRA VEZ, E A BORDA É O QUE O TORNA POSSÍVEL.** *"abra uma
  única exceção ao conceito de sem bordas do app, para poder fazer a caixa de
  texto da busca … branca com a borda em cinza"*. As duas metades do pedido são
  uma só: no tema claro `--bar` é branco, campo branco sobre ele é **1,00:1**, e
  sem contorno a caixa de texto não existe na tela. Era exatamente essa
  aritmética que o `--field-bar` resolvia com uma FAIXA; a borda a resolve sem
  trazer a faixa de volta, que é o que o operador recusou. O valor é
  `--field-borda` — o `--line` do tema claro escurecido até passar o piso de 3:1
  de componente (o `--line` cru dá 2,51:1 sobre branco e falha justamente aqui);
  MEDIDO, **3,13:1** sobre o campo e **4,55:1** sobre a barra escura. A exceção é
  NOMEADA nos dois oráculos de contorno (fonte e renderizado), pelo ID: é o nome
  que a mantém única.
- **E UMA SUPERFÍCIE SEM TEMA ARRASTA O QUE VIVE DENTRO DELA.** Texto,
  placeholder e lupa voltam aos `--field-*` junto com o fundo. O meio-conserto —
  trocar só o fundo — apaga o que se digita: no escuro `--text` sobre branco dá
  **1,17:1** e `--muted`, 1,74:1. É a regra do palco num lugar pequeno, e o
  `smoke.mjs` a reprova.
- **No tema CLARO ela AFUNDA a superfície dos filhos**, espelhando a regra da
  `.bottombar` e pela mesma aritmética: lá `--bar` é branco, e um controle em
  branco-com-alfa sobre ele é 1,00:1. A barra mora na janela, que devolve a
  superfície flutuante — sem essa linha ela seria a única peça da caixa com um
  tom que não é o das vizinhas.

**A caixa de controles RESERVA o lugar dela** (`padding-top` da `.bottombar`, de
`--lib-bar-h` mais o respiro): a janela é `fixed` e a barra pousa por cima. A
ÁREA SEGURA de baixo voltou para a caixa, que é quem encosta na barra de gestos
outra vez.

**O vão entre o campo e os dois quadrados é o `--deck-gap` (v1.11.18).** Era
`--sp-4` (8px) contra os 5,6px do deck: MEDIDO a 390px o campo ia de 66,9 a 323,1
e a preview, a dois níveis dele, de 64,5 a 325,5 — 2,4px de cada lado, o bastante
para o olho lê-lo como item fora da coluna (*"essas margens estão diferentes das
margens entre os itens da seção de controles… deixando os itens desalinhados em
relação a seus vizinhos"*). Os quadrados já tinham a largura da coluna lateral
(`--deck-col`); com o MESMO vão o campo tem a da coluna do meio e a barra e o deck
são uma grade só. Oráculo: `controles-layout.test.mjs` (medido contra a preview e
os botões de slide RENDERIZADOS, a 430px).

#### A camada dela é o CHÃO da pilha, não o teto (v1.5.6)

*"a barra de buscas está se sobrepondo a diversos elementos, como as
configurações, aba da playlist e etc… Muito inconsistente"* · *"em aberto a aba
da biblioteca, quando toco em abrir a aba da playlist a playlist tocando fica por
baixo"*.

**A causa é a camada existir SEMPRE.** Todo `.popup-backdrop` deste app está em
`z-index: 200` e é criado e destruído com o uso, então quem se sobrepõe a quem é
a ORDEM DO DOCUMENTO — um acaso que já cobriu um popup por inteiro aqui. Esta é
a única que nunca sai de cena (a barra vive nela) e está declarada DEPOIS do
`#plPopup`, do `#fadePopup` e do `#castPopup`: ganhava dos três, fechada,
pintando a faixa da barra sobre folhas que o operador acabara de abrir.

A correção não é um degrau a mais, é o degrau CERTO — `z-index: 190`. **Esta
camada não é um modal sobre o app: é MOBÍLIA do app**, a cabeça de uma janela
cujo repouso é uma linha da caixa de controles. Abaixo de toda folha, a regra
vale nos dois estados de uma vez: fechada, a barra não pinta sobre nada; ABERTA,
a Biblioteca é coberta pelo que se abrir a partir dos controles — que continuam
alcançáveis desde a v1.5.4, e **é isso que tornou a colisão possível**.

- **A tabela `POPUPS` diz o MESMO**, e por isso a Biblioteca virou a PRIMEIRA
  linha dela: o voltar percorre de trás para a frente, então estar em primeiro é
  estar embaixo. Com a Biblioteca aberta, abrir a playlist e tocar em voltar
  fecha a playlist. Mudar uma sem a outra é o acaso que esta regra veio tirar da
  mesa.
- **O oráculo mede por HIT-TEST**, nunca por `z-index` computado: um número lido
  de volta prova que a folha declara o que declara, e o defeito era o EMPATE.
  `biblioteca-camadas.test.mjs`.

#### Sem caixa de controles na tela, a janela vai até a base (v1.5.6)

*"ajuste também para que a zona dos controles seja ocultada quando a biblioteca
estiver aberta e o teclado também estiver visível. Pois ocupar espaço com os
controles e o teclado, deixa muito comprimido a área para a listagem"* · *"no
modo simples, a aba de buscas pode usar a tela inteira, pois agora ela está
cortando aleatoriamente em algum pedaço da tela"*.

Uma regra, dois relatos. A camada termina na LINHA DA BARRA (v1.5.4) para os
controles ficarem à vista; **quando não há controles na tela, esse recorte não
protege nada** — e no Modo Fácil ele fazia pior: a `.bottombar` é `display: none`
lá, então `--lib-caixa-h` guarda a última medida boa do modo AVANÇADO (o que é o
certo, ver `medirBarraDaBiblioteca`), e a janela era cortada numa altura que não
corresponde a nada do que está na tela. **O número não é aleatório: é de outro
modo.**

- **O teclado é o mesmo caso, criado de propósito**: com a Biblioteca aberta e o
  teclado no ar, a caixa de controles sai e a lista fica com a tela menos o
  teclado, em vez de menos o teclado E os controles.
- **AS DUAS CONDIÇÕES são necessárias** (`body.lib-aberta.teclado`): sozinho, o
  teclado não justifica tirar o transporte de quem opera o culto (ele sobe pela
  Bíblia, pelo renomear, pelo campo do sorteio), e sozinha, a Biblioteca aberta é
  justamente o caso em que a v1.5.4 mandou MANTER os controles à vista.
- **A classe do teclado é escrita no MESMO ponto que `--kb`**: o CSS não sabe
  perguntar se uma medida é maior que zero, e um segundo dono seria um segundo
  instante — os dois discordariam durante a subida do teclado, que é justamente
  quando a regra vale.

#### Ela é uma JANELA, e passou a parecer uma (v1.5.7)

*"ajuste o design da janela da biblioteca para que ela se assemelhe ao design das
janelas de bíblia e ferramentas. bordas curvas e tom branco como base"* ·
*"ajustando também para que haja uma pequena margem em relação aos controles
quando no modo aberta, pois hoje ela fica com a base 'fundida' dificultando a
percepção de até onde vai a lista da biblioteca"*.

`--panel` e `--radius-card`, os MESMOS valores da `.tools-sheet` — o molde que o
pedido nomeia, e é contra ele que o oráculo mede (um literal copiado para o teste
envelheceria na primeira troca de paleta, e envelheceria parecendo certo).

- **O raio só vale ABERTA.** Fechada, o que fica à vista é a BARRA, e ela é uma
  linha da caixa de controles: um cartão em volta dela é o "zoneamento" que a
  v1.5.2 veio tirar. A folha nasceu sem raio porque se apresentava como tela
  cheia, e cantos curvos anunciam "há algo atrás" — **desde a v1.5.4 há**, e o
  raio deixou de mentir.
- **A FRESTA sai da ALTURA**, não de um `bottom`: a folha é ancorada no topo, e é
  do topo que a barra parte. O que aparece nela é o SCRIM da camada, e não uma
  cor nova — é por isso que ela se lê como "aqui acaba a janela".
- **`overflow: hidden` na folha**, senão a barra (primeiro filho, de lado a lado)
  sai quadrada por baixo dos cantos curvos. Seguro porque quem rola é a
  `.popup-list`.

#### A hierarquia é desenhada com MOLDURA (v1.5.9)

*"está errado, reformule o sistema de coloração e organização de grupos e
subgrupos. vamos usar o padrão branco e azul padrão do sistema, e vou lhe dar
autoridade para usar sistemas visuais de design e organização usando bordas, mas
apenas para a biblioteca. pois temos 3 niveis de listagens na biblioteca e o
sistema de separação apenas por cor sólida de cards está limitando nossas
opções"* — com três capturas do defeito.

**Isto REVOGA a paleta da v1.5.7/v1.5.8 inteira**: a tampa tingida, os oito tons
em ordem de espectro, as três famílias por coleção. O diagnóstico do operador é
exato: **cor sólida não diz o que está dentro do quê.** Nas capturas, oito
matizes pastel produziam uma lista bonita e ilegível — a seção "ADORADORES" em
lilás com cinco álbuns lilás soltos dentro dela.

```
┌ NÍVEL 1 — a SEÇÃO ────────────────────────────────┐  moldura + tampa
│ ▸ CDS OFICIAIS/ANO                        2,4 GB  │
│ ┌ NÍVEL 2 — o CARD ────────────────────────────┐  │  moldura + tampa
│ │ ▸ Eu Vou                        2022 · 55 MB │  │
│ │   NÍVEL 3 — as LINHAS                        │  │  sem moldura
│ │   ▸ Eu Vou                                   │  │
│ └──────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

- **A AUTORIDADE É ESCOPADA, e o escopo é o que a torna verificável.** Ela vale
  em `.acervo` — a lista da Biblioteca, marcada pelo `renderCollectionsList` — e
  em lugar nenhum mais. A marca é uma CLASSE e não um id porque ela diz O QUE é,
  não onde calha de estar: a lista do acervo é a Biblioteca em qualquer lugar em
  que alguém a desenhe, inclusive num oráculo. O `tokens.test.mjs` cobra o escopo
  na FONTE e o `smoke.mjs` no RENDERIZADO.
- **A MOLDURA É A CAIXA QUE FALTAVA NO NÍVEL 1**: *"a primeira camada de lista de
  coleções não está criando uma caixa ou moldura ao redor do seu agrupamento,
  diferente de como ocorre corretamente com o card dos albuns"*. O card sempre
  teve caixa — o corpo dele fica dentro do bloco pintado; a seção pintava o mesmo
  tom nos dois e o agrupamento sumia.
- **OS DOIS NÍVEIS DE AGRUPAMENTO DIVIDEM O TOM** (`--btn-accent` sobre a janela
  `--panel`): um degrau de verdade contra a base e NENHUM entre si, porque entre
  eles há sempre a linha e o recuo do corpo. Um degrau ali seria a escada de
  volta, competindo com a moldura.
- **E O TOM É O AZUL FRACO, NÃO UM CINZA** (v1.5.10): *"essa predominância cinza
  escura está muito ruim em especial no tema claro. porque não usou o azul fraco
  como cor principal dos cards?"* — e, sobre o cinza que sobra, *"também pode ser
  interessante usar apenas o cinza que se usa nos botões, não sei porque foi
  usado um cinza bem mais escuro"*. As duas frases são a MESMA troca: a caixa
  vira `--btn-accent` e o único cinza da lista passa a ser o `--surface` das
  tampas, que É o dos botões. **`--panel-2` sai da Biblioteca inteira**, inclusive
  da placa dos favoritos, que o lia por `--camada` e sairia como um retângulo
  cinza dentro de uma seção azul (`.acervo .coll-group-corpo`).
- **QUEM DECIDE O TOM DAS CAIXAS É O NÍVEL 3**, e isso é medição: `--item-fill` é
  branco a 80% no tema CLARO — desenhado para pousar num card acinzentado. MEDIDO
  com as caixas em `--panel`, a faixa ficava a **1,00:1** do card que a contém;
  sobre `--btn-accent` ela mede **1,17:1** no claro e **1,35:1** no escuro. É
  menos que os 1,32:1 do cinza escuro, e é essa a pressão que o oráculo guarda:
  quem for apertar aquele número encontra `--panel-2` como resposta óbvia e
  desfaz o pedido sem saber. A régua do `smoke.mjs` é um VIZINHO RENDERIZADO — o
  botão de ação da própria barra veste `--btn-accent` —, nunca o token lido de
  volta.
- **O NÍVEL 3 NÃO GANHA MOLDURA**: uma faixa é conteúdo, não agrupamento —
  emoldurá-la faria a lista virar uma grade de caixinhas.
- **A PASTA SINCRONIZADA ganha moldura de CARD**, pela regra da v5.284 (ela é um
  contêiner). E o que a separa do item ao lado deixou de ser tom e passou a ser a
  linha: os dois pousam na mesma área.
- **ABRIR NÃO TROCA A COR DE NADA**: *"verifique também a mudança para tons
  cinzas ao selecionar o item, pois está sendo inconsistente com sua cor real"*.
  A tampa de um card aberto lia `--camada`, que o `.expanded` redeclarava — sobre
  um card tingido, ela saía cinza. Hoje a tampa tem tom próprio nos dois estados;
  quem diz que a caixa abriu é o corpo à vista e a seta girada, que é o que a
  doutrina do app já manda (*"ABERTO = não é cor"*).
- **E A MOLDURA TEM CUSTO DE LAYOUT, que o oráculo cobrou.** O vão dos favoritos
  soma a altura das seções FECHADAS medindo a barra de cada uma — e uma caixa
  fechada passou a ser a barra MAIS 2px de linha. MEDIDO com seis seções: a
  última terminava 7px abaixo do fim da lista. O `medirVaoDosFavoritos` soma a
  moldura junto.
- **E ELA TEM UM SEGUNDO CUSTO, do mesmo feitio** (v1.5.10): *"verifique o
  tamanho e espaçamento dos favoritos, pois está deslocado o seu card de topo em
  relação a caixa dele"*. `.coll-group:first-child` dá `padding-top: .2rem`
  (0,2,0, vencendo o `padding: 0` da regra do `--drop`, que é 0,1,0) para a lista
  não começar colada no topo — e com a caixa desenhada aquilo virou uma faixa de
  3,2px DENTRO dela, acima da barra (MEDIDO: caixa em 59,2 e barra em 63,4).
  **E ele sai sem virar margem, de propósito:** margem fica FORA do retângulo, e
  o `medirVaoDosFavoritos` fecha a conta em `clientHeight − padding − gaps −
  barras`, onde margem nenhuma entra — a lista somaria 3,2px a mais que a tela e
  a última seção fechada terminaria abaixo do fim dela, o defeito do item acima
  por outro caminho.
- **E O PRIMEIRO CARD NÃO NASCE COLADO NA TAMPA** (v1.5.10): *"verifique o
  espaçamento entre o card de titulo da coleção e o primeiro item desta coleção,
  parece estar sem espaçamento correto"*. O corpo aberto era `padding: 0 .4rem
  .45rem` — sem recuo em cima —, então o primeiro card começava EXATAMENTE onde a
  barra acaba (MEDIDO: vão de 0px) enquanto os seguintes eram separados por
  `.35rem`: a primeira vizinha da coluna valia menos que as outras. O recuo é o
  MESMO valor do `gap`, e a régua do oráculo é a COMPARAÇÃO com ele — o número é
  decisão de desenho, o que não pode é a desigualdade.

#### O campo se limpa AO FECHAR (v1.5.6)

*"ela está mantendo a palavra de filtro após ser fechada e limpando apenas quando
aberta"*. A limpeza na abertura era certa enquanto o campo VIVIA DENTRO da
Biblioteca (até a v1.5.0): fechada, ninguém o via, e o texto velho morria antes
de aparecer. **Hoje a barra fica à vista o culto inteiro** — o filtro da busca
anterior é a primeira coisa que se lê ao voltar ao transporte, e ele descreve uma
tela que não está mais lá. É a mesma razão que já trouxe o `resetarBiblioteca`
para o fechamento, agora pelo motivo oposto: aquele se faz ali para não ser VISTO
acontecendo, este para não ficar VISÍVEL depois.

**SÃO DUAS PORTAS, e a diferença é o TECLADO** (`openHymnSearch(comFoco)`):

| porta | como | por quê |
|---|---|---|
| o FOCO no campo | abre **com** teclado | *"procurar o hino 37"* |
| a SETA ao lado | abre **sem** foco | *"ver o que eu tenho"* — a lista inteira à vista |

`comFoco` é explícito e não derivado de `document.activeElement`: quando o
ouvinte de `focus` chama a função o campo já está focado, e quando o botão a
chama ele pode estar focado por um toque anterior.

**O botão é UM, com dois desenhos** — seta fechada, ✕ aberta —, os dois na
árvore CLARA: a folha do documento não atravessa a árvore-sombra de um `<use>`.
E ele entra na tabela `POPUPS` como `null`: registrado lá também, o toque com a
janela fechada abriria pelo ouvinte dele e fecharia pelo da tabela, no mesmo
clique.

#### A janela que sobe, levantando a própria barra

*"ela não é restrita a zona do cronograma, ela é um popup de tela inteira, ela
surge da base da tela e vai levantando a barra de buscas, de modo que a barra de
buscas acabe no topo da biblioteca. (isso resolve o problema que temos
atualmente da caixa de texto ficar escondida pelo teclado)"*

**A MECÂNICA NÃO TEM MECANISMO.** A janela é uma coluna `[barra][lista]`. Aberta,
`translateY(var(--sa-topo))` — a barra para no alto porque é onde ela sempre
esteve dentro desta coluna, e o único desvio é a faixa da barra de status.
Fechada, a coluna desce até a barra pousar no lugar dela: o topo da caixa de
controles. Não há nó transportado entre dois pais e não há segunda barra — a
barra que se toca na caixa é a mesma que encabeça a janela.

**O QUE A v1.5.2 MUDOU É SÓ ONDE ELA REPOUSA.** Era a base da TELA (`100% - a
barra`, uma conta que não pedia medida de posição nenhuma); é o topo da caixa de
controles, que é uma posição do layout — daí um `--lib-desce` medido, que a
v1.5.3 substituiu por alturas (ver abaixo: uma coordenada envelhece). A abertura,
o movimento e o destino não mudaram uma linha.

**E É POR ISSO QUE A JANELA TERMINA NA LINHA DA BARRA (v1.5.4).** Pedido do
operador: *"ajuste para que ela use a área abaixo da barra de buscas, até o topo.
seu deslizamento surge e se corta ali. mantendo sempre os controles visíveis"*.
Com a barra a meia tela, tudo que vem ABAIXO dela na coluna — a lista e o fundo
da própria folha — cairia por cima da caixa de controles: o transporte coberto
por uma tela de `--bg` que ninguém abriu.

A CAMADA passou a ir do topo até a linha em que a barra repousa: `bottom` é a
caixa de controles MENOS a barra (a caixa já reserva a altura dela no
`padding-top`, e é essa faixa que a janela ocupa quando a barra sobe), mais
`overflow: hidden` — sem ele o `bottom` só encolhe a caixa da camada e um filho
`absolute` transborda dela. Duas alturas medidas, nenhuma coordenada: a mesma
conta que põe a barra no lugar.

- **ELA É A MESMA ABERTA OU FECHADA, e é isso que a torna segura.** Não há
  estado: o recorte não anima, não tem atraso e não pode ficar preso num valor de
  partida. Abrir é a COLUNA subindo dentro de uma janela que não se mexe —
  *"surge e se corta ali"*.
- **E OS CONTROLES CONTINUAM VIVOS.** Fora do recorte não há camada: nem pixel,
  nem scrim, nem toque. Com a Biblioteca ABERTA o operador vê e ALCANÇA o
  transporte — pausar o louvor enquanto procura o próximo deixou de exigir fechar
  a janela.
- **AS DUAS TENTATIVAS ANTERIORES, e por que as duas caíram.** A v1.5.1 recortou
  a CAMADA na posição do lugar da barra: aquele valor depende de uma MEDIDA que
  muda em runtime, e o atraso que o recorte precisava ter atrasava TODA mudança
  do valor, remedição inclusive — MEDIDO no `controles-layout.test.mjs`, que não
  desenha quadros, o recorte ficou preso no valor de partida e a janela FECHADA
  cobria a preview inteira. A v1.5.2 mudou-o para o espaço da própria FOLHA
  (`clip-path` é aplicado ANTES do `transform`, então "tudo abaixo da barra" vale
  onde quer que a coluna esteja), o que resolveu o atraso e trouxe a segunda
  metade do defeito do aparelho: o recorte revelava `[0, altura da barra]` de uma
  folha em que a barra começava DEPOIS do recuo da área segura. **Sem recorte
  nenhum as duas classes somem** — a janela acaba onde a camada acaba.
- **A ÁREA SEGURA É O DESTINO, NÃO UM RECUO** (v1.5.4). Relato do operador: *"a
  barra superior acima da barra de buscas … quando é animada para fechamento, se
  torna uma margem saliente durante o movimento"*. Ele estava vendo o
  `padding-top` da folha: como RECUO ele existe nos DOIS estados — aberta é a
  faixa da barra de status, que é o certo; fechada e em movimento é uma faixa a
  mais VIAJANDO ACIMA da barra, que nada explica. Hoje a barra é o primeiro pixel
  da folha e abrir leva a coluna até `--sa-topo` em vez de zero: não há estado a
  trocar, logo não há o que aparecer no meio do caminho. A `height` da folha
  desconta o mesmo tanto, senão a última linha da lista terminaria fora do
  recorte.
- **O FUNDO da folha continua com relógio próprio** — fechada ela não pinta nada,
  senão a faixa da barra ficaria com um retângulo `--bg` por trás, que é o
  "zoneamento" que o operador mandou tirar.
- **E UMA REMEDIÇÃO NÃO É UMA ANIMAÇÃO** (`semAnimarAJanela`). A janela anima
  entre dois lugares e o segundo é uma medida; uma transição não distingue as
  duas razões de o valor mudar. Com o tempo ligado, remedir vira a barra
  deslizando até o lugar novo enquanto a caixa já saltou para lá — a barra
  correndo atrás da caixa. A medida desliga o tempo no quadro em que escreve e o
  rearma no seguinte, e é o MESMO mecanismo da carga: a primeira medida também é
  uma mudança de valor.

- **E ISSO RESOLVE O TECLADO.** Com o campo no topo da tela, o teclado — que
  sobe da base — não tem como cobri-lo. Era o defeito que quatro lotes da era da
  barra-na-base tentaram consertar por fora (v5.261, v5.264, v5.266, v5.270), e
  ele volta a existir no instante em que alguém puser a barra embaixo de novo.
  **Isto revoga a v5.263** pelo outro lado: aquele lote tirou o slide porque a
  barra morava dentro da folha e `transform` torna a folha o bloco-contêiner dos
  descendentes fixos; aqui a dívida é paga pela geometria, não pela remoção.
- **SÃO DUAS ALTURAS, e nenhuma POSIÇÃO** (`medirBarraDaBiblioteca`, v1.5.3):
  `--lib-bar-h` (a altura da barra, que é o que a caixa reserva) e
  `--lib-caixa-h` (a altura da caixa de controles). Onde a barra pousa é uma
  CONTA do CSS — `100svh - var(--kb) - var(--lib-caixa-h) - var(--sa-topo)`, a
  mesma que o `body` usa para a própria altura, menos a caixa: é assim que se diz
  *"o topo da caixa de controles"* sem perguntar onde ele está.
- **E MEDIR A POSIÇÃO ERA O DEFEITO** (v1.5.2 → v1.5.3). Relato do operador:
  *"o alinhamento da barra está completamente errado, está sendo cortado e
  deslocado em suas animações … você pode estar usando números fixos considerando
  a sua tela de testes"*. Uma COORDENADA DE TELA envelhece por caminhos que
  ninguém observa — **o `ResizeObserver` vigia TAMANHO, e o que move a caixa não
  muda o tamanho dela**. MEDIDO: o teclado sobe (no modo em que o navegador não
  reflui o layout, quem compensa é `--kb`), o app remede com ele no ar, o teclado
  some — e a barra fica **290px acima do lugar, flutuando sobre a lista**.
  Medindo só alturas, o instrumento e a grandeza passam a ser a mesma coisa.
- **EM TELA CHEIA NÃO SE MEDE** (v1.11.19). Relato do operador: *"ao voltar da tela
  cheia da preview, toda a seção da preview perde o espaçamento com a seção acima
  de busca, encostando a barra de busca na preview"*. A preview em tela cheia SAI
  DO FLUXO e a caixa de controles encolhe junto (MEDIDO a 390×800: 293 → 201px) —
  uma medida feita ali descreve uma caixa que não existe, e é a `--lib-caixa-h` que
  POSICIONA a barra. O `resize` da rotação a escrevia, e na volta quem a corrigiria
  seria o `ResizeObserver`, que só dispara na MUDANÇA contra a última medida que
  ELE viu: o shell esconde o Controle durante a tela cheia (`webContainer` GONE,
  sem quadros), e a caixa que volta com 293px é igual à que ele guardou — a barra
  ficava 92px abaixo do lugar, por cima do nome da mídia e da preview. **O conserto
  é não escrever** (`if (document.fullscreenElement) return` no
  `medirBarraDaBiblioteca`) **mais reconferir na saída** (`fullscreenchange`, em
  três tempos: já, dois quadros, 400 ms — a rotação de volta chega depois do
  evento). Cada peça tem a sua reversão no bloco 9 do `controles-layout`; a
  premissa ("o observador não vê a volta") é **EMULADA** — o arnês desenha quadros
  o tempo todo —, e a causa foi lida do código, **não reproduzida em aparelho**.
  - **E A SAÍDA TEM DUAS PEÇAS A MAIS (v1.11.20).** Relato do operador sobre o
    conserto acima: *"ele volta ao estado correto … mas está com um pequeno
    deslocamento, como se ao sair da tela cheia ele volte no estado com o bug, e
    no mesmo instante ele se ajusta"*. GRAVADO QUADRO A QUADRO, a ordem do aparelho
    é a OUTRA do bloco 9: o `fullscreenchange` de saída chega com a janela AINDA
    deitada, e a rotação de volta vem depois. Dois defeitos, o segundo MASCARADO
    pelo primeiro:
    · **o ouvinte de saída gravava a altura da PAISAGEM** (436px a 390×800, contra
      os 293 do retrato) — a barra no lugar errado até o `resize` do retrato
      corrigir. Fechado pela trava `libAssentando`: depois da saída só vale uma
      medida na MESMA orientação da última medida boa (`libOrientacaoMedida`), e
      uma rede de 1,5 s solta a trava para o aparelho que ficou deitado de verdade;
    · **a barra DESLIZAVA** (380px em 280 ms a 360×740) do lugar da paisagem ao do
      retrato: a posição dela é `translateY(100svh - …)` com transição, e a
      transição não distingue abrir/fechar de a altura da tela ter mudado. Antes
      isso ficava escondido — a medida de volta MUDAVA (paisagem e depois
      retrato), e quem grava desarma a transição de carona; sem a gravação errada a
      barra passou a deslizar. Fechado pelo `libAoGirar`: na MUDANÇA DE
      ORIENTAÇÃO (o teclado também dispara `resize`, e cortar a animação de
      fechar a Biblioteca seria defeito novo) tira o `lib-pronta` **e termina
      (`finish()`) a transição que já nasceu** — só a classe não basta, porque o
      `offsetHeight` do próprio `medirBarraDaBiblioteca` força o recálculo de
      estilo com a altura nova antes de ela sair.
    Bloco 10 do `controles-layout`, POR QUADRO e na ordem do aparelho, com o
    retrato de volta na MESMA largura de onde se saiu (com outra, a medida muda e
    o disfarce volta — foi o que a primeira versão do bloco provou). Reversões:
    sem a trava reprova a (A), sem o `libAoGirar` e sem o `finish()` reprova a (B)
    com 470px; só a ORDEM dos ouvintes não reprova nada (o `finish()` a torna
    irrelevante). **Também sem reprodução em aparelho.**
- **E A ÁREA SEGURA DO TOPO TEM NOME** (`--sa-topo`). O app é
  `viewport-fit=cover`, então `env(safe-area-inset-top)` vale no aparelho e é
  ZERO em todo navegador de mesa. Enquanto ela apareceu LITERAL nas duas fórmulas
  que dependem dela — o `padding` da folha e o RECORTE —, as duas podiam
  discordar sem nada reprovar: o recorte revelava `[0, altura da barra]` de uma
  folha em que a barra começa DEPOIS do recuo, e no aparelho saía uma faixa vazia
  em cima com a barra cortada embaixo. O nome faz as duas lerem o mesmo valor **e
  faz um oráculo poder fingir um aparelho com entalhe**
  (`barra-em-qualquer-tela.test.mjs`).
- **E A CAIXA DE CONTROLES É VIGIADA** (`ResizeObserver`). O lugar da barra é o
  topo dela, e ela muda de altura por caminhos que não passam pela medida: a
  proporção da preview, o nome da mídia em duas linhas, a seleção múltipla, o
  modo do app. Enumerá-los seria uma lista para envelhecer, e o modo de falhar é
  a barra pousando fora do lugar. O laço que o observador poderia criar (a medida
  muda o `padding-top`, que muda a caixa) é fechado do outro lado: a função só
  escreve **o que mudou**.
- **UMA MEDIDA QUE ANIMA PRECISA NASCER QUASE CERTA.** A translação transiciona.
  Enquanto o que se media era o deslocamento INTEIRO (60px de palpite contra
  847px medidos), a primeira escrita do JS varria a Biblioteca tela abaixo na
  abertura do app, com tudo por baixo dela intocável no caminho — MEDIDO no
  `smoke.mjs`, que encontrou todo ponto de uma linha respondendo `LI.coll-group`,
  o conteúdo da janela em queda. Escrita como `100% - barra`, o palpite erra por
  pixels.
- **E A TRANSIÇÃO SÓ LIGA DEPOIS DE O APP ASSENTAR** (`--lib-anim`, zero até a
  classe `lib-pronta`). Corrigir o palpite não bastou: **MEDIDO, a barra mede
  28,6px no primeiro quadro e 53px quando a folha assenta**, e essa correção
  também animava. Esta é a única peça do app cuja POSIÇÃO DE REPOUSO depende de
  uma medida, e toda medida chega depois do primeiro layout. **Dois quadros, e
  não um:** uma transição usa a duração do estilo DEPOIS da mudança, então ligar
  o tempo no mesmo quadro em que a medida entra produz justamente a animação que
  a guarda existe para impedir.
- **NO MODO FÁCIL A BARRA NÃO FICA À VISTA.** Aquele modo esconde a caixa de
  controles inteira, e enquanto a barra morava lá dentro (v1.5.0) ela sumia de
  carona; dentro da janela, sumir virou uma regra que alguém precisa escrever.
  Fechada, ela sai INTEIRA (`translateY(100%)`) e não só invisível: a janela
  recebe toque também fechada, e uma faixa transparente engolindo o dedo na base
  da tela é pior que a faixa à vista. A porta de lá continua sendo a LUPA da zona
  de leitura — e ela abre **sem foco**, porque é um botão: o ouvinte estava
  registrado por REFERÊNCIA (`addEventListener('click', openHymnSearch)`) e
  passava o `PointerEvent` como `comFoco`, que é truthy. Mesma armadilha que a
  v1.4.31 pagou no `openLyricsPopup`.
- **A CAMADA NÃO SOME, e é aqui que ela sai do molde.** Todo `.popup-backdrop`
  deste app é `opacity: 0` fechado; este não pode ser, porque a barra vive nele e
  está à vista o tempo todo. A camada fica opaca e sem fundo, o scrim vira um
  `::before` que esmaece, e o toque é roteado à mão: a camada só o recebe
  ABERTA (para o toque no fundo fechar) e a janela o recebe SEMPRE (para a barra
  funcionar fechada).
- **`transform`, não `height`**: altura anima no layout.
- **Ela NÃO é a folha das Ferramentas**: aquelas são filhas do `.list-body` e
  cobrem só a lista; esta é `fixed`, sai do fluxo e come o cabeçalho junto. O que
  ela DEIXA de fora é só a caixa de controles (v1.5.4) — e por baixo, não por
  molde: quem a limita é o recorte da camada, não um pai.

**O QUE A v1.5.0 TENTOU, e por que saiu:** a barra parada na caixa de controles
e a janela subindo de trás dela até uma folga do topo, para se anunciar como
janela. A folga custava duas coisas — o campo de texto atrás do teclado e a
lista caindo de ~880px para **576** (medido em 430×900). Hoje a lista vai da
barra até a linha dela (**602px**, medido em 430×900), e quem diz "isto é uma
janela" é o movimento. A barra voltou ao lugar da v1.5.0; o que não voltou é ela
ficar parada lá.

> **A ALTURA DA LISTA É FIXTURE DE ORÁCULO**, e já mudou três vezes. O caso do
> vão dos favoritos (`boot-nativo.test.mjs`) precisa de uma Biblioteca com
> categorias bastante para o vão ser PEQUENO — e maior que a seção vazia, que tem
> altura própria. Mexer nesta altura remede aquele fixture; o sinal é a primeira
> metade daquele caso reprovando com dois números diferentes.

