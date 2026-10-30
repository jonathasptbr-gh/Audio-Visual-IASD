<!-- Parte do capítulo do Controle (o índice das partes está em CONTROLE.md;
     o mapa geral, em docs/ARQUITETURA-WEB.md). Partida do CONTROLE.md na
     revisão A3 (2026-10-30): o texto foi MOVIDO verbatim. -->

## Controle — os modos de uso (Modo Fácil × avançado)

> Parte do capítulo do Controle — o índice das partes e as regras que valem
> para o Controle inteiro estão em [`CONTROLE.md`](CONTROLE.md).

**Nesta parte:** [Modos de uso: "Modo Fácil" (padrão) × avançado](#modos-de-uso-modo-fácil-padrão--avançado) · [O vídeo do Modo Fácil em tela cheia, e a barra de volume da tela cheia](#o-vídeo-do-modo-fácil-em-tela-cheia-e-a-barra-de-volume-da-tela-cheia-v11224) · [A Biblioteca do Modo Fácil é maior](#a-biblioteca-do-modo-fácil-é-maior-v1139) · [A troca leitura ↔ Biblioteca no Modo Fácil anima](#a-troca-leitura--biblioteca-no-modo-fácil-anima-v11212) · [O card do nome no Modo Fácil tem UMA altura](#o-card-do-nome-no-modo-fácil-tem-uma-altura-v11211)


### Modos de uso: "Modo Fácil" (padrão) × avançado

> **O nome na TELA é "Modo Fácil"**; no CÓDIGO o modo continua sendo `'simple'`
> (a classe `mode-simple`, o `appMode`, o `data-mode`) — trocar a string interna
> não mudaria um pixel e esbarraria em dezenas de referências. É a mesma razão
> pela qual as Ferramentas seguem com `renderDiversos`/`refreshDiversos` e com os
> ids de `miscTool`, mesmo depois de deixarem de ser uma aba (v1.3.10).

O app atende duas pessoas: uma abre o celular para **conectar a tela e tocar um
louvor**; a outra opera o culto inteiro. A tela que serve bem à segunda é
excessiva para a primeira, e esconder recursos atrás de uma configuração só
empurraria a escolha para um lugar onde ninguém procura.

**O app SEMPRE abre no simplificado** — nunca por um seletor na abertura, que
cobraria um toque de todo mundo, inclusive de quem nem sabe que há dois modos,
antes de mostrar qualquer coisa útil. A
classe `mode-simple` **já vem no `<body>` do HTML** (e `.open` no `#simpleMode`),
então a tela certa aparece sem esperar JS ou IndexedDB.

**A troca mora em Configurações, nos DOIS modos** (segmento "Modo do app",
`#appModeSeg`) — e vale pela SESSÃO (ver a subseção abaixo). Os botões de
cabeçalho que faziam o mesmo saíram: eram dois controles para uma decisão só, e
o do avançado ocupava a esquerda de uma faixa com largura de celular (e
empurrava o título 63px para fora do centro, medido). No Modo Fácil o cabeçalho
ficou com uma **engrenagem** (`#simpleSettingsBtn`). Desde a v1.2.0 a gêmea do
avançado mora no MESMO canto (ver "Layout geral"), e as duas dividem a regra de
CSS: mesma caixa, mesma cor `--accent` — trocar de modo não pode trocar o canto
em que a mesma porta se abre.

> **A ORDEM DAS DUAS REMOÇÕES NÃO FOI ACIDENTE:** o botão do Modo Fácil não podia
> sair antes de existir a engrenagem, porque este modo esconde a `.bottombar`
> inteira — tirar os dois de uma vez teria TRANCADO o operador aqui. Primeiro se
> cria o caminho, depois se remove o atalho.

#### O Modo Fácil sem prévia: a barra sempre à vista, a Biblioteca ou a leitura como tela (v1.11.11–v1.11.12)

Pedidos do operador: *"para um usuário simples, a própria tela conectada já será
o visor"* (v1.11.11) · *"mantenha a barra de buscas da biblioteca sempre visível
… o foco na caixa de buscas muda a tela principal do auxiliar de leitura para a
biblioteca"* (v1.11.12). A tela do Modo Fácil é, de cima para baixo: cabeçalho
(ícone de cast `#simpleCastBtn` à esquerda, marca no centro, engrenagem à direita — v1.11.15) · **espaço
da barra** (`#simpleBarra`) · **zona de leitura** (`.simple-song`) · cartão de
"Baixando…" (`#simpleBusySlot`, só com `.on`) · teclas (Parar · Play/Pausa · Nível, v1.13.8 —
recolhidas sem nada no ar).

- **É a MESMA janela `#hymnSearchPopup`** (fixa, `z-index: 190`), pousada sobre o
  espaço da barra, e não há nó novo nem segunda implementação da busca. O espaço só
  RESERVA a altura da barra (`--lib-bar-h`, lida do layout por
  `medirBarraDaBiblioteca`).
- **Três estados com tela conectada (`body.simples-barra`), escolhidos por
  `simplesBibliotecaDocada()`** = Modo Fácil + com tela + `!haOQueParar()` — a MESMA
  pergunta do Parar (`midiaNoAr || cenaDeRoteiroNoAr()`), nunca `cenaNoAr()`:
  - **PRINCIPAL** (`simples-principal`, sem mídia no ar): aberta, a camada cobre
    espaço + leitura; a leitura fica `visibility: hidden` por baixo
    (`.simple.corpo-biblioteca`). Sem ✕, aberta SEM foco, o `__avBack` a pula, e
    `closeHymnSearch` REINICIA em vez de fechar (quem fecha o acervo na pressa do
    toque o faz antes de a mídia existir; fechar de verdade deixaria o corpo vazio
    durante o download, e para sempre se ele falhasse).
  - **FECHADA** (com mídia no ar): a camada tem a altura da barra e pousa sobre o
    espaço; o resto da janela é recortado (`overflow: hidden`). O campo é o
    GATILHO: o `focus` já chamava `openHymnSearch(true)`.
  - **ABERTA SOBRE A LEITURA**: a camada cresce da barra até a base da zona de
    leitura; o ✕ (`.lib-toggle`, só aqui) e o voltar do Android a fecham.
- **Só o `bottom` da camada anima** (`transition: bottom var(--lib-anim)`), com as
  medidas `--simple-barra-topo`/`--simple-corpo-esq|dir|base` LIDAS por
  `medirCorpoSimples` (nunca escritas no CSS) e re-lidas por `ResizeObserver`
  (zona, espaço e cabeçalho) e `resize`; uma medida nova NÃO anima
  (`semAnimarAJanela`). O teclado manda no `bottom` quando é maior que a base
  (`max`). **A armadilha de especificidade:** `body.mode-simple …:not(.open)
  .popup-sheet--lib` desce a janela fechada para fora da tela e tem a mesma
  especificidade da regra nova, vindo depois — por isso a regra do estado fechado
  leva `.mode-simple` na conta.
- **A FOLHA É UM CARD NOS TRÊS ESTADOS (v1.12.56)** — relato: *"a barra de buscas
  e sorteio tem uma moldura da biblioteca que só aparece quando a biblioteca está
  aberta … para que ele fique visível, assim esse card não vai aparecer e
  desaparecer, mas sim expandir e encolher"*. No AVANÇADO a folha fechada não
  pinta (a barra é uma linha da caixa de controles) e o fundo e o raio andam com
  atraso no fechamento (v1.12.21); com `body.simples-barra` a regra
  `body.mode-simple.simples-barra .popup-backdrop--lib .popup-sheet--lib` pinta
  `--panel` + `--radius-card` (os do `.simple-nowplaying`) SEMPRE, e a transição
  dela fica só com o `transform`. Fechada, o card tem a altura da barra e as bordas
  laterais dos outros cards; abrir e fechar são o `bottom` da camada, e o fundo
  nunca cai a transparente no caminho (`modo-simples-corpo`, R3 e U1/U2 nos dois
  temas; G3c trava o avançado).
- **`renderSimpleCorpo` roda em três pulsos:** `renderSimpleGate` (tela entrou ou
  saiu, troca de modo), `renderTransporteHabilitado` (cena mudou — e também a CADA
  `display-status`, ~4 Hz com TV) e `setAppMode`. **Só REMEDE quando a FORMA muda**
  (`corpoSimplesForma` = barra · principal · com-mídia, v1.12.30): o resto da
  geometria tem vigia próprio (`ResizeObserver` da leitura/barra/cabeçalho,
  `resize`, `visualViewport`, `focusout`). Medida nova que dependa de outra coisa
  ganha o vigia dela, nunca o pulso. E a tampa das coleções (`#hymnResults`) não
  mede com a janela andando: adia até o `transitionend` dela.
- **A ESCOLHA DE UMA MÚSICA É UMA COREOGRAFIA (v1.11.12)** — relato: *"a tela muda
  rápido demais, sem nem sequer o feedback tátil … a tela está simplesmente
  piscando"*. Três tempos: (1) `simpleSelecionarLinha` (no toque da linha, na
  Biblioteca e nos resultados do YouTube) marca a linha — `.selecionando`:
  `--sel-fill` e o recuo do toque, que FICAM — por `SIMPLE_FEEDBACK_MS`; o
  `closeHymnSearch` que `playSongVariant` e vizinhos chamam no instante do toque
  não fecha nada com uma escolha fresca (`simpleAguardarSaida`), e o
  `renderSimpleCorpo` espera o mesmo prazo antes de trocar a tela quando a mídia
  entra no ar depressa; (2) `simpleSairDaBiblioteca` recolhe a camada para a barra;
  (3) a leitura ENTRA (`.simple-song.entrando`: 14 px para cima com fade, com
  atraso). Só depois o campo é limpo e o acervo volta ao padrão
  (`closeHymnSearch({ calma: true })` adia a limpeza por `SIMPLE_SAIDA_MS`). Se a
  escolha não vira mídia, um vigia de 1 s desfaz a marca e REINICIA a Biblioteca
  (cartão de espera cancelado, falha). **O vigia sempre termina** (v1.12.30):
  passados 4 s sem cartão de espera ele desfaz a marca e para, e só reinicia sem
  leitura no ar, sem foco no campo e com o campo vazio ou ainda no TERMO da
  escolha (`simpleSel.termo`) — o que o operador digitou depois é dele. Trocar de
  modo encerra a escolha (`setAppMode` → `simpleLimparSelecao`), e os timers do fim
  (`simpleEntradaTimer`, `simpleMarcaTimer`) são cancelados por uma escolha nova. A marca sobrevive aos redesenhos do acervo
  (`simpleLinhaSelecionada`, por chave da música ou `yt:<id>`) — um download longo
  refaz a lista muitas vezes. **O estado mora no TOPO do arquivo:** `let` depois do
  `closeHymnSearch` seria zona morta, porque ele roda na carga via
  `renderSimpleGate`. Fora do alcance, dito: as escolhas que não passam por uma
  linha do acervo (o sorteio, a folha de destinos) fecham na hora, como antes.
- **A CAIXA DA BIBLIOTECA É MEDIDA PELO LAYOUT, E CONFERIDA (v1.11.13)** — relato:
  *"quando dou stop … a biblioteca volta … encolhida verticalmente … espaço sobrando
  abaixo. Ao interagir na biblioteca, ela se atualiza"*. A camada aberta termina em
  `bottom: max(--simple-corpo-base, --kb)`; um dos dois fora do lugar é o defeito, e a
  interação do operador (teclado, `resize`) é uma REMEDIÇÃO — por isso ela conserta.
  O que está certo hoje: `medirCorpoSimples` lê `offsetTop`/`offsetHeight` (layout) contra
  `simpleModeEl.clientHeight`, nunca `getBoundingClientRect`/`innerHeight` — **a
  `transform` da entrada da leitura (`translateY(14px)`) movia a base 14 px e o
  `ResizeObserver` não vê transformação**; compara com o que está ESCRITO na raiz, não
  com um cache; toda entrada de estado agenda uma segunda leitura (`medirCorpoSimplesDepois`,
  dois quadros) e `resize`/`visualViewport.resize`/`focusout` também; na volta da tela
  principal o `--kb` é reconferido (`aplicarTeclado`, o `apply` do `keyboardShift`). E
  `conferirCaixaDaBiblioteca` escreve UMA linha no Registro com os números quando a camada
  aberta não termina onde devia (±2 px, só quando a discordância muda). **Reproduzido em
  mesa foi o lado "mais ALTA" (14 px); o "mais CURTA" do relato não foi** — se ele voltar,
  a linha do Registro diz qual conta discorda. Estado novo (`corpoSimplesRaf`,
  `aplicarTeclado`) mora no TOPO do arquivo, pelo mesmo motivo do `simpleSel`.
- **DURANTE UMA BUSCA AS TECLAS SAEM, E O ENTER FECHA O TECLADO (v1.12.51)** — pedido: *"Ocultar
  os botões de play, stop, e volumes no modo simples, durante uma busca … aceite o
  enter/pesquisar do teclado para fechar o teclado … a seção de resultados não tem mais de 20%
  de tela disponível"*. **A causa dos 20%:** onde a viewport de LAYOUT encolhe com o teclado (o
  hint `resizes-content` honrado, o `adjustResize`), `--kb` dá zero, o `.simple` (fixo,
  `inset: 0`) encolhe junto e as teclas, o volume e o card do nome ficam no fim dele, logo
  acima do teclado; a janela termina na base da zona de leitura, que é o que SOBRA. MEDIDO com
  teclado de 55%: 3 a 13% da área visível para a lista (10 px a 360×640), e 3 a 35% com 40%.
  Onde só a viewport VISUAL encolhe (`--kb` > 0) a lista já ia ao teclado, salvo quando o card e
  as teclas somavam mais que ele (320×568 a 1,3×: 51%). **A regra** (`simplesBuscando`):
  `simplesComBarra()` + janela ABERTA + (campo com FOCO, ou com TEXTO e nenhuma escolha
  ASSENTADA — passados `SIMPLE_FEEDBACK_MS` do toque numa linha, o texto deixa de contar; o foco
  conta sempre). Com ela `.simple.buscando` tira `.simple-remote` (parar, play, nível,
  páginas) e `.simple-nowplaying` do layout (`display: none`, é o espaço que se quer); a zona de
  leitura (`flex: 1`) cresce até o cartão de "Baixando…", que FICA (é a única porta de cancelar
  um download), e a janela acompanha porque a base dela é a da zona — medida com
  `troca: true`, para ANIMAR até lá (`renderBuscaSimples`). A volta tem um fade de opacidade
  (`.teclas-voltando`, 0,26 s, nada se move; nenhum com `prefers-reduced-motion`). A escolha
  NÃO devolve as teclas no toque (apareceriam sob o dedo); devolve quando o feedback assenta
  (timer em `simpleSelecionarLinha`), e o download não as segura de fora. **O Enter**
  (`confirmarBusca`, por DOIS caminhos: o `keydown` de Enter e o `submit` do formulário vazio
  `#hymnBuscaForm`, a que o campo pertence por `form=` — vários IMEs do Android mandam a tecla de
  ação como 229 "Unidentified", e a submissão implícita sai mesmo assim): redesenha os
  resultados já, sem o debounce, e tira o foco — o teclado desce, o texto mantém a busca e a lista ganha a tela; o campo
  declara `enterkeyhint="search"` e `inputmode="search"`. Vale nos DOIS modos; no avançado nada
  é escondido (a caixa de controles volta, porque só sai com o teclado no ar). Depois: 50 a 76%
  da área visível nos mesmos casos — o resto é o cabeçalho do app e a barra, que ficam (tirar o
  cabeçalho moveria o campo sob o dedo no toque). Oráculo: `modo-simples-busca`.
- **O que a prévia levava, e onde está:** o cartão `#pvBusy` (única porta de
  CANCELAR um download no Modo Fácil) é o MESMO nó, movido por `hostPreview` para
  `#simpleBusySlot` — e de volta à casa de origem (`pvBusyOrigem`) no avançado; o
  ícone de cast é o `#simpleCastBtn` (espelha classe e `title` do `#pvCastBtn`
  em `renderCastBtn`, e chama o mesmo `abrirCast`).
- **Aceito:** o selo de camadas não existe no Modo Fácil (o Parar encerra tudo).
- **Séries:** no Modo Fácil Provai e Vede e Informativo Mundial NÃO são coleção
  (v1.13.15): a raiz da Biblioteca abre com UM bloco, "Este sábado" e a data
  (`blocoSemanasRaiz`, `.semana-raiz.bloco-fixo`), com uma linha por série — o item
  virtual "vídeo da semana" — que TOCA no toque (sem gaveta de destinos). Ele tem a
  altura do conteúdo e fica fora da repartição da tampa (`calcularTampa` desconta o
  `bloco-fixo` da sobra e da média, como os Favoritos abertos). Ver
  `docs/recursos/SERIES.md`.

Oráculo: `modo-simples-corpo.test.mjs`.

#### O modo vale pela SESSÃO, e toda abertura nasce no Modo Fácil

Pedido do operador (v1.11.7): *"sempre iniciar o app no modo simples"*.

- **Fica em `sessionStorage`** (`av.appMode`), e não no IndexedDB como TODO o
  resto do estado. O motivo é decisivo: esta chave precisa ser lida **antes do
  primeiro quadro**. Uma leitura do IDB é assíncrona — ela volta depois de o app
  já ter pintado o simplificado, e quem estivesse no avançado veria a tela errada
  trocar embaixo do dedo. `sessionStorage` é síncrono e MORRE COM O APP: abrir o
  app de novo é sempre o Modo Fácil. A chave de mesmo nome que as versões
  anteriores gravaram em `localStorage` fica órfã e **nunca é lida**.
- **O que ele atravessa é a RECARGA DO DOCUMENTO dentro do mesmo WebView**: a
  atualização aceita em "Atualizar agora" (`applyWebUpdate` recarrega o MESMO
  WebView) e o `location.reload()` da importação. Quem opera o culto no avançado
  não cai no Modo Fácil por uma atualização. O que ele NÃO atravessa: o app
  aberto de novo e a remontagem do WebView depois que o renderer morre — ali o
  Modo Fácil volta, e sem TV a cortina de "sem tela" volta junto.
- **Consequências que o pedido traz e que ficam ditas:** um compartilhamento
  recebido com o app FECHADO (o `ACTION_SEND` por partida a frio) cai sempre no
  ramo do simplificado — o link do YouTube vira "tocar agora" sem a pergunta e os
  arquivos vão para `avulsos` e são projetados; e um app que ficou em memória
  (o processo não morreu) volta como estava, porque isso é retomar, não abrir.
- **UMA fonte, não duas.** Gravar nos dois lugares "por garantia" só cria o dia
  em que eles discordam e ninguém sabe qual vale.
- **A restauração é em duas metades.** No TOPO do `controle.js` vai só a pintura
  (a classe do `<body>` e o `.open` do `#simpleMode`), que é a parte que não pode
  esperar; o resto (`setAppMode(appMode)`) roda no `init()`, **depois do
  `load()`**.
- **ARMADILHA:** um `setAppMode('simple')` literal no fim do módulo (que existia
  "para fechar o ciclo com o HTML") reescreve a chave da sessão em toda carga, e
  uma recarga no avançado cairia no Modo Fácil — invisível no diff, porque a tela
  ainda pinta certo até aquela linha rodar. É por isso que ela passa `appMode`.
- **`sessionStorage` pode LANÇAR** (armazenamento bloqueado): leitura e escrita
  em `try`, e o padrão do app já é a resposta certa no `catch`.
- **Oráculos:** quem mede uma tela do avançado DECLARA que parte dele
  (`comModoAvancado`, no arnês, irmão do `comTema`) — o app não abre mais nele. O
  contrato em si (chave legada ignorada, gravação só na sessão, recarga
  atravessa, app novo nasce simples) é o bloco D de
  `abertura-e-transferencia.test.mjs`.

**O simplificado NÃO é uma segunda implementação.** A tela avançada continua no
DOM, só oculta (`body.mode-simple`), e os controles daqui **acionam os botões
reais por `.click()`** — o padrão da notificação nativa. Um botão `disabled`
continua sendo no-op natural, e nenhuma regra de borda passa a existir em dois
lugares. Na mesma linha, `renderSimple()` **copia o glifo e as classes** dos
botões reais em vez de recalcular play/pause e mudo. O do mudo subiu para cima
da preview na v1.3.5 e deixou de ter glifo (virou SVG): o que se copia dele
agora é a classe `.alternado`, que é a MESMA chave que lá troca o desenho — o
espelho continua LENDO o controle de verdade, e não relendo `muted`.

**A tela é um CONTROLE REMOTO**: teclas grandes (`.simple-key`), nada de
arrastar — quem usa este modo está de pé, com o celular numa mão só. E **sem
contorno**: numa tela em que TUDO é tecla um filete não distingue nada, só
devolve a grade de molduras. Quem diz "isto é tocável" é o fundo mais claro que o
do app e o `:active` que afunda.

| Elemento | O que faz |
|---|---|
| **Seção de conexão** (`#simpleConn`) | as duas formas de conectar — espelhar para a TV e transmitir para navegador, **dois botões irmãos** (ligada, a segunda perde o preenchimento, fica no vermelho contornado e nomeia o desligamento). Ligar e desligar ANIMAM: a folha cresce primeiro e o endereço entra depois (`grid-template-rows: 0fr → 1fr` no `#castLive`, com os atrasos invertidos no fechamento), e a lista de telas é um DIFF por rótulo — refeita por inteiro, ela recomeçaria a animação a cada leitura de 2,5 s e recriaria o botão "Desconectar" debaixo do dedo. Só SEM tela conectada, e ali é a ÚNICA coisa legível: a faixa de ações é içada para o centro da tela, por cima da cortina. É o MESMO nó da folha de "Conectar uma tela" (`#castConn`), movido por `hostCastConn` |
| **Corpo** (`.simple-song` ou a Biblioteca encaixada) | **UM dos dois** (v1.11.11): sem mídia no ar a BIBLIOTECA com a barra de busca no topo; com mídia no ar a LEITURA (um CARD com o nome e a linha do tempo — `.simple-nowplaying`, v1.11.16 — e a placa da letra). Quem escolhe é `simplesBibliotecaDocada()` — ver "O Modo Fácil sem prévia". **Não há prévia nem "Buscar música"**: a tela conectada é o visor |
| **Cartão de download** (`#simpleBusySlot`) | o `#pvBusy` movido para cá no Modo Fácil — a única porta de cancelar um download; vazio, não ocupa lugar |
| **Linha do tempo** (`#simpleTime`) | decorrido · barra · duração, espelhando a `#seek` do avançado; some quando o item não tem duração. **Interativa**: tocar salta, arrastar procura — voltar o refrão é a coisa mais comum num louvor, e mandar o operador SAIR do modo para isso é o oposto do que o modo dá. O alvo é a FAIXA (`.simple-time-hit`), não o traço de 4px. O comando sai no `pointerup` (um `seek` por quadro engasgaria a mídia) e `simpleSeeking` impede o `timeupdate` de puxar o preenchimento debaixo do dedo |
| **Letra** (`#simpleLyrics`) | a letra INTEIRA da música em cena, com o mesmo destaque da leitura auxiliar do avançado |
| **Parar · Play/Pausa · Nível** (v1.13.8) | `.click()` em `#stop` / `#playpause` / `#muteToggle`. O parar é a outra metade do transporte — sem ele, tirar a mídia do telão obrigava a ir ao avançado, que é o que se faz no fim de cada louvor. O NÍVEL é o número do volume e o toque MUTA — ver "As três teclas e a linha que recolhe" |
| **Configurações** (`#simpleSettingsBtn`) | `openFadePopup()` — e é de lá que se troca de modo |

**Sem escolha de variante.** O toque na linha da busca chama `simplePlaySong()`,
que toca o Cantado e pronto: abrir a lista com cantada/playback/letra seria
devolver ao operador a decisão que este modo existe para poupar.

**A pergunta do download aparece UMA vez.** `ensureDownloadConsent()` pergunta
antes de gastar internet e grava a resposta em `state.downloadOk` — repetir a
pergunta a cada música viraria ruído no meio do culto. A verificação usa
`songVariantsNeeded()`, a mesma regra da sincronização em massa (não basta ter
`fileIdFull`: o arquivo pode ter sido apagado por fora).

**Não há volume na tela do Modo Fácil (v1.13.8).** O − e o + saíram a pedido do
operador; o ajuste fino neste modo são as TECLAS FÍSICAS do aparelho, na grade
de `volumeProximo` (abaixo), e o número aparece na tecla de NÍVEL.

**A GRADE TEM DOIS TRECHOS** (v1.8.90): de 5 em 5 acima de 10, de 1 em 1 abaixo
— o volume não é linear no ouvido, e de 95 para 100 quase não se nota enquanto
de 5 para 10 é o dobro da pressão. Três coisas que se erram: a fronteira é do
lado de quem SOBE (9 → 10 fino, 10 → 15 grosso; escrita com `<` nos dois
sentidos, o trecho fino só existiria na subida); o alvo é ALINHADO À GRADE e
nunca `atual ± passo`, porque o fader é arrastável e de 12 um passo para baixo
daria 7, pulando o 10; e o resultado é a MESMA escada nos dois sentidos.
Oráculo: `controles-layout.test.mjs`, bloco 7 — ele afirma a sequência
COMPLETA, porque um passo medido de um valor só aprova quase qualquer
implementação.

**A zona de leitura reusa o renderizador da leitura auxiliar**: `lvBuildSong()`,
`lvBuildDeck()` e `lvMarkCurrent()` recebem o CONTAINER como parâmetro, e
`refreshSimpleLyrics()` entra no mesmo pulso de `renderSlideNav()`, sem timer
próprio. Rolar com o dedo desliga o acompanhamento até a próxima cena, como no
popup.

#### A zona vira a coluna de PÁGINAS, e aqui ela também CONTROLA (v1.4.30)

Pedido do operador: *"verifique o modo simples e seu auxiliar de leitura. Ele
deve adquirir as funções para controle de slides também"*.

**MEDIDO antes de mexer:** com uma apresentação em cena este modo não a operava
**de jeito nenhum**. A zona dizia *"A letra da música aparece aqui."* — a
projeção no ar negada pela única superfície do modo que deveria descrevê-la — e
as teclas eram `play · parar · mudo` mais o volume, sem nada que virasse página.
O eixo já existia (`slideTarget()` respondia `'deck'`); faltava alguém aqui
ligado a ele. Uma apresentação entra por compartilhamento (`focarImportado`
projeta na hora neste modo), projeta, e ficava **presa na página 1** até o
operador ir ao modo avançado — que é justamente o modo que este existe para não
exigir.

**E AQUI SÓ HÁ UM ELEMENTO NO AR** (v1.4.32): *"coloque a limitação de apenas um
elemento ativo na mídia, assim no modo simples não há sobreposição e nem
necessidade de multicontroles"*. Este modo **não cria sobreposição** — um toque
numa apresentação com um louvor tocando SUBSTITUI, e o mesmo vale para uma
imagem. A regra mora numa guarda `appMode !== 'simple'` dentro do `send`; o
porquê e o caso da cena composta que atravessa a troca de modo estão em
[`CAMADA-DE-TEXTO.md`](CAMADA-DE-TEXTO.md).

**A ASSIMETRIA COM A LETRA É O PONTO.** A letra anda sozinha, pelo relógio da
música: ali a zona ILUSTRA e mais nada. Um deck não tem relógio — alguém precisa
passar a página —, e por isso aqui ela é também CONTROLE: o toque numa página
pula para ela (o mesmo `deckIr` do modo avançado, não um segundo jeito de
saltar).

| peça | o quê |
|---|---|
| `refreshSimpleLyrics` | pergunta `deckNoAr()` primeiro. **Quem está na frente vence** — é a pilha do auxiliar do modo avançado (v1.4.26): há UMA zona neste modo, e mostrar a camada de trás seria descrever o que a congregação não está vendo. Com uma apresentação sobre um louvor (v1.4.28) ela mostra as PÁGINAS |
| `#simpleSlidesRow` | as teclas `‹ · N/M · ›`: três células (`1fr 1.1fr 1fr`), teclas de 76px (`.simple-key--pag`) e o mostrador no meio (`.simple-pag-read`). Este modo é *"teclas grandes, nada de arrastar"* — o número responde *"onde estou?"* sem exigir mira. Só existe com um deck no ar (nasceu com a geometria da linha de volume, que saiu na v1.13.8) |
| `renderSimpleSlides(who)` | **espelha, não recalcula**: o `disabled` sai das âncoras que `applySlideLimits` acabou de escrever, e o `who` é o mesmo `slideTarget()`. É a técnica do `renderTransportAxis`, e pelo motivo dele — uma segunda conta de *"posso avançar?"* divergiria CALADA (a tecla acesa no fim da apresentação, ou apagada no meio) |
| as teclas | acionam as ÂNCORAS do modo avançado por `.click()`, como o play/parar/mudo: um botão `disabled` é no-op natural, e o limite vale aqui sem uma segunda guarda |
| `lvSimpleDeckUrls` | o sumidouro **próprio** das miniaturas. Há dois desenhistas de páginas (esta zona e a folha do avançado), e uma lista única fazia o redesenho de um revogar as imagens do outro — quadros vazios, **sem erro em lugar nenhum**, porque uma `<img>` com `src` revogado não pinta e não reclama. Daí `lvSoltarUrls(lista)` receber a lista |

- **A BARRA DE ROLAGEM É A DA FOLHA DO MODO AVANÇADO** (v1.4.37). Relato do
  operador: *"o auxiliar de leitura no modo simples está sem a barra lateral do
  scroll para visualizar a rolagem da lista"*. MEDIDO: aqui `scrollbar-width` e
  `scrollbar-color` computavam **`auto`**, contra `thin` e o acento na
  `.lyricsview-body`. A receita nasceu lá com a razão escrita — *"a caixa diz que
  há um dentro, a barra diz ONDE se está nele"* — e esta zona, que faz o mesmo
  trabalho, ficou sem ela; com a coluna de PÁGINAS, saber a posição na lista é o
  recurso inteiro. A pista fica `transparent`: o fundo daqui já é `--panel`, e uma
  pista da cor do próprio fundo não é pista nenhuma.
  **E DESDE A v1.8.61 ELA NÃO EXISTE MAIS EM LUGAR NENHUM.** A v1.8.60 a
  padronizou na marca `.rola` (esta zona e outras duas a declaravam por si, três
  contra dezesseis, com 1,29:1 de contraste nas dezesseis contra 6,63:1 aqui); o
  relato seguinte pediu a barra SOB a sombra e, medido que de dentro do scroller
  isso não se faz — 149 de 240 linhas do polegar cobertas, contra 240 de 240 por
  um elemento de FORA, e `z-index: 2147483647` não move um pixel —, o operador
  escolheu o desfecho que ele mesmo nomeou: *"simplesmente deixe sem nenhuma
  barra de rolagem"*. A SOMBRA das bordas ficou como indicador único.
  **O que a v1.4.37 pedia continua respondido**, por outro meio: *"a caixa diz
  que há um dentro"* é a tira, e ela não some depois de 0,8 s — que é o que a
  barra sobreposta do Android faz, medido, com `thin` declarado e sem ele.
- **DUAS COLUNAS, E SÓ AQUI** (v1.4.35): *"coloque os slides em duas colunas,
  pois temos menos altura vertical, portanto manter os slides de mesmo tamanho
  acaba impedindo de ver mais que dois slides corretamente, deixando de ser uma
  lista e competindo com o próprio preview"*. MEDIDO antes: numa zona de 552px
  cabiam **DOIS** slides inteiros, com a linha em 194px — e os dois eram a página
  no ar e a seguinte, que é o que a preview e o telão já dão. Em duas colunas a
  linha cai para ~102px e a zona passa a caber **OITO**.
  A classe `.lv-grade` é posta no CONTAINER por `refreshSimpleLyrics`, e **só com
  um deck**: a letra continua em coluna única, porque ali o corpo é TEXTO e duas
  colunas estreitas quebram cada estrofe em mais linhas do que economizam. A
  folha do modo avançado não herda nada disso — lá a altura é a de um
  bottom-sheet, e a miniatura larga é o que faz a página se reconhecer. A LINHA é
  a mesma `.lv-row--slide` dos dois modos, e é isso que faz o selo, o toque e o
  `lvScroll` valerem aqui sem um segundo desenho.
- **A PÁGINA FICA FORA DA ASSINATURA**, pela razão do `lvSignature`: o destaque
  anda por classe, e com ela lá dentro cada toque no ⏭ revogaria e recriaria as
  miniaturas de uma apresentação inteira no meio do sermão.
- **Sair do modo solta os Blobs**, e zera a assinatura junto: `refreshSimpleLyrics`
  volta cedo fora do simplificado, então ninguém mais passaria por elas — e sem
  zerar o `sig` a volta ao modo acharia tudo igual e deixaria a zona vazia para
  sempre.
- **`--curso` e não `--vol`**: o traço de curso tem dois donos (o mostrador da
  página e a tecla de NÍVEL), e o nome tem de descrever o que ele desenha. O
  fader do modo avançado continua com `--vol`, que ali é volume de verdade.
- **Com uma LETRA em cena a linha nem existe.** A estrofe anda sozinha pelo
  relógio da música, e um par de teclas oferecendo um controle que ninguém
  precisa exercer é o que este app não faz.

Oráculo: `tools/modo-facil-slides.test.mjs`.

A espiada do volume pelos botões físicos (`peekVolume`) **não roda aqui**: com
algo no ar o número está na tecla de NÍVEL, escrito pelo mesmo `renderControls`
que escreve o fader. **Sem nada no ar a linha está recolhida e a tecla física
muda o número sem mostrá-lo** — aceito: não há som a ajustar, e o número aparece
com a linha na próxima mídia.

#### As três teclas e a linha que recolhe (v1.13.8)

Pedidos do operador: *"remover o botão de mais e menos de volume e o de mute do
modo simples. Adicione a função de mute ao próprio botão que indica o nivel de
volume (… cor do botão normal…). Então fica assim: botão de stop, botão de
play/pause e botão de nivel de volume/mute"* · *"Esconder play pause e stop no
modo simples, após um encerramento de mídia … também vale para quando feito stop
pelo usuário. Lembre de animar o recolhimento e com tempo suficiente para não
desaparecer debaixo dos dedos do usuário."*

| peça | o quê |
|---|---|
| `.simple-keys` | **Parar · Play/Pausa · Nível**, nessa ordem, `repeat(3, 1fr)`. Com um deck no ar sobra só o Parar (`.simple-remote.deck`) |
| `#simpleNivel` | o glifo do som em cima e o número do volume (`#simpleNivelNum`) embaixo, na cor de TECLA (`--panel`, a das vizinhas — o mostrador antigo era `--surface`), com o traço de curso (`--curso`, `::after`) na base. O toque é `#muteToggle.click()`: o mesmo `toggleMute`, o mesmo comando `mute`, a mesma linha do Registro. `renderSimple` copia `.muted`/`.blocked`, o glifo (`ICON.volOn`/`volOff`) e o `title` do botão do avançado. **O mudo se lê pelo DESENHO**: o alto-falante riscado e o traço que some — a cor (`--btn-danger`/`--btn-warn`, a do mudo antigo) vem junto, nunca sozinha |
| `renderTeclasSimples` | chamada por `renderSimpleCorpo`, ANTES da medida da troca. A pergunta é a do Parar (`haOQueParar`): o fim natural e o Parar recolhem, a pausa não. Recolher espera `SIMPLE_TECLAS_ESPERA_MS` (1,5 s — o dedo que tocou o Parar, ou ia tocar a Pausa no fim do louvor, ainda está ali; e a troca de faixa de uma fila derruba o "no ar" por um instante) e reconfere; a saída (`recolherTeclasSimples`) é só opacidade e 16 px para baixo em `SIMPLE_TECLAS_ANIM_MS` — nada muda de tamanho no meio dela —, e só no FIM a linha sai do layout (`.recolhida`, `display: none`). A volta é imediata, com o fade inverso. Sem movimento, as duas são secas. Fora do Modo Fácil e na passada em que o modo muda o estado ASSENTA, sem espera nem animação (a abertura sem nada no ar já nasce recolhida) |
| a caixa da Biblioteca | sem nada no ar a Biblioteca é a tela principal e se mede na zona de leitura, que CRESCE quando a linha sai. Por isso a medida do fim da saída é a de TROCA (`medirCorpoSimples({ troca: true })`): a janela ANIMA até a base nova em vez de pular (`semAnimarAJanela`). Animar a ALTURA da linha seria pior: cada quadro dispararia o `ResizeObserver` da leitura, e a medida comum desliga a transição da janela — inclusive a que recolhe a Biblioteca quando uma música entra. Na volta a linha entra no layout no MESMO pulso em que o card do nome aparece, e uma medida de troca só pega as duas |

**O que sai junto, aceito pelo operador:** sem nada no ar o ▶ que repetia a
faixa parada não está à vista no Modo Fácil (a Biblioteca é a tela, e tocar de
novo é escolher a música), e o único ajuste fino de volume no modo são as teclas
físicas. Oráculo: `modo-simples-teclas.test.mjs`.

#### Sem tela conectada, o modo inteiro fica bloqueado

Neste modo **a projeção É o telão** — não existe preview aqui. Sem tela, buscar
uma música e dar play não produz nada: nem imagem nem som.

**Mas o bloqueio deixou de ser incondicional** (v1.0.5). Ele supunha que quem
abre este modo sempre quer projetar, e não quer: ensaiar o louvor, conferir a
letra ou ouvir o playback a caminho da igreja são usos legítimos, e para todos
eles a resposta certa é o som saindo deste aparelho — o que o modo avançado já
faz sozinho sem tela. O **"Tocar neste celular"** da folha de conexão
(`castLocalBtn` → `setTocarNoCelular`) é a escolha explícita disso: ele
desbloqueia o modo e liga o som daqui.

**É CAMINHO SÓ DE IDA, e vale só o uso atual** (v1.0.6). Não há botão de volta, e
`tocarNoCelular` não é guardado em lugar nenhum — o `let` é a memória inteira da
escolha. O bloqueio se rearma sozinho por três caminhos, e são eles que
substituem o botão de desfazer:

| o que acontece | onde |
|---|---|
| o app fecha | nada foi gravado — a abertura seguinte nasce bloqueada |
| ida e volta pelo modo avançado | `setAppMode`, que zera em toda troca — **menos a ida AO Modo Fácil com mídia no ar e sem tela, que a LIGA** (v1.11.19, abaixo) |
| uma tela entra | `renderSimpleGate` — há para onde mandar o som, e é para lá que ele vai |

**A EXCEÇÃO DA IDA COM MÍDIA NO AR (v1.11.19).** Relato do operador: *"ao estar
tocando algo, estando no modo avançado e ir para o modo simples, atualmente ele
pausa o som e mostra as 3 opções iniciais do modo simples. Gostaria que ele não
interrompesse a mídia, pois se está tocando é porque foi feito pelo usuário; nesse
caso, se não houver tela conectada, apenas vá para o modo 'tocar neste celular',
pois tecnicamente é isso que o usuário estava fazendo no modo avançado"*. É o
MESMO estado visto de dois modos: sem tela o avançado já toca AQUI, e a cortina do
simples emudecia a prévia por uma diferença de MODO, não de intenção. A regra, em
`setAppMode`, é a ida **avançado → simples** com `midiaNoAr` (a pausada conta: é
cena, e a cortina a esconderia do mesmo jeito) e **sem tela** (`algumaTelaConectada`
— com tela o som já está lá fora e o gate nem existe). Continua valendo SÓ o uso
atual (escrita no `let`, nunca gravada): uma tela que entra, outra ida e volta ou o
app fechado a desfazem como sempre, e **sem mídia no ar nada mudou — o gate
bloqueia**. MEDIDO: sem a regra o `<video>` seguia avançando (a cortina só
emudece), então o que o operador ouvia como "pausou" é o som local e a cortina —
é o que o oráculo (`som-nao-vaza-ao-perder-a-tela`, bloco 7) mede.

Daí o botão SUMIR depois do toque, em vez de trocar de rótulo: a tela
desbloqueada e o som saindo já dizem que ele foi tocado.

> A v1.0.5 PERSISTIA a escolha e oferecia "Voltar a exigir uma tela". Persistir
> era o defeito que o botão vinha remendar — guardada, a decisão de um ensaio de
> quarta-feira chegava ao culto de sábado, e alguém tinha de lembrar de
> desfazê-la. Sem gravar, não há o que desfazer.

`renderSimpleGate()` cobre a tela com a cortina `#simpleVeil` (`backdrop-filter:
blur(7px)` mais um véu em `--veil`), que **intercepta os toques** do que ficou
atrás. Ela é só o vidro fosco; na frente sobem duas coisas, e só duas:

- **a seção de conexão** (`#simpleConn`), a única ação que resolve o bloqueio.
  Bloqueada a tela, a faixa de ações deixa de ser faixa: preview e "Buscar
  música" somem, e o que resta é içado para o centro exato da tela em
  `position: absolute`. O cartão tem fundo próprio (`--panel`) porque a cortina
  embaçada não é fundo de leitura;
- **Configurações** (`#simpleSettingsBtn`), no cabeçalho, por onde se volta ao
  avançado. **Sem TV o app não fica inútil** — a projeção passa a ser a preview
  em tela cheia —, e trancar essa saída transformaria a falta de telão numa
  parede. O que se bloqueia é o modo, não o app.

**A busca aberta é fechada pelo bloqueio** (`closeHymnSearch()`): perder a tela
com o popup no ar deixaria a busca funcionando por cima de uma tela bloqueada.

> **A remoção desta cortina (v5.199) foi um diagnóstico errado, e o registro
> fica.** O operador relatava "o botão de conectar que persiste em existir e
> bloquear a tela", e a leitura foi de que o BLOQUEIO incomodava — o que ele via
> era o botão ANTIGO reaparecendo, servido pela base embutida no APK depois de um
> recuo do watchdog que não limpava o cache do WebView. Ele chegou a dizer, com
> todas as letras, que "essa parte não era o problema". **Quando o operador
> descreve um sintoma com o nome de um elemento, o nome pode estar errado e o
> sintoma nunca está: vá medir o que ele está vendo.**

#### A preview no lugar da seção de conexão

Conectado, não há nada melhor a dizer sobre "está conectado?" do que **mostrar o
que a TV está exibindo**. A seção de conexão sai e a preview ocupa **a célula
dela** na grade — os dois nunca coexistem, então dividir a célula é o certo e
nada no resto da tela se move.

A preview não tem altura própria ali: a largura é a da coluna e a altura vem da
**proporção do telão**, que é o ponto de ela existir. Como a 16:9 nessa largura
ela sai mais baixa que a tecla ao lado (83px contra 94px num aparelho de 390px),
a grade a centraliza verticalmente — esticá-la custaria a fidelidade da
proporção, que é justamente o que faz a miniatura valer como espelho do telão.

O **ícone de cast no canto** é a saída, e a cor diz isso: conectado ele fica
**vermelho contornado** (`--danger-strong`), porque ali o toque DESCONECTA — quem
já diz que há tela recebendo é a própria preview, que só existe aqui quando há.
Nunca o `--danger` cheio: preenchido, o vermelho deste app significa "está no ar
agora" e competiria com a mídia que a miniatura está mostrando.

> **E por vinte e três versões ele não abria nada nesse estado.** A regra "alguma
> tela ENTROU com a folha aberta: ela fecha" foi escrita como `if (há tela && a
> folha está aberta)` — uma frase sobre EVENTO implementada como teste de ESTADO.
> Com uma tela conectada, QUALQUER passagem por aquela função fechava a folha, e
> `abrirCast` liga a enquete de 2,5 s que a chama: a folha abria e se fechava em
> milissegundos. A correção é a BORDA que a frase sempre descreveu
> (`gateTinhaTela`), com a memória **re-armada em `abrirCast`**.

**A tela cheia (`#pvFullBtn`) não aparece aqui**: neste modo existe um telão
conectado — é o que faz esta faixa existir — e a projeção está nele.

**O nó da preview é O MESMO do modo avançado**, movido de um pai para o outro
(`hostPreview`), pelo padrão do `#selbar` e do `<input type=file>`: duas previews
divergiriam no primeiro ajuste, e dois `createStage` decodificariam o MESMO vídeo
duas vezes num aparelho que já roda dois WebViews.

- **A troca acontece só na mudança de MODO**, não ao conectar/desconectar: sem
  tela a preview some por CSS e um `display: none` não custa nada.
- **Um `<video>` sobrevive à mudança de pai**, e como o embed saiu é só isso que
  a preview tem: `hostPreview` move o nó e nada mais precisa ser refeito.
  (Enquanto o iframe existia ele NÃO sobrevivia — mudar de pai o recarregava —,
  e `hostPreview` remontava a preview no segundo em que ela estava. Isto é a
  diferença de custo entre as duas eras: qualquer coisa que volte a pôr um iframe
  na preview repõe esse trabalho.)
- **`appendChild` de um nó já anexado é remoção e inserção atômicas**, então o
  "removido do documento" que pausaria o vídeo nunca chega a valer.

**No Modo Fácil o cartão mora no `#simpleBusySlot`** (v1.11.11) — o mesmo nó e o mesmo
`previewBusy`; o parágrafo abaixo descreve a medida que ele tinha SOBRE a prévia. Ele volta `visivel: false` no simplificado **sem tela conectada**,
quando a preview não está na tela. As medidas são reduzidas por `.simple-stage`
(anel de 22px, fontes menores) e reservam os 38px do `.pv-fab` **dos dois
lados** — à direita porque senão ele transborda a miniatura e passa por baixo do
ícone de cast, à esquerda porque a folga de um lado só o tirava do centro (ver
abaixo). Aqui a coluna da esquerda nem existe, então o que a simetria compra é
só o centro.

**A única parte que muda por contexto é quem responde "há tela?"** No app são as
telas de apresentação que a ponte lista (`AVNative.displays()` +
`onDisplayChange`); no navegador vale a **janela do Display** que o botão abre
(`openWebDisplay`), e como não há evento de "janela fechada", um relógio de 1 s
olha o `closed` — e ele só existe enquanto a janela existe.

### O vídeo do Modo Fácil em tela cheia, e a barra de volume da tela cheia (v1.12.24)

- **ENTRADA:** `send` → `acertarTelaCheiaDoVideo(true)`; a régua é `telaCheiaDoVideoCabe()` = `videoDoModoFacil()` (Modo Fácil + `midiaNoAr` + `currentItem.kind === 'video'` + `simplesSemLeitura()`) **+ `!haDestinoDeProjecao()`** (v1.12.26: com TV ou tela da rede a tela conectada é o visor). `haDestinoDeProjecao` e não `algumaTelaConectada`: esta segue a `Presentation`, e cada oscilação do dongle abriria e fecharia a tela cheia. Uma tela que ENTRA com ela aberta a fecha (`renderSimpleGate` → `acertarTelaCheiaDoVideo(false)`). É a MESMA tela cheia do ⛶ do avançado (`entrarTelaCheiaDaPrevia`, que devolve se entrou).
- **SAÍDA:** `resetAfterEnd` (fim natural, fila vazia) e `pararMidia` chamam `acertarTelaCheiaDoVideo(false)`; um `send` de mídia que não é vídeo também fecha. Só fecha o que `fsDoVideo` marca (esta regra ou o `#simpleFsBtn`): o ⛶ do avançado não é tocado. O avanço da fila passa direto por `send`, e o vídeo seguinte herda a tela cheia.
- **A `.bottombar` volta a ter caixa** enquanto a prévia está em tela cheia (`body.mode-simple .bottombar:has(.preview:fullscreen)`): ancestral `display: none` deixa o top layer 0×0, MEDIDO.
- **A COLUNA DO MODO FÁCIL** é sair + play/pause (`body.mode-simple .pv-fsctl :is(#fsView, #fsPrev, #fsNext) { display: none }`).
- **O PEDIDO EXIGE ATIVAÇÃO DO USUÁRIO** (~5 s, também no WebView). O vídeo que baixa antes de projetar chega tarde e é recusado (vai ao Registro); a porta é o `#simpleFsBtn` (`renderSimpleFsBtn`, chamado pelo `renderSimple`), só com vídeo no ar e sem tela. Desde a v1.12.26 o card é GRADE de uma coluna e o botão ocupa uma segunda coluna IMPLÍCITA (`grid-column: 2; grid-row: 1 / 3`), à direita do nome E da barra; escondido ele não gera coluna. A altura do card não muda (v1.12.11).
- **A BARRA DE VOLUME** (`#pvVolume`, dentro da `.preview`, nos dois modos): `mostrarVolumeDaTelaCheia` em `applyVolume` e `peekVolume` (a tecla que vai ao sistema no teto/zero também acende), 2 s (`PV_VOLUME_MS`), número do APP, escrito na custom property `--nivel` do `#pvVolumeNivel`. Tokens do palco. `fullscreenchange` de saída apaga a barra, zera `fsDoVideo` e remede o corpo do Modo Fácil. No avançado ela é horizontal, no topo; **no Modo Fácil, EM PÉ NA BORDA ESQUERDA** (v1.12.41, `body.mode-simple .pv-volume`: `column-reverse`, o nível de baixo para cima por `height: var(--nivel)`, `height: min(220px, 100% − 9rem)` para caber entre o título e a linha do tempo, `safe-area-inset-left`).
- **O TÍTULO E A LINHA DO TEMPO DO MODO FÁCIL** (v1.12.41, pedido do operador, aprovado): `#pvFsTopo` (o nome, `npNameInnerEl`, escrito pelo `renderSimple` e pelo `renderFsCtl`; degradê de `--scrim` até nada, `pointer-events: none` sempre) e `#pvFsBase` (decorrido · `#pvFsTempoHit` · duração; alvo de 32 px; `renderSimpleTime` escreve o tempo e o `hidden` — some sem duração, junto com o do card). Os dois só são desenhados no Modo Fácil em tela cheia (`:fullscreen` e `.pv-inteira`) e vestem a `.visivel` da coluna (`acenderFsCtl`/`esconderFsCtl`, o array `fsJunto`); o recuo direito de 60 px é o da coluna. **A linha do tempo é a MESMA barra do card**: o `setupSimpleSeek` virou `ligarBarraDeTempo(hit, { pintar, aoComecar, aoTerminar })` — `simpleSeeking` e `seeking` compartilhados (o `renderSimpleTime` não escreve sob o dedo), um `cmd({ type: 'seek' })` só ao soltar, o `#seek` do avançado como fonte de verdade, `pointercancel` sem salto. Na tela cheia `aoComecar` PARA o relógio dos 4 s e `aoTerminar` o rearma (o `acenderFsCtl` não arma o relógio com a faixa em `.seeking`), e o `pointerdown` da prévia conta a `.pv-fsbase` como a coluna — um toque nela acesa procura, nunca apaga.
- Oráculo: `video-tela-cheia.test.mjs` (o título, a linha do tempo e o volume em pé: bloco H; na tela inteira do app, `tela-inteira` B3). O `evaluate` do Playwright carrega ativação, então a recusa é SIMULADA (stub do `requestFullscreen`).

### A Biblioteca do Modo Fácil é maior (v1.13.9)

Pedido do operador: *"agora com mais espaço vertical na biblioteca, o sistema tem de aumentar os itens para aproveitar completamente esse vão … fique a vontade para aumentar o tamanho dos cards da listagem das coletâneas, álbuns e afins no geral no modo simples (mesmo que saia do padrão do resto do app) … os itens dentro dos álbuns, alguns chegam a estar tão pequenos que fica estranho de tocar neles"*.

| peça | o que faz |
|---|---|
| **a escala é do ESCOPO** (`body.mode-simple #hymnResults`, em `controle.css`) | os tokens de medida que a lista usa são REDECLARADOS ali: `--hit`, `--thumb`, `--faixa-thumb`, `--icon-sm/md/lg` × `--lib-esc`; `--fs-2xs` … `--fs-4xl` × `--lib-esc-fs`. O valor original é capturado um nível acima (`body.mode-simple { --base-*: var(--*) }`) — uma propriedade não se refere a si mesma, e copiar o número divergiria do token. Peça nova da lista que use os tokens cresce junto; a barra de busca (fora da lista) não muda |
| **as DERIVADAS são reescritas no escopo** | `--bar-secao-h`, `--bar-raiz-max`, `--faixa-coluna-texto`: uma propriedade personalizada é resolvida onde é DECLARADA, e herdada da raiz traria o `--hit` de lá. `--quad-faixa` NÃO entra (a lista não o usa, e o `quadrado-de-icone` exige uma declaração só) |
| **`--faixa-thumb`** | a miniatura da faixa (`.hymn-play-thumb`, 38px) virou token na raiz, consumido pela miniatura e pela `--faixa-coluna-texto` |
| **`acertarEscalaDaBiblioteca`** | escreve os dois fatores em `#hymnResults` no Modo Fácil e os apaga no avançado. `--lib-esc` = altura do `.simple` em px ÷ `LIB_ESC_PX` (576), entre `LIB_ESC_MIN` 1,3 (o alvo vai a 44,2px) e `LIB_ESC_MAX` 1,5. `--lib-esc-fs` = o mesmo, limitado pela largura da lista em rem ÷ `LIB_ESC_FS_REM` (20), nunca abaixo de 1. Chamada no `setAppMode`, no `resize` e no começo do `medirTampa` (a tampa mede as barras, que são do tamanho da escala) |
| **a altura é a da TELA, não a do momento** | a maior altura vista nesta LARGURA (o teclado encolhe o `.simple`; girar recomeça). Um fator que seguisse a altura da LISTA mudaria o tamanho de tudo depois da animação da janela quando a linha de controles recolhe — um segundo pulo. Quem preenche a sobra do momento é a TAMPA |
| **o teto da tampa** | no Modo Fácil `--bar-raiz-max` é `2 × --hit + 2rem` (no avançado `--hit + 2rem`): com poucos blocos eles preenchem a lista em vez de deixar ~75px vazios a 390×844. O `calcularTampa` o lê pela `--lib-teto-px`, registrada (`@property`) como `<length>` — a propriedade comum devolve o TEXTO da fórmula, que o `parseFloat` não lê (no avançado ela vale 0 e o caminho é o de sempre, que cai no `66` de reserva) |
| **o nome quebra em DUAS linhas** (`.hymn-name`, `.coll-bar-name`, `.coll-group-name`, `-webkit-line-clamp: 2`) | com a letra e os alvos maiores a largura do nome encolhe; duas linhas cabem na altura que a miniatura (faixa) ou o alvo (barra) já dão. A barra de SEÇÃO tem a altura DECLARADA (`--bar-secao-h`) e continua tendo: as duas linhas cabem no alvo mais o recuo |
| **a barra devolve espaço ao nome** (`.coll-bar`, `.coll-group-bar`: vão `--sp-4`, recuo lateral .55rem) | numa palavra só não há segunda linha: com a DejaVu do runner do CI (mais larga que a Inter local e a Roboto do aparelho) "Infantis" saía cortado a 360×640 · 1,3× — 78 de 85px — numa barra de seção que no avançado o mostrava inteiro. Os 12px voltam ao nome sem mexer na altura |

MEDIDO (avançado → Modo Fácil): a 390×844 · 1×, faixa 42,8 → 60,6px, miniatura 38 → 55,9, nome da faixa 13,1 → 15,1px, barra 45,2 → 61,2, seta 34 → 50, bloco de raiz 57,6 → 92,7 (preenchendo); a 360×640 · 1,3×, faixa 44,2 → 55,6, seta 34 → 44,2 (a letra fica a do avançado: a lista tem 15,9rem de largura). Nenhum nome que cabia no avançado sai cortado — e vários que saíam com "…" passam a caber em duas linhas.

**A LINHA ESCOLHIDA NÃO TEM TRAÇO.** Relato: *"ao tocar em um item de um álbum para tocar, ele colore o card … mas parece que fica uma fina linha sem essa cor"*. A receita "METADE DO VÃO MORA DENTRO DA CAIXA" (v1.5.17) põe o traço da `--divisoria` no `padding-top` da faixa, ACIMA da `.row` — e por isso a `.row` (`z-index: 1`) não o cobre: sobre a linha marcada ele lia 117,139,174 contra 62,89,132 do preenchimento, da coluna do texto até a direita; e o da faixa de BAIXO encostava na base do card, porque o recuo do toque (`translateY(2px)`) desce a linha exatamente o meio vão. Os dois saem com `.selecionando` (a própria e a vizinha de baixo). O ABERTO do avançado (`.expanded`) tinha o mesmo traço sobre a tampa — a regra da v1.5.18 dizia que ele sumia, e não sumia pelo mesmo motivo; ele sai também. Oráculo: `modo-simples-biblioteca-tamanho` G (por pixel).

### A troca leitura ↔ Biblioteca no Modo Fácil anima (v1.12.12)

Parar e "mídia entra" mudam a base da leitura (o card do nome aparece/some) no mesmo pulso em que a janela abre/fecha. `medirCorpoSimples({ troca: true })` — só `renderSimpleCorpo` o usa — NÃO conta a mudança de `--simple-corpo-base` como remedição (que zeraria `--lib-anim` e faria a janela pular); abrindo, a janela anima da posição fechada até a base nova. `.simple-song` esconde por `visibility` com atraso de `--lib-anim`, para a janela cobri-lo antes. Oráculo: `modo-simples-corpo` bloco O.

### O card do nome no Modo Fácil tem UMA altura (v1.12.11)

`.simple-nowplaying` (nome + linha do tempo) não muda de altura enquanto há mídia no ar: `#simpleTime[hidden]` vira `visibility:hidden` mantendo o lugar e `.simple-np:empty` mantém a linha. Sem isso o topo do card andava ~26 px e a zona de leitura (e a caixa da Biblioteca, medida nela) crescia/encolhia. Sem mídia o card continua `display:none`. Oráculo: `modo-simples-corpo` bloco N. O título da letra (`.lv-cab--letra`, `.lv-row--cover`) fica a UMA linha da letra (K3).

