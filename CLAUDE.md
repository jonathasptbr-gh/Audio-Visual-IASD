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

**Este arquivo é o NÚCLEO: o que vale para QUALQUER tarefa.** Ele é lido INTEIRO
em toda sessão, antes de qualquer trabalho, e por isso cada seção guarda só o que
se quebra sem abrir o capítulo — mais o link para o capítulo, onde mora o resto.
A divisão é de 2026-09-07; a dieta da revisão A2 (2026-10-30) a levou até o fim,
e o mapa de para onde foi cada bloco está em
[`docs/revisao/A2-INVENTARIO.md`](docs/revisao/A2-INVENTARIO.md).

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
| 9 | [A paleta](#a-paleta) | **antes de escrever qualquer cor** |
| 10 | [Divergências web × nativo](#divergências-entre-o-caminho-web-e-o-nativo) | o que muda entre navegador e app |
| 11 | [Build e distribuição](#build-e-distribuição) | CI, o portão, o MÉTODO dos oráculos |
| 12 | [Regras de desenvolvimento](#regras-de-desenvolvimento) | **antes de commitar** |

**A [conversa com o operador](#a-conversa-com-o-operador) não entra na tabela:
ela não tem "quando abrir" — vale SEMPRE, desde a primeira linha da sessão.**

**Onde mora o detalhe** — o resumo tem o que se pode quebrar sem abrir o
capítulo, e o capítulo tem o resto:

| assunto | resumo | capítulo |
|---|---|---|
| a árvore anotada do repositório | [§](#estrutura-do-repositório) | [`docs/ESTRUTURA.md`](docs/ESTRUTURA.md) |
| o catálogo dos 64 métodos, as regras da ponte por extenso | [§](#a-ponte-windowavnative) | [`docs/shell/PONTE.md`](docs/shell/PONTE.md) |
| reconexão do telão, "há tela" ≠ "há telão", morte do renderer | [§](#reconexão-e-morte-do-renderer) | [`docs/arquitetura/DISPLAY.md`](docs/arquitetura/DISPLAY.md) |
| o relay · o dreno do papel `tela` · a referência da preview · o `load` | [§](#barramento-de-comandos-e-o-plano-b-do-broadcastchannel) | [`MODELO-DE-DADOS`](docs/arquitetura/MODELO-DE-DADOS.md) · [`TELAO-POR-COMANDOS`](docs/TELAO-POR-COMANDOS.md) · [`CONTROLE-TELAO`](docs/arquitetura/CONTROLE-TELAO.md) · [`MOTOR-STAGE`](docs/arquitetura/MOTOR-STAGE.md) |
| download minimizado, `SyncService`, notificação de progresso | [§](#trabalho-em-segundo-plano-downloads-com-o-app-minimizado) | [`docs/shell/SEGUNDO-PLANO.md`](docs/shell/SEGUNDO-PLANO.md) |
| `MediaSession`, transporte fora do app | [§](#notificação-de-controles-sessão-de-mídia) | [`docs/shell/SESSAO-DE-MIDIA.md`](docs/shell/SESSAO-DE-MIDIA.md) |
| os dois canais, a detecção, o watchdog, a pergunta | [§](#ota-da-base-web-atualização-sem-apk) | [`docs/shell/OTA.md`](docs/shell/OTA.md) |
| o telão nas telas da rede: peças, decisões, inversões | [§](#telão-por-comandos-o-telão-nas-telas-da-rede-local) | [`docs/TELAO-POR-COMANDOS.md`](docs/TELAO-POR-COMANDOS.md) |
| os álbuns oficiais da Biblioteca | [§](#séries-do-youtube-os-álbuns-oficiais-da-biblioteca) | [`docs/recursos/SERIES.md`](docs/recursos/SERIES.md) |
| acordes sobre a letra, sob demanda | [§](#a-aba-de-cifra-acordes-ao-lado-da-letra) | [`docs/recursos/CIFRA.md`](docs/recursos/CIFRA.md) |
| o acervo num arquivo `.avpkg` | [§](#o-pacote-de-transferência-o-acervo-num-arquivo) | [`docs/recursos/PACOTE.md`](docs/recursos/PACOTE.md) |
| a cortina da abertura, o piso e o prazo | [§](#a-abertura-por-trás-dos-panos) | [`docs/arquitetura/CONTROLE-TELAO.md`](docs/arquitetura/CONTROLE-TELAO.md) |
| cada par de cor medido, os pisos, o revogado, as regras da paleta por extenso | [§](#a-paleta) | [`docs/arquitetura/DESIGN-SYSTEM.md`](docs/arquitetura/DESIGN-SYSTEM.md) |
| cada ponto web × nativo por extenso; share, microfone, voltar, volume, cast, som do espelhamento | [§](#divergências-entre-o-caminho-web-e-o-nativo) | [`docs/DIVERGENCIAS-WEB-NATIVO.md`](docs/DIVERGENCIAS-WEB-NATIVO.md) |
| arnês, prazos, paralelismo, stub de 60 s, passos do CI, JUnit, assinatura, backup, a página do site, as dependências | [§](#build-e-distribuição) | [`docs/BUILD.md`](docs/BUILD.md) |
| a Verificação do Sistema, o Registro, as regras de diagnóstico | [§](#diagnóstico) | [`docs/DIAGNOSTICO.md`](docs/DIAGNOSTICO.md) |
| o que cada oráculo trava | (o MÉTODO fica em [Build](#build-e-distribuição)) | [`docs/ORACULOS.md`](docs/ORACULOS.md) |

**Fora daqui:**

| arquivo | o que é |
|---|---|
| [`docs/ACHADOS-EM-ABERTO.md`](docs/ACHADOS-EM-ABERTO.md) | os defeitos CONFIRMADOS e ainda não corrigidos, com cenário e correção proposta — **leia antes de mexer no que ele nomeia**. Hoje tem TRÊS (os dois do áudio do espelhamento e o CLIENTE de onde sai a escada da transmissão); é arquivo para esvaziar, não para crescer |
| [`docs/shell/README.md`](docs/shell/README.md) | o HUB do **Kotlin**: um capítulo por subsistema, e onde cada `.kt` é explicado |
| [`docs/ARQUITETURA-WEB.md`](docs/ARQUITETURA-WEB.md) | o HUB da base web: regras gerais e o mapa dos capítulos em `docs/arquitetura/` |
| [`docs/TELAO-POR-COMANDOS.md`](docs/TELAO-POR-COMANDOS.md) | o contrato das telas da rede — inclusive o celular como PONTO DE ACESSO (código desde a v1.4.1) |
| [`docs/FONTE-DE-DADOS-LOUVORJA.md`](docs/FONTE-DE-DADOS-LOUVORJA.md) | o banco de hinos/Bíblia |
| [`docs/MEDICAO-DE-ALCANCE.md`](docs/MEDICAO-DE-ALCANCE.md) | o CONTRATO da contagem de uso: o que é contado, o que nunca é, por que o uso próprio sai por construção, e a MEDIÇÃO ainda pendente de que o farol depende |
| [`docs/HISTORICO.md`](docs/HISTORICO.md) | **apêndice**: a nota de cada versão, para consultar por `grep`, nunca por leitura integral |
| [`docs/AUDITORIA-2026-08.md`](docs/AUDITORIA-2026-08.md) | **apêndice**: a varredura da v1.4 (75 achados, o método de refutação, 26 por aplicar) — por `grep` |
| [`docs/AUDITORIA-ESTABILIDADE-AV.md`](docs/AUDITORIA-ESTABILIDADE-AV.md) | **apêndice**: o que pode INTERROMPER a transmissão ou a mídia no ar — dez achados (um é MEDIÇÃO, não conserto) |
| [`docs/AUDITORIA-2026-09-11.md`](docs/AUDITORIA-2026-09-11.md) | **apêndice**: a varredura da v1.5.19 à v1.8.69 |
| [`docs/AUDITORIA-EFICIENCIA-2026-09.md`](docs/AUDITORIA-EFICIENCIA-2026-09.md) | o custo de MANTER o repositório (contexto, retrabalho, rito, CI), já refutado; a lista dos MORTOS, com a razão de cada um, economiza a sessão de quem for reachá-los |

---

## A conversa com o operador

**Quem lê o que sai desta sessão não programa.** Ele opera o app num culto, e a
pergunta dele é sempre a mesma: *mudou o quê, e eu preciso fazer alguma coisa?*

| regra | o que é |
|---|---|
| **NÃO NARRAR O TRABALHO** | nada de "vou conferir", "agora vou editar", "encontrei o arquivo". A sessão fala DUAS vezes: para perguntar o que não dá para decidir sozinha, e para ENTREGAR |
| **O RELATÓRIO É PARA LEIGO** | sem nome de arquivo, de função, de tecnologia ou de número interno. O que mudou, dito pelo que ele VÊ ou FAZ no app |
| **ECONOMIA DE PALAVRAS** | frases curtas, sem preâmbulo e sem fecho de cortesia. Um relatório de dez linhas que se lê vale mais que um de cinquenta que se pula |
| **DETALHE SÓ SOB PEDIDO** | ele pergunta, e aí vem o técnico inteiro, sem economia |
| **ESPERAR É MUDO** | *"pode ocultar as mensagens e logs que não sejam seu relatório final"*. Enquanto um agente delegado trabalha, a sessão NÃO escreve "aguardando", "ainda rodando", "o agente continua". Isso não é narrar o trabalho: é narrar a AUSÊNCIA de trabalho, e sai dezenas de vezes seguidas |
| **A ETAPA É DITA, EM UMA LINHA** | *"me atualizasse nas mensagens sobre em qual etapa estamos… bem genéricas… em 4 ou 5 etapas… assim eu consigo perceber se algo está errado, ou se sequer está tendo progresso ou algo travou"* (2026-10-28). Cinco etapas fixas — **1 Planejando · 2 Executando · 3 Testando · 4 Publicando · 5 Conferindo** — e UMA linha a cada troca de etapa (ex.: *"Pacote 4: etapa 3 de 5, testando."*), sem detalhe. Com agente delegado em segundo plano, um check-in a cada ~15 min (`send_later`) confere o estado e manda a linha; é a única exceção ao "esperar é mudo", e ela não vira narração: nada além da etapa |

**AS DUAS COISAS QUE NUNCA SE OMITEM** — são elas que impedem "sucinto" de virar
"só a parte boa":

- **O QUE ELE PRECISA FAZER.** Instalar, esperar, reiniciar, conferir no
  aparelho — ou nada. Um relatório que diz *"pronto"* sobre o que só chega
  instalando o APK é FALSO, e o preço disso aparece no sábado de manhã.
- **O QUE NÃO DEU CERTO.** Falha é dita, com o que falhou. Pedaço de escopo que
  ficou de fora é dito, com o porquê. Encolher o trabalho em silêncio é o pior
  desfecho que uma sessão sabe produzir.

**O QUE NÃO DÁ PARA APAGAR, e fica dito para ninguém tentar:** as linhas de
ferramenta que aparecem na tela durante o trabalho são do PROGRAMA, não do texto
da sessão — nenhuma regra de escrita as suprime. **O que as encolhe é DELEGAR:**
o que roda dentro de um agente aparece como UM cartão no lugar de trinta linhas.
Por isso a tarefa substantiva nasce delegada — é economia de LEITURA do
operador, não gosto por paralelismo.

**E ISTO VALE PARA O CHAT, JAMAIS PARA A DOCUMENTAÇÃO.** O `CLAUDE.md`, os
`docs/` e as mensagens de commit continuam técnicos, densos e cheios de nome de
símbolo: eles são lidos por um AGENTE, antes do trabalho, e é essa densidade que
economiza a sessão seguinte. O `notas.json` é o único arquivo do repositório que
fala com o operador, e ele já tem regra própria (um tópico por linha, teto de 120
caracteres). **Aplicar linguagem de leigo à documentação destrói o
`HISTORICO.md`** — e o que se perde ali não volta.

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

**A árvore ANOTADA — o que cada arquivo faz e se recusa a fazer — está em
[`docs/ESTRUTURA.md`](docs/ESTRUTURA.md);** o mapa Kotlin está em
[`docs/shell/README.md`](docs/shell/README.md) e o da base web em
[`docs/ARQUITETURA-WEB.md`](docs/ARQUITETURA-WEB.md). Aqui, só os nomes:

```
app/src/main/
├── AndroidManifest.xml      # share, portrait, <queries>, regras de backup
├── assets/web/              # a base web (cópia própria, versionada aqui)
│   ├── version.json         #   identidade do bundle (version + minShell [+ shellTag])
│   ├── notas.json           #   A LINHA DO TEMPO do operador — viaja NO bundle
│   ├── shared/              #   tokens.css (PALETA, fonte única) · native.js (ponte +
│   │                        #   watchdog do OTA; NÃO existe no PWA) · db.js (+ relay
│   │                        #   nativo) · stage.js (motor de mídia) · wallpaper-padrao.svg
│   ├── vendor/              #   ÚNICO código de terceiro do web: o renderizador de .pptx
│   ├── espelho/             #   tela.css + tela.js: o papel `tela` (telão por comandos)
│   ├── controle/            #   controle.js · bible.js · louvorja.js · deck.js (.pptx
│   │                        #   no WebView) e as REGRAS PURAS, cada uma com oráculo
│   │                        #   Node: serie · hinario · coletanea · cifra · progresso ·
│   │                        #   sorteio · pacote · pptxzip
│   └── display/             #   o telão (sem sw.js / manifest / icons)
├── java/br/org/iasd/av/     # o shell — um .kt por subsistema (mapa: docs/shell/README.md)
│   ├── MainActivity · StagePresentation · WebViewFactory · NativeBridge · MessageBus
│   ├── SafPathHandler (+ SafJanela) · ShareIntake · WebPathHandler · StreamProxy
│   ├── SyncService · SessionService · WebUpdater · ShellUpdater · Farol
│   ├── YoutubeGrab · TrilhaAudio · MuxMp4 · SlideDeck · CifraFonte · R2ImagemFonte
│   ├── MicChromeClient · MicDiag · PacoteProvider · PacoteCanal
│   └── Espelho{Http,Pares,Servidor,MidiaCache,MidiaCanal,Energia,Interfaces,Cert,Diag}
└── res/                     # drawable (ícones em vetor) · mipmap-anydpi-v26 · values
                             # (colors.xml ESPELHA tokens) · xml (backup_rules)
docs/                        # ver o Índice; a árvore inteira em docs/ESTRUTURA.md
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

**Por extenso em
[`docs/arquitetura/DISPLAY.md`](docs/arquitetura/DISPLAY.md)** (seção
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
regras abaixo por extenso estão em [`docs/shell/PONTE.md`](docs/shell/PONTE.md).**

- **Superfície: 64 métodos**; o shell serve **76**. A conta (64 − 3 callbacks sem
  par + 9 internos = 70 chamados, + 6 órfãos = 76) é MEDIDA por varredura
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

Hoje vale **83** e é o **PISO**: o bundle declara `minShell: 83`, todo método
existe sempre e **não há guarda de versão no lado web** — o que separa navegador
de app é `if (!window.__NATIVE__)`, e nada mais. "Superfície" inclui **forma de
retorno e comportamento**. Sem guarda, mudança de ponte é lote **APK + web
publicado JUNTO**, com `shellTag` no `version.json`; **mudar a FORMA de um método
é pior que acrescentar um**. `minShell` acima do `SHELL_VERSION` instalado faz o
aparelho recusar todo bundle, para sempre (o CI confere o teto lendo o Kotlin).
A tabela dos degraus está no `docs/HISTORICO.md`.

### As QUATRO filas da ponte — escolher a errada é uma regressão muda

Quatro executores de UMA thread, no `companion` do `NativeBridge` (compartilhados
por todas as instâncias; daemon):

| fila | o que roda | a regra |
|---|---|---|
| `io` | só o que responde em MILISSEGUNDOS | **nada de rede**: ali `listFolder`, `otaPending` e `atualizacaoEstado` "mentem baixinho" atrás de um download |
| `transferencia` | downloads de MINUTOS e o `ytDiscard` | UMA thread é invariante: o resgate do `YoutubeGrab` supõe um download por vez |
| `extracao` | metadados de rede (NewPipe, `apkProcurar`) e PDF, de SEGUNDOS | separada de `transferencia` (segundos não esperam minutos); uma thread pela inicialização global do NewPipe |
| `cifra` | só o `cifraHtml` | é MASSA e a `extracao` é TOQUE; uma thread porque `CifraFonte.ultimaTentativa` é o veredito da última busca |

Fora das filas: os cinco métodos do espelho rodam na **main thread**, e
`ytCancel` só escreve um `@Volatile`.

---

## Barramento de comandos e o plano B do BroadcastChannel

O **relay nativo roda SEMPRE em paralelo**: cada comando sai por
`BroadcastChannel` **e** `MessageBus`, e a cópia repetida é descartada em `db.js`
pelo `__mid`. Por extenso: o relay em
[`MODELO-DE-DADOS.md`](docs/arquitetura/MODELO-DE-DADOS.md), o dreno em
[`TELAO-POR-COMANDOS.md`](docs/TELAO-POR-COMANDOS.md), a referência da preview em
[`CONTROLE-TELAO.md`](docs/arquitetura/CONTROLE-TELAO.md) e o `load` em
[`MOTOR-STAGE.md`](docs/arquitetura/MOTOR-STAGE.md) (seções ao fim de cada um; no
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

O telão inteiro em até **três navegadores da rede da igreja**, sem instalar nada
e sem internet: a tela carrega o próprio bundle (servido pelo celular, com a
resolução OTA→APK) e roda o MESMO `/web/display/` (papel `tela`). Viajam
**comandos** (os JSON do barramento, verbatim, por SSE) e **mídia sob demanda**
(`/m/<token>`, com `Range` RFC 7233 feito por NÓS — a inversão da invariante 8).
**O contrato é [`docs/TELAO-POR-COMANDOS.md`](docs/TELAO-POR-COMANDOS.md) — leia
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
[`docs/recursos/SERIES.md`](docs/recursos/SERIES.md)** — abra antes de mexer no
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

O lado nativo já nasce na cor do tema guardado; o que piscava era o DOCUMENTO.
**Por extenso, com o oráculo (`abertura-e-transferencia.test.mjs`), em
[`docs/arquitetura/CONTROLE-TELAO.md`](docs/arquitetura/CONTROLE-TELAO.md)** (seção "A
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
[`docs/arquitetura/DESIGN-SYSTEM.md`](docs/arquitetura/DESIGN-SYSTEM.md).** Abra-o
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

## Divergências entre o caminho web e o nativo

**Regra de escrita:** toda guarda é `if (!window.__NATIVE__) { …web… }`, nunca o
inverso como caminho principal — o navegador é o padrão e o nativo é a exceção
que se declara. **Cada ponto por extenso — o porquê, os nomes, as medidas, as
seções de compartilhamento, microfone, voltar, volume, cast e som do
espelhamento — está em
[`docs/DIVERGENCIAS-WEB-NATIVO.md`](docs/DIVERGENCIAS-WEB-NATIVO.md).** A tabela
abaixo é o mapa: navegador → app.

| ponto | o que difere |
|---|---|
| `sw.js` | não existe no bundle; atualizar é papel do OTA |
| `#startBtn` | oculto no app (sem política de gesto) e no papel `tela` (o gesto é do "Ativar esta tela"); quem o esconde é `display.js` |
| áudio bloqueado | no app a recuperação do `onBlocked` é desativada (falso positivo) |
| pastas do aparelho | SAF no lugar de `showDirectoryPicker()` |
| compartilhamento / link copiado | só no app (`ShareIntake.kt`, só `content://`); o link copiado vem com PERGUNTA antes |
| destinos de um item | no app, vários destinos de uma vez; o vídeo do YouTube baixa UMA vez |
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
- **O microfone ao vivo SAIU (v1.8.89);** o Kotlin ficou. Quem trouxer captura de
  volta traz a escada de três degraus, a guarda de papel e o dreno do
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

## Build e distribuição

`.github/workflows/apk.yml` — o runner `ubuntu-latest` já traz JDK e Android
SDK. **As rotas de publicação, o `web-ota` (sem filtro de caminho e com fila), o
arnês, os prazos, o paralelismo, o stub que trava 60 s, os dois passos de
Chromium, a rede externa bloqueada, o JUnit, a assinatura e o backup estão em
[`docs/BUILD.md`](docs/BUILD.md).** O que se quebra sem abrir:

- **Release:** `git tag vX && git push --tags`, ou *Build APK* → *Run workflow*
  com `release_tag`. O `web-ota` roda com fila e sem cancelamento
  (`concurrency: web-ota`), e sem filtro de caminho por decisão.
- **O arnês** (`tools/arnes.mjs`): `servirEstatico(raiz, antes)`, `esperar` e
  `esperarDb` (**prazo não é asserção**: o estouro devolve a frase, nunca o
  veredito; `waitForFunction` não espera a Promise de um predicado `async`),
  `comTema` e `comModoAvancado` (declaram o estado de partida). **`checar` mora
  em `tools/checar.mjs`, SEM `import`**: os oráculos de Node puro rodam antes do
  `npm ci`.
- **Três processos em paralelo, não `nproc`**: subir o número é subir a carga e
  obriga a repetir a campanha. Diante de um passo lento, a pergunta é "onde está
  o tempo?", arquivo a arquivo — nunca "quantos oráculos são?".
- **Método novo na ponte entra na allowlist do fixture no mesmo lote** — um stub
  que não resolve trava 60 s calado (um arquivo que demore um múltiplo redondo de
  60 s é este defeito até prova em contrário).
- **Node puro, "Oráculos em Chromium" e JUnit BARRAM o build**; só "Preparar o
  Chromium" é `continue-on-error`. **A rede externa não entra num oráculo**
  (`semRedeExterna(ctx)` depois de cada `newContext()`), e um servidor de mentira
  não diverge do de verdade.
- **Assinatura:** keystore fixa por secrets, `-PrequireSigning=true` na Release e
  o `apksigner` reprovando `CN=Android Debug`; `versionCode` = contagem de
  commits + 100000. Perder a keystore é irreversível.
- **Backup:** ficam de fora o bundle OTA, a chave do TLS e `app_webview/` (este
  só da nuvem) — exclusão nova entra nos DOIS arquivos de regras.

### Os oráculos — o MÉTODO

**As tabelas — o que cada oráculo trava — moram em
[`docs/ORACULOS.md`](docs/ORACULOS.md).** São 127 linhas de REFERÊNCIA: ninguém as
lê inteiras, e ninguém deveria. Abra o capítulo para mexer num oráculo, escrever
um novo, ou entender por que uma asserção existe antes de "consertá-la". O que
fica aqui é o MÉTODO, que vale para todos eles.

**As regras de método, que ficam aqui:**

- **LOCALMENTE SE RODA SÓ A VIZINHANÇA DO LOTE; A SUÍTE INTEIRA É DO CI**
  (decisão do operador, 2026-10-15). Antes do commit: os oráculos de Chromium
  que tocam o que o lote mexeu (e os vizinhos que leem o mesmo estado), TODOS
  os de Node puro (somam ~8 s) e a *"Sanidade da base web"* (o bloco abaixo).
  A suíte de Chromium completa NÃO roda na máquina de quem escreve: ela roda
  no `verificar` de `main`, que já é o portão do `web-ota` — um vermelho ali
  segura o bundle, não o publica. **Reprovou no CI, o lote não acabou:**
  conserta, repete a vizinhança e empurra de novo, até o manifesto do canal
  mostrar a versão. A reversão de asserção nova continua valendo inteira.

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
- **E OS ORÁCULOS NÃO SÃO O PASSO INTEIRO.** Antes deles o `verificar` roda a
  *"Sanidade da base web"*, que é um bloco de shell DENTRO do workflow — e o que
  ele trava não está em `tools/` nenhum: a forma do `version.json`, o `minShell`
  contra o `SHELL_VERSION` lido do próprio Kotlin, o `shellTag` batendo com a
  versão, as três casas do número, e o **teto de 120 caracteres por item do
  `notas.json`** (*"a lista do diálogo é uma linha do tempo, não um texto"*).
  Rodar só os oráculos devolve placar cheio e reprova no CI — aconteceu na
  v1.8.51, com 98/98 locais e o `web-ota` PULADO por um item de 127 caracteres.
  **Rodar o mesmo texto, sem copiá-lo** (copiar seria a divergência que o arnês
  existe para fechar):

  ```bash
  python3 - <<'PY' > /tmp/sanidade.sh
  s = open('.github/workflows/apk.yml', encoding='utf-8').read()
  i = s.index('      - name: Sanidade da base web (sintaxe do JS)')
  b = s[i:s.index('\n      - name:', i + 10)]
  c = b[b.index('        run: |\n') + len('        run: |\n'):]
  print('\n'.join(l[10:] if l.startswith(' ' * 10) else l for l in c.split('\n')))
  PY
  bash /tmp/sanidade.sh
  ```
- **A REVERSÃO É UM PASSO, NÃO UMA BOA PRÁTICA.** Toda asserção nova roda
  **duas vezes** antes do commit: com o conserto, e com ele desfeito. Sem isso a
  asserção pode ser uma TAUTOLOGIA — passar nas duas versões —, e isso não é
  hipótese: aconteceu DUAS vezes na revisão de 2026-09-07, e uma delas passou
  porque o prazo de 8 s era maior que a duração da faixa do cenário, então a
  preview chegava ao fim sozinha e o app avançava pelo caminho de sempre. **Uma
  asserção que não pode reprovar o defeito que ela nomeia é pior que asserção
  nenhuma:** ela responde *"isso está coberto?"* com um sim que não existe.

  **E É A REVERSÃO QUE ESCOLHE A CÉLULA E A RÉGUA, não o bom senso** (v1.8.65,
  onde ela pegou DUAS tautologias num lote só). Uma asserção geométrica mede
  numa largura e numa escala de fonte, e a maioria delas não alcança a decisão:
  medido, o rodapé de Configurações cabe folgado a 430×1× e a 390×1×, e a
  asserção do recuo passava ali com e sem o conserto — só a 360×1,25× ela
  reprova. **A RÉGUA tem o mesmo problema:** medir `scrollWidth` do `<span>`
  para provar que um rótulo não é cortado nunca acusa nada, porque o span é do
  tamanho do próprio texto e quem é estourado é o PAI. Quando a reversão passa,
  a pergunta não é *"a asserção está errada?"* — é *"que célula, e medindo o
  quê?"*.

  **E ELA TAMBÉM ACHA DECLARAÇÃO QUE NÃO FAZ NADA.** No mesmo lote, um
  `min-width: max-content` foi escrito para segurar o rótulo, ganhou comentário
  e asserção, e a reversão mostrou que removê-lo não move um pixel: um item flex
  já nasce com `min-width: auto`, o tamanho mínimo automático, e com
  `white-space: nowrap` isso É o rótulo inteiro. **Saiu a declaração, a asserção
  e o comentário, os três juntos** — um comentário que credita a peça errada
  manda o próximo leitor proteger o lugar errado, que é o defeito mais caro que
  este repositório sabe produzir em documentação.
- **A REVERSÃO SE DESFAZ COM UMA CÓPIA, NUNCA COM O GIT.** `git checkout
  <arquivo>` restaura do HEAD e **apaga o trabalho não commitado do lote inteiro
  naquele arquivo** — aconteceu, e custou refazer quatro edições. `cp` de um
  backup feito antes da reversão, e pronto.
- `node --check` prova que o arquivo é PARSEÁVEL, não que o app funciona — a
  v5.121 saiu com um botão chamando função apagada, sintaxe perfeita e CI verde.
  O canal OTA publica direto para a frota e o watchdog **não evita o primeiro
  estrago** (`beginSession()` arma o `pending` e SERVE o bundle; só o lançamento
  seguinte descarta): um lançamento quebrado por aparelho, garantido.

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

- **O APK NÃO É RECURSO RESTRITO** (diretriz do operador, 2026-10-30: *"sempre
  que for necessário uma nova versão do APK, faça. O OTA é o principal meio de
  atualização, mas o APK não é um elemento exclusivo ou restrito, pode usar
  conforme a necessidade normalmente"*). Quando o conserto CERTO mora no Kotlin,
  ele é feito no Kotlin, no mesmo lote, com `shellTag` e Release — nunca se
  entrega um contorno só de web no lugar dele, nem se deixa a metade do shell
  "para depois". O OTA continua sendo o caminho normal para o que é web.
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

- **SEMPRE deixar a PÁGINA anunciando a versão que acabou de sair.** É
  automático (`pages.yml`, por `workflow_run` no *Build APK*; a VERSÃO vem do
  manifesto do canal OTA, o tamanho e a URL do `.apk` da Release), e o trabalho é
  NÃO QUEBRAR o automático: não trocar `workflow_run` por `on: release`;
  conferir o passo *"A versão que o aparelho vai rodar"* depois de publicar (um
  `::warning::` ali é a página com a versão do APK); todo caminho dentro de
  `site/` é RELATIVO; na página o recurso se chama "conectar um computador"; e o
  download só existe no Android (classificação BINÁRIA no `<head>`, com falha
  ABERTA). **Por extenso em [`docs/BUILD.md`](docs/BUILD.md)**, seção "A página
  do site".

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
  puro no web. **Quatro exceções, todas declaradas:** `@aiden0z/pptx-renderer`
  (`assets/web/vendor/`, `import()` dinâmico), `NewPipeExtractor` (pin
  explícito; ler o CHANGELOG antes de reescrever extração à mão), JUnit e
  Playwright (estes dois sem um byte no APK; subir o pin do Playwright obriga a
  repetir a campanha de determinismo). A justificativa de cada uma está em
  [`docs/BUILD.md`](docs/BUILD.md), seção "As dependências". Uma quinta exceção
  precisa da mesma justificativa: um problema que não se resolve de outro jeito,
  e a manutenção paga por quem publica a biblioteca.

### Diagnóstico

**As regras por extenso — com os casos medidos que as criaram — estão em
[`docs/DIAGNOSTICO.md`](docs/DIAGNOSTICO.md).** Abra-o antes de mexer na
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

  **O formato é o defeito**: um bloco por lote é um log, e um log só cresce. A
  casa da regra permanente é a seção canônica ou a TABELA DE ORÁCULOS — e uma
  regra sem casa é enxertada lá ANTES de o bloco sair.

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
| `controle/controle.js` | `WEB_VERSION` | **é o que a UI mostra**: `renderVersionLabel()` escreve a ÚNICA casa que sobrou, o rótulo de versão (`#versaoBtn`, texto ao lado do título) no CABEÇALHO de Configurações — foi o rodapé da folha e, na v1.12.49, a Verificação (a badge do cabeçalho do Cronograma saiu na v1.8.66, para o botão de limpar a lista, e a do Modo Fácil na v1.11.15, para o nome do app) |
| `controle/index.html` | `<span id="appVersion">` | o que aparece antes do primeiro render — e a única versão visível num shell sem `appVersion()` |

Esquecer o `WEB_VERSION` é o erro **silencioso** (o bundle novo chega e o
aparelho exibe a versão antiga, justamente a leitura que serve para diagnosticar
se o OTA chegou); esquecer o `version.json` é o erro **mudo** do outro lado (nada
chega a aparelho nenhum). O `versionCode`/`versionName` do APK vêm do CI.

**Versão atual: base web v1.13.16 · APK v1.13.16** · `SHELL_VERSION` **83** ·
bundle com `minShell: 83` e **`shellTag: "v1.13.16"`** — o shell 83 é o **PISO**:
todo método da ponte existe, e não há guarda de versão no lado web. **Este lote
pede Release** (a v1.13.16 mudou `java/`: o candidato
`MediaRouter2.showSystemOutputSwitcher` na saída de áudio e a forma de retorno do
`saidaDeAudioAlvo`). O que cada lote trouxe está no `docs/HISTORICO.md`, nunca
aqui.

- **O `shellTag` ACOMPANHA A ÚLTIMA VERSÃO, NÃO A QUE MEXEU NO KOTLIN** — o CI
  exige `shellTag == 'v' + version`. Um lote só de web publicado DEPOIS de um
  lote de shell ainda sem Release HERDA a obrigação (zerá-lo publicaria o bundle
  sozinho e deixaria o conserto do shell para trás, calado); com a Release já
  publicada, um lote só de web não declara. **Conferir a Release é parte de
  decidir.** A Release é UMA, cortada de `main` na tag mais nova, e carrega todo
  o Kotlin acumulado.
- **O gatilho da Release é o `java/` (e `res/`, o manifesto), não a ponte:**
  Kotlin que muda sem método novo pede Release; ENCOLHER a ponte pelo web não
  pede. Os módulos de `assets/web/` não são superfície do `SHELL_VERSION` — viajam
  dentro do bundle.
- **O modo de falhar é o caro:** uma tag declarada cuja Release nunca sai segura
  o canal PARA SEMPRE, em silêncio (a única pista é a linha no resumo do run), e
  deixá-la apontando para a tag do lote ANTERIOR é o mesmo defeito. Declarada, a
  Release se dispara depois do merge em `main`: Actions → *Build APK* →
  `release_tag` = a MESMA tag.
- **Um `apk` reprovado não pula o `web-ota`** (o `if:` dele ignora o resultado do
  `apk`; o `needs` está pela ORDEM): quem segura é o HOLD do `shellTag`, e o
  desfecho é um job VERDE que não publicou. Um lote que toca `java/` confere o
  `apk`. Por extenso em [`docs/BUILD.md`](docs/BUILD.md).
- **Este bloco é a QUARTA CASA da versão** e tem oráculo
  (`docs-coerentes.test.mjs` compara esta linha com o `version.json`).
  **Renumerar um lote mexe nas QUATRO casas** (`version.json`, `WEB_VERSION`,
  `#appVersion` e esta linha), no `shellTag`, no `notas.json` e em toda chave que
  carregue o número — o OTA ignora, em silêncio, um bundle cuja versão não seja
  MAIOR que a instalada.

### Onde procurar

| pergunta | onde |
|---|---|
| como isto funciona? | aqui, ou o capítulo certo de `docs/arquitetura/` (mapa em `docs/ARQUITETURA-WEB.md`) |
| por que é assim? / já foi tentado? / foi revogado? | `grep -n "<termo>" docs/HISTORICO.md` |
| o contrato do telão nas telas da rede | `docs/TELAO-POR-COMANDOS.md` |
| o banco de hinos e Bíblia | `docs/FONTE-DE-DADOS-LOUVORJA.md` |
| onde mora este arquivo? o que ele faz? | `docs/ESTRUTURA.md` |
| o que muda entre navegador e app? | `docs/DIVERGENCIAS-WEB-NATIVO.md` |
| o arnês, o CI, a assinatura, o backup, a página do site | `docs/BUILD.md` |
| a Verificação do Sistema e o Registro | `docs/DIAGNOSTICO.md` |
| o que o operador pediu e ainda não foi feito? | `docs/PEDIDOS-EM-ESPERA.md` — pacotes; perguntar qual seguir antes de começar |
| "faça uma das etapas de revisão" / a revisão profunda em etapas | `docs/REVISAO-PROFUNDA.md` (o plano e a regra que ESCOLHE a etapa) e `docs/revisao/REGISTRO.md` (a fila e o andamento) — uma etapa por sessão, a sessão escolhe sozinha |

