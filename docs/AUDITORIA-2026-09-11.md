# Auditoria de 2026-09-11 — a semana da v1.5.19 à v1.8.69

**APÊNDICE. Consultar por `grep`, nunca por leitura integral.**

A semana de 04 a 11/09 somou **47.161 inserções em 184 arquivos** — `controle.js`
+8.743, `controle.css` +3.480, `index.html` +1.008, `MainActivity.kt` +699,
`NativeBridge.kt` +452 — com quarenta lotes e **muitos feitos e desfeitos**: a
v1.8.68 revogada pela v1.8.69, a v1.8.63 pela v1.8.64, a v1.8.61 pela v1.8.62,
a v1.8.60 pela v1.8.61, a v1.5.16 pela v1.8.59, a v1.8.49 pela v1.8.64.

Esta varredura foi pedida com esse foco: **o que ficou para trás nas revogações.**

## O que o repositório já provava sozinho

Tudo verde, e é isso que torna a lista abaixo interessante — **nenhum achado
daqui é alcançado por um guarda existente**:

| verificação | resultado |
|---|---|
| `node --check` em toda a base web (fora `vendor/`) | ✅ |
| bloco *Sanidade da base web* do `apk.yml`, extraído e rodado verbatim | ✅ |
| a suíte inteira do CI — 104 arquivos, três de cada vez | ✅ **104/104** |
| as quatro casas da versão (`version.json` · `WEB_VERSION` · `#appVersion` · `CLAUDE.md`) | ✅ `1.8.69` |
| `minShell` 72 × `SHELL_VERSION` 72 lido do Kotlin | ✅ |
| `comm -3` entre `tools/*.test.mjs` e o workflow, **nos dois sentidos** | ✅ vazio |

O JUnit **não** rodou: o `./gradlew` exige o Android SDK, ausente nesta máquina.
Os arquivos puros do Kotlin (`EspelhoHttp`, `EspelhoPares`, `EspelhoMidiaCache`,
`EspelhoInterfaces`, `TrilhaAudio`) seguem sem veredito nesta auditoria.

## Cobertura — e o que NÃO foi varrido

Sete lentes das catorze planejadas concluíram. **A divisão saiu a favor do
pedido**: as que cobriam a SEMANA rodaram inteiras; as que faltaram são as do
passe superficial pelo resto do app.

| rodou | não rodou |
|---|---|
| revogações de CSS · fiação HTML×JS · código morto no `controle.js` · bugs no `controle.js` · diff Kotlin da semana · contrato da ponte · arqueologia das revogações | oráculos/tautologia · Kotlin fora da semana · web fora da semana · padrões canônicos · CI e entrega · coerência de docs · fluxo do culto |

## Como ler o estado de cada achado

A fase de refutação adversarial **não chegou a rodar** (orçamento de token da
sessão). Em lugar dela, os achados de maior consequência foram conferidos à mão,
por medição direta. Só o que está marcado **VERIFICADO** passou por isso.

- **VERIFICADO** — reproduzido por `grep`/medição nesta sessão; a citação foi aberta e confere.
- **NÃO VERIFICADO** — vem de uma lente só, sem segunda leitura. **Conferir antes de agir.**

---

## BUGS

### [12] A fila muda e o par ⏮/⏭ não é redesenhado: `togglePlaylist` e `adicionarNasListas` não chamam `renderSlideNav()`

`app/src/main/assets/web/controle/controle.js:11470` · gravidade **alta** · ✅ **RESOLVIDO na v1.8.70** · lente `controle-js-bugs`

> **Conferido nesta sessão:** medido: `togglePlaylist` (11457-11496) e `adicionarNasListas` (5264-5313) chamam `renderPlaylist` e **não** `renderSlideNav` — que é quem chama `renderTransporteHabilitado()`, o que decide o ⏮/⏭


> **RESOLVIDO na v1.8.70.** Reproduzido no bloco 10 do `tools/transporte-sem-cena.test.mjs` (o par ficava
> `disabled` com o `title` *"a fila está vazia"* sobre uma fila de um item) e consertado com uma chamada a
> `renderTransporteHabilitado()` no TOPO de `renderPlaylist()`. Duas reversões medidas: sem o conserto o bloco
> reprova em duas asserções; com o repintor no FIM da função, a metade do *esvaziar* reprova sozinha — é ela que
> prende o lugar contra o retorno antecipado do `count === 0`.

**Evidência.** `togglePlaylist` termina em `plItems = await AVDB.listItems('playlist'); … responder(btn,'ok'); vestirPlBtn(btn, agora); renderPlaylist();` (11462 e 11470) — sem `renderSlideNav()` nem `load()`. O mesmo em `adicionarNasListas`, linha 5279: `if (alvos.includes('playlist')) { plItems = await AVDB.listItems('playlist'); renderPlaylist(); }` (o `await load()` logo abaixo está DENTRO do `if (alvos.includes('imports'))`, então um destino só-playlist não passa por ele). Quem apaga/acende o par é `renderTransporteHabilitado()` (11911), que lê `transportePode(delta)` → `if (plItems.length > 0) return true;` (11782). E ele tem UM único chamador em todo o arquivo: `renderSlideNav()`, linha 11963 (`grep -n renderTransporteHabilitado` devolve só 11911 e 11963). `renderPlaylist` repinta `plBtnEl.disabled` e a badge, mas não toca em `prevEl`/`nextEl` — não há `renderSlideNav` entre as linhas 3855 e 4110. O defeito é exatamente a classe que o comentário da v1.8.51 nomeia em `resetAfterEnd` (15118): *"o estado muda e quem o desenha não é chamado"*. O oráculo `tools/transporte-sem-cena.test.mjs` não o alcança porque monta a fila pelo banco e SEMPRE chama `load()`/`renderSlideNav()` à mão logo depois (blocos 6, 8 e 9).

**Cenário.** App aberto com a fila vazia e nada no ar (estado de abertura, ou depois de um Parar): `renderTransporteHabilitado` deixa `prevEl.disabled = nextEl.disabled = true`, com o `title` "Não há próxima mídia — a fila está vazia". O operador monta a fila pelo botão de playlist da linha do Cronograma (`togglePlaylist`, ou a folha de destinos com só "playlist" marcada). `plItems.length` passa a 1+ e `transportePode(±1)` já responde `true`, mas os dois botões continuam `disabled` com o texto velho: o ⏭ não inicia a fila — que é justamente o caminho que o KDoc de `transportePode` diz não poder ser tirado (*"apagá-los ali tiraria o único caminho de começar uma fila pelo transporte"*) — e o ⏮/⏭ da notificação/tela de bloqueio também morrem, porque `onRemote` age por `prevEl.click()`/`nextEl.click()` (31422-31423) e um botão `disabled` engole o clique. O estado só se corrige quando algum outro caminho dispara `renderSlideNav()` (projetar algo, abrir a Bíblia, um `load()` por outro motivo).

**Correção proposta.** Chamar `renderSlideNav()` (ou, no mínimo, `renderTransporteHabilitado()`) junto de `renderPlaylist()` nos dois pontos que reescrevem `plItems` sem passar por `load()`/`send()` — linha 11470 (`togglePlaylist`) e linha 5279 (`adicionarNasListas`). O lugar canônico, para não repetir a obrigação no próximo chamador, é dentro do próprio `renderPlaylist()`: ele já é o ponto único por onde todo caminho que refaz `plItems` passa (é o argumento escrito no KDoc de `marcarNaPlaylist`), e é onde `plBtnEl.disabled` já é decidido pela mesma lista.

### [6] Os dois quadrados da barra da Biblioteca desenham o ícone em tamanhos diferentes (20px × 22px)

`app/src/main/assets/web/controle/controle.css:834` · gravidade **media** · ✅ **RESOLVIDO na v1.8.73** · lente `html-js-fiacao`


> **RESOLVIDO na v1.8.73.** Medido por conta própria antes de mexer: `{sorteio: 20, alternador: 22, degrau: 22}`,
> com as caixas idênticas nas três telas. A entrada na lista do `--icon-md` é por CLASSE (`.lib-quad`) e nunca pelo id —
> dentro de um `:is()` a especificidade é a do argumento mais específico, e um `#sorteioBtn` ali moveria a cascata dos
> outros cinco. As duas asserções novas do `barra-em-qualquer-tela` medem o `<svg>`, não o botão; reversão: 8 reprovações.

**Evidência.** A linha 833 fecha a lista do `--icon-sm` (`) svg { display: block; width: var(--icon-sm); ... }`), que contém `.popup-close`; a 834 abre a do `--icon-md` (`:is(.lib-toggle, .t-btn, .ctl-btn, .misc-tab, .settings-btn) svg {`), que contém `.lib-toggle`. No HTML, `#sorteioBtn` (index.html:2699) tem SÓ `class="popup-close"` e `#hymnSearchToggle` (index.html:2709) tem `class="popup-close lib-toggle"` — ele casa as DUAS regras, que são ambas (0,1,1), e a de baixo vence. Os dois svg estão escritos com `width="19"` no HTML (2699 e 2710/2713), isto é, o autor os pediu iguais. E o próprio CSS diz que o que separa os dois quadrados é só a COR: controle.css:2462-2469 — *"a receita compartilhada dos quadrados é `#hymnSearchToggle, #sorteioBtn`"*, *"as duas coisas que distinguem os dois quadrados, no mesmo lugar"* — e registra que esses MESMOS dois botões já perderam uma vez por cascata sem nada na tela dizer.

**Cenário.** MEDIDO em Chromium (Playwright, arnês do repositório, 430×900, `/controle/` com a cortina levantada e a rede externa bloqueada): `#sorteioBtn svg` computa **20,00px** e `#hymnSearchToggle .ico-base` computa **22,00px**, com as CAIXAS dos dois idênticas — 53,42 × 40,00 — na mesma barra, a um campo de busca de distância. É a armadilha que a v1.5.19 (`.import-btn`) e a v1.8.68 (`.crono-limpar`) já corrigiram duas vezes: caixas iguais escondendo ícones diferentes. E ela CRESCE — reversão pelo método do repositório, forçando `--icon-sm: 26px`: o `#sorteioBtn` vai a 26 e o `#hymnSearchToggle` fica em 22 (o ✕ dos cabeçalhos também vai a 26).

**Correção proposta.** `.lib-toggle` tem UM consumidor só (`#hymnSearchToggle`) e desde a v1.5.2 ele não é aba nem transporte — tirá-lo do `:is()` da linha 834 devolve os dois quadrados ao mesmo degrau. Se o degrau maior for o desejado, o certo é o inverso: pôr os dois na mesma lista, com a razão ao lado, em vez de deixar a diferença nascer de ordem de fonte.

### [13] `deckVideoTalvezTocar` arma `deckVideoVolta` no `.then` de um `send` sem guarda de sequência (`projecaoSeq`)

`app/src/main/assets/web/controle/controle.js:27829` · gravidade **media** · ✅ **RESOLVIDO na v1.8.74** · lente `controle-js-bugs`

> **CONFIRMADO E RESOLVIDO na v1.8.74.** A corrida foi ENCENADA (trava no `getMedia` do vídeo,
> solta pelo oráculo), e sem o conserto o bloco 5-D do `pptx-video-na-pagina.test.mjs` reprova em
> DOIS pontos: a volta rearmada e o eixo do ⏮/⏭ apontando para o deck morto. A guarda é a senha
> de sempre (`projecaoSeq`), lida **depois** do disparo — `send` é `async` e o `++projecaoSeq`
> dele roda síncrono dentro da chamada; lida antes, ela recusaria SEMPRE (reversão medida: 5
> reprovações, o recurso inteiro morto). Lote só de web, sem `shellTag`.

**Evidência.** `send(vid, true).then(() => { deckVideoVolta = volta; renderSlideNav(); })` (27829-27835). O próprio comentário acima reconhece a dependência de ordem: *"O `send` LIMPA a volta na entrada … então ela só pode ser armada DEPOIS dele"* — mas o `.then` não confere se ainda é a projeção dele. `send()` zera `deckVideoVolta` na linha 11526 e incrementa `projecaoSeq` na primeira linha (11520); esta é a senha que o resto do arquivo usa para exatamente esta corrida (`senhaDaCena` em `load()`, linha 3204; `senhaDoToque` em `ytAcaoInterno`, linha 19411). É o ÚNICO `.then(` acrescentado nesta semana que mexe em estado de cena sem senha. O `send` do vídeo de slide é longo por construção: o vídeo embutido não está em `plItems`/`libItems`/`favItems`, então ele cai no `await AVDB.getMedia(id)` (11534) — uma leitura de IndexedDB do blob inteiro — mais `await persistCurrent()`.

**Cenário.** A apresentação chega numa página com vídeo embutido (`deckIr` → `deckVideoTalvezTocar` → `send(vid)`). Enquanto o `getMedia` do vídeo corre, o operador toca noutra mídia da lista: esse `send(X)` zera `deckVideoVolta` e sobe `projecaoSeq`. O `send(vid)` anterior resolve depois e RE-ARMA `deckVideoVolta` com o deck antigo. A partir daí: (a) o fim natural de X cai em `autoAdvance()`, cuja primeira linha é `if (deckVideoVolta) { deckVideoVoltar(); return; }` (15156) — a fila não avança e a apresentação antiga volta ao telão sozinha, no meio do culto; (b) `slideTarget()` devolve `'deck'` (11835) e `deckStep` desvia para `deckVideoVoltar(delta)` (27728), então o ⏭ projeta o deck velho em vez de passar a estrofe de X.

**Correção proposta.** Capturar a senha antes do disparo e conferi-la na resolução, como os outros três pares do arquivo: `const senha = projecaoSeq; send(vid, true).then(() => { if (projecaoSeq !== senha) return; deckVideoVolta = volta; renderSlideNav(); })`. (Não serve `if (currentId === vid)`: o `send` concorrente pode ter sido de um cue, que também escreve `currentId`.)

### [22] O fecho do pacote (flush + close do `content://`) roda na main thread, contra o contrato da própria classe

`app/src/main/java/br/org/iasd/av/MainActivity.kt:1156` · gravidade **media** · ✅ **RESOLVIDO na v1.8.72** · lente `kotlin-semana`


> **RESOLVIDO na v1.8.72**, escopado ao caminho que de fato bloqueia. Só o `pacoteFinish` passou ao
> `PacoteCanal.fecharDepois`: o destino é solto na main (sincronamente, para preservar o `-1` de um bloco atrasado e
> o `uriEmCurso() == null` da v1.8.43) e só o `flush`/`close` vai para a thread `av-pacote`, numa fila PRÓPRIA que o
> laço só atende quando a de blocos drena. O `fechar()` síncrono FICA no caminho de derrubada (`onDestroy`, morte do
> renderer): ali adiar para uma thread daemon que o processo pode não viver para executar seria pior que bloquear.
> **Pede Release** (`shellTag: v1.8.72`) — nada em `java/` chega por OTA.

**Evidência.** O KDoc de `PacoteCanal` (PacoteCanal.kt:51-56) declara o desenho: "## A escrita sai da main thread — `onPostMessage` é `@UiThread` e escrever num `content://` pode bloquear (cartão SD, provedor de nuvem). O trabalho de verdade vai para uma thread própria por uma fila curta; a main só enfileira e volta."

O fecho não segue essa regra. `PacoteCanal.fechar()` (PacoteCanal.kt:140-155) faz `s.flush(); s.close()` sobre o mesmo `OutputStream` de `content://`, e TODOS os chamadores estão na main: `MainActivity.pacoteFinish` (linha 1156, dentro de `runOnUiThread {`, linha 1149), `descartarPacote()` (linha 1544, chamado de `onDestroy` na 791, de `onRendererGone` na 636 e de `pacoteCancel` na 1208) e `adotar()` (PacoteCanal.kt:121, chamado da main em 337 e 1239). Na mesma volta da main ainda entram os `DocumentsContract.deleteDocument(contentResolver, …)` das linhas 1172 e 1556 — binder síncrono para o DocumentsProvider — e o `contentResolver.openOutputStream(uri, "wt")` da linha 335. A thread de escrita `av-pacote` (PacoteCanal.kt:160) existe e está ociosa exatamente nesse instante.

**Cenário.** O operador exporta um acervo que não cabe no armazenamento próprio, então o web escolhe o caminho do SAF (`controle.js:25240`, `espaco - bytes > 512 MB` falso) e grava num cartão SD ou num provedor de nuvem. Terminados os blocos, `pacoteFechar` chega: a main thread fica presa no `close()` do descritor, que é onde um provedor FUSE/nuvem finaliza a escrita de gigabytes; se passar de 5 s o sistema mata o processo por ANR — e esse processo é o dos dois WebViews e da `Presentation`, isto é, a projeção do culto. O mesmo caminho é percorrido em `onDestroy` (linha 791), onde o orçamento da main já é o mais apertado.

**Correção proposta.** Fazer `fechar()` na thread `av-pacote` que a classe já mantém (enfileirar um `Trabalho` terminal, ou um `post` ao laço) e devolver o veredito à main por callback — o mesmo desenho que os blocos já usam. Levar junto os `DocumentsContract.deleteDocument` de 1172 e 1556 e o `openOutputStream` de 335, que são a mesma classe de IPC bloqueante.

### [14] Os vídeos embutidos de um `.pptx` ficam estacionados em `avulsos`, que é uma prateleira ROTATIVA de três — um `send` concorrente apaga os bytes antes do `addDeck`

`app/src/main/assets/web/controle/controle.js:27992` · gravidade **baixa** · ✅ **RESOLVIDO na v1.8.75** · lente `controle-js-bugs`

> **CONFIRMADO E RESOLVIDO na v1.8.75**, pela correção (a) — o conjunto `avulsosEmMontagem`, que o
> `fixarAvulso` tira de `outros`. A (b) foi descartada: criar o deck antes dos vídeos exige um
> `updateDeckVideos` novo no `db.js` e deixa uma apresentação MEIA na lista se a importação falhar no
> meio. MEDIDO no bloco 8 do `pptx-video-na-pagina.test.mjs`: **2 de 3 vídeos sobreviviam**. A janela é
> encenada (trava no `addDeck`) e a rotação é AGUARDADA antes de soltá-la — sem isso o oráculo passava
> com o defeito de pé, porque o `send` dispara o `fixarAvulso` sem `await`. Segunda reversão medida: o
> conserto ingênuo (nunca despejar) reprova as duas asserções de rodízio. Lote só de web.

**Evidência.** Em `pptxImportar`, cada vídeo embutido nasce com `AVDB.addMedia(v.blob, { … list: 'avulsos' })` (27988-27993) e só sai de lá DEPOIS do `addDeck`: `for (const p in videos) await AVDB.listRemove('avulsos', videos[p]);` (28006). O comentário ao lado promete que a prateleira os protege (*"`avulsos` é o detentor provisório que os segura entre o `addMedia` e o `addDeck`"*). Mas `avulsos` não é um depósito: `fixarAvulso` (28194-28203) faz rodízio com `AVULSO_MAX = 3` (28193) — `const excedente = outros.slice(0, Math.max(0, outros.length - cabem));` (28201) seguido de `await AVDB.listRemove('avulsos', velho)` (28202). `outros` é a lista na ordem de chegada, e o `listRemove` do `db.js` apaga o blob quando `lerDetentores` não acha outro dono — e o deck, que seria esse dono (`rec.videos`), ainda não existe. `fixarAvulso` é chamado por todo `send` (11614) e por `guardarShare`/`importShare` (28546).

**Cenário.** Uma apresentação com três ou mais vídeos embutidos está sendo importada (o laço de `addMedia` grava dezenas de MB por vídeo, então a janela é de segundos). Nesse intervalo o operador projeta qualquer mídia — um toque na lista, o avanço da fila ou a notificação — e `send` chama `fixarAvulso(id)`: com `lote.length = 1`, `cabem = 2`, e `excedente` leva os `outros.length - 2` mais antigos, que são os vídeos do `.pptx` recém-estacionados. Como nenhum outro detentor os aponta ainda, os blobs morrem. O `addDeck` seguinte nasce com `videos[pagina]` apontando para ids inexistentes: chegar naquela página não projeta nada, sem erro — o mesmo desfecho que a v1.8.42 já corrigiu por outro caminho (`exceptList` em `lerDetentores`), descoberto no culto.

**Correção proposta.** Não usar a prateleira rotativa como depósito provisório. Ou (a) fazer `fixarAvulso` pular ids marcados como em montagem (um `Set` de módulo preenchido antes do laço de `addMedia` e esvaziado no `finally` de `pptxImportar`), ou (b) criar o deck ANTES dos vídeos e ligá-los a ele com um `updateDeckVideos`, de modo que o detentor definitivo exista desde o primeiro `addMedia` e `avulsos` não seja usado.

## CÓDIGO MORTO

### [15] O terceiro parâmetro de `send` (`retomarEm`) perdeu o único produtor na v1.2.17, e o comentário ao lado ainda nomeia o RECADO como quem o alimenta

`app/src/main/assets/web/controle/controle.js:11713` · gravidade **media** · NÃO VERIFICADO · lente `controle-js-morto`

**Evidência.** A declaração é `async function send(id, daFila, retomarEm)` (linha 11518) e o parâmetro é lido em DUAS linhas: `if (retomarEm && retomarEm.t > 0) carga.time = retomarEm.t;` (11713) e `if (retomarEm && retomarEm.playing === false) carga.playing = false;` (11714). Varri TODOS os `send(` da base web (controle.js 4078, 5549, 7456, 10701, 10703, 11803, 15158, 15168, 15170, 15176, 15766, 15773, 19206, 19415, 21304, 22295, 27829, 27868, 28617, 30396, 30405) — NENHUM passa um terceiro argumento, o máximo é dois. Não há alias (`= send`, `send.apply`, `send.call` não existem), não há chamada de HTML nem de `.kt`. O produtor foi `recadoTerminou`, que fazia `send(volta.id, false, volta)` no commit 3b899a29 (v1.1.25) — e o RECADO saiu na v1.2.17, como o PRÓPRIO arquivo afirma na linha 6237 ("O RECADO (o walkie-talkie da v1.1.26) saiu na v1.2.17"). O comentário da linha 11711 continua dizendo "É o mesmo contrato que a reconexão do telão usa; quem o alimenta AQUI é a volta do RECADO" — isto é, o arquivo se contradiz a 5.500 linhas de distância. Escapa do `funcao-sem-chamador.test.mjs` porque o oráculo só varre declarações `function`/`const`/`let` e a superfície do `AVDB`; um PARÂMETRO não é visto por nenhum dos três blocos.

**Cenário.** Nunca roda: como nenhum dos 21 chamadores passa o terceiro argumento, `retomarEm` é sempre `undefined` e os campos `time`/`playing` jamais são escritos no `load` por este caminho (a reconexão do telão os escreve por outro, o `resendSceneToDisplay`). O custo é o comentário: ele descreve um mecanismo removido há 46 versões e manda o próximo leitor procurar (ou reintroduzir) o RECADO — exatamente a armadilha que o CLAUDE.md chama de "lápide dentro do código".

**Correção proposta.** Apagar o parâmetro `retomarEm` da assinatura (11518) e as duas linhas que o leem (11713-11714), no mesmo lote em que se corrige o comentário de 11710-11711 para creditar a reconexão do telão (`resendSceneToDisplay`), que é quem de fato depende de a posição viajar dentro do `load`.

### [16] O parâmetro `fonte` de `openLyricsPopup` só é passado por um ORÁCULO; o comentário dentro da função afirma que "a Biblioteca abre na cifra", e ela não abre

`app/src/main/assets/web/controle/controle.js:12356` · gravidade **media** · NÃO VERIFICADO · lente `controle-js-morto`

**Evidência.** Declaração `function openLyricsPopup(item, fonte)` (12302), leitura única em `if (fonte) lvSource = fonte;` (12356). Os DOIS chamadores do app passam no máximo um argumento: `lyricsViewBtnEl.addEventListener('click', () => openLyricsPopup());` (30505) e, o da Biblioteca, `openLyricsPopup(await lvItemDaBiblioteca(coll, s));` (19816). O ÚNICO ponto do repositório que passa `fonte` é um teste: `tools/leitor-biblioteca.test.mjs:165 → openLyricsPopup(alvo, 'cifra');` (o mesmo arquivo, na linha 228, usa a forma real de UM argumento). O `git log -S` mostra o que aconteceu: o commit 9ed2b1f3 (v1.2.25, "o 'Ver a letra' da Biblioteca abre o LEITOR") REMOVEU a linha `openLyricsPopup(item, 'cifra');` e pôs no lugar a de um argumento — o produtor saiu e o parâmetro ficou. Enquanto isso o comentário de 12333-12334 continua afirmando o comportamento morto: "`fonte` é o PEDIDO de quem abriu, e vence os dois — a Biblioteca abre na cifra, porque quem toca ali foi buscar os acordes". Escapa do oráculo pelo mesmo motivo do achado anterior (é parâmetro, não símbolo declarado).

**Cenário.** Nunca roda pelo app: abrir o leitor pela Biblioteca (o caminho que o comentário descreve) cai em `fonte === undefined`, então `lvSource` NÃO é forçado para 'cifra' e a folha abre na aba que a heurística de camada/preferência escolher. O que torna isto pior que uma função morta é a categoria que o próprio `funcao-sem-chamador.test.mjs` nomeia — "SÓ O ORÁCULO ... é PIOR que morta: o oráculo prova que uma função que ninguém usa funciona": o `leitor-biblioteca.test.mjs` exercita e aprova um formato de chamada que o aparelho nunca produz, e ainda assere `fonte: lvActiveSource()` sobre ele.

**Correção proposta.** Decidir e fechar nos dois lados no MESMO lote: ou o chamador de 19816 volta a passar `'cifra'` (é o comportamento que o comentário promete e que a v1.2.25 derrubou sem dizer), ou o parâmetro `fonte`, a leitura de 12356, as quatro linhas de comentário de 12333-12336 e a asserção de `tools/leitor-biblioteca.test.mjs:165` saem juntos.

### [18] Três métodos de `AVNative` sem nenhum consumidor no app — `ytStream`, `otaPending` e `apkProcurar` —, os três catalogados em `docs/shell/PONTE.md` como superfície viva

`app/src/main/assets/web/shared/native.js:395` · gravidade **media** · ✅ **RESOLVIDO na v1.8.71** · lente `controle-js-morto`

> **Conferido nesta sessão:** medido: zero consumidores dos três em toda a base web; os três existem como `@JavascriptInterface` (`NativeBridge.kt` 576, 755, 1359)


> **RESOLVIDO na v1.8.71.** Os três saíram do `native.js` (lado WEB; o `@JavascriptInterface` fica, e por isso
> o lote não pede Release). O que fecha a classe é o bloco novo do `funcao-sem-chamador.test.mjs`, que varre a
> superfície de `AVNative` — o vão era este: os dois blocos antigos varrem `function foo` e constantes de módulo, e
> um método de objeto literal não é nem uma coisa nem outra. Reversão medida nos dois sentidos.

**Evidência.** Varri toda a base web (`controle/`, `display/`, `espelho/`, `shared/`, os dois `index.html`) por `AVNative.<nome>`, `AVNative['<nome>']` e `"<nome>"`: os três não aparecem FORA do próprio `native.js`. `ytStream` (395-396) era o produtor do manifesto DASH, e o cabeçalho de `shared/mse.js:35` diz textualmente "===== NADA NESTE APP CRIA UM MANIFESTO NOVO (v1.7.7) ===== ... O que some é a produção, não a leitura". `otaPending` (640) e `apkProcurar` (686) foram substituídos pelo `atualizacaoEstado` (linha 677), e o comentário dele, na própria linha 667, escreve a substituição no passado: "com `otaPending`, `apkProcurar` e `otaDiag` separados, as três respostas chegam em três momentos" — o irmão `otaDiag` CONTINUA sendo chamado (controle.js:23432), os outros dois não. Nenhum dos três está na lista `MORTAS_DE_PROPOSITO` do `funcao-sem-chamador.test.mjs` (que tem só `addStreamMedia`/`setMediaStream`, com o comentário que as sustenta), e nenhum tem no `native.js` a frase que aquela lista exige. O oráculo não os alcança porque o bloco que varre superfície exportada é "escopado ao `AVDB` de propósito" e os `function`/`const` não cobrem propriedades de objeto literal. O custo não é só o byte: os três estão replicados como stub em ~20 oráculos (`abertura-e-transferencia.test.mjs:46,52,66,70`, `boot-nativo.test.mjs:128,276,280`, `cifra-offline`, `cifra-rolagem`, `cifra-tela-cheia`, `controles-layout`, `fonte-so-do-par`, `leitor-apresentacao`, …), sempre DEFINIDOS e nunca chamados.

**Cenário.** Nunca rodam: nenhum caminho do app pede o manifesto (`ytStream`), a versão pendente da base (`otaPending`) ou a consulta de APK novo (`apkProcurar`) — a atualização inteira entra por `atualizacaoEstado` (controle.js:33279) e a transmissão direta saiu na v1.7.7. Em troca, `docs/shell/PONTE.md` dedica uma seção inteira a `apkProcurar()` (linha 321, "três desfechos, e nenhum deles é `null`") e lista os três no catálogo (675, 688, 697) como se fossem a superfície em uso — que é a doc lida por um agente antes de qualquer trabalho.

**Correção proposta.** Encolher no WEB primeiro, que é o lado seguro e já é a regra escrita do repositório ("um APK que ainda serve métodos que ninguém chama não custa nada ao aparelho"): apagar as três entradas de `native.js` (395-397, 640, 686), as linhas correspondentes do catálogo de `docs/shell/PONTE.md` e os stubs nas listas dos oráculos. Se a decisão for MANTÊ-LOS, cada um precisa da frase que o `funcao-sem-chamador.test.mjs` exige de uma morta de propósito, ao lado da declaração.

### [28] `AVNative.ytStream` não tem consumidor nenhum na base web desde a v1.7.3, e o comentário dele ainda descreve o chamador removido

`app/src/main/assets/web/shared/native.js:395` · gravidade **media** · ✅ **RESOLVIDO na v1.8.71** · lente `ponte-contrato`

> **Conferido nesta sessão:** idem — o único `ytStream` fora do `native.js` é um comentário em `display.js:1298`

**Evidência.** ```
395:    ytStream: (url, altura) => call(
396:      (id) => B.ytStream(id, String(url), altura | 0),
397:      CALL_TIMEOUT_MS,
398:    ),
```

`grep -rn "ytStream" app/src/main/assets/web --include=*.js` fora de `shared/native.js` devolve UMA linha, e ela é comentário: `display/display.js:1298`. Não há acesso dinâmico (`grep -rn "AVNative\[" app/src/main/assets/web` é vazio). Os dois chamadores existiam na base da semana e saíram dentro dela: `git show 9d28e8a:…/controle.js` tem `controle.js:16934  man = await AVNative.ytStream(r.url, altura | 0)` e `controle.js:17257  try { man = await AVNative.ytStream(link, rec.height | 0); }`; `git log -S "AVNative.ytStream"` aponta `0f4dc5f9` (v1.7.3) como o commit que os removeu.

O próprio `shared/mse.js` declara a decisão, na primeira linha do arquivo: `// ===== NADA NESTE APP CRIA UM MANIFESTO NOVO (v1.7.7) =====` … `ESTE ARQUIVO FICA, e o motivo é um só: ele é o LEITOR` … `O que some é a PRODUÇÃO, não a leitura`. O `ytStream` É a produção — ele é o único caminho que monta o manifesto —, então mantê-lo contradiz a decisão escrita, ao contrário de `addStreamMedia`/`setMediaStream`, que estão na lista `MORTAS_DE_PROPOSITO` de `tools/funcao-sem-chamador.test.mjs:73-76` com a razão ao lado.

E ele não carrega nota nenhuma: o comentário de 383-394 descreve o chamador em presente — "o 'Tocar agora' nem transmitia nem caía no download, o pior desfecho possível" — e cita "o gêmeo `ytSearch`", que tem chamador.

**Cenário.** Nunca roda: nada no `controle.js`, `display.js`, `tela.js`, `db.js` ou `stage.js` chama `AVNative.ytStream`. O `funcao-sem-chamador.test.mjs` não o enxerga porque ele é propriedade de objeto literal e não declaração de função — a varredura daquele oráculo é sobre funções. O custo não é o byte: é que a cadeia inteira que pende dele (`StreamProxy.kt`, a rota `/s/<token>` do `EspelhoServidor`, o `telaManifestoDaRede`/reescrita `/stream/` → `/s/` do `telaEnriquecer`) segue documentada e mantida como viva, e o comentário do método manda a próxima sessão proteger um percurso que não existe mais.

**Correção proposta.** Ou apagar o `ytStream` do `native.js` e o `@JavascriptInterface` correspondente (`NativeBridge.kt:1359`) no mesmo lote — com degrau de `SHELL_VERSION` e `shellTag`, como o `farolContar` —, ou, se a decisão for mantê-lo, escrever a nota que as outras retenções têm ("SEM CHAMADOR DESDE A v1.7.3 — a produção saiu; isto fica porque …") e acrescentar `ytStream` à lista `MORTAS_DE_PROPOSITO`, adaptando o oráculo para enxergar propriedades de objeto literal.

### [30] `otaPending` e `apkProcurar` não têm consumidor nenhum na base web, e o comentário do segundo afirma que tem

`app/src/main/assets/web/shared/native.js:640` · gravidade **media** · ✅ **RESOLVIDO na v1.8.71** · lente `ponte-contrato`

> **Conferido nesta sessão:** idem

**Evidência.** ```
640:    otaPending: () => call((id) => B.otaPending(id), CALL_TIMEOUT_MS),
…
686:    apkProcurar: () => call((id) => B.apkProcurar(id), CALL_TIMEOUT_MS).catch(() => ({})),
```

`grep -rn "otaPending\|apkProcurar" app/src/main/assets/web/controle/ app/src/main/assets/web/display/ app/src/main/assets/web/espelho/ app/src/main/assets/web/shared/db.js app/src/main/assets/web/shared/stage.js` devolve ZERO linhas. As únicas ocorrências fora de `native.js` na base inteira são as tabelas de nomes dos `__AVBridge` de mentira dos oráculos (`boot-nativo.test.mjs:128`, `cifra-offline.test.mjs:59`, etc.), que são stubs e não consumidores.

O substituto está escrito no próprio arquivo, no comentário de `atualizacaoEstado` (linhas 659-672): *"OS DOIS CANAIS NUMA LEITURA SÓ … Ele existe pela COERÊNCIA DE INSTANTE … com `otaPending`, `apkProcurar` e `otaDiag` separados, as três respostas chegam em três momentos"*. O `otaDiag` ficou (`controle.js` o chama); os outros dois não.

O comentário de `apkProcurar` (linhas 678-685) afirma o contrário: *"Os dois resolvem o desfecho INOFENSIVO em vez de lançar: quem chama é uma linha de Configurações, e um `throw` ali deixaria a tela sem a versão web também."* — "os dois" são `apkProcurar` e `apkInstalar`; só o segundo tem chamador. `PONTE.md:329-330` repete: *"Quem guarda a URL é o `ShellUpdater`, do achado da última `apkProcurar` — é por isso que `apkInstalar()` não recebe URL nenhuma"*, quando na prática quem popula `ShellUpdater.achado` é `ShellUpdater.anunciar()`, chamado de `WebUpdater.check` a partir do bloco `shell` do manifesto OTA (`WebUpdater.kt:879`).

**Cenário.** Nunca rodam. Nenhum dos dois carrega a nota de retenção deliberada que o repositório exige (o padrão está em `controle.js:32001` para os `espelhoCert*` e em `tools/funcao-sem-chamador.test.mjs:66-76` para `addStreamMedia`/`setMediaStream`). O dano concreto é o comentário de `apkProcurar` e a linha 330 de `PONTE.md`: quem for depurar "o app não achou o APK novo" segue a pista de uma chamada de Configurações que não existe e de um `achado` que a `apkProcurar` teria gravado, em vez de ir ao caminho real (o bloco `shell` do manifesto → `ShellUpdater.anunciar`). Os dois também custam duas entradas privilegiadas vivas na ponte, sujeitas ao degrau de `SHELL_VERSION` sem ninguém usá-las.

**Correção proposta.** Decidir e escrever: ou apagar `otaPending` e `apkProcurar` dos dois lados no mesmo lote (com degrau de `SHELL_VERSION` e `shellTag`, o rito do `farolContar`), ou mantê-los com a nota explícita de que estão sem chamador desde que o `atualizacaoEstado` os unificou. Nos dois casos, corrigir o comentário de `native.js:682` (só `apkInstalar` tem chamador) e a linha `PONTE.md:330` (quem guarda o achado é o `ShellUpdater.anunciar`, a partir do manifesto OTA).

### [34] O token `--btn-ok` ficou sem um único consumidor quando o verde saiu (v1.8.55/v1.8.56), e a paleta ainda o documenta como superfície ativa

`app/src/main/assets/web/shared/tokens.css:506` · gravidade **media** · **VERIFICADO** · lente `arqueologia-revogacoes`

> **Conferido nesta sessão:** medido: zero `var(--btn-ok)` em qualquer `.css`/`.js`/`.html`. O único leitor é `tools/feedback-de-confirmacao.test.mjs:125`, que o usa como referência NEGATIVA

**Evidência.** `--btn-ok` é declarado nos dois blocos de tema — `tokens.css:506` (`--btn-ok:     #2a431e;`) e `tokens.css:815` (`--btn-ok:     #d5f5c6;`) — e `var(--btn-ok)` aparece ZERO vezes nas quatro folhas da base:
  grep -rc "var(--btn-ok)" shared/tokens.css controle/controle.css display/display.css espelho/tela.css → 0, 0, 0, 0
A varredura completa por "btn-ok" em `assets/web/` devolve só as duas declarações, a linha da tabela de medições e um comentário: `controle.css:4930` — "Era `--btn-ok` + `--ok`, e a régua do operador é a que ...". O último `var(--btn-ok)` do `controle.css` saiu em `193e97d8` (v1.8.56), depois de `f18db26b` (v1.8.55), os dois lotes desta semana que tiraram o verde dos indicadores de conclusão.

A tabela de medições da própria paleta continua descrevendo-o como um dos quatro fundos de estado em uso (`tokens.css:493`):
  --btn-ok       --ok             1,72   1,15   1,16     4,89 · 5,74

E o oráculo que varre os consumidores de verde não o alcança: `tools/feedback-de-confirmacao.test.mjs:206` casa `var\(--(ok|btn-ok|ok-fill)\)` e compara os SELETORES encontrados com a lista `ESPERADOS` — com zero ocorrências de `var(--btn-ok)`, o token não contribui nada e as duas direções da asserção passam sem vê-lo.

**Cenário.** Nenhuma regra do app resolve `--btn-ok`: as duas declarações são computadas e descartadas em toda carga de página, nos dois temas. O único leitor que sobrou está fora do produto — `tools/feedback-de-confirmacao.test.mjs:97` e `:125` leem o token para provar que o pulso de confirmação NÃO é aquela cor —, que é exatamente a condição que o `funcao-sem-chamador.test.mjs` reprova do lado JS ("nenhuma constante existe só para o oráculo ler"). Pior que o custo morto: a tabela de 493 apresenta o par `--btn-ok`/`--ok` como um dos quatro fundos de estado OPACOS medidos, então quem for pintar um estado novo encontra um quarto membro da família documentado, medido e disponível — e volta a usar verde para confirmação, que é a decisão que a v1.8.56 revogou a pedido do operador ("verde é para sinal de 'ligado', nesses casos são mensagem de conclusão, não de atividade").

**Correção proposta.** Aplicar a regra do repositório ("APAGAR CÓDIGO É APAGAR O QUE O DESCREVE, NO MESMO LOTE"): remover `--btn-ok` dos dois blocos de tema e a linha dele da tabela de 493. Se ele for mantido de propósito como reserva da família de quatro, dizer isso ali mesmo — "sem consumidor desde a v1.8.56; o verde só vale para ATIVIDADE" — e trocar o `tok('--btn-ok')` do oráculo por um literal, para o token não existir apenas para ser lido pelo teste.

### [11] `b.dataset.tool` é escrito nas abas de Ferramentas e nunca lido em lugar nenhum do repositório

`app/src/main/assets/web/controle/controle.js:7160` · gravidade **baixa** · NÃO VERIFICADO · lente `html-js-fiacao`

**Evidência.** `b.dataset.tool = t.id;`, dentro do `MISC_TOOLS.forEach` de `renderDiversos()`. `grep -rn "data-tool\|dataset.tool" /home/user/Audio-Visual-IASD` (fora de node_modules/.git) devolve ESTA e só esta linha: nenhum seletor `[data-tool]` em controle.css, nenhuma leitura em controle.js, nenhum oráculo em tools/. Quem decide a aba ativa é a classe, escrita uma linha acima (7159, `'misc-tab' + (miscTool === t.id ? ' active' : '')`), e o clique (7173-7177) lê o `t.id` do FECHO, não o dataset. Compare com o irmão vivo `b.dataset.dest` (controle.js:21925), que é hook declarado de oráculo e aparece em oito pontos do tools/sorteio-tela.test.mjs.

**Cenário.** A linha nunca é lida: ela grava um atributo no DOM a cada redesenho da folha de Ferramentas e nada no app, no CSS ou nos oráculos o consulta. O custo não é o atributo — é o próximo leitor supor que existe um consumidor e preservá-lo (ou, pior, escrever um seletor `[data-tool]` acreditando que a marcação já é contrato).

**Correção proposta.** Apagar a linha 7160. Se a intenção for mantê-la como hook de teste — que é o papel legítimo do `data-dest` —, então escrever o oráculo que a lê no mesmo lote, porque é ele que a torna contrato.

### [17] `renderPlaylist` escreve a classe `has-items` no `#plBtn`, e nenhuma folha de estilo a consome desde a v1.5.0 — a doc ainda afirma que o ícone acende em `--accent`

`app/src/main/assets/web/controle/controle.js:3859` · gravidade **baixa** · NÃO VERIFICADO · lente `controle-js-morto`

**Evidência.** A escrita é `plBtnEl.classList.toggle('has-items', count > 1);` (3859). `grep -rn "has-items" --include=*.css` sobre `controle.css`, `display.css`, `espelho/tela.css`, `tokens.css` e `material-symbols.css` devolve ZERO linhas; no repositório inteiro o termo só aparece em dois lugares: esta linha e `docs/arquitetura/CONTROLE.md:1614`. O `git log -S'has-items' -- controle.css` mostra a regra saindo no commit 58653368 (v1.5.0), e ela já não existe no commit-base desta semana. A doc continua afirmando o contrário: "O badge de contagem (`#plCount`) só aparece a partir do 2º item (mostra `count - 1`), e o ícone só fica destacado em `--accent` (`.has-items`) nesse mesmo caso ... fica neutro (branco)". O comentário logo acima da linha, em controle.js:3855, repete a promessa: "o ícone só fica destacado quando existe de fato uma fila além do item em exibição".

**Cenário.** Nunca produz efeito: com 2 ou mais itens na fila a classe entra no DOM e nenhum seletor a casa, então o ícone do `#plBtn` fica com a mesma tinta de quando há um item só. O sintoma é mudo (nada erra, nada aparece no console) e a leitura a distância é pior que a ausência: quem abrir `docs/arquitetura/CONTROLE.md` para conferir por que o ícone não acende encontra a doc dizendo que ele acende.

**Correção proposta.** Uma das duas, nunca meia: (a) devolver a regra ao `controle.css` (`#plBtn.has-items { color: var(--accent) }`, o par declarado do token) se o destaque ainda é desejado; ou (b) apagar a linha 3859, a meia-frase do comentário de 3855-3856 e a frase de `docs/arquitetura/CONTROLE.md:1614` no mesmo lote.

### [19] Em `telaEmpurrarAgora` o ramo `|| telaTokenDe(it.id)` é inalcançável — e ele faria exatamente o que o comentário duas linhas acima proíbe

`app/src/main/assets/web/controle/controle.js:33907` · gravidade **baixa** · NÃO VERIFICADO · lente `controle-js-morto`

**Evidência.** A linha é `const token = it.token || telaTokenDe(it.id);` (33907), e o comentário imediatamente acima (33904-33906) diz: "O TOKEN VEM DO ITEM ENFILEIRADO, nunca relido agora: entre a fila e este ponto o `__wp` pode ter sido recunhado (ver `telaGarantirEnvio`), e reler mandaria os bytes do wallpaper ANTIGO sob o token do NOVO." O único chamador é `telaEscoar` (33978), que tira o item de `telaFila` (33975). `telaFila` tem UM ponto de escrita em todo o arquivo — `telaFila.push(Object.assign({}, it, { token }));` (33970) —, e ele vem depois de `const token = telaTokenDe(it.id); if (!token) return;` (33965-33967). Logo todo item que chega a `telaEmpurrarAgora` já carrega `token` truthy e `it.token ||` nunca cai no lado direito. Para não confundir com a redundância deliberada: o comentário de 33952-33955 diz que este ramo "CONTINUA VIVO" — mas o que ele credita é a metade `it.token`, não o fallback; a v1.8.48 apagou o irmão dele no `telaGarantirEnvio` pelo mesmo argumento e deixou este.

**Cenário.** Nunca roda: `it.token` é sempre uma string cunhada por `telaGarantirEnvio`. E se um dia rodasse, ele produziria o defeito que o comentário de 33904 nomeia — dois toques seguidos no wallpaper fariam o empurrão reler o token AGORA e mandar os bytes antigos sob o token novo, com a rota `/m/<token>` respondendo 404 para sempre naquela tela.

**Correção proposta.** Trocar por `const token = it.token;` (o `if (!token) return;` de 33908 fica como rede de segurança) e, no mesmo lote, apagar do comentário de 33952-33955 a menção ao "irmão que continua vivo", que deixa de descrever código existente.

### [20] O ramo `want === 'last'` de `bibleGotoChapter` é inalcançável, e o comentário de contrato ainda anuncia `'first' | 'last'`

`app/src/main/assets/web/controle/controle.js:4763` · gravidade **baixa** · NÃO VERIFICADO · lente `controle-js-morto`

**Evidência.** A função é `async function bibleGotoChapter(bookIdx, chapter, want)` (4753) e o ramo é `if (want === 'last') idx = verses.length - 1;` (4763). O literal `'last'` aparece UMA única vez em toda a base web (fora de comentários): nesta comparação. Os dois — e únicos — chamadores estão em `bibleStep` e passam NÚMEROS: `bibleGotoChapter(nx.bookIdx, nx.chapter, t - s.verses.length)` (4804) e `bibleGotoChapter(pv.bookIdx, pv.chapter, t)` (4807), onde `t = s.idx + delta`. O caso de voltar para o fim do capítulo anterior já é atendido pelo ramo seguinte, `typeof want === 'number'` com `want < 0 ? verses.length + want : want` (4764). O comentário de contrato em 4751-4752 continua declarando três formas — "`want`: 'first' | 'last' | um índice" — e nem `'first'` nem `'last'` têm produtor.

**Cenário.** Nunca roda: `want` é sempre um número nos dois chamadores, então a linha 4763 não é avaliada como verdadeira em nenhuma navegação da Bíblia. O custo é o contrato escrito: quem for mexer na navegação de capítulo lê que existem dois sentinelas e escreve o próximo chamador contra uma API que a função não exercita em lugar nenhum.

**Correção proposta.** Apagar a linha 4763 e reduzir o comentário de 4751-4752 ao que a função de fato aceita — um índice, possivelmente negativo, contado a partir do fim.

## OTIMIZAÇÃO DE PADRÃO

### [10] `.popup-header-icon` usa `font-size` para dimensionar um `<svg>`: cinco cabeçalhos ficam presos em 20px fora da escala

`app/src/main/assets/web/controle/controle.css:7110` · gravidade **baixa** · NÃO VERIFICADO · lente `html-js-fiacao`

**Evidência.** `.popup-header-icon { font-size: var(--icon-sm); color: var(--accent); }`. A classe tem sete usos e DUAS formas: em index.html:1658 e 2738 ela veste um `<span class="msym popup-header-icon">` (glifo — o `font-size` funciona); em index.html:1754, 1790, 2323, 2542 e 2763 ela veste um `<span>` que CONTÉM um `<svg viewBox="0 0 24 24" width="20" height="20">`, e um `<svg>` não é dimensionado por `font-size`: ele cai no atributo de apresentação. Não há nenhuma regra `.popup-header-icon svg` no arquivo, e a classe não está em nenhuma das listas de escala (controle.css:817-836). O mesmo vale para `.diag-btn svg` (`#diagSave` e `#contatoBtn`, index.html:2255 e 2280, `width="16"`), que também não tem regra nenhuma.

**Cenário.** MEDIDO em Chromium com a reversão do repositório: hoje o glifo de `#plPopup .msym.popup-header-icon` e o `<svg>` de `#histPopup .popup-header-icon` medem os dois 20px — coincidência, porque `--icon-sm` é 20. Forçando `--icon-sm: 26px`, o glifo vai a **26px**, o ✕ do mesmo cabeçalho (`.popup-close .msym`) vai a **26px**, e o `<svg>` fica em **20px** — dois ícones da MESMA classe, na mesma barra, em tamanhos diferentes, sem erro nenhum. É literalmente a armadilha que o comentário de controle.css:820-826 descreve para as portas do rodapé (v1.5.19) e que a v1.8.68 reencontrou no `.crono-limpar`: *"Elas coincidiam por acidente (`--icon-sm` é 20px), e a divergência era MUDA"*.

**Correção proposta.** Declarar o tamanho onde o botão é descrito, como a regra do arquivo manda: `.popup-header-icon svg { display: block; width: var(--icon-sm); height: var(--icon-sm); }` (ou pôr `.popup-header-icon` na lista do `--icon-sm`, já que ali o glifo e o svg querem o mesmo degrau), e dar a `.diag-btn svg` um degrau declarado em vez do atributo.

## DOCUMENTAÇÃO INCOERENTE

### [0] DESIGN-SYSTEM.md ainda descreve as tres portas com `color-mix` e a `.selbar` em `--btn-accent` — as duas metades foram revogadas (v1.8.61/62/63)

`docs/arquitetura/DESIGN-SYSTEM.md:711` · gravidade **alta** · NÃO VERIFICADO · lente `css-revogacoes`

**Evidência.** A linha 711 afirma, em bloco de citacao: "**E as TRES PORTAS do rodape sairam do `--btn-accent` na v1.5.19** ... elas vestem `color-mix(in srgb, var(--surface) 70%, transparent)`, com `--surface` como piso de falha aberta. A `.selbar` e o `.msg-add-btn` FICAM".

O codigo diz o oposto nas DUAS metades:
- `controle.css:2600-2603` → `.tools-btn, .lib-foot-btn, .import-btn { background: var(--surface-porta); color: var(--accent); box-shadow: 0 2px 8px var(--shadow-card); }` e `tokens.css:348` → `--surface-porta: var(--btn-accent);`. Isto e, as portas VOLTARAM ao `--btn-accent` (v1.8.62/63). Nao ha `color-mix` nenhum na regra delas — `grep -n color-mix controle.css` devolve apenas 1929 (o `.qs-tile` inativo) e comentarios.
- `controle.css:2785-2788` → `.selbar { ... background: var(--bg); ... }` e a regra `.list-foot > .selbar` (2798-2804) nao declara fundo nenhum. O commit 6699cec9 (v1.8.63) removeu `.list-foot > .selbar` da regra agrupada `background: var(--btn-accent)`, deixando so `.msg-add-btn`.

O capitulo parou de ser atualizado na v1.8.59 (ultimo commit que o tocou: 46fd0323); o CSS seguiu ate a v1.8.69. O paragrafo esta encravado no meio de uma pilha cronologica (v1.8.53, v1.8.55, v1.8.56 em volta) e nenhuma delas o corrige.

**Cenário.** O CLAUDE.md manda abrir este capitulo "ANTES DE ESCREVER COR". Um agente que o le antes de mexer no rodape do Cronograma conclui (a) que as portas usam `color-mix` — e ao "restaurar" isso desfaz o pedido literal do operador (*"quero eles em azul, o mesmo azul de ativado dos botoes das configuracoes"*) e reintroduz a transparencia que a v1.8.61 mediu como vazamento (1343 de 3192 amostras mudando de cor com a lista rolando); e (b) que a `.selbar` "FICA" em `--btn-accent` — e ao pinta-la de denim produz exatamente o estado que a v1.8.63 mediu e recusou: o icone do EXCLUIR sobre o `.sel-btn` cai de 4,26:1 para 2,48:1 (abaixo do piso de 3:1 de icone) e o `.sel-count` vai a 1,00:1 no tema claro (denim sobre denim), com o contador da selecao multipla ficando invisivel. Nenhum oraculo cobre documentacao, e o `docs-coerentes.test.mjs` so verifica links, citacoes de arquivo e contagens — nao o conteudo das afirmacoes.

**Correção proposta.** Reescrever o paragrafo da linha 711 para o estado de hoje: as tres portas vestem `--surface-porta` (alias de `--btn-accent`) com traco `--accent` e sombra propria `0 2px 8px` desde a v1.8.62/64; quem SAIU do `--btn-accent` foi a `.selbar` (v1.8.63), e quem FICA e so o `.msg-add-btn`. Manter a razao medida (ΔE00 0,00 entre as duas inquilinas da mesma fatia) no lugar do argumento de habitat, que a revogacao derrubou.

### [26] O comentário do `pacoteDiag` foi órfão para cima do `pacoteConsumirOrigem`, e o `pacoteDiag` ficou sem nenhum

`app/src/main/assets/web/shared/native.js:561` · gravidade **alta** · NÃO VERIFICADO · lente `ponte-contrato`

**Evidência.** Linhas 561-573, verbatim:

```
    // → string: o que o SHELL sabe do pacote (há pronto? no disco? o desfecho
    // do último fecho e do último envio, com o nome da exceção quando houve).
    //
    // Ele existe porque o `-1` do `pacoteCompartilhar` colapsa TRÊS causas, e
    // este lado não tem como separá-las — três rodadas de campo se gastaram
    // nisso. Irmão do `otaDiag` e do `ytDiag`, e com o mesmo consumidor: a
    // pessoa que lê o Registro.
    // APAGA o arquivo do pacote que a importação acabou de ler. Devolve `''`
    // (apagou) ou a FRASE do motivo. Quem decide é o `controle.js`, e só depois
    // de uma importação COMPLETA — o shell não sabe se ela terminou.
    pacoteConsumirOrigem: (url) => call(
      (id) => B.pacoteConsumirOrigem(id, String(url || '')), CALL_TIMEOUT_MS,
    ),
```

E o método que aquele bloco descreve está 31 linhas abaixo, nu:

```
592:    pacoteDiag: () => call((id) => B.pacoteDiag(id), CALL_TIMEOUT_MS)
593:      .then((r) => String(r || '')),
```

O bloco de 561-567 é inconfundivelmente do `pacoteDiag`: ele diz `→ string`, cita o `-1` do `pacoteCompartilhar` e se declara "Irmão do `otaDiag` e do `ytDiag`" — os dois outros métodos que devolvem a linha do Registro. O `pacoteConsumirOrigem` não devolve string de diagnóstico nenhuma: devolve `''` ou a frase do erro, que é exatamente o que as linhas 568-570 dizem.

A genealogia confirma: `git log -L 561,573` mostra que a v1.8.21 (`a6018212`) criou o bloco JUNTO com o `pacoteDiag`, e a v1.8.28 (`2b767a7b`) inseriu o `pacoteConsumirOrigem` + o comentário dele ENTRE os dois — as linhas adicionadas naquele commit são só as 568-573. Os dois lotes estão dentro da semana em revisão.

**Cenário.** Uma sessão abre o `native.js` para mexer no consumo do arquivo de importação, lê as sete linhas imediatamente acima de `pacoteConsumirOrigem` e recebe a descrição de OUTRO método: que ele devolve uma string de diagnóstico, que existe porque o `-1` do `pacoteCompartilhar` colapsa três causas, e que o consumidor dele é "a pessoa que lê o Registro". Nenhuma das três afirmações vale para `pacoteConsumirOrigem`. É o caso nomeado no CLAUDE.md como o mais caro que o repositório sabe produzir em documentação ("Um comentário no lugar errado é pior que um comentário removido: ele responde, e responde errado"), e é o defeito exato que `tools/pares-de-comentario.mjs` foi escrito para pegar — ferramenta que não está no workflow (ela é excluída pelo `grep -vE 'arnes|checar|sem-rede|pares-de-comentario'` do CI), então nada o acusou.

**Correção proposta.** Mover as linhas 561-567 para imediatamente acima de `pacoteDiag` (linha 592), deixando o `pacoteConsumirOrigem` com apenas o comentário dele (568-570). Nenhuma linha de código muda. Rodar `node tools/pares-de-comentario.mjs app/src/main/assets/web/shared/native.js a6018212` para confirmar o reancoramento.

### [27] `PONTE.md` afirma que a invariante 9 tem oráculo; o `CLAUDE.md` diz que não tem, e o oráculo de fato não a exercita

`docs/shell/PONTE.md:587` · gravidade **alta** · NÃO VERIFICADO · lente `ponte-contrato`

**Evidência.** `docs/shell/PONTE.md:576-587` abre a seção "Invariante 9 — no WebView do TELÃO" (`host = null`, loader sem `/saf/`, "com `host != null`, qualquer script de terceiro ali ganharia `pickFolder`, `listFolder`, `pickDoc`, `openExternal` e `espelhoLigar`") e fecha com:

```
587:- Quem trava isso é `tools/ponte.test.mjs`.
```

`CLAUDE.md:358-363` diz o oposto, em caixa alta:

```
   **NÃO HÁ ORÁCULO PARA ELA.** O `ponte.test.mjs` afirma o dreno e a remontagem
   de campos, não a superfície privilegiada no papel `display`; a invariante mora
   só no `StagePresentation.kt` (`host = null` e `assetLoader(…, withSaf = false)`)
   mais as guardas `host == null` de cada método.
```

O código dá razão ao `CLAUDE.md`. O único trecho de `tools/ponte.test.mjs` que usa o papel `display` é `paginaComPapel('display')` (linhas 357-404), e o `__AVBridge` de mentira que ele monta tem CINCO campos — `shellVersion`, `role`, `appVersion`, `busPost`, `otaConfirm` (linhas 364-369). `pickFolder`, `listFolder`, `pickDoc`, `openExternal` e `espelhoLigar` não existem naquele objeto. As três únicas asserções do bloco (linhas 397-403) medem o relay do barramento: `dsp.bus.length === 4`, `construtorTrocado === false`, `vazou === true`. Nenhuma das 35 chamadas a `checar()` do arquivo toca a superfície privilegiada.

**Cenário.** Alguém refatora `StagePresentation.kt` ou `WebViewFactory.kt` e passa a montar o WebView do telão com `host` preenchido (ou com `withSaf = true`). Abre `docs/shell/PONTE.md` — que é o capítulo canônico da ponte, para onde o CLAUDE.md manda ir — lê que `tools/ponte.test.mjs` trava a invariante, roda a suíte, recebe verde e conclui que o telão continua sem superfície nativa. A partir daí o documento do Display (que hospeda `.pptx` renderizado) ganha `pickFolder`, `listFolder`, `pickDoc`, `openExternal` e `espelhoLigar` — este último abre um `ServerSocket` na rede da igreja —, sem nada na tela, no log ou no CI. É o inverso do modo de falhar seguro: um portão de segurança anunciado como coberto e que nunca foi medido.

**Correção proposta.** Trocar a linha 587 pela mesma afirmação do CLAUDE.md: que a invariante não tem oráculo, que ela mora em `StagePresentation.kt` mais as guardas `host == null`, e que escrevê-la é carregar o `native.js` com um `__AVBridge` cujo `role()` devolva `'display'` e afirmar que os cinco métodos privilegiados resolvem o desfecho inofensivo. Manter a menção ao `ponte.test.mjs` só onde ela é verdade (o dreno e a remontagem de campos).

### [1] DESIGN-SYSTEM.md afirma que os SVGs inline "nunca estiveram" sob a escala de icone — e o `controle.css` tem uma secao inteira dizendo o contrario

`docs/arquitetura/DESIGN-SYSTEM.md:186` · gravidade **media** · NÃO VERIFICADO · lente `css-revogacoes`

**Evidência.** Linha 186: "| `--icon-sm` / `--icon-md` / `--icon-lg` | `20` / `22` / `24px` | escala dos **glifos de fonte** (`.msym`). Os SVGs inline trazem `width`/`height` no proprio HTML e **nunca estiveram sob ela**".

`controle.css:812-818` abre uma secao com o titulo oposto: "---------- A escala de icone vale para SVG tambem ---------- ... O atributo `width`/`height` do elemento continua no HTML como valor de partida (vale antes de o CSS carregar), mas **quem MANDA e esta regra**". Seguem tres listas `:is(...) svg { width: var(--icon-*) }` — `controle.css:819-833` (`--icon-sm`, ~15 seletores), `834-836` (`--icon-md`) e `838` (`--icon-lg`) —, mais `.qs-tile svg` (9092), `.coll-group-acao svg` (4448), `.pl-pack svg` (7322), `.sorteio-dest svg` (8837) e `.crono-limpar svg` (860). Nao ha correcao em lugar nenhum do capitulo: `grep -n 'icon-sm' DESIGN-SYSTEM.md` devolve so 186, 368 e 1743.

**Cenário.** Um agente cria um botao de icone novo com SVG inline, abre este capitulo (o CLAUDE.md o nomeia como leitura obrigatoria antes de escrever cor/escala), le que SVGs inline nao estao sob a escala, e NAO acrescenta o seletor a nenhuma das duas listas `:is()`. O `<svg>` passa a viver do atributo `width`/`height` do HTML — que pode coincidir com o degrau certo por acidente e deixar de coincidir no dia em que alguem mexer no token. E o defeito EXATO que a v1.8.68 gastou um lote medindo: o `.crono-limpar` media 20px contra os 22px da engrenagem a 34px de distancia na MESMA faixa, com as CAIXAS dos dois botoes iguais (34x34) e assercao provando que eram iguais — por isso ninguem viu. O CLAUDE.md ja registra a regra corrigida ("Botao de icone novo entra numa das duas listas no lote em que nasce"); o capitulo que ele manda abrir contradiz essa regra.

**Correção proposta.** Corrigir a celula da linha 186: os tres tokens governam `.msym` E os SVGs inline, por tres listas `:is()` em `controle.css` (`--icon-sm` em 819-833, `--icon-md` em 834-836, `--icon-lg` em 838 mais a linha propria do `.crono-limpar` em 860); o atributo `width`/`height` do HTML e so o valor de partida antes de o CSS carregar, e um botao FORA das listas cai nele em silencio.

### [2] A segunda declaracao de `--surface-porta` (bloco do tema claro) e um no-op, e o comentario que a justifica afirma o contrario do que o CSS faz

`app/src/main/assets/web/shared/tokens.css:743` · gravidade **media** · NÃO VERIFICADO · lente `css-revogacoes`

**Evidência.** Linhas 742-745:
```
  /* A superficie das tres portas — o MESMO alias do escuro (ver o bloco de la),
     e ele TEM de estar escrito aqui: sem esta linha o `:root` sem atributo
     venceria e o tema claro ficaria no valor do escuro. */
  --surface-porta: var(--btn-accent);
```
MEDIDO em Chromium (carregando o `tokens.css` real e removendo APENAS esta linha): `--surface-porta` computa `#293d57` no escuro e `#dcebfe` no claro — IDENTICO com e sem a linha. A substituicao de `var()` acontece no valor computado do proprio `:root`, onde `--btn-accent` ja e o do tema claro.

O proprio arquivo diz isso 400 linhas acima, no bloco escuro (`tokens.css:336-338`): "O alias resolve por tema sozinho, porque a substituicao acontece no valor COMPUTADO". As duas afirmacoes se contradizem dentro do mesmo arquivo.

Historia (git): em 0e024ba8/v1.8.61 os valores eram LITERAIS (`#1f252c` / `#eff1f3`) e a linha era de fato necessaria; em 6699cec9/v1.8.63 os dois viraram `var(--btn-accent)` — e foi NESSE mesmo commit que o comentario "TEM de estar escrito aqui" foi escrito, ja falso.

**Cenário.** Nao muda pixel nenhum hoje — o defeito e de manutencao, e e o caso que o CLAUDE.md nomeia por extenso ("a reversao TAMBEM ACHA DECLARACAO QUE NAO FAZ NADA... um comentario que credita a peca errada manda o proximo leitor proteger o lugar errado"). Quem for simplificar o bloco do tema claro le "TEM de estar escrito aqui" e mantem uma linha morta; e quem for mexer no alias acredita que o bloco claro e o ponto de controle do tema claro e edita os dois lugares achando que sao independentes, quando o segundo e ignorado.

**Correção proposta.** Remover a linha 745 e o comentario 742-744 juntos (a prova de reversao ja esta feita: os dois temas computam o mesmo valor sem ela). Se a simetria visual entre os blocos for desejada, trocar o comentario por "redundante por simetria — o alias do bloco base ja resolve por tema", nunca por uma afirmacao de necessidade.

### [3] O comentario de `.list-foot > .selbar` ainda credita um `background` a regra agrupada de onde a v1.8.63 o removeu

`app/src/main/assets/web/controle/controle.css:2799` · gravidade **media** · NÃO VERIFICADO · lente `css-revogacoes`

**Evidência.** Linhas 2798-2804:
```
.list-foot > .selbar {
  /* O preenchimento vem da regra agrupada, junto de "Importar arquivos" — e
     vence o `background` da `.selbar` base por especificidade, nao pela
     ordem. */
  min-height: var(--hit-foot);
  padding: 0 .5rem;
}
```
A regra agrupada e `controle.css:2693-2695` → `.import-btn, .list-foot > .selbar, .msg-add-btn, .pl-pack { border-radius: var(--radius-btn); }` — so RAIO, nenhum `background`. O commit 6699cec9 (v1.8.63) tirou `.list-foot > .selbar` da regra `background: var(--btn-accent)` (o diff mostra `-.list-foot > .selbar, .msg-add-btn {` → `+.msg-add-btn {`) e deixou este comentario de pe.

Duas afirmacoes irmas sobreviveram ao mesmo lote:
- `controle.css:2793` — "O preenchimento em `--accent-soft` nao recria o problema acima" (a `.selbar` do rodape nao tem preenchimento algum; o unico fundo e `--bg`, herdado da base em 2787).
- `controle.css:2545-2546` — "A `.selbar` NAO ENTRA. Ela e a outra inquilina da fatia e **continua em `--btn-accent`**".

**Cenário.** Tres comentarios no mesmo arquivo descrevem um preenchimento que a v1.8.63 removeu de proposito, e nenhum deles tem correcao adjacente (a nota da v1.8.63 esta 90 linhas acima, presa ao `.msg-add-btn`). Quem for ajustar o rodape le "o preenchimento vem da regra agrupada", nao encontra preenchimento nenhum, e o caminho natural e reintroduzi-lo — que e o estado medido e recusado na v1.8.63 (icone do EXCLUIR a 2,48:1, abaixo do piso de 3:1; `.sel-count` a 1,00:1 no tema claro). O CLAUDE.md e explicito: "APAGAR CODIGO E APAGAR O QUE O DESCREVE, NO MESMO LOTE" e "um comentario errado e pior que um comentario longo: ele nao custa so leitura, produz a decisao errada".

**Correção proposta.** No mesmo lote: (a) trocar o comentario 2799-2801 por "a `.selbar` do rodape NAO tem preenchimento proprio desde a v1.8.63 — ela herda `--bg` da regra base; da agrupada vem so o raio"; (b) corrigir 2793 (o preenchimento em `--accent-soft` nao existe mais); (c) corrigir 2545-2546 para dizer que a `.selbar` SAIU do `--btn-accent` na v1.8.63 e por que (ΔE00 0,00 contra as portas).

### [7] O comentário colado em `.diag-btn--primario` afirma que só um botão o veste — os três vestem desde a v1.8.65

`app/src/main/assets/web/controle/controle.css:7655` · gravidade **media** · NÃO VERIFICADO · lente `html-js-fiacao`

**Evidência.** O bloco 7638-7657 fica IMEDIATAMENTE acima de `.diag-btn--primario` (7658) e termina em: *"E SÓ UM DELES O VESTE: guardar o Registro é o PASSO, falar é o DESTINO. Dois preenchidos lado a lado seriam duas ações primárias na mesma faixa"*. Mas os TRÊS botões da faixa o vestem hoje: index.html:2235 (`#versaoBtn`), 2253 (`#diagSave`) e 2278 (`#contatoBtn`), todos `class="diag-btn diag-btn--primario"`. A revogação está escrita no MESMO arquivo, 90 linhas acima (controle.css:7547): *"E OS TRÊS VESTEM O PREENCHIDO, revogando por pedido a regra da v1.8.51"*. O mesmo bloco velho ainda afirma a medida *"`--accent-fill`: 1,94:1 no escuro e 4,80:1 no claro contra a faixa"*, e a mensagem do commit que a revogou (b47ae132) registra o número novo: *"o botão contra a folha caiu de 1,94:1 para 1,77:1 no escuro — o cinza clareava o fundo"*, porque a `.footer-diag` perdeu o `--surface-2` no mesmo lote. Há ainda um terceiro eco em index.html:2251 (*"ELE FICA QUIETO, sem fundo próprio"*) sobre o `#diagSave`, que é preenchido.

**Cenário.** Quem for mexer no rodapé de Configurações lê o comentário GRUDADO na regra, não o que está 90 linhas acima. Ele diz que um segundo preenchido é defeito e dá um número de contraste que já não vale — e o próximo lote ou 'conserta' tirando o preenchido de dois botões (desfazendo o pedido do operador) ou reusa 1,94:1 como piso medido numa faixa que já não existe. É o modo de falhar que o CLAUDE.md nomeia: *"Um comentário no lugar errado é pior que um comentário removido: ele responde, e responde errado"*.

**Correção proposta.** Reescrever o bloco 7638-7657 no estado da v1.8.65 (o par `--accent-fill`/`--on-accent` continua sendo o argumento; o que sai é a exclusividade e a medida velha), com o contraste re-medido contra a faixa SEM `--surface-2`. O comentário de index.html:2251 sai no mesmo lote.

### [8] O cabeçalho de `renderVersionLabel` diz TRÊS casas; a função escreve duas desde a v1.8.66

`app/src/main/assets/web/controle/controle.js:396` · gravidade **media** · NÃO VERIFICADO · lente `html-js-fiacao`

**Evidência.** Linha 396: `// ===== UM NÚMERO SÓ, EM TRÊS CASAS (v1.7.0) =====`, e 398-401: *"ela é o ESCRITOR ÚNICO das três superfícies que dizem a versão: a badge do Modo Fácil, a badge do avançado e o rodapé de Configurações. Três escritores seriam três chances de o app afirmar duas versões diferentes na mesma sessão."* O corpo, na linha 449, é `for (const el of [simpleVersionEl, appVersionEl]) {` — DUAS. O commit f03446cc (v1.8.66) trocou `[simpleVersionEl, listVersionEl, appVersionEl]` por `[simpleVersionEl, appVersionEl]`; a 'badge do avançado' era o `#listVersion`, que deu lugar ao `#cronoLimpar`. O repositório já sabe disso em três lugares: a nota de controle.js:344-346, a tabela do CLAUDE.md (*"escreve as DUAS casas"*) e os oráculos, que agora afirmam a AUSÊNCIA do nó (tools/abertura-e-transferencia.test.mjs:264-266, tools/limpar-cronograma.test.mjs:119).

**Cenário.** O cabeçalho é a primeira coisa que se lê ao abrir o bloco — a nota que o corrige está 50 linhas ACIMA dele, fora do bloco. Quem precisar acrescentar uma quarta superfície de versão procura as três que o texto promete, não acha a do avançado, e ou conclui que o `renderVersionLabel` está quebrado ou ressuscita o `#listVersion` — que é exatamente o que dois oráculos passaram a reprovar.

**Correção proposta.** `UM NÚMERO SÓ, EM DUAS CASAS`, e a frase seguinte listando *"a badge do Modo Fácil e o rodapé de Configurações"*, com a saída da terceira dita numa linha (a nota de 344-346 pode ser absorvida aqui, onde ela é lida).

### [9] O comentário do `#backBtn` afirma que ele serve HOJE à navegação da Bíblia; ele não tem dono desde a v1.5.0

`app/src/main/assets/web/controle/index.html:877` · gravidade **media** · NÃO VERIFICADO · lente `html-js-fiacao`

**Evidência.** index.html:871-879, sobre o `<button id="backBtn">` da linha 880: *"este é o ÚNICO botão só-de-ícone do app que não tinha rótulo nenhum, e é a única saída da aba Pastas e da navegação da Bíblia"* e *"O voltar serve HOJE só à navegação da Bíblia: a tela de Favoritos, que era a outra dona dele, virou a gaveta `#favPopup`"*. Nada disso vale: (1) `#backBtn` não tem `addEventListener` nenhum — a única linha do app que o toca é `backBtnEl.hidden = true` (controle.js:3817), e a única outra menção é a nota de controle.js:31491-31494, que diz o contrário: *"O `#backBtn` do cabeçalho perdeu o dono na v1.5.0: ele só servia à Bíblia, que virou folha e levou o voltar dela junto. O nó fica no HTML, sempre oculto"*; (2) o voltar da Bíblia é o `#bibleBack`, dentro da folha (index.html:1060, ligado em controle.js:31495); (3) a 'aba Pastas' e a gaveta `#favPopup` que o comentário cita já não existem — o próprio index.html:2641 diz *"(A GAVETA `#favPopup` SAIU na v5.294...)"*.

**Cenário.** Os dois comentários sobre o MESMO elemento se contradizem, e estão a 30 mil linhas um do outro. A v1.8.66 acabou de pôr o `#cronoLimpar` na mesma faixa, na linha imediatamente seguinte (881) — quem mexer ali de novo lê primeiro o comentário do HTML, acredita que o `#backBtn` é um controle vivo da Bíblia, e ou preserva o que não precisa ser preservado pelo motivo errado ou liga alguma coisa a um nó que `renderListTitle` volta a esconder no próximo render.

**Correção proposta.** Trocar o comentário de 871-879 pelo que a controle.js:31491-31494 já diz — o nó fica, oculto, e a linha que o esconde é a guarda. As citações à 'aba Pastas', ao `#favPopup` e à 'navegação da Bíblia' saem, porque as três nomeiam coisas removidas.

### [21] O KDoc de `pacotePronto` afirma que a ponte não tem como responder "há pronto?" — e `pacoteProntoEstado` existe desde a v1.8.45

`app/src/main/java/br/org/iasd/av/MainActivity.kt:2781` · gravidade **media** · NÃO VERIFICADO · lente `kotlin-semana`

**Evidência.** MainActivity.kt:2777-2792 (KDoc do `@Volatile var pacotePronto` no companion) diz textualmente: "Quem decide o que o tile oferece é o LADO WEB, e lá `pacotePronto` é estado de PÁGINA (`let`, em `controle.js`) que nada semeia a partir daqui — **não há método de ponte que responda "há pronto?"** ([pacoteDiag] devolve TEXTO para uma pessoa ler no Registro, não um estado consumível)" e fecha com "O CONSERTO É O DO `mirrorEstado` … um método de ponte que devolva nome e `length()` do disco, semeado na abertura. Custa `SHELL_VERSION`, `minShell`, `shellTag` e Release, e por isso está em `docs/ACHADOS-EM-ABERTO.md` em vez de aqui."

As duas afirmações são falsas no HEAD: (a) o método existe e é exatamente o descrito — `BridgeHost.pacoteProntoEstado(): JSONObject?` (NativeBridge.kt:247), `@JavascriptInterface fun pacoteProntoEstado(callId)` na fila `io` (NativeBridge.kt:2091), implementação em MainActivity.kt:1377 devolvendo `{nome, bytes}` com os bytes saindo do `length()` do disco, exposto em `shared/native.js:585` e consumido por `lerPacotePronto()` em `controle/controle.js:26489` — a semeadura na abertura que o KDoc pede; (b) `docs/ACHADOS-EM-ABERTO.md` não contém a palavra "pacote" em lugar nenhum (os quatro achados são os dois do áudio do espelhamento, o cliente da escada e a faixa de álbum). O `docs/HISTORICO.md:54` confirma o fecho: "v1.8.45 — … O PACOTE PRONTO SOBREVIVE À RECARGA (shell 72, era o `ACHADOS-EM-ABERTO` §0)".

**Cenário.** O próximo agente abre `MainActivity.kt` para mexer no pacote, lê o KDoc, conclui que o tile ainda oferece "Exportar" com gigabytes prontos no disco e que o conserto custa SHELL_VERSION + minShell + shellTag + Release — e ou reimplementa um método que já existe (segundo degrau de ponte, segunda Release, duas fontes de verdade para o mesmo estado), ou vai procurar o §0 em `ACHADOS-EM-ABERTO.md`, não o acha, e gasta a sessão descobrindo qual dos dois arquivos mente. É a lápide que o próprio CLAUDE.md proíbe: "um comentário errado é pior que um comentário longo: ele não custa só leitura, produz a decisão errada".

**Correção proposta.** Reescrever o bloco 2777-2792 para o que vale hoje: o companion guarda o arquivo, o lado web o REENCONTRA na abertura por `pacoteProntoEstado()` (shell 72, v1.8.45), e um pronto cujo arquivo sumiu responde `null`. Apagar a referência a `docs/ACHADOS-EM-ABERTO.md` e o parágrafo do "conserto" inteiro.

### [23] CLAUDE.md diz "três" exclusões de backup e chama o espelho-tls de "a única" que sai da transferência direta — são quatro, e duas saem

`CLAUDE.md:2183` · gravidade **media** · NÃO VERIFICADO · lente `kotlin-semana`

**Evidência.** CLAUDE.md:2183 abre a seção "Backup com regras" com "`allowBackup="true"` sozinho leva tudo, e **três** coisas não podem ir:" e lista três bullets (web-ota, espelho-tls, app_webview). CLAUDE.md:2195 afirma, sobre o espelho-tls: "**É a única exclusão que sai também da transferência direta:** perdê-la ao trocar de aparelho custa reemitir e reimportar".

Os dois arquivos de recurso têm QUATRO exclusões desde este lote: `res/xml/backup_rules.xml:16` (`<exclude domain="file" path="pacote" />`) e `res/xml/data_extraction_rules.xml`, que a traz tanto em `<cloud-backup>` quanto em `<device-transfer>`. O `git diff 9d28e8a..HEAD -- app/src/main/res/xml` mostra as duas linhas entrando na semana (v1.8.17, "exportar direto para o compartilhar"). Logo `files/pacote/` é a SEGUNDA exclusão que sai também da transferência direta, e o "três" virou quatro. O comentário do próprio `data_extraction_rules.xml:3` repete o defeito por dentro ("duas coisas ali não podem ir junto" seguido de quatro itens numerados) e a linha 22 se autorreferencia errado ("Ele é uma CÓPIA do que os itens 3 e 4 já cobrem", sendo ele mesmo o item 3).

**Cenário.** CLAUDE.md é lido inteiro por um agente antes de qualquer trabalho, e esta seção é a única descrição da política de backup. Um lote que mexa em backup confere a lista de três, não encontra `files/pacote` nela, e conclui que a linha nos dois XML é resíduo — remove-a. A partir daí o backup em nuvem passa a tentar levar um `.avpkg` do tamanho do acervo inteiro contra uma cota de 25 MB (o mesmo motivo pelo qual `app_webview` foi excluído), e a transferência direta restaura num aparelho novo gigabytes de um arquivo temporário que ninguém vai importar.

**Correção proposta.** Trocar "três" por "quatro" em CLAUDE.md:2183, acrescentar o bullet de `files/pacote/` (é cópia do acervo, existe por minutos, a faxina do lançamento o recolhe) e reescrever a frase de 2195 para "sai também da transferência direta, como `files/pacote/`". De carona, corrigir "duas coisas" → "quatro coisas" e "itens 3 e 4" → "item 4" no comentário de `data_extraction_rules.xml`.

### [29] O `CLAUDE.md` afirma em presente que a transmissão direta chega às telas da rede — nenhum manifesto é produzido desde a v1.7.7

`CLAUDE.md:1032` · gravidade **media** · NÃO VERIFICADO · lente `ponte-contrato`

**Evidência.** ```
1032:- **A TRANSMISSÃO DIRETA CHEGA ÀS TELAS.** A rota `/s/<token>` repassa a faixa do
1033:  googlevideo (o `Range` do cliente sobe cru, a resposta é espelhada de volta)
1034:  com o UA que combina com a URL, e o `telaEnriquecer` reescreve
1035:  `/stream/<token>` → `/s/<token>`. O token é o MESMO dos dois lados (o registro
1036:  do `StreamProxy` é um só): não há segunda extração.
```

O percurso está cortado na origem. O `/stream/<token>` só nasce em `YoutubeGrab.kt:882` (`.put("url", StreamProxy.urlFor(f.url))`), dentro do manifesto que `NativeBridge.ytStream` devolve — e `AVNative.ytStream` não tem chamador nenhum na base web (ver o achado anterior). O ramo que a linha descreve, `controle.js:34007`, é `if (it.stream) { const man = telaManifestoDaRede(it.stream); … }`, e o campo `it.stream` só é gravado por `AVDB.addStreamMedia`/`setMediaStream` — as duas na lista `MORTAS_DE_PROPOSITO` de `tools/funcao-sem-chamador.test.mjs:73-76`, com a nota: *"SEM CHAMADOR DESDE A v1.7.7 … A transmissão direta saiu do `controle.js` a pedido do operador"*. O `shared/mse.js` abre com `// ===== NADA NESTE APP CRIA UM MANIFESTO NOVO (v1.7.7) =====`.

O próprio `CLAUDE.md` registra a remoção 606 linhas abaixo, na linha 1638: *"Foi TRANSMISSÃO DIRETA da v5.212 à v1.7.2 … e ela saiu a pedido do operador"*. As duas linhas se contradizem no mesmo arquivo.

**Cenário.** O `CLAUDE.md` é lido INTEIRO por um agente antes de qualquer trabalho, e esta linha mora na seção do telão por comandos — a que se abre para mexer nas telas da rede. Quem a lê conclui que um vídeo do YouTube transmitido chega ao computador da igreja, e desenha o lote seguinte em cima disso: mantém a rota `/s/<token>` do `EspelhoServidor.kt:744-758` e o `telaManifestoDaRede`/`telaEnriquecer` como caminho quente, ou pior, escreve uma frase de UI prometendo ao operador um comportamento que o app não tem. A única maneira de `it.stream` ser verdadeiro hoje é um registro gravado antes da v1.7.2 num aparelho atualizado — cujo manifesto expira em horas e cuja recuperação (`setMediaStream`) também já não tem chamador.

**Correção proposta.** Reescrever a linha 1032 no passado, como a 1638 já faz, ou removê-la e deixar apenas a observação de que a rota `/s/<token>` e o `telaEnriquecer` continuam no código como LEITURA de registros antigos — nunca como capacidade viva. `docs/arquitetura/DISPLAY.md:204` e `docs/arquitetura/MODELO-DE-DADOS.md:454` carregam a mesma afirmação e entram no mesmo lote.

### [31] `native.js` afirma que o `pickDoc` é o único método da ponte que não remonta campo a campo — pelo menos quinze não remontam

`app/src/main/assets/web/shared/native.js:765` · gravidade **media** · NÃO VERIFICADO · lente `ponte-contrato`

**Evidência.** ```
765:    // CADA ITEM É `{ url, name, type, size }`, e este é o único método da ponte
766:    // que NÃO remonta campo a campo — a lista vem do Kotlin já na forma final e
767:    // passa direto. É deliberado: …
```

O próprio arquivo o contradiz 106 linhas acima, no comentário de `atualizacaoEstado`:

```
659:    // PASSA-VOO, e não remontagem campo a campo como o `nowPlaying`/`bgProgress`
660:    // do outro sentido: aqui quem monta o objeto é o Kotlin e quem o consome é o
661:    // `controle.js`, então um campo novo do shell chega sozinho.
```

E são quinze outros, todos `call(...)` cru ou com um `r || []` que não toca campo nenhum: `listFolder` (331), `areaTransferencia` (342), `displays` (347), `ytStream` (395), `ytSearch` (403), `ytCanalPlaylists` (416), `ytPlaylist` (424), `pacoteConsumirOrigem` (571), `otaPending` (640), `otaApply` (648), `atualizacaoEstado` (674), `micDiag` (717), `deckPages` (787), `espelhoEstado` (867), `espelhoDiag` (868), `espelhoCertEstado` (889). Os que DE FATO remontam são cinco: `bgProgress`, `bgConcluido`, `nowPlaying`, `ytDetalhes` e `pacoteProntoEstado`.

`git log -S "único método da ponte"` aponta `58871a56` (v1.7.6) — dentro da semana em revisão.

**Cenário.** O CLAUDE.md eleva a remontagem a regra dura ("Campo novo no objeto = campo novo no `native.js`, sempre", repetida em `PONTE.md:251-254`), e o modo de falhar dela é declaradamente mudo. Quem precisar acrescentar um campo a `espelhoEstado`, `micDiag`, `ytSearch` ou `atualizacaoEstado` lê esta linha, conclui que aqueles métodos remontam, e vai procurar no `native.js` a coerção que precisa atualizar — não acha, e a partir daí tem duas saídas igualmente ruins: acrescentar uma remontagem onde ela é a armadilha que a linha 767 diz que seria (o campo seguinte some em silêncio), ou concluir que o arquivo está incompleto e desconfiar da regra inteira. A afirmação também esconde que o `pickDoc` não é exceção nenhuma — ele é o caso NORMAL desta ponte.

**Correção proposta.** Trocar "este é o único método da ponte que NÃO remonta campo a campo" por a afirmação que vale: a remontagem é a exceção, reservada aos objetos que o LADO WEB monta e ao punhado que coage para a tela (`bgProgress`, `bgConcluido`, `nowPlaying`, `ytDetalhes`, `pacoteProntoEstado`); o resto é passa-voo, e o `pickDoc` é passa-voo pelo motivo já escrito nas linhas 767-769. Manter ali só a razão específica dele (`size`), que é a parte correta do bloco.

### [32] O comentário do `--surface-porta` ainda afirma que a `.selbar` "continua em `--btn-accent`" — a v1.8.63 tirou o azul dela

`app/src/main/assets/web/controle/controle.css:2545` · gravidade **media** · NÃO VERIFICADO · lente `arqueologia-revogacoes`

**Evidência.** Linha 2545-2551 (escrita na v1.5.19 e nunca atualizada): "A `.selbar` NÃO ENTRA. Ela é a outra inquilina da fatia e continua em `--btn-accent`: os `.sel-btn` que moram EM CIMA dela são `--surface-2` (branco a .92), e sobre uma superfície quieta o par habilitado × desabilitado cai a ΔE **2,11** no tema claro — abaixo do limiar de percepção, isto é, o app perderia a distinção entre disponível e INDISPONÍVEL na barra que hospeda o excluir."

O código diz o contrário. A regra agrupada da linha 2693 é hoje `.import-btn, .list-foot > .selbar, .msg-add-btn, .pl-pack { border-radius: var(--radius-btn); }` — SÓ raio, nenhum `background` —, e o único fundo que a barra tem é a base da linha 2787: `.selbar { ... background: var(--bg); ... }`. O próprio arquivo registra a revogação 170 linhas abaixo (2711-2725): "---------- E A `.selbar` LARGOU O AZUL (v1.8.63) ---------- ... A SAÍDA NÃO É UMA COR NOVA, É UMA REMOÇÃO: sem esta declaração sobra a base `.selbar { background: var(--bg) }` ... o ícone do EXCLUIR sobre o `.sel-btn` estava em **2,48:1**, abaixo do piso de 3:1 de ícone, e vai a **4,26:1**". O CLAUDE.md também já está atualizado ("E A `.selbar` LARGOU ESSE AZUL NO MESMO LOTE ... Ela volta à base (`--bg`)").

O mesmo lote deixou um segundo resto na linha 2799, dentro do bloco `.list-foot > .selbar`: "O preenchimento vem da regra agrupada, junto de \"Importar arquivos\" — e vence o `background` da `.selbar` base por especificidade, não pela ordem." — a regra agrupada não declara mais `background` nenhum.

**Cenário.** Dois comentários do MESMO arquivo afirmam coisas opostas sobre a mesma regra, e o errado vem PRIMEIRO na leitura. Quem abrir o bloco do `--surface-porta` para mexer nas portas do rodapé lê um argumento MEDIDO (ΔE 2,11 no tema claro) dizendo que a `.selbar` tem de ficar em `--btn-accent` para o app não perder a distinção entre disponível e indisponível na barra que hospeda o EXCLUIR — e "restaura" o azul, reintroduzindo exatamente o que a v1.8.63 mediu e removeu: o ícone do excluir volta de 4,26:1 para 2,48:1, abaixo do piso de 3:1, e o `.sel-count` cai de 9,14:1 para 5,37:1. A linha 2799 fecha a armadilha pelo outro lado: quem quiser mudar o fundo da barra vai editar a regra agrupada da linha 2693, onde não há fundo nenhum, e concluir que o CSS não responde.

**Correção proposta.** Trocar o parágrafo 2545-2551 por uma nota curta dizendo que a `.selbar` SAIU do azul na v1.8.63 (apontando para o bloco de 2711) e preservando só o que ainda vale — a medição do ΔE 2,11 como razão histórica revogada, ou nada. Corrigir a linha 2799 para "o preenchimento vem da base `.selbar` (`--bg`); a regra agrupada acima dá só o raio".

### [33] O CLAUDE.md diz que a escala de ícone mora em DUAS listas — são três degraus declarados e três listas no `controle.css`

`CLAUDE.md:1345` · gravidade **media** · **VERIFICADO** · lente `arqueologia-revogacoes`

> **Conferido nesta sessão:** medido: `controle.css:528` declara `--icon-lg: 24px`, com 7 regras consumindo — e é o degrau que a v1.8.69 usou no `.crono-limpar`, o botão que o próprio parágrafo cita

**Evidência.** CLAUDE.md:1345-1353: "A escala de ícone mora em DUAS listas de `controle.css` (`--icon-sm`, 20px, e `--icon-md`, 22px), e um botão que não esteja em NENHUMA delas cai no atributo `width`/`height` que o HTML escreveu ... **Botão de ícone novo entra numa das duas listas no lote em que nasce**".

O `controle.css` declara TRÊS degraus (linhas 526-528):
  --icon-sm: 20px;   /* botões de linha, cabeçalho, popups */
  --icon-md: 22px;   /* abas e transporte (alvos maiores) */
  --icon-lg: 24px;   /* miniatura-ícone e dicas de deslize */
e TRÊS listas: `:is(.row-btn, .row-slot, ...) svg { --icon-sm }` (817-833), `:is(.lib-toggle, .t-btn, .ctl-btn, .misc-tab, .settings-btn) svg { --icon-md }` (834-836) e, na linha 838, `:is(.mic-btn, .misc-project) svg { display: block; width: var(--icon-lg); height: var(--icon-lg); }` — que existe desde a v5.49 (`git log -L 836,840`), isto é, já existia quando a frase foi escrita na v1.8.68.

O próprio oráculo do lote seguinte já lê TRÊS: `tools/limpar-cronograma.test.mjs:190` — `degraus: ['--icon-sm', '--icon-md', '--icon-lg'].map(...)` — e o `docs/HISTORICO.md` da v1.8.69 nomeia o terceiro por extenso ("O BOTÃO É A ÚNICA PEÇA DO APP COM `--icon-lg` NUMA CAIXA DE `--hit`").

**Cenário.** Este arquivo é lido INTEIRO por um agente antes de qualquer trabalho, e esta é uma instrução de ação ("entra numa das duas listas no lote em que nasce"). Um botão de ícone novo de barra larga — o caso do `--icon-lg`, 24px — é escrito seguindo a instrução e entra na lista do `--icon-sm` ou do `--icon-md`, saindo 20 ou 22px onde o vizinho mede 24. A divergência é MUDA pelo mesmo motivo que o parágrafo descreve: as CAIXAS continuam iguais, e é o `<svg>` dentro delas que diverge. É a armadilha da v1.5.19 e da v1.8.68 repetida, agora causada pela regra que existe para impedi-la.

**Correção proposta.** Corrigir a enumeração para os três degraus (`--icon-sm` 20px · `--icon-md` 22px · `--icon-lg` 24px) e as três listas, e reescrever a instrução como "entra numa das TRÊS listas — ou ganha regra própria com a razão ao lado, quando a combinação degrau × caixa for única no app", que é o que o parágrafo seguinte (o da v1.8.69) já descreve.

### [37] O CLAUDE.md promete um "indicador ao vivo" do estado do telão em Configurações que o app nunca desenha

`CLAUDE.md:1632` · gravidade **media** · NÃO VERIFICADO · lente `arqueologia-revogacoes`

**Evidência.** CLAUDE.md:1632, na tabela "Divergências entre o caminho web e o nativo":
  | Estado do telão (Configurações) | atalho `window.open('../display/')` | **indicador ao vivo**, desabilitado como botão |

No app o elemento nunca aparece. `index.html:2174` o declara escondido — `<button id="openDisplayBtn" class="display-status" hidden>` — e o único ponto do `controle.js` que o revela é `openDisplayBtnEl.hidden = false` na linha 31867, dentro do ramo `else` do `if (window.__NATIVE__)`, ou seja, SÓ no navegador. O comentário desse ramo é explícito (31864-31866): "NO NAVEGADOR ELE FICA, e é AÇÃO, não estado ... É o único caso em que este botão faz alguma coisa." O ramo nativo registra a mudança de casa em 31835: "renderCast();          // a folha de conexão é quem mostra isto agora".

A classe `.connected` também nunca é aplicada a ele: as duas únicas escritas de `connected` no `controle.js` são `pvCastBtnEl` (31020) e `castMirrorBtnEl` (32302). O `controle.css:7521-7525` já diz isso: "`.connected` sobrou de quando este botão era o INDICADOR do telão no rodapé de Configurações (v5.193 o tirou de lá ...)".

O cabeçalho da mesma regra CSS repete a promessa errada (`controle.css:7509-7511`): "Estado do telão (rodapé do popup de Exibição). No app é só um indicador (desabilitado); no navegador continua clicável ... Verde quando há TV recebendo a Presentation."

**Cenário.** A tabela de divergências é o que se consulta para saber o que muda entre navegador e app, e o CLAUDE.md é lido inteiro antes de qualquer trabalho. Quem receber um relato do tipo "o estado do telão em Configurações não acende" vai procurar um defeito no `#openDisplayBtn` — que está `hidden` por construção no app — e pode "consertar" revelando-o, devolvendo ao rodapé de Configurações um indicador que a v5.193 moveu de propósito para a folha de conexão ("quem está conectado é assunto da folha de conexão"), e que nasceria morto porque nada aplica `.connected`. O comentário de `controle.css:7509` manda o leitor pelo mesmo caminho e contradiz o comentário 12 linhas abaixo, no mesmo bloco.

**Correção proposta.** Trocar a célula nativa da linha 1632 por algo como "**não existe** — o botão fica `hidden`; quem mostra a conexão é a folha de conexão (`renderCast`)", e corrigir o cabeçalho de `controle.css:7509-7511` para dizer que no app o botão não é desenhado e que `.connected` não tem escritor (a nota de 7521-7525 já explica por que a regra fica).

### [4] O comentario de `renderTemaTile` ainda explica o comportamento do tema AUTOMATICO, removido no mesmo commit

`app/src/main/assets/web/controle/controle.js:30815` · gravidade **baixa** · NÃO VERIFICADO · lente `css-revogacoes`

**Evidência.** Linhas 30815-30823:
```
// SEMPRE ACESO, pelo motivo do preenchimento: escuro e claro sao as duas
// metades de um par, e nenhuma delas e "o tema desligado". No AUTOMATICO o
// rotulo diz o que o app esta seguindo, e nao so que ele segue — *"Automatico"*
// sozinho nao responde "entao esta claro ou escuro AGORA?", e e essa a pergunta
// de quem olha o tile.
function renderTemaTile() {
  pintarTile(temaTileEl, tema, tema === 'claro' ? 'Claro' : 'Escuro',
    true, tema === 'claro');
}
```
O terceiro estado saiu na v1.8.64 (e9393c1f). No mesmo commit o comentario de `setTema` logo acima foi reescrito ("DOIS ESTADOS desde a v1.8.64 ... O AUTOMATICO saiu a pedido do operador") e o `index.html:1976-1979` ficou com so dois desenhos (`#icoLua`/`#icoSol`), mas este bloco entrou no diff apenas como CONTEXTO — nao foi tocado. `tema` hoje so pode valer 'escuro' ou 'claro' (`storedTema()`, controle.js:99-101), entao o ramo que o comentario descreve nao existe.

**Cenário.** O comentario descreve um terceiro estado que a funcao nao sabe mais produzir. Quem o ler procura no `pintarTile` o caminho do "Automatico" e nao acha — ou, pior, conclui que ele foi perdido por engano e o reintroduz, reabrindo a aritmetica que o CLAUDE.md registra como a causa da remocao (tres estados sobre duas cores fazem um dos toques nao mudar um pixel, e tres estados sobre dois desenhos fazem dois sairem no mesmo PNG). E a "lapide dentro do codigo" que o CLAUDE.md proibe por nome.

**Correção proposta.** Cortar as tres linhas que falam do AUTOMATICO (30816-30819), mantendo so "SEMPRE ACESO, pelo motivo do preenchimento: escuro e claro sao as duas metades de um par, e nenhuma delas e 'o tema desligado'" — que continua descrevendo o quarto argumento `true` do `pintarTile`.

### [5] O cabecalho "OS DEZ `::-webkit-scrollbar` CONTINUAM MORTOS" descreve dez regras que ja nao existem no arquivo

`app/src/main/assets/web/controle/controle.css:5799` · gravidade **baixa** · **VERIFICADO** · lente `css-revogacoes`

> **Conferido nesta sessão:** as 10 regras existiam na v1.5.19 e saíram na v1.8.60/61; hoje `::-webkit-scrollbar` só aparece em três comentários

**Evidência.** Linha 5799: "---------- OS DEZ `::-webkit-scrollbar` CONTINUAM MORTOS ----------".

Nao ha nenhuma regra `::-webkit-scrollbar` em `assets/web`: `grep -rn 'webkit-scrollbar' app/src/main/assets/web/` devolve so tres linhas, TODAS dentro de comentarios (controle.css:5799, 5801 e 6429). No commit base da semana (9d28e8a, v1.5.19) havia 11 ocorrencias, das quais 8 eram regras reais (`.bible-half::-webkit-scrollbar*`, `.draw-hist::-webkit-scrollbar`, `.lyricsview-body::-webkit-scrollbar*`, `.simple-lyrics::-webkit-scrollbar*`). O proprio arquivo registra a remocao 630 linhas abaixo, em controle.css:6429: "(O `::-webkit-scrollbar { display: none }` que acompanhava saiu na v1.8.60, pela prova que matou os outros nove ...)".

**Cenário.** O cabecalho esta no presente e afirma que dez regras mortas seguem NO arquivo. Quem o le e quiser fazer a faxina que ele parece pedir ("limpar as dez") grepa e nao acha nada, e gasta a passada descobrindo que a secao fala de um estado anterior. No sentido inverso, o titulo pode ser lido como "ha dez pseudos declarados aqui" e servir de precedente para escrever mais um — contra a regra que o proprio paragrafo enuncia duas linhas abaixo ("**Nao escrever mais nenhum**"). O corpo do comentario (a medicao dos 10px de calha e a regra) continua valendo e deve ficar; so o titulo envelheceu.

**Correção proposta.** Trocar o titulo por algo no tempo certo — p.ex. "---------- POR QUE NAO HA NENHUM `::-webkit-scrollbar` (v1.8.60) ----------" — mantendo a medicao e o "Nao escrever mais nenhum", que sao a regra permanente.

### [24] O `flush()` do `{"fim":true}` é no-op, e o comentário credita a ele um buffer que não existe

`app/src/main/java/br/org/iasd/av/PacoteCanal.kt:204` · gravidade **baixa** · NÃO VERIFICADO · lente `kotlin-semana`

**Evidência.** PacoteCanal.kt:203-211:
```
if (json.optBoolean("fim", false)) {
    // O `flush` aqui é o que faz o `{"ok":true}` significar alguma
    // coisa: sem ele a resposta diria "gravei" sobre bytes ainda no
    // buffer, e o `pacoteFechar` que vem em seguida é quem descobriria.
    val ok = try { saida?.flush(); true } catch (e: Exception) { … false }
    responder(resposta, JSONObject().put("ok", ok).put("r", escritos))
}
```
O campo `saida` (PacoteCanal.kt:74) só recebe dois tipos de stream em todo o shell: o `contentResolver.openOutputStream(uri, "wt")` de MainActivity.kt:335 — que é sempre um `ParcelFileDescriptor.AutoCloseOutputStream`/`AssetFileDescriptor.AutoCloseOutputStream`, ambos subclasses de `FileOutputStream` — e o `FileOutputStream(alvo)` de MainActivity.kt:1239. Nenhum deles sobrescreve `flush()`, que continua sendo o no-op herdado de `OutputStream`: não há buffer de espaço de usuário, e `flush()` também não sincroniza a page cache (isso seria `fd.sync()`). O mesmo vale para o `s.flush()` de `fechar()` (linha 147) — ali quem de fato reprova o cartão cheio é o `s.close()` da linha seguinte.

Há ainda um segundo ramo: com `saida == null` (destino já fechado), `saida?.flush()` não lança e `ok` sai `true` — a resposta diz "gravei" sem destino nenhum aberto.

**Cenário.** Um agente lê o comentário, conclui que o `{"ok":true}` do canal já prova que os bytes chegaram ao disco, e simplifica o web para dispensar a conferência do `pacoteFechar` (que é quem faz `close()` e depois compara com o `length()` do disco em MainActivity.kt:1187). Perde-se a única detecção de cartão cheio do caminho, e o desfecho é o que o PACOTE.md nomeia como o pior deste recurso: um `.avpkg` truncado anunciado como completo, que importa em silêncio até o registro em que os bytes acabam.

**Correção proposta.** Trocar o comentário pelo que o código faz: o `{"ok":true}` diz apenas que o canal chegou ao fim sem exceção, e quem prova o disco é o `close()` do `pacoteFechar` mais a conferência de `length()`. Manter o `flush()` (é correto para o dia em que o stream for buferizado) mas sem creditá-lo, e trocar `saida?.flush(); true` por um `ok` que seja falso quando `saida == null`.

### [25] CLAUDE.md e PONTE.md dizem que são CINCO os métodos do espelho fora de fila; são nove

`CLAUDE.md:648` · gravidade **baixa** · NÃO VERIFICADO · lente `kotlin-semana`

**Evidência.** CLAUDE.md:648 — "**Os cinco métodos do espelho rodam na MAIN THREAD**, fora de qualquer fila" — e `docs/shell/PONTE.md:208` repete o número. O próprio código diz outro: NativeBridge.kt:1060, no cabeçalho do bloco, "// Os NOVE métodos deste bloco NÃO vão para fila nenhuma, e essa é a decisão…". Contados um a um em `NativeBridge.kt`, nenhum deles usa executor: `espelhoLigar` (1106), `espelhoLigarEm` (1129), `espelhoDesligar` (1146), `espelhoEstado` (1165), `espelhoDiag` (1177), `espelhoDerrubar` (1195), `espelhoCertImportar` (1218), `espelhoCertEstado` (1225), `espelhoCertApagar` (1232) — nove.

**Cenário.** A seção "As QUATRO filas da ponte" é a referência que um lote consulta antes de escolher a fila de um método novo, e ela é lida com a lista do espelho como exceção FECHADA de cinco itens. Ao ver nove métodos sem executor no arquivo, o próximo agente lê os quatro excedentes (os três do certificado e o `espelhoLigarEm`) como esquecimento e os manda para `io` ou `transferencia` — que é exatamente o defeito que a seção existe para impedir: "Ligar a transmissão" enfileirado atrás de um download vence os 60 s do `call()` e resolve `null`, um erro sem causa no meio do culto.

**Correção proposta.** Trocar "cinco" por "nove" em CLAUDE.md:648 e em `docs/shell/PONTE.md:208`, ou nomear os nove — é o NOME que segura uma lista de exceções neste repositório, como já acontece com as quatro exceções da regra de contorno.

### [35] `renderVersionLabel` se descreve como escritor de TRÊS casas de versão; a v1.8.66 removeu uma e o mesmo arquivo já diz que são duas

`app/src/main/assets/web/controle/controle.js:396` · gravidade **baixa** · NÃO VERIFICADO · lente `arqueologia-revogacoes`

**Evidência.** controle.js:396-400: "// ===== UM NÚMERO SÓ, EM TRÊS CASAS (v1.7.0) ===== ... Escrita UMA vez, na carga, e ela é o ESCRITOR ÚNICO das três superfícies que dizem a versão: a badge do Modo Fácil, a badge do avançado e o rodapé de Configurações. Três escritores seriam três chances de o app afirmar duas versões diferentes na mesma sessão."

O corpo da função (controle.js:449) itera sobre DUAS: `for (const el of [simpleVersionEl, appVersionEl])`. E o mesmo arquivo, 50 linhas acima (343-346), já registra a remoção: "// (A TERCEIRA CASA saiu na v1.8.66: a badge do cabeçalho do Cronograma deu / lugar ao botão de LIMPAR. O número continua em DUAS — a do Modo Fácil e o / rodapé de Configurações —, escritas pelo mesmo `renderVersionLabel`.)"

No HTML sobraram dois nós: `index.html:685` (`<span class="ver-badge" id="simpleVersion">`, Modo Fácil) e `index.html:2236` (`<span id="appVersion" class="app-version">`, dentro do `#versaoBtn` do rodapé de Configurações). O CLAUDE.md também já foi corrigido ("escreve as DUAS casas na carga ... a do cabeçalho do Cronograma saiu na v1.8.66").

**Cenário.** Dois comentários do mesmo arquivo, a 50 linhas de distância, dão contagens diferentes para a mesma função. Quem cair no cabeçalho da função primeiro — que é o que se lê ao mexer em `renderVersionLabel` — procura a "badge do avançado" no cabeçalho do Cronograma, não acha nenhuma (lá mora o `#cronoLimpar` desde a v1.8.66) e conclui que falta um escritor, ou reintroduz uma terceira casa que o lote removeu deliberadamente para dar lugar ao botão de limpar a lista.

**Correção proposta.** Trocar o cabeçalho por "UM NÚMERO SÓ, EM DUAS CASAS" e a enumeração por "a badge do Modo Fácil e o rodapé de Configurações", com a nota da terceira casa já existente em 343-346 como única memória da que saiu.

### [36] O oráculo do botão de limpar ainda credita o vão de tinta a um traço de 2,4 que a v1.8.69 revogou

`tools/limpar-cronograma.test.mjs:241` · gravidade **baixa** · NÃO VERIFICADO · lente `arqueologia-revogacoes`

**Evidência.** tools/limpar-cronograma.test.mjs:240-242: "// o desenho da v1.8.67 tinha 0,2 unidade de folga — um décimo da linha. Hoje / // são 0,6 (3,0 geométrico − 2,4 de traço), e o piso de 0,4 fica abaixo disso / // e acima de zero, que é onde os dois lados se encostam."

O traço não é mais 2,4. A v1.8.69 o devolveu a 2 — `index.html:918`: `<svg viewBox="0 0 24 24" width="24" height="24" ... stroke-width="2" ...>` — e o próprio oráculo trava isso vinte linhas abaixo, em 277-281: `checar(r.traco === r.tracoGear, 'A · e o TRAÇO é o mesmo do resto do sprite ...')`.

O vão geométrico sai do símbolo (`index.html:324-329`): a lixeira termina em x=13,8 (`M2.2 7.3h11.6`) e os traços começam em x=16,8 (`M16.8 9.5h5.6`) → 3,0. Com `sw` lido do atributo (linha 147: `parseFloat(document.querySelector('#cronoLimpar svg').getAttribute('stroke-width')) || 2`), o `vao` medido HOJE é 3,0 − 2,0 = 1,0, e não 0,6.

O comentário gêmeo no HTML já foi corrigido no mesmo lote — `index.html:316-317`: "A conta é `vão geométrico − stroke-width`, e ela mora no bloco A do oráculo. Hoje: 3,0 − 2,0 = **1,0**, cinco vezes os 0,2 que o desenho da v1.8.67 tinha".

**Cenário.** A mesma medição está escrita em dois lugares e só um foi atualizado pela revogação. Quem abrir o oráculo para ajustar o piso lê que a margem atual é 0,6 e que 0,4 foi escolhido para ficar logo abaixo dela; o valor real é 1,0, então o piso está a 0,6 de distância e não a 0,2 — quem confiar no número decide sobre uma folga que não existe. Pior, o parênteses "(3,0 geométrico − 2,4 de traço)" reafirma o traço grosso como estado vigente dentro do arquivo que contém a asserção criada para impedir que ele volte: um leitor que só chegue à linha 241 conclui que o símbolo é 2,4 e que engrossá-lo é a prática do repositório.

**Correção proposta.** Atualizar 240-242 para "Em tinta, o desenho da v1.8.67 tinha 0,2 unidade de folga; hoje são 1,0 (3,0 geométrico − 2,0 de traço), e o piso de 0,4 fica abaixo disso e acima de zero", alinhando com o comentário do `index.html:316`.

---

## Achados desta sessão, fora das lentes

Medidos à mão, e **não** contados acima (os três primeiros foram depois
reencontrados de forma independente pelas lentes — ver [5], [33] e [34]).

### Dois imports mortos no Kotlin, e a direção que o oráculo não cobre

- `app/src/main/java/br/org/iasd/av/EspelhoServidor.kt:29` — `java.util.concurrent.atomic.AtomicLong`, órfão desde a **v5.187** (a saída do espelho de pixels).
- `app/src/main/java/br/org/iasd/av/ShellUpdater.kt:5` — `android.net.Uri`; o único uso é `FileProvider.getUriForFile` na linha 267, cujo tipo é inferido.

O `kotlin-simbolo-importado.test.mjs` responde *"todo símbolo usado tem de onde
vir?"* — **uma direção só**. A pergunta inversa (*"todo import tem uso?"*) não é
feita por ninguém, e é exatamente onde os dois moram. Os dois arquivos já são
varridos por aquele oráculo; a segunda asserção cabe nele, e o custo é uma
comparação a mais sobre a varredura que ele já faz.

### `bibleTitle` é um `id` sem dono

`app/src/main/assets/web/controle/index.html:1061` —
`<span class="tools-title" id="bibleTitle">Bíblia</span>`. Medido: dos 213 `id`
do documento, é o **único** que nenhum `.js`, `.css` ou `aria-labelledby`
menciona. Os outros 29 candidatos da varredura eram `<symbol>` de SVG, todos com
`<use href="#…">` no próprio HTML.

## O que esta auditoria NÃO responde

1. **Os arquivos puros do Kotlin** — sem Android SDK, o JUnit não rodou.
2. **As sete lentes que não completaram** (tabela de cobertura, acima). A mais
   cara delas é a de **oráculos/tautologia**: a suíte dobrou de tamanho nesta
   semana, e o `CLAUDE.md` é explícito em que *"uma asserção que não pode
   reprovar o defeito que ela nomeia é pior que asserção nenhuma"*.
3. **A refutação adversarial dos 31 achados NÃO VERIFICADOS.** Eles vêm de uma
   leitura só. O modo de falhar conhecido deste projeto é o falso positivo que
   manda alguém remover uma redundância **deliberada** — e este repositório tem
   várias, escritas e justificadas.
