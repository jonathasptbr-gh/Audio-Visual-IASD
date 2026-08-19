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

São **quarenta e três métodos**, e essa é a superfície inteira que o resto do
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
direto, e sem a guarda qualquer script rodando no documento do Display lia o
índice inteiro — nome, tamanho e token servível — de toda pasta que o operador
já concedeu. Os
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
a superfície da ponte mudar**. Hoje vale **44** — a v5.298 ENCOLHE a forma do
`espelhoEstado`: cada tela perdeu os seis campos de CAPACIDADE do relato
(`seguro`, `mse`, `mms`, `fetchStream`, `videoDecoder`, `wakeLock`). Eles eram o
autorrelato que o `espelho/cliente.js` mandava na era dos pixels; aquele arquivo
saiu na v5.187 e nenhum produtor os emite desde então — o `espelho/tela.js`
manda `{ua, w, h}` e mais nada. Como `optBoolean` lê ausente como `false`, um
valor legítimo, o servidor publicava seis negativas sobre TODA tela conectada, a
cada leitura. O consumidor delas saiu na v5.206; o produtor é este degrau. É o
40 pelo outro lado do fio, com a mesma régua — e não há defeito visível hoje
(ninguém as lê), o que é exatamente por que o degrau importa: um produtor sem
consumidor é a armadilha de quem repuser a leitura amanhã e receber `false` como
se fosse medição. O anterior, **43** — a v5.234 acrescenta
`atualizacaoEstado`, os DOIS canais de atualização numa leitura só. Ele não
acrescenta poder nenhum (tudo o que devolve já existia, espalhado por
`otaPending`, `apkProcurar` e `otaDiag`); o que ele acrescenta é **coerência de
instante**, e o degrau é por isso: três promessas independentes chegam em três
momentos, e o diálogo se desenhava com metade do que tinha a dizer ("há uma base
nova") para se corrigir meio segundo depois ("…e um APK junto"), debaixo do dedo
de quem estava lendo. Ele é também o que torna a detecção agressiva possível sem
estourar nada — o bloco `shell` vem do MANIFESTO do canal OTA, que é um asset de
release e **não consome o limite de 60 requisições/hora da API do GitHub**, ao
contrário de uma consulta por ronda. Num shell 42 o `controle.js` cai nas três
chamadas antigas e mostra a mesma pergunta, só sem a coerência de instante. O
anterior, **42** — a v5.231 acrescenta o campo
**`actions`** ao `nowPlaying`: a lista de botões da notificação de controles, na
ordem, escolhida pelo LADO WEB. É a invariante 5 aplicada ao cartão — cinco
botões fixos serviam a UMA cena (mídia tocando), e com um cronômetro no ar sem
louvor nenhum o play/pause e ⏮/⏭ ocupavam o modo compacto sem ter o que fazer.
O degrau é obrigatório porque o campo muda o que o cartão MOSTRA, e a degradação
é dupla: bundle antigo em shell 42 manda a lista vazia e recebe os cinco de
sempre; bundle novo em shell 41 tem o campo ignorado pelo `optJSONArray` e
também fica com os cinco. O anterior, **41** — a v5.228 acrescenta
`ytCanalPlaylists` e `ytPlaylist`, as SÉRIES da Biblioteca (ver a seção do
recurso). Os dois são TRANSPORTE, e a divisão de trabalho é o ponto: eles
devolvem o que o canal publica, verbatim e na ordem dele, sem opinião nenhuma
sobre o que presta — quem decide qual playlist é da série, qual é a versão em
LIBRAS e como o item se chama é `assets/web/controle/serie.js`. É a invariante 5
com uma razão prática medida: a nomenclatura de um canal muda sem avisar (as
playlists do `@provaievedeoficial` não são consistentes nem entre si — uma delas
não tem o hífen que todas as outras têm), e cada ajuste dessa regra custaria um
degrau daqui e uma Release se ela morasse em Kotlin. O anterior, **40** — a
v5.206 ENCOLHE duas formas
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
trabalho é a **main thread**. A razão ORIGINAL disso morreu e a regra ficou com
outra: até a v5.187 o espelho abria uma `MirrorPresentation`, e uma
`Presentation` é um `Dialog` — um `Dialog` criado na fila de IO (uma `Thread`
daemon sem `Looper`) lança `Can't create handler inside thread that has not
called Looper.prepare()` no primeiro toque. Não há mais janela nenhuma ali; o
que sustenta a main thread hoje é a frase anterior (ficar FORA da fila de IO) e
a serialização de `espelhoSrv`/`espelhoMidia`, que são escritos no `startMirror`
e lidos no `mirrorState`. Ver o KDoc de `MainActivity.startMirror`. A v5.136 acrescentou
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
`assets/web/controle/serie.js` guarda `{ canal, prefixo, ano, periodo, titulo }`,
e uma linha a mais dá uma série nova sem código novo. São **duas** (v5.244):

| Série | Canal | Playlists | Título do vídeo |
|---|---|---|---|
| **Provai e Vede 2026** | [@provaievedeoficial](https://www.youtube.com/@provaievedeoficial) | por MÊS — "Provai e Vede - Agosto 2026" | nome do episódio à ESQUERDA da barra |
| **Informativo Mundial das Missões 2026** | [@daniellocutor](https://www.youtube.com/@daniellocutor) | por TRIMESTRE — "Informativo \| 3º Trimestre 2026" | **não há** nome de episódio: "Informativo Mundial das Missões \| 15 AGOSTO 2026" |

```
 canal @provaievedeoficial          celular                    Biblioteca
 ┌──────────────────────┐   ytCanalPlaylists   ┌───────────┐   ┌──────────────┐
 │ aba Playlists        │────────────────────► │ serie.js  │──►│ card da série│
 │  · Set 2026 (Libras) │                      │  a REGRA  │   │ 52 episódios │
 │  · Set 2026          │   ytPlaylist(url)    │  (PURA)   │   │ 15/Ago · …   │
 │  · Ago 2026 ← s/hífen│────────────────────► │           │   └──────────────┘
 └──────────────────────┘                      └───────────┘   syncCollection
```

**A SEGUNDA SÉRIE PROVOU O CATÁLOGO E COBROU O PREÇO.** Ela entrou com uma linha
e nenhum `if` por recurso — e desmentiu três coisas que só pareciam regras
porque havia uma série só. Duas viraram **campo declarado** (`periodo` e
`titulo`, com padrão igual ao comportamento antigo, e escritos também na linha
do Provai e Vede: enquanto havia uma série, aquelas escolhas não pareciam
escolhas) e a terceira virou **recusa global** (o idioma). O que NÃO virou campo
é tão importante quanto: a data por extenso do Informativo ("15 AGOSTO 2026") já
era lida pela regra da v5.230 sem uma linha nova — a leitura natural, diante de
um canal novo, é supor que ele precisa de um ramo novo, e supor formato foi
justamente o erro que a v5.230 corrigiu.

**O MÊS DE UM ITEM VEM SEMPRE DA DATA DO TÍTULO, nunca da playlist.** Com
playlists mensais os dois quase sempre concordam, e por isso a distinção não
aparecia; com um trimestre ela é a diferença entre 13 episódios ordenados e 13
episódios amontoados em julho. `mesDaPlaylist` devolve **o mês em que o período
começa**, e esse valor tem dois usos, os dois honestos: ordenar as playlists
entre si, e ser o PISO de um vídeo que não declare data — que cai no começo do
trimestre dele, a coisa mais precisa que se pode afirmar sobre ele.

**A divisão de trabalho é a decisão central, e é a invariante 5.** O shell
entrega listas cruas — os dois métodos novos não olham para o conteúdo, e o
título do vídeo sai **sem** o `tituloLimpo` que a busca aplica, porque é dele
que a regra tira a data e a marca de Libras. Quem decide é o lado web, e a razão
é prática: a nomenclatura de um canal muda sem avisar ninguém, e ali um ajuste
chega por OTA em minutos, com oráculo em Node — em Kotlin custaria um degrau de
`SHELL_VERSION` e uma Release por vírgula.

### A regra, e as sete armadilhas que ela carrega

Nenhuma é hipótese: todas foram lidas nas abas Playlists e Vídeos dos canais.

1. **O hífen não é garantido.** As playlists são "Provai e Vede - Agosto 2026",
   e **uma delas é "Provai e Vede Agosto 2026"**. Um `^Provai e Vede - ` teria
   descartado o mês inteiro, sem erro nenhum. Por isso a regra não casa
   separador: pede o prefixo no começo e procura mês e ano **em qualquer
   posição** — o hífen é opcional por construção, não por um `?` no lugar certo.
2. **Espaço duplo** ("Provai e Vede␣␣2026 (15/Ago)"). Tudo passa por `normalizar`.
3. **O marcador de LIBRAS muda de forma entre os níveis:** `(Libras)` na
   playlist, `- Libras` no vídeo. O teste é pela **palavra**, sem acento e sem
   caixa — testar qualquer uma das duas formas literais deixaria a outra passar.
4. **A duração não separa nada:** 4:54 × 4:55 num par, 5:07 × 5:07 noutro.
5. **O `uploaderName` não é o canal:** os vídeos vêm como "Provai e Vede |
   Oficial **e Adventist…**" (colaboração). Filtrar por ele derrubaria tudo.
6. **A DATA tem DUAS formas, e o mesmo episódio usa as duas** (v5.230). A
   compacta entre parênteses — "… 2026 (03/Jan)" — e a **por extenso**: "Não há
   órfãos de Deus | Provai e Vede 2026 **sábado 3 janeiro**". No dia 3 de
   janeiro de 2026 a versão em Libras saiu na primeira e a de português na
   segunda. `dataDoVideo` tenta as duas, nessa ordem; a extensa aceita o "de"
   opcional e o ordinal ("1º"), e exige que o nome **seja** um mês em vez de só
   começar como um — sem essa última guarda, "3 marcos" viraria 3 de março.
7. **UM CANAL PUBLICA A MESMA SÉRIE EM VÁRIOS IDIOMAS** (v5.244). A aba do
   @daniellocutor põe os quatro lado a lado: "Informativo | 3º Trimestre 2026",
   "Misiones | 3º Trimestre 2026", "Mission Stories | 2º Quarter 2026" e
   "【聖工消息】2026 第三季". O prefixo separa as **playlists** — e **não separa
   os vídeos**: em espanhol eles se chamam "Informativo Mundial **de las
   Misiones**", isto é, começam com a mesma palavra. Daí `ehOutroIdioma`, irmão
   do `ehLibras`, nos dois níveis: pela ESCRITA (cirílico, hebraico, árabe,
   tailandês, CJK, hangul — um caractere basta, porque "【聖工消息】" não tem
   sílaba que dê para procurar; emoji ficam de fora de propósito) e por MARCA
   (espanhol `misiones`/`mision`/`de las`, francês `missionnaire`, e o inglês
   pelo NOME DO PROGRAMA — "Mission Stories", "World Mission", "Mission
   Spotlight"), tudo contra o `normalizar`, que já tirou os acentos.
   **O inglês era a palavra solta `mission` e isso custou um episódio** (v5.252,
   "Mission Refocus"): uma marca de idioma tem de ser IMPOSSÍVEL na língua que
   se quer manter, não apenas típica da que se quer recusar.

O que a sexta ensina não é "existem duas formas": é que **supor UMA forma era a
aposta errada desde o começo**, e é justamente por a regra de ouro deste arquivo
já valer (o título é só rótulo) que o episódio entrou no álbum mesmo assim. O
preço de errar a data é o que o operador relatou — um item sem identificador de
data, fora de ordem, no fim de janeiro —, não um episódio ausente.

**E a sétima é a exceção declarada à regra de ouro:** ela recusa pelo TÍTULO,
contra tudo o que a regra de ouro diz. Está lá porque o erro que ela evita não é
recuperável no sábado de manhã — é o testemunho projetado em espanhol, ou com o
intérprete na tela, na frente de todo mundo. O preço é conhecido e está escrito
no código: um episódio em português que CITE "mission" ou "misiones" no título é
recusado, e volta à mão pela busca do YouTube.

**O ÁUDIO em português é outra pergunta, e ela é do SHELL.** O YouTube dubla
vídeo sozinho, e a dublagem não muda o título: ela é uma faixa a mais dentro do
MESMO vídeo. Quem escolhe é `TrilhaAudio.kt` (v5.242) — idioma antes do cliente,
e português EXCLUSIVO quando existe. Nada do lado web tem como ver isso, e por
isso nada em `serie.js` tenta: as duas metades da garantia moram em lados
diferentes da ponte, e o Registro imprime a trilha escolhida
(`140@VISIONOS pt-BR`) justamente para a metade de baixo ser diagnosticável.

### As decisões que precisam estar ditas

- **A descoberta é a ABA DO CANAL, não uma busca por texto.** É uma diferença
  de AUTORIDADE: numa busca quem escolhe o resultado é o ranking do YouTube, e
  qualquer pessoa pode nomear uma playlist "Provai e Vede 2026". Vindo do canal
  — o publicador —, o pior caso é uma playlist a menos, nunca o vídeo de um
  desconhecido na projeção do culto.
- **A PLAYLIST prova o pertencimento; o título é só RÓTULO.** Um vídeo entra
  por estar numa playlist aceita, jamais por casar um padrão de título. A data
  `(15/Ago)` ordena e nomeia, e quando ela não casa o vídeo **entra do mesmo
  jeito**, com a ordem em que veio. Errar para o lado de um nome feio é
  recuperável; errar para o lado de um episódio ausente é o operador descobrindo
  no sábado que o vídeo do culto não está lá.
- **A recusa de Libras existe DUAS vezes, e a segunda nunca dispara hoje.** As
  playlists PT e Libras são espelhos 1:1, então a de português já vem só com
  português — mas um único vídeo acrescentado por engano na playlist oficial
  iria direto ao telão, e essa é a falha que não se pode correr por economia de
  três linhas.
- **O ano é EXPLÍCITO no catálogo.** "O ano corrente" faria o álbum trocar de
  conteúdo sozinho na virada de dezembro, no meio da programação de janeiro.
  2027 é uma linha nova e um push em `main`.
- **MAS ELE APARECE TRÊS DIAS ANTES** (v5.256, `DIAS_DE_ANTECEDENCIA`). Pedido
  do operador: *"a data de corte não pode ser o próprio dia, pois muitos
  aproveitam para fazer a organização antes"* — o roteiro do culto é montado
  durante a semana, e uma lista que só mostra o episódio no sábado de manhã
  chega tarde para quem prepara. Três dias é **a quarta-feira antes do sábado**,
  escrito como CONTAGEM e não como dia da semana (é o que sobrevive ao dia em
  que o canal publicar num domingo). **O preço tem remédio e ele é a outra
  metade do lote:** nesses três dias o vídeo pode ainda não estar público, e
  falhando o download a resposta diz o que fazer — *"ainda não liberado pelo
  canal — tente mais perto de 22/Ago"* —, em DOIS lugares, porque são dois
  fluxos: no cartão sobre a preview ("Tocar agora" fecha a Biblioteca) e no card
  da série (mandando ao Cronograma ela continua aberta por cima da preview).
  Sem a frase, aquela falha é indistinguível de uma queda de rede.
- **O QUE AINDA NÃO SAIU NÃO ENTRA NA LISTA** (v5.255, campo `futuros`). O
  @daniellocutor sobe o trimestre inteiro e libera um episódio por sábado; os
  que faltam ficam como "prioridade para membros" — aparecem na playlist e não
  tocam. A régua é a DATA (o único sinal deste lado: o item de um vídeo restrito
  chega idêntico ao de um liberado), o corte é INCLUSIVO no dia do culto, e um
  vídeo SEM data nunca é escondido. **É campo e não regra global** porque o erro
  é assimétrico e o Provai e Vede libera o mês inteiro de uma vez — medido: em
  15 de agosto ele já tinha até 26 de setembro, e aqueles episódios tocam. O DIA
  entra também na ASSINATURA das playlists, senão a economia devolveria a lista
  de ontem no sábado de manhã (o sintoma da v5.233 por outra porta).
- **O NOME DO ITEM pode ser SÓ A DATA, e no Informativo ele é** (v5.244). O
  título daquele canal é a série mais a data, e a história ("O Sonho de Enoc")
  vive na MINIATURA — aplicar ali o "o nome é o que vem antes da barra" daria 52
  linhas idênticas dizendo "Informativo Mundial das Missões", que é exatamente o
  defeito que aquela regra existe para corrigir, ao contrário. `titulo:
  'nenhum'` no catálogo, e a linha vira "15/Ago": numa lista anual a data é
  única, e é a pergunta inteira que aquele álbum responde. O que ela não diz —
  de que história é o episódio — a gaveta responde com a miniatura e a duração
  (v5.236). **`nomeDoItem` nunca devolve vazio**: sem data e sem título ele cai
  no título CRU do YouTube, que é feio e é longo, e é infinitamente melhor que
  uma linha em branco no meio da lista do culto.
- **A assinatura das playlists evita doze extrações por retomada.** A aba do
  canal já diz quantos vídeos cada playlist tem; batendo com o que está
  guardado, as ~12 chamadas de `ytPlaylist` são puladas. Um episódio novo muda a
  contagem e a assinatura inteira é refeita — "tudo ou nada" de propósito, para
  não guardar de qual playlist veio cada faixa.
- **E A REGRA ENTRA NESSA ASSINATURA** (`AVSerie.impressao`, v5.233). O índice
  guarda os nomes JÁ FORMADOS e a ordem JÁ decidida; a assinatura do canal não
  sabe nada sobre a regra que os produziu. Sem a impressão, mudar a regra deixa
  o índice guardado de pé para sempre — foi o que prendeu o episódio de 3 de
  janeiro sem data depois da v5.230, e nem limpar o cache resolvia (o índice
  mora no IndexedDB). Ela é um hash do PRÓPRIO CÓDIGO das funções que decidem,
  e não um número à mão: quem esquecesse de subir o número reproduziria o
  defeito.
- **O índice falha com EXCEÇÃO, nunca com lista vazia.** `syncCollection` já
  trata isso como "sem internet" e PRESERVA o índice anterior; devolver zero
  itens apagaria da tela a série inteira que o operador já tem baixada, por uma
  oscilação de rede.
- **`lyrics: null` no registro não é enfeite.** `songVariantsNeeded` pergunta
  `fullRec.lyrics === undefined` para decidir se a faixa falta — sem o campo, os
  52 episódios seriam rebaixados a cada sincronização, para sempre e em silêncio.
- **`aportuguesar` em todo extrator, e aqui ele não é cosmético.** No padrão
  en-GB da biblioteca o YouTube devolve o título TRADUZIDO: `(15/Ago)` viraria
  `(15/Aug)` e a marca de Libras mudaria de palavra — as duas coisas de que a
  regra depende. A paginação sai do MESMO extrator (`ex.getPage`), e não do
  `getMoreItems(service, …)`, que monta um extrator novo por dentro e nasceria
  sem o `forceLocalization`: os meses do fim da lista voltariam em inglês
  enquanto os do começo vêm em português.
- **UM EPISÓDIO É UM VÍDEO DO YOUTUBE, e a folha dele é a mesma** (v5.230,
  pedido do operador). A v5.228 tratou a série como coleção do LouvorJA porque
  é dali que a casca do card veio — e **naquele mundo o toque BAIXA**, o que é
  certo para uma faixa de hinário de poucos MB que existe para ficar offline.
  Aqui a premissa não vale: são ~300 MB por episódio e o vídeo do sábado é visto
  uma vez. `openSongMenu` desvia para `openYtMenu` antes de qualquer coisa, e
  com isso o episódio ganha de graça a **transmissão direta** no "Tocar agora" e
  o download só nos destinos que GUARDAM (playlist · Cronograma · Favoritos).
  A única diferença é `semSoAudio`: o seletor Vídeo × Só áudio some, porque um
  testemunho em vídeo não tem versão de áudio que faça sentido projetar — e uma
  escolha que não muda nada é pior que escolha nenhuma.
- **E A LINHA TAMBÉM É A DO VÍDEO** (v5.236). A v5.230 desviou as duas FOLHAS e
  parou ali: o toque na LINHA continuou abrindo o acordeão da LETRA, que
  anunciava "Letra ainda não baixada" para uma coisa que nunca vai ter letra —
  **desviar as portas de um recurso não desvia o que estava atrás delas**, que é
  a lição da v5.229 outra vez. Agora quem decide é o TIPO da coleção
  (`tipoDaColecao`, com as capacidades `temLetra` e `ehLink`), e a gaveta
  responde a mesma pergunta — *"é este mesmo?"* — com o que o item de fato tem:
  a **miniatura**, a duração e o estado no aparelho. Os dois primeiros o extrator
  já entregava e o índice descartava; o terceiro é o que decide, porque "Tocar
  agora" TRANSMITE e um episódio já guardado entra do disco.
- **A LETRA nunca é pedida para um vídeo** (v5.236). `syncLyrics` varria toda
  coleção com itens e pedia `music_<id>` ao LouvorJA — com um id que é do
  YouTube. Como falha de rede não grava `LYRIC_NONE` de propósito, eram ~52
  requisições perdidas **por abertura do app, para sempre**, infladas no total
  da notificação "Letras das músicas". A guarda é `temLetra(coll)`, nos dois
  consumidores (a fila e o índice da busca por trecho).
- **O card não baixa em lote, e o botão dele muda de verbo.** "Baixar" ali seria
  o download direto que o operador pediu para não existir, na maior escala que
  este app tem (~15 GB). O botão da barra some assim que HÁ índice — enquanto
  não há ele fica, porque ali ele não baixa nada, busca a lista —, o item de
  opções vira **"Atualizar a lista"** (`syncCollection(coll, { soIndice: true })`,
  que devolve logo depois do índice) e a série sai de "Baixar toda a
  biblioteca", peso incluído: um total que promete o que o botão não faz é a
  pior das duas metades.
- **O card não é desenhado abaixo do shell 41**, pela regra de sempre: um método
  novo não chega por OTA, e um card que não carrega nada é pior que card nenhum.

### O REGISTRO da varredura — o laço de manutenção, fechado (v5.249)

A regra decide a partir de NOMES que um canal muda sem avisar ninguém, e os dois
modos de errar são silenciosos **por construção**: uma playlist recusada some da
Biblioteca sem erro no console, e um vídeo aceito sem data entra fora de ordem.
O aparelho sabia as duas coisas no instante em que decidia — e as jogava fora.
Quem opera via o RESULTADO (uma lista) e nunca o CAMINHO, então *"está faltando
julho"* e *"julho veio com outro nome"* chegavam como a mesma frase.

O bloco **"Séries do YouTube (o que a regra achou)"** entra no Registro de
Configurações — mais um bloco da caixa que rola, levado pelo botão de copiar que
já existe — e diz, por série:

```
· Informativo Mundial das Missões 2026 — https://www.youtube.com/@daniellocutor
  prefixo "Informativo" · 2026 · playlists por trimestre · rótulo pela data
  aba do canal (há 2 min): 5 playlist(s), 2 aceita(s)
    - "Misiones | 3º Trimestre 2026" → não começa com "Informativo"
    + "Informativo | 3º Trimestre 2026" → mês 7 · 13 vídeo(s) no canal
  vídeos (varredura há 2 min): 14 vistos, 13 entraram, 1 recusado(s)
    - "Informativo Mundial de las Misiones | 15 AGOSTO 2026" → está em outro idioma
    ! 1 entrou(entraram) SEM data no título:
      "Informativo Mundial das Missões | especial de encerramento"
  nomes (13), na ordem em que a lista mostra:
    04/Jul
    …
```

As decisões, e nenhuma é enfeite:

- **O motivo sai de quem DECIDE.** `AVSerie.avaliarPlaylist`/`avaliarVideo`
  devolvem `{ mes, motivo }` e `{ motivo, data }`; `mesDaPlaylist` e
  `itensDaPlaylist` são consumidores delas. É a regra geral que este lote
  acrescentou ao projeto (ver "Regras de desenvolvimento").
- **A ORDEM das perguntas é o que o texto mostra**, e por isso ela virou
  contrato: uma playlist em espanhol do @daniellocutor sai como *"não começa com
  Informativo"* — o prefixo é a primeira pergunta e já a elimina —, e o motivo
  por IDIOMA fica para quem passa do prefixo, que é o caso dos VÍDEOS. O nome
  verbatim ao lado carrega o resto.
- **Ele guarda o nome CRU.** Um rótulo já formado ("15/Ago") prova que a regra
  rodou; só o título que entrou nela diz por que ela produziu aquilo — e é dele
  que sai o ajuste seguinte do `dataDoVideo`.
- **DUAS metades com datas próprias.** A aba do canal é lida em toda passada; as
  playlists, não — a assinatura pula as ~12 extrações quando nada mudou. Um
  carimbo só faria o bloco anunciar como "de agora" uma lista de vídeos de três
  dias atrás.
- **O que ENTROU sem data é um ACHADO, não uma recusa.** É a regra de ouro em
  ação (o vídeo entra), e é o sintoma exato que o operador relatou na v5.230 —
  um item sem identificador de data, fora de ordem. Ele é nomeado à parte, com
  o título cru, porque é a única coisa deste caminho que erra em silêncio **e**
  continua funcionando.
- **UM NOME POR LINHA.** Os dois separadores óbvios já são parte dos dados: o
  rótulo formado tem " · " no meio e o título cru — o que sobra quando não há
  data — tem " | ".
- **O diário VENCE o índice.** Um aparelho que já tinha a lista a tem "fresca"
  pelo TTL de 12 h, e passaria essas 12 h com o bloco dizendo "ainda não
  varrido" justamente enquanto o operador o procura (foi a atualização que o fez
  olhar). Um índice sem o carimbo `serieDiarioEm` conta como vencido —
  `indiceVencido`, uma varredura, uma vez —, e **o carimbo é escrito nos dois
  caminhos** do `fetchSerieIndex`, senão o canal seria extraído a cada abertura.
- **A metade do canal é gravada ANTES do primeiro `throw`.** "Nenhuma playlist
  no canal" é justamente o caso em que a pergunta "por quê?" mais importa, e
  gravar depois deixaria o Registro mudo exatamente ali.

### O tamanho, dito em vez de escondido

São ~52 episódios de ~5 min por ano, ~300 MB cada em 1080p: o ano inteiro passa
de 15 GB. O Informativo é metade disso (episódios de ~3 min), e metade de 15 GB
continua sendo mais do que cabe num toque desavisado. É por isso que **não
existe "baixar o álbum"** aqui — o uso normal é tocar o episódio do sábado, que
TRANSMITE sem baixar nada, e guardar um episódio offline é mandá-lo ao
Cronograma ou aos Favoritos pela folha, um a um.

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
sem `continue-on-error`) e treze testes **em Chromium de verdade**, em DOIS
PASSOS desde a v5.213 — `Preparar o Chromium` (o `npm i` e o
`playwright install`, com `continue-on-error`) e `Oráculos em Chromium`, que
depende do primeiro ter dado certo.

> **A separação é o que dá sentido ao `continue-on-error`, e ela nasceu de um
> defeito que o painel verde escondia.** Eles rodavam num passo só, com
> `set -euo pipefail`: o PRIMEIRO que reprovasse abortava os ONZE seguintes — e
> como o passo era `continue-on-error`, o run ficava verde. Descobrir isso
> exigia abrir o log e reparar em qual linha ele tinha parado. A justificativa
> do `continue-on-error` sempre foi INFRAESTRUTURA (download do Chromium, runner
> sem rede), e infraestrutura agora é o primeiro passo, sozinho; o segundo ficou
> com uma causa só de falhar, roda os doze SEMPRE (nenhum aborta o próximo),
> emite `::error::` por reprovado e escreve o placar (`N/M passaram`, os dois
> CONTADOS — eram doze quando este parágrafo foi escrito e são treze hoje) no
> **resumo do run**, onde se lê sem abrir log nenhum. `N` é CONTADO, nunca
> digitado: um número fixo ali envelheceria no primeiro oráculo novo — e
> envelheceria mentindo. O segundo passo SEGUE com `continue-on-error`, e isso é
> a política intacta e não esquecimento: barrar o canal OTA por um teste de
> navegador continua sendo trocar um risco raro por um bloqueio frequente. O que
> mudou é que agora essa escolha é uma linha só.

Os doze: a **fumaça** que sobe a base web e usa a tela
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
passaria) e **O FLUXO DE ATUALIZAÇÃO** (`ota.test.mjs`, v5.234 — o único
caminho do app cujo defeito NÃO TEM SINTOMA: quando a atualização não chega,
nada quebra e nada erra alto, e o operador só continua na versão de anteontem
sem saber. Foi assim por dezenas de versões, e a v5.151 chegou a REMOVER a
pergunta por concluir que ela "nunca aparecia" — era o espelho ligado
suprimindo o diálogo, e isso levou meses para ser identificado. Nenhum teste o
tocava: o `smoke` sobe sem ponte e todo o bloco é `window.__NATIVE__`, e o
`boot-nativo` prova o boot, não o fluxo. Ele afirma a pergunta nos dois casos —
com e sem Release —, o "Deixar para depois", o rótulo que continua marcando, e
a INTENÇÃO atravessando um `reload()` de verdade para virar a instalação do
APK).
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

A v5.228 acrescentou o **oráculo da SÉRIE** (`tools/serie.test.mjs`, Node puro,
**sem `continue-on-error`**): quais playlists de um canal formam o álbum e quais
vídeos entram nele. Os dois modos de errar são silenciosos e caros — aceitar
demais põe a versão em LIBRAS em par com a de português (o álbum dobra, com o
intérprete na projeção sem ninguém ter pedido) e aceitar de menos apaga um MÊS
inteiro da Biblioteca sem erro no console. **As entradas são VERBATIM do canal**,
incluindo a playlist que não tem o hífen que todas as outras têm: uma
nomenclatura imaginada prova só que o código concorda com quem o escreveu. O
percurso de ponta a ponta — canal → regra → card → lista ordenada — entrou no
`boot-nativo.test.mjs`, que é o único que sobe a base COM a ponte e por isso o
único capaz de exercitá-lo.

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

**A v5.242 acrescentou o quinto, e ele é de outra família:**
`TrilhaAudioTest.kt`, sobre `TrilhaAudio.kt` — **qual trilha de áudio vai ao
telão** quando o YouTube dubla o vídeo sozinho. Ele não guarda uma fronteira de
rede; guarda o defeito mais SILENCIOSO deste caminho: o download funciona, o
vídeo entra em cena, a barra anda — e o testemunho está em inglês, na frente da
congregação. O resto do `YoutubeGrab` é rede, biblioteca de terceiro e
`MediaMuxer`, e nada disso se testa sem aparelho; a REGRA que decide o idioma
cabe num arquivo puro, e é por isso que ela mora nele. Doze casos, em pares:
o que a regra passou a recusar **e** o que ela não pode ter passado a recusar
junto (um vídeo genuinamente estrangeiro continua tocando).

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
