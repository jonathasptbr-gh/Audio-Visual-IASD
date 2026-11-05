# Registro da revisão profunda

O andamento das etapas de [`docs/REVISAO-PROFUNDA.md`](../REVISAO-PROFUNDA.md).
É a ÚNICA memória entre as sessões: o que uma etapa precisa saber de outra está
aqui, e só aqui. **A tabela abaixo É a fila**: "faça uma das etapas de revisão"
pega a próxima pela regra "A ESCOLHA DA ETAPA" do plano (parcial → em curso
abandonada → primeira pendente pelo `nº`).

## Estado

`pendente` · `em curso` · `parcial (ponto de parada)` · `feita` · `pulada (porquê)`

| nº | id | estado | versão entregue | data | resumo em uma linha |
|---|---|---|---|---|---|
| 1 | A1 | feita (com um resíduo: `configuracoes-janelas` D, ver o relatório) | sem versão (só `tools/`) | 2026-10-30 | 5 oráculos instáveis consertados, 1 instrumentado, 1 corrida do APP (repasse W2) |
| 2 | A2 | feita | sem versão (só docs) | 2026-10-30 | `CLAUDE.md` 315 kB → 79 kB, nenhuma regra mudada: detalhe verbatim nos capítulos e em 4 arquivos novos |
| 3 | A3 | feita (resíduo: as células do `ORACULOS.md` em cadeia só-acrescenta, repasse A5) | sem versão (só docs) | 2026-10-30 → 2026-11-04 | `CONTROLE.md` 770 kB → hub + 11 partes (verbatim provado); duplicatas da A2 fundidas nos 7 capítulos; narrativa do `ORACULOS.md` e da Biblioteca ao `HISTORICO.md`; ~20 fatos velhos corrigidos contra o código |
| 4 | A4 | feita | sem versão (só docs + `docs-coerentes`) | 2026-11-04 | índice do `HISTORICO.md` 1,2 MB → 58 kB (notas movidas verbatim às seções); auditorias com o estado conferido (os "26" da 2026-08 são 7 ids + 3 resíduos); `TELAO-POR-COMANDOS.md` 73 → 56 kB com ~25 fatos corrigidos; os repasses da A2/A3 |
| 5 | A5 | feita (resíduo: as outras células em cadeia do `ORACULOS.md`, ver o relatório) | sem versão (só `tools/` + docs) | 2026-11-04 | `docs-coerentes` confere âncora com o slug do GitHub e entre arquivos; `display-smoke` sem a comparação morta do espelho; `wav()` no arnês; JUnit sem rede +14 testes; 4 células do `ORACULOS.md` colapsadas; tempos medidos arquivo a arquivo |
| 6 | A6 | feita | sem versão (só workflow, `tools/` e docs) | 2026-11-04 → 2026-11-05 | o `verificar` fixo em `ubuntu-24.04`: no 26.04 o Playwright do pin não instalava e a suíte de Chromium era PULADA com job verde (9 runs); `stub-da-ponte` novo (94 travas latentes em 40 fixtures consertadas); ponteiros do `apk.yml` e duplicata do `BUILD.md` |
| 7 | W1 | feita | v1.13.17 (só web) | 2026-11-05 | `apkInstalar` que não respondia virava SUCESSO (consertado + asserção); `watchdog-modulos` novo; ~30 comentários corrigidos/reancorados nos dois arquivos; 3 RMW partidos no `controle.js` repassados |
| 8 | W2 | feita | v1.13.18 (só web) | 2026-11-05 | nenhum defeito de culto na cerca; o giro perdido do `enquadramento-da-camada` MEDIDO: é o `load()` do Controle reaplicando rotação velha (repasse C2), não o `stage.js`; export morto e ~15 comentários |
| 9 | W3 | feita | v1.13.19 (só web) | 2026-11-05 | a `FORA` do pacote com a grafia errada deixava as intenções do YouTube viajarem (consertado + asserção cruzada); 4 funções só-do-oráculo saíram e o `funcao-sem-chamador` vê a superfície dos módulos; `bible.test.mjs` novo |
| 10 | C1 | pendente | | | |
| 11 | C2 | pendente | | | |
| 12 | C3 | pendente | | | |
| 13 | C4 | pendente | | | |
| 14 | C5 | pendente | | | |
| 15 | C6 | pendente | | | |
| 16 | C7 | pendente | | | |
| 17 | C8 | pendente | | | |
| 18 | C9 | pendente | | | |
| 19 | S1 | pendente | | | |
| 20 | S2 | pendente | | | |
| 21 | K1 | pendente | | | |
| 22 | K2 | pendente | | | |
| 23 | K3 | pendente | | | |
| 24 | K4 | pendente | | | |
| 25 | K5 | pendente | | | |
| 26 | K6 | pendente | | | |
| 27 | X1 | pendente | | | |
| 28 | X2 | pendente | | | |
| 29 | X3 | pendente | | | |
| 30 | X4 | pendente (opcional: só com o "sim" do operador) | | | |

## Repasses

Achados FORA da cerca de quem os achou, endereçados à etapa dona. A etapa dona
lê as linhas dela ao começar e risca (ou move para o relatório dela) o que
tratou.

| para | de | achado (arquivo:símbolo — cenário) |
|---|---|---|
| A3 | A2 | Os blocos movidos VERBATIM para `docs/arquitetura/DESIGN-SYSTEM.md` ("As regras da paleta como estavam no núcleo"), `docs/arquitetura/CONTROLE.md` (referência da preview; abertura), `docs/shell/PONTE.md`, `docs/TELAO-POR-COMANDOS.md`, `docs/arquitetura/DISPLAY.md`, `MODELO-DE-DADOS.md` e `MOTOR-STAGE.md` (seções "(do núcleo, revisão A2)" ao fim de cada um) DUPLICAM em parte o que o capítulo já tinha (medido: PONTE.md já cobria ~95% dos símbolos; DESIGN-SYSTEM ~53%). A A2 não deduplicou de propósito (mover sem perder era a cerca); fundir cada seção na casa certa do capítulo é trabalho de capítulo |
| K2 | A3 | `NativeBridge.kt` ~1350: o comentário diz que os métodos de certificado são guardados "como os cinco irmãos", mas a família do espelho tem 9 métodos com guarda `host` — conferir a conta |
| X3 | A5 | (sem outra etapa em `tools/`; a X3 é a que mede no Chromium) `tools/configuracoes-janelas.test.mjs` D e `tools/boot-nativo.test.mjs` — instáveis no runner, SEM reprodução local (passaram na base e 5× cada a três processos). O `obtido` do D já diz o estado da seção (A1); o próximo vermelho do `boot-nativo` precisa ter a asserção lida no log (o log corta): sem ela, não há o que consertar. **A6 leu um:** run `41998913449` (1ª tentativa), única asserção vermelha *"o percurso dos Favoritos terminou sem exceção (page.evaluate: TypeError: Cannot read properties of null (reading 'click') at eval :41:35)"* — um `.click()` cru num `evaluate` dentro do `try` de 4437→5183 que ainda não nomeia o elemento ausente; a 2ª tentativa passou (132/132) e 5 rodadas locais passaram |
| X2 | A4 | Os que sobraram da `AUDITORIA-2026-08.md` estão ENUMERADOS na tabela "Conferência da revisão A4" no topo dela (7 ids + 3 resíduos; o "26" eram listas brutas). E fora da cerca de qualquer etapa: a `AUDITORIA-2026-09-11.md` tem 23 achados sem RESOLVIDO (entre eles [5] e [33] VERIFICADOS) + 3 extras (imports mortos em `EspelhoServidor.kt` e `ShellUpdater.kt`, o `#bibleTitle`) — vários ([23] [25] [29] [33] [37]) citam linhas do `CLAUDE.md` antigo e devem ter caducado; a `AUDITORIA-EFICIENCIA-2026-09.md` tem #2, #5 e #9 abertos; a `AUDITORIA-ESTABILIDADE-AV.md` tem C2 e D2 abertos (cabeçalhos atualizados) |
| C1 | A4 | `controle.js` (~linha 715, o comentário do achado `:469` da auditoria 2026-08): diz que "a ÚNICA porta dinâmica é `DEST_ICONE`", que saiu na v1.8.56 — hoje é `ICON[d.ico]`. Lápide |
| K4 | A4 | `EspelhoServidor.servirMidia` — o KDoc diz que item em crescimento só sai em `chunked`; conferir contra o `alcanceDe`. O `EspelhoHttpRangeTest` cita o §6 do `TELAO-POR-COMANDOS.md`, que continua existindo (condensado). Não verificados na A4: `EspelhoPares.validar` aceitar token nu e o Cookie ser ignorado (saíram do doc por não terem prova) |
| C3 | W1 | `controle.js`:`moverNaLista` (~12389) — `listIds` + `listSet(listName, ids)` em ARRAY: read-modify-write partido. Um download do YouTube que termina no vão (`addMediaToList` na mesma lista) some da lista e o `gcOrfaos` seguinte apaga o arquivo; dois toques rápidos em "Mover" perdem um movimento. Conserto: `AVDB.listSet(listName, (ids) => { …splice…; return ids; })` |
| C8 | W1 | `controle.js`:`resgatarDownloads` (~39449) — `getState(YT_INTENCOES)` + `setState(YT_INTENCOES, [])`: uma intenção gravada por `lembrarIntencao` entre os dois é apagada (janela curta, na abertura). Conserto: `let pend = []; await AVDB.updateState(YT_INTENCOES, (a) => { pend = a \|\| []; return []; })` |
| C1 | W1 | `controle.js`:`clearCurrentSelection` (~3926) — `getState('current')` + `setState({...cur, mediaId:null})`: par RMW sobre a chave do `persistCurrent`. Hoje só roda no `init()` antes do `load()` (risco baixo); trocar por `AVDB.updateState('current', …)` |
| C5 | W1 | `controle.js`:`serieDiarioGravar` (~21990) — o comentário ainda cita o "Atualizar a lista" (saiu na v1.12.53) como a segunda varredura concorrente |
| K2 | W1 | `NativeBridge.kt`:`bgProgress` (~951) — linha de comentário duplicada ("Só o Controle, como os onze irmãos…" duas vezes) |
| K2 | W1 | `NativeBridge.kt`:`apkInstalar` — roda na fila `transferencia` (UMA thread, a dos downloads do YouTube): o APK espera atrás de um download de minutos e o prazo de 15 min do web conta essa espera. Avaliar se a fila é a certa (o web já não mente quando o prazo vence: v1.13.17) |
| K1 | W1 | `MainActivity.kt`:`pendingShare` (~169/731) — slot ÚNICO (`AtomicReference.set`): dois shares que chegam antes de o web bombear sobrescrevem o primeiro. SUSPEITA, sem medição |
| C2 | W2 | `controle.js`:`load()` (~4186/4240/4307) — lê `state.rotate` (e `fit`) com `await` no começo e aplica `mediaRot`/`preview.setRotate` no fim: um `applyRotate` (C8, ~38654) que grava no vão é DESFEITO no Controle (botão e prévia voltam ao valor velho; o telão fica girado) até o próximo `load()`. **O operador pediu (2026-11-05) que a C2 cubra também o "Preencher"** (`mediaFit`/`applyFit`, o mesmo vão): MEDIR o cenário do fit com a mesma corrida, consertar os dois no mesmo lote e cobrir os dois na asserção. MEDIDO (W2): é o vermelho de 2229/2242 do `enquadramento-da-camada`, com o `load()` do `init()`. Conserto provável: reler o estado na hora de aplicar, ou `applyRotate`/`applyFit` aplicarem na preview e o `load()` não sobrescrever valor mais novo |
| X3 | W2 | `tools/enquadramento-da-camada.test.mjs` — age (`applyRotate`, `send`) logo depois de `__avBack` existir, SEM `esperarCortina`: com o `init()` ainda em voo, o `load()` dele desfaz o giro (repasse C2). Reproduz com `Emulation.setCPUThrottlingRate` 20× (8× passa). Conserto do oráculo: `esperarCortina` depois do `goto`; a asserção do C2 é outra (girar DURANTE um `load()` em voo) |

## Relatórios

Um bloco por etapa executada, ≤ 25 linhas: corrigido · achado e não corrigido
(com o porquê) · repasses · ponto de parada · o que o operador confere no
aparelho.

### A1 · CI estável — feita (2026-10-30, duas sessões)

Levantamento das 10 runs vermelhas mais 2 tentativas (runs 2213–2248): 8 oráculos
reprovaram por acaso, nenhum tocado pelo lote que os reprovou (o commit `9c24d68`
reprovou 3 vezes, cada uma num oráculo diferente). **Consertados (só o oráculo):**
- `display-smoke` 5-B — o status final do `clear` anterior chegava ao espião
  DEPOIS de ele ser zerado (o `saindoDeCena === 0` não é a entrega). Agora uma
  MARCA sai pelo mesmo `BroadcastChannel` do telão e o zero espera por ela.
- `tela-inteira` B3 — a premissa (`seekEl` com duração) e a leitura em dois
  `evaluate`; entre eles um evento do `<video>` sem duração escondia a linha.
- `excluir-em-cena` — a espera "tocando e > 0,2 s" casava com o vídeo ANTERIOR
  ainda no fade de saída (o `<video>` é o mesmo elemento); agora exige a fonte nova.
- `servidor-indisponivel` D1 — o `apurarFonte('teste')` depois do `setOffline`
  devolvia a apuração da abertura ainda em voo (partida ONLINE → `servidor`).
**Não consertados:** `enquadramento-da-camada` (corrida do APP → repasse W2).
**Retomada (mesma data):** `favoritos-fechar` A8 — o `cab0` do primeiro toque era
lido antes de a tampa (medida num `requestAnimationFrame`) assentar, atrás de uma
espera fixa de 150 ms; agora espera a geometria parada (topo das barras igual em
dez quadros). `busca-na-tela` NÃO é instável: o run 2232 foi a primeira run dele,
consertada no lote seguinte (2233), e desde então passou em todas.
`configuracoes-janelas` D ficou instrumentado, não consertado (repasse A5).
**A carga local NÃO reproduziu:** `display-smoke` antigo e novo, 12 rodadas cada (3 em paralelo + 4 `yes`), 0 reprovações nos dois; os outros três passaram sob a mesma carga. Os consertos saem da leitura do valor impresso no log do CI — a prova é o CI ficar verde nas próximas ~10 runs (conferir antes de fechar a A1).
**O operador:** nada a fazer no aparelho — só o CI muda.

### A2 · Dieta do `CLAUDE.md` — feita (2026-10-30)

**Antes/depois:** `CLAUDE.md` 315.387 → 79.324 bytes (meta ≤ 80 kB). Nenhuma regra
mudou de sentido: o inventário bloco a bloco, com a casa nova, é
`docs/revisao/A2-INVENTARIO.md`. O que saiu foi COPIADO VERBATIM (só links
relativos e nível de título ajustados); no núcleo ficou um resumo com o link.
**Para onde foi:** a tabela de divergências e suas sete seções →
`docs/DIVERGENCIAS-WEB-NATIVO.md` (novo); arnês, prazos, paralelo, stub de 60 s,
passos de Chromium, JUnit, assinatura, backup, a página do site, as dependências
e o HOLD do `apk` → `docs/BUILD.md` (novo); Diagnóstico → `docs/DIAGNOSTICO.md`
(novo); a árvore anotada → `docs/ESTRUTURA.md` (novo); paleta → DESIGN-SYSTEM;
ponte → PONTE; telão e dreno → TELAO-POR-COMANDOS; reconexão → DISPLAY; relay →
MODELO-DE-DADOS; referência da preview e abertura → CONTROLE; `load` →
MOTOR-STAGE. O bloco "Versão atual" (67 kB de resumos v1.7.0→v1.13.15) voltou a
ser o estado presente + a regra do `shellTag`; os resumos com símbolo ou frase
em negrito sem ocorrência no apêndice foram verbatim para a nova seção
`## revisão A2` do `docs/HISTORICO.md` (o resto já tinha entrada `**vX**`).
**Ficaram inteiros no núcleo:** a conversa com o operador, o ganho, as
invariantes 1–9, segundo plano/sessão/OTA/séries/cifra/pacote (já eram resumo),
as regras de MÉTODO dos oráculos (com o script da Sanidade), entrega, código,
documentação, o NÚMERO, as casas da versão e "Onde procurar" (+4 linhas).
Mapas atualizados: `docs/shell/README.md` (8 linhas) e `docs/ARQUITETURA-WEB.md`.
**Verificado:** `docs-coerentes` verde; os 23 oráculos de Node puro do passo de
sanidade verdes; a "Sanidade da base web" (o script do workflow) verde.
**Repasses:** dois (A3: deduplicar as seções verbatim nos capítulos; A4: linha
dupla do `MuxMp4.kt` no mapa do shell e o `R2ImagemFonte.kt` fora da árvore). **O operador:** nada a fazer.

### A3 · Capítulos grandes — feita (2026-10-30, retomada 2026-11-04)

**Feito:** `docs/arquitetura/CONTROLE.md` 769.843 → 18.241 bytes: virou HUB (mapa das
partes, o índice por assunto, e as três regras do Controle inteiro — feedback,
diálogo padrão, teclado virtual) + 11 partes no mesmo diretório,
`CONTROLE-{MODOS,LAYOUT,NAVEGACAO,CONFIGURACOES,TELAO,BIBLIOTECA,LISTAS,COLECOES,SORTEIO,YOUTUBE,LEITURA}.md`
(48–107 kB), cada uma com um "Nesta parte:". Três grupos de `####` estavam sob o
pai errado e subiram a `###` (o painel de Configurações dentro de "Os dois botões
de slide"; a folha de Ferramentas, o contrato do `shouldInterceptRequest` e "UM
registro só" dentro de "Abas e biblioteca"). **Prova verbatim** (multiconjunto de
linhas não-título): 9.409 do original, 0 faltando depois do corte; depois da
fusão da A2, 18 faltando, todas intencionais (duplicata "A CORTINA", 2 citações de
procedência, 3 linhas reescritas para absorver o único). Links: `CLAUDE.md` (4,
regras intactas), hub `ARQUITETURA-WEB.md` (12 linhas), `ESTRUTURA.md` e mais 8
capítulos; 23 âncoras entre arquivos conferidas, 0 quebradas (uma já quebrada,
`…v1430`, consertada). **Duplicatas da A2 fundidas:** CONTROLE-TELAO,
DESIGN-SYSTEM (209 → 202 kB; 73 linhas repetidas saíram, o único foi a 4 seções
novas, e três fatos VELHOS do capítulo corrigidos pela cópia mais nova: `.3` →
`--op-inativo` .35, o verde é ATIVIDADE e o desfecho é azul, `tokens.test.mjs`
confere `colors.xml`), DISPLAY, MODELO-DE-DADOS, MOTOR-STAGE. ~3 kB de narrativa
do DESIGN-SYSTEM foram ao `HISTORICO.md` (`## revisão A3`); o resto ali é razão de
regra revogada, que o capítulo guarda de propósito.
**Verificado:** `docs-coerentes`, `tokens` e a "Sanidade da base web" (todos os
oráculos de Node puro) verdes; `CLAUDE.md` 79,4 kB.
**PONTO DE PARADA (a próxima sessão da A3 retoma daqui):** (1) narrativa de lote
do `docs/ORACULOS.md` — não começada; as células misturam "o que trava" e
histórico frase a frase (`verificacao-do-sistema` tem 13,8 kB): ler célula a
célula, o histórico vai ao `HISTORICO.md`; (2) fundir as seções A2 de
`docs/shell/PONTE.md` e `docs/TELAO-POR-COMANDOS.md` (sobreposição parcial, frase a
frase); (3) opcional: os "quatro relatos da v1.5.17" e "três relatos da v1.5.18"
em `CONTROLE-BIBLIOTECA.md`, e os dois blocos verde × azul (v1.8.55/56) do
DESIGN-SYSTEM, que repetem em parte o item fundido (guardam medidas).
**Repasses:** A5 (âncoras entre arquivos no `docs-coerentes`), A4 (4 referências
genéricas ao Controle). **O operador:** nada a fazer — só documentação.
**Retomada (2026-11-04):** `ORACULOS.md` 326 → 315 kB — 99 trechos de narrativa
de 50 células movidos verbatim ao `HISTORICO.md` (prova: 0 ausentes, 0
não-verbatim, 20 costuras listadas); as maiores células lidas inteiras, o resto
varrido por padrão; as cadeias "a vX acrescentou o bloco N" ficaram (dizem o que
trava) → repasse A5. `PONTE.md` 77 → 67 kB: a seção A2 fundida e REMOVIDA, o
único absorvido; fatos corrigidos contra o código: 76 servidos / SEIS órfãos
(eram 75/cinco), 9 internos (eram 8), `ytFetch`/`deckPages` sem prazo por serem
trabalho LONGO de máquina (não "uma pessoa responde"), só 5 métodos na main
thread, contagens de linha do cabeçalho. `TELAO-POR-COMANDOS.md` 77 → 73 kB: o
DRENO ficou (sem o sufixo); "como estava no núcleo" virou "O mapa de hoje"
(~12 blocos duplicados viraram ponteiros, o único foi a §3.2/§3.5/§5.6/§7-B);
fatos corrigidos: a ordem do gesto (gesto ANTES da rede), `oferecerGesto` não
existe desde a v5.218, sem `/s/<token>`, sem dreno de `mic-status`, Range
malformado é ignorado (200 inteiro; só 416 para faixa válida que não cabe), o
texto real do aviso de embed. `CONTROLE-BIBLIOTECA.md`: os "relatos" da
v1.5.17/v1.5.18 viraram seções por assunto; citações e o desenho revogado ao
`HISTORICO.md`; a regra "a lista RESPIRA" (revogada na v1.5.19) reescrita.
**Verificado:** `docs-coerentes` e a "Sanidade da base web" verdes.
**Repasses novos:** A5 (cadeias do `ORACULOS.md`; comentário de `z-index` no
oráculo da Verificação), A4 (§0 e fatos velhos do TELAO; mais "relatos" em três
capítulos), K2 (a conta "cinco irmãos" no `NativeBridge.kt`). **O operador:** nada.

### A4 · Apêndices e arquivo morto — feita (2026-11-04)

**`HISTORICO.md` (só a forma):** a nota inteira estava sendo escrita DENTRO da
linha do índice desde a v1.8.18 — o índice tinha 1,2 MB. As 397 linhas > 400
caracteres foram movidas verbatim: 220 viraram seção `## vX — título`, 177 entraram
como primeiro parágrafo da seção que já existia. Índice: ~58 kB, uma linha por
lote. Prova: 0 linhas do original perdidas fora as 397, os 397 corpos presentes.
O `docs-coerentes` ganhou a asserção do teto (reversão: reprova o arquivo antigo
com as linhas da A3/A2). A regra do `CLAUDE.md` que sancionava o costume foi
corrigida no lugar, e o cabeçalho do apêndice diz a forma.
**Auditorias (só conferir):** a 2026-08 dizia "TODOS FORAM CORRIGIDOS" e "26 por
aplicar"; pelos diffs dos 7 commits dos lotes sobram 7 ids + 3 resíduos, tabela no
topo dela (repasse X2). EFICIENCIA e ESTABILIDADE-AV: estado no cabeçalho. Nenhuma
auditoria está FECHADA; só o `ESPELHO-DE-PIXELS.md` (recurso removido) está.
**`TELAO-POR-COMANDOS.md` 73 → 56 kB:** §0 (diário v5.188→v5.223, já no histórico)
fora; ~25 fatos velhos corrigidos contra o código; `arquivo:linha` trocados por
símbolo; §2/§6/§10 de antes da E7 ao `HISTORICO.md` (`## revisão A4`). Os números
§3.x/§5.x/§6/§8 ficaram (o código os cita).
**Relatos:** `CONTROLE-NAVEGACAO` (v1.5.6/7/9), `CONTROLE-SORTEIO` (v1.8.83) e
`DESIGN-SYSTEM` (geometria, escada de camadas) viraram regra por assunto.
**Repasses da A2/A3 tratados:** linha dupla do `MuxMp4.kt` (e as 18 contagens de
linha do mapa do shell, medidas), `R2ImagemFonte.kt` na árvore, as 4 referências
ao "capítulo do Controle" nomeiam a parte.
**Resíduo sem dono:** ainda há citações de relato em `CONTROLE-NAVEGACAO` (~7) e
`CONTROLE-SORTEIO` (~15); (o "§187" quebrado saiu com o `ESPELHO-DE-PIXELS.md`).
**O `ESPELHO-DE-PIXELS.md` SAIU** (o operador disse sim, 2026-11-04): §2.3 e
§2.4 (socket e TLS, citados por `EspelhoServidor`/`EspelhoCert`) foram VERBATIM ao
§2 do `TELAO-POR-COMANDOS.md`; o §10-A já estava no histórico (v5.154→v5.186).
Sete comentários repontados (só comentário: diff sem linha de código e
`pares-de-comentario` verde nos seis de app — sem Release). As auditorias ficam.
**Verificado:** `docs-coerentes`, os oráculos de Node puro e a "Sanidade da base
web" verdes. **O operador:** nada a fazer no aparelho.

### A5 · O arnês e os oráculos — feita (2026-11-04)

**Corrigido:** `docs-coerentes` §6 confere âncora com o slug do GitHub (acento
preservado — antes o slug o tirava e a regex pulava toda âncora acentuada) e
`X.md#slug` entre arquivos: 29 → 126 âncoras, 0 quebradas (reversão: o antigo
aprovava três links errados). `display-smoke`: o bloco da densidade do espelho
de pixels comparava 961×540 com 960×540 — a reversão (`cqmin` → `cqw`) mostrou
que só trava "a letra não depende da largura"; saiu, e o oráculo roda em 960×540
(a TV 1080p). `ferramentas-folha`: três sondas sem leitor (a régua revogada da
v1.8.62/63) e dois comentários falsos. `wav()` idêntico em quatro oráculos foi
para o `arnes.mjs` (md5 igual). `junit-sem-rede.sh` rodava sem o
`EspelhoInterfacesTest` (124 → 138 testes). `ORACULOS.md`: `ferramentas-folha`,
`sombra-de-rolagem`, `modo-simples-corpo` colapsadas no estado atual lido do
arquivo (`smoke` conferido: vale); a cadeia foi verbatim ao `HISTORICO.md`.
Repasses: z-index da Verificação (narrativa, aparada), os seis tratados.
**Medido:** tempos arquivo a arquivo no `HISTORICO.md` (`## revisão A5`): o
`funcao-sem-chamador` é 6,9 s dos ~9 s de Node puro; nenhum Chromium preso em
stub de 60 s; o `display-smoke` gasta ~35 s na cadência real da retomada.
**Achado e não corrigido:** as outras células em cadeia do `ORACULOS.md` e os
comentários em cadeia dentro dos oráculos (dezenas; trabalho de várias sessões,
sem dono); o `esperar`-que-checa em três oráculos (subir não removeria código);
duas armadilhas latentes de stub (repasse A6). Os dois instáveis não reproduzem
(repasse X3). Comparação `comm` dos dois sentidos: limpa.
**PONTO DE PARADA:** nenhum na cerca do cartão; o resíduo é o colapso das
demais células do `ORACULOS.md`. **O operador:** nada a fazer.

### A6 · CI e higiene do repositório — feita (2026-11-04, retomada 2026-11-05)

**Corrigido:** (1) **o portão de Chromium estava aberto**: o `ubuntu-latest` virou Ubuntu
26.04 e o Playwright 1.56.0 recusa a imagem; o `Preparar o Chromium` falhava em 2 s e os
oráculos eram PULADOS com o job verde — nove runs de `main` (2026-11-04, `41916726776` →
`41929548923`; o último com suíte é o `41123264801`, 132/132). Só lotes de docs/`tools/`
passaram nesse vão (nada de `assets/web/` chegou à frota sem verificação). `verificar` →
`runs-on: ubuntu-24.04` (o ambiente da campanha; subir o pin obrigaria repeti-la). (2)
`tools/stub-da-ponte.test.mjs` (Node puro, no workflow, linha no `ORACULOS.md`, reversão nas
duas formas): 94 travas latentes em 40 fixtures (`takeShare` constante nos 40; 54 nomes fora
do `comCallId`, 28 no `Proxy` do `tela-inteira`), consertadas mecanicamente. (3) Seis
ponteiros do `apk.yml` para seções que a A2 moveu; `BUILD.md` sem o parágrafo duplicado, com
a contagem de Node puro (24) e a regra da imagem fixa; `checar.mjs` sem o "16".
**Verificado:** Node puro, "Sanidade da base web", `docs-coerentes`, `tokens`, YAML e `comm`
dos dois sentidos verdes; a suíte INTEIRA de Chromium local (os 132, 636 s a três processos,
porque o CI não a rodava havia nove runs): 131/132. O vermelho, `site-grade-e-carrossel` F
(desvio 3,7–3,8 px, teto 2), é determinístico aqui, fora do diff, e o Chromium local NÃO é o
do pin (1243, sem CDN para baixar o do 1.56) — a prova é o primeiro `verificar` em 24.04.
**Achado e não corrigido:** actions em Node 20 (`checkout@v4`, `setup-java@v4`
"deprecated"…) rodam forçadas em Node 24 e funcionam — trocar major sem defeito não paga;
`site/.nojekyll` versionado E criado no `pages.yml` (inofensivo); nada grande versionado sem
motivo (`.git` 11 MB); caches de Gradle e npm/Chromium já existem.
**Pergunta ao operador (não diff):** o pulo por infraestrutura não reprova o job por
política; nove pulos seguidos passaram despercebidos. Vale reprovar quando o `Preparar o
Chromium` falha por recusa do PRÓPRIO Playwright (não rede)? **Resposta (2026-11-05):**
*"não permite que pule testes, independente do motivo"* — o `Preparar o Chromium` perdeu
o `continue-on-error`, o passo de AVISO do pulo saiu; falha reprova o job (rede inclusive).
A válvula manual `ignorar_oraculos` também saiu (pedido do operador, mesmo dia).
**CI pós-merge** (`41998913449`): a suíte VOLTOU a rodar; 1ª tentativa 131/132 (`boot-nativo`, o instável da X3 — asserção lida e anotada no repasse X3), 2ª 132/132; o `site-grade` passou no Chromium do pin. **Repasses:** o vermelho do `boot-nativo` anexado à linha X3. **O operador:** nada a fazer.

### W1 · Núcleo compartilhado — feita (2026-11-05)

**Corrigido (código, só `native.js`, três hunks):** `apkInstalar` — o `call()` nunca
rejeita; prazo vencido/ponte que lança resolvia `null`, o `.catch` era morto, e o
`controle.js` tratava `erro = null` como SUCESSO ("Confirme a instalação…" sem
instalador, `apkEntregue` gravado, a pergunta do APK calada). Agora vira a frase "o
download do app não respondeu". `atualizacaoEstado`/`pacoteProntoEstado` sem o
`.catch` inalcançável. Asserção no `ponte.test.mjs` (reversão: reprova o antigo).
**Oráculo novo:** `watchdog-modulos.test.mjs` (Node puro, no workflow e no
`ORACULOS.md`): todo `<script>` do Controle tem o global no `otaAppIsUp` (reversão:
sem `AVProgresso` ou `createStage`, reprova). A lista em si estava completa.
**Só comentário (provas 1 e 2):** blocos no símbolo errado (`pacoteDiag`,
`stateKeys`, `listRemove`, a CENA do `lerDetentores`), fatos falsos (`pickDoc`
"único que não remonta", `farolEstado` "coberto", `listSet` "nenhum escritor de
fundo", `updateState` citando o "Atualizar a lista", o "instantâneo de `donos`"),
lápides (`espelho`, `micDiag`, `farolContar`, `requestMic`, `salvarTexto`),
premissas de shell antigo; a narrativa foi verbatim à seção v1.13.17 do histórico.
**Achado e não corrigido:** `openDB` deixa conexão órfã se o `onblocked` disparar
e o `open` suceder depois (só navegador com duas abas num upgrade); `MID_PREFIX`
sem `padEnd` (colisão ínfima); `lerDetentores` é O(acervo detido) por remoção (fora
dos 4 Hz, não medido); `ytFetch`/`deckPages` sem prazo (decisão documentada);
`espelhoCert*` sem consumidor (`SEM_UI_DE_PROPOSITO`).
**Varredura `getState`→`setState`:** a base web inteira com janela de 60 linhas e
chave textual igual — pares em funções separadas ou com chave em variável NÃO foram
rastreados. Nenhuma `fn` de `updateState` tem `await`. Repasses: C1, C3, C5, C8, K1, K2.
**Verificado:** "Sanidade da base web" (todo Node puro), `tokens`, `comm` dos dois
sentidos; Chromium: `ponte`, `ota`, `ota-confirma`, `boot-nativo`, `db-estado`,
`db-gc`, `listas-de-protecao`, `cronogramas-multiplos`, `pacote-compartilhar`,
`abertura-e-transferencia`, `edicao-de-midia`, `excluir-em-cena`,
`verificacao-completa`, `verificacao-do-sistema`, `registro`, `smoke`, `display-smoke`.
**O operador:** nada a fazer; a v1.13.17 chega sozinha (só web).

### W2 · Motor e telão — feita (2026-11-05)

**Corrigido (código, só `stage.js`):** `createStage.rampSteps`/`MUTE_RAMP_TIME` saíram
da superfície (sem consumidor desde a v5.212). Nada mais de código: na cerca não houve
defeito de culto CONFIRMADO (lidos inteiros os três `.js`; folhas varridas por cor
literal, contorno e seletor sem elemento — limpas).
**Repasse da A1 (`aplicarGiroTudo`) — MEDIDO, motor inocente:** o vermelho reproduz com
CPU 20× mais lenta; instrumentado, no `reporGiro` a camada estava visível e o `rot` da
preview era 0 — quem o zerou foi o `load()` do `init()` do Controle, que leu a rotação
antes de o `applyRotate(90)` gravar. Repasses C2 (a corrida no app) e X3 (o oráculo não
espera a cortina). O teto de 60 quadros não entrou em jogo.
**Repasse da A4 (`tela.js`):** o `db.js:800-801` e o pareamento por código de 3 dígitos
saíram do cabeçalho e dos dois comentários que o citavam.
**Só comentário (provas 1 e 2 nos cinco arquivos):** `mostrarTextImg` inexistente,
"o Controle lê só `linhas`" (lê `retomada` também), "sem prazo" no `reporGiro`, o seek
"abaixo"; lápides do `ESPELHO`, do microfone (2), do `ytHandle`, do service worker, do
papel `espelho` (E7), das `.yt-frame`/`.yt-shield`, do `mic-status` e do botão de canto
da v5.216 — a narrativa foi verbatim à seção v1.13.18 do histórico.
**Achado e não corrigido:** a ladeira de retentativa de imagem escrita três vezes no
`display.js` (iguais, sem divergência medida); `tela.js` com `async`/`class` contra o
webOS 4.x citado (o `display.js` já exige o mesmo — não é regressão).
**Verificado:** "Sanidade da base web" (todo Node puro), `docs-coerentes`; Chromium (27):
`display-smoke`, `tela-rede`, `enquadramento-da-camada`, `telao-no-chao`, `stage-fade`,
`smoke`, `cartao-preso-no-telao`, `imagem-sobre-audio`, `slides-sobre-audio`,
`letra-avulsa`, `restaurar-letra-adiada`, `fundo-da-letra`, `troca-de-versiculo`,
`mensagem-estilo`, `itinerario`, `parar-por-camada`, `apresentacao`, `tela-inteira`,
`preview-volta-ao-wallpaper`, `ponte`, `registro` e os estáticos que leem a cerca.
**O operador:** nada a fazer; a v1.13.18 chega sozinha (só web, nada que ele veja).

### W3 · Módulos puros — feita (2026-11-05)

Sem repasses endereçados à W3. Lidos os onze módulos inteiros (código sem comentário).
**Corrigido (código):** `pacote.js` — a `FORA` dizia `'yt-intencoes'`, a chave é
`'ytIntencoes'` (nunca foi outra): as intenções de download viajavam no `.avpkg` e o
destino rebaixava, na abertura (dentro de 6 h), vídeos que nunca pediu. Asserção nova no
`pacote.test.mjs`: toda entrada de `FORA` é literal na base (fora as órfãs do clone);
reversão reprova. **Só-do-oráculo, removidas com a asserção:** `AVSorteio.sortear` (o app
usa `baralhar`), `AVCifra.somenteLetra` (auditoria T8), `AVCifra.fracaoDaRolagem`,
`AVHinario.ehInfantil` + `secaoDe`; `urlDeBusca` sem o `extra` (T9). O
`funcao-sem-chamador` ganhou o bloco da superfície dos módulos puros (a exportação
contava como uso); reversão: as quatro reprovam. **Duplicação:** `restanteDaAtual`
→ `ritmoVivo` (equivalente), `ehAlfabetica` → `casa`.
**Oráculo novo:** `bible.test.mjs` (Node puro, no workflow e no `ORACULOS.md`) — as duas
guardas do `stripHtml`; reversão das duas reprova.
**Só comentário (provas 1 e 2):** lápide do `GROUPS`, ponteiros para seções do
`CLAUDE.md` que saíram, o bloco do `daOrigem` reancorado e a cópia dele no `fileUrl`.
**Achado e não corrigido:** exportações de nomes só internos (não é código morto);
o `ritmoDaRolagem` ainda desconta a ABERTURA que o comentário diz ter saído
(comportamento visível — pergunta, não diff); prosa de lote longa no `fileUrl` e no
`aindaNaoSaiu`; o bloco de PARÂMETRO do `funcao-sem-chamador` também não vê função
exportada (o nome solto na exportação o faz desistir) — sem dono (A5 feita).
**Verificado:** Node puro, `docs-coerentes` e "Sanidade da base web"; Chromium (24):
`smoke`, `boot-nativo`, os quatro `pacote-*`, os quatro `sorteio-*`, os quatro `cifra-*`,
`hinario-tela`, `louvorja-url`, as duas `biblia-*`, `lista-da-biblioteca`,
`download-do-acervo`, `linha-da-preparacao`, `gaveta-no-download`, `pptx-video-na-pagina`,
`serie-mantem-a-semana`, `aviso-de-importacao` — 23 verdes; `cifra-tela-cheia` reprova
AQUI igual no HEAD (`setViewportSize` sobre janela em tela cheia, Playwright local fora do
pin): ambiente, a prova é o CI.
**O operador:** nada a fazer; a v1.13.19 chega sozinha (só web).
