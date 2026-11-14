# Pedidos em espera (fila do operador)

Registro dos pedidos do operador **ainda não implementados**, em **pacotes**: um
pacote é o conjunto de pedidos que tocam a MESMA área de código/recurso e **saem
juntos**, num lote só, com o rito de entrega completo. Existe para sobreviver a
uma limpeza de contexto: quem retomar lê este arquivo e pergunta ao operador
**qual pacote seguir** — nada aqui está autorizado para execução sem essa
resposta.

**Edição de 2026-11-09.** A lista foi relida contra o que já saiu (v1.13.36 a
v1.13.50), **renumerada do zero** (o Pacote 1 é o de maior prioridade) e
**recatalogada por importância × urgência** — o índice é a primeira tabela, e a
nota é item a item. Nesta revisão três pedidos saíram inteiros (os antigos 1.1,
1.3 e 1.4), um foi reduzido (o antigo 4.1 virou o 11.1 de hoje), o antigo 11.1
ficou só com o que as revisões não cobriram, e o cache do antigo 9.3 já tinha
saído na v1.13.50. O rastro está ao fim. **Os Pacotes 1, 2 e 3 saíram** — o 1 na v1.13.51, o 2 na v1.13.52 (2026-11-09) e o 3 na v1.13.56; os que
ficam MANTÊM a numeração — renumerar de novo custaria mais que o buraco, e o
"Mapa da numeração antiga" continua valendo para as referências velhas.

**Edição de 2026-11-14.** O operador mandou oito mensagens em sequência (09:13–09:55)
sobre o TOUR dos dois modos, o alerta do Cronograma, a Bíblia, as Mensagens, o
Editor de mídia e uma porta nova para as ferramentas guardadas. Eles entraram
como os **Pacotes 17 a 23**, sem renumeração — os números andam presos às
referências que o `HISTORICO.md`, o `docs/revisao/` e este próprio arquivo já
fazem. A novidade desta edição é o agrupamento por TEMA (a tabela logo abaixo):
a fila continua sendo a coluna da NOTA do índice. **Nenhum pacote foi
executado** — esta edição é só a lista.

**Regra do arquivo:** ele ESVAZIA. Um pacote entregue sai daqui (a nota vai ao
`docs/HISTORICO.md`, como sempre); um pedido revogado sai com uma linha dizendo
quem revogou. Não é log, e não é `docs/ACHADOS-EM-ABERTO.md` (lá moram defeitos
CONFIRMADOS por auditoria; aqui, pedidos).

**Contexto da entrega:** medido por `tools/estado.sh` — **não escreva número de versão aqui**; ele envelhece em horas (este parágrafo dizia v1.13.51 quando a base já era a 1.13.55). O operador pediu economia:
*"não temos tokens então toda ação deve ser fracionada e controlada"* — um pacote
por vez, cada um com o rito de entrega completo.

---

## Os pacotes, em uma linha

**Leia SÓ o pacote escolhido** — esta tabela responde "qual"; o resto
do arquivo responde "o quê". `tools/estado.sh` imprime a mesma lista.
Nada aqui está autorizado: **pergunte ao operador qual seguir**.

| pacote | nota | tipo | área |
|---|---|---|---|
| **5** — Itinerário: a abertura antes do primeiro evento | 8 (I4×U2) | pedido | só web, depois de planejar |
| **6** — Link do YouTube: os detalhes no oferecimento | 6 (I3×U2) | pedido | Kotlin + web (APK/Release) |
| **7** — Verificação: procurar atualização | 6 (I3×U2) | pedido | só web |
| **8** — CI: os oráculos instáveis (residual) | 6 (I3×U2) | resíduo | só `tools/` + workflow |
| **9** — Folha do vídeo: o teto e o botão "Detalhes" | 4 (I2×U2) | pedido | só web |
| **12** — Limpeza e otimização do repositório (residual) | 2 (I2×U1) | pedido | só docs |
| **13** — Estudos (não são fila de execução) | — | estudo | nenhuma entrega |
| **15** — Guia IASD: a especialização (estudo) | — | estudo | nenhuma entrega |
| **16** — O cronograma pronto: o organizador entrega o culto ao sonoplasta | 8 (I4×U2) | pedido | planejamento → Kotlin + web |
| **17** — Tour do Fácil: a Biblioteca que se abre | 9 (I3×U3) | pedido | só web (tour) |
| **18** — Tour do Avançado: os controles | 9 (I3×U3) | pedido | só web (tour) |
| **19** — Tour do Avançado: ferramentas e seções | 9 (I3×U3) | pedido | só web (tour) |
| **20** — Cronograma: o alerta à esquerda | 4 (I2×U2) | pedido | só web |
| **21** — Destinos: a engrenagem do item guardado | 6 (I3×U2) | pedido | só web |
| **22** — Bíblia: três versículos no controle | 2 (I2×U1) | pedido | só web |
| **23** — Editor de mídia: a margem inferior | 4 (I2×U2) | defeito | só web |

---

## Os temas, em uma linha

Os pacotes abertos, agrupados pelo RECURSO que tocam. É a leitura "o que mexe
com o quê" — **não** é a ordem de execução: essa é a coluna da NOTA, no índice.
Um tema não é um lote: dois pacotes do mesmo tema podem sair em semanas
diferentes, e um lote nunca mistura dois temas.

| tema | pacotes | o que sai junto |
|---|---|---|
| **Tour do app** | 17, 18, 19 | o roteiro do Fácil e do Avançado: os passos que faltam, o que sobra e cada controle explicado |
| **Cronograma e destinos** | 16, 20, 21 | a abertura antes do culto, o alerta de "não baixado" à esquerda e a engrenagem do item guardado |
| **Bíblia** | 22 | a leitura de três versículos no controle |
| **Mídia** | 23 | a margem inferior do editor de mídia |
| **Fila anterior a 14/11** | 5, 6, 7, 8, 9, 12 | o que já estava na fila, na ordem que ela já tinha |
| **Estudos** | 13, 15 | não são fila de execução: a entrega é a decisão do operador |

---

## Como esta lista se lê

**Tipo.** `defeito` (comportamento errado, relatado), `pedido` (função ou ajuste
que o operador quer), `resíduo` (o que uma revisão deixou pendente) ou `estudo`
(a entrega é uma DECISÃO, não código).

**Nota = I × U**, de 1 a 25. As duas escalas respondem perguntas diferentes:

| | Importância (I) — o que se perde se NÃO fizer | Urgência (U) — o que se perde se ESPERAR |
|---|---|---|
| **5** | falta mídia ou conteúdo no culto: é a promessa do app | pode estragar o PRÓXIMO sábado |
| **4** | atrapalha o preparo da semana, sempre | defeito relatado em produção; pode repetir a qualquer sábado |
| **3** | atrito real, contornável | o operador está esperando para trabalhar melhor |
| **2** | polimento visível, sem atrapalhar | espera um lote tranquilo |
| **1** | manutenção interna, invisível no uso | quando houver folga |

**Faixas:** Agora (20–25) · Próximo (12–19) · Na fila (6–11) · Folga (2–5) ·
Estudo (à parte, não é fila de execução).

**Empate:** defeito antes de pedido, antes de resíduo, antes de estudo; depois o
que destrava outro item; depois o lote menor.

**A nota é julgamento, não medida** — ela olha o que o operador já disse e o que o
código mostra, e os dois vêm datados em cada item. O operador pode inverter a
ordem; a fila é dele.

---

## O índice — 2026-11-14

| # | pacote · pedido | tipo | I | U | nota | entrega |
|---|---|---|---|---|---|---|
| **5** | **Itinerário: a abertura antes do primeiro evento** | pedido | 4 | 2 | **8** | web |
| 5.1 | contagem regressiva + música + avisos | | 4 | 2 | 8 | web |
| **6** | **Link do YouTube: os detalhes no oferecimento** | pedido | 3 | 2 | **6** | Kotlin + web |
| 6.1 | miniatura, título, duração e canal antes de usar | | 3 | 2 | 6 | Kotlin + web |
| **7** | **Verificação: procurar atualização** | pedido | 3 | 2 | **6** | web |
| 7.1 | a checagem que oferece o "Atualizar agora" | | 3 | 2 | 6 | web |
| **8** | **CI: os oráculos instáveis (residual)** | resíduo | 3 | 2 | **6** | tools |
| 8.1 | `configuracoes-janelas` D, instrumentado | | 3 | 2 | 6 | tools |
| **9** | **Folha do vídeo: o teto e o botão "Detalhes"** | pedido | 2 | 2 | **4** | web |
| 9.1 | sem o aviso do teto; o quinto botão sem linha própria | | 2 | 2 | 4 | web |
| **12** | **Limpeza e otimização do repositório (residual)** | pedido | 2 | 1 | **2** | docs |
| 12.1 | a lista dos mortos da auditoria de eficiência | | 2 | 1 | 2 | docs |
| **13** | **Estudos — não são fila de execução** | estudo | 4 | 1 | **4** | decisão |
| 13.1 | controle de slides + compartilhar itinerário/cronograma | | 4 | 1 | 4 | estudo |
| 13.2 | transmissão ao vivo | | 3 | 1 | 3 | estudo |
| 13.3 | layout de paisagem (o app no Windows saiu) | | 3 | 1 | 3 | estudo |
| **15** | **Guia IASD: a especialização (estudo)** | estudo | — | — | **—** | decisão |
| **16** | **O cronograma pronto: o organizador entrega o culto** | pedido | 4 | 2 | **8** | planejamento |
| **17** | **Tour do Fácil: a Biblioteca que se abre** | pedido | 3 | 3 | **9** | web |
| 17.1 | a janela aberta: Liturgia, coleções, o toque que toca e o download | | 3 | 3 | 9 | web |
| **18** | **Tour do Avançado: os controles** | pedido | 3 | 3 | **9** | web |
| 18.1 | barra, base comum, prévia e os dois slides | | 3 | 3 | 9 | web |
| 18.2 | um passo por exclusivo: playlist, leitura, cortina, mudo, tela cheia | | 3 | 3 | 9 | web |
| 18.3 | a cifra: play automático, tons e a tela cheia deitada | | 3 | 3 | 9 | web |
| **19** | **Tour do Avançado: ferramentas e seções** | pedido | 3 | 3 | **9** | web |
| 19.1 | a lista de Ferramentas sem a etapa do fechar | | 3 | 3 | 9 | web |
| 19.2 | o Timer: a roleta e o gesto de rolar | | 3 | 3 | 9 | web |
| 19.3 | o Itinerário: as três saídas numa explicação só | | 3 | 3 | 9 | web |
| 19.4 | as Mensagens: a lista e o exemplo formatado | | 3 | 3 | 9 | web |
| 19.5 | o Editor de mídia: a lista e a tela de edição | | 3 | 3 | 9 | web |
| 19.6 | a Bíblia: sem o fechar, com a leitura prática | | 3 | 3 | 9 | web |
| **20** | **Cronograma: o alerta à esquerda** | pedido | 2 | 2 | **4** | web |
| 20.1 | o par nome + alerta inverte a ordem | | 2 | 2 | 4 | web |
| **21** | **Destinos: a engrenagem do item guardado** | pedido | 3 | 2 | **6** | web |
| 21.1 | a engrenagem nas ações da linha, no Cronograma e nos Favoritos | | 3 | 2 | 6 | web |
| **22** | **Bíblia: três versículos no controle** | pedido | 2 | 1 | **2** | web |
| 22.1 | sai o segundo futuro: 1 atrás, o atual e 1 à frente | | 2 | 1 | 2 | web |
| **23** | **Editor de mídia: a margem inferior** | defeito | 2 | 2 | **4** | web |
| 23.1 | a folha com o editor aberto, medida contra as ferramentas de painel | | 2 | 2 | 4 | web |

---

## Pacote 5 — Itinerário: a abertura antes do primeiro evento

**Nota 8 (I4 × U2) · pedido · só web, depois de planejar**

**Onde:** o Itinerário como provedor por descritor, a Camada de Texto e a regra
do `sorteio.js`.

### 5.1 A contagem regressiva, a música e os avisos

Pedido do operador (2026-10-30): uma OPÇÃO do Itinerário (um interruptor só,
*"com tudo automatizado"*) que, antes do primeiro evento do itinerário ativo, põe
no telão uma tela de espera: contagem regressiva até o primeiro horário, música
de fundo de PLAYBACKS aleatórios do Hinário (a regra do `sorteio.js`, categoria
do hinário, variante playback) e, se houver, avisos. Termina sozinha no horário
do primeiro evento. Itinerário = eventos e títulos; Cronograma = mídias — não se
fundem (o operador recusou a fusão). A planejar: o que conta como "avisos"
(Mensagens? apresentação?), a camada de texto que leva a contagem (o Itinerário
já é provedor por descritor), e o que acontece se o operador tocar algo no meio.

---

## Pacote 6 — Link do YouTube: os detalhes no oferecimento

**Nota 6 (I3 × U2) · pedido · Kotlin + web (APK/Release)**

**Onde:** `ShareIntake.kt` → a PERGUNTA antes de usar; `YoutubeGrab.detalhes` e o
`ytDetalhes` da ponte.

### 6.1 Miniatura, título, duração e canal antes de usar o link

*"Ao acessar o app com um link do YouTube copiado, ele oferece para usar o link,
mas nesse oferecimento, ele não dá detalhes sobre o vídeo do link, então ajuste
para que nesse oferecimento ele dê os Detalhes como thumbnail, título, duração e
canal."* (2026-11-07 19:00).

No oferecimento do link copiado, mostrar os detalhes do vídeo: miniatura, título,
duração e canal. **Medido em 2026-11-09:** o `detalhes` já devolve `titulo`,
`canal`, `seconds` (a DURAÇÃO já vem) e `descricao`; o que falta é a MINIATURA — a
lista de miniaturas que o extrator carrega não é lida hoje (zero ocorrências de
`thumbnails` no Kotlin), e o web não conhece `i.ytimg.com` (zero ocorrências).
Isto é Kotlin pequeno (acrescentar o campo ao `JSONObject`) mais o desenho da
folha do oferecimento — no mesmo lote, com `shellTag`.

---

## Pacote 7 — Verificação: procurar atualização

**Nota 6 (I3 × U2) · pedido · só web**

**Onde:** a Verificação do Sistema; a ponte `atualizacaoEstado` e `otaCheck`; o
diálogo do OTA.

### 7.1 A checagem que oferece o "Atualizar agora"

*"O verificar deve também procurar por atualizações, se estiver disponível,
oferecer a atualização."* (2026-11-07 08:55).

A Verificação do Sistema ganha uma checagem que LÊ o estado do OTA e, havendo
base nova, oferece o "Atualizar agora" — o MESMO diálogo do OTA (o shell só
AVISA, quem aplica é o web; regra de `docs/shell/OTA.md`). **Medido em
2026-11-09:** o `otaPending` que esta lista citava não existe desde a v1.13.47
(órfão removido na X1); o que há é `atualizacaoEstado()` (os quatro campos que a
tela já lê), `otaCheck(forcar)` e `otaApply`. Respeitar `docs/DIAGNOSTICO.md`:
uma checagem não baixa megabytes — ela só aponta para o fluxo que já existe; o
desfecho é `não se aplica` quando não há nada pendente.

---

## Pacote 8 — CI: os oráculos instáveis (residual)

**Nota 6 (I3 × U2) · resíduo · só `tools/` + workflow**
**Gatilho:** só volta ao primeiro plano se o CI reprovar de novo num oráculo de
tempo.

### 8.1 O que a A1 deixou instrumentado

> **Tratado pela etapa A1 da revisão (2026-10-30)** — o relatório está em
> `docs/revisao/REGISTRO.md` (A1, "feita com um resíduo"). Fica aqui como
> residual, não como trabalho aberto em primeiro plano.

Pedido do operador (2026-10-30): *"Urgente. Coloque em prioridade."* O lote
v1.13.16 reprovou TRÊS rodadas seguidas, cada uma num oráculo DIFERENTE, todos de
tempo e nenhum tocado pelo lote; todos passam na máquina local. Cinco foram
consertados; um ficou INSTRUMENTADO, não consertado: `configuracoes-janelas` D
(repasse A5). O método de conserto é o da campanha de determinismo da v5.316
(`grep -n "v5.316" docs/HISTORICO.md`): achar em cada um a espera que mede o
RUNNER e trocá-la pelo FATO (`esperar`/`esperarDb`), nunca subir prazo; rodar sob
carga (3 processos + `stress`) até reprovar localmente antes de consertar, e
repetir depois. Isto protege o canal: um vermelho no `verificar` segura o bundle.

---

## Pacote 9 — Folha do vídeo: o teto e o botão "Detalhes"

**Nota 4 (I2 × U2) · pedido · só web**

**Onde:** `openYtMenu` (a legenda que o `ytSegRow` recebe), `destBotaoDetalhes` e
a régua do rótulo no `destinos-diretos`.

### 9.1 Sem o aviso de teto e sem uma linha só para o quinto botão

*"Remova a mensagem 'teto de qualidade, vale para o tocar agora e fica como
padrão' que temos nos vídeos. Também verifique se não está desperdiçando espaço
criando uma outra linha apenas para o botão de detalhes... Talvez apenas faça uma
versão de título mais curta como apenas 'Detalhes'."* (2026-11-07 09:12).

- **(a)** tirar a legenda do teto: ela é o último argumento do `ytSegRow` em
  `openYtMenu` (`'Teto de qualidade — vale para o "Tocar agora" e fica como
  padrão'`). Conferir a altura da fileira depois — a legenda ocupa uma linha.
- **(b)** o botão de DETALHES (o quinto da fileira, v1.13.34) não pode custar uma
  linha própria: hoje o `destBotaoDetalhes` alterna
  `['Ver os detalhes', 'Ocultar os detalhes']`, e é esse rótulo largo que o
  operador vê descer sozinho numa linha na célula estreita (360×1,25×). Encurtar
  para "Detalhes" nos dois estados, com o aberto/fechado no `on`/`aria-pressed`
  que o botão já alterna. A asserção do `destinos-diretos` A mede o rótulo — muda
  no mesmo lote.

---

## Pacote 12 — Limpeza e otimização do repositório (residual)

**Nota 2 (I2 × U1) · pedido · só docs**

**Onde:** `docs/AUDITORIA-EFICIENCIA-2026-09.md` (a lista dos mortos) e o que as
revisões S/K/C/X não tocaram.

### 12.1 A poda que sobrou

Pedido do operador (2026-10-30): *"realmente estamos a muito tempo sem"*.

**O que já foi feito:** o alvo nº 1 que abriu o pedido — o bloco *"Versão atual"*
do `CLAUDE.md` voltou a ser três linhas (medido em 2026-11-09); o
`ACHADOS-EM-ABERTO.md` está vazio desde 2026-11-09; a tabela de divergências
virou o mapa compacto do `CLAUDE.md` mais o capítulo
`docs/DIVERGENCIAS-WEB-NATIVO.md`; e as revisões S1/S2, K1–K6, C2–C9 e X1–X2
podaram comentário em CSS, Kotlin e `controle.js`.

**O que resta:** a lista dos MORTOS da auditoria de eficiência
(`AUDITORIA-EFICIENCIA-2026-09.md`), a conferência dos `docs/` que nenhuma
revisão tocou, e a poda de comentário com as DUAS provas da seção "Documentação"
do `CLAUDE.md` — no arquivo que ainda não passou por ela.

### 12.2 A varredura geral de 2026-11-13

Sete varreduras independentes cobriram tudo o que mudou desde a v1.13.56
(baseline `15d0e114`, o fim da revisão profunda): `controle.js`, o tour, o
CSS/HTML, o Kotlin, os `docs/`, os `tools/`/workflow e os achados antigos.

**O dossiê completo — com a prova de cada linha — está em
[`revisao/REVISAO-2026-11-13.md`](revisao/REVISAO-2026-11-13.md).** Ele tem os
51 achados, os 31 antigos reconferidos e a lista do que nenhuma varredura mediu.
Esta fila NÃO repete a lista: um achado fechado ganha o commit ao lado do dossiê,
e o que segue aberto é o material que a próxima sessão executa.

**Fechado nesta revisão:** `9ce397d2` (o portão voltou a rodar o
`docs-coerentes`; os fatos da v1.14.7 nos capítulos, no guia, na ponte e na
fila), `4e9d0ccc` (o defeito do guia no `ACHADOS` §5), `e26e509c` (a régua do CI
no contrato e o índice do histórico) e `a9a71ba7` (as duas ferramentas com a
mesma régua).

**Aplicado na v1.14.13** (2026-11-14): todo o web, o Kotlin e os antigos de
código — o estado por id está na seção 0 do dossiê. **Sobra:** o C8 (a pílula de
volume na tela cheia deitada — decisão de desenho), as capturas (R7), dois
residuais pequenos e quatro antigos que pedem medição ou são de processo.

### 12.3 A auditoria da revisão, e o site (2026-11-14)

Pedido do operador: *"achei estranha pois foi muito rápida — verificasse se ela
realmente cobriu tudo"*. Foi medida e registrada no §9 e no §10 do dossiê.

**A lacuna que ela achou:** as sete varreduras de 13/11 não leram o `site/` —
8.652 linhas e 52 commits do intervalo, incluindo o guia de sonoplastia novo de
7.803 linhas. A varredura de 14/11 fez esse trabalho: dez achados, dois de texto
velho já corrigidos (o "Editar mídia" mandado para Configurações e o "Tour do
app"), uma suspeita refutada (as classes `pag-col-e/d` são montadas pelo JS).

**O que sobra, e não é conserto de uma linha:**

- ~~**12.3.1**~~ **REFUTADO em 14/11, com número.** A extração do desenho não
  paga: o guia tem 943 kB CRUS e **206 kB comprimidos** (o Pages comprime), então
  o que sai da rede é isso, não os 587 kB; um sprite em arquivo à parte economiza
  ~110 kB **só a partir da segunda visita**, e `<use>` externo não funciona nos
  navegadores. Quem quisesse provar teria de medir o parse, não a rede.
- **12.3.2** 671 linhas de CSS e 1.320 de JS inline no mesmo HTML: virariam dois
  arquivos cacheáveis (~33 kB comprimidos). Ganho pequeno, risco baixo.
- ~~**12.3.3**~~ **FEITO em 14/11** (`82df8685`): as 18 capturas ganharam uma
  variante de 320 px em `site/telas/320/`, e o guia passou a usá-la. As imagens
  do guia caíram de 902 kB para 247 kB (−72,6%), e a página de 2,07 MB para
  1,22 MB. Era o peso de verdade: as capturas pagam em toda visita, o desenho só
  na segunda.
- ~~**12.3.4**~~ **FEITO em 14/11**: `tools/guia-casa-com-o-app.test.mjs`, no CI e
  no `docs/ORACULOS.md`. Provado por reversão, e já achou um quarto texto velho
  que a faxina deixou (a legenda da figura do Editar mídia).
- **12.3.5** o pós-retrato (v1.14.8–v1.14.12, 1.619 inserções) não teve varredura
  própria; a de 14/11 cobre o intervalo, e o que sobrar dela entra aqui.
- ~~**12.3.6**~~ **FEITO na v1.14.15**, junto com o tour (`b8b2c4b2`):
  o do piso de 12px citava o `MARGEM_RECORTE`, constante que morreu; o do peso
  prometia o número "no rótulo do Exportar"; e o do `Tour do app` chamava o
  quadrado de "CAIXA de marcação".

**Feito na v1.14.15** (`b8b2c4b2`): o tour do Histórico e do Transferir recorta
UMA linha em vez da lista inteira (`elementos()` passou a pegar uma peça por
seletor), com oráculo que planta duas linhas e prova — a asserção que olha o que
se vê, não o que o código faz.

**Achados do pós-retrato que pedem decisão de projeto, não conserto de uma
linha** (registrados no §10 do dossiê): o tour de Transferir e Histórico usa
seletor COLETIVO e destaca a lista inteira em vez da linha; e há duas asserções
do `tour.test.mjs` que passariam com o código de volta (`s.configuracoes`, e a
pré-marcação de `chaves()` antes de abrir a folha).

**Medido e sem o que consertar:** o desempenho do app (`562 ms` de abertura,
busca de 1.000 itens em `5,2 ms`, sem retenção de heap em 180 s de status a 4 Hz)
e o APK (5,11 MB). O peso que sobra é de download do site, não do app.

---

## Pacote 13 — Estudos (não são fila de execução)

Três estudos preliminares; nada sai para código sem decisão do operador. A nota
deles mede o valor da RESPOSTA, não de uma entrega — por isso ficam fora das
faixas.

### 13.1 Controle remoto de slides e compartilhamento de itinerários

| hora | pedido | o que já se sabe |
|---|---|---|
| 2026-10-30 | *"controle remoto de slides para o pregador, algum link de site, endereço ou código que não requer internet… onde ele pode controlar os slides pelo próprio aparelho dele, seja vendo os slides. Ou… integração com aparelhos de passagem de slides bluetooth"* | ESTUDO. Duas vias. **(a) Passador Bluetooth:** quase todo passador é um TECLADO HID (manda PageDown/PageUp, setas, às vezes B/F5); pareado com o celular, as teclas chegam à `MainActivity.onKeyDown` como chegam as de volume — o caminho já existe (`captureVolumeKeys` → `__avVolumeKey`), e ligar `KEYCODE_PAGE_DOWN/UP`, `DPAD_RIGHT/LEFT` ao ⏮/⏭ de slide é Kotlin pequeno + Release. Medir: quais teclas os passadores comuns mandam, e se o pareado como teclado esconde o teclado virtual. **(b) Pelo celular do pregador:** o servidor das telas da rede (sem internet, Wi-Fi ou ponto de acesso) já serve páginas; uma página de CONTROLE (anterior/próximo, e opcionalmente a página atual em miniatura) por uma rota nova com o mesmo pareamento e teto de sessões. Cuidado: hoje a rota de subida aceita só `TIPOS_QUE_SOBEM` (lista de permissão) — um comando de slide vindo da rede é uma porta nova de CONTROLE, não só de exibição, e pede decisão de segurança (código de entrada? só no ponto de acesso?). Ver `docs/TELAO-POR-COMANDOS.md` |
| 10:34 | *"Vamos estudar e planejar um sistema de compartilhar itinerários e ou cronogramas de forma mais facilitada… compartilhar no whatsapp… um simples link, que ao tocar, abre o app, e busca/baixa oque for necessário inclusive baixando diretamente do aparelho de origem… Talvez precisamos de um servidor? Estude as opções para o menor atrito possível…"* | entregável é um ESTUDO para o operador decidir, não código. Eixos: link de app (App Links no domínio `audiovisualiasd.com.br`, que já é nosso — exige o arquivo de associação de domínio (Digital Asset Links) no `site/` e `intent-filter` no manifesto, logo Release) vs. arquivo `.avpkg` pequeno só com a LISTA; de onde vem a mídia (LouvorJA e YouTube já são re-baixáveis por id; mídia própria do aparelho é o problema difícil — sem servidor, só com os dois aparelhos online ao mesmo tempo); e o que NÃO viajar (privacidade, `docs/MEDICAO-DE-ALCANCE.md`). Comparar com o `.avpkg` atual (`docs/recursos/PACOTE.md`) |

**Promovido em 2026-11-13:** o eixo (b) deste estudo virou o **Pacote 16** — o
operador deu o caso de uso (o líder de desbravadores e o cronograma da
cerimônia) e pediu planejamento. O (a), o passador Bluetooth, continua só
estudo.

### 13.2 Transmissão ao vivo (câmera fixa → YouTube)

Pedido (2026-10-31 11:53): um segundo celular dedicado é a CÂMERA (720p/30 na
tomada); manda o vídeo pela rede local ao celular de CONTROLE, com ~1 s de
buffer; o Controle reenvia por RTMP ao YouTube. **Estudo preliminar, nada
decidido.** Ver antes a auditoria `docs/AUDITORIA-ESTABILIDADE-AV.md` e os
achados do áudio do espelhamento em `docs/ACHADOS-EM-ABERTO.md` (a "escada da
transmissão").

| peça | caminho mais curto | dificuldade |
|---|---|---|
| sinalização câmera ↔ controle | o servidor das telas da rede (`EspelhoServidor`, Wi-Fi ou ponto de acesso) já pareia aparelhos sem internet; a câmera seria um 4º papel (`camera`) ou uma página servida | baixa — mas é porta nova de SUBIDA (hoje só `TIPOS_QUE_SOBEM`) |
| captura na câmera | `getUserMedia` exige contexto seguro: no WebView do app ok (`appassets`), mas o projeto NEGA captura por invariante (`onPermissionRequest` nega com log; `tools/sem-captura.test.mjs` cobra). Ligar a câmera só no papel `camera` é decisão de projeto. Num navegador comum, o certificado do `EspelhoCert` é autoassinado (aviso de segurança) | média |
| WebRTC com 1 s de buffer | possível: `RTCRtpReceiver.jitterBufferTarget` (Chromium) aceita até ~4 s | baixa |
| **reenvio RTMP** | **nenhum navegador fala RTMP.** O vídeo teria de sair do WebView para o Kotlin — e tirar quadros decodificados do WebView para re-codificar é caro e frágil | **alta** |
| alternativa sem re-codificar | a câmera codifica H.264/AAC em Kotlin (`MediaCodec`, como o `MuxMp4` já usa o lado de multiplexação) e manda pela LAN; o Controle só REMULTIPLEXA para FLV/RTMP, sem decodificar. Ou mais simples: a câmera manda RTMP DIRETO ao YouTube e o Controle só VÊ (prévia) e manda (início/fim). Perde: sobrepor letra/slides na live (exige compor e re-codificar) | média; RTMP à mão (handshake + FLV) é ~500 linhas Kotlin, ou uma dependência (seria a 5ª exceção, com justificativa) |
| YouTube | chave de transmissão colada pelo operador (sem OAuth) é o mínimo; criar a transmissão pelo app exige a API do YouTube com OAuth — bem mais | média |
| riscos de culto | aquecimento e bateria dos dois aparelhos por 2 h; uplink da igreja (720p30 ≈ 2,5–4 Mb/s); o Wi-Fi da igreja passa a carregar câmera + telas da rede; o Controle já hospeda dois WebViews e a `Presentation` (memória) | — |

**Recomendação do estudo:** começar pela via "câmera manda RTMP direto, o
Controle comanda e mostra a prévia" — é a única que não põe o vídeo da live
dentro do processo do telão. Vizinho do 13.1 (controle remoto do pregador pelo
mesmo servidor): as duas são PORTAS NOVAS DE SUBIDA e a decisão de segurança
(código de entrada? só no ponto de acesso?) é UMA só para as duas. Pede Release
(Kotlin) e decisão sobre a invariante de captura.

### 13.3 O layout de paisagem

Estudo (2026-10-31). **O app no Windows saiu do projeto** — decisão do operador
em 2026-11-13, depois do estudo: não haverá segunda casca nativa. O que sobra
nesta linha de fila é o pedaço que nunca dependeu dele.

O Controle é **retrato fixo** (manifesto `portrait`) com uma coluna. Serve
tablet Android, celular deitado e qualquer tela larga. Estudo: um
`@media (orientation: landscape) and (min-width: …)` em DUAS colunas
(Biblioteca/Cronograma à esquerda, prévia + transporte + letra à direita), sem
duplicar DOM; folhas viram painéis laterais. Riscos: a escada de camadas, as
folhas que "não mudam de tamanho entre estados", e os **76 oráculos que medem
geometria** — eles partem do viewport de 430×900 do arnês (`tools/arnes.mjs`),
que é a forma de um celular em pé; cada um ganha a célula de paisagem. Liberar a
rotação no Android é Release; o CSS é OTA.

---

## Pacote 15 — Guia IASD: a especialização (estudo)

**Nota — · estudo · nenhuma entrega de código (a entrega é a DECISÃO do operador)**

Pedido do operador (2026-11-12): especializar o Guia de sonoplastia IASD para a
Igreja Adventista do Sétimo Dia — exemplos e comentários adventistas, referências
a manuais oficiais, os programas da igreja (Escola Sabatina, Desbravadores,
ofertório, culto JA…), seções dedicadas ao hinário adventista (novo E antigo),
referências de cantores adventistas, o básico de teoria de música na igreja e uma
seção dedicada ao LOUVOR JA (projeção/coletânea multimídia). **A entrega é o
ESTUDO** `docs/ESTUDO-GUIA-IASD.md` (2026-11-12); a aplicação ao guia — que mora
em `site/sonoplastia/index.html` — só acontece depois da DECISÃO do operador
sobre o estudo. Nada aqui está autorizado.

---

## Pacote 16 — O cronograma pronto: o organizador entrega o culto

**Nota 8 (I4 × U2) · pedido · planejamento PRIMEIRO, depois Kotlin + web**

Pedido do operador (2026-11-13). Este pacote **promove** o estudo 13.1(b): o
compartilhamento de cronograma deixa de ser hipótese e vira o caminho de um
caso de uso concreto.

**O caso que o pediu:** *um líder de desbravadores organiza a cerimônia
inteira — as mídias, a ordem, os tempos — e precisa entregá-la ao sonoplasta.
Hoje isso é link por link no WhatsApp, ou um pendrive na mão.*

**O que "pronto" significa:** o destinatário toca no link e recebe o culto
montado — cronograma, itinerário, elementos e as mídias conforme a organização
do responsável —, sem procurar arquivo nem pedir nada a ninguém.

**O que já existe e não resolve sozinho:**

| peça | o que faz | por que não basta |
|---|---|---|
| `.avpkg` ([`PACOTE.md`](recursos/PACOTE.md)) | leva o acervo inteiro de um aparelho a outro | é um arquivo de gigabytes: não atravessa o WhatsApp, e não carrega a ORGANIZAÇÃO do culto |
| link de app (App Links em `audiovisualiasd.com.br`) | abre o app num endereço nosso | leva a lista, não a mídia |
| o Cronograma e o Itinerário | já existem como estrutura | não há como exportá-los como uma unidade entregável |

**O problema central:** a mídia é pesada e o link é leve. A saída provável é o
pacote **pequeno** — a organização, os ids re-baixáveis (YouTube e LouvorJA já
são re-baixáveis por id) e as impressões digitais do que precisa viajar — e o
app do destinatário completa o que falta. A mídia PRÓPRIA do organizador é o
caso difícil: sem servidor, os dois aparelhos precisam estar online juntos.

**O que decidir ANTES de codar** (é a etapa de planejamento, e a entrega é a
decisão):

1. **Servidor ou não.** A arquitetura não tem nenhum, e o operador já perguntou
   "talvez precisamos de um servidor?". Sem ele, o link sozinho não move bytes —
   e a resposta muda o custo de tudo.
2. **Quem é o dono do cronograma.** O organizador pode não ter o app. A autoria
   pelo site é uma via? Se for, o site deixa de ser só página de download.
3. **O que viaja.** A organização sempre; a mídia só quando não é re-baixável.
4. **O que NÃO viaja nunca.** Privacidade — ver
   [`MEDICAO-DE-ALCANCE.md`](MEDICAO-DE-ALCANCE.md).
5. **O consentimento.** Receber um cronograma não pode ser um comando remoto:
   o destinatário vê o que vai entrar e confirma antes. (É a mesma decisão de
   porta de ENTRADA que o 13.1 já levantou para o controle remoto de slides.)

**A regra que este pacote herda e não pode esquecer:** *importar só acrescenta*
(`PACOTE.md`); nada que já esteja no aparelho do sonoplasta é substituído.

---

## Pacote 17 — Tour do Fácil: a Biblioteca que se abre

**Nota 9 (I3 × U3) · pedido · só web (o tour)**

**Onde:** `app/src/main/assets/web/controle/tour.js` (`TOURS.simples`, e o
`SECOES.biblioteca`, que hoje é `modos: ['full']`), o `secaoDoTour()` do
`controle.js`, e o oráculo `tools/tour.test.mjs`.

### 17.1 A janela aberta, as seções, o toque que toca e o download

Pedido do operador (2026-11-14 09:34): *"o tour do modo simples não explica
sobre a biblioteca aberta, suas seções como liturgias e coleções, nem sobre o
toque que dá play diretamente, nem sobre a questão de como funciona o download
da biblioteca, seja por item individual ou seja por coletâneas."*

- **A janela é a mesma; a porta é outra.** O Fácil abre o MESMO
  `#hymnSearchPopup` sobre a `#simpleBarra` (o comentário do `index.html` diz
  isso), mas o `secaoDoTour()` **pula** esse popup quando
  `simplesBibliotecaDocada()` — com a barra docada, o tour de seção não abre.
  Então a etapa só pode morar em (a) `TOURS.simples`, que roda com a barra à
  vista e alcança o `#libBar`, ou (b) `SECOES.biblioteca`, que só abre com a
  janela por cima da leitura. **A escolha é do lote**; o que não pode é a etapa
  nascer morta nos dois estados. A marca do visto (`s.biblioteca`) e o reset
  do botão "Tour do app" seguem a mesma decisão.
- **As seções.** O bloco "Liturgia" (`blocoLiturgia`) e os cards de coleção são
  a primeira coisa que a janela mostra; o tour de hoje só fala em "buscar". Um
  passo para a divisória das seções e outro para um card de coleção (o que ele
  é: um álbum inteiro, com as músicas dentro).
- **O toque que toca.** No Fácil, tocar numa música a põe na TV; no Avançado,
  o mesmo toque abre as opções dela — o texto atual do `TOURS.avancado` já diz
  isso, e é a promessa do modo. O passo precisa dizer a diferença.
- **O download, por item e por coletânea.** O item tem o caminho dele (as
  opções da música) e a coleção tem o botão da barra dela (`coll-bar-dl`), que
  baixa o álbum inteiro e cancela no mesmo botão durante o download. O tour do
  Avançado tem UM passo de "Baixar" (álbum) e o Fácil não tem nenhum — faltam
  os dois caminhos.

**Fora do escopo:** abrir a Biblioteca ou projetar sozinho. A regra do tour é
passiva ("o tour nunca abre nada").

---

## Pacote 18 — Tour do Avançado: os controles

**Nota 9 (I3 × U3) · pedido · só web (o tour)**

**Onde:** `tour.js` (`TOURS.avancado`, o passo `['#seek', '.transport']` que
hoje junta tudo) e o oráculo `tools/tour.test.mjs`.

### 18.1 O que hoje é um passo só vira cinco

Pedido do operador (2026-11-14 09:55): *"na parte dos controles, divida ele
para uma etapa da barra de progresso, um dos botões da base, uma sobre o
preview e os dois botões de pular slides e também uma individual sobre cada um
dos botões exclusivos… não siga exatamente essa ordem, apenas aponte todos
esses elementos."*

A divisão, com os alvos medidos no `index.html`:

| etapa | alvo | o que dizer |
|---|---|---|
| a barra | `#seek` | arraste para avançar/voltar no vídeo ou na música; os tempos ficam nas pontas |
| a base comum | `.transport` (`#repeat`, `#prev`, `#playpause`, `#next`, `#stop`) | repete, volta mídia, toca/pausa, passa mídia e encerra — em grupo, como o operador autorizou |
| a prévia | `#preview` | o que está na TV, em miniatura |
| os dois slides | `#slidePrevBtn` / `#slideNextBtn` | o par que flanqueia a prévia e passa estrofe/página |
| os exclusivos, um a um | `#plBtn` (playlist), `#lyricsViewBtn` (auxiliar de leitura), `#viewToggle` (cortina/wallpaper), `#muteToggle` (mudo) e `#pvFullBtn` (tela cheia) | cada um com o próprio balão; a ordem pode ser a da tela, não a do pedido |

**Fora do grupo comum:** play/stop/next/repeat. **Dentro dele:** a playlist e o
auxiliar de leitura são os dois que ABREM uma folha; a cortina, o mudo e a tela
cheia operam a cena — a distinção que o `index.html` já documenta na ordem da
fileira (o que abre folha fica nas pontas).

### 18.2 A cifra, dentro do auxiliar de leitura

Pedido (09:55): *"no auxiliar de leitura, temos as cifras, que não é explicado
nada sobre o play automatico, ou os alteradores de tom ou tela cheia que fica
na horizontal."*

**Onde:** `SECOES.letra` (a folha do `#lyricsPopup`), a barra `#lyricsCifraCtl`,
o `#cifraCheiaBtn` e os oráculos `cifra-rolagem`/`cifra-tela-cheia`.

- **Play automático:** o botão da barra da cifra a rola sozinho; as velocidades
  estão em `CIFRA_VELOCIDADES` e o estado é `cifraRolando` (`auto` é uma delas).
- **Os tons:** os dois `lv-fonte-btn lv-cifra-tom` (−/+), meio tom por toque.
- **A tela cheia deitada:** o `#cifraCheiaBtn` nasce no cabeçalho e mora na
  barra da cifra; é o modo horizontal de leitura.
- **A armadilha do passo:** a cifra só existe quando a mídia tem cifra. Os
  passos são `opcional` (sem a peça, saem da conta) e o texto não pode prometer
  o que a mídia não tem. O tour da seção abre na PRIMEIRA abertura da folha; se
  a mídia em cena não tem cifra, as etapas somem e a marca do visto fica — a
  mesma pergunta do tour da Bíblia (19.6), e a decisão é do lote.

---

## Pacote 19 — Tour do Avançado: ferramentas e seções

**Nota 9 (I3 × U3) · pedido · só web (o tour)**

**Onde:** `tour.js` (`SECOES.ferramentas`, `ferr-timer`, `ferr-itinerario`,
`ferr-msg`, `ferr-edicao`, `biblia`) e o oráculo `tools/tour.test.mjs`.

### 19.1 A lista de Ferramentas sem a etapa do "Fechar"

Pedido (09:15): *"na lista de ferramentas, o tour explica o botão de fechar,
uma etapa completa dispensável, então pode remover essa etapa."*

É o último passo do `SECOES.ferramentas` (`#toolsFechar`) — sai inteiro. A lista
continua com as SETE linhas (Relógio, Cronômetro, Timer, Itinerário, Mensagens,
Sorteio e Editar mídia), e a seta de sair não precisa de balão: ela é o mesmo
retângulo da porta que abriu.

### 19.2 O Timer: a roleta e o gesto de rolar

Pedido (09:55): *"no timer, faltou a explicação sobre rolar para ajustar o
tempo. Ele está pulando direto para a legenda."*

- O passo de hoje é `['#chronoRun', '#chronoZero']` ("Iniciar e Zerar"), e a
  legenda (`SUBLINHA`) vem logo depois; a roleta (`#chronoRoletas`, com as
  colunas de hora/minuto/segundo) não tem passo.
- O passo novo aponta a roleta e ensina o GESTO: rolar a coluna ajusta o
  número; o Timer vai de 0 a 59 e volta ao zero (o comentário do
  `acertarRoletas` no `controle.js`).
- Entra antes da legenda; a ordem do `ordenar()` (o que é fixo no começo/fim)
  não muda.

### 19.3 O Itinerário: as três saídas numa explicação só

Pedido (09:55): *"não apenas restrito ao itinerário, mas nele o tour não comenta
sobre os botões de salvar no cronograma ou favoritos. Pode fazer uma explicação
conjunta nesses casos com o projetar no telão, pois são basicamente todas
opções de direcionamentos."*

- O rodapé da folha (`#toolsFoot`) desenha o PROJETAR e, quando a ferramenta
  sabe guardar, o par Cronograma/Favoritos (`cueSaveBtn`; o descritor é o
  `cueSaveDaFerramenta`, e o Itinerário JÁ tem os dois — com `itin.itens`
  vazio, os quadrados ficam apagados e o `title` diz por quê).
- O `SECOES['ferr-itinerario']` tem `PROJETAR` e **não tem `GUARDAR`**. Entra um
  passo conjunto (a constante `GUARDAR` já existe, com o texto "Cronograma e
  Favoritos") explicando as três saídas de uma vez: projetar no telão agora,
  guardar no Cronograma para o culto e guardar nos Favoritos para repetir.
- O texto é o MESMO em todas as ferramentas que têm as três saídas (Relógio,
  Cronômetro, Timer, Sorteio, Itinerário): um texto só, no `GUARDAR`; cada tour
  acrescenta o que é específico. Não escrever cinco textos que vão divergir.

### 19.4 As Mensagens: a lista e o exemplo formatado

Pedido (09:55): *"na aba das mensagens, também não explica sobre a lista de
mensagens e nem um exemplo de mensagem que mostre que pode ser editado a
formatação e afins."*

- Hoje o `SECOES['ferr-msg']` tem UM passo: `#msgNovaBtn` ("+ Nova mensagem").
- Entram: (a) a LISTA (`renderMsg`, a `.msg-list`; tocar numa linha projeta, e
  a linha no ar tem o `.no-ar`); (b) um passo nas OPÇÕES da mensagem (a gaveta
  do `⋮`, onde o oráculo `mensagem-estilo` mede tamanho, fonte e alinhamento do
  cartão) — o balão pode usar uma mensagem de exemplo, sem criar outra.
- **Cuidado medido:** a mesma linha tem o projetar, o "Adicionar ao Cronograma"
  e o favoritar; o passo da lista não pode prometer que o toque guarda.

### 19.5 O Editor de mídia: a lista e a tela de edição

Pedido (09:55): *"no editor de mídia, também não temos explicações sobre a
lista de arquivos, biblioteca e coleções… E nem estou tendo um tour sobre a
tela de edição propriamente dita."*

- Hoje o `SECOES['ferr-edicao']` tem três passos opcionais: a faixa do trecho, a
  busca e o importar.
- **A linha na lista de Ferramentas.** O `SECOES.ferramentas` vai do Sorteio
  direto para o "Fechar" que sai (19.1): o "Editar mídia" não tem passo na
  lista, e o operador pediu explicação do editor. O lote decide onde a linha
  entra — no tour da lista (19.1) ou junto do tour do editor (aqui).
- **A lista** (`renderEdicaoEscolha`, `#edicaoLista`): o acervo por grupos (as
  mesmas coleções/pacotes da Biblioteca), a busca e o toque que escolhe a mídia
  — nenhum passo hoje.
- **A tela de edição** (`renderEdicaoForm`): o card da mídia (o X cancela ou
  descarta), o TRECHO (as duas pontas + −1 s/+1 s), o "Confirmar"
  (`#edicaoConfirmar`) e os destinos do rodapé (Cronograma · playlist ·
  favoritos, a tabela `DESTINOS`). O tour explica o trecho, mas não o
  "Confirmar" nem o que os destinos fazem — e o editor é a ferramenta que MONTA
  o item, não uma que projeta.
- **O gatilho:** o editor tem duas vistas (`renderEdicaoEscolha`/
  `renderEdicaoForm`), e o tour já usa `opcional` para cobrir as duas; a vista
  que está à vista na abertura é a única que pode ser tour. Medir as duas no
  lote.

### 19.6 A Bíblia: sem o "Fechar" e com a leitura prática

Pedido (09:55): *"na bíblia, não precisa explicar sobre o botão de fechar. E
também faça um tour sobre a seção prática dos controles da bíblia, explicando
como mudar um versículo selecionado, ou como salvar no cronograma ou
projetar…"*

- **Sai** o passo `#bibleClose` ("Fechar") do `SECOES.biblia`.
- **Entra a leitura** (`renderBibleReading`; as seções `.bible-vsec`, o
  `.bible-read-foot` e o `.bible-read-acoes`): o versículo central alterna
  projetar/tirar do telão (`toggleBibleVerse`); os vizinhos navegam
  (`bibleStep`, que cruza capítulo e livro nos limites); o rodapé tem as quatro
  pílulas da referência (livro · capítulo · versículo · versão) e os dois
  `cueSaveBtn` — Cronograma e Favoritos.
- **A pendência do gatilho:** o `SECOES.biblia` abre na GRADE DE LIVROS, e a
  leitura só existe depois de escolher um versículo; o `secaoDoTour()` devolve
  'biblia' nos dois estados. Com os passos da leitura `opcional`, eles não
  estariam à vista na primeira abertura. O lote decide entre (a) uma seção
  própria para a tela `reading` (o que pede um gatilho por estado interno) ou
  (b) a marca do visto esperar a primeira abertura EM leitura. Qualquer uma
  muda o `SECOES` e o oráculo, e a decisão fica registrada no commit.
- **O que NÃO é deste pacote:** a nota do operador de tirar um dos versículos
  futuros (3 no total) é o **Pacote 22**. A etapa daqui mede a leitura como ela
  estiver; se o 22 sair antes, a etapa já nasce com 3.

---

## Pacote 20 — Cronograma: o alerta à esquerda

**Nota 4 (I2 × U2) · pedido · só web**

**Onde:** `index.html` (o `.crono-par` da barra), `controle.css` (`.crono-par`,
`.crono-titulo` e o `padding-left` simétrico), os oráculos `cronograma-pronto`
e `barra-do-topo-e-titulos`.

Pedido (09:13): *"O icone de alerta sobre itens não baixados no cronograma, ele
atualmente esta na direita, deixe ele na esquerda."*

Hoje o par é `[#cronoTitulo][#cronoAlerta]` dentro do `.crono-par`, centrado na
trilha do meio; o alerta nasce `hidden` e só aparece quando
`faltaParaTocarSemRede` acha item. A troca:

- o `#cronoAlerta` passa a vir ANTES do `#cronoTitulo` no DOM — não dá para ser
  filho do título, porque o título é o botão da gaveta e um botão dentro de
  outro é o defeito que a marcação não desfaz (o próprio comentário do
  `index.html` diz isso);
- o `padding-left` do título compensa a SETA, que fica do lado direito dentro
  dele (o comentário do `controle.css` explica); com o alerta à esquerda, o par
  precisa de compensação simétrica para o NOME continuar no eixo. Medir o eixo
  com o alerta VISÍVEL e escondido: o nome não pode andar em nenhum dos dois;
- o `justify-content` do `.crono-par` continua `center`; o grid do
  `.list-header` (a coluna do importar e a do configurar) não muda.

**Medir:** o `cronograma-pronto` confere que o alerta está ao lado do título; a
barra do topo tem o próprio oráculo (`barra-do-topo-e-titulos`) — o lote
confere os dois e muda a referência no mesmo commit.

---

## Pacote 21 — Destinos: a engrenagem do item guardado

**Nota 6 (I3 × U2) · pedido · só web**

**Onde:** `controle.js` — `criarCue`, `montarAcoesDaLinha`, `abrirFerramenta`,
`cueSaveDaFerramenta` e o desenho das ações da linha (Cronograma e Favoritos).

Pedido (09:55): *"Para esses itens que são configuraveis e podem ir para o
cronograma, e que ao executar não abrem suas respectivas abas, ou afins, crie
um botão nas opções seja no cronograma ou favoritos (um botão de engrenagem que
abre a aba da ferramenta com os dados da ferramenta para serem editados ou
administrados)."*

O problema que ele resolve: a Mensagem, o Sorteio, o Tempo (Relógio /
Cronômetro / Timer) e o Itinerário viram itens do Cronograma/Favoritos
(`criarCue`), mas o item guardado **não abre a ferramenta que o gerou** — para
editar o texto de uma mensagem ou trocar as opções de um sorteio, o operador
tem de abrir Ferramentas do zero, e o item guardado fica apontando para o que
já foi.

- **Onde mora o botão:** nas AÇÕES DA LINHA (`montarAcoesDaLinha`), nos dois
  destinos (Cronograma e Favoritos), só para os cues que têm ferramenta
  editável (`message`, `draw`, `chrono`, `itinerario`).
- **O que ele faz:** abre `abrirFerramenta(id)` com os dados do cue. Hoje o
  `abrirFerramenta` só leva `opcoes` de animação, então o lote precisa de uma
  PORTA DE DADOS (um `abrirFerramenta(id, { cue: rec })` ou uma função própria)
  que monte o painel com o conteúdo do item, não com o último estado da
  ferramenta. O `edicao` não entra: ele já é a ferramenta que edita um item.
- **O desenho:** o mesmo quadrado de ícone das ações irmãs, com o glifo da
  engrenagem e `title` "Administrar este item"; não é botão de texto (a faixa é
  estreita).
- **A dupla face:** o cue é uma REFERÊNCIA (o `renderMsg` guarda o `id` da
  mensagem), então editar pela engrenagem deve atualizar o que o roteiro
  projeta — conferir no lote se `message`/`draw` leem o dado vivo e se
  `chrono`/`itinerario` precisam regravar o cue.
- **Oráculos:** `cronograma-acoes-cheias` (a faixa de ações),
  `favoritos-menu-na-linha`, `ferramentas-folha`; e os passos de tour que a
  entrada nova pedir (o `SECOES` das quatro).

---

## Pacote 22 — Bíblia: três versículos no controle

**Nota 2 (I2 × U1) · pedido · só web — anotado pelo operador para depois**

**Onde:** `renderBibleReading` (as quatro chamadas de `mkSection`), o CSS da
`.bible-read`/`.bible-vsec` e os oráculos `biblia-leitura-cabe` e
`troca-de-versiculo`.

Pedido (09:55, na mesma mensagem do tour): *"Anote para ser feito depois:
atualmente colocamos 1 versículo do passado, 1 atual e 2 futuros na leitura dos
controles da bíblia. Vamos tirar um dos versículos futuros, assim a tela ficara
com 3 ao todo, tendo mais espaço para esses 3."*

- Hoje o `renderBibleReading` chama `mkSection(-1)`, `mkSection(0)`,
  `mkSection(1)` e `mkSection(2)` — 1 atrás e 2 à frente. Saem o `+2` e o
  espaço dele; ficam 1 atrás, o atual e 1 à frente.
- **O que muda de verdade:** o CSS distribui a altura da `.bible-read` entre as
  seções; com três, cada uma ganha ~1/3 em vez de ~1/4. Medir a 390×844 e a
  360×640 com a fonte do sistema em 1,25× (o `biblia-leitura-cabe` é o que
  cobra que o texto caiba) e conferir que o rodapé (as quatro pílulas e as duas
  ações) não muda de lugar.
- **O que NÃO muda:** o `bibleStep` continua andando por `s.idx`; a seção `+1`
  já mostra o versículo seguinte, e tirar o `+2` muda a PRÉVIA, não a
  navegação.

---

## Pacote 23 — Editor de mídia: a margem inferior

**Nota 4 (I2 × U2) · defeito · só web**

**Onde:** `controle.css` — `.tools-sheet` (o `padding` da folha), `.misc-panel`
/ `.edicao-panel` (o painel do editor), `.tools-foot`; e o `index.html`
(`#edicaoSecao` é IRMÃO do `#toolsBody`, dentro do `#toolsSheet`).

Relato (09:55): *"verifique a margem inferior dessa aba de editor de mídia,
pois ele está com uma margem maior que o normal, veja se ele foi corretamente
adaptado para essa janela de ferramentas, pois ele veio das configurações e
pode ser sido mal feito."*

- A suspeita tem lastro: o editor veio de Configurações (v1.14.7) e é o ÚNICO
  painel que não é montado no `#toolsBody`; ele ocupa o lugar dele como irmão,
  com o `#toolsFoot` vazio (`:empty { display: none }`). O painel herda o
  `padding-bottom: .4rem` do `.misc-panel`, e a folha soma o
  `padding: .5rem .7rem .6rem` do `.tools-sheet` — réguas de respiro diferentes
  das ferramentas de painel.
- **Medir antes de mexer:** a distância da última peça do editor (o fecho,
  `#edicaoFechoForm`/`#edicaoFechoEscolha`) até a borda de baixo da folha,
  contra a MESMA distância numa ferramenta de painel (Timer, Mensagens). Se a
  diferença for o `.4rem` do painel (ou um `padding` que veio do `#config`), é
  uma linha de CSS; se for o `#toolsFoot` vazio ou a lista, é outra.
- **O oráculo:** o `geometria` mede a folha aberta e o corte; o
  `edicao-de-midia` mede o editor. O lote ajusta os dois se a régua mudar.

---

## O que saiu desta lista (rastro, não log)

**v1.14.7 (2026-11-13), só web:** o **Pacote 10** inteiro — o "Editar mídia"
agora é uma linha da lista de Ferramentas (com o voltar do Android e o rascunho)
e o tile "Saída de áudio" saiu. Entraram no mesmo lote os três pedidos do dia: o
**10.3** (o tour vira quadrado on/off, no molde do "Dados móveis"), o **10.4** (a
pílula de volume a 12 px da borda) e o **10.5** (o recorte do tour preso à área
visível, com margem de halo nos quatro lados, e o balão a 16 px). Nota em
`docs/HISTORICO.md`; oráculos `tour`, `edicao-de-midia`, `ferramentas`,
`ferramentas-folha`, `configuracoes-janelas`, `abertura-e-transferencia`,
`saida-de-audio-e-economia` e `volume-troca`. Os números dos outros não se movem.

**2026-11-13 (só `site/`):** o **8.2** — o guia aberto pelo app a 320 px sem a rolagem lateral de 18 px (a grade de atalhos do D9 e o endereço longo, medidos com a fonte do runner), e o `guia-no-app` saindo 1 com FALHOU. Nota em `docs/HISTORICO.md`; o 8.1 continua.

**2026-11-12 (só `site/`):** o pacote do **Guia de sonoplastia** (anotado como "Pacote 14" por engano — o número já tinha saído na v1.13.61). A introdução (D0 e I0) entrou com o texto do operador, e as Perguntas e respostas foram **revogadas pelo operador**: *"Sobre as perguntas e respostas pode remover"*.

**v1.13.68 (2026-11-11):** o **Pacote 11** inteiro — o `⋮` sempre na linha do favorito, com o arrastar do Cronograma no lugar do ↑↓ (11.1), e a lista do acervo por partes, que evolui o conserto da gaveta (v1.13.67). Notas em `docs/HISTORICO.md`; oráculos `favoritos-menu-na-linha` e `lista-por-partes`. Os números dos outros não se movem.

**v1.13.67 (2026-11-11):** o defeito da **gaveta que fechava** sozinha ao abrir o Provai e Vede/Informativo (entrou como 11.2 e saiu no mesmo dia — a verificação da semana redesenhava a lista sem o guarda). Nota em `docs/HISTORICO.md`, oráculo `serie-gaveta-aberta`.

**v1.13.61 (2026-11-10):** o **Pacote 14** — a barra da Liturgia na coluna do texto (título em 85 px, alinhado com o nome das linhas). O pedido foi feito para ficar na fila e o operador decidiu executá-lo na hora.

**v1.13.57 (2026-11-10), o lote seguinte:** o **Pacote 4** — a pílula de volume única nos dois modos, as coleções do Modo Fácil em duas (CDs do ano e "Diversas"), os dois lugares de elemento fixo depois dos vídeos da semana, a terceira tecla do Modo Fácil virando tela cheia e as Configurações dele enxutas. A nota está em `docs/HISTORICO.md`; os oráculos são o `controles-layout`, o `video-tela-cheia`, o `modo-simples-teclas` e o bloco novo do `acervo`.

**v1.13.51 (2026-11-09), DEPOIS desta edição:** o **Pacote 1** — o episódio
baixado pelo atalho da semana não se perde mais (`serieReterBaixado` +
`serieAutoRefazer`), com a nota em `docs/HISTORICO.md`. Ele sai do índice e da
seção; os números dos outros não se movem.

**v1.13.52 (2026-11-09), o lote seguinte:** o **Pacote 2** — o alerta de "não
está pronto" com o "Baixar tudo" (`faltaParaTocarSemRede` + `baixarTudoQueFalta`)
e o segurar-arrasta em lugar do par ↑↓, com a seleção múltipla saindo inteira. A
nota está em `docs/HISTORICO.md`; o oráculo é o `cronograma-pronto`.

Saíram entre a edição anterior (2026-11-08) e esta, com a nota em
`docs/HISTORICO.md`:

- **v1.13.37/38 — a Área 1 inteira, menos o episódio offline (o antigo 1.2,
  hoje o Pacote 1):** a contagem do card pela lista
  (`serieTotalVisivel`), a extração das playlists
  `LOCKUP_CONTENT_TYPE_COURSE` (`playlistsDoCanal`), o item virtual do "Tocar
  agora" na fila (`replacePlaylistWith` no `semanaAcao`), a ordem Informativo →
  Provai e Vede (`serieCollections`) e os `.catch` mudos da retenção virando
  linha no Registro.
- **v1.13.50 — a 9.3:** o `varrerCache` do `YoutubeGrab` apaga o que está em
  `cache/yt` sem dono há mais de 1 h, poupando os arquivos que o registro de
  desfechos aponta.
- **v1.13.36 — metade da 4.1:** as opções do favorito foram para trás do `⋮`; o
  que faltava virou o Pacote 11.

O rastro anterior (v1.13.4 a v1.13.36) está no `docs/HISTORICO.md`; esta lista
não o repete.

---

## Mapa da numeração antiga

A numeração foi refeita do zero em 2026-11-09. Para decifrar referências
anteriores (o `docs/REVISAO-PROFUNDA.md` cita "Pacote 8" e "pacotes 9–12"; o
`docs/ACHADOS-EM-ABERTO.md` citava "Pacote 6"):

| até 2026-11-08 (Área) | antes disso (Pacote) | hoje (Pacote) |
|---|---|---|
| 1 — Séries | 13 e 21 | 1 (só o 1.1) |
| 2 — Modo Fácil | 16 e 26 | 4 (saiu na v1.13.57) |
| 3 — Cronograma | 10 e 24 | 2 |
| 4 — Favoritos | 22 | 11 |
| 5 — Folha do vídeo | 20 | 9 |
| 6 — Playlist | 23 | 3 |
| 7 — Link do YouTube | 25 | 6 |
| 8 — Verificação | 19 | 7 |
| 9 — Configurações e Ferramentas | 9 | 10 |
| 10 — Itinerário | 11 | 5 |
| 11 — Limpeza | 12 | 12 |
| 12 — Estudos | 6, 17 e 18 | 13 |
| 13 — CI | 8 | 8 |

O "Pacote 6" antigo (o estudo de abrir a lista de aparelhos de áudio) NÃO existe
mais: o operador abandonou o projeto da janela da Samsung em 2026-10-30, o tile
passou a abrir a API pública na v1.13.16 e SAIU do app na v1.14.7.
