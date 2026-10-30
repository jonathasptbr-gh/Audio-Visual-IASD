# Build, distribuição e os oráculos por dentro

O workflow, o arnês dos oráculos, os passos do CI, a assinatura, o backup, a
página do site e as dependências declaradas. **As regras de MÉTODO dos oráculos
(a vizinhança local e a suíte no CI, a lista do workflow, a "Sanidade da base
web", a reversão de asserção e a reversão por cópia) ficam no `CLAUDE.md`**, que
é lido em toda sessão; o que cada oráculo trava está em
[`ORACULOS.md`](ORACULOS.md).

> **Movido do `CLAUDE.md` na revisão A2 (2026-10-30), sem mudança de texto** (só os links relativos e o nível dos títulos). No núcleo ficou um resumo com o link para cá. "Acima", "abaixo", "esta seção" e as invariantes numeradas falam do `CLAUDE.md`, de onde este texto veio.

## Build e distribuição

`.github/workflows/apk.yml` — o runner `ubuntu-latest` já traz JDK e Android SDK;
nenhuma infraestrutura externa.

| Rota | Como | Observação |
|---|---|---|
| Artifact | Actions → run → *Artifacts* | vem como **.zip**; precisa descompactar no celular |
| **Release** ⭐ | `git tag v1.0.1 && git push --tags` | **link direto para o .apk** |
| Release manual | Actions → *Build APK* → *Run workflow*, com `release_tag` | a tag é criada pelo próprio workflow |

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
sem transação: duas execuções em paralelo (o merge seguido de um push de
correção é o caso normal) intercalariam, e cancelar no meio do upload produz o
mesmo estado. Ver "OTA" para o que o nome versionado do zip fecha.

### Os oráculos

Antes de publicar: `node --check` em todo `.js` de `assets/web`, validação do
`version.json`, e a suíte abaixo.

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
  os 21 oráculos de Node puro rodam no passo "Sanidade da base web", que vem
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

Os de Chromium são **132** e os de Node puro **23** — juntos, os 155 (contados na v1.13.16). MEDIDO com
82 deles: **~13 min em série** e **~4,3 min nos três processos** (4 vCPU, o mesmo
do runner); os de Node puro somam **8 s**. **Os números moram no `apk.yml`**, ao
lado do passo que descrevem, e esta é a cópia — divergiram uma vez (79/99 aqui
contra 82/101 lá) e a varredura que os fecha é contar o `rodar` do workflow. O custo não é o que parece: lançar o navegador são **~110 ms** e
subir o `/controle/` inteiro é **~1 s** — compartilhar um navegador entre
oráculos, a otimização óbvia, economizaria 2% e custaria o isolamento. O que
sobra é espera, com os quatro núcleos ociosos.

**E O NÚMERO DE ORÁCULOS NÃO É O CUSTO — a distribuição é.** MEDIDO: os 52 mais
baratos somam **161 s dos 783 s**, e VINTE E TRÊS deles rodam em menos de 2 s
cada — apagar esses vinte e três devolveria **~9 s de parede** e custaria a
cobertura inteira que eles carregam. **Os números moram no `apk.yml`**, ao lado
do passo que eles descrevem, e esta é a cópia: divergiram uma vez (79/99 aqui
contra 82/101 lá), e quem decide sobre o passo lê esta.
O passo é caro por causa de uma DÚZIA de arquivos, e o que os encarece são
defeitos de arnês, não asserções a mais — dois deles pagaram 130 s sozinhos (ver
as duas armadilhas logo abaixo). **A pergunta diante de um passo lento é "onde
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
e a varredura que responde "falta algum?" é comparar quem o `native.js` resolve
por `call()` contra a allowlist de cada oráculo. Um arquivo que demore um múltiplo
redondo de 60 s é este defeito até prova em contrário.

**As tabelas — o que cada oráculo trava — moram em
[`docs/ORACULOS.md`](ORACULOS.md).** São 127 linhas de REFERÊNCIA: ninguém as
lê inteiras, e ninguém deveria. Abra o capítulo para mexer num oráculo, escrever
um novo, ou entender por que uma asserção existe antes de "consertá-la". O que
fica aqui é o MÉTODO, que vale para todos eles.

**Node puro, SEM `continue-on-error`** — reprovar aqui barra o build. **Chromium
de verdade, em DOIS PASSOS,** e a ASSIMETRIA entre eles é a política:

| passo | `continue-on-error` | porque |
|---|---|---|
| `Preparar o Chromium` | **sim** | é o CDN de outra pessoa. Um download quebrado lá fora não pode calar a atualização de uma igreja — os oráculos são pulados (`if: steps.chromium.outcome == 'success'`) e um passo de AVISO escreve o pulo no resumo, senão ele fica indistinguível de um run em que tudo passou |
| `Oráculos em Chromium` | **não**, desde a v5.316 | é o NOSSO código. Reprovar aqui derruba o job `verificar`, que é `needs` do `web-ota`: o bundle não chega à frota |

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
`assembleRelease`) — os arquivos PUROS: `EspelhoHttpTest` (tetos do parser,
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
junto).

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
`allowBackup="true"` sozinho leva tudo, e **três** coisas não podem ir:

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
  reconstrói sozinha. **É a única exclusão que sai também da transferência
  direta:** perdê-la ao trocar de aparelho custa reemitir e reimportar, que é o
  preço certo.
- **`app_webview/`** — IndexedDB/OPFS, que passa de gigabytes.

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
  `GITHUB_TOKEN` padrão não dispara workflow (o guarda de recursão do GitHub; ver
  a seção do OTA). Foi assim que a página serviu o APK da Release ANTERIOR.

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
  puro no web. **Quatro exceções, todas declaradas:**

  | dependência | por que é inevitável |
  |---|---|
  | **`@aiden0z/pptx-renderer`** (`assets/web/vendor/`, Apache-2.0, `import()` dinâmico) | o Android **não desenha PowerPoint**: a plataforma só traz o `PdfRenderer`, as libs nativas são comerciais ou limitadas a 3 páginas, converter num servidor mandaria o material do culto para fora do aparelho, e escrever DrawingML à mão daria um slide PARECIDO com o que o pastor montou — pior que slide nenhum. Levantamento completo no `LEIA-ME.md` da pasta |
  | **`NewPipeExtractor`** | extrair a URL de um vídeo do YouTube é acompanhar as defesas deles (PO Tokens por vídeo, assinados por BotGuard/DroidGuard). A alternativa sem dependência — servidor público — FALHOU em aparelho: eles rodam em IP de datacenter, exatamente o que o YouTube bloqueia. E a conta é paga por quem publica: o SABR que derrubou o 1080p foi resolvido lá (cliente visionOS) e chegou aqui como **um bump de versão**. Manter o pin explícito e ler o CHANGELOG antes de reescrever extração à mão |
  | **JUnit** (`testImplementation`) | **não põe um byte no APK**. Existe porque o servidor das telas é **a primeira fronteira de rede do projeto** — um parser HTTP com controle de acesso, onde um erro não vira pixel errado, vira controle de acesso quebrado. Escrevê-lo sem oráculo, num repositório que recusa o RFC 6455 **por falta de oráculo**, seria o argumento aplicado contra ele mesmo |
| **Playwright** (`package.json`, `devDependencies`) | **também não põe um byte no APK** — é o arnês dos oráculos de Chromium, e a única forma de exercitar o que só existe RENDERIZADO (contraste, escada de camadas, hit-test, o telão de verdade). Ele já era usado; o que mudou é que passou a ser **declarado e PINADO**: o `package.json` e o `package-lock.json` são versionados e o CI usa `npm ci`. Sem o pin, o passo instalava a `latest` do dia e o veredito do CI não era função só do nosso código — o que tornava impossível o passo BARRAR o build, e desde a v5.316 ele barra. **Subir o pin obriga a repetir a campanha de determinismo** (ver "Um oráculo não pode medir o runner") |

  Uma quinta exceção precisa da mesma justificativa: um problema que não se
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
