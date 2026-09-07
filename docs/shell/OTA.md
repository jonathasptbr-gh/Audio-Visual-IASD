# O OTA — a base web e o APK chegando ao aparelho

> Capítulo do **shell nativo**. Mapa em [`README.md`](README.md); as regras do
> app inteiro, em [`../../CLAUDE.md`](../../CLAUDE.md).

Arquivos: `WebUpdater.kt` (1.059 linhas) · `ShellUpdater.kt` (340) ·
`WebPathHandler.kt` (88) · o bloco de OTA em `shared/native.js` e em
`controle/controle.js` · `.github/workflows/apk.yml`.
Oráculo: **`tools/ota.test.mjs`** (Chromium + ponte de mentira).

---

## Por que este capítulo existe

**É o único caminho do app cujo defeito NÃO TEM SINTOMA.** Nada quebra, nada
aparece no Registro, ninguém liga reclamando: o operador simplesmente continua
na versão de anteontem. Todo mecanismo aqui existe para tornar uma falha
*visível*, e cada guarda abaixo nasceu de uma versão em que ela não era.

---

## Os dois canais são UM evento

```
 push em main            Release v2.0 publicada         aparelho
 ┌─────────────┐ shellTag ┌──────────────────┐         ┌──────────────────┐
 │ version.json│ ───────► │ audio-visual….apk│ ──────► │ ronda de 15 s    │
 │ "shellTag": │  SEGURA  └──────────────────┘ gatilho │ lê o MANIFESTO   │
 │   "v2.0"    │  o OTA     push da tag v*            │ web + shell      │
 └─────────────┘                                       │ → UMA pergunta   │
                                                       └──────────────────┘
```

- **`shellTag` no `version.json` é o acoplamento.** Declarado, o job `web-ota`
  **segura a publicação do bundle** até a Release existir. Sem `shellTag`, o
  manifesto anuncia a Release mais recente que existir. A pergunta que ele
  responde é: *"este lote PRECISA de uma Release?"*
- **Quem SOLTA o HOLD é o push da tag, não o gatilho `release`.** O `web-ota`
  roda também em `refs/tags/v*`, atrás do job `apk` (`needs:`) — ou seja,
  consulta uma Release que já existe, no MESMO run. O `on: release: [published]`
  fica no workflow, mas não é o mecanismo: a Release nasce do `GITHUB_TOKEN`
  padrão e evento originado nesse token **não cria execução de workflow**. Ele
  só dispara quando a Release vem de outra mão (a interface do GitHub, ou um
  PAT). O mesmo `needs: apk` fecha a corrida do disparo MANUAL, em que os dois
  jobs corriam em paralelo e o manifesto podia sair antes da Release.
- **É o manifesto que permite a detecção ser rápida.** A API do GitHub não
  autenticada dá **60 req/hora por IP**; a ronda de 15 s são 240. Perguntar o
  APK à API esgotaria o limite em quinze minutos e passaria a falhar com 403
  pelo resto da hora. **O manifesto é asset de release e não consome limite
  nenhum:** uma requisição responde as duas perguntas, no MESMO instante.
- **O zip tem nome versionado.** Com `web-assets.zip` substituído no lugar, duas
  execuções intercaladas deixavam o zip de uma com o `sha256` da outra — e a
  partir dali todo aparelho baixa, reprova o hash e o **OTA fica INERTE até o
  próximo push**, sem sinal. O único arquivo substituído no lugar passa a ser o
  manifesto, escrito por último. O job recolhe os antigos deixando os **três
  mais novos** (apagar o que alguém está baixando devolveria 404 no meio do
  download).
- **O manifesto nunca REGRIDE.** O `web-ota` compara com o `version.json` que já
  está no ar (mesma regra numérica por componente do `compareVersions`) e um run
  que traria versão MENOR **pula a publicação**, com `::warning::` e uma linha no
  resumo. Sem a guarda, o run de uma tag — que empacota o commit DA TAG — podia
  rebaixar o que o push de `main` já publicou, e o aparelho descartaria em
  silêncio: nenhum vermelho, e o lote novo inalcançável até o próximo push.
- **`sha256` reprovado é FALHA, não desfecho.** Devolver `null` carimbava a
  tentativa como bem-sucedida (`ultimoOk` renovado, `falhasSeguidas` zerado, sem
  espera crescente), e a ronda seguinte rebaixava o mesmo zip, para sempre.

---

## A detecção: quatro gatilhos

1. **abertura**;
2. **ronda de 15 s** na frente (**120 s** em segundo plano), enquanto o processo
   viver;
3. **`onResume`** — com `forcar`;
4. **a rede voltando** (`registerDefaultNetworkCallback`, com
   `onCapabilitiesChanged`/`NET_CAPABILITY_VALIDATED` — o Wi-Fi da igreja
   associa **antes** de ter saída, e `onAvailable` sozinho dispara cedo demais).

- **Falha retenta sozinha**, 5 s → 10 → 20 → 30 s. O teto era 90 s e era o pior
  lugar para ser generoso: acima de meio minuto a espera dura MAIS que a ronda, e
  uma falha transitória sai punindo a detecção.
- **A ronda é blindada contra exceção.** `scheduleWithFixedDelay` **CANCELA
  todas as execuções seguintes** quando o `Runnable` lança — sem log e sem
  `Future` que alguém consulte. Errar aqui é a detecção parar para sempre
  naquele aparelho.
- **Nada de cópia guardada.** O asset de `web-latest` é substituído no lugar
  (mesma URL, conteúdo novo), que é exatamente quando um cache devolve o de
  ontem com toda a razão — e isso não atrasa a atualização, torna-a INVISÍVEL.
  Daí `no-cache` **e** `?t=` na URL.
- **A comparação é contra o que o aparelho JÁ TEM** (`versaoJaTemos`), não contra
  o que ele SERVE: um bundle baixado espera o próximo lançamento e
  `currentVersion` continua sendo o da sessão — comparar por ele rebaixaria o
  mesmo zip a cada ronda, apagando com `deleteRecursively` um diretório que o
  operador pode ter acabado de mandar aplicar ao vivo.
- **`compareVersions` é NUMÉRICA por componente**, não lexical: `4.9` < `4.82`
  como string.
- **O piso é POR CHAMADOR, e são dois.** `MIN_ENTRE_CHECKS_MS` (5 s) segura as
  rajadas de evento (retomada, rede) e precisa ficar ABAIXO da ronda, senão uma
  batida que chegue um milissegundo cedo é descartada e a seguinte só vem 15 s
  depois. Só que a enquete do lado web bate a cada **10 s** (`OTA_POLL_MS`) e
  passava livre por ele: a rotina anunciada como "lê o disco" virava uma
  consulta à rede a cada dez segundos, para sempre. Subir aquele piso não
  resolve — acima de 10 s a enquete passa a ROUBAR o passo da ronda. Daí
  `MIN_CUTUCAO_TELA_MS` = `RONDA_MS`, no `WebUpdater.cutucaoDaTela`: o cutucão
  só vira requisição quando a ronda não entregou uma passada inteira, que é o
  papel dele — rede de segurança, não segunda ronda.
- **O `forcar` do `onResume` fica.** É deliberado e está declarado no
  `CLAUDE.md`: a retomada é o instante em que a resposta pode virar uma pergunta
  na tela. Ele é o segundo chamador que pula o piso, ao lado do `#otaRow`.

---

## As três garantias (isto roda em culto)

### 1. ~~Nunca troca a base no meio de uma sessão~~ — REVOGADA

Revogada na v1.68/v5.151, substituída pela **pergunta** na v5.234. Ela prometia
"entra no próximo lançamento", e `beginSession()` decide uma vez por
**PROCESSO** — que quase nunca morre. O que sobrevive dela:

- **A faxina roda só em `beginSession()`** (`sessionStarted`), e preserva o alvo
  novo **e o `sessionRoot` em uso**: ela APAGA diretório, e o `cleanup` rodando
  numa recriação de Activity apagaria o que os dois WebViews estão servindo.
- **Nada é apagado ao aplicar**: o diretório antigo pode ter requisições em voo
  durante a recarga; quem recolhe é o `beginSession()` seguinte.
- **`beginSession` tem saída ÚNICA** (`fixarBase`): eram quatro `return`
  espalhados, e um quinto acrescentado sem a anotação passaria despercebido.

### 2. A válvula `minShell`

Bundle que exija ponte mais nova que `NativeBridge.SHELL_VERSION` é recusado; o
app segue no que tinha. **É por isso que `SHELL_VERSION` sobe a cada mudança de
superfície da ponte** — sem isso a válvula não protege nada.

**O bundle declara `minShell` IGUAL ao `SHELL_VERSION`** desde a v1.0: o shell
atual é o piso, e não há guarda de versão no lado web. Com isso a válvula deixa
de ser a rede de um caso raro e passa a ser o único ponto em que a incompatibi-
lidade é notada.

> **O modo de falhar que isso cria, e ele é mudo:** `minShell` acima do
> `SHELL_VERSION` do APK instalado faz o aparelho recusar **TODO** bundle, para
> sempre. Nada quebra, nada aparece na tela — a única pista é o `ultimoResultado`
> que o `otaDiag` imprime na linha "Procura:" do Registro. Por isso o CI confere
> o teto lendo o `SHELL_VERSION` do próprio Kotlin, e por isso um lote que sobe
> o degrau **exige** `shellTag` e Release.

### 3. O watchdog de boot

Servir um bundle arma um `pending`; o web o desarma (`otaConfirm`). Bundle que
não confirme é descartado no lançamento seguinte e o app volta ao embutido.

- **O `pending` guarda o NOME do subdiretório**, não um booleano — com booleano a
  confirmação de um bundle perdoava outro.
- **A chave é nova de propósito:** ler um `Boolean` como `String` em
  `SharedPreferences` lança `ClassCastException` dentro do `onCreate`, e o app
  não abriria depois de atualizar o APK.
- **O watchdog NÃO evita o primeiro estrago:** `beginSession()` arma o `pending`
  e **SERVE** o bundle; só o lançamento seguinte descarta. Um lançamento
  quebrado por aparelho, garantido.

#### O sinal de boot (`otaAppIsUp`)

Ordem dos scripts do Controle: `native.js` → `db.js` → `mse.js` → `stage.js` →
`louvorja.js` → `bible.js` → `serie.js` → `cifra.js` → `sorteio.js` →
`hinario.js` → `coletanea.js` → `pptxzip.js` → `deck.js` → `pacote.js` →
`controle.js`.

As CINCO condições: papel `controle` · `AVDB`/`AVStream`/`createStage` ·
`__avBack` · um `<li>` em `#playlist` · **os dez módulos do Controle**
(`Louvorja`, `Bible`, `AVSerie`, `AVSorteio`, `AVCifra`, `AVHinario`,
`AVColetanea`, `AVPptxZip`, `AVDeck`, `AVPacote`). Por **polling** (250 ms,
desistindo em 30 s), porque o `init()` é assíncrono e termina DEPOIS do `load`.

> **A LISTA CRESCE COM O DIRETÓRIO, e no MESMO lote.** Cada módulo novo do
> Controle é um buraco novo neste watchdog no dia em que ele nasce — o uso dele
> mora dentro de uma função, então um erro de topo não aborta o `controle.js` e
> o bundle é carimbado como bom para sempre, com aquele recurso morto.

> **A quinta fechou o buraco (v5.315).** Os quatro scripts do Controle não
> tinham condição nenhuma, e todo uso de `AVSerie`/`AVSorteio` no `controle.js`
> está DENTRO de função: um erro de topo num deles **não** aborta o
> `controle.js`, então o app subia, o watchdog confirmava, e o recurso ficava
> morto PARA SEMPRE — sem erro na tela e sem recuo no lançamento seguinte.
> `sorteio.js` mudou em v5.302, v5.306, v5.308 e v5.311. Cada um publica o
> próprio global na ÚLTIMA linha do arquivo, então exigi-lo é exigir que o
> arquivo tenha sido parseado inteiro.

### E trocar a base servida OBRIGA a limpar o cache do WebView

As URLs não mudam de nome entre versões e o WebView roda com
`cacheMode = LOAD_DEFAULT` — servir um bundle diferente do anterior faz a página
nascer **com metade de cada bundle**, e o modo de falhar **se realimenta**: uma
página remendada não satisfaz o `otaAppIsUp`, o bundle seguinte também é
descartado, e o aparelho fica preso entre duas versões.

`WebUpdater.baseTrocou` responde contra **`KEY_SERVIDO`** (o que a sessão
anterior de fato serviu), **não** contra `KEY_ACTIVE` (que diz o que o OTA
*quer* servir). O cache é **por aplicação**, então limpar no primeiro WebView
cobre a `Presentation`.

---

## As outras defesas do download

- **Uma verificação por vez** (`checking`, `AtomicBoolean`). `checkAsync` roda em
  todo `onCreate`, e uma recriação de Activity continua possível (a v1.4.19
  encheu o `android:configChanges` — RARA, não impossível):
  mudar o tamanho da fonte durante um download disparava um segundo `check()`
  escrevendo nos MESMOS temporários. Os temporários levam sufixo único por
  execução.
- **Host travado** (`github.com`, `objects.githubusercontent.com`) e **`https`
  obrigatório**. Não dá autenticidade, mas impede que um campo alterado aponte o
  download para outro servidor — e esse JS rodaria no origin privilegiado.
- **`sha256` obrigatório**; **zip slip** e teto de tamanho na extração;
  **reprovação antes de ativar** (sem `web/controle/index.html`, descarta).
- **O fallback é por ARQUIVO:** o que faltar no bundle baixado vem do APK.
- **APK novo com base mais recente descarta um OTA antigo.**

---

## A atualização PERGUNTA

- **Uma pergunta, sobre o lote.** Sem Release: *"Base v5.234 — as duas telas
  recarregam e a projeção pisca."* Com Release: *"Base v5.234 e app v2.0
  (30 MB) — a base entra primeiro…"*.
- **Ordem base → APK.** A base é rápida e não depende de confirmação; o APK
  exige um diálogo do sistema que pode ser recusado. Invertido, uma recusa ali
  deixaria o lote inteiro por aplicar.
- **A INTENÇÃO sobrevive à recarga.** `otaApply` substitui o documento, então
  nada em memória atravessa: a intenção é gravada no `state` do banco ANTES de
  aplicar e relida na abertura seguinte. Descartada quando o `versionName`
  instalado alcança a versão pedida, e depois de 6 h.
- **A pergunta espera só o que ACABA: cena projetando e download em curso.** O
  **espelho não segura** — ele fica ligado o culto inteiro, e incluí-lo tornava a
  supressão permanente. **Instalar o APK espera os três**
  (`horaRuimParaAtualizar`), porque derruba o app e leva o servidor da rede
  junto.
- **"Depois" cala o diálogo, não o FATO.** O `#otaRow` de Configurações passa a
  dizer por extenso o que espera e aplica no toque.
- **Toque fora do diálogo NÃO responde por ele** (`appDialogFixo`): um toque em
  qualquer lugar o resolvia como "depois", silenciando-o pela sessão.
- **`otaRecusadas` mudou de significado**: era "o operador disse depois", hoje é
  "**já tentamos e o shell não aceitou**" — sem ela, um bundle reprovado faria a
  enquete pedir aplicação a cada 20 s, para sempre.
- **O Registro diz POR QUE está esperando**: ninguém foi perguntado, o operador
  adiou, espera a cena sair, ou o shell recusou o bundle. As quatro pedem ações
  opostas.

---

## Achados em aberto (auditoria de 2026-08)

> A lista completa, de todos os subsistemas, está em
> [`../ACHADOS-EM-ABERTO.md`](../ACHADOS-EM-ABERTO.md). O abaixo é o deste
> capítulo que continua de pé.

(O piso que não segurava a enquete web foi corrigido: ver "A detecção", acima; o
`HOLD` que dependia do gatilho `release` foi corrigido no workflow, e quem o
solta é o push da tag; e a retomada da atualização passou a EXIGIR o achado —
abaixo.)

**Nenhum.** O último — `otaAppIsUp` sem condição para `louvorja.js`,
`bible.js`, `serie.js` e `sorteio.js` — foi corrigido na v5.315: a função exige
agora `Louvorja`, `Bible`, `AVSerie` e `AVSorteio`, cada um publicado na última
linha do próprio arquivo. Provado que morde: um erro de topo injetado no
`sorteio.js` faz o `boot-nativo.test.mjs` reprovar exatamente a asserção do
critério do watchdog.

**A RETOMADA EXIGE O ACHADO.** A intenção sobrevive ao processo; o `achado` do
`ShellUpdater` é `@Volatile` de processo e nasce vazio a cada abertura. Sem a
guarda, uma abertura sem rede chamava `apkInstalar` com `achado == null`,
recebia *"nao ha versao nova para baixar"*, **apagava a intenção antes de testar
o erro** e abria um modal "A atualização do app falhou". Hoje
`retomarAtualizacao` só chama `instalarApk` com `apkNovo` na mão (rodando
`lerAtualizacao()` quando ninguém leu o estado ainda — o caso da abertura). A
pergunta é ESTRUTURAL, e não casada por substring da frase do shell: o texto do
erro não é contrato.

> O que já foi **corrigido** nesta auditoria (só texto): a lista de scripts
> (faltavam `serie.js` e `sorteio.js`), o KDoc do `RONDA_MS` ("um minuto" para
> um valor de 15 s), "a ronda de 5 min" no `catch`, "de minuto em minuto" no
> `MainActivity` (a enquete é de 10 s) e a citação de `renderVersionLabel()` no
> topo do `controle.js`, que na verdade é `renderOtaRow()`.

---

## O que NÃO existe aqui, de propósito

**Sem `WorkManager` nem alarme.** Atualizar a base de um app FECHADO não serve
para nada: ela entra ao abrir, e ao abrir a procura acontece.

> **O nome do repositório aparece nos DOIS lados e eles têm de bater**: o
> workflow usa `$GITHUB_REPOSITORY`, e `WebUpdater.REPO` é digitado à mão.
> Renomear o repositório exige mexer nessa constante **e** publicar um APK (a URL
> está compilada no shell). O modo de falhar é mudo: o `check()` engole tudo em
> `Log.i`.

---

<!-- Extraído do `CLAUDE.md` na faxina de 2026-09-07. -->

> **Este bloco saiu do `CLAUDE.md`.** O que ficou lá são as TRÊS GARANTIAS e a
> regra do `shellTag` — o que se quebra publicando um lote —, porque isso muda o
> próximo diff. Aqui está o mecanismo: os dois canais, a detecção, o watchdog, a
> pergunta e as defesas do download.
>
> Ele NÃO sobrepõe o que já estava neste arquivo (MEDIDO: 17% de coincidência).

## O OTA da base web — o mecanismo inteiro

O job `web-ota` (todo push em `main`) empacota `assets/web/` num
`web-<versão>.zip` e publica, com um `version.json`, na release de tag fixa
**`web-latest`** — URL estável porque está compilada no shell. O app consulta o
`version.json`, baixa quando há versão nova e passa a servi-la.

### Os DOIS canais são UM evento

```
 push em main            Release v2.0 publicada         aparelho
 ┌─────────────┐ shellTag ┌──────────────────┐         ┌──────────────────┐
 │ version.json│ ───────► │ audio-visual….apk│ ──────► │ ronda de 15 s    │
 │ "shellTag": │  SEGURA  └──────────────────┘ gatilho │ lê o MANIFESTO   │
 │   "v2.0"    │  o OTA     o MESMO run                │ web + shell      │
 └─────────────┘                                       │ → UMA pergunta   │
                                                       └──────────────────┘
```

- **`shellTag` no `version.json` é o acoplamento.** Declarado, o `web-ota`
  **segura a publicação do bundle** até a Release existir (o job termina verde e
  diz no resumo que está segurando — é o estado normal entre o merge e a
  Release). Quando ela sai, o bundle é republicado com o bloco **`shell`**
  (versão, URL do `.apk`, tamanho) dentro do manifesto. Sem `shellTag` o
  manifesto anuncia a Release mais recente que existir — `shellTag` responde
  *"este lote PRECISA de uma Release?"*.

  **QUEM SOLTA O HOLD É O PRÓPRIO RUN QUE PUBLICA, não o gatilho `release`.** A
  Release nasce do `action-gh-release` com o GITHUB_TOKEN padrão, e evento
  originado nesse token **não cria execução nova de workflow** — medido: em 136
  execuções do `apk.yml`, `release` disparou **zero** vezes. O que funciona é
  ORDEM DE JOB: o `web-ota` tem o `apk` no `needs` e consulta a Release já
  publicada, no mesmo run. O `on: release: [published]` fica para a Release que
  nasce de outra mão (a interface do GitHub, ou um PAT).

  **E a PÁGINA sofre do mesmo mal, por outro caminho** (v1.0.1): ela é outro
  workflow, e `needs` não atravessa arquivo. O `pages.yml` passou a encadear por
  `workflow_run` no "Build APK" — o mecanismo do próprio GitHub para isto, e o
  único que o guarda de recursão não suprime. Sem ele, o botão "Baixar grátis"
  serve o `.apk` da Release ANTERIOR até alguém reconstruir à mão.

  **E a VERSÃO que a página anuncia sai do MANIFESTO, não da tag da Release.** A
  tag é a versão do APK, e ela fica parada em todo lote que sai só por OTA — o
  aparelho mostrava 1.0.2 e a página dizia 1.0.1, com o mecanismo inteiro
  funcionando. O manifesto responde *"quão novo é este app?"* e é o que está de
  fato PUBLICADO (o `version.json` do repositório pode estar segurado pelo
  `shellTag`). Tamanho e URL continuam vindo do APK, que é o que se baixa.
- **É o manifesto que permite a detecção ser rápida.** A API do GitHub não
  autenticada dá **60 req/hora por IP**; a ronda de 15 s são 240. Perguntar o APK
  à API esgotaria o limite em quinze minutos e passaria a falhar com 403 pelo
  resto da hora. O manifesto é asset de release e **não consome limite nenhum**:
  uma requisição responde as duas perguntas, e no MESMO instante.
- **O zip tem nome versionado**, e isso fecha uma classe inteira: com
  `web-assets.zip` substituído no lugar, duas execuções intercaladas deixavam o
  zip de uma com o `sha256` da outra — e a partir daí todo aparelho baixa,
  reprova o hash e o **OTA fica INERTE até o próximo push**, sem sinal. O único
  arquivo substituído no lugar passa a ser o manifesto, escrito por último. O job
  recolhe os antigos deixando os **três mais novos** (apagar o que alguém está
  baixando devolveria 404 no meio do download).
- **`sha256` reprovado é FALHA, não desfecho.** Devolver `null` carimbava a
  tentativa como bem-sucedida (`ultimoOk` renovado, `falhasSeguidas` zerado, sem
  espera crescente), e a ronda seguinte rebaixava o mesmo zip, para sempre.

### A atualização PERGUNTA

- **Uma pergunta, sobre o lote — e ela DIZ O QUE VEM.** Três blocos, nesta
  ordem, porque é a ordem da leitura: a IDENTIDADE (*"Base v1.0.6."* · *"Base
  v1.0.6 e app v1.0.2 (4,2 MB)."*), a LINHA DO TEMPO das mudanças, e a
  CONSEQUÊNCIA do toque (*"as duas telas recarregam…"* · *"o Android vai pedir
  para confirmar a instalação"*) — que é a única das três que a lista nunca
  responde, e a razão de haver pergunta em vez de a atualização entrar sozinha.
  Desfechos: **Atualizar agora** · **Deixar para depois**.
- **As notas viajam DENTRO do bundle** (`assets/web/notas.json`, uma entrada por
  versão), lidas pelo shell do diretório do bundle BAIXADO
  (`WebUpdater.notasPendentes`) e entregues já filtradas para o que o aparelho
  ainda não tem. **Não no manifesto**, por três razões independentes: ele é
  buscado 240 vezes por hora e essas linhas importam uma vez por semana; dentro
  do zip elas não têm como divergir do que descrevem; e nada de novo entra no
  caminho de rede, logo nada de novo pode falhar nele. **O preço, dito: um lote
  SÓ de APK não tem linha do tempo** — não há bundle novo de onde lê-la, e o
  desfecho é a pergunta sem a lista, nunca uma lista errada.
- **CADA ITEM É UM TÓPICO, e o padrão é esse** (v1.4.12). Pedido do operador:
  *"está muito texto e muito agressivo. Use apenas tópicos e não precisa entrar
  em detalhes… a intenção desses textos não é explicar os problemas, mas nomear
  eles o suficiente para o usuário entender o que foi atacado naquela
  atualização, e não exatamente o COMO."* Três regras, e o CI cobra as duas que
  são mecânicas:
  - **NOMEIA, não explica.** *"O som deixou de sumir ao conectar numa smart
    TV."* — e ponto. O mecanismo, a causa e a medição vão para
    `docs/HISTORICO.md`, que é onde alguém os procura.
  - **Uma linha curta** (teto de 120 caracteres no CI; MEDIDO, os 75 tópicos de
    hoje têm 67 em média e 90 no maior). A régua não é o arquivo — é o cartão:
    a lista do diálogo tem `.88rem` numa caixa estreita, e MEDIDO um tópico de
    ~55 chars já ocupa 2 linhas a 430px e 3 a 320px. Um parágrafo ali vira sete.
  - **Sem CAIXA ALTA de ênfase** (o CI aceita no máximo uma palavra de três
    letras ou mais). Era o abre de todo item — *"O APP AGORA AVISA QUE…"* — e
    numa lista de seis isso é a tela gritando. Ela continua servindo no
    `HISTORICO.md` e nos comentários, onde há prosa em volta para contrastar.

  **A conta do que isso vale:** o arquivo caiu de 99 itens e 24,3 kB para 80 e
  6,8 kB — e ele viaja em TODO bundle do OTA.
- **O ARQUIVO GUARDA A SÉRIE ATUAL E A ANTERIOR, e nada mais** (v1.4.3). Ele
  chegou a 87 entradas — 51 kB em TODO bundle, com linhas descrevendo a v1.0.1.
  A regra de poda é `MAIOR.INCREMENTAL`: hoje 1.8.x e 1.7.x (a v1.3.x saiu
  na v1.5.4, que deixou o arquivo em 50 entradas e 13,4 kB — a série tinha
  virado e a poda ficara para trás). **O preço está dito e é pequeno:** o "E mais N mudanças" do rodapé
  conta o que está NA LISTA, então um aparelho parado há meses vê um N
  subestimado. A lista visível tem seis linhas de qualquer jeito
  (`OTA_MAX_LINHAS`), e as podadas descrevem versões que não rodam em aparelho
  nenhum. Podar de novo quando a série virar — o histórico completo de cada
  lote continua em `docs/HISTORICO.md`, que é onde ele é consultado por `grep`.
- **O teto de linhas é o que a mantém uma linha do tempo.** Seis
  (`OTA_MAX_LINHAS`); o que sobra vira *"E mais N mudanças."* **no rodapé, que
  não rola** — na lista, que rola, esse aviso era o primeiro item a ser cortado,
  e o que sobrava era uma lista truncada afirmando ser tudo. O teto de ALTURA
  mora no `.dialog-card`, não na lista: `40vh` na lista a cortava com o cartão
  ocupando 477px de 640 — ela não sabe quanto os irmãos estão gastando.
- **Ordem base → APK.** A base é rápida e não depende de confirmação; o APK exige
  um diálogo do sistema que pode ser recusado. Invertido, uma recusa ali deixaria
  o lote inteiro por aplicar.
- **A INTENÇÃO sobrevive à recarga.** `otaApply` substitui o documento, então
  nada em memória atravessa: a intenção é gravada no `state` do banco ANTES de
  aplicar (mesmo lugar e motivo da intenção de download do YouTube) e relida na
  abertura seguinte. Descartada quando o `versionName` instalado alcança a versão
  pedida — sem isso o instalador reabriria oferecendo o que já está rodando — e
  depois de 6 h.

  **E ela é gravada por `AVDB.updateState`, nunca por `setState` — este é o
  ponto do recurso, não um detalhe.** `setState` resolve na aceitação do
  REQUEST, com a transação ainda em voo; a linha seguinte é o `otaApply()` que
  recarrega as duas páginas, e conexão derrubada ABORTA transação em voo. A
  intenção some, a abertura seguinte não acha nada, e a metade nativa do lote
  desaparece **com tudo parecendo ter funcionado** — o desfecho exato que a
  intenção existe para impedir. `updateState` espera o commit (`txDone`). Os
  quatro pontos que mexem em `ota-intencao` seguem a mesma regra, e o
  `apagar` de `instalarApk` pelo motivo espelhado: o diálogo do Android pode
  derrubar o app no instante seguinte, e uma limpeza não commitada reabre o
  instalador na abertura seguinte.
- **A pergunta espera só o que ACABA: cena projetando e download em curso.** O
  **espelho não segura**: ele fica ligado o culto inteiro, e incluí-lo tornava a
  supressão permanente (foi por isso que a v5.151 desistiu de perguntar).
  **Instalar o APK espera os três** (`horaRuimParaAtualizar`), porque derruba o
  app e leva o servidor da rede junto.
- **"Depois" cala o diálogo, não o FATO** — e cala só ESTA sessão. `otaAdiadas`
  é um `Set` em memória que morre com a página: minimizar mantém o adiamento (é
  a mesma sessão), FECHAR e reabrir o desfaz, porque o `onCreate` reconstrói o
  WebView e a página nasce limpa. A pergunta volta na abertura seguinte.
- **O botão `#otaRow` de Configurações SÓ EXISTE depois do "depois"** — ele diz
  por extenso o que espera ("Atualizar: base v5.245 e app v2.2") e aplica no
  toque. Antes ele era visível sempre e, sem nada esperando, dizia "Procurar
  atualização": um botão de procurar numa tela onde não há o que procurar sugere
  que cabe ao operador conferir, e não cabe — a ronda bate a cada 15 s. Com a
  pergunta AINDA na tela ele também não existe: ali quem oferece é o diálogo.
- **Toque fora do diálogo NÃO responde por ele** (`appDialogFixo`). Esta pergunta
  aparece sozinha, no meio de outra coisa, e um toque em qualquer lugar a
  resolvia como "depois", silenciando-a pela sessão. "Deixar para depois" e
  Esc/voltar continuam valendo — o que deixa de existir é a recusa por acidente.
- **O Registro diz POR QUE está esperando**: ninguém foi perguntado, o operador
  adiou, espera a cena sair, ou o shell recusou o bundle. As quatro pedem ações
  opostas.

Oráculo: **`tools/ota.test.mjs`** (Chromium + ponte de mentira), incluindo a
intenção atravessando a MORTE DO DOCUMENTO — semeada numa página que só carrega
`shared/db.js`, e não no Controle: ali `retomarAtualizacao()` roda na abertura e
CONSOME a semente antes de a navegação acontecer, o que é o app fazendo o certo
e o oráculo medindo a si mesmo.

### A detecção: quatro gatilhos

1. **abertura**;
2. **ronda de 15 s** na frente (120 s em segundo plano), enquanto o processo viver;
3. **`onResume`** — com `forcar`, a única exceção ao piso: é o instante em que a
   resposta pode virar uma pergunta na tela;
4. **a rede voltando** (`registerDefaultNetworkCallback`, com
   `onCapabilitiesChanged`/`NET_CAPABILITY_VALIDATED` — o Wi-Fi da igreja associa
   **antes** de ter saída, e `onAvailable` sozinho dispara cedo demais).

- **Falha retenta sozinha**, 5 s → 10 → 20 → 30 s. O teto era 90 s e era o pior
  lugar para ser generoso: acima de meio minuto a espera dura MAIS que a ronda, e
  uma falha transitória sai punindo a detecção.
- **O piso entre consultas (5 s) é MENOR que a ronda (15 s).** Com os dois
  iguais, uma batida um milissegundo cedo era descartada e a seguinte só viria
  15 s depois — a ronda valendo 15 s ou 30 s conforme o jitter do agendador. É a
  receita exata da "detecção inconstante e quase aleatória".
- **E por isso o piso é POR CHAMADOR.** A enquete do lado web bate a cada 10 s e
  passava livre pelos 5 s: a rotina que se anuncia como "lê o disco" virava uma
  consulta à rede a cada dez segundos, para sempre. Subir o piso comum acima de
  10 s é o reflexo errado — aí a enquete ROUBA o passo da ronda, e a detecção
  fica mais lenta do que sem ela. O cutucão da tela leva o piso da PRÓPRIA ronda
  (`WebUpdater.cutucaoDaTela`): ele só vira requisição quando a ronda não
  entregou uma passada inteira, que é o papel dele — rede de segurança, não
  segunda ronda.
- **A ronda é blindada contra exceção.** `scheduleWithFixedDelay` CANCELA todas
  as execuções seguintes quando o `Runnable` lança — sem log e sem `Future` que
  alguém consulte. Errar aqui é a detecção parar para sempre naquele aparelho.
- **Nada de cópia guardada.** O asset de `web-latest` é substituído no lugar
  (mesma URL, conteúdo novo), que é exatamente quando um cache devolve o de
  ontem com toda a razão — e isso não atrasa a atualização, torna-a INVISÍVEL.
  Daí `no-cache` **e** `?t=` na URL (caches que ignoram o cabeçalho existem).
- **O shell EMPURRA** (`window.__avAtualizacao`) quando o estado muda —
  inclusive **quando só o APK mudou**, senão uma Release sem base web nova
  ficaria muda. A enquete de 10 s é o piso, para o caso de o empurrão se
  perder.
- **A comparação é contra o que o aparelho JÁ TEM** (`versaoJaTemos`), não contra
  o que ele SERVE: um bundle baixado espera o próximo lançamento e
  `currentVersion` continua sendo o da sessão — comparar por ele rebaixaria o
  mesmo zip a cada ronda, apagando com `deleteRecursively` um diretório que o
  operador pode ter acabado de mandar aplicar ao vivo.
- **`#otaRow` tem dois estados**: "Procurar atualização" (pula o piso do shell,
  ao lado do `onResume` — são os dois que o fazem) e "Atualizar: …". Os dois
  desfazem a recusa da sessão. `otaDiag` alimenta a linha **"Procura:"** do Registro: "não apareceu
  aviso nenhum" tem quatro causas indistinguíveis da tela.
- **Sem `WorkManager` nem alarme**, de propósito: atualizar a base de um app
  FECHADO não serve para nada (ela entra ao abrir, e ao abrir a procura acontece).

> **O nome do repositório aparece nos DOIS lados e eles têm de bater**: o workflow
> usa `$GITHUB_REPOSITORY`, e `WebUpdater.REPO` é digitado à mão. Renomear o
> repositório exige mexer nessa constante **e** publicar um APK (a URL está
> compilada no shell). O modo de falhar é mudo: o `check()` engole tudo em
> `Log.i`.

**A identidade do bundle é `assets/web/version.json`** (`version` + `minShell` +
`shellTag` opcional), versionado no repositório — o bundle carrega a própria
versão, seja o embutido ou o baixado. O workflow acrescenta `sha256`, a URL e,
havendo Release, o bloco `shell`. A forma de `shellTag` é validada no CI
(`v` + números): malformado devolve 404, o job segura o OTA **para sempre**, e o
sintoma é "a atualização não chega".

**O OTA não muda o acesso ao nativo:** a ponte é injetada pelo Kotlin
(`addJavascriptInterface`), não vem nos arquivos web — bundle baixado enxerga
`__AVBridge` como o embutido, servido pelo mesmo origin.

### As três garantias (isto roda em culto)

1. ~~**Nunca troca a base no meio de uma sessão.**~~ **REVOGADA** (v1.68/v5.151),
   depois **substituída pela pergunta** (v5.234). Ela prometia "entra no próximo
   lançamento", e `beginSession()` decide uma vez por **PROCESSO** — que quase
   nunca morre (os serviços em primeiro plano o mantêm vivo, e fechar pelo
   Recentes derruba a Activity, não o processo). O que sobrevive dela:

   - **A faxina roda só em `beginSession()`** (`sessionStarted`), e preserva o
     alvo novo **e o `sessionRoot` em uso**: ela APAGA diretório, e o `cleanup`
     rodando numa recriação de Activity apagaria o que os dois WebViews estão
     servindo — todo recurso ainda não carregado cairia no fallback do APK, no
     meio da projeção.
   - **Nada é apagado ao aplicar**: o diretório antigo pode ter requisições em
     voo durante a recarga; quem recolhe é o `beginSession()` seguinte.
   - **HÁ UM CAMINHO DE APLICAÇÃO, e ele passa pela PERGUNTA.** O shell só
     AVISA (`WebUpdater.onEstado` → `window.__avAtualizacao`); quem aplica é o
     web, no "Atualizar agora" do diálogo (`otaApply`). O `aplicarSozinho` que
     trocava a base sem perguntar saiu na v5.234 — o `grep` por ele em
     `app/src/main/java/` devolve só as duas linhas que dizem que ele saiu. O
     que existe em DUPLICATA é a DETECÇÃO, não a aplicação: o empurrão do shell
     e a enquete de 10 s do web, esta para o caso de aquele se perder.
   - **`otaRecusadas` mudou de significado**: era "o operador disse depois", hoje
     é "**já tentamos e o shell não aceitou**" — sem ela, um bundle reprovado
     faria a enquete pedir aplicação a cada 20 s, para sempre.

   O que a substitui é o **watchdog de boot** (garantia 3).
2. **Válvula `minShell`.** Bundle que exija ponte mais nova que
   `NativeBridge.SHELL_VERSION` é recusado; o app segue no que tinha. **É por
   isso que `SHELL_VERSION` sobe a cada mudança de superfície da ponte** — sem
   isso a válvula não protege nada.
3. **Watchdog de boot.** Servir um bundle arma um `pending`; o web o desarma
   (`otaConfirm`). Bundle que não confirme é descartado no lançamento seguinte e
   o app volta ao embutido. O `pending` guarda o **NOME do subdiretório**, não um
   booleano — com booleano a confirmação de um bundle perdoava outro. A chave é
   nova de propósito: ler um `Boolean` como `String` em `SharedPreferences` lança
   `ClassCastException` dentro do `onCreate`, e o app não abriria depois de
   atualizar o APK.

#### O sinal de boot é "o app está DE PÉ" (`otaAppIsUp`)

`window.AVDB` no `load` não bastava: a ordem dos scripts do Controle é
`native.js` → `db.js` → `mse.js` → `stage.js` → `louvorja.js` → `bible.js` →
`serie.js` → `cifra.js` → `sorteio.js` → `hinario.js` → `coletanea.js` →
`pptxzip.js` → `deck.js` → `pacote.js` → `controle.js`, e um erro
em qualquer um dos **catorze** últimos aborta só AQUELE script — o `load` dispara, `AVDB` continua lá, e o
bundle quebrado era carimbado como bom **para sempre**. As cinco condições,
cada uma cobrindo o que a anterior não cobre:

1. **papel `controle`** — o Display não carrega `controle.js` nem `louvorja.js`,
   e é o caso NORMAL de culto: confirmaria quase sempre no lugar do outro. Regra
   imposta **nos dois lados** (o laço nem começa no Display, e `otaConfirm`
   recusa `role != "controle"`).
2. **`AVDB` · `AVStream` · `createStage`** — os três módulos compartilhados, cada
   um publicando seu global no fim do arquivo.
3. **`__avBack`** (perto do fim do `controle.js`) — só existe se o arquivo foi
   parseado inteiro. É a mesma função que `handleBack()` consulta: contrato que
   já existe, não marcador inventado.
4. **um `<li>` dentro de `#playlist`** — o HTML entrega o `<ul>` VAZIO; quem o
   preenche é `renderPlaylist()`, dentro do `init()` assíncrono, que começa por
   `loadCollections()`. Prova que a inicialização terminou.

5. **`Louvorja` · `Bible` · `AVSerie` · `AVSorteio` · `AVCifra` · `AVHinario` ·
   `AVDeck` · `AVColetanea` · `AVPptxZip` · `AVPacote`** — os dez
   scripts do Controle, cada um publicando seu global na ÚLTIMA linha do arquivo. Eram o
   buraco declarado deste watchdog até a v5.315: todo uso de `AVSerie`/`AVSorteio`
   no `controle.js` está DENTRO de função, então um erro de topo num deles **não**
   aborta o `controle.js` — `__avBack` existe, a playlist renderiza, `otaConfirm()`
   desarma o watchdog, e o bundle ficava adotado PARA SEMPRE com a Playlist
   automática (ou a Biblioteca de séries, ou a Bíblia, ou o hinário) morta, sem
   erro na tela e sem recuo no lançamento seguinte.

**Por polling** (250 ms, desistindo em 30 s, em silêncio), e não checagem única
no `load`: o `init()` é assíncrono e termina DEPOIS do `load` — uma checagem
única rejeitaria todo bundle bom. **O erro possível aqui é o SEGURO**: fechar o
app antes da confirmação descarta um bundle bom (custo: baixa de novo); carimbar
um quebrado não tem volta sem publicar outra versão. `native.js` viaja DENTRO do
bundle que valida, então não há descompasso.

#### Trocar a base servida OBRIGA a limpar o cache do WebView

As URLs não mudam de nome entre versões e o WebView roda com
`cacheMode = LOAD_DEFAULT` — servir um bundle diferente do anterior faz a página
nascer **com metade de cada bundle**, e o modo de falhar **se realimenta**: uma
página remendada não satisfaz o `otaAppIsUp`, o bundle seguinte também é
descartado, e o aparelho fica preso entre duas versões.

A regra já existia em `StagePresentation.recarregar` e `MainActivity.applyWebUpdate`;
faltava no **lançamento** — os caminhos de recuo do `beginSession` (watchdog
descartando um bundle, APK novo atropelando um OTA mais antigo).
`WebUpdater.baseTrocou` responde contra **`KEY_SERVIDO`** (o que a sessão
anterior de fato serviu), **não** contra `KEY_ACTIVE` (que diz o que o OTA
*quer* servir), e `buildControleWebView` limpa o cache antes do primeiro
`loadUrl`. O cache é **por aplicação**, então limpar no primeiro WebView cobre a
`Presentation`. Ausente não conta como troca. `beginSession` tem **saída única**
(`fixarBase`) por causa disto: eram quatro `return` espalhados, e um quinto
acrescentado sem a anotação passaria despercebido.

#### As outras defesas do caminho de download

- **Uma verificação por vez** (`checking`, `AtomicBoolean`). `checkAsync` roda em
  todo `onCreate`, e uma recriação de Activity continua possível (a v1.4.19
  encheu o `android:configChanges`, o que a torna RARA — não impossível): uma
  recriação durante um download disparava um segundo `check()` escrevendo nos
  MESMOS temporários — podia ativar um diretório INCOMPLETO. Os temporários
  levam sufixo único por execução.
- **Host travado** (`github.com`, `objects.githubusercontent.com`) e **`https`
  obrigatório**. Não dá autenticidade, mas impede que um campo alterado aponte o
  download para outro servidor — e esse JS rodaria no origin privilegiado.
- **`sha256` obrigatório**; **zip slip** e teto de tamanho na extração;
  **reprovação antes de ativar** (sem `web/controle/index.html`, descarta).
- APK novo com base mais recente descarta um OTA antigo. Comparação **numérica
  por componente** (`compareVersions`), não lexical — `4.9` < `4.82` como string.
- O fallback é **por arquivo**: o que faltar no bundle baixado vem do APK.

---
