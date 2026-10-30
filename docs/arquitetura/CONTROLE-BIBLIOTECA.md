<!-- Parte do capítulo do Controle (o índice das partes está em CONTROLE.md;
     o mapa geral, em docs/ARQUITETURA-WEB.md). Partida do CONTROLE.md na
     revisão A3 (2026-10-30): o texto foi MOVIDO verbatim. -->

## Controle — as abas e a Biblioteca

> Parte do capítulo do Controle — o índice das partes e as regras que valem
> para o Controle inteiro estão em [`CONTROLE.md`](CONTROLE.md).

**Nesta parte:** [Abas e biblioteca](#abas-e-biblioteca) · [A tampa das coleções acompanha a altura da lista](#a-tampa-das-coleções-acompanha-a-altura-da-lista-v11214)


### Abas e biblioteca

#### Como um item ENTRA no Cronograma

Todos os caminhos convergem para o mesmo modelo — `addMedia`/`addCue` (registro +
lista na mesma transação) ou `listAdd('imports', id)` para o que já existe. Não há
segunda rota de importação: `importarPeloSistema` reusa `importShare` de
propósito, porque é lá que mora o roteamento por tipo.

| Origem | Caminho | Destino |
|---|---|---|
| "Importar arquivos" (seletor do sistema, shell ≥ 21) | `importarPeloSistema` → `importShare` → `escolherDestinos` | **os marcados** (simplificado: `avulsos`) |
| `<input type="file">` (navegador) | handler do `fileEl` | idem |
| Compartilhamento de outro app | `checkPendingShare` → `importShare` | idem |
| Música do acervo | folha de destinos → `addSongToDestinos` | **os marcados** |
| Resultado do YouTube | folha de destinos → `ytAcao` | `avulsos` \| **os marcados** |
| Arquivo de pasta do sistema, item de pasta, favorito | botão `+` da linha | `imports` |
| Link YT já no Cronograma → arquivo | botão de download da linha | substitui **na mesma posição** |
| Versículo em leitura | botão ⊞ no rodapé da Bíblia | `imports` (cue `verse`) |
| Mensagem da aba Ferramentas | `+` na linha da mensagem | `imports` (cue `message`) |
| Letra de uma música do acervo | seletor "Letra" + destinos | `imports` (cue `songlyrics`) |
| Cronômetro/timer configurado | os dois botões de "Guardar esta contagem" | `imports` \| `favs` (cue `chrono`) |
| Sorteio configurado | os dois botões de "Guardar este sorteio" | `imports` \| `favs` (cue `draw`) |
| A fila da playlist | "Guardar como pacote" | `imports` (cue `group`) |

##### UM item, VÁRIOS destinos

O item é o mesmo; o que muda é em quantas listas o mesmo id aparece, e isso nunca
foi uma escolha exclusiva. A tabela `DESTINOS` (em `controle.js`) é a fonte
única — `chave` é o nome como o app fala do destino, `lista` é o nome dele no
banco (o Cronograma é a lista `imports` desde antes de se chamar Cronograma),
`rotulo` é o nome do LUGAR ("Cronograma"), `acao` é o que se FAZ com ele
("Adicionar ao Cronograma") e `ico` é a chave do ícone. Ela substituiu o
`YT_LISTA`, uma SEGUNDA tabela com as mesmas três listas só para o YouTube; duas
divergiriam no primeiro destino acrescentado a uma só.

**E A ORDEM DA TABELA É CANÔNICA — Cronograma · playlist · favoritos** (v1.8.56,
pedido do operador: *"a esquerda o cronograma, no meio a playlist e por fim o
favoritos… aplique essa ordem a todo o app"*). Ela vale para toda superfície que
ofereça mais de um deles: as folhas de destino, a gaveta de uma linha, o rodapé
da fila e a faixa de fecho da playlist automática. **Onde falta um, a ordem
relativa sobrevive** — a linha do Cronograma não oferece "Cronograma" (o item já
está lá) e a da fila não oferece "playlist" (a linha É a fila).

**A DIVERGÊNCIA QUE ISTO FECHOU NÃO ERA DECISÃO DE NINGUÉM: eram QUATRO listas
escritas à mão** com a mesma tríade em ordens diferentes — as duas folhas de
destino (acervo e YouTube), o mapa `LINHA` da gaveta e o `DEST_ICONE` da folha de
importação. Uma tabela que só respondia *"quais existem?"* deixava *"em que
ordem?"* e *"com que cara?"* para cada chamador, e o quinto chamador ia divergir
também. **É por isso que `ico` e `acao` moram na tabela**, e que
`destinosNaOrdem(chaves)` existe: um chamador que peça `['playlist',
'cronograma']` — literalmente, na ordem antiga — recebe os dois na ordem da
tabela. A lista dele diz QUAIS, nunca em que ordem. Oráculo:
`destinos.test.mjs`, nos dois sentidos.

**A gramática é uma só, e vale para todas as folhas:** toda opção — as três
listas E o "Tocar agora" — é SELECIONÁVEL de corpo inteiro, e um botão de
confirmar sempre visível é quem executa. A caixa de marcação é INDICADOR
(`pointer-events: none`), senão o toque que cai nos 20px dela morreria num filho
sem ouvinte. Desabilitado, o confirmar diz "Escolha uma opção".

**E O CONFIRMAR TEM A ALTURA DAS LINHAS QUE FECHA** (v5.301, relato do operador:
*"parece menor que o padrão dos seus botões vizinhos"*). Estava, e por OMISSÃO:
quem dita a altura de uma linha de opção não é o `padding` do `.song-menu-btn`
(igual para todas), é o `.song-menu-check`, que reserva `--hit`. O confirmar não
tem check — não há o que marcar nele — nem ícone, então sobrava só a linha de
texto: 36px contra os 53px dos vizinhos. (Os 53px são os da FOLHA; dentro da
gaveta a linha mede 42px desde a v1.5.17, e a igualdade continua valendo porque
os dois leem `--opcao-recuo-v`.) A correção é o MESMO número dito no
mesmo lugar (o conteúdo dele reserva `--hit`), nunca um `min-height` na caixa que
teria de somar o padding à mão. O irmão "Ver a letra" acompanha de graça — a
faixa é um flex com `align-items: stretch`. `destinos.test.mjs` mede a IGUALDADE
das alturas, jamais um número: um piso em pixel aprovaria os dois errados juntos
no dia em que `--hit` mudar.

**O conjunto é da FOLHA ABERTA, não do item** (`destMarcados`, zerado por
`destLimpar()` na abertura e no fechamento). Pelo mesmo motivo que o teto de
resolução nasce no padrão a cada item: uma marcação que grudasse mandaria para os
Favoritos, sem aviso, o vídeo que se quis ver uma vez.

**"TOCAR AGORA" NASCE MARCADO ONDE A MÍDIA É LOCAL** (v1.1.8, `destPadraoTocar`).
Ela compra duas coisas: o caso de DOIS destinos vira um toque (com o telão já
marcado, tocar em "Adicionar ao Cronograma" projeta E guarda) e o CONFIRMAR nasce
ativo — a gaveta abre respondível em vez de com um botão morto pedindo escolha.

- **Só `renderSongMenu` (a faixa do acervo) e `renderItemMenu` (favoritos e
  pastas do aparelho).** A folha do YouTube fica de fora **de propósito**: ali
  "Tocar agora" TRANSMITE — abre rede, monta MSE e põe algo no telão — e as três
  linhas de lista significam "espere o download". Marcado por padrão, um toque em
  "Favoritar" começaria uma transmissão na frente da congregação por um destino
  que não pedia projeção nenhuma.
- **A marca nasce no ponto de ABERTURA, jamais no de render.** `renderSongMenu` é
  também o `destRemontar`: remarcar lá dentro tornaria o "Tocar agora"
  **impossível de desmarcar** — o toque tiraria a marca e o redesenho a
  devolveria, no mesmo quadro.

**A união é lida NO CLIQUE**, antes de `closeSongMenu()` — como a variante
Cantada/Playback e o teto de resolução. Uma leitura feita DENTRO da ação
encontraria o conjunto zerado e o item iria para UM destino em vez de dois, sem
erro nenhum. `tools/destinos.test.mjs` trava esse ponto.

**O redesenho da folha é um HOOK DE MÓDULO** (`destRemontar`), ao lado do
`destExecutor`, e não um argumento que cada chamador precisa lembrar de passar —
foi assim que o "Tocar agora" ficou uma versão inteira sem acender o check ao ser
marcado: o estado ficava certo e só o desenho não acompanhava.

Casos particulares:

- **Toda ação BAIXA**, e é isso que faz os destinos se combinarem: "Tocar
  agora" com "Cronograma" é UM download que também entra na lista. (Até a v1.7.7
  o "Tocar agora" sozinho podia transmitir sem produzir arquivo, e esse caso
  tinha de ser excluído à mão.)
- **Um download só** (`ytAcao`): o arquivo nasce na PRIMEIRA lista escolhida e é
  espalhado por `listAdd` (idempotente). "Já estava lá" é sobre o CONJUNTO — um
  vídeo no Cronograma e fora dos Favoritos não é duplicata.
- **A importação PERGUNTA** (`escolherDestinos`, a mesma folha como pergunta),
  com o Cronograma já marcado. É a única porta que precisa de confirmação porque
  não há ação nenhuma até o operador dizer para onde. **Desistir não perde o
  item**: fechar resolve `null` e o lote entra no Cronograma. Um link do YouTube
  compartilhado abre a folha própria dele (destinos + forma + qualidade), e
  perguntar duas vezes seria pior que não perguntar. No simplificado a pergunta
  nem é feita: ali não existe Cronograma nem playlist.
- **A seleção múltipla sobrevive ao destino:** a `#selbar` só redesenha a lista,
  e quem a fecha é o ✕, o voltar do aparelho ou desmarcar o último item.
- **As cenas de roteiro não precisaram de nada**: ⊞ e ★ são botões visíveis ao
  mesmo tempo e nenhum fecha a tela.

A frase do aviso nomeia TODOS os destinos (`ondeDe`/`juntarFrases` sobre o
`LISTA_ROTULO`) e separa o que ENTROU do que JÁ ESTAVA — é essa distinção que
impede o toque repetido. Um aviso por lista seria três faixas piscando para um
toque único.

#### A faixa de abas — SAIU NA v1.5.0

> **ESTA SEÇÃO DESCREVE UMA PEÇA QUE JÁ NÃO EXISTE**, e o aviso entrou na
> v1.8.81 porque o corpo dela está todo em PRESENTE: a faixa saiu inteira na
> v1.5.0 (com o `.tab`, o `.tab-add`, o `.tab-pl`, o vazado deslizante e o
> `switchTab`), e hoje a navegação são as portas do rodapé. Ela fica pelo
> que explica — por que quatro alvos viraram três, e por que nenhuma das cinco
> formas anteriores sobreviveu —, não pelo que promete. O token de altura dela,
> `--hit-nav`, saiu na v1.8.81; o que se lê aqui sobre ele é história.


Ela fica **no alto da caixa de controles** (`.bottombar`) e são **abas de
verdade**: uma fileira SEM trilho, encostada na borda de cima da caixa e indo de
borda a borda (`margin: 0 -.7rem`, que desfaz o padding lateral dela). **TRÊS**
alvos idênticos (v1.3.10) — **Cronograma** · **Bíblia** (as `.tab`) e o
**acervo** (`#hymnSearchBtn`, `.tab-add`) —, todos `flex: 1` e `--hit-nav` de
altura, transparentes enquanto não escolhidos.

> **Eram QUATRO até a v1.3.10**, e o quarto era Ferramentas. Ele saiu a pedido do
> operador, e o argumento fecha: a faixa é feita de LUGARES do culto — o roteiro
> e a Bíblia —, e ninguém "está nas Ferramentas" nem volta para elas. Elas viraram
> uma FOLHA do Cronograma (ver logo abaixo). Nada no CSS supunha quatro: a largura
> é `flex: 1` e o vazado é MEDIDO (`moveTabIndicator` lê `offsetLeft`/`offsetWidth`
> da célula ativa), justamente porque uma fração fixa quebraria calada no dia em
> que um alvo mudasse de tamanho ou sumisse — e este é o dia.

**A ativa é um VAZADO na cor do corpo**: pintado com `--bg`, o mesmo fundo das
listas logo acima, com raio só EMBAIXO — a aba e a tela que ela abre viram a
mesma superfície, que é o que a palavra "aba" sempre significou antes de virarem
botões. Quem confirma o estado é o **ícone em `--accent`**: o degrau `--bg` ×
`--bar` é 1,32:1, o piso das superfícies grandes, e num salão escuro isso sozinho
é pouco.

Quatro formas anteriores desenhavam uma CAIXA em volta da navegação (trilho de
cartão, fundos próprios por célula, segmentado, segmentado dentro da caixa de
controles) — quatro retângulos com fundo próprio se leem como quatro AÇÕES, e um
trilho por cima é uma segunda caixa dizendo "isto é um grupo", coisa que quatro
ícones lado a lado já dizem. O inverso (tinta nas NÃO escolhidas) foi testado e
revertido: a silhueta é a mesma, mas a mancha escura precisa acompanhar a aba EM
USO.

**O acervo continua SÓLIDO** (`--accent-fill`), dividindo a FORMA com as demais e
trocando só a tinta: na fileira convivem um ESTADO ("estou no Cronograma") e uma
AÇÃO ("abrir o acervo"), e sólido em accent é o que o app usa para "toque aqui e
algo acontece". A fileira inteira é lugar; ele é o único que age.

#### O vazado desliza

O preenchimento da aba ativa é um `<span class="tab-ind">` absoluto dentro da
`.tabs`, e não o fundo do botão: **um elemento pode se MOVER entre as abas; um
fundo que troca de dono só pode piscar de lugar**.

- **Posição e largura são MEDIDAS** (`moveTabIndicator()` lê
  `offsetLeft`/`offsetWidth` e escreve `--tab-x`/`--tab-w` em px), nunca uma
  fração fixa: "25% por aba" dependeria de as células terem sempre o mesmo
  tamanho — verdade hoje, e o tipo de suposição que quebra calada.
- **`moveTabIndicator(false)` POUSA em vez de viajar** (classe `no-anim` +
  reflow forçado antes de escrever os valores, senão o navegador agrupa as duas
  coisas na mesma passada e a transição roda assim mesmo). Usado ao ENTRAR no
  modo avançado (a caixa fica oculta no simplificado, e medir um elemento
  escondido dá 0) e num `resize` (girar a tela não é trocar de aba).
- **Os botões precisam de `position: relative`**, senão o indicador absoluto
  seria pintado ACIMA deles e cobriria o ícone da aba ativa.
- **A duração e a curva são as MESMAS da lista** (`--tab-move` no CSS,
  `TAB_MOVE_MS`/`TAB_MOVE_EASE` no JS): o vazado deslizando e a lista entrando
  pelo lado são dois efeitos de UM gesto. Viver em dois lugares é inevitável (um
  é transição CSS, o outro é Web Animations) — quem mexer num mexe no outro.

**A caixa de controles não tem `border-top` nem sombra**: as duas marcavam onde a
caixa começa e passaram a atrapalhar quando a fileira encostou no topo — a linha
cortava o vazado da aba ativa, e a sombra escurecia justamente a emenda entre o
vazado e o conteúdo, o ponto em que os dois têm de ser a MESMA superfície. O que
separa as duas caixas é o degrau de cor (1,32:1), que a aba ativa atravessa de
propósito.

As quatro células:

- **Cronograma** (`imports`) — itens importados; ficam até serem excluídos.
- **Bíblia** (`bible`) — ver a seção própria. O cabeçalho mostra "Bíblia" nas três
  telas dela: as internas têm nome próprio no corpo (`.bible-book-head`), mas a
  faixa de cima responde "em que aba eu estou".
- **Ferramentas** — **não é mais uma aba** (v1.3.10): é a folha `#toolsSheet`,
  descrita abaixo. `activeTab` não tem mais o valor `'mic'`.
- **Acervo** (`#hymnSearchBtn`, a lupa) — **não é uma aba**: não tem `activeTab`
  nem entra em `TAB_ORDER`. Abre o popup que é, ao mesmo tempo, o navegador de
  coleções (campo vazio) e a busca por nome/número/trecho de letra (ao digitar).

- **Favoritos** (`activeTab` segue sendo `'folders'`) — pastas criadas pelo
  operador e pastas do dispositivo sincronizadas no OPFS. Continua sendo um
  `activeTab` (com toda a navegação interna: abrir, buscar, sincronizar), mas
  desde a v5.53 é uma **gaveta que desce do topo** (ver a seção própria),
  aberta pelo botão do **canto direito do cabeçalho** (v5.103 — antes era o
  botão ao lado de "Importar arquivos", no fim do Cronograma, e chegar lá
  exigia rolar a lista inteira). O voltar e o sincronizar moram no cabeçalho DA
  GAVETA; `renderTabs()` mantém o Cronograma aceso enquanto ela está aberta,
  porque é ele que está atrás.
- **Mensagens** — foi para a aba **Ferramentas** (v5.31), como seção do
  acordeão. Antes era um botão flutuante sobre a preview; ver abaixo.

#### O download responde na MINIATURA, nunca numa faixa flutuante

Aviso pertence ao lugar onde a ação aconteceu. No caminho do YouTube o botão
NUNCA está visível (o `songMenuItem` chama `closeSongMenu()` antes da ação),
então `responder(btn, …)` caía sempre no aviso flutuante — no fluxo mais demorado
do app. Hoje o download só pulsa quando o botão por acaso está na tela; sem botão
visível, **silêncio**, porque a miniatura do resultado já troca o anel pelo ✓
(`setYtEstado('pronto')`).

**A falha ganhou o terceiro estado da MESMA miniatura** (`erro`, ao lado de
`baixando` e `pronto`): um download de minutos que termina em nada é o pior
silêncio possível do app. Em `--danger-text` sobre `--danger-soft`, e não
preenchido — vermelho preenchido é "está no ar agora". Some sozinho em 4 s e a
linha volta a aceitar o toque, porque tentar de novo é o que se quer depois de
uma falha de rede.

#### E a ESPERA DE UM LINK responde no mesmo lugar (v1.4.21)

Resolver um `kind: 'youtube'` leva **segundos** (a extração) ou **minutos** (o
download que vem depois dela), e nesse intervalo o `.no-ar` ainda não pode
acender — nada está no ar, e acendê-lo cedo é a mentira que o operador pediu
para não ter. O que faltava era o outro lado: sem nada na linha, o toque não
deixava marca no lugar onde ele nasceu, e o único sinal era o cartão sobre a
preview. **São perguntas diferentes** — o cartão responde *"o que vai entrar em
cena?"*, a linha responde *"o que este toque está fazendo?"* — e por isso as
duas existem ao mesmo tempo.

A anatomia é a do `.baixando`: o mesmo aro, na mesma miniatura, no mesmo
tamanho. Duas formas para a mesma espera fariam perguntar se são coisas
diferentes. **O que muda são duas coisas:**

| | `.baixando` | `.carregando` |
|---|---|---|
| a seta do `.dl-ring` | **conforme a LEGENDA** (v1.7.1) — ver abaixo | **não** (a regra da v1.4.20: o desenho segue o que está acontecendo) |
| a linha esmaece | **sim** — ali ela é PROVISÓRIA, o item ainda não existe | **não** — aqui ela é o item de verdade, prestes a entrar no ar |

#### A LINHA PROVISÓRIA: o ícone segue a LEGENDA, e ela ocupa o SUBTÍTULO

`libBusy(acao, nome, chaveExistente, aoCancelar)` — a assinatura ESPELHA a do
`previewBusy`, e isso não é simetria de enfeite: os dois desenham a MESMA espera
em dois lugares, e é a legenda que decide o desenho nos dois.

- **A seta é CONDICIONAL, aqui como no cartão** (`legendaEhDownload`, fonte
  ÚNICA dos dois desde a v1.7.1). O `.dl-ring` são dois desenhos: o aro diz
  *"espere"*, a seta diz *"bytes chegando"*. O cartão aprendeu isso na v1.4.19 e
  a linha ficou com a seta INCONDICIONAL — preparando uma apresentação, a
  miniatura prometia um download que não estava acontecendo, e a fase pré-bytes
  de um download de verdade (*"Preparando vídeo"*) prometia cedo demais. Ela
  ACENDE quando a legenda passa a dizer "Baixando" e APAGA de volta quando
  deixa de dizê-lo: o `atualizar` repinta o ícone junto com a faixa, senão o
  desenho ficaria preso na primeira legenda.
- **A LEGENDA ocupa a posição do SUBTÍTULO** (`.dl-prog`, dentro da `.row-text`
  e DEPOIS do `.row-name` — a pergunta é de ÁRVORE, e é ela que mantém a altura
  da linha). Ela vem por extenso, com a fração: *"Preparando página 4 de 8…"*.
- **A fração não custa parâmetro nenhum.** A linha já RECEBIA essa legenda — a
  mesma que a notificação do sistema mostra, escrita por quem TEM os números — e
  a descartava. Consumi-la entrega a fração de graça, e sem ninguém parsear
  frase nenhuma; um segundo lugar contando páginas divergiria no primeiro
  ajuste.
- **E A LINHA NÃO DESENHA O NÚMERO** (v1.7.4). Ela teve DUAS formas de desenhá-lo
  e as duas saíram: o `.dl-pct` solto (até a v1.7.1) e o trilho com preenchimento
  (só a v1.7.1). Pedido do operador: *"O subtitulo com as informações ficou muito
  bom, mas a barra de progresso ficou ruim, tire ela."* A legenda já diz o número
  por extenso, e um segundo lugar dizendo o mesmo — num filete de 4px, vezes
  trinta linhas — é o que este app tira de cena em toda passada. O `.dl-pct` fica
  onde ele continua sendo a única resposta: a lista de resultados do YouTube, que
  não tem subtítulo para ceder.
- **O `pct` continua no registro**, e não ficou órfão: quem desenha barra é a
  NOTIFICAÇÃO do sistema (`bgTaskStep`), a única janela do trabalho com o app
  minimizado. A barra saiu da LINHA, não do app.

##### E O `⋮` CEDE A COLUNA AO TRABALHO (v1.7.4)

Pedido do operador: *"por um botão, na mesma posição do botão de opções do item
do cronograma, para manter o design igual. A diferença é que esse botão só tem
uma função durante um preparo ou download. Esse botão cancela o processo e apaga
o item."*

É o movimento da v1.4.27 (a exclusão e a renomeação tomando a coluna emprestada)
aplicado ao trabalho: o `⋮` abre opções para um item que ainda não existe, ou que
está sendo escrito neste instante, e o toque numa delas cai no meio dele. Com o
trabalho no ar a fileira inteira sai de cena e o que fica é `.row-cancel` — um
`.row-btn`, para a caixa vir da mesma regra dos vizinhos em vez de um número
repetido (era um `.dl-cancel` de 34px ao lado de um `⋮` de 40).

- **"Apaga o item" tem LIMITE, e ele é uma decisão.** O toque cancela o
  PROCESSO, e o item que só existe por causa dele some junto — a linha provisória
  É a mídia que estava sendo preparada. Um item que JÁ ESTAVA no Cronograma (o
  único caso é o `ytDl`, converter um link do YouTube em arquivo) FICA: ali o
  operador pediu para parar o download, não para perder o item que ele tinha.
- **Sem alça de cancelamento não há botão** — e por isso as duas esperas que não
  sabiam parar ganharam uma (`alcaDeCancelamento`): a preparação de apresentação
  e a importação de arquivo. Um botão que às vezes não está lá é pior que botão
  nenhum.
- **A desistência é lida onde o laço é NOSSO.** No `.pptx`, `AVDeck.paginasDoPptx`
  recebe um predicado e para na página seguinte; no PDF quem rasteriza é o SHELL
  (`deckPages` não tem cancelamento), então o que se cancela é o DESFECHO — nada
  é criado, e o `deckDiscard` que já existia devolve as páginas ao lixo. A linha
  sai na hora nos dois casos, e o preço do segundo está dito: o shell termina de
  desenhar para o lixo. Na importação o ponto de parada é o `AbortController` do
  `fetch` do `/saf/`, que é o único que aquele caminho tem.

Oráculo: `tools/linha-da-preparacao.test.mjs`, com a REVERSÃO nas metades (seta
incondicional reprova a preparação; legenda descartada reprova a fração; sem alça
o botão não nasce).

**O estado vive num `Set`, não na classe do nó** (`linhasCarregando`) — a lista é
reconstruída no meio da espera (o `load()` do caminho do download), e uma classe
escrita no nó sumiria no redesenho seguinte. É a razão do `songRowBusy`, e é o
mesmo par de metades do `.no-ar`: `porCarregando` na CONSTRUÇÃO (nos dois
montadores — `renderLibrary` e `linhaDeItem`, senão um link nos Favoritos não
teria estado nenhum) e `pintarCarregando` na REPINTURA, que só troca classes.
`data-espera` marca o aro que a repintura pôs, para ela nunca remover o aro de um
download que esteja na mesma miniatura.

**Liga e desliga em `resolverLinkYoutube`**, ao lado do cartão e pelo mesmo
motivo: é o ponto por onde TODOS os caminhos do link passam — o toque na linha,
o avanço da playlist, o ⏮/⏭ do transporte, a notificação nativa. E ele
**sobrevive a perder a vez** (v1.4.18): tocar noutra coisa no meio da espera
abandona a PROJEÇÃO, não o trabalho em voo; apagar o aro ali faria a linha dizer
que parou o que continua acontecendo.

#### A linha da lista: nome + SUBTÍTULO

O tipo era um **selo** irmão do nome num `flex` em que o nome tem `flex: 1` —
isto é, disputava largura com ele: **a informação sumia exatamente nos itens de
nome comprido**, que são os que menos se distinguem entre si. E vídeo, áudio e
imagem nunca tiveram selo nenhum.

Hoje nome e tipo vivem numa coluna (`.row-text`) e o tipo é a **segunda linha**,
sempre visível. A linha continua com 51 px: a altura já era ditada pela miniatura
de 40 px, e duas linhas de texto somam ~35 px.

`subtituloItem()` diz **tipo + o detalhe que o registro já tem à mão**:

| Item | Subtítulo |
|---|---|
| vídeo | `Vídeo · 1080p · 4:32` |
| áudio | `Áudio · 4:32` |
| apresentação | `Apresentação · 12 páginas` |
| item de player | `YouTube · 4:32` — isto é, **depende da rede durante o culto** |
| item de URL | `Link externo` |
| cena de roteiro | o subtipo (`Versículo`, `Mensagem`, `Cronômetro`…) |

- **A DURAÇÃO vale para os três, não só para o áudio** (v1.5.21). Ela foi do
  `audio` enquanto só ele a tinha gravada; hoje o link e o vídeo do YouTube a
  gravam também (ver abaixo), e a régua nunca foi o *kind* — é *"o registro
  sabe?"*. Sem o dado, a linha sai exatamente como saía.

- **Nada aqui MEDE coisa alguma a cada render**, e é essa a regra que decide o
  que entra: a resolução vem do shell ou do `<video>` que já monta a miniatura, a
  duração sai de um `preload='metadata'` na importação, as páginas são um
  `.length`. Os campos `height` e `seconds` nascem no REGISTRO
  (`makeMediaRecord`).
- **Exceção consciente: a sincronização de PASTA não mede.** Ela percorre
  centenas de arquivos, e uma leitura de metadados por áudio ali é tempo que o
  operador sente para ganhar um detalhe numa linha.
- **A armadilha do `flex: 1`:** `.row-name` é filho DIRETO de `.row` em sete
  outras listas, e é o `flex: 1` dele que empurra os botões para a direita.
  Tirá-lo da regra base quebraria as sete de uma vez — ele fica, e é desfeito só
  dentro da coluna (`.row-text > .row-name { flex: none }`), porque num pai em
  coluna crescer significaria esticar na VERTICAL e descolar o nome do subtítulo.

#### A LINHA NO AR: `.active` × `.no-ar`, e o desligamento POR CAMADA

`.active` é o item ATUAL — o que o ▶ repete, e que sobrevive de propósito ao
Parar; `.no-ar` é o que está sendo PROJETADO agora. Como uma marca só, depois de
um Parar a linha seguia marcada com o telão vazio, e com uma cena de roteiro
sobre um louvor de fundo (duas camadas no ar) só uma das duas aparecia — isto é,
ela não respondia "o que está sendo projetado?", que é a pergunta que o segundo
toque (tocar de novo no que está no ar = tirar do ar) exige responder antes de
ser tocado. Quem responde são `linhaAtiva` e `linhaNoAr`, e esta lê `midiaNoArId`
**e** `cueNoArId` — as duas camadas, separadas.

**E `cueNoArId` cai quando OUTRO provedor assume o cartão de texto**
(`soUmProvedorDeTexto`, que já é o lugar único do rodízio). Sem isso o selo
ficava na linha do versículo enquanto o cronômetro projetava, e o toque seguinte
lia `noArAgora = true`: o operador pedia o versículo de volta e o que saía do
telão era o cronômetro. Só a TROCA zera — navegar entre versículos ou mensagens
reprojeta pelo MESMO provedor, e a cena de roteiro continua sendo a mesma.

O desenho de `.no-ar` é o mesmo "no ar" do resto do app (`--live-strong` sobre
`--live-soft`) e vem com **texto**: o selo `● No ar` prefixado ao subtítulo. Uma
cor a mais numa tela que já tem várias não ensina o que o segundo toque faz; a
palavra ensina.

**O desligamento é POR CAMADA — três portas:**

| a linha é… | o comando | o que continua |
|---|---|---|
| cena de roteiro (versículo, mensagem, cronômetro, sorteio) | `text-hide` | a mídia — o louvor de fundo segue tocando |
| mídia (áudio, vídeo, imagem, apresentação, YouTube) | `media-clear` | a Camada de Texto — o cronômetro segue no ar |
| — o **Parar** do transporte | `clear` | nada: é o ponto final, e está certo que seja |

Sem o `media-clear`, tirar a música de fundo levava o cronômetro junto e a única
saída era parar tudo e reprojetar a cena na frente da congregação.

**Quem escolhe a saída do palco é o DISPLAY**, não o Controle: `textActive` é
estado dele, e duplicar a leitura do outro lado é garantir que os dois divirjam
num domingo. Recebido o `media-clear`, ele manda ao stage `clear-media` (o
`fadeOutToBlack`, que esmaece o conteúdo **sem tocar na cortina**) quando há
texto, e o `clear` de sempre quando não há. A distinção não é estética: o cartão
de texto vive **por baixo** da cortina do stage — a mesma razão do
`instantCover(false)` do ramo de `view` —, então um `clearFaded` com texto em cena
fecharia o wallpaper por cima do versículo que continua no ar.

E o ramo do `media-clear` vem **antes** do bloco de `textActive` em `display.js`:
lá dentro `clear` é justamente o que chama `hideText`, e cair no fluxo comum
faria o comando atravessar até um `stage.handle` que não o conhece — sem erro,
sem log, com o cronômetro saindo do ar e nada que o explicasse.

**O PARAR mora DENTRO da miniatura** (`porParar`). Enquanto a linha está no ar,
tirá-la de lá é a única decisão que ela oferece — na fileira da direita ou dentro
da gaveta do `⋮` ele ficava atrás de um toque ou disputando espaço com ações que
ninguém quer ali. Na capa o alvo é o quadrado inteiro (`--thumb`), não custa um
pixel do nome, e fica sobre a única parte da linha que já dizia "é este item" —
que, com a mídia no ar, é literalmente o que está projetado. O conteúdo da
miniatura é escondido e o botão veste o mesmo preenchimento dos outros da linha:
sem foto por baixo não há o que neutralizar.

Uma função só (`porParar`) nas DUAS listas, senão duas anatomias iguais têm
desfechos diferentes — nos Favoritos ele não existia, e era ali que o operador o
procurava.

Por CSS, e não remontando a linha, porque **quem liga e desliga o estado é o
`marcarNoAr`**, que roda a cada `display-status` (~4 Hz) e só troca classes —
cirurgia de DOM nesse ritmo recriaria botões e perderia listeners quatro vezes
por segundo. O teste mede o RENDERIZADO, não a presença do nó: uma regra que
deixe de casar não apaga botão nenhum, ela só para de escondê-lo, em silêncio.

#### A faixa de álbum no ar (v1.13.14)

A faixa de um álbum é uma MÚSICA DE CATÁLOGO: ela não tem `data-id` (só
`data-song`, `songRowKey` = álbum + música), e a mesma música pode estar em dois
álbuns. Decisão do operador: *"acender apenas o álbum de onde está tocando o
item"*. Por isso ela acende pela **ORIGEM do toque**, não pela música:

| peça | o que faz |
|---|---|
| `data-album` | o `hymnResultRow` o escreve só com `semColecao` (a lista do card e o destaque da série). Um resultado da BUSCA é a mesma linha com a coleção embaixo, e não acende |
| `faixaPendente` | a chave da linha, escrita logo antes do `send` por quem toca a partir dela: `playSongVariant(…, origem)` (gaveta e Modo Fácil, via `simplePlaySong`) e o `ytAcaoInterno` (`r.__origemFaixa`, o episódio de série) |
| `faixaNoAr` | `{ chave, mediaId }`, fixado pelo `send` (que consome o pendente em TODO envio). Repetir pela fila (`daFila` com o mesmo id) mantém; qualquer outra porta — Cronograma, Favoritos, busca, sorteio, o "vídeo da semana" — solta |
| `pintarFaixaNoAr` | chamado pelo `marcarNoAr` (linha sem `data-id` e com `data-song`) e na montagem da linha: `.no-ar` e o selo `● No ar` prefixado ao NOME (a faixa de álbum não tem subtítulo, e criar um a faria crescer ao entrar no ar) |

**A cor tem regra própria:** `.coll-songs > .hymn-result` `(0,2,0)` e
`.acervo .coll-songs > .hymn-result` `(0,3,0)` vêm depois de `.lib-item.no-ar`
`(0,2,0)` e apagavam o estado; as variantes com `.no-ar` repõem `--live-fill`.
Oráculo: `faixa-no-ar.test.mjs` (a mesma música em dois álbuns, os dois temas).

#### Os botões da linha viram UM SÓ (o `⋮`)

A coluna de texto é `flex: 1` entre a miniatura e uma fileira que **cresce com o
estado do item** — estrela, `+`, o par ↑↓, o download de um link do YouTube, o
Parar quando está no ar: até quatro alvos de `--hit` mais os `gap`, e quem paga é
sempre o nome, a única coisa da linha que não se adivinha.

`montarAcoesDaLinha(li, botoes)` é o funil único — devolve `[caixa, ⋮]` e é
chamado pelo `renderLibrary` e pelo `favItemRow`, para as duas listas não
divergirem. As decisões:

- **A caixa é ABSOLUTA e cobre do fim da MINIATURA até o `⋮`**
  (`left`/`right: calc(var(--thumb) + 1rem)`, a mesma conta dos dois lados).
  Partindo de `--hit` ela come 6px da capa — as duas colunas são as mesmas, então
  errar uma é errar a outra.
- **O fundo é COMPOSTO, nunca herdado.** `background: inherit` copia o VALOR, e o
  valor de uma linha no ar tem alfa .22: a faixa pintava translúcido POR CIMA do
  título, que continuava legível atrás dos botões. Hoje a base é o token opaco
  `--linha` e o estado entra como camada, como a `.row` se pinta.
- **Uma aberta por vez** (`linhaAcoesAberta`): duas seriam duas faixas cobrindo
  dois nomes, e o operador teria de fechar a errada para ler.
- **O fechamento de fora é `pointerdown` na fase de CAPTURA**, não `click`: ele
  fecha ANTES do clique, que é o que impede o menu de piscar por cima do que está
  sendo tocado (e um gesto que não termina em `click` fecha do mesmo jeito).
- **Escolher uma opção FECHA**, e esse ouvinte também é de CAPTURA por um motivo
  que não é preferência: todo botão de linha chama `stopPropagation` no próprio
  `click` (senão o toque acionaria o corpo da linha atrás), e um ouvinte de bolha
  na caixa **não veria nenhum deles**. **Exceções**, pela régua "a ação que NÃO
  TERMINA a conversa com aquele item": o par ↑↓ (reordenar se repete) e a
  ESTRELA (alternador — o desfecho dela é o próprio botão mudando sob o dedo).
- **O vazio da caixa fecha também**, e é a saída barata de quem só queria ler a
  linha: sem ele o único caminho de volta seria acertar o `⋮` outra vez.
- **O redesenho fecha** (`fecharAcoesDaLinha()` no topo do `renderLibrary` e do
  `renderFolderList`): a caixa é remontada a cada render, e a referência velha
  apontaria para um nó fora do documento.
- **O EXCLUIR é o primeiro da faixa**, isto é, o mais longe do `⋮` — que fica
  colado na ponta e é o alvo tocado repetidamente. Do outro lado o vizinho é o
  VAZIO da caixa, que também fecha, mas é área larga em que ninguém mira a borda.
- **E A ORDEM DO RESTO É A QUE O OPERADOR DITOU** (v5.302): **excluir ·
  renomear · favoritar · playlist · ↑ · ↓**. Ela agrupa por NATUREZA — o que
  mexe no ITEM, o que mexe em ONDE ele está, o que mexe na POSIÇÃO dele —, e a
  anterior separava os dois pares que se parecem (o renomear caía entre a
  playlist e o par de ordem). O "baixar o vídeo" de uma linha de LINK não está
  na sequência porque só existe nela: entra depois da playlist, para não a
  partir ao meio. **A mesma ordem vale nos Favoritos**, sem os que não existem
  lá — ver a seção da faixa de ações.
- **O ícone é SVG inline.** `more_vert` (U+E5D4) **não está** no subset de 31
  codepoints de `material-symbols.woff2`, e glifo ausente desenha um retângulo
  vazio sem erro nenhum.
- **Na seleção múltipla não há `⋮`**: ali o alvo é o conjunto, e a linha volta a
  ser uma caixa de escolha.
- **UMA medida para os quadrados da linha** (`--thumb`): capa, botões da linha e
  `⋮`. Miniatura de 40px com botões de 34px são dois quadrados vizinhos com 6px
  de diferença que ninguém decidiu, e um alvo no PISO do app justamente na lista
  mais densa. A linha não fica mais alta — quem já ditava a altura era a capa.
- **A CAIXA ABRAÇA O CONTEÚDO, entre um piso e um teto** (v5.301). A caixa era um
  retângulo FIXO, então a largura dela é a da tela menos duas colunas de 56px — e
  cinco botões de 40px com `gap: .35rem` ocupam **222,4px** em qualquer aparelho.
  Com o sexto botão a fileira passa a **268px**, e a caixa fixa dava isto:

  | viewport | caixa | com 6 botões |
  |---|---|---|
  | 360px | 222,4px | avança **37,6px** sobre a capa |
  | 384px | 246,4px | avança 13,6px |
  | 393px | 255,4px | avança 4,6px |
  | 400px | 262,4px | não toca (sobram 2,4px) |
  | 412px | 274,4px | não toca (a folga de 8px de sempre) |

  **Abaixo de ~400px a fileira não cabia**, e como `.row-btn` é `flex-shrink: 0`
  o excedente era desenhado POR CIMA DA MINIATURA. Não é caso de aparelho antigo:
  360px e 384px são larguras correntes de Android, e qualquer aparelho cai nelas
  quando o operador aumenta o **tamanho da tela** nas configurações do sistema.

  Hoje o `left` virou um PISO (`min-width`, a largura de sempre, para um grupo
  curto continuar cobrindo o título inteiro) e a caixa cresce **só para a
  esquerda e só o que precisa** — de 400px para cima, zero —, até um teto de
  `.5rem` da borda do cartão. Do SÉTIMO botão em diante os quadrados caem para
  `--hit` (34px), nunca menos; o sétimo é a linha de LINK DO YOUTUBE, a única que
  traz o "baixar o vídeo". `smoke.mjs` mede a 360px de propósito: os quatro
  oráculos de Chromium rodam a 430px, onde cabia, e era essa a razão de o defeito
  publicar verde.
- **SEM LUGAR AO LADO DA CAPA, A FAIXA TOMA A LINHA INTEIRA** (v1.12.53). Pedido
  do operador: *"Atualmente em telas menores, ele sobrepõe apenas parte da
  thumbnail, ficando estranho … quando for uma certa largura, ele realmente oculta
  a thumbnail, distribui corretamente a largura que sobrou para os botões de
  opções."* O "cresce só o que precisa" acima deixava meia capa debaixo de um
  botão. Hoje a pergunta é binária e MEDIDA (`acertarFaixaDaLinha` — nunca um ponto de quebra): a SOMA das larguras dos
  botões à vista, mais os vãos, contra o vão de layout entre a capa e a borda
  direita da caixa.
  - **Cabem:** nada muda — a capa fica, e é ela que diz de qual item é o menu.
  - **Não cabem:** `.acoes-cheias` leva a caixa da borda do cartão (`.5rem`) ao
    `⋮`, a capa sai de vista (`visibility: hidden`) e os botões se DISTRIBUEM
    (`space-between`): o primeiro onde a capa começava, o último colado à borda.
  - **Nem a linha inteira comporta** (`.acoes-justas`): MEDIDO, seis quadrados de
    40px pedem 268px e a 320px a linha dá 224. Os quadrados descem a `--hit` (a
    descida do sétimo botão) e o vão sai; só encolhem abaixo do piso se nem assim
    couberem, porque desenhar por cima do `⋮` é pior.
  - **A confirmação de excluir fica de fora** (`:not(.confirmando)`): com dois
    filhos a caixa volta ao piso, e a LIXEIRA que ocupa a capa tem de estar à vista.
  - Mede na abertura (`alternarAcoesDaLinha`), na reabertura depois do redesenho
    (no quadro seguinte: o `li` ainda não está no documento) e num `resize`.
  Vale para toda lista que monta a faixa por `montarAcoesDaLinha` com capa
  (Cronograma, Favoritos, as mensagens). Oráculo: `cronograma-acoes-cheias.test.mjs`
  (430 · 360 · 320×1,25).

#### O toque encolhe o CARTÃO, não o miolo dele

O feedback tem de ser `transform` no `.lib-item`, que é quem carrega a BORDA, e
não na `.row`: enquanto ela é transparente dá no mesmo, mas com ela visível
(`.no-ar`, `.active`, `.selected`) o miolo se afasta de uma moldura parada e abre
uma fresta dos dois lados.

MAS uma linha NÃO dá feedback por um toque dentro de um bloco que ela apenas
HOSPEDA (o `⋮`, a gaveta, a pasta aberta inline): ali já existe outra resposta, e
duas ao mesmo toque poluem o conjunto. Como `:active` não se simula por API, o
oráculo afirma a REGRA: o alvo do `transform` é a peça com a borda.

#### O subtítulo diz DE ONDE o item veio

`subtituloItem` compõe `tipo · álbum` quando o registro tem `hymnAlbum` — o mesmo
campo do slide de capa, preenchido também para o acervo já baixado
(`preencherAlbunsDosHinos`). **Não há leitura nova**: é o registro respondendo o
que já sabe. Numa lista de culto com três "Ó Adorai o Senhor" de hinários
diferentes, o álbum é o que distingue um do outro.
#### A Biblioteca: a barra no TOPO, sem cabeçalho e sem "baixar tudo"

A folha é uma TELA: sem "Baixar toda a biblioteca" (um alvo do tamanho do
cabeçalho para uma ação de dezenas de gigabytes, no topo da tela em que se
procura UM louvor — baixar coleção por coleção continua no card de cada uma), sem
peso total, e **sem cabeçalho**: ele foi encolhendo por partes até virar uma
faixa inteira repetindo o nome do botão que abre a tela. A barra de busca é o
topo da folha, e é isso — não um mecanismo de posicionamento — que a mantém lá.

**A busca fica no TOPO**, e ela já morou na BASE por ALCANCE. O preço da posição
de baixo está no registro: **quatro lotes seguidos consertando o entorno dela** —
a folha que não via o teclado (é dela que veio a descoberta de que
`.popup-backdrop` é `position: fixed` e nunca viu a conta de altura do `<body>`),
o teclado subindo durante o fade, o tom e a sombra que faltavam, o degrau do tema
claro. Quatro lotes em volta de uma posição são a posição dizendo que não se
paga. O preço da de cima está dito: corrigir a busca com o teclado aberto custa a
tela inteira de percurso do polegar.

**O que fica da era da base, porque nunca foi sobre estar embaixo:** o ✕ DEPOIS
do campo (é o fim da linha em toda folha deste app), a LUPA dentro do campo (o
placeholder some no primeiro caractere digitado) e o TOM próprio com a SOMBRA —
esta INVERTIDA, porque ela diz de que lado o conteúdo passa e a lista deixou de
rolar por cima da barra para rolar por baixo dela. Sai a conta do teclado no
`padding-bottom` da barra e volta a área segura — no `padding-bottom` da LISTA
desde a v1.5.1, e não da folha: quem termina a janela ABERTA é a lista, e a
folha agora tem a barra na base quando fechada. Sem essa folga o último item
fica sob a barra de gestos. O ✕ é QUADRADO por um número com nome (`--campo-alt`): dentro de um flex
o `aspect-ratio` não resolve, porque a largura é resolvida ANTES de o `stretch`
dar uma altura definida (a primeira versão colapsou o botão em 20px).

**O TECLADO SOBREPÕE**: `.popup-backdrop` é `inset: 0`, sem `--kb` e sem
`--vv-top`. As duas contas existiram enquanto a barra morava embaixo (para
encostar no teclado em vez de ficar atrás dele) e enquanto a camada precisava
seguir a viewport visual (para a barra do topo não sair pela borda); com a barra
no topo e o cabeçalho fora, quem rola é a LISTA e a folha inteira encolhendo e
subindo era só efeito colateral. **O `.dialog-backdrop` FICA com a conta**, e a
diferença é a razão dela: o `appPrompt` é um cartão CENTRADO com campo de texto,
e ali a metade de baixo é onde o teclado sobe. (Desde a v1.13.7 a conta dele é
`--kb-folha`, e não `--kb`: o cartão sobe e o app por baixo fica — ver
"Deslocamento com o teclado virtual".)

**A ROLAGEM PARA DENTRO DA LISTA.** A estrutura sempre esteve certa (rolar
`#hymnResults` 116px não move um pixel da barra); o que se mexe no APARELHO é a
PÁGINA — a rolagem que chega ao fim de um scroller ENCADEIA para trás, e do
Android 12 em diante o excesso é o efeito STRETCH, que estica e desloca a camada
inteira, barra fixa incluída. `overscroll-behavior: contain` no `.popup-list`
corta o encadeamento (os outros três scrollers do app já o tinham), mais
`overscroll-behavior: none` na raiz para um gesto que comece fora de qualquer
lista.

**E a lista abre no topo** (`hymnResultsEl.scrollTop = 0` no `openHymnSearch`): o
nó é o MESMO entre uma abertura e a seguinte, então ele guardava a rolagem da vez
anterior e a Biblioteca reabria no meio de um hinário.

#### O rodízio das coleções, e os Favoritos ocupando o vão

```
 ┌───────────────────────────┐   ┌───────────────────────────┐
 │ ★ Favoritos          ▲    │   │ ★ Favoritos          ▲    │
 │   Louvor de abertura      │   │   Louvor de abertura      │
 │   Vídeo do testemunho     │   │   Vídeo do testemunho     │
 │                           │   │   … (a lista INTEIRA,     │
 │        (o vão)            │   │      passando do vão)     │
 │                           │   │   …                       │
 ├───────────────────────────┤   ├───────────────────────────┤
 │ ▸ Provai e Vede 2026      │   │ ▸ Provai e Vede 2026      │
 │ ▸ Informativo Mundial     │   │ ▸ Informativo Mundial     │
 │ ▸ Hinário Adventista 2022 │   │ ▸ Hinário Adventista 2022 │
 │ ▸ Hinário 1996            │   │ ▸ Hinário 1996            │
 │ CDs oficiais/ano     ▼    │   │ CDs oficiais/ano     ▼    │
 └───────────────────────────┘   └───────────────────────────┘
   com a seção ABERTA (desde a      passando do piso, a seção CRESCE
   v1.1.4 é preciso tocá-la): o     e empurra as fechadas para baixo,
   vão é o PISO dela, mesmo         com a Biblioteca rolando
   com a lista vazia
```

**O vão conta TODO vizinho, não só as seções** (`medirVaoDosFavoritos`). Desde a
v1.0.1 as coleções fixas são cards da RAIZ, irmãos das seções na mesma `<ul>`:
somar só `.coll-group--drop` devolvia um vão maior que a tela e empurrava as
fechadas para FORA dela — o oposto do que o vão existe para produzir. A conta
procura a barra pelos dois nomes (`.coll-group-bar, .coll-bar`) e cai na altura
do próprio bloco quando não há nenhuma.

**TUDO NASCE FECHADO, e fechar a Biblioteca DEVOLVE a esse estado** (v1.1.4,
`resetarBiblioteca`). Pedido do operador: *"faça o padrão da biblioteca ser os
grupos todos fechados e compactados. Inclusive toda vez que fechar a biblioteca,
reset para o estado padrão… atualmente os favoritos vêm abertos, mas isso era
antes de eu tirar de dentro dos grupos o Provai e Vede e o Informativo das
Missões, o que apertou o espaço disponível. E futuramente haverá mais grupos"*.

O `favAberto = true` da v5.276 respondia a uma tela com dois cabeçalhos de
coleção; hoje são quatro cards fixos na RAIZ mais as seções, e cada série nova é
mais uma barra. A seção aberta RESERVA o vão, e o vão é o que falta quando a
lista de barras cresce.

O reset zera `grupoAberto`, `favAberto`, `pastaAberta`, o `gruposAnimar` e o
`expanded`/`shown` de cada card. Ele existe porque o estado de navegação é de
MÓDULO e o nó do popup é o MESMO entre uma abertura e a seguinte (a razão do
`scrollTop = 0`): sem ele, a Biblioteca reabria com o hinário de 613 hinos
escancarado de uma consulta de meia hora atrás. **No FECHAR e não no abrir**: ali
a tela já saiu de cena, e nada do que se colapsa é visto colapsando.

**São DOIS estados, e não um.** `grupoAberto` é o rodízio das COLEÇÕES (uma
aberta por vez) e `favAberto` é a seção dos Favoritos, que responde só a si
mesma. No mesmo nome, abrir um hinário custava o atalho que o operador tinha
deixado aberto, e reabri-lo custava fechar o hinário: duas decisões diferentes
disputando o mesmo interruptor.

Com um nome só para as coleções, "duas abertas" deixa de ser um estado que alguma
guarda precisa impedir — é uma frase que não dá para escrever. **`''` é
legítimo**: nenhuma coleção aberta é o estado normal de quem está olhando os
favoritos. (Isto REVOGA a v5.237, cujo argumento — "os grupos são curtos, e
comparar dois deles é o que se faz numa tela de índice" — supunha que a tela
cabe.)

**Quem ocupa o vão são os Favoritos, e SÓ eles.** Fazendo a seção ABERTA crescer,
qualquer que fosse, uma coleção curta ficava com meia tela de fundo vazio
embaixo. Uma coleção aberta mede o conteúdo dela e nada mais; o vão é dos
Favoritos, a única seção com razão para tê-lo (uma lista de atalhos vazia ainda é
o lugar em que o próximo entra).

**O VÃO NÃO É REPARTIDO.** Como `flex: 1 1 auto` ele era DIVIDIDO com a coleção
aberta, e os favoritos encolhiam conforme o operador abrisse outra coisa.
`--fav-vao` é uma altura em PIXELS, medida em JS (`medirVaoDosFavoritos`) a
partir das BARRAS das outras seções — o que sobra da tela com todas elas
colapsadas —, então a conta **não depende de qual coleção está aberta**, que é a
propriedade inteira. `flex: 0 0 auto` impede o flex de mexer nela nos dois
sentidos.

**E ELE É UM PISO, NÃO UMA ALTURA** (`min-height`). Como `height` exato ele
RECORTAVA o corpo, e do recorte vinha um botão "Ver todos" que hoje não existe:
não há mais nada escondido, e quem rola é a Biblioteca. Como piso, a seção
reserva o vão com a lista vazia e cresce com o conteúdo. O `flex-shrink: 0` é o
que faz o piso valer: um `min-height` num filho que encolhe é só uma sugestão.
(`medirVaoDosFavoritos` não muda por causa disso — a medida é a mesma pergunta.)

O `requestAnimationFrame` em volta da MEDIDA do vão é obrigatório: quem chama
`acertarVaoDosFavoritos` durante a montagem da lista ainda vai anexar as outras
seções na mesma passada síncrona, e a conta soma a barra de cada uma. Medir na
hora leria uma tela com metade das seções e devolveria um vão grande demais.

**A coleção que abre rola até o topo dela** (`alinharGrupoNoTopo`): uma coleção
aberta no fim da lista cresce para fora da tela, e quem a abriu fica olhando a
barra dela sem ver um item. **O alinhamento espera a animação do acordeão**
(`ACC_MS + 30`, nunca um `requestAnimationFrame`): durante os 220 ms da abertura
o conteúdo ainda não existe e a lista não tem para onde rolar — em rAF ele media
o layout COLAPSADO e rolava 7px de 59 possíveis. Sem conteúdo abaixo que leve a
seção ao topo, a lista rola até o fim, que é o mais perto que existe.

**E ELA ABRE E FECHA NUM MOVIMENTO SÓ (v1.12.56)** — relato: *"a coleção de
favoritos, que ao fechar, encolhe, e dá uma pequena travada antes de realmente
fechar"*. O piso é a armadilha: o acordeão anima só o CORPO, e o bloco com
`min-height: var(--fav-vao)` parava no vão até o redesenho tirar o `.aberto` —
e então caía, com as irmãs fechadas saltando depois (a tampa delas desconta o
vão dos Favoritos abertos). Por isso o `alternar` dos Favoritos tem caminho
próprio: `fecharFavoritosAnimando` anima o bloco (`height` + `min-height`) até a
altura fechada — `calcularTampa(lista, true)`, a conta do `medirTampa` com os
Favoritos contados como fechados — e cada irmã FECHADA até a altura LIDA com a
tampa de depois escrita por um instante; no fim, o redesenho e a `medirTampa`
saem no mesmo quadro. `abrirFavoritosAnimando` anima o `min-height` da altura
fechada ao vão no quadro seguinte ao redesenho (depois do vão e da tampa, junto
com o `expandAccordion`). Mesmos `ACC_MS`/`ACC_EASE` do corpo; uma irmã ABERTA
não anima. Oráculo: `favoritos-fechar.test.mjs`.

**E NENHUM CARD DO ACERVO É REDESENHADO NO MEIO DO ACORDEÃO (v1.12.57)** — relato:
*"O mesmo problema da coleção travando no último instante antes de fechar, ocorre no
modo simples com o provai e vede e o informativo das missões"*. O redesenho refaz os
cards a partir do ESTADO, e no fechamento o estado só muda no FIM da animação: um
`renderSearchResults` no meio dela (o tique do progresso, ou um `renderCollectionsNow`
direto como o da verificação da semana) devolvia o card aberto e inteiro até a
animação antiga, num nó já fora do documento, terminar. `marcarAnimacaoNoAcervo`
conta os acordeões do acervo em curso: o tique (`refreshCollectionsIfVisible`) se
rearma com QUALQUER um, e o `renderCollectionsNow` direto vira o tique só com um
FECHAMENTO — na abertura ele segue o primitivo sem guarda que o
`gaveta-no-download` afirma. O card que vai ABRIR fica seguro desde o desenho até o quadro da animação (`segurarAcervo`, v1.12.58) — um tique nesse vão o trocava por um card sem a curva. **E o recuo do corpo anima com a altura**
(`caixaDoAcordeao`): com `border-box`, `height: 0` não passa do `padding`, e o card
ficava parado ~14px acima da altura fechada no fim da curva (o recuo de CIMA vai a
`min(.35rem, --tampa-topo)` desde a v1.12.59). Oráculo: `serie-no-modo-facil.test.mjs` (desde a
v1.13.15 sobre o card do Hinário 2022: a série não é mais card no Modo Fácil).

**E O TÍTULO DE UMA SEÇÃO NÃO ANDA (v1.12.58)** — relato: *"Ao abrir a coleção dos
favoritos … há um mínimo deslocamento vertical do título"*. A seção aberta segue a
regra do card: `--tampa-topo` em cima e, embaixo da barra, `max(0, --tampa-topo −
.35rem)` (o corpo já traz `.35rem`). O respiro dos Favoritos ABERTOS é o da tampa de
quando eles FECHAM (`calcularTampa(lista, true)`), porque abertos eles saem da conta
dela. Sem folga (`topo < .35rem`) o título fica e a tampa cresce `.35rem − topo`. E o
recuo de cima do corpo anima até `min(.35rem, --tampa-topo)` da seção, nunca a zero nem
inteiro (`recuoFechadoDoAcordeao`, v1.12.59): é parte da tampa, e com a lista cheia
(tampa no piso, respiro zero) o inteiro não cabia na caixa fechada e o flex o centrava —
o cabeçalho tremia 2,8px no fim do fechamento. Oráculo: `favoritos-fechar` A8–A10 e o
bloco C (celular, lista cheia); o resíduo é o `lista-da-biblioteca` F1b.

**NO MODO FÁCIL A SEMANA DA SÉRIE NÃO É UM CARTÃO (v1.12.57 → v1.13.15).** A queixa
era o `--sel-fill` do `.serie-destaque` virando um cartão azul dentro do card escuro.
Desde a v1.13.15 a série nem é card no Modo Fácil: as linhas da semana moram no bloco
"Este sábado" da raiz (`.semana-raiz`), que veste o `--poco` de um bloco de raiz — a
mesma tinta de um card fechado — e põe o ▶ na coluna do ícone da barra de um card
(`.55rem`, o recuo da `.coll-bar` naquele modo; a linha larga o `.5rem` da `.hymn-row` e
a divisória desconta o mesmo). No avançado o destaque fica preenchido — ali ele separa
a semana da lista inteira. Oráculo: `serie-no-modo-facil`, bloco C.

**A seção NÃO tem tom próprio.** Ela não é uma coleção e só ela ocupa o vão — as
duas coisas são verdade e **nenhuma se lê como COR**: o nome no cabeçalho diz a
primeira e o vão reservado diz a segunda. O que a cor acrescentava era um QUARTO
tom numa escada de três. A classe `.coll-group--fav` fica e responde a duas
perguntas: quem ocupa o vão, e quem pinta os FILHOS como itens em vez de álbuns.

**E OS FILHOS DELA NÃO SÃO COMO OS DAS OUTRAS SEÇÕES:** numa coleção são ÁLBUNS,
aqui são ITENS — e sem regra própria a linha de favorito e o card de álbum
pintavam **1,00:1**, a mesma cor literalmente.

```
 seção (--btn-accent)               seção (--btn-accent)
   └ card do álbum (--btn-accent)     ├ placa dos itens (--btn-accent)
       └ faixa: RECESSO ─────────┐    │   └ favorito: RECESSO ─────┘
                                 └────┤        a MESMA cor, por construção
                                      └ pasta sincronizada (--btn-accent)
                                          IRMÃ da placa: cor de ÁLBUM
```

A receita é a da faixa (`.coll-songs > .hymn-result`): um recesso (`--surface`,
que dentro de uma seção da Biblioteca é o par `sunk`) sobre uma base de nível de
card. **As duas metades são inseparáveis, e a segunda foi imposta pela medição** —
feita quando a seção ainda pintava `--panel` (antes de a v1.5.9 lhe dar caixa
própria) e é ela que explica por que a PLACA existe: só o recesso, sobre o tom da
seção, resolvia no escuro (1,58:1 contra o card) e FALHAVA no claro, onde a seção
era BRANCA e o recesso compunha `#dbdbdb`, a 1,02:1 do card. Com a base de card
por baixo a composição vira a MESMA da faixa dentro de um álbum, que é a
propriedade que continua valendo hoje: MEDIDO sobre `--btn-accent`, 1,24:1 no
escuro e 1,17:1 no claro nos DOIS lugares.

**A PASTA SINCRONIZADA CONTINUA SENDO UM ÁLBUM** — ela guarda muitos arquivos, é
um CONTÊINER. Os dois níveis querem bases DIFERENTES e uma `<ul>` só não oferece
as duas: sobre o tom da seção o ITEM mede 1,03:1 (some), sobre a placa a PASTA
mede 1,00:1. Daí a **placa dos itens** (`.fav-itens`, criada em
`renderFolderList` e só quando há item), que PINTA `var(--camada)` e vira o
contêiner de nível 2 desta seção — o lugar que num hinário é do card de álbum.
Com ela o par volta a ser o MESMO do álbum, em dois elementos: `.hymnal-card`
pinta e `.coll-songs` zera o degrau seguinte. **As pastas não ganharam regra
nenhuma**: são filhas diretas do corpo, que já reserva o tom de card para os
filhos dele — a cor de álbum é o PADRÃO ali. (Desde a v1.5.10 esse tom é
`--btn-accent`, e a Biblioteca não tem mais `--panel-2` em lugar nenhum.)

*(Acumular os dois papéis numa peça só obriga o reset de `--camada` a morar na
regra da LINHA, senão ele vence na hora de o corpo resolver o próprio
`background` e o bloco sai transparente — a armadilha de "A CAMADA" com a
assinatura invertida.)*

**O oráculo mede a COR EFETIVA, nunca a declarada.** Os recessos deste app são
overlays com ALFA, e `getComputedStyle` devolve o alfa: uma asserção sobre o valor
declarado compararia `rgba(0,0,0,.24)` com um `#3c4753` opaco, diria que eles
"diferem" sem ter medido cor nenhuma, passaria com o defeito no lugar e
reprovaria a correção. Ele sobe a árvore compondo até o primeiro fundo opaco.

**Trocar o `display` ACORDA o que estava dormindo.** `.coll-group` é
`display: flex; align-items: center; gap: .5rem`, e o `.coll-group--drop` a
neutralizava com `display: block`. Pôr a seção aberta em `display: flex`
ressuscitou as duas: a barra encolhia ao próprio texto e se centrava (medido:
204px numa seção de 408) e as linhas mais largas que o card vazavam pelos DOIS
lados. Daí o `align-items: stretch; gap: 0` na mesma regra. **Remover uma
declaração devolve o valor de quem estava embaixo; trocar o `display` ATIVA o que
já estava escrito e não fazia nada.**

**E o `gap` das seções não é o das linhas** (`#hymnResults { gap: .6rem }` contra
os .35rem do `.popup-list`): uma seção é um bloco que CONTÉM linhas, e a mesma
medida nos dois níveis os faz se ler como uma pilha só. Escopado no id, nunca na
classe — o mesmo `.popup-list` é a fila da playlist e o conteúdo de uma pasta.
#### A coletânea que se DISSOLVE noutra (`controle/coletanea.js`, v1.5.16)

Pedido do operador: *"os albuns do celebra SP, serão individualmente colocados
na coleção de 'diversos'. Não identifiquei independência suficiente para que ele
tenha uma coleção só para ele."*

O catálogo de coletâneas vem do banco LouvorJA, e o nome das seções é decisão de
quem publica lá. Este é o mesmo desenho das SÉRIES e do HINÁRIO: uma **regra
PURA no web**, com oráculo em Node (`tools/coletanea.test.mjs`), sobre um dado
cru que o app não controla — invariante 5. A tabela tem uma linha:

```js
const DISSOLVER = [ { de: ['Celebra SP'], para: ['Diversas', 'Diversos'] } ];
```

- **DISSOLVER, não remover.** MEDIDO: descartar a categoria deixa os álbuns
  ÓRFÃOS, e `renderCollectionsListMiolo` os recolhe num bloco *"Outros álbuns"* —
  o mesmo número de blocos, com um nome pior. `aplicar()` MOVE os álbuns para o
  destino e só então a origem deixa de existir.
- **A regra roda no DESENHO, nunca no `fetchAlbumCatalog`.** O catálogo fica
  semanas no IndexedDB; aplicada na busca, uma correção por OTA só valeria depois
  da próxima sincronização COM REDE. Aplicada no render, ela vale na abertura
  seguinte, inclusive offline — e o catálogo cru continua cru no aparelho, que é
  o que torna a tabela reversível numa linha.
- **E ela tem DOIS consumidores no mesmo `render`**: o laço que desenha as
  seções **e** o `claimed` que decide quais álbuns ficaram órfãos. Chamar só num
  deles devolve *"Outros álbuns"* pela porta dos fundos — é a metade que o
  `boot-nativo.test.mjs` prende, e que nenhum oráculo da regra pura alcança.
- **Destino ausente é IDENTIDADE, e a origem FICA na tela.** É a única decisão do
  arquivo que contraria o pedido, e é deliberada: um destino renomeado no banco
  faria a origem sumir levando os álbuns dentro dela, e o desfecho seguro é o de
  antes da regra. `sem-destino` sai no Registro.
- **A comparação é por IGUALDADE sobre o `normalizar` do `serie.js`** (mesma
  função, copiada verbatim), nunca `includes`: *"Diversas"* casaria com
  *"Diversas Antigas"*. E a lista de aceitos do destino tem as DUAS grafias — o
  operador escreveu *"diversos"*, a seção no aparelho chama-se **"Diversas"**
  (conferido em `site/telas/biblioteca.webp`), e nenhuma normalização une as duas.
- **Os movidos entram no FIM do destino, com o `order` reescrito**, e passam por
  dedupe contra o que já estava lá (o conjunto de destino é congelado ANTES de
  mover, senão dois álbuns iguais vindos da origem se anulariam entre si).
- **O Registro tem o bloco** (`blocoColetaneas`), com o motivo de cada movimento:
  uma coletânea que some da tela sem explicação é indistinguível de um catálogo
  que veio menor.

#### O orçamento da lista COLAPSADA, e o véu das bordas (v1.5.16)

*"Remover esse grupo … fara com que todas as coleções caibam na tela enquanto
estiverem colapsadas, sem a necessidade de rolar. Inclusive, aproveite para
reajustar o tamanho dos cards das coletâneas e espaços, para que eles aproveitem
exatamente esse espaço."*

A metade editorial é a regra acima. A metade geométrica é uma CONTA, medida a
430×900 com **582px** de caixa de lista:

| blocos | antes | depois |
|---|---|---|
| 9 | 553,9px (cabia) | — |
| 10 | 615,1px (rolava) | **551,1px (cabe)** |
| 11 | — | 605,9px (rola) |

O que apertou foram as DUAS barras — `padding` de `.55rem` para `.35rem`, e
`--bar-secao-h` de `calc(var(--hit) + 1.1rem)` para `+ .7rem`.

- **APERTAR e não ESTICAR, e a razão é o vão dos FAVORITOS.** Esticar os cards
  até o encaixe exato levaria aquele vão de 131px a 55px, e a seção passaria a
  rolar quando aberta — desfazendo a v5.273/v5.277, que o operador pediu duas
  vezes.
- **E o segundo preço, que é a leitura literal do pedido:** apertar AFASTA do
  enchimento exato em vez de aproximar. Com os 9 blocos do acervo dissolvido a
  lista ocupa 496,3 dos 582px e sobram **~86** — contra os ~28 que sobrariam sem
  o aperto. *"Aproveitem exatamente esse espaço"* virou *"caibam com folga"*, e
  preencher exigiria esticar. (No aparelho a sobra é MENOR: os cards com
  subtítulo — as duas séries, os hinários com peso — são mais altos que a barra
  nua desta conta.)
- **E a promessa vale de 430px para cima.** MEDIDO: a 393×786 (entalhe de 39px,
  caixa de 436px) cabem 7 blocos nos DOIS desenhos — ali o aperto não compra
  bloco nenhum; a 360×740 (24px, 420px) ele vai de 6 para 7. Com 9 blocos, os
  dois continuam rolando.

**O VÉU DA BORDA** respondeu à outra metade do relato — *"um efeito de blur na
borda interna superior ou inferior, quando algum elemento da tela ir para debaixo
dessa borda"*. São dois pseudo-elementos `position: sticky` DENTRO do scroller.

**ELE DEIXOU DE SER DESTA LISTA NA v1.8.58**, quando o operador pediu o mesmo
efeito em todo scroller do app (*"Faça esse o padrão de efeito para os
scrolls"*) e escolheu o mecanismo (*"sombra de verdade"*). O que valia aqui e
continua valendo está no `CLAUDE.md`, na seção da paleta; o que era próprio
desta lista é só o degrau de camadas abaixo. **O `backdrop-filter` saiu** — era
ele, e o custo dele, que prendia o efeito a um scroller só.

- **Ele DEIXOU de sumir sob a tampa grudada na v1.8.59.** Até ali a tira era
  `z-index: 2`, abaixo dos 3/4 das tampas — e a razão escrita era que ela se
  calava onde já houvesse quem respondesse. `z-index`, porém, é propriedade do
  ELEMENTO e não do estado "colada": MEDIDO, a `.coll-group-bar` lia razão
  1,0000 em qualquer posição, inclusive na borda de baixo, e o fundo a 26px dela
  lia 1,1553. A tira subiu para `z-index: 5`.
- **Ele só existe quando MENTIRIA ao não existir.** `.tem-acima`/`.tem-abaixo`
  saem de um ouvinte de `scroll` em CAPTURA no `document` (um só para todos os
  scrollers) e de um `MutationObserver` do documento inteiro, os dois
  coalescidos por quadro. As regras que o DESLIGAM já não repetem
  `.popup-backdrop--lib.open`: com o seletor genérico (`.rola:not(.tem-acima)`)
  não há a disputa de especificidade que uma vez deixou o véu aceso no topo da
  lista, exatamente onde ele mente.
- **As QUATRO medidas do recuo são LIDAS do layout** (v1.8.59): a de baixo desde
  a v1.5.16 (sem ela a tira gruda acima do recuo), e o topo e os dois lados
  desde este lote — sem eles o vão entre a fronteira e a sombra é exatamente o
  `padding` do scroller, que aqui são 11,2px no topo e 12,8px de cada lado.
- **AS PORTAS FLUTUAM SOBRE A LISTA** (v1.8.61) — `#listFoot` é
  `position: absolute` no `.list-body`, e a lista corre por baixo até a
  fronteira. Ver o CSS para os três desenhos medidos e por que a margem negativa
  foi recusada (o número passa a definir a EXTENSÃO, e a lista para antes da
  fronteira quando o rodapé cresce com a fonte do sistema). A folga do fim é a
  altura do rodapé LIDA mais o recuo de antes, e a tira de sombra desconta a
  faixa das portas para marcar a fronteira VISÍVEL.
- **E O CABEÇALHO É UMA BARRA DA COR DOS CONTROLES** (v1.8.61), de borda a
  borda, com o vão até a lista virado `padding-top` DELA — assim a borda de
  baixo da barra é a borda do scrollport, e a linha some encostada nela. As duas
  folhas (Ferramentas e Bíblia) recuperam um degrau de `--sp-5`, senão a borda
  de cima delas cai de 1,410 para 1,192 no escuro (a sombra da folha deixa de
  pousar sobre `--bg` e passa a pousar sobre `--bar`, que separa menos).
- **MAS A TIRA SÓ ALCANÇA A BORDA SE A CAIXA ALCANÇAR** (v1.8.60). `overflow-y:
  auto` COMPUTA `overflow-x: auto`, e a margem negativa é RECORTADA pela caixa do
  scroller: MEDIDO no Cronograma, forçar `--veu-esq`/`--veu-dir` a 12,8px não
  move a tira um pixel. Foi por isso que o `#library` passou a levar o recuo
  como `padding` próprio, com `margin` negativa devolvendo a caixa à borda da
  tela — o desenho que a Biblioteca e a playlist já tinham. **E a calha da barra
  de rolagem é inalcançável**: o retângulo de recorte é o padding box MENOS ela.
  No Android ela é ZERO (barra sobreposta), então lá não há vão.

#### A divisória entre faixas IRMÃS (v1.5.16)

*"Verifique a criação de um elemento de linha divisória (não borda inteira), na
listagem do itens propriamente dos álbuns, para melhor distinção entre os
itens."*

```css
.acervo .coll-songs > .hymn-result + .hymn-result::before {
  content: ''; position: absolute; pointer-events: none;
  top: 0; left: var(--faixa-coluna-texto); right: 0; height: 1px;
  background: var(--divisoria);
}
```

- **É ARITMÉTICA, não gosto.** Desde a v1.5.14 a faixa é transparente e a placa
  atrás dela é `--panel`: o vão de 4px entre duas faixas mede **1,00:1** contra
  os dois lados — separação nenhuma. `--divisoria` dá **1,88:1** no escuro e
  **1,99:1** no claro.
- **Não é a moldura voltando.** A moldura eram quatro arestas por nível, em três
  níveis, carregando a HIERARQUIA — o trabalho que a alternância faz hoje com
  degrau real. Esta é UMA aresta, num nível só, entre irmãs, e faz o que a
  alternância por construção não faz.
- **O `+` é o recurso inteiro**: ela nunca aparece antes da PRIMEIRA faixa, onde
  o que separa é a barra do álbum.
- **O recuo é o *"não borda inteira"* do pedido.** Ela começa em
  `--faixa-coluna-texto` (o recuo da linha + a miniatura + o vão), nunca sob a
  miniatura — e é por isso que não pode ser uma `border-bottom`, que cobre a
  caixa e não tem como ser recuada.
- **O oráculo cobra a EXCEÇÃO nos dois sentidos** (`tools/tokens.test.mjs`): uma
  varredura NEGATIVA por qualquer bloco de 1px pintado (reprova todos os outros)
  e uma POSITIVA exigindo que `--divisoria` tenha um consumidor só. Sem elas o
  precedente que entraria no repositório seria *"filete pode, desde que não se
  chame border"*.
- **A LISTA DE RESULTADOS DA BUSCA TAMBÉM A TEM (v1.11.16, de lado a lado na v1.11.17)** — pedido do operador: *"durante a pesquisa na
  biblioteca, a listagem de itens de resultados não possui uma linha divisória entre os resultados"*. Com o campo
  preenchido as linhas (`hymn-result`, e os vídeos do YouTube, `hymn-result yt-result`) são filhas DIRETAS de
  `#hymnResults`, na cor da placa, e o vão de `--sp-5` lê 1,00:1. É a MESMA receita: o seletor
  `#hymnResults > .hymn-result + .hymn-result::before` entrou na regra do traço, e a metade do vão mora dentro da
  caixa (`padding-top` = `margin-top` negativo = `--sp-5 / 2`) — para TODA linha, senão o preenchimento de estado
  (a escolha do Modo Fácil, a gaveta aberta) mudaria de altura com a posição. **A primeira linha cola no topo do
  scroller com a caixa 4,8px acima dele (recortada) e o conteúdo no mesmo lugar** — MEDIDO: os `.row` ficam nos
  mesmos y de antes. Nada entre o `.yt-head`/botão do YouTube e o primeiro vídeo (não é `.hymn-result`). **DE LADO A
  LADO (v1.11.17):** a v1.11.16 a recuava até a coluna do texto de cada tipo; o operador pediu *"uma linha de lado a
  lado, passa do botão de play/thumbnail"*, e `#hymnResults > .hymn-result + .hymn-result::before { left: 0 }` a leva à
  borda da linha (a regra compartilhada segue com `--faixa-coluna-texto` nas faixas de álbum e favoritos, onde a
  miniatura é parte do desenho). Saiu o `--yt-thumb-w`. **O RESPIRO DO TOPO:** com a primeira linha subindo meio-vão
  dentro da caixa (margem negativa), o primeiro conteúdo nascia a 0px da barra — a regra A0b (v1.5.20) manda `--sp-5`
  abaixo do box. `#hymnResults > :first-child:not(.hymn-result)` ganha `margin-top: var(--sp-5)` e a primeira
  `.hymn-result` `calc(var(--sp-5) / 2)` (a outra metade é o `padding-top` que a primeira linha não pinta): nos quatro
  estados (Fácil × avançado, navegando × buscando) são 9,6px da barra ao conteúdo e 15,2px do campo.
  Oráculo: `busca-divisoria.test.mjs` (A5 de lado a lado, A6 o respiro).
- **O RESULTADO DO YOUTUBE É UM CARTÃO, NOS DOIS MODOS** (v1.12.35 no Fácil; v1.12.36 no avançado, *"achei mais
  interessante esse design de thumbnail maior"*). `ytResultRow` é uma linha só: as regras `.yt-result …` a viram
  coluna, com a miniatura na largura da lista em 16:9 e o título, o canal e a duração abaixo. No avançado o toque abre
  a folha (`openYtMenu`) com TODAS as escolhas — destinos, vídeo/só-áudio, teto —, então nada na linha precisou mudar de
  lugar. **O anel e o percentual são UM conjunto** (`.yt-dl`, coluna absoluta sobre a miniatura): o número centrado logo
  ABAIXO do anel, os dois no centro, o número em `--scrim` + `--stage-text` para ler sobre qualquer imagem. **Armadilha:**
  `.lib-item.baixando .thumb .dl-ring` (absoluto, 30px) tem a especificidade de `.yt-result.baixando .yt-dl .dl-ring` e
  vem antes — sem a regra de baixo devolver o anel ao fluxo, o número cai POR CIMA dele. **"Já está no aparelho" é
  ESCRITO** (`.yt-ok`, `✓ No aparelho`, dentro do `.hymn-sub` ao lado de `.yt-meta`): o véu `--btn-accent` que cobria a
  miniatura inteira saiu. Conclusão é azul (`--btn-accent` + `--accent`). A falha (`.yt-err`) segue cobrindo a
  miniatura, por 4 s. Oráculo: `busca-divisoria.test.mjs` (A8, A9).
- **O PERCENTUAL É DO TOQUE À MÍDIA TOCANDO** (v1.12.36), não dos bytes. A regra é `progresso.js` (`AVProgresso`, puro):
  fases `preparo` · `download` · `juncao` · `copia` · `gravacao` · `abertura`, a duração de cada uma PREVISTA pelo
  histórico do aparelho (`ytTempos` no `state`: as últimas 12 amostras; cada tempo é o QUANTIL 0,6 das últimas 8, SEM
  peso de idade — `estimar`, v1.12.39, revogando a mediana ponderada da v1.12.38, com a qual UMA gravação de 1,9 s virava
  a previsão do vídeo seguinte; a inclinação por MB pede DOIS pares de tamanhos; o tamanho típico só vale sozinho com
  `APOIO_TAMANHO` 3 amostras, antes disso misturado ao padrão de 12 MB; o download como `latenciaMs` + bytes ÷ ritmo, a junção, a cópia e a gravação como FIXO + POR
  MB — `ajustar`, a inclinação nunca negativa —, a junção pesando a fração dos vídeos que juntam, `juncaoChance`; o tamanho
  antes de o shell dizê-lo é a duração do `extraiu` × os bytes por segundo aprendidos, ou o típico da mesma `chave`, vídeo
  ou só áudio). **A EXIBIÇÃO É UM CONTROLE DE VELOCIDADE** (v1.12.37, revogando a perseguição de posição da v1.12.36, que
  parava em 97 com a cauda atrasada e abria o vídeo em 75 com ela adiantada): a velocidade-alvo leva o valor ao `POUSO`
  (95) no fim previsto, a real a persegue com inércia (`TAU_V` 0,8 s), um PISO de 0,3 ponto/s (decaindo só acima de 98)
  nunca a deixa parar, o `CAP` 99,6 nunca é alcançado (o inteiro máximo é 99) e, passado o pouso, a meta é um terço do
  que resta no tempo estimado MAIS o atraso já vivido — uma fase nova e curta não faz a barra correr ao teto e parar lá.
  O `concluir()` é uma VARREDURA de 150–450 ms. **A velocidade MIRA o pouso com a cauda do app (cópia, gravação,
  abertura) a `MIRA_CAUDA` (60%)** e tem um **`FREIO`** de desaceleração constante (20 pontos/s²) que pega quando a
  inércia passa da alvo (v1.12.38): errar a cauda para o lado curto custa uns décimos devagar depois do 95; para o longo,
  o vídeo abrindo com a barra no meio — e sem o freio a inércia de uma barra rápida a carregava do 95 ao 99. O download é
  previsto pelo ritmo MEDIDO desde o primeiro aviso (janela de 3 s), com confiança inteira já no segundo intervalo entre
  avisos; uma fase sem fração que passa de 9/10 da previsão tem o restante CRESCENDO com o atraso (`peloRelogio`). **O
  SHELL AVISA OS BYTES A CADA 1 MB, e isso é o GRÃO de todo critério em bytes:** o primeiro aviso de um download NOVO já
  traz 1 MB e pouco, e a régua do "retomado" da v1.12.37 (> 1 MB) acertava TODO arquivo pequeno — a rede nunca era
  aprendida (o Registro do operador: rede [0] depois de quatro vídeos). Hoje retomado é o primeiro aviso trazer muito mais
  do que o ritmo medido explica no tempo desde o começo dos bytes (`retomado()`), e o ritmo da amostra é o medido ENTRE
  avisos (`ritmoDoDownload`), que nenhum byte do disco altera — o retomado ensina a rede, só não a latência. Só amostras
  COMPARÁVEIS ensinam: o download retomado não ensina a duração dos bytes; cópia, gravação e abertura vividas com a página OCULTA (o WebView estrangulado —
  é o caso da rotina do episódio da semana) não ensinam; abertura sem play (`esperarTocando` devolve se tocou) não ensina;
  o histórico tem `VERSAO`, e outra versão recomeça. **O REGISTRO DIZ O QUE ELA FEZ:** o `relatorio()` de cada trabalho
  (caminho, previsto, real, cada fase com o número no fim dela, o número no `concluir()`, o salto final, o maior platô;
  desde a v1.12.38 o primeiro aviso contra o que o ritmo explica, a rede medida e o tamanho previsto com a fonte)
  entra num anel GRAVADO dos últimos 5 (`ytBarraDiag`), no bloco *"Barra do YouTube"* logo depois da linha do tempo
  (`blocoBarraYt`, com o aprendido em uso e o `apoio` de cada número) e numa linha *"barra: …"* da linha do tempo. `novaBarraYt` é o relógio (100 ms) e os ouvintes: **a barra nasce no `ytAcao`** (o
  preparo conta desde o toque) e a linha, o cartão do palco (`cederOPalco`), o cartão do download, a linha do Cronograma
  (`libBusy`) e a notificação (`bgTaskPct` → `pct` do `bgProgress`) mostram o MESMO número, com a frase da fase
  (`legendaDoProgresso`; só a dos bytes começa por "Baixando", que acende a seta). O shell avisa as fases que só ele vê
  (`__avYtFase`: `extraiu`, `baixou`, `juntando`, `juntou`), e sem elas a barra segue pelo relógio. **No "Tocar agora" o
  fim é a mídia tocando** (`esperarTocando`: `playing` com ela no ar, prazo 5 s; imagem e apresentação na hora) e a linha
  fica `baixando` até lá; num destino que guarda, o fim é a gravação. **O FIM SEGURADO** (v1.12.39, aprovado pelo
  operador, revogando o "nada espera a barra"): no começo da abertura `barra.revelar()` varre até 100 e o `send` ESPERA a
  varredura — `SEGURA_MIN` + `SEGURA_POR_PONTO` × o que falta, até `SEGURA_MAX` (500 ms), nada a partir do `POUSO` e
  nada com a página oculta; a espera corre junto com as listas e o `load`, e o telão espera o mesmo tanto. O `relatorio()`
  diz quanto segurou (`segurouMs`) e o número na hora de abrir (`aoConcluir`). A barra é concluída DEPOIS do `send`,
  reservada (`reservar`) para o `finally` do `ytAcao` não a abandonar. **A MINIATURA SAIU DO CAMINHO** (v1.12.39): o
  vídeo é gravado sem ela e `miniaturaDepois` a extrai depois — no "Tocar agora" quando a mídia está TOCANDO (a promessa
  `miniaturaApos`, mais `MINIATURA_FOLGA_MS`, com teto `MINIATURA_ESPERA_MAX_MS`); nos outros caminhos, logo. Ela grava por
  `AVDB.definirMiniatura` e quem desenhou a linha com a caixa vazia (`.thumb--espera`, nunca o "imagem quebrada") é
  redesenhado (`redesenharComMiniatura`). O `makeThumb` tem `<video>` próprio, mudo e sem `play()`. **PRESA AOS BYTES**
  (v1.12.40, aprovado pelo operador): durante o download o ritmo é o VIVO (`comSilencio`: o aviso de 1 MB que atrasa
  limita o ritmo a `GRAO / silêncio`, e o que falta cresce com o silêncio) e o valor não passa da posição dos bytes
  recebidos dentro da FATIA do download (`posicaoDosBytes`/`fimDaFatia`: de `sDownload` até onde as fases seguintes
  cabem, proporcional ao tempo); além dela só o `PISO_BYTES` anda, até `MARGEM_BYTES` — numa rede parada a barra para.
  **SÓ O DOWNLOAD ATRASADO** (v1.12.41): o teto só prende com `downloadAtrasado(t)` — o que chegou abaixo de `LENTO`
  (0,5) do que o ritmo aprendido traria desde o fim da latência (um grão de folga), ou os avisos parados há
  `PARADO_MS` (400 ms e três avisos do plano). Um arquivo MAIOR que o previsto chegando no ritmo de sempre corre livre
  (no Registro de 15/10 13h25, 25 MB a 23 MB/s abriam em 74). **A VELOCIDADE REFEITA:** quando o plano encolhe — os
  bytes acabam (`entrar`), o tamanho de verdade chega (`bytes()` com o total mudando) — ou o teto solta (`presa` no
  passo anterior e não mais), a velocidade vai direto à alvo se ela for maior; para baixo continuam a inércia e o freio
  (o de 3 MB abria em 62 com a inércia do plano velho e a velocidade do teto, ~1 ponto/s). Oráculo: `progresso` S.
  **O REGISTRO DIZ POR QUE OS BYTES DEMORARAM** (v1.12.40): depois de cada `ytBaixarNativo` (fora a Verificação
  completa) o `ytMedida` é lido sem `await`, resumido (`resumoDaMedidaDoShell`) e esperado pelo `concluir()` até
  `YT_MEDIDA_ESPERA_MS` (`anotarMedida`) antes de o item entrar no anel; o bloco imprime os avisos no tempo (maior vão,
  pior janela de 2 s, a fatia), a linha do shell, uma linha por faixa (`linhasDaMedidaDoShell`) e, só num download lento
  (bytes > 2× o previsto e > 3 s), o veredito `vereditoDaLentidao` — um pedaço preso (o mais lento ≥ 3× o mediano e ≥ 2 s)
  ou todos lentos por igual (a rede/o servidor). Toda linha é opcional. Toda conclusão grava uma amostra
  (`tocar`, `guardar`, `serie` — o episódio da semana e o download de álbum de série —, `teste`); falha e cancelamento
  abandonam sem amostra. Oráculos: `progresso.test.mjs` (a regra), `modo-simples-espera.test.mjs` C e D (a ligação e o
  diagnóstico) e `youtube-fim-segurado.test.mjs` (a miniatura depois do play, o fim segurado e, bloco E, a medida do shell no Registro).
- **Ela fica ABAIXO da linha, e isso é a regra escrita**: a `.row` é
  `z-index: 1` e pinta `--linha`, então o traço SOME quando aquela faixa ganha um
  preenchimento opaco de estado — ali quem separa é o preenchimento, e duas
  linguagens sobre o mesmo par seriam ruído. Dentro de um álbum o caso não
  acontece hoje: a faixa não recebe estado (ver `docs/ACHADOS-EM-ABERTO.md` §4) e
  o único `--linha` possível é translúcido, que o traço atravessa.
- **O raio apara a ponta direita**: com `border-radius: 8px` e
  `overflow: hidden`, os ~8px finais somem na curva — o mesmo canto que o
  preenchimento de estado já respeita.

#### Os quatro relatos da v1.5.17

Quatro mensagens do operador sobre a mesma tela, no mesmo minuto, todas com o
mesmo formato de falha: nada quebra, nada aparece no console, e o que sai é uma
lista que parece certa a quem não a desenhou.

**1. A altura sobrando** — *"o aproveitamento da altura não está correto, está
sobrando. É claro que pode haver telas menores, por isso o tamanho deve ser
ajustável para se encaixar a altura da tela."*

`#hymnResults` é uma `.popup-list` (coluna flex) e os blocos de raiz caíam em
`.popup-list > li { flex-shrink: 0 }` **sem `flex-grow`**: o excedente vertical
inteiro se acumulava no fim da coluna. MEDIDO a 430×900 com os 9 blocos do
acervo dissolvido — bloco em 45,19px e **85,58px** de faixa vazia no pé (16,9%
da janela). A v1.5.16 aumentou essa sobra (27,92 → 85,58) ao apertar as barras,
que era o preço declarado ali.

`flex-grow: 1` nos blocos de raiz COLAPSADOS é a resposta inteira, e é ela que
torna a altura *ajustável por construção*: o navegador reparte a sobra quando o
conteúdo cabe, e o crescimento é **inerte** quando ele transborda. Zero JS,
nenhuma tela privilegiada. MEDIDO: 430×900 → bloco a **54,70px**, sobra
**zero**; 393×786 e 360×740 com 9 blocos ficam idênticos a antes (45,19px,
rolando).

- **O seletor nomeia os DOIS blocos que existem na raiz, nunca `> li`.**
  `.acervo` está sempre no `#hymnResults`, e as linhas da BUSCA são filhas
  diretas dele — MEDIDO, com `> li` elas iam de 97,3 para 306,4px. A pasta do
  aparelho fica de fora de propósito: ela não é bloco de raiz (mora no corpo dos
  Favoritos) e o ouvinte de abrir dela é da `.row`; crescer sem mover o alvo
  devolveria a margem morta que a regra ao lado existe para impedir.
- **`:not(.aberto)`/`:not(.expanded)`**: uma seção ABERTA mede o conteúdo dela
  (v5.276), e sem a guarda o vão volta a ser repartido com quem abriu.
- **A BARRA NÃO CRESCE JUNTO**, e isto é invariante: `medirVaoDosFavoritos` soma
  as BARRAS das vizinhas para escrever `--fav-vao`, e uma barra que cresce
  realimenta a conta até o vão deixar de ser dos Favoritos — quem REPROVA essa
  variante é o `boot-nativo.test.mjs`, o único oráculo que lê `--fav-vao`
  ("132px contra 136px"). O bloco cresce, a barra fica em `--bar-secao-h` e o
  rótulo é CENTRADO.
- **E O BLOCO É O ALVO E A RESPOSTA.** A faixa de ~4,8px em volta da barra seria
  MARGEM MORTA — o oposto do que o recuo da `.coll-bar` existe para produzir
  (v5.288) —, e ela falhava de DOIS jeitos: numa SEÇÃO o ouvinte morava na barra
  e o toque ali não fazia NADA (9,5px por bloco, 17% da pílula que o dedo vê);
  num `.hymnal-card` o ouvinte já é do `li`, então o toque ABRIA o card e nada
  respondia, porque quem estava na lista do `--press` era a barra. Hoje o
  ouvinte da seção mora no `li`, como o do card, e o `--press` é do bloco, com a
  barra calada dentro dele.
  - **A guarda do ouvinte é POSITIVA** — alterna o toque no PRÓPRIO `li` ou
    dentro da barra. Escrita ao contrário (*"tudo menos o corpo aberto"*) ela
    depende de o corpo ter sempre a mesma classe, e a seção dos FAVORITOS monta
    o dela por outro caminho: um toque numa linha de favorito borbulhava até o
    `li` e FECHAVA a seção debaixo do dedo. O `boot-nativo.test.mjs` pegou.
  - **O `--press` do bloco é uma REGRA SEPARADA**, e não mais um nome na lista
    do `--press`: `:is()` toma a especificidade do argumento mais específico, e
    um seletor com id ali dentro levaria as ~40 classes da lista para (1,x,0).
- **`--bar-raiz-max` é o TETO** (66px), porque a lista pode ter poucos blocos:
  sem ele, três coleções dão 183,28px cada. E ele anda com `min-height:
  min-content`, senão um card com subtítulo é RECORTADO.
- **A lista passa a RESPIRAR** ao abrir uma seção (uma irmã colapsada desce de
  54,28 para 48,64px seguindo a curva do acordeão). É o recurso: evitá-lo com um
  `:has()` faria a lista PULAR num quadro.
- **`medirVaoDosFavoritos` ganhou `.row` no `querySelector`** no mesmo lote: um
  bloco de raiz que caísse no ramo do `<li>` inteiro entraria na soma já
  CRESCIDO, e o vão encolheria em silêncio. Hoje nenhum bloco da raiz é uma
  pasta — mas a fórmula não pode depender disso.

**2. Os cards do topo sem margem** — *"os cards que ficam no topo das listas,
como o cards de este sábado do informativo, ou das seções do hinário … estão se
sobrepondo de forma errada ao espaço em que deveriam ficar, ficando para cima do
correto, sem margem no topo."*

**COLAPSO DE MARGEM.** O `.coll-open` não tem `padding-top` nem borda de cima,
então a `margin-top` de `.4rem` do primeiro filho — `.serie-destaque`,
`.hino-indice` ou `.coll-songs` — é ADJACENTE à dele e sai para FORA. Enquanto a
placa era transparente ninguém via: os 6,4px caíam entre a tampa e uma caixa
invisível. A v1.5.15 deu a ela FUNDO e RAIO, e o recuo passou a cair fora —
MEDIDO, o primeiro filho começava a **0,00px** do topo da placa, contra os
6,39px da placa IRMÃ (`.fav-itens`), cobrindo por inteiro os cantos
arredondados.

- **`display: flow-root` e não `padding-top`.** Um recuo declarado ali impede o
  colapso e ainda SOMA à margem do filho (5,6 + 6,4 = 12px); e zerar a margem
  dos três filhos mudaria o vão ENTRE eles (MEDIDO, o destaque e a lista caem de
  6,4 para 1,6px). O BFC não inventa número nenhum — mantém dentro o `.4rem` que
  o filho já pede.
- **Ele já era o desenho certo por 220ms:** `expandAccordion` escreve
  `overflow: hidden`, que É um BFC. De quebra o acordeão passa a medir a altura
  de verdade — `offsetHeight` é lido ANTES do `overflow`, e a animação levava a
  321px uma caixa que dentro do BFC pede 327, recortando 6px da lista do começo
  ao fim do movimento.
- **E o salto do índice mira ABAIXO da tampa.** `irParaSecao` usa
  `scrollIntoView({ block: 'start' })`, que mira o topo do SCROLLPORT — e o
  scrollport começa debaixo da tampa grudada: MEDIDO, o cabeçalho pousava em
  0,39px com a tampa ocupando até 45,19, isto é, desaparecia inteiro.
  `.hino-secao { scroll-margin-top: var(--bar-secao-h) }` resolve, e
  `scroll-margin-top` **não é `padding`**: o `padding-top` do scroller continua
  ZERO (v1.5.15).

**3. O tom do item aberto** — *"a zona do título e thumbnail está ficando
diferente da cor do corpo desse item ao abrir as opções."*

O `.lib-item.expanded` pintava `background-image: linear-gradient(--surface-sunk,
--surface-sunk)`, escrito na v5.271 quando a faixa FECHADA já vinha recuada
(`--item-fill`): era MAIS UM degrau sobre um degrau existente. A v1.5.14 tirou o
preenchimento do nível 3 e a premissa caiu — o overlay virou o ÚNICO tom da
faixa aberta, num lugar que a alternância não tem. `--panel` rgb(33,47,61) +
rgba(0,0,0,.24) = rgb(25,36,46), que é o pixel MEDIDO.

MEDIDO entre o título e o corpo do MESMO item: **1,15:1** no escuro e **1,39:1**
no claro. **E o achado que decidiu o desenho:** na lista de BUSCA, onde
`--linha` é OPACO e a `.row` (`z-index: 1`) esconde o overlay, o mesmo par já
media **1,00:1** — *o app tinha duas leituras da mesma gaveta, e o operador
abriu a metade quebrada.* Sem o overlay: 1,00:1 nas três listas, e o poço ganha
separação (1,196 → 1,380 no escuro, 1,338 → 1,853 no claro).

A leitura estava certa; a ESCOLHA entre as duas era do operador, e ele a fez na
volta seguinte — ver *"a tampa veste o poço"*, no capítulo da v1.5.18. O que
sobrevive desta metade é o achado: **o app tinha duas leituras da mesma gaveta**,
e nenhuma delas tinha sido decidida.

**4. A divisória descentrada** — *"o alinhamento vertical das linhas de divisão
entre os itens das listas … estão ligeiramente descentralizadas para baixo em
relação aos itens e o vão entre eles."*

O traço mora em `top: 0` da faixa DE BAIXO (`.lib-item` é `overflow: hidden` e
um traço no `gap` é RECORTADO — MEDIDO, a força do pixel cai de 44 para ZERO),
então com o vão INTEIRO fora da caixa ele pousava no limite INFERIOR: **6,42px
de branco acima e 1,37px abaixo**, 73% contra 16% de uma banda de 8,78px.

**Não se move o traço, move-se a CAIXA.** Metade do `gap` entra como
`padding-top` e um `margin-top` negativo da mesma medida devolve o conteúdo ao
lugar: a caixa cresce para cima e o que está dentro dela não anda. A identidade
não é do fixture — `N·(h+2) + (N−1)·4 − 2N` é `N·h + (N−1)·4` para qualquer N —,
então a altura da lista e o passo entre faixas ficam IDÊNTICOS. O que muda é só
a caixa: 42,78 → 44,78px, ainda abaixo da barra do álbum que a contém (45,19px),
que é o par que o `smoke.mjs` cobra. Vale para TODA faixa e não só para a que
tem irmã acima: fosse `+`, a primeira ficaria 2px mais curta e o preenchimento
de ESTADO mudaria de altura conforme a posição dela na lista.

**5. A densidade da gaveta de opções** — *"essa seção de opções manteve a altura
dos elementos muito grande, pois ainda fazia referência a padrões antigos …
alinhando-se ao padrão e densidade das listas que temos na biblioteca."*

São DOIS defeitos, e o operador acertou o diagnóstico e a data.

- **A altura.** `.song-menu-btn { padding: .6rem .7rem }` sobre um
  `.song-menu-check` de `--hit` dava 53,19px, contra os 42,78px de uma
  `.hymn-result` da lista logo acima — razão **1,243**. Com `--sp-2` a linha vai
  a 42px, a MESMA densidade; `--hit` (34px) é o CONTEÚDO e não foi tocado, então
  o alvo continua 8px acima do piso.
- **E O ALCANCE É O QUE O PEDIDO NOMEIA.** O mesmo `.song-menu-btn` é a linha de
  TRÊS folhas modais além da gaveta — destinos, vídeo do YouTube e playlist
  automática —, e apertar o seletor cru levava as três junto: MEDIDO, a folha de
  destinos caía de 312,30 para 267,55px e a do YouTube de 469,91 para 411,91.
  Sem relato, sem régua (não há `.hymn-result` "logo acima" de um modal) e sem
  oráculo. O recuo virou o par `--opcao-recuo-v`/`-h` no `:root`, e é a
  `.hymn-gaveta` que o sobrescreve — quem declara a medida dos filhos é o PAI, a
  mesma regra da casa do `--camada`. As três folhas ficam com o recuo de sempre.
- **E o token FECHA A DUPLICAÇÃO que a folha já reclamava.** O `min-height` da
  faixa de confirmação era o do botão COPIADO, e o comentário de lá dizia com
  todas as letras que era *"a única duplicação aqui"*. Hoje os dois leem a mesma
  fonte e andam juntos por construção, dentro e fora da gaveta.
- **E a regra do recuo da gaveta estava MORTA.** `.hymn-opcoes` e
  `.song-menu-list` moram no MESMO `<ul>` (o montador escreve
  `className = 'song-menu-list hymn-opcoes'`), têm a mesma especificidade, e a
  segunda vem DEPOIS na folha: a gaveta vestia o recuo do BOTTOM-SHEET que a
  v5.285 substituiu. MEDIDO por reversão — apagando o `padding` da
  `.song-menu-list`, o computado cai de 6,4/9,6/12,8px para 7,2/8/8. O `>` de
  `.hymn-gaveta > .hymn-opcoes` desempata.
- **"Padrões antigos" tem data:** o commit das QUATRO ESCALAS (v1.5.14)
  converteu `gap`, `font-size` e `font-weight` dessas regras e NUNCA tocou em
  `padding` — os literais de recuo da gaveta são todos do commit-raiz, e quatro
  deles não existem em degrau nenhum da escala.
- **O par do confirmar acompanha, obrigatoriamente:** o `min-height:
  calc(var(--hit) + 1.2rem)` da faixa de confirmação era o número do
  `.song-menu-btn` COPIADO. Deixado como estava, a linha PULARIA +11,19px sob o
  dedo ao perguntar *"excluir?"* — o defeito da v5.309 de volta, e MEDIDO. Hoje
  a soma é escrita como a soma (`--hit + 2 * --sp-2`).

#### Os três relatos da v1.5.18

Os três chegaram **depois** de o crescimento estar no aparelho, e é isso que os
separa dos anteriores: nenhum deles é o recurso falhando — são o resto que ele
deixou à mostra.

**1. A margem de baixo** — *"o sistema de espaçamento das coleções ainda está
ficando desregulado … há uma margem maior na parte de baixo. lembrando, a minha
tela tem um tamanho de pixels, a sua tem outro e a dos usuários podem ter outro
tamanho."*

Ele está certo e o crescimento está funcionando: decodificados os pixels da
captura (1440×2938), os blocos medem ~167 image px e os vãos ~30, mas embaixo do
último sobram ~100. **O que restava não era espaço por repartir — era o
`padding-bottom` do scroller**, `.8rem` MAIS `env(safe-area-inset-bottom)`.

**A área segura só vale onde a janela ENCOSTA na base.** Desde a v1.5.4 ela para
na linha da caixa de controles, e a barra de gestos do Android fica abaixo
**dela** — o recuo estava reservando lugar para uma vizinha que não é vizinha. Ela
volta a valer nos dois casos em que a janela vai mesmo até o fim (`body.mode-simple`
e `body.lib-aberta.teclado`), declarada no `body` para herdar até o scroller **e**
até o véu de baixo, que anula o mesmo número.

**E o valor é `--sp-5`, o mesmo `gap` que separa dois blocos de raiz.** Esta é a
régua, não um número escolhido: com o crescimento preenchendo o resto, qualquer
outro põe o último bloco a uma distância da borda que nenhum par de vizinhos tem
— que é literalmente o que o relato descreve. MEDIDO a 430×900: recuo 9,6px,
`gap` 9,6px, sobra **0,04px**. O oráculo compara os DOIS computados, e por isso
ele continua valendo em qualquer tela.

**2. O card dono das opções sem cor** — *"as opções de play não estão colorindo
o card dono daquelas opções, pois ali nos favoritos você pode ver que o card
titular do item não ganhou a cor de seleção/cor do corpo da caixa de opções."*

**Isto REVOGA a metade 3 da v1.5.17, a pedido de quem opera.** O achado daquele
lote continua de pé — na lista de BUSCA a tampa já media 1,00:1 contra os BOTÕES
da gaveta, e o app tinha duas leituras do mesmo objeto —, mas a escolha entre as
duas nunca tinha sido feita por ninguém. Para quem opera, **o corpo de um item
aberto é o POÇO**: a superfície grande que o toque abriu, e não o papel dos
blocos que descansam nela.

Hoje a tampa veste `--gaveta-bg`. MEDIDO: tampa e poço a 1,00:1 nos dois temas,
com os botões flutuando dentro deles (1,196:1 no escuro, 1,338:1 no claro) — o
item aberto é **um bloco só**, com a lista em volta continuando papel.

- **`background` na `.row`, e não `--linha`.** As quatro listas resolvem esse
  token de jeitos diferentes — transparente no acervo e nos favoritos,
  `--camada` na busca, `--surface` na pasta do aparelho —, e uma delas é escopada
  com id. Pintar a superfície direto atravessa as quatro com um seletor só, e foi
  o que apagou a regra da PASTA que a v1.5.17 tinha escrito: aquela mexia em
  `--linha`, que esta atravessa, e ficaria como um valor sem efeito explicando um
  desenho que já não existe.
- **Os três `:not()` são a precedência do estado.** Uma linha NO AR que o
  operador abra continua vermelha.
- **A divisória acima dela SOME, de propósito.** O traço mora sob a `.row`
  (`z-index: 1`), e ali quem separa passa a ser o preenchimento — a regra já
  escrita ao lado do `--divisoria`.
- **A METADE que impede o conserto largo** é a irmã FECHADA continuar sem tom:
  sem ela, pintar toda `.row` passaria na asserção de cima e o preenchimento
  deixaria de dizer *"esta é a aberta"*.

**3. A divisória que falta nos favoritos** — *"nessa lista de favoritos também
não há a linha divisória que temos nas outras listas na biblioteca."*

A v1.5.16 desenhou o traço para a faixa de um ÁLBUM, e os favoritos são outra
`<ul>`. Ele entra pela MESMA declaração, com os dois seletores — continua sendo
**um** consumidor do `--divisoria`, que é o que mantém de pé a asserção positiva
do `tokens.test.mjs`; uma segunda regra pintando o mesmo token seria a porta
larga que ela existe para fechar.

**Dois números mudam, e nenhum pode ser copiado do álbum:**

- **a coluna do texto** — aqui a miniatura é o `--thumb` de 40px e lá é a
  `.hymn-play-thumb` de 38 —, então `--faixa-coluna-texto` é SOBRESCRITO na
  `.fav-itens` em vez de duplicado. O traço continua começando onde o NOME
  começa, que é a forma do pedido original (*"não borda inteira"*);
- **a metade do vão** que a caixa reabsorve: o `gap` desta placa é `--sp-3` e o
  do álbum é `--sp-2`. Copiar o número descentraria o traço — exatamente o
  defeito que a v1.5.17 acabara de corrigir do outro lado. MEDIDO: desvio 0,00px
  do centro da banda.

#### Os favoritos se atualizam com a Biblioteca ABERTA (v5.258)

Relato: *"se estou na biblioteca e adiciono algo aos favoritos, ele só aparece
na lista após fechar e abrir novamente."*

Os favoritos têm **duas casas** desde a v5.237 — a gaveta e a seção do topo da
Biblioteca —, e o `toggleFav` só redesenhava a lista de baixo. A correção
(`redesenharFavoritosNaBiblioteca`) redesenha **só o corpo daquela seção**,
achado por uma marca no próprio nó (`data-fav-corpo`), apontando o `favHost`
para ele — e **não** `renderSearchResults()`, que remontaria a tela inteira e
jogaria fora a posição de rolagem de quem estava no meio de um hinário para
marcar uma estrela. O oráculo cobra as duas metades: o item aparece **e** a
rolagem sobrevive.

#### O rodapé fixo da caixa da lista (`#listFoot`)

`<main>` é uma coluna de três faixas: cabeçalho, `<ul id="library">` que rola, e
o **rodapé**, que não rola. O rodapé tem dois inquilinos e **nunca os dois ao
mesmo tempo**:

| Inquilino | Quem monta | Quando |
|---|---|---|
| **as portas** Bíblia · Ferramentas (`.portas-row`) | `renderListFoot()` | fora da seleção |
| **barra de seleção múltipla** (`#selbar`) | `hostSelbar()` | seleção múltipla ligada |

Os dois vestem a MESMA caixa: é uma fatia só, com inquilinos diferentes.

O lugar de cada um foi decidido pelo que ele custa em outro: o "Importar arquivos"
(o primeiro inquilino, v5.107 a v1.13.4 — hoje na barra do topo) como último `<li>`
do `<ul>` exigia rolar trinta itens para alcançar a ação mais frequente da tela; a
barra de seleção no lugar da faixa de ABAS mexia no que não é da seleção e sumia
com a navegação justamente quando o operador pode querer sair da tela.

Três detalhes que o mecanismo exige:

- **Os dois medem `--hit-foot` (44px)**, e é por isso que a medida é token: com
  alturas diferentes a caixa da lista muda de tamanho ao entrar e sair da
  seleção, e a lista dá um pulo debaixo do dedo que estava segurando o item.
- **`renderListFoot()` reconstrói só o que é dela.** Um `innerHTML = ''` tiraria
  a `#selbar` do documento: o nó é UM só, movido entre hosts, e perdê-lo é perder
  os listeners.
- **Quem esconde o rodapé vazio é o JS, não um `:empty`.** A `#selbar` mora ali
  mesmo fora da seleção (escondida por `hidden`), então o rodapé nunca fica de
  fato vazio — e um filho de altura zero ainda consome o `gap` do `<main>`, que
  viraria uma faixa de ar acima da caixa de controles em toda aba sem rodapé. E
  a chamada é **antes** do desvio por aba em `renderLibrary()`: Bíblia e
  Ferramentas saem por `return`, e deixada para o fim ela desenhava a faixa das
  portas embaixo da grade de livros da Bíblia.

O `<input type="file" multiple>` (`#file`, com o listener já registrado) mora solto
e FIXO no `<main>` desde a v1.13.5: quem o abre é o `#cronoImportar` da barra, por
`fileEl.click()` dentro do toque (no navegador; no app o seletor é o do sistema).

**Navegação persistente:** trocar de aba não reseta a busca. A posição de scroll
é guardada por aba (`scrollPos`, chave `scrollKey()`) e restaurada **só na
NAVEGAÇÃO**, nunca em todo redesenho — `load()` roda por dezenas de caminhos
(acrescentar um item, favoritar, o progresso de um download), e restaurar em
todos jogava a lista de volta para o topo. `rememberScroll()` é chamado antes de
trocar de aba. (Memória por sessão, em RAM.)

#### Deslizar troca de aba (carrossel)

`setupTabCarousel` escuta o `<main>` e a própria `.tabs` e troca de aba quando o
dedo anda `TAB_SWIPE_MIN` (60px) na horizontal com o eixo X dominando o Y em
1,5×.

- **A ordem é a da FAIXA** (`SWIPE_TABS`), não a do `TAB_ORDER`: este inclui os
  Favoritos, que não têm botão na faixa — deslizar até uma tela que não aparece
  na navegação deixaria o operador sem indicação de onde está.
- **Age no meio do gesto**, não ao soltar: é o que faz o gesto parecer arrastar
  a tela.
- **Duas superfícies escutam** (o `<main>` e a `.tabs`, que mora fora dele), com
  o estado do gesto COMPARTILHADO: é UM gesto, não dois.
- **Vale SOBRE A LISTA, inclusive sobre as linhas** — o Cronograma é feito de
  linhas, e excluí-las mataria o gesto na aba em que ele mais é tentado.
- **`touch-action: pan-y` NO SCROLLER, nunca num ancestral.** A regra PARA de
  subir na árvore no elemento que IMPLEMENTA o gesto: quem precisa da declaração
  é cada scroller — `.lib-list`, `.misc-panel`, `.msg-list`, a `.lib-misc` (o
  corpo da folha de Ferramentas, que desde a v1.8.1 ROLA em vez de esconder:
  com o miolo ganhando piso, o que antes era espremido até sumir passou a
  transbordar) e as `.bible-half`. Sem ela o navegador considera o gesto dele (`manipulation`,
  herdado do `*`) e o engole com `pointercancel` antes dos 60px. E a MESMA regra
  preserva o `pan-x` do histórico do sorteio (`.draw-hist`): um `pan-y` acima
  dele não o alcança. **Esta lição custou três versões e voltou três vezes.**
- **O gesto de TOQUE tem ciclo próprio, independente dos `pointer*`.** O
  navegador CANCELA o fluxo de ponteiro assim que decide que o gesto é dele, e
  basta um scroller no caminho: armando pelo `pointerdown`, o cancelamento matava
  o gesto antes de nascer. `touchstart` arma, `touchmove` decide o eixo /
  reivindica / troca, `touchend`/`touchcancel` encerram. Os `pointer*` ficaram só
  para o MOUSE (filtrados por `pointerType`).
- **Dois limiares, duas decisões:** o EIXO aos 12px (`TAB_CLAIM_MIN`, antes de o
  navegador decidir) e a TROCA aos 60px (`TAB_SWIPE_MIN`, que é intenção).
  Reivindicado, o gesto é nosso até o dedo levantar — soltar no meio deixaria a
  página rolar de lado no fim. O `touchmove` é **não passivo**, que é o que faz o
  navegador esperar a decisão do handler.
- **A GUARDA PERGUNTA AO DOM, nunca a uma lista de classes.** Quatro consertos
  deste carrossel erraram mantendo à mão a lista do que o eixo horizontal não
  pode atravessar — um chegou a proibir `.bible-half`, que declara `pan-y` e
  LIBERA o gesto, e o mais largo barrava toda sub-tela (reconhecida pelo voltar
  visível), matando o carrossel na navegação interna. A pergunta certa é MEDIDA:
  entre o alvo e a superfície que escuta, existe alguém que de fato ROLE na
  horizontal? Um trilho de pílulas cheio responde sim; o mesmo com três pílulas
  responde não. Campos de texto ficam fora por outro motivo (ali o eixo é do
  cursor) e são nomeáveis por serem conceito do HTML. A seleção múltipla também.
- **O `click` do fim do gesto é engolido** por um listener de CAPTURA no
  `<main>`, senão deslizar sobre a grade de livros trocava de aba **e** abria um
  livro. A trava é uma **flag desarmada no `pointerdown` seguinte**, nunca um
  listener com prazo: o prazo mede o tempo errado — numa página em segundo plano
  o resto do gesto leva mais que ele e a trava expirava antes do clique.

#### A troca de aba é um DESLIZE INTEIRO

As duas telas se movem juntas, larguras inteiras: a que sai vai para `-100%`, a
que entra vem de `+100%`, e elas nunca se sobrepõem — são vizinhas, empurrando-se.
Mexer só no conteúdo NOVO é um sinal de DIREÇÃO, não um deslize.

O truque para ter as DUAS telas com uma lista só no DOM é o **fantasma**
(`makeTabGhost`): os nós antigos são MOVIDOS para um `<ul>` absoluto sobre a área
da lista, e a `#library` fica livre para o conteúdo novo.

- **Mover, nunca CLONAR.** Um clone reinicia o download de cada miniatura por um
  `blob:` que o render seguinte revoga — as fotos sumiriam no meio do deslize.
- **O fantasma é feito ANTES do `load()`**, e é o que o operador continua vendo
  enquanto a lista nova é montada. Por isso `switchTab` é `async` e o deslize
  dispara no `finally`: um `load()` que falhe não pode deixar o fantasma
  congelado sobre a lista para sempre.
- **O `<input type="file">` fica para trás de propósito** (mora no `#listFoot`,
  fora do `<ul>`): dentro da lista ele iria junto, sairia do documento com o
  fantasma, e o `change` que importa arquivos deixaria de acontecer sem erro.
- **Um deslize novo mata o anterior** (`tabGhost`).
- **`main` é `position: relative` + `overflow: hidden`**: ancora e RECORTA.
- **A regra do fantasma precisa das DUAS classes** (`.lib-list.lib-ghost`): ele
  também é `.lib-list`, e aquela regra — depois na folha — declara
  `position: relative`. Com uma classe só o `relative` vencia, o fantasma
  continuava no fluxo e DIVIDIA a altura com a lista (medido: 478px em repouso,
  233px no meio da animação).

A **direção** vem de `TAB_ORDER`. A duração e a curva são as MESMAS do vazado da
faixa (`TAB_MOVE_MS`/`TAB_MOVE_EASE` × `--tab-move`) — os dois são efeitos de UM
gesto. `prefers-reduced-motion` desliga tudo.

**`load()` tem guarda de sequência** (`loadSeqCtl`, como o `loadSeq` do stage):
ela é async e disparada fire-and-forget por dezenas de handlers, então duas
chamadas concorrentes poderiam terminar fora de ordem e a mais antiga
sobrescreveria o estado/render da mais nova. Ela lê tudo do IDB em locais e só
aplica ao estado do módulo + renderiza se `myseq === loadSeqCtl`.

Miniaturas (160×160 px, JPEG 72%) geradas via Canvas na importação. Vídeos têm
thumbnail extraído de um frame perto do início — `min(0,5 s, duração/3)`, com
timeout de 3,5 s. Itens sem blob local exibem badge `URL` ou `YT`.

### A tampa das coleções acompanha a altura da lista (v1.12.14)

`medirTampa` (`--tampa-h`, a altura de cada bloco de raiz do acervo, de `--bar-raiz-max` até a barra) lê `lista.clientHeight`. Além do fim de cada render (`acertarTampa`), um `ResizeObserver` em `#hymnResults` a refaz quando a altura da lista muda com a janela da Biblioteca ABERTA — no Modo Fácil o render do Parar roda com a janela fechada (lista ~10 px) e a janela cresce depois. Fechada, não mede (a lista encolhida encolheria os blocos na saída). Oráculo: `modo-simples-corpo` bloco Q.
Desde a v1.13.9 os blocos de raiz FECHADOS vão da altura de antes à nova pela curva do acordeão (`animarAlturaDeBloco` no `remedirTampa`), em vez de pularem no quadro em que a janela assenta — é o caminho da linha de controles do Modo Fácil que recolhe (v1.13.8). Oráculo: `modo-simples-biblioteca-tamanho` F3.

