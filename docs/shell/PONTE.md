# A ponte `AVNative` — o contrato entre o Kotlin e a base web

> Capítulo do **shell nativo**. O mapa está em [`README.md`](README.md); as
> regras que valem para o app inteiro, em [`../../CLAUDE.md`](../../CLAUDE.md).
> A base web que consome esta ponte está em
> [`../ARQUITETURA-WEB.md`](../ARQUITETURA-WEB.md).

Arquivos: `NativeBridge.kt` (1.361 linhas) · `shared/native.js` (703) ·
`WebViewFactory.kt` (277). Oráculo: **`tools/ponte.test.mjs`**.

---

## Por que este capítulo existe

A ponte é a superfície onde os dois lados do projeto se encontram, e **o modo
de falhar dela é o silêncio**. `optString`/`optLong`/`optBoolean` leem um campo
ausente como `""`/`0`/`false` — valores legítimos, sem exceção e sem log. Um
campo que alguém esqueceu de remontar do outro lado não quebra nada: ele
simplesmente vale zero, para sempre.

Foi assim que:

- `bytes` passou **dezenove versões** sem viajar, e a notificação de download
  anunciava "0 B de 100 B" para um vídeo de 380 MB — mostrando BYTES como se
  fossem ITENS;
- `slideLabel` ficou de fora da v5.97 à v5.102, e a notificação escreveu
  "(estrofe)" durante toda a rodada das apresentações.

Nenhum dos dois aparece num teste de comportamento. Por isso existe o
`ponte.test.mjs`, e por isso este capítulo enumera o contrato campo a campo.

---

## As duas metades, e a assimetria que as separa

```
   Kotlin                              JavaScript
   NativeBridge.kt                     shared/native.js
   ───────────────                     ────────────────
   @JavascriptInterface  ──injetado──►  window.__AVBridge
   (59 métodos)          addJavascript      │
                          Interface         │ remonta
                                            ▼
                                       window.AVNative  (51 métodos)
                                       + 4 globais lidas direto
```

**`AVNative` só existe quando `__AVBridge` existe.** No navegador a IIFE de
`native.js` retorna na entrada e **nada** é definido — nem `__NATIVE__`. É essa
assimetria que permite a mesma base rodar nos dois contextos, e é por isso que
toda guarda no lado web é `if (!window.__NATIVE__) { …web… }` e **nunca o
inverso**: o navegador é o padrão, o nativo é a exceção que se declara.

### As quatro globais, lidas sem Promise

| global | o quê | ausente vale |
|---|---|---|
| `__NATIVE__` | `true` dentro do app | `undefined` |
| `__AV_ROLE__` | `'controle'` · `'display'` | `''` |
| `__SHELL_VERSION__` | o inteiro do CONTRATO da ponte | `0` |
| `__SHELL_NAME__` | o `versionName` do APK (o que o operador LÊ) | `''` |

> **O terceiro papel, `'tela'`, não vem da ponte.** Quem o escreve é
> `espelho/tela.js`, para a cópia do `/display/` que roda num navegador da rede
> local. As leituras de papel comparam `!== 'controle'`, e **nenhum caminho
> testa `=== 'display'`** — é isso que faz o telão da rede funcionar sem um
> ramo próprio.

> **`__SHELL_VERSION__` não é `__SHELL_NAME__`.** O primeiro é o contrato
> interno da ponte; o segundo é o `versionName` do APK. Base web e shell
> atualizam por caminhos independentes — OTA × instalar APK —, e **desde a
> v1.7.0 quem mostra os dois é o REGISTRO, não a tela**: a UI diz um número só,
> o da base web (ver a badge de versão no `CLAUDE.md`). O número do primeiro não
> se repete aqui — a única cópia é `NativeBridge.SHELL_VERSION`.

---

## O princípio: a ponte entrega URLs SERVÍVEIS, não bytes

Arquivos do aparelho e compartilhamentos chegam ao lado web como
`https://appassets.androidplatform.net/saf/<token>`, e o web usa `fetch()` +
`Blob` como já faz com o OPFS. Nenhuma função de importação precisou ser
reescrita, e **um vídeo de 2 GB nunca passa por base64**.

O token (`SafRegistry`, em `SafPathHandler.kt`) tem quatro propriedades, e cada
uma corrigiu um defeito:

| propriedade | por quê |
|---|---|
| **OPACO**, não o URI codificado | o `PathHandler` recebe o caminho já decodificado, e um `content://` com barras viraria segmentos de rota |
| **ALEATÓRIO** (128 bits base64url, `SecureRandom`) | as entradas nunca expiram; um contador deixaria `/saf/1..N` ao alcance de quem enumerar |
| **É uma URL `https://` do MESMO origin** | ver a armadilha abaixo |
| **O mesmo URI devolve sempre o MESMO token** | sem isso, cada `listFolder` de uma pasta de 500 arquivos acrescentava 500 entradas a cada re-sincronização, num processo vivo o culto inteiro |

> **A armadilha da terceira.** Quem recebe uma dessas URLs e pergunta
> `origem.startsWith("https://")` para decidir "é da rede ou é local?" manda
> **todo arquivo do aparelho** para o caminho de download. Foi o que deixou o
> PDF quebrado da v5.97 à v5.99, indistinguível de "PDF com senha". A pergunta
> certa é pelo **host** (`u.host == ORIGIN_HOST`) — invariante 2.

**Superfície nativa é privilégio do Controle.** Ver a invariante 9, abaixo.

---

## As Promises têm ÉPOCA, e nem todas têm prazo

```js
const EPOCH = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
const id    = EPOCH + ':' + (++seq);
```

**Por que a época.** O renderer pode morrer com uma chamada em voo: a página
recarrega e o contador volta a zero, mas o `resolve` do Kotlin aponta para o
WebView ATUAL. Com ids `"1"`, `"2"`, `"3"`, a resposta atrasada da página velha
resolvia a promise homônima da NOVA.

**Os prazos, e por que um deles não existe:**

| prazo | quem | por quê |
|---|---|---|
| `CALL_TIMEOUT_MS` = **60 s** | tudo que depende de MÁQUINA | nenhuma deveria demorar mais que isso |
| `APK_TIMEOUT_MS` = **15 min** | `apkInstalar` | dezenas de MB numa rede de igreja levam minutos; um prazo curto resolveria `null` sobre um trabalho que continua, e o instalador abriria sozinho depois de a tela já ter dito que falhou |
| **sem prazo** | `pickFolder`, `pickDoc`, `requestMic`, `salvarTexto`, `pacoteCriar`, `ytFetch`, `deckPages` | quem responde é uma **PESSOA** num diálogo do sistema — um timeout resolveria `null` com o operador ainda escolhendo a pasta |

Vencido o prazo, `call()` resolve **`null`**, e cada chamador já trata isso como
lista vazia, string vazia ou `false`. **Isso é uma mentira silenciosa por
construção** — e é exatamente por isso que a escolha de fila (abaixo) importa
tanto.

### O segundo argumento de `resolve()` é uma EXPRESSÃO JavaScript, não um valor

```kotlin
web.evaluateJavascript("window.__avResolve && window.__avResolve($id, $jsonValue);", null)
```

`jsonValue` é **interpolado no meio de uma chamada de função**, então tem de ser
JSON válido por construção: `JSONObject`/`JSONArray`.`toString()`,
`JSONObject.quote(texto)` para uma string, ou um literal (`"null"`, `"true"`,
`"[]"`, `"{}"`). **Uma string CRUA ali não é um valor — é código.**

O modo de falhar é o pior deste arquivo, e a v1.2.29 o pagou no `salvarTexto`:
um nome de arquivo sai como `__avResolve("e:1", registro-av-20260823.txt)`, que
é `SyntaxError`; o `evaluateJavascript` engole o erro (callback `null`), e a
promise **fica pendurada para sempre** — sem prazo, ninguém a resolve. O
arquivo é gravado e o botão nunca responde: nem ✓, nem "Não foi salvo". A
string vazia falha por outro caminho (`__avResolve("e:1", )` só não quebra
porque vírgula final é legal em chamada, e resolve `undefined`).

**Corolário de segurança:** todo texto que vem de fora — o nome escolhido no
seletor SAF, o rótulo de uma tela, uma mensagem de erro do site — passa
obrigatoriamente por `JSONObject.quote`. Sem as aspas, ele é JavaScript
arbitrário rodando no origin privilegiado.

---

## As QUATRO filas — escolher a errada é uma regressão muda

Quatro executores de **uma thread cada**, no `companion` do `NativeBridge` e
portanto **compartilhados por todas as instâncias**. Todos daemon.

| fila | o que roda nela |
|---|---|
| **`io`** | só o que responde em MILISSEGUNDOS: `version.json`, estado do OTA, `listFolder` pelo `ContentResolver`. **Nada de rede** |
| **`transferencia`** | as transferências de MINUTOS: download do YouTube, download do APK, `ytDiscard` |
| **`extracao`** | metadados de rede (busca, playlists de canal, o manifesto do `ytStream`, os detalhes de um vídeo do `ytDetalhes`, `apkProcurar`) e a rasterização de PDF — coisas de SEGUNDOS |
| **`cifra`** | só o `cifraHtml` — o GET da página do Cifra Club |

- **Um executor por INSTÂNCIA vazava.** `newSingleThreadExecutor` cria uma
  thread de core sem timeout e não-daemon, viva até um `shutdown` que nunca
  acontecia — e a ponte é reconstruída a cada morte de renderer e a cada ciclo
  de desconexão/reconexão do dongle, cada uma retendo a `NativeBridge` inteira
  e, por ela, a Activity/Presentation antigas.
- **Rede em `io` é o defeito que a separação corrigiu — e "curta" não salva.**
  Com um vídeo de 300 MB baixando, `listFolder` devolvia lista vazia,
  `otaPending` dizia que não há atualização e `atualizacaoEstado` não respondia
  nada. **Nenhum deles erra: os três mentem baixinho** — e o pior é o
  `listFolder`, cuja lista vazia o `controle.js` lê como "a pasta sumiu do
  aparelho". O `apkProcurar` repetiu isso em escala menor: um GET à API do
  GitHub com 20 s de connect + 20 s de read trava a mesma fila por até 40 s.
- **`extracao` é separada de `transferencia` porque segundos não esperam
  minutos.** Atrás de um download, o "Tocar agora" de um vídeo esperaria o
  hinário terminar — e, vencido o prazo, cairia no download sem que nada
  explicasse por quê.
- **UMA thread em `transferencia` é invariante, não economia:** o resgate de
  download do `YoutubeGrab` é um slot único e o mapa de parciais supõe **um
  download por vez**. `ytDiscard` mora aqui pelo mesmo motivo — fora desta fila
  poderia apagar o parcial de um download em curso.
- **`extracao` também é de uma thread só**, porque as extrações compartilham a
  inicialização global do NewPipe. Os diagnósticos não colidem: `diagnostico` é
  escrito só pelo caminho do download e `diagnosticoStream` só pelo do
  manifesto — que é justamente por que eles são dois campos. O `apkProcurar` não
  toca no NewPipe (é `HttpURLConnection` avulso) e entra pela outra metade da
  regra — rede lendo metadados —, pagando o preço já declarado desta fila: o
  pior caso dele é um "Tocar agora" esperando.
- **A `cifra` é própria porque ela é MASSA e a `extracao` é TOQUE.** O preço
  acima só é aceitável para UMA pergunta esporádica: a varredura do acervo roda
  na ABERTURA com seis requisições concorrentes do lado web, e o prazo do
  `CifraFonte` vale para connect E para read — havia sempre ~6 páginas à frente
  do `ytStream` de um "Tocar agora", que assim podia vencer os 60 s do `call()`
  e cair no download, calado. Sair da `extracao` é seguro porque o que a obriga
  a ser serial é a inicialização do NewPipe, e o `CifraFonte` não o toca
  (`HttpURLConnection` avulso); esta continua de uma thread pelo motivo dela —
  `CifraFonte.ultimaTentativa` é o veredito da ÚLTIMA busca, e escritas
  concorrentes fariam a linha "Cifra:" do Registro descrever outra tentativa.

**Fora das filas:**

- **Os cinco métodos do espelho rodam na MAIN THREAD.** Enfileirados atrás de um
  download, "ligar a transmissão" venceria os 60 s e resolveria `null` — um erro
  sem causa. O que sustenta isso hoje é a serialização de
  `espelhoSrv`/`espelhoMidia`.
- **`ytCancel` não vai para fila nenhuma**, e não poderia: `transferencia` está
  ocupada justamente pelo download que se quer parar. Ele escreve um `@Volatile`
  e volta; quem responde é o laço de cópia do `YoutubeGrab`, a cada bloco de
  64 kB.
- **`areaTransferencia` também fica fora**, por duas razões somadas: o
  `ClipboardManager` exige uma thread com `Looper` (as filas são `Thread` daemon
  sem um), e é trabalho de microssegundos que atrás de um download venceria os
  60 s — resolvendo `null`, que aqui é indistinguível de "não havia link
  copiado".

---

## `SHELL_VERSION` — a regra, e por que ela protege a válvula

O número vive em **`NativeBridge.SHELL_VERSION`**, e essa é a única cópia — um
número repetido aqui seria a próxima a desatualizar. **"Superfície" inclui forma
de retorno e comportamento**, não só assinatura: um campo que some, um contrato
de URL que muda ou um método que passa a fazer outra coisa exigem o degrau do
mesmo jeito.

**É disso que a válvula `minShell` do OTA depende.** Um bundle que exija ponte
mais nova que `NativeBridge.SHELL_VERSION` é recusado, e o app segue no que
tinha. Sem o degrau, a válvula não protege nada.

**O bundle declara `minShell` IGUAL ao `SHELL_VERSION`**: o shell atual é o
PISO, todo método existe sempre, e **guarda de versão no lado web é proibida** —
o que separa navegador de app é `if (!window.__NATIVE__)`, e nada mais. Em
troca, mudar a ponte deixou de ser higiene e virou pré-requisito: sem a Release
no mesmo lote, o web chama um método que o APK não tem e o botão existe, é
tocável e não faz nada.

A tabela de degraus está em [`../HISTORICO.md`](../HISTORICO.md) — com o piso,
ela é história do contrato, não regra viva.

---

## O contrato, campo a campo

### A regra que vale para os três objetos compostos

> **Campo novo no objeto = campo novo no `native.js`, SEMPRE.** Ele REMONTA o
> objeto campo a campo, e do lado Kotlin `optBoolean`/`optLong` leem ausente
> como `false`/`0`. Sem exceção, sem log, sem sintoma.

### `nowPlaying({...})` — o que a notificação de mídia publica

`{ active, title, subtitle, playing, slideMode, slideLabel, wallpaper,
positionMs, durationMs, actions }`

- **CENA é tudo que está no telão, não só mídia:** `active` inclui `currentId`,
  mensagem, versículo, **cronômetro e sorteio** projetando.
- `actions` são os BOTÕES do cartão, na ordem, escolhidos pelo lado web
  (shell 42 — não 41). **Lista vazia = os cinco de sempre.** O conjunto entra na
  CHAVE de deduplicação: sem isso, uma cena que muda só de eixo seria
  deduplicada e o cartão ficaria com os botões da cena anterior.
- `positionMs`/`durationMs` saem da própria **barra de progresso** (`#seek`), não
  de `preview.getDuration()` — a barra é a única fonte que cobre todos os tipos,
  inclusive YouTube.
- **A posição fica FORA da chave de deduplicação** (a sessão extrapola sozinha),
  mas **seek é descontinuidade**: `pushNowPlaying` compara o tempo real com o
  extrapolado e republica além de `POS_TOL_MS` (1,5 s).

### `bgProgress({...})` — o progresso na notificação de download

`{ label, done, total, etaMs, items, idleMs, bytes }`

- **`bytes` é a bandeira de unidade**, e ela mora no REGISTRO da tarefa, não no
  envio: um lote de músicas pode rodar ao lado de um vídeo.
- **`Long`, não `Int`**, do `optLong` até o `Progress` — 1080p passa dos 2 GB.
  Por isso `setProgress` recebe **milésimos** (é `Int` por assinatura), e por
  isso o `native.js` usa `inteiro()` e **não** `| 0`: aquele idioma passa por um
  Int32 **com sinal**, e acima de 2.147.483.647 o número vira negativo — que o
  `Math.max(0, …)` que costuma vir junto esconde zerando tudo.

### `espelhoEstado()` — o estado da transmissão

`{ ligado, endereco, erro, via, redes[], telas[] }` — produzido por
`MainActivity.mirrorJson`.

Cada tela: `{ rotulo, comando, conectadaMs, telaAcesaMin, aviso, eventos,
pronta, fila }`.

- **`via` (shell 57)** — `WIFI` ou `PONTO_DE_ACESSO`: por onde o socket está
  servindo. O `blocoEspelho` do Registro cravava `", ligado à Wi-Fi)"`, que
  virou mentira no instante em que o ponto de acesso passou a servir.
- **`redes[]` (shell 57)** — as servíveis AGORA (`{ ip, via, iface }`). Ela **vem
  VAZIA com a transmissão no ar**, e isso é deliberado: montá-la ENUMERA AS
  INTERFACES do aparelho na main thread, e este objeto é relido a cada 2,5 s
  enquanto a folha está aberta. Ligado, a folha não desenha a escolha (trocar de
  rede exige desligar), então o que sobraria era uma varredura por segundo e meio
  durante o culto inteiro para alimentar um bloco que ninguém pinta. Quem quer a
  leitura com a transmissão no ar tem o Registro, que a faz sob demanda.

- **Sem `codigo` desde o shell 38:** a porta é o ENDEREÇO na rede.
- **Sem pendentes desde o shell 36:** não há fila de aprovação. Quem entra pela
  porta entra na hora; o controle real é o teto de **3 sessões** mais o
  `espelhoDerrubar` do operador, com castigo de 2 min.
- **Os seis campos de capacidade saíram no shell 44** (`seguro`, `mse`, `mms`,
  `fetchStream`, `videoDecoder`, `wakeLock`): ficaram sem produtor quando o
  espelho de pixels saiu, e `optBoolean` os publicava como `false` — um valor
  legítimo, lido como medição.

### `atualizacaoEstado()` — os dois canais numa leitura só

`{ web, webAtual, shell, shellBytes, shellAtual, diag }` (shell 43).

**Ele não acrescenta poder, acrescenta COERÊNCIA DE INSTANTE:** três promessas
independentes desenhavam o diálogo pela metade.

### `apkProcurar()` — três desfechos, e nenhum deles é `null`

| desfecho | quando |
|---|---|
| `{}` | não há versão nova |
| `{ versao, bytes, notas }` | há — `bytes` é o TAMANHO do `.apk` |
| `{ erro }` | a pergunta falhou |

**NÃO existe campo `url`.** Quem guarda a URL é o `ShellUpdater`, do achado da
última `apkProcurar` — é por isso que `apkInstalar()` não recebe URL nenhuma.

### `ytDetalhes(url)` — e o `null` dele NÃO é achatado (shell 62)

`{ titulo, canal, seconds, descricao }` ou **`null`**. Ele é a metade do card de
detalhe de um vídeo que **não cabe no índice**: título, canal e duração já vêm
na listagem de playlist e o `serie.js` os guarda (valem OFFLINE); a DESCRIÇÃO só
existe extraindo o vídeo, uma requisição por vídeo.

| desfecho | o que significa | o que o `controle.js` faz |
|---|---|---|
| `null` | **não houve resposta** — sem rede, prazo vencido, papel `display` | não guarda nada; a próxima abertura tenta de novo |
| `{ …, descricao: '' }` | respondeu, e este vídeo **não tem** descrição | guarda; senão toda abertura gasta uma extração para chegar à mesma resposta |

É a mesma distinção do `status 0` × `404` do `cifraHtml`, e é por isso que a
remontagem do `native.js` **não** achata o `null` num objeto vazio como aquele
faz: aqui as duas respostas pedem ações opostas, e um aparelho sem rede
carimbaria "não tem descrição" no cache até o app fechar.

**`descricao` é SEMPRE texto simples, e quem garante isso é o Kotlin.**
`Description.getType()` pode ser HTML — é o que o YouTube devolve quando a
descrição tem links —, e o Controle roda no origin PRIVILEGIADO, o que injeta
`__AVBridge`. Entregar HTML de terceiro a esse lado é uma porta que só existe
para ser fechada.

**Isto não contradiz a divisão da CIFRA**, e a diferença é o que decide: lá a
MARCAÇÃO carrega o significado (é o `<b>` que diz "esta linha é de acordes"),
então o parser é a regra e tem de chegar por OTA no dia em que o site mudar.
Aqui a marcação não carrega nada que se guarde, e um achatador de HTML não
envelhece com o YouTube — `Html.fromHtml` é a plataforma fazendo isso.

**E o TIPO original não viaja**, de propósito: o único uso possível de um campo
`descricaoTipo` do outro lado seria ramificar por ele, e o único ramo que ele
habilita é o que esta decisão existe para impedir.

> **A fila é a `extracao`, e é isso que obriga o chamador a ser um TOQUE.** Ela
> é de uma thread, e trabalho de MASSA ali empurra todo "Tocar agora" para além
> dos 60 s do `call()`. Quem chama é o botão "Ver os detalhes" de UMA linha, com
> cache em memória do outro lado — nunca a montagem de uma lista, nunca uma
> varredura de álbum.

### `espelhoCertEstado()` — seis campos, e os dois últimos não são supérfluos

`{ temCert, host, ate, nome, noAr, servindoTls }`

O estado **GUARDADO** e o estado **NO AR** divergem: importar um certificado com
o espelho já ligado não promove o socket a TLS, porque ele já está de pé. Sem
`noAr`/`servindoTls`, a folha anuncia "certificado válido" olhando para um
endereço `http://`.

> Os três métodos de certificado **estão sem UI desde a v5.196** — a folha de
> "Ajustes avançados" era a única porta deles e saiu. Ficam na ponte de
> propósito: voltar atrás é desenhar uma folha, não publicar uma Release.

### `areaTransferencia(desde)` — o carimbo é o recurso, não o texto

Devolve `{ texto, carimbo }` ou `null`. O que ele responde não é "o que está
copiado?", é **"há algo copiado que este app ainda não examinou?"** — e a
diferença é o preço do recurso: do Android 12 em diante, LER a área de
transferência que outro app preencheu mostra um aviso do sistema na tela.
Consultar a DESCRIÇÃO não mostra nada.

Daí a ordem das perguntas no `MainActivity.lerLinkCopiado`, que é o recurso
inteiro: **descrição → carimbo → conteúdo**. Invertida, o aviso apareceria a
cada vinda ao app.

| desfecho | quando |
|---|---|
| `{ texto, carimbo }` | texto simples, começando com `http(s)`, com carimbo MAIOR que `desde` |
| `null` | carimbo `0` (o sistema não sabe quando aquilo foi copiado — **desiste**, porque sem carimbo não há como não reler), sem foco (do Android 10 em diante a descrição volta nula), não é texto simples, não começa com `http(s)`, ou passa de 2 kB |

- **`desde` viaja como TEXTO**: é um `long` em milissegundos e o
  `@JavascriptInterface` converte número de JS por `double`.
- **O filtro de scheme e o teto de 2 kB são PRIVACIDADE, não classificação.**
  Quem decide se o endereço é do YouTube é o `controle.js` (invariante 5, e o
  `extractYouTubeId` já existe lá); o que estas duas linhas fazem é impedir que
  uma senha copiada entre no heap do JavaScript para ser descartada um passo
  depois. Mesma família da regra do `ShareIntake`, que só aceita `content://`.
- **A memória do último carimbo é do LADO WEB** (`clip-carimbo`, no banco), e
  isso não é acidente: só o web sabe se conseguiu OFERECER o link. Com um
  diálogo já na tela ele não pergunta e **não avança o carimbo** — a retomada
  seguinte ainda tem o que perguntar.

### `espelhoDerrubar(rotulo)` — e o nome diz o que ele faz

`rotulo` é o da tela ("tela B"), único identificador que a lista do operador
tem; rótulo em branco é **recusado**, e não vale "todas".

> Ele se chamou `espelhoAprovar(id, sim)` até a v1.0, com o `sim` ignorado desde
> o shell 36 — um nome que prometia uma decisão que já não existia. O mesmo lote
> tirou o `modo` do `espelhoLigar`, ignorado desde a v5.156. Os dois esperaram o
> lote que sobe o degrau, que é a regra: encolher a ponte é APK + web juntos.

### `espelhoLigarEm(ip)` — o irmão ADITIVO do `espelhoLigar` (shell 57)

O `AVNative.espelhoLigar(ip)` do lado web é **um** método sobre **dois** do
Kotlin: sem `ip` chama o `espelhoLigar` de sempre, com `ip` chama este.

**Aditivo, e não uma assinatura trocada** — a assimetria de entrega é a razão: o
web chega por OTA em minutos, o shell só instalando o APK. Trocar a forma do
`espelhoLigar` faria o bundle novo chamar contra um APK que ainda tem a velha, e
o botão existiria, seria tocável e não faria nada.

Ele existe porque um aparelho de rádio duplo tem a Wi-Fi e o ponto de acesso de
pé ao mesmo tempo, e **qual deles a tela alcança não é decidível pelo app**: quem
sabe onde o computador está conectado é a pessoa. Com uma rede só, o shell
escolhe (ponto de acesso na frente) e a escolha nem é desenhada.

Guardado por `host != null` como os outros — **invariante 9: este método abre um
servidor na rede da igreja.**

### `projecaoLocal(bool)` — o único método cuja resposta o shell não sabe apurar

Ele diz **"a projeção é ESTE aparelho"**: não há tela conectada e há cena no ar.
O shell responde ligando no WebView do **Controle** as duas metades da proteção
que o telão tem desde que nasce — `KeepVisibleWebView.manterVisivel` (a
visibilidade, que o Chromium calcula da janela **e** da View) e
`RENDERER_PRIORITY_IMPORTANT` com `waivedWhenNotVisible = false` — mais
`onResume`/`resumeTimers` no `onStop` da Activity.

**A visibilidade tem DOIS donos, e o segundo é a TELA CHEIA.** Ao entrar em
fullscreen o Chromium entrega ao `onShowCustomView` uma View própria e deixa o
WebView original com um tratamento no-op: dali em diante os `override` da
`KeepVisibleWebView` não vão a lugar nenhum, e quem reporta visibilidade ao
motor é essa View de terceiro — que só a recebe pelo DESPACHO do contêiner que a
hospeda. Por isso o `fullscreenContainer` da `MainActivity` é um
`KeepVisibleFrame`, que mente do mesmo jeito, e o `aplicarProjecaoLocal` escreve
a bandeira nos dois. Sem ele o defeito volta inteiro **no caso mais comum do
culto sem TV**, porque é ali que a preview em tela cheia É a projeção.

**Por que ele existe:** sem tela quem toca é o `<video>` da preview, neste
WebView, e o Chromium pausa o `<video>` de uma página oculta. Com o app
minimizado, o louvor calava.

**Por que a decisão é do web** (invariante 5): "há tela?" mistura TV
(`listDisplays`), telas da rede (o servidor) e o modo do app; "há cena?" inclui
mensagem, versículo, cronômetro e sorteio. O shell teria de reconstruir os dois,
e a cópia envelheceria à parte da original.

**Por que ele é CONDICIONAL** e não um `keepVisible = true` de fábrica: com telão
no ar o Controle DEVE ser estrangulado em segundo plano — ele é a mesa de
comando, o som está lá fora, e é justamente o que o `snoopDisplayStatus` existe
para contornar. Ligar sempre trocaria um defeito por um consumo.

> O nome ANTIGO desta ideia era `keepAudioAlive`, e ele saiu no shell 38 com a
> "mesa de som". Não voltou de propósito: ele falava de ÁUDIO, e o que se
> protege é o `<video>` inteiro — a imagem parava junto.

---

### Os TRÊS do PACOTE e o canal `__avPacote` (shell 63)

O acervo de um aparelho num arquivo — ver a seção do recurso no `CLAUDE.md`.
Aqui só a **divisão de trabalho**, que é o que este capítulo existe para dizer:

| entra por | o quê | por quê |
|---|---|---|
| **ponte** | `pacoteCriar(nome)` | abre o "Salvar como" do SAF. Quem responde é uma PESSOA — daí ele estar na lista dos **sem prazo** |
| **canal** | `__avPacote.postMessage(ArrayBuffer)` | os blocos de 512 kB, com **ack por bloco**. `postMessage` não tem backpressure: sem o ack, a main thread do shell vira fila de megabytes |
| **ponte** | `pacoteFechar()` | devolve os BYTES gravados, ou `-1`. É a única confirmação de que os blocos chegaram ao DISCO — os acks já disseram "recebi", e é o `flush`/`close` que descobre o cartão cheio |
| **ponte** | `pacoteCancelar()` | fecha e APAGA o parcial. Síncrono e sem resposta, como o `ytCancel` |

**A REGRA GERAL, e ela vale para o próximo canal que nascer:** *o que espera uma
PESSOA, ou precisa de um VEREDITO, entra pela ponte; BYTES entram pelo canal.*
É a mesma divisão que separa `pickFolder` de `listFolder`.

**Por que os bytes não passam pela ponte:** um `@JavascriptInterface` troca
STRINGS, e o acervo passa de gigabytes — base64 sobre isso é exatamente o que o
princípio "URLs servíveis, nunca bytes" proíbe. E por que não um `<a download>`:
o WebView deste app não tem `DownloadListener`, e ali um clique desses não faz
NADA — a mesma parede que criou o `salvarTexto`.

**A IMPORTAÇÃO NÃO TEM MÉTODO NENHUM**, e é o princípio pagando: `pickDoc` já
devolve uma `/saf/<token>` servível, e o lado web a lê por `fetch` +
`Blob.slice()` — a mesma técnica com que o `pptxzip.js` abre um `.pptx` de
570 MB. Um método novo aqui teria sido superfície a mais para nada.

**O canal recusa com `-1` sem destino aberto**, e é isso que faz um empurrão
órfão (a página recarregou no meio) parar sozinho em vez de gravar num arquivo
de outra sessão. E o `onRendererGone` da Activity chama `descartarPacote()`: o
destino do SAF sobreviveria à morte do renderer, e o que ficaria no cartão do
operador é meio acervo com nome de acervo inteiro.

### `compartilharTexto(txt)` — e por que ele não é o `openExternal` (shell 63)

`ACTION_SEND` + `createChooser`. **`openExternal` faz o oposto do pedido**: ele
MANDA este aparelho abrir um endereço, e o que se quer é OFERECER um texto a
outro aparelho. Um link aberto no navegador do próprio celular não chega a
ninguém.

**E não é `navigator.share`**: o WebView do Android não implementa a Web Share
API — com `WebChromeClient` nenhum —, então aquela chamada simplesmente não
existe do lado da página. Sem erro, sem chooser.

**Síncrono e sem resposta**, como o `openCast`: o desfecho de um chooser é uma
pessoa escolhendo (ou não) um app, e não há API que entregue esse veredito nem
nada que o lado web faria com ele. TETO DE 4 kB no Kotlin: um `Intent` grande
demais lança `TransactionTooLargeException` no `startActivity`, o que derrubaria
o app com a projeção junto.

## As oito coisas que o `native.js` chama e NÃO são API

Fora do `native.js`, tocar em `__AVBridge` direto é acoplamento indevido. O
próprio `native.js` chama mais oito coisas lá, e **nenhuma é API para o app**:

| chamada | o quê |
|---|---|
| `ytFetchAudio`, `ytFetchAte` | não são métodos a mais: são os outros dois DESTINOS do `ytFetch` (só-áudio, teto de resolução) |
| `shellVersion()`, `role()`, `appVersion()` | viram as globais |
| `busPost()` | o relay nativo do barramento de comandos |
| `otaConfirm()` | o watchdog de boot do OTA |
| `takeShare()` | o consumo do share pendente, que alimenta o `onShare` |

---

## As invariantes que moram aqui

**Em `WebViewFactory.kt`** (1-4): origin `https://appassets.androidplatform.net/`
e jamais `file://`; **um único origin** comparado por **componente do `Uri`**
(`url.host == ORIGIN_HOST`) e nunca por prefixo de string; **um único
processo/perfil**; `mediaPlaybackRequiresUserGesture = false` com
`allowFileAccess`/`allowContentAccess` **desligados**.

> A segunda **não pode falhar ABERTO**. `appassets.androidplatform.net.evil.com`
> começa com o origin, é um domínio que qualquer um registra, e um `startsWith`
> autorizaria a navegação — dentro de um WebView que injeta `__AVBridge` em
> **toda** página que carregar (`addJavascriptInterface` é por-WebView, não
> por-origem).

**Invariante 9 — no WebView do TELÃO:** a ponte nasce com **`host = null`** e o
loader é montado **SEM** o handler `/saf/`. É o que separa "uma segunda janela do
Display" de um comprometimento do aparelho: com `host != null`, qualquer script
de terceiro ali ganharia `pickFolder`, `listFolder`, `pickDoc`, `openExternal` e
`espelhoLigar` — este último abre um servidor na rede da igreja.

- `listFolder` honra a mesma regra e devolve **lista vazia sem host** — era a
  exceção, porque lê o `ContentResolver` direto, e sem a guarda qualquer script
  no documento do Display lia o índice inteiro (nome, tamanho e token servível)
  de toda pasta concedida.
- Os dois consumidores de arquivo do aparelho (`importShare`, `syncDeviceFolder`)
  rodam no **Controle** e copiam para o OPFS antes de qualquer coisa chegar ao
  telão. **O Display nunca busca um `/saf/`.**
- Quem trava isso é `tools/ponte.test.mjs`.

> A guarda **não** depende do embed do YouTube. Ele carregava script de terceiro
> ali por design e saiu na v5.212; a razão viva é a lista de métodos acima.

---

## Ao mexer nesta ponte

1. **Mudou a superfície? Suba `SHELL_VERSION`** em `NativeBridge.kt` **e o
   `minShell` do `version.json` para o mesmo número.** Forma de retorno e
   comportamento contam.
2. **Campo novo num objeto composto? Remonte-o no `native.js`** e acrescente a
   asserção no `tools/ponte.test.mjs`.
3. **Método novo? Escolha a fila** pela tabela acima — e, se for rede,
   **não** é `io`, por mais curta que a consulta pareça.
4. **Mudou o shell? A base web sozinha não chega ao aparelho.** Declare a
   `shellTag` no `version.json` **antes** do merge e publique a Release — ver
   `CLAUDE.md`, "Regras de desenvolvimento".
