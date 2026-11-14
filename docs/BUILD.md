# Build, distribuição e os oráculos por dentro

O rito, a versão, o workflow, o arnês dos oráculos, o MÉTODO deles, os passos do
CI, a assinatura, o backup, a página do site e as dependências declaradas. **É a
fonte única de tudo isso: o `CLAUDE.md` guarda a regra em uma linha e aponta para
cá.** O que cada oráculo trava está em [`ORACULOS.md`](ORACULOS.md).

> **Este texto veio do `CLAUDE.md`** — a maior parte na revisão A2 (2026-10-30),
> e o método dos oráculos, o número da versão e o rito da Release no Pacote 27
> (2026-11-14). Onde ele disser "acima", "abaixo" ou "esta seção", é daqui.

## O rito de entrega

A lista ÚNICA, na ordem — o `CLAUDE.md` aponta para cá. A entrega é direto em
`main` (decisão do operador, 2026-11-14): sem ramo, o passo 7 é a ÚNICA barreira
antes do canal OTA.

1. **Prévia visual** — só quando o operador pede um design novo (abaixo).
2. **Versão:** a base web mudou ⇒ as três casas (`version.json`, `WEB_VERSION`, `#appVersion`); o shell mudou ⇒ `shellTag` = `v` + versão (e o `SHELL_VERSION`, se a superfície mudou).
3. **`notas.json`:** a entrada da versão no topo, um tópico por linha, ≤ 120 caracteres.
4. **`docs/HISTORICO.md`:** a seção `## vX — …` e a linha do índice — antes da mensagem de commit, que fica curta.
5. **`docs/RESIDUOS.md`:** o que ficou para trás (ou "nenhum"), com a versão na coluna do lote.
6. **A fila:** o pacote entregue sai do `PEDIDOS-EM-ESPERA.md`.
7. **`tools/portao.sh <arquivos do lote>`** — o ÚLTIMO passo antes do commit; de novo depois de QUALQUER mudança (um `reverter.sh --restaurar` inclusive).
8. **Commit e push em `main`:** `git add <caminhos>` (nunca `-A` — `docs/MULTI-AGENTE.md`).
9. **Release, se o shell mudou:** o disparo manual com `release_tag` = o `shellTag` (a seção seguinte).
10. **O CI:** `verificar` vermelho = o bundle não saiu ⇒ conserto no MESMO número e push de novo; já publicado ⇒ número novo. Nunca `revert` nem `push --force` em `main`.
11. **A página:** o passo *"A versão que o aparelho vai rodar"* sem `::warning::` ("A página do site").

O portão e o `verificar` cobram 2 a 5 por máquina: as três casas, o `shellTag`
contra a última tag `v*` (shell mudado sem ele reprova), a versão maior que a da
tag quando a base web mudou, o teto das notas, o índice E a seção do histórico,
e a versão citada no RES.

## A versão — o número, as três casas e o `shellTag`

**O degrau é `MAIOR.INCREMENTAL.CORREÇÃO`, e cada componente responde a uma
pergunta. Nunca se sobe um degrau "porque já mudou bastante": sobe-se o degrau
que o LOTE justifica.**

| degrau | quando sobe | exemplo |
|---|---|---|
| **MAIOR** (`1`.x.y) | **só sob mudança fundamental de CONCEITO**, por decisão explícita de quem publica. Não é acúmulo de recursos — é o app deixar de ser o que era | `1.x.y` → `2.0.0` |
| **INCREMENTAL** (x.`2`.y) | uma **seção inteiramente nova**: um lugar que não existia, com tela e fluxo próprios | `1.0.7` → `1.1.0` |
| **CORREÇÃO** (x.y.`3`) | correções e ajustes menores — o caso NORMAL, e o que a maioria dos lotes é | `1.0` → `1.0.1` |

**Ao subir um degrau, os de baixo ZERAM:** depois de `1.4.9`, uma seção nova é
`1.5.0`, nunca `1.5.9` — um número que não zera passa a contar duas coisas e
deixa de responder qualquer uma delas.

**ARMADILHA MEDIDA: `1.1` e `1.1.0` são a MESMA versão** para o OTA, e vale
para todo número de DOIS componentes — o `compareVersions` completa com zero o
que falta, então republicar a `1.1` como `1.1.0` não é atualização nenhuma: o
aparelho ignora, em silêncio. **O primeiro degrau depois de um número de dois
componentes é o `.1`** (depois da `1.0` veio a `1.0.1`; depois da `1.1` vem a
`1.1.1`). A comparação é **numérica por componente**, nunca lexical: `1.0.10` é
MAIOR que `1.0.9`.

**As DUAS LINHAS usam o mesmo número, e podem ficar em degraus diferentes.** A
base web sobe a cada lote (chega por OTA em minutos); o APK só sobe quando um
lote exige Release. Um `web v1.0.7 · shell v1.0.3` não é divergência — é a
resposta a *"o OTA chegou e o APK ainda não?"*. **Desde a v1.7.0 essa resposta
mora só no REGISTRO:** a tela mostra um número, e é o da base web.

### As TRÊS casas, e os três andam juntos

| onde | o quê | para quê |
|---|---|---|
| `assets/web/version.json` | `"version"` | **faz a atualização chegar**: o OTA compara este campo (`compareVersions`) e ignora, em silêncio, um bundle cuja versão não seja maior que a instalada |
| `controle/controle.js` | `WEB_VERSION` | **é o que a UI mostra**: `renderVersionLabel()` escreve o rótulo de versão no CABEÇALHO de Configurações |
| `controle/index.html` | `<span id="appVersion">` | o que aparece antes do primeiro render — e a única versão visível num shell sem `appVersion()` |

Esquecer o `WEB_VERSION` é o erro **silencioso** (o bundle novo chega e o
aparelho exibe a versão antiga, justamente a leitura que serve para diagnosticar
se o OTA chegou); esquecer o `version.json` é o erro **mudo** do outro lado (nada
chega a aparelho nenhum). O `versionCode`/`versionName` do APK vêm do CI
("Assinatura").

**O estado corrente — a versão, a última Release, o `SHELL_VERSION`, o
`minShell` e o `shellTag` — se mede** (`tools/estado.sh`); o degrau e o piso da
ponte estão no
[`NUCLEO-TECNICO`](NUCLEO-TECNICO.md#shell_version--subir-sempre-que-a-superfície-mudar),
e o que cada lote trouxe, no `HISTORICO.md`. **Nenhum número de versão mora nesta
prosa.**

### O `shellTag` e a Release

**A primeira linha vem ANTES do commit:** declarar a tag em `version.json`.

```jsonc
{ "version": "1.0.1", "minShell": 46, "shellTag": "v1.0.1" }
```

Com ela o `web-ota` SEGURA o bundle até a Release existir e, quando ela sai,
republica o manifesto **com o link do APK dentro** — o app pergunta uma vez
sobre o lote inteiro (o mecanismo em
[`NUCLEO`](NUCLEO-TECNICO.md#ota-da-base-web-atualização-sem-apk)). Sem
`shellTag` o bundle sai na hora, que é o certo para um lote só de web. Depois do
push em `main`: Actions → *Build APK* → Run workflow, com `release_tag` = a MESMA
tag do `version.json` (a tag é criada pelo workflow, a partir de `main`). **Não
esperar o operador pedir.**

- **`shellTag` ACOMPANHA A ÚLTIMA VERSÃO, NÃO A QUE MEXEU NO KOTLIN** — o CI
  exige `shellTag == 'v' + version`. Um lote só de web publicado DEPOIS de um
  lote de shell ainda sem Release HERDA a obrigação (zerá-lo publicaria o bundle
  sozinho e deixaria o conserto do shell para trás, calado); com a Release já
  publicada, um lote só de web não declara. **Conferir a Release é parte de
  decidir.** A Release é UMA, cortada de `main` na tag mais nova, e carrega todo
  o Kotlin acumulado.
- **O gatilho da Release é o `java/` (e `res/`, o manifesto), não a ponte:**
  Kotlin que muda sem método novo pede Release; ENCOLHER a ponte pelo web não
  pede. Os módulos de `assets/web/` não são superfície do `SHELL_VERSION` —
  viajam dentro do bundle.
- **`shellTag` esquecido não quebra nada, mas desfaz o ganho** (o aparelho
  recebe a metade web sozinha). **`shellTag` apontando para uma tag que nunca
  sai é pior:** o canal fica segurando para sempre, em silêncio, e a única pista
  é a linha no resumo do run. Deixá-la apontando para a tag do lote ANTERIOR é o
  mesmo defeito.
- **Um `apk` reprovado não pula o `web-ota`** (o `if:` dele ignora o resultado
  do `apk`; o `needs` está pela ORDEM): quem segura é o HOLD do `shellTag`, e o
  desfecho é um job VERDE que não publicou. Um lote que toca `java/` confere o
  `apk`. Por extenso na última seção deste arquivo.
- **Renumerar um lote mexe nas TRÊS casas**, no `shellTag`, no `notas.json` e em
  toda chave que carregue o número — o OTA ignora, em silêncio, um bundle cuja
  versão não seja MAIOR que a instalada.

## Os três workflows e as entradas do disparo

| workflow | gatilho | o que faz |
|---|---|---|
| `apk.yml` (*Build APK*) | push em `main`, tag `v*`, PR, `release`, disparo manual | `verificar` (o portão do CI) → `apk` (o APK; a Release, se `PUBLISH`) → `web-ota` (o canal) |
| `pages.yml` | `workflow_run` do *Build APK*; push em `main` que toque `site/`; `release`; manual | a página do site, com a versão do canal OTA |
| `dados.yml` | cron, de hora em hora (`17 * * * *`) | fotografa os contadores de download e grava na branch órfã `dados` — **nunca em `main`**: um push ali republicaria o bundle e zeraria o contador que ele mede (`docs/MEDICAO-DE-ALCANCE.md`) |

O disparo manual do *Build APK* tem três entradas:

| entrada | o que faz |
|---|---|
| `release_tag` | publica a Release com esta tag, criada de `main` — **a rota do rito**. Vazio = só compila |
| `retag` | a tag já existe ⇒ MOVE para o commit atual (apaga e recria a Release) |
| `permitir_regressao` | publica um manifesto com versão MENOR que a no ar — só para renumeração deliberada. Sem ela, a **guarda anti-regressão** do `web-ota` (*"O manifesto publicado é mais novo?"*) pula a publicação, e o job termina VERDE com o motivo no resumo |

## Build e distribuição

`.github/workflows/apk.yml` — o runner `ubuntu-latest` já traz JDK e Android SDK;
nenhuma infraestrutura externa. **O `verificar` roda em `ubuntu-24.04` FIXO**
(revisão A6): no Ubuntu 26.04 o Playwright do pin (1.56.0) se recusa a instalar o
Chromium, o `Preparar o Chromium` falha, e a política (revogada) de
infraestrutura AUSENTE pulava a suíte inteira com o job VERDE — foram nove runs
de `main` assim. Voltar ao `ubuntu-latest` anda junto com subir o pin (e repetir
a campanha).

| Rota | Como | Observação |
|---|---|---|
| Artifact | Actions → run → *Artifacts* | vem como **.zip**; precisa descompactar no celular |
| **Release** ⭐ (a do rito) | Actions → *Build APK* → *Run workflow*, com `release_tag` | a tag é criada pelo próprio workflow, de `main`; **link direto para o .apk** |
| Release por tag | `git tag v1.0.1 && git push --tags` | a alternativa; o push da tag também solta o HOLD do `shellTag` |

**O `web-ota` NÃO tem filtro de caminho**, e é por isso que um lote que não toca
em `assets/web/` — documentação, o `site/`, um workflow — ainda republica o
bundle e reescreve o `sha256` do manifesto. Não é corrupção e não quebra nada (a
versão é igual, e o aparelho descarta o que não for MAIOR); o zip só é
reempacotado de um checkout novo, com carimbos de tempo novos. Manifesto e zip
saem juntos, do mesmo run, sob a mesma fila. Um `paths-ignore` pouparia runner,
mas mexe no maquinário que alimenta a frota — e o preço de errar ali é o canal
OTA parar.

**O `web-ota` roda com fila, sem cancelamento** (`concurrency: web-ota`,
`cancel-in-progress: false`). Os assets de `web-latest` são substituídos um a um,
sem transação: duas execuções em paralelo (o push do lote seguido do push do
conserto é o caso normal) intercalariam, e cancelar no meio do upload produz o
mesmo estado. Ver [`NUCLEO-TECNICO`](NUCLEO-TECNICO.md#ota-da-base-web-atualização-sem-apk) para o que o nome versionado do zip fecha.

### A PRÉVIA VISUAL — o laço de design, para lote só de aparência

**A REGRA:** é a ÚNICA via experimental (decisão do operador, 2026-11-14), e
entra **só quando ele pede** para experimentar um design novo. Quando o diff é
SÓ aparência — CSS, o HTML de uma folha ou de um card, espaçamento, cor,
sombra, animação —, o lote **não vai a `main` para ser vistoriado**. Ele se vê na prévia visual, no working tree, e só depois entra no
rito de publicação. O que deixa de existir é o "publica para ver como ficou".

```
node tools/previa-visual.mjs                  # serve e imprime as URLs, fica de pé
node tools/previa-visual.mjs --foto ~/tmp/tela.png   # Chromium do arnês, 430x900
```

O comando serve `app/src/main/assets/web` — **a base que o OTA entrega**, sem
build: o arquivo salvo é o servido, a cada requisição. Quem opera abre a URL da
rede no navegador do celular, toca, salva e recarrega; a foto existe para quem
não está com o aparelho na mão. `--rota`/`--largura`/`--altura` medem o que se
quer ver (o `/display/` a 1280x720, a Biblioteca a 360 de largura).

**O que a prévia NÃO é**, e é o que impede "rápido" de virar "sem conferência":

- **sem a ponte** (`window.__NATIVE__` falso, o caminho de navegador que a base
  mantém de propósito — `docs/DIVERGENCIAS-WEB-NATIVO.md`): telão/TV,
  `Presentation`, YouTube, cifra, PDF/`.pptx`, share e OTA não existem. Esses
  continuam no aparelho;
- **Chromium do Playwright, não o WebView do aparelho**: desenho sim, MEDIDA
  final não — nenhuma asserção de oráculo nasce daí;
- **o DISCO, não o HEAD**: lote sem commit de outra sessão aparece junto
  (`docs/MULTI-AGENTE.md`).

Aprovar na prévia não substitui os oráculos nem a conferência no aparelho: o
lote visual continua sendo lote — versão, notas, portão e release como qualquer
outro. A porta é 8097 (3080/3081/3083 são do harness) e o PNG vai para `~/tmp`,
nunca para o repositório.

### Os oráculos

Antes de publicar: `node --check` em todo `.js` de `assets/web`, validação do
`version.json`, e a suíte abaixo. **Na máquina de quem escreve, o portão é um
comando:** `tools/portao.sh` (Node puro + a Sanidade extraída DESTE workflow +
a cobertura nos dois sentidos) — o texto do workflow não se copia para lugar
nenhum.

#### O ARNÊS: `tools/arnes.mjs` e `tools/checar.mjs`

O preâmbulo (servidor estático, `TIPOS`, `checar`, o `chromium.launch` com o
`PW_CHROMIUM`) era COPIADO em 45 arquivos — 3.225 linhas —, e uma cópia é uma
chance de divergir. Divergiu em três lugares, nenhum deles com como acusar:
`checar` em SETE variantes (uma com dois parâmetros recebendo três, descartando o
`obtido` em silêncio), `TIPOS` em cinco (umas sem `.png`/`.woff2`, que caíam em
`application/octet-stream` e mudavam o `type` de um `Blob`), e viewport/`args`
herdados por cópia em vez de escolhidos.

- **`servirEstatico(raiz, antes)`** — o `antes` é a rota PRÓPRIA do oráculo:
  devolvendo `true` ela assumiu o pedido. É por ele que os quatro com fixture
  própria (`/semente` do OTA, `/baixado.wav`, `/pagina.png`, o espião do
  `display-smoke`) continuam donos do que servem. **Quem acrescentar um oráculo
  com rota própria a escreve aqui** — uma rota apagada não tem sintoma até o
  oráculo pedi-la.
- **`checar` mora em `tools/checar.mjs`, SEM uma linha de `import`**, e a
  separação NÃO é organização: o `arnes.mjs` importa o Playwright, e no workflow
  os oráculos de Node puro rodam no passo "Sanidade da base web", que vem
  **antes** do `npm ci`. Um deles importando o arnês passaria na máquina de quem
  escreve (onde `node_modules/` existe) e falharia só no runner, no passo sem
  `continue-on-error` — "a atualização não chega", por um
  `ERR_MODULE_NOT_FOUND` que nada no arquivo explica.
- **`esperar(pg, fn)` e `esperarDb(pg, fn)`** — ver abaixo. `porque(r)` devolve a
  frase do prazo para o terceiro argumento do `checar`.
- **`comTema(ctx, tema)` e `comModoAvancado(alvo)`** — os dois DECLARAM de que
  estado o oráculo parte, antes da primeira linha do app: o app abre sempre
  escuro-ou-o-guardado e SEMPRE no Modo Fácil, e quem mede uma tela do avançado
  diz que parte dele (escreve `sessionStorage` por `addInitScript`; `alvo` é um
  contexto ou uma página — o `sessionStorage` é por ABA). Ligar o avançado por
  `evaluate` depois da carga é uma corrida contra o `setAppMode(appMode)` do
  `init()`. O CONTRATO do modo (a chave legada ignorada, gravação só na sessão, a
  recarga atravessa, o app novo nasce simples) é o bloco D do
  `abertura-e-transferencia`, porque os onze que o declaram passariam também num
  app que voltasse a lembrar o modo.
- **O TOUR JÁ VISTO** (v1.14.0): todo contexto nascido do `abrirNavegador` grava `av.tour` com TODAS as chaves de `AVTour.chaves()` (o gancho embrulha a publicação do `window.AVTour`) — o véu do tour automático engole o toque. Quem mede o tour passa `abrirNavegador({ comTour: true })`.
- **Viewport e `args` são PARÂMETRO**, com o padrão do projeto (430×900). Quem
  quer outro o escreve, e aí está dito que foi escolha.

#### PRAZO NÃO É ASSERÇÃO — e isso é MEDIDO, não estilo

A suíte tinha **136 `waitForTimeout` somando 115 s**: um quarto do tempo dela era
sono. O pior caso: `stage-fade.test.mjs` esperava **17 s** para conferir que o
estilo do fade fora limpo — MEDIDO, ele é limpo em **3,1 s**.

- **`esperar(pg, fn, arg, prazo)`** espera pelo FATO e devolve `true` ou a FRASE
  `"(PRAZO, não veredito)"`. O estouro nunca vira veredito: uma reprovação por
  carga do runner chega indistinguível de um defeito do app, que é a primeira das
  cinco classes que a campanha da v5.316 teve de corrigir uma a uma.
- **`esperarDb` é a irmã para o que mora atrás de um `await`** (o IndexedDB):
  `waitForFunction` **não espera a Promise de um predicado `async`** — ela é
  *truthy* e a espera passa no primeiro quadro, aprovando o que veio verificar.
  O laço é do lado do Node.
- **Nem toda espera fixa é defeito, e as que ficaram estão explicadas.** Três
  casos legítimos: a asserção é uma AUSÊNCIA (esperar pelo que não deve
  acontecer é impossível — espera-se pelo fato que FECHA a janela); a asserção
  exige tempo de parede REAL (`tempo > t + 0,5` é meio segundo de áudio
  tocando); ou o que se espera é uma CARÊNCIA declarada do app
  (`PV_BUSY_SAIDA_MS`, 700 ms — esperar o cartão sair seria esperar pelo que se
  vai afirmar, a tautologia).

#### EM PARALELO, TRÊS DE CADA VEZ

**A conta do dia é do `tools/estado.sh`** (`oráculos: N arquivos · M de Node puro`);
nenhum número fixo de arquivos se escreve aqui — ele já envelheceu mentindo uma
vez (79/99 nesta prosa contra 82/101 no `apk.yml`). O CUSTO, esse é medido: a
suíte de Chromium soma **~13 min em série** e **~4,3 min nos três processos**
(4 vCPU, o mesmo do runner, revisão W3), e os de Node puro somam **8 s**. O custo
não é o que parece: lançar o navegador são **~110 ms** e
subir o `/controle/` inteiro é **~1 s** — compartilhar um navegador entre
oráculos, a otimização óbvia, economizaria 2% e custaria o isolamento. O que
sobra é espera, com os quatro núcleos ociosos.

**E O NÚMERO DE ORÁCULOS NÃO É O CUSTO — a distribuição é.** MEDIDO: os 52 mais
baratos somam **161 s dos 783 s**, e VINTE E TRÊS deles rodam em menos de 2 s
cada — apagar esses vinte e três devolveria **~9 s de parede** e custaria a
cobertura inteira que eles carregam.
O passo é caro por causa de uma DÚZIA de arquivos, e o que os encarece são
defeitos de arnês, não asserções a mais — dois deles pagaram 130 s sozinhos (o
stub da ponte, logo abaixo, e o piso da cortina, que o `esperarCortina` não paga —
[`NUCLEO`](NUCLEO-TECNICO.md#a-abertura-por-trás-dos-panos)). **A pergunta diante de um passo lento é "onde
está o tempo?", medida arquivo a arquivo, e nunca "quantos oráculos são?".**

É seguro por CONSTRUÇÃO, e foi conferido antes de ligar: todos abrem o servidor
com `listen(0)`, nenhum escreve arquivo temporário compartilhado, cada um lança o
próprio navegador com o próprio perfil. **TRÊS e não `nproc`**: o runner tem 4
vCPU e a campanha da v5.316 validou a suíte a 2× de carga — três fica DENTRO do
envelope já medido. **Subir este número é subir a carga, e a regra do projeto
vale aqui: repetir a campanha antes.**

O log é escrito em arquivo e impresso na ORDEM da lista — em paralelo os
`::group::` sairiam intercalados, e um log que não se lê não é rede de segurança.
**RC ausente conta como REPROVADO**: um oráculo cujo processo morreu sem escrever
o código de saída não pode entrar no placar como quem passou.

#### UM STUB DA PONTE QUE NÃO RESOLVE TRAVA 60 s, E NÃO DIZ NADA

A ponte falsa de um oráculo é uma allowlist: o método que está nela chama
`__avResolve`, e o que NÃO está devolve `undefined` e some. Do lado web a Promise
fica pendurada até o `CALL_TIMEOUT_MS` do `native.js`, que é **UM MINUTO** — e aí
ela resolve `null`, que quase sempre é o mesmo desfecho que a allowlist teria
produzido. **Nada reprova, nada aparece no log, e o oráculo só demora.**

MEDIDO: `pacoteDiag` faltava na allowlist do `abertura-e-transferencia`, o bloco
da badge chama `renderDiag()` (que o aguarda em `await`), e o arquivo gastava
**60,0 s dos 70,9 s** dele nessa linha — 7% do passo inteiro. Corrigido, o mesmo
arquivo com as MESMAS 21 asserções roda em **10,5 s**.

**A regra: método novo na ponte entra na allowlist do fixture no mesmo lote** —
e a varredura que responde "falta algum?" é o `tools/stub-da-ponte.test.mjs`
(Node puro, revisão A6): cruza quem o `native.js` chama com id (`B.<nome>(id`)
contra cada fixture e reprova o stub CONSTANTE (`takeShare: () => ''`) e o nome
preenchido pelo laço FORA do `comCallId` (num `Proxy`, qualquer nome). Método
AUSENTE do stub não trava: `B.x(id)` lança e o `call()` resolve `null` na hora. Um arquivo que demore um múltiplo
redondo de 60 s é este defeito até prova em contrário.

**Node puro, SEM `continue-on-error`** — reprovar aqui barra o build. **Chromium
de verdade, em DOIS PASSOS, e NENHUM dos dois pula** (decisão do operador,
2026-11-05: *"não permite que pule testes, independente do motivo"*):

| passo | `continue-on-error` | porque |
|---|---|---|
| `Preparar o Chromium` | **não**, desde 2026-11-05 | falhou (rede, CDN, imagem que o Playwright recusa) ou estourou os 10 min, o job `verificar` REPROVA e o bundle não sai. Era `sim` ("infraestrutura AUSENTE não segura o canal"), com um passo de AVISO no resumo — e nove runs de `main` publicaram sem oráculo de navegador, verdes, sem ninguém notar. Vermelho de infraestrutura se resolve repetindo o run |
| `Oráculos em Chromium` | **não**, desde a v5.316 | é o NOSSO código. Reprovar aqui derruba o job `verificar`, que é `needs` do `web-ota`: o bundle não chega à frota |

Só os dois passos de CACHE do Chromium são `continue-on-error` — eles não pulam
teste nenhum (cache frio = download).

**E há um TERCEIRO passo que usa o Chromium e NÃO é oráculo:** a medição da
revisão X3 (`tools/medicao-desempenho.mjs`), que roda só quando a mensagem do
commit carrega `[medicao]` e é `continue-on-error: true`. Ela mede (abertura,
heap sob status a 4 Hz, `getComputedStyle` por desenho, busca com o acervo
cheio) e devolve números para a etapa seguinte escolher onde mexer — não afirma
comportamento, então uma falha dela não pode segurar o canal de um lote que
também conserta. O porquê de cada medida está no topo do próprio arquivo.

Ele roda **todos SEMPRE** — nenhum aborta o próximo —, emite `::error::` por
reprovado e escreve o placar `N/M` no **resumo do run**. `N` e `M` são CONTADOS,
nunca digitados: um número fixo envelheceria no primeiro oráculo novo, e
envelheceria mentindo.

> Eles rodavam num passo só com `set -euo pipefail`: o PRIMEIRO reprovado
> abortava os outros, e como o passo era `continue-on-error` o run ficava
> **verde**. Descobrir isso exigia abrir o log e reparar onde ele parou.

> **A REDE EXTERNA NÃO ENTRA NUM ORÁCULO** (`tools/sem-rede.mjs`,
> `semRedeExterna(ctx)` logo depois de cada `newContext()`). A base web fala com
> a LouvorJA na carga — `pt_hymnal`, `pt_categories`, `pt_bible_*`, um
> `music_<id>` por faixa —, e **nada disso era interceptado**. Numa máquina sem
> saída para a internet as chamadas morrem e o oráculo é determinístico POR
> ACIDENTE; no runner elas RESPONDEM, o hinário real desaba sobre o acervo
> plantado pela fixture, e a asserção passa a medir o catálogo da LouvorJA. Foi
> assim que `smoke`, `boot-nativo` e `sorteio-tela` ficaram vermelhos no CI (12
> de 15) enquanto passavam na máquina de quem os escreveu — e, com o passo em
> `continue-on-error`, **sem ninguém notar**. Bloquear é seguro por construção:
> todos eles já passam onde toda saída falha, logo nenhum depende de terceiro.
> Fixture de terceiro que um oráculo queira exercitar entra por um `route()`
> **dele**, registrado depois (o Playwright resolve da mais recente para a mais
> antiga) e com o corpo escrito à mão.

> **Um servidor de mentira que diverge do de verdade não prova nada.** O
> `tela-rede` já entregou o HTML **sem a CSP** e com `?tela=1` na mão — provando
> o percurso num ambiente mais permissivo e por um caminho que o aparelho pode
> não receber. Isso escondeu dois defeitos ao mesmo tempo. Hoje ele injeta a
> marca do papel como o servidor injeta, manda a CSP verbatim e roda **sem query
> nenhuma**.

**JUnit** (`./gradlew testDebugUnitTest`, **sem `continue-on-error`**, antes do
`assembleRelease`) — testes de regra PURA: `EspelhoHttpTest` (tetos do parser,
`read()` parcial, `Host` fora da allowlist, `Origin` estranha, 404 uniforme),
`EspelhoParesTest` (prazo, teto de sessões, saneamento), `EspelhoHttpRangeTest`
(a gramática RFC 7233 do `alcanceDe` — malformado é IGNORADO e vira 200, nunca
adivinhado; é a **inversão da invariante 8** escrita como código),
`EspelhoMidiaCacheTest` (o token-capacidade da rota `/m/`),
`EspelhoInterfacesTest` (EM QUE INTERFACE o socket abre — em PARES, e o par que
carrega o arquivo é o `p2p-wlan0-0`/`192.168.49.1` do Wi-Fi Direct: privado, no
ar, sem `Network` que o reivindique, a forma EXATA que a regra procura, e no ar
durante todo culto com Miracast), `TrilhaAudioTest`
(qual trilha de áudio vai ao telão — o defeito mais silencioso deste caminho:
tudo funciona, e o testemunho está em inglês na frente da congregação; doze casos
**em pares**, o que a regra passou a recusar e o que ela não pode ter recusado
junto), `R2ImagemFonteTest` (a allowlist do bucket das fotos por COMPONENTE do
`URI`: sufixo, prefixo, subdomínio, `http` e URL ilegível — a invariante 2 pelo
lado do `fetch` que não manda CORS), `GuiaSomTest` (a cerca do `abrirGuia` e o marcador `?app=1`, shell 87: `https` + o host do site por componente do `URI`, em pares — prefixo, sufixo, subdomínio, porta, `userInfo`, `intent:`) e `CifraFonteTest` (a mesma invariante no
transporte da cifra, que confere o host na entrada E no destino FINAL depois dos
redirecionamentos; a reversão do predicado reprova 7 dos 9 casos), `SafJanelaTest`
(a janela de bytes do `/saf/`, shell 64: `available()` que mente e o `?r=` que
fatia) e `SlideDeckTest` (as duas metades PURAS do `SlideDeck` — a que lê o link e
a que apaga). **São onze classes** — a conta é do diretório, não desta prosa:
`ls app/src/test/java/br/org/iasd/av/`.
Só os seis primeiros (até o `TrilhaAudioTest`) rodam também fora do Gradle, no
`tools/junit-sem-rede.sh`, que recusa arquivo testado com `import android.*`;
`R2ImagemFonteTest`, `GuiaSomTest`, `CifraFonteTest`, `SafJanelaTest` e
`SlideDeckTest` testam função pura (ou quase) de arquivo que importa
`android.*` — o `GuiaSom.kt` mora junto do diálogo, e o `SlideDeck` desenha PDF —,
e rodam só no Gradle do CI.

## Os oráculos — o método

**As tabelas — o que cada oráculo trava — moram em [`ORACULOS.md`](ORACULOS.md);**
é REFERÊNCIA pura: consulte por `grep` ao mexer num oráculo, ao escrever um novo,
ou antes de "consertar" uma asserção. O que fica aqui é o MÉTODO, que vale para
todos.

- **LOCALMENTE SE RODA SÓ A VIZINHANÇA DO LOTE; A SUÍTE INTEIRA É DO CI**
  (decisão do operador, 2026-10-15). Antes do commit: os oráculos de Chromium
  que tocam o que o lote mexeu (e os vizinhos que leem o mesmo estado), TODOS os
  de Node puro e a *"Sanidade da base web"* — é o `tools/portao.sh`, e ele é o
  ÚLTIMO passo antes do commit. A suíte de Chromium completa roda no `verificar`
  de `main`, que já é o portão do `web-ota`: um vermelho ali segura o bundle, não
  o publica. **Reprovou no CI, o lote não acabou** — `verificar` vermelho = o
  bundle não saiu ⇒ conserto no MESMO número; já publicado ⇒ número novo; nunca
  `revert` nem `push --force` em `main` (o rito, passo 10).

- **O PORTÃO É UM COMANDO, e ele roda o texto do workflow sem copiá-lo:**

  ```bash
  tools/portao.sh                       # Node puro + Sanidade + a lista do CI
  tools/portao.sh app/src/main/assets/web/controle/controle.js  # + sintaxe e vizinhança
  tools/portao.sh <arq> --vizinho tools/x.test.mjs   # a vizinhança escolhida
  ```

  **Vizinho é só oráculo de Chromium** (`*.test.mjs` não puro e os dois smoke)
  que cita o arquivo — os puros já rodam inteiros. **Acima de 8 ele não
  escolhe:** lista e reprova até a escolha vir por `--vizinho` (o `controle.js`
  passa dele); `--vizinhanca-inteira` tira o teto. Copiar o bloco da Sanidade
  seria a divergência que o arnês existe para fechar: o script o extrai do
  próprio `.github/workflows/apk.yml` a cada execução.

- **Teste que não está no workflow é documentação, não rede de segurança** — a
  linha do `rodar` entra no MESMO lote que o arquivo. O modo de falhar é sempre
  o mesmo: o run fica verde porque ninguém o roda. *Um oráculo que não roda é
  pior que oráculo nenhum: ele responde a pergunta "isso está coberto?" com um
  sim que não existe.* A varredura é arquivo a arquivo, **nos dois sentidos**:

  ```bash
  comm -3 <(ls tools/*.test.mjs | sort) \
          <(grep -oE 'tools/[a-z0-9.-]+\.test\.mjs' .github/workflows/apk.yml | sort -u)
  ```

- **E A LISTA DO CI NÃO É `tools/*.test.mjs`.** O `smoke.mjs` e o
  `display-smoke.mjs` medem o RENDERIZADO e não têm esse sufixo: um runner que
  filtre por ele os pula em silêncio e devolve placar cheio. **A conferência é
  nos DOIS sentidos**, e o passo 4 do `portao.sh` a faz com `comm -3` entre
  `ls tools/*.test.mjs` e os caminhos que o `apk.yml` cita. O conjunto puro é a
  mesma lista do disco menos quem **importa** o arnês ou uma dependência do
  `package.json` — por `from '…'` ou `import('…')`, nunca pela menção ao nome (o
  furo de 2026-11-13: o `docs-coerentes` NOMEIA o arnês num Set; o de 14/11: o
  import dinâmico do `acorn` no `nome-inexistente` escapava). O passo 2 roda os
  puros que a Sanidade não roda; os dela, no passo 3:

  ```bash
  comm -23 <(ls tools/*.test.mjs | sort) \
           <(grep -lE "(from |import\()'(\./)?(arnes\.mjs|playwright|acorn)'" tools/*.test.mjs | sort)
  ```

  **A conta do dia quem imprime é o `tools/estado.sh`** (`oráculos: N arquivos ·
  M de Node puro`) — nenhum número de oráculo se escreve aqui, porque envelhece
  no primeiro arquivo novo.

- **E OS ORÁCULOS NÃO SÃO O PASSO INTEIRO.** A *"Sanidade da base web"* é um
  bloco de shell DENTRO do workflow e trava o que não está em `tools/` nenhum: a
  forma do `version.json`, o `minShell` contra o `SHELL_VERSION` lido do próprio
  Kotlin, o `shellTag` batendo com a versão, as três casas do número e o **teto
  de 120 caracteres por item do `notas.json`** (*"a lista do diálogo é uma linha
  do tempo, não um texto"*). Rodar só os oráculos devolve placar cheio e reprova
  no CI.

- **A REVERSÃO É UM PASSO, NÃO UMA BOA PRÁTICA.** Toda asserção nova roda
  **duas vezes** antes do commit: com o conserto, e com ele desfeito. Sem isso
  ela pode ser uma TAUTOLOGIA — passar nas duas versões. **Uma asserção que não
  pode reprovar o defeito que ela nomeia é pior que asserção nenhuma.**

  **A reversão escolhe a CÉLULA e a RÉGUA, não o bom senso.** A maioria das
  asserções geométricas não alcança a decisão em qualquer largura — e medir
  `scrollWidth` de um `<span>` para provar que o rótulo não é cortado nunca
  acusa nada: o span é do tamanho do texto, e quem estoura é o PAI. Quando a
  reversão passa, a pergunta não é *"a asserção está errada?"* — é *"que célula,
  e medindo o quê?"*. E ela também acha declaração que não faz nada: um
  `min-width: max-content` que não movia um pixel, porque um item flex já nasce
  com `min-width: auto` e o `white-space: nowrap` já É o rótulo inteiro.

- **A REVERSÃO SE DESFAZ COM UMA CÓPIA, NUNCA COM O GIT.** `git checkout
  <arquivo>` restaura do HEAD e **apaga o trabalho não commitado do lote inteiro
  naquele arquivo**. `tools/reverter.sh --guardar <arquivos>` antes de mexer, e
  `--restaurar <dir>` para desfazer — a cópia é mais barata que a tentação.

- `node --check` prova que o arquivo é PARSEÁVEL, não que o app funciona. O canal
  OTA publica direto para a frota e o watchdog **não evita o primeiro estrago**
  (`beginSession()` arma o `pending` e SERVE o bundle; só o lançamento seguinte
  descarta): um lançamento quebrado por aparelho, garantido.

> **Os casos que criaram estas regras** — os quatro oráculos esquecidos, o
> `notas.json` de 127 caracteres, as tautologias, o `min-width` — estão em
> [`revisao/CASOS-MEDIDOS.md`](revisao/CASOS-MEDIDOS.md). É apêndice, como o
> `HISTORICO.md`: consulta-se por `grep`, não por leitura.

#### UM ORÁCULO NÃO PODE MEDIR O RUNNER

**O veredito do CI tem de ser função só do nosso código.** A geometria medida em
pixel (`getBoundingClientRect` de um texto, o `scrollWidth` de um rótulo) depende
da FONTE que o navegador resolve — DejaVu no runner, outra no aparelho de quem
escreve. Um oráculo que mede isso passa numa máquina e reprova na outra, e o
reparo que ele sugere ("ajuste 1,2 px") é ruído: o número do runner não é o do
aparelho.

A régua certa é a PROPRIEDADE — quem está à esquerda de quem, se o elemento
cabe, se o texto está sobre a cor —, não o pixel exato; quando o pixel é
inevitável (contraste, sombra), ele é medido contra o fundo e com a folga
declarada. **Reprovou só nesta máquina e passa no runner? É esta classe até
prova em contrário**, e o conserto é a campanha de fontes do CI, não o app (os
três oráculos desta classe estão no `docs/RESIDUOS.md`).

## Assinatura

Releases saem **assinadas com keystore fixa** (secrets `KEYSTORE_B64`,
`KEY_ALIAS`, `KEY_PASSWORD`). É isso que permite **atualizar por cima sem
desinstalar** — e sem perder a biblioteca, que vive em IndexedDB/OPFS e o Android
apaga junto com o app.

- O `.jks` **nunca é versionado**; o build o materializa do secret. Decodificação
  com `Base64.getMimeDecoder()`, **não** o BASIC: o `base64` do GNU quebra linha
  a cada 76 caracteres, e o BASIC lança diante de qualquer `\n` (`trim()` só
  limpa as pontas).
- Sem os secrets (build local, PR de terceiro), cai na assinatura de **debug** e
  tudo compila — só não serve para atualizar por cima.
- **Publicar exige a chave:** o passo de Release passa `-PrequireSigning=true` e o
  Gradle reprova a ausência. A guarda anterior deduzia da existência de
  `app-release.apk` e era **código morto** — o AGP só acrescenta `-unsigned`
  quando a variante não tem signingConfig NENHUM, e o fallback de debug atribui
  um. Saía uma Release assinada com a `debug.keystore` do runner **daquela
  execução**: `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, com desinstalar como única
  saída.
- **Cinto e suspensório:** o CI pergunta ao `apksigner` quem assinou e falha se
  achar `CN=Android Debug` (fixo na chave de debug, então o teste é exato).
- **`versionCode` vem da CONTAGEM DE COMMITS** (`git rev-list --count HEAD`) mais
  um deslocamento de 100000 — daí o `fetch-depth: 0` (clone raso devolveria 1).
  Não vem de `github.run_number`, que conta por WORKFLOW: renomear o `apk.yml`
  reiniciaria em 1 e forçaria desinstalar. Se um `versionCode` publicado chegar
  perto do deslocamento, **aumente**-o, nunca o diminua. O `versionName` vem da
  tag.
- **No disparo manual, o checkout usa `main`** — senão o APK sairia de uma branch
  de trabalho enquanto a tag aponta para `main`. (`target_commitish` só é usado
  para CRIAR a ref quando ela não existe; no fluxo com `git push --tags` ele não
  faz nada.)
- **`retag`** (desligado por padrão) apaga Release e tag antes de recriá-las — é o
  único jeito de MOVER uma tag publicada. Fica atrás de input próprio de
  propósito: mover tag é destrutivo e não pode ser efeito colateral.
- Perder a keystore é irreversível.

## Backup com regras

`res/xml/backup_rules.xml` e `res/xml/data_extraction_rules.xml` —
`allowBackup="true"` sozinho leva tudo, e **quatro** coisas não podem ir —
todas fora da nuvem; da transferência direta, as três primeiras:

- **`files/web-ota/` e `shared_prefs/web-ota.xml`** — o bundle extraído e o
  ponteiro para ele, isto é, **CÓDIGO** que roda no origin privilegiado com
  acesso a `__AVBridge`. Um backup adulterado plantaria JS arbitrário sem passar
  por nenhuma das três garantias (não há download, nem `sha256`, e `minShell` só
  existe no caminho do download). Nada ali precisa sobreviver à troca de
  aparelho.
- **`files/espelho-tls/` e `shared_prefs/espelho-tls.xml`** — a **chave privada**
  do certificado do telão na rede e a senha com que ela foi reescrita
  (`EspelhoCert.kt`). Uma chave restaurada de um backup adulterado é um servidor
  falando com a identidade da igreja — e, ao contrário do bundle OTA, ela não se
  reconstrói sozinha. Perdê-la ao trocar de aparelho custa reemitir e
  reimportar, que é o preço certo.
- **`files/pacote/`** — o `.avpkg` que espera o seletor de compartilhamento
  (shell 67): uma cópia temporária do acervo, do tamanho dele, que a faxina do
  app apaga no lançamento seguinte.
- **`app_webview/`** — IndexedDB/OPFS, que passa de gigabytes. **É a única das
  quatro que VAI na transferência direta** — sai só da nuvem.

A diferença entre os destinos é deliberada: o backup em **nuvem** tem cota de
25 MB (com `app_webview` dentro ele não protegia a biblioteca e ainda arriscava
reprovar o backup inteiro); a **transferência direta** não tem cota, e ali copiar
a biblioteca é o que o operador quer ao trocar de celular. Por isso `app_webview`
só sai da nuvem. **São dois arquivos porque o Android mudou o formato** (o antigo
vale da API 26 à 30, o novo da 31 em diante) — qualquer exclusão nova entra nos
dois.

Rodar local: `./gradlew assembleDebug` (exige Android SDK).

---

## A página do site

- **SEMPRE deixar a PÁGINA anunciando a versão que acabou de sair.** Ela é a
  única coisa deste projeto que fala com quem **ainda não instalou** — e o modo
  de errar dela não é ficar fora do ar: é continuar linda, continuar respondendo
  e anunciar um número que não é o que está publicado. Quem lê não tem como
  conferir, e conclui que o app parou de ser mantido.

  **Isto é automático, e o trabalho é NÃO QUEBRAR o automático:** o `pages.yml`
  se encadeia por `workflow_run` no *Build APK* e publica sozinho a cada lote
  que chega em `main`. Cada peça vem de onde ela é verdade:

  | o que a página mostra | de onde sai | por quê |
  |---|---|---|
  | a VERSÃO | `version` do **manifesto do canal OTA** | é o que o aparelho vai rodar. A tag da Release fica parada em todo lote só de web, e o `version.json` do repositório pode estar segurado pelo `shellTag` |
  | o TAMANHO e a URL | o `.apk` da **Release** | é o que se baixa |

  **Não trocar `workflow_run` por `on: release`** — evento criado com o
  `GITHUB_TOKEN` padrão não dispara workflow (o guarda de recursão do GitHub;
  ver [`NUCLEO-TECNICO.md`](NUCLEO-TECNICO.md#ota-da-base-web-atualização-sem-apk)).
  Foi assim que a página serviu o APK da Release ANTERIOR.

  **Conferir depois de publicar**, porque o run verde não prova o número: o passo
  *"A versão que o aparelho vai rodar"* imprime `Base web publicada: X (APK: Y)`,
  e um `::warning::` no resumo significa que o manifesto não foi lido e a página
  saiu com a versão do APK — correta, velha, e indistinguível de estar tudo bem.

  **E TODO CAMINHO DENTRO DE `site/` É RELATIVO** (`telas/biblia.webp`, nunca
  `/telas/biblia.webp`), e **essa regra já se pagou**. O Pages servia de
  `jonathasptbr-gh.github.io/Audio-Visual-IASD/`, com PREFIXO de caminho; o
  domínio próprio **[audiovisualiasd.com.br](https://audiovisualiasd.com.br/)**
  serve da RAIZ. Todo link absoluto funcionava e teria quebrado na troca — **e
  quebrado calado**, porque quem responde é o 404 do GitHub, não um erro nosso.
  Com tudo relativo, o mesmo build passou a servir os dois endereços sem uma
  linha alterada, e a migração foi o DNS mais o `site/CNAME`. A regra continua
  valendo pelo mesmo motivo: **o endereço pode mudar de novo, o `site/` não**.

  **E NA PÁGINA O RECURSO SE CHAMA "CONECTAR UM COMPUTADOR"** (v1.8.51), a
  pedido do operador: *"use apenas termos diretos relacionados a 'conectar a um
  computador via navegador'… não quero algo genérico como rede ou aparelho, ou
  navegador"*. O computador é o SUJEITO que recebe a projeção e o navegador é o
  MEIO; "telas da rede" e "outra tela" não voltam ao texto visível — e o
  espelhamento na TV é OUTRA coisa, que não pode virar "computador". Oráculo:
  `site-grade-e-carrossel.test.mjs`, bloco C.

  **E O DOWNLOAD SÓ EXISTE NO ANDROID.** O app é um `.apk`, e um `.apk` só
  instala em Android: quem chega de iPhone, iPad ou computador não vê o guia de
  instalação — vê, no MESMO ponto da página, uma frase dizendo que este é um
  aplicativo Android, que ele não serve computador nem iPhone/iPad, e que a
  página deve ser aberta por um aparelho Android. **O endereço não é repetido
  ali**: quem lê a frase já ESTÁ na página, e mandá-lo copiar o que acabou de
  abrir é trabalho para dizer o que ele já sabe. O resto da página fica: as
  funções, as telas e os modos de uso são verdade em qualquer aparelho, e uma
  página que se apaga inteira não explica nada a ninguém.

  **A PERGUNTA É BINÁRIA — é Android, ou não é.** Uma frase só serve os três
  casos, e por isso não há classificação de iOS: nem regex de `iPhone`, nem o
  `maxTouchPoints` que separaria o iPadOS 13+ (que se anuncia como
  **Macintosh**) de um Mac. Um aparelho da Apple cai no lado certo **por
  construção** — nenhum deles tem `Android` no `userAgent` —, e é isso que faz
  o desenho ficar mais robusto ao encolher: ele passou a depender só do
  positivo. *Uma armadilha some quando a pergunta que a criava deixa de ser
  feita.*

  **Três coisas sustentam isso, e a terceira é a que decide o desenho:**

  | peça | onde | por quê |
  |---|---|---|
  | a classificação | um `<script>` INLINE no `<head>`, que escreve `plat-android` ou `plat-outro` no `<html>` | esconder no `DOMContentLoaded` mostra o botão de baixar por um quadro antes de tirá-lo, e é exatamente aí que a pessoa toca |
  | o `display:none` | CSS, sobre `.so-android` (o guia **e** o tamanho do arquivo, que é atributo do download) | um link escondido assim sai da árvore de acessibilidade E da ordem de tabulação — não é um botão discreto, é um botão que não existe |
  | **a falha ABERTA** | a ausência de uma regra: sem classe no `<html>`, nada é escondido | script bloqueado ou uma exceção não prevista devolvem a página de antes. Falhar FECHADO inverteria o custo do erro para o lado que não se paga — um Android de verdade sem botão de baixar e sem nada na tela dizendo por quê |

  **`section + section` conta irmãos NO DOM, e um irmão `display:none` continua
  contando** — sem o `margin-top:0` do primeiro bloco VISÍVEL, o guia nasce com
  o vão de uma seção inteira sob a faixa da marca. Não erra alto: o que sai é um
  respiro grande demais, que ninguém relata e ninguém explica.

  O sinal de Android vem de DUAS fontes (`userAgent` e
  `userAgentData.platform`), a segunda ADITIVA: ela só pode resgatar um caso,
  nunca criar um. **O falso positivo conhecido está dito e não tem conserto
  barato:** um Android com "site para computador" ligado no Chrome perde a
  palavra `Android` do `userAgent` e cai no aviso — que continua sendo a
  instrução certa, só que redundante. Oráculo: `plataforma.test.mjs`, com os
  `userAgent` VERBATIM (o iPad entre eles, sem código próprio: a asserção
  guarda a PROPRIEDADE, não o mecanismo) e a falha aberta em asserção própria.

## As dependências

- **Sem dependências externas** — Kotlin puro + AndroidX no shell, JavaScript
  puro no web. **Cinco exceções, todas declaradas:**

  | dependência | por que é inevitável |
  |---|---|
  | **`@aiden0z/pptx-renderer`** (`assets/web/vendor/`, Apache-2.0, `import()` dinâmico) | o Android **não desenha PowerPoint**: a plataforma só traz o `PdfRenderer`, as libs nativas são comerciais ou limitadas a 3 páginas, converter num servidor mandaria o material do culto para fora do aparelho, e escrever DrawingML à mão daria um slide PARECIDO com o que o pastor montou — pior que slide nenhum. Levantamento completo no `LEIA-ME.md` da pasta |
  | **`NewPipeExtractor`** | extrair a URL de um vídeo do YouTube é acompanhar as defesas deles (PO Tokens por vídeo, assinados por BotGuard/DroidGuard). A alternativa sem dependência — servidor público — FALHOU em aparelho: eles rodam em IP de datacenter, exatamente o que o YouTube bloqueia. E a conta é paga por quem publica: o SABR que derrubou o 1080p foi resolvido lá (cliente visionOS) e chegou aqui como **um bump de versão**. Manter o pin explícito e ler o CHANGELOG antes de reescrever extração à mão |
  | **JUnit** (`testImplementation`) | **não põe um byte no APK**. Existe porque o servidor das telas é **a primeira fronteira de rede do projeto** — um parser HTTP com controle de acesso, onde um erro não vira pixel errado, vira controle de acesso quebrado. Escrevê-lo sem oráculo, num repositório que recusa o RFC 6455 **por falta de oráculo**, seria o argumento aplicado contra ele mesmo |
| **Playwright** (`package.json`, `devDependencies`) | **também não põe um byte no APK** — é o arnês dos oráculos de Chromium, e a única forma de exercitar o que só existe RENDERIZADO (contraste, escada de camadas, hit-test, o telão de verdade). Ele já era usado; o que mudou é que passou a ser **declarado e PINADO**: o `package.json` e o `package-lock.json` são versionados e o CI usa `npm ci`. Sem o pin, o passo instalava a `latest` do dia e o veredito do CI não era função só do nosso código — o que tornava impossível o passo BARRAR o build, e desde a v5.316 ele barra. **Subir o pin obriga a repetir a campanha de determinismo** (ver "Um oráculo não pode medir o runner") |
  | **`acorn`** (`package.json`, `devDependencies`) | **não põe um byte no APK** — é o parser de JavaScript de dois instrumentos: o `nome-inexistente.test.mjs` (a chamada a um nome que não existe em lugar nenhum, que o `node --check` não vê) e o `tools/miolo.mjs` (o mapa do `controle.js`). Percorrer a árvore pede um parser, e escrever um à mão seria o defeito; sem dependências próprias. Só existe depois do `npm ci`: por isso o filtro dos puros conta o `import('acorn')` (o `ferramentas.test.mjs` cobra que toda `devDependency` esteja nele) |

  Uma sexta exceção precisa da mesma justificativa: um problema que não se
  resolve de outro jeito, e a manutenção paga por quem publica a biblioteca.

## Um `apk` reprovado não pula o `web-ota`

> **UM `apk` REPROVADO NÃO PULA O `web-ota` — QUEM SEGURA É O HOLD.** A
> confusão é fácil e custou um lote inteiro de raciocínio errado: o `web-ota`
> tem `needs: [verificar, apk]`, mas o `if:` dele é `!cancelled() &&
> needs.verificar.result == 'success'` — **o resultado do `apk` é
> deliberadamente ignorado**, e o `needs` está lá pela ORDEM (o passo que
> consulta a Release precisa rodar depois de quem a publica). O job RODA com o
> `apk` vermelho. O que impede a publicação é o HOLD do `shellTag`, cuja
> Release o build que falhou não chegou a criar — e por isso o desfecho é um
> job VERDE que não publicou, com o motivo no resumo do run. Foi assim com a
> v1.8.6. A conclusão prática continua a mesma (**um lote que toca `java/`
> confere o `apk`**); o mecanismo é este, e está escrito no comentário do
> próprio `web-ota`, vinte linhas acima do `if:`.
