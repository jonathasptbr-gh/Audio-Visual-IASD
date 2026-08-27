# Auditoria profunda — agosto de 2026

Varredura completa do repositório atrás de **defeitos, código morto e
otimizações**, em etapas sequenciais. Cada achado passou por um verificador
adversarial cuja tarefa era REFUTÁ-LO por seis vias (trecho verbatim, guarda no
chamador, decisão já documentada, `ACHADOS-EM-ABERTO.md`, oráculo que já cobre,
sequência que o Android/navegador não produz).

> **Estado: a auditoria foi INTERROMPIDA por limite de orçamento**, com o
> `controle.js` varrido só em parte. As Etapas 1 e 2A estão **completas e
> verificadas** — só o que sobreviveu ao cético está nelas. A Etapa 2B está
> registrada como **hipóteses NÃO verificadas**, e está marcada como tal.
>
> **Este arquivo é um INVENTÁRIO, não a lista de trabalho.** Um achado que for
> aceito e corrigido sai daqui; um que for aceito e adiado migra para
> `docs/ACHADOS-EM-ABERTO.md`, que é onde mora o que MUDA COMPORTAMENTO e ainda
> não foi corrigido. Nenhum destes foi corrigido ainda.

## Linha de base da auditoria

| | |
|---|---|
| oráculos verdes antes de começar | **41/41** (30 em Chromium + 11 Node puro) |
| JUnit | **não executável** neste ambiente — o proxy bloqueia `dl.google.com` e o plugin AGP 8.7.3 não resolve. Os cinco testes cobrem arquivos PUROS, lidos à mão em compensação |
| ponte `AVNative` | **54/54** métodos casados entre `native.js` e `NativeBridge.kt`, zero divergência |
| `SHELL_VERSION` × `minShell` | 56 × 56 |
| versão nos três lugares | `1.3.13` em `version.json`, `WEB_VERSION` e `#appVersion` |
| `notas.json` | 81 entradas, em ordem, sem duplicatas |

---

## Etapa 1 — o shell Kotlin (28 arquivos, 15.742 linhas)

27 achados brutos · **19 confirmados** · 8 refutados.

### Correção

| # | Onde | O defeito |
|---|---|---|
| K1 | `MainActivity.kt:1243` | **`projecaoLocal` não alcança a preview em TELA CHEIA** — que é exatamente o modo em que ela É a projeção sem TV. Ao entrar em fullscreen o Chromium cria uma `FullScreenView` e transfere para ela o `AwViewMethodsImpl`, deixando a View original com um `NullAwViewMethods`; os dois pontos que `KeepVisibleWebView` sobrepõe deixam de ser consultados. Minimizar cala o louvor. **A verificar em aparelho** — a metade decisiva é sobre código de terceiro |
| K2 | `NativeBridge.kt:1158` | **`cifraHtml` satura a fila `extracao`** (thread única) que ela divide com `ytStream`/`ytSearch`/`deckPages`. `syncCifrasAcervo` roda na abertura com `NET_CONCURRENCY = 6` e `CifraFonte.TEMPO_MS` vale para connect E read (até 30 s cada), então há ~6 requisições permanentes à frente do toque do operador. "Tocar agora" pode vencer os 60 s do `CALL_TIMEOUT_MS` e cair no download, calado. **E `cifraHtml` não toca no NewPipe** — a única razão de aquela fila ser serial |
| K3 | `NativeBridge.kt:262` | **`snoopStatusDeFora` não elege uma tela.** Ele implementa a precedência telão × telas, mas não a eleição ENTRE telas que o `controle.js` faz (`controle.js:23356`). Com 2–3 telas pareadas a ~4 Hz cada, a notificação de mídia alterna entre N fontes — exatamente o que a precedência existe para impedir, e justamente sem TV, quando este snoop é a única fonte viva |
| K4 | `SlideDeck.kt:129` | **PDF de provedor que serve por pipe nunca abre.** Google Drive/OneDrive devolvem um `ParcelFileDescriptor` de `openPipeHelper` (não-seekable) para arquivo sem cache local; `PdfRenderer` exige seekable e lança. O operador vê `IllegalArgumentException: …`, que não sugere ação nenhuma |
| K5 | `ShareIntake.kt:42` | **Ponto de entrada EXPORTADO lê extras sem `try/catch`.** Qualquer app pode mandar um share com Parcelable de classe ausente; o Bundle é desserializado inteiro no primeiro acesso e a `BadParcelableException` sobe até o `onCreate`, derrubando o app antes de `consumeShareIntent` rodar |
| K6 | `WebUpdater.kt:709` | `checking` é adquirido FORA do `try` e liberado só no `finally` de dentro da thread: se a thread não nascer, **o canal OTA fica inerte pelo resto do processo** |
| K7 | `ShellUpdater.kt:201` | `procurar()` guarda a tag CRUA (`"v1.3.12"`) e `novidade()` a compara contra a versão LIMPA — o achado é descartado no instante seguinte |
| K8 | `SessionService.kt:573` | `updateFromDisplay` faz ler-calcular-gravar em `scene` de outra thread: um `Parar` que cruze com um `display-status` em voo **ressuscita a cena morta** e o serviço volta com o cartão do louvor que acabou de sair |
| K9 | `EspelhoEnergia.kt:260` | Corrida entre `renovarWakeLock` (threads do servidor) e `releaseWakeLock` (main) deixa um `PARTIAL_WAKE_LOCK` de 2 h órfão |
| K10 | `EspelhoServidor.kt:1102` | `fecharSse` com adeus não fecha o socket, e depois do `desligar()` não sobra ninguém para fechá-lo |
| K11 | `WebViewFactory.kt:171` | O fundo PRETO fixo do WebView cobre o `root` pintado com o tema — o piscar no tema claro continua |

### Código morto

| # | Onde | O quê |
|---|---|---|
| K12 | `EspelhoMidiaCanal.kt:81` | **`soltar()` não tem chamador.** A fila e o `tokenAberto` nunca são zerados, e o `poll` de 250 ms vira uma thread acordando 4×/s pela vida do processo |
| K13 | `SyncService.kt:195` | Guardas de `Build.VERSION_CODES.O` **sempre falsas** (`minSdk = 26` É o `O`): o `return` do `ensureChannel` e o ramo `ctx.startService` do `start` são inalcançáveis |
| K14 | `YoutubeGrab.kt:1043` | `baixarTentando` nunca retorna com arquivo vazio — os três testes de "veio vazio?" dos chamadores são ramos inalcançáveis, e `Desfecho.NaoMontou` por download vazio nunca acontece |
| K15 | `SlideDeck.kt:47` | O KDoc manda enfileirar este arquivo na fila `io` — a fila em que o `CLAUDE.md` proíbe rede, e da qual o `NativeBridge` diz que o `deckPages` foi tirado |
| K16 | `NativeBridge.kt:759` | O comentário do bloco do espelho contradiz o código em duas afirmações: **"os cinco métodos"** (são oito — os três do certificado entraram depois) e **"quem faz o trabalho é a MAIN THREAD"** (falso para quatro dos oito) |
| K17 | `EspelhoHttp.kt:368` | O KDoc de `chunkFinal` afirma quem o chama, e os três chamadores reais são outros |
| K18 | `EspelhoServidor.kt:1077` | `ultimaSaida.haMs` é uma constante `0` que ninguém lê — e o nome promete um número que o campo nunca vai carregar |
| K19 | `EspelhoPares.kt:91` | Dois KDoc citam `[recusar]`, método apagado na v5.185 |

---

## Etapa 2A — base web: `shared/`, `display/` (5.445 linhas)

16 achados brutos · **11 confirmados** · 5 refutados. Vários confirmados **por
execução** em Chromium de verdade, não por leitura.

### Correção

| # | Onde | O defeito |
|---|---|---|
| W1 | `db.js:688` | **`lerDetentores` não desce nos ids de dentro de um cue `group` (o PACOTE).** Salvar a fila no Cronograma e depois trocar a fila apaga as mídias, e o pacote sobrevive apontando para bytes que já não existem — `abrirPacote` cai em "as mídias saíram do aparelho" só no sábado. **PROVADO POR EXECUÇÃO** (Playwright + IndexedDB real): `{"midiasVivas":0,"cueVivo":true}`. A isenção documentada no `HISTORICO.md` é escopada ao pacote do SORTEIO, cujos ids vivem no store `files` (imune ao coletor); `guardarPacote` não tem essa restrição — aceita importados e downloads do YouTube, que vivem em `media` |
| W2 | `stage.js:918` | **O indicador de espera do stream fica girando sobre a projeção.** MEDIDO: stream → áudio-sem-letra (o louvor de fundo, o caso mais comum de culto) deixa o aro girando aos 4 s e ainda aos 18 s, muito além do `PRONTO_STREAM_MS` de 15 s. O `.av-stage-busy` e o `#wallpaper` têm o mesmo `z-index`, e o giro vem depois no documento — ele pinta SOBRE o wallpaper. O ponto de conserto é o começo do `loadInner`, não a troca de load |
| W3 | `stage.js:649` | O `forceMuted` pendente vive só num `setTimeout` que quatro métodos públicos cancelam sem aplicá-lo — **provado por execução** |
| W4 | `display.js:767` | **`restoreSceneAfterText` lê `stage.getCurrent()` sem saber que há um `load` em voo**: um `text-hide` que chegue nessa janela remonta a letra do hino ANTERIOR sobre a música nova. **Reproduzido por execução** |
| W5 | `display.js:681` | A IMAGEM SOBRE O ÁUDIO é o único consumidor de `/m/<token>` **sem ladeira de retentativa**: na tela da rede, falhando, fica um cartão preto opaco sobre a projeção até alguém trocar a cena. **Reproduzido por execução** |

### Código morto

| # | Onde | O quê |
|---|---|---|
| W6 | `stage.js:673` | O comentário de `resetMediaDom` afirma que **"o começo de todo load passa por aqui, então o giro nunca sobrevive à cena que o acendeu"**. `resetMediaDom` tem dois chamadores: `clear()` e `fadeOutToBlack()` — `load`/`loadInner` não chamam nenhum. É a mesma raiz de W2: o comentário promete a garantia que falta. O cabeçalho da própria função, três linhas acima, diz certo |
| W7 | `native.js:43` | O cabeçalho do watchdog afirma que `otaAppIsUp` **não** cobre os módulos que ele cobre 50 linhas abaixo, e lista a cadeia de scripts do Controle com dois arquivos a menos |
| W8 | `native.js:427` | **`salvarTexto` foi inserido DENTRO do bloco de comentário da CIFRA:** o cabeçalho `---- CIFRA ----` passou a encabeçá-lo e `cifraHtml` ficou sem documentação. **Confirmado por execução da própria ferramenta do projeto** (`tools/pares-de-comentario.mjs`) |
| W9 | `db.js:457` | O comentário afirma que "o gc só roda dentro de `listRemove`" — mas `AVDB.gc()` é chamado direto do `controle.js:6319` e existe `gcOrfaos` (`controle.js:24038`). A mesma frase se repete na linha 758 |
| W10 | `display.js:44` | Quatro comentários do embed do YouTube (removido na v5.212) afirmam no PRESENTE mecanismos que não existem |
| W11 | `display.js:795` | O comentário que explica a regra da cortina em `reconcileCover` **termina no meio da frase** ("Só vale quando a cena é do") |

---

## Etapa 2A (resto) — `espelho/tela.js` e os módulos puros (3.467 linhas)

12 achados brutos · **9 confirmados** · 3 refutados. Os dois primeiros foram
provados **por execução**, instrumentando o próprio `tools/tela-rede.test.mjs`.

### Correção

| # | Onde | O defeito |
|---|---|---|
| T1 | `tela.js:214` | **`anuncio()` reenvia o MESMO `__mid`, e o Controle o descarta como duplicata.** `prontoUltimo` é o objeto que `sendCommand` já carimbou, e `Object.assign` copia o carimbo junto; do outro lado, `deliverCommand` faz `if (bus && alreadySeen(msg.__mid)) return` antes de qualquer handler. Resultado: numa queda de fio, `resendSceneToDisplay` e `telaReenviarPreferencias` NÃO rodam — se o operador trocou a cena durante a queda, a tela volta ERRADA e calada. **MEDIDO**: dois `display-ready` com `__mid` idêntico; entregando-os ao `AVDB.onCommand` real, o handler recebe 1 de 2. O `db.js:890` documenta esta armadilha nominalmente. Recarga e primeira ligada escapam (o `MID_PREFIX` é sorteado por página); só a **queda de fio** quebra |
| T2 | `tela.js:419` | **O 404 do fio desenha um balão sobre a projeção.** `#telaAviso` é `position:fixed; bottom:8%; z-index:9998` — uma pílula escura no rodapé da projeção por 6 s, na frente da congregação. Contradiz o KDoc do próprio `cairToken` e a política que o `postar` aplica ao MESMO evento. **MEDIDO** |
| T3 | `cifra.js:340` | **A gramática do acorde recusa a família `X7/9`** (tensão depois da barra) — `C7/9`, `C6/9`, `A7/13`, `Em7/9`, `G7/11`. É a notação Chediak, a que o Cifra Club usa. O acorde recusado volta INTACTO da transposição e **fica parado no tom original com a folha inteira andando à volta dele** — o defeito exato da v1.1.13 (o `7M` que faltava), noutra família. **MEDIDO**: `pareceAcorde('C7/9') === false`, `transporAcorde('C7/9', 2) === 'C7/9'` |
| T4 | `tela.js:794` | A guarda que deveria re-pedir a trava de tela nunca dispara: o navegador não zera a variável ao liberar o wake lock — o `WakeLockSentinel` passa a ter `released === true` mas o objeto continua truthy |
| T5 | `bible.js:187` | **`stripHtml` LANÇA numa entidade fora de faixa.** `String.fromCodePoint(parseInt(...))` sem guarda: `&#1114112;` dá `RangeError` e derruba o capítulo inteiro. **MEDIDO**. O `cifra.js:245` já tem a guarda certa — este arquivo não tem oráculo próprio |

### Código morto

| # | Onde | O quê |
|---|---|---|
| T6 | `cifra.js:5` | **O cabeçalho declara como CONTRATO** ("Isso é contrato do recurso, não detalhe") que *"nada é baixado em lote"* e que *"nada é gravado em disco — o cache é um `Map` em memória, morto ao fechar o app"*. As duas coisas deixaram de valer: `syncCifrasAcervo()` roda na abertura sobre `allCollections()` inteira, e as cifras são gravadas no IndexedDB desde a v1.2.14 |
| T7 | `tela.js:581` | O cabeçalho da entrada descreve, no presente, duas formas de ativação; a segunda (o "botão discreto de canto" e a recarga que "recomeça por trás") foi revogada na v5.218, e o código 260 linhas abaixo faz o OPOSTO e diz isso por extenso |
| T8 | `cifra.js:553` | `somenteLetra` é exportada e **nunca teve chamador** (`git log -S` não devolve commit nenhum); só o oráculo a exercita. O KDoc descreve um recurso do operador que não existe em tela |
| T9 | `cifra.js:217` | O parâmetro `extra` de `urlDeBusca` não tem chamador de produção, e o KDoc põe o SEGUNDO TENTO nele — mas quem o compõe é o `controle.js:10334`, um nível acima |

---

## Achados da varredura mecânica

Encontrados por análise estática do repositório inteiro, fora dos workflows.

| # | O quê |
|---|---|
| M1 | **`tools/pares-de-comentario.mjs` não roda em workflow nenhum.** É a única prova que pega bloco que mudou de ALVO, e o `CLAUDE.md` a exige como a "prova 2" da poda de comentário. Rodando-a contra a v1.1.16 ela acha W8 e o `display.js:152` — o parágrafo "O TELÃO NÃO RECUPERA SOZINHO uma **transmissão** que falhou" (que explica `onStreamErro`) hoje encabeça `onError`, com `onStreamErro` logo abaixo sem comentário. **Ressalva medida:** a ferramenta dá falso positivo em blocos JSDoc, porque casa pelo cabeçalho e a primeira linha de todo `/** */` é `*`. Pôr no CI exige tratar isso antes |
| M2 | **`--accent-glow`, `--brand-soft` e `--danger`** são definidos nos DOIS temas de `tokens.css` e nunca consumidos por `var()` em lugar nenhum |
| M3 | `AVNative.otaPending` e `AVNative.apkProcurar` **não têm consumidor** em toda a base web nem em `tools/` — `atualizacaoEstado` os substituiu. São wrappers de ponte órfãos: a lógica subjacente (`WebUpdater.pendingVersion`, `ShellUpdater.procurar`) continua viva por outros caminhos, então remover os wrappers não remove comportamento. O `CLAUDE.md` ainda os documenta como ativos. *(Refutado como "defeito" pelo verificador — provado por execução que o fluxo do OTA passa com os dois lançando. Fica registrado como inventário, não como defeito.)* |

---

## O que ainda não foi auditado

| Escopo | Linhas | Estado |
|---|---|---|
| `controle/controle.js` | 24.516 | **parcial** — ver a Etapa 2B abaixo |
| CSS, HTML, workflows do CI | — | não auditado |

---

## Etapa 2B — `controle/controle.js` — **INTERROMPIDA**

Interrompida por limite de orçamento com **2 das 6 fatias** concluídas (linhas
1–8250). As fatias C–F estavam em andamento e ainda produziram achados antes da
parada.

> ### Estes 24 achados NÃO passaram pelo verificador adversarial
>
> Todos os das etapas anteriores passaram; estes não. Nas Etapas 1 e 2A o cético
> derrubou **16 de 55** (29%), inclusive achados que pareciam sólidos na leitura.
> Trate a lista abaixo como **hipóteses a verificar**, não como defeitos
> confirmados. Retomar a auditoria começa por rodar a verificação sobre eles.
>
> Os cinco marcados *(medido)* foram provados por execução pelo próprio auditor
> que os encontrou — mas ainda assim sem o cético, cuja função é justamente
> checar se o cenário medido é o cenário que o app produz.

### O que eu confirmei à mão antes de parar

**`controle.js:10718` — `syncCifrasColecao` chama `cifraProcurar` com a
assinatura ANTIGA.** Verificado por leitura direta:

```
10180:  async function cifraProcurar(nome, coll, opts)     <- 3 parâmetros
10718:  await cifraProcurar(h.nome, coll, chave, { ... })  <- 4 argumentos
```

A v1.3.3 removeu o parâmetro `chave` e atualizou o chamador do `cifraGarantir`,
mas não este. O `opts` recebe a STRING `chave`, e `mudo`, `semDisco` e
`semBusca` saem todos `undefined`. **A consequência é contra o contrato escrito
no CLAUDE.md:** perder o `semBusca` faz a varredura em massa do acervo voltar a
bater na busca do site — *"ela custa duas requisições por música e, em massa,
dobraria a varredura para não achar nada"*. O `const chave` ficou órfão do
parâmetro removido.

### As hipóteses, como saíram dos auditores

| Linha | Grav. alegada | Categoria | Título |
|---|---|---|---|
| `:2239` | alta | correcao | A preview restaura a letra do hino ANTERIOR sobre a música nova — e não se corrige *(medido)* |
| `:4582` | alta | correcao | `bg.falhar()` seguido do `finally { bg.soltar() }` apaga o cartão "Não deu" no MESMO quadro |
| `:4442` | alta | correcao | `projetarVersiculoRef` escreve a sessão e PROJETA sem guarda de sequência depois do `await` |
| `:8884` | alta | correcao | Reabrir a gaveta de uma linha JÁ MONTADA não repõe `destExecutor`/`destMarcados` — confirmar na linha A executa sobre o item B *(medido)* |
| `:10718` | alta | correcao | `syncCifrasColecao` chama `cifraProcurar` com a assinatura ANTIGA — `mudo` e `semBusca` perdidos na varredura do acervo inteiro *(medido, e conferido à mão acima)* |
| `:12602` | alta | correcao | Falha de gravação por arquivo é engolida e a pasta termina anunciando "em dia" |
| `:1769` | media | correcao | A metade "há cena no ar" da proteção da preview nunca volta a ser falsa |
| `:5647` | media | correcao | `drawRemaining`/`pickNumber` contam sorteados FORA da faixa: trocar a faixa à mão mata o botão Sortear |
| `:5326` | media | correcao | `hideChrono`/`hideDraw`/`hideMessage` não chamam `marcarNoAr`: o selo "● No ar" fica mentindo na linha do Cronograma |
| `:8435` | media | correcao | `interacaoAbertaNoAcervo` não enxerga a gaveta de uma linha de FAVORITO/pasta — o redesenho de 400 ms do progresso a destrói *(medido)* |
| `:10388` | media | correcao | A guarda de sequência de `cifraGarantir` é INALCANÇÁVEL — o bloco "Cifra" do Registro descreve a música anterior *(medido)* |
| `:13004` | media | correcao | `fetchCollectionIndex`/`fetchSerieIndex` redesenham a Biblioteca sem passar pelo guarda da gaveta — a TERCEIRA porta do defeito das v1.1.2/v1.1.8 |
| `:15668` | media | correcao | A gaveta de um episódio de série NUNCA diz "Já no aparelho": `mediaByYoutube` devolve UM registro e o código testa `.length` |
| `:2061` | media | codigo-morto | Comentário PARTIDO por inserção: a metade de cima encabeça outro símbolo e termina no meio da frase |
| `:5705` | media | codigo-morto | `naoResta()` e as duas frases dele são inalcançáveis — `go.disabled` cobre exatamente as mesmas condições |
| `:6197` | media | codigo-morto | Lápide: o bloco "Mensagens: botão flutuante na preview + popup" descreve recurso removido e hoje encabeça `msgProjecting` |
| `:10024` | media | codigo-morto | O cabeçalho da aba de cifra declara como CONTRATO que "nada é gravado em disco" e que o cache "é o `Map` abaixo" — falso desde a v1.2.14, e desmentido 380 linhas abaixo no mesmo arquivo |
| `:1595` | baixa | codigo-morto | O comentário de `resyncPreviewToDisplay` está truncado e promete uma guarda de "mesa de som" que não existe |
| `:469` | baixa | codigo-morto | A tabela `ICON` afirma "nenhum acesso dinâmico" e há um acesso dinâmico |
| `:6219` | baixa | codigo-morto | Lápide dentro de `renderLibrary`: a nota sobre "Ferramentas NÃO rola" e "o acordeão" fala de dois mecanismos que não existem mais |
| `:11493` | baixa | codigo-morto | Três comentários em `lvBuildCifra` afirmam que o SELETOR MANUAL de cifra existe e é desenhado — ele saiu inteiro na v1.3.3, e um deles é um bloco sem código nenhum embaixo |
| `:12030` | baixa | codigo-morto | O bloco que documenta `pintarSubNoAr` encabeça `FALHA_ITEM_MS`/`notaNoItem` — e `pintarSubNoAr` ficou sem documentação |
| `:3988` | baixa | otimizacao | O capítulo vizinho da Bíblia é baixado DUAS vezes por render, e a primeira resposta não redesenha nada |
| `:13471` | baixa | otimizacao | O índice INTEIRO da coleção é regravado no IndexedDB a cada música baixada — 68 MB por hinário, medidos |

Uma delas corrobora um achado JÁ confirmado: a `:2239` ("a preview restaura a
letra do hino ANTERIOR") é a metade **preview** do mesmo defeito que a Etapa 2A
confirmou no `display.js:767` (a metade **telão**). Se as duas se sustentarem, é
o padrão que o `fundo-da-letra.test.mjs` já pagou uma vez: *ler cada lado
isolado aprova os dois.*

### Para retomar

1. Rodar a verificação adversarial sobre os 24 acima.
2. Terminar as fatias C–F do `controle.js` (linhas 8250–24516): elas produziram
   achados mas não foram varridas por inteiro.
3. CSS, HTML e os workflows do CI, intocados em todas as etapas.

---

## Método, para quem repetir

- **Achado sem cenário concreto não entra.** Todo item acima nomeia entradas ou
  estado e o comportamento errado observável.
- **A prova mais forte é a execução.** Onde o cético conseguiu montar o cenário
  num Chromium de verdade, está dito. Três achados (W1, W2, W4/W5) caíram ou
  sobreviveram por medição, não por leitura.
- **Refutar é o trabalho, não a formalidade.** 16 dos 55 achados VERIFICADOS foram
  derrubados — entre eles um "host que falha aberto" (a origem opaca não chega
  ao `WebMessageListener` com `allowedOriginRules` exato), um "redirect fora da
  allowlist" (os dois hosts do 3xx real já estão na lista) e uma otimização de
  IDB cujo custo o comentário da linha acima já declarava como escolha.
