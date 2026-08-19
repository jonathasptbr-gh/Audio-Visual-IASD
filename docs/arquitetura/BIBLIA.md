<!-- Capítulo de docs/ARQUITETURA-WEB.md. O índice e as regras
     de desenvolvimento ficam lá; este arquivo é só este capítulo. -->

## Bíblia (aba `bible`)

Aba própria para **selecionar e projetar textos bíblicos**, com os dados vindos
do mesmo banco público do LouvorJA (ver `docs/FONTE-DE-DADOS-LOUVORJA.md` §5.6).
O cliente é `controle/bible.js` (`window.Bible`, JS puro), que reaproveita
o transporte de `louvorja.js` (`Louvorja.fetchList`) — sem novas credenciais.

### Duas fontes de dados

- **Estrutura offline (`Bible.BOOKS`)**: os **66 livros** do cânon (abreviação +
  nome + nº de capítulos + testamento `ot`/`nt`), fatos fixos embutidos em
  `bible.js`. Alimentam a seleção de livros/capítulos **sem rede nenhuma**, mesmo
  antes de qualquer download.
- **Online (baixada na 1ª vez que for usada)**: a lista de **versões**
  (`pt_bible_version` → `state.bibleVersions`), a lista de **livros** com o
  `id_bible_book` real (`pt_bible_book` → `state.bibleBooks`, só pra casar os ids
  — a exibição vem de `Bible.BOOKS`) e o **texto dos capítulos**
  (`bible_{v}_{b}_{c}` → cache `state['bible:<v>_<b>_<c>']`). `ensureBibleMeta()`
  busca versões+livros em segundo plano (no `init` e ao entrar na aba); é
  silenciosa (sem rede, mantém o cache). `bibleBookId(idx)` usa o id online
  quando há, senão cai em `idx+1` (ordem canônica).

**Download da versão INTEIRA na 1ª vez** (`ensureBibleVersionDownloaded`,
disparado por `enterBibleTab()` ao entrar na aba e ao trocar de versão): em vez
de baixar só o capítulo tocado, ao usar a Bíblia pela primeira vez o app baixa
**todos os 1189 capítulos** da versão selecionada em segundo plano — resumível
(pula o que já está em cache), concorrência limitada (`runLimited` com
`NET_CONCURRENCY`). O texto é leve (só versículos, sem mídia), então o volume total é modesto. O progresso
(`bibleDl`, memória) aparece **só dentro do popup de seleção de versão**
(`.bible-ver-status` por versão: "✓ Completa offline" / "Baixando N/1189…" /
"Baixa ao usar" — `refreshBibleDl` re-renderiza a lista enquanto o popup está
aberto), **sem disputar espaço com a leitura**; ao terminar sem falhas marca
`state['bibleComplete:<v>']` pra não refazer (cacheado em memória em
`bibleCompleteVersions`, populado pra **todas** as versões no `ensureBibleMeta`).
A leitura por capítulo (`loadBibleChapter`) continua baixando sob demanda como
fallback se o operador abrir um capítulo antes de o download em massa chegar
nele.

### A BÍBLIA BASE, garantida na abertura (v5.242)

Até aqui o download em massa **só** era disparado por alguém ENTRAR na aba
Bíblia (ou trocar de versão). Quem nunca entrou ficava com o caminho sob
demanda: um capítulo por vez, conforme o uso, com a rede da igreja no meio do
culto como única rede disponível. Foi o relato do operador — *"ela está baixando
aos pedaços conforme o uso"* — e era o oposto do que a aba faz assim que é
aberta uma vez.

`garantirBibliaBase()`, chamada no `init()` sem `await` (como o
`autoRefreshCollections`), garante **uma** versão offline por conta do app. O
paralelo com o hinário é exato num ponto e não no outro: lá o que chega sozinho
é a LISTAGEM, porque o áudio pesa; aqui o texto de 1189 capítulos é leve o
bastante para vir inteiro — e vir inteiro é o que torna a Bíblia utilizável sem
rede nenhuma.

**A versão é a que o app já escolheria** (`pickDefaultBibleVersion`: a Almeida
Revista e Atualizada, e a primeira disponível se ela não estiver no banco) — e
**não** `bibleVersionId`, que é a ESCOLHA do operador. A distinção é o recurso
inteiro: esta é a base que o app garante, não a preferência de quem opera. Quem
trocou de versão continua tendo a dele baixada pelo caminho de sempre, ao entrar
na aba; as duas convivem porque `ensureBibleVersionDownloaded` é resumível e
idempotente (uma versão já completa custa uma leitura de estado e volta).

**O freio de 25 falhas SEGUIDAS** (`BIBLE_DL_DESISTE`) nasceu junto, e nasceu
porque a automação o exigiu. Enquanto a varredura só começava por um toque na
aba, insistir até o fim era barato: havia alguém olhando. Automática na
abertura, um lançamento offline — ou com o Wi-Fi da igreja sem uplink, que este
projeto descreve como o ambiente normal — pagaria 1189 requisições fadadas ao
erro, com serviço em primeiro plano, wake lock e notificação, **a cada
abertura**. Vinte e cinco erros seguidos não são uma oscilação (a concorrência é
de 6: um blip produz meia dúzia): são a rede fora. Ele não grava
`bibleComplete`, então a versão segue pendente e a varredura é retomada no
lançamento seguinte — que é o que ela já fazia depois de qualquer interrupção.

O oráculo é o `tools/boot-nativo.test.mjs` (o único que sobe a base COM a
ponte), com o banco do LouvorJA de mentira e a ARA em **segundo** lugar na lista
de versões de propósito: `pickDefaultBibleVersion` cai na primeira disponível
quando não acha a ARA, e uma lista com ela na frente aprovaria os dois
comportamentos.

**O que já está em cache é descoberto com UMA leitura de chaves**
(`AVDB.stateKeys('bible:<v>_')` → `Set`), não com 1189 `getState`. Cada
`getState` abre a própria transação e desserializa o capítulo INTEIRO (~30
versículos de texto) só para testar existência — e essa varredura era refeita a
cada entrada na aba enquanto a flag `bibleComplete` não estivesse marcada. Uma
chave só existe quando o capítulo foi gravado com versículos (os dois pontos de
escrita conferem `vs.length`), então a presença da chave basta como teste.
Consequência boa: se a varredura mostrar que **nada falta**, a flag é marcada
ali mesmo — antes ela só era gravada com `failed === 0`, e uma única falha de
rede (o Wi-Fi da igreja) condenava a versão a revarrer para sempre.

**A varredura é identificada por SEQUÊNCIA (`bibleDlSeq`), não pela versão.**
Cada invocação ganha um `runSeq` monotônico, e os workers comparam com ele.
Comparar `versionId` era **reversível**: trocar de versão e **voltar** fazia os
workers da varredura antiga, ainda em voo, passarem no teste de novo e
retomarem em paralelo com a nova. Pior, a antiga terminava primeiro e — como os
capítulos que ela pulava saíam por um `return` sem contar falha — gravava
`bibleComplete` sobre uma varredura incompleta: flag **persistida**, versão
nunca mais completada. Com a sequência, um worker superado sai contando falha,
que é o que impede a marca de completude indevida.

**Persistência offline (não some entre sessões)**: os capítulos ficam no
IndexedDB (`state`, durável por natureza — sobrevive a fechar/reabrir o app e à
troca de bundle por OTA, que só substitui arquivos servidos). Além
disso, `enterBibleTab()` **e `garantirBibliaBase()`** pedem
`navigator.storage.persist()` — **a mesma
proteção do sync de músicas/pastas** — para o browser não descartar a origin sob
pressão de espaço (é origin-wide e idempotente). O download é **resumível**:
cada capítulo é gravado assim que chega, então uma interrupção não perde o que
já baixou — a reabertura pula o que está em cache e continua de onde parou.

> O texto de cada versículo pode conter marcação HTML (o app original renderiza
> com `v-html`); aqui `Bible.stripHtml()` extrai **texto puro** (troca de string,
> **sem** `innerHTML` — `<br>`→espaço, tags removidas, entidades comuns
> decodificadas), no mesmo espírito do `normalizeLyricText` da letra.

**Versão padrão: Almeida Revista e Atualizada** (`pickDefaultBibleVersion` casa
por nome — "revista e atualizada"/"RA"/"ARA"; senão a 1ª disponível). A troca de
versão **não tem botão próprio**: ela é o ÚLTIMO segmento da barra de
referência da tela de leitura (`part('Versão', …)`, uma `.bible-ref-part` como
Livro/Capítulo/Versículo), e o toque abre o popup `#bibleVerPopup` com a lista
— que não fica mais toda exposta em chips. **É na tela de LEITURA**, não na de
livros: ali a grade precisa da altura inteira. Persistido em
`state.bibleVersion`.

`changeBibleVersion` recarrega o capítulo atual na nova versão (mantendo o
versículo) e dispara o download da nova versão inteira. Duas coisas que ela
precisa fazer, e ambas nasceram de defeito:

- **Invalidar o `bibleLoadSeq`.** Sem isso, um capítulo lento pedido *antes* da
  troca voltava *depois*, passava na guarda de sequência (que não havia mudado)
  e sobrescrevia `bibleChapterData` com os versículos do capítulo/versão
  **antigos sob o rótulo dos novos** — e `startBibleReading` monta a sessão a
  partir daí, projetando o versículo errado com a referência certa. É o mesmo
  papel do `loadSeq` do stage.
- **Zerar o estado de erro/carregamento da grade.** Uma falha antiga ("Não foi
  possível baixar este capítulo") continuava na metade de baixo da tela mesmo
  com o capítulo novo já carregado e no ar.

### Seleção em "tabela periódica" (três telas)

`renderBible()` despacha por `bibleScreen` (`'books'`|`'chapters'`|`'reading'`),
renderizando dentro de `#library` uma **grade de células no estilo de uma
tabela periódica** (`.bible-grid` + `.bible-cell`): cada célula é um "símbolo"
(a abreviação do livro, ou o número do capítulo/versículo). O grupo/divisão
canônica de cada livro vem do campo `g` em `bible.js`, concatenado numa classe
(`'bg-' + b.g`: `lei`, `historicos`, `poeticos`, `pmaiores`, `pmenores`,
`evangelhos`, `atos`, `paulinas`, `gerais`, `apocalipse`) — por isso essas
classes **não aparecem literais em lugar nenhum fora do CSS**, e não são código
morto. Cada ladrilho é **tinta escura + faixa lateral de 3px** com a matiz do
grupo, não mais um bloco saturado: ver "Ladrilhos da Bíblia" no Design System
para o porquê e as medições. Sem número de índice e **só a abreviação** (sem o
nome completo, fonte maior). A grade de livros (`.bible-grid--books`)
**preenche a altura disponível** (11 linhas em `1fr`) pra caber **sem scroll**.

**Capítulo e versículo convivem numa tela só** (`'chapters'`), dividida na
vertical (`.bible-split`): em cima a grade de **capítulos**, embaixo a de
**versículos** do capítulo escolhido (`bibleVersesPane()`, que também rende os
estados "Escolha um capítulo acima." / "Baixando versículos…" / erro / capítulo
vazio). O **nome do livro fica em destaque no topo** (`.bible-book-head`) — sem
ele, uma tela só de números não diz em que livro o operador está.

As duas metades dividem a área **ao meio** e cada uma **rola por conta
própria** (`minmax(0,1fr)` nas faixas — sem o mínimo em 0, uma grade grande
como os 150 capítulos de Salmos esticaria a faixa e comeria a outra metade).

A **barra de rolagem fica sempre visível** nelas: no Android a barra é
"overlay" — só aparece durante o gesto e some —, então nada indicava que havia
mais capítulos ou versículos abaixo. Declarar largura em `::-webkit-scrollbar`
tira o modo overlay e a barra passa a ocupar espaço de verdade, o que é o que a
torna permanente (`scrollbar-width`/`scrollbar-color` cobrem o mesmo no padrão
novo). A grade ganha um `padding-right` para a última coluna não encostar nela.

> Houve uma tentativa de **encaixar tudo sem scroll**, encolhendo as células e
> repartindo a altura conforme o número de linhas de cada grade
> (`fitBibleGrids`, calculado em JS). Foi revertida: com Salmos ou o Salmo 119
> as células ficavam pequenas demais para acertar o toque, e a proporção
> variável fazia a tela mudar de cara a cada livro. Rolar com uma barra
> visível é mais previsível.

As duas grades marcam a seleção atual (`.bible-cell--num.active`: preenchimento
em `--accent-fill`, texto em `--on-accent` e `outline` da mesma cor; na grade de
livros, `.bible-cell.active` marca só com um `outline` em `--text`, para não
apagar a tinta do grupo), e é isso que faz **voltar da
leitura mostrar de imediato o capítulo E o versículo que estão no ar**, sem o
operador ter que se localizar — e sem procurar, já que nada rola.

Capítulos e versículos mantêm **tons distintos** (`--cell-chapter` em tom frio,
`--cell-verse` em tom quente) pra separar bem os dois níveis: as duas grades
são iguais em forma e conteúdo (só números) e ficam uma sobre a outra na mesma
tela — sem a diferença de temperatura, o operador perde de vista em qual das
metades está tocando. Fluxo: **livros → capítulo+versículo → leitura**; o botão
voltar (`#backBtn`) recua uma tela (`navigateBack` é `bible`-aware,
`gotoBibleScreen`), e cada troca faz um **leve slide direcional**
(`animateTabSwitch` reaproveitado; `BIBLE_SCREENS` dá a direção).

> Antes eram **quatro** telas — capítulo e versículo eram passos separados. Um
> versículo tem duas coordenadas dentro do mesmo livro; separá-las em telas
> obrigava a voltar uma tela só para trocar de capítulo, e ao voltar da leitura
> só se via a grade de versículos, sem pista de qual capítulo era.

Tocar num **capítulo** dispara `loadBibleChapter()`, que lê o cache ou **baixa
o capítulo na hora** (`Bible.fetchChapter`, gravado em `state`) — sem trocar de
tela: a metade de baixo mostra o estado enquanto isso. Guarda de sequência
(`bibleLoadSeq`) descarta downloads obsoletos numa troca rápida.

### Tela de leitura + projeção e navegação por slide

Tocar num **versículo** (`startBibleReading`) inicia uma **sessão de leitura**
(`bibleSession = { versionId, bookIdx, bookId, bookName, chapter, verses, idx,
projecting }`) e abre a tela `'reading'` — **mas NÃO projeta nada ainda**
(`projecting:false`). A tela de leitura (`renderBibleReading`, `.bible-read`)
mostra **quatro seções empilhadas** — versículo **anterior · atual · próximo ·
seguinte** (`.bible-vsec`): um atrás e **dois à frente**, porque ler adiante é
o que o operador faz (ele precisa saber o que vem para acompanhar a leitura,
não o que já passou).

**Cabe na tela sem scroll**: as quatro seções repartem entre si a altura que
sobra depois do rodapé (`flex: 1 1 0` + `min-height: 0` — é o `min-height` que
permite encolherem abaixo do próprio conteúdo; sem ele voltariam a empurrar a
tela). O **central recebe metade a mais** (`flex: 1.5`), então é o último a
apertar quando o versículo é longo. O texto que não couber é cortado com
reticências (`-webkit-line-clamp`): a íntegra vai para o telão, aqui basta
reconhecer o versículo. Rolar para achar o versículo central seria o oposto do
que essa tela serve. Embaixo, um **rodapé** (`.bible-read-foot`) com um **controle segmentado
único** (`.bible-ref-nav`) trazendo as quatro coordenadas do que está sendo
lido — **Livro · Capítulo · Versículo · Versão** —, cada uma levando ao seu
próprio seletor. Emendados, continuam lendo como uma referência
("João · 3 · 16 · ARA") em vez de quatro ações soltas.

**A VERSÃO É A ÚLTIMA** (v5.307). As três primeiras são a referência que se lê
em voz alta, na ordem em que ela é dita e na ordem em que o operador acabou de
escolhê-las (livro → capítulo → versículo); a versão não é coordenada do texto,
é em que edição ele está sendo lido, e trocá-la é a decisão mais rara das
quatro. À frente ela abria a barra por uma sigla de três letras e empurrava o
nome do livro — o único campo de largura imprevisível, e o que diz onde a
leitura está — para as reticências antes de qualquer outro. O arredondamento
das pontas sai de `:first-child`/`:last-child`, então ele acompanha a ordem
nova sem uma segunda regra; e a Versão continua saindo da barra inteira quando
não há lista de versões carregada.

A **versão entra pela sigla** (`bibleVersionAbbr`): "Almeida Revista e
Atualizada" ocupava a linha inteira e empurrava a referência para baixo, e a
sigla que todo mundo já usa diz a mesma coisa em três letras. As regras, em
ordem: um acrônimo entre parênteses no próprio nome é a melhor resposta
possível; um nome de uma palavra já é a sigla; senão, as iniciais das palavras
significativas (ignorando "e", "de", "na"…) — o que dá ARA, ARC, NVI, NAA,
NTLH, ACF. Sem `flex-wrap`: quem cede espaço quando a linha aperta é o **nome
do livro** (`.bible-ref-part--book`, o único de largura imprevisível), com
reticências.

**À direita da referência, na MESMA linha** (v5.109), os dois botões de guardar
(`.cue-save-btn`: ⊞ para o Cronograma, ★ para os favoritos). **Aqui eles são
maiores que a caixa padrão** (v5.112): em `--hit` (34px) ficavam 4px mais baixos
e 22px mais estreitos que as células de Livro/Capítulo/Versículo ao lado, e numa
linha só isso não se lê como "botão menor", se lê como desalinhado. A altura vem
de `align-items: stretch` no rodapé — eles acompanham a referência seja qual for
a altura dela, em vez de repetirem um número que precisaria ser mantido à mão nos
dois lugares. A v5.103 os pôs
numa segunda faixa porque com RÓTULO — "Ao Cronograma", "Favoritar" — eles
disputavam a largura com os quatro campos e empurravam a referência para
reticências. Sem rótulo o par mede ~74px e cabe: o que a segunda faixa custava
era ALTURA, e altura nesta tela sai da leitura, que é o conteúdo dela. É por
isso que a `.bible-ref-nav` ganhou `min-width: 0` — sem ele o padrão
`min-width: auto` a impediria de encolher, e "1 Tessalonicenses" empurraria os
botões para fora da tela em vez de virar reticências.

Antes a referência era um botão só, que sempre voltava à grade de livros —
trocar só o capítulo custava passar pela seleção de livro de novo. Capítulo e
Versículo levam à mesma tela porque as duas grades convivem nela. Cada botão
sincroniza `bibleSel` com a leitura antes de navegar, senão a grade abriria no
que o operador escolheu por último, e não no que está no ar. O status offline **não** fica aqui
(só no popup de versões — ver acima). Nos **limites de capítulo/livro**,
as seções anterior/próximo mostram o versículo do **capítulo vizinho** (cruzando
pro livro seguinte/anterior), com um **badge indicador** (`.bible-vsec-cross`,
borda tracejada — ex.: "◂ Livro anterior: Amós 9") **antes** de selecioná-lo; o
texto do vizinho é lido sob demanda (`bibleAdjacentVerse`/`ensureAdjLoaded`,
cache `bibleAdjCache`). Início/fim da Bíblia mostram "Início/Fim da Bíblia".

**Gate de ativação (`projecting`)** — o texto só vai pro telão depois de um
toque no versículo CENTRAL:
- Tocar no **anterior/próximo** (`.bible-vsec.adj`) → `bibleSetIdx` move aquele
  versículo pro central. Enquanto `projecting` é `false`, **só move** — nada vai
  ao telão.
- Tocar no **central** (`.bible-vsec.cur`) → `activateBibleVerse` liga
  `projecting` e **exibe** o versículo. O central ganha a classe `.live`, que
  troca a borda e a referência para `--danger-text` e prefixa o rótulo com
  "● No ar". Era **verde** até a v5.47, enquanto quatro outros lugares do app
  diziam "está no ar" em vermelho — duas cores opostas para a mesma mensagem,
  sem regra que o operador pudesse aprender (ver "As três famílias" no Design
  System).
- Já **ativado**, tocar no anterior/próximo (ou usar os botões de slide) **exibe
  automaticamente** o novo versículo (`bibleSetIdx` chama `projectBibleVerse`).

`projectBibleVerse` sempre marca `projecting:true` (é o ato de exibir);
`renderNowPlaying` só mostra a referência quando `projecting` (antes disso o
telão ainda não tem a Bíblia, então o now-playing segue a mídia normal).

A projeção usa a **Camada de Texto** unificada (ver seção "Camada de Texto"): o
comando `text` (`{ main, sub, mode:'verse', view }`) mostra o **texto do
versículo com a referência (dourada, em `sub`) ABAIXO dele** num cartão central
de **tamanho fixo**, tanto no **Display** (`#text` layer, ver abaixo) quanto na
**preview** do Controle (`#pvText`, `showPvText`) — a preview sempre espelha o
telão. `projectBibleVerse` monta esse comando via `cmd()`.

Os **controles de slide** (o toque curto em ⏮/⏭, que aciona as âncoras
`#slidePrevBtn`/`#slideNextBtn`, e os gestos
invisíveis da preview em tela cheia) **passam/voltam versículos** quando há
sessão ativa: `stepSlide` e `renderSlideNav` checam `bibleSession` antes da letra
sincronizada, chamando `bibleStep`. **No fim do último versículo do capítulo,
`bibleStep` pula para o 1º versículo do capítulo seguinte — cruzando para o
próximo LIVRO se preciso** (`nextChapterRef`/`prevChapterRef` +
`bibleGotoChapter`, que baixa o capítulo vizinho sob demanda e faz a seleção
acompanhar); os botões só desabilitam no começo (Gn 1:1) e no fim (Ap, último
versículo) da Bíblia. Cada troca reenvia um novo comando `text` (não `seek` —
não há áudio/tempo) e o **texto entra com fade** (`animateFadeIn`/`pvFadeIn` —
transições são inerentes ao sistema, ver o state `fade`); mostrar/
esconder a camada e o toggle de wallpaper usam a cortina com fade
(`coverIn`/`coverOut`). O mesmo fade curto entra nas trocas de estrofe da letra
sincronizada. O `#npName` mostra a referência atual; `play`/`pause` **NÃO** são
mais no-op — controlam o **áudio de fundo** quando há um tocando (ver
"Independência do áudio" na seção Camada de Texto); só viram no-op sem áudio de
fundo (o ouvinte de `playPauseEl` checa `!preview.getCurrent()`). Uma **mídia comum** (visual)
assumindo a cena (`send`) ou o **stop** (`stopClear`) encerram a leitura
(`clearManualText` = `clearBibleSession` + `clearMsgSession` + o Display/preview
escondem a camada). Um `send` de **áudio** com sessão de texto ativa **mantém** a
sessão (não chama `clearManualText`) — é o áudio de fundo. O `viewToggle`
(`setView`, ciente da sessão de texto) liga/desliga a **cortina compartilhada**
do wallpaper por cima do texto, sem passar por `preview.handle` (que recobriria —
não há mídia carregada no stage, a menos que seja o áudio de fundo).

**As guardas da Camada de Texto no Controle usam `pvTextActive`, nunca
`bibleSession`.** O Display sempre tratou os dois provedores de forma unificada
(`textActive`); o Controle checava só a Bíblia em dois pontos, e com uma
**Mensagem** no ar isso dava dois defeitos reais: (a) o `setView` caía no
caminho genérico → `setViewFaded` → `instantCover(computeCover())`, e como o
stage da preview está sem `current` a cortina voltava na hora — a mensagem
sumia da preview enquanto seguia corretamente no telão; (b) o ▶ caía em
`send(currentId)`, que chama `clearManualText()` e **tirava a mensagem do telão
no meio do culto**, quando pela documentação deveria ser no-op (e com a Bíblia
era). `previewTick` já usava o predicado certo — os outros dois pontos agora
também.

A projeção de texto é **independente da navegação de abas** (como qualquer outra
mídia): o `load()` (disparado a cada troca de aba) **não chama
`preview.setView` enquanto `pvTextActive`** — sem essa guarda, como o stage da
preview está sem `current` (a Camada de Texto é paralela), `setView` cairia em
`computeCover()===true` e recobriria a cortina, fazendo o texto sumir da preview
ao sair da aba. O Display nunca é afetado por troca de aba (só encerra o texto
com `load` visual/`stop`/`clear` explícitos).

### No Display

Layer `#text` (`.text-layer`), **`z-index:2` — acima de toda a mídia**
(`z-index:1`), inclusive do iframe do YouTube, que vem depois no DOM e com
z-index igual pintaria por cima do cartão. A cortina do wallpaper sobe para
`z-index:3` (nada é colocado sobre o wallpaper) e o escudo do YouTube para
`4`. Como `.layer` já traz `background: var(--stage-bg)`, o cartão é **opaco**: o texto
manual cobre a cena inteira, que é o que se espera de uma interferência
direta do operador.

**É essa opacidade que dá continuidade à cena.** Nada precisa ser
interrompido para o texto aparecer: a mídia segue tocando intacta por baixo —
áudio audível, vídeo rodando, posição preservada — e **reaparece exatamente
onde estava** quando o texto sai. Antes o `showText` derrubava o player do
YouTube (`ytDrop()`) para o cartão ficar visível, e não havia como voltar:
tirar o versículo do ar deixava a cena vazia.

`showText(cmd)` chama apenas `hideLyrics(true)` — a letra sincronizada é a única
coisa que sai de cena, porque ela **é** texto e o manual tem precedência — e
**NÃO chama `stage.clear()`** (o áudio de fundo segue tocando, ver
"Independência do áudio"); pinta `main`/`sub`, aplica a classe
`.mode-message` conforme o `mode` e revela conforme a `view`; um novo `text` já
em cena só troca o texto (sem piscar). Enquanto `textActive`, o roteamento de
comandos trata a Camada de Texto como paralela (igual ao YouTube): `load` de
**áudio** mantém o texto (troca o som de fundo), `load` de
**visual**/`stop`/`clear` chamam `hideText(false)` e seguem o fluxo;
**transporte** (play/pause/seek/volume/mute) cai no fluxo do stage (áudio de
fundo).

**O `view` DELEGA a quem é dono do estado, em vez de mexer na cortina por
fora.** Com o cartão de texto no ar, o ramo de `view` chama `ytSetView(v)` (se
há YouTube) ou `stage.handle({type:'view', view:v})`. Ele já chamou
`coverIn`/`coverOut` direto, e isso movia a cortina deixando `stage.view` /
`yt.view` **congelados no valor antigo** — um estado inconsistente cujo estrago
só aparecia **depois** do `text-hide`, o que tornava o defeito difícil de
associar à causa:

- o `view` seguinte comparava com o valor velho, concluía que nada mudara e
  **retornava sem fazer nada**: o botão de cobrir/mostrar o telão ficava morto,
  e o operador precisava tocá-lo duas ou três vezes;
- na direção oposta era pior — com a cortina cobrindo e `stage.view` ainda
  `'visual'`, o `play` seguinte reavaliava `computeCover()` e **descobria o
  telão sozinho**, expondo a mídia que o operador tinha coberto de propósito.

Delegar tem uma contrapartida a corrigir: o cartão de texto é **independente da
mídia** — um versículo no ar sem nada carregado é o caso mais comum na pregação
—, mas para o stage "sem mídia" (ou mídia terminada) quer dizer cortina
fechada, e o `instantCover(computeCover())` no fim do `setViewFaded`
reengoliria o versículo logo depois do fade. Por isso, ao voltar de um
`view:'visual'`, o Display **reafirma a cortina aberta** — reconferindo
`textActive`, porque o fade dura 0,6 s e nesse intervalo o texto pode ter saído
de cena, caso em que quem manda é o `restoreSceneAfterText`.

E é pela mesma razão que essa chamada passa **`overlay: true`** (v5.69): o stage
só enxerga o que ele mesmo desenha, e sem mídia a cortina cobre nos dois valores
de view — a guarda de `setViewFaded` (abaixo) pularia a transição inteira e o
versículo apareceria seco, sem o fade. O `overlay` é o aviso de que existe uma
camada por cima do stage, então descobrir revela ALGUMA coisa.

**Sair do texto devolve a cena** (`hideText(restore)` → `restoreSceneAfterText()`,
espelhado por `hidePvText`/`restorePvSceneAfterText` na preview): vídeo, imagem e
YouTube não precisam de nada — nunca foram interrompidos e reaparecem sozinhos
assim que o cartão sai da frente. Só a **letra sincronizada** precisa ser
remontada, e **no slide correspondente ao instante atual** da música
(`updateLyricSlide(stage.getTime())`; na preview, `authoritativeTime()`), não do
começo — a música avançou enquanto o versículo estava no ar. O parâmetro
`restore` é falso justamente quando algo novo já vai assumir a cena (load de
visual, `stop`, `clear`): restaurar ali faria a cena antiga piscar antes de ser
substituída. Como `showLyrics` retorna cedo enquanto `textActive`, trocar o
áudio de fundo com o texto no ar também funciona: ao sair, entra a letra do
áudio **atual**.

**E a última coisa que `restoreSceneAfterText` faz, para TODOS os tipos de
mídia, é reconciliar a cortina** (`reconcileCover(view)`: `coverIn(false)` se a
view é `'wallpaper'`, senão `coverOut()`). Antes só a letra era remontada e os
demais tipos devolviam cedo — mas o `showText` mexeu na cortina por conta
própria para o cartão aparecer, então sair de cena tem que devolvê-la ao que a
view vigente manda. Sem isso, um versículo tirado do ar com o telão coberto
deixava a cortina cobrindo uma mídia cuja view é `'visual'`, e o toque seguinte
no botão de visual não fazia nada — para o stage, nada havia mudado. O helper
existe porque a cortina é **compartilhada** (stage, YouTube e a camada de texto
mexem nela) enquanto o estado de view é de quem é dono da cena; `coverIn`/
`coverOut` devolvem cedo quando ela já está onde deveria, então chamá-lo à toa
não custa nem pisca nada no telão.

O texto (`.text-box`) usa o mesmo redimensionamento por Container Queries da
letra (`container-type:size` + `cq*`), mas em prosa (caixa-baixa) e **SEM
moldura, ocupando a tela inteira**. A moldura da letra sincronizada existe para
dar contraste contra a imagem de fundo da estrofe; aqui o texto é sempre
projetado sobre o preto, então a borda seria só uma caixa desenhada à toa — e,
pior, uma caixa FIXA e menor que a tela, que apertava textos bíblicos (bem mais
longos que uma estrofe) num espaço pequeno enquanto sobrava tela vazia em
volta. Agora o texto ocupa o que tiver: `.text-box` é `86cqw`/`86cqh` — o mesmo
espaço útil que o antigo `padding: 7cqh 7cqw` deixava, mas escrito como **fração
do container** em vez de padding percentual (ver "Redimensionamento por
Container Queries": unidades de container escritas no próprio container não se
referem a ele) — e a **fonte é bem maior** (`6.4cqmin`, contra
`4.8cqmin` da caixa antiga; `7.4cqmin` no modo mensagem). No modo `verse` a
**referência (`#textSub`) fica ABAIXO do texto** (ordem no DOM, `hidden` quando
vazia — mensagens não têm referência) e conteúdos muito longos continuam sendo
cortados com reticências (`-webkit-line-clamp: 8` + `overflow:hidden`), que é a
garantia final contra vazamento. A preview espelha tudo isso em
`.pv-text-*`.

---
