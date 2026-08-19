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
a superfície da ponte mudar**. Hoje vale **43** — a v5.234 acrescenta
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

No PWA, um push em `main` chegava sozinho ao aparelho. Empacotada num APK, a
base web passaria a exigir baixar e instalar à mão a cada ajuste de JS/CSS —
o OTA devolve o comportamento antigo, com mais controle.

**Como funciona:** o job `web-ota` (em todo push para `main`) empacota
`assets/web/` num `web-<versão>.zip` e publica, junto com um `version.json`, na
release de tag fixa **`web-latest`** — URL estável, porque está compilada no
shell. O app consulta esse `version.json`, baixa quando há versão nova e passa a
servi-la. (O tamanho do zip sai no log do próprio job, no `echo "Bundle: …"` —
número no doc envelhece a cada push.)

### Os DOIS canais são UM evento (v5.234)

Eles eram independentes, e essa independência era a queixa: *"a detecção de
atualizações disponíveis é extremamente inconstante, demorada e quase
aleatória"*. Um lote que mexia no Kotlin chegava pela metade — base web em
minutos, APK quando o operador se lembrasse de ir ao GitHub — e o que ele via
era metade do lote funcionando, sem nada que explicasse a diferença.

```
 push em main            Release v2.0 publicada         aparelho
 ┌────────────┐          ┌────────────────────┐        ┌──────────────────┐
 │ version.json│ shellTag │ audio-visual…apk   │        │ ronda de 15 s    │
 │ "shellTag": │ ───────► │                    │ ─────► │ lê o MANIFESTO   │
 │   "v2.0"    │  SEGURA  └────────────────────┘ gatilho│  ├─ web  5.234   │
 └────────────┘  o OTA          release:published       │  └─ shell 2.0    │
                                                        │ → UMA pergunta   │
                                                        └──────────────────┘
```

**`shellTag` no `version.json` do repositório é o acoplamento.** Declarado, ele
faz o `web-ota` **segurar a publicação do bundle** até a Release existir — o job
termina verde e diz no resumo do run que está segurando, porque isso não é falha
e sim o estado normal entre o merge e o disparo da Release. Quando ela sai, o
gatilho `release: [published]` republica o bundle **com o bloco `shell`**
(versão, URL do `.apk` e tamanho) dentro do manifesto. Sem `shellTag`, o
manifesto ainda anuncia a Release mais recente que existir: `shellTag` responde
"este lote PRECISA de uma Release?", e uma correção só de Kotlin não a declara
em lugar nenhum — sem essa segunda metade, aquele APK nunca seria anunciado.

**E é o manifesto que permite a detecção ser rápida.** A API do GitHub não
autenticada dá **60 requisições por hora por IP**; uma ronda de 15 segundos são
240. Perguntar o APK à API na ronda esgotaria o limite em quinze minutos e a
detecção passaria a falhar com 403 pelo resto da hora — mais lenta e mais
imprevisível do que a de meia hora que existia antes. O manifesto é um asset de
release e **não consome limite nenhum**: a mesma requisição que já acontecia
responde as duas perguntas, e as responde no MESMO instante, que é o que permite
a tela falar de um lote em vez de dois eventos soltos.

**O zip passou a ter o nome versionado, e isso fecha uma classe inteira.** Ele
era `web-assets.zip`, substituído no lugar — e o comentário do `concurrency`
deste workflow já reconhecia o desfecho: duas execuções intercaladas deixam o
zip de uma com o `sha256` da outra, e a partir daí **todo aparelho baixa,
confere o hash, reprova, e o OTA fica INERTE até o próximo push**, sem sinal
nenhum. A fila reduzia a chance; ela não fechava a classe, porque nada impede a
fila de ser furada por um `retag` ou por uma execução que morra entre os dois
uploads. Com nome imutável por versão, um manifesto que fale da versão N sempre
encontra o zip da versão N — e o único arquivo substituído no lugar passa a ser
o manifesto, que é escrito por último. O job recolhe os zips antigos deixando os
**três mais novos**: apagar o que alguém está baixando devolveria um 404 no meio
do download.

**E o `sha256` reprovado virou FALHA, não desfecho.** Devolver `null` ali
carimbava a tentativa como bem-sucedida — `ultimoOk` renovado,
`falhasSeguidas` zerado, sem espera crescente —, então a ronda seguinte baixava
o mesmo zip, reprovava o mesmo hash e repetia, megabytes por minuto, para
sempre, com o app dizendo apenas "nada aconteceu". O nome versionado fecha a
causa; isto fecha o **modo de falhar**, que é o que precisa aguentar a próxima
causa que ninguém previu.

### A ATUALIZAÇÃO PERGUNTA de novo — e a v5.151 é revogada (v5.234)

A v5.151 tirou o diálogo e passou a aplicar sozinha. O diagnóstico dela estava
certo (a pergunta quase nunca aparecia) e o remédio era largo demais: trocar a
base recarrega as duas páginas e o telão pisca, e a hora disso é decisão de quem
está operando. O que este lote conserta é a CAUSA.

- **A pergunta é uma só, e fala do lote.** Sem Release: *"Base v5.234 — as duas
  telas recarregam e a projeção pisca por um instante."* Com Release: *"Base
  v5.234 e app v2.0 (30 MB) — a base entra primeiro e a projeção pisca; em
  seguida o Android vai pedir para confirmar a instalação do app."* Os dois
  desfechos são **Atualizar agora** e **Deixar para depois**.
- **A ordem é base → APK, e ela não é arbitrária.** A base é rápida (o bundle já
  está no disco) e não depende de ninguém confirmar nada; o APK exige um diálogo
  do sistema que pode ser recusado, adiado ou perdido. Se ele viesse antes, uma
  recusa ali deixaria o lote inteiro por aplicar.
- **A INTENÇÃO sobrevive à recarga.** Entre as duas metades há uma morte de
  documento — `otaApply` substitui a página —, então nada em memória atravessa
  esse ponto. A intenção é gravada no `state` do banco ANTES de aplicar (o mesmo
  lugar e o mesmo motivo da intenção de download do YouTube, v1.59) e relida na
  abertura seguinte, que retoma o download do APK sozinha. Ela é descartada
  quando o `versionName` instalado alcança a versão pedida — sem essa
  comparação o instalador reabriria a cada abertura oferecendo a versão que já
  está rodando — e depois de 6 h, porque um APK de ontem que ninguém instalou
  não é tarefa pendente.
- **A pergunta espera só o que ACABA: cena projetando e download em curso.** O
  **espelho não segura mais**, e era ele o elo que travava tudo — ele fica
  ligado o culto inteiro, então incluí-lo tornava a supressão permanente, e foi
  por isso que a v5.151 desistiu de perguntar. O espelho custa uma tela da rede
  com a página antiga em memória até ser recarregada; a cena e o download custam
  a projeção e o hinário pela metade. **Instalar o APK, esse sim, continua
  esperando os três** (`horaRuimParaAtualizar`), porque derruba o app inteiro e
  leva o servidor da rede junto.
- **"Deixar para depois" cala o diálogo, não o FATO.** O BOTÃO de atualização
  do rodapé de Configurações (`#otaRow`) passa a dizer, por extenso, o que está
  esperando — "Atualizar: base v5.245 e app v2.2" —, e tocá-lo aplica na hora.
  Um aviso que volta a cada dez segundos é ruído; um "não" que apaga a
  informação é pior. Até a v5.244 quem carregava esse fato era um PONTO no
  rótulo de versão, com o toque nele como caminho de volta; ele saiu na v5.245
  porque o botão diz a mesma coisa, é o alvo óbvio, e dois sinais para o mesmo
  fato a dois centímetros um do outro são a mesma informação dita duas vezes.
- **E UM TOQUE FORA DO DIÁLOGO NÃO RESPONDE POR ELE** (v5.245, `appDialogFixo`).
  O padrão do app é o do navegador — tocar no fundo cancela —, e para quase tudo
  ele está certo: é a saída barata de quem abriu a coisa errada. Esta pergunta
  aparece SOZINHA, no meio do que o operador estava fazendo, e um toque em
  qualquer lugar da tela a resolvia como "Deixar para depois", que a silencia
  pelo resto da sessão. O operador perdia a atualização por um gesto que nem
  sabia ter dado. O que NÃO muda: o "Deixar para depois" continua ali e o
  Esc/voltar continua valendo — os dois são a recusa DELIBERADA. O que deixa de
  existir é a recusa por acidente.
- **O Registro diz POR QUE está esperando**, e as causas pedem ações opostas:
  ninguém foi perguntado ainda, o operador adiou, a pergunta espera a cena sair,
  ou o shell recusou o bundle. Ele é lido a distância — um "esperando…" genérico
  manda quem o lê investigar a coisa errada.

Tudo isto tem oráculo: **`tools/ota.test.mjs`** sobe a base em Chromium com uma
ponte de mentira e afirma os cinco pontos acima, incluindo a intenção
atravessando um `reload()` de verdade. Ele reprova em 23 asserções contra o
código anterior (verificado).

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
2. **ronda periódica** de **15 s** com o app na frente (120 s em segundo plano)
   enquanto o processo viver;
3. **retomada do app** (`onResume`) — é quando o operador agiria sobre o aviso, e
   quando a rede costuma estar de volta. Ela vem com `forcar` e é a exceção que
   prova a regra do piso: é o único instante em que a resposta pode virar uma
   pergunta na tela, e chegar cinco segundos atrasada nela é chegar depois de o
   operador já ter olhado;
4. **a rede voltando** (`registerDefaultNetworkCallback`) — fecha o caso do
   lançamento sem internet.

Mais quatro peças, e nenhuma é enfeite:

- **Falha retenta sozinha**, com espera crescente (5 s → 10 → 20 → 30 s). "Sem
  rede agora" quase nunca significa "sem rede daqui a meio segundo", e o custo
  de perguntar de novo é um JSON. O teto era de 90 s, e ele era o pior lugar
  para ser generoso: acima de meio minuto a espera passa a durar MAIS que a
  ronda normal, e uma falha transitória sairia punindo a detecção — deixando-a
  mais lenta do que se ninguém tivesse tentado.
- **O piso entre consultas (5 s) é MENOR que a ronda**, e isto não é folga: com
  os dois em 15 s, uma batida que chegasse um milissegundo cedo era descartada
  e a seguinte só viria 15 s depois — a ronda valendo 15 s ou 30 s conforme o
  jitter do agendador. Um piso maior que a ronda é a receita exata da "detecção
  inconstante e quase aleatória".
- **A ronda é blindada contra exceção.** `scheduleWithFixedDelay` CANCELA todas
  as execuções seguintes quando o `Runnable` lança — sem log e sem `Future` que
  alguém consulte. O corpo do `checkAsync` já era protegido por dentro; o que
  roda antes de a thread nascer, não era. O preço de errar aqui é a detecção
  parar para sempre naquele aparelho, que é indistinguível de "o OTA não
  funciona".
- **Nada de cópia guardada.** O asset da release `web-latest` é SUBSTITUÍDO no
  lugar — mesma URL, conteúdo novo —, que é exatamente o caso em que um cache
  intermediário devolve o de ontem com toda a razão. Uma resposta guardada aqui
  não atrasa a atualização: ela a torna INVISÍVEL pelo tempo que o cache durar,
  sem sinal nenhum no aparelho. Daí os cabeçalhos `no-cache` **e** o `?t=` na
  URL (caches que ignoram o cabeçalho existem).
- **O shell EMPURRA** (`window.__avAtualizacao`, com `window.__avOta` ao lado
  para bundles anteriores ao shell 43) quando o estado muda: a pergunta aparece
  no segundo em que a resposta existe, em vez de esperar a enquete. E ele sai
  **também quando só o APK mudou** — uma Release pode ser publicada sem base web
  nova, e amarrar o aviso ao bundle deixaria justamente esse caso mudo. Num
  bundle antigo a função não existe e o empurrão é no-op; a enquete de 10 s
  continua sendo o piso.

**A comparação passou a ser contra o que o aparelho JÁ TEM, não contra o que ele
está SERVINDO** (`versaoJaTemos`). Enquanto a procura era uma por lançamento os
dois eram a mesma coisa; com a ronda, não — um bundle baixado fica esperando o
próximo lançamento, `currentVersion` continua sendo o da sessão, e a ronda
seguinte concluiria de novo que há versão nova, **rebaixando o mesmo zip a cada
cinco minutos** e apagando com `deleteRecursively` um diretório que o operador
pode ter acabado de mandar aplicar ao vivo.

E o operador tem como forçar: o **botão de atualização** do rodapé de
Configurações (`#otaRow`, v5.245) tem dois estados e nada mais — **"Procurar
atualização"** quando não há nada esperando, e **"Atualizar: …"** quando há. A
procura pula o piso entre consultas do shell (é o único chamador que o faz), e
as duas desfazem a recusa desta sessão, porque "Depois" silencia o aviso
automático, não quem voltou para pedir. Ele é o herdeiro da linha do APK
(v5.167), que só existia quando havia um APK novo e deixava a PROCURA num toque
escondido no próprio rótulo de versão — dois controles para uma conversa só. O Registro ganhou a linha **"Procura:"** (`otaDiag`), que diz
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

**A identidade do bundle é `assets/web/version.json`** (`version` + `minShell`
+ o `shellTag` opcional), versionado no repositório: o bundle carrega a própria
versão, seja ele o embutido ou o baixado. O workflow acrescenta `sha256`, a URL
e — quando há Release — o bloco `shell`. **Atualizar esse arquivo junto com os
outros dois lugares de versão** — ver "Regras de desenvolvimento" — é o que
dispara (ou não) uma atualização nos aparelhos.

**E `shellTag` é o que impede a metade do lote de chegar sozinha.** Mexeu no
shell? Declare a tag da Release que vai sair (`"shellTag": "v2.0"`) no mesmo
commit. O `web-ota` SEGURA o bundle até ela existir, e então publica com o link
do APK dentro — é isto que faz o aparelho perguntar uma vez sobre o lote inteiro
em vez de duas vezes sobre metades. A forma é validada no CI (`v` + números):
um `shellTag` malformado devolveria 404 na consulta, o job seguraria o OTA para
sempre, e o sintoma no aparelho seria "a atualização não chega" — o modo de
falhar mais mudo que este canal tem.

**O OTA não muda o acesso ao nativo.** A ponte é injetada no WebView pelo
Kotlin (`addJavascriptInterface`), não vem nos arquivos web: um bundle
baixado enxerga `__AVBridge` exatamente como o embutido, e o
`WebViewAssetLoader` serve os dois pelo mesmo origin — logo IndexedDB, OPFS,
SAF, Presentation e o serviço de segundo plano seguem idênticos.

### As três garantias (isto roda em culto)

1. ~~**Nunca troca a base no meio de uma sessão.**~~ **REVOGADA (v1.68 /
   v5.151) e depois SUBSTITUÍDA POR UMA PERGUNTA (v5.234).** A base nova não
   entra mais sozinha: o app AVISA e o operador escolhe entre "Atualizar agora"
   e "Deixar para depois" (ver "A ATUALIZAÇÃO PERGUNTA de novo", acima). A
   garantia original não voltou — quando o operador diz sim, a troca acontece na
   hora, com cena no ar ou sem —, mas ela deixou de ser automática, que era o
   ponto. Leia o resto deste item mesmo assim: ele explica por que a garantia
   existia, e o parágrafo final explica por que ela caiu.

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

**Regra de escrita:** toda guarda é `if (!window.__NATIVE__) { …web… }`, nunca
o inverso como caminho principal. O comportamento de navegador é o padrão; o
nativo é a exceção que se declara. Assim a base continua rodando nos dois
contextos.

| Ponto | Navegador | App nativo |
|---|---|---|
| Service workers (`sw.js`) | — | **o arquivo não existe no bundle e o registro saiu dos DOIS apps** (v5.48): os assets já são locais, e recarregar o WebView do telão no meio de um culto é justamente o que não pode acontecer. Atualizar a base é papel do OTA |
| `#startBtn` "Ligar Sistema" | destrava autoplay de terceiros | **oculto** — `mediaPlaybackRequiresUserGesture = false`; uma TV não recebe toque. **E oculto também no papel `tela`** (v5.216), pela razão OPOSTA: ali há política de gesto, mas o gesto é do "Ativar esta tela" do `tela.js` — este não pareia, não solta o som e não pede tela cheia, só se esconde, então gastá-lo é perder o único toque disponível. Quem o desliga é o `display.js`, pelo papel e em TODA carga: a regra morava no `montarEntrada()` do `tela.js`, que a recarga com sessão viva não chama, e um F5 trazia o botão de volta por cima da projeção |
| Recuperação de áudio bloqueado | segue tocando mudo + retentativas | **desativada já no `onBlocked`** — sem política de gesto, qualquer `NotAllowedError` só pode ser falso positivo, e mutar antes de descobrir isso deixava o telão sem som sem armar recuperação nenhuma |
| Pastas do dispositivo | `showDirectoryPicker()` | **SAF** — a File System Access API **não existe no Android**; este recurso era letra morta no celular e passa a funcionar |
| Compartilhamento | **não existe mais** — vinha do `share_target` do manifest com o POST interceptado pelo SW, e os dois saíram do bundle; a leitura remanescente do estado `pending-share` (que ninguém escrevia desde a v5.48) saiu na limpeza da auditoria de agosto/2026 | **`intent-filter` nativo** (`ShareIntake.kt`), que só aceita `content://` de outro app (ver abaixo) |
| Link do YouTube compartilhado | vira item de LINK, que só o app resolve | **no avançado, as MESMAS quatro escolhas da busca** (v5.137): a folha de tocar · playlist · Cronograma · Favoritos, com vídeo/só-áudio e o teto de resolução. As duas portas de entrada de um vídeo do YouTube passaram a dar no mesmo lugar — antes o share decidia sozinho: sempre vídeo, sempre no Cronograma, sempre no padrão de qualidade. **No simplificado não há pergunta e há TRANSMISSÃO DIRETA** (v5.138): ali o link compartilhado É um "tocar agora" — vai direto ao telão, não entra em lista visível nenhuma e ninguém pediu para guardar —, então ele passa por `tentarTransmitir` antes do download, como o "Tocar agora" do avançado. Uma folha com destinos que aquela tela não tem seria pior que folha nenhuma; esperar centenas de MB para começar a projetar era a espera que a transmissão existe para acabar. Falhando a transmissão, cai no download e, falhando ele, vira um item de LINK — que não é mais um player embutido e sim uma dívida a resolver no próximo toque (`resolverLinkYoutube`, v5.212): um link compartilhado nunca se perde |
| Destino de um item (acervo · YouTube · importação · share) | uma escolha por vez: a folha fechava no primeiro toque | **VÁRIOS destinos de uma vez** (v5.141), e desde a v5.253 por um MÉTODO ÚNICO: toda opção da folha — as três listas **e** o "Tocar agora" — é selecionável de CORPO INTEIRO, e um botão de confirmar sempre visível é quem executa. Até ali havia duas gramáticas na mesma linha (o corpo EXECUTAVA e fechava tudo; a caixinha de 20px na borda apenas marcava), e o confirmar só nascia depois da primeira marca — isto é, era invisível justamente para quem ainda não sabia que dava para marcar. Um vídeo do YouTube passa a ser baixado UMA vez para ir ao Cronograma e aos Favoritos (antes eram dois downloads de minutos, e o operador só descobria na segunda espera). A importação e o share de arquivo abrem a mesma folha como PERGUNTA, com o Cronograma já marcado; desistir dela entra no Cronograma, como sempre. Ver `docs/ARQUITETURA-WEB.md`, "UM item, VÁRIOS destinos" |
| Onde o share ATERRISSA | idem ao nativo (o caminho é o mesmo `importShare`) | **`focarImportado`** (v5.77): fecha os popups abertos e a seleção, e então **projeta na hora** no simplificado ou **vai para o Cronograma** no avançado — e no simplificado o item NÃO entra em lista visível nenhuma (v5.89: vai para a prateleira `avulsos`), porque aquela tela não tem Cronograma nem playlist. A preview em tela cheia só é encerrada se houver telão — sem ele, ela É a projeção |
| Estado do telão (rodapé de Configurações) | atalho `window.open('../display/')`, útil só para desenvolver | **indicador ao vivo** (desabilitado como botão) — a Presentation é criada sozinha |
| Botão de cast da preview | oculto | `AVNative.openCast()` → seletor de **espelhamento de tela** (ver abaixo) |
| Retomada do telão ao RECONECTAR | idem (o caminho é o mesmo `resendSceneToDisplay`) | **só reenvia o que ESTAVA no ar** (v5.142). `currentId` sobrevive de propósito ao stop e ao fim natural — é o que permite repetir a faixa com o ▶ —, e reenviar por ele fazia o telão acordar com um vídeo engatilhado que ninguém pediu (o retângulo cinza com o play) ou ressuscitar a música que já tinha acabado. Quem responde a pergunta certa é `midiaNoAr`; um telão vazio também é um estado, e restaurá-lo é não mandar nada |
| Girar a mídia | idem (o comando é o mesmo `rotate`) | **novo na v5.142**: vídeo gravado de lado chega DEITADO no telão e não havia o que fazer. Um botão em Configurações avança 90° por toque; o motor TROCA O EIXO da caixa antes de girar, para o `object-fit` fazer a conta no retângulo em que a mídia vai de fato aparecer. Tomou o lugar do "Esticar", que distorcia a proporção — o defeito que "Ajustar" e "Preencher" existem para evitar |
| Som da preview (a saída de áudio) | idem: com a janela do Display aberta ela é muda, sem ela toca — sujeito à política de autoplay do navegador, que faz o `onBlocked` devolvê-la ao mudo | **SEM TELA NENHUMA CONECTADA, O SOM SAI DESTE APARELHO** (v5.215, `acertarSaidaDeAudio`), e é OTA puro. A "mesa de som" MANUAL (v5.82–v5.188) foi removida na v5.189 com um argumento que continua inteiro — o som é dos DISPLAYS (a TV pela `Presentation`, as telas da rede pelo `<video>` delas), e os WebViews dividem o processo e a saída de áudio do Android, então o áudio da preview tomava o foco e INTERROMPIA o player do telão. O que ela não respondia é o caso em que **não há display nenhum**: ali a projeção É a preview em tela cheia, e uma projeção muda não é projeção. Agora não há interruptor a esquecer ligado — o estado é DERIVADO da conexão (`simpleDisplay`: a TV **ou** uma tela da rede) e só vale no modo avançado; com qualquer tela conectada este aparelho está mudo, sempre. O `keepAudioAlive` **não voltou**: áudio audível já isenta a página do estrangulamento |
| PDF, PowerPoint, Google Apresentações | **PDF não existe** (não há quem o desenhe); o `.pptx` funciona, e é o MESMO caminho do app | **viram UMA IMAGEM POR PÁGINA**, cada formato pelo caminho que existe para ele: o **PDF** pelo `PdfRenderer` da PLATAFORMA (`SlideDeck.kt` + `AVNative.deckPages`) — fidelidade total, zero dependência; o **`.pptx`** pelo renderizador de OOXML em `assets/web/vendor/` (`pptxParaPaginas`, em `controle.js`), carregado por `import()` dinâmico e rasterizado com `<foreignObject>` + canvas. Daí para a frente é mídia comum: fade, cortina, telão e `MediaSession` que já existem, com ⏮/⏭ passando página. **Não há botão de "apresentação"**: uma apresentação é um arquivo como outro qualquer, e entra pelo mesmo "Importar arquivos" (que no app abre o seletor do SISTEMA, `pickDoc` — o `<input type="file">` devolve bytes, e o PDF precisa que o shell abra o ARQUIVO) ou pelo compartilhamento. O `.ppt` anterior a 2007 e o `.odp` ficam de fora: ninguém sabe desenhá-los, e aceitar para depois falhar é pior que não aceitar. O link do Google entra sozinho pela URL de exportação |
| **Tocar agora** de um vídeo do YouTube | **não toca** — sem ponte não há transmissão nem download, e o app diz isso na linha do item | **TRANSMISSÃO DIRETA** (v5.120/shell 26; **funcionando só do shell 27 em diante**): o shell monta o manifesto das duas faixas adaptativas (`ytStream`), o `StreamProxy` as serve pelo NOSSO origin com o UA que combina com a URL, e o `MediaSource` de `shared/mse.js` as vira um `<video>` COMUM — fade, cortina, `MediaSession`, barra e segundo plano de graça, **e zero pixel de YouTube no telão**. Sem esperar o download. A faixa de bytes viaja na QUERY (`?r=<ini>-<fim>`), nunca no cabeçalho `Range` — ver a invariante 8, que é a razão de o recurso ter passado três versões sem tocar um único vídeo. Só em "Tocar agora": as outras três ações GUARDAM o item, e um manifesto expira em horas. Falhando qualquer coisa (shell < 27, vídeo sem par adaptativo, WebView sem o codec) cai no download, calado — o operador pediu o louvor, não o método |
| Vídeo do YouTube | **não toca** (ver acima) | **arquivo de vídeo baixado PELO APARELHO** (`YoutubeGrab.kt` + `AVNative.ytFetch`) — o embed pausa sozinho com o app minimizado, e a extração no próprio celular sai do IP do chip, que é o que o YouTube não bloqueia. Sem configurar nada. Cobalt continua como segunda opção para quem já mantém uma instância; falhando os dois, o link vira um item de LINK, que o toque seguinte tenta resolver de novo (v5.212 — não há mais player embutido para onde cair) |
| Qualidade do download | — | **o operador escolhe o teto** (1080p · 720p · 480p, v5.118/shell 25), no mesmo seletor de Vídeo/Só áudio da folha. Ele nasce no padrão A CADA ITEM, e isso é deliberado: um teto que grudasse faria quem escolheu 480p numa rede ruim receber, sem aviso, o vídeo principal do domingo seguinte em 480p no telão — o atrito de dois toques é visível, a regressão silenciosa não seria. Pedir 1080p continua saindo pelo `ytFetch` de sempre (nenhum shell novo exigido); só um teto MENOR usa o método novo. O progressivo respeita o teto, mas nunca ao ponto de não entregar nada: não cabendo nenhum, vale o menor que existir |
| Resolução do download | — | **até 1080p, montando as duas faixas** (v1.44; pares por contêiner na v1.45). Acima de 720p o YouTube só entrega vídeo SEM som, com o som à parte — e por isso o app baixava a pior cópia: só sabia pegar o progressivo, que neste aparelho é UM, de 360p. `MuxMp4.kt` junta as duas com o `MediaMuxer` da PLATAFORMA: é cópia de amostras, não recodificação, então não há perda nem espera. Teto de 1080p de propósito (o telão da igreja é 1080p) e só quando o resultado for melhor que o progressivo — senão dois downloads e um muxer entregariam o mesmo de antes. Os pares são do MESMO contêiner (mp4+m4a → MP4, webm+webm → WebM, este só na API 29+): "a melhor de cada lado" produziria VP9 dentro de MP4, que o muxer recusa depois de tudo baixado. Falhando qualquer etapa, o progressivo segue como piso. **Da v1.44 à v1.48 isso não saía do papel: as faixas eram listadas (1080p) e o CDN respondia 403 a todas** — com os dois pares, os dois perfis de UA e `Range`. Era o SABR, que o YouTube passou a exigir de quem pede sem PO Token. A saída não era montar o token (o `getWebClientPoToken` da biblioteca não tem uma única chamada em versão nenhuma, e o token do cliente Android — o que ela de fato consome — exige o DroidGuard do Play Services): foi **atualizar o extrator para a v0.26.4** (v1.49), que busca o cliente **visionOS** sem token nenhum e volta a entregar as adaptativas. Como as listas passaram a chegar MISTURADAS (visionOS + o cliente antigo), a escolha virou uma **fila de candidatos** — ver "O cliente visionOS destrava o 1080p" em `docs/ARQUITETURA-WEB.md`. **CONFIRMADO em aparelho:** `clientes VISIONOS 17, ANDROID 1 → juntou 1080p (mp4, 137@VISIONOS/V)`, sem uma única recusa na fila. Diagnóstico no rodapé de Configurações, agora com o itag, o cliente e o motivo de cada tentativa |
| **Só o ÁUDIO** em "Tocar agora" | **não toca** | **TRANSMITIDO também** (v5.130): o manifesto do shell já traz o par, e o lado web simplesmente DESCARTA a faixa de vídeo (`man.video = null`) — nenhum método novo, nenhum byte de 1080p baixado para ser jogado fora, e por isso chega por OTA. Entra como `kind: 'audio'` (o telão mantém o wallpaper) e o fallback, se a transmissão morrer, baixa a MESMA forma. O download de um m4a é rápido, mas "rápido" não é o pedido: o pedido é não esperar |
| **Só o ÁUDIO** guardado (playlist · Cronograma · Favoritos) | — | **`ytFetchAudio`** (v5.112, shell ≥ 23; **exige o APK v1.41+** — ver abaixo): a faixa de áudio, sem vídeo. A escolha é o MESMO seletor de Cantada/Playback das músicas, no topo da folha de destinos, e vale para as quatro ações. Entra como `kind: 'audio'` e **sem miniatura** — é o kind que faz o telão manter o wallpaper em vez de trocar de imagem. É também o único caminho em que o teto de 720p do progressivo não existe: o áudio do YouTube já vem em faixa separada, então aqui ele vem inteiro. **E é justamente por ser faixa separada que ele pode não vir**: adaptativo é o que o YouTube protegeu com SABR quando o app pedia sem PO Token. Daí a fila de tentativas do shell — que na v1.49 deixou de ser "m4a → qualquer outro → progressivo" e passou a ser **três candidatos de áudio na ordem do cliente que funciona** (visionOS primeiro), com o progressivo ainda no fim. **CONFIRMADO em aparelho:** `→ veio m4a 140@VISIONOS` (AAC-LC 128 kbps, primeiro candidato, primeira requisição) — até a v1.48 este caminho caía no vídeo de 360p inteiro. O registro entra como `kind: 'audio'` em todos os casos: quem decide que o telão não muda de imagem é o kind, não o container |
| **Séries do YouTube na Biblioteca** | **não existe** — sem ponte não há como enumerar playlist nem baixar vídeo | **um álbum por SÉRIE** (v5.228/shell 41), e são **duas** (v5.244): **Provai e Vede 2026** (`@provaievedeoficial`, playlists por MÊS) e **Informativo Mundial das Missões 2026** (`@daniellocutor`, playlists por TRIMESTRE). O canal é a ÚNICA constante: o app lê a **aba Playlists** dele (`ytCanalPlaylists`), aceita as que casam com "prefixo + ano" e **recusa as de LIBRAS**, expande cada uma (`ytPlaylist`) e ordena os episódios pela data do título — a faixa se chama "15/Ago · Quando o evangelho sussurra", porque o operador procura pelo sábado, não pelo nome do episódio. O card fica no topo da Biblioteca, no grupo **"Arquivos oficiais"** (v5.260, separado dos hinários a pedido do operador) — mas **o ITEM é um vídeo do YouTube, não uma faixa de hinário** (v5.230): o toque abre a MESMA folha do YouTube (sem "Só áudio"), o "Tocar agora" TRANSMITE sem baixar, e o download existe só nos destinos que guardam. E desde a v5.236 **a LINHA também sabe disso**: a gaveta que numa música abre a letra abre aqui a MINIATURA, a duração e o estado no aparelho — quem decide é o TIPO da coleção (`tipoDaColecao`), não um `if` por recurso. Não há "baixar o álbum": são ~300 MB por episódio. **A descoberta é pela ABA DO CANAL, nunca por busca de texto**: numa busca quem escolhe é o ranking do YouTube e qualquer pessoa pode nomear uma playlist "Provai e Vede 2026" — vindo do canal, o pior caso é uma playlist a menos, jamais o vídeo de um desconhecido na projeção. **E O IDIOMA É GARANTIDO NAS DUAS METADES** (v5.244): o @daniellocutor publica a mesma série em quatro idiomas e os vídeos em espanhol começam com a MESMA palavra dos em português, então `ehOutroIdioma` os recusa pela escrita e por marca — e o ÁUDIO, que é outra coisa (o YouTube dubla sozinho, dentro do mesmo vídeo), quem escolhe é o `TrilhaAudio.kt` do shell, que põe o português na frente do cliente e o torna exclusivo. A regra vive em `controle/serie.js` (PURA) com oráculo em Node (`tools/serie.test.mjs`) e o percurso inteiro no `boot-nativo.test.mjs`. Ver "Séries do YouTube", abaixo |
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
| Atualização da base web | recarregar a página | **OTA** — bundle publicado em `web-latest`, detectado em segundos e aplicado quando o operador responde ao aviso (ver seção acima) |
| Atualização do APP | — | **o próprio app baixa e instala** — o manifesto do OTA carrega o link da Release (`shellTag` segura o bundle até ela sair), então a pergunta é UMA e leva as duas metades; a instalação em si é o diálogo do Android, que é obrigatório e está certo que seja |
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
> emite `::error::` por reprovado e escreve o placar (`N/12 passaram`) no
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

**Versão atual: v5.297** (base web) · `SHELL_VERSION` **43**, e o bundle segue com
`minShell: 2` — ele funciona igual num shell antigo, só sem os recursos que são
nativos por construção (a escada do voltar, os botões de volume, a notificação de
controles), que **só chegam instalando o APK novo**, não pelo OTA.

> **A v5.297: NÃO HAVIA COR DE TEXTO QUE RESOLVESSE — o defeito era a
> SUPERFÍCIE, e a Biblioteca inteira estava em MAIÚSCULAS. OTA PURO** (CSS,
> tokens e oráculo; sem Release).
>
> Relato do operador depois da v5.296, com prints: *"não melhorou a leitura"*.
> Ele estava certo, e o lote anterior tinha consertado metade de um vazamento e
> tratado o sintoma errado do outro.
>
> **1. A LINHA DE CONTEÚDO SE AFASTA DO TEXTO.** A faixa vestia `--surface`, e
> recesso é uma regra sobre PROFUNDIDADE: no escuro ela afasta do texto claro,
> no CLARO ela empurra na direção dele. Medido, o fundo compunha
> rgb(182,187,194) — **~50% de luminância, o meio-tom exato**, que é o pior caso
> para os dois lados: `--text` dava 4,59:1 (passava AA e não se lia) e o branco
> que o operador pediu daria **1,93:1**. Não havia cor de texto que resolvesse.
>
> `--item-fill` é a regra escrita como token, com um valor por tema: no escuro
> segue o de sempre (nada muda), no claro a linha SOBE até quase o branco — que
> é o que uma lista de conteúdo faz em toda UI clara, com o cinza do card
> aparecendo entre as linhas. Medido depois: **8,32:1** com o texto e 1,32:1 de
> separação contra o card (piso 1,28).
>
> **A aritmética não deixava escolha, e é ela que também derrubou a gaveta.** A
> linha precisa de 1,28:1 contra o card, o que a força a ~0,91 de luminância —
> isto é, quase branco, não um meio-termo. E a gaveta de opções (v5.287), que
> tinha SUBIDO para o branco porque a vizinha era escura, ficou a **1,07:1**
> dela: o relato daquele lote reaberto pela porta oposta. Ela desce para um
> cinza de verdade (os dois pares que ela precisa satisfazer — contra a linha e
> contra o card — deixam L ≤ 0,53), e os botões dela sobem para o branco. **O
> oráculo da v5.287 pegou isso no mesmo commit**, que é a única razão de este
> lote não ter trocado um relato por outro.
>
> **2. E O QUE O OPERADOR DE FATO VIA: a Biblioteca INTEIRA em MAIÚSCULAS.** O
> vazamento da v5.296 era de `color`, e ela desceu só a cor, com o preço
> declarado na própria nota. `text-transform: uppercase` e `letter-spacing`
> herdam do mesmo bloco e **ninguém os reescreve lá dentro** — caixa alta a 13px
> é mais lenta de ler e mais larga, e era ela que truncava
> "001. SANTO, SANTO, SANTO! (CANTAD…" numa linha que cabia. A regra do rótulo
> foi INTEIRA para a `.coll-group-bar`, que é a peça que ela sempre descreveu.
> `font-size` e `font-weight` vêm junto porque a regra é uma só; quem muda de
> verdade é o nome de um favorito (`.row-name` não declara peso), que volta ao
> 400 das outras listas do app.
>
> **A lição, e ela é maior que este arquivo:** *declarar o preço de uma correção
> pela metade não é o mesmo que pagá-lo.* A v5.296 nomeou este vazamento no
> comentário e o deixou de pé por não ter sido pedido — e ele era metade do que
> o operador estava vendo.
>
> **O oráculo ganhou a REGRA, não um valor:** a linha que carrega o texto
> contrasta com ele MAIS que o contêiner dela. Ela vale nos dois temas sem um
> `if` de tema, e um recesso de volta a reprova no claro e passa no escuro — que
> é exatamente a assimetria do defeito. Verificado por ISOLAMENTO, peça a peça:
> o recesso de volta reprova **2**, o vazamento de tipografia **2**, a gaveta
> branca **1**.

> **A v5.296: O NOME DA FAIXA SAÍA NA COR DE UM CABEÇALHO — e no tema claro
> isso reprovava AA. OTA PURO** (só CSS e o oráculo; sem Release).
>
> Relato do operador: *"verifique a cor do texto dos itens dentro do álbum na
> biblioteca, pois no tema claro, o fundo dos cards está escuro mas acredito que
> nesse caso o texto deve ser claro, para ter o contraste ideal"*.
>
> **MEDIDO antes de mexer, no tema CLARO: 3,45:1.** O nome de uma faixa dentro
> de um álbum saía em `--muted` (#565d66) sobre o recesso da própria faixa
> (rgb(182,187,194)), a 13,12px — abaixo do piso de 4,5:1 para texto pequeno. No
> ESCURO o mesmo par dá 6,46:1, e é por isso que a queixa é de um tema só.
>
> **A causa é HERANÇA, e é a família da v5.274 por outra porta.** `.coll-group`
> é a regra do RÓTULO da seção — uma linha curta, em caixa alta, `--muted` — e
> desde que a seção virou o BLOCO que contém a barra e o corpo (v5.237) ela é o
> CONTÊINER de tudo o que a Biblioteca desenha. `color` herda: o `--muted` de um
> cabeçalho pintava o nome de toda faixa, de todo favorito e de toda pasta lá
> dentro. Era **o único lugar do app em que uma linha de lista não é `--text`**,
> e era invisível justamente por isso — não havia uma declaração errada a achar,
> havia uma declaração certa no elemento errado. A cor desce para a
> `.coll-group-bar`, que é a peça que ela sempre descreveu, e o corpo volta a
> herdar o `--text` da folha como qualquer outra lista.
>
> **E O REMÉDIO PEDIDO SERIA PIOR, MEDIDO.** O fundo não é escuro: é um
> MEIO-TOM (~50% de luminância, o pior caso para os dois lados). Branco sobre
> ele dá **1,93:1**, contra os **4,59:1** que o `--text` devolve. A percepção do
> operador estava certa — aquele texto não se lê —, e a leitura de que o fundo é
> escuro é o que a medição corrige: quem clareia aqui é o texto do tema, não uma
> exceção. É o oposto da v5.268, em que a superfície é que saía da escada.
>
> **O ORÁCULO ENTROU ONDE O BURACO ESTAVA.** Os casos da escada de camadas
> (v5.241/v5.267) mediam os FUNDOS da Biblioteca nos dois temas, e a escada
> estava — e continua — correta; **nenhum deles olhava para a COR DO TEXTO**, e
> foi por aí que isto atravessou. Agora eles medem o par, com o fundo COMPOSTO
> (a faixa é um overlay: `backgroundColor` devolve o alfa, e comparar o texto
> com um preto a 14% diria a mesma coisa com o defeito no lugar). A metade
> negativa é o que impede a correção de virar "tudo virou `--text`": o rótulo da
> seção continua com cor própria.
>
> Verificado por ISOLAMENTO: devolvendo a cor ao bloco, **3** asserções
> reprovam — e a do tema claro imprime o 3,45:1 do relato.
>
> **O QUE NÃO FOI MEXIDO, e está dito em vez de escondido:** a mesma regra
> vaza `letter-spacing` e `text-transform: uppercase` para o corpo, e ninguém os
> reescreve — o título do álbum e o nome da faixa são desenhados em MAIÚSCULAS
> por causa dela. Mexer nisso muda a aparência de toda a Biblioteca, que não é o
> que foi pedido. E o SUBTÍTULO de uma linha de favorito (`--muted` explícito,
> 10,88px) continua em **3,45:1** sobre o mesmo recesso, pelo mesmo motivo
> estrutural: `--muted` foi calibrado contra `--panel` (6,66:1) e `--panel-2`
> (4,73:1), nunca contra um recesso DENTRO do painel-2, que é a superfície mais
> funda da Biblioteca.

> **A v5.295: OS COMENTÁRIOS QUE DESCREVIAM A GAVETA COMO SE ELA EXISTISSE.
> OTA PURO** (nenhuma linha de código; sem Release).
>
> A faxina da v5.294 removeu a gaveta `#favPopup` e deixou de pé quatro
> comentários que continuavam falando dela **no presente**: o bloco do
> `index.html` que explicava que *"o `activeTab` CONTINUA sendo `'folders'`
> enquanto ela está aberta"* e mandava ver `listHost()`, a nota do
> `renderListTitle` que apontava para um `renderFavHeader` que não existe mais,
> e a lápide do `openOpfsFolder` que remetia a outra lápide (`openFavorites`)
> que também tinha saído. Mais os carimbos de versão: as lápides diziam v5.293,
> e a faxina saiu na v5.294 — o número de um lote que fez outra coisa.
>
> **Isto é um defeito pela régua deste projeto, e é a mesma da v5.212:** um
> comentário que contradiz o código não é ruído, é uma armadilha — ele descreve
> um mecanismo plausível, e quem o ler depois vai procurar (ou reintroduzir) o
> que ele promete. Aqui o preço seria concreto: o do `index.html` manda ler uma
> função apagada para entender onde a lista é desenhada.
>
> **E o lote é um NÚMERO NOVO, não um republicar do 5.294**, de propósito. O
> zip do canal OTA é **imutável por versão** desde a v5.234 — foi essa
> imutabilidade que fechou a classe inteira de "o manifesto fala de um zip com
> outro `sha256` e o OTA fica inerte". Reescrever `web-5.294.zip` no lugar
> reabriria exatamente essa janela para um aparelho que tivesse lido o manifesto
> anterior. Um número novo custa uma pergunta a mais na tela; o outro caminho
> custa a classe de defeito de volta.

> **A v5.294 (v2.2): A ABA `folders` SAI POR INTEIRO, e a fila de IO da ponte
> vira TRÊS. METADE OTA, METADE APK** (a fila é Kotlin — sem a Release ela não
> chega ao aparelho).
>
> Os dois lotes que o operador escolheu depois da revisão profunda. Eles não se
> tocam, e vieram juntos por serem os dois que sobraram dela.
>
> **1. A FAXINA DA ABA `folders`.** A v5.290 fez a pasta do aparelho abrir
> INLINE, dentro da linha, e com isso a gaveta de tela cheia (`#favPopup`) ficou
> **sem porta**: `openFavorites` deixou de ter chamador e `currentFolder` nunca
> mais recebeu um valor não-nulo — as únicas atribuições que sobraram eram
> `= null`. A nota da v5.290 declarou isso e deixou o subsistema de pé, com o
> argumento (correto) de que a faxina merecia a própria passada de verificação.
> Esta é ela.
>
> Saíram ~170 linhas: o popup `#favPopup` e o `#favList` do documento,
> `renderFavHeader`, `garantirGaveta`, `openFavorites`, `closeFavorites`,
> `favVoltarPara`, `folderQuery`, `currentFolder`, `listHost()` (as duas casas
> viraram uma — `libraryEl`), o `hostSelbar` de duas casas, a entrada da tabela
> `POPUPS`, o degrau 1.5 da escada do voltar, e **todos** os ramos de
> `activeTab === 'folders'` espalhados por `load`, `renderLibrary`,
> `renderTabs`, `scrollKey`, `deleteSelected`, `navigateBack`, `switchTab`,
> `temImport` e `addSongToDestinos`. `TAB_ORDER` ficou com três abas, que é o
> que o carrossel já percorria.
>
> **O PREÇO ESTÁ DITO, e o operador o aceitou explicitamente:** com a gaveta vão
> embora a **busca DENTRO de uma pasta** (`#libSearch` — e ela não tem
> substituto, porque a barra da Biblioteca varre `allCollections()`, que não
> alcança o catálogo de pastas) e a **seleção múltipla** dentro de uma pasta,
> que era onde morava o excluir de ARQUIVO FÍSICO por item. A segunda é menos
> perda do que parece: um arquivo apagado de uma pasta sincronizada volta na
> varredura seguinte, e quem apaga de verdade é o "Excluir pasta e arquivos
> sincronizados" da própria linha.
>
> **E O ORÁCULO FINGIA O ESTADO IMPOSSÍVEL.** O caso do renomear escrevia
> `activeTab = 'folders'` e um `currentFolder` à mão para provar que o lápis não
> entra na pasta do aparelho — isto é, media o comportamento de um app que não
> existe desde a v5.290. Ele passou a abrir a pasta INLINE, como o operador
> abre, com fixture PRÓPRIO (`pg6` nasce depois dos casos da pasta, e depender do
> que outra página deixou no banco fazia a asserção medir **zero linha**, que é
> uma lista vazia passando por "não achei o lápis"). Verificado por ISOLAMENTO:
> pondo um `botaoRenomearDaLinha` incondicional no `linhaDeItem`, a asserção
> reprova. A asserção da gaveta mudou de pergunta junto — onde ela exigia "a
> gaveta continua desenhando a dela", ela passou a exigir que **não sobrou nó
> nenhum** do subsistema no documento, que é a forma forte da mesma pergunta.
>
> **2. A FILA DE IO DA PONTE VIRA TRÊS** (`NativeBridge`). Ela era
> `newSingleThreadExecutor`, e é dela que saem o download do YouTube (minutos),
> o download do APK (minutos), a busca no YouTube, as playlists de um canal, o
> manifesto da transmissão, a rasterização de um PDF **e** `listFolder`,
> `otaPending`, `otaDiag`, `atualizacaoEstado`, `apkProcurar`.
>
> Uma thread só para tudo isso significa que, com um vídeo de 300 MB baixando,
> **toda a outra metade da ponte vence pelo prazo**: o `native.js` desiste em
> 60 s (`CALL_TIMEOUT_MS`) e resolve `null`. Nenhuma delas ERRA — todas mentem
> baixinho: `otaPending` diz que não há atualização, `atualizacaoEstado` não
> responde nada, e o pior, `listFolder` devolve lista vazia, que o `controle.js`
> lê como *"a pasta sumiu do aparelho"*. É o modo de falhar que este projeto
> mais teme, num lugar onde ninguém tinha olhado.
>
> As três, e a divisão é por ORDEM DE GRANDEZA do trabalho:
>
> | fila | o quê | duração |
> |---|---|---|
> | `av-bridge-io` | `version.json`, estado do OTA, `listFolder` | milissegundos |
> | `av-bridge-transf` | download do YouTube, download do APK, `ytDiscard` | minutos |
> | `av-bridge-extr` | busca, playlists, manifesto, `deckPages` | segundos |
>
> **Cada uma continua sendo UMA THREAD, e isso é invariante e não economia.** O
> resgate de download do `YoutubeGrab` é um slot ÚNICO e o mapa de parciais supõe
> **um download por vez** — dois comentários daquele arquivo citam a fila única
> da ponte como a garantia disso, e é por isso que `ytDiscard` mora na fila da
> transferência: ele mexe nesse mesmo estado, e fora dali poderia apagar o
> parcial de um download em curso. As extrações são serializadas entre si pela
> mesma razão prática: elas dividem a inicialização global do NewPipe.
>
> **E `garantirInit` virou `@Synchronized`.** O par "testa `pronto`, então
> inicializa" não é atômico, e agora há DUAS threads que podem chegar ali ao
> mesmo tempo — a da transferência e a da extração. `NewPipe.init` duas vezes
> provavelmente não faria mal; "provavelmente" não é o que se quer de uma
> inicialização global.
>
> **O que NÃO colide, conferido campo a campo:** `diagnostico` é escrito só pelo
> caminho do download e `diagnosticoStream` só pelo do manifesto (é justamente
> por isso que eles são dois campos); `adaptativoBloqueadoEm`, `baixandoLink`,
> `cancelarLink`, `resgate` e `parciais` vivem inteiros no caminho do download;
> os registros de token do `StreamProxy` já são `ConcurrentHashMap`; e o
> `NpDownloader` é sem estado. `ytCancel` continua **fora de fila nenhuma**, pelo
> motivo de sempre — a fila que ele quer parar é justamente a que está ocupada.
>
> `SHELL_VERSION` **não sobe**: nenhum método da ponte nasceu, saiu ou mudou de
> assinatura, e nenhum retorno mudou de forma. O que muda é quando eles
> respondem.

> **A v5.293: A REVISÃO PROFUNDA — doze defeitos, e dois deles tinham derrubado
> um recurso inteiro em silêncio. METADE OTA, METADE APK** (as duas correções
> Kotlin exigem uma Release; as dez de base web chegam sozinhas e não dependem
> delas).
>
> Uma varredura do repositório inteiro pedida pelo operador — *"bugs, código
> morto, otimizações e padronizações… e a questão funcional por falhas de
> conceito"*, com o aviso que governou o método: **confie no código, não na
> documentação**. E foi literal: três dos achados abaixo são comentários que
> descrevem um mecanismo que o código não tem mais.
>
> **OS DOIS QUE APAGARAM UM RECURSO, e os dois pelo mesmo modo de falhar:** o
> app continuava respondendo, nada errava alto, e o que sumiu foi um caminho
> que não se usa todo dia.
>
> - **`ReferenceError` mudo em TODO toque numa linha do Cronograma.** A v5.287
>   tirou o parâmetro `semSelecao` de `attachRowGestures` e deixou o
>   `if (semSelecao) return` no corpo. Num script clássico, LER um identificador
>   não declarado lança — só a atribuição criaria uma global. O `pointerdown`
>   estourava ANTES de armar o `setTimeout`, e com ele foram embora o toque
>   longo, a **seleção múltipla** e o `deleteSelected`, que é o único excluir em
>   lote do app. O toque CURTO continuava projetando (o `pid` já tinha sido
>   escrito na linha acima), então nada na tela mudava. Medido em Chromium:
>   `Uncaught ReferenceError: semSelecao is not defined`, `selectionMode` nunca
>   liga. **`eslint --rule no-undef` sobre a base inteira devolve exatamente UM
>   erro**, e era este — vale como portão barato para a próxima vez.
> - **A gaveta `⋮` da FILA DA PLAYLIST nunca ficava visível.** As três regras que
>   revelam a faixa eram `.lib-item.acoes-abertas …`, e a linha da fila é
>   `.row-item`. Como a v5.285 tirou o arrasto e moveu o "Tirar da playlist" e o
>   par ↑↓ para DENTRO dessa faixa, a fila do culto ficou sem como ser editada
>   nem reordenada: o `⋮` respondia (a classe entrava no `li`) e nada aparecia.
>   Medido: `visibility: hidden` e o `elementFromPoint` no meio da faixa
>   devolvendo o TÍTULO da linha. **Quem revela a gaveta passa a ser a CLASSE,
>   não a lista em que a linha por acaso mora** — assim a próxima lista que
>   ganhar a gaveta já nasce funcionando, que é exatamente o que faltou aqui.
>
> **A CAMADA DE TEXTO, em três frentes.** (1) `cenaDeRoteiroNoAr()` testava a
> EXISTÊNCIA da sessão, e os quatro `hide*` existem justamente para tirar da tela
> SEM matá-la: depois de "Tirar do telão" a linha da cena seguia com o selo
> "● No ar" e o toque nela caía em `retirarDoAr` — reprojetar custava dois
> toques, e o primeiro não fazia nada visível. (2) Cada projetor limpava as
> outras camadas à mão e a conta não fechava: **ninguém limpava a letra avulsa**,
> e como `lyricProjecting()` tem precedência no `slideTarget` e no
> `renderNowPlaying`, uma `lyricSession` órfã sequestrava ⏮/⏭ e o título da
> notificação de mídia. Agora há `soUmProvedorDeTexto(quem)`: cinco listas
> mantidas à mão eram cinco lugares para a sexta camada ser esquecida. (3) **A
> cortina do wallpaper ENGOLIA o cartão** — o stage reavalia a cortina em três
> pontos que não sabiam dele (o fim natural da mídia, o `play()` e o fim de um
> `load`), e o wallpaper está ACIMA do texto. O caso é o que a independência
> áudio × texto existe para permitir: um louvor de fundo com a contagem
> regressiva por cima. A música acabava e o cronômetro sumia, com `textActive`
> ainda true e a lista ainda dizendo "● No ar". O remendo que existia era
> pontual; agora o stage tem `setOverlay`, declarado por quem põe o cartão no ar.
>
> **E o resto, em uma linha cada:**
>
> - **`mse.js`**: o seek do `startAt` era DESCARTADO quando o índice da faixa
>   ainda não tinha chegado (`aoBuscar` começa com `if (!f.segs) return`, e o
>   `loadedmetadata` da MSE dispara com o áudio ainda sem `segs`). O vídeo
>   reposicionava e o áudio baixava do segundo ZERO — a projeção ficava parada
>   até ele percorrer o trecho inteiro. Morde no caminho mais caro que existe: a
>   reconexão do telão e a aplicação de um OTA com a cena no ar.
> - **`stage.js`**: parar um ÁUDIO SEM LETRA cortava o som no talo. A rampa de
>   volume vivia dentro da animação da cortina, e para esse tipo a cortina já
>   está fechada o tempo todo (`semVisual`) — `coverIn` devolvia na hora e o
>   `clear()` cortava. É o defeito que só se ouve: nenhum pixel muda.
> - **A rolagem**: `load()` restaurava `scrollPos` em TODO redesenho, e o único
>   produtor daquele mapa é a troca de aba. Acrescentar um item, favoritar ou o
>   progresso de um download jogavam a lista de volta para o topo. Agora só a
>   NAVEGAÇÃO restaura; um redesenho no lugar mantém o lugar.
> - **As miniaturas da Biblioteca** eram criadas no balde de `object-URL` de
>   OUTRO host e o `renderLibrary` seguinte (que roda a cada 400 ms durante um
>   download) as revogava EM CENA.
> - **O funil de destinos** redesenhava favoritos e playlist e deixava o
>   Cronograma por conta do chamador — dos dois que existem, só um lembrava.
> - **O timer da procura de atualização** apagava o "Deixar para depois" e o
>   diálogo modal reabria sozinho oito segundos depois.
> - **`bibleGotoChapter`** é o outro ponto que escreve `bibleChapterData` e não
>   fazia nada do que `changeBibleVersion` documenta como obrigatório.
> - **O preset de sorteio** reescrevia `kind`/`min`/`max`/`pool` sem zerar
>   `used`: o roteiro podia abrir um sorteio sem números para sortear.
> - **A letra avulsa** não tinha guarda de sequência em volta do download.
> - **A sincronização de pasta** redesenhava a Biblioteca inteira uma vez POR
>   ARQUIVO, pulando o coalescimento de 400 ms que já existia e tem nome.
> - **O wallpaper da tela da rede** desistia em ~6 s, e os bytes dele vêm depois
>   da mídia inteira na mesma fila serializada — agora usa a mesma ladeira do
>   fundo da letra.
> - **A caixa-preta** carimbava "PAUSA ESPONTÂNEA" em toda parada comandada: a
>   janela era de 400 ms contra um fade de 600 ms, e `media-clear` não estava na
>   lista.
> - **O erro de mídia da preview** era engolido sem registro nenhum — e o
>   comentário afirmava que ele ia para o Registro. Agora vai.
> - **`refFonte`** era escrito a cada status e NENHUMA linha o lia. Virou a linha
>   "Referência de tempo" do Registro, com a recência junto (ele não zera
>   sozinho, e sem a guarda diria "o telão" com o palco vazio há meia hora).
>
> **KOTLIN (exige Release):** a remontagem por morte de renderer zerava
> `backgroundWork` e `captureVolumeKeys` e **não desfazia a TELA CHEIA** — o
> WebView novo era acrescentado a um `webContainer` que continuava `GONE`, com a
> View órfã por cima. É o culto SEM TV, em que a preview em tela cheia É a
> projeção. E `buscarInterno` apagava `cancelarLink` incondicionalmente na
> entrada: um cancelamento que chegasse com o download ainda ENFILEIRADO era
> descartado no instante em que a vez dele chegava — o operador tocava em
> cancelar e os ~300 MB baixavam assim mesmo.
>
> **CÓDIGO MORTO REMOVIDO** (confirmado por `eslint --rule no-unused-vars` mais
> conferência à mão): `COLLECTION_LOCALE`, `nowYoutube`, `voiceIconSvg`,
> `noteIconSvg`, `lyricsOnlyIconSvg`, `mirrorTvConfirmado`, o construtor de
> cabeçalho de grupo `header` (~30 linhas de UI paralela e inerte) e o
> `countDownloaded` calculado e descartado em cada card, a cada redesenho.
>
> **O QUE FICA MAPEADO E NÃO FOI MEXIDO, de propósito:** a aba `'folders'` e a
> gaveta `#favPopup` são **inalcançáveis** — `openFavorites` não tem chamador e
> **`currentFolder` nunca mais recebe valor não-nulo em lugar nenhum do app**
> (as únicas atribuições são `= null`). São ~30 ramos, e com eles foram-se, sem
> aviso, a BUSCA dentro de uma pasta do aparelho e a seleção múltipla lá dentro.
> A faxina merece o próprio lote — e o oráculo que hoje monta `activeTab =
> 'folders'` à mão prova um comportamento num estado que o app não alcança.
>
> Todos os oráculos passam (19/19), e **cada correção foi verificada por
> ISOLAMENTO** — devolvendo o defeito e conferindo que o caso novo reprova. O
> Kotlin **não foi compilado** aqui (o ambiente não tem o SDK do Android): quem
> o compila é o CI.
>
> (Ela nasceu como v5.292 e foi renumerada no merge: uma sessão paralela
> publicou outra v5.292 em `main` enquanto esta rodava. Os dois lotes tocam
> `load()` e não se anulam — o de lá acrescenta a sincronização da seção de
> Favoritos, o daqui muda a restauração da ROLAGEM e a assinatura. O merge foi
> conferido com a suíte inteira depois de juntos.)

> **A v5.292: A SEÇÃO DE FAVORITOS FICAVA PARA TRÁS DO BANCO. OTA PURO** (sem
> Release).
>
> Relato do operador: *"verifique a atualização da lista de favoritos em relação
> a excluir itens comuns e a excluir pastas, que não desaparecem apenas fechando
> e reabrindo a biblioteca"*.
>
> **A causa é estrutural, e não daquele botão.** `deleteOpfsFolder`,
> `syncDeviceFolder` e a limpeza de catálogo terminam em `load()` — o funil onde
> `favItems`, `favSet` e `opfsFolders` são reaplicados ao estado do módulo —, e
> `load()` redesenhava o Cronograma (`renderLibrary`) e mais nada. A seção de
> Favoritos tem DUAS casas desde a v5.237, e desde a v5.290 a de dentro da
> Biblioteca é a única alcançável: quem a desenha é `renderFolderList` com
> `favHost`, que `load()` nunca chamava. É o mesmo defeito que a v5.258 corrigiu
> para o FAVORITAR, numa porta que aquele lote não tinha.
>
> Medido: excluir a pasta a tirava do banco (`opfs-folders` vazio) e a deixava na
> tela; o mesmo com o favorito que ela leva junto, porque `purgeCatalogRecords`
> mexe em `favs`.
>
> **A guarda é uma ASSINATURA, e não um redesenho incondicional.** `load()` roda
> por dezenas de caminhos com a Biblioteca aberta — uma sincronização que
> termina, o coletor de lixo, uma troca de aba por baixo —, e refazer a seção em
> todos eles fecharia a gaveta de opções que o operador acabou de abrir. Ela só é
> reconstruída quando o que ela DESENHA mudou (os ids dos favoritos e os
> id:contagem das pastas).
>
> **E o redesenho explícito do `moverNaLista` saiu junto**, porque virou o
> SEGUNDO: `reabrirAcoesEm` é consumido pelo primeiro, então o segundo
> reconstruía a linha sem a gaveta aberta — o botão saía de baixo do dedo, que é
> exatamente o que aquele mecanismo existe para evitar. O oráculo do par ↑↓ pegou
> isso na primeira execução.
>
> **E a metade negativa quase passou de graça.** A primeira versão dela mandava o
> item ao Cronograma e afirmava que a gaveta sobrevivia — só que aquele caminho
> **não chega a chamar `load()`** (a guarda de lá compara chaves de DESTINO com
> nomes de LISTA), isto é, ela nunca exercitava o redesenho. Medida no `load()`
> cru, ela reprova o redesenho incondicional.
>
> Verificado por ISOLAMENTO: sem a sincronização, **2** asserções reprovam; com
> ela incondicional, **1**.

> **A v5.291: UMA `.lib-item` DENTRO DE OUTRA — todo seletor DESCENDENTE vazou.
> OTA PURO** (só CSS e o oráculo; sem Release).
>
> Relato do operador sobre a v5.290, com prints: *"há diversos bugs, como o
> posicionamento incorreto do design dos itens da pasta. além de ter novamente o
> efeito incorreto de encolhimento inteiro do grupo ao tocar em itens
> individuais. também temos uma falha, que não permite fechar as opções de play
> dos itens."*
>
> **Três sintomas, UMA causa.** A pasta abrindo inline fez `.folder-opfs` virar o
> primeiro `.lib-item` deste app que CONTÉM outros `.lib-item` — e as regras da
> gaveta são descendentes, escritas numa época em que esse aninhamento não
> existia:
>
> | selector | o que ele passou a alcançar |
> |---|---|
> | `.lib-item.expanded .hymn-gaveta` | a pasta ABERTA satisfaz o `.expanded`, então a gaveta de TODO arquivo lá dentro virava `display: block` |
> | `.lib-item:not(.vendo-letra) :is(.hymn-lyrics, .item-detalhe)` | a pasta nunca tem `.vendo-letra`, então ela escondia o detalhe de um arquivo que TEM |
> | `.lib-item:has(.hymn-gaveta :active)` | não alcançava `.folder-itens`, e o `--press` da pasta encolhia com o toque num arquivo |
>
> A primeira linha explica DOIS dos três relatos de uma vez: a faixa preta
> embaixo de cada arquivo era a gaveta vazia dele, e fechar as opções tirava a
> classe do item **sem esconder nada**, porque quem as mantinha visíveis era a
> pasta. Medido: `exp: false, display: block, altura: 19px` nos três arquivos
> fechados, e `classe: false, display: block, altura: 293px` depois do segundo
> toque.
>
> **A regra que fica, e ela é mais larga que este arquivo: a gaveta é do item que
> a POSSUI, então toda regra dela é `>`.** Um seletor descendente responde "existe
> algum ancestral assim?", e a resposta muda no dia em que alguém aninha o
> componente — sem erro em lugar nenhum, e num lugar que não é o da causa. O
> mesmo vale para o feedback de toque, agora escrito de uma vez para os três
> blocos que uma linha apenas HOSPEDA (`.row-acoes`, `.hymn-gaveta`,
> `.folder-itens`): quem encolhe é a peça tocada.
>
> **E o quarto item do relato era de geometria**, medido: o arquivo começava em
> x=18 — colado na borda do cartão da pasta, com a miniatura dele na MESMA coluna
> da miniatura da própria pasta, lendo-se como irmão dela em vez de conteúdo. O
> favorito ao lado começa em 24. Com o recuo de `.4rem` no corpo, os dois passam
> a ocupar a mesma coluna (24 e 24; miniaturas em 32 e 32), que é o que o álbum
> já fazia pelo padding do `.coll-open`.
>
> Verificado por ISOLAMENTO, uma regra de cada vez: o seletor descendente de
> volta reprova **2** asserções, a guarda do encolhimento **1**, o recuo **1**.
>
> **E o oráculo quase passou pelo motivo errado.** A asserção das gavetas
> fechadas clicava na pasta *uma vez* para abri-la, isto é, dependia do estado
> que o caso anterior deixou — com ela fechada as gavetas estão escondidas de
> qualquer jeito, e a asserção passaria sem medir nada. Ela passou a GARANTIR o
> estado (`if (!expanded) click`), e só então o defeito reprova.

> **A v5.290: A PASTA DO APARELHO ABRE COMO UM ÁLBUM — e a gaveta de tela cheia
> fica sem porta. OTA PURO** (sem Release).
>
> Pedido do operador: *"ajuste o sistema de pastas dos favoritos, para que ele
> abra a lista de arquivos das pastas de forma visual sem ser um popup, para que
> abra a lista assim como abrem os álbuns com seus itens"*.
>
> **Uma pasta é um CONTÊINER de arquivos, exatamente como um álbum é um
> contêiner de faixas**, e o app já sabia desenhar isso. Ela abria uma folha de
> tela cheia (`#favPopup`) — a única sobrevivente de um modelo em que os
> favoritos eram uma gaveta própria — e agora é o mesmo acordeão, no mesmo
> lugar, com as mesmas linhas de item. O corpo é montado **uma vez, e só quando
> a pasta abre**: uma pasta sincronizada tem centenas de arquivos, e montá-los
> para todas elas a cada redesenho da seção seria o trabalho de DOM da tela
> inteira por algo que ninguém está vendo (a decisão da v5.237, um nível
> acima).
>
> **Uma anatomia só para as duas listas.** `favItemRow` virou `linhaDeItem`, e o
> que muda entre um favorito e um arquivo de pasta viaja em `opts` — nada mais:
>
> | | favorito | arquivo da pasta |
> |---|---|---|
> | `lista` | `'favs'` (↑↓ e excluir) | **nenhuma** — a ordem vem do disco, e apagar aqui seria apagar o ARQUIVO |
> | `destinos` | playlist · Cronograma | playlist · Cronograma · **Favoritar** |
>
> A segunda linha é a régua de sempre: numa lista de favoritos "Favoritar" não
> muda nada, e numa pasta ela é justamente o caminho de promover o arquivo. Uma
> escolha que não faz nada é pior que escolha nenhuma — daí ser parâmetro, e não
> um `if` dentro do menu.
>
> **`pastaAberta` é um NOME e não um conjunto**, pela mesma razão do
> `grupoAberto` (v5.273): "duas pastas abertas" deixa de ser uma regra que
> alguém precisa lembrar e passa a ser uma frase que não dá para escrever. E ele
> nasce no topo do arquivo, porque é lido por um caminho de render — a zona
> morta temporal que já derrubou o app quatro vezes. Ele existe porque favoritar
> um arquivo de dentro da pasta redesenha a seção: sem essa memória, cada ação
> fecharia a pasta.
>
> **⚠️ E A GAVETA `#favPopup` FICOU SEM PORTA.** Ela era a tela de DENTRO de uma
> pasta e nada mais (a v5.238 já tinha tirado o botão que a abria pela raiz), e
> `openOpfsFolder` era o único caminho para lá. O subsistema continua no arquivo
> INTEIRO e inerte, com a lápide em `openFavorites`, e isso é uma decisão
> declarada: removê-lo alcança ~28 ramos de `activeTab === 'folders'` espalhados
> por `load`, `renderListTitle`, `renderLibrary`, `deleteSelected`, `switchTab`,
> `hostSelbar`, `listHost`, o carrossel e a pilha do voltar — uma faxina que
> merece a própria passada de verificação, e não o mesmo lote de uma mudança de
> comportamento. O `activeTab` nunca mais vale `'folders'` (o carrossel já o
> pulava), então os ramos são inertes, não perigosos.
>
> **O que a gaveta levava junto, e está dito em vez de escondido:**
>
> - a **BUSCA dentro de uma pasta** (`folderQuery`/`#libSearch`) — e ela não tem
>   substituto: a barra da Biblioteca varre `allCollections()`, que não alcança
>   o catálogo de pastas;
> - a **SELEÇÃO MÚLTIPLA** dentro de uma pasta, que era onde morava o excluir de
>   ARQUIVO FÍSICO por item. Esta é menos perda do que parece: um arquivo
>   apagado de uma pasta sincronizada volta na sincronização seguinte — o mesmo
>   argumento que mantém o renomear fora dali (v5.288) — e quem apaga de
>   verdade é o "Excluir pasta e arquivos sincronizados" da própria linha.
>
> Verificado por ISOLAMENTO: devolvendo o toque que abria o popup, **3**
> asserções reprovam — e reprovam MEDINDO (a sonda é null-safe de propósito:
> sem `.folder-itens` uma exceção abortaria o caso e o que sobraria seria
> "terminou com erro" em vez de "a lista não abriu inline").

> **A v5.289: A GUARDA PERGUNTAVA À ÁRVORE DE AGORA, e o handler já a tinha
> desmontado. OTA PURO** (sem Release).
>
> Três coisas: uma REGRESSÃO da v5.288 e dois pedidos do operador.
>
> - **TOCAR NUMA OPÇÃO DE PLAY FECHAVA O ÁLBUM INTEIRO.** Relato, no dia
>   seguinte ao lote: *"agora ele está fechando o álbum ao tocar nos botões de
>   check das opções de play"*.
>
>   A v5.288 subiu o ouvinte do acordeão para o CARD e o guardou com
>   `e.target.closest('.coll-open')` — uma consulta à árvore VIVA. Só que o botão
>   de destino é apagado pelo próprio handler que roda antes desta linha: marcar
>   uma opção chama `renderSongMenu`, que faz `alvo.innerHTML = ''` e reconstrói
>   a lista. Quando o evento chega ao card, o `e.target` está **desanexado** —
>   `closest` sobe por um trecho de árvore que não tem mais pai nenhum, devolve
>   `null`, a guarda falha e o álbum fecha. Medido: a marca nem chegava a pegar,
>   porque o card era reconstruído por baixo.
>
>   **A régua que fica é mais larga que este arquivo:** um ouvinte que decide
>   pela POSIÇÃO do alvo na árvore está perguntando "onde este nó está agora", e
>   *agora* é depois de todos os handlers que rodaram antes dele. A pergunta que
>   ele quer fazer é sobre o CAMINHO — *este clique nasceu dentro do corpo
>   aberto?* —, e o caminho é fixado no DISPARO: `e.composedPath()` sobrevive ao
>   apagamento; `closest` não.
>
>   Os irmãos que rebuildam do mesmo jeito foram medidos junto e passam: o
>   seletor de variante, o "Ver a letra" e as opções do próprio álbum.
> - **FAVORITAR NÃO FECHA MAIS A GAVETA DO CRONOGRAMA**, e ela fechava por DOIS
>   caminhos independentes — consertar um só teria deixado o defeito de pé. O
>   ouvinte de captura da caixa fecha em qualquer botão (a estrela virou exceção,
>   ao lado do par ↑↓, pela mesma régua: **a ação que não TERMINA a conversa com
>   aquele item** — a estrela é um alternador, e o desfecho dela é o próprio
>   botão mudando de desenho sob o dedo); e o `renderLibrary` que `toggleFav`
>   agenda depois do pulso reconstrói a linha inteira, apagando o `li` aberto.
>   Daí `manterAcoesAbertas()`, que reusa o `reabrirAcoesEm` do par ↑↓ e a CHAVE
>   que `montarAcoesDaLinha` passou a carimbar no `li` — sem ela não haveria como
>   reencontrar a linha, porque o mesmo item vive em duas listas ao mesmo tempo.
> - **O EXCLUIR É O PRIMEIRO DA FAIXA**, isto é, o mais longe do `⋮`. Pedido do
>   operador: *"excluir deve ficar o mais longe de um acidente de clique de
>   fechar opções"*. O `⋮` fica colado na ponta direita e é o alvo tocado
>   repetidamente (abre e fecha) — errá-lo por alguns pixels caía justamente no
>   destrutivo. Do outro lado o vizinho é o VAZIO da caixa, que também fecha, e a
>   diferença é que ele é uma área larga em que ninguém mira a borda. Isto
>   inverte a ordem que valia desde a v5.258 ("o que se usa mais fica mais perto
>   do dedo"); ela continua valendo para o resto da fileira.
>
> Verificado por ISOLAMENTO: devolvendo o `closest`, **1** asserção reprova (e é
> a que exercita a desanexação de verdade); devolvendo a estrela ao fecho, **1**
> — e ela continua reprovando com só metade do conserto (o ouvinte sem o
> `manterAcoesAbertas`), que é o que prova que os dois caminhos existem;
> devolvendo o excluir ao fim da fileira, **1**. A metade NEGATIVA está travada
> junto: um botão que TERMINA a conversa (o renomear) continua fechando — sem
> ela, calar o ouvinte inteiro passaria.

> **A v5.288: O FEEDBACK DE TOQUE TIRAVA O ALVO DE BAIXO DO DEDO — e mais três.
> OTA PURO** (sem Release).
>
> Quatro pedidos do operador, e o terceiro é o achado do lote.
>
> - **O CARD DO ÁLBUM NÃO ABRIA PERTO DA BORDA.** Relato: *"nos álbuns há um
>   toque em uma margem à esquerda da seta que abre o álbum, que ENCOLHE os
>   itens dentro do card, mas não abre o álbum"*.
>
>   **A causa não é o pixel, é o próprio FEEDBACK.** `.coll-bar` está na lista
>   do `:active` do app, cujo `--press` é `scale(.96)` — numa barra de ~395px
>   isso a encolhe ~8px de cada lado. O `pointerdown` acerta a barra e dispara o
>   encolhimento; no `pointerup` ela já não está mais ali, e o navegador entrega
>   o `click` ao ancestral que sobrou: o card, que não tinha ouvinte nenhum.
>   Medido por varredura, com o card de 395px: **até ~7px da borda o toque não
>   abre; de 8px em diante abre** — e a fronteira é exatamente o que a animação
>   vaga. A "margem à esquerda da seta" existe também à direita, em cima e
>   embaixo.
>
>   A correção não é caçar pixels: o ouvinte sobe para o **CARD**, que é o
>   elemento que não se mexe — qualquer retargeting causado pelo encolhimento
>   passa a cair em quem sabe responder, e a classe inteira fecha. A GUARDA é o
>   `.coll-open` (o invólucro de tudo que não é a barra): sem ela, com o álbum
>   aberto um toque numa faixa borbulharia até o card e o fecharia debaixo do
>   dedo. Perguntar pelo invólucro, e não por uma lista de filhos, é o que faz o
>   próximo bloco que nascer lá dentro já nascer protegido.
>
>   **E o padding saiu do card** (`.hymnal-card { padding: 0 }`), indo para quem
>   PINTA — a barra e o corpo aberto. Ele era um resíduo com pista no próprio
>   arquivo: a barra do álbum ABERTO já o desfazia com margens negativas para
>   grudar como tampa, isto é, **com o álbum aberto aquela faixa funcionava e
>   com ele fechado, não** — o mesmo pixel respondendo ou não conforme o estado.
> - **RENOMEAR ENTRA NA GAVETA DA LINHA DO CRONOGRAMA.** Ele existia só para UM
>   item de cada vez e atrás de quatro gestos (toque longo → seleção múltipla →
>   botão do rodapé → diálogo), que é a mesma correção que o excluir recebeu na
>   v5.272. **Na pasta do aparelho ele NÃO entra**, com a mesma guarda do
>   excluir: ali o nome vem do arquivo, e um nome só no registro seria desfeito
>   na varredura seguinte. O lápis é **SVG inline** e nunca um glifo — a fonte é
>   um subset estático e `edit` não está nele; codepoint ausente desenha um
>   retângulo vazio, sem erro em lugar nenhum (a armadilha da v5.184 e da
>   v5.200).
>
> E os dois primeiros pedidos, os dois sobre a estrela em telas diferentes.
>
> - **NOS FAVORITOS, A ESTRELA SAI E A LIXEIRA FICA.** *"Remova ou a opção de
>   excluir ou a opção de desfavoritar, pois tecnicamente ambas fazem a mesma
>   coisa."* Nesta lista fazem: as duas terminam num `listRemove('favs', id)`, e
>   o que se vê é a mesma linha sumindo.
>
>   **Isto REVOGA meia frase da v5.287** — ela dizia "quem o tira de lá é a
>   estrela". Três razões, na ordem em que pesam: **(1)** aqui a estrela é um
>   alternador de UMA direção — todo item desta lista já é favorito, então ela
>   nasce sempre acesa e o único toque possível é o que apaga, isto é, um botão
>   de excluir vestido de alternador que nunca chega a dizer "favoritar";
>   **(2)** a lixeira PERGUNTA, e a linha some de uma lista que o operador
>   montou à mão — o texto do diálogo ainda explica a semântica exata ("os
>   arquivos só são apagados se ele não estiver em mais nenhuma"); **(3)** ela
>   solta a prateleira invisível (`soltarAvulso`), que é a diferença entre "a
>   linha sumiu" e "os bytes saíram" — a estrela não faz isso, porque
>   desfavoritar não é uma declaração de intenção de apagar.
>
>   Nas outras listas a estrela continua inteira, e ali ela alterna de verdade.
> - **E NO CRONOGRAMA ELA VIRA UM BOTÃO COMO OS OUTROS.** *"Verifique o design
>   do favoritar no cronograma, para que seja um botão quadrado igual as outras
>   opções."* O `background: transparent` dela tinha um argumento escrito, e ele
>   EXPIROU com uma mudança de casa: *"numa linha que já tem miniatura, nome,
>   selo e às vezes dois botões, mais um fundo sólido viraria ruído"* — verdade
>   quando ela morava NA LINHA. Desde a v5.258 ela mora dentro da gaveta do `⋮`,
>   onde todos os vizinhos são `.row-btn` preenchidos: chapada ali, ela era a
>   única peça da fileira sem caixa, e a exceção não dizia nada. (O par que o
>   argumento citava — a alça de arrastar — nem existe mais desde a v5.285.) O
>   ESTADO continua sendo o desenho (preenchida × vazada) mais a cor, que é o
>   que a estrela sempre disse.
>
> A régua do oráculo da estrela é a dos VIZINHOS, e não um valor escrito: ele
> exige que todos os `.row-btn` da faixa tenham o MESMO fundo e que ele não seja
> transparente — um token novo do dia seguinte não pode reprovar isto. E o do
> card mede um CLIQUE DE VERDADE (`mouse.click`, porque um `el.click()`
> sintético não passa por hit-test nenhum e aprovaria o defeito inteiro), nas
> três metades: fechado a borda abre, aberto a mesma borda fecha, e um toque
> numa faixa não fecha nada.
>
> Verificado por ISOLAMENTO: devolvendo o `transparent`, **1** asserção reprova;
> devolvendo a estrela à faixa dos favoritos, **1**; devolvendo o ouvinte à
> barra e o padding ao card, **3**; tirando só a guarda do `.coll-open`, **1**;
> tirando o renomear, **4**.

> **A v5.287: A GAVETA PARA DE SE MESCLAR COM A LISTA, e a linha de favorito
> ganha o mesmo sistema da Biblioteca. OTA PURO** (sem Release).
>
> Quatro pedidos do operador, e os dois últimos são o mesmo movimento.
>
> - **A LARGURA DO "VER/OCULTAR A LETRA" NÃO MUDA MAIS COM O ESTADO.**
>   "Ocultar" é mais longo que "Ver", então o botão crescia debaixo do dedo e o
>   CONFIRMAR ao lado encolhia junto — 110px → 143px, medidos. As duas frases
>   passaram a ocupar a MESMA célula de uma grade 1×1 e a troca só alterna qual
>   se vê: a largura é a da maior, sempre. `visibility` e não `display`, porque
>   a escondida precisa continuar MEDINDO — é ela que reserva o espaço. Um
>   `min-width` em `ch` seria um número a manter contra a fonte e contra a
>   tradução; isto não tem número nenhum.
> - **A GAVETA VIRA UM POÇO, E A DIREÇÃO DELE MUDA COM O TEMA.** Relato:
>   *"ainda está pouco o contraste entre os botões e pior, toda a seção das
>   opções de play estão se mesclando com a lista dos outros itens abaixo,
>   dificultando a percepção da seção e a qual item ela pertence"*.
>
>   **MEDIDO antes de mexer, no tema ESCURO: 1,03:1.** A v5.286 devolveu à
>   gaveta o `--panel` da folha antiga — que era a base certa para aqueles
>   botões e é a cor errada AQUI: `--panel` compõe rgb(44,52,60) e a faixa de
>   uma linha vizinha compõe rgb(46,54,63). A seção aberta tinha, literalmente,
>   a cor das linhas de baixo, e os botões dentro dela davam 1,18:1.
>
>   `--gaveta-bg`/`--gaveta-btn` são um par por tema, e a inversão é aritmética:
>   no escuro o único caminho é DESCER (subir levaria a `--panel-2`, que é a cor
>   do próprio card do álbum — a que aparece nos vãos entre as linhas); no
>   claro, descer para `--bg` deixaria a gaveta a 1,09:1 do card, e quem sobe é
>   ela. Medido depois — botão × gaveta e gaveta × faixa vizinha: escuro
>   **1,49** e **1,54**; claro **1,41** e **1,93**. É o mesmo precedente do
>   `--field-bar` (v5.270): uma superfície cuja direção não acompanha a escada
>   precisa de um token próprio em cada tema.
>
>   **A SEGUNDA metade da queixa é de FORMA, e ela custa uma linha:** a gaveta
>   perdeu as margens. Ela é filha do `.lib-item`, que já pinta a linha inteira
>   e recorta pelo `border-radius` com `overflow: hidden` — coladas, faixa e
>   gaveta viram UM bloco com o título em cima e o poço embaixo. Com a margem, o
>   poço era uma ilha flutuando sobre um frame da cor das linhas de baixo, e
>   nada dizia de quem ele era.
> - **A LINHA DE FAVORITO ABRE A GAVETA DA BIBLIOTECA, e o `⋮` sai.** Os dois
>   últimos pedidos: *"verifique a sobreposição das opções dos itens na lista de
>   favoritos, pois estão novamente abrindo a sua gaveta de opções sobre o
>   título de cada item"* e *"trate a lista de favoritos com o mesmo sistema de
>   opções de play que temos no resto da biblioteca, ao invés de tratar ela como
>   toque direto no player"*.
>
>   **O segundo RESOLVE o primeiro, e é por isso que eles vieram juntos.** O `⋮`
>   e a faixa que ele abre existem para caber numa linha que responde ao toque
>   com OUTRA coisa (no Cronograma, projetar): sem lugar embaixo, a gaveta só
>   tinha para onde ir por CIMA do título. Aqui o toque deixa de projetar, o
>   corpo da linha fica livre, e a sobreposição deixa de existir por construção
>   — não por um reposicionamento.
>
>   **Esta lista mora DENTRO da Biblioteca desde a v5.237**, e é isso que decide
>   o lado da regra em que ela cai: a Biblioteca é a tela em que se PREPARA (o
>   toque abre opções) e o Cronograma é a lista com que se OPERA (o toque
>   projeta). O `⋮` continua inteiro lá, e na fila da playlist.
>
>   **Nada de menu foi reimplementado.** `renderItemMenu` é a mesma maquinaria
>   de destinos — `songMenuItem` com `destino`, `destExecutor`, `destRemontar`,
>   `destConfirmRow` — apontada para a `<ul>` do corpo da linha. O que ela NÃO
>   tem é seletor de variante (o registro já existe; não há cantada × playback a
>   escolher) nem "Favoritar" (o item É um favorito, e quem o tira de lá é a
>   estrela). As ações da linha — estrela, ↑↓, excluir — descem para uma faixa
>   no PÉ da gaveta, com os mesmos botões e os mesmos ouvintes de antes.
>
>   **O PREÇO está dito:** projetar um favorito passou de um toque a três
>   (abrir, marcar, confirmar). Em troca, as três listas passam a estar a um
>   toque do mesmo lugar — antes, mandar um favorito ao Cronograma era o `+` e
>   mandá-lo à playlist não tinha caminho nenhum nesta tela. O **Parar na capa**
>   continua sendo um toque direto: tirar do ar é a decisão que não pode custar
>   uma gaveta.
>
> **As regras da gaveta deixaram de ser keyadas em `.hymn-result` e passaram a
> ser em `.lib-item`** — o mesmo envelope serve as duas listas, e uma segunda
> anatomia divergiria da primeira no próximo ajuste. Com ela saiu a opção
> `semSelecao` do `attachRowGestures`, que ficou sem chamador.
>
> Verificado por ISOLAMENTO: devolvendo o `--panel` e o `--surface` da v5.286,
> **2** asserções reprovam (e imprimem o 1,18 e o 1,03 do relato); devolvendo o
> `display: none` no botão da letra, **1**; devolvendo o toque que projeta na
> linha de favorito, **4**.

> **A v5.286: A GAVETA DE OPÇÕES, EM SETE PONTOS — e dois deles são defeitos que
> a v5.285 introduziu. OTA PURO** (sem Release).
>
> O operador usou a gaveta nova e devolveu sete apontamentos sobre a mesma peça.
> Eles vieram num lote só porque vivem um dentro do outro: um conserto de
> qualquer um deles mexe no que o vizinho mede.
>
> **Os dois DEFEITOS, e os dois são meus:**
>
> - **"Verifique o que são esses pontos ou marcadores à esquerda dos cards."**
>   São marcadores de LISTA. A `<ul>` das opções nasceu no corpo da linha e não
>   herdou `list-style: none` de ninguém — a do popup é `.popup-list`, que já o
>   declarava. Eles não vinham de regra nenhuma do app, e é por isso que não
>   havia o que procurar: era a **ausência** de uma. (Quadrados, e não bolinhas,
>   porque o navegador troca o marcador conforme a profundidade do aninhamento —
>   o que os tornava ainda menos reconhecíveis como o que eram.)
> - **"O feedback de toque está encolhendo toda a seção de opções."** É o
>   `:active` do `.lib-item` sendo satisfeito por um botão DENTRO dele. O app já
>   conhecia esta armadilha — a v5.269 a desligou para o `⋮` com o argumento de
>   que "o movimento da caixa polui o conjunto" —, e a gaveta a reabriu num
>   alcance maior: o que se mexia era a linha MAIS a gaveta, meia tela por causa
>   de um toque num botão de 40px.
>
> **Os cinco AJUSTES:**
>
> - **"Tocar agora" vira a primeira opção da lista de check**, e as linhas
>   "Tocar música cantada"/"Tocar playback" saem. O operador nomeou a razão:
>   *"já que nessa seção de check já temos os alternadores entre cantado e
>   playback"* — a variante aparecia DUAS vezes, uma como segmento e outra como
>   linha. Agora o seletor responde **o quê** e as quatro opções respondem
>   **onde**.
> - **E "Letra" é o terceiro segmento**, ao lado de Cantada e Playback. Isso
>   torna "Só a letra, no Cronograma" redundante — ela era exatamente `Letra` +
>   `Cronograma` —, e a linha saiu. `addLyricCue` passou a aceitar VÁRIAS listas
>   (um registro só, como qualquer item multi-destino), porque a cena de letra
>   deixou de ser exclusiva do Cronograma. O seletor agora aparece SEMPRE: antes
>   ele dependia de haver playback, e toda música tem letra.
> - **As caixas de marcação se veem sem estar marcadas** — *"para entender que
>   não são botões, mas selecionáveis"*. Medido: o recesso antigo dava
>   **1,08:1** contra o botão em que mora, que é o "não dá para ver" do relato;
>   `--check-vazio` o leva a **1,28:1**. Ele é um token com TEMA, e não o
>   `--scrim` compartilhado: no claro aquele .6 seria uma lápide sobre um botão
>   claro. Continua sendo um RECESSO — a regra da v5.267 vale —, e o teto é o do
>   próprio tema escuro: preto sobre um botão já escuro comprime a razão por
>   construção.
> - **O fundo da gaveta volta a ser o da folha antiga** (`--panel`). O pedido
>   cobra a consequência de mudar a lista de lugar: na folha ela pousava em
>   `--panel` e os botões dela são um RECESSO; trazida para o corpo da linha,
>   passou a pousar na faixa, que já é um recesso do card. Recesso sobre recesso,
>   e o degrau que separava o botão do fundo encolheu.
> - **A letra fica atrás de um botão lado a lado com o confirmar.** Ela é a mais
>   alta das duas metades da gaveta, e aberta por padrão empurrava as opções para
>   longe do dedo em toda abertura — quando o que se abre a gaveta para fazer é
>   DECIDIR. O botão é fornecido pelo dono da lista (`songMenuFor.aoLado`), então
>   a folha, que não tem letra nenhuma a esconder, não muda.
>
> **Duas armadilhas de medição no caminho, e as duas são a mesma:** a asserção da
> caixa vazia media `backgroundColor` de um `::before` com ALFA — isto é,
> comparava PRETO com o botão e passava em qualquer estado. É a armadilha da
> v5.283 um nível abaixo, e a correção é a mesma (compor sobre a base). E o
> `razao` do arquivo mora dentro do laço de temas; usá-lo fora dele derrubava o
> caso inteiro por `ReferenceError`, escondendo tudo o que vinha depois.
>
> Verificado por ISOLAMENTO, peça a peça: os marcadores de volta reprovam **1**,
> o fundo antigo **1**, a letra aberta **1**, a caixa antiga **1** (imprimindo o
> 1,08:1 do relato) e o feedback sem a guarda **1**.

> **A v5.285: O ARRASTO SAI DO APP, os botões saem da faixa, e as opções descem
> para o corpo da linha. OTA PURO** (sem Release).
>
> Quatro pedidos do operador, e os dois últimos são o mesmo movimento.
>
> - **AS PASTAS SINCRONIZADAS VÃO PARA O TOPO** dos Favoritos. Elas ficavam no
>   fim desde a v5.254, com o argumento de que *"são a origem bruta, e o que a
>   estrela promete são os itens"* — o que continua verdadeiro e não é o que
>   decide a ordem: uma pasta é um punhado de arquivos atrás de UMA linha, e a
>   lista de favoritos cresce por baixo dela. No fim, cada favorito novo
>   empurrava as pastas para longe; no topo elas têm endereço fixo.
> - **REORDENAR VIRA UM PAR ↑↓ DENTRO DA GAVETA DO `⋮`**, e o arrasto sai do app
>   inteiro — as TRÊS listas (Favoritos, Cronograma e a fila da playlist, esta
>   última perguntada e confirmada), para não sobrarem dois idiomas de
>   reordenar. Com ele saem `attachHandle`, a medição única do `pointerdown`, a
>   linha-guia absoluta (e o bloco contendor que a v5.272 garantia pelo JS), o
>   `data-fixa` das pastas e o `reorder` por índice de destino. **A fila da
>   playlist ganhou a gaveta do `⋮` no mesmo lote** — ela era a única lista sem
>   botão de opções, e tirar o gesto sem dar a gaveta a deixaria sem como
>   reordenar.
>
>   O que justifica a troca não é gosto: um arrasto é um gesto CONTÍNUO com
>   captura de ponteiro, disputando o eixo vertical com a lista que rola por
>   baixo, dentro de uma gaveta que já é um alvo pequeno. **O preço está dito:**
>   mover dez posições passou de um gesto a dez toques. É o caso raro, e
>   `reabrirAcoesEm` o torna suportável — a lista redesenha entre um toque e o
>   outro, e a gaveta volta no item que se moveu, com o botão sob o mesmo dedo.
>   **A chave dessa reabertura é `lista:id` e não o id nu**: o mesmo item está em
>   duas listas ao mesmo tempo (um favorito que também está no Cronograma é o
>   caso normal), e com o id sozinho o redesenho do Cronograma consumiria a marca
>   e abriria a gaveta na linha errada, noutra tela.
>
>   E `moverNaLista` **redesenha a seção dos Favoritos à mão**: `renderLibrary`
>   só chega ao `renderFolderList` quando a aba é a da pasta do aparelho, e a
>   lista `favs` mora dentro da Biblioteca desde a v5.237 — sem essa linha o item
>   mudava de lugar no banco e a tela ficava idêntica, que é o pior desfecho
>   possível para um botão de reordenar.
> - **A FAIXA DA BIBLIOTECA PERDE OS DOIS BOTÕES** (o ▶ e o `+`) e **as opções
>   completas descem para o corpo da linha**, onde antes abria só a letra. O que
>   o operador desfaz é a DIVISÃO da v5.62: com dois alvos, decidir "o que fazer
>   com este hino?" exigia primeiro decidir qual dos dois botões era o dono da
>   pergunta — e essa é uma pergunta sobre a UI, não sobre o culto. Medido, o
>   nome passou a ocupar **83% da linha**.
>
>   **A gaveta tem duas metades, e a letra FICA** (decisão do operador,
>   perguntado): as opções em cima, a letra (ou o detalhe do vídeo) logo abaixo.
>   A ordem não é arbitrária — quem abre a gaveta acabou de tocar para DECIDIR, e
>   a decisão tem de estar sob o dedo; a letra é a conferência, e ela pode rolar.
>
>   **Nada de menu foi reimplementado.** `renderSongMenu` e `openYtMenu` ganharam
>   PARA ONDE escrever (`songMenuFor.alvo`), e o modo `tudo` empilha tocar e
>   adicionar numa lista só. A folha `#songMenuPopup` continua de pé com os dois
>   donos que sobraram — os resultados do YouTube e o seletor de destinos da
>   importação —, e `openSongMenu` saiu por não ter mais chamador. Um episódio de
>   série continua desviando para a lista do YouTube, como a folha já fazia desde
>   a v5.230; o que muda é o endereço.
>
> **O quadrado da esquerda deixou de ser botão e virou INDICADOR** — ele hospeda
> o anel de download, que é a única coisa que aquele canto sempre informou de
> verdade, e segura a coluna que alinha a lista. Perdeu o `--accent-soft` (a
> marca de "isto é ação") e o `cursor: pointer`: um alvo que não é alvo, num
> canto onde o dedo mira, é pior que nada.
>
> **As setas do par ↑↓ são SVG inline, nunca glifo da fonte** — o subset é
> estático e um codepoint ausente desenha um retângulo vazio sem erro nenhum,
> que é a armadilha da v5.184.
>
> Os oráculos mudaram de pergunta junto, e um deles ficou mais forte: o caso do
> ALVO dos botões (v5.278) media se as bordas em volta deles caíam no botão; com
> os botões fora, ele passou a afirmar que **todo ponto da linha leva ao mesmo
> lugar** — cantos, bordas e o quadrado onde o ▶ vivia —, e conta `button` sem
> conhecer os nomes dos que saíram, para valer contra o próximo que aparecer.
>
> Verificado por ISOLAMENTO: devolvendo as pastas ao fim, **1** asserção
> reprova; devolvendo um botão à faixa, **1**.

> **A v5.284: A PASTA SINCRONIZADA CONTINUA SENDO UM ÁLBUM — e a estrutura que
> faltava aparece. OTA PURO** (sem Release).
>
> Pedido do operador: *"mantenha apenas as pastas sincronizadas dos favoritos
> como cores de álbum"*. Uma pasta guarda muitos arquivos — ela é um CONTÊINER,
> como um álbum —, e um favorito é um item. O **"apenas"** é o que faz disto uma
> regra em vez de duas cores: o item desce, a pasta não.
>
> **É a v5.283 cobrando o preço de uma peça com dois papéis.** Aquele lote pintou
> o CORPO INTEIRO da seção no nível de card para os itens poderem ser um recesso
> dele — e ali dentro não sobra como desenhar uma pasta com cor de álbum: ela
> ficaria com a cor exata do corpo, **1,00:1**, invisível. A saída não é um `if`
> de cor, é a estrutura que faltava, e ela se lê nas duas medições:
>
> - o **ITEM** precisa de uma placa de card atrás dele — sobre o tom da SEÇÃO ele
>   mede 1,03:1 no escuro, isto é, some;
> - a **PASTA** precisa do tom da seção atrás dela — sobre a placa ela mediria
>   1,00:1, que é o mesmo defeito ao contrário.
>
> Duas bases diferentes não cabem numa `<ul>` só. Daí a **placa própria dos
> itens** (`.fav-itens`), e com ela o par volta a ser o MESMO do álbum, em dois
> elementos: `.hymnal-card` PINTA e `.coll-songs` zera o degrau seguinte. A
> v5.283 acumulava os dois papéis numa peça, e o resíduo disso era a armadilha de
> "A CAMADA" com a assinatura invertida — o reset tinha de morar na regra da
> LINHA, senão venceria na hora de o corpo resolver o próprio `background` e o
> bloco sairia transparente. Com a placa, o reset volta ao lugar natural.
>
> **AS PASTAS NÃO GANHARAM REGRA NENHUMA**, e isso é o desenho e não economia:
> elas continuam sendo filhas diretas do corpo, que já reserva `--panel-2` para
> os filhos dele. A cor de álbum é o PADRÃO ali — o que precisava de regra era o
> item. E a placa só nasce quando há item, senão ela seria uma faixa colorida
> anunciando uma lista que não existe.
>
> O arrasto não custou uma linha: `attachHandle` mede `li.parentElement`, então
> ele passa a operar na placa sozinho, e a linha-guia já garante o bloco
> contendor pelo JS desde a v5.272.
>
> **O oráculo mede a cor EFETIVA e a ESTRUTURA dos dois lados** — o item dentro
> da placa, a pasta irmã dela —, porque sem a segunda metade uma pasta empurrada
> para dentro da placa passaria na medida de cor no dia em que a placa e o corpo
> voltassem a ter o mesmo tom. **E a sonda do item não cita a placa de
> propósito:** um seletor que só existe na forma nova reprova por "não achei" em
> qualquer forma antiga, e uma asserção que falha por seletor ausente não mediu
> cor nenhuma — ela diria a mesma coisa com o item pintado certo. Pelo que ele
> NÃO é (uma pasta), ela mede em qualquer arranjo.
>
> Verificado por ISOLAMENTO: voltando à forma da v5.283, **4** asserções
> reprovam — todas sobre a pasta, e todas medindo (ela sai a 1,00:1 do item ao
> lado). As do item continuam passando, que é a leitura certa: a v5.283 acertou o
> item e este lote só mexe na pasta.

> **A v5.283: UM FAVORITO É UM ITEM, NÃO UM ÁLBUM — a linha passa a pintar a
> cor da faixa dentro do álbum. OTA PURO** (só CSS e o oráculo; sem Release).
>
> Pedido do operador: *"torne os itens na lista de favoritos, com sua cor de card
> igual as cores dos itens individuais dentro dos álbuns, para diferenciar entre
> álbum e item"*.
>
> **MEDIDO antes de mexer, nos dois temas: 1,00:1.** A linha de favorito e o card
> de álbum pintavam a MESMA cor, literalmente — os dois são filhos diretos do
> corpo de uma seção, e o corpo reserva `--panel-2` para os filhos dele. Nada
> distinguia "um álbum inteiro" de "um louvor solto" além do que estava escrito
> na linha. É a v5.282 cobrando o degrau seguinte: aquele lote tirou o tom
> próprio da SEÇÃO com o argumento de que ela é uma seção como as outras, e a
> consequência que ele não pesou é que os FILHOS dela não são como os das outras
> — lá são álbuns, aqui são itens.
>
> A correção é dar ao favorito a MESMA RECEITA da faixa dentro do álbum: um
> RECESSO (`--surface`, que dentro de uma seção da Biblioteca é o par `sunk`)
> sobre uma base de nível de card. **As duas metades são inseparáveis, e a
> segunda foi imposta pela medição, não escolhida:**
>
> - **Só o recesso, sobre o tom da SEÇÃO, não resolve.** Ele resolve no escuro
>   (1,58:1 contra o card) e FALHA no claro, onde a seção é BRANCA e o recesso
>   compõe `#dbdbdb`, a **1,02:1** do card — isto é, no tema claro o favorito
>   voltaria a ser indistinguível de um álbum, que é o defeito relatado. Isto
>   não é hipótese: está exercitado por isolamento, e reprova em 3.
> - **Com a base de card por baixo, a composição é a mesma da faixa e o valor
>   bate exatamente:** `rgb(46,54,63)` no escuro e `rgb(182,188,194)` no claro, a
>   **1,29:1** e **1,37:1** do card nos dois temas.
>
> Daí o corpo da seção PINTAR `var(--camada)` — o `--panel-2` que ele próprio
> reserva — e virar o contêiner de nível 2 desta seção, no lugar que num hinário
> é ocupado por um card de álbum. Ele é a única peça do arquivo que acumula os
> dois papéis que lá são de dois elementos (`.hymnal-card` pinta, `.coll-songs`
> zera o degrau seguinte), e **por isso o reset de `--camada` mora na regra da
> LINHA e não no corpo**: escrito no corpo, ele venceria na hora de o corpo
> resolver o próprio `background` e o bloco sairia transparente — a armadilha que
> o cabeçalho de "A CAMADA" descreve, com a assinatura invertida.
>
> **O oráculo mede a COR EFETIVA, e essa distinção é o caso inteiro.** Os
> recessos deste app são overlays com ALFA, e `getComputedStyle` devolve o alfa,
> não a composição: uma asserção sobre o valor declarado compararia
> `rgba(0,0,0,.24)` com um `#3c4753` opaco e diria que eles "diferem" sem ter
> medido cor nenhuma — passaria com o defeito no lugar e reprovaria a correção.
> Ele sobe a árvore compondo até o primeiro fundo opaco, que é o que o navegador
> pinta. E a FAIXA do álbum é desenhada pelo app (`collState` + `expanded`), não
> montada à mão pelo teste: marcação inventada num oráculo mede a marcação de
> quem o escreveu.
>
> Verificado por ISOLAMENTO: sem a regra inteira (o código anterior), **4**
> asserções reprovam, imprimindo o 1,00:1 do relato; com o meio-conserto (o
> recesso sem a base), **3**.
>
> **A v5.282: OS FAVORITOS VOLTAM A SER UMA SEÇÃO COMO AS OUTRAS — o tom próprio
> sai, o "Ver todos" sai, e o vão vira um PISO. OTA PURO** (nenhuma linha de
> Kotlin; sem Release).
>
> Três pedidos do operador, e os três desfazem mecanismo meu — o terceiro é o que
> torna o segundo possível.
>
> - **O TOM PRÓPRIO SAI** — *"estávamos ajustando para que ela fosse mais
>   diferente que os demais, mas não ficou bom. Ajuste as cores dela para que ela
>   fique igual as outras coleções"*. O argumento da v5.273 era que a seção não é
>   uma coleção e que só ela ocupa o vão; ele continua verdadeiro nas duas
>   metades, e **nenhuma delas se lê como COR**: o nome no cabeçalho diz a
>   primeira e o vão reservado diz a segunda, sozinho. O que a cor acrescentava
>   era um QUARTO tom numa escada de três, e a v5.267 já tinha medido o preço de
>   um quarto degrau. Saíram o `--fav-bg` dos dois temas e o `--camada` próprio
>   que ele arrastava — **os dois no mesmo lote, porque um nível que muda arrasta
>   o de dentro**: repintar só a seção deixaria as linhas num tom que nenhuma
>   outra coleção tem, e uma medida da seção sozinha não pegaria isso.
> - **O "VER TODOS" SAI** — *"ajuste o funcionamento interno dela para que não
>   tenha mais o sistema de ver mais. Agora quando aberta ela mostra toda a
>   listagem"*. Com ele foram embora o `favExpandido`, a classe `.expandido`, o
>   CSS do botão e a régua de "quantos itens ficaram de fora" com a leitura
>   adiada um quadro que ela exigia. É a terceira porta que este mesmo lugar
>   perde em quatro versões (a v5.279 abriu o scroll interno, a v5.280 o
>   revogou), e agora não sobra nenhuma: **a lista inteira está na tela.**
> - **E O VÃO VIRA `min-height`** — *"mantenha o tamanho mínimo dela, mesmo
>   vazia, como o tamanho flexível que ocupa o que sobra das outras coleções…
>   mas agora esse é apenas o tamanho mínimo, que cresce conforme a lista dos
>   favoritos requerir mais que esse espaço disponível"*. É esta linha que
>   sustenta a de cima: era o `height` EXATO que produzia o recorte, e do recorte
>   vinha o botão. Como piso, a seção continua reservando o vão com a lista vazia
>   — o desenho de abertura da Biblioteca, coleções empilhadas na base e o que
>   sobra em cima para os favoritos — e passa a crescer com o conteúdo,
>   empurrando as fechadas para baixo com a Biblioteca rolando, que é o que
>   qualquer outra seção aberta já faz. O `flex-shrink: 0` é o que faz o piso
>   valer: um `min-height` num filho que encolhe seria só uma sugestão.
>
> **`medirVaoDosFavoritos` não mudou uma linha, e o registro guarda isso**: a
> MEDIDA é a mesma pergunta ("o que sobra da tela depois das outras seções
> colapsadas?"); o que mudou é a seção deixar de ser presa a ela. E o padrão
> ABERTO continua sendo o `favAberto = true` do topo do arquivo, como desde a
> v5.276 — fechá-la segue sendo uma decisão do operador que dura a sessão.
>
> Os oráculos se dividem pela natureza: o `smoke.mjs` mede a COR (nos dois temas,
> e por igualdade de string em vez de razão de luminância — "igual" é igual, e um
> piso baixo aprovaria dois tons ligeiramente diferentes, que é a queixa) e o
> `boot-nativo.test.mjs` mede o TAMANHO, porque é o único que sabe pôr favoritos
> no banco. As DUAS metades do piso, e nenhuma basta sozinha: vazia a seção ainda
> reserva o vão, cheia ela passa dele sem cortar um item.
>
> Verificado por ISOLAMENTO: devolvendo o `height` no lugar do `min-height`,
> **2** asserções reprovam; devolvendo o tom próprio e o degrau de dentro, **4**.

> **A v5.281: A BARRA NÃO SE MEXIA — QUEM SE MEXIA ERA A PÁGINA INTEIRA. OTA
> PURO** (só CSS e o oráculo; sem Release).
>
> Pergunta do operador: *"a barra de pesquisa no topo não fica fixa durante a
> rolagem do corpo da biblioteca, você colocou um scroll no corpo deixando a
> barra fixa no topo?"*
>
> **Sim, e a estrutura estava certa — foi a primeira coisa medida.** A barra é
> irmã da lista, `flex-shrink: 0`, e a lista é `flex: 1; overflow-y: auto`:
> rolar `#hymnResults` 116px não move um pixel dela, em Chromium. Se a estrutura
> está certa e o operador vê a barra andar, o que se mexe não é a barra.
>
> **É a PÁGINA.** A rolagem que chega ao fim dentro de um scroller **encadeia**
> para o contêiner de trás, e do Android 12 em diante o excesso deixou de ser um
> brilho na borda e passou a ser o efeito STRETCH — a camada inteira é esticada
> e deslocada, barra fixa incluída. O dedo continua dentro da lista e a tela toda
> se mexe, que é exatamente a descrição.
>
> `overscroll-behavior: contain` no `.popup-list` corta o encadeamento, e ele não
> é novidade nenhuma neste app: `.lib-list`, `.lv-body` e `.simple-lyrics` — os
> outros três scrollers — já o têm. **O `.popup-list` era o único que não**, e
> ficou sendo desde que a Biblioteca virou uma tela cheia com uma barra fixa em
> cima. Mais `overscroll-behavior: none` na raiz, que fecha o caso pelo outro
> lado: um gesto que comece FORA de qualquer lista ainda produziria o stretch, e
> a página deste app nunca rola — ela é uma coluna de altura fixa com listas que
> rolam por dentro.
>
> **O que o oráculo pode e o que não pode.** Um navegador de mesa não reproduz o
> stretch do Android, então o caso afirma as duas coisas que ele alcança: a
> rolagem de VERDADE não move a barra (a estrutura), e a regra que desliga o
> encadeamento está no lugar (a causa). E ele precisou ser medido **depois** de
> uma coleção abrir — com tudo colapsado o vão dos favoritos é justamente o que
> sobra, a lista cabe inteira e não há rolagem a afirmar. É a segunda vez que
> essa propriedade do desenho aparece num caso deste arquivo.

> **A v5.280: O CABEÇALHO DA BIBLIOTECA SAI, a camada para de perseguir a
> viewport, a lista abre no topo, e o scroll interno dos favoritos é revogado.
> OTA PURO** (sem Release).
>
> Quatro decisões do operador, e três delas desfazem mecanismo meu.
>
> - **O TÍTULO SAI, e com ele o cabeçalho.** Ele foi encolhendo por partes e
>   chegou vazio de função: o "Baixar toda a biblioteca" e o peso total saíram
>   na v5.258, o ✕ desceu para a barra no mesmo lote, e o ícone saiu na v5.278.
>   O que sobrava era uma faixa inteira repetindo o nome do botão que abre a
>   tela — e a barra logo abaixo já diz o que ela é, pela lupa e pelo
>   placeholder.
> - **A CAMADA PARA DE PERSEGUIR A VIEWPORT VISUAL**, e o operador nomeou o
>   método certo: *"ao invés de ter um scroll de tela inteira, deixar apenas os
>   itens abaixo da barra de pesquisa ficarem dentro de um scroll, e apenas
>   rolar esse scroll para o topo quando a biblioteca é aberta"*. A v5.278 pôs
>   `top: var(--vv-top)` no `.popup-backdrop` para a barra não sair pela borda
>   quando o navegador rolasse a viewport visual — um conserto para um scroll de
>   TELA que não devia existir. Com o cabeçalho fora, a barra é o primeiro
>   elemento da folha e a única coisa que rola é a lista: não há o que
>   acompanhar. `inset: 0`, e a camada volta a ser a tela.
> - **E A LISTA ABRE NO TOPO.** `#hymnResults` é o MESMO nó entre uma abertura e
>   a seguinte, então ele guardava a rolagem da vez anterior e a Biblioteca
>   reabria no meio de um hinário. Uma linha no `openHymnSearch`.
> - **O SCROLL INTERNO DOS FAVORITOS É REVOGADO** — *"não ficou bom, deixe ele
>   fixo, e qualquer visualização dos itens completos deve ser pelo botão de ver
>   mais"*. A v5.279 tinha aberto uma segunda porta ao lado da que já existia:
>   com a rolagem, chegar ao fim da lista tinha DOIS caminhos, e um deles era
>   arrastar dentro de uma caixa encaixada numa tela que também rola — o gesto
>   ambíguo que o `overscroll-behavior` existia para remendar. O corpo volta a
>   ser um recorte imóvel e o caminho é UM.
>
> **O que FICA da v5.279 é a contagem dos dois lados** do botão "Ver todos", e
> ela fica com o comentário corrigido: hoje nada pode estar ACIMA da faixa, e
> aquela metade nunca dispara. Custa uma comparação e guarda o defeito que a
> v5.279 mostrou — com o corpo rolando, uma contagem de um lado só faz o botão
> sumir de quem chegou ao fim da lista.
>
> **E o caso da rolagem só discrimina com uma COLEÇÃO ABERTA**, que é uma
> propriedade do desenho e não do fixture: com tudo colapsado a lista nunca
> transborda, porque o vão dos favoritos é justamente o que sobra.
>
> Verificado por ISOLAMENTO: sem o reset da rolagem, **1** asserção reprova; com
> o scroll interno de volta, **1**; com a camada perseguindo a viewport, **1**;
> e o cabeçalho de volta reprova o caso da ordem da folha.

> **A v5.279: O CORPO DOS FAVORITOS ROLA POR DENTRO no modo compacto. OTA PURO**
> (sem Release).
>
> Pedido do operador. O vão é uma altura fixa (v5.277) e o que passava dela era
> simplesmente CORTADO: para chegar ao quinto favorito era preciso expandir a
> lista inteira, isto é, empurrar todas as coleções para fora da tela por causa
> de um item.
>
> **Ele NÃO substitui o "Ver todos"**, e as duas coisas respondem a perguntas
> diferentes: rolar é folhear alguns atalhos sem mexer no resto da tela;
> expandir é abrir mão do índice para ver a lista inteira de uma vez.
>
> **E O BOTÃO QUASE SUMIU JUSTAMENTE DE QUEM PRECISAVA DELE.** A contagem de
> itens de fora (v5.276) olhava só para BAIXO — o que era exato enquanto o corpo
> era um recorte imóvel. Com a rolagem, no fim da lista não há nada abaixo, e a
> régua devolveria zero: o "Ver todos" desapareceria para quem acabou de rolar
> até o fim e quer ver tudo. Ela passou a olhar os DOIS lados da faixa visível.
>
> `overscroll-behavior: contain` é o que impede a rolagem de VAZAR para a
> Biblioteca ao chegar no fim — sem ele, continuar arrastando dentro dos
> favoritos rola a lista de trás e o operador perde de vista a seção em que
> estava.
>
> **E o oráculo mediu a coisa errada na primeira versão.** Ele afirmava a
> rolagem escrevendo `scrollTop` — e uma caixa `overflow: hidden` **continua
> rolando por SCRIPT**: com a regra removida, ele passava (verificado, reprovava
> em 0). Quem não rola nela é o DEDO, e é o `overflow-y` COMPUTADO que responde
> por isso. Com a régua corrigida, a remoção reprova em 1; e contar um lado só,
> em 5.

> **A v5.278: A BARRA DE CIMA VOLTA A SEGUIR O QUE SE VÊ, o ícone do título sai,
> e o alvo dos botões da faixa passa a ser a linha inteira. OTA PURO** (sem
> Release).
>
> - **`--kb` E `--vv-top` NÃO SÃO A MESMA CONTA, e a v5.277 tirou as duas de uma
>   vez.** Relato: *"ajuste também para que essa barra do topo seja fixa
>   independente da rolagem da tela"*. `--kb` ENCOLHE a camada fixa (era o
>   *"deslocada inteira para cima"* que ele mandou tirar) e `--vv-top` apenas a
>   DESLOCA junto com a viewport visual, que o navegador rola sozinho ao revelar
>   o campo em foco. Sem a segunda, medido com uma rolagem de 140px: o cabeçalho
>   fica em `top: 0` da viewport de LAYOUT, isto é, **140px acima do que se vê** —
>   a barra sai pelo topo da tela. Voltou como `top` + `height: 100%`, e essa
>   forma é a decisão: a camada desce inteira, com a MESMA altura. Encolher é o
>   que ela não pode fazer — seria o reflow da queixa anterior —, e o pedaço que
>   sobra embaixo está debaixo do teclado, que o cobre de qualquer jeito.
> - **O ÍCONE DO TÍTULO SAI.** Com o cabeçalho e a barra fundidos numa peça só
>   (v5.277), a nota musical virou o terceiro símbolo de uma faixa que já tem a
>   lupa dentro do campo e o ✕ ao lado — sem distinguir nada, porque a tela é
>   uma só. A grade de três colunas que centrava o título saiu junto: filho
>   único num flex centrado já fica no meio.
> - **ERRAR POR TRÊS PIXELS NÃO DEVOLVE "NADA ACONTECEU".** Relato: *"é
>   extremamente comum tentar clicar em adicionar e acabar tocando no corpo do
>   card, abrindo os detalhes da letra"*. O botão tem 40px numa linha de 50 e
>   para a 8px da borda: sobram faixas mortas de ~5px acima e abaixo e 8px ao
>   lado — e elas não são neutras, porque o corpo da linha tem uma ação PRÓPRIA.
>   O alvo cresce por um `::after` até as bordas da linha e **o desenho não muda
>   um pixel**: encorpar o botão empurraria o nome, que é a única coisa da linha
>   que não se adivinha. Vale para os DOIS botões da faixa — o ▶ tem 38px na
>   mesma linha, isto é, a mesma faixa morta e o mesmo desfecho.
>
> **O oráculo do alvo mede o que o DEDO encontra** (`elementFromPoint`), não a
> caixa do botão: a queixa é sobre os pixels ao redor dele, e uma asserção de
> largura e altura passaria com as faixas mortas intactas. Ele cobra também a
> metade negativa — o meio da linha continua abrindo a gaveta da letra —, senão
> um alvo que engolisse a linha inteira passaria.
>
> Verificado por ISOLAMENTO: sem a expansão do alvo, **2** asserções reprovam;
> sem o `--vv-top` no topo, **1**.

> **A v5.277: O VÃO DOS FAVORITOS VIRA UMA MEDIDA DE TELA, a coleção rola até o
> topo dela, o teclado volta a SOBREPOR, e a barra de título vira uma peça só.
> OTA PURO** (sem Release).
>
> Quatro relatos, e os dois primeiros são o mesmo defeito visto de dois ângulos.
>
> - **FLEX REPARTE, e era isso que encolhia os favoritos.** *"Ao abrir uma
>   coleção, ele encolhe os favoritos para dar espaço à coleção aberta,
>   dividindo os espaços… eu quero que o espaço dos favoritos seja fixo, mas
>   seja o espaço proporcional que sobrou após listar as outras coleções
>   abaixo."* `flex: 1 1 auto` é uma regra de PARTILHA — dois itens que crescem
>   dividem o que sobra —, e a lista de atalhos passava a mudar de tamanho
>   conforme o que o operador abrisse noutro lugar da tela. `--fav-vao` é agora
>   uma altura em PIXELS, medida em JS a partir das BARRAS das outras seções,
>   isto é, do que sobra da tela com todas elas COLAPSADAS: a conta **não
>   depende de qual coleção está aberta**, que é a propriedade inteira.
> - **E O "ABRINDO PARA CIMA" ERA ESSE ENCOLHIMENTO.** Com o vão fixo, o que
>   faltava é a outra metade do pedido: uma coleção aberta no fim da lista
>   cresce para fora da tela, e quem a abriu fica olhando a barra dela sem ver um
>   item. `alinharGrupoNoTopo` rola a lista até o topo da seção — **depois da
>   animação do acordeão**, e essa espera é o achado: durante os 220 ms da
>   abertura o conteúdo ainda não existe e a lista não tem para onde rolar. A
>   primeira versão usava `requestAnimationFrame`, mediu o layout COLAPSADO e
>   rolou **7px de 59 possíveis** (verificado). Quando não há conteúdo abaixo que
>   leve a seção até o topo, ela rola até o fim, que é o mais perto que existe.
> - **O TECLADO VOLTA A SOBREPOR** — *"a tela está sendo deslocada inteira para
>   cima… ajuste apenas para o teclado ficar sobreposto à tela e não deslocar
>   ela"*. Isto REVOGA o `inset` da v5.261 no `.popup-backdrop`, e o argumento
>   dele morreu junto com a barra na base: ele descia a camada fixa até a faixa
>   visível para a busca encostar no teclado em vez de ficar atrás dele. Com a
>   barra no topo (v5.275) não há nada embaixo que precise ser revelado, e o que
>   sobrava era só o efeito colateral. **O `.dialog-backdrop` FICA com a conta**,
>   e a diferença é a razão dela: o `appPrompt` é um cartão CENTRADO com campo de
>   texto, e ali a metade de baixo é onde o teclado sobe.
> - **O CABEÇALHO E A BARRA VIRAM UMA PEÇA.** Mesmo fundo (`--field-bar`),
>   porque duas faixas fixas empilhadas sobre a mesma lista são uma barra só. O
>   TÍTULO centra numa grade de três colunas — centrar a linha flex centraria o
>   PAR ícone+título e deixaria a palavra 14px fora do meio, medidos. E o ✕ ficou
>   QUADRADO por um número com nome (`--campo-alt`, a altura do campo e o lado do
>   botão): **`aspect-ratio` não resolve isso dentro de um flex**, porque a
>   largura é resolvida ANTES de o `stretch` dar uma altura definida — a primeira
>   versão colapsou o botão na largura do glifo, 20px.
>
> Verificado por ISOLAMENTO, uma peça de cada vez: devolvendo o vão ao flex,
> **2 + 2** asserções reprovam; sem o alinhamento, **1**; com o teclado
> deslocando de novo, **3**; com o cabeçalho e o ✕ antigos, **8**.

> **A v5.276: OS FAVORITOS SAEM DO RODÍZIO, a coleção aberta para de inchar, e
> o "Ver todos" passa a contar ITENS. OTA PURO** (sem Release).
>
> Três correções do mesmo relato, e a terceira é a que mais ensina.
>
> - **O BOTÃO CONTAVA A CAIXA, e a caixa não é a pergunta.** Relato: ele aparece
>   *"literalmente sem nenhum item na lista"*. `scrollHeight > clientHeight` é a
>   medida certa para "esta caixa transbordou" e a errada para o que o operador
>   pediu — *"apenas quando há mais itens do que a altura disponível"*. Numa
>   Biblioteca com OITO seções (a dele) o vão é pequeno, a seção dos favoritos é
>   a única que encolhe, e o que sobra do corpo recorta até a linha de "Nenhum
>   favorito ainda": a caixa transborda com a lista VAZIA. Agora ele conta os
>   filhos cujo rodapé passa do corpo, ignorando o `.empty` — com zero itens a
>   resposta é zero, e não há medida de caixa que a produza.
> - **OS FAVORITOS SAEM DO RODÍZIO** — *"agora não mais são concorrentes com os
>   favoritos… as coleções são concorrentes entre si, mas não com os
>   favoritos"*. A v5.273 pôs as duas coisas no mesmo nome, e o preço é que
>   abrir um hinário custava o atalho que estava aberto, e reabri-lo custava
>   fechar o hinário: duas decisões diferentes disputando um interruptor. São
>   dois estados agora (`grupoAberto` para as coleções, `favAberto` para eles), e
>   o `''` virou um valor legítimo — nenhuma coleção aberta é o estado normal de
>   quem está olhando os favoritos. O toque na seção deles volta a fechá-la e a
>   reabri-la, que é o que a v5.262 pedia e a v5.273 tinha tirado ao torná-los o
>   piso.
> - **E SÓ ELES CRESCEM.** *"Coleções com menos itens como o hinário, ou os
>   arquivos oficiais… expandem mais do que precisaria em relação à quantidade e
>   altura necessária para os itens atuais, pois eles estavam com um tipo de
>   altura flex que ao fechar os favoritos ocupa o que sobra"* — dois cards com
>   meia tela de fundo vazio embaixo. Uma coleção aberta passou a medir o
>   conteúdo dela e nada mais; o vão continua sendo dos Favoritos, que são a
>   única seção com razão para tê-lo (uma lista de atalhos vazia ainda é o lugar
>   em que o próximo entra).
>
> **O ORÁCULO NÃO PEGAVA O DEFEITO DO BOTÃO, e a razão é a lição do lote:** o
> fixture tinha DUAS seções e sobrava tela à vontade, então nada era recortado e
> a régua velha dava a mesma resposta que a nova. Ele passou a montar as OITO
> seções do relato — é a condição, não o número de favoritos, que produz o
> defeito — e a asserção virou uma EQUIVALÊNCIA medida nos três estados: o botão
> existe exatamente quando há item de fora, sem lista, com poucos e com muitos.
> Com a régua antiga de volta, reprova em 2 (verificado); antes, em 0.
>
> Verificado por ISOLAMENTO nas outras duas: devolvendo os favoritos ao rodízio,
> **3** asserções do `boot-nativo.test.mjs` reprovam; fazendo toda seção aberta
> crescer, **2** do `smoke.mjs`.

> **A v5.275: A BARRA DE BUSCA DA BIBLIOTECA VOLTA AO TOPO. OTA PURO** (só HTML,
> CSS e os oráculos; sem Release).
>
> Decisão do operador: *"vamos fazer um ajuste e colocar a barra de buscas da
> biblioteca no topo novamente, ela na base está dando muitos problemas de
> design"*. Isto REVOGA a segunda metade da v5.258.
>
> **O argumento daquele lote continua verdadeiro, e o preço está dito.** Ele era
> de ALCANCE — *"eles estão muito longe do teclado e do toque de acesso"* —, e
> no topo corrigir a busca com o teclado aberto custa a tela inteira de percurso
> do polegar. O que o desmentiu foi o PREÇO DA POSIÇÃO, e ele está escrito neste
> arquivo em quatro notas seguidas: **quatro lotes consertando o entorno dela**
> — a folha que não via o teclado (v5.261), o teclado subindo durante o fade
> (v5.264), o tom e a sombra que faltavam (v5.266) e o degrau do tema claro
> (v5.270). Quatro lotes em volta de uma posição são a posição dizendo que não
> se paga, que é o mesmo veredito que a v5.263 deu à animação de slide desta
> mesma tela. **No topo ela não tem entorno**: nada a empurra, nada a cobre, e
> ela não precisa saber onde o teclado está.
>
> **O que FICA da era da base, porque nunca foi sobre estar embaixo:** o ✕
> depois do campo (é o fim da linha em toda folha deste app, e o cabeçalho ao
> lado não tem mais nenhum), a LUPA dentro do campo (o placeholder some no
> primeiro caractere digitado) e o TOM próprio com a SOMBRA. Esta última
> **inverte**: ela diz de que lado o conteúdo passa, e a lista deixou de rolar
> por cima da barra para rolar por baixo dela. Uma sombra que ficasse apontando
> para cima é a marca de quem moveu a peça e esqueceu o que ela dizia — daí ela
> ter asserção própria.
>
> **E a área segura trocou de dono.** `#hymnSearchPopup .popup-sheet` zerava o
> `padding-bottom` porque quem terminava a folha era a barra, e a conta estava
> nela; agora quem termina é a LISTA, e sem devolver a conta à folha o último
> item ficaria debaixo da barra de gestos do Android.
>
> Os dois casos do `smoke.mjs` mudaram de lado junto — a ORDEM da folha
> (cabeçalho → barra → lista) e a geometria com o teclado de mentira. Eles
> continuam travando o que a v5.261 descobriu, que não era sobre a barra: a
> folha tem de ser a FAIXA VISÍVEL, senão o que é fixo sai pelo topo da tela.
>
> **Um caso instável foi consertado no caminho, e ele não é deste lote.** O da
> assinatura da série (v5.233) reprovava em ~1 de 11 execuções: ele conta
> extrações do YouTube, e o `autoRefreshCollections` da abertura roda SEM
> `await` — uma extração em voo caía no intervalo medido e era lida como "a
> economia não valeu". A linha de base passou a ser tomada com o laço assentado,
> e a asserção continua discriminando (uma economia quebrada custaria a dúzia de
> playlists da série, não uma unidade). Onze execuções seguidas no verde.

> **A v5.274: A SEÇÃO ABERTA CENTRAVA E ESPREMIA O QUE HAVIA DENTRO DELA — e
> a causa foi trocar o `display` de um elemento. OTA PURO** (só CSS e os
> oráculos; sem Release).
>
> Relato do operador sobre a v5.273: *"os cards ficaram com seus elementos
> centralizados de forma incorreta, desalinhando e espremendo cabeçalhos e
> listas"* — com prints em que "HINÁRIOS 3,2/8,9 GB" aparece centrado na barra e
> as linhas do Informativo vazam pelos DOIS lados do card.
>
> **A causa é de uma linha, e ela é a mesma família da v5.269.** `.coll-group`
> (a classe base) é `display: flex; align-items: center; gap: .5rem` — e o
> `.coll-group--drop` a neutralizava com `display: block`. Pôr a seção ABERTA em
> `display: flex` para ela poder crescer **ressuscitou as duas propriedades que
> estavam dormindo ali**: `align-items: center` fez cada filho encolher ao
> próprio texto e se centrar (a barra), e vazar pelos dois lados quando o texto
> era maior que o card (as linhas); o `gap` acrescentou 8px entre a barra e o
> corpo. Medido: a barra tinha **204px** e o corpo **251px** dentro de uma seção
> de 408. A régua que fica é maior que este defeito: **trocar o `display` de um
> elemento não acrescenta um comportamento — ele ATIVA todas as propriedades de
> layout que já estavam escritas nele.** Remover uma declaração devolve o valor
> de quem estava embaixo (v5.269); trocar o `display` acorda o que estava mudo.
>
> **E o botão "Ver todos" era vítima do mesmo defeito.** Ele mede o transbordo
> do corpo (`scrollHeight > clientHeight`), e um corpo cujos filhos vazam pelos
> lados e ganham 8px de folga transborda sem ter conteúdo demais — daí ele
> aparecer com uma lista que cabia. O caso do oráculo passou a exercitar a régua
> no MEIO do caminho (três favoritos, não zero), que é o que o operador
> descreveu: *"apenas apareça quando a lista de favoritos for maior que a área
> de visualização disponível"*.
>
> **DOIS buracos de cobertura foram fechados no caminho, e o segundo é a lição
> do lote.** O primeiro é a asserção que faltava: as LARGURAS dentro da seção
> aberta — um filho que se recusa a esticar mede menos que o contêiner, e um que
> vaza mede mais, então uma medida só pega os dois. O segundo apareceu porque eu
> escrevi a prosa desta nota FORA do comentário de CSS (o `*/` ficou antes
> dela): o parser descartou o bloco inteiro, a regra geral da seção aberta
> **morreu**, e nenhuma das cinco asserções do lote reprovou — os Favoritos têm
> um `flex-grow` PRÓPRIO, então a única seção que o oráculo media continuava
> crescendo. Uma regra geral só provada pelo caso que tem exceção própria não
> está provada. Agora há uma asserção que abre uma seção QUALQUER e exige que a
> lista termine cheia; com a regra morta, ela reprova nos dois temas
> (verificado).

> **A v5.273: A BIBLIOTECA FICA COM UMA SEÇÃO ABERTA POR VEZ, e a dos Favoritos
> ocupa o vão que sobra. OTA PURO** (nenhuma linha de Kotlin; sem Release).
>
> Pedido do operador, em quatro partes: *"só permita uma coleção aberta por vez
> e sempre deixe uma aberta, no caso a dos favoritos, onde ela só fecha se outra
> for aberta. Ajuste para que a seção dos favoritos ocupe a altura que sobra
> além do espaço das outras seções no formato colapsado (mesmo que não haja
> nenhum favorito)… caso tenha mais itens do que cabe nesse vão, vai ter um
> botão na sua base que permite a expansão total da lista. Inclusive aproveite
> para: deixar a cor de fundo da coleção dos favoritos em uma cor diferente, um
> tom mais escuro. E aproveite também para aumentar ligeiramente o espaço entre
> as outras coleções, elas estão muito coladas entre si"*.
>
> *(A v5.276 REVOGOU duas metades desta nota: os Favoritos saíram do rodízio —
> abrir uma coleção não os fecha, e o toque neles volta a recolher — e o
> crescimento passou a ser só deles, porque uma coleção curta inchava até o
> tamanho do vão. E a v5.282 revogou as outras duas: o BOTÃO "Ver todos" e o TOM
> PRÓPRIO saíram, com o vão virando um `min-height` — "não ficou bom". O que
> fica desta nota é o rodízio ENTRE as coleções, a régua do vão e o espaço entre
> seções.)*
>
> - **O ESTADO VIROU UM NOME, e é ele que faz a regra valer.** `gruposAbertos`
>   era um `Set`, isto é, sabia escrever exatamente os dois estados que o pedido
>   proíbe — duas abertas e nenhuma aberta —, e mantê-los fora do alcance
>   exigiria uma guarda em cada ponto que o escreve. Com `grupoAberto` sendo um
>   nome só, "duas abertas" deixa de ser uma regra que alguém precisa lembrar:
>   é uma frase que não dá para escrever. Fechar a aberta escreve
>   `GRUPO_FAVORITOS` e nunca o vazio — o "sempre uma aberta" pelo outro lado —,
>   e tocar nos Favoritos abertos é um NO-OP declarado, porque fechá-los para
>   reabri-los seria um piscar sem desfecho. **Isto REVOGA a v5.237**
>   (*"abrir um grupo não fecha os outros: aqui os grupos são curtos, e comparar
>   dois deles é o que se faz numa tela de índice"*) e metade da v5.262 (o toque
>   nos Favoritos recolhia). O argumento da v5.237 supunha que a tela cabe; o
>   pedido é sobre o que fazer quando ela não cabe.
> - **QUEM SE ESTICA É A ABERTA**, e isso é consequência da decisão de cima, não
>   uma segunda regra: com uma por vez não há o que escolher — é sempre a única
>   com conteúdo, e as fechadas viram barras de altura fixa empilhadas na base.
>   `flex-shrink` é ZERO ali: uma seção com mais álbuns do que cabe empurra as
>   de baixo e quem rola é a Biblioteca, como sempre foi. **Os Favoritos são a
>   exceção** — só eles encolhem, e é dessa exceção que o botão fala.
> - **O TRANSBORDO É MEDIDO, nunca deduzido da contagem.** Quantos favoritos
>   cabem no vão depende de quantas seções existem, de haver ou não pasta do
>   aparelho, da altura da tela e do teclado; um número no código estaria errado
>   no primeiro aparelho diferente. `scrollHeight > clientHeight` responde pelo
>   que de fato aconteceu no layout — num `requestAnimationFrame`, porque no
>   instante em que a lista é montada o `li` ainda não foi disposto e as duas
>   medidas seriam iguais (o botão nunca apareceria).
> - **O TOM PRÓPRIO VALE ABERTA E FECHADA**, e arrasta o degrau de dentro. As
>   medições estão em `tokens.css`; a que decide é 1,30:1 (escuro) e 1,48:1
>   (claro) contra o `--panel` das outras seções. `--camada` desce junto porque,
>   no tema CLARO, deixar as linhas em `--panel-2` sobre o `--fav-bg` novo daria
>   **1,05:1** — elas sumiriam. É a disciplina de sempre: um nível que muda
>   arrasta o de dentro.
> - **E O `gap` DAS SEÇÕES DEIXOU DE SER O DAS LINHAS** (.6rem contra .35rem):
>   uma seção não é uma linha, é um bloco que contém linhas, e usar a mesma
>   medida nos dois níveis era o que os fazia se ler como uma pilha só. Escopado
>   em `#hymnResults` e nunca na classe — o mesmo `.popup-list` é a fila da
>   playlist e o conteúdo de uma pasta.
>
> Verificado por ISOLAMENTO: sem o crescimento, **4** asserções do `smoke.mjs`
> reprovam; sem o tom próprio, **2**; sem o espaço, **2**; sem a medição do vão,
> **3** do `boot-nativo.test.mjs`; e sem o piso dos Favoritos (fechando-os no
> próprio toque), **2**.
>
> **E a primeira versão do caso do vão passava sem medir a regra.** Ela comparava
> a altura da seção aberta com a de uma barra fechada — e uma seção aberta é
> naturalmente mais alta que uma barra, com ou sem `flex-grow`. O que ela precisa
> comparar é o VAZIO que a seção absorveu (altura menos o conteúdo dela) contra
> uma seção fechada inteira: com o crescimento removido sobram ~12px de padding
> próprio, que é uma folga, não um vão.

> **A v5.272: CINCO RELATOS DA LISTA — e dois deles eram recursos que nunca
> chegaram a existir. OTA PURO** (sem Release).
>
> - **EXCLUIR ENTRA NO `⋮`**, nas duas listas (Cronograma e Favoritos). Até aqui
>   excluir era um caminho só, e era o de LOTE: toque longo → seleção múltipla →
>   a lixeira do rodapé. Para tirar UM item isso é três gestos e um modo. **A
>   semântica é a mesma do lote, e de propósito:** sai da LISTA (`listRemove`) e
>   o coletor decide o resto — se o item também estiver noutra lista, ele fica lá
>   e os bytes ficam. Duas definições de "excluir" no mesmo app seriam a
>   divergência que o `deleteSelected` já evitou uma vez. Na PASTA DO APARELHO
>   ele não entra: ali excluir apaga o arquivo físico, e um mesmo ícone com dois
>   alcances conforme a tela é a pior forma de oferecer um destrutivo.
> - **A LINHA-GUIA DO REORDENAR ESTAVA FORA DE LUGAR NOS FAVORITOS**, e a causa é
>   de uma linha: ela é `position: absolute` e mora dentro da `<ul>`, então a
>   `<ul>` precisa ser o BLOCO CONTENDOR — o que valia por ACIDENTE, porque o
>   Cronograma é uma `.lib-list` (que declara `position: relative` desde sempre)
>   e os Favoritos são uma `.popup-list` (que não declara). Lá a guia se
>   posicionava contra o `.popup-backdrop` FIXO usando coordenadas medidas em
>   relação à lista: *"completamente fora de sincronia e posição"*, palavra por
>   palavra. A garantia passou a vir do JS e não de uma regra por lista, porque o
>   conjunto de listas que hospedam um arrasto cresce — a v5.237 já acrescentou
>   uma terceira, e o modo de falhar é silencioso e só visível com o dedo em cima.
> - **AS FAIXAS DO ÁLBUM GANHARAM CORPO** — *"os itens ficam soltos no mesmo
>   ambiente, dificultando a visualização de sua área de toque"*. É o degrau que
>   a v5.267 não deu: ela tirou o filete e pôs o ESPAÇO no lugar, mas deixou a
>   faixa sem fundo, e **um vão da mesma cor dos dois lados não separa nada**. O
>   preenchimento é o RECESSO do cartão (overlay, que preserva a direção nos dois
>   temas), e não um quarto tom da escada — aquele levaria o nível mais interno a
>   onde `--muted` reprova AA.
> - **O INFORMATIVO VOLTA A DIZER QUE SÉRIE É.** Relato: os itens saem *"apenas
>   com o nome com a data, mas sem a identificação de 'Informativo Mundial das
>   Missões'"*. A v5.244 escolheu só a data com um argumento que era verdadeiro
>   DENTRO do álbum (o cabeçalho já diz a série; repetir o nome em 52 linhas é a
>   metade constante ocupando a lista). **O que ele não viu é que o item SAI do
>   álbum:** no Cronograma ou nos Favoritos ele perde o cabeçalho e vira
>   "15/Ago · YouTube", sem nada em tela nenhuma que o identifique. Entrou o modo
>   `TITULO_SERIE`, com um `rotulo` SEM o ano — o ano já está na data ao lado.
> - **E O TOQUE LONGO SAI DOS FAVORITOS.** Relato: *"ao segurar em um item da
>   lista de favoritos, ele entra no modo de multiseleção, mas as opções aparecem
>   na tela do cronograma"*. Ele está descrevendo um modo que **nunca existiu
>   nesta lista**: `enterSelection` liga o estado e chama `renderLibrary()` — que
>   redesenha o CRONOGRAMA —, enquanto o `favItemRow` nunca leu `selectionMode`,
>   isto é, a linha não ganhava caixa de marcação nem realce. O que aparecia na
>   outra tela era a barra de um modo que aqui não tinha o que operar.
>
>   **E o buraco era mais fundo que o desenho:** as ações daquela barra são
>   keyadas pelo `activeTab` (ver `deleteSelected`), que aqui aponta para a lista
>   ATRÁS da Biblioteca — a lixeira teria apagado itens do Cronograma. Desenhar o
>   modo seria consertar a metade que se VÊ de um defeito cuja outra metade
>   DESTRÓI. O que ele daria a esta lista — excluir sem sair dela — é o primeiro
>   item deste lote, e está a um toque na própria linha.
>
> Verificado por ISOLAMENTO: sem as três correções dos Favoritos, **4** asserções
> do `boot-nativo.test.mjs` reprovam; sem o preenchimento da faixa, **2** do
> `smoke.mjs`.
>
> **E o `display-smoke` voltou ao verde — ele reprovava um app que estava certo.**
> Aquele caso (v5.179) arma a guarda que cala o `sendStatus` do meio do fade,
> resolve, e afirmava "viajou UM status". A afirmação supõe que nada mais
> estivesse em voo, e havia: o `clear` do passo ANTERIOR tem fade de ~0,6 s e um
> `aoSairDeCena` próprio, cujo `then` emite o status final depois de o caso ter
> zerado o espião. Chegavam dois, **os dois corretos** (palco vazio,
> `playing: false`), e a contagem reprovava. Agora ele espera o fade anterior
> assentar (`saindoDeCena === 0`) e mede as DUAS metades no instante de cada uma
> — nada viaja durante o fade; um status sai no fim —, o que também diz QUAL
> delas quebrou, coisa que uma contagem no fim nunca diz. Verificado nos dois
> sentidos: tirando a guarda do `display.js`, as duas reprovam; e cinco execuções
> seguidas passam, que era a outra metade do problema (um teste que reprova de
> vez em quando ensina a ignorar vermelho). Nenhuma linha da base web mudou —
> este conserto é do oráculo, e por isso não há versão nova.
>
> **E o oráculo dos Favoritos quase mediu a lista errada.** Os itens do caso
> nascem no Cronograma (é de lá que se favorita), então um `querySelector` de
> documento acha a linha DE LÁ — que é posicionada e tem seleção múltipla. Ele
> teria passado pelo motivo errado, aprovando o defeito; a busca é escopada ao
> `[data-fav-corpo]`.

> **A v5.271: TRÊS AJUSTES DA LISTA — o Parar toma o lugar da capa, o `⋮` para
> de mexer o cartão, e o LINK do YouTube entra no ar como qualquer outro item.
> OTA PURO** (sem Release). *(O número saltou o 5.270: um lote paralelo o tomou
> enquanto este era escrito — ver a nota abaixo.)*
>
> Os dois primeiros são de desenho e o terceiro é de comportamento — e é ele que
> importa mais, porque estava mentindo na tela.
>
> - **O PARAR OCUPA A MINIATURA, e não fica por cima dela.** Pedido do operador:
>   *"ele cria por cima dela, faça com que seja apenas o botão de stop sem ser
>   por cima, para que fique menos poluído visualmente"*. Ele era um véu preto a
>   55% sobre a arte com o glifo em cima — três camadas num quadrado de 40px, e a
>   de baixo só atrapalhava: a capa não é legível atrás do véu e não decide nada,
>   porque a linha já diz de que item se trata pelo nome e pelo selo. Escondido o
>   conteúdo da miniatura, o que sobra é um botão com o MESMO preenchimento dos
>   outros da linha (`--surface`, que ali dentro afunda). O véu sai junto com a
>   razão dele: sem foto por baixo, não há o que neutralizar. Medido, o glifo dá
>   6,02:1 no escuro e 4,09:1 no claro — acima do piso de 3:1 de um ícone.
> - **O `⋮` NÃO ENCOLHE MAIS O CARTÃO** — *"como ele abre uma visualização, o
>   movimento da caixa polui o conjunto"*. Ele está certo pela régua do próprio
>   app: a linha encolhe para dizer "o toque pegou" quando não há outra resposta,
>   e aqui HÁ, e ela é grande — uma gaveta que cobre o título inteiro. Duas
>   respostas ao mesmo toque, uma mexendo a caixa por baixo da outra que está
>   entrando. O BOTÃO continua encolhendo (é ele que foi tocado); o cartão, não.
>   **E os botões entram DA DIREITA**, escalonados pelo FIM da lista
>   (`nth-last-child`), então o primeiro a chegar é o mais à direita — a borda de
>   onde eles vêm — e a regra vale igual com dois botões ou com cinco. Quem
>   desliza são os BOTÕES e não a faixa: a faixa é a tampa opaca que cobre o
>   título, e movê-la o descobriria durante toda a animação, que é o defeito que
>   a v5.259 já corrigiu por outro caminho. De brinde, o `visibility` entrou na
>   transição: fora dela a propriedade é discreta e virava `hidden` no primeiro
>   quadro, então o FECHAMENTO nunca foi visto em versão nenhuma.
> - **O LINK DO YOUTUBE ENTRA NO AR.** Relato: *"um arquivo do tipo YouTube… pode
>   ser tocado diretamente online no player, mas o respectivo elemento da lista
>   do cronograma ou favorito não entra no modo 'no ar'"*. A causa é uma
>   assimetria entre os dois caminhos do `resolverLinkYoutube` (v5.212): pelo
>   DOWNLOAD o arquivo toma o lugar do link EM POSIÇÃO, então a linha passa a ter
>   o id da mídia; pela TRANSMISSÃO DIRETA, não — a mídia é um avulso com id
>   próprio, o link continua na lista com o dele, e nada ligava os dois.
>
>   **E não era só o realce.** `noArAgora` responde pela MESMA pergunta, então o
>   SEGUNDO TOQUE (que retira do ar) também não alcançava aquela linha: ela
>   reprojetava em vez de retirar — o defeito que a v5.165 existiu para
>   consertar, reaberto por outra porta. Um realce que dissesse uma coisa e um
>   gesto que fizesse outra seria pior que o defeito inteiro.
>
>   `midiaNoArOrigem` é o campo que faltava, e ele é o mesmo formato do
>   `cueNoArId` pela mesma razão: **quem está no ar e quem PÔS no ar podem ser
>   dois registros diferentes, e a lista fala do segundo.** Ele é escrito só
>   naquele caminho e DEPOIS do `tentarTransmitir` — que termina em `send()`, e é
>   o `send` que o zera. Essa ordem é a única forma de errar isto, e é o que o
>   oráculo exercita: ele substitui o `tentarTransmitir` por um que faz o que o
>   de verdade faz no fim, em vez de pular a chamada.
>
> Os oráculos foram verificados por ISOLAMENTO, uma peça de cada vez: sem a
> origem, **3** asserções do `boot-nativo.test.mjs` reprovam; devolvendo o véu e
> a capa, o feedback no cartão e o deslize, **4** do `cena.test.mjs`.
>
> **E dois defeitos foram do próprio teste, os dois da mesma família — medir no
> turno errado.** O caso do deslize lia o `transform` no mesmo turno em que
> acrescentava a classe, e ali o computado ainda é o valor de PARTIDA: ele
> aprovaria uma gaveta sem animação nenhuma e reprovaria a que existe. E o caso
> da pressão no `⋮` derrubava o caso seguinte, porque um `mouse.down` + `up`
> completo É UM CLIQUE — ele abria a gaveta, e o `abrirGaveta` de baixo a
> fechava.
> **A v5.270: A BARRA DA BUSCA ESCURECE NO TEMA CLARO, e o ✕ vira o irmão do
> campo. OTA PURO** (só CSS; sem Release).
>
> Pedido do operador, em três partes: *"ajuste o botão de fechar biblioteca para
> que tenha a mesma altura da caixa de texto de buscas. e faça com que o fundo
> atrás da caixa de texto fique mais escuro no tema claro, aproveitando para pôr
> o botão em cor clara também."*
>
> - **A BARRA DEIXA DE SER NÍVEL 1, e isso é o conserto que a v5.268 contornou.**
>   Ela vestia `--camada` — e no tema CLARO esse nível É o branco, exatamente a
>   cor do campo que ela contém: **1,00:1**. A v5.268 sustentou a distinção pela
>   ELEVAÇÃO, que funciona e é meia resposta; o operador pediu o degrau de tom, e
>   ele está certo. `--field-bar` é a exceção declarada à escada de camadas: **a
>   barra é o único bloco de nível 1 do app que hospeda uma superfície SEM TEMA**,
>   logo é o único que não pode ler o tom do nível. Medido no claro: o campo
>   passou de 1,00 para **2,51:1** contra ela, e ela dá 1,95:1 contra o corpo (era
>   1,29). No ESCURO nada muda — o token repete o valor de hoje, porque ali o
>   campo branco já contrastava 12,6:1 e não havia o que consertar.
>
>   O valor do claro é `#97a5b4`, o mesmo de `--line`, e isso é reuso e não
>   coincidência: é o cinza estrutural que esta paleta já calibrou para separar
>   coisas no tema claro.
> - **O ✕ TEM A ALTURA DO CAMPO.** Ele vinha do esqueleto de botão de ícone do
>   app (`--hit` quadrado, 34px) e o campo tem 40 — dois vizinhos na mesma linha
>   com seis pixels de diferença que ninguém decidiu. `align-self: stretch`, e
>   não uma altura escrita: quem manda na linha é o campo, e um número aqui
>   divergiria dele no primeiro ajuste de padding ou de fonte. A LARGURA continua
>   `--hit` (o alvo horizontal não tem por que crescer) e o raio passa a ser o do
>   campo.
> - **E ELE É CLARO, como o campo** — a outra metade do mesmo pedido, e ela é
>   consequência da primeira: com a barra escurecida, um botão em
>   `--surface-2`/`--muted` daria **2,09:1** no glifo. Vestindo `--field-*` ele
>   vira o irmão do campo, as duas peças claras sobre a faixa, e o glifo volta a
>   8,86:1.
>
> **A elevação da v5.268 FICA**, agora como reforço em vez de único sinal: com o
> degrau de tom no lugar, ela é o que faz as duas peças se lerem como papel
> pousado na faixa em vez de recortes dela. O oráculo mudou de pergunta junto —
> onde ele aceitava "tom OU elevação", ele passou a exigir o TOM (> 1,5:1) e a
> cobrar a elevação em separado.
>
> Verificado por ISOLAMENTO: devolvendo a barra ao `--camada`, **1** asserção
> reprova (e é a do tema claro, em 1,00:1); devolvendo o ✕ ao esqueleto de 34px e
> ao chip translúcido, **5** — entre elas o glifo em 1,75:1.


> **A v5.269: TIRAR A BORDA NÃO É REMOVER A BORDA — o `<button>` já vem com uma
> do navegador. OTA PURO** (só CSS e o oráculo; sem Release). *(O número saltou
> o 5.268: um lote paralelo o tomou enquanto este era escrito — ver a nota
> abaixo. O relato é sobre a v5.267 no aparelho.)*
>
> Relato do operador, sobre a v5.267 no aparelho: *"os botões agora estão usando
> o sistema de sombras nativo padrão do sistema, isso está criando um contorno
> bicolor no geral nos botões que foi removido as linha de borda… a exemplo
> seriam os botões do controle do modo avançado."*
>
> **Ele está certo, e o diagnóstico dele é literal: aquilo é o desenho nativo.**
> A folha do UA dá a todo `<button>` um `border: 2px outset` e a todo
> `<input>`/`<textarea>` um `2px inset` — e `outset` é um BISEL, isto é, duas
> cores. Ao tirar as ~80 declarações de `border` da v5.267 eu não removi borda
> nenhuma daqueles controles: **deixei passar a do navegador.** Medido no
> renderizado: `2px outset rgb(0, 0, 0)` no transporte, no mixer, no "Guardar a
> fila", no estado do telão, no botão de atualização e nos dois da folha de
> conectar. O `appearance: none` que muitos deles já declaravam não cobre isso —
> ele desliga o desenho nativo do CONTROLE, não a borda da folha do UA.
>
> A correção é uma linha, e o lugar dela é a decisão: **`border: 0` no reset
> universal**, não `border: none` em cada regra. Escrever componente a
> componente seria a mesma sincronização manual que este projeto recusa em toda
> parte, com um modo de falhar pior — o esquecimento não aparece na folha,
> aparece no aparelho, que é exatamente como este chegou. `*` não alcança
> pseudo-elemento, então os dois DESENHOS feitos de borda (o aro do `.dl-ring`,
> o ✓ do seletor de destinos) sobrevivem sem precisar de exceção.
>
> **E o oráculo que faltava é o do RENDERIZADO.** `tools/tokens.test.mjs` varre
> a FONTE e prova que nenhuma regra NOSSA desenha contorno — ele é cego POR
> CONSTRUÇÃO para este defeito, porque o defeito é a AUSÊNCIA de uma declaração.
> O caso novo do `smoke.mjs` mede a cor e a largura computadas de todo elemento,
> e ABRE cada tela em que os controles moram (transporte, mixer, Ferramentas,
> Bíblia, Biblioteca, Exibição, Modo Fácil) antes de medir: os botões que o
> operador viu e os que só existem numa aba nunca estão na mesma tela, e um caso
> que medisse só a tela inicial teria passado com o defeito inteiro no lugar.
>
> A régua que fica, e ela é mais larga que CSS: **remover a nossa declaração de
> uma propriedade não a zera — devolve o valor de quem estava embaixo.** É a
> mesma família do `optBoolean` lendo campo ausente como `false` e do `ritmo`
> zerado da v5.206: a ausência não produz silêncio, produz um padrão que alguém
> interpreta.
>
> Verificado por isolamento: tirando só o `border: 0` do reset, a varredura do
> renderizado reprova sozinha.
> **A v5.268: O CAMPO DE BUSCA FICA BRANCO NOS DOIS TEMAS. OTA PURO** (só CSS;
> sem Release).
>
> Pedido do operador: *"coloque a caixa de texto em branco, para o tema claro e
> o escuro."*
>
> Ele era um OVERLAY — a superfície INVERTIDA de dentro de um bloco, isto é, um
> recesso preto a 14%/20%: o desenho de um botão afundado, para a única peça da
> tela em que se DIGITA. Branco, ele deixa de ser um degrau da base e passa a ser
> uma folha de papel sobre a barra.
>
> **Três metades, e só a primeira está no pedido.**
>
> - **O FUNDO.** `--field-bg`, branco literal, e é a SEGUNDA exceção declarada à
>   regra "não escrever branco fora do palco". O argumento daquela regra continua
>   de pé e o preço está dito: num salão escuro este é o retângulo mais luminoso
>   da tela. Ele é pequeno, só existe com a Biblioteca aberta, e é uma escolha
>   explícita de quem opera.
> - **O QUE MORA DENTRO DELE, que reprovaria calado.** O texto, o placeholder e a
>   lupa. No tema escuro `--text` é um off-white e sobre branco dá **1,17:1** —
>   invisível. Então os três param de seguir o tema junto com o fundo:
>   `--field-text` e `--field-muted` vivem no bloco COMPARTILHADO de
>   `tokens.css`, pelo mesmo motivo que os `--stage-*` — **uma superfície que não
>   segue o tema não pode ler tokens que seguem** (a regra da v5.219 num lugar
>   novo). Medido nos dois temas: texto 8,86:1, placeholder e lupa 6,08:1.
> - **A ELEVAÇÃO, que a v5.267 tornou obrigatória.** Aquele lote fez da barra um
>   bloco de nível 1 (`--camada`) — e no tema CLARO esse nível É o branco. Campo
>   branco sobre barra branca dá **1,00:1**: o campo não existe. Não há tom que
>   resolva sem desfazer uma das duas decisões, e contorno está fora desde que a
>   linha saiu do app inteiro. Sobra a profundidade, que é o argumento que esta
>   mesma tela já usa duas vezes: a barra tem sombra porque as seções vestem o
>   nível dela, e a tampa do álbum aberto tem a dela pelo mesmo motivo. **Duas
>   superfícies do mesmo tom se separam por profundidade.** No escuro ela é
>   invisível (o campo contrasta 12,6:1 com a barra) e não custa nada.
>
> O oráculo mudou de pergunta junto: onde ele exigia um degrau de tom entre campo
> e barra, ele passou a exigir **tom OU elevação** — que é a regra de verdade — e
> a cobrar a elevação em separado, senão o "ou" a deixaria opcional.
>
> Verificado por ISOLAMENTO, e os dois últimos casos são os que importam:
> devolvendo o recesso, **6** asserções reprovam; pintando **só o fundo** de
> branco e deixando as três cores de dentro seguirem o tema, **3** (todas no
> escuro, com o texto em 1,33:1); e branco **sem a elevação**, **3** — das quais
> duas no tema claro, onde o campo simplesmente some.

> **A v5.267: O CONTORNO SAI DO APP INTEIRO, e a Biblioteca ganha uma escada de
> camadas de verdade. OTA PURO** (nenhuma linha de Kotlin; sem Release).
>
> Pedido do operador, em duas metades que são a mesma metade: *"não tenhamos
> itens usando linha de borda, tudo deve ser com preenchimento sólido, e
> definição feita por puro e simples contraste entre os elementos"* e
> *"reorganizar os degraus de tons em elementos vizinhos ou parentes… problema
> que considero prioridade na biblioteca e suas seções, álbuns e listas, onde
> elas funcionam em camadas de ramificações que visualmente se parecem muito,
> dificultando discernir se estou em uma camada ou subcamada."*
>
> **Elas são a mesma porque quando a linha some, o degrau de tom vira a ÚNICA
> coisa que separa duas caixas** — e o degrau que este app tinha foi calibrado
> numa época em que ele era reforço. O comentário da escada dizia isso com todas
> as letras: *"o par painel × painel-2 fica logo abaixo do piso de 1,3:1 — e é
> assumido: ele não carrega o estado sozinho em lugar nenhum. Quem diz
> 'selecionado' é sempre a BORDA em `--accent`."* Tirar a borda sem mexer no
> degrau seria apagar o sinal e deixar o reforço no lugar dele.
>
> **O CONTORNO.** Saíram **82 declarações** de `border`/`outline`. Sobrevivem
> dois DESENHOS — os aros que giram (`.dl-ring`, `.av-stage-busy`) e o ✓ do
> seletor de destinos —, nomeados um a um no oráculo, porque uma heurística
> ("anéis podem") deixaria a próxima borda entrar chamando-se desenho. O que
> substituiu cada família está tabelado em `docs/ARQUITETURA-WEB.md`; as três
> decisões que valem para além do lote:
>
> - **Os fundos de ESTADO viraram opacos** (`--sel-fill`, `--live-fill`,
>   `--ok-fill`), e isso é medido, não gosto: `--accent-soft` a 16% sobre o
>   painel compõe **#3d4959**, que é o `--panel-2` desta paleta. Uma linha
>   SELECIONADA ficava com a cor exata do nível de baixo da árvore, e o que a
>   distinguia era só a borda que saiu. Opacos, os três valem o mesmo em qualquer
>   nível — um estado SAI da escada em vez de ocupar um degrau dela. E o sinal
>   principal deles é a MATIZ: `--live-fill` fica a 1,03:1 do painel de
>   propósito, porque uma linha vermelha entre linhas cinzas se acha sem precisar
>   ser mais clara, e a matiz é o que sobrevive ao brilho baixo de um salão.
> - **A régua do vermelho mudou de eixo.** Era "preenchido × contornado"; virou
>   a INTENSIDADE do mesmo preenchimento — saturado é "está no ar agora" e não
>   pode ter concorrente na tela, suave é a ação destrutiva.
> - **A aresta de 1px do tema claro (`--control-edge`, v5.207) saiu**, e ela era
>   exatamente o mecanismo que este lote veio remover. O diagnóstico dela
>   continua certo (`--surface` dava 1,14:1 contra o painel branco — um botão
>   invisível); o remédio virou outro: os dois overlays afundados foram a
>   .14/.20 e devolvem **1,32:1** e **1,51:1** ao mesmo par, por preenchimento.
>
> **A BIBLIOTECA.** O defeito não era só o degrau. A folha dela era `--panel` —
> um tom de CARTÃO —, então a árvore começava no nível 1 e gastava na raiz o
> degrau que faltaria três níveis adiante; e o corpo da seção ficava com a cor
> da FOLHA, de modo que o card de álbum pousava no mesmo fundo em que a barra da
> seção pousa, isto é, lia-se como IRMÃO dela. A v5.241 chamou os dois de
> "contêiner" e lhes deu o mesmo tom; são contêineres, e não são o MESMO
> contêiner — um está dentro do outro.
>
> ```
> folha de tela cheia   --bg          nível 0   (era --panel)
>   └ seção             --panel       nível 1   (barra + corpo, UM bloco sólido)
>       └ card do álbum --panel-2     nível 2
>           └ faixa     (sem fundo)   separada da vizinha pelo ESPAÇO
> ```
>
> **A v5.263 tinha recusado a troca da folha com um argumento MEDIDO, e ele
> expirou junto com a paleta:** *"no tema CLARO `--bg` (#dfe3e7) e `--panel-2`
> (#dee2e8) diferem em um ponto por canal, então as barras de seção e os cards
> de álbum sumiriam dentro da tela."* Verdade naquela paleta — e hoje a seção
> veste `--panel` (1,29:1 contra a página) e o álbum, `--panel-2` (1,41:1 contra
> ela): os dois tons daquela frase deixaram de se encostar.
>
> **`--camada` é o mecanismo, e ele existe porque uma lista de seletores
> descendentes não sobrevive à próxima tela.** Uma propriedade com um
> significado só — *o tom que um bloco filho DESTE contêiner deve vestir* —, que
> herda. Quem a declara é o CONTÊINER, nunca quem pinta: uma propriedade escrita
> no próprio elemento vence na hora de ELE resolver `var(--camada)`, então um
> bloco que reservasse o tom dos filhos em si mesmo passaria a vestir aquele tom.
> A primeira versão desta regra pôs a seção na lista e ela passou a vestir a cor
> do card — o defeito da v5.241 de volta, pego pelo oráculo nos dois temas.
>
> **A ESCADA PARA EM TRÊS DEGRAUS, e isso é aritmética.** Um quarto tom levaria
> o nível mais interno a ~#4c5865 no escuro, onde `--muted` mede 3,59:1 e
> `--accent` 3,37:1 — os dois reprovam AA para texto pequeno, que é o tamanho do
> texto de uma linha de lista. Quem carrega o quarto nível é o ESPAÇO.
>
> **E o tema claro NÃO pode ser monotônico**, o que o oráculo descobriu contra a
> versão correta do desenho: a página é cinza e o nível 1 é branco (a convenção
> de toda UI clara), então o primeiro degrau sobe e os seguintes só podem descer.
> Folha e card ficam a 1,09:1 e isso não se lê como ambiguidade porque os dois
> **nunca se encostam** — entre eles há sempre a moldura branca da seção. A
> asserção passou a medir os pares ADJACENTES (piso 1,28) e a exigir apenas que
> nenhum par coincida (piso 1,05); a primeira versão dela exigia monotonia e
> reprovava um desenho correto.
>
> **DUAS REGRESSÕES FORAM PEGAS POR MEDIÇÃO, e nenhuma teria aparecido lendo o
> código.** A primeira: com a folha da Biblioteca virando nível 0, o campo de
> busca da barra de baixo voltou a flutuar — `--surface-2` (branco a 92%) sobre
> um `--panel` que no tema CLARO é branco puro, **1,00:1** medido. É o defeito
> que a v5.207 corrigiu na barra da tela principal, reaberto por outra porta. A
> segunda é o `--camada` na seção, acima.
>
> **E o oráculo da escada quase aprovou o defeito que ele existe para pegar:**
> `lum()` lê `rgba(0, 0, 0, 0)` como PRETO, então um nível que não pinta nada
> entrava na conta como o fundo mais escuro possível e produzia um degrau enorme.
> Sem a guarda de opacidade, o caso APROVAVA a folha anterior — verificado. Um
> teste que aprova o defeito que ele existe para pegar é pior que teste nenhum.
>
> Verificado por ISOLAMENTO, com os oráculos novos contra a folha anterior: o
> `tokens.test.mjs` reprova em **82** contornos e o `smoke.mjs` em **8**
> asserções.

> **A v5.266: A BARRA DE BUSCA GANHA TOM E SOMBRA — agora que ela flutua, ela
> precisa se destacar. OTA PURO** (só CSS; sem Release).
>
> Pedido do operador: *"crie um contraste melhor entre a barra de buscas e o
> corpo da tela de biblioteca, pois agora que ela é 'flutuante' ela precisa se
> destacar."*
>
> Ele está cobrando a consequência de três lotes: a barra desceu para o rodapé
> (v5.258), a folha passou a ser a faixa visível para ela encostar no teclado
> (v5.261) e a tela deixou de deslizar (v5.263). Ela virou uma barra fixa sobre
> a qual a lista rola — e **não tinha fundo nenhum**: herdava o `--panel` da
> folha, com um filete de 1px como único separador.
>
> São DOIS sinais, e os dois já existiam neste app:
>
> - **O TOM.** `--panel-2` é o tom de CONTÊINER da Biblioteca (v5.241), e o
>   degrau que ele dá contra a folha é **o mesmo que a `.bottombar` usa contra o
>   fundo da tela principal**: medido, 1,29:1 no escuro e 1,30:1 no claro, contra
>   os 1,32/1,29 de lá. É a régua do próprio app para "separar duas caixas", e é
>   nela que o oráculo ancora — um número escrito no teste apodreceria na
>   primeira mudança de token.
> - **A SOMBRA**, que é o que o tom sozinho não diz: *conteúdo passa por baixo
>   daqui*. Mesma receita da tampa do álbum aberto
>   (`.hymnal-card.expanded .coll-bar`), invertida — o precedente deste app para
>   uma barra sob a qual a lista rola. E ela é necessária MESMO com o tom: as
>   barras de seção e os cards de álbum também são `--panel-2`, então um deles
>   encostando na barra sem a sombra leria como uma peça só.
>
> **O atalho plausível é errado, e o oráculo o reprova.** `--bar` é o token da
> barra de baixo da tela principal — parece ser exatamente isto —, mas ele foi
> calibrado contra `--bg`, e no tema CLARO ele é branco puro, **a mesma cor da
> folha: 1,00:1**. Verificado: trocando `--panel-2` por `--bar`, 4 asserções
> reprovam.
>
> O `border-top` saiu: entre dois tons e com a sombra, o filete é um terceiro
> separador na mesma junta — borda somada a sombra é o filete duplo que a v5.261
> já tinha tirado do `#favSearchBar`.
>
> **E o CAMPO foi medido junto**, porque a barra mudar de tom podia engoli-lo:
> ele é um overlay (`--surface-sunk`, a superfície INVERTIDA de dentro de um
> cartão), então clarear a base clareia os dois. Medido, ele não piorou —
> 1,10 → 1,16:1 no escuro, 1,45 → 1,44:1 no claro —, e o oráculo o cobra ao lado
> dos outros três: um destaque que apaga o que a barra existe para conter não é
> destaque.
>
> Verificado por ISOLAMENTO: sem fundo e sem sombra (o estado anterior),
> **6** asserções reprovam; com `--bar` no lugar do tom, **4**; com o tom mas sem
> a sombra, **2**.

> **A v5.265: O "~" SAI DAS CONTAGENS DE PESO. OTA PURO** (nenhuma linha de
> Kotlin; sem Release).
>
> Pedido do operador: *"pode remover o símbolo de aproximado/estimativa que usa
> nas contagens de peso dos arquivos e coletâneas da biblioteca."*
>
> **O número continua sendo uma estimativa; o que sai é o símbolo.** O total de
> um álbum é calculado por duração × a taxa medida no próprio aparelho, e isso
> não mudou — a Biblioteca segue respondendo "quanto isto vai custar" com um
> palpite, como sempre respondeu.
>
> O argumento anterior estava escrito no `medirColecao` e era este: *"o `~` na
> tela é parte da informação, não enfeite"*. Ele supõe que, sem o til, o número
> seja lido como EXATO — e não é: `fmtBytes` arredonda para uma casa decimal por
> desenho (o comentário dele diz, com todas as letras, que "148,3 MB é uma
> precisão que a medida não tem"). "18 MB" nunca prometeu 18.874.368 bytes. O
> til pagava um caractere em cada contagem da tela mais densa do app — e são
> três por linha em alguns cabeçalhos — para dizer o que a precisão do próprio
> número já diz.
>
> Com ele fora, os dois ramos de `fracaoPeso` (nada baixado × parcial) passaram
> a ter a mesma FORMA e a diferir só no número. Isso não afrouxa nada: é
> justamente por eles serem indistinguíveis na tela que a definição de
> "completo" tinha de ser uma só (`colecaoCompleta`), que é o que aquele bloco
> já garantia desde a v5.134.
>
> **E `fmtBytesPar` sumiu por consequência.** Ela recebia o separador em
> parâmetro porque as duas formas de "tanto de tanto" diferiam só nele; a forma
> por extenso saiu na v5.232 e o "~" saiu agora — sobrou um chamador com um
> valor, isto é, uma constante disfarçada de parâmetro. O corpo dela virou o
> `fmtFracBytes`.
>
> O oráculo entrou no `acervo.test.mjs`, que é onde as contas da Biblioteca já
> moram, e cobra as DUAS metades: o "~" some **e o par de números continua** —
> era ele que respondia "quanto já tenho / quanto vai custar" numa leitura só, e
> uma remoção que o levasse junto seria uma subtração, não uma limpeza. Reprova
> em 3 asserções contra o código anterior.

> **A v5.264: A TELA VEM NUM TEMPO E O TECLADO NO SEGUINTE, e o campo de busca
> ganha a lupa. OTA PURO** (nenhuma linha de Kotlin; sem Release).
>
> - **O TECLADO É PEDIDO DEPOIS DO FADE** — *"coloque um pequeno delay na
>   abertura da biblioteca, em um tempo a tela aparece e no segundo tempo o
>   teclado. isso vai fazer a tela piscar menos."* O que ele descreve tem causa
>   conhecida e ela é a soma de dois lotes: a tela entra por um fade de .25s
>   (v5.263) e o teclado, subindo ao mesmo tempo, ENCOLHE a faixa visível
>   (`--kb`/`--vv-top`, v5.261) quadro a quadro — a folha é remedida enquanto
>   ainda está aparecendo. São dois movimentos sobre a mesma peça, e é isso que
>   se lê como piscar. Com o `focus()` adiado em 260 ms (o fade mais um quadro),
>   a remedição acontece uma vez, sobre uma tela já opaca e parada.
>
>   **ISTO REVOGA UMA REGRA QUE ESTAVA ESCRITA NO CÓDIGO, e o risco fica dito em
>   vez de escondido.** O comentário anterior do `openHymnSearch` dizia:
>   *"síncrono e dentro do gesto: `focus()` adiado sai da interação do toque, e
>   aí o WebView aceita o foco mas NÃO abre o teclado — o pior resultado
>   possível, porque parece que funcionou."* Ele descreve um comportamento
>   observado em aparelho, e **nenhum teste deste repositório consegue
>   contradizê-lo**: num Chromium de mesa não existe teclado virtual. O que
>   sustenta a mudança é que o gatilho do teclado no Chromium é a ativação
>   transitória do usuário, cuja janela é de segundos — 260 ms cabem nela com
>   folga — e que **o preço de estar errado é conhecido e pequeno**: o campo fica
>   focado sem teclado e o operador toca nele uma vez, que é o comportamento
>   anterior à v5.131. Se o teclado parar de subir no aparelho, a causa é esta e
>   a volta é uma linha, nomeada no próprio comentário.
>
>   **E fechar dentro da janela CANCELA o adiamento.** Sem isso o `focus()`
>   cairia num campo já fora de cena e o teclado subiria sozinho por cima do app,
>   sem nada na tela que o explicasse — é a asserção que mais importa das três,
>   porque é a única cujo defeito não se percebe testando o caminho feliz.
> - **A LUPA DENTRO DO CAMPO** — *"isso vai indicar melhor o objetivo da barra"*.
>   Com a barra na base, sem cabeçalho por perto e com um ✕ ao lado, o
>   placeholder era a única coisa dizendo o que aquela caixa faz — e ele some no
>   primeiro caractere digitado. Ela vai **dentro** do campo, não ao lado: ao
>   lado seria mais um item da linha flex disputando largura com o campo e com o
>   ✕; dentro, ela é do campo, que é o que ela nomeia. É **decoração**
>   (`pointer-events: none`), porque um ícone que engole o toque no canto de um
>   campo de texto é um ponto morto exatamente onde o dedo mira.
>
>   **E o desenho é UM só:** ele já existia em JS (`searchIconSvg`, o botão de
>   pesquisar no YouTube) e virou `<symbol id="icoLupa">` no sprite do
>   `index.html`, com as duas pontas referenciando-o. Duas cópias do mesmo ícone
>   divergem no primeiro ajuste, e é para isso que aquele sprite existe.
>
> Verificado por ISOLAMENTO: devolvendo o `focus()` síncrono, **2** asserções
> reprovam; tirando só o cancelamento do fechar, **1**; tirando a lupa, **3**.

> **A v5.263: A BIBLIOTECA VIRA UMA TELA — o slide sai por inteiro, e o verde
> sai dos indicadores. OTA PURO** (nenhuma linha de Kotlin; sem Release).
>
> Três pedidos, e o primeiro **REVOGA a v5.262**: *"troque a animação de slide
> vertical, há muitos problemas com ela por causa do teclado, então faça apenas
> um fade in e out para a biblioteca, e faça dela uma tela inteira e não um tipo
> de pop up."*
>
> - **O SLIDE SAI, e o operador está encerrando uma sequência de três lotes.** A
>   v5.258 desceu a barra de busca para o rodapé, a v5.261 descobriu que a camada
>   fixa ignorava o teclado, e a v5.262 inverteu o sentido do movimento — três
>   correções em volta de uma animação que só existia para dizer "isto é uma
>   folha". **Três lotes seguidos consertando o entorno de uma animação são a
>   animação dizendo que não vale o preço**, e ele nunca foi só estético: um
>   `transform` na folha a torna o bloco-contêiner de tudo que for
>   `position: fixed` lá dentro, e ela é a única superfície do app que hospeda um
>   campo de texto colado no teclado. Fica a opacidade do `.popup-backdrop`, que
>   já é o fade de todas as camadas deste app — nada de novo; o bloco de CSS
>   apenas DESLIGA o resto. O **scrim** sai junto: era invisível (a folha cobre
>   100%), mas existia durante os .25s do fade, e era o último tique de popup.
> - **MAS O FUNDO CONTINUA `--panel`, e isso é medido.** A leitura natural de
>   "tela inteira e não popup" é trocar o fundo pela cor da página; no tema CLARO
>   `--bg` (#dfe3e7) e `--panel-2` (#dee2e8) diferem em **um ponto por canal**,
>   então as barras de seção e os cards de álbum sumiriam dentro da tela — o
>   defeito exato que a v5.241 mediu e corrigiu. A escala de tons da Biblioteca é
>   RELATIVA à folha, e a folha precisa continuar um tom acima do que contém.
> - **O VERDE SAI DOS INDICADORES** — *"remova a cor verde dos indicadores de
>   tamanho das coleções e também dos itens sobre a conclusão das atualizações
>   completas."* É a régua que já tirou o peso do painel do álbum (v5.232) e o
>   contador dos Favoritos (v5.239): **a mesma coisa dita duas vezes.** "24/24"
>   já diz que o álbum está inteiro e "Já no aparelho" já diz que os bytes estão
>   aqui; o verde ao lado não acrescenta um bit e gasta a única cor que este app
>   reserva para "concluído/conectado". Saíram `.coll-group-count.done`,
>   `.coll-opt-estado.done` e a cor de `.item-detalhe-estado.done` — **a ÊNFASE
>   fica** (o negrito distingue o resolvido do neutro sem pintar nada), e o verde
>   continua onde é o único sinal (a linha de aviso, o pulso, a tela conectada).
>   Junto saiu `.coll-bar-dl.done`, CSS morto desde a v5.135, e as quatro
>   atribuições de classe que agora não teriam regra.
> - **E OS TÍTULOS DAS COLEÇÕES FICARAM MAIORES** (`.8rem` → `.9rem`). A v5.262
>   se contentou com "a seção chega perto do álbum", e perto não é uma escala: a
>   régua passou a ser **estritamente decrescente para dentro** — 14,4 > 14,08 >
>   13,12px —, que é a única leitura que uma árvore oferece de graça.
>
> Verificado por ISOLAMENTO, uma peça de cada vez: devolvendo o slide e o scrim,
> **2** asserções reprovam; devolvendo a seção a `.8rem`, **1**; devolvendo o
> verde aos três indicadores, **1**. O caso do verde mede por ELEMENTO DE PROVA
> e não pelo desenho: os três estados só existem com uma coleção inteira no
> aparelho, e um fixture sem isso devolveria a cor herdada do `<body>` nos três
> — uma desigualdade que passa sem medir nada (a lição da v5.208).

> **A v5.262: A BIBLIOTECA SOBE DA BASE, os Favoritos ganham a seta que
> faltava, e a escala de títulos passa a ser uma escala. OTA PURO** (nenhuma
> linha de Kotlin; sem Release).
>
> Quatro pedidos do operador no mesmo lote, e o último precisou de medição antes
> de qualquer linha.
>
> - **A ANIMAÇÃO INVERTEU** — *"que ela seja vertical de baixo para cima"*. Ela
>   descia do topo desde sempre, e o argumento estava escrito aqui: *"a bandeja
>   fica no topo e os resultados abaixo, sem serem cobertos pelo teclado que sobe
>   da base"*. **Esse argumento morreu em dois lotes** — a busca desceu para o
>   rodapé (v5.258) e a folha passou a ser a faixa visível (v5.261), então nada
>   nela é coberto por nada. O que restava era a única folha do app que se movia
>   ao contrário de todas as outras. Subindo, ela chega pelo mesmo lado em que
>   estão o dedo, o teclado e a barra de busca. O bloco de CSS **saiu inteiro**:
>   ele existia só para sobrescrever o `translateY(100%)` e os cantos retos que o
>   `.popup-sheet--full` já argumenta.
> - **OS FAVORITOS COLAPSAM, e continuam abrindo abertos.** A v5.238 os fez
>   `fixo` — sem seta e sem ouvinte — com o argumento de que *"um atalho atrás de
>   um toque a mais deixa de ser atalho"*. Ele continua valendo, e é exatamente o
>   que sobrevive: **o padrão é ABERTO**, agora como uma linha de `grupoAberto`
>   no topo do arquivo em vez de uma exceção espalhada pelo construtor. (E a
>   v5.273 revogou a outra metade: o toque NELA deixou de recolhê-la — ela só
>   fecha quando outra seção abre.) O que ele
>   não justificava era a seção ser a ÚNICA da tela que não responde ao gesto que
>   todas as outras respondem — quem tem trinta favoritos não tinha como
>   recolhê-los para chegar aos álbuns. A opção `fixo` saiu do `grupo()`, e com
>   ela `.coll-group-icon.vago` e `.coll-group--drop.fixo`. Fechar dura a sessão,
>   como em qualquer outro grupo: reabrir sozinha a cada visita faria dela a
>   única seção que desfaz o que o operador acabou de fazer.
> - **OS ARQUIVOS OFICIAIS VÊM ANTES DOS HINÁRIOS.** A ordem anterior era a da
>   IDADE dos dois grupos, não a do uso: o hinário é o acervo permanente, a que
>   se chega pela busca, pelo número ou pelo nome; os oficiais são o material
>   DATADO do sábado que vem, e é a eles que se volta toda semana.
> - **A ESCALA DE TÍTULOS, e aqui a medição desmentiu metade do diagnóstico
>   natural.** Relato: *"o título das coleções está pequeno, o dos álbuns maior e
>   o dos items diferente… o texto dos itens precisa dar uma leve reduzida para
>   garantir a visualização do texto completo."* Medido numa lista de 390px:
>
>   | nível | fonte | espaço | texto |
>   |---|---|---|---|
>   | seção | 11,84px (700, caixa alta) | 263px | 263px |
>   | álbum | 15,20px (700) | 264px | 264px |
>   | item | **15,20px** (500) | **238px** | **541px** |
>
>   São duas coisas de uma vez. A hierarquia estava INVERTIDA nas pontas — o
>   nível mais externo era o menor e os dois de dentro EMPATAVAM —, e **é o
>   empate que faz o item "parecer diferente"**: ele não é maior nem menor que o
>   álbum, só tem outro peso, então o olho não lê nível nenhum. E o item é o
>   único que de fato corta, com a MENOR largura disponível dos três para o nome
>   mais longo do app. A escala passa a ter três degraus deliberados
>   (`.8rem · .88rem · .82rem`), e a caixa alta é o que os concilia: um rótulo em
>   maiúsculas ocupa opticamente mais que a mesma medida em caixa baixa, então a
>   seção sobe em número e fica à altura do álbum sem virar um título. Os dois
>   subtítulos viraram **um valor** (`.7rem`): eles diferiam por meio ponto, que
>   é a inconsistência que a v5.248 já tinha tirado de dentro da barra do álbum.
>
>   **O preço está dito:** 15,2 → 13,1px leva o exemplo de 541px para 466 — cerca
>   de 15% mais caracteres. Ele continua não cabendo em 238px, e nenhum tamanho
>   legível faria caber. O que este lote conserta por inteiro é a desproporção; o
>   corte de um título de 54 caracteres ele apenas adia.
>
> Os oráculos afirmam RELAÇÕES e nunca pixels — um número escrito ali reprovaria
> numa mudança legítima de fonte e, pior, seria verdadeiro sozinho enquanto a
> escala continuasse sem sistema, que era o estado anterior. Verificado por
> ISOLAMENTO, uma peça de cada vez: a animação antiga reprova **1**, a escala
> antiga **4**, os Favoritos fixos **3**, a ordem antiga **1**.
>
> **E um caso do `boot-nativo` passava por sorte de relógio.** O dos favoritos ao
> vivo (v5.258) rodava no Modo Fácil, onde o `renderSimpleGate` FECHA a
> Biblioteca sem tela conectada — e a enquete do espelho o chama sozinha durante
> a espera do pulso. Ele só não reprovava porque a janela era curta; os 800 ms
> que este lote acrescentou antes dele bastaram para expor isso. É a armadilha da
> v5.236 outra vez: **medir uma tela no modo em que ela não vive.**

> **A v5.261: A FOLHA PASSA A SER A FAIXA VISÍVEL — a barra de busca desceu na
> v5.258 e foi parar ATRÁS do teclado. OTA PURO** (nenhuma linha de Kotlin; sem
> Release).
>
> Relato do operador: *"a barra de buscas não está flutuante/fixa na base, logo
> acima do teclado… ela deveria ficar sempre visível junto ao teclado. Outro
> detalhe: já que a barra não é flutuante, para ela ficar na base junto ao
> teclado, você está deslocando todos os itens para cima, ocultando eles por
> saírem no topo da tela. Então verifique essas duas questões: da barra de busca
> fixa sempre visível na base e junto ao teclado, e a questão de que a listagem
> da biblioteca deve começar no topo da tela normal."*
>
> **O elemento já estava no lugar certo, e a folha inteira estava no tamanho
> errado.** A v5.258 desceu a barra para o fim do sheet com um argumento
> explícito de que isso bastava — *"nenhuma regra de teclado aqui, e isso é o
> ponto: o sheet mede 100% de um `<body>` que já desconta `--kb`"*. Ele não mede.
> `.popup-backdrop` é `position: fixed`, isto é, está **fora do fluxo do body** e
> nunca viu aquela conta, que existe desde sempre e sempre valeu só para a tela
> principal.
>
> **Medido**, num viewport de 430×900 com um teclado de 380 px: `body` ia a
> 520 px e a folha da Biblioteca continuava em **900** — a barra recém-descida
> ficava a 380 px atrás do teclado, e 380 px de resultados junto com ela. Descer
> a barra sem isto foi trocar "longe do polegar" por "invisível".
>
> **A correção é uma linha, e ela vale para as duas metades do relato.** A camada
> fixa deixou de ser a tela e passou a ser a FAIXA VISÍVEL:
>
> ```css
> inset: var(--vv-top, 0px) 0 var(--kb, 0px) 0;
> ```
>
> `--kb` já existia (quanto o teclado come embaixo). **`--vv-top` é o que
> faltava**: quanto a viewport VISUAL foi rolada para baixo dentro da de layout.
> É o navegador revelando o campo em foco — e como fixo é fixo em relação à
> viewport de LAYOUT, é ele que arrasta a folha para fora do topo da tela. A
> segunda queixa do operador, palavra por palavra.
>
> **E isto não é hipótese sobre um navegador exótico: é o aparelho dele.** Com
> `targetSdk` 35 o app é edge-to-edge, e nessa condição o
> `android:windowSoftInputMode="adjustResize"` do manifest **deixa de ter
> efeito** — a janela do WebView não encolhe, então nem o
> `interactive-widget=resizes-content` do meta viewport tem o que encolher. É
> exatamente o mundo em que `--kb` foi escrito para servir, e em que ninguém o
> tinha ligado às camadas fixas.
>
> Três consequências pequenas, e nenhuma é enfeite:
>
> - **O `.dialog-backdrop` recebeu a mesma linha.** Ele tem o `appPrompt`, que é
>   um CAMPO DE TEXTO, e um cartão centrado na tela inteira fica metade atrás do
>   teclado que ele próprio abre. Consertar uma das duas camadas fixas e deixar a
>   outra seria o defeito da v5.220 outra vez.
> - **As áreas seguras passaram a descontar.** `env(safe-area-inset-bottom)` é a
>   barra de gestos, e com o teclado aberto ela está ATRÁS dele — sem descontar
>   `--kb`, sobra uma faixa morta entre a barra de busca e o teclado. O mesmo em
>   cima, com `--vv-top`: uma folha que já começa abaixo da barra de status não
>   reserva espaço para ela de novo. E as duas folhas de tela cheia repetiam a
>   linha do `padding-top` à mão — agora ela é declarada uma vez.
> - **O `#favSearchBar` saiu da regra do rodapé.** Ele divide a classe
>   `.hymn-search-bar` e continua no ALTO da gaveta de uma pasta (a base daquela
>   folha pertence à barra de seleção múltipla), então herdar o `border-top`
>   dava um filete colado no `border-bottom` do cabeçalho — 2px onde o app
>   desenha 1 — e um vão de área segura no meio da tela.
>
> **O oráculo é o que faltava para os dois lotes.** `tools/smoke.mjs` ganhou um
> TECLADO DE MENTIRA: ele troca `window.visualViewport` por um que encolhe e
> rola sob comando, que é **o que o navegador reporta** no mundo em que o hint
> não é honrado — o app o lê como leria no aparelho. Sem `__teclado` chamado ele
> espelha a viewport de verdade, e por isso é inerte para todo o resto do
> arquivo. As cinco asserções afirmam a REGRA e nunca o pixel (um número escrito
> ali reprovaria numa mudança legítima de fonte, e a queixa nunca foi sobre um
> número). Verificado por ISOLAMENTO: devolvendo `inset: 0`, **3** reprovam;
> devolvendo a barra para o alto da folha, **4**.
>
> A régua que fica: **`position: fixed` não vê nenhuma conta de altura que o
> `body` faça.** Toda vez que este app aprender alguma coisa sobre onde a tela
> realmente está, as camadas fixas precisam ser avisadas à parte — e elas são
> justamente as que hospedam os campos de texto.

> **A v5.260: A BIBLIOTECA SEPARA OS HINÁRIOS DOS ARQUIVOS OFICIAIS. OTA PURO**
> (nenhuma linha de Kotlin; sem Release).
>
> Pedido do operador: *"faça uma separação de coletânea entre os hinários e os
> Arquivos oficiais (que incluem o provai e vede e informativo mundial das
> missões)"*.
>
> **O nome do grupo já denunciava o problema: "Hinários e séries".** Um grupo
> que precisa de uma conjunção para se nomear está juntando duas coisas — e o
> "e" estava lá desde a v5.229, quando havia UMA série e o cabeçalho foi
> remendado para caber nela.
>
> E as duas coisas já divergiam em tudo o que decide um toque (é o `tipoDaColecao`
> da v5.236): um hino é ÁUDIO com letra, que se baixa para ficar offline e que a
> igreja canta; um episódio é um VÍDEO de ~300 MB que se transmite, se vê uma vez
> e vem pronto da denominação. O índice de duas linhas separa as duas perguntas —
> *"que hino é?"* e *"qual é o material do sábado?"* — antes de custar um toque,
> que é a razão de o índice existir (v5.237).
>
> **"Arquivos oficiais" é o nome do operador, e ele nomeia a ORIGEM** — que
> separa melhor que "séries", uma palavra de implementação que não diz nada a
> quem opera.
>
> O que NÃO mudou, e é o que mantém o lote pequeno: o construtor de grupo é o
> mesmo, chamado duas vezes; os dois continuam nascendo fechados, sem botão de
> baixar em lote (nenhum dos dois baixa por lote — são as maiores coleções do
> acervo), e o corpo de cada um só é construído quando ele abre. Os nomes
> viraram constantes (`GRUPO_HINARIOS`/`GRUPO_OFICIAIS`) porque eles não são
> rótulo: são a CHAVE de `grupoAberto`, e um literal repetido entre o
> construtor e um chamador divergiria calado — o grupo abriria e o estado ficaria
> noutro nome, isto é, o toque deixaria de alternar.
>
> O oráculo pergunta ao DOM em três pontos, e nenhum basta sozinho: as duas
> séries vivem em "Arquivos oficiais", o hinário vive em "Hinários", e a ordem é
> Favoritos → Hinários → Arquivos oficiais → álbuns. Um cabeçalho novo com os
> cards no lugar antigo passaria no primeiro; mover os cards sem separar os
> hinários passaria no segundo. Com tudo num grupo só (o estado anterior), 2
> asserções reprovam.

> **A v5.259: O PARAR VAI PARA A CAPA, e a faixa de ações para de cortar a
> miniatura e de deixar o título aparecer atrás dela. OTA PURO** (nenhuma linha
> de Kotlin; sem Release).
>
> Cinco correções do MESMO relato — a linha da v5.258 em uso de verdade —, e
> quatro delas são de pixel porque foi em pixel que ele as viu.
>
> - **"O Parar deve ficar na própria thumbnail do item."** Ele nasceu na
>   fileira da direita (v5.177) e passou uma versão dentro do `⋮` (v5.258); os
>   dois lugares erram a mesma coisa. Enquanto a linha está no ar, tirá-la de
>   lá é a ÚNICA decisão que ela oferece — e ela ficava atrás de um toque, ou
>   disputando espaço com ações que ninguém quer ali. Na capa o alvo é o
>   quadrado inteiro, não custa um pixel do nome, e fica sobre a única parte da
>   linha que já dizia "é este item" — que, com a mídia no ar, é literalmente o
>   que está projetado. **Nos Favoritos ele nem existia**, e era ali que o
>   operador estava olhando: aquela lista mostrava "● No ar" e não oferecia
>   nada que tirasse do ar.
> - **A faixa CORTAVA a miniatura.** Ela partia de `--hit` (34px) onde quem
>   ocupa o canto esquerdo é a capa (40px): comia 6px dela. A conta agora sai da
>   mesma medida nos dois lados.
> - **E o título aparecia ATRÁS dos botões.** `background: inherit` copia o
>   VALOR do fundo da linha, e o valor de uma linha no ar é `--live-soft`, **que
>   tem alfa .22** — a faixa pintava vermelho translúcido por cima do nome.
>   Agora a base é opaca e o estado entra como CAMADA, que é exatamente como a
>   `.row` se pinta. **A lição é a mesma da v5.192, num lugar novo: `inherit` de
>   um valor com alfa não herda a APARÊNCIA, ele repete a tinta.**
> - **A mira falhava** (*"acabando tocando no corpo do item e não nos botões"*).
>   A miniatura media 40px e os botões vizinhos 34px — dois quadrados lado a
>   lado com 6px de diferença que ninguém decidiu, e o alvo no PISO do app
>   justamente na lista mais densa que ele tem. `--thumb` é uma medida só para a
>   capa, os botões da linha e o `⋮` — e é ela que a faixa usa nas duas bordas,
>   porque são as mesmas colunas: errar uma é errar a outra, que foi o defeito
>   de cima. A linha não ficou um pixel mais alta (quem dita a altura é a capa).
> - **O toque encolhia o MIOLO, não o cartão.** `transform` na `.row`, dentro de
>   um `.lib-item` que é quem tem a BORDA: enquanto ela é transparente dá no
>   mesmo, com ela visível (no ar, atual, selecionada) o miolo se afastava de
>   uma moldura parada e abria uma fresta dos dois lados — *"as margens esquerda
>   e direita ficam estranhas"*. Agora encolhe a peça inteira.
>
> Nove asserções novas, e as nove reprovam contra o código anterior (verificado):
> a geometria e o feedback no `smoke.mjs`, o Parar na capa no `cena.test.mjs`, e
> no `boot-nativo.test.mjs` o caso dos FAVORITOS — que é onde o relato nasceu e
> onde o botão não existia.

> **A v5.258: A LINHA FICA COM UM BOTÃO SÓ — o `⋮` — e a Biblioteca perde o
> "baixar tudo" e ganha a busca na BASE. OTA PURO** (nenhuma linha de Kotlin;
> sem Release).
>
> Seis pedidos do operador no mesmo lote, e os dois primeiros são o mesmo
> problema visto de dois ângulos: **o nome do item não cabe**.
>
> - **"Isole todos os botões de interação em um único botão à direita, que ao
>   tocar abre as opções para a sua esquerda sobre o item… pois hoje o título
>   disputa com todos os botões de acesso rápido, cortando o título e o
>   subtítulo."** A conta que ele descreve: a coluna de texto é `flex: 1` entre
>   a miniatura e uma fileira que **cresce com o estado do item** — estrela, `+`,
>   alça, o download de um link do YouTube, o Parar quando está no ar. Agora há
>   um `⋮` e uma gaveta absoluta que cobre da miniatura até ele. `montarAcoesDaLinha`
>   é o funil único das DUAS listas (Cronograma e Favoritos), senão elas
>   divergiriam no primeiro ajuste.
>
>   **Duas armadilhas de evento ficaram escritas no código, e as duas são de
>   captura.** O fechamento de fora é `pointerdown` na fase de CAPTURA porque a
>   alça mora dentro da gaveta e o arrasto captura o ponteiro — ele **nunca
>   produz um `click`**, então um ouvinte de clique deixaria o menu aberto por
>   cima da linha que acabou de se mover. E o "escolher fecha" também é de
>   captura, por um motivo que não é preferência: **todo botão de linha deste
>   app chama `stopPropagation`** no próprio `click` (senão o toque nele
>   acionaria o corpo da linha atrás), e um ouvinte de bolha na gaveta não veria
>   nenhum deles. A alça é a exceção declarada: ela não é uma decisão que
>   termina, é um gesto que dura.
>
>   **Isto REVOGA metade da v5.177**: as regras que escondiam a estrela e a alça
>   na linha no ar saíram. O argumento delas ("na direita, a milímetros do gesto
>   mirado, ninguém quer arrastar nem favoritar o que está na frente da
>   congregação") foi atendido de forma mais larga — não há mais nada na direita
>   além do `⋮`, e dentro da gaveta o Parar simplesmente se junta aos outros.
> - **O SUBTÍTULO passou a dizer o ÁLBUM** ("no caso das músicas, seu álbum",
>   no Cronograma e nos Favoritos). É o `hymnAlbum` que a v5.219 criou para o
>   slide de capa e a v5.220 passou a preencher no acervo já baixado — **nenhuma
>   leitura nova**, que é a regra desta linha desde a v5.118. Numa lista com três
>   "Ó Adorai o Senhor" de hinários diferentes, o álbum é literalmente o que
>   distingue um do outro.
> - **Os FAVORITOS se atualizam com a Biblioteca aberta.** Relato: *"se estou na
>   biblioteca e adiciono algo aos favoritos, ele só aparece na lista após fechar
>   e abrir novamente."* Eles têm **duas casas** desde a v5.237, e o `toggleFav`
>   só redesenhava a de baixo. O conserto redesenha **só o corpo daquela seção**
>   (achado por `data-fav-corpo` no próprio nó), e não a tela inteira: quem
>   marcou uma estrela no meio de um hinário não pode perder a rolagem por isso.
>   O oráculo cobra as duas metades.
> - **O ícone de trazer pasta virou "pasta +".** A v5.254 pôs ali as setas
>   circulares, que são o desenho de RE-SINCRONIZAR — o que a linha de cada
>   pasta já trazida faz. Este botão não repete nada: ele acrescenta a primeira.
> - **"Baixar toda a biblioteca" SAIU, com o peso total ao lado** — *"ele ficou
>   muito grande e muito inconveniente"*. Um alvo do tamanho do cabeçalho para
>   uma ação de dezenas de gigabytes, no topo da tela em que se procura UM
>   louvor. Baixar coleção por coleção continua no card de cada uma. Saíram
>   `renderAcervoTotal`, `#hymnSearchTotal`, `.popup-total` e o diálogo de
>   confirmação que só ele abria.
> - **A busca e o ✕ desceram para uma barra na BASE** — *"eles estão muito longe
>   do teclado e do toque de acesso"*. Ela é a última coisa do sheet, e o sheet
>   mede `100%` de um `<body>` cuja altura já desconta o teclado
>   (`calc(100svh - var(--kb))`): **a barra encosta na borda de cima do teclado
>   sem uma regra própria** — é o mesmo mecanismo que já mantém o transporte
>   visível. O ✕ vem depois do campo, na ponta em que o polegar já está.
>
> Os oráculos se dividem pela natureza: o `smoke.mjs` mede a FORMA (a gaveta
> fechada não mostra nada, aberta cobre o título sem invadir o `⋮`, o subtítulo
> compõe com o álbum, a barra é o último filho e não há mais total no
> cabeçalho), o `boot-nativo.test.mjs` mede o COMPORTAMENTO que só existe com a
> ponte (a atualização ao vivo dos favoritos, com a rolagem preservada) e o
> `cena.test.mjs` mede o que a v5.177 media, agora na forma nova.

> **A v5.259: O CHECK DO "TOCAR AGORA" NÃO ACENDIA — e o defeito era um
> argumento esquecido. OTA PURO** (sem Release).
>
> Relato do operador: *"o seletivo de tocar agora, na seleção de um provai e
> vede, ou talvez em todos, está com uma falha, pois se eu toco apenas nele, ele
> não dá o feedback do check"*.
>
> **É meu, da v5.253, e o "talvez em todos" tinha resposta exata: era só ele.**
> Marcar uma opção muda o desenho de DUAS coisas — a caixa daquela linha e o
> rótulo do confirmar —, e quem as reconstrói é o redesenho da folha, passado
> linha a linha num argumento (`aoMudar`). As três listas o recebiam desde a
> v5.141; o "Tocar agora" nunca precisou dele, porque até a v5.253 o corpo dele
> EXECUTAVA e fechava tudo. Quando aquela linha virou selecionável, o argumento
> ficou para trás — o toque marcava o destino e a tela não mudava um pixel.
>
> **O modo de falhar é o pior que este app tem:** nada quebra, nada erra alto, e
> o estado interno fica CERTO. Só o desenho não acompanha, e do lado de quem
> opera isso se lê como "o check não funciona" — ou, pior, como "não marcou", e
> aí o operador toca de novo e desmarca.
>
> **A correção tem duas metades, e a segunda é a que importa.** A primeira é o
> argumento que faltava. A segunda é tirá-lo do caminho: o redesenho virou um
> HOOK DE MÓDULO (`destRemontar`), definido UMA vez por folha ao lado do
> `destExecutor` que já morava lá. Argumento que cada chamador precisa lembrar de
> passar é a mesma classe de erro que o `native.js` cobra em outro lugar ("campo
> novo no objeto = campo novo no `native.js`, sempre") — como hook, a linha nova
> nasce funcionando, e o esquecimento deixa de ser possível. Verificado: com o
> argumento explícito removido de propósito, o oráculo continua passando.
>
> `tools/destinos.test.mjs` ganhou o caso, e ele reprova em 2 asserções contra o
> código anterior — exatamente as duas que o redesenho reconstrói. A terceira,
> "marca-o e mantém a folha aberta", passava ANTES também: é a prova de que o
> estado sempre esteve certo e só o desenho ficou para trás.

> **A v5.256: O EPISÓDIO APARECE NA QUARTA, e a falha dentro da janela DIZ POR
> QUÊ. OTA PURO** (nenhuma linha de Kotlin; sem Release).
>
> Pedido do operador, sobre o corte da v5.255: *"a data de corte não pode ser o
> próprio dia, pois muitos aproveitam para fazer a organização antes, então pode
> deixar para que o acesso ao vídeo já fique disponível na quarta-feira antes do
> sábado (caso o download em específico do informativo dê algum erro se feito na
> quarta-feira, rode um aviso para que espere que chegue mais perto da data para
> tentar novamente)."*
>
> Ele está corrigindo uma premissa minha, e a correção é sobre QUANDO o app é
> usado: eu tratei a lista como se ela fosse lida no culto, e ela é lida na
> semana. Um corte no próprio dia entrega o episódio no sábado de manhã — depois
> de o roteiro estar pronto.
>
> **A janela é uma CONTAGEM de dias, não um dia da semana.** Três dias antes de
> um sábado É a quarta-feira, e as duas formas descrevem o mesmo hoje; a
> contagem é a que sobrevive ao dia em que o canal publicar num domingo. Ela é
> uma constante nomeada (`DIAS_DE_ANTECEDENCIA`), e a conta que a sustenta
> (`diasAte`) usa `Date.UTC` nas duas pontas: uma subtração de `Date` local
> atravessa o horário de verão e erraria o vizinho exatamente uma vez por ano —
> num sábado, sem reproduzir.
>
> **E o preço da janela vem com o remédio no mesmo lote**, que é a segunda
> metade do pedido: nesses três dias o vídeo pode ainda não estar público, e o
> download não vem. Sem uma frase, essa falha é idêntica a uma queda de rede — o
> operador tenta de novo, falha de novo, e conclui que o app quebrou justamente
> no item que ele acabou de ver aparecer. Agora a resposta diz o que fazer e até
> quando: *"ainda não liberado pelo canal — tente mais perto de 22/Ago"*.
>
> Três decisões pequenas em volta dela:
>
> - **Ela só existe enquanto o sábado não chegou** (`diasAte > 0`, o mesmo
>   primitivo da lista com outro limiar). Passado o dia, uma falha ali é uma
>   falha de verdade, e a frase seria uma desculpa falsa.
> - **Ela aparece em DOIS lugares porque são dois fluxos.** Com "Tocar agora" a
>   Biblioteca FECHA e quem responde é o cartão sobre a preview; mandando ao
>   Cronograma ela continua aberta por cima da preview, e a resposta tem de
>   nascer onde o toque nasceu — ali, o card da própria série (`setCollStatus`).
>   É a regra da v5.207 aplicada a um caminho que tinha só metade dela.
> - **A DATA do episódio passou a viver no índice** (`serieData`). Ela já era
>   lida do título; o que muda é que agora sobrevive — sem ela no registro não
>   haveria como saber que aquela falha tem essa causa. Um campo novo no índice
>   o obsoleta uma vez, e a impressão digital da regra já cuida disso.
>
> Verificado por isolamento: sem a antecedência (corte no próprio dia) 3+1
> asserções reprovam; com ela larga demais (7 dias) 4+1; sem o aviso 3; e com o
> aviso em TODO episódio 1. O percurso mede a fronteira nos quatro dias em volta
> — terça não, quarta sim —, com relógio FIXO.

> **A v5.255: O QUE AINDA NÃO SAIU SOME DA LISTA — o canal sobe o trimestre e
> libera um sábado por vez. OTA PURO** (nenhuma linha de Kotlin; sem Release).
>
> Relato do operador: *"o informativo mundial das missões só libera apenas o
> informativo referente a aquela semana e dos passados. Exemplo: hoje é sábado
> 15 de agosto, então eu só tenho o 15 de agosto e os anteriores… portanto, pode
> fazer um bloqueio na exibição dos vídeos que não estão disponíveis ainda."*
>
> O canal sobe o TRIMESTRE INTEIRO de uma vez e libera um episódio por sábado;
> os que ainda não saíram ficam na playlist como **prioridade para membros** —
> têm título, miniatura e duração, aparecem na listagem e **não tocam**. Em 15 de
> agosto a Biblioteca mostrava até 12 de dezembro: dezessete promessas que ela
> não podia cumprir, e a mais cara delas no meio de um culto.
>
> **A régua é a DATA, porque é o único sinal que existe deste lado.** O que
> decide de verdade é a liberação no YouTube, e o extrator não a publica: o item
> de um vídeo restrito chega idêntico ao de um liberado. Três decisões cercam o
> preço disso:
>
> - **É um CAMPO do catálogo, não uma regra global** (`futuros`). O erro é
>   assimétrico: esconder cedo demais custa um episódio que já estava liberado —
>   e ele volta sozinho no dia seguinte, sem nada a desfazer; mostrar de mais
>   custa um item que o operador põe no roteiro e que não toca na hora, com a
>   projeção parada na frente da congregação. O **Provai e Vede fica de fora**, e
>   isso é medido, não suposto: no registro do aparelho, em 15 de agosto ele já
>   tinha até 26 de setembro, e aqueles episódios TOCAM.
> - **O corte é INCLUSIVO no dia**, que é o que o operador descreveu: o episódio
>   de hoje é o do culto de hoje. A comparação é por DIA (`AAAAMMDD`), nunca por
>   instante — um `>` sobre milissegundos o esconderia até a meia-noite.
> - **Sem data no título, nunca é escondido.** Ele é o achado da regra de ouro
>   (entra sem rótulo, no fim do mês), e esconder o que não se sabe julgar
>   trocaria um item feio por um item ausente.
>
> **E o DIA entra em DOIS lugares, senão o recurso não funcionaria no sábado.**
> A lista daquela série é função do dia, então: `indiceVencido` passa a vencer o
> índice na virada do dia (só nessa série), e o DIA entra na **assinatura** das
> playlists. O segundo é o que impede o sintoma da v5.233 por outra porta — o
> canal não muda de um dia para o outro, então a assinatura bateria, a economia
> devolveria a lista de ontem (sem o episódio de hoje) e o carimbo diria que ela
> é de hoje. Custa uma varredura por dia; sem ela o episódio do culto só
> apareceria quando o TTL de 12 h vencesse, que pode ser depois do culto.
>
> O Registro conta os escondidos numa linha só — dezessete linhas de recusa
> afogariam as recusas de VERDADE, que são uma ou nenhuma — e mostra **o mais
> próximo** com o título cru e a data do corte: a pergunta que se faz a esse
> bloco é "o app está escondendo o episódio de amanhã?", e a resposta não pode
> depender de eu adivinhar o relógio do aparelho.
>
> Verificado por ISOLAMENTO nas quatro peças: sem o corte, 6 asserções do
> `serie.test.mjs` e 2 do percurso reprovam; com ele GLOBAL (ignorando o campo),
> 1 — a que protege o Provai e Vede; com o corte exclusivo em vez de inclusivo,
> 3 e 7; e sem o dia na assinatura, 1 no percurso. **Esta última só passou a
> reprovar depois de o teste parar de apagar o índice antes de cada leitura** —
> ele exercitava sempre o caminho da reconstrução, isto é, nunca o caminho em
> que o defeito mora. O caso do corte roda numa página com **relógio fixo**: um
> oráculo cujo resultado muda com o dia é o que ensina a ignorar vermelho.

> **A v5.254: OS FAVORITOS VIRAM UMA LISTA SÓ — os atalhos de pasta saem, e a
> ordem passa a ser do operador. OTA PURO** (nenhuma linha de Kotlin; sem
> Release).
>
> Pedido do operador: *"não vamos mais usar o sistema de atalhos de pastas no
> app, apenas a versão de pastas sincronizadas dentro do armazenamento do
> aparelho. Todos os salvos nos favoritos vão diretamente para a lista geral com
> todos os arquivos juntos por ordem de chegada, mas com a opção de mover eles
> de lugar; vamos remover as subdivisões por tipo, manter uma lista única."*
>
> **A parte que não estava no pedido e que decidia o lote: a MIGRAÇÃO.** Apagar
> os atalhos e ir embora seria PERDER MÍDIA. Um item cujo único detentor era um
> atalho vira, no instante em que ele some, um registro que nenhuma lista aponta
> — e o coletor de lixo, que existe justamente para isso, o apaga na varredura
> seguinte (que roda na mesma abertura, no `varrerRestos`). Um vídeo grande
> sumiria do app **e do disco**, calado. Então `migrarPastasParaFavoritos` sobe
> cada item para `favs` e só DEPOIS derruba o atalho pelo `folderDrop`; a ordem
> das duas metades é a garantia inteira, e é ela que o oráculo mede.
>
> **O agrupamento por tipo caiu por um argumento que a própria ordenação
> desmente.** Ele supunha (v5.104) que a primeira coisa que o operador sabe
> sobre o que procura é a CATEGORIA — "era um vídeo". Com o item onde ele mesmo
> o pôs, a primeira coisa que ele sabe é o LUGAR, e uma lista que se reorganiza
> sozinha em doze seções é justamente o que impede memória de lugar. Os
> cabeçalhos ainda custavam altura: num acervo variado eles empurravam metade
> dos favoritos para fora da primeira tela.
>
> **A alça de arrastar é a do Cronograma**, não uma segunda — o mesmo
> `attachHandle`/`reorder`, a mesma linha-guia, a mesma medição única no
> `pointerdown`. O que ela exigiu foi um detalhe com nome: as pastas do aparelho
> ficam na MESMA `<ul>` e não pertencem à lista `favs`, então contá-las como
> posição deslocaria o índice de destino em relação ao array — a linha leva
> `data-fixa`, e o `measureDrag` a pula.
>
> **O preço, medido e dito:** a alça é o terceiro botão da linha, e o nome caiu
> de **194px para 152px** numa lista de 368px. Em troca o SUBTÍTULO voltou a
> aparecer — ele era escondido por CSS porque o cabeçalho de tipo já dizia o que
> ele diz —, e é ele que agora distingue um vídeo de um versículo.
>
> **A folha de duas origens da v5.239 também caiu, e pela regra dela mesma.**
> Ela existia porque dois botões respondiam à mesma pergunta ("quero uma pasta
> aqui") por caminhos diferentes; com um caminho só, uma folha de uma opção é um
> toque cobrado para não escolher nada. A ação da barra passou a FAZER a coisa.
>
> Saíram junto: `folders`/`folder_<id>`, `renderVirtualFolders`, `createFolder`,
> `deleteFolder`, `addToFolder`, `loadFolderMediaItems`, `openFolder`,
> `promptNewFavorite`, `abrirFolhaDePasta`, `FAV_GRUPOS`, `favGrupo`,
> `appendFavSection`, o popup `#folderPopup` inteiro, o `#selFolder` da seleção
> múltipla, os glifos `folder`/`create_new_folder` e as classes `.fav-section` e
> `.folder-pick-btn`.
>
> Os oráculos: o `boot-nativo.test.mjs` cobra a lista única, a alça, o
> reordenar de verdade, a ação que traz a pasta sem folha — e as quatro
> asserções da migração (o item sobe, **a mídia sobrevive**, não duplica quem já
> estava lá, e rodar de novo é no-op). Reprova em **5 asserções** contra o
> código anterior. O par `songMenuPopup`/`folderPopup` saiu da lista de popups
> aninhados do `smoke.mjs`, que fica VAZIA de propósito: o próximo popup que
> abrir de dentro de outro entra ali numa linha.

> **A v5.253: A FOLHA DE DESTINOS VIRA UM MÉTODO ÚNICO — tudo é selecionável, e
> o confirmar não some. OTA PURO** (sem Release).
>
> Pedido do operador: *"faça um método universal, o botão de confirmar sempre
> visível, e todas as outras opções (inclusive o tocar agora) são opções
> selecionáveis, não apenas tocando no check, mas de corpo inteiro."*
>
> **A folha tinha DUAS gramáticas na mesma linha.** O corpo EXECUTAVA — aquele
> destino mais o que estivesse marcado, fechando tudo — e a caixinha de 20 px na
> borda apenas MARCAVA. Duas coisas diferentes a dois centímetros uma da outra, e
> a de marcar era o menor alvo da folha: quem quisesse dois destinos tinha de
> acertar a CAIXA do primeiro e o CORPO do segundo, nessa ordem. Errar a ordem
> mandava o item para um destino só e fechava a folha.
>
> **E o confirmar só nascia depois da primeira marca** — ou seja, era invisível
> exatamente para quem ainda não tinha entendido o mecanismo, e a folha parecia
> não ter conclusão.
>
> Agora ela é o que sempre pareceu ser: **uma lista de opções que se marcam e um
> botão que executa.** A caixa vira INDICADOR (`pointer-events: none`, senão o
> toque que cai nos 20 px dela morreria num filho sem ouvinte — um ponto morto
> justamente no pedaço que mais parece o alvo), a linha marcada ganha o contorno
> em accent que o app usa para "é este", e o confirmar fica sempre na tela:
> desabilitado e dizendo "Escolha uma opção" enquanto não há nada.
>
> **"Tocar agora" ganhou caixa junto.** Por dezenas de versões ele não a teve com
> um argumento correto — "ele não é uma lista, e uma caixa nele ofereceria marcar
> o telão". Com um confirmar único, negá-la seria manter a exceção que o pedido
> veio remover. O rótulo do botão acompanhou: "Enviar aos 2 destinos" chamaria o
> telão de lista, então ele virou **"Confirmar (N)"**, que é como o próprio
> operador nomeou o botão.
>
> **"Só a letra, no Cronograma" também entrou na seleção.** Ela ficava de fora
> porque "a letra não é o mesmo item noutra lista, é OUTRO item — misturá-la aos
> destinos faria um toque criar duas coisas diferentes de uma vez". Com um
> confirmar único isso deixou de ser um toque acidental e passou a ser uma
> decisão explícita, então a exceção caiu.
>
> **E o seletor de destinos da IMPORTAÇÃO parou de ter marcação própria.** Ele
> montava as linhas dele porque `songMenuItem` executava; agora que ela marca, as
> duas folhas convergiram e vinte linhas de marcação duplicada saíram junto —
> que é o "método universal" do pedido escrito em código, não só em
> comportamento.
>
> **O que NÃO mudou:** a folha de TOCAR de uma música do acervo (cantada ·
> playback · apenas a letra) continua sendo três ações imediatas. Ali não há
> destino nenhum a acumular — são alternativas, e a primeira escolhida é a
> resposta.
>
> `tools/destinos.test.mjs` foi reescrito para o modelo novo e reprova em **7
> asserções** contra o anterior: as antigas travavam literalmente a gramática
> que saiu (o corpo executando, a caixa parando o borbulhar, o confirmar
> ausente).

> **A v5.252: O REGISTRO ACHOU O PRIMEIRO DEFEITO — e ele era MEU. OTA PURO**
> (nenhuma linha de Kotlin; sem Release).
>
> O operador copiou o bloco novo do Registro (v5.249) e o repassou. Na primeira
> varredura em aparelho de verdade, com **94 playlists** num canal e **145** no
> outro, ele traz uma linha só de recusa de vídeo em toda a série do Provai e
> Vede:
>
> ```
> - "Mission Refocus | Provai e Vede  2026 (27/Jun)" → está em outro idioma
> ```
>
> **É um episódio EM PORTUGUÊS**, do canal certo, dentro da playlist certa. O
> marcador de inglês da v5.244 era a palavra solta `mission`, e o título deste
> episódio a tem. O sábado 27 de junho simplesmente não estava na lista: **o
> erro que o `serie.js` inteiro existe para evitar**, cometido pela guarda que
> eu escrevi — com o custo declarado no KDoc dela como se fosse aceitável.
>
> Não era. "O operador vê na lista e resolve à mão" supõe que ele saiba que
> falta alguma coisa, e entre 37 episódios ninguém percebe um ausente. **Quem
> mostrou foi o Registro, dois dias depois de existir** — este é exatamente o
> laço que ele foi criado para fechar, e ele o fechou na primeira volta.
>
> **A régua que estava errada, e é ela que fica:** uma palavra solta em inglês
> não diz o idioma de um título — títulos em português usam palavras em inglês o
> tempo todo. O que diz é o NOME DO PROGRAMA ("Mission Stories", "World
> Mission", "Mission Spotlight", "Missionnaire"), e essas são expressões que um
> título brasileiro não produz por acidente. O espanhol continua por PALAVRA
> porque ali elas não se cruzam: "missões" nunca é "misiones", em flexão
> nenhuma. **Uma marca de idioma tem de ser impossível na língua que se quer
> manter, não apenas típica da que se quer recusar.**
>
> Duas outras coisas que só os números reais ensinaram:
>
> - **O recorte do bloco passou a ser o ANO.** Com 94 e 145 playlists, as 9
>   aceitas ficavam enterradas sob oitenta linhas dizendo "não é de 2026", e o
>   teto de 60 cortava justamente o fim. Some só o que traz OUTRO ano no nome —
>   um mês do ano corrente renomeado ("Provai & Vede - Julho 2026") continua
>   aparecendo, e uma playlist sem ano nenhum também, porque é assim que uma
>   renomeação se disfarça. O que saiu é contado por motivo, nunca em silêncio.
> - **O canal ANUNCIA mais vídeos do que a extração traz** — 39 × 38 numa série,
>   51 × 50 na outra. Nada erra, nada recusa: o vídeo não vem (só para membros?
>   removido?) e o sábado dele não existe na lista. A soma das contagens da aba
>   do canal é a única referência externa que este caminho tem, e agora ela é uma
>   linha do bloco.
>
> Os oráculos ganharam **dezessete nomes VERBATIM** dos dois canais, que
> nenhuma suposição minha teria alcançado: espaço duplo antes do hífen, "vede"
> em minúscula, o ano ANTES do mês ("Provai e Vede 2024 - Março"), o chinês
> simplificado, e — a que mais importa — o fato de o @daniellocutor publicar
> **o Provai e Vede também**, o que faz o prefixo ser a única coisa que impede
> uma série de entrar na outra. Contra o código anterior, 4 asserções reprovam.

> **A v5.251: "ONLINE" — a qualidade que não baixa. OTA PURO** (sem Release).
>
> Pedido do operador: *"adicione a opção nas qualidades de opções do download,
> para que tenha o 'Online' que mesmo ao levar para o cronograma, levaria apenas
> o link, ao invés de obrigar a baixar."*
>
> **A razão que obrigava o download estava escrita e era boa — só não era
> universal.** O `ytAcao` diz, desde a v5.120, que os três destinos que GUARDAM
> não podem transmitir porque "um manifesto de stream EXPIRA em algumas horas".
> Verdade sobre o MANIFESTO; falsa sobre o LINK, que é o que um item
> `kind: 'youtube'` guarda desde sempre e não expira. Um vídeo visto uma vez, num
> culto com internet, não precisa dos ~300 MB no aparelho para entrar no roteiro
> de sábado.
>
> **Ela mora no MESMO seletor das resoluções** (decisão do operador), porque é a
> mesma pergunta — "quanto deste vídeo eu quero no aparelho?" — com **nada** na
> ponta da escala: `Online · 1080p · 720p · 480p`. O sentinela é `-1` e não `0`:
> zero já significa "sem teto, o padrão do shell", e reusá-lo faria "Online" e
> "melhor qualidade" serem o mesmo valor.
>
> **O recurso não inventou item novo nem caminho novo.** O que ele guarda é o
> `kind: 'youtube'` que o compartilhamento já cria quando transmissão e download
> falham, e desde a v5.212 tocá-lo RESOLVE no toque (`resolverLinkYoutube`):
> transmite, e **transmitir não troca o item** — então o link continua link no
> domingo seguinte, que é exatamente o que "Online" promete. A recuperação
> também já existia: falhando a transmissão, aquele mesmo caminho baixa e troca
> o item na posição em que ele está, sem perder o lugar no Cronograma.
>
> **Duas coisas somem com ela escolhida, e as duas pela mesma régua** (uma
> escolha que não muda nada é pior que escolha nenhuma): o seletor Vídeo × Só
> áudio, porque a forma da faixa passa a ser decidida na hora de tocar; e a
> espera — os três destinos ganham o subtítulo "Só o link, sem baixar", que é o
> que eles significam em toda outra qualidade.
>
> **O preço está dito e é um só: sem internet no culto, não há o que projetar.**
> Ele não é escondido atrás de um padrão — a qualidade continua nascendo em
> 1080p a cada item, e "Online" é uma escolha deliberada por vídeo.
>
> O oráculo (`tools/boot-nativo.test.mjs`, o único que sobe a base com a ponte)
> cobra as duas metades: o rótulo está no seletor **e** o que chega ao Cronograma
> é um registro sem blob, com `kind: 'youtube'`. Sem a segunda, acrescentar a
> palavra teria passado.

> **A v5.250: O MODO FÁCIL GANHA A ENGRENAGEM — e com ela some o último
> `.mode-switch` do app. OTA PURO** (nenhuma linha de Kotlin; sem Release).
>
> Pedido do operador, logo depois da v5.247: *"então crie um botão de
> configurações no modo simples, que fica onde é hoje o botão de modo
> avançado"*.
>
> **É a segunda metade de um movimento, e a ORDEM dele não era acidente.** A
> v5.247 tirou a troca de modo do cabeçalho do avançado porque a mesma escolha
> mora em Configurações; ela não podia tirar a do Modo Fácil no mesmo lote,
> porque daquele modo **não havia como chegar a Configurações** — a engrenagem
> vive na coluna do mixer, dentro da `.bottombar`, que aquele modo esconde por
> inteiro. Tirar os dois de uma vez teria trancado o operador lá dentro.
> Primeiro se cria o caminho, depois se remove o atalho.
>
> Agora o caminho é o mesmo nos dois modos — **engrenagem → "Modo do app"** —, e
> ele é o melhor dos três que existiam: é o único que **guarda a escolha entre
> aberturas** (v5.66). Os dois botões valiam só para a sessão.
>
> **O Modo Fácil ganhou junto tudo o mais que morava atrás da engrenagem**: o
> tema, o wallpaper do telão, o preenchimento e o giro, o estado do telão, o
> Registro e o botão de atualização. Aquele modo nunca teve acesso a nada disso
> — a única saída dele era virar o app inteiro do avesso.
>
> **A engrenagem é CHAPADA e `--accent`**, e as duas metades são regra do app: o
> chapado é "navegação/acesso não é operação" (a mesma receita do `#backBtn` e
> da gêmea do mixer), e o accent é o que este app usa para dizer "isto leva a
> outro lugar" — era exatamente onde ele vivia no botão que saiu, na seta. Ela
> difere da gêmea do mixer no `--muted` porque lá ela é um acesso entre outros e
> aqui é o ÚNICO. Fica acima da cortina do modo bloqueado sem regra nova: o
> `.simple.sem-tela .simple-head` já iça o cabeçalho inteiro.
>
> **`.mode-switch` saiu inteira** — a classe, as duas menções nas listas
> agrupadas de toque e de escala de ícone, e o `.simple-head .mode-switch`. Ela
> ficou sem um único elemento no documento.
>
> O oráculo do `tools/smoke.mjs` cresceu para nove asserções e agora percorre o
> CAMINHO, não só o DOM: no Modo Fácil a engrenagem está à vista, o toque abre
> Configurações, e de lá o operador SAI do modo. Sem essa última, apagar o botão
> passaria nas outras e trancaria o operador — que é precisamente o risco desta
> sequência de dois lotes. Reprova em **5 asserções** contra o código anterior
> (verificado), e a leitura da engrenagem é null-safe pelo motivo de sempre: um
> `evaluate` que lança ali levaria junto as asserções seguintes.
> **A v5.249: O REGISTRO PASSA A CONTAR O QUE A REGRA DAS SÉRIES ACHOU. OTA
> PURO** (nenhuma linha de Kotlin; sem Release).
>
> Pedido do operador: *"adicione uma seção inteira nos registros para, após
> verificar ambos os grupos de Provai e Vede e de Informativo Mundial das
> Missões, ele registrar os nomes, achados e dados resultantes, assim eu posso
> lhe repassar e você verificar se precisa ajustar os filtros ou métodos."*
>
> **O que ele descreve é o laço de manutenção deste recurso, e ele estava aberto
> de um lado.** A regra decide a partir de nomes que um canal muda sem avisar, e
> os dois modos de errar são silenciosos por construção: uma playlist recusada
> some da Biblioteca sem erro no console, e um vídeo aceito sem data entra fora
> de ordem. O aparelho sabia as duas coisas no instante em que decidia e as
> jogava fora — quem opera vê o RESULTADO (uma lista) e nunca o CAMINHO, então
> "está faltando julho" e "julho veio com outro nome" chegavam a mim como a
> mesma frase. As duas versões anteriores deste recurso são a prova: a v5.229 e
> a v5.233 foram diagnosticadas por relato e reprodução, não por leitura.
>
> O desenho inteiro está em "O REGISTRO da varredura", na seção das séries. As
> três decisões que valem para além dele:
>
> - **O bloco guarda o VEREDITO, nunca uma segunda opinião.** `mesDaPlaylist`
>   virou a metade de `avaliarPlaylist`, que devolve `{ mes, motivo }`; o mesmo
>   para `avaliarVideo`. Uma segunda escrita das quatro perguntas — uma para
>   decidir, outra para contar o que decidiu — envelheceria à parte no primeiro
>   ajuste, e o que sai disso é um log que discorda do aparelho. Virou regra do
>   projeto.
> - **Ele registra o dado CRU.** O consumidor deste texto não é quem opera: é
>   quem AJUSTA a regra, a distância, sem o aparelho e sem o canal na frente. Um
>   rótulo já formado ("15/Ago") prova que a regra rodou; só o título que entrou
>   nela diz por que ela produziu aquilo.
> - **O que ENTROU sem data é um ACHADO, e é o mais valioso dos dois.** Recusa
>   se percebe (o item some); o episódio sem data continua lá, funcionando, com
>   o rótulo errado — foi assim que a v5.230 atravessou até o operador reparar
>   num item fora de ordem no fim de janeiro.
>
> Mais duas peças pequenas e uma armadilha. O diário **vence o índice**
> (`indiceVencido`): sem isso, um aparelho que já tinha a lista passaria 12 h com
> o bloco dizendo "ainda não varrido" justamente enquanto o operador o procura —
> e o carimbo é escrito nos DOIS caminhos do `fetchSerieIndex`, senão o canal
> seria extraído a cada abertura. A metade do canal é gravada **antes** do
> primeiro `throw`, porque "nenhuma playlist no canal" é o caso em que a pergunta
> "por quê?" mais importa. E os nomes saem **um por linha**: os dois separadores
> óbvios já são parte dos dados (" · " no rótulo formado, " | " no título cru).
>
> O oráculo entrou no `boot-nativo.test.mjs` — nenhum teste carregava este texto,
> e o modo de falhar dele é o do `registro.test.mjs`: ele não quebra, ele
> CONTINUA RESPONDENDO com uma frase errada, ou mudo, que é pior ("não achei nada
> no Registro" se lê como "não há nada de errado"). Verificado por ISOLAMENTO,
> sem erro de referência mascarando nada: sem o bloco **12** asserções reprovam,
> sem a lista de recusados **1**, sem o achado de data **1**, sem o carimbo do
> diário **1**.

> **A v5.248: O PESO VIRA SUBTÍTULO DO CARD — e o card não cresce por isso.
> OTA PURO** (sem Release).
>
> Pedido do operador: *"ajuste o elemento que descreve o peso dos arquivos e
> álbuns e coleções, para que ele seja um subtítulo abaixo do título, pois
> atualmente ele está apertando o espaço disponível para o título dos álbuns.
> Mas garanta que os cards não fiquem mais altos por causa disso."*
>
> **Medido, e o aperto era grande:** dividindo a linha com o nome, "~1,2 GB"
> comia um terço da largura útil de um celular. O título de um álbum ia de
> **196 px** para **264 px** (+35%), e no pior caso — o álbum que tem subtítulo
> de categoria E "não sincron." — de **150 px** para 264 px, **+76%**. O nome é a
> única coisa daquela barra que não se adivinha; o peso é um número curto que
> ninguém lê de relance.
>
> **A segunda linha já existia** (o subtítulo do pivô categoria↔álbum), e o peso
> entra NELA, não numa terceira: são duas peças do mesmo tipo — metadado curto
> sobre a coleção — e uma linha por peça faria o card crescer conforme o
> catálogo, que é exatamente o que a segunda metade do pedido proíbe. O ponto
> separador vem do CSS, e as reticências caem no subtítulo: o peso é curto e não
> deve encolher.
>
> **A altura não mudou: 51,6 px antes e depois.** Quem manda nela é a THUMB
> (32 px), e as duas linhas de texto foram presas a esse número — 19,0 + 1 +
> 11,8 = 31,8 px —, com as alturas de linha explícitas em vez de herdadas.
> Foi por essa conta que o subtítulo do pivô desceu para `.7rem`, a mesma escala
> do peso ao lado: meio ponto de diferença entre dois irmãos na mesma linha era
> a inconsistência que a v5.241 tirou daqui, e era também o meio ponto que
> estourava a thumb.
>
> **E o travessão saiu.** Ele era o marcador de "nada a dizer" numa COLUNA que
> precisava existir para os cards se alinharem; como subtítulo ele vira um traço
> solto embaixo do nome, dizendo menos que o silêncio. Sem ele o card fica com
> uma linha só — e não encolhe, porque quem manda na altura continua sendo a
> thumb.
>
> O oráculo (`tools/smoke.mjs`) não fixa pixel nenhum: ele compara a largura do
> título ENTRE CARDS (com e sem subtítulo o nome tem de ter a mesma linha, que é
> literalmente "o metadado não aperta mais o título") e trava a altura contra a
> thumb. O caso da v5.243 foi re-ancorado no título, que agora é quem marca a
> coluna da direita. Reprova em 3 asserções contra o código anterior.

> **A v5.247: A TROCA DE MODO VIRA UMA SÓ — o botão do cabeçalho sai. OTA
> PURO** (nenhuma linha de Kotlin; sem Release).
>
> Pedido do operador: *"como já temos nas configurações o botão de acesso ao
> modo simples, então pode remover o botão que temos no cabeçalho do app"*.
>
> Ele está certo por duas contas e por uma terceira que a medição achou. O
> destino é o MESMO (`setAppMode('simple')`), e o de Configurações é o que
> **guarda a escolha entre aberturas** (v5.66) — o do cabeçalho não guardava
> nada, isto é, dos dois controles o que sobrou é o que decide mais. E o do
> cabeçalho ocupava a esquerda de uma faixa com largura de celular para uma
> decisão que se toma uma vez por instalação.
>
> **A terceira: o título nunca esteve centrado.** A caixa do botão ficava
> RESERVADA mesmo quando ele não aparecia (`.mode-switch--vago`, v5.111) — ela
> existia para o título não saltar 60px a cada deslize entre abas —, e o preço
> era o título ser empurrado para a direita o tempo todo. Medido numa tela de
> 430: centro do título em **278px**, contra os 215 do centro da faixa. Sem o
> botão não há o que reservar, e ele passa a ficar exatamente no meio, em todas
> as abas. O único elemento que ainda o desloca é o voltar da Bíblia (19px), e
> essa distância é a mesma de antes.
>
> **A SIMETRIA ACABOU, e ela era assimétrica de verdade.** Este documento
> descrevia os dois botões como "o mesmo botão ao contrário", e por isso a
> leitura natural do pedido seria tirar os dois. **O `#simpleFullBtn` do Modo
> Fácil FICA**, e não por conservadorismo: a engrenagem mora na coluna do mixer,
> dentro da `.bottombar`, que o Modo Fácil esconde por inteiro
> (`body.mode-simple .bottombar { display: none }`). No avançado o outro caminho
> está ali ao lado; no Fácil não existe caminho nenhum, e remover aquele botão
> **trancaria o operador naquele modo**. É a razão pela qual a v5.48 o criou, e
> ela continua valendo só de um lado.
>
> `tools/smoke.mjs` cobra as duas metades — o botão fora do cabeçalho da lista e
> o título centrado, mas a saída do Modo Fácil ainda no cabeçalho dele e os dois
> modos ainda em Configurações. Sem essas duas últimas, apagar o cabeçalho
> inteiro passaria. Reprova em 2 asserções contra o código anterior (verificado).
>
> Saíram junto o `.mode-switch--vago` (o lugar reservado, sem dono agora) e a
> regra de "só no Cronograma" do `renderListTitle`.

> **A v5.246: A SETA VIRA A THUMBNAIL DAS RAÍZES — ícone só na folha da árvore.
> OTA PURO** (sem Release).
>
> Pedido do operador: *"adicione um ícone também como thumbnail e modelo nos
> grupos das coleções, assim podemos colocar a mesma seta de colapsar e
> descolapsar aqui… pode manter uma seta como 'thumbnail' padrão, pois nas
> subdivisões, uma thumbnail é meio inútil, deixe apenas nos arquivos os ícones,
> nas raízes mais altas o ideal é a seta, pois ela representa que pode abrir
> mais listagens."*
>
> **O argumento é sobre o que um desenho ali pode significar.** A thumb de um
> álbum era a mesma nota musical em cada hinário e a mesma fila em cada álbum —
> um glifo repetido em toda linha não distingue nada, e o que distingue uma
> coleção da outra é o nome ao lado. A seção nem isso tinha: começava com texto
> solto. Na folha da árvore o ícone TRABALHA (um áudio, um vídeo, uma imagem,
> uma miniatura de verdade), e é lá que ele fica.
>
> Agora a seção e o card do álbum têm o MESMO quadrado, com a MESMA seta: para
> baixo fechado, para cima aberto, girada por CSS a partir de um desenho só. A
> caixa é declarada uma vez para os dois — duas receitas para o mesmo quadrado
> divergiriam no primeiro ajuste.
>
> **E ela desceu da coluna da direita**, onde a v5.237 a tinha posto: é a mesma
> razão da v5.243 — a direita é a coluna do peso e do botão de baixar, e uma
> seta que aparece ali empurra os números.
>
> **A seção FIXA (os Favoritos) reserva o lugar e não desenha nada.** Ela não
> abre nem fecha, e uma seta ali prometeria um gesto que não existe; sem o
> espaço, o título dela começaria numa coluna diferente da de todas as outras
> seções. É o `visibility`-vago da v5.243 aplicado ao outro lado da barra.
>
> **`iconKey` saiu do catálogo com a thumb que ele alimentava** — ele era o
> ÚNICO acesso dinâmico à tabela `ICON`, e sem ele toda leitura daquela tabela
> passa a ser por nome literal. Isso não é limpeza cosmética: é o que torna a
> tabela varrível, e um nome que ninguém cita vira código morto demonstrável em
> vez de um talvez.
>
> O oráculo (`tools/smoke.mjs`) compara a caixa da seção com a do card — a
> mesma largura, altura e tom —, exige a seta nos DOIS estados do álbum e mede a
> direção do giro. Reprova em 4 asserções contra o código anterior.

> **A v5.245: A ATUALIZAÇÃO DEIXA DE SE PERDER NUM TOQUE FORA, e ganha um
> BOTÃO em Configurações. OTA PURO** (nenhuma linha de Kotlin; sem Release).
>
> Pedido do operador, em duas metades que são o mesmo problema: *"ela pode ser
> ignorada tocando fora dela, e assim perdendo a atualização"* — e um botão que
> *"sem atualização disponível, ativa a verificação para saber se há uma, e se
> houver uma já esperando, o botão vira um botão de atualização"*.
>
> **1. O toque fora deixa de responder** (`appDialogFixo`). O padrão do app é o
> do navegador: tocar no fundo cancela, e para quase tudo isso está certo — é a
> saída barata de quem abriu a coisa errada. Para a atualização não estava: ela
> aparece SOZINHA, no meio do que o operador estava fazendo, e um toque em
> qualquer lugar da tela a resolvia como "Deixar para depois", que a silencia
> pelo resto da sessão. **A atualização era perdida por um gesto que ele nem
> sabia ter dado.** O que NÃO muda, e é o que impede isto de virar uma armadilha:
> o "Deixar para depois" continua ali e o Esc/voltar continua valendo — os dois
> são a recusa DELIBERADA. O que deixa de existir é a recusa por acidente. A
> opção é por diálogo (`fixo: true`), não global: o resto do app continua com o
> padrão, que ali é o certo.
>
> **2. O botão é o herdeiro da LINHA DO APK** (v5.167), e o que mudou é o
> escopo. Aquela só existia quando havia um APK novo, e a única forma de
> PROCURAR era um toque escondido no rótulo de versão — uma afordância que não
> se anuncia, ao lado de um botão que aparecia metade das vezes. Eram dois
> controles para uma conversa só. Agora é um, sempre visível no app, com dois
> estados:
>
> | estado | rótulo | desenho |
> |---|---|---|
> | nada esperando | "Procurar atualização" | contornado (é uma consulta) |
> | algo esperando | "Atualizar: base v… e app v…" | preenchido (é a ação) |
>
> **A hora ruim continua desabilitando, com o motivo escrito** — e as duas
> réguas que já existiam continuam distintas: um lote com APK espera os três
> (cena, download e transmissão), porque instalar derruba o app inteiro e leva o
> servidor das telas junto; um lote só de base web espera dois, porque custa um
> piscar.
>
> **E o PONTO do rótulo de versão saiu.** Ele existia porque não havia mais nada
> no rodapé para dizer "há algo esperando" depois de a pergunta ser adiada.
> Agora o botão diz isso por extenso e é o próprio alvo; um ponto discreto a
> dois centímetros dele seria a mesma informação dita duas vezes — a régua que o
> operador aplicou ao peso do álbum na v5.232. O rótulo voltou a ser o que ele
> é: um indicador. Pelo mesmo motivo caiu a frase "Atualização adiada" que
> aparecia por quatro segundos: ela ESCONDIA, no próprio botão, a resposta que
> ele já estava dando.
>
> **O oráculo (`tools/ota.test.mjs`) ganhou quatro casos**, e reprova em **9
> asserções** contra o código anterior (verificado). Um deles é o toque fora, e
> os outros três são o botão nos três momentos em que ele importa: adiada,
> aplicando, e sem nada a fazer. As leituras novas são **null-safe de
> propósito** — num bundle sem o botão isso é um RESULTADO, não um acidente, e
> um `evaluate` que lança ali abortaria o arquivo inteiro, escondendo tudo o que
> vem depois. É a mesma disciplina do `empurrar` e do `tocar` do próprio
> arquivo, e a lição da v5.213: a primeira versão destes casos abortava, e as
> outras vinte e oito asserções sumiam com ela.

> **A v5.244: A SEGUNDA SÉRIE — o Informativo Mundial das Missões vira um álbum,
> e ela desmente três suposições da primeira. OTA PURO** (nenhuma linha de
> Kotlin; sem Release).
>
> Pedido do operador: acrescentar, além do Provai e Vede, o **Informativo
> Mundial das Missões** do canal `@daniellocutor` — *"você precisa analisar os
> nomes para poder seguir a mesma lógica para separar por datas, garantir que o
> vídeo é em português brasileiro e o áudio corretamente em português."*
>
> **O catálogo aguentou o peso — e é aí que está a lição.** A série entrou com
> uma linha e nenhum `if` por recurso, mas três coisas que pareciam regras
> universais eram suposições de quando havia uma série só. Duas viraram CAMPO
> declarado, e as duas estão escritas também na linha do Provai e Vede, porque
> enquanto ele era o único aquelas escolhas não pareciam escolhas:
>
> - **a playlist é do TRIMESTRE** ("Informativo | 3º Trimestre 2026", 13
>   episódios de julho a setembro). `mesDaPlaylist` passou a devolver **o mês em
>   que o período começa** — ele ordena as playlists e é o PISO de quem não
>   declarar data. **Quem dá o mês de um item é sempre a data do TÍTULO**, e com
>   playlists mensais os dois quase sempre concordavam: era por isso que a
>   distinção não aparecia. Com um trimestre ela é a diferença entre 13
>   episódios ordenados e 13 amontoados em julho.
> - **o título não traz nome de episódio.** "Informativo Mundial das Missões |
>   15 AGOSTO 2026" é a série mais a data, e a história ("O Sonho de Enoc") vive
>   na MINIATURA. Herdar o "o nome é o que vem antes da barra" daria 52 linhas
>   idênticas — a metade constante ocupando a lista inteira, que é exatamente o
>   defeito que aquela regra existe para corrigir, ao contrário. A linha virou
>   "15/Ago", e a gaveta do item (v5.236) responde o resto.
>
> **A terceira não virou campo, e não podia virar: o IDIOMA.** O canal publica a
> MESMA série em quatro — "Informativo" (PT), "Misiones" (ES), "Mission Stories"
> (EN) e "【聖工消息】" (ZH) —, e o prefixo separa as **playlists** mas **não
> separa os vídeos**: em espanhol eles se chamam "Informativo Mundial **de las
> Misiones**", isto é, começam com a mesma palavra. `ehOutroIdioma` é o irmão do
> `ehLibras` e está pelo mesmo motivo — um único vídeo posto por engano na
> playlist de português vai ao telão do culto sem que id, duração, miniatura ou
> canal o denunciem. Ele é GLOBAL e não um campo, porque ligá-lo por série seria
> escolher, a cada linha nova, se a proteção vale; e a resposta é sempre a
> mesma. O @provaievedeoficial passa por ele sem uma recusa, e há oráculo para
> essa metade negativa.
>
> **E o ÁUDIO é a outra metade da garantia, do outro lado da ponte.** O YouTube
> dubla vídeo sozinho, e a dublagem não muda o título: ela é uma faixa a mais
> dentro do MESMO vídeo, que nada do lado web tem como ver. Quem escolhe é o
> `TrilhaAudio.kt` (v5.242, já instalado no v2.1) — idioma antes do cliente,
> português exclusivo quando existe. As duas metades são independentes de
> propósito, e o Registro imprime a trilha escolhida (`140@VISIONOS pt-BR`) para
> a de baixo ser diagnosticável a distância.
>
> **O que a segunda série ACHOU de quebrado na primeira, e este é o achado mais
> caro do lote:** o ordinal opcional da data por extenso estava escrito
> `[ºo°]?` **depois** de um `\s*`, então em "03 outubro" ele casava o "o" do mês
> como ordinal e entregava o mês "utubro". O regex ACERTAVA — a captura satisfaz
> tudo o que ele pede, logo não há retrocesso — e quem recusava era o
> `montarData`, lá fora e calado. O defeito estava lá desde a v5.230 e nunca
> apareceu porque nenhum título de outubro do Provai e Vede caiu na forma por
> extenso; o Informativo tem um TRIMESTRE inteiro começando em outubro, e o mês
> teria entrado sem data e no fim da lista. O `o` agora tem de estar colado no
> dia (`3o`), e a varredura tenta **todos** os candidatos do título em vez de só
> o primeiro.
>
> **A data em si não custou uma linha**, e isso está registrado porque a leitura
> natural diante de um canal novo é supor o contrário: "15 AGOSTO 2026" é a
> forma por extenso da v5.230 sem o dia da semana na frente, e o `\b` do dia já
> a alcançava. Supor formato foi justamente o erro que a v5.230 corrigiu.
>
> Os dois oráculos foram verificados por ISOLAMENTO, e não por ausência de
> símbolo — desligar uma peça de cada vez, sem `ReferenceError` no caminho (a
> régua da v5.237): sem a recusa por idioma **6** asserções reprovam, sem o
> campo `titulo` **4**, sem o `periodo` **11**, e sem o recuo do `nomeDoItem`
> **1**. No percurso de ponta a ponta (`boot-nativo.test.mjs`, o único que sobe
> a base COM a ponte) o stub do canal responde **por URL de canal**, com os
> quatro idiomas lado a lado e o vídeo em espanhol **dentro** da playlist de
> português: é o único lugar em que essa recusa pode ser exercitada.

> **A v5.243: A SETA DE FECHAR O ÁLBUM VESTE A THUMB — e a coluna da direita
> para de se mexer. OTA PURO** (sem Release).
>
> Pedido do operador: *"mova a seta de fechamento do acordeão do álbum para que
> ele fique na thumb do álbum quando estiver aberto, não precisando mover os
> números referentes ao tamanho do álbum que hoje ficam ao lado dessa seta que
> surge."*
>
> **O defeito era assimétrico, e é isso que o tornava difícil de nomear.** A
> seta ocupava o mesmo canto do botão de baixar. Num álbum COMPLETO aquele canto
> está vazio — então abrir fazia a seta aparecer e empurrar o peso 34 px para a
> esquerda. Num álbum INCOMPLETO o canto já tinha o botão de baixar, e a seta
> apenas o substituía: nada se mexia. **O mesmo gesto movia ou não movia a tela
> conforme o estado do download**, que é a pior forma de um layout ser
> imprevisível — não há o que aprender.
>
> **A thumb é o lugar certo por eliminação.** Ela é um quadrado do mesmo tamanho
> no lado oposto, e com o álbum aberto é o único elemento da barra sem função: o
> ícone identifica uma coleção que o operador já está olhando por dentro. Fechada
> ela volta a ser identidade.
>
> **E a coluna da direita passou a ser função de UMA pergunta só** — "há o que
> baixar?" —, independente de aberto/fechado. Com o álbum aberto e parado o lugar
> é **reservado**, não ocupado (`visibility: hidden`, o idioma do
> `.mode-switch--vago`): quem baixa ali é o botão do painel, logo abaixo, que
> carrega o estado e o progresso. Reservar mantém a coluna sem oferecer dois
> botões para a mesma ação. O CANCELAR continua visível com o card aberto, que é
> a exceção que a v5.72 já defendia: a barra gruda no topo, e um álbum de
> centenas de faixas precisa poder parar num toque.
>
> Medido nos quatro estados: o peso fica a 11 px da borda num álbum completo e a
> 54 px num incompleto — **o mesmo número aberto e fechado**, nos dois. O
> oráculo (`tools/smoke.mjs`) mede essa distância, que é a coisa que o operador
> viu se mexer, e cobra os DOIS pares: reservar o lugar num deles e esquecer o
> outro passaria. Reprova em 2 asserções contra o código anterior.

> **A v5.242 (v2.1): O VÍDEO DO PROVAI E VEDE IA AO TELÃO EM INGLÊS, e a
> Bíblia passa a vir inteira sozinha. METADE APK, METADE OTA.** Dois relatos do
> operador, e eles não se tocam — o primeiro é Kotlin e exige Release, o segundo
> é a base web e chega por OTA.
>
> **1. "Vídeos do Provai e Vede estão sendo escolhidos os com áudio em inglês."**
>
> O YouTube dubla vídeo sozinho, e as dublagens chegam ao extrator **na mesma
> lista** de faixas de áudio da trilha original — sem nada na altura, no bitrate
> ou no contêiner que as distinga. A escolha era `cliente → contêiner → bitrate`,
> e **nenhum desses três sabe de idioma**: bastava a faixa em inglês ter bitrate
> maior (ou vir antes num empate) para ela ser a escolhida. Nada erra alto nesse
> caminho — o download funciona, o vídeo entra em cena, a barra anda —, e o
> operador descobre no sábado.
>
> A correção são DUAS metades, e a segunda é a que fecha o caso:
>
> - **O IDIOMA VEM ANTES DO CLIENTE**, invertendo a ordem que a v1.49
>   estabeleceu. A razão é uma assimetria de custo: uma faixa do cliente errado
>   é **403** — ela não baixa, e a fila de candidatos existe justamente para
>   absorver isso. Uma faixa do idioma errado **baixa perfeitamente**, e vai ao
>   telão. Um resultado errado entregue com sucesso é pior que uma tentativa
>   perdida.
> - **E o português, havendo, é EXCLUSIVO.** Ordenar não bastaria: `TETO_AUDIO`
>   é 2, e um 403 na primeira faixa faria a segunda — que pode ser a dublagem —
>   descer calada. Não havendo trilha em português (o vídeo é mesmo estrangeiro,
>   ou não declara trilha nenhuma), **nada muda em relação a antes** — e essa
>   metade negativa é a que impede a correção de virar "só baixa se for
>   português", que apagaria da biblioteca todo vídeo estrangeiro.
>
> **A escala tem cinco degraus e o mais sutil é o segundo:** um vídeo SEM
> metadado de trilha vem ANTES do ORIGINAL noutro idioma. Vídeo de faixa única é
> a esmagadora maioria do acervo, e rebaixá-lo por não se declarar penalizaria
> justamente o caminho que sempre funcionou. A DESCRITIVA é a última em qualquer
> idioma — inclusive em português, e inclusive para efeito da exclusividade: ela
> é a narração dos elementos visuais por cima do áudio, feita para quem não vê a
> tela, e deixá-la excluir a original estrangeira trocaria um problema por outro.
>
> **A regra saiu do `YoutubeGrab` para um arquivo PURO** (`TrilhaAudio.kt`, zero
> import) pelo mesmo motivo do `EspelhoHttp`: o resto daquele arquivo é rede,
> biblioteca de terceiro e `MediaMuxer` — nada disso se testa sem aparelho —, e
> o que decide se a congregação ouve português cabe em três funções com JUnit.
> São doze casos; contra a regra antiga, **oito reprovam** (verificado).
>
> **E o Registro passou a dizer QUAL trilha veio**, que é a leitura que faltava
> para este defeito ser diagnosticável: o resumo da extração ganhou
> `{pt-BR 2, en 2 dublado}` e a etiqueta da faixa virou `140@VISIONOS pt-BR`.
> Sem isso, a linha de um download em inglês é indistinguível da de um em
> português — foi assim que ele atravessou sem sinal nenhum.
>
> **O que NÃO foi verificado, e está dito:** o Kotlin não foi compilado — o
> ambiente desta sessão não resolve o plugin do Android (a mesma limitação da
> v5.228 e da v5.234). O `TrilhaAudio.kt` e o teste dele foram compilados e
> EXECUTADOS à parte (são puros); o `YoutubeGrab.kt` foi conferido só até onde
> um compilador sem as dependências alcança — ele parseia, e nenhum erro de
> sintaxe restou. Quem compila o resto é o CI, que falha alto. E há uma
> incerteza que só o aparelho resolve: se o extrator não devolver metadado de
> trilha nenhum para esses vídeos, todas as faixas empatam no degrau 1 e a
> escolha volta a ser a de antes — o `{…}` novo do Registro é exatamente o que
> diz em qual dos dois casos o aparelho está.
>
> **2. "Faça a Bíblia ser baixada inteira na versão ARA de forma automática."**
>
> O download da versão INTEIRA já existia desde sempre — e **só** era disparado
> por alguém ENTRAR na aba Bíblia. Quem nunca entrou ficava com o caminho sob
> demanda: um capítulo por vez, conforme o uso, com a rede da igreja no meio do
> culto como única rede disponível. Era o relato, palavra por palavra, e o
> oposto do que a aba faz assim que é aberta uma vez.
>
> `garantirBibliaBase()` entra no `init()` sem `await`, como o
> `autoRefreshCollections`. **A versão é a que o app já escolheria**
> (`pickDefaultBibleVersion` — a ARA, e a primeira disponível se ela não estiver
> no banco), e **não** a que o operador selecionou: esta é a base que o app
> garante, não a preferência de quem opera. Quem trocou de versão continua tendo
> a dele pelo caminho de sempre, ao entrar na aba.
>
> **O freio de 25 falhas seguidas nasceu junto, e nasceu porque a automação o
> exigiu.** Enquanto a varredura só começava por um toque na aba, insistir até o
> fim era barato: havia alguém olhando. Automática na abertura, um lançamento
> offline — ou com o Wi-Fi da igreja sem uplink, que este documento descreve
> como o ambiente NORMAL — pagaria 1189 requisições fadadas ao erro, com serviço
> em primeiro plano, wake lock e notificação, **a cada abertura**. Vinte e cinco
> erros seguidos não são uma oscilação (a concorrência é de 6): são a rede fora.
>
> O oráculo entrou no `boot-nativo.test.mjs`, com um banco do LouvorJA de
> mentira e a ARA em **segundo** lugar na lista de propósito — com ela na frente
> o caso aprovaria os dois comportamentos. Ele cobra as duas metades: a
> varredura começa sozinha, sem ninguém tocar na aba, **e** vai para a base
> mesmo com outra versão escolhida pelo operador. Três asserções reprovam contra
> o código anterior (verificado).

> **A v5.241: A BIBLIOTECA PASSA A TER UMA ESCALA DE TONS — dois tons, uma
> regra, os dois temas. OTA PURO** (CSS mais uma linha de texto; sem Release).
>
> Relato do operador: *"a escolha de cores e temas das versões colapsadas das
> coleções, dos álbuns e das músicas/itens do álbum… todo o esquema de cores e
> design está inconsistente"*, mais duas queixas nomeadas sobre o painel de
> opções.
>
> **Medido antes de mexer, no tema escuro, do fundo para dentro:** a folha do
> popup era 44,52,60; a barra de seção **fechada** compunha ~69,76,84 — o objeto
> mais claro da tela, sendo o contêiner mais externo —; a MESMA barra **aberta**
> virava 44,52,60, isto é, a peça trocava de cor conforme o estado; o card do
> álbum dentro dela, 59,69,80; e a faixa dentro do card, 44,52,60 outra vez. A
> elevação subia, descia, subia e descia — **44 → 69 → 44 → 59 → 44**, cinco
> níveis aninhados. Não havia regra a aprender, e é isso que "imprevisível"
> quer dizer.
>
> **A regra que entra é uma só: dentro da folha há DOIS tons, e o aninhamento
> nunca inverte a direção.** `--panel-2` é o tom de CONTÊINER — a barra da seção
> **e** o card do álbum, os dois —, e ele é o token certo porque muda de direção
> sozinho entre os temas (mais claro no escuro, mais escuro no claro). O corpo
> aberto é o POÇO, com a cor da folha. E dentro de um contêiner o conteúdo não
> ganha caixa: a faixa virou LINHA, separada pelo filete que separa qualquer
> lista deste app. Estado (aberta, no ar, selecionada) é overlay, nunca um tom
> novo.
>
> **A causa raiz estava escrita em prosa, e metade dela era falsa nos dois
> temas.** O comentário do `.hymnal-card` justificava a faixa como caixa: "as
> músicas dentro dele (que são `--panel`) passam a se ler como recessos". No
> escuro `--panel` (44) sobre `--panel-2` (59) de fato afunda; no CLARO `--panel`
> é branco puro (255) sobre 222 — ele **eleva**. A mesma declaração produzia
> direções opostas nos dois temas. É a lição da v5.192 aplicada ao aninhamento:
> **direção só se preserva por OVERLAY, nunca por token opaco.**
>
> **Por que dois tons e não uma escada de quatro:** uma escada de overlays
> levaria o nível mais interno a ~180 no tema claro — mais escuro que a própria
> página, um buraco no meio da lista. Dois tons fecham a conta nos dois temas
> com a mesma regra.
>
> **O botão de verificação ganhou corpo** — *"o ícone e o texto estão muito
> finos e sem preenchimento para encorpar"*. Ele estava em `--surface`, que é o
> "botão sobre o FUNDO do app", **dentro de um cartão** — e a regra escrita deste
> projeto diz que ali a superfície se INVERTE: era o token errado para aquele
> lugar desde sempre. Agora `--accent-soft` (o preenchimento concorda com a cor
> do texto e do ícone), peso 600 e traço de 2,4 no SVG. O cancelar volta ao
> recesso enquanto roda, senão o progresso em `--warn-soft` seria uma tinta
> fraca sobre outra — o mesmo defeito que a v5.232 já tinha corrigido com outras
> duas cores.
>
> **E o estado virou só a FRAÇÃO** — *"sem o texto de completo que hoje tem uma
> grafia e design completamente diferente do padrão do app"*. Ele está certo por
> duas réguas: "✓ completo" trazia um glifo que não é da fonte de ícones do app
> e uma palavra em caixa baixa no meio de uma linha de números, e dizia por
> extenso o que "24/24" já diz — com o verde ao lado dizendo a mesma coisa pela
> terceira vez. Quem carrega estado neste app é a COR; o texto fica com o que a
> cor não sabe dizer, que é quanto falta. Numa série o número é a contagem de
> episódios, sem a palavra; sem índice não há fração e a linha fica vazia, que
> é o certo — o botão ao lado já diz "Baixar", e um botão de baixar num álbum
> vazio é a própria mensagem.
>
> O oráculo (`tools/smoke.mjs`) trava as três metades da regra **nos dois
> temas** — a barra não troca de cor com o estado, contêiner é um tom só, e a
> faixa não tem caixa —, porque a causa raiz era justamente uma direção que se
> invertia entre eles. Reprova em 4 asserções contra o CSS anterior.

> **A v5.240: A LINHA DE UMA FAIXA DEIXA DE SER MAIS ALTA QUE O ÁLBUM QUE A
> CONTÉM. OTA PURO** (só CSS; nenhuma linha de Kotlin, sem Release).
>
> Relato do operador: os cards da lista de um álbum estão *"muito volumosos
> verticalmente, limitando o número de itens na visualização da lista, e até
> mesmo ficando muito diferente do tamanho que já são títulos dos álbuns"*.
>
> **Medido antes de mexer, e ele estava certo por um fator visível:** a barra do
> álbum tinha **51,6 px** e a linha de uma faixa DENTRO dela, **66 px** — o item
> era 28% mais alto que o cartão que o contém, e o passo de 71,6 px punha 12
> faixas numa tela de 900 px. O nome da faixa ainda era desenhado MAIOR que o
> título do álbum (1,02rem contra 0,95rem), isto é, a hierarquia estava
> invertida nas duas dimensões ao mesmo tempo.
>
> **Quem forçava a altura era o botão de tocar**, 46 px — o tamanho que ele
> herdou da miniatura que ele substituiu na v5.62. Num álbum aberto o conteúdo
> da linha é UMA linha de texto de 19 px: sobravam 43 px de folga por faixa,
> repetidos em 613 hinos.
>
> Agora o ▶ tem 38 px, o padding caiu de .5rem para .3rem e o nome entrou na
> escala do título (0,95rem) — o que separa os dois passou a ser o PESO (700 no
> álbum, 500 na faixa), que é a distinção certa. Medido depois: **linha de
> 51,6 px contra barra de 51,6 px** (razão 1,00), passo de 55,6 px, **16 itens
> na mesma tela**.
>
> **O piso de toque é a outra metade, e ela não é negociável:** encolher até o
> texto trocaria um problema de densidade por um de mira no meio de um culto. O
> ▶ para em 38 px, acima de `--hit` (34 px), que é exatamente a medida que esse
> token existe para proteger.
>
> **A linha da BUSCA cresce com o conteúdo, como sempre:** com subtítulo ela dá
> os mesmos 51,6 px (o texto ainda cabe atrás do botão), e com um trecho de
> letra casado vai a 67,3 px — ali a altura é do conteúdo, não do enfeite.
>
> O oráculo (`tools/smoke.mjs`) trava a RAZÃO, nunca o pixel: escrever "51,6"
> faria ele reprovar numa mudança legítima de fonte, e a queixa nunca foi sobre
> um número — foi sobre a linha ser maior que o título. Ele reprova em 3
> asserções contra o CSS anterior (verificado).

> **A v5.239: A SEÇÃO DE FAVORITOS FICA SÓ COM A LISTA — as ações sobem para a
> barra, viram UM ícone, e o rodapé de disco sai. OTA PURO** (nenhuma linha de
> Kotlin; sem Release).
>
> Quatro podas do operador, e as quatro tiram da tela coisa que não decide nada.
>
> **O contador saiu.** *"Remova o indicador de quantos favoritos temos."* A
> seção está sempre aberta e a lista inteira vem logo abaixo: um número dizendo
> quantos itens há a dois centímetros deles é a mesma medida dita duas vezes —
> o argumento que tirou o peso do painel do álbum na v5.232.
>
> **As ações subiram para a BARRA da seção, só com ícone.** No corpo elas eram
> dois botões de texto no rodapé, isto é, duas linhas de lista que não são itens
> da lista. Na barra o rótulo do que a ação faz mora na folha que ela abre — e
> um cabeçalho com texto de botão dentro deixa de se ler como cabeçalho.
>
> **E OS DOIS BOTÕES VIRARAM UM.** *"Unifique o botão de Adicionar pasta com o
> botão de buscar no sistema. Agora ao tocar ele, ele dá a opção de criar uma
> pasta, ou trazer uma pasta e seus arquivos que já existem do sistema do
> celular."* A unificação é a leitura certa: os dois respondiam à MESMA pergunta
> ("quero uma pasta aqui") por caminhos diferentes, e lado a lado obrigavam a
> ler dois rótulos para descobrir isso. Um alvo só, e a diferença — que é o que
> de fato precisa ser lido — vai para a folha, **escrita por extenso**, que é
> onde este app põe escolha desde a v5.62. A folha é a MESMA do acervo e do
> YouTube (`#songMenuPopup`), pelo motivo de sempre: uma segunda com a mesma
> anatomia divergiria no primeiro ajuste. É o precedente do `escolherDestinos`.
>
> **O corpo perdeu a prosa.** O vazio explicava COMO favoritar e COMO criar
> pasta, em três linhas. A estrela está em cada linha do app inteiro e a criação
> de pasta agora fica a um dedo dali, na barra: **instrução que descreve um
> botão visível é ruído, e o botão é a instrução.** Ficou "Nenhum favorito
> ainda."
>
> **E O RODAPÉ DE DISCO SAIU DA BIBLIOTECA** — *"esse valor é falso, irreal e
> disputa com os cabeçalhos que já dizem o peso atual e total dos arquivos"*. Ele
> está certo pela régua da própria medida: `navigator.storage.estimate()` fala do
> ORIGIN inteiro e é deliberadamente imprecisa (os navegadores acrescentam
> padding ao valor, contra ataques de tempo), e a "cota" é o que o navegador ACHA
> que pode ceder — não o que o cartão tem. Ela ocupava o rodapé da tela em que a
> pergunta *"quanto isto pesa?"* já é respondida coleção por coleção, com o
> número que o app de fato conhece. `renderStorageUsage` saiu com os dois
> chamadores; `fmtBytes` fica, porque é o formatador de tamanho do app inteiro.

> **A v5.238: OS FAVORITOS DEIXAM DE TER DUAS PORTAS — a seção não colapsa, e a
> gaveta vira só a tela de dentro de uma pasta. OTA PURO** (nenhuma linha de
> Kotlin; sem Release).
>
> Três pedidos do operador, e os três fecham o movimento que a v5.237 começou:
> *"mantenha os favoritos como uma seção sempre aberta. E também ajuste esses
> favoritos na biblioteca para ter também o sistema de importar pastas que temos
> nos favoritos original. E pode remover o botão de acesso ao local e sistemas
> antigos dos favoritos, pois tudo agora será dentro da biblioteca."*
>
> **A seção não colapsa, e a razão é a mesma que a pôs no topo.** Os favoritos
> são o atalho de quem já procurou antes; um atalho atrás de um toque a mais
> deixa de ser atalho. O construtor de grupo ganhou `fixo`: sem seta, sem
> ouvinte e sem cursor de toque — **um cabeçalho que parece tocável e não faz
> nada é pior que um rótulo**, e essa é a única parte disto que o CSS decide.
>
> **"Pasta do aparelho" desceu do cabeçalho da gaveta para o rodapé da seção**,
> ao lado de "Nova pasta". Não é realocação por gosto: aquele botão era ação da
> RAIZ da gaveta, e a raiz deixou de ser alcançável — ele ficaria sem lugar
> nenhum de onde ser tocado. No rodapé as duas formas de criar pasta se leem
> juntas, que é a pergunta que elas de fato respondem ("de onde vem o que eu
> quero ter à mão?"), e as duas são `.import-btn` na mesma `.import-row`, que já
> era `flex` com `flex: 1` em cada — dividem a linha sem uma regra nova.
>
> **A gaveta sobrevive como a tela de DENTRO, e só isso.** `#favHeadBtn` saiu do
> cabeçalho com o CSS dele; `#addDirBtn` saiu da gaveta. O único caminho para lá
> é entrar numa pasta (`garantirGaveta`), e por isso **o voltar sempre FECHA**:
> subir para uma "raiz" que ninguém mais alcança seria devolver o operador a uma
> tela sem porta. A tela de trás é a Biblioteca, que continua aberta embaixo,
> com a seção de onde ele veio.
>
> **O que se ganha é o que a v5.193 já tinha cobrado noutro lugar:** duas portas
> para a mesma lista são dois lugares para ela divergir — e o cabeçalho tem
> largura de celular, com um voltar, uma troca de modo e um título disputando-a.
>
> Os oráculos do `boot-nativo.test.mjs` cobram as duas metades de cada pedido: a
> seção está aberta com todos os outros grupos fechados **e** não há como
> fechá-la (sem seta, e o clique no cabeçalho não alterna); o rodapé tem as duas
> formas de criar pasta **e** a gaveta continua desenhando a lista dela.

> **A v5.237: A BIBLIOTECA VIRA UM ÍNDICE — as seções nascem fechadas e os
> FAVORITOS são a primeira delas. OTA PURO** (nenhuma linha de Kotlin; sem
> Release).
>
> Dois pedidos do operador, e eles são o mesmo movimento: *"coloque os favoritos
> dentro da biblioteca"* e *"tornar os agrupamentos de coleções, como diversos e
> cds do ano e etc… todas as coleções, em colapsados, assim a listagem das
> seções fica mais curta e a navegação se torna mais ramificada, para maior
> organização. Pode deixar a seção de favoritos no topo da listagem."*
>
> **O que a Biblioteca era: uma pilha com títulos.** Os cabeçalhos de grupo eram
> rótulos mudos e todos os cards vinham despejados embaixo, um atrás do outro —
> numa igreja com dezenas de álbuns, abrir a Biblioteca era rolar até achar a
> SEÇÃO, e só então o álbum. Agora a primeira tela é o índice: meia dúzia de
> linhas com nome e contagem, e cada toque desce um nível. Medido no viewport de
> um celular: **114 px fechado contra 184 px** com uma única seção aberta, e
> essa distância cresce com o tamanho do acervo.
>
> **Fechado NÃO CONSTRÓI os cards, e isso não é otimização de véspera:** o
> acervo é redesenhado a cada 400 ms enquanto um download roda
> (`COLL_REFRESH_MS`), então montar dezenas de cards que ninguém está vendo era
> o grosso do trabalho de DOM da tela. Por isso o construtor de grupo devolve o
> corpo **ou `null`** — quem recebe `null` não monta nada, em vez de montar e
> esconder com `display: none`.
>
> **Abrir um grupo não fecha os outros**, ao contrário do acordeão de um álbum.
> Lá a razão é o tamanho (duas listas de centenas de músicas empurrariam para
> fora da tela o card que o operador mira); aqui os grupos são curtos, e
> comparar dois — "este álbum ou aquele?" — é o que se faz numa tela de índice.
>
> **Os favoritos têm duas casas e UMA implementação.** O grupo do topo é montado
> pelo MESMO `renderFolderList` da gaveta, apontado para outro host (`favHost`,
> o padrão que `listHost()` e `renderStorageUsage(alvo)` já usavam neste
> arquivo). Duas marcações para a mesma lista divergiriam no primeiro ajuste — e
> divergiriam justamente nos gestos (o toque longo que entra na seleção
> múltipla), no agrupamento por tipo e na estrela.
>
> **A gaveta continua existindo, e não por esquecimento: ela é a tela de
> DENTRO.** Entrar numa pasta abre voltar, busca e seleção múltipla — isso é uma
> tela, não uma seção, e reimplementá-la inline seria a duplicação que a decisão
> acima existe para evitar. Quem garante a gaveta é `openFolder`/`openOpfsFolder`
> (uma função, não um ouvinte por linha), e o `#favPopup` ganhou um degrau de
> `z-index`: ele é declarado ANTES da Biblioteca no documento, e sem isso o
> toque numa pasta abriria uma gaveta POR BAIXO — a mesma armadilha, com o mesmo
> remédio, que o `#folderPopup` já documentava.
>
> **A linha de uso do disco não é repetida** dentro do grupo: ela já é o rodapé
> da listagem, e duas no mesmo `<ul>` fariam a segunda apagar a primeira num
> `estimate()` fora de ordem.
>
> Os oráculos entraram no `boot-nativo.test.mjs` e cobram as duas metades de
> cada pedido: fechado não constrói card **e** o toque abre; os favoritos são
> desenhados na Biblioteca **e** a gaveta continua desenhando os dela — sem essa
> segunda metade, apontar o host para o lugar novo teria quebrado o antigo em
> silêncio. Verificados por ISOLAMENTO, não por ausência de símbolo: com os
> grupos nascendo abertos, 2 asserções reprovam; sem o grupo de favoritos, 5.
> (A diferença importa — um `ReferenceError` reprova tudo sem discriminar nada,
> que é a medição que a v5.233 recusou.)

> **A v5.236: A BIBLIOTECA PASSA A TER TIPOS — a gaveta de um vídeo deixa de
> prometer letra, e a fila de letras deixa de perguntar por ele. OTA PURO**
> (nenhuma linha de Kotlin; sem Release).
>
> Pedido do operador: *"atualmente a biblioteca é estruturada para usar vídeos e
> músicas, mas ela também vai ser usada para armazenar os materiais de eventos,
> vídeos comuns e apresentações futuramente… mas por exemplo, o toque nele na
> lista abre ainda a opção de ver a letra, mas ele não tem letra por não ser uma
> música"*.
>
> **O diagnóstico é o da v5.229 numa terceira roupa: desviar as PORTAS de um
> recurso não desvia o que estava atrás delas.** A Biblioteca nasceu com um
> modelo de item só — a música do LouvorJA, que tem áudio, letra e uma segunda
> variante —, e tudo o que a lista oferece saiu daí. A v5.230 desviou as duas
> FOLHAS de um episódio de série para o caminho do YouTube e parou; a LINHA
> continuou sendo a da música, e por isso o toque nela ainda abria a caixa da
> letra para anunciar **"Letra ainda não baixada"** — a promessa de uma coisa
> que nunca vai chegar.
>
> **O que entra não é um `if` a mais, é o TIPO** (`tipoDaColecao`, com as
> capacidades `temLetra` e `ehLink`). Cada afordância passou a perguntar pela
> capacidade de que ela depende, nunca por "é série?" — e a diferença é
> justamente o que abre lugar para o terceiro modelo que o operador anuncia (os
> materiais de evento, os vídeos avulsos e as apresentações): ele entra como mais
> um tipo e um punhado de respostas, em vez de mais um `ehSerie` espalhado por
> meia dúzia de funções que não se conhecem. **Por COLEÇÃO, e não por item**, e
> isso está escrito como escolha: hoje toda coleção é homogênea, e o dia em que
> uma não for, o que muda é `tipoDoItem(coll, s)` consultar o `s` primeiro.
> Escrever esse desvio agora seria um ramo que nada alcança.
>
> **A gaveta responde a mesma pergunta com a resposta do tipo.** Ela existe para
> dizer "é este mesmo?": numa música isso é a LETRA (e é dela que sai o trecho
> marcado quando a busca casou no meio de uma estrofe); num vídeo é a
> **MINIATURA**, a duração e o estado no aparelho. Os dois primeiros o extrator
> já entregava em toda listagem de playlist e o índice **descartava**; o
> terceiro é o que decide de verdade no domingo de manhã, porque "Tocar agora"
> de um vídeo TRANSMITE e um episódio já guardado entra do disco — ~300 MB de
> diferença.
>
> **E guardar um campo novo no índice obrigou a mexer na assinatura**, senão
> este lote reproduziria o defeito da v5.233 pela porta de trás: `AVSerie.
> impressao` conhece a regra que decide nome e ordem, e quem decide o que o
> índice GUARDA é uma função do `controle.js`. Ela virou `serieFaixaDoItem`,
> nomeada de propósito — é o CÓDIGO dela que entra na assinatura, e um `map`
> anônimo não tem nome para passar. Índice velho é refeito uma vez, sozinho.
>
> **A correção mais cara do lote é a que ninguém veria.** `syncLyrics` varria
> TODA coleção com itens e pedia `music_<id>` ao LouvorJA — e num episódio de
> série esse id é do **YouTube**, uma pergunta que aquele banco não tem como
> responder. Falha de rede não grava `LYRIC_NONE` de propósito, então as ~52
> requisições de cada série voltavam **a cada abertura do app, para sempre**, e
> ainda entravam no total da notificação "Letras das músicas", que o operador lê.
> O modo de falhar é o mais silencioso que este projeto tem: um `catch` vazio
> numa tarefa de segundo plano. O índice da busca por trecho varria o mesmo
> nada, sem custo de rede.
>
> Os oráculos entraram no `boot-nativo.test.mjs` — o único que sobe a base COM a
> ponte, logo o único capaz de exercitar a série — e cobram as DUAS metades: o
> vídeo deixa de prometer letra **e** a música continua tendo a dela. Sem a
> segunda, apagar a gaveta inteira passaria. Verificados nos dois sentidos: **6
> asserções reprovam** contra o código anterior.
>
> **E a primeira versão deles reprovou por um defeito do próprio teste**, que é a
> lição da v5.208 numa terceira roupa: ele clicava na linha sem entrar no modo
> AVANÇADO, e no Modo Fácil o toque na linha TOCA em vez de abrir gaveta
> nenhuma — a medição encontrava um container vazio e teria concluído o que
> quisesse. O caso ao lado (a série é ordenada por data) escondia a segunda
> armadilha: o primeiro item da lista é o de julho, e medir a miniatura nele
> reprovaria uma gaveta que está certa.

> **A v5.235: A LINHA DAS OPÇÕES ENCOLHE DE VERDADE — o estado sai da segunda
> linha e a remoção vira só a lixeira. OTA PURO** (nenhuma linha de Kotlin; sem
> Release).
>
> Pedido do operador sobre a v5.232: *"mude de lugar o subtítulo de completo ou
> de progresso… não use linha dupla, pois a ideia já é justamente compactar os
> elementos dessas opções. Apenas diminua o botão de remover apenas para um
> botão de ícone de lixeira. Isso vai liberar mais espaço para o botão de
> atualizar."*
>
> Ele está corrigindo uma meia-solução minha. A v5.232 tirou as duas faixas de
> chips e pôs o estado DENTRO do botão — só que numa segunda linha, o que
> devolvia ao painel a altura que condensá-lo tinha acabado de tirar. Agora o
> estado divide a linha com o rótulo e, quando falta largura, é ELE que
> encolhe com reticências: some o qualificador, nunca a palavra que diz o que o
> toque faz.
>
> **A lixeira sem rótulo é uma decisão sobre CONFIRMAÇÃO, não sobre espaço.** O
> que ela perde na tela — "do dispositivo", que dizia o alcance — está inteiro
> no diálogo que ela abre ("Excluir o que foi baixado de X (áudios e capas) e a
> lista offline?"), e é isso que permite um destrutivo ficar só com o ícone: ele
> é confirmado, e a confirmação é quem nomeia o dano. A frase continua no
> `title` e no `aria-label`. Medido: 44 px contra 316 px — a linha inteira é do
> botão que carrega ação, estado e progresso.
>
> Com isso caiu também o argumento do `flex: 1 1 0` da v5.95 ("a ação destrutiva
> não pode ser a maior das duas"): ela agora é, por construção, a menor.
>
> **E O ORÁCULO DA v5.232 ESTAVA MEDINDO ZEROS.** A asserção "os controles
> dividem uma linha" comparava os topos dos botões dentro de um painel que, no
> Modo Fácil, é `display: none` por regra — e num elemento escondido toda medida
> é zero. Zeros comparados com zeros passam: ela aprovava um layout que nunca
> tinha olhado. É a lição da v5.208 com outro nome (*"uma medição que não acha
> nada parece uma medição que passou"*), e a correção é a mesma: **entrar no
> modo em que a peça vive** (`setAppMode('full')`) e desenhar numa lista própria
> e VISÍVEL, com a largura de um celular. Agora as quatro asserções novas
> reprovam no código anterior (verificado).
>
> **Uma segunda armadilha do mesmo caso, e ela é do tipo que passa despercebido
> para sempre:** "o botão não tem rótulo" não pode ser lido do `textContent`. O
> ícone é uma LIGADURA da fonte, isto é, um caractere de uso privado dentro do
> `<span class="msym">` — `trim()` não o remove e `JSON.stringify` o imprime sem
> escapar, então o dump dizia `""` para uma string de comprimento 1. A pergunta
> certa é pelos nós de TEXTO diretos do botão, que é o que "rótulo na tela"
> significa.
> **A v5.234 (v2.0): O SISTEMA DE ATUALIZAÇÃO INTEIRO — os dois canais viram
> um evento, a detecção fica autoritária e a pergunta volta. EXIGE APK**
> (`SHELL_VERSION` **43**).
>
> Pedido do operador, e ele nomeia o defeito melhor do que qualquer diagnóstico
> meu: *"a detecção de atualizações disponíveis é extremamente inconstante,
> demorada e quase aleatória… precisamos de um sistema autoritário absoluto"*.
> Mais o desenho de como ela deve terminar: um popup com "Atualizar agora" ou
> "deixar para depois"; e havendo Release nova, *"o sistema aguarda a release
> sair, para então liberar o ota, assim o ota já vem com o link da release"*.
>
> **Os DOIS canais passam a ser UM evento.** `shellTag` no `version.json`
> declara a Release que o lote exige; o `web-ota` SEGURA a publicação do bundle
> até ela existir, e o gatilho `release: [published]` a republica com o bloco
> `shell` dentro do manifesto — versão, URL do `.apk` e tamanho. O aparelho lê
> tudo numa requisição só e pergunta UMA vez sobre o lote inteiro.
>
> **E é o manifesto que permite a detecção ser rápida.** A ronda foi de 60 s
> para **15 s**, o piso de 15 s para 5 s e o back-off de até 90 s para até 30 s.
> Perguntar o APK à API do GitHub nessa cadência esgotaria as 60 requisições/hora
> em quinze minutos e a detecção passaria a falhar com 403 pelo resto da hora —
> mais lenta e mais imprevisível do que os 30 minutos de antes. Um asset de
> release não consome limite nenhum.
>
> **Três defeitos de detecção foram achados no caminho, e os três são mudos:**
> o piso entre consultas (15 s) era IGUAL à ronda, então uma batida que chegasse
> um milissegundo cedo era descartada e a ronda valia 15 s ou 30 s conforme o
> jitter do agendador — literalmente "quase aleatória"; a ronda morria em
> silêncio para sempre se o `Runnable` lançasse (`scheduleWithFixedDelay`
> cancela as execuções seguintes, sem log); e um **`sha256` reprovado era
> carimbado como SUCESSO**, então a ronda seguinte rebaixava o mesmo zip,
> reprovava o mesmo hash e repetia, megabytes por minuto, para sempre. Este
> último tinha causa estrutural conhecida — os dois assets eram substituídos um
> a um, sem transação, e o próprio comentário do `concurrency` já dizia que uma
> intercalação deixa "o zip de uma com o sha256 da outra". O **nome versionado
> do zip** fecha a causa; tratar o sha reprovado como falha retentável fecha o
> modo de falhar.
>
> **A pergunta volta, e ela revoga a v5.151 pelo lado certo.** Aquela versão
> tirou o diálogo porque ele "nunca aparecia" — era suprimido com cena, download
> **ou espelho ligado**, e o espelho fica ligado o culto inteiro. O diagnóstico
> estava certo e o remédio era largo demais: aplicar sem perguntar troca a base
> no meio do que o operador estiver fazendo. Agora o espelho **não segura mais**
> a pergunta (ele custa uma tela da rede com a página antiga em memória; a cena
> e o download custam a projeção e o hinário pela metade), e instalar o APK —
> que derruba o app inteiro — continua esperando os três.
>
> **A INTENÇÃO é a peça que faz o lote de duas metades funcionar.** `otaApply`
> substitui o documento, então nada em memória atravessa esse ponto — e é
> justamente depois dele que falta instalar o APK. Ela é gravada no `state` do
> banco ANTES de aplicar (o mesmo lugar e o mesmo motivo da intenção de download
> do YouTube, v1.59) e relida na abertura, que retoma sozinha. Descartada quando
> o `versionName` instalado alcança a versão pedida, senão o instalador
> reabriria a cada abertura oferecendo a versão que já está rodando.
>
> **O oráculo que faltava:** `tools/ota.test.mjs`, em Chromium com ponte de
> mentira. Este era o único caminho do app cujo defeito **não tem sintoma** —
> quando a atualização não chega, nada quebra e o operador só continua na versão
> de anteontem sem saber —, e nenhum teste o tocava: o `smoke.mjs` sobe sem
> ponte (todo o bloco é `window.__NATIVE__`) e o `boot-nativo` prova o boot, não
> o fluxo. Ele reprova em **23 asserções** contra o código anterior (verificado),
> e ele próprio quase repetiu o erro do `apk.yml` da v5.213: a primeira versão
> abortava na primeira asserção e levava as outras vinte e duas junto.
>
> **O que NÃO foi verificado, e está dito:** o Kotlin não foi compilado — o
> ambiente desta sessão não resolve o plugin do Android (a mesma limitação da
> v5.228). Quem compila é o CI, que falha alto. As referências cruzadas foram
> conferidas à mão, e a lógica do passo novo do workflow foi exercitada nos
> **seis** caminhos possíveis com um `gh` de mentira.

> **A v5.233: O ÍNDICE DA SÉRIE FICAVA PRESO NA REGRA VELHA — a correção da
> v5.230 nunca chegou à lista. OTA PURO** (nenhuma linha de Kotlin; sem
> Release).
>
> Relato do operador: *"tentei limpar o cache e recarregar, mas a listagem ainda
> mantém o item do provai e vede que não identificava o 3 de janeiro… verifique
> se ele está atualizando a listagem ou se ele fica preso"*.
>
> **Ele fica preso, e a pergunta dele nomeia o defeito.** O índice da série é
> guardado com os nomes JÁ FORMADOS e a ordem JÁ decidida, e a atualização é
> pulada quando a assinatura das playlists bate com a guardada — a economia da
> v5.228, que evita doze extrações do YouTube por retomada. Só que aquela
> assinatura fala do que o **canal** publicou, e o canal não mudou uma vírgula:
> a v5.230 mudou a REGRA que transforma títulos em nomes, e nada nessa conta
> sabia disso. Toda atualização batia a assinatura e devolvia na hora, com o
> índice de antes.
>
> **E limpar o cache não podia ajudar** — o índice mora no IndexedDB, não no
> cache do WebView. Não havia caminho nenhum na tela que desfizesse isso.
>
> É a lição da v5.220 num lugar novo: **um valor DERIVADO que sobrevive à
> mudança da regra que o derivou é um valor errado com carimbo de atual.**
>
> A correção é a impressão digital da regra entrar na assinatura
> (`AVSerie.impressao`): um FNV-1a de 32 bits sobre o código das funções que
> decidem, mais o catálogo. Mudou a regra, a impressão muda e o índice é refeito
> **uma vez**; não mudou, nada é reextraído e a economia fica intacta. Ela é
> tirada do próprio código de propósito — um contador que alguém precise lembrar
> de subir é a mesma sincronização manual que este projeto recusa em toda parte,
> e quem esquecesse de subi-lo reproduziria exatamente este defeito. O preço
> está dito: se um dia a base web passar por um minificador, a impressão muda a
> cada build e custa doze extrações por versão.
>
> **O oráculo teve DUAS versões, e a primeira era um falso positivo** — o que
> aqui é a parte instrutiva. Ela escrevia uma assinatura inventada
> (`"rVELHA|…"`) para simular o aparelho do operador, e qualquer lixo difere do
> que o código calcula: ela passava nas DUAS versões, isto é, não media nada. A
> que ficou reproduz o estado REAL — a assinatura que a versão anterior
> escrevia, só o canal — e por isso reprova no código anterior (verificado). A
> segunda metade é inseparável: com a regra e o canal em dia, **nenhuma**
> extração acontece; sem ela, "refazer sempre" passaria no teste e custaria doze
> idas ao YouTube por retomada.
>
> **No aparelho:** a lista se conserta sozinha na próxima atualização de índice
> (o TTL é de 12 h, no abrir do app), e o "Atualizar a lista" do card força na
> hora.

> **A v5.232: AS OPÇÕES DO ÁLBUM VIRAM UMA LINHA — o peso sai porque já estava
> na barra. OTA PURO** (nenhuma linha de Kotlin; sem Release).
>
> Pedido do operador: *"o peso já não precisa existir ali, pois já está na barra
> principal antes mesmo de abrir. quanto aos outros elementos, preciso ajustá-los
> para que fiquem apenas em uma linha, resumindo basicamente a verificação (com o
> indicador do progresso e resultado) ou remoção."*
>
> O painel aberto tinha **três linhas para duas ações**: uma faixa de chips
> ("Sincronizados: 4/4 · Completo offline" e "Peso: 18 MB") e, abaixo, os dois
> botões. Agora é uma: `[⟳ Verificar · ✓ completo] [🗑 Remover do dispositivo]`.
>
> **O peso era a mesma medida dita duas vezes, a dois centímetros.** Ele já vive
> na barra do card — `fracaoPeso`, o mesmo par de números —, e é justamente por
> lê-lo ali que o operador decide abrir. Saíram com ele o `hymnalStat()` e o
> `fmtParBytes()`, que não tinham outro chamador. E vale registrar por que ele
> sobreviveu tanto: a v5.73 fez esta mesma faxina, e o peso só passou a estar na
> BARRA depois (v5.70/v5.93) — ninguém releu o painel contra ela.
>
> **O estado não se perdeu: ele desceu para dentro do botão que qualifica.** A
> gramática é a mesma da cortina e do botão de transmitir — **o rótulo nomeia a
> AÇÃO, o estado diz onde ela está**: "Verificar · ✓ completo", "Baixar · 12/24",
> "Atualizar a lista · 52 episódios". Sozinho, o rótulo anterior ("Verificar
> atualizações") não dizia nem que o álbum estava inteiro no aparelho.
>
> **E o progresso virou DESENHO, não uma segunda frase.** Enquanto o download
> roda, o botão de cancelar se preenche até `--p`. Escrever "Baixando 2 de 4…"
> aqui seria repor exatamente o que a v5.73 tirou deste painel — quem escreve
> isso é a barra do card, fixa no topo do aberto e visível daqui. Duas
> armadilhas de CSS ficaram escritas na folha: o preenchimento precisa de
> `z-index: -1` **e** de `isolation: isolate` no botão (o rótulo é um nó de
> TEXTO e não recebe `z-index`, então quem desce é a barra; sem o contexto de
> empilhamento o -1 cairia atrás do fundo do próprio botão), e o aviso do
> cancelar mudou de papel — era o fundo chapado, virou borda e texto, porque um
> preenchimento em `--warn-soft` sobre um fundo `--warn-soft` seria uma barra
> invisível.
>
> Os oráculos se dividem pela natureza: o `boot-nativo` mede o ESTADO (o painel
> com um filho só, o peso ausente dele e PRESENTE na barra, o resultado dentro
> do botão) e o `smoke.mjs` mede a FORMA (o preenchimento é proporcional, fica
> atrás do rótulo e não é da cor do fundo). Verificados nos dois sentidos —
> 4 e 3 reprovados com o código anterior.
>
> **E um falso negativo do próprio teste virou lição, de novo:** a primeira
> versão da asserção não achava o painel, e o defeito era do harness —
> `renderCollectionsList` **acrescenta** à lista, e o caso anterior já a tinha
> desenhado, então o `find` achava o card VELHO, ainda fechado. Medir o primeiro
> nó que casa não é medir o que está na tela.
> **A v5.231 (v1.99): OS BOTÕES DA NOTIFICAÇÃO PASSAM A SER DA CENA, e a
> transmissão deixa de sumir quando há mídia no ar. EXIGE APK.**
>
> > **A TAG É A v1.99 E NÃO A v1.98, e o registro fica porque o erro é
> > instrutivo:** a v1.98 já tinha sido publicada pelo lote paralelo (as séries,
> > shell 41), e disparar a Release com aquele nome não moveu a tag — o
> > `action-gh-release` não move tag existente — mas SUBSTITUIU o `.apk` dela por
> > um compilado de `main`. Isto é, por alguns minutos a página da v1.98 serviu
> > um binário que não era o código da v1.98. A regra que faltava está escrita no
> > "Build": **tag nova para binário novo**; mover uma já publicada é o que o
> > input `retag` existe para fazer, de propósito atrás de um input próprio.
>
> Duas perguntas do operador, e a primeira precisa de uma correção de premissa
> antes da resposta.
>
> **1. "Conseguimos centralizar a transmissão no player, removendo a notificação
> individual dela?"** — **ela já é um cartão só desde a v5.190**: o
> `EspelhoService` e a notificação dele foram removidos ali, e o que restou foi
> UM cartão com DUAS CARAS (player com cena · endereço e telas sem cena). O que
> o operador estava vendo como "a notificação exclusiva da transmissão" é a
> segunda cara.
>
> O que de fato faltava, e este lote entrega: **com uma cena no ar, a
> transmissão sumia**. Punha-se um louvor para tocar e a gaveta deixava de dizer
> que havia um servidor no ar — a informação existia e era descartada. Agora ela
> é o SUBTEXTO do player (a linha do cabeçalho que o `MediaStyle` desenha), que
> não disputa espaço com o título nem com os botões.
>
> **Um player LITERAL em tempo integral não é possível, e a razão é da
> plataforma, não de gosto.** Para o cartão sem cena virar `MediaStyle` seria
> preciso uma sessão com estado — e a partir do Android 13 os botões saem do
> `PlaybackState`, não das `Notification.Action`. Com `STATE_NONE` (o único
> honesto sem mídia) o sistema não desenha botão nenhum e o "Desligar
> transmissão" sumiria justamente nas versões novas; com um estado PAUSADO ele
> apareceria, mas o sistema promoveria a sessão ao painel de mídia das
> configurações rápidas — um player fantasma, com transporte morto, para
> controlar coisa nenhuma. Duas caras num cartão só é o melhor que a plataforma
> permite sem inventar um desses dois defeitos, e está escrito no KDoc do
> `SessionService` para a próxima leitura não tentar de novo.
>
> **2. "Conseguimos mudar os botões conforme o estado?"** — sim, e é o outro
> lado do lote (`SHELL_VERSION` **42**). O `nowPlaying` ganhou `actions`: a
> lista, na ordem, escolhida pelo `controle.js`. As três perguntas que a
> `acoesDaNotificacao` faz:
>
> - **play/pause** só existe com mídia que tenha TEMPO (a mesma régua da barra
>   de progresso). Imagem, versículo, mensagem e cronômetro não têm o que pausar.
> - **⏮/⏭** existem quando há EIXO: uma cena com slides ou uma mídia atual (é o
>   que faz o par trocar de item na lista).
> - **cortina e parar** existem sempre.
>
> Com o cronômetro de abertura sozinho no ar, o cartão passa a ter DOIS botões
> grandes — cobrir e parar — em vez de cinco, três deles mortos ocupando o modo
> compacto (que só mostra três).
>
> **A lista vem de fora pela invariante 5**, e não é formalidade: quem sabe se
> "próxima estrofe" faz sentido agora é o lado web, e uma cópia dessa regra em
> Kotlin envelheceria à parte da de lá. O conjunto entra também na CHAVE de
> deduplicação do `pushNowPlaying` — sem isso, uma cena que muda só de eixo (o
> cronômetro entrando por cima de uma imagem) seria deduplicada e o cartão
> ficaria com os botões da cena anterior. **Um botão que sobrou é pior que um
> que faltou: ele responde.**
>
> O conjunto é declarado nos DOIS lugares que o Android lê — o `PlaybackState`
> (que desenha do 13 em diante) e as `Notification.Action` (abaixo dele) —,
> porque declarar de um lado só é fazer o botão existir em metade dos aparelhos:
> é o defeito da v1.17 com outro nome. E o `tools/ponte.test.mjs` afirma que o
> campo VIAJA, que é o modo de falhar deste objeto remontado campo a campo (o
> `slideLabel` passou cinco versões sem chegar ao Kotlin).

> **A v5.230: O EPISÓDIO DE SÉRIE VIRA UM VÍDEO DO YOUTUBE, e a DATA passa a
> ter DUAS formas. OTA PURO** (nenhuma linha de Kotlin; sem Release).
>
> Dois pedidos do operador, e os dois derrubam uma suposição da v5.228.
>
> **1. "O tratamento dos itens deve ser o mesmo dos vídeos do YouTube (sem a
> opção de apenas áudio). Não quero um download direto, e quero a opção de tocar
> diretamente em stream pelo link."**
>
> A v5.228 tratou a série como uma coleção do LouvorJA porque **é dali que a
> casca do card veio** — e naquele mundo o toque BAIXA, o que está certo para
> uma faixa de hinário: poucos MB, e o acervo existe justamente para ficar
> offline. Herdar a casca herdou a premissa junto, e aqui ela é falsa por duas
> ordens de grandeza: são ~300 MB por episódio, ~15 GB no ano, e o vídeo do
> sábado é visto **uma vez**. O "Baixar" do card oferecia isso atrás de uma
> palavra de três sílabas.
>
> **O caminho certo já existia inteiro, e era o do YouTube.** `openSongMenu`
> desvia para `openYtMenu` antes de montar qualquer coisa, e com um desvio de
> uma linha o episódio ganha a **transmissão direta** no "Tocar agora"
> (`ytStream` → `shared/mse.js`, sem esperar byte nenhum), o download só nos
> destinos que GUARDAM, o cancelamento, o resgate de intenção e o teto de
> resolução. Nada disso foi reimplementado — o item foi levado até onde a
> resposta mora. No **Modo Fácil** o mesmo, e ali vale ainda mais: aquele modo
> existe para não perguntar nada, e a alternativa era o operador esperar 300 MB
> com o culto rodando.
>
> A única coisa a MENOS é o seletor Vídeo × Só áudio (`semSoAudio`): um
> testemunho em vídeo não tem versão de áudio que faça sentido projetar, e uma
> escolha que não muda nada é pior que escolha nenhuma.
>
> **E o card acompanhou, senão a promessa contradiria a folha:** o botão de
> baixar da barra some assim que há índice (sem índice ele fica, porque ali ele
> não baixa nada — busca a lista), o item de opções virou **"Atualizar a
> lista"** (`syncCollection` com `soIndice`, que volta logo depois do índice) e
> a série saiu de "Baixar toda a biblioteca", com peso e tudo. Um contador que
> promete o que o botão não faz é a pior das duas metades.
>
> **2. "Ele reconheceu o vídeo, mas o nomeou apenas como 'não há órfãos de
> deus', sem identificar a data e nem sequer colocar um identificador no padrão
> dos outros, deixando o vídeo fora de ordem."**
>
> A sexta armadilha da nomenclatura, e ela é a mais direta de todas: **o mesmo
> canal usa DUAS formas de data, no MESMO episódio.** Em 3 de janeiro de 2026 a
> versão em Libras saiu como "… 2026 (03/Jan) - Libras" e a de português como
> "… 2026 **sábado 3 janeiro**". `dataDoVideo` tenta a compacta e, falhando ela,
> a extensa — com o "de" opcional, o ordinal ("1º") consumido, e a guarda que
> exige que o nome **seja** um mês em vez de só começar como um, sem a qual
> "3 marcos" viraria 3 de março.
>
> **O que salvou o episódio foi a regra de ouro deste arquivo**: quem prova
> pertencimento é a PLAYLIST, o título é só rótulo. Por isso o vídeo estava lá —
> feio e fora de ordem, que é o erro recuperável — em vez de ausente, que é o
> erro que o operador só descobre no sábado.
>
> Os dois oráculos foram verificados nos dois sentidos: o `serie.test.mjs`
> reprova em **7 pontos** com o `dataDoVideo` anterior, e o `boot-nativo`
> reprova a folha do YouTube e o card sem botão de baixar com o `controle.js`
> anterior.
>
> A régua que fica: **herdar a casca de um recurso herda as premissas dele.** O
> card veio do LouvorJA e trouxe junto "o toque baixa", que nunca foi uma
> decisão sobre séries — era o padrão de um acervo cujos itens custam poucos MB.

> **A v5.229: O CARD DA SÉRIE ERA CONSTRUÍDO E NUNCA DESENHADO. OTA PURO**
> (nenhuma linha de Kotlin; sem Release).
>
> Relato do operador, no dia seguinte à v5.228: *"não estou achando nada para
> acessar esse provai e vede. e sim ele deve ficar no topo junto dos
> hinários."*
>
> **Ele estava certo, e o card não existia na tela.** A v5.228 acrescentou a
> série ao `allCollections()` — e `allCollections()` alimenta as CONTAS (peso,
> "toda a biblioteca", busca), não o desenho. A lista da Biblioteca é montada em
> TRÊS grupos: as fixas (`FIXED_COLLECTIONS`), as categorias de álbuns e os
> álbuns órfãos do catálogo. Uma coleção que não é `FIXED_COLLECTIONS` nem álbum
> **não cai em nenhum deles**. O card era construído, entrava no `byId`, contava
> no peso do acervo — e não aparecia em lugar nenhum.
>
> **É a lição da v5.220 outra vez, num lugar novo:** *acrescentar ao lugar em
> que o dado NASCE não o entrega a quem o MOSTRA.* E o que a torna cara aqui é
> que **as doze asserções da v5.228 passavam com o defeito no lugar**: elas
> mediam o ÍNDICE (playlists filtradas, ordem, Libras fora, URLs), e o que
> faltava era o DESENHO. O oráculo novo pergunta ao DOM, não a uma função, e
> reprova nos três pontos quando o grupo do topo volta a ser a lista literal.
>
> A correção não é acrescentar um quarto grupo: é o grupo do topo passar a ser
> **"as coleções FIXAS"**, que é o que ele sempre quis dizer, em vez de uma
> lista digitada à mão. Com série, o cabeçalho vira "Hinários e séries"; sem
> ela — num shell < 41 —, continua "Hinários", e nada muda. **(O cabeçalho único
> durou até a v5.260, que separou os dois: "Hinários" e "Arquivos oficiais". O
> que continua valendo desta nota é a armadilha — uma coleção fixa que não caia
> em nenhum grupo desenhado some da tela sem erro nenhum.)**
>
> **E o defeito escondia um segundo, que só apareceria depois:** o peso da
> série era calculado pela escada de bitrate de ÁUDIO. A constante é o
> 128 kbps do LouvorJA e a média global é dominada por hinário, então uma série
> ainda vazia — que é exatamente quando o número importa — seria anunciada a
> ~16 KB/s para um 1080p que entrega ~600. A tela prometeria **~50 MB para um
> ano que pesa ~15 GB**: um erro de 40× na única pergunta que essa conta existe
> para responder ("espero o Wi-Fi?"). Agora há `BPS_VIDEO_PADRAO`, e as duas
> médias não se misturam nos dois sentidos — um ano de série baixado não infla
> a estimativa de todo álbum de louvor, e a média de áudio não desinfla a da
> série.

> **A v5.228 (v1.98): AS SÉRIES DO YOUTUBE VIRAM ÁLBUNS DA BIBLIOTECA — e o
> primeiro é o "Provai e Vede 2026". EXIGE APK** (`SHELL_VERSION` **41**).
>
> Pedido do operador: sincronizar os vídeos oficiais do Provai e Vede 2026, em
> português, como um álbum da Biblioteca. A seção "Séries do YouTube" tem o
> desenho inteiro; aqui ficam as três coisas que a investigação decidiu.
>
> **O LouvorJA não tinha, e não é falta de catálogo — é estrutural.** Pelo
> contrato em `docs/FONTE-DE-DADOS-LOUVORJA.md`, o banco tem cinco famílias de
> arquivo e **todo campo de mídia é áudio ou imagem** (`url_music`,
> `url_instrumental_music`, `url_image`): não existe campo de vídeo em lugar
> nenhum. Mesmo que aparecesse um álbum com esse nome, não haveria bytes para
> buscar. O portal oficial da DSA (`downloads.adventistas.org`) publica os MP4
> por trimestre e foi a alternativa considerada; o operador escolheu o YouTube
> — com o argumento certo, de que "playlist vira álbum" é um recurso, e o Provai
> e Vede é só a primeira instância dele.
>
> **A descoberta é automática, e ela é pela ABA DO CANAL.** A única constante é
> `@provaievedeoficial`; meses e anos saem dos nomes das playlists. A alternativa
> — busca por texto — foi recusada por AUTORIDADE, não por dificuldade: ali quem
> escolhe o resultado é o ranking do YouTube, e qualquer pessoa pode nomear uma
> playlist "Provai e Vede 2026". Num sistema de projeção de culto isso é um
> reupload entrando no telão sem nada que o denuncie.
>
> **As cinco armadilhas da nomenclatura foram MEDIDAS nos prints do canal**, não
> imaginadas, e duas delas quebrariam a regra óbvia em silêncio: uma playlist
> **sem o hífen** que todas as outras têm (um `^Provai e Vede - ` apagaria o mês
> inteiro) e o marcador de Libras em **duas formas diferentes** — `(Libras)` na
> playlist e `- Libras` no vídeo. Estão as cinco no topo do `serie.js` e as cinco
> viraram caso de teste, com as strings verbatim.
>
> **A regra mora no lado WEB, e isso é a invariante 5 com uma razão medida.** O
> Kotlin ganhou dois métodos de TRANSPORTE (`ytCanalPlaylists`, `ytPlaylist`) que
> devolvem o que o canal publica, verbatim — inclusive o título CRU, sem o
> `tituloLimpo` da busca, porque é dele que saem a data e a marca de Libras.
> A nomenclatura de um canal muda sem avisar; do lado web um ajuste chega por
> OTA em minutos, com oráculo em Node, e em Kotlin custaria um degrau de shell e
> uma Release por vírgula.
>
> **Uma armadilha que quase passou:** o `pesquisar` força português no extrator
> porque no padrão en-GB o YouTube devolve o título TRADUZIDO. Sem o mesmo
> `aportuguesar` aqui, `(15/Ago)` viraria `(15/Aug)` e "Libras" mudaria de
> palavra — a regra inteira falharia calada. Pelo mesmo motivo a paginação sai
> do MESMO extrator (`ex.getPage`) e não do `getMoreItems(service, …)`, que monta
> um extrator novo por dentro: os meses do fim da lista voltariam em inglês
> enquanto os do começo vêm em português.
>
> **E uma medida que evita doze extrações por retomada:** a aba do canal já diz
> quantos vídeos cada playlist tem, então a assinatura `url:contagem` é guardada
> e, batendo, as ~12 chamadas de `ytPlaylist` são puladas. A extração é a peça
> frágil deste caminho — a que não convém exercitar à toa.
>
> **O que NÃO foi verificado, e está dito:** o Kotlin não foi compilado (o
> ambiente desta sessão não resolve o plugin do Android nem baixa dependências).
> Quem compila é o CI, que falha alto. A regra — a parte que decide o que vai ao
> telão — não depende disso: são 42 casos em Node puro, verificados nos dois
> sentidos, mais o percurso completo no `boot-nativo.test.mjs`.

> **A v5.227: O "DESLIGANDO…" VIRA O RÓTULO DO PRÓPRIO BOTÃO. OTA PURO**
> (nenhuma linha de Kotlin; sem Release).
>
> Pedido do operador: que a informação rápida de "desligando…" não fique
> minúscula abaixo do botão, e sim como texto dele.
>
> Ela saía no `#castMsg` — 0,78 rem, o MENOR texto da folha, logo abaixo do
> botão que o dedo acabara de tocar, e no exato instante em que a folha inteira
> está se reorganizando (v5.226). O olho estava no botão; a resposta aparecia
> noutro lugar, no tamanho de uma nota de rodapé.
>
> Agora o rótulo é uma função de `(mirrorOcupado, ligado)`, pela MESMA leitura
> de estado que já pintava a cor: ocupado com o servidor no ar → "Desligando…";
> ocupado sem ele → "Ligando…"; livre → o rótulo de sempre. Não há um terceiro
> lugar guardando "o que eu pedi" — que é justamente o que divergiria numa
> resposta lenta do shell.
>
> Duas peças pequenas completam: `ligarEspelho`/`desligarEspelho` chamam
> `renderCast()` no instante em que marcam `mirrorOcupado` (a enquete da folha é
> de 2,5 s, e uma resposta que chega até 2,5 s depois do toque não é resposta),
> e a opacidade do botão desabilitado subiu de .55 para .7 — **um recado a 55%
> de opacidade é o defeito deste lote com outro nome**. Continua claramente
> inerte; passou a ser legível.
>
> A linha de baixo ficou com o que ela sempre soube dizer melhor: a FALHA
> ("só liga em Wi-Fi", "sem encoder livre agora"), que é uma frase inteira vinda
> do shell e não caberia num botão.

> **A v5.226: LIGAR A TRANSMISSÃO DEIXA DE SER UM SALTO — a folha cresce, e só
> então o conteúdo entra. OTA PURO** (nenhuma linha de Kotlin; sem Release).
>
> Relato do operador: *"tanto para ligar quanto para desligar a transmissão, há
> adição ou subtração de conteúdo nesse popup, isso move os elementos
> irregularmente… os elementos surgem do nada e as coisas mudam de lugar,
> atrapalhando o foco e identificação dos elementos"*.
>
> Ele está descrevendo um `hidden`. O endereço e a lista de telas apareciam e
> sumiam num quadro, e com eles a altura da folha inteira — o que estava sob o
> polegar mudava de lugar sem aviso.
>
> **A encenação é assimétrica de propósito, e é ela que responde ao pedido:**
> abrindo, a linha cresce JÁ e o conteúdo entra 0,2 s depois (o espaço nasce
> antes do que vai ocupá-lo); fechando, o conteúdo sai JÁ e a folha se recolhe
> 0,14 s atrás dele (nada desaparece por baixo de uma borda em movimento).
> Medido, quadro a quadro: abrindo, o bloco vai de 24 a 101 px enquanto a
> opacidade do conteúdo é ZERO, e só aos ~250 ms — com o espaço já pronto — ele
> aparece (0,46 → 1). Fechando, o espelho exato: opacidade a 0 nos primeiros
> 155 ms com o bloco ainda em 109 px, e o recolhimento depois.
>
> A altura é animada por `grid-template-rows: 0fr → 1fr`, que é a única forma de
> transicionar até `auto` **sem medir nada em JS** — daí a casca de dentro
> (`.cast-live-in`), que precisa de `min-height: 0` e `overflow: hidden` para
> aceitar encolher. `visibility` fecha o que a opacidade não fecha: recolhido, o
> bloco ainda teria os botões "Desconectar" no caminho do foco.
>
> **E a LISTA passou a ser um diff por rótulo** — sem isso nada disso valeria. Ela
> era refeita por inteiro (`innerHTML = ''`) a cada leitura do estado, e o estado
> é lido de 2,5 em 2,5 segundos com a folha aberta: qualquer animação de entrada
> recomeçaria sozinha para sempre, e o botão "Desconectar" era recriado debaixo
> do dedo de quem o estava tocando, perdendo o `disabled` que o toque acabara de
> escrever. Agora uma tela nova entra com a animação, uma que saiu se recolhe
> antes de deixar o documento, e as demais só têm o texto atualizado no lugar.
>
> Os oráculos se dividem pela natureza: o `smoke.mjs` mede a FORMA (o bloco vale
> zero recolhido, tem altura aberto, e o que muda entre os dois é uma
> propriedade ANIMÁVEL — um `display: none` de volta continuaria dando zero e
> mataria a transição, então a asserção pergunta pela propriedade também), e o
> `boot-nativo.test.mjs` mede o COMPORTAMENTO da lista, que só existe com a
> ponte presente.
>
> **A primeira versão do caso do `smoke` reprovou**, e a leitura certa não era
> "o teste está errado": ele media a altura no MESMO turno em que ligava a
> classe, e a altura é animada — o quadro inicial é zero por definição. A espera
> que ele ganhou é, ela própria, a afirmação de que a animação existe.

> **A v5.225: A LEITURA DA LETRA TINHA A HIERARQUIA INVERTIDA — duas estrofes
> mais juntas que o miolo de uma. OTA PURO** (nenhuma linha de Kotlin; sem
> Release).
>
> Pergunta do operador, com um print do LouvorJA: dá para aplicar aquele modelo
> de estrofes na nossa leitura de letras, nos dois modos, "já que há músicas com
> 5 linhas, 6 linhas e diversos outros formatos"?
>
> **A resposta é que o modelo já estava aplicado, e a contagem de linhas nunca
> foi o problema.** O banco do LouvorJA não entrega linhas soltas: cada entrada
> de `music_{id}.lyric` **é uma estrofe**, com `order`, o texto (linhas internas
> como `<br>`) e `aux_lyric`, que é o RÓTULO da seção. Guardamos assim desde a
> v5.42 (`[{a, l}]`), e os DOIS modos desenham pela mesma função (`lvBuildSong`)
> — inclusive tratando um caso que a origem tem e o app dela não separa: dois
> blocos de estrofe empacotados numa entrada só (v5.142). Quatro, cinco ou doze
> linhas são só o número de `\n` dentro de uma estrofe; não há formato a
> adivinhar.
>
> **O que estava errado era o ESPAÇAMENTO, e ele foi medido:** 8,8 px (avançado)
> e 8,0 px (simples) entre estrofes DIFERENTES, contra 11,4 px entre dois blocos
> da MESMA. Duas estrofes ficavam mais juntas que o miolo de uma — a hierarquia
> se lia ao contrário, e por isso a letra não respirava apesar de a estrutura
> por baixo estar inteira. É o tipo de defeito que nenhuma leitura de código
> acha, porque cada regra isolada parece razoável.
>
> Agora existe `--lv-estrofe-gap` (medida de LAYOUT, logo no `:root` de
> `controle.css`, não em `tokens.css`), e o valor não é gosto: **uma linha da
> letra** (1.425rem = .95rem × 1.5), que é literalmente o que a fonte codifica
> com `<br><br>` e o que o operador vê no app de origem. Ele vale nos TRÊS
> lugares em que uma estrofe termina — o `gap` da folha de leitura, o `gap` da
> zona de letra do Modo Fácil e o `margin-top` entre blocos dentro de um slide —
> porque **uma fronteira de estrofe é uma fronteira de estrofe**: tem de parecer
> igual nos três, senão a leitura ganha um ritmo que o texto não tem.
>
> **O oráculo afirma a REGRA, não o pixel** (`tools/smoke.mjs`): entre estrofes
> nunca menos que dentro de uma, nunca menos que uma linha, e o mesmo valor nos
> dois modos. Escrever o número faria o teste reprovar numa mudança legítima de
> fonte; escrever a razão o mantém verdadeiro. Reprova em 5 pontos no CSS
> anterior (verificado).
>
> A régua que fica: **estrutura correta não é leitura correta.** Os dados
> estavam certos desde a v5.42 e a função desenhava certo desde então — o que
> desmentia os dois era um par de medidas que ninguém tinha comparado uma com a
> outra.

> **A v5.224: A TRANSMISSÃO VIRA O BOTÃO IRMÃO DO DE ESPELHAR — o interruptor
> sai. OTA PURO** (nenhuma linha de Kotlin; sem Release).
>
> Pedido do operador: que a segunda forma de conectar tenha o mesmo desenho da
> primeira, e que ligada ela fique **vermelha, nomeando o desligamento** — a
> mesma função de liga-desliga, sem trilho de chave.
>
> **As duas escolhas da folha respondem à MESMA pergunta** ("para onde vai o
> telão?"), e respondê-la metade com um botão preenchido e metade com um
> interruptor fazia a segunda parecer uma preferência de configuração em vez de
> uma porta. Agora são dois `.cast-acao` — mesma anatomia, mesmo alvo de toque,
> mesmo lugar do ícone —, e o botão novo ganhou símbolo próprio (`icoNavegador`:
> a janela de navegador com as ondas dentro; a moldura é literalmente a palavra
> do rótulo, e o irmão já tinha a tela com a seta).
>
> **O que o interruptor dava de graça — dizer o estado parado — o botão diz pela
> COR e pelo RÓTULO**, que é a gramática que o irmão já usava: desligado ele é a
> chamada preenchida ("Transmitir para navegador"); ligado, perde o
> preenchimento, ganha o contorno e passa a nomear a ação ("Desligar
> transmissão"). Verde é "resolvido, e o app não mexe nisso" (a TV, que só o
> seletor do Android desconecta); vermelho é "está ligado, e o toque desliga".
>
> **O vermelho é CONTORNADO, e isso não é timidez:** pela regra da paleta o
> vermelho CHEIO deste app significa "está no ar agora" e pertence à mídia
> projetada. Um botão de folha preenchido em `--live` competiria com o que a
> congregação está vendo.
>
> A mecânica mudou num ponto só, e ele merece nota: um `change` de caixa de
> marcação chega com a posição NOVA, um clique não chega com nada. O que o
> operador pediu passou a ser DERIVADO do estado (`!espelhoLigado()`) — a mesma
> fonte que o `renderCast` usa para pintar o botão —, então não há duas versões
> da verdade para divergirem no meio de uma resposta lenta do shell. O resto da
> disciplina é intacto: **quem escreve o estado é sempre a LEITURA**, nunca o
> toque, senão uma recusa deixaria o botão vermelho de uma coisa que não
> aconteceu.
>
> Dois oráculos, e eles se dividem pela natureza: o `smoke.mjs` mede a FORMA
> (desligados os dois são a mesma peça — mesmo raio, mesmo preenchimento; ligada
> a transmissão perde o fundo e ganha o contorno em `--danger-strong`), e o
> `boot-nativo.test.mjs` mede o ESTADO, que é o único lugar onde ele pode ser
> medido de verdade: lá a ponte responde `ligado: true` e quem pinta o botão é o
> `renderCast`, não uma classe posta à mão pelo teste. Ele afirma também que
> **não sobrou interruptor nenhum** na folha.

> **A v5.223: O `display-ready` DA TELA NUNCA LEVOU `__tela` — e sem ele as TRÊS
> preferências jamais chegaram. OTA PURO** (nenhuma linha de Kotlin; sem
> Release).
>
> Relato: numa tela recém-ativada os slides ficam pretos **mesmo com a opção de
> imagens ligada**, e agora "nem depois da música tocar completa" — isto é, não
> era espera. A v5.221 tinha atacado o sintoma pelo lado errado.
>
> **A causa é um campo que nunca foi escrito.** O Controle decide reenviar
> wallpaper, fundo da letra e preenchimento a quem conecta perguntando
> `if (msg.__tela)` no `display-ready` — é a única coisa que distingue uma TELA
> DA REDE do telão de verdade, que lê tudo do IndexedDB sozinho. O `tela.js`
> anexa `__tela` ao `tela-status`… e **nunca anexou ao `display-ready`**. Medido
> no fio: `{"type":"display-ready","__de":"dsf1cu9p7","__mid":"70y95c:1"}`.
>
> Ou seja: `telaReenviarPreferencias` — a função que a **v5.188 criou para
> exatamente isto** — nunca rodou para uma tela de verdade, em nenhuma versão.
> Não havia erro em lugar nenhum; havia três preferências que simplesmente não
> existiam do outro lado. O fundo da letra foi o que apareceu porque preto é
> visível; o **wallpaper** e o **preenchimento** estavam quebrados do mesmo
> jeito, calados, porque o padrão deles é aceitável e ninguém reparou.
>
> **E o conserto teve duas tentativas, o que é a outra metade da lição.** A
> primeira carimbou o `__tela` no dreno — e não mudou nada, porque há DOIS
> pontos que anunciam a tela e o que de fato entrega é o outro: o
> `display-ready` do `display.js` nasce na carga da página, quando ainda não há
> token, e o `subir` devolve cedo; quem anuncia é o `aoConectar`, no reanúncio.
> **Uma correção aplicada no ponto que não é exercitado é uma correção que nunca
> roda** — e ela teria passado num teste que olhasse só o dreno. O carimbo
> passou a ter dono único (`anuncio()`), usado pelos dois pontos.
>
> **Os dois lados do contrato ficaram travados, e isso é deliberado.** O
> `tela-rede.test.mjs` afirma que o `display-ready` no fio LEVA `__tela` (o
> produtor — reprova no código anterior, verificado); o `boot-nativo.test.mjs`
> afirma que o Controle reenvia ao receber o campo **e que não reenvia sem ele**
> (o consumidor — passa nas duas versões, porque o consumidor sempre esteve
> certo). Travar um lado só deixaria o par livre para divergir de novo, que é
> precisamente o que aconteceu por dezenas de versões: **o consumidor exigia um
> campo que o produtor não mandava, e a documentação descrevia o combinado em
> vez do código** — o CLAUDE.md dizia, com todas as letras, "`display-ready`
> passa, com `__tela`".
>
> A régua: **quando dois lados combinam um campo, o oráculo tem de olhar o FIO.**
> Ler cada lado separadamente aprova os dois — foi o que fiz aqui na primeira
> passada, com um probe que mandava o `__tela` à mão e concluía que o Controle
> estava certo. Estava; a mensagem é que nunca teve o campo.

> **A v5.222: O NÚMERO DO HINO ERA AZUL — 9,75:1 e ainda assim discreto. OTA
> PURO** (nenhuma linha de Kotlin; sem Release).
>
> Relato do operador, sobre a capa que a v5.219 desenhou: *"o número do hino
> está aparecendo em azul no slide, esse azul fica muito discreto no fundo
> escuro"*.
>
> **Ele está certo, e a medida não o contradiz — ela responde outra pergunta.**
> `--stage-accent` sobre o preto dá 9,75:1, contraste de sobra em qualquer
> régua; o oráculo da v5.219 mediu isso e aprovou. Só que **contraste é razão de
> luminância, não legibilidade a dez metros**: num telão o que decide é o
> conjunto **cor + corpo**, e aquele número tinha o MENOR corpo do cartão
> (4,4cqmin contra os 8,4 do título) somado à única cor da tela que não era
> branca. Num hinário o número é o que a congregação procura primeiro — ele não
> é enfeite, e estava desenhado como se fosse.
>
> Agora ele é o MESMO branco do título (21:1) e maior (5,8cqmin). A cor de
> identidade ficou nos FIOS que o flanqueiam, que é onde ela não precisa ser
> lida: eles são decoração, e por isso o `background` deles passou a ser
> explícito em vez de `currentColor` — sem essa troca, embranquecer o número
> teria embranquecido os fios junto, calados.
>
> **O oráculo subiu de piso junto** (`display-smoke.mjs`): ele exigia 7:1 do
> número, que é exatamente o que o azul entregava. Agora exige 15:1 **e** que a
> cor seja a mesma do título — uma cor de identidade que volte para cá reprova.
>
> A régua que fica: **um piso de contraste aprova o que ele mede, e ele não mede
> corpo.** Onde o consumidor é um projetor visto do fundo do salão, a asserção
> tem de amarrar as duas coisas.

> **A v5.221: A IMAGEM DE FUNDO DA LETRA DESISTIA ANTES DE PODER CHEGAR. OTA
> PURO** (nenhuma linha de Kotlin; sem Release).
>
> **CORREÇÃO DE ATRIBUIÇÃO, escrita pela v5.223:** o defeito descrito abaixo é
> REAL e a correção fica — mas ele **não era a causa** do relato do operador,
> e esta nota afirmou que era. A causa estava uma etapa antes: o `lyricsbg`
> nunca chegava à tela, porque o `display-ready` dela não levava `__tela`
> (v5.222). Com o modo em `black`, `applyLyricsImage` computa `key = null` e
> **não chega a buscar imagem nenhuma** — a ladeira curta descrita aqui nunca
> chegou a rodar. Por isso a v5.221 não mudou nada no aparelho, e por isso
> ela passa a valer só agora, quando a preferência de fato chega.
>
> Relato: numa tela recém-ativada, tocar uma música da biblioteca deixa os
> slides em PRETO, **mesmo com a opção de imagens ligada** — e desligar e religar
> a opção nas Configurações conserta.
>
> **A preferência não era o problema**, e essa era a pista falsa embutida no
> sintoma: `telaReenviarPreferencias` manda o `lyricsbg` no `display-ready` da
> tela e ele chega certo. O problema são os BYTES.
>
> As imagens de fundo são enfileiradas **DEPOIS da mídia principal**
> (`telaEmpurrarImagensLetra`, logo após `telaGarantirEnvio`), no MESMO canal
> serializado — de propósito, e a decisão continua certa: o som não pode esperar
> as fotos. Só que a tela buscava a imagem com uma ladeira de **0, 600 e
> 1800 ms**, desistindo em ~2,4 s. Por construção, os bytes só podem começar a
> chegar depois de a música inteira atravessar o canal — segundos para um hino.
> **A tela desistia antes de existir qualquer possibilidade de sucesso**, e o
> slide ficava preto PARA SEMPRE, porque nada reexamina uma estrofe já
> renderizada. Religar a opção troca a chave efetiva e refaz o caminho com os
> bytes já no lugar: era esse o conserto que o operador vinha fazendo a cada
> música.
>
> Medido, com os bytes chegando aos 4 s: aos 2 s sem `src` (esperado), **aos 6 s
> ainda sem `src`** — dois segundos depois de a imagem estar disponível —, e
> visível logo após o desliga/religa. Os três estados do relato, reproduzidos.
>
> A ladeira agora dobra até um platô de 2,5 s com teto de 45 s, e é
> auto-limitada pelo que já existia: **a guarda de sequência mata o laço no
> instante em que a estrofe muda**, que é o caso comum muito antes do teto.
> Repetir a mesma URL é seguro porque o servidor manda `Cache-Control: no-store`
> em TODA resposta (`EspelhoHttp.CABECALHOS_SEMPRE`), 404 inclusive — não há 404
> grudado em cache para envenenar a tentativa boa.
>
> **O oráculo mede o que faltava.** O `tela-rede` já afirmava que o `imageUrl`
> sobrevive ao `__rec`; ninguém nunca afirmou que a imagem **chega à tela**, e
> era exatamente nessa distância que o defeito vivia. Agora a rota `/m/` da
> imagem 404a por 3 s de propósito — mais que a janela antiga — e o teste exige
> que ela apareça assim mesmo. Reprova no código anterior (verificado).
>
> A régua que fica: **uma retentativa tem de durar mais que o processo que ela
> está esperando.** Aqui o processo era conhecido e estava escrito duas funções
> acima — a fila é serializada e a imagem vem depois da música —, e ainda assim
> o prazo foi escolhido como se a imagem pudesse chegar sozinha.

> **A v5.220: A LINHA DO ÁLBUM NÃO CHEGAVA À BIBLIOTECA QUE JÁ EXISTE — os
> dois pontos de escrita estavam certos e os dois erravam o alvo. OTA PURO**
> (nenhuma linha de Kotlin; sem Release).
>
> Relato do operador: tocando um hino do hinário, a capa não mostra "Hinário
> Adventista 2022" — nem o nome de coleção nenhuma.
>
> **O dado nunca chegaria sozinho.** A v5.219 escreve `hymnAlbum` em dois
> lugares: no download de uma música nova e na varredura da sincronização. Os
> dois são o lugar certo para uma biblioteca que está sendo MONTADA — e nenhum
> deles alcança a que já está pronta: a música do operador já está baixada, e
> uma coleção completa não é re-sincronizada (é justamente o que o "Completo
> offline" existe para dizer). O campo ficava vazio para sempre, e a capa caía
> no caso degenerado, que é o título centralizado.
>
> A correção é a passagem que faltava (`preencherAlbunsDosHinos`), no mesmo
> molde do `desnumerarAlbunsBaixados` que já morava ao lado: uma vez, marcada em
> estado, depois de `loadCollections()` — é de lá que sai o nome. **A ligação já
> existia e não estava sendo lida**: o `folder` de todo registro baixado de uma
> coleção É o id dela. Ela CORRIGE além de preencher (compara com o nome atual
> em vez de olhar só se está vazio), porque uma coleção renomeada na origem
> deixaria capas dizendo o nome velho pelo mesmo preço.
>
> O oráculo entrou no `acervo.test.mjs`, que é onde as contas da biblioteca já
> moram, e ele mede **o registro** — que é o que o Display vai ler —, não o
> retorno da função: a música já baixada ganha o nome, um nome velho é
> substituído, e um arquivo de pasta do aparelho (que não é coleção nenhuma)
> fica intocado.
>
> A régua que fica: **escrever um campo novo nos caminhos de ESCRITA não o
> entrega a quem já tem os dados** — um lote que acrescenta campo a registro
> precisa dizer, explicitamente, como ele chega ao acervo existente.

> **A v5.219: O TÍTULO DO LOUVOR ERA AZUL-ESCURO SOBRE O PRETO — o palco lia
> tokens de TEMA. E o slide de capa virou um CARTÃO. OTA PURO** (nenhuma linha
> de Kotlin; sem Release).
>
> Relato do operador: os títulos das músicas estão em azul e ficam ilegíveis no
> fundo escuro.
>
> **Medido: 2,73:1.** O slide de capa pintava o título com `--brand`, e
> `--brand` é um token de TEMA — `#8fb1f3` no escuro (9,75:1 sobre o preto, o
> que a TV mostrava) e o denim oficial `#2F557F` no CLARO. A preview do Controle
> roda no documento que TEM tema: com o tema claro ligado — que é o que o
> operador escolheu na v5.192 — ela desenhava o título em denim escuro sobre o
> preto do palco, abaixo até do piso de 3:1 de texto grande.
>
> **É a regra do palco cometida do lado de fora.** Este documento diz, desde a
> v5.192, que "o palco não tem tema"; e diz isso dos TOKENS. Os tokens estavam
> certos — as REGRAS é que apontavam para tokens de tema, em quatro pontos:
> `--brand` (título da capa, referência do versículo, número do sorteio
> rolando), `--live-strong` (o cronômetro estourado), `--bg` e `--accent-glow`
> (a pílula de entrada). Agora existem `--stage-accent`, `--stage-accent-glow`,
> `--stage-on-accent` e `--stage-alert` no bloco compartilhado, e **nada pintado
> no palco lê um token redeclarado em `[data-tema]`**.
>
> **O oráculo mudou de pergunta, e é por isso que ele não tinha visto.** O
> `smoke.mjs` comparava quatro NOMES de token entre os dois temas; o defeito
> passou por baixo porque os nomes estavam certos. Ele passou a comparar a COR
> COMPUTADA de cada camada do palco (capa, letra, versículo, cronômetro
> estourado, sorteio rolando, fundo) nos dois temas. Verificado nos dois
> sentidos: com a regra antiga de volta, ele reprova.
>
> **E o cartão de capa** (o segundo pedido). Era uma linha só — "147. Ó ADORAI O
> SENHOR" —, o número colado na frente do título, gastando a largura da linha
> que mais precisa dela. Agora são três peças com pesos diferentes: o número no
> acento entre dois fios, o TÍTULO em branco pleno (21:1 — num telão a
> legibilidade vem de luminância máxima, e o acento fica no que é secundário) e
> o ÁLBUM esmaecido embaixo. Cada peça só existe se houver o dado; sem número e
> sem álbum, a capa é o título centralizado, que é a capa de sempre.
>
> **Não há AUTOR na fonte, e isso está dito em vez de inventado**: o LouvorJA
> publica nome, faixa e álbuns (`docs/FONTE-DE-DADOS-LOUVORJA.md` §5.1). O que
> entrou é `hymnAlbum` — a coleção de onde a música veio —, no REGISTRO, porque
> quem projeta é o Display e ele não tem acesso a coleção nenhuma; e com
> preenchimento na varredura que a sincronização já faz, senão a linha só
> apareceria em música baixada depois desta versão, isto é, nunca na biblioteca
> que o operador já tem.
>
> **A caixa da capa CRESCE com o conteúdo, e foi um defeito fotografado que
> obrigou a isso**: com o título em duas linhas, número + título + álbum somavam
> mais que a caixa de altura fixa, o flex encolhia os itens e o álbum era
> desenhado POR CIMA da segunda linha do título. Na capa não há "próximo slide"
> com que casar a altura — é a primeira coisa em cena —, então ela se ajusta,
> com teto e `overflow: hidden` como garantia final.
>
> **A primeira medição de contraste do repositório entrou junto**
> (`display-smoke.mjs`): este documento afirmava, desde a v5.47, que não havia
> nenhuma. Ela cabe no palco e só nele — ali o piso não é "tela a 30 cm", é um
> projetor visto do fundo do salão — e compõe o ALFA sobre o preto em vez de
> ignorá-lo, senão `--stage-text-dim` (branco a 72%) sairia como 21:1 quando
> rende 10,54:1.
>
> A régua que fica: **um oráculo que compara NOMES não protege o que a tela
> PINTA.**

> **A v5.218: A RECARGA VOLTA PARA A ENTRADA OFICIAL, e o botão de canto sai.
> OTA PURO** (nenhuma linha de Kotlin; sem Release).
>
> Decisão do operador depois da v5.216, e ela **revoga metade de uma regra da
> v5.189**: *"após qualquer descarregamento da página, pode usar o botão
> original de ativar tela, o mesmo que já se usa no primeiro acesso. Inclusive,
> remova esse botão específico que desaparece em 5 segundos. Faça apenas a
> lógica de aceitar o F11 como atalho, ou os dois cliques na tela."*
>
> **A regra da v5.189 estava certa para o caso dela e errada para este, e a
> distinção é entre perder o FIO e perder a PÁGINA.** Numa queda de conexão a
> mídia continua tocando — ela é local (`/m/`) e a letra anda pelo `timeupdate`
> do próprio `<video>` —, então desenhar a entrada por cima apagaria uma cena
> que o problema não tinha atingido; isso **não mudou**, e `cairToken`/
> `reentrarSozinho` seguem silenciosos. Uma recarga é outra coisa: ela já
> derrubou tudo, inclusive o gesto, porque ativação transitória não sobrevive a
> uma navegação. A tela volta muda e em janela de qualquer jeito. **Não havendo
> projeção a preservar, não há nada que a entrada esteja cobrindo** — e o que
> estava lá no lugar dela era um botão de canto com outro nome ("Ativar som e
> tela cheia"), outro desenho e cinco segundos de vida.
>
> **O que saiu:** `mostrarCanto`, `esconderCanto`, os três prazos, `oQueFalta`,
> `oferecerGesto`, `emTelaCheia` e o `assentando` da v5.214 — este último era
> apenas o guarda daquela pergunta, e some junto com ela. A regra que ele
> protegia continua escrita, agora como comentário no `telaCheia`: **não se lê
> `document.fullscreenElement` no mesmo turno em que se pede a tela cheia.**
>
> **O que ficou:** os dois gestos que já existem na cabeça de quem está ali — o
> TOQUE DUPLO (o que se tenta primeiro num vídeo) e o **F11** (o de quem opera
> num computador ligado ao projetor, que é o caso normal deste recurso). O
> `preventDefault` no F11 é deliberado: sem ele o navegador entra na tela cheia
> DELE ao mesmo tempo em que pedimos a da API, e sair passaria a exigir dois
> comandos. Um dono só para o estado.
>
> **O token é carregado adiante na recarga, e isso não é uma exceção à decisão:**
> o fio só abre quando alguém toca. O que ele evita é um defeito que a mudança
> criaria — `telasSse` é indexado pelo TOKEN (`EspelhoServidor`), então pedir
> pareamento novo a cada F5 deixaria a sessão anterior ocupando vaga até o vigia
> notá-la, e a **terceira recarga seguida receberia "lotado"**. Com o token
> reaproveitado o servidor reconhece a volta ("a mesma tela reabriu a página") e
> a vaga é a mesma. Há oráculo para as duas metades.
>
> **E um falso positivo do próprio teste virou lição.** A asserção "não
> reconecta sozinha" lia o contador GLOBAL de `GET /e` do servidor de mentira, e
> reprovou culpando a página recarregada por um pedido que era de outra (a
> principal, na escada de reentrada legítima do `adeus`). Um contador global não
> prova uma afirmação sobre UMA página: agora cada contexto manda um cabeçalho
> que o identifica, e a contagem é por página. **Medição que não é atribuível
> não é medição.**
>
> **E ele reprovou uma SEGUNDA vez, no CI, por uma corrida que a máquina local
> escondia** — com o arranjo de dois passos da v5.213 mostrando serviço:
> `11/12`, e o reprovado nomeado no resumo do run em vez de sumir atrás de um
> painel verde. A asserção do token esperava **o overlay sumir** para então
> recarregar, e `ativar()` esconde o overlay ANTES de o pareamento voltar (o
> gesto não espera a rede) — quem grava o token é a resposta do `POST /par`. Num
> runner mais lento a recarga chegava antes do `guardar()`, o token não existia,
> e o teste acusava o app de pedir vaga nova. Reproduzido de propósito com 400 ms
> de atraso no servidor de mentira e corrigido esperando o `GET /e`, que só
> acontece DEPOIS do `guardar()`. É a segunda vez que este arquivo aprende isto
> (a v5.204 foi a primeira): **espere o sinal que prova o que você precisa
> afirmar, não um que costuma vir junto.**

> **A v5.217: O BOTÃO DE CAST NÃO ABRIA NADA COM UMA TELA JÁ CONECTADA — o
> fecho automático da folha era um NÍVEL onde a frase dizia BORDA. OTA PURO**
> (nenhuma linha de Kotlin; sem Release).
>
> Relato do operador: com o ícone de cast no estado conectado (vermelho), tocar
> nele não abre a folha de conexão.
>
> **Ele abria — e se fechava sozinha em milissegundos.** A v5.193 acrescentou ao
> `renderSimpleGate` a regra "alguma tela ENTROU com a folha aberta: ela fecha",
> e escreveu `if (há tela && a folha está aberta) fecharCast()`. A frase fala de
> um EVENTO; o código testa um ESTADO. Com uma tela conectada — que é o estado
> normal de um culto — qualquer passagem por aquela função fechava a folha, e o
> `abrirCast` **liga a enquete de 2,5 s**, que chama justamente aquela função.
> Isto é: o próprio ato de abrir agendava o fecho, e a primeira leitura do
> estado (milissegundos depois, pela ponte) o executava.
>
> O que se perdia com isso não era um detalhe de UI: aquela folha é a única
> porta para trocar de TV, ligar e desligar a transmissão e derrubar uma tela da
> rede. Com tela conectada, nenhuma dessas coisas tinha como ser feita sem antes
> desconectar tudo.
>
> A correção é a borda que a frase sempre descreveu (`gateTinhaTela`), **com a
> memória re-armada em `abrirCast`** — e é esse re-armar que dá à regra o
> significado certo: *enquanto ESTA folha estiver aberta, se uma tela entrar,
> ela fecha*. Sem ele, uma folha aberta muito depois herdaria uma borda de horas
> atrás, que é a mesma classe de defeito com outro relógio.
>
> **Os dois lados entraram no `boot-nativo.test.mjs` no mesmo commit**, e o
> segundo é o que impede a correção de virar "a folha nunca mais fecha sozinha":
> com tela conectada ela ABRE e CONTINUA aberta depois de um ciclo inteiro da
> enquete; com a folha aberta e uma tela entrando, ela fecha. A primeira metade
> é lida no MESMO turno do clique — entre dois `evaluate` cabe o `setTimeout(0)`
> com que a ponte de mentira resolve o `espelhoEstado`, e a asserção passaria a
> depender de quem ganha essa corrida.
>
> A régua que fica: **"entrou" e "existe" não são a mesma condição, e um
> comentário que diz a primeira sobre um código que testa a segunda envelhece
> parecendo correto** — foi assim que este atravessou vinte e três versões.

> **A v5.216: O "LIGAR SISTEMA" VOLTAVA NA RECARGA — e ele gasta o gesto sem
> ativar nada. OTA PURO** (nenhuma linha de Kotlin; sem Release).
>
> Segunda metade do relato da v5.214, e desta vez com o passo que faltava:
> *"o erro acontece quando o display é recarregado, mostrando um botão antigo de
> ativar tela. A tela se conecta, mas o som e nem o fullscreen é ativado."*
>
> **O botão antigo tem nome: é o `#startBtn`, o "Ligar Sistema"** — o overlay da
> era dos dois PWAs, que existe para destravar o autoplay num navegador comum.
> Ele era escondido no papel `tela` por uma linha dentro de `montarEntrada()`, e
> aí está o buraco: **`montarEntrada()` só roda na PRIMEIRA carga.** A recarga
> com sessão viva reconecta POR TRÁS, de propósito (v5.189: cobrir a projeção
> com um cartaz por causa de um F5 seria trocar um problema por outro) — e sai
> pelo `return` antes de qualquer overlay ser montado. Bastava um F5.
>
> Medido, depois de recarregar: `startVisivel: true`, e
> `elementFromPoint` no CENTRO da tela devolvendo `start-pill`. O botão certo
> ("Ativar som e tela cheia") estava lá, em cima na ordem de pilha — mas é
> discreto e de canto, enquanto este é `inset: 0` com a pílula no meio. O
> visitante toca no óbvio; e tocar nele dá, medido, `tela cheia = false` e
> `som pedido = false`: **ele não pareia, não solta o som e não pede tela cheia
> — só se esconde.** O único gesto disponível é gasto em nada, e a tela fica
> conectada, muda e em janela. Palavra por palavra, o relato.
>
> **A correção muda o DONO, não só a linha.** Quem esconde o botão passa a ser o
> `display.js` — o documento que o declara —, pelo PAPEL e em toda carga, ao
> lado da decisão gêmea que já existia ali (`window.__NATIVE__`). No papel
> `tela` ele não existe pela razão oposta à do app nativo: lá não há política de
> gesto para destravar; aqui há, mas o gesto é do OUTRO botão. Decidir isso de
> fora, no `tela.js`, é que abria a porta para um caminho de carga esquecer a
> decisão — e foi exatamente o que aconteceu.
>
> **O oráculo cobre o caminho que nenhum teste percorria: a RECARGA.** O
> `tela-rede.test.mjs` ativava a tela e seguia em frente; ninguém dava F5. As
> duas asserções novas reprovam no código anterior (verificado) e uma delas mede
> **o que o dedo encontra** — `elementFromPoint` no centro —, não a propriedade
> `hidden`: é o centro da tela que decide para onde vai o toque, e era ali que o
> botão errado estava.
>
> A régua que fica: **um elemento que só faz sentido em UM papel tem de ser
> desligado por quem o declara, no papel — nunca por um caminho de UI que pode
> não ser percorrido.**

> **A v5.215: SEM TELA CONECTADA, O SOM SAI DO PRÓPRIO APARELHO. OTA PURO**
> (nenhuma linha de Kotlin, `SHELL_VERSION` intacto em 40; sem Release).
>
> Pedido do operador: no modo avançado, tocar uma mídia sem nenhuma tela
> conectada tem de produzir som no celular. Ele fecha um buraco que a v5.189
> abriu e que este documento descrevia sem perceber — o argumento de lá ("a
> preview é uma ILUSTRAÇÃO, e ilustração não faz som") vale enquanto existe
> alguém ilustrando alguma coisa. **Sem display nenhum a projeção É a preview em
> tela cheia**, e ali ela não ilustra: ela É a projeção. O louvor simplesmente
> não tocava em lugar nenhum.
>
> **A diferença para a "mesa de som" é a única coisa que importa neste lote, e
> ela é estrutural: não é um modo, é uma CONSEQUÊNCIA.** Não há botão, não há
> preferência, não há nada guardado entre sessões — o estado é uma função da
> conexão (`somLocalDeveEstar`), aplicada num ponto só
> (`acertarSaidaDeAudio` → `preview.setForceMuted`), com os gatilhos onde a
> conexão muda: telas (`renderDisplayStatus`), transmissão (`lerEspelho`), modo
> do app (`setAppMode`) e a janela do Display no navegador. É isso que torna
> impossível o desfecho que matou a versão manual — o operador esquece a mesa
> ligada, conecta a TV, e o `<video>` do Controle rouba o foco de áudio do
> Android **interrompendo o player do telão na frente da congregação**. Com
> qualquer tela conectada este aparelho está mudo, sempre.
>
> **TELA é a pergunta larga** (`simpleDisplay`, a mesma do Modo Fácil): a TV
> **ou** uma tela da rede recebendo. Desde a v5.187 elas são a projeção quando
> não há TV e cada uma toca o próprio arquivo — contá-las é o que impede o
> celular de somar o mesmo louvor à sala fora de compasso, porque são dois
> decodificadores. `telaoConectado()` continua respondendo só pela TV, que é a
> pergunta certa para o atraso da preview e para o botão de espelhar.
>
> **Só no modo avançado**, como pedido — e a razão sobrevive à leitura: no Modo
> Fácil sem tela a cortina cobre tudo (v5.203), e som atrás de uma tela que diz
> "conecte uma tela" seria a única coisa acontecendo ali. A troca entre os dois
> mundos é automática nos dois sentidos e não corta o áudio: a rampa curta do
> `setForceMuted` desce até 0 antes de mutar, e uma TV que conecta no meio do
> louvor assume pelo reenvio de cena com posição e estado que a reconexão já faz.
>
> **A rede de segurança do navegador está dita em vez de suposta:** num
> navegador comum a política de autoplay rejeita o `play()` com som sem ativação
> do usuário, e o `stage` engole a rejeição — sem tratamento, o preço de ligar o
> som seria a preview PARAR DE TOCAR, que é trocar uma ilustração muda por
> nenhuma ilustração. O `onBlocked` a devolve ao mudo na hora e cada `load` novo
> ganha outra tentativa. No app isso não acontece
> (`mediaPlaybackRequiresUserGesture = false`).
>
> **O que NÃO voltou, e é deliberado:** o `AVNative.keepAudioAlive` (shell), que
> a versão manual usava para o WebView do Controle atravessar o segundo plano.
> Áudio audível já isenta a página do estrangulamento — é o que a nota do
> `snoopDisplayStatus` descreve pelo avesso ("ligar o áudio no próprio celular
> fazia o defeito sumir") — e o `SessionService` mantém o processo vivo enquanto
> houver cena. Repô-lo custaria um degrau de `SHELL_VERSION` e uma Release por
> um problema que ainda não foi observado; o endereço da resposta ficou escrito
> em `docs/ARQUITETURA-WEB.md`, para o dia em que for.
>
> Dois oráculos travam a regra, e o primeiro é o único que podia: o
> `boot-nativo.test.mjs` é o que sobe a base COM a ponte, isto é, o único lugar
> em que existe conexão a medir — sem tela a preview deixa de ser muda, no Modo
> Fácil volta a ser, e com uma tela da rede recebendo ela fica muda mesmo no
> avançado. O `destinos.test.mjs` continua travando a REMOÇÃO (nenhum botão,
> nenhum `setStandalone`) e agora afirma também que o estado é derivado.

> **A v5.214: A ATIVAÇÃO DA TELA DA REDE JÁ ERA UNIFICADA — o que sobrava era um
> segundo botão pedindo o que o primeiro tinha acabado de fazer. OTA PURO**
> (nenhuma linha de Kotlin; sem Release).
>
> Relato do operador: o "Ativar esta tela" não estaria ativando som e tela cheia
> junto com o display, e exigiria uma segunda interação para isso.
>
> **Medido antes de mexer, e o diagnóstico natural estava errado.** Um toque só,
> num Chromium de verdade contra o servidor de mentira do `tela-rede`: tela cheia
> `true`, overlay fora, `__telaSom(true)` chamado. **As três coisas aconteciam no
> primeiro toque** — o gesto sempre foi um só. O que aparecia era um botão de
> canto, opaco, escrito "Voltar à tela cheia", que **nunca saía de cena**. Do
> lado de quem opera isso é indistinguível de "a ativação não funcionou", e é
> exatamente assim que foi relatado.
>
> São dois defeitos, e eles se compõem — nenhum dos dois produz sintoma sozinho:
>
> - **A pergunta era feita DENTRO do gesto.** `oferecerGesto()` roda no ouvinte
>   de clique do `document`, e o clique que gasta o gesto borbulha até lá **antes
>   de a tela cheia existir**: `requestFullscreen()` é assíncrono. A linha do
>   tempo instrumentada mostra o ouvinte rodando com `fullscreenElement=false` e
>   o `fullscreenchange` chegando 9 ms depois. Isto é: a única pergunta que esse
>   botão existe para responder era feita no único instante em que a resposta é
>   garantidamente falsa. Agora quem responde é o próprio pedido — a Promise
>   resolve se entrou, rejeita se foi recusada — e entre uma coisa e outra
>   `oferecerGesto()` é mudo (`assentando`).
> - **E o botão não sabia sair.** `mostrarCanto` agenda a opacidade um quadro
>   adiante e o recolhimento em 5 s; `esconderCanto`, chamado no meio disso pelo
>   `fullscreenchange`, matava o de 5 s e agendava a saída — e então o quadro
>   órfão repunha `opacity: 1`. A saída conferia `opacity === '0'`, encontrava
>   `'1'` e desistia. **Opaco, por cima da projeção, sem nenhum prazo vivo para
>   recolhê-lo.** Os três prazos passaram a ser cancelados em bloco, que é a
>   única regra que um par mostrar/esconder pode ter: o último a ser chamado
>   vale.
>
> **O oráculo entrou no mesmo commit** (`tools/tela-rede.test.mjs`, a regra da
> v5.145), e a asserção é deliberadamente independente de o navegador CONCEDER
> tela cheia — exigir a concessão viraria vermelho num runner que a negue, e
> vermelho ambiental é o que ensina a ignorar vermelho (a lição da v5.204). O que
> ela afirma vale nos dois ambientes: **nenhum botão pode estar na tela
> oferecendo uma coisa que já está feita.** O caminho de VOLTA é travado logo
> abaixo — sem ele, apagar o botão de canto passaria no teste de cima e tiraria a
> única saída de quem esbarra na tecla errada do controle remoto; e quando o
> ambiente não concede tela cheia, o caso não é exercitado e isso é **dito**, não
> silenciado (a lição da v5.213).
>
> A régua que fica, e ela é mais larga que este arquivo: **estado que uma API
> assíncrona vai escrever não pode ser lido no mesmo turno em que ela é
> chamada** — e um par mostrar/esconder com prazos só é honesto se cancelar
> todos os seus.

> **A v5.213: OS ORÁCULOS DE CHROMIUM VIRAM DOIS PASSOS — o painel verde
> escondia um teste caindo. OTA PURO** (o único arquivo tocado fora da base é o
> workflow; nenhuma linha de Kotlin, sem Release).
>
> Pedido do operador depois da v5.212, sobre uma observação que a auditoria
> deixou em aberto. Os doze oráculos de Chromium rodavam num passo só, com
> `set -euo pipefail` — então o PRIMEIRO que reprovasse abortava os ONZE
> seguintes. Somado ao `continue-on-error` do passo, o desfecho era: **um teste
> caiu, os outros nunca rodaram, e o run está verde.** Saber disso exigia abrir
> o log e reparar em qual linha ele tinha parado — foi exatamente o que precisei
> fazer para conferir a v5.212.
>
> **A separação não é organização, é o que dá sentido ao `continue-on-error`.**
> A justificativa dele sempre foi INFRAESTRUTURA (download do Chromium, runner
> sem rede), e infraestrutura passou a ser o primeiro passo, sozinho
> (`Preparar o Chromium`). O segundo (`Oráculos em Chromium`) ficou com uma
> causa só de falhar — defeito de verdade —, roda os doze SEMPRE, emite
> `::error::` por reprovado e escreve o placar no **resumo do run**. O `if:
> steps.chromium.outcome == 'success'` existe para o caso de o Chromium não
> instalar: doze `::error::` de infraestrutura seriam precisamente o ruído que
> ensina a ignorar vermelho.
>
> **O que NÃO mudou, e é dito para não parecer esquecimento:** o segundo passo
> segue com `continue-on-error`. Barrar o canal OTA por um teste de navegador
> continua sendo trocar um risco raro por um bloqueio frequente, e essa é a
> política do projeto, não minha. O que mudou é que agora ela é uma linha só — e
> a razão que a sustentava mudou de endereço.
>
> Duas medidas pequenas, pela regra de sempre: o placar é `N/12` com o `N`
> **contado**, nunca digitado (um número fixo envelheceria no primeiro oráculo
> novo, e envelheceria mentindo), e a lógica do passo foi exercitada nos dois
> sentidos antes de subir — com dois reprovados no meio, os outros dez rodam,
> o resumo os nomeia e o passo sai com 1; com tudo passando, sai com 0.

> **A v5.212 (v1.97): O EMBED DO YOUTUBE SAI DOS DOIS WEBVIEWS, e com ele uma
> ponte privilegiada exposta a terceiro. Mais duas correções de uma auditoria
> do repositório inteiro. EXIGE APK.**
>
> - **`POST /r` INJETAVA COMANDO ARBITRÁRIO NO BARRAMENTO.** O ramo `st` do
>   canal de volta conferia que `type` não era vazio e mais nada, e então
>   chamava `MessageBus.post(null, …)` — que entrega a TODOS os WebViews. O
>   dreno documentado ("uma lista de PERMISSÃO de dois itens") existia só no
>   `espelho/tela.js`, isto é, **no lado que um desconhecido controla**. E a
>   porta do pareamento nasce aberta desde a v5.189 (decisão certa: o conteúdo
>   é público), então estar pareado nunca foi credencial. Com uma TV conectada,
>   qualquer aparelho no Wi-Fi da igreja podia projetar `text` arbitrário,
>   `clear`, `load` — e ligar o `mic`, que abre o microfone do celular na saída
>   de som do templo. A metade servidora da lista agora existe
>   (`TIPOS_QUE_SOBEM`, em `EspelhoServidor.retorno`), e o par tem de ser
>   mantido junto. **A lição é a de sempre, num lugar novo: validação que mora
>   no cliente não é validação — é economia de tráfego.**
> - **RELIGAR A TRANSMISSÃO DEIXAVA AS TELAS SEM MÍDIA, em silêncio.** O
>   `telaEmpurrados` do `controle.js` era uma SEGUNDA fonte de verdade sobre o
>   cache do shell, e o cache é DA SESSÃO: `startMirror` constrói um
>   `EspelhoMidiaCache` novo (o `init` apaga o diretório) e `desmontarEspelho`
>   chama `zerar()`. Bastava desligar e religar — ou a Wi-Fi oscilar além dos
>   6 s de graça, que aciona `aoPerderRede = { stopMirror() }` — para o Controle
>   seguir afirmando "já empurrei" contra um cache vazio: o `load` ia com
>   `__rec.url = '/m/<token>'` e a rota devolvia o 404 idêntico. **Toda mídia já
>   tocada antes do religamento ficava invisível**, sem erro em lugar nenhum. O
>   LRU de 1,5 GiB produzia o mesmo desencontro por outra porta. O conjunto saiu:
>   quem responde "já tenho isto?" é o `abrir` do shell, que já respondia.
> - **E O EMBED DO YOUTUBE SAIU DOS DOIS WEBVIEWS** (pedido do operador:
>   *"vamos abandonar o sistema nativo do próprio YouTube e seguir apenas com o
>   nosso embed"*). O KDoc do `display.js` dizia que o risco de supply-chain
>   daquele `<script>` era "ACEITO conscientemente" e que a mitigação "ainda não
>   foi feita" — e descrevia METADE do problema. `addJavascriptInterface` injeta
>   o objeto em **todas as frames**, iframes de outra origem inclusive (é o que
>   a documentação do Android diz, e é por isso que o canal de mídia usa
>   `addWebMessageListener`, que tem `allowedOriginRules`). No telão a ponte
>   nasce com `host = null` e o estrago seria limitado; **o mesmo embed era
>   criado no CONTROLE, para a preview**, e lá a ponte é a completa —
>   `pickFolder`, `listFolder`, `pickDoc`, `openExternal`, `espelhoLigar`,
>   `apkInstalar`. **A invariante 9 protegia a metade errada**, e atravessou
>   dezenas de versões assim porque o texto dela só nomeia o telão.
>
>   Saíram ~540 linhas do `display.js` (`YT.Player`, `ytHandle`, `ytStatus`,
>   `ytShield`, a máquina de mudo que "ignora o `forceMuted` do stage por
>   completo") e ~180 do `controle.js`, mais as duas camadas de CSS que
>   existiam só para esconder a UI de um player alheio. O que some junto é o
>   argumento inteiro: um segundo motor de transporte, um segundo emissor de
>   status, uma segunda cortina e um `if (yt)` em quinze pontos.
>
>   **Quem toca YouTube agora é o caminho PRÓPRIO, e ele já era o preferido**:
>   transmissão direta (`ytStream` → `shared/mse.js`) e, falhando ela, o arquivo
>   baixado. Um registro `kind: 'youtube'` (o link sem bytes) deixou de ser
>   tocável como link e passa a ser RESOLVIDO no toque, dentro do `send`
>   (`resolverLinkYoutube`): transmite, ou baixa e **troca o item na lista em
>   posição** (`listSet` com função — `listAdd`+`listRemove` mandaria o item
>   para o fim de um Cronograma que alguém montou à mão). A transmissão não
>   troca nada, porque um manifesto expira em horas. No navegador não há o que
>   fazer, e a linha do item diz isso em vez de projetar nada.
>
>   **O oráculo ficou mais forte, não mais fraco**: o `tela-rede.test.mjs`
>   afirmava que a CSP BARRAVA a IFrame API — uma garantia de segunda ordem, que
>   dependia de um cabeçalho continuar certo. Agora ele afirma que a tela da
>   rede **não pede um byte a origem nenhuma além do celular**, o que falha mesmo
>   que a CSP o barrasse depois.
> - **E a documentação que contradizia o código foi corrigida junto**, pela
>   regra da v5.206: o KDoc do `EspelhoServidor` ainda se chamava "o cano por
>   onde os PIXELS saem" e afirmava que "aqui não há `Range` nenhum" — 500 linhas
>   acima de uma rota que faz RFC 7233 completo; o do `EspelhoHttp` dizia o mesmo
>   e discordava da própria invariante 7, dentro do mesmo arquivo; o `retorno`
>   documentava os verbos `key` e `audio` do encoder aposentado; havia um
>   `@param pedirIdr` para um parâmetro que não existe, quatro blocos de KDoc
>   órfãos sobre constantes apagadas e um `const CABECALHO = 16` morto. E o
>   parágrafo que prometia que "**nada** que venha da rede entra no barramento"
>   deixara de ser verdade na E5 — ele descrevia a garantia certa, e o código não
>   a impunha mais. Era exatamente o defeito de cima, escrito em prosa.

> **A v5.211 (v1.96): A CAPA ARTIFICIAL SAI — fica a COR, sólida. EXIGE APK.**
> Pedido do operador sobre a v5.210, e ele encurta uma decisão que eu tinha
> tomado por ele: *"não preciso da capa artificial, apenas da cor. sólida, limpa
> e minimalista"*.
>
> **O argumento da v5.210 era sobre o BURACO, e o buraco é menos ruim que o
> enchimento.** Um `MediaStyle` sem `largeIcon` deixa um vão do tamanho de uma
> capa que cada versão do Android preenche de um jeito, e eu tratei isso como
> defeito a corrigir. Só que a capa que eu pus ali não informava nada — era o
> mesmo símbolo em todo louvor, todo vídeo e toda mensagem —, e um elemento
> constante que não distingue nada é decoração. Num cartão que o operador olha
> de relance, no escuro, no meio de um culto, quem carrega a informação é o
> TÍTULO e o transporte; **sólido lê mais rápido que ilustrado.** Com
> `setColorized(true)` o cartão já é um painel de cor inteiro, e é ele que faz o
> trabalho de "isto é o mesmo app".
>
> Saíram o `capaArtificial`, o `capaCache`, o `setLargeIcon` e os dois imports
> de `graphics` — o `temaMudou()` e o `corDoTema()` ficam intactos, porque a cor
> era o pedido desde o começo. **A regra que a v5.210 escreveu e que continua
> valendo é a outra**: a capa não podia seguir o tema (o vetor do ícone está nos
> tokens do escuro, e sobre o `app_bg_claro` daria 1,02:1) — quem segue o tema é
> o cartão, e agora é a única coisa que segue.

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
> - **E ele ganhou uma CAPA, porque não existe capa de verdade. ~~REVOGADA na
>   v5.211~~** a pedido do operador — leia mesmo assim, porque a regra do meio
>   (a capa não pode seguir o tema) é o que sobrou de pé. O acervo é
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
