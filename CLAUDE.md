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

**Este arquivo é o NÚCLEO: o que vale para QUALQUER tarefa.** O detalhe de cada
recurso mora num capítulo, alcançável por esta tabela — a divisão é de
2026-09-07, e a razão é aritmética: o arquivo era lido INTEIRO em toda sessão,
antes de qualquer trabalho, e 70% dele descrevia recursos que aquela sessão não
ia tocar.

| # | seção | quando abrir |
|---|---|---|
| 1 | [O ganho: Presentation em vez de espelhamento](#o-ganho-presentation-em-vez-de-espelhamento) | o modelo em uma tela |
| 2 | [Estrutura do repositório](#estrutura-do-repositório) | achar o arquivo |
| 3 | [Invariantes do shell](#invariantes-do-shell-não-quebrar) | **antes de mexer no Kotlin** |
| 4 | [A ponte `window.AVNative`](#a-ponte-windowavnative) | usar ou mudar um método nativo |
| 5 | [Barramento de comandos](#barramento-de-comandos-e-o-plano-b-do-broadcastchannel) | comandos, dreno do papel `tela`, referência de tempo |
| 6 | [OTA da base web](#ota-da-base-web-atualização-sem-apk) | publicar, watchdog de boot, detecção |
| 7 | [Telão por comandos](#telão-por-comandos-o-telão-nas-telas-da-rede-local) | as telas da rede local |
| 8 | [A abertura por trás dos panos](#a-abertura-por-trás-dos-panos) | a cortina, o tema no primeiro quadro |
| 9 | [A paleta](#a-paleta) | **antes de escrever qualquer cor** (as regras duras; o raciocínio está no capítulo) |
| 10 | [Divergências web × nativo](#divergências-entre-o-caminho-web-e-o-nativo) | o que muda entre navegador e app |
| 11 | [Build e distribuição](#build-e-distribuição) | CI, o portão, assinatura, backup |
| 12 | [Regras de desenvolvimento](#regras-de-desenvolvimento) | **antes de commitar** |

**Os RESUMOS destes quatro ficam aqui; o detalhe está no capítulo** — o resumo
tem o que se pode quebrar sem abrir o capítulo, e o capítulo tem o resto:

| assunto | resumo | capítulo |
|---|---|---|
| download minimizado, `SyncService`, notificação de progresso | [§](#trabalho-em-segundo-plano-downloads-com-o-app-minimizado) | [`docs/shell/SEGUNDO-PLANO.md`](docs/shell/SEGUNDO-PLANO.md) |
| `MediaSession`, transporte fora do app | [§](#notificação-de-controles-sessão-de-mídia) | [`docs/shell/SESSAO-DE-MIDIA.md`](docs/shell/SESSAO-DE-MIDIA.md) |
| os álbuns oficiais da Biblioteca | [§](#séries-do-youtube-os-álbuns-oficiais-da-biblioteca) | [`docs/recursos/SERIES.md`](docs/recursos/SERIES.md) |
| acordes sobre a letra, sob demanda | [§](#a-aba-de-cifra-acordes-ao-lado-da-letra) | [`docs/recursos/CIFRA.md`](docs/recursos/CIFRA.md) |
| o acervo num arquivo `.avpkg` | [§](#o-pacote-de-transferência-o-acervo-num-arquivo) | [`docs/recursos/PACOTE.md`](docs/recursos/PACOTE.md) |
| cada par de cor medido, os pisos, o que foi revogado | [§](#a-paleta) | [`docs/arquitetura/DESIGN-SYSTEM.md`](docs/arquitetura/DESIGN-SYSTEM.md) |
| o catálogo dos 63 métodos da ponte, um a um | [§](#a-ponte-windowavnative) | [`docs/shell/PONTE.md`](docs/shell/PONTE.md) |
| os dois canais, a detecção, o watchdog, a pergunta | [§](#ota-da-base-web-atualização-sem-apk) | [`docs/shell/OTA.md`](docs/shell/OTA.md) |
| o que cada oráculo trava | (o MÉTODO fica em [Build](#build-e-distribuição)) | [`docs/ORACULOS.md`](docs/ORACULOS.md) |

**Os CAPÍTULOS** (o detalhe que o resumo aponta): `docs/recursos/CIFRA.md`,
`docs/recursos/PACOTE.md`, `docs/recursos/SERIES.md`,
`docs/shell/SEGUNDO-PLANO.md`, `docs/shell/SESSAO-DE-MIDIA.md` e
`docs/ORACULOS.md` (o que cada oráculo trava — REFERÊNCIA, aberta por pergunta).

**Fora daqui:** `docs/ACHADOS-EM-ABERTO.md` (os defeitos CONFIRMADOS e ainda não
corrigidos, com cenário e correção proposta — **leia antes de mexer no que ele
nomeia**; hoje tem QUATRO — os dois do áudio do espelhamento, o CLIENTE de onde
sai a escada da transmissão, e a faixa de álbum que nunca é marcada como NO AR
—, e é arquivo para esvaziar, não para crescer),
`docs/shell/README.md`
(o HUB do **Kotlin**: um capítulo por
subsistema do shell, mais a tabela que diz onde cada um dos 32 arquivos é
explicado), `docs/ARQUITETURA-WEB.md` (o HUB da base web: regras gerais e o
mapa dos capítulos em `docs/arquitetura/`), `docs/TELAO-POR-COMANDOS.md`
(o contrato das telas da rede — inclusive o celular como PONTO DE ACESSO, que
saiu do plano e virou código na v1.4.1), `docs/FONTE-DE-DADOS-LOUVORJA.md` (hinos/Bíblia)
, `docs/MEDICAO-DE-ALCANCE.md` (o CONTRATO da contagem de uso — o que é contado,
o que nunca é, por que o uso próprio sai por construção, e a MEDIÇÃO ainda
pendente de que o farol depende), `docs/HISTORICO.md`
(**apêndice**: a nota de cada versão, para consultar por `grep`, nunca por
leitura integral), `docs/AUDITORIA-2026-08.md` (**apêndice**: a varredura de
~60.000 linhas da v1.4, com os 75 achados, o método de refutação e os 26 que
ficaram por aplicar — consultar por `grep`) e
`docs/AUDITORIA-ESTABILIDADE-AV.md` (**apêndice**: a varredura de 2026-08-29
focada em ESTABILIDADE — o que pode interromper a transmissão ou a mídia no ar:
dez achados, cada um com cenário, correção proposta e ressalva; um deles é
MEDIÇÃO, não conserto) e `docs/AUDITORIA-EFICIENCIA-2026-09.md` (o custo de
MANTER o repositório, não a qualidade do que ele produz: nove achados medidos
sobre contexto, retrabalho, rito de entrega e CI — o nº 1 é este arquivo, que
cresceu 23% em sete dias e é lido inteiro em toda sessão. **A refutação rodou
depois**: dois achados caíram, dois encolheram de magnitude e quatro novos
entraram — um deles o ÚNICO da auditoria que toca o culto. A lista dos MORTOS,
com a razão de cada um, é o que economiza a sessão de quem for reachá-los).

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
│   │                            #    irmão dele, `shared/stage.css`, SAIU na
│   │                            #    v1.4.8 junto com o aro de espera do palco)
│   ├── espelho/tela.js          #   O TELÃO POR COMANDOS: a casca do papel
│   │                            #   `tela` sobre o próprio /display/ (SSE)
│   ├── controle/serie.js        #   as SÉRIES do YouTube: a REGRA que decide o
│   │                            #   que entra num álbum (PURA, com oráculo Node)
│   ├── controle/hinario.js      #   as SEÇÕES do Hinário 2022: a tabela que
│   │                            #   traduz NÚMERO em SEÇÃO (35 faixas, 8
│   │                            #   blocos). PURA, com oráculo Node. O banco
│   │                            #   NÃO tem esse campo — o que identifica a
│   │                            #   seção é a POSIÇÃO do hino
│   ├── controle/coletanea.js    #   as COLETÂNEAS: a leitura EDITORIAL do
│   │                            #   catálogo do banco — qual coletânea não tem
│   │                            #   independência e entra em outra. PURA, com
│   │                            #   oráculo Node. Aplicada na LEITURA: o
│   │                            #   catálogo cru continua cru no aparelho
│   ├── controle/cifra.js        #   a CIFRA: a REGRA que lê uma página de cifra
│   │                            #   (slug, folha, transposição). PURA, com
│   │                            #   oráculo Node. Sob demanda: NADA é guardado
│   ├── controle/sorteio.js      #   a PLAYLIST AUTOMÁTICA: a REGRA que decide o
│   │                            #   que pode ser sorteado (PURA, capacidades
│   │                            #   injetadas, com oráculo Node). "Sem infantis"
│   │                            #   (508–557 do Hinário 2022) é o ÚNICO filtro
│   │                            #   que nasce LIGADO — daí o `!== false`
│   ├── controle/pacote.js       #   o PACOTE DE TRANSFERÊNCIA: a regra de como
│   │                            #   o acervo de um aparelho vira UM arquivo e
│   │                            #   volta noutro. PURA, com oráculo Node — os
│   │                            #   bytes não passam por aqui; quem os move é o
│   │                            #   `controle.js`, pelo canal `__avPacote`
│   ├── controle/pptxzip.js      #   o ZIP de um `.pptx` lido por FATIAS: é ele
│   │                            #   que faz uma apresentação de centenas de MB
│   │                            #   caber, tirando os vídeos embutidos ANTES de
│   │                            #   o renderizador abrir o arquivo. PURO, com
│   │                            #   oráculo Node. Nada é recomprimido
│   ├── controle/deck.js         #   a APRESENTAÇÃO EM IMAGENS: o `.pptx` desenhado
│   │                            #   dentro do WebView (`AVDeck`), com oráculo em
│   │                            #   Chromium. As três coisas que o
│   │                            #   `<foreignObject>` NÃO alcança — a mídia
│   │                            #   `blob:`, os pixels de um `<canvas>`, a fonte
│   │                            #   de símbolo — e o FORMATO de cada página
│   ├── controle/                #   (sem sw.js / manifest / icons — ver abaixo)
│   └── display/                 #   (idem)
├── java/br/org/iasd/av/
│   ├── MainActivity.kt          # Activity + WebView do Controle + Presentation + voltar/volume/cast
│   ├── StagePresentation.kt     # Presentation + WebView do Display (o telão)
│   ├── WebViewFactory.kt        # asset loader + settings comuns (invariantes 1-4)
│   ├── NativeBridge.kt          # @JavascriptInterface — a ponte
│   ├── SafPathHandler.kt        # serve arquivos do dispositivo em /saf/<token>
│   │                           #   + SafJanela: `?r=<ini>-<fim>`, a fatia
│   │                           #   que tira o teto de 2 GB do `available()`
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
│   ├── PacoteProvider.kt        # o FileProvider do PACOTE — subclasse VAZIA, e
│   │                            #   ela É a correção do "0 KB": duas autoridades
│   │                            #   sobre a MESMA classe compartilham a instância
│   │                            #   (e a tabela de caminhos) da primeira
│   ├── PacoteCanal.kt           # o canal de ArrayBuffer web→SAF do PACOTE DE
│   │                            #   TRANSFERÊNCIA — o SEGUNDO do shell, irmão
│   │                            #   do EspelhoMidiaCanal e com as mesmas três
│   │                            #   guardas. Ele só carrega BYTES: abrir e
│   │                            #   fechar o destino envolve uma PESSOA no
│   │                            #   seletor do sistema, e isso entra pela ponte
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
├── ORACULOS.md                  # o que cada oráculo TRAVA, e como aquele defeito
│                                #   falha calado. REFERÊNCIA: abra por pergunta,
│                                #   nunca inteiro. O MÉTODO fica no CLAUDE.md
├── recursos/                    # o DETALHE do que o núcleo resume (a faxina 2026-09-07)
│   ├── CIFRA.md                 #   a aba de cifra: cadeia de busca, transposição, rolagem
│   ├── PACOTE.md                #   o `.avpkg`: formato, folha de grupos, importação
│   └── SERIES.md                #   as sete armadilhas da nomenclatura, o Registro da regra
├── shell/                       # HUB do KOTLIN + um capítulo por subsistema
│   ├── README.md                #   o mapa: qual capítulo abrir, e onde cada .kt mora
│   ├── PONTE.md                 #   AVNative campo a campo, SHELL_VERSION, as 4 filas
│   ├── SEGUNDO-PLANO.md         #   SyncService, wake lock, a notificação de progresso
│   ├── SESSAO-DE-MIDIA.md       #   MediaSession: transporte, estado, ciclo de vida
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
├── AUDITORIA-ESTABILIDADE-AV.md # APÊNDICE: o que pode INTERROMPER áudio/vídeo
└── ESPELHO-DE-PIXELS.md         # ARQUIVO: recurso removido (v5.187); só §2.3, §2.4 e §10-A
```

**32 arquivos Kotlin, uma dependência de terceiros no shell** — o resto é
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
- **E AS TELAS DA REDE TÊM O IRMÃO DISSO** (v1.4.19): `telasDaRede()` exige
  `pronta` — o `__de` do `display-ready` tendo voltado, isto é, o `/display/`
  daquela tela subiu e se anunciou. Entre o `POST /par` (que já cria a sessão e
  o fio) e esse anúncio a tela não projeta nada, e sem TV a tela É a projeção:
  o celular ficava mudo com ninguém tocando do outro lado. **A janela do socket
  MORTO continua aberta** e está dita — um navegador que dorme sem FIN segura o
  mudo até a escrita falhar (o vigia corta em 20 s).
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

**O CATÁLOGO dos 63 métodos, um a um, está em
[`docs/shell/PONTE.md`](docs/shell/PONTE.md)** — é referência, aberta por
método. Aqui ficam as REGRAS, que valem para todos eles.

**Quatro globais lidas direto, sem Promise:** `window.__NATIVE__`, `__AV_ROLE__`
(`'controle'`/`'display'`; o terceiro valor, `'tela'`, é escrito por
`espelho/tela.js`, não pela ponte), `__SHELL_VERSION__` (o inteiro do contrato) e
`__SHELL_NAME__` (o `versionName` do APK, que **não** se confunde com o
anterior: base web e shell atualizam por caminhos independentes). Desde a v1.7.0
o `__SHELL_NAME__` não aparece na tela — quem o mostra é o REGISTRO.

**Princípio: a ponte entrega URLs SERVÍVEIS, não bytes.** Arquivos do aparelho e
compartilhamentos chegam como `https://appassets.androidplatform.net/saf/<token>`
e o web usa `fetch()` + `Blob` como já faz com o OPFS — nenhuma função de
importação precisou ser reescrita, e **um vídeo de 2 GB nunca passa por base64**.

O token (`SafRegistry`, em `SafPathHandler.kt`) é **opaco** (não o URI
codificado: um `content://` com barras viraria segmentos de rota),
**aleatório** (128 bits, `SecureRandom` — as entradas nunca expiram) e **é uma
URL `https://` do MESMO origin da base**: quem recebe uma delas e pergunta
`origem.startsWith("https://")` para decidir "é da rede ou é local?" manda
**todo arquivo do aparelho** para o caminho de download — foi o que deixou o PDF
quebrado da v5.97 à v5.99, indistinguível de "PDF com senha". A pergunta certa é
pelo **host** (invariante 2). **O mesmo URI devolve sempre o mesmo token**, senão
cada `listFolder` de uma pasta de 500 arquivos acrescentaria 500 entradas a cada
re-sincronização, num processo mantido vivo durante todo o culto.

**Superfície nativa é privilégio do Controle.** O WebView do telão recebe a
ponte com `host = null` e o loader dele é montado **sem** o handler `/saf/` —
ver a invariante 9. `listFolder` honra a mesma regra e devolve lista vazia sem
host: era a exceção, porque lê o `ContentResolver` direto, e sem a guarda
qualquer script no documento do Display lia o índice inteiro de toda pasta
concedida.

**As Promises têm época por carregamento.** O id é `EPOCH + ':' + seq`, com
`EPOCH` aleatório a cada carga: o renderer pode morrer com uma chamada em voo, a
página recarrega, o contador volta a zero — e com ids "1", "2", "3" a resposta
atrasada da página velha resolvia a promise homônima da NOVA. Chamadas que
dependem de **máquina** têm prazo de 60 s; `pickFolder` e `requestMic` esperam
uma **pessoa** e ficam sem prazo.

São **63 métodos**, e essa é a superfície inteira que o resto do lado web tem
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
atualizam por caminhos independentes). **Desde a v1.7.0 o `__SHELL_NAME__` NÃO
aparece na tela**: quem o mostra é o REGISTRO, e a UI diz um número só — ver a
badge de versão. Sem `appVersion()` a string vem vazia, e o Registro cai em só a
versão web.

> **O ÚNICO MÉTODO QUE JÁ SAIU** é o `farolContar` (shell 61, v1.4.42) — a chave
> "este aparelho entra na contagem", descartada a pedido do operador:
> *"descarte a opção de contagem de uso como opcional, deixe sempre ativo, não
> preciso do sistema de exclusividade"*. Ele é o caso de ENCOLHER a ponte que a
> regra abaixo descreve, e foi entregue como ela manda: APK + web no mesmo lote,
> com `shellTag` segurando o bundle até a Release existir. O que sobra da
> medição é uma exclusão sem chave nenhuma — o build debuggável, que acende num
> contador separado por construção (`Farol.contar`).

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

Hoje vale **72**, e ele é o **PISO**: o bundle declara `minShell: 72`, então
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

> A tabela dos 72 degraus está em `docs/HISTORICO.md` — ela é história do
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

**O bundle declara `minShell` IGUAL ao `SHELL_VERSION`, e é a VÁLVULA que
resolve.** Um bundle que
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

Minimizado, o Android pode **congelar** o processo — a sincronização de hinos,
Bíblia ou pastas parava no meio. **Detalhe em
[`docs/shell/SEGUNDO-PLANO.md`](docs/shell/SEGUNDO-PLANO.md)** — abra antes de
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

## Notificação de controles (sessão de mídia)

O `SessionService.kt` publica um `MediaSession` e uma notificação `MediaStyle`.
**Detalhe em [`docs/shell/SESSAO-DE-MIDIA.md`](docs/shell/SESSAO-DE-MIDIA.md)** —
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

## OTA da base web (atualização sem APK)

O job `web-ota` (todo push em `main`) empacota `assets/web/` num
`web-<versão>.zip` e publica, com um `version.json`, na release de tag fixa
**`web-latest`** — URL estável porque está compilada no shell. O app consulta o
manifesto, baixa quando há versão nova e passa a servi-la.

**O mecanismo inteiro — os dois canais como UM evento, a detecção por quatro
gatilhos, a pergunta que DIZ o que vem, o watchdog de boot e as defesas do
download — está em [`docs/shell/OTA.md`](docs/shell/OTA.md).** Abra-o antes de
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
- **O nome do repositório aparece nos DOIS lados e eles têm de bater** — o
  workflow usa `$GITHUB_REPOSITORY`, e `WebUpdater.REPO` é digitado à mão.
  Renomear o repositório exige mexer nessa constante **e** publicar um APK.

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

## Séries do YouTube (os álbuns oficiais da Biblioteca)

Um canal que publica **um episódio por semana** e organiza o ano em playlists
vira um **álbum da Biblioteca**. São duas hoje (Provai e Vede, Informativo
Mundial das Missões). **Detalhe em
[`docs/recursos/SERIES.md`](docs/recursos/SERIES.md)** — abra antes de mexer no
`controle/serie.js` ou no catálogo de séries.

O que vale sem abrir o capítulo:

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

## A aba de cifra (acordes ao lado da letra)

A folha de letra do Controle tem uma terceira fonte, ao lado de *Letra* e
*Bíblia*: a **cifra** do hino em cena. **Detalhe em
[`docs/recursos/CIFRA.md`](docs/recursos/CIFRA.md)** — abra antes de mexer no
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

## O pacote de transferência (o acervo num arquivo)

A biblioteca inteira de um aparelho — mídia, arquivos do OPFS, catálogos — num
`.avpkg`, para entrar noutro celular por cabo, Bluetooth ou cartão. **Detalhe em
[`docs/recursos/PACOTE.md`](docs/recursos/PACOTE.md)** — abra antes de mexer no
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

## A abertura por trás dos panos

O app piscava ao abrir: o tema escuro aparecia antes do claro, o Modo Fácil
antes do avançado, a lista vazia antes do Cronograma. **O lado nativo já estava
certo** — `windowBackground`, a raiz da Activity e o próprio WebView nascem na
cor do tema guardado —; o que piscava era o DOCUMENTO, entre o primeiro quadro e
a última linha do `init()`.

- **O TEMA tem conserto próprio:** um `<script>` inline no `<head>` do
  `controle/index.html` lê `av.tema` e escreve `data-tema` ANTES do primeiro
  quadro. Ele é a **única** leitura daquela chave — o `storedTema()` do
  `controle.js` lê o ATRIBUTO que sai dali, porque uma segunda leitura seria a
  mesma regra escrita duas vezes.
- **O resto é a CORTINA** (`#splash`, primeiro filho do `<body>`): opaca, no
  topo da pilha, com o ícone do app e a marca, e ela levanta na última linha do
  `init()` que muda o que se vê (depois do `applyPvWallpaper`).
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

Oráculo: `abertura-e-transferencia.test.mjs`, com o cenário catastrófico medido
(o `controle.js` abortado pela rota, o tema já certo, a cortina levantando pelo
prazo) e o piso medido nas DUAS pontas com o relógio mockado — **em fatias**,
porque `fastForward` não reprocessa o temporizador que o callback agenda no meio
do salto, e **por leitura imediata**, porque o relógio instalado continua
andando com o tempo real e uma espera de 15 s cruzaria o teto de 12 s (foi assim
que a segunda asserção chegou a passar pelo motivo errado).

---

## A paleta

Mora em **`assets/web/shared/tokens.css`**, fonte única carregada pelos dois
`index.html` **antes** da folha do app. Ela é a **identidade oficial da IASD**,
em **DOIS TEMAS**, com o denim `#2F557F` (PMS 302) como núcleo.

**O raciocínio inteiro — cada par medido, os pisos, o que foi tentado e
revogado — está em
[`docs/arquitetura/DESIGN-SYSTEM.md`](docs/arquitetura/DESIGN-SYSTEM.md).**
Abra-o antes de mexer na hierarquia da Biblioteca, no feedback de toque ou na
escada de camadas. **As regras abaixo são as que se quebram sem abrir capítulo
nenhum**, e por isso ficam aqui.

- **Só COR entra em `tokens.css`.** Raio, escala de ícone, curva de toque e
  medidas de layout ficam no `:root` de `controle.css`.
- **Três blocos, nesta ordem:** `:root` com o que NÃO muda, `:root` com o tema
  ESCURO (o padrão, sem atributo) e `:root[data-tema="claro"]`. O claro é um
  **DELTA** — **um token que exista SÓ no claro não está definido no tema
  padrão**, e o `var()` computa para o valor inicial da propriedade, sem aviso.
  `tokens.test.mjs` trava isso.
- **O PALCO NÃO TEM TEMA.** `--stage-*`, `--wallpaper`, `--lyrics-frame-bg`, as
  sombras e o `--scrim` moram no bloco compartilhado — e a regra vale para as
  REGRAS, não só para os tokens: **nada pintado no palco pode ler um token
  redeclarado em `[data-tema]`**. O que a separação garante é a PREVIEW do
  Controle, que roda no documento que TEM tema e existe para ESPELHAR o telão.
- **NÃO HÁ CONTORNO EM LUGAR NENHUM**, e as quatro exceções são NOMEADAS uma a
  uma no oráculo (o aro que gira, o ✓ do seletor de destinos, o campo de busca
  da Biblioteca e a divisória entre faixas irmãs). **É o NOME que segura a
  lista** — ela não tem regra que a próxima borda possa alegar cumprir.
- **Nunca escrever branco literal.** Nenhum `#fff` como valor de cor em
  `controle.css`/`display.css`; as três exceções estão declaradas em
  `tokens.css` (o palco, o campo da playlist automática, o campo da busca).
- **Os fundos de ESTADO e as superfícies de AÇÃO são OPACOS** (`--sel-fill`,
  `--live-fill`, `--btn-accent`, `--btn-danger`…). Tinta com alfa EMPILHA: o
  mesmo botão derivava **1,97:1** entre a base mais escura e a mais clara em que
  pousa. Os `-soft` ficam para o que é wash de verdade.
- **UMA LINGUAGEM DE ESTADO SÓ:** ESCOLHIDO entre alternativas =
  `--accent-fill` + `--on-accent`; LIGADO (interruptor) = `--btn-accent` +
  `--accent`; SELECIONADO numa lista = `--sel-fill`; ABERTO **não é cor**.
  **Cor de texto nunca carrega estado sozinha**, e **apagado quer dizer
  INDISPONÍVEL** (`opacity: .3` + `disabled`), nunca "desligado".
- **E O QUE NÃO TEM FUNÇÃO AGORA É APAGADO, não deixado inerte** (v1.8.50).
  Inerte e apagado não são a mesma coisa: um botão aceso que não faz nada é
  indistinguível de um quebrado, e o que se faz diante dele é tocar de novo — a
  mesma troca de EXPLICAR por NÃO OFERECER que o microfone sem TV e a aba de
  cifra sem cifra já fazem. É `disabled` e não uma classe (é ele que veste o
  `--op-inativo`, tira o nó da tabulação e faz o navegador engolir o toque), com
  o `title` dizendo POR QUÊ. **A pergunta é a MESMA que a de quem executa** —
  reescrevê-la faz as duas divergirem no primeiro ajuste —, e ela pede cuidado:
  `cenaNoAr()` parece "há algo no ar" e começa por `!!currentId`, que sobrevive
  ao stop de propósito. **E o que NÃO se apaga entra na lista escrita ao lado**,
  senão o lote seguinte "completa" a varredura e leva um recurso junto (o ▶
  parado repete a faixa; a folha vazia é a resposta da playlist; a repetição é
  um modo).
- **O feedback de toque é `translateY(2px)` — recuo ABSOLUTO, nunca uma
  fração.** Uma fração aplicada a alvos de 34px a 408px não é um valor, são
  doze. **E um BLOCO que hospeda controles responde só com a LUZ**, nunca com
  geometria: um ancestral não responde ao toque que foi para um filho, e as
  guardas suprimem as DUAS partes (`transform` e `filter`). **Bloco novo que
  hospede controles entra na lista de guardas no MESMO lote em que nasce.**
- **A escada de camadas tem TRÊS degraus, e o quarto é o ESPAÇO.** A superfície
  AFUNDA dentro de um cartão (o overlay inverte de sinal), e **o tom de um bloco
  é decisão do PAI** (`--camada`) — quem a declara é o contêiner, nunca quem
  pinta. **Onde a árvore é mais funda que três, não se acrescenta degrau:
  ALTERNA-SE** (papel → poço → papel, a Biblioteca).
- **`res/values/colors.xml` espelha `--bg` à mão, em DOIS valores.** É o único
  lugar fora de `tokens.css` que carrega cor de fundo, e não tem escapatória:
  recurso de Android não enxerga custom property. O OTA troca a base sem trocar
  o APK — mudou o token, muda aqui. Desde a v1.8.32 a igualdade tem oráculo.
- **O ÍCONE DO APP é a paleta** e é VETOR (`minSdk` 26: o adaptativo é o único
  ícone que chega a ser desenhado). Ele **não segue o tema claro** — é desenhado
  pela gaveta do sistema com o app fechado.
- **O PADRÃO É O AUTOMÁTICO, e ele segue o APARELHO** (v1.8.49). São TRÊS
  estados — Automático → Claro → Escuro —, e o do meio é a **ausência** da chave
  `av.tema`: sem escolha guardada o app lê `prefers-color-scheme` (que no WebView
  responde pelo modo noturno do SISTEMA, não pelo tema desta Activity) e
  acompanha o aparelho **ao vivo**, porque o Android troca ao anoitecer e o culto
  de sábado à noite começa com o app aberto desde a tarde. **Uma escolha guardada
  vence sempre** — um app que a desfaz porque o sistema mudou é um app que não
  obedece. O tema EFETIVO viaja em `data-tema` e a ESCOLHA em `data-tema-escolha`,
  os dois escritos pelo script inline do `<head>`: é UMA leitura de `localStorage`
  no app inteiro, e os atributos são o carrier. Oráculo: as três metades no
  `smoke.mjs`, com o aparelho emulado — **o Chromium responde CLARO por padrão**,
  então um oráculo de cor que não declara de que tema partiu mede o padrão do
  navegador, não uma decisão deste app.

> **NÃO HÁ TESTE DE CONTRASTE ABSOLUTO.** Os números nos comentários de
> `tokens.css` são medições à mão, e os pares abaixo do piso estão declarados
> como tais ali mesmo. **Ao mexer num token, meça — e são DOIS temas.** O que o
> CI trava é outra coisa: `tokens.test.mjs` (o `var()` que aponta para token
> inexistente, o token só no claro, o contorno, a superfície com alfa, o
> `colors.xml` × `tokens.css`) e `smoke.mjs` (o efeito RENDERIZADO nos dois
> temas, o palco que não os segue, o degrau ENTRE níveis e a resposta ao toque).

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
| Link do YouTube compartilhado | vira item de LINK, que só o app resolve | avançado: as MESMAS quatro escolhas da busca (tocar · playlist · Cronograma · Favoritos + vídeo/só-áudio + teto). Simplificado: sem pergunta, **download e projeta** — ali o link É um "tocar agora" (era transmissão direta até a v1.7.2). Falhando: item de LINK, resolvido no toque seguinte (`resolverLinkYoutube`, que também baixa) — um link compartilhado nunca se perde |
| Destino de um item | uma escolha por vez | **VÁRIOS destinos de uma vez**, método único: toda opção da folha (as três listas **e** o "Tocar agora") é selecionável de corpo inteiro, e um confirmar sempre visível executa. Um vídeo do YouTube é baixado UMA vez para dois destinos. Importação e share abrem a mesma folha com o Cronograma já marcado; desistir entra no Cronograma. Ver `docs/ARQUITETURA-WEB.md`, "UM item, VÁRIOS destinos" |
| Onde o share aterrissa | idem (mesmo `importShare`) | **`focarImportado`**: fecha popups e seleção; projeta na hora no simplificado (item vai para a prateleira `avulsos`, que não tem lista visível) ou vai ao Cronograma no avançado. A preview em tela cheia só é encerrada se houver telão |
| Estado do telão (Configurações) | atalho `window.open('../display/')` | **indicador ao vivo**, desabilitado como botão |
| Botão de cast da preview | oculto | `AVNative.openCast()` → seletor de espelhamento (ver abaixo) |
| Retomada do telão ao reconectar | idem (`resendSceneToDisplay`) | **só reenvia o que ESTAVA no ar** — a pergunta é `midiaNoAr`, nunca `currentId` (que sobrevive ao stop de propósito, para o ▶ repetir a faixa). Telão vazio também é estado: restaurá-lo é não mandar nada |
| Girar a mídia | idem (comando `rotate`) | tile **"Girar no telão"** em Configurações, 90° por toque — o nome diz ONDE, porque "Girar" sozinho se lê como o giro da INTERFACE (v1.4.41). O motor TROCA O EIXO da caixa antes de girar, para o `object-fit` medir o retângulo em que a mídia vai de fato aparecer |
| Som da preview | com a janela do Display aberta é muda; sem ela toca (sujeito a autoplay) | **sem tela nenhuma conectada, o som sai DESTE aparelho** (`acertarSaidaDeAudio`). No avançado é DERIVADO da conexão (`simpleDisplay` = TV **ou** tela da rede); no Modo Fácil é ESCOLHA (`tocarNoCelular`, o "Tocar neste celular" da folha de conexão), porque lá o padrão é bloquear — escolha de IDA, sem persistência, que se rearma ao fechar o app, ao passar pelo avançado ou quando uma tela entra. Com qualquer tela conectada este aparelho fica mudo nos dois modos — os WebViews dividem o processo e a saída de áudio, e a preview roubava o foco do player do telão. **E PERDER a projeção com mídia no ar PAUSA a mídia** (v1.8.50): a promessa acima vale para quem ABRE o app sem tela, não para quem PERDE a tela com o louvor no ar — o estado final é o mesmo, a intenção não. A régua é a PERDA (escrita como estado, ela pausaria o ensaio de quem nunca conectou nada) e é a perda de um DESTINO — `haDestinoDeProjecao()`, que lê a tela LISTADA e as SESSÕES de tela da rede, e **não** `algumaTelaConectada()`, que responde pela `Presentation`: com aquela, a oscilação do dongle pausaria o louvor a cada piscada do Miracast, que é uma interrupção de culto no lugar de um vazamento de segundos |
| PDF · `.pptx` · Google Apresentações | **PDF não existe**; `.pptx` funciona pelo mesmo caminho do app | **uma IMAGEM POR PÁGINA**. PDF pelo `PdfRenderer` da plataforma (`SlideDeck.kt` + `deckPages`); `.pptx` pelo renderizador de `assets/web/vendor/` (`controle/deck.js`, `import()` dinâmico + `<foreignObject>`/canvas). Daí é mídia comum, com ⏮/⏭ passando página — **e uma CAMADA desde a v1.4.28**: com um áudio no ar, o toque na apresentação a sobrepõe em vez de substituir, pela mesma porta da imagem (`mode:'image'` com um `page`), e o louvor de fundo continua tocando por baixo dos slides. **O FORMATO de cada página é decidido por ela**, nos dois caminhos e pelo mesmo número (`PAGINA_LEVE`, 512 kB): PNG na página chapada, WebP na fotográfica — MEDIDO, uma apresentação de fundo fotográfico dá 100,4 MB em PNG contra 12,3 MB. **Não há botão de "apresentação"** — entra por "Importar arquivos" (`pickDoc`: o PDF precisa que o shell abra o ARQUIVO, e `<input type=file>` só devolve bytes) ou pelo share. `.ppt` legado e `.odp` ficam de fora: ninguém sabe desenhá-los **E O VÍDEO EMBUTIDO TOCA** (v1.6.2): o `pptxzip.js` o tira do zip ANTES de abrir o arquivo — sem isso um `.pptx` com vídeo é RECUSADO (teto de entrada da biblioteca) e, passando, sairia como retângulo PRETO (o `embutirRecursos` não alcança `<video>`). Ele vira mídia presa à PÁGINA em que estava: chegar nela projeta o vídeo, e o fim dele devolve a apresentação no slide SEGUINTE |
| **Tocar agora** de vídeo do YouTube | **não toca**, e a linha do item diz isso | **BAIXA E PROJETA** (v1.7.7): o mesmo `ytArquivo` dos outros destinos, com o cartão sobre a preview e a barra de progresso cobrindo a espera. Foi TRANSMISSÃO DIRETA da v5.212 à v1.7.2 — o `ytStream` montava o manifesto e o `mse.js` o virava um `<video>` —, e ela saiu a pedido do operador: *"vamos abandonar o modo online direto, ele é muito instável"*, depois de travamentos a cada um ou dois segundos com o espelhamento no ar. **O preço está aceito e é o que ela existia para evitar: "Tocar agora" agora ESPERA o download** |
| **Cifra do hino** | **não existe** — sem ponte não há como buscar a página (CORS), e a aba nem é oferecida | **aba CIFRA no visualizador de letras** (shell 49): `cifraHtml` traz o HTML cru, `controle/cifra.js` o lê, e a folha aparece com transposição por meio tom. **SÓ COM FOLHA NA MÃO** (v1.8.28): sem cifra achada o botão não é desenhado — `cifraCabe` decide se vale PROCURAR, `cifraTemFolha` decide se há o que MOSTRAR. **SOB DEMANDA:** nada é baixado em lote, nada entra no bundle, e fora do acervo guardado o cache é um `Map` que morre com o app |
| Vídeo do YouTube | **não toca** | **baixado PELO APARELHO** (`YoutubeGrab.kt` + `ytFetch`) — a extração sai do IP do chip, que é o que o YouTube não bloqueia. Falhando, vira item de LINK, retentado no toque seguinte |
| Qualidade do download | — | teto escolhido pelo operador: **1080p · 720p · 480p**, no mesmo seletor de Vídeo/Só áudio. **O padrão é 720p e ele é DO OPERADOR** (v1.7.7): escolher um teto o GRAVA (`state` `ytAltura`) e ele vale para o próximo vídeo. As duas metades revogam decisões escritas — o padrão era `YT_ALTURAS[0]` (1080p) e o teto nascia no padrão A CADA ITEM —, e as duas foram pedidas por extenso. 1080p usa o `ytFetch` de sempre; só teto MENOR usa `ytFetchAte`. O degrau **"Online"** (`-1`, que guardava só o link) SAIU junto com a transmissão direta que ele alimentava |
| Resolução do download | — | **até 1080p, montando as duas faixas** — acima de 720p o YouTube entrega vídeo sem som. `MuxMp4.kt` junta com `MediaMuxer` (cópia de amostras, sem recodificar). Pares do MESMO contêiner (mp4+m4a, webm+webm na API 29+): "a melhor de cada lado" daria VP9 em MP4, que o muxer recusa **depois de tudo baixado**. Falhando, o progressivo é o piso. Requer o extrator ≥ v0.26.4 (cliente **visionOS**, que entrega adaptativas sem PO Token); as listas chegam misturadas, daí a **fila de candidatos** — ver `docs/ARQUITETURA-WEB.md` |
| **Só o ÁUDIO** em "Tocar agora" | **não toca** | baixado pelo `ytFetchAudio`, como nos destinos que guardam — a transmissão dele saiu na v1.7.7 junto com a do vídeo. Entra como `kind:'audio'` (o telão mantém o wallpaper) |
| **Só o ÁUDIO** guardado | — | **`ytFetchAudio`** (shell ≥ 23), pelo mesmo seletor Cantada/Playback. `kind:'audio'` e sem miniatura — é o *kind*, não o contêiner, que faz o telão manter o wallpaper. Único caminho sem o teto de 720p do progressivo. Fila de três candidatos na ordem do cliente que funciona, progressivo no fim |
| **Séries do YouTube** | **não existe** | **um álbum por SÉRIE** (shell 41) — ver a seção do recurso. O ITEM é um vídeo do YouTube, não faixa de hinário: mesma folha (sem "Só áudio"), "Tocar agora" transmite, download só nos destinos que guardam. Não há "baixar o álbum" (~300 MB/episódio) |
| Buscar no YouTube | não existe: abre o YouTube numa aba | **busca dentro da Biblioteca** (`ytSearch` → `YoutubeGrab.pesquisar`), resultados na mesma lista e mesma folha de destinos. Em **português**: passar localização ao `NewPipe.init` NÃO resolve (o serviço filtra por uma lista que só tem `en-GB`) — quem resolve é o `forceLocalization` do próprio `Extractor`. Iframe é recusado pelo `X-Frame-Options`; a API oficial exigiria chave com cota |
| Link para fora do app | `window.open` | **`openExternal(url)`** → `ACTION_VIEW` em tarefa própria. O WebView RECUSA navegar para outro origin (invariante 2): sem esse método um link externo não faz nada, nem erro no console |
| Sem tela conectada (simplificado) | mesmo bloqueio, com a janela do Display no lugar da `Presentation` | **modo bloqueado**: cortina embaçada, seção de conexão no centro, saída para o avançado na frente. **Não é incondicional**: o "Tocar neste celular" da folha (`tocarNoCelular`) desbloqueia e manda o som para este aparelho. **Caminho só de IDA e sem persistência**: o bloqueio se rearma ao fechar o app, ao passar pelo modo avançado (`setAppMode`) ou quando uma tela entra — e por isso o botão SOME depois do toque, em vez de oferecer o desfazer |
| Fullscreen da preview | `requestFullscreen` + Screen Orientation | idem, com trava de paisagem **nativa** (`onShowCustomView`). Os controles são uma COLUNA na lateral direita que o toque acende e 4 s apagam — não gestos (v1.0.7, ver `docs/arquitetura/CONTROLE.md`). É uma das duas superfícies em que ⏮/⏭ ainda tem DOIS eixos (a outra é a notificação): aqui não cabe um par de botões de slide, porque sem TV o que se pinta nesta tela a congregação vê |
| Botões físicos de volume | o navegador não os recebe | **interceptados**, ligados ao fader do deck — e é isso que mantém o painel de volume do Android FORA da projeção (ver abaixo) |
| Microfone AO VIVO | o navegador pergunta | `MicChromeClient` + `RECORD_AUDIO` (ver abaixo). **Só com TV**: quem capta é o `/display/`, que só existe dentro da `Presentation` — e sem TV o botão **não é desenhado** (v1.2.21) |
| Câmera | o navegador pergunta | **negada, sempre**. O `onPermissionRequest` do `ControleChromeClient` FICOU, negando **com log**: um WebView sem ele nega em silêncio, e o próximo que precisar de mídia aqui descobriria a armadilha do zero |
| Navegação | idem (uma tela e duas folhas) | **UMA TELA e DUAS FOLHAS** (v1.5.0): o Cronograma é a tela única; a Bíblia e as Ferramentas são folhas dele, abertas pelas portas do rodapé (Bíblia · Importar · Ferramentas); a Biblioteca é uma JANELA DE TELA CHEIA que sobe levando a barra de busca junto, e a barra é a CABEÇA dela — fechada, ela repousa no TOPO da caixa de controles (v1.5.2), sem pintar nada, com os dois quadrados no tom E na largura dos botões do transporte (v1.5.5) e o campo branco com borda entre eles; aberta, ela para no topo da TELA, e é por isso que o teclado deixou de cobrir o campo. A janela vai do topo até a LINHA DA BARRA (v1.5.4): fora disso não há camada — nem pixel, nem scrim, nem toque —, então os controles continuam à vista e alcançáveis com a Biblioteca aberta, e a barra de status é o DESTINO da abertura, não um recuo que viaja acima da barra ao fechar. Aberta ela é uma JANELA como as folhas de Bíblia e Ferramentas — `--panel`, `--radius-card` e uma FRESTA acima dos controles, para se ver onde a lista acaba (v1.5.7); fechada não tem raio nem fundo, porque ali o que se vê é a barra. **E a camada dela é o CHÃO da pilha, não o teto** (`z-index: 190`, v1.5.6): ela é a única deste app que existe SEMPRE, então empatada em 200 com as outras quem decidia era a ordem do documento — a barra pintava sobre Configurações e sobre a playlist, e o que se abrisse dos controles subia ATRÁS da Biblioteca. **Sem caixa de controles na tela a janela vai até a base** (o teclado com a Biblioteca aberta, e o Modo Fácil): o recorte protege os controles, e sem controles ele só corta. Saíram a faixa de abas, o vazado deslizante, o carrossel horizontal e o `switchTab` |
| Botão voltar | — | **fecha o que estiver aberto** antes de minimizar (ver abaixo) |
| Controles fora do app | — | `MediaSession`: notificação, tela de bloqueio, botões de mídia |
| Download minimizado | a aba continua baixando | **foreground service + wake lock**; sem isso o processo é congelado |
| **Levar a biblioteca para outro aparelho** | **não existe** (não há SAF nem canal de bytes: um `<a download>` sobre um Blob de gigabytes não é caminho) | **um arquivo `.avpkg`** (shell 63) — ver a seção do recurso. Exportar abre direto o SELETOR DE COMPARTILHAMENTO (shell 67), que é por onde ele de fato atravessa (Quick Share): o pacote é escrito no armazenamento próprio e oferecido ali. Não cabendo — a conta é `espaco − bytes > 512 MB`, feita pelo WEB —, ele volta ao "Salvar como" do sistema, que é o caminho do cartão. Nos dois, os bytes vão pelo canal `__avPacote`; importar entra por `pickDoc` e lê o arquivo por JANELAS (`/saf/<token>?r=<ini>-<fim>`, shell 64) — nunca inteiro, porque o caminho `/saf/` tem teto de 2 GB e um `resp.blob()` de quinze gigabytes não cabe em lugar nenhum. **Só ACRESCENTA**: nada que já esteja no aparelho é substituído |
| **Compartilhar o link do app** | `navigator.share`, onde o navegador o tiver | **`compartilharTexto`** (shell 63) → `ACTION_SEND` + `createChooser`. O WebView do Android **não** implementa a Web Share API, então este era o único caminho — e sem ele não havia, de dentro do app, forma nenhuma de passá-lo adiante |
| Abertura do app | a página pisca igual, e ninguém tem o que fazer a respeito | **a CORTINA** (`#splash`) mais o `data-tema` escrito no `<head>` antes do primeiro quadro. O prazo que a levanta mora no mesmo script inline, e não no `controle.js`: um bundle que nem chega a ser parseado tem de terminar com o app À VISTA |
| Atualização da base web | recarregar a página | **OTA** |
| Contagem de uso | **não existe** — nada é contado num navegador, e não há chave nenhuma a desenhar | **o farol** (shell 58): uma busca por dia a um asset de contagem, agregada e sem id. Pega carona na ronda do OTA. **SEMPRE ATIVO desde a v1.4.42**: a chave de exclusão saiu (com o `farolContar` da ponte), e o que sobra é o BUILD DEBUGGÁVEL, que acende num contador separado por construção. O preço está no painel — a página de alcance avisa que os números incluem o uso próprio |
| Atualização do APP | — | **o app baixa e instala**; o diálogo do Android é obrigatório e está certo que seja |
| Tema claro × escuro | CSS + `localStorage`; `theme-color` tinge a barra | idem **mais o cromo do sistema**: `temaClaro` vira os ÍCONES das barras e guarda o tema EFETIVO para o `windowBackground` do PRÓXIMO lançamento (recurso de APK é resolvido antes de existir JS) |
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

1. diálogo modal → 2. bottom-sheet (o de cima) → 2.5. a folha de Ferramentas →
**2.6. a folha da Bíblia** (que SOBE dentro dela — livros ← capítulos ← leitura —
antes de fechar) → 3. preview em tela cheia (que, sem telão, **é** a projeção) →
*(o degrau 4 era o fader do mixer, e saiu na v1.3.8)* → 5. seleção múltipla →
*(os degraus 6 e 7 subiram para o 2.6 na v1.5.0: o `#backBtn` do cabeçalho só
servia à Bíblia, e não há mais "fora do Cronograma" — há uma tela e duas folhas)*
→ 8. nada aberto → `moveTaskToBack`.

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

#### O ARNÊS: `tools/arnes.mjs` e `tools/checar.mjs`

O preâmbulo (servidor estático, `TIPOS`, `checar`, o `chromium.launch` com o
`PW_CHROMIUM`) era COPIADO em 45 arquivos — 3.225 linhas —, e uma cópia é uma
chance de divergir. Divergiu em três lugares, nenhum deles com como acusar:
`checar` em SETE variantes (uma com dois parâmetros recebendo três, descartando o
`obtido` em silêncio), `TIPOS` em cinco (umas sem `.png`/`.woff2`, que caíam em
`application/octet-stream` e mudavam o `type` de um `Blob`), e viewport/`args`
herdados por cópia em vez de escolhidos.

- **`servirEstatico(raiz, antes)`** — o `antes` é a rota PRÓPRIA do oráculo:
  devolvendo `true` ela assumiu o pedido. É por ele que os quatro com fixture
  própria (`/semente` do OTA, `/baixado.wav`, `/pagina.png`, o espião do
  `display-smoke`) continuam donos do que servem. **Quem acrescentar um oráculo
  com rota própria a escreve aqui** — uma rota apagada não tem sintoma até o
  oráculo pedi-la.
- **`checar` mora em `tools/checar.mjs`, SEM uma linha de `import`**, e a
  separação NÃO é organização: o `arnes.mjs` importa o Playwright, e no workflow
  os 17 oráculos de Node puro rodam no passo "Sanidade da base web", que vem
  **antes** do `npm ci`. Um deles importando o arnês passaria na máquina de quem
  escreve (onde `node_modules/` existe) e falharia só no runner, no passo sem
  `continue-on-error` — "a atualização não chega", por um
  `ERR_MODULE_NOT_FOUND` que nada no arquivo explica.
- **`esperar(pg, fn)` e `esperarDb(pg, fn)`** — ver abaixo. `porque(r)` devolve a
  frase do prazo para o terceiro argumento do `checar`.
- **Viewport e `args` são PARÂMETRO**, com o padrão do projeto (430×900). Quem
  quer outro o escreve, e aí está dito que foi escolha.

#### PRAZO NÃO É ASSERÇÃO — e isso é MEDIDO, não estilo

A suíte tinha **136 `waitForTimeout` somando 115 s**: um quarto do tempo dela era
sono. O pior caso: `stage-fade.test.mjs` esperava **17 s** para conferir que o
estilo do fade fora limpo — MEDIDO, ele é limpo em **3,1 s**.

- **`esperar(pg, fn, arg, prazo)`** espera pelo FATO e devolve `true` ou a FRASE
  `"(PRAZO, não veredito)"`. O estouro nunca vira veredito: uma reprovação por
  carga do runner chega indistinguível de um defeito do app, que é a primeira das
  cinco classes que a campanha da v5.316 teve de corrigir uma a uma.
- **`esperarDb` é a irmã para o que mora atrás de um `await`** (o IndexedDB):
  `waitForFunction` **não espera a Promise de um predicado `async`** — ela é
  *truthy* e a espera passa no primeiro quadro, aprovando o que veio verificar.
  O laço é do lado do Node.
- **Nem toda espera fixa é defeito, e as que ficaram estão explicadas.** Três
  casos legítimos: a asserção é uma AUSÊNCIA (esperar pelo que não deve
  acontecer é impossível — espera-se pelo fato que FECHA a janela); a asserção
  exige tempo de parede REAL (`tempo > t + 0,5` é meio segundo de áudio
  tocando); ou o que se espera é uma CARÊNCIA declarada do app
  (`PV_BUSY_SAIDA_MS`, 700 ms — esperar o cartão sair seria esperar pelo que se
  vai afirmar, a tautologia).

#### EM PARALELO, TRÊS DE CADA VEZ

Os 64 de Chromium somavam **~8 min em série**, e o custo não é o que parece:
lançar o navegador são **~110 ms** e subir o `/controle/` inteiro é **~1 s** —
compartilhar um navegador entre oráculos, a otimização óbvia, economizaria 2% e
custaria o isolamento. O que sobra é espera, com os quatro núcleos ociosos.

É seguro por CONSTRUÇÃO, e foi conferido antes de ligar: todos abrem o servidor
com `listen(0)`, nenhum escreve arquivo temporário compartilhado, cada um lança o
próprio navegador com o próprio perfil. **TRÊS e não `nproc`**: o runner tem 4
vCPU e a campanha da v5.316 validou a suíte a 2× de carga — três fica DENTRO do
envelope já medido. **Subir este número é subir a carga, e a regra do projeto
vale aqui: repetir a campanha antes.**

O log é escrito em arquivo e impresso na ORDEM da lista — em paralelo os
`::group::` sairiam intercalados, e um log que não se lê não é rede de segurança.
**RC ausente conta como REPROVADO**: um oráculo cujo processo morreu sem escrever
o código de saída não pode entrar no placar como quem passou.

**As tabelas — o que cada oráculo trava — moram em
[`docs/ORACULOS.md`](docs/ORACULOS.md).** São 95 linhas de REFERÊNCIA: ninguém as
lê inteiras, e ninguém deveria. Abra o capítulo para mexer num oráculo, escrever
um novo, ou entender por que uma asserção existe antes de "consertá-la". O que
fica aqui é o MÉTODO, que vale para todos eles.

**Node puro, SEM `continue-on-error`** — reprovar aqui barra o build. **Chromium
de verdade, em DOIS PASSOS,** e a ASSIMETRIA entre eles é a política:

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
durante todo culto com Miracast), `TrilhaAudioTest`
(qual trilha de áudio vai ao telão — o defeito mais silencioso deste caminho:
tudo funciona, e o testemunho está em inglês na frente da congregação; doze casos
**em pares**, o que a regra passou a recusar e o que ela não pode ter recusado
junto).

**Duas regras de método que ficam:**

- **Teste que não está no workflow é documentação, não rede de segurança** — e
  a linha do `rodar` entra no MESMO lote que o arquivo. Isto deixou de ser
  higiene e virou passo do rito: **quatro vezes em nove lotes** — a v1.8.0 com o
  `clone-de-outro-celular.test.mjs`, a v1.8.2 com o
  `clone-lista-de-aparelhos.test.mjs`, um terceiro de meses atrás que a
  varredura da v1.8.4 achou (`preview-volta-ao-wallpaper.test.mjs`) e, o mais
  caro deles, a v1.8.8 com o `kotlin-simbolo-importado.test.mjs`. O modo de
  falhar é sempre o mesmo — o run fica verde porque ninguém o roda, e o oráculo
  novo passa a existir só no repositório.

  **O QUARTO É O QUE MOSTRA O CUSTO.** Ele foi escrito para impedir que um
  símbolo sem `import` derrubasse a `main` — que é o que a v1.8.6 tinha acabado
  de fazer —, ficou fora do workflow, e por um lote inteiro o repositório teve
  a linha na tabela, o arquivo no disco, e **nenhuma proteção**. *Um oráculo que
  não roda é pior que oráculo nenhum: ele responde a pergunta "isso está
  coberto?" com um sim que não existe.*

  A comparação é `tools/*.test.mjs` contra o workflow, arquivo a arquivo, **nos
  dois sentidos** — a segunda direção achou o `clone-lista-de-aparelhos`, que
  rodava no CI sem linha em tabela nenhuma. É essa varredura, não a memória, que
  responde à pergunta, e ela é uma linha:
  `comm -3 <(ls tools/*.test.mjs | sort) <(grep -oE 'tools/[a-z0-9.-]+\.test\.mjs' .github/workflows/apk.yml | sort -u)`
- **E A LISTA DO CI NÃO É `tools/*.test.mjs`.** Dois oráculos não têm esse
  sufixo — o `smoke.mjs` e o `display-smoke.mjs` —, e são justamente os dois
  que medem o RENDERIZADO. Um runner local que filtre por esse sufixo os pula
  em silêncio e devolve um placar cheio: aconteceu na v1.8.50, e o que ele
  escondeu foi uma regra de CSS que subia o corpo de uma coleção por cima da
  própria barra. A lista certa é a do workflow, e ela sai daqui:
  `grep -oE 'tools/[a-z0-9._-]+\.mjs' .github/workflows/apk.yml | sort -u | grep -vE 'arnes|checar|sem-rede|pares-de-comentario'`
- **A REVERSÃO É UM PASSO, NÃO UMA BOA PRÁTICA.** Toda asserção nova roda
  **duas vezes** antes do commit: com o conserto, e com ele desfeito. Sem isso a
  asserção pode ser uma TAUTOLOGIA — passar nas duas versões —, e isso não é
  hipótese: aconteceu DUAS vezes na revisão de 2026-09-07, e uma delas passou
  porque o prazo de 8 s era maior que a duração da faixa do cenário, então a
  preview chegava ao fim sozinha e o app avançava pelo caminho de sempre. **Uma
  asserção que não pode reprovar o defeito que ela nomeia é pior que asserção
  nenhuma:** ela responde *"isso está coberto?"* com um sim que não existe.
- **A REVERSÃO SE DESFAZ COM UMA CÓPIA, NUNCA COM O GIT.** `git checkout
  <arquivo>` restaura do HEAD e **apaga o trabalho não commitado do lote inteiro
  naquele arquivo** — aconteceu, e custou refazer quatro edições. `cp` de um
  backup feito antes da reversão, e pronto.
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

- **A NOTA DO LOTE SE ESCREVE UMA VEZ, e ela mora no `docs/HISTORICO.md`.**
  Ela chegou a ser escrita QUATRO vezes — mensagem de commit, entrada no
  histórico, bloco no `CLAUDE.md` e `notas.json` —, e o bloco do `CLAUDE.md`
  saiu na faxina de 2026-09-07. Das três que sobram, duas são **o mesmo texto**:
  a mensagem de commit e a entrada do histórico.

  **A ordem que resolve:** escreva a entrada do `HISTORICO.md` PRIMEIRO — ela é
  a versão longa, é o que se lê por `grep` meses depois, e é a que o oráculo
  cobra. A **mensagem de commit fica curta** (o que mudou e por quê, em algumas
  linhas) e não repete a narrativa. O `notas.json` é outra coisa e continua
  sendo escrito à parte: ele fala com o OPERADOR, num tópico por linha.

  Foi a fricção de escrever duas vezes que produziu o defeito real: **doze
  versões publicadas ficaram sem nota nenhuma no apêndice**, entre elas a v1.7.7
  — o lote que removeu a transmissão direta. Hoje o
  `tools/docs-coerentes.test.mjs` reprova o build quando uma versão do
  `notas.json` não tem entrada lá.

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
  `/telas/biblia.webp`), e **essa regra já se pagou**. O Pages servia de
  `jonathasptbr-gh.github.io/Audio-Visual-IASD/`, com PREFIXO de caminho; o
  domínio próprio **[audiovisualiasd.com.br](https://audiovisualiasd.com.br/)**
  serve da RAIZ. Todo link absoluto funcionava e teria quebrado na troca — **e
  quebrado calado**, porque quem responde é o 404 do GitHub, não um erro nosso.
  Com tudo relativo, o mesmo build passou a servir os dois endereços sem uma
  linha alterada, e a migração foi o DNS mais o `site/CNAME`. A regra continua
  valendo pelo mesmo motivo: **o endereço pode mudar de novo, o `site/` não**.

  **E NA PÁGINA O RECURSO SE CHAMA "CONECTAR UM COMPUTADOR"** (v1.8.51), a
  pedido do operador: *"use apenas termos diretos relacionados a 'conectar a um
  computador via navegador'… não quero algo genérico como rede ou aparelho, ou
  navegador"*. O computador é o SUJEITO que recebe a projeção e o navegador é o
  MEIO; "telas da rede" e "outra tela" não voltam ao texto visível — e o
  espelhamento na TV é OUTRA coisa, que não pode virar "computador". Oráculo:
  `site-grade-e-carrossel.test.mjs`, bloco C.

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
- **DESLIGAR DIZ POR QUÊ.** `desmontarEspelho(motivo)` exige a frase, e os
  três chamadores a escrevem (o operador, o app fechado, o serviço encerrado
  pelo Android). Ele era mudo, e o Registro saía com a última
  linha em *"cessao da biblioteca ligada"* sobre um estado *"servidor:
  desligado"* — as causas pedem ações OPOSTAS e nenhuma era dizível a
  distância. Caminho novo que derrube um recurso de rede nasce com a frase.
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
- **UM NÚMERO RESPONDE "COM QUE FREQUÊNCIA?"; UMA LINHA RESPONDE "DA ÚLTIMA
  VEZ?"** (v1.4.13). São perguntas diferentes, e um diagnóstico que só guarda a
  última ocorrência não alcança uma falha INTERMITENTE — MEDIDO: três Registros
  da mesma semana deram três respostas sobre a extração do YouTube, e a leitura
  que saiu delas ("é sempre") foi uma generalização de duas amostras que a
  terceira derrubou. Onde o desfecho pode variar entre uma vez e outra, o bloco
  leva CONTADOR DE SESSÃO ao lado da linha: `AVStream.fome` (episódios e
  segundos parados) e `ytCenso` (pedidos, transmitidos, qualidade limitada) são
  os dois de hoje. **Contador, não log:** guardar QUAIS vídeos responderia mais
  e custaria tamanho, privacidade do que se copia e uma segunda fonte de
  verdade. E **só sai depois de acontecer** — uma linha de zeros é mais uma para
  ler em toda cópia.
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
- **Todo campo de LOG nasce com uma PORTA DE SAÍDA** — sem ela a alternativa é
  transcrever números à mão ou fotografar a tela. **Qual porta depende do
  TAMANHO**, e é o que a v1.4.44 separou: um valor CURTO que se digita noutro
  aparelho (o endereço da transmissão) sai pela área de transferência
  (`.log-copy` + `copiarTexto`); o REGISTRO sai por ARQUIVO (`salvarTexto`), e o
  copiar dele saiu a pedido do operador — *"o registro está cada vez maior e
  mais completo e acaba por ele ficar longo de mais para compartilhar via chat
  de texto"*. A área de transferência é o caminho que **corta o texto no meio
  sem avisar**, e foi esse relato que criou o salvar em arquivo na v1.2.16.
  **E o arquivo é aberto com `"wt"`, nunca `"w"`** (v1.8.5): sem o `t` o provedor
  de documentos escreve por cima do começo e deixa a CAUDA do arquivo antigo —
  e o que sobra é conteúdo PLAUSÍVEL, blocos inteiros descrevendo um estado que
  já não existe. Num artefato lido A DISTÂNCIA por quem não confere nada, isso é
  o log que discorda do aparelho.

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
- **ESTE ARQUIVO NÃO GUARDA LOG DE LOTE.** Um lote publicado escreve a nota no
  `docs/HISTORICO.md` (topo do índice, e a seção `## vX` se a série ainda a
  tiver) e, AQUI, só corrige a REGRA que mudou — **no lugar dela**. Se o lote
  não muda regra nenhuma, este arquivo não muda.

  A regra existia e foi contrariada por vinte e cinco lotes seguidos: em
  2026-09-07 havia **25 blocos "O QUE O LOTE TRAZ (vX)"**, da v1.7.4 à v1.8.48,
  somando **1.294 linhas — 19% do arquivo**, todas justificativa. O arquivo
  cresceu **47% em três dias** por esse caminho (381 kB em 04/set, 562 kB em
  07/set), contra os 23% em sete dias que a auditoria de eficiência tinha
  medido. **O formato é o defeito**: um bloco por lote é um log, e um log só
  cresce.

  **A casa da regra permanente é a seção canônica ou a TABELA DE ORÁCULOS** — e
  foi ela que segurou a remoção: dos 25 blocos, só três regras não tinham casa
  (as linhas de tabela do `funcao-sem-chamador` e do `notificacao-ids`, e o
  avanço da playlist sem TV), e as três foram enxertadas ANTES de apagar.

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
lote exige Release. Um `web v1.0.7 · shell v1.0.3` no REGISTRO não é divergência —
é a resposta exata a *"o OTA chegou e o APK ainda não?"*. **Desde a v1.7.0 essa
resposta mora só lá:** a tela mostra um número, e é o da base web.

### A versão mora em TRÊS lugares, e os três precisam andar juntos

| Onde | O quê | Para quê |
|---|---|---|
| `assets/web/version.json` | `"version"` | **faz a atualização chegar aos aparelhos**: o OTA compara este campo (`compareVersions`) e ignora, em silêncio, um bundle cuja versão não seja maior que a instalada |
| `controle/controle.js` | `WEB_VERSION` | **é o que a UI mostra**: `renderVersionLabel()` escreve as TRÊS casas na carga — as duas badges do cabeçalho e o rodapé de Configurações |
| `controle/index.html` | `<span id="appVersion">` | o que aparece antes do primeiro render — e a única versão visível num shell sem `appVersion()` |

Esquecer o `WEB_VERSION` é o erro **silencioso** (o bundle novo chega e o
aparelho exibe a versão antiga, justamente a leitura que serve para diagnosticar
se o OTA chegou); esquecer o `version.json` é o erro **mudo** do outro lado (nada
chega a aparelho nenhum). O `versionCode`/`versionName` do APK vêm do CI.

**Versão atual: base web v1.8.51 · APK v1.8.45** · `SHELL_VERSION` **72** ·
bundle com `minShell: 72` e **SEM `shellTag`** — o shell 72 é o
**PISO**: todo método da ponte existe, e não há guarda de versão no lado web.

> **A v1.8.50 NÃO declara `shellTag`, e a v1.8.45 declarou — a diferença é o
> ACOPLAMENTO, que é a pergunta que aquele campo faz.** Aquela acrescentou um
> método à ponte (`pacoteProntoEstado`) e o `controle.js` o CHAMA na abertura:
> contra um APK sem ele, o `native.js` cai no `catch`, o `call()` vence os 60 s
> e resolve `null` — a semeadura simplesmente não acontece, calada. Esta não
> toca `java/`, `res/` nem o manifesto, e nenhum método da ponte entrou ou mudou
> de forma: o bundle sai na hora, contra o APK v1.8.45 que já está publicado.
> (As v1.8.46 a v1.8.49 são o mesmo caso, pela mesma razão.)
>
> **O modo de falhar deste campo está dito e é o caro:** uma tag declarada cuja
> Release nunca sai segura o canal PARA SEMPRE, em silêncio, e a única pista é a
> linha no resumo do run. **Deixá-la apontando para a tag do lote ANTERIOR é o
> mesmo defeito por outro caminho** — o CI exige `shellTag == 'v' + version`.
> **A v1.8.50 NÃO pede Release.**

> **ESTE BLOCO É A QUARTA CASA DA VERSÃO, e desde a v1.8.50 ela TEM ORÁCULO.**
> As três oficiais (`version.json` · `WEB_VERSION` · `#appVersion`) têm asserção
> no `verificar` e por isso nunca divergem; esta não tinha, e MEDIDO ela ficou
> para trás **três vezes** — duas em vinte minutos (a v1.8.8 a deixou em v1.8.7;
> corrigida, a v1.8.9 a deixou em v1.8.8) e de novo na v1.8.49, que a deixou em
> v1.8.48. O modo de falhar é o desta seção inteira: um arquivo lido a cada
> sessão, ANTES do trabalho, afirmando um estado que o repositório já não tem —
> e quem o lê não confere, porque é justamente para não conferir que ele existe.
> Quem a fecha é o `docs-coerentes.test.mjs`, que lê esta linha e a compara com
> o `version.json`. **Renumerar o lote continua incluindo esta linha**, ao lado
> das três e do `shellTag`; o que mudou é que esquecê-la passou a reprovar o
> build em vez de sobreviver até alguém reparar.

> **UM `apk` REPROVADO NÃO PULA O `web-ota` — QUEM SEGURA É O HOLD.** A
> confusão é fácil e custou um lote inteiro de raciocínio errado: o `web-ota`
> tem `needs: [verificar, apk]`, mas o `if:` dele é `!cancelled() &&
> needs.verificar.result == 'success'` — **o resultado do `apk` é
> deliberadamente ignorado**, e o `needs` está lá pela ORDEM (o passo que
> consulta a Release precisa rodar depois de quem a publica). O job RODA com o
> `apk` vermelho. O que impede a publicação é o HOLD do `shellTag`, cuja
> Release o build que falhou não chegou a criar — e por isso o desfecho é um
> job VERDE que não publicou, com o motivo no resumo do run. Foi assim com a
> v1.8.6. A conclusão prática continua a mesma (**um lote que toca `java/`
> confere o `apk`**); o mecanismo é este, e está escrito no comentário do
> próprio `web-ota`, vinte linhas acima do `if:`.

> **UM LOTE QUE PEDIU RELEASE (v1.7.0)**, e a razão fica registrada porque
> ela é o caso normal: a ponte ganhou QUATRO métodos (`compartilharTexto` e os
> três do PACOTE) e o shell um canal de `ArrayBuffer` novo — nada disso chega
> por OTA. Sem o `shellTag` os tiles novos chegariam sozinhos à frota,
> chamariam métodos que o APK instalado não tem, o `call()` venceria os 60 s e
> resolveria `null`, e o que o operador teria seriam botões tocáveis que não
> fazem nada.
>
> **E O ESPELHO DISSO É O LOTE ATUAL (v1.8.16), que ENCOLHE a ponte sem pedir
> Release** — porque encolher no WEB primeiro é o lado seguro: um APK que ainda
> serve oito métodos que ninguém chama não custa nada ao aparelho. É a ordem
> inversa — a base web nova contra o APK velho — que precisa do `shellTag`.

> **AS NOTAS DE LOTE MORAM NO `docs/HISTORICO.md`, E ESTE ARQUIVO NÃO GUARDA
> LOG** (a faxina de 2026-09-07). Havia aqui **25 blocos** — *"O QUE O LOTE
> TRAZ (vX)"*, da v1.7.4 à v1.8.48 —, **1.294 linhas, 19% deste arquivo**, num
> arquivo que é lido INTEIRO em
> toda sessão antes de qualquer trabalho. Eles contradiziam a regra escrita duas
> seções acima: *"Aqui entra o que VALE HOJE; em `docs/HISTORICO.md`, o que
> explica POR QUÊ."*
>
> **MEDIDO antes de apagar**, porque apagar sem medir é perder: os 25 têm
> entrada no `HISTORICO.md` (as seis que faltavam — a v1.7.7 e as v1.8.44 a
> v1.8.48 — foram escritas no mesmo lote), e a regra permanente de cada um já
> vive na seção canônica ou na TABELA DE ORÁCULOS, que é a casa dela. As duas
> exceções encontradas foram enxertadas antes da remoção: as linhas de tabela do
> `funcao-sem-chamador` e do `notificacao-ids`, que existiam só nos blocos, e o
> avanço da playlist sem TV, na linha do `preview-volta-ao-wallpaper`.
>
> **A regra que substitui os blocos:** um lote publicado escreve a nota no
> `HISTORICO.md` e, AQUI, só corrige a REGRA que mudou — no lugar dela. Se um
> lote não muda regra nenhuma, este arquivo não muda. O bloco *"Versão atual"*
> logo acima é a única coisa por lote que fica, porque ele responde uma pergunta
> do PRESENTE (*"o que está publicado, e este lote pede Release?"*).

### Onde procurar

| pergunta | onde |
|---|---|
| como isto funciona? | aqui, ou o capítulo certo de `docs/arquitetura/` (mapa em `docs/ARQUITETURA-WEB.md`) |
| por que é assim? / já foi tentado? / foi revogado? | `grep -n "<termo>" docs/HISTORICO.md` |
| o contrato do telão nas telas da rede | `docs/TELAO-POR-COMANDOS.md` |
| o banco de hinos e Bíblia | `docs/FONTE-DE-DADOS-LOUVORJA.md` |
