# Auditoria de estabilidade de ÁUDIO e VÍDEO (2026-08-29)

> **ESTADO: nove dos dez achados foram CORRIGIDOS na v1.4.19**, no mesmo dia.
> O décimo (**D1**) é MEDIÇÃO e não conserto — ele continua aberto de propósito,
> e a receita está no lugar dele, mais abaixo. O que cada correção fez, e o
> oráculo de cada uma, está em [`HISTORICO.md`](HISTORICO.md); este arquivo
> continua sendo o LAUDO — o cenário, o raciocínio e a ressalva —, que é o que
> não cabe numa nota de versão.
>
> A tabela abaixo guarda o estado de cada um.

**A pergunta:** *o que pode INTERROMPER a transmissão, ou a mídia que está no ar
agora?* Não "o que está feio" nem "o que é lento" — o que **para**.

Varredura do caminho inteiro da mídia: `shared/mse.js`, `shared/stage.js`,
`display/display.js`, o transporte de `controle/controle.js`, e do lado do shell
`StreamProxy.kt`, `YoutubeGrab.manifesto`, `MainActivity`, `SessionService`,
`EspelhoServidor`. Ele nasceu como LAUDO — e as correções vieram no lote
seguinte, no mesmo dia; ver o estado de cada achado logo abaixo.

## O placar

| # | achado | severidade | estado | oráculo |
|---|---|---|---|---|
| A1 | **um fragmento sem prazo de parede congela a transmissão PARA SEMPRE** | **alta** | **corrigido v1.4.19** | `degrau-e-prazo` · `fome-que-desiste` |
| A2 | o degrau escolhido nunca é perguntado ao decodificador | média | **corrigido v1.4.19** | `degrau-e-prazo` |
| A3 | a segunda expiração do MESMO vídeo não re-extrai | **alta** | **corrigido v1.4.19** | — (ver a ressalva) |
| A4 | stream de SÓ ÁUDIO entra sem aviso e sem rampa | baixa | **corrigido v1.4.19** | `stream-so-audio` |
| A5 | o stream velho morre depois de a fonte ser puxada | mínima | **corrigido v1.4.19** | — |
| B1 | `configChanges` incompleto — a projeção cai por preferência do sistema | **alta** | **corrigido v1.4.19** | — (manifest) |
| B2 | o FGS de mídia cai numa recriação de Activity | média | **corrigido v1.4.19** | — (Kotlin) |
| C1 | toda abertura dispara 12 requisições concorrentes, sem olhar a cena | **alta** | **corrigido v1.4.19** | `rotina-cede-a-vez` |
| C2 | o empurrão para as telas da rede compete com o renderer | baixa | **medir antes de mexer** | — |
| D1 | `shouldInterceptRequest` serializa as duas faixas? | **alta, se** | **A MEDIR** | — |
| D2 | o som segue a PRESENÇA de uma tela, não a capacidade dela de soar | média | **corrigido em parte** | — (ver a ressalva) |

**AS TRÊS CORREÇÕES SEM ORÁCULO ESTÃO DITAS, e o motivo de cada uma:** A3 e D2
vivem no `controle.js` e exigiriam semear um acervo e um estado de espelho
inteiros para alcançar uma linha; B1 é uma linha do manifest, que nenhum
oráculo deste projeto lê; B2 é Kotlin de ciclo de vida, que só um aparelho
exercita. Onde não há oráculo, o que sobra é a REVERSÃO na revisão e esta nota —
não a impressão de que há rede de segurança.

---

## A. A transmissão direta (YouTube) — o caminho mais frágil

É o único tipo de mídia que precisa de JavaScript rodando enquanto toca. Tudo
que trava o JS, a rede ou o buffer aparece AQUI primeiro, e só aqui.

### A1. UM FRAGMENTO SEM PRAZO DE PAREDE CONGELA A TRANSMISSÃO PARA SEMPRE

**O cenário.** O CDN aceita a conexão e passa a gotejar — um punhado de bytes de
vez em quando, que é o desfecho típico de um Wi-Fi saturado ou de um aparelho em
economia de energia. Não é uma queda: é uma entrega que não termina.

**Por que nada reage.** Não existe prazo TOTAL em ponto nenhum da cadeia:

| camada | o que ela tem | por que não cobre |
|---|---|---|
| `mse.js` `pegarUmaVez` (:398) | `AbortController`, mas abortado **só** por `morrer`/`destruir` | o `fetch` não tem `timeout` nenhum |
| `mse.js` `pegar` (:363) | 4 tentativas com espera crescente | só reage a um erro que **acontece** — e aqui nada acontece |
| `StreamProxy.conectar` (:296-297) | `connectTimeout` 15 s, `readTimeout` 30 s | `readTimeout` é **POR LEITURA**: um byte a cada 29 s nunca o dispara |
| `stage.js` `armarEsperaBuffer` | acende o aviso e conta `AVStream.fome` | **conta e não age** — não existe ação ligada à fome |
| `mse.js` `aplicar`/`esperarSbLivre` | prazos de 15 s / 5 s | cobrem o `SourceBuffer`, não a rede |

**O desfecho.** O buffer drena, o quadro congela, o cartão "Preparando…" acende
e fica, `AVStream.fome.segundos` cresce sem teto — e **nada** devolve a cena. Não
há erro, não há queda para o download, não há aviso. Só passa se o operador tocar
em alguma coisa.

É o modo de falhar que melhor casa com os dois relatos de campo — *"o áudio
falha"* e *"veio som, porém ficou travando"* —, porque ele produz exatamente a
imagem de um app quebrado sem produzir um único erro.

**Correção proposta (duas metades, e as duas são web — sem Release):**

1. **Prazo de parede por fragmento**, em `pegar()`: um `setTimeout` que aborta o
   controller daquela tentativa. O erro já nasce marcado `retentavel` (é a
   `marcar()` que existe), então a escada de 4 tentativas assume sozinha e o
   comportamento em rede boa não muda em nada. O prazo tem de ser função do
   TAMANHO pedido, não fixo: um init de 800 B e um fragmento de 4 MB não têm o
   mesmo pior caso honesto.
2. **Watchdog de fome**, no `stage`: `esperaBuffer` ligado por mais de N s (20 s
   é a ordem certa — `ALVO_S` é 20) vira `onStreamErro`, que é o caminho que já
   existe e já sabe cair no download. Hoje `AVStream.fome` é o único lugar do app
   que SABE que a projeção está parada, e ele só escreve no Registro.

**Ressalva do cético:** o prazo de parede pode matar um fragmento que ia chegar,
numa rede muito ruim, e a retentativa recomeça o mesmo pedaço do zero. É por isso
que ele tem de ser generoso e proporcional ao tamanho — e, ainda assim, quatro
tentativas de um pedaço são estritamente melhores que uma espera infinita.

### A2. O DEGRAU ESCOLHIDO NUNCA É PERGUNTADO AO DECODIFICADOR

`AVStream.suportado(man)` (`mse.js:101`) valida `man.video` (o **topo** da
escada) e `man.audio`. `escolherDegrau` (`mse.js:233`) escolhe entre os degraus
**só por banda** — nenhum deles passa por `MediaSource.isTypeSupported`.

Do lado do shell a escada é filtrada por `!it.webm` e `ext == "mp4"`
(`YoutubeGrab.manifesto`), e **mp4 hoje carrega AV1**. Um aparelho cujo WebView
decodifica avc1 e não av01 pode ter uma escada em que o topo passa e um degrau
de baixo não.

**O que acontece então:** `changeType` para um mime não suportado **lança** e é
engolido (`mse.js:671`, *"segue com o antigo"*), o init novo é appendado num
`SourceBuffer` descrito por outro codec, o append falha, e o `catch` da troca
chama `reporInit` — a propriedade *"qualquer falha na troca mantém o degrau
atual"* segura o estrago. **Não é uma queda; é um desperdício caro no pior
momento:** duas idas à rede, até 5 s de `esperarSbLivre`, e o `degrauFeito`
queimado para sempre — tudo ANTES do primeiro quadro, numa rede que a própria
medida acabou de classificar como insuficiente.

**Correção proposta:** filtrar a escada antes de escolher —
`escada.filter((v) => !v.mime || MediaSource.isTypeSupported(v.mime))`. Uma
linha, no lado web, sem degrau de ponte. Ela também torna a decisão HONESTA: hoje
`AVStream.degrau` pode anunciar no Registro um degrau que nunca chegou a valer.

### A3. A SEGUNDA EXPIRAÇÃO DO MESMO VÍDEO NÃO RE-EXTRAI

```js
const streamRetentado = new Set();   // controle.js:15563
...
if (expirou && !streamRetentado.has(rec.id)) {
  streamRetentado.add(rec.id);       // e NUNCA sai
```

O conjunto **nunca é limpo**. A intenção escrita é *"uma tentativa só"* por
episódio de falha; o que o código faz é *"uma tentativa por item, para o resto da
sessão"* — e a sessão é o PROCESSO, que neste app quase nunca morre (os serviços
em primeiro plano o mantêm vivo).

**O cenário que morde.** Ensaio de manhã: o vídeo do sábado é transmitido, a URL
expira no meio, `recuperarStream` re-extrai e conserta — invisível, como deve
ser. Culto: o MESMO vídeo, o mesmo `rec.id`, a URL guardada expirou de novo. O
`Set` já tem o id: **não há re-extração**. A cena sai do telão (`stopClear()`) e o
app começa a baixar centenas de MB na frente da congregação, por um conserto de
dois segundos que ele sabe fazer e se proibiu de tentar.

**Correção proposta:** `streamRetentado.delete(rec.id)` depois do
`setMediaStream` bem-sucedido; ou trocar o `Set` por um `Map<id, carimbo>` e
reabrir a tentativa passados alguns minutos. As duas devolvem a semântica que o
comentário promete e nenhuma reabre o laço que ele existe para fechar (uma
segunda falha SEGUIDA continua caindo no download).

### A4. STREAM DE SÓ ÁUDIO ENTRA SEM AVISO E SEM RAMPA

`semVisual()` (`stage.js:364`) é verdadeiro para `kind: 'audio'` sem letra — que
é exatamente o que "Tocar agora · Só áudio" de um link do YouTube produz. Com ele
verdadeiro, o `loadInner` **não entra em nenhum dos dois ramos** que:

- acendem `mostrarEspera(true)` (linhas 1004 e 1040), e
- disparam a `rampVolume` do stream (linha 1024).

E a rampa comum (linha 969) exclui streams pelo `!ehStream`, de propósito, porque
ela foi movida para dentro daqueles ramos.

**Desfecho:** o operador toca, a tela não diz mais nada por vários segundos (a
rede inteira entre o comando e o primeiro byte), e então o som **entra no talo** —
os dois defeitos que os lotes v1.4.6 e v1.4.8 corrigiram para o vídeo, ainda de
pé para o áudio.

**Correção proposta:** tirar o anúncio e a rampa da árvore de ramos visuais. A
pergunta que os governa é *"isto é um stream que ainda não começou?"*, e ela não
tem nada a ver com haver ou não imagem.

### A5. (menor) O stream velho morre DEPOIS de a fonte ser puxada

No `loadInner`, o ramo `willFade` faz `video.removeAttribute('src')` +
`video.load()`, e só **depois do `await AVDB.getMedia(id)`** vem o `_revokeUrl()`
que destrói o `AVStream` anterior. Nesse vão o motor velho ainda escuta o
`<video>` e ainda pode chamar `morrer(mensagem)`, que escreve em
`AVStream.ultimoErro` **sem passar pela guarda de `loadSeq`** — o Registro pode
acabar com o erro fantasma de uma cena que o operador trocou de propósito.
Correção: destruir o stream antes de puxar a fonte.

---

## B. O shell derruba a projeção sozinho

### B1. `configChanges` INCOMPLETO — a projeção cai por uma preferência do sistema

```xml
android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden|uiMode|density"
```

Tudo que **não** está nessa lista **RECRIA a Activity**, e o `onDestroy` derruba,
nesta ordem: o `SessionService`, a `Presentation` (`dismiss()`) e os dois
WebViews (`destroy()`). Projeção e áudio caem e voltam segundos depois — pelo
caminho de reconexão, que funciona, mas na frente da congregação.

**O código já sabe disso.** O comentário do `onDestroy` (`MainActivity.kt:675`)
diz literalmente que `configChanges` não cobre `fontScale` nem `locale` e que
mudar o tamanho da fonte recria a Activity — e por isso o **espelho** ganhou a
guarda `!isChangingConfigurations`. **Só o espelho.** O telão e a sessão de mídia
não têm equivalente, e para eles a guarda nem seria a resposta certa: a resposta
é não ser recriado.

**O que falta na lista**, e o que dispara cada um:

| chave | quando muda |
|---|---|
| `keyboard`, `navigation` | **um teclado/controle Bluetooth conecta ou dorme** — o page-turner de quem opera é exatamente isso |
| `fontScale`, `fontWeightAdjustment` | tamanho de fonte / "texto em negrito" do sistema |
| `locale`, `layoutDirection` | idioma |
| `colorMode` | faixa dinâmica / gamut — muda com dongle e com vídeo HDR |
| `touchscreen`, `mcc`, `mnc`, `grammaticalGender` | raros, mas de graça |

**Correção proposta:** acrescentar todas. Num app que é uma casca de WebView, não
reagir a nenhuma delas é o comportamento **desejado** — o WebView refaz o layout
sozinho, e o que se ganha é a projeção não morrer. Custa uma linha do manifest e
uma Release.

**Ressalva do cético:** `fontScale` na lista significa que o texto do app deixa
de acompanhar a preferência de acessibilidade do sistema sem uma recarga. Para um
app cuja tela principal é uma mesa de comando e cuja saída é um telão, é o troco
certo — mas é um troco, e está dito.

### B2. O FGS DE MÍDIA CAI NUMA RECRIAÇÃO DE ACTIVITY

`MainActivity.kt:668` chama `SessionService.stop(this)` **incondicionalmente**,
inclusive quando `isChangingConfigurations` é verdadeiro. O serviço morre, o
`onCreate` seguinte precisa reerguê-lo — e `SessionService.iniciar()` engole
`ForegroundServiceStartNotAllowedException` com um `Log.w`.

O comentário daquele `catch` diz *"sem notificação, e nada mais: a projeção em si
não depende deste serviço"*. **Isso é verdade para a notificação e falso para o
processo.** O FGS é o que impede o Android de congelar (Android 12+) ou matar o
processo — que é o dos dois WebViews e da `Presentation`. Sem ele, o app
minimizado durante o culto volta a ser descartável, que é o defeito que o
`SessionService` foi criado para resolver.

**Correção proposta:** a mesma guarda do espelho (`if
(!isChangingConfigurations)`) sobre o `SessionService.stop`; e, no `stop()`, uma
CARÊNCIA curta antes de derrubar o serviço quando a cena acaba, para que a cena
seguinte encontre o serviço vivo em vez de precisar reerguê-lo do segundo plano
— o único caso em que a exceção acima dispara.

---

## C. O que compete com o fluxo

### C1. TODA ABERTURA DISPARA 12 REQUISIÇÕES CONCORRENTES, SEM OLHAR A CENA

```js
syncLyrics().catch(() => {});          // controle.js:13653  — 6 workers
syncCifrasAcervo().catch(() => {});    // controle.js:13663  — 6 workers
```

As duas saem **sem `await`**, portanto correm juntas: `NET_CONCURRENCY` é 6
(`controle.js:642`), então são **até 12 requisições concorrentes** a dois hosts
de terceiros, sobre o acervo inteiro — MEDIDO no próprio `CLAUDE.md`: 309 + 145
hinos numa passada.

**O único freio é `networkType() === 'cellular'`.** Nada consulta a cena, o
transporte, nem `midiaNoAr()`.

**Por que isso é estabilidade e não desempenho.** O uso normal é abrir o app
minutos antes do culto e tocar o primeiro item. Nesse instante:

- os fragmentos do MSE disputam o Wi-Fi da igreja com 12 requisições de
  manutenção;
- e a **medida de banda que escolhe o degrau do louvor inteiro** é feita
  justamente durante essa disputa (`talvezTrocarDegrau` roda antes do primeiro
  quadro, uma vez, para sempre).

Ou seja: a rotina de varredura do acervo pode **rebaixar a resolução do louvor**
— e, numa rede apertada, empurrar o fragmento seguinte para a fome do A1.

**Correção proposta:** as duas rotinas já sabem se distinguir de trabalho pedido
(`withBgRotina` × `withBgWork`, `bgWorkPedido()`), mas essa distinção só é usada
para decidir a pergunta do OTA. Usar a mesma régua para a REDE: enquanto houver
cena no ar, as rotinas de acervo esperam — ou descem para 1 worker. A varredura
é por definição adiável; o louvor não.

### C2. O EMPURRÃO PARA AS TELAS DA REDE COMPETE COM O RENDERER

`telaEmpurrarAgora` (`controle.js:25443`) fatia o arquivo em blocos de 512 KiB e
espera o ack de cada um — ~600 voltas para um vídeo de 300 MB, no thread do
Controle, disparado por **cada `load`** enquanto houver telas pareadas. Os dois
WebViews dividem um processo; a pressão de alocação aparece do outro lado.

Não é um defeito (o ack já serializa e há retomada), mas é a fonte estrutural da
classe *"interagir com o app perturba o que está no ar"* — a mesma classe do
corte de áudio entre abas que já está sendo corrigido. **Vale medir antes de
mexer.**

---

## D. Riscos que precisam de MEDIÇÃO antes de virar conserto

### D1. `shouldInterceptRequest` SERIALIZA AS DUAS FAIXAS?

**A hipótese.** O Chromium do WebView entrega `shouldInterceptRequest` numa fila
**sequenciada**. Se for o caso, então:

- o fragmento de VÍDEO e o de ÁUDIO, que o `bombear()` dispara em paralelo, são
  atendidos **um de cada vez**;
- e o `assetLoader` (todo `/web/`, todo `/saf/`) entra na MESMA fila.

**Por que isso explicaria "o áudio falha e o vídeo continua":** o vídeo mantém
até `ALVO_S` (20 s) de folga e é servido primeiro; o áudio espera atrás dele, e
`StreamProxy.responder` só devolve o `InputStream` **depois de ler o fragmento
INTEIRO** (`readBytes`, teto de 24 MiB). Um fragmento de vídeo lento segura o de
áudio pelo tempo inteiro dele.

**Como medir — 10 minutos, sem mudar comportamento:** um `Log.i` na entrada e na
saída de `StreamProxy.tryHandle` com `Thread.currentThread().name` e o carimbo de
tempo. Nomes de thread distintos e janelas SOBREPOSTAS ⇒ é paralelo, hipótese
morta. Mesmo nome e janelas encaixadas ⇒ está confirmada, e ela passa a ser o
achado mais importante desta lista.

**Se confirmar**, as saídas em ordem de custo: (a) reduzir o pedaço pedido pelo
`mse.js` (fatiar o fragmento em pedidos menores dá pontos de intercalação);
(b) servir a transmissão pelo `ServerSocket` que o telão por comandos já tem
(`/s/<token>` já existe e é thread por conexão — nenhuma fila do WebView no
caminho).

**Ressalva do cético:** não conferi o código do Chromium desta versão de WebView,
e o comportamento mudou entre versões. Por isso é medição, não achado.

### D2. O SOM SEGUE A PRESENÇA DE UMA TELA, NÃO A CAPACIDADE DELA DE SOAR

`somLocalDeveEstar()` (`controle.js:1820`) emudece este aparelho quando
`algumaTelaConectada()` — que é `simpleDisplay()`, que devolve a primeira de
`telasDaRede()`: **toda sessão SSE viva**, sem perguntar se aquela tela tem som.

O telão de verdade já ganhou essa distinção (o campo `telao`: *"há TELA" nunca foi
"há TELÃO"*, com oráculo próprio em `telao-no-chao.test.mjs`). As telas da rede
não têm equivalente.

**A janela real.** O navegador da tela dorme ou é fechado sem FIN: a sessão só
morre em `PRAZO_SEM_CONEXAO_MS` (45 s) ou `PRAZO_OCIOSA_MS` (4 min). Nesse
intervalo, **sem TV**, o celular está mudo por uma tela que não está reproduzindo
nada — silêncio nos dois lados, que é exatamente o defeito que o campo `telao`
existe para não ter.

**O que hoje limita o estrago:** parear É o gesto que libera o som (o toque em
"Ativar esta tela" chama `__telaSom(true)` antes do `POST /par`), então uma tela
pareada normalmente TEM som. O buraco é a tela que parou de existir e ainda não
venceu.

**Correção proposta:** o `tela-status` já sobe; basta ele carregar se aquela tela
tem som liberado, e `telasDaRede()` filtrar por isso — a mesma forma do `telao`,
um nível abaixo. Sem degrau de ponte: é campo de comando, não de `AVNative`.

---

## O que a varredura NÃO encontrou (e por que vale dizer)

Estes caminhos foram lidos linha a linha procurando interrupção, e estão cobertos:

- **Reconexão do telão e morte do renderer.** `onRenderProcessGone` devolve
  `true`, cada dono remonta, `display-ready` é ENDEREÇADO, e o reenvio leva
  posição e estado de reprodução. O `RENDERER_PRIORITY_IMPORTANT` com
  `waivedWhenNotVisible = false` no telão é a peça que faz isso valer sob pressão
  de memória.
- **Roubo de foco de áudio.** A escada de retomada (`display.js`) tem guardas,
  crédito, teto e censo, e a guarda do fim natural existe **duas vezes** de
  propósito. O caso aberto (chamada telefônica) já está em
  `ACHADOS-EM-ABERTO.md` §2.
- **O compasso do MSE em segundo plano.** `EVENTOS_DO_COMPASSO` resolve o
  estrangulamento do `setInterval`; o intervalo ficou como piso. Correto.
- **Concorrência de `load`.** `loadSeq` + `loadsEmVoo` cobrem a corrida entre o
  fim natural e um load do operador, nos dois lados do barramento.
- **Fila SSE das telas.** `offer` não-bloqueante, fila cheia derruba a tela (que
  reconecta e recebe a cena inteira) — nunca descarte silencioso de comando.
- **Térmica.** `aoEsquentar` só registra. Sem atuador não há como ele derrubar
  nada.
- **OTA.** A aplicação automática saiu na v5.234; hoje quem escolhe quando o
  telão pisca é o operador.

---

## A ordem que foi seguida (v1.4.19)

Nove dos dez entraram num lote só, nesta ordem — a mesma proposta abaixo, com
B1+B2 subindo porque o lote já ia exigir Release por causa do A1 do Kotlin:

1. **A3** — `streamRetentado` virou um `Map` com janela de 5 min. A janela é o
   que mantém as duas propriedades: uma falha SEGUIDA continua caindo no
   download (ela chega em segundos), e um episódio NOVO horas depois volta a ter
   direito à sua tentativa.
2. **A1**, em três metades: o prazo de parede por fragmento no `mse.js`
   (proporcional ao que foi pedido, alimentando a escada de 4 tentativas que já
   existia), o prazo TOTAL no `StreamProxy.readBytes` (que é onde o
   `readTimeout` por leitura falhava), e o **watchdog de fome** no `stage.js` —
   a última linha, que transforma 25 s de quadro congelado no `onStreamErro` de
   sempre.
3. **C1** — as duas rotinas de acervo consultam `midiaNoAr` na porta **e dentro
   do laço**. Cedem a vez e SAEM, em vez de esperar: esperar seguraria o serviço
   em primeiro plano (cota de 6 h/24 h) parado por um culto inteiro. É seguro
   porque as duas são retomáveis e `autoRefreshCollections` roda em todo
   `visibilitychange`.
4. **B1 + B2** — as sete chaves que faltavam no `configChanges`, e a guarda
   `!isChangingConfigurations` sobre o `SessionService.stop`.
5. **A2, A4, A5, D2** — no mesmo lote, porque nenhum deles custava Release
   própria.

**D2 saiu diferente do que este laudo propunha**, e vale dito: a proposta era o
`tela-status` carregar se aquela tela tem som. Escrevendo a correção ficou claro
que isso seria um no-op — **parear É o gesto que libera o som** (o toque em
"Ativar esta tela" chama `__telaSom(true)` antes do `POST /par`), então uma tela
pareada praticamente sempre tem som. O que de fato faltava era o irmão do campo
`telao`: `telasDaRede()` passou a exigir `pronta` (o `__de` do `display-ready`
tendo voltado), que é a diferença entre "pareou" e "o `/display/` dela subiu".
**A janela do socket morto continua aberta** — uma tela cujo navegador dormiu
sem FIN segura o mudo do celular até a escrita falhar (o vigia corta em 20 s), e
fechar isso é mexer na detecção de liveness do servidor, que é outro lote.

## A ordem que eu proporia (registro do laudo original)

1. **A3** (uma linha, web, sem Release) — é o achado com o pior desfecho por
   linha de código: download de centenas de MB no meio do culto.
2. **A1** (web) — é o único da lista que produz uma projeção **congelada sem
   nada acontecer**, que é a falha mais cara que este projeto sabe ter.
3. **C1** (web) — barato, e ataca a causa comum de A1 e de degrau baixo.
4. **D1** (medição) — se confirmar, reordena tudo acima dela.
5. **B1 + B2** (manifest + Kotlin, um lote com Release) — juntos, porque os dois
   são a mesma recriação de Activity.
6. **A2, A4, D2, A5** — no lote de web seguinte.
