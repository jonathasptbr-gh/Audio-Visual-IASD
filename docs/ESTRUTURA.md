# Estrutura do repositório — a árvore anotada

O que cada arquivo do app faz e se recusa a fazer, num lugar só. O mapa Kotlin
com o capítulo de cada `.kt` é o [`shell/README.md`](shell/README.md); o da base
web, o [`ARQUITETURA-WEB.md`](ARQUITETURA-WEB.md). A versão condensada (só os
nomes) fica no `CLAUDE.md`.

> **Movido do `CLAUDE.md` na revisão A2 (2026-10-30), sem mudança de texto** (só os links relativos e o nível dos títulos). No núcleo ficou um resumo com o link para cá. "Acima", "abaixo", "esta seção" e as invariantes numeradas falam do `CLAUDE.md`, de onde este texto veio.

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
│   ├── controle/progresso.js    #   o PERCENTUAL do YouTube, do TOQUE à mídia
│   │                            #   TOCANDO: as fases e o peso APRENDIDO de cada
│   │                            #   uma (mediana PONDERADA pela idade das últimas
│   │                            #   amostras COMPARÁVEIS, `ytTempos`; a rede como
│   │                            #   latência + ritmo medido ENTRE avisos, a cauda
│   │                            #   como fixo + por MB) e a EXIBIÇÃO por VELOCIDADE
│   │                            #   (pouso em 95, inércia, freio, piso, varredura
│   │                            #   final) — e o
│   │                            #   `relatorio()` que vai ao Registro. PURA, com
│   │                            #   oráculo Node. Nunca volta, nunca para, nunca
│   │                            #   100 antes de a mídia tocar
│   ├── controle/sorteio.js      #   a PLAYLIST AUTOMÁTICA: a REGRA que decide o
│   │                            #   que pode ser sorteado (PURA, capacidades
│   │                            #   injetadas, com oráculo Node). Os filtros são
│   │                            #   INCLUSIVOS (v1.12.53): CATEGORIAS que
│   │                            #   particionam o acervo (Hinário 2022 sem os
│   │                            #   infantis, Infantis 508–557, Hinário 1996, uma
│   │                            #   por coletânea, "outros"); nada marcado = tudo,
│   │                            #   marcado = a UNIÃO. A FOLHA as apaga a cada
│   │                            #   abertura, com a palavra tema (v1.8.98)
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
│   ├── CAMADA-DE-TEXTO.md       #   Bíblia, Mensagens, letra, cronômetro, sorteio, itinerário, imagem
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

**33 arquivos Kotlin, uma dependência de terceiros no shell** — o resto é
AndroidX oficial (`core-ktx`, `activity-ktx`, `webkit`). O que sustenta essa
proporção Kotlin × JavaScript é a invariante 5; ela é o argumento contra
Capacitor/Cordova, que arrastariam npm e um build system inteiro e ainda assim
exigiriam código nativo próprio para a `Presentation`.

> Números envelhecem a cada commit. **Meça antes de citá-los:**
> `wc -l app/src/main/java/br/org/iasd/av/*.kt` ·
> `find app/src/main/assets/web -name '*.js' -not -path '*/vendor/*' | xargs wc -l`

---
