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
   (49 métodos)          addJavascript      │
                          Interface         │ remonta
                                            ▼
                                       window.AVNative  (43 métodos)
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

> **`__SHELL_VERSION__` não é `__SHELL_NAME__`.** O primeiro é contrato interno
> (hoje **44**); o segundo é o índice que o rodapé de Configurações exibe. Base
> web e shell atualizam por caminhos independentes — OTA × instalar APK —, e o
> `renderVersionLabel()` mostra os dois justamente para o operador conseguir
> dizer qual metade chegou.

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
| **sem prazo** | `pickFolder`, `pickDoc`, `requestMic`, `ytFetch`, `deckPages` | quem responde é uma **PESSOA** num diálogo do sistema — um timeout resolveria `null` com o operador ainda escolhendo a pasta |

Vencido o prazo, `call()` resolve **`null`**, e cada chamador já trata isso como
lista vazia, string vazia ou `false`. **Isso é uma mentira silenciosa por
construção** — e é exatamente por isso que a escolha de fila (abaixo) importa
tanto.

---

## As TRÊS filas — escolher a errada é uma regressão muda

Três executores de **uma thread cada**, no `companion` do `NativeBridge` e
portanto **compartilhados por todas as instâncias**. Todos daemon.

| fila | o que roda nela |
|---|---|
| **`io`** | só o que responde em MILISSEGUNDOS: `version.json`, estado do OTA, `listFolder` pelo `ContentResolver`. **Nada de rede** |
| **`transferencia`** | as transferências de MINUTOS: download do YouTube, download do APK, `ytDiscard` |
| **`extracao`** | metadados de rede (busca, playlists de canal, o manifesto do `ytStream`, `apkProcurar`) e a rasterização de PDF — coisas de SEGUNDOS |

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

**Fora das três filas:**

- **Os cinco métodos do espelho rodam na MAIN THREAD.** Enfileirados atrás de um
  download, "ligar a transmissão" venceria os 60 s e resolveria `null` — um erro
  sem causa. O que sustenta isso hoje é a serialização de
  `espelhoSrv`/`espelhoMidia`.
- **`ytCancel` não vai para fila nenhuma**, e não poderia: `transferencia` está
  ocupada justamente pelo download que se quer parar. Ele escreve um `@Volatile`
  e volta; quem responde é o laço de cópia do `YoutubeGrab`, a cada bloco de
  64 kB.

---

## `SHELL_VERSION` — a regra, e por que ela protege a válvula

Hoje vale **44**. **"Superfície" inclui forma de retorno e comportamento**, não
só assinatura: um campo que some, um contrato de URL que muda ou um método que
passa a fazer outra coisa exigem o degrau do mesmo jeito.

**É disso que a válvula `minShell` do OTA depende.** Um bundle que exija ponte
mais nova que `NativeBridge.SHELL_VERSION` é recusado, e o app segue no que
tinha. Sem o degrau, a válvula não protege nada.

**Um método novo NÃO chega por OTA.** O bundle segue com `minShell: 2` de
propósito — subi-lo recusaria a atualização inteira num shell antigo, o que é
pior que um recurso a menos. Quem depende de método novo **pergunta antes**
(`__SHELL_VERSION__ < N`): um botão que não faz nada no meio de um culto é pior
que botão nenhum. Ele aparece sozinho quando o APK novo for instalado.

A tabela de degraus está em [`../../CLAUDE.md`](../../CLAUDE.md), seção
"SHELL_VERSION".

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

`{ ligado, endereco, erro, telas[] }` — produzido por `MainActivity.mirrorJson`.

Cada tela: `{ rotulo, comando, conectadaMs, telaAcesaMin, aviso, eventos,
pronta, fila }`.

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

### `espelhoCertEstado()` — seis campos, e os dois últimos não são supérfluos

`{ temCert, host, ate, nome, noAr, servindoTls }`

O estado **GUARDADO** e o estado **NO AR** divergem: importar um certificado com
o espelho já ligado não promove o socket a TLS, porque ele já está de pé. Sem
`noAr`/`servindoTls`, a folha anuncia "certificado válido" olhando para um
endereço `http://`.

> Os três métodos de certificado **estão sem UI desde a v5.196** — a folha de
> "Ajustes avançados" era a única porta deles e saiu. Ficam na ponte de
> propósito: voltar atrás é desenhar uma folha, não publicar uma Release.

### `espelhoDerrubar(rotulo)` — o nome do método mente de propósito

No Kotlin ele ainda é **`espelhoAprovar(id, sim)`**, e o `sim` é **ignorado**. A
assinatura ficou para não custar um degrau de `SHELL_VERSION`. O `id` é o
**RÓTULO** da tela ("tela B"), único identificador que a lista do operador tem;
rótulo em branco é **recusado**, e não vale "todas".

### `espelhoLigar(modo)` — o argumento é ignorado

**Desde a v5.156.** Ficou na assinatura pelo mesmo motivo do `espelhoAprovar`.

---

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

1. **Mudou a superfície? Suba `SHELL_VERSION`** e atualize a tabela de degraus
   no `CLAUDE.md`. Forma de retorno e comportamento contam.
2. **Campo novo num objeto composto? Remonte-o no `native.js`** e acrescente a
   asserção no `tools/ponte.test.mjs`.
3. **Método novo? Escolha a fila** pela tabela acima — e, se for rede,
   **não** é `io`, por mais curta que a consulta pareça.
4. **Consumidor novo de método novo? Pergunte `__SHELL_VERSION__` antes** de
   desenhar o que depende dele.
5. **Mudou o shell? A base web sozinha não chega ao aparelho.** Declare a
   `shellTag` no `version.json` **antes** do merge e publique a Release — ver
   `CLAUDE.md`, "Regras de desenvolvimento".
