# Claude Code — APP Áudio Visual IASD (Android nativo)

App Android nativo do sistema de projeção de mídia para culto (IASD). É uma
**casca em Kotlin** que hospeda a base web do projeto em dois WebViews e usa
`android.app.Presentation` para mandar **só o Display** para a TV — sem
espelhar o celular.

> **Este repositório é autossuficiente.** A base web
> (`app/src/main/assets/web/`) foi copiada do PWA original e **agora vive
> aqui**: não há checkout cruzado, submódulo nem dependência de build do
> repositório do PWA. A arquitetura completa está em
> [`docs/ARQUITETURA-WEB.md`](docs/ARQUITETURA-WEB.md).
>
> **Caminhos neste arquivo são relativos à RAIZ do clone.** O bundle web mora
> em `app/src/main/assets/web/` e o Kotlin em
> `app/src/main/java/br/org/iasd/av/`; onde um caminho aparecer curto
> (`controle/controle.js`), a raiz dele é `app/src/main/assets/web/`.

## Índice

**Este arquivo é o CONTRATO: o que se decide antes de tocar em nada.** Ele é
lido inteiro em toda sessão; o que é de uma ÁREA (shell, ponte, OTA, telão,
paleta) mora em [`docs/NUCLEO-TECNICO.md`](docs/NUCLEO-TECNICO.md), e cada
seção daqui diz quando abri-lo. A dieta anterior — e o mapa do que saiu — está
em [`docs/revisao/A2-INVENTARIO.md`](docs/revisao/A2-INVENTARIO.md).

**As três primeiras e as regras de desenvolvimento são leitura de toda
sessão; o resto é consulta, aberta quando a tarefa pede.**

| # | seção | quando abrir |
|---|---|---|
| 1 | [A conversa com o operador](#a-conversa-com-o-operador) | **sempre** |
| 2 | [O estado se mede, não se cita](#o-estado-se-mede-não-se-cita) | ao começar a sessão |
| 3 | [O ganho: Presentation em vez de espelhamento](#o-ganho-presentation-em-vez-de-espelhamento) | entender o app em uma tela |
| 4 | [Estrutura do repositório](#estrutura-do-repositório) | achar o arquivo |
| 5 | [Build e distribuição](#build-e-distribuição) | CI, Release, o portão |
| 6 | [Os oráculos — o MÉTODO](#os-oráculos--o-método) | escrever ou consertar oráculo |
| 7 | [Regras de desenvolvimento](#regras-de-desenvolvimento) | **antes de commitar** |

**O que é de uma área — abra só a área da tarefa:**

| área | onde | quando |
|---|---|---|
| invariantes do shell, ponte, filas | [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#invariantes-do-shell-não-quebrar) | **antes de mexer no Kotlin** |
| OTA, atualização sem APK | [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#ota-da-base-web-atualização-sem-apk) | mexer no `WebUpdater` |
| telão nas telas da rede | [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#telão-por-comandos-o-telão-nas-telas-da-rede-local) | as telas da igreja |
| paleta, cor, toque, camadas | [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#a-paleta) | **antes de escrever qualquer cor** |
| divergências web × nativo | [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#divergências-entre-o-caminho-web-e-o-nativo) | o que muda entre navegador e app |
| séries, cifra, pacote, abertura | [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md) | esses recursos |
| Verificação do Sistema, Registro | [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#diagnóstico) · [`DIAGNOSTICO`](docs/DIAGNOSTICO.md) | diagnóstico |

**Fora daqui** (o resumo tem o que se quebra sem abrir o capítulo; o capítulo
tem o resto):

| arquivo | o que é |
|---|---|
| [`docs/ESTRUTURA.md`](docs/ESTRUTURA.md) | a árvore anotada do repositório |
| [`docs/shell/README.md`](docs/shell/README.md) | o HUB do **Kotlin**, um capítulo por subsistema |
| [`docs/ARQUITETURA-WEB.md`](docs/ARQUITETURA-WEB.md) | o HUB da base web e o mapa dos capítulos |
| [`docs/arquitetura/MIOLO.md`](docs/arquitetura/MIOLO.md) | **o mapa do `controle.js`**: pergunte nele antes de abrir o arquivo (`node tools/miolo.mjs`) |
| [`docs/BUILD.md`](docs/BUILD.md) | arnês, prazos, CI, assinatura, backup, a página do site |
| [`docs/ORACULOS.md`](docs/ORACULOS.md) | **referência**: o que cada oráculo trava |
| [`docs/HISTORICO.md`](docs/HISTORICO.md) | **apêndice**: a nota de cada versão, por `grep` |
| [`docs/revisao/CASOS-MEDIDOS.md`](docs/revisao/CASOS-MEDIDOS.md) | **apêndice**: os casos que criaram as regras do portão |
| [`docs/ACHADOS-EM-ABERTO.md`](docs/ACHADOS-EM-ABERTO.md) | defeitos CONFIRMADOS em aberto — hoje **nenhum** |
| [`docs/PEDIDOS-EM-ESPERA.md`](docs/PEDIDOS-EM-ESPERA.md) | a fila do operador, em pacotes |

**Apêndices congelados** — `docs/AUDITORIA-2026-08.md`,
`docs/AUDITORIA-2026-09-11.md`, `docs/AUDITORIA-EFICIENCIA-2026-09.md`,
`docs/AUDITORIA-ESTABILIDADE-AV.md` e `docs/revisao/REGISTRO.md`: um retrato de
uma data, consultado por `grep` — as decisões que saíram deles estão no núcleo e
no `HISTORICO.md`.

## A conversa com o operador

**Quem lê o que sai desta sessão não programa.** Ele opera o app num culto, e a
pergunta dele é sempre a mesma: *mudou o quê, e eu preciso fazer alguma coisa?*

| regra | o que é |
|---|---|
| **NÃO NARRAR O TRABALHO** | nada de "vou conferir", "agora vou editar", "encontrei o arquivo". A sessão fala DUAS vezes: para perguntar o que não dá para decidir sozinha, e para ENTREGAR |
| **O RELATÓRIO É PARA LEIGO** | sem nome de arquivo, de função, de tecnologia ou de número interno. O que mudou, dito pelo que ele VÊ ou FAZ no app |
| **ECONOMIA DE PALAVRAS** | frases curtas, sem preâmbulo e sem fecho de cortesia. Um relatório de dez linhas que se lê vale mais que um de cinquenta que se pula |
| **DETALHE SÓ SOB PEDIDO** | ele pergunta, e aí vem o técnico inteiro, sem economia |
| **ESPERAR É MUDO** | *"pode ocultar as mensagens e logs que não sejam seu relatório final"*. Enquanto um agente delegado trabalha, a sessão NÃO escreve "aguardando", "ainda rodando", "o agente continua". Isso não é narrar o trabalho: é narrar a AUSÊNCIA de trabalho, e sai dezenas de vezes seguidas |
| **A ETAPA É DITA, EM UMA LINHA** | *"me atualizasse nas mensagens sobre em qual etapa estamos… bem genéricas… em 4 ou 5 etapas… assim eu consigo perceber se algo está errado, ou se sequer está tendo progresso ou algo travou"* (2026-10-28). Cinco etapas fixas — **1 Planejando · 2 Executando · 3 Testando · 4 Publicando · 5 Conferindo** — e UMA linha a cada troca de etapa (ex.: *"Pacote 4: etapa 3 de 5, testando."*), sem detalhe. Com agente delegado em segundo plano, um check-in a cada ~15 min (`send_later`) confere o estado e manda a linha; é a única exceção ao "esperar é mudo", e ela não vira narração: nada além da etapa |

**AS DUAS COISAS QUE NUNCA SE OMITEM** — são elas que impedem "sucinto" de virar
"só a parte boa":

- **O QUE ELE PRECISA FAZER.** Instalar, esperar, reiniciar, conferir no
  aparelho — ou nada. Um relatório que diz *"pronto"* sobre o que só chega
  instalando o APK é FALSO, e o preço disso aparece no sábado de manhã.
- **O QUE NÃO DEU CERTO.** Falha é dita, com o que falhou. Pedaço de escopo que
  ficou de fora é dito, com o porquê. Encolher o trabalho em silêncio é o pior
  desfecho que uma sessão sabe produzir.

**O QUE NÃO DÁ PARA APAGAR, e fica dito para ninguém tentar:** as linhas de
ferramenta que aparecem na tela durante o trabalho são do PROGRAMA, não do texto
da sessão — nenhuma regra de escrita as suprime. **O que as encolhe é DELEGAR:**
o que roda dentro de um agente aparece como UM cartão no lugar de trinta linhas.
Por isso a tarefa substantiva nasce delegada — é economia de LEITURA do
operador, não gosto por paralelismo.

**E ISTO VALE PARA O CHAT, JAMAIS PARA A DOCUMENTAÇÃO.** O `CLAUDE.md`, os
`docs/` e as mensagens de commit continuam técnicos, densos e cheios de nome de
símbolo: eles são lidos por um AGENTE, antes do trabalho, e é essa densidade que
economiza a sessão seguinte. O `notas.json` é o único arquivo do repositório que
fala com o operador, e ele já tem regra própria (um tópico por linha, teto de 120
caracteres). **Aplicar linguagem de leigo à documentação destrói o
`HISTORICO.md`** — e o que se perde ali não volta.

---

## O ganho: Presentation em vez de espelhamento

O Miracast espelha **a tela do celular**. Foi essa limitação que gerou toda a
arquitetura web original: dois apps separados, comunicação por
BroadcastChannel, a preview como reimplementação do Display e dois players do
YouTube tocando ao mesmo tempo.

```
┌──────────────────────┐        ┌─────────────────────────────┐
│  Celular (Activity)  │        │  TV (Smart View/MiraScreen) │
│  WebView "controle"  │  ◄──►  │  Presentation + WebView     │
│  /web/controle/      │  IDB   │  /web/display/              │
│  portrait            │   +    │  resolução nativa da TV     │
└──────────────────────┘   BC   └─────────────────────────────┘
        MESMO PROCESSO · MESMO ORIGIN · MESMO IndexedDB/OPFS
```

Os dois WebViews rodam no mesmo processo e no mesmo origin
(`https://appassets.androidplatform.net/`), então **compartilham IndexedDB,
OPFS e BroadcastChannel exatamente como os dois PWAs compartilhavam no
navegador**. É por isso que `shared/db.js`, `shared/stage.js` e todo o
protocolo de comandos seguem praticamente inalterados.

**Sem TV conectada o app continua útil:** nenhuma Presentation é criada e a
projeção volta a ser a preview do Controle em tela cheia (o mesmo fallback do
PWA, hoje com a COLUNA de controles no lugar dos gestos invisíveis).

---

## Estrutura do repositório

**A árvore ANOTADA — o que cada arquivo faz e se recusa a fazer — está em
[`docs/ESTRUTURA.md`](docs/ESTRUTURA.md);** o mapa Kotlin está em
[`docs/shell/README.md`](docs/shell/README.md) e o da base web em
[`docs/ARQUITETURA-WEB.md`](docs/ARQUITETURA-WEB.md). **Uma árvore só:** o
detalhe é do arquivo dono — o mapa abaixo não o repete.

```
app/src/main/            # o Android: manifest, java/ (o shell) e assets/web/
  assets/web/            # a base web versionada aqui: shared/ · controle/ · display/ ·
                         # espelho/ · vendor/ · version.json · notas.json
  java/br/org/iasd/av/   # um .kt por subsistema (mapa: docs/shell/README.md)
  res/                   # drawable, mipmap-anydpi-v26, values (colors.xml ESPELHA tokens)
docs/                    # os capítulos; a árvore anotada em docs/ESTRUTURA.md
site/                    # a página pública (GitHub Pages)
tools/                   # o arnês e os oráculos; a lista do CI sai do workflow
```

**31 arquivos Kotlin, uma dependência de terceiros no shell** — o resto é
AndroidX oficial (`core-ktx`, `activity-ktx`, `webkit`). O que sustenta essa
proporção Kotlin × JavaScript é a invariante 5; ela é o argumento contra
Capacitor/Cordova, que arrastariam npm e um build system inteiro e ainda assim
exigiriam código nativo próprio para a `Presentation`.

> Números envelhecem a cada commit. **Meça antes de citá-los:**
> `wc -l app/src/main/java/br/org/iasd/av/*.kt` ·
> `find app/src/main/assets/web -name '*.js' -not -path '*/vendor/*' | xargs wc -l`

## O estado se mede, não se cita

Número congelado em prosa envelhece em horas — e a sessão que o lê decide com
dado velho. **Meça antes de citar:**

```bash
tools/estado.sh          # HEAD, árvore, as quatro casas da versão, CI, fila
```

Ele imprime o que muda sozinho (versão, HEAD, CI, token) e é a única fonte
desses números numa sessão. O que **não** muda sozinho, e por isso vale
escrever em prosa, está nas seções abaixo.

## Invariantes do shell (não quebrar)

**Movido.** As nove invariantes — e **quem** trava cada uma — estão em [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#invariantes-do-shell-não-quebrar). A que mais custa: servir por `https://appassets.androidplatform.net/`, **nunca** `file://`, e um único origin para os dois WebViews.

### Reconexão e morte do renderer

**Movido.** Em [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#reconexão-e-morte-do-renderer). A regra que se esquece: **"há tela" não é "há telão"**.

## A ponte `window.AVNative`

**Movido.** O catálogo, os quatro globais, as filas e as regras estão em [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#a-ponte-windowavnative). O contrato que se paga caro: **superfície é privilégio do Controle** — o telão nasce com `host = null` e sem o `/saf/`.

### `SHELL_VERSION` — subir SEMPRE que a superfície mudar

**Movido.** O degrau corrente e o piso estão em [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#shell_version--subir-sempre-que-a-superfície-mudar). A regra do rito: mudou a superfície (forma de retorno conta), sobe o degrau e o lote é **APK + web juntos**, com `shellTag`.

### As SEIS filas da ponte — escolher a errada é uma regressão muda

**Movido.** A tabela das seis filas (`io`, `transferencia`, `apk`, `extracao`, `cifra`, `r2img`) está em [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#as-seis-filas-da-ponte--escolher-a-errada-é-uma-regressão-muda).

## Barramento de comandos e o plano B do BroadcastChannel

**Movido.** Relay, dreno do papel `tela`, a preview que ILUSTRA e o `load` em [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#barramento-de-comandos-e-o-plano-b-do-broadcastchannel).

## Trabalho em segundo plano (downloads com o app minimizado)

**Movido.** FGS, wake lock, cota do Android 15 e as rotinas que cedem a vez em [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#trabalho-em-segundo-plano-downloads-com-o-app-minimizado). O que não se pode esquecer: **`startForeground` SEMPRE**, antes de qualquer decisão de parar.

## Notificação de controles (sessão de mídia)

**Movido.** O `MediaSession` e a notificação em [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#notificação-de-controles-sessão-de-mídia). **`play`/`pause` ≠ `playpause`**: tratar tudo como alternador pausa o louvor.

## OTA da base web (atualização sem APK)

**Movido.** O canal, o watchdog e as três garantias em [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#ota-da-base-web-atualização-sem-apk). A que segura a frota: **`shellTag` declarada sem Release segura o canal para sempre, em silêncio** — e a Release se dispara depois do merge.

## Telão por comandos (o telão nas telas da rede local)

**Movido.** O contrato inteiro em [`docs/TELAO-POR-COMANDOS.md`](docs/TELAO-POR-COMANDOS.md); o resumo das peças em [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#telão-por-comandos-o-telão-nas-telas-da-rede-local).

## Séries do YouTube (os álbuns oficiais da Biblioteca)

**Movido.** Em [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#séries-do-youtube-os-álbuns-oficiais-da-biblioteca) e [`docs/recursos/SERIES.md`](docs/recursos/SERIES.md). A regra de ouro: **a playlist prova o pertencimento, o título é só rótulo.**

## A aba de cifra (acordes ao lado da letra)

**Movido.** Em [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#a-aba-de-cifra-acordes-ao-lado-da-letra) e [`docs/recursos/CIFRA.md`](docs/recursos/CIFRA.md). **Sob demanda é o contrato, não uma otimização.**

## O pacote de transferência (o acervo num arquivo)

**Movido.** Em [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#o-pacote-de-transferência-o-acervo-num-arquivo) e [`docs/recursos/PACOTE.md`](docs/recursos/PACOTE.md). **Importar só acrescenta** — e é o `fim`, não o tamanho, que separa pacote inteiro de cortado.

## A abertura por trás dos panos

**Movido.** Em [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#a-abertura-por-trás-dos-panos). Todo oráculo que toca na tela espera a cortina **depois de CADA carga**.

## A paleta

**Movido.** Os pares medidos e as regras duras em [`NUCLEO-TECNICO.md#a-paleta`](docs/NUCLEO-TECNICO.md#a-paleta) e em [`docs/arquitetura/DESIGN-SYSTEM.md`](docs/arquitetura/DESIGN-SYSTEM.md). **Cor nova entra em `tokens.css`, nunca literal na folha.**

## Divergências entre o caminho web e o nativo

**Movido.** A tabela navegador → app está em [`NUCLEO-TECNICO`](docs/NUCLEO-TECNICO.md#divergências-entre-o-caminho-web-e-o-nativo); cada ponto por extenso em [`docs/DIVERGENCIAS-WEB-NATIVO.md`](docs/DIVERGENCIAS-WEB-NATIVO.md). Toda guarda é `if (!window.__NATIVE__)`: o navegador é o padrão.

## Build e distribuição

`.github/workflows/apk.yml` — o runner `ubuntu-latest` já traz JDK e Android
SDK. **As rotas de publicação, o `web-ota` (sem filtro de caminho e com fila), o
arnês, os prazos, o paralelismo, o stub que trava 60 s, os dois passos de
Chromium, a rede externa bloqueada, o JUnit, a assinatura e o backup estão em
[`docs/BUILD.md`](docs/BUILD.md).** O que se quebra sem abrir:

- **Release:** `git tag vX && git push --tags`, ou *Build APK* → *Run workflow*
  com `release_tag`. O `web-ota` roda com fila e sem cancelamento
  (`concurrency: web-ota`), e sem filtro de caminho por decisão.
- **O arnês** (`tools/arnes.mjs`): `servirEstatico(raiz, antes)`, `esperar` e
  `esperarDb` (**prazo não é asserção**: o estouro devolve a frase, nunca o
  veredito; `waitForFunction` não espera a Promise de um predicado `async`),
  `comTema` e `comModoAvancado` (declaram o estado de partida). **`checar` mora
  em `tools/checar.mjs`, SEM `import`**: os oráculos de Node puro rodam antes do
  `npm ci`.
- **Três processos em paralelo, não `nproc`**: subir o número é subir a carga e
  obriga a repetir a campanha. Diante de um passo lento, a pergunta é "onde está
  o tempo?", arquivo a arquivo — nunca "quantos oráculos são?".
- **Método novo na ponte entra na allowlist do fixture no mesmo lote** — um stub
  que não resolve trava 60 s calado (um arquivo que demore um múltiplo redondo de
  60 s é este defeito até prova em contrário).
- **Node puro, "Preparar o Chromium", "Oráculos em Chromium" e JUnit BARRAM o
  build — NENHUM teste é pulado, por motivo nenhum** (operador, 2026-11-05):
  infraestrutura que falha reprova o job e se resolve repetindo o run. **A rede externa não entra num oráculo**
  (`semRedeExterna(ctx)` depois de cada `newContext()`), e um servidor de mentira
  não diverge do de verdade.
- **Assinatura:** keystore fixa por secrets, `-PrequireSigning=true` na Release e
  o `apksigner` reprovando `CN=Android Debug`; `versionCode` = contagem de
  commits + 100000. Perder a keystore é irreversível.
- **Backup:** ficam de fora o bundle OTA, a chave do TLS e `app_webview/` (este
  só da nuvem) — exclusão nova entra nos DOIS arquivos de regras.

### Os oráculos — o MÉTODO

**As tabelas — o que cada oráculo trava — moram em
[`docs/ORACULOS.md`](docs/ORACULOS.md);** é REFERÊNCIA pura: consulte por
`grep` ao mexer num oráculo, ao escrever um novo, ou antes de "consertar" uma
asserção. O que fica aqui é o MÉTODO, que vale para todos.

- **LOCALMENTE SE RODA SÓ A VIZINHANÇA DO LOTE; A SUÍTE INTEIRA É DO CI**
  (decisão do operador, 2026-10-15). Antes do commit: os oráculos de Chromium
  que tocam o que o lote mexeu (e os vizinhos que leem o mesmo estado), TODOS
  os de Node puro (~8 s) e a *"Sanidade da base web"*. A suíte de Chromium
  completa roda no `verificar` de `main`, que já é o portão do `web-ota` — um
  vermelho ali segura o bundle, não o publica. **Reprovou no CI, o lote não
  acabou:** conserta, repete a vizinhança e empurra de novo.

- **O PORTÃO É UM COMANDO, e ele roda o texto do workflow sem copiá-lo:**

  ```bash
  tools/portao.sh                       # Node puro + Sanidade + a lista do CI
  tools/portao.sh controle/controle.js  # + a vizinhança que cita o arquivo
  ```

  Copiar o bloco da Sanidade seria a divergência que o arnês existe para fechar:
  o script o extrai do próprio `.github/workflows/apk.yml` a cada execução.

- **Teste que não está no workflow é documentação, não rede de segurança** — a
  linha do `rodar` entra no MESMO lote que o arquivo. O modo de falhar é sempre
  o mesmo: o run fica verde porque ninguém o roda, e o oráculo novo passa a
  existir só no repositório. *Um oráculo que não roda é pior que oráculo
  nenhum: ele responde a pergunta "isso está coberto?" com um sim que não
  existe.* A varredura é arquivo a arquivo, **nos dois sentidos** (o
  `portao.sh` imprime esta conta):

  ```bash
  comm -3 <(ls tools/*.test.mjs | sort) \
          <(grep -oE 'tools/[a-z0-9.-]+\.test\.mjs' .github/workflows/apk.yml | sort -u)
  ```

- **E A LISTA DO CI NÃO É `tools/*.test.mjs`.** O `smoke.mjs` e o
  `display-smoke.mjs` medem o RENDERIZADO e não têm esse sufixo: um runner que
  filtre por ele os pula em silêncio e devolve placar cheio. A lista certa sai
  do workflow, e o `portao.sh` usa exatamente esta:

  ```bash
  grep -oE 'tools/[a-z0-9._-]+\.mjs' .github/workflows/apk.yml | sort -u \
    | grep -vE 'arnes|checar|sem-rede|pares-de-comentario'
  ```

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
  pode reprovar o defeito que ela nomeia é pior que asserção nenhuma:** ela
  responde *"isso está coberto?"* com um sim que não existe.

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

- `node --check` prova que o arquivo é PARSEÁVEL, não que o app funciona. O
  canal OTA publica direto para a frota e o watchdog **não evita o primeiro
  estrago** (`beginSession()` arma o `pending` e SERVE o bundle; só o lançamento
  seguinte descarta): um lançamento quebrado por aparelho, garantido.

> **Os casos que criaram estas regras** — os quatro oráculos esquecidos, o
> `notas.json` de 127 caracteres, as tautologias, o `min-width` — estão em
> [`docs/revisao/CASOS-MEDIDOS.md`](docs/revisao/CASOS-MEDIDOS.md). É apêndice,
> como o `HISTORICO.md`: consulta-se por `grep`, não por leitura.

---

## Regras de desenvolvimento

### Entrega

- **SEMPRE fazer merge com `main` ao terminar.** Trabalhar na branch designada é
  o meio, não o fim: o OTA publica a partir de `main` (`if: github.ref ==
  'refs/heads/main'`) e as Releases nascem de `main`.

  ```bash
  git add <arquivos> && git commit -m "vX.Y.Z: <descrição>"
  git push -u origin <branch>
  git checkout main && git merge <branch> --no-ff -m "Merge: <resumo>"
  git push origin main          # ← sem isto, nada chega aos aparelhos
  ```

- **O APK NÃO É RECURSO RESTRITO** (diretriz do operador, 2026-10-30: *"sempre
  que for necessário uma nova versão do APK, faça. O OTA é o principal meio de
  atualização, mas o APK não é um elemento exclusivo ou restrito, pode usar
  conforme a necessidade normalmente"*). Quando o conserto CERTO mora no Kotlin,
  ele é feito no Kotlin, no mesmo lote, com `shellTag` e Release — nunca se
  entrega um contorno só de web no lugar dele, nem se deixa a metade do shell
  "para depois". O OTA continua sendo o caminho normal para o que é web.
- **SEMPRE gerar uma Release quando o SHELL mudar.** O merge entrega só a **base
  web** — o OTA carrega `assets/web/` e mais nada. `java/`, `AndroidManifest.xml`,
  `res/`, `build.gradle.kts` e os workflows **só chegam instalando um APK**, e o
  pior caso é silencioso: um método novo da ponte faz o web se comportar de um
  jeito no código e de outro no culto, porque lá o `SHELL_VERSION` é o antigo.

  **A primeira linha vem ANTES do merge:** declarar a tag em `version.json`.

  ```jsonc
  { "version": "1.0.1", "minShell": 46, "shellTag": "v1.0.1" }
  ```

  Com ela o `web-ota` SEGURA o bundle até a Release existir e, quando ela sai,
  republica o manifesto **com o link do APK dentro** — o app pergunta uma vez
  sobre o lote inteiro. Sem `shellTag` o bundle sai na hora, que é o certo para
  um lote só de web. Depois do push em `main`: Actions → *Build APK* → Run
  workflow, com `release_tag` = a MESMA tag do `version.json` (a tag é criada
  pelo workflow, a partir de `main`). **Não esperar o operador pedir.**

  **`shellTag` esquecido não quebra nada, mas desfaz o ganho** (o aparelho recebe
  a metade web sozinha). **`shellTag` apontando para uma tag que nunca sai é
  pior:** o canal fica segurando para sempre, em silêncio, e a única pista é a
  linha no resumo do run.

- **A NOTA DO LOTE SE ESCREVE UMA VEZ, e ela mora no `docs/HISTORICO.md`.**
  Ela chegou a ser escrita QUATRO vezes — mensagem de commit, entrada no
  histórico, bloco no `CLAUDE.md` e `notas.json` —, e o bloco do `CLAUDE.md`
  saiu na faxina de 2026-09-07. Das três que sobram, duas são **o mesmo texto**:
  a mensagem de commit e a entrada do histórico.

  **A ordem que resolve:** escreva a entrada do `HISTORICO.md` PRIMEIRO — ela é
  a versão longa, é o que se lê por `grep` meses depois, e é a que o oráculo
  cobra. A **mensagem de commit fica curta** (o que mudou e por quê, em algumas
  linhas) e não repete a narrativa. O `notas.json` é outra coisa e continua
  sendo escrito à parte: ele fala com o OPERADOR, num tópico por linha.

  Foi a fricção de escrever duas vezes que produziu o defeito real: **doze
  versões publicadas ficaram sem nota nenhuma no apêndice**, entre elas a v1.7.7
  — o lote que removeu a transmissão direta. Hoje o
  `tools/docs-coerentes.test.mjs` reprova o build quando uma versão do
  `notas.json` não tem entrada lá.

- **SEMPRE deixar a PÁGINA anunciando a versão que acabou de sair.** É
  automático (`pages.yml`, por `workflow_run` no *Build APK*; a VERSÃO vem do
  manifesto do canal OTA, o tamanho e a URL do `.apk` da Release), e o trabalho é
  NÃO QUEBRAR o automático: não trocar `workflow_run` por `on: release`;
  conferir o passo *"A versão que o aparelho vai rodar"* depois de publicar (um
  `::warning::` ali é a página com a versão do APK); todo caminho dentro de
  `site/` é RELATIVO; na página o recurso se chama "conectar um computador"; e o
  download só existe no Android (classificação BINÁRIA no `<head>`, com falha
  ABERTA). **Por extenso em [`docs/BUILD.md`](docs/BUILD.md)**, seção "A página
  do site".

### A entrega delegada

**Toda tarefa substantiva nasce delegada** — e o que decide o custo dela é o
briefing, não o agente:

- **Teto e ponto de parada.** O briefing declara o escopo, um teto de passos e,
  quando o pedido chega como **suspeita** ("defeito a confirmar"), a parada
  obrigatória: voltar com a causa achada **antes** de consertar. No Pacote 3
  (2026-11-10) a suspeita era falsa e o agente escreveu 348 linhas de oráculo no
  caminho errado — 205 passos e US$ 1,5–3,6 para uma correção de 31 linhas.
- **Saída de ferramenta magra** é regra, não estilo: `head`/`tail` no que pode
  ser longo, UM caso do oráculo em vez do arquivo inteiro, log só de erro. O
  resultado de ferramenta é o maior item do contexto e é RELIDO a cada passo —
  no Pacote 3, 582 kB de `bash` contra 107 kB de `read`, em 189 chamadas.
- **Custo ≈ passos × contexto médio**, e 99% do que entra é cache: cortar PASSO
  vale mais que escrever menos. O anexo técnico do lote fecha com a medição
  (`node ~/.dsh-github/uso.mjs` — passos, cache lido, faixa); sem ela o gasto só
  aparece quando o operador pergunta.

### Código

- **Nunca perder funcionalidades ao refatorar.** A base web tem o sistema de
  culto inteiro — ver `docs/ARQUITETURA-WEB.md` e os capítulos em `docs/arquitetura/`.
- **Todo código novo em `assets/web/` continua rodando no navegador**: caminhos
  nativos entram como `if (!window.__NATIVE__) { …web… }`.
- **Toda operação IDB multi-passo que precise de atomicidade usa `storeTx()`.**
  Para uma chave de `state`, o pronto é **`AVDB.updateState(chave, fn)`** — ler,
  calcular e gravar numa transação só, com `fn` **síncrona** (um `await` lá
  dentro deixa a transação fechar sozinha e a atomicidade some em silêncio). O
  par `getState` + calcular + `setState` é o defeito, não o atalho: duas
  transações com um vão entre elas, e quem lê primeiro grava por último. Já
  mordeu duas vezes — o diário da varredura das séries (metade do bloco do
  Registro sumia) e as intenções de download (o vídeo não era reclamado depois
  de o renderer morrer). O sintoma dos dois é a AUSÊNCIA de sintoma.
- **Ao mudar a superfície da ponte, subir `SHELL_VERSION` e atualizar a seção "A
  ponte".**
- **Cor nova entra em `shared/tokens.css`**, nunca literal na folha do app — e
  nunca branco pleno fora do palco.
- **Sem dependências externas** — Kotlin puro + AndroidX no shell, JavaScript
  puro no web. **Quatro exceções, todas declaradas:** `@aiden0z/pptx-renderer`
  (`assets/web/vendor/`, `import()` dinâmico), `NewPipeExtractor` (pin
  explícito; ler o CHANGELOG antes de reescrever extração à mão), JUnit e
  Playwright (estes dois sem um byte no APK; subir o pin do Playwright obriga a
  repetir a campanha de determinismo). A justificativa de cada uma está em
  [`docs/BUILD.md`](docs/BUILD.md), seção "As dependências". Uma quinta exceção
  precisa da mesma justificativa: um problema que não se resolve de outro jeito,
  e a manutenção paga por quem publica a biblioteca.

### Diagnóstico

**Movido.** As regras da Verificação do Sistema e do Registro estão em [`NUCLEO-TECNICO.md#diagnóstico`](docs/NUCLEO-TECNICO.md#diagnóstico) e em [`docs/DIAGNOSTICO.md`](docs/DIAGNOSTICO.md). **O aparelho é a última palavra.**

### Documentação

Esta documentação é lida por um agente, a cada sessão, **antes** de qualquer
trabalho. Prosa custa contexto que não sobra para o código.

- **Aqui entra o que VALE HOJE; em `docs/HISTORICO.md`, o que explica POR QUÊ.**
  Ao publicar, a nota do lote vai para lá (topo + uma linha no índice). Neste
  arquivo só se mexe quando uma REGRA muda — e então **corrija a regra**, não
  acrescente um parágrafo dizendo que ela mudou.
- **Regra e armadilha ficam; a narrativa do achado sai.** Vale escrever "o
  `optBoolean` lê ausente como `false`, que é valor legítimo" — isso muda o
  próximo diff. Não vale escrever como o defeito foi encontrado, quem relatou,
  nem o que se pensou antes.
- **Uma medição que sustenta uma decisão fica** (`2,73:1`, `60 req/hora`); uma
  medição de algo já corrigido vai para o histórico.
- **Nada de lápide dentro do código.** Comentário descreve o que está ali — se
  ele explica um mecanismo removido, ou contradiz o código, é armadilha: quem o
  ler vai procurar (ou reintroduzir) o que ele promete.
- **Prefira tabela a lista, e lista a parágrafo.** Prefira o nome do símbolo a
  descrevê-lo por extenso.
- **APAGAR CÓDIGO É APAGAR O QUE O DESCREVE, NO MESMO LOTE.** Esta é a regra
  que a limpeza da v5.299/v5.300 comprou caro: cada remoção de recurso (v5.156,
  v5.187, v5.189, v5.212) deixou comentários de pé, e eles não envelheceram
  calados — passaram a AFIRMAR coisas falsas. Duas guardas de segurança
  justificavam a si mesmas por um motivo que já não existia, o que é o convite
  exato para o próximo leitor removê-las. **Um comentário errado é pior que um
  comentário longo: ele não custa só leitura, produz a decisão errada.** Ao tirar
  um recurso, `grep` pelo nome dele em `assets/web/` e `java/` **e** nos
  capítulos de `docs/arquitetura/` antes de fechar o lote.
- **O que nasce hoje nasce no padrão.** Comentário novo entra condensado — não
  se escreve largo esperando uma poda futura, porque a poda custa uma sessão
  inteira e a escrita custa uma linha.
- **ESTE ARQUIVO NÃO GUARDA LOG DE LOTE.** Um lote publicado escreve a nota no
  `docs/HISTORICO.md` (a seção `## vX — título` logo abaixo do índice, e no
  índice UMA linha sem a nota, até 400 caracteres — o `docs-coerentes` cobra) e, AQUI, só corrige a REGRA que mudou — **no lugar dela**. Se o lote
  não muda regra nenhuma, este arquivo não muda.

  **O formato é o defeito**: um bloco por lote é um log, e um log só cresce. A
  casa da regra permanente é a seção canônica ou a TABELA DE ORÁCULOS — e uma
  regra sem casa é enxertada lá ANTES de o bloco sair.

**Ao atualizar o código:** atualizar este arquivo se a mudança afetar
arquitetura, protocolo de comandos ou a ponte; o CAPÍTULO certo de
`docs/arquitetura/` se afetar a arquitetura de `assets/web/`.

**`docs/ARQUITETURA-WEB.md` é HUB, e não recebe corpo.** Ali ficam as regras que
valem para a base inteira, a estrutura de arquivos, o build e a TABELA que diz
qual capítulo abrir. Assunto novo grande é **arquivo novo** em `docs/arquitetura/`
mais uma linha na tabela — nunca uma seção a mais no hub, que é o formato de que
ele acabou de sair (um arquivo de 490 KB em que uma pergunta sobre a Bíblia
custava carregar o Controle inteiro).

**Poda de comentário se PROVA, não se confere de olho — e são DUAS provas.**

1. **O código não mudou.** Remova os comentários dos dois lados, normalize o
   espaço em branco e compare com `git show <ref>:<arquivo>`. É a defesa contra
   apagar uma linha de código junto com o parágrafo que a explicava — e ela
   também prova, no fim do lote, que um lote de documentação é **só web** e não
   precisa de Release.
2. **Cada comentário continua sobre o que ele explica.**
   `node tools/pares-de-comentario.mjs <arquivo> <ref>` casa os blocos pelo
   cabeçalho e reprova quando um deles passou a encabeçar outro símbolo.

**A prova 1 é CEGA à troca de lugar, e por isso a 2 existe.** Remover os
comentários dos dois lados e comparar aprova uma **rotação completa** dos
blocos: foi o que a v5.300 fez com o `display.js` (commits `4ed5061` e
`da615b8`), onde oito blocos andaram uma casa e cada um passou a explicar a
função errada — o bloco do relógio da origem foi parar dentro do
`telaAplicarWallpaper`, e o da pré-carga do wallpaper, sobre o `agoraDaOrigem`.
As duas mensagens de commit afirmavam "código inalterado (verificado por remoção
de comentários contra HEAD)", e estavam certas: o método é que não via.

**Um comentário no lugar errado é pior que um comentário removido: ele responde,
e responde errado.**

### O NÚMERO: `MAIOR.INCREMENTAL.CORREÇÃO`

Três componentes, e cada um responde a uma pergunta diferente. **Nunca se sobe
um degrau "porque já mudou bastante": sobe-se o degrau que o LOTE justifica.**

| degrau | quando sobe | exemplo |
|---|---|---|
| **MAIOR** (`1`.x.y) | **só sob mudança fundamental de CONCEITO**, e por decisão explícita de quem publica. Não é acúmulo de recursos — é o app deixar de ser o que era | `1.x.y` → `2.0.0` |
| **INCREMENTAL** (x.`2`.y) | uma **seção inteiramente nova** do app: um lugar que não existia, com tela e fluxo próprios | `1.0.7` → `1.1.0` |
| **CORREÇÃO** (x.y.`3`) | correções e ajustes menores — o caso NORMAL, e o que a maioria dos lotes é | `1.0` → `1.0.1` |

**Ao subir um degrau, os de baixo ZERAM:** depois de `1.4.9`, uma seção nova é
`1.5.0`, nunca `1.5.9`. Um número que não zera passa a contar duas coisas ao
mesmo tempo e deixa de responder qualquer uma delas.

**ARMADILHA MEDIDA: `1.1` e `1.1.0` são a MESMA versão** para o OTA, e vale para
todo número de DOIS componentes. O `compareVersions` completa com zero o que
falta, então republicar a `1.1` como `1.1.0` não é atualização nenhuma — o
aparelho ignora, em silêncio. **O primeiro degrau depois de um número de dois
componentes é o `.1`**: depois da `1.0` veio a `1.0.1`, e depois da `1.1` vem a
`1.1.1`.

> A comparação é **numérica por componente**, nunca lexical: `1.0.10` é MAIOR que
> `1.0.9`. É o mesmo motivo pelo qual `4.9 < 4.82` como string seria errado — a
> regra vale para os três degraus.

**As DUAS LINHAS usam o mesmo número, e podem ficar em degraus diferentes.** A
base web sobe a cada lote (chega por OTA em minutos); o APK só sobe quando um
lote exige Release. Um `web v1.0.7 · shell v1.0.3` no REGISTRO não é divergência —
é a resposta exata a *"o OTA chegou e o APK ainda não?"*. **Desde a v1.7.0 essa
resposta mora só lá:** a tela mostra um número, e é o da base web.

### A versão mora em TRÊS lugares, e os três precisam andar juntos

| Onde | O quê | Para quê |
|---|---|---|
| `assets/web/version.json` | `"version"` | **faz a atualização chegar aos aparelhos**: o OTA compara este campo (`compareVersions`) e ignora, em silêncio, um bundle cuja versão não seja maior que a instalada |
| `controle/controle.js` | `WEB_VERSION` | **é o que a UI mostra**: `renderVersionLabel()` escreve a ÚNICA casa que sobrou, o rótulo de versão (`#versaoBtn`, texto ao lado do título) no CABEÇALHO de Configurações — foi o rodapé da folha e, na v1.12.49, a Verificação (a badge do cabeçalho do Cronograma saiu na v1.8.66, para o botão de limpar a lista, e a do Modo Fácil na v1.11.15, para o nome do app) |
| `controle/index.html` | `<span id="appVersion">` | o que aparece antes do primeiro render — e a única versão visível num shell sem `appVersion()` |

Esquecer o `WEB_VERSION` é o erro **silencioso** (o bundle novo chega e o
aparelho exibe a versão antiga, justamente a leitura que serve para diagnosticar
se o OTA chegou); esquecer o `version.json` é o erro **mudo** do outro lado (nada
chega a aparelho nenhum). O `versionCode`/`versionName` do APK vêm do CI.

**Versão atual: base web v1.13.65 · APK v1.13.50** · `SHELL_VERSION` **86** ·
bundle com `minShell: 83` e **sem `shellTag`** — a v1.13.56 é só web, e a Release
da v1.13.50 já está publicada. O **PISO** continua **83**:
nada novo é exigido do web, e a superfície não mudou desde a X1 — a X2 apagou o
proxy da transmissão direta sem tocar no contrato da ponte. O que cada lote
trouxe está no `docs/HISTORICO.md`, nunca aqui.

- **O `shellTag` ACOMPANHA A ÚLTIMA VERSÃO, NÃO A QUE MEXEU NO KOTLIN** — o CI
  exige `shellTag == 'v' + version`. Um lote só de web publicado DEPOIS de um
  lote de shell ainda sem Release HERDA a obrigação (zerá-lo publicaria o bundle
  sozinho e deixaria o conserto do shell para trás, calado); com a Release já
  publicada, um lote só de web não declara. **Conferir a Release é parte de
  decidir.** A Release é UMA, cortada de `main` na tag mais nova, e carrega todo
  o Kotlin acumulado.
- **O gatilho da Release é o `java/` (e `res/`, o manifesto), não a ponte:**
  Kotlin que muda sem método novo pede Release; ENCOLHER a ponte pelo web não
  pede. Os módulos de `assets/web/` não são superfície do `SHELL_VERSION` — viajam
  dentro do bundle.
- **O modo de falhar é o caro:** uma tag declarada cuja Release nunca sai segura
  o canal PARA SEMPRE, em silêncio (a única pista é a linha no resumo do run), e
  deixá-la apontando para a tag do lote ANTERIOR é o mesmo defeito. Declarada, a
  Release se dispara depois do merge em `main`: Actions → *Build APK* →
  `release_tag` = a MESMA tag.
- **Um `apk` reprovado não pula o `web-ota`** (o `if:` dele ignora o resultado do
  `apk`; o `needs` está pela ORDEM): quem segura é o HOLD do `shellTag`, e o
  desfecho é um job VERDE que não publicou. Um lote que toca `java/` confere o
  `apk`. Por extenso em [`docs/BUILD.md`](docs/BUILD.md).
- **Este bloco é a QUARTA CASA da versão** e tem oráculo
  (`docs-coerentes.test.mjs` compara esta linha com o `version.json`).
  **Renumerar um lote mexe nas QUATRO casas** (`version.json`, `WEB_VERSION`,
  `#appVersion` e esta linha), no `shellTag`, no `notas.json` e em toda chave que
  carregue o número — o OTA ignora, em silêncio, um bundle cuja versão não seja
  MAIOR que a instalada.

### Onde procurar

| pergunta | onde |
|---|---|
| como isto funciona? | aqui, ou o capítulo certo de `docs/arquitetura/` (mapa em `docs/ARQUITETURA-WEB.md`) |
| por que é assim? / já foi tentado? / foi revogado? | `grep -n "<termo>" docs/HISTORICO.md` |
| o contrato do telão nas telas da rede | `docs/TELAO-POR-COMANDOS.md` |
| o banco de hinos e Bíblia | `docs/FONTE-DE-DADOS-LOUVORJA.md` |
| onde mora este arquivo? o que ele faz? | `docs/ESTRUTURA.md` |
| o que muda entre navegador e app? | `docs/DIVERGENCIAS-WEB-NATIVO.md` |
| o arnês, o CI, a assinatura, o backup, a página do site | `docs/BUILD.md` |
| a Verificação do Sistema e o Registro | `docs/DIAGNOSTICO.md` |
| o que o operador pediu e ainda não foi feito? | `docs/PEDIDOS-EM-ESPERA.md` — pacotes; perguntar qual seguir antes de começar |
| "faça uma das etapas de revisão" / a revisão profunda em etapas | `docs/REVISAO-PROFUNDA.md` (o plano e a regra que ESCOLHE a etapa) e `docs/revisao/REGISTRO.md` (a fila e o andamento) — uma etapa por sessão, a sessão escolhe sozinha |
