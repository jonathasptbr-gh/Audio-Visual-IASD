# Claude Code — APP Áudio Visual IASD (Android nativo)

App Android nativo do sistema de projeção de mídia para culto (IASD). É uma
**casca em Kotlin** que hospeda a base web do projeto em dois WebViews e usa
`android.app.Presentation` para mandar **só o Display** para a TV — sem
espelhar o celular.

> **Este repositório é autossuficiente.** A base web (`app/src/main/assets/web/`)
> foi copiada do PWA original e **agora vive aqui**: não há checkout cruzado,
> submódulo nem qualquer dependência de build do repositório do PWA. A
> arquitetura completa dessa base está em
> [`docs/ARQUITETURA-WEB.md`](docs/ARQUITETURA-WEB.md) (o hub, com um capítulo
> por arquivo em `docs/arquitetura/`) — **leia antes de mexer
> em qualquer coisa dentro de `assets/web/`.**

## Índice

| # | seção | quando abrir |
|---|---|---|
| 1 | [O ganho: Presentation em vez de espelhamento](#o-ganho-presentation-em-vez-de-espelhamento) | o modelo em uma tela |
| 2 | [Estrutura do repositório](#estrutura-do-repositório) | achar o arquivo |
| 3 | [Invariantes do shell](#invariantes-do-shell-não-quebrar) | **antes de mexer no Kotlin** |
| 4 | [A ponte `window.AVNative`](#a-ponte-windowavnative) | usar ou mudar um método nativo |
| 5 | [Barramento de comandos](#barramento-de-comandos-e-o-plano-b-do-broadcastchannel) | comandos, dreno do papel `tela`, referência de tempo |
| 6 | [Trabalho em segundo plano](#trabalho-em-segundo-plano-downloads-com-o-app-minimizado) | download, foreground service, notificação de progresso |
| 7 | [Notificação de controles](#notificação-de-controles-sessão-de-mídia) | `MediaSession`, transporte fora do app |
| 8 | [OTA da base web](#ota-da-base-web-atualização-sem-apk) | publicar, watchdog de boot, detecção |
| 9 | [Telão por comandos](#telão-por-comandos-o-telão-nas-telas-da-rede-local) | as telas da rede local |
| 10 | [Séries do YouTube](#séries-do-youtube-o-álbum-provai-e-vede-2026) | os álbuns oficiais da Biblioteca |
| 11 | [A aba de cifra](#a-aba-de-cifra-acordes-ao-lado-da-letra) | acordes sobre a letra, sob demanda |
| 12 | [A paleta](#a-paleta) | **antes de escrever qualquer cor** |
| 13 | [Divergências web × nativo](#divergências-entre-o-caminho-web-e-o-nativo) | o que muda entre navegador e app |
| 14 | [Build e distribuição](#build-e-distribuição) | CI, oráculos, assinatura, backup |
| 15 | [Regras de desenvolvimento](#regras-de-desenvolvimento) | **antes de commitar** |

**Fora daqui:** `docs/ACHADOS-EM-ABERTO.md` (os defeitos CONFIRMADOS e ainda não
corrigidos, com cenário e correção proposta — **leia antes de mexer no que ele
nomeia**; hoje tem TRÊS — os dois do áudio do espelhamento e o CLIENTE de onde
sai a escada da transmissão —, e é arquivo para esvaziar, não para crescer),
`docs/shell/README.md`
(o HUB do **Kotlin**: um capítulo por
subsistema do shell, mais a tabela que diz onde cada um dos 29 arquivos é
explicado), `docs/ARQUITETURA-WEB.md` (o HUB da base web: regras gerais e o
mapa dos capítulos em `docs/arquitetura/`), `docs/TELAO-POR-COMANDOS.md`
(o contrato das telas da rede — inclusive o celular como PONTO DE ACESSO, que
saiu do plano e virou código na v1.4.1), `docs/FONTE-DE-DADOS-LOUVORJA.md` (hinos/Bíblia)
, `docs/MEDICAO-DE-ALCANCE.md` (o CONTRATO da contagem de uso — o que é contado,
o que nunca é, por que o uso próprio sai por construção, e a MEDIÇÃO ainda
pendente de que o farol depende), `docs/HISTORICO.md`
(**apêndice**: a nota de cada versão, para consultar por `grep`, nunca por
leitura integral) e `docs/AUDITORIA-2026-08.md` (**apêndice**: a varredura de
~60.000 linhas da v1.4, com os 75 achados, o método de refutação e os 26 que
ficaram por aplicar — consultar por `grep`).

---

## O ganho: Presentation em vez de espelhamento

O Miracast espelha **a tela do celular**. Foi essa limitação que gerou toda a
arquitetura web original: dois apps separados, comunicação por
BroadcastChannel, a preview como reimplementação do Display e dois players do
YouTube tocando ao mesmo tempo.

```
┌──────────────────────┐        ┌─────────────────────────────┐
│  Celular (Activity)  │        │  TV (Smart View/MiraScreen) │
│  WebView "controle"  │  ◄──►  │  Presentation + WebView     │
│  /web/controle/      │  IDB   │  /web/display/              │
│  portrait            │   +    │  resolução nativa da TV     │
└──────────────────────┘   BC   └─────────────────────────────┘
        MESMO PROCESSO · MESMO ORIGIN · MESMO IndexedDB/OPFS
```

Os dois WebViews rodam no mesmo processo e no mesmo origin
(`https://appassets.androidplatform.net/`), então **compartilham IndexedDB,
OPFS e BroadcastChannel exatamente como os dois PWAs compartilhavam no
navegador**. É por isso que `shared/db.js`, `shared/stage.js` e todo o
protocolo de comandos seguem praticamente inalterados.

**Sem TV conectada o app continua útil:** nenhuma Presentation é criada e a
projeção volta a ser a preview do Controle em tela cheia (o mesmo fallback do
PWA, hoje com a COLUNA de controles no lugar dos gestos invisíveis).

---

## Estrutura do repositório

```
app/src/main/
├── AndroidManifest.xml          # intent-filter de share, portrait, <queries>, regras de backup
├── assets/web/                  # ← a base web (cópia própria, versionada aqui)
│   ├── version.json             #   identidade do bundle (version + minShell)
│   ├── notas.json               #   A LINHA DO TEMPO: o que cada versão mudou.
│                                #   Viaja NO bundle de propósito (ver o OTA)
│   ├── shared/tokens.css        #   PALETA — fonte única, carregada pelos dois apps
│   ├── shared/wallpaper-padrao.svg  # o WALLPAPER padrão: símbolo oficial IASD
│   ├── shared/native.js         #   ponte AVNative + watchdog do OTA (NÃO existe no PWA)
│   ├── shared/mse.js            #   player DASH mínimo: transmissão direta sem baixar
│   ├── shared/db.js             #   + relay nativo no canal de comandos
│   ├── shared/stage.js          #   motor de mídia (compartilhado Controle/Display)
│   ├── vendor/                  #   ÚNICO código de terceiro do lado web:
│   │                            #   o renderizador de .pptx (ver o LEIA-ME de lá)
│   ├── espelho/tela.css         #   o CSS da ENTRADA da tela da rede
│   │                            #   (era `<style>` em runtime, e a CSP das
│   │                            #    telas da rede o bloqueava — v5.205. O
│   │                            #    irmão dele, `shared/stage.css`, saiu na
│   │                            #    v1.4.8 com o aro de espera do palco)
│   ├── espelho/tela.js          #   O TELÃO POR COMANDOS: a casca do papel
│   │                            #   `tela` sobre o próprio /display/ (SSE)
│   ├── controle/serie.js        #   as SÉRIES do YouTube: a REGRA que decide o
│   │                            #   que entra num álbum (PURA, com oráculo Node)
│   ├── controle/hinario.js      #   as SEÇÕES do Hinário 2022: a tabela que
│   │                            #   traduz NÚMERO em SEÇÃO (35 faixas, 8
│   │                            #   blocos). PURA, com oráculo Node. O banco
│   │                            #   NÃO tem esse campo — o que identifica a
│   │                            #   seção é a POSIÇÃO do hino
│   ├── controle/cifra.js        #   a CIFRA: a REGRA que lê uma página de cifra
│   │                            #   (slug, folha, transposição). PURA, com
│   │                            #   oráculo Node. Sob demanda: NADA é guardado
│   ├── controle/sorteio.js      #   a PLAYLIST AUTOMÁTICA: a REGRA que decide o
│   │                            #   que pode ser sorteado (PURA, capacidades
│   │                            #   injetadas, com oráculo Node). "Sem infantis"
│   │                            #   (508–557 do Hinário 2022) é o ÚNICO filtro
│   │                            #   que nasce LIGADO — daí o `!== false`
│   ├── controle/                #   (sem sw.js / manifest / icons — ver abaixo)
│   └── display/                 #   (idem)
├── java/br/org/iasd/av/
│   ├── MainActivity.kt          # Activity + WebView do Controle + Presentation + voltar/volume/cast
│   ├── StagePresentation.kt     # Presentation + WebView do Display (o telão)
│   ├── WebViewFactory.kt        # asset loader + settings comuns (invariantes 1-4)
│   ├── NativeBridge.kt          # @JavascriptInterface — a ponte
│   ├── SafPathHandler.kt        # serve arquivos do dispositivo em /saf/<token>
│   ├── ShareIntake.kt           # intent ACTION_SEND → formato do share web
│   ├── SyncService.kt           # foreground service: downloads com o app minimizado
│   ├── SessionService.kt        # o único FGS DO CULTO (o Sync só sobe em download)
│   ├── WebUpdater.kt            # OTA da base web (watchdog, minShell, sha256)
│   ├── ShellUpdater.kt          # OTA do APK: a Release nova, instalada de dentro do app
│   ├── Farol.kt                 # A MEDIÇÃO DE ALCANCE: uma busca por dia, agregada,
│   │                            #   sem id nenhum. Pega carona na ronda do OTA, e o
│   │                            #   aparelho de teste conta num contador SEPARADO
│   ├── WebPathHandler.kt        # serve o bundle OTA, com fallback pro APK
│   ├── CifraFonte.kt            # o GET da página de cifra — host travado,
│   │                            #   sem parse, sem gravar nada em disco
│   ├── YoutubeGrab.kt           # extrai e baixa o vídeo do YouTube NO APARELHO
│   ├── TrilhaAudio.kt           # QUAL trilha de áudio vai ao telão (a dublagem
│   │                            #   automática do YouTube) — PURO, com JUnit
│   ├── MuxMp4.kt                # junta as faixas de vídeo e áudio (1080p) — MediaMuxer
│   ├── StreamProxy.kt           # /stream/<token>: serve o googlevideo pelo NOSSO origin
│   ├── SlideDeck.kt             # apresentação (PDF/Google) → uma imagem por página
│   ├── MicChromeClient.kt       # onPermissionRequest: microfone no WebView do telão
│   ├── MicDiag.kt               # POR QUE o microfone não abre — o que só o SHELL
│   │                            #   sabe (permissão, AppOps, modo, entradas).
│   │                            #   LEITURA PURA: não abre nada, não pede nada
│   ├── MessageBus.kt            # relay de comandos entre os dois WebViews
│   │                            # ↓ TELÃO POR COMANDOS (ver a seção do recurso)
│   ├── EspelhoHttp.kt           # o parser HTTP (+ Range/SSE) — PURO, zero import de Android
│   ├── EspelhoPares.kt          # a porta, tokens, prazo, castigo — PURO
│   ├── EspelhoServidor.kt       # sockets, rotas (bundle, /e, /m/, /par, /r), fan-out
│   ├── EspelhoMidiaCache.kt     # o cache da rota /m/<token> — PURO, com JUnit
│   ├── EspelhoMidiaCanal.kt     # canal de ArrayBuffer: OPFS → cache (WebMessage)
│   ├── EspelhoEnergia.kt        # wake lock, Wi-Fi lock e térmica da transmissão
│   ├── EspelhoInterfaces.kt     # EM QUE INTERFACE o socket abre — PURO, com
│   │                            #   JUnit. É ele que acha o PONTO DE ACESSO,
│   │                            #   que não é um `Network` e não aparece no
│   │                            #   ConnectivityManager
│   ├── EspelhoCert.kt           # o .p12 do TLS opcional (sem UI desde a v5.196)
│   └── EspelhoDiag.kt           # o DIÁRIO da transmissão — devolve JSON, não frase
└── res/
    ├── drawable/                # ic_image{,_off} — a cortina, na notificação
    │                            #  + ic_stop — PARAR (o sistema não tem um)
    │                            #  + ic_launcher_{foreground,mono} — o ÍCONE, em vetor
    ├── mipmap-anydpi-v26/       # ic_launcher{,_round}: o adaptativo (o único, minSdk 26)
    ├── values/colors.xml        # app_bg e ic_launcher_background: ESPELHAM tokens da base web
    ├── values/themes.xml        # tema sem action bar; tema preto da Presentation
    └── xml/                     # backup_rules + data_extraction_rules (ver "Build")
docs/
├── ACHADOS-EM-ABERTO.md         # os defeitos confirmados que MUDAM comportamento
│                                #   (a auditoria de 2026-08). Para ESVAZIAR.
├── MEDICAO-DE-ALCANCE.md        # o contrato da contagem de uso: o que é contado,
│                                #   o que NUNCA é, e a medição ainda pendente
├── shell/                       # HUB do KOTLIN + um capítulo por subsistema
│   ├── README.md                #   o mapa: qual capítulo abrir, e onde cada .kt mora
│   ├── PONTE.md                 #   AVNative campo a campo, SHELL_VERSION, as 4 filas
│   └── OTA.md                   #   watchdog de boot, detecção, shellTag, achados abertos
├── ARQUITETURA-WEB.md           # HUB da base web: regras gerais + mapa dos capítulos
├── arquitetura/                 # um capítulo por arquivo — abrir SÓ o que a pergunta pede
│   ├── CONTROLE.md              #   layout, transporte, mixer, Biblioteca, coleções, YouTube
│   ├── MODELO-DE-DADOS.md       #   shared/db.js: IDB, OPFS, BroadcastChannel, coletor
│   ├── MOTOR-STAGE.md           #   shared/stage.js: cortina, fades, concorrência de load
│   ├── CAMADA-DE-TEXTO.md       #   Bíblia, Mensagens, letra, cronômetro, sorteio, imagem
│   ├── BIBLIA.md                #   a aba `bible`
│   ├── DISPLAY.md               #   wallpaper, microfone, o telão
│   ├── DESIGN-SYSTEM.md         #   ANTES DE ESCREVER COR: tokens, dois temas, contraste
│   └── DOCUMENTO-EM-CENA.md     #   PDF, PowerPoint, Google Apresentações
├── TELAO-POR-COMANDOS.md        # o CONTRATO do telão por comandos — ler antes de mexer nele
├── FONTE-DE-DADOS-LOUVORJA.md   # referência do banco LouvorJA (hinos/Bíblia)
├── HISTORICO.md                 # APÊNDICE: as notas de todas as versões — usar por grep
└── ESPELHO-DE-PIXELS.md         # ARQUIVO: recurso removido (v5.187); só §2.3, §2.4 e §10-A
```

**29 arquivos Kotlin, uma dependência de terceiros no shell** — o resto é
AndroidX oficial (`core-ktx`, `activity-ktx`, `webkit`). O que sustenta essa
proporção Kotlin × JavaScript é a invariante 5; ela é o argumento contra
Capacitor/Cordova, que arrastariam npm e um build system inteiro e ainda assim
exigiriam código nativo próprio para a `Presentation`.

> Números envelhecem a cada commit. **Meça antes de citá-los:**
> `wc -l app/src/main/java/br/org/iasd/av/*.kt` ·
> `find app/src/main/assets/web -name '*.js' -not -path '*/vendor/*' | xargs wc -l`

---

## Invariantes do shell (não quebrar)

São o que sustenta a base web. **Cada uma mora num lugar diferente**, e é preciso
saber qual para conferi-las.

**Em `WebViewFactory.kt`** (o KDoc do arquivo lista as quatro):

1. **Servir por `https://appassets.androidplatform.net/`, JAMAIS por `file://`.**
   O contexto seguro é o que faz OPFS e IndexedDB funcionarem. Não é opcional.
2. **Um único origin para os dois WebViews** — é o que preserva
   IDB/OPFS/BroadcastChannel compartilhados. Comparado por **componente do
   `Uri`** (`url.host == ORIGIN_HOST`), **nunca** por prefixo de string:
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
   deixa só um erro de rede sem status. Ver `StreamProxy.kt` e
   `tools/webview-range.test.mjs`.

   > **E ela SE INVERTE num `ServerSocket`.** No servidor das telas da rede quem
   > aplica o `Range` somos NÓS: a rota `/m/<token>` faz RFC 7233 de verdade
   > (`EspelhoHttp.alcanceDe`, com JUnit). **Copiar o `StreamProxy` para lá é o
   > erro exato**, e é por isso que o `EspelhoHttp` é um arquivo à parte, puro, e
   > não uma parametrização daquele.

**No WebView do TELÃO:**

9. **A ponte nasce com `host = null`, e o loader é montado SEM o handler
   `/saf/`.** É o que separa "uma segunda janela do Display" de um
   comprometimento do aparelho: com `host != null`, qualquer script de terceiro
   ali ganharia `pickFolder`, `listFolder`, `pickDoc`, `openExternal` e
   `espelhoLigar` — este último abre um servidor na rede da igreja.

   **NÃO HÁ ORÁCULO PARA ELA.** O `ponte.test.mjs` afirma o dreno e a remontagem
   de campos, não a superfície privilegiada no papel `display`; a invariante mora
   só no `StagePresentation.kt` (`host = null` e `assetLoader(…, withSaf = false)`)
   mais as guardas `host == null` de cada método. Escrevê-la é carregar o
   `native.js` com um `__AVBridge` cujo `role()` devolva `'display'` e afirmar
   que os cinco métodos privilegiados resolvem o desfecho inofensivo.

**No `AndroidManifest.xml`:** `hardwareAccelerated` e `largeHeap` — os dois
WebViews e um vídeo grande dividem o mesmo processo.

> O WebView do telão usa outro `WebChromeClient` (`MicChromeClient`), **não
> recebe** o handler `/saf/` e é a única instância criada com
> `keepVisible = true`.

**`KeepVisibleWebView` (só o telão).** O Chromium marca a página como `hidden`
quando a janela da View some — o que acontece com a `Presentation` no instante em
que o app é minimizado. `onWindowVisibilityChanged` reporta sempre `VISIBLE`: o
telão é a projeção, continua no ar com o app minimizado de propósito, e não há
razão para desacelerar o renderer dele. O WebView do **Controle** segue o ciclo
normal — ali ser estrangulado em segundo plano é o certo, e é justamente o que o
`snoopDisplayStatus` existe para contornar.

### Reconexão e morte do renderer

**Reconexão vem de graça:** dongle cai e volta → o Android recria a
`Presentation` → o WebView recarrega `/display/` e dispara `display-ready` → o
Controle reenvia a cena (`resendSceneToDisplay`). **Não invente um mecanismo
paralelo.**

**MAS "HÁ TELA" NÃO É "HÁ TELÃO", e essa é a única parte que NÃO vem de graça.**
`AVNative.displays()` responde pelo `DisplayManager`; quem projeta é a
`Presentation`. As duas divergem exatamente durante uma negociação de Miracast —
`show()` **lança** com o dongle instável, e o sistema derruba a janela sozinho
numa oscilação —, e nos dois casos a tela **continua listada**. Enquanto o web
perguntou `lastDisplays.length > 0`, esse estado calava a preview (havia "para
onde mandar o som") sem ninguém tocando do outro lado: **silêncio nos dois
lados**, sem erro no console e com o Registro dizendo "conectado". E não passava
sozinho — `syncPresentation` só volta a rodar por um evento do `DisplayManager`
(que numa tela que continua listada não vem) ou por um `onResume`, e num culto o
celular fica no suporte.

- **O campo `telao` de cada tela** é a `Presentation` DE FATO no ar nela, e é
  ele que responde às três perguntas que dependem de haver projeção: quem toca o
  som (`somLocalDeveEstar`), se o microfone é oferecido (`haOndeReproduzirMic`,
  porque quem capta é o `/display/` dentro da janela) e se o Modo Fácil destrava
  (`simpleDisplay`). O que segue lendo a lista CRUA é o que descreve a CONEXÃO —
  o rótulo da folha, o `applyPreviewAspect`, o Registro.
- **A tela CONTINUA na lista**, e é isso que separa o campo de um filtro: *"não
  há TV"* e *"a TV está aí e o telão não subiu"* pedem frases diferentes, e a
  segunda é a única das duas que diz o que está acontecendo.
- **A escada de retomada** (`agendarRetomadaDoTelao`, 0,4 s → 8 s, cinco degraus)
  retenta `syncPresentation`. Cresce pelo motivo da retomada de áudio do
  `display.js` — o pior caso audível é uma falha no começo, não uma tentativa por
  quadro —, zera em toda subida e é **cancelada quando a tela some de verdade**,
  onde o caminho normal (a preview assume o som) já é o certo. Um pedido em voo
  não é reagendado: `onDisplayChanged` chega em rajada, e sem essa guarda a
  espera nunca cresceria.
- **Enquanto o telão está no chão o som volta para o celular** — que no
  espelhamento continua chegando às caixas, porque o `REMOTE_SUBMIX` leva a
  mistura do aparelho inteiro. Oráculo: `tools/telao-no-chao.test.mjs`.

**E o reenvio é ENDEREÇADO.** O barramento é broadcast, mas a resposta a um
`display-ready` é para UMA instância: o telão assina o anúncio (`__de`, id
aleatório por carga da página) e o Controle devolve a cena com `__para`, que o
`onCommand` do Display confere **antes de qualquer outra coisa**. Sem isso,
qualquer segunda instância de `/display/` que abrisse ou recarregasse fazia a TV
rodar um `load` inteiro (fade de saída, releitura, re-seek, fade de entrada) na
frente da congregação, por um evento que não era dela. Comando **sem** `__para`
vale para todos — que é o caso de **todos** os comandos de operação; só o reenvio
de cena endereça, e um bundle antigo de qualquer lado cai de volta no broadcast.
`tools/display-smoke.mjs` trava a regra.

A **cena** é mais que "mídia tocando":

- **Toda mídia CARREGADA**, não só a que toca. A condição anterior
  (`playing || isImage`) deixava de fora o caso mais comum de uma queda de
  dongle: o louvor de fundo PAUSADO para a oração. Vídeo pausado mostra o quadro
  congelado, áudio pausado mantém a letra em cena — nos dois casos há algo
  projetado, e nos dois ele sumia.
- O `load` leva **posição e estado de reprodução** (ver o barramento).
- Também o `text` do sorteio, cronômetro, versículo ou mensagem projetados —
  **nessa ordem**, já que no Display um `load` visual encerra a Camada de Texto e
  um `load` de áudio a mantém. Cronômetro e sorteio voltam pelo **descritor**
  (`startAt`), não por um valor: o telão recalcula a partir do mesmo instante de
  origem e reaparece no segundo certo, não no ponto em que a conexão caiu.

**Morte do renderer também é recuperável:** `WebViewFactory.create` recebe
`onRendererGone` e o `WebViewClient` devolve `true` em `onRenderProcessGone` —
sem isso o padrão do framework é matar o processo, e um OOM derrubaria o Controle
e a projeção juntos. Cada dono remonta o próprio WebView, e o telão recarregado
cai no caminho de reconexão acima.

**O que morre com o renderer não se limita à página:** os `fetch` em voo morrem
junto e o `finally` de `withBgWork()` nunca roda, então ninguém chamaria
`keepAlive(false)`. `buildControleWebView` **zera o estado de trabalho em segundo
plano** ao remontar — senão sobravam para sempre o foreground service, a
notificação congelada e um wake lock de 2 h, e a guarda de `setBackgroundWork`
transformava o próximo download real em no-op. (Ela também desfaz a **tela
cheia**: o WebView novo entra num `webContainer` que continuaria `GONE`, e sem
TV a preview em tela cheia É a projeção.)

---

## A ponte `window.AVNative`

Definida em `shared/native.js` (web) sobre `__AVBridge` (Kotlin,
`NativeBridge.kt`). **Só existe quando `window.__AVBridge` existe** — no
navegador a IIFE retorna na entrada e nada é definido, nem `__NATIVE__`.

```js
window.AVNative = {
  pickFolder(),        // → { id, name, uri }   (SAF ACTION_OPEN_DOCUMENT_TREE)
  pickDoc(mimes),      // → [{ url, name, type }]: o SELETOR DE ARQUIVOS do aparelho
  listFolder(uri),     // → [{ name, size, mtime, type, url }]   (só no Controle)
  onShare(cb),         // cb({ files:[{name,type,size,url}], url, title })
  areaTransferencia(desde), // → { texto, carimbo } ou null: o LINK COPIADO, e
                       //   só quando é NOVO. `desde` é o carimbo do último
                       //   conteúdo já examinado, em TEXTO (o carimbo é um
                       //   `long` em ms), e quem compara é o Kotlin ANTES de
                       //   ler — do Android 12 em diante LER a área de
                       //   transferência de outro app mostra um aviso do
                       //   sistema, e consultar a DESCRIÇÃO não mostra nada.
                       //   Só texto simples que COMEÇA com http(s), teto de
                       //   2 kB: privacidade, não classificação — quem decide
                       //   se é do YouTube é o `controle.js`
  displays(),          // → [{ id, name, w, h, density, telao }]
                       //   `telao` é a `Presentation` DE FATO no ar naquela
                       //   tela — "há TELA" nunca foi "há TELÃO". A lista
                       //   responde pelo DisplayManager; a projeção é a janela,
                       //   e as duas divergem numa negociação de Miracast (o
                       //   `show()` que lança, o dismiss que o sistema faz
                       //   sozinho). É por ele que o web decide QUEM TOCA O SOM,
                       //   se o microfone é oferecido e se o Modo Fácil
                       //   destrava — as três perguntas cuja resposta honesta é
                       //   a janela, não a tela. A tela CONTINUA na lista com o
                       //   telão no chão: "não há TV" e "a TV está aí e o telão
                       //   não subiu" pedem frases diferentes
  onDisplayChange(cb),
  openCast(),          // seletor de ESPELHAMENTO DE TELA do Android (≠ Google Cast)
  castTarget(),        // → string: rótulo do alvo de espelhamento deste aparelho
  openExternal(url),   // abre uma URL https FORA do app (só o Controle)
  ytFetch(url, onProg, soAudio, altura), // → { url, name, size, type, height, seconds }
                       //   `soAudio` traz só a faixa de áudio (m4a)
                       //   `altura` é o TETO de resolução
  ytDiscard(url),      //   e apaga o arquivo depois que os bytes foram copiados
  ytCancel(url),       // PARA o download em curso deste link
  otaPending(),        // → versão da base web já baixada que espera (ou '')
  otaApply(),          // APLICA-a agora: as duas páginas recarregam
  otaCheck(forcar),    // PROCURA agora; `forcar` pula o piso do shell
  otaDiag(),           // → string: quando foi a última busca e o que ela deu
  atualizacaoEstado(), // → { web, webAtual, shell, shellBytes, shellAtual,
                       //     webNotas, diag }
                       //   OS DOIS CANAIS numa leitura só — ele não
                       //   acrescenta poder: acrescenta COERÊNCIA DE INSTANTE
                       //   (ver a seção do OTA). `webNotas` é a LINHA DO TEMPO
                       //   do que vem: `[{versao, itens:[…]}]`, mais nova
                       //   primeiro, JÁ FILTRADA pelo shell para o que este
                       //   aparelho não tem. Lida do `notas.json` do PRÓPRIO
                       //   bundle baixado, nunca do manifesto
  apkProcurar(),       // → {} · { versao, bytes, notas } · { erro }
                       //   `bytes` é o TAMANHO do .apk; NÃO há campo `url` (quem
                       //   guarda a URL é o `ShellUpdater`) e o vazio é `{}`,
                       //   nunca `null`
  apkInstalar(),       // baixa e abre o diálogo de instalação do sistema
                       //   (sem URL: quem a escolhe é o `ShellUpdater`, do
                       //    achado da última `apkProcurar`)
  ytDiag(),            // → string: o que o extrator recebeu na última extração
                       //   (diagnóstico do rodapé de Configurações)
  ytStream(url, altura), // → manifesto DASH ou null: TRANSMITIR sem baixar
                       //   `{ video, videos, audio, seconds, height }`.
                       //   `videos` é a ESCADA (shell 60): as faixas mp4
                       //   transmissíveis sob o teto, UMA POR ALTURA, da mais
                       //   alta para a mais baixa. `video` continua sendo o
                       //   TOPO — a mudança é ADITIVA de propósito, e tudo que
                       //   já lia `man.video` segue lendo o mesmo. Quem ESCOLHE
                       //   é o web (`AVStream.escolherDegrau`), porque a escolha
                       //   depende da BANDA MEDIDA, que só existe depois dos
                       //   primeiros bytes — e porque uma regra de escolha erra,
                       //   e no web ela se conserta por OTA
  ytSearch(termo),     // → [{ id, url, name, author, seconds, thumb }] do YouTube
  ytCanalPlaylists(canalUrl), // → [{ name, url, count }] da ABA do canal
  ytPlaylist(url),     // → { name, author, items:[{id,url,name,seconds,thumb}] }
                       //   os dois são as SÉRIES da Biblioteca. TRANSPORTE puro:
                       //   o `name` do item é o título CRU (sem `tituloLimpo`),
                       //   e quem lê os nomes é `controle/serie.js`
  deckPages(origem, nome, onProg), // → { name, pages:[url] } ou { erro }: PDF em imagens
  deckExportUrl(link), // → URL de exportação PDF de um link do Google Apresentações
  deckDiscard(url),    //   e apaga as páginas depois da cópia
  captureVolumeKeys(bool), // botões físicos de volume vão para o app
  projecaoLocal(bool), // A PREVIEW É A PROJEÇÃO: não há tela conectada e há
                       //   cena no ar. O shell responde impedindo que o WebView
                       //   do CONTROLE seja suspenso (o `manterVisivel` + a
                       //   prioridade do renderer que o telão já tem). Sem tela
                       //   quem toca é o `<video>` da preview, e o Chromium
                       //   pausa o de uma página oculta — com o app minimizado o
                       //   louvor calava. CONDICIONAL de propósito: com telão no
                       //   ar o Controle DEVE ser estrangulado em segundo plano
  systemVolume(step),  // devolve um passo ao volume do sistema (fader no limite)
  temaClaro(bool),     // o TEMA escolhido: ícones das barras + windowBackground
  requestMic(),        // → bool: permissão RECORD_AUDIO (push-to-talk)
  keepAlive(bool),     // download em curso — ver "Trabalho em segundo plano"
  bgProgress({label, done, total, etaMs, items, idleMs, bytes}), // progresso na notificação
  nowPlaying({active, title, subtitle, playing, slideMode, slideLabel, wallpaper, positionMs, durationMs, actions}),
                       //   `actions`: os BOTÕES do cartão, na ordem, escolhidos
                       //   pelo lado web. Vazio = os cinco de sempre
  onRemote(cb),        // cb('play'|'pause'|'playpause'|'prev'|'next'|'stop'|'view')
  // ---- TELÃO POR COMANDOS — ver a seção ----
  espelhoLigar(ip),    // liga a transmissão. `ip` VAZIO = "escolha você" (a
                       //   primeira da lista, ponto de acesso na frente); com
                       //   ip vai pelo `espelhoLigarEm`, método PRÓPRIO do
                       //   Kotlin — ADITIVO, nunca uma assinatura trocada
  espelhoDesligar(),   // síncrono e sem resposta, como o `ytCancel`
  espelhoEstado(),     // → { ligado, endereco, erro, via, redes:[…], telas:[…] }
                       //   (sem `codigo` desde a v5.189: a porta é o ENDEREÇO)
                       //   `via` é `WIFI`|`PONTO_DE_ACESSO`; `redes` são as
                       //   servíveis AGORA ({ip, via, iface}) e vem VAZIA com a
                       //   transmissão no ar — montá-la enumera interfaces na
                       //   main thread, e a folha não a desenha ligada
                       //   cada tela: { rotulo, comando:true, conectadaMs,
                       //   telaAcesaMin, aviso, eventos, pronta, fila }
  espelhoDiag(),       // → JSON do Registro (servidor, sessões, cache de
                       //   mídia, telas por comando)
  espelhoDerrubar(rotulo), // tira ESTA tela do ar (o "Desconectar" da folha)
  espelhoCertImportar(url, senha), // → '' ou a FRASE do erro: o .p12 do TLS
  espelhoCertEstado(), // → { temCert, host, ate, nome, noAr, servindoTls }
  espelhoCertApagar(), // a chave privada sai do aparelho
                       //   OS TRÊS ESTÃO SEM UI DESDE A v5.196: a folha de
                       //   "Ajustes avançados" era a única porta deles e saiu.
                       //   Ficam na ponte de propósito — voltar atrás é
                       //   desenhar uma folha, não publicar uma Release.
  // ---- CIFRA — ver a seção do recurso ----
  cifraHtml(url),      // → { status, html }: o corpo CRU de uma página de
                       //   CIFRA **ou da busca do site**. O buscador externo
                       //   saiu no shell 52 e o host dele com ele — a forma não
                       //   mudou, o COMPORTAMENTO sim, e é por isso que o
                       //   degrau subiu nas duas pontas (51 ao entrar, 52 ao
                       //   sair). Host TRAVADO (`CifraFonte.kt`). TRANSPORTE:
                       //   quem lê o HTML é `controle/cifra.js`. Os dois campos
                       //   respondem perguntas diferentes — `status 0` é "não
                       //   houve resposta", `404` é "o site não tem"
  micDiag(),           // → { permissao, modAudio, appops, mudo, modo, gravando,
                       //     entradas:[{tipo,nome}] }: POR QUE o microfone não
                       //     abre — o que só o SHELL sabe. `modAudio` é
                       //     `MODIFY_AUDIO_SETTINGS`, e é ela que O CHROMIUM DO
                       //     WEBVIEW exige do app HOSPEDEIRO para abrir QUALQUER
                       //     captura: sem ela `setCommunicationDevice()` devolve
                       //     `false` e `MakeLowLatencyInputStream` devolve
                       //     `nullptr` — `NotReadableError` em toda configuração,
                       //     antes de qualquer restrição ser negociada. Foi o
                       //     defeito da v1.2.11 para trás. `AppOps` responde outra
                       //     coisa: ele pode RECUSAR `RECORD_AUDIO` com
                       //     `checkSelfPermission` devolvendo concedida (o
                       //     interruptor de privacidade, o Auto Blocker da Samsung
                       //     sobre app fora da loja, o mudo global). ATENÇÃO ao
                       //     valor `primeiro plano` (`MODE_FOREGROUND`): é o
                       //     ESTADO NORMAL do Android 10+ com a permissão no
                       //     padrão, e lê-lo como bloqueio acusa o sistema no caso
                       //     mais comum que existe.
                       //     LEITURA PURA: não abre o microfone, não pede nada
                       //     ESTE É O ÚNICO MÉTODO QUE NÃO É REMONTADO campo a
                       //     campo no `native.js` — ele passa o objeto inteiro, de
                       //     propósito, para um diagnóstico ganhar campo sem
                       //     mexer na ponte. O degrau do `SHELL_VERSION` continua
                       //     obrigatório: a FORMA de retorno mudou
  salvarTexto(nome, texto), // → o NOME gravado, ou '' (desistiu ou falhou): o
                       //   "Salvar como" do sistema (SAF `CREATE_DOCUMENT`),
                       //   com o shell ESCREVENDO o texto. Existe porque o
                       //   WebView do app não tem `DownloadListener`: um
                       //   `<a download>` sobre um `blob:` não faz NADA ali —
                       //   sem erro, sem arquivo. Sem prazo: quem responde é
                       //   uma pessoa no seletor
  cifraDiag(),         // → string: o que a última busca de cifra recebeu
  // ---- A MEDIÇÃO DE ALCANCE — ver `docs/MEDICAO-DE-ALCANCE.md` ----
  farolEstado(),       // → { conta, ultimo, diag }: este aparelho entra na
                       //   contagem? `conta` é o VEREDITO e não a chave — ele
                       //   já embute o build debuggável, que a tela não tem
                       //   como saber. `ultimo` é epoch em ms (0 = nunca)
  farolContar(bool),   // a chave de Configurações. Síncrona e sem resposta,
                       //   como o `espelhoDesligar`: a gravação é local e o
                       //   efeito é do PRÓXIMO acendimento. NÃO reacende nada —
                       //   um aparelho nos dois contadores no mesmo dia é o
                       //   duplo registro que o desenho existe para não ter
}
```
São **51 métodos**, e essa é a superfície inteira que o resto do lado web tem
direito de usar — fora do `native.js`, tocar em `__AVBridge` direto é
acoplamento indevido. O próprio `native.js` chama mais oito coisas lá, e nenhuma
é API para o app: `ytFetchAudio` e `ytFetchAte` (não são métodos a mais, são os
outros dois DESTINOS do `ytFetch` — só-áudio e teto de resolução),
`shellVersion()`/`role()`/`appVersion()` (viram as globais abaixo), `busPost()`
(relay do barramento), `otaConfirm()` (watchdog do OTA) e `takeShare()` (consumo
do share pendente, que alimenta o `onShare`).

**Quatro globais lidas direto, sem Promise:** `window.__NATIVE__`, `__AV_ROLE__`
(`'controle'`/`'display'`; o terceiro valor, `'tela'`, é escrito por
`espelho/tela.js`, não pela ponte), `__SHELL_VERSION__` (o inteiro do contrato) e
`__SHELL_NAME__` (o `versionName` do APK — o índice de versão exibido ao
operador, que **não** se confunde com `__SHELL_VERSION__`: base web e shell
atualizam por caminhos independentes, e o rodapé de Configurações mostra os dois
via `renderVersionLabel`). Sem `appVersion()` a string vem vazia e a UI cai em só
a versão web.

**Princípio: a ponte entrega URLs SERVÍVEIS, não bytes.** Arquivos do aparelho e
compartilhamentos chegam como `https://appassets.androidplatform.net/saf/<token>`
e o web usa `fetch()` + `Blob` como já faz com o OPFS — nenhuma função de
importação precisou ser reescrita, e **um vídeo de 2 GB nunca passa por base64**.

O token (`SafRegistry`, em `SafPathHandler.kt`):

- **Opaco**, não o URI codificado: o `PathHandler` recebe o caminho já
  decodificado, e um `content://` com barras viraria segmentos de rota.
- **Aleatório** (128 bits base64url, `SecureRandom`), não um contador — as
  entradas nunca expiram, e não custa nada deixar `/saf/1..N` fora do alcance de
  quem enumerar.
- **É uma URL `https://`, do MESMO origin da base.** Quem recebe uma delas de
  parâmetro e pergunta `origem.startsWith("https://")` para decidir "é da rede ou
  é local?" manda **todo arquivo do aparelho** para o caminho de download — foi o
  que deixou o PDF quebrado da v5.97 à v5.99, indistinguível de "PDF com senha".
  A pergunta certa é pelo **host** (`u.host == ORIGIN_HOST`), invariante 2.
- **O mesmo URI devolve sempre o mesmo token.** Sem isso, cada `listFolder` de
  uma pasta de 500 arquivos acrescentava 500 entradas novas a cada
  re-sincronização, num processo mantido vivo durante todo o culto.

**Superfície nativa é privilégio do Controle.** O WebView do telão recebe a ponte
com `host = null` e o loader dele é montado **sem** o handler `/saf/`.
`listFolder` honra a mesma regra e devolve lista vazia sem host — era a exceção,
porque lê o `ContentResolver` direto, e sem a guarda qualquer script no documento
do Display lia o índice inteiro (nome, tamanho e token servível) de toda pasta
concedida. Os dois consumidores de arquivo do aparelho (`importShare`,
`syncDeviceFolder`) rodam no Controle e copiam para o OPFS antes de qualquer
coisa chegar ao telão; o Display nunca busca um `/saf/`.

**As Promises têm época por carregamento.** O id é `EPOCH + ':' + seq`, com
`EPOCH` aleatório a cada carga. O renderer pode morrer com uma chamada em voo: a
página recarrega, o contador volta a zero, mas o `resolve` do Kotlin aponta para
o WebView ATUAL — com ids "1", "2", "3" a resposta atrasada da página velha
resolvia a promise homônima da NOVA. Chamadas que dependem de **máquina** têm
prazo de 60 s; `pickFolder` e `requestMic` esperam uma **pessoa** e ficam sem
prazo (um timeout ali resolveria null com o operador ainda escolhendo a pasta).

### `SHELL_VERSION` — subir SEMPRE que a superfície mudar

Hoje vale **60**, e ele é o **PISO**: o bundle declara `minShell: 60`, então
todo método da ponte existe sempre e **não há guarda de versão no lado web**.
"Superfície" inclui **forma de retorno** e **comportamento**, não só assinatura:
um campo que some, um contrato de URL que muda ou um método que passa a fazer
outra coisa exigem o degrau do mesmo jeito.

**Com o piso, subir o degrau deixou de ser higiene e virou PRÉ-REQUISITO.**
Antes, esquecer a Release fazia o recurso não aparecer — a guarda `< N` o
escondia. Sem guardas, o web chama um método que o APK instalado não tem: o
`native.js` cai no `catch`, ou o `call` vence os 60 s e resolve `null`. O botão
existe, é tocável e não faz nada. Por isso mudança de ponte é um lote
**APK + web publicado JUNTO**, com `shellTag` no `version.json`.

> A tabela dos 60 degraus está em `docs/HISTORICO.md` — ela é história do
> contrato, e história mora lá.

### As QUATRO filas da ponte — escolher a errada é uma regressão muda

São quatro executores de **uma thread cada**, no `companion` do `NativeBridge`
(portanto **compartilhados por todas as instâncias**: um por instância vazava a
`NativeBridge` inteira, e com ela a Activity/Presentation antigas, a cada morte
de renderer e a cada ciclo do dongle). Todos daemon.

| fila | o que roda nela | por quê |
|---|---|---|
| **`io`** | só o que responde em MILISSEGUNDOS: `version.json`, estado do OTA, `listFolder` pelo `ContentResolver`. **Nada de rede** | é a fila de que tudo mais depende |
| **`transferencia`** | as transferências de MINUTOS: o download do YouTube, o do APK, e o `ytDiscard` | ver abaixo |
| **`extracao`** | o que vai à rede ler METADADOS (busca, playlists de canal, o manifesto do `ytStream`, o `apkProcurar`) e a rasterização de PDF — coisas de SEGUNDOS | ver abaixo |
| **`cifra`** | só o `cifraHtml` — o GET da página do Cifra Club | ver abaixo |

- **Enfileirar rede em `io` é o defeito que a separação corrigiu — e "curta"
  não salva.** `io` é de uma thread só; do lado web `CALL_TIMEOUT_MS` são 60 s e
  o `call()` resolve `null` ao vencer. Com um vídeo de 300 MB baixando,
  `listFolder` devolvia lista vazia, `otaPending` dizia que não há atualização e
  `atualizacaoEstado` não respondia nada. **Nenhum deles erra: os três mentem
  baixinho** — e o pior é o `listFolder`, cuja lista vazia o `controle.js` lê
  como "a pasta sumiu do aparelho". O `apkProcurar` repetiu isso em escala
  menor: um GET à API do GitHub com 20 s de connect + 20 s de read trava a mesma
  fila por até 40 s. Ele mora na `extracao` — não toca no NewPipe, mas é rede
  lendo metadados, e o pior caso dele lá é um "Tocar agora" esperando.
- **`extracao` é separada de `transferencia` porque segundos não esperam
  minutos.** Atrás de um download, o "Tocar agora" de um vídeo esperaria o
  hinário terminar — e, vencido o prazo, cairia no download sem que nada
  explicasse por quê.
- **UMA thread em `transferencia` é invariante, não economia:** o resgate de
  download do `YoutubeGrab` é um slot único e o mapa de parciais supõe **um
  download por vez**. `ytDiscard` mora aqui pelo mesmo motivo — fora desta fila
  ele poderia apagar o parcial de um download em curso.
- **`extracao` também é de uma thread só**, porque as extrações compartilham a
  inicialização global do NewPipe. Os diagnósticos não colidem: `diagnostico` é
  escrito só pelo caminho do download e `diagnosticoStream` só pelo do
  manifesto — que é justamente por que eles são dois campos.
- **A `cifra` é própria porque ela é MASSA e a `extracao` é TOQUE.** A varredura
  do acervo roda na ABERTURA com seis requisições concorrentes do lado web, e o
  prazo do `CifraFonte` vale para connect E para read: na `extracao` havia
  sempre ~6 páginas à frente de quem chegasse depois, e o `ytStream` de um
  "Tocar agora" podia vencer os 60 s do `call()` e cair no download, calado. Sair
  dali é seguro porque o que obriga AQUELA fila a ser serial é a inicialização
  do NewPipe, que o `CifraFonte` não toca (`HttpURLConnection` avulso); esta
  continua de uma thread pelo motivo dela — `CifraFonte.ultimaTentativa` é o
  veredito da ÚLTIMA busca, e escritas concorrentes fariam a linha "Cifra:" do
  Registro descrever outra tentativa.

E duas regras que ficam de fora das filas:

- **Os cinco métodos do espelho rodam na MAIN THREAD**, fora de qualquer fila.
  "Ligar a transmissão" enfileirado atrás de um download venceria o prazo de
  60 s e resolveria `null` — um erro sem causa. O que sustenta isso hoje é a
  serialização de `espelhoSrv`/`espelhoMidia` (a razão ORIGINAL morreu com o
  espelho de pixels). Ver o KDoc de `MainActivity.startMirror`.
- **`ytCancel` não vai para fila nenhuma**, e não poderia: `transferencia` está
  ocupada justamente pelo download que se quer parar. Ele escreve um `@Volatile`
  e volta; quem responde é o laço de cópia do `YoutubeGrab`, a cada bloco de
  64 kB.

**O bundle declara `minShell: 60`, e é a VÁLVULA que resolve.** Um bundle que
exija ponte mais nova que o `SHELL_VERSION` instalado é recusado inteiro
(`WebUpdater.kt`), e o app segue no que tinha — a recusa acontece no shell, e
não em runtime no meio de um culto. **Guarda de versão no lado web é proibida:**
o que separa navegador de app é `if (!window.__NATIVE__)`, e nada mais.

> **O modo de falhar desta escolha:** `minShell` acima do `SHELL_VERSION` do APK
> instalado faz o aparelho recusar **todo** bundle, para sempre, e a única pista
> é a linha "Procura:" do Registro. O CI confere o teto lendo o
> `SHELL_VERSION` do próprio Kotlin.

**E MUDAR A FORMA de um método que já existe é PIOR que acrescentar um.** A
assimetria é real: o web chega por OTA em minutos, o shell só chega instalando o
APK. Uma assinatura encolhida publicada sozinha faz o bundle chamar a forma NOVA
contra um APK que ainda tem a VELHA — e o recurso para de funcionar sem nada na
tela que explique. **A resposta é a regra de entrega, não uma guarda:** encolher
a ponte é um lote APK + web publicado JUNTO, com `shellTag` no `version.json`
segurando o bundle até a Release existir.

Foi assim que os dois argumentos ignorados saíram (`espelhoLigar(modo)` e o
`sim` do `espelhoAprovar`, que virou `espelhoDerrubar(rotulo)`): eles esperaram
o lote que sobe o degrau, e não uma versão em que "já dava".

---

## Barramento de comandos e o plano B do BroadcastChannel

`BroadcastChannel` entre dois WebViews same-origin no mesmo processo **deve**
funcionar — mas o isolamento de sites do WebView pode surpreender, e uma falha aí
derrubaria o comando do telão no meio de um culto.

Em vez de detectar a falha (handshake com janela de corrida), o **relay nativo
roda SEMPRE em paralelo**: cada comando sai pelos dois caminhos
(`BroadcastChannel` + `MessageBus`) e a cópia repetida é descartada em `db.js`
pelo campo `__mid`. `sendCommand`/`onCommand` mantêm a mesma assinatura; o custo
é desprezível (objetos JSON pequenos).

### O DRENO do papel `tela` — uma lista de PERMISSÃO de dois itens

Cada tela da rede roda uma **cópia de `/web/display/`** ligada ao MESMO
barramento por SSE. É o mesmo arquivo — e é por ser idêntico que **ele não pode
falar tudo**: a arquitetura inteira supõe UM telão. Drenado tudo passa:
`display-status` sai a ~4 Hz de CADA um (o Controle e o `snoopDisplayStatus`
passariam a ter N fontes alternadas), `media-ended` dobrado dá um segundo `load`
em `repeat one`, `mic-status` de uma tela — que **nega `getUserMedia` em
silêncio**, por não ter o `MicChromeClient` — apagaria o estado do microfone
VERDADEIRO, e `diag-ask` respondido por vários faz o Registro mostrar o diário de
um deles sem dizer qual.

O dreno mora em `espelho/tela.js` (o `__AVBus.post` do papel) e é lista de
**PERMISSÃO** — um tipo de mensagem novo em `display.js` nasce mudo por
construção:

- **`display-ready` passa, com `__tela`.** É esse anúncio que faz o Controle
  reenviar a cena — drenado por inteiro, a tela fica no wallpaper até alguém
  tocar em alguma coisa, exatamente nos três casos em que ela precisa se
  recuperar sozinha: ligada no meio do culto, recarga da página e queda de rede.
  É seguro porque o reenvio é **endereçado** (`__de`/`__para`).

  **E o `__tela` é o que dispara o reenvio das PREFERÊNCIAS** (wallpaper, fundo
  da letra, preenchimento — `telaReenviarPreferencias`), porque é a única coisa
  que distingue uma tela da rede do telão de verdade, que lê tudo do IndexedDB
  sozinho. Quem monta o anúncio é `anuncio()`, **dono ÚNICO do carimbo**: há dois
  pontos que anunciam (o dreno e o `aoConectar` do reanúncio) e o que entrega é
  quase sempre o segundo, porque o `display-ready` nasce antes de existir token.
  **Os dois lados do contrato têm oráculo** — o produtor no `tela-rede.test.mjs`,
  o consumidor no `boot-nativo.test.mjs` —, e são dois porque *ler cada lado
  isolado aprova ambos*: este combinado passou dezenas de versões documentado e
  não cumprido (o campo ia no `tela-status` e nunca no `display-ready`, e a
  função nunca rodou para uma tela de verdade, sem erro em lugar nenhum).
- **`display-status` sai RENOMEADO para `tela-status`.** **Sem TV as telas da
  rede SÃO a projeção**, e calá-las deixaria o Controle sem referência de tempo
  nenhuma — sobraria a preview, que é o que o Android estrangula quando o app sai
  da frente. Com nome PRÓPRIO, nada que espera "o telão" o recebe por engano: o
  `controle.js` **elege UMA tela** como referência (convertendo o status dela em
  `espelho-status`, que os consumidores já conhecem) e o
  `NativeBridge.snoopStatusDeFora` faz a mesma conta de precedência **e a mesma
  ELEIÇÃO** — o silêncio que troca a eleita é o mesmo dos dois lados, porque
  duas contas com réguas diferentes elegeriam telas diferentes.
- **O `BroadcastChannel` é NEUTRALIZADO NO ENVIO, nunca apagado.** `db.js` escolhe
  o canal perguntando `'BroadcastChannel' in global`: apagar a propriedade
  deixaria a tela com um único caminho de **recepção**, e a redundância dos dois
  é decisão escrita deste projeto. O que morre é só o `postMessage`, por uma
  subclasse do construtor real — e a troca precisa acontecer **antes de `db.js`**,
  que captura o construtor na carga.

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

### O `load` carrega o ponto e o estado da mídia

Além de `mediaId`/`view`/`muted`/`volume`, dois campos que existem **para a
reconexão do telão**:

| campo | significado |
|---|---|
| `time` | segundo em que a mídia deve entrar (0 = do começo) |
| `playing` | `false` = a cena voltou PAUSADA; ausente/`true` = toca |

**Por que viajam no próprio `load`, e não como um `seek`/`pause` logo depois:** o
`onCommand` do Display **não serializa**. O `load` é assíncrono (`getMedia` →
`opfsGetFile` → `mediaReady`, mais o fade de saída), e um comando que chegasse em
seguida agiria sobre o `<video>` **anterior** — o seek seria aplicado à mídia
errada e depois perdido.

- `stage.js` → `load(id, v, m, vol, startAt, autoplay)`. A posição só "gruda"
  depois que a duração é conhecida (escrever `currentTime` junto com o `src` é
  perdido em silêncio), então o `startAt` entra num `loadedmetadata` com
  `{ once: true }`, protegido pelo `loadSeq`. `autoplay === false` é a cena que
  voltou pausada; `undefined` mantém o comportamento de sempre.
- **Não há segundo caminho.** O vídeo do YouTube entra pelo `shared/mse.js`
  como `<video>` comum, então o `startAt` dele segue a MESMA regra acima. Um
  `kind: 'youtube'` (link sem bytes) nem chega a ser cena no telão: quem o
  resolve é o Controle, antes do `load` (`resolverLinkYoutube`), e o Display
  esvazia o palco se um chegar. (`loadYoutube`/`playerVars` saíram com a IFrame
  Player API na v5.212.)

O comando mais frequente do barramento é o `display-status`, emitido pelo telão a
cada `timeupdate` (mais `play`, `pause`, `loadedmetadata`, `ended`,
`volumechange`). Ele é a fonte de sincronização enquanto existir.

---

## Trabalho em segundo plano (downloads com o app minimizado)

Minimizado, o Android trata o processo como descartável e pode **congelá-lo** —
a sincronização de hinos, álbuns, Bíblia ou pastas parava no meio. Enquanto há
download, o [`SyncService`](app/src/main/java/br/org/iasd/av/SyncService.kt) roda
em primeiro plano (com a notificação que o Android exige) e segura um wake lock
parcial, com timeout de 2 h.

**Quem liga e desliga é o lado web**, que é quem sabe o que está em curso:
`bgWorkBegin()`/`bgWorkEnd()` contam as tarefas ativas e só acionam
`AVNative.keepAlive()` no **primeiro** início e no **último** término — dois
downloads simultâneos não podem fazer o primeiro a terminar desligar a proteção
do outro. O `finally` de `withBgWork()` é o ponto crítico: uma falha de rede não
pode deixar serviço e wake lock ligados.

Pontos cobertos: `syncGroup`, `syncCollection`, `ensureSongDownloaded`,
`syncLyrics`, `syncCifrasColecao`, `ensureBibleVersionDownloaded` e
`syncDeviceFolder` (o único que chama `bgWorkBegin`/`bgWorkEnd` direto). No
navegador é tudo no-op.

**E O CONTADOR RESPONDE A DUAS PERGUNTAS, que não são a mesma** (v1.2.28).
`bgWorkCount` responde ao SISTEMA — *"o processo pode ser congelado?"* —, e para
isso toda tarefa conta, rotina inclusive. Mas ele também responde
*"é hora de perguntar sobre a atualização?"* (`horaRuimParaPerguntar`), e aí a
pergunta é outra: **quem PEDIU o trabalho?** `syncLyrics` e `syncCifrasColecao`
rodam sozinhas na abertura sobre o acervo inteiro (MEDIDO: 309 + 145 hinos numa
passada), e enquanto elas corriam a pergunta da atualização não aparecia — a
armadilha do espelho na v5.151 outra vez: *uma condição quase sempre verdadeira
não ADIA a pergunta, ela a APAGA*. Daí `withBgRotina`, irmão do `withBgWork` com
a mesma proteção e contado à parte (`bgRotinaCount`); quem os dois `horaRuim*`
consultam é `bgWorkPedido()`. O contador de rotina zera junto com o outro, senão
um `finally` perdido suprimiria a pergunta pelo resto da sessão.

### O download RETOMA de onde parou

Vivo o app, um download só termina de duas formas: concluído, ou cancelado pelo
operador. `YoutubeGrab.baixar` é um laço de retomada:

- **`Range: bytes=<o que já está no disco>-`**, arquivo aberto em APÊNDICE. Uma
  queda custa os segundos da reconexão, não o download.
- **Oito tentativas com espera crescente** (1 s → 30 s, ~2 min). A espera acorda
  a cada 250 ms para ver se o operador cancelou — um cancelar notado 30 s depois
  não é um cancelar.
- **4xx não é retentado** (`RecusaDoCdn`): a URL expirou ou a faixa foi negada;
  quem tem outras cartas é a fila de candidatos de quem chamou.
- **Servidor que IGNORA a faixa** (200 em vez de 206) faz o arquivo recomeçar do
  zero em vez de acrescentar — continuar daria o começo repetido no meio, uma
  corrupção que só apareceria na hora de tocar.

### E o download SOBREVIVE À MORTE DA PÁGINA

O download roda no shell; quem o espera é um `fetch` da PÁGINA, e o renderer
morre (dois WebViews e um vídeo grande dividem o processo). A recuperação é uma
dobradiça de duas metades, e nenhuma funciona sozinha:

- **O shell guarda o desfecho** (`YoutubeGrab.resgatar`) num slot único — a fila
  de IO da transferência é de uma thread só, então há no máximo um download por
  vez. Conferido por link **e pela forma** (só-áudio, teto): devolver o m4a a
  quem pediu o vídeo seria pior que não guardar nada. Descartado no
  `descartar()`, o mesmo ponto em que os bytes já foram copiados.
- **A página registra a INTENÇÃO** antes do primeiro byte, no `state` do banco (o
  único lugar que sobrevive à morte dela), e a apaga no `finally`. Intenção que
  sobrevive a um lançamento é, por definição, um download que ninguém recebeu.

Reclamar é **pedir o mesmo download outra vez**: o shell devolve o guardado na
hora, sem rede; morto o processo, vira download normal (que retoma do parcial em
disco). O destino original é honrado. Intenção com mais de 6 h é descartada — as
URLs do YouTube expiram.

**A retomada só vale para a MESMA faixa**, e isso é trava, não detalhe: o destino
é nomeado por vídeo + contêiner, então dois itags do mesmo contêiner (137 e 136,
ambos mp4) escrevem no mesmo caminho. Sem a conferência (`parciais`, mapa em
memória caminho → URL), um parcial do 137 seria "retomado" por um download do
136 — dois vídeos emendados, sem erro, aparecendo só na hora de projetar. O mapa
morre com o processo de propósito.

### A TRANSMISSÃO DIRETA é a única mídia que precisa de JS enquanto toca

Um arquivo baixado toca sozinho: o `<video>` consome bytes do disco e nenhuma
linha de JavaScript participa. Um stream não — quem repõe o buffer é o
`shared/mse.js`, e por isso ele é a única cena do app que o segundo plano
consegue interromper. Duas regras, e as duas nasceram do mesmo relato
(*"vídeos tocando direto do YouTube sem baixar são interrompidos quando o app
está em segundo plano"*):

- **O compasso do abastecimento NÃO pode depender só de um `setInterval`.** Com
  o buffer cheio (`ALVO_S`, 20 s) nada mais é appendado e nenhum `updateend`
  sai — quem reacorda o player é o tique. E um `setInterval` de página em
  segundo plano é estrangulado pelo Chromium (1×/s, e 1×/min depois de alguns
  minutos escondida): 20 s de buffer contra um compasso de até um minuto dá
  projeção parando sozinha, sem erro em lugar nenhum. O compasso sai também dos
  eventos do próprio `<video>` (`EVENTOS_DO_COMPASSO`), que nascem do pipeline
  de mídia e não do agendador. O intervalo fica como PISO — é ele que cobre a
  cena pausada, onde não há `timeupdate`.
- **Uma falha de rede não é o fim da transmissão.** Qualquer tropeço matava o
  player e a cena caía no download — 300 MB começando a baixar por causa de um
  pacote perdido, e justamente em segundo plano, que é quando o Wi-Fi entra em
  economia de energia. `pegar()` retenta 4 vezes (0,4 s → 1,2 s → 3 s) com a
  MESMA divisão do download: passa o acidente, **não** retenta 4xx (a URL
  expirada é conserto do `recuperarStream`, que a reconhece pela mensagem).

- **UM TRAVAMENTO NO MEIO TEM DE APARECER, e ser CONTADO.** O indicador de
  espera só existia na CARGA — do comando ao primeiro quadro —, e uma parada por
  falta de buffer no meio do louvor congelava o quadro sem nada na tela: **um
  app quebrado e uma rede ruim produzem a mesma imagem**, e a leitura possível é
  a pior das duas. Hoje a espera tem **duas razões** (`esperaCarga` ·
  `esperaBuffer`) que não se apagam uma à outra, e a fome vira número no Registro
  (`AVStream.fome`: episódios **e** segundos parados — dois travamentos de meio
  segundo e dez de cinco pedem respostas opostas, e só a segunda tem conserto:
  baixar em vez de transmitir).
  - **A vigília só abre no primeiro `playing`.** MEDIDO: um `MediaSource` nasce
    vazio e dispara `waiting` em TODA transmissão, então contar a carga faria o
    número dizer *"≥1 sempre"* — o mesmo que não dizer nada.
  - **Atraso de 600 ms antes de anunciar**, e **só no stream**: um arquivo local
    não fica sem dados, e um cartão piscando a cada seek é pior que cartão
    nenhum. Oráculo: `tools/espera-do-stream.test.mjs`.
  - **O PALCO NÃO DESENHA ESPERA; ELE A ANUNCIA** (`opts.onEspera(ligado)`,
    v1.4.8). Havia DOIS indicadores para o mesmo fato — o cartão "Preparando…"
    sobre a preview e um aro dentro do palco —, e o segundo aparecia também na
    PROJEÇÃO. O aro saiu inteiro, e com ele a folha `shared/stage.css`: o telão
    fica com DOIS estados e nenhum intermediário — o wallpaper em repouso, ou o
    conteúdo de fato no ar. Maquinaria de carregamento é assunto de quem OPERA;
    na projeção ela é o app contando como funciona a quem não perguntou.
    **Quem desenha é o DONO do palco** — invariante 5 aplicada ao motor: ele diz
    o FATO, não a forma. O Controle liga o anúncio ao cartão que já existe (uma
    espera só, do toque ao primeiro quadro); o telão e as telas da rede não
    passam a função, e por isso não têm o que mostrar. **É opção do dono, e não
    `__AV_ROLE__` lido dentro do `stage.js`**: a pergunta é *"este palco é uma
    ILUSTRAÇÃO?"*, e a tela da rede é papel `tela` e é PROJEÇÃO — uma leitura de
    papel acertaria por acidente.
  - **E A SAÍDA DO CARTÃO TEM CARÊNCIA** (`PV_BUSY_SAIDA_MS`, 700 ms). A espera
    tem DOIS donos em sequência — o toque (`cederOPalco`) e a carga do stream (o
    `onEspera`) — e **entre eles o contador passa por ZERO**: o primeiro solta no
    `finally`, o segundo só acende depois do fade de saída e do `getMedia`. Sem
    a carência o cartão sai e volta no meio da MESMA espera. Um dono novo dentro
    dela CANCELA a saída; o botão de cancelar, esse, sai na hora — uma ação sem
    dono não pode ficar tocável. Oráculo: a passagem de bastão no
    `gaveta-e-cartao.test.mjs`, amostrada a cada quadro (um teste do estado
    FINAL passa nas duas versões).
  - **SEM QUADRO, A CORTINA FICA.** `mediaReady` passou a devolver se houve
    dado, e num stream o prazo deixou de REVELAR: ele socorria a transição de
    pendurar, mas o que revelava era o PRETO. O wallpaper é a resposta certa a
    "não há o que mostrar".
- **A RESOLUÇÃO É MEDIDA, e não adivinhada (shell 60).** O player continua sem
  ABR — a escolha é feita UMA vez e vale o louvor inteiro —, e é justamente por
  isso que ela não pode ser cega. O shell entrega a ESCADA (`man.videos`); o
  `mse.js` mede **bytes ÷ tempo do que já é buscado** (init, índice e primeiro
  fragmento: zero requisição a mais, pelo caminho real do CDN) e
  `AVStream.escolherDegrau` — PURA, com oráculo — devolve o degrau que a banda
  sustenta, contando o ÁUDIO junto.
  - **A troca só acontece ANTES DO PRIMEIRO QUADRO**, e é isso que a dispensa de
    qualquer alinhamento de tempo: nada foi mostrado (o aro de espera cobre até
    `PRONTO_STREAM_MS`), o `currentTime` é zero, e trocar é recomeçar. Depois
    disso a bandeira fecha para sempre — uma troca com o louvor no ar é
    gagueira, e este projeto já decidiu que gagueira é pior que uma escolha
    imperfeita.
  - **QUALQUER FALHA NA TROCA MANTÉM O DEGRAU ATUAL** (inclusive repondo o init
    antigo, se o novo já tinha sido appendado). É a propriedade que torna a
    otimização aceitável num culto: no pior caso a transmissão segue como
    seguiria sem ela.
  - **A margem existe porque a medida SUBESTIMA**: ela sai dos primeiros bytes,
    durante o slow start do TCP. Daí a regra só poder DESCER — uma medida que
    subestima nunca justifica um degrau mais alto.
  - **A banda medida sobrevive ao item** (`AVStream.banda`): o segundo louvor do
    culto começa sabendo o que o primeiro descobriu.
  - O seletor da folha virou **TETO** e diz isso na tela. Ele sempre valeu para
    o "Tocar agora" e nada dizia — a escala começa em "Online", que é
    armazenamento, e o resto lia como "qualidade do download".
- **A REDE NUNCA BAIXA A RESOLUÇÃO NO MEIO, e isso inverte a intuição vinda do
  app do YouTube.** Não há ABR: escolhido o degrau, ele vale até o fim. Uma rede
  que piora DEPOIS do primeiro quadro produz **travamento**, nunca imagem menor
  — e quem os conta é o `AVStream.fome`. A janela de decisão é a carga, e só
  ela; passada, o desfecho de uma rede insuficiente é a fome, que o Registro
  reporta para o degrau da PRÓXIMA vez sair certo.
  - **A ordem do shell continua sendo por CLIENTE antes de altura**
    (`ordemCliente`, visionOS na frente — é dele que vêm as URLs que o CDN
    serve). A escada herda essa ordem, então ela é a escada DAQUELE cliente. Se
    um dia um vídeo tiver faixa alta só em outro, a nota `HAVIA Zp transmissível`
    do Registro é quem vai dizer.
  - **O Registro separa as três causas de uma imagem ruim**: `teto Xp` (o que o
    operador pediu), `transmitindo Yp` (o que foi escolhido) e a nota
    `HAVIA Zp transmissível (outro cliente)`, que só sai quando deixamos
    resolução na mesa — o único dos três que seria defeito nosso. MEDIDO em
    aparelho (v5.127): o caso normal é `137@VISIONOS`, que É 1080p. Sobra o
    encoder do Miracast, que fica fora do alcance do app. Ver
    `docs/ACHADOS-EM-ABERTO.md` §3.

> **A TRANSMISSÃO viaja no serviço da sessão de mídia** (não tem serviço
> próprio): o `SessionService` tem **duas razões independentes de viver** (cena ·
> transmissão) e só para quando as duas caem. O tipo é a UNIÃO
> `mediaPlayback|connectedDevice`, e nenhum dos dois tem cota — o teto de 6 h/24 h
> é do `dataSync`, do `SyncService`. **Pré-requisito que derruba a Release:** além
> de `FOREGROUND_SERVICE_CONNECTED_DEVICE`, o tipo exige **uma** de
> `CHANGE_NETWORK_STATE`/`CHANGE_WIFI_STATE`/`CHANGE_WIFI_MULTICAST_STATE`/`NFC`/
> `TRANSMIT_IR` — e `INTERNET`/`ACCESS_NETWORK_STATE` **não estão na lista**. Sem
> `CHANGE_WIFI_MULTICAST_STATE` (nível *normal*), `startForeground` lança. O
> `EspelhoEnergia` ficou com o que nunca foi notificação: wake lock (renovado por
> progresso REAL de entrega, nunca por tique de relógio), Wi-Fi lock e térmica.

### O ciclo de vida do serviço tem três armadilhas, e as três matam o app

- **`startForeground` SEMPRE, antes de qualquer decisão de parar.** Um serviço
  iniciado por `startForegroundService` que morre sem chamá-lo derruba o app
  inteiro ("did not then call Service.startForeground()") — e o processo é o dos
  dois WebViews e da `Presentation`. Só depois disso o `onStartCommand` verifica
  se o download já acabou enquanto o serviço subia e se despede com
  `stopSelf(startId)`.
- **A notificação segue o serviço, não o contrário.** `updateProgress` usa
  `NotificationManager.notify`, independente do ciclo de vida do `Service`: sem a
  guarda de `running`, um cartão `setOngoing(true)` ficava na gaveta para sempre.
  O `onDestroy` zera a flag antes de tudo e cancela o cartão explicitamente.
- **Cota de FGS do Android 15** (`onTimeout`): `dataSync` tem teto de 6 h em 24 h,
  e o acumulado não é hipotético (configurar um aparelho novo soma hinário,
  Bíblia e pastas). Atingido, o sistema dá segundos para parar ou mata por ANR.
  Parar é a única resposta — mas o Kotlin precisa **esquecer** que protegia
  (`SyncService.onGone` → `backgroundWork = false`), senão o
  `if (on == backgroundWork)` da Activity trata o próximo `keepAlive(true)` como
  repetido e o download seguinte fica sem proteção nenhuma, calado.

### A notificação mostra o progresso real

Minimizado, ela é a ÚNICA janela para o download. Quem sabe o progresso é o web:
`bgTaskStart`/`bgTaskStep` → `AVNative.bgProgress({label, done, total, etaMs,
items, idleMs, bytes})` → `SyncService.updateProgress`.

**Números e unidades**

- **A unidade pode ser BYTES** (`bytes`), e a bandeira mora no REGISTRO da
  tarefa, não no envio — um lote de músicas pode rodar ao lado de um vídeo. Um
  download único abria a tarefa com `total = 1`: barra em 0% do começo ao fim e
  ETA **zero** (`bgTaskEta` precisa de um item concluído para ter média). Como
  percentual e ETA são RAZÕES, a matemática não muda; muda a APRESENTAÇÃO
  (`formatBytes`).
- **`Long`, não `Int`**, do `optLong` até o `Progress` — 1080p passa dos 2 GB. Por
  isso `setProgress` recebe **milésimos** (ele é `Int` por assinatura). E o
  `native.js` truncava com `| 0` (Int32 COM SINAL): acima de 2 GB o número virava
  negativo e o `Math.max(0, …)` o zerava.
- **`(lidos, total)` é BYTES nas duas fases.** O caminho de 1080p já reportou uma
  escala 0–100 e a notificação anunciava "0 B de 100 B" para um vídeo de 380 MB.
- **A fase do áudio já soma o `contentLength` do vídeo que vem a seguir** (o
  extrator o entrega antes do primeiro byte), senão a barra fecha em 100% nos
  primeiros segundos e recomeça do zero. Vindo `-1`, nada muda.
- **O PERCENTUAL VEM NA FRENTE** do subtexto — é o pedaço que o Android encurta
  primeiro, e o número que responde "quanto falta?" era o primeiro a sumir.
- **Campo novo no objeto = campo novo no `native.js`, sempre.** Ele REMONTA o
  objeto campo a campo, e do lado Kotlin `optBoolean`/`optLong` leem ausente como
  `false`/`0` — valores legítimos, sem exceção e sem log. Foi assim que `bytes`
  passou versões sem viajar, e a notificação mostrava BYTES como se fossem ITENS.
  `tools/ponte.test.mjs` prende isso.

**A lista de nomes**

- **Diz O QUE está baixando** (`bgItemStart`/`bgItemEnd`, e `bgItemOnly` para
  fluxos sequenciais): "23 de 54" é abstrato, "002. Ó Adorai o Senhor" é o que o
  operador reconhece, e vê-lo trocar é o que mostra movimento. Vale também para
  um item só — `ytArquivo` chama `bgItemOnly` com o título do vídeo.
- **É uma FILA, deliberadamente ilustrativa**, não um espelho do que está no ar:
  os 6 workers andam em lockstep, os eventos chegam em rajada e sem buffer
  (`t.fila`) a rajada rendia UMA troca de nome, com o resto descartado — a
  sensação de travado. A fila consome cada nome UMA vez, em ordem (rodízio
  trazia o mesmo nome de volta). Contador, barra e estimativa continuam reais.
- **O ritmo é MEDIDO** (`bgSpinMs` = `decorrido / concluídos`): se a fila
  acumula, o escoamento acelera junto.
- **O compasso PARA quando trava.** Passando `BG_STALL_MS` (90 s) sem evento
  real, a lista congela e o `idleMs` cresce: os dois sinais concordam.

**Ritmo, freio e estimativa**

- **`idleMs` separa "travado" de "esta faixa é grande"**: passado o limiar, a
  notificação **para de prometer tempo restante** e diz "sem resposta há X". E
  `formatIdle` **não** usa degraus (ao contrário de `formatEta`) — aqui o número
  precisa subir a cada atualização, é vê-lo crescer que diz "não está andando".
- **O freio é UM só e vale só para a rotina.** O Android limita a taxa de updates
  e descarta o excesso (a barra PARECE travada). `BG_NOTIF_MIN_MS` (700 ms) segura
  o `bgTaskStep`; tudo que precisa chegar na hora passa `force` — primeiro nome,
  troca de nome, estado final. Quem dá o ritmo do item que entra é o compasso
  (`bgPacerTick`, `BG_TICK_MS` 250 ms), com `force` a cada troca.
- **É um REGISTRO de tarefas, não um slot único** (daí `bgWorkCount` contar em vez
  de ser booleano): entrar na Bíblia enquanto um lote de álbuns baixa dispara as
  duas, e com um slot só o `done` de uma aparecia com o `total` da outra. A
  notificação mostra a **dominante** (maior tempo restante) e sinaliza as outras
  com `(+N)`. Somar naturezas diferentes num total único não significaria nada.
- **A estimativa vem do ritmo MÉDIO desde o PRIMEIRO item concluído** — não desde
  o `start`, porque antes dele corre o preparo (índice, varredura), que inflava a
  primeira estimativa. Média, não taxa instantânea: faixas têm tamanhos muito
  diferentes.
- **Suavização assimétrica por CONSTANTE DE TEMPO** (`ETA_TAU_DOWN` 2,5 s /
  `ETA_TAU_UP` 10 s): cai rápido, sobe devagar — uma contagem regressiva que
  aumenta parece quebrada. Por tempo e não por chamada, senão o compasso de 1 s
  colaria o valor exibido no bruto.
- **Arredondamento em degraus no lado nativo** (1 min perto do fim, 5 min abaixo
  de 1 h, 10 min acima): "2h03" com erro real de meia hora promete precisão que
  não existe, e faz o número mudar a cada atualização.
- **Num lote (`syncGroup`) a barra acompanha o LOTE**, não cada álbum.
- Shell antigo: `bgProgress` não existe, o `try` engole, a notificação fica
  estática.

---

## Notificação de controles (sessão de mídia)

[`SessionService.kt`](app/src/main/java/br/org/iasd/av/SessionService.kt) publica
um `MediaSession` e uma notificação `MediaStyle`. Dois ganhos, e o segundo é o
menos óbvio:

1. **Controlar sem abrir o app** — o celular fica no suporte, provavelmente
   bloqueado. Os controles aparecem também na tela de bloqueio e nas
   configurações rápidas, de graça.
2. **A projeção deixa de ser descartável.** Sem ele o único serviço em primeiro
   plano era o `SyncService`, que só sobe DURANTE downloads: num culto normal não
   havia nenhum, e o processo seguia candidato a ser morto sob pressão de
   memória — levando a `Presentation` junto.

### O transporte

- **Nenhuma decisão de transporte em Kotlin** (invariante 5). O sistema entrega
  uma string, `SessionRemote` a repassa a `window.__avRemote`, e o web aciona os
  **mesmos botões da tela** por `.click()` — os handlers já tratam os casos de
  borda, e um botão `disabled` é no-op natural. **Por isso nenhuma ação é
  desabilitada no lado nativo:** quem sabe se "estrofe anterior" faz sentido é o
  web, e a cópia em Kotlin envelheceria.
- **`play`/`pause` ≠ `playpause`.** Tela de bloqueio, fone e Android Auto mandam
  intenção explícita; o botão da notificação é alternador. Tratar tudo como
  alternador faria um `onPlay` recebido com o áudio tocando PAUSAR o louvor.
- **⏮/⏭ mudam de eixo conforme a cena** (`slideMode`, de `slideTarget()`): com
  letra, versículo ou mensagem em cena é a estrofe que o operador passa. O rótulo
  diz qual é o modo, para não virar adivinhação — e é por CABER rótulo aqui que
  o eixo duplo continua fazendo sentido neste cartão. **A COLUNA DA TELA CHEIA
  segue a mesma regra** (toque curto passa estrofe, toque longo passa mídia —
  `attachTransportStep`); as duas são as ÚNICAS superfícies com eixo duplo desde
  a v1.3.5. Na BARRA DE TRANSPORTE o par voltou a ser só mídia: lá a preview é
  flanqueada por dois botões de slide próprios, e um eixo escondido atrás do
  tempo do toque não se justifica com o outro a dois centímetros dali.
- **A PALAVRA do rótulo é `slideLabel`** ("estrofe" não serve para uma
  apresentação, onde ⏮/⏭ passam página).
- **Os BOTÕES vêm do web** (`actions`, shell 42), na ordem — invariante 5
  aplicada ao cartão. Lista vazia = os cinco de sempre. O conjunto entra na CHAVE
  de deduplicação do `pushNowPlaying`: sem isso, uma cena que muda só de eixo
  seria deduplicada e o cartão ficaria com os botões da cena anterior. **Um botão
  que sobrou é pior que um que faltou: ele responde.**
- **Declarado nos DOIS lugares que o Android lê** — `PlaybackState` (que desenha
  do 13 em diante) e `Notification.Action` (abaixo dele). Declarar de um lado só
  faz o botão existir em metade dos aparelhos.

> **Do Android 13 em diante quem desenha os botões é o `PlaybackState`**, não a
> notificação: as `Notification.Action` viram decoração. Os controles saem das
> *actions* do estado e os extras (Parar, cortina) de
> `PlaybackState.CustomAction`, entregues por `onCustomAction`.

### O estado

- **Sai de `pushNowPlaying`**, que lê o título do `#npNameInner` já renderizado e
  a posição/duração da própria **barra de progresso** (`#seek`) — em vez de
  reconstruir as origens ou recalcular o tempo por fora. Duplicar essas árvores
  era garantir divergência, e a barra é a única fonte que cobre todos os tipos
  (`preview.getDuration()` é do `<video>` do stage e não sabe nada de YouTube).
  Barra desabilitada zera os dois campos, para o sistema não desenhar uma linha
  do tempo sem significado.
- **Campo novo em `pushNowPlaying` = campo novo em `AVNative.nowPlaying`**,
  sempre — e **sem** subir `SHELL_VERSION`, porque o Kotlin não muda. Ela remonta
  o objeto campo a campo, um campo esquecido some em silêncio e o `optString` lê
  vazio como "use o padrão": foi assim que a notificação escreveu "(estrofe)"
  durante toda a rodada das apresentações.
- **CENA é tudo que está no telão, não só mídia:** `active` inclui `currentId`,
  mensagem, versículo, **cronômetro e sorteio** projetando. O caso que os dois
  últimos cobrem é a sessão RECÉM-ABERTA — projetar a contagem regressiva sem ter
  selecionado mídia nenhuma não levantava o serviço, e o processo seguia
  descartável exatamente durante os dez minutos em que o operador minimiza o app
  para esperar.
- **A posição fica FORA da chave de deduplicação** (a sessão extrapola sozinha:
  posição + decorrido × velocidade). Mas **seek é descontinuidade** que a
  extrapolação não adivinha: em vez de avisar em cada ponto que faz seek,
  `pushNowPlaying` compara o tempo real com o extrapolado e republica além de
  `POS_TOL_MS` (1,5 s, folga para o jitter do `display-status`) — um só lugar
  cobre todas as causas, inclusive as futuras. Durante um ARRASTE não republica:
  ali o valor é a posição do dedo.

### Ciclo de vida e threads

- O serviço vive enquanto houver **cena**, não só enquanto toca: pausado, o
  operador ainda precisa do play.
- **A cena pode acabar enquanto o serviço sobe.** Publicar dispara
  `startForegroundService`, e o `active:false` que vem atrás chega ANTES de o
  serviço existir — sem a guarda ele nascia com "Nada em exibição", e nada mais
  chamaria `stop()` (o web deduplica por chave e não reenvia). `stopSelf(startId)`
  e **não** `stopSelf()`, para uma cena nova já enfileirada cancelar a parada.
  E `stop()` só chama `stopService` quando o serviço **já** está em primeiro
  plano: derrubá-lo com um `startForegroundService` pendente é caminho conhecido
  para o app ser morto — perder a notificação é arranhão, perder a projeção não.
- **`publish()` sempre na main thread.** Todo `@JavascriptInterface` é chamado de
  uma thread do WebView, e `MediaSession` tem handler próprio e não promete ser
  thread-safe.
- **E esse salto de thread abre uma janela, que `running` fecha.** Entre o
  `update()` (thread do WebView) e o `publish` enfileirado na main, o `onDestroy`
  de um `stopSelf` anterior pode rodar: sem a guarda, a continuação publicava
  numa instância destruída — um `notify` que ninguém cancela, ou um
  `startForeground` de um serviço que não existe. Pelo mesmo motivo o `onDestroy`
  **cancela a notificação explicitamente**: o sistema só recolhe sozinho a que
  veio de `startForeground`.

### Ícones

Os do sistema onde eles existem (`android.R.drawable.*`: `ic_media_previous`,
`ic_media_play`/`ic_media_pause`, `ic_media_next`) — um conjunto próprio no
`res/` só para cinco botões não se paga, e o `MediaStyle` os tinge conforme o
tema. **Duas exceções, e as duas pelo mesmo motivo: o símbolo certo não está
lá.**

- **A cortina** (`ic_image` / `ic_image_off`): o sistema não tem imagem riscada,
  e o `ic_menu_view` é um OLHO, que sugere "esconder a vista" quando o que sai
  do telão é a MÍDIA.
- **Parar** (`ic_stop`, v1.1.2): `android.R.drawable` tem play, pause, ⏮ e ⏭ e
  **não tem parar**. O que ocupava o lugar era o `ic_menu_close_clear_cancel` —
  um ✕, que num player não diz "parar", diz "fechar": ao lado do play e do ⏭ ele
  se lia como "dispensar a notificação", a única coisa que aquele botão não faz.
  O quadrado cheio é o MESMO símbolo do `#stop` da barra de transporte do app,
  que é a regra que a cortina já seguia. (O ✕ fica onde ele é verdade: o
  "Desligar transmissão" do cartão da transmissão, que de fato encerra e
  dispensa.)

**O ícone mostra o ESTADO; o rótulo, a AÇÃO.** Telão coberto = imagem riscada;
mídia no ar = imagem inteira. O rótulo ("Cobrir telão"/"Mostrar mídia") nomeia o
que o toque faz — é o que a notificação tem de sobra em relação à tela, onde quem
carrega o estado é a cor. Inverter num lugar só faria o MESMO símbolo significar
coisas opostas nos dois.

### A notificação NÃO pode depender do JS do Controle

Com o app minimizado e sem áudio audível, o sistema estrangula aquele WebView:
`pushNowPlaying` para de ser chamado e a notificação congela — botão em "play",
barra parada — enquanto o telão segue projetando.
`NativeBridge.snoopDisplayStatus` lê de passagem o `display-status` que o telão
já emite pelo `busPost` e corrige play/pause, posição e duração
(`SessionService.updateFromDisplay`). A `Presentation` não é estrangulada: é uma
fonte que continua viva quando a outra não está. **Não é decisão de transporte**
— copia campos que o web já calculou, e sem cena publicada não inventa nada.
Republica com a mesma economia do web. **Sem telão conectado o caso não se
aplica**: ali a projeção É a preview em tela cheia, que exige o app na frente.

> **A verificar em aparelho:** se o WebView criar uma sessão de mídia própria ao
> tocar áudio, poderia aparecer uma notificação concorrente. Nada no código
> indica isso, mas não foi observado rodando.

---

## OTA da base web (atualização sem APK)

O job `web-ota` (todo push em `main`) empacota `assets/web/` num
`web-<versão>.zip` e publica, com um `version.json`, na release de tag fixa
**`web-latest`** — URL estável porque está compilada no shell. O app consulta o
`version.json`, baixa quando há versão nova e passa a servi-la.

### Os DOIS canais são UM evento

```
 push em main            Release v2.0 publicada         aparelho
 ┌─────────────┐ shellTag ┌──────────────────┐         ┌──────────────────┐
 │ version.json│ ───────► │ audio-visual….apk│ ──────► │ ronda de 15 s    │
 │ "shellTag": │  SEGURA  └──────────────────┘ gatilho │ lê o MANIFESTO   │
 │   "v2.0"    │  o OTA     o MESMO run                │ web + shell      │
 └─────────────┘                                       │ → UMA pergunta   │
                                                       └──────────────────┘
```

- **`shellTag` no `version.json` é o acoplamento.** Declarado, o `web-ota`
  **segura a publicação do bundle** até a Release existir (o job termina verde e
  diz no resumo que está segurando — é o estado normal entre o merge e a
  Release). Quando ela sai, o bundle é republicado com o bloco **`shell`**
  (versão, URL do `.apk`, tamanho) dentro do manifesto. Sem `shellTag` o
  manifesto anuncia a Release mais recente que existir — `shellTag` responde
  *"este lote PRECISA de uma Release?"*.

  **QUEM SOLTA O HOLD É O PRÓPRIO RUN QUE PUBLICA, não o gatilho `release`.** A
  Release nasce do `action-gh-release` com o GITHUB_TOKEN padrão, e evento
  originado nesse token **não cria execução nova de workflow** — medido: em 136
  execuções do `apk.yml`, `release` disparou **zero** vezes. O que funciona é
  ORDEM DE JOB: o `web-ota` tem o `apk` no `needs` e consulta a Release já
  publicada, no mesmo run. O `on: release: [published]` fica para a Release que
  nasce de outra mão (a interface do GitHub, ou um PAT).

  **E a PÁGINA sofre do mesmo mal, por outro caminho** (v1.0.1): ela é outro
  workflow, e `needs` não atravessa arquivo. O `pages.yml` passou a encadear por
  `workflow_run` no "Build APK" — o mecanismo do próprio GitHub para isto, e o
  único que o guarda de recursão não suprime. Sem ele, o botão "Baixar grátis"
  serve o `.apk` da Release ANTERIOR até alguém reconstruir à mão.

  **E a VERSÃO que a página anuncia sai do MANIFESTO, não da tag da Release.** A
  tag é a versão do APK, e ela fica parada em todo lote que sai só por OTA — o
  aparelho mostrava 1.0.2 e a página dizia 1.0.1, com o mecanismo inteiro
  funcionando. O manifesto responde *"quão novo é este app?"* e é o que está de
  fato PUBLICADO (o `version.json` do repositório pode estar segurado pelo
  `shellTag`). Tamanho e URL continuam vindo do APK, que é o que se baixa.
- **É o manifesto que permite a detecção ser rápida.** A API do GitHub não
  autenticada dá **60 req/hora por IP**; a ronda de 15 s são 240. Perguntar o APK
  à API esgotaria o limite em quinze minutos e passaria a falhar com 403 pelo
  resto da hora. O manifesto é asset de release e **não consome limite nenhum**:
  uma requisição responde as duas perguntas, e no MESMO instante.
- **O zip tem nome versionado**, e isso fecha uma classe inteira: com
  `web-assets.zip` substituído no lugar, duas execuções intercaladas deixavam o
  zip de uma com o `sha256` da outra — e a partir daí todo aparelho baixa,
  reprova o hash e o **OTA fica INERTE até o próximo push**, sem sinal. O único
  arquivo substituído no lugar passa a ser o manifesto, escrito por último. O job
  recolhe os antigos deixando os **três mais novos** (apagar o que alguém está
  baixando devolveria 404 no meio do download).
- **`sha256` reprovado é FALHA, não desfecho.** Devolver `null` carimbava a
  tentativa como bem-sucedida (`ultimoOk` renovado, `falhasSeguidas` zerado, sem
  espera crescente), e a ronda seguinte rebaixava o mesmo zip, para sempre.

### A atualização PERGUNTA

- **Uma pergunta, sobre o lote — e ela DIZ O QUE VEM.** Três blocos, nesta
  ordem, porque é a ordem da leitura: a IDENTIDADE (*"Base v1.0.6."* · *"Base
  v1.0.6 e app v1.0.2 (4,2 MB)."*), a LINHA DO TEMPO das mudanças, e a
  CONSEQUÊNCIA do toque (*"as duas telas recarregam…"* · *"o Android vai pedir
  para confirmar a instalação"*) — que é a única das três que a lista nunca
  responde, e a razão de haver pergunta em vez de a atualização entrar sozinha.
  Desfechos: **Atualizar agora** · **Deixar para depois**.
- **As notas viajam DENTRO do bundle** (`assets/web/notas.json`, uma entrada por
  versão), lidas pelo shell do diretório do bundle BAIXADO
  (`WebUpdater.notasPendentes`) e entregues já filtradas para o que o aparelho
  ainda não tem. **Não no manifesto**, por três razões independentes: ele é
  buscado 240 vezes por hora e essas linhas importam uma vez por semana; dentro
  do zip elas não têm como divergir do que descrevem; e nada de novo entra no
  caminho de rede, logo nada de novo pode falhar nele. **O preço, dito: um lote
  SÓ de APK não tem linha do tempo** — não há bundle novo de onde lê-la, e o
  desfecho é a pergunta sem a lista, nunca uma lista errada.
- **O ARQUIVO GUARDA A SÉRIE ATUAL E A ANTERIOR, e nada mais** (v1.4.3). Ele
  chegou a 87 entradas — 51 kB em TODO bundle, com linhas descrevendo a v1.0.1.
  A regra de poda é `MAIOR.INCREMENTAL`: hoje 1.4.x e 1.3.x, 20 entradas e
  17,5 kB. **O preço está dito e é pequeno:** o "E mais N mudanças" do rodapé
  conta o que está NA LISTA, então um aparelho parado há meses vê um N
  subestimado. A lista visível tem seis linhas de qualquer jeito
  (`OTA_MAX_LINHAS`), e as podadas descrevem versões que não rodam em aparelho
  nenhum. Podar de novo quando a série virar — o histórico completo de cada
  lote continua em `docs/HISTORICO.md`, que é onde ele é consultado por `grep`.
- **O teto de linhas é o que a mantém uma linha do tempo.** Seis
  (`OTA_MAX_LINHAS`); o que sobra vira *"E mais N mudanças."* **no rodapé, que
  não rola** — na lista, que rola, esse aviso era o primeiro item a ser cortado,
  e o que sobrava era uma lista truncada afirmando ser tudo. O teto de ALTURA
  mora no `.dialog-card`, não na lista: `40vh` na lista a cortava com o cartão
  ocupando 477px de 640 — ela não sabe quanto os irmãos estão gastando.
- **Ordem base → APK.** A base é rápida e não depende de confirmação; o APK exige
  um diálogo do sistema que pode ser recusado. Invertido, uma recusa ali deixaria
  o lote inteiro por aplicar.
- **A INTENÇÃO sobrevive à recarga.** `otaApply` substitui o documento, então
  nada em memória atravessa: a intenção é gravada no `state` do banco ANTES de
  aplicar (mesmo lugar e motivo da intenção de download do YouTube) e relida na
  abertura seguinte. Descartada quando o `versionName` instalado alcança a versão
  pedida — sem isso o instalador reabriria oferecendo o que já está rodando — e
  depois de 6 h.

  **E ela é gravada por `AVDB.updateState`, nunca por `setState` — este é o
  ponto do recurso, não um detalhe.** `setState` resolve na aceitação do
  REQUEST, com a transação ainda em voo; a linha seguinte é o `otaApply()` que
  recarrega as duas páginas, e conexão derrubada ABORTA transação em voo. A
  intenção some, a abertura seguinte não acha nada, e a metade nativa do lote
  desaparece **com tudo parecendo ter funcionado** — o desfecho exato que a
  intenção existe para impedir. `updateState` espera o commit (`txDone`). Os
  quatro pontos que mexem em `ota-intencao` seguem a mesma regra, e o
  `apagar` de `instalarApk` pelo motivo espelhado: o diálogo do Android pode
  derrubar o app no instante seguinte, e uma limpeza não commitada reabre o
  instalador na abertura seguinte.
- **A pergunta espera só o que ACABA: cena projetando e download em curso.** O
  **espelho não segura**: ele fica ligado o culto inteiro, e incluí-lo tornava a
  supressão permanente (foi por isso que a v5.151 desistiu de perguntar).
  **Instalar o APK espera os três** (`horaRuimParaAtualizar`), porque derruba o
  app e leva o servidor da rede junto.
- **"Depois" cala o diálogo, não o FATO** — e cala só ESTA sessão. `otaAdiadas`
  é um `Set` em memória que morre com a página: minimizar mantém o adiamento (é
  a mesma sessão), FECHAR e reabrir o desfaz, porque o `onCreate` reconstrói o
  WebView e a página nasce limpa. A pergunta volta na abertura seguinte.
- **O botão `#otaRow` de Configurações SÓ EXISTE depois do "depois"** — ele diz
  por extenso o que espera ("Atualizar: base v5.245 e app v2.2") e aplica no
  toque. Antes ele era visível sempre e, sem nada esperando, dizia "Procurar
  atualização": um botão de procurar numa tela onde não há o que procurar sugere
  que cabe ao operador conferir, e não cabe — a ronda bate a cada 15 s. Com a
  pergunta AINDA na tela ele também não existe: ali quem oferece é o diálogo.
- **Toque fora do diálogo NÃO responde por ele** (`appDialogFixo`). Esta pergunta
  aparece sozinha, no meio de outra coisa, e um toque em qualquer lugar a
  resolvia como "depois", silenciando-a pela sessão. "Deixar para depois" e
  Esc/voltar continuam valendo — o que deixa de existir é a recusa por acidente.
- **O Registro diz POR QUE está esperando**: ninguém foi perguntado, o operador
  adiou, espera a cena sair, ou o shell recusou o bundle. As quatro pedem ações
  opostas.

Oráculo: **`tools/ota.test.mjs`** (Chromium + ponte de mentira), incluindo a
intenção atravessando a MORTE DO DOCUMENTO — semeada numa página que só carrega
`shared/db.js`, e não no Controle: ali `retomarAtualizacao()` roda na abertura e
CONSOME a semente antes de a navegação acontecer, o que é o app fazendo o certo
e o oráculo medindo a si mesmo.

### A detecção: quatro gatilhos

1. **abertura**;
2. **ronda de 15 s** na frente (120 s em segundo plano), enquanto o processo viver;
3. **`onResume`** — com `forcar`, a única exceção ao piso: é o instante em que a
   resposta pode virar uma pergunta na tela;
4. **a rede voltando** (`registerDefaultNetworkCallback`, com
   `onCapabilitiesChanged`/`NET_CAPABILITY_VALIDATED` — o Wi-Fi da igreja associa
   **antes** de ter saída, e `onAvailable` sozinho dispara cedo demais).

- **Falha retenta sozinha**, 5 s → 10 → 20 → 30 s. O teto era 90 s e era o pior
  lugar para ser generoso: acima de meio minuto a espera dura MAIS que a ronda, e
  uma falha transitória sai punindo a detecção.
- **O piso entre consultas (5 s) é MENOR que a ronda (15 s).** Com os dois
  iguais, uma batida um milissegundo cedo era descartada e a seguinte só viria
  15 s depois — a ronda valendo 15 s ou 30 s conforme o jitter do agendador. É a
  receita exata da "detecção inconstante e quase aleatória".
- **E por isso o piso é POR CHAMADOR.** A enquete do lado web bate a cada 10 s e
  passava livre pelos 5 s: a rotina que se anuncia como "lê o disco" virava uma
  consulta à rede a cada dez segundos, para sempre. Subir o piso comum acima de
  10 s é o reflexo errado — aí a enquete ROUBA o passo da ronda, e a detecção
  fica mais lenta do que sem ela. O cutucão da tela leva o piso da PRÓPRIA ronda
  (`WebUpdater.cutucaoDaTela`): ele só vira requisição quando a ronda não
  entregou uma passada inteira, que é o papel dele — rede de segurança, não
  segunda ronda.
- **A ronda é blindada contra exceção.** `scheduleWithFixedDelay` CANCELA todas
  as execuções seguintes quando o `Runnable` lança — sem log e sem `Future` que
  alguém consulte. Errar aqui é a detecção parar para sempre naquele aparelho.
- **Nada de cópia guardada.** O asset de `web-latest` é substituído no lugar
  (mesma URL, conteúdo novo), que é exatamente quando um cache devolve o de
  ontem com toda a razão — e isso não atrasa a atualização, torna-a INVISÍVEL.
  Daí `no-cache` **e** `?t=` na URL (caches que ignoram o cabeçalho existem).
- **O shell EMPURRA** (`window.__avAtualizacao`) quando o estado muda —
  inclusive **quando só o APK mudou**, senão uma Release sem base web nova
  ficaria muda. A enquete de 10 s é o piso, para o caso de o empurrão se
  perder.
- **A comparação é contra o que o aparelho JÁ TEM** (`versaoJaTemos`), não contra
  o que ele SERVE: um bundle baixado espera o próximo lançamento e
  `currentVersion` continua sendo o da sessão — comparar por ele rebaixaria o
  mesmo zip a cada ronda, apagando com `deleteRecursively` um diretório que o
  operador pode ter acabado de mandar aplicar ao vivo.
- **`#otaRow` tem dois estados**: "Procurar atualização" (pula o piso do shell,
  ao lado do `onResume` — são os dois que o fazem) e "Atualizar: …". Os dois
  desfazem a recusa da sessão. `otaDiag` alimenta a linha **"Procura:"** do Registro: "não apareceu
  aviso nenhum" tem quatro causas indistinguíveis da tela.
- **Sem `WorkManager` nem alarme**, de propósito: atualizar a base de um app
  FECHADO não serve para nada (ela entra ao abrir, e ao abrir a procura acontece).

> **O nome do repositório aparece nos DOIS lados e eles têm de bater**: o workflow
> usa `$GITHUB_REPOSITORY`, e `WebUpdater.REPO` é digitado à mão. Renomear o
> repositório exige mexer nessa constante **e** publicar um APK (a URL está
> compilada no shell). O modo de falhar é mudo: o `check()` engole tudo em
> `Log.i`.

**A identidade do bundle é `assets/web/version.json`** (`version` + `minShell` +
`shellTag` opcional), versionado no repositório — o bundle carrega a própria
versão, seja o embutido ou o baixado. O workflow acrescenta `sha256`, a URL e,
havendo Release, o bloco `shell`. A forma de `shellTag` é validada no CI
(`v` + números): malformado devolve 404, o job segura o OTA **para sempre**, e o
sintoma é "a atualização não chega".

**O OTA não muda o acesso ao nativo:** a ponte é injetada pelo Kotlin
(`addJavascriptInterface`), não vem nos arquivos web — bundle baixado enxerga
`__AVBridge` como o embutido, servido pelo mesmo origin.

### As três garantias (isto roda em culto)

1. ~~**Nunca troca a base no meio de uma sessão.**~~ **REVOGADA** (v1.68/v5.151),
   depois **substituída pela pergunta** (v5.234). Ela prometia "entra no próximo
   lançamento", e `beginSession()` decide uma vez por **PROCESSO** — que quase
   nunca morre (os serviços em primeiro plano o mantêm vivo, e fechar pelo
   Recentes derruba a Activity, não o processo). O que sobrevive dela:

   - **A faxina roda só em `beginSession()`** (`sessionStarted`), e preserva o
     alvo novo **e o `sessionRoot` em uso**: ela APAGA diretório, e o `cleanup`
     rodando numa recriação de Activity apagaria o que os dois WebViews estão
     servindo — todo recurso ainda não carregado cairia no fallback do APK, no
     meio da projeção.
   - **Nada é apagado ao aplicar**: o diretório antigo pode ter requisições em
     voo durante a recarga; quem recolhe é o `beginSession()` seguinte.
   - **Dois caminhos de aplicação, independentes de propósito** (um chega por
     APK, o outro por OTA): no shell, `check()` → `aplicarSozinho` →
     `applyWebUpdate` (robusto: não depende de o WebView do Controle estar vivo);
     no web, a enquete + o gatilho de retomada, para o caso de o empurrão se
     perder.
   - **`otaRecusadas` mudou de significado**: era "o operador disse depois", hoje
     é "**já tentamos e o shell não aceitou**" — sem ela, um bundle reprovado
     faria a enquete pedir aplicação a cada 20 s, para sempre.

   O que a substitui é o **watchdog de boot** (garantia 3).
2. **Válvula `minShell`.** Bundle que exija ponte mais nova que
   `NativeBridge.SHELL_VERSION` é recusado; o app segue no que tinha. **É por
   isso que `SHELL_VERSION` sobe a cada mudança de superfície da ponte** — sem
   isso a válvula não protege nada.
3. **Watchdog de boot.** Servir um bundle arma um `pending`; o web o desarma
   (`otaConfirm`). Bundle que não confirme é descartado no lançamento seguinte e
   o app volta ao embutido. O `pending` guarda o **NOME do subdiretório**, não um
   booleano — com booleano a confirmação de um bundle perdoava outro. A chave é
   nova de propósito: ler um `Boolean` como `String` em `SharedPreferences` lança
   `ClassCastException` dentro do `onCreate`, e o app não abriria depois de
   atualizar o APK.

#### O sinal de boot é "o app está DE PÉ" (`otaAppIsUp`)

`window.AVDB` no `load` não bastava: a ordem dos scripts do Controle é
`native.js` → `db.js` → `mse.js` → `stage.js` → `louvorja.js` → `bible.js` →
`serie.js` → `cifra.js` → `sorteio.js` → `hinario.js` → `controle.js`, e um erro
em qualquer um dos **dez** últimos aborta só AQUELE script — o `load` dispara, `AVDB` continua lá, e o
bundle quebrado era carimbado como bom **para sempre**. As cinco condições,
cada uma cobrindo o que a anterior não cobre:

1. **papel `controle`** — o Display não carrega `controle.js` nem `louvorja.js`,
   e é o caso NORMAL de culto: confirmaria quase sempre no lugar do outro. Regra
   imposta **nos dois lados** (o laço nem começa no Display, e `otaConfirm`
   recusa `role != "controle"`).
2. **`AVDB` · `AVStream` · `createStage`** — os três módulos compartilhados, cada
   um publicando seu global no fim do arquivo.
3. **`__avBack`** (perto do fim do `controle.js`) — só existe se o arquivo foi
   parseado inteiro. É a mesma função que `handleBack()` consulta: contrato que
   já existe, não marcador inventado.
4. **um `<li>` dentro de `#playlist`** — o HTML entrega o `<ul>` VAZIO; quem o
   preenche é `renderPlaylist()`, dentro do `init()` assíncrono, que começa por
   `loadCollections()`. Prova que a inicialização terminou.

5. **`Louvorja` · `Bible` · `AVSerie` · `AVSorteio` · `AVCifra` · `AVHinario`** — os seis
   scripts do Controle, cada um publicando seu global na ÚLTIMA linha do arquivo. Eram o
   buraco declarado deste watchdog até a v5.315: todo uso de `AVSerie`/`AVSorteio`
   no `controle.js` está DENTRO de função, então um erro de topo num deles **não**
   aborta o `controle.js` — `__avBack` existe, a playlist renderiza, `otaConfirm()`
   desarma o watchdog, e o bundle ficava adotado PARA SEMPRE com a Playlist
   automática (ou a Biblioteca de séries, ou a Bíblia, ou o hinário) morta, sem
   erro na tela e sem recuo no lançamento seguinte.

**Por polling** (250 ms, desistindo em 30 s, em silêncio), e não checagem única
no `load`: o `init()` é assíncrono e termina DEPOIS do `load` — uma checagem
única rejeitaria todo bundle bom. **O erro possível aqui é o SEGURO**: fechar o
app antes da confirmação descarta um bundle bom (custo: baixa de novo); carimbar
um quebrado não tem volta sem publicar outra versão. `native.js` viaja DENTRO do
bundle que valida, então não há descompasso.

#### Trocar a base servida OBRIGA a limpar o cache do WebView

As URLs não mudam de nome entre versões e o WebView roda com
`cacheMode = LOAD_DEFAULT` — servir um bundle diferente do anterior faz a página
nascer **com metade de cada bundle**, e o modo de falhar **se realimenta**: uma
página remendada não satisfaz o `otaAppIsUp`, o bundle seguinte também é
descartado, e o aparelho fica preso entre duas versões.

A regra já existia em `StagePresentation.recarregar` e `MainActivity.applyWebUpdate`;
faltava no **lançamento** — os caminhos de recuo do `beginSession` (watchdog
descartando um bundle, APK novo atropelando um OTA mais antigo).
`WebUpdater.baseTrocou` responde contra **`KEY_SERVIDO`** (o que a sessão
anterior de fato serviu), **não** contra `KEY_ACTIVE` (que diz o que o OTA
*quer* servir), e `buildControleWebView` limpa o cache antes do primeiro
`loadUrl`. O cache é **por aplicação**, então limpar no primeiro WebView cobre a
`Presentation`. Ausente não conta como troca. `beginSession` tem **saída única**
(`fixarBase`) por causa disto: eram quatro `return` espalhados, e um quinto
acrescentado sem a anotação passaria despercebido.

#### As outras defesas do caminho de download

- **Uma verificação por vez** (`checking`, `AtomicBoolean`). `checkAsync` roda em
  todo `onCreate` e `android:configChanges` não cobre `fontScale` nem `locale`:
  mudar o tamanho da fonte durante um download disparava um segundo `check()`
  escrevendo nos MESMOS temporários — podia ativar um diretório INCOMPLETO. Os
  temporários levam sufixo único por execução.
- **Host travado** (`github.com`, `objects.githubusercontent.com`) e **`https`
  obrigatório**. Não dá autenticidade, mas impede que um campo alterado aponte o
  download para outro servidor — e esse JS rodaria no origin privilegiado.
- **`sha256` obrigatório**; **zip slip** e teto de tamanho na extração;
  **reprovação antes de ativar** (sem `web/controle/index.html`, descarta).
- APK novo com base mais recente descarta um OTA antigo. Comparação **numérica
  por componente** (`compareVersions`), não lexical — `4.9` < `4.82` como string.
- O fallback é **por arquivo**: o que faltar no bundle baixado vem do APK.

---

## Telão por comandos (o telão nas telas da rede local)

O telão inteiro — fades, cortina, Camada de Texto, letra sincronizada e vídeo —
em até **três navegadores da rede da igreja**, sem instalar nada neles e sem
internet. A especificação fechada está em
[`docs/TELAO-POR-COMANDOS.md`](docs/TELAO-POR-COMANDOS.md) — **leia antes de
mexer**; esta seção é o mapa.

```
 ┌────────────── celular ──────────────┐        ┌───── navegador na LAN ─────┐
 │  Controle (/web/controle/)          │        │  o MESMO /web/display/     │
 │   └─ cada comando do barramento ────┼─SSE───►│  (papel `tela`)            │
 │  EspelhoServidor                    │        │   ├─ stage.js de verdade   │
 │   ├─ serve o BUNDLE (OTA→APK)       │◄─POST──│   ├─ mídia por /m/<token>  │
 │   └─ /m/<token>: cache de mídia     │  /r    │   └─ status de volta       │
 └─────────────────────────────────────┘        └────────────────────────────┘
```

**O que faz isto valer a pena é o que NÃO atravessa a rede.** A tela carrega o
próprio bundle do app (servido pelo celular, com a MESMA resolução OTA→APK do
`WebPathHandler`) e roda o `/web/display/` de verdade. O que viaja são
**comandos** (os objetos JSON do barramento, verbatim, por SSE) e **mídia sob
demanda** (`/m/<token>`, com `Range` RFC 7233 de verdade — a **inversão da
invariante 8**: num `ServerSocket` quem aplica a faixa somos NÓS). A invariante 5
sai ilesa duas vezes: o Kotlin não decide nada de cena, e a tela não reimplementa
nada.

**AUXILIAR por contrato:** liga e desliga **só** por ação do operador, pelo
fechamento do app, ou por uma falha nomeada em texto. Uma TV que conecta **não**
derruba a transmissão — sem TV, as telas da rede SÃO o que a congregação vê.

**A REDE PODE SER O PRÓPRIO CELULAR (v1.4.1).** A transmissão nunca precisou de
internet; ela precisava que o celular fosse **cliente** de uma Wi-Fi, e numa
igreja sem rede isso não existe. Hoje há duas vias, e o `via` do estado diz qual
está servindo:

| via | o que é |
|---|---|
| `WIFI` | o de sempre: o celular é cliente de uma Wi-Fi (com ou **sem** uplink — `NET_CAPABILITY_VALIDATED` fica deliberadamente fora do filtro) |
| `PONTO_DE_ACESSO` | o celular É o roteador: hotspot ligado, o computador entra nele |

**E o ponto de acesso é a resposta mais forte ao AP ISOLATION** — a falha muda
deste recurso (servidor de pé, porta escutando, nenhum SYN chegando). Isolamento
bloqueia cliente↔cliente; no hotspot o celular é o **GATEWAY**, e é dele que o
computador tira DHCP e DNS, então esse caminho não pode estar fechado.

**As duas não se somam por decisão nossa:** com as duas de pé, quem escolhe é o
operador (`redes.length > 1` desenha a escolha) — qual delas a tela alcança não
é decidível pelo app. E quem serve não migra sozinho para a outra: o
`confirmarRede` religa **na mesma via**, porque migrar seria ligar por conta
própria, e o contrato diz AUXILIAR.

**O que o AP tem de próprio, e por que a enquete existe:** `observarRede` assina
`TRANSPORT_WIFI`, e em modo AP puro esse callback **nunca dispara** — não há
`Network` para ganhar nem perder. Não há morte errada em 6 s ali; há coisa pior,
**nada vigiaria o AP caindo**, e o socket ficaria amarrado a um endereço morto.
Quem cobre isso é `vigiarPontoDeAcesso` (5 s), que levanta a mesma SUSPEITA e
deixa o veredito com o `confirmarRede` de sempre. O caso não é raro: o hotspot
**se desliga sozinho por ociosidade** em vários fabricantes.

### As peças, e o que cada uma se recusa a fazer

| Arquivo | O quê |
|---|---|
| `EspelhoHttp.kt` | parser HTTP **+ Range + SSE** — **PURO, zero import de Android**, com JUnit. `alcanceDe` segue a RFC 7233 à risca: faixa malformada é **IGNORADA** (200 inteiro), nunca adivinhada; `Range` duplicado é malformado; fora do tamanho é 416 |
| `EspelhoPares.kt` | porta, tokens, prazo, castigo — **PURO**, com JUnit. **Sem código de entrada**: a porta é o ENDEREÇO na rede, e o controle real é o teto de 3 sessões + o `derrubar` do operador (com castigo de 2 min, sem o qual "Desconectar" não faria nada visível). O token **nunca viaja numa URL**: o SSE vai por `fetch` + `Authorization: Bearer` (não `EventSource`, que não manda cabeçalho) |
| `EspelhoServidor.kt` | sockets, rotas, fan-out. Serve **só** `PREFIXOS_BUNDLE` (display/shared/espelho — **nunca** `web/controle/`); `GET /e` (SSE: fila de 256 por tela, ping de 15 s com o epoch do celular, `adeus` no desligar); `/m/<token>` (completo = 206/416, **em crescimento = chunked**, servindo enquanto o empurrão anda); `POST /r` (o `st` injeta o status via `MessageBus.post(null,…)`, que **não** passa pelo `busPost` — **sem eco por construção** — e só os tipos de `TIPOS_QUE_SOBEM`). Bind explícito a um IPv4 **SERVÍVEL** (RFC1918, de uma interface que a regra aceita e que nenhum `Network` reivindica — ver `EspelhoInterfaces.kt`), **nunca** `0.0.0.0`; allowlist de `Host` exata |
| `EspelhoInterfaces.kt` | **EM QUE INTERFACE** o socket pode abrir — **PURO**, com JUnit. Ele existe porque o **ponto de acesso do próprio celular não é um `Network`**: o downstream do tethering é montado no netd sem `NetworkAgent`, e sempre viveu no eixo que devolve NOME DE INTERFACE. **O discriminador não é o nome**, e é isso que faz a regra durar: *no ar, com IPv4 privado, e que NENHUM `Network` reivindica* — a do soft AP é a única com essa forma, porque não é uma rede que o aparelho USA, é uma que ele SERVE. O nome entra só na CLASSIFICAÇÃO, depois de três filtros. Ele **classifica; não faz política**: admitir só `PONTO_DE_ACESSO` é uma linha visível do `redeParaServir` |
| `EspelhoMidiaCache.kt` | o cache da rota `/m/` — **PURO**, com JUnit. Token é **capacidade** (forma validada aqui; entropia de quem cunha — o Controle, `crypto.randomUUID`); mesmo id + mesmo token = mesmo item (a regra do `SafRegistry`); id com token novo **substitui**; LRU por **bytes** e só de **completos** (um item em crescimento tem um empurrão vivo do outro lado) |
| `EspelhoMidiaCanal.kt` | o empurrão OPFS → cache, por `WebMessageListener` com `ArrayBuffer` (allowedOriginRules exato, `isMainFrame`, host conferido). Ack por bloco; a oferta na fila é **não-bloqueante** — fila cheia = erro retentável, nunca travar a main thread |
| `EspelhoEnergia.kt` | wake lock, Wi-Fi lock e térmica — **não é um Service**: quem carrega a transmissão em primeiro plano é o `SessionService`. Exige `CHANGE_WIFI_MULTICAST_STATE` no manifest, senão `startForeground` **lança** |
| `EspelhoDiag.kt` | o anel. **Devolve JSON, não texto** — quem monta a frase é o `controle.js` |
| `espelho/tela.js` | a casca do papel `tela`, carregada **no próprio `display/index.html`** entre `native.js` e `db.js`, e no-op de uma guarda fora do papel. Define `__AVBus` (recepção = SSE; envio = o DRENO), neutraliza o `postMessage` do `BroadcastChannel`, corrige o relógio (mediana do epoch dos pings — cronômetro e sorteio chegam como DESCRITOR com instante do celular), embrulha `AVDB.getMedia` para resolver `__rec.url`, e mantém a vigília para a tela não dormir |
| `display.js` (papel `tela`) | `forceMuted` nasce ligado (autoplay sem gesto não existe num navegador de verdade); `window.__telaSom(true)` é o que o botão de entrada chama ao gastar o único gesto; wallpaper por `__wp` (ou o sentinela `'padrao'`), fundo da letra por `imageUrl` na estrofe |
| `controle.js` | **enriquece** cada `load` com `__rec` (registro saneado: id/kind/nome/tipo/url=`/m/<token>`/letra — **nunca** blob, opfsPath ou youtubeId) e dispara o empurrão; reescreve o manifesto de stream para `/s/<token>`; **elege** uma tela como referência de tempo; manda a APRESENTAÇÃO por páginas (uma `/m/` por página, `telaDeckUrls`); converte o embed do YouTube em `tela-aviso` (o que a tela não sabe tocar, ela DIZ) |

### As decisões que precisam estar ditas

- **UMA página, não duas.** O gesto do visitante (fullscreen + som) **não
  sobrevive a uma navegação**, então não existe "página de entrada que
  redireciona": `tela.js` desenha a entrada como OVERLAY sobre o próprio
  display, e o toque gasta o único gesto em tudo de uma vez (`__telaSom(true)` →
  `requestFullscreen` → `POST /par` → token → SSE). Um botão só, "Ativar esta
  tela", sem código a digitar.
- **"O que ainda falta nesta tela?" NÃO pode ser perguntado DENTRO do gesto.**
  `requestFullscreen()` é assíncrono e o clique borbulha até o `document` antes
  de a tela cheia existir (medido: o ouvinte roda com `fullscreenElement=false`
  e o `fullscreenchange` chega 9 ms depois). Perguntar ali responde sempre
  contra o passado, e o que nascia disso era um SEGUNDO botão oferecendo o que o
  toque acabara de fazer. Quem responde é a Promise do próprio pedido; entre o
  gesto e o desfecho o `oferecerGesto()` é mudo (`assentando`).
- **Depois de ativada, NADA cobre a tela.** O overlay cheio existe só na primeira
  carga, quando não há nada por baixo. Queda de fio, token vencido e até o
  `adeus` reentram **em silêncio** (um `POST /par` numa escada de 1 s a 30 s) —
  a mídia é local e a letra anda pelo `timeupdate` do próprio `<video>`, então a
  queda leva o fio e mais nada. O gesto perdido volta por **dois atalhos e
  nenhum botão**: TOQUE DUPLO e **F11**.
- **MAS A RECARGA VOLTA PARA A ENTRADA OFICIAL.** A distinção é entre perder o
  FIO e perder a PÁGINA: numa queda de fio a mídia continua tocando e cobrir a
  tela apagaria uma cena que o problema não atingiu; uma recarga já derrubou
  tudo — inclusive o GESTO. **O token é carregado adiante** ainda assim (o fio só
  abre no toque): `telasSse` é indexado pelo TOKEN, e pedir pareamento novo a
  cada F5 deixaria a sessão anterior ocupando vaga até o vigia notá-la — a
  terceira recarga seguida receberia "lotado".
- **O tap é no `busPost`, e isso fecha o eco.** `NativeBridge.busPost` vê 100%
  dos comandos (o relay nativo roda sempre), e é ali que o `tapLan` os copia para
  o fan-out. A injeção de volta entra por `MessageBus.post(null,…)`, que não
  passa pelo `busPost`: **um comando vindo de uma tela não volta para as telas.**
- **`__rec` viaja NO comando, não numa consulta.** A tela não tem IndexedDB com o
  acervo, e um "GET /registro/<id>" a cada load seria uma ida-e-volta a mais no
  caminho crítico do culto. O Controle já tem o registro na mão quando emite o
  `load`. Tokens de mídia são cunhados pelo Controle (sincronamente); o shell só
  valida a FORMA (`^[A-Za-z0-9_-]{16,64}$`).
- **`display-ready` com `__tela` sobe; `tela-status` sobe; o resto morre** —
  `media-ended`, `mic-status` e `diag-dump` de uma tela morrem no dreno. **E a
  lista existe nos DOIS lados**: validação que mora só no cliente não é
  validação (ver `TIPOS_QUE_SOBEM`, acima).
- **A TRANSMISSÃO DIRETA CHEGA ÀS TELAS.** A rota `/s/<token>` repassa a faixa do
  googlevideo (o `Range` do cliente sobe cru, a resposta é espelhada de volta)
  com o UA que combina com a URL, e o `telaEnriquecer` reescreve
  `/stream/<token>` → `/s/<token>`. O token é o MESMO dos dois lados (o registro
  do `StreamProxy` é um só): não há segunda extração. **O que ainda não vai para
  a rede é o EMBED** — iframe de terceiro, que a CSP das telas barra por
  construção.
- **A APRESENTAÇÃO CHEGA ÀS TELAS, uma `/m/` POR PÁGINA.** Ela é o único kind
  cujo conteúdo é uma LISTA, e por isso não cabia no `url` do registro saneado:
  `telaDeckUrls` cunha um token por página (id estável `dk:<item>:<i>`, irmão do
  `ly:`) e `telaEmpurrarPaginasDeck` os enfileira EM ORDEM — a página 1 chega
  primeiro, que é a que a tela busca assim que o `load` pousa. No `stage.js`,
  `pages` passou a aceitar **string ou Blob** (`urlDaPagina`): é o mesmo par
  `rec.url` × `rec.blob` da mídia principal, aplicado à lista. Sem token forte
  (`crypto.randomUUID` ausente) a lista inteira é recusada e a cena volta ao
  aviso — meia lista projetaria uma página em branco no meio do sermão. Oráculo:
  a metade CONSUMIDORA no `tela-rede.test.mjs`; a produtora (`telaEnriquecer`)
  segue **sem oráculo**, e isso está dito porque as duas quebram diferente.
- **A preview não atrasa para telas de comando** (`dePixels` em
  `recalcularAtrasoPreview`): o atraso media o buffer de MSE do espelho de
  pixels; uma tela por comandos aplica no ato, e o alvo é 0.
- **`snoopStatusDeFora` é UM só, no companion.** `display-status`,
  `espelho-status` e `tela-status` passam pelo MESMO relógio de precedência
  (`ultimoStatusDoTelaoMs`) — a versão por-instância tinha bug latente de
  precedência entre WebViews, e é ele que alimenta a notificação de mídia com o
  app minimizado. **E pela mesma ELEIÇÃO** (`telaRefId`): calado o telão, as até
  três telas alternariam entre si, e `updateFromDisplay` supõe UMA fonte — a
  barra da tela de bloqueio andando para a frente e para trás é o mesmo defeito
  da precedência, um nível abaixo.
- **Detecção por PRESENÇA, não por versão**, onde há objeto injetável:
  `telaAtiva()` pergunta `espelhoLigado() && window.__avTelaMidia`.
- **E O `mirrorEstado` É SEMEADO NA ABERTURA** (`lerEspelho()` no `init()`). O
  servidor vive no SHELL e sobrevive ao documento: o OTA aplicado e a morte do
  renderer recarregam o Controle com as telas ainda pareadas. Sem a semente o
  cache nasce `null` e ninguém o relê — `acertarEnqueteDeFundo` só liga o
  relógio de 4 s quando o estado JÁ é conhecido, e a enquete da folha depende do
  bloco de conexão à vista. Aí `telaAtiva()` MENTE: todo `load` sai sem `__rec`,
  a tela não acha o id no IndexedDB dela e a projeção volta ao wallpaper — o
  culto inteiro, sem erro em lugar nenhum. Pelo mesmo cache nulo
  `somLocalDeveEstar()` desmuta a preview por cima das telas.

### As inversões que precisam estar ditas

1. **O áudio é INTEIRO e local.** A tela toca o arquivo (`/m/`) no **`<video>`**
   dela (não há `<audio>` em lugar nenhum do display: é o *kind*, não o elemento,
   que faz o telão manter o wallpaper) — acabaram o AAC parcial, a deriva de eixo
   e o `AudioWorklet`. O som é **opt-in por tela** (o `forceMuted` só sai com o
   gesto do visitante).

   **O microfone ao vivo continua fora da rede — por uma GUARDA, e não pelo
   dreno.** O dreno é o filtro de SUBIDA; `mic` é um comando de DESCIDA e desce
   verbatim para toda tela (o `difundirJson` não lê tipo, o `entregar()` do
   `tela.js` também não). Quem o barra é `if (TELA) return` no topo do `setMic`
   (`display.js`), e ele existe porque a alternativa era uma proteção
   **EMPRESTADA DO NAVEGADOR**: uma tela roda em `http://`, e `getUserMedia` é
   `[SecureContext]`, logo `navigator.mediaDevices` nem existe ali. Essa proteção
   se desfaz sozinha no dia em que a transmissão subir em `https://` — e nesse
   dia, sem a guarda, o primeiro push-to-talk pediria o microfone **de cada
   aparelho da rede**, devolvendo-o às caixas daquele mesmo aparelho. Nenhum
   áudio atravessa a rede aqui: o estrago não é a tela falando com a voz do
   púlpito, é realimentação local num aparelho que ninguém está olhando.
   Oráculo: `tela-rede.test.mjs`.

   **E o microfone é DO TELÃO no sentido forte: sem TV ele NÃO É OFERECIDO.**
   Quem o abre é o `/display/`, que só roda dentro da `Presentation` — sem TV o
   `syncPresentation` não cria nenhuma. Desde a v1.2.20 o botão nem é desenhado
   (`haOndeReproduzirMic`, em `renderFoot`); a guarda no toque fica pela CORRIDA
   (a TV pode cair entre o desenho e o dedo), e ela continua vindo **antes de
   pedir a permissão do Android**, porque gastar a única permissão sensível do
   app numa ação que não pode funcionar é como se queima uma permissão.
2. **O que vaza numa rede aberta mudou de natureza:** antes, a imagem contínua de
   tudo que a igreja projeta; agora, os comandos (títulos, referências, letras) e
   as mídias carregadas durante a transmissão, por tokens opacos por sessão. A
   porta nasce aberta (conteúdo público por definição); o teto de 3 sessões e o
   derrubar são o controle real.
3. **A tela executa CÓDIGO nosso, não só decodifica pixels.** O bundle é o mesmo
   do app, então um bundle quebrado quebra as telas junto — **e o watchdog de
   boot do OTA não as cobre**. O que as cobre é o `tela-rede.test.mjs` e o fato
   de o telão de verdade rodar o MESMO `display.js`: quebrar um é quebrar o
   outro, que é o defeito que aparece.

> **Regra de calendário:** a primeira ligada em rede de verdade é **num dia SEM
> culto** — segunda, terça, quinta ou sexta. A agenda é **sábado de manhã** (o
> culto principal), mais **domingo e quarta à noite** (menores, opcionais).
>
> O que a regra protege não é o dia: é ter **folga na frente para desfazer**. Um
> recurso de rede que só falha na igreja falha na frente da congregação, e o
> conserto de uma regra em Kotlin é uma Release.

---

## Séries do YouTube (o álbum "Provai e Vede 2026")

Um canal que publica **um episódio por semana** e organiza o ano em **playlists
por período** vira um **álbum da Biblioteca**. O catálogo em
`assets/web/controle/serie.js` guarda `{ canal, prefixo, ano, periodo, titulo,
futuros }` — uma linha a mais dá uma série nova sem código novo. São **duas**:

| Série | Canal | Playlists | Título do vídeo |
|---|---|---|---|
| **Provai e Vede 2026** | @provaievedeoficial | por MÊS — "Provai e Vede - Agosto 2026" | nome do episódio à ESQUERDA da barra |
| **Informativo Mundial das Missões 2026** | @daniellocutor | por TRIMESTRE — "Informativo \| 3º Trimestre 2026" | **não há** nome de episódio: "… \| 15 AGOSTO 2026" |

```
 aba Playlists do canal   ytCanalPlaylists   serie.js      Biblioteca
   · Set 2026 (Libras) ──────────────────►  a REGRA  ──►  card da série
   · Set 2026             ytPlaylist(url)   (PURA)        "15/Ago · …"
   · Ago 2026 ← sem hífen ─────────────────►               syncCollection
```

**A divisão de trabalho é a invariante 5.** O shell entrega listas CRUAS — os
dois métodos não olham para o conteúdo, e o título sai **sem** o `tituloLimpo`
da busca, porque é dele que a regra tira a data e a marca de Libras. A
nomenclatura de um canal muda sem avisar: no web um ajuste chega por OTA em
minutos com oráculo em Node; em Kotlin custaria um degrau de `SHELL_VERSION` e
uma Release por vírgula.

**A regra de ouro: a PLAYLIST prova o pertencimento, o título é só RÓTULO.** Um
vídeo entra por estar numa playlist aceita, jamais por casar um padrão de
título; não casando a data, ele **entra do mesmo jeito**, na ordem em que veio.
Errar para um nome feio é recuperável; errar para um episódio ausente é o
operador descobrindo no sábado que o vídeo do culto não está lá.

**O MÊS DE UM ITEM VEM SEMPRE DA DATA DO TÍTULO, nunca da playlist.** Com
playlists mensais os dois quase sempre concordam; com um trimestre é a diferença
entre 13 episódios ordenados e 13 amontoados em julho. `mesDaPlaylist` devolve
**o mês em que o período começa**, e isso tem dois usos honestos: ordenar as
playlists entre si e ser o PISO de um vídeo sem data.

### As sete armadilhas da nomenclatura

Nenhuma é hipótese — todas foram lidas nas abas Playlists e Vídeos dos canais.

1. **O hífen não é garantido.** Uma playlist é "Provai e Vede Agosto 2026", sem o
   hífen que todas as outras têm. A regra não casa separador: pede o prefixo no
   começo e procura mês e ano **em qualquer posição**.
2. **Espaço duplo.** Tudo passa por `normalizar`.
3. **O marcador de LIBRAS muda de forma entre os níveis:** `(Libras)` na
   playlist, `- Libras` no vídeo. O teste é pela **palavra**, sem acento e sem
   caixa — testar uma das formas literais deixaria a outra passar.
4. **A duração não separa nada:** 4:54 × 4:55 num par, 5:07 × 5:07 noutro.
5. **`uploaderName` não é o canal:** os vídeos vêm como "Provai e Vede | Oficial
   **e Adventist…**" (colaboração). Filtrar por ele derrubaria tudo.
6. **A DATA tem DUAS formas, e o mesmo episódio usa as duas:** compacta entre
   parênteses ("… 2026 (03/Jan)") e por extenso ("… **sábado 3 janeiro**").
   `dataDoVideo` tenta as duas nessa ordem; a extensa aceita o "de" opcional e o
   ordinal ("1º"), e exige que o nome **seja** um mês em vez de só começar como
   um — sem essa guarda, "3 marcos" viraria 3 de março. Supor UMA forma era a
   aposta errada desde o começo.
7. **UM CANAL PUBLICA A MESMA SÉRIE EM VÁRIOS IDIOMAS.** O prefixo separa as
   **playlists** e **não separa os vídeos** — em espanhol eles começam com a
   mesma palavra ("Informativo Mundial **de las Misiones**"). Daí `ehOutroIdioma`,
   irmão do `ehLibras`, nos dois níveis: pela **ESCRITA** (cirílico, hebraico,
   árabe, tailandês, CJK, hangul — um caractere basta, porque "【聖工消息】" não
   tem sílaba que dê para procurar; emoji ficam de fora de propósito) e por
   **MARCA** (espanhol `misiones`/`mision`/`de las`, francês `missionnaire`, e o
   inglês pelo NOME DO PROGRAMA: "Mission Stories", "World Mission", "Mission
   Spotlight"), tudo contra o `normalizar`.
   **Uma marca de idioma tem de ser IMPOSSÍVEL na língua que se quer manter, não
   apenas típica da que se quer recusar** — o inglês era a palavra solta
   `mission` e isso custou um episódio ("Mission Refocus").

A sétima é a **exceção declarada à regra de ouro**: ela recusa pelo TÍTULO. Está
lá porque o erro que evita não é recuperável no sábado de manhã — é o testemunho
projetado em espanhol na frente de todo mundo. O preço está escrito no código: um
episódio em português que CITE "mission"/"misiones" é recusado, e volta à mão
pela busca.

**O ÁUDIO em português é outra pergunta, e é do SHELL.** O YouTube dubla sozinho,
e a dublagem não muda o título — é uma faixa a mais dentro do MESMO vídeo. Quem
escolhe é `TrilhaAudio.kt`: idioma antes do cliente, português EXCLUSIVO quando
existe. Nada no web tem como ver isso, e por isso nada em `serie.js` tenta; o
Registro imprime a trilha escolhida (`140@VISIONOS pt-BR`) para a metade de baixo
ser diagnosticável.

### As decisões que precisam estar ditas

- **A descoberta é a ABA DO CANAL, nunca busca por texto.** É AUTORIDADE: numa
  busca quem escolhe é o ranking do YouTube, e qualquer um pode nomear uma
  playlist "Provai e Vede 2026". Vindo do publicador, o pior caso é uma playlist
  a menos — nunca o vídeo de um desconhecido na projeção do culto.
- **A recusa de Libras existe DUAS vezes**, e a segunda nunca dispara hoje (as
  playlists PT e Libras são espelhos 1:1). Um único vídeo acrescentado por engano
  na playlist oficial iria direto ao telão.
- **O ano é EXPLÍCITO no catálogo** — "o ano corrente" trocaria o conteúdo do
  álbum sozinho na virada de dezembro, no meio da programação de janeiro.
- **A JANELA É A SEMANA CORRENTE**, com `DIAS_DE_ANTECEDENCIA` (3) como PISO: o
  episódio do sábado desta semana nunca é escondido, e o das seguintes só entra
  três dias antes. As duas metades vivem em `aindaNaoSaiu`, que **delega** a
  primeira em `ehDoSabadoAtual` — enquanto a contagem de dias foi a régua
  inteira, ela e a semana adventista do `sabadoDaSemana` discordavam em **três
  dos sete dias** (domingo, segunda e terça): a lista escondia o episódio que o
  destaque do topo declarava o desta semana, e o topo dizia "Aguardando
  lançamento" sobre um vídeo já liberado. O piso é **contagem**, não dia da
  semana — é ele que sobrevive ao canal que publicar num domingo. Enquanto o
  sábado não chega o vídeo pode não estar público, e falhando o download a
  resposta diz o que fazer ("ainda não liberado pelo canal — tente mais perto de
  22/Ago"), em **dois lugares**, porque são dois fluxos: o cartão sobre a preview
  ("Tocar agora" fecha a Biblioteca) e o card da série (pelo Cronograma ela
  continua aberta). Sem a frase, é indistinguível de queda de rede.
- **E O APP PROCURA o episódio desta semana, em vez de esperar o TTL**
  (`serieTemODaSemana`, no `indiceVencido`). O TTL de 12 h responde *"a lista
  envelheceu?"*; a pergunta do operador ao abrir o app é outra — *"já saiu o
  vídeo deste sábado?"* —, e um índice de onze horas atrás é FRESCO para o
  primeiro e pode ser de antes da publicação. Enquanto o episódio faltar, o
  índice está vencido; **achado, a procura se desarma sozinha** e a série volta
  a custar zero requisição. Quem responde é `AVSerie.ehDoSabadoAtual`, a MESMA
  função do bloco de destaque — duas contas de calendário divergiriam, e foi
  uma divergência dessas que produziu o defeito da v1.2.19. Três guardas, e as
  três são o que a mantém invisível: **piso de 30 min** entre procuras (o
  `visibilitychange` chama o mesmo caminho dezenas de vezes por culto), **a
  primeira passada da SESSÃO ignora o piso** (é o pedido ao pé da letra — uma
  carga de página é rara e é o instante em que se pergunta), e **só o ANO
  CORRENTE** (em 2027 nenhum episódio do álbum de 2026 é "o desta semana", e sem
  a guarda um álbum antigo seria procurado para sempre). Nada aqui baixa vídeo:
  roda `fetchSerieIndex`, que só refaz a LISTA. O preço declarado é o episódio
  publicado SEM data no título — ele nunca satisfaz a pergunta, e a série é
  procurada a cada meia hora até a data entrar no título.
- **O QUE AINDA NÃO SAIU NÃO ENTRA NA LISTA** (campo `futuros`). O @daniellocutor
  sobe o trimestre inteiro e libera um por sábado; os que faltam aparecem na
  playlist e **não tocam**. A régua é a DATA (único sinal deste lado — o item de
  um vídeo restrito chega idêntico ao de um liberado), o corte é INCLUSIVO no dia
  do culto, e vídeo SEM data nunca é escondido. **É campo e não regra global**: o
  Provai e Vede libera o mês inteiro de uma vez (medido: em 15/ago já tinha até
  26/set, e aqueles tocam). O DIA entra também na ASSINATURA das playlists,
  senão a economia devolveria a lista de ontem no sábado de manhã.
- **O NOME DO ITEM pode não sair do título do vídeo.** No Informativo o título é
  a série mais a data, e "o nome é o que vem antes da barra" daria 52 linhas
  idênticas. São DOIS modos, no campo `titulo` do catálogo:
  `TITULO_ESQUERDA` (o padrão — o nome à esquerda da barra) e `TITULO_SERIE` (o
  rótulo da série mais a data). **O Informativo é `TITULO_SERIE` desde a
  v5.271**, porque o item SAI do álbum (vai para o Cronograma, para a fila) e
  uma data sozinha não o identifica lá fora. **`nomeDoItem` nunca devolve vazio** — sem data e sem
  título ele cai no título CRU, que é feio e longo, e é infinitamente melhor que
  uma linha em branco na lista do culto.
- **A assinatura das playlists evita doze extrações por retomada** (a aba do canal
  já diz quantos vídeos cada uma tem). Um episódio novo muda a contagem e a
  assinatura inteira é refeita — "tudo ou nada" de propósito.
- **E A REGRA ENTRA NESSA ASSINATURA** (`AVSerie.impressao`): o índice guarda os
  nomes JÁ FORMADOS e a ordem JÁ decidida, e a assinatura do canal não sabe nada
  sobre a regra que os produziu — sem a impressão, mudar a regra deixa o índice
  de pé para sempre, e nem limpar o cache resolve (ele mora no IndexedDB). É um
  hash do PRÓPRIO CÓDIGO das funções que decidem, e não um número à mão: quem
  esquecesse de subir o número reproduziria o defeito.
- **O índice falha com EXCEÇÃO, nunca com lista vazia.** `syncCollection` trata
  exceção como "sem internet" e PRESERVA o índice; zero itens apagaria da tela a
  série inteira que o operador já tem baixada, por uma oscilação de rede.
- **`lyrics: null` no registro não é enfeite:** `songVariantsNeeded` pergunta
  `fullRec.lyrics === undefined`, e sem o campo os 52 episódios seriam rebaixados
  a cada sincronização, para sempre e em silêncio.
- **`aportuguesar` em TODO extrator.** No padrão en-GB o YouTube devolve o título
  TRADUZIDO: `(15/Ago)` viraria `(15/Aug)` e a marca de Libras mudaria de
  palavra — as duas coisas de que a regra depende. A paginação sai do MESMO
  extrator (`ex.getPage`), nunca de `getMoreItems(service, …)`, que monta um
  extrator novo por dentro e nasceria sem o `forceLocalization`.
- **UM EPISÓDIO É UM VÍDEO DO YOUTUBE**, não uma faixa de hinário: `openSongMenu`
  desvia para `openYtMenu`, e com isso ganha de graça a transmissão direta no
  "Tocar agora" e o download só nos destinos que GUARDAM. `semSoAudio` tira o
  seletor Vídeo × Só áudio (um testemunho em vídeo não tem versão de áudio que
  faça sentido projetar).
- **E A LINHA TAMBÉM É A DO VÍDEO.** Quem decide é o TIPO da coleção
  (`tipoDaColecao`, com `temLetra` e `ehLink`), não um `if` por recurso: a gaveta
  que numa música abre a letra abre aqui a MINIATURA, a duração e o estado no
  aparelho — este último é o que decide, porque "Tocar agora" TRANSMITE e um
  episódio já guardado entra do disco. *Desviar as portas de um recurso não
  desvia o que estava atrás delas.*
- **A LETRA nunca é pedida para um vídeo** (`temLetra(coll)`, nos dois
  consumidores). `syncLyrics` varria toda coleção e pedia `music_<id>` ao
  LouvorJA com um id do YouTube; como falha de rede não grava `LYRIC_NONE` de
  propósito, eram ~52 requisições perdidas **por abertura, para sempre**,
  infladas no total da notificação.
- **O CARD DA SÉRIE TEM UM BOTÃO SÓ** (v1.1.21), e é o de **atualizar a lista**
  (`syncCollection(coll, { soIndice: true })`) — puro, sem texto, na direita da
  barra. Os outros dois saíram porque **o álbum de série não retém arquivo**: um
  episódio só existe no aparelho enquanto está no Cronograma, nos Favoritos ou na
  playlist, e o coletor o recolhe quando sai de lá. Logo não há o que baixar em
  lote (~15 GB) nem o que remover — "Remover do dispositivo" ali apagaria o que
  está em OUTRA lista, ou nada. A série também sai de "Baixar toda a biblioteca",
  peso incluído, e a barra dela **não anuncia peso**: diz quantos episódios a
  lista tem, porque o peso ali era o custo de um download que não existe.
- **O EPISÓDIO DESTE SÁBADO fica DESTACADO no topo da lista** (v1.1.21,
  `blocoDestaque`), e SAI dela — duas linhas que fazem a mesma coisa, a dois
  centímetros uma da outra, é a de baixo que o operador toca por engano. Quem
  responde "qual é o desta semana?" é `AVSerie.ehDoSabadoAtual` (puro, com
  oráculo): a janela é a **semana adventista**, de domingo a sábado, e não o dia
  exato — a régua deste módulo é a data do TÍTULO, e exigir o dia faria um
  episódio datado de sexta sumir do destaque. Sem ele, o bloco diz **"Aguardando
  lançamento"** com a data do sábado ao lado: sem o bloco, um card sem o vídeo da
  semana fica indistinguível de um que não carregou.
- **O card não é desenhado abaixo do shell 41** — um card que não carrega nada é
  pior que card nenhum.

### O REGISTRO da varredura — o laço de manutenção, fechado

A regra decide a partir de NOMES que um canal muda sem avisar, e os dois modos de
errar são silenciosos por construção: playlist recusada some da Biblioteca sem
erro no console, vídeo aceito sem data entra fora de ordem. O bloco **"Séries do
YouTube (o que a regra achou)"** entra no Registro de Configurações e diz, por
série: o catálogo, a leitura da aba do canal (playlists aceitas e recusadas, com
o MOTIVO), a varredura dos vídeos (vistos, entraram, recusados) e os nomes na
ordem em que a lista mostra.

```
· Informativo Mundial das Missões 2026 — https://www.youtube.com/@daniellocutor
  prefixo "Informativo" · 2026 · playlists por trimestre · rótulo pela data e pelo nome da série
  aba do canal (há 2 min): 5 playlist(s), 2 aceita(s)
    - "Misiones | 3º Trimestre 2026" → não começa com "Informativo"
    + "Informativo | 3º Trimestre 2026" → mês 7 · 13 vídeo(s) no canal
  vídeos (varredura há 2 min): 14 vistos, 13 entraram, 1 recusado(s)
    - "Informativo Mundial de las Misiones | 15 AGOSTO 2026" → está em outro idioma
    ! 1 entrou(entraram) SEM data no título: "… | especial de encerramento"
```

- **O motivo sai de quem DECIDE.** `AVSerie.avaliarPlaylist`/`avaliarVideo`
  devolvem `{ mes, motivo }` e `{ motivo, data }`; `mesDaPlaylist` e
  `itensDaPlaylist` são consumidores delas.
- **A ORDEM das perguntas é o que o texto mostra**, e por isso virou contrato:
  uma playlist em espanhol sai como "não começa com Informativo" — o prefixo já
  a elimina —, e o motivo por IDIOMA fica para os VÍDEOS.
- **Guarda o nome CRU.** Um rótulo já formado prova que a regra rodou; só a
  entrada dela diz por que ela produziu aquilo.
- **DUAS metades com datas próprias**: a aba do canal é lida em toda passada, as
  playlists não (a assinatura pula as ~12 extrações). Um carimbo só anunciaria
  como "de agora" uma lista de três dias atrás.
- **O que ENTROU sem data é um ACHADO, não uma recusa** — é a única coisa deste
  caminho que erra em silêncio **e** continua funcionando.
- **O BLOCO É RESUMO, NÃO LISTAGEM** (v1.1.19). Ele nasceu nominal — cada recusa
  com o nome verbatim, e os nomes formados um por linha — e MEDIDO num aparelho
  isso deu **~140 de ~170 linhas** de uma cópia, com "não começa com Informativo"
  repetido sessenta vezes, **enterrando a linha do tempo**, que é o único bloco
  que responde *"o que aconteceu no culto?"*. Hoje: as ACEITAS saem nominais (são
  poucas e são o que prova que a regra achou), as RECUSADAS saem **contadas por
  motivo** com os primeiros nomes CRUS de cada grupo (`SERIE_NOMES_POR_MOTIVO`) —
  é lendo um nome que se descobre uma renomeação em massa, e é para isso que o
  bloco existe —, e os nomes formados viram as **BORDAS** (`N na lista, de "…" a
  "…"`), porque ordem se confere nas pontas e o defeito do MEIO tem sinal
  próprio: o `! entrou SEM data`, que segue nominal. Nenhum corte é silencioso —
  o que sai continua contado. Oráculo: `boot-nativo.test.mjs`.
- **O diário VENCE o índice.** Índice sem o carimbo `serieDiarioEm` conta como
  vencido (`indiceVencido`) — senão um aparelho que já tinha a lista passaria as
  12 h do TTL dizendo "ainda não varrido" justamente enquanto o operador olha. O
  carimbo é escrito nos **dois** caminhos do `fetchSerieIndex`, senão o canal
  seria extraído a cada abertura.
- **A metade do canal é gravada ANTES do primeiro `throw`**: "nenhuma playlist no
  canal" é o caso em que a pergunta "por quê?" mais importa.

### O tamanho, dito em vez de escondido

~52 episódios/ano de ~300 MB em 1080p: o ano passa de **15 GB**. Por isso **não
existe "baixar o álbum"** — o uso normal é tocar o episódio do sábado, que
TRANSMITE sem baixar nada; guardar offline é mandá-lo ao Cronograma ou aos
Favoritos pela folha, um a um.

---

## A aba de cifra (acordes ao lado da letra)

A folha de letra do Controle ganhou uma **terceira fonte**, ao lado de *Letra* e
*Bíblia*: a **cifra** do hino em cena — acordes sobre a letra, com transposição
por meio tom. Ela é para quem **toca**, e por isso **nunca vai ao telão**: o que
a congregação vê continua sendo a letra, pelo caminho de sempre.

```
 folha de letra              AVNative.cifraHtml         www.cifraclub.com.br
  [Letra][Bíblia][Cifra] ──► CifraFonte (host travado) ──► GET da página
                              devolve o HTML CRU              │
        ◄── controle/cifra.js: slug · folha · transposição ◄──┘
             (PURO, com oráculo Node — nada em Kotlin lê HTML)
```

### As decisões que precisam estar ditas

- **SOB DEMANDA é o contrato, não uma otimização.** Nada é baixado em lote,
  **nada entra no bundle do OTA e nada é gravado em disco**. O cache é um `Map`
  em memória, morto ao fechar o app. Trocá-lo por IndexedDB mudaria o recurso de
  natureza: o app deixaria de LER conteúdo de terceiro no aparelho do operador e
  passaria a DISTRIBUIR uma cópia dele. As duas coisas não são degraus da mesma
  escada.
- **O GATILHO é a música ENTRAR EM CENA, não a aba abrir** (v1.1.17). Uma
  requisição por música projetada, disparada no `send` — o ponto por onde todos
  os caminhos passam. Isso tira a rede do caminho crítico: quem abre a aba está
  com o instrumento na mão e a música tocando, e é o pior momento para esperar
  um GET a um site de terceiro. Não muda o contrato acima — continua sendo uma
  música por vez, sem lote e sem disco —, muda QUANDO ele acontece.

  **Quem decide se cabe é `cifraCabe`, e ela é UMA para os dois consumidores**
  (a aba, que decide se se oferece; o `send`, que decide se busca). O corte é
  por conteúdo musical (`kind: 'audio'` ou item com letra), não por nome: um
  episódio de série é um testemunho em vídeo, e ali a busca é uma requisição
  garantidamente perdida — e uma aba oferecida que só sabe dizer que não achou.
- **A busca sai do Kotlin porque não há alternativa, e só o TRANSPORTE sai.** Os
  WebViews rodam em `appassets.androidplatform.net` e um site de terceiro não
  manda `Access-Control-Allow-Origin` — o `fetch()` da página morre antes de
  sair, e o `<iframe>` cai no `X-Frame-Options` (o mesmo muro que já recusou
  embutir a busca do YouTube). O `CifraFonte.kt` faz **um `GET` e mais nada**;
  quem lê o HTML é `controle/cifra.js`. É a divisão das SÉRIES aplicada de novo,
  e pelo motivo mais forte que existe aqui: a marcação de um site muda quando o
  dono dele quiser, e nesse dia o conserto tem de chegar **por OTA em minutos** —
  em Kotlin custaria um degrau de `SHELL_VERSION` e uma Release por vírgula.
- **DUAS tentativas, nessa ordem.** Para uma coleção do catálogo
  (`AVCifra.CATALOGO`: os dois hinários) a URL é DEDUZÍVEL do nome do hino — uma
  requisição, sem ranking de ninguém escolhendo por nós. Só falhando ela entra a
  **busca genérica**, que é o "qualquer música" e também cobre o hino cujo nome
  no acervo não bate com o do site.
- **AS CIFRAS FICAM GUARDADAS NO APARELHO, PARA TODA A BIBLIOTECA BAIXADA**
  (v1.1.28 nos hinários, v1.2.14 no acervo inteiro). A folha abre **sem rede** —
  que é o problema real: o Wi-Fi da igreja no sábado de manhã.
  - **O que separa um hinário de um álbum é o CUSTO, não o direito**
    (`cifraDeduzivel` × `cifraGuardavel`). No hinário o endereço sai do catálogo
    e a música custa UMA requisição; num álbum custa a cadeia deduzível inteira
    (álbum-como-artista + artistas padrão). Confundir as duas perguntas foi o
    que manteve o arquivo preso aos dois hinários por seis versões.
  - **O CATÁLOGO É AUTORIDADE SOBRE O HINÁRIO** (v1.2.15). Um `sem-cifra` no
    endereço do catálogo ENCERRA a procura: aquela É a página daquele hino no
    site. MEDIDO: `Teu Divinal Amor` gastava mais três requisições (o
    álbum-como-artista e os dois artistas padrão), todas 404, para chegar ao
    mesmo veredito — vezes as ~300 do Hinário 2022 ainda por varrer. **Só na
    coleção do catálogo**: num álbum o `sem-cifra` de um endereço não fecha a
    pergunta, porque a música pode estar cifrada sob outro artista.
  - **E o nome de um hinário NUNCA é adivinhado como artista.** MEDIDO:
    `/hinario-adventista-2022/` não existe no site — 404 certo, uma vez por hino
    num acervo de 601. Onde o endereço já é deduzível de uma tabela, adivinhá-lo
    de novo pelo nome do álbum só pode errar.
  - **O Registro NOMEIA os hinos que faltaram**, e só nos hinários
    (`CIFRA_FALTANDO_MAX`): ali toda música existe no site, então cada nome é a
    NOSSA regra de slug errando — conserto de uma linha no `cifra.js`. Num álbum
    a ausência é o caso normal (MEDIDO: 35% de acerto contra 95% no hinário), e
    listar centenas de nomes enterraria o Registro sem dizer nada novo.
  - **A VARREDURA PULA A BUSCA DO SITE** (`semBusca`). MEDIDO no acervo: toda
    linha `busca …` devolveu `0 resultado(s)` — os resultados são desenhados por
    JavaScript. Ela custa duas requisições por música e, em massa, dobraria a
    varredura para não achar nada. Na aba ela FICA: lá é a última carta da
    música que está na frente do operador, e custa duas requisições UMA vez.
  - **A AUSÊNCIA TEM PRAZO, e é ela que torna o acervo varrível**
    (`CIFRA_REVISITA_MS`, 30 dias). No hinário toda música existe no site, e
    "não achei" era sempre defeito nosso: nada era gravado. **No acervo de
    álbuns a conta se inverte** — MEDIDO, cerca de dois terços não estão sob
    nenhum endereço deduzível, e sem memória isso são milhares de requisições a
    um site de terceiro EM TODA ABERTURA. A resposta não é gravar para sempre
    (um Wi-Fi ruim não pode custar um buraco permanente) nem não gravar: é
    gravar **com data**. Uma FOLHA não vence; uma ausência volta para a fila em
    30 dias. `sem-rede`, `recusou` e `ilegivel` continuam não gravando nada — os
    dois primeiros não são resposta do site, e o terceiro é defeito do parser.
  - **E a ausência guardada RESPONDE**, em vez de refazer a cadeia: sem isso a
    aba gasta quatro requisições para chegar à mesma frase que a varredura já
    tinha escrito, com o instrumento na mão. Quem a contorna é o PRAZO — passados
    30 dias ela volta para a fila —, e desde a v1.3.3 não há mais nada além dele:
    a escolha à mão saiu.
  - **QUEM BAIXA É O APARELHO, e essa é a decisão inteira.** Nada disto entra no
    bundle do OTA nem no repositório: o `.zip` do canal é público e servido em
    nome de quem publica, e um acervo ali dentro é o app DISTRIBUINDO obra de
    terceiro — outra coisa, não um grau a mais de ler sob demanda. Cada aparelho
    busca o que vai usar, como já fazia uma música por vez; muda o QUANDO (no
    download do hinário) e o ONDE (IndexedDB, não a memória da sessão). De
    quebra: a cifra fica sempre atual, o repositório não incha, e não nasce uma
    segunda fonte de verdade para divergir.
  - **E O GATILHO É O DELE TAMBÉM** (v1.2.1). A primeira versão pendurou a busca
    no fim do `syncCollection`, e ela nunca alcançou quem MAIS precisa dela: um
    hinário já completo faz aquela função retornar em "Já completo offline"
    muito antes do gancho. MEDIDO em dois Registros seguidos, `0 de 601` depois
    de o operador sincronizar. Hoje `syncCifrasAcervo` roda na abertura, ao
    lado do `syncLyrics` — informação padrão do acervo, uma vez por sessão, em
    segundo plano —, e o download deixou de ser a única porta (tocar em
    sincronizar num hinário completo também dispara).
  - **A forma é a do `syncLyrics`**, de propósito: mesma fila, mesma proteção de
    segundo plano, mesma notificação, gravação em LOTES, nada em dados móveis. E
    a regra que mais importa é a mesma — **falha de rede não grava nada**: num
    acervo em que toda música existe no site, uma ausência gravada é um buraco
    permanente causado por um Wi-Fi que oscilou. Retomável por construção (o que
    está guardado não é pedido de novo).
  - **A GRAVAÇÃO MESCLA; ELA NUNCA SUBSTITUI** (`cifraDiscoMesclar`, v1.2.10).
    A primeira versão gravava o mapa INTEIRO com `setState`, a partir de um slot
    de módulo (`cifraDisco`) cuja identidade mora noutra variável
    (`cifraDiscoColl`) — o ler-calcular-gravar que este arquivo proíbe para o
    `state`, com o agravante de o que ia ao disco poder ser o mapa de OUTRA
    coleção, ou `{}`. **MEDIDO num aparelho: `275 de 601` virou `0 de 601`**, e a
    cada abertura o app recomeçava o download do zero. A correção é estrutural,
    não um remendo no interleaving: uma substituição pode produzir zero a partir
    de 275, **uma mescla não pode**. `updateState` numa transação só, com a `fn`
    SÍNCRONA, e a fila de pendentes esvaziada só depois do commit. Oráculo:
    `cifra-offline.test.mjs`, provado por reversão.
  - **A leitura é a tentativa que não toca na rede**, entre a escolha do operador
    (que vale mais, é uma correção à mão) e o catálogo. O oráculo
    (`tools/cifra-offline.test.mjs`) NÃO afirma "a folha apareceu" — afirma que
    **`cifraHtml` não foi chamado**, com a ponte respondendo "sem rede" a tudo:
    com rede, uma leitura de disco que não acontecesse produziria a mesma folha
    pela porta errada, e ninguém veria diferença até o dia em que a rede não
    estivesse lá.
- **A CIFRA É SÓ AUTOMÁTICA** (v1.3.3). Houve uma busca À MÃO aqui, da v1.1.24 à
  v1.3.2: a aba desenhava a lista de resultados do site (inclusive o que a regra
  RECUSOU), abria qualquer um em PRÉVIA, e o endereço escolhido era FIXADO para
  aquela música — a tentativa 0 das aberturas seguintes, guardada entre sessões
  em `cifraEscolhas`. Saiu inteira a pedido do operador: lista, prévia, campo de
  consulta, atalhos (`+ <álbum>`, `+ Ministério Jovem`), a escolha fixada, o
  "Esquecer a escolhida" e o botão "Trocar" do rodapé (este na v1.3.2).
  - **O QUE ISSO CUSTA**, para quem for reintroduzi-la saber o que reintroduz: a
    regra ADIVINHA a partir de um nome, e quando ela erra — uma versão
    simplificada, um homônimo — **não há mais correção dentro do app**. Resta o
    link "Ver no Cifra Club", no rodapé da folha. MEDIDO à época: na maioria das
    falhas o resultado certo ESTAVA na página de busca, só não era o que a regra
    elegeu. É essa a distância que se aceitou pagar.
  - **A cadeia automática é o recurso inteiro agora:** guardada no aparelho →
    catálogo → álbum-como-artista → artistas padrão → busca do site. A busca do
    site FICA — ela é o último degrau do AUTOMÁTICO, não a manual —, e continua
    escolhendo por PARENTESCO, nunca por posição.
  - **`cifraBuscarNoSite(consulta, alvo, artista)` mantém os TRÊS papéis**: o que
    vai no `?q=`, o que o PARENTESCO compara e o DESEMPATE. Eles seguem distintos
    porque o segundo tento cola o álbum na consulta e o parentesco continua sendo
    contra o nome da música — juntá-los foi um defeito real, e volta a ser um.
  - **Falhar continua sendo CINCO motivos e cinco frases**, e agora a frase é a
    resposta INTEIRA: não há mais uma tela de correção atrás dela. Foi por isso
    que a do `sem-cifra` parou de mandar "escolha na lista abaixo" — uma
    instrução que nomeia um controle ausente é pior que instrução nenhuma.
  - **A guarda de TECLADO saiu junto, e é a única baixa que pode voltar a doer.**
    Ela existia porque o teclado do sistema é um `resize`, o `resize` remede a
    folha (`cifraRemedir` → `renderLyricsView`), o redesenho destrói o `<input>`
    com foco, e um campo sem foco fecha o teclado — que é outro `resize`. Da tela
    saía um teclado que piscava e sumia, sem erro em lugar nenhum. **Se um campo
    voltar a esta aba, a guarda tem de voltar com ele**; o `cifra-teclado.test.mjs`
    saiu neste lote e está no histórico do repositório com a forma dela.
  - **Um resto fica no aparelho, de propósito:** a chave `cifraEscolhas` do
    `state` continua gravada em quem já usou o recurso. Ninguém a lê, não custa
    nada, e apagá-la exigiria uma migração para devolver bytes que não fazem
    falta.
- **O REGISTRO GUARDA A ESTRUTURA DA PÁGINA QUE NÃO ABRIU**
  (`AVCifra.radiografia`). `ilegivel` responde *"não entendi"*, não *"o que
  era"* — e a distância entre as duas é uma sessão de adivinhação a distância.
  **É UMA POR ENDEREÇO, não uma por procura** (v1.2.6): uma procura tenta vários,
  e enquanto o slot foi único a última escrita apagava as anteriores — sempre
  deixando a página menos interessante. MEDIDO três vezes: o download em massa
  do hinário apagando o diagnóstico do operador, e a recusa anti-robô de um
  motor de busca (`HTTP 202`) com a estrutura dela sobrescrita pela busca que
  rodou em seguida. Um Registro não tem pressão de tamanho — ele existe
  para ser COPIADO —, então guarda-se todas e imprime-se todas.
  A radiografia devolve FORMA: quantos `<pre>` e de que tamanho, quantos `<b>`
  no maior deles, quantos links de música, `<title>`/`<h1>`/`<h2>`, o tom, e uma
  amostra curta de endereços — **a dos que passaram, ou, quando NENHUM passou, a
  do que havia** (`amostraEhCrua`). Amostrar só o que passa deixa o Registro mudo
  no caso em que ele é a única pista: MEDIDO, "38 link(s) de 2 segmentos, 0 com
  forma de música" e nenhum dos 38 à vista. **Nenhum pedaço de letra ou de acorde sai** — não
  é economia de bytes, é o contrato: um Registro existe para ser copiado para
  FORA, e o app lê conteúdo de terceiro sem distribuí-lo. O oráculo cobra as
  duas metades, e a segunda (o conteúdo NÃO sair) é a que protege o contrato de
  um campo novo acrescentado sem pensar. Só o caso `ilegivel` a grava: no
  caminho feliz ela sobrescreveria a página que interessa.
- **O NOME DO ÁLBUM É O ARTISTA DO SITE** (`AVCifra.urlDoAlbum`, v1.2.5), e esta
  é a tentativa deduzível de melhor custo-benefício do recurso. MEDIDO:
  "Usa-me", do álbum **Adoradores 5**, mora em `/adoradores-5/usa-me/`. Ela não
  precisa de catálogo para manter nem de rodízio fixo — **sai do dado que já
  está no item**, e é uma requisição. Vem antes dos artistas padrão porque é
  mais específica. Nem todo álbum tem página ("Nunca Mais as Lágrimas" está sob
  `cd-jovem-2018`, não sob "Fé e Ação"): errar custa um 404 e o resto da cadeia
  roda como sempre.
- **OS CDs OFICIAIS TÊM ENDEREÇO DEDUZÍVEL TAMBÉM** (`AVCifra.ARTISTAS_PADRAO`).
  Os álbuns do acervo são dezenas ("Missão", "Salmos", "Adoradores"…) e no site
  caem todos sob a coleção **Ministério Jovem** — a mesma forma do `CATALOGO`,
  sem uma coleção do acervo para mapear. Vale uma tentativa PRÓPRIA, entre o
  catálogo e a busca, pela razão que ordena as três: ali a URL sai do nome da
  música, e é **uma requisição sem ranking de ninguém escolhendo por nós**.
  Errar custa um 404 — a busca roda em seguida como sempre, nenhum caminho
  regride —, e o Registro imprime a tentativa verbatim, então um slug que o site
  renomeie aparece em toda música e se conserta por OTA. O mesmo artista entra
  como **desempate** na busca: um resultado sob ele é, por definição, de um CD
  oficial, e isso não depende de o nome do álbum do acervo bater com nada.
- **A BUSCA DO PRÓPRIO SITE NÃO EXISTE, E O BUSCADOR EXTERNO TAMBÉM NÃO
  RESOLVEU** (shell 52, v1.2.8). MEDIDO num aparelho: `cifraclub.com.br/?q=`
  responde 425 kB, sabe qual foi a consulta (ela está no `<title>`) e os únicos
  links de duas partes na página são o índice A–Z e o "Academy" — **os
  resultados são desenhados por JavaScript**, que o `cifraHtml` não executa. A
  v1.2.2 respondeu a isso perguntando ao endpoint HTML do DuckDuckGo, com
  `site:` na consulta; MEDIDO de novo, ele responde **`HTTP 202`** — a recusa
  anti-robô —, e uma recusa lida como página vazia é uma requisição por procura
  para não devolver nada. O motor saiu, e o host dele saiu do `CifraFonte`
  junto.
  - **O que passou a achar as músicas são os endereços DEDUZÍVEIS**: o catálogo
    do hinário, o álbum-como-artista e os artistas padrão — uma requisição cada,
    sem ranking de ninguém escolhendo por nós. É neles que o esforço vale, e é
    isso que a varredura mostra no Registro.
  - **A busca interna FICA, em último lugar.** Ela custa a requisição que já
    custava e hoje devolve zero; se o site voltar a desenhar no servidor, volta
    a funcionar sozinha, e o Registro segue acumulando a resposta dela.
  - **TODO MOTOR TENTADO VIRA UMA LINHA do Registro, com o STATUS** (v1.2.5). A
    primeira versão reportava só o ÚLTIMO, e um Registro real saiu com duas
    linhas `busca` e nenhuma do motor que tinha sido consultado. Não se
    diagnostica um motor que o diário não menciona, e `HTTP 0` (não respondeu) e
    `HTTP 403` (recusou o agente) pedem consertos opostos. A regra fica de pé
    com um motor só — ela é sobre o diário, não sobre a quantidade.
  - **Trocar de motor NUNCA troca o critério.** O que um motor devolve entra na
    mesma forma do `lerBusca`, e quem julga continua sendo o `ordenarBusca` — o
    parentesco com o nome da música decide, venha o candidato de onde vier. Só
    entra endereço do Cifra Club, conferido por HOST (invariante 2): um
    resultado patrocinado apontando para `cifraclub.com.br.exemplo.com` viraria
    a folha do culto se a conferência fosse por prefixo.
- **A BUSCA ESCOLHE POR PARENTESCO, NUNCA POR POSIÇÃO** (`AVCifra.ordenarBusca`).
  Pegar o primeiro link de dois segmentos da página de resultados é errado por
  duas razões independentes: a NAVEGAÇÃO do site também é link de dois segmentos,
  e ela mora no cabeçalho — portanto vem ANTES de qualquer resultado no HTML —,
  e a ordem do documento não é a ordem do ranking (cabeçalho, rodapé e blocos de
  sugestão saem no mesmo HTML). MEDIDO num aparelho: "Em Oração" devolveu 27
  resultados e o escolhido foi `/letra/A/`, o índice alfabético. A defesa **não é
  uma lista de rotas do site** (ela envelhece sozinha, e a lista `SECOES` é só o
  corte barato): é exigir que o texto do resultado tenha relação com o que se
  procurou — mesmo título, um contendo o outro, ou ao menos uma palavra forte em
  comum. **Zero parentesco é RECUSA, não último lugar** — é o zero que faz uma
  página só de navegação virar "não achei" em vez de abrir qualquer coisa. E a
  contenção exige CORPO (4 caracteres): sem o piso, `'emoracao'.includes('a')`
  devolve exatamente o link que a regra existe para recusar.
- **O ÁLBUM DESEMPATA; ele não filtra, e não abre a consulta.** O álbum do acervo
  não é o artista do site — "Em Oração" está no álbum "Missão" e quem gravou pode
  ser qualquer um. Filtrar por ele derrubaria a música certa toda vez que os dois
  não coincidissem; e pô-lo na PRIMEIRA consulta pode ENCOLHER o resultado em vez
  de afiná-lo, porque é busca de texto. Ele entra como bônus de ordenação, e como
  SEGUNDO tento de consulta — que só acontece quando o primeiro não devolveu
  nenhum parente, ali não há o que encolher. **Até três páginas são tentadas**
  (`CIFRA_CANDIDATOS`): o ranking do site não é o nosso, e cada tentativa entra
  no Registro, então três `ilegivel` seguidos continuam dizendo "o site mudou de
  formato" — mais alto, não mais baixo.
- **`ilegivel` NÃO cai na busca.** Ali a página existe e o parser é que não a
  entendeu; repetir a leitura por outro caminho troca o motivo certo por um
  errado, e apaga a única pista de que o site mudou.
- **Falhar VAZIO é proibido.** `lerPagina` devolve `null` para *"respondeu e eu
  não entendi"*, e isso é diferente de *"não tem"*. Achatar os dois numa frase só
  faz uma mudança de marcação do site ficar indistinguível de uma música ausente
  — e ninguém investigaria. São **cinco motivos** (`sem-rede`, `nao-tem`,
  `recusou`, `ilegivel`, `sem-cifra`) e cinco frases, porque cada um pede uma
  ação diferente.
- **`sem-cifra` É A METADE QUE FALTAVA DO `ilegivel`** (`AVCifra.varianteSemCifra`,
  v1.2.12, generalizado na v1.2.20). MEDIDO numa varredura: ~12 das 85 falhas eram endereços que EXISTEM,
  respondendo 200 com centenas de kB e nenhum `<pre>` — o site tem a LETRA
  daquela música e não a cifra. Chamar isso de "não entendi" é falso nos dois
  sentidos: manda investigar um parser que está certo, e faz o download do
  hinário rebater a mesma música toda sessão, para sempre.
  - **Ela exige um marcador POSITIVO, e essa é a decisão inteira.** Responder
    pela AUSÊNCIA (`sem <pre>` ⇒ sem cifra) seria o defeito mais caro que este
    recurso pode produzir: no dia em que o site trocar a marcação, TODA página
    vira "sem cifra" — e este veredito é GRAVADO, então o acervo inteiro ganharia
    um buraco permanente. São duas condições independentes: nenhuma folha **e**
    o site anunciando a página como letra. Uma mudança de marcação derruba a
    primeira e não inventa a segunda, e o desfecho volta a ser `ilegivel`.
  - **A segunda linha de defesa é o PRAZO**, e não um teto por passada. Houve
    um (`CIFRA_SO_LETRA_TETO`, v1.2.12), e ele saiu na v1.2.21 — ver o bloco
    "por que não há mais um teto por passada" logo abaixo. O que sobra são as
    duas defesas que não têm esse defeito: o marcador POSITIVO acima e a
    revisita em 30 dias (`CIFRA_REVISITA_MS`).
  - **O CIFRA CLUB SERVE VARIANTES NO MESMO ENDEREÇO**, e é isso que o
    `sem-cifra` reconhece (`AVCifra.varianteSemCifra`). MEDIDO em duas páginas
    reais, CONFERIDAS À MÃO pelo operador: `/novo-hinario-adventista/
    teu-divinal-amor/` responde a LETRA (aquele hino não tem cifra no site), e
    `/ministerio-jovem/meu-senhor-minha-vida/` responde "partituras para
    teclado" — 449 kB, `<h1>` com o nome certo da música, ZERO `<pre>`. As duas
    são a MESMA resposta: *"esta música está aqui, e não há cifra para ela"*.
    Tratar a segunda como `ilegivel` mandava investigar um parser certo e fazia
    a varredura rebatê-la toda sessão.
    - **O marcador é POSITIVO**: sem folha **e** o `<title>` anunciando a
      variante. Uma mudança de marcação do site derruba a primeira condição e
      não inventa a segunda — o desfecho volta a ser `ilegivel` e nada é
      gravado. **Só variantes MEDIDAS entram na lista:** "simplificada" É uma
      cifra e traz folha, e incluí-la por simetria carimbaria como ausente uma
      página que o parser lê perfeitamente.
    - **NÃO HÁ TETO POR PASSADA** (removido na v1.2.21). Houve um — uma passada
      dominada por `sem-cifra` não gravava nada, na suspeita de que o site
      tivesse mudado. Ele custou caro e não protegia: MEDIDO, o Hinário 2022
      fechou `309 tentadas · 0 achadas · 309 recusadas` e a varredura recomeçava
      do zero a cada abertura, para sempre — e a suspeita era FALSA, como a
      conferência à mão provou. Ele também é estruturalmente errado: a passada
      só cobre o que FALTA, então a proporção de ausências tende a 100% num
      acervo saudável. Quem protege são as duas defesas acima: o marcador
      positivo e o prazo de 30 dias.
  - **O DIÁRIO GUARDA EXEMPLOS** (`CIFRA_EXEMPLOS_MAX`): nome (com o NÚMERO do
    hino), veredito e o ENDEREÇO tentado. É abrindo aquela página no navegador
    que se separa "o endereço que montamos está errado" de "o site não tem cifra
    desta música" — um nome sozinho não responde nem uma nem outra, e foi
    exatamente assim que as duas hipóteses acima se resolveram.
  - **`sem-cifra` NÃO interrompe a cadeia** (só o `ilegivel` interrompe): diz
    que AQUELE endereço não tem cifra, não que a música não exista no site.
    **Mas sobrevive até o fim** — sem essa memória, um `sem-cifra` seguido de
    dois 404 sairia como "nenhum endereço tinha a página", a resposta menos
    informativa das três e a única que manda continuar procurando o que já foi
    achado.
- **A TRANSPOSIÇÃO PRESERVA A COLUNA.** Um acorde vale por estar sobre a sílaba
  em que a harmonia troca. Um `replace` ingênuo empurra todos os acordes
  seguintes quando um deles cresce (`C` → `C#`), e depois de três trocas a folha
  está fora de sincronia com a letra logo abaixo — **parecendo certa**, que é o
  pior desfecho possível. O passo é guardado na entrada do cache: voltar a um
  hino devolve o tom em que o operador o deixou, e trocar de hino não arrasta o
  passo do anterior.
- **A GRAFIA SEGUE A ORIGEM.** Folha escrita em bemóis continua em bemóis. É
  musicalmente correto (transpor não muda a armadura) e é o que faz a folha
  continuar parecendo a mesma para quem já a conhece.
- **A gramática do acorde erra para os DOIS lados, e os dois são mudos.** Larga
  demais ("maiúscula seguida de qualquer coisa"), ela classifica uma linha de
  letra como acordes e a letra **some da aba**. Estreita demais, o acorde que
  não casar volta INTACTO da transposição e fica parado no tom original com a
  folha inteira andando à volta dele — foi o defeito da v1.1.13, em que `7M`
  (sétima maior, a notação brasileira mais comum num hinário) não estava na
  lista. Daí a forma atual: a extensão é uma sequência de PEÇAS conhecidas
  (`maj min dim aug sus add M m º ° + - # b`, dígitos e parênteses), nenhuma
  exigindo dígito depois de si. O oráculo cobra os dois lados em pares, e é a
  metade das RECUSAS que impede a correção de um lado de estragar o outro.
- **A marcação é a fonte; o formato é a rede.** Quem diz "esta linha é de
  acordes" é o `<b>` da página. `pareceAcorde` só entra quando não há marcação
  nenhuma, e o preço está declarado no código: a palavra portuguesa "A" é também
  um acorde.
- **A FOLHA NÃO É MAIS DE QUEM ESTÁ NO AR** (`lvAlvo`, v1.2.14). Ela nasceu
  presa ao `currentItem` — era o auxiliar de leitura da CENA —, e por isso ler
  uma música exigia PROJETÁ-LA. Quem toca quer o contrário: abrir a cifra no
  ensaio sem a congregação ver nada. Na gaveta da Biblioteca é o **"Ver a
  letra"** que aponta o MESMO leitor para aquela faixa (v1.2.25 — antes ele
  revelava uma caixa de texto ali dentro, que era uma segunda leitura sem cifra,
  sem tom, sem corpo de fonte e sem rolagem; o botão de abrir a folha era um
  terceiro, ao lado dela). Num VÍDEO o mesmo botão continua sendo o interruptor
  do detalhe (miniatura, duração, estado no aparelho): quem decide é
  `temLetra(coll)`, nunca `ehSerie`.
  - **Reusar o leitor, nunca reconstruí-lo na gaveta.** É a regra do
    `cifraCabe` e do `cifraProcurar`: uma segunda folha divergiria da primeira
    no primeiro ajuste, e quem tocasse por ela veria a versão de ontem.
  - **E ELA ABRE POR CIMA DA BIBLIOTECA** (`#lyricsPopup { z-index: 205 }`,
    v1.2.26). Todo `.popup-backdrop` é 200, e com o mesmo degrau quem decide é a
    ORDEM DO DOCUMENTO — o `#lyricsPopup` está declarado ANTES do
    `#hymnSearchPopup`, então a folha abria ATRÁS da tela que a chamou. A tabela
    `POPUPS` já dizia a ordem certa (o leitor depois da Biblioteca, porque o
    voltar a percorre de trás para a frente): **as duas dizem a mesma ordem, e
    mudar uma sem a outra é o acaso que já cobriu um popup por inteiro aqui.**
  - **Nada projeta.** O alvo não toca em `currentItem`, não emite comando e não
    passa pelo `send` — o oráculo afirma ZERO comandos no barramento, que é a
    metade que falharia sem deixar rastro na tela de quem abriu a folha.
  - **O RELÓGIO E O DESTAQUE SÃO DA CENA, e só dela** (`lvNaCena`). Com o alvo
    apontando para outra música, seguir o `authoritativeTime()` faria a folha
    andar no compasso de OUTRO louvor — e isso não erra alto: *parece*
    funcionar. Sem relógio o `auto` cai no LIVRE, que é o que um ensaio quer, e
    nenhuma estrofe é destacada.
  - **A ABA escolhida sobrevive à reabertura e NÃO à troca de alvo** — são duas
    coisas: quem escolheu "cifra" no transporte quer continuar nela; carregá-la
    para outra música abriria a folha de um louvor na aba escolhida para outro.
    Quem abre pela Biblioteca não pede fonte nenhuma desde a v1.2.25: o botão
    de lá é **"Ver a letra"**, e a folha nasce na primeira fonte disponível, que
    é a letra. O parâmetro `fonte` de `openLyricsPopup` continua na assinatura e
    HOJE NENHUM CHAMADOR O USA. O ALVO morre ao fechar: é o desvio de UMA
    leitura.
- **A aba é a ÚLTIMA da lista de fontes**, e isso é a precedência inteira: sem
  escolha do operador, `lvActiveSource` abre a primeira — e a que abre sozinha
  tem de ser a letra, que é o que quem opera o culto está lendo. **A Bíblia NO AR
  é exclusiva** (v1.1.11): projetando, ela é a única fonte, e a cifra não é
  oferecida — ver o capítulo do Controle.
- **A QUEBRA DE LINHA É NOSSA, e ela quebra o PAR** (`AVCifra.quebrarPares`). O
  CSS quebra cada linha INDEPENDENTEMENTE, e acorde e letra são uma unidade: com
  `pre-wrap` uma folha larga saía como duas linhas de acorde seguidas de duas de
  letra, e a segunda metade do acorde ficava a duas linhas da sílaba a que
  pertence — não é alinhamento imperfeito, é o par desfeito. Aqui o corte é o
  MESMO ÍNDICE nas duas linhas (e o mesmo recuo sai das duas), então o
  alinhamento se preserva por construção. O ponto de corte recua até não partir
  token: uma palavra cortada fica feia, mas um acorde cortado (`Am` → `A`) vira
  OUTRO acorde, e um que soa. **A largura é INJETADA** — o módulo é puro e não
  olha o DOM; quem a mede é `cifraColunas`, que renderiza uma amostra de 40
  caracteres na fonte de verdade e divide, porque a monoespaçada que o Android
  escolhe varia de aparelho e o corpo segue o A+/A−. Medida inútil (0, o popup
  ainda fechado) devolve a folha INTACTA: sem régua confiável, uma rolagem
  lateral é melhor que uma folha mentindo. Remedir é evento, nunca enquete —
  a folha abrindo, o A+/A−, `resize` e `orientationchange`. O respiro vai ENTRE
  os pares (`.lv-cifra-letra + .lv-cifra-acordes`), nunca dentro deles: é a
  proximidade do acorde com a letra que diz a qual sílaba ele pertence.
- **A ROLAGEM AUTOMÁTICA anda no RELÓGIO DA MÚSICA, não num cronômetro nosso.**
  Velocidade fixa em px/s não tem como estar certa: a mesma folha serve a um
  hino de 2 min e a um de 6, e quem decide o ritmo da leitura é a gravação. No
  modo `auto` a posição da folha é uma **FUNÇÃO** da posição da música, não uma
  velocidade integrada — e isso resolve de graça três coisas que a integração
  trataria uma a uma: pausar a música PARA a folha, um seek a leva ao ponto
  certo, e um quadro perdido não acumula erro nenhum.

  **A função não é `f = t/duração`: tem ABERTURA e FECHO** (`AVCifra.janelaDeRolagem`
  / `fracaoDaRolagem`, PURAS, com oráculo). A abertura segura o começo parado
  alguns segundos — quem chega numa música quer VER a introdução, o tom e a
  primeira estrofe antes de a folha fugir deles; o fecho faz a folha chegar ao
  fim **bem antes** de a música acabar, porque o final é a parte que mais se
  erra e a que mais precisa ser lida com antecedência. Os dois são **fração da
  música com piso e teto em segundos**, e é a combinação que os torna certos nos
  dois extremos: fração pura daria 3 s de abertura num hino de 40 s (não dá
  tempo de ler o tom) e meio minuto num de 6 (a folha parada com a primeira
  estrofe já cantada). A regra é do módulo puro; do `controle.js` sai só o que é
  do DOM — e a duração vem da **barra de progresso**, a única fonte que cobre
  todos os tipos de mídia, pela mesma razão que o `pushNowPlaying`.

  **Sem relógio há o modo LIVRE** (ensaio sem tocar a gravação, item sem linha
  do tempo): px/s constante, `requestAnimationFrame` com delta REAL — no degrau
  mais lento são 11 px/s, menos de um pixel por quadro, e um passo fixo ou
  arredonda para zero (não anda) ou para um (voa); o acumulador de fração
  resolve os dois, e o delta tem TETO (250 ms) porque a página estrangulada em
  segundo plano voltaria dando um salto. **`Auto` sem relógio cai no livre e DIZ
  isso** no `title` do botão: o rótulo mostra a ESCOLHA, a frase mostra o que
  está acontecendo — sem ela, *"por que a folha não acompanha a música?"* não
  tem resposta em lugar nenhum.

  **E "há relógio?" é `midiaNoAr`, nunca a barra sozinha** (`cifraDuracaoNoAr`,
  v1.2.2).
  A barra responde *"este ITEM tem linha do tempo?"*, que é outra pergunta:
  `renderNowPlaying` termina em `seekEl.disabled = !isTimed`, com `isTimed`
  saindo do `kind` do item ATUAL — e `currentItem` sobrevive de propósito ao
  Parar, ao fim da faixa e a uma letra avulsa. A barra ficava habilitada, com o
  `max` da faixa, sobre um telão vazio: com duração o `auto` ancora a folha em
  `fracaoDaRolagem(0, dur)` e ela **não sai mais do lugar**, com o modo livre
  nunca sendo alcançado. O desfecho não é um erro — é uma folha parada.
  Oráculo: `tools/cifra-rolagem.test.mjs`.

  **A posição é NOSSA, em fração de pixel** (`cifraPos`). No ritmo de leitura são
  ~0,37 px por quadro: escrevendo `scrollTop` inteiro, a folha anda 1 px a cada
  três quadros e fica parada nos outros dois — e é esse liga-desliga que se lê
  como TREMOR. Não é jitter de relógio, é quantização. Escrita com a fração, quem
  suaviza é o compositor do navegador, que rola em subpixel; reler o `scrollTop`
  para acumular perderia a fração a cada quadro (ele volta arredondado), que é o
  mesmo defeito por outro caminho — daí `cifraEscrito`, a cópia do que
  escrevemos, ser a régua que distingue a nossa escrita de um arrasto do
  operador. E o CSS do corpo declara `scroll-behavior: auto` **de propósito**:
  `smooth` faria o navegador animar cada uma das nossas escritas por cima da
  nossa, duas animações no mesmo eixo.

  **OS CONTROLES FICAM FORA DA CAIXA QUE ROLA** (`#lyricsViewBar`). Dentro dela
  eles rolavam com o texto: com a rolagem ligada, o pausar saía de cena em
  segundos, e alcançá-lo exigia rolar de volta ao topo — brigando com a rolagem
  que se queria parar. **Um controle que some é um controle que não existe no
  momento em que ele importa.** A barra é da cifra e de mais ninguém, e é limpa
  num ponto só (`renderLyricsView`), senão trocar de fonte deixaria os controles
  da folha de pé sobre a Bíblia.

  **O dedo não briga e não desliga.** No livre o avanço é relativo, então um
  arrasto só muda a origem. No `auto` o alvo é ABSOLUTO e puxaria a folha de
  volta — por isso o arrasto vira um **DESVIO** somado ao alvo dali em diante, e
  ele é medido ENQUANTO o dedo está na tela (no `pointerup` o alvo já andou, e a
  diferença sairia com um quadro de deslocamento dentro). `pointercancel` entra
  junto do `pointerup`: um arrasto que vira gesto do sistema não emite o
  segundo, e sem ele a folha travaria para sempre com o botão dizendo que rola.
  Salto maior que uma tela é um **seek** e se obedece na hora; abaixo disso a
  perseguição é suave (constante de tempo de 400 ms), que é o que absorve o
  jitter do `display-status` a ~4 Hz.

  Ela para sozinha em quatro casos: o fim da folha (**só no livre** — no `auto`
  a folha descansa no fim com a música tocando, que é o que o FECHO existe para
  produzir), a aba deixando de ser a cifra, o popup fechando, e a MÚSICA
  TROCANDO — esta pela chave da rolagem, senão o louvor seguinte já entrava
  rolando do meio de uma folha que ninguém mandou andar. A escada tem sete
  degraus e CICLA (a forma do botão de girar a mídia) e é PERSISTIDA: depende de
  como a igreja canta, não da sessão. **O estado vive FORA do DOM** porque
  `renderLyricsView` refaz a folha inteira a cada transposição; os botões nascem
  a cada render e vêm perguntar como se pintar. E o degrau guardado é adotado
  por FUNÇÃO hoisted (`cifraAdotarVelocidade`), não por atribuição direta: o
  estado mora no fim do arquivo e o `load()` que hidrata roda muito antes na
  leitura — um `let` alcançado de cima é uma zona morta esperando a ordem de
  chamada mudar.
- **"Ver no Cifra Club" é um LINK no rodapé**, não um botão de corpo inteiro. Ele
  é a ação menos principal da aba (quem a abre quer LER a cifra) e, com peso de
  botão, cobrava altura de uma caixa cuja única função é mostrar texto.
- **Ela não existe no navegador.** Sem ponte não há como buscar a página, e uma
  aba que só sabe explicar por que não funciona é pior que aba nenhuma — o
  seletor do topo só aparece com duas fontes, e esta apareceria em toda música.
- **O Registro tem as DUAS metades** (`Cifra (última busca)`): os ENDEREÇOS que
  o web tentou e o que o parser entendeu de cada um, mais o status que o shell
  recebeu. O caso que só as duas juntas resolvem é `HTTP 200` + `ilegivel` — a
  página está lá, a rede está boa, e o `cifra.js` é que precisa de um lote novo.

> **O que o oráculo NÃO cobre, dito:** as fixtures do `cifra.test.mjs` são
> SINTÉTICAS (nenhum conteúdo de terceiro entra neste repositório), então elas
> provam a **gramática** do parser, não que ela case com o HTML de hoje do site.
> Essa segunda metade só se prova contra uma página real — e é exatamente a
> metade que, quando quebrar, se conserta por OTA. **A âncora que existe** é o
> slug: `urlDoHino('hymnal-2022', '001. Santo, Santo, Santo')` tem de produzir a
> URL real conferida à mão, e sem ele nada mais é exercitado.

---

## A paleta

Mora em **`assets/web/shared/tokens.css`**, fonte única carregada pelos dois
`index.html` **antes** da folha do app. Ela é a **identidade oficial da IASD**,
em **DOIS TEMAS**, com o denim `#2F557F` (PMS 302) como núcleo. O raciocínio
completo (cada par medido, os pisos, os ladrilhos da Bíblia) está na seção de
paleta de `docs/arquitetura/DESIGN-SYSTEM.md`.

**NÃO HÁ CONTORNO EM LUGAR NENHUM.** Nenhuma regra desenha `border`/`outline`;
sobrevivem dois DESENHOS (o aro que gira — `.dl-ring` — e o ✓ do seletor de
destinos), nomeados um a um no oráculo
(`tools/tokens.test.mjs`, sem `continue-on-error`). É ele que faz a regra durar:
uma borda é a coisa mais fácil de acrescentar quando duas caixas não estão se
separando o bastante, e ela não quebra nada, não erra alto e não aparece em teste
de comportamento nenhum.

Sem linha, **o degrau de tom é a ÚNICA coisa que separa duas caixas** — daí o
resto desta seção.

### As regras

- **Só COR entra em `tokens.css`.** Raio, escala de ícone, curva de toque e
  medidas de layout ficam no `:root` de `controle.css`: são decisões da UI densa
  do Controle, e o Display não teria o que fazer com elas.
- **Três blocos, nesta ordem:** `:root` com o que NÃO muda, `:root` com o tema
  ESCURO (o padrão, sem atributo) e `:root[data-tema="claro"]` (0,2,0 vence
  0,1,0). O claro é um **DELTA**. **Um token que exista SÓ no claro não está
  definido no tema padrão** — o `var()` computa para o valor inicial da
  propriedade, sem aviso, e quem escreveu acabou de ver a cor certa porque estava
  com o claro ligado. `tokens.test.mjs` trava isso.
- **O PALCO NÃO TEM TEMA**, e é isso que faz o recurso valer. `--stage-*`,
  `--wallpaper`, `--lyrics-frame-bg`, as sombras e o `--scrim` moram no bloco
  compartilhado. O Display ficaria escuro por omissão (ele nunca escreve o
  atributo); o que a separação garante é a **PREVIEW do Controle**, que roda no
  documento que TEM tema e existe para ESPELHAR o telão.
- **E a regra vale para as REGRAS, não só para os tokens.** Nada pintado no palco
  pode ler um token redeclarado em `[data-tema]` — as folhas do palco liam
  `--brand`, `--live-strong`, `--bg` e `--accent-glow`, e com o tema CLARO ligado
  o título do slide de capa saía em denim sobre o preto do palco: **2,73:1**. Daí
  `--stage-accent`, `--stage-accent-glow`, `--stage-on-accent` e `--stage-alert`.
  O `smoke.mjs` compara a COR COMPUTADA de cada camada nos dois temas — a versão
  que comparava NOMES de token deixava o defeito passar por baixo.
- **Três matizes, com papéis que não se misturam.**
  - **Azul denim** é a marca **e** o accent: `--brand` e `--accent` têm o mesmo
    valor de propósito, e os dois nomes existem para distinguir na folha "isto é
    marca" de "isto é navegação".
  - **Vermelho** (`scarlett`) é atenção, em dois papéis separados pela
    INTENSIDADE do preenchimento: saturado (`--live`) = está no ar agora, e não
    pode ter concorrente na tela; suave (`--live-fill` numa linha, `--btn-danger`
    num botão) = ação destrutiva — inclusive o botão que CONFIRMA uma exclusão
    (`openAppDialog({ perigo: true })`), que vestia o azul primário até a v1.4.0.
  - **Verde** (`--ok`, do `treefrog`) é **só** concluído/conectado. Ele já disse
    "está no ar" em dois lugares enquanto outros quatro diziam o mesmo em
    vermelho — duas cores opostas para a mesma mensagem na mesma tela.
- **Os fundos de estado são OPACOS** (`--sel-fill`, `--live-fill`, `--ok-fill`), e
  isso é medido: `--accent-soft` a 16% sobre o painel compõe `#3d4959`, que é o
  `--panel-2` desta paleta — uma linha SELECIONADA ficava com a cor exata do
  nível de baixo da árvore. Opacos, valem o mesmo em qualquer nível: **um estado
  SAI da escada em vez de ocupar um degrau dela**.
- **E A SUPERFÍCIE DE UMA AÇÃO TAMBÉM É OPACA** (`--btn-accent`, `--btn-danger`,
  `--btn-warn`, `--btn-ok`). Os `-soft` são tinta com ALFA, e alfa EMPILHA:
  MEDIDO no escuro, o mesmo botão derivava **1,97:1** entre a base mais escura e
  a mais clara em que ele pousa — mais que o degrau `--bg` × `--panel` (1,49:1).
  O chevron de uma SEÇÃO compunha `#3d4959` e o de um CARD, `#4a596d`: um
  controle, duas cores. Os `-soft` ficam para o que é wash de verdade (a sombra
  do pulso, o trilho do `.dl-ring`); **fundo de botão ou de chip usa `--btn-*`**,
  e `tokens.test.mjs` trava isso.
- **UMA LINGUAGEM DE ESTADO SÓ, e ela responde a quatro perguntas.** O app
  tinha três maneiras de dizer "isto está ativo" (preenchido, `--sel-fill`, e
  **só cor de texto** — a fraca, de que o operador reclamou no botão de
  repetição). Hoje: **ESCOLHIDO** entre alternativas = `--accent-fill` +
  `--on-accent`; **LIGADO** (interruptor) = `--btn-accent` + `--accent`;
  **SELECIONADO** numa lista = `--sel-fill`; **ABERTO** = não é cor (a seta que
  gira e o corpo à vista já dizem; na Biblioteca quem diz é o degrau de
  ELEVAÇÃO). **Cor de texto nunca carrega estado sozinha.**
  E quando AÇÃO e ESCOLHA dividem a MESMA faixa — o trilho de navegação é o
  único caso — a ação desce para `--btn-accent` e a ESCOLHA é marcada **sem
  área**: uma barra de 3px em `--accent` na borda de cima da aba, mais o glifo
  na mesma cor (v1.3.15). Duas manchas cheias na mesma faixa disputam, e a que
  menos deve disputar é a que só diz "você está aqui".
- **Nem todo token é valor oficial, e os derivados estão marcados.** Os dezoito
  oficiais foram desenhados para fundo BRANCO — todos passam AA sobre branco, e
  **nenhum** passa AA como texto sobre o quase-preto do tema escuro (bluejay dá
  3,97:1). Onde clarear/escurecer foi preciso, o comentário de `tokens.css` diz
  de qual oficial o valor saiu, e a matiz é preservada. Nos ladrilhos da Bíblia a
  identidade tem sete famílias de matiz e a tela precisa de DEZ grupos separáveis
  por ≥20°: cinco são oficiais, cinco preenchem os vãos.

### O feedback de toque é um RECUO ABSOLUTO, nunca uma fração

`--press` foi `scale(.96)`, e **uma FRAÇÃO aplicada a alvos de 34px a 408px não
é um valor: são doze**. MEDIDO, o recuo por lado que ela produzia:

| alvo | caixa | recuo |
|---|---|---|
| `.back-btn` · `.popup-close` | 34×34 | **0,7px** — imperceptível |
| `.t-btn` | 53×36 | 1,1 lateral · 0,7 vertical |
| `.tab` | 143×38 | 2,9 lateral · 0,8 vertical |
| `.dialog-btn` | 157×33 | **3,1 lateral · 0,7 vertical** |
| `.lib-item` | 408 | **8,2px** — exagerado |

São as DUAS queixas do operador de uma vez, e o `.dialog-btn` é literalmente o
botão de confirmar exclusão: um aperto de LADO, que não se lê como "apertei".

Hoje **`--press: translateY(2px)`** — o mesmo recuo em qualquer alvo, a metáfora
da tecla que afunda — mais **`--press-luz`**, um `filter: brightness()` (1.35 no
escuro, .88 no claro) que responde até no que não tem fundo, acendendo o próprio
traço. `filter` e não overlay de fundo porque não disputa propriedade com quem
já usa `background-image` (a faixa da célula da Bíblia, a pílula do livro, o
vazado da aba).

**As duas armadilhas que a escala criava morreram com ela:**

- **O HIT-TEST.** A `.coll-bar` do card tem 408px: 4% recuavam a borda direita
  ~8px, e o botão de baixar está colado nela — **MEDIDO, 6 de 11 toques no botão
  de fato baixavam**, e os 5 que erravam eram todos à direita. 2px na VERTICAL
  não tiram dedo nenhum de um alvo de 34px.
- **A FRESTA do aninhamento** (v1.2.27). `:active` casa também nos ANCESTRAIS:
  0,96 × 0,96 deixava o filho 7px mais estreito de cada lado que os irmãos, com
  o fundo do cartão aparecendo nela. Dois recuos são 4px na MESMA direção, sem
  mudar de largura.

**O que fica: um ANCESTRAL não responde ao toque que foi para um filho** — e as
guardas suprimem as DUAS partes (`transform` e `filter`), senão o bloco inteiro
acende por um toque de 40px, que é o mesmo defeito por outra propriedade. Antes
de pôr uma classe na lista, pergunte se um ancestral dela já está lá.

### A escada de camadas

- **A superfície AFUNDA dentro de um cartão** (regra no topo de `controle.css`).
  `--surface`/`--surface-2` são branco com alfa, então EMPILHAM: o mesmo token
  sobre `--panel` produz base bem mais clara do que sobre `--bg` — era a causa
  raiz do pior contraste do app. Não existe alfa que resolva os dois casos, então
  dentro do cartão o sinal se INVERTE (o overlay passa a ser preto), que também é
  a convenção certa de UI escura: o cartão já está elevado, logo o controle
  dentro dele é recesso, e emite menos luz num salão escuro. Custom properties
  HERDAM, então a regra só marca os elementos que de fato pintam `--panel`. **O
  SINAL é o mesmo nos dois temas** (flutua sobre a página, afunda dentro do
  cartão); só a intensidade muda, daí `--surface-sunk` ser token. O par FLUTUANTE
  tem nome próprio (`--surface-alta`/`--surface-2-alta`) porque há um caminho de
  VOLTA — a folha da Biblioteca é nível 0 e um controle lá dentro flutua de novo,
  coisa que um override do mesmo nome não daria (`--surface: var(--surface)` é um
  ciclo que o CSS descarta).
- **A ESCADA TEM TRÊS DEGRAUS, E O QUARTO É O ESPAÇO.** Um quarto tom levaria o
  nível mais interno a ~`#4c5865` no escuro, onde `--muted` mede 3,59:1 e
  `--accent` 3,37:1 — os dois reprovam AA para texto pequeno, que é o tamanho do
  texto de uma linha de lista. Quem carrega o quarto nível é o ESPAÇO: uma faixa
  dentro de um álbum não tem caixa, e o que a separa da vizinha é o tom do álbum
  aparecendo entre elas.
- **No tema CLARO a escada NÃO é monotônica**, e isso é aritmética: a página é
  cinza e o nível 1 é branco (convenção de toda UI clara), então o primeiro
  degrau sobe e os seguintes só podem descer. Folha e card ficam a 1,09:1 e isso
  não se lê como ambiguidade porque **nunca se encostam** (entre eles há sempre a
  moldura branca da seção). O oráculo mede pares **ADJACENTES** e exige só que
  nenhum par coincida — a primeira versão exigia monotonia e reprovava um desenho
  correto.
- **O TOM DE UM BLOCO É DECISÃO DO PAI** (`--camada`): o mesmo componente ocupa
  níveis diferentes conforme a tela (uma `.lib-item` está sobre `--bg` na tela
  principal e sobre `--panel` dentro de uma folha). `--camada` tem um significado
  só: *o tom que um bloco filho DESTE contêiner deve vestir*. **Quem a declara é
  o contêiner, nunca quem pinta** — uma propriedade escrita no próprio elemento
  vence na hora de ELE resolver `var(--camada)`, e o bloco passaria a vestir o
  tom que reservou para os filhos.
- **Nunca escrever branco literal.** Nenhum `#fff` como valor de cor em
  `controle.css`/`display.css` — o branco pleno era a maior fonte isolada de luz
  emitida do app, e o off-white (`--text`) é o que se usa. **Duas exceções, as
  duas declaradas em `tokens.css`:** o palco (`--stage-text: #fff`, porque num
  telão a legibilidade vem de luminância máxima) e o campo de busca da Biblioteca
  (`--field-bg` — pequeno, só existe com a Biblioteca aberta, escolha explícita
  de quem opera; num salão escuro é o retângulo mais luminoso da tela). No tema
  CLARO o `--panel` é branco pleno e a regra não se aplica pelo motivo dela.
- **Uma superfície sem tema arrasta o que vive DENTRO dela** — a regra do palco
  num lugar novo. `--field-bg` vem com `--field-text`, `--field-muted` **e
  `--field-accent`**, no bloco compartilhado: no tema escuro `--text` sobre
  branco dá **1,17:1** e `--accent` dá **2,06:1** (ele é o azul CLARO desenhado
  para o fundo quase-preto do app). Trocar só o fundo apaga o que se digita, e é
  o meio-conserto que o `smoke.mjs` reprova. O terceiro token nasceu quando um
  botão de AÇÃO passou a morar sobre o campo — cada consumidor novo da superfície
  refaz a pergunta, e o nome `--field-*` é o que impede a resposta errada.

### O que vive FORA do CSS e tem de andar junto

- **`res/values/colors.xml` espelha `--bg` à mão, em DOIS valores** (`app_bg`,
  `app_bg_claro`): é o fundo das barras e o `windowBackground` (o que aparece
  ANTES de o WebView carregar). Nada no build detecta divergência, e o OTA troca
  a base sem trocar o APK — mudou o token, muda aqui. **É o único lugar fora de
  `tokens.css` que carrega cor de fundo, e não tem escapatória:** recurso de
  Android não enxerga custom property. Quem escolhe entre os dois é a
  `MainActivity` em runtime (`temaClaro` → `setTemaClaro`), a partir de uma CÓPIA
  guardada em `SharedPreferences` — XML é resolvido antes de existir JavaScript,
  então o primeiro quadro só pode vir de preferência guardada. **Preço: trocar de
  tema tem um lançamento de atraso no fundo do splash, e só nele.** A mesma
  chamada vira `APPEARANCE_LIGHT_STATUS_BARS`, que o Android 15+ **não** ignora
  (ele ignora as CORES das barras, não a aparência dos ícones) — sem ela o tema
  claro fica com relógio e botões brancos sobre branco.
- **O `theme-color` do `<meta>` NÃO é um segundo lugar:** `pintarTema()` o LÊ do
  `--bg` já resolvido (a folha entra no `<head>` e o script no fim do `<body>`),
  e o literal do HTML cobre só o instante anterior a esse script.
- **O ÍCONE DO APP é a paleta** — a mesa de som DE PÉ: três trilhas verticais em
  `--text` e três cabos de fader em `--accent` (retângulos arredondados, a forma
  do cabo real) sobre `--bg`. Ele **não segue o tema claro**, e não tem
  como: é desenhado pela gaveta do sistema com o app fechado. É **VETOR**
  (`res/drawable/ic_launcher_foreground.xml`) porque com `minSdk` 26 o adaptativo
  é o único ícone que chega a ser desenhado — PNGs por densidade eram peso morto
  e mais lugares para a cor divergir. A camada `monochrome` (ícone temático do
  Android 13+) tem vetor próprio: apontada para o PNG de primeiro plano, que tem
  fundo opaco, ela vira um quadrado cheio.

### O que o CI trava, e o que ele NÃO trava

**Não há teste de contraste ABSOLUTO.** Os números nos comentários de
`tokens.css` são medições à mão, e os pares abaixo do piso estão declarados como
tais ali mesmo. **Ao mexer num token, meça — e são DOIS temas.**

O CI trava outra coisa: `tokens.test.mjs` (todo `var(--x)` sem fallback aponta
para token que EXISTE; nenhum token só no claro; nenhum contorno; **nenhuma
superfície de controle é tinta com alfa**; **todo bloco que pinta `--panel`
afunda a superfície dos filhos** — as duas últimas provadas por REVERSÃO) e
`smoke.mjs` (o efeito RENDERIZADO nos dois temas, o palco que não os segue, a
escolha que sobrevive à recarga, a ESCADA DE CAMADAS medindo o degrau ENTRE
níveis — a única parte do contraste que tem oráculo — e o recuo do toque, que
tem de ser ABSOLUTO).

---

## Divergências entre o caminho web e o nativo

**Regra de escrita:** toda guarda é `if (!window.__NATIVE__) { …web… }`, nunca o
inverso como caminho principal. O navegador é o padrão; o nativo é a exceção que
se declara. É assim que a base continua rodando nos dois contextos — e é assim
que ela é desenvolvida e testada fora do aparelho.

> As colunas dizem **o que difere**. O *porquê* de cada escolha está no lote que
> a criou: `grep -n "<termo>" docs/HISTORICO.md`.

| Ponto | Navegador | App nativo |
|---|---|---|
| Service worker (`sw.js`) | — | **não existe no bundle** (v5.48). Assets já são locais; recarregar o WebView do telão em culto é o que não pode acontecer. Atualizar é papel do OTA |
| `#startBtn` "Ligar Sistema" | destrava autoplay | **oculto** (`mediaPlaybackRequiresUserGesture = false`; TV não recebe toque). **Oculto também no papel `tela`**, pela razão oposta: lá há política de gesto, mas o gesto é do "Ativar esta tela" — este só se esconde, e gastá-lo perde o único toque. Quem o desliga é `display.js`, pelo PAPEL e em TODA carga (a regra morava no `montarEntrada()` do `tela.js`, que a recarga com sessão viva não chama) |
| Áudio bloqueado | segue mudo + retentativas | **recuperação desativada no `onBlocked`** — sem política de gesto, `NotAllowedError` só pode ser falso positivo |
| Pastas do dispositivo | `showDirectoryPicker()` | **SAF** — a File System Access API não existe no Android |
| Compartilhamento | **não existe** (vinha do `share_target` + SW, ambos removidos) | **`intent-filter`** (`ShareIntake.kt`), só `content://` — ver abaixo |
| Link do YouTube COPIADO | **não existe** (`navigator.clipboard.readText()` pede permissão e exige gesto — o oposto do que este caminho é) | **oferecido na abertura e na retomada** (`areaTransferencia`, shell 48). COPIAR NÃO É UM PEDIDO, então há uma PERGUNTA antes e só o "sim" entrega o link ao `importShare` — que dali em diante é o mesmo código do share. A pergunta é o que torna isto seguro no Modo Fácil, onde um link compartilhado vira transmissão SEM perguntar. O aviso do sistema do Android 12+ é pago **uma vez por link copiado**, nunca por retomada: o shell compara o CARIMBO da descrição antes de ler |
| Link do YouTube compartilhado | vira item de LINK, que só o app resolve | avançado: as MESMAS quatro escolhas da busca (tocar · playlist · Cronograma · Favoritos + vídeo/só-áudio + teto). Simplificado: sem pergunta, **transmissão direta** (`tentarTransmitir`) — ali o link É um "tocar agora". Falhando: download; falhando ele: item de LINK, resolvido no toque seguinte (`resolverLinkYoutube`) — um link compartilhado nunca se perde |
| Destino de um item | uma escolha por vez | **VÁRIOS destinos de uma vez**, método único: toda opção da folha (as três listas **e** o "Tocar agora") é selecionável de corpo inteiro, e um confirmar sempre visível executa. Um vídeo do YouTube é baixado UMA vez para dois destinos. Importação e share abrem a mesma folha com o Cronograma já marcado; desistir entra no Cronograma. Ver `docs/ARQUITETURA-WEB.md`, "UM item, VÁRIOS destinos" |
| Onde o share aterrissa | idem (mesmo `importShare`) | **`focarImportado`**: fecha popups e seleção; projeta na hora no simplificado (item vai para a prateleira `avulsos`, que não tem lista visível) ou vai ao Cronograma no avançado. A preview em tela cheia só é encerrada se houver telão |
| Estado do telão (Configurações) | atalho `window.open('../display/')` | **indicador ao vivo**, desabilitado como botão |
| Botão de cast da preview | oculto | `AVNative.openCast()` → seletor de espelhamento (ver abaixo) |
| Retomada do telão ao reconectar | idem (`resendSceneToDisplay`) | **só reenvia o que ESTAVA no ar** — a pergunta é `midiaNoAr`, nunca `currentId` (que sobrevive ao stop de propósito, para o ▶ repetir a faixa). Telão vazio também é estado: restaurá-lo é não mandar nada |
| Girar a mídia | idem (comando `rotate`) | botão em Configurações, 90° por toque. O motor TROCA O EIXO da caixa antes de girar, para o `object-fit` medir o retângulo em que a mídia vai de fato aparecer |
| Som da preview | com a janela do Display aberta é muda; sem ela toca (sujeito a autoplay) | **sem tela nenhuma conectada, o som sai DESTE aparelho** (`acertarSaidaDeAudio`). No avançado é DERIVADO da conexão (`simpleDisplay` = TV **ou** tela da rede); no Modo Fácil é ESCOLHA (`tocarNoCelular`, o "Tocar neste celular" da folha de conexão), porque lá o padrão é bloquear — escolha de IDA, sem persistência, que se rearma ao fechar o app, ao passar pelo avançado ou quando uma tela entra. Com qualquer tela conectada este aparelho fica mudo nos dois modos — os WebViews dividem o processo e a saída de áudio, e a preview roubava o foco do player do telão |
| PDF · `.pptx` · Google Apresentações | **PDF não existe**; `.pptx` funciona pelo mesmo caminho do app | **uma IMAGEM POR PÁGINA**. PDF pelo `PdfRenderer` da plataforma (`SlideDeck.kt` + `deckPages`); `.pptx` pelo renderizador de `assets/web/vendor/` (`pptxParaPaginas`, `import()` dinâmico + `<foreignObject>`/canvas). Daí é mídia comum, com ⏮/⏭ passando página. **Não há botão de "apresentação"** — entra por "Importar arquivos" (`pickDoc`: o PDF precisa que o shell abra o ARQUIVO, e `<input type=file>` só devolve bytes) ou pelo share. `.ppt` legado e `.odp` ficam de fora: ninguém sabe desenhá-los |
| **Tocar agora** de vídeo do YouTube | **não toca**, e a linha do item diz isso | **TRANSMISSÃO DIRETA** (shell 26; só funciona do 27 em diante): `ytStream` monta o manifesto das duas adaptativas, `StreamProxy` as serve pelo NOSSO origin com o UA que combina, e `shared/mse.js` as vira um `<video>` comum — fade, cortina, `MediaSession` e barra de graça, zero pixel de YouTube no telão. Faixa de bytes na QUERY (`?r=ini-fim`), **nunca** em `Range` (invariante 8). Só em "Tocar agora": as outras ações GUARDAM, e manifesto expira em horas. Falhando qualquer coisa, cai no download, calado. **É o único tipo de mídia que precisa de JS rodando enquanto toca** — ver abaixo |
| **Cifra do hino** | **não existe** — sem ponte não há como buscar a página (CORS), e a aba nem é oferecida | **aba CIFRA no visualizador de letras** (shell 49): `cifraHtml` traz o HTML cru, `controle/cifra.js` o lê, e a folha aparece com transposição por meio tom. **SOB DEMANDA:** nada é baixado em lote, nada entra no bundle, nada é gravado em disco — o cache é um `Map` que morre com o app |
| Vídeo do YouTube | **não toca** | **baixado PELO APARELHO** (`YoutubeGrab.kt` + `ytFetch`) — a extração sai do IP do chip, que é o que o YouTube não bloqueia. Falhando, vira item de LINK, retentado no toque seguinte |
| Qualidade do download | — | teto escolhido pelo operador: **Online · 1080p · 720p · 480p**, no mesmo seletor de Vídeo/Só áudio. Nasce no padrão A CADA ITEM (um teto que grudasse daria 480p no vídeo do domingo sem aviso). 1080p usa o `ytFetch` de sempre; só teto MENOR usa `ytFetchAte`. "Online" (`-1`, e não `0`, que já significa "sem teto") guarda **só o link** |
| Resolução do download | — | **até 1080p, montando as duas faixas** — acima de 720p o YouTube entrega vídeo sem som. `MuxMp4.kt` junta com `MediaMuxer` (cópia de amostras, sem recodificar). Pares do MESMO contêiner (mp4+m4a, webm+webm na API 29+): "a melhor de cada lado" daria VP9 em MP4, que o muxer recusa **depois de tudo baixado**. Falhando, o progressivo é o piso. Requer o extrator ≥ v0.26.4 (cliente **visionOS**, que entrega adaptativas sem PO Token); as listas chegam misturadas, daí a **fila de candidatos** — ver `docs/ARQUITETURA-WEB.md` |
| **Só o ÁUDIO** em "Tocar agora" | **não toca** | transmitido também: o manifesto já traz o par e o lado web DESCARTA o vídeo (`man.video = null`) — nenhum método novo, nenhum byte de 1080p baixado à toa. Entra como `kind:'audio'` (o telão mantém o wallpaper) |
| **Só o ÁUDIO** guardado | — | **`ytFetchAudio`** (shell ≥ 23), pelo mesmo seletor Cantada/Playback. `kind:'audio'` e sem miniatura — é o *kind*, não o contêiner, que faz o telão manter o wallpaper. Único caminho sem o teto de 720p do progressivo. Fila de três candidatos na ordem do cliente que funciona, progressivo no fim |
| **Séries do YouTube** | **não existe** | **um álbum por SÉRIE** (shell 41) — ver a seção do recurso. O ITEM é um vídeo do YouTube, não faixa de hinário: mesma folha (sem "Só áudio"), "Tocar agora" transmite, download só nos destinos que guardam. Não há "baixar o álbum" (~300 MB/episódio) |
| Buscar no YouTube | não existe: abre o YouTube numa aba | **busca dentro da Biblioteca** (`ytSearch` → `YoutubeGrab.pesquisar`), resultados na mesma lista e mesma folha de destinos. Em **português**: passar localização ao `NewPipe.init` NÃO resolve (o serviço filtra por uma lista que só tem `en-GB`) — quem resolve é o `forceLocalization` do próprio `Extractor`. Iframe é recusado pelo `X-Frame-Options`; a API oficial exigiria chave com cota |
| Link para fora do app | `window.open` | **`openExternal(url)`** → `ACTION_VIEW` em tarefa própria. O WebView RECUSA navegar para outro origin (invariante 2): sem esse método um link externo não faz nada, nem erro no console |
| Sem tela conectada (simplificado) | mesmo bloqueio, com a janela do Display no lugar da `Presentation` | **modo bloqueado**: cortina embaçada, seção de conexão no centro, saída para o avançado na frente. **Não é incondicional**: o "Tocar neste celular" da folha (`tocarNoCelular`) desbloqueia e manda o som para este aparelho. **Caminho só de IDA e sem persistência**: o bloqueio se rearma ao fechar o app, ao passar pelo modo avançado (`setAppMode`) ou quando uma tela entra — e por isso o botão SOME depois do toque, em vez de oferecer o desfazer |
| Fullscreen da preview | `requestFullscreen` + Screen Orientation | idem, com trava de paisagem **nativa** (`onShowCustomView`). Os controles são uma COLUNA na lateral direita que o toque acende e 4 s apagam — não gestos (v1.0.7, ver `docs/arquitetura/CONTROLE.md`). É uma das duas superfícies em que ⏮/⏭ ainda tem DOIS eixos (a outra é a notificação): aqui não cabe um par de botões de slide, porque sem TV o que se pinta nesta tela a congregação vê |
| Botões físicos de volume | o navegador não os recebe | **interceptados**, ligados ao fader do deck — e é isso que mantém o painel de volume do Android FORA da projeção (ver abaixo) |
| Microfone AO VIVO | o navegador pergunta | `MicChromeClient` + `RECORD_AUDIO` (ver abaixo). **Só com TV**: quem capta é o `/display/`, que só existe dentro da `Presentation` — e sem TV o botão **não é desenhado** (v1.2.21) |
| Câmera | o navegador pergunta | **negada, sempre**. O `onPermissionRequest` do `ControleChromeClient` FICOU, negando **com log**: um WebView sem ele nega em silêncio, e o próximo que precisar de mídia aqui descobriria a armadilha do zero |
| Botão voltar | — | **fecha o que estiver aberto** antes de minimizar (ver abaixo) |
| Controles fora do app | — | `MediaSession`: notificação, tela de bloqueio, botões de mídia |
| Download minimizado | a aba continua baixando | **foreground service + wake lock**; sem isso o processo é congelado |
| Atualização da base web | recarregar a página | **OTA** |
| Medição de alcance | **não existe** — e a linha de Configurações nem é desenhada (uma chave que não liga nada é pior que chave nenhuma) | **o farol** (shell 58): uma busca por dia a um asset de contagem, agregada e sem id. Pega carona na ronda do OTA. O aparelho marcado como de teste e o build debuggável acendem num contador **separado** — exclusão por CONSTRUÇÃO, nunca por subtração de uma estimativa |
| Atualização do APP | — | **o app baixa e instala**; o diálogo do Android é obrigatório e está certo que seja |
| Tema claro × escuro | CSS + `localStorage`; `theme-color` tinge a barra | idem **mais o cromo do sistema**: `temaClaro` vira os ÍCONES das barras e guarda a escolha para o `windowBackground` do PRÓXIMO lançamento (recurso de APK é resolvido antes de existir JS) |
| **Telão nas telas da rede** | **não existe** (navegador não abre `ServerSocket`) | servidor HTTP no celular + SSE + `/m/<token>` — ver a seção do recurso. A rede é a Wi-Fi de que o celular é CLIENTE **ou o PONTO DE ACESSO dele mesmo** (v1.4.1): nenhuma das duas precisa de internet |
| `__AV_ROLE__` | `'controle'` / `'display'` | **terceiro valor, `'tela'`** — o mesmo `/web/display/` num navegador da LAN. Seguro por construção: as leituras do papel comparam `!== 'controle'`, e **nenhum caminho testa `=== 'display'`** |

### Compartilhamento: ponto de entrada exportado valida o que recebe

`ACTION_SEND` é público — qualquer app dispara. Três regras em `ShareIntake`:

1. **Só `content://`.** `openInputStream` também atende `file://` e
   `android.resource://`, e a leitura acontece com o uid DESTE app: um app com
   `targetSdk` antigo podia mandar `file:///data/data/br.org.iasd.av/shared_prefs/…`
   e o conteúdo virava item projetável na TV. A autoridade do próprio app também
   cai fora.
2. **O intent é CONSUMIDO depois de lido** (`consumeShareIntent`) e o parse só
   roda com `savedInstanceState == null`. A única saída do app é
   `moveTaskToBack`, então a Activity nunca é finalizada e `getIntent()`
   devolveria o mesmo `ACTION_SEND` para sempre — qualquer recriação (tamanho de
   fonte ou idioma, nenhum dos dois em `android:configChanges`; ou voltar pelo
   Recentes) importaria outra cópia integral do arquivo, sem aviso e sem desfazer.

### Microfone ao vivo (push-to-talk)

**A captura acontece no WebView do DISPLAY**, não no do Controle: um
`MediaStream` **não atravessa o BroadcastChannel** (não é clonável). O que
atravessa é o comando `mic`; quem abre o microfone é quem vai reproduzi-lo.

- **`MicChromeClient`** (WebView da `StagePresentation`). Sem tratar
  `onPermissionRequest` o WebView **nega `getUserMedia` em silêncio** — mesma
  armadilha da invariante 6. Três regras: concede **só**
  `RESOURCE_AUDIO_CAPTURE`; **só se o app já tiver `RECORD_AUDIO`** (conceder ao
  WebView o que o processo não tem adia a falha para um ponto sem sinal); e
  **só da própria origem** — defesa em profundidade, porque `grant()` é
  silencioso. Origem AUSENTE não é negada (nunca observada, e recusar por campo
  vazio tiraria o recurso sem ganho).
- **`requestMic()` sob demanda**, no primeiro toque no botão — nunca na abertura,
  que é o pedido que se nega por reflexo.

Caminho no Display: `getUserMedia → MediaStreamSource → GainNode → destination`,
com rampa nas duas pontas (cortar no meio de uma palavra estala na caixa).
`echoCancellation` **ligado**: num culto a realimentação é estrago público
imediato. Fecha sozinho ao soltar o botão, ao trocar de aba e em segundo plano.

**A ESCADA DE TRÊS DEGRAUS é o que o faz abrir NO CULTO** (`TENTATIVAS`, com
oráculo): com `echoCancellation` o Chromium abre o `AudioRecord` em
`VOICE_COMMUNICATION`, e o Android recusa essa sessão quando a saída de áudio
está em outro caminho — que é o app **com o espelhamento ligado**. O segundo
degrau desliga o processamento, o terceiro pede `true` cru, e depois deles vem o
pedido pelo `deviceId` (o `default` do Chromium é uma entrada virtual, e falhar
nele não é falhar no microfone). Quem falha DESISTE em `NotAllowedError`: os
degraus seguintes dariam o mesmo erro.

**É O ÚNICO CAMINHO DE CAPTURA DO APP, e isso é recente.** O **RECADO** (o
microfone estilo walkie-talkie, v1.1.26–v1.2.16) gravava no WebView do Controle
e mandava a voz como item `kind:'audio'`, para cobrir os modelos SEM TV, onde o
ao vivo não abria. Ele saiu na v1.2.17: **a razão de o ao vivo não abrir era um
defeito nosso** — `MODIFY_AUDIO_SETTINGS` fora do manifest (v1.2.13) —, não uma
limitação da arquitetura. Consertado o ao vivo, o que restava do recado era um
segundo caminho que INTERROMPE a cena para dizer o que o primeiro diz sem
interromper nada. Com ele saiu a concessão de áudio do `ControleChromeClient`,
que existia só para ele; `mic-escada.test.mjs` guarda que o Controle não volte a
abrir captura sem trazer o par de volta ao oráculo.

**SEM TV O BOTÃO NÃO EXISTE** (v1.2.21). `renderFoot` só o desenha com
`haOndeReproduzirMic()`, e `renderDisplayStatus` chama `refreshDiversos()` na
**transição de presença** — é ela que faz o botão aparecer quando a TV entra no
meio do culto, sem trocar de aba, e sumir quando o dongle cai. Só na transição:
`refreshDiversos` esvazia o `libraryEl`, e rodá-lo a cada callback (o `onResume`
reconfere a lista) derrubaria o que o operador está usando.

**A largura vem da AUSÊNCIA do irmão, não de uma regra de CSS:** `.misc-foot` é
flex e os dois filhos são `flex: 1`, então sozinho o "Projetar no telão" ocupa a
linha inteira.

**A guarda `sem-telao` FICA, e virou uma corrida** — só se alcança se a TV cair
entre o desenho e o toque. Ela é anterior à permissão pelo mesmo motivo de
sempre. **Três degraus, cada um consertando o anterior:** até a v1.1.20 o botão
acendia "No ar" sem nada captando; ela o fez recusar e DIZER por quê; a v1.2.20
parou de oferecê-lo — explicar é melhor que mentir, mas não é melhor que não
oferecer, e a frase chegava com o dedo no botão, no meio do culto.

### Botão voltar: fecha antes de minimizar

O voltar **nunca** encerra a Activity — no fim da fila só `moveTaskToBack`, com
sessão e `Presentation` vivas. **Quem decide é o lado web** (`window.__avBack`,
invariante 5); `MainActivity.handleBack()` pergunta e obedece. A ordem é do mais
efêmero ao mais permanente:

1. diálogo modal → 2. bottom-sheet (o de cima) → 3. preview em tela cheia (que,
sem telão, **é** a projeção) → *(o degrau 4 era o fader do mixer, e saiu na
v1.3.8)* → 5. seleção múltipla →
6. sub-tela com voltar próprio (Bíblia) → 7. aba ≠ Cronograma → volta ao
Cronograma → 8. nada aberto → `moveTaskToBack`.

- A tabela de popups é **a mesma** que registra o ✕ e o toque no fundo
  (`POPUPS`): um popup novo entra numa linha e já é fechável pelos três
  caminhos. Duas listas divergiriam no primeiro esquecimento.
- **Prazo de 350 ms** (`BACK_JS_TIMEOUT_MS`): `evaluateJavascript` responde por
  callback, e com o renderer morto ou um bundle sem `__avBack` ele nunca chega —
  um voltar que não faz nada é pior que um que minimiza.
- O `AtomicBoolean` garante que `moveTaskToBack` roda **no máximo uma vez** por
  toque. Ele **não** impede minimizar depois de o web já ter fechado um popup: o
  que chega tarde é a RESPOSTA, não a ação. Fechar isso exigiria um token de
  corrida (`__avBack(token)` → `__avResolve`), mudança de contrato da ponte.

### Botões físicos de volume

**O app CONSOME `KEYCODE_VOLUME_UP/DOWN`, e a razão é a PROJEÇÃO.** Quem não
consome deixa o Android desenhar o painel de volume dele — e com espelhamento
ativo esse painel aparece **sobre o que a congregação está vendo**. Consumindo,
nada disso chega ao telão: o que aparece é o fader do celular, por alguns
segundos. `MainActivity.onKeyDown` consome a tecla (e o `onKeyUp`
correspondente, senão o sistema ainda reage à soltura) e entrega o passo a
`window.__avVolumeKey(±1)` → `applyVolume()`.

- **Só intercepta depois que o web pede** (`captureVolumeKeys(true)`, no fim da
  carga do Controle). Interceptar desde o `onCreate` faria uma falha de JS deixar
  o aparelho sem **nenhum** controle de volume.
- **Válvula de escape:** no máximo ou no zero, o web devolve o passo ao sistema
  (`systemVolume` → `adjustStreamVolume` com `FLAG_SHOW_UI`).
- **A tecla ACENDE o fader** por 2,8 s (`peekVolume`) — a ÚNICA porta dele desde
  a v1.3.8, quando o botão de tela que o abria saiu a pedido do operador. Sem
  isso a tecla mexeria num número invisível. Ele ocupa a célula do
  `#slideNextBtn` e some sozinho; o botão de VOLTAR slide, na outra ponta, **não
  some junto** (sumia até a v1.3.8, e foi disso que o operador reclamou).
- **O número não é o volume do aparelho:** ele viaja no comando `volume` e
  chega também às **telas da rede**, que são outros aparelhos.

### Espelhamento de tela ≠ Google Cast

O botão precisa abrir o **espelhamento** (Smart View / "Wireless display"), não
o **Google Cast** — o Cast manda uma URL para o dispositivo tocar sozinho.
`Settings.ACTION_CAST_SETTINGS` **cai no Google Cast** em vários aparelhos, então
é o último recurso; e não há API pública para o popup das configurações rápidas
(`Settings.Panel` só cobre internet, wifi, nfc e volume).

`pickCastIntent()` percorre alvos do mais específico ao mais genérico e escolhe o
primeiro que existe **e não resolve para o Play Services** (`com.google.android.gms`)
— é o filtro, não só a ordem, que impede a cadeia de terminar no Cast:

1. *(só Samsung)* activities exportadas do Smart View —
   `com.samsung.android.smartmirroring` e `com.samsung.android.app.smartmirroring`
2. *(só Samsung)* `com.samsung.wfd.LAUNCH_WFD_PICKER`
3. *(qualquer aparelho)* `android.settings.WIFI_DISPLAY_SETTINGS` — a ação legada
   do AOSP, e a que **não** é reivindicada pelo Play Services

- **`isSamsung()` aceita `MANUFACTURER` ou `BRAND`**, sem caixa: uma ROM mexe num
  e esquece o outro, e errar para "não é Samsung" custaria o Smart View no
  aparelho em que o app é operado. A guarda também evita varrer dois pacotes
  ausentes a cada toque e a cada abertura de Configurações.
- **O nome da activity não é adivinhado:** `exportedActivities()` pergunta ao
  `PackageManager` (`GET_ACTIVITIES`). Um nome chutado não resolve, a cadeia cai
  no fallback, e o botão abre o Google Cast — o oposto do pedido.
- **Nada disso é API documentada.** Alvo ausente → `resolveActivity` null /
  `startActivity` lança, e a cadeia segue. Por isso o bloco **`<queries>`** no
  manifest (visibilidade de pacotes do Android 11+): sem ele tudo resolve para
  null e a cadeia cai direto no fallback.
- `describeCastTarget()` devolve o rótulo **com o componente real**, e
  Configurações mostra "Espelhar abre: …" — é essa string que diz qual candidato
  pegou quando o botão abre a tela errada, sem depender de logcat.

#### O espelhamento leva o som do APARELHO INTEIRO, e não há como isolá-lo

**O `Presentation` isola a JANELA; ele não isola o SOM, e o Android não tem o
conceito de "áudio deste Display".** A assimetria está no caminho do Wi-Fi
Display: o vídeo nasce de um `SurfaceMediaSource` ligado ao display virtual, o
áudio nasce de `AUDIO_SOURCE_REMOTE_SUBMIX` — um mix global, sem parâmetro de
display. A doc de `TYPE_REMOTE_SUBMIX` descreve o caso literalmente ("playing
from a device in screen mirroring mode").

Consequência, e ela é OPERACIONAL: com o espelhamento no ar, **vídeo ou áudio
tocado em qualquer app deste celular sai nas caixas da igreja**, junto com a
projeção. Toque de chamada e alarme ficam de fora (o audio policy tem guarda
explícita: `// no sonification on remote submix (e.g. WFD)`); som de notificação
depende do aparelho.

**NÃO HÁ CONSERTO NO APP, e é preciso estar escrito para a investigação não ser
refeita.** O que resolveria — `AudioPolicy.setUidDeviceAffinity`,
`setPreferredDeviceForStrategy`, `registerAudioPolicy` — é `@SystemApi` atrás de
`MODIFY_AUDIO_ROUTING` (`signature|privileged|role`). Um APK assinado com a
keystore do projeto nunca as obtém.

**E `requestAudioFocus` no Kotlin seria uma REGRESSÃO, não higiene.** Foco
deixou de ser cooperativo no Android 12 (o sistema faz fade-out e mantém o
perdedor mudo), e quem toca aqui não é o Kotlin — é o WebView, que pede foco por
`<video>` (`kRequestSystemAudioFocus`, ligado por padrão). Um pedido nosso
despejaria o próprio WebView (`propagateFocusLossFromGain_syncAf` não filtra por
uid) e **pausaria o telão no meio do culto**. Vale o mesmo para
`GAIN_TRANSIENT_EXCLUSIVE`. Também descartados: `ALLOW_CAPTURE_BY_NONE` (só
afeta o áudio do PRÓPRIO app, e quem monta os `AudioAttributes` é o WebView) e
`setMode(MODE_IN_COMMUNICATION)` (tiraria o culto da TV junto com o vazamento).

**MAS A PROJEÇÃO SE DEFENDE, e isso não contradiz o parágrafo acima.** MEDIDO em
aparelho: tocar qualquer outra mídia no celular PAUSA a do telão, e na perda
PERMANENTE o Chromium abandona o foco e não volta nunca. Desde a v1.1.11 o
`display.js` reage à pausa espontânea com `stage.play()` — que é o Chromium
re-pedindo foco por conta própria, não um `requestAudioFocus` nosso, e por isso
a regra de cima segue de pé. Três tentativas (1,5 s / 4 s / 10 s) e desistência
até um comando humano; sem teto, dois apps que retomam sozinhos gaguejam para
sempre, e gagueira é pior que pausa. **Ela não garante que a outra mídia pare** —
o framework MUTA o perdedor e desfaz sozinho segundos depois; contra um alarme
(`USAGE_ALARM`, fora das usages esmaecíveis) não faz nada. As guardas são a
entrega, não o `play()`: `TELA` (N telas da rede religando mídia é o oposto do
que o operador controla) e `v.ended` — o fim natural dispara `pause` ANTES de
`ended`, e sem ela o fim de cada louvor religaria a faixa com a playlist
avançando por baixo. **Essa segunda existe DUAS vezes, e o oráculo só reprova
quando as duas somem** (medido por reversão): quem tirar uma vai ver o teste
passar e concluir que ela não servia.

**A saída para o VAZAMENTO continua estrutural: o áudio não nascer no celular** — o telão por comandos,
com o espelhamento DESLIGADO (os dois juntos mantêm a mistura no ar), ou um
aparelho dedicado só para projetar. O operador é avisado disso na folha de
conexão (só com TV no ar) e por inteiro no bloco "Áudio do aparelho" do
Registro.

### Andaimes do modelo de dois PWAs, removidos

A base nasceu como dois PWAs instaláveis que se falavam por BroadcastChannel.
Com a `Presentation` no lugar, saíram do bundle: `web/index.html` (o "Abrir
Controle / Abrir Display"), os dois `manifest.json` (WebAPK, `scope`,
`orientation`, `share_target` — nada disso existe num WebView: ícone, nome e
orientação vêm do APK), `controle/icons/` e `display/icons/`, e o `sw.js`.

**Fica** a preview em tela cheia (a projeção quando não há TV, com os gestos
invisíveis) e todas as guardas `if (!window.__NATIVE__)`.

---

## Build e distribuição

`.github/workflows/apk.yml` — o runner `ubuntu-latest` já traz JDK e Android SDK;
nenhuma infraestrutura externa.

| Rota | Como | Observação |
|---|---|---|
| Artifact | Actions → run → *Artifacts* | vem como **.zip**; precisa descompactar no celular |
| **Release** ⭐ | `git tag v1.0.1 && git push --tags` | **link direto para o .apk** |
| Release manual | Actions → *Build APK* → *Run workflow*, com `release_tag` | a tag é criada pelo próprio workflow |

**O `web-ota` NÃO tem filtro de caminho**, e é por isso que um lote que não toca
em `assets/web/` — documentação, o `site/`, um workflow — ainda republica o
bundle e reescreve o `sha256` do manifesto. Não é corrupção e não quebra nada (a
versão é igual, e o aparelho descarta o que não for MAIOR); o zip só é
reempacotado de um checkout novo, com carimbos de tempo novos. Manifesto e zip
saem juntos, do mesmo run, sob a mesma fila. Um `paths-ignore` pouparia runner,
mas mexe no maquinário que alimenta a frota — e o preço de errar ali é o canal
OTA parar.

**O `web-ota` roda com fila, sem cancelamento** (`concurrency: web-ota`,
`cancel-in-progress: false`). Os assets de `web-latest` são substituídos um a um,
sem transação: duas execuções em paralelo (o merge seguido de um push de
correção é o caso normal) intercalariam, e cancelar no meio do upload produz o
mesmo estado. Ver "OTA" para o que o nome versionado do zip fecha.

### Os oráculos

Antes de publicar: `node --check` em todo `.js` de `assets/web`, validação do
`version.json`, e a suíte abaixo.

**Node puro, SEM `continue-on-error`** — reprovar aqui barra o build:

| oráculo | o que trava |
|---|---|
| `webview-range.test.mjs` | a **invariante 8**: o `InputStream` de `shouldInterceptRequest` é o recurso INTEIRO |
| `sombra.test.mjs` | nenhuma função da base pode redeclarar um nome de módulo — `node --check` APROVA um `const ms` que sombreia a `ms` do módulo, e o que sai é `ReferenceError` por zona morta temporal |
| `tokens.test.mjs` | nenhum `var(--x)` **sem fallback** aponta para token inexistente (um `var()` inválido computa para o valor INICIAL, sem aviso); nenhum token só no tema claro; **nenhuma regra desenha contorno**. `var(--x, fallback)` é legítimo (valores que o JS entrega em runtime) |
| `serie.test.mjs` | quais playlists e vídeos entram no álbum. **Entradas VERBATIM do canal** — nomenclatura imaginada prova só que o código concorda com quem o escreveu |
| `hinario.test.mjs` | as **seções temáticas do Hinário 2022**: a cobertura é CONTÍGUA de 1 a 600, sem lacuna e sem sobreposição. É a única propriedade que pega um limite digitado errado — e esse erro é MUDO: a lista continua completa, na ordem certa, com um cabeçalho mentindo no meio. Confere também a faixa infantil contra o `sorteio.js` |
| `cifra.test.mjs` | o que o app entende de uma página de cifra: slug, gramática do acorde, e a transposição PRESERVANDO A COLUNA. É a peça mais frágil do projeto — lê a marcação de um servidor que não é nosso. Fixtures **SINTÉTICAS** de propósito: nenhum conteúdo de terceiro entra neste repositório. Elas provam a GRAMÁTICA, não que ela case com o HTML de hoje — essa metade se conserta por OTA, e o Registro diz quando quebrou |
| `sorteio.test.mjs` | quais faixas a **playlist automática** pode mandar ao telão. O operador toca UM botão e a faixa entra em cena, sem tela intermediária: os quatro modos de errar (série no lugar do louvor · faixa que casa e não aparece · PLAYBACK onde se esperava a voz · fila cheia do que falta baixar) são todos silenciosos |
| `glifos.test.mjs` | **todo ícone de fonte existe na fonte.** O `.woff2` é um SUBSET de 31 codepoints, e um `.msym` fora dele não desenha NADA — sem erro, sem requisição falhando, só um vão: o botão existe, é tocável, faz o que promete e é invisível. Lê o `cmap` do próprio arquivo (`zlib.brotliDecompressSync`, zero dependência) |
| `sidx.test.mjs` | o parser `sidx` |
| `mic-escada.test.mjs` | **a escada de captura do microfone**: com `echoCancellation` o Chromium abre o `AudioRecord` em `VOICE_COMMUNICATION`, e o Android RECUSA essa sessão quando a saída de áudio está em outro caminho — isto é, **com o espelhamento ligado**, o modo normal de um culto com TV. É o SEGUNDO degrau (sem cancelamento de eco) que abre o microfone ali. Ele guardava um PAR (o ao vivo e o RECADO) até a v1.2.17; com o recado fora, as asserções de pareamento saíram e ficaram as de PROPRIEDADE — uma igualdade entre duas escadas nunca provou que elas estavam certas, aprovaria duas igualmente erradas. Guarda também que o Controle **não abre captura nenhuma**, para um segundo caminho não voltar mudo |
| `tipos-que-sobem.test.mjs` | **as DUAS metades do dreno da tela da rede**: a lista de permissão do `drenar()` (`espelho/tela.js`) e a do `TIPOS_QUE_SOBEM` (`EspelhoServidor.kt`). Duas listas sem oráculo divergem no primeiro esquecimento, e a divergência é MUDA nos dois sentidos |
| `contexto-seguro.test.mjs` | `VideoDecoder`, `wakeLock`, `audioWorklet`, `randomUUID`, `crypto.subtle` **fora de guarda** em `espelho/`, `display/` **e `shared/`** — o `/display/` das telas da rede roda em `http://`, e ele carrega quatro arquivos de `shared/`: lá essas APIs vêm `undefined`. Guarda vale `isSecureContext` **ou** detecção de presença na mesma linha |

**Chromium de verdade, em DOIS PASSOS, e a ASSIMETRIA entre eles é a política:**

| passo | `continue-on-error` | porque |
|---|---|---|
| `Preparar o Chromium` | **sim** | é o CDN de outra pessoa. Um download quebrado lá fora não pode calar a atualização de uma igreja — os oráculos são pulados (`if: steps.chromium.outcome == 'success'`) e um passo de AVISO escreve o pulo no resumo, senão ele fica indistinguível de um run em que tudo passou |
| `Oráculos em Chromium` | **não**, desde a v5.316 | é o NOSSO código. Reprovar aqui derruba o job `verificar`, que é `needs` do `web-ota`: o bundle não chega à frota |

Ele roda **todos SEMPRE** — nenhum aborta o próximo —, emite `::error::` por
reprovado e escreve o placar `N/M` no **resumo do run**. `N` e `M` são CONTADOS,
nunca digitados: um número fixo envelheceria no primeiro oráculo novo, e
envelheceria mentindo.

> Eles rodavam num passo só com `set -euo pipefail`: o PRIMEIRO reprovado
> abortava os outros, e como o passo era `continue-on-error` o run ficava
> **verde**. Descobrir isso exigia abrir o log e reparar onde ele parou.

**A escapatória é MANUAL e ASSINA**: o disparo de `Build APK` tem o campo
`ignorar_oraculos`, que publica com oráculo reprovado e grava isso no resumo, ao
lado do placar e dos `::error::`. Nenhum push a alcança. A diferença para o
`continue-on-error` não é de grau — ele decidia por todo mundo, para sempre e
sem registro.

**O `apk` NÃO depende do `verificar`**, e isso é escolha: o portão fecha o canal
OTA (automático, a cada push em `main`, sem ninguém olhando) e não o APK
(manual, com uma pessoa escolhendo a tag). O preço está dito: uma Release tirada
de uma árvore com oráculo vermelho embute a mesma base web.

### UM ORÁCULO NÃO PODE MEDIR O RUNNER

É a regra que o fechamento do portão comprou, e ela vale antes dele: enquanto o
passo era `continue-on-error`, um oráculo que reprovasse por carga da máquina
não custava nada — e por isso elas se acumularam. **MEDIDO**: 21 dos 23 runs
anteriores terminaram verdes com oráculo reprovado dentro, 40 reprovações
somadas, **uma** delas um defeito de verdade. As cinco classes abaixo são as que
a v5.316 leu e reproduziu; a lista é o que se sabe, não um inventário fechado.

| classe | como aparece | a forma certa |
|---|---|---|
| **prazo lido como veredito** | `waitForFunction(…).catch(() => { ok = false; })`, e a asserção seguinte fala do APP quando o que estourou foi o relógio | esperar pelo FATO, e o estouro devolve a FRASE ("PRAZO, não veredito") no terceiro argumento do `checar` — ver o `esperar()` de `ota.test.mjs` |
| **medida que depende da MÁQUINA** | igualdade de altura em pixel: a base pede `system-ui, -apple-system, sans-serif`, então quem responde é a fonte instalada (MEDIDO: uma linha de duas linhas de texto vai de 53px a 55px sob WenQuanYi Zen Hei) | afirmar o que o DESENHO reserva (`--hit`, o `padding`), nunca a soma renderizada — ver `destinos.test.mjs` |
| **estado que ainda não foi lido** | o app está certo e o oráculo perguntou cedo: `mirrorEstado` antes da primeira volta da enquete, o índice antes de a varredura da abertura assentar | esperar pela INGESTÃO (o dado entrando), nunca pela resposta DERIVADA — esperar pelo que se vai afirmar é escrever uma tautologia |
| **o oráculo correndo contra o app** | a montagem do cenário compete com o que o app faz na abertura: semear `ota-intencao` no Controle e navegar perdia a semente para o `retomarAtualizacao()` da própria abertura, que a CONSOME com toda a razão | montar o cenário onde o app não alcança — uma página do mesmo origin que carrega só `shared/db.js` — e só então entrar na tela que se quer medir |
| **prazo menor que a CADÊNCIA do app** | há uma ENQUETE no meio do caminho: `retomarAtualizacao` roda de dez em dez segundos e desiste de propósito enquanto falta a resposta do manifesto | **o prazo tem de caber o pior caminho que o app pode legitimamente tomar.** Se não couber, o oráculo reprova o certo — e quem lê o log conclui que o app quebrou |

Três regras que caem daí:

- **Prazo não é asserção.** Um `waitForTimeout` no meio de um oráculo é uma
  aposta na máquina; se há um sinal determinístico, é por ele que se espera.
- **Quem responde "já pode?" é a função do APP**, não uma segunda escrita da
  regra dentro do oráculo (`indiceVencido`, `mirrorEstado`) — é o mesmo
  princípio do Registro: uma segunda opinião envelhece à parte.
- **Oráculo instável é suspeito de DEFEITO DO APP.** Das instabilidades deste
  lote, **duas** eram o app, e as duas na mesma linha do `db.js`:
  `serieDiarioGravar` fazia read-modify-write com `getState` + `setState` e duas
  varreduras da mesma série apagavam uma à outra; e `setState` resolve ANTES do
  commit, então a intenção do OTA — gravada e seguida de um `otaApply()` que
  recarrega o documento — podia ser abortada junto com a conexão, levando a
  metade nativa do lote embora em silêncio. Nos dois casos o oráculo não estava
  errado: estava chegando na hora exata. **A pergunta a fazer diante de um
  vermelho intermitente é "o que este teste pegou?", não "quanto tempo a mais
  ele precisa?"**

**A prova de que um oráculo é determinístico é uma CAMPANHA, não uma execução:**
todos eles, N rodadas, com a máquina a 2× de carga (o runner do GitHub é 4 vCPU),
e o suspeito sozinho a 4×. Reprovação nenhuma é o único resultado que autoriza o
portão. O que autorizou a v5.316: **64/64** (16 oráculos × 4 rodadas a 2×) e
**20/20** do `ota.test.mjs` a 4×.

**E uma reprovação a cada N execuções não é ruído, é o achado.** Nas cinco
classes acima, cada rodada vermelha apontou uma coisa de verdade — duas delas
defeitos do app. Um oráculo que só reprova sob carga está dizendo que existe uma
ordem de eventos em que o app erra, ou uma em que a pergunta do oráculo não faz
sentido; as duas merecem resposta, e nenhuma das duas é "mais prazo".

**E a campanha vale para a versão do Playwright em que foi medida.** O
`package.json`/`package-lock.json` pinam o arnês (`npm ci` no CI, nunca
`npm i`), e **subir o pin obriga a repetir a campanha**: quem decide altura de
linha, ordem de evento e quanto tempo uma página leva para assentar é o
navegador. Com o portão fechado, uma reprovação que não se reproduz fora do
runner não tem conserto por inspeção — só pela válvula, o que devolveria o
mundo anterior por outro caminho.

| oráculo | o que cobre, e por que existe |
|---|---|
| `smoke.mjs` | sobe a base e usa a tela; mede o RENDERIZADO nos dois temas (palco sem tema, escada de camadas, contorno) |
| `boot-nativo.test.mjs` | **o boot COM a ponte presente** — o `smoke` sobe SEM `__AVBridge`, então todo caminho `window.__NATIVE__` (justamente os que só rodam no aparelho) nunca era executado. Injeta uma ponte de mentira e pergunta o que o watchdog pergunta: o app ficou de pé? |
| `display-smoke.mjs` | **o TELÃO** — a metade que roda na frente da congregação, e a que menos rede de segurança tem (o watchdog do OTA não a valida). Viewport fixo em 961×540, explicitamente. Trava o endereçamento do reenvio de cena |
| `ota.test.mjs` | **o fluxo de atualização** — o único caminho cujo defeito NÃO TEM SINTOMA: nada quebra, o operador só continua na versão de anteontem. Afirma a pergunta com e sem Release, o "depois", e a INTENÇÃO atravessando a MORTE DO DOCUMENTO (semeada numa página que só tem o banco, porque semeá-la no Controle é uma corrida contra o `retomarAtualizacao` da abertura — e uma que o app ganha com razão) |
| `registro.test.mjs` | **o Registro** — o único artefato cujo consumidor é um HUMANO A DISTÂNCIA: ele não falha calado, falha CONTINUANDO A RESPONDER com frase errada. Cobra as duas metades: nenhuma palavra de recurso aposentado **e** o que o operador foi buscar presente |
| `tela-rede.test.mjs` | **a tela da rede de ponta a ponta**, contra um servidor de mentira que fala o protocolo do `EspelhoServidor` |
| `ponte.test.mjs` | **o que a ponte de fato ENTREGA** — `native.js` REMONTA campo a campo, e um campo esquecido some em silêncio. Afirma também que ele não drena papel nenhum e que o display emite as quatro mensagens (`display-ready`, `display-status`, `media-ended`, `mic-status`) — quem filtra é o `tela.js`, nunca a fonte |
| `cena.test.mjs` | o que o telão mostra ao RECONECTAR (o caminho menos testável à mão: exige TV, dongle e o timing de derrubá-lo) |
| `telao-no-chao.test.mjs` | **a tela conectada com o telão NO CHÃO** — "há tela" nunca foi "há telão", e o estado em que as duas divergem calava a preview sem ninguém tocando do outro lado: SILÊNCIO NOS DOIS LADOS, sem erro no console e com o Registro dizendo "conectado". Mede as três metades, e nenhuma basta: o som que fica neste aparelho, o estado ser DIZÍVEL (um filtro que escondesse a tela diria "não há TV", que é falso) e a RECUPERAÇÃO sendo absorvida sem passar por uma desconexão — sem esta última, a escada do Kotlin seria só um jeito novo de ficar parado |
| `imagem-sobre-audio.test.mjs` | a IMAGEM projetada por cima do áudio. A regra é uma AUSÊNCIA — nenhum `load` sai daquele caminho —, e ausência não tem sintoma de tela nem erro de console: quem a prova é o `currentTime` do `<video>` medido em DOIS instantes ("não pausou" é fraco; "andou" prova que é o mesmo áudio). Nas duas metades: o Controle que decide sobrepor e o telão que pinta |
| `parar-por-camada.test.mjs` | **o Parar do transporte, que fala de UMA camada só.** A regra é CONDICIONAL (mídia + Camada de Texto → sai só a mídia; uma das duas sozinha → sai a cena inteira), e uma condicional errada é muda nos DOIS sentidos: ou a Camada de Texto fica presa no telão sem saída no transporte, ou o louvor de fundo volta a levar o versículo junto. Mede as TRÊS cenas, e a prova é o `currentTime` do `<video>` mais o TIPO do comando — `clear` e `media-clear` apagam o mesmo vídeo da preview |
| `cifra-rolagem.test.mjs` | **a rolagem `auto` da cifra precisa de um relógio ANDANDO.** A barra de progresso responde "este ITEM tem linha do tempo?", e `currentItem` sobrevive ao Parar, ao fim da faixa e a uma letra avulsa — a barra ficava habilitada sobre um telão vazio, e o `auto` ancorava a folha em `fracaoDaRolagem(0, dur)`. O desfecho não é um erro, é uma folha PARADA. TRÊS metades: sem mídia no ar ela anda (o livre assumiu), com mídia no ar ela não anda sozinha — "cair sempre no livre" apagaria o recurso —, e a folha de uma música da BIBLIOTECA (`lvAlvo`) continua rolando depois de um redesenho. Esta terceira trava a divergência que a v1.2.14 abriu: `cifraRolarAlternar` gravava a chave de `currentItem` e a guarda de `lvBuildCifra` compara com `lvItem()`, então no ensaio a rolagem morria no primeiro `renderLyricsView` (transpor, A+/A−, girar). A terceira asserção prova que a guarda "música nova é folha nova" não foi apagada para as outras duas passarem |
| `leitor-do-transporte.test.mjs` | **o BOTÃO que abre o auxiliar de leitura.** `openLyricsPopup` ganhou `(item, fonte)` e o ouvinte continuou registrado por REFERÊNCIA — `addEventListener` chama com o EVENTO, o `PointerEvent` virou o `lvAlvo`, e as três fontes (letra, cifra e a reserva da Bíblia) sumiam de uma vez: a folha abria dizendo "Nada em exibição" para TODA música, com o console limpo. Os três oráculos que já abriam esta folha chamam `openLyricsPopup()` direto — o único caminho que continuava funcionando —, e é por isso que este CLICA. A segunda metade (a Biblioteca continua desviando o alvo) impede que apagar os parâmetros "conserte" a primeira |
| `controles-layout.test.mjs` | **o DECK dos controles** (v1.3.5): os dois botões de slide que voltaram a flanquear a preview, a coluna de operação que subiu para cima dela, e o ⏮/⏭ do transporte que perdeu o eixo de estrofe. As quatro mudanças falham CALADAS, e a mais cara é a última — se a troca não pegar, "próxima mídia" continua passando ESTROFE com uma letra no ar, no meio de um louvor, sem nada no console; a prova é o COMANDO que sai no barramento (`seek` é a estrofe andando). Trava também a **ARMADILHA DO `<use>`**: a folha do documento NÃO atravessa a árvore-sombra de um `<use>`, então um `<symbol>` único com os dois desenhos dentro carrega, não erra e desenha os DOIS empilhados para sempre. As duas asserções mais óbvias contra ela — contar nós visíveis e fotografar o botão — **aprovam a armadilha** (medido), e por isso ele pergunta qual SÍMBOLO está no ar. Cobre também a COLUNA DA TELA CHEIA (v1.3.10): ela nasce ACESA e o toque é INTERRUPTOR. Ele espera pelo EVENTO `fullscreenchange`, nunca por `document.fullscreenElement` — MEDIDO, o Chromium publica a propriedade ANTES de despachar o evento e a enquete do Playwright cai no vão, reprovando um app que está certo |
| `fundo-da-letra.test.mjs` | **o fundo da estrofe na PREVIEW**, que sumia ao trocar de música. A `<img>` é filha da camada da letra, então o desmonte é ADIADO — e quando a letra volta antes do prazo (todo `load` de música faz isso) alguém precisa CANCELAR o desmonte. A guarda de sequência não cancela: ela não anda quando a estrofe que volta usa a MESMA imagem, que é o caso NORMAL (o fallback grudento do sync dá uma imagem por hino). O telão tinha as três proteções e a preview não tinha — **e a documentação já as descrevia como se fossem de ambos**: é a armadilha do `__tela`, em que ler cada lado isolado aprova os dois. Sem TV a preview É a projeção |
| `excluir-em-cena.test.mjs` | **excluir de uma lista não pode derrubar a cena**, e eram DOIS defeitos. O primeiro tem sintoma (o louvor parava, por um `retirarDoAr` no caminho de excluir); o SEGUNDO não tem nenhum — o coletor só conhecia LISTAS, então sair da última apagava os bytes por baixo de uma projeção que seguia tocando, e só uma queda de dongle revelaria. Mede que a cena continua ANDANDO (não só "não pausou") **e** que o registro sobrevive. A terceira metade impede a correção de virar outro defeito: um item que JÁ TOCOU e não está mais em cena tem de morrer de verdade |
| `aviso-de-importacao.test.mjs` | **o aviso de que um arquivo está entrando.** A ausência dele NÃO É UM ERRO: nada quebra, nada aparece no console, e o item chega ao fim — só chega em silêncio, e "importei e não aconteceu nada" é indistinguível de travar. Um teste do desfecho passa nas duas versões, então ele mede o MEIO, com o arquivo servido AOS PEDAÇOS para a janela existir |
| `toque-instantaneo.test.mjs` | **o "Tocar agora" de um vídeo responde no INSTANTE do toque.** Ele começa por uma extração de rede de SEGUNDOS, e até a v1.4.6 nada mudava na tela nesse intervalo — nem o aro de carregamento; o único sinal acendia uma linha da Biblioteca que o `closeHymnSearch` acabara de fechar. Mede o MEIO (a ponte de mentira SEGURA o `ytStream`), porque um teste do desfecho passa nas duas versões. Sete metades: as quatro do toque (a cena sai, o comando vai ao BARRAMENTO, o cartão aparece, e guardar no Cronograma NÃO interrompe — a que impede a correção de virar um defeito maior), o ITEM DE LINK de uma lista (a outra porta do mesmo trabalho, que a v1.4.6 deixou de fora), o subtexto do "Online", e o CONFIRMAR sempre último da faixa |
| `ferramentas-folha.test.mjs` | **as Ferramentas como folha do Cronograma** (v1.3.10). A asserção que carrega o lote é GEOMÉTRICA — a caixa da folha contra o cabeçalho e a caixa de controles —, porque uma folha de corpo inteiro continua funcionando e continua bonita: o que ela perde é o transporte e a preview à vista, e isso não aparece em teste de comportamento nenhum. Trava também que `activeTab` continua em `'imports'` com a folha aberta (se ela trocasse a aba, o rodapé onde mora a porta dela deixaria de ser desenhado) |
| `historico.test.mjs` | **o histórico do culto**, uma lista que se preenche sozinha no ponto mais quente do app (`send`) e cujos três modos de errar são mudos: não registrar (a folha abre vazia depois de um culto inteiro), registrar demais (`repeat: 'one'` enterrando o culto em cópias do mesmo nome) e oferecer ao Cronograma um id que o coletor já recolheu — este só aparece no sábado seguinte |
| `restaurar-letra-adiada.test.mjs` | **a letra que volta depois de um aviso não pode ser a do hino ANTERIOR.** `restoreSceneAfterText` lia `stage.getCurrent()` sem saber que havia `load` em voo, e o `current` só troca depois do `runFadeOut` — a janela são os ~600 ms do `FADE.time` de TODA troca de cena, não um fio de navalha, e o estado é PERMANENTE: a letra errada AVANÇA pelo relógio da música nova. Três cenas, e as duas metades provadas por reversão: sem o adiamento a CENA 1 reprova, sem o CANCELAMENTO na saída de cena a CENA 3 reprova — um `clear` durante a espera remontava a letra sobre um palco já esvaziado, invisível porque a cortina cobre |
| `restaurar-letra-adiada-preview.test.mjs` | **o par PREVIEW do de cima, e ele existe porque corrigir um lado não corrige o outro.** As duas metades foram confirmadas independentemente, por medição — é a armadilha que o `fundo-da-letra` já pagou uma vez: *ler cada lado isolado aprova os dois.* Sem TV a preview É a projeção |
| `gaveta-e-cartao.test.mjs` | **o cartão de falha da preview não pode prender o trabalho SEGUINTE.** `falhar()` segura o cartão pelo prazo de leitura retendo o `pvBusyCount`, e um trabalho novo que nascesse e terminasse dentro da janela encontrava o contador em 1: o cartão ficava na tela com a legenda do trabalho NOVO, já terminado. Regressão de uma correção desta campanha, pega pelo revisor e provada por reversão. Tem a OUTRA metade — falhando sozinho o cartão FICA —, sem a qual a primeira seria a volta do defeito que o prazo existe para impedir |
| `gaveta-no-download.test.mjs` | a GAVETA DA LINHA contra o redesenho do progresso — o único lugar do acervo em que o operador DECIDE, e o redesenho remontava a lista por baixo dela a cada 400 ms. MUDO nos dois tempos: aberta, ela some sem erro nenhum; ABRINDO (há um `await` do IndexedDB entre o toque e o `expanded`), o `li` vira órfão e o toque não faz nada. Quatro metades, e a primeira é o HAZARD — sem ela as outras provariam que uma função concorda consigo mesma |
| `cifra-offline.test.mjs` | **a cifra guardada do hinário abre SEM REDE**, e **a gravação MESCLA em vez de substituir**. A primeira promessa é operacional e falha calada: sem a leitura do disco o app cai no caminho de rede e, COM rede, a folha aparece igual — pela porta errada. Por isso a asserção é `cifraHtml` NÃO ter sido chamado, com a ponte respondendo "sem rede" a tudo; a outra metade prova que o que NÃO está guardado ainda vai à rede. A segunda trava o defeito que apagou 275 cifras de um aparelho: a asserção é a PROPRIEDADE (uma mescla não pode produzir zero a partir de 275), não o interleaving que mordeu daquela vez |
| `leitor-biblioteca.test.mjs` | **a folha de qualquer música da Biblioteca, SEM telão.** Ler deixou de exigir projetar, e três coisas falham calado: a folha mostrar a música da CENA em vez da pedida; alguma coisa ir ao TELÃO — o único defeito que não deixa rastro na tela de quem abriu a folha, e por isso o oráculo afirma ZERO comandos no barramento; e o relógio da cena governar a rolagem de OUTRA música, que não erra alto: a folha anda, no compasso errado |
| `recusa-transmissao.test.mjs` | **a recusa da transmissão diz O QUE FAZER, e só quando é de REDE.** O veredito sempre saiu verbatim do shell (certo: a frase é de quem decidiu); o que faltava era a instrução, e ela falha calada nos DOIS sentidos — de menos, o operador lê "sem rede para transmitir" sem saber que o ponto de acesso do próprio celular resolve; de mais, a recusa de PORTA OCUPADA (a única deste caminho cujo conserto não é mexer na rede) passa a mandar mexer na rede. A segunda metade lê as frases do PRÓPRIO Kotlin — técnica do `tipos-que-sobem`, e pelo mesmo motivo: a decisão é por PALAVRA sobre uma string que o Kotlin escolhe |
| `destinos.test.mjs` | o que está marcado atravessa o fechamento da folha — a ação roda depois de `closeSongMenu()`, que zera o conjunto |
| `hinario-tela.test.mjs` | as seções do hinário **da tabela até a tela**. O `hinario.test.mjs` trava a REGRA; este, a LIGAÇÃO. Dois casos não gritam: os cabeçalhos moram na MESMA `<ul>` das faixas, e uma retomada de paginação que contasse os FILHOS pularia um hino por cabeçalho (hinos sumindo do meio da lista); e o hinário de 1996 tem outra numeração, então um "Infantis" sobre o 508 DELE ninguém nota olhando o hinário certo |
| `sorteio-tela.test.mjs` | a **playlist automática** da folha até a fila. O `sorteio.test.mjs` trava a REGRA; este trava a LIGAÇÃO, que falha de outro jeito — a regra continua certa e o recurso não faz nada. As quatro capacidades injetadas são ponteiros, e um errado devolve um pool plausível e ERRADO |
| `db-gc.test.mjs` | o coletor de lixo — o único código do app que APAGA mídia do operador |
| `db-estado.test.mjs` | **a atomicidade de uma chave de `state`** (`AVDB.updateState`). O defeito que ele trava não erra alto em lugar nenhum: `getState` + calcular + `setState` são duas transações com um vão entre elas, e o que se perde é a metade que o outro escritor acabou de gravar. Tem as DUAS metades — escreve o hazard à mão e prova que ele PERDE, e só então prova que a função não perde; sem a primeira, a segunda provaria que uma função concorda consigo mesma |
| `acervo.test.mjs` | as contas da Biblioteca ("completa?" e "quanto ocupa?"), que já foram respondidas por fórmulas diferentes na mesma tela |
| `mse.test.mjs` · `stage-fade.test.mjs` | mensagens de falha da transmissão direta · a transição de entrada do palco |
| `espera-do-stream.test.mjs` | **o travamento no meio da transmissão** — o giro só existia na CARGA, e uma parada por falta de buffer congelava o quadro sem nada na tela; um app quebrado produz a MESMA imagem. Quatro metades (aparece · não pisca · só no stream · é CONTADO) mais a que foi MEDIDA escrevendo o arquivo: um `MediaSource` nasce vazio e dispara `waiting` em toda transmissão, então contar a carga faria o número do Registro dizer "≥1 sempre" |
| `degrau-de-banda.test.mjs` | **a escolha do degrau da transmissão** — a regra é PURA (banda medida + escada + duração → índice) e cada caso decide uma coisa: o topo com rede sobrando (senão a regra vira um jeito elaborado de projetar 480p numa igreja com fibra), o degrau QUE CABE com rede apertada (recuar demais é o mesmo defeito do outro lado, e ninguém reclamaria dele), o PISO em vez de uma recusa, a MARGEM (a medida sai do slow start e subestima), o ÁUDIO na conta, e a MONOTONIA — mais banda nunca devolve degrau pior, a propriedade que nenhum caso isolado pega |
| `registro-alcance.test.mjs` | **a MEDIÇÃO DE ALCANCE**, um dos dois que rodam sobre o `site/`. Duas coisas falham CALADAS ali. Um gráfico que desenha todos os valores iguais: `.barra-c`/`.barra-f` eram `<span>`, que é INLINE, e `width` não faz nada num elemento inline — 12, 5, 3 e 1 saíam idênticos, sem erro em lugar nenhum (provado por REVERSÃO). E o ROTEAMENTO do farol de visita, que é o requisito inteiro: se ele parar, os números continuam subindo e passam a incluir quem mede — **e contador não se corrige depois** |
| `plataforma.test.mjs` | **o FILTRO DE PLATAFORMA da página**: o `.apk` só instala em Android, então quem chega de iPhone, iPad ou computador não vê o guia de instalação — vê a frase que diz que este é um app Android e que a página deve ser aberta por um. Falha CALADO nos dois sentidos: de MENOS, o download volta a aparecer num iPhone e a pessoa conclui que o app está quebrado (ninguém relata isso); de MAIS — o caro —, a classificação recusa um Android de verdade e o que sai é uma página que abre, rola e não oferece nada. Daí o desenho FALHAR ABERTO (sem classe no `<html>` nada é escondido) e essa propriedade ter asserção própria: um desenho fail-CLOSED deixa a suíte inteira verde e reprova só ali. `userAgent` VERBATIM, **o iPad entre eles sem código próprio** — o iPadOS 13+ se anuncia como Macintosh e cai no lado certo por construção, então a asserção guarda a PROPRIEDADE e não o mecanismo |

> **A REDE EXTERNA NÃO ENTRA NUM ORÁCULO** (`tools/sem-rede.mjs`,
> `semRedeExterna(ctx)` logo depois de cada `newContext()`). A base web fala com
> a LouvorJA na carga — `pt_hymnal`, `pt_categories`, `pt_bible_*`, um
> `music_<id>` por faixa —, e **nada disso era interceptado**. Numa máquina sem
> saída para a internet as chamadas morrem e o oráculo é determinístico POR
> ACIDENTE; no runner elas RESPONDEM, o hinário real desaba sobre o acervo
> plantado pela fixture, e a asserção passa a medir o catálogo da LouvorJA. Foi
> assim que `smoke`, `boot-nativo` e `sorteio-tela` ficaram vermelhos no CI (12
> de 15) enquanto passavam na máquina de quem os escreveu — e, com o passo em
> `continue-on-error`, **sem ninguém notar**. Bloquear é seguro por construção:
> todos eles já passam onde toda saída falha, logo nenhum depende de terceiro.
> Fixture de terceiro que um oráculo queira exercitar entra por um `route()`
> **dele**, registrado depois (o Playwright resolve da mais recente para a mais
> antiga) e com o corpo escrito à mão.

> **Um servidor de mentira que diverge do de verdade não prova nada.** O
> `tela-rede` já entregou o HTML **sem a CSP** e com `?tela=1` na mão — provando
> o percurso num ambiente mais permissivo e por um caminho que o aparelho pode
> não receber. Isso escondeu dois defeitos ao mesmo tempo. Hoje ele injeta a
> marca do papel como o servidor injeta, manda a CSP verbatim e roda **sem query
> nenhuma**.

**JUnit** (`./gradlew testDebugUnitTest`, **sem `continue-on-error`**, antes do
`assembleRelease`) — os arquivos PUROS: `EspelhoHttpTest` (tetos do parser,
`read()` parcial, `Host` fora da allowlist, `Origin` estranha, 404 uniforme),
`EspelhoParesTest` (prazo, teto de sessões, saneamento), `EspelhoHttpRangeTest`
(a gramática RFC 7233 do `alcanceDe` — malformado é IGNORADO e vira 200, nunca
adivinhado; é a **inversão da invariante 8** escrita como código),
`EspelhoMidiaCacheTest` (o token-capacidade da rota `/m/`),
`EspelhoInterfacesTest` (EM QUE INTERFACE o socket abre — em PARES, e o par que
carrega o arquivo é o `p2p-wlan0-0`/`192.168.49.1` do Wi-Fi Direct: privado, no
ar, sem `Network` que o reivindique, a forma EXATA que a regra procura, e no ar
durante todo culto com Miracast) e `TrilhaAudioTest`
(qual trilha de áudio vai ao telão — o defeito mais silencioso deste caminho:
tudo funciona, e o testemunho está em inglês na frente da congregação; doze casos
**em pares**, o que a regra passou a recusar e o que ela não pode ter recusado
junto).

**Duas regras de método que ficam:**

- **Teste que não está no workflow é documentação, não rede de segurança.**
- `node --check` prova que o arquivo é PARSEÁVEL, não que o app funciona — a
  v5.121 saiu com um botão chamando função apagada, sintaxe perfeita e CI verde.
  O canal OTA publica direto para a frota e o watchdog **não evita o primeiro
  estrago** (`beginSession()` arma o `pending` e SERVE o bundle; só o lançamento
  seguinte descarta): um lançamento quebrado por aparelho, garantido.

### Assinatura

Releases saem **assinadas com keystore fixa** (secrets `KEYSTORE_B64`,
`KEY_ALIAS`, `KEY_PASSWORD`). É isso que permite **atualizar por cima sem
desinstalar** — e sem perder a biblioteca, que vive em IndexedDB/OPFS e o Android
apaga junto com o app.

- O `.jks` **nunca é versionado**; o build o materializa do secret. Decodificação
  com `Base64.getMimeDecoder()`, **não** o BASIC: o `base64` do GNU quebra linha
  a cada 76 caracteres, e o BASIC lança diante de qualquer `\n` (`trim()` só
  limpa as pontas).
- Sem os secrets (build local, PR de terceiro), cai na assinatura de **debug** e
  tudo compila — só não serve para atualizar por cima.
- **Publicar exige a chave:** o passo de Release passa `-PrequireSigning=true` e o
  Gradle reprova a ausência. A guarda anterior deduzia da existência de
  `app-release.apk` e era **código morto** — o AGP só acrescenta `-unsigned`
  quando a variante não tem signingConfig NENHUM, e o fallback de debug atribui
  um. Saía uma Release assinada com a `debug.keystore` do runner **daquela
  execução**: `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, com desinstalar como única
  saída.
- **Cinto e suspensório:** o CI pergunta ao `apksigner` quem assinou e falha se
  achar `CN=Android Debug` (fixo na chave de debug, então o teste é exato).
- **`versionCode` vem da CONTAGEM DE COMMITS** (`git rev-list --count HEAD`) mais
  um deslocamento de 100000 — daí o `fetch-depth: 0` (clone raso devolveria 1).
  Não vem de `github.run_number`, que conta por WORKFLOW: renomear o `apk.yml`
  reiniciaria em 1 e forçaria desinstalar. Se um `versionCode` publicado chegar
  perto do deslocamento, **aumente**-o, nunca o diminua. O `versionName` vem da
  tag.
- **No disparo manual, o checkout usa `main`** — senão o APK sairia de uma branch
  de trabalho enquanto a tag aponta para `main`. (`target_commitish` só é usado
  para CRIAR a ref quando ela não existe; no fluxo com `git push --tags` ele não
  faz nada.)
- **`retag`** (desligado por padrão) apaga Release e tag antes de recriá-las — é o
  único jeito de MOVER uma tag publicada. Fica atrás de input próprio de
  propósito: mover tag é destrutivo e não pode ser efeito colateral.
- Perder a keystore é irreversível.

### Backup com regras

`res/xml/backup_rules.xml` e `res/xml/data_extraction_rules.xml` —
`allowBackup="true"` sozinho leva tudo, e **três** coisas não podem ir:

- **`files/web-ota/` e `shared_prefs/web-ota.xml`** — o bundle extraído e o
  ponteiro para ele, isto é, **CÓDIGO** que roda no origin privilegiado com
  acesso a `__AVBridge`. Um backup adulterado plantaria JS arbitrário sem passar
  por nenhuma das três garantias (não há download, nem `sha256`, e `minShell` só
  existe no caminho do download). Nada ali precisa sobreviver à troca de
  aparelho.
- **`files/espelho-tls/` e `shared_prefs/espelho-tls.xml`** — a **chave privada**
  do certificado do telão na rede e a senha com que ela foi reescrita
  (`EspelhoCert.kt`). Uma chave restaurada de um backup adulterado é um servidor
  falando com a identidade da igreja — e, ao contrário do bundle OTA, ela não se
  reconstrói sozinha. **É a única exclusão que sai também da transferência
  direta:** perdê-la ao trocar de aparelho custa reemitir e reimportar, que é o
  preço certo.
- **`app_webview/`** — IndexedDB/OPFS, que passa de gigabytes.

A diferença entre os destinos é deliberada: o backup em **nuvem** tem cota de
25 MB (com `app_webview` dentro ele não protegia a biblioteca e ainda arriscava
reprovar o backup inteiro); a **transferência direta** não tem cota, e ali copiar
a biblioteca é o que o operador quer ao trocar de celular. Por isso `app_webview`
só sai da nuvem. **São dois arquivos porque o Android mudou o formato** (o antigo
vale da API 26 à 30, o novo da 31 em diante) — qualquer exclusão nova entra nos
dois.

Rodar local: `./gradlew assembleDebug` (exige Android SDK).

---

## Regras de desenvolvimento

### Entrega

- **SEMPRE fazer merge com `main` ao terminar.** Trabalhar na branch designada é
  o meio, não o fim: o OTA publica a partir de `main` (`if: github.ref ==
  'refs/heads/main'`) e as Releases nascem de `main`.

  ```bash
  git add <arquivos> && git commit -m "vX.Y.Z: <descrição>"
  git push -u origin <branch>
  git checkout main && git merge <branch> --no-ff -m "Merge: <resumo>"
  git push origin main          # ← sem isto, nada chega aos aparelhos
  ```

- **SEMPRE gerar uma Release quando o SHELL mudar.** O merge entrega só a **base
  web** — o OTA carrega `assets/web/` e mais nada. `java/`, `AndroidManifest.xml`,
  `res/`, `build.gradle.kts` e os workflows **só chegam instalando um APK**, e o
  pior caso é silencioso: um método novo da ponte faz o web se comportar de um
  jeito no código e de outro no culto, porque lá o `SHELL_VERSION` é o antigo.

  **A primeira linha vem ANTES do merge:** declarar a tag em `version.json`.

  ```jsonc
  { "version": "1.0.1", "minShell": 46, "shellTag": "v1.0.1" }
  ```

  Com ela o `web-ota` SEGURA o bundle até a Release existir e, quando ela sai,
  republica o manifesto **com o link do APK dentro** — o app pergunta uma vez
  sobre o lote inteiro. Sem `shellTag` o bundle sai na hora, que é o certo para
  um lote só de web. Depois do push em `main`: Actions → *Build APK* → Run
  workflow, com `release_tag` = a MESMA tag do `version.json` (a tag é criada
  pelo workflow, a partir de `main`). **Não esperar o operador pedir.**

  **`shellTag` esquecido não quebra nada, mas desfaz o ganho** (o aparelho recebe
  a metade web sozinha). **`shellTag` apontando para uma tag que nunca sai é
  pior:** o canal fica segurando para sempre, em silêncio, e a única pista é a
  linha no resumo do run.

- **SEMPRE deixar a PÁGINA anunciando a versão que acabou de sair.** Ela é a
  única coisa deste projeto que fala com quem **ainda não instalou** — e o modo
  de errar dela não é ficar fora do ar: é continuar linda, continuar respondendo
  e anunciar um número que não é o que está publicado. Quem lê não tem como
  conferir, e conclui que o app parou de ser mantido.

  **Isto é automático, e o trabalho é NÃO QUEBRAR o automático:** o `pages.yml`
  se encadeia por `workflow_run` no *Build APK* e publica sozinho a cada lote
  que chega em `main`. Cada peça vem de onde ela é verdade:

  | o que a página mostra | de onde sai | por quê |
  |---|---|---|
  | a VERSÃO | `version` do **manifesto do canal OTA** | é o que o aparelho vai rodar. A tag da Release fica parada em todo lote só de web, e o `version.json` do repositório pode estar segurado pelo `shellTag` |
  | o TAMANHO e a URL | o `.apk` da **Release** | é o que se baixa |

  **Não trocar `workflow_run` por `on: release`** — evento criado com o
  `GITHUB_TOKEN` padrão não dispara workflow (o guarda de recursão do GitHub; ver
  a seção do OTA). Foi assim que a página serviu o APK da Release ANTERIOR.

  **Conferir depois de publicar**, porque o run verde não prova o número: o passo
  *"A versão que o aparelho vai rodar"* imprime `Base web publicada: X (APK: Y)`,
  e um `::warning::` no resumo significa que o manifesto não foi lido e a página
  saiu com a versão do APK — correta, velha, e indistinguível de estar tudo bem.

  **E TODO CAMINHO DENTRO DE `site/` É RELATIVO** (`telas/biblia.webp`, nunca
  `/telas/biblia.webp`). O Pages serve de `jonathasptbr-gh.github.io/Audio-Visual-IASD/`,
  com PREFIXO de caminho; um domínio próprio serviria da RAIZ. Todo link absoluto
  funciona hoje e quebra no dia da troca — **e quebra calado**, porque quem
  responde é o 404 do GitHub, não um erro nosso. Com tudo relativo, o mesmo build
  serve os dois endereços sem uma linha alterada e a migração vira DNS mais um
  `CNAME`. Hoje a regra está cumprida: não há um caminho absoluto no `site/`.

  **E O DOWNLOAD SÓ EXISTE NO ANDROID.** O app é um `.apk`, e um `.apk` só
  instala em Android: quem chega de iPhone, iPad ou computador não vê o guia de
  instalação — vê, no MESMO ponto da página, uma frase dizendo que este é um
  aplicativo Android, que ele não serve computador nem iPhone/iPad, e que a
  página deve ser aberta por um aparelho Android. **O endereço não é repetido
  ali**: quem lê a frase já ESTÁ na página, e mandá-lo copiar o que acabou de
  abrir é trabalho para dizer o que ele já sabe. O resto da página fica: as
  funções, as telas e os modos de uso são verdade em qualquer aparelho, e uma
  página que se apaga inteira não explica nada a ninguém.

  **A PERGUNTA É BINÁRIA — é Android, ou não é.** Uma frase só serve os três
  casos, e por isso não há classificação de iOS: nem regex de `iPhone`, nem o
  `maxTouchPoints` que separaria o iPadOS 13+ (que se anuncia como
  **Macintosh**) de um Mac. Um aparelho da Apple cai no lado certo **por
  construção** — nenhum deles tem `Android` no `userAgent` —, e é isso que faz
  o desenho ficar mais robusto ao encolher: ele passou a depender só do
  positivo. *Uma armadilha some quando a pergunta que a criava deixa de ser
  feita.*

  **Três coisas sustentam isso, e a terceira é a que decide o desenho:**

  | peça | onde | por quê |
  |---|---|---|
  | a classificação | um `<script>` INLINE no `<head>`, que escreve `plat-android` ou `plat-outro` no `<html>` | esconder no `DOMContentLoaded` mostra o botão de baixar por um quadro antes de tirá-lo, e é exatamente aí que a pessoa toca |
  | o `display:none` | CSS, sobre `.so-android` (o guia **e** o tamanho do arquivo, que é atributo do download) | um link escondido assim sai da árvore de acessibilidade E da ordem de tabulação — não é um botão discreto, é um botão que não existe |
  | **a falha ABERTA** | a ausência de uma regra: sem classe no `<html>`, nada é escondido | script bloqueado ou uma exceção não prevista devolvem a página de antes. Falhar FECHADO inverteria o custo do erro para o lado que não se paga — um Android de verdade sem botão de baixar e sem nada na tela dizendo por quê |

  **`section + section` conta irmãos NO DOM, e um irmão `display:none` continua
  contando** — sem o `margin-top:0` do primeiro bloco VISÍVEL, o guia nasce com
  o vão de uma seção inteira sob a faixa da marca. Não erra alto: o que sai é um
  respiro grande demais, que ninguém relata e ninguém explica.

  O sinal de Android vem de DUAS fontes (`userAgent` e
  `userAgentData.platform`), a segunda ADITIVA: ela só pode resgatar um caso,
  nunca criar um. **O falso positivo conhecido está dito e não tem conserto
  barato:** um Android com "site para computador" ligado no Chrome perde a
  palavra `Android` do `userAgent` e cai no aviso — que continua sendo a
  instrução certa, só que redundante. Oráculo: `plataforma.test.mjs`, com os
  `userAgent` VERBATIM (o iPad entre eles, sem código próprio: a asserção
  guarda a PROPRIEDADE, não o mecanismo) e a falha aberta em asserção própria.

### Código

- **Nunca perder funcionalidades ao refatorar.** A base web tem o sistema de
  culto inteiro — ver `docs/ARQUITETURA-WEB.md` e os capítulos em `docs/arquitetura/`.
- **Todo código novo em `assets/web/` continua rodando no navegador**: caminhos
  nativos entram como `if (!window.__NATIVE__) { …web… }`.
- **Toda operação IDB multi-passo que precise de atomicidade usa `storeTx()`.**
  Para uma chave de `state`, o pronto é **`AVDB.updateState(chave, fn)`** — ler,
  calcular e gravar numa transação só, com `fn` **síncrona** (um `await` lá
  dentro deixa a transação fechar sozinha e a atomicidade some em silêncio). O
  par `getState` + calcular + `setState` é o defeito, não o atalho: duas
  transações com um vão entre elas, e quem lê primeiro grava por último. Já
  mordeu duas vezes — o diário da varredura das séries (metade do bloco do
  Registro sumia) e as intenções de download (o vídeo não era reclamado depois
  de o renderer morrer). O sintoma dos dois é a AUSÊNCIA de sintoma.
- **Ao mudar a superfície da ponte, subir `SHELL_VERSION` e atualizar a seção "A
  ponte".**
- **Cor nova entra em `shared/tokens.css`**, nunca literal na folha do app — e
  nunca branco pleno fora do palco.
- **Sem dependências externas** — Kotlin puro + AndroidX no shell, JavaScript
  puro no web. **Quatro exceções, todas declaradas:**

  | dependência | por que é inevitável |
  |---|---|
  | **`@aiden0z/pptx-renderer`** (`assets/web/vendor/`, Apache-2.0, `import()` dinâmico) | o Android **não desenha PowerPoint**: a plataforma só traz o `PdfRenderer`, as libs nativas são comerciais ou limitadas a 3 páginas, converter num servidor mandaria o material do culto para fora do aparelho, e escrever DrawingML à mão daria um slide PARECIDO com o que o pastor montou — pior que slide nenhum. Levantamento completo no `LEIA-ME.md` da pasta |
  | **`NewPipeExtractor`** | extrair a URL de um vídeo do YouTube é acompanhar as defesas deles (PO Tokens por vídeo, assinados por BotGuard/DroidGuard). A alternativa sem dependência — servidor público — FALHOU em aparelho: eles rodam em IP de datacenter, exatamente o que o YouTube bloqueia. E a conta é paga por quem publica: o SABR que derrubou o 1080p foi resolvido lá (cliente visionOS) e chegou aqui como **um bump de versão**. Manter o pin explícito e ler o CHANGELOG antes de reescrever extração à mão |
  | **JUnit** (`testImplementation`) | **não põe um byte no APK**. Existe porque o servidor das telas é **a primeira fronteira de rede do projeto** — um parser HTTP com controle de acesso, onde um erro não vira pixel errado, vira controle de acesso quebrado. Escrevê-lo sem oráculo, num repositório que recusa o RFC 6455 **por falta de oráculo**, seria o argumento aplicado contra ele mesmo |
| **Playwright** (`package.json`, `devDependencies`) | **também não põe um byte no APK** — é o arnês dos oráculos de Chromium, e a única forma de exercitar o que só existe RENDERIZADO (contraste, escada de camadas, hit-test, o telão de verdade). Ele já era usado; o que mudou é que passou a ser **declarado e PINADO**: o `package.json` e o `package-lock.json` são versionados e o CI usa `npm ci`. Sem o pin, o passo instalava a `latest` do dia e o veredito do CI não era função só do nosso código — o que tornava impossível o passo BARRAR o build, e desde a v5.316 ele barra. **Subir o pin obriga a repetir a campanha de determinismo** (ver "Um oráculo não pode medir o runner") |

  Uma quinta exceção precisa da mesma justificativa: um problema que não se
  resolve de outro jeito, e a manutenção paga por quem publica a biblioteca.

### Diagnóstico

- **Kotlin devolve JSON; quem monta a FRASE é o `controle.js`.** É a invariante 5,
  e no espelho é o que mantém a sanitização do texto vindo da rede num ponto só.
  Um arquivo Kotlin que formata parágrafos é UI escrita do lado errado.
  Corolário: **toda linha do bloco é opcional** — o que o shell não souber
  responder não aparece, nunca "undefined" num log que vai ser repassado.
- **O diagnóstico é UM só, e mora no "Registro" de Configurações.** Diagnóstico
  novo entra como mais um BLOCO ali, nunca como faixa nova em outro canto.
  **NÃO HÁ VISOR:** o `<pre>` saiu na v5.207, e desde então o Registro existe só
  para ser COPIADO e lido num computador. Isso muda o que é caro: **comprimento
  não custa tela nenhuma — o que custa é ENTERRAR**. Daí a linha do tempo ter
  parado de truncar (ela descartava até 84 das 100 linhas que já estavam na mão,
  incluindo as 60 que o `diag-ask` foi buscar no telão) e o que encurta ser o
  colapso da repetição CONSECUTIVA (`visibilidade ×7`), que não apaga nada.
  **E daí a ORDEM importar:** a linha do tempo vem logo depois do cabeçalho e
  ANTES de todo bloco de verificação por recurso — ela era o último dos oito, e
  num Registro real começava na linha ~150. Bloco novo entra DEPOIS dela.
  **E ela é MONTADA NA HORA DE DESENHAR** (v1.2.7), nunca guardada pronta: o anel
  do celular continua crescendo depois do último `diag-dump`, e continua
  crescendo mesmo SEM TELÃO — caso em que o `diag-ask` nem chega a sair.
  Montá-la no `juntarDiag` congelava a lista no instante da última resposta do
  telão, e ela seguia parecendo completa.
- **O REGISTRO É SOBRE O CULTO, não sobre o catálogo** (v1.1.19). Ele responde a
  quatro perguntas, e é por elas que se decide o que entra: *o que eu toquei
  antes disso?* (ações do operador) · *quando a conexão mudou?* (TV e telas, em
  TRANSIÇÕES — o cabeçalho já diz o estado AGORA) · *o que quebrou?*
  (estabilidade) · *quem eu sou?* (o cabeçalho). Uma varredura de catálogo
  responde a uma quinta pergunta, de quem AJUSTA A REGRA meses depois — ela cabe,
  resumida, mas não pode empurrar as outras quatro para baixo.
- **Um bloco guarda o VEREDITO, nunca uma segunda opinião.** O texto sai da MESMA
  função que decidiu (`AVSerie.avaliarPlaylist` devolve `{ mes, motivo }`, e
  `mesDaPlaylist` é a metade dela que a regra usa). Uma segunda escrita das
  mesmas perguntas envelhece à parte no primeiro ajuste, e o que sai é **um log
  que discorda do aparelho** — o pior artefato que este projeto sabe produzir,
  porque é lido A DISTÂNCIA por quem não tem como conferir. **E registra o dado
  CRU:** um rótulo já formado prova que a regra rodou; só a entrada dela diz por
  que ela produziu aquilo.
- **Todo campo de LOG nasce com um botão de copiar** (`.log-head` + `.log-copy`
  sobre a `.diag-box` — ver `copiarTexto`). Sem ele a alternativa é transcrever
  números à mão ou fotografar a tela.

### Documentação

Esta documentação é lida por um agente, a cada sessão, **antes** de qualquer
trabalho. Prosa custa contexto que não sobra para o código.

- **Aqui entra o que VALE HOJE; em `docs/HISTORICO.md`, o que explica POR QUÊ.**
  Ao publicar, a nota do lote vai para lá (topo + uma linha no índice). Neste
  arquivo só se mexe quando uma REGRA muda — e então **corrija a regra**, não
  acrescente um parágrafo dizendo que ela mudou.
- **Regra e armadilha ficam; a narrativa do achado sai.** Vale escrever "o
  `optBoolean` lê ausente como `false`, que é valor legítimo" — isso muda o
  próximo diff. Não vale escrever como o defeito foi encontrado, quem relatou,
  nem o que se pensou antes.
- **Uma medição que sustenta uma decisão fica** (`2,73:1`, `60 req/hora`); uma
  medição de algo já corrigido vai para o histórico.
- **Nada de lápide dentro do código.** Comentário descreve o que está ali — se
  ele explica um mecanismo removido, ou contradiz o código, é armadilha: quem o
  ler vai procurar (ou reintroduzir) o que ele promete.
- **Prefira tabela a lista, e lista a parágrafo.** Prefira o nome do símbolo a
  descrevê-lo por extenso.
- **APAGAR CÓDIGO É APAGAR O QUE O DESCREVE, NO MESMO LOTE.** Esta é a regra
  que a limpeza da v5.299/v5.300 comprou caro: cada remoção de recurso (v5.156,
  v5.187, v5.189, v5.212) deixou comentários de pé, e eles não envelheceram
  calados — passaram a AFIRMAR coisas falsas. Duas guardas de segurança
  justificavam a si mesmas por um motivo que já não existia, o que é o convite
  exato para o próximo leitor removê-las. **Um comentário errado é pior que um
  comentário longo: ele não custa só leitura, produz a decisão errada.** Ao tirar
  um recurso, `grep` pelo nome dele em `assets/web/` e `java/` **e** nos
  capítulos de `docs/arquitetura/` antes de fechar o lote.
- **O que nasce hoje nasce no padrão.** Comentário novo entra condensado — não
  se escreve largo esperando uma poda futura, porque a poda custa uma sessão
  inteira e a escrita custa uma linha.

**Ao atualizar o código:** atualizar este arquivo se a mudança afetar
arquitetura, protocolo de comandos ou a ponte; o CAPÍTULO certo de
`docs/arquitetura/` se afetar a arquitetura de `assets/web/`.

**`docs/ARQUITETURA-WEB.md` é HUB, e não recebe corpo.** Ali ficam as regras que
valem para a base inteira, a estrutura de arquivos, o build e a TABELA que diz
qual capítulo abrir. Assunto novo grande é **arquivo novo** em `docs/arquitetura/`
mais uma linha na tabela — nunca uma seção a mais no hub, que é o formato de que
ele acabou de sair (um arquivo de 490 KB em que uma pergunta sobre a Bíblia
custava carregar o Controle inteiro).

**Poda de comentário se PROVA, não se confere de olho — e são DUAS provas.**

1. **O código não mudou.** Remova os comentários dos dois lados, normalize o
   espaço em branco e compare com `git show <ref>:<arquivo>`. É a defesa contra
   apagar uma linha de código junto com o parágrafo que a explicava — e ela
   também prova, no fim do lote, que um lote de documentação é **só web** e não
   precisa de Release.
2. **Cada comentário continua sobre o que ele explica.**
   `node tools/pares-de-comentario.mjs <arquivo> <ref>` casa os blocos pelo
   cabeçalho e reprova quando um deles passou a encabeçar outro símbolo.

**A prova 1 é CEGA à troca de lugar, e por isso a 2 existe.** Remover os
comentários dos dois lados e comparar aprova uma **rotação completa** dos
blocos: foi o que a v5.300 fez com o `display.js` (commits `4ed5061` e
`da615b8`), onde oito blocos andaram uma casa e cada um passou a explicar a
função errada — o bloco do relógio da origem foi parar dentro do
`telaAplicarWallpaper`, e o da pré-carga do wallpaper, sobre o `agoraDaOrigem`.
As duas mensagens de commit afirmavam "código inalterado (verificado por remoção
de comentários contra HEAD)", e estavam certas: o método é que não via.

**Um comentário no lugar errado é pior que um comentário removido: ele responde,
e responde errado.**

### O NÚMERO: `MAIOR.INCREMENTAL.CORREÇÃO`

Três componentes, e cada um responde a uma pergunta diferente. **Nunca se sobe
um degrau "porque já mudou bastante": sobe-se o degrau que o LOTE justifica.**

| degrau | quando sobe | exemplo |
|---|---|---|
| **MAIOR** (`1`.x.y) | **só sob mudança fundamental de CONCEITO**, e por decisão explícita de quem publica. Não é acúmulo de recursos — é o app deixar de ser o que era | `1.x.y` → `2.0.0` |
| **INCREMENTAL** (x.`2`.y) | uma **seção inteiramente nova** do app: um lugar que não existia, com tela e fluxo próprios | `1.0.7` → `1.1.0` |
| **CORREÇÃO** (x.y.`3`) | correções e ajustes menores — o caso NORMAL, e o que a maioria dos lotes é | `1.0` → `1.0.1` |

**Ao subir um degrau, os de baixo ZERAM:** depois de `1.4.9`, uma seção nova é
`1.5.0`, nunca `1.5.9`. Um número que não zera passa a contar duas coisas ao
mesmo tempo e deixa de responder qualquer uma delas.

**ARMADILHA MEDIDA: `1.1` e `1.1.0` são a MESMA versão** para o OTA, e vale para
todo número de DOIS componentes. O `compareVersions` completa com zero o que
falta, então republicar a `1.1` como `1.1.0` não é atualização nenhuma — o
aparelho ignora, em silêncio. **O primeiro degrau depois de um número de dois
componentes é o `.1`**: depois da `1.0` veio a `1.0.1`, e depois da `1.1` vem a
`1.1.1`.

> A comparação é **numérica por componente**, nunca lexical: `1.0.10` é MAIOR que
> `1.0.9`. É o mesmo motivo pelo qual `4.9 < 4.82` como string seria errado — a
> regra vale para os três degraus.

**As DUAS LINHAS usam o mesmo número, e podem ficar em degraus diferentes.** A
base web sobe a cada lote (chega por OTA em minutos); o APK só sobe quando um
lote exige Release. Um `Web v1.0.7 · Shell v1.0.3` no rodapé não é divergência —
é a resposta exata a *"o OTA chegou e o APK ainda não?"*, que é para isso que o
rodapé mostra os dois.

### A versão mora em TRÊS lugares, e os três precisam andar juntos

| Onde | O quê | Para quê |
|---|---|---|
| `assets/web/version.json` | `"version"` | **faz a atualização chegar aos aparelhos**: o OTA compara este campo (`compareVersions`) e ignora, em silêncio, um bundle cuja versão não seja maior que a instalada |
| `controle/controle.js` | `WEB_VERSION` | **é o que a UI mostra**: `renderVersionLabel()` sobrescreve o span do rodapé na carga |
| `controle/index.html` | `<span id="appVersion">` | o que aparece antes do primeiro render — e a única versão visível num shell sem `appVersion()` |

Esquecer o `WEB_VERSION` é o erro **silencioso** (o bundle novo chega e o
aparelho exibe a versão antiga, justamente a leitura que serve para diagnosticar
se o OTA chegou); esquecer o `version.json` é o erro **mudo** do outro lado (nada
chega a aparelho nenhum). O `versionCode`/`versionName` do APK vêm do CI.

**Versão atual: v1.4.9** (base web) · **v1.4.5** (APK) · `SHELL_VERSION` **60** · bundle com
`minShell: 60` — o shell 60 é o **PISO**: todo método da ponte existe, e não há
guarda de versão no lado web. O que continua valendo é que `java/`, `res/`, o
manifest e os workflows **só chegam instalando o APK**.

### Onde procurar

| pergunta | onde |
|---|---|
| como isto funciona? | aqui, ou o capítulo certo de `docs/arquitetura/` (mapa em `docs/ARQUITETURA-WEB.md`) |
| por que é assim? / já foi tentado? / foi revogado? | `grep -n "<termo>" docs/HISTORICO.md` |
| o contrato do telão nas telas da rede | `docs/TELAO-POR-COMANDOS.md` |
| o banco de hinos e Bíblia | `docs/FONTE-DE-DADOS-LOUVORJA.md` |
