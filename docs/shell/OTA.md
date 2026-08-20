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
 │   "v2.0"    │  o OTA     release:published          │ web + shell      │
 └─────────────┘                                       │ → UMA pergunta   │
                                                       └──────────────────┘
```

- **`shellTag` no `version.json` é o acoplamento.** Declarado, o job `web-ota`
  **segura a publicação do bundle** até a Release existir. Sem `shellTag`, o
  manifesto anuncia a Release mais recente que existir. A pergunta que ele
  responde é: *"este lote PRECISA de uma Release?"*
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

> ⚠️ **ACHADO EM ABERTO — o `HOLD` do `shellTag` pode não soltar sozinho.**
> A Release é criada por `softprops/action-gh-release` com o `GITHUB_TOKEN`
> padrão, e o GitHub **não dispara novas execuções de workflow** para eventos
> originados nesse token. Se isso valer aqui, o `on: release: [published]`
> nunca roda pelo fluxo documentado, o bundle fica segurado até o próximo push
> em `main`, e o sintoma é o de sempre: "a atualização não chega".
> **Enquanto não for confirmado em execução real, trate como suspeita:** depois
> de publicar uma Release para um lote com `shellTag`, **confira** se o
> `web-ota` rodou. Saídas possíveis: publicar com um PAT, ou fazer o próprio job
> chamar o `web-ota`. Ver "Achados em aberto", no fim.

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

> ⚠️ **ACHADO EM ABERTO — o piso de 5 s não segura ninguém.**
> `MIN_ENTRE_CHECKS_MS` = 5 s, mas os dois chamadores para os quais ele foi
> escrito passam por cima: `onResume` manda `forcar = true`, e a enquete do lado
> web é de **10 s** (`OTA_POLL_MS`), maior que o piso. O comentário do `#otaRow`
> afirma ser "o ÚNICO chamador que pula o piso" — não é. Ver "Achados em
> aberto".

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

Todos verificados no código; **nenhum foi corrigido**, porque os quatro mudam
comportamento. As correções propostas estão aqui para não se perderem.

| # | onde | o quê | correção proposta |
|---|---|---|---|
| 1 | `.github/workflows/apk.yml:19` | o gatilho `release: [published]` pode nunca disparar para a Release que o próprio workflow publica (`GITHUB_TOKEN` não gera eventos de workflow) — o `HOLD` do `shellTag` ficaria preso até o próximo push em `main` | publicar a Release com um PAT, **ou** o job `apk` chamar o `web-ota` depois de publicar. Enquanto isso, o resumo do HOLD deve dizer a verdade |
| 2 | `controle.js` (`retomarAtualizacao`) | a intenção sobrevive ao processo, mas o `achado` do `ShellUpdater` (estado `@Volatile` de processo) não. Numa abertura sem rede, a retomada chama `apkInstalar` com `achado == null`, abre um modal "A atualização do app falhou" **e apaga a intenção antes de testar o erro** | exigir `apkNovo` antes de retomar (rodar `lerAtualizacao()` primeiro), **ou** tratar "não há versão nova para baixar" como "ainda não sei": não apagar a intenção, não abrir modal |
| 3 | `WebUpdater.kt` (`MIN_ENTRE_CHECKS_MS`) | o piso de 5 s não reprova nem a enquete web (10 s) nem o `onResume` (`forcar = true`). O comentário do `#otaRow` diz ser o único a pular o piso, e não é | escolher a regra e fazê-la valer: subir o piso acima do maior intervalo de rotina, ou afrouxar a enquete web; e tirar `forcar` do `onResume` |
| 4 | `native.js` (`otaAppIsUp`) | `louvorja.js`, `bible.js`, `serie.js` e `sorteio.js` sem condição — um erro de topo neles é carimbado como bundle bom | exigir o global publicado no fim de cada arquivo, na mesma forma da condição 2 |

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
