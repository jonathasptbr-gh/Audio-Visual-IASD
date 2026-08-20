<!-- Capítulo de docs/ARQUITETURA-WEB.md. O índice e as regras
     de desenvolvimento ficam lá; este arquivo é só este capítulo. -->

## Display

Interface mínima: wallpaper + layer de imagem + layer de vídeo + camada de
letra + camada de texto. **Não há iframe** — o embed do YouTube saiu na v5.212
(ver a seção "YouTube — o EMBED SAIU", abaixo).

Escuta o BroadcastChannel e repassa os comandos para `stage.handle()`. Ao
inicializar, **não** recarrega nem toca a última mídia
sozinho — `restore()` aplica as **preferências visuais** (fade, fundo da letra,
preenchimento, wallpaper) e envia `display-ready`; o Display abre sempre no
wallpaper (ponto inicial), esperando um comando explícito. A inicialização do
sistema precisa ser **controlada** (nenhuma mídia deve começar a tocar sozinha
ao abrir o app) — quem decide se retoma o que estava tocando é o **Controle**,
ao receber `display-ready` (com base no que ELE sabe que estava tocando, não em
algo persistido pelo próprio Display).

**`display-ready` sai num `finally`, e as preferências ficam num `try`.**
ANUNCIAR-SE não pode depender delas: toda a reconexão do sistema pende desse
comando (é ele que dispara o `resendSceneToDisplay`), então se uma leitura do
IDB rejeitasse — upgrade bloqueado, armazenamento despejado, transação
abortada — a `Presentation` recriada depois de um blip do espelhamento ficava
parada no wallpaper, sem nada no Controle explicando e sem outra saída além de
reiniciar o app. Perder o fundo da letra ou o wallpaper é um defeito visível e
recuperável; perder a reconexão, não. No `catch` o Display segue nos padrões
(preto na letra, `contain` no fit, gradiente no fundo).

**Não há service worker aqui.** Havia um bloco que registrava `sw.js` e
recarregava a página no `controllerchange` (adiando até o telão ficar idle),
mas o `sw.js` saiu do bundle junto com os andaimes dos dois PWAs: no navegador
o `register` devolvia 404 e a promise era engolida pelo `.catch`; no app o
bloco nem chegava a rodar. Código morto nos dois contextos, e ainda sugerindo
ao próximo leitor uma atualização que não existia. Quem atualiza a base agora é
o **OTA do shell**, aplicado no PRÓXIMO lançamento — justamente para nunca
recarregar o WebView do telão no meio de um culto. O mesmo bloco também saiu do
Controle, onde `swReg` ficava eternamente `null` e o ramo de "checar
atualização ao retomar" nunca executava.

**Toque único ao abrir (`#startBtn`, "Ligar Sistema") — só no navegador.**
No app ele fica **oculto** (`window.__NATIVE__`): o WebView roda com
`mediaPlaybackRequiresUserGesture = false`, e uma TV não recebe toque nenhum.
No navegador a área de toque cobre a tela inteira (z-index acima de tudo,
inclusive do wallpaper e do escudo do YouTube — qualquer toque serve) e some
para sempre após o primeiro toque; um `.start-pill` central (preenchido no
cor da marca — `--brand` —, com o texto no escuro do app, cantos
arredondados e halo em `--accent-glow`) é só a pista visual de "isto é
clicável" — sem
ele o texto flutuando no preto não parecia um botão. **Ele APENAS ativa o
Display** (destrava o áudio de terceiros/YouTube com o gesto real): não abre o
Controle nem redireciona pra lugar nenhum. (Chegou a existir uma chamada a
`requestFullscreen()` + trava de orientação via Screen Orientation API **no
Display** — removida: na prática regrediu o lançamento do Controle e nunca
engajou. A trava de paisagem só reapareceu, com sucesso, na **preview do
Controle** — lá ela roda já dentro de um `requestFullscreen` de elemento, que é o
contexto em que a Screen Orientation API é permitida.) Ao tocar, a classe `.confirming` dispara uma
animação rápida (~0,3s: pill cresce levemente e esmaece, fundo vai a
transparente) antes do elemento sumir de fato (`hidden = true` só depois do
`setTimeout` correspondente) — sem esse feedback, o overlay sumia no mesmo
instante do toque e a ação parecia não ter surtido efeito nenhum. Existe
porque **autoplay COM SOM exige um gesto real do usuário** na página — é a
política do navegador, e vale para a mídia da própria origem (o embed de
terceiros saiu na v5.212). Esse gesto **não pode ser simulado via JS** (é assim
que o navegador garante que é uma ação real da pessoa) — por isso o botão, em
vez de tentar automatizar. O toque é um `pointerdown` normal, que já borbulha
para o listener de recuperação de áudio do stage.

**Ele nasce OCULTO em dois casos** (`display.js`:
`if (window.__NATIVE__ || TELA) startBtnEl.hidden = true;`), e por razões
OPOSTAS: no app nativo não há política de gesto
(`mediaPlaybackRequiresUserGesture = false`) e uma TV não recebe toque; no papel
`tela` há política, mas o gesto já foi gasto pelo "Ativar esta tela" — deixá-lo
aparecer poria DOIS overlays de gesto na mesma página.

**Áudio sem toque (recuperação automática — só mídia local do stage):** ao
contrário do `#startBtn` acima (que existe só por causa do YouTube), mídia
local **não precisa de nenhum toque prévio** — não há overlay de unlock
bloqueante para ela. Se a política de autoplay do navegador bloquear
som sem gesto num vídeo/áudio local, ele **começa mudo** (sempre permitido — o
conteúdo aparece no telão sem toque) e a recuperação automática religa o áudio
em retentativas de ~5 s (`setMute(false)`, detectando se o navegador pausou).
**No app este mecanismo é desativado** (`window.__NATIVE__`): sem política de
gesto no WebView, qualquer detecção seria falso positivo. **E a guarda de
nativo fica no próprio `onBlocked`**, não só dentro do `beginAudioRecovery()`:
o handler mutava o stage *antes* de descobrir que era falso positivo, e como o
`beginAudioRecovery` devolve cedo no app, `audioBlocked` continuava `false` e
nem o `tryRestoreAudio` nem o comando `audio-retry` faziam qualquer coisa. O
telão ficava **sem som até o próximo load**, e o Controle não recebia sinal
nenhum — o `display-status` só carrega `audioBlocked`, que ali era falso.
No navegador, a primeira retentativa costuma resolver. **Nada é exibido no
telão**: o estado vai no campo `audioBlocked` do `display-status`; no
**Controle**, o
**botão de mudo do mixer** vira indicador (estado `.blocked`, âmbar pulsante,
ícone de volume off) e **atalho**: o clique envia `audio-retry` (retentativa
imediata) em vez de alternar o mudo. Qualquer gesto real no Display
(toque/tecla — `pointerdown`/`keydown` no documento) religa o áudio na hora. O
comando `mute` do operador encerra a recuperação. **Este mecanismo não se
aplica ao YouTube** — ver seção abaixo.

### Microfone ao vivo, no lado do Display

O operador segura o botão no Controle, o comando `mic` atravessa o canal e é o
**Display** que abre o microfone e o reproduz na projeção — um `MediaStream`
não é clonável e portanto **não atravessa o BroadcastChannel**, então quem
reproduz tem de ser quem captura. O caminho é `getUserMedia →
MediaStreamSource → GainNode → destination`, com rampa curta na entrada e na
saída (cortar no meio de uma palavra estala na caixa de som). A parte nativa
(permissão `RECORD_AUDIO`, `onPermissionRequest` do WebView) está em
[`CLAUDE.md`](../CLAUDE.md).

**A captura em voo tem um token (`micSeq`), e `micStream` não servia como
guarda.** Ele só existe DEPOIS de o `getUserMedia` resolver, e o primeiro
push-to-talk da sessão demora (permissão + `onPermissionRequest`). Um
on→off→on nesse intervalo — o operador aperta, não ouve nada, solta e aperta de
novo — disparava um **segundo** `getUserMedia` com o primeiro ainda pendente;
quando os dois resolviam, o segundo sobrescrevia as referências e o primeiro
ficava com as trilhas vivas e o ganho ligado ao `destination`, **sem ninguém
para pará-lo**: microfone aberto no telão (e o indicador de gravação do Android
aceso) até o WebView do telão ser recriado.

Três consequências disso, e cada uma cobre um `await` diferente:

- `stopMic()` **incrementa o token antes da saída antecipada**: com `micStream`
  ainda nulo não há nada a derrubar, mas é preciso registrar que o operador
  soltou o botão — senão o `getUserMedia` pendente vira um microfone aberto que
  nenhum comando desliga.
- `startMic()` reconfere o token **duas vezes**: depois do `getUserMedia` e
  depois do `micCtx.resume()`. O resume é outro `await`, e um `stopMic()` ali
  no meio passava batido — a continuação ligaria a fonte ao `destination`
  depois de o botão já ter sido solto.
- ao parar, o `AudioContext` é **suspenso, não fechado**: fechá-lo exigiria
  criar outro no aperto seguinte, e é justamente esse custo (e a latência de
  abertura) que se quer evitar num push-to-talk. Suspenso, ele para de segurar
  a saída de áudio — e só é suspenso se ninguém tiver reaberto o microfone
  nesse meio tempo.

#### `NotReadableError` não é "outro app está usando" (v5.142)

O relato foi o push-to-talk falhando com **"o microfone está em uso por outro
app"** num aparelho em que nenhum outro app gravava — e a mensagem era nossa, do
mapeamento de `NotReadableError`. O nome do erro engana: ele é o *"não consegui
abrir o dispositivo"* genérico do WebRTC, e no Android a causa comum aqui não é
disputa entre apps, é o **processamento pedido**.

Com `echoCancellation`, o Chromium abre o `AudioRecord` em
`VOICE_COMMUNICATION` para usar o cancelador de eco do hardware — uma sessão de
**voz**, que o sistema recusa quando a saída de áudio está em outro caminho. Que
é exatamente o caso deste app durante um culto: espelhamento ligado, telão
recebendo o som.

`startMic` passou a tentar **três vezes, da melhor para a que sempre abre**:

1. `echoCancellation` + `noiseSuppression` + `autoGainControl` (o de sempre);
2. os três **desligados** — força a fonte `MIC`, sem sessão de voz;
3. `audio: true`, cru.

A ordem é deliberada: o cancelamento de eco fica em primeiro porque num culto uma
realimentação é um estrago imediato e público. Só se ele não abrir é que se desce
— e um push-to-talk que funciona com risco de microfonia é melhor que um que não
funciona, desde que fique registrado, que é o que a linha `microfone SEM
cancelamento de eco` do Registro do telão faz.

**`NotAllowedError`/`SecurityError` não descem a escada**: permissão negada é
resposta do sistema (ou do `MicChromeClient`) e não melhora com menos
processamento — insistir só gastaria duas chamadas para dar o mesmo erro. E a
mensagem ao operador deixou de nomear uma causa que quase sempre estava errada:
chegar até ela agora significa que as três tentativas falharam.

> **Não foi reproduzido aqui.** A condição depende do roteamento de áudio do
> aparelho com espelhamento ativo, que não existe neste ambiente. A escada é a
> hipótese mais provável e não custa nada quando ela está errada — se o erro
> persistir, o Registro do telão passa a dizer qual das três tentativas caiu e
> com que nome, que é o que faltava para responder isso sem adivinhação.

### YouTube — o EMBED SAIU (v5.212), e o que ficou no lugar

**Aqui havia ~95 linhas descrevendo, no presente, um player que não existe
mais.** Elas documentavam a IFrame Player API oficial (`loadYtApi`,
`ytApiPromise`, `YT.Player`, `playerVars`, `createYtHost`, `ytKillCaptions` com
`unloadModule`, o escudo anti-UI, o vigia `ytWatchResume`), e cada uma delas
mandava o leitor procurar um símbolo apagado. Ficam o que foi APRENDIDO e o
endereço do que existe hoje.

**Por que ele saiu.** O KDoc do `display.js` dizia que o risco de
supply-chain do `<script src="https://www.youtube.com/iframe_api">` era
"ACEITO conscientemente" — e descrevia METADE do problema.
`addJavascriptInterface` injeta o objeto em **todas as frames**, iframes de
outra origem inclusive; no telão a ponte nasce com `host = null` e o estrago
seria limitado, mas **o mesmo embed era criado no CONTROLE**, para a preview, e
lá a ponte é a completa (`pickFolder`, `listFolder`, `pickDoc`, `openExternal`,
`espelhoLigar`, `apkInstalar`). A invariante 9 protegia a metade errada.

**O que saiu junto, e é o argumento inteiro:** um segundo motor de transporte
(`ytHandle` ao lado do `stage.handle`), um segundo emissor de status, uma
segunda máquina de mudo que ignorava o `forceMuted` do stage, uma cortina
própria e um `if (yt)` em quinze pontos — ~540 linhas no `display.js` e ~180 no
`controle.js`. Com eles saíram também a dependência de rede/youtube.com **em
cena**, o `document.hidden` que pausava o player com o app minimizado, e a cena
que ia MUDA para as telas da rede porque o Web Audio não alcança um iframe
alheio.

**Quem toca YouTube hoje** é o caminho PRÓPRIO, que já era o preferido:
transmissão direta (`AVNative.ytStream` → `shared/mse.js`, um `MediaSource`
alimentado pelo `StreamProxy`) e, falhando ela, o arquivo baixado pelo
`YoutubeGrab`. Nos dois casos o telão toca um `<video>` COMUM, com fade,
cortina, `MediaSession` e barra de graça — e **zero pixel de YouTube na
projeção**. Um registro `kind: 'youtube'` (o link sem bytes) deixou de ser
tocável como link e passa a ser RESOLVIDO no toque, dentro do `send`
(`resolverLinkYoutube`). Ver "A via do arquivo baixado", abaixo, e a seção da
transmissão direta.

**A lição de método, que é o que sobrevive a qualquer transporte:** três
versões (v5.75–v5.77) atacaram "o telão para ao minimizar" supondo que o
problema era do YouTube — vigia de pausa, `ytWatchResume`, cota de tentativas —
e as três erraram. A prova veio quando uma mídia **local** parou do mesmo
jeito. A causa real está na seção seguinte.
### O telão parava ao minimizar o app — a causa real (v1.28)

Três versões atacaram isto por hipótese, e as três erraram, porque todas
supunham que o problema era do **YouTube**. A prova de que não era veio quando
uma mídia **local** — um arquivo baixado, tocando num `<video>` comum — parou
exatamente do mesmo jeito.

Com isso o alvo mudou: o que para é o **telão inteiro**, e as causas possíveis
são três, todas do lado nativo. A v1.28 fecha as três de uma vez, porque
distingui-las sem instrumentação já custou três tentativas:

1. **O WebView do telão era DESTRUÍDO ao minimizar.** `StagePresentation`
   chamava `release()` no `onStop()` — e `Presentation` é um `Dialog`, cujo
   `onStop()` chega em situações que não são "o telão acabou", entre elas o app
   sair da frente. Isso apagava a projeção inteira; ao voltar, o
   `syncPresentation` encontrava a Presentation fora do ar e criava OUTRA, com
   o telão recarregando do zero. Quem derruba o telão são os donos do ciclo de
   vida, e eles já faziam isso explicitamente.
2. **Metade da visibilidade continuava vazando.** O Chromium calcula a
   visibilidade a partir da janela **e** da View; a v1.26 mentia só sobre a
   primeira. `KeepVisibleWebView` agora cobre `onVisibilityChanged` também.
3. **A suspensão do renderer.** `WebView.onResume()`/`resumeTimers()` chamados
   do `onStop()` da Activity — o instante exato em que o sistema desaceleraria
   tudo —, mais `setRendererPriorityPolicy(IMPORTANT, waivedWhenNotVisible =
   false)`, que é literalmente "não abra mão da prioridade só porque esta View
   não está visível".

#### E o caso relatado era no CELULAR, não no telão (v1.29)

Depois de tudo acima, veio a informação que faltava: a pausa acontecia com a
**mesa de som** ligada — o áudio saindo pelo próprio aparelho. Nesse modo quem
toca é o `<video>` da **preview**, no WebView do **Controle**, e não o do telão.
As três correções anteriores protegiam o WebView errado.

> **E ISTO VOLTOU A TER DONO NA v5.215**, com uma diferença que precisa estar
> dita: sem tela nenhuma conectada, quem toca é de novo o `<video>` da preview,
> no WebView do **Controle** — mas o `AVNative.keepAudioAlive` (e o
> `setAudioAlive` do shell) **saiu na v5.189 e não voltou**. O que segura o caso
> hoje é o que já segurava o defeito relatado quando ele foi diagnosticado:
> **áudio audível isenta a página do estrangulamento** — é a mesma observação
> que o `CLAUDE.md` registra pelo avesso na nota do `snoopDisplayStatus` ("ligar
> o áudio no próprio celular fazia o defeito sumir") — e o `SessionService`
> mantém o processo vivo enquanto houver cena. Se um dia o louvor calar ao
> minimizar o app com o som saindo do celular, é aqui que a resposta começa, e o
> caminho é o `manterVisivel` + `RENDERER_PRIORITY_IMPORTANT` descrito acima.
> Ele custa um degrau de `SHELL_VERSION` e uma Release.

E o Controle ser estrangulado em segundo plano é, normalmente, o comportamento
CERTO: ele é a mesa de comando, e o som está no telão — é justamente o que o
`snoopDisplayStatus` da ponte existe para contornar. **Não há interruptor
nenhum hoje:** `manterVisivel` tem dono único (`WebViewFactory.create`, com
`keepVisible = true`) e é escrito **só para o telão**; `keepAudioAlive`,
`setAudioAlive` e `setStandalone` não existem em lugar nenhum do repositório.

**E, desta vez, uma CAIXA-PRETA.** `diag()` em `display.js` mantém um anel dos
últimos 60 eventos do telão (visibilidade, `pagehide`, `freeze`/`resume`, e cada
`play`/`pause` do `<video>` — separando a pausa COMANDADA da espontânea). O
Controle pede o despejo (`diag-ask` → `diag-dump`) ao abrir **Configurações**,
onde ele aparece como texto. É a única janela para o que acontece com a
projeção enquanto o celular está fora da frente: não há console, não há logcat,
e o Controle está estrangulado justamente nesse intervalo. Se voltar a parar,
o registro diz QUAL das três causas foi — em vez de mais uma rodada de palpite.

### Onde o aviso de download aparece (v5.84)

O cartão sobre a preview diz **"isto vai entrar em cena"**. É a mensagem certa
quando o toque foi TOCAR, e a errada quando ele foi só ADICIONAR: um vídeo
compartilhado que apenas entra no Cronograma não vai ao telão a seguir, e
anunciar o download ali insinua o contrário. A regra passou a ser **o aviso mora
onde o resultado vai aparecer**:

| O que o toque pediu | Onde o aviso aparece |
|---|---|
| Tocar uma música do acervo (cantada, playback, só a letra) | cartão sobre a **preview** (`previewBusy`) |
| Adicionar uma música do acervo a uma lista | miniatura da **linha do acervo** (`setSongRowBusy`) |
| Compartilhar um link do YouTube no **simplificado** | **preview** — ali o item vai direto ao telão |
| Compartilhar um link do YouTube no **avançado** | **linha do Cronograma** (`libBusy`) |
| Converter um item de player que já está na lista | **a própria linha** dele |

O caso novo é o do Cronograma, e ele tem um detalhe: enquanto o arquivo baixa,
**a linha ainda não existe**. Por isso ela é criada PROVISÓRIA — o operador vê o
item entrar na lista na hora, com o anel no lugar da miniatura e o percentual ao
lado, e ela vira o item de verdade quando os bytes chegam. Duas consequências
que o código trata explicitamente:

- **A lista vazia também desenha a provisória.** Sem isso, o primeiro vídeo
  importado num Cronograma vazio mostrava "Cronograma vazio." durante todo o
  download — a pior frase possível naquele momento.
- **O percentual repinta SÓ o texto**, sem refazer a lista: ele chega a cada
  megabyte, e um `load()` por atualização reconstruiria dezenas de linhas (com
  object URLs de miniatura) enquanto o operador rola a lista.
- Enquanto baixa, o botão de converter **sai da linha**: ele já ficava
  desabilitado, mas desenhar "baixar" ao lado de um anel girando é oferecer a
  ação que está em curso.

### A via do arquivo baixado — v5.78, e a extração NATIVA da v5.81

O embed do YouTube **pausa sozinho quando a página fica oculta**, e é isso que o
Android faz com o telão no instante em que o operador minimiza o app. A regra
roda dentro de um iframe de **outra origem**: nenhum código nosso a alcança.
Foram tentadas as duas únicas saídas de fora, e as duas falharam em aparelho:

1. **Mandar tocar de novo** (`ytWatchResume`, v5.77) — o comando chega, o player
   pausa outra vez.
2. **Impedir o WebView do telão de se declarar oculto**
   (`WebViewFactory.KeepVisibleWebView`, v1.26 do shell: `onWindowVisibilityChanged`
   sempre reporta `VISIBLE`). Ficou no código — é correto por si só e barato —,
   mas não bastou.

A resposta que não depende de vencer o player deles é **não usar o player
deles**: o link vira um **arquivo de vídeo no aparelho**, e daí em diante é uma
mídia como qualquer outra — o mesmo `<video>` dos arquivos importados, com fade,
seek, playlist, cortina, `MediaSession` e reprodução em segundo plano que já
funcionam há versões. De quebra: sem anúncio, sem legenda, sem UI de terceiro no
telão e **sem depender da rede durante o culto**, que num salão de igreja é o
ganho maior de todos.

#### Quem extrai é o APARELHO (v5.81)

A v5.78 pedia isso a um servidor [Cobalt](https://cobalt.tools). **Não
funcionou**, e o motivo não é o Cobalt — é a categoria: Cobalt, Invidious e
Piped rodam em **IP de datacenter**, que é exatamente o que o YouTube bloqueia.
Nenhuma lista de instâncias, por melhor que seja, muda isso; foi por isso que
nem a instância digitada à mão nem a descoberta automática (v5.80) entregaram o
vídeo.

Escrever o extrator à mão também não serve: os **PO Tokens** de hoje são
atrelados a cada vídeo e assinados por BotGuard/DroidGuard, e o atalho
`android_sdkless` que os dispensava foi removido. Seria manutenção semanal,
quebrando sempre num domingo.

O que funciona é extrair **no aparelho**: a requisição sai do IP do chip do
operador, que o YouTube não bloqueia — é por isso que o NewPipe funciona no
celular enquanto os servidores públicos apanham. `YoutubeGrab.kt` faz isso com
o `NewPipeExtractor` (a única dependência de terceiro do projeto, e a exceção
está declarada no `CLAUDE.md`), e `AVNative.ytFetch(url, onProgresso)` entrega
ao lado web uma **URL servível** (`/saf/<token>`) — daí para a frente o caminho
é o mesmo de um arquivo compartilhado: `fetch` + `Blob` + `addMedia`, e
`ytDiscard` apaga o intermediário para o vídeo não ficar duas vezes no aparelho.

- **Some o problema de CORS**: o `fetch` do WebView nunca alcançaria o
  `googlevideo.com`, que não manda os cabeçalhos — era por isso que o caminho do
  Cobalt precisava de `alwaysProxy`.
- **MP4 de até 1080p** (v1.44 para o remux, v1.49 para ele passar a funcionar de
  verdade). O YouTube reserva as resoluções altas para faixas separadas de vídeo
  e áudio; juntá-las é o `MediaMuxer` da plataforma (`MuxMp4.kt`), cópia de
  amostras e não recodificação — nada de ffmpeg embarcado. O progressivo segue
  como piso quando a montagem não sai; ver a série "O cliente visionOS destrava
  o 1080p" acima.
- **Sem `PoTokenProvider`, por enquanto.** O extrator faz "o melhor esforço"
  sem ele; montá-lo exige rodar o desafio do BotGuard num WebView — o app tem
  dois, então é factível, mas é outra empreitada. Se um vídeo resistir, o item
  fica como **LINK** e é retentado no toque seguinte (`resolverLinkYoutube`) —
  não há player embutido para o qual cair desde a v5.212.
- **Exige shell ≥ 16.** Num anterior a função devolve null na hora e o fluxo
  segue como antes.

#### O Cobalt saiu (v5.82)

Ele foi a tentativa das versões 5.78–5.80 e **não funcionou em aparelho**, pelo
motivo que está no começo desta seção: IP de datacenter. Ficar como "segunda
opção" seria manter uma tela de configuração que não leva a lugar nenhum e um
caminho de código que ninguém exercita — os dois envelhecem calados. O plano B
de hoje é o item virar **LINK**, retentado no toque seguinte.

### O que o watchdog do OTA exige DESTA base (`shared/native.js`)

O mecanismo do watchdog é do shell (`CLAUDE.md`, "OTA da base web"), mas o
sinal de "o bundle subiu inteiro" é dado **daqui**, e ele impõe um contrato
sobre o código do Controle que um refactor pode quebrar sem perceber.

Até a v5.47 a única condição era `window.AVDB` no evento `load`, e o
raciocínio registrado era sobre "um erro de sintaxe em `db.js`" — **o arquivo
menos provável de quebrar**. A ordem dos scripts é `native.js` → `db.js` →
`stage.js` → `louvorja.js` → `bible.js` → `controle.js`: um erro de sintaxe (ou
um `throw` de inicialização) em qualquer um dos quatro últimos aborta **só
aquele script**, o `load` dispara do mesmo jeito, `AVDB` continua lá — e o
bundle quebrado era carimbado como bom e servido **para sempre**, exatamente o
oposto do que o mecanismo existe para fazer. Como o OTA publica a cada push em
`main` e o `controle.js` é de longe o que mais muda, esse era justamente o caso
provável.

O sinal agora é "**o app está de pé**", e cada peça cobre um trecho da cadeia
que a anterior não cobre:

1. **papel `'controle'`** — o WebView do Display carrega bem menos código (não
   carrega `controle.js` nem `louvorja.js`), então deixá-lo confirmar validaria
   um bundle cujo Controle nunca chegou a rodar. E o Display é o caso **normal**
   de culto (TV conectada), ou seja, confirmaria quase sempre no lugar do
   outro. Sem TV o Display nem existe: quem confirma é sempre o Controle, que é
   quem precisa funcionar.
2. **`AVDB` e `createStage`** — os dois módulos compartilhados, cada um
   publicando seu global no fim do arquivo.
3. **`window.__avBack`** — só existe se o `controle.js` foi parseado por
   inteiro **e** executado até quase o fim. É a mesma função que o botão voltar
   do Android consulta, ou seja, um contrato que já existe, não um marcador
   inventado para o watchdog.
4. **um `<li>` dentro de `#playlist`** — o HTML entrega esse `<ul>` **vazio**;
   quem o preenche é `renderPlaylist()`, chamado por `load()` dentro do `init()`
   assíncrono. É o que prova que a inicialização terminou de verdade: `init()`
   começa por `loadCollections()` (louvorja.js) e só então monta a tela, então
   uma quebra em `louvorja.js` ou `bible.js` derruba o `init()` antes daqui e o
   marcador nunca aparece.

**Por polling, e não por uma checagem única no `load`:** o `init()` do Controle
é assíncrono (várias leituras de IndexedDB) e termina DEPOIS do `load`. Uma
checagem única rejeitaria todo bundle bom — o OTA pararia de funcionar por
inteiro, que é o defeito oposto e igualmente ruim. Não há risco de descompasso
de versão: `native.js` viaja **dentro** do bundle que valida, então esta função
e o `__avBack` que ela exige são sempre do mesmo commit.

O erro possível aqui é o **seguro**: a confirmação chega ~1 s depois do `load`,
então fechar o app nesse intervalo faz um bundle bom ser descartado — custo: o
app volta ao embutido e o OTA baixa de novo na abertura seguinte. O erro do
outro lado, carimbar um bundle quebrado, não tem volta sem publicar uma versão
nova.

> **Consequência prática:** mover `__avBack` para outro arquivo, renomear
> `#playlist` ou adiar a primeira renderização da playlist para depois de uma
> interação **quebra o watchdog** — o app deixa de confirmar e todo bundle OTA
> passa a ser descartado no lançamento seguinte, silenciosamente.

### Chamadas à ponte: época e prazo

Duas defesas em `shared/native.js`, ambas invisíveis no navegador:

- **O id de cada chamada é escopado ao CARREGAMENTO da página**, não um
  contador puro (`EPOCH` aleatório + sequência). O renderer pode morrer no meio
  de uma chamada em voo — é para isso que existe o `onRenderProcessGone` do
  shell: o WebView é destruído e recriado, a página recarrega e o contador
  volta a zero, mas o `resolve` do Kotlin aponta sempre para o WebView
  **atual**. Com ids "1", "2", "3", a resposta atrasada de um `listFolder` da
  página velha resolvia a promise homônima da página **nova** — uma lista de
  arquivos chegando onde se esperava o retorno de `displays()`. Com a época, a
  resposta velha não acha entrada no mapa e é descartada.
- **Prazo (`CALL_TIMEOUT_MS`, 60 s) nas chamadas que NÃO dependem de gente.**
  Se o lado nativo nunca responder, sem isso a promise fica pendente para
  sempre e o fluxo que a aguardava para no meio — sem erro, sem nada no
  console. É rede de segurança, não deadline de UX: generoso de propósito,
  porque varrer uma pasta enorme do SAF leva segundos. `pickFolder` e
  `requestMic` ficam **sem prazo**: ali quem responde é uma PESSOA (o seletor
  do SAF, o diálogo de permissão), e um timeout resolveria `null` com o
  operador ainda escolhendo a pasta.

---
