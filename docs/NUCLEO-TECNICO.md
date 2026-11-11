# Núcleo técnico — o que se abre quando a tarefa é de uma área

> **Este arquivo é o antigo corpo do `CLAUDE.md`**, movido inteiro em 2026-11-09
> sem reescrever uma linha: cada seção daqui é a MESMA que se lia lá, e o link
> do `CLAUDE.md` aponta para a seção, não para o arquivo.
>
> **Não é para ler inteiro.** Abra a seção que a área da tarefa toca e, para o
> mecanismo por extenso, o capítulo que ela nomeia. O CONTRATO — a conversa com
> o operador, o rito de entrega, o número da versão e as regras de escrita —
> ficou no [`CLAUDE.md`](../CLAUDE.md), e é o único que se lê em toda sessão.

---

## Invariantes do shell (não quebrar)

São o que sustenta a base web. **Cada uma mora num lugar diferente**, e é preciso
saber qual para conferi-las.

**Em `WebViewFactory.kt`** (o KDoc do arquivo lista as quatro):

1. **Servir por `https://appassets.androidplatform.net/`, JAMAIS por `file://`.**
   O contexto seguro é o que faz OPFS e IndexedDB funcionarem. Não é opcional.
2. **Um único origin para os dois WebViews** — é o que preserva
   IDB/OPFS/BroadcastChannel compartilhados. Comparado por **componente do
   `Uri`** (`url.host == ORIGIN_HOST`), **num predicado só**
   (`WebViewFactory.ehDoApp`, que a navegação, a janela do `/saf/`, o
   `SlideDeck` e o `EspelhoCert` chamam — o `invariantes-shell` reprova cópia
   nova), **nunca** por prefixo de string:
   `appassets.androidplatform.net.evil.com` começa com o origin, é um domínio que
   qualquer um registra, e um `startsWith` autorizaria a navegação — dentro de um
   WebView que injeta `__AVBridge` em **toda** página que carregar
   (`addJavascriptInterface` é por-WebView, não por-origem). **Este ponto não
   pode falhar ABERTO.**
3. **Um único processo/perfil de WebView.** Nada de processo isolado para o
   Display.
4. `mediaPlaybackRequiresUserGesture = false`, `domStorageEnabled`,
   `javaScriptEnabled` — e `allowFileAccess`/`allowContentAccess` **desligados**:
   tudo entra pelo asset loader.

**Regra de projeto, não de código:**

5. **Não reimplementar em Kotlin nada que já exista em JS.** Transporte,
   playlist, letra sincronizada, Bíblia, Camada de Texto e fades ficam no web.

**Em `MainActivity.ControleChromeClient`** — e é por estarem aqui, não na
factory, que um segundo `WebChromeClient` criado sem elas as perde **em
silêncio**:

6. **`onShowFileChooser`.** Sem esse override o WebView **ignora
   `<input type="file">` por completo**: o toque não faz nada, sem erro no
   console. Dele dependem a importação para o Cronograma e a escolha do
   wallpaper.
7. **`onShowCustomView`/`onHideCustomView`.** Sem eles `requestFullscreen()`
   falha silenciosamente — e a preview em tela cheia é a projeção quando não há
   TV. É aqui que mora a trava de paisagem nativa.

**No `shouldInterceptRequest`** — a que custou três rodadas de APK:

8. **O `InputStream` que você devolve é o RECURSO INTEIRO a partir do byte 0.**
   Não é "a resposta": quem aplica o `Range` é o **próprio WebView**, sobre o que
   o app entregou (`AndroidStreamReaderURLLoader::Start` → `ParseRange` →
   `InputStreamReader::Seek` → `ComputeBounds` contra `available()`),
   incondicionalmente e para toda resposta interceptada. Devolver só a fatia
   pedida aplica o deslocamento DUAS vezes — e a requisição que começa no byte 0
   é a única em que isso é no-op, então ela passa e esconde o defeito atrás de
   si. **Corolário: um erro com corpo VAZIO não chega** quando a faixa está fora
   do zero (`ComputeBounds` reprova com `size == 0`), o que apaga a mensagem e
   deixa só um erro de rede sem status. **O capítulo é
   [`docs/shell/WEBVIEW-RANGE.md`](shell/WEBVIEW-RANGE.md)**, e o oráculo
   é o `tools/webview-range.test.mjs`.

   > **E ela SE INVERTE num `ServerSocket`.** No servidor das telas da rede quem
   > aplica o `Range` somos NÓS: a rota `/m/<token>` faz RFC 7233 de verdade
   > (`EspelhoHttp.alcanceDe`, com JUnit). **Copiar aquele molde para lá é o
   > erro exato**, e é por isso que o `EspelhoHttp` é um arquivo à parte, puro, e
   > não uma parametrização do interceptador.

**No WebView do TELÃO:**

9. **A ponte nasce com `host = null`, e o loader é montado SEM o handler
   `/saf/`.** É o que separa "uma segunda janela do Display" de um
   comprometimento do aparelho: com `host != null`, qualquer script de terceiro
   ali ganharia `pickFolder`, `listFolder`, `pickDoc`, `openExternal` e
   `espelhoLigar` — este último abre um servidor na rede da igreja.

   **QUEM A TRAVA É O `tools/invariantes-shell.test.mjs`** (revisão K1): ele lê
   o `StagePresentation.kt` só nas linhas de código e afirma as três metades —
   `host = null`, `withSaf = false` e `role = "display"`. O `ponte.test.mjs`
   afirma outra coisa (o dreno e a remontagem de campos), e as guardas
   `host == null` de cada método — a outra metade da invariante — é o
   `tools/ponte-guarda-host.test.mjs` (revisão K2, remedida na X1 e acrescida dos dois do volume em 2026-11-10): 72 métodos,
   44 com recusa explícita e 26 com motivo declarado e CONFERIDO contra o corpo.

**No `AndroidManifest.xml`:** `hardwareAccelerated` e `largeHeap` — os dois
WebViews e um vídeo grande dividem o mesmo processo.

> O WebView do telão usa outro `WebChromeClient` (`MicChromeClient`), **não
> recebe** o handler `/saf/` e é a única instância criada com
> `keepVisible = true`.

**`KeepVisibleWebView` (só o telão).** O Chromium marca a página como `hidden`
quando a janela da View some — o que acontece com a `Presentation` no instante em
que o app é minimizado. `onWindowVisibilityChanged` (e o irmão
`onVisibilityChanged`, a segunda metade) reportam `VISIBLE` **enquanto
`manterVisivel` estiver ligado**: o telão nasce com ele, e o **Controle** o recebe
EM RUNTIME (`setProjecaoLocal`) só enquanto a preview É a projeção — sem nenhuma
tela no ar. O telão continua no ar com o app minimizado de propósito, e não há
razão para desacelerar o renderer dele; com tela lá fora, o Controle volta ao
ciclo normal, porque ali ser estrangulado em segundo plano é o certo — é o que o
`snoopDisplayStatus` existe para contornar.

### Reconexão e morte do renderer

**Por extenso em
[`docs/arquitetura/DISPLAY.md`](arquitetura/DISPLAY.md)** (seção
"Reconexão e morte do renderer", ao fim). O que se quebra sem abrir:

- **Reconexão vem de graça:** o dongle volta → o Android recria a
  `Presentation` → `/display/` recarrega e dispara `display-ready` → o Controle
  reenvia a cena (`resendSceneToDisplay`). **Não invente um mecanismo paralelo.**
- **MAS "HÁ TELA" NÃO É "HÁ TELÃO".** O que depende de haver projeção
  (`somLocalDeveEstar`, `simpleDisplay`) lê o campo `telao` (a `Presentation` DE
  FATO no ar); o que descreve a CONEXÃO lê a lista crua. Nas telas da rede o
  irmão é `pronta` em `telasDaRede()`. A tela CONTINUA na lista; a escada
  `agendarRetomadaDoTelao` (0,4 s → 8 s, cinco degraus) retenta e é cancelada
  quando a tela some de verdade; com o telão no chão o som volta ao celular
  (`tools/telao-no-chao.test.mjs`).
- **O reenvio é ENDEREÇADO** (`__de` no anúncio, `__para` na resposta,
  conferido antes de tudo no `onCommand` do Display); comando sem `__para` vale
  para todos (`tools/display-smoke.mjs` trava a regra).
- **A cena é toda mídia CARREGADA** (a pausada também), com posição e estado
  (`time`/`playing`), e depois o `text` projetado — cronômetro e sorteio pelo
  DESCRITOR (`startAt`), nessa ordem.
- **Morte do renderer é recuperável** (`onRenderProcessGone` devolve `true`;
  cada dono remonta o próprio WebView), e `buildControleWebView` **zera o
  trabalho de segundo plano** e desfaz a tela cheia ao remontar.

---

## A ponte `window.AVNative`

Definida em `shared/native.js` (web) sobre `__AVBridge` (Kotlin,
`NativeBridge.kt`); **só existe quando `window.__AVBridge` existe** — no
navegador nada é definido, nem `__NATIVE__`. **O catálogo dos 64 métodos e as
regras abaixo por extenso estão em [`docs/shell/PONTE.md`](shell/PONTE.md).**

- **Superfície: 64 métodos**; o shell serve **70**. A conta (64 − 3 callbacks sem
  par + 9 internos = 72, sem órfão nenhum desde a X1) é MEDIDA por varredura
  (`@JavascriptInterface` + `fun <nome>` no `NativeBridge.kt` contra `B.<nome>(`
  no `native.js`), nunca de memória. Fora do `native.js`, tocar em `__AVBridge`
  é acoplamento indevido; o `funcao-sem-chamador.test.mjs` exige consumidor.
- **Encolher no WEB primeiro é o lado seguro**; a ordem inversa (base web nova
  contra APK velho) precisa do `shellTag`.
- **Quatro globais sem Promise:** `__NATIVE__`, `__AV_ROLE__`
  (`'controle'`/`'display'`; `'tela'` é escrito pelo `espelho/tela.js`),
  `__SHELL_VERSION__` (o contrato) e `__SHELL_NAME__` (o `versionName`, mostrado
  só no Registro).
- **A ponte entrega URLs SERVÍVEIS, não bytes** (`/saf/<token>`, `fetch` +
  `Blob`). O token é opaco, aleatório (128 bits) e estável por URI — e é do
  MESMO origin: "é local?" se pergunta pelo **host**, nunca por
  `startsWith("https://")`.
- **Superfície nativa é privilégio do Controle:** o telão recebe `host = null`
  e loader sem `/saf/`; `listFolder` devolve vazio sem host.
- **As Promises têm ÉPOCA por carga** (`EPOCH:seq`). Chamada que espera MÁQUINA
  tem prazo de 60 s; a que espera PESSOA (`pickFolder`, `pickDoc`,
  `pacoteCriar`) não tem.

### `SHELL_VERSION` — subir SEMPRE que a superfície mudar

Hoje vale **85**, e o **PISO** é 83: o bundle declara `minShell: 83`, todo método
existe sempre e **não há guarda de versão no lado web** — o que separa navegador
de app é `if (!window.__NATIVE__)`, e nada mais. "Superfície" inclui **forma de
retorno e comportamento**. Sem guarda, mudança de ponte é lote **APK + web
publicado JUNTO**, com `shellTag` no `version.json`; **mudar a FORMA de um método
é pior que acrescentar um**. `minShell` acima do `SHELL_VERSION` instalado faz o
aparelho recusar todo bundle, para sempre (o CI confere o teto lendo o Kotlin).
A tabela dos degraus está no `docs/HISTORICO.md`.

### As SEIS filas da ponte — escolher a errada é uma regressão muda

Seis executores de UMA thread, no `companion` do `NativeBridge` (compartilhados
por todas as instâncias; daemon):

| fila | o que roda | a regra |
|---|---|---|
| `io` | só o que responde em MILISSEGUNDOS | **nada de rede**: ali `listFolder` e `atualizacaoEstado` "mentem baixinho" atrás de um download |
| `transferencia` | o download do YouTube e o `ytDiscard` | UMA thread é invariante: o resgate do `YoutubeGrab` supõe um download por vez |
| `apk` | o download do APK e a entrega ao instalador | própria, e não a `transferencia`: o APK não toca estado do `YoutubeGrab`, e enfileirado ali os 15 min do prazo do web contavam a espera atrás de um vídeo |
| `extracao` | metadados de rede (NewPipe) e PDF, de SEGUNDOS | separada de `transferencia` (segundos não esperam minutos); uma thread pela inicialização global do NewPipe |
| `cifra` | só o `cifraHtml` | é MASSA e a `extracao` é TOQUE; uma thread porque `CifraFonte.ultimaTentativa` é o veredito da última busca |
| `r2img` | só o desvio de CORS das fotos (`r2Imagem`) | mesma regra da `cifra` (a varredura dos fundos busca até 6 fotos de uma vez); separada dela porque são hosts e cargas diferentes (binário × HTML) |

Fora das filas: os cinco métodos do espelho rodam na **main thread**, e
`ytCancel` só escreve um `@Volatile`.

---

## Barramento de comandos e o plano B do BroadcastChannel

O **relay nativo roda SEMPRE em paralelo**: cada comando sai por
`BroadcastChannel` **e** `MessageBus`, e a cópia repetida é descartada em `db.js`
pelo `__mid`. Por extenso: o relay em
[`MODELO-DE-DADOS.md`](arquitetura/MODELO-DE-DADOS.md), o dreno em
[`TELAO-POR-COMANDOS.md`](TELAO-POR-COMANDOS.md), a referência da preview em
[`CONTROLE-TELAO.md`](arquitetura/CONTROLE-TELAO.md) e o `load` em
[`MOTOR-STAGE.md`](arquitetura/MOTOR-STAGE.md) (seções ao fim de cada um; no
`CONTROLE-TELAO.md`, "A referência da preview").

- **O DRENO do papel `tela` é lista de PERMISSÃO** (`espelho/tela.js`): sobe só
  `display-ready` com `__tela` (dispara `telaReenviarPreferencias`; `anuncio()` é
  o dono ÚNICO do carimbo) e `display-status` RENOMEADO `tela-status` — o
  Controle ELEGE uma tela como referência, e `NativeBridge.snoopStatusDeFora` faz
  a mesma eleição. Tipo novo em `display.js` nasce mudo. O `BroadcastChannel` é
  neutralizado no ENVIO (subclasse, antes de `db.js`), nunca apagado.
- **A preview ILUSTRA, nunca mede:** a referência é o telão → a tela eleita →
  (sem nenhum) a própria preview. `authoritativeTime()` responde "o que está no
  ar?"; `tempoDaPreview()`, "o que a ilustração desenha?". O realinhamento mira
  `projeção − atraso`; tolerância de 0,5 s (`RESYNC_EXATO` ao retomar);
  escondida, a preview não atrasa nem é tocada (`preverPodeMexer`).
- **O `load` carrega `time` e `playing` no próprio comando**, porque o
  `onCommand` do Display não serializa; o `startAt` entra num `loadedmetadata`
  protegido pelo `loadSeq`. **Não há segundo caminho:** toda mídia é
  `<video>`/`<img>`, e um link do YouTube é resolvido (baixado) no Controle antes
  do `load`.
- O comando mais frequente é o `display-status` (~4 Hz), a fonte de
  sincronização enquanto existir.

---

## Trabalho em segundo plano (downloads com o app minimizado)

Minimizado, o Android pode **congelar** o processo — a sincronização de hinos,
Bíblia ou pastas parava no meio. **Detalhe em
[`docs/shell/SEGUNDO-PLANO.md`](shell/SEGUNDO-PLANO.md)** — abra antes de
mexer no `SyncService.kt`, no `bgProgress` ou nas rotinas de acervo.

O que vale sem abrir o capítulo:

- **Quem liga e desliga é o LADO WEB**, que é quem sabe o que está em curso
  (`bgWorkBegin`/`bgWorkEnd` contam as tarefas e só acionam o `keepAlive` no
  primeiro início e no último término). O `finally` de `withBgWork()` é o ponto
  crítico: uma falha de rede não pode deixar serviço e wake lock ligados.
- **`startForeground` SEMPRE, antes de qualquer decisão de parar.** Um serviço
  iniciado por `startForegroundService` que morre sem chamá-lo **derruba o app
  inteiro** — e o processo é o dos dois WebViews e da `Presentation`.
- **Cota de FGS do Android 15:** `dataSync` tem teto de 6 h em 24 h, e atingido
  o sistema mata por ANR. Parar é a única resposta — mas o Kotlin precisa
  **esquecer** que protegia, senão o download seguinte fica sem proteção nenhuma.
- **Campo novo no objeto = campo novo no `native.js`, sempre.** Ele REMONTA o
  objeto campo a campo, e do lado Kotlin `optBoolean`/`optLong` leem ausente
  como `false`/`0` — valores legítimos, sem exceção e sem log.
- **As rotinas de acervo CEDEM A VEZ ao que está no ar** (`midiaNoAr`), e cedem
  SAINDO, não esperando: elas são retomáveis e quem as rearma já existe.

---

## Notificação de controles (sessão de mídia)

O `SessionService.kt` publica um `MediaSession` e uma notificação `MediaStyle`.
**Detalhe em [`docs/shell/SESSAO-DE-MIDIA.md`](shell/SESSAO-DE-MIDIA.md)** —
abra antes de mexer no transporte fora do app ou no `pushNowPlaying`.

O que vale sem abrir o capítulo:

- **Dois ganhos, e o segundo é o menos óbvio:** controlar sem abrir o app (o
  celular fica no suporte, provavelmente bloqueado) e **a projeção deixar de ser
  descartável** — sem ele, num culto normal não há serviço em primeiro plano
  nenhum, e o processo segue candidato a ser morto sob pressão de memória,
  levando a `Presentation` junto.
- **Nenhuma decisão de transporte em Kotlin** (invariante 5): o sistema entrega
  uma string e o web aciona os **mesmos botões da tela** por `.click()`. Por isso
  nenhuma ação é desabilitada do lado nativo — quem sabe se "estrofe anterior"
  faz sentido é o web, e a cópia em Kotlin envelheceria.
- **`play`/`pause` ≠ `playpause`.** Tela de bloqueio, fone e Android Auto mandam
  intenção explícita; tratar tudo como alternador faz um `onPlay` recebido com o
  áudio tocando PAUSAR o louvor.
- **Campo novo em `pushNowPlaying` = campo novo em `AVNative.nowPlaying`**,
  sempre — e **sem** subir `SHELL_VERSION`, porque o Kotlin não muda.
- **`publish()` sempre na main thread**, e a guarda `running` fecha a janela que
  o salto de thread abre.
- **A notificação NÃO pode depender do JS do Controle:** minimizado, aquele
  WebView é estrangulado, e quem corrige play/pause e posição é o
  `snoopDisplayStatus`, que lê o `display-status` que o telão já emite.

---

## OTA da base web (atualização sem APK)

O job `web-ota` (todo push em `main`) empacota `assets/web/` num
`web-<versão>.zip` e publica, com um `version.json`, na release de tag fixa
**`web-latest`** — URL estável porque está compilada no shell. O app consulta o
manifesto, baixa quando há versão nova e passa a servi-la.

**O mecanismo inteiro — os dois canais como UM evento, a detecção por quatro
gatilhos, a pergunta que DIZ o que vem, o watchdog de boot e as defesas do
download — está em [`docs/shell/OTA.md`](shell/OTA.md).** Abra-o antes de
mexer no `WebUpdater.kt` ou no fluxo da atualização.

**O que vale sem abrir o capítulo:**

- **AS TRÊS GARANTIAS (isto roda em culto).** (1) A base NÃO troca sozinha: o
  shell só AVISA, e quem aplica é o web, no "Atualizar agora" do diálogo.
  (2) **A válvula `minShell`:** um bundle que exija ponte mais nova que o
  `SHELL_VERSION` instalado é recusado INTEIRO, no shell, e não em runtime no
  meio de um culto. (3) **O watchdog de boot:** servir um bundle arma um
  `pending` que o web desarma (`otaConfirm`); bundle que não confirme é
  descartado no lançamento seguinte e o app volta ao embutido.
- **`shellTag` no `version.json` é o ACOPLAMENTO com a Release.** Declarado, o
  `web-ota` **segura a publicação do bundle** até a Release existir, e então
  republica o manifesto com o link do `.apk` dentro — o app pergunta UMA vez
  sobre o lote inteiro. **O modo de falhar é o caro:** uma tag declarada cuja
  Release nunca sai segura o canal PARA SEMPRE, em silêncio, e a única pista é
  a linha no resumo do run. Sem `shellTag` o bundle sai na hora, que é o certo
  para um lote só de web.
- **TROCAR A BASE SERVIDA OBRIGA A LIMPAR O CACHE DO WEBVIEW.** As URLs não
  mudam de nome entre versões e o WebView roda com `cacheMode = LOAD_DEFAULT`:
  servir um bundle diferente do anterior faz a página nascer **com metade de
  cada bundle** — e o modo de falhar SE REALIMENTA, porque uma página remendada
  não satisfaz o `otaAppIsUp` e o bundle seguinte também é descartado.
- **O `otaAppIsUp` é "o app está DE PÉ", e a lista de globais dele é o
  contrato:** um script novo do Controle sem global na lista faz um bundle
  quebrado ser carimbado como bom **para sempre**.
- **Guarda de versão no lado web é PROIBIDA:** o que separa navegador de app é
  `if (!window.__NATIVE__)`, e nada mais. Quem protege é o `minShell`.
- **O nome do repositório mora numa constante SÓ** (`WebUpdater.REPO`, que o
  `ShellUpdater` e o `Farol` referenciam — eram três literais digitados à mão e
  este texto nomeava dois), e ela tem de bater com o `$GITHUB_REPOSITORY` do
  workflow. Renomear o repositório exige mexer nela, no link do `site/registro/`
  **e** publicar um APK.

---

## Telão por comandos (o telão nas telas da rede local)

O telão inteiro em até **três navegadores da rede da igreja**, sem instalar nada
e sem internet: a tela carrega o próprio bundle (servido pelo celular, com a
resolução OTA→APK) e roda o MESMO `/web/display/` (papel `tela`). Viajam
**comandos** (os JSON do barramento, verbatim, por SSE) e **mídia sob demanda**
(`/m/<token>`, com `Range` RFC 7233 feito por NÓS — a inversão da invariante 8).
**O contrato é [`docs/TELAO-POR-COMANDOS.md`](TELAO-POR-COMANDOS.md) — leia
antes de mexer**; o mapa, as peças, as decisões e as inversões que moravam aqui
estão na seção final dele. O que se quebra sem abrir:

- **AUXILIAR por contrato:** liga e desliga só pelo operador, pelo fechamento do
  app ou por uma falha nomeada em texto. Uma TV que conecta **não** a derruba.
- **Duas vias** (o `via` do estado): `WIFI` (cliente, com ou sem uplink) e
  `PONTO_DE_ACESSO` (o celular é o roteador — a resposta ao AP isolation). Com as
  duas de pé quem escolhe é o operador; quem serve não migra sozinho
  (`confirmarRede` religa na mesma via); o AP é vigiado por enquete
  (`vigiarPontoDeAcesso`, 5 s), porque em modo AP o callback de rede nunca dispara.
- **É a primeira fronteira de rede do projeto:** o `EspelhoServidor` serve só
  `PREFIXOS_BUNDLE` (nunca `web/controle/`), abre num IPv4 SERVÍVEL
  (`EspelhoInterfaces.kt`, nunca `0.0.0.0`) com allowlist de `Host`; o token
  nunca viaja numa URL; o controle real é o teto de 3 sessões + o derrubar com
  castigo; só `TIPOS_QUE_SOBEM` sobem, e a lista existe nos DOIS lados.
- **UMA página só:** o toque de entrada gasta o único gesto em tudo de uma vez;
  depois de ativada NADA cobre a tela (reentra em silêncio; o gesto volta por
  toque duplo e F11), mas a RECARGA volta à entrada oficial, carregando o token.
- **O tap é no `busPost`**, e a injeção de volta entra por
  `MessageBus.post(null,…)` — sem eco por construção. `__rec` viaja NO `load`
  (registro saneado; nunca blob, `opfsPath` ou `youtubeId`); a apresentação vai
  uma `/m/` por página; o embed do YouTube vira `tela-aviso`.
- **O `mirrorEstado` é SEMEADO na abertura** (`lerEspelho()` no `init()`): sem
  isso `telaAtiva()` mente e a projeção volta ao wallpaper, calada.
- **Comando de DESCIDA que a tela não deve executar nasce com GUARDA no
  consumidor**, nunca confiando no ambiente dela (proteção emprestada do
  navegador se desfaz sozinha).
- **A tela executa CÓDIGO nosso:** o watchdog do OTA não a cobre; quem cobre é o
  `tela-rede.test.mjs` e o telão rodar o MESMO `display.js`.
- **Regra de calendário:** a primeira ligada em rede de verdade é **num dia SEM
  culto** — segunda, terça, quinta ou sexta (a agenda é sábado de manhã, mais
  domingo e quarta à noite). O que ela protege é ter folga para desfazer.

---

## Séries do YouTube (os álbuns oficiais da Biblioteca)

Um canal que publica **um episódio por semana** e organiza o ano em playlists
vira um **álbum da Biblioteca**. São duas hoje (Provai e Vede, Informativo
Mundial das Missões). **Detalhe em
[`docs/recursos/SERIES.md`](recursos/SERIES.md)** — abra antes de mexer no
`controle/serie.js` ou no catálogo de séries.

O que vale sem abrir o capítulo:

- **MANTER O EPISÓDIO DA SEMANA BAIXADO** (v1.8.87; **SEM SELETOR e sempre
  ligado desde a v1.11.10**): uma rotina que baixa o do sábado no Wi-Fi (ou com
  "Dados móveis" ligado), na qualidade do operador, e **solta as semanas
  passadas**. O álbum de série continua não
  retendo arquivo — o que retém é um detentor novo de tamanho UM por série (a
  lista `serie` de `db.js`), e **a lista só encolhe com o substituto na mão**.
- **ABRIR O CARD DA SÉRIE VERIFICA A SEMANA, E A BARRA NÃO TEM BOTÃO** (v1.12.53;
  no Modo Fácil, onde a série não é card desde a v1.13.15, quem verifica é o DESENHO
  do bloco "Este sábado" da raiz): o "Atualizar a lista" saiu, e `verificarSemanaAoAbrir` refaz a
  lista (`soIndice`, nunca um download) e roda a rotina da semana. Piso de 5 min,
  uma por vez, e **cede à mídia no ar** (o subtítulo diz "adiada" e o próximo
  desenho do card aberto a retoma). O subtítulo da barra é o estado.
- **A regra de ouro: a PLAYLIST prova o pertencimento, o título é só RÓTULO.**
  Um vídeo entra por estar numa playlist aceita, jamais por casar um padrão de
  título. Errar para um nome feio é recuperável; errar para um episódio ausente
  é o operador descobrindo no sábado que o vídeo do culto não está lá.
- **A descoberta é a ABA DO CANAL, nunca busca por texto** — é AUTORIDADE: numa
  busca quem escolhe é o ranking do YouTube, e qualquer um pode nomear uma
  playlist "Provai e Vede 2026".
- **A REGRA mora no web** (`controle/serie.js`, PURA, com oráculo Node) e o
  shell entrega listas CRUAS: a nomenclatura de um canal muda sem avisar, e no
  web um ajuste chega por OTA em minutos.
- **O ÁUDIO em português é outra pergunta, e é do SHELL** (`TrilhaAudio.kt`): o
  YouTube dubla sozinho e a dublagem não muda o título.

---

## A aba de cifra (acordes ao lado da letra)

A folha de letra do Controle tem uma terceira fonte, ao lado de *Letra* e
*Bíblia*: a **cifra** do hino em cena. **Detalhe em
[`docs/recursos/CIFRA.md`](recursos/CIFRA.md)** — abra antes de mexer no
`controle/cifra.js`, no `CifraFonte.kt` ou na folha de letra.

O que vale sem abrir o capítulo:

- **Ela é para quem TOCA, e nunca vai ao telão.** O que a congregação vê
  continua sendo a letra, pelo caminho de sempre.
- **SOB DEMANDA é o contrato, não uma otimização.** Nada é baixado em lote,
  **nada entra no bundle do OTA**, e o que o aparelho guarda ele buscou sozinho.
  Trocar isso muda o recurso de natureza: o app deixaria de LER conteúdo de
  terceiro e passaria a DISTRIBUIR uma cópia dele.
- **A ABA SÓ EXISTE COM FOLHA NA MÃO** (v1.8.28) — não oferecer é melhor que
  explicar, a mesma regra do microfone sem TV.
- **Só o TRANSPORTE sai em Kotlin.** O `CifraFonte.kt` faz um `GET` e mais nada;
  quem lê o HTML é `controle/cifra.js`. A marcação de um site de terceiro muda
  quando o dono dele quiser, e nesse dia o conserto tem de chegar **por OTA em
  minutos** — em Kotlin custaria um degrau de `SHELL_VERSION` e uma Release.
- **Falhar VAZIO é proibido:** são cinco motivos (`sem-rede`, `nao-tem`,
  `recusou`, `ilegivel`, `sem-cifra`), porque cada um pede uma ação diferente de
  quem lê o Registro.

---

## O pacote de transferência (o acervo num arquivo)

A biblioteca inteira de um aparelho — mídia, arquivos do OPFS, catálogos — num
`.avpkg`, para entrar noutro celular por cabo, Bluetooth ou cartão. **Detalhe em
[`docs/recursos/PACOTE.md`](recursos/PACOTE.md)** — abra antes de mexer no
`controle/pacote.js`, no `PacoteCanal.kt` ou no fluxo de exportar/importar.

O que vale sem abrir o capítulo:

- **A REGRA é do web** (`controle/pacote.js`, PURA, com oráculo Node); os
  **BYTES são do Kotlin** (`PacoteCanal.kt`). É a divisão do `pptxzip.js` ×
  `deck.js`, e pelo mesmo motivo — a regra é o que erra, e ela se conserta por
  OTA em minutos.
- **O formato é SEQUENCIAL, não zip**, e o último registro é `fim`. É ele — e
  não o tamanho do arquivo — que separa um pacote inteiro de um que acabou no
  meio. **Meia biblioteca importando em silêncio é o pior desfecho que este
  recurso sabe produzir.**
- **IMPORTAR SÓ ACRESCENTA.** Nada que já esteja no aparelho é substituído, e é
  essa promessa que faz "importar de novo" ser inofensivo — que é o que de fato
  acontece quando alguém não tem certeza se deu certo da primeira vez.
- **O LEITOR NUNCA MATERIALIZA O ARQUIVO.** Ele lê por JANELAS
  (`/saf/<token>?r=<ini>-<fim>`), porque quinze gigabytes não cabem em lugar
  nenhum **e porque o caminho `/saf/` tem teto de 2 GB** — acima disso o web
  recebe o arquivo CORTADO, sem erro nenhum (a invariante 8, pelo lado de
  dentro).

---

## A abertura por trás dos panos

O lado nativo já nasce na cor do tema guardado; o que piscava era o DOCUMENTO.
**Por extenso, com o oráculo (`abertura-e-transferencia.test.mjs`), em
[`docs/arquitetura/CONTROLE-TELAO.md`](arquitetura/CONTROLE-TELAO.md)** (seção "A
abertura por trás dos panos"). O que se quebra sem abrir:

- O **tema** é escrito por um `<script>` inline no `<head>` do
  `controle/index.html`, a ÚNICA leitura de `av.tema`; o resto é a **cortina**
  (`#splash`), que levanta na última linha do `init()` que muda o que se vê.
- O **prazo de 12 s é armado no `<head>`**, não no `controle.js`; há um **piso
  de 1,8 s** contado do INÍCIO da página; a cortina sai por **remoção do nó**,
  nunca por opacidade.
- **Todo oráculo que toca na tela espera a cortina depois de CADA carga**
  (`esperarCortina`, que espera `__avPronto` e NÃO paga o piso — e não é
  detector de app quebrado).

---

## A paleta

Mora em **`assets/web/shared/tokens.css`**, fonte única carregada pelos dois
`index.html` **antes** da folha do app: a identidade oficial da IASD, em **DOIS
TEMAS**, com o denim `#2F557F` (PMS 302) no núcleo. **Cada par medido, os pisos,
o que foi revogado — e as regras abaixo por extenso — estão em
[`docs/arquitetura/DESIGN-SYSTEM.md`](arquitetura/DESIGN-SYSTEM.md).** Abra-o
antes de mexer em hierarquia, toque, camadas, rolagem, ícone ou folha. As regras
duras:

- **Só COR entra em `tokens.css`**; raio, escala de ícone, curva de toque e medidas ficam no `:root` de `controle.css`.
- **Três blocos, nesta ordem:** o que não muda, o ESCURO (padrão, sem atributo) e `[data-tema="claro"]` como DELTA — token só no claro não existe no padrão (`tokens.test.mjs`).
- **O PALCO NÃO TEM TEMA:** nada pintado no palco lê token redeclarado em `[data-tema]` (a preview existe para espelhar o telão).
- **Não há contorno em lugar nenhum**, salvo as quatro exceções NOMEADAS uma a uma no oráculo.
- **Nunca branco literal** (`#fff`) em `controle.css`/`display.css`; as três exceções estão declaradas em `tokens.css`.
- **Fundos de ESTADO e superfícies de AÇÃO são OPACOS**; tinta com alfa empilha. Os `-soft` são só wash.
- **Uma linguagem de estado:** ESCOLHIDO e LIGADO = `--btn-accent` + `--accent`; SELECIONADO numa lista = `--sel-fill`; ABERTO não é cor; o denim `--accent-fill` + `--on-accent` é só dos BOTÕES. Cor de texto nunca carrega estado sozinha.
- **Apagado = INDISPONÍVEL** (`--op-inativo` .35 + `disabled`, com `title` dizendo por quê), nunca "desligado"; o que não tem função agora é apagado, não inerte; abaixo de 2:1 é AUSENTE.
- **O desfecho de uma ação é AZUL, nunca verde**; o verde é ATIVIDADE, e os quatro consumidores de `--ok` são nomeados no oráculo, nos dois sentidos.
- **Os três destinos têm uma ordem só:** Cronograma · playlist · favoritos — a tabela `DESTINOS` e `destinosNaOrdem()`.
- **Ícone novo entra numa das TRÊS listas de escala** (`--icon-sm`/`--icon-md`/`--icon-lg`) ou ganha regra própria com a razão; o oráculo mede o `<svg>`. Desenho esparso ganha DEGRAU, nunca espessura.
- **Botão sem rótulo é QUADRADO**, com as DUAS dimensões declaradas (`--hit`, `--thumb`, `--quad-faixa`).
- **Todo scroller leva `rola`** (sombra das bordas em `linear-gradient`, medidas lidas do layout, sem barra de rolagem); seletor-roleta e carrossel horizontal não; grade que rola nasce dentro de um envelope.
- **Uma folha não muda de tamanho entre estados alcançáveis**; a faixa de fecho mora no `.popup-fecho` e não rola; rodapé flutuante é OPACO e cobra folga no último item.
- **Toque = `translateY(2px)`**; bloco que hospeda controles responde só com a LUZ e entra na lista de guardas no lote em que nasce.
- **Escada de camadas de TRÊS degraus**; o tom é decisão do PAI (`--camada`); mais fundo que três, ALTERNA-SE.
- **`res/values/colors.xml` espelha `--bg` à mão**, em dois valores (com oráculo); o ícone do app é vetor e não segue o tema.
- **Tema: dois estados, o tile é ALTERNADOR**; sem `av.tema` é o escuro. **Oráculo de cor DECLARA o tema** (`comTema`) e abre com asserção de PREMISSA.
- **Não há teste de contraste absoluto:** ao mexer num token, meça — e são DOIS temas.

---

## Divergências entre o caminho web e o nativo

**Regra de escrita:** toda guarda é `if (!window.__NATIVE__) { …web… }`, nunca o
inverso como caminho principal — o navegador é o padrão e o nativo é a exceção
que se declara. **Cada ponto por extenso — o porquê, os nomes, as medidas, as
seções de compartilhamento, microfone, voltar, volume, cast e som do
espelhamento — está em
[`docs/DIVERGENCIAS-WEB-NATIVO.md`](DIVERGENCIAS-WEB-NATIVO.md).** A tabela
abaixo é o mapa: navegador → app.

| ponto | o que difere |
|---|---|
| `sw.js` | não existe no bundle; atualizar é papel do OTA |
| `#startBtn` | oculto no app (sem política de gesto) e no papel `tela` (o gesto é do "Ativar esta tela"); quem o esconde é `display.js` |
| áudio bloqueado | no app a recuperação do `onBlocked` é desativada (falso positivo) |
| pastas do aparelho | SAF no lugar de `showDirectoryPicker()` |
| compartilhamento / link copiado | só no app (`ShareIntake.kt`, só `content://`); o link copiado vem com PERGUNTA antes |
| destinos de um item | na gaveta, um botão por destino (as folhas marcam vários); o vídeo do YouTube baixa UMA vez |
| estado do telão · cast · saída de áudio | indicador ao vivo; `openCast()`; o tile "Saída de áudio" ABRE o seletor do sistema, não ROTEIA |
| recolher a prévia | a seta vira uma linha do deck; marcação × geometria × veredito da decodificação são três coisas |
| retomada do telão | reenvia só o que ESTAVA no ar (`midiaNoAr`, nunca `currentId`) |
| Modo Fácil | sem prévia; a Biblioteca é a tela principal sem mídia no ar; abre SEMPRE no Modo Fácil (`sessionStorage`) |
| som da preview | sem tela, sai deste aparelho; com tela, mudo; PERDER a projeção com mídia no ar a PAUSA (`haDestinoDeProjecao()`) |
| PDF · `.pptx` | uma IMAGEM por página (PNG ou WebP por `PAGINA_LEVE`); o vídeo embutido toca |
| YouTube | só no app, BAIXADO pelo aparelho (`YoutubeGrab.kt`); "Tocar agora" espera o download; padrão 720p é do operador; até 1080p montando faixas (`MuxMp4.kt`) |
| séries · episódio da semana | só no app; a rotina é sempre ligada e só roda em Wi-Fi confirmado ou com "Dados móveis" |
| cifra | só no app (CORS); a aba só existe com folha na mão |
| link para fora | `openExternal(url)` (o WebView recusa outro origin) |
| tela cheia da preview · teclas de volume | trava de paisagem nativa; as teclas são CONSUMIDAS para o painel do Android não ir à projeção |
| captura de áudio/vídeo | não existe caminho nenhum; o `onPermissionRequest` nega COM log |
| navegação · voltar | uma tela e duas folhas; o voltar fecha o que estiver aberto antes de minimizar |
| downloads minimizados · controles fora do app | FGS + wake lock; `MediaSession` |
| levar a biblioteca · compartilhar o link do app | `.avpkg` (só ACRESCENTA); `compartilharTexto` |
| abertura · OTA · APK · tema · contagem | cortina + tema no `<head>`; OTA; o app baixa e instala; o tema vira o cromo do sistema; o farol (sempre ativo) |
| telão nas telas da rede · `__AV_ROLE__` | servidor no celular; terceiro papel `'tela'`, e nenhum caminho testa `=== 'display'` |

O que se quebra sem abrir o capítulo:

- **`ACTION_SEND` é público:** o `ShareIntake` aceita **só `content://`** (fora a
  autoridade do próprio app), e o intent é **CONSUMIDO** depois de lido, com o
  parse só em `savedInstanceState == null`.
- **O microfone ao vivo SAIU (v1.8.89), e na X1 saiu também o que restava no
  shell** (`requestMic`, `requestMicPermission` e o `MicDiag`). Quem trouxer
  captura de volta traz a escada de três degraus, a guarda de papel e o dreno do
  `mic-status` — o `tools/sem-captura.test.mjs` é a porta que cobra. A câmera
  continua negada, com log.
- **O voltar nunca encerra a Activity:** quem decide é `window.__avBack` (a
  tabela `POPUPS`), com prazo de 350 ms (`BACK_JS_TIMEOUT_MS`); no fim,
  `moveTaskToBack`.
- **As teclas de volume são consumidas só depois que o web pede**
  (`captureVolumeKeys(true)`); no zero e no teto há válvula para o sistema, e a
  passagem de dois ciclos só vale onde o volume do sistema alcança o som
  (`passagemAlcancaOSom`).
- **Espelhamento ≠ Google Cast:** `pickCastIntent()` filtra o Play Services e o
  bloco `<queries>` do manifesto é o que deixa a cadeia resolver.
- **O espelhamento leva o som do APARELHO INTEIRO** (`REMOTE_SUBMIX`) e **não há
  conserto no app**; `requestAudioFocus` no Kotlin seria REGRESSÃO (despejaria o
  WebView e pausaria o telão). A saída é estrutural: o áudio não nascer no
  celular.

---

### Diagnóstico

**As regras por extenso — com os casos medidos que as criaram — estão em
[`docs/DIAGNOSTICO.md`](DIAGNOSTICO.md).** Abra-o antes de mexer na
Verificação do Sistema, no Registro ou numa rotina de massa. O que se quebra sem
abrir:

- **A Verificação tem QUATRO desfechos** (`funcionou` · `não funcionou` ·
  `não respondeu` · `não se aplica`): o quarto evita a parede vermelha, e "não
  respondeu" nunca vira "não funcionou". **O aparelho é a última palavra.**
  Checagem nova é UMA linha na tabela `TESTES` e responde: falso vermelho? falso
  verde? visível num culto? Uma checagem nunca muda a cena, chama `play()`, liga
  servidor, pede permissão, abre tela do sistema, lê a área de transferência,
  baixa megabytes ou deixa rastro — a ÚNICA exceção é o download de teste
  (`TESTE_DL`), pedido pelo operador. Só emite `diag-ask`; com mídia no ar cede a
  VEZ, não a rodada; o resultado é UM objeto.
- **Rotina de massa conta o que chegou ao DISCO**, nunca o que tentou — a falha
  sobe pela cadeia de retorno inteira até a frase. **Um contador de desfechos
  fecha a conta**, e todo contador de falha leva o DENOMINADOR.
- **Campo de endereço de terceiro aceita as DUAS formas e trava no DOMÍNIO** (o
  ponto ancora a comparação; nunca re-encodar); a extensão sai do NOME do
  arquivo, validada. **Conserto de campo derivado no download traz o BACKFILL
  junto**, e um conserto cuja porta é um botão confere que o botão existe no
  estado em que o defeito mora.
- **A porta de um bloco do Registro pergunta pelo que ele descreve**; um bloco
  não se contradiz na própria altura; falha da FONTE não é a rede de quem opera;
  a frase final NOMEIA a causa; duas réguas para a mesma pergunta divergem.
- **Kotlin devolve JSON; quem monta a FRASE é o `controle.js`.** Desligar diz
  POR QUÊ (`desmontarEspelho(motivo)`).
- **O Registro é UM só**, sem visor, feito para ser COPIADO: comprimento não
  custa, ENTERRAR custa (a linha do tempo vem logo depois do cabeçalho e é
  montada na hora de desenhar). Ele é sobre o CULTO; número responde "com que
  frequência?", linha responde "da última vez?"; um bloco guarda o VEREDITO da
  mesma função que decidiu, com o dado CRU. **Uma porta só: a Verificação** —
  porta nova é porta para o mesmo arquivo, e ela recusa o vazio. Campo de log
  nasce com porta de saída.
