<!-- Parte do capítulo do Controle (o índice das partes está em CONTROLE.md;
     o mapa geral, em docs/ARQUITETURA-WEB.md). Partida do CONTROLE.md na
     revisão A3 (2026-10-30): o texto foi MOVIDO verbatim. -->

## Controle — a abertura, a preview, o telão e a saída de áudio

> Parte do capítulo do Controle — o índice das partes e as regras que valem
> para o Controle inteiro estão em [`CONTROLE.md`](CONTROLE.md).

**Nesta parte:** [A abertura e a badge de versão](#a-abertura-e-a-badge-de-versão-v170) · [A abertura por trás dos panos](#a-abertura-por-trás-dos-panos) · [O que o telão retoma ao RECONECTAR (`midiaNoAr`, v5.142)](#o-que-o-telão-retoma-ao-reconectar-midianoar-v5142) · [O cast só era repintado no modo simplificado](#o-cast-só-era-repintado-no-modo-simplificado-v5142) · [O toque responde no instante, não quando os bytes chegam](#o-toque-responde-no-instante-não-quando-os-bytes-chegam-v146) · [Todo o carregamento é do Controle; o telão só mostra o que está no ar](#todo-o-carregamento-é-do-controle-o-telão-só-mostra-o-que-está-no-ar-v147-fechado-na-v148) · [A referência da preview — ela ILUSTRA, nunca mede](#a-referência-da-preview--ela-ilustra-nunca-mede) · [A saída de áudio: os displays, ou ESTE APARELHO](#a-saída-de-áudio-os-displays-ou-este-aparelho-v5215)


### A abertura e a badge de versão (v1.7.0)

**A CORTINA** tem seção própria, abaixo: [A abertura por trás dos
panos](#a-abertura-por-trás-dos-panos).

**A BADGE.** `renderVersionLabel()` é o escritor ÚNICO do número — hoje só o rodapé de
Configurações (já foram três casas). Ele diz `v<base web>`, e só isso: o índice do
shell saiu da tela e ficou no Registro. **A badge do Modo Fácil saiu na v1.11.15**,
a pedido do operador (*"pode remover o número da versão dessa tela"*), e o nome do
app ficou no CENTRO do topo (o `.simple-head` é uma grade `--hit · 1fr · --hit`:
cast à esquerda, que some sem tela sem tirar o nome do centro, e engrenagem à
direita). Um `#simpleVersion` que volte é um segundo escritor do mesmo número.

- **A TERCEIRA CASA SAIU na v1.8.66.** A badge do avançado morava na trilha 1 da
  `.list-header` — vaga desde a v1.5.0 — e deu lugar ao botão de LIMPAR O
  CRONOGRAMA, a pedido do operador. Ela não se mudou: **saiu**. A pergunta que
  ela respondia ("que versão eu tenho?") tem resposta a um toque de distância, na
  engrenagem ao lado; o que ela custava era a única casa vaga da faixa.
- **A grade da faixa mudou por causa dela, e a mudança FICA.** As duas trilhas
  laterais eram caixas FIXAS de `--hit`, e a badge é texto: com uma trilha fixa o
  título saía do eixo, que é o que a trilha reservada da v5.309 existia para
  impedir. `minmax(var(--hit), 1fr)` nos dois lados reparte a sobra em partes
  iguais. Com o morador novo medindo `--hit` cheio — a caixa da engrenagem em
  frente — as duas pontas voltaram a ser quadrados iguais, e o elástico deixou de
  ser necessário; ele fica porque o que ele garante continua verdade e mexer na
  grade para tirar o que já não atrapalha é risco sem contrapartida. MEDIDO
  depois da troca: o centro do título fica a **0,01px** do centro da faixa.
- **No Modo Fácil a marca é o centro de uma grade** (v1.11.15; era `flex: 0 1 auto`
  colada à badge): `min-width: 0` e as reticências ficam — num aparelho estreito é a
  MARCA que cede, nunca as duas portas.

> **A CASA FOI DO MENU ⋮ SÓ NA v1.12.54** (Renomear · Limpar · Excluir), e a
> v1.12.55 a devolveu ao LIMPAR, a pedido do operador (ver [Os cronogramas
> múltiplos](CONTROLE-LISTAS.md#os-cronogramas-múltiplos-v11254)). Tudo abaixo — a operação, a
> tinta `--muted`, o `--icon-lg` por regra própria, o apagado de alfa próprio
> (.5) — vale de novo, sem uma linha alterada.

**E O QUE ENTROU NO LUGAR: LIMPAR O CRONOGRAMA (v1.8.66).** Pedido do operador:
*"substitua o badge de versão que temos na barra do topo do cronograma, a
esquerda, por um icone/botão de excluir lista (ele limpa a lista do cronograma).
use um icone de lixeira com list… use o icone na cor vermelha e não precisa de
corpo para o botão, apenas o icone, que é o padrão dessa top bar"*.

- **A OPERAÇÃO é `AVDB.listSet('imports', () => [])`**, e não um laço de
  `listRemove`: uma transação com a coleta dentro, contra N transações e N
  varreduras de detentores. Mas ela repete as DUAS metades do `deleteSelected`
  que o `listSet` sozinho não faz, e nenhuma tem sintoma — a marca `ytEstado`
  do ✓ "já está aqui" da busca (que nunca é recalculada enquanto a entrada
  existir) e o `soltarAvulso` da prateleira invisível (que é detentora, e sem
  soltá-la o que já tocou fica preso nela).
- **A CENA NO AR NÃO É ENCERRADA**, e é a regra da v1.3.13 escrita em
  `botaoExcluirDaLinha`: *"EXCLUIR DE UMA LISTA NÃO TIRA DO AR"*. Excluir tira o
  item de onde ele fica GUARDADO, e não fala do telão; a FILA é a única exceção
  (v1.8.52), porque é a lista que o TRANSPORTE governa. Os bytes do que está
  projetado sobrevivem à coleta porque a cena é detentora
  (`state.current.mediaId`, em `lerDetentores`).
- **A PERGUNTA É MODAL, e esta é a exceção que precisa estar dita.** O LIMPAR da
  fila pergunta na própria faixa (`pedirConfirmacaoNaLinha`), e a v5.301 tirou os
  modais de exclusão porque *"o modal TIRAVA O ALVO DE CENA"*. Aqui o alvo não é
  uma linha — é a lista inteira —, que é exatamente onde o `appConfirm({perigo})`
  sobreviveu (uma pasta, um álbum). E há uma razão medida: a `dica` da
  pergunta-na-linha vai para o `title`/`aria-label`, e **num WebView não há
  hover** — a frase que explica nunca aparece no aparelho. Para uma ação que tira
  a lista inteira de uma vez, o modal é o único dos dois que MOSTRA a
  consequência — e desde a v1.8.67 ela é só a CONTA: *"pode remover as
  explicações sobre os itens ainda ficarem em favoritos e sobre continuar
  tocando, não precisamos de todo esse texto explicativo"*. Quantos saem é a
  única metade que quem lê não tem como saber olhando a tela, já que a lista
  pode estar rolada; as duas promessas continuam VALENDO no código, e o que saiu
  foi dizê-las toda vez. **A ausência delas é AFIRMADA no oráculo** (bloco D),
  senão reintroduzi-las por zelo passa e o pedido se desfaz sozinho.
- **O VERBO É LIMPAR, NUNCA EXCLUIR** (v1.8.67): *"foque em chamar apenas de
  'limpar cronograma' e use esses tipos de termos nos botões de confirmar,
  títulos e afins"*. A distinção é real e não preferência de palavra — EXCLUIR é
  o que a seleção múltipla faz a um ITEM, LIMPAR é o que se faz a uma LISTA, e é
  o verbo que a fila já usa no `#plClear`. Um "excluir" aqui prometeria que os
  arquivos morrem, e o que morre é só o que não tiver outro detentor. A asserção
  varre os TRÊS lugares onde a palavra apareceria: o título, o botão que confirma
  e o `title`/`aria-label` do botão que abriu.
- **COM A LISTA VAZIA ELE É APAGADO** (`disabled` + `title`), a regra da v1.8.50
  — e ela pesa o dobro num destrutivo: um botão aceso que não faz nada ensina que
  tocá-lo é inofensivo. O estado é pintado em `renderLibrary`, o ponto ÚNICO que
  redesenha a lista: pendurado no `renderListTitle` ele ficaria velho no caminho
  do `toggleCronograma`, que é justamente o de tirar o último item pela gaveta.
- **A COR É `--muted`, NEUTRA (v1.8.68)** — *"troque o vermelho pelo branco/cinza,
  uma cor neutra para esse icone. Vermelho está muito chamativo."* Varridos os 57
  tokens declarados nos DOIS blocos de tema, só DOIS são neutros E passam o piso
  de 3:1 contra a `--bar` nos dois: `--muted` (8,09:1 · 6,66:1) e `--text`
  (11,56:1 · **21,00:1**, que faria o destrutivo virar a peça mais gritante da
  barra no tema claro). **"Neutro como o vizinho" NÃO é copiar a engrenagem**:
  MEDIDO por pixel, ela é AZUL (`--accent`), porque `.list-header .settings-btn`
  (0,2,0) vence a regra base dela — e o comentário que justifica esse azul se
  ancora no `#backBtn`, que tem `display: none` e 0px desde a v1.5.0. O vizinho
  NEUTRO desenhado é o `#listTitle`, e `--muted` é a tinta dele — a mesma que a
  `.ver-badge` substituída na v1.8.66 já pintava. **Os brancos "óbvios" morrem
  num tema só:** `--on-accent` e `--on-live` medem 13:1 no escuro e **1,00:1** no
  claro, onde eles e a barra valem os dois `#fff`.
- **E `--danger` não é um token** — a armadilha fica escrita porque sobrevive à
  saída do vermelho: um `var()` que não computa cai no valor HERDADO, e aqui o
  herdado é `--text`. Apagar a linha `color` (a "simplificação" óbvia ao tirar o
  vermelho) não deixa o botão sem cor: deixa-o com a tinta PRIMÁRIA do app,
  21,00:1 no claro, calado.
- **O SINAL DE DESTRUTIVO PASSOU A MORAR SÓ NO DIÁLOGO** (`appConfirm({perigo})`,
  que continua vermelho e continua tendo asserção). Enfraquecer aquele bloco
  deixa o recurso sem aviso nenhum.
- **O DESENHO MEDE 22px, COMO A ENGRENAGEM — e não media (v1.8.68).** O relato
  foi *"o icone da lixeira está muito pequeno visualmente, principalmente em
  comparação com o volume e preenchimento visual do icone das configurações"*, e
  a causa era MUDA: o `.crono-limpar` não estava em NENHUMA das duas listas de
  escala de ícone do `controle.css`, então o `<svg>` dele vivia do atributo
  `width="20"` do HTML enquanto a engrenagem media 22 pelo `--icon-md`. As
  CAIXAS dos dois botões eram iguais (34px) e o oráculo já afirmava isso — que é
  por que ninguém viu. Mesma armadilha da v1.5.19 nas três portas do rodapé.
- **A SEGUNDA METADE É DENSIDADE, e ela é paga com um DEGRAU A MAIS (v1.8.69).**
  Uma lixeira é contorno esparso e a engrenagem é glifo denso: 66,2 unidades de
  comprimento de traço contra 107,3, e MEDIDO, nenhum redesenho fecha isso
  (escalar a união até encostar nas bordas do viewBox chega a 0,63x da tinta).
  **Igualar o TAMANHO não iguala o PESO** — emparelhados em 22px a tinta fica em
  0,74, e o relato original continuaria de pé. O botão vai a `--icon-lg` (24px),
  e é a ÚNICA peça do app com esse degrau numa caixa de `--hit`: daí ele ter
  regra PRÓPRIA no `controle.css`, e não uma vírgula na lista existente, cujo
  comentário fala de *barras largas de ação*. Tinta contra a engrenagem no tema
  padrão: **0,44 → 0,89**.
- **E O EIXO É O TAMANHO, NUNCA A ESPESSURA** — a v1.8.68 tinha fechado o mesmo
  vão engrossando o traço deste símbolo para 2,4, e o operador revogou: *"a parte
  do traço da lixeira, desfaça. Eu queria ela maior e não com traços mais
  grossos."* MEDIDO, os dois caminhos dão o mesmo número (0,90 e 0,89); o que os
  separa é que um degrau de escala é declarado e uma espessura por símbolo é
  exceção de um consumidor só. O oráculo guarda o EIXO: o tamanho tem de ser um
  degrau DECLARADO (um 26px à mão reprova) e o traço tem de ser o do resto do
  sprite.
- **O VÃO DE TINTA FICOU EM 1,0 unidade.** Os traços da lista recuaram de x16
  para x16,8 na v1.8.68 só para acomodar o traço grosso; com ele fora o vão
  sobrou, e ele é cinco vezes os 0,2 do desenho da v1.8.67 — *"um décimo da
  linha"*, nas palavras do comentário de lá. **O que limita é o vão de TINTA**
  (`vão geométrico − stroke-width`), não o geométrico: a 2,85 a lixeira invadia
  os traços em 0,65 unidade e `getBBox()` não via.
- **O APAGADO TEM ALFA PRÓPRIO, .5, e não o `--op-inativo` (v1.8.68)** —
  *"aprimore o sistema de esmaecimento da sua cor quando inativo/sem itens na
  lista do cronograma"*. Aquele token iguala o ALFA de uma família de PÍLULAS
  PREENCHIDAS com tinta `--text` que o operador amarrou por extenso na v1.5.15;
  este é ícone solto, e o que precisa ficar igual é o DESFECHO — mesmo alfa, a
  pílula entrega 2,66:1 e este traço entregava **1,83:1**. **E 1,83:1 não é
  esmaecer, é sumir:** dos 488 pixels de tinta do ícone apagado, ZERO cruzavam
  2:1 no tema escuro contra 262 no claro. **Os pedidos de cor e de véu são UM
  só**: `--muted` no mesmo `.35` mede 1,71:1 no claro, também com zero pixels
  legíveis — trocar a tinta sem refazer o véu trocaria o sumiço de tema. A .5 os
  dois temas medem 3,12:1 e 2,23:1, com separação de 2,6x e 3,0x contra o aceso.
- **E O DESENHO FOI REPROPORCIONADO na v1.8.67** (*"o icone parece espremido
  horizontalmente"*). A caixa do BOTÃO já era quadrada — o que estava achatado
  era a lixeira dentro dela, **1:1,81**, espremida no terço esquerdo para sobrar
  espaço aos traços; o `trash-2` do Feather, na mesma região, é **1:1,11**. Os 24
  do viewBox foram repartidos em 12 (lixeira) + 6 (traços) + 2,2 de vão, e ela
  passou a **1:1,19**. A asserção mede um CLONE RENDERIZADO do símbolo: o
  `getBBox()` de um filho de `<symbol>` devolve **zeros** no Chromium, e a sonda
  ingênua aprova o desenho certo e o errado igualmente.

**E O CRONOGRAMA VAZIO É UMA MARCA-D'ÁGUA (v1.8.67).** Pedido do operador:
*"ajuste o texto de cronograma vazio, para que seja um texto maior, em negrito,
centralizado na tela, mas com uma cor com menos contraste do que a atual, para
ficar mais mesclado a cor do fundo e se destacar menos"*.

- **`#library > .empty`, e não a `.empty` geral.** A mesma classe serve a lista
  de uma pasta, o painel de Mensagens e a Bíblia, onde ela é um aviso dentro de
  uma caixa pequena — centrá-la verticalmente e inchá-la ali quebraria as três.
- **CENTRADA NOS DOIS EIXOS:** o `flex: 1` come a altura que sobra do scroller e
  o `place-content: center` põe a frase no meio dela. Com a lista cheia o `<li>`
  não existe, então isto não custa layout nenhum.
- **E ELA SAI DA FOLGA DO RODAPÉ FLUTUANTE** (`:last-child:not(.empty)`): o
  `<li>` é o último filho por acidente de ser o único, e herdar a folga das
  portas o empurrava **28,6px** acima do centro — um deslocamento que ninguém
  relata e ninguém explica. Ele não precisa dela por construção: quem fica atrás
  das portas é o fim de uma lista que ROLA.
- **O CONTRASTE TEM TETO, não piso** — o único do repositório. `--muted` a 55%
  mede **3,76:1** no escuro (de 9,94:1) e **2,22:1** no claro (de 5,16:1),
  abaixo do piso de 4,5 de propósito: a frase descreve uma ausência que já está à
  vista e não carrega informação que se perca. Sem um número, *"menos contraste"*
  é opinião.
- **A RÉGUA DA CENTRALIZAÇÃO É UM `Range`, e isso custou uma tautologia.** Medir
  o `getBoundingClientRect()` do `<li>` não acusa nada: ele carrega `flex: 1` e
  ocupa a caixa inteira COM e SEM o `place-content`. Quem se move é a LINHA de
  texto — com a régua certa o desvio vai de 4,8px para **266,1px**.

### A abertura por trás dos panos

O app piscava ao abrir: o tema escuro aparecia antes do claro, a lista vazia
antes do Cronograma. **O lado nativo já estava
certo** — `windowBackground`, a raiz da Activity e o próprio WebView nascem na
cor do tema guardado —; o que piscava era o DOCUMENTO, entre o primeiro quadro e
a última linha do `init()`.

- **O TEMA tem conserto próprio:** um `<script>` inline no `<head>` do
  `controle/index.html` lê `av.tema` e escreve `data-tema` ANTES do primeiro
  quadro (antes de qualquer folha ser aplicada). Ele é a **única** leitura daquela chave — o `storedTema()` do
  `controle.js` lê o ATRIBUTO que sai dali, porque uma segunda leitura seria a
  mesma regra escrita duas vezes.
- **O resto é a CORTINA** (`#splash`, primeiro filho do `<body>`, pintando
  `--bg` para existir no primeiro quadro que o navegador desenhar): opaca, no
  topo da pilha, com o ícone do app e a marca, e ela levanta na última linha do
  `init()` que muda o que se vê (depois do `applyPvWallpaper`, porque uma
  preview sem wallpaper é mais um dos "carregamentos" que piscavam).
- **O PRAZO É ARMADO NO `<head>`, e não no `controle.js`.** Uma cortina que não
  levanta é um app INUTILIZÁVEL, e o caminho mais provável de isso acontecer é
  justamente o que o watchdog do OTA existe para pegar: um bundle em que o
  `controle.js` nem chega a ser parseado. Armado no `<head>`, o prazo (12 s)
  roda mesmo aí, e o desfecho ruim volta a ser o app quebrado À VISTA, que é
  diagnosticável.
- **E HÁ UM PISO, NÃO SÓ UM TETO** (1,8 s, v1.7.2). Pedido do operador: *"está
  muito rápido, deixe por padrão um tempo mínimo se possível mais longo"*. Num
  aparelho com o acervo em cache o `init()` termina em algumas centenas de
  milissegundos, e o que se vê não é uma tela de abertura, é um LAMPEJO — a
  mesma sensação de piscar que a cortina veio consertar, um degrau acima. Ele é
  contado do INÍCIO da página e não do fim do `init()`, então um `init()` de 5 s
  já o pagou e levanta a cortina na hora; encadeá-lo depois somaria os dois e
  faria o aparelho lento esperar mais, que é o oposto do recurso. O teto chama a
  saída DIRETO, sem passar pelo piso: ele é a rede de segurança de um app que
  não subiu.
- **Ela some por REMOÇÃO DO NÓ**, não por opacidade: uma camada `opacity: 0`
  sobre a tela inteira continua recebendo o toque, e o app abriria intocável.

> **O PISO COBRA OS ORÁCULOS, e isso está dito porque não é óbvio.** A cortina é
> opaca e é o topo da pilha, e com 1,8 s de piso existe um vão real em que a
> tela não responde. `pg.click()` do Playwright espera a actionability e retenta
> sozinho, então um oráculo que CLICA não vê nada; quem vê é quem MEDE —
> `elementFromPoint`, captura de pixel, geometria. MEDIDO na entrada deste lote:
> **6 dos 63 oráculos reprovaram, e os 6 por hit-test**. Daí o `esperarCortina`
> do arnês, e a regra para o próximo: **todo oráculo que toca na tela espera a
> cortina depois de CADA carga** — inclusive depois de um `reload` no meio do
> arquivo, que foi como ela apareceu no `smoke.mjs`.
>
> **MAS ELE NÃO PAGA O PISO, E ISSO É DELIBERADO.** O piso é do OPERADOR, e quem
> o AFIRMA é o `abertura-e-transferencia`, com o relógio mockado e nas duas
> pontas. Os outros ~70 pontos que chamam o `esperarCortina` não medem a cortina:
> esperam o app ficar TOCÁVEL, e pagavam o piso de carona — MEDIDO, 1,8 s × ~70,
> **126 s de sono por rodada em série**. Hoje ele espera o `__avPronto` (escrito
> pelo gancho do `abrirNavegador` quando o `controle.js` chama
> `__avSplash.pronto()`, a última linha do `init()` que muda o que se vê) e tira
> o nó, que é o que o `sair()` do app faria 1,8 s depois. **E ELE NÃO É UM
> DETECTOR DE APP QUEBRADO**: no cenário catastrófico o teto de 12 s do `<head>`
> tira a cortina, o predicado passa a valer e ele devolve `true` — a garantia é
> que a tela fica TOCÁVEL, não que o app subiu. Quem afirma o app de pé é o
> `abertura-e-transferencia`, com asserção própria; um oráculo que trate o
> retorno deste como veredito está lendo o que ele não responde.

Oráculo: `abertura-e-transferencia.test.mjs`, com o cenário catastrófico medido
(o `controle.js` abortado pela rota, o tema já certo, a cortina levantando pelo
prazo) e o piso medido nas DUAS pontas com o relógio mockado — **em fatias**,
porque `fastForward` não reprocessa o temporizador que o callback agenda no meio
do salto, e **por leitura imediata**, porque o relógio instalado continua
andando com o tempo real e uma espera de 15 s cruzaria o teto de 12 s (foi assim
que a segunda asserção chegou a passar pelo motivo errado).

---

### O que o telão retoma ao RECONECTAR (`midiaNoAr`, v5.142)

Quando o dongle cai e volta, o Android recria a `Presentation`, o WebView
recarrega `/display/` e dispara `display-ready` — e o Controle reenvia a cena
(`resendSceneToDisplay`). A pergunta que faltava era **o que** contava como
cena.

`currentId` **não é** "está no telão". Ele sobrevive de propósito a duas coisas,
e é isso que permite repetir a faixa com o ▶:

- **`stopClear`** — o operador cobriu o telão (o comando `clear` leva o Display
  de volta ao wallpaper), mas o item continua selecionado;
- **`resetAfterEnd`** — a música acabou e nada a seguiu (o fim da fila, ou uma
  cena que não estava nela); o `stage` já voltou ao wallpaper sozinho pela
  bandeira `ended`.

Reenviando por `currentId`, os dois viravam defeito: o telão acordava com um
vídeo **engatilhado** que ninguém pediu — e, num `<video>` pausado que nunca
tocou, o WebView pinta o `getDefaultVideoPoster` dele, o retângulo cinza com o
play — ou ressuscitava a música que já tinha terminado, no primeiro quadro dela.
`midiaNoAr` responde a pergunta certa: **um telão vazio também é um estado, e
restaurá-lo é não mandar nada.**

O mesmo estado conserta um terceiro defeito, que parecia não ter relação:

> **O ▶ depois do stop exigia dois toques no stop.** Ele decidia entre "retomar"
> e "recarregar" por `preview.getCurrent()`, que só fica nulo no **fim** do fade
> de saída do `clearFaded` (~0,6 s). O `play` mandado nessa janela era apagado
> pelo `clear` que terminava logo atrás: o botão não fazia nada, e o operador
> aprendeu a tocar em stop duas vezes — o que só comprava o tempo do fade.
> `midiaNoAr` cai no instante do stop, então o primeiro toque no ▶ já recarrega.

E o pôster: **`POSTER_VAZIO` ficou permanente** (ver `shared/stage.js`). Ele saía
no `loadeddata`, com o raciocínio de que "há quadro, então mantê-lo esconderia o
quadro congelado". A premissa estava errada — quem decide o que um `<video>`
pinta é o **show poster flag** do HTML, desligado só pela reprodução ou por um
**seek**. Numa cena restaurada pausada nenhuma das duas acontecia, a bandeira
seguia ligada, e sem atributo de pôster o WebView desenhava o placeholder cinza.
Com a bandeira desligada o atributo é ignorado pelo contrato, então mantê-lo não
custa nada; e para o quadro congelado aparecer de fato, a cena pausada agora
**sempre faz seek** (mesmo para o segundo zero).

### O cast só era repintado no modo simplificado (v5.142)

> **E ELE É VERDE COM A TV NO AR desde a v1.12.53** (era vermelho, "o toque
> desconecta"). Pedido do operador: *"o vermelho indica algo desativado e não
> conectado"*. `.pv-fab.connected` veste `--stage-ok` — o `--ok` do tema escuro
> escrito literal no bloco sem tema, porque a prévia é PALCO (o `--ok` do claro
> daria 3,0:1 sobre o preto dela). É o quarto verde de ATIVIDADE, nomeado no
> `feedback-de-confirmacao.test.mjs`.

O ícone de cast sobre a preview carrega o estado da conexão, e quem o pintava era
`renderSimpleCast()` — que começa com `if (appMode !== 'simple') return`. No modo
avançado ele **nunca** era repintado: o aceso que o simplificado deixou ficava
para sempre, e o operador via "conectado" sobre uma TV que já não estava lá. O
estado da tela não é decoração de um dos modos; saiu para `renderCastBtn()`.

Do lado do shell, dois avisos faltavam (ver `MainActivity.syncPresentation`): a
saída antecipada de "não há tela" estava **dentro** do `if (current != null)`,
então uma queda em que o sistema já tinha derrubado a janela sozinha não
notificava ninguém; e o `setOnDismissListener` — o caminho da queda por distância
— zerava a referência calado. O lado web ainda reconfere a lista **ao voltar para
a frente**, porque um evento perdido não se recupera sozinho e este WebView é
estrangulado justamente enquanto o app está minimizado.

### O toque responde no instante, não quando os bytes chegam (v1.4.6)

**"Tocar agora" num vídeo do YouTube começa por uma EXTRAÇÃO DE REDE** — o
do link — e só depois dela vem o `send` que muda alguma
coisa na tela. Nesse intervalo de segundos o app não dizia nada: o único sinal
era o `setYtEstado`, que acende uma linha da Biblioteca que o `closeHymnSearch`
acabara de fechar. E o caminho do DOWNLOAD já tinha o cartão de espera
(`ytArquivo` → `previewBusy`); o da TRANSMISSÃO nunca teve — **a assimetria era o
defeito**.

- **A INTERRUPÇÃO É O RECONHECIMENTO DO TOQUE** (`cederOPalco`). "Tocar agora"
  é um comando sem ambiguidade: a cena atual vai sair de qualquer jeito, então
  tirá-la no ato não antecipa nada — apenas para de esconder o que já foi
  decidido. É o mesmo protocolo visual do `stage.load` (esmaece o que está no ar
  e segura o aro de espera); o que muda é COMEÇAR no instante do comando.
- **Não é `stopClear`**, e a diferença é o `clearManualText`: aqui a mídia é que
  está sendo trocada, então um versículo projetado continua projetado. A escolha
  da camada é a MESMA (`media-clear` com cena de roteiro no ar, `clear` sem ela)
  — duas réguas para a mesma pergunta divergiriam no primeiro ajuste.
- **Não espera a gravação**: o efeito visível de `pararMidia` é síncrono (o `cmd`
  sai na hora e chega ao telão e às telas), e o que ele aguarda é o
  `persistCurrent`. Segurar o toque nele trocaria uma espera de rede por uma de
  disco.
- **O invólucro do `ytAcao` existe pela SAÍDA ÚNICA**: `ytAcaoInterno` tem meia
  dúzia de `return`, e um deles sem a liberação prenderia o cartão sobre a
  preview para sempre.
- **Só no `tocar`.** Guardar um vídeo numa lista não vai ao telão, e interromper
  a cena para isso seria o oposto do que o toque pediu — é a metade que impede a
  correção de virar um defeito maior que o que ela conserta.
- **O preço está dito:** falhando a transmissão, a cena cai no download, que leva
  minutos, e o telão passa esses minutos no wallpaper com o cartão explicando.
  Devolver a mídia anterior seria o app decidir por cima do operador.

- **E VALE PARA O ITEM DE LINK JÁ GUARDADO** (v1.4.7). A guarda mora dentro do
  `resolverLinkYoutube`, não no chamador: ele é o ponto por onde TODOS os
  caminhos do link passam — o toque na linha, o avanço da playlist, o ⏮/⏭, a
  notificação nativa. Pôr no `send` seria escolher um deles.

### Todo o carregamento é do Controle; o telão só mostra o que está no ar (v1.4.7, fechado na v1.4.8)

Pedido do operador: *"revise para que todo o loading aconteça no controle, e
para o telão, literalmente só apareça quando o vídeo estiver realmente sendo
reproduzido"*. O desenho anterior era meio-termo — parte da espera na preview,
parte na projeção.

A v1.4.7 tornou o aro do palco uma OPÇÃO do dono (`espera: true`, só a preview),
e isso não bastou: **continuavam existindo dois modelos de carregamento**, o
cartão "Preparando…" e o aro, se revezando na mesma tela. *"eu gostaria que
houvesse apenas o 'preparando…' no controle, vamos abandonar o spinner no telão…
nos controles já temos a mensagem de preparando, não precisamos de um spinner
exclusivo"*. Na v1.4.8 o aro saiu inteiro, e com ele a folha `shared/stage.css`.

> **O ANÚNCIO DE ESPERA DO PALCO (`opts.onEspera`) SAIU NA v1.8.82.** Ele existia
> para a TRANSMISSÃO DIRETA, o único caso em que "carregado" e "tem o que
> mostrar" ficavam a segundos de distância; com aquele caminho fora do app o
> palco nunca mais o acendeu. O que fica desta seção é o CARTÃO, que continua
> cobrindo a espera de verdade que sobrou: a extração e o download.

- **O palco ANUNCIA; ele não desenha.** Invariante 5 aplicada ao motor: ele diz
  o FATO, não a forma. Quem desenha é o dono. A regra vale para o próximo
  anúncio que o palco precise fazer.
- **Um indicador só, no Controle** (`previewBusy`): a espera inteira se lê como
  um estado só, e não como dois avisos se revezando.
- **O nome vem do ITEM, não do rótulo já desenhado**: `renderNowPlaying` roda em
  pontos diferentes de cada caminho, e um nome atrasado é o cartão anunciando o
  louvor ANTERIOR enquanto o novo carrega.
- **A SAÍDA DO CARTÃO TEM UMA CARÊNCIA** (`PV_BUSY_SAIDA_MS`, 700 ms), e ela é o
  que faz a promessa acima ser verdade. Uma espera pode ter DOIS donos em
  sequência — o toque (`cederOPalco`, que cobre a extração de rede) e o download
  que vem depois dele —, e o primeiro solta no `finally` assim que a ação volta,
  enquanto o segundo só acende adiante: **entre os dois o contador passa por
  ZERO**. Sem a carência o cartão sai e volta no meio da MESMA espera, que é o
  "dois modelos de carregamento" com outra roupa. Um dono novo dentro dela
  CANCELA a saída. É o irmão do `PV_BUSY_DELAY_MS` na outra ponta, e cobre o
  pior caso do vão (o `FADE.time` de 0,6 s mais a leitura do IndexedDB). **O
  preço está dito:** um cartão que de fato acabou fica esse tanto a mais na tela
  — e ele é um indicador de estado, não um modal. O que sai NA HORA é o botão de
  cancelar: ele é uma AÇÃO, e uma ação sem dono não pode ficar tocável nem por
  meio segundo.

Oráculo: `tools/toque-instantaneo.test.mjs` e a **passagem de bastão** no
`tools/gaveta-e-cartao.test.mjs` — esta amostrada a cada quadro, porque um teste
do estado FINAL passa nas duas versões (no fim o cartão está de pé de qualquer
jeito); com a carência em zero ela devolve `{"apagou":true,"on":true}`.


### A referência da preview — ela ILUSTRA, nunca mede

A preview roda no WebView do Controle, o único dos três que o Android estrangula
quando o app sai da frente: minimizado, o `<video>` dela é pausado ou desacelerado
enquanto a projeção segue andando. **Enquanto ela for a régua, não há como
corrigir isso — o erro está na régua.**

A projeção é uma destas três, **nesta ordem**:

1. **o TELÃO** (`display-status`), com TV conectada;
2. **a TELA ELEITA** (`tela-status` → `espelho-status`), sem TV — cada tela roda o
   próprio `/display/` com um `<video>` de verdade, num navegador que o Android do
   celular não estrangula;
3. **ninguém** — sem TV e sem telas, a projeção É a preview em tela cheia, que
   exige o app na frente. Aí ela é a própria referência, e o caso não existe.

Daí **duas funções com nomes distintos**, e a distinção é o modelo inteiro:
`authoritativeTime()` responde *"o que está no ar agora?"* (qual estrofe vem a
seguir, o que a barra marca, o que a `MediaSession` publica) e `tempoDaPreview()`
responde *"o que a ilustração deve estar desenhando?"*. Sem as duas, o atraso
deliberado da preview vira defeito nos dois sentidos: quem desenha a letra pelo
tempo da projeção troca a estrofe antes da imagem a que ela pertence, e quem
realinha o `<video>` pelo tempo da projeção **desfaz o atraso** a cada status.

- **O realinhamento mira `projeção − atraso`**, nunca a projeção: com
  `PREV_ATRASO_MAX` (2,5 s) maior que a tolerância, mirar a projeção faria cada
  status puxar a preview para a frente — o resync brigando com o atraso, a 4 Hz.
- **A tolerância é de meio segundo.** A preview **não tem som** por construção, e
  sem som um seek custa um quadro e não estala nada. Ao **retomar do segundo
  plano** ela cai para `RESYNC_EXATO` (0,15 s): ali não há ruído a poupar, há um
  desvio conhecido.
- **Escondida, a preview não atrasa nada** — o atraso existe para o operador não
  vê-la responder antes das telas da rede; sem plateia ele só empilha comandos
  numa fila cujos `setTimeout` o Android estrangula.
- **E escondida ela também não é TOCADA** (`preverPodeMexer`). O Chromium pausa um
  `<video>` de página oculta: o `play()` do resync sai, o navegador pausa de
  volta, e o status seguinte recomeça — um laço a ~4 Hz. Não é só inútil: **os
  WebViews dividem UM processo**, e essa rotatividade de decodificador rouba fio
  de todo o resto. A janela de `forcarResyncAte` só é CONSUMIDA quando há como
  agir, senão a retomada seguinte partiria de um crédito já gasto.

### A saída de áudio: os displays, ou ESTE APARELHO (v5.215)

**Sem tela nenhuma conectada, quem toca o som é a preview do Controle** — isto
é, o próprio celular. Não há botão, não há preferência e não há nada a lembrar
entre sessões: o estado é **derivado da conexão**, e o único ponto que o aplica
é `acertarSaidaDeAudio()`, que liga e desliga o `forceMuted` do stage da
preview.

```
alguma tela conectada?  ── sim ──▶  preview MUDA (o som é da TV / das telas)
   (simpleDisplay)      ── não ──▶  preview TOCA (o celular é a caixa de som)
```

- **TELA é a pergunta larga**: a TV pela `Presentation` **ou** uma tela da rede
  recebendo. Desde a v5.187 elas são a projeção quando não há TV, e cada uma
  toca o próprio arquivo no `<video>` dela — contá-las é o que impede o celular
  de duplicar o áudio da sala, fora de compasso (são dois decodificadores). Quem
  responde é `simpleDisplay()`, a mesma função do Modo Fácil, por
  `algumaTelaConectada()`: delegar em vez de reescrever é o que impede as duas
  de divergirem no primeiro caso de borda. `telaoConectado()` continua
  respondendo só pela TV, que é a pergunta certa para o atraso da preview e para
  o botão de espelhar.
- **E "A TV" É A `Presentation`, NÃO A TELA LISTADA** (v1.4.4). As duas divergem
  numa negociação de Miracast — `show()` lança com o dongle instável, o sistema
  derruba a janela sozinho numa oscilação, e nos dois casos a tela **continua
  listada**. Enquanto a pergunta foi `lastDisplays.length > 0`, esse estado
  calava a preview por haver "para onde mandar o som" sem ninguém tocando do
  outro lado: **silêncio nos dois lados**, com o Registro dizendo "conectado". O
  campo `telao` de cada tela (shell 59) é quem responde agora, por `telaoNoAr()`
  — e as perguntas que passaram a usá-lo são as que dependem de haver PROJEÇÃO:
  o som e o portão do Modo Fácil. (A terceira era o microfone, e saiu na v1.8.89
  com o recurso.) O que descreve a
  CONEXÃO segue lendo a lista crua: o rótulo da folha, o `applyPreviewAspect`, o
  Registro — e é lá que a distância entre as duas vira frase. Com o telão no
  chão o som volta para o celular, que no espelhamento continua chegando às
  caixas pelo `REMOTE_SUBMIX` (v1.1.7), enquanto o shell retenta a janela por
  ~15 s.
- **No avançado por DERIVAÇÃO, no Modo Fácil por ESCOLHA** — e os dois pela mesma
  porta, porque a pergunta de baixo é uma só: há para onde mandar o som?
  (`somLocalDeveEstar`: `!algumaTelaConectada() && (appMode === 'full' ||
  tocarNoCelular)`.) Enquanto o Modo Fácil está BLOQUEADO ele segue mudo — som
  saindo de um app bloqueado seria a única coisa acontecendo atrás de uma tela
  que diz "conecte uma tela"; o que o "Tocar neste celular" faz é tirar o
  bloqueio e o mudo na mesma decisão. Trocar de modo é, por isso, um dos
  gatilhos de `acertarSaidaDeAudio()` — os outros são as telas
  (`renderDisplayStatus`), a transmissão (`lerEspelho`), a janela do Display no
  navegador (`openWebDisplay`) e a própria escolha (`setTocarNoCelular`).
- **A troca é automática nos dois sentidos e não corta o áudio**: a rampa curta
  do `setForceMuted` (a mesma `MUTE_RAMP_TIME` do mudo) desce até 0 e só então
  muta ao emudecer, e sobe de 0 ao alvo ao dar som, respeitando o mudo e o fader
  que o operador já tiver ajustado. Uma TV conectando no meio do louvor cala
  este aparelho e o telão assume pelo reenvio de cena que a reconexão já faz
  (`resendSceneToDisplay`, com posição e estado); ela caindo devolve o som para
  cá.
- **O navegador pode recusar**, e a resposta é voltar a tocar MUDO na hora
  (`onBlocked` da preview + `somLocalBloqueado`). No app isso não acontece
  (`mediaPlaybackRequiresUserGesture = false`); num navegador comum a política
  de autoplay rejeita o `play()` com som sem ativação do usuário, e sem esse
  ramo o preço de ligar o som seria a preview **parar de tocar** — trocar uma
  ilustração muda por nenhuma ilustração. A recusa vale só até o próximo `load`:
  cada mídia nova ganha uma tentativa, e o toque que a carregou é a ativação que
  faltava.
- **O Registro diz onde o som está saindo** ("Som: …"). "Não sai som" tem causas
  que a tela não separa — mudo, fader em zero, tela conectada sem volume, este
  aparelho calado por haver tela —, e quem lê o Registro está a distância.

#### O ATALHO para a saída de áudio do sistema (v1.9.9, shell 73)

Um tile em Configurações que **abre a tela do Android** e mais nada. Pedido do
operador, e ele o repetiu **sabendo** que a notificação de mídia do app já traz o
seletor do sistema: *"o botão aparece, e o android tem essa opção. Mas o que eu
quero é um atalho mesmo no próprio app, nas configurações, assim fica claro as
opções"*. A razão é boa e é de descoberta: a porta que existe é invisível para
quem não a conhece.

**AS DUAS PERGUNTAS QUE O PEDIDO JUNTA, e só uma é do app.** *Em qual TELA o som
toca* já é respondida pela seção acima (`somLocalDeveEstar`, com a escolha manual
do `tocarNoCelular`) — um seletor novo ali seria uma TERCEIRA fonte de verdade
sobre a mesma pergunta. *Em qual APARELHO FÍSICO o som sai* o app **não pode**
responder: `AudioPolicy.setUidDeviceAffinity`, `setPreferredDeviceForStrategy` e
`registerAudioPolicy` são `@SystemApi` atrás de `MODIFY_AUDIO_ROUTING`
(`signature|privileged|role`). A seção do espelhamento no `CLAUDE.md` já
levantou isso; este tile **aceita aquela resposta** em vez de reabrir a
investigação, e entrega o que sobra.

- **A cadeia é a do `pickCastIntent`** — do específico ao genérico, porque o alvo
  não é API documentada — e difere dele em DOIS pontos: o último candidato é
  constante PÚBLICA que todo aparelho declara (`ACTION_SOUND_SETTINGS`), então ela
  tem **PISO** (na do espelhamento não havia, e foi isso que a fez cair no Google
  Cast num aparelho sem o alvo AOSP); e ela **TENTA TODOS**, em vez de escolher um
  e desistir — um candidato que RESOLVA mas RECUSE (o diálogo do SystemUI lança
  `SecurityException` em vários aparelhos) derrubaria a cadeia inteira para o laço
  cego.
- **O PRIMEIRO CANDIDATO É UM BROADCAST, e é essa a correção da v1.9.10.** Relato
  do operador sobre a v1.9.9, com as duas telas fotografadas: *"o atalho está
  abrindo essa janela 'som', enquanto o 'saída de mídia' abre essa outra janela
  direta no seletor de saída de mídia… e mudar na janela 'som' nem sempre funciona
  a troca do áudio"*. A janela que ele quer é o diálogo do SystemUI — a lista
  *"Alto-falante do telefone · Fones · <Bluetooth>"*, a mesma que o ícone da
  notificação de mídia abre —, e ela **não é uma Activity**
  (`com.android.systemui.action.LAUNCH_MEDIA_OUTPUT_DIALOG`, tratado pelo
  `MediaOutputDialogReceiver`). A cadeia antiga só sabia `startActivity`, então
  aquele endereço nem era candidato e ela caía no painel de volume. **E O DESFECHO
  DELE É CONFERIDO PELO FOCO DA JANELA** (v1.9.11), porque a guarda de EXISTÊNCIA
  não bastava: relato do operador sobre a v1.9.10, *"dessa vez ele não abriu
  nenhuma janela"*, com o Registro mostrando o receptor PRESENTE. `sendBroadcast`
  não devolve desfecho nenhum, quem recebe pode ENGOLIR em silêncio, e foi o que
  aquele aparelho fez — a cadeia parou achando que tinha dado certo. *"Há quem
  receba?"* e *"a janela abriu?"* são perguntas diferentes, e a primeira estava
  sendo usada como se fosse a segunda.
- **A RÉGUA É O FOCO, e não o `onPause`:** um diálogo do sistema pousa POR CIMA da
  Activity sem pausá-la, então `onPause` nunca chega — mas o foco de janela sai.
  800 ms depois do envio, com o foco ainda aqui, a cadeia SEGUE do candidato
  seguinte. O prazo é uma aposta DECLARADA: longo o bastante para um diálogo
  subir, curto o bastante para a queda fazer parte do mesmo toque, e o erro que
  ele pode cometer é abrir o painel por cima de um diálogo lento — visível, e
  preferível ao botão que não faz nada.
- **O alvo escolhido vai ao REGISTRO e só lá** (`Saída de áudio abre: …`, com o
  componente), pela razão do `describeCastTarget`: o operador não escolhe entre
  caminhos pelo nome da tela que vai abrir, e quando ela é a errada a resposta
  tem de estar no texto que se COPIA.
- **SÃO QUATRO PERGUNTAS, e o Registro responde as quatro.** *Qual PEGOU*
  (v1.9.9), *quais EXISTEM* (v1.9.10), *ele ABRIU* (v1.9.11) e *o app ainda
  TENTA* (v1.9.12) — cada uma nasceu de um relato que a anterior não explicava,
  e é essa a lição da série: **um diagnóstico que responde só a pergunta anterior
  custa um lote inteiro por relato.**
- **O ENGOLIDO É LEMBRADO POR `versionCode`** (v1.9.12). Medido o bloqueio, o
  candidato é PULADO: os 800 ms são o que impede o tile de ficar mudo, mas onde o
  desfecho já é conhecido eles são espera pura, e o operador os pagava em todo
  toque. **A memória não é permanente de propósito** — um booleano seco excluiria
  para sempre um aparelho que passasse a permitir (atualização do sistema, troca
  de ROM), e com o `versionCode` dentro todo APK novo re-mede UMA vez. O bloqueio
  sai em DUAS linhas do Registro (a do candidato e a do último toque), senão *"o
  app deixou de tentar"* seria um estado invisível. **E a queda filtra por TIPO,
  não por posição:** o `drop(1)` da primeira escrita supunha que o broadcast é
  sempre o primeiro, e isso é a cópia de uma ordem que mora noutro lugar. A terceira é **RELIDA a cada montagem do
  Registro**, e isso é metade do conserto: o desfecho muda a cada toque, e lê-lo
  só na carga faria o Registro dizer "nunca" para sempre.
- **E DESDE A v1.9.10 A CADEIA INTEIRA VAI JUNTO**, uma linha por candidato com a
  ação, o rótulo, o TIPO (`tela` ou `broadcast`) e o componente — ou *"— não
  existe neste aparelho"*. A primeira escrita respondia *"qual PEGOU"*, e quando o
  atalho abriu a tela errada isso não explicava nada: **quais EXISTEM é outra
  pergunta**, e é a que conserta. O oráculo mede as DUAS metades (o que está lá e
  o que FALTA), porque um stub com tudo presente provaria a lista contra o cenário
  que nunca dá problema.
- **Com o espelhamento no ar ele não resolve o vazamento**, e isso está dito nos
  dois lados: o áudio do Miracast nasce de `AUDIO_SOURCE_REMOTE_SUBMIX`, a
  mistura do aparelho inteiro, e a combinação "trocar a saída com espelhamento
  ligado" **não foi medida em aparelho**. A cadeia promete chegar à tela, não um
  desfecho.

#### A PRÉVIA RECOLHÍVEL e a economia que vai junto (v1.9.9 / v1.11.7)

Pedido do operador (v1.9.9), fechado depois da análise: *"o celular fraco é o operador,
vamos manter as outras conexões de controle e ativar/desativar apenas a
decodificação de imagem do preview, que é o que realmente pesa no
processamento"*. As outras alavancas medidas na análise (espaçar o
`display-status`, cortar fades, cortar as animações do app) ficaram de fora — a
primeira é a única que remove um DECODIFICADOR, e as outras custam barra
grosseira, transição vista pela congregação e quase nada.

**O ganho não é hipótese.** O `preverPodeMexer` já existe porque a prévia tocando
em paralelo custa ao PROCESSO — *"os três WebViews dividem UM processo, e essa
rotatividade de decodificador rouba justamente o fio"* —, e o sintoma daquela vez
foi o som parando de chegar a uma tela da rede. Este recurso transforma aquele
desligamento acidental (a página oculta) numa ESCOLHA, com a página à vista.

**Na v1.11.7 o tile "Imagem da prévia" de Configurações saiu e a escolha virou
uma SETA no topo da própria prévia** (`#pvRecolherBtn`): *"um botão na preview
que compacte verticalmente ela e substitua o botão de desativar a imagem de
preview… mantendo os botões de interação dentro da preview, mas a preview na
menor altura possível sem apertar esses botões"*. A máquina da economia é a
MESMA (chave `economiaPreview`, `economiaAtiva`, `setSuspenso`, `preverPodeMexer`
e as quarenta asserções que a travam); o que mudou é a superfície de controle e
que ela ganhou GEOMETRIA.

- **TRÊS coisas, e as duas últimas não são a mesma régua de propósito.** A
  MARCAÇÃO (`economiaPreview`, do banco — propriedade do APARELHO, e quem estava
  com "Imagem desligada" passa a abrir com a prévia recolhida); a GEOMETRIA
  (`pv-recolhida`, que segue a marcação NO ATO, também sem TV — é o "sempre
  clicável" da v1.10.10: a seta tem de fazer algo visível); e o VEREDITO da
  decodificação (`economiaAtiva()`: a marcação, `haDestinoDeProjecao()` e **não
  estar em tela cheia**). Ligar a decodificação à marcação pararia o `<video>` da
  prévia, que sem tela é a fonte do som; ligar a geometria ao veredito faria a
  seta não fazer nada visível sem TV.
- **RECOLHIDA, ELA É MAIS UMA LINHA DO DECK (v1.13.10).** Pedido do operador:
  *"o colapso da preview vai simplesmente se transformar em uma outra linha, com
  os botões que antes estavam na preview … o mesmo design de botões e grade que já
  temos nesses controles abaixo"*. Era uma tira do PALCO (v1.11.7–v1.13.9: fundo
  preto, ícones soltos de `--hit` com `drop-shadow`, 38px, e um fallback de duas
  linhas para o selo e o giro). Hoje:
  - **A GRADE É A DO TRANSPORTE, SEM CONTA.** A prévia ocupa a coluna do meio do
    deck, `W − 2·col − 2·vão`; com `col = (W − 6·vão)/7` (a demonstração está no
    `.deck`) isso é exatamente `5·col + 4·vão`. `repeat(5, minmax(0, 1fr))` com
    `--deck-gap` dá cinco células de `--deck-col`, borda com borda sobre a
    playlist, ⏮, ▶, ⏭ e o parar; os dois botões de slide, que flanqueiam a
    prévia, ganham a altura da linha e fecham as sete. MEDIDO a 390px: os dez
    botões das duas linhas em 47,7 × 36,4.
  - **COLUNA FIXA POR BOTÃO:** mudo · cortina · seta · cast · tela cheia. A ordem
    espelha a prévia aberta (o mudo é o canto de baixo à esquerda e a tela cheia o
    de baixo à direita, então cada um é o extremo do seu lado); sem cast (o
    navegador) a quarta célula fica VAZIA, em vez de os vizinhos andarem e saírem
    da coluna do transporte.
  - **O BOTÃO É O `.t-btn`:** `--surface`, `--radius-btn`, `--text`, recuo `.45rem`,
    ícone `--icon-md`, sem as sombras de traço (elas existem para um fundo
    desconhecido), com o `--press` + `--press-luz` do deck — por isso a prévia
    recolhida é `overflow: visible` (recortado, o recuo de 2px perderia a base). A
    altura sai do conteúdo, como a do vizinho. **O estado vira superfície**, a
    regra "LIGADO É SUPERFÍCIE": cortina e mudo `--btn-danger` + `--danger-strong`,
    bloqueio de áudio `--btn-warn` + `--warn`, cast conectado `--ok-fill` + `--ok`
    (nomeado na lista do `feedback-de-confirmacao`). Os tokens do palco
    (`--stage-alert`, `--stage-ok`) não servem aqui: o deck tem tema.
  - **O SELO DE CAMADAS E O DESFAZER DO GIRO NÃO ENTRAM NA LINHA**
    (`.pv-fabs--base { display: none }` só recolhida). No lugar, um PONTO no canto
    da seta — o tamanho e o canto da `.lv-badge`, tinta `--danger-strong` —, que
    aparece por `:has(:is(#pvCamadaBtn, #pvGiroBtn):not([hidden]))`: a pergunta é
    a MESMA que desenha os dois (`renderCamadaBtn`/`renderRotBtn` escrevem o
    `hidden`), então o ponto não diverge do selo e não há JS. *"um simples ponto
    vermelho … como indicação de um ou dos dois símbolos ativos"*. Expandida, os
    dois seguem como sempre.
  - **O fallback de duas linhas SAIU** (`acertarExtrasDaPrevia`, o `ResizeObserver`
    dele e todo o `pv-extras-baixo`): sem selo e giro, cinco células sempre cabem.
- **A ANIMAÇÃO (v1.11.17; o fundo na v1.13.10)** — *"faça uma animação para a
  colapsação da preview, ao invés de piscar e mudar de tamanho"*.
  `animarRecolhimentoDaPrevia`, chamada só por `setEconomiaPreview` (o TOQUE: mede
  ANTES e anima DEPOIS; a abertura, a troca de destino e a saída da tela cheia
  chamam `acertarEconomiaDaPreview` direto e assentam no ato). O estado final vale
  no primeiro quadro; WAAPI desenha o caminho: `height`, `background-color`,
  `box-shadow` e `border-radius` da prévia do medido antes ao medido depois (do
  palco ao transparente), e em cada botão o fundo, a cor e o deslocamento — **contado
  da ÂNCORA do botão**: no Y a do aberto (topo ou base), no X a da linha (borda
  esquerda, direita ou centro). Contado de outra ponta, a largura que muda (34 →
  47,7) jogava o canto para fora da caixa no primeiro quadro. `pv-animando` estica
  a trilha única e prende cada botão à borda dele (`align-self: start`/`end`)
  enquanto a altura corre, e recorta (`overflow: hidden`); ao EXPANDIR a coluna de
  34px não comporta dois botões, e o mudo/tela cheia ficam `position: absolute;
  bottom: 0` — MEDIDO, sem isso o mudo caía a −12px da base nos primeiros quadros.
  `--dur-lenta` lida do token; `semMovimento()` e tela cheia não animam; um
  segundo toque no meio parte de onde a prévia está (`getBoundingClientRect` já
  inclui a animação em curso, e `cancelarAnimacaoDaPrevia` roda ENTRE as duas
  medidas). **Oráculo que clica a seta e mede NO ATO abre o contexto com
  `reducedMotion: 'reduce'`**; o caminho animado é do `previa-animacao.test.mjs`.
- **O Modo Fácil NÃO TEM A SETA** (v1.11.11): sem prévia não há o que recolher; o canto superior esquerdo que a v1.11.7 lhe dava saiu junto.
- **O CSS recolhido fica de fora da TELA CHEIA e do CARTÃO DE ESPERA**
  (`:not(:fullscreen):not(:-webkit-full-screen):not(:has(.pv-busy.on))`). Em tela
  cheia sem TV a prévia É a projeção: uma regra sem o `:not(:fullscreen)` deixa o
  telão em branco, sem erro algum (e ao sair a prévia volta recolhida, sem
  alternar a marcação). O cartão `#pvBusy` mede 43 a 58px, não cabe numa linha de botão, e é o
  ÚNICO canal de falha do download no ato do "tocar" e a única porta de
  CANCELAR: com ele no ar a prévia volta à altura natural e recolhe sozinha 700ms
  depois (`PV_BUSY_SAIDA_MS`). O custo é um salto de layout num download lento.
  O desenho da seta diz a MARCAÇÃO, não a geometria do instante.
- **A seta é um `.pv-fab`** (expandida: caixa quadrada `--hit`, ícone 24px, a mesma
  `drop-shadow` tripla; recolhida: a tecla do deck), no quarto grupo `.pv-fabs--topo`. **Chevron para BAIXO =
  recolher, para CIMA = expandir** (`#icoRecolher`/`#icoExpandir`, `.alternado`):
  a caixa de controles é ancorada na base da tela, então a borda de cima da
  prévia — onde a seta mora — desce quando ela encolhe. Sem cor de estado, sem
  rótulo, sem `disabled`.
- **Efeitos que o operador vê:** a caixa de controles encolhe (304 → 204px em
  430×900) e a lista do Cronograma ganha a diferença (`--lib-caixa-h` acompanha
  pelo `ResizeObserver` que já existia); os botões de passar slide, que têm a
  altura da faixa da prévia, caem de 88–241px para a altura do transporte (36,4px a 1×); o
  fader fica com ~12px de curso — serve para MOSTRAR o número na espiada da tecla
  física, e arrastar com o dedo deixa de ser prático.
- **A escolha é GUARDADA e o veredito é DERIVADO**, a separação do
  `tocarNoCelular` × `somLocalDeveEstar`. `economiaAtiva()` exige três coisas: a
  marcação, `haDestinoDeProjecao()` e **não estar em tela cheia**.
- **Sem destino a prévia É a projeção**, e a decodificação não para (a seta
  continua clicável e o `title` diz que só vale com TV ou computador conectado).
  A régua é `haDestinoDeProjecao()` e **não** `algumaTelaConectada()`: com
  aquela, a oscilação do dongle devolveria a imagem a cada piscada do Miracast.
- **A TELA CHEIA SUSPENDE.** Ali o operador está OLHANDO para a prévia — é o
  único gesto do app sem outra leitura —, e um retângulo em branco recusa a única
  pergunta que aquele gesto faz. Suspensa e não desligada: sair volta a poupar, e
  quem reavalia é o `fullscreenchange` (num culto com a TV parada não vem outra
  notícia de destino).
- **A POSIÇÃO da guarda dentro do `play()` foi MEDIDA e é indistinguível.** Ela
  está na ÚLTIMA linha, depois do `ended = false`, do volume, do `applyMedia()` e
  do `instantCover()` — mas mover a guarda para a ENTRADA do `play()` não reprova
  uma asserção sequer, e nenhuma célula construível os separa. Ela fica no fim por
  consistência do estado (o `play()` decide tudo o que decidia), e isto está dito
  **como não-medição**: quem for "otimizar" movendo-a não vai encontrar oráculo
  contra ele, e não deve concluir daí que a escolha era arbitrária nem que era
  load-bearing.
- **O motor mora no `stage.js`** (`setSuspenso`), pelo argumento do `forceMuted`:
  um `play` chega ao stage por caminhos que o Controle não enumera (o `load` com
  autoplay, o `onBlocked`, o realinhamento), e uma guarda em cada um seria a mesma
  pergunta em quatro lugares com o quinto nascendo sem ela. O `pause()` é
  EXPLÍCITO dentro do `play()`: a suspensão é ligada com o louvor no ar, e
  desistir de chamar `play()` deixaria o decodificador rodando para sempre.
- **O QUE NÃO DESLIGA é a metade que se erra.** `current`, `ended`, a cortina, o
  giro, o `src` e a **duração** seguem como sem ela — a prévia continua sabendo
  QUAL mídia está no ar e por quanto tempo, que é o que a barra do Controle lê.
  **O jeito errado de implementar isto é soltar o decodificador "de vez"**,
  pulando a entrega do `load` à prévia: `getCurrent()` fica preso na faixa
  ANTERIOR e a barra passa a medir a mídia errada, sem erro em lugar nenhum. É o
  bloco D6 do oráculo, e a célula dele precisa de DUAS faixas na fila — com uma
  só o avanço recarrega a mesma e a asserção passa por não ter o que trocar
  (MEDIDO). O comando sai para o telão
  e para as telas da rede, o `display-status` chega a ~4 Hz, a letra troca de
  estrofe, a `MediaSession` publica. **E o avanço da fila tem os TRÊS caminhos
  cobertos, nenhum deles a prévia:** com TV é o `media-ended` do telão, só com
  telas da rede é a rede de segurança do `tela-status` (v1.8.48), e sem nenhum dos
  dois a economia não está ativa.
- **A imagem sai de vista por `visibility` no PAI** (`.preview.pv-economia`) e
  nunca por classe nos elementos: o `applyMedia` do stage reescreve o `hidden` dos
  dois a cada carga, e a classe seria apagada na mídia seguinte — a economia
  valendo no decodificador e não na tela, com o quadro congelado de volta. Com a
  prévia RECOLHIDA as camadas (`.pv-layer`, `.pv-wall`) saem de vista pela regra
  do bloco recolhido; a regra do `pv-economia` cobre o caso em que a economia
  está em vigor com a prévia EXPANDIDA (o cartão de espera no ar). **A letra e o
  texto manual FICAM** com a prévia expandida (DOM não é decodificação), e saem
  junto quando ela recolhe: 12px de altura útil não leem nada, e a leitura local
  do verso continua no Auxiliar de leitura.

Oráculos: `saida-de-audio-e-economia.test.mjs` (a máquina da economia) e
`previa-recolhida.test.mjs` (a geometria da seta).

#### Por que não é a "mesa de som" de volta

Da v5.82 à v5.188 existiu um **modo manual** com esse nome: um ícone de
alto-falante sobre a preview (`#pvSoundBtn`) ligava a saída de áudio local, e
`setStandalone()` a alternava. Ele saiu por inteiro na v5.189, a pedido do
operador, e o argumento era bom: os dois WebViews dividem o mesmo processo e a
mesma saída de áudio do Android, então o `<video>` do Controle **rouba o foco de
áudio** e interrompe o player do telão no meio do louvor. A v5.141 já tinha
escondido o botão com telão conectado, e a v5.189 concluiu que a preview é uma
ilustração — e ilustração não faz som.

O que a v5.189 não respondeu foi o caso em que **não há display nenhum**: ali a
projeção É a preview em tela cheia, e uma projeção muda não é projeção. O louvor
simplesmente não tocava em lugar nenhum.

A diferença entre as duas versões é a que faz esta ser segura onde aquela não
era: **não existe interruptor a esquecer ligado**. O estado inteiro é uma função
da conexão, então o desencontro que matava a versão manual — o operador liga a
mesa, conecta a TV depois e o telão é interrompido — não tem como acontecer: com
qualquer tela conectada este aparelho está mudo, sempre. `tools/destinos.test.mjs`
trava a ausência do botão e do modo, e `tools/boot-nativo.test.mjs` (o único que
sobe a base com a ponte presente, que é onde a conexão existe) trava os dois
lados da regra.

Do lado nativo isto era **OTA puro** — e deixou de ser na **v1.3.12**. A aposta
daqui (*"áudio audível já isenta a página do estrangulamento"*) não se sustentou
em aparelho: com o som saindo do celular e o app minimizado, o Chromium pausava o
`<video>` da preview e o louvor calava. Quem carrega o caso agora é
`AVNative.projecaoLocal` (shell **56**), que liga a proteção do telão neste
WebView **enquanto** a preview for a projeção — ver
[`DISPLAY.md`](DISPLAY.md), "A proteção da preview, e ela é CONDICIONAL". O
`SessionService` continua mantendo o processo vivo enquanto houver cena; o que
faltava não era o processo, era o renderer.

O nome antigo (`keepAudioAlive`) não voltou de propósito: ele falava de ÁUDIO, e
o que se protege é o `<video>` inteiro — a imagem parava junto.


