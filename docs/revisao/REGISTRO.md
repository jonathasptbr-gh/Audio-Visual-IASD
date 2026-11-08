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
| 10 | C1 | feita | v1.13.20 (só web) | 2026-11-05 | nenhum defeito de culto na fatia; `clearCurrentSelection` em `updateState` (+ asserção com reversão); 2 trechos de código morto da preview/peso; ~20 lápides e fatos velhos nos comentários |
| 11 | C2 | feita | v1.13.21 + v1.13.22 (só web) | 2026-11-05 | o giro e o "Preencher" tocados com um `load()` em voo deixavam de valer no Controle (consertado + asserção com reversão, os dois); `cenaDeRoteiroNoAr` sem a régua duplicada; 3 `renderLibrary()` órfãos da Bíblia; ~30 lápides e fatos velhos |
| 12 | C3 | feita | v1.13.23 (só web) | 2026-11-05 | nenhum defeito de culto na fatia; `moverNaLista` (repasse W1, fatia C4) pela forma atômica do `listSet` (+ asserção com reversão); `TOOLS_ANIM_MS` copiava o token que dizia ler; ~60 comentários (lápides, fatos velhos, um bloco no símbolo errado) |
| 13 | C4 | feita | v1.13.24 (só web) | 2026-11-05 | nenhum defeito de culto na fatia; o botão do Cronograma/playlist desfeito por um `load()` em voo (`listasSeq` + asserção com reversão); repasse C2 do `renderTabs`; ~45 comentários (lápides, fatos velhos, um bloco no símbolo errado) |
| 14 | C5 | feita | v1.13.25 (só web) | 2026-11-05 | nenhum defeito de culto na fatia; o "Tocar agora" desfeito por um `load()` em voo (`listasSeq` + asserção com reversão, repasse C4); a ABERTURA da rolagem da cifra descrita como regra (repasse W3, decisão do operador); 2 variáveis mortas; ~90 comentários (lápides, fatos velhos, 4 blocos no símbolo errado) |
| 15 | C6 | feita | v1.13.26 (só web) | 2026-11-05 → 2026-11-06 | nenhum defeito de culto na fatia; a letra mandada à playlist/Favoritos ficava fora da lista em memória (consertado + asserção com reversão); o repasse do `ytAcaoInterno` refutado por medida; 9 blocos no símbolo errado e ~65 fatos velhos, lápides e relatos |
| 16 | C7 | feita | v1.13.27 (só web) | 2026-11-06 | nenhum defeito de culto na fatia; o sorteio guardado/que vira a fila desfeito por um `load()` em voo (`listasSeq`, repasse C4 confirmado + asserção com reversão); o lote do sorteio consumido sem ação (+ asserção); a Verificação sem o `progresso.js` (+ asserção); ~220 comentários (8 blocos no símbolo errado) |
| 17 | C8 | feita | v1.13.28 (só web) | 2026-11-06 | nenhum defeito de culto na fatia; o link compartilhado ficava fora do Cronograma até a próxima releitura (`load()` no fim do `importShare` + asserção com reversão); o resgate dos downloads em `updateState` (repasse W1 + asserção com reversão); repasse C4 do `redesenharComMiniatura` refutado; ~270 comentários (8 blocos no símbolo errado) |
| 18 | C9 | feita | v1.13.31 (só web) | 2026-11-06 | nenhum defeito de culto na fatia; a folha de conexão nomeava a TV errada com duas telas (`telaoNoAr`, a régua do Registro + asserção com reversão); os repasses C4/C6 de `plItems` refutados; código morto da transmissão; ~290 comentários (1 bloco no símbolo errado) |
| 19 | S1 | feita | v1.13.39 (só web) | 2026-11-08 | nenhum seletor morto nem token órfão; ~67 lápides "saiu na vX" removidas/condensadas (regras intocadas, prova 1 do CLAUDE.md) |
| 20 | S2 | feita | v1.13.40 (só web) | 2026-11-08 | nenhum defeito de culto; 4 regras mortas e 3 classes mortas do HTML fora; ~31 lápides removidas/condensadas (regras intocadas, prova 1); visuais não capturados (sem Chromium) |
| 21 | K1 | em curso (2026-11-08) | | | |
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
| K4 | A4 | `EspelhoServidor.servirMidia` — o KDoc diz que item em crescimento só sai em `chunked`; conferir contra o `alcanceDe`. O `EspelhoHttpRangeTest` cita o §6 do `TELAO-POR-COMANDOS.md`, que continua existindo (condensado). Não verificados na A4: `EspelhoPares.validar` aceitar token nu e o Cookie ser ignorado (saíram do doc por não terem prova) |
| K2 | W1 | `NativeBridge.kt`:`bgProgress` (~951) — linha de comentário duplicada ("Só o Controle, como os onze irmãos…" duas vezes) |
| K2 | W1 | `NativeBridge.kt`:`apkInstalar` — roda na fila `transferencia` (UMA thread, a dos downloads do YouTube): o APK espera atrás de um download de minutos e o prazo de 15 min do web conta essa espera. Avaliar se a fila é a certa (o web já não mente quando o prazo vence: v1.13.17) |
| K1 | W1 | `MainActivity.kt`:`pendingShare` (~169/731) — slot ÚNICO (`AtomicReference.set`): dois shares que chegam antes de o web bombear sobrescrevem o primeiro. SUSPEITA, sem medição |
| X3 | W2 | `tools/enquadramento-da-camada.test.mjs` — age (`applyRotate`, `send`) logo depois de `__avBack` existir, SEM `esperarCortina`: com o `init()` ainda em voo, o `load()` dele desfaz o giro (repasse C2). Reproduz com `Emulation.setCPUThrottlingRate` 20× (8× passa). Conserto do oráculo: `esperarCortina` depois do `goto`; a asserção do C2 é outra (girar DURANTE um `load()` em voo) |
| X2 | C2 | `controle.js` ~1397 (fatia C1): o comentário de `bibleCompleteVersions` diz que o Set existe "pra a tela de livros mostrar \"completa\"" — quem mostra é a folha de versões (`renderBibleVerList`); a C1 já está feita (uma linha de comentário, provas 1 e 2) |
| X3 | C2 | `tools/pacote-importar-marcados.test.mjs` H/L — reprovou UMA vez no CI (run `42060562112`, 1ª tentativa, lote só da Bíblia, sem relação): `obtido: []` (nenhuma mídia no destino depois do Importar com só a série marcada). Passou 3× local e no run anterior. Suspeita no ORÁCULO: `importarPelaJanela` faz `pg.evaluate(() => window.__fim)` sem que nada atribua `__fim` (só o `null` da linha 421) — não espera a importação; quem espera é o `responderDialogo` (60 s), cujo `texto` ninguém confere: se o diálogo que ele respondeu não foi o "Acervo importado", o `lerDestino` lê antes do fim. Conserto provável: esperar o diálogo pelo TÍTULO "Acervo importado" (ou `!pacoteEmCurso`) e conferir o `texto` |
| X2 | C4 | `controle.js`:`adicionarNasListas` (~6536) e `abrirPacote` (~6796), fatia C2 já feita — `plItems = await AVDB.listItems('playlist')` depois de gravar, sem a senha `listasSeq` (v1.13.24): um `load()` em voo que leu a fila antes aplica a cópia velha depois. Conserto: `++listasSeq` antes do primeiro `await`, como `togglePlaylist`. E o KDoc do `load` (~4070) diz que "todo `db-change`" dispara um `load` — não há `db-change` em lugar nenhum |
| X2 | C7 | `docs/ORACULOS.md`, linha do `hidratacao-perde-a-vez`: descreve os blocos 1–7 e o 12 (entrou na C7), mas não os 8–11 (C3–C6). E as linhas do `sorteio-lista-de-resultados` e do `verificacao-do-sistema` não citam as asserções novas da C7 (a recusa no bloco C; o `AVProgresso` no L1) |
| S2 | S1 | ~~`controle.css` 2ª metade: as lápides `.bible-ref-label` ("SAIU na v1.8.83", ~L6761) e "MICROFONE AO VIVO … saiu na v1.8.89" (~L6785)~~ — **tratadas na S2**: a primeira virou a regra viva do `currentColor`; a segunda saiu inteira |
| X2 | S2 | `controle/index.html`: `#testeFecho` e `#bibleTitle` são ids sem leitor (o `#testeCorpo` NÃO — é gancho do `verificacao-do-sistema`); classificar junto com os demais achados da auditoria. E a varredura de id/`<symbol>` sem consumidor do HTML continua valendo para quem tiver o DOM. |
| X3 | S2 | `tools/pares-de-comentario.mjs` não entende comentário CSS de várias linhas: `ehComentario` só reconhece linha iniciada por `//`, `/*`, `*` ou `#`, então um bloco `/* … */` com continuação sem `*` termina na 1ª linha e o `alvo` vira a 2ª linha do PRÓPRIO comentário — na S2, 7 blocos reescritos acusaram "mudou de alvo" sem trocar de destino (confirmado: HEAD×HEAD passa com 1169 blocos, e cada bloco acusado continuava antes da MESMA regra). Conserto: estado de "bloco aberto" até `*/`; reversão = HEAD×HEAD verde e um bloco deslocado de propósito reprovar (o caso JSDoc da `AUDITORIA-2026-08` M1 já era conhecido). |

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

### C1 · Abertura, preview, áudio — feita (2026-11-05)

Cerca: `controle.js` do início até `// ===== carregar + render =====` (4.074 linhas), lida inteira.
**Corrigido (código, commit à parte):** `clearCurrentSelection` (repasse W1) — `getState` +
`setState` sobre `current` desfazia um `persistCurrent` gravado no vão; agora `updateState` com
`fn` síncrona. Asserção no bloco 6 do `hidratacao-perde-a-vez` (limpeza × `persistCurrent`
juntos, e a limpeza sozinha); reversão: o par antigo reprova a 1ª (2/2), `fn` que nunca limpa a 2ª.
**Código morto:** `medirColecao` sem `falta`/`exato` (ninguém lia; o comentário prometia o "~");
o ramo `view`/`fit` do `aplicarNaPreview`, idêntico ao `preview.handle` do fim.
**Só comentário (provas 1 e 2):** repasse A4 (`DEST_ICONE` → `ICON[d.ico]`); lápides do tema
automático, `tabsEl`, badges, `#hymnSearchBtn`, ícones que saíram, `ehSerie`, `fmtBytesPar`, o
diálogo de dados móveis e o player do YouTube da preview (3 casas); fatos: "CINCO" lugares do
`ehLink` (são 4), índices "exibidos à parte" (só no Registro), o rodapé do `otaRow`, o
`MediaRecorder` do `medirAudio`. Narrativa verbatim na seção v1.13.20 do histórico.
**Achado e não corrigido:** o atraso da preview é SEMPRE zero (toda tela tem `comando: true`) —
o bloco o declara rede de segurança, e removê-lo atravessa a C9; `tempoDaPreview` repete
`alvoDaPreview` (gosto); `updateState` grava `current = undefined` numa instalação nova; prosa
longa que é REGRA com o porquê ("UM NÚMERO SÓ", miniaturas, grupos, "O SOM NÃO VAZA", prévia).
Réguas (`midiaNoAr`/`cenaNoAr`/`haDestinoDeProjecao`/`algumaTelaConectada`) coerentes com o que
cada bloco nomeia; os timers da fatia se desarmam. **Repasses:** C2.
**Verificado:** "Sanidade da base web" (todo Node puro, `docs-coerentes`), `tokens`; Chromium (43,
todos verdes, Playwright local 1.63): `hidratacao-perde-a-vez`, `smoke`, `display-smoke`,
`boot-nativo`, `db-gc`, `db-estado`, `cena`, `transporte-sem-cena`, as de prévia, saída de áudio,
telão, dados móveis, servidor, acervo, `enquadramento-da-camada`, `ota`, `destinos` e a letra/texto.
**O operador:** nada a fazer; a v1.13.20 chega sozinha (só web, nada que ele veja).

### C2 · Render, fila, Bíblia, destinos — feita (2026-11-05)

Cerca: `controle.js` de `// ===== carregar + render =====` a antes de `// ===== Cronômetro / Relógio / Timer` (3.762 linhas), lida inteira.
**Corrigido (código, commit à parte):** o repasse W2 com o "Preencher" (pedido do operador) — `load()` lia
`fit`/`rotate` na FASE 1 e os reaplicava na FASE 2, desfazendo no Controle (tile e preview) um `applyFit`/
`applyRotate` gravado no vão, com o telão no valor novo. Agora `fitSeq`/`rotSeq` (uma senha por chave, como o
`favSeq`), incrementados nos dois `apply*` (C8, só a linha do `++`). Asserção: bloco 7 do `hidratacao-perde-a-vez`
(tocar depois que o `load()` JÁ leu `rotate`; variável, `data-estado` do tile e preview) + a metade "sem toque
restaura do banco". Reversão: sem a guarda do giro reprova só o giro (`rot: 0`); sem a do fit, só o fit.
**Duplicação/código morto:** `cenaDeRoteiroNoAr` reescrevia termo a termo `provedorDeTextoNoAr` → `!!provedorDeTextoNoAr()`;
três `renderLibrary()` da Bíblia órfãos da v1.5.0 (redesenhavam o Cronograma a cada toque de capítulo).
**Só comentário (provas 1 e 2):** repasse C1 (`DESTINOS` → a regra; a frase no `destinos.test.mjs`); `criarCue`
dizia o contrário do código; a Bíblia "sem scroll"; a lista "zerada a cada troca de aba" do `visualSession`;
cabeçalhos do `renderBibleReading` e do `ensureBibleVersionDownloaded`; "os quatro `hide*`" (são seis); o
`load()` "condicional" do `adicionarNasListas`; `adicionarNaLista` no `CONTROLE.md`. Lápides: `adicionarNaLista`,
`renderTabs`, `renderFavHeader`, o microfone, o ✓ da versão escolhida, o lapso do `hideMessage`, `has-items`.
Narrativa verbatim (31 blocos) na seção v1.13.21 do histórico.
**Corrigido na v1.13.22:** a SUSPEITA do `changeBibleVersion` sem rede, MEDIDA (pílula/folha na nova sobre o texto da velha, navegar na velha, retocar não tentava): a falha
desfaz a escolha (`updateState`) e avisa no cartão da preview (bloco H, reversão 3 de 3); e o sucesso ATRASADO não sobrescreve a escolha mais nova (bloco I, reversão reprova).
**Achado e não corrigido:** prosa longa que é REGRA com o porquê (os pares da hidratação, a fila como host de
miniaturas, a camada visual, o rodapé das Ferramentas, `scrollActiveIntoView`). Réguas `haOQueParar` × `cenaNoAr`
× `midiaNoAr` coerentes com o que cada bloco nomeia; nenhum timer/listener que não se desarme; o `applyTitleMarquee`
não roda por `display-status`. **Repasses:** X2 (comentário da C1, ~1397), C4 (`CONTROLE-BIBLIOTECA.md`, `renderTabs`).
**Verificado:** "Sanidade da base web" (todo Node puro, `docs-coerentes`), `tokens`; Chromium (51, Playwright local 1.63): 50 verdes (`smoke`, `display-smoke`, `destinos`, `enquadramento-da-camada`, `boot-nativo`, as `biblia-*`, `cena`, `hidratacao-perde-a-vez`, transporte, fila, letra, camadas, Ferramentas, sorteio, itinerário…); `controles-layout` reprova IGUAL no commit anterior (`setViewportSize` em tela cheia, ambiente).
**O operador:** nada a fazer; a v1.13.21 chega sozinha (só web). O giro e o Ajustar/Preencher deixam de "voltar".

### C3 · Ferramentas — feita (2026-11-05)

Cerca: `controle.js` de `// ===== Cronômetro / Relógio / Timer` a antes de `A ALTURA DO RODAPÉ FLUTUANTE É LIDA` (3.679 linhas), lida inteira; mais o repasse W1 endereçado à C3 (`moverNaLista`, que mora na C4).
**Corrigido (código, commits à parte):** `moverNaLista` — `listIds` + `listSet(nome, array)` desfazia um `listAdd` do vão (o download que termina
por `addMediaToList`): o item sumia da lista e o coletor do `listSet` apagava o registro. Agora a forma atômica (a troca na transação que grava).
Asserção: bloco 8 do `hidratacao-perde-a-vez` (espião põe o `listAdd` no vão da forma antiga + um concorrente; o item fica na lista e no banco; o
mover anda; sozinho, devolve). Reversão: a forma antiga reprova a 1ª (`existe: false`).
**Duplicação:** `TOOLS_ANIM_MS = 220` dizia ler o `--tools-anim` e era cópia: `msDaToolsAnim()` o lê (sem token, zero); o comentário do CSS e do `ferramentas-folha` acompanham.
**Só comentário (provas 1 e 2):** fatos — "terceiro/quarto provedor" e "outros cinco" (são sete), as "DUAS ROLETAS" (três), a ordem da fileira do
Cronograma contradita pelo excluir em primeiro, a nota da PASTA no Cronograma; o bloco "O ITEM em px" encabeçava `valorNaPista` (foi para
`roletaItem`; a prova 2 o acusa de propósito, e a outra acusação é um `/**` que perdeu o lápide colado, mesmo alvo). Lápides: presets, `p.vista`,
`chronoSetMode`, `chronoSegBtn`, segmentado, "Reiniciar"/"Sortear", "+ Nova mensagem", desvio por aba, alça de arrastar, `&& !dl`. Narrativa de lote
(pedidos e relatos do operador, "(vX.Y.Z)") encurtada à regra; verbatim (59 blocos) na seção v1.13.23 do histórico.
**Achado e não corrigido (SUSPEITAS, sem cenário medido):** o "baixar o vídeo" de uma linha de link termina em `currentId === item.id → send(rec.id)`
(seleção, não `midiaNoAr`; mas o `send` de um link nunca escreve `currentId`, então o ramo é quase inalcançável); a estrela de uma mensagem decide
pelo `cueFav` do desenho, e dois toques antes do redesenho (`PULSO_MS`) repetem a ação; `saveItin` engole a falha de gravação. Prosa longa que é REGRA com o porquê
(as roletas, o "O operador escreveu 0 a 24", `acertarRoletas`, o itinerário múltiplo, a troca de vista animada). Réguas: a fatia não lê `midiaNoAr`/
`cenaNoAr`/`haOQueParar` (só os `*Projecting()` das próprias sessões, coerentes). Timers: os quatro laços (`chronoPanelTimer`, `drawPanelTimer`,
`itinPanelTimer`, `ferrGradeTimer`) param no `renderDiversos`/`fecharFerramentas`, e o da grade se desliga sozinho sem linha à vista; os
`ResizeObserver` das roletas reconectam por render e o do horário desconecta no fecho. Nenhuma medida de layout por quadro (o tique só escreve texto).
**Repasses:** nenhum.
**Verificado:** "Sanidade da base web" (todo Node puro, `docs-coerentes`), `tokens`; Chromium (35 da vizinhança, Playwright local 1.63, três processos): 33 verdes (`hidratacao-perde-a-vez`, `ferramentas-folha`, `itinerario`, as `sorteio-*`, `mensagem-estilo`, `teclado-das-folhas`, `eixo-de-acao`, `cena`, `boot-nativo`, `smoke`, `display-smoke`, `tela-rede`, `destinos`…); `controles-layout` e `cifra-tela-cheia` reprovam IGUAL no commit anterior (`setViewportSize` em tela cheia, ambiente).
**O operador:** nada a fazer; a v1.13.23 chega sozinha (só web). Mover um item do Cronograma enquanto um vídeo termina de baixar não o some mais.

### C4 · Cronograma, Biblioteca, séries, favoritos — feita (2026-11-05)

Cerca: `controle.js` de `A ALTURA DO RODAPÉ FLUTUANTE É LIDA` a antes de `// ===== A ABA DE CIFRA (v1.1.7)` (5.505 linhas), lida inteira; mais o repasse C2 (`renderTabs` no `CONTROLE-BIBLIOTECA.md`).
**Corrigido (código, commit à parte):** `toggleCronograma`/`togglePlaylist` gravavam e reliam a lista; um `load()` que a leu ANTES do toque aplicava a
cópia velha DEPOIS — o item no banco e fora de `cronoSet`/`libItems`/`plItems` (fora da tela e da fila do ⏭) até o próximo `load()`. Senha `listasSeq`
(a classe do `favSeq`), incrementada pelos dois toques; o `load()` só aplica as três se ninguém a moveu. Asserção: bloco 9 do `hidratacao-perde-a-vez`
(espião segura o `load()` depois da leitura da lista; o toque inteiro; a hidratação continua) + a metade "sem toque restaura". Reversão: sem o conserto
as duas primeiras reprovam (`cronoSet/libItems/plItems: false` com o item no banco).
**Doc:** o parágrafo do `renderTabs` diz onde os Favoritos moram (a gaveta saiu na v5.294, a função na v1.5.0).
**Só comentário (provas 1 e 2):** fatos — "OS FAVORITOS TÊM DUAS CASAS" contra o próprio corpo (e os comentários de `renderFoldersSeVisivel`,
`toggleFav`, `recarregarFavoritos`), "arrastando"/"alça de arrastar", as guardas do `send` ("duas"/"três" — são quatro), o "check (verde)". Lápides: a
ORIGEM que o `send` derrubaria (sem código), `wifiIconEl`, ✓ do renomear, `listIconSvg`, `gearIconSvg`, voz/nota, paleta das coleções, "BAIXAR TODA A
BIBLIOTECA", `buildCollectionOptions`, `hymnalStat`, painel de opções, "TRAZER UMA PASTA", `renderStorageUsage`, `fmtParBytes`, "VER TODOS". Bloco no
símbolo errado: a "seta para cima" encabeçava `chevronDirSvg` (foi, condensado, para `chevronUpIconSvg`). 35 citações de pedido/relato do operador
saíram; verbatim (56 blocos) na seção v1.13.24 do histórico.
**Achado e não corrigido:** SUSPEITAS — `toggleCronograma`/`togglePlaylist` decidem pelo estado em memória, e dois toques antes do primeiro `await`
fazem `listAdd` duas vezes (idempotente: fica dentro, sem divergir); `verificarSemanaAoAbrir` deixa o piso de 5 min armado se `syncCollection`
LANÇAR (o `.catch` vazio), sem aviso. Prosa longa que é REGRA com o porquê (a faixa da linha, a confirmação, `interacaoAbertaNoAcervo`, a tampa, o
`send`, `repeticaoPode`; ~35 citações do operador cuja frase seguinte depende delas ficaram). Réguas: o Parar e o Modo Fácil leem `haOQueParar`, o ▶
`currentId || haOQueParar`, a repetição `plItems || currentId`, ⏮/⏭ `transportePode` — cada uma com o porquê escrito e coerente. Timers/listeners: o tique
coalescido se rearma só com o acervo à vista; `segurarAcervo` solta por prazo; o `IntersectionObserver` da paginação desconecta; nenhuma medida de layout
por quadro (o `ResizeObserver` da tampa espera a janela parar). Séries: a playlist prova, o título rotula — a fatia só desenha (`AVSerie`).
**Repasses:** X2, C5, C6, C7, C8, C9 (os outros escritores de `plItems` sem `listasSeq`; o "todo `db-change`" de dois KDocs).
**Verificado:** "Sanidade da base web" (todo Node puro, `docs-coerentes`), `tokens`; Chromium (58 da vizinhança, Playwright local 1.63, três processos): todos verdes (`hidratacao-perde-a-vez`, `smoke`, `display-smoke`, `boot-nativo`, `destinos`, `cena`, as de acervo/série/semana/favoritos/gaveta/tampa/transporte/fila/Modo Fácil…).
**O operador:** nada a fazer; a v1.13.24 chega sozinha (só web). Um item posto no Cronograma ou na playlist durante uma atualização da lista não fica mais de fora.

### C5 · Cifra, leitura, transporte e seleção — feita (2026-11-05)

Cerca: `controle.js` de `// ===== A ABA DE CIFRA (v1.1.7)` a antes de `// ===== Coleções de mídia (LouvorJA) — sincronização` (4.701 linhas), lida inteira; mais os três repasses (W1 e W3 fora da cerca, nominais).
**Corrigido (código, commits à parte):** `replacePlaylistWith` (o toque numa linha e o "Tocar agora") gravava a fila sem `++listasSeq`: um `load()` que leu a
playlist antes aplicava a fila VELHA depois (`plItems` com a de antes, banco com o item novo; o fim da faixa e o ⏭ seguiam a fila trocada). Senha antes do
primeiro `await`. Asserção: bloco 10 do `hidratacao-perde-a-vez` (espião segura o `load()` depois da leitura da playlist). Reversão: sem o conserto reprova
(`plItems` com o item antigo). `cifraProcurar`: `crus` e `consulta` declarados e nunca lidos (sobra da escolha à mão).
**Repasses tratados:** W3 — `cifra.js` (`ritmoDaRolagem`, a janela) e o bloco da rolagem do `controle.js` diziam que a ABERTURA saiu; agora a descrevem como
regra (o tempo da introdução, decisão do operador), cálculo intocado. W1 — `serieDiarioGravar` (fatia C6) cita o `verificarSemanaAoAbrir` no lugar do "Atualizar a lista".
**Só comentário (provas 1 e 2; a 2 acusa os 4 movimentos, de propósito):** fatos — a radiografia "só do `ilegivel`", "nada apaga entrada do cache", o
`then` "acima", o diário "com o TETO", o `crus` "do seletor", o "Início" da capa, as "quatro escritas de array" da fila (são três), o Limpar "disabled",
a "GAVETA" do `navigateBack`, o `.pptx` "sem quem desenhe" no MIME, um desfecho de pasta duplicado. Lápides: coletor/bateria, tentativa 0, teto/prazo de
passada, guarda de teclado, `cifraDesvio`, nota da barra (um bloco solto), prévia, cinco frases de falha, `semSelecao`, deslize, arrastar, `'folders'`,
`garantirGaveta`, `refreshOpfsFolderCount`, `openOpfsFolder`. Blocos no símbolo errado: os do `cifraGarantir`, `syncCifrasAcervo`, do selo "● No ar"
(`pintarSubNoAr`) e do "Acrescenta os SELECIONADOS" (`addSelectedToPlaylist`). Pedidos/relatos do operador saíram; verbatim (90 blocos) na seção v1.13.25 do histórico.
**Achado e não corrigido (SUSPEITAS, sem cenário medido):** duas réguas de "esta linha está no ar" — `noArAgora` (`item.id === currentId && midiaNoAr`, decide
projetar × retirar) e `linhaNoAr` (`midiaNoArId`, pinta o selo); divergem se `currentId` mudar com outra mídia no ar. O ramo não-Bíblia do `navigateBack` parece
inalcançável (o `bibleBackEl` só aparece na Bíblia). A ABERTURA não é mais uma pausa parada (desde a rampa da v1.6.2): ela faz a folha percorrer em `t1 − t0`,
isto é, mais depressa — o comentário diz o que a conta faz; se o operador espera uma folha PARADA no início, é pergunta. Réguas: `cifraDuracaoNoAr` e
`rotinaDeAcervoPodeCorrer` leem `midiaNoAr` (coerentes). Timers/listeners: `cifraCronoTimer` coalesce; os timers de `falhaItem` se limpam; `fullscreenchange`,
`resize`, `ResizeObserver` do corpo são um só cada; o laço rAF da rolagem lê `scrollHeight` por quadro (é a rolagem) e para no fim da folha e fora da aba.
**Repasses:** nenhum novo.
**Verificado:** "Sanidade da base web" (todo Node puro, `docs-coerentes`), `tokens`; Chromium (56 da vizinhança, Playwright local 1.63, três processos): 55 verdes (`hidratacao-perde-a-vez`, as `cifra-*` menos uma, as `leitor-*`, `smoke`, `display-smoke`, `boot-nativo`, `cena`, `destinos`, `repeticao-e-sequencia`, `parar-por-camada`, `limpar-cronograma`, `cronogramas-multiplos`, as de Modo Fácil…); `cifra-tela-cheia` reprova IGUAL à C3 (`setViewportSize` em tela cheia, ambiente local).
**O operador:** nada a fazer; a v1.13.25 chega sozinha (só web). Tocar um item enquanto o app atualiza a lista não traz mais a fila antiga de volta.

### C6 · Sincronização do acervo, busca e YouTube — feita (2026-11-05 → 2026-11-06)

Cerca: `controle.js` de `// ===== Coleções de mídia (LouvorJA) — sincronização` a antes de `// ===== "Baixando" na LINHA da música` (6.354 linhas), lida inteira; mais o repasse C4 (`ytAcaoInterno`).
**Corrigido (código, commits à parte):** `addLyricCue` (a variante "Letra" mandada a listas) gravava a cena e não relia a lista em memória: com a playlist, a
cena ficava fora de `plItems` (fora da tela e da fila do ⏭) até o próximo `load()`; com Cronograma + Favoritos, fora de `favItems`. Relê as duas e move
`listasSeq` antes do 1º `await`. Asserção: bloco 11 do `hidratacao-perde-a-vez`. Reversão: sem o conserto as duas reprovam; sem só a senha, a da playlist.
Código morto: a guarda `songMenuFor.folha` do `renderSongMenu` (nada a escreve desde a v5.254).
**Repasse C4 REFUTADO (medido):** `ytAcaoInterno` relê `plItems` sem a senha, mas chama `load()` logo depois — o `++loadSeqCtl` faz o `load()` em voo
descartar o que leu (sonda com a ordem forçada do bloco 9: `plItems` termina com o item). Comentário no ponto; nota aos repasses C7–C9.
**Só comentário (provas 1 e 2; a 2 acusa os 9 movimentos, de propósito):** 9 blocos no símbolo errado (cabeçalho da fatia, índice de coleção/série,
atualização automática, a ROTINA da semana, `downloadCollectionSong`, as duas causas do censo, `buildLyricSlides`, as duas portas da Biblioteca, a folha do
YouTube, a gaveta de um vídeo). Fatos: transmissão e "Online" (v1.7.7) em 8 funções; "shell ≥ 23/25/28", "< 18", "antigo"; o teto que "nasce no padrão"
(gruda); "1080p é o padrão"; a gaveta com a letra; a regra antiga dos destinos; o confirmar "só com algo marcado"; séries "marcadas" e o download "item a
item"; "Nenhuma música encontrada"; `withBgWork`. Lápides: `serieAuto` e o seletor, `serieAutoEstado`, uso do disco, `modo`, `openSongMenu`, o mDNS do
`closeSongMenu`. Pedidos/relatos do operador saíram; verbatim (74 blocos) na seção v1.13.26 do histórico.
**Achado e não corrigido (SUSPEITAS, sem cenário de culto):** `resolverSemana` deixa `semanaPendente` armado se o download falha — o próximo `send` o
consome (e só ancora se for o MESMO episódio). `acertarSombraDasPortas` lê dois `getBoundingClientRect` por evento de rolagem da Biblioteca (barato, e só
escreve quando vira). `syncLyrics` (só `cellular` adia) e a rotina da semana e os fundos (Wi-Fi confirmado) leem a rede por réguas DIFERENTES de
propósito, cada uma com o porquê escrito. Réguas de "no ar": a fatia lê `midiaNoAr`/`rotinaDeAcervoPodeCorrer` (coerentes). Timers/listeners: `ytAutoObs` desconecta
a cada render; `ytRedesenhoTimer` rearma só com gaveta aberta; o `MutationObserver` do véu é um só (medido no próprio comentário).
**Repasses:** C7 C8 C9 (a nota sobre `load()` depois da releitura).
**Verificado:** "Sanidade da base web" (todo Node puro, `docs-coerentes`); Chromium (54 da vizinhança, três processos): todos verdes (`hidratacao-perde-a-vez`, `smoke`, `display-smoke`, `boot-nativo`, `cena`, `destinos`, `tokens`, as de acervo/série/semana/busca/gaveta/YouTube/link/pacote/Modo Fácil…).
**O operador:** nada a fazer; a v1.13.26 chega sozinha (só web). Mandar só a letra para a playlist ou os Favoritos aparece na lista na hora.

### C7 · Downloads, playlist automática e Registro — feita (2026-11-06)

Cerca: `controle.js` de `// ===== "Baixando" na LINHA da música` a antes do cabeçalho do pacote de transferência (6.783 linhas), lida inteira; mais o repasse C4.
**Repasse C4 CONFIRMADO (medido):** `guardarSorteadas` (ramo da playlist) e `montarFilaSorteada` releem `plItems` SEM `load()` depois (o `send` não o chama): com a ordem
forçada do bloco 9, o sorteio guardado ficava fora de `plItems` e o que vira a fila deixava a fila velha em memória. `++listasSeq` antes da 1ª escrita (o 1º `await` é o
consentimento/download). Bloco 12 do `hidratacao-perde-a-vez`; reversão: sem o conserto as duas reprovam. O KDoc de `listasSeq` (fatia C2) ganhou os dois nomes.
**Corrigido (código, commits à parte):** `executarSorteio` consumia o lote (`sorteioConsumir`) mesmo quando guardar/tocar desistia (download recusado, nada baixável,
cancelar), contra o próprio comentário; os três devolvem se aconteceu. Asserção no bloco C do `sorteio-lista-de-resultados` (reversão reprova). A Verificação ("chegaram" e
"RODARAM") listava os módulos à mão sem o `progresso.js`/`AVProgresso`: verde sem ele. Asserção L1 no `verificacao-do-sistema` (reversão reprova).
**Só comentário (provas 1 e 2; a 2 acusa 6: 5 movimentos de propósito + 1 cabeçalho genérico):** 8 blocos no símbolo errado (o "Devolve" do `previewBusy`, o JSDoc
órfão da pílula que partia o do `SORTEIO_ICONE`, AS COLETÂNEAS, OS FUNDOS DA LETRA, o `version.json` do bundle, O ÁUDIO DO APARELHO, dois órfãos que saíram). Fatos: o "botão
de copiar" do Registro (é o arquivo), `pintarContaSorteio`, a pílula, o `.avpkg` da fila, `listSet` × `trocarFila`, a ordem dos blocos, "shell 31/45/59/69/79". ~15 lápides;
pedidos/relatos do operador saíram; verbatim (222 blocos) na seção v1.13.27 do histórico.
**Achado e não corrigido (SUSPEITAS, sem cenário de culto):** `rodarUmaChecagem` não limpa o `setTimeout` do prazo quando a checagem responde antes (inofensivo: resolve
uma corrida já decidida). O Registro do download de teste ainda diz "APK anterior à v1.12.31" quando a medida do shell não vem (com o piso 83 a única causa é outro download
por cima) — frase de log, deixada. `tocarSorteada` devolve `true` mesmo se `playSongVariant` falhar (ela não diz o desfecho): o lote sai como antes nesse caso.
Réguas de "no ar": a fatia lê `midiaNoAr` (download de teste, Verificação) e `haOQueParar` (Registro da atualização), cada uma igual à porta que descreve. Timers/listeners:
o aquecimento do sorteio desarma no fechar; o `qhObs` desconecta a cada roleta; nenhum ouvinte por rodada (o `testeDiagRecebidos`).
**Repasses:** X2 (o `ORACULOS.md` sem os blocos 8–11 do `hidratacao-perde-a-vez` e sem as asserções novas). Riscados: C7 de C4 e C6.
**Verificado:** "Sanidade da base web" (todo Node puro, `docs-coerentes`); Chromium (53 da vizinhança, três processos): todos verdes (`hidratacao-perde-a-vez`, `sorteio-*`, `playlist-automatica-estavel`, `verificacao-do-sistema`, `verificacao-completa`, `registro`, `smoke`, `display-smoke`, `boot-nativo`, `cena`, `destinos`, os de acervo/pacote/série/Modo Fácil…).
**O operador:** nada a fazer; a v1.13.27 chega sozinha (só web). Na playlist automática, recusar o download não some com as marcadas.

### C8 · Transferir, share, via nativa e wallpaper — feita (2026-11-06)

Cerca: `controle.js` do cabeçalho `O PACOTE DE TRANSFERÊNCIA` a antes de `// ===== Diálogo padrão do app` (~6.600 linhas), lida inteira; mais os repasses W1, C4 e C6.
**Corrigido (código):** no avançado, um link comum compartilhado (nem YouTube nem apresentação) entrava por `addUrlMedia` sem linha provisória — e era o `load()` do `soltar()`
dela que relia a lista nos outros ramos: o item ficava no banco e fora da tela (MEDIDO: `banco: true, tela: false`). `load()` no fim do `importShare` quando há lista
escolhida, no lugar da releitura avulsa de `plItems` (fecha também o repasse C4 do `importShare`). Bloco 4 do `aviso-de-importacao`; reversão reprova.
**Repasse W1 CONSERTADO:** `resgatarDownloads` lê e zera `ytIntencoes` num `updateState` (era `getState` + `setState`). Bloco 13 do `hidratacao-perde-a-vez` (gancho põe a
intenção nova logo depois da leitura); reversão reprova com `[]`. **Repasse C4 do `redesenharComMiniatura` REFUTADO:** ele chama `load()` antes e não grava lista; a releitura
avulsa de `plItems` era redundante e saiu.
**Só comentário (provas 1 e 2; a 2 acusa 8, todos movimentos de propósito com cabeçalho genérico):** 8 KDocs no símbolo errado reancorados (escritor, `pacotePeso`, a
mescla, a conferência, o percentual, o relatório, os ponteiros, "os três tiles" → `pacoteRenderPar`). Fatos velhos: "a importação não tem cancelar" (2×), a chave de `state`
por `updateState` (vai no lote), "incompletas primeiro" no relatório, a fonte "sobre um `Blob`"/"janelas de 4 MB", "A MEDIÇÃO VEM ANTES DE TUDO" sobre o esboço, a "folha de
escolha" (5×), o SW do `pending-share`, "no TOPO" do `pacoteRenderTiles()`, a "fila de IO" do resgate, os 15 números de linha do `responder`, "shell 16…81"/"shell antigo".
Lápides e relatos/pedidos do operador saíram; verbatim (267 blocos) na seção v1.13.28 do histórico. `ORACULOS.md` ganhou os blocos novos dos dois oráculos.
**Achado e não corrigido:** `responder(btn, tipo)` engole o 3º argumento (frase) de ~14 chamadores — documentado no código; dar voz a eles muda o visível (pergunta ao operador,
não conserto de revisão). A frase "PDF precisa do seletor de arquivos do app (instale a versão nova)" é inalcançável com o piso 83 (deixada: texto de tela). Réguas de "no ar": a
fatia não decide cena (o `esperarTocando` lê `midiaNoArId`, igual à porta). Timers/listeners: a barra do YouTube desarma o `visibilitychange` no `parar`; o freio da
notificação tem UM temporizador; o `pacotePedir` deixa o `setTimeout` do prazo armado depois da resposta (inofensivo: confere a identidade do pedido).
**Repasses:** nenhum novo. Riscados: C8 de W1, C4 e C6 (o C6 segue para a C9).
**Verificado:** "Sanidade da base web" (todo Node puro, `docs-coerentes`); Chromium (49 da vizinhança, três processos): todos verdes (`aviso-de-importacao`, `hidratacao-perde-a-vez`, os `pacote-*`, `apresentacao`, `boot-nativo`, `smoke`, `display-smoke`, `registro`, `ota`…).
**O operador:** nada a fazer; a v1.13.28 chega sozinha (só web). Um link compartilhado ao Cronograma aparece na lista na hora.

### C9 · Configurações, modos, volume e telão por comandos — feita (2026-11-06)

Cerca: `controle.js` de `// ===== Diálogo padrão do app` ao fim do arquivo (7.330 linhas), lida inteira; mais os repasses C4 e C6.
**Corrigido (código):** `renderCast` nomeava `lastDisplays[0]` no rótulo do botão de conectar: com duas telas e o telão na SEGUNDA, a folha dizia "o telão não subiu"
sobre um telão no ar — a divergência que o `descreverTelao` já fechara (v1.8.42) pela régua `telaoNoAr()`. Agora as duas leem a mesma. Bloco 6 do `telao-no-chao`;
reversão reprova (`obtido: Conectado a TV do templo — o telão não subiu…`).
**Repasses C4 e C6 REFUTADOS (lidos):** `pedirSaidaDaFila` não relê nada — os dois `aoConfirmar` chamam `load()` depois de gravar (o `++loadSeqCtl` descarta o que estava
em voo, a medida da C6). `edicaoRecarregarListas` chama `load()` ANTES e não grava lista: a releitura avulsa de `plItems` + `renderPlaylist` era redundante e saiu. O "todo
`db-change` dispara um `load`" corrigido no KDoc do `encerrarCenaDaFila`.
**Código morto:** `confirmarEspelhoComTv` (devolvia `true`, "como registro da decisão") e o `if (espelhoDisponivel())` do `abrirCast` com corpo só de comentário.
**Só comentário (provas 1 e 2; a 2 acusa 1, movimento de propósito com cabeçalho genérico):** o KDoc do `encerrarCenaDaFila` estava sobre o de `fecharFilaVazia`. Fatos:
"recolher a seção cancela tudo" (só oculta), `simpleDisplay` "não decide bloqueio" (decide a cortina), o tema automático no `renderTemaTile`, o `resize` do "vazado da faixa
de abas", o APK "na fila de IO", a "confirmação" do ligar (2 blocos duplicados), o `castAlvo` em 2 blocos contraditórios, o deck em 2 parágrafos contraditórios no
`telaEnriquecer`. ~30 lápides (abas, mesa de som, liberação de teste, `mic-status`, SW, QR, TLS, degraus do voltar…); pedidos/relatos do operador saíram; verbatim
(293 blocos) na seção v1.13.31 do histórico. `ORACULOS.md` ganhou o bloco 6.
**Achado e não corrigido (SUSPEITAS, sem cenário de culto):** `telaReenviarPreferencias` manda o `fit` só se ≠ `contain` — a mesma "coincidência com o nascimento da tela" que o
bloco já recusou para o `lyricsbg` (hoje a tela nasce em `contain`, então não erra) — **resolvida na v1.13.32** (o `fit` vai sem condição); o mesmo defeito no wallpaper (sem imagem própria nada ia), **resolvido na v1.13.33** (vai o padrão). O `telaPedir` deixa o `setTimeout` de 15 s armado depois da resposta (inofensivo:
confere a identidade). A cobertura parcial da resposta atrasada de dois pedidos do mesmo tipo (`telaRespostaCombina`) depende de um `seq` no Kotlin (K4).
Réguas de "no ar": a fatia lê `haOQueParar` (teclas, Biblioteca principal, pergunta da atualização), `midiaNoAr` (reenvio, status, troca de modo, tela cheia do vídeo) e
`haDestinoDeProjecao` (tela cheia), cada uma igual à pergunta que o bloco nomeia. Timers/listeners: o vigia do Modo Fácil e a enquete da conexão têm dono único e
desarmam; o `onCommand` não ganha ouvinte por rodada (o contador da Verificação pega carona).
**Repasses:** nenhum novo. Riscados: C9 de C4 e C6.
**Verificado:** "Sanidade da base web" (todo Node puro, `docs-coerentes`); Chromium (64 da vizinhança, três processos): todos verdes (`telao-no-chao`, `tela-rede`, `smoke`, `display-smoke`, `boot-nativo`, `edicao-de-midia`, `historico`, os de Configurações/Verificação/Modo Fácil/volume/tela cheia/OTA…).
**O operador:** nada a fazer; a v1.13.31 chega sozinha (só web). Com duas TVs ligadas, a janela de conexão diz qual está projetando.

### S1 · CSS — primeira metade — feita (2026-11-08)

Cerca: `controle.css` do início à metade (linha ~6711) + `shared/tokens.css` inteiro, lidos por agente.
**`tokens.css` limpo.** Nenhum token declarado sem leitor (o `tokens.test.mjs` já trava, reconferido à mão: 73 tokens, todos lidos), nenhum duplicado, nenhum não-cor, nenhum `!important`.
**Nenhum seletor morto.** 417 classes + 42 ids cruzados contra JS/HTML: toda ausência é classe construída em runtime (`bg-<grupo>` da Bíblia, `row-nota--<tipo>`) ou menção só em comentário (lápide). Nenhuma regra casava com nada.
**Conferidos e deixados (legítimos):** os 9 `!important` (o `user-select` global, o `[hidden]`, o `display:none` da tela cheia), as 6 sombras `rgba(0,0,0,…)` + `transparent` (exceção NOMEADA em `tokens.css`) e ~6 regras ordem-dependentes deliberadas (`z-index` da `.pv-text`, o `color` das portas). Nenhum é defeito.
**~67 lápides "saiu na vX" removidas ou condensadas** (faixa de abas `.tab*`, `#favHeadBtn`, `.fav-section`, selos `.url-badge`/`.yt-badge`/`.cue-badge`, `.net-badge`, `.coll-bar-*`, `.bible-ver-check`, a lápide autorreferente `.col-1`…`.col-8`, dezenas de parentéticos). Onde o "saiu" trazia razão que ainda vale, virou regra no presente. Prova 1 do CLAUDE.md: o arquivo sem comentário é byte-idêntico ao HEAD (3.703 linhas não-comentário cada).
**Limitação (não correção):** o "seletor que aparece no JS mas não casa com nada" — a metade que só a MEDIDA no DOM pega — não foi avaliado: esta sessão roda sem Chromium. A direção conservadora (literal ausente de JS/HTML = morto) ficou completa; a outra fica como resíduo para quem rodar com navegador.
**Repasses:** S2 (as lápides `.bible-ref-label` e "MICROFONE AO VIVO" na 2ª metade).
**Verificado:** `tokens.test.mjs` verde antes e depois; a Sanidade da base web e os oráculos de Node puro rodam no CI.
**O operador:** nada a fazer; a v1.13.39 chega sozinha (só web, nada que ele veja).

### S2 · CSS — segunda metade — feita (2026-11-08)

Cerca: `controle.css` da metade (linha ~6849) ao fim + `controle/index.html` inteiro, lidos por agente; repasse da S1 tratado.
**Nenhum defeito de culto.** Prova 1: sem comentário, o CSS difere do HEAD só nas 4 linhas das regras mortas (3.703 → 3.699 linhas de código); o HTML, só nas 3 classes mortas. 860 seletores cruzados contra JS/HTML: 20 ausências, todas construídas em tempo de execução (menos as 4 abaixo).
**Corrigido (código, prova 1):** `.misc-row--save`, `.misc-save-btns` e `.song-menu-btn.pacote-leitura` (+`:active`) — regras sem alvo; a listagem do pacote virou `<button>`. No HTML, 3 classes sem CSS nem JS: `app-version`, `splash-marca`, `teste-ocultar`.
**~31 lápides removidas/condensadas** (o que descrevia mecanismo removido saiu; o que ainda é regra virou presente: o 220 livre, o `flex-shrink` do ✕, o `.lv-cifra-cab`, a contagem fora do scroller, o respiro da gaveta). No HTML, 10 lápides de seção viraram a regra viva. Repasse S1 aplicado (as duas lápides da 2ª metade).
**Conferidos e deixados:** o único `!important` (guarda do `.simple-time[hidden]`), os `#000` de `mask-image` (alfa) e as repetições com `animation`/`transition: none` (estado, não acidente).
**Achado e não corrigido:** a varredura no DOM e a captura antes/depois nos dois temas não rodaram — sem Chromium nesta sessão (mesma limitação da S1). `#testeFecho`/`#bibleTitle` sem leitor → repasse X2.
**Verificado:** `tokens` e a Sanidade da base web verdes (Node puro + `docs-coerentes`); `pares-de-comentario` com 7 avisos, todos artefato de cabeçalho reescrito, conferidos um a um (cada bloco antes da MESMA regra; comentários fechados, sem `*/` solto).
**O operador:** nada a fazer; a v1.13.40 chega sozinha (só web). A próxima da fila é a K1 (shell: Activity e invariantes — pede Release).
