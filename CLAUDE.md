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
10. [Séries do YouTube (o álbum "Provai e Vede 2026")](#séries-do-youtube-o-álbum-provai-e-vede-2026)
11. [A paleta](#a-paleta)
12. [Divergências entre o caminho web e o nativo](#divergências-entre-o-caminho-web-e-o-nativo)
13. [Build e distribuição](#build-e-distribuição)
14. [Regras de desenvolvimento](#regras-de-desenvolvimento)

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
│   ├── controle/serie.js        #   as SÉRIES do YouTube: a REGRA que decide o
│   │                            #   que entra num álbum (PURA, com oráculo Node)
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
│   ├── TrilhaAudio.kt           # QUAL trilha de áudio vai ao telão (a dublagem
│   │                            #   automática do YouTube) — PURO, com JUnit
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
├── ARQUITETURA-WEB.md           # arquitetura da base web — ler antes de mexer em assets/web/
├── TELAO-POR-COMANDOS.md        # o CONTRATO do telão por comandos — ler antes de mexer nele
├── FONTE-DE-DADOS-LOUVORJA.md   # referência do banco LouvorJA (hinos/Bíblia)
├── HISTORICO.md                 # APÊNDICE: as notas de todas as versões — usar por grep
└── ESPELHO-DE-PIXELS.md         # ARQUIVO: recurso removido (v5.187); só §2.3, §2.4 e §10-A
```

**Vinte e seis arquivos Kotlin, uma dependência de terceiros no shell** — o
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

**No WebView do TELÃO:**

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
YouTube pausava sozinho** ao ver `document.hidden`. `onWindowVisibilityChanged`
reporta sempre `VISIBLE` para tirar esse gatilho. **Não bastou** para o YouTube
(a solução real foi baixar o vídeo, e desde a v5.212 o embed não existe mais),
mas fica: o
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

Definida em `shared/native.js` (web) sobre `__AVBridge` (Kotlin,
`NativeBridge.kt`). **Só existe quando `window.__AVBridge` existe** — no
navegador a IIFE retorna na entrada e nada é definido, nem `__NATIVE__`.

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
  atualizacaoEstado(), // → { web, webAtual, shell, shellBytes, shellAtual, diag }
                       //   OS DOIS CANAIS numa leitura só — shell 43. Ele não
                       //   acrescenta poder: acrescenta COERÊNCIA DE INSTANTE
                       //   (ver a seção do OTA)
  apkProcurar(),       // → { versao, url, notas } da Release nova, ou null — shell 35
  apkInstalar(),       // baixa e abre o diálogo de instalação do sistema — shell 35
                       //   (sem URL: quem a escolhe é o `ShellUpdater`, do
                       //    achado da última `apkProcurar`)
  ytDiag(),            // → string: o que o extrator recebeu na última extração
                       //   (diagnóstico do rodapé de Configurações)
  ytStream(url, altura), // → manifesto DASH { video, audio, seconds, height } ou null
                       //   TRANSMITIR sem baixar — exige shell 26
  ytSearch(termo),     // → [{ id, url, name, author, seconds, thumb }] do YouTube
  ytCanalPlaylists(canalUrl), // → [{ name, url, count }] da ABA do canal — shell 41
  ytPlaylist(url),     // → { name, author, items:[{id,url,name,seconds,thumb}] }
                       //   os dois são as SÉRIES da Biblioteca. TRANSPORTE puro:
                       //   o `name` do item é o título CRU (sem `tituloLimpo`),
                       //   e quem lê os nomes é `controle/serie.js`
  deckPages(origem, nome, onProg), // → { name, pages:[url] } ou { erro }: PDF em imagens
  deckExportUrl(link), // → URL de exportação PDF de um link do Google Apresentações
  deckDiscard(url),    //   e apaga as páginas depois da cópia
  captureVolumeKeys(bool), // botões físicos de volume vão para o app
  systemVolume(step),  // devolve um passo ao volume do sistema (fader no limite)
  temaClaro(bool),     // o TEMA escolhido: ícones das barras + windowBackground
  requestMic(),        // → bool: permissão RECORD_AUDIO (push-to-talk)
  keepAlive(bool),     // download em curso — ver "Trabalho em segundo plano"
  bgProgress({label, done, total, etaMs, items, idleMs, bytes}), // progresso na notificação
  nowPlaying({active, title, subtitle, playing, slideMode, slideLabel, wallpaper, positionMs, durationMs, actions}),
                       //   `actions`: os BOTÕES do cartão, na ordem, escolhidos
                       //   pelo lado web — shell 42. Vazio = os cinco de sempre
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
São **43 métodos**, e essa é a superfície inteira que o resto do lado web tem
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

Hoje vale **44**. "Superfície" inclui **forma de retorno** e **comportamento**,
não só assinatura: um campo que some, um contrato de URL que muda ou um método
que passa a fazer outra coisa exigem o degrau do mesmo jeito.

| shell | o que mudou |
|---|---|
| **44** | `espelhoEstado` ENCOLHE: cada tela perdeu os seis campos de capacidade (`seguro`, `mse`, `mms`, `fetchStream`, `videoDecoder`, `wakeLock`) — sem produtor desde a v5.187, e `optBoolean` os publicava como `false`, que é valor legítimo |
| 43 | `+ atualizacaoEstado` — os dois canais numa leitura só. Não acrescenta poder, acrescenta **coerência de instante** (três promessas independentes desenhavam o diálogo pela metade) |
| 42 | `+ actions` no `nowPlaying` — os botões do cartão, escolhidos pelo web (invariante 5) |
| 41 | `+ ytCanalPlaylists`, `+ ytPlaylist` — TRANSPORTE puro; quem decide é `controle/serie.js` |
| 40 | ENCOLHE: `espelhoDiag` perde `ritmo`, `espelhoEstado` perde `modo` — restos do espelho de pixels que saíam ZERADOS e eram lidos como medição |
| 39 | `+ temaClaro` — ícones das barras e `windowBackground`, o que o CSS não alcança |
| 38 | ENCOLHE: `espelhoEstado` perde `codigo` (a porta é o endereço); sai `keepAudioAlive` |
| 37 | forma do `espelhoEstado`/`espelhoDiag` vira a do telão por comandos. Nasce o canal `__avTelaMidia`, detectado por **presença**, não por versão |
| 36 | primeiro degrau que ENCOLHE: sai `requestCam`; `espelhoAprovar` passa a só derrubar |
| 35 | `+ apkProcurar`, `+ apkInstalar` |
| 34 | `+` os três métodos do certificado TLS |
| 33 | `+ requestCam` (saiu no 36) |
| 32 | `+` os cinco métodos do espelho |
| 31 | `+ otaCheck`, `+ otaDiag` |
| 30 | **comportamento**: `ytFetch` repetido RECLAMA o desfecho guardado (`YoutubeGrab.resgatar`) |
| 29 | `+ otaPending`, `+ otaApply` |
| 28 | `+ ytCancel` |
| 27 | **contrato**: a faixa de bytes do `ytStream` viaja na QUERY, nunca em `Range` (invariante 8) |
| 26 | `+ ytStream` · 25 `+ ytFetchAte` e `bytes` no `bgProgress` · 23 `+ ytFetchAudio` |
| ≤ 22 | `ytDiag`, `ytSearch`, os três de deck, `pickDoc`, `openExternal`, `ytFetch`/`ytDiscard` |

Duas regras de thread que vieram com o espelho e continuam valendo:

- **Os cinco métodos do espelho ficam FORA da fila de IO** e rodam na main
  thread. A fila é de uma thread só e é onde roda o download do YouTube: "ligar a
  transmissão" no meio de um download venceria pelo prazo de 60 s do `native.js`
  e resolveria `null` — um erro sem causa. (A razão ORIGINAL morreu com a
  `MirrorPresentation`; o que sustenta hoje é isto mais a serialização de
  `espelhoSrv`/`espelhoMidia`. Ver o KDoc de `MainActivity.startMirror`.)
- **`ytCancel` não vai para fila nenhuma**, e não poderia: a fila está ocupada
  justamente pelo download que se quer parar. Ele escreve um `@Volatile` e volta;
  quem responde é o laço de cópia do `YoutubeGrab`, a cada bloco de 64 kB.

**Um método novo NÃO chega por OTA.** O bundle segue com `minShell: 2` de
propósito — subi-lo recusaria a atualização inteira num shell antigo, o que é
pior que um recurso a menos. Quem depende de método novo **pergunta antes**
(`__SHELL_VERSION__ < N`): um botão que não faz nada no meio de um culto é pior
que botão nenhum. Ele aparece sozinho quando o APK novo for instalado.

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

  **E o `__tela` é o que dispara o reenvio das PREFERÊNCIAS** (wallpaper, fundo
  da letra, preenchimento — `telaReenviarPreferencias`), porque é a única coisa
  que distingue uma tela da rede do telão de verdade, que lê tudo do IndexedDB
  sozinho. **Esta linha descreveu por dezenas de versões um combinado que o
  código não cumpria**: o campo era anexado ao `tela-status` e nunca ao
  `display-ready`, então aquela função — criada na v5.188 justamente para isto —
  nunca rodou para uma tela de verdade, sem erro em lugar nenhum (v5.222). Quem
  monta o anúncio é `anuncio()`, dono ÚNICO do carimbo: há dois pontos que
  anunciam (o dreno e o `aoConectar` do reanúncio) e o que entrega é quase
  sempre o segundo, porque o `display-ready` nasce antes de existir token. Os
  dois lados do contrato têm oráculo — o produtor no `tela-rede.test.mjs`, o
  consumidor no `boot-nativo.test.mjs` —, e são dois porque ler cada lado
  isolado aprova ambos.
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
`syncLyrics`, `ensureBibleVersionDownloaded` e `syncDeviceFolder` (o único que
chama `bgWorkBegin`/`bgWorkEnd` direto). No navegador é tudo no-op.

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
 │   "v2.0"    │  o OTA     release:published          │ web + shell      │
 └─────────────┘                                       │ → UMA pergunta   │
                                                       └──────────────────┘
```

- **`shellTag` no `version.json` é o acoplamento.** Declarado, o `web-ota`
  **segura a publicação do bundle** até a Release existir (o job termina verde e
  diz no resumo que está segurando — é o estado normal entre o merge e a
  Release). Quando ela sai, o gatilho `release: [published]` republica o bundle
  com o bloco **`shell`** (versão, URL do `.apk`, tamanho) dentro do manifesto.
  Sem `shellTag` o manifesto anuncia a Release mais recente que existir —
  `shellTag` responde *"este lote PRECISA de uma Release?"*.
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

- **Uma pergunta, sobre o lote.** Sem Release: *"Base v5.234 — as duas telas
  recarregam e a projeção pisca."* Com Release: *"Base v5.234 e app v2.0 (30 MB)
  — a base entra primeiro…"*. Desfechos: **Atualizar agora** · **Deixar para
  depois**.
- **Ordem base → APK.** A base é rápida e não depende de confirmação; o APK exige
  um diálogo do sistema que pode ser recusado. Invertido, uma recusa ali deixaria
  o lote inteiro por aplicar.
- **A INTENÇÃO sobrevive à recarga.** `otaApply` substitui o documento, então
  nada em memória atravessa: a intenção é gravada no `state` do banco ANTES de
  aplicar (mesmo lugar e motivo da intenção de download do YouTube) e relida na
  abertura seguinte. Descartada quando o `versionName` instalado alcança a versão
  pedida — sem isso o instalador reabriria oferecendo o que já está rodando — e
  depois de 6 h.
- **A pergunta espera só o que ACABA: cena projetando e download em curso.** O
  **espelho não segura**: ele fica ligado o culto inteiro, e incluí-lo tornava a
  supressão permanente (foi por isso que a v5.151 desistiu de perguntar).
  **Instalar o APK espera os três** (`horaRuimParaAtualizar`), porque derruba o
  app e leva o servidor da rede junto.
- **"Depois" cala o diálogo, não o FATO.** O botão `#otaRow` de Configurações
  passa a dizer por extenso o que espera ("Atualizar: base v5.245 e app v2.2") e
  aplica no toque.
- **Toque fora do diálogo NÃO responde por ele** (`appDialogFixo`). Esta pergunta
  aparece sozinha, no meio de outra coisa, e um toque em qualquer lugar a
  resolvia como "depois", silenciando-a pela sessão. "Deixar para depois" e
  Esc/voltar continuam valendo — o que deixa de existir é a recusa por acidente.
- **O Registro diz POR QUE está esperando**: ninguém foi perguntado, o operador
  adiou, espera a cena sair, ou o shell recusou o bundle. As quatro pedem ações
  opostas.

Oráculo: **`tools/ota.test.mjs`** (Chromium + ponte de mentira), incluindo a
intenção atravessando um `reload()` de verdade.

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
- **A ronda é blindada contra exceção.** `scheduleWithFixedDelay` CANCELA todas
  as execuções seguintes quando o `Runnable` lança — sem log e sem `Future` que
  alguém consulte. Errar aqui é a detecção parar para sempre naquele aparelho.
- **Nada de cópia guardada.** O asset de `web-latest` é substituído no lugar
  (mesma URL, conteúdo novo), que é exatamente quando um cache devolve o de
  ontem com toda a razão — e isso não atrasa a atualização, torna-a INVISÍVEL.
  Daí `no-cache` **e** `?t=` na URL (caches que ignoram o cabeçalho existem).
- **O shell EMPURRA** (`window.__avAtualizacao`; `window.__avOta` ao lado, para
  bundles anteriores ao shell 43) quando o estado muda — inclusive **quando só o
  APK mudou**, senão uma Release sem base web nova ficaria muda. Bundle antigo:
  no-op, e a enquete de 10 s é o piso.
- **A comparação é contra o que o aparelho JÁ TEM** (`versaoJaTemos`), não contra
  o que ele SERVE: um bundle baixado espera o próximo lançamento e
  `currentVersion` continua sendo o da sessão — comparar por ele rebaixaria o
  mesmo zip a cada ronda, apagando com `deleteRecursively` um diretório que o
  operador pode ter acabado de mandar aplicar ao vivo.
- **`#otaRow` tem dois estados**: "Procurar atualização" (pula o piso do shell —
  é o único chamador que o faz) e "Atualizar: …". Os dois desfazem a recusa da
  sessão. `otaDiag` alimenta a linha **"Procura:"** do Registro: "não apareceu
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
     no web, a enquete + o gatilho de retomada, para shell antigo (≥ 29) e para
     o caso de o empurrão se perder.
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
`controle.js`, e um erro em qualquer um dos cinco últimos aborta só AQUELE
script — o `load` dispara, `AVDB` continua lá, e o bundle quebrado era carimbado
como bom **para sempre**. As quatro condições, cada uma cobrindo o que a
anterior não cobre:

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
em até **três navegadores da rede da igreja**, sem instalar nada nas telas e sem
depender de internet. A especificação fechada, com cada decisão e o motivo dela,
está em [`docs/TELAO-POR-COMANDOS.md`](docs/TELAO-POR-COMANDOS.md) — **leia
antes de mexer**; esta seção é o mapa. (O antecessor, o espelho de pixels —
VirtualDisplay → H.264 → MSE —, foi **removido por inteiro na v5.187**; de
`docs/ESPELHO-DE-PIXELS.md` sobrou só o que código vivo ainda cita.)

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

  **E a pergunta "o que ainda falta nesta tela?" NÃO pode ser feita DENTRO do
  gesto** (v5.214). `requestFullscreen()` é assíncrono e o clique borbulha até
  o `document` antes de a tela cheia existir — medido em Chromium, o ouvinte do
  documento roda com `fullscreenElement=false` e o `fullscreenchange` chega
  9 ms depois. Perguntar ali responde sempre contra o passado, e o que nascia
  disso era um SEGUNDO botão oferecendo exatamente o que o toque acabara de
  fazer: a ativação unificada parecendo exigir uma segunda interação. Quem
  responde é o próprio pedido de tela cheia — a Promise resolve quando ela
  entrou e rejeita quando foi recusada —, e entre o gesto e esse desfecho o
  `oferecerGesto()` é mudo (`assentando`, em `tela.js`).
- **Depois de ativada, NADA cobre a tela.** O overlay cheio existe só na
  primeira carga, quando não há nada por baixo dele. Queda de fio, token
  vencido e até o `adeus` do operador reentram em silêncio (um `POST /par` numa
  escada de 1 s a 30 s) — a mídia é local (`/m/`) e a letra anda pelo
  `timeupdate` do próprio `<video>`, então a queda leva o fio e mais nada. O
  gesto perdido (tela cheia) volta por **dois atalhos, e nenhum botão**
  (v5.218): o TOQUE DUPLO e o **F11**. O botão discreto de canto que existia
  aqui saiu — ele existia para devolver o gesto numa RECARGA, e a recarga passou
  a voltar para a entrada oficial (abaixo), então ele virou um segundo controle,
  com outro nome e outro desenho, para a mesma decisão.

- **MAS A RECARGA VOLTA PARA A ENTRADA OFICIAL** (v5.218, decisão do operador —
  ela REVOGA a metade da regra acima que valia para o F5). A distinção é entre
  perder o FIO e perder a PÁGINA: numa queda de fio a mídia continua tocando e
  cobrir a tela apagaria uma cena que o problema não atingiu; uma recarga já
  derrubou tudo — documento, `<video>`, cena e, sobretudo, o GESTO, que não
  sobrevive a uma navegação. Não há projeção a preservar, logo não há nada a
  cobrir, e o certo é o botão que o visitante já conhece. **O token é carregado
  adiante** ainda assim, e isso não contradiz "a recarga desconecta": o fio só
  abre no toque. O que ele evita é o teto de três telas — `telasSse` é indexado
  pelo TOKEN, então pedir pareamento novo a cada F5 deixaria a sessão anterior
  ocupando vaga até o vigia notá-la, e a terceira recarga seguida receberia
  "lotado".
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
- **O episódio aparece TRÊS DIAS ANTES** (`DIAS_DE_ANTECEDENCIA`): o roteiro é
  montado durante a semana. É **contagem**, não dia da semana — sobrevive ao
  canal que publicar num domingo. Nesses três dias o vídeo pode não estar
  público, e falhando o download a resposta diz o que fazer ("ainda não liberado
  pelo canal — tente mais perto de 22/Ago"), em **dois lugares**, porque são dois
  fluxos: o cartão sobre a preview ("Tocar agora" fecha a Biblioteca) e o card da
  série (pelo Cronograma ela continua aberta). Sem a frase, é indistinguível de
  queda de rede.
- **O QUE AINDA NÃO SAIU NÃO ENTRA NA LISTA** (campo `futuros`). O @daniellocutor
  sobe o trimestre inteiro e libera um por sábado; os que faltam aparecem na
  playlist e **não tocam**. A régua é a DATA (único sinal deste lado — o item de
  um vídeo restrito chega idêntico ao de um liberado), o corte é INCLUSIVO no dia
  do culto, e vídeo SEM data nunca é escondido. **É campo e não regra global**: o
  Provai e Vede libera o mês inteiro de uma vez (medido: em 15/ago já tinha até
  26/set, e aqueles tocam). O DIA entra também na ASSINATURA das playlists,
  senão a economia devolveria a lista de ontem no sábado de manhã.
- **O NOME DO ITEM pode ser SÓ A DATA** (`titulo: 'nenhum'`): no Informativo o
  título é a série mais a data, e "o nome é o que vem antes da barra" daria 52
  linhas idênticas. Numa lista anual a data é única. **`nomeDoItem` nunca devolve
  vazio** — sem data e sem título ele cai no título CRU, que é feio e longo, e é
  infinitamente melhor que uma linha em branco na lista do culto.
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
- **O card não baixa em lote, e o botão muda de verbo.** "Baixar" ali seria o
  download direto que o operador pediu para não existir, na maior escala do app
  (~15 GB). O botão da barra some assim que HÁ índice (sem índice ele fica —
  ali ele busca a lista, não baixa), o item de opções vira **"Atualizar a
  lista"** (`syncCollection(coll, { soIndice: true })`) e a série sai de "Baixar
  toda a biblioteca", peso incluído.
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
  prefixo "Informativo" · 2026 · playlists por trimestre · rótulo pela data
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
- **UM NOME POR LINHA**: os dois separadores óbvios já são parte dos dados (" · "
  no rótulo formado, " | " no título cru).
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

## A paleta

A paleta mora em **`assets/web/shared/tokens.css`**, fonte única carregada pelos
dois `index.html` **antes** da folha do app. Até a v5.47 os tokens de marca eram
mantidos à mão em DUAS folhas (`controle.css` e `display.css`), e o comentário
das duas admitia que "a sincronização é manual" — sincronização manual entre
dois arquivos é uma classe de bug, não um processo: basta um ajuste entrar só
num lado para o telão e a preview do Controle, que existe justamente para
ESPELHAR o telão, mostrarem coisas diferentes.

**E DESDE A v5.267 NÃO HÁ CONTORNO EM LUGAR NENHUM.** Pedido do operador:
*"não tenhamos itens usando linha de borda, tudo deve ser com preenchimento
sólido, e definição feita por puro e simples contraste entre os elementos"*.
Saíram **82 declarações** de `border`/`outline` das folhas da base; sobrevivem
dois DESENHOS (os aros que giram — `.dl-ring` e `.av-stage-busy` — e o ✓ do
seletor de destinos), nomeados um a um no oráculo. **A regra tem oráculo**
(`tools/tokens.test.mjs`, sem `continue-on-error`), e é ele que a faz durar: uma
borda é a coisa mais fácil de acrescentar em CSS quando duas caixas não estão se
separando o bastante — é literalmente o remendo que este lote desfez — e ela não
quebra nada, não erra alto e não aparece em teste de comportamento nenhum.

**As duas metades do pedido são o mesmo pedido**, e é por isso que vieram no
mesmo lote: quando a linha some, o degrau de tom passa a ser a ÚNICA coisa que
separa duas caixas. O par `--panel` × `--panel-2` valia 1,29:1 com o argumento
escrito de que "ele não carrega o estado sozinho — quem diz 'selecionado' é
sempre a BORDA em `--accent`"; abriu para **1,33:1** (escuro) e **1,41:1**
(claro), e `--muted`/`--accent` acompanharam porque no valor antigo o accent
caía a 4,40:1 sobre o painel-2 novo e reprovava AA.

**E a regra do vermelho mudou de eixo.** Era "PREENCHIDO = está no ar ·
CONTORNADO = destrutivo"; sem contorno, o que separa os dois é a INTENSIDADE do
mesmo preenchimento — saturado (`--live`) é o que está no ar agora e não pode
ter concorrente na tela, suave (`--live-fill` numa linha, `--danger-soft` num
botão) é a ação destrutiva. Entraram três fundos de estado OPACOS
(`--sel-fill`, `--live-fill`, `--ok-fill`), e serem opacos é medido:
`--accent-soft` a 16% sobre o painel compõe `#3d4959`, que é o `--panel-2` desta
paleta — uma linha SELECIONADA ficava com a cor exata do nível de baixo da
árvore. Opacos, os três valem o mesmo em qualquer nível: um estado SAI da escada
em vez de ocupar um degrau dela.

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
- **E a regra vale para as REGRAS, não só para os tokens** (v5.219). Os tokens
  do palco estavam certos e as folhas do palco liam `--brand`, `--live-strong`,
  `--bg` e `--accent-glow` — quatro tokens de TEMA. No Display isso nunca doeu
  (ele não escreve o atributo); na preview com o tema CLARO ligado, o título do
  slide de capa era desenhado com o denim oficial sobre o preto do palco:
  **2,73:1 medidos**, ilegível, e foi assim que o operador o encontrou. Daí
  `--stage-accent`, `--stage-accent-glow`, `--stage-on-accent` e `--stage-alert`
  no bloco compartilhado. **Nada pintado no palco pode ler um token redeclarado
  em `[data-tema]`**, e o oráculo mudou de pergunta junto: `tools/smoke.mjs`
  compara a COR COMPUTADA de cada camada do palco nos dois temas (o defeito
  passava por baixo da versão que comparava quatro nomes de token).
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
  um cartão branco. **O par FLUTUANTE ganhou nome próprio na v5.267**
  (`--surface-alta`/`--surface-2-alta`) porque passou a existir um caminho de
  VOLTA: a folha da Biblioteca é nível 0, e um controle lá dentro flutua de
  novo — coisa que um override do mesmo nome não daria, já que
  `--surface: var(--surface)` é um ciclo que o CSS descarta.
- **A ESCADA TEM TRÊS DEGRAUS, E O QUARTO É O ESPAÇO** (v5.267). Um quarto tom
  obrigaria o nível mais interno a subir até ~`#4c5865` no tema escuro, onde
  `--muted` mede 3,59:1 e `--accent` 3,37:1 — os dois reprovam AA para texto
  pequeno, que é o tamanho do texto de uma linha de lista. Quem carrega o quarto
  nível é o ESPAÇO: uma faixa dentro de um álbum aberto não tem caixa nenhuma, e
  o que a separa da vizinha é o tom do próprio álbum aparecendo entre elas.
  No tema CLARO a escada **não é monotônica**, e isso é aritmética: a página é
  cinza e o nível 1 é branco (a convenção de toda UI clara), então o primeiro
  degrau sobe e os seguintes só podem descer. Folha e card ficam a 1,09:1 e isso
  não se lê como ambiguidade porque os dois nunca se encostam — entre eles há
  sempre a moldura branca da seção. O oráculo mede os pares ADJACENTES e exige
  só que nenhum par coincida; a primeira versão dele exigia monotonia e reprovava
  um desenho correto.
- **O TOM DE UM BLOCO É DECISÃO DO PAI** (`--camada`, v5.267). O mesmo
  componente ocupa níveis diferentes conforme a tela — uma `.lib-item` está
  sobre `--bg` na tela principal e sobre `--panel` dentro de uma folha —, e
  pintava sempre a mesma cor, isto é, dois tons idênticos encostados. `--camada`
  é uma propriedade com um significado só: *o tom que um bloco filho DESTE
  contêiner deve vestir*. **Quem a declara é o contêiner, nunca quem pinta**: uma
  propriedade escrita no próprio elemento vence na hora de ELE resolver
  `var(--camada)`, então um bloco que reservasse o tom dos filhos em si mesmo
  passaria a vestir aquele tom (a primeira versão da regra pôs a seção da
  Biblioteca na lista e ela passou a vestir a cor do card — o defeito da v5.241
  de volta, pego pelo oráculo nos dois temas).
- **Nunca escrever branco literal.** Nenhum `#fff` sobrou como valor de cor em
  `controle.css`/`display.css`: o branco pleno era a maior fonte isolada de luz
  emitida do app, e o off-white da paleta (`--text`) é o que se usa. As únicas
  exceções são DUAS, e as duas são declaradas em `tokens.css`. **O palco**
  (`--stage-text: #fff`), porque num telão a legibilidade vem de luminância
  máxima, não de um off-white calibrado para uma tela a 30 cm do rosto. E **o
  campo de busca da Biblioteca** (`--field-bg`, v5.268, pedido do operador):
  ali o argumento da regra continua de pé e o preço está dito — num salão
  escuro aquele é o retângulo mais luminoso da tela —, mas ele é pequeno, só
  existe com a Biblioteca aberta, e é uma escolha explícita de quem opera. No
  tema CLARO o `--panel` é branco pleno, e ali a regra não se aplica pelo motivo
  dela: uma página clara é a escolha explícita de quem não está no escuro.

  **E uma superfície sem tema arrasta o que vive DENTRO dela** — é a regra do
  palco (v5.219) num lugar novo. `--field-bg` vem com `--field-text` e
  `--field-muted`, no bloco compartilhado: o texto, o placeholder e a lupa moram
  dentro do campo, e no tema escuro `--text` sobre branco dá **1,17:1**. Trocar
  só o fundo apaga o que se digita, e é o meio-conserto que o oráculo do
  `smoke.mjs` reprova.
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

**Não há teste automatizado de contraste ABSOLUTO no repositório.** Os números
nos comentários de `tokens.css` são medições feitas à mão, e os pares que ficam
abaixo do piso estão declarados como tais no próprio comentário. Ao mexer num
token, meça — nada no CI vai barrar uma regressão de texto sobre fundo, **e são
DOIS temas a medir**. O que o CI trava é outra coisa, e vale repetir para não
confundir os dois: `tools/tokens.test.mjs` garante que todo `var(--x)` sem
fallback aponta para um token que EXISTE (um `var()` inválido computa para o
valor inicial da propriedade, sem aviso nenhum — foi assim que os dois botões da
folha de conectar ficaram com cantos retos na v5.171), que nenhum token exista
só no tema claro e, desde a v5.267, que **nenhuma regra desenhe contorno**;
`tools/smoke.mjs` trava o efeito RENDERIZADO nos dois temas, o palco que não os
segue, a escolha que sobrevive à recarga e a ESCADA DE CAMADAS da Biblioteca —
esta última medindo o degrau ENTRE níveis, que é a única parte do contraste que
tem oráculo.

O raciocínio completo (cada par medido, os pisos adotados, os ladrilhos da
Bíblia e as células de capítulo/versículo) está na seção de paleta de
`docs/ARQUITETURA-WEB.md`.

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
| Link do YouTube compartilhado | vira item de LINK, que só o app resolve | avançado: as MESMAS quatro escolhas da busca (tocar · playlist · Cronograma · Favoritos + vídeo/só-áudio + teto). Simplificado: sem pergunta, **transmissão direta** (`tentarTransmitir`) — ali o link É um "tocar agora". Falhando: download; falhando ele: item de LINK, resolvido no toque seguinte (`resolverLinkYoutube`) — um link compartilhado nunca se perde |
| Destino de um item | uma escolha por vez | **VÁRIOS destinos de uma vez**, método único: toda opção da folha (as três listas **e** o "Tocar agora") é selecionável de corpo inteiro, e um confirmar sempre visível executa. Um vídeo do YouTube é baixado UMA vez para dois destinos. Importação e share abrem a mesma folha com o Cronograma já marcado; desistir entra no Cronograma. Ver `docs/ARQUITETURA-WEB.md`, "UM item, VÁRIOS destinos" |
| Onde o share aterrissa | idem (mesmo `importShare`) | **`focarImportado`**: fecha popups e seleção; projeta na hora no simplificado (item vai para a prateleira `avulsos`, que não tem lista visível) ou vai ao Cronograma no avançado. A preview em tela cheia só é encerrada se houver telão |
| Estado do telão (Configurações) | atalho `window.open('../display/')` | **indicador ao vivo**, desabilitado como botão |
| Botão de cast da preview | oculto | `AVNative.openCast()` → seletor de espelhamento (ver abaixo) |
| Retomada do telão ao reconectar | idem (`resendSceneToDisplay`) | **só reenvia o que ESTAVA no ar** — a pergunta é `midiaNoAr`, nunca `currentId` (que sobrevive ao stop de propósito, para o ▶ repetir a faixa). Telão vazio também é estado: restaurá-lo é não mandar nada |
| Girar a mídia | idem (comando `rotate`) | botão em Configurações, 90° por toque. O motor TROCA O EIXO da caixa antes de girar, para o `object-fit` medir o retângulo em que a mídia vai de fato aparecer |
| Som da preview | com a janela do Display aberta é muda; sem ela toca (sujeito a autoplay) | **sem tela nenhuma conectada, o som sai DESTE aparelho** (`acertarSaidaDeAudio`). Não há interruptor: o estado é DERIVADO da conexão (`simpleDisplay` = TV **ou** tela da rede) e só vale no avançado. Com qualquer tela conectada este aparelho fica mudo — os WebViews dividem o processo e a saída de áudio, e a preview roubava o foco do player do telão |
| PDF · `.pptx` · Google Apresentações | **PDF não existe**; `.pptx` funciona pelo mesmo caminho do app | **uma IMAGEM POR PÁGINA**. PDF pelo `PdfRenderer` da plataforma (`SlideDeck.kt` + `deckPages`); `.pptx` pelo renderizador de `assets/web/vendor/` (`pptxParaPaginas`, `import()` dinâmico + `<foreignObject>`/canvas). Daí é mídia comum, com ⏮/⏭ passando página. **Não há botão de "apresentação"** — entra por "Importar arquivos" (`pickDoc`: o PDF precisa que o shell abra o ARQUIVO, e `<input type=file>` só devolve bytes) ou pelo share. `.ppt` legado e `.odp` ficam de fora: ninguém sabe desenhá-los |
| **Tocar agora** de vídeo do YouTube | **não toca**, e a linha do item diz isso | **TRANSMISSÃO DIRETA** (shell 26; só funciona do 27 em diante): `ytStream` monta o manifesto das duas adaptativas, `StreamProxy` as serve pelo NOSSO origin com o UA que combina, e `shared/mse.js` as vira um `<video>` comum — fade, cortina, `MediaSession` e barra de graça, zero pixel de YouTube no telão. Faixa de bytes na QUERY (`?r=ini-fim`), **nunca** em `Range` (invariante 8). Só em "Tocar agora": as outras ações GUARDAM, e manifesto expira em horas. Falhando qualquer coisa, cai no download, calado |
| Vídeo do YouTube | **não toca** | **baixado PELO APARELHO** (`YoutubeGrab.kt` + `ytFetch`) — a extração sai do IP do chip, que é o que o YouTube não bloqueia. Falhando, vira item de LINK, retentado no toque seguinte |
| Qualidade do download | — | teto escolhido pelo operador: **Online · 1080p · 720p · 480p**, no mesmo seletor de Vídeo/Só áudio. Nasce no padrão A CADA ITEM (um teto que grudasse daria 480p no vídeo do domingo sem aviso). 1080p usa o `ytFetch` de sempre; só teto MENOR usa `ytFetchAte`. "Online" (`-1`, e não `0`, que já significa "sem teto") guarda **só o link** |
| Resolução do download | — | **até 1080p, montando as duas faixas** — acima de 720p o YouTube entrega vídeo sem som. `MuxMp4.kt` junta com `MediaMuxer` (cópia de amostras, sem recodificar). Pares do MESMO contêiner (mp4+m4a, webm+webm na API 29+): "a melhor de cada lado" daria VP9 em MP4, que o muxer recusa **depois de tudo baixado**. Falhando, o progressivo é o piso. Requer o extrator ≥ v0.26.4 (cliente **visionOS**, que entrega adaptativas sem PO Token); as listas chegam misturadas, daí a **fila de candidatos** — ver `docs/ARQUITETURA-WEB.md` |
| **Só o ÁUDIO** em "Tocar agora" | **não toca** | transmitido também: o manifesto já traz o par e o lado web DESCARTA o vídeo (`man.video = null`) — nenhum método novo, nenhum byte de 1080p baixado à toa. Entra como `kind:'audio'` (o telão mantém o wallpaper) |
| **Só o ÁUDIO** guardado | — | **`ytFetchAudio`** (shell ≥ 23), pelo mesmo seletor Cantada/Playback. `kind:'audio'` e sem miniatura — é o *kind*, não o contêiner, que faz o telão manter o wallpaper. Único caminho sem o teto de 720p do progressivo. Fila de três candidatos na ordem do cliente que funciona, progressivo no fim |
| **Séries do YouTube** | **não existe** | **um álbum por SÉRIE** (shell 41) — ver a seção do recurso. O ITEM é um vídeo do YouTube, não faixa de hinário: mesma folha (sem "Só áudio"), "Tocar agora" transmite, download só nos destinos que guardam. Não há "baixar o álbum" (~300 MB/episódio) |
| Buscar no YouTube | não existe: abre o YouTube numa aba | **busca dentro da Biblioteca** (`ytSearch` → `YoutubeGrab.pesquisar`), resultados na mesma lista e mesma folha de destinos. Em **português**: passar localização ao `NewPipe.init` NÃO resolve (o serviço filtra por uma lista que só tem `en-GB`) — quem resolve é o `forceLocalization` do próprio `Extractor`. Iframe é recusado pelo `X-Frame-Options`; a API oficial exigiria chave com cota |
| Link para fora do app | `window.open` | **`openExternal(url)`** → `ACTION_VIEW` em tarefa própria. O WebView RECUSA navegar para outro origin (invariante 2): sem esse método um link externo não faz nada, nem erro no console |
| Sem tela conectada (simplificado) | mesmo bloqueio, com a janela do Display no lugar da `Presentation` | **modo bloqueado**: cortina embaçada, seção de conexão no centro, saída para o avançado na frente |
| Fullscreen da preview | `requestFullscreen` + Screen Orientation | idem, com trava de paisagem **nativa** (`onShowCustomView`) |
| Botões físicos de volume | o navegador não os recebe | **interceptados**, ligados ao fader (ver abaixo) |
| Microfone | o navegador pergunta | `MicChromeClient` + `RECORD_AUDIO` (ver abaixo) |
| Câmera | o navegador pergunta | **negada, sempre**. O `onPermissionRequest` do `ControleChromeClient` FICOU, negando **com log**: um WebView sem ele nega em silêncio, e o próximo que precisar de mídia aqui descobriria a armadilha do zero |
| Botão voltar | — | **fecha o que estiver aberto** antes de minimizar (ver abaixo) |
| Controles fora do app | — | `MediaSession`: notificação, tela de bloqueio, botões de mídia |
| Download minimizado | a aba continua baixando | **foreground service + wake lock**; sem isso o processo é congelado |
| Atualização da base web | recarregar a página | **OTA** |
| Atualização do APP | — | **o app baixa e instala**; o diálogo do Android é obrigatório e está certo que seja |
| Tema claro × escuro | CSS + `localStorage`; `theme-color` tinge a barra | idem **mais o cromo do sistema**: `temaClaro` vira os ÍCONES das barras e guarda a escolha para o `windowBackground` do PRÓXIMO lançamento (recurso de APK é resolvido antes de existir JS) |
| **Telão nas telas da rede** | **não existe** (navegador não abre `ServerSocket`) | servidor HTTP no celular + SSE + `/m/<token>` — ver a seção do recurso |
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

### Botão voltar: fecha antes de minimizar

O voltar **nunca** encerra a Activity — no fim da fila só `moveTaskToBack`, com
sessão e `Presentation` vivas. **Quem decide é o lado web** (`window.__avBack`,
invariante 5); `MainActivity.handleBack()` pergunta e obedece. A ordem é do mais
efêmero ao mais permanente:

1. diálogo modal → 2. bottom-sheet (o de cima) → 3. preview em tela cheia (que,
sem telão, **é** a projeção) → 4. coluna do mixer → 5. seleção múltipla →
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

Com espelhamento ativo o Android roteia os botões para a TV, e o fader do app
não saía do lugar. `MainActivity.onKeyDown` consome `KEYCODE_VOLUME_UP/DOWN` — e
o `onKeyUp` correspondente, senão o sistema ainda reage à soltura — e entrega o
passo a `window.__avVolumeKey(±1)` → `applyVolume()`, a mesma função do fader.

- **Só intercepta depois que o web pede** (`captureVolumeKeys(true)`, no fim da
  carga do Controle). Interceptar desde o `onCreate` faria uma falha de JS deixar
  o aparelho sem **nenhum** controle de volume.
- **Válvula de escape:** no máximo ou no zero, o web devolve o passo ao sistema
  (`systemVolume` → `adjustStreamVolume` com `FLAG_SHOW_UI`).
- **A tecla mostra o fader** por 2,8 s (`peekVolume`, reusando
  `openVolume()`/`closeVolume()` — não uma segunda UI), inclusive quando o passo
  vai para o sistema: ver o fader no fim do curso é a resposta para "por que o
  volume não muda?". As três regras de convivência com o toque estão em
  `docs/ARQUITETURA-WEB.md`, seção do Mixer.

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
| **Release** ⭐ | `git tag v1.0 && git push --tags` | **link direto para o .apk** |
| Release manual | Actions → *Build APK* → *Run workflow*, com `release_tag` | a tag é criada pelo próprio workflow |

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
| `sidx.test.mjs` | o parser `sidx` |

**Chromium de verdade, em DOIS PASSOS:** `Preparar o Chromium` (o `npm i` e o
`playwright install`, **com** `continue-on-error` — infraestrutura) e `Oráculos
em Chromium`, que depende do primeiro. O segundo **segue** com
`continue-on-error` (barrar o canal OTA por um teste de navegador é trocar um
risco raro por um bloqueio frequente), mas roda **todos SEMPRE** — nenhum aborta
o próximo —, emite `::error::` por reprovado e escreve o placar `N/M` no **resumo
do run**. `N` e `M` são CONTADOS, nunca digitados: um número fixo envelheceria no
primeiro oráculo novo, e envelheceria mentindo.

> Eles rodavam num passo só com `set -euo pipefail`: o PRIMEIRO reprovado
> abortava os outros, e como o passo era `continue-on-error` o run ficava
> **verde**. Descobrir isso exigia abrir o log e reparar onde ele parou.

| oráculo | o que cobre, e por que existe |
|---|---|
| `smoke.mjs` | sobe a base e usa a tela; mede o RENDERIZADO nos dois temas (palco sem tema, escada de camadas, contorno) |
| `boot-nativo.test.mjs` | **o boot COM a ponte presente** — o `smoke` sobe SEM `__AVBridge`, então todo caminho `window.__NATIVE__` (justamente os que só rodam no aparelho) nunca era executado. Injeta uma ponte de mentira e pergunta o que o watchdog pergunta: o app ficou de pé? |
| `display-smoke.mjs` | **o TELÃO** — a metade que roda na frente da congregação, e a que menos rede de segurança tem (o watchdog do OTA não a valida). Viewport fixo em 961×540, explicitamente. Trava o endereçamento do reenvio de cena |
| `ota.test.mjs` | **o fluxo de atualização** — o único caminho cujo defeito NÃO TEM SINTOMA: nada quebra, o operador só continua na versão de anteontem. Afirma a pergunta com e sem Release, o "depois", e a INTENÇÃO atravessando um `reload()` de verdade |
| `registro.test.mjs` | **o Registro** — o único artefato cujo consumidor é um HUMANO A DISTÂNCIA: ele não falha calado, falha CONTINUANDO A RESPONDER com frase errada. Cobra as duas metades: nenhuma palavra de recurso aposentado **e** o que o operador foi buscar presente |
| `tela-rede.test.mjs` | **a tela da rede de ponta a ponta**, contra um servidor de mentira que fala o protocolo do `EspelhoServidor` |
| `ponte.test.mjs` | **o que a ponte de fato ENTREGA** — `native.js` REMONTA campo a campo, e um campo esquecido some em silêncio. Afirma também que ele não drena papel nenhum e que o display emite as quatro mensagens (`display-ready`, `display-status`, `media-ended`, `mic-status`) — quem filtra é o `tela.js`, nunca a fonte |
| `cena.test.mjs` | o que o telão mostra ao RECONECTAR (o caminho menos testável à mão: exige TV, dongle e o timing de derrubá-lo) |
| `destinos.test.mjs` | o que está marcado atravessa o fechamento da folha — a ação roda depois de `closeSongMenu()`, que zera o conjunto |
| `db-gc.test.mjs` | o coletor de lixo — o único código do app que APAGA mídia do operador |
| `acervo.test.mjs` | as contas da Biblioteca ("completa?" e "quanto ocupa?"), que já foram respondidas por fórmulas diferentes na mesma tela |
| `contexto-seguro.test.mjs` | `VideoDecoder`, `wakeLock`, `audioWorklet`, `randomUUID`, `crypto.subtle` fora de guarda `isSecureContext` em `espelho/` **e `display/`** — o display INTEIRO roda em `http://` nas telas da rede, e lá essas APIs vêm `undefined` |
| `mse.test.mjs` · `stage-fade.test.mjs` | mensagens de falha da transmissão direta · a transição de entrada do palco |

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
`EspelhoMidiaCacheTest` (o token-capacidade da rota `/m/`) e `TrilhaAudioTest`
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
`allowBackup="true"` sozinho leva tudo, e duas coisas não podem ir:

- **`files/web-ota/` e `shared_prefs/web-ota.xml`** — o bundle extraído e o
  ponteiro para ele, isto é, **CÓDIGO** que roda no origin privilegiado com
  acesso a `__AVBridge`. Um backup adulterado plantaria JS arbitrário sem passar
  por nenhuma das três garantias (não há download, nem `sha256`, e `minShell` só
  existe no caminho do download). Nada ali precisa sobreviver à troca de
  aparelho.
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

  **Desde a v5.234 isso tem uma primeira linha, e ela vem ANTES do merge:**
  declarar a tag em `assets/web/version.json`.

  ```jsonc
  { "version": "5.234", "minShell": 2, "shellTag": "v2.0" }
  ```

  Com ela, o `web-ota` SEGURA o bundle até a Release `v2.0` existir — nenhum
  aparelho recebe a metade web de um lote cuja metade nativa ainda não saiu — e,
  quando ela sai, republica o manifesto **com o link do APK dentro**, para o app
  perguntar uma vez sobre o lote inteiro. Sem `shellTag` o bundle sai na hora,
  que é o certo para um lote só de web.

  Então o fluxo ganha uma última linha quando o diff tocou o shell:

  ```bash
  # depois do push em main, com o Actions → "Build APK" → Run workflow,
  # input `release_tag` = a MESMA tag declarada em version.json
  ```

  A tag é criada pelo próprio workflow a partir de `main` (ver "Build"), então
  não é preciso empurrar tag à mão. **Não esperar o operador pedir**: mudou o
  shell, sai Release. E a mensagem que anuncia a mudança já não precisa avisar
  que ela exige instalar o APK — o app avisa sozinho, e instala.

  **Um `shellTag` esquecido não quebra nada, mas desfaz o ganho**: o bundle sai
  antes da Release e o aparelho recebe a metade web sozinha, como antes da
  v5.234. Um `shellTag` apontando para uma tag que nunca será publicada é pior:
  o canal OTA fica segurando para sempre, em silêncio, e a única pista é a linha
  no resumo do run.

- **Nunca perder funcionalidades existentes ao refatorar.** A base web tem
  todo o sistema de culto (coleções LouvorJA, letra sincronizada, Bíblia,
  Camada de Texto, playlist, fades) — ver `docs/ARQUITETURA-WEB.md`.
- **Todo código novo em `assets/web/` precisa continuar rodando no navegador.**
  Caminhos nativos entram sempre como `if (!window.__NATIVE__) { …web… }`.
- Não introduzir dependências externas — Kotlin puro + AndroidX oficial no
  shell; JavaScript puro no web. **Duas exceções no web, e as duas são
  declaradas** (a terceira, a IFrame Player API do YouTube, SAIU na v5.212 — ver
  a nota daquela versão): o
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
- **Um bloco de diagnóstico guarda o VEREDITO, nunca uma segunda opinião**
  (v5.249). Quando o que se quer explicar é uma DECISÃO do app, o texto tem de
  sair da mesma função que decidiu — `AVSerie.avaliarPlaylist` devolve
  `{ mes, motivo }` e o `mesDaPlaylist` é a metade dela que a regra usa. Uma
  segunda escrita das mesmas perguntas ("por que esta playlist não entrou?")
  envelhece à parte no primeiro ajuste, e o que sai disso é um log que discorda
  do aparelho — o pior artefato que este projeto sabe produzir, porque ele é
  lido A DISTÂNCIA e por quem não tem como conferir. **E ele registra o dado
  CRU**, não só o resultado: um rótulo já formado prova que a regra rodou; só a
  entrada dela diz por que ela produziu aquilo.
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

**Versão atual: v5.298** (base web) · `SHELL_VERSION` **44**, e o bundle segue com
`minShell: 2` — ele funciona igual num shell antigo, só sem os recursos que são
nativos por construção (a escada do voltar, os botões de volume, a notificação de
controles), que **só chegam instalando o APK novo**, não pelo OTA.

### O histórico mora em `docs/HISTORICO.md`

As notas de lote — 145 delas, uma por versão, verbatim — saíram deste arquivo e
viraram [`docs/HISTORICO.md`](docs/HISTORICO.md), com índice de uma linha por
versão no topo. **Elas eram 66% do CLAUDE.md**, isto é, dois terços do que é
lido em toda sessão para responder a perguntas que quase nunca são feitas.

O que ficou aqui é o que vale HOJE. O que está lá é o que explica POR QUÊ.

| pergunta | onde |
|---|---|
| como isto funciona? | aqui, ou `docs/ARQUITETURA-WEB.md` |
| por que é assim? / já foi tentado? | `grep` em `docs/HISTORICO.md` |
| que lote mexeu em `foo`? | `grep -n "foo" docs/HISTORICO.md` |

**Publicar uma versão continua exigindo a nota** — ela entra em
`docs/HISTORICO.md`, logo abaixo do índice, mais uma linha no índice. Uma
decisão revogada é anotada na nota que a revoga, nunca apagada da que a criou.
Aqui só entra o que muda uma REGRA: nesse caso, corrija a seção normativa.
