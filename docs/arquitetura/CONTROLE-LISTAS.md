<!-- Parte do capítulo do Controle (o índice das partes está em CONTROLE.md;
     o mapa geral, em docs/ARQUITETURA-WEB.md). Partida do CONTROLE.md na
     revisão A3 (2026-10-30): o texto foi MOVIDO verbatim. -->

## Controle — cronogramas, gestos, favoritos e edição de mídia

> Parte do capítulo do Controle — o índice das partes e as regras que valem
> para o Controle inteiro estão em [`CONTROLE.md`](CONTROLE.md).

**Nesta parte:** [Os cronogramas múltiplos](#os-cronogramas-múltiplos-v11254) · [Gestos nos itens da biblioteca](#gestos-nos-itens-da-biblioteca) · [Favoritos: uma lista só (marcados + pastas do aparelho)](#favoritos-uma-lista-só-marcados--pastas-do-aparelho) · [Editar mídia](#editar-mídia-v1120--v11210)


### Os cronogramas múltiplos (v1.12.54)

Pedido do operador: *"o título 'cronograma' vai ser um título que pode ser
modificado, e tocar nele … abre uma pequena gaveta abaixo da top bar, que lista
os cronogramas … o botão que hoje é o limpar toda a playlist, agora vai ser um
botão de menu ou 3 pontos … limpar cronograma, excluir aquele cronograma ou
renomear … o sistema de múltiplos cronogramas na verdade vai funcionar apenas
como um 'atalho para alterar todo o cronograma de uma vez', ao invés de criar
cronogramas concorrentes ao mesmo tempo"*.

**UM ATIVO, E ELE É `imports`.** É essa a decisão que deixa o resto do app
intocado: tocar, o avanço da fila, os destinos ("Cronograma" das folhas, sempre o
ATIVO), o share, o Histórico, a Verificação, o pacote e o Modo Fácil — que nem
desenha o `<main>` — leem a MESMA lista de sempre. Os outros são CONJUNTOS
GUARDADOS na chave `cronogramas` (forma e regra em
[MODELO-DE-DADOS.md](MODELO-DE-DADOS.md)). Um desenho por PONTEIRO (o ativo
apontando para uma lista própria) foi descartado: seriam 45 pontos de `'imports'`
a trocar, e cada um que escapasse leria o cronograma errado calado.

| peça | o que é |
|---|---|
| `#cronoTitulo` | o botão do título: `#listTitle` (o NOME do ativo, "Cronograma" por padrão) + a seta `.crono-seta` à direita. O `padding-left` é a largura da seta mais o vão: o NOME fica no eixo da faixa |
| `#cronoImportar` (`.crono-importar`) | o IMPORTAR (v1.13.5), na trilha 1 da barra, encostado à esquerda: só o ícone (a folha com o +, `--icon-lg` por regra própria), chapado e em `--accent`, como a engrenagem em frente. Abre o seletor (`importarArquivos`: `AVNative.pickDoc` no app, o `#file` no navegador). A casa foi do LIMPAR da v1.8.66 à v1.13.4 — ele saiu, e esvaziar é o excluir do ÚNICO cronograma |
| `#cronoGaveta` · `#cronoLista` | a GAVETA, no topo do `.list-body` (que começa na borda de baixo da barra), `--panel` com `--camada: --panel-2`: uma LINHA por cronograma e "Novo cronograma" (`#cronoNovo`) por último. Rola com a marca `rola` |
| `.crono-item` | a LINHA (v1.12.55), na receita da linha de lista do app (`.lib-item`/`.row-item`): cartão `--camada`, `--radius-card`, recuo da `.row`, 51,2px. **Renomear** (`.crono-renomear`, `.row-btn`, lápis) na ponta ESQUERDA · o **miolo** (`.crono-trocar`: o nome em `.row-name` e a conta em `.row-sub`, CENTRADOS) · **Excluir** (`.crono-excluir`, `.row-btn`, lixeira, `--btn-danger` + `--danger-strong`) na ponta DIREITA. Os dois quadrados medem `--thumb` e estão SEMPRE à vista. O ativo é a linha em `--sel-fill` |
| `#cronoNovo` (`.crono-novo`) | a última linha: ícone + "Novo cronograma" CENTRADOS, o par discreto de criar (`--surface` + `--accent`, o do "Refazer"), `--quad-faixa` de altura |
| `#cronoVeu` | o VÉU transparente (z 160) que engole o toque de fora |

- **O NOME FICA NO EIXO POR CONSTRUÇÃO:** os dois quadrados têm a mesma largura e o
  miolo (`flex: 1`, `min-width: 0`) fica com o resto — o centro dele é o centro da
  linha, e um nome longo vira reticências. O oráculo mede em 320/360/430 px e fonte
  1×/1,25× (bloco M). **POR QUE RENOMEAR À ESQUERDA E EXCLUIR À DIREITA:** o
  operador liberou os dois lados; a direita é onde o app já põe o destrutivo de uma
  linha (o `.coll-bar-rm`, o ✕ do card do editor, a lixeira da gaveta de um item),
  e mantê-lo lá é o que o dedo já sabe.
- **A LINHA É UM BLOCO QUE HOSPEDA CONTROLES**, e responde só com a LUZ
  (`.crono-item:active`), calada quando o toque é num dos quadrados — a regra do
  `.lib-item`. O miolo é transparente. A dobra `.crono-item > .crono-excluir` não é
  zelo: o `.row-btn { background: var(--surface) }` vem depois na folha e venceria.
- **NOVO** cria um vazio "Cronograma N" (o primeiro número livre, a partir de 2) e
  troca para ele. **TROCAR** é `AVDB.cronoTrocar` + `load()`; a seleção múltipla e
  a gaveta de uma linha morrem antes (`cronoAntesDeTrocar`), porque apontam para
  linhas que saem de cena. **A CENA NO AR NÃO É TOCADA** por trocar, limpar ou
  excluir — a regra da v1.3.13: o Cronograma é acervo.
- **RENOMEAR** (o quadrado da ESQUERDA da linha, `renomearCronograma(id)`) é o
  `appPrompt` dos itens, e vale para QUALQUER cronograma, não só o ativo. O nome é
  APARADO; vazio mantém o antigo; um nome que colide com OUTRO cronograma ganha
  " (2)" — duas linhas iguais na gaveta seriam indistinguíveis ao toque.
- **LIMPAR É O EXCLUIR DO ÚNICO** (v1.13.5). O botão próprio da barra saiu a pedido do
  operador — *"remova o botão de limpar cronograma, pois sua função basicamente se
  pode obter pelo botão de excluir cronograma na lista de cronogramas"* —, e com um
  cronograma só excluí-lo é ESVAZIÁ-LO: `excluirCronograma` chama o
  `limparCronograma` de sempre, o cronograma fica (com o nome) e a lista esvazia. O
  diálogo diz isso (*"Tirar os N itens de “nome”? Ele é o único cronograma, e fica
  vazio."*, título e confirmar "Limpar"), e o `title` do quadrado também (*"Limpar
  “nome” (é o único cronograma)"*). Sem esta troca, apagado como era, esvaziar o único
  deixaria de existir.
- **EXCLUIR** (o quadrado da DIREITA, `excluirCronograma(id)`) pergunta (modal,
  `perigo`, nomeando o cronograma e a conta). Sendo o ATIVO, cai no **USADO MAIS
  RECENTEMENTE** dos outros (`usado`, escrito a cada troca); sendo um GUARDADO, o
  ativo não muda. Coleta o que só ele segurava, com as duas metades que o `db.js`
  não faz: a marca `ytEstado` (só do ativo — é dele que o ✓ da busca fala) e o
  `soltarAvulso` (de qualquer um; os ids de um guardado vêm de
  `AVDB.cronoIdsGuardados(id)`). **O ÚNICO NUNCA SE EXCLUI** — o app nunca fica sem
  cronograma —: ele se LIMPA (acima), e o quadrado só é APAGADO com o único VAZIO,
  com o `title` dizendo por quê.
- **RENOMEAR E EXCLUIR DEIXAM A GAVETA ABERTA** e a redesenham: o desfecho aparece
  onde o dedo estava. O diálogo abre POR CIMA dela, e o `pointerdown` de fora o
  exclui (`appDialogEl`) — sem isso, o toque no OK fecharia a gaveta.
- **A GAVETA ANIMA** (opacidade e 6px, `--dur-media`; nada com
  `prefers-reduced-motion`). Fechar tira o VÉU na hora e o nó (`hidden`) no fim da
  transição — um nó apagado continuaria tocável. Com ela aberta, o título está
  SOB o véu: tocá-lo de novo é um toque de fora, e fecha.
- **O TOQUE DE FORA É ENGOLIDO, e é o motivo do véu:** uma linha do Cronograma
  tocada PROJETA, e o toque que fecha a gaveta não pode ser esse. O que cai ACIMA
  do véu (a barra da Biblioteca, 190; as folhas, 200+) fecha pelo `pointerdown`
  na captura e segue para quem o recebeu — abrir outra janela com a gaveta
  esquecida por baixo seria o pior dos dois.
- **O VOLTAR a fecha** (degrau 1.7 do `__avBack`, depois do diálogo).
- **A IRMÃ NO ITINERÁRIO (v1.13.2)**: a gaveta dos itinerários (`#itinGaveta`, degrau
  1.8) é esta, com as mesmas classes, na folha de Ferramentas — ver
  [CAMADA-DE-TEXTO.md](CAMADA-DE-TEXTO.md), "Ferramentas: itinerário". Mexer numa
  é olhar a outra.
- **O MENU ⋮ DA v1.12.54 SAIU INTEIRO na v1.12.55** — botão, folha, CSS e
  `abrirCronoCamada`/`fecharCronoCamadas`. Relato do operador: *"Achei pouco
  intuitivo os botões de edição do cronograma ficarem fora da lista de
  cronogramas... E o design da lista em si está meio pobre e fora dos padrões do
  app."* O que um cronograma faz consigo mesmo mora na LINHA dele; o que se faz
  com a lista à vista (limpar) mora na barra.

### Gestos nos itens da biblioteca

| Gesto | Ação |
|---|---|
| Toque simples | **Substitui a playlist por este item** e o exibe no Display |
| `⋮` → ↑ / ↓ | Reordena o item na lista, uma casa por toque (v5.285). **Nos Favoritos o `⋮` saiu na v5.287**: o par mora na faixa de ações da gaveta, que abre no corpo da linha |

**O QUE FECHA A FAIXA, E O QUE NÃO FECHA.** Escolhida a opção, a caixa fecha —
ela cobre o nome, e um menu aberto por cima do item depois de já ter feito o que
se pediu é o defeito que ele existe para corrigir. **São duas exceções**, e as
duas pela mesma régua — *a ação que não TERMINA a conversa com aquele item*:

- o **par ↑↓**, porque reordenar é uma decisão que se REPETE (mover três casas
  são três toques) e fechar no primeiro obrigaria a reabrir a cada casa;
- a **estrela** (v5.289, pedido do operador: *"favoritar um item faz a gaveta de
  opções fechar, mantenha ela aberta"*), porque ela é um ALTERNADOR: o desfecho
  dela é o próprio botão mudando de desenho, ali, sob o dedo.

A estrela fechava por **dois caminhos independentes**, e consertar um só deixaria
o defeito de pé: o ouvinte de captura da caixa, e o `renderLibrary` que
`toggleFav` agenda depois do pulso — este reconstrói a linha inteira. Daí
`manterAcoesAbertas()`, que reusa o `reabrirAcoesEm` do par ↑↓ e a CHAVE que
`montarAcoesDaLinha` carimba no `li` (`data-acoes-chave`). Sem a chave não
haveria como reencontrar a linha: o mesmo item vive em duas listas ao mesmo
tempo.

**As exceções passaram de duas a quatro na v5.301, e viraram uma LISTA NOMEADA**
(`ACOES_QUE_NAO_FECHAM`, em `controle.js`) em vez de uma cadeia de `||` dentro do
`if` — cada entrada com a sua razão escrita. Entraram o **excluir** (que agora
PERGUNTA: a resposta nasce dentro da caixa, e fechá-la a levaria junto), o
**"à playlist"** (a resposta é o ✓ no próprio botão) e o **Cancelar** da
confirmação (que devolve a fileira de opções — fechar a caixa junto cobraria dois
toques de quem só desistiu).

#### A confirmação de excluir mora na linha (v5.301)

Pedido do operador: *"remova os popups de confirmar exclusão, para que todas
essas confirmações sejam inseridas direto na UI… no cronograma, coloque a
confirmação na própria gaveta de opções, com um botão de cancelar e confirmar;
durante o processo de exclusão pode trocar o ícone da thumbnail pela lixeira"*.

O modal fazia o que todo modal faz: TIRAVA O ALVO DE CENA. A pergunta era
"excluir este item?" e a tela que a fazia não mostrava mais item nenhum — o
operador confirmava de memória, numa lista de trinta linhas com nomes parecidos.
É a mesma correção da v5.207 (*"o feedback mora na interface de origem"*),
aplicada agora à PERGUNTA.

`pedirConfirmacaoNaLinha(botao, {ok, dica, aoConfirmar})` é o funil único, e ele
não conhece nenhuma das faixas por nome: pergunta ao próprio botão quem é o pai
dele. Por isso vale de graça nas três listas — a caixa do `⋮` (Cronograma e fila
da playlist) e a `.fav-acoes` (Favoritos) —, e a próxima que ganhar um excluir já
nasce com a confirmação certa.

- **O par entra no COMEÇO da faixa**, nunca no fim: a `.row-acoes` escalona a
  entrada dos botões por `nth-last-child`, que conta a partir do FIM, e um irmão
  acrescentado depois deles deslocaria o índice de todos.
- **O símbolo da pergunta é a LIXEIRA** (`.row-slot--del`), e desde a v1.4.27 ela
  mora na COLUNA DO `⋮` — ver "O `⋮` cede a coluna ao processo". Onde não há `⋮`
  (a gaveta dos Favoritos) ela entra na própria faixa, ao lado dos dois rótulos,
  pelo mesmo caminho do ✓ do renomear. **A CAPA FICA À VISTA** (v1.7.4, pedido do
  operador): com o símbolo fora dela, ela volta a ser a única parte da linha que
  diz de QUAL item é a pergunta. Numa linha NO AR o "Tirar do ar" cede o
  quadrado, pela razão com que o `⋮` saiu: é uma terceira ação num momento que já
  tem duas.
- **E A LINHA SAI DE CENA quando o "sim" é tocado** (v1.7.4). Relato: *"ao tocar
  em excluir, na confirmação, o item se transforma ao seu estado inicial sem os
  botões antes de desaparecer, isso causa extranhesa"*. Era a ORDEM —
  `fecharConfirmacaoNaLinha()` corria ANTES do `aoConfirmar`, e o que se via era
  a linha voltando ao normal durante a ida ao banco. Hoje `aoSair` a encolhe e
  apaga (200 ms, a curva do acordeão, com a margem negativa do `gap` para o vão
  sair junto) e SÓ ENTÃO o item é apagado. Daí o `linha-sim` estar em
  `ACOES_QUE_NAO_FECHAM`, pelo motivo OPOSTO ao dos outros nomes de lá: eles
  ficam porque a conversa com o item continua; ele fica porque ela ACABOU.
- **E A INVERSÃO PEDE UMA GUARDA:** `fecharConfirmacaoNaLinha` fecha *a que
  estiver aberta*, e com o `aoConfirmar` rodando antes dela há uma janela em que
  OUTRA pergunta já nasceu — MEDIDO, a exclusão de um favorito fechava o campo de
  RENOMEAR aberto logo depois, e o campo não aparecia. O `finally` só fecha a
  SUA: é a regra do botão de cancelar do cartão da preview, *ele sai com o DONO
  dele*.
- **UMA por vez**, como a gaveta. E **tudo que fecha a gaveta CANCELA**: o `⋮`
  outra vez, o toque fora, o redesenho da lista (todos passam por
  `fecharAcoesDaLinha`) e o fechamento da gaveta de um favorito. O erro possível
  aqui é o seguro — perder a pergunta custa um toque; herdar um "sim" pendente
  não tem volta.
- **A frase que o diálogo dizia** ("os arquivos só são apagados se ele não
  estiver em mais nenhuma lista") não cabe nos ~250px da faixa e não sumiu: é o
  `title`/`aria-label` do botão que executa.
- **O par DIVIDE A FAIXA AO MEIO** (v5.309, a pedido do operador): `flex: 1 1 0`
  em cada botão, um na metade esquerda e outro na direita. Eles eram do tamanho
  do próprio rótulo e encostados à direita, então "Cancelar" e "Excluir" ficavam
  colados um no outro na metade direita de uma faixa vazia — dois alvos de um
  destrutivo a 8px de distância, e metade da faixa sem dizer nada. `min-width: 0`
  porque o padrão de um item flex se recusa a encolher abaixo do conteúdo, mais
  `overflow`/reticências como garantia final para um rótulo longo.
- **A SEMÂNTICA de cada lista continua a dela.** Na fila da playlist o botão
  **não** é um `botaoExcluirDaLinha`: sair da FILA não é sair de uma lista de
  acervo, então nada de `retirarDoAr` (o item pode estar no Cronograma e seguir
  projetando, e a linha de lá o explica) e nada de `soltarAvulso` — a prateleira
  `avulsos` é detentora à parte, e soltá-la aqui apagaria a mídia que o "Tocar
  agora" segurava.
- **MAS A FILA É DETENTORA** como qualquer outra lista (`LISTS` em `db.js`, e o
  KDoc de `togglePlaylist`): o `listRemove` roda o coletor na MESMA transação, e
  sair da ÚLTIMA lista apaga os bytes. A dica diz a cláusula destrutiva por
  extenso — a mesma dos outros dois excluir ("o arquivo só é apagado se ele não
  estiver guardado em mais nenhuma lista"), no botão da linha e no "Limpar" da
  fila inteira. Um gesto que PARECE reversível e não é custa, num episódio de
  série, ~300 MB baixados em rede de celular.

#### O `⋮` cede a coluna ao processo (v1.4.27; a capa voltou na v1.7.4)

Pedido do operador: durante os dois processos o `⋮` *"contradiz o fluxo dos
botões, pois o processo de exclusão e o de renomear já devem ter métodos de
retorno/cancelamento"*; a capa sai junto *"para ter mais espaço tanto para a
gaveta de opções como para a barra de renomeação"*; e a coluna do `⋮` vira o
*"botão indicativo"* do processo.

**O defeito é de FLUXO.** Um `⋮` aceso ao lado de "Cancelar / Excluir" é uma
terceira saída para uma pergunta que já tem duas — e as três fazem coisas
diferentes: uma cancela, uma executa, e a terceira cancela **por acidente**,
porque fechar a gaveta desfaz a pergunta.

**A capa saiu na v1.4.27 e VOLTOU na v1.7.4, e as duas decisões estão certas** —
o que mudou entre elas foi a premissa. O argumento de então (*"com o nome
coberto, ela é a única coisa que ainda diz de QUAL linha é este menu"*) foi dado
por vencido porque na exclusão a capa VIRAVA UMA LIXEIRA, isto é, parava de
identificar o item. Com o símbolo morando na coluna do `⋮`, ela deixou de virar
coisa nenhuma — e o operador pediu de volta o que o argumento original protegia:
*"pode deixar visivel a thumbnail do item durante essa confirmação"*.

**Ela continua saindo na RENOMEAÇÃO**, e o par é a regra: ali o campo quer a
faixa inteira (a capa mais o vão dela são ~96px), enquanto o par Cancelar/Excluir
cabe onde a fileira de botões cabia. Quem separa os dois processos é a marca no
`li` — `excluindo` e `renomeando` —, e é ela que o CSS lê.

**E a terceira parte amarra as outras duas.** Esconder duas colunas é fácil; o
que o operador pediu foi o ESPAÇO, e o que impede que ele seja comprado com o
sumiço do símbolo é a coluna continuar ocupada. MEDIDO a 430px: a faixa vai de
**292px a 340px**, e a coluna passa a hospedar o símbolo do processo.

| processo | símbolo na coluna | o que ele é | a capa |
|---|---|---|---|
| exclusão | a LIXEIRA (`.row-slot--del`) | `<span>` inerte, `pointer-events: none` — ilustra, não decide; quem decide são os dois rótulos | **fica** (v1.7.4) |
| renomear | o ✓ (`.row-slot--ok`) | botão de verdade, que grava de onde está | sai — o campo quer a faixa |

- **Quem esconde o `⋮` é o CSS** (`:has(> .row-acoes.confirmando)`), e não o JS:
  o estado já está no DOM, e uma segunda escrita divergiria dele. A CAPA sai por
  uma regra própria, keyada na marca `renomeando`.
- **O `right` da faixa NÃO muda** — a coluna da direita continua ocupada. O
  `left` desce para a borda do conteúdo só na RENOMEAÇÃO; na exclusão a faixa
  mantém a geometria de sempre, porque a capa continua lá.
- **O slot mede o `⋮` por CONSTRUÇÃO**: ele entra nas MESMAS regras de caixa e de
  escala de ícone que o `.row-btn`, então segue `--hit` na fila e `--thumb` no
  Cronograma sem um segundo número para alguém esquecer.
- **O slot entra na guarda do `--press`** (v1.4.25): ele vive FORA da
  `.row-acoes`, e a guarda daquele lote cobre a faixa — sem acrescentá-lo,
  tocar no ✓ traria de volta o balanço do cartão.
- **E NA GUARDA DOS GESTOS DA LINHA**, que é a mais cara das duas: por baixo da
  coluna está a `.row`, cujo toque PROJETA. Sem `.row-slot` no
  `closest('.row-btn,.row-acoes,.row-slot')` do `attachRowGestures` (Cronograma)
  e do `click` da fila, tocar na lixeira poria no ar a mídia que se está
  perguntando se apaga. **`pointer-events: none` no símbolo não resolve** — o
  toque cai na linha do mesmo jeito, só que sem ninguém para barrá-lo; por isso
  o que a lixeira tem é `cursor: default`, não a saída do hit-test.

**O CAMINHO B, e é o que este desenho pode quebrar sem sintoma.** A gaveta dos
**Favoritos não tem `⋮`** — ela abre pelo corpo da linha e a faixa fica ABAIXO
dela, sem cobrir nada. Lá não há coluna a tomar emprestada, e **desde a v1.7.4 os
dois símbolos voltam para dentro da faixa**: o ✓ à direita do campo, a lixeira ao
lado dos dois rótulos. Ela morou na CAPA da v1.4.27 até ali, e saiu de lá porque
a capa deixou de estar livre.

**O que ainda os separa, e é o que fica**: o ✓ DECIDE, então ele entra sempre que
a faixa existir (um botão que some por não achar coluna deixa o renomear dos
Favoritos sem confirmação); a lixeira ILUSTRA, e por isso não entra numa faixa
que não fala de UM item — limpar a playlist, limpar o histórico, limpar uma
sessão. Ali o par de rótulos DIVIDE A CAIXA AO MEIO desde a v5.309, e um terceiro
filho a encolhe. (Esta metade custou uma reprovação do `smoke` para aparecer.)

> **A ordem importa no caminho B**: o `semSlot` roda DENTRO do
> `abrirNaFaixaDaLinha`, antes de o campo ser anexado — daí o `prepend` do campo
> em `pedirRenomearNaLinha`, sem o qual a faixa sairia com o botão na FRENTE do
> texto que se está digitando. Com a faixa vazia (o caminho normal) os dois são
> a mesma coisa.

#### E renomear mora na linha também (v1.4.25)

Pedido do operador: *"coloque o processo de renomear também dentro do item na
lista do cronograma, não como um popup de tela inteira, assim como já é feito no
processo de excluir"*.

É o argumento acima aplicado onde vale **mais**: renomear é a única ação do app
em que o nome VELHO precisa continuar à vista enquanto o novo é escrito, e a
linha logo acima do campo é a única coisa da tela que diz qual dos trinta nomes
parecidos está sendo trocado. O `appPrompt` punha o nome antigo dentro do campo
e era só isso — o instante em que ele é apagado para digitar é o instante em que
a referência some da tela inteira.

**A troca de conteúdo da faixa virou MECANISMO** (`abrirNaFaixaDaLinha`): fechar
o que estava aberto, marcar a faixa (`.confirmando`), marcar o `li`, publicar o
desfazer e devolver a caixa vazia. `pedirConfirmacaoNaLinha` e
`pedirRenomearNaLinha` entram os dois por ela — escrever o segundo por cópia do
primeiro era garantir que um dos dois esquecesse uma das cinco coisas.

- **O campo nasce com o nome atual e SELECIONADO**: trocar a frase inteira é o
  caso comum de um arquivo importado, e ajustar uma palavra continua a um toque.
- **`Enter` confirma e `Esc` cancela** (`enterkeyhint="done"`), e o ✓ é um botão
  à vista de qualquer jeito: nem todo teclado honra a dica, e um campo cuja
  única saída pode não estar lá é um campo sem saída.
- **O ✓ é QUADRADO** e não meia faixa como o par Cancelar/Excluir: ali os dois
  rótulos disputam a decisão e a régua é o dedo não errar por 8px; aqui há um
  desfecho só, e o resto da largura vale mais no campo. **Desde a v1.4.27 ele
  mora na COLUNA DO `⋮`** (`.row-slot--ok`), que já é essa caixa — o campo fica
  sozinho na faixa.
- **E A ALTURA DO CAMPO É A DOS QUADRADOS DA LINHA** (v1.4.29). Ele nasceu com
  `--hit` (34px), o piso de toque do app, contra os `--thumb` (40px) que todo
  quadrado de uma linha de lista mede desde a v5.259 — e o ✓ ao lado, que já era
  um `.row-slot`, denunciava os 6px. **Na gaveta dos FAVORITOS a régua é outra**:
  lá o vizinho é o confirmar da folha, que estica, e o campo entrou na regra da
  v5.309 (`.fav-acoes > .linha-confirma > …`) para a gaveta não dar o pulo de
  19px sob o dedo.
- **O TECLADO SOBREPÕE, não desloca** (v1.4.29; o padrão do app inteiro desde a
  v1.13.7, sem marca nenhuma no campo). É a régua que o `.popup-backdrop` já
  escrevia para a Biblioteca — *quem rola é a LISTA* —, e aqui o que o app
  encolhia para caber era a preview e o transporte. Quem põe o campo acima do
  teclado é o `revelarCampo`, rolando a lista (ver "Deslocamento com o teclado
  virtual").
- **A capa saiu de cena na v1.4.27**, junto com o `⋮` — ver a seção acima. Até
  lá ela ficava intocada aqui (ao contrário da exclusão, que a virava lixeira),
  com o argumento de continuar dizendo de qual item era o campo.
- **Nome vazio ou igual ao atual não é renomear**: os dois fecham sem gravar.
- **Tudo que fecha a gaveta CANCELA.** O erro possível é o seguro: perder o
  texto custa redigitar, gravar um nome que ninguém confirmou não tem volta.
- **O ✓ saiu de `ACOES_QUE_NAO_FECHAM` na v1.4.27**, e não porque a razão dele
  mudou: ele deixou de morar DENTRO da caixa (foi para a coluna do `⋮`), e
  aquele ouvinte só enxerga o que está dentro dela. A razão continua de pé no
  código — ele fecha a pergunta SOZINHO, DEPOIS de ler o campo, e o inverso
  faria `fecharAcoesDaLinha` desmontar o campo antes do `gravar()` e o nome
  digitado se perderia.
| `⋮` → 🗑 | **Excluir da lista.** É o PRIMEIRO botão da faixa desde a v5.289 — o mais longe do `⋮`, que fica colado na ponta direita e é o alvo tocado repetidamente (abre e fecha): errá-lo por alguns pixels caía no destrutivo. Do outro lado o vizinho é o VAZIO da caixa, que também fecha, mas é uma área larga em que ninguém mira a borda. Desde a v5.301 ele **pergunta na própria faixa**, e por isso não a fecha |

> **ELE NÃO TIRA DO AR** (v1.3.13). Havia aqui um `retirarDoAr`, e era ele — não
> o coletor — que interrompia o louvor quando o operador apagava do Cronograma o
> item que estava tocando. A dica do próprio botão é o contrato, e ela fala de
> LISTA (*"tirar isto desta lista; os arquivos só são apagados se ele não estiver
> em mais nenhuma"*); parar a projeção é outra ação, tem botão próprio (o segundo
> toque na linha) e não podia vir de carona. **A FILA já fazia assim**, com o
> motivo escrito na linha dela desde a v5.309 — era este caminho que destoava.
>
> **E A FILA VOLTOU A DESTOAR, num caso só** (v1.8.52, relato do operador):
> tirar dela o item que está no ar SEM SOBRAR NADA encerra a cena. Não é a regra
> acima com exceção — é outra régua, e o que as separa é a NATUREZA da lista, não
> a contagem de detentores: a fila é a única que o TRANSPORTE percorre, e
> esvaziá-la por cima do que está no ar não é "guardei noutro lugar", é ACABOU.
> Com fila sobrando nada muda (reorganizar não é motivo para parar o louvor), e
> nada é apagado — o item segue em `avulsos`, com os bytes. Ver
> `encerrarCenaDaFila` e os blocos 4a–4d do mesmo oráculo.
>
> E o que sustenta a mudança é o outro lado dela: `send()` fixa a cena na
> prateleira `avulsos` (ver `MODELO-DE-DADOS.md`), senão o `listRemove` apagaria
> os bytes de baixo da projeção. Isso não teria sintoma na hora — o `<video>` já
> os tem —, e só apareceria numa queda de dongle, quando o `resendSceneToDisplay`
> chamasse `getMedia` e não achasse nada. Oráculo: `tools/excluir-em-cena.test.mjs`.
| `⋮` → ✏️ | **Renomear** o item, um toque (v5.288). Ele existia só para UM item de cada vez e atrás de quatro gestos (toque longo → seleção → botão do rodapé → diálogo). Desde a v1.4.25 o CAMPO abre **na própria faixa**, como a pergunta do excluir — ver "E renomear mora na linha também". **Não entra na pasta do aparelho**, com a mesma guarda do excluir: ali o nome vem do arquivo, e um nome só no registro seria desfeito na varredura seguinte. O lápis é SVG inline — `edit` não está no subset da fonte, e codepoint ausente desenha um retângulo vazio |
| `⋮` → ♫+ | **A fila, com ESTADO** (v5.301, alternador desde a v5.302). Ele diz se o item **está** na playlist — `+` apagado, `✓` aceso em `--btn-accent` + `--accent` —, e o segundo toque TIRA. ACRESCENTA, nunca substitui: quem substitui é o toque no corpo da linha (`onTap` → `replacePlaylistWith`), e são ações opostas. **Não aparece numa cena de roteiro** — o `onTap` já desvia um cue para longe da fila (*"um versículo não é uma fila de reprodução"*), e o Cronograma é justamente a lista cheia de cues. **Não fecha a caixa**, como a estrela: o desfecho dele é o próprio botão mudando sob o dedo |

> **APAGADO ELE É UM BOTÃO NORMAL** (v1.4.25). Ele e a estrela vestiam `--line`
> — a cor de LINHA, que neste app só o `↑↓` INERTE usa —, e o operador os lia
> como indisponíveis: *"ao invés de modificar o ícone do botão e seus efeitos,
> foi simplesmente ofuscado o botão inteiro"*. Hoje apagado é o `.row-btn` de
> sempre (`--surface` + `--text`) e LIGADO é a linguagem que `tokens.css` já
> escrevia para um interruptor: `--btn-accent` + `--accent`. **O ÍCONE continua
> carregando o estado sozinho** (vazado × cheio, `+` × `✓`, relógio com `+` ×
> com `✓`) — a cor e a superfície são reforço, não a mensagem.
>
> A régua: *ofuscar não diz "desligado", diz "indisponível"* — e o app já tem
> uma linguagem para isso (`opacity: .3` + `disabled`, no `↑↓` das pontas).
| Pressionar e segurar | Entra no modo de seleção múltipla |

**O ARRASTAR SAIU NA v5.285**, das três listas de uma vez (Cronograma,
Favoritos e a fila da playlist), a pedido do operador. Com ele saíram
`attachHandle`, a medição única do `pointerdown`, a linha-guia absoluta e o
`data-fixa` das pastas. O argumento: um arrasto é um gesto CONTÍNUO com captura
de ponteiro, disputando o eixo vertical com a lista que rola por baixo. O preço
está dito — mover dez posições passou de um gesto a dez toques —, e
`reabrirAcoesEm` (a chave `lista:id`, nunca o id nu, porque o mesmo item vive em
duas listas) devolve a gaveta ao item que se moveu, com o botão sob o mesmo
dedo.

**O deslize lateral da linha saiu na v5.50.** Ele adicionava o item à playlist
(`dx <= -SWIPE`), e a única pista de que existia era um ícone a 22% de opacidade
atrás da linha (`.swipe-bg`/`.swipe-hint`, removidos junto). Um atalho que quase
ninguém descobre não justifica reservar para si o eixo horizontal da maior parte
da tela — que é o que impedia o **carrossel de abas** de funcionar sobre a
lista. A playlist continua a um toque, pelo `+` de cada resultado do acervo e
pelo popup da playlist.

Com ele saiu também o `setPointerCapture` da linha: o `pointermove` agora só
CANCELA o gesto do item quando o dedo anda mais de 10px em qualquer direção —
sem tocar no evento, que segue subindo para o carrossel e para a rolagem, que
são de quem o dedo está falando naquele momento.

**O arrasto mede a lista UMA vez** (`measureDrag`, no `pointerdown`; um listener
de `scroll` remede se a lista rolar, e `endDrag` limpa tudo no fim). Antes, cada
`pointermove` — 60 a 120 por segundo — fazia um `querySelectorAll` da lista
inteira e um `getBoundingClientRect` por item, logo depois de escrever
`li.style.transform`: um **reflow síncrono por evento**, com o arrasto
engasgando num Cronograma grande. As posições não mudam durante o arrasto (o
item se move por `transform`, que não altera o layout), então medir uma vez
basta. `showDropLine` e `dropIndex` leem o mesmo cache — a linha-guia e o
destino real nunca discordam.

**Modo de seleção múltipla:** barra substitui as abas, com contagem e botões de
**acrescentar à playlist**, favoritar, adicionar a uma pasta, renomear (1 item)
e excluir.

> **A barra não tem preenchimento** (v5.105). Ela era um bloco em
> `--accent-soft` com contorno SÓLIDO em `--accent` — a mancha âmbar mais forte
> da tela, num app cuja regra é "âmbar é navegação e marca". E, preenchida e
> contornada, ela tinha exatamente a silhueta de um ITEM SELECIONADO da lista
> logo acima (`.lib-item.selected` também é borda accent + fundo), então lia-se
> como mais uma linha marcada em vez de como a barra de ações delas. Hoje é o
> fundo que já está atrás com os botões `--surface-2` flutuando. O sinal de
> "outro modo" fica no CONTADOR em accent: uma cor de texto, não uma placa.
>
> **No rodapé ela vestia a moldura TRACEJADA do "Importar arquivos"** (v5.108; o
> tracejado saiu na v5.267 e a porta do Importar na v1.13.5) —
> mesma linha pontilhada em `--accent`, mesmo raio, mesma caixa. As duas são a
> mesma fatia do rodapé com inquilinos diferentes, e o contorno é o que diz
> isso. Não recria o problema acima: o que fazia a barra parecer um item
> selecionado era o CONJUNTO "preenchimento âmbar + contorno sólido"; uma linha
> pontilhada sobre o fundo do corpo não se parece com item nenhum da lista — é
> a convenção que o app já usa para "espaço a preencher". Na gaveta dos
> Favoritos ela segue sem moldura: ali a folha já é a moldura.
>
> **E ela saiu da caixa de controles** (v5.107): mora no rodapé fixo da lista
> (`#listFoot`), na fatia das portas — as abas não somem mais para
> abrir espaço a ela. Ali ocupa `--hit-foot` (44px), a mesma altura do botão que
> substitui; os `.sel-btn` continuam em `--hit` (34px), e é a folga de 5px de
> cada lado que os faz parecer flutuando dentro da moldura em vez de
> preenchê-la. Ver "O rodapé fixo da caixa da lista".
>
> O primeiro é da v5.50 e é onde foi parar a função do deslize à
esquerda: para itens da biblioteca, o toque simples SUBSTITUI a fila, então sem
ele montar uma sequência dependeria de um gesto que a tela não anunciava. No
botão, a mesma ação ficou visível e passou a valer para vários itens de uma vez
(`addSelectedToPlaylist`). Os itens selecionados são
indicados **só pelo realce** (`.lib-item.selected` — borda `--accent` + fundo
`--panel-2`), sem
ícone de check; a miniatura fica sempre encostada à esquerda (não há coluna
reservada). Excluir dentro de pasta virtual só remove da pasta; nas demais abas
usa `listRemove` (com gc).

#### A linha da fila tem os DOIS destinos (v1.4.25)

Pedido do operador: *"na lista da playlist, pode adicionar opções como:
adicionar aos favoritos e adicionar ao cronograma"*.

Ela era a única das três listas sem caminho para as outras duas — da linha daqui
só se saía tirando da fila —, e é o pior lugar para esse buraco: a fila é onde o
bloco de louvores é montado, e *"esta faixa merece ficar guardada"* é a decisão
que se toma justamente aí. (As outras duas já se alcançavam: a estrela e o `♫+`
estão na gaveta do Cronograma, e a folha de destinos na gaveta de um Favorito.)

A fileira do `⋮` da fila passou a ser **tirar da fila · favoritar · ao
Cronograma · ↑ · ↓** — a ordem que o operador ditou na v5.302, sem os que não
existem nesta lista (o `♫+`, porque esta LINHA é a playlist, e o renomear, que
nunca esteve aqui).

- **Os dois são ALTERNADORES com estado à vista**, pela régua da v5.302: a
  pergunta que se faz montando o culto não é "eu mandei?", é "**está lá?**". Um
  botão que só acende nunca se apaga, e desfazer custaria trocar de tela.
- **O ícone do Cronograma é o RELÓGIO** (`cronogramaIconSvg`), a família que
  `ICON.cronoAdd` já escolheu para essa lista: ele diz o que ela é — a ORDEM do
  culto — e é o que o separa à primeira vista da pilha de linhas do `♫+`. SVG
  inline nos dois estados: `more_time` está no subset da fonte, mas a variante
  com `✓` não existe, e um par em que um lado é glifo e o outro é desenho sai
  com dois pesos de traço no mesmo botão.
- **`cronoSet` é o espelho em memória da lista `imports`**, irmão do `favSet`, e
  ele não é ornamento: `libItems` só carrega a ABA ATIVA, e a fila é uma folha
  que se abre por cima da Biblioteca ou da Bíblia. Sem ele o botão nasceria
  apagado sobre um item que já está no Cronograma. Só os IDS — quem precisa dos
  registros é o `renderLibrary`, e ele já os tem quando a aba é a do Cronograma.
- **Dois repintores novos**, irmãos do `marcarNaPlaylist` e pelo motivo dele: a
  lista muda por portas que não redesenham a fila. `marcarNoCronograma` mora no
  `toggleCronograma` e no `adicionarNasListas`; `marcarFavoritos` mora no
  `recarregarFavoritos`, que é o ÚNICO ponto que reconstrói `favSet` — o
  `renderLibrary` adiado do `toggleFav` só alcança a lista de baixo.
- **Tirar daqui não apaga bytes**, e não é sorte: esta linha existe porque o
  item está NA FILA, e a fila é detentora de referência como qualquer outra
  lista — o `listRemove('imports')` roda o coletor na mesma transação e encontra
  a `playlist` segurando o registro.

#### O rodapé da folha da playlist: guardar e LIMPAR (v5.309)

A folha `#plPopup` fecha com duas ações sobre a FILA, fora do `.popup-list`
rolável (numa fila de dez itens elas têm de continuar à vista): **"Guardar como
pacote no Cronograma"** (`#plPack`, ver "Como um item ENTRA no Cronograma") e
**"Limpar a playlist"** (`#plClear`), acrescentado a pedido do operador. Tirar
item a item era o único caminho, e uma fila de culto tem oito ou dez linhas —
cada uma com a própria pergunta.

- **A SEMÂNTICA é a do excluir de uma linha da fila**, não a de um excluir de
  acervo: `AVDB.listSet('playlist', () => [])`, sem `soltarAvulso`. O que
  estiver no Cronograma, nos Favoritos, numa pasta ou no slot avulso segue
  inteiro — o `listSet` coleta só o que NENHUMA outra lista aponta, que é a
  mesma conta que o `listRemove` faz item a item. Limpar dez de uma vez é dez
  remoções, não uma operação nova. A forma com FUNÇÃO, nunca
  `listSet('playlist', [])`: ela roda dentro da transação que grava.
- **MAS A CENA ACABA COM A FILA** (v1.8.52), e por isso este caminho chama
  `encerrarCenaDaFila` quando o que estava no ar era dela — a mesma resposta da
  lixeira da última linha, porque o mesmo estado por duas portas não pode ter
  duas respostas. Oráculo: o bloco 4d do `excluir-em-cena.test.mjs`.
- **E A PERGUNTA QUE ELE FAZIA ESTAVA ERRADA** (v1.8.84). Relato do operador:
  *"ao limpar um item da playlist, ele remove ele da exibição, mas quando limpo
  uma playlist inteira, ele mantém a mídia no player ao invés de limpar
  corretamente."* O `limparPlaylist` herdou da linha a condição
  `plItems.some(noArAgora)`, que pergunta pela **PROVENIÊNCIA** do que está no
  ar — e ela responde *"não é minha"* nos dois estados em que o defeito aparece:
  tocando algo projetado de FORA da fila (um item do Cronograma, o caso comum) e
  depois do **Parar**, que preserva o `currentId` de propósito, porque é ele que
  faz o ▶ repetir a faixa. **Limpar TUDO não tem proveniência a apurar**: a
  pergunta é `!!currentId`. As duas portas passaram a ler a MESMA função
  (`tirarDaFilaEncerraCena`), que responde diferente conforme receba ou não um
  item — na LINHA a proveniência continua sendo a pergunta certa, e a v1.8.52
  fica de pé inteira.
- **E O AVISO SOBE PARA O DIÁLOGO QUANDO VAI INTERROMPER** (v1.8.84, pedido do
  operador: *"coloque também uma mensagem de aviso ao excluir um item ou playlist
  que tenha algo tocando no momento, avisando que a mídia será interrompida"*).
  Quem decidiu o desenho foi a medição do que já existia: a faixa da linha tem
  dois botões e **nenhum lugar para uma frase** — a `dica` dela vira um `title`,
  e num aparelho de toque um `title` não existe (era ela que dizia *"o que está
  no ar segue no ar"*, e ninguém nunca leu). `pedirSaidaDaFila` roteia: sem
  interrupção, a faixa de sempre; com interrupção, o `appConfirm`, que é a única
  superfície deste app que carrega uma sentença. **E só quando vai** — um aviso
  incondicional prometeria uma interrupção que o aparelho não faz, e cobraria um
  modal por item removido de uma fila que continua tocando. Oráculo:
  `fila-limpa-a-cena.test.mjs`, cujo bloco D mede justamente o caminho que NÃO
  interrompe continuando na faixa.
- **A pergunta é a mesma das listas** (`pedirConfirmacaoNaLinha`), e por isso o
  botão tem uma CAIXA só sua (`.pl-limpar-faixa`), e ela é o que torna o LADO A
  LADO possível: `pedirConfirmacaoNaLinha` usa `botao.parentElement` e esconde os
  IRMÃOS DIRETOS, então pôr os dois botões na MESMA caixa — o que "lado a lado"
  sugere — apagaria o pacote como efeito colateral do seletor. A altura mora na
  faixa, não nos dois conteúdos dela, e sem o número num lugar só a folha
  encolheria sob o dedo no exato instante em que o operador mira um destrutivo.
  `closePlPopup` **cancela**, como tudo que fecha uma gaveta.
- **Ele é a PORTA de um destrutivo, não a execução dele**, e veste o par discreto
  do "Tirar do ar" (`--surface` + `--danger-text`); o saturado
  (`--danger-soft` + `--danger-strong`) fica para o botão que de fato limpa. Dois
  vermelhos cheios anunciariam duas ações destrutivas onde há uma.
- **À ESQUERDA dos dois de guardar** (v1.8.53; eram duas linhas empilhadas, e o
  pacote ficava ACIMA): a mesma régua que pôs o excluir no começo da fileira do
  `⋮` (v5.288) — a folha abre pelo botão da barra de baixo, e o polegar chega
  pela borda direita. A ordem no HTML é o que a regra `.confirmando ~ .pl-pack`
  lê, então trocá-la exige trocar o combinador junto.
- **DOIS DESTINOS, DOIS BOTÕES DE SÍMBOLO** (v1.8.54, pedido do operador: *"sejam
  os mesmos dois botões de salvar no cronograma ou salvar nos favoritos, pois
  este já é o padrão do resto do sistema"*). A estrela e o relógio são os MESMOS
  da gaveta de cada item — `starSvg` e `cronogramaIconSvg`, a fonte única deles,
  chamadas na carga; copiar os `path` para o HTML seria a segunda cópia de um
  desenho. Eles são QUADRADOS de `--faixa-alt` (a mesma altura da faixa, herdada
  como propriedade personalizada) e o rótulo é do "Limpar", que fica com o resto.
  **Sem rótulo por MEDIDA**: com três ações sobram 49,9px de texto por botão a
  320px, e só "Limpar" já mede 51,2px. Quem diz o destino é o `aria-label`, e ele
  anda com o `title` no apagado — dizer "guardar" a quem não pode guardar seria
  uma promessa falsa. **A diferença entre os dois destinos é do `criarCue`**, e
  não é técnica: Favoritos não repetem, o Cronograma pode.
- **E A PERGUNTA OCUPA A FAIXA INTEIRA** (v1.8.53): enquanto ela está aberta, os
  dois de guardar saem. Até aqui o pacote ficava, e a razão escrita era a ALTURA
  — empilhados, levar o vizinho junto tirava uma linha do rodapé. Lado a lado
  essa razão não existe (MEDIDO: 42px com e sem eles), e o que sobra manda tirar:
  em todo o resto do app a pergunta substitui os irmãos, e com o pacote de pé o
  par ficava com METADE da faixa — MEDIDO a 320px, 69,6px por botão, com
  "Cancelar" truncado num destrutivo. O combinador é o irmão GERAL (`~`) desde a
  v1.8.54: com o adjacente, só o primeiro dos dois sairia.
- **E ela diz "Confirmar", não "Limpar" de novo** (v1.8.54, pedido do operador).
  A régua: o botão do meio da pergunta repete o verbo só quando o botão que a
  abriu não o diz. Aqui ele diz — e o mesmo vale para o "Limpar todo o
  histórico"; já a lixeira de UMA sessão do Histórico não tem rótulo, e lá a
  palavra na confirmação continua sendo a única que nomeia o dano (R9). Quem
  nomeia o dano por extenso, nos três, é a `dica`.
- **Com a fila vazia a caixa inteira sai**: um botão que não faz nada é pior que
  botão nenhum, e um destrutivo inerte ensinaria que tocá-lo é inofensivo. **A
  altura, porém, mora na FAIXA** (v1.8.54): os dois de guardar a herdam por
  `align-items: stretch`, e com a caixa do limpar escondida eles ficavam com a
  altura do próprio conteúdo — MEDIDO pelo portão de geometria, 23px contra um
  piso de toque de 34px.
- **E o "Guardar" APAGA com menos de duas mídias** (v1.8.53, pedido do operador:
  *"não faz sentido guardar uma playlist de um item só"*). A recusa já existia no
  toque; o que muda é a troca da v1.8.50 — explicar depois é pior que não
  oferecer. A pergunta é a **de quem executa, literalmente** (`!isCue`, porque um
  pacote é uma fila de reprodução): uma fila de uma mídia mais um cue tem
  `length` 2 e um só item guardável, e a pergunta larga acenderia o botão para
  recusar no toque. **Os dois apagam juntos**: o limiar é do PACOTE, não do
  destino.
- **A FOLHA FECHA QUANDO A FILA ACABA** (v1.8.54, pedido do operador: *"já que
  não há mais nada ali"*), pelas duas portas e por uma função só
  (`fecharFilaVazia`). Ela NÃO mora no `renderPlaylist`: ali a condição seria
  *"a fila está vazia"*, verdade também quando a folha é ABERTA vazia — o que os
  oráculos fazem, e o portão de geometria depende de fazer. A condição certa é
  *"a fila ACABOU DE esvaziar"*, que é um evento com dois donos conhecidos. Com
  item sobrando ela continua aberta: fechar no meio de uma reorganização seria
  tirar a folha da mão de quem está usando.
- **E O CORPO DA FOLHA VAZIA NÃO DESENHA MAIS NADA** (v1.8.54, pedido do
  operador: *"essa mensagem não tem mais utilidade… ele não tem acesso a janela
  se ela não tem nada"*). A premissa é verdade por construção: o botão que a abre
  nasce apagado com a fila vazia desde a v1.8.51, e desde este lote ela fecha
  sozinha. A frase de ensino não se perdeu — ela mudou de casa naquele lote e é o
  `title` do botão apagado; este bloco era a segunda cópia. **DOIS ORÁCULOS
  DEPENDIAM DAQUELE `<li>`** como prova de que o `renderPlaylist` tinha rodado, e
  o sinal deles passou a ser o `#plBtn` apagado — que sai da mesma função e não é
  um nó que uma decisão de interface possa apagar.

Medido de ponta a ponta em `tools/smoke.mjs` ("LIMPAR A FILA INTEIRA") e em
`tools/rodape-da-playlist.test.mjs` (a geometria, os dois destinos e o fecho).

### Favoritos: uma lista só (marcados + pastas do aparelho)

É o caminho curto para o que o operador usa toda semana, e desde a v5.237 são a
**primeira SEÇÃO da Biblioteca** — a gaveta de tela cheia (`#favPopup`) que os
hospedava saiu por inteiro na v5.294, e com ela a BUSCA dentro de uma pasta
(sem substituto: a barra da Biblioteca varre `allCollections()`, que não alcança
o catálogo de pastas) e a SELEÇÃO MÚLTIPLA lá dentro, que era onde morava o
excluir de ARQUIVO FÍSICO por item. Esta última é menos perda do que parece: um
arquivo apagado de uma pasta sincronizada volta na varredura seguinte, e quem
apaga de verdade é o "Excluir pasta e arquivos sincronizados" da própria linha.

**Não existem pastas VIRTUAIS.** O que havia (`folders`/`folder_<id>`, o seletor
`#folderPopup`, o `#selFolder` da seleção múltipla, `renderVirtualFolders`,
`addToFolder`) saiu, e o conteúdo delas não se perdeu:
`migrarPastasParaFavoritos` sobe cada item para `favs` e **só então** derruba o
atalho. A ordem das duas metades é a garantia inteira — `folderDrop` apaga a
mídia que ficou sem detentor, e depois do `listAdd` ela tem um; invertida, um
item cujo único dono era um atalho sumiria do app **e do disco**, calado.

**A organização não é hierarquia, é ORDEM:** a lista é a `favs` (ordem de
chegada até alguém mexer nela), com o mesmo par ↑↓ do Cronograma. **As pastas
sincronizadas ficam no TOPO** — a lista de favoritos cresce por baixo delas, e no
fim cada favorito novo as empurraria para longe.

**O TOQUE NA LINHA NÃO PROJETA: ele abre a gaveta da Biblioteca.** O `⋮` e a
faixa `.row-acoes` existem para caber numa linha que responde ao toque com OUTRA
coisa (no Cronograma, projetar): sem lugar embaixo, a gaveta só tinha para onde
ir por CIMA do título. Com o corpo da linha livre ela desce para onde desce em
toda a Biblioteca, e a sobreposição deixa de existir por construção.

Esta lista mora DENTRO da Biblioteca, e é isso que decide o lado da regra: a
Biblioteca é a tela em que se PREPARA (o toque abre opções) e o Cronograma é a
lista com que se OPERA (o toque projeta). O `⋮` continua inteiro lá e na fila da
playlist.

`renderItemMenu` é a MESMA maquinaria de destinos (`songMenuItem` com `destino`,
`destExecutor`, `destRemontar`, `destConfirmRow`) apontada para a `<ul>` do corpo
da linha. O que ela não tem: **seletor de variante** (o registro já existe) e
**"Favoritar"** (o item É um favorito).

**A ESTRELA NÃO ENTRA NA FAIXA DE AÇÕES; fica a LIXEIRA.** Nesta lista as duas
terminam num `listRemove('favs', id)`, e: (1) aqui a estrela é alternador de UMA
direção — todo item já é favorito, ela nasce acesa, e o único toque possível é o
que apaga; (2) a lixeira PERGUNTA — e desde a v5.301 a pergunta nasce na PRÓPRIA
faixa, com o par Cancelar/Excluir no lugar dos botões e o símbolo da lixeira ao
lado deles (ele morou na CAPA da v1.4.27 à v1.7.1, e saiu de lá quando o operador
pediu a miniatura à vista durante a confirmação); (3) ela solta a prateleira
invisível (`soltarAvulso`), que é a diferença
entre "a linha sumiu" e "os bytes saíram". Nas outras listas a estrela fica, e
ali ela alterna de verdade.

**O RENOMEAR CHEGOU A ESTA FAIXA NA v5.301** (pedido do operador: *"adicione o
botão de renomear nas opções dos itens individuais dos favoritos"*). Ele existia
só na linha do Cronograma desde a v5.288, e o favorito é justamente onde o nome
importa mais: a lista é a que o operador MONTA para reencontrar coisas, e um
arquivo importado chega com o nome que o aparelho deu a ele. Ele entra pela mesma
porta do excluir — dentro do `lista ?`, não ao lado dele —, e é essa guarda que o
mantém FORA da pasta do aparelho, onde o nome vem do arquivo e um nome só no
registro seria desfeito na varredura seguinte.

**A ORDEM É A DO CRONOGRAMA** (v5.302): **excluir · renomear · ↑ · ↓**, *"com a
ressalva de não contar com os itens que não existem naquela lista"*. Faltam dois:
a ESTRELA (aqui ela e a lixeira terminam no mesmo `listRemove('favs')` — ver
acima) e o botão da PLAYLIST, que nesta gaveta é uma LINHA da folha de destinos,
com caixa de marcação.

#### E ela divide a linha com o CONFIRMAR (v5.302)

Pedido do operador: *"ponha o botão de confirmar as escolhas do play dos
favoritos para que ele fique lado a lado … ajustado com a altura dos botões"*. A
faixa era um bloco próprio no pé da gaveta, logo abaixo da linha do confirmar —
duas faixas empilhadas para o que cabe numa, e a gaveta inteira mais alta por
isso, num acordeão cuja regra é manter a decisão sob o dedo.

Quem a leva para lá é o hook **`aoLado`** que a v5.286 abriu para o "Ver a letra":
a `.song-menu-go-row` já é um flex de dois filhos em que o confirmar CRESCE e o
irmão fica com o que precisa. Nenhum mecanismo novo — `renderItemMenu` ganhou um
quarto parâmetro e o repassa pelo estado (`songMenuFor.aoLado`), porque quem monta
a linha de fecho é a folha, e ela não conhece o dono da gaveta.

- **O nó é O MESMO a cada remontagem.** `renderItemMenu` refaz a lista a cada
  marca (`alvo.innerHTML = ''`), e devolver uma faixa NOVA perderia os ouvintes
  e — pior — apagaria uma confirmação de exclusão aberta, deixando a lixeira na
  miniatura sem nenhum botão que a explique. Devolvendo o mesmo nó, o
  `appendChild` apenas o MOVE.
- **E O IRMÃO VEM POR ARGUMENTO, nunca do global `songMenuFor`.** É a regra que
  este recurso comprou caro: *um slot global só serve para o que não tem ALVO*.
  Quem consome o irmão é o `desenhar()` de UMA linha — um fecho que sobrevive ao
  global por dois caminhos que já existiam: a gaveta é montada uma vez
  (`gavetaMontada`), então reabrir uma linha não reescreve `songMenuFor`; e
  `closeSongMenu()` o anula com a gaveta ainda aberta. Enquanto o irmão era uma
  fábrica de botão descartável ("Ver a letra"), isso era invisível. Com um nó
  vivo ligado a um item, virava a faixa de uma linha dentro da gaveta de outra —
  **a lixeira de A excluindo o item B** — e, depois de um Confirmar, a faixa
  simplesmente não reanexada. `destConfirmRow(aoLado)` recebe; o global ficou só
  como caminho da Biblioteca, onde ele é fábrica. E reabrir uma gaveta reaponta
  `songMenuFor`, para *"ele descreve a gaveta ABERTA"* voltar a ser verdade.
- **DE QUE LADO O IRMÃO ENTRA É DECISÃO DE QUEM O FORNECE** (v5.307, pedido do
  operador): a faixa de ações de um Favorito vem **antes** do confirmar, o "Ver a
  letra" da Biblioteca continua **depois**. O sinal viaja no próprio nó
  (`data-antes`) e o `destConfirmRow` só o consulta — ele não conhece nenhum dos
  dois. **É DOM, não `order`/`row-reverse`:** os dois dariam o mesmo desenho com a
  ordem de FOCO invertida, numa faixa cujo primeiro botão é a LIXEIRA. O oráculo
  (`boot-nativo.test.mjs`) mede a geometria **e** exige que o DOM concorde com
  ela, senão a próxima inversão volta por um `order` e passa.
- **Uma altura só.** O confirmar mede `--hit` mais o padding dele (53px); os
  botões traziam `--thumb` fixo (40px) e boiariam no meio. `height: auto` desarma
  o valor fixo e o `stretch` da linha os iguala. A LARGURA continua `--thumb`: o
  pedido era de altura, e estreitar o alvo trocaria um acerto por um erro.
- **Enquanto a linha PERGUNTA, o confirmar da folha sai de cena.** Dois botões de
  confirmar lado a lado diriam coisas opostas — "mande para onde marquei" e "tire
  da lista". Ele volta inteiro no Cancelar, com as marcas onde estavam. E o par
  Cancelar/Excluir veste a receita de altura do botão que substitui, senão a
  gaveta encolhe 19px sob o dedo no instante em que se mira um destrutivo.
- **A faixa passou a ser montada NO PRIMEIRO TOQUE**, com o resto da folha: ela é
  escrita por `renderItemMenu`, que só roda quando a gaveta abre. Antes existia no
  DOM desde o desenho da linha — quem medir sem abrir não a encontra.

**O Parar na capa continua sendo um toque direto**: tirar do ar é a decisão que
não pode custar uma gaveta. E o preço está dito: projetar um favorito passou de
um toque a três — em troca, as três listas ficam a um toque do mesmo lugar
(mandar um favorito à playlist não tinha caminho nenhum nesta tela).

As regras da gaveta são keyadas em `.lib-item`, não em `.hymn-result`: o mesmo
envelope serve as duas listas, e uma segunda anatomia divergiria no próximo
ajuste.

**A listagem é densa**: ela NÃO herda a métrica do Cronograma, e as
duas não fazem a mesma coisa — lá cada linha é ALVO de toque no meio de um culto
e o espaço em volta evita o toque errado; aqui o operador vem PROCURAR. Encolheu
a MOLDURA (miniatura 40→32px, respiro, espaço entre linhas), nunca o TEXTO nem os
ALVOS (os botões seguem em `--hit`, 34px, e é esse piso que limita o resto).
Medido: o passo de uma linha cai de ~57px para ~48px.

#### A pasta abre INLINE, como um álbum

O corpo é montado **uma vez, e só quando a pasta abre**: uma pasta sincronizada
tem centenas de arquivos, e montá-los para todas elas a cada redesenho da seção
seria o trabalho de DOM da tela inteira por algo que ninguém está vendo — a mesma
decisão do corpo de um grupo da Biblioteca.

**Uma anatomia só para as duas listas.** `favItemRow` virou `linhaDeItem`, e o
que muda entre um favorito e um arquivo de pasta viaja em `opts`:

| | favorito | arquivo da pasta |
|---|---|---|
| `lista` | `'favs'` — a faixa de ações tem ↑↓, renomear e excluir | **nenhuma** — a ordem vem do disco, e apagar (ou renomear) aqui seria mexer no ARQUIVO |
| `destinos` | playlist · Cronograma | playlist · Cronograma · **Favoritar** |

A segunda linha é a régua de sempre: numa lista de favoritos "Favoritar" não muda
nada, e numa pasta ela é o caminho de promover o arquivo. Uma escolha que não faz
nada é pior que escolha nenhuma — daí ser parâmetro, e não um `if` dentro do
menu.

**`pastaAberta` é um NOME e não um conjunto**, pela razão do `grupoAberto`: "duas
pastas abertas" deixa de ser uma regra que alguém precisa lembrar e passa a ser
uma frase que não dá para escrever. Ele nasce no topo do arquivo, porque é lido
por um caminho de render — a zona morta temporal que já derrubou o app quatro
vezes — e existe porque favoritar um arquivo de dentro da pasta redesenha a
seção: sem essa memória, cada ação fecharia a pasta.

Os arquivos saem ordenados por **nome**: a ordem do disco é a de gravação, e não
diz nada a quem está montando um culto.

##### A seção não pode ficar para trás do banco

`deleteOpfsFolder`, `syncDeviceFolder` e a limpeza de catálogo terminam em
`load()`, que é o funil onde `favItems`, `favSet` e `opfsFolders` são reaplicados
ao estado do módulo — mas `load()` redesenhava o Cronograma (`renderLibrary`) e
mais nada, e a seção de Favoritos é desenhada por `renderFolderList` com
`favHost`. Excluir uma pasta a tirava do banco e a deixava na tela.

`sincronizarFavoritosNaBiblioteca()` entra no fim do `load()`, e a guarda é uma
**assinatura**, nunca um redesenho incondicional: `load()` roda por dezenas de
caminhos com a Biblioteca aberta, e refazer a seção em todos eles fecharia a
gaveta de opções que o operador acabou de abrir. Ela é reconstruída só quando o
que ela DESENHA mudou (os ids dos favoritos e os `id:contagem` das pastas).

Com isso o redesenho explícito do `moverNaLista` **saiu**: ele virou o SEGUNDO, e
`reabrirAcoesEm` é consumido pelo primeiro — o segundo reconstruía a linha sem a
gaveta aberta, tirando o botão de baixo do dedo.

##### O aninhamento cobra o preço: `>` e nunca descendente

`.folder-opfs` é o primeiro `.lib-item` deste app que **contém outros
`.lib-item`**, e todo seletor DESCENDENTE keyado em `.lib-item` vaza para dentro:

| selector | o que ele passou a alcançar |
|---|---|
| `.lib-item.expanded .hymn-gaveta` | a pasta ABERTA satisfaz o `.expanded`, então a gaveta de TODO arquivo lá dentro virava `display: block` |
| `.lib-item:not(.vendo-letra) .item-detalhe` | a pasta nunca tem `.vendo-letra`, então ela escondia o detalhe de um arquivo que TEM |
| `.lib-item:has(.hymn-gaveta :active)` | não alcançava `.folder-itens`, e o `--press` da pasta encolhia com o toque num arquivo |

A primeira linha explica dois sintomas de uma vez: a faixa preta embaixo de cada
arquivo era a gaveta vazia dele, e o segundo toque tirava a classe do item **sem
esconder nada**, porque quem as mantinha visíveis era a pasta.

**A regra: a gaveta é do item que a POSSUI, então toda regra dela é `>`.** Um
seletor descendente responde *"existe algum ancestral assim?"*, e a resposta
muda no dia em que alguém aninha o componente — sem erro em lugar nenhum, e num
lugar que não é o da causa. O feedback de toque virou uma linha só para os três
blocos que uma linha apenas HOSPEDA (`.row-acoes`, `.hymn-gaveta`,
`.folder-itens`): quem encolhe é a peça tocada.

E o quarto item era de geometria: o arquivo começava colado na borda do cartão
da pasta (x=18), com a miniatura na mesma coluna da miniatura DA PASTA — lendo-se
como irmão dela em vez de conteúdo. Com o recuo de `.4rem` no corpo ele passa a
ocupar a coluna do favorito logo abaixo (24 e 24; miniaturas em 32 e 32), que é o
que o álbum já fazia pelo padding do `.coll-open`.

#### A ESTRELA É UM BIT, NÃO UM GRUPO

"Favoritos" já foi um recurso de **pastas virtuais** renomeado — o estado prova
(as chaves eram `folders`/`folder_<id>`). Trocou-se o rótulo e o ícone; o modelo
continuou sendo pasta, e daí saíam os três incômodos que o operador relatava:

- **"sempre precisa de uma pasta"** — não existia o ato de *favoritar*. Com zero
  pastas criadas, marcar o primeiro favorito custava seleção → estrela →
  "Nenhuma pasta ainda" → criar → nomear → confirmar. Seis passos para um toque.
- **"não é um acesso rápido"** — a porta era o botão no FIM da lista do
  Cronograma, e só ele.
- **"não abrange tudo"** — `folder_<id>` é um array de ids de MÍDIA, então
  versículo, mensagem, cronômetro e sorteio não podiam ser favoritados.

As três respostas: a lista plana **`favs`** (uma das `LISTS`, portanto detentora
de referência de verdade), a **estrela em toda linha** e as **cenas de roteiro**
(`kind: 'cue'`), que deram identidade de item ao que antes era só uma tela.

- **A estrela é PREENCHIDA quando marcada e contornada quando não**, a convenção
  universal de favorito. Por isso ela é **SVG e não glifo**: a fonte é um subset
  ESTÁTICO da família *Outlined* (sem o eixo `FILL` da variável), e o glifo
  `star` desenha sempre a mesma estrela vazada — cor sozinha deixa a dúvida entre
  "marcado" e "dá para marcar". A desmarcada é `--line`, não `--muted`: discreta
  o bastante para o olho passar batido pela lista, forte o bastante para ser
  achada quando se procura por ela.
- **Estrela = favorito, sempre.** Enquanto as pastas virtuais existiam elas
  também usavam estrela, e o mesmo símbolo dizia duas coisas na mesma tela.
- **Favoritar uma música do acervo continua BAIXANDO o arquivo**, e é
  deliberado: o que se espera de um favorito num domingo de manhã é que ele
  TOQUE, inclusive com a rede da igreja fora do ar. O que mudou é o destino (a
  lista `favs`, direto), não o custo.
- **Excluir na RAIZ é desmarcar**, e isso precisa de um ramo próprio
  em `deleteSelected`: sem ele o `else` genérico caía em
  `listRemove('folders', id)` — a chave do ÍNDICE de pastas, que guarda objetos
  e não ids. Um no-op silencioso, com o operador vendo o item continuar na lista
  depois de mandar excluí-lo.

> **A GAVETA DE TELA CHEIA SAIU (v5.294).** Os Favoritos foram para dentro da
> Biblioteca como a **primeira seção** dela, e a pasta do aparelho passou a
> abrir **INLINE** (v5.290) — foi isso que tirou o último caminho até a gaveta.
> Saíram com ela `#favPopup`, `#favList`, `renderFavHeader`, `favVoltarPara`,
> `garantirGaveta`, `openFavorites`/`closeFavorites`, o `listHost()` de dois
> containers e o `hostSelbar` de duas casas. **Hoje há UM host**: o corpo
> marcado com `data-fav-corpo` dentro de `#hymnResults`, desenhado pelo mesmo
> `renderFolderList` via `favHost`/`favAlvo()`, dentro de
> `comBaldeDeMiniaturas('fav-biblioteca', …)`. O `__avBack` perdeu o degrau da
> gaveta junto.

> **E A `object-URL` DE UMA MINIATURA É DO ITEM, NÃO DO RENDER** (v1.7.4, com a
> chave corrigida na v1.7.8). Relato: *"Os itens da lista de favoritos, tem suas
> thumbnails piscando durante processos de download na biblioteca"*. A Biblioteca
> é redesenhada a cada 400 ms enquanto um download corre, e cada passada REVOGAVA
> as URLs da anterior para criar outras da MESMA capa — uma `<img>` com `src`
> inédito não tem decodificação em cache: ela nasce vazia e pinta no quadro
> seguinte, três vezes por segundo, em toda linha com capa.
>
> `thumbUrlDaCapa` guarda uma URL por CAPA (mais `decoding="sync"`, que é a outra
> metade: com a decodificação assíncrona o elemento novo ainda esperava um
> quadro).
>
> **A CHAVE É `id|tamanho|tipo`, e não o objeto Blob** (v1.7.8). A v1.7.4 keou
> pelo BLOB, e aquilo cobria o relato original e só ele: o blob é o mesmo OBJETO
> entre dois redesenhos porque quem o segura são as listas em MEMÓRIA. Mas um
> `load()` as relê do IndexedDB, e **um blob relido é outro objeto** — toda capa
> da tela ganhava URL nova de uma vez. E `load()` roda em TODA escrita no banco:
> o relato seguinte foi *"as mesmas miniaturas piscando no cronograma ao excluir
> outro item"*, que é exatamente isso.
>
> Cada pedaço da chave responde a uma coisa: o **`id`** é o que sobrevive à
> releitura, e o par **`size`/`type`** é a impressão digital que impede uma capa
> TROCADA de ser servida da memória — hoje nenhum caminho substitui a miniatura
> de um registro existente, e o dia em que um existir ele mudará o tamanho. Sem
> `id` a chave é o próprio blob, que é o comportamento da v1.7.4: pior caso, o
> de antes.
>
> **De quebra, o MESMO item em duas listas passa a ter UMA url.**
> `listItems('imports')` e `listItems('favs')` são duas leituras, então a mesma
> capa vinha como dois blobs e ocupava a memória duas vezes.
>
> **E a varredura passou a ser pela UNIÃO dos baldes** (`varrerMiniaturas`), não
> pela diferença: uma URL só morre quando nenhum host a desenha. Isso fecha POR
> CONSTRUÇÃO a classe de defeito que o balde por host existia para tratar — um
> host revogando o que o outro tem em cena. O `renderLibrary` passou a publicar
> o balde dele no `finally`, como a outra casa já fazia: publicá-lo ANTES do
> render deixaria a varredura ver este host vazio no meio da própria passada.
>
> **E há um TERCEIRO balde, que é o que este desenho pode quebrar sem sintoma:**
> o corpo de uma PASTA DO APARELHO é montado por uma função ASSÍNCRONA
> (`filesByFolder`), depois de o balde do render ter sido devolvido — sem
> `'pasta-aberta'`, aquelas capas caem num conjunto que nenhum host publica e a
> varredura seguinte as apaga da tela. UMA chave, e não uma por pasta: só há uma
> aberta por vez, então abrir outra substitui o balde; uma chave por id deixaria
> de pé, para sempre, os blobs de toda pasta já visitada. Oráculo:
> `tools/miniaturas-estaveis.test.mjs`, que mede a estabilidade nos DOIS hosts do
> relato — a Biblioteca (bloco C) e o Cronograma (bloco E) — porque um tem balde
> próprio e o outro não.

O mecanismo por baixo continua usando as MESMAS chaves de state (renomear a
leitura não pode custar a biblioteca de ninguém) — o que mudou é o
enquadramento: não é "onde os arquivos moram", é "o que eu marquei".
A lista tem **duas** naturezas, sem cabeçalho entre elas — é uma lista só:

1. **As pastas do aparelho**, no TOPO, com o botão de re-sync e o de excluir.
   Sem cabeçalho porque não são uma subdivisão da lista: são outra coisa, e o
   desenho já diz isso (ícone de pasta, contador, sincronizar e excluir na mesma
   linha).
2. **Os itens marcados** (`linhaDeItem`), na ordem da lista `favs`. O toque no
   corpo abre a gaveta de opções; as ações da linha (↑↓, excluir) moram na faixa
   no pé dela.

   (O agrupamento por TIPO que existia aqui — Músicas · Vídeos · YouTube ·
   Imagens · Apresentações · Versículos · Letras · Mensagens · Tempo · Sorteios ·
   Pacotes · Outros — supunha que a primeira coisa que o operador sabe sobre o
   que procura é a CATEGORIA; com o item onde ele mesmo o pôs, a primeira coisa
   que ele sabe é o LUGAR. Doze cabeçalhos ainda custavam altura.)

**Pastas sincronizadas (OPFS)** — o fluxo principal para bibliotecas grandes.
`window.showDirectoryPicker()` pede permissão **uma única vez**, na
sincronização: os arquivos de mídia são **copiados em streaming para o OPFS**
(`folders/<folderId>/<arquivo>`) e catalogados no store `files` (metadados +
thumbnail gerada na hora). Depois disso, abrir o app, listar, buscar e reproduzir
**nunca pede permissão** — o catálogo responde na hora e o stage resolve os bytes
do OPFS sob demanda.

- **Re-sync**: tenta reutilizar o handle salvo em `opfs-folders` (browsers que
  persistem permissão nem mostram prompt) e cai no picker se necessário.
  Arquivos com mesmo nome+tamanho+data são pulados; novos/alterados são
  copiados. **Aditiva** — nada é excluído automaticamente.
- **A pasta é gravada ANTES do primeiro arquivo**, com ponto de controle a cada
  25. Gravando o índice só no fim, uma sincronização interrompida deixava 300
  arquivos escritos e NENHUMA pasta que os apontasse: órfãos, invisíveis na
  tela, ocupando gigabytes — e o coletor de lixo, que existe para recolher
  registro sem dono, os apagava. A retomada (o laço pula o que está em dia por
  tamanho + data) sempre existiu; o que faltava era ela ter o que retomar.
- `navigator.storage.persist()` é solicitado na sincronização, para proteger os
  arquivos contra descarte do browser.
- Itens da pasta têm o `+` que adiciona o **id do catálogo** ao Cronograma
  (zero-cópia — `getMedia` resolve pelo fallback).
- Excluir a pasta (com `appConfirm`, o diálogo do app — não há mais nenhum
  `confirm()` nativo na base) apaga o diretório OPFS inteiro, os registros do
  catálogo e as referências em listas.

**Favoritos (`favs`)** — a lista plana, marcada pela estrela de cada linha ou
pela estrela da seleção múltipla (`#selFav`). É onde as CENAS DE ROTEIRO também
podem morar: um versículo, um preset de cronômetro ou um sorteio guardado é um id
como qualquer outro.

### Editar mídia (v1.12.0 → v1.12.10)

Seção `#edicaoSecao` de Configurações (uma folha própria até a v1.12.48), aberta pelo tile "Editar mídia" (nos DOIS modos). Módulo `// ===== EDITAR MÍDIA` do `controle.js`; banco em `shared/db.js` (`addEdicao`, `resolverEdicao`, `baseDe`, `adotarBases`, `addBase`, `basesDoEditor`); motor em `shared/stage.js`.

- **Item virtual:** registro `media` com `edicao {origem, inicio, fim, fadeEntrada, fadeSaida, soAudio}`; `getMedia` o devolve RESOLVIDO (bytes do original, duração do trecho, letra deslocada), `getMediaCru` devolve o registro. O original é segurado por `lerDetentores` (também pelo rascunho `edicaoRascunho`); o do catálogo `files` é adotado para `media` por `adotarBases` antes de `purgeCatalogRecords` apagar os bytes. A origem nunca encadeia.
- **O original adotado guarda `opfsPath`, nunca o `File` do OPFS (v1.12.22):** o Chromium grava no IndexedDB um `File` vindo do OPFS POR REFERÊNCIA — apagada a pasta, `size` continua certo e `arrayBuffer()` lança `NotFoundError` (o item editado seguia na lista e não tocava, e o pacote exportava o blob morto). `adotarBases` copia os bytes EM FLUXO (`stream().pipeTo`) para `bases/<id>` (`caminhoDeBase`) antes de voltar — isto é, antes do `opfsDeleteDir` — e grava o registro `media` com `opfsPath` e `blob: null`. Quem apaga o arquivo é o `gcOrfaos`, que no fim chama `varrerBases`: tira de `bases/` o que nenhum registro aponta, pulando o arquivo do último minuto (adoção em curso). `bases/` não é "arquivo sem coleção" no pacote (`AVDB.ehCaminhoDeBase`): o original adotado só viaja pelo `pacoteBases`. Oráculo: D1 do `edicao-de-midia` (LÊ os bytes depois do `opfsDeleteDir`; coleta com o relógio adiantado).
- **Um fim só no corte (v1.12.22):** `marcarFimNatural` espera o fade de saída do palco antes de marcar `ended`, e nesse meio-tempo o `<video>` segue tocando; sem guarda, cada `timeupdate` achava `resta < 0` e o `vigiarCorte` despachava outro `ended` sintético (MEDIDO: ~17 `onEnded` até o fim do arquivo, com o `FADE` fixo do app e um item sem "Fade de saída"). `fimEmCurso` nasce no INÍCIO do fim (antes do `await`), é checada em `vigiarCorte`/`encerrarNoCorte`/`marcarFimNatural` e morre onde uma reprodução recomeça (`ended = false` em `play`/`load`/`clear`/`fadeOutToBlack`, e no `seek`). Oráculo: B5 do `edicao-de-midia`.
- **Duas vistas na mesma seção** (a troca ANIMA a altura, `animarAlturaDasSecoes`, v1.12.48): formulário e seletor. O seletor é a lista de grupos da exportação (Cronograma, Playlist, Favoritos, Biblioteca por coletânea, "Importados para edição"), com busca e "Importar arquivo" (`addBase`: bytes só para o editor, fora de toda lista). Linhas SEM caixa de marcação (escolha de um; `edicaoLinha(..., null, ...)`).
- **Carga:** `edicaoCarregarLista` mostra spinner por `EDICAO_CARGA_MS` (1 s) antes da lista; sem ele a leitura assíncrona dos grupos aparecia como "nenhuma mídia". Trocas de vista entram por `edicaoEntrar` (`@keyframes edicao-entra`).
- **A abertura desenha NO ATO (v1.12.52).** Relato do operador: *"ela abre grande, encolhe para carregamento da lista e depois fica grande quando a lista está pronta"*. A troca de seção mede a altura final LOGO DEPOIS de chamar `aoAbrirEdicao`, e ele desenhava só depois de um `await` (o rascunho): a caixa animava até o desenho da abertura ANTERIOR (a lista inteira, ou nada na primeira), o spinner entrava no meio da animação sem animar, e no fim ela saltava. MEDIDO a 430 px: 1ª abertura 0→121 animado e salto a 299; 2ª 0→342, cai a 299, volta a 342; com rascunho, 0→121 e salto a 504. Hoje o primeiro quadro já é o desta abertura — o formulário em memória, ou o seletor com o spinner —, o spinner RESERVA a altura da última lista desenhada sem busca (`edicaoAlturaLista`, `min-height` da `#edicaoLista` só durante a carga), e o que chega no meio da troca continua animando (o `fim()` de `mudarSecao`, ver "As seções de Configurações"). Depois: 1ª 0→299→342 animado; 2ª 0→342 uma vez só; com rascunho 0→299→504 animado. Oráculo: C0 e C3a do `edicao-de-midia`.
- **SEM TEXTO DE ESTADO (v1.12.10):** o rodapé da janela não tem nota (`#edicaoNota`/`edicaoDizer` saíram, e o recado "Lendo a duração…"/"Item criado…"/erros com eles). O retorno é o pulso do botão que o operador tocou (`responder`: `ok` pelo `adicionarNasListas`/Confirmar, `erro` em criar/salvar que falha e no Importar arquivo que não lê). Falha sem botão à vista (mídia que sumiu ao abrir) não diz nada. Os oráculos esperam o FATO (o rótulo do nome vira "Nome do item" depois de criar; o banco mostra o `fim` novo depois de salvar), nunca um texto.
- **Card (v1.12.9):** o texto do card do item nunca quebra (uma linha por rótulo, ping-pong `edicaoRolarTextos` se não couber). A ALTURA da v1.12.9 (`edicaoMedirFolha`, `--edicao-h`, o seletor com a altura do formulário) SAIU na v1.12.48: era de uma folha ancorada no fundo, e uma seção cresce para baixo a partir do cabeçalho. Oráculo: C2d.
- **Acabamento da v1.12.8:** sem o recado "fica com …" no cabeçalho do trecho (só o título "Trecho", centrado); cada ponta é `.edicao-ponta-cab` (rótulo + tempo na MESMA linha, tempo à direita) sobre os dois botões de 1 s; o rótulo do nome (`.edicao-rotulo-nome`) tem 14 px de recuo, o do texto do campo. Oráculo: C2c.
- **Acabamento da v1.12.7:** o formulário NÃO tem nota de rodapé (a linha "Original: …" saiu; desde a v1.12.10 não há texto de estado nenhum, ver "SEM TEXTO DE ESTADO"); o `#edicaoImportar` é um primário da barra (`height: var(--quad-faixa)`, `.song-menu-text` em linha); `.edicao-faixa` leva `margin-inline: calc(var(--sp-6) + var(--sp-3))` — as pontas ficam a ≥ 28 px da borda, fora da zona do gesto de voltar; `.edicao-spin` é 64 px e `.edicao-carga` não tem texto (o `aria-label` do svg diz "Carregando a lista"). Oráculo: C1c, C2b e a checagem do spinner no `edicao-de-midia`.
- **Editar um item já editado é NO LUGAR (v1.12.6, revoga o "ajuste fino" que criava item novo):** escolher um item editado abre o formulário com os valores GRAVADOS dele e o nome dele (`edicaoEditandoId`/`edicaoBase`); "Confirmar" chama `AVDB.atualizarEdicao(id, e)` — o MESMO registro e o MESMO id, com `edicao`/`kind`/`name` reescritos (o original não muda; um `e.origem` diferente é ignorado) —, e como as listas guardam só o id, o item muda em TODAS onde está (Cronograma, playlist, favoritos); `edicaoRecarregarListas` redesenha as três. Escolher o ORIGINAL cria um item novo; depois de criar o formulário passa a editar o item recém-criado (`edicaoFixarNoItem`), então confirmar de novo o atualiza e não duplica. O rascunho guarda `editandoId`; se o item sumiu na reabertura, o rascunho vira item novo. Efeito no ar: o que já está no palco só muda no próximo `load`.
- **O fecho é "Confirmar" + os quadrados dos destinos (v1.12.6):** a barra de sempre (`.song-menu-go-row.sorteio-barra`): o primário cresce e à direita os três quadrados da tabela `DESTINOS` (Cronograma · playlist · favoritos). "Confirmar" num item novo é o antigo "Criar item" (avançado: pergunta de destino; Modo Fácil: Cronograma e Favoritos); num item já editado é "salvar no lugar". Um quadrado envia DIRETO, sem pergunta: item novo → cria e põe só naquela lista; item já editado → salva e põe o mesmo item na lista. Os quadrados não existem no Modo Fácil (como na playlist automática). `edicaoAtualizarBotoes` acende conforme o estado (item novo sem marca nenhuma = cópia do original: nada acende; em edição no lugar, "Confirmar" só acende se algo difere do gravado).
- **O X vermelho do card:** o card do item (a linha de cima do formulário) leva `.edicao-x` à direita — cancela a edição (apaga o rascunho e volta ao seletor, `edicaoDescartar`); tocar o card em si leva ao seletor sem cancelar. Saíram os botões "Descartar", "Criar item" e o "Voltar" do seletor (que não fazia nada que o card ou o X da janela não fizessem); o fecho do seletor é só "Importar arquivo", em largura total.
- **Fades (v1.12.25):** as marcas "Fade de entrada"/"Fade de saída" DOBRAM o fade comum da tela (2 × `FADE.time`, 1,2 s) na ponta que nomeiam; a saída marcada TERMINA no corte. Trecho curto: cada ponta marcada no máximo à metade do trecho, nunca abaixo do fade comum. Retomado no meio (reconexão), a entrada é a comum. O detalhe (`fadeDaMarca`, `saidaTimer`) está no capítulo do motor, "As marcas do ITEM EDITADO dobram o fade".
- **Corte:** UMA faixa com dois `range` sobrepostos (`--r1/--r2` pintam o trecho; só os polegares recebem toque), mais −1 s/+1 s por ponta, centrados sob o tempo.
- **"Só o áudio":** vale para vídeo (some a imagem) e para ÁUDIO COM LETRA (`soAudioValido`/`edicaoPodeSoAudio`: o item sai com `lyrics: null`, telão no wallpaper). Áudio sem letra ignora a marca.
- **Modo Fácil:** sem pergunta de destino; o item vai ao Cronograma e aos Favoritos.
- Oráculo: `tools/edicao-de-midia.test.mjs` (banco, palco, janela, original vinculado e pacote).

