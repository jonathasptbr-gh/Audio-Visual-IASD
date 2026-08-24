<!-- Capítulo de docs/ARQUITETURA-WEB.md. O índice e as regras
     de desenvolvimento ficam lá; este arquivo é só este capítulo. -->

## Controle

### Índice do capítulo

| seção | assunto |
|---|---|
| [Layout geral](#layout-geral) | a coluna, a preview, o transporte, a barra de baixo |
| [Modos de uso](#modos-de-uso-modo-fácil-padrão--avançado) | Modo Fácil × avançado |
| [O tema](#o-tema-claro--escuro-em-configurações) · [Wallpaper](#wallpaper-personalizado) · [Girar a mídia](#girar-a-mídia-v5142) | Configurações |
| [Abas e biblioteca](#abas-e-biblioteca) | Cronograma, playlist, busca, gaveta de opções, destinos |
| [Gestos nos itens](#gestos-nos-itens-da-biblioteca) | toque, toque longo, reordenar |
| [Coleções de mídia (LouvorJA)](#coleções-de-mídia-louvorja) | álbuns, índice, sincronização, peso |
| [Os acordeões](#os-acordeões-abrem-animados) | card do álbum, letra, opções da coleção, completude |
| [O download vira estado da tela](#o-download-vira-estado-da-tela) | espera na preview, anel na linha, letra sincronizada |
| [Séries do YouTube](#séries-do-youtube--coleções-que-não-vêm-do-louvorja-v5228) | Provai e Vede, Informativo |
| [Playlist automática](#playlist-automática-o-sorteio-temático-v5303) | sortear por tema: uma só ou uma fila |
| [Buscar no YouTube](#pesquisar-texto-no-youtube-no-fim-da-busca) | busca, download, transmissão direta |
| [Favoritos](#favoritos-uma-lista-só-marcados--pastas-do-aparelho) | lista única, pastas do aparelho |
| [A saída de áudio](#a-saída-de-áudio-os-displays-ou-este-aparelho-v5215) | quando o som sai do celular |
| [Feedback](#feedback-sem-alerta-flutuante--e-a-exceção-do-salvamento) | a resposta nasce onde o toque nasceu |
| [Compartilhamento](#compartilhamento) · [Diálogo padrão](#diálogo-padrão-do-app-confirmações--prompts) | entradas e confirmações |
| [O que o telão retoma](#o-que-o-telão-retoma-ao-reconectar-midianoar-v5142) | reconexão |


### O tema (claro × escuro), em Configurações

Uma linha segmentada logo abaixo de "Modo do app", e a proximidade é
deliberada: são a mesma classe de decisão ("como este app se apresenta") e as
duas são LEMBRADAS entre aberturas. O escuro vem primeiro por ser o padrão, e o
segmentado segue a leitura esquerda→direita das demais linhas — o estado de
partida à esquerda, como o "Padrão" do wallpaper desde a v5.188.

**Trocar aqui NÃO fecha o popup**, ao contrário do modo do app. O modo troca a
tela inteira ATRÁS do popup (não há o que ver com ele na frente); o tema troca
a cor DO PRÓPRIO POPUP, e é olhando para ele — que acabou de mudar — que o
operador decide se gostou.

**A escolha é lida do `localStorage` (`av.tema`) no topo do `controle.js`**,
antes do primeiro quadro, exatamente pela razão do `av.appMode` logo abaixo: uma
leitura do IndexedDB é assíncrona e chega depois de o app já ter pintado. Aqui o
preço de errar é maior, não menor — o modo troca a TELA, o tema troca a COR DE
TUDO, e um flash do app inteiro em preto antes de virar claro se vê a cada
abertura.

**O escuro é o padrão, e é o app sem atributo nenhum.** Não é inércia: este app
é operado num salão às escuras, e quem nunca escolheu precisa abrir na versão
que não cega o operador nem ilumina a fileira de trás. O claro existe para o
ensaio de sábado de manhã e para quem opera com a igreja acesa.

As cores, a montagem dos três blocos de `tokens.css` e a razão de o PALCO não
ter tema estão no Design System, mais abaixo.

### Modos de uso: "Modo Fácil" (padrão) × avançado

> **O nome na TELA é "Modo Fácil"**; no CÓDIGO o modo continua sendo `'simple'`
> (a classe `mode-simple`, o `appMode`, o `data-mode`) — trocar a string interna
> não mudaria um pixel e esbarraria em dezenas de referências, a mesma razão pela
> qual a aba de Ferramentas segue com `activeTab === 'mic'`.

O app atende duas pessoas: uma abre o celular para **conectar a tela e tocar um
louvor**; a outra opera o culto inteiro. A tela que serve bem à segunda é
excessiva para a primeira, e esconder recursos atrás de uma configuração só
empurraria a escolha para um lugar onde ninguém procura.

**O app abre no ÚLTIMO MODO USADO**, e no simplificado para quem nunca escolheu —
nunca por um seletor na abertura, que cobraria um toque de todo mundo, inclusive
de quem nem sabe que há dois modos, antes de mostrar qualquer coisa útil. A
classe `mode-simple` **já vem no `<body>` do HTML** (e `.open` no `#simpleMode`),
então a tela certa aparece sem esperar JS ou IndexedDB.

**A troca mora em Configurações, nos DOIS modos** (segmento "Modo do app",
`#appModeSeg`) — é ele que GUARDA a escolha entre aberturas. Os botões de
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

#### O modo é LEMBRADO entre aberturas

- **Fica em `localStorage`** (`av.appMode`), e não no IndexedDB como TODO o resto
  do estado. O motivo é decisivo: esta chave precisa ser lida **antes do primeiro
  quadro**. Uma leitura do IDB é assíncrona — ela volta depois de o app já ter
  pintado o simplificado, e quem tivesse deixado o avançado veria a tela errada
  trocar embaixo do dedo. `localStorage` é síncrono e mora no mesmo
  `app_webview/`: mesma durabilidade, mesma regra de backup.
- **UMA fonte, não duas.** Gravar nos dois lugares "por garantia" só cria o dia
  em que eles discordam e ninguém sabe qual vale.
- **A restauração é em duas metades.** No TOPO do `controle.js` vai só a pintura
  (a classe do `<body>` e o `.open` do `#simpleMode`), que é a parte que não pode
  esperar; o resto (`setAppMode(appMode)`) roda no `init()`, **depois do
  `load()`** — no avançado ele posiciona o vazado da faixa de abas
  (`moveTabIndicator`), e medir a faixa antes de `load()` desenhá-la dá zero.
- **ARMADILHA:** um `setAppMode('simple')` literal no fim do módulo (que existia
  "para fechar o ciclo com o HTML") passou a reescrever o `localStorage` em toda
  abertura, e o avançado nunca sobrevivia a fechar o app — invisível no diff,
  porque a tela ainda pintava certo até aquela linha rodar.
- **`localStorage` pode LANÇAR** (armazenamento bloqueado): leitura e escrita em
  `try`, e o padrão do app já é a resposta certa no `catch`.

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
| **Preview** (`.simple-stage`) | a projeção em miniatura, **só com tela conectada**. Mora na faixa de baixo, dividindo a linha com "Buscar música"; o topo da tela é da LETRA, que é o que se lê durante o louvor |
| **Buscar música** (`#simpleSearchBtn`) | o MESMO popup do acervo (`openHymnSearch`); um toque na linha **toca a versão Cantada direto**. Fica na ZONA DE BAIXO — buscar é o começo de OPERAR, então pertence ao transporte, a milímetros do ▶ que vem depois de escolher. Sem tela a preview some e a grade vira uma coluna, com a busca inteira |
| **Linha do tempo** (`#simpleTime`) | decorrido · barra · duração, espelhando a `#seek` do avançado; some quando o item não tem duração. **Interativa**: tocar salta, arrastar procura — voltar o refrão é a coisa mais comum num louvor, e mandar o operador SAIR do modo para isso é o oposto do que o modo dá. O alvo é a FAIXA (`.simple-time-hit`), não o traço de 4px. O comando sai no `pointerup` (um `seek` por quadro engasgaria a mídia) e `simpleSeeking` impede o `timeupdate` de puxar o preenchimento debaixo do dedo |
| **Letra** (`#simpleLyrics`) | a letra INTEIRA da música em cena, com o mesmo destaque da leitura auxiliar do avançado |
| **Play/pause, parar e mudo** | `.click()` em `#playpause` / `#stop` / `#muteToggle`. O parar é a outra metade do transporte — sem ele, tirar a mídia do telão obrigava a ir ao avançado, que é o que se faz no fim de cada louvor |
| **Volume** (`#simpleVolDown` / `#simpleVolUp`) | teclas − e + com o número no meio (`.simple-vol-read`), nunca um slider |
| **Configurações** (`#simpleSettingsBtn`) | `openFadePopup()` — e é de lá que se troca de modo |

**Sem escolha de variante.** O toque na linha da busca chama `simplePlaySong()`,
que toca o Cantado e pronto: abrir a lista com cantada/playback/letra seria
devolver ao operador a decisão que este modo existe para poupar.

**A pergunta do download aparece UMA vez.** `ensureDownloadConsent()` pergunta
antes de gastar internet e grava a resposta em `state.downloadOk` — repetir a
pergunta a cada música viraria ruído no meio do culto. A verificação usa
`songVariantsNeeded()`, a mesma regra da sincronização em massa (não basta ter
`fileIdFull`: o arquivo pode ter sido apagado por fora).

**Volume em degraus, não em curso.** `simpleVolStep()` usa o MESMO passo dos
botões físicos (`VOL_KEY_STEP`) e a mesma `applyVolume()`. `holdRepeat()` faz a
tecla repetir enquanto segurada: o primeiro passo sai no `pointerdown` e a
repetição só começa depois de uma pausa, senão um toque comum viraria dois.

**A zona de letra reusa o renderizador da leitura auxiliar**: `lvBuildSong()` e
`lvMarkCurrent()` recebem o CONTAINER como parâmetro, e `refreshSimpleLyrics()`
entra no mesmo pulso de `renderSlideNav()`, sem timer próprio. Rolar com o dedo
desliga o acompanhamento até a próxima música, como no popup.

A espiada do volume pelos botões físicos (`peekVolume`) **não roda aqui**: as
teclas de volume já estão na tela, com o número ao lado.

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
| ida e volta pelo modo avançado | `setAppMode`, que zera em toda troca |
| uma tela entra | `renderSimpleGate` — há para onde mandar o som, e é para lá que ele vai |

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

**O cartão de "Baixando…" aparece aqui também** — é a mesma preview, logo o mesmo
`previewBusy`. Ele volta `visivel: false` no simplificado **sem tela conectada**,
quando a preview não está na tela. As medidas são reduzidas por `.simple-stage`
(anel de 22px, fontes menores) e reservam à direita os 38px do `.pv-fab`, senão
ele transborda a miniatura e passa por baixo do ícone de cast.

**A única parte que muda por contexto é quem responde "há tela?"** No app são as
telas de apresentação que a ponte lista (`AVNative.displays()` +
`onDisplayChange`); no navegador vale a **janela do Display** que o botão abre
(`openWebDisplay`), e como não há evento de "janela fechada", um relógio de 1 s
olha o `closed` — e ele só existe enquanto a janela existe.
### Layout geral

```
┌─────────────────────────────────────────────────────────┐
│                    CRONOGRAMA                    [Cfg]  │ ← .list-header (topo; sem appbar)
│  ┌───────────────────────────────────────────────────┐  │
│  │  item 1                                           │  │  ← .lib-list
│  │  item 2                                           │  │     (área scrollável)
│  └───────────────────────────────────────────────────┘  │
│  [        + Importar arquivos        ]                  │ ← #listFoot (fixo, não rola)
│   ↑ na seleção múltipla, a #selbar ocupa esta mesma fatia │
├─────────────────────────────────────────────────────────┤
│ [Cronograma] [Bíblia] [Ferramentas] [🔍]                │  ← .tabs (dentro da barra)
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

**A ENGRENAGEM SUBIU PARA CÁ NA v1.2.0** (pedido do operador: *"jogue o botão de
configurações no modo avançado para o topo da tela, na mesma posição que ele já
ocupa no modo fácil"*). Ela morava na fatia de cima da coluna do mixer, encostada
na BASE — o canto oposto ao do gêmeo do Modo Fácil —, e trocar de modo trocava o
canto em que a mesma porta se abre. Agora é o mesmo gesto nos dois: canto
superior direito, mesma caixa (`--hit`), mesma cor (`--accent`, a do `#backBtn`
em frente — a regra do app é que navegação/acesso é chapado e em accent).

O lugar já estava reservado: esta é a trilha 3, aberta pela v5.309 como um VÃO só
para o título não sair do eixo, e que previa este dia por escrito. O que ficou
vago no mixer virou o `#historyBtn` (ver "O histórico do culto").

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
colunas** (`56px` / `minmax(0, 1fr)` / `56px` do mixer) × 3 linhas (`auto` /
`var(--deck-pv-h)` / `auto`), com `.slide-side`, `.nowplaying`, `.preview-row` e
`.transport` como itens DIRETOS. O `#mixer` ocupa as 3 linhas e usa
`grid-template-rows: subgrid` para **herdar exatamente essas faixas** —
alinhamento pixel a pixel entre as colunas em vez de flex-basis calculado à
parte. O `padding` do `#mixer` é **só horizontal**: vertical deslocaria as
linhas herdadas.

**A terceira coluna nasceu na v1.3.5**, quando a preview passou a ser
FLANQUEADA pelos dois botões de slide (ver "Um par de botões, dois eixos"). Ela
tem a largura do mixer porque os dois botões precisam ser **gêmeos** — um par
que não tem a mesma caixa não se lê como par —, e **só a faixa da preview usa
as três**: `.nowplaying` e `.transport` atravessam a coluna da esquerda
(`grid-column: 1 / 3`), senão sobrariam dois vãos de 56px onde não há botão
nenhum. O transporte, que divide a largura entre seis botões, é justamente quem
tem uso para ela.

A coluna do meio é `minmax(0, 1fr)`, **não** `1fr`: uma faixa `1fr` tem mínimo
automático igual ao min-content, e o título (`#npName`, `white-space: nowrap`)
tem min-content do texto INTEIRO mesmo já cortado por ellipsis — um nome longo
inflava a coluna, esmagava a de 56px e fazia a largura da preview depender do
título.

A `.slide-side` **não precisa do `.mixer-stack` absoluto** que a coluna do mixer
usa: a faixa 2 é FIXA (`var(--deck-pv-h)`), então um filho no fluxo não tem como
inflá-la.

**O mixer NUNCA dita a altura das faixas** — quem dita é sempre a coluna 1. Cada
`.mixer-slot` é uma caixa vazia no fluxo, e os botões vivem num `.mixer-stack`
`position: absolute; inset: 0`: um item absoluto não entra no max-content das
faixas `auto`, e como o `#mixer` é `subgrid`, qualquer coisa no fluxo ali
contribuiria para as faixas do PAI. Era essa contribuição que deformava a caixa
ao ABRIR o slide de volume — o conteúdo do mixer muda entre os dois estados
(alturas intrínsecas diferentes) e as faixas `auto` mudavam de tamanho, levando
junto a altura do deck e da preview. (`min-height: 0` resolve metade: zera o
mínimo automático, mas uma faixa `auto` continua dimensionada pelo max-content.)

| Fatia | Linha da grade | Conteúdo |
|---|---|---|
| `.mixer-top` | 1 (`.nowplaying`) | **Histórico do culto** (`#historyBtn`), **sem caixa de botão** |
| `.mixer-mid` | 2 (`.preview-row`) | **passar slide** (`#slideNextBtn`) — a fatia inteira, um botão só |
| `.mixer-bottom` | 3 (`.transport`) | **volume** (`#volToggle`/`#volClose`, recolhível) |

**A fatia do meio era o bloco de operação até a v1.3.5**: letra
(`#lyricsViewBtn`), cortina (`#viewToggle`) e mudo (`#muteToggle`), cada um
`flex: 1`. Os três subiram para CIMA da preview (ver "Controles sobre a
preview") e o espaço virou o botão de passar slide, a pedido do operador — um
alvo da altura da miniatura é o maior que este deck tem para oferecer.

**Ele veste a altura MEDIDA da preview, não a da faixa** (v1.3.6, ver "Os dois
botões de slide"), e por isso `.mixer-mid .mixer-stack` centra o que tem dentro:
o que sobra da faixa fica dividido em cima e embaixo, como a própria miniatura
já se centra na dela.

A ordem continua separando o que NÃO opera o culto do que opera: no topo,
sozinho, o botão que só ABRE uma lista; no meio e embaixo, o que se toca durante
o culto.

**A fatia do topo era a de Configurações até a v1.2.0**, quando a engrenagem
subiu para o cabeçalho da tela (ver "Layout geral") e o **histórico** ocupou o
lugar. A geometria não mudou — e por isso o `#historyBtn` herda a classe
`.settings-btn`, que descreve a CAIXA e não o significado.

**Ele não tem caixa de botão** (`.settings-btn`, não `.ctl-btn`): a fatia do topo
acompanha a altura de `.nowplaying`, bem menor que a da preview, e um bloco
achatado ao lado de quatro botões de altura cheia lê como botão mal encaixado.
Mesmo tratamento do `#backBtn`: navegação/acesso é chapado, operação é botão — e
o histórico é acesso, não operação.

#### O histórico do culto (`#histPopup`, v1.2.0)

Pedido do operador: *"crie um botão de histórico, que lista todos os itens que já
tocaram naquela sessão. deve ser uma lista tipo a do cronograma, mas sem opções
de exclusão, mas com opções de enviar para o cronograma. essa lista deve ter a
hora de cada apresentação de cada item e deve ser apagada a cada nova sessão do
app"*.

Ele responde a pergunta que **nenhuma outra lista do app responde**: o Cronograma
é o que se PRETENDE tocar e a playlist é o que vem A SEGUIR — as duas voláteis
por natureza, já que um toque numa mídia da Biblioteca redefine a fila inteira.
*"O que eu já toquei hoje?"* não tinha onde ser feita.

- **Quem registra é o `send`**, o ponto por onde TODOS os caminhos passam (o
  toque na lista, o avanço automático da fila, o ⏮/⏭ do transporte, a notificação
  nativa, o roteiro) — o mesmo argumento do `diagC` que está na linha ao lado.
- **A linha guarda CÓPIAS do nome e do subtítulo**, não um ponteiro: a prateleira
  `avulsos` tem teto de três e o coletor recolhe os bytes de quem sai da última
  lista, então um item pode deixar de existir entre tocar e ser consultado.
  Guardar só o id daria uma lista de linhas em branco no fim de um culto normal.
- **A repetição CONSECUTIVA colapsa** (`×3`), atualizando a hora em vez de abrir
  linha nova: `repeat: 'one'` reenvia o mesmo id a cada fim de faixa, e um louvor
  deixado em laço durante a oração enterraria o culto inteiro em cópias do mesmo
  nome. Alternar entre dois itens abre linha nova — o colapso é da repetição
  consecutiva, nunca do item.
- **Sem excluir e sem reordenar.** Um registro do que JÁ aconteceu não se
  edita, e um destrutivo aqui apagaria o registro sem apagar nada do aparelho.
- **O TOQUE NA LINHA PROJETA** (v1.2.3, pedido do operador: *"pode fazer o item
  do histórico ser executável diretamente no toque"*). A v1.2.0 tinha recusado
  isto — o argumento era que uma lista consultada durante o culto não podia
  mandar coisa ao telão por um toque de rolagem —, e ele **não se sustenta**: um
  `click` não sai de um gesto que rolou a lista (o navegador o cancela), que é a
  mesma proteção sob a qual a folha da playlist já projeta desde sempre. O que
  sobra é a razão de o histórico existir: repetir um louvor que entrou de
  improviso e não ficou guardado em lista nenhuma, sem cobrar uma linha
  permanente no Cronograma por uma repetição.

  Por `projetarItem`, e não um `send` cru: é a mesma porta do toque numa linha da
  Biblioteca, e é ela que distingue CENA de MÍDIA. **E a folha FECHA** — ela cobre
  a preview e o transporte, que é onde a resposta ao toque aparece; projetar por
  trás dela seria o operador tocando e não vendo nada acontecer. O botão "Ao
  Cronograma" tem `stopPropagation` pelo motivo espelhado: guardar um item não é
  mandá-lo ao ar.
- **A linha do item que saiu do aparelho FICA**, esmaecida, dizendo "Não está
  mais no aparelho" e sem botão: apagá-la apagaria o fato. A conferência acontece
  DEPOIS do desenho (a folha abre com a lista já na tela) e outra vez no TOQUE,
  porque o coletor roda em toda remoção de lista — sem a segunda, o Cronograma
  ganharia uma linha órfã que não abre nada.
- **Em memória, e é isso que "apagada a cada nova sessão" significa aqui:** a
  mesma escolha (e o mesmo modo de falhar) do `diarioC`, o outro artefato que
  responde *"o que aconteceu neste culto?"*. Uma sessão é uma carga do documento
  — minimizar não zera, fechar e reabrir zera. O preço está dito: uma morte do
  renderer leva o histórico junto, como já leva a linha do tempo do Registro.

Oráculo: `tools/historico.test.mjs`.

**Fonte única do volume (`applyVolume`)**: o fader, o arrasto vertical no terço
direito da preview em tela cheia e os **botões físicos** passam pela mesma função
— clamp, desligar o mudo se subir de 0, enviar o comando, atualizar o fader.

**Botões físicos** (só no app; `window.__avVolumeKey`): a Activity intercepta
`KEYCODE_VOLUME_UP/DOWN` e entrega o passo aqui, porque o sistema os roteia para
a **saída em uso** — com Smart View ativo isso vira o volume da TV. **No máximo
(ou no zero)** o passo é devolvido ao sistema (`AVNative.systemVolume`), senão um
aparelho com o volume de mídia baixo ficaria sem como subir com o app aberto.

**A tecla ESPIA o fader** (`peekVolume`, `VOL_PEEK_MS` = 2,8 s): sem isso o botão
físico mexia no volume de forma INVISÍVEL. Ela abre a MESMA visualização do toque
em `#volToggle` (literalmente `openVolume()`) e a recolhe sozinha. Três regras de
convivência com o toque: só recolhe o que ela mesma abriu (`volPeekOwned`); tocar
em `#volToggle`/`#volClose` cancela a contagem (`cancelVolPeek`); mexer no fader
durante a espiada a reinicia (`bumpVolPeek`).

Tocar no botão de volume liga `.vol-open` no `#mixer`, que troca **top + mid**
pelo **fader vertical** (`.fader-wrap`, `grid-row: 1 / 3` — exatamente o espaço
de top+mid) mais um `#volClose` na fatia de baixo. O botão da base **não muda de
lugar** entre os dois estados, só de ícone e cor; quem anima é o que está ACIMA
dele. É só estado de UI, não persistido. As durações no JS
(`openVolume`/`closeVolume`) casam com as do CSS (`@keyframes vol-slide-in/out`).

**O fader tem a LARGURA DOS BOTÕES que ele substitui**: a coluna não muda de
espessura ao abrir o volume, só de conteúdo. Isso exige desenhar o trilho
(`appearance: none` + `::-webkit-slider-runnable-track`), porque a espessura do
trilho NATIVO é fixa — alargar o `<input>` sozinho só deixa a barrinha de sempre
boiando num alvo maior (verificado).

Como `appearance: none` desliga junto o preenchimento do `accent-color`, ele é um
gradiente com o corte em `--vol` (0–1), escrito por `renderControls()` no mesmo
ponto em que o valor do fader é sincronizado — um lugar só, e os dois nunca
discordam. O corte NÃO é `--vol * 100%` puro: o CENTRO do cap percorre a altura
MENOS a espessura dele (`--fader-cap`, 26px), então a conta desconta isso e a
borda do preenchimento fica exatamente sob o cap em qualquer posição.

**O cap carrega o NÚMERO (0–100)** (`#volValue`): saber que o fader está "mais ou
menos na metade" não é saber que está em 50 — e com os botões físicos o valor
muda sem ninguém tocar na barra. O número é IRMÃO do `<input>`, não filho
(`::-webkit-slider-thumb` é pseudo-elemento e não aceita conteúdo), então ele
repete a MESMA conta de posição, com `--vol` e `--fader-cap` declaradas no
`.fader-wrap` (o ancestral comum). `pointer-events: none`: quem recebe o arrasto
continua sendo o input por baixo.

**A linha da preview é só a preview**, e a partir da v1.3.5 ela é FLANQUEADA de
novo — mas por fora, em colunas da grade, e não dentro da linha. `--deck-pv-h`
seguiu em 150px: a preview é dimensionada pela ALTURA (altura × `--pv-ar`) com
`max-width: 100%`, então ela encolhe sozinha para caber na coluna do meio. O
botão de **repetir** (`#repeat`) é o primeiro de `.transport`, com o de playlist
por último.

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
| **coluna da tela cheia** (`#fsPrev`/`#fsNext`) | sem TV a preview em tela cheia É a projeção, e tudo o que se pinta ali a congregação vê — não cabe um par a mais |
| **notificação nativa** | o eixo é dito no RÓTULO do botão (`slideMode`/`slideLabel` em `pushNowPlaying`); ali cabe rótulo, então o modo nunca precisa ser adivinhado |

### Os dois botões de slide

| Botão | Onde |
|---|---|
| `#slidePrevBtn` | `.slide-side`, a coluna 1 da grade — à esquerda da preview |
| `#slideNextBtn` | `.mixer-mid`, a fatia que os três controles de operação deixaram vaga |

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
- **A ALTURA DELES É A DA PREVIEW, MEDIDA** (`--pv-alt`, escrita por
  `medirAlturaPreview` a partir de um `ResizeObserver`). Eles nasceram vestindo
  a FAIXA da grade, e a faixa não é a preview: `--deck-pv-h` é fixa, mas a
  miniatura dentro dela é dimensionada pela proporção do telão com
  `max-width: 100%` — numa tela estreita, ou com uma TV muito larga, ela encolhe
  e sobra faixa dos dois lados. MEDIDO: em 360px com uma TV 2,17:1, preview de
  95px ao lado de botões de 150, com 27px de folga em cima e embaixo de cada um.
  - **Por medição e não por CSS**, porque a conta é circular: a altura da
    preview sai da LARGURA da coluna do meio, que sai da grade — uma coluna irmã
    não tem como derivá-la. O observador cobre de graça tudo o que a muda:
    girar o aparelho, o `--pv-ar` reescrito quando a TV conecta, o tamanho de
    fonte do sistema.
  - **Nada é escrito com a preview FORA DE CASA** — em tela cheia ela mede a
    tela inteira, e no Modo Fácil ela muda de pai (`hostPreview`). Nos dois
    casos o valor guardado é o último bom, que é o que vale quando ela voltar. O
    CSS ainda assim trava o botão na faixa (`min(var(--pv-alt), 100%)`).
  - **A regra do par mede 0,3,0 de propósito.** `.mixer-slot .ctl-btn
    { flex: 1 }` mora 600 linhas abaixo e empata em 0,2,0 com um
    `.mixer-slot .slide-btn` — e num empate vence a última regra do arquivo.
    MEDIDO: a esquerda vestindo a preview e a direita ainda com a faixa
    inteira, gêmeos de alturas diferentes e nada no console. E `flex: 1` não é
    contornável por `height`: num contêiner de coluna o `flex-basis` É o tamanho
    principal, então a altura declarada some em silêncio.
- **O fim do caminho é o `disabled` de sempre** — o esmaecido que a v5.49 tinha
  trocado pelo `.axis-end`, e que voltou a valer quando o botão passou a ter um
  significado só.
- **Com o fader do volume aberto o PAR some junto.** O fader ocupa top+mid, e a
  fatia do meio é o `#slideNextBtn`; uma dupla em que só a metade da esquerda
  sobrevive é pior que dupla nenhuma — o operador toca em "voltar" e procura o
  "passar" que não está lá. `openVolume`/`closeVolume` escrevem `vol-open`
  também no `.deck`, e `.deck.vol-open .slide-side` esconde o gêmeo.

Oráculo: **`tools/controles-layout.test.mjs`** — a geometria (quem flanqueia
quem, e com que caixa), o eixo do transporte medido pelo COMANDO que sai no
barramento (`seek` é estrofe andando, e ele não pode mais sair de `#next`) e o
par sumindo junto com o fader. Provado por reversão.

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

**Controles sobre a preview** (`.pv-fabs`, `setupPreviewGestures`): **três
grupos**, todos só-ícone, sem moldura, com a mesma `drop-shadow` tripla no traço
(ver "Layout de player", abaixo). Cada botão ocupa uma caixa de `--hit`, e o
tamanho do ícone vem do CSS (`24px`), não do atributo do `<svg>`.

| Grupo | Onde | O quê | Pergunta que ele responde |
|---|---|---|---|
| `.pv-fabs` | coluna DIREITA | cast em cima, tela cheia embaixo | *para onde eu mando isto?* |
| `.pv-fabs--esq` | coluna ESQUERDA (v1.3.5) | letra → cortina → mudo | *como eu opero a cena?* |
| `.pv-fabs--topo` | topo, AO CENTRO (v1.3.5) | o selo de camadas (`#pvCamadaBtn`) | *o que está no ar por cima do quê?* |

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
- **Eles NÃO aparecem no Modo Fácil.** A preview é UM nó só e MUDA DE CASA
  (`hostPreview`), então tudo o que se pendura nela viaja junto; lá o mudo já é
  uma tecla grande própria (`#simpleMute`) e o resto do modo existe para não ter
  controles. Quem os esconde é `.simple-stage .pv-fabs--esq`. **O selo de
  camadas fica** — ele é a única saída da camada de cima, e não há gêmeo dele
  lá.

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

##### O selo de camadas foi para o topo ao centro (v1.3.5)

Ele ocupava o canto superior esquerdo, e aquela lateral virou a coluna de
operação: no alto daquela pilha, um selo vermelho leria como mais um controle
dela — que é exatamente o que ele não é (os três operam a cena; este DIZ um
estado dela). No centro ele não faz coluna com ninguém, e aparecer já é metade
da mensagem.

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
`#settingsBtn` no cabeçalho da tela) guarda o **modo do app** (`#appModeSeg`), a
o seletor de **preenchimento da mídia**
(`#fitSeg` — Ajustar/Preencher/Esticar, ver `stage.setFit()`), as **imagens dos
slides** das músicas (`#lyricsBgSeg` — Mostrar/Remover, ver "Fundo preto vs.
imagens dos slides"), o **wallpaper do telão** e, no rodapé, o **estado do
telão**, o alvo de espelhamento e a **versão**. Chamava-se "Exibição" enquanto
guardava só como o telão se PARECE; com a mesa de som vinda do mixer, o que
reúne as linhas passou a ser "o que se decide uma vez, ao montar o culto" —
aparência do telão E roteamento do áudio. Nenhuma delas se opera durante o
culto, que é o critério de estar aqui e não na coluna do mixer. O `id` segue
`fadePopup` por herança (os controles de fade que lhe deram o nome saíram há
versões): renomeá-lo tocaria dezenas de referências sem mudar nada visível. As
transições (fade) **não têm controle ali** — são inerentes ao sistema (ver o
state `fade`).

#### Os controles DENTRO do fullscreen: uma coluna, não gestos (v1.0.7)

**Uma coluna de ícones na lateral direita** (`#pvFsCtl`), que o toque acende e
**4 s sem toque apagam** (`FSCTL_MS`), translúcida enquanto está no ar.

Ela substituiu um mapa de **gestos invisíveis** — toque por terço, deslizes nos
quatro sentidos, arrasto de volume no terço direito. O motivo daquele desenho era
bom e continua valendo: sem TV conectada, **a preview em tela cheia É a
projeção**, e tudo o que se pinta aqui a congregação vê. O que ele não tinha era
como se anunciar: quem não decorasse o mapa não tinha como descobri-lo, e um
toque no lugar errado fazia outra coisa em cima do culto.

A coluna preserva a razão e paga o preço de outro jeito: **passageira** (só ao
toque, some sozinha) e **translúcida** (`.72`).

| Botão | Ação | Como |
|---|---|---|
| Sair | fecha a tela cheia | `exitFullscreen()` |
| Cortina | wallpaper on/off | `viewToggleEl.click()` |
| ⏮ | estrofe anterior · **segurar**: mídia anterior | `attachTransportStep(btn, -1)` |
| ▶/⏸ | play/pause | `playPauseEl.click()` |
| ⏭ | próxima estrofe · **segurar**: próxima mídia | `attachTransportStep(btn, 1)` |

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

**Apagada, ela é `pointer-events: none`** — sem isso, uma coluna invisível
continuaria comendo os toques da metade direita da projeção.

**Ela OCUPA A ALTURA INTEIRA** (v1.1.2), com os cinco botões distribuídos por
`space-between`. Centrada, eram um bloco denso no meio de uma tela em PAISAGEM:
os ícones a 2px um do outro e metade da lateral sem uso. Com a altura toda,
**o vão entre dois vizinhos passa a ser MAIOR que o próprio botão** (medido em
800×390: alvo de 40px, vão de ~42px), e num alvo que se opera sem olhar (quem
está em tela cheia olha a projeção) esse vão é a única coisa que separa um
controle do seguinte. O alvo sobe de `--hit` (34px) para **40px** e o ícone de
24px para **28px**: aqui o aparelho está no suporte e o toque é de raspão, ao
contrário dos `.pv-fab` dos cantos.

**A folga das três bordas é de 10px** (v1.1.3), e ela **não** acompanha os 2px
dos `.pv-fabs` dos cantos: aqueles moram numa miniatura de poucos centímetros,
onde 2px a mais custam mídia visível; aqui a tela inteira é a projeção e o que
sobra é espaço. Encostado na borda, o alvo divide lugar com a moldura
arredondada do aparelho e — em paisagem — com o recorte da câmera numa das
laterais.

**Errar o alvo custa um toque, nunca uma ação errada:** acesa, a coluna é
`pointer-events: auto` inteira, então o dedo que cai num vão morre nela em vez de
atravessar para a projeção — e o `pointerdown` que borbulha até a `.preview`
ainda renova os 4 s.

**SVG e não `.msym`:** a fonte é um subset de 31 codepoints, e o `.pv-fab`
pendura três `drop-shadow` no TRAÇO do SVG — é o que mantém o ícone legível
sobre um slide branco. Um glifo perderia a sombra e o contraste junto.

A config de
preenchimento é persistida em `state.fit`, aplicada ao vivo via comando (`fit`,
Display + preview) e recarregada do state ao inicializar. A de fade **não
existe mais**: é fixa e compartilhada (`createStage.FADE`), sem state nem
comando (ver a chave legada `fade`).

### Wallpaper personalizado

A cortina do telão aceita uma **imagem escolhida pelo operador** no lugar do
desenho padrão — em **Configurações** (a engrenagem do cabeçalho):
*Padrão* / *Escolher imagem* (nessa ordem desde a v5.188: o estado de partida
à esquerda, a ação à direita, como nos demais segmentados).

- **O PADRÃO é o símbolo oficial da IASD** (v5.188): branco, cor sólida única,
  centrado sobre um denim profundo quase-preto — as regras do
  identity.adventist.org (uma cor só, fundo contrastante, espaço livre maior
  que a altura do símbolo). O desenho inteiro mora em
  **`shared/wallpaper-padrao.svg`**, fonte ÚNICA usada pelo `.wallpaper` do
  Display, pelo `.pv-wall` da preview e pelas telas da rede (o bundle servido
  inclui `shared/`). A URL do SVG fica **nas duas folhas consumidoras**, com o
  mesmo caminho relativo — não no token `--wallpaper`, porque um `url()`
  substituído por `var()` resolve contra a PÁGINA, não contra a folha, e cada
  página o quebraria para um caminho diferente (foi o primeiro defeito da
  própria v5.188). O token guarda só a cor de base que aparece enquanto o SVG
  carrega. A marca de TEXTO "Audio Visual IASD"
  (`.wallpaper-brand`/`.pv-brand`) saiu com o gradiente verde: o símbolo é a
  identidade, e um texto por cima só competiria. (E a lição que o SVG carrega
  no próprio comentário: comentário de XML não aceita hífen duplo — um
  `--token` citado ali dentro invalida o arquivo INTEIRO, sem erro em lugar
  nenhum, só um fundo liso.)
- O blob mora no **state `wallpaper`**, que Controle e Display compartilham,
  então o comando `wallpaper` **não carrega payload**: só avisa que mudou, e
  cada lado relê do IDB. (Mandar a imagem pelo canal seria copiar megabytes a
  cada troca, sem ganho nenhum.) **Exceção: as telas da rede** não têm esse
  IDB — para elas o funil `telaEnriquecer` resolve o blob e manda um SEGUNDO
  comando com `__wp` (a URL `/m/` da imagem empurrada), ou o sentinela
  `__wp:'padrao'` quando a troca foi de volta ao padrão; e quem CONECTA no
  meio recebe o wallpaper endereçado no próprio `display-ready`
  (`telaReenviarPreferencias`, junto com `lyricsbg` e `fit`).
- A imagem é **reduzida para no máximo 1920×1080** (`fitWallpaperImage`) antes
  de ser guardada. O operador escolhe uma foto do próprio celular (12 MP);
  guardar e decodificar isso a cada abertura seria desperdício puro — a
  cortina nunca passa da resolução da TV. Imagens que já cabem são guardadas
  como vieram, sem recompressão.
- CSS: a imagem entra como `background-image` inline (vence o
  `background-image` do SVG padrão na folha) com `background-size: cover` —
  limpar o inline devolve o desenho padrão. Aplicado em `restore()` (Display)
  e no `init()` (Controle), além do comando ao vivo.

**Botão ⏹ ("Parar e limpar"):** envia `clear` (volta ao wallpaper) mas mantém
`currentId` — o ▶ recarrega e reproduz do início.

**Botão de playlist (`#plBtn`):** mora na própria linha de transporte
(`.transport`), à direita do botão de repetição — não é mais uma aba
separada (`.tabs`); abre o mesmo bottom-sheet com a fila de reprodução de
sempre. Reaproveita o tamanho/estilo de `.t-btn` (a linha de transporte
cresceu de 5 para 6 botões, cada um um pouco mais estreito). O badge de
contagem (`#plCount`) só aparece a partir do **2º item** (mostra
`count - 1`), e o ícone só fica destacado em `--accent` (`.has-items`) nesse mesmo
caso: com apenas a mídia atual em fila, a playlist é só a reprodução avulsa
e não deve chamar atenção nem com um "1" enganoso nem com o ícone colorido —
fica neutro (branco).

### Feedback (sem alerta flutuante) — e a exceção do salvamento

Não há mais **toast flutuante**. As informações são transmitidas pela própria
interface (estados de botão, contadores, listas). `flash()`/`dismissFlash()` em
`controle.js` viraram **no-ops** na remoção do toast e foram APAGADOS na v5.207,
com os três chamadores que ainda escreviam frases que ninguém via — e a armadilha
de um no-op com cara de canal já tinha cobrado o preço antes disso: as v5.136/v5.137 voltaram a usá-lo como
o ÚNICO aviso de fluxos novos (o desfecho de um share, a procura de OTA, a
sincronização de pastas), e essas mensagens simplesmente não apareciam. A
auditoria de agosto/2026 religou esses pontos ao `avisar()` (a faixa
`#saveHint`, ver abaixo): mensagem com conteúdo real fala por ali; o resto
segue sem toast.

#### O sinal nasce NO BOTÃO que foi tocado (v5.106)

O resultado de um salvamento é invisível justamente onde ele mais importa:
mandar algo ao Cronograma estando na Bíblia, favoritar de dentro do acervo,
guardar um preset das Ferramentas. O toque não produzia sinal nenhum e a única
forma de saber se funcionou era ir conferir — que é exatamente como se acaba
tocando duas vezes.

**O feedback é um pulso de 1,1 s no próprio botão** (`pulsar(btn, tipo)`), não
uma faixa no alto da tela. O motivo é o olhar: no instante do toque ele está no
botão, e é ali que a resposta tem de aparecer. Uma mensagem em outro canto exige
procurar o aviso, e num culto isso não acontece — o operador toca e segue.

```js
const PULSO_MS = 1100;
pulsar(btn, 'ok' | 'dup' | 'erro')   // → true se de fato pulsou
responder(btn, tipo, texto)          // pulsa; se o botão sumiu, avisa por texto
```

| `tipo` | Cor | Quando |
|---|---|---|
| `ok` | `--ok` | entrou |
| `dup` | `--warn` | **já estava lá** — é esta que impede o segundo toque |
| `erro` | `--danger` | não deu (sem rede, sem capítulo, item sumiu do acervo) |

Três detalhes que o mecanismo não pode dispensar:

- **`visivelNaTela(btn)` decide se o pulso VAI acontecer**, e `isConnected` não
  serve para isso: os bottom-sheets fecham por `opacity: 0`, o nó continua no
  documento. A pergunta certa é `offsetParent !== null` (nenhum ancestral em
  `display:none`) mais `!btn.closest('.popup-backdrop:not(.open)')` (a folha que
  o contém não está fechada). Pulsar um botão invisível é o mesmo que não dar
  feedback nenhum, e é por isso que `responder()` cai no texto nesse caso.
- **Quem re-renderiza a lista precisa ESPERAR o pulso.** `toggleFav` atualiza o
  próprio botão no lugar (classe `on`, `title`, `starSvg`) e adia o
  `renderLibrary` em `PULSO_MS` — chamar o render na hora destruiria o nó que
  está pulsando e o sinal duraria um quadro. Mesmo padrão em `refreshDiversos`,
  `exitSelection` (via `sairDaSelecaoDepois()`) e `closePlPopup`: a folha só
  fecha depois de o operador ver a cor. (`closeFolderPicker` era o quarto e saiu
  na v5.254, com as pastas virtuais e a folha de duas origens.)
- **As regras do pulso ficam no FIM de `controle.css`.** `.btn-pulso--ok` tem a
  mesma especificidade de `.row-btn`/`.sel-btn` (0-1-0), então quem decide é a
  ordem. Declaradas antes, elas simplesmente não pintam nada.

**Todo destino passa por `adicionarNaLista(lista, id, nome, btn)`**, que faz o
`listHas` antes do `listAdd` e escolhe entre `ok` e `dup`. Operações em lote
(seleção múltipla, pasta) resolvem o tipo em `tipoLote`/`textoLote` — um pulso
só na barra de seleção, em vez de quatro sinais piscando.

#### `avisar()`: o que sobra para o texto (v5.104)

`avisar(texto, tipo)` continua existindo, mas só onde o pulso não alcança, e o
que ele **não** é continua valendo: não é o toast de volta. Não flutua sobre os
controles (fica no TOPO da tela — a base é onde mora o transporte, e foi por
cobri-lo que o toast saiu), não pede toque para sair (`pointer-events: none`,
some em 2,4 s) e não é usado por nada que já tenha estado próprio na tela.

Dois casos, e só eles:

1. **O botão sumiu** antes de a resposta chegar (a folha fechou, a lista
   re-renderizou) — `responder()` detecta e cai no texto.
2. **O motivo não cabe num botão.** Guardar um pacote com menos de dois itens
   pulsa em vermelho **e** escreve "Monte a fila com dois ou mais itens antes de
   guardar": a cor diz que não deu, a frase diz por quê, e sem a frase o
   operador toca de novo esperando resultado diferente.

> **Armadilha do YouTube:** um vídeo baixado por `ytArquivo` **nasce na lista**
> (o `addMedia` lá dentro já recebe o destino), então perguntar `listHas`
> DEPOIS anunciaria todo download novo como "já estava lá". Em `ytAcao` a
> pergunta é feita ANTES, e só vale quando existe arquivo no aparelho — é esse
> o registro que será reaproveitado. As músicas do acervo não têm esse
> problema: elas vão para o catálogo `files`, não para uma lista.

#### Anti-duplicação (v5.104)

As listas são conjuntos de ids, então `listAdd` **já é idempotente para
mídia**: o mesmo vídeo não entra duas vezes na mesma lista, por construção. O
que não era idempotente é a **cena de roteiro** — cada uma cria um registro
novo, com id novo. Daí `cueChave(cue, data)`, a identidade de conteúdo de uma
cena (tipo + descritor), e duas regras diferentes por destino:

- **Favoritos não repetem.** Favoritar é marcar; dois "Salmo 23:1" na mesma
  gaveta são ruído puro e ninguém consegue distingui-los. O item existente é
  reaproveitado e o botão pulsa em `dup`.
- **O Cronograma PODE repetir.** O mesmo versículo pode ser lido na abertura e
  no apelo; a mesma contagem regressiva pode aparecer duas vezes. A duplicata é
  criada — mas o botão pulsa em `dup`, que é o que separa a repetição
  intencional do toque dado duas vezes.

A chave da MENSAGEM é só o `msgId`: o texto viaja no descritor como reserva
(para o roteiro não ficar mudo se ela for apagada), e compará-lo deixaria a
reserva decidir a identidade.
O único feedback migrado explicitamente para a UI é a **sincronização das
coleções**: `setCollStatus(id, text, autoClearMs?)` grava um subtítulo
no card da coleção (`renderCollectionCard`) — "Atualizando lista…", "Baixando N/T…",
"Já completo offline", "Sem internet — falha ao atualizar" etc. `autoClearMs`
limpa mensagens finais/erro sozinho; o progresso fica até a próxima chamada. O
`.toast` do CSS foi removido.

### Diálogo padrão do app (confirmações / prompts)

`confirm()`/`prompt()` **nativos foram substituídos** por um **modal no tema do
app** (`#appDialog`/`.dialog-*` no CSS + `openAppDialog`/`appConfirm`/`appPrompt`
em `controle.js`) — centralizado, com botão primário preenchido em `--accent-fill` e cancelar
neutro. É **assíncrono** (retorna uma Promise): `appConfirm({title, message,
okText, cancelText})` → `true`/`false`; `appPrompt({title, message, value,
placeholder, okText})` → string (OK) ou `null` (cancelar/fora/Esc). Um só
diálogo reutilizável (o DOM é estático no `index.html`); abrir um novo enquanto
outro está aberto resolve o anterior como cancelado. Usam isto: **renomear**,
excluir uma **pasta do aparelho** ou o que foi baixado de um **álbum** (as duas
apagam BYTES, e a frase é o que diz quantos), o aviso de "sem Wi-Fi" da
sincronização em massa, o cancelamento de um download em curso e a pergunta do
OTA.

**O QUE SAIU DELE NA v5.301: a exclusão de um ITEM de lista.** Ela vale para as
três (Cronograma, Favoritos e a fila da playlist) e agora pergunta na PRÓPRIA
LINHA — ver "A confirmação de excluir mora na linha", abaixo. A régua que ficou:
o modal é para o que **apaga bytes** e precisa dizer QUANTOS; sair de uma lista
se confirma onde a lista está.

### Deslocamento com o teclado virtual

Para o teclado não cobrir listas/preview: o meta viewport declara
`interactive-widget=resizes-content` (o navegador encolhe o layout ao abrir o
teclado). Como fallback (navegadores que não honram o hint), um handler de
**VisualViewport** (`keyboardShift()` em `controle.js`) mede a altura coberta
pelo teclado (`innerHeight - vv.height - vv.offsetTop`) e escreve em `--kb`, que
`body { height: calc(100svh - var(--kb)) }` (controle.css) usa para encolher o
app pra cima. Quando o layout já é redimensionado pelo navegador (ou o teclado
está fechado), a conta dá ~0 e nada muda — os dois mecanismos convivem.

### O que o telão retoma ao RECONECTAR (`midiaNoAr`, v5.142)

Quando o dongle cai e volta, o Android recria a `Presentation`, o WebView
recarrega `/display/` e dispara `display-ready` — e o Controle reenvia a cena
(`resendSceneToDisplay`). A pergunta que faltava era **o que** contava como
cena.

`currentId` **não é** "está no telão". Ele sobrevive de propósito a duas coisas,
e é isso que permite repetir a faixa com o ▶:

- **`stopClear`** — o operador cobriu o telão (o comando `clear` leva o Display
  de volta ao wallpaper), mas o item continua selecionado;
- **`resetAfterEnd`** — a música acabou e nada a seguiu (`repeat === 'off'`); o
  `stage` já voltou ao wallpaper sozinho pela bandeira `ended`.

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

### O preto de vários segundos da transmissão direta (v5.142)

Um stream leva segundos entre o comando e o primeiro quadro — init, índice e o
primeiro fragmento vêm da **rede**. Metade desse caso já estava resolvida: quando
a cena anterior era o wallpaper, a cortina fica de pé até haver quadro (o
`mediaReady` com `PRONTO_STREAM_MS` acontece **antes** do `coverOut`).

O que sobrava era a troca de **mídia para mídia**: ali o fade de saída já levou a
anterior ao preto e não há cortina para segurar — segundos de tela preta, sem
nada dizendo que o app está trabalhando. Do lado de quem opera isso é
indistinguível de uma projeção que morreu.

Agora um **giro** entra enquanto se espera (`mostrarEspera`), nos dois caminhos:
sobre o preto, e também sobre o wallpaper — porque ali o operador vê exatamente a
mesma tela de quando nada foi pedido, por vários segundos, depois de ter pedido
um vídeo. Detalhes que não são decoração:

- **Só no stream.** Um arquivo local vira quadro em milissegundos, e um spinner
  que pisca é pior que nenhum.
- **O nó é do MOTOR**, criado por ele no mesmo pai do `<video>`, com o
  `@keyframes` injetado uma vez — não está nos dois `index.html`, pela mesma
  razão que a cortina é compartilhada: duas cópias divergem no primeiro ajuste.
- **`resetMediaDom` o apaga**, então ele nunca sobrevive à cena que o acendeu
  (stop, clear e o começo de todo load passam por lá); e a ordem depois do
  `mediaReady` é conferir o `loadSeq` **antes** de esconder — um load mais novo
  já acendeu o giro dele, e apagá-lo depois de perder a corrida apagaria o
  spinner do load que assumiu.

### Girar a mídia (v5.142)

Vídeo gravado de lado no celular chega **deitado** no telão. Não havia o que
fazer: a mídia é do operador, reencodar no meio de um culto não existe, e "grave
de pé" não conserta um arquivo pronto.

- **Um botão que AVANÇA 90°**, em Configurações, e não quatro segmentos: ninguém
  pensa em "270°", pensa em "gira mais uma vez até ficar de pé", e são no máximo
  três toques até qualquer orientação. O rótulo mostra o ângulo vigente.
- **A caixa troca de eixo antes de girar** (`aplicarGiro` em `shared/stage.js`),
  e é isso que separa este código de um `transform: rotate()` solto: o `<video>`
  ocupa o palco inteiro (W×H) e o `object-fit` encaixa a mídia **nesse**
  retângulo. Girando só o transform, o encaixe teria sido calculado para o
  retângulo errado — um vídeo retrato girado para paisagem apareceria minúsculo
  no meio. Trocando `width`/`height` primeiro, a conta é feita no retângulo em
  que a mídia vai de fato aparecer.
- Por depender do TAMANHO do palco (que muda com a rotação do aparelho, a
  resolução da TV e a preview trocando de casa entre os modos), há um
  `ResizeObserver`; e `applyMedia()` o repõe, porque um elemento `hidden` não
  tem caixa medível.
- **Persistido** (`state.rotate`) como o preenchimento, e **reenviado ANTES do
  `load`** na reconexão: um telão que volta no meio de um vídeo girado não pode
  mostrá-lo deitado nem por um quadro.
- **Tomou o lugar do "Esticar"**, que saiu: distorcer a proporção é o defeito que
  "Ajustar" e "Preencher" existem para evitar, e ninguém o escolhia de propósito.
  O valor guardado é **migrado** uma vez na carga — sem isso, quem já o tinha
  ficaria com a mídia distorcida e sem nenhum controle na tela que explicasse por
  quê.

### O cast só era repintado no modo simplificado (v5.142)

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

Do lado nativo isto é **OTA puro**: nenhuma linha de Kotlin, `SHELL_VERSION`
intacto. O `AVNative.keepAudioAlive`, que a versão manual usava para o WebView
do Controle atravessar o segundo plano, **não voltou** — áudio audível já isenta
a página do estrangulamento (é o que a nota do `snoopDisplayStatus` no
`CLAUDE.md` descreve pelo avesso), e o `SessionService` mantém o processo vivo
enquanto houver cena.


### Leitura auxiliar (letra completa / capítulo inteiro)

O telão mostra **uma** estrofe (ou **um** versículo) por vez — o formato certo
para quem assiste, e o errado para quem opera: o operador precisa saber o que
vem depois, e a preview só espelha o que já está no ar. O botão do meio do
mixer (`#lyricsViewBtn`, folha com linhas) abre um bottom-sheet **com scroll**
(`#lyricsPopup`) com a íntegra do que está em cena.

- **Três fontes possíveis, nunca as três de uma vez**: a **letra** da música em
  cena (`currentItem.lyrics`, os mesmos slides que o Display projeta — o slide de
  capa vira a linha "Início"), o **capítulo** da leitura bíblica
  (`bibleSession.verses`, numerados como numa Bíblia impressa) e a **cifra**.
- **A BÍBLIA NO AR É EXCLUSIVA** (v1.1.11). Projetando, ela é a única fonte
  oferecida; fora do ar, ela não disputa com a música e volta só como RESERVA —
  quando não há letra nem cifra para mostrar. Com música em cena, portanto, as
  fontes são **Letra e Cifra**, e nada mais.

  A regra é sobre **projeção**, nunca sobre a sessão existir. O que ela resolve é
  concreto: com um louvor de fundo durante a leitura, as três coexistiam e o
  seletor virava três abas — mas quem lê a Bíblia em voz alta não vai consultar a
  cifra do louvor de fundo no mesmo minuto. A folha responde *"o que está em cena
  AGORA?"*, e com a Bíblia projetando a resposta é uma só.
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
- **A CIFRA é a ÚLTIMA da lista** (`lyricsViewSources`), e isso é a precedência
  inteira: sem escolha do operador, `lvActiveSource` devolve a primeira — e a que
  abre sozinha tem de ser a letra, que é o que quem opera o culto está lendo.
  Quem toca escolhe a cifra uma vez. Ela **não existe no navegador** (a busca
  precisa da ponte — CORS) e **nunca vai ao telão**: é para quem toca, e o que a
  congregação vê continua sendo a letra.

  Ela é lida **sob demanda** — com uma exceção: **o Hinário 2022 fica guardado no
  aparelho** (v1.1.28), baixado junto com o hinário, porque é o único acervo cujo
  endereço no site é deduzível do nome. Fora dele o cache é um `Map` que morre
  com o app. A busca começa quando a música **entra em cena** — não quando a aba
  abre (v1.1.17): assim a folha costuma estar pronta antes de alguém pedir por
  ela. Quem decide se cabe cifra para um item é `cifraCabe`, a MESMA função que
  a aba usa para se oferecer. **Ela é SÓ AUTOMÁTICA** (v1.3.3): houve uma busca à
  mão — lista de resultados, prévia e endereço fixado por música —, e ela saiu a
  pedido do operador. Achando a cifra errada, a saída é o link "Ver no Cifra
  Club"; não achando nenhuma, o que aparece é a frase do motivo. O desenho
  completo — as tentativas (o que está guardado no aparelho, catálogo,
  álbum-como-artista, artistas padrão, busca), os cinco motivos de falha, a transposição que preserva a
  COLUNA do acorde e por que o parser mora no web e não no Kotlin — está em
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

  A barra do topo da folha carrega **quatro** controles, e a ordem é a de uso:
  a rolagem automática e a velocidade (usadas durante a música inteira) antes do
  par de transposição (usado uma vez, antes dela). Os quatro são `.lv-fonte-btn`
  porque são o mesmo gesto — um passo por toque numa escada —, e duas aparências
  para o mesmo gesto seria ruído. O de velocidade é o único **não quadrado** da
  família: o rótulo dele é uma palavra (`Auto`), e o `min-width` guarda a largura
  do maior rótulo para o ciclo não empurrar os vizinhos a cada toque — um botão
  que se desloca sob o dedo erra o alvo na segunda batida.

  **A barra fica FORA da caixa que rola** (`#lyricsViewBar`, entre o seletor e o
  corpo, com o mesmo alinhamento horizontal dele): dentro, os controles rolavam
  com o texto e o pausar saía de cena em segundos. Ela existe só na cifra e é
  limpa em `renderLyricsView`, num ponto só.

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
  desta folha **e** na linha do nome do Modo Fácil — duas casas, um estado, o
  token `--lv-fonte`. *"Aproveite para criar dois botões de A+ e A− nestas seções
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
banco (o Cronograma é a lista `imports` desde antes de se chamar Cronograma). Ela
substituiu o `YT_LISTA`, uma SEGUNDA tabela com as mesmas três listas só para o
YouTube; duas divergiriam no primeiro destino acrescentado a uma só.

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
texto: 36px contra os 53px dos vizinhos. A correção é o MESMO número dito no
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

- **Combinado com um destino de guarda, a transmissão direta fica de fora:** ela
  não produz arquivo (é um manifesto que expira em horas), e quem marcou
  "Cronograma" pediu justamente o que sobra depois do domingo.
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

#### A faixa de abas

Ela fica **no alto da caixa de controles** (`.bottombar`) e são **abas de
verdade**: uma fileira SEM trilho, encostada na borda de cima da caixa e indo de
borda a borda (`margin: 0 -.7rem`, que desfaz o padding lateral dela). Quatro
alvos idênticos — **Cronograma** · **Bíblia** · **Ferramentas** (as `.tab`) e o
**acervo** (`#hymnSearchBtn`, `.tab-add`) —, todos `flex: 1` e `--hit-nav` de
altura, transparentes enquanto não escolhidos.

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
- **Ferramentas** (`activeTab` segue sendo `'mic'`, por herança) — Mensagens,
  Tempo e Sorteio num seletor no topo, mais o rodapé com microfone e "Projetar no
  telão". O `data-tab` e `renderDiversos`/`refreshDiversos` mantêm os nomes
  antigos de propósito: renomeá-los não muda nada visível e esbarraria em
  `TAB_ORDER`, `scrollKey()` e nas guardas espalhadas que falam essas strings.
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

#### O contrato do `shouldInterceptRequest`, e a transmissão direta

**O `InputStream` devolvido não é "a resposta": o Chromium o lê como o recurso
INTEIRO a partir do byte 0, e é ELE quem aplica o `Range`** — incondicionalmente,
para toda resposta interceptada. A cadeia, na fonte:

```
AndroidStreamReaderURLLoader::Start           → ParseRange(resource_request_.headers)  ← incondicional
AndroidStreamReaderURLLoader::OnInputStreamOpened → InputStreamReader::Seek(byte_range_)
InputStreamReader::Seek                       → VerifyRequestedRange + SkipToRequestedRange
net::HttpByteRange::ComputeBounds             → confere contra InputStream.available()
```

Devolver só a fatia pedida aplica o deslocamento **duas vezes**:

| faixa pedida | o que acontece |
|---|---|
| `bytes=0-…` | pular 0 é no-op → **funciona**, e esconde o resto atrás de si |
| `A ≥ tamanho da fatia` | `ComputeBounds` reprova → `ERR_FAILED` **antes de qualquer cabeçalho** |
| `A < tamanho da fatia` | pula `A` DENTRO da fatia e entrega o offset absoluto `2A` — o `fetch` RESOLVE e o vídeo não toca |

Como todo fragmento de mídia começa a megabytes do início, **só a primeira
requisição de cada faixa podia funcionar**.

**A correção é sair do contrato, não emulá-lo.** Do shell 27 em diante o
`shared/mse.js` pede `/stream/<token>?r=<ini>-<fim>` **sem cabeçalho `Range`
nenhum**: sem cabeçalho, `ParseRange` não acha nada, o seek não acontece, e a
fatia chega inteira. A resposta é um **200 seco** — sem 206, sem
`Content-Range`, sem `Accept-Ranges`, e sem `Content-Length` nosso (o loader
escreve o dele a partir do `available()`).

- **`FatiaComoTodo`** atende o ramo do cabeçalho (bundle antigo em shell novo):
  soma o prefixo que não existe no `available()`, absorve o primeiro `skip` e
  zera o fantasma na primeira leitura real — a maquinaria do WebView produz o
  resultado certo, e se um dia ela deixar de refatiar, a fatia sai crua e
  correta.
- **Erro precisa de corpo NÃO VAZIO.** Com `available() == 0` e faixa fora do
  zero, `ComputeBounds` reprova e a resposta inteira vira erro de rede sem
  status: **toda a tabela de mensagens abaixo é indeliverável** para qualquer
  requisição que não seja a primeira.
- **E a razão é saneada para ASCII:** `WebResourceResponse` lança
  `IllegalArgumentException` para qualquer caractere fora de `0x20..0x7E` —
  `IOException("pedaço acima de 24 MB")` tem cedilha, e estourar o teto produzia
  uma segunda exceção de dentro do `catch` em vez de um 502 legível.
- **O teto de 24 MB é TRAVA, não economia:** existe para o dia em que alguém
  apontar este proxy para uma faixa aberta e um vídeo inteiro tentar caber na
  memória do processo que hospeda os dois WebViews e a `Presentation`. O custo
  normal é a memória de UM pedaço (init: centenas de bytes; índice: poucos kB;
  um fragmento por vez).

`tools/webview-range.test.mjs` **transcreve** a regra do Chromium (com
`arquivo:função` de cada trecho) e roda os dois modelos de `InputStream` contra
ela, sobre um recurso em que o byte `i` vale `i % 251` — primo de propósito: um
deslocamento errado sai como **bytes errados**, não como tamanho errado, que é o
único jeito de enxergar a corrupção silenciosa do terceiro ramo. Se o Chromium
mudar essa regra, o lugar de descobrir é o CI, não o culto.

> **O caminho FELIZ não é testável aqui** (exige um fMP4 de verdade, e não há
> ffmpeg no ambiente). O que se trava é o contrato, dos dois lados:
> `webview-range` prova a REGRA e `mse.test.mjs` prova o que sai pelo FIO (a
> faixa na URL, sem cabeçalho).

##### O pôster padrão do WebView

Um `<video>` sem `poster` é pintado pelo WebView com **um retângulo cinza e um
play preto gigante** (contrato de `WebChromeClient.getDefaultVideoPoster`) — não
há como estilizá-lo, só como deixar de pedi-lo. O `stage.js` já escondia o
elemento enquanto não havia `src`; com `MediaSource` o elemento entra em cena
vazio e só ganha quadro depois de init + índice + primeiro fragmento virem da
REDE — **"sem `src`" virou "sem dados"**. A correção é `POSTER_VAZIO` (1×1
transparente), posto a cada `load` e removido no `loadeddata`:

- **transparente e não preto** — as camadas já pintam `--stage-bg`, e um segundo
  "qual preto" divergiria da paleta;
- **removido no primeiro quadro** porque o *show poster flag* do HTML continua
  LIGADO num vídeo pausado que ainda não tocou.

##### As mensagens de falha SÃO o produto

Este recurso roda no aparelho do operador, num WebView, contra URLs que expiram:
**não há como depurar de fora**, e a única coisa que atravessa essa distância é a
linha do Registro. Ela só serve se disser em que passo morreu e com que resposta.

O que o `StreamProxy` responde:

| Resposta | Significa |
|---|---|
| `404 (token desconhecido)` | o proxy foi alcançado e não achou o token |
| `502 (<texto da exceção>)` | o proxy falhou falando com o CDN |
| `403 (googlevideo: Forbidden)` | o CDN recusou — o proxy chegou lá |
| `404` **sem** razão | o proxy NEM foi consultado (respondeu o asset loader) |

O que o player escreve (`AVStream.ultimoErro` → `falhou ao tocar: …`), com
passo + faixa + bytes pedidos + status:

| Mensagem | O que aconteceu |
|---|---|
| `init vídeo: HTTP 403 pedindo bytes 0-739` | o googlevideo recusou |
| `init vídeo: HTTP 404 …` | o **proxy não foi alcançado** |
| `init vídeo: a requisição não completou` | o `fetch` nem saiu |
| `init vídeo: resposta vazia (HTTP 206, pedidos 740 bytes)` | status bom e zero bytes — o mais traiçoeiro, porque o `appendBuffer` aceita sem reclamar e o vídeo nunca começa |
| `init vídeo: o decodificador recusou (…) — mime …` | os bytes vieram e o WebView não os quis |
| `índice vídeo: sidx não reconhecido (N bytes em …)` | o `indexRange` não continha um `sidx` |

Regras que sustentam isso:

- **`diagnostico` e `diagnosticoStream` são campos SEPARADOS.** `buscar()` começa
  com `diagnostico = resumo(info)`, e como a desistência da transmissão é
  justamente o que dispara o download, o motivo durava até a linha seguinte.
- **`porQueNaoDash` conta, por tipo de faixa, quantas passam em CADA
  pré-requisito** — `vídeo mp4 6 (init 6 · índice 0 · codec 6)`. "Não deu" não
  leva a lugar nenhum; essa linha responde de uma vez se o problema é o YouTube
  não mandar os byte-ranges, a biblioteca não preencher o codec, ou não haver
  faixa mp4.
- **`Faixa.dash` exige init + índice, e NÃO tamanho.** O `contentLength` do
  `ItagItem` nasce em `-1` quando o YouTube não informa, e quem diz onde cada
  fragmento começa é o `sidx` — a transmissão inteira já foi barrada por um campo
  que o player nem usa.
- **Codec recusado imprime as STRINGS testadas** (`video/mp4; codecs="avc1.640028"`)
  e o veredito de cada uma.
- **`PAUSA ESPONTÂNEA` não é vídeo travando**: um `<video>` sem dados emite
  `waiting`, não `pause`. O que emite `pause` é o `video.pause()` no topo do
  `load()` — isto é, mídia NOVA entrando.

`tools/mse.test.mjs` sobe um servidor de mentira, confere as mensagens que chegam
ao `onErro` e afirma que **nenhuma pode conter `undefined`** (a armadilha de
aridade: `node --check` não vê aridade, e uma refatoração deixou `pegar()` com
três parâmetros e três chamadas passando quatro). Ele roda com **VP9 + Opus**, e
não com o `avc1`+`aac` do aparelho: o Chromium do Playwright é o build
open-source e não traz codecs proprietários, então `addSourceBuffer` recusaria
`avc1` e todo cenário morreria antes do que se quer medir. Quem confere o suporte
REAL é o Registro do aparelho.

#### UM registro só

Um cabeçalho de **identificação** (versões da base, do shell e da ponte; estado
do telão; alvo de espelhamento; aparelho), **a linha do tempo** dos dois
processos em ordem de relógio, e só então os blocos de verificação por recurso
(extração do YouTube, cifra, transmissão direta, espelho, áudio, Séries,
sorteio). O cabeçalho existe por razão prática: um log colado sem contexto obriga
a primeira resposta a ser sempre a mesma pergunta.

**A POSIÇÃO DA LINHA DO TEMPO É O RECURSO** (v1.1.19). Ela era o ÚLTIMO bloco,
atrás dos sete de verificação — num Registro real começava na linha ~150, que é a
definição operacional de ENTERRADA. Ela responde *"o que aconteceu no culto?"*,
que é a pergunta que faz alguém copiar isto; os outros respondem *"por que ESTE
recurso se comportou assim?"*, que só se pergunta depois de saber o que
aconteceu. Ela é montada no primeiro `renderDiag` e só ganha as linhas do telão
no segundo, quando o `diag-ask` responde — a ORDEM dos blocos não muda entre os
dois. Oráculo: `registro.test.mjs`, medindo POSIÇÃO NO TEXTO (é o texto colado
que o operador manda, e é nele que "está no fim" quer dizer alguma coisa).

**O REGISTRO É SOBRE O CULTO, não sobre o catálogo** (v1.1.19). Ele responde a
quatro perguntas, e é por elas que se decide o que entra:

| pergunta | o que a responde |
|---|---|
| *o que eu toquei antes disso?* | `entrou em cena: <nome> ← fila`, `parou a mídia (<tipo>)` |
| *quando a conexão mudou?* | `TV conectada` · `TV DESCONECTADA` · `TV mudou` · `a projeção se reapresentou` · `transmissão RECUSADA: <frase do shell>` · `rede do celular: OFFLINE/online` |
| *o que quebrou?* | `ERRO DE MÍDIA` (preview **e** telão), `PAUSA ESPONTÂNEA` + o placar da retomada, `transmissão falhou no telão` |
| *quem eu sou?* | o cabeçalho, mais `app aberto · web vX · shell vY` como primeira linha do anel |

Uma varredura de catálogo (as **Séries**) responde a uma quinta pergunta, de quem
AJUSTA A REGRA meses depois. Ela cabe — resumida —, mas não pode empurrar as
outras quatro para baixo: medido num aparelho, o bloco nominal ocupou ~140 de
~170 linhas de uma cópia. Ver a seção das Séries no `CLAUDE.md`.

**AS TRANSIÇÕES, nunca o estado.** O cabeçalho já diz o que está conectado
AGORA; o que a linha do tempo acrescenta é QUANDO mudou — um dongle que oscila
rende uma escada de linhas que É o diagnóstico. Por isso `renderDisplayStatus`
compara com `lastDisplays` **antes** de sobrescrevê-lo, e `ligarEspelho` só
carimba a RECUSA (um culto em que a transmissão sobe de primeira não produz linha
nenhuma).

**A LINHA DO TEMPO NÃO TRUNCA.** `diagLinhas` é o anel do celular
(`DIAG_MAX_C` = 200, porque 40 cobriam minutos e um culto dura duas horas) mais
as 60 linhas que o telão manda no `diag-dump`: até 100 já estão na mão quando
`eventosDiag` roda, e o `.slice(-16)` jogava fora até 84 — **incluindo as que o
`diag-ask` acabara de ir buscar pela rede**. O teto existia para não estourar um
visor que não existe mais (ver abaixo), e comprimento não custa tela nenhuma. O
que encurta sem apagar é o **colapso da repetição CONSECUTIVA** (`visibilidade
×7`): sete iguais não dizem mais que a contagem. Ele exige `t2 == null` nos dois
lados — duas linhas com posições diferentes não são a mesma linha.

- **Copia-se o registro MONTADO, nunca o visível.** `diagTexto` é a ÚNICA fonte —
  não existe mais visor (`#diagBox` saiu na v5.207: 240 px empurrando para fora
  da tela as linhas que o operador de fato ajusta, para exibir a 0,68 rem um log
  cujo consumidor é um humano A DISTÂNCIA). Um botão de copiar que lesse o DOM
  emudeceria por inteiro.
- **`renderDiag` é assíncrona e roda duas vezes ao abrir a folha** (uma com o que
  já se tem, outra quando a resposta do telão chega) — daí a **guarda de
  sequência**, mesmo padrão do `loadSeq` do stage: sem ela a primeira pode
  terminar depois da segunda e sobrescrevê-la com a linha do tempo SEM os eventos
  do telão, que é justamente o que se foi buscar.
- Se um dia voltar uma caixa de log: **`white-space: pre-wrap`, não `pre`** — a
  linha do YouTube tem centenas de caracteres e viraria rolagem horizontal.

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
| vídeo | `Vídeo · 1080p` |
| áudio | `Áudio · 4:32` |
| apresentação | `Apresentação · 12 páginas` |
| item de player | `YouTube` — isto é, **depende da rede durante o culto** |
| item de URL | `Link externo` |
| cena de roteiro | o subtipo (`Versículo`, `Mensagem`, `Cronômetro`…) |

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
`padding-bottom` da barra e volta a área segura no `padding-bottom` da FOLHA:
quem termina a folha é a lista, e sem ela o último item fica sob a barra de
gestos. O ✕ é QUADRADO por um número com nome (`--campo-alt`): dentro de um flex
o `aspect-ratio` não resolve, porque a largura é resolvida ANTES de o `stretch`
dar uma altura definida (a primeira versão colapsou o botão em 20px).

**O TECLADO SOBREPÕE**: `.popup-backdrop` é `inset: 0`, sem `--kb` e sem
`--vv-top`. As duas contas existiram enquanto a barra morava embaixo (para
encostar no teclado em vez de ficar atrás dele) e enquanto a camada precisava
seguir a viewport visual (para a barra do topo não sair pela borda); com a barra
no topo e o cabeçalho fora, quem rola é a LISTA e a folha inteira encolhendo e
subindo era só efeito colateral. **O `.dialog-backdrop` FICA com a conta**, e a
diferença é a razão dela: o `appPrompt` é um cartão CENTRADO com campo de texto,
e ali a metade de baixo é onde o teclado sobe.

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

**A seção NÃO tem tom próprio.** Ela não é uma coleção e só ela ocupa o vão — as
duas coisas são verdade e **nenhuma se lê como COR**: o nome no cabeçalho diz a
primeira e o vão reservado diz a segunda. O que a cor acrescentava era um QUARTO
tom numa escada de três. A classe `.coll-group--fav` fica e responde a duas
perguntas: quem ocupa o vão, e quem pinta os FILHOS como itens em vez de álbuns.

**E OS FILHOS DELA NÃO SÃO COMO OS DAS OUTRAS SEÇÕES:** numa coleção são ÁLBUNS,
aqui são ITENS — e sem regra própria a linha de favorito e o card de álbum
pintavam **1,00:1**, a mesma cor literalmente.

```
 seção (--panel)                    seção (--panel)
   └ card do álbum (--panel-2)        ├ placa dos itens (--panel-2)
       └ faixa: RECESSO ─────────┐    │   └ favorito: RECESSO ─────┘
                                 └────┤        a MESMA cor, por construção
                                      └ pasta sincronizada (--panel-2)
                                          IRMÃ da placa: cor de ÁLBUM
```

A receita é a da faixa (`.coll-songs > .hymn-result`): um recesso (`--surface`,
que dentro de uma seção da Biblioteca é o par `sunk`) sobre uma base de nível de
card. **As duas metades são inseparáveis, e a segunda foi imposta pela medição:**
só o recesso, sobre o tom da SEÇÃO, resolve no escuro (1,58:1 contra o card) e
FALHA no claro, onde a seção é BRANCA e o recesso compõe `#dbdbdb`, a 1,02:1 do
card. Com a base de card por baixo a composição é a mesma da faixa:
`rgb(46,54,63)` no escuro, `rgb(182,188,194)` no claro, a 1,29:1 e 1,37:1.

**A PASTA SINCRONIZADA CONTINUA SENDO UM ÁLBUM** — ela guarda muitos arquivos, é
um CONTÊINER. Os dois níveis querem bases DIFERENTES e uma `<ul>` só não oferece
as duas: sobre o tom da seção o ITEM mede 1,03:1 (some), sobre a placa a PASTA
mede 1,00:1. Daí a **placa dos itens** (`.fav-itens`, criada em
`renderFolderList` e só quando há item), que PINTA `var(--camada)` e vira o
contêiner de nível 2 desta seção — o lugar que num hinário é do card de álbum.
Com ela o par volta a ser o MESMO do álbum, em dois elementos: `.hymnal-card`
pinta e `.coll-songs` zera o degrau seguinte. **As pastas não ganharam regra
nenhuma**: são filhas diretas do corpo, que já reserva `--panel-2` para os filhos
dele — a cor de álbum é o PADRÃO ali.

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
| **"Importar arquivos"** (`.import-row`) | `renderListFoot()` | aba Cronograma, fora de pasta, sem seleção |
| **barra de seleção múltipla** (`#selbar`) | `hostSelbar()` | seleção múltipla ligada |

Os dois vestem a MESMA caixa: é uma fatia só, com inquilinos diferentes.

O lugar de cada um foi decidido pelo que ele custa em outro: "Importar arquivos"
como último `<li>` do `<ul>` exigia rolar trinta itens para alcançar a ação mais
frequente da tela; a barra de seleção no lugar da faixa de ABAS mexia no que não
é da seleção e sumia com a navegação justamente quando o operador pode querer
sair da tela.

Três detalhes que o mecanismo exige:

- **Os dois medem `--hit-foot` (44px)**, e é por isso que a medida é token: com
  alturas diferentes a caixa da lista muda de tamanho ao entrar e sair da
  seleção, e a lista dá um pulo debaixo do dedo que estava segurando o item.
- **`renderListFoot()` reconstrói só o que é dela.** Um `innerHTML = ''` tiraria
  a `#selbar` do documento: o nó é UM só, movido entre hosts (o padrão do
  `<input type="file">`), e perdê-lo é perder os listeners.
- **Quem esconde o rodapé vazio é o JS, não um `:empty`.** A `#selbar` mora ali
  mesmo fora da seleção (escondida por `hidden`), então o rodapé nunca fica de
  fato vazio — e um filho de altura zero ainda consome o `gap` do `<main>`, que
  viraria uma faixa de ar acima da caixa de controles em toda aba sem rodapé. E
  a chamada é **antes** do desvio por aba em `renderLibrary()`: Bíblia e
  Ferramentas saem por `return`, e deixada para o fim ela desenhava o "Importar
  arquivos" embaixo da grade de livros da Bíblia.

O `<input type="file" multiple>` é o mesmo elemento de sempre (`#file`, com o
listener já registrado): ele mora solto no `index.html` e é MOVIDO para dentro do
`<label>` a cada render, porque descartar a linha antiga destruiria um input
criado ali.

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
  é cada scroller — `.lib-list`, `.misc-panel`, `.msg-list` (em Ferramentas a
  `.lib-list` é `overflow: hidden` e quem rola é o painel de dentro) e as
  `.bible-half`. Sem ela o navegador considera o gesto dele (`manipulation`,
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
- **A miniatura vira uma LIXEIRA** (`.row-lixo`), pelo mesmo mecanismo do "Tirar
  do ar": o conteúdo da capa é escondido por CSS e o desenho novo entra por cima,
  na mesma caixa. É a única parte da linha que a faixa não cobre, logo a única
  que ainda diz de QUAL item é a pergunta. Ele VENCE o `.row-stop` — uma linha no
  ar também pode ser excluída. A fila da playlist não tem miniatura, e o código
  cobre isso.
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
| `⋮` → 🗑 | **Excluir da lista.** É o PRIMEIRO botão da faixa desde a v5.289 — o mais longe do `⋮`, que fica colado na ponta direita e é o alvo tocado repetidamente (abre e fecha): errá-lo por alguns pixels caía no destrutivo. Do outro lado o vizinho é o VAZIO da caixa, que também fecha, mas é uma área larga em que ninguém mira a borda. Desde a v5.301 ele **pergunta na própria faixa**, e por isso não a fecha |
| `⋮` → ✏️ | **Renomear** o item, um toque (v5.288). Ele existia só para UM item de cada vez e atrás de quatro gestos (toque longo → seleção → botão do rodapé → diálogo). **Não entra na pasta do aparelho**, com a mesma guarda do excluir: ali o nome vem do arquivo, e um nome só no registro seria desfeito na varredura seguinte. O lápis é SVG inline — `edit` não está no subset da fonte, e codepoint ausente desenha um retângulo vazio |
| `⋮` → ♫+ | **A fila, com ESTADO** (v5.301, alternador desde a v5.302). Ele diz se o item **está** na playlist — `+` apagado em `--line`, `✓` aceso em `--accent` —, e o segundo toque TIRA. ACRESCENTA, nunca substitui: quem substitui é o toque no corpo da linha (`onTap` → `replacePlaylistWith`), e são ações opostas. **Não aparece numa cena de roteiro** — o `onTap` já desvia um cue para longe da fila (*"um versículo não é uma fila de reprodução"*), e o Cronograma é justamente a lista cheia de cues. **Não fecha a caixa**, como a estrela: o desfecho dele é o próprio botão mudando sob o dedo |
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
> **No rodapé ela veste a moldura TRACEJADA do "Importar arquivos"** (v5.108) —
> mesma linha pontilhada em `--accent`, mesmo raio, mesma caixa. As duas são a
> mesma fatia do rodapé com inquilinos diferentes, e o contorno é o que diz
> isso. Não recria o problema acima: o que fazia a barra parecer um item
> selecionado era o CONJUNTO "preenchimento âmbar + contorno sólido"; uma linha
> pontilhada sobre o fundo do corpo não se parece com item nenhum da lista — é
> a convenção que o app já usa para "espaço a preencher". Na gaveta dos
> Favoritos ela segue sem moldura: ali a folha já é a moldura.
>
> **E ela saiu da caixa de controles** (v5.107): mora no rodapé fixo da lista
> (`#listFoot`), na fatia do "Importar arquivos" — as abas não somem mais para
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

#### O rodapé da folha da playlist: guardar e LIMPAR (v5.309)

A folha `#plPopup` fecha com duas ações sobre a FILA, fora do `.popup-list`
rolável (numa fila de dez itens elas têm de continuar à vista): **"Guardar como
pacote no Cronograma"** (`#plPack`, ver "Como um item ENTRA no Cronograma") e
**"Limpar a playlist"** (`#plClear`), acrescentado a pedido do operador. Tirar
item a item era o único caminho, e uma fila de culto tem oito ou dez linhas —
cada uma com a própria pergunta.

- **A SEMÂNTICA é a do excluir de uma linha da fila**, não a de um excluir de
  acervo: `AVDB.listSet('playlist', () => [])`, sem `retirarDoAr` e sem
  `soltarAvulso`. O que está projetando segue projetando, e o que estiver no
  Cronograma, nos Favoritos, numa pasta ou no slot avulso segue inteiro — o
  `listSet` coleta só o que NENHUMA outra lista aponta, que é a mesma conta que
  o `listRemove` faz item a item. Limpar dez de uma vez é dez remoções, não uma
  operação nova. A forma com FUNÇÃO, nunca `listSet('playlist', [])`: ela roda
  dentro da transação que grava.
- **A pergunta é a mesma das listas** (`pedirConfirmacaoNaLinha`), e por isso o
  botão tem uma CAIXA só sua (`.pl-limpar-faixa`): o par substitui os IRMÃOS
  dele, e no rodapé inteiro levaria o "Guardar como pacote" junto. A altura mora
  na faixa, não nos dois conteúdos dela — o botão e o par têm receitas
  diferentes, e sem o número num lugar só a folha encolheria sob o dedo no exato
  instante em que o operador mira um destrutivo. `closePlPopup` **cancela**, como
  tudo que fecha uma gaveta.
- **Ele é a PORTA de um destrutivo, não a execução dele**, e veste o par discreto
  do "Tirar do ar" (`--surface` + `--danger-text`); o saturado
  (`--danger-soft` + `--danger-strong`) fica para o botão que de fato limpa. Dois
  vermelhos cheios empilhados anunciariam duas ações destrutivas onde há uma.
- **ACIMA do pacote**, e não abaixo: a folha abre pelo botão da barra de baixo,
  então o dedo chega pela borda inferior — a mesma régua que pôs o excluir no
  começo da fileira do `⋮` (v5.288).
- **Com a fila vazia a caixa inteira sai**: um botão que não faz nada é pior que
  botão nenhum, e um destrutivo inerte ensinaria que tocá-lo é inofensivo.

Medido de ponta a ponta em `tools/smoke.mjs` ("LIMPAR A FILA INTEIRA").

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
faixa, com o par Cancelar/Excluir no lugar dos botões e a miniatura virando
lixeira; (3) ela solta a prateleira invisível (`soltarAvulso`), que é a diferença
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
### Coleções de mídia (LouvorJA)

Integração com o catálogo público do app **LouvorJA** (`api.louvorja.com.br`,
mesmo backend usado pelo app `app-ja`), para trazer **todo o acervo** como fonte
de mídia offline, sem copiar nenhum código do app-ja (Vue/Vuex) — só o
**protocolo HTTP** dele é reaproveitado, via um cliente próprio e mínimo:
`controle/louvorja.js` (`window.Louvorja`, JS puro, sem dependências).

> 📄 **Referência completa da fonte de dados:**
> [`docs/FONTE-DE-DADOS-LOUVORJA.md`](docs/FONTE-DE-DADOS-LOUVORJA.md) documenta
> **toda** a estrutura técnica classificatória do banco compartilhado (endpoints,
> token, convenção de nomes dos arquivos `json_db` e o schema de cada tipo —
> `music_{id}`, `album_{id}`, listas de músicas/hinários/coletâneas/bíblia,
> `config`, servidor de arquivos). Consulte-o para pedir **qualquer** arquivo do
> sistema sem precisar abrir o repositório do `app-ja`.


- **`Louvorja.fetchList(file)`** — `GET {url-base}/{file}?{YYYYMMDD}` com
  header `Api-Token`, mesmo formato do `Database.js` do app-ja (URL de
  produção + token embutidos no arquivo — já públicos no bundle do app-ja,
  não é um segredo protegido).
- **`Louvorja.fileUrl(path)`** — resolve um campo de URL do banco (ex:
  `url_music`) para a URL completa de download do arquivo.
- Arquivos consumidos: as **listas** `pt_hymnal`/`pt_hymnal_1996` (hinários) e
  `pt_categories` (catálogo de álbuns → `album_{id}`); o **registro individual**
  `music_{id_music}` (com `url_music`, `url_instrumental_music`, `url_image`,
  letra). Constantes de conveniência: `Louvorja.HYMNAL_2022_FILE`,
  `HYMNAL_1996_FILE`, `CATEGORIES_FILE`.

#### As SEÇÕES TEMÁTICAS do Hinário 2022 (v1.1.12)

O hinário impresso tem 8 blocos e 35 seções — as 28 crenças fundamentais mais os
infantis e os litúrgicos — e o app passa a mostrá-las em dois lugares: um
**índice de temas** no topo do card e **títulos intercalados** na listagem.

**O BANCO NÃO TEM ESSE CAMPO.** `pt_hymnal` traz `id_music`, `track`, `name`,
`duration` e `has_instrumental_music`, e mais nada; `pt_categories` é
coletânea→álbum, não seção de hinário. O que identifica a seção de um hino é a
POSIÇÃO dele — exatamente como já acontecia com a faixa infantil do `sorteio.js`.
Daí a resposta ser uma TABELA DE FAIXAS (`controle/hinario.js`, pura, com
oráculo), transcrita do índice publicado pela CPB.

| peça | onde | o quê |
|---|---|---|
| a tabela | `controle/hinario.js` | 35 faixas, `secaoDe`/`comecaSecao`/`indice`. PURA — não sabe nada de coleção, só traduz NÚMERO em SEÇÃO |
| o índice | `indiceDeSecoes` | a barra no topo do card, **fechada por padrão**, e a grade de chips |
| os títulos | `cabecalhoDeSecao` | um `<li class="hino-secao">` antes do primeiro hino de cada seção |
| o salto | `irParaSecao` | estica a lista até o destino EXISTIR e rola até ele |

**As decisões que precisam estar ditas:**

- **O índice NASCE FECHADO.** São 35 seções: abertas, empurrariam os 600 hinos
  para baixo de um paredão que o operador teria de rolar toda vez que abrisse o
  hinário — inclusive nas nove vezes em dez em que ele já sabe o número que quer.
  Mesma regra da v1.1.4 ("a Biblioteca abre com tudo fechado"), um nível abaixo.
  O estado mora na `ui()` do álbum (`u.indiceAberto`), como todo estado de
  navegação daqui: o card é REMONTADO a cada redesenho, e um estado guardado no
  nó morreria junto com ele.
- **SÓ O HINÁRIO NOVO** (`ehHinarioNovo`, hoje um lugar só — a capacidade do
  `sorteioCap` aponta para a mesma função). Os números são os do 2022; o de 1996
  tem 613 hinos e outra organização, e um "Infantis" sobre o 508 dele é um rótulo
  MENTINDO. É o defeito que este recurso inteiro existe para não ter, e é o que
  ninguém notaria olhando o hinário certo — daí ele ter oráculo próprio.
- **O cabeçalho sai de `comecaSecao`, nunca de "mudou em relação à linha
  anterior".** A lista chega de `COLL_PAGE` em `COLL_PAGE` e a linha anterior nem
  sempre está no DOM: a comparação erraria exatamente na primeira linha de cada
  página, desenhando um cabeçalho a mais no meio de uma seção.
- **A retomada da paginação conta `.hymn-result`, nunca os filhos da lista.** Os
  cabeçalhos moram na MESMA `<ul>`; contá-los faria a página seguinte começar
  adiantada, **pulando um hino por cabeçalho já desenhado** — hinos sumindo do
  meio da lista, sem erro nenhum.
- **O salto GARANTE a linha antes de rolar.** Pedir "Despedida" (592) com 100
  linhas desenhadas rolaria até o fim de uma lista que ainda não tem o destino;
  `irParaSecao` estica o `u.shown` em páginas INTEIRAS (um valor quebrado
  deixaria a paginação seguinte fora do passo) e só então rola.
- **A faixa infantil está escrita nos DOIS arquivos** (`hinario.js` e
  `sorteio.js`), e a duplicação é deliberada: fazer um módulo puro importar outro
  para ler duas constantes trocaria uma duplicação visível por um acoplamento
  invisível. Quem impede a divergência é o oráculo, que compara os dois.

#### Sistema de coleções (genérico)

O que antes era exclusivo do Hinário 2022 virou um **sistema genérico de
coleções**, todo parametrizado por uma `coll = { id, name, kind, source, iconKey }`
(ver `allCollections()`/`FIXED_COLLECTIONS` em `controle.js`). Cada coleção tem
**uma pasta OPFS própria** (`folders/<coll.id>/`) e um **card** no acervo (o
estado padrão da busca; até a v5.43, a aba Álbuns).
Dois tipos:

- **`hymnal`** (fixas): a `source` é um arquivo de **lista** (`pt_hymnal`,
  `pt_hymnal_1996`) que já é o índice completo de hinos. Sempre visíveis; o
  índice leve é atualizado sozinho (`autoRefreshCollections`).
- **`album`** (dinâmicas): descobertas em `pt_categories`
  (`fetchAlbumCatalog` → `state.albumCatalog`, um card por álbum, agrupados
  por categoria). O índice de
  cada álbum vem de `album_{id}.musics` e é buscado **automaticamente**
  (`autoRefreshCollections`, fase 2 — só metadados, sem áudio), com
  concorrência limitada e um TTL (`ALBUM_INDEX_TTL`, 12 h) pra não refazer N
  requisições a cada retomada; álbuns novos/vazios são sempre buscados. **E o
  álbum COM DOWNLOAD no aparelho é relido na abertura mesmo dentro do TTL**
  (`forcarIndice`, v1.1.16): é o que o botão "Verificar" fazia, e é o que faz o
  botão de BAIXAR aparecer sozinho quando o catálogo cresce. UMA VEZ POR SESSÃO
  (`indicesForcados`) — esta função roda a cada `visibilitychange`, e forçar a
  cada volta ao app seria uma rajada de requisições na Wi-Fi da igreja. A SÉRIE
  fica de fora: o índice dela custa uma extração do canal do YouTube. Assim a
  busca do acervo cobre **todas** as músicas de **todos** os álbuns mesmo sem
  nada baixado (tocar num resultado baixa sob demanda — igual ao hinário).
  Álbuns cujo nome parece de hinário são pulados (já têm card dedicado).

O himnário em espanhol e demais idiomas ficam de fora naturalmente — só
consumimos arquivos `pt_*`.

**Estado por coleção**: `state['coll:<id>'] = { indexSyncedAt, songs:[…] }`;
fonte de verdade em memória (`collState`, carregada uma vez no `init` por
`loadCollections()`). **Migração**: o antigo `state.hymnal2022` é copiado para
`coll:hymnal-2022` (mesma pasta OPFS `hymnal-2022` — downloads já feitos
continuam válidos). UI transitória (sync em andamento, status, peso) fica em
`collUI` (não persistida).

**O navegador do acervo** (`renderCollectionsList(alvo, redesenhar, opts)`)
renderiza um card por coleção (`renderCollectionCard`), **agrupados por
categoria** — as quatro coleções fixas soltas no topo (as duas séries, depois os
dois hinários), depois cada categoria do banco. Ele **não tem aba própria**: desde a v5.43 é o estado padrão do popup da
lupa, e desde a v5.44 é o único (ver "O acervo É o estado padrão da busca"). A
função recebe o elemento-alvo e o callback de redesenho justamente por isso —
duas cópias divergiriam no primeiro ajuste de categoria.

O card do Hinário **saiu da tela de pastas** (hoje os **Favoritos**, que voltou
a ser só pastas e pastas do sistema).

> **As pílulas de filtro saíram na v5.70.** Havia uma faixa rolável no topo
> (`.coll-filters`/`.coll-pill`: Todos · Hinários · uma por categoria do banco,
> guardada em `albumFilter`), pensada para cortar caminho até um grupo sem rolar
> a lista. Ela cobrava um recorte antes de mostrar o acervo, e o acervo já vem
> recortado: os cabeçalhos de categoria são o mesmo agrupamento, na mesma ordem
> do banco, e os cards são colapsados — a lista inteira cabe em pouquíssimas
> telas de rolagem. Quem sabe o nome digita, e o campo de busca fica logo acima.
>
> Tirá-las simplificou o render: `albumFilter` era o único motivo de três ramos
> em `renderCollectionsList` (ocultar os hinários, pular categorias, e um
> retorno antecipado que escondia os álbuns órfãos e trocava a mensagem de lista
> vazia), e do parâmetro `showName` do cabeçalho de grupo — que hoje só serve a
> "Todo o acervo", onde o nome já está dentro do botão. A faixa também era uma
> exceção no reconhecedor de deslize do carrossel de abas (um trilho horizontal
> dentro de uma área que troca de aba na horizontal); essa exceção saiu junto.

Os mecanismos abaixo (sincronização/download/letra/Wi-Fi/busca) valem **por
coleção**, exatamente como antes valiam só pro Hinário 2022.

#### Baixar a coleção COMPLETA (`syncGroup`)

O cabeçalho de cada grupo (`.coll-group`) deixou de ser só um rótulo: ele
carrega o **resumo do grupo inteiro** (`baixados/total`, somando todos os
álbuns dali) e o botão que **baixa a coleção completa** — "CDs Oficiais/Ano"
tem uma dúzia de álbuns, e sincronizar um a um pela engrenagem de cada card era
uma dúzia de idas ao popup. Vale para os três tipos de grupo: os hinários, cada
categoria do banco e os álbuns órfãos.

O cabeçalho pode **omitir o nome** e continuar existindo (`showName === false`)
— o que estava lá antes era redundante, o que está lá agora é uma ação. Hoje só
"Todo o acervo" usa isso, porque ali o nome já está dentro do próprio botão;
antes da v5.70 valia também para o grupo que a pílula de filtro selecionada já
nomeava.

- **Um álbum por vez, nunca em paralelo** — e isso não custa velocidade: o
  limite de conexões é por HOST, não por álbum (ver `NET_CONCURRENCY`). Dois
  álbuns com 3 downloads cada dariam exatamente as mesmas 6 conexões que um
  álbum com 6, só que com o progresso fragmentado e mais estado concorrente.
- **A pergunta de rede é feita UMA VEZ para o lote.** Fora do Wi-Fi, um
  diálogo com a contagem de álbuns e a estimativa somada; a resposta é
  repassada a cada `syncCollection` via `opts.allowMobile`, então nenhum deles
  pergunta de novo. Sem isso seriam doze diálogos seguidos, que ninguém lê — e
  a decisão continua sendo do operador, como manda a política de Wi-Fi.
- **O lote inteiro é UMA tarefa de segundo plano** (`withBgWork` em volta do
  laço, não por álbum): senão o `SyncService` seria desligado no fim de cada
  álbum e o processo podia ser congelado justamente entre um e outro — que é o
  cenário normal, já que o operador dispara e sai do app.
- **Cancelável na próxima MÚSICA, não no próximo álbum.** Durante o download o
  botão vira ✕; o toque marca `cancel`, e esse sinal **atravessa o álbum em
  curso** (`opts.cancelled`, lido pelo `worker` de `syncCollection`). Parar só
  entre álbuns era, na prática, não poder parar: há álbuns de centenas de
  faixas, e o operador ficava preso ao lote inteiro depois de mudar de ideia.
  Medido com o código real (600 faixas): o cancelamento custa **6 músicas**, as
  que já estavam no ar.
- Estado transitório em `groupUI`/`gui(key)` (não persistido), com
  `setGroupStatus` espelhando o `setCollStatus` dos cards — logo, o progresso
  também passa pelo re-render coalescido.
- **A notificação do sistema acompanha o LOTE**, não cada álbum: o total é a
  soma das músicas pendentes de todos eles, contada uma vez no começo
  (`bgTaskStart` no `syncGroup`, e `syncCollection` recebe `notifOwned` para
  não abrir uma tarefa própria). Ver "Progresso em segundo plano".
- **Um álbum do LOTE não pode cancelar a si mesmo.** `syncCollection` interpreta
  uma segunda chamada com `syncBusy` ligado como "o operador tocou de novo" e
  **aborta** o download em curso — que é o comportamento certo para o botão, e
  desastroso para o laço: o lote pedia dois downloads e o efeito líquido era
  parar um. `opts.fromGroup` marca a chamada como programática, e aí o lote
  apenas **pula** o álbum que já está baixando por conta própria.
- **Sem rede, o cabeçalho conta as falhas.** `fetchCollectionIndex` lança em
  cada álbum e o laço inteiro termina em segundos sem baixar nada; anunciar
  "Coleção completa" em verde ali mandava o operador embora convencido de que o
  acervo estava no aparelho. O status por álbum existe, mas fica dentro de um
  card colapsado e se autolimpa — o cabeçalho, que é o que ele está olhando,
  agora diz "N álbum(ns) sem rede — tente de novo". Isso só é possível porque
  `syncCollection` passou a **devolver um resultado** (abaixo).

> **"Baixar TODO o acervo" SAIU na v5.258**, a pedido do operador: com as
> séries do YouTube a escala virou dezenas de GB (~15 GB só de um ano de
> episódios), e um botão que baixa tudo deixou de ter significado. `renderAcervoTotal`
> foi apagado junto. Ficam os dois downloads com **tamanho de decisão**: por
> coleção (a barra do card) e por categoria (`montarResumoGrupo`).

#### Concorrência de download (`NET_CONCURRENCY`)

Quantas requisições ficam em voo ao mesmo tempo — usada pelo download de
músicas (`syncCollection`), pela Bíblia e pela atualização de índices.

**6 é o teto de conexões simultâneas por host** do motor do WebView em
HTTP/1.1, medido no Chromium com um servidor de latência (36 arquivos de
400 KB, 250 ms de RTT), mediana de 3 rodadas:

| concorrência | tempo | ganho | pico real de conexões |
|---|---|---|---|
| 3 | 3,24 s | (base) | 3 |
| **6** | **1,77 s** | **+82%** | **6** |
| 8 | 1,71 s | +89% | 6 |
| 12 | 2,05 s | +58% | 6 |
| 24 | 1,77 s | +83% | 6 |

De 3 para 6 o download quase **dobra**; acima de 6 o navegador enfileira e não
há ganho — só mais Blobs em memória ao mesmo tempo. Como cada música é baixada
**sequencialmente** (metadados → capa → Cantado → Playback, com as imagens de
estrofe em série por causa do cache compartilhado `resolveImage`), a
concorrência do laço é exatamente o número de conexões: é este o parâmetro que
importa, e não "quantos álbuns ao mesmo tempo".

Ressalva honesta: se o servidor do LouvorJA falar HTTP/2, o limite de 6 não se
aplica (multiplexação) — mas aí o gargalo passa a ser banda, e mais streams
paralelos também não aumentariam o total. 6 é seguro nos dois cenários. O
protocolo real não pôde ser verificado (a rede de desenvolvimento não alcança
`api.louvorja.com.br`).

#### Progresso em segundo plano (`bgTaskStart`/`bgTaskStep`)

Com o app minimizado — o uso normal durante uma sincronização — a notificação do
`SyncService` é a única janela para o download. Quem sabe o progresso é o lado
web, então é ele que reporta, por
`AVNative.bgProgress({label, done, total, etaMs, items, idleMs, bytes})`.

Instrumentados: `syncCollection` (por música), `syncGroup` (por música, no total
do lote), `ensureBibleVersionDownloaded` (por capítulo) e `syncDeviceFolder` (por
arquivo).

- **A notificação mostra O QUE está baixando.** `bgItemStart`/`bgItemEnd`
  registram os itens em voo por tarefa (`bgItemOnly` para fluxos sequenciais,
  cujos `continue` deixariam nomes presos na lista). "23 de 54" é abstrato;
  "002. Ó Adorai o Senhor" é o que o operador reconhece.
- **A lista é uma FILA (`t.fila`), não um espelho do que está no ar.** A
  concorrência reduz o tempo PROPORCIONAL de cada item: se os 6 juntos levam X,
  cada um custou X/6 — e a exibição segue a mesma conta. É ilustrativa; contador,
  barra e estimativa seguem sendo os números reais. **Fila, nunca rodízio**: o
  rodízio repetia nomes e a lista não avançava (medido com 18 faixas e 6 em
  paralelo: 18/18 exibidos, 0 repetidos, em ordem).
- **O ritmo é MEDIDO** (`bgSpinMs` = `decorrido / concluídos`): mediana de 500 ms
  em tela contra 521 ms de custo amortizado real.
- **Sem o buffer a lista engasgava.** Os 6 workers andam em lockstep: os eventos
  chegam em RAJADA seguida de segundos de silêncio, e sem fila a rajada rendia
  UMA troca de nome — parado até a rajada seguinte, que é a sensação de travado.
- **O compasso PARA quando trava** (`BG_STALL_MS`, 90 s sem evento real): animar
  durante uma queda de rede esconderia o que precisa ser visto. A lista congela e
  o `idleMs` cresce — os dois sinais concordam.
- **`idleMs` separa "travado" de "esta faixa é grande".** Passado o limiar, a
  notificação para de prometer tempo restante (uma ETA sobre um ritmo que já não
  existe é a promessa mais enganosa possível) e passa a "sem resposta há X" — sem
  degraus, porque aqui o número precisa SUBIR a cada atualização.
- **Um freio só (`BG_NOTIF_MIN_MS`, 700 ms), e vale apenas para a ROTINA.** Tudo
  que precisa chegar na hora passa `force`. Quem dá o ritmo do item que entra é o
  compasso (`bgPacerTick`, `BG_TICK_MS` = 250 ms), que envia com `force` sempre
  que o nome troca — um segundo piso curto seria PIOR, porque o primeiro nome de
  uma tarefa nasce a poucos ms da abertura e ficaria retido até o batimento de 2 s.
- **`bgTasks` é um REGISTRO (Map), não um slot único.** Downloads simultâneos
  existem — daí `bgWorkCount` contar em vez de ser booleano — e com um slot só as
  tarefas se sobrescreviam: o `done` de uma saía com o `total` e o relógio da
  outra. A notificação mostra a **dominante** (maior tempo restante) e marca as
  demais com `(+N)`.
- **A estimativa** sai do ritmo médio desde o **primeiro item concluído**, nunca
  desde o `start` (que incluiria o preparo — índice, varredura — e inflaria a
  primeira leitura). Média, não taxa instantânea: faixas têm tamanhos muito
  diferentes. **Suavização assimétrica por constante de tempo** (`ETA_TAU_DOWN`
  2,5 s / `ETA_TAU_UP` 10 s) e arredondamento em degraus no lado nativo. Por
  TEMPO e não por chamada — o compasso de 1 s pede a estimativa muito mais vezes
  que os eventos pediam, e um fator fixo por chamada devolveria o número instável.
- **`bgWorkEnd` é IDEMPOTENTE, e precisa ser.** O `clear()` sozinho deixava o
  compasso ligado para sempre: com o Map já vazio, o `bgTaskEnd` seguinte não
  achava nada, o `delete` devolvia `false`, e nem o `bgPacerSync()` nem o envio
  final rodavam — o `setInterval` de 250 ms vazava pelo resto da sessão, com a
  notificação presa. Hoje ele sincroniza o compasso e envia o estado final ele
  mesmo, e a ordem entre ele e o `bgTaskEnd` deixa de importar.
- No navegador, e num shell anterior ao `SHELL_VERSION` 10, é no-op.
   Playback/instrumental quando existir, mais a capa e as imagens por estrofe,
   gravados no **mesmo catálogo OPFS das pastas sincronizadas** (`AVDB.fileAdd` +
   `AVDB.opfsWriteFile`, pasta `folders/<coll.id>/`). Então listar, buscar, tocar
   e excluir funcionam **sem nenhum código novo** — é só mais uma pasta OPFS, com
   a fonte sendo uma API remota em vez de `showDirectoryPicker()`.

**UI — o card É o álbum, e tocar nele ABRE o álbum** (`renderCollectionCard()` +
`.hymnal-card`). A barra (`.coll-bar`) é uma **linha só**: símbolo + nome (+
subtítulo da categoria) + **peso** (ou o progresso ao vivo) + **baixar/cancelar**
(`.coll-bar-dl`) + a **seta de acordeão**, que é a `.coll-bar-icon` da THUMB
virada por CSS. Sem índice ainda, o toque leva às opções, que é onde está o
sincronizar que resolve isso.

> **O OUVINTE É DO CARD, E NÃO DA BARRA** — e a razão é um defeito que só aparece
> com o dedo. `.coll-bar` está na lista do `:active`, cujo `--press` é
> `scale(.96)`: numa barra de ~395px isso a encolhe ~8px de cada lado. O
> `pointerdown` acerta a barra e dispara o encolhimento; no `pointerup` ela já
> não está ali, e o navegador entrega o `click` ao ANCESTRAL. Medido: até ~7px da
> borda o toque não abre, de 8px em diante abre — e a margem existe nos quatro
> lados. Subir o ouvinte para o card (que não se mexe) fecha a classe inteira.
>
> A **guarda** é o `.coll-open` (o invólucro de tudo que não é a barra): sem ela,
> com o álbum aberto um toque numa faixa borbulharia até aqui e fecharia o álbum
> debaixo do dedo. Ela pergunta pelo INVÓLUCRO e não por uma lista de filhos,
> para o próximo bloco que nascer lá dentro já nascer protegido.
>
> **E A GUARDA PERGUNTA PELO CAMINHO, NÃO PELA ÁRVORE DE AGORA.** Como
> `e.target.closest('.coll-open')` ela fechava o álbum ao se tocar numa caixa de
> marcação: o botão é apagado pelo próprio handler que roda antes (marcar chama
> `renderSongMenu`, que faz `alvo.innerHTML = ''`), então quando o evento chega
> ao card o `e.target` está **desanexado** e `closest` devolve `null`. **Decidir
> pela POSIÇÃO do alvo na árvore é perguntar "onde este nó está agora", e agora é
> depois de todos os handlers que rodaram antes** — `e.composedPath()` é fixado
> no disparo e sobrevive ao apagamento.
>
> **E o `padding` mora em quem PINTA** (a barra e o corpo aberto), nunca no card:
> a barra do álbum ABERTO já desfazia o padding do card com margens negativas
> para grudar como tampa — isto é, com o álbum aberto aquela faixa funcionava e
> com ele fechado não. O mesmo pixel respondendo ou não conforme o estado.

> **Sem molduras, sem seta própria, sem faixa de cor.** Numa lista de dezenas de
> álbuns, com contorno e faixa colorida o que o olho via primeiro eram as linhas,
> não os nomes. O card é **preenchimento sólido**: dentro da folha (`--panel`)
> ele sobe um degrau para `--panel-2` — um cartão da cor do que está atrás dele
> simplesmente não existe aos olhos. **Aberto se diz no NOME**, em accent: um
> segundo degrau de tom não cabia, porque o cartão já gastou um para existir e as
> faixas ocupam o de baixo. O campo `color` continua no catálogo, de graça, se um
> dia a cor voltar como tinta do quadrado do ícone.

**O botão de baixar SAI da barra quando o álbum já está todo no aparelho** (a
condição é `u.syncBusy || !complete`): ele dizia "Baixar esta coleção" para uma
coleção que não tem mais o que baixar — um alvo do tamanho de `--hit` oferecendo
uma ação sem efeito, em cada linha de uma lista de dezenas de álbuns. O que resta
ali é manutenção, e já mora dentro do card aberto. Enquanto o download ROLA o
botão continua, porque ali ele é o cancelar. O botão de GRUPO
(`.coll-group-btn`) **não** segue a regra — ali não existe engrenagem, e sumir
com ele tiraria a única rota de re-sincronizar o grupo.

**O contador da barra é o PESO** (`fracaoPeso`), não a contagem de faixas: ele
responde a pergunta que se faz com o dedo sobre o botão de baixar — *quanto isto
vai me custar*. Quatro faixas podem ser 8 MB ou 80 MB, e é essa diferença que
decide esperar o Wi-Fi ou apagar um álbum para caber outro.

| Estado | Barra |
|---|---|
| sem índice | `não sincron.` |
| nada baixado | `230 MB` — só o que vai custar |
| parcial | `19/249 MB` |
| completo | `2,3 GB`, exato (soma do catálogo) |

O total continua sendo uma ESTIMATIVA (duração × a taxa medida no aparelho); o
que não existe é o `~` que a anunciava — `fmtBytes` já arredonda para uma casa,
então "18 MB" nunca prometeu 18.874.368 bytes, e o til pagava um caractere em
cada contagem da tela mais densa do app.

A contagem de faixas não se perde: ela continua no estado do botão de verificar,
dentro das opções do álbum. E os três contadores da tela — card, cabeçalho de
categoria e "Todo o acervo" — usam a MESMA função: um em faixas e outro em MB
seria a pior das versões. Os de GRUPO ficam mesmo completos: eles somam várias
coleções, e ali o número ainda responde alguma coisa.

**Uma coleção aberta por vez** (abrir uma fecha as demais): duas listas de
centenas de faixas empurrariam o acervo para fora da tela e tirariam do lugar
exatamente o card que o operador estava mirando. Dentro do aberto vem a lista
**inteira** de músicas — sem teto, porque ali se folheia um álbum, e cortar em 60
esconderia o fim de qualquer hinário. As linhas são as mesmas `hymnResultRow` da
busca, com `semColecao` ligado.
#### …mas ela CHEGA em páginas de 100 (v5.74)

"Inteira" é sobre o que está disponível, não sobre o que é montado no toque.
Um hinário tem **613 hinos**, e cada linha é um `<li>` com miniatura, dois
botões e SVG inline dentro deles: montar as 613 de uma vez é um bloco de
JavaScript **síncrono** no meio do toque que abre o card — a animação de
abertura nasce engasgada e o toque parece não ter funcionado. E não é uma vez
só: o card é remontado a cada redesenho do acervo, que o progresso de um
download dispara a cada `COLL_REFRESH_MS`.

`fillSongList(lista, coll, u)` monta `COLL_PAGE` (100) linhas e pendura uma
**sentinela** (`.coll-more`) no fim. Quando ela entra na tela, a página seguinte
é anexada e a sentinela se remuda para o novo fim, até acabarem as faixas.

- **O gatilho é o SCROLL, não um botão.** Quem folheia um hinário está
  procurando um hino, não administrando uma lista: parar para pedir mais é
  atrito num gesto que já é contínuo. A sentinela **também** é um botão, para o
  caso de ela aparecer sem que a rolagem a tenha alcançado (uma lista curta
  demais para rolar dentro do popup) — mas o caminho normal não passa por ele.
- **`IntersectionObserver` com `root: null`.** A viewport resolve sozinha o
  problema de descobrir QUAL elemento rola (hoje `#hymnResults`, amanhã outro):
  a interseção com a viewport já vem recortada pelos `overflow` dos ancestrais,
  então a sentinela só "aparece" quando de fato aparece na tela. O
  `rootMargin: '300px'` adianta a página — o objetivo é que o operador **nunca
  chegue a ver** essa linha.
- **É INCREMENTAL.** A página nova é anexada às linhas que já estão no DOM, sem
  reconstruir as anteriores: reconstruir mexeria no scroll debaixo do dedo que
  acabou de pedir a página.
- **`u.shown` mora no estado de UI do card** (ao lado de `u.expanded`), então um
  redesenho por progresso de download reencontra o mesmo ponto — quem já rolou
  até o hino 400 continua vendo 400.
- **Fechar zera.** Reabrir um hinário que ficou rolado até o fim traria os 613
  de volta de uma vez, que é exatamente o custo que a paginação existe para
  evitar.

#### O canto da barra: a seta que FECHA o álbum

Aberto o card, aquele canto **toma a caixa do botão de baixar** na barra
(`.coll-bar-cfg`, herdando `.coll-bar-dl`): mesma coluna, mesmo alvo, e os dois
nunca fazem falta ao mesmo tempo — fechado, o que se decide é "baixo isto?";
aberto, já se está olhando o conteúdo. Ele já foi uma barra larga rotulada dentro
do card ("Sincronizar e opções": uma linha inteira gasta com o que cabe num canto
que já existia) e uma engrenagem que revelava as opções; com as opções cabendo
SEMPRE que o card está aberto, um botão para revelá-las era cerimônia.

O toque na barra continua alternando: são dois gatilhos para o mesmo
`alternarAcordeao`.

**A exceção é o download EM CURSO.** Ali o botão da barra é o CANCELAR e
continua lá mesmo com o card aberto — um álbum de centenas de faixas, uma vez
começado, precisa poder parar num toque. Nesse estado o álbum se fecha pelo toque
na barra.
### Os acordeões abrem animados

Um acordeão que troca `display` aparece **pronto**, e num toque a lista abaixo
dá um salto — o operador perde de vista onde estava. Animar a altura mostra de
onde o conteúdo saiu, que é a informação que o salto destrói. Vale para os dois
acordeões do acervo: o **card do álbum** e a **gaveta** de cada linha.

- **A altura é MEDIDA e animada em JS** (`expandAccordion`/`collapseAccordion`,
  Web Animations API, `ACC_MS` = 220 ms). `auto` não é animável em CSS, e um
  teto fixo cortaria a letra de um hino de 40 linhas.
- **`offsetHeight`, não `scrollHeight`.** Uma gaveta com teto que role por
  dentro mediria mais do que ocupa: animar até o `scrollHeight` abriria um vão e
  depois recuaria.
- **O `overflow: hidden` é devolvido no fim** (`finish` **e** `cancel`), senão a
  lista fica presa à altura do instante em que a animação foi montada.
- **O card tem um invólucro** (`.coll-open`, com o painel de opções e a lista)
  só para a animação ter UM nó a recortar. O `overflow` não podia ir no card: a
  barra dele é `position: sticky`, e um ancestral com overflow recortado a
  prende. As margens negativas do invólucro repetem as de `.coll-songs` — o
  recorte acontece na borda do padding, e esse par põe a linha de corte
  exatamente na borda do card.
- **A abertura é sinalizada pelo render, não pelo clique**
  (`ui(coll.id).animarAbertura`): o card só existe depois de
  `redesenharAcervo()`, e a bandeira é consumida ali. Só o toque que ABRIU anima
  — um redesenho por outro motivo (o progresso de um download) reencontra o card
  já aberto, e vê-lo "abrir" sozinho leria como se algo tivesse acontecido.
- **Fechar anima ANTES de redesenhar**: o redesenho apaga o nó, e um nó apagado
  não sai deslizando.
- **A gaveta é montada antes de a linha abrir.** Uma caixa vazia mediria zero.
  Quem rola até a linha que casou com a busca é o chamador, depois de abrir —
  `scrollIntoView` numa caixa `display:none` é no-op.
- **`prefers-reduced-motion: reduce` desliga tudo** (`semMovimento()`).

> **Vocabulário: na TELA ela se chama "Biblioteca"** (v5.96). No código e neste
> documento continua sendo o **acervo** (`hymnSearchPopup`, `openHymnSearch`). Cuidado com o outro sentido de "biblioteca" que já existia
> aqui — o IndexedDB/OPFS com tudo o que o operador baixou; nos textos VISÍVEIS
> ele é "os dados do app", para as duas coisas não dividirem a mesma palavra.

**A COLUNA DA DIREITA DA BARRA** (v1.1.16) tem até dois botões, e cada um
responde a uma pergunta diferente:

| botão | responde a | quando aparece |
|---|---|---|
| **baixar / cancelar** (`.coll-bar-dl`) | "há o que baixar?" | independente de aberto ou fechado |
| **remover** (`.coll-bar-rm`) | "o álbum está aberto?" | só com o card aberto |

- **A lixeira é revelada pelo mesmo gesto que revela o que ela apaga.** Fechado,
  o card não oferece destruição nenhuma — e o acervo inteiro é uma lista de
  cards fechados; ali ela seria destruição a um toque de distância, repetida
  linha a linha.
- **O botão de baixar NÃO se esconde com o card aberto.** O `vago` existia
  porque o painel de dentro repetia a ação dois centímetros abaixo; saindo a
  repetição, sai o esconderijo. E a barra é o que gruda no topo (`sticky`)
  enquanto se percorre a lista: um álbum de centenas de faixas precisa poder
  começar (e parar) num toque, de qualquer ponto da rolagem.
- **`countDownloaded` só é chamado com o card ABERTO** — ele varre todas as
  faixas do álbum, e o acervo é redesenhado a cada 400 ms enquanto um download
  corre. O acordeão garante no máximo um card aberto, então a varredura é uma
  por redesenho, não quarenta.
- **A remoção é só a LIXEIRA**: um destrutivo pode ficar sem rótulo porque é
  CONFIRMADO, e o diálogo nomeia o alcance ("o que foi baixado… e a lista
  offline"). A frase segue no `title`/`aria-label`.
- **`stopPropagation` nos dois**, como em toda coisa que vive na barra: sem ele
  o toque borbulha até o card e o FECHA — a lixeira fecharia o álbum debaixo do
  diálogo que ela acabou de abrir.

**A COLUNA DA DIREITA tem TRÊS botões possíveis** (v1.1.21), todos com a
geometria de `.coll-bar-dl` — centros ou tamanhos que discordem num par colado é
a coisa que mais parece defeito numa linha:

| botão | classe | responde a | quando |
|---|---|---|---|
| **baixar / cancelar** | `.coll-bar-dl` | "há o que baixar?" | álbum e hinário, aberto ou fechado |
| **atualizar a lista** | `.coll-bar-at` | — | **só na SÉRIE**, sempre |
| **remover** | `.coll-bar-rm` | "o álbum está aberto?" | álbum e hinário, só aberto |

- **A lixeira é revelada pelo mesmo gesto que revela o que ela apaga.** Fechado,
  o card não oferece destruição nenhuma — e o acervo inteiro é uma lista de
  cards fechados; ali ela seria destruição a um toque de distância, repetida
  linha a linha.
- **O botão de baixar NÃO se esconde com o card aberto** (o `vago` saiu na
  v1.1.16 com o painel que repetia a ação). A barra é o que gruda no topo
  (`sticky`) enquanto se percorre a lista: um álbum de centenas de faixas precisa
  poder começar (e parar) num toque, de qualquer ponto da rolagem.
- **A SÉRIE não tem os outros dois** (v1.1.21), e a razão é do modelo de dados,
  não da tela: **o álbum de série não retém arquivo**. Um episódio só existe no
  aparelho enquanto está no Cronograma, nos Favoritos ou na playlist. Não há
  acervo do álbum para baixar em lote (~15 GB/ano) nem para remover — "Remover
  do dispositivo" ali apagaria o que está em OUTRA lista, ou nada, e as duas
  leituras são erradas.
- **E a barra da série não anuncia PESO**: `fracaoPeso` devolve, para um acervo
  vazio, "o que vai custar baixar" — gigabytes prometendo um download em lote que
  nunca existiu. Ela diz quantos episódios a lista tem.
- **`countDownloaded` só é chamado com o card ABERTO** — ele varre todas as
  faixas do álbum, e o acervo é redesenhado a cada 400 ms enquanto um download
  corre. O acordeão garante no máximo um card aberto.
- **`stopPropagation` nos três**: sem ele o toque borbulha até o card e o FECHA
  — a lixeira fecharia o álbum debaixo do diálogo que ela acabou de abrir.

**O DESTAQUE DO SÁBADO** (v1.1.21, `blocoDestaque`/`destaqueDaSerie`): acima da
lista, só na série, o episódio desta semana — ou a frase que diz que ele ainda
não saiu.

- **O item destacado SAI da lista** (`faixasDaLista`, usada também pela
  paginação, senão o contador de "restantes" discordaria do que há na tela).
  Deixá-lo nos dois lugares daria duas linhas que fazem exatamente a mesma coisa,
  a dois centímetros uma da outra — e a de baixo, no meio de cinquenta irmãs, é a
  que o operador tocaria por engano procurando outra data. "Separado" é literal.
- **A AUSÊNCIA também é um estado**, e é o caso comum na segunda-feira: sem o
  bloco, um card sem o episódio da semana fica indistinguível de um que ainda não
  carregou. "Aguardando lançamento" responde a pergunta que o operador veio
  fazer, e o cabeçalho ao lado diz de QUE sábado se trata — sem a data, a frase
  valeria para qualquer semana. O bloco tem a mesma altura nos dois estados: ele
  não pode encolher e crescer conforme a semana, senão o topo do card salta toda
  vez que o episódio sai.
- **A linha é a MESMA da lista** (`hymnResultRow` dentro de uma `<ul>` que também
  é `.coll-songs`): o toque, a gaveta de opções, o indicador de download e o
  "Tocar agora" vêm de graça. Um cartão próprio seria uma segunda implementação
  do item mais complexo desta tela.
- **Quem decide é `AVSerie.ehDoSabadoAtual`** (puro, com oráculo), e a janela é a
  **semana adventista — de domingo a sábado**, não o dia exato. A régua deste
  módulo é a data do TÍTULO, e o canal escreve a data que quiser: exigir
  `diasAte === diasAteSábado` faria um episódio datado de sexta desaparecer do
  destaque e a tela dizer "Aguardando lançamento" sobre um vídeo que está na
  lista logo abaixo.

> **O painel `.coll-opts` não existe mais** (v1.1.21). As três ações que ele teve
> terminaram na coluna da direita da barra: o "Verificar" saiu na v1.1.16 (a
> verificação virou automática na abertura — ver `forcarIndice`), o "Baixar" já
> existia na barra e era só repetido, e o "Atualizar a lista" da série virou
> botão puro ao lado dos irmãos.

> **A REGRA QUE ESTE PAINEL ENSINOU, DUAS VEZES: nada aqui repete o que a barra
> do card já diz.** Ele já teve três chips, uma linha de status e um chip de
> peso — e o peso está na barra ANTES de abrir (é ele que faz o operador decidir
> abrir), e o "Baixando 2 de 4…" está na barra `sticky` dois centímetros acima.
> Um chip permanente de REDE também saiu: quem decide se a sincronização
> pergunta antes de usar dados móveis é `isConfirmedWifi()`, e ela o diz **na
> hora, no diálogo**.

**Uma coleção SEM índice abre direto nas opções**: `openCollectionOptions` liga
`expanded` e mais nada — ali não há lista para folhear.

**O botão de sincronizar é o mesmo botão de CANCELAR.** Com o download em curso
ele vira ✕ (aviso na BORDA e no texto, porque o fundo é o progresso, e **sem
giro**: um ✕ girando não se lê como "toque para parar"). Sem isso um segundo
toque caía num `return` mudo por `u.syncBusy`. O cancelamento **fecha a fila** —
nada novo entra e o que está no ar termina: abortar no meio deixaria um arquivo
truncado catalogado como completo. `u.cancel` também é conferido na VARREDURA
(`songVariantsNeeded` por música), que num álbum grande já é demorada.

#### "Esta coleção está completa?" — uma pergunta, UMA resposta

**`levantarColecao(id)` é a fonte única**, com três funções finas em cima:

- **`colecaoCompleta(id)`** — a pergunta da tela inteira. Conta VARIANTES
  (Cantado + Playback quando a origem declara `has_instrumental_music`), nunca
  músicas. Sem índice não há resposta: um álbum que nunca sincronizou não está
  completo nem incompleto.
- **`faltamNaColecao(id)`** — quantas variantes faltam, para os diálogos e a
  notificação. Prometer "12 músicas" e baixar 10 é a forma mais barata de
  parecer quebrado.
- **`songsBaixaveis(id)`** — o DENOMINADOR do "N de M músicas".

A pergunta já foi respondida em QUATRO lugares por `countDownloaded(id) >=
collSongs(id).length` — uma conta de MÚSICAS —, enquanto o download busca
VARIANTES: um Playback faltando deixava a barra escrevendo um número EXATO ao
lado de um card que ainda mostrava o botão de baixar. **Duas réguas para a mesma
pergunta divergem sozinhas, na mesma tela.**

**"NÃO EXISTE" não é "não baixei ainda".** Uma música cuja origem não tem o
arquivo (`url_music` vazio) nunca ganha `fileIdFull`, e o efeito era permanente:
a coleção nunca ficava completa e **cada sincronização voltava a buscar o
metadado dela**. `ensureSongVariant` marca (`semAudio`/`semPlayback`) e apaga a
marca se a URL aparecer depois — o índice é reaproveitado in-place pelo
`fetchCollectionIndex`, então a marca sobrevive à atualização de graça. Daí
`levantarColecao` a conta como `semFonte`, `songVariantsNeeded` para de pedir o
metadado, e ela sai **dos dois lados** da fração.

**O botão de GRUPO segue a mesma régua** (`grupoCompleto(colls)` =
`colls.every(colecaoCompleta)`, e não uma soma de músicas, que responderia
diferente da linha logo abaixo). O custo do toque ali é maior: `syncGroup`
percorre álbum por álbum buscando índice na REDE — minutos, num acervo grande.

E é `grupoCompleto` que impede o "Baixar toda a biblioteca" de MENTIR num acervo
recém-instalado: o atalho `songs === 0 → "Já completo"` é verdadeiro para um
álbum SEM ÍNDICE, que tem zero variantes faltando **porque não tem lista** — na
janela em que o `autoRefreshCollections` ainda não indexou, o botão de maior
alcance da tela respondia "Já completo" e não fazia nada.

`tools/acervo.test.mjs` prende as três contas num Chromium de verdade: conta
errada não estoura em lugar nenhum, ela só mostra o número errado.

#### A medição do peso

Duas perguntas, e só uma tem resposta exata:

1. **quanto já está no aparelho** — `AVDB.opfsFolderSize(path)` enumera a PASTA
   e soma o `size` real de cada arquivo. EXATO, e cobre tudo que o download traz.
2. **quanto pesa o álbum inteiro** — o que falta ainda não veio, logo ESTIMATIVA.

**MEDIR A PASTA, NUNCA O CATÁLOGO.** O download grava dois tipos de arquivo na
mesma pasta: os áudios, que viram registro em `files`, e as **imagens de fundo da
letra**, que não viram (são referenciadas de dentro dos slides). Somando o
catálogo, essas imagens ficavam fora de TODA conta — num hinário inteiro,
centenas de MB que o operador via sumir do armazenamento sem explicação, e que
nenhuma tela somava; e ficavam fora também do NUMERADOR da taxa, que por isso
subestimava sistematicamente tudo o que projetava. Enumerar a pasta é ainda **mais
barato**: perguntar o tamanho de um arquivo não desserializa nada, enquanto o
`getAll` do catálogo trazia thumbnail e letra inteira de cada faixa para somar um
campo.

**A estimativa é por DURAÇÃO, não por contagem de faixas.** Áudio é bytes por
segundo: num hinário as durações são parecidas e os dois métodos empatam, mas num
álbum com um louvor de 2 min ao lado de um de 9 a média por faixa erra por um
fator de quatro — e erra na pergunta que decide um gasto de dados móveis. A
duração vem do índice (`duration`, "HH:MM:SS").

**A taxa é MEDIDA no aparelho** (bytes no disco ÷ segundos baixados), nunca uma
constante de bitrate: assim ela amortiza o que não é áudio e acompanha o bitrate
real do acervo. A escada vai da fonte mais específica à mais genérica: a taxa
DESTE álbum → a média de tudo o que já foi baixado → 128 kbps (`BPS_PADRAO`).
Sem o último degrau, um álbum vazio não teria tamanho a mostrar — que é
exatamente quando a informação mais importa. (Para VÍDEO a constante é outra,
`BPS_VIDEO_PADRAO`: a escada inteira pressupõe áudio, e numa série vazia ela
prometia ~50 MB para um ano que pesa ~15 GB.)

Duas ressalvas: o **Playback** conta com a duração do Cantado (a lista leve não
traz `instrumental_duration`, e é a mesma música), e uma faixa **sem duração** no
índice entra por `SEG_PADRAO` (3min30) em vez de somar zero, que faria o álbum
parecer menor do que é.

**O peso medido PERSISTE** (`state['coll-bytes']`) — `collUI` é estado de sessão,
e fechar o app apagava o número. A escrita é coalescida (o contador sobe a cada
arquivo baixado; um `setState` por música seria uma transação de IDB por
download).

**O peso NÃO é recalculado durante o render.** Recalcular é IO, e como o valor
mudar dispara outro `refreshCollectionsIfVisible`, sincronizar uma coleção com a
aba aberta executava N recontagens (N = número de cards) a cada música baixada.
Hoje `downloadCollectionFile` e `downloadCollectionImage` **somam o `blob.size`**
ao cache (`ui(id).bytes`) sem tocar o disco, `deleteCollection` zera, e a
recontagem completa roda só onde a conta muda em bloco:

- **`conferirPesoSeFaltar` reconta uma vez por sessão e por álbum, tenha ele peso
  ou não.** Rodando só com o peso ZERADO, um número errado nunca se corrigia: o
  acumulador só sobe, então qualquer divergência ficava gravada em `state` para
  sempre. (O `Set` que ele usa impede o `refreshCollectionsIfVisible` de dentro
  da recontagem de virar laço.)
- **O fim de uma sincronização reconcilia** (`updateCollBytes` no `finally` de
  `syncCollection`): durante o lote o número sobe por acumulação, que dá
  movimento na tela e erra em toda borda (uma faixa que falhou, um download
  repetido, um cancelamento). O fim do lote é o único momento sem IO concorrente.

**E o re-render é coalescido** (`refreshCollectionsIfVisible` agenda,
`renderCollectionsNow` executa; `COLL_REFRESH_MS` = 400 ms): o progresso chama
isso uma vez por música, e sincronizar o Hinário 2022 reconstruía a lista inteira
613 vezes. A resposta ao TOQUE continua imediata — `syncCollection` chama
`renderCollectionsNow()` direto ao ligar o `syncBusy`; só o progresso espera a
janela.

### O redesenho que o operador NÃO pediu espera a gaveta fechar

`renderSearchResults` faz `hymnResultsEl.innerHTML = ''` e remonta a lista, e o
que ABRE uma linha vive no `li` que ele acabou de jogar fora: a classe
`expanded`, a closure `gavetaMontada`, os destinos marcados (zerados por
`destLimpar()`) e a letra já lida. **São DUAS portas para esse mesmo quarto**, e
as duas são disparadas por algo que não foi o toque do operador:

| porta | quem dispara | quem segura |
|---|---|---|
| progresso de download (v1.1.2) | o tique de 400 ms, em modo FOLHEAR | `refreshCollectionsIfVisible` rearma enquanto `interacaoAbertaNoAcervo()` |
| resultado da busca no YouTube (v1.1.8) | `buscarNoYoutube`, em modo BUSCA | `renderBuscaQuandoPuder` rearma pelo mesmo guarda |

- **`interacaoAbertaNoAcervo()` conta `abrindo` como aberta.** Entre o toque e o
  `expanded` há um `await` (a letra sai do IndexedDB), e era ali que o redesenho
  alcançava a linha — o `li` do toque virava órfão e o toque não fazia nada.
- **A segunda porta é PIOR que a primeira em dois pontos.** A auto-busca dispara
  quando a sentinela do rodapé entra em cena, e **abrir a gaveta é justamente o
  que empurra a sentinela para dentro do campo de visão**: o gesto de olhar um
  item era o gesto que agendava a própria interrupção. E a pergunta é lateral —
  a música que o operador quer já está no acervo.
- **Espera o REDESENHO, nunca a busca.** Os bytes chegam no tempo deles.
- **O toque EXPLÍCITO no botão de buscar não espera** (`imediato`): ali quem
  redesenha é o operador, e a ação dele sempre vence — é o mesmo motivo pelo qual
  uma tecla nova redesenha a lista sem perguntar por gaveta nenhuma.
- **Os dois REARMAM** em vez de marcar um pendente: a espera dura exatamente o
  tempo em que há gaveta aberta, e o desfecho sai sozinho, sem depender de alguém
  lembrar de chamar isto de dentro de cada caminho que fecha uma gaveta.
- **A espera é a resposta certa, e não restaurar o estado depois.** Remontar a
  gaveta apagaria os destinos marcados, recarregaria a letra e mexeria no scroll
  debaixo do dedo — três coisas que o operador está usando justamente enquanto
  ela está aberta.

Oráculo: `tools/gaveta-no-download.test.mjs`, com as duas portas e um hazard
próprio para cada. **Ficam no mesmo arquivo de propósito** — separá-las
convidaria a corrigir uma e deixar a outra, que é literalmente o que aconteceu
entre a v1.1.2 e a v1.1.8.

Sincronização é **aditiva e resumível**: interromper e sincronizar de novo só
baixa o que falta (`fileGet` reconfirma que o arquivo catalogado ainda existe de
fato antes de pular — cobre exclusões manuais feitas por dentro da pasta).

**`syncCollection` devolve `{ ok, baixados, falhou }`.** Devolvendo `undefined`,
uma queda de rede era **invisível para o chamador** — o `syncGroup` varria dezenas
de álbuns em segundos sem baixar nada e ainda anunciava sucesso. Convenção:
`ok: false` é "não deu para baixar" (rede, armazenamento, erro); **cancelar ou já
estar completo é `ok: true`**, porque nos dois casos o sistema fez o que devia.
Na mesma linha, `downloadCollectionSong` devolve `false` quando nem os metadados
vieram, e o worker separa `done` (tentativas — é ele que move a barra) de
`falhou`: sem isso o rodapé anunciava "Atualizado (60 baixado(s))" com ZERO bytes
no disco.

**A ordem entre `bgTaskEnd` e `withBgWork` importa**, e é a mesma nos quatro
fluxos de massa (`syncCollection`, `syncGroup`, `ensureBibleVersionDownloaded`,
`syncLyrics`): o `bgTaskEnd` fica **dentro** do `withBgWork`. Um `finally`
externo roda DEPOIS do `finally` do `withBgWork`, e é este que solta o serviço em
primeiro plano e limpa o registro de tarefas — encerrar a tarefa depois disso
chega sempre tarde demais, sem efeito nenhum.
#### Classificação: categoria → álbum (a hierarquia do banco)

O acervo do LouvorJA tem **dois níveis, e só isso: categoria → álbum → música** —
não há grupo acima da categoria nem subcategoria (ver
`docs/FONTE-DE-DADOS-LOUVORJA.md` §5.5). A relação categoria↔álbum é **N:N**, e
`subtitle`/`order` são campos do **pivô**: variam conforme a categoria em que o
álbum é mostrado.

`state.albumCatalog` guarda a hierarquia inteira — `{ categories: [{ id_category,
name, order, albums: [{ id_album, subtitle, order }] }], albums: [{ id_album,
name, color }] }`. `albums` é o índice deduplicado que dá identidade a cada card
(vira `coll.id`); `categories` preserva a classificação.

`renderCollectionsList()` renderiza **cabeçalhos de categoria** (`.coll-group`)
na ordem do banco, com os álbuns de cada uma também na ordem do banco, e as
**quatro coleções fixas como cards da RAIZ, no topo** (v1.0.1 — ver "As coleções
fixas ficam na raiz", abaixo). Como a relação é N:N, **o mesmo álbum
aparece em mais de uma categoria** — de propósito, é assim no banco e no app
original, e o subtítulo muda junto. Álbuns que nenhuma categoria reivindica caem
num grupo "Outros álbuns" em vez de sumirem.

##### As coleções fixas ficam na RAIZ (v1.0.1)

Elas moravam em dois cabeçalhos — **"Arquivos oficiais"** (as séries, v5.260) e
**"Hinários"** —, e o agrupamento cobrava um toque que não pagava por si: quem
abre o Hinário 2022 quase nunca quer o de 1996 na mesma sessão, e quem vai ao
Provai e Vede não vai ao Informativo. Na raiz, o toque que abria o grupo abre a
**lista de faixas** — o card já é o acordeão (`alternarAcordeao`).

- **O que o grupo separava continua separado.** Ele existia para distinguir dois
  MODELOS de item (áudio com letra × vídeo do sábado), e essa distinção é do
  CARD (`tipoDaColecao`), não do cabeçalho que ficava por cima dele.
- **A ORDEM é a do uso**, e é a mesma de antes: as séries primeiro (material
  DATADO do sábado que vem), os hinários depois (acervo PERMANENTE, alcançado
  pela busca, pelo número ou pelo nome).
- **ARMADILHA:** `allCollections()` alimenta as CONTAS (peso, "toda a
  biblioteca", busca), **não** o desenho. Uma coleção fixa nova tem de entrar
  também na lista de `renderCollectionsListMiolo`, ou ela é construída, conta no
  peso e não aparece em lugar nenhum — sem erro.
- **O CARD PASSOU A TER TOM PRÓPRIO** (`--camada: var(--panel-2)` na regra de
  `.hymnal-card`). Lendo o pai ele ficava em `--panel` na raiz e em `--panel-2`
  dentro de uma seção: o MESMO álbum trocando de cor conforme alguém o tivesse
  agrupado, e a escada de dentro dele descendo um degrau junto — medido no
  escuro, a gaveta aberta caía a **1,26:1** da faixa vizinha (piso 1,28), que é
  a queixa que a v5.287 fechou. É a exceção declarada à regra "quem declara o
  tom é o CONTÊINER" — ver `docs/arquitetura/DESIGN-SYSTEM.md`.

**Álbum que é hinário disfarçado** (`isHymnalAlbum`): se `album_{id}.categories`
contém uma string começando com `hymnal.`, aquele "álbum" é na verdade um
hinário — o app-ja redireciona a abertura dele para o módulo do hinário, e como
os dois hinários já têm card fixo aqui, o duplicado é omitido. Esse é o critério
AUTORITATIVO, gravado como `collState[id].isHymnal` quando o índice chega; até lá
vale um palpite pelo nome (`/hin[aá]rio/i`).

**Índices sempre em dia, automaticamente** (`fetchCollectionIndex` /
`autoRefreshCollections`): na abertura e a cada retomada do Controle
(`visibilitychange`), busca (fase 1) os índices leves dos hinários + o catálogo
de álbuns, e (fase 2) o índice leve de CADA álbum (`album_{id}.musics`, só
metadados), com concorrência limitada (`runLimited` com `NET_CONCURRENCY`) e TTL
(`ALBUM_INDEX_TTL`, 12 h — pula os indexados há pouco, sempre busca os
novos/vazios). Ela é **silenciosa**: sem rede, só mantém o que está em cache.
Assim TODO o acervo entra na busca sozinho, baixado ou não.

**O merge é IN-PLACE, mutando os objetos existentes**, e isso não é estilo:
`syncCollection` tira um snapshot do array e grava `fileIdFull`/`fileIdPlayback`
nos objetos DELE conforme baixa. Como esta atualização roda em toda retomada do
app — ou seja, exatamente durante uma sincronização em massa, que é quando o
operador minimiza —, recriar os objetos deixava o snapshot apontando para
órfãos: os bytes iam para o OPFS e para o catálogo, os ids eram descartados no
`setState` seguinte, o card mostrava menos baixados do que existem e a música era
rebaixada. Reaproveitar o objeto preserva de graça qualquer campo extra
(`lyrics`, `_norm`). Complementarmente, `autoRefreshCollections` **pula coleções
com `syncBusy`**.

**Busca/lista — um popup só, e O CAMPO É A CHAVE.** `searchIsBrowsing(q)` é
literalmente `!q`: **campo vazio** = o navegador de coleções (cabeçalhos de
categoria e cards, com as músicas de cada um dentro do próprio acordeão); **com
texto** = a lista de músicas que casam, varrendo TODAS as coleções indexadas. Não
existe "modo coleção" separado — o escopo por coleção (`searchScope`, com título
próprio e um degrau de navegação) foi substituído pelo acordeão do card, que
mostra o álbum **sem perder o acervo de vista em volta**.

`renderSearchResults` monta os resultados dos índices já em memória
(`collState`), então funciona sem rede assim que eles tiverem sido buscados uma
vez; se o popup estiver aberto quando um índice atualiza, a lista se re-renderiza
na hora. Cada resultado carrega sua `coll` para tocar/adicionar/baixar sob
demanda.

**A busca tem teto de 60 resultados**, com uma linha final dizendo quantos
ficaram de fora: ela varre milhares de músicas e renderizar tudo a cada tecla
travaria o campo. Folhear uma coleção INTEIRA não passa por aqui — é o acordeão
do card, que lista tudo (em páginas de 100, ver acima).

**A busca por NÚMERO só vale onde o número identifica** (`collNumbersSongs`).
Num hinário o número É o nome da música ("o 471", e a numeração é a mesma do
hinário impresso); num álbum, `track` é só a posição no disco. Digitar "3" trazia
a faixa 3 de cada álbum indexado, empurrando o hino 3 para o fim da lista.
`songLabel(coll, s, pad)` é o único lugar que monta o rótulo — lista, busca, nome
do arquivo baixado e slide de capa passam todos por ali. Daí `hymnTrack` ser NULO
fora de hinário: é o número NO HINÁRIO, não a faixa do disco, e com isso o slide
de capa, o título do popup de letra e a preview param de numerar sem precisar
conhecer coleção nenhuma (o Display, em especial, só recebe o registro do
arquivo). Uma passagem única corrige o que já está baixado
(`desnumerarAlbunsBaixados`, estado `migSemNumeroAlbuns`) — ela REMOVE o prefixo
`N. ` e zera o `hymnTrack`, em vez de recalcular o nome a partir de `hymnName`,
porque o mesmo registro cobre importados e variantes.

### Playlist automática: o sorteio temático (v5.303)

Pedido do operador: *"um sistema de play aleatório temático, tanto para
música/mídia individual ou para montar playlists automáticas … você escolhe uma
palavra tema (que vai fazer a busca na biblioteca sobre palavras-chave e filtrar
a lista) e então aleatoriamente escolhe uma ou mais para tocar."*

Um botão **abre a barra da Biblioteca** (`#sorteioBtn`, à esquerda do campo de
busca) e leva a uma folha com cinco decisões e um botão:

| Controle | Pergunta | Valores |
|---|---|---|
| segmento | quanto? | **Tocar uma só** · **Montar playlist** |
| campo | qual tema? | palavra livre — vazio = o acervo inteiro |
| segmento | o quê? | **Cantada** · **Fundo musical** |
| pílulas | filtros | **Sem hinário** · **Só no aparelho** |
| pílulas | quantas? | 3 · 5 · 10 · 15 · 20 *(só montando fila)* |

#### A REGRA é um arquivo puro, com oráculo

`controle/sorteio.js` (`window.AVSorteio`) decide **o que pode ser sorteado**, e
não faz mais nada: não toca no DOM, não lê o IndexedDB, não baixa e não projeta.
As três capacidades de que precisa chegam INJETADAS em `cap` — e é isso que
impede o defeito mais caro possível aqui: `normalizeForSearch` é o normalizador
ÚNICO da Biblioteca e `lyricMatch` é o casamento por letra da busca, e uma
segunda escrita de qualquer um dos dois faria **o sorteio achar um conjunto e a
busca achar outro para a mesma palavra, na mesma tela** — com os dois parecendo
certos.

O oráculo é `tools/sorteio.test.mjs`, Node puro, no `apk.yml` **sem
`continue-on-error`**: o operador toca UM botão e a faixa entra em cena, sem tela
intermediária e sem ninguém conferir a lista antes.

#### O que entra no pool, e por construção

| Fica de fora | Como |
|---|---|
| **as séries** | `temLetra(coll)` — a pergunta é pela CAPACIDADE, nunca por `kind === 'serie'`. Um episódio são ~300 MB no lugar do louvor |
| **pastas do aparelho e Favoritos** | eles não são coleções, são LISTAS: `allCollections()` não os conhece |
| **faixa sem a variante pedida** | `semAudio` / `has_instrumental_music && !semPlayback` — sem essa guarda a faixa entra, o download não acha URL, e o cartão responde *"sem internet para baixar"*, que é a frase errada |
| **o hinário**, se o operador pedir | `collNumbersSongs(coll)`. É OPÇÃO, não regra — foi assim que ele pediu |

#### A palavra é MOMENTÂNEA; os filtros são AJUSTES (v5.308)

A caixa é **limpa a cada fechamento** e a palavra **não é gravada** — só as
outras cinco escolhas são (modo, variante, os dois filtros, quantidade). A
diferença é o que cada uma significa: aquelas são *como o recurso deve se
comportar*, e a palavra é uma *pergunta*, feita uma vez. Reencontrá-la em
fevereiro é um filtro silencioso sobre o primeiro sorteio de quem só queria
abrir e tocar.

A limpeza mora em `fecharSorteio`, e é ali porque essa é a única função que os
**três** caminhos de fechamento alcançam (o ✕, o toque no fundo e o voltar do
aparelho) — é o que a tabela `POPUPS` garante.

**Vazia, a caixa sorteia do acervo INTEIRO**, e a frase o diz liderando com o
escopo em vez do número: com o campo em branco é o escopo que está em dúvida.
Ela é honesta sobre os dois filtros que encolhem o "tudo" — dizer "toda a
biblioteca" com o hinário fora seria uma frase errada, e frase errada é pior que
nenhuma:

| Filtros | A frase |
|---|---|
| nenhum | `Toda a biblioteca — 58 músicas` |
| sem hinário | `Toda a biblioteca, sem o hinário — 18 músicas` |
| só no aparelho | `Só o que já está no aparelho — 17 músicas` |
| os dois | `Só o que já está no aparelho, sem o hinário — 5 músicas` |

A **variante** (Cantada × Playback) fica de fora dessa conta de propósito: ela
não encolhe um acervo, escolhe QUAL faixa de cada música — e o segmento logo
acima já a mostra. O placeholder responde a mesma pergunta antes de o operador
tocar em nada: *"Palavra tema (vazio = toda a biblioteca)"*.

**A palavra vale no MESMO toque.** O `debounce` cobria a atribuição também, e
digitar e tocar no botão dentro dos 130 ms sorteava com a palavra ANTERIOR — sem
erro e com a conta mostrando o número certo, porque ela e o sorteio liam a mesma
variável defasada. Hoje só o RECONTAR é adiado.

A palavra tema casa em **três lugares, do mais específico ao mais amplo**: nome
da faixa → nome do ÁLBUM → letra. O álbum no meio é a diferença entre "busca" e
"tema": um álbum chamado "Natal" **é** o tema, e as faixas dele raramente repetem
a palavra no título. A letra só é varrida acima do piso do `LYRIC_MIN_Q`, o mesmo
da busca.

#### O que já está no aparelho vem PRIMEIRO, sempre

`AVSorteio.sortear` particiona o pool em baixado × por baixar, embaralha **as
duas** e concatena. Não é otimização: uma fila de dez faixas por baixar é a
congregação esperando a rede da igreja no meio do culto.

A preferência é ABSOLUTA, e o preço está dito na tela: com três faixas baixadas
e nenhum filtro, "sortear uma" sai dessas três até que outras sejam baixadas. Por
isso o contador mostra as **duas metades** ("12 faixas casam · 3 já no aparelho ·
sorteia 5") em vez de um número só, e por isso o chip "Só no aparelho" existe —
ele torna a escolha explícita em vez de deixá-la implícita numa ordenação.

**A segunda partição também embaralha**, e isso não é simetria: sem ela o que
completa a fila sai na ordem do acervo — sempre o mesmo álbum — justamente no
aparelho recém-configurado, onde nada está baixado e ela é a única que
contribui.

#### A espera do índice de letras é OBRIGATÓRIA aqui

Na busca, `ensureLyricIndex()` é disparado e esquecido: o índice chega e a lista
se redesenha (`renderSearchResults` é síncrona, roda a cada tecla e não pode
esperar o IDB). **Aqui não há redesenho que conserte depois** — o toque no botão
manda a faixa para o telão. Sortear com o índice pela metade produziria um
sorteio que IGNORA a palavra tema e projeta mesmo assim.

Por isso `ensureLyricIndex()` passou a **devolver a promessa** (quem a ignora
continua exatamente como antes), `executarSorteio` a espera, e `abrirSorteio` a
dispara ao abrir a folha — o único instante em que a espera não custa nada,
porque o operador ainda está escolhendo o modo.

#### Fundo musical sorteado é SOM DE FUNDO (v5.311, renomeado na v5.313)

Pedido do operador: *"quando for apenas uma música ou playlist de playback,
quero que trate eles como apenas áudio, sem aparecer nada na tela… essa função é
para som de fundo"*.

**A cortina já faz exatamente isso, e é por isso que não há mecanismo novo.**
`view: 'wallpaper'` põe o wallpaper por cima, e o `#lyrics` do Display vive no
MESMO z-index dos layers de mídia — a cortina cobre os dois de graça. O áudio
segue tocando: ela é visual. E **viaja dentro do `load`**, então o telão nunca
chega a desenhar a letra para escondê-la um quadro depois. Nada de campo novo no
barramento, nada de `SHELL_VERSION`, e a tela da rede herda (roda o mesmo
`display.js`).

**A decisão é explícita nos DOIS sentidos** (`cortinaDoSorteio` decide,
`acertarCortinaDoSorteio` aplica), e não só "ligar quando fundo musical": quem
sorteou um fundo musical fica com a cortina posta, e o sorteio seguinte de uma
CANTADA precisa revelá-la — senão o louvor entra sem imagem e sem letra por
causa de uma escolha de dois minutos atrás. **O sorteio diz o estado do telão em
vez de herdá-lo.**

**"Ao Cronograma" não mexe na cortina**: ele guarda, não projeta — e por isso o
PACOTE a carrega no descritor (ver abaixo), para aplicá-la no dia em que for
aberto.

A folha **anuncia** o que vai acontecer, e só com o fundo musical escolhido — que
é quando a pergunta existe: *"Fundo musical: toca sem letra e sem nada no
telão."*

##### O rótulo é "Fundo musical", e o VALOR continua `playback` (v5.313)

Pedido do operador: *"ajuste o nome de 'playback' para 'fundo musical' … pois ela
reflete melhor o propósito do filtro"*.

São duas perguntas diferentes, e é por isso que a folha de UMA música continua
dizendo "Playback": lá o rótulo nomeia o **arquivo** que se vai tocar (a gravação
sem voz, ao lado da cantada); aqui ele nomeia o **propósito da fila inteira** —
som por baixo do culto, telão coberto —, que é exatamente o que a cortina faz.

**O valor guardado continua sendo `'playback'`** (`AVSorteio.VARIANTE_PLAYBACK`),
e isso não é descuido: ele é a preferência já gravada nos aparelhos **e** o
argumento de `resolveSongMediaId`, onde qualquer coisa diferente de `'full'`
resolve o `fileIdPlayback`. Renomear o valor junto com o rótulo trocaria a
variante de todo mundo que já escolheu, em silêncio. `sorteio-tela.test.mjs`
trava as duas metades: o rótulo que aparece e o valor que não muda.

#### Montando a fila há DOIS desfechos (v5.306)

Eles não são duas versões da mesma ação, e é isso que justifica o segundo botão:

| Botão | O que faz | O que NÃO faz |
|---|---|---|
| **Tocar agora** | `AVDB.listSet('playlist', ids)` + `send` do primeiro — o caminho do `abrirPacote` | — |
| **Ao Cronograma** | acrescenta **UM PACOTE** à lista `imports` (v5.313) | não substitui a fila do player, não projeta, não fecha a folha |

Pedido do operador: *"vai direto para a playlist do player, para ser tocada"*
(v5.303) e, depois, *"coloque dois botões, um de tocar agora e outro para
adicionar ao cronograma"*. Montar o louvor da semana numa terça e projetar no
domingo são dois momentos, e antes só o primeiro tinha porta.

Substituir a fila é a mesma semântica de todo "Tocar agora" do acervo, que já
passa por `replacePlaylistWith` — não é uma classe de risco nova. **O Cronograma
nunca é substituído:** ali a ação só ACRESCENTA.

Três decisões que precisam estar ditas:

- **Sorteando UMA SÓ o botão continua sendo um.** "Sorteie uma e guarde" é o
  caminho que a Biblioteca já dá pela gaveta da linha, com a música escolhida à
  vista — aqui seria um destino a mais para uma decisão que o operador toma
  justamente por não querer decidir.
- **Guardar NÃO fecha a folha.** É o princípio das listas de destino do acervo:
  uma ação que guarda não encerra a conversa, e o segundo sorteio é o uso normal
  (acrescenta cinco, olha a lista, acrescenta mais cinco). Fechar cobraria três
  toques por rodada.
- **Cancelar tem sentidos OPOSTOS nos dois botões, e está certo.** No "Tocar
  agora" ele descarta: trocar a fila do culto por meia lista é uma
  SUBSTITUIÇÃO pela metade. No "Ao Cronograma" ele preserva o que já desceu:
  três de dez é exatamente o que aconteceu, e jogar fora um download que já
  custou rede seria desperdício.

##### O Cronograma recebe UM PACOTE, não N linhas (v5.313)

Pedido do operador: *"ajuste o envio ao cronograma para que ele não envie um por
um, mas sim um item que seja um pacote de playlist"*.

**E ele não é um tipo de item novo:** é o cue `group` que o botão "Guardar
pacote" da fila já cria — mesmo descritor (`{ ids }`), mesmo desenho de linha,
mesmo `abrirPacote` no toque. Invariante 5 aplicada ao lado web: ponteiro novo
para um mecanismo que existe, nunca um segundo mecanismo.

O que isso resolve é a ESCALA. Dez faixas sorteadas eram dez linhas avulsas no
meio do roteiro — para tirá-las, dez perguntas; para saber que eram um lote,
memória. Uma linha diz o que é, sai num toque, e abre a fila inteira na hora dela.

| Decisão | Por quê |
|---|---|
| **o nome não usa a palavra "sorteio"** | ela já é o nome de outra cena de roteiro (`CUES.draw`), e duas linhas homônimas fazendo coisas diferentes só se descobrem no sábado. `nomeDoPacoteSorteado` produz *"Playlist “natal” · 5 músicas"* / *"Fundo musical da biblioteca · 3 músicas"* |
| **a CORTINA viaja no descritor** (`data.view`) | guardar não projeta, então a decisão precisa sobreviver até o dia da abertura — sem ela um pacote chamado "Fundo musical" abriria em setembro com a letra no telão, desmentindo o próprio nome. `abrirPacote` a aplica; **ausente não mexe em nada**, que é o pacote montado à mão pela fila (ele nunca prometeu nada sobre o telão e não pode começar a prometer por causa deste campo) |
| **os `ids` dentro do cue não viram órfãos** | a mídia do sorteio vive no store **`files`** (`resolveSongMediaId` devolve o `fileIdFull`/`fileIdPlayback` do hinário, e `getMedia` cai no `fileGet`), e o coletor lê listas + Favoritos e apaga só do store `media`. Quem manda na vida deles é a coleção que os baixou, como antes |
| **cada sorteio é um pacote NOVO** | antes a dedução era por id e o segundo sorteio só acrescentava o que faltava. Um pacote é o INSTANTÂNEO de uma tirada; dois lotes no roteiro são dois lotes, e continuam saindo num toque cada. `criarCue` ainda avisa quando o conteúdo é idêntico |
| **`f` é passado a `guardarSorteadasNoCronograma`** | e não `sorteioPrefs`: a folha fica aberta durante o download, e mexer num controle ali reescreveria as preferências — o pacote sairia com o nome de uma escolha que ninguém sorteou |

#### O lote de download

- **UM consentimento** (`ensureDownloadConsent`) para a fila inteira, nunca um
  por faixa.
- **UMA tarefa** de notificação (`bgTaskStart` com o total), senão a barra
  reinicia do zero a cada download; tudo dentro de **um** `withBgWork`.
- **Em série, não em paralelo.** Seis downloads simultâneos é o que a
  sincronização de um álbum faz, e ali ninguém espera; aqui a primeira faixa tem
  de tocar o quanto antes.
- **Uma faixa que não desce não derruba a fila** — as outras ainda tocam, e é
  isso que separa "a playlist saiu menor" de "não aconteceu nada".
- **O cancelar** do cartão da preview para a fila **entre** faixas: o download em
  curso termina, porque interrompê-lo no meio deixaria um parcial.

#### A conta é a única chance de ver antes de acontecer

O botão dispara sem mais nenhuma tela, então a linha do contador é onde o
operador lê o que vai acontecer. Ela responde a **duas perguntas de pesos
diferentes** — *o tema achou o quê?* e *quanto disso toca agora?* —, e por isso
são **duas linhas com hierarquia** e não uma frase com separadores (v5.306,
pedido do operador: *"mais funcional e menos técnico"*):

```
28 músicas relacionadas a “natal”          ← --text, peso 600
A playlist leva 10 · 1 para baixar         ← --muted
```

O custo é **exato, não uma estimativa**: o sorteio esgota as baixadas antes de
pegar as que faltam, então quantas precisam de rede é uma subtração.

Ela saía como `12 faixas casam · 3 já no aparelho · sorteia 5` — três números no
vocabulário de quem escreveu a regra, empilhados numa linha só, disputando o
mesmo peso.

Vazia, ela diz o **motivo dominante** — sem ele, "nada encontrado" tem cinco
causas que pedem ações opostas (trocar a palavra, desligar um filtro, trocar a
variante, abrir a Biblioteca com internet).

**Nas COLEÇÕES a régua é OUTRA: acionabilidade, nunca contagem**
(`motivoAcionavelDasColecoes`, sobre `pool.colecoesRecusadas`). A ordem é fixa —
`sem-indice` vence sempre, depois `hinario`, e `sem-musica` por último —, e ela
não é gosto: `ehMusica` é o `temLetra`, então TODA série do YouTube é recusada
por `sem-musica`. Num aparelho com duas séries e um hinário ainda sem índice, o
motivo mais NUMEROSO é `sem-musica`, e a tela afirmaria "nenhuma coleção de
música neste aparelho" com o hinário inteiro instalado — falso, e sem ação
possível. `sem-indice` é a única frase que diz ao operador o que fazer.

Antes disso a frase saía do filtro que por acaso estava ligado: com "Sem
hinário" marcado E as coleções recusadas por falta de índice, ela dizia "só há
hinário neste aparelho" — o operador desligava o filtro, continuava vazio, e
nada dizia que faltava carregar a biblioteca. Quem sabe por que cada
coleção ficou de fora é `AVSorteio.avaliarColecao`, e é dela que a frase sai.

**A frase de resposta do "Ao Cronograma" mora em ESTADO, não no nó.** O
`executarSorteio` redesenha a folha no `finally`, e um texto escrito direto no
span era apagado no mesmo quadro em que nascia — o "adicionadas ao Cronograma"
nunca chegava a ser visto. Guardá-la em `sorteioFala` e deixar
`pintarContaSorteio` consultá-la faz qualquer redesenho preservá-la, inclusive um
caminho de render que ainda não existe.

Vazia, a linha do contador ganha **ênfase, não alarme**: `--muted` → `--text`
com peso 600, e nunca a família do vermelho. "Nada casa a palavra tema" é o
desfecho normal de quem acabou de digitar uma palavra, e "nenhuma coleção com
índice" é um aparelho recém-configurado — nenhum dos dois é "está no ar agora"
nem "ação destrutiva", que é o que o vermelho significa neste app.

O veredito completo vai para o **Registro** (`blocoSorteio`), ao lado do bloco
das séries: coleções vistas × usadas e as recusas por motivo, faixas vistas ×
sorteáveis, onde cada uma casou, e os nomes escolhidos na ordem em que foram para
a fila. Ele guarda a palavra **CRUA e a normalizada** — a diferença entre as duas
já explicou uma busca que "não achava nada".

#### Duas escolhas de desenho que precisam estar ditas

- **"Cantada" e "Playback" são um SEGMENTO, não dois filtros.** O operador
  descreveu os dois como filtros ("músicas cantadas", "apenas áudio
  instrumental"), mas eles são os dois valores da MESMA pergunta: marcar os dois
  não significa nada e não marcar nenhum precisa significar alguma coisa. Como
  segmento a escolha é sempre uma — e é o mesmo par, com os mesmos rótulos, que a
  folha de uma música do acervo já oferece.
- **Ele ABRE a barra, e o ✕ continua fechando-a** (v5.305, pedido do operador).
  A linha passa a ser lida como uma frase: *sortear · procurar · sair*. Entre o
  campo e o ✕ ele era um terceiro elemento no canto em que o app inteiro põe a
  SAÍDA, e a vizinhança dizia "mais um jeito de fechar isto".
- **A cor do ícone é `--field-accent`, NUNCA `--accent`.** O botão vive sobre o
  CAMPO, que é branco literal e **sem tema**; `--accent` é redeclarado por tema e
  no escuro vale `#95b5f4`, o azul claro desenhado para o fundo quase-preto do
  app — sobre este branco, **2,06:1**, abaixo do piso de 3:1 de componente. É a
  mesma armadilha que `--field-text` e `--field-muted` já resolviam para o texto
  e o placeholder; o acento era o terceiro consumidor que faltava. Medido:
  **7,70:1**, ao lado dos 8,86:1 do ✕. O `sorteio-tela.test.mjs` mede a cor
  COMPUTADA nos dois temas — comparar NOMES de token deixaria isto passar por
  baixo.
- **O ícone é um DADO DESENHADO, nunca as setas cruzadas.** As setas já são o
  "Aleatório" do botão de repetição, a três centímetros daqui: dois desenhos
  iguais prometendo coisas diferentes na mesma tela é o defeito que nenhuma
  legenda conserta.

  Ele nasceu como o **glifo** `casino` (e30c) e saiu ao ar **sem desenho
  nenhum** — o subset da fonte tem 31 codepoints e aquele não está entre eles.
  Um codepoint ausente não desenha nada: sem erro no console, sem requisição
  falhando, só um vão do tamanho de um ícone. É a mesma armadilha do `edit`
  (ver `pencilIconSvg`), e a resposta é a mesma: um `<symbol id="icoSorteio">`
  no sprite do `index.html`, com UMA definição e duas referências (a barra e o
  cabeçalho da folha).

  **A partir daqui ela tem oráculo**: `tools/glifos.test.mjs` lê o `cmap` do
  próprio `.woff2` e cobra todo `.msym` do bundle contra ele — Node puro, no
  passo que BARRA o build, porque um ícone invisível chega à frota pelo OTA e
  só é descoberto por quem opera.

### "Pesquisar <texto> no YouTube", no fim da busca

O acervo é o LouvorJA, e ele não tem tudo. `appendYoutubeSearch` leva a busca
PRONTA para o YouTube e devolve o operador ao ponto em que o `intent-filter` de
share já sabe receber o vídeo — sem isso a saída era sair do app, abrir o
YouTube, **digitar tudo de novo** e compartilhar de volta.

- **Em todos os desfechos da busca**, inclusive (e principalmente) "Nada
  encontrado", que é quando a pergunta "e agora?" aparece. Não aparece enquanto
  se FOLHEIA o acervo (sem texto não há o que pesquisar).
- **O texto vai entre aspas** porque é ele que diz que o toque leva ISTO, e não
  abre o YouTube na página inicial. Entra por `textContent`, nunca `innerHTML`:
  é texto digitado pelo operador.
- **Uma LUPA, não o logotipo do YouTube.** O que o botão faz é uma busca;
  desenhar a marca de outro app promete que ele abre lá dentro em algum lugar
  específico.
#### A BUSCA DO YOUTUBE ACONTECE AQUI DENTRO

Num shell ≥ 18 o botão **não sai do app**: `AVNative.ytSearch(termo)` devolve os
resultados e eles entram **na mesma lista**, abaixo do acervo, com miniatura
16:9, título, canal e duração.

- **O pedido sai em PORTUGUÊS, e o caminho não é o óbvio.** A localização padrão
  da biblioteca é **en-GB**, e o YouTube TRADUZ o título quando há tradução —
  uma busca por louvor brasileiro voltava com títulos em inglês de vídeos cujo
  título ORIGINAL é em português.
  - `Localization("pt","BR")` no `NewPipe.init` **não adianta**:
    `StreamingService.getLocalization()` FILTRA o pedido pela lista de idiomas
    suportados, e a do YouTube tem um item só, `"en-GB"` (o resto comentado no
    fonte). Qualquer outro cai no `Localization.DEFAULT`, em silêncio: o código
    PARECE certo. (O país escapa do filtro, então metade do pedido chegava.)
  - A saída é `forceLocalization`/`forceContentCountry` no próprio `Extractor` —
    `getExtractorLocalization()` lê o forçado ANTES da lista. Isso exige montar o
    extrator à mão nos dois caminhos (`getStreamExtractor` e
    `getSearchExtractor`) em vez dos atalhos `getInfo(service, …)`, e no da busca
    **chamar `fetchPage()`**: `SearchInfo.getInfo(extractor)` é o único dos
    `getInfo` que NÃO busca a página sozinho, e sem isso a lista volta vazia, sem
    erro.
  - O código é `"pt"`, não `"pt-BR"`: a lista que a biblioteca guarda como os
    `hl` aceitos tem "pt" e "pt-PT", e com o `gl=BR` "pt" é o do Brasil.
  - `Accept-Language` acompanha no `NpDownloader`: quem manda é o `hl` do corpo
    InnerTube, mas nem toda requisição é InnerTube, e nas páginas HTML é o
    cabeçalho que decide.
  - **Fixo, nunca herdado do `Locale`**: o que se quer é o título ORIGINAL.
- **Quem pesquisa é o Kotlin** (`YoutubeGrab.pesquisar`), não o WebView: ali não
  existe CORS e a requisição sai do IP do aparelho. As alternativas não serviam —
  um `<iframe>` da página de resultados é recusado pelo `X-Frame-Options`, e a
  API oficial exigiria chave embutida no APK com cota dividida pela frota.
- **Só vídeos** no filtro: canal e playlist não têm o que fazer numa lista cujo
  destino é virar arquivo de mídia.
- **O nome do canal sai da frente do título** (`tituloLimpo`). Meio YouTube
  publica como "Arautos do Rei - Firme nas Promessas", e no Cronograma isso vira
  uma lista em que a metade esquerda de toda linha é a mesma palavra. A remoção é
  CONSERVADORA (só corta quando o título começa exatamente com o nome do canal
  seguido de separador, então "Hino 512 - Ao Deus de Abraão" fica inteiro) e o
  sufixo `- Topic` é descontado antes da comparação, senão ela nunca casaria nos
  vídeos de louvor. O canal continua no subtítulo.
- **A miniatura é montada a partir do ID** (`i.ytimg.com/vi/<id>/mqdefault.jpg`)
  em vez de vir da biblioteca: URL estável há mais de uma década, e assim o
  formato das imagens do extrator não pode quebrar a lista.
- **Chegar no fim da lista já pesquisa** (`armarAutoBuscaYt`): rolar até o fim do
  que o acervo tem É o gesto de quem não achou. A espera de 500 ms não é enfeite
  — a lista é reconstruída A CADA TECLA e com poucos resultados a sentinela nasce
  visível: sem ela a busca dispararia com o termo pela metade, uma vez por letra.
- **O cabeçalho de seção (`.yt-head`) faz três papéis**: é a SENTINELA que o
  observador vigia (por isso precisa de altura de verdade — um `li` de altura
  zero é uma aposta na forma como o navegador trata interseção de área nula), é o
  sinal de busca em curso, e é o rótulo que separa acervo de resultados. O
  alinhamento à ESQUERDA e o peso são o que o fazem ler como título de seção.
  Pela mesma razão a negativa do acervo diz o escopo ("Nada encontrado na
  biblioteca"): com o cabeçalho do YouTube abaixo, uma negativa sem escopo parece
  negar a busca inteira.
- **O botão manual continua onde é a única saída**: navegador e shell < 18 (e ali
  a auto-busca não acontece — tirar o operador do app sem ele pedir seria outra
  coisa). Ele exige shell ≥ 15 (`AVNative.openExternal`) e **não é desenhado**
  abaixo disso: o WebView recusa navegar para fora do origin, então o toque não
  faria nada, nem erro no console.
- **O toque num resultado abre a MESMA folha de destinos das músicas do acervo.**
  "Tocar agora" FECHA a Biblioteca (o cartão de progresso mora na preview, atrás
  desta folha); as de "adicionar" a MANTÊM aberta — quem busca vai pegar mais de
  um —, e ali a linha termina marcada como CONCLUÍDA (✓ verde sobre a miniatura)
  em vez de voltar ao estado inicial, que parecia "nada aconteceu".
- **O estado de cada linha vive num Map (`ytEstado`)**, nunca na classe do nó: a
  lista é reconstruída a cada tecla e a marca sumiria com o download correndo (a
  razão do `songRowBusy`). Concluído fica APAGADO, não desabilitado: o mesmo
  vídeo pode ser querido de novo.
- **Cada escolha vai só para o SEU lugar.** A lista de destino é decidida no
  `ytAcao` e entregue ao `addMedia`, que grava registro e entrada na MESMA
  transação — a lista passou a ser ESCOLHIDA, não dispensada, para o registro
  nunca nascer órfão. "Tocar agora" vai para `avulsos`.
- **O mesmo vídeo não baixa duas vezes** (`ytArquivo`): o registro guarda o
  `youtubeId` desde que nasce, então "já tenho isto?" é uma leitura do índice
  (`AVDB.mediaByYoutube`). Só vale para quem tem **blob** — um item de LINK
  carrega o mesmo `youtubeId` e é o que o download existe para substituir.
- **O resultado que já está no aparelho nasce marcado** (`marcarYtProntos`): o ✓
  diz as duas coisas. É assíncrono, e o estado mora no `ytEstado`, logo sobrevive
  ao render.
- **No SIMPLIFICADO não há folha: o toque toca.** As outras opções são listas que
  aquela tela não mostra. Vale para tudo o que é compartilhado nesse modo — e a
  prateleira `avulsos` nunca poda o LOTE que acabou de entrar: um share de cinco
  arquivos com o limite aplicado item a item faria o quinto expulsar o primeiro,
  que é justamente o que vai ser projetado. A fixação é UMA por share.
- **Onde o aviso aparece tem TRÊS destinos, não dois.** Tocar: cartão sobre a
  preview. Cronograma: linha provisória na lista. Playlist: **nenhum dos dois** —
  ela mora dentro de uma bandeja fechada, e desenhar a provisória no Cronograma
  prometeria um item que nunca vai aparecer lá.

**Nome normalizado uma vez, não por tecla** (`s._norm`, gravado por
`fetchCollectionIndex` e preenchido sob demanda no filtro): `normalizeForSearch`
faz `normalize('NFD') + replace + toLowerCase` — três alocações de string sobre
um valor que nunca muda, antes repetidas para CADA música do acervo A CADA TECLA.
Os campos de busca também têm **debounce** (`SEARCH_DEBOUNCE_MS` = 130 ms).

**A linha de resultado** (`hymnResultRow`) é `[indicador] [nome / subtítulo]`,
com a fonte maior que a do resto (`.hymn-name`) porque a lista precisa ser
legível de relance no meio do culto. Tocar na LINHA abre a gaveta logo abaixo,
em **acordeão** — abrir uma fecha a anterior: duas abertas ao mesmo tempo
empurrariam a lista e tirariam do lugar o que o operador estava mirando.
#### UMA LINHA, UM TOQUE, UMA GAVETA

```
 ┌────────────────────────┐
 │ [·] Ó Adorai o Senhor    │ ← 83% da linha para o nome
 ├────────────────────────┤
 │  Tocar agora           │
 │  [Cantada|Playback|Letra] │  as OPÇÕES
 │  Adicionar à playlist  │
 │  … + [Ver a letra]     │  → ABRE O LEITOR (numa MÚSICA)
 └────────────────────────┘

 num VÍDEO, a metade de baixo continua:
 ├────────────────────────┤
 │  [miniatura] 20:00     │  o detalhe do episódio
 │  Toca sem baixar       │
 └────────────────────────┘
```

Um alvo só, e a lista inteira do outro lado. Com dois botões na linha (um ▶ e um
`+`, cada um abrindo metade das escolhas), decidir *"o que fazer com este hino?"*
exigia primeiro decidir **qual dos dois era o dono da pergunta** — e essa é uma
pergunta sobre a UI, não sobre o culto.

- **NUMA MÚSICA A GAVETA É SÓ AS OPÇÕES** (v1.2.25), e "Ver a letra" abre o
  **leitor** — a mesma folha do transporte, apontada para aquela faixa
  (`lvItemDaBiblioteca`, ver "A folha não é mais de quem está no ar"). A caixa de
  texto que ficava aqui embaixo era uma SEGUNDA leitura, pior que a que o app já
  tem: sem cifra, sem tom, sem corpo de fonte e sem rolagem — e o caminho para a
  boa era PROJETAR a música, que é justamente o que o operador pediu para não
  precisar fazer. Reusar, nunca reconstruir: uma segunda folha divergiria da
  primeira no primeiro ajuste. Sem fonte forçada — a folha abre na LETRA, com a
  Cifra ao lado; quem veio da gaveta veio de uma lista de músicas, não dos
  acordes.
- **NUM VÍDEO A METADE DE BAIXO FICA:** ali ela é a miniatura, a duração e o
  estado no aparelho — o que responde *"é este mesmo?"* num item sem letra —, e o
  mesmo botão continua sendo o interruptor dela ("Ver / Ocultar os detalhes",
  duas frases empilhadas numa grade 1×1 para a largura não mudar sob o dedo).
  Quem decide é `temLetra(coll)`, nunca `ehSerie`. Quem some fechado é o
  ENVELOPE (`.hymn-gaveta`), nunca cada metade: a animação do acordeão mede
  `offsetHeight` de UM elemento, e com duas caixas irmãs aparecendo por conta
  própria a medida seria de meia gaveta.
- **Nada de menu foi reimplementado.** `renderSongMenu` e `openYtMenu` ganharam
  PARA ONDE escrever (`songMenuFor.alvo`, que viaja no ESTADO porque cada
  remontagem — o seletor, cada marca de destino — precisa refazer a lista no
  mesmo lugar), e o modo `tudo` empilha tocar e adicionar numa lista só. A folha
  `#songMenuPopup` continua de pé com os dois donos que sobraram: os resultados
  do YouTube e o seletor de destinos da importação.
- **Um episódio de SÉRIE desvia para a lista do YouTube**, como a folha já fazia.
- **O quadrado da esquerda é INDICADOR, não botão.** Ele fica porque hospeda o
  anel de download — a única coisa que aquele canto sempre informou de verdade —
  e porque segura a coluna que alinha a lista. Perdeu o `--accent-soft` e o
  `cursor: pointer`: um alvo que não é alvo, num canto onde o dedo mira, é pior
  que não ter nada.
- **O oráculo do ALVO afirma que TODO ponto da linha leva ao mesmo lugar** —
  cantos, bordas e o quadrado onde o ▶ vivia — e conta `button` sem conhecer
  nomes, para valer contra o próximo que aparecer.
- **No simplificado nada disso aparece:** o toque na linha chama `simplePlaySong`
  direto, que é a decisão que aquele modo poupa.

**O SELETOR DECIDE O QUÊ; AS OPÇÕES, ONDE.** O seletor tem três segmentos
(Cantada · Playback · **Letra**) e aparece SEMPRE — ele já dependeu de haver
playback, e toda música tem letra. Com "Letra" escolhida, "Tocar agora" projeta a
letra e cada lista recebe a CENA de letra (`addLyricCue`, que aceita várias
listas), o que torna "Só a letra, no Cronograma" redundante. Sem essa divisão a
variante aparecia duas vezes, uma como segmento e outra como linha.

**Duas armadilhas que a lista trouxe ao mudar de casa**, e as duas são "algo que
ela deixou de herdar":

| Sintoma | Causa |
|---|---|
| marcadores de lista à esquerda | a `<ul>` nova não herdou `list-style: none` de ninguém (a do popup é `.popup-list`, que já o tinha). Não vinha de regra do app: era a **ausência** de uma |
| o feedback de toque encolhia a gaveta inteira | o `:active` do `.lib-item` satisfeito por um botão DENTRO dele |

**A gaveta é um POÇO, soldado à sua linha.** Medido no tema escuro, com o
`--panel` da folha antiga: `--panel` compõe rgb(44,52,60) e a faixa de uma linha
vizinha compõe rgb(46,54,63) — **1,03:1**, isto é, a seção aberta tinha
literalmente a cor das linhas de baixo, com a margem em volta deixando passar a
faixa da própria linha como moldura (três tons indistinguíveis empilhados).

O tom é um par por tema (`--gaveta-bg`/`--gaveta-btn`), e a inversão é
aritmética:

- **escuro** — só dá para DESCER. Subir levaria a `--panel-2`, que é a cor do
  card do álbum, a que aparece nos vãos entre as linhas. Par: `--bg` × `--panel`.
- **claro** — só dá para SUBIR. Descer para `--bg` deixaria a gaveta a 1,09:1 do
  card. Par: `--panel` (branco) × `--panel-2`.

É o precedente do `--field-bar` num lugar novo: **uma superfície cuja direção não
acompanha a escada precisa de um token próprio em cada tema.** E os BLOCOS que
descansam nela vestem `--gaveta-btn` em vez do `--surface` de fábrica, porque
aquele é um OVERLAY — dentro de uma seção da Biblioteca ele resolve para o par
SUNK, e preto sobre um poço que já é o tom mais escuro do app não produz degrau.

**A gaveta não tem margens.** Ela é filha do `.lib-item`, que já pinta a linha
inteira e recorta pelo `border-radius` com `overflow: hidden` — coladas, faixa e
gaveta viram UM bloco com o título em cima e o poço embaixo. O respiro vem do
`padding` da lista de opções.

**A caixa de marcação se vê sem estar marcada** (`--check-vazio`): 1,08:1 contra
o botão em que mora → 1,28:1. Token com TEMA e não o `--scrim` compartilhado (no
claro aquele .6 seria uma lápide), e ainda um RECESSO. O teto é do tema escuro:
preto sobre um botão já escuro comprime a razão por construção.

**A largura do "Ver/Ocultar a letra" não muda com o estado.** "Ocultar" é mais
longo que "Ver": o botão crescia ao ser tocado (110px → 143px) e o CONFIRMAR ao
lado encolhia junto. As duas frases ocupam a MESMA célula de uma grade 1×1 — a
largura é a da maior. **`visibility` e não `display`**, porque a escondida
precisa continuar MEDINDO: é ela que reserva o espaço. Um `min-width` em `ch`
seria um número a manter contra a fonte e contra a tradução; isto não tem número.

Tocar (`playSongVariant`) e os três destinos (`addSongToDestinos` →
`adicionarNasListas`) baixam a música na hora se ainda não estiver offline — e o
download é **um só** por toque, mesmo com os três destinos marcados: o caro é
resolver o id, e o item resultante é o MESMO em todas as listas. O funil é um:
`listasDosDestinos` → `adicionarNasListas`. **"Letra"** baixa também, mas só
quando precisa: a letra costuma já estar no acervo de textos.
### O download vira estado da tela

Tocar uma música que ainda não está no aparelho abre um download de dezenas de
segundos, e o toque precisa mudar a tela AGORA. Duas metades:

1. **A resposta é imediata e igual à de uma música já baixada.**
   `closeSongMenu()` e `closeHymnSearch()` ficam no **começo** de
   `playSongVariant` (e de `projectSongLyricsOnly`), ANTES do `await`.
2. **A espera aparece na miniatura da preview** (`previewBusy` → `#pvBusy`): é
   ali que a mídia vai aparecer. Um aviso na tela principal seria mais um cartaz
   avulso a interpretar.

- **É um CARTÃO no meio, não uma cortina.** A preview espelha o telão e precisa
  continuar espelhando enquanto a próxima música baixa. O cartão é opaco por
  conta própria — com véu translúcido a marca do wallpaper atravessava o texto.
- **Só acende depois de `PV_BUSY_DELAY_MS` (180 ms)**: uma música já baixada
  resolve em poucos ms, e um cartão que pisca lê-se como falha.
- **O contador é um número, não um booleano** (`pvBusyCount`): dois downloads
  simultâneos, e o primeiro a terminar não pode apagar o indicador do outro.
- **A ação e o nome são campos separados** (`Baixando` em caixa alta miúda, o
  nome embaixo): numa caixa de ~250px a frase inteira estoura a linha.
- **O cartão desvia dos `.pv-fab`** (padding-right 38px) e **não aparece na tela
  cheia**, onde a preview É a projeção e ele iria para o telão.
- **No simplificado sem tela conectada ele não existe** — a preview não está na
  tela —, e por isso `previewBusy` devolve `{ visivel, soltar }`.

#### Adicionar a uma lista: a marca vai para a LINHA

Adicionar também dispara download, e ali a preview é o lugar errado: a Biblioteca
**continua aberta de propósito** (adicionar três músicas seguidas é o uso normal)
e nada vai para a preview. O indicador vai para o quadrado da própria linha.

- **É o MESMO anel** (`.dl-ring`, com `--dl-ring` dando o tamanho): dois
  spinners para a mesma espera fariam o operador perguntar se são coisas
  diferentes.
- **Quem acende é `ensureSongDownloaded`**, logo DEPOIS da checagem
  `needsFull || needsPlayback` — o único ponto que já sabe que há download de
  verdade. Acender no chamador exigiria repetir a checagem e piscaria em toda
  música já baixada. Como efeito, **todo caminho que baixa sob demanda ganha a
  marca sem precisar lembrar dela**.
- **O estado vive num `Map`, não na classe do botão** (`songRowBusy`, contado
  por música). A lista é RECONSTRUÍDA durante o download (o progresso redesenha
  a cada 400 ms), e uma classe escrita no nó sumia no redesenho seguinte:
  a linha voltava ao ocioso com o download correndo. `hymnResultRow` relê o Map
  ao montar (a linha carrega `data-song`). Contado, porque adicionar a mesma
  faixa a dois destinos abre dois pedidos.
**Resolução do id de mídia por variante** (`resolveSongMediaId`) é
**offline-first com download sob demanda**: variante já baixada → id do catálogo
OPFS direto (zero-cópia); senão, `ensureSongDownloaded` baixa a música **de
verdade** ali mesmo (a mesma `downloadCollectionSong` da sincronização em massa —
áudio + capa + letra, pronto para tocar offline dali em diante), nunca um
registro temporário. `songDownloadInFlight` (Map por `<coll.id>:<id_music>`,
sessão) evita dois downloads da mesma música em paralelo.

> **Nota de rede**: a API de produção precisa aceitar CORS para a origin em que a
> base roda — no aparelho, `https://appassets.androidplatform.net`. Não
> verificado em produção: a rede das sessões de desenvolvimento não alcança
> `api.louvorja.com.br`. Se o `fetch` falhar por CORS, a sincronização e a busca
> ao vivo param — mas não a busca no índice já baixado, que é toda em memória.

#### Letra sincronizada (slides + temporizador)

Cada variante baixada (registro em `files`, criado por `downloadCollectionFile`)
ganha campos extras, sem exigir bump de `DB_VERSION` (o `files`/`media` guarda
objetos livres de schema):

- `lyrics`: `Array<{ time, text, auxText, cover, imageOpfsPath, imagePosition }>
  | null | undefined` — **sentinela de 3 estados**: `undefined` = nunca
  processado (dispara reprocessamento na próxima sincronização mesmo com o áudio
  já baixado — é o que dá BACKFILL aos hinos sincronizados antes de a
  funcionalidade existir, sem rebaixar áudio); `null` = já processado e sem
  estrofes com tempo utilizável (não tenta de novo à toa); array = o primeiro
  item é sempre o slide de capa (`cover: true`, `text: null`, `time: 0`), os
  demais vêm do mapa `lyric` de `music_{id}` (filtrados por `show_slide`, tempo
  do campo certo — `time` para Cantado, `instrumental_time` para Playback —
  convertido por `parseTimeToSeconds` e ordenado).
- `hymnName`/`hymnTrack`/`hymnAlbum`: título limpo, número do hino e o
  **álbum/coleção de onde a música veio** (`coll.name`) — as três peças do cartão
  de capa. `hymnAlbum` mora no REGISTRO, e não numa consulta na hora de projetar,
  porque quem projeta é o Display: ele só recebe o registro do arquivo e não tem
  acesso a coleção nenhuma. Registro antigo é preenchido na varredura que a
  sincronização já faz (`ensureSongVariant`) e, para a biblioteca que JÁ ESTÁ
  PRONTA, por uma passagem única no lançamento (`preencherAlbunsDosHinos`, no
  molde do `desnumerarAlbunsBaixados`): **os dois pontos de escrita cobrem uma
  biblioteca sendo MONTADA, e nenhum deles alcança a que já existe** — música
  baixada não é baixada de novo, e coleção completa não é re-sincronizada. A
  ligação que a passagem lê já existia (o `folder` de todo registro baixado de
  uma coleção é o id dela), e ela CORRIGE além de preencher, para uma coleção
  renomeada na origem não deixar capas com o nome velho.
  **Não há campo de AUTOR na fonte**: o LouvorJA publica nome, faixa e álbuns —
  e uma linha inventada na frente da congregação é pior que uma linha a menos.
terminar. Ver
"Wi-Fi vs dados móveis" abaixo para a política de quando cada tipo de
download é permitido.

> **Nota de rede**: a API de produção precisa aceitar CORS para a origin em que
> a base roda — no aparelho, `https://appassets.androidplatform.net`, servida
> pelo `WebViewAssetLoader` do shell (ver "Build, distribuição e instalação"); no
> navegador, o que o servidor estático de desenvolvimento usar. Não verificado
> em produção: a rede das sessões de desenvolvimento não alcança
> `api.louvorja.com.br`. Se o `fetch` falhar por CORS, a sincronização e a
> busca ao vivo param de funcionar — mas não a busca no índice já baixado, que
> é toda em memória.

#### Letra sincronizada (slides + temporizador)

Cada variante baixada (registro em `files`, criado por `downloadCollectionFile`)
ganha campos extras, sem exigir bump de `DB_VERSION` (o `files`/`media` do
`shared/db.js` guarda objetos livres de schema):

- `lyrics`: `Array<{ time, text, auxText, cover, imageOpfsPath, imagePosition }> | null | undefined`
  — sentinela de 3 estados: `undefined` = nunca processado (dispara
  reprocessamento na próxima sincronização, mesmo que o áudio já esteja
  baixado — é o que dá **backfill** aos hinos sincronizados antes desta
  funcionalidade existir, sem rebaixar áudio: `ensureSongVariant` só
  recalcula e regrava a letra no registro já existente); `null` = já
  processado, mas o hino não tem estrofes com tempo utilizável (não tenta de
  novo à toa); array = primeiro item é sempre o slide de capa (`cover:true`,
  `text:null`, `time:0`, imagem da música), os demais vêm do mapa `lyric` de
  `music_{id}` (filtrados por `show_slide`, tempo do campo certo — `time`
  para Cantado, `instrumental_time` para Playback — convertido pra segundos
  via `parseTimeToSeconds`, ordenados por tempo).
- `hymnName`/`hymnTrack`/`hymnAlbum`: título limpo, número do hino
  (`s.name`/`s.track`, sem o prefixo/sufixo que `name` carrega pra exibição na
  lista) e o **álbum/coleção de onde a música veio** (`coll.name`, v5.219) — as
  três peças do cartão de capa. `hymnAlbum` mora no REGISTRO, e não numa
  consulta na hora de projetar, porque quem projeta é o Display: ele só recebe
  o registro do arquivo e não tem acesso a coleção nenhuma. Registro antigo é
  preenchido na varredura que a sincronização já faz (uma escrita por registro,
  em `ensureSongVariant`) — e, para a biblioteca que JÁ ESTÁ PRONTA, por uma
  passagem única no lançamento (`preencherAlbunsDosHinos`, v5.220, no molde do
  `desnumerarAlbunsBaixados`): os dois pontos de escrita cobrem uma biblioteca
  sendo MONTADA, e nenhum deles alcança a que já existe — música baixada não é
  baixada de novo, e coleção completa não é re-sincronizada. A ligação que a
  passagem lê já existia: o `folder` de todo registro baixado de uma coleção é
  o id dela. Ela corrige além de preencher, para uma coleção renomeada na
  origem não deixar capas com o nome velho.
  **Não há campo de AUTOR na fonte**: o LouvorJA publica nome, faixa e álbuns
  (ver `docs/FONTE-DE-DADOS-LOUVORJA.md` §5.1), e uma linha inventada na frente
  da congregação é pior que uma linha a menos.

#### O cartão de capa (v5.219)

O primeiro slide de todo louvor sincronizado. Ele era **uma linha** — o título
com o número colado na frente ("147. Ó ADORAI O SENHOR"), pintado em `--brand`,
no lugar exato onde a estrofe apareceria um segundo depois. Hoje são três peças
com pesos diferentes:

```
            ──── 147 ────        ← número, BRANCO, 5,8cqmin, entre dois fios
        Ó ADORAI O SENHOR        ← título, BRANCO, 8,4cqmin, até 3 linhas
        HINÁRIO ADVENTISTA       ← álbum, esmaecido, caixa alta espaçada
```

- **O número é branco, e os FIOS é que levam o acento** (v5.222). Ele nasceu em
  `--stage-accent` — 9,75:1 sobre o preto, aprovado por qualquer régua de
  contraste — e o operador o descreveu como "muito discreto no fundo escuro". As
  duas coisas são verdadeiras ao mesmo tempo, e é o que a régua não pega:
  contraste é razão de luminância, e num telão quem decide é **cor + corpo**. O
  número tinha o menor corpo do cartão somado à única cor não-branca da tela.
  A cor ficou onde não precisa ser lida — os dois fios —, com `background`
  explícito, porque com `currentColor` embranquecer o número teria embranquecido
  os fios junto.

- **O título deixou de ser o elemento colorido da tela.** Num telão de igreja o
  que precisa ser lido do fundo do salão é o NOME, e cor tirada de uma paleta de
  UI nunca rende o que o branco pleno rende (21:1 medidos contra os 9,75:1 do
  acento). O acento ficou nos fios (ver o item seguinte).
- **Cada peça só existe se houver o dado.** Um arquivo importado à mão não tem
  número nem álbum, e a capa dele volta a ser o título centralizado, que é a
  capa de sempre.
- **A caixa da capa CRESCE com o conteúdo** — a única do sistema que faz isso. A
  altura fixa (40cqh) existe para a moldura não pular de tamanho entre estrofes;
  na capa ela produzia o defeito oposto, e ele foi fotografado antes de ser
  corrigido: com o título em duas linhas, `num + título + álbum` somavam mais
  que a caixa, o flex encolhia os itens e a linha do álbum era desenhada POR
  CIMA da segunda linha do título. Aqui não há "próximo slide" com que casar a
  altura, então a caixa se ajusta; o teto de 60cqh e o `overflow: hidden`
  seguem sendo a garantia final, e `flex-shrink: 0` no número e no álbum faz o
  título ser o único a absorver a falta de espaço (ele é o único que sabe se
  cortar).
- **A preview espelha o cartão peça a peça.** É na capa que o operador confere
  se pegou o hino certo — uma capa diferente ali seria uma ilustração errada.
  `tools/display-smoke.mjs` trava as três peças e a saída delas na estrofe
  seguinte.

**Quebras de linha vêm da própria API, como `<br>` literal** dentro de
`lyric`/`aux_lyric` (confirmado no app-ja: ele usa `v-html` pra deixar o
navegador interpretar essas tags como quebra real). `buildLyricSlides`
passa `text`/`auxText` por `normalizeLyricText()`, que troca `<br>` (e
variações `<br/>`/`<br />`) por `\n` real — **não** por `innerHTML`/`v-html`
(sem risco de injeção: é só uma troca de string, o resto do texto continua
literal). O CSS (`.lyrics-line`/`.lyrics-aux` no Display,
`.pv-lyrics-line`/`.pv-lyrics-aux` na preview) usa `white-space: pre-line`
para respeitar esse `\n` — sem isso, a quebra pretendida pelo hino se perde
e o navegador quebra a linha sozinho, do jeito errado (ou mostra o `<br>`
literal na tela, já que `textContent` não interpreta HTML).

Imagens por estrofe (`imageOpfsPath`) são baixadas de verdade pro OPFS
(mesma pasta `folders/<coll.id>/`, `downloadCollectionImage`) — nunca URL
remota direta, preserva o offline. Uma linha sem imagem própria **herda a da
anterior** (fallback "grudento", igual ao app original); imagens iguais
entre linhas/variantes são baixadas uma única vez (`resolveImage`, cache por
URL compartilhado entre Cantado e Playback do mesmo hino, já que costumam
usar as mesmas imagens). Um hino tocado/adicionado antes de qualquer
sincronização em massa passa pelo mesmo `downloadCollectionSong` sob demanda
(ver "Resolução do id de mídia por variante" acima) — já sai dali com letra
sincronizada, igual a um hino baixado em massa.

#### Wi-Fi vs dados móveis

A sincronização em **massa** (`syncCollection`, baixar todas as músicas
pendentes de uma coleção de uma vez) fora do Wi-Fi **não é bloqueada — ela
pergunta**. Baixar um hinário inteiro pode ser bastante coisa, e só o operador
sabe se o plano dele aguenta; o que o app não pode é decidir sozinho por ele,
em nenhuma das duas direções.

Sem Wi-Fi confirmado (`isConfirmedWifi`, Network Information API —
`navigator.connection.type === 'wifi' || 'ethernet'`; sem suporte no navegador
cai em `'unknown'`, tratado como Wi-Fi **não** confirmado, postura
conservadora), a lista leve é atualizada sempre (metadados, barato) e o
download pesado abre um diálogo de duas saídas: **"Usar dados móveis"** ou
**"Só no Wi-Fi"**. A escolha vale **só para aquela sincronização daquele
álbum** — não vira preferência do app, e o próximo álbum pergunta de novo.

O diálogo mostra **quanto** falta: `estimatePendingBytes` devolve o mesmo
número que o painel do álbum (`medirColecao`), que é o ponto — a estimativa que
decide o gasto de dados móveis não pode divergir da que o operador acabou de
ler no card.

Um indicador (`.net-badge`, ícone de Wi-Fi inline — fora do subset da fonte)
aparece nas opções da coleção, atualizado ao vivo
(`connection.addEventListener('change', ...)`).

O download **individual** (tocar/adicionar uma música, `ensureSongDownloaded`)
não pergunta nada e é sempre permitido, em qualquer rede: é exatamente o hino
que o operador acabou de pedir — uma música, não um acervo —, e um diálogo a
cada toque seria só atrito. Na prática,
sem Wi-Fi o hinário vai sendo baixado aos poucos, só com o que de fato for
usado em cada culto, em vez de baixar tudo de uma vez usando dados móveis.

**Display** (`display/`): layer `#lyrics` (imagem de fundo
`object-fit:cover` + uma faixa central — `.lyrics-box`: no padrão visual de
"vídeo de louvor", cantos **retos** (`border-radius: 0`), **sem linha de
borda** (v5.42 — o contorno branco desenhava um retângulo que competia com a
letra; quem separa o texto da foto é a própria faixa escura) e sem
`box-shadow`; o fundo é `--lyrics-frame-bg` e **só existe no modo imagem**
(ver "Moldura só no modo imagem" abaixo), com `width`/`height` como fração do
container (`84cqw`/`40cqh`) — a legibilidade do texto vem da própria faixa,
não de um gradiente cobrindo a tela inteira, então funciona igual
independente da imagem por trás), inserido no DOM entre
`#video` e `#youtube`, mesmo `z-index:1` dos demais layers de mídia — a
cortina do wallpaper (hoje `z-index:3`, acima de toda mídia e do cartão de
texto) cobre/revela esse layer de
graça, **sem nenhuma mudança em `stage.js`** (letra é tratada como camada
paralela, mesmo padrão já usado pela ponte do YouTube). `hideLyrics()` é
chamado incondicionalmente no início do tratamento de `load` (antes do
atalho de YouTube) e em `stop`/`clear` — sem isso, trocar de um hino pra um
vídeo do YouTube não escondia a letra de verdade, só ficava mascarado por
sorte de ordem de pintura no DOM. Depois de `AVDB.getMedia(cmd.mediaId)` (já
existia), se `rec.kind==='audio' && rec.lyrics?.length` → `showLyrics(rec)`.
O avanço de slide reaproveita o `onTime`/`sendStatus()` já existente (sem
timer novo): `updateLyricSlide(t)` acha o último slide cujo `time <= t` e só
mexe no DOM quando o índice muda; a imagem de fundo só é re-resolvida (via
`AVDB.opfsGetFile` + object URL, com guarda de sequência tipo `loadSeq`) se o
`imageOpfsPath` realmente mudou entre um slide e o seguinte. `hymnName`/
`hymnTrack` do item atual ficam guardados à parte (`currentLyricsMeta`, não
só passados como parâmetro do `showLyrics` inicial) — sem isso, o slide de
capa perderia o título ao ser re-renderizado pelo tick de tempo (ex:
operador volta pra estrofe 0 depois de já ter avançado).

**Fundo preto vs. imagens dos slides** (`lyricsBgMode`, state `lyricsBg`,
comando `lyricsbg`): **as imagens são o padrão** — a de cada slide vem baixada
com a música (`resolveImage`, ver acima, que não consulta preferência nenhuma),
e o operador tira-as em **Remover**, no segmento **Imagens dos slides** do popup
de **Exibição** (`#lyricsBgSeg` → `setLyricsBg`/`renderLyricsBgSeg`). **A leitura
do banco pergunta `=== 'black'`, nunca `=== 'image'`**: ausente é quem nunca
escolheu e cai no padrão; só o "Remover" grava um valor. Pela mesma razão o
reenvio à tela da rede (`telaReenviarPreferencias`) manda o `lyricsbg` **sem
condição** — condicioná-lo ao modo calaria justamente o "Remover". Até a v5.18
isso era um botão do mixer; ele saiu de lá porque é uma preferência de
aparência (como preenchimento e wallpaper, seus vizinhos agora), não um
controle de operação — e o lugar que abriu no mixer virou a **leitura
auxiliar** (ver seção própria). `applyLyricsImage(slide)` centraliza a decisão: calcula a "chave
efetiva" da imagem (`slide.imageOpfsPath` só se `lyricsBgMode==='image'`,
senão `null`) antes de decidir se resolve/revoga a `object URL` — o resto da
lógica (cache por chave, guarda de sequência) não muda. `setLyricsBgMode(m)`
troca o modo ao vivo e reaplica no slide atual (`applyLyricsImage`) sem
precisar esperar uma troca de estrofe. Persistido em `state.lyricsBg`
(lido no `restore()` do Display e no `load()` do Controle) e propagado ao
vivo pelo comando `lyricsbg` — mesmo padrão de `fade`/`fit`, mas tratado à
parte de `stage.handle()` (letra é camada paralela, não um comando do
stage). A preview aplica o mesmo modo em si mesma via `applyPvLyricsBg()`
(chamado direto em `cmd()`, sem esperar o Display confirmar nada).

**Moldura só no modo imagem**: o fundo semitransparente da caixa
(`.lyrics-box`/`.pv-lyrics-box`) só existe para dar contraste/legibilidade
contra uma imagem de fundo de verdade — no modo preto puro seria só uma
zona escura flutuando à toa sobre uma tela já preta, sem função nenhuma.
`applyLyricsBgClass()` (Display) / `applyPvLyricsBgClass()` (Controle)
ligam a classe `.imgbg` em `.lyrics-content`/`.pv-lyrics-content` só quando
o modo é `'image'` — o `background` de `.lyrics-box`/`.pv-lyrics-box`
fica `transparent` por padrão e só recebe `--lyrics-frame-bg` via
`.lyrics-content.imgbg .lyrics-box`/`.pv-lyrics-content.imgbg .pv-lyrics-box`.
Chamado em `setLyricsBgMode()`/`restore()` (Display) e em
`showPvLyrics()`/`applyPvLyricsBg()` (Controle) — cobre tanto a troca ao
vivo do botão quanto o estado inicial ao abrir um item já com o modo salvo.

**Preview do Controle (mesma visualização, em miniatura)**: a preview
**sempre espelha o telão** — já vale pra imagem/vídeo (via `stage.js`
compartilhado) e pra YouTube (segundo player, ver seção própria); letra
sincronizada segue o mesmo princípio universal do sistema. `#pvLyrics`
dentro de `#preview` reproduz a mesma estrutura visual do Display (fundo +
faixa central) com **exatamente os mesmos números**, porque são unidades de
container (`cq*`) e não `vw`/`vh`: relativas ao próprio container, elas são
invariantes de escala e dão a mesma composição na caixinha da preview e no
telão (ver "Redimensionamento por Container Queries" abaixo). O que continua
duplicado é a **folha** — as regras `.pv-*` existem à parte porque o container
é outro —, no mesmo padrão da preview do YouTube.
`showPvLyrics`/`hidePvLyrics`/
`renderPvLyricSlide`/`updatePvLyricSlide` espelham exatamente as funções do
Display, chamadas nos mesmos pontos: `cmd()` (`load`/`stop`/`clear`, em vez
do tratamento de comando do Display) e `previewTick()` (em vez do
`sendStatus()`). Não existe mais uma legenda de texto solta na
`.nowplaying` (`#npLyric`, removida) — a miniatura visual da preview já
mostra a composição real (fundo + posição do texto), tornando a legenda
redundante.

**Controle**: a navegação manual de estrofe é o par de botões que flanqueia a
preview (`#slidePrevBtn`/`#slideNextBtn`, ver "Os dois botões de slide") — o
ponto único de estado e execução, também para a tela cheia e a notificação, que
os acionam por `.click()`. `stepSlide(delta)` reaproveita o
**comando `seek` já existente** (sem novo tipo no protocolo) — pula pro
`time` do slide vizinho, e tanto o Display quanto a própria preview
sincronizam a letra sozinhos ao reagir ao novo tempo.

**Moldura de tamanho FIXO** (`.lyrics-box`/`.pv-lyrics-box`): a caixa não
cresce/encolhe conforme o texto do slide muda — `width`/`height` fixos (não
`max-width` + altura intrínseca), hoje **84cqw × 40cqh**, para a moldura não
pular de tamanho entre uma estrofe e a seguinte.

**E A LETRA NUNCA É CORTADA COM RETICÊNCIAS** (v1.1.8), em nenhum tamanho de
tela. Cortar é a única resposta que um telão não pode dar: o verso que some é o
que a congregação ia cantar, e ninguém no salão tem como saber que faltou. Eram
duas causas somadas — a caixa fora calibrada com a estrofe de DUAS linhas em
mente (76cqw × 32cqh), e o que garantia o encaixe era um `-webkit-line-clamp: 2`
na `.lyrics-line`.

O clamp SAIU. Quem garante que cabe é **`ajustarLetra()`** (`display.js`) e o
espelho dele **`pvAjustarLetra()`** (`controle.js`): medem a altura das peças
visíveis contra a altura útil da caixa e ENCOLHEM o conjunto até caber, por
**busca binária** (sete passadas; um laço decrescente custaria de 1 a 30
releituras de layout, e o pior caso cairia justamente na estrofe mais longa).

- **O que encolhe é a ESCALA DO CONJUNTO** (`--lyrics-escala`, multiplicando
  todas as fontes da caixa), não o corpo de uma peça: encolher só a estrofe
  faria o "Refrão" ficar maior que ela. As proporções calibradas (linha 8cqmin,
  rótulo 4,2, número 5,8) são o desenho e ficam.
- **O caso comum sai sem nenhuma passada**: a estrofe de duas linhas cabe em
  escala 1, e a função retorna na primeira medição.
- **Há um PISO** (`ESCALA_MIN`, 0,34): abaixo dele não se lê do fundo do salão.
  Uma estrofe absurda encosta nele e o `overflow: hidden` da caixa contém o
  resto — é a única saída em que ainda se corta, e ela é ordens de grandeza mais
  rara que o clamp de duas linhas.
- **`ResizeObserver` na caixa**: a tela muda de tamanho sem o slide mudar (o
  dongle entra, a TV troca de resolução, a preview entra em tela cheia). Sem ele
  a escala medida para a caixa anterior ficaria de pé.
- **MEDIDO** em 1280×720, 1920×1080, 960×540 e 800×1280 (retrato), com estrofes
  de 2, 4 e 8 linhas: nenhum corte em nenhum par. A escala depende do TEXTO e
  não da tela (é o que as unidades `cq*` garantem) — 0,69 para quatro linhas e
  0,41 para oito, iguais nas quatro resoluções.

**Redimensionamento por Container Queries (`cq*`), não `vh`/`vw`**:
`.lyrics-content` (Display) e `.pv-lyrics-content` (preview) são
`container-type: size` — tudo dentro deles (moldura, fonte, padding, gap)
usa unidades `cqw`/`cqh`/`cqmin` (relativas ao TAMANHO DO PRÓPRIO
CONTAINER, não ao viewport). Isso resolve dois problemas que a versão
anterior (`vh`/`vw` + pisos/tetos em `rem`/`px`) tinha:
- **Descompasso em telas pequenas**: um piso de fonte em `rem` fixo parava
  de encolher enquanto a caixa (só em `vh`) continuava encolhendo — a fonte
  acabava maior que a caixa, cortando/bugando o texto. Unidades `cq*` puras
  não têm piso/teto absoluto — tudo escala junto, sempre, em qualquer
  tamanho de tela.
- **Fonte grande demais em proporção estreita**: a fonte usa `cqmin` (o
  menor entre a largura e a altura do container — análogo ao `vmin`, mas
  relativo ao container), não `cqh` puro. Só `cqh` cresce com a altura
  mesmo quando a largura é o fator mais apertado (ex: janela redimensionada
  em modo retrato) — a própria linha de texto (não a quebra intencional)
  deixava de caber na largura, e o que era uma linha virava duas. `cqmin`
  encolhe a fonte junto com a dimensão mais apertada, sempre — e hoje isso
  poupa trabalho da escala (`ajustarLetra()`), em vez de evitar um corte: com
  `cqh` puro a estrofe continuaria cabendo, só que num corpo menor do que
  precisaria ser.
- **Padding do container NUNCA é em `cq*`** — e o motivo é mais forte do que
  parecia. Unidades de container escritas NO PRÓPRIO container **não se
  referem a ele**: resolvem contra o ancestral mais próximo que seja container
  e, não havendo nenhum, contra o **viewport**. No Display isso passa
  despercebido (o container preenche o viewport, então os números coincidem);
  na preview do Controle é destrutivo — a caixa tem ~130px de altura dentro de
  uma tela de ~980px, então `7cqh` virava 7% da TELA DO CELULAR, ou seja
  ~137px de padding vertical numa caixa de 128px. O content-box colapsava para
  zero e, com ele, a fonte (que é `cqmin` do container). **Era essa a causa
  real de o versículo aparecer espremido e cortado na preview.**
  A regra era seguida por `.lyrics-content`/`.pv-lyrics-content` mas estava
  violada por `.text-content`/`.pv-text-content`; hoje as quatro seguem o
  mesmo modelo: o container não tem padding percentual, a CAIXA é fração dele
  (`84cqw`/`40cqh` na letra, `86cqw`/`86cqh` no texto) e o que sobra vira
  margem sozinho via `align-items`/`justify-content: center`.

**Proporções calibradas por medição em pixel** de um vídeo de louvor de
referência (moldura ~76-80% da largura da tela / ~27-36% da altura; fonte da
letra com cap-height ~8,3% da altura da tela). Valores atuais: `.lyrics-line`
em `8cqmin`, `.lyrics-aux` em `4.2cqmin`, capa em `8.4cqmin`, caixa **fixa**
em `84cqw`/`40cqh` — todas multiplicadas por `--lyrics-escala`, que a
`ajustarLetra()` escreve. **A preview usa EXATAMENTE os mesmos números**
(ver "Proporção da preview" abaixo): `cq*` é relativo ao container, portanto
invariante de escala — com a mesma proporção, os mesmos valores dão a mesma
composição numa caixa de 280px e num telão de 3120px. A preview já teve
valores próprios (`9.3cqmin`, `92cqw`/`60cqh`…), que eram compensação
empírica para a proporção errada, não uma necessidade. O `overflow: hidden`
do `.lyrics-box`/`.pv-lyrics-box` FICA, mas mudou de papel: não é mais a
garantia de encaixe (essa é a escala) e sim a contenção do caso em que a
escala encosta no piso — ali a estrofe vaza para fora da moldura em vez de
por cima da imagem. **O `-webkit-line-clamp` da estrofe SAIU** (v1.1.8); o
único que sobrou é o de TRÊS linhas do título na CAPA, que é outro problema:
lá o texto é um nome próprio que ninguém canta junto.

**Fundo preto sem ícone de "imagem quebrada"**: no modo preto (padrão), a
`<img>` de fundo (`#lyricsImg`/`#pvLyricsImg`) fica **`hidden`** de
propósito, em vez de só sem `src`. Isso sozinho **não bastava**: o seletor
`.lyrics-bg img`/`.pv-lyrics-bg img` (uma classe + um tipo, mais específico
que a regra `[hidden] { display:none }` da folha de estilo padrão do
navegador) vencia e mantinha `display:block` mesmo com o atributo `hidden`
ligado pelo JS — a `<img>` sem `src` continuava renderizando o ícone/borda
padrão de "imagem quebrada" (aparecia como uma linha branca de margem sobre
o preto), no Display e às vezes na preview. A correção precisa de uma regra
própria com especificidade suficiente: `.lyrics-bg img[hidden] { display:
none; }` / `.pv-lyrics-bg img[hidden] { display: none; }`. `.lyrics-bg`/
`.pv-lyrics-bg` têm `background: var(--stage-bg)` próprio (o preto de
verdade do palco, independente da `<img>`);
`applyLyricsImage`/`applyPvLyricsImage` alternam
`hidden` junto com `src` a cada troca de modo/slide. As duas folhas ganharam
`[hidden] { display: none !important }` no topo, o que torna essas regras
específicas redundantes — mas elas ficam, porque a regra genérica é a proteção
de fundo e a específica documenta o caso concreto que já falhou.

### Compartilhamento

Compartilhar mídia com o app cai direto no **Cronograma**. Quem recebe é o
`intent-filter` nativo (`ShareIntake.kt`), que entrega o share à ponte no
formato `{ files:[{name,type,url}], url, title }` — as URLs são servíveis
(`/saf/<token>`), nunca bytes. Do lado web, `checkPendingShare()` processa no
init (e `window.__avShareArrived()` empurra na hora quando o app já está
aberto):

> Isto substituiu o **Web Share Target** do modelo de PWA: o
> `manifest.json` do Controle declarava `share_target` (POST multipart em
> `share-target`, arquivos no campo `media`), o service worker interceptava o
> POST, gravava `pending-share` no IDB e redirecionava para o app. O formato
> do share e todo o processamento abaixo continuam idênticos — só a entrega
> mudou. (A leitura remanescente da chave `pending-share` no IDB, que nada
> escrevia desde a v5.48, saiu na limpeza da auditoria de agosto/2026.)

- **Arquivos** → importados como `addMedia` (com thumbnail).
- **URL do YouTube** (youtu.be, youtube.com — `watch?v=`, `/shorts/`, `/live/`,
  `/embed/`, `/v/`; ID de 11 chars validado) → `addUrlMedia` com
  `kind:'youtube'`, `youtubeId` e thumb `hqdefault.jpg` — cai direto no
  **Cronograma** (`imports`), pronto para tocar.
- **Outras URLs** → `kind` detectado pela extensão (`video`/`audio`/`image`/`url`).

#### O LINK COPIADO — a mesma folha, precedida de uma pergunta (v1.1.8)

`conferirLinkCopiado()` roda na ABERTURA e em toda RETOMADA
(`visibilitychange`), e no navegador é no-op — `navigator.clipboard.readText()`
pede permissão e exige gesto, que é o oposto do que este caminho quer ser.

**COPIAR NÃO É UM PEDIDO.** Um share é um ato dirigido a este app; um link na
área de transferência pode estar ali por qualquer razão. Daí a PERGUNTA antes:
só o "sim" entrega o link ao `importShare`, que dali em diante é literalmente o
mesmo código desta seção. E é a pergunta que torna o recurso seguro no **Modo
Fácil**, onde um link compartilhado vira transmissão direta sem perguntar nada.

**O custo é o aviso de área de transferência do Android 12+, e ele é pago uma vez
por link copiado — nunca por retomada.** Quem garante isso é o CARIMBO,
comparado pelo shell ANTES de ler (ver `docs/shell/PONTE.md`,
`areaTransferencia`). Do lado daqui restam três regras:

- **O carimbo do último conteúdo examinado mora no BANCO** (`clip-carimbo`), não
  em memória: o processo morre, o app reabre, e um carimbo perdido faria a mesma
  pergunta com o aviso junto.
- **Texto que não é do YouTube AVANÇA o carimbo do mesmo jeito** — senão ele
  seria relido (e avisado) em toda retomada por um link que nunca vai ser
  oferecido.
- **Um diálogo já na tela ADIA a pergunta, e o carimbo NÃO avança.**
  `openAppDialog` resolve o anterior como cancelado ao abrir o próximo, e o que
  estaria ali é a pergunta da atualização — recusá-la por baixo, sem ninguém ter
  tocado em nada, é o desfecho que a guarda existe para impedir. O carimbo
  intacto é o que garante que a retomada seguinte ainda tem o que perguntar.

#### O que chegou fica NA FRENTE do operador

Um compartilhamento é um pedido explícito e imediato, e o app pode estar em
qualquer lugar quando ele chega. `focarImportado(id)` roda depois de todo import
bem-sucedido:

1. **Sai do que está por cima**, nos dois modos: `exitSelection()` e o fechamento
   de TODOS os popups abertos, percorrendo a MESMA tabela `POPUPS` que o ✕, o
   toque no fundo e o botão voltar já usam — um popup novo entra numa linha e
   passa a ser fechado também por aqui.
2. **A preview em tela cheia só sai quando há TELÃO.** Sem telão ela É a
   projeção, e derrubá-la para mostrar uma lista tiraria do ar o que estiver em
   cena. Caro demais para um import: ali o item espera no Cronograma.
3. Então cada modo faz o que ele quer dizer: **Simplificado → PROJETA na hora**
   (`send(id)`; a lista sequer aparece nele, então "adicionei ao Cronograma" não
   significaria nada); **Avançado → leva para o Cronograma**
   (`switchTab('imports')`) e deixa a decisão de projetar com o operador, que
   pode estar com outra coisa no ar neste exato segundo.

O alvo é o **primeiro** item que entrou (um share pode trazer vários arquivos),
e para isso `addMedia`/`addUrlMedia` — que já devolviam o registro — têm o
retorno aproveitado; `handleSharedUrl` também devolve o seu.

Ciclo ao tocar no botão 🔁: `off → all → one → shuffle → off` (persistido em `repeat`).

**Tocar uma música nova zera o `one`** (`replacePlaylistWith`): tanto o toque
simples na biblioteca quanto o "tocar" de um resultado da busca substituem a
playlist por aquele item só — e, junto, desligam o `repeat='one'`. Repetir a
mesma música é uma escolha sobre a música que ESTAVA tocando; mantê-la
prenderia o item novo em laço, que é o oposto de "escolhi outra coisa para
tocar". `all` e `shuffle` ficam: são comportamentos da FILA e voltam a valer
assim que o operador acrescentar itens a ela.

| Modo | Comportamento ao fim do item |
|---|---|
| `off` | Playlist para; `currentId` permanece para replay manual |
| `all` | Avança para o próximo; ao fim da lista volta ao início |
| `one` | Recarrega e reproduz o mesmo item |
| `shuffle` | Avança para item aleatório (nunca repete o atual) |

---

### Séries do YouTube — coleções que NÃO vêm do LouvorJA (v5.228)

Uma **série** é um canal do YouTube que publica um episódio por semana e
organiza o ano em playlists por período. Ela vira um card da Biblioteca ao lado
dos hinários e dos álbuns, e usa a mesma casca: `collState`, `medirColecao`,
barra de peso, `syncCollection`.

**Há duas no catálogo** (v5.244): o **Provai e Vede 2026**
(`@provaievedeoficial`) e o **Informativo Mundial das Missões 2026**
(`@daniellocutor`). A segunda entrou com uma linha no catálogo e nenhum `if` por
recurso — mas ela **desmentiu três suposições** que só pareciam regras porque
havia uma série só, e as três viraram campo declarado:

| Campo | Provai e Vede | Informativo | Por quê |
|---|---|---|---|
| `periodo` | `mes` — "Provai e Vede - Agosto 2026" | `trimestre` — "Informativo \| 3º Trimestre 2026" | `mesDaPlaylist` devolve o mês em que o PERÍODO começa: ele ordena as playlists e é o PISO de quem não declarar data. Quem dá o mês de cada item é sempre a data do TÍTULO |
| `titulo` | `esquerda` — "Match point \| Provai e Vede 2026 (15/Ago)" | `nenhum` — "Informativo Mundial das Missões \| 15 AGOSTO 2026" | no segundo o título é a série + a data, e a história ("O Sonho de Enoc") vive na MINIATURA. Aplicar o padrão daria 52 linhas idênticas, que é o defeito que o padrão existe para corrigir — ao contrário |
| `futuros` | `mostrar` — a playlist do mês só traz o que já saiu | `esconder` — o canal sobe o trimestre e libera um sábado por vez | os que faltam ficam como "prioridade para membros": aparecem e não tocam. Corte pela DATA, e a janela é a **semana corrente** (v1.2.19 — o episódio deste sábado nunca é escondido, e é `ehDoSabadoAtual` quem responde), com os **3 dias** da v5.256 como PISO para as semanas seguintes; sem data no título, nunca esconde |
| (nenhum) | — | — | o **idioma** virou recusa GLOBAL, não campo: ver `ehOutroIdioma` abaixo |

**O canal do Informativo publica a MESMA série em quatro idiomas**, lado a lado
na aba Playlists: "Informativo \| 3º Trimestre 2026" (PT), "Misiones \| 3º
Trimestre 2026" (ES), "Mission Stories \| 2º Quarter 2026" (EN) e "【聖工消息】
2026 第三季" (ZH). O prefixo separa as **playlists** — e não separa os **vídeos**:
em espanhol eles se chamam "Informativo Mundial **de las Misiones**", isto é,
começam com a mesma palavra. Daí `ehOutroIdioma`, irmão do `ehLibras`, aplicado
nos dois níveis: pela ESCRITA (cirílico, hebraico, árabe, tailandês, CJK,
hangul — um caractere basta, porque "【聖工消息】" não tem sílaba que dê para
procurar) e por MARCA (`misiones`/`mision`, `de las`, `missions?`), tudo contra
o `normalizar`. **É a exceção declarada à regra de ouro** ("o título é só
rótulo"): o erro que ela evita não é recuperável no sábado de manhã — é o
testemunho projetado em espanhol na frente da congregação.

> **O ÁUDIO em português é outra pergunta, e ela é do shell.** O YouTube dubla
> vídeo sozinho, e a dublagem não muda o título: ela é uma faixa a mais dentro
> do MESMO vídeo. Quem escolhe é `TrilhaAudio.kt` (v5.242), que decide pelo
> idioma **antes** do cliente e torna o português exclusivo quando ele existe.
> Nada do lado web tem como ver isso, e por isso nada aqui tenta.

**Mas o ITEM não é uma faixa de hinário — é um vídeo do YouTube** (v5.230). A
casca veio do LouvorJA e trouxe junto a premissa dele, "o toque baixa", que ali
está certa (poucos MB, e o acervo existe para ficar offline) e aqui é falsa por
duas ordens de grandeza: ~300 MB por episódio, ~15 GB no ano, e o vídeo do
sábado é visto uma vez. Então:

| O que | Onde | Como |
|---|---|---|
| toque no item | `openSongMenu` → `openYtMenu(serieComoYoutube(coll, s))` | a folha do YouTube, com `semSoAudio: true` (o seletor Vídeo × Só áudio some) |
| "Tocar agora" | `ytAcao(…, ['tocar'])` | **TRANSMISSÃO DIRETA** — `ytStream` → `shared/mse.js`, sem baixar |
| Modo Fácil | `simplePlaySong` desvia para o mesmo `ytAcao` | aquele modo não pergunta nada, e esperar 300 MB com o culto rodando não é opção |
| guardar offline | os destinos da folha (playlist · Cronograma · Favoritos) | um episódio por vez, pelo caminho de download do YouTube |
| card | `renderCollectionCard` | **card da RAIZ** do índice (v1.0.1), acima dos hinários. **UM botão só** (v1.1.21): "Atualizar a lista" (`syncCollection(coll, { soIndice: true })`), puro e sem texto, na direita da barra — sem baixar em lote e sem lixeira, porque o álbum não retém arquivo. A barra diz quantos EPISÓDIOS a lista tem, não peso, e o do sábado desta semana fica DESTACADO no topo (`blocoDestaque`). A série sai de "Baixar toda a biblioteca" |

`downloadSerieItem` e o laço de `syncCollection` continuam existindo e corretos
— o que mudou é que nenhum toque de UI os alcança hoje. O que muda em relação a
uma coleção do LouvorJA é **de onde vem o índice e de onde vêm os bytes**.

| Peça | Onde | O quê |
|---|---|---|
| catálogo + REGRA | `controle/serie.js` (`window.AVSerie`) | **PURO**: sem DOM, sem rede, sem conhecer o `controle.js`. Decide quais playlists do canal são da série, recusa as de LIBRAS, extrai a data do título e ordena. Oráculo: `tools/serie.test.mjs` |
| descoberta | `AVNative.ytCanalPlaylists(canal)` | a **aba Playlists** do canal — `[{name,url,count}]` |
| expansão | `AVNative.ytPlaylist(url)` | os vídeos de uma playlist, com o título **CRU** |
| índice | `fetchSerieIndex` (controle.js) | monta `collState[id].songs` com `{ id_music, name, ytUrl, duration }` |
| download | `downloadSerieItem` (controle.js) | `ytFetch` → OPFS → `fileAdd` com `folder: coll.id`, `kind: 'video'` |

**Três pontos de integração que não são óbvios:**

- **`duration` é uma STRING "M:SS"**, e não segundos. É a forma que o LouvorJA
  publica, e adotá-la faz `parseTimeToSeconds`, `medirColecao`, `fracaoPeso` e a
  estimativa de download valerem sem uma linha nova.
- **`has_instrumental_music: false`, sempre.** Um vídeo não tem Playback; sem
  isso o `songVariantsNeeded` pediria uma segunda variante que nunca vai existir
  e o álbum jamais ficaria completo.
- **`lyrics: null` no registro.** `songVariantsNeeded` pergunta
  `fullRec.lyrics === undefined`: um registro sem o campo seria rebaixado a cada
  sincronização, para sempre, sem nada na tela que o explicasse.

**A mutação do índice é IN-PLACE**, pela mesma razão do `fetchCollectionIndex`
do LouvorJA: o `syncCollection` tira um snapshot do array e grava `fileIdFull`
nos objetos DELE conforme baixa. Recriar os objetos deixaria o snapshot
apontando para órfãos — os bytes iriam para o OPFS e os ids seriam descartados
no `setState` seguinte.

**O REGISTRO conta o que a varredura achou** (v5.249). O bloco "Séries do
YouTube (o que a regra achou)", no Registro de Configurações, traz por série os
parâmetros do catálogo, cada playlist da aba do canal com o VEREDITO (aceita,
com o mês do período; ou recusada, com o motivo), cada vídeo recusado, os que
entraram SEM data no título — o achado que não é recusa — e os nomes
resultantes, um por linha. Os nomes vão CRUS: o consumidor é quem ajusta a
regra, a distância — e a primeira varredura real já provou o ponto: ela achou um
episódio em português recusado pelo marcador de inglês (v5.252).

Dois recortes que os números reais impuseram: os canais têm **94 e 145**
playlists, então some da lista o que traz OUTRO ano no nome (contado por motivo,
nunca em silêncio) — um mês do ano corrente renomeado continua aparecendo, que é
o defeito que o bloco existe para achar; e a linha dos vídeos compara o que veio
com o que o canal **anuncia**, porque um episódio que a extração não traz não
erra em lugar nenhum: ele só não existe na lista.

A peça que o torna confiável é `AVSerie.avaliarPlaylist`/`avaliarVideo`: o
motivo sai de quem DECIDE, e `mesDaPlaylist`/`itensDaPlaylist` são consumidores
das mesmas funções. Um diagnóstico que reexplica por conta própria diverge no
primeiro ajuste. A ordem das perguntas virou contrato porque é ela que o texto
mostra; e as duas metades (aba do canal × varredura dos vídeos) trazem datas
próprias, porque a assinatura pula a extração e só uma delas é de agora.

**O preço da antecedência tem remédio** (v5.256): enquanto o sábado não chega o
vídeo pode ainda não estar público. `serieComoYoutube` anexa `avisoSeFalhar` (e o card da
série como endereço) enquanto `AVSerie.diasAte(...) > 0`, e o caminho de falha do
`ytAcao` a usa no lugar de "não foi possível baixar" — em dois lugares, porque
"Tocar agora" fecha a Biblioteca e os destinos que guardam não.

**A lista do Informativo é função do DIA** (v5.255), e isso entra em dois
lugares: `indiceVencido` vence o índice na virada do dia (só nas séries com
`futuros: 'esconder'`) e o dia entra na **assinatura** das playlists. Sem o
segundo, a economia devolveria a lista de ontem — sem o episódio de hoje —
carimbada como de hoje, que é o sintoma da v5.233 por outra porta.

**E O ÍNDICE É PROCURADO ENQUANTO FALTAR O EPISÓDIO DESTA SEMANA** (v1.2.22,
`serieTemODaSemana` no `indiceVencido`). Vale para **as duas séries**, e é o que
resgata o Provai e Vede — ele não tem a regra do dia acima, então só o TTL de
12 h o reconferia, e um vídeo publicado na manhã de sábado podia não estar na
lista do culto daquele mesmo sábado.

| guarda | por quê |
|---|---|
| responde `AVSerie.ehDoSabadoAtual` | é a MESMA função do bloco de destaque — uma segunda conta de calendário divergiria dela, que é o defeito da v1.2.19 |
| piso de `SERIE_PROCURA_MIN_MS` (30 min) | `autoRefreshCollections` roda também no `visibilitychange`, e são dezenas de voltas ao app por culto |
| `serieProcuraDaAbertura` | a PRIMEIRA passada da sessão ignora o piso: "quando o app é aberto" é o pedido, e uma carga de página é rara. Desarmada no `autoRefreshCollections`, nunca dentro do predicado |
| `c.serie.ano === ano corrente` | em 2027 nenhum episódio do álbum de 2026 é "o desta semana"; sem ela, um álbum antigo na Biblioteca seria procurado para sempre |

Ela **se desarma sozinha**: achado o episódio, a série volta a custar zero
requisição até o TTL ou a virada da semana. Custa uma extração da aba do canal
por procura — as ~12 das playlists continuam puladas pela assinatura enquanto a
contagem não mudar. **Nada aqui baixa vídeo:** quem roda é `fetchSerieIndex`.
O preço declarado é o episódio publicado SEM data no título: ele nunca satisfaz
a pergunta, e a série segue sendo procurada de meia em meia hora — o conserto
é a leitura da data, e o Registro já o nomeia (`! entrou SEM data`).

**O índice falha com EXCEÇÃO, nunca com lista vazia.** Quem chama já trata isso
como "sem internet — falha ao atualizar" e preserva o índice anterior; devolver
zero itens apagaria da tela a série inteira que o operador já tem baixada, por
uma oscilação de rede.

**A DATA tem DUAS formas, e o mesmo episódio usa as duas** (v5.230): a compacta
entre parênteses ("… 2026 (03/Jan)") e a por extenso ("… 2026 sábado 3
janeiro"). `dataDoVideo` tenta as duas nessa ordem, e `montarData` exige que o
nome **seja** um mês em vez de só começar como um — sem isso "3 marcos" viraria
3 de março. Quando nenhuma casa, o vídeo **entra do mesmo jeito**, sem
identificador de data e no fim do mês: é a regra de ouro em ação, e é o erro
recuperável em vez do episódio ausente.

O Informativo escreve a mesma forma por extenso sem o dia da semana na frente
("15 AGOSTO 2026") — e ela já era lida, sem uma linha nova. **O que ele expôs
foi um defeito de v5.230 que ninguém tinha visto:** o ordinal opcional estava
escrito `[ºo°]?` depois de um `\s*`, então em "03 outubro" ele casava o "o" do
mês como ordinal e entregava "utubro". O regex ACERTAVA — a captura satisfaz
tudo o que ele pede, logo não há retrocesso — e quem recusava era o `montarData`,
lá fora e calado. O `o` do ordinal agora tem de estar **colado no dia** (`3o`), e
a varredura tenta **todos** os candidatos do título em vez de só o primeiro.
Outubro é o único mês que começa com "o", e é o primeiro do 4º trimestre: o mês
inteiro teria entrado sem data e no fim da lista.

O resto — as seis armadilhas de nomenclatura, por que a descoberta é a aba do
canal e não uma busca, e a regra de ouro ("a playlist prova o pertencimento, o
título é só rótulo") — está no topo do `serie.js` e na seção "Séries do YouTube"
do `CLAUDE.md`.

---
