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

## Como este arquivo se lê

**Ele é o CONTRATO: o que se decide antes de tocar em nada — e só isso.** Toda
sessão lê, uma vez:

1. **este topo, até "A conversa com o operador"**, com as tabelas;
2. **[Regras de desenvolvimento](#regras-de-desenvolvimento)**.

O resto é **consulta**: a linha da ÁREA, na tabela abaixo, diz qual capítulo
abrir, e o capítulo se abre **por âncora** (`grep` antes, o trecho depois).
Nenhum dos dois se lê inteiro.

**O teto é 20–25 kB.** O que passar disso não é contrato, é área: muda para o
capítulo dono e aqui fica a linha. A dieta de 2026-11-14 (Pacote 27) tem o mapa
em [`docs/revisao/A2-INVENTARIO.md`](docs/revisao/A2-INVENTARIO.md).

| # | seção deste arquivo | quando abrir |
|---|---|---|
| 1 | [A conversa com o operador](#a-conversa-com-o-operador) | **sempre** |
| 2 | [O ganho: Presentation em vez de espelhamento](#o-ganho-presentation-em-vez-de-espelhamento) | entender o app em uma tela |
| 3 | [O estado se mede, não se cita](#o-estado-se-mede-não-se-cita) | ao começar a sessão |
| 4 | [Estrutura do repositório](#estrutura-do-repositório) | achar o arquivo |
| 5 | [Regras de desenvolvimento](#regras-de-desenvolvimento) | **antes de commitar** |
| 6 | [Onde procurar](#onde-procurar) | a pergunta não tem casa |

**As ÁREAS — a regra em uma linha, o corpo no capítulo dono:**

| área | onde mora o corpo | a regra que se paga caro |
|---|---|---|
| invariantes do shell | [`NUCLEO`](docs/NUCLEO-TECNICO.md#invariantes-do-shell-não-quebrar) | servir por `https://appassets.androidplatform.net/`, **nunca** `file://`, e um origin só para os dois WebViews |
| reconexão, morte do renderer | [`NUCLEO`](docs/NUCLEO-TECNICO.md#reconexão-e-morte-do-renderer) | **"há tela" não é "há telão"** |
| a ponte `window.AVNative` | [`NUCLEO`](docs/NUCLEO-TECNICO.md#a-ponte-windowavnative) | superfície é privilégio do Controle: o telão nasce com `host = null` e sem o `/saf/` |
| `SHELL_VERSION` | [`NUCLEO`](docs/NUCLEO-TECNICO.md#shell_version--subir-sempre-que-a-superfície-mudar) | superfície mudou (forma de retorno conta) ⇒ sobe o degrau **e o lote é APK + web**, com `shellTag` |
| as SEIS filas da ponte | [`NUCLEO`](docs/NUCLEO-TECNICO.md#as-seis-filas-da-ponte--escolher-a-errada-é-uma-regressão-muda) | escolher a fila errada é **regressão muda** |
| barramento, plano B do `BroadcastChannel` | [`NUCLEO`](docs/NUCLEO-TECNICO.md#barramento-de-comandos-e-o-plano-b-do-broadcastchannel) | o relay e o dreno do papel `tela`; a preview ILUSTRA, não espelha |
| trabalho em segundo plano | [`NUCLEO`](docs/NUCLEO-TECNICO.md#trabalho-em-segundo-plano-downloads-com-o-app-minimizado) | **`startForeground` SEMPRE**, antes de qualquer decisão de parar |
| notificação de controles | [`NUCLEO`](docs/NUCLEO-TECNICO.md#notificação-de-controles-sessão-de-mídia) | **`play`/`pause` ≠ `playpause`**: tratar tudo como alternador pausa o louvor |
| OTA da base web | [`NUCLEO`](docs/NUCLEO-TECNICO.md#ota-da-base-web-atualização-sem-apk) · [`shell/OTA`](docs/shell/OTA.md) | **`shellTag` sem Release segura o canal para sempre, em silêncio** — e a Release se dispara depois do push em `main` |
| telão nas telas da rede | [`TELAO-POR-COMANDOS`](docs/TELAO-POR-COMANDOS.md) | o contrato inteiro está no capítulo |
| séries do YouTube | [`NUCLEO`](docs/NUCLEO-TECNICO.md#séries-do-youtube-os-álbuns-oficiais-da-biblioteca) · [`SERIES`](docs/recursos/SERIES.md) | **a playlist prova o pertencimento; o título é só rótulo** |
| a aba de cifra | [`NUCLEO`](docs/NUCLEO-TECNICO.md#a-aba-de-cifra-acordes-ao-lado-da-letra) · [`CIFRA`](docs/recursos/CIFRA.md) | **sob demanda é o contrato**, não uma otimização |
| o pacote de transferência | [`NUCLEO`](docs/NUCLEO-TECNICO.md#o-pacote-de-transferência-o-acervo-num-arquivo) · [`PACOTE`](docs/recursos/PACOTE.md) | **importar só acrescenta**; é o `fim`, não o tamanho, que separa pacote inteiro de cortado |
| a abertura por trás dos panos | [`NUCLEO`](docs/NUCLEO-TECNICO.md#a-abertura-por-trás-dos-panos) | todo oráculo que toca na tela espera a cortina **depois de CADA carga** |
| a paleta | [`NUCLEO`](docs/NUCLEO-TECNICO.md#a-paleta) · [`DESIGN-SYSTEM`](docs/arquitetura/DESIGN-SYSTEM.md) | **cor nova entra em `tokens.css`**, nunca literal na folha; nunca branco pleno fora do palco |
| divergências web × nativo | [`NUCLEO`](docs/NUCLEO-TECNICO.md#divergências-entre-o-caminho-web-e-o-nativo) · [`DIVERGENCIAS`](docs/DIVERGENCIAS-WEB-NATIVO.md) | toda guarda é `if (!window.__NATIVE__)`: **o navegador é o padrão** |
| diagnóstico, Registro | [`NUCLEO`](docs/NUCLEO-TECNICO.md#diagnóstico) · [`DIAGNOSTICO`](docs/DIAGNOSTICO.md) | **o aparelho é a última palavra** |
| rito, versão, CI, Release | [`BUILD`](docs/BUILD.md) | fonte única do rito, do número e da Release — aqui fica a linha, lá o passo |
| os oráculos | [`BUILD`](docs/BUILD.md#os-oráculos--o-método) · [`ORACULOS`](docs/ORACULOS.md) | o método em uma casa só; o que cada oráculo trava, por `grep` |
| duas sessões no mesmo clone | [`MULTI-AGENTE`](docs/MULTI-AGENTE.md) | **o working tree é de todos; o commit é de quem editou** |
| economia, delegação | [`ECONOMIA`](docs/ECONOMIA.md) | **teto de 150 chamadas**; delegar tem critério objetivo e teto no briefing |
| a poda de comentário | [`PODA-DE-COMENTARIO`](docs/PODA-DE-COMENTARIO.md) | **duas provas**: o código não mudou, e cada bloco continua sobre o seu símbolo |

**Fora daqui** (o resumo tem o que se quebra sem abrir o capítulo; o capítulo
tem o resto):

| arquivo | o que é |
|---|---|
| [`docs/ESTRUTURA.md`](docs/ESTRUTURA.md) | a árvore anotada — onde mora o arquivo, e o que ele se recusa a fazer |
| [`docs/shell/README.md`](docs/shell/README.md) | o HUB do **Kotlin**, um capítulo por subsistema |
| [`docs/ARQUITETURA-WEB.md`](docs/ARQUITETURA-WEB.md) | o HUB da base web e o mapa dos capítulos |
| [`docs/arquitetura/MIOLO.md`](docs/arquitetura/MIOLO.md) | **o mapa do `controle.js`**: pergunte nele antes de abrir o arquivo (`node tools/miolo.mjs`) |
| [`docs/BUILD.md`](docs/BUILD.md) | o rito, o CI, a versão, os oráculos, a assinatura, o backup, a página do site |
| [`docs/ORACULOS.md`](docs/ORACULOS.md) | **referência**: o que cada oráculo trava |
| [`docs/HISTORICO.md`](docs/HISTORICO.md) | **apêndice**: a nota de cada versão, por `grep` |
| [`docs/revisao/CASOS-MEDIDOS.md`](docs/revisao/CASOS-MEDIDOS.md) | **apêndice**: os casos que criaram as regras do portão |
| [`docs/ACHADOS-EM-ABERTO.md`](docs/ACHADOS-EM-ABERTO.md) | defeitos CONFIRMADOS em aberto — hoje **nenhum** |
| [`docs/PEDIDOS-EM-ESPERA.md`](docs/PEDIDOS-EM-ESPERA.md) | a fila do operador, em pacotes |
| [`docs/RESIDUOS.md`](docs/RESIDUOS.md) | **o que cada lote deixou para trás** — a tabela que substitui a arqueologia |

**Apêndices congelados** — `docs/AUDITORIA-2026-08.md`,
`docs/AUDITORIA-2026-09-11.md`, `docs/AUDITORIA-EFICIENCIA-2026-09.md`,
`docs/AUDITORIA-ESTABILIDADE-AV.md`: um retrato de uma data, consultado por
`grep`; as decisões que saíram deles estão no núcleo e no `HISTORICO.md`. A
revisão profunda foi **ENCERRADA em 2026-11-09** — o
[`REVISAO-PROFUNDA`](docs/REVISAO-PROFUNDA.md) e o
[`revisao/REGISTRO`](docs/revisao/REGISTRO.md) são o registro do que cada etapa
mediu, e a vistoria em vigor é a
[`REVISAO-GERAL`](docs/REVISAO-GERAL.md).

## A conversa com o operador

**Quem lê o que sai desta sessão não programa.** Ele opera o app num culto, e a
pergunta dele é sempre a mesma: *mudou o quê, e eu preciso fazer alguma coisa?*

**A sessão fala DUAS vezes por natureza — para perguntar o que não dá para
decidir sozinha, e para ENTREGAR** — e, no mais, só a linha da etapa. A tabela
abaixo é a lista FECHADA do que se diz ao operador (as outras sessões e o
`AGENTS.md` da máquina apontam para cá, não repetem):

| momento | a fala — curta, e é a única permitida | o que NÃO se diz |
|---|---|---|
| **abertura** | *"Pacote 27: etapa 1 de 5, planejando — área: docs."* **A área em uma linha** é o que evita o choque entre duas sessões ([`MULTI-AGENTE`](docs/MULTI-AGENTE.md), regra 2) | o que vai ler, o que pretende fazer |
| **troca de etapa** | *"Pacote 27: etapa 3 de 5, testando."* As cinco: **1 Planejando · 2 Executando · 3 Testando · 4 Publicando · 5 Conferindo** — e a 4 só existe quando a entrega CHEGA ao operador (o que não sai do repositório não passou do 3). Uma linha por troca, sem detalhe | detalhe da etapa, "aguardando", "ainda rodando", "o agente continua" |
| **pergunta** | a pergunta e a decisão que ele precisa tomar | pergunta que se responde medindo o repositório |
| **entrega** | o relatório de leigo: o que mudou, **o que ele precisa fazer**, **o que não deu certo** | nome de arquivo, de função, de tecnologia ou número interno |
| **enquanto delega** | **nada** — o fim do agente notifica sozinho (não há check-in por tempo) | narrar a AUSÊNCIA de trabalho |

- **O RELATÓRIO É PARA LEIGO**, dito pelo que ele VÊ ou FAZ no app; frases
  curtas, sem preâmbulo e sem fecho de cortesia. Um relatório de dez linhas que
  se lê vale mais que um de cinquenta que se pula. **DETALHE SÓ SOB PEDIDO:**
  ele pergunta, e aí vem o técnico inteiro, sem economia.

**AS DUAS COISAS QUE NUNCA SE OMITEM** — são elas que impedem "sucinto" de
virar "só a parte boa":

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
Por isso a tarefa de leitura nasce delegada — é economia de LEITURA do operador,
não gosto por paralelismo (o critério está na
[`ECONOMIA`](docs/ECONOMIA.md#a-entrega-delegada)).

**E ISTO VALE PARA O CHAT, JAMAIS PARA A DOCUMENTAÇÃO.** O `CLAUDE.md`, os
`docs/` e as mensagens de commit continuam técnicos, densos e cheios de nome de
símbolo: eles são lidos por um AGENTE, antes do trabalho, e é essa densidade que
economiza a sessão seguinte. O `notas.json` é o único arquivo do repositório que
fala com o operador, e ele já tem regra própria (um tópico por linha, teto de
120 caracteres). **Aplicar linguagem de leigo à documentação destrói o
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
navegador**. É por isso que `shared/db.js`, `shared/stage.js` e todo o protocolo
de comandos seguem praticamente inalterados.

**Sem TV conectada o app continua útil:** nenhuma Presentation é criada e a
projeção volta a ser a preview do Controle em tela cheia (o mesmo fallback do
PWA, hoje com a COLUNA de controles no lugar dos gestos invisíveis).

---

## O estado se mede, não se cita

Número congelado em prosa envelhece em horas — e a sessão que o lê decide com
dado velho. **Meça antes de citar:**

```bash
tools/estado.sh --ci     # HEAD, árvore, as três casas da versão, a última Release, CI, fila
```

Ele imprime o que muda sozinho (versão, HEAD, CI, token, a conta dos oráculos) e
é a única fonte desses números numa sessão. O que **não** muda sozinho, e por
isso vale escrever em prosa, está nas seções abaixo e nos capítulos donos.

## Estrutura do repositório

**A árvore ANOTADA — o que cada arquivo faz e se recusa a fazer — está em
[`docs/ESTRUTURA.md`](docs/ESTRUTURA.md);** o mapa Kotlin em
[`docs/shell/README.md`](docs/shell/README.md) e o da base web em
[`docs/ARQUITETURA-WEB.md`](docs/ARQUITETURA-WEB.md). **Uma árvore só:** o
detalhe é do arquivo dono — o mapa abaixo não o repete, e a contagem de arquivos
também é de lá (medida, não escrita).

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

**Uma dependência de terceiros no shell** — o resto é AndroidX oficial
(`core-ktx`, `activity-ktx`, `webkit`). O que sustenta a proporção Kotlin ×
JavaScript é a invariante 5; ela é o argumento contra Capacitor/Cordova, que
arrastariam npm e um build system inteiro e ainda assim exigiriam código nativo
próprio para a `Presentation`.

---

## Regras de desenvolvimento

### Entrega

- **A ENTREGA É DIRETO EM `main`** (decisão do operador, 2026-11-14): sem ramo
  de teste, sem `checkout`/`merge`. O OTA publica a partir de `main` e as
  Releases nascem de `main`. **A ordem é o rito numerado em
  [`docs/BUILD.md#o-rito-de-entrega`](docs/BUILD.md#o-rito-de-entrega)**, e o
  portão é o ÚLTIMO passo antes do commit — com o ramo fora, ele é a ÚNICA
  barreira antes do canal. O único teste que passa pelo operador antes de
  publicar é a **prévia visual**, e só quando ele pede um design novo
  ([`docs/BUILD.md`](docs/BUILD.md) — "O laço de design").

  ```bash
  tools/portao.sh <arquivos do lote>   # de novo depois de QUALQUER mudança
  git add <arquivos> && git commit -m "vX.Y.Z: <descrição>"
  git push origin main                 # ← sem isto, nada chega aos aparelhos
  ```

- **O APK NÃO É RECURSO RESTRITO** (diretriz do operador, 2026-10-30: *"sempre
  que for necessário uma nova versão do APK, faça. O OTA é o principal meio de
  atualização, mas o APK não é um elemento exclusivo ou restrito"*). Quando o
  conserto CERTO mora no Kotlin, ele é feito no Kotlin, no mesmo lote, com
  `shellTag` e Release — nunca um contorno só de web no lugar dele, nem a
  metade do shell "para depois". O OTA continua sendo o caminho normal do web.
- **SHELL MUDOU ⇒ RELEASE, e o esquecimento tem máquina.** O push em `main`
  entrega só a base web; `java/`, o manifesto, `res/` e `build.gradle.kts` só
  chegam instalando um APK. O portão e o `verificar` reprovam shell mudado desde
  a última tag sem `shellTag`, e a base web mudada sem versão maior que a da
  tag. As três casas do número, o `shellTag`, o degrau e o disparo da Release
  estão em uma casa só: [`docs/BUILD.md`](docs/BUILD.md#a-versão--o-número-as-três-casas-e-o-shelltag).

- **A NOTA DO LOTE SE ESCREVE UMA VEZ, e ela mora no `docs/HISTORICO.md`:**
  primeiro a seção `## vX — …` (a versão longa), depois a linha do índice; a
  mensagem de commit fica curta e não repete a narrativa; o `notas.json` é
  outra coisa e fala com o OPERADOR, um tópico por linha. O
  `tools/docs-coerentes.test.mjs` reprova versão do `notas.json` sem entrada
  lá — foi assim que doze versões publicadas ficaram sem nota nenhuma.

- **A PÁGINA ANUNCIA SOZINHA** (`pages.yml`, por `workflow_run` no *Build APK*;
  a versão vem do manifesto do canal OTA). O trabalho é **não quebrar o
  automático** e conferir o passo *"A versão que o aparelho vai rodar"* depois
  de publicar. Por extenso em
  [`docs/BUILD.md`](docs/BUILD.md) — "A página do site".

- **O LOTE DECLARA O QUE DEIXOU PARA TRÁS — antes do push.** Quem fez o lote
  sabe, na hora, o que viu e não consertou: **cada linha vai para
  [`docs/RESIDUOS.md`](docs/RESIDUOS.md)**, com onde e tamanho — mesmo quando a
  resposta é "nenhum". Um lote sem linha lá é um lote sem vistoria, e a coluna
  do lote leva a versão (o `docs-coerentes` reprova sem ela).

  **O que se fecha na mesma sessão não entra na tabela.** Viu, consertou,
  pronto. E **linha com dono `operador` é DECISÃO pendente: ela vira pacote na
  fila** — o `tools/estado.sh` imprime essas linhas enquanto não virar.

- **O FINO NÃO ESPERA A PRÓXIMA REVISÃO.** Comentário falso, asserção vacuosa,
  seletor morto, contagem velha num capítulo: acha e fecha no mesmo lote — com
  **um subagente de contexto limpo**
  ([`docs/ECONOMIA.md`](docs/ECONOMIA.md#a-entrega-delegada)). O que pede
  decisão do operador ou medição em aparelho **não é fino**: vira pacote na
  fila, e a linha dele no `RESIDUOS.md` diz "decisão" ou "medição".

  Vale para o agente delegado também: ao encontrar resíduo fora da cerca, ele
  **não conserta em silêncio nem cala** — devolve no relatório, e o coordenador
  decide se chama o higienizador ou registra.

### Código

- **Nunca perder funcionalidades ao refatorar.** A base web tem o sistema de
  culto inteiro — ver `docs/ARQUITETURA-WEB.md` e os capítulos em
  `docs/arquitetura/`.
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
- **Ao mudar a superfície da ponte, subir `SHELL_VERSION`** e atualizar o
  capítulo (a tabela e a regra:
  [`NUCLEO`](docs/NUCLEO-TECNICO.md#shell_version--subir-sempre-que-a-superfície-mudar)).
- **Cor nova entra em `shared/tokens.css`**, nunca literal na folha do app — e
  nunca branco pleno fora do palco.
- **Sem dependências externas** — Kotlin puro + AndroidX no shell, JavaScript
  puro no web. **Cinco exceções, todas declaradas**, com a justificativa de cada
  uma em [`docs/BUILD.md`](docs/BUILD.md#as-dependências): `@aiden0z/pptx-renderer`,
  `NewPipeExtractor`, JUnit, Playwright e `acorn`. Uma sexta exceção precisa da
  mesma justificativa: um problema que não se resolve de outro jeito, e a
  manutenção paga por quem publica a biblioteca.

### Documentação

Esta documentação é lida por um agente, a cada sessão, **antes** de qualquer
trabalho. Prosa custa contexto que não sobra para o código.

- **Aqui entra o que VALE HOJE; em `docs/HISTORICO.md`, o que explica POR QUÊ.**
  Inclusive: **regra e armadilha ficam; a narrativa do achado sai**; uma medição
  que sustenta uma decisão fica (`2,73:1`, `60 req/hora`), e a de algo já
  corrigido vai para o histórico.
- **Nada de lápide dentro do código.** Comentário descreve o que está ali — se
  ele explica um mecanismo removido, ou contradiz o código, é armadilha: quem o
  ler vai procurar (ou reintroduzir) o que ele promete.
- **APAGAR CÓDIGO É APAGAR O QUE O DESCREVE, NO MESMO LOTE.** Cada remoção de
  recurso deixou comentários de pé, e eles não envelheceram calados — passaram a
  AFIRMAR coisas falsas, com guardas de segurança se justificando por um motivo
  que já não existia. Ao tirar um recurso, `grep` pelo nome dele em
  `assets/web/`, `java/` **e** nos capítulos de `docs/arquitetura/`.
- **A poda de comentário se PROVA, não se confere de olho** — e são DUAS provas,
  em [`docs/PODA-DE-COMENTARIO.md`](docs/PODA-DE-COMENTARIO.md):
  `git show <ref>:<arquivo>` sem comentários (o código não mudou) e
  `node tools/pares-de-comentario.mjs <arquivo> <ref>` (cada bloco continua
  sobre o símbolo que ele explica). A primeira é CEGA à troca de lugar.
- **Prefira tabela a lista, e lista a parágrafo.** Prefira o nome do símbolo a
  descrevê-lo por extenso. **O que nasce hoje nasce no padrão:** comentário novo
  entra condensado, não se escreve largo esperando uma poda futura.
- **ESTE ARQUIVO NÃO GUARDA LOG DE LOTE.** Um lote publicado escreve a nota no
  `docs/HISTORICO.md` e, AQUI, só corrige a REGRA que mudou — **no lugar dela**.
  Se o lote não muda regra nenhuma, este arquivo não muda. **O formato é o
  defeito**: um bloco por lote é um log, e um log só cresce; a casa da regra
  permanente é a seção canônica ou o capítulo dono, e uma regra sem casa é
  enxertada lá ANTES de o bloco sair.
- **`docs/ARQUITETURA-WEB.md` é HUB, e não recebe corpo.** Ali ficam as regras
  que valem para a base inteira, a estrutura de arquivos, o build e a TABELA que
  diz qual capítulo abrir. Assunto novo grande é **arquivo novo** em
  `docs/arquitetura/` mais uma linha na tabela — nunca uma seção a mais no hub.

---

## Onde procurar

| pergunta | onde |
|---|---|
| como isto funciona? | aqui, ou o capítulo certo de `docs/arquitetura/` (mapa em `docs/ARQUITETURA-WEB.md`) |
| por que é assim? / já foi tentado? / foi revogado? | `grep -n "<termo>" docs/HISTORICO.md` |
| o contrato do telão nas telas da rede | `docs/TELAO-POR-COMANDOS.md` |
| o banco de hinos e Bíblia | `docs/FONTE-DE-DADOS-LOUVORJA.md` |
| onde mora este arquivo? o que ele faz? | `docs/ESTRUTURA.md` |
| o que muda entre navegador e app? | `docs/DIVERGENCIAS-WEB-NATIVO.md` |
| o rito, o CI, a versão, a assinatura, o backup, o site | `docs/BUILD.md` |
| o custo da sessão, a delegação | `docs/ECONOMIA.md` |
| a Verificação do Sistema e o Registro | `docs/DIAGNOSTICO.md` |
| a varredura geral de 2026-11-13: o que fechou e o que deixou aberto | `docs/revisao/REVISAO-2026-11-13.md` (o dossiê, com a prova de cada achado) e o Pacote 12.2 da fila |
| o que o operador pediu e ainda não foi feito? | `docs/PEDIDOS-EM-ESPERA.md` — pacotes; perguntar qual seguir antes de começar |
| o que ficou para trás de um lote anterior? | `docs/RESIDUOS.md` (com dono, tamanho e por que não foi agora) |
| uma revisão geral vai começar: o que ela cobre? | `docs/REVISAO-GERAL.md` (os dez marcos) e `node tools/revisao-cobertura.mjs --base <sha>` |
| "faça uma das etapas de revisão" | **não existe mais**: a revisão profunda foi encerrada em 2026-11-09; a vistoria é a `docs/REVISAO-GERAL.md`, em sessão própria |
