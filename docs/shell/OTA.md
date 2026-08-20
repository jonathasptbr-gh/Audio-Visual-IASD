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

#### O sinal de boot (`otaAppIsUp`) e o que ele NÃO cobre

Ordem dos scripts do Controle: `native.js` → `db.js` → `mse.js` → `stage.js` →
`louvorja.js` → `bible.js` → `serie.js` → `sorteio.js` → `controle.js`.

As quatro condições: papel `controle` · `AVDB`/`AVStream`/`createStage` ·
`__avBack` · um `<li>` em `#playlist`. Por **polling** (250 ms, desistindo em
30 s), porque o `init()` é assíncrono e termina DEPOIS do `load`.

> ⚠️ **ACHADO EM ABERTO — quatro arquivos sem cobertura.** `louvorja.js`,
> `bible.js`, `serie.js` e `sorteio.js` não têm condição nenhuma. Todo uso de
> `AVSerie`/`AVSorteio` no `controle.js` está DENTRO de função, então um erro de
> topo num deles **não** aborta o `controle.js`: o app sobe, o watchdog
> confirma, e o recurso fica morto para sempre. `sorteio.js` mudou em v5.302,
> v5.306, v5.308 e v5.311. Ver "Achados em aberto".

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
  todo `onCreate` e `android:configChanges` não cobre `fontScale` nem `locale`:
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

Verificado no código; **não foi corrigido**, porque muda comportamento. A
correção proposta está aqui para não se perder. (O piso que não segurava a
enquete web foi corrigido: ver "A detecção", acima; o `HOLD` que dependia do
gatilho `release` foi corrigido no workflow, e quem o solta é o push da tag; e a
retomada da atualização passou a EXIGIR o achado — abaixo.)

| # | onde | o quê | correção proposta |
|---|---|---|---|
| 1 | `native.js` (`otaAppIsUp`) | `louvorja.js`, `bible.js`, `serie.js` e `sorteio.js` sem condição — um erro de topo neles é carimbado como bundle bom | exigir o global publicado no fim de cada arquivo, na mesma forma da condição 2 |

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
