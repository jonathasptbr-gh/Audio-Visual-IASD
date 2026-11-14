# Estrutura do repositório — a árvore anotada

O que cada arquivo do app faz e se recusa a fazer, num lugar só. O mapa Kotlin
com o capítulo de cada `.kt` é o [`shell/README.md`](shell/README.md); o da base
web, o [`ARQUITETURA-WEB.md`](ARQUITETURA-WEB.md). O `CLAUDE.md` guarda só o
esboço (oito linhas); a **contagem medida** dos arquivos Kotlin mora aqui, e o
`tools/docs-coerentes.test.mjs` a confere contra o disco.

> **Movido do `CLAUDE.md` na revisão A2 (2026-10-30), sem mudança de texto** (só os links relativos e o nível dos títulos). No núcleo ficou um resumo com o link para cá. "Acima", "abaixo", "esta seção" e as invariantes numeradas falam do `CLAUDE.md`, de onde este texto veio.

```
app/src/main/
├── AndroidManifest.xml          # intent-filter de share, portrait, <queries>, regras de backup
├── assets/web/                  # ← a base web (cópia própria, versionada aqui)
│   ├── version.json             #   identidade do bundle (version + minShell)
│   ├── notas.json               #   A LINHA DO TEMPO: o que cada versão mudou.
│   │                            #   Viaja NO bundle de propósito (ver o OTA)
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
│   ├── controle/tour.js         #   o TOUR GUIADO: véu com recorte e balão, um
│   │                            #   tour por estado da tela (conexão, controles,
│   │                            #   avançado). Nunca projeta nem toca nada
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
│   ├── GuiaSom.kt               # o guia de sonoplastia numa tela do app: Dialog +
│   │                            #   WebView SEM ponte; o ✕ à esquerda, o marcador
│   │                            #   `?app=1` e a cerca `urlDoGuia` (JUnit)
│   ├── R2ImagemFonte.kt         # /r2img/<token>: as fotos do bucket R2 pelo NOSSO
│   │                            #   origin (o desvio de CORS)
│   ├── YoutubeGrab.kt           # extrai e baixa o vídeo do YouTube NO APARELHO
│   ├── TrilhaAudio.kt           # QUAL trilha de áudio vai ao telão (a dublagem
│   │                            #   automática do YouTube) — PURO, com JUnit
│   ├── MuxMp4.kt                # junta as faixas de vídeo e áudio (1080p) — MediaMuxer
│   ├── SlideDeck.kt             # apresentação (PDF/Google) → uma imagem por página
│   ├── MicChromeClient.kt       # onPermissionRequest: microfone no WebView do telão
│   │                            #   (o pedido de permissão e o MicDiag saíram na X1)
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
├── test/java/br/org/iasd/av/    # os JUnit — a lista e o que cada um trava: BUILD.md
└── res/
    ├── drawable/                # ic_image{,_off} — a cortina, na notificação
    │                            #  + ic_stop — PARAR (o sistema não tem um)
    │                            #  + ic_launcher_{foreground,mono} — o ÍCONE, em vetor
    ├── mipmap-anydpi-v26/       # ic_launcher{,_round}: o adaptativo (o único, minSdk 26)
    ├── values/colors.xml        # app_bg e ic_launcher_background: ESPELHAM tokens da base web
    ├── values/themes.xml        # tema sem action bar; tema preto da Presentation
    └── xml/                     # backup_rules + data_extraction_rules (ver "Build")

.github/workflows/
├── apk.yml                      # verificar → apk → web-ota: o CI inteiro (BUILD.md)
├── pages.yml                    # a página, por `workflow_run` — NUNCA `on: release`
└── dados.yml                    # o cron que fotografa os contadores na branch `dados`

capturas/                        # a ORIGEM das capturas do site (JPEG): material, não bundle
├── LEIA-ME.md                   #   o que cada pasta é, e como a captura vira `site/telas/`
└── entrada/                     #   as capturas da entrada (convertidas para `site/telas/`)

site/                            # a página pública (GitHub Pages) — todo caminho é RELATIVO
├── index.html                   #   a página da versão, do APK e das funções
├── CNAME                        #   audiovisualiasd.com.br
├── registro/ · sonoplastia/     #   a página do Registro e o guia de sonoplastia
├── telas/                       #   as capturas do guia (320/: as estreitas)
└── icone.svg · og.jpg · og-sonoplastia.jpg

tools/                           # o arnês e os oráculos — a lista do CI sai do workflow
├── estado.sh                    #   o estado MEDIDO: versão, HEAD, CI, credencial, fila, oráculos
├── portao.sh                    #   o portão da máquina: Node puro + Sanidade + a vizinhança
├── arnes.mjs                    #   servirEstatico, esperar/esperarDb, comTema/comModoAvancado
├── checar.mjs                   #   o `checar`, SEM import: roda antes do `npm ci`
├── reverter.sh                  #   guardar/restaurar — a reversão por CÓPIA, nunca por git
├── previa-visual.mjs            #   a prévia visual: o laço de design (BUILD.md)
├── miolo.mjs                    #   o mapa do `controle.js` (docs/arquitetura/MIOLO.md)
├── pares-de-comentario.mjs      #   a prova 2 da poda de comentário
├── revisao-cobertura.mjs        #   a cobertura dos marcos da revisão geral
├── junit-sem-rede.sh            #   os JUnit puros, sem Gradle e sem rede
├── sem-rede.mjs                 #   `semRedeExterna(ctx)`: terceiro fora do oráculo
├── medicao-desempenho.mjs       #   a medição X3 (só com `[medicao]` no commit)
├── fixtures/                    #   o vídeo de 20 s que os oráculos de mídia usam
└── *.test.mjs · smoke.mjs · display-smoke.mjs   # os oráculos (ORACULOS.md)

docs/
├── ACHADOS-EM-ABERTO.md         # os defeitos confirmados que MUDAM comportamento (hoje: nenhum). Para ESVAZIAR
├── ARQUITETURA-WEB.md           # HUB da base web: regras gerais + mapa dos capítulos
├── AUDITORIA-2026-08.md         # APÊNDICE congelado: o retrato de 2026-08
├── AUDITORIA-2026-09-11.md      # APÊNDICE congelado: o retrato de 2026-09-11
├── AUDITORIA-EFICIENCIA-2026-09.md  # APÊNDICE congelado: o custo, medido
├── AUDITORIA-ESTABILIDADE-AV.md # APÊNDICE congelado: o que pode INTERROMPER áudio/vídeo
├── BUILD.md                     # o rito, a versão, o CI, os oráculos (MÉTODO), assinatura, backup, site
├── DIAGNOSTICO.md               # a Verificação do Sistema e o Registro
├── DIVERGENCIAS-WEB-NATIVO.md   # navegador × app, ponto por ponto
├── ECONOMIA.md                  # o CUSTO da sessão: os tetos, a rotina, a delegação, o medidor
├── ESTRUTURA.md                 # esta árvore
├── ESTUDO-GUIA-IASD.md          # ESTUDO: a especialização do guia (Pacote 15; não é entrega)
├── FONTE-DE-DADOS-LOUVORJA.md   # referência do banco LouvorJA (hinos/Bíblia)
├── HISTORICO.md                 # APÊNDICE: as notas de todas as versões — usar por grep
├── MEDICAO-DE-ALCANCE.md        # o contrato da contagem de uso: o que é contado, e o que NUNCA é
├── MULTI-AGENTE.md              # duas sessões no mesmo clone — o protocolo
├── NUCLEO-TECNICO.md            # o corpo por área: invariantes, ponte, filas, OTA, telão, paleta, diagnóstico
├── ORACULOS.md                  # o que cada oráculo TRAVA. REFERÊNCIA: abra por pergunta, nunca inteiro
├── PEDIDOS-EM-ESPERA.md         # a fila do operador, em pacotes
├── PODA-DE-COMENTARIO.md        # as duas provas da poda de comentário
├── RESIDUOS.md                  # o que cada LOTE deixou para trás — a tabela que substitui a arqueologia
├── REVISAO-GERAL.md             # o ESCOPO da revisão periódica: os dez marcos (M1..M10)
├── REVISAO-PROFUNDA.md          # APÊNDICE: a revisão profunda, ENCERRADA em 2026-11-09
├── TELAO-POR-COMANDOS.md        # o CONTRATO do telão por comandos — ler antes de mexer nele
├── recursos/                    # o DETALHE do que o núcleo resume (a faxina 2026-09-07)
│   ├── CIFRA.md                 #   a aba de cifra: cadeia de busca, transposição, rolagem
│   ├── PACOTE.md                #   o `.avpkg`: formato, folha de grupos, importação
│   └── SERIES.md                #   as sete armadilhas da nomenclatura, o Registro da regra
├── shell/                       # HUB do KOTLIN + um capítulo por subsistema
│   ├── README.md                #   o mapa: qual capítulo abrir, e onde cada .kt mora
│   ├── PONTE.md                 #   AVNative campo a campo, SHELL_VERSION, as SEIS filas
│   ├── SEGUNDO-PLANO.md         #   SyncService, wake lock, a notificação de progresso
│   ├── SESSAO-DE-MIDIA.md       #   MediaSession: transporte, estado, ciclo de vida
│   └── OTA.md                   #   watchdog de boot, detecção, shellTag, achados abertos
├── arquitetura/                 # um capítulo por arquivo — abrir SÓ o que a pergunta pede
│   ├── CONTROLE.md              #   HUB do Controle: mapa das partes + regras gerais
│   ├── MIOLO.md                 #     o mapa do controle.js: as nove fatias e como perguntar (`node tools/miolo.mjs`)
│   ├── CONTROLE-MODOS.md        #     Modo Fácil × avançado
│   ├── CONTROLE-LAYOUT.md       #     layout, transporte, botões de slide, fullscreen
│   ├── CONTROLE-NAVEGACAO.md    #     uma tela, duas folhas e uma janela
│   ├── CONTROLE-CONFIGURACOES.md #    tema, painel rápido, Registro, wallpaper, histórico
│   ├── CONTROLE-TOUR.md         #     o tour guiado: um por estado da tela, a marca de "já visto"
│   ├── CONTROLE-TELAO.md        #     abertura, retomada, referência da preview, saída de áudio
│   ├── CONTROLE-BIBLIOTECA.md   #     abas, destinos, a linha da lista, coleções na raiz
│   ├── CONTROLE-LISTAS.md       #     cronogramas, gestos, favoritos, editar mídia
│   ├── CONTROLE-COLECOES.md     #     LouvorJA, sincronização, acordeões, completude
│   ├── CONTROLE-SORTEIO.md      #     playlist automática
│   ├── CONTROLE-YOUTUBE.md      #     busca, download, compartilhamento, séries
│   ├── CONTROLE-LEITURA.md      #     ferramentas, leitura auxiliar, cifra deitada
│   ├── MODELO-DE-DADOS.md       #   shared/db.js: IDB, OPFS, BroadcastChannel, coletor
│   ├── MOTOR-STAGE.md           #   shared/stage.js: cortina, fades, concorrência de load
│   ├── CAMADA-DE-TEXTO.md       #   Bíblia, Mensagens, letra, cronômetro, sorteio, itinerário, imagem
│   ├── BIBLIA.md                #   a aba `bible`
│   ├── DISPLAY.md               #   wallpaper, microfone, o telão
│   ├── DESIGN-SYSTEM.md         #   ANTES DE ESCREVER COR: tokens, dois temas, contraste
│   └── DOCUMENTO-EM-CENA.md     #   PDF, PowerPoint, Google Apresentações
└── revisao/                     # as revisões datadas e os apêndices do método
    ├── A2-INVENTARIO.md         #   o mapa da dieta do CLAUDE.md (o que saiu, e para onde)
    ├── CASOS-MEDIDOS.md         #   os casos que criaram as regras do portão
    ├── PARTIR-O-MIOLO.md        #   o método que partiu o controle.js (A3)
    ├── REGISTRO.md              #   o que cada etapa da revisão profunda mediu (ENCERRADO)
    ├── REVISAO-2026-11-13.md    #   o dossiê da varredura de 13/11
    └── REVISAO-2026-11-14.md    #   o dossiê da revisão das diretrizes (o Pacote 27 saiu dele)
```

**32 arquivos Kotlin, uma dependência de terceiros no shell** — o resto é
AndroidX oficial (`core-ktx`, `activity-ktx`, `webkit`). O que sustenta essa
proporção Kotlin × JavaScript é a invariante 5; ela é o argumento contra
Capacitor/Cordova, que arrastariam npm e um build system inteiro e ainda assim
exigiriam código nativo próprio para a `Presentation`.

> Números envelhecem a cada commit. **Meça antes de citá-los:**
> `wc -l app/src/main/java/br/org/iasd/av/*.kt` ·
> `find app/src/main/assets/web -name '*.js' -not -path '*/vendor/*' | xargs wc -l`;
> a conta acima é conferida pelo `tools/docs-coerentes.test.mjs`.

---
