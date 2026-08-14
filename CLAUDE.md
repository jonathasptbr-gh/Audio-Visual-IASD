# Claude Code — APP Áudio Visual IASD (Android nativo)

App Android nativo do sistema de projeção de mídia para culto (IASD). É uma
**casca em Kotlin** que hospeda a base web do projeto em dois WebViews e usa
`android.app.Presentation` para mandar **só o Display** para a TV — sem
espelhar o celular.

> **Este repositório é autossuficiente.** A base web (`app/src/main/assets/web/`)
> foi copiada do PWA original e **agora vive aqui**: não há checkout cruzado,
> submódulo nem qualquer dependência de build do repositório do PWA. A
> arquitetura completa dessa base está em
> [`docs/ARQUITETURA-WEB.md`](docs/ARQUITETURA-WEB.md) — **leia antes de mexer
> em qualquer coisa dentro de `assets/web/`.**

## Índice

1. [O ganho: Presentation em vez de espelhamento](#o-ganho-presentation-em-vez-de-espelhamento)
2. [Estrutura do repositório](#estrutura-do-repositório)
3. [Invariantes do shell (não quebrar)](#invariantes-do-shell-não-quebrar)
4. [A ponte `window.AVNative`](#a-ponte-windowavnative)
5. [Barramento de comandos e o plano B do BroadcastChannel](#barramento-de-comandos-e-o-plano-b-do-broadcastchannel)
6. [Trabalho em segundo plano (downloads com o app minimizado)](#trabalho-em-segundo-plano-downloads-com-o-app-minimizado)
7. [Notificação de controles (sessão de mídia)](#notificação-de-controles-sessão-de-mídia)
8. [OTA da base web (atualização sem APK)](#ota-da-base-web-atualização-sem-apk)
9. [Telão por comandos (o telão nas telas da rede local)](#telão-por-comandos-o-telão-nas-telas-da-rede-local)
10. [A paleta](#a-paleta)
11. [Divergências entre o caminho web e o nativo](#divergências-entre-o-caminho-web-e-o-nativo)
12. [Build e distribuição](#build-e-distribuição)
13. [Regras de desenvolvimento](#regras-de-desenvolvimento)

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
PWA, incluindo os gestos invisíveis).

---

## Estrutura do repositório

```
app/src/main/
├── AndroidManifest.xml          # intent-filter de share, portrait, <queries>, regras de backup
├── assets/web/                  # ← a base web (cópia própria, versionada aqui)
│   ├── version.json             #   identidade do bundle (version + minShell)
│   ├── shared/tokens.css        #   PALETA — fonte única, carregada pelos dois apps
│   ├── shared/wallpaper-padrao.svg  # o WALLPAPER padrão: símbolo oficial IASD
│   ├── shared/native.js         #   ponte AVNative + watchdog do OTA (NÃO existe no PWA)
│   ├── shared/mse.js            #   player DASH mínimo: transmissão direta sem baixar
│   ├── shared/db.js             #   + relay nativo no canal de comandos
│   ├── shared/stage.js          #   motor de mídia (compartilhado Controle/Display)
│   ├── vendor/                  #   ÚNICO código de terceiro do lado web:
│   │                            #   o renderizador de .pptx (ver o LEIA-ME de lá)
│   ├── shared/stage.css         #   o CSS do motor (o indicador de espera)
│   ├── espelho/tela.css         #   o CSS da ENTRADA da tela da rede
│   │                            #   (os dois eram `<style>` em runtime, e a CSP
│   │                            #    das telas da rede os bloqueava — v5.205)
│   ├── espelho/tela.js          #   O TELÃO POR COMANDOS: a casca do papel
│   │                            #   `tela` sobre o próprio /display/ (SSE)
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
│   ├── SessionService.kt        # O ÚNICO foreground service: MediaSession + transmissão
│   ├── WebUpdater.kt            # OTA da base web (watchdog, minShell, sha256)
│   ├── ShellUpdater.kt          # OTA do APK: a Release nova, instalada de dentro do app
│   ├── WebPathHandler.kt        # serve o bundle OTA, com fallback pro APK
│   ├── YoutubeGrab.kt           # extrai e baixa o vídeo do YouTube NO APARELHO
│   ├── MuxMp4.kt                # junta as faixas de vídeo e áudio (1080p) — MediaMuxer
│   ├── StreamProxy.kt           # /stream/<token>: serve o googlevideo pelo NOSSO origin
│   ├── SlideDeck.kt             # apresentação (PDF/Google) → uma imagem por página
│   ├── MicChromeClient.kt       # onPermissionRequest: microfone no WebView do telão
│   ├── MessageBus.kt            # relay de comandos entre os dois WebViews
│   │                            # ↓ TELÃO POR COMANDOS (ver a seção do recurso)
│   ├── EspelhoHttp.kt           # o parser HTTP (+ Range/SSE) — PURO, zero import de Android
│   ├── EspelhoPares.kt          # a porta, tokens, prazo, castigo — PURO
│   ├── EspelhoServidor.kt       # sockets, rotas (bundle, /e, /m/, /par, /r), fan-out
│   ├── EspelhoMidiaCache.kt     # o cache da rota /m/<token> — PURO, com JUnit
│   ├── EspelhoMidiaCanal.kt     # canal de ArrayBuffer: OPFS → cache (WebMessage)
│   ├── EspelhoEnergia.kt        # wake lock, Wi-Fi lock e térmica da transmissão
│   ├── EspelhoCert.kt           # o .p12 do TLS opcional (sem UI desde a v5.196)
│   └── EspelhoDiag.kt           # o DIÁRIO da transmissão — devolve JSON, não frase
└── res/
    ├── drawable/                # ic_image{,_off} — a cortina, na notificação
    │                            #  + ic_launcher_{foreground,mono} — o ÍCONE, em vetor
    ├── mipmap-anydpi-v26/       # ic_launcher{,_round}: o adaptativo (o único, minSdk 26)
    ├── values/colors.xml        # app_bg e ic_launcher_background: ESPELHAM tokens da base web
    ├── values/themes.xml        # tema sem action bar; tema preto da Presentation
    └── xml/                     # backup_rules + data_extraction_rules (ver "Build")
docs/
├── ARQUITETURA-WEB.md           # arquitetura completa da base web
├── TELAO-POR-COMANDOS.md        # o CONTRATO do telão por comandos (ler antes de mexer)
├── ESPELHO-DE-PIXELS.md         # APOSENTADO (v5.187) — histórico do espelho de pixels
└── FONTE-DE-DADOS-LOUVORJA.md   # referência do banco LouvorJA (hinos/Bíblia)
```

**Vinte e cinco arquivos Kotlin, uma dependência de terceiros no shell** — o
resto é AndroidX oficial (`core-ktx`, `activity-ktx`, `webkit`). A troca do
espelho de pixels pelo telão por comandos (v5.187) **removeu** quatro arquivos
nativos inteiros (encoder, tela virtual, segunda Presentation, ponte de áudio)
e devolveu a renderização ao lado web — a proporção Kotlin × JavaScript é o
argumento, não o número absoluto. Manter o nativo pequeno respeita
a filosofia do projeto muito melhor que Capacitor/Cordova, que arrastariam npm e
um build system inteiro e ainda assim exigiriam código nativo próprio para a
Presentation.

> Esses números envelhecem a cada commit. Meça antes de citá-los:
> ```bash
> wc -l app/src/main/java/br/org/iasd/av/*.kt
> find app/src/main/assets/web -name '*.js' -not -path '*/vendor/*' | xargs wc -l
> ```

---

## Invariantes do shell (não quebrar)

São o que sustenta a base web. Cada uma mora num lugar diferente, e é preciso
saber qual para conferi-las:

**Em `WebViewFactory.kt`** (o KDoc do arquivo lista estas quatro):

1. **Servir por `https://appassets.androidplatform.net/`, JAMAIS por
   `file://`.** O contexto seguro é o que faz OPFS e IndexedDB funcionarem.
   Não é opcional.
2. **Um único origin para os dois WebViews.** É o que preserva IDB/OPFS/
   BroadcastChannel compartilhados. Origens distintas destroem a arquitetura.
   O origin é comparado por **componente do `Uri`** (`url.host == ORIGIN_HOST`),
   nunca por prefixo de string: `appassets.androidplatform.net.evil.com` começa
   com o origin, é um domínio que qualquer um registra, e um `startsWith`
   autorizaria a navegação — dentro de um WebView que injeta `__AVBridge` em
   toda página que carregar (`addJavascriptInterface` é por-WebView, não
   por-origem). Este ponto não pode falhar ABERTO.
3. **Um único processo/perfil de WebView.** Nada de processo isolado para o
   Display.
4. `mediaPlaybackRequiresUserGesture = false`, `domStorageEnabled`,
   `javaScriptEnabled` — mais `allowFileAccess`/`allowContentAccess`
   **desligados**: tudo entra pelo asset loader.

**Regra de projeto, não de código:**

5. **Não reimplementar em Kotlin nada que já exista em JS.** Transporte,
   playlist, letra sincronizada, Bíblia, Camada de Texto e fades permanecem no
   web. É de longe a maior parte do sistema (ver a contagem acima).

**Em `MainActivity.ControleChromeClient`** — e é justamente por estarem aqui,
e não na factory, que um segundo `WebChromeClient` criado sem elas as perde em
silêncio:

6. **`onShowFileChooser`.** Um WebView **ignora `<input type="file">` por
   completo** sem esse override: o toque não faz nada, sem erro nenhum no
   console. No navegador o seletor é da plataforma; aqui é o app que precisa
   abri-lo. Dele dependem a importação para o Cronograma e a escolha do
   wallpaper.
7. **`onShowCustomView`/`onHideCustomView`.** Sem eles, `requestFullscreen()`
   falha silenciosamente — e a preview em tela cheia é a projeção quando não
   há TV conectada. É aqui que mora a trava de paisagem nativa.

**No `shouldInterceptRequest` (`WebViewFactory.create`)** — a que custou três
rodadas de APK para ser aprendida:

8. **O `InputStream` que você devolve é o RECURSO INTEIRO a partir do byte 0.**
   Não é "a resposta": quem aplica o `Range` da requisição é o **próprio
   WebView**, sobre o que o app entregou
   (`AndroidStreamReaderURLLoader::Start` → `ParseRange` → `InputStreamReader::
   Seek` → `ComputeBounds` contra `available()`), incondicionalmente e para toda
   resposta interceptada. Devolver só a fatia pedida aplica o deslocamento DUAS
   vezes — e a requisição que começa no byte 0 é a única em que isso é um no-op,
   então ela passa e esconde o defeito atrás de si. **Corolário: um erro com
   corpo VAZIO não chega** quando a requisição tem faixa fora do zero
   (`ComputeBounds` reprova com `size == 0`), o que apaga a mensagem inteira e
   deixa só um erro de rede sem status. Ver `StreamProxy.kt` e
   `tools/webview-range.test.mjs`, que trava a regra no CI.

   > **E ela SE INVERTE num `ServerSocket`.** No servidor das telas da rede
   > quem aplica o `Range` somos NÓS, não o WebView — a rota `/m/<token>` faz
   > RFC 7233 de verdade (`EspelhoHttp.alcanceDe`, com JUnit). **Copiar o
   > `StreamProxy` para lá é o erro exato**, e é por isso que o `EspelhoHttp` é
   > um arquivo à parte, puro, e não uma parametrização daquele.

**No WebView do TELÃO** — o documento que hospeda código de terceiro por
design (a IFrame Player API do YouTube):

9. **A ponte nasce com `host = null`, e o loader é montado SEM o handler
   `/saf/`.** É o que separa "uma segunda janela do Display" de um
   comprometimento do aparelho: com `host != null`, qualquer script de terceiro
   ali dentro ganharia `pickFolder`, `listFolder`, `pickDoc`, `openExternal` —
   e, desde a v5.141, `espelhoLigar`. A regra é a mesma do telão desde sempre;
   o que muda é a agravante, porque agora existe na ponte um método que abre um
   servidor na rede da igreja. `tools/ponte.test.mjs` a trava.

**No `AndroidManifest.xml`:** `android:hardwareAccelerated="true"` e
`android:largeHeap="true"` — os dois WebViews, um vídeo grande e o player do
YouTube dividem o mesmo processo.

> O WebView do telão usa outro `WebChromeClient` (`MicChromeClient`, para o
> microfone), **não recebe** o handler `/saf/` e é a única instância criada com
> `keepVisible = true` — ver "Microfone ao vivo" e "A ponte".

**`KeepVisibleWebView` (só o telão).** O Chromium marca a página como `hidden`
quando a janela da View some, e é isso que acontece com a `Presentation` no
instante em que o app é minimizado. Um `<video>` local não liga; o **embed do
YouTube pausa sozinho** ao ver `document.hidden`. `onWindowVisibilityChanged`
reporta sempre `VISIBLE` para tirar esse gatilho. **Não bastou** para o YouTube
(a solução real é baixar o vídeo — ver a tabela de divergências), mas fica: o
telão é a projeção, ele continua no ar com o app minimizado de propósito, e não
há razão para o renderer dele ser desacelerado. O WebView do **Controle** segue
o ciclo normal — ali ser estrangulado em segundo plano é o comportamento certo,
e é justamente o que o `snoopDisplayStatus` existe para contornar.

**Reconexão vem de graça:** quando o dongle cai e volta, o Android destrói e
recria a Presentation, o WebView recarrega `/display/` e dispara
`display-ready` — e o Controle reenvia a cena ao receber isso
(`resendSceneToDisplay` em `controle.js`). Não invente um mecanismo paralelo.

**E o reenvio é ENDEREÇADO** (v5.140). O barramento é broadcast, mas a resposta
a um `display-ready` é para UMA instância: o telão assina o anúncio (`__de`, um
id aleatório por carregamento da página) e o Controle devolve a cena com
`__para`, que o `onCommand` do Display confere antes de qualquer outra coisa.
Sem isso — e foi assim até a v5.139 — qualquer segunda instância de `/display/`
que abrisse, recarregasse ou fosse restaurada pelo navegador fazia a TV rodar um
`load` inteiro (fade de saída, releitura da mídia, re-seek, fade de entrada) na
frente da congregação, por um evento que não era dela. Comando **sem** `__para`
continua valendo para todos, que é o caso de **todos** os comandos de operação:
só o reenvio de cena endereça, e um bundle antigo de qualquer um dos dois lados
cai de volta no broadcast de sempre. `tools/display-smoke.mjs` trava a regra.

A **cena** é mais do que "mídia tocando":

- Reenvia **toda mídia carregada**, não só a que está tocando. A condição
  anterior (`playing || isImage`) deixava de fora justamente o caso mais comum
  de uma queda de dongle: o louvor de fundo PAUSADO para a oração. Um vídeo
  pausado mostra o quadro congelado no telão e um áudio pausado mantém a letra
  em cena — nos dois casos há algo projetado, e nos dois casos ele sumia.
- O `load` leva **posição e estado de reprodução** (ver a seção do barramento).
- Reenvia também o `text` do sorteio, do cronômetro, do versículo ou da
  mensagem que estiverem projetados — nessa ordem, já que no Display um `load`
  visual encerra a Camada de Texto e um `load` de áudio a mantém. Cronômetro e
  sorteio voltam pelo **descritor** (`startAt`), não por um valor: o telão
  recalcula o número a partir do mesmo instante de origem e reaparece no segundo
  certo, não no ponto em que a conexão caiu.

**Morte do renderer também é recuperável:** `WebViewFactory.create` recebe um
callback `onRendererGone` e o `WebViewClient` devolve `true` em
`onRenderProcessGone`. Sem isso o padrão do framework é matar o processo — um
OOM do renderer derrubaria o Controle e a projeção juntos. Cada dono
(`MainActivity`, `StagePresentation`) remonta o próprio WebView, e o telão
recarregado dispara `display-ready`, caindo no mesmo caminho de reconexão
acima.

O que morre com o renderer **não se limita à página**: os `fetch` em voo morrem
junto e o `finally` de `withBgWork()` nunca roda, então ninguém mais chamaria
`keepAlive(false)`. `buildControleWebView` zera o estado de trabalho em segundo
plano ao remontar — senão sobravam para sempre o foreground service, a
notificação congelada no último progresso e um wake lock de 2 h, e a guarda de
`setBackgroundWork` transformava o próximo download real em no-op.

---

## A ponte `window.AVNative`

Definida em `shared/native.js` (lado web) sobre `__AVBridge` (lado Kotlin,
`NativeBridge.kt`). **Só existe quando `window.__AVBridge` existe** — no
navegador a IIFE retorna logo na entrada e nada é definido, nem `__NATIVE__`.

```js
window.AVNative = {
  pickFolder(),        // → { id, name, uri }   (SAF ACTION_OPEN_DOCUMENT_TREE)
  pickDoc(mimes),      // → [{ url, name, type }]: o SELETOR DE ARQUIVOS do aparelho
  listFolder(uri),     // → [{ name, size, mtime, type, url }]   (só no Controle)
  onShare(cb),         // cb({ files:[{name,type,size,url}], url, title })
  displays(),          // → [{ id, name, w, h, density }]
  onDisplayChange(cb),
  openCast(),          // seletor de ESPELHAMENTO DE TELA do Android (≠ Google Cast)
  castTarget(),        // → string: rótulo do alvo de espelhamento deste aparelho
  openExternal(url),   // abre uma URL https FORA do app (só o Controle)
  ytFetch(url, onProg, soAudio, altura), // → { url, name, size, type, height, seconds }
                       //   `soAudio` traz só a faixa de áudio (m4a) — exige shell 23
                       //   `altura` é o TETO de resolução — exige shell 25 abaixo de 1080
  ytDiscard(url),      //   e apaga o arquivo depois que os bytes foram copiados
  ytCancel(url),       // PARA o download em curso deste link — exige shell 28
  otaPending(),        // → versão da base web já baixada que espera (ou '')
  otaApply(),          // APLICA-a agora: as duas páginas recarregam — shell 29
  otaCheck(forcar),    // PROCURA agora; `forcar` pula o piso do shell — shell 31
  otaDiag(),           // → string: quando foi a última busca e o que ela deu
  apkProcurar(),       // → { versao, url, notas } da Release nova, ou null — shell 35
  apkInstalar(url),    // baixa e abre o diálogo de instalação do sistema — shell 35
  ytDiag(),            // → string: o que o extrator recebeu na última extração
                       //   (diagnóstico do rodapé de Configurações)
  ytStream(url, altura), // → manifesto DASH { video, audio, seconds, height } ou null
                       //   TRANSMITIR sem baixar — exige shell 26
  ytSearch(termo),     // → [{ id, url, name, author, seconds, thumb }] do YouTube
  deckPages(origem, nome, onProg), // → { name, pages:[url] } ou { erro }: PDF em imagens
  deckExportUrl(link), // → URL de exportação PDF de um link do Google Apresentações
  deckDiscard(url),    //   e apaga as páginas depois da cópia
  captureVolumeKeys(bool), // botões físicos de volume vão para o app
  systemVolume(step),  // devolve um passo ao volume do sistema (fader no limite)
  temaClaro(bool),     // o TEMA escolhido: ícones das barras + windowBackground
  requestMic(),        // → bool: permissão RECORD_AUDIO (push-to-talk)
  keepAlive(bool),     // download em curso — ver "Trabalho em segundo plano"
  bgProgress({label, done, total, etaMs, items, idleMs, bytes}), // progresso na notificação
  nowPlaying({active, title, subtitle, playing, slideMode, slideLabel, wallpaper, positionMs, durationMs}),
  onRemote(cb),        // cb('play'|'pause'|'playpause'|'prev'|'next'|'stop'|'view')
  // ---- TELÃO POR COMANDOS (shell 32; forma atual = 37) — ver a seção ----
  espelhoLigar(modo),  // liga a transmissão (o argumento é IGNORADO desde a
                       //   v5.156 — ficou para não custar um degrau de shell)
  espelhoDesligar(),   // síncrono e sem resposta, como o `ytCancel`
  espelhoEstado(),     // → { ligado, endereco, erro, telas:[…] }
                       //   (sem `codigo` desde a v5.189: a porta é o ENDEREÇO)
                       //   cada tela: { rotulo, comando:true, conectadaMs,
                       //   telaAcesaMin, aviso, eventos, pronta, fila }
  espelhoDiag(),       // → JSON do Registro (servidor, sessões, cache de
                       //   mídia, telas por comando)
  espelhoDerrubar(rotulo), // tira ESTA tela do ar (o "Desconectar" da folha).
                       //   No Kotlin ele ainda é `espelhoAprovar(id, sim)` —
                       //   a assinatura ficou para não custar outro degrau de
                       //   SHELL_VERSION, e o `sim` é ignorado
  espelhoCertImportar(url, senha), // → '' ou a FRASE do erro: o .p12 do TLS
  espelhoCertEstado(), // → { temCert, host, ate, nome, noAr, servindoTls }
  espelhoCertApagar(), // a chave privada sai do aparelho
                       //   OS TRÊS ESTÃO SEM UI DESDE A v5.196: a folha de
                       //   "Ajustes avançados" era a única porta deles e saiu.
                       //   Ficam na ponte de propósito — voltar atrás é
                       //   desenhar uma folha, não publicar uma Release.
}
```

São **quarenta métodos**, e essa é a superfície inteira que o resto do
lado web tem direito de usar: fora do `native.js`, tocar em `__AVBridge` direto é
acoplamento indevido. O próprio `native.js` chama mais oito coisas no
`__AVBridge`, e nenhuma delas é API para o app — duas são
`ytFetchAudio` e `ytFetchAte`, que não são métodos a mais da ponte web e sim os
outros dois DESTINOS do `ytFetch`: um quando se pede só o áudio, outro quando se
pede um teto de resolução menor que o padrão (ver "Divergências") — `shellVersion()`, `role()` e
`appVersion()` viram as globais logo abaixo, `busPost()` é o relay do barramento,
`otaConfirm()` é o watchdog do OTA e `takeShare()` é o consumo do
compartilhamento pendente (é ele que alimenta o `onShare`).

Além disso, `native.js` publica **quatro globais** lidas direto (sem Promise):
`window.__NATIVE__`, `__AV_ROLE__` (`'controle'`/`'display'` — o terceiro
valor, `'tela'`, é escrito por `espelho/tela.js`, não pela ponte),
`__SHELL_VERSION__` (o inteiro do contrato, ver abaixo) e **`__SHELL_NAME__`** —
o `versionName` do APK, que é o **índice de versão do shell exibido ao
operador**. Ele não se confunde com `__SHELL_VERSION__`: base web e shell
atualizam por caminhos independentes (OTA × instalar APK), então o rodapé de
**Configurações** mostra os dois (`Web v5.98 · Shell v<versionName do APK>`,
montado em `renderVersionLabel`; até a v5.48 ficava no cabeçalho do Cronograma —
saiu de lá porque metadado de diagnóstico pertence à mesma tela do estado do
telão, não a uma faixa de navegação). Num shell antigo (sem
`appVersion()`) a string vem vazia e a UI cai em só a versão web — mesma
degradação do navegador.

**Princípio: a ponte entrega URLs SERVÍVEIS, não bytes.** Arquivos do
dispositivo e compartilhamentos chegam como
`https://appassets.androidplatform.net/saf/<token>` e o lado web usa `fetch()`
+ `Blob` exatamente como já faz com o OPFS — nenhuma função de importação
precisou ser reescrita, e **um vídeo de 2 GB nunca passa por base64**.

Sobre o token (`SafRegistry`, em `SafPathHandler.kt`):

- Ele é **opaco**, e não o URI codificado, porque o `PathHandler` recebe o
  caminho já decodificado: um `content://` com barras viraria segmentos de rota
  e quebraria o roteamento.
- É **aleatório** (128 bits em base64url, `SecureRandom`), e não um contador.
  Um contador é adivinhável por construção, e as entradas **nunca expiram** —
  não custa nada deixar `/saf/1..N` fora do alcance de quem enumerar.
- **`/saf/<token>` é uma URL `https://`** — `https://appassets.androidplatform.
  net/saf/<token>`, o mesmo origin da base web. Parece óbvio escrito assim, e
  não é: quem recebe uma dessas de parâmetro e pergunta
  `origem.startsWith("https://")` para decidir "é da rede ou é local?" acerta a
  pergunta errada e manda **todo arquivo do aparelho** para o caminho de
  download. Foi exatamente isso que deixou o PDF sem funcionar da v5.97 à
  v5.99 — falha silenciosa, indistinguível de "PDF com senha". A pergunta certa
  é pelo **host** (`u.host == ORIGIN_HOST`), como manda a invariante 2.
- O mesmo URI devolve **sempre o mesmo token**. Sem esse reaproveitamento, cada
  `listFolder` de uma pasta de 500 arquivos acrescentava 500 entradas novas para
  os MESMOS arquivos, a cada re-sincronização, num processo mantido vivo de
  propósito durante todo o culto.

**Superfície nativa é privilégio do Controle.** O WebView do telão recebe a
ponte com `host = null` justamente para não ter poderes de Activity, e o loader
dele é montado **sem** o handler `/saf/`. `listFolder` honra a mesma regra e
devolve lista vazia sem host: era a exceção, porque lê o `ContentResolver`
direto, e sem a guarda qualquer script rodando no documento do Display (que
carrega a IFrame Player API de terceiro **por design**) lia o índice inteiro —
nome, tamanho e token servível — de toda pasta que o operador já concedeu. Os
dois consumidores de arquivo do dispositivo (`importShare` e `syncDeviceFolder`)
rodam no Controle e copiam os bytes para o OPFS antes de qualquer coisa chegar
ao telão; o Display nunca busca um `/saf/`.

**As Promises têm época por carregamento.** O id de chamada é
`EPOCH + ':' + seq`, com `EPOCH` aleatório a cada carga da página. O renderer
pode morrer com uma chamada em voo: a página recarrega, o contador volta a zero,
mas o `resolve` do Kotlin aponta para o WebView ATUAL — com ids "1", "2", "3" a
resposta atrasada de um `listFolder` da página velha resolvia a promise homônima
da página NOVA. As chamadas que dependem de **máquina** têm prazo de 60 s (rede
de segurança contra promise pendente para sempre); `pickFolder` e `requestMic`
esperam uma **pessoa** e ficam sem prazo, porque um timeout ali resolveria null
com o operador ainda escolhendo a pasta.

`NativeBridge.SHELL_VERSION` identifica a versão da casca — **subir sempre que
a superfície da ponte mudar**. Hoje vale **40** — a v5.206 ENCOLHE duas formas
de retorno, e as duas são resto do espelho de pixels que a v5.187 não levou
junto: `espelhoDiag` perdeu `ritmo` (o objeto continuava saindo ZERADO depois
que o encoder que o alimentava morreu, e o lado web lia `kbps < 40` como
"retângulo preto" — o Registro imprimia um ALARME em todo culto com vídeo no
ar) e `espelhoEstado` perdeu `modo` (o seletor imagem × vídeo, removido na
v5.156, que viajava como `"comandos"` e era desenhado como "modo: imagem
(JPEG)"). A lição está escrita no KDoc do `EspelhoDiag` e vale para a próxima
aposentadoria: **apagar o produtor de um campo e deixar o consumidor de pé não
produz silêncio — produz um zero, e zero é um valor legítimo que o consumidor
interpreta.** O anterior, **39** (v5.192), acrescentou
`temaClaro`, o único pedaço do tema claro que o CSS não alcança: os ÍCONES das
barras de sistema (que o Android desenha, e que ficariam brancos sobre um fundo
quase branco) e o `windowBackground`, resolvido antes de existir JavaScript. Num
shell 38 o bundle novo funciona por inteiro — a cor de tudo vem do CSS e chega
por OTA —, e o app fica com as barras do tema escuro. O anterior, **38**
(v5.189), ENCOLHE duas vezes:
`espelhoEstado` perdeu `codigo` (a entrada da tela deixou de ter segredo — a
porta é o endereço) e saiu `keepAudioAlive`, que só existia para a mesa de som.
Um bundle antigo num shell 38 desenharia um teclado de três dígitos pedindo um
número que ninguém mais publica, e é isso que o degrau impede. O anterior, **37**
(v5.187, o telão por comandos, E7), não acrescentou método nenhum, mas mudou a **FORMA do que
`espelhoEstado` e `espelhoDiag` devolvem**: as telas passaram a ser as da
transmissão por comandos (`comando: true`, `conectadaMs`, `telaAcesaMin`,
`pronta`, `fila`) e o diagnóstico perdeu o bloco inteiro de encoder/tela
virtual/readback — forma mudada é superfície mudada, pelo mesmo raciocínio da
v5.133. É também o degrau em que o canal `__avTelaMidia` (o empurrão de mídia
do Controle para o cache da rota `/m/`) passou a existir; ele é detectado por
**presença** (`window.__avTelaMidia`), não por versão, de propósito — a guarda
certa para um objeto injetado é perguntar por ele. O degrau anterior, **36**
(v5.185/v5.186), foi o primeiro deste contrato que **ENCOLHE**: saiu
`requestCam` (com o pareamento por QR e a permissão `CAMERA` do manifest),
`espelhoEstado` trocou `pin` por `codigo` (os TRÊS dígitos, como STRING) e
perdeu `autoAprovar`, `pendentes`, `qrEsperando`, `nomeLocal` e `nomeErro`, e
`espelhoAprovar` passou a fazer uma coisa só — derrubar a tela cujo rótulo ele
recebe (o lado web o chama de `espelhoDerrubar`). O bump é o que impede um
bundle antigo de ler `pin` num shell que só publica `codigo`: ele mostraria o
campo vazio, e o operador ficaria sem o número que a tela precisa digitar, sem
nada que o explicasse. A v5.167 (35) acrescentou
`apkProcurar`/`apkInstalar`. A v5.152 acrescentou os três
métodos do CERTIFICADO do espelho (`espelhoCertImportar`, `espelhoCertEstado`,
`espelhoCertApagar`), o degrau opcional de TLS. Abaixo do 34 a linha do
certificado não é desenhada e o espelho segue em HTTP claro, que é o que ele
sempre foi. A v5.145 acrescentou
`requestCam`, a permissão de CÂMERA do pareamento por QR — **os dois saíram na
v5.185**, com a câmera e com o `qr.js`.
A v5.141 acrescentou os cinco
métodos do ESPELHO DE PIXELS (`espelhoLigar`, `espelhoDesligar`,
`espelhoEstado`, `espelhoDiag`, `espelhoAprovar`). Os cinco são **privilégio do
Controle** (`host != null`, invariante 9) e os cinco ficam **FORA da fila de
IO**: ela é uma thread única e é onde roda o download do YouTube, então "ligar o
espelho" no meio de um download não aconteceria — a Promise venceria pelo prazo
de 60 s do `native.js` e resolveria `null`, um "erro" sem causa. Quem faz o
trabalho é a **main thread**, e isso não é preferência: uma `Presentation` é um
`Dialog`, e um `Dialog` criado na fila de IO (uma `Thread` daemon sem `Looper`)
lança `Can't create handler inside thread that has not called Looper.prepare()`
no primeiro toque. A v5.136 acrescentou
`otaCheck`/`otaDiag` (a procura de atualização agressiva). A v5.133 (shell 30)
não acrescentou método nenhum, mas mudou o **comportamento do `ytFetch`**: pedir
o mesmo download outra vez passou a RECLAMAR o desfecho guardado no shell
(`YoutubeGrab.resgatar`, chamado no caminho do `ytFetch` — ver "E o download
SOBREVIVE À MORTE DA PÁGINA"), e é dessa promessa que depende a guarda `>= 30`
de `resgatarDownloads` em `controle.js` — comportamento mudado é superfície
mudada, pelo mesmo raciocínio da v5.127 abaixo. A v5.132 acrescentou
`otaPending`/`otaApply` (o aviso de atualização e o "aplicar agora"). A v5.131 acrescentou
`ytCancel` (parar o download em curso). Ele é o único método da ponte que **não
vai para a fila de IO**, e não poderia: a fila é de uma thread só e está ocupada
justamente pelo download que se quer parar. Ele escreve um campo `@Volatile` e
volta; quem responde é o laço de cópia do `YoutubeGrab`, que o consulta a cada
bloco de 64 kB. A v5.127 não acrescentou
método nenhum, mas mudou o **contrato das URLs que o `ytStream` devolve**: a
faixa de bytes passou a viajar na QUERY (`/stream/<token>?r=<ini>-<fim>`) e o
cabeçalho `Range` sumiu do caminho nativo, porque dentro de um WebView ele é
fatal (invariante 8). Contrato mudado é superfície mudada, e sem o bump o lado
web não teria como perguntar por onde a faixa deve ir. A v5.120 acrescentou `ytStream`
(o manifesto da transmissão direta), a v5.118 acrescentou
`ytFetchAte` (teto de resolução escolhido pelo operador) e o campo `bytes` do
`bgProgress` (que sozinho não exigiria bump, porque só acrescenta um campo a um
JSON, mas o lado Kotlin passou a formatá-lo e a web precisa saber se ele o
entende), a v5.115 acrescentou `ytDiag`
(diagnóstico da extração do YouTube), a v5.112 acrescentou
`ytFetchAudio` (só a faixa de áudio de um vídeo do YouTube), a v5.100 fez `deckPages`
devolver o MOTIVO da falha (`{ erro }`) em vez de `null`, a v5.99 mudou a ASSINATURA do
`pickDoc` (que passou a receber os mimes e a devolver uma LISTA, porque virou a
importação inteira do app e não só o seletor de PDF), a v5.98 o acrescentou, a
v5.97 os três métodos da
APRESENTAÇÃO (`deckPages`/`deckExportUrl`/`deckDiscard`), a v5.85 acrescentou
`ytSearch`, a v5.83 `keepAudioAlive`, a v5.81 `ytFetch`/`ytDiscard` e a v5.76
`openExternal`. (A v5.48 não a mexeu: nenhum método foi acrescentado ou teve
assinatura alterada, e as mudanças do lote foram restrições de quem pode chamar
o quê, que nunca exigem shell mais novo.)

**Um método novo NÃO chega por OTA.** O bundle segue com `minShell: 2` de
propósito — subi-lo recusaria a atualização inteira em todo aparelho com shell
antigo, que é muito pior do que um recurso a menos. Quem depende de um método
novo pergunta antes: `appendYoutubeSearch` não desenha o botão quando
`__SHELL_VERSION__ < 15`, porque um botão que não faz nada no meio de um culto é
pior que botão nenhum. Ele aparece sozinho depois que o APK novo for instalado.
A linha do espelho em Configurações segue a mesma regra, com `< 32`.

---

## Barramento de comandos e o plano B do BroadcastChannel

`BroadcastChannel` entre dois WebViews same-origin no mesmo processo **deve**
funcionar — mas o isolamento de sites do WebView pode surpreender, e uma falha
aí derrubaria o comando do telão no meio de um culto.

Em vez de detectar a falha (handshake com janela de corrida), o **relay nativo
roda SEMPRE em paralelo**: cada comando sai pelos dois caminhos
(`BroadcastChannel` + `MessageBus` nativo) e a cópia repetida é descartada em
`shared/db.js` pelo campo `__mid`. O resto do sistema não sabe de nada —
`sendCommand`/`onCommand` mantêm exatamente a mesma assinatura. O custo é
desprezível: os comandos são objetos JSON pequenos.

### O DRENO do papel `tela` — uma lista de PERMISSÃO de dois itens

Cada tela da rede roda uma **cópia de `/web/display/`** (papel `tela`, ver a
seção do telão por comandos), ligada ao MESMO barramento por SSE. É o mesmo
arquivo — e é justamente por ser idêntico que **ele não pode falar tudo**: a
arquitetura inteira supõe UM telão. `display-status` sai a ~4 Hz de cada um, e
o Controle (e o `snoopDisplayStatus`, que alimenta a notificação de mídia
justamente quando o app está minimizado) passaria a ter N fontes alternadas;
`media-ended` dobrado dá um segundo `load` do mesmo item em `repeat one`;
`mic-status` da tela — que **nega `getUserMedia` em silêncio**, por não ter o
`MicChromeClient` — apagaria o estado do microfone VERDADEIRO; e `diag-ask`
respondido por vários faz o Registro mostrar o diário de um deles sem dizer
qual.

O dreno mora em `espelho/tela.js` (o `__AVBus.post` do papel) e é uma lista de
**permissão** de dois itens — um tipo de mensagem novo em `display.js` nasce
mudo por construção:

- **`display-ready` passa, com `__tela`.** É esse anúncio que faz o Controle
  reenviar a cena (`resendSceneToDisplay`) — drenado por inteiro, a tela fica
  no wallpaper até alguém tocar em alguma coisa, exatamente nos três casos em
  que ela precisa se recuperar sozinha: ligada no meio do culto, recarga da
  página e queda de rede. É seguro porque o reenvio é **endereçado** desde a
  v5.140 (`__de`/`__para`): o telão de verdade descarta o que não for dele.
- **`display-status` sai RENOMEADO para `tela-status`** (o herdeiro do
  `espelho-status` da v5.173): **sem TV as telas da rede SÃO a projeção**, e
  calá-las deixaria o Controle sem referência de tempo nenhuma — sobraria a
  preview, que é justamente o que o Android estrangula quando o app sai da
  frente. Com um nome PRÓPRIO nada que espera "o telão" o recebe por engano: o
  `controle.js` **elege UMA tela** como referência (e converte o status dela em
  `espelho-status`, que os consumidores já conhecem), e o
  `NativeBridge.snoopStatusDeFora` faz a mesma conta de precedência para a
  notificação de mídia. Ver "A referência da preview", abaixo.
- **O `BroadcastChannel` é NEUTRALIZADO NO ENVIO, nunca apagado.** `db.js`
  escolhe o canal perguntando `'BroadcastChannel' in global`: apagar a
  propriedade deixaria a tela com um único caminho de **recepção**, e a
  redundância dos dois caminhos é decisão escrita deste projeto. O que morre é
  só o `postMessage`, por uma subclasse do construtor real — e a troca precisa
  acontecer **antes de `db.js`**, que captura o construtor na carga.

### A referência da preview — ela ILUSTRA, nunca mede

A preview do Controle é uma **ilustração** do que está no telão, e nunca a fonte
de verdade. Ela roda no WebView do Controle, que é o único dos três que o
Android estrangula quando o app sai da frente: com o app minimizado o `<video>`
dela é pausado ou desacelerado enquanto a projeção segue andando, e ao voltar a
distância entre os dois é arbitrária. **Enquanto ela for a régua, não há como
corrigir isso — o erro está na régua.**

A projeção é uma destas três, nesta ordem:

1. **o TELÃO** (`display-status`), quando há TV conectada;
2. **a TELA ELEITA** (`tela-status` → `espelho-status`), quando não há TV: as
   telas da rede são o que a congregação vê, e cada uma roda o próprio
   `/display/` com um `<video>` de verdade — num navegador que o Android do
   celular não estrangula;
3. **ninguém** — sem TV e sem espelho a projeção É a preview em tela cheia, que
   exige o app na frente. Aí ela é a própria referência, e o caso não existe.

Daí duas funções com nomes distintos, e a distinção é o modelo inteiro:
`authoritativeTime()` responde **"o que está no ar agora?"** (decisões: qual
estrofe vem a seguir, o que a barra marca, o que a `MediaSession` publica) e
`tempoDaPreview()` responde **"o que a ilustração deve estar desenhando?"** (o
`<video>` da preview e a letra desenhada dentro dela). Sem as duas, o atraso
deliberado da preview vira defeito nos dois sentidos: quem desenha a letra pelo
tempo da projeção troca a estrofe antes da imagem a que ela pertence, e quem
realinha o `<video>` pelo tempo da projeção **desfaz o atraso** a cada status.

Três regras completam o desenho:

- **O realinhamento mira `projeção − atraso`**, nunca a projeção. Com
  `PREV_ATRASO_MAX` (2,5 s) maior que a tolerância antiga (1,6 s), mirar a
  projeção faria cada `display-status` puxar a preview para a frente — o resync
  brigando com o atraso, a 4 Hz.
- **A tolerância é de meio segundo, não de 1,6 s.** A preview **não tem som**
  (desde a v5.189 não tem por construção — a mesa de som saiu); sem som um seek custa
  um quadro e não estala nada. Ao **retomar do segundo plano** ela cai para
  `RESYNC_EXATO` (0,15 s): ali não há ruído a poupar, há um desvio conhecido.
- **Com a página escondida a preview não atrasa nada.** O atraso existe para o
  operador não ver a preview responder antes das telas da rede; sem plateia ele
  só serve para empilhar comandos numa fila cujos `setTimeout` o Android
  estrangula. Escondida, ela aplica na hora — e é dessa posição que o
  realinhamento da retomada parte.
- **E escondida ela também não é TOCADA** (`preverPodeMexer`, v5.177). O
  Chromium pausa um `<video>` de página oculta: o `play()` do resync sai, o
  navegador pausa de volta, e o status seguinte recomeça — um laço a ~4 Hz que a
  linha do tempo do Registro mostrou par a par, com a marca `[oculto]`. Não é só
  inútil: **os WebViews dividem UM processo**, e essa rotatividade de
  decodificador rouba fio de todo o resto — foi ela que, na era do espelho de
  pixels, matava o áudio das telas da rede. A janela de
  `forcarResyncAte` só é CONSUMIDA quando há como agir,
  senão a retomada seguinte partiria de um crédito já gasto.

### O `load` carrega o ponto e o estado da mídia

O comando `load` leva, além de `mediaId`/`view`/`muted`/`volume`, dois campos
que existem **para a reconexão do telão**:

| campo | significado |
|---|---|
| `time` | segundo em que a mídia deve entrar (0 = do começo) |
| `playing` | `false` = a cena voltou PAUSADA; ausente/`true` = toca, como sempre |

Até a v5.47 a reconexão mandava só o `load`, então a mídia recomeçava do ZERO e
no estado "tocando": um hino aos 3:20 voltava do início na frente da
congregação, e um louvor pausado para a oração voltava tocando. Pior, o
`display-status` seguinte chegava com `currentTime` 0 e arrastava a preview do
Controle junto — o operador perdia até a referência de onde estava.

**Por que os campos viajam no próprio `load`, e não como um `seek`/`pause`
enviado logo depois:** o `onCommand` do Display **não serializa**. O `load` é
assíncrono (`getMedia` → `opfsGetFile` → `mediaReady`, mais o fade de saída), e
um comando que chegasse em seguida agiria sobre o `<video>` **anterior**, antes
de a fonte nova entrar — o seek seria aplicado à mídia errada e depois perdido.
Levá-los no mesmo comando é o que garante que a decisão chegue junto com a
mídia a que ela pertence.

Do lado do Display os dois caminhos honram os campos:

- `stage.js` → `load(id, v, m, vol, startAt, autoplay)`. A posição só "gruda"
  depois que a duração é conhecida — escrever `currentTime` junto com o `src` é
  perdido em silêncio —, então o `startAt` entra num `loadedmetadata` com
  `{ once: true }`, protegido pelo `loadSeq` (outro load pode ter assumido
  durante a espera). `autoplay === false` é a cena que voltou pausada;
  `undefined` mantém o comportamento de sempre, e por isso nenhum outro chamador
  precisou mudar.
- `display.js` → `loadYoutube(rec, v, m, vol, startAt, autoplay)`, que passa o
  `startAt` como `playerVars.start` (segundos inteiros — é o que a API aceita).

O comando mais frequente do barramento é o `display-status`, emitido pelo telão
a cada `timeupdate` do vídeo (além de `play`, `pause`, `loadedmetadata`,
`ended` e `volumechange`). Ele é a fonte de sincronização enquanto existir — ver
`snoopDisplayStatus`, na seção da sessão de mídia.

---

## Trabalho em segundo plano (downloads com o app minimizado)

Ao minimizar o app, o Android trata o processo como descartável e pode
**congelá-lo** — a sincronização de hinos, álbuns, Bíblia ou pastas parava no
meio. Isso acontecia no uso normal, já que ninguém fica olhando a tela
enquanto um hinário inteiro baixa.

A correção declara o trabalho ao sistema: enquanto há download, o
[`SyncService`](app/src/main/java/br/org/iasd/av/SyncService.kt) roda em
primeiro plano (com a notificação que o Android exige) e segura um wake lock
parcial — o processo não é congelado e o WebView continua baixando.

**Quem liga e desliga é o lado web**, que é quem sabe o que está em curso:
`bgWorkBegin()`/`bgWorkEnd()` em `controle.js` contam as tarefas ativas e só
acionam `AVNative.keepAlive()` no **primeiro** início e no **último** término —
dois downloads simultâneos não podem fazer o primeiro a terminar desligar a
proteção do outro. O `finally` de `withBgWork()` é o ponto crítico: uma falha
de rede não pode deixar o serviço e o wake lock ligados.

Pontos cobertos: `syncGroup` (o lote de coleções), `syncCollection` (massa),
`ensureSongDownloaded` (avulso), `syncLyrics`, `ensureBibleVersionDownloaded`
(1189 capítulos) e `syncDeviceFolder` (pastas — o único que chama
`bgWorkBegin`/`bgWorkEnd` direto, em vez de passar por `withBgWork`; o `finally`
dele já existia para outra coisa). O wake lock tem timeout de 2 h, para um
download travado nunca consumir bateria indefinidamente. No navegador tudo isso
é no-op.

### O download RETOMA de onde parou (v1.58)

Enquanto o app estiver vivo — na frente ou em segundo plano —, um download só
deve terminar de duas formas: concluído, ou cancelado pelo operador. Faltava a
parte da rede.

Até aqui, uma oscilação de 20 segundos no meio de um louvor de 380 MB derrubava
o download inteiro: a tentativa seguinte recomeçava do **byte zero** (com outro
perfil de UA), e esgotados os três perfis ele falhava. Numa rede de igreja isso
é indistinguível de "o app não baixa".

Agora `YoutubeGrab.baixar` é um laço de retomada:

- **`Range: bytes=<o que já está no disco>-`**, e o arquivo é aberto em modo
  APÊNDICE. Uma queda custa os segundos da reconexão, não o download.
- **Oito tentativas com espera crescente** (1 s → 30 s, ~2 min de tolerância).
  A espera acorda a cada 250 ms para ver se o operador cancelou — um cancelar
  que só fosse notado 30 s depois não seria um cancelar.
- **4xx não é retentado** (`RecusaDoCdn`): a URL expirou ou a faixa foi negada,
  e insistir nela é perder tempo — quem tem outras cartas é a fila de
  candidatos de quem chamou.
- **O servidor que ignora a faixa** (responde 200 em vez de 206 a um pedido com
  `Range`) faz o arquivo recomeçar do zero em vez de acrescentar: continuar
  daria um arquivo com o começo repetido no meio — corrupção que só apareceria
  na hora de tocar.

### E o download SOBREVIVE À MORTE DA PÁGINA (v1.59)

O download roda no shell; quem o espera é um `fetch` da PÁGINA. Quando o
renderer morre — dois WebViews, um vídeo grande e o player do YouTube dividem o
mesmo processo, e o OOM é evento conhecido —, o arquivo terminava de baixar e
não sobrava ninguém para recebê-lo. Dez minutos viravam nada, sem explicação.

A recuperação é uma dobradiça de duas metades, e nenhuma funciona sozinha:

- **O shell guarda o desfecho** (`YoutubeGrab.resgatar`) num slot único — a fila
  de IO é de uma thread só, então há no máximo um download por vez, a mesma
  premissa do cancelamento. Ele é conferido por link **e pela forma** (só áudio,
  teto): devolver o m4a para quem pediu o vídeo seria pior que não guardar nada.
  Quem o descarta é o `descartar()`, o mesmo ponto em que os bytes já foram
  copiados para a biblioteca.
- **A página registra a INTENÇÃO** antes do primeiro byte, no `state` do banco
  (o único lugar que sobrevive à morte dela), e a apaga no `finally`. Uma
  intenção que sobrevive a um lançamento é, por definição, um download que
  ninguém recebeu.

Reclamar é **pedir o mesmo download outra vez**: o shell devolve o resultado
guardado na hora, sem rede. Se o processo inteiro tiver morrido (e com ele o
slot), o pedido vira um download normal — que agora retoma do parcial em disco,
se ele for da mesma faixa. O destino original é honrado: quem pediu "para o
Cronograma" recebe no Cronograma.

Intenção com mais de 6 h é descartada: as URLs do YouTube expiram, e reviver na
manhã de domingo o download de anteontem é gastar rede por algo que ninguém
está esperando.

**A retomada só vale para a MESMA faixa**, e isso é uma trava, não um detalhe: o
arquivo de destino é nomeado por vídeo + contêiner, então dois itags do mesmo
contêiner (137 e 136, ambos mp4) escrevem no mesmo caminho. Sem a conferência
(`parciais`, um mapa em memória de caminho → URL), um parcial do 137 deixado por
um app morto seria "retomado" por um download do 136 — e o arquivo teria dois
vídeos emendados, sem erro nenhum, aparecendo só na hora de projetar. O mapa
morre com o processo de propósito: retomar entre execuções exigiria gravar qual
faixa era, e o ganho não paga o risco de errar essa conta.

> **A TRANSMISSÃO viaja no MESMO serviço da sessão de mídia desde a v5.190.**
> Da v5.141 à v5.189 ela tinha um serviço próprio (`EspelhoService`), e o
> argumento era bom — "nunca um campo a mais no `SyncService` ou no
> `SessionService`: ciclos de vida diferentes, e empilhar dono é o caminho para
> o cartão eterno". Ele estava certo sobre ciclo de vida e errado sobre o preço:
> num culto com transmissão ligada e mídia no ar, a gaveta mostrava DOIS cartões
> do mesmo app, e só um servia para alguma coisa. Agora o [`SessionService`] tem
> **duas razões independentes de viver** (cena · transmissão) e só para quando
> as duas caem — a mesma disciplina, num `if` explícito em vez de espalhada por
> dois arquivos que não se conhecem. O tipo é a UNIÃO
> (`mediaPlayback|connectedDevice`), e nenhum dos dois tem cota — o teto de 6 h
> em 24 h é do `dataSync`, que o `SyncService` gasta com hinário, Bíblia e
> pastas. O pré-requisito que derruba a primeira Release continua valendo: além
> de `FOREGROUND_SERVICE_CONNECTED_DEVICE`, o tipo exige **uma** de
> `CHANGE_NETWORK_STATE`/`CHANGE_WIFI_STATE`/`CHANGE_WIFI_MULTICAST_STATE`/
> `NFC`/`TRANSMIT_IR` — e `INTERNET`/`ACCESS_NETWORK_STATE`, as duas que o app
> tem, **não estão na lista**. Sem declarar `CHANGE_WIFI_MULTICAST_STATE`
> (nível *normal*, sem diálogo), `startForeground` lança. O que sobrou no
> `EspelhoEnergia` é o que nunca foi sobre notificação: o wake lock (renovado
> por progresso REAL de entrega, nunca por tique de relógio), o Wi-Fi lock e a
> leitura térmica.

### O ciclo de vida do serviço tem duas armadilhas, e as duas matam o app

- **`startForeground` SEMPRE, antes de qualquer decisão de parar.** Um serviço
  iniciado por `startForegroundService` que morre sem ter chamado
  `startForeground` faz o sistema derrubar o app inteiro ("did not then call
  Service.startForeground()") — e o processo é o dos dois WebViews e da
  `Presentation` na TV. Publicar primeiro custa uma notificação de alguns
  milissegundos; a alternativa custa o culto. Só depois disso o
  `onStartCommand` verifica se o download já acabou enquanto o serviço subia
  (um item já baixado liga e desliga a proteção em poucos ms) e se despede
  sozinho com `stopSelf(startId)`.
- **A notificação segue o serviço, e não o contrário.** `updateProgress` usa
  `NotificationManager.notify`, que é independente do ciclo de vida de um
  `Service`: sem a guarda de `running`, um cartão "Baixando mídias" com
  `setOngoing(true)` ficava na gaveta para sempre, sem download nenhum por
  trás. O `onDestroy` zera a flag antes de tudo e cancela o cartão
  explicitamente.
- **Cota de FGS do Android 15** (`onTimeout`): com `targetSdk` 35 um serviço
  `dataSync` tem teto de 6 h acumuladas em 24 h, e o acumulado não é
  hipotético — configurar um aparelho novo soma hinário completo, uma versão da
  Bíblia e a cópia de pastas de vídeo. Atingido o teto, o sistema dá poucos
  segundos para parar, ou derruba o processo por ANR. Parar é a única resposta
  possível, mas o lado Kotlin precisa **esquecer** que estava protegendo
  (`SyncService.onGone` → `backgroundWork = false`): senão o
  `if (on == backgroundWork)` da Activity trata o próximo `keepAlive(true)` como
  repetido e o download seguinte fica sem proteção nenhuma, calado.

### A notificação mostra o progresso real

Com o app minimizado ela é a ÚNICA janela para o download, e era um texto fixo
("Baixando mídias") — não dizia quanto falta nem se ainda anda. Quem sabe o
progresso é o lado web, então é ele que reporta, por
`AVNative.bgProgress({label, done, total, etaMs, items, idleMs, bytes})`:
`bgTaskStart`/`bgTaskStep` em `controle.js` alimentam
`SyncService.updateProgress`, que refaz a notificação com barra, "N de M",
percentual e o tempo restante.

- **A unidade pode ser BYTES, e não itens** (`bytes`, v5.118). O registro nasceu
  contando itens — 54 músicas, 1189 capítulos —, e para um lote é a unidade
  certa. Mas o download de UM vídeo do YouTube abria a tarefa com `total = 1`, e
  aí os dois números que a notificação existe para dar simplesmente não
  existiam: a barra ficava em 0% do começo ao fim e a ETA era **zero**, porque
  `bgTaskEta` precisa de pelo menos um item concluído para ter média. Ou seja, o
  caso em que a notificação é a ÚNICA janela — app minimizado, centenas de MB,
  minutos de espera — era o caso em que ela não dizia nada. Os bytes sempre
  estiveram à mão (o shell os reporta a cada MB); faltava um canal. Como
  percentual e ETA são RAZÕES, toda a matemática vale sem mudar uma linha —
  trocar a unidade é só isto, e o que muda é a APRESENTAÇÃO (`formatBytes` no
  `SyncService`). A bandeira mora no REGISTRO da tarefa, não no envio: um lote
  de músicas pode estar rodando ao lado de um download de vídeo, e a unidade é
  de cada tarefa.
- **E ela NÃO CHEGAVA a viajar, desde a versão que a criou** (corrigido na
  v5.137). `native.js` não repassa o objeto que recebe — ele o REMONTA campo a
  campo antes de serializar —, e `bytes` simplesmente não estava na lista. Do
  lado Kotlin, `optBoolean` lê ausente como `false`, que é um valor legítimo:
  sem exceção, sem log, sem nada. O efeito era a notificação apresentar BYTES
  como se fossem ITENS — "0 de 398458880" para um vídeo de 380 MB, que se lê
  como quatrocentos milhões de músicas. É o mesmo modo de falhar do
  `slideLabel` no `nowPlaying` (v5.97 → v5.102), e agora há um teste que o
  prende: `tools/ponte.test.mjs`. **Campo novo no objeto = campo novo no
  `native.js`**, sempre.
- `Long`, e não `Int`, do `optLong` da ponte até o `Progress`: um vídeo de 1080p
  passa dos 2 GB que o `Int` comporta, e o estouro sairia como uma barra andando
  para trás. Pelo mesmo motivo `setProgress` recebe **milésimos** em vez das
  unidades cruas — ele é `Int` por assinatura, e 1/1000 é muito além do que uma
  barra de notificação distingue. **E o `Long` do Kotlin não bastava**: o
  `native.js` truncava com `| 0` — um Int32 COM SINAL — antes de o número
  chegar lá, então um vídeo acima de 2 GB virava negativo e o `Math.max(0, …)`
  o zerava. A truncagem acontecia do lado de cá o tempo todo (v5.137).
- **O PERCENTUAL VEM NA FRENTE** (v1.61). Ele fechava uma linha que já trazia
  dois tamanhos e um tempo restante, dentro do subtexto — que é o pedaço que o
  Android encurta primeiro. O número que responde "quanto falta?" numa leitura
  era o primeiro a sumir; os tamanhos são o detalhe que o qualifica, não o
  contrário.
- **O nome do que está baixando vale também para um item só.** `ytArquivo` chama
  `bgItemOnly` com o título do vídeo: "Baixando vídeo" sozinho não diz QUAL, e
  com o app minimizado não há outra tela para perguntar.
- **`(lidos, total)` é BYTES, e o caminho de 1080p mentia** (corrigido na
  v1.58). Ele reportava uma escala de 0 a 100 (`lidos * 10 / total, 100` no
  áudio, `10 + lidos * 88 / total` no vídeo) para ter uma barra só que não
  voltava ao zero entre as duas faixas. Só que o outro lado trata os dois
  números como bytes: a notificação anunciava **"0 B de 100 B"** para um vídeo
  de 380 MB — que se lê como CEM ITENS. Agora as duas fases reportam bytes de
  verdade, e os dois números são sempre verdadeiros, que é a única coisa que
  essa notificação existe para dizer.
- **E a fase do áudio já conta a soma das DUAS faixas** (v1.62). A v1.58 deixou
  o total crescer no meio do caminho — o áudio reportava o tamanho dele, e o
  vídeo passava a somar os dois —, e o preço disso foi aceito como "a barra
  recua uma vez". Não era isso que o operador via: o áudio são poucos MB e baixa
  em segundos, então **todo download começava marcando 100%** por alguns
  instantes (o fim da primeira fase) para só então recomeçar do zero. A primeira
  coisa que aparecia na tela dizia o oposto do que estava acontecendo. Agora a
  fase do áudio já soma o `contentLength` da faixa de vídeo que vem a seguir —
  o extrator o entrega antes do primeiro byte —, e a barra sobe de 0 a 100 uma
  vez só. Quando o YouTube não informa esse campo (ele vem `-1`), nada muda: o
  comportamento é o de antes. Vale para a barra da notificação e para o
  percentual na linha do item, que leem o MESMO par de números.

- **A notificação diz O QUE está baixando, não só quantos.** `bgItemStart`/
  `bgItemEnd` (e `bgItemOnly`, para fluxos sequenciais) registram os itens em
  voo — nome da música, "Gênesis 3", nome do arquivo. "23 de 54" é abstrato;
  "002. Ó Adorai o Senhor" é o que o operador reconhece, e vê-lo trocar é o
  que mostra movimento.
- **A lista é uma FILA, não um espelho do que está no ar.** A concorrência
  existe para reduzir o tempo PROPORCIONAL de cada item: se os 6 juntos levam
  X, cada um custou X/6 — e a exibição segue essa mesma conta, dando X/6 de
  tela a cada nome, um depois do outro. É deliberadamente **ilustrativo e não
  em tempo real**: os nomes saem de um buffer (`t.fila`) do que já entrou em
  download. O contador, a barra e a estimativa continuam sendo os números
  reais.
- **Fila, e não rodízio entre os itens em voo.** O rodízio trazia o mesmo
  nome de volta várias vezes — repetitivo, e a lista não ia a lugar nenhum. A
  fila consome cada nome UMA vez, em ordem.
- **O ritmo é MEDIDO, não chutado** (`bgSpinMs`): `decorrido / concluídos` é
  o tempo médio por item — exatamente o X/6. Se a fila acumula (a rede
  acelerou), o escoamento acelera junto, para a lista não ficar exibindo um
  passado cada vez mais velho.
- **Sem o buffer a lista engasgava.** Os 6 workers andam em lockstep — entram
  e saem quase juntos —, então os eventos chegam em rajada (meia dúzia em
  poucos ms) seguida de segundos de silêncio. Sem fila, a rajada rendia UMA
  troca de nome e o resto era descartado: o nome ficava parado até a rajada
  seguinte, que é exatamente a sensação de travado.
- **O compasso PARA quando o download trava.** Animar durante uma queda de
  rede esconderia justamente o que precisa ser visto — e ali não há novidade
  nenhuma a mostrar, só passado. Passando `BG_STALL_MS` (90 s) sem nenhum
  evento real, a lista congela e o `idleMs` cresce na tela: os dois sinais
  concordam.
- **`idleMs` separa "travado" de "esta faixa é grande"**, que na tela são a
  mesma coisa parada. Passado o limiar, a notificação **para de prometer
  tempo restante** e passa a dizer "sem resposta há X": uma ETA calculada
  sobre um ritmo que não existe mais é a promessa mais enganosa que essa
  notificação pode fazer. E `formatIdle` não usa degraus (ao contrário de
  `formatEta`) — aqui o número PRECISA subir a cada atualização, é vê-lo
  crescer que diz "isto não está andando".
- **O freio é UM só, e vale só para a rotina.** O Android limita a taxa de
  updates de notificação e passa a descartar o excesso — sem freio a barra
  PARECE travada. `BG_NOTIF_MIN_MS` (700 ms) segura a atualização de rotina
  (`bgTaskStep`, em que só o contador andou); tudo o que precisa chegar na hora
  passa `force`: o primeiro nome de uma tarefa, cada troca de nome na linha e o
  estado final. Houve um segundo piso ("250 ms para o item que acabou de entrar
  em download", escolhido pelo chamador num parâmetro `destaque`); ele saiu na
  v5.48 porque **nenhum chamador o passava** — era código morto, e
  mexer na constante não produzia efeito nenhum no aparelho. Quem de fato dá o
  ritmo do item que entra é o compasso (`bgPacerTick`, `BG_TICK_MS` = 250 ms),
  que envia com `force` sempre que o nome troca. Repor o piso curto seria pior
  que o `force`: o primeiro nome nasce a poucos ms do envio de abertura da
  tarefa e ficaria retido até o batimento de reenvio (`BG_REENVIO_MS`, 2 s).
- **É um REGISTRO de tarefas, não um slot único.** O app tem downloads
  simultâneos — é por isso que `bgWorkCount` conta em vez de ser um booleano —,
  e entrar na aba Bíblia enquanto um lote de álbuns baixa dispara os dois ao
  mesmo tempo. Com um slot só, as duas escreviam uma por cima da outra: o
  `done` de uma aparecia com o `total` e o `startedAt` da outra, e a estimativa
  pulava de 1h30 para 2h40 e voltava. Cada tarefa tem seu registro; a
  notificação mostra a **dominante** (maior tempo restante — é ela que decide
  quando tudo acaba) e sinaliza as outras com `(+N)`. Somar tarefas de
  naturezas diferentes (capítulos + músicas) num total único daria um número
  sem significado.
- **A estimativa vem do ritmo MÉDIO desde o PRIMEIRO item concluído** (não
  desde o `start`: antes dele corre o preparo — índice, varredura do que falta
  — e contá-lo como tempo de download inflava a primeira estimativa, que depois
  despencava). Média, não taxa instantânea: faixas têm tamanhos muito
  diferentes e a instantânea faria o número pular a cada música.
- **Suavização assimétrica e por CONSTANTE DE TEMPO** (`ETA_TAU_DOWN` 2,5 s /
  `ETA_TAU_UP` 10 s): cai rápido, sobe devagar — uma contagem regressiva que
  aumenta parece quebrada, mesmo quando o número novo está certo. Por tempo, e
  não por chamada, porque o compasso de 1 s pede a estimativa muito mais vezes
  que antes: um fator fixo por chamada colaria o valor exibido no bruto e o
  número voltaria a pular, que é o defeito que a suavização existe para
  evitar.
- **Arredondamento em degraus** no lado nativo (1 min perto do fim, 5 min
  abaixo de 1 h, 10 min acima): a incerteza cresce com o horizonte, e mostrar
  "2h03" quando o erro real é de meia hora promete uma precisão que não
  existe — além de fazer o número mudar a cada atualização, o que se lê como
  instabilidade mesmo quando a estimativa está convergindo.
- **Num lote (`syncGroup`) a barra acompanha o LOTE**, não cada álbum: o total
  é a soma das músicas pendentes de todos eles, contada uma vez. Reiniciar a
  barra a cada álbum daria doze barras curtas em vez de uma que informa quanto
  falta de verdade.
- Num shell antigo `bgProgress` não existe; o `try` de `native.js` engole e a
  notificação segue estática — exatamente o comportamento anterior.

---

## Notificação de controles (sessão de mídia)

[`SessionService.kt`](app/src/main/java/br/org/iasd/av/SessionService.kt) publica
um `MediaSession` e uma notificação `MediaStyle` com os controles de transporte.
Dois ganhos, e o segundo é o menos óbvio:

1. **Controlar sem abrir o app.** O celular fica no suporte, provavelmente
   bloqueado, e abrir o app só para pausar é atrito real no meio de um culto.
   Com o `MediaSession` os controles aparecem também na **tela de bloqueio** e
   nas configurações rápidas, de graça.
2. **A projeção deixa de ser descartável.** Antes disto o único serviço em
   primeiro plano era o `SyncService`, que só sobe DURANTE downloads: num culto
   normal não havia nenhum, e o processo seguia candidato a ser morto sob
   pressão de memória — levando junto a `Presentation` na TV. Um serviço
   `mediaPlayback` ativo enquanto houver cena fecha esse buraco.

- **Nenhuma decisão de transporte em Kotlin** (invariante 5). O sistema entrega
  uma string de ação, `SessionRemote` a repassa a `window.__avRemote`, e o lado
  web aciona os **mesmos botões da tela** por `.click()`. Os handlers já tratam
  todos os casos de borda (texto sem áudio de fundo, YouTube que precisa
  recarregar, limites da playlist) e um botão `disabled` é um no-op natural.
- **Por isso nenhuma ação é desabilitada no lado nativo.** Quem sabe se
  "estrofe anterior" faz sentido agora é o web; desabilitar nos dois lugares
  duplicaria a regra, e a cópia em Kotlin envelheceria.
- **⏮/⏭ mudam de eixo conforme a cena.** Na notificação só cabem três botões no
  modo compacto — e com letra, versículo ou mensagem em cena é a estrofe que o
  operador está passando. `slideMode` (de `slideTarget()`) decide, e o rótulo do
  botão diz qual é o modo para não virar adivinhação. **Desde a v5.49 a TELA
  segue a mesma regra**: os botões de estrofe que flanqueavam a preview saíram,
  e o par ⏮/⏭ do transporte passa estrofe no toque curto e mídia no toque longo
  (ver `attachTransportStep` em `controle.js`). O que a notificação já fazia por
  falta de espaço virou a convenção dos dois lados — e o `slideMode` que ela
  envia deixou de ser a única leitura dessa regra na tela.
- **A PALAVRA do rótulo é `slideLabel`, e ela viaja campo a campo.** "Estrofe"
  não serve para tudo: numa APRESENTAÇÃO o que ⏮/⏭ passam é página. O campo
  nasceu na v5.97 e o `SessionService` sempre o leu — mas até a v5.102
  `AVNative.nowPlaying` **não o copiava para o JSON da ponte**, e a notificação
  escreveu "(estrofe)" durante toda a rodada das apresentações. É a forma de
  falhar dessa função: ela remonta o objeto campo a campo, um campo esquecido
  desaparece em silêncio e o `optString` do Kotlin lê vazio como "use o
  padrão". **Campo novo em `pushNowPlaying` = campo novo em
  `AVNative.nowPlaying`**, sempre — e sem subir `SHELL_VERSION`, porque o lado
  Kotlin não muda.
- **`play`/`pause` e `playpause` são coisas diferentes.** Tela de bloqueio, fone
  e Android Auto sabem o que querem e mandam intenção explícita; o botão da
  notificação é alternador. Tratar tudo como alternador faria um `onPlay`
  recebido com o áudio já tocando PAUSAR o louvor.
- **O estado sai de `pushNowPlaying`**, que lê o título do próprio
  `#npNameInner` já renderizado, e a posição/duração da própria **barra de
  progresso** (`#seek`) — em vez de
  reconstruir as origens (mídia/letra/versículo/mensagem) ou recalcular o tempo
  por fora. Duplicar essas árvores era garantir divergência; e a barra é a única
  fonte que cobre todos os tipos, inclusive YouTube (`preview.getDuration()` é do
  `<video>` do stage e não sabe nada de um vídeo do YouTube). Barra desabilitada
  (imagem, versículo, mensagem) zera os dois campos, para o sistema não desenhar
  uma linha do tempo que não significa nada.
- **CENA é tudo que está no telão, não só mídia.** `active` inclui `currentId`,
  mensagem, versículo, **cronômetro e sorteio** projetando. Os dois últimos
  ficavam de fora: o efeito não é a projeção cair no meio (uma vez que qualquer
  mídia tocou, `currentId` nunca mais volta a null), é o caso da sessão
  RECÉM-ABERTA — projetar a contagem regressiva de abertura sem ter selecionado
  mídia nenhuma não levantava o serviço, e o processo, com a `Presentation`
  junto, seguia descartável exatamente durante os dez minutos em que o operador
  minimiza o app para esperar.
- **A posição fica fora da chave de deduplicação**, porque a sessão extrapola o
  tempo sozinha (posição + decorrido × velocidade) — reenviar a cada segundo só
  para mexer o cursor seria desperdício. Mas um **seek é uma descontinuidade**
  que a extrapolação não adivinha: até a v1.18, pular uma estrofe deixava a
  barra contando a partir do ponto antigo e mostrando um tempo falso. Em vez de
  avisar em cada ponto que faz seek (slide, barra, gesto, re-sincronia com o
  Display), `pushNowPlaying` compara o tempo real com o que a sessão estaria
  extrapolando e republica quando diverge além de `POS_TOL_MS` (1,5 s — folga
  para o jitter do `display-status`). Um só lugar cobre todas as causas,
  inclusive as futuras. Durante um ARRASTE na barra não republica: ali o valor
  é a posição do dedo, não a da mídia.
- O serviço vive enquanto houver **cena**, não só enquanto toca: pausado, o
  operador ainda precisa do botão de play. Sem cena, ele para e a notificação
  some.
- **A cena pode acabar enquanto o serviço sobe.** `nowPlaying` e `stop` chegam
  da thread do WebView: publicar uma cena dispara `startForegroundService`, e o
  `active:false` que vem logo atrás chega ANTES de o serviço existir. Sem a
  guarda, o serviço nascia depois disso e ficava de pé com "Nada em exibição" —
  e nada mais chamaria `stop()`, porque o lado web deduplica por chave e não
  reenvia o `active:false`. `stopSelf(startId)`, e não `stopSelf()`, para um
  comando mais novo já enfileirado (uma cena nova) cancelar a parada, como manda
  o contrato do `Service`. Pelo mesmo motivo, `stop()` só chama `stopService`
  quando o serviço **já** está em primeiro plano: derrubá-lo com um
  `startForegroundService` pendente é o caminho conhecido para o app ser morto.
  Perder a notificação de controles seria um arranhão; perder a projeção, não.
- **Ícones são os do sistema** (`android.R.drawable.*`: `ic_media_previous`,
  `ic_media_play`/`ic_media_pause`, `ic_media_next` e, para Parar,
  `ic_menu_close_clear_cancel`) — carregar um conjunto próprio no `res/` só para
  cinco botões não se paga, e o `MediaStyle` os tinge conforme o tema.
  **Exceção: a cortina**, que usa
  `ic_image`/`ic_image_off` (vetores próprios). O sistema não tem imagem
  riscada, e o que havia até a v1.18 (`ic_menu_view`) é um OLHO — sugere
  "esconder a vista", quando o que sai do telão é a MÍDIA. São os mesmos dois
  símbolos que o botão do app já usa nesse par de estados.
- **O ícone da cortina mostra o ESTADO; o rótulo, a ação** (v5.50 — a regra
  virou "o riscado é o corte", ver `docs/ARQUITETURA-WEB.md`). Telão coberto =
  imagem riscada; mídia no ar = imagem inteira. O rótulo ("Cobrir telão" /
  "Mostrar mídia") continua nomeando o que o toque faz, e é ele que a
  notificação tem de sobra em relação à tela — onde quem carrega o estado é a
  cor. Até a v5.49 o ícone daqui era a AÇÃO, junto com a tela; a base web
  inverteu, e deixar a notificação para trás faria o MESMO símbolo significar
  coisas opostas nos dois lugares.
- **A partir do Android 13 quem desenha os botões é o `PlaybackState`, não a
  notificação.** As `Notification.Action` viram decoração nessas versões: os
  controles saem das *actions* do estado (play/pause, ⏮/⏭) e os extras, de
  `PlaybackState.CustomAction`. Foi por isso que, na v1.17, "Parar" e a cortina
  simplesmente não apareciam e só restavam os botões nativos — as duas são
  custom actions desde a v1.18, entregues por `onCustomAction`.
- **`publish()` sempre roda na main thread.** Todo `@JavascriptInterface` é
  chamado de uma thread do WebView, e `MediaSession` tem handler próprio e não
  promete ser thread-safe — mexer nele de fora é o tipo de coisa que funciona
  num aparelho e falha calada noutro.
- **E esse salto de thread abre uma janela, que `running` fecha.** `update()`
  confere na thread do WebView que o serviço existe e enfileira o `publish` na
  main; entre uma coisa e a outra, o `onDestroy` de um `stopSelf` anterior pode
  rodar. Sem a guarda a continuação publicava numa instância já destruída — um
  `notify` que ninguém mais cancela (o cartão eterno que o `SyncService` já
  aprendera a evitar) ou um `startForeground` de um serviço que não existe
  mais. Como o lado web deduplica por chave e não reenvia o mesmo estado, essa
  notificação órfã ficaria de pé, com os botões mortos, até o app ser fechado.
  Pelo mesmo motivo o `onDestroy` **cancela a notificação explicitamente**: o
  sistema só recolhe sozinho a que veio de `startForeground`.
- **A notificação NÃO pode depender do JS do Controle estar rodando.** Com o
  app minimizado e sem áudio audível no celular, o
  sistema estrangula aquele WebView: `pushNowPlaying` para de ser chamado e a
  notificação congela — botão em "play", barra parada — enquanto o telão segue
  projetando. (Ligar o áudio no próprio celular fazia o defeito sumir, porque
  áudio audível isenta a página do estrangulamento — foi justamente essa a
  pista. Aquele modo, a "mesa de som", saiu na v5.189: o som é dos displays.)
  `NativeBridge.snoopDisplayStatus` lê de passagem o `display-status` que o
  telão já emite pelo `busPost` e corrige play/pause, posição e duração
  (`SessionService.updateFromDisplay`). A `Presentation` não é estrangulada —
  é uma fonte que continua viva quando a outra não está. Não é decisão de
  transporte: copia campos que o web já calculou, e sem cena publicada não
  inventa nada. Republica com a mesma economia do lado web (só em troca de
  play/pause, de duração, ou salto de posição além de `POS_TOL_MS`).
  **Sem telão conectado o caso não se aplica**: ali a projeção É a preview em
  tela cheia, que exige o app na frente — minimizar já encerra a projeção.
- **A verificar em aparelho:** se o WebView criar uma sessão de mídia própria ao
  tocar áudio, poderia aparecer uma notificação concorrente. Nada no código
  indica isso (o WebView não se comporta como o Chrome aqui), mas não foi
  observado rodando.

---

## OTA da base web (atualização sem APK)

No PWA, um push em `main` chegava sozinho ao aparelho. Empacotada num APK, a
base web passaria a exigir baixar e instalar à mão a cada ajuste de JS/CSS —
o OTA devolve o comportamento antigo, com mais controle.

**Como funciona:** o job `web-ota` (em todo push para `main`) empacota
`assets/web/` num `web-assets.zip` e publica, junto com um `version.json`, na
release de tag fixa **`web-latest`** — URL estável, porque está compilada no
shell. O app consulta esse `version.json`, baixa quando há versão nova e passa a
servi-la. (O tamanho do zip sai no log do próprio job, no `echo "Bundle: …"` —
número no doc envelhece a cada push.)

### A procura era UMA SÓ, e era esse o defeito (v1.60)

O `check()` rodava no `onCreate` e mais nada. O lado web pergunta de minuto em
minuto se há bundle esperando (`otaPending`), mas essa pergunta só lê o que já
está no DISCO — **o web enquetava um valor que ninguém atualizava**. Com o app
aberto o dia inteiro (o normal aqui), uma versão publicada depois da abertura
simplesmente não existia para o aparelho: nenhum aviso, nenhuma demora, ausência
total. E se a única tentativa caísse sem rede — o Wi-Fi da igreja demorando a
associar é o caso comum —, nada era retentado até o próximo lançamento.

Agora são **quatro gatilhos**, e cada um cobre o que os outros não cobrem:

1. **abertura** — o de sempre;
2. **ronda periódica** de 5 min enquanto o processo viver;
3. **retomada do app** (`onResume`) — é quando o operador agiria sobre o aviso, e
   quando a rede costuma estar de volta;
4. **a rede voltando** (`registerDefaultNetworkCallback`) — fecha o caso do
   lançamento sem internet.

Mais três peças, e nenhuma é enfeite:

- **Falha retenta sozinha**, com espera crescente (30 s → 1 → 2 → 5 min). "Sem
  rede agora" quase nunca significa "sem rede daqui a meio minuto", e o custo de
  perguntar de novo é um JSON.
- **Nada de cópia guardada.** O asset da release `web-latest` é SUBSTITUÍDO no
  lugar — mesma URL, conteúdo novo —, que é exatamente o caso em que um cache
  intermediário devolve o de ontem com toda a razão. Uma resposta guardada aqui
  não atrasa a atualização: ela a torna INVISÍVEL pelo tempo que o cache durar,
  sem sinal nenhum no aparelho. Daí os cabeçalhos `no-cache` **e** o `?t=` na
  URL (caches que ignoram o cabeçalho existem).
- **O shell EMPURRA** (`window.__avOta`) quando o bundle fica pronto: o aviso
  aparece no segundo em que a atualização chega, em vez de esperar até um minuto
  pela enquete. Num bundle antigo a função não existe e o empurrão é no-op — a
  enquete continua sendo o piso.

**A comparação passou a ser contra o que o aparelho JÁ TEM, não contra o que ele
está SERVINDO** (`versaoJaTemos`). Enquanto a procura era uma por lançamento os
dois eram a mesma coisa; com a ronda, não — um bundle baixado fica esperando o
próximo lançamento, `currentVersion` continua sendo o da sessão, e a ronda
seguinte concluiria de novo que há versão nova, **rebaixando o mesmo zip a cada
cinco minutos** e apagando com `deleteRecursively` um diretório que o operador
pode ter acabado de mandar aplicar ao vivo.

E o operador tem como forçar: **tocar no rótulo de versão** (o do rodapé de
Configurações) procura na hora, pulando o piso entre consultas — e desfaz a
recusa desta sessão, porque "Depois" silencia o aviso automático, não quem
voltou para pedir. O Registro ganhou a linha **"Procura:"** (`otaDiag`), que diz
quando foi a última busca e o que ela deu: "não apareceu aviso nenhum" tem
quatro causas indistinguíveis da tela — não há versão nova, a busca falhou, o
bundle exige um shell mais novo, ou a pergunta está esperando o telão esvaziar —
e sem essa linha a única resposta possível era um palpite.

Não há `WorkManager` nem alarme, de propósito: atualizar a base web de um app
FECHADO não serve para nada (ela entra ao abrir, e ao abrir a procura acontece
de qualquer jeito) e custaria bateria e uma dependência.

> **O nome do repositório aparece nos DOIS lados, e eles têm de bater**: o
> workflow escreve a URL do zip a partir de `$GITHUB_REPOSITORY`, e o
> `WebUpdater.REPO` é digitado à mão. Depois que o repositório foi renomeado,
> a constante ficou apontando para o nome antigo e o OTA só continuou
> funcionando por causa do redirecionamento do GitHub — corrigida na v1.39.
> Renomear o repositório de novo exige mexer nesta constante **e** publicar um
> APK, porque a URL está compilada no shell; e o modo de falhar é mudo: o
> `check()` engole tudo em `Log.i`, então um OTA morto não dá sinal nenhum no
> aparelho.

**A identidade do bundle é `assets/web/version.json`** (`version` +
`minShell`), versionado no repositório: o bundle carrega a própria versão,
seja ele o embutido ou o baixado. O workflow só acrescenta `sha256` e a URL.
**Atualizar esse arquivo junto com os outros dois lugares de versão** — ver
"Regras de desenvolvimento" — é o que dispara (ou não) uma atualização nos
aparelhos.

**O OTA não muda o acesso ao nativo.** A ponte é injetada no WebView pelo
Kotlin (`addJavascriptInterface`), não vem nos arquivos web: um bundle
baixado enxerga `__AVBridge` exatamente como o embutido, e o
`WebViewAssetLoader` serve os dois pelo mesmo origin — logo IndexedDB, OPFS,
SAF, Presentation e o serviço de segundo plano seguem idênticos.

### As três garantias (isto roda em culto)

1. ~~**Nunca troca a base no meio de uma sessão.**~~ **REVOGADA A PEDIDO DO
   OPERADOR (v1.68 / v5.151).** A base nova entra **sozinha, no segundo em que
   fica pronta**, independentemente do que estiver acontecendo. Leia o resto
   deste item mesmo assim: ele explica por que a garantia existia, e o parágrafo
   final explica por que ela caiu e o que a substitui.

   **Por que ela caiu, e não foi por preguiça:** o que ela prometia nunca
   acontecia. "Entra no próximo lançamento" é literal — `beginSession()` decide
   uma vez por **PROCESSO** —, e este processo quase nunca morre: os serviços
   em primeiro plano (`SessionService` — cena ou transmissão — e `SyncService`)
   o mantêm vivo de propósito, e fechar pelo Recentes derruba a Activity, não o
   processo. Somado a isso, a oferta de aplicar ao vivo era suprimida com cena no
   ar, download em curso **ou espelho ligado** — e nos testes do espelho ele
   ficava ligado o tempo todo. O operador reabria o app "várias e várias vezes" e
   continuava na versão velha. Uma garantia que promete "no próximo lançamento"
   quando não há próximo lançamento não é uma garantia: é um bug com
   documentação.

   **O que o piscar custa, medido e não suposto:** o telão recarrega, dispara
   `display-ready`, e o Controle reenvia a cena **com posição e estado de
   reprodução** (`resendSceneToDisplay`) — o mesmo caminho que a queda de um
   dongle já exercita todo domingo. Uma mídia tocando volta no segundo em que
   estava. O que NÃO volta, e está dito em vez de escondido: o item de um lote de
   download que estava em voo recomeça (sem perder o que já baixou), e uma tela
   da rede segue com a página antiga em memória até alguém recarregá-la — a
   reconexão do SSE re-anuncia a cena, não troca o bundle.

   O que a substitui é o **watchdog de boot**, que não mudou: um bundle que não
   confirme o boot é descartado no lançamento seguinte. Ele continua sendo a
   defesa contra publicar algo quebrado — a diferença é que agora o primeiro
   estrago chega mais rápido, e por isso o passo de testes do `apk.yml` importa
   mais, não menos.

   O texto abaixo descreve o mecanismo que continua valendo (a faxina, o
   `sessionRoot`, o watchdog), e a razão de a troca ao vivo nunca apagar nada:

   O download é em segundo
   plano, e o `beginSession()` continua sendo o único ponto em que a faxina
   roda. "Por lançamento" é literal: `beginSession()`
   decide uma única vez por **PROCESSO** (`sessionStarted`), e não por
   `onCreate`. A garantia tinha sido escrita supondo o contrário: uma recriação
   da Activity no meio do culto rearmava o watchdog e rodava o `cleanup`, que
   APAGA o diretório servido ao vivo pelos dois WebViews. Por isso a faxina de
   bundles antigos preserva tanto o alvo novo quanto o `sessionRoot` em uso, e
   recolhe o resto no `beginSession()` seguinte — o único ponto em que nenhum
   WebView existe ainda. Sem essa ressalva, ativar uma versão nova durante o
   culto fazia todo recurso ainda não carregado (e qualquer recarga do telão)
   cair no fallback do APK: versão mais antiga, no meio da projeção.

   **Como a aplicação automática funciona** (v1.68 / v5.151). São **dois
   caminhos independentes**, e isso é deliberado: um deles chega por APK e o
   outro por OTA, então a correção não depende de instalar nada para começar a
   valer.

   - **No shell**: `check()` termina, o bundle fica pronto, e o `WebUpdater`
     chama `aplicarSozinho` — que a `MainActivity` liga ao mesmo `applyWebUpdate`
     do caminho manual (`WebUpdater.applyNow` troca o `sessionRoot` e recarrega
     as duas páginas). É o caminho robusto: ele não depende de o WebView do
     Controle estar vivo nem de estar sendo escalonado.
   - **No web**: a enquete de 20 s (era 60) chama `otaApply()` **sem perguntar**
     assim que `otaPending()` responde alguma coisa, mais um gatilho na retomada
     do app. Ele existe para o shell antigo (≥ 29) e para o caso de o empurrão
     do shell se perder — o WebView do Controle é estrangulado em segundo plano,
     e é justamente aí que uma versão nova costuma chegar.

   `otaRecusadas` sobreviveu com outro significado: era "o operador disse
   depois", e agora é "**já tentamos aplicar e o shell não aceitou**" — sem ela,
   um bundle reprovado (sem o index do Controle, por exemplo) faria a enquete
   pedir a aplicação a cada 20 s, para sempre.

   **Nada é apagado ao aplicar**: o diretório antigo pode ter requisições em voo
   durante a recarga, e quem o recolhe continua sendo o `beginSession()`
   seguinte.

   **A detecção também ficou agressiva**: ronda de **1 min** (era 5), piso entre
   consultas de **15 s** (era 45), retentativa de falha em **10 s → 90 s** (era
   30 s → 5 min), e um gatilho novo — `onCapabilitiesChanged` com
   `NET_CAPABILITY_VALIDATED`, que é o instante em que o Android confirma que
   aquela rede alcança a internet de verdade. O Wi-Fi da igreja associa **antes**
   de ter saída, então o `onAvailable` sozinho disparava a consulta cedo demais,
   ela falhava, e o resto era espera.
2. **Válvula `minShell`.** Se o bundle exigir uma ponte mais nova que
   `NativeBridge.SHELL_VERSION`, é recusado: o app continua no que já tinha,
   funcionando, até um APK novo chegar. **É por isso que `SHELL_VERSION`
   precisa subir toda vez que a superfície da ponte mudar** — sem isso a
   válvula não protege nada.
3. **Watchdog de boot.** Servir um bundle arma um `pending`; o lado web o
   desarma (`AVNative` → `otaConfirm`). Um bundle que não confirme é descartado
   no lançamento seguinte e o app volta ao embutido no APK. Sem isso, um bundle
   quebrado inutilizaria o app até reinstalar.

O `pending` guarda o **NOME do subdiretório**, não um booleano: com um booleano
a confirmação de um bundle perdoava outro, porque qualquer escrita de `false`
desarmava o que estivesse armado. E a chave é nova de propósito — ler um
`Boolean` como `String` em `SharedPreferences` lança `ClassCastException`,
dentro do `onCreate`, o que deixaria o app sem abrir depois de atualizar o APK.

#### Por que "`AVDB` existe" não bastava como confirmação

Até a v5.47 a única condição era `window.AVDB` no evento `load`, e o comentário
raciocinava sobre "um erro de sintaxe em `db.js`" — o arquivo MENOS provável de
quebrar. A ordem dos scripts do Controle é `native.js` → `db.js` → `mse.js` →
`stage.js` → `louvorja.js` → `bible.js` → `controle.js`: um erro de sintaxe (ou
um `throw` de inicialização) em qualquer um dos CINCO últimos aborta só AQUELE
script, o `load` dispara do mesmo jeito, `AVDB` continua lá — e o bundle
quebrado era carimbado como bom e servido PARA SEMPRE, o oposto exato do que o
mecanismo existe para fazer. Como o OTA publica a cada push em `main` e o
`controle.js` é de longe o que mais muda, esse era justamente o caso provável.

O sinal agora é "o app está DE PÉ" (`otaAppIsUp`, em `shared/native.js`), e cada
peça cobre um trecho da cadeia que a anterior não cobre:

1. **papel `controle`.** O WebView do Display carrega bem menos código (não
   carrega `controle.js` nem `louvorja.js`), então deixá-lo confirmar validaria
   um bundle cujo Controle nunca chegou a rodar — e o Display é o caso NORMAL de
   culto, ou seja, confirmaria quase sempre no lugar do outro. Sem TV ele nem
   existe: quem confirma é sempre o Controle, que é quem precisa funcionar. A
   regra é imposta **nos dois lados**: o laço nem começa no Display, e
   `NativeBridge.otaConfirm` recusa a chamada quando `role != "controle"`.
2. **`AVDB` (db.js), `AVStream` (mse.js) e `createStage` (stage.js)** — os
   três módulos compartilhados, cada um publicando seu global no fim do
   arquivo. O `AVStream` ficou de fora até a auditoria de agosto/2026: um
   bundle com `mse.js` quebrado era carimbado como bom (degradação suave — a
   transmissão direta cai no download —, mas carimbo de watchdog é para
   sempre).
3. **`__avBack` (controle.js, perto do fim do arquivo)** — só existe se o
   `controle.js` foi parseado por inteiro e executado até quase o fim. É a mesma
   função que `MainActivity.handleBack()` consulta: um contrato que já existe,
   não um marcador inventado para o watchdog.
4. **um `<li>` dentro de `#playlist`** — o HTML entrega esse `<ul>` VAZIO; quem
   o preenche é `renderPlaylist()`, chamado dentro do `init()` assíncrono. É o
   que prova que a inicialização terminou de verdade: `init()` começa por
   `loadCollections()` (louvorja.js), então uma quebra em `louvorja.js` ou
   `bible.js` derruba o `init()` antes daqui e o marcador nunca aparece.

**Por polling, e não uma checagem única no `load`:** o `init()` do Controle é
assíncrono (várias leituras de IndexedDB) e termina DEPOIS do `load`. Uma
checagem única rejeitaria todo bundle bom — o OTA pararia de funcionar por
inteiro, que é o defeito oposto e igualmente ruim. São 250 ms de intervalo e
30 s de desistência, em silêncio (sem confirmação, o `WebUpdater` descarta o
bundle no lançamento seguinte).

**O erro possível aqui é o SEGURO.** A confirmação só chega quando o `init()`
termina, isto é, algum tempo depois do `load` — fechar o app nesse intervalo faz
um bundle bom ser descartado; custo: o app volta ao embutido e o OTA baixa de
novo na abertura seguinte. O erro do outro lado — carimbar um bundle quebrado — não tem volta sem
publicar uma versão nova. E não há risco de descompasso: `native.js` viaja
DENTRO do bundle que ele valida, então a função e o `__avBack` que ela exige são
sempre do mesmo commit.

#### Trocar a base servida OBRIGA a limpar o cache do WebView (v1.91)

As URLs da base **não mudam de nome entre versões** — `/web/controle/
controle.js` é sempre esse caminho — e o WebView roda com
`cacheMode = LOAD_DEFAULT`. Então, toda vez que o app passa a servir um bundle
diferente do que serviu antes, o cache do processo ainda guarda a versão velha
dos mesmos endereços, e a página nasce **com metade de cada bundle**.

A regra já estava escrita no projeto, em `StagePresentation.recarregar` e em
`MainActivity.applyWebUpdate`: *"sem limpar o cache, a página nova pode ser
montada com pedaços da antiga — o pior desfecho possível, porque tudo PARECE ter
funcionado"*. Ela tinha sido aplicada em **um** dos dois lugares em que a base
troca.

O outro é o **lançamento**, e são justamente os caminhos de recuo do
`beginSession`: o watchdog descartando um bundle que não confirmou o boot, e um
APK novo atropelando um OTA mais antigo. Nos dois, a sessão anterior serviu X e
esta serve Y. Foi assim que o **botão único de conectar da v5.192** — a base
embutida no APK v1.90, onde ele existe com o rótulo "Toque para conectar uma
tela" — reapareceu num aparelho que já rodava a v5.197, com o relato exato de
*"algum tipo de resquício, cache ou conflito que ignorava as mudanças da
atualização"*.

**E o modo de falhar se REALIMENTA**: uma página remendada tem tudo para não
satisfazer o `otaAppIsUp`, então o bundle seguinte também é descartado — o
aparelho fica preso indo e voltando entre duas versões, que é exatamente a
sequência de três sintomas que o operador descreveu duas vezes.

`WebUpdater.baseTrocou` responde a pergunta (contra `KEY_SERVIDO`, o que a
sessão anterior de fato serviu — que **não** é o `KEY_ACTIVE`, porque aquele diz
o que o OTA *quer* servir e este diz o que os WebViews *serviram*), e
`buildControleWebView` limpa o cache antes do primeiro `loadUrl`. O cache é
**por aplicação**, então limpar no primeiro WebView do processo cobre a
`Presentation`, que nasce depois. Ausente não conta como troca: numa primeira
execução não há cache anterior com que conflitar.

`beginSession` passou a ter **saída única** (`fixarBase`) por causa disto: eram
quatro `return` espalhados, e um quinto caminho acrescentado sem a anotação
passaria despercebido — que é a forma exata como este defeito nasceu do outro
lado.

#### As outras defesas do caminho de download

- **Uma verificação por vez** (`checking`, um `AtomicBoolean`). `checkAsync`
  roda em todo `onCreate`, e o `android:configChanges` não cobre `fontScale`
  nem `locale`: mudar o tamanho da fonte durante um download disparava um
  segundo `check()` em paralelo, e os dois escreviam nos MESMOS caminhos
  temporários — podia sair um diretório INCOMPLETO ativado como bundle bom. Os
  caminhos temporários também levam um sufixo único por execução.
- **Host travado** (`github.com`, `objects.githubusercontent.com`) e **`https`
  obrigatório**. Não dá autenticidade (quem escreve o `version.json` escreve o
  zip), mas impede que um único campo alterado aponte o download para um
  servidor qualquer — e esse JS rodaria no origin privilegiado, com a ponte
  inteira à disposição.
- **`sha256` obrigatório.** Aceitar um `version.json` sem o campo era instalar
  um bundle sem verificação nenhuma. O workflow sempre o emite.
- **Zip slip** (entradas com `..` que escapariam do diretório) e um teto de
  tamanho na extração.
- **Reprovação antes de ativar:** falta do `web/controle/index.html` descarta o
  staging.
- Um APK novo com base web mais recente também descarta um OTA antigo. A
  comparação é **numérica por componente**, não lexical (`4.9` < `4.82` como
  string), por isso `compareVersions` compara cada componente como inteiro.
- O fallback é **por arquivo**: o que faltar no bundle baixado é servido do APK.

---

## Telão por comandos (o telão nas telas da rede local)

O telão inteiro — fades, cortina, Camada de Texto, letra sincronizada e vídeo —
em até **três navegadores da rede da igreja**, sem instalar nada nas telas e sem
depender de internet. A especificação fechada, com cada decisão e o motivo dela,
está em [`docs/TELAO-POR-COMANDOS.md`](docs/TELAO-POR-COMANDOS.md) — **leia
antes de mexer**; esta seção é o mapa. (O antecessor, o espelho de pixels —
VirtualDisplay → H.264 → MSE —, foi **aposentado por inteiro na v5.187**;
`docs/ESPELHO-DE-PIXELS.md` fica como histórico, com o aviso no topo.)

```
 ┌────────────── celular ──────────────┐        ┌───── navegador na LAN ─────┐
 │  Controle (/web/controle/)          │        │  o MESMO /web/display/     │
 │   └─ cada comando do barramento ────┼─SSE───►│  (papel `tela`, ?tela=1)   │
 │  EspelhoServidor                    │        │   ├─ stage.js de verdade   │
 │   ├─ serve o BUNDLE (OTA→APK)       │◄─POST──│   ├─ mídia por /m/<token>  │
 │   └─ /m/<token>: cache de mídia     │  /r    │   └─ status de volta       │
 └─────────────────────────────────────┘        └────────────────────────────┘
```

**O que faz isto valer a pena é o que NÃO atravessa a rede.** A tela da rede
carrega o próprio bundle do app (servido pelo celular, com a MESMA resolução
OTA→APK do `WebPathHandler`) e roda o `/web/display/` de verdade — `stage.js`,
fades, cortina, letra, Camada de Texto. O que viaja são **comandos** (os mesmos
objetos JSON pequenos do barramento, verbatim, por SSE) e **mídia sob demanda**
(`/m/<token>`, com `Range` RFC 7233 de verdade — a inversão da invariante 8:
num `ServerSocket` quem aplica a faixa somos NÓS). A invariante 5 sai ilesa
duas vezes: o Kotlin não decide nada de cena, e a tela não reimplementa nada.

**AUXILIAR por contrato, como sempre foi:** liga e desliga **só** por ação do
operador (a folha de "Conectar uma tela"), pelo fechamento do app ou por uma
falha nomeada em texto. Uma TV que conecta **não** derruba a transmissão — sem
TV, as telas da rede SÃO o que a congregação vê.

### As peças, e o que cada uma se recusa a fazer

| Arquivo | O quê |
|---|---|
| `EspelhoHttp.kt` | o parser HTTP **+ Range + SSE** — **PURO, zero import de Android**, com JUnit (`EspelhoHttpTest`, `EspelhoHttpRangeTest`). `alcanceDe` segue a RFC 7233 à risca: faixa malformada é **IGNORADA** (200 inteiro), nunca adivinhada; `Range` duplicado é malformado; fora do tamanho é 416 |
| `EspelhoPares.kt` | a porta, tokens, prazo, castigo — **PURO**, com JUnit. **Sem código desde a v5.189**: a porta é o ENDEREÇO deste aparelho na rede, e o controle real é o teto de 3 sessões + o `derrubar` do operador (com castigo de 2 min, sem o qual "Desconectar" não faria nada visível). O token da sessão **nunca viaja numa URL**: o SSE vai por `fetch` + `Authorization: Bearer` (não `EventSource`, que não manda cabeçalho) |
| `EspelhoServidor.kt` | sockets, rotas, fan-out. Serve **só** `PREFIXOS_BUNDLE` (display/shared/espelho — nunca `web/controle/`), `GET /e` (o fluxo SSE: fila de 256 por tela, ping de 15 s com o epoch do celular, `adeus` no desligar), `/m/<token>` (completo = 206/416; **em crescimento = chunked**, servindo enquanto o empurrão anda), `POST /r` (o caminho de volta: `st` injeta o status no barramento via `MessageBus.post(null,…)` — que NÃO passa pelo `busPost`, logo **sem eco por construção**). Bind explícito ao IPv4 da Wi-Fi, allowlist de `Host` exata — as regras da era dos pixels que continuam valendo |
| `EspelhoMidiaCache.kt` | o cache da rota `/m/` — **PURO**, com JUnit. Token é **capacidade** (forma validada; entropia de quem cunha — o Controle, `crypto.randomUUID`), mesmo id + mesmo token = mesmo item (a regra do SafRegistry), id com token novo **substitui** (o wallpaper trocado), LRU por **bytes** e só de **completos** (um item em crescimento tem um empurrão vivo do outro lado) |
| `EspelhoMidiaCanal.kt` | o empurrão: OPFS → cache, por `WebMessageListener` com `ArrayBuffer` (o molde do `EspelhoAudio` aposentado — allowedOriginRules exato, `isMainFrame`, host conferido). Fluxo com ack por bloco; a oferta na fila é **não-bloqueante** (fila cheia = erro retentável, nunca travar a main thread) |
| `EspelhoEnergia.kt` | wake lock, Wi-Fi lock e térmica — **não é mais um Service** (v5.190): quem carrega a transmissão em primeiro plano é o `SessionService`, com o tipo `connectedDevice` somado ao dele. Exige `CHANGE_WIFI_MULTICAST_STATE` no manifest — sem ela `startForeground` **lança** |
| `EspelhoDiag.kt` | o anel. **Devolve JSON, não texto** — quem monta a frase é o `controle.js` |
| `espelho/tela.js` | a casca do papel `tela` — **carregada no próprio `display/index.html`**, entre `native.js` e `db.js`, e um no-op de uma guarda fora do papel (`?tela=1`). Define `__AVBus` (recepção = SSE; envio = o DRENO, ver o barramento), neutraliza o `postMessage` do `BroadcastChannel`, corrige o relógio (mediana do epoch dos pings — cronômetro e sorteio chegam como DESCRITOR com instante do celular), embrulha `AVDB.getMedia` para resolver `__rec.url`, e mantém a vigília (canvas.captureStream) para a tela não dormir |
| `display.js` (papel `tela`) | `forceMuted` nasce ligado (autoplay sem gesto não existe num navegador de verdade); `window.__telaSom(true)` é o que o botão de entrada chama ao gastar o único gesto (fullscreen + som, **na mesma pilha**); wallpaper chega por `__wp` (ou o sentinela `'padrao'`), e o fundo da letra por `imageUrl` na estrofe |
| `controle.js` (o outro lado) | **enriquece** cada `load` com `__rec` (registro saneado: id/kind/nome/tipo/url=`/m/<token>`/letra — **nunca** blob, opfsPath ou youtubeId) e dispara o empurrão da mídia; reescreve o manifesto de STREAM para `/s/<token>` (v5.189); **elege** uma tela como referência de tempo; converte o embed do YouTube e o deck em `tela-aviso` (o que a tela não sabe tocar, ela DIZ) |

### As decisões que precisam estar ditas

- **UMA página, não duas.** O gesto do visitante (fullscreen + som) **não
  sobrevive a uma navegação** — por isso não existe "página de entrada que
  redireciona": `tela.js` desenha a entrada como OVERLAY sobre o próprio
  display, e o toque no botão gasta o único gesto em tudo de uma vez
  (`__telaSom(true)` → `requestFullscreen` → `POST /par` → token → SSE).
  **Desde a v5.189 o botão é UM só, "Ativar esta tela", e não há código a
  digitar**: a porta é o endereço.
- **Depois de ativada, NADA cobre a tela.** O overlay cheio existe só na
  primeira carga, quando não há nada por baixo dele. Queda de fio, token
  vencido e até o `adeus` do operador reentram em silêncio (um `POST /par` numa
  escada de 1 s a 30 s) — a mídia é local (`/m/`) e a letra anda pelo
  `timeupdate` do próprio `<video>`, então a queda leva o fio e mais nada. O
  gesto perdido (tela cheia, som) é oferecido por um botão discreto de canto,
  que se recolhe em 5 s; o toque duplo faz o mesmo.
- **O tap é no `busPost`, e isso fecha o eco.** `NativeBridge.busPost` vê 100%
  dos comandos (o relay nativo roda sempre — ver o barramento), e é ali que o
  `tapLan` os copia para o fan-out SSE. A injeção de volta (o `st` do
  `POST /r`) entra por `MessageBus.post(null,…)`, que **não** passa pelo
  `busPost`: um comando vindo de uma tela não volta para as telas.
- **`__rec` viaja NO comando, não numa consulta.** A tela não tem IndexedDB com
  o acervo; esperar um "GET /registro/<id>" a cada load seria uma ida-e-volta a
  mais no caminho crítico do culto. O Controle já tem o registro na mão na hora
  de emitir o `load` — ele o sania e o anexa. Tokens de mídia são cunhados pelo
  Controle (sincronamente); o shell só valida a FORMA (`^[A-Za-z0-9_-]{16,64}$`).
- **`display-ready` com `__tela` sobe; `tela-status` sobe; o resto morre.** O
  dreno de subida é a mesma lista de permissão de dois itens do barramento —
  `media-ended`, `mic-status` e `diag-dump` de uma tela morrem nela.
- **A TRANSMISSÃO DIRETA CHEGA ÀS TELAS** (v5.189, a dívida §7). A rota
  `/s/<token>` do servidor repassa a faixa do googlevideo (o `Range` do cliente
  sobe cru; a resposta é espelhada de volta) com o UA que combina com a URL, e
  o `telaEnriquecer` reescreve `/stream/<token>` → `/s/<token>` no manifesto.
  O token é o MESMO dos dois lados (o registro do `StreamProxy` é um só), então
  não há segunda extração. Da v5.187 à v5.188 havia aqui um `pularTransmissao`
  que mandava tudo ao download quando a transmissão estava ligada sem TV — e
  como esse é o estado normal do operador, o "Tocar agora" nunca transmitia.
  O que ainda não vai para a rede é o EMBED (iframe de terceiro) e o DECK.
- **A preview não atrasa para telas de comando** (`dePixels` em
  `recalcularAtrasoPreview`): o atraso da v5.162 media o buffer de MSE do
  espelho de pixels; uma tela por comandos aplica o comando no ato, e o alvo é
  0.
- **`snoopStatusDeFora` é um só, no companion.** `display-status`,
  `espelho-status` e `tela-status` passam pelo MESMO relógio de precedência
  (`ultimoStatusDoTelaoMs`) — a versão por-instância tinha um bug latente de
  precedência entre WebViews, e a notificação de mídia é alimentada por ele
  quando o app está minimizado.
- **Detecção por PRESENÇA, não por versão**, onde há um objeto injetável:
  `telaAtiva()` pergunta `espelhoLigado() && window.__avTelaMidia`. O
  `SHELL_VERSION` (37) subiu pela mudança de FORMA do `espelhoEstado`/`espelhoDiag`,
  não para guardar o canal.

### As inversões que precisam estar ditas

1. **O áudio agora é INTEIRO, e local.** A tela toca o arquivo (`/m/`) no
   próprio `<video>`/`<audio>` — acabou o AAC parcial, a deriva de eixo, o
   `AudioWorklet` e toda a família de defeitos §10-A do doc do espelho. O som
   continua **opt-in por tela** (o `forceMuted` só sai com o gesto do
   visitante). O **microfone ao vivo** continua fora da rede: o comando `mic`
   não é drenado para as telas — a captura e a reprodução dele são do telão de
   verdade.
2. **O que vaza numa rede aberta mudou de natureza.** Antes: a imagem contínua
   de tudo que a igreja projeta. Agora: os comandos (títulos, referências,
   letras) e as mídias que forem carregadas durante a transmissão — por tokens
   opacos por sessão. A porta continua nascendo aberta (v5.170, conteúdo
   público por definição); o teto de 3 sessões e o derrubar na folha continuam
   sendo o controle real.
3. **A tela executa CÓDIGO nosso, não só decodifica pixels.** O bundle servido
   é o mesmo do app (OTA→APK), então um bundle quebrado quebra as telas junto —
   e o watchdog de boot do OTA não as cobre. O que as cobre é o
   `tela-rede.test.mjs` (Chromium de verdade, o percurso inteiro: entrada,
   comandos, mídia, status, adeus) e o fato de o telão de verdade rodar o MESMO
   display.js — quebrar um é quebrar o outro, que é o defeito que aparece.

> **E a regra de calendário fica:** a primeira ligada em rede de verdade é
> **numa terça-feira, não no culto**.

---

## A paleta

A paleta mora em **`assets/web/shared/tokens.css`**, fonte única carregada pelos
dois `index.html` **antes** da folha do app. Até a v5.47 os tokens de marca eram
mantidos à mão em DUAS folhas (`controle.css` e `display.css`), e o comentário
das duas admitia que "a sincronização é manual" — sincronização manual entre
dois arquivos é uma classe de bug, não um processo: basta um ajuste entrar só
num lado para o telão e a preview do Controle, que existe justamente para
ESPELHAR o telão, mostrarem coisas diferentes.

**Desde a v5.192 ela é a IDENTIDADE OFICIAL DA IASD, e são DOIS TEMAS.** As
matizes vêm do pacote oficial adventista — o mesmo de que saiu o símbolo do
wallpaper padrão na v5.188 —, com o **denim `#2F557F`** (PMS 302) como núcleo. O
âmbar da paleta "Sala Escura" saiu, e ele nunca foi oficial: a v5.47 o adotou
por um argumento de CONTRASTE (a paleta azul anterior usava um valor único para
fundo preenchido e para texto, e era esse par que reprovava), e a separação de
papéis em `--accent`/`--accent-fill`/`--on-accent` resolve isso sem trocar a
matiz. Com ela no lugar, o azul oficial passa com folga nos dois temas.

O essencial para não quebrar nada aqui:

- **Só cor entra em `tokens.css`.** Raio, escala de ícone, curva de toque e
  medidas de layout ficam no `:root` de `controle.css`: são decisões da UI densa
  do Controle, e o Display (que não tem UI) não teria o que fazer com elas.
- **A montagem dos temas são três blocos**, e a ordem deles é a regra:
  `:root` com o que NÃO muda, `:root` com o tema ESCURO (o padrão, sem atributo
  nenhum) e `:root[data-tema="claro"]` (0,2,0 vence o 0,1,0). O claro é um
  DELTA: o que ele não redeclara cai no escuro. **Um token que exista SÓ no
  claro não está definido no tema padrão** — o `var()` computa para o valor
  inicial da propriedade, sem aviso e sem log, e quem escreveu acabou de ver a
  cor certa na tela porque estava com o claro ligado. `tools/tokens.test.mjs`
  trava isso.
- **O PALCO NÃO TEM TEMA, e é isso que faz o recurso valer.** `--stage-*`,
  `--wallpaper` e `--lyrics-frame-bg` (mais as sombras e o `--scrim`) moram no
  bloco compartilhado. O Display já ficaria escuro por omissão — ele nunca
  escreve o atributo —; o que a separação garante é o outro lado: a PREVIEW do
  Controle roda no documento que TEM tema, e ela existe para ESPELHAR o telão.
  Um telão claro num salão às escuras cega a congregação, e uma preview que
  clareasse junto com a UI deixaria de cumprir seu papel exatamente no tema em
  que o operador mais precisa dela. `tools/smoke.mjs` trava isso.
- **Três matizes, com papéis que não se misturam.** O azul denim é a marca IASD
  **e** o accent (navegação, seleção, progresso) — `--brand` e `--accent` têm o
  mesmo valor de propósito, e os dois nomes existem para distinguir na folha
  "isto é marca" de "isto é navegação". (Eles se chamavam `--gold*` até a
  v5.192: um token chamado "gold" guardando um azul é exatamente a divergência
  que a fonte única existe para impedir, então foram renomeados junto com a
  cor.) Vermelho é atenção — o `scarlett` oficial —, em dois papéis separados:
  **preenchido = está no ar agora** (`--live`), **contornado = ação destrutiva**
  (`--danger-strong`/`--danger-text`) — nunca preenchida, para não competir com
  o que está de fato no telão. Verde (`--ok`, do `treefrog` oficial) é **só**
  concluído/conectado; antes ele também dizia "está no ar" em dois lugares
  enquanto outros quatro diziam o mesmo em vermelho, duas cores opostas para a
  mesma mensagem na mesma tela.
- **Nem todo token é um valor oficial, e os derivados estão marcados.** Os
  dezoito valores oficiais foram desenhados para fundo BRANCO: medidos, todos
  passam AA sobre branco, e NENHUM passa AA como texto sobre o quase-preto do
  tema escuro (bluejay dá 3,97:1). Onde clarear ou escurecer foi preciso, o
  comentário de `tokens.css` diz de qual oficial o valor saiu, e a matiz é
  preservada. O mesmo vale para os ladrilhos da Bíblia: a identidade tem sete
  famílias de matiz e a tela de livros precisa de DEZ grupos separáveis por
  pelo menos 20°, então cinco são oficiais e cinco preenchem os vãos.
- **A superfície AFUNDA dentro de um cartão** (a regra no topo de
  `controle.css`). `--surface`/`--surface-2` são branco com alfa, então
  EMPILHAM: o mesmo token sobre `--panel` produz uma base bem mais clara do que
  sobre `--bg`, e era essa a causa raiz do pior contraste do app. Não existe
  alfa que resolva os dois casos, então dentro do cartão o sinal se INVERTE (o
  overlay passa a ser preto) — que também é a convenção certa de UI escura: o
  cartão já está elevado, logo o controle dentro dele é recesso, e ainda emite
  menos luz num salão escuro. Como custom properties HERDAM, a regra só precisa
  marcar os elementos que de fato pintam `--panel`. **O SINAL é o mesmo nos dois
  temas** — flutua sobre a página, afunda dentro do cartão —, e só a intensidade
  muda; por isso os dois valores viraram token (`--surface-sunk`) na v5.192, em
  vez de seguirem literais em `controle.css`: eram os últimos pedaços de cor
  fora da fonte única, e o tema claro herdaria um recesso de 24% de preto sobre
  um cartão branco.
- **Nunca escrever branco literal.** Nenhum `#fff` sobrou como valor de cor em
  `controle.css`/`display.css`: o branco pleno era a maior fonte isolada de luz
  emitida do app, e o off-white da paleta (`--text`) é o que se usa. As únicas
  exceções são **o palco**: `--stage-text: #fff`, porque num telão a
  legibilidade vem de luminância máxima, não de um off-white calibrado para uma
  tela a 30 cm do rosto. No tema CLARO o `--panel` é branco pleno, e ali a regra
  não se aplica pelo motivo dela: uma página clara é a escolha explícita de quem
  não está no escuro.
- **O ÍCONE DO APP também é a paleta** (v1.34). Ele era um PNG com um botão
azul QUALQUER — sobra de uma paleta azul aposentada — sobre um fundo verde
copiado do wallpaper, que é a cortina da TV e nunca aparece no celular: nenhuma
das duas cores existia na tela que o operador vê ao tocar no ícone. Agora é o
mesmo mixer de três faixas em `--text` (trilha) e `--accent` (botão) sobre
`--bg`, o mesmo fundo que o sistema desenha antes de o WebView carregar — e na
v5.192 o azul voltou, agora o certo: o bluejay oficial da IASD. Ele **não segue
o tema claro**, e não tem como: o ícone é desenhado pela gaveta do sistema com o
app fechado, e o par escuro é o padrão. Ele
virou VETOR (`res/drawable/ic_launcher_foreground.xml`) porque com `minSdk` 26 o
adaptativo é o único ícone que chega a ser desenhado: os cinco PNGs por
densidade eram peso morto e mais cinco lugares para a cor divergir. A camada
`monochrome` (ícones temáticos do Android 13+) ganhou vetor próprio — ela
apontava para o PNG do primeiro plano, que tinha fundo opaco, e o ícone temático
virava um quadrado cheio.

**`res/values/colors.xml` espelha `--bg` à mão — agora DOIS valores**
(`app_bg` e `app_bg_claro`). É o fundo das barras de status e navegação e o
`windowBackground` (o que aparece ANTES de o WebView carregar). Nada no build
detecta a divergência, e o OTA pode trocar a base web sem trocar o APK — se um
token mudar, o valor daqui muda junto. **Ele é o ÚNICO lugar fora de
`tokens.css` que carrega a cor de fundo, e não tem escapatória**: recurso de
Android não enxerga custom property de CSS. O `theme-color` do `<meta>` chegou a
ser um segundo e deixou de ser — o `pintarTema()` o LÊ do `--bg` já resolvido (a
folha entra no `<head>` e o script no fim do `<body>`, então o estilo já está
aplicado quando ele roda), e o literal do HTML cobre só o instante anterior a
esse script. Quem escolhe entre os dois é a
`MainActivity` em tempo de execução (`AVNative.temaClaro` → `setTemaClaro`), a
partir de uma CÓPIA da escolha guardada em `SharedPreferences`: um recurso de
XML é resolvido antes de existir JavaScript, então o primeiro quadro só pode vir
de uma preferência guardada. **O preço, dito em vez de escondido: trocar de tema
tem um lançamento de atraso no fundo do splash, e só nele.** A mesma chamada
vira a bandeira `APPEARANCE_LIGHT_STATUS_BARS` — que o Android 15+ NÃO ignora
(ele ignora as CORES das barras, não a aparência dos ícones), e sem a qual o
tema claro fica com o relógio e os botões de navegação brancos sobre branco.

**Não há teste automatizado de contraste no repositório.** Os números nos
comentários de `tokens.css` são medições feitas à mão, e os pares que ficam
abaixo do piso estão declarados como tais no próprio comentário. Ao mexer num
token, meça — nada no CI vai barrar uma regressão, **e agora são DOIS temas a
medir**. O que o CI trava é outra coisa, e vale repetir para não confundir os
dois: `tools/tokens.test.mjs` garante que todo `var(--x)` sem fallback aponta
para um token que EXISTE (um `var()` inválido computa para o valor inicial da
propriedade, sem aviso nenhum — foi assim que os dois botões da folha de
conectar ficaram com cantos retos na v5.171) e que nenhum token exista só no
tema claro; `tools/smoke.mjs` trava o efeito RENDERIZADO nos dois temas, o palco
que não os segue e a escolha que sobrevive à recarga.

O raciocínio completo (cada par medido, os pisos adotados, os ladrilhos da
Bíblia e as células de capítulo/versículo) está na seção de paleta de
`docs/ARQUITETURA-WEB.md`.

---

## Divergências entre o caminho web e o nativo

**Regra de escrita:** toda guarda é `if (!window.__NATIVE__) { …web… }`, nunca
o inverso como caminho principal. O comportamento de navegador é o padrão; o
nativo é a exceção que se declara. Assim a base continua rodando nos dois
contextos.

| Ponto | Navegador | App nativo |
|---|---|---|
| Service workers (`sw.js`) | — | **o arquivo não existe no bundle e o registro saiu dos DOIS apps** (v5.48): os assets já são locais, e recarregar o WebView do telão no meio de um culto é justamente o que não pode acontecer. Atualizar a base é papel do OTA |
| `#startBtn` "Ligar Sistema" | destrava autoplay de terceiros | **oculto** — `mediaPlaybackRequiresUserGesture = false`; uma TV não recebe toque |
| Recuperação de áudio bloqueado | segue tocando mudo + retentativas | **desativada já no `onBlocked`** — sem política de gesto, qualquer `NotAllowedError` só pode ser falso positivo, e mutar antes de descobrir isso deixava o telão sem som sem armar recuperação nenhuma |
| Pastas do dispositivo | `showDirectoryPicker()` | **SAF** — a File System Access API **não existe no Android**; este recurso era letra morta no celular e passa a funcionar |
| Compartilhamento | **não existe mais** — vinha do `share_target` do manifest com o POST interceptado pelo SW, e os dois saíram do bundle; a leitura remanescente do estado `pending-share` (que ninguém escrevia desde a v5.48) saiu na limpeza da auditoria de agosto/2026 | **`intent-filter` nativo** (`ShareIntake.kt`), que só aceita `content://` de outro app (ver abaixo) |
| Link do YouTube compartilhado | vira item de player (o embed) | **no avançado, as MESMAS quatro escolhas da busca** (v5.137): a folha de tocar · playlist · Cronograma · Favoritos, com vídeo/só-áudio e o teto de resolução. As duas portas de entrada de um vídeo do YouTube passaram a dar no mesmo lugar — antes o share decidia sozinho: sempre vídeo, sempre no Cronograma, sempre no padrão de qualidade. **No simplificado não há pergunta e há TRANSMISSÃO DIRETA** (v5.138): ali o link compartilhado É um "tocar agora" — vai direto ao telão, não entra em lista visível nenhuma e ninguém pediu para guardar —, então ele passa por `tentarTransmitir` antes do download, como o "Tocar agora" do avançado. Uma folha com destinos que aquela tela não tem seria pior que folha nenhuma; esperar centenas de MB para começar a projetar era a espera que a transmissão existe para acabar. Falhando a transmissão, cai no download e, falhando ele, no item de player: um link compartilhado nunca se perde |
| Destino de um item (acervo · YouTube · importação · share) | uma escolha por vez: a folha fechava no primeiro toque | **VÁRIOS destinos de uma vez** (v5.141): cada linha de destino ganhou uma caixa de marcação na borda. O toque no corpo da linha continua sendo a ação de um toque — agora para aquela linha MAIS o que estiver marcado —, e a caixa só marca, sem fechar a folha. Um vídeo do YouTube passa a ser baixado UMA vez para ir ao Cronograma e aos Favoritos (antes eram dois downloads de minutos, e o operador só descobria na segunda espera). A importação e o share de arquivo abrem a mesma folha como PERGUNTA, com o Cronograma já marcado; desistir dela entra no Cronograma, como sempre. Ver `docs/ARQUITETURA-WEB.md`, "UM item, VÁRIOS destinos" |
| Onde o share ATERRISSA | idem ao nativo (o caminho é o mesmo `importShare`) | **`focarImportado`** (v5.77): fecha os popups abertos e a seleção, e então **projeta na hora** no simplificado ou **vai para o Cronograma** no avançado — e no simplificado o item NÃO entra em lista visível nenhuma (v5.89: vai para a prateleira `avulsos`), porque aquela tela não tem Cronograma nem playlist. A preview em tela cheia só é encerrada se houver telão — sem ele, ela É a projeção |
| Estado do telão (rodapé de Configurações) | atalho `window.open('../display/')`, útil só para desenvolver | **indicador ao vivo** (desabilitado como botão) — a Presentation é criada sozinha |
| Botão de cast da preview | oculto | `AVNative.openCast()` → seletor de **espelhamento de tela** (ver abaixo) |
| Retomada do telão ao RECONECTAR | idem (o caminho é o mesmo `resendSceneToDisplay`) | **só reenvia o que ESTAVA no ar** (v5.142). `currentId` sobrevive de propósito ao stop e ao fim natural — é o que permite repetir a faixa com o ▶ —, e reenviar por ele fazia o telão acordar com um vídeo engatilhado que ninguém pediu (o retângulo cinza com o play) ou ressuscitar a música que já tinha acabado. Quem responde a pergunta certa é `midiaNoAr`; um telão vazio também é um estado, e restaurá-lo é não mandar nada |
| Girar a mídia | idem (o comando é o mesmo `rotate`) | **novo na v5.142**: vídeo gravado de lado chega DEITADO no telão e não havia o que fazer. Um botão em Configurações avança 90° por toque; o motor TROCA O EIXO da caixa antes de girar, para o `object-fit` fazer a conta no retângulo em que a mídia vai de fato aparecer. Tomou o lugar do "Esticar", que distorcia a proporção — o defeito que "Ajustar" e "Preencher" existem para evitar |
| Som na preview ("mesa de som") | **não existe mais** — a preview é sempre muda | **REMOVIDO na v5.189**, a pedido do operador: o som do sistema é o dos DISPLAYS (a TV pela `Presentation`, as telas da rede pelo `<video>` delas). Os WebViews dividem o processo e a saída de áudio do Android, então o áudio da preview só tinha como tomar o foco e INTERROMPER o player do telão — a v5.141 já escondia o botão com telão conectado, e a v5.189 tirou o modo inteiro (com ele, o `keepAudioAlive` da ponte) |
| PDF, PowerPoint, Google Apresentações | **PDF não existe** (não há quem o desenhe); o `.pptx` funciona, e é o MESMO caminho do app | **viram UMA IMAGEM POR PÁGINA**, cada formato pelo caminho que existe para ele: o **PDF** pelo `PdfRenderer` da PLATAFORMA (`SlideDeck.kt` + `AVNative.deckPages`) — fidelidade total, zero dependência; o **`.pptx`** pelo renderizador de OOXML em `assets/web/vendor/` (`pptxParaPaginas`, em `controle.js`), carregado por `import()` dinâmico e rasterizado com `<foreignObject>` + canvas. Daí para a frente é mídia comum: fade, cortina, telão e `MediaSession` que já existem, com ⏮/⏭ passando página. **Não há botão de "apresentação"**: uma apresentação é um arquivo como outro qualquer, e entra pelo mesmo "Importar arquivos" (que no app abre o seletor do SISTEMA, `pickDoc` — o `<input type="file">` devolve bytes, e o PDF precisa que o shell abra o ARQUIVO) ou pelo compartilhamento. O `.ppt` anterior a 2007 e o `.odp` ficam de fora: ninguém sabe desenhá-los, e aceitar para depois falhar é pior que não aceitar. O link do Google entra sozinho pela URL de exportação |
| **Tocar agora** de um vídeo do YouTube | player embutido (IFrame API) | **TRANSMISSÃO DIRETA** (v5.120/shell 26; **funcionando só do shell 27 em diante**): o shell monta o manifesto das duas faixas adaptativas (`ytStream`), o `StreamProxy` as serve pelo NOSSO origin com o UA que combina com a URL, e o `MediaSource` de `shared/mse.js` as vira um `<video>` COMUM — fade, cortina, `MediaSession`, barra e segundo plano de graça, **e zero pixel de YouTube no telão**. Sem esperar o download. A faixa de bytes viaja na QUERY (`?r=<ini>-<fim>`), nunca no cabeçalho `Range` — ver a invariante 8, que é a razão de o recurso ter passado três versões sem tocar um único vídeo. Só em "Tocar agora": as outras três ações GUARDAM o item, e um manifesto expira em horas. Falhando qualquer coisa (shell < 27, vídeo sem par adaptativo, WebView sem o codec) cai no download, calado — o operador pediu o louvor, não o método |
| Vídeo do YouTube | player embutido (IFrame API) | **arquivo de vídeo baixado PELO APARELHO** (`YoutubeGrab.kt` + `AVNative.ytFetch`) — o embed pausa sozinho com o app minimizado, e a extração no próprio celular sai do IP do chip, que é o que o YouTube não bloqueia. Sem configurar nada. Cobalt continua como segunda opção para quem já mantém uma instância; falhando os dois, o link vira item de player |
| Qualidade do download | — | **o operador escolhe o teto** (1080p · 720p · 480p, v5.118/shell 25), no mesmo seletor de Vídeo/Só áudio da folha. Ele nasce no padrão A CADA ITEM, e isso é deliberado: um teto que grudasse faria quem escolheu 480p numa rede ruim receber, sem aviso, o vídeo principal do domingo seguinte em 480p no telão — o atrito de dois toques é visível, a regressão silenciosa não seria. Pedir 1080p continua saindo pelo `ytFetch` de sempre (nenhum shell novo exigido); só um teto MENOR usa o método novo. O progressivo respeita o teto, mas nunca ao ponto de não entregar nada: não cabendo nenhum, vale o menor que existir |
| Resolução do download | — | **até 1080p, montando as duas faixas** (v1.44; pares por contêiner na v1.45). Acima de 720p o YouTube só entrega vídeo SEM som, com o som à parte — e por isso o app baixava a pior cópia: só sabia pegar o progressivo, que neste aparelho é UM, de 360p. `MuxMp4.kt` junta as duas com o `MediaMuxer` da PLATAFORMA: é cópia de amostras, não recodificação, então não há perda nem espera. Teto de 1080p de propósito (o telão da igreja é 1080p) e só quando o resultado for melhor que o progressivo — senão dois downloads e um muxer entregariam o mesmo de antes. Os pares são do MESMO contêiner (mp4+m4a → MP4, webm+webm → WebM, este só na API 29+): "a melhor de cada lado" produziria VP9 dentro de MP4, que o muxer recusa depois de tudo baixado. Falhando qualquer etapa, o progressivo segue como piso. **Da v1.44 à v1.48 isso não saía do papel: as faixas eram listadas (1080p) e o CDN respondia 403 a todas** — com os dois pares, os dois perfis de UA e `Range`. Era o SABR, que o YouTube passou a exigir de quem pede sem PO Token. A saída não era montar o token (o `getWebClientPoToken` da biblioteca não tem uma única chamada em versão nenhuma, e o token do cliente Android — o que ela de fato consome — exige o DroidGuard do Play Services): foi **atualizar o extrator para a v0.26.4** (v1.49), que busca o cliente **visionOS** sem token nenhum e volta a entregar as adaptativas. Como as listas passaram a chegar MISTURADAS (visionOS + o cliente antigo), a escolha virou uma **fila de candidatos** — ver "O cliente visionOS destrava o 1080p" em `docs/ARQUITETURA-WEB.md`. **CONFIRMADO em aparelho:** `clientes VISIONOS 17, ANDROID 1 → juntou 1080p (mp4, 137@VISIONOS/V)`, sem uma única recusa na fila. Diagnóstico no rodapé de Configurações, agora com o itag, o cliente e o motivo de cada tentativa |
| **Só o ÁUDIO** em "Tocar agora" | player embutido | **TRANSMITIDO também** (v5.130): o manifesto do shell já traz o par, e o lado web simplesmente DESCARTA a faixa de vídeo (`man.video = null`) — nenhum método novo, nenhum byte de 1080p baixado para ser jogado fora, e por isso chega por OTA. Entra como `kind: 'audio'` (o telão mantém o wallpaper) e o fallback, se a transmissão morrer, baixa a MESMA forma. O download de um m4a é rápido, mas "rápido" não é o pedido: o pedido é não esperar |
| **Só o ÁUDIO** guardado (playlist · Cronograma · Favoritos) | — | **`ytFetchAudio`** (v5.112, shell ≥ 23; **exige o APK v1.41+** — ver abaixo): a faixa de áudio, sem vídeo. A escolha é o MESMO seletor de Cantada/Playback das músicas, no topo da folha de destinos, e vale para as quatro ações. Entra como `kind: 'audio'` e **sem miniatura** — é o kind que faz o telão manter o wallpaper em vez de trocar de imagem. É também o único caminho em que o teto de 720p do progressivo não existe: o áudio do YouTube já vem em faixa separada, então aqui ele vem inteiro. **E é justamente por ser faixa separada que ele pode não vir**: adaptativo é o que o YouTube protegeu com SABR quando o app pedia sem PO Token. Daí a fila de tentativas do shell — que na v1.49 deixou de ser "m4a → qualquer outro → progressivo" e passou a ser **três candidatos de áudio na ordem do cliente que funciona** (visionOS primeiro), com o progressivo ainda no fim. **CONFIRMADO em aparelho:** `→ veio m4a 140@VISIONOS` (AAC-LC 128 kbps, primeiro candidato, primeira requisição) — até a v1.48 este caminho caía no vídeo de 360p inteiro. O registro entra como `kind: 'audio'` em todos os casos: quem decide que o telão não muda de imagem é o kind, não o container |
| Buscar no YouTube | não existe: o botão abre o YouTube numa aba | **a busca acontece DENTRO do acervo** — a tela que o rótulo chama de **Biblioteca** desde a v5.96, e que no código segue sendo o acervo — (`AVNative.ytSearch`, `YoutubeGrab.pesquisar`, em **português** — no padrão en-GB da biblioteca o YouTube devolve o título TRADUZIDO de vídeos que são originalmente em português, e passar a localização ao `NewPipe.init` NÃO resolve: o serviço filtra o idioma por uma lista de suportados que hoje só tem `en-GB`. Quem resolve é o `forceLocalization` do próprio `Extractor`): os resultados entram na mesma lista e o toque abre a mesma folha de escolhas das músicas (tocar · playlist · Cronograma · Favoritos), cada uma indo para o seu lugar — e, desde a v5.141, para mais de um de uma vez, com um download só. Um iframe da página de resultados é recusado pelo `X-Frame-Options` do YouTube, e a API oficial exigiria chave com cota compartilhada pela frota |
| Link para fora do app ("Pesquisar … no YouTube") | `window.open` numa aba nova | **`AVNative.openExternal(url)`** → `ACTION_VIEW` numa tarefa própria. O WebView RECUSA navegar para outro origin (invariante 2), então sem esse método um link externo não faz absolutamente nada — nem erro no console |
| "Conectar a tela" (modo simplificado) | abre a tela do Display (`window.open`) — e é ela que conta como "conectado" | mesmo `AVNative.openCast()`, com o nome da tela conectada no subtítulo |
| Simplificado sem tela conectada | mesmo bloqueio, com a janela do Display no lugar da `Presentation` | **modo bloqueado**: cortina embaçada sobre tudo, só o botão de conectar — preenchido no accent, no centro da tela — e a saída para o avançado na frente |
| Fullscreen da preview | `requestFullscreen` + Screen Orientation API | idem, com trava de paisagem **nativa** (`onShowCustomView`) |
| Botões físicos de volume | o navegador não os recebe | **interceptados** e ligados ao fader do app (ver abaixo) |
| Microfone (`getUserMedia`) | o navegador pergunta | `MicChromeClient` + permissão `RECORD_AUDIO` (ver abaixo) |
| Câmera (`getUserMedia`) | o navegador pergunta | **negada, sempre** (v5.185). O único uso era o leitor de QR do espelho, que saiu com a permissão `CAMERA` do manifest. O `onPermissionRequest` do `ControleChromeClient` FICOU, negando explicitamente com log: um WebView sem ele nega **em silêncio**, e o próximo que precisar de mídia aqui descobriria a armadilha do zero, no aparelho, sem erro no console |
| Botão voltar | — | **fecha o que estiver aberto** (popup, sub-tela, aba) e só então manda a tarefa para segundo plano (ver abaixo) |
| Controles fora do app | — | **notificação + tela de bloqueio + botões de mídia** via `MediaSession` (ver seção acima) |
| Download com o app minimizado | a aba continua baixando | **foreground service + wake lock** — sem isso o processo é congelado (ver seção acima) |
| Atualização da base web | recarregar a página | **OTA** — bundle publicado em `web-latest`, aplicado no próximo lançamento (ver seção acima) |
| Tema claro × escuro | funciona igual: a escolha é CSS + `localStorage`, e o `theme-color` tinge a barra de endereço | idem, **mais o cromo do sistema**: `AVNative.temaClaro` vira os ÍCONES das barras (que o Android desenha, e que ficariam brancos sobre branco) e guarda a escolha para o `windowBackground` do PRÓXIMO lançamento — um recurso do APK é resolvido antes de existir JavaScript |
| **Telão nas telas da rede** | **não existe** — um navegador não abre `ServerSocket` nem serve o bundle | **servidor HTTP no próprio celular** servindo o `/web/display/` de verdade (resolução OTA→APK) + comandos por SSE + mídia por `/m/<token>`: o telão inteiro em até três navegadores da rede, sem instalar nada neles e sem internet (ver a seção do recurso). Liga e desliga **só** por ação do operador |
| Papel `__AV_ROLE__` | `'controle'` / `'display'` | **um TERCEIRO valor, `'tela'`** — o mesmo `/web/display/` num navegador da LAN, marcado por `?tela=1` na query (não há ponte lá; quem escreve a global é o próprio `tela.js`). Ele é seguro por construção: as leituras do papel no bundle comparam `!== 'controle'`, e **nenhum caminho testa `=== 'display'`**. O papel ativa o dreno de subida, o `forceMuted` inicial e o `__telaSom` do gesto de entrada |

### Compartilhamento: um ponto de entrada exportado valida o que recebe

O `intent-filter` de `ACTION_SEND` é público e qualquer app instalado pode
dispará-lo. `ShareIntake` só aceita `content://`: `openInputStream` também atende
`file://` e `android.resource://`, e a leitura acontece com o uid DESTE app — um
app malicioso com `targetSdk` antigo podia compartilhar
`file:///data/data/br.org.iasd.av/shared_prefs/…` e o conteúdo virava item de
mídia do Cronograma, projetável na TV. A autoridade do próprio app também cai
fora. Não há canal de volta para quem compartilhou (o dano demonstrável é nulo),
mas um ponto de entrada exportado que não valida o que recebe é dívida gratuita.

O intent é **consumido** depois de lido (`consumeShareIntent`), e o parse só roda
com `savedInstanceState == null`. A única saída do app é `moveTaskToBack`, então
a Activity nunca é finalizada e `getIntent()` devolveria o mesmo `ACTION_SEND`
para sempre: qualquer recriação (mudar o tamanho da fonte ou o idioma — nenhum
dos dois está em `android:configChanges` — ou voltar pelo Recentes) importaria
uma segunda cópia integral do arquivo, sem aviso e sem desfazer.

### Microfone ao vivo (push-to-talk)

O operador segura um botão no Controle e a voz sai **na projeção**, ao vivo.

**A captura acontece no WebView do Display**, não no do Controle — e isso não é
detalhe de implementação: um `MediaStream` **não atravessa o
BroadcastChannel** (não é clonável), então mandar o áudio "pela ponte" não
existe como opção. O que atravessa é o comando `mic`; quem abre o microfone é
quem vai reproduzi-lo. No navegador, onde Display e Controle são páginas
separadas, essa também é a única escolha correta.

Do lado nativo, duas peças:

- **`MicChromeClient`** (usado pelo WebView da `StagePresentation`). Um WebView
  **nega `getUserMedia` em silêncio** se ninguém tratar `onPermissionRequest`:
  a promise é rejeitada e não há erro no console que explique. É o mesmo padrão
  do `onShowFileChooser` (invariante 6). Três regras: concede **só**
  `RESOURCE_AUDIO_CAPTURE` (o sistema de projeção não tem uso para câmera, MIDI
  ou proteção de conteúdo); **só se o app já tiver `RECORD_AUDIO`** — conceder
  ao WebView uma permissão que o processo não tem apenas adiaria a falha para um
  ponto sem sinal claro; e **só da própria origem**. A terceira é defesa em
  profundidade: este client é do WebView do TELÃO, que carrega conteúdo de
  terceiro por design, e o `grant()` é silencioso — não há prompt nem sinal na
  tela. Uma origem AUSENTE não é negada (nunca foi observada aqui, e recusar por
  um campo vazio tiraria o push-to-talk sem ganho conhecido).
- **`requestMicPermission`** (`AVNative.requestMic()`), pedido **sob demanda**,
  no primeiro toque no botão. Não na abertura do app: um pedido de gravar áudio
  sem contexto, no primeiro lançamento, é o tipo de coisa que se nega por
  reflexo — e aí o recurso fica quebrado sem motivo.

O caminho de áudio no Display é `getUserMedia → MediaStreamSource → GainNode →
destination`, com rampa na entrada e na saída (cortar no meio de uma palavra
estala na caixa de som). `echoCancellation` fica **ligado**: num culto um ganho
realimentado é um estrago imediato e público, e vale mais que a fidelidade extra
de desligar o processamento. Ainda assim, se a saída de áudio for o próprio
celular e não a TV, o risco de microfonia continua — é do formato, não do
código. A latência do WebView é inerente.

O microfone fecha sozinho ao soltar o botão, ao **trocar de aba** e quando o
app vai para **segundo plano**: push-to-talk que sobrevive ao botão vira um
microfone esquecido ligado.

### Botão voltar: fecha antes de minimizar

Sair do app por engano durante um culto derrubaria a projeção, então o voltar
**nunca** encerra a Activity — no fim da fila ele apenas manda a tarefa para
segundo plano, com a sessão e a `Presentation` vivas. Isso não mudou.

O que faltava era a **fila**: com um popup aberto, uma pasta aberta ou a preview
em tela cheia, o gesto que todo usuário de Android conhece para "fechar isto"
minimizava o app inteiro.

**Quem decide é o lado web** (`window.__avBack`, em `controle.js`) — invariante
5: a hierarquia de navegação já existe lá, e reimplementá-la em Kotlin seria
duplicar o que `navigateBack()` faz. `MainActivity.handleBack()` só pergunta e
obedece. A ordem vai do mais efêmero ao mais permanente, que é a ordem em que
as coisas foram abertas:

1. diálogo modal (cancela, como o botão Cancelar)
2. dentro da gaveta de Favoritos: seleção múltipla, depois a pasta aberta — a
   hierarquia de DENTRO vem antes da gaveta, e a seleção antes da pasta porque
   ela é do conteúdo dela
3. bottom-sheet aberto (o de cima, se houver mais de um — a gaveta de Favoritos
   é um deles)
4. preview em tela cheia — que, sem telão conectado, **é** a projeção
5. coluna do mixer aberta no fader
6. seleção múltipla (a da lista de baixo, sem gaveta aberta)
7. sub-tela com voltar próprio (telas da Bíblia) → `navigateBack()`
8. aba diferente do Cronograma → volta para ele
9. nada aberto → `moveTaskToBack`

A tabela de popups é **a mesma** que registra o ✕ e o toque no fundo
(`POPUPS`): um popup novo entra numa linha e já é fechável pelos três caminhos.
Duas listas divergiriam no primeiro que alguém esquecesse de acrescentar.

**A resposta é assíncrona, e por isso há um prazo** (`BACK_JS_TIMEOUT_MS`,
350 ms). `evaluateJavascript` responde por callback; se o renderer morreu, está
travado, ou o bundle é antigo demais para ter `__avBack`, esse callback pode
nunca chegar — e um botão voltar que não faz **nada** é pior que um que
minimiza. O `postDelayed` garante a resposta padrão.

O que o `AtomicBoolean` garante, exatamente: que `moveTaskToBack` roda no
**máximo uma vez** por toque. Ele **não** garante que o app não minimize depois
de o web já ter fechado um popup — `__avBack()` executa a ação de forma síncrona
e só então retorna, então o que chega tarde é a RESPOSTA, não a ação. Com o
renderer ocupado, o prazo pode vencer com o popup já fechado e o operador vê as
duas coisas num toque só. Fechar isso de verdade exige um token de corrida
devolvido pelo lado web (`__avBack(token)` → `__avResolve`), o que é mudança de
contrato da ponte; enquanto não existe, o prazo é curto justamente para o caso
comum nunca chegar perto dele.

### Botões físicos de volume

O Android roteia os botões de volume para a **saída em uso** — e com
espelhamento ativo isso vira o volume da TV. O operador apertava o botão e o
fader do app não saía do lugar.

`MainActivity.onKeyDown` consome `KEYCODE_VOLUME_UP/DOWN` (e o `onKeyUp`
correspondente, senão o sistema ainda reage ao evento de soltura) e entrega o
passo ao Controle em `window.__avVolumeKey(±1)`, que o aplica em
`applyVolume()` — a mesma função do fader e do gesto de arrasto. Também
`volumeControlStream = AudioManager.STREAM_MUSIC`, para o caso de o sistema
chegar a tratar algum evento.

Duas salvaguardas:

- **Só intercepta depois que o lado web pede** (`AVNative.captureVolumeKeys
  (true)`, chamado no fim do carregamento do Controle). Se a Activity
  interceptasse desde o `onCreate`, uma falha no JS deixaria o aparelho sem
  **nenhum** controle de volume enquanto o app estivesse aberto.
- **Válvula de escape:** com o fader já no máximo (ou no zero), o lado web
  devolve o passo ao sistema (`AVNative.systemVolume`, que chama
  `adjustStreamVolume` com `FLAG_SHOW_UI`). Sem isso, um aparelho com o volume
  de mídia baixo ficaria sem como subir com o app aberto.

**A tecla mostra o fader por alguns segundos.** Interceptar o botão resolveu
*onde* o volume muda, mas o deixou **invisível**: com a coluna do mixer no
estado normal, o operador apertava e não via quanto ficou. `peekVolume()` (lado
web, `VOL_PEEK_MS` = 2,8 s) abre a MESMA visualização do toque no botão de
volume — reusando `openVolume()`/`closeVolume()`, não uma segunda UI — e a
recolhe sozinha. Vale inclusive quando a tecla vai para o sistema (fader no
máximo/zero): ver o fader no fim do curso é justamente a resposta para "por que
o volume do app não muda?". Detalhes das três regras de convivência com o toque
(só recolhe o que ela abriu; o toque nos botões cancela; mexer no fader
reinicia a contagem) em `docs/ARQUITETURA-WEB.md`, seção do Mixer.

### Espelhamento de tela ≠ Google Cast

O botão de cast da preview precisa abrir o **espelhamento de tela** (Smart View
na Samsung, "Wireless display"/"Transmitir tela" no AOSP) — não o **Google
Cast**, que é outra coisa: o Cast manda uma URL para o dispositivo tocar
sozinho, o espelhamento manda a imagem da tela, que é o que serve aqui quando
não há `Presentation`.

A ação pública `Settings.ACTION_CAST_SETTINGS` **cai no Google Cast** em vários
aparelhos (foi o que aconteceu na Samsung testada), então ela é o último
recurso, não o primeiro. E não existe API pública para o *popup* das
configurações rápidas: `Settings.Panel` só cobre internet, wifi, nfc e volume.

`MainActivity.pickCastIntent()` percorre alvos conhecidos, do mais específico
ao mais genérico, e escolhe o primeiro que **existe neste aparelho e não
resolve para o Play Services** (`com.google.android.gms`) — é esse filtro, e
não só a ordem, que impede a cadeia de terminar no seletor de Cast enquanto
ainda há espelhamento a tentar:

**Só num aparelho SAMSUNG** (`isSamsung()`, v1.24):

1. **as activities exportadas do Smart View** — `com.samsung.android.
   smartmirroring` e `com.samsung.android.app.smartmirroring`
2. `com.samsung.wfd.LAUNCH_WFD_PICKER`

**Em qualquer aparelho**, e o único alvo nos que não são Samsung:

3. `android.settings.WIFI_DISPLAY_SETTINGS` (AOSP, ação legada — e a que **não**
   é reivindicada pelo Play Services, ao contrário de `CAST_SETTINGS`)

A cadeia nasceu no aparelho em que o app é operado (um S24 Ultra) e foi escrita
em volta dele — mas **"Smart View primeiro" é regra de UM fabricante, não do
Android**. Noutra marca esses pacotes simplesmente não existem, então a cadeia
já caía no alvo universal sozinha; o que a guarda acrescenta é **dizer isso** em
vez de deixar por acaso, não varrer as activities de dois pacotes ausentes a
cada toque no botão (e a cada abertura de Configurações, que chama
`describeCastTarget`), e fechar o caso em que o acaso não bastava — um pacote de
outro fabricante com o mesmo nome, ou uma ROM que carregue os apps da Samsung,
entraria na frente do alvo AOSP sem que nada no código tivesse decidido isso.

`isSamsung()` aceita `Build.MANUFACTURER` **ou** `Build.BRAND`: os dois dizem
"samsung" num aparelho de fábrica, mas uma ROM alternativa (ou um emulador) mexe
num e esquece o outro — e aqui errar para o lado do "não é Samsung" custaria o
Smart View justamente no aparelho em que o app é usado. Comparação sem caixa,
porque o valor não é normalizado por contrato.

Para o Smart View o nome da activity **não é adivinhado**: `exportedActivities()`
pergunta ao `PackageManager` quais o pacote expõe (`GET_ACTIVITIES`) e enfileira
as exportadas. A primeira tentativa usava um nome chutado — um palpite errado
simplesmente não resolve, a cadeia cai no fallback e o botão abre o Google Cast,
que é o oposto do pedido. Perguntar ao sistema elimina o chute.

**Nada disso é API documentada.** Se um alvo não existir (ou não for
exportado), `resolveActivity` devolve null / `startActivity` lança, e a cadeia
segue sem quebrar nada. Por isso `resolveActivity` precisa enxergá-los: daí o
bloco `<queries>` no `AndroidManifest.xml` (visibilidade de pacotes do Android
11+) — sem ele tudo resolveria para null e a cadeia cairia direto no fallback.
E o fallback abre a tela de **Tela** antes da de **Cast**, justamente porque o
Google Cast é o que não se quer aqui.

Como isso é território de fabricante, `describeCastTarget()` devolve o rótulo
do alvo escolhido **com o componente real** e o **popup de Configurações mostra
"Espelhar abre: …"**. O operador vê o que o aparelho ofereceu antes de tocar —
e, quando o botão abre a tela errada, essa string é o que diz qual candidato
pegou, sem depender de logcat.

### Andaimes do modelo de dois PWAs, removidos

A base web nasceu como **dois PWAs instaláveis** que se comunicavam por
BroadcastChannel, porque o Miracast só espelha a tela inteira do celular. Com a
`Presentation` confirmada em aparelho real (o shell manda **só o Display** para
a TV), esse andaime não tem mais função e saiu do bundle:

- **`web/index.html`** — a página que oferecia "Abrir Controle / Abrir
  Display". O shell carrega `/web/controle/` e `/web/display/` direto.
- **`controle/manifest.json` e `display/manifest.json`** — instalação como
  WebAPK, `scope`, `orientation`, `share_target`. Nada disso existe num
  WebView: ícone, nome e orientação vêm do APK, e o share chega por
  `intent-filter`.
- **`controle/icons/` e `display/icons/`** — só o manifest e os
  `<link rel="icon">` os usavam. Os ícones do app estão em `res/`.
- **`sw.js` e os dois blocos que o registravam** (v5.48). O último uso era o
  auto-reload quando um SW novo assumisse; a base web atualiza por OTA, e um
  reload do WebView do telão no meio de um culto é o que não pode acontecer.
- **"Abrir Display"** — virou indicador de estado (acima).

O que **fica**: a preview em tela cheia (a projeção quando não há TV
conectada, com os gestos invisíveis) e todas as guardas
`if (!window.__NATIVE__) { …web… }`. A base precisa continuar rodando no
navegador — é assim que se desenvolve e se testa fora do aparelho.

---

## Build e distribuição

`.github/workflows/apk.yml` — o runner `ubuntu-latest` já traz JDK e Android
SDK; nenhuma infraestrutura externa.

| Rota | Como | Observação |
|---|---|---|
| Artifact | Actions → run → *Artifacts* | vem como **.zip**; precisa descompactar no celular |
| **Release** ⭐ | `git tag v1.0 && git push --tags` | **link direto para o .apk**; instala pelo Chrome do celular |
| Release (sem push de tag) | Actions → *Build APK* → *Run workflow*, com `release_tag` | mesma coisa pelo disparo manual — a tag é criada pelo próprio workflow |

**O `web-ota` roda com fila, sem cancelamento** (`concurrency: web-ota`,
`cancel-in-progress: false`). Os dois assets da release `web-latest` (o zip e o
`version.json` que carrega o `sha256` dele) são substituídos um a um, sem
transação: duas execuções em paralelo — o merge da branch seguido de um push de
correção é o caso normal — podem intercalar e deixar o zip de uma com o `sha256`
da outra, e a partir daí todo aparelho baixa, confere o hash e o OTA fica INERTE
até o próximo push em `main`, sem nenhum sinal. Cancelar no meio do upload
produziria exatamente o mesmo estado, por isso a fila espera.

**Antes de publicar, o job confere a sanidade do bundle:** `node --check` em
todo `.js` de `assets/web`, uma validação de `version.json`, os testes de
`tools/` — o parser `sidx`, o **oráculo do contrato de `shouldInterceptRequest`**
(`webview-range.test.mjs`, que trava a invariante 8: Node puro, determinístico,
sem `continue-on-error`) e onze testes **em Chromium de verdade**, todos em
`continue-on-error`: a **fumaça** que sobe a base web e usa a tela
(`smoke.mjs`), o **BOOT COM A PONTE PRESENTE** (`boot-nativo.test.mjs`, v5.195 —
o `smoke` sobe a base SEM `__AVBridge`, e por isso todo caminho guardado por
`window.__NATIVE__` nunca era executado por teste nenhum: são justamente os que
só rodam no aparelho. A v5.195 saiu com um `const` em zona morta temporal dentro
de um `if (espelhoDisponivel())` — verde no CI, tela PRETA no celular, e o
watchdog do OTA descartando o bundle no lançamento seguinte. Ele injeta uma
ponte de mentira e pergunta o que o watchdog pergunta: o app ficou de pé?), as **mensagens de falha** da transmissão direta
(`mse.test.mjs`), a **transição de entrada do palco** (`stage-fade.test.mjs`),
o **coletor de lixo do banco** (`db-gc.test.mjs` — o único código do app que
apaga mídia do operador), as **contas da biblioteca** (`acervo.test.mjs`:
"completa?" e "quanto ocupa?", que eram respondidas por fórmulas diferentes na
mesma tela) e **o que a ponte de fato entrega** (`ponte.test.mjs` — `native.js`
REMONTA campo a campo os objetos que manda ao Kotlin, e um campo esquecido some
em silêncio: `optBoolean`/`optLong` leem ausente como `false`/`0`, que são
valores legítimos) e **o TELÃO** (`display-smoke.mjs`, v5.140 — até ele
**nenhum** teste carregava `/display/`: a fumaça abre o Controle e o
`stage-fade` monta o palco à mão, então a metade que roda na frente da
congregação era a metade que a CI nunca executou, e é justamente a que menos
rede de segurança tem, porque o watchdog do OTA também não a valida. Ele trava
também o endereçamento do reenvio de cena) e **os DESTINOS das folhas de
escolha** (`destinos.test.mjs`, v5.141 — o que está marcado tem de atravessar o
fechamento da folha: a ação roda depois de `closeSongMenu()`, que zera o
conjunto, e uma leitura tarde demais mandaria o item para UM destino em vez de
dois, sem erro nenhum) e **A CENA** (`cena.test.mjs`, v5.142 — o que o telão
mostra ao RECONECTAR. `currentId` sobrevive de propósito ao stop e ao fim
natural, então reenviar a cena por ele fazia o telão acordar tocando o que o
operador tinha parado; e a reconexão do dongle é o caminho menos testável à mão,
porque exige TV, dongle e o timing de derrubá-lo) e **O REGISTRO**
(`registro.test.mjs`, v5.206 — o único artefato do app cujo consumidor é um
HUMANO A DISTÂNCIA: todo o resto falha na frente de quem pode ver, e ele falha
CONTINUANDO A RESPONDER com uma frase errada. Nenhum teste o carregava, e por
aí passaram três defeitos ao mesmo tempo — o `ritmo` zerado imprimindo "ALARME:
ISTO É UM RETÂNGULO PRETO" em todo culto, toda tela conectada acusada de rodar
"bundle antigo", e um "modo: imagem (JPEG)" de um modo removido dez versões
antes. Ele cobra as DUAS metades: nenhuma palavra de recurso aposentado, e o
que o operador foi buscar presente — sem a segunda, apagar o bloco inteiro
passaria).
O telão nas telas da rede acrescentou mais dois: a **varredura de contexto
seguro** (`contexto-seguro.test.mjs`, que procura `VideoDecoder`, `wakeLock`,
`audioWorklet`, `randomUUID` e `crypto.subtle` fora de uma guarda
`isSecureContext` dentro de `assets/web/espelho/` **e de
`assets/web/display/`** — desde a v5.187 o display INTEIRO roda em `http://`
nas telas da rede, e ali essas APIs vêm `undefined`) e **a TELA DA REDE de
ponta a ponta** (`tela-rede.test.mjs`, v5.187, Chromium de verdade contra um
servidor de mentira que fala o protocolo do `EspelhoServidor`: o código de
entrada certo e o errado, o token que NUNCA aparece numa URL, o
`display-ready` endereçado, versículo com acento intacto, o cronômetro com o
relógio da tela 90 s errado — corrigido pela mediana dos pings —, o dreno de
subida, a mídia por `/m/` via `__rec`, o wallpaper por `__wp`, o `tela-aviso`,
a reconexão que se re-anuncia e o `adeus` que NÃO martela). A lição da v5.145
fica escrita porque continua valendo: **teste que não está no workflow é
documentação, não rede de segurança** — o `tela-rede` entrou no `apk.yml` no
mesmo commit em que nasceu.

> **E ELE PRECISA SER TÃO RESTRITO QUANTO O SERVIDOR DE VERDADE** (v5.204/v5.205,
> a lição mais cara da primeira ligada em rede real). Ele entregava o HTML **sem
> a CSP** e carregava a página com `?tela=1` **na mão** — isto é, provava o
> percurso num ambiente mais permissivo e por um caminho que o aparelho pode não
> receber. As duas divergências esconderam dois defeitos ao mesmo tempo: o estilo
> da entrada bloqueado (`<style>` em runtime × `default-src 'self'`) e o papel
> dependendo de uma query que se perde. Hoje ele injeta a marca do papel como o
> servidor injeta, manda a CSP verbatim, roda **sem query nenhuma** e AFIRMA a
> garantia que a CSP existe para dar (a IFrame API do YouTube barrada). **Um
> servidor de mentira que diverge do de verdade não prova nada.**
>
> E a instabilidade dele foi consertada no mesmo lote: falhava em duas de cada
> três execuções e "passava na segunda tentativa", porque esperava o servidor
> RECEBER o `POST /par` e lia a frase de erro no instante seguinte, quando quem a
> escreve é o cliente, depois da resposta. Com `continue-on-error` no `apk.yml`,
> um teste assim não é rede de segurança: é ruído que ensina a ignorar vermelho.

A v5.154 acrescentou o **oráculo da SOMBRA** (`tools/sombra.test.mjs`, Node puro,
**sem `continue-on-error`**): nenhuma função da base web pode redeclarar um nome
de módulo. Ele existe porque `node --check` **aprova** um `const ms = …` dentro
de uma função que lê a `ms` do módulo na primeira linha, e o que sai disso é um
`ReferenceError` por zona morta temporal — no espelho, a cada 500 ms, só nas
telas que tinham ligado o som (ver a auditoria na seção do recurso). A varredura
é por indentação, o que este código consegue por ser uniformemente formatado, e
a medição diz que ela não é ruidosa: nos onze arquivos da base, com o defeito no
lugar, o único achado era ele. (O caso da **despedida** — o `adeus` recebido
faz a tela PARAR, nada de martelar uma porta fechada — nasceu ali e hoje vive
no `tela-rede.test.mjs`.)

A v5.175 acrescentou o **oráculo dos TOKENS** (`tools/tokens.test.mjs`, Node
puro, **sem `continue-on-error`**): nenhum `var(--x)` **sem fallback** pode
apontar para um token que não existe. Ele é o irmão do oráculo da sombra, e pela
mesma razão — um `var()` inválido sem fallback não é erro em lugar nenhum: a
declaração inteira computa para o valor INICIAL da propriedade, sem aviso no
console e sem sintoma no lugar da causa. Na v5.171 isso deixou os DOIS botões
principais da folha "Conectar uma tela" com `border-radius: 0`, os únicos cantos
retos de um app inteiro arredondado, e foi preciso um par de olhos no aparelho
para vê-lo. `var(--x, fallback)` **não** é reprovado: é o idioma legítimo dos
valores que o JS entrega em tempo de execução (`--vol`, `--ch`, `--tab-w`).

O `ponte.test.mjs` afirma desde a v5.187 que **o `native.js` não drena papel
nenhum** (o dreno de subida mora em `tela.js`, e o relay nativo repassa tudo em
qualquer papel — inclusive no `display`, o par negativo que impede o dreno de
vazar para o telão de verdade) e que o **display emite as quatro mensagens**
(`display-ready`, `display-status`, `media-ended`, `mic-status`) — é o
`tela.js` quem filtra, nunca a fonte. O `display-smoke.mjs` fixa o viewport em
**961×540**, explicitamente: ele rodava no default do Playwright por acidente,
e fixado ali ele prova o layout do telão numa tela pequena sem aparelho.

**E há um passo de JUnit no CI desde a v5.143:** `./gradlew testDebugUnitTest`,
**sem `continue-on-error`**, antes do `assembleRelease`, cobrindo os arquivos
PUROS do espelho (`app/src/test/.../EspelhoHttpTest.kt` e
`EspelhoParesTest.kt`): tetos do parser, `read()` parcial, `Host` fora da
allowlist, `Origin` estranha, 404 uniforme, o código de três dígitos, prazo,
bloqueio CRESCENTE por origem, teto de sessões e saneamento. **A v5.187
acrescentou dois oráculos à mesma família**: `EspelhoHttpRangeTest.kt` (a
gramática RFC 7233 inteira do `alcanceDe` — malformado é IGNORADO e vira 200,
nunca adivinhado; `Range` duplicado é malformado; sufixo, cauda aberta e 416 —
que é a inversão da invariante 8 escrita como código, e por isso não podia
ficar sem oráculo) e `EspelhoMidiaCacheTest.kt` (o token-capacidade da rota
`/m/`: mesmo id + mesmo token = mesmo item, token novo substitui e MATA o
velho, cancelado nunca é servível, LRU por bytes só de completos). É a
fronteira de rede do projeto, e é o único lugar dele em que um erro vira
controle de acesso quebrado em vez de pixel errado — ver a quarta exceção nas
regras de desenvolvimento.

Eles existem porque `node --check` prova que o arquivo é
PARSEÁVEL, não que o app funciona — a v5.121 saiu com um botão chamando uma
função apagada, sintaxe perfeita e CI verde. O canal OTA publica
direto para a frota, e o watchdog de boot **não evita o primeiro estrago** —
`beginSession()` arma o `pending` e SERVE o bundle; só o lançamento seguinte o
descarta. Ou seja: um lançamento quebrado por aparelho, garantido, e se for o do
culto o operador fica sem sistema até fechar e reabrir o app. Não substitui teste
de comportamento; garante que o bundle carrega.

**Assinatura.** As Releases saem **assinadas com keystore fixa**, guardada nos
secrets do repositório (`KEYSTORE_B64` — o `.jks` em base64 —, `KEY_ALIAS` e
`KEY_PASSWORD`). É isso que permite **atualizar por cima sem desinstalar**, e
por consequência **sem perder a biblioteca do app**: o Cronograma, as pastas
sincronizadas, os hinos do LouvorJA e a Bíblia baixada vivem em IndexedDB/OPFS,
que o Android apaga junto com o app numa desinstalação.

- O `.jks` **nunca é versionado** (`.gitignore`); o build o materializa a
  partir do secret e o descarta com o runner. A decodificação usa
  `Base64.getMimeDecoder()`, e não o BASIC: o `base64` do GNU coreutils quebra a
  linha a cada 76 caracteres por padrão, e quem for rotacionar a keystore cola
  exatamente essa saída no secret — o decodificador BASIC lança diante de
  qualquer `\n`, e `trim()` só limpa as pontas.
- Sem os secrets (build local, PR de terceiro, clone), o `build.gradle.kts` cai
  na assinatura de **debug** e tudo continua compilando — só não serve para
  atualizar por cima.
- **Publicar exige a chave, e agora isso é dito em vez de deduzido.** O passo de
  Release passa `-PrequireSigning=true`, e o próprio Gradle reprova a ausência da
  keystore: quem sabe se ela existe é ele. A guarda anterior era **código
  morto** — deduzia da existência de `app-release.apk`, mas o AGP só acrescenta
  o sufixo `-unsigned` quando a variante não tem signingConfig NENHUM, e o
  fallback de debug atribui um. O arquivo existia sempre, a etapa era pulada, e
  o que saía era uma Release assinada com a `debug.keystore` gerada pelo runner
  **naquela execução** — chave diferente a cada run,
  `INSTALL_FAILED_UPDATE_INCOMPATIBLE` no aparelho, e como única saída
  desinstalar, apagando IndexedDB/OPFS.
- **Cinto e suspensório:** depois do build, o CI pergunta ao `apksigner` QUEM
  assinou o APK que vai ser publicado e falha se encontrar `CN=Android Debug`
  (que é fixo na chave de debug do Android, então o teste é exato e não depende
  de conhecer o CN da keystore de produção).
- **`versionCode` vem da CONTAGEM DE COMMITS** (`git rev-list --count HEAD`),
  mais um deslocamento de 100000 — daí o `fetch-depth: 0` no checkout, senão um
  clone raso devolveria 1. Não vem mais do número da execução: `github.run_number`
  conta por WORKFLOW, e renomear o `apk.yml` reinicia a contagem em 1, o que
  derrubaria o `versionCode` e forçaria desinstalar. O deslocamento existe para o
  primeiro APK desta regra ficar acima do último publicado pela regra antiga —
  se um dia um `versionCode` já publicado chegar perto dele, **aumente** o
  deslocamento, nunca o diminua. O `versionName` vem da tag.
- **Num disparo manual com `release_tag` o checkout usa `main`.** A tag nasce lá
  (`target_commitish: main`), e sem isso o APK podia ser compilado de uma branch
  de trabalho enquanto a tag apontava para `main`: binário publicado ≠ commit da
  tag. Vale a ressalva: `target_commitish` só é usado pela API do GitHub para
  CRIAR a ref quando ela ainda não existe — no fluxo documentado
  (`git tag && git push --tags`) a tag já existe e o campo não faz nada. Quem
  garante a coerência no disparo manual é o `ref: main` do checkout.
- O input **`retag`** (desligado por padrão) apaga a Release e a tag antes de
  recriá-las — é o único jeito de MOVER uma tag já publicada, já que o
  `action-gh-release` não move tag existente. Fica atrás de um input próprio de
  propósito: mover tag é destrutivo e não pode ser efeito colateral de uma
  publicação comum.
- Perder a keystore é irreversível: sem ela, toda atualização futura volta a
  exigir desinstalação. Guarde com backup.

**Backup com regras** (`res/xml/backup_rules.xml` e
`res/xml/data_extraction_rules.xml`). `allowBackup="true"` sozinho leva tudo o
que está no diretório de dados, e duas coisas não podem ir:

- `files/web-ota/` e `shared_prefs/web-ota.xml` são o bundle OTA extraído e o
  ponteiro para ele — **CÓDIGO** que roda no origin privilegiado, com acesso a
  `__AVBridge`. Restaurar um backup adulterado plantaria JavaScript arbitrário
  sem passar por nenhuma das três garantias: não há download, não há conferência
  de `sha256`, e a válvula `minShell` só existe no caminho do download. Nada ali
  precisa sobreviver à troca de aparelho — o APK traz a base web embutida e o
  `check()` seguinte rebaixa o bundle de novo.
- `app_webview/` é IndexedDB/OPFS, a biblioteca do app, que passa facilmente de
  gigabytes.

A diferença entre os dois destinos é deliberada: o backup em **nuvem** tem cota
de 25 MB por app, então com `app_webview` dentro ele não protegia a biblioteca
(não cabe) e ainda arriscava reprovar o backup inteiro; a **transferência direta**
entre aparelhos não tem essa cota, e ali copiar a biblioteca é justamente o que o
operador quer ao trocar de celular. Por isso `app_webview` só sai da nuvem. São
**dois arquivos porque o Android mudou o formato** (o antigo vale da API 26 à 30,
o novo da 31 em diante), não porque as decisões sejam diferentes — qualquer
exclusão nova precisa entrar nos dois.

Rodar local: `./gradlew assembleDebug` (exige Android SDK instalado).

---

## Regras de desenvolvimento

- **SEMPRE fazer merge com `main` ao terminar qualquer alteração.** Trabalhar
  na branch designada é o meio, não o fim: um commit que fica só na branch não
  chega a lugar nenhum — o OTA publica a partir de `main` (o job `web-ota` tem
  `if: github.ref == 'refs/heads/main'`) e as Releases nascem de `main`. O
  fluxo é sempre o mesmo, e a última linha não é opcional:

  ```bash
  git add <arquivos>
  git commit -m "vX.YZ: <descrição>"
  git push -u origin <branch>
  git checkout main
  git merge <branch> --no-ff -m "Merge: <resumo>"
  git push origin main          # ← sem isto, nada chega aos aparelhos
  ```

- **SEMPRE gerar uma Release quando o SHELL mudar.** O merge em `main` só
  entrega a **base web** — o OTA carrega `assets/web/` e mais nada. Tudo o que
  está fora dela (`app/src/main/java/`, `AndroidManifest.xml`, `res/`,
  `build.gradle.kts`, os workflows) **só chega ao aparelho instalando um APK**.
  Sem a Release, a mudança fica publicada no repositório e ausente do celular —
  e o pior caso é silencioso: um método novo da ponte faz o lado web se
  comportar de um jeito no código e de outro no culto, porque lá o
  `SHELL_VERSION` ainda é o antigo.

  Então o fluxo acima ganha uma última linha quando o diff tocou o shell:

  ```bash
  # depois do push em main, com o Actions → "Build APK" → Run workflow,
  # input `release_tag` = a próxima tag (v1.24 → v1.25 → v1.26 …)
  ```

  A tag é criada pelo próprio workflow a partir de `main` (ver "Build"), então
  não é preciso empurrar tag à mão. **Não esperar o operador pedir**: mudou o
  shell, sai Release — e a mensagem que anuncia a mudança precisa dizer que ela
  exige instalar o APK, porque o OTA não vai levá-la.

- **Nunca perder funcionalidades existentes ao refatorar.** A base web tem
  todo o sistema de culto (coleções LouvorJA, letra sincronizada, Bíblia,
  Camada de Texto, playlist, fades) — ver `docs/ARQUITETURA-WEB.md`.
- **Todo código novo em `assets/web/` precisa continuar rodando no navegador.**
  Caminhos nativos entram sempre como `if (!window.__NATIVE__) { …web… }`.
- Não introduzir dependências externas — Kotlin puro + AndroidX oficial no
  shell; JavaScript puro no web. **Três exceções, e as três são declaradas:** a
  IFrame Player API do YouTube (carregada em runtime), o
  **`@aiden0z/pptx-renderer`** (v5.99, em `assets/web/vendor/`, Apache-2.0,
  carregado por `import()` dinâmico só quando alguém importa um `.pptx`), que
  existe porque o Android **não desenha PowerPoint** — a plataforma só traz o
  `PdfRenderer`, as bibliotecas nativas que fazem isso são comerciais ou
  limitadas a três páginas, converter num servidor mandaria o material do culto
  para fora do aparelho, e escrever DrawingML à mão produziria um slide PARECIDO
  com o que o pastor montou, que na frente da congregação é pior que slide
  nenhum (o levantamento inteiro está no `LEIA-ME.md` daquela pasta) — e o
  **`NewPipeExtractor`** (v5.81), que existe porque extrair a URL de um vídeo do
  YouTube significa acompanhar as defesas deles — os PO Tokens de hoje são
  atrelados a cada vídeo e assinados por BotGuard/DroidGuard, e escrever isso à
  mão seria assinar um contrato de manutenção semanal que quebraria sempre num
  domingo. A alternativa sem dependência era um servidor público, e ela FALHOU
  em aparelho: eles rodam em IP de datacenter, que é exatamente o que o YouTube
  bloqueia. E a v1.49 é a prova de que a conta está sendo paga por quem
  publica: o SABR que derrubou o 1080p foi resolvido do lado deles (cliente
  visionOS, v0.26.3) e chegou aqui como **um bump de versão** — daí a regra
  prática de manter o pin explícito e olhar o CHANGELOG antes de reescrever
  extração à mão. Ver `YoutubeGrab.kt`. Uma quarta exceção precisa do mesmo tipo
  de justificativa: um problema que não se resolve de outro jeito, e a conta da
  manutenção paga por quem publica a biblioteca.
  **A quarta exceção é o JUnit** (`testImplementation("junit:junit:4.13.2")`,
  v5.141), e ela é declarada pelo mesmo padrão das outras três: ele **não põe um
  byte no APK**, mas é uma dependência nova e paga por si na primeira vez que
  alguém mexer no limite de cabeçalhos do `EspelhoHttp`. Existe porque o espelho
  acrescenta ~1.600 linhas de Kotlin e ~360 delas são **a primeira fronteira de
  rede do projeto**: um parser HTTP com controle de acesso. Escrever isso sem
  oráculo, no mesmo repositório cujo próprio documento recusa o RFC 6455 **por
  falta de oráculo**, seria o argumento aplicado contra ele mesmo — e um erro
  ali não vira pixel errado, vira controle de acesso quebrado.
- Toda operação IDB multi-passo que precise de atomicidade usa `storeTx()`.
- Ao mudar a superfície da ponte, subir `NativeBridge.SHELL_VERSION` **e**
  atualizar a seção "A ponte" acima.
- **Diagnóstico novo em Kotlin devolve JSON; quem monta a FRASE é o
  `controle.js`.** É o que `otaDiag` e `ytDiag` já fazem, é o que respeita a
  invariante 5, e no espelho é o que mantém a sanitização do texto vindo da rede
  num ponto só. Um arquivo Kotlin que formata parágrafos é UI de diagnóstico
  escrita do lado errado. Corolário do lado web: **toda linha do bloco é
  opcional** — o que o shell não souber responder não aparece, nunca
  "undefined" no meio de um log que vai ser repassado.
- **O diagnóstico é UM só, e mora numa caixa que ROLA** (`#diagBox`, o
  "Registro" de Configurações). Um log em espaço fixo esconde o fim quando o
  texto cresce — e o fim é onde está o desfecho. Diagnóstico novo entra como
  mais um BLOCO ali, nunca como uma faixa nova em outro canto.
- **Todo campo de LOG nasce com um botão de copiar** (o cabeçalho `.log-head`
  com o botão `.log-copy` sobre a caixa `.diag-box` — ver `copiarTexto` em
  `controle.js`). Diagnóstico existe para ser REPASSADO, e
  sem o botão a alternativa é transcrever números à mão ou fotografar a tela —
  que foi exatamente o que aconteceu com a primeira versão do diagnóstico do
  YouTube. A confirmação é o mesmo pulso do resto do app.
- Cor nova entra em `assets/web/shared/tokens.css`, nunca literal na folha do
  app — e nunca branco pleno fora do palco (ver "A paleta").
- Ao atualizar o código, atualizar este `CLAUDE.md` se a mudança afetar
  arquitetura, protocolo de comandos ou a ponte. Mudanças dentro de
  `assets/web/` que afetem a arquitetura web vão em `docs/ARQUITETURA-WEB.md`.

### A versão mora em TRÊS lugares, e os três precisam andar juntos

| Onde | O quê | Para quê |
|---|---|---|
| `assets/web/version.json` | `"version"` | **é o que faz a atualização chegar aos aparelhos**: o OTA compara este campo (`compareVersions`) e ignora, em silêncio, um bundle cuja versão não for maior que a instalada |
| `assets/web/controle/controle.js` | `WEB_VERSION` | **é o que a UI de fato mostra**: `renderVersionLabel()` sobrescreve o span do rodapé de Configurações na carga |
| `assets/web/controle/index.html` | o texto do `<span id="appVersion">` | o que aparece antes do primeiro render — e a única versão visível num shell sem `appVersion()` |

Esquecer o `WEB_VERSION` é o erro silencioso: o OTA distribui o bundle novo, mas
o aparelho exibe a versão ANTIGA — e essa leitura é exatamente o que o indicador
existe para dar, inclusive para quem estiver diagnosticando remotamente se o OTA
chegou. Esquecer o `version.json` é o erro mudo do outro lado: nada chega a
aparelho nenhum.

O `versionCode`/`versionName` do APK vêm do CI (ver "Build") e não se tocam à
mão.

**Versão atual: v5.210** (base web) · `SHELL_VERSION` **40**, e o bundle segue com
`minShell: 2` — ele funciona igual num shell antigo, só sem os recursos que são
nativos por construção (a escada do voltar, os botões de volume, a notificação de
controles), que **só chegam instalando o APK novo**, não pelo OTA.

> **A v5.210 (v1.95): A NOTIFICAÇÃO VESTE O TEMA, e o MODO RELÓGIO deixa de
> perguntar as horas ao aparelho errado. EXIGE APK.** Dois pedidos do operador,
> mais uma verificação que ele encomendou junto e que não achou defeito nenhum.
>
> - **O CARTÃO PASSA A TER A COR DO APP.** Uma notificação sem `setColor` é
>   pintada com o cinza padrão do sistema — que não é nem o claro nem o escuro
>   deste app, e fica visivelmente estranho ao lado da tela de onde veio. Agora
>   os DOIS cartões (o player e o da transmissão) usam o mesmo `--bg` do tema
>   escolhido, lido de `values/colors.xml` pela mesma preferência que pinta o
>   `windowBackground` — **é o quarto consumidor daquela cópia à mão, e não há
>   escapatória**: recurso de Android não enxerga custom property de CSS.
>   `setColorized(true)` é o que faz o sistema usá-la como FUNDO em vez de um
>   respingo no ícone, e ele só é honrado em serviço em primeiro plano ou
>   `MediaStyle` — que é exatamente o caso dos dois. Trocar de tema **repinta na
>   hora** (`SessionService.temaMudou`): sem esse aviso a cor só mudaria no
>   próximo `publish()`, que numa cena parada é daqui a um louvor inteiro.
> - **E ele ganhou uma CAPA, porque não existe capa de verdade.** O acervo é
>   hino, vídeo e imagem de culto: não há arte de álbum em lugar nenhum, e um
>   `MediaStyle` sem `largeIcon` fica com um buraco do tamanho de uma capa que
>   cada versão do Android preenche de um jeito. A capa é o símbolo do ícone do
>   app sobre o fundo escuro, rasterizado uma vez e cacheado (`publish()` roda a
>   cada play/pause e a cada salto de posição). **Ela NÃO segue o tema, e isso é
>   a regra do ícone do app pelo mesmo motivo**: o vetor está pintado nos tokens
>   do tema ESCURO, e sobre o `app_bg_claro` a trilha daria **1,02:1** — o
>   desenho sumiria. Capa é arte, e arte não troca de cor com a moldura; quem
>   segue o tema é o cartão.
> - **O MODO RELÓGIO lia o relógio DE QUEM DESENHA.** Cronômetro e sorteio
>   viajam por DESCRITOR ancorado numa época do celular, e a casca do papel
>   `tela` já a traduz para o referencial da tela (`corrigirRelogio`). O modo
>   relógio não tem época nenhuma na mensagem — ele desenha a hora corrente — e
>   por isso era o único que ficava com o segundo de uma Smart TV, que pode estar
>   minutos fora, na frente da congregação. Agora a casca publica
>   `window.__avAgora` (a mediana das épocas do ping) e só o modo relógio o
>   consulta. **A primeira versão disto aplicou a correção aos três**, e o
>   `tools/tela-rede.test.mjs` a reprovou no ato — *"o cronômetro lê ~0 s, o
>   desvio de 90 s foi ANULADO"* —, porque medir contra a origem um descritor já
>   traduzido corrige duas vezes. O teste estava certo, e o comentário no
>   `display.js` guarda o caso para a próxima leitura.
> - **A vigília foi verificada e está certa nos dois lados**, sem mudança: no app
>   é `FLAG_KEEP_SCREEN_ON` nas duas janelas (a Activity e a `Presentation`), e
>   na tela da rede é o `navigator.wakeLock` da v5.209 com o `<video>` de 2×2
>   como piso para o `http`.

> **A v5.209 (v1.94): AS TELAS MORRIAM DE 60 EM 60 s porque o sinal de vida era
> um TIMER. EXIGE APK.** O Registro do operador entregou o defeito em duas
> linhas — `tela C conectada` às 16:30:56, `tela C desconectada (sem sinal de
> vida ha 60 s)` às 16:31:56 — e o mesmo navegador reentrando como tela A, B, C,
> D ao longo do culto. **Enquanto ele reentra, o comando não chega**: é o "deixa
> de controlar" que o operador vinha relatando.
>
> O `alive` vivia num `setInterval` de 10 s e o servidor derrubava com 60 s de
> silêncio — "seis batidas perdidas é uma tela que foi embora". O raciocínio
> supõe que o timer bate, e **um navegador de TV com a aba em segundo plano
> estrangula timer para ~1 por minuto**. As seis viram uma, que chega na
> fronteira, e o vigia executa uma tela perfeitamente viva. As duas metades:
> **o sinal pega carona no FIO** (byte que chega não é timer — o `read()` do SSE
> resolve porque o servidor escreveu, e o ping dele é de 15 s; o timer fica como
> piso e a volta da aba manda um na hora) e **o teto do servidor vai a 150 s**,
> onde cabem dez pings e uma tela que de fato saiu ainda cai em menos de três
> minutos.
>
> Mais duas da mesma família: a **vigília ganhou a trava de verdade**
> (`navigator.wakeLock` quando o contexto é seguro, re-pedida no
> `visibilitychange` porque a API a solta ao perder o foco — a guarda entra como
> BLOCO, que é a forma que o `tools/contexto-seguro.test.mjs` sabe ler, e ele
> reprovou a primeira versão, que usava retorno antecipado); e
> **`telaReenviarPreferencias` deixou de perguntar a um CACHE**. A guarda era
> `telaAtiva()`, que consulta um estado relido por enquete só quando a folha de
> conexão está à vista — mas quem chega ali é um `display-ready` que veio PELO
> SSE, e se ele chegou a transmissão está no ar. O cache só podia produzir falso
> negativo, e o preço era a tela ficar sem wallpaper, sem fundo de letra e sem
> preenchimento, sem nada que o explicasse.

> **A v5.208: O TRANSPORTE DO MODO AVANÇADO ESTAVA BRANCO NO BRANCO. OTA PURO.**
> Medido: **1,00:1** — `rgb(255,255,255)` sobre `rgb(255,255,255)`. A v5.207
> consertou os segmentados de Configurações (1,14:1) e eu dei o assunto por
> encerrado sem nunca ter TROCADO DE MODO na medição: os botões que o operador
> mais usa num culto (▶, ⏹, ⏮, ⏭, cortina, letra, mudo) ficaram de fora, e eram
> o pior caso do app inteiro — invisíveis, não "fracos".
>
> No tema claro `--bar` é BRANCO, o mesmo valor de `--panel`, e os controles da
> barra pintam `--surface`, que é branco com alfa. Branco a 70% sobre branco é
> branco; no escuro o mesmo par funciona, e é por isso que ninguém tinha visto.
> A correção é do TEMA e não da folha (`:root[data-tema="claro"] .bottombar`
> afunda a superfície): pôr o transporte na lista geral de "afunda" inverteria a
> aparência da peça mais usada do app **no escuro** para resolver um problema que
> só existe no claro. Mais a aresta de `--control-edge`, pelo mesmo raciocínio da
> v5.207. Medido depois: claro 1,00 → 1,25 com aresta visível, escuro inalterado.
>
> **A lição é sobre método:** medir "os botões" sem entrar no modo em que eles
> vivem é medir outra tela. O modo avançado exige `setAppMode('full')` — remover
> a classe `.open` do simplificado deixa a página em branco, e **uma medição que
> não acha nada parece uma medição que passou**.

> **A v5.207: O ALERTA FLUTUANTE ACABA — a resposta nasce onde o toque nasceu.
> OTA PURO.** Três pedidos do operador, e o terceiro é uma regra nova do
> projeto: *"precisamos remover todos [os toasts] e colocar todas as mensagens
> de alerta na própria interface de origem delas. A informação deslocando do
> alvo de foco não é o objetivo."*
>
> **E ele estava descrevendo um toast que o projeto jurava não ter.** O comentário
> do `avisar()` dizia, com todas as letras: *"o que ele NÃO é: o toast de volta.
> Não flutua (mora no fim da área de lista)"*. O CSS dela era `position: fixed;
> top: .5rem; z-index: 400` — uma faixa no TOPO da tela, por cima do que
> estivesse ali, respondendo a toques dados no rodapé de Configurações, numa
> linha do meio da lista ou dentro de uma folha aberta. **Trinta e cinco pontos
> do app falavam por ela.** É a segunda encarnação do mesmo mecanismo (um toast
> já tinha sido removido antes), e é por isso que desta vez a regra ficou com
> ORÁCULO: `tools/smoke.mjs` afirma que nenhuma camada fixa sobrou por cima da
> interface — a régua é estrutural, não de nome, porque o próximo toast pode se
> chamar qualquer coisa.
>
> **Os canais que a substituíram**, todos in-place e a maioria já existente:
> `pulsar` (o botão tocado), **`notaNoItem`** (a LINHA do item, prefixada ao
> subtítulo no mesmo desenho do selo "● No ar" — para tudo que é um fato sobre
> um item: falhou ao projetar, foi para tal lista, veio truncada),
> **`previewBusy().falhar`** (o mesmo cartão que dizia "Baixando…", sobre a
> preview, que é onde a mídia apareceria), **`statusPasta`** (o CONTADOR da
> pasta, que é o número que a sincronização está mudando), **`falarNaVersao`** e
> **`falarNoPacote`** (o rótulo do próprio controle empresta a si mesmo e
> volta), `#castMsg` (a folha de conexão) e `appConfirm` — este último para o
> **único caso sem interface de origem**: um compartilhamento que chega de fora,
> falha inteiro e não deixa item nem lista em que responder. Um diálogo não é
> uma faixa que passa: ele toma o foco e exige um toque.
>
> Saíram junto o `flash()` (no-op havia versões, com três chamadores que
> escreviam frases que ninguém via) e o parâmetro `opts.toast` do download de
> música — ele existia só para CALAR a faixa quando o cartão da preview já
> falava, isto é, era um `if` para escolher entre dois canais para o mesmo fato.
>
> **O REGISTRO PERDEU O VISOR.** A caixa `<pre>` tinha 240px de altura no meio
> de Configurações e empurrava para fora da tela as linhas que o operador de
> fato ajusta — para exibir, em fonte de 0,68rem, um log cujo consumidor é um
> humano A DISTÂNCIA: ele é COPIADO, não lido ali. Ficaram a linha e o botão que
> o copia; o texto vive em `diagTexto`, não num nó do DOM. Medido: a folha
> deixou de rolar nos dois temas, e o `smoke.mjs` trava isso.
>
> **E O TEMA CLARO GANHOU A ARESTA QUE O `tokens.css` já prometia.** Relato:
> "botões com fundo branco no branco". Medido, ele estava certo por um fator
> grande: os segmentados de Configurações (`.fit-opt`, oito deles) davam
> **1,14:1** contra o painel branco. A causa é estrutural — no escuro um
> controle se anuncia por ser MAIS CLARO que a base, e no claro não existe "mais
> claro que branco". O cabeçalho do tema claro já dizia que "é a linha em
> `--line` que anuncia o controle aqui", e **nenhum controle a desenhava**: era
> uma intenção, não uma descrição. Agora `--control-edge` (transparente no
> escuro, `--line` no claro) a torna verdadeira, por `box-shadow: inset` para
> não mover um pixel de layout em tema nenhum, e os afundados subiram de
> .06/.10 para .10/.16.

> **A v5.206 (v1.93): O REGISTRO MENTIA — o consumidor sobreviveu ao produtor,
> e o valor ausente virou resposta. EXIGE APK.** Uma revisão de todo o repositório
> com viés para os três últimos dias (v5.184 → v5.205) achou o rastro que a
> aposentadoria do espelho de pixels (v5.187) deixou para trás: o Kotlin parou de
> PRODUZIR as métricas daquele pipeline e o `controle.js` continuou CONSUMINDO-as.
>
> **O defeito, e por que ele é o pior tipo:** o `EspelhoDiag` publicava `ritmo`
> mesmo sem `amostra()` ter um único chamador — zerado —, e o `blocoEspelho` lê
> `kbps < 40` como "isto é um retângulo preto". Com a transmissão ligada, um
> vídeo tocando e a cortina aberta (um culto normal), o Registro imprimia
> **`ALARME: ISTO É UM RETÂNGULO PRETO`**. O Registro é o ÚNICO artefato deste
> app cujo consumidor é um humano a distância — ele é feito para ser copiado e
> repassado —, e o KDoc daquele mesmo arquivo já dizia, desde que nasceu, que
> "diagnóstico que mente é pior que diagnóstico nenhum". Ele mentia havia
> dezenove versões. Dois irmãos do mesmo lote: `linhasDaTela(undefined)` acusava
> **toda** tela conectada de rodar "bundle antigo", e `modo: "comandos"`
> comparado com `'video'` desenhava **"modo: imagem (JPEG)"** — um modo removido
> na v5.156.
>
> **A regra que fica**, e ela é o que este lote acrescenta ao projeto: *apagar o
> PRODUTOR de uma métrica e deixar o CONSUMIDOR de pé não produz silêncio —
> produz um ZERO, e zero é um valor legítimo que o consumidor interpreta.*
> Remoção de recurso é remoção dos dois lados do fio, no mesmo lote.
>
> **O que saiu, medido:** ~310 linhas de `SondaClipe`/`SondaPathHandler` (o
> instrumento cujo clipe e cuja página foram apagados na v5.187), o anel de
> `ritmo` inteiro e o `fato()` do `EspelhoDiag` — o arquivo caiu de 775 para 140
> linhas —, nove ramos mortos do `blocoEspelho`, o autorrelato de tela
> (`somDaTela`, `linhasDaTela`, `MIRROR_VEREDITO`, `MIRROR_RS`, `MIRROR_NS`,
> ~155 linhas), a rampa de volume da preview do YouTube (resto da mesa de som da
> v5.189, com o comentário que ainda falava dos "três sinks de áudio"),
> `.simple-key-sub` e dois `id` órfãos.
>
> **E o oráculo que faltava:** `tools/registro.test.mjs` monta o Registro com a
> ponte presente e uma resposta de `espelhoDiag` na forma REAL de hoje, e cobra
> as duas metades — nenhuma palavra de recurso aposentado, e o que o operador
> foi buscar presente (endereço, telas, diário). Sem a segunda metade, apagar o
> bloco inteiro passaria. Rodado contra o código anterior, ele reprova em oito
> pontos. Nenhum teste carregava o Registro até aqui, e foi por aí que os três
> defeitos passaram.
>
> **Os registros que contradiziam o código** foram corrigidos no mesmo lote — e
> o mais caro deles era um comentário: o `espelho/tela.js` ainda ARGUMENTAVA a
> favor do `<style>` injetado ("uma folha a mais no `<head>` pesaria nos três
> papéis"), com o parêntese da v5.205 anexado embaixo dizendo que as regras
> tinham saído. Um argumento plausível e errado, pronto para reverter a correção
> que acabara de custar duas versões. Junto: `.simple.locked` (a classe é
> `.sem-tela`), o comentário do `#simpleConn` descrevendo o layout no fluxo que a
> v5.203 içou para o centro, "O ENDEREÇO E O CÓDIGO" (o código saiu na v5.189), o
> KDoc do `mirrorDiag` citando o `EspelhoDisplay.kt` apagado, o do
> `WebViewFactory` justificando a subclasse pela mesa de som, o da CSP
> justificando `blob:`/`data:` pelo cliente de pixels (as diretivas continuam
> necessárias — OPFS e o `POSTER_VAZIO` —, as razões é que eram outras), e o
> `?tela=1` como marcador único do papel `tela` (é a `<meta name="av-tela">`
> desde a v1.92).
>
> **A paleta foi medida, não relida:** 44 dos 50 pares declarados em
> `tokens.css` batem na segunda casa decimal. As seis divergências eram todas de
> fundo com ALFA e tinham uma causa só — **toda medição "sobre o soft" usa o soft
> composto sobre `--bg`**, e isso não estava escrito. Dentro de um cartão o valor
> é outro (`--danger-text` sobre `--danger-soft`: 6,89:1 na página, 5,03:1 no
> cartão; os dois passam AA). A base agora está dita no cabeçalho do arquivo.
>
> **E o texto de UI passou:** nenhuma frase estática acima de 70 caracteres e
> nenhuma repetição no `index.html` — a poda das v5.194→v5.198 fez o serviço. O
> excesso que restava era de COMENTÁRIO, nos blocos mortos acima, descrevendo
> readback, perfil de encoder e `FLAG_NEVER_BLANK` no arquivo mais lido do
> projeto.

> **A v5.205: A CSP BLOQUEAVA O ESTILO DA ENTRADA — o overlay existia, sem
> posição, DEBAIXO do wallpaper. OTA PURO. CONFIRMADO EM APARELHO:** *"funcionou,
> a tela conectou"*. Relato de partida: *"não aparece o botão, cai direto no
> wallpaper"*, no v1.92, com a marca do papel já funcionando.
>
> **O papel sempre esteve certo; quem não aparecia era o overlay.** O
> `espelho/tela.js` montava a entrada e injetava as regras dela num
> `document.createElement('style')`. A página servida às telas da rede leva
> `default-src 'self'` **sem `style-src`** (`EspelhoHttp.CABECALHOS_PAGINA`), e
> um `<style>` criado em runtime exige `'unsafe-inline'`: o navegador anexa o
> elemento e **não aplica nada**. O `#telaEntrada` era criado, recebia
> `display:flex` pelo CSSOM (que a CSP não barra) e virava um bloco sem posição
> no fim do `<body>` — isto é, embaixo da camada fixa do wallpaper. Invisível e
> inclicável.
>
> **É o pior tipo de falha: nada quebra, nada erra alto.** Ela resistiu a duas
> correções que mexiam no lugar errado (a query do papel na v5.204 e a marca do
> servidor no v1.92) porque o sintoma — "cai no wallpaper" — é idêntico ao de um
> `tela.js` que não roda.
>
> **E o CI não tinha como vê-la**, pela mesma razão da v5.204 por outra porta: o
> `tela-rede.test.mjs` servia a página **sem a CSP**, então ali o `<style>`
> valia. Um harness mais permissivo que o servidor de verdade prova o percurso
> num ambiente que não existe. Hoje ele manda a CSP verbatim, e o clique real no
> botão (que já estava no teste) é o que falha quando as regras não são
> aplicadas — reproduzido antes de consertar.
>
> Junto veio o IRMÃO do mesmo defeito, achado na mesma varredura: o
> `shared/stage.js` injetava o CSS do indicador de espera do mesmo jeito, com o
> argumento — bom até a v5.187 — de que "a animação é um `@keyframes` injetado
> uma vez". Nas telas da rede ele era uma `div` vazia: a tela ficava em preto
> durante a espera de um stream sem nada dizendo que o app estava trabalhando,
> que é exatamente o que aquele indicador existe para evitar.
>
> Os dois viraram FOLHA — `espelho/tela.css` e `shared/stage.css` —, servidas do
> próprio origin, sem relaxar a CSP em nada. **A regra que fica: nas telas da
> rede não existe estilo embutido.** `element.style.x = y` (CSSOM) continua
> valendo; `<style>` criado em runtime e atributo `style=` em HTML injetado, não.
>
> E o teste passou a AFIRMAR a garantia que a CSP existe para dar: a IFrame API
> do YouTube é barrada — zero pixel de terceiro numa tela da rede (spec §1) —, em
> vez de essa recusa virar ruído no console.

> **A v5.204 (v1.92): O PAPEL `tela` DEIXA DE DEPENDER DA QUERY — e o teste que
> devia ter pego isso estava mentindo. EXIGE APK.** Relato: *"a tela não está
> conectando na rede"* mais *"no navegador ele pula a tela de ativar tela,
> diretamente para o wallpaper"*. As duas frases são UM desfecho: sem o papel
> `tela`, o `espelho/tela.js` é um no-op de uma guarda — a página abre como um
> `/display/` comum, mostra o wallpaper, não desenha a entrada, não pede token e
> nunca conecta.
>
> O papel vinha de `?tela=1`, e esse marcador chega por um 302 da rota `/`.
> **É uma corrente de elos frágeis**, e basta um ceder: um navegador de TV que
> não preserva a query no redirecionamento, o endereço guardado nos favoritos
> sem ela, alguém digitando `/display/` direto. Lida a fonte inteira, o 302 é
> bem-formado, o endereço publicado é a raiz e o token vencido se recupera
> sozinho — não achei o elo que cede no aparelho do operador, e por isso a
> correção não é consertar um elo: é **não depender da URL**. Quem serve a
> página sabe o que ela é, e este servidor só serve o display
> (`web/controle/` nunca entra em `PREFIXOS_BUNDLE`), então ele injeta
> `<meta name="av-tela">` em toda página que entrega. É `<meta>` e não
> `<script>` porque a CSP daquela resposta é `default-src 'self'` sem
> `'unsafe-inline'` — um script embutido seria bloqueado, e em silêncio.
> Degrada nos dois sentidos: shell antigo não injeta e a query resolve; bundle
> antigo ignora a marca e a query resolve.
>
> **E o `tela-rede.test.mjs` provava o percurso pelo caminho errado.** Ele
> carregava a página com `?tela=1` na mão e o servidor de mentira entregava o
> HTML cru — isto é, testava um caminho que o aparelho pode não receber, e era
> justamente essa divergência entre o servidor falso e o de verdade que deixava
> o defeito passar. Agora o harness INJETA a marca como o servidor real, e o
> percurso inteiro roda **sem query nenhuma**.
>
> **Junto, a instabilidade dele foi consertada** — ela falhava em duas de cada
> três execuções e "passava na segunda tentativa". A corrida era do próprio
> teste: ele esperava o servidor RECEBER o `POST /par` e lia a frase de erro no
> instante seguinte, quando quem a escreve é o cliente, depois da resposta. Com
> `continue-on-error` no CI, um teste assim não é rede de segurança — é ruído
> que ensina a ignorar a cor vermelha. Quatro de quatro depois do conserto.
>
> **O Registro passou a dizer onde o pareamento parou:** cada página entregue e
> cada `POST /par` **aceito ou recusado** viram linha. Até aqui só a tela que
> CONECTAVA deixava rastro, e "a tela não conecta" tinha duas causas
> indistinguíveis — nenhum navegador chegou a pedir, ou pediu e foi recusado —
> que pedem ações opostas do operador.
>
> **E quatro rotas mortas saíram**: o mapa `ESTATICOS` apontava para
> `espelho/index.html`, `cliente.js`, `fmp4.js` e `espelho.css`, os quatro
> apagados na v5.187 com o espelho de pixels. Três só sabiam responder "faltou
> no bundle" e a quarta (`/`) o `when` já interceptava antes.

> **A v5.203: A CORTINA DO MODO FÁCIL VOLTA — e a v5.199 foi um diagnóstico
> errado, não uma mudança de gosto. OTA PURO.** Pedido do operador: *"lembre que
> lhe pedi para voltar a tela de blur do modo simples que bloqueia a tela
> enquanto não fizerem a conexão com uma tela"*.
>
> **Ele já tinha dito isso, e eu li errado.** Duas mensagens antes: *"sobre a
> tela de blur bloqueada, ESSA PARTE NÃO ERA O PROBLEMA — a questão era que ao
> invés de aparecer a seção com opção de conectar TV ou ligar a rede, aparecia
> ainda o botão antigo"*. Isto é: o que ele relatava era o `#simpleCastBtn` da
> v5.192 reaparecendo (a base embutida no APK, servida por um recuo do watchdog
> que não limpava o cache do WebView — a causa real, corrigida na v5.200/v1.91),
> e eu tinha lido "o botão de conectar persiste em bloquear a tela" como se o
> BLOQUEIO fosse a queixa. A v5.199 derrubou a cortina inteira por causa dessa
> leitura, e o "priorizando a conexão" da mensagem seguinte foi lido de novo como
> ordem na tela em vez de bloqueio.
>
> **A lição não é sobre CSS.** Quando o operador descreve um sintoma com o nome
> de um elemento, o nome pode estar errado e o sintoma nunca está: a resposta é
> ir medir o que ele está vendo — foi o que finalmente achou o cache do WebView
> —, não redesenhar em cima do nome. E quando ele diz explicitamente "essa parte
> não era o problema", isso vale mais que qualquer inferência.
>
> Voltaram: `#simpleVeil`, os tokens `--veil`/`--veil-solid` (nos dois temas), o
> içamento de `.simple-actions` para o centro e o `closeHymnSearch()` do
> bloqueio. **Não voltou** a liberação de teste de 5 s: a saída legítima é o
> "Modo avançado" do cabeçalho, que fica por cima da cortina e é visível e
> rotulado — um gesto secreto que destrava a projeção sem dizer que destravou é
> pior que não ter saída nenhuma.
>
> O estado DESTRAVADO é o da v5.202 e não mudou: letra no topo, preview +
> "Buscar música" lado a lado na zona de baixo, teclado por último.
> `tools/boot-nativo.test.mjs` afirma agora as duas metades — com tela a página
> destrava, sem tela a cortina cobre a tela inteira e a busca sai de cena.

> **A v5.202: A CONEXÃO DESCE PARA A ZONA DE BAIXO — o topo é da LETRA, como
> foi pedido. OTA PURO.** A v5.201 pôs a seção de conexão ACIMA da letra, e isso
> contrariava a própria frase que a encomendou: *"deixe ele na zona de baixo
> mesmo, com a parte superior para a letra da música"*. O operador leu a tela,
> viu o cartão ocupando o alto e concluiu que **a atualização não tinha
> chegado** — e o Registro que ele mandou junto provava o contrário (`Web
> v5.201 · Shell v1.91`, "última busca há 11s: nada novo (publicada: v5.201)").
> Fica a lição: quando a tela não bate com o pedido, o primeiro suspeito do
> operador é o canal de entrega, não a decisão de desenho. Uma leitura errada do
> pedido custa a confiança no OTA.
>
> Agora `#simpleConn` mora DENTRO da `.simple-actions`, na célula da preview:
> sem tela a faixa vira uma coluna e sai conexão em cima, busca embaixo, as duas
> com a largura inteira, logo acima do teclado; com tela ela some por inteiro e a
> célula volta a ser a preview. O topo é da letra nos dois casos.
>
> Junto, uma linha do Registro que estava mentindo: o bloco da transmissão se
> intitulava **"Espelho de pixels"**, o recurso que a v5.187 aposentou por
> inteiro. Ele descreve o telão por comandos há catorze versões, e é lido
> justamente quando alguma coisa não conecta — um título que nomeia um recurso
> que não existe mais é a pior linha possível num diagnóstico que vai ser
> repassado. Passou a ser **"Transmissão para navegador"**, o mesmo nome do
> interruptor na folha de conexão.

> **A v5.201: O MODO FÁCIL FICA COM A LETRA EM CIMA E O QUE SE OPERA EMBAIXO.
> OTA PURO.** Pedido do operador, e ele desfaz metade da v5.200: *"pode voltar
> ao design de preview + botão de pesquisar músicas, mas deixe ele na zona de
> baixo mesmo, com a parte superior para a letra da música"*.
>
> A v5.199 fez a faixa de ações virar coluna sem tela, a v5.200 separou o par de
> vez (busca larga embaixo, preview sozinha no alto), e a forma que ficou de pé
> é a EMPARELHADA, embaixo:
>
> - **letra no topo** — é o que se lê durante o louvor, e é o que mais cresce;
> - **preview + "Buscar música" lado a lado, na zona de baixo** — as duas coisas
>   que se OPERAM, a busca a milímetros do ▶ que vem logo depois de escolher;
> - **teclado por último**, como sempre.
>
> **Sem tela conectada a seção de conexão vai para o TOPO, acima da letra** — o
> "priorizando a conexão" que o operador pediu na v5.199, agora sem disputar
> espaço com a faixa de baixo: ali a preview simplesmente some e a grade vira
> uma coluna, com a busca inteira. Com o par de volta na linha, o teto de altura
> de 20vh da v5.200 saiu junto com a razão dele — quem limita a preview é a
> largura da célula outra vez.

> **A v5.200 (v1.91): O "RESQUÍCIO" ERA O CACHE DO WEBVIEW, e ele tem nome e
> endereço. EXIGE APK.** O operador insistiu, e a insistência estava certa: o
> que ele via não era a cortina da v5.199 — era **o botão único de conectar da
> v5.192**, aquele que só abre o Smart View. Ele existe, com esse rótulo, na
> base embutida no **APK v1.90**; e o app serve a embutida sempre que o
> `beginSession` recua (watchdog descartando um bundle, ou APK novo atropelando
> um OTA antigo). Como as URLs da base não mudam de nome entre versões e o
> WebView roda em `LOAD_DEFAULT`, esse recuo montava a página com **metade de
> cada bundle** — e a regra "trocou a base, limpa o cache" já estava escrita
> neste repositório, aplicada em UM dos dois lugares em que a base troca. O
> outro é o lançamento. Detalhes, incluindo por que o defeito se realimenta
> (uma página remendada não confirma o boot, e o bundle seguinte também é
> descartado), na seção do OTA — "Trocar a base servida OBRIGA a limpar o cache
> do WebView".
>
> `SHELL_VERSION` **não sobe**: nenhum método da ponte nasceu, saiu ou mudou de
> assinatura. Mas **sem a Release o operador continua com o defeito**, porque a
> correção é Kotlin.
>
> Junto vieram dois pedidos de tela, os dois OTA:
>
> - **"Buscar música" desceu para entre a letra e o teclado**, largo, nos DOIS
>   estados. Ele nasceu dividindo a faixa do alto com a preview e só apareceu
>   com a largura inteira na v5.199, quando aquela faixa virou uma coluna — foi
>   essa forma que o operador pediu para ficar. E o lugar é o certo: buscar é o
>   começo de OPERAR, então pertence ao teclado, a milímetros do ▶ que vem logo
>   depois de escolher, e não ao alto da tela, junto do que se resolve uma vez
>   por culto. A faixa de cima ficou com uma decisão só (preview × conexão), e a
>   preview ganhou um teto de altura de 20vh: sem o botão ao lado ela tomaria a
>   largura inteira, e 16:9 num aparelho de 430px são ~242px tirados da letra.
> - **A aba do Cronograma virou um RELÓGIO.** A família do TEMPO é o que separa
>   essa lista da playlist em todo o app, mas quem dizia isso era só o
>   `more_time` dos botões "Adicionar ao Cronograma"; a aba respondia com uma
>   agenda — mesma ideia, outro desenho. Agora é o mesmo mostrador, sem o "+",
>   porque a aba é um lugar e não um acréscimo. **SVG inline**, como a aba da
>   Bíblia e pelo mesmo motivo: `schedule` (U+E8B5) não está no subset de
>   `shared/fonts/material-symbols.woff2` (31 codepoints), e codepoint ausente é
>   um retângulo vazio na barra de navegação — a armadilha da v5.184. Auditados
>   os 32 codepoints em uso contra o cmap da fonte: nenhum outro falta.

> **A v5.199: O BLOQUEIO DO MODO FÁCIL SAI — e é ele que o operador chamava de
> "o botão de conectar". OTA PURO.** Relato, pela segunda vez depois de a v5.197
> ter removido o botão único: *"o botão toque para conectar em uma tela ainda
> persiste em existir e ficar bloqueando a tela do modo simples, e ele também
> está causando bugs"*.
>
> **Medido no bundle publicado, o elemento não existia** — nem `#simpleCastBtn`
> nem a frase "Toque para conectar uma tela" aparecem no v5.197 que o aparelho
> estava rodando. **E o operador continuava certo.** O que ele descrevia não era
> o elemento: desde a v5.193 quem ocupa aquele centro é a seção de conexão, e o
> item dominante dela é o botão de espelhar — preenchido em `--accent-fill`, com
> a largura útil da tela, no meio vertical dela, sobre uma cortina embaçada de
> tela inteira. Mesma anatomia, mesmo lugar, mesmo efeito. **Trocar um botão
> grande centrado por outro botão grande centrado não é remover o botão**, e a
> lição é que o que incomodava nunca foi o ELEMENTO: era a tela inteira parar por
> causa dele.
>
> O argumento do bloqueio ("sem tela este modo é inútil") vale para PROJETAR e
> não para o resto — procurar um hino, montar a lista e conferir a letra são
> exatamente o que se faz **antes** de a tela existir, na terça-feira. Agora a
> faixa de ações só muda de EIXO: com tela é a grade de duas colunas de sempre
> (preview + buscar); sem tela vira uma coluna — conexão em cima, busca embaixo —
> no fluxo, no alto, sem cobrir a letra nem o transporte. O preço está dito em
> vez de escondido: sem nada conectado o ▶ não produz imagem em lugar nenhum (nem
> som, desde que a mesa saiu na v5.189), e quem responde a isso é a seção de
> conexão, que é a primeira coisa que se lê na tela.
>
> **Saíram junto**: a cortina `#simpleVeil`, os tokens `--veil`/`--veil-solid`
> (ela era o único consumidor que eles já tiveram) e a **liberação de teste de
> 5 s** — cujo alvo mudou duas vezes em cinco versões (o botão único, a cortina,
> nada) e cujo único trabalho era derrotar o bloqueio. Porta sem parede não é
> porta.
>
> **E a "busca profunda" achou os dois defeitos que o relato prometia**, os dois
> da mesma família — um dono a menos:
>
> - **A ENQUETE DE 2,5 s DO ESPELHO TINHA DOIS ACIONADORES E UM SÓ INTERRUPTOR.**
>   Ela nasceu como enquete da FOLHA (`abrirCast` liga, `fecharCast` mata), e a
>   v5.193 deu ao bloco uma segunda casa sem lhe dar um dono novo. As duas
>   metades erradas: `hostCastConn` a acendia e **nunca** a apagava (uma tela
>   entrando devolvia o bloco à folha e deixava a enquete batendo na ponte pelo
>   resto da sessão), e `fecharCast` a apagava **mesmo quando quem a acendeu foi
>   a TELA** — isto é, abrir e fechar a folha uma vez cegava o Modo Fácil
>   justamente para o evento que ele espera, uma tela da rede entrando. Agora o
>   dono é um só e é a VISIBILIDADE do bloco (`acertarEnqueteDaConexao`), que é a
>   mesma pergunta que o `renderCast` já faz para decidir se vale desenhar.
> - **`lastDisplays` e `reconferirTelas` SUBIRAM PARA O TOPO** — a família da
>   zona morta temporal, pela quinta vez. Não explodiu, e é esse o ponto: os dois
>   são lidos por TRÊS caminhos de render (`telaoConectado`, `simpleDisplay`,
>   `renderCastBtn`) e eram declarados 14 mil linhas abaixo; só não quebravam
>   porque o `setAppMode(appMode)` que os alcança na carga fica DEPOIS deles no
>   arquivo. A corretude dependia da ordem relativa de duas linhas separadas por
>   14 mil — que é exatamente a dependência que derrubou o app nas v5.184, v5.193
>   e v5.195.
>
> `tools/boot-nativo.test.mjs` passou a afirmar o que o operador relatou, e não
> uma classe CSS: **não há cortina no documento e a busca continua desenhada e
> clicável sem tela nenhuma.**

> **A v5.198: O INTERRUPTOR DA REDE PASSA A NOMEAR O DESTINO. OTA PURO.**
> "Transmitir pela rede" descrevia o MEIO — por onde a coisa viaja —, e meio
> nenhum ajuda a escolher. A opção de cima diz para onde vai ("Espelhar para
> TV") e por isso se lê de primeira; esta ficava sem par, e o operador tinha de
> deduzir o destino de "rede".
>
> Agora é **"Transmitir para navegador"**, e a palavra é a certa por ser
> literalmente o requisito da outra ponta: um computador, um notebook, um tablet
> ou a própria TV servem, desde que abram o endereço. É também a palavra que o
> rótulo do endereço logo abaixo já usa ("Acesse este endereço no navegador"),
> então as duas linhas passaram a completar uma à outra em vez de cada uma
> nomear a coisa de um jeito.

> **A v5.197: O BOTÃO ÚNICO DE CONECTAR SAI — e ele estava MORTO havia quatro
> versões. OTA PURO.** O operador viu resquícios dele no Modo Fácil; medido, o
> resquício era o botão inteiro.
>
> Ele estava escondido por **DOIS caminhos ao mesmo tempo**, e é por isso que
> ninguém notou: `.simple:not(.locked) #simpleCastBtn { display: none }` (com
> tela, quem ocupa a célula é a preview — v5.75) e
> `.simple.locked #simpleCastBtn { display: none }` (sem tela, quem ocupa a tela
> é a seção de conexão inteira — v5.193). Duas regras que juntas cobrem TODOS os
> estados são um elemento que nunca aparece; e o CSS de um elemento que nunca
> aparece não tem como ser notado errado.
>
> Ainda assim ele carregava rótulo, subtítulo, ícone, `title`, ~25 linhas de CSS
> de destaque, três `getElementById` e metade do `renderSimpleCast` — que existia
> para pintá-lo e ficou com três linhas depois de ele sair. **A regra que isto
> ensina é sobre a forma de esconder**: `display: none` por estado é acumulável,
> e dois deles não somam "escondido às vezes", somam "não existe".
>
> **E a barra de progresso do gesto de 5 s foi junto — descobrindo que ela nunca
> tinha chegado ao novo dono.** A liberação de teste mudou de alvo na v5.193 (do
> botão para a cortina) e a animação ficou para trás: eram **cinco segundos de
> nada**, indistinguíveis de um toque que não pegou. Agora ela corre no TOPO da
> cortina — embaixo ficaria atrás do teclado de transporte, que é o que a
> cortina cobre.

> **A v5.196: A FOLHA DE "AJUSTES AVANÇADOS" SAI INTEIRA. OTA PURO.**
> Pedido do operador: *"nada ali é realmente útil, exceto pelo botão de
> desconectar tela"*. Ele tinha razão sobre a folha e estava enganado sobre o
> botão — e a diferença importa, porque é ela que decide onde o desconectar vai
> parar.
>
> **O botão daquela folha era "Ligar/Desligar o espelho": a TRANSMISSÃO PELA
> REDE, não o espelhamento para a TV.** E ele já era o mesmo estado do
> interruptor "Transmitir pela rede", a dois centímetros dali, na folha de onde
> aquela era aberta. Dois controles para um estado é a forma mais direta de eles
> discordarem — some com a folha e o problema some junto.
>
> Foram três coisas, e nenhuma sobreviveu à pergunta "isto muda o que o operador
> faz?": o parágrafo de ressalvas (já reduzido a uma linha na v5.194, e a linha
> mora na folha de conexão), o botão duplicado, e o **certificado TLS**. Este
> último é a única perda real e está dita: ele exige do operador um subdomínio
> com wildcard por DNS-01, uma entrada estática de DNS no roteador da igreja e
> renovação automática — três coisas que o app não adivinha e que ninguém aqui
> montou. **Os três métodos da ponte continuam no shell**, então voltar atrás é
> desenhar uma folha, não publicar uma Release.
>
> **E o desconectar foi para onde ele de fato pertence, em dois lugares
> diferentes**, porque são duas coisas diferentes:
>
> - **tela da rede** → continua na lista de quem está vendo, com o botão
>   "Desconectar" por linha, na folha de conexão;
> - **TV** → o app NÃO TEM COMO derrubar um espelhamento (não existe API
>   pública), e quem desconecta é o seletor do Android. O botão de espelhar leva
>   exatamente para lá nos dois estados; o que mudou é ele **dizer qual TV está
>   no ar** ("Espelhando em TV do templo", em verde de conectado). O rótulo NÃO
>   vira "Desconectar" de propósito: um botão com esse nome que abre uma lista
>   seria uma promessa que a tela seguinte não cumpre.
>
> **Uma armadilha do caminho, dita porque é da mesma família das outras:** o
> bloco de ouvintes da seção de conexão era guardado por `if (mirrorOpenBtnEl)`
> — o link "Ajustes avançados". Apagá-lo sem trocar a guarda desligaria em
> silêncio tudo o que está dentro dela, **inclusive o interruptor da
> transmissão**. A guarda passou a ser o botão de espelhar, que existe sempre.

> **A v5.195: O PENTE NO RESTO DO APP — e a TELA PRETA que ele causou, com o
> oráculo que faltava. OTA PURO.**
>
> **Primeiro o defeito, porque ele é a parte que importa.** O app passou a abrir
> em PRETO, e o relato do operador descreve a sequência inteira: tela preta →
> na segunda abertura o Modo Fácil só com "Espelhar para TV" → na terceira, o
> botão grande antigo de volta. Três sintomas, uma causa: `MIRROR_POLL_MS` e
> `MIRROR_SHELL` são lidos na CARGA do módulo (pelo `hostCastConn` da v5.193,
> alcançado pelo `setAppMode` do fim do arquivo) e nasciam 14 mil linhas abaixo
> — zona morta temporal, `ReferenceError`, `controle.js` abortado. O terceiro
> sintoma é o watchdog do OTA funcionando exatamente como projetado: sem
> confirmação de boot, ele descarta o bundle e o lançamento seguinte serve o
> EMBUTIDO NO APK, que é a versão anterior.
>
> **É a terceira vez que esta armadilha morde** (`mirrorEstado` na v5.184,
> `mirrorOcupado`/`mirrorTimer` na v5.193) e a primeira em que o CI não tinha
> como vê-la: a leitura mora dentro de `if (espelhoDisponivel())`, que é FALSO
> num navegador. **O `smoke.mjs` passava verde porque nunca executava a linha.**
>
> **Daí o `tools/boot-nativo.test.mjs`**, e ele é a peça que faltava neste
> repositório desde sempre: sobe a base web com um `__AVBridge` DE MENTIRA
> injetado antes da carga, e pergunta a MESMA coisa que o watchdog do OTA
> pergunta (`otaAppIsUp`) — o app ficou de pé? Todo caminho guardado por
> `window.__NATIVE__` — que é dizer: todo caminho que só roda no aparelho, onde
> não há console para olhar — passou a ter execução em CI. Ele achou o segundo
> TDZ (`MIRROR_SHELL`) na primeira execução, e o stub tem uma fidelidade que
> precisa estar dita: o Kotlin resolve `__avResolve(id, VALOR)` com objeto já
> pronto, não com string — passar `'[]'` faria `lastDisplays[0]` ser o
> caractere `'['`, verdadeiro, e o app acharia que há um telão conectado.
>
> Junto veio uma correção do mesmo lote: o guard do `renderCast` usava
> `offsetParent === null` para saber se o bloco estava aparecendo, e
> `.popup-backdrop` esconde por **opacidade**, não por `display` — a guarda
> nunca barrou nada. Perguntar por ESTADO (`.open` / `hidden`) funciona nas duas
> casas do bloco.
>
> **E o pente propriamente dito**, com a régua que a v5.194 estabeleceu — cai o
> que repete o rótulo, fica o que diz uma consequência que o rótulo não implica:
>
> - **Os três destinos perderam o subtítulo.** Playlist, Cronograma e Favoritos
>   são NOMES DE ABA deste app; escrever embaixo de cada um o que ele é ("A
>   lista do culto") é explicar a própria navegação para quem já está navegando
>   nela — e era metade da altura da folha.
> - **"Tocar agora" MANTEVE o dele**, e é o contraste que mostra a régua: ele é
>   o único que não guarda nada, e isso o rótulo não diz ("Sem entrar em lista
>   nenhuma"). No caminho de só-áudio o que ele não diz é outra coisa ("Sem
>   mexer no telão").
> - **"Instrumental, sem a voz"** saiu: playback é o termo que o app usa em toda
>   parte, inclusive no seletor Cantada/Playback, que nunca teve explicação.
> - **"Sem música e sem passagem automática de slides"** virou "Os slides não
>   passam sozinhos" — a primeira metade repetia "Apenas a letra".
> - **A linha de confirmação parou de listar os destinos escolhidos**: eles são
>   as caixas marcadas, visíveis a três linhas dali. O contador responde
>   "quantos?" sem repetir "quais?".
> - **O cartão de conectar do Modo Fácil ficou só com o estado.** Ele tinha três
>   frases de instrução ("Toque para escolher a tela") que repetiam o rótulo e o
>   ícone ao lado — e, desde a v5.193, ele só existe COM tela conectada.
> - **"Hinários e álbuns"** saiu do cartão de buscar: não há segunda busca neste
>   modo para escolher entre elas.

> **A v5.194: A FOLHA DE CONECTAR PERDE TRÊS QUARTOS DO TEXTO. OTA PURO.**
> Relato do operador: "extremamente poluído e repetido e pouco claro".
>
> Contado, ele estava certo por um fator de quatro. Para DUAS decisões
> (espelhar para a TV × transmitir pela rede) a tela trazia: um subtítulo
> explicando o que é espelhamento, outro explicando o que é a transmissão, uma
> frase mandando abrir o endereço no navegador, uma mensagem de sucesso
> mandando a mesma coisa, e — atrás de "Ajustes avançados" — dois parágrafos
> dizendo tudo pela quarta vez. **Cinco formas de dizer "abra o endereço no
> navegador".**
>
> - **Os subtítulos saíram.** Eles descreviam o recurso para quem já tinha
>   decidido usá-lo: ninguém abre "Conectar uma tela" para aprender o que é
>   Smart View. O do interruptor era pior — ligado, ele dizia "N tela(s)
>   recebendo", que é exatamente o que a LISTA logo abaixo mostra, com nome e
>   tempo de cada uma.
> - **A instrução virou o RÓTULO do endereço** ("Acesse este endereço no
>   navegador"). Era uma linha separada abaixo dele, em duas versões que
>   trocavam as palavras de lugar conforme houvesse ou não uma tela conectada. O
>   "toque em Ativar esta tela" saiu junto: quem precisa dessa instrução está NA
>   OUTRA TELA, e lá ela está escrita no botão — que é onde ela serve.
> - **"Abre: Smart View" saiu do botão de espelhar.** Ninguém escolhe entre dois
>   caminhos pelo NOME do seletor que vai abrir; quando o botão abre a tela
>   errada, a resposta está no Registro, que é o que se copia para diagnosticar.
>   O dado continua lá.
> - **Os dois parágrafos dos ajustes viraram uma frase** — e eles ainda mandavam
>   **digitar o código de três dígitos**, que saiu na v5.189. Texto grande é
>   também texto que ninguém revisa. Ficou o que o operador não tem como
>   adivinhar e que muda o que ele faz: o roteador pode bloquear isto sozinho, e
>   há duas coisas que de propósito não vão para a rede.
> - **O sucesso deixou de ter frase.** O endereço aparecendo, com o rótulo que
>   diz o que fazer com ele, É o "deu certo". A falha continua falando, porque
>   ali não há nada que apareça sozinho.

> **A v5.193: CINCO AJUSTES DE USO, e um deles é a QUARTA correção do mesmo
> mecanismo. OTA PURO** (nenhuma linha de Kotlin; sem Release).
>
> - **O carrossel de abas parou de ignorar a navegação interna.** A guarda mais
>   larga que ele tinha era "qualquer SUB-TELA" (botão voltar visível), sob o
>   argumento de que ali o eixo horizontal pertence à navegação de dentro.
>   Medido, o argumento é falso: com um capítulo da Bíblia aberto — o estado
>   normal de quem usa a Bíblia num culto — NADA disputa o eixo horizontal
>   (`.bible-half` rola só na vertical, e a folha declara `touch-action: pan-y`
>   nela desde a v5.188). Pior, a própria `.bible-half` estava na lista de
>   exclusão, proibindo um gesto que ela libera. Esta é a quarta correção deste
>   mecanismo, e as três anteriores erraram do mesmo jeito: **mantendo à mão a
>   lista do que o eixo não pode atravessar**. Agora a pergunta é medida — entre
>   o alvo e a superfície que escuta, existe alguém que de fato ROLE na
>   horizontal (`scrollWidth`, `overflow-x`)? Um trilho cheio responde sim; o
>   mesmo trilho com três pílulas responde não, e nos dois casos a resposta é a
>   verdadeira em vez da que alguém digitou meses atrás. `tools/smoke.mjs` trava
>   as duas metades com toque de verdade (CDP) — e o contra-teste só vale porque
>   o positivo passa: sem `hasTouch` no contexto, o toque não chega e os dois
>   casos "passariam" por não medir nada.
> - **Quem está conectado saiu de Configurações.** O rodapé daquela folha dizia
>   "Telão conectado: X" e "Espelhar abre: Y" — as duas coisas que a folha de
>   "Conectar uma tela" já diz, no lugar em que se decide sobre elas e só quando
>   há o que dizer. Estado repetido em duas telas é a mesma classe de
>   divergência que a paleta única existe para não ter. O Registro continua com
>   as duas linhas, agora lidas de DADO e não do DOM: um diagnóstico que depende
>   de um elemento de UI existir emudece no dia em que alguém o esconde.
> - **O Modo Fácil sem tela mostra a SEÇÃO DE CONEXÃO, não um botão que a
>   abre.** Havia ali um botão do tamanho da tela cujo único efeito era abrir a
>   folha — um toque cobrado para chegar às duas escolhas que cabem na própria
>   tela bloqueada. O bloco é o MESMO nó, movido entre a folha e a tela
>   (`hostCastConn`, o padrão do `hostPreview`), porque duas marcações para a
>   mesma decisão divergem no primeiro ajuste. Junto vieram duas correções que
>   o pedido do operador expôs: **o bloqueio passou a contar as telas da REDE**
>   (desde a v5.187, sem TV elas SÃO a projeção — o bloqueio não tinha
>   acompanhado, e quem ligava a transmissão continuava atrás da cortina), e a
>   folha **fecha sozinha quando alguma tela conecta**, por qualquer um dos dois
>   caminhos. A liberação de teste de 5 s mudou de dono: ela vivia no botão que
>   deixou de existir no estado bloqueado, isto é, sumia justamente de onde
>   servia — agora é o toque longo na própria cortina.
> - **O Modo Fácil não faz manutenção de álbum.** Peso, "Completo offline",
>   "Verificar atualizações" e "Remover do dispositivo" respondem perguntas de
>   quem ADMINISTRA o acervo; quem está no Modo Fácil procura um louvor para
>   tocar agora. Some a INFORMAÇÃO e fica a AÇÃO — o botão de baixar (que
>   durante um download é o CANCELAR) permanece. Por CSS, não por um ramo no
>   construtor do card: a classe mora no `<body>` e o operador troca de modo com
>   a lista já montada.
> - **A entrada da tela da rede veste o app.** Ela nasceu na v5.189 como um
>   botão de estilo inline com fallbacks escritos à mão — inclusive um
>   `var(--accent-fill, #8a6d1d)` cujo valor de emergência é o âmbar que a
>   v5.192 aposentou (invisível, porque o token resolvia). Mas o problema maior
>   era o que a tela É: a PRIMEIRA coisa que alguém vê num televisor da igreja,
>   e ela mostrava um botão solto num retângulo escuro sem dizer de que sistema
>   era. Agora veste o wallpaper do telão (o símbolo oficial, fonte única), diz
>   o nome do sistema e o que o toque faz, e usa a anatomia dos botões
>   principais do app.
>
> **E uma armadilha que mordeu de novo, com a resposta já escrita no arquivo:**
> o bloco de conexão ganhar uma segunda casa fez o `setAppMode` do fim do
> `controle.js` — que roda durante a carga do módulo — alcançar o `renderCast`,
> que lê `mirrorOcupado`, declarado 14 mil linhas abaixo. Zona morta temporal,
> `ReferenceError` na carga, página inteira morta. O comentário do `mirrorEstado`
> já contava essa história uma vez (v5.184) e o `smoke.mjs` a pegou nas duas.
> A regra fica: **estado lido por qualquer caminho de render nasce no topo**,
> junto do resto do estado de cena.

> **A v5.192 (v1.89): A PALETA VIRA A IDENTIDADE OFICIAL DA IASD, E O APP GANHA
> TEMA CLARO. METADE OTA, METADE APK.** Pedido do operador: um tema claro e um
> escuro trocáveis em Configurações, padronizados pelas cores oficiais da
> identidade visual adventista — a mesma fonte de que saiu o símbolo do
> wallpaper na v5.188.
>
> - **O âmbar sai, e ele nunca foi oficial.** A v5.47 o adotou como "a marca
>   IASD" por um argumento de CONTRASTE: a paleta azul anterior usava UM valor
>   para os dois papéis (fundo preenchido e texto), e é esse par que reprovava —
>   não o azul. A saída certa era separar os papéis, que é o que
>   `--accent`/`--accent-fill`/`--on-accent` já fazem. Com eles no lugar, o
>   **denim `#2F557F`** (PMS 302, o núcleo da identidade) entra como
>   preenchimento verbatim, com 7,70:1 contra o branco que a própria identidade
>   recomenda por cima, e o `bluejay` clareado vira o accent de texto do tema
>   escuro (5,86:1 sobre o painel). `scarlett` é o vermelho de atenção,
>   `campfire` o aviso, `treefrog` o concluído, `night`/`winter` os neutros.
> - **Nem todo token é oficial, e os derivados estão marcados.** Os dezoito
>   valores foram desenhados para fundo BRANCO — todos passam AA sobre branco, e
>   NENHUM passa como texto sobre o quase-preto do tema escuro. Onde clarear (ou
>   escurecer, no claro) foi preciso, `tokens.css` diz de qual oficial o valor
>   saiu e preserva a matiz. Nos ladrilhos da Bíblia a conta é estrutural: a
>   identidade tem SETE famílias de matiz e a tela de livros precisa de DEZ
>   grupos separados por ≥20°, então cinco são oficiais e cinco preenchem os
>   vãos — e o `scarlett` fica FORA da escala de propósito, porque vermelho é
>   atenção neste app e um grupo de livros vermelho competiria com "está no ar".
> - **O PALCO NÃO TEM TEMA, e é isso que faz o recurso valer.** `--stage-*`,
>   `--wallpaper`, `--lyrics-frame-bg` e as sombras foram para um bloco
>   compartilhado. O Display já ficaria escuro por omissão (ele nunca escreve o
>   atributo); o que a separação garante é a PREVIEW do Controle, que roda no
>   documento que TEM tema e existe para ESPELHAR o telão. Um telão claro cega a
>   congregação, e uma preview clara deixaria de cumprir seu papel exatamente no
>   tema em que o operador mais precisa dela.
> - **O que o shell faz, e é só isto** (`temaClaro`, `SHELL_VERSION` **39**):
>   os ÍCONES das barras de sistema e o `windowBackground`. As duas coisas que
>   uma folha de estilo não alcança — com `targetSdk` 35 o Android ignora as
>   CORES das barras (quem as pinta é o body, com o token), mas o relógio e os
>   botões de navegação continuam sendo desenhados pelo sistema e ficariam
>   brancos sobre branco; e o `windowBackground` é um recurso do APK, resolvido
>   antes de existir JavaScript, então o shell guarda uma cópia da escolha e a
>   aplica no lançamento seguinte. **Trocar de tema tem, portanto, um lançamento
>   de atraso no fundo do splash — e só nele.** Num shell 38 o bundle novo
>   funciona por inteiro e o app fica com as barras do escuro: é a degradação
>   certa, e por isso `minShell` continua em 2.
> - **E a v1.90 conserta o que a v1.89 derrubou: o app não abria.**
>   `window.insetsController` é, no `PhoneWindow`, um
>   `mDecor.getWindowInsetsController()` **sem verificação de nulo**, e o
>   `mDecor` só nasce no `installDecor()` — isto é, no `setContentView()`. O
>   tipo devolvido é anulável, então o `?.` do Kotlin dá a impressão de que a
>   chamada é segura; ela não é, porque **quem lança é o RECEPTOR, não o
>   retorno**. Chamada de um `onCreate` antes do `setContentView`, ela era uma
>   `NullPointerException` em todo lançamento, com qualquer tema. Três coisas
>   fecham o caso: a leitura da preferência e o `setTheme` passaram para ANTES
>   do `super.onCreate` (é o único momento em que `setTheme` ainda pinta o
>   `windowBackground`, e agora existe um `Theme.AvIasd.Claro` para ele
>   apontar), o resto foi para DEPOIS do `setContentView`, e o
>   `aplicarCromoDoTema` ganhou a guarda exata — `window.peekDecorView()`, que
>   pergunta se a decor view existe sem CRIÁ-la, ao contrário do `decorView`.
>   A lição para o próximo: **o CI compila e roda JUnit, não a Activity** — um
>   erro de ciclo de vida atravessa build verde, teste verde e Release, e só
>   aparece no aparelho.
> - **Dois oráculos ficaram mais fortes.** `tools/tokens.test.mjs` passou a
>   ignorar COMENTÁRIOS (um `var(--x)` citado na prosa que justifica a regra não
>   é um uso) e ganhou um caso novo: **nenhum token pode existir só no tema
>   claro**. O claro é um DELTA sobre o escuro, e um token declarado só lá não
>   estaria definido no tema padrão — o `var()` computaria para o valor inicial
>   da propriedade, sem aviso, e quem escreveu acabaria de ver a cor certa na
>   tela porque estava com o claro ligado. `tools/smoke.mjs` trava o efeito
>   RENDERIZADO: os dois temas mudam fundo e texto, o palco não muda uma
>   vírgula, a superfície afunda dentro do cartão NOS DOIS, e a escolha
>   sobrevive à recarga.

> **A v5.191: O DOWNLOAD PASSA A TER SAÍDA — e a intenção deixa de ressuscitar.
> OTA PURO.** Dois relatos do operador, e o segundo é o mais caro.
>
> - **"A notificação sobre o preview não tem forma de cancelar."** Verdade, e
>   pior do que parecia: dos TRÊS lugares que mostram um download em curso, só
>   a linha do resultado da busca sabia cancelar (v5.131) — e ela é justamente
>   a que some quando o operador fecha a busca. O cartão sobre a preview e a
>   linha provisória do Cronograma mostravam minutos de download sem oferecer
>   saída nenhuma. Agora os dois têm botão, alimentados pela MESMA alça
>   (`cancelarDownload`, um núcleo só para os três pontos de toque).
> - **"Mesmo depois de fechar o app, e o vídeo já não indo para o player, ele
>   fica sempre querendo baixar."** Era o resgate de intenção da v5.133 comendo
>   a própria cauda: o `ytArquivo` REGISTRA a intenção ao começar, então cada
>   resgate interrompido registrava outra, e o ciclo se repetia por seis horas.
>   Três regras o fecham, e são a mesma do coletor de lixo do banco — **o que
>   não está em lugar nenhum não é guardado**, aqui nem baixado: intenção sem
>   destino VISÍVEL (`imports`/`playlist`/`favs` — a prateleira `avulsos` do
>   "Tocar agora" não conta) é descartada e o download é CANCELADO no aparelho;
>   há um teto de duas reclamações por intenção; e o cancelamento manual
>   esquece a intenção, sem o que "parei o download" durava até o operador
>   fechar o app.
> - **E o resgate deixou de ser invisível**: ele nascia com `aviso: 'nenhum'`,
>   isto é, dez minutos de download sem nada na tela e sem nada para tocar.
>   Agora ele desenha a linha provisória na lista de destino — que é onde o
>   botão de cancelar mora.

> **A v5.190 (v1.88): UM CARTÃO SÓ NA GAVETA — a transmissão passa a viajar no
> serviço da sessão de mídia. EXIGE APK, e é Kotlin puro.**
>
> Pergunta do operador: *"essa notificação pode ser mais útil com mais
> ferramentas e botões? ou melhor ainda, fixar essa atividade à notificação de
> player que já acontece durante uma reprodução?"* — e a resposta é sim, com um
> ajuste de escopo que vale registrar.
>
> - **O que NÃO dava para fazer: mais botões.** O `MediaStyle` mostra 3 no modo
>   compacto e até 5 no expandido, e o cartão já tinha exatamente 5 (⏮,
>   play/pause, ⏭, Parar, cortina). Desde o Android 13 quem os desenha é o
>   `PlaybackState`, não a notificação — a cicatriz da v1.18. Acrescentar ali é
>   TROCAR, não somar.
> - **O que dava, e é o pedido de verdade: um cartão só.** Num culto com
>   transmissão ligada e mídia no ar a gaveta mostrava DOIS cartões do mesmo
>   app — o player e o "Espelho no ar" —, e só um servia para alguma coisa. O
>   `EspelhoService` deixou de existir: o `SessionService` virou o ÚNICO serviço
>   em primeiro plano do culto, com o tipo `mediaPlayback|connectedDevice`
>   (nenhum dos dois tem cota) e **duas razões independentes de viver** — cena
>   no ar e transmissão ligada —, parando só quando as duas caem.
> - **O cartão tem DUAS CARAS.** Com cena, o player de sempre. Sem cena e com a
>   transmissão no ar, o endereço, quantas telas estão recebendo e o botão
>   **Desligar transmissão** — que só aparece aí, e de propósito: ao lado do
>   transporte, no escuro, ele seria um toque errado derrubando a projeção da
>   igreja inteira. Sem cena não há transporte a mostrar, e sobra o espaço
>   exato para ele.
> - **A regra que isto desafia continua valendo, agora por escrito.** O KDoc do
>   serviço antigo dizia "empilhar dono é o caminho para o cartão eterno", e
>   estava certo: a fusão só é legítima porque a condição de parada virou um
>   `if` explícito num lugar só (`pararSeNadaVivo`), com o `running`, o
>   `foregrounded` e o `stopSelf(startId)` intactos. E sem cena a sessão de
>   mídia é ZERADA (`STATE_NONE`), senão o sistema promoveria um player
>   fantasma ao painel das configurações rápidas.
> - **`EspelhoEnergia`** é o que sobrou do serviço: wake lock, Wi-Fi lock e
>   térmica — as três coisas que nunca foram sobre notificação. Os canais
>   `espelho`/`espelho2` são apagados na subida, para não ficar um interruptor
>   órfão nas configurações de notificação do app.
>
> `SHELL_VERSION` **não sobe**: nenhum método da ponte nasceu, saiu ou mudou de
> assinatura, e o `espelhoDiag` mantém a mesma FORMA (o campo `servico` passou a
> responder "o serviço que carrega a proteção está de pé?", que é o que ele já
> queria dizer). A base web não mudou uma linha — a versão sobe junto só para o
> rodapé de Configurações não mentir sobre o que está instalado.

> **A v5.189 (v1.87): A SEGUNDA RODADA EM APARELHO — a porta abre, o YouTube
> volta a transmitir e a preview emudece. EXIGE APK.**
>
> - **"Tocar direto um link do YouTube não funciona, ele sempre baixa."** Era
>   a política que a própria v5.187 escreveu: `pularTransmissao = espelho
>   ligado && sem telão` — e transmissão ligada sem TV é o estado NORMAL do
>   operador, então o recurso inteiro parou de acontecer. O motivo era real (o
>   manifesto aponta para `/stream/` no origin do WebView, que a tela da rede
>   não alcança), e a saída não foi relaxar a guarda: foi **tirar-lhe a razão
>   de existir** fechando a dívida §7 do contrato. O servidor passou a servir
>   as mesmas faixas em **`/s/<token>`** — um REPASSE ao googlevideo (o
>   `Range` do cliente sobe cru, a resposta é espelhada de volta), com o UA que
>   combina com a URL, o mesmo registro de token do `StreamProxy` e nenhuma
>   segunda extração. O `telaEnriquecer` reescreve o manifesto para a tela.
> - **A ENTRADA DA TELA PERDEU O CÓDIGO.** Argumento do operador: cada tela
>   precisa do ENDEREÇO deste aparelho nesta rede para chegar aqui, e esse
>   endereço já é a credencial — quem não configurou a tela não o tem. O
>   overlay virou **um botão só, "Ativar esta tela"**, que gasta o gesto
>   (tela cheia + som) e entra. O que segura o recurso continua sendo o teto de
>   três sessões e o "Desconectar" do operador (com o castigo de 2 min, sem o
>   qual o botão não faria nada visível). Saíram do `EspelhoPares`: o código,
>   a rotação, o bloqueio crescente e o contador de recusas — e com eles os
>   casos de JUnit que os cobriam, porque o que eles cobriam deixou de existir.
> - **A TELA VOLTA A FICAR EM TELA CHEIA SEM RECARREGAR.** Sair da tela cheia
>   é um toque na tecla errada de um controle remoto, e até aqui o único ponto
>   do sistema que chamava `requestFullscreen` era o botão de entrada. Agora um
>   botão discreto de canto aparece quando FALTA tela cheia (ou som), se
>   recolhe em 5 s e volta com um toque — e o TOQUE DUPLO em qualquer lugar faz
>   a mesma coisa, que é o gesto que todo mundo tenta primeiro num vídeo.
> - **A QUEDA DE CONEXÃO NÃO COBRE MAIS A MÍDIA.** O overlay de reentrada
>   aparecia por cima do louvor que continuava tocando — e continuava mesmo:
>   a mídia da tela é LOCAL (o `<video>` toca o arquivo do `/m/`) e **a letra
>   sincronizada anda pelo `timeupdate` dela**, não por comando, então a queda
>   leva o fio e nada mais. Sem código a digitar, a reentrada não precisa de
>   gente: virou um `POST /par` numa escada (1 s → 30 s), silencioso. O overlay
>   cheio só existe na PRIMEIRA carga, quando não há nada por baixo dele.
> - **A MESA DE SOM SAIU POR INTEIRO.** O som do sistema é o dos displays (a
>   TV pela Presentation, as telas da rede pelo `<video>` delas), e o áudio da
>   preview só tinha como disputar o foco de áudio do Android com a projeção —
>   o defeito que a v5.141 já contornara escondendo o botão com telão
>   conectado. Com o modo, saíram o botão, o `standalone`, o
>   `AVNative.keepAudioAlive` e o `setAudioAlive` do shell (um método de ponte
>   sem chamador é dívida).
>
> `SHELL_VERSION` **38**: o degrau é um ENCOLHIMENTO duplo — `espelhoEstado`
> perdeu `codigo` e a ponte perdeu `keepAudioAlive`. A rota `/s/` não pesa nele
> (é do servidor HTTP, não da ponte).

> **A v5.188: A PRIMEIRA RODADA EM APARELHO DO TELÃO POR COMANDOS — três
> relatos, uma identidade. OTA PURO** (nenhuma linha de Kotlin; sem Release).
>
> - **"O carrossel na Bíblia não funciona, e depois as abas exigem DOIS
>   toques."** As duas frases são UM defeito, e ele é a lição da v5.61 pela
>   terceira vez: `.bible-half` rola sem `touch-action: pan-y`, então o
>   WebView tomava o gesto horizontal para si e o fling residual engolia o
>   toque seguinte — reproduzido em Chromium com toque real (CDP), não
>   deduzido. E havia uma segunda metade de desenho: com um livro aberto (o
>   estado normal de quem usa a Bíblia), a guarda de sub-tela matava o
>   carrossel até NA FAIXA DE ABAS, onde o eixo horizontal não pertence a
>   ninguém além dele — a faixa agora é sempre território do carrossel
>   (`tabsEl.contains(target)` em `elegivel`).
> - **"O telão não herdou o papel de parede."** O `__wp` só viajava na TROCA:
>   quem conectasse depois ficava no padrão para sempre. O `display-ready` de
>   uma tela (`__tela`) agora dispara `telaReenviarPreferencias` — wallpaper
>   (token REUSADO; o funil não re-cunha comando que já chega com `__wp`),
>   `lyricsbg` e `fit`, tudo ENDEREÇADO (`__para`). A remoção viaja como o
>   sentinela `__wp:'padrao'` (anexar URL antes de saber se havia blob cunhava
>   uma URL sem bytes), e a tela pré-carrega com retentativa curta — o
>   comando pode vencer a corrida contra o empurrão dos bytes.
> - **"As imagens de fundo dos slides das músicas não aparecem."** Era a
>   exclusão declarada da E4.1, agora fechada: cada estrofe com
>   `imageOpfsPath` ganha `imageUrl` (`/m/` por imagem DISTINTA, id estável
>   `ly:`+caminho — o mesmo hino de novo custa zero re-empurrão), enfileirada
>   DEPOIS da mídia principal (o som não espera as fotos), e o
>   `applyLyricsImage` do display aceita a URL direto, com retentativa.
> - **E o WALLPAPER PADRÃO virou o símbolo oficial da IASD** (pedido do
>   operador, com o pacote oficial de SVGs em mãos): branco, cor sólida
>   única, sobre denim profundo — as regras do identity.adventist.org. O
>   desenho inteiro é UM arquivo (`shared/wallpaper-padrao.svg`), fonte única
>   do Display, da preview e das telas da rede; a marca de texto
>   "Audio Visual IASD" saiu com o gradiente verde da paleta antiga. No
>   seletor, "Padrão" foi para a ESQUERDA. Duas armadilhas ficaram escritas
>   nos arquivos: `url()` substituído por `var()` resolve contra a PÁGINA
>   (a URL do SVG mora nas folhas consumidoras, não no token), e comentário
>   de XML não aceita hífen duplo (um `--token` citado invalida o SVG
>   inteiro, sem erro nenhum).
>
> Detalhes por seção: o carrossel em `docs/ARQUITETURA-WEB.md` (deslizar
> troca de aba), o wallpaper em "Wallpaper personalizado" (mesmo doc), e as
> duas dívidas fechadas no `docs/TELAO-POR-COMANDOS.md` (nota v5.188).

> **A v5.187 (v1.86): O TELÃO POR COMANDOS SUBSTITUI O ESPELHO DE PIXELS POR
> INTEIRO. EXIGE APK — e a primeira ligada em rede de verdade é numa
> terça-feira.** Pedido do operador, literalmente: *"não gostei do sistema que
> usamos hoje, acho muito inconstante. Vamos trocar absolutamente todo o
> sistema para o command stream."*
>
> A tela da rede deixou de receber PIXELS (VirtualDisplay → MediaCodec H.264 →
> fMP4 → MSE) e passou a rodar **o próprio `/web/display/`**, servido pelo
> celular com a mesma resolução OTA→APK, recebendo **os comandos do barramento
> verbatim por SSE** e a **mídia sob demanda por `/m/<token>`** (Range RFC 7233
> de verdade — a inversão da invariante 8, agora com oráculo próprio). Todo o
> mapa está na seção "Telão por comandos" e no contrato
> `docs/TELAO-POR-COMANDOS.md`; o doc do espelho ficou como histórico, com o
> aviso de aposentadoria no topo.
>
> O que SAIU do repositório, de uma vez: `EspelhoCodec.kt`, `EspelhoDisplay.kt`,
> `EspelhoAudio.kt` (e o JUnit da deriva), `MirrorPresentation.kt`, o
> `fmp4.js`, o `cliente.js`, a página própria do espelho e os testes
> `fmp4.test.mjs`/`espelho-cliente.test.mjs` — mais ~600 linhas de maquinaria
> de pixels dentro do `EspelhoServidor` e o dreno do papel `espelho` no
> `native.js` (o dreno novo, de SUBIDA, mora em `espelho/tela.js`). Com eles
> saíram por construção as famílias inteiras de defeito do §10-A: deriva de
> áudio, GOP × janela, poda de MSE, borda ao vivo, batimento.
>
> O que ENTROU: `EspelhoMidiaCache.kt` + `EspelhoMidiaCanal.kt` (o cache da
> rota `/m/` e o empurrão OPFS → cache por `ArrayBuffer`), o Range/SSE no
> `EspelhoHttp` (puro, com JUnit), `espelho/tela.js` (a casca do papel `tela`,
> carregada no próprio display), o enriquecimento `__rec` + a eleição de
> referência no `controle.js`, e `tools/tela-rede.test.mjs` (26 casos em
> Chromium de verdade, do código de entrada ao adeus). `SHELL_VERSION` **37**
> pela mudança de FORMA do `espelhoEstado`/`espelhoDiag`; o canal de mídia é
> detectado por presença. Exclusões declaradas do lote (dívida dita, não
> esquecida): prefetch de playlist, imagem de fundo da letra e páginas de deck
> não são empurradas ainda (a tela mostra a mídia principal e a letra sem o
> fundo), e a rota `/stream/` do proxy não é servida às telas — YouTube sem
> telão vai pelo download.

> **A v5.186 (v1.85): A ENTRADA VIRA UM CÓDIGO DE TRÊS DÍGITOS, e o `av.local`
> sai. EXIGE APK — é a maior remoção de superfície da história do projeto.**
>
> O pedido do operador, literalmente: *"vamos remover o uso do endereço com o
> localhost, vamos usar apenas o endereço que usa IP. Vamos usar o sistema de
> código na página web, um código de 3 dígitos, gerado quando se ativa a
> disponibilidade online. E na web, teremos apenas o campo de digitar o código e
> o botão de Conectar, pois assim o botão de conectar já vai fazer a função de
> liberar o áudio e colocar em tela cheia."*
>
> **A última frase é a que governa tudo o mais.** `requestFullscreen()` e sair do
> `muted` exigem *ativação transitória do usuário*, e um gesto vale por poucos
> segundos. Para o botão "Conectar" fazer as três coisas, ele precisa gastar o
> gesto ANTES de a rede responder — e isso torna impossível qualquer fila de
> aprovação: quando o operador aprovasse, o gesto já teria passado, e a tela
> entraria muda e em janela, com alguém tendo de atravessar o salão para tocar
> nela. Daí a cascata de remoções, e nenhuma delas é oportunismo:
>
> - **a fila de aprovação** (`Pendencia`, `aprovar`, `recusar`, `consultar`,
>   `pendentes`, a aprovação automática) — código certo ENTRA, na mesma
>   resposta;
> - **a porta aberta da v5.170** (`entrarAberto`) — agora há um código, e ele é
>   exigido; isto é mais forte que a v5.170, não mais fraco;
> - **o pareamento por QR inteiro** (`esperaQr`, `espelho/qr.js`,
>   `tools/qr.test.mjs`, o leitor de câmera do Controle, `AVNative.requestCam` e
>   a permissão `CAMERA` do manifest) — ele existia para INVERTER quem mostra e
>   quem lê o segredo, e a inversão perdeu a razão de ser quando o segredo virou
>   três dígitos que a TELA digita;
> - **o responder mDNS** (`EspelhoMdns.kt`, `EspelhoMdnsPacote.kt` e o JUnit
>   dele) — `av.local` não resolve no Chrome do Android nem na maioria das Smart
>   TVs, que são exatamente as telas deste recurso, então o IP sempre foi o
>   endereço que de fato funcionava.
>
> **O que SUSTENTA três dígitos não é o tamanho, é o bloqueio CRESCENTE** por
> origem: 60 s dobrando a cada bloqueio novo, até 30 min. Com um minuto fixo,
> mil combinações saem numa tarde; dobrando, a sétima rodada custa mais que o
> culto. O contador de bloqueios **não zera quando o bloqueio vence** (quem
> esperou e voltou a martelar é quem a rodada seguinte precisa segurar), e zera
> inteiro na primeira tentativa CERTA. Mais o teto de três sessões, mais o fato
> de o conteúdo ser o que a congregação já está vendo.
>
> **`CHANGE_WIFI_MULTICAST_STATE` FICA no manifest mesmo sem o mDNS**, e isso
> precisa estar escrito porque a leitura natural é o contrário: quem a exige não
> é o multicast, é o TIPO do serviço em primeiro plano (`connectedDevice`).
> Removê-la faz `startForeground` lançar e derruba o app no instante em que o
> operador liga a transmissão.
>
> `SHELL_VERSION` vai a **36** — o primeiro degrau deste contrato que ENCOLHE.
>
> **A v5.185 (v1.84): O EIXO DO SOM ERA UM LAÇO ABERTO — "o som fica para trás,
> a imagem continua, a tela fica sem áudio". METADE APK.** As três frases do
> relato não são três sintomas: são a sequência inteira de um defeito só, e a
> última é literalmente o que o `cliente.js` escreve
> (`soltarAudio('o som ficou para trás')`).
>
> **Os dois eixos são de naturezas diferentes por desenho** — o vídeo é relógio
> monotônico e anda sozinho; o som é CONTAGEM DE AMOSTRAS e só anda quando chega
> PCM. O que faltava é o que fecha isso: **nada, em lugar nenhum, conferia uma
> coisa contra a outra.** Três produtores de deriva, todos reais, todos
> permanentes e todos ACUMULATIVOS: o `AudioWorklet` engasgando (os três
> WebViews dividem UM processo — é o fio que a v5.177 documenta sendo roubado),
> o relógio do hardware de áudio (dezenas a centenas de ppm são décimos de
> segundo por hora, e um culto tem duas), e **PCM perdido dentro do
> `alimentar`** — este um defeito de verdade: a regra "o que não coube CONTA
> assim mesmo" estava escrita e aplicada em `aoReceberPcm`, e **faltava em cinco
> saídas** daquela função, cada uma recuando o eixo permanentemente.
>
> E o desfecho tinha um segundo andar, que é o que transforma "dessincronizado"
> em **mudo**: soltar a faixa **não desfaz a deriva**, porque ela está no
> celular. A tela remontava, `vigiarAudio` media o MESMO desvio no primeiro giro
> e soltava de novo — três vezes em poucos segundos, o teto de remontagens se
> esgotava, e renová-lo exige 45 s de som limpo que nunca iam acontecer.
>
> - **No shell (APK)**: `EspelhoAudio.corrigirDeriva` fecha o laço. Abaixo de
>   250 ms não mexe em nada (a chegada dos blocos tem jitter próprio, e corrigir
>   20 ms a cada bloco trocaria uma deriva por um serrilhado); daí até 3 s
>   **insere SILÊNCIO**, que não é reancoragem — o eixo continua sendo contagem
>   de amostras, o `buffered` continua colado e o muxer não estica amostra
>   nenhuma; acima de 3 s **reancora**, e o limiar não é escolhido: é o
>   `AUDIO_MUDO_MS` do cliente, isto é, o ponto em que a tela já soltou a faixa e
>   não há continuidade a preservar. **A medida é contra o PCM RECEBIDO, nunca
>   contra o consumido** — entre os dois há uma fila de até 64 × ~40 ms, e medir
>   do lado do encoder leria um engasgo da main thread como "o som parou de ser
>   produzido", enchendo de silêncio um buraco que os blocos empilhados fechariam
>   sozinhos e jogando o som À FRENTE do vídeo. Que é o único erro que este
>   desenho não tem como desfazer, porque a correção para trás é rebobinar o
>   `tfdt`.
> - **No web (OTA)**: `voltouOSom` não remonta enquanto o fio ainda mostrar o som
>   mais de 1,5 s atrás. Ela não conserta a deriva — impede que os três créditos
>   de remontagem sejam queimados ANTES de a correção chegar. `vigiarAudio` não
>   servia para isso: ele mede `bv.end - ba.end`, e com a faixa solta não existe
>   `ba`; os carimbos crus do fio existem sempre (`desvioDoFio`).
> - **E o Registro ganhou a linha que faltava o tempo todo**: `som atrás do
>   vídeo: agora N ms · pior M ms`, com as correções e o silêncio inserido. Até
>   aqui "o som ficou para trás" era escrito pela TELA e o lado do celular não
>   tinha UMA medida que o confirmasse — o operador via `24 blocos de PCM/s`,
>   `7424 quadro(s)`, `0 descarte(s)`, tudo saudável, e uma tela muda.
>
> `SHELL_VERSION` **não sobe** — nenhum método da ponte nasceu nem mudou de
> assinatura. Num shell antigo `derivaMs` vem `undefined` e a linha do Registro
> não é desenhada, como manda a regra do bloco. A regra pura
> (`EspelhoAudio.planoDeCorrecao`) tem JUnit, pelo motivo de sempre: o resto do
> arquivo é `MediaCodec` e threads, e é a REGRA que decide se o culto fica com
> som. Ver `docs/ESPELHO-DE-PIXELS.md` §10-A.13.

> **A v5.184: A FOLHA DE CONECTAR LIGAVA O SERVIDOR PARA PODER MOSTRAR O
> ESTADO — e isso é uma falha de FORMA, não de código. OTA PURO.** As duas
> maneiras de conectar eram o mesmo cartão de escolha, e um cartão não sabe
> dizer "ligado": daí o `abrirCast` da v5.171 subir um `ServerSocket` na rede da
> igreja pelo simples fato de alguém ter aberto a tela para ler o endereço.
> Agora são **um botão** (a ação, que sai do app) e **um interruptor** (o
> estado, que dura o culto), com os dois endereços de acesso embaixo — e abrir a
> folha voltou a ser só ler. Vieram junto três defeitos que a redação achou pelo
> caminho, e os três estavam calados: a folha nunca era redesenhada pela enquete
> de 2,5 s (uma tela que entrasse depois da abertura não aparecia), os dois
> endereços tinham pesos tipográficos opostos ao que vale na prática, e **três
> ícones desta UI nunca chegaram a existir na fonte** — codepoint no cmap,
> contorno vazio, um vão do tamanho de um ícone e nenhum tofu que o denunciasse.
> A seção do espelho tem os cinco itens, e `docs/ESPELHO-DE-PIXELS.md` §10-A.12
> tem o porquê de cada um.

> **A v5.183 (v1.73): AS TRÊS DE REDE — a metade que faltava, e a mais
> arriscada. EXIGE APK, e exige ser ligada NUMA TERÇA-FEIRA.** Ela mexe no
> único código do projeto que decide **se o socket sobe e onde**.
>
> - **TODA DECISÃO DE REDE PERGUNTAVA PELA REDE PADRÃO.** `getActiveNetwork()`
>   é, por definição, a rede por onde o tráfego geral sai. Numa igreja com o AP
>   no ar e o link de internet fora — que este documento descreve como o
>   ambiente normal —, o Android marca a Wi-Fi como não validada e promove a
>   **celular** a padrão, porque dados móveis estão ligados (o download do
>   YouTube depende do IP do chip). O preço era duplo e silencioso: o operador
>   tocava em "Mostrar numa tela da rede" e lia *"so liga em Wi-Fi — este
>   aparelho esta em dados moveis"* com o celular associado à Wi-Fi e o IP na
>   mão; e, com o espelho já no ar, a troca de padrão **derrubava a projeção
>   inteira com a LAN intacta e o socket funcionando**. A §2.5 promete o oposto,
>   com todas as letras. Agora a pergunta é "existe uma Wi-Fi neste aparelho?"
>   (`wifiDe`), e o `registerDefaultNetworkCallback` virou um
>   `registerNetworkCallback` de `TRANSPORT_WIFI`. **`NET_CAPABILITY_VALIDATED`
>   fica DELIBERADAMENTE fora do filtro** — é justamente ele que falta numa
>   igreja sem uplink, e exigi-lo seria reintroduzir o defeito com outro nome.
>   A propriedade da §2.3 fica intacta: o socket segue ligado a um IPv4 de rede
>   Wi-Fi, nunca em `0.0.0.0`, e VPN e celular seguem recusados — mas **a regra
>   1 da §2.3 ("rede ativa") precisa ser relida como "rede Wi-Fi"**, senão a
>   próxima leitura reintroduz isto. `getAllNetworks()` está deprecado desde a
>   API 31 e é usado assim mesmo, com o motivo escrito: não existe substituto
>   SÍNCRONO, e esta pergunta é feita no toque do operador, antes de existir
>   callback nenhum.
> - **O IP MUDANDO NA MESMA REDE DERRUBAVA TUDO.** O roteador reinicia às 19h40,
>   ou o lease do DHCP não devolve o mesmo endereço: o código detectava
>   **corretamente**, esperava 6 s, confirmava — e desligava servidor, tela
>   virtual, encoder, janela, mDNS e serviço. Nenhum pacote se perdeu, o
>   aparelho está no mesmo AP, e **as três telas caíam e nunca voltavam, porque
>   não havia servidor**. Agora `confirmarRede` separa "trocou de endereço" de
>   "sumiu": no primeiro caso `religarNoIp` fecha só o `ServerSocket`, refaz o
>   bind no IP novo, **refaz a allowlist de `Host`** (sem isso o IP novo
>   receberia o 404 idêntico — a mesma armadilha do `hostTls` e do nome mDNS,
>   pela terceira vez) e reanuncia o `av.local`. **Não passa por `ligar()`**:
>   aquele chama `desligar()`, que termina em `zerarPares()` — as três telas
>   voltariam ao pareamento por uma troca de DHCP que elas nem viram. Teto de
>   três religamentos por hora; batido, vale o desligamento de sempre.
>
>   **Isto tangencia o item 25 do §10 ("não deixar o espelho ligar sozinho"), e
>   está declarado como inversão em vez de escorregar como conserto de
>   esquecimento:** o espelho não *liga* sozinho — ele **continua** ligado por
>   uma decisão que o operador já tomou, e cuja premissa (o socket serve a LAN
>   deste aparelho) não mudou.
> - **A VAGA FICAVA PRESA A UMA TELA FANTASMA POR ~5 MIN.** `ultimoUsoMs` é
>   renovado a cada volta do vigia enquanto a conexão existir, então uma TV
>   desligada na tomada às 10h00 e fechada pelo `TETO_SEM_RELATO_MS` às 10h01
>   fica com carimbo de "1 min atrás" — e o critério de ociosidade só a soltava
>   às ~10h05. Nesse intervalo a tela do saguão recebia `{estado:lotado}` **com
>   a folha do operador listando duas telas**, e não havia em quem tocar em
>   "Desconectar"; pior, a MESMA TV religada era recusada pelo fantasma dela
>   própria, porque o token vive em `sessionStorage`. Agora o servidor avisa o
>   pareamento (`marcarSemConexao`, no `finally` do fluxo, **com a mesma guarda
>   de dois argumentos do `telas.remove`** — senão a thread velha marcaria como
>   morta uma sessão cuja reconexão já assumiu) e a vaga abre em 45 s, que é uma
>   volta inteira de recuperação do cliente. `marcarComConexao` desfaz a marca
>   quando ela volta. Quatro casos de JUnit travam os dois lados.
>
>   E o Registro passou a publicar **sessões × telas conectadas** lado a lado:
>   enquanto os dois números pudessem divergir sem aparecer, "lotado" com duas
>   telas na lista era uma contradição sem leitura possível.
>
> **`EspelhoService.enderecoMudou` VOLTOU.** Ele saiu na v5.180 por não ter
> chamador — e naquele momento a remoção estava certa, porque nenhum caminho
> mudava o endereço em curso. O `religarNoIp` criou exatamente esse caminho. A
> remoção estava certa e o retorno também: o que mudou foi o mundo, não a regra.
>
> `SHELL_VERSION` **não sobe** — nenhum método da ponte nasceu nem mudou de
> assinatura.

> **A v5.182 (v1.72): A ESTABILIDADE DO ESPELHO, SEGUNDA METADE — e esta
> EXIGE INSTALAR O APK.** Três das seis falhas Kotlin da mesma varredura. As
> outras três são de REDE e ficaram de fora de propósito: elas mexem no único
> código que decide se o socket sobe e onde, e a regra de calendário deste
> documento manda testar isso numa terça-feira.
>
> - **O ENCODER MORRENDO DESLIGAVA O ESPELHO PELA METADE.** `EspelhoDisplay` só
>   sabe da tela virtual, do encoder e da janela; quem derruba servidor, mDNS,
>   pareamento e serviço é o `desmontarEspelho` da `MainActivity`, e os três
>   chamadores dele (`stopMirror`, `onDestroy`, `EspelhoService.onGone`) **não
>   incluíam nenhum dos SEIS caminhos de auto-desligamento**. O que sobrava, num
>   culto sem TV em que as telas da rede SÃO a projeção: socket escutando,
>   `av.local` publicado, notificação dizendo "no ar", e três telas com o
>   `GET /v` aberto recebendo zero byte — congelam, o vigia aborta aos 20 s,
>   reconectam, e o pedido de IDR cai num `codec` nulo. **Telas pretas
>   reconectando pelo resto do culto**, e religar falhava no bind porque o
>   socket antigo seguia em LISTEN: irrecuperável sem matar o processo. Agora os
>   seis passam por um funil (`desligarSozinho`) que avisa a Activity —
>   `desmontarEspelho()`, **nunca `stopMirror()`**, que reentraria em
>   `desligar()`. O callback é limpo no `onDestroy` porque `EspelhoDisplay` é um
>   `object` que sobrevive à Activity: esquecê-lo lá reteria a Activity inteira.
>   De brinde, os dois caminhos de falha do `startMirror` deixavam o `av.local`
>   publicado apontando para uma porta que não atende.
> - **O GOP NÃO TINHA TETO EM SEGUNDOS.** `KEY_I_FRAME_INTERVAL` é **contagem de
>   quadros** (o framework o multiplica por `KEY_FRAME_RATE`), então `I_FRAME_S`
>   = 2 são 60 quadros — o que só vira "2 segundos" quando a fonte entrega 30
>   fps. E a fonte é o batimento do `display.js`, que **muda de cadência
>   conforme a cena**: 8 Hz parada (7,5 s) e, desde a v5.168, um quarto disso
>   quando há conteúdo apresentando quadros que não mudam pixel nenhum da tela
>   virtual — **30 s**, contra a `JANELA_S` de 12 s do cliente. É a aritmética
>   da §10-A.5 de volta por outra porta, e a v5.168 é a única mudança do espelho
>   sem seção própria na §10-A, que é como ela atravessou. A correção não é
>   mexer no batimento (já tentado duas vezes): é **parar de depender dele** —
>   `garantirChavePorRelogio` pede uma chave passados 6 s de parede sem
>   nenhuma. Em cena com movimento ela nunca dispara; em cena parada ela é o
>   único motivo de existir uma chave. E imuniza contra a próxima vez que
>   alguém mexer na cadência da fonte.
> - **TODA REMONTAGEM DO WEBVIEW INJETAVA DEFASAGEM A/V PERMANENTE, E ELA
>   ACUMULAVA.** Os dois eixos são de naturezas diferentes por desenho: o vídeo
>   é relógio monotônico (anda sozinho) e o áudio é CONTAGEM DE AMOSTRAS (só
>   anda com PCM chegando). Numa remontagem — OOM do renderer, `ERROR_RECLAIMED`
>   — o `AudioWorklet` morre por alguns segundos enquanto o vídeo segue
>   compondo; a página volta, `ligarEncoder` devolvia "ok" sem tocar em nada, e
>   **todo quadro AAC dali em diante saía carimbado N segundos no passado**.
>   Como a borda ao vivo do cliente é o MÍNIMO das duas faixas, a projeção
>   inteira passava a ser exibida N segundos atrás; um segundo buraco somava, e
>   cruzados os 3 s o cliente soltava a faixa, remontava contra a MESMA
>   defasagem e ao terceiro desistia — **muda pelo resto do culto, com a imagem
>   seguindo**. O KDoc de `ptsAgora` dizia "nunca há reancoragem" e estava certo
>   sobre o caso dele (reancorar no MEIO do fluxo abre buraco no `buffered`);
>   este é o oposto — o fluxo já foi interrompido, e o `fmp4.js` costura o salto
>   esticando a amostra anterior. Os dois comentários que afirmavam o contrário
>   (`ptsAgora` e o `pagehide` do `display.js`) foram corrigidos junto, senão a
>   próxima leitura desfaz isto.
>
> `SHELL_VERSION` **não sobe**: nenhum método da ponte nasceu nem mudou de
> assinatura. O que muda é comportamento nativo interno — e por isso a v5.182
> **precisa de Release**, ou o operador fica com o bundle novo e o shell velho.

> **A v5.181: A ESTABILIDADE DO ESPELHO, PRIMEIRA METADE (a que chega por
> OTA).** Uma varredura de 36 agentes sobre o sistema de conexão — sete
> revisores por dimensão, dois céticos por achado — devolveu 35 achados, dos
> quais 14 foram à verificação adversarial e 9 sobreviveram por unanimidade. Os
> três que vivem inteiros no `cliente.js` estão aqui; os outros são Kotlin e
> **só chegam instalando o APK**. Os três, e o que cada um custava:
>
> - **O SEGMENTO DE INICIALIZAÇÃO ERA APPENDADO ATRÁS DOS FRAGMENTOS.** A
>   retenção do `csd` de áudio mantém a `MediaSource` fechada por até 2,5 s, e o
>   caminho de vídeo em `receber` **não pergunta por ela**: passada a guarda de
>   `esperandoChave`, todo quadro vira fragmento e entra na fila. Quando a
>   `MediaSource` enfim abria, o `push` do init o punha atrás do que já
>   esperava — e o primeiro `appendBuffer` era um `moof+mdat` **sem init**, que
>   o Chromium recusa. Bastava o `POST /r {do:'audio'}` atrasar 300 ms (uma
>   retransmissão de Wi-Fi) para o IDR ganhar a corrida: ligar o som virava
>   recomeço, e a três recusas a tela escrevia *"esta tela não está conseguindo
>   decodificar o fluxo"* — **mandando o operador trocar a TV por um defeito
>   nosso**. Pôr na frente é melhor que limpar a fila: os fragmentos acumulados
>   começam no IDR desta conexão e são válidos para o init que entra; limpar
>   custaria segundos de preto esperando o quadro-chave seguinte. A ordem virou
>   função pura (`porInitNaFrente`) porque é a REGRA, e é ela que o teste afirma.
> - **NENHUM `POST` DO CLIENTE TINHA PRAZO.** O `GET /v` sempre teve
>   `AbortController` e vigia de fio; o canal de volta não tinha nada, e o
>   buraco é o mesmo TCP meio-aberto por outra porta. O dano não é perder um
>   relato: **o Chromium abre no máximo 6 conexões por host**, e `postar` usa URL
>   relativa — o MESMO grupo de sockets do `fetch('/v')` da reconexão. Uma
>   batida a cada 10 s durante o laço de reconexão enche os slots com zumbis e a
>   **reconexão fica enfileirada atrás deles**, com a tela dizendo "tentando de
>   novo em 0 s" enquanto o AP já voltou. Prazo de 15 s (nunca menos: o
>   `PRAZO_LINHA_MS` do servidor é 10 s desde a §10-A.10, e um prazo curto aqui
>   reabriria pelo outro lado o caso que aquele fecha) mais guarda de relato em
>   voo — o relato é uma fotografia, e a mais nova é a única que interessa.
> - **A ESCADA DE RECONEXÃO NÃO EXISTIA PARA OITO DOS NOVE CHAMADORES.**
>   `recusasSeguidas` sobe num ponto só (o `error` do `SourceBuffer`); os outros
>   oito `recomecar` zeram `tentativa` e não alimentam contador nenhum. Numa
>   Smart TV que não dá conta de uma cena a 30 fps a fila de append estoura,
>   recomeça em 500 ms, e o ciclo se repete: **pisca-pisca de ~5 s na projeção,
>   indefinidamente**. E `tentativa` é estruturalmente incapaz de servir de
>   escada ali, porque ela também zera a cada quadro aceito — e nesses casos os
>   quadros CHEGAM, é justamente por isso que a fila estoura. Daí
>   `recomecosSeguidos`, contado no funil e zerado pelo mesmo trecho longo sem
>   incidente. `recusasSeguidas` fica: é ele que escolhe a FRASE, e "este
>   navegador não aceita o fluxo" × "esta tela não está dando conta" pedem ações
>   opostas do operador.
>
> **O que NÃO entrou, e por quê:** as seis falhas restantes são Kotlin (encoder
> que morre desligando o espelho pela metade; IDR sem garantia de relógio de
> parede; rede padrão virando a celular numa Wi-Fi sem internet; IP novo
> derrubando tudo sem religar; defasagem A/V permanente a cada remontagem do
> WebView; vaga presa a uma tela fantasma). Elas exigem APK, e duas delas mexem
> no único código que decide se o socket sobe e onde — o que, pela regra de
> calendário deste documento, se testa **numa terça-feira, não no culto**.
>
> **E uma lacuna estrutural que a varredura não nomeou e a revisão manual sim:
> o laço de controle do espelho é ABERTO.** O servidor conta `descartes`, o
> cliente reporta `dq`/`tq`/`vfim`, o Android estima a banda do enlace — e nada
> disso é consumido por ninguém: os três só são impressos no Registro. O único
> atuador que existe, `ajustarBitrate`, está ligado **exclusivamente ao sensor
> térmico**. O produtor emite 3 Mbps fixos × 3 telas sobre um enlace de
> capacidade variável, e a única resposta ao congestionamento é descartar quadro
> e pedir IDR — que é um quadro **grande**, entregue num enlace que já não dava
> conta. É um laço que se realimenta, e é a explicação mais econômica para
> "pouco fluído".

> **A v5.180: O COMANDO ATRASADO LEVAVA O ESTADO DE AGORA** — mais uma revisão
> de varredura. A fila da preview (v5.162) atrasa a CÓPIA em até 2,5 s para ela
> não responder antes das telas da rede, e `aplicarNaPreview` lia `currentItem`
> no instante do **dreno**. Dois toques dentro dessa janela — trocar de música,
> ou errar a linha e corrigir, que é o caso comum — faziam o `load` de A ser
> aplicado com o item B na mão: a mídia certa entrava (ela vem pelo `mediaId`) e
> **letra, YouTube e "mantém o texto?" eram decididos pelo item errado**. Um
> comando da fila é do passado por construção; o estado que ele carrega tem de
> ser o daquele passado também, então o item viaja COM ele. `pvTextActive`
> continua sendo lido no dreno, e de propósito: ele é estado da própria preview,
> que já vive na linha do tempo atrasada. Só aparece com o espelho no ar e sem
> TV — que é exatamente a configuração de teste do operador. `tools/cena.test.mjs`
> trava a regra.
>
> Da mesma varredura, mais três, todos pequenos e todos verificados:
>
> - **`ns` (o `networkState` da tela) atravessava o fio inteiro e ninguém o
>   desenhava.** A tela media, o `medidasDe` do servidor o transportava desde a
>   v5.156, e o Registro nunca o imprimia — bytes em cada batida de cada tela
>   para um número invisível. Ele é a outra metade da pergunta que o `rs` faz:
>   `rs` diz quanto dado o `<video>` tem, `ns` diz se ele ainda está ligado numa
>   fonte, e `SEM FONTE` com `rs` em `SEM DADO` é a `MediaSource` desprendida —
>   outro defeito e outra correção que "faminto". Agora sai ao lado do `rs`; com
>   `-1` ("esta tela não informou") a linha some, como manda a regra do bloco.
> - **`addSongVariant`** (controle.js) e **`EspelhoService.enderecoMudou`**
>   (Kotlin) não tinham chamador nenhum. A primeira era o resto do lote da
>   v5.141, que unificou as três funções de destino e removeu só duas; a segunda
>   nunca teve caminho que a acionasse — importar um certificado com o espelho
>   ligado **não** muda o endereço, porque o socket já está de pé, e a folha diz
>   isso ao operador.
>
> E o que a varredura confirmou íntegro, porque também é resultado: a superfície
> da ponte é **simétrica nos dois sentidos** (nenhum `@JavascriptInterface` sem
> chamador em `native.js`, nenhum `B.x` sem método Kotlin), os objetos que
> `native.js` remonta campo a campo (`nowPlaying`, `bgProgress`) batem com os
> chamadores, a telemetria do espelho fecha nos três lados (cliente → servidor →
> Registro) e a tabela `POPUPS` cobre todos os popups do HTML.
>
> **v5.180 é quase toda OTA**; a única linha de Kotlin é a remoção do método
> morto, que não muda comportamento nenhum e não pede Release.

> **A v5.179: O PARAR EXIGIA DOIS TOQUES, e a culpa era do ECO — não das
> camadas.** O relato: no primeiro toque a mídia para, mas a barra fica a meio
> caminho e o ▶ não aparece; o segundo toque resolve. A hipótese natural é um
> sistema de camadas em que o Parar derruba a de cima primeiro, e ela está
> errada — `stopClear` derruba mídia e Camada de Texto no MESMO toque, e o
> `cena.test.mjs` já travava isso desde a v5.178.
>
> A causa é a mesma que a v5.142 documentou para o ▶, do outro lado do fio:
> **`clear` e `media-clear` ESMAECEM antes de sair de cena** (~0,6 s,
> `clearFaded`/`fadeOutToBlack`), e nesse intervalo o `<video>` do telão
> **continua tocando** — a rampa é de volume, não de pausa. Cada `display-status`
> do fade chegava ao Controle com `playing: true` e o tempo antigo e repintava, a
> ~4 Hz, exatamente a UI que `pararMidia` acabara de zerar: a barra voltava ao
> meio, o seek era reabilitado e o ícone voltava a ⏸. O segundo toque só
> "funcionava" porque a essa altura a mídia já saíra e ninguém mais reportava
> aquele `mediaId` — o filtro do handler é por `mediaId`, e `currentId` sobrevive
> de propósito ao stop.
>
> **O caminho do YouTube já tinha a guarda desde sempre** (`yt.stopping`, cujo
> comentário descreve palavra por palavra este defeito); o da mídia local nunca
> teve. A correção fecha os dois lados, e é **OTA puro**:
>
> - **na FONTE** (`display.js`): o telão que está saindo de cena não reporta o
>   fade, e diz UMA vez que o palco ficou vazio. É o que também conserta a
>   **notificação de mídia**, onde não há segundo toque — o `snoopDisplayStatus`
>   do Kotlin lê esse mesmo status de passagem e deixava o cartão anunciando
>   "tocando" sobre um telão vazio até a cena seguinte.
> - **no CONSUMIDOR** (`controle.js`): `midiaNoAr` guarda as **duas** fontes que
>   pintam o transporte — o handler de `display-status`/`espelho-status` e o
>   `previewTick`, que é quem manda **sem telão nem espelho**, e que sofria do
>   mesmo mal porque `preview.getCurrent()` só fica nulo no FIM do fade.
>
> Nada foi tirado do Parar: ele continua sendo o ponto final que leva as duas
> camadas, e as saídas por camada (`text-hide` e `media-clear`, v5.173/v5.178)
> continuam sendo as portas de cada uma. `tools/cena.test.mjs` trava o lado do
> Controle e `tools/display-smoke.mjs` o do telão.

> **A v5.178: O STOP VIRA POR CAMADA, e agora as duas portas existem.** O botão
> de Parar da linha no ar (v5.177) chamava `stopClear()` para uma mídia — que é
> o **Parar do transporte**, e ele encerra a CENA INTEIRA. Com um louvor de
> fundo sob a contagem regressiva de abertura (o uso normal, e o que a
> independência áudio × texto existe para permitir), tirar a música do ar levava
> o cronômetro junto, e a única saída era parar tudo e reprojetar a cena na
> frente da congregação. Faltava o simétrico exato do `text-hide` que a v5.173
> acrescentou: **`media-clear`**. Cada linha do Cronograma fala da **camada
> daquela linha** — a da cena sai pela Camada de Texto e não toca na mídia, a da
> mídia sai sozinha e não toca no texto —, e o Parar do transporte segue sendo o
> ponto final que leva as duas.
>
> **Quem decide entre as duas saídas do palco é o DISPLAY, não o Controle.**
> `textActive` é estado dele; duplicar a leitura do outro lado é garantir que os
> dois divirjam num domingo. Recebido o `media-clear`, ele escolhe entre
> `clear-media` (o `fadeOutToBlack` do `stage.js`, exposto agora: esmaece o
> conteúdo **sem tocar na cortina**) e o `clear` de sempre. A distinção não é
> estética: o cartão de texto vive **por baixo** da cortina do stage — é a mesma
> razão do `instantCover(false)` do ramo de `view` —, então um `clearFaded` com
> texto em cena fecharia o wallpaper por cima do versículo que continua no ar.
>
> E o ramo do `media-clear` vem **antes** do bloco de `textActive` em
> `display.js`. Lá dentro, `clear` é justamente o que chama `hideText`; cair no
> fluxo comum faria o comando atravessar até um `stage.handle` que não o
> conhece — sem erro, sem log, com o cronômetro saindo do ar e nada em lugar
> nenhum que o explicasse. **OTA puro.** `tools/cena.test.mjs` trava o lado do
> Controle e `tools/display-smoke.mjs` o do telão, que é o que roda na frente da
> congregação.
>
> **A v5.177: A PREVIEW ESCONDIDA ESTAVA ROUBANDO O SOM DO ESPELHO.** O
> operador relatou a tela da rede ficando muda com a imagem seguindo, e o
> Registro trazia a causa na própria linha do tempo: pares
> `📱 play [oculto]` / `📱 PAUSA ESPONTÂNEA [oculto]` a ~4 Hz. Aqueles `📱` são
> a **preview do Controle**, não o telão. A v5.173 passou a escutar o
> `espelho-status` — que é o certo, porque sem TV o espelho É a projeção — e com
> isso `resyncPreviewToDisplay` começou a chamar `preview.play()` numa página
> oculta; o Chromium pausa um `<video>` de página escondida, o status seguinte
> chega 250 ms depois e recomeça. **Os três WebViews dividem UM processo**, e
> essa rotatividade de decodificador rouba justamente o fio que alimenta o
> `AudioWorklet` do espelho: do lado da tela da rede isso vence o
> `AUDIO_MUDO_MS` e a faixa de som é solta. A regra que faltava é a outra metade
> da que a v5.173 já escreveu para o atraso — **com a página escondida não se
> toca no transporte da preview** (`preverPodeMexer`): um `play()` que o
> navegador desfaz no quadro seguinte não é sincronização, é ruído, e quem
> realinha é a retomada, que já é EXATA. Junto veio a metade que faltava do
> outro lado: **`soltarAudio` era uma porta de mão única** — a tela ficava muda
> até alguém atravessar o salão para tocar nela. Agora, com o AAC voltando a
> chegar por 2 s seguidos, o cliente **remonta sozinho** (`voltouOSom`), preso
> ao mesmo teto de `REBUILDS_AUDIO`, que só se renova depois de a remontagem ter
> dado certo.
>
> **E a tela receptora ganhou DOIS ícones no lugar do botão único.** "Ver em
> tela cheia e ouvir" juntava duas decisões que não são a mesma: a tela do
> saguão quer imagem cheia e SILÊNCIO (a PA está a 200 ms dali), a da sala anexa
> quer som — e quem descobria o eco não tinha como desfazer sem recarregar a
> página. Agora são um alto-falante e uma moldura, na mesma anatomia dos
> `.pv-fab` da preview (traço, sem moldura, contorno por `drop-shadow`), e eles
> **se recolhem sozinhos** depois de 4 s, voltam com um toque e somem com o
> toque seguinte — o player de sempre, com uma carência de 400 ms porque num
> notebook o ponteiro se mexe ANTES do clique. **O que NÃO dá para tirar, e está
> dito em vez de escondido: o PRIMEIRO toque.** `requestFullscreen()` e sair do
> `muted` exigem ativação transitória do usuário. O que muda é que o toque passa
> a ser NAQUILO que se quer — e, do segundo em diante, o ícone do som é um mudo
> de verdade (`muted` no elemento, sem remontar nada e sem falar com o
> servidor). O som segue **opt-in** (invariante 10): o ícone nasce riscado.
>
> **E no Cronograma o Parar toma o lugar de mover e favoritar.** O segundo toque
> já tirava do ar desde a v5.165 e o selo "● No ar" já dizia o estado, mas a
> direita da linha seguia oferecendo arrastar-para-reordenar e favoritar — as
> duas coisas que ninguém quer fazer com o item que está na frente da
> congregação, a milímetros do gesto que o operador está mirando. Trocá-los é o
> que faz QUALQUER toque naquela linha significar a mesma coisa. A troca é por
> **classe CSS** (`.lib-item.no-ar`), nunca remontando a linha: quem liga e
> desliga o estado é o `marcarNoAr`, que roda a cada `display-status`. **OTA
> puro** — nenhuma linha de Kotlin em todo o lote.
>
> **A v5.176: O CARTÃO DO ESPELHO SAIU DA BARRA DE STATUS, e quem passou a
> avisar é o ÍCONE.** Pedido do operador, e ele tem uma parte que **não dá para
> atender**: a notificação do `EspelhoService` não pode ser removida. Um serviço
> em primeiro plano é obrigado a publicar uma (`startForeground` sem ela derruba
> o app inteiro), e é justamente esse serviço que impede o Android de congelar o
> processo com o app minimizado — isto é, o que mantém o espelho no ar durante o
> culto. O que dá para fazer é tirá-la da frente: o canal foi para
> **`IMPORTANCE_MIN`**, o degrau em que o Android não desenha ícone na barra de
> status e recolhe a entrada para o bloco silencioso da gaveta, mais
> `FOREGROUND_SERVICE_DEFERRED` (o sistema segura o cartão por ~10 s, então
> ligar e desligar para testar não pisca nada). **O canal é um id NOVO
> (`espelho2`), e tem de ser**: a importância pertence ao usuário depois de
> criada, e `createNotificationChannel` sobre um canal existente ignora a
> mudança em silêncio — sem trocar o id, a correção não chegaria a ninguém que
> já tivesse usado o recurso. O fato subiu para onde o operador olha: o ícone de
> conectar veste `.connected` — **a mesma classe, a mesma cor e o mesmo efeito
> do telão** — quando há telas da rede recebendo, e a dica diz quantas. Uma
> convenção só para um fato só. Metade APK (o canal), metade OTA (o ícone).
>
> **A v5.175: A SEÇÃO DE CONEXÃO FORA DO PADRÃO — e o token que não existia.**
> Os DOIS botões principais da folha "Conectar uma tela" pediam
> `var(--radius-md)`, um token que **nunca existiu nesta base**. Um `var()`
> inválido sem fallback computa para o valor INICIAL da propriedade: eram os
> únicos cantos retos de um app inteiro arredondado, na primeira tela do recurso
> mais novo, e nada reclamou em lugar nenhum — mesma família do `setInteger`
> numa chave `long` e do `bytes` esquecido no `bgProgress`. Agora há um oráculo
> (`tools/tokens.test.mjs`, Node puro, **sem `continue-on-error`**) que varre a
> base inteira, mais a asserção RENDERIZADA no `smoke.mjs`.
>
> **E a simplificação da v5.156→v5.171 tinha deixado sobras.** O que a revisão
> achou, e o que ficou: `.mirror-mode` (o seletor imagem × vídeo, morto desde que
> o modo imagem saiu) e `.mirror-hint` eram CSS órfão; `#mirrorRow` era um
> `<span hidden>` — a antiga linha de Configurações — que o `renderEspelho`
> ainda alimentava a cada leitura com uma frase de estado que ninguém via, e que
> ainda servia de SENTINELA de existência para a folha inteira (um elemento de UI
> morto como guarda é a pior forma de guarda: parece intencional e some no
> primeiro `hidden` que alguém mexer); o ENDEREÇO tinha duas anatomias
> (`.cast-addr`/`.cast-url` e `.mirror-addr`/`.mirror-url`, raios, tamanhos e
> paddings diferentes) e aparecia nas DUAS folhas; e as telas conectadas eram
> listadas duas vezes, também com anatomias diferentes. Agora: a folha de
> conectar tem o endereço e quem está vendo; a de Ajustes tem o PIN, o
> certificado, a porta e **só a fila de aprovação**. Mais os literais que viraram
> token (`999px` → `--radius-pill`, `4px`/`2px` → rem). OTA puro.
>
> **A v5.174: "ATUAL" E "NO AR" ERAM A MESMA MARCA, e não são a mesma coisa.**
> A lista tinha um contorno em accent só, e ele significava `currentId` — o item
> ATUAL, aquele que o ▶ repete e que sobrevive de propósito ao Parar. Depois de
> um Parar a linha continuava marcada com o telão vazio; e com uma cena de
> roteiro sobre um louvor de fundo (duas camadas no ar ao mesmo tempo) só uma das
> duas aparecia. Ou seja: a marca não respondia "o que está sendo projetado?",
> que é justamente a pergunta que o segundo toque exige responder antes de ser
> tocado. Agora são duas — `.active` (atual) e `.no-ar` (projetando) —, e a
> segunda usa **o mesmo desenho de "no ar" do resto do app**, com o selo
> **"● No ar"** prefixado ao subtítulo, exatamente como a referência do versículo
> central da Bíblia. O par `midiaNoArId`/`cueNoArId` é o que torna isso possível:
> `midiaNoAr` dizia que HAVIA mídia no ar e `currentId` dizia qual era o item
> atual, e nenhum dos dois dizia QUAL mídia estava no telão. OTA puro.
>
> **A v5.173: A PREVIEW ERA A RÉGUA, e a régua era a coisa que se deformava.**
> O operador relatou a preview voltando "completamente dessincronizada" depois
> de minimizar e reabrir o app. A causa não estava na preview: estava em não
> haver mais nada. **Sem TV conectada, o único emissor de `display-status` é o
> `/display/` do espelho — e o dreno do papel `espelho` o calava.** Restava a
> preview como fonte de tempo, e ela é o único dos três WebViews que o Android
> estrangula quando o app sai da frente. O status do espelho passou a sair
> RENOMEADO (`espelho-status`, para nada que espera "o telão" recebê-lo por
> engano), o telão tem precedência sobre ele nos dois consumidores, e a preview
> voltou a ser o que ela é: uma ILUSTRAÇÃO. Ver "A referência da preview". Junto
> vieram as três regras do atraso — mirar `projeção − atraso` em vez da projeção
> (senão o resync desfaz o atraso a 4 Hz), tolerância de 0,5 s em vez de 1,6 s
> (a preview não tem som, um seek não estala nada) e **0,15 s ao retomar**, e a
> fila da preview deixou de atrasar com a página escondida. **É OTA puro** para
> a sincronização — o `MessageBus` relaia qualquer tipo, então o bundle novo
> conserta a preview num shell antigo; só a **notificação de mídia** (que também
> congelava, e pelo mesmo motivo) precisa do APK.
>
> **E o SEGUNDO TOQUE do Cronograma passou a existir de verdade.** A v5.165
> anunciou "tocar de novo no que está no ar = tirar do ar" e ele não funcionava,
> por **três** motivos empilhados, todos silenciosos: (1) `retirarDoAr` chamava
> só `clearManualText()`, que é BOOKKEEPING — ele zera a sessão e **não manda um
> único comando ao telão**; o versículo continuava projetado. Faltava o
> `text-hide`, que é o mesmo "tirar do ar" da Bíblia e da Mensagem e é
> justamente o que o `clear` não é (o louvor de fundo segue tocando). (2) A
> pergunta "está no ar?" era `item.id === currentId`, e `currentId` é o ÚLTIMO
> item enviado: no instante em que o operador põe uma música por baixo do
> versículo — o caso que justifica o recurso —, ele deixa de apontar para a
> cena. Agora quem responde é `cueNoArId`. (3) `projetarMensagemCue` projetava o
> texto guardado **sem sessão nenhuma** quando a mensagem original tinha sido
> apagada, e uma cena sem sessão é invisível para todo o resto do app. O realce
> da lista passou a marcar as DUAS camadas que podem estar no ar ao mesmo tempo,
> porque marcar uma só escondia justamente a linha em que o toque tem efeito.
> OTA puro.
>
> **A v5.172: A PORTA ABERTA NUNCA ABRIU — e mais sete.** O operador relatou o
> espelho "funcionando, mas sem estabilidade nem confiabilidade na conexão", e a
> revisão linha a linha achou **oito** defeitos. O primeiro explica sozinho a
> maior parte da queixa: o `cliente.js` pedia a entrada assim que a página
> abria — um `POST /par` com o relato e mais nada —, e o `when` do
> `EspelhoServidor.parear` **não tinha ramo para esse corpo**. Caía no
> `else -> 403`. A porta que a v5.170 anunciou e em volta da qual a v5.171
> construiu a folha inteira nunca chegou a existir; e o custo maior não era o
> atrito da estreia, era a RECUPERAÇÃO — toda queda de rede, toda religada do
> espelho e toda expiração de token devolvem a tela ao pareamento, onde ela
> ficava mostrando um QR que ninguém ia ler até alguém atravessar o salão.
> Os outros sete, com o porquê de cada um, estão em
> `docs/ESPELHO-DE-PIXELS.md` §10-A.10; os que mudam decisões deste documento:
> **três recomeços trancavam o espelho por seis horas** (uma sessão só saía de
> `vivas` por `encerrar`, `recusar` ou o prazo, e uma aba nova pede token novo —
> agora a vaga OCIOSA é reaproveitada, o que só faz sessão morrer mais cedo e
> deixa a invariante 3 intacta); **"Desconectar" era um botão que não fazia
> nada** (a folha manda o RÓTULO da tela e ele ia parar num `recusar` que
> procura id de espera — nunca casava, e um rótulo vazio ainda fechava a porta);
> **o teto de conexões em voo contava os FLUXOS** (três telas ocupavam três dos
> oito slots para sempre, e um navegador abre até seis conexões paralelas só
> para carregar a página — a segunda tela a abrir o endereço já era recusada);
> **nenhum dos dois lados detectava um TCP meio-aberto** (o `fetch` de `/v` fica
> pendurado para sempre — nem `done`, nem erro —, e do lado do servidor a
> escrita não trava enquanto o buffer do kernel couber); **uma oscilação da rede
> PADRÃO derrubava o espelho inteiro** (`registerDefaultNetworkCallback` fala da
> rede padrão, que pisca para a móvel numa revalidação da Wi-Fi — agora suspeita
> não é veredito: o vigia confirma 6 s depois); e **o adeus era uma sentença**
> (a página ficava morta até alguém recarregá-la à mão; agora ela volta a
> oferecer entrada sozinha em 20 s). **Metade é APK e metade é OTA**, e as duas
> degradam sozinhas: um bundle novo num shell antigo volta ao QR, e um bundle
> antigo num shell novo entra pela porta assim mesmo, porque o corpo nu vale
> como pedido. `SHELL_VERSION` **não sobe** — nenhum método da ponte nasceu nem
> mudou de assinatura.
>
> **A v5.171: a folha de conectar vira UM DEGRAU.** Eram três (cast → espelho →
> QR) para ler uma linha de texto. Agora **abrir a folha já liga o servidor**
> (ninguém abre "Conectar uma tela" para não conectar, e a ordem "primeiro
> ligue, depois leia o endereço" existia por causa de como o recurso é
> construído, não por causa de quem o usa), o **endereço é o maior elemento da
> tela** (é o único que alguém copia com os olhos para digitar num controle
> remoto) e **a lista de quem está vendo sobe para a folha principal, com o
> botão de derrubar** — com a porta aberta ela deixou de ser fila de aprovação e
> virou o controle de verdade, porque o dano de um curioso é ocupar uma das três
> vagas, não ver o que a congregação já vê. O PIN, o certificado e o interruptor
> da porta continuam existindo atrás de um link discreto de "Ajustes avançados".
>
> **A v5.170: A PORTA NASCE ABERTA.** Quem abrir o endereço do espelho entra —
> sem PIN, sem QR e sem o toque do operador. A decisão é sobre o CONTEÚDO: o
> espelho transmite a imagem do que está sendo projetado **para a congregação
> inteira**, e uma fechadura sobre conteúdo público custava três degraus de tela
> e seis dígitos em cartaz durante todo o culto. O que sustenta a inversão
> continua no lugar: **o microfone ao vivo nunca sai na rede**, o token nunca
> viaja numa URL, a allowlist de `Host` segue exata (DNS rebinding) e o teto de
> três sessões segue valendo — e é ele, não o sigilo, o dano real de um curioso
> na rede, porque ele toma a vaga da TV do templo. A resposta a isso é o
> operador VER quem está conectado e poder derrubar. São **duas metades**: o
> `EspelhoPares` nasce aberto e dispensa o PIN nesse modo (APK), e o
> `cliente.js` tenta entrar sozinho ao abrir a página (OTA) — sem as duas, nada
> muda. QR e PIN continuam inteiros como **plano B**, para quando o operador
> fechar a porta.
>
> **A v5.168 DESFAZ metade da v5.157, e a lição é sobre PISOS.** O batimento de
> 8 Hz do papel espelho passou a "ceder a vez ao conteúdo", e o ganho era real
> (quadros descartados de 7% para 1,6%) — mas transformou um **piso** numa
> **condição**, e um piso com condição não é piso. Em aparelho:
> `ritmo: 0 kbps · 0 fps` com o alarme "ISTO É UM RETÂNGULO PRETO", numa cena de
> Sorteio. A causa: `requestVideoFrameCallback` dispara por quadro que o
> ELEMENTO apresenta, não por mudança na TELA VIRTUAL — um vídeo tocando por
> baixo da cortina, do wallpaper ou da Camada de Texto continua apresentando
> quadros que não mudam um pixel do que vai ao encoder. Com o vídeo parado o
> áudio seguiu sozinho e as duas linhas do tempo abriram **35 segundos** uma da
> outra. Perguntar "o conteúdo está visível?" seria empilhar outra aposta sobre
> cortina, fade, `object-fit`, rotação e Camada de Texto; a resposta é não
> apostar — **o batimento nunca para, ele DIMINUI** (uma batida a cada quatro
> com conteúdo em cena). Mantém a fase longe dos 30 fps, que era o ganho, e
> mantém o piso, que era o motivo de existir. OTA puro.
>
> **O APP ESTÁ EM ALFA FECHADO.** Um operador, um aparelho, e o APK sai por
> Release do GitHub. Isso muda o peso da retrocompatibilidade: **não é preciso
> sustentar shell antigo indefinidamente**. Um método novo da ponte pode
> pressupor o APK mais recente, `minShell` pode subir quando fizer sentido, e um
> caminho de degradação que só existe para uma versão que ninguém roda é código
> morto — apague-o. O que NÃO muda: `SHELL_VERSION` continua subindo a cada
> mudança de superfície (é ela que impede um bundle novo de rodar num shell que
> não o entende), e a janela entre o OTA e o APK continua existindo **dentro de
> um mesmo lote**, porque o bundle chega em minutos e o APK depende de o
> operador instalar. Degradar por algumas horas, sim; sustentar versões antigas,
> não.
>
> **A v5.167: o APK se atualiza DE DENTRO DO APP** (`ShellUpdater.kt`, shell 35).
> A assimetria era o atrito — um ajuste de JS chegava sozinho e qualquer
> mudança de Kotlin obrigava a abrir o navegador, achar a Release e caçar o
> `.apk`. A linha só aparece com versão nova, ao lado do rótulo de versão (é a
> mesma conversa), e o botão só age quando a hora é boa: aqui o
> `horaRuimParaAtualizar()` vale POR INTEIRO — cena, download **e** espelho —,
> ao contrário do OTA da base web, cujo custo é um piscar. **A garantia de
> segurança é mais forte que a do OTA e é de graça:** o Android recusa instalar
> por cima um pacote de outra keystore, então um binário adulterado não instala
> — é por isso que o `ShellUpdater` não replica o `sha256`. Host travado e
> `https` continuam, porque impedem um campo alterado de apontar o download para
> outro servidor. **Ele não instala sozinho**: o diálogo do sistema é
> obrigatório e está certo que seja.
>
> **E o OTA da base web passou a ESPERAR o download terminar.** Aplicar recarrega
> as duas páginas, e um laço de sincronização (hinário, Bíblia, pasta) morre com
> o documento — ele não é um `fetch` que o shell retoma, é um `for` na página.
> Foi o que parou o hinário em 300 de 600 numa tarde de várias publicações. **Só
> o download segura**, e é deliberado: a v5.151 tirou as travas de cena e espelho
> porque elas eram permanentes num culto e faziam a atualização nunca chegar. Um
> download acaba.
>
> **A v5.166: a pasta era persistida DEPOIS do laço, e por isso uma
> sincronização interrompida "não salvava progresso nenhum".** Cada arquivo já
> ia para o OPFS e para a store `files` na hora, com `folder: <id>` — mas o
> ÍNDICE DE PASTAS (`opfs-folders`) só era gravado no fim. Uma pasta de 600
> vídeos interrompida na metade deixava 300 arquivos escritos e **nenhuma pasta
> que os apontasse**: órfãos, invisíveis na tela, ocupando gigabytes — e o
> coletor de lixo, que existe para recolher registro sem dono, os apagava. Agora
> a pasta é gravada ANTES do primeiro arquivo e a contagem tem ponto de controle
> a cada 25. O mecanismo de retomada sempre existiu (o laço pula o que está em
> dia por tamanho + data); o que faltava era ele ter o que retomar. OTA puro.
>
> **A v5.165: TOCAR DE NOVO NO QUE ESTÁ NO AR = TIRAR DO AR.** Era a convenção
> da Bíblia, da Mensagem, do cronômetro e do sorteio, e faltava nos itens do
> Cronograma — ali a única saída era o **Parar**, que é outra coisa: ele encerra
> a CENA INTEIRA. Com um louvor de fundo sob um versículo (o uso normal, que a
> independência áudio × texto existe para permitir), tirar o versículo pelo
> Parar levava a música junto. Por isso o desligamento é **por camada**: cena de
> roteiro sai pela Camada de Texto e **não toca na mídia**; mídia sai pelo mesmo
> caminho do Parar, porque ali ela É a cena. `currentId` **não** é zerado — é
> ele que deixa o ▶ repetir o item, e quem responde "há algo no telão?" é
> `midiaNoAr`. OTA puro.
>
> **A v5.164 dá um NOME ao espelho: `av.local`. REVOGADA na v5.185** — o
> responder inteiro saiu, porque `.local` não resolve no Chrome do Android nem
> na maioria das Smart TVs, que são exatamente as telas deste recurso. O texto
> abaixo fica pelo que ele ensina (a allowlist de `Host`, o `MulticastLock`, o
> porquê de o `NsdManager` não servir). Dois arquivos novos —
> `EspelhoMdnsPacote.kt` (**puro**, com JUnit, porque é o segundo ponto do
> projeto que aceita bytes de um desconhecido, e aqui um erro vira **laço
> infinito**: ponteiro de compressão de DNS é um grafo) e `EspelhoMdns.kt` (o
> socket 5353, o `MulticastLock` sem o qual o Android nunca entrega o pacote, a
> sondagem que impede roubar um nome alheio, e a despedida com TTL 0). **O nome
> entra na allowlist de `Host`** — sem isso `av.local:8787` receberia o 404
> idêntico, que é o modo de falhar mais mudo deste servidor; é a mesma armadilha
> do nome do certificado TLS, agora valendo duas vezes. **Duas coisas que ele
> NÃO conserta, e estão ditas na folha:** a porta fica na URL (portas < 1024 são
> privilegiadas no Linux e nenhum app Android as reivindica — não existe
> permissão), e `.local` **não** resolve no Chrome do Android nem na maioria das
> Smart TVs, então **o IP continua divulgado ao lado do nome**, nunca no lugar
> dele. `NsdManager` não serviria: ele publica um SERVIÇO, e serviço não vira
> nome que se digita. **Exige o APK.**
>
> **A v5.163 acha por que o SOM MORRE, e a causa estava no descarte do
> servidor.** Quando a fila de uma tela enche, `entregar()` fazia `fila.clear()`
> — varrendo o **áudio** junto com o vídeo. O cliente solta a faixa de som depois
> de 3 s sem um quadro AAC (a MSE não toca sem dado em todas as faixas, e uma
> faixa parada congelaria a IMAGEM), remonta, e ao terceiro desiste: **muda pelo
> resto do culto**. Medido em aparelho: `12 descarte(s)`, `3 remontagem(ns)`,
> `som: PEDIDO e a faixa não nasceu`. E a conta é gritante — o AAC são 96 kbps
> contra ~3 Mbps de vídeo, isto é **3% dos bytes**: descartá-lo não alivia
> backpressure nenhuma. Agora o estouro joga fora **só vídeo**, que se recupera
> sozinho no quadro-chave seguinte. **Exige o APK.** Por OTA vão mais três: o
> teto de remontagens de som **se renova** depois de 45 s de som limpo (era um
> teto de sessão — cinco reconexões num culto o gastavam e a tela ficava muda por
> uma turbulência que já tinha passado); `menor folga já vista` passou a ser da
> SESSÃO (ela zerava no salto, que é justamente a consequência que ela existe
> para explicar — daí `11 salto(s)` ao lado de um tranquilizador `+1614 ms`); e o
> `-99999` de "sem faixa" deixou de ser lido como folga negativa, que fazia toda
> tela muda sair do Registro com um "← chegou a secar" falso.
>
> **A v5.162 ataca a SENSAÇÃO, não o número — e a leitura do operador estava
> certa.** O que estraga não é o atraso em si: é a preview mudar no ato enquanto
> a tela da rede muda um segundo depois, e é o botão ficar esse segundo sem
> responder (que se lê como "não funcionou", e o operador toca de novo). Duas
> correções, as duas OTA: **(1) a preview atrasa junto** — `cmd()` já era o funil
> único onde o comando vai ao telão *e* à preview, então a metade da preview
> entra numa FILA que escoa `previewAtrasoMs` depois, e ela vira um espelho fiel
> e deslocado no tempo (letra, fades, cortina, tudo desliza junto). O atraso é
> MEDIDO (a mediana do `vivo.vfim` das telas conectadas), vale **só sem telão
> conectado** (com TV, a projeção é ela e chega no ato), e `authoritativeTime()`
> soma-o de volta — senão "próxima estrofe", tocado logo depois de a estrofe
> virar, devolveria a estrofe que já está no ar. **(2) o ECO**: um anel curto em
> accent, delegado por seletor no transporte e nos três do meio do mixer, que
> NÃO troca o conteúdo do botão — o `.btn-pulso` esconde o filho para pôr um ✓, e
> fazer isso com o ▶ apagaria o ícone que carrega o estado.
>
> **A v5.161 tira o TRANSITÓRIO DE PARTIDA da conta, e ele estava impedindo a
> convergência da v5.160.** Duas contagens falsas: (1) `posicionar()` entrava no
> ponto MAIS ANTIGO que as duas faixas tinham, então o `borda()` seguinte via
> atraso acima de `SALTO_S` e saltava — **dois saltos nos primeiros 43 s** de uma
> sessão sem defeito, e cada salto devolve a folga adaptativa ao teto; a entrada
> passa a ser a borda ao vivo menos o alvo, com `Math.max` mantendo a regra do
> som intacta. (2) A espera pelo PRIMEIRO quadro apresentado era contada como
> travamento — toda sessão saudável nascia com "1 parada, 1,5 s", e o incidente
> falso recuava o alvo logo na partida. Parada é intervalo ENTRE quadros; sem o
> primeiro não há intervalo. OTA puro.
>
> **A v5.160 é OTA PURO e ataca o ATRASO, que virou a queixa depois que o
> travamento saiu.** A folga do cliente é seguro contra soluço do produtor, e
> seguro custa atraso: o operador toca um botão e a projeção responde `ALVO_S`
> depois — mais o desvio A/V, porque a borda ao vivo é a da faixa mais atrasada
> e o som sai ~500 ms atrás da imagem. Somados, os 2 s que o operador mediu no
> dedo. Um valor fixo obriga a escolher entre travar e demorar; agora ele
> **encolhe um degrau de 100 ms a cada 8 s limpos (1,5 s → 0,7 s) e volta ao
> teto de uma vez no primeiro incidente** — a mesma assimetria da suavização da
> ETA do download, com o sinal invertido. Cada tela converge para o menor atraso
> que ELA aguenta, e uma rede ruim recebe sozinha a folga que uma rede boa não
> paga. A leitura é a linha `folga do cursor: video` do Registro, que é
> literalmente esse atraso.
>
> **A v5.159 fechou o que a v5.158 deixou de pé, e o achado é do MESMO tipo:
> `KEY_I_FRAME_INTERVAL` não é segundos de parede, é CONTAGEM DE QUADROS.** O
> framework o multiplica por `KEY_FRAME_RATE` (declarado 30), então `5` são 150
> quadros — ~16 s no espelho, que entrega ~9 quadros por segundo numa cena
> parada. Com a janela do cliente em 12 s, a poda desistia sempre: 65 recusas
> seguidas e a janela crescendo até 25,6 s em aparelho. Passa a **2** (60
> quadros: ~7,5 s parado, 2,0 s num vídeo a 30 fps — este último é o GOP padrão
> de transmissão ao vivo, o que deixa o fluxo pronto para o caminho de
> live/podcast). **Exige o APK.** Do lado do cliente, por OTA: o encalhe passa a
> exigir o cursor PARADO (fora do buffer ANDANDO é o Chromium pulando buraco
> pequeno sozinho — socorrê-lo estala a imagem e foi o que levou os quadros
> descartados de 1,6% a 13,7%), e a poda faminta PEDE uma chave, fechando o laço
> pelo lado que não precisa de instalação.
>
> **A v5.158 achou a causa do travamento, e ela era a PODA.** `SourceBuffer.remove()`
> da MSE não apaga só o intervalo pedido: ele continua **até o próximo ponto de
> acesso aleatório** (e, não havendo nenhum, até o fim). A janela viva do cliente
> era de 5 s e o GOP real numa cena de letra é de **~19 s de parede** — o
> `KEY_I_FRAME_INTERVAL` vira CONTAGEM DE QUADROS (150) e o produtor entrega 8
> quadros por segundo. A poda apagava o presente; o cursor ficava fora do buffer;
> a MSE não toca, não erra e não avisa; e a única saída era o salto de `SALTO_S`,
> que precisa de 8 s de borda aberta — **7,1 s**. Os "trava a cada 7 segundos"
> nunca foram o defeito: eram o relógio da recuperação. A correção é OTA
> (`cliente.js`: poda em cima de quadro-chave, janela 12 s, encalhe detectado no
> instante, `ALVO_S` 1,5 s), e os sete campos novos do Registro exigem o APK. Ver
> §10-A.4 do doc do espelho — inclusive por que a medida `pq` da v5.157 era
> estruturalmente incapaz de ver a parada que existia para medir.

> **A v5.157 mede o travamento, e a metade que MEDE é APK.** O batimento que cede
> a vez ao conteúdo (P3, `display.js`) é OTA puro e vale sozinho. Já os cinco
> números do pior caso (`pq`/`nq`/`pc`/`pv`/`pa`) atravessam a **lista fixa** do
> `EspelhoServidor.medidasDe` — num shell anterior eles são descartados em
> silêncio e a linha simplesmente não é desenhada no Registro, que é a degradação
> certa e também o motivo de a Release ser obrigatória: sem ela o operador
> continua vendo um log saudável de uma tela que trava. `SHELL_VERSION` **não**
> sobe: nenhum método da ponte nasceu ou mudou de assinatura.

> **A v5.154 é METADE OTA e METADE APK, e a divisão importa para quem for testar
> em aparelho.** Os quatro defeitos do cliente do espelho (a sombra que matava o
> laço de borda, o buffer do fio que sobrevivia ao recomeço, a faixa de som que
> não soltava e o prazo do `csd` que nunca rearmava) vivem em
> `assets/web/espelho/cliente.js` e chegam **por OTA, sem instalar nada**. Os
> dois do servidor — a despedida que ninguém emitia e a ordem do `csd` no fio —
> são Kotlin e **só chegam com o APK novo**. A ponte não mudou, então
> `SHELL_VERSION` continua 34 e nada é recusado por versão: num shell antigo o
> espelho segue funcionando com as correções do lado web, e sem a despedida.
>
> **A v5.155 é OTA PURO** — nenhuma linha de Kotlin, nenhuma Release. As duas
> correções dela (a borda ao vivo lida da faixa mais atrasada e a transliteração
> do que viaja ao Registro) vivem inteiras no `cliente.js` e chegam sozinhas ao
> aparelho que já tem o APK v1.70.
>
> **A v5.156 é METADE OTA e METADE APK, de novo.** O modo imagem saindo, a folha
> do botão de cast e o relato da tela chegam por OTA. O teto de 4 KiB do
> `POST /r`, os contadores do servidor, a janela perguntada, o perfil do encoder
> e a memória são Kotlin — **só com o APK novo**. E o bundle degrada sozinho no
> shell antigo: o 413 do relato grande faz o cliente voltar ao curto, e um
> `espelhoLigar('video')` num shell que ainda conhece `'imagem'` recebe vídeo,
> que é o que ele deveria ter pedido. `SHELL_VERSION` continua **34**.

> **O ESPELHO DE PIXELS exige o APK novo, e o CLAUDE.md precisa dizer isso em
> vez de deixar deduzir:** os cinco métodos da ponte são shell 32, e a linha em
> Configurações não é sequer desenhada abaixo disso. O bundle 5.141 chega por
> OTA a todo aparelho e é **inerte** num shell antigo — que é exatamente a
> degradação certa, e o motivo de o `minShell` continuar em 2.
>
> **E o PAREAMENTO POR QR exige um APK ainda mais novo (shell 33, v5.145).** A
> metade que roda na tela chega por OTA e funciona sozinha — o código aparece,
> desenhado pelo `qr.js` — mas quem o LÊ é a câmera do Controle, e a permissão
> `CAMERA` mora no manifest. Num shell 32 o botão de ler não é desenhado, a tela
> mostra um QR que ninguém vai ler, e o operador usa os seis dígitos, como antes.
> **Duas coisas do lote não passam pelo OTA de jeito nenhum:** a permissão no
> `AndroidManifest.xml` e o `onPermissionRequest` do `ControleChromeClient` —
> sem ele o `getUserMedia` do Controle é negado em silêncio, e o botão pareceria
> quebrado sem erro nenhum no console.

> **A transmissão direta exige o APK v1.55.** A v5.127 corrigiu o defeito que a
> mantinha quebrada desde a v5.120 — a faixa de bytes viajava no cabeçalho
> `Range` e o WebView aplicava o deslocamento uma segunda vez sobre a fatia (ver
> a invariante 8 e, em `docs/ARQUITETURA-WEB.md`, "A segunda requisição que
> morria — e o contrato que ninguém tinha lido"). **A correção é metade Kotlin:
> o OTA sozinho não a leva.** Num shell < 27 o bundle novo nem tenta transmitir
> e vai direto ao download — o que é melhor que o comportamento anterior, em que
> ele projetava uma cena que morria, abria a cortina sobre o preto e ainda pagava
> uma re-extração antes de baixar. O rodapé de Configurações passou a dizer por
> onde a faixa viaja, justamente para essa leitura não depender de adivinhação:
> `faixa na URL` (funcionando) × `DESLIGADA: shell N < 27`.
>
> **CONFIRMADO em aparelho** (S24 Ultra, Android 16, WebView 150): `Transmissão:
> MediaSource ok (avc1+aac) · faixa na URL` e `transmitindo 1080p
> (137@VISIONOS + 140@VISIONOS)` **sem nenhuma linha de falha atrás** — o vídeo
> entra no telão sem download. Três rodadas de APK (v1.52 → v1.54) foram gastas
> num diagnóstico plausível e errado; o que fechou o caso foi ler a fonte do
> Chromium em vez de deduzir por eliminação de mensagens que, como se descobriu,
> nem chegavam.
>
> A v5.128 tirou o resto que aparecia na estreia: o `<video>` fica segundos em
> cena sem um quadro (init + índice + primeiro fragmento vêm da rede) e o
> WebView pintava ali o **pôster padrão** dele — o retângulo cinza com o play
> preto gigante. O `stage` já escondia o elemento enquanto não houvesse `src`;
> com a transmissão, "sem `src`" virou "sem dados". Agora ele carrega um pôster
> 1×1 transparente enquanto espera (ver `POSTER_VAZIO` em `shared/stage.js`) e o
> devolve ao normal no primeiro quadro.
>
> E a v5.129 fechou o que estava embaixo do placeholder: **a transição de
> entrada existia pela metade.** A mídia velha esmaecia até o preto e a nova
> entrava no talo — invisível com arquivo local (o corte colava no fim do
> esmaecimento), gritante com a transmissão. `runFadeIn` espelha o `runFadeOut`
> que já existia, esperando o primeiro quadro e levando a rampa de volume junto.
> Ao escrever o teste apareceu o motivo de a cortina nunca ter coberto esse
> caso: **para um vídeo ela não esmaece** — `play()` chama
> `instantCover(computeCover())` e a arranca instantaneamente —, então o fade de
> conteúdo é a única transição de entrada que um vídeo tem. Detalhes em
> `docs/ARQUITETURA-WEB.md`.
