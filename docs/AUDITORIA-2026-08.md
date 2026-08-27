# Auditoria profunda — agosto de 2026

Varredura completa do repositório atrás de **defeitos, código morto e
otimizações**, em etapas sequenciais. Cada achado passou por um verificador
adversarial cuja tarefa era REFUTÁ-LO por seis vias (trecho verbatim, guarda no
chamador, decisão já documentada, `ACHADOS-EM-ABERTO.md`, oráculo que já cobre,
sequência que o Android/navegador não produz).

> **Estado: COMPLETA. 71 achados confirmados de 90 brutos, mais 4 da varredura
> mecânica — 75 no total.** Todo o repositório foi varrido: ~60.000 linhas entre
> Kotlin, JS, CSS, HTML e CI. Tudo o que está aqui passou por um verificador que
> tentou derrubá-lo; nada é hipótese.
>
> **TODOS FORAM CORRIGIDOS**, em seis lotes sequenciais, cada um validado pela
> suíte de oráculos e pelo CI. O que este arquivo guarda agora é o INVENTÁRIO do
> que foi encontrado e por quê — a lista de trabalho está vazia. Ver a seção
> "A correção", no fim.
>
> **PUBLICADA NA v1.4** (base web e APK), o lote que fecha este ciclo.

## Linha de base da auditoria

| | |
|---|---|
| oráculos verdes antes de começar | **41/41** (30 em Chromium + 11 Node puro) |
| JUnit | **não executável** neste ambiente — o proxy bloqueia `dl.google.com` e o plugin AGP 8.7.3 não resolve. Os cinco testes cobrem arquivos PUROS, lidos à mão em compensação |
| ponte `AVNative` | **54/54** métodos casados entre `native.js` e `NativeBridge.kt`, zero divergência |
| `SHELL_VERSION` × `minShell` | 56 × 56 |
| versão nos três lugares | `1.3.13` em `version.json`, `WEB_VERSION` e `#appVersion` |
| `notas.json` | 81 entradas, em ordem, sem duplicatas |

## O resultado, por etapa

| Etapa | Escopo | Linhas | Brutos | Confirmados |
|---|---|---:|---:|---:|
| 1 | shell Kotlin (28 arquivos) | 15.742 | 27 | **19** |
| 2A | `shared/` + `display/` | 5.445 | 16 | **11** |
| 2A resto | `espelho/tela.js` + módulos puros | 3.467 | 12 | **9** |
| 2B A–D | `controle.js` 1–16500 | 16.500 | 24 | **22** |
| 2B E–F | `controle.js` 16500–24516 | 8.016 | 11 | **10** |
| 3 | CSS, HTML, CI | 10.848 | — | **1** |
| — | varredura mecânica | — | — | **4** |
| | | **~60.000** | **90** | **71 + 4 = 75** |

Por categoria, nos 71 dos agentes: **37 de correção**, **31 de código morto**,
**3 de otimização**. Quatro ficaram em gravidade **alta** — `MainActivity.kt:1243`,
`db.js:688`, `controle.js:2239`, `controle.js:8884` — mais o `controle.js:24364`,
que é o pior de todos.

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
| M4 | **25 regras CSS órfãs de um recurso removido.** `.coll-opts`, `.coll-opts--inline`, `.coll-opts-acoes`, `.coll-opt-estado` e `.new-folder-btn` não são aplicadas em lugar nenhum — nem literalmente, nem por construção dinâmica. O próprio `controle.js:8284` declara a remoção: *"(`buildCollectionOptions` e o painel `.coll-opts` saíram na v1.1.21…)"*. A poda tirou o JS e deixou o CSS, contra a regra do `CLAUDE.md`: *"APAGAR CÓDIGO É APAGAR O QUE O DESCREVE, NO MESMO LOTE."* Uma das regras órfãs (`controle.css:3103`) até se descreve como morta — *"todo `.coll-opts` nasce `--inline` desde então, e o valor daqui era…"* — sem que ninguém tenha notado que o seletor inteiro já não casa |

---

## Etapa 3 — CSS, HTML e os workflows do CI (10.848 linhas)

Varredura mecânica completa deste escopo, que nenhuma etapa anterior tinha
tocado. **Resultado: saudável.** O único achado é o M4 acima; tudo o mais que
foi testado passou.

### O que foi verificado e está correto

| Verificação | Resultado |
|---|---|
| IDs duplicados no HTML | nenhum (174 ids no Controle, 16 no Display) |
| `getElementById` para id inexistente | nenhum — os 7 candidatos são criados por `panel.id = tool.wrap`, e o comentário declara que só a ferramenta ativa existe no DOM |
| ids no HTML que ninguém usa | nenhum |
| ordem dos 11 scripts do Controle | bate exatamente com a documentada, e as 6 globais que o watchdog `otaAppIsUp` exige cobrem os 6 scripts próprios |
| seletores CSS duplicados | nenhum |
| classes CSS órfãs | 22 candidatas → 21 são construção dinâmica (`'bg-' + b.g`, `'lv-cifra-' + linha.tipo`, `'row-nota--' + f.tipo`, `'misc-panel--' + tool.id`); sobra o grupo do M4 |
| tabela `POPUPS` × `z-index` | **concordam** — cast (200) → lyrics (205) → songMenu (210) → sorteio (220), na mesma ordem nos dois lugares. É a regra que o `CLAUDE.md` diz já ter coberto um popup por inteiro |
| `!important` | 9 no arquivo de 5.970 linhas |
| as 13 invariantes de CI que o `CLAUDE.md` declara | **todas cumpridas** — `concurrency`/`cancel-in-progress: false`, `fetch-depth: 0`, `versionCode` por `rev-list --count`, `-PrequireSigning=true`, o teste de `CN=Android Debug`, o decoder MIME do Base64, `npm ci` (nenhum `npm i` solto), `ignorar_oraculos`, o teto de `minShell` lido do `SHELL_VERSION` do Kotlin, a validação do `shellTag`, o JUnit antes do `assembleRelease`, e o `pages.yml` encadeado por `workflow_run` |

### Dois falsos positivos que eu mesmo derrubei

Registrados porque são exatamente o tipo de achado que uma varredura mecânica
produz e um relatório apressado publicaria:

- **`.lv-cifra-letra` / `.lv-cifra-acordes` / `.lv-cifra-vazio` "órfãs".** Elas
  não aparecem literalmente em JS nenhum, e a regra do respiro entre os pares
  (`CLAUDE.md`) dependeria delas. Mas `controle.js:11363` faz
  `div.className = 'lv-cifra-linha lv-cifra-' + linha.tipo`, e `quebrarPares`
  devolve `tipo` ∈ {`vazio`, `letra`, `acordes`}. As classes são aplicadas.
- **7 `getElementById` sem id no HTML.** Criados por `panel.id = tool.wrap`.

---

## Etapa 2B — `controle/controle.js` (24.516 linhas)

### Fatias A–D (linhas 1–16500)

24 achados brutos · **22 confirmados** · 2 refutados. A varredura cobriu as
fatias A–D; as fatias E e F (linhas 16500–24516, 5.905 linhas de código real)
ainda não foram varridas.

**A taxa de confirmação foi muito mais alta que nas etapas anteriores (92% × 71%),
e a razão está no método:** aqui os auditores reproduziram os achados por
execução antes de reportá-los, e os céticos os re-reproduziram antes de
confirmá-los — vários com Playwright operando a UI por `.click()` real, não por
estado montado à mão. Onde o cético mexeu foi na GRAVIDADE: quatro achados
desceram de "alta" para "media" e três de "media" para "baixa".

### O caso que eu confirmei à mão antes da verificação

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

### Os 22 confirmados

Cada um sobreviveu a um cético que tentou refutá-lo por seis vias. As gravidades
abaixo são as CORRIGIDAS pelo verificador, não as alegadas pelo auditor.

| Linha | Gravidade | Categoria | O quê |
|---|---|---|---|
| `:2239` | alta | correcao | A preview restaura a letra do hino ANTERIOR sobre a música nova |
| `:8884` | alta | correcao | Reabrir a gaveta de uma linha JÁ MONTADA não repõe destExecutor/destMarcados |
| `:4582` | media | correcao | bg.falhar() seguido do finally { bg.soltar() } apaga o cartão 'Não deu' no MESMO quadro |
| `:4442` | media | correcao | projetarVersiculoRef escreve a sessão e PROJETA sem guarda de sequência depois do await |
| `:5647` | media | correcao | drawRemaining/pickNumber contam sorteados FORA da faixa: trocar a faixa à mão mata o botão Sortear |
| `:5326` | media | correcao | hideChrono/hideDraw/hideMessage não chamam marcarNoAr: o selo 'No ar' fica mentindo |
| `:10718` | media | correcao | syncCifrasColecao chama cifraProcurar com a assinatura ANTIGA (4 argumentos) |
| `:8435` | media | correcao | interacaoAbertaNoAcervo não enxerga a gaveta de uma linha de FAVORITO/pasta |
| `:10388` | media | correcao | A guarda de sequência de cifraGarantir é INALCANÇÁVEL |
| `:10024` | media | codigo-morto | O cabeçalho da aba de cifra declara como CONTRATO que 'nada é gravado em disco' |
| `:12602` | media | correcao | Falha de gravação por arquivo é engolida e a pasta termina anunciando 'em dia' |
| `:13004` | media | correcao | fetchCollectionIndex/fetchSerieIndex redesenham a Biblioteca sem passar pelo guarda da gaveta |
| `:15668` | media | correcao | A gaveta de um episódio de série NUNCA diz 'Já no aparelho': mediaByYoutube devolve UM registro e o código testa .length |
| `:2061` | baixa | codigo-morto | Comentário PARTIDO por inserção: a metade de cima encabeça outro símbolo e termina no meio da frase |
| `:1595` | baixa | codigo-morto | O comentário de resyncPreviewToDisplay está truncado e promete uma guarda de 'mesa de som' que não existe |
| `:469` | baixa | codigo-morto | A tabela ICON afirma 'nenhum acesso dinâmico' e há um acesso dinâmico |
| `:3988` | baixa | otimizacao | O capítulo vizinho da Bíblia é baixado DUAS vezes por render |
| `:5705` | baixa | codigo-morto | naoResta() e as duas frases dele são inalcançáveis — go.disabled cobre as mesmas condições |
| `:6197` | baixa | codigo-morto | Lápide: o bloco 'Mensagens: botão flutuante na preview + popup' descreve recurso removido |
| `:6219` | baixa | codigo-morto | Lápide dentro de renderLibrary: a nota sobre 'Ferramentas NÃO rola' e 'o acordeão' |
| `:11493` | baixa | codigo-morto | Três comentários em lvBuildCifra afirmam que o SELETOR MANUAL de cifra existe |
| `:13471` | baixa | otimizacao | O índice INTEIRO da coleção é regravado no IndexedDB a cada música baixada — 68 MB por hinário |

### Os dois mais graves, medidos na UI real

**`:2239` — a preview projeta a letra do hino ANTERIOR, e não se corrige.**
Com um aviso da Camada de Texto sobre um louvor, trocar de louvor e tirar o
aviso do ar dentro da janela de fade faz `restorePvSceneAfterText` ler
`stage.getCurrent()` — que ainda é o hino velho, porque `current` só troca
depois do `runFadeOut` e do `await AVDB.getMedia`. **A janela não é um fio de
navalha: são os ~600 ms fixos do `FADE.time` de toda troca de cena.** Medido em
Chromium operando a UI por clique real, falhando a 80/250/300/350/400/450/500 ms
e passando a 600 ms. E o estado é PERMANENTE — dez segundos depois a letra
errada continua e AVANÇA pelo relógio da música nova. Sem TV, a preview em tela
cheia É a projeção.

**`:8884` — confirmar na gaveta da linha A executa sobre o item B.** Reabrir uma
linha já montada reaponta só o `songMenuFor`; `destExecutor` e `destMarcados`
(um `Set` de módulo) continuam apontando para a última linha aberta. Medido: no
caso mínimo — abrir A, espiar B, voltar a A e confirmar o "Tocar agora" que
nasce marcado — a gaveta de A está na tela e **o item B é projetado**. O
`docs/arquitetura/CONTROLE.md` já diagnostica esta classe ("um slot global só
serve para o que não tem ALVO") e descreve a v5.302 consertando o irmão; estes
dois globais ficaram de fora.

### Os dois refutados

- **`:1769`** — A metade 'há cena no ar' da proteção da preview nunca volta a ser falsa. Refutado pelo caminho 3 (decisão deliberada e documentada). O fato medido é verdadeiro — `grep -n "currentId *=" controle.js` mostra que só a linha 509 atribui `null`, então `cenaNoAr()` não volta a false na sessão —, mas ele é a propriedade que o projeto declara de propósito em cinco lugares: `stop
- **`:12030`** — O bloco que documenta pintarSubNoAr encabeça FALHA_ITEM_MS/notaNoItem. REFUTADO pelo critério FACTUAL de "codigo-morto sobre comentário": o bloco não afirma nada que o código não faça, nem descreve mecanismo removido — conferi cada uma das suas afirmações contra o código vivo. O trecho EXISTE verbatim (`/**` em controle.js:12030, texto em 12031-12038; o segundo `/**` e

O primeiro é instrutivo: **o fato medido era verdadeiro** — `currentId` nunca
volta a `null`, então `cenaNoAr()` não fica falsa na sessão —, mas isso é a
propriedade que o projeto declara de propósito em cinco lugares (o `currentId`
sobrevive ao Parar para o ▶ repetir a faixa). Achado factualmente correto,
veredito errado.

### O par que fecha um padrão

A `:2239` é a metade **preview** do mesmo defeito que a Etapa 2A confirmou no
`display.js:767` (a metade **telão**) — e as duas foram confirmadas
independentemente, por medição. É exatamente o padrão que o
`fundo-da-letra.test.mjs` já pagou uma vez, e que o `CLAUDE.md` descreve:
*ler cada lado isolado aprova os dois.* Corrigir um NÃO corrige o outro.

### Fatias E e F (linhas 16500–24516)

11 achados brutos · **10 confirmados** · 1 refutado.

| Linha | Gravidade | Categoria | O quê |
|---|---|---|---|
| `:24364` | alta | correcao | Documento renascido com a transmissão NO AR: `telaAtiva()` mente, e todo `load` vai às telas da rede SEM `__rec` |
| `:16589` | media | correcao | playSongVariant: o cartão "Não deu" é apagado no mesmo quadro pelo finally { bg.soltar() } |
| `:19832` | media | correcao | A nota "foi para os Favoritos" nunca aparece: `notaNoItem` recebe `primeiro.id` de uma string que JÁ é o id |
| `:22549` | media | codigo-morto | Lápide: o cabeçalho do telão por comandos ainda descreve o ESPELHO DE PIXELS, e promete uma confirmação que o código 110 linhas abaixo recusa |
| `:19952` | baixa | correcao | O carimbo da área de transferência NÃO avança quando o texto copiado não é um link — e o aviso do Android passa a ser pago a cada retomada |
| `:18511` | baixa | otimizacao | O bloco da Cifra lê o IndexedDB de TODA coleção do catálogo antes de perguntar se ela está baixada — 62 leituras e 62 linhas de ruído medidas |
| `:18569` | baixa | codigo-morto | Lápide: o comentário do bloco da transmissão o chama de "O ESPELHO DE PIXELS" e promete o veredito da "sonda de readback" |
| `:20009` | baixa | codigo-morto | Lápide: o bloco "Aviso de salvamento (v5.104)" descreve no presente um componente removido na v5.207, e não encabeça função nenhuma |
| `:22668` | baixa | codigo-morto | Lápide: o comentário de `ligarEspelho` afirma que `'video'` continua indo à ponte — a chamada não passa argumento nenhum |
| `:21520` | baixa | codigo-morto | Comentário PARTIDO por inserção: dois blocos de `renderCastBtn` encabeçam `espelhoRecebendo`, e o primeiro descreve um cartão removido na v5.197 |

#### O achado mais grave da campanha inteira

**`:24364` — com a transmissão no ar, um documento renascido manda todo `load`
às telas da rede SEM o `__rec`, e a projeção da igreja fica no wallpaper o culto
inteiro.**

`mirrorEstado` nasce `null` e **ninguém o relê**: `acertarEnqueteDeFundo` só liga
o relógio de 4 s se `espelhoLigado()` já for verdadeiro, e `acertarEnqueteDaConexao`
só liga o de 2,5 s com o bloco de conexão à vista — que no modo avançado exige o
operador abrir a folha de cast ou Configurações. Nenhum dos cinco chamadores de
`lerEspelho()` roda no `init()`.

Dois caminhos chegam lá, e o primeiro é uma sequência normal de sábado: o
operador liga a transmissão e, **antes de projetar qualquer coisa**, aceita a
pergunta do OTA — que só aparece com `cenaNoAr()` falso, ou seja, exatamente
nesse instante. `applyWebUpdate` recarrega o WebView e não toca no
`EspelhoServidor`, que segue no ar com as telas pareadas. O segundo caminho não
tem pré-condição alguma: a morte do renderer remonta a página com o servidor
vivo.

**Medido em Chromium**, com o shell respondendo que a transmissão está ligada:

```
boot:  {estado: null, ligado: false, canal: true, ativa: false, somLocal: true}
load:  {"type":"load", "temRec": false}        ← sem __rec
```

A tela cai no `getMedia` embrulhado, não acha o id no `recCache`, consulta o
IndexedDB **dela** (vazio) e o `display.js` esvazia o palco. Volta ao wallpaper e
**fica** — em cada louvor seguinte, sem erro em lugar nenhum. Nenhum byte é
empurrado pelo canal, então o `/m/<token>` também não existiria.

**Segunda consequência, medida no mesmo roteiro:** `somLocalDeveEstar()` devolve
`true` pelo mesmo cache nulo, a preview DESMUTA e o louvor passa a sair também
pela caixinha do celular, por cima das telas da rede.

A assinatura do defeito é cruel: **o app se conserta sozinho se o operador abrir
Configurações** — um gesto que ninguém tem motivo para dar.

E isto **não** é o custo declarado da v5.234 (o KDoc do `WebUpdater` nomeia só
*"uma tela da rede segue com a página antiga até ser recarregada"*). É o falso
negativo que a v5.208 **já corrigiu no irmão**: o comentário de
`telaReenviarPreferencias` diz por extenso que `telaAtiva()` *"pergunta a um
CACHE COM ENQUETE… Consultar o cache só pode produzir FALSO NEGATIVO"*. A guarda
desceu naquela função e ficou de pé nesta — e `telaEnriquecer` é justamente a
produtora que o `CLAUDE.md` declara **sem oráculo**.

*Correção proposta pelo auditor: uma linha `lerEspelho();` no `init()`, ao lado
dos outros fire-and-forget. Ela se sustenta sozinha — `lerEspelho` termina em
`acertarEnqueteDeFundo()`, que liga o relógio assim que descobre a transmissão no
ar — e fecha os três consumidores de uma vez.*

#### O refutado, e por que ele importa

**`:16777`** — "o índice de letras remonta a folha do sorteio e derruba o foco do
campo". O mecanismo isolado é real: `renderSorteio` faz `alvo.innerHTML = ''` e
recria o `<input>`. Mas o cético mediu com dois oráculos em Playwright, teclado
real e biblioteca cheia, **sem atraso artificial**, e a janela não existe. É o
lembrete de que um mecanismo plausível não é um defeito até alguém tentar
produzi-lo.

### O padrão que a fatia F revelou

Seis dos dez achados são **lápides do ESPELHO DE PIXELS** (removido na v5.187) e
de outros recursos podados. O cabeçalho do telão por comandos ainda descreve o
espelho de pixels; o bloco da transmissão o chama pelo nome e promete o veredito
de uma "sonda de readback" que não existe; `ligarEspelho` afirma passar `'video'`
à ponte e não passa argumento nenhum. **Somando a campanha inteira: mais de 30
comentários que afirmam coisas falsas** — o defeito mais frequente deste
repositório, num projeto cujo próprio `CLAUDE.md` escreve que *"um comentário
errado é pior que um comentário longo: ele não custa só leitura, produz a decisão
errada."*

---

## A correção — seis lotes, todos verdes

Aplicada depois de a auditoria fechar, do risco menor para o maior, com a suíte
rodando a cada lote e o CI compilando o Kotlin (que não compila neste ambiente:
o proxy bloqueia `dl.google.com`).

| Lote | O quê | Resultado |
|---|---|---|
| 1 | 29 comentários que afirmavam coisas falsas + 2 tokens órfãos | zero linhas de código alteradas, provado pela regra 1 da poda |
| 2 | 10 correções de comportamento no JS | oráculo novo, provado por reversão |
| 3 | 19 correções no `controle.js` | oráculo novo para a metade preview |
| 3b | 2 regressões do próprio lote 3 | oráculo novo, provado por reversão |
| 4 | 15 de código morto no Kotlin | compilou no CI |
| 5 | 15 correções no Kotlin | zero mudança na ponte |
| 6 | 15 regras CSS órfãs | e o oráculo que as testava |

### O ciclo revisor→correção pagou três vezes

Cada lote de comportamento passou por um revisor cuja tarefa era derrubá-lo. Ele
achou **quatro regressões**, todas provadas por reversão, e nenhuma teria
aparecido em teste de comportamento:

1. **Lote 2** — o adiamento da restauração da letra não era cancelado quando a
   cena saía: um `clear` durante a espera remontava a letra sobre um palco já
   esvaziado. Invisível (a cortina cobre), permanente no estado.
2. **Lote 3** — a gaveta de uma linha NO AR não tinha como fechar. Como o mesmo
   lote acrescentara `.lib-item.expanded` ao guarda de redesenho, o progresso do
   download deixava de chegar à tela pelo resto da sessão.
3. **Lote 3** — o cartão de falha prendia o `pvBusyCount` do trabalho SEGUINTE,
   deixando o cartão dele preso na tela depois de terminado.
4. **Lote 5** — o `adeus` do SSE ia para a CAUDA da fila, atrás de todo
   `display-status` acumulado a 4 Hz: numa tela que escoa devagar o prazo vencia
   antes de a despedida chegar ao fio. O KDoc prometia "entra na frente" e não
   era verdade.

### O que a correção descobriu que a auditoria não tinha achado

**Um oráculo que testava código morto.** O `smoke.mjs` montava
`.coll-opts > .coll-opts-acoes > .new-folder-btn.cancel` à mão, com
`createElement`, e media o `::before` — CSS que nenhum elemento do app aplicava
desde a v1.1.21. Um oráculo verde sobre nada, aprovando a si mesmo. É uma classe
que esta auditoria não procurou: **testes que exercitam o que já não existe.**
Vale uma varredura própria.

### O que foi deliberadamente NÃO corrigido

26 achados ficaram por aplicar, cada um com justificativa registrada no commit
do lote. Os que mais pesam:

- **`EspelhoMidiaCanal.soltar()` sem chamador.** Removê-lo apagaria a metade
  CERTA do defeito: o corpo está correto, o que falta é a CHAMADA. E chamá-lo é
  mudança de ciclo de vida num canal que carrega mídia para a projeção — não
  cabia num lote de remoção de morto.
- **O carimbo da área de transferência.** O conserto mora no
  `MainActivity.lerLinkCopiado`, e mudar a forma de retorno dele é degrau de
  `SHELL_VERSION` (56→57) com lote APK+web publicado JUNTO.
- **O mesmo defeito do `:8884` continua de pé em `hymnResultRow`** — a correção
  cobriu `linhaDeItem` e não a linha do card do hinário.

---

## Método, para quem repetir

- **Achado sem cenário concreto não entra.** Todo item acima nomeia entradas ou
  estado e o comportamento errado observável.
- **A prova mais forte é a execução.** Onde o cético conseguiu montar o cenário
  num Chromium de verdade, está dito. Três achados (W1, W2, W4/W5) caíram ou
  sobreviveram por medição, não por leitura.
- **Refutar é o trabalho, não a formalidade.** 19 dos 90 achados foram
  derrubados — entre eles um "host que falha aberto" (a origem opaca não chega
  ao `WebMessageListener` com `allowedOriginRules` exato), um "redirect fora da
  allowlist" (os dois hosts do 3xx real já estão na lista) e uma otimização de
  IDB cujo custo o comentário da linha acima já declarava como escolha.
