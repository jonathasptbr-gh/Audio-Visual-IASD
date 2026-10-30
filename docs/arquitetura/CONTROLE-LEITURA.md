<!-- Parte do capítulo do Controle (o índice das partes está em CONTROLE.md;
     o mapa geral, em docs/ARQUITETURA-WEB.md). Partida do CONTROLE.md na
     revisão A3 (2026-10-30): o texto foi MOVIDO verbatim. -->

## Controle — as ferramentas e a leitura auxiliar

> Parte do capítulo do Controle — o índice das partes e as regras que valem
> para o Controle inteiro estão em [`CONTROLE.md`](CONTROLE.md).

**Nesta parte:** [A FOLHA DE FERRAMENTAS](#a-folha-de-ferramentas-v1310) · [Leitura auxiliar (letra completa / capítulo inteiro)](#leitura-auxiliar-letra-completa--capítulo-inteiro)


### A FOLHA DE FERRAMENTAS (v1.3.10)

Relógio, Cronômetro, Timer, Itinerário (ver `CAMADA-DE-TEXTO.md`, "Ferramentas:
itinerário"), Mensagens e Sorteio — desde a v1.13.3 numa tela inicial que as lista, e desde a v1.13.4 uma LISTA VERTICAL (abaixo).
Elas eram uma ABA; hoje
são `#toolsSheet`, uma folha que sobe **de dentro do Cronograma**, aberta pelo
`#toolsBtn` — a porta da DIREITA do `#listFoot`, ao lado da Bíblia. (O
microfone ao vivo era a quarta peça delas, e saiu na v1.8.89.)

**O RODAPÉ DELA É FIXO** (`#toolsFoot`, v1.8.89), e é IRMÃO do `#toolsBody`: uma
barra que more dentro do scroller rola com os itens dele, que é o que o pedido do
operador nomeia. Ele hospeda uma FAIXA DE FECHO — à esquerda a célula do que a
ferramenta OPERA (`.misc-foot-esq`), no meio o "Projetar no telão" que CRESCE, à
direita os dois destinos (`cue-save-btn`) na ordem canônica da tabela `DESTINOS`.
As Mensagens não têm o que guardar (`cueSaveDaFerramenta` devolve `null`) **e,
desde a v1.9.1, não têm o primário de PROJETAR** (`miscProjectState` devolve
`null`): quem projeta é o toque na linha, nos dois sentidos. O que ocupa a faixa
ali é o **"+ Nova mensagem"** (v1.9.2), a única ação da ferramenta — o PARAR
desceu para dentro de cada LINHA no mesmo lote. A faixa tem UMA altura — o primário cede para
`--quad-faixa`, a medida do quadrado (a regra da v1.8.61) —, e o segundo degrau
(a barra alta de quando ele estava sozinho) saiu com o único estado que o
alcançava, que eram justamente as Mensagens. O "guardar isto" era uma LINHA no
fim de cada painel e descia com ele — o mesmo defeito que já tinha tirado o
projetar dali.

**A mudança não é de navegação, é de PARENTESCO.** Toda ferramenta daqui produz
uma CENA que entra no roteiro: a mensagem vira cue, o cronômetro e o sorteio são
projetados no meio da ordem do culto. Ser uma extensão do Cronograma é o que essa
relação já era — a aba a escondia atrás de um passo lateral, e ainda cobrava uma
quarta célula de uma faixa feita de LUGARES.

| decisão | por quê |
|---|---|
| **`activeTab` continua `'imports'`** com a folha aberta | é o recurso, não um detalhe: o rodapé do Cronograma (onde mora a porta dela) continua desenhado, o carrossel continua sabendo para onde ir e o voltar continua tendo para onde voltar. O valor `'mic'` de `activeTab` **saiu** |
| **filha de `.list-body`**, não do `<main>` nem do `<body>` | é o que define o que ela NÃO cobre: o cabeçalho (nome da tela, engrenagem) e a caixa de controles inteira ficam à vista e ALCANÇÁVEIS. Quem projeta um cronômetro precisa do transporte e da preview na frente enquanto o acerta — uma folha de corpo inteiro cobra um fechar-e-abrir por ajuste. `.list-body` nasceu para isto: dar `position: relative` ao território da lista |
| **não é `.popup-backdrop`** | aquilo é uma camada sobre a tela toda, com fundo escurecido e o toque fora fechando. Esta é uma camada da LISTA, e o app atrás dela continua vivo de propósito. Ela fica fora da tabela `POPUPS`; o ✕ e o degrau do voltar estão escritos à mão |
| **a porta tem RÓTULO** (desde a v1.5.0; ícone à esquerda dele desde a v1.13.5) | ver "As portas do rodapé" |
| **a saída tem PAR** (v1.3.13) | ela subia deslizando e sumia no talo — duas coisas diferentes para o olho, e a segunda lendo como um erro justamente porque a primeira já ensinou a esperar o contrário. Mesma curva, mesma duração (`--tools-anim`, um valor só, lido pelo CSS e pelo JS), ao contrário. Quem tira a folha da árvore é o `hidden` no FIM da animação, e não um `animation-fill-mode`: uma folha "fora" por estar transladada continuaria capturando toque. Sem `animationend`, porque `prefers-reduced-motion` desliga a animação e o evento nunca chegaria — a folha ficaria de pé para sempre |
| **trocar de aba a fecha** (`switchTab` → `fecharFerramentas`) | ela é extensão do CRONOGRAMA; de pé sobre a Bíblia seria a folha de uma tela flutuando sobre outra |
| **`fecharFerramentas` desliga os laços** | eram as mesmas guardas do `switchTab`, quando sair daqui era trocar de aba: os timers de 5 Hz do cronômetro/sorteio não podem sobrar reescrevendo nós já descartados. (A terceira guarda soltava o microfone, e saiu na v1.8.89 com ele.) |

#### A LISTA DAS FERRAMENTAS (v1.13.3; lista vertical da v1.13.4)

Pedido do operador: *"ao invés de usar tabs e sub tabs, use uma grade inicial com
todas as ferramentas prontas no primeiro toque, por exemplo não separa por tempo,
sorteio e mensagens, mas já põe direto as subdivisões"*. Eram três abas no topo da
folha (`.misc-switch`) e, dentro do Tempo, um segmentado de quatro; hoje a folha
abre nas seis ferramentas e o toque abre uma. A v1.13.3 as desenhava numa grade
de 3×2 tiles; a v1.13.4 a REVOGOU por uma lista vertical: *"como temos poucas
ferramentas, ao invés de uma grande, faça apenas uma lista vertical, mantendo o tom
de cores, mas aproveitando e distribuindo toda a altura disponível para esses 6
itens. Use o icone a esquerda e texto a direita. Se necessário, para melhor
preenchimento, aumente o tamanho da fonte."*

**E DESDE A v1.13.5 A LISTA É ESTREITA, COM A LARGURA DA PORTA**: *"ajuste a janela
da lista de ferramentas para que ela seja um janela de largura mais fina … alinhada
a direita, e ao selecionar uma das ferramentas, ela vai se expandir para ocupar o
espaço normal"* e *"a largura da janela de ferramentas durante a listagem, pode ser
a mesma largura do botão que abre a janela de ferramentas"*; e ela NÃO ROLA em tela
nenhuma: *"tenha seus botões encolhidos verticalmente para caber de forma
correta"*.

**E DESDE A v1.13.6 A LISTA NÃO TEM CABEÇALHO, A PORTA VIRA SETA E AS MARGENS
CRESCEM**: *"pode aumentar as margens dos botões na lista de ferramentas, e também
por consequência a isso, reduzir um pouco o tamanho da fonte desses textos. E apenas
para essa seção de lista de ferramentas, substitua a barra de topo com o título
'ferramentas' e o botão de fechar, por um botão de seta que ficara na base da lista,
na exata posição onde originalmente fica o botão de abrir ferramentas … (Remova o
botão de retornar das abas de ferramentas)"*.

| peça | onde | regra |
|---|---|---|
| a tabela | `FERRAMENTAS` (`id`, `nome`, `tool`, `modo`/`vista`, `ico`) | a ORDEM é a da lista, por assunto: Relógio · Cronômetro · Timer (os `CHRONO_MODES`), depois Itinerário · Mensagens · Sorteio. Os desenhos são os das cenas (`CUE_SVG`), e os dois sem cena própria ganharam o mostrador e a ampulheta (`FERR_ICO`). Ferramenta nova = uma linha |
| a lista | `renderGradeDeFerramentas` · `.ferr-grade` | UMA coluna que ocupa o corpo da folha (`flex: 1`), cada linha com uma fatia igual (`flex: 1 1 0`). A linha é o tile de Configurações DEITADO (`.qs-tile.qs-on`: `--btn-accent` + `--accent`, o raio, a resposta ao toque) — ícone à esquerda, nome à direita, alinhados à esquerda. A lista é outra classe porque os oráculos alcançam a grade de Configurações por `.qs-grade`. Nenhuma linha é apagada: toda ferramenta abre em qualquer estado |
| a largura | `#toolsSheet.estreita` · `medirPortaDasFerramentas` · `--ferr-porta-esq`/`--ferr-porta-dir` | **NA LISTA a folha tem as BORDAS DA PORTA de Ferramentas** (v1.13.5): `renderDiversos` escreve `.estreita` com `ferrNaGrade`, e as duas bordas são a distância da porta às bordas do `.list-body` (o bloco contêiner da folha), LIDAS do layout — na abertura e a cada `medirRodapeDaLista` (o `ResizeObserver` do rodapé: giro, largura, fonte do sistema). FALHA ABERTA: sem a medida valem 0, a folha larga de sempre. A base continua a do `.list-body`: a folha cobre a própria porta (a de Bíblia fica à vista e tocável — abri-la fecha esta). Os `:has(.tools-sheet:not([hidden]))` que recolhem a lista e calam a tira do Cronograma valem só para a folha LARGA (`:not(.estreita)`): com a estreita a lista continua à vista ao lado. Dentro de uma ferramenta a folha é LARGA, como sempre |
| a seta | `#toolsFechar` (`.tools-btn.tools-fechar`) · `--ferr-porta-h`/`--ferr-porta-base` | **NA LISTA NÃO HÁ CABEÇALHO, E A PORTA VIRA SETA** (v1.13.6): `#toolsSheet.estreita > .tools-head` não é desenhado, e quem fecha a folha é um chevron para baixo `absolute` no retângulo EXATO da porta que a folha cobre — `left`/`right: 0` (as bordas da folha estreita SÃO as da porta) e a altura e a base LIDAS da porta pelo `medirPortaDasFerramentas` (falha aberta: `--hit-foot` na base). O recuo de baixo da folha é o espaço dela, e os cantos de baixo da folha são `--radius-btn`, os da porta. Ela VESTE A PORTA (`--surface-porta` + `--accent`, o ícone `--icon-sm`, a resposta ao toque) sem a sombra — a sombra da porta descreve a lista correndo por baixo, e aqui não há nada por baixo. Toque → `fecharFerramentas`. `title`/`aria-label` "Fechar ferramentas". Só existe na lista (`#toolsSheet.estreita > #toolsFechar`) |
| a altura | `container-type: size` · `--ferr-linha` · `--ferr-vao` · `--hit` | **A LISTA NÃO ROLA EM CÉLULA NENHUMA** (v1.13.5; até a v1.13.4 ela rolava ~18px a 360×640 com a fonte em 1,25×). Sem cabeçalho (v1.13.6), o corpo vai do topo da folha até a seta, e a folha não tem recuo vertical próprio: as margens de cima e de baixo da lista são VÃOS dela, iguais aos de entre as linhas — SETE vãos (`--ferr-vao` = `clamp(0, (100cqh − 6 × --hit) / 7, --sp-4)`), margem e não `gap` porque a conta lê a altura da LISTA. A linha tem o PISO `--hit` (34px, o que o `geometria` cobra), os vãos cedem antes dela, e onde nem assim seis pisos cabem a linha mede a SEXTA PARTE da lista (`min-height: min(var(--hit), 100cqh / 6)`) — a exceção NOMEADA do `geometria.mjs` (piso 32), pedida pelo operador. O DESENHO cede junto — a lista é contêiner de tamanho e o nome e o ícone saem da fatia (`--ferr-linha` = `(100cqh − 7 × --sp-4) / 6`): o nome × 0,4 entre `--fs-md` e `--fs-3xl`, o ícone × 0,55 entre `--icon-sm` e 26px (REGRA PRÓPRIA, um degrau acima do `--icon-lg`). MEDIDO no avançado de fábrica (linha · vão · corpo): 430×900 **73,5** · 8 · 497,1; 412×892 **73,2** · 8 · 495,1; 360×640 **34,0** · 8 · 260,2; 360×640 com a fonte em 1,25× **34,0** · 4,3 · 233,9; com 1,3× **34,0** · 3,3 · 227,2; 360×600 com 1,3× **31,2** · 0 · 187,2 (a exceção). No estado do `geometria` (com a semente dele, a caixa de controles mais alta), 360×640 com 1,3× mede **33,9** sobre 203,6px de corpo — é ali que a exceção nomeada vale (33,4 na v1.13.5). Rolagem 0 em todas |
| as margens | `.ferr-grade > .ferr-tile` · `#toolsSheet.estreita` | **MAIORES DESDE A v1.13.6**, as três: a da lista dentro da folha (`--sp-4` dos lados, era `--sp-2`; em cima e embaixo, os vãos acima), o vão entre as linhas (até `--sp-4`, era `--sp-3`) e o recuo DENTRO da linha (`--sp-6` dos dois lados, era `--sp-4` à esquerda e a reserva do ponto à direita — o ponto passou a morar DENTRO do recuo da direita, centrado nele). A letra encolhe por consequência: o teto da altura baixou a `--fs-3xl` e o da largura baixa sozinho, porque o recuo maior come a largura do nome |
| o corpo do nome | `acertarLetraDaListaDeFerramentas` · `tetoQueCabe` · `--ferr-fs-teto` | o nome tem DOIS tetos: o da altura (o `clamp` acima) e o da LARGURA, MEDIDO — o maior corpo em que o nome mais longo cabe sem reticências na largura da porta (a razão `clientWidth / scrollWidth` do pior, × 0,98, até três passadas; piso 11px). Roda no desenho da lista, num `ResizeObserver` dela e quando um número aparece ou muda de dígitos. MEDIDO (v1.13.6, entre parênteses a v1.13.5): 18,4px a 430/412 (20); 13,6 a 360×640 (15,9); 12,8 com 1,25× (14,2); 12,3 com 1,3× (13,7); 11 (o piso, sem cortar) a 360×740 com 1,5× (11) |
| as leituras vivas | `pintarGradeDeFerramentas` · `data-estado` (`no-ar` · `contando` · `ocioso`) | o PONTO de "no ar" (`.ferr-no-ar`, o `--live-strong` de 7px da aba projetando de antes, na ponta DIREITA da linha, no meio da altura, centrado DENTRO do recuo da direita — v1.13.6; MEDIDO sobre o `--btn-accent`, 4,27:1 no escuro e 5,65:1 no claro) na linha de quem projeta (o Tempo projeta UM modo, então só a dele), e o NÚMERO do Cronômetro ou do Timer CONTANDO no LUGAR do nome (`.ferr-leitura`, a `chronoReading` do telão, v1.13.5: na largura da porta os dois não cabem juntos — o ícone fica e diz qual ferramenta é, e o nome segue no `aria-label`; na v1.13.4 o número ia à direita do nome e na v1.13.3 substituía o ícone). O tique (`ferrGradeTimer`, `CHRONO_TICK_MS`) só existe com a lista à vista e algo contando; o que muda o Tempo por fora (o par, a notificação) repinta pelo `renderChronoEControles` → `acertarGradeDeFerramentas`. O nome acessível diz os dois |
| o estado | `ferrNaGrade` | UMA pergunta a mais sobre o estado de sempre (`miscTool`, `tempoVista`, `chrono.mode`, que continuam dizendo QUAL painel). Nasce `true` em TODA abertura da folha (`abrirFerramentas`): a regra de Configurações, que também reabre na grade dela. `chronoPrefs.vista` deixou de ser lida e escrita |
| o toque | `abrirFerramenta(id, { animar })` | escreve `miscTool`, a vista do Tempo e o MODO (`chronoTrocarModo`, que não desenha — o `chronoSetMode` saiu com o segmentado: trocar de modo zera a contagem, como o segmentado fazia; o mesmo modo e o Itinerário não mexem nela). Com a folha fechada ela abre direto na ferramenta (a porta dos oráculos) |
| o cabeçalho | `pintarCabecalhoDasFerramentas` · `#toolsTitle` · `#itinTitulo` · `#toolsClose` | **SÓ EXISTE DENTRO DE UMA FERRAMENTA** (v1.13.6; na lista quem fecha é a seta): o NOME dela no centro da folha larga e o ✕ na ponta. **NÃO HÁ VOLTAR NA TELA** (v1.13.6, a pedido: *"Remova o botão de retornar das abas de ferramentas"*) — a trilha 1 da grade do cabeçalho fica vazia, reservada, e o título não sai do centro. **No Itinerário o título é o NOME DO ITINERÁRIO ATIVO** (v1.13.4): o `#itinTitulo` (nome e seta, a porta da gaveta) toma a trilha 2 e o `#toolsTitle` fica escondido — ver `CAMADA-DE-TEXTO.md`, "Ferramentas: itinerário" |
| a volta | `voltarAGradeDeFerramentas` · `__avBack` degrau 2.5 | o voltar do Android devolve a lista (fechando a gaveta dos itinerários antes) — é o ÚNICO caminho de volta desde a v1.13.6, e ele ANIMA como o toque; da lista, o voltar fecha a folha |
| o rodapé | `renderFoot` | a lista não tem rodapé: o primeiro ramo só repinta o par ao lado da preview, que todo mutador das ferramentas espera daqui |
| a animação | `trocarVistaDasFerramentas` · `.ferr-saindo` · `.ferr-fantasma` | SÓ PELO TOQUE (a regra da seta da prévia: a abertura e quem chama direto assentam no ato). A folha tem altura FIXA, e a LARGURA muda (v1.13.5): as bordas da folha andam por WAAPI (`left`/`right`, de onde estavam até onde a classe as pôs, `--dur-lenta`) junto com o conteúdo — as roletas se remedem pelo `ResizeObserver` delas no caminho. No conteúdo: o que sai vira uma camada ABSOLUTA no lugar exato do corpo e do rodapé, sem toque e SEM IDS (quem procura `#chronoRoletas` durante a troca tem de achar o painel novo) e sobe esmaecendo (`--dur-lenta` × 0,6); o que entra sobe aparecendo, já no estado final — as roletas se medem pela altura de verdade. Na volta, o inverso. **O CABEÇALHO E A SETA TROCAM DE LUGAR COM A VISTA** (v1.13.6) e vivem fora do corpo: quem SAI vira um FANTASMA (clone sem ids e sem toque, no retângulo em que estava) e esmaece com a camada; quem ENTRA aparece com o corpo. A caixa da folha não anda no eixo vertical em quadro nenhum — a troca só muda o recuo do corpo, e o corpo novo nasce no lugar final (MEDIDO quadro a quadro nas duas direções: 0px). `prefers-reduced-motion`: nenhuma camada |
| reabrir descendo | `abrirFerramentas` | a folha `saindo` conta como fechada: reabri-la nos 220 ms da descida era engolido (achado da v1.13.1) |

**Os nomes internos ficaram**: `renderDiversos`/`refreshDiversos`, `miscTool`,
`MISC_TOOLS` e as classes `.misc-*` — e, da grade que a v1.13.4 deitou, `ferrNaGrade`,
`renderGradeDeFerramentas`, `#ferrGrade`, `.ferr-grade` e `.ferr-tile`. Renomeá-los
não muda um pixel — a mesma regra do `'simple'` do Modo Fácil. O que mudou de host foi só o destino dos
`appendChild`: `libraryEl` → `#toolsBody`.

Oráculo: **`tools/ferramentas-folha.test.mjs`**, e a asserção que carrega o lote
é GEOMÉTRICA — a caixa da folha contra a do cabeçalho e a da `.bottombar`. Uma
folha de corpo inteiro continua funcionando e continua bonita; o que ela perde
não aparece em teste de comportamento nenhum. O bloco G cobre a lista (a ordem,
uma coluna, o voltar, as leituras vivas, a folha estreita que se ALARGA animando) e o
V a GEOMETRIA dela — em cinco células (430×900, 412×892, 360×640, 360×640 com a fonte
em 1,25× e 360×600 com 1,3×, a da exceção, com premissa de que ali seis pisos NÃO
cabem): as seis de borda a borda do corpo SEM ROLAR, nenhuma abaixo do `--hit` fora da
exceção, as BORDAS DA PORTA (±1px), o título inteiro e nenhum nome cortado — e o nome
do itinerário no cabeçalho. O `geometria.test.mjs` cobra o piso de toque, com a
exceção nomeada.

### Leitura auxiliar (letra completa / capítulo inteiro)

O telão mostra **uma** estrofe (ou **um** versículo) por vez — o formato certo
para quem assiste, e o errado para quem opera: o operador precisa saber o que
vem depois, e a preview só espelha o que já está no ar. O botão
(`#lyricsViewBtn`, folha com linhas) abre um bottom-sheet **com scroll**
(`#lyricsPopup`) com a íntegra do que está em cena.

**ELE É A SÉTIMA CÉLULA DA LINHA DE TRANSPORTE desde a v1.4.31**, a pedido do
operador. Ele morava SOBRE a preview, no topo da coluna de operação, e era o
único dos três de lá que não opera a cena — a cortina e o mudo mudam o que a
congregação vê e ouve, este abre uma leitura no celular. Na fileira de baixo ele
fica ao lado da playlist, o outro botão que só abre uma folha, e veste a mesma
`.t-btn` dos vizinhos: um chapado sozinho numa fileira de seis com fundo não se
lê como distinção. O canto que ele deixou vago voltou a ser da **cortina**, que
o ocupava até a v5.50.

**E ELE GANHOU UMA BADGE** (`#lvBadge`), pedida no mesmo lote: *"para indicar
que ele está com alguma função disponível quando houver alguma mídia que
disponibiliza uma das funções dele"*. Ela nasce da mudança de casa — sobre a
preview, "não há o que ler" se lia no próprio palco, a dois centímetros do
botão: o wallpaper no ar responde sozinho. Na sétima célula não há esse
contexto, e sem ela a única forma de descobrir que não há letra é abrir a folha
e ler *"Nada em exibição"*.

- **É um PONTO, não um número:** o que ela responde é sim/não. As fontes do
  auxiliar são abas, não itens de fila — um "3" ali prometeria uma contagem que
  a folha não usa.
- **A fonte é `lyricsViewSources`, a MESMA da folha** (`renderLeitorBadge`). Uma
  segunda conta de "o que está disponível" divergiria no primeiro recurso novo, e
  esta é a que ninguém confere: a folha denuncia o erro dela ao abrir, a badge
  não denuncia nada — ela só acende errado.
- **Os rótulos saem das PRÓPRIAS abas** (`data-lvsrc`), pelo mesmo motivo. O
  `title` diz O QUE há ("Auxiliar de leitura: letra, cifra"); a badge diz SE há.
- **Quem a acende é `renderNowPlaying`**, ao lado do selo de camadas e pela mesma
  razão que ele: aquela função tem um `return` por ramo de cena, e qualquer linha
  no fim dela só rodaria para o último caso.
- **E SEM FONTE NENHUMA O BOTÃO FICA INDISPONÍVEL** (v1.8.36). Pedido do
  operador: *"desative o botão (modo cinza mais claro, sem toque) de auxiliar de
  leitura quando não há nenhum conteúdo a ser exibido nele, como na abertura do
  app ou etc..."*. A badge já dizia SE há — mas um ponto apagado sobre um botão
  ACESO continua sendo um botão aceso, e o toque abria a folha para ler *"Nada em
  exibição com letra ou texto bíblico"*. É a terceira vez que este app troca
  EXPLICAR por NÃO OFERECER (o microfone sem TV na v1.2.21, a aba de cifra sem
  cifra na v1.8.28), e aqui a troca é a mais barata das três: o botão fica na
  mesma célula e volta sozinho na cena seguinte.
  - **`disabled`, e não uma classe.** É o atributo que o `.t-btn:disabled` já
    veste com `--op-inativo` — a linguagem do INDISPONÍVEL deste app, a mesma
    dos dois botões de slide ao lado —, que tira o nó da ordem de tabulação e
    que faz o navegador engolir o toque **sem um `pointer-events` nosso**. O
    `title` continua dizendo POR QUÊ, que é o que um botão apagado deve a quem o
    encontra.
  - **A guarda é POR NÓ**, e não um `return` cedo no topo: a badge e o botão são
    elementos diferentes, e desistir por causa da primeira deixaria o segundo
    aceso para sempre num bundle em que só ela faltasse.
  - **O toque não se prova por hit-test.** O Chromium HIT-TESTA um botão
    desabilitado (MEDIDO: `elementFromPoint` devolve o `<use>` de dentro dele) —
    quem engole o evento é o despacho, não a geometria. A única régua é o
    DESFECHO: a folha não abriu.

- **Quatro fontes possíveis**: a **letra** da música em cena
  (`currentItem.lyrics`, os mesmos slides que o Display projeta — o slide de
  capa vira a linha "Início"), o **capítulo** da leitura bíblica
  (`bibleSession.verses`, numerados como numa Bíblia impressa), a **cifra**, e as
  **páginas** de uma apresentação.
- **A LISTA É A PILHA DO QUE ESTÁ EM EXIBIÇÃO, DA FRENTE PARA TRÁS** (v1.4.26).
  Pedido do operador: *"o auxiliar de leitura deve deixar disponível os
  auxiliares de tudo que estiver em exibição, seja uma música de fundo e uma
  bíblia sobrepondo… devo ter a opção da letra, da cifra e da bíblia, pois todos
  estes estão em exibição. É claro, o elemento na camada mais a frente de tudo é
  o que aparece na abertura"*. Uma música de fundo com o versículo por cima
  oferece **Bíblia, Letra e Cifra**, e abre na **Bíblia**.

  Ele **REVOGA duas exclusividades** que este arquivo defendeu — a da Bíblia
  (v1.1.11) e a da apresentação (v1.4.24). O que as duas acertavam era a
  PRECEDÊNCIA; o que erravam era tirar as outras da mesa: a camada de baixo
  continua no ar, e quem opera pode precisar dela no minuto seguinte.

  - **E O REORDENAMENTO ACONTECE DENTRO DA `.fit-seg`** (v1.4.39). Ele anexava
    em `#lyricsViewSeg` — o bloco com o respiro —, e os botões moram um nível
    abaixo: isso não reordenava, **reparentava**. Fora do contêiner flex o
    `flex: 1` do `.fit-opt` fica inerte e cada aba volta a ser `inline-block` do
    tamanho do próprio rótulo (MEDIDO a 430px: faixa de 401px, abas de 44,8 e
    42,7). Falha CALADA — a ordem que o pedido da v1.4.28 queria continuou
    certa, e o que se perdeu foi só a largura. Com o pai certo as abas voltam a
    dividir a faixa em partes iguais, e uma fonte que entra ou sai redistribui
    o espaço sozinha (MEDIDO: 4 abas cabem numa linha até 320px).
  - **A ORDEM É A DO `slideTarget()`** — a Camada de Texto por cima da mídia —, e
    não é escrita duas vezes: as duas fazem a mesma pergunta sobre o
    empilhamento do telão e divergiriam no primeiro recurso novo.
  - **E A ORDEM DAS ABAS NA TELA É ESSA MESMA** (v1.4.28), a pedido do operador:
    *"a aba da bíblia está entre a letra e a cifra, coloque ela à esquerda, pois
    letra e cifra são irmãs, sempre juntas quando ambas existem"*. A ordem certa
    já existia — o que havia era uma SEGUNDA ordem, a do HTML estático, que
    ninguém tinha razão para manter em dia e que divergiu em silêncio: a folha
    continuava funcionando, com a Bíblia separando duas abas que são irmãs. Hoje
    `renderLyricsView` **reordena os botões visíveis por `avail`** (`appendChild`
    MOVE um nó que já está no pai, então é reordenação no lugar, e é
    idempotente). Uma fonte nova entra no lugar certo por ter entrado na pilha, e
    não por alguém lembrar de mover um `<button>`.
  - **`deck` e `lyrics` DEIXARAM DE SER EXCLUSIVOS** (v1.4.28). Eram-no por
    construção — `currentItem` é uma coisa só —, e deixaram de ser quando a
    apresentação virou CAMADA: com um deck sobre um louvor de fundo, quem está
    em `currentItem` é a MÚSICA. Por isso a fonte `deck` sai de `lvDeckRec()`, e
    não de `lvItem()`: perguntar páginas à música devolveria nada, e a aba
    sumiria justamente na cena que o pedido criou. Ver "Mídia visual sobre o
    áudio" em [`CAMADA-DE-TEXTO.md`](CAMADA-DE-TEXTO.md).
  - **A CIFRA continua por ÚLTIMA**, e é a única precedência que não vem de
    camada nenhuma: ela não é projetada — é o auxiliar de quem TOCA o que está
    no ar —, e por isso nunca abre sozinha enquanto houver o que está sendo
    visto.
  - **A frente vence a ESCOLHA GUARDADA quando ela muda** (`lvFrenteVista`, em
    `openLyricsPopup`). A aba escolhida sobrevive à reabertura desde a v1.2.x, e
    com a pilha essa memória passa a poder contradizer o pedido: quem tocou
    "Cifra" com o louvor sozinho no ar não pediu cifra para o instante em que o
    versículo subir por cima dele. *Mudou a frente, mudou a pergunta* — e dentro
    da mesma frente a escolha continua sobrevivendo. **O `null` de
    `lvFrenteVista` significa "nenhuma frente vista ainda", nunca "a frente
    mudou"**: na primeira abertura não houve cena anterior, logo não há escolha
    de antes a invalidar — e uma fonte pedida antes dela é um PEDIDO, não uma
    sobra.
  - **Com a folha ABERTA a frente que muda não troca a aba.** A regra mora na
    ABERTURA: trocar a leitura embaixo do dedo de quem está lendo é pior que uma
    aba desatualizada, e o seletor está a um toque dali.
  - **É PROJEÇÃO que põe alguém na pilha**, nunca a existência da sessão — um
    capítulo aberto e fora do ar volta lá embaixo, na RESERVA. E **com um alvo da
    Biblioteca nada da cena entra**: quem abriu a folha de uma música pediu
    AQUELA música.

  **A apresentação SOZINHA continua sozinha**, e o pedido da v1.4.24 (*"durante
  uma apresentação, não quero botões de letra, ou de cifras nessa tela"*) segue
  cumprido — agora **por construção**, não por uma regra que cale as outras: um
  deck não tem letra nem acorde. Com um louvor de fundo por baixo dele (v1.4.28)
  a resposta muda, e muda **porque a cena mudou**: ali a letra está em exibição. Com uma fonte só, o seletor inteiro some sem
  nenhum caso especial no desenho. Oráculo: `tools/leitor-camadas.test.mjs`.

  **A lista é o MOLDE VERTICAL do capítulo bíblico**, também a pedido: a página
  em cena marcada e centralizada pelo `lvScroll` que já existe. O que muda é o
  corpo — onde o versículo tem texto, a página tem a própria imagem, ocupando a
  largura da coluna (num chip pequeno o texto do slide não se reconhece, e o que
  o operador foi ver é **o que vem a seguir**).

  **E O RÓTULO É SOBREPOSTO** (v1.4.35): *"coloque o número da página sobreposto
  ao slide, para o slide poder ficar centralizado, e use um 'no ar', ao lado do
  indicador de página para indicar a página atual, assim como já usamos em
  diversos elementos no app"*.

  - **O número ocupava uma COLUNA à esquerda** (MEDIDO: 27px de 408), e com ela
    o `padding-left` que a `.lv-row` então reservava para a FAIXA do versículo no
    ar. Os dois juntos tiravam a miniatura do centro da linha. Fora do fluxo, ela
    ocupa a largura inteira e uma página 4:3 aparece centrada pelo `object-fit`,
    sem nada a compensar. **Desde a v1.8.33 o recuo já não existe na classe
    base** — ele desceu para o `.lv-row--verse`, seu único consumidor —, e o
    `padding-left: 0` que a página usava para desfazê-lo saiu por redundante
    (MEDIDO idêntico antes e depois).
  - **O selo pousa SOBRE a imagem, então precisa de fundo OPACO** — o que está
    atrás é um pixel de apresentação, que pode ser qualquer cor. É `--panel`, e é
    o único tom opaco em que o número passa AA (MEDIDO em `tokens.css`: `--muted`
    dá 4,88:1 sobre `--panel` e 3,66:1 sobre `--panel-2`). Ele é a única exceção
    nomeada da regra R1 no `tokens.test.mjs`, pela razão da barra de rolagem: é
    RÓTULO, com `pointer-events: none`, e não hospeda controle nenhum.
  - **A página no ar troca o par para `--live-fill` + `--live-strong`**, o mesmo
    de `.row-item.no-ar`, e ganha o **`● No ar`** ao lado do número. Ele
    substituiu o denim cheio da v1.4.24 (`--accent-fill`, hoje só de BOTÃO), e
    a troca de MATIZ é a regra da paleta: azul é ESCOLHA entre alternativas
    (`--btn-accent` + `--accent` desde a v1.8.95), vermelho saturado é *está no
    ar agora* — e uma página projetada é o segundo caso. A barra de acento **nunca
    chega a uma página desde a v1.8.33** (ela é do `.lv-row--verse`); antes disso
    era preciso suprimi-la aqui, senão ela apareceria pela faixa transparente de
    uma página 4:3 — duas cores dizendo a mesma coisa na mesma linha, que é a
    razão que volta a valer se alguém a devolver à classe base.
  - **O `● No ar` nasce em TODA linha e quem o revela é o CSS.** `lvMarkCurrent`
    move a classe `.current` SEM redesenhar (é o que mantém as URLs de objeto
    vivas a cada troca de página); criá-lo no JS obrigaria aquela função a mover
    um nó também — um segundo lugar para divergir, e o defeito seria o selo
    ficando na página anterior.

  Quatro coisas que este desenho não pode perder:

  - **`loading="lazy"`**: uma apresentação de centenas de páginas decodificada
    de uma vez são centenas de bitmaps no renderer que hospeda os dois WebViews
    e a `Presentation`.
  - **A ALTURA RESERVADA** (`aspect-ratio` no CSS), que é o que torna o `lazy`
    seguro: uma imagem fora da tela tem altura ZERO, e o `lvScroll` mede
    `offsetTop` — sem a reserva a coluna cresceria à medida que as imagens
    entrassem e a página no ar apareceria fora da tela.
  - **A PÁGINA FICA FORA DA ASSINATURA** (`lvSignature`): o destaque anda por
    classe (`lvMarkCurrent`). Com a página lá dentro, cada toque no ⏭ remontaria
    a lista — revogando e recriando dezenas de URLs de objeto no meio do sermão,
    com "a folha pisca" como único sintoma.
  - **AS URLS SÃO REVOGADAS** (`lvDeckSoltarUrls`), no ponto único em que o corpo
    é esvaziado e ao fechar a folha. Uma `createObjectURL` sem revogação segura o
    Blob da página enquanto o documento existir.

  **E o A+/A− some nesta aba.** Ele dimensiona TEXTO, e a miniatura ocupa a
  largura da coluna: um par de botões que continua ali e não muda nada na tela é
  a mesma coisa que a aba de cifra sem cifra — não oferecer é melhor que
  explicar.
- **A BÍBLIA NO AR ABRE A FOLHA, e não a esvazia** (v1.1.11, revogada em
  parte na v1.4.26). Projetando, ela é a camada da FRENTE: a folha abre nela, e
  a letra e a cifra do louvor de fundo continuam a um toque no seletor. Fora do
  ar ela não disputa com a música e volta só como RESERVA — quando não há letra
  nem cifra para mostrar.

  A regra é sobre **projeção**, nunca sobre a sessão existir. O que a v1.1.11
  leu como "quem lê a Bíblia em voz alta não vai consultar a cifra do louvor de
  fundo no mesmo minuto" era uma resposta de PRECEDÊNCIA escrita como silêncio;
  a precedência ficou, o silêncio saiu.
- **O seletor do topo (`#lyricsViewSeg`) só aparece quando há mais de uma** fonte
  — com uma só, ela abre direto, sem um seletor de uma opção. **E a visibilidade
  de CADA botão sai da mesma lista** (v1.1.18): os três são HTML estático, então
  calcular a lista certa e não aplicá-la deixava a Bíblia à vista com uma música
  em cena — a regra recusava a fonte e a tela a oferecia. Os botões dividem a
  largura (`.fit-seg` é `flex`, `.fit-opt` é `flex: 1`), então menos abas já
  significa mais espaço para cada uma. A escolha manual (`lvSource`) vale
  enquanto aquela fonte existir; sumindo, cai na disponível.
- **O corpo é uma CAIXA com barra de rolagem** (v1.1.11). Sem ela o texto
  terminava no ar contra o fundo da folha, e "acabou" era indistinguível de
  "está cortado" — a rolagem só se descobria tentando. O tom vem de `--surface`,
  que dentro da `.popup-sheet` já resolve para o afundado; preenchimento, nunca
  contorno.
- **A LETRA É CENTRADA, E O DESTAQUE É SÓ A COR** (v1.8.33). Pedido do operador:
  *"faça o texto ser centralizado horizontalmente, remova o indicador de posição
  atual que temos de 'barra lateral' use apenas a coloração do texto atual como
  indicador"* — na letra, e **nos dois modos**. Vale para os dois de graça porque
  o construtor é UM (`lvBuildSong`, chamado pela folha do avançado e pela zona do
  Modo Fácil): uma classe, duas casas. A letra ganhou o modificador que faltava
  (`lv-row--letra`, irmão de `--verse` e `--slide`) — ela era a única espécie de
  linha SEM nome próprio, e por isso o desenho dela morava na classe BASE, que as
  outras duas desfaziam uma a uma. **A barra mudou de classe em vez de ganhar uma
  exceção:** ela é do `.lv-row--verse` agora, onde responde *"onde eu estou?"*
  num capítulo de linhas parecidas — outra pergunta da que a letra faz, onde a
  estrofe em acento já se separa das vizinhas. O `padding-left` que existia só
  para reservá-la saiu junto: com ele a caixa fica 8,8px fora do centro, que é
  metade do pedido feita pela metade. Oráculo: `letra-centrada.test.mjs`.
- **A CIFRA é a ÚLTIMA da lista** (`lyricsViewSources`), e isso é a precedência
  inteira: sem escolha do operador, `lvActiveSource` devolve a primeira — que é
  a camada mais à frente do que está sendo VISTO. A cifra nunca abre sozinha
  enquanto houver isso, porque ela não é uma camada: é o auxiliar de quem toca a
  mídia que está no ar. Quem toca escolhe a cifra uma vez. Ela **não existe no navegador** (a busca
  precisa da ponte — CORS) e **nunca vai ao telão**: é para quem toca, e o que a
  congregação vê continua sendo a letra.

  **E ELA SÓ ENTRA NA LISTA COM FOLHA NA MÃO** (v1.8.28, pedido do operador:
  *"não quero acesso a essa seção se não tem esse conteúdo"*). São duas
  perguntas: `cifraCabe` decide se vale PROCURAR (por conteúdo musical, e é ela
  que o `send` consulta), `cifraTemFolha` decide se há o que MOSTRAR (pelo
  desfecho, no cache). Enquanto houve só a primeira, a aba aparecia para toda
  faixa de áudio do acervo — MEDIDO, dois terços dos álbuns não estão sob
  endereço deduzível nenhum — e o toque abria a frase de "não encontrei". A
  ESPERA (`buscando`) fica de pé só para quem ESCOLHEU a aba, senão ela sairia
  de baixo do dedo do músico a cada troca de faixa. A BADGE do transporte segue
  junto por sair da MESMA lista, e as cinco frases de falha saíram da folha — o
  diagnóstico é do Registro.

  Ela é lida **sob demanda** — com uma exceção: **o Hinário 2022 fica guardado no
  aparelho** (v1.1.28), baixado junto com o hinário, porque é o único acervo cujo
  endereço no site é deduzível do nome. Fora dele o cache é um `Map` que morre
  com o app. A busca começa quando a música **entra em cena** — não quando a aba
  abre (v1.1.17): assim a folha costuma estar pronta antes de alguém pedir por
  ela — e desde a v1.8.28 ela começa **também na abertura da folha**, porque o
  alvo da Biblioteca (o ensaio) nunca passa pela cena. Quem decide se vale
  PROCURAR é `cifraCabe`, nos três pontos; quem decide se a aba se OFERECE é
  `cifraTemFolha`, sobre o desfecho. **Ela é SÓ AUTOMÁTICA** (v1.3.3): houve uma busca à
  mão — lista de resultados, prévia e endereço fixado por música —, e ela saiu a
  pedido do operador. Achando a cifra errada, a saída é o link "Ver no Cifra
  Club"; não achando nenhuma, **a aba não é desenhada** (v1.8.28) e o motivo é
  lido no Registro. O desenho
  completo — as tentativas (o que está guardado no aparelho, catálogo,
  álbum-como-artista, artistas padrão, busca), os cinco motivos de falha (que
  desde a v1.8.28 são lidos no Registro, não na folha), a transposição que
  preserva a COLUNA do acorde e por que o parser mora no web e não no Kotlin —
  está em
  **"A aba de cifra"** no `CLAUDE.md`; a regra em si, em `controle/cifra.js`,
  com oráculo em `tools/cifra.test.mjs`.

  **A FOLHA NÃO É SÓ DE QUEM ESTÁ NO AR** (v1.2.14): a gaveta de uma faixa da
  Biblioteca tem **"Abrir a folha"**, que aponta este mesmo leitor para aquela
  música — cifra, tom, corpo de letra e rolagem — **sem levar nada ao telão**.
  É a porta de quem toca: até então, ler uma música exigia projetá-la. O relógio
  e o destaque de estrofe continuam sendo da CENA (`lvNaCena`): seguir o tempo
  do louvor que está tocando faria a folha do ensaio andar no compasso errado, e
  isso *parece* funcionar.

  **A cadeia de tentativas é UMA** (`cifraProcurar`) e tem dois consumidores: a
  aba, e a **varredura do acervo** que guarda as cifras no aparelho. Ela é quem
  responde *"para quais álbuns o site não tem cifra?"* — o Registro mostra, por
  coleção, quantas foram achadas, quantas o site tem sem cifra e quantas não têm
  página, com exemplos nomeados e o endereço tentado.

  A fila de controles carrega **cinco** botões, e a ordem é a de uso: a rolagem
  automática e a velocidade (usadas durante a música inteira) antes do par de
  transposição (usado uma vez, antes dela), com o ⛶ da tela cheia no fim. Os
  quatro primeiros são `.lv-fonte-btn` porque são o mesmo gesto — um passo por
  toque numa escada —, e duas aparências para o mesmo gesto seria ruído. Todos
  são QUADRADOS e medem `--hit` desde a v1.6.2: o de velocidade era o único fora
  da família, e o que o faz caber é o CORPO (`--fs-2xs`), não uma largura própria.

  **A fila fica FORA da caixa que rola** (ela subiu para o cabeçalho na v1.6.3,
  quando o tom desceu para dentro da caixa e a barra ficou só com botões):
  dentro, os controles rolavam com o texto e o pausar saía de cena em segundos.
  Ela existe só na cifra e é limpa em `renderLyricsView`, num ponto só.

  **A VELOCIDADE ABRE UMA GAVETA, e não cicla** (v1.7.4). Pedido do operador:
  *"faça com que o botão de velocidade abra uma gaveta, substituindo seus botões
  vizinhos, pela lista de botões com as variações de velocidade… sem passar por
  cada uma delas em carrocel"*. O ciclo era um preço escrito desde a v1.1.20
  (*"com CINCO degraus, dar a volta custa menos que um segundo botão"*), e a
  conta muda quando o alvo é ESPECÍFICO: ir do `2×` ao `0,5×` custa um toque na
  gaveta e quatro no ciclo, e os três do meio ACONTECEM — a folha muda de ritmo
  em cada um deles, com a música no ar.

  É **o mecanismo da faixa da linha aplicado à fila**: ela troca de CONTEÚDO, não
  de lugar. Nada é criado por cima da folha, nada a empurra, e a caixa fica com a
  mesma altura. **O ⛶ é a exceção nomeada à palavra "vizinhos"**: *a fila da
  cifra sempre tem a saída*, e escondê-lo deixaria uma gaveta aberta em paisagem
  sem saída à vista.

  **E A GAVETA VIROU UM SLIDER, QUE DESLIZA** (v1.8.80). Pedido do operador:
  *"primeiramente isso não possue nenhuma animação. Então faça uma animação
  horizontal para essa gaveta. Mantenha o botão de play e o botão de seletor de
  velocidade sempre visível, agora a gaveta vai surgir a direita desses dois
  itens. E mude a lógica, não mais uma gaveta com botões, mas um slider
  regulável, quando aberto, o botão que abriu ele se torna um x para fechar"*.
  São três mudanças que se sustentam:

  | o quê | antes (v1.7.4) | agora |
  |---|---|---|
  | quem some ao abrir | os QUATRO botões da fila | só o −½/+½ (`.lv-cifra-tom`) |
  | o controle | cinco botões, um por degrau | UM `<input type=range>` sobre os mesmos cinco |
  | o seletor | sumia junto | vira **✕** — a saída no lugar de onde a entrada foi |
  | a caixa | `display: contents` | uma caixa de verdade, que ANIMA de 0 até a borda da fila |

  **O `display: contents` teve de sair**: uma caixa que não existe no layout não
  tem largura para transicionar, e a animação é o pedido. Em tela cheia a fila é
  uma COLUNA, e lá a mesma gaveta cresce em ALTURA com o slider na vertical (a
  receita do fader do volume) — sem o par de regras, a largura numa trilha de
  66px sairia recortada pelo `overflow: hidden` da própria gaveta, com o controle
  vivo e invisível.

  **E ELA SAIU DO FLUXO, que é o que fez os três defeitos seguintes sumirem de
  uma vez** (v1.8.83). Relato do operador: *"a margem a direita do botão está
  duplicada em relação as outras margens entre os botões… o botão de tela cheia
  está separado da fileira dos botões a esquerda, junte ele a ela. Fazendo com
  que a barra de ajuste de velocidade cubra esse botão também, pois atualmente
  ela apenas empurra ele para o lado, jogando todos os outros botões para fora da
  janela do auxiliar de leitura… verifique esse movimento, para que os botões de
  aumentar fonte, diminuir fonte e fechar janela não sejam movidos de seus
  lugares originais"*.

  Os três são o MESMO defeito, e ele é *a gaveta ser um ITEM DA FILA*:

  | o que se via | a causa, MEDIDA |
  |---|---|
  | a margem à direita do seletor é o dobro | fechada com `width: 0` ela continua sendo item e recebe `gap` dos DOIS lados: **4 + 0 + 4 = 8px**, contra 4 em todos os outros pares |
  | o ⛶ está separado da fileira | o respiro próprio dele (`--sp-5`) fazia o último vão medir **13,6px** — 3,4× o vizinho |
  | abrir joga tudo para fora da janela | os 9rem entravam na conta da fila: o ⛶ andava **76px** e o ✕ do cabeçalho terminava **51,6px fora** da caixa a 360px (91,6 a 320) |

  `position: absolute` dentro de uma fila `relative` resolve os três: fora do
  fluxo ela **não tem `gap` nenhum**, a fila mede o MESMO aberta ou fechada, e o
  que ela faz ao crescer é passar **por cima** do −½/+½ e do ⛶. MEDIDO depois:
  deslocamento **ZERO** do A−, do A+, do ✕ e do ⛶ em 320, 360 e 430px, nos dois
  estados.

  - **`--vels-off` é onde ela começa** (dois botões mais dois vãos) e a largura
    aberta é `calc(100% - var(--vels-off))` — as duas DERIVADAS dos tokens. Os
    9rem de antes eram um número escrito à mão sem relação com nada, e era ele
    que sobrava para fora.
  - **O trio coberto some por `visibility`, nunca por `width: 0`**: encolher era
    o que fazia a fila mudar de tamanho. `display: none` tiraria as caixas do
    fluxo e a fila encolheria de novo, pelo caminho de trás.
  - **O respiro próprio do ⛶ saiu nos dois eixos**, revogando a v1.6.1. A razão
    antiga fica registrada porque era boa — o erro ali é ASSIMÉTRICO: pegar a
    saída em vez do `+½` desfaz o modo inteiro e gira a Activity na frente de
    quem toca, enquanto o inverso custa um meio tom. **O preço encolheu no mesmo
    lote**: com a gaveta aberta o ⛶ não é vizinho de nada, porque ela o cobre. De
    carona, o cabeçalho a 320px deixou de estourar 16px e passou a estourar 2.

  **O slider regula o ÍNDICE da escada, nunca um número contínuo:** um contínuo
  pediria outra gramática de rótulo, outro estado gravado e outra conta no
  `cifraRolarQuadro`, e o pedido é sobre COMO ESCOLHER. Regular não fecha a
  gaveta — quem fecha é o ✕ —, porque achar o ritmo é um ajuste que se faz
  ouvindo. As pontas levam rótulo (`0,5×` e `2×`): um slider sem pontas nomeadas
  não diz para que lado é mais rápido. Oráculos: `cifra-rolagem` (a METADE 0),
  `cifra-tela-cheia` (o eixo trocado) e `fonte-so-do-par` (a gaveta não hospeda
  mais nenhum `.lv-fonte-btn` — o risco daquele arquivo saiu de cena com os
  botões).

  **A rolagem anda no tempo da MÚSICA** (`Auto`, o padrão), com o começo parado
  alguns segundos e o fim alcançado bem antes de a música acabar; sem relógio
  para seguir ela cai num ritmo fixo e diz isso no `title`. A posição é escrita
  em FRAÇÃO de pixel — inteira, ela anda 1 px a cada três quadros e o olho lê
  isso como tremor sobre o texto. **A quebra de linha
  da folha é do app, não do navegador**, e por isso `cifraColunas` mede a fonte
  RENDERIZADA. Os dois mecanismos estão no `CLAUDE.md`, com o que cada um recusa
  fazer; as regras puras (a janela da rolagem, a quebra do par) estão em
  `controle/cifra.js`, com oráculo.
- **O TAMANHO DA LETRA É DO OPERADOR** (v1.1.6): um par **A+ / A−** no cabeçalho
  desta folha **e** como dois FABs na zona de leitura do Modo Fácil — duas casas, um
  estado, o token `--lv-fonte`. *"Aproveite para criar dois botões de A+ e A− nestas seções
  de letras… sendo é claro o tamanho salvo na memória do app."* A escada é
  DISCRETA (`LV_TAMANHOS`, de `1rem` a `2.4rem`) e não um fator: dois toques em
  A+ chegam sempre no mesmo lugar, um percentual acumularia erro e produziria
  medidas que ninguém escolheu. Nos extremos o botão **desabilita** em vez de
  sumir — sumir mudaria a largura do cabeçalho a cada toque. O valor vai para
  `state.lyricsFont` e é relido no `load()`, ao lado de `fit` e `rotate`; a
  metade que falharia calada é essa, e ela tem oráculo próprio no
  `boot-nativo.test.mjs` (uma página NOVA, porque o que se afirma é a ABERTURA
  seguinte). O ouvinte é UM, delegado por classe: uma terceira casa entra sem
  tocar no JS.

  **NO MODO FÁCIL O PAR É DOIS FABs REDONDOS NO CANTO DA PLACA DA LETRA** (v1.11.15) —
  pedido do operador: *"dois botões FAB dentro da caixa do auxiliar de leitura, os
  dois no canto inferior direito, um acima do outro, em uma coluna. Sem molduras,
  apenas os botões"*. O `.lv-fonte-ctl.simple-fabs` é irmão da `.simple-lyrics`
  dentro de `.simple-song` (`position: relative`), `absolute` no canto, em coluna
  (A+ em cima, A− embaixo: a ordem do DOM é a da tela), com o recuo `--sp-5` nos
  dois eixos. **O GRUPO NÃO PINTA NADA** — cada botão é a sua superfície: redondo,
  `--thumb` (acima do piso `--hit`), `--surface-porta` + `--accent` (o par do azul de
  "ativado", 5,37:1 / 6,37:1) e a sombra das portas flutuantes do Cronograma.
  **A letra tem de poder rolar PARA CIMA deles:** `.simple-lyrics > :last-child`
  leva `margin-bottom` do tamanho da coluna — margem do último item e **nunca
  `padding` do scroller** (a tira de sombra das bordas pede o padding box). Saíram
  com a linha do nome (`.simple-np-linha`, v1.1.6) o `position: absolute` do par
  pendurado, o `min-height: var(--hit)` que reservava a altura dele (v1.5.19) e a
  folga de `--hit × 2` dos dois lados do nome: o nome é o `.simple-np` solto e a
  zona de leitura ganhou 16px. **A OUTRA CASA — o cabeçalho do `#lyricsPopup` —
  não mudou:** lá o `.lv-fonte-ctl` é `position: static`, conta para a altura do
  cabeçalho, e o respiro abaixo dele é o `padding-bottom` do cabeçalho.
  Oráculo: `modo-facil-fonte.test.mjs`. Adjacentes ditos: no estado PADRÃO do Modo
  Fácil (`sem-tela`, sem TV) os botões são **intocáveis** — o `#simpleVeil` cobre a
  zona e só o `.simple-head` é içado —, e na cena de APRESENTAÇÃO eles são
  **inertes** (a `.lv-grade` não lê `--lv-fonte`).
- **O PADRÃO É `1.4rem`** (contra `.95rem` até a v1.1.3). Pedido do operador: *"pode dobrar o tamanho da fonte nos campos de
  leitura de letra das músicas que estão sendo transmitidas; atual está muito
  pequeno e só sobrando espaço lateral na linha"*. Ele descreve a MEDIDA: a
  `.95rem` uma linha de hino de 35 caracteres cabia inteira numa tela de 412px
  com largura sobrando. A v1.1.4 dobrou (`1.9rem`) e a v1.1.5 recuou para
  `1.4rem` **depois de ver**: no dobro, TODA linha quebrava em duas, e num texto
  em que o fim da linha é parte do que se canta isso se nota. A `1.4rem` a maior
  parte ainda quebra, mas quatro estrofes cabem na folha onde antes cabiam duas.
  Os RÓTULOS (a capa, "Estrofe 2", o número do versículo) sobem menos: acompanhar
  a letra faria um metadado ficar maior que ela. É um token porque os dois
  consumidores da `.lv-row` — esta folha e a zona de letra do Modo Fácil — mudam
  juntos.
- **O RESPIRO ENTRE ESTROFES** (`--lv-estrofe-gap`, no `:root` de
  `controle.css` — é medida de layout, não cor) **vale nos TRÊS lugares em que
  uma estrofe termina**: o `gap` desta folha, o `gap` da zona de letra do Modo
  Fácil e o `margin-top` entre dois blocos DENTRO de um slide (a API às vezes
  empacota duas estrofes numa entrada só — v5.142). Uma fronteira de estrofe é
  uma fronteira de estrofe: parece igual nos três, senão a leitura ganha um ritmo
  que o texto não tem. Até a v5.225 os três divergiam e na direção ERRADA —
  8,8 px (avançado) e 8,0 px (simples) entre estrofes diferentes contra 11,4 px
  entre blocos da mesma, medido: duas estrofes ficavam mais juntas que o miolo de
  uma. A estrutura por baixo estava inteira desde a v5.42; o que a desmentia era
  o par de medidas.

  **O FATOR mudou na v1.1.5** (*"pode reduzir o espaço entre as estrofes"*). Ele
  era "uma linha em branco" — literalmente o que a fonte codifica (`<br><br>`),
  isto é, fonte × 1,5 —, e o argumento valia enquanto a letra media `.95rem`,
  onde a linha custava 1,4 rem. Com `1.4rem` de letra a mesma regra pediria
  2,1 rem e o custo deixa de ser tipográfico: numa tela de celular, três estrofes
  empurram a quarta para fora.

  **Continua DERIVADO da fonte** (`calc(var(--lv-fonte) * .86)`), e desde a
  v1.1.6 isso é obrigatório: com o operador ajustando a fonte, um respiro fixo
  valeria só no degrau em que foi escolhido — no maior empataria com a entrelinha
  e a fronteira sumiria, no menor sobraria branco. `.86` é a razão que a v1.1.5
  aprovou olhando (1,2 / 1,4) e dá ~1,7× a entrelinha em qualquer degrau.

  **O piso continua sendo o que sempre importou**, e é ele que `tools/smoke.mjs`
  trava: a fronteira acrescenta mais branco que a ENTRELINHA da própria estrofe
  (`line-height` − corpo da letra). Abaixo disso ela fica menos visível que uma
  quebra de linha comum, que é a v5.225 outra vez com outro número. A REGRA,
  nunca o pixel — escrever o valor faria o oráculo reprovar numa mudança de
  fonte.
- **É leitura, não operação.** Nenhuma linha projeta nada ao toque: o que vai
  ao telão continua saindo dos botões de estrofe/versículo (`stepSlide`) e da
  tela da Bíblia. Um popup de consulta que também projeta seria a pior hora
  possível para um toque errado.
- **Um BLOCO de texto, não uma pilha de cartões**: cada estrofe/versículo é um
  parágrafo — sem fundo, sem moldura e sem o padding que cada cartão cobrava.
  Numa tela de celular aquilo custava mais da metade da altura em enfeite, e a
  letra é justamente o que se quer ver de uma vez. O destaque do que está no ar
  virou uma **barra na margem + a cor de acento**; todas as linhas têm o mesmo
  `padding-left` (com a borda transparente nas demais), então o texto não se
  desloca quando a estrofe muda. Na Bíblia o número do versículo entra na linha
  do texto, como numa Bíblia impressa.
- **Acompanha sozinho, mas não disputa**: a linha no ar fica destacada
  (`.lv-row.current`) e a lista rola até centralizá-la — até o operador rolar
  com o dedo (`lvFollow`, desligado no primeiro `pointerdown`/`wheel`, religado
  ao reabrir ou ao trocar de fonte). Sem isso, ler adiante seria impossível:
  a estrofe seguinte puxaria a lista de volta no meio da leitura.
- **Sem timer próprio**: `refreshLyricsView()` é chamada de `renderSlideNav()`,
  que já roda a cada tick de tempo e a cada troca de versículo/mensagem. Com o
  popup fechado custa uma comparação de classe. Uma **assinatura** do conteúdo
  (`lvSignature`) decide entre re-renderizar (trocou a música, o capítulo ou a
  disponibilidade das fontes) e só mover o destaque — e ela inclui a lista de
  fontes DISPONÍVEIS, não só a ativa: começar a leitura bíblica com um louvor
  tocando não muda o que está na frente, mas passa a haver o que alternar.

#### A cifra em TELA CHEIA, deitada (v1.6.0)

Pedido do operador: *"gostaria que criasse um sistema para visualização das
cifras em tela cheia, no modo paisagem. deixe visível em uma coluna vertical na
direita, os botões de controle de tom, automático, tamanho da fonte e etc... e é
claro, ao abrir esse modo em tela cheia, pode já deixar automaticamente a fonte
já um pouco maior, já que uma visualização com a fonte maior é o objetivo desse
método em tela cheia"*.

Quem lê está com o instrumento na mão e o celular no suporte. MEDIDO: no retrato
de 430px a folha tem ~375px úteis a `1.4rem × .74` ≈ 16,6px monoespaçados —
**~37 colunas**, e quase toda linha de acorde quebrando ao meio. Deitada, com o
corpo dois degraus acima, ela passa dos **50**.

```
 ┌────────────────────────────────────────────────────────────┬──────┐
 │  [C]        [G]                                            │  ⛶   │  sair
 │  Ao Deus de Abraão louvai,                                 │  A−  │  corpo
 │       [Am]         [F]                                     │  A+  │
 │  que reina lá no céu,                                      │      │
 │  …                                                         │ Tom: │  o tom
 │                                                            │  C#  │
 │                                                            │  ⏸   │  rolar
 │                                                            │ Auto │  ritmo
 │                                                            │  −½  │  transpor
 │                                                            │  +½  │
 └────────────────────────────────────────────────────────────┴──────┘
   a caixa afundada de sempre, agora com a largura da paisagem      ~66px
```

**É UM LOTE SÓ DE BASE WEB.** A trava de paisagem já era element-agnóstica:
`MainActivity.ControleChromeClient.onShowCustomView` é o callback que o Chromium
invoca para QUALQUER elemento que peça `requestFullscreen` — não há teste de
`<video>` lá dentro —, e ele escreve `SCREEN_ORIENTATION_LANDSCAPE` e esconde as
barras. A prova está no próprio app desde a v1.0.7: a **preview** é um `<div>`, e
esse caminho é exercitado todo culto.

- **O ELEMENTO É O `#lyricsPopup` INTEIRO, e o ponto é o que NÃO acontece:
  nada é reparentado.** Mover o corpo para um contêiner novo zeraria o
  `scrollTop`, invalidaria a posição fracionária da rolagem
  (`cifraPos`/`cifraEscrito`, que existe justamente para a folha não tremer) e
  mataria as referências que `lvBuildCifra` guarda dos botões. Com o backdrop
  inteiro na top layer, só o layout muda — e é por isso que a folha continua
  rolando de onde estava.
- **GRID, não overlay — e o argumento da preview NÃO transfere.** A `.pv-fsctl`
  é absoluta, translúcida e se apaga em 4s porque o que está por baixo dela é a
  PROJEÇÃO e a projeção precisa da tela inteira. Aqui o que está por baixo é
  **texto que alguém está lendo enquanto toca**, e as três premissas se
  invertem: ninguém além do operador vê esta superfície (a cifra nunca vai ao
  telão, por contrato), os controles são usados DURANTE a leitura, e este app já
  decidiu isso uma vez — a `#lyricsViewBar` saiu de dentro da caixa que rola na
  v1.1.22 exatamente porque *"um controle que some é um controle que não existe
  no momento em que ele importa"*. Fazê-la sumir por relógio é reintroduzir
  aquele defeito por outra porta. Ela pode ficar porque **não custa texto**: uma
  faixa do grid não cobre nada, sem depender de opacidade nenhuma.
- **A LARGURA É TOKEN** (`--cifra-coluna`, `--hit + 2rem` = 66px), porque a
  trilha e o recuo de quem mora nela saem da mesma medida. O piso é o
  `.lv-cifra-vel`, o único botão que não é quadrado (`--hit + .9rem` = 48,4px,
  para o rótulo "Auto" não empurrar os vizinhos ao ciclar).
- **O QUE ENTRA NA COLUNA É O QUE A FOLHA JÁ TEM**, reposicionado — zero botão
  reimplementado (invariante 5 aplicada ao layout). Ficam de fora o TÍTULO
  (metadado que o operador acabou de escolher; o `Tom:` fica porque é o único
  texto que muda ao vivo), as ABAS (um segmentado de até quatro opções em 66px é
  ilegível, e o seletor volta com um toque no ⛶) e o ✕ — **uma superfície em
  tela cheia tem UMA saída**, e dois ✕ vizinhos com significados diferentes é o
  defeito. Transporte de mídia também não entra: quem lê a cifra não é quem
  opera a cena.
- **O BOTÃO MORA NO CABEÇALHO**, não na barra da cifra. O cabeçalho é ESTÁTICO —
  a barra é refeita a cada `renderLyricsView`, e um botão de estado guardado de
  lá vira um nó desligado da árvore (é o que `lvBuildCifra` documenta ao soltar
  `cifraRolarBtnEl`) —, tela cheia é um controle da FOLHA como o ✕ e o A+/A−, e
  na coluna ele é a PRIMEIRA linha: a saída no topo, onde o `#fsExit` da preview
  já mora. A ordem do DOM É a ordem da coluna, então não há um `order:` para
  manter em dia.
- **O DESENHO É SVG INLINE, e alterna por `innerHTML`.** A fonte de ícones é um
  subset de 31 codepoints e não tem glifo de tela cheia — um `.msym` fora dela
  não desenha NADA, sem erro (`tools/glifos.test.mjs`). E um `<symbol>` com os
  dois desenhos dentro carregaria, não erraria e desenharia **os dois
  empilhados para sempre**: a folha do documento não atravessa a árvore-sombra
  de um `<use>`.
- **A CLASSE NÃO É `.lv-fonte-btn`, e isso não é gosto.** O ouvinte daquela
  classe é DELEGADO no documento e lê "não é `.lv-fonte-mais`" como DIMINUIR: um
  ⛶ com a classe do par abriria a tela cheia encolhendo a letra. `.lv-cheia-btn`
  entra nas três listas compartilhadas (o esqueleto só-de-ícone, o `--press` e a
  escala do SVG) e ganha só o que difere.

##### A fonte maior é uma SEGUNDA ESCADA, não um deslocamento

`--lv-fonte` é global (mora no `<html>`) e as DUAS casas do A+/A− o leem —
engordá-lo ali levaria junto a zona de letra do Modo Fácil e obrigaria a desfazer
na saída. Aqui ele é **escopado no `#lyricsPopup`** (custom property herda, e
`.lv-cifra-folha` resolve `calc(var(--lv-fonte) * .74)` por ele): sair é
`removeProperty`, e **o tamanho normal volta porque nunca foi embora**. Um offset
somado ao índice global teria de ser subtraído na saída, e não sobreviveria a um
ajuste feito DENTRO da tela cheia nem ao teto da escada.

- **A escada é a mesma** (`LV_TAMANHOS`); o que é novo é um segundo índice
  (`cifraCheiaIdx`), persistido em `cifraFonteCheia` e adotado por função
  *hoisted* (`cifraAdotarFonteCheia`, irmã do `cifraAdotarVelocidade`, pela mesma
  razão: o `load()` que hidrata roda muito antes na leitura).
- **A SEMENTE é `+2 degraus`** a partir do corpo do retrato, na primeira entrada
  de sempre. `Math.min` clampa, então entrar já no topo é no-op silencioso.
- **O PREÇO, DITO:** mudar o corpo no retrato depois disso NÃO arrasta o da tela
  cheia. Está certo — são duas perguntas, *"ler o celular na mão"* e *"ler de
  longe com o instrumento"* — e está escrito para ninguém "consertar".
- **O ESTADO DESABILITADO tem de trocar de escada junto**, e é o modo de falhar
  mais mudo do par: `aplicarTamanhoDaLetra` desabilita o A+/A− por CLASSE, nas
  duas casas de uma vez, a partir de UM índice. Lendo `lvTamanho` com a escada da
  tela cheia no ar, quem batesse no teto sairia com o A+ desabilitado **no
  retrato**, e ele simplesmente pararia de responder.
- **`--lv-estrofe-gap` NÃO segue o escopado**: ele é `calc(var(--lv-fonte) * .86)`
  declarado no `:root`, e a substituição acontece em quem DECLARA. É inócuo para
  a cifra (que espaça em `em`); no dia em que a tela cheia valer para a aba de
  LETRA, ele tem de ser redeclarado junto.

##### A remedição: três camadas, e a largura chega DEPOIS do corpo

`cifraColunas` mede a folha renderizada, e a entrada em tela cheia muda **a
largura e o corpo em instantes diferentes**:

| t | o quê |
|---|---|
| t1 | `requestFullscreen` resolve — o elemento vai para a top layer, ainda em RETRATO |
| t2 | o `--lv-fonte` escopado é escrito (JS) |
| t3 | o shell roda: `onShowCustomView` → `SCREEN_ORIENTATION_LANDSCAPE` |
| t4 | a Activity gira e o WebView é redimensionado → `resize` |

**Não há promise para esperar t4** — o `screen.orientation.lock` do
`enterFullscreen` da preview é decorativo num WebView, e quem gira é a Activity.
Daí as três camadas: o `fullscreenchange` (cobre t1+t2, determinístico na entrada
E na saída), os `resize`/`orientationchange` que já existiam (cobrem t4) e um
`ResizeObserver` no corpo — o único que pergunta exatamente o que `cifraColunas`
mede, em vez de inferir da janela.

- **A GUARDA É POR CONTAGEM DE COLUNAS, nunca por largura.** Ela pergunta *"a
  folha que está aí foi quebrada para a largura que ela tem AGORA?"* —
  `cifraColunasAtual` é escrito em `cifraDesenharFolha`, isto é, o que a folha em
  cena de fato usou. Isso torna cada `resize` da rajada da rotação praticamente
  grátis, **fecha o laço de realimentação do `ResizeObserver`** (reconstruir muda
  o `scrollHeight`, a barra de rolagem aparece ou some, o `clientWidth` muda, o
  observador dispara de novo) e continua deixando passar o A+/A−, onde a largura
  é a MESMA e o avanço por caractere não é. Escrita por largura, aquele caminho
  seria apagado em silêncio.
- **A POSIÇÃO DE LEITURA SOBREVIVE, em fração do CONTEÚDO.** `renderLyricsView`
  esvazia e reconstrói o corpo: o `scrollTop` volta a zero, e no quadro seguinte
  `cifraRolarQuadro` conclui — com toda a razão, é a linha que atende o *"vale
  tanto para volta como para avanços"* — que outro mexeu na folha, adotando o
  topo. A folha voltava ao começo no meio da música (o defeito já existia no
  caminho do A+/A−; a tela cheia o tornava certo e caro).
  - **`scrollTop / scrollHeight`, e não `/ (scrollHeight − clientHeight)`.**
    MEDIDO: a segunda muda sozinha quando só a ALTURA da caixa muda — que é o que
    a rotação faz sem tocar no texto —, e o que saía era a folha andando **19% do
    arquivo** ao deitar.
  - **E ela é CAPTURADA PELO CHAMADOR na transição** (`cifraRemedir(fracao)`):
    trocar a fonte muda o comprimento da folha na hora, e a remedição só roda no
    quadro seguinte — lida lá, a fração já descreveria o estado novo.
  - **A volta é por `cifraAplicarPos`**, nunca por escrita crua: é ela que
    atualiza `cifraEscrito`, a régua que distingue a nossa escrita de um arrasto
    do dedo.
  - Por isso os ouvintes passam a chamar `() => cifraRemedir()`: um `Event` de
    `resize`, ou o carimbo de tempo do `requestAnimationFrame`, chegaria no lugar
    da fração. O `typeof` de dentro é a segunda guarda.

##### As saídas, e por que o voltar é o degrau 1.5

São três, e as três passam pelo mesmo lugar: o próprio ⛶, o **voltar do
aparelho** e **fechar a folha por qualquer porta** (`closeLyricsPopup`, que é o
ponto único do ✕, do toque no fundo, do degrau 2 do voltar e do
`sairDasCamadas()` de um compartilhamento — este último só sai da tela cheia
`if (displayActive())`, e sozinho deixaria a folha invisível com a Activity ainda
deitada). Some-se a saída automática: **a tela cheia cai sozinha quando a cifra
deixa de ser a fonte**, senão o layout desenhado para ela passaria a mostrar a
letra com as abas escondidas e sem o ⛶, que só é desenhado na cifra.

**O degrau é o 1.5, entre o diálogo modal e os bottom-sheets.** A ordem daquela
fila é do mais efêmero ao mais permanente, e a tela cheia da cifra é um MODO da
folha: foi aberta depois dela, e é desfeita antes. Deixá-la no degrau 3 é o
defeito concreto — o degrau 2 fecharia a folha com ela AINDA em tela cheia, e
tirar `.open` só muda opacidade e `pointer-events`: o elemento continua na top
layer e a Activity continua deitada. E o degrau 3 fala de outra coisa: lá a tela
cheia é a PREVIEW, que sem TV É a projeção. No mesmo lote ele deixou de ler
`document.fullscreenElement` cru e passou a **nomear o `previewEl`** — com dois
donos possíveis, um teste genérico é a armadilha esperando o terceiro.

**QUEM MANDA É O EVENTO, nunca o toque:** F11, Esc e o `exitFullscreen` do voltar
chegam todos pelo `fullscreenchange`, e é lá que a escada de fonte entra e sai.
Pendurar isso no clique deixaria as outras saídas com a fonte grande de pé.

**UMA TELA CHEIA POR VEZ:** o `onShowCustomView` do shell recusa a segunda
(`if (customView != null)`), e o Chromium não sabe disso — o estado do navegador
divergiria do da Activity. A guarda mora no `cifraCheiaAlternar`, onde é barata.

**Oráculo: `tools/cifra-tela-cheia.test.mjs`.** Ele mede o RENDERIZADO (a coluna
começando onde a folha acaba, o hit-test, o corpo da fonte, as colunas, o x de um
caractere por `Range`) e monta o cenário como ele chega no aparelho: tela cheia
por clique de verdade, e a rotação como um `setViewportSize` DEPOIS dela.

#### A divisão das estrofes dentro de um slide (v5.142)

Um slide da API pode trazer **mais de uma estrofe**, separadas por uma linha em
branco (`<br><br>` na origem, que `normalizeLyricText` converte em `\n\n`). O
visualizador desenhava o slide inteiro num nó só com `white-space: pre-line` — e
é aí que a divisão se perdia: **`pre-line` colapsa sequências de espaço em
branco**, então `\n\n` vira uma quebra simples e as duas estrofes encostam como
se fossem um bloco só. Era o relato "alguns hinos não estão dividindo, mesmo na
realidade tendo divisões".

`lvBuildSong` divide o texto em blocos e cria um `.lv-text` por bloco. **A LINHA
continua sendo UMA** (o mesmo `data-i`, o mesmo destaque, a mesma posição no
tempo): o que se divide é a apresentação do texto, não a unidade de projeção —
dividir a unidade quebraria o realce da estrofe em cena e o ⏮/⏭. Vale para os
dois lugares que desenham letra, porque os dois chamam a mesma função (o popup de
leitura e o painel do modo simplificado).

