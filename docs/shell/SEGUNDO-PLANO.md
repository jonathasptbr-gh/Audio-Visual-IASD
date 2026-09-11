<!-- Capítulo extraído do `CLAUDE.md` na faxina de 2026-09-07. -->
<!-- O núcleo guarda o RESUMO e o ponteiro; o detalhe mora aqui.  -->

> **Este capítulo saiu do `CLAUDE.md`** (a faxina de 2026-09-07), que era lido
> INTEIRO em toda sessão e por isso cobrava este texto de quem nunca ia abrir
> este assunto. O que ficou lá é o RESUMO — as regras que valem sem abrir
> capítulo nenhum — mais o ponteiro para cá. **O detalhe é este arquivo, e ele
> é a fonte:** uma segunda escrita do mesmo mecanismo divergiria no primeiro
> ajuste, que é o defeito que este repositório mais paga.

**Fora daqui:** [`../../CLAUDE.md`](../../CLAUDE.md) (invariantes, ponte,
barramento, entrega) · [`../HISTORICO.md`](../HISTORICO.md) (o porquê de cada
decisão, por `grep`).

---

# Trabalho em segundo plano (downloads com o app minimizado)

Minimizado, o Android trata o processo como descartável e pode **congelá-lo** —
a sincronização de hinos, álbuns, Bíblia ou pastas parava no meio. Enquanto há
download, o [`SyncService`](../../app/src/main/java/br/org/iasd/av/SyncService.kt) roda
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

**E AS ROTINAS DE ACERVO CEDEM A VEZ AO QUE ESTÁ NO AR** (v1.4.19,
`rotinaDeAcervoPodeCorrer`). `syncLyrics` e `syncCifrasAcervo` saem da abertura
SEM `await`, então correm juntas: `NET_CONCURRENCY` é 6, e são até **12
requisições concorrentes** a dois hosts de terceiros sobre o acervo inteiro
(MEDIDO: 309 + 145 hinos numa passada). O único freio era rede móvel — nada
consultava a cena. **Isso é estabilidade, não desempenho:** o uso normal é abrir
o app minutos antes do culto e tocar o primeiro item, e nesse instante os
fragmentos do MSE disputam a Wi-Fi da igreja com as 12 — justamente quando a
MEDIDA DE BANDA que escolhe o degrau do louvor inteiro está sendo feita.

- **A pergunta é `midiaNoAr`**, e ela é feita na PORTA das duas rotinas **e
  dentro do laço**: a porta cobre "começar com cena no ar", o laço cobre o caso
  NORMAL (o app abre vazio, a varredura parte, e só então o operador toca).
- **CEDE A VEZ E SAI, não cede a vez e espera.** Esperar seguraria o
  `withBgRotina` — e com ele o `SyncService`, cuja cota de `dataSync` é de 6 h em
  24 h — parado por um culto inteiro sem baixar nada. Sair é seguro porque as
  duas são RETOMÁVEIS por construção e porque quem as rearma já existe:
  `autoRefreshCollections` roda na abertura **e em todo `visibilitychange`**.

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

### A TRANSMISSÃO DIRETA SAIU DO APP (v1.7.7)

Da v5.212 à v1.7.2 o "Tocar agora" de um vídeo do YouTube **projetava sem
baixar**: o `ytStream` montava o manifesto das duas faixas adaptativas, o
`StreamProxy` as servia pelo NOSSO origin, e o `shared/mse.js` as virava um
`<video>` comum — a cena entrava com o primeiro fragmento, na casa dos kB, em
vez de esperar centenas de MB.

**Ela foi abandonada a pedido do operador**, depois do relato de *"travamentos a
cada um ou dois segundos durante a exibição de um vídeo do YouTube transmitido
diretamente para a tv"*, com espelhamento no ar: *"vamos abandonar o modo online
direto, ele é muito instável, vamos manter o download em 720p como padrão"*.

**O que saiu do `controle.js`:** `tentarTransmitir`, `recuperarStream`, o
`onStreamErro` da preview, o degrau **"Online"** do seletor de qualidade
(`YT_ONLINE`), o `motivoStream` e o bloco de Registro que o lia. Os TRÊS
caminhos que produziam uma cena de transmissão — o "Tocar agora", o item de link
(`resolverLinkYoutube`) e o share do modo simplificado — passaram todos a baixar.

**O que FICA, e por quê:**

- **`shared/mse.js` e o ramo `rec.stream` do `stage.js`.** Eles são o LEITOR. Um
  registro gravado ANTES deste lote pode carregar um `stream` no IndexedDB de um
  aparelho, e sem o motor aquela cena viraria palco vazio em vez de tocar até o
  manifesto expirar (horas). **Nada no app cria um manifesto novo** — não
  reintroduzir uma chamada a `AVStream.criar` no Controle sem o operador pedir.
- **O `ytStream` do KOTLIN, e o `StreamProxy.kt`.** Tirá-los é um degrau de
  `SHELL_VERSION` e uma Release, e um método de ponte sem chamador não custa
  nada ao aparelho. **O embrulho do lado WEB saiu na v1.8.71** — encolher pelo
  web é o lado seguro e dispensa Release —, então hoje nada no app o alcança.
- **A rota `/s/<token>` das telas da rede.** Ela repassa a faixa do googlevideo
  para uma tela da LAN, e o que a alimentava era o mesmo manifesto — hoje ela
  não tem o que servir, e cai junto por construção.
- **`AVStream.fome`, `AVStream.banda` e os oráculos do motor**
  (`mse.test.mjs`, `degrau-de-banda`, `degrau-e-prazo`, `espera-do-stream`,
  `fome-que-desiste`, `stream-so-audio`). Eles medem o LEITOR, que continua de pé.

**O preço, dito:** "Tocar agora" agora ESPERA o download — minutos, num vídeo de
~300 MB. É exatamente o que a transmissão existia para evitar, e o operador
aceitou a troca por extenso. O cartão sobre a preview e a barra de progresso já
cobrem essa espera; o caminho é o `ytArquivo`, que nunca deixou de existir.

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
