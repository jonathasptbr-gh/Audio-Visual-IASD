# A SEGUNDA CASCA — o Áudio Visual IASD no computador

> **ESTE DOCUMENTO É O CONTRATO E O DIÁRIO DE BORDO deste trabalho.** Ele foi
> escrito para sobreviver a interrupções: qualquer sessão que precise retomar
> começa pela **§0** e pela tabela de **Estado** dentro dela. Nenhum passo deste
> projeto vive só na memória de quem o executou — **se não está aqui ou num
> commit, não aconteceu.**
>
> O que vale hoje é este arquivo mais o `CLAUDE.md` ("A segunda casca") e o
> código. Números envelhecem: **meça antes de citá-los** (§10).

O app é uma **casca fina sobre uma base web**. O Android é uma dessas cascas;
esta é a segunda, para **Windows**. Não é um port: é a **mesma relação** num
segundo sistema operacional, com **a mesma base web, byte a byte**.

```
 AudioVisualIASD.exe ──stdio──► nucleo.jar ──http://127.0.0.1:8420──► as janelas
  (C#: janela, monitores,  ◄────  (Kotlin: servidor,  ◄──── SSE ────   (WebView2)
   diálogos, volume)               despacho da ponte)
```

| | Android | computador |
|---|---|---|
| a base web | `assets/web/`, servida pelo `WebViewAssetLoader` | **a mesma**, servida por um socket de loopback |
| o motor | WebView do sistema | **WebView2** (runtime do Edge) |
| a projeção | `android.app.Presentation` numa TV | **segunda janela** num segundo monitor |
| a ponte | `addJavascriptInterface` | folha injetada + `POST /ponte/call` + SSE |
| a lógica sem plataforma | `:core` | **o mesmo `:core`** |

---

## §0 COMO RETOMAR ESTE TRABALHO

1. Leia este arquivo. Ele é a especificação **e** o plano.
2. Olhe a tabela de **Estado**: o primeiro lote não-`CONCLUÍDO` é o atual.
3. Antes de escrever uma linha, leia **§4 (as invariantes)** e **§9 (o que foi
   tentado e RECUSADO)** — a segunda existe para ninguém rederivar um caminho
   que já foi fechado com motivo medido.
4. Branch de trabalho: `claude/pwa-multiplatform-analysis-bvqsuf`. As regras de
   entrega do projeto valem (`CLAUDE.md`, "Entrega") **com uma diferença que
   precisa estar dita**: a segunda casca **não chega por OTA nem por APK**. Ela
   é `windows/` mais os `Nucleo*.kt` do `:core` — nada disso entra no bundle, e
   um lote só dela **não exige Release** e **não sobe a versão da base web**. O
   que a distribui é o lote 7.
5. **Compilar não é funcionar.** O que este repositório consegue provar está em
   §8; o que só se prova na máquina do operador está lá também, nomeado. A
   primeira ligada de verdade segue a regra de calendário do projeto: **num dia
   sem culto**.

### Estado

| # | lote | entrega | estado |
|---|---|---|---|
| **2** | Layout de computador na base web + o oráculo da 2ª janela | duas colunas onde há largura E altura; o primeiro oráculo do repositório que abre uma segunda janela | **CONCLUÍDO** — v1.4.4, `e6256ed` |
| **1** | O módulo `:core` | o Kotlin sem plataforma sai do `:app`; o compilador passa a impedir uma dependência de Android entrar nele | **CONCLUÍDO** — v1.4.5, `a804c22` |
| **3** | Casca mínima: transporte + janelas + importação | servidor de loopback, ponte, despacho, `/saf/`, diálogos de arquivo, a casca em C# | **CONCLUÍDO** — v1.4.6, `df1e125` · `8ec12c4` · `6e6e4fa` |
| **4** | YouTube e cifra | `YoutubeGrab` + `CifraFonte` ligados ao despacho. **Teto de 720p até o lote 5** | **A FAZER** |
| **5** | Muxer e PDF | 1080p (o par vídeo+áudio) e a apresentação em imagens | **A FAZER** |
| **6** | Telas da rede no PC | o `EspelhoServidor` na segunda casca | **A FAZER** |
| **7** | Empacotar e distribuir | MSIX para a Loja + ZIP portátil | **A FAZER** |

> A ordem de execução foi **2 → 1 → 3 → …**, e não 1 → 2: o lote 2 veio primeiro
> por ser o único inteiramente provável nesta máquina na época. Hoje o
> argumento mudou (§8), mas a ordem dos lotes 4–7 continua valendo.

---

## §1 A EXIGÊNCIA, e por que não é um PWA

O operador pediu o mesmo sistema num computador com Windows, com **todas** as
funções — inclusive cifra, YouTube e as telas da rede — e recusou o formato PWA
para não ficar limitado.

**A recusa está certa, e o motivo é medido.** Três funções não existem num
navegador comum, cada uma por uma razão diferente:

| função | por que um navegador não faz |
|---|---|
| **cifra** | o site de terceiro não manda `Access-Control-Allow-Origin`; o `fetch` morre antes de sair, e o `<iframe>` esbarra no `X-Frame-Options` |
| **YouTube** | a extração precisa de um `User-Agent` que o navegador não deixa forjar |
| **telas da rede** | um navegador não abre `ServerSocket` |

Uma casca própria remove as três. **É por isso que o programa é um executável e
não uma página.**

---

## §2 INDEPENDÊNCIA — as duas versões não precisam uma da outra

**O programa de Windows funciona sozinho: sem celular, sem rede, sem internet.**
O Android idem. **Não há sincronização de acervo entre os dois** (§9).

`http://127.0.0.1` é o **PC falando consigo mesmo** — endereço de loopback, que
não passa por placa de rede, roteador nem internet. O programa serve os próprios
arquivos às próprias janelas.

**E isto não é invenção do desktop: é o que o Android já faz.** O
`https://appassets.androidplatform.net/` do celular também não é um site — é o
app servindo a si mesmo pelo `WebViewAssetLoader`.

**Por que servir, em vez de abrir o arquivo direto?** Invariante 1: OPFS e
IndexedDB — onde mora o acervo inteiro — **só existem em contexto seguro**, e
`file://` não é um. **Servir a si mesmo é o preço de ter biblioteca, não uma
dependência de rede.**

| socket | quando existe | alcance |
|---|---|---|
| **loopback** `127.0.0.1:8420` | sempre | **nunca sai do PC**; serve as duas janelas do programa |
| **LAN** (lote 6) | só se o operador ligar "telas da rede" | outros aparelhos viram telas extras |

Internet só para o que precisa dela por natureza (primeira sincronização do
LouvorJA, YouTube, cifra) — exatamente como no celular. **O culto roda offline.**

> **Metade do que o operador descreveu JÁ EXISTIA**: o botão *"Conectar um
> computador"* põe o `/display/` de verdade no navegador do PC, servido pelo
> celular. O que a segunda casca acrescenta é mover **o Controle** para o
> computador. Esse caminho continua existindo e **o programa não o usa nem
> depende dele**.

---

## §3 O MOTOR: WebView2

**O JCEF foi descartado por um motivo medido** — ver §9. O WebView2 é o runtime
do Edge que a Microsoft distribui e licencia: **os codecs H.264/AAC vêm com
ele**, e ele já está em todo Windows 10/11, então o pacote não carrega um
navegador inteiro.

---

## §4 AS INVARIANTES

### As quatro do `WebViewFactory`, traduzidas

| # | no Android | aqui | onde |
|---|---|---|---|
| 1 — contexto seguro, jamais `file://` | `WebViewAssetLoader` | `http://127.0.0.1:8420` — loopback é *potentially trustworthy* por especificação | `NucleoServidor` |
| 2 — um único origin | mesmo host | **mesma porta** (ver abaixo) | `Janela.MontarAsync` recusa navegação para fora, por COMPONENTE do `Uri` |
| 3 — um perfil | um WebView | um `CoreWebView2Environment` e uma pasta de perfil para as duas janelas | `Programa.MontarAsync` |
| 4 — autoplay sem gesto | flag do WebView | `--autoplay-policy=no-user-gesture-required` | `Programa.MontarAsync` |

### A invariante NOVA: **A PORTA É A ORIGEM**

`http://127.0.0.1:8420` e `:8421` são **origens diferentes**, com IndexedDB e
OPFS diferentes.

**O reflexo normal diante de uma porta ocupada — "pega outra livre" — apagaria a
biblioteca do operador em silêncio**: o Cronograma, o hinário, a Bíblia e os
vídeos ficariam órfãos num origin que ninguém mais abre, ocupando disco, sem uma
linha na tela dizendo o que houve.

Por isso colisão é **falha alta com frase**, e a frase diz o que **não** fazer:

> "A porta do programa já está em uso. Feche a outra cópia do Áudio Visual IASD
> e abra de novo. **Não troque a porta**: é ela que identifica a sua biblioteca,
> e mudá-la faria o programa abrir vazio."

É a mesma disciplina que o `EspelhoPares` aplica à porta da transmissão, com uma
diferença de grau que muda o desenho: lá o custo de errar é uma tela que não
conecta; **aqui é um acervo perdido.**

### A invariante 9, e o degrau que ela ganhou

No Android a superfície privilegiada é negada por construção (`host = null` no
WebView do telão) mais uma guarda em cada método — e o `CLAUDE.md` registra que
**não há oráculo para ela**.

Aqui o papel é **selado na SESSÃO** pela casca, que é quem cria a janela, e a
recusa acontece **no servidor**, antes de qualquer despacho. Isso a torna uma
linha de tabela — e uma linha de tabela se testa com um `POST`.

**Ela vale para ARQUIVO também**, e quase se perdeu: no Android o WebView do
telão é montado **sem** o handler `/saf/`; aqui as duas janelas dividem **um
socket** (a porta é a origem — um segundo socket seria um segundo IndexedDB).
Servir `/saf/<token>` puro devolveria ao Telão o que o Android lhe nega. Daí a
URL ser `/saf/<sessao>/<token>`.

### A invariante 5 (nenhuma regra de culto na casca)

Transporte, playlist, letra sincronizada, Bíblia, Camada de Texto e fades ficam
no web; YouTube, cifra e as regras que são texto ficam no `:core`, em Kotlin,
**um conserto para as duas cascas**. O C# é **só** janela e sistema operacional.

---

## §5 AS PEÇAS — e o que cada uma se recusa a fazer

### O núcleo (`core/src/main/kotlin/`, Kotlin/JVM, **zero import de `android.*`**)

| arquivo | o quê | o que ele NÃO faz |
|---|---|---|
| `NucleoRotas.kt` | o que uma rota **É** — PURO. É aqui que mora a **travessia de diretório** | não abre socket, não toca em disco |
| `NucleoServidor.kt` | o socket em `127.0.0.1`, com `Range` de verdade | não sabe o que é um método da ponte: recebe bytes e devolve bytes |
| `NucleoPonte.kt` | o **envelope** da ponte, nas duas direções — PURO | não interpreta argumento nenhum |
| `NucleoDespacho.kt` | **quem responde o quê**: o núcleo, a casca, ou ninguém ainda | não lê comando do barramento — transporta |
| `NucleoArquivos.kt` | a rota `/saf/`: a **única porta para fora do bundle** | não escolhe arquivo (quem abre o diálogo é a casca) |
| `NucleoApresentacao.kt` | a única regra da apresentação que é string | não desenha PDF |
| `NucleoMain.kt` | o `nucleo.jar` — o núcleo como programa | não decide nada; monta e bombeia o cano |

O jar sai de `./gradlew :core:nucleoJar` — **um jar só, com a stdlib do Kotlin
dentro, sem plugin de "fat jar"**: a regra de zero dependência vale para o build
também.

### A casca (`windows/`, C#, `net8.0-windows` sem WinForms/WPF)

| arquivo | o quê |
|---|---|
| `casca/ponte.js` | a folha **injetada** em cada janela: o `__AVBridge` do computador |
| `AudioVisualIASD.Ponte/Envelope.cs` | o codec do envelope, em `net8.0` **portátil** — portátil para o oráculo dele **rodar** em Linux |
| `AudioVisualIASD.Testes/` | a terceira metade do contrato do envelope |
| `AudioVisualIASD/Programa.cs` | a abertura: sobe o núcleo, cria as janelas, roda o laço |
| `AudioVisualIASD/Janela.cs` | uma janela Win32 hospedando um WebView2; sela o papel |
| `AudioVisualIASD/LacoUi.cs` | o laço de mensagens **e** o contexto que faz `await` voltar para ele |
| `AudioVisualIASD/Telas.cs` | os monitores, e o degrau de projeção |
| `AudioVisualIASD/Folhas.cs` | as folhas de UI — o `BridgeHost` do Android |
| `AudioVisualIASD/Dialogos.cs` | `IFileDialog`/`IFileSaveDialog` |
| `AudioVisualIASD/Nucleo.cs` | o processo do jar e o cano de stdio |
| `AudioVisualIASD/Win32.cs` | as chamadas do sistema, num lugar só |
| `AudioVisualIASD/Diario.cs` | o rodapé de diagnóstico da casca — **um `WinExe` não tem console** |

### As armadilhas da casca — todas MEDIDAS, todas silenciosas

Uma varredura adversarial sobre o código recém-escrito achou **nove** defeitos
que nenhum oráculo pegava. Estão corrigidos; ficam aqui porque **todos voltam
com um refactor distraído**.

| a armadilha | como ela falha |
|---|---|
| a folha injetada definir `window.__AVBus` | o `native.js` carrega **depois** e o sobrescreve: o `db.js` assina o objeto dele, e o quadro do barramento cai num ouvinte que ninguém registrou. **O relay fica mudo na RECEPÇÃO** — e em silêncio, porque o `BroadcastChannel` continua entregando. A entrega é por `__avBusDeliver`, o mesmo nome que o `MessageBus.kt` chama |
| declarar `WM_DISPLAYCHANGE` e não tratá-lo | o Telão nasce só na abertura: ligar o projetor depois **não cria janela nenhuma**, e tirar o cabo deixa uma janela órfã |
| tocar o WebView2 fora da thread da interface | ele é COM de apartamento STA, e `Atender` roda na thread do cano: ora funciona, ora devolve `RPC_E_WRONG_THREAD`, ora trava — **a classe de defeito que aparece na máquina do operador e não na de quem escreveu** |
| um `Send` do contexto que só enfileira | quem o chama espera o efeito na linha seguinte. O diálogo nasce **sem dono**, atrás da janela, e o operador vê o app travado |
| não tratar `PermissionRequested` | o WebView2 nega `getUserMedia` **em silêncio** — o botão acende "No ar" e nada capta. É a armadilha do `MicChromeClient`, reproduzida |
| esperar o aperto de mão sem prazo | uma JVM que suba e não escreva nada deixa o programa **pendurado para sempre**: sem janela, sem mensagem, sem nada dizendo por quê |
| guardar geometria com `GetClientRect` | `left`/`top` são sempre 0: sair da tela cheia joga a janela no canto do monitor principal |
| `Console.Error` numa casca `WinExe` | **não há console**: todo diagnóstico da casca ia para lugar nenhum |
| o preâmbulo `__AV_CASCA__` faltar ou quebrar | a folha retorna na entrada, `__AVBridge` não existe, e a página **vira a build de NAVEGADOR** — sem ponte, sem `__NATIVE__`, sem erro. O app abre e parece funcionar até alguém tocar num botão nativo |
| pôr a tecla no `WndProc` | o WebView2 cobre o cliente inteiro, então a tecla vai para a página e a janela nunca a vê. F11 sai do `AcceleratorKeyPressed` |

### As decisões da casca que precisam estar ditas

- **`LacoUi` existe porque o WebView2 é COM de apartamento STA.** Num programa
  WinForms o `SynchronizationContext` vem de graça; numa casca Win32 crua não
  há nenhum, e o padrão do .NET retoma a continuação de um `await` **numa
  thread do pool**. O que sai disso não é uma exceção clara: é uma chamada COM
  de outro apartamento, que ora funciona, ora devolve `RPC_E_WRONG_THREAD`, ora
  trava — *a classe de defeito que aparece no aparelho do operador e não na
  máquina de quem escreveu.*
- **Os diálogos rodam FORA da thread da interface**, numa thread STA própria.
  `IFileDialog.Show` bloqueia até uma PESSOA responder; chamá-lo no laço pararia
  o bombeamento de mensagens das **duas** janelas — projeção inclusive.
- **A navegação para fora do origin é recusada por COMPONENTE do `Uri`**, nunca
  por prefixo de string: `127.0.0.1.exemplo.com` começa com o origin, é um
  domínio que qualquer um registra, e um `StartsWith` autorizaria a navegação
  dentro de uma janela que injeta a ponte em **toda** página.
- **A folha injetada viaja DENTRO do executável** (`EmbeddedResource`). Não é
  economia de arquivo: uma folha em disco é código que roda no origin
  privilegiado e que qualquer coisa pode reescrever — a mesma razão pela qual o
  bundle do OTA fica fora do backup no Android.
- **A JVM morre com a casca, dos dois lados** (o núcleo sai quando o cano fecha;
  a casca mata o processo ao encerrar). Uma JVM órfã seguraria a porta — e a
  porta é a ORIGEM: a abertura seguinte diria "feche a outra cópia" sem haver
  uma.
- **Fechar o Telão não fecha o programa.** É a mesma assimetria do Android:
  perder a `Presentation` é perder a projeção, não a sessão.

---

## §6 A PONTE NO COMPUTADOR

**O `shared/native.js` não muda uma linha por causa dela** — é a medida do
desenho. A folha injetada entrega um `__AVBridge` com a mesma superfície e as
mesmas convenções; o que muda é só o transporte.

| | Android | computador |
|---|---|---|
| ida | `addJavascriptInterface` | `POST /ponte/call?s=<sessao>` |
| volta | `evaluateJavascript("__avResolve(…)")` | um quadro no fio **SSE** `GET /ponte/e?s=<sessao>` |
| injeção | `addJavascriptInterface` | `AddScriptToExecuteOnDocumentCreated` (roda **antes** de qualquer script da página) |

### O envelope

```
AV1\n <id>\n <metodo>\n <quantos>\n   ( <bytes>\n <o argumento>\n )*
```

Duas decisões, e as duas têm modo de falhar próprio:

- **O comprimento é em BYTES, não em caracteres.** `a.length` funciona em todo
  hino sem acento e erra em quase todos os outros — e erra **deslocando** o
  argumento seguinte, não estourando.
- **A quebra depois de cada argumento é a CONFERÊNCIA.** Sem ela, um
  comprimento errado por um byte continua parseando, com o texto trocado de
  lugar. *Um formato que se cala diante de um erro de comprimento é o mesmo
  defeito da invariante 8, num lugar novo.*

**Ele não é JSON**, e o `:core` não ganhou um parser por causa dele: **os
argumentos da ponte são strings, sempre** — inclusive os três que carregam
objeto (`busPost`, `bgProgress`, `nowPlaying`), que no Android já chegam como
`JSON.stringify` e são parseados por quem sabe o que aquele objeto é.

**E ele tem TRÊS ESCRITAS, em três linguagens** — a folha (JS), o
`NucleoPonte.kt` e o `Envelope.cs`. É a forma que este projeto já viu falhar em
silêncio duas vezes (o `__tela` do `display-ready`, o `TIPOS_QUE_SOBEM` do
dreno), e a resposta é a mesma: **fixtures escritas à mão**
(`tools/fixtures/ponte-envelope.json`) que os três leem e **nenhum gera**.

### Os quadros que descem (esses **são** JSON — quem os lê é o navegador)

| `t` | o quê | vira |
|---|---|---|
| `r` | a resposta de uma chamada | `window.__avResolve(id, valor)` |
| `p` | o andamento de uma chamada longa | `__avYtProgress` / `__avDeckProgress` |
| `b` | um comando do barramento vindo da OUTRA janela | o `recv` do `__AVBus` |

**O `POST` devolve só um recibo**; o valor volta pelo fio. Manter essa forma não
é fidelidade cerimonial: é o que faz o `native.js` não mudar.

### A sessão, e por que ela existe

Cada janela recebe da casca um identificador aleatório, que viaja na query das
duas rotas. Ele responde **duas** perguntas que o servidor não teria como
responder sozinho:

1. **Para quem volta a resposta.** No Android o `evaluateJavascript` endereça
   UM WebView; aqui há um fio por janela, e um `resolve` entregue à janela
   errada resolveria a promise homônima dela.
2. **Quem NÃO recebe um comando do barramento.** O `BroadcastChannel` não
   entrega ao próprio emissor e o `MessageBus` exclui a origem — **sem essa
   exclusão o `busPost` do Controle voltaria para o Controle**, e o `__mid` do
   `db.js` **não o pegaria**: aquele conjunto só conhece os mids RECEBIDOS, e o
   emissor nunca viu o próprio.

### Os quatro síncronos

O `native.js` lê três deles **na carga**, antes de qualquer Promise poder ter
resolvido — devolvê-los como Promise faria o app subir com versão 0, papel vazio
e nome vazio, **e nada disso dá erro**.

| método | como | por quê |
|---|---|---|
| `shellVersion()` · `role()` · `appVersion()` | **literais** injetados pela casca no preâmbulo | viram `__SHELL_VERSION__`, `__AV_ROLE__`, `__SHELL_NAME__` |
| `deckExportUrl(link)` | **requisição SÍNCRONA** ao núcleo, respondida no corpo do `POST` | é o único síncrono que precisa de uma resposta. O que o navegador desaconselha é bloquear esperando a REDE; aqui é o mesmo computador respondendo em microssegundos, uma vez, quando o operador importa uma apresentação do Google |

### A rota `/saf/` — a única porta para fora do bundle

`/saf/<sessao>/<token>`. As regras do token são as do `SafRegistry` do Android:

| regra | por quê |
|---|---|
| **opaco**, não o caminho codificado | um caminho do Windows tem `\`, `:` e espaços: viraria segmento de rota e travessia, e ainda revelaria a árvore de diretórios do operador |
| **aleatório** (128 bits), não um contador | as entradas não expiram; `/saf/1..N` não precisa estar ao alcance de quem enumerar |
| **o mesmo arquivo devolve sempre o mesmo token** | sem isso, cada `listFolder` de uma pasta de 500 arquivos acrescentaria 500 entradas a cada re-sincronização, num processo vivo o culto inteiro |
| **ligado à SESSÃO** | é o que reproduz o `withSaf = false` do telão do Android (§4) |

**`listFolder` é do NÚCLEO, não da casca**: quem tem o sistema de arquivos e o
registro é ele. A casca só **escolhe** a pasta, e devolve **caminhos, nunca
URLs**. Ele continua na lista de privilegiados — era a exceção declarada do
Android (lê o `ContentResolver` direto), e aqui é a mesma coisa por ler o disco
direto.

---

## §7 O QUE FALTA — método a método

**MEDIDO** (derivado de `NucleoDespacho.kt` e `Folhas.cs`): a ponte tem **57
métodos**, e hoje eles se dividem assim.

| destino | quantos | quais |
|---|---|---|
| **CASCA**, implementado | 12 | `displays` `pickFolder` `pickDoc` `salvarTexto` `openExternal` `openCast` `castTarget` `temaClaro` `systemVolume` `keepAlive` `projecaoLocal` `requestMic` |
| **NÚCLEO** | 3 | `busPost` `listFolder` `otaConfirm` |
| **NÚCLEO**, síncrono | 1 | `deckExportUrl` |
| **literal** injetado | 3 | `shellVersion` `role` `appVersion` |
| casca, **declarado e ainda não implementado** | 5 | `areaTransferencia` `takeShare` `bgProgress` `nowPlaying` `captureVolumeKeys` |
| **SEM DONO** | 33 | ver abaixo |

> **O que não tem dono resolve `null` NA HORA e é ANOTADO na primeira vez** —
> dos dois lados (`NucleoDespacho` e `Folhas`), no diário da casca. Sem isso ele
> resolveria `null` pelo prazo de 60 s do `native.js`: o botão existe, é
> tocável, e depois de um minuto não acontece nada. *A diferença entre "o
> programa travou" e "esta parte ainda não existe nesta versão" é uma linha de
> diagnóstico.*
>
> **O limite, dito:** a anotação vai para o `casca.log`, **não para o Registro
> de Configurações** — que é onde o operador olha. Levá-la até lá exige um
> método de ponte novo, logo um degrau de `SHELL_VERSION`, logo um lote que
> mexa na ponte por outro motivo. Fica para o lote 4.

### Lote 4 — YouTube e cifra (12 métodos)

> **O número de imports de `android.*` é um PISO, não a medida.** A refutação
> já foi paga uma vez: o `EspelhoDiag.kt` tem **zero** e mesmo assim não
> atravessou para o `:core`, porque usa `org.json`, que é API da *plataforma*
> Android e não da JVM. *"Sem import de `android.*`" não é o mesmo que
> "portável"* — quem responde de verdade é o compilador do módulo puro.

| métodos | de onde vem | portabilidade **medida** |
|---|---|---|
| `cifraHtml` `cifraDiag` | `CifraFonte.kt` — 178 linhas | **1** import de Android (`util.Log`). É o mais barato do lote inteiro: comece por ele |
| `ytFetch` `ytFetchAte` `ytFetchAudio` `ytStream` `ytSearch` `ytPlaylist` `ytCanalPlaylists` `ytCancel` `ytDiscard` `ytDiag` | `YoutubeGrab.kt` — 1.991 linhas | **5** imports rasos: `Context` (→ caminhos), `Uri` (→ `java.net.URI`), `Build` (→ uma string de UA), `SystemClock` (→ `System.nanoTime`), `Log` (→ `stderr`) |

Mais o **`StreamProxy.kt`** (511 linhas, 3 imports, dois deles `webkit`): no
computador ele não é um `shouldInterceptRequest` — vira **uma rota do núcleo**,
irmã da `/m/` do servidor da LAN. **Atenção: ali a invariante 8 se inverte** —
num `ServerSocket` quem aplica o `Range` somos nós.

**Antes de começar o lote 4, meça uma coisa (dez linhas, no CI):** o
`NewPipeExtractor` carrega e inicializa numa JVM de computador? Ver §10 — daqui
não dá, porque o `jitpack.io` está bloqueado.

### Lote 5 — muxer e apresentação (2 métodos + a resolução)

| o quê | de onde vem | o que falta |
|---|---|---|
| `deckPages` `deckDiscard` | `SlideDeck.kt` — 379 linhas, **7** imports (`graphics.pdf` = `PdfRenderer`, `Bitmap`) | um rasterizador de PDF que não seja da plataforma. O `.pptx` **já funciona**: quem o desenha é o `vendor/` do lado web |
| 1080p | `MuxMp4.kt` — 190 linhas, **5** imports, todos `android.media` | juntar as duas faixas sem recodificar. Até lá, **teto de 720p** (o progressivo) |

**Uma armadilha que o Android já pagou, e que o computador REABRE por outro
campo.** Lá o defeito das v5.97–v5.99 foi perguntar `startsWith("https://")`
para decidir "é da rede ou é local?", o que mandava **todo arquivo do aparelho**
para o caminho de download; hoje ele pergunta certo, pelo **host**
(`u.host == WebViewFactory.ORIGIN_HOST`, `SlideDeck.kt:127`), e o ramo `https` é
o do download da exportação do Google (`:150`).

**No computador os dois ramos erram**, e é por isso que ele não se porta como
está: uma URL de `/saf/` é `http://127.0.0.1:8420/…` — o host não é o do
Android, e o esquema não é `https`. O port precisa da sua própria constante de
origem, e a pergunta continua sendo pelo **host mais a porta**, nunca pelo
esquema.

### Lote 6 — as telas da rede (9 métodos)

`espelhoLigar` `espelhoLigarEm` `espelhoDesligar` `espelhoEstado` `espelhoDiag`
`espelhoDerrubar` `espelhoCertImportar` `espelhoCertEstado` `espelhoCertApagar`.

**A metade difícil já está no `:core`** — `EspelhoHttp`, `EspelhoPares`,
`EspelhoMidiaCache` e `EspelhoInterfaces` são puros e já têm JUnit. Falta o
`EspelhoServidor.kt` (2.417 linhas, **8** imports: `ConnectivityManager`,
`Network`, `NetworkCapabilities`, `LinkProperties`…): **a metade de socket é
portável; a de DESCOBERTA DE REDE não é.**

**E atenção a uma armadilha ao portar a descoberta.** O `EspelhoInterfaces` é
PURO porque ele **recebe as leituras por parâmetro** — quem as faz é o
`EspelhoServidor.lerInterfaces(ctx)`, e ela tem duas metades bem diferentes:

| a leitura | portabilidade |
|---|---|
| as interfaces cruas (nome, IP, no ar) | `java.net.NetworkInterface` — **JVM padrão**, atravessa sem mudança |
| o mapa `reivindicadas` — *qual `Network` reivindica esta interface* | **não existe fora do Android.** É `ConnectivityManager`, e é justamente ele que faz a regra funcionar: o ponto de acesso é a única interface *que nenhum `Network` reivindica*, porque não é uma rede que o aparelho USA, é uma que ele SERVE |

Ou seja: **a regra do `EspelhoInterfaces` não se porta como está** — o
discriminador dela some no Windows. Ali a pergunta equivalente é outra (o
"Mobile Hotspot" do Windows, ou simplesmente deixar o operador escolher a
interface), e **isso é decisão de projeto a tomar no lote 6, não um port**.

Mais o `EspelhoMidiaCanal.kt` (o empurrão OPFS → cache, hoje por
`WebMessageListener` do WebView): no WebView2 o equivalente é
`WebMessageReceived` — **é trabalho da casca**, não do núcleo.

> `espelhoLigar` e `espelhoLigarEm` **já estão na lista de privilegiados** da
> invariante 9, apesar de ainda não terem dono. Foi de propósito: quando eles
> ganharem implementação, a guarda já está lá.

### Lote 7 — empacotar e distribuir

Um `.exe` sem assinatura dispara o SmartScreen, e em PC gerenciado pode ser
bloqueio de verdade. **Duas portas, nenhuma paga:**

| via | o que é | o preço |
|---|---|---|
| **Microsoft Store (MSIX)** | a principal. Registro individual **gratuito desde set/2025**; a Microsoft **reassina o pacote**, então o operador **nunca vê o aviso**, instala sem admin e atualiza sozinho | submeter |
| **ZIP portátil** | o recuo para o PC com a Loja desativada por política. Descompacta e abre, sem instalar e sem admin | **ainda mostra o aviso** na primeira execução — o mesmo do "app fora da loja" que a página já explica no guia do Android: **instruir, não pagar** |

O modelo de permissão do MSIX combina com o do app: acesso amplo a disco é
capacidade restrita, mas **acesso pelo seletor de arquivos é livre** — que é
exatamente como o SAF já funciona.

**O QUE O PACOTE PRECISA CONTER**, porque a lista é maior do que parece — o
`Programa.Main` monta **quatro** caminhos ao lado do executável, e faltando
qualquer um o programa não abre:

| ao lado do `.exe` | o quê | faltando ele |
|---|---|---|
| `web/` | **a base web inteira** | o núcleo recusa com `SemBundle` — "os arquivos do aplicativo não foram encontrados" |
| `nucleo.jar` | o núcleo (`./gradlew :core:nucleoJar`) | o Java não sobe, e a casca mostra a frase do erro |
| `jre/bin/javaw.exe` | o Java embutido | cai no `javaw.exe` do PATH; sem nenhum dos dois, a mesma frase |
| (o WebView2 runtime) | **não vai no pacote** — já está em todo Windows 10/11 | a casca diz para instalar o "Microsoft Edge WebView2 Runtime" |

**Não verificado:** o caminho `makeappx` embrulhando os três primeiros. Medir
antes de prometer a Loja.

### O que provavelmente NÃO faz sentido no computador

Está aqui para a decisão ser tomada uma vez, e não a cada lote.

| métodos | por quê |
|---|---|
| `otaPending` `otaApply` `otaCheck` `otaDiag` `atualizacaoEstado` `apkProcurar` `apkInstalar` | o OTA existe porque no Android a base web chega em minutos e o APK só instalando. No computador **a base viaja dentro do programa**, e quem atualiza é a Loja (ou o ZIP novo). Eles devem responder o **valor neutro**, não `null` — uma tela de Configurações que pergunta e não é respondida fica esperando |
| `micDiag` | ele responde *"por que o microfone não abre"* lendo `AppOpsManager`, o interruptor de privacidade e o modo de áudio — **fenômeno exclusivamente Android**. No Windows quem decide é o `PermissionRequested` do WebView2 |
| `takeShare` | o `ACTION_SEND` do Android não tem equivalente direto. O caminho do computador é o seletor de arquivos, que já existe |
| `captureVolumeKeys` | no Android ele existe para tirar o painel de volume do sistema **de cima da projeção**. Num computador o painel não aparece na tela secundária, então o problema não existe |

E dois que fazem sentido e ainda não têm dono:

- **`nowPlaying` / `bgProgress`** — no Windows o equivalente do `MediaSession` é
  o **SMTC** (WinRT), que exige um alvo `net8.0-windows10.0.x`. **Ele não vem de
  graça**, e pode degradar para "sem controle fora da janela".
- **`areaTransferencia`** — o link do YouTube copiado. `OpenClipboard` +
  `GetClipboardData(CF_UNICODETEXT)`, ~30 linhas na casca. **A PERGUNTA antes de
  entregar o link continua sendo obrigatória**: copiar não é um pedido.

---

## §8 O QUE ESTE REPOSITÓRIO CONSEGUE PROVAR — e o que não

**A premissa mudou no meio do trabalho, e para melhor.** O plano dizia que dos
lotes 3 em diante só seria possível *escrever* código. Hoje:

| camada | escrever | compilar | **rodar** |
|---|---|---|---|
| base web (`assets/web/`) | sim | — | **sim**, Chromium de verdade |
| `:core` (o núcleo, Kotlin) | sim | **sim** (arnês, §10) | **sim** — 208 testes JUnit, e o jar SERVINDO a base |
| a casca (C#) | sim | **sim** — `net8.0-windows` sem WinForms compila em Linux | **as janelas, não** |
| o codec da ponte em C# | sim | sim | **sim** — ele é `net8.0` portátil de propósito |
| MSIX / Loja | — | — | não: exige Windows e conta Microsoft |

**O que fez a casca compilar aqui foi uma decisão, não sorte:** `net8.0-windows`
**sem** WinForms/WPF. O SDK do Windows Desktop não existe fora do Windows, e um
projeto que dependesse dele só compilaria num runner `windows-latest` — a metade
da casca que não é regra de culto deixaria de ser conferível junto com o resto.
A hospedagem do WebView2 não perde nada: o controle de WinForms é uma casca fina
sobre `CreateCoreWebView2Controller(HWND)`.

### O que TEM oráculo

**70 testes JUnit** no `:core` só para a segunda casca (de 208 no total), mais
**67 asserções** de Node/C#, mais **25** em Chromium.

> Os números entre parênteses são **pontos de chamada**, e não execuções: uma
> asserção dentro de um laço conta uma vez. Reconte-os antes de citá-los — é a
> regra deste repositório, e ela vale para o próprio documento.

| oráculo | onde roda | o que ele trava |
|---|---|---|
| `NucleoRotasTest` (14) | JUnit | o que uma rota **É**; a **travessia de diretório**; a **barra invertida** — ela está lá porque o alvo é o Windows, onde `\` também separa caminho e uma guarda escrita só com `/` a deixaria passar |
| `NucleoServidorTest` (18) | JUnit, **sockets de verdade** | o bind **só no loopback**; a recusa de porta ocupada — **e que a frase não mande trocar a porta**; o teto de corpo da ponte; o fio SSE **endereçado**; o enquadramento `chunked` |
| `NucleoPonteTest` (9) | JUnit | o envelope contra as fixtures, e o cano de stdio |
| `NucleoDespachoTest` (14) | JUnit | a **invariante 9 recusada no servidor**; o barramento excluindo o emissor; o que não tem dono ficando visível; o síncrono |
| `NucleoArquivosTest` (15) | JUnit | a rota `/saf/`: token opaco e estável, a sessão, a listagem não recursiva |
| `ponte-envelope.test.mjs` (19) | Node puro | o produtor **JavaScript** do envelope, **e que a folha ofereça exatamente os 57 métodos que o `native.js` chama** — um a menos vira `TypeError` engolido pelo `catch`, com o botão mudo em culto |
| `AudioVisualIASD.Testes` (14) | .NET, **em Linux** | o terceiro lado do envelope. Portátil de propósito: um contrato de três lados em que só dois têm oráculo é um contrato de dois lados outra vez |
| `casca-contrato.test.mjs` (10) | Node puro | **as listas que moram em duas linguagens**: o degrau do contrato (`SHELL_VERSION` × `SHELL`), o que atravessa o cano (`DA_CASCA` × os `case` da casca) e a lista da invariante 9 — **e que o §7 deste documento não envelheça** em relação ao código |
| `nucleo-de-pe.test.mjs` (24) | Node + JVM | **o programa DE PÉ**: o aperto de mão `NucleoMain` ↔ `Nucleo.Ligar()`, a base servida de verdade, o `Range`, a travessia **por socket cru**, a ponte de ponta a ponta e o `/saf/` com a invariante 9 |
| `janela-do-display.test.mjs` (15) | Chromium | duas páginas do mesmo origin dividindo IndexedDB e barramento — **o primeiro oráculo deste repositório que abriu uma segunda janela** |
| `degrau-desktop.test.mjs` (10) | Chromium | o layout de duas colunas, medindo **o que o desenho reserva**, nunca a soma renderizada |

**Onde eles rodam:** o job **`segunda-casca`** do `.github/workflows/apk.yml`, a
cada push. **Ninguém o tem como `needs`, e isso é decisão:** o `verificar` fecha
o canal OTA e o `apk` produz o APK — **uma casca de Windows quebrada não pode
segurar nenhum dos dois**, porque ela não entra no bundle nem no APK.

> **Cada guarda deste trabalho foi provada por REVERSÃO** — quebrada de
> propósito, para ver o oráculo reprovar. Uma guarda sem reversão é uma guarda
> que ninguém sabe se está ligada.

### O que SÓ se prova na máquina do operador

Nomeado, para não virar suposição:

- **As janelas.** Que o WebView2 sobe, que o `AddScriptToExecuteOnDocumentCreated`
  injeta antes dos scripts da página, que as duas janelas de fato compartilham
  IndexedDB/OPFS, e que o `BroadcastChannel` atravessa entre elas.
- **Os codecs.** Altíssima confiança (o WebView2 é o Edge), mas confirmável em
  dois minutos com o bloco "Codecs" que o Registro **já imprime**.
- **Os monitores.** Que a janela do Telão nasce no secundário, sem moldura, e
  que `WM_DISPLAYCHANGE` a cria e derruba com o cabo.
- **Os diálogos de arquivo.** As interfaces COM estão declaradas por GUID; a
  vtable só se prova executando.
- **O `IFileDialog` fora da thread da interface** — que o laço continua girando
  enquanto o operador escolhe uma pasta.
- **O SMTC** (`nowPlaying`): não vem de graça; pode degradar para "sem controle
  fora da janela".
- **O antivírus** diante de um pacote grande.
- **A projeção de verdade**, com um projetor ligado, **num dia sem culto**.

---

## §9 O QUE FOI TENTADO E RECUSADO

Está aqui para ninguém rederivar. Cada linha custou uma investigação.

| caminho | por que NÃO |
|---|---|
| **PWA / site** | as três funções exigidas faltam num navegador, cada uma por um motivo diferente (§1) |
| **JCEF / CEF embarcado** | builds de CEF vêm com **H.264/AAC desligados por patente** (JetBrains `JBR-2368`). O hinário `.mp3` tocaria e **o YouTube, a transmissão direta e todo `.mp4` importado não** — e o YouTube é uma das três funções exigidas |
| **WinForms / WPF** | o SDK do Windows Desktop não existe fora do Windows: a casca deixaria de compilar em qualquer lugar que não fosse um runner `windows-latest` (§8) |
| **WebSocket (RFC 6455)** | o projeto o recusa por falta de oráculo; escrevê-lo aqui seria o argumento aplicado contra ele mesmo. O SSE que as telas da rede já usam resolve |
| **Um socket por janela** | seriam dois origins, logo dois IndexedDB. A porta é a origem |
| **Pegar outra porta livre na colisão** | apagaria a biblioteca do operador em silêncio (§4) |
| **Um servidor só, com uma bandeira `ehLocal`** | é a forma exata de vazar o `controle/` para a rede da igreja no primeiro refactor distraído. São **dois servidores**, e o da LAN continua recusando `controle/` |
| **Um parser de JSON no `:core`** | desnecessário: **os argumentos da ponte são strings**, sempre — inclusive os três que carregam objeto, que no Android já chegam como `JSON.stringify` |
| **`org.json` do Maven** | a cláusula "Good, not Evil" não é licença livre reconhecida e não combina com a GPLv3 deste repositório |
| **`deckExportUrl` como Promise** | encolher uma assinatura publicada custa um degrau de `SHELL_VERSION` **nas duas cascas**, com a do Android pagando por uma mudança que não é dela |
| **Um job de CI `windows-latest`** | o plano previa um; **não foi preciso** — a casca compila no runner Linux que já existe |
| **Sincronizar acervo entre celular e computador** | fora de escopo por decisão: as duas versões são independentes (§2) |
| **Certificado de assinatura pago** | OV custa ~US$216/ano e **o EV não pula mais o aviso desde 2024**. A Loja resolve de graça (§7) |

### Uma afirmação do plano que foi REFUTADA

O plano registrava um "defeito latente": `controle.js` chama
`AVNative.farolContar` sem guarda e sem `try/catch`. **É falso positivo.** A
linha `#farolRow` nasce `hidden` no HTML e só é revelada quando `__NATIVE__` é
verdadeiro **e** o shell respondeu (`renderFarolSeg`); num navegador o botão não
existe para ser tocado. Não entrou em `docs/ACHADOS-EM-ABERTO.md` por isso.

---

## §10 O AMBIENTE — o que a máquina de desenvolvimento permite

**MEDIDO nesta sessão.** Um agente que retome o trabalho perde uma hora
redescobrindo isto.

| ferramenta | estado |
|---|---|
| JDK | 21 (Temurin no CI, `openjdk 21` aqui) |
| Gradle | 8.14.3 |
| .NET SDK | 8.0.130, **sem** `Microsoft.NET.Sdk.WindowsDesktop` |
| Node | 22 |
| Chromium | pré-instalado, com Playwright pinado no `package-lock.json` |

| repositório | daqui | no CI |
|---|---|---|
| Maven Central | **200** | 200 |
| nuget.org | **200** | 200 |
| `dl.google.com` (o AGP) | **bloqueado** | 200 |
| `jitpack.io` (o NewPipeExtractor) | **bloqueado** | 200 |

**Consequência prática: `./gradlew :core:test` NÃO funciona aqui** — a raiz
inclui o `:app`, que precisa do AGP. O que funciona é um **arnês fora do
repositório**, que monta só o `:core`:

```kotlin
// settings.gradle.kts do arnês, num diretório qualquer FORA do repositório
pluginManagement {
  repositories { mavenCentral(); gradlePluginPortal() }
  plugins { id("org.jetbrains.kotlin.jvm") version "2.0.21" }
}
dependencyResolutionManagement { repositories { mavenCentral() } }
rootProject.name = "arnes-core"
include(":core")
project(":core").projectDir = file("/caminho/para/o/repositorio/core")
```

```bash
cd <arnês> && gradle --no-daemon :core:test          # os 208 JUnit
cd <arnês> && gradle --no-daemon :core:nucleoJar     # o jar, para o nucleo-de-pe
```

> **O arnês NÃO entra no repositório.** Ele existe porque *esta máquina* não
> alcança o `dl.google.com`; o CI alcança, e lá o comando é o do `LEIA-ME.md`.

**E o `NewPipeExtractor` não é resolvível daqui** (jitpack bloqueado), então a
medição "ele carrega numa JVM de computador?" — a única das seis do plano que
ainda importa para o lote 4 — **tem de ser feita no CI**, como um passo do job
`segunda-casca`. É um `main()` de dez linhas: `NewPipe.init`, e imprimir
`ServiceList.YouTube.serviceInfo.name`.

---

## §11 COMO CONTINUAR

```bash
# a casca compila em Linux
dotnet build windows/AudioVisualIASD/AudioVisualIASD.csproj

# os três oráculos da ponte, um por linguagem
node tools/ponte-envelope.test.mjs                    # o produtor JavaScript
dotnet run --project windows/AudioVisualIASD.Testes   # o lado da casca
#   (o lado Kotlin é o NucleoPonteTest, dentro de :core:test)

# o núcleo DE PÉ, servindo a base de verdade (precisa do jar — ver §10)
node tools/nucleo-de-pe.test.mjs
```

**Ao fechar um lote:**

1. `:core:test` verde e os três oráculos da ponte verdes.
2. Prove cada guarda nova **por reversão** — quebre-a e veja o oráculo reprovar.
   Uma guarda sem reversão é uma guarda que ninguém sabe se está ligada.
3. Atualize **a tabela de Estado deste arquivo, no MESMO commit**.
4. Se a superfície da ponte mudar, suba `SHELL_VERSION` **nos dois lados**
   (`NativeBridge.SHELL_VERSION` e `Programa.SHELL`) — o número é um só, porque
   a superfície é uma só. **O `casca-contrato.test.mjs` reprova se você esquecer
   um dos dois**, e reprova também se a tabela da §7 divergir do código.
