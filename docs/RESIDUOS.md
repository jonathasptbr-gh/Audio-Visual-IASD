# Os resíduos declarados

**O problema que este arquivo resolve:** descobrir o que ficou para trás custava
uma varredura inteira, feita dias depois, por quem não estava lá. O agente que
publica o lote sabe — na hora — o que ele viu e não consertou. Esta é a casa
disso.

## A regra

1. **Todo lote que publica declara o seu resíduo AQUI, antes do push** — mesmo
   quando a resposta é "nenhum". Um lote sem linha nesta tabela é um lote sem
   vistoria. A coluna do lote leva a **versão** (`v1.14.16`) ou, sem versão, o
   pacote; o `docs-coerentes` reprova quando a versão do `version.json` não
   aparece aqui.
2. **O que se fecha na mesma sessão não entra aqui.** Viu, consertou, pronto. A
   tabela é para o que NÃO deu para fechar agora.
3. **O fino se resolve na hora, com agente de contexto limpo.** Chamar um
   subagente novo — sem o histórico da conversa — para as tarefas pequenas de
   higienização é o caminho normal, não o excepcional: ele lê o repositório e o
   briefing, e custa pouco porque o contexto dele começa vazio. É a mesma razão
   pela qual a varredura pesada também é delegada (`docs/ECONOMIA.md`).
4. **Toda linha tem dono e tamanho.** Sem `onde` e sem uma ideia de tamanho,
   ninguém consegue escolher o que pegar primeiro.
5. **Linha fechada não se apaga: ganha o commit ao lado.** O histórico do resíduo
   é o que mostra se a mesma coisa volta.
6. **Linha com dono `operador` é DECISÃO pendente** (B1): ela ganha pacote na
   fila (`docs/PEDIDOS-EM-ESPERA.md`) ou, enquanto não ganhar, o
   `tools/estado.sh` imprime essas linhas — ninguém descobre a pendência
   relendo esta tabela. Uma linha decidida sai da tabela de abertos e desce para
   "Fechado/decidido".

## O que é "fino"

Uma linha de resíduo é **fina** quando cabe em uma sessão curta: um comentário
falso, uma asserção vacuosa, um seletor morto, uma contagem velha num capítulo,
uma linha de documentação fora do lugar. Fino **não** quer dizer opcional — quer
dizer que não precisa de decisão de desenho. **O que pede decisão do operador ou
medição em aparelho não é fino.**

## Aberto

**Dono** é quem fecha a linha: `higienização` (agente de contexto limpo, na hora),
`operador` (decisão de desenho ou de custo), `CI` (só o runner prova) ou
`medição` (precisa de aparelho).

| quando · lote | onde | o que ficou | dono | por que não foi agora |
|---|---|---|---|---|
| 2026-11-15 · v1.14.23 | `SessionService.kt:907-909`, `NativeBridge.kt:1053-1054` | o rótulo por unidade do ⏮/⏭ (`slideMode`/`slideLabel`) ficou inalcançável — o web manda sempre `false`/vazio desde que a notificação virou controle de player (~10 linhas com KDoc) | CI | não há compilador aqui; a remoção só se prova no Gradle, e o lote foi só de web |
| 2026-11-14 · v1.14.16 | `site/sonoplastia/index.html` | a captura da lista de Ferramentas mostra seis e o app tem sete ("Editar mídia") | operador | refazer a captura pede o app em tela — **na fila: Pacote 29** (14/11) |
| 2026-11-14 · revisão de 14/11 | `YoutubeGrab.kt` | os campos `initIni/initFim/idxIni/idxFim/codec` da `Faixa`, sem leitor desde que o `dash` saiu (~24 linhas, KDoc junto) | CI | não há compilador aqui; a remoção só se prova no Gradle |
| 2026-11-14 · Pacote 24 | `~/.dsh-github/uso.mjs` | a remedição do custo com o preço do modelo ATUAL não saiu (não há preço publicado confiável na máquina); as tabelas do medidor são de 10/11 e ele aceita `--preco novo cache saida` | medição | preço do modelo atual não medido |
| 2026-11-14 · revisão de 14/11 | `ESTABILIDADE-AV` C2, D2 | pedem medição em aparelho | medição | não há aparelho nesta máquina |
| 2026-11-14 · Pacote 25 | `apk.yml` | a regra "base web mudou ⇒ versão sobe" é contra a última TAG: um segundo lote de web sem subir, depois de um que subiu, passa | CI | o certo é comparar com o canal, e o `sha256` do zip muda a cada empacotamento — pede o hash da árvore |
| 2026-11-14 · Pacote 26 (B9) | `configuracoes-sem-subtitulo` D3, `ferramentas-folha` V, `sorteio-tela` O | os três oráculos cujos números nasceram da FONTE do runner (DejaVu/pixel): reprovam no Chromium desta máquina e passam no runner — o §4 do `ACHADOS-EM-ABERTO` migrou para cá | CI | não se conserta mexendo no app: é a campanha de fontes do CI |
| 2026-11-14 · v1.14.19 | `NativeBridge.kt:1554`, `YoutubeGrab.kt:1820` | dois comentários ainda chamam o botão de "Ver os detalhes" (hoje "Detalhes"); 2 linhas | higienização | mexer em `java/` pede `shellTag` e Release, e o lote é só de web — vai no próximo que tocar o Kotlin |
| 2026-11-14 · v1.14.19 | `site/telas/320/destinos.webp`, `site/sonoplastia/index.html:5532` | a captura da folha do vídeo ainda mostra a legenda "Teto de qualidade", que saiu (a ilustração tem seis marcadores sobre ela); 1 imagem | medição | refazer a captura pede o app em tela |
| 2026-11-14 · v1.14.19 | `tools/estado.sh` | compara com a última tag LOCAL e não avisa que o GitHub tem uma Release mais nova: com a v1.14.13 local e a v1.14.18 no GitHub ele imprimiu "shell mudou desde ela → exige shellTag" sem motivo (`git fetch --tags` resolve); ~5 linhas | higienização | fora da cerca do lote (só web) |
| 2026-11-14 · v1.14.19 | `.dest-largo`, o "Detalhes" na gaveta de um vídeo | foi medido só no Chromium desta máquina e no runner do CI (360×1,25× e 430×1×, com a régua relativa à música): falta ver ao lado dos quatro quadrados no aparelho do operador, com a fonte real dele | medição | não há aparelho nesta máquina |
| 2026-11-14 · v1.14.20 | os balões novos do tour (o deck, a lista do Fácil, as Mensagens, o editor, a Bíblia, a cifra) | medidos só no Chromium desta máquina (390×860 e 360×640; o 1,3× do bloco E só cobre os tours principais): falta ver os balões sobre os botões pequenos do deck e nas folhas, no aparelho do operador, com a fonte real dele; ~25 passos | medição | não há aparelho nesta máquina |
| 2026-11-14 · v1.14.20 | o passo `#pvCastBtn` do `TOURS.avancado` (`semAlvo`) | o texto diz "quando nenhuma tela está conectada, aparece sobre a prévia um botão…", mas o `controle.js` mostra o botão por MODO (app ou Fácil) e o CSS só o colore se há tela; 1 frase | medição | pede ver no aparelho o que o operador enxerga |
| 2026-11-14 · v1.14.20 | `TOURS.simples`, a Liturgia com os vídeos da semana | a fixture do oráculo desenha só as duas linhas fixas (533 e 572): a Liturgia com a série (`serieDisponivel`, só no app) não foi desenhada em teste; o passo aponta o bloco inteiro, então não depende do que há dentro | medição | a série pede a ponte do app |
| 2026-11-14 · v1.14.20 | o Timer em 0:00 e a escolha do editor de mídia vazia | duas arestas que o tour achou: o Timer zerado apaga o ▶ mas deixa o projetar e os dois guardar acesos, e a instalação nova vê três grupos "0 mídias" sem o convite a importar; ~10 linhas | operador | decisão de desenho — **na fila: Pacote 30** (14/11) |
| 2026-11-15 · v1.14.21 | as capturas do site com a fileira do deck (`site/telas/` e `site/telas/320/`: cronograma, biblia, ferramentas, biblioteca, hinario-temas, busca, cronogramas; e playlist e transferir, sob o véu) | mostram o repetir à esquerda da playlist, que trocaram de lugar; ~10 imagens | medição | refazer a captura pede o app em tela |
| 2026-11-15 · v1.14.21 | a barra do sorteio a 360 px (`#sorteioPopup .sorteio-acao`) | no Chromium a 360×640 a estrela dos Favoritos desce para uma segunda linha, e o recorte do passo "Tocar agora e guardar" (a união das ações) engloba o embaralhar; a 390 é uma linha só | medição | ver no aparelho do operador se a barra quebra |
| 2026-11-15 · v1.14.21 | `controle.js`, o `ECO_SELETOR` | inclui `'.transport .t-btn'` inteiro, logo o `#plBtn`, que só abre a folha da playlist — contra a regra do próprio comentário ("fica de fora o que NÃO vai ao telão"); conferir e tirar com `:not(#plBtn)`; 1 linha | higienização | fora da cerca do lote (posição e tour) |
| 2026-11-15 · v1.14.21 | `docs/arquitetura/CONTROLE-LAYOUT.md:33`, `:122` | o diagrama do deck é de antes da v1.3.9 ("Vol" na coluna da direita, o `#historyBtn`); só a ordem da fileira foi corrigida; ~15 linhas | higienização | refazer o desenho pede medir o deck inteiro |
| 2026-11-15 · v1.14.22 | `GuiaSom.kt` (`imprimir`), o caderno impresso pelo app | a impressão pelo `PrintManager` não foi vista em aparelho: o adapter do WebView respeitar o `@page guia-a4 {margin:0}` e o A4 retrato, e a volta da tela de impressão ao guia aberto | medição | não há aparelho nesta máquina, e o Kotlin só compila no CI |
| 2026-11-15 · v1.14.24 | `tools/verificacao-completa.test.mjs`, bloco A5 | a compactação do fecho da Verificação a 320×1,5× não dispara no Chromium DESTA máquina: o `letter-spacing` que simula a fonte do runner não faz o rótulo transbordar. **MEDIDO no HEAD limpo (`56fdf9f3`)**, então não é do lote | CI | mesma família da linha do Pacote 26 (B9): o runner da v1.14.23 passou; aqui reprova por métrica de fonte |
| 2026-11-15 · guia impresso (sem versão; só `site/`) | `site/sonoplastia/index.html`, as pautas largas e a caixa do índice | medidas só no Chromium desta máquina: falta ver no aparelho se a borda de 1,2 pt da caixa e a linha de 0,6 pt da pauta saem na impressora e se a pauta larga não encosta no fio nas pares do fichário | medição | não há aparelho nesta máquina; a régua de páginas (22/88) foi medida aqui e o runner dá outra fonte |

## Fechado/decidido

O que a decisão do operador fechou, ou o que se decidiu deixar como está. Não é
trabalho: é o registro da decisão, para o mesmo assunto não voltar como
resíduo. (B8)

| quando · lote | onde | o que era | a decisão |
|---|---|---|---|
| 2026-11-14 · revisão de 14/11 | `controle.css` | a pílula de volume da tela cheia deitada (C8): a 740×360 o número sai da tela | **deixar como está** (operador, 14/11) |
| 2026-11-15 · v1.14.24 | `controle.js`, o aviso da série (M1-2) | o aviso prometia "desce quando ela sair" sem a rodada armada — a saída da mídia não baixava nada | **fechado** — o aviso arma a rodada (`serieAdiadaPelaMidia`) e o cenário N3 do `serie-mantem-a-semana` prova · v1.14.24 |
| 2026-11-14 · revisão de 14/11 | `capturas/entrada/` | 3,7 MB de JPEG de origem, já convertidos para `site/telas/` | **deixar como está** (operador, 14/11) |
| 2026-11-14 · decisão do operador | `site/sonoplastia/index.html` | 671 linhas de CSS e 1.320 de JS inline, nada cacheável (~33 kB comprimidos de ~206 kB; o corpo é 838 kB dos 966 kB) | **deixar como está** (operador, 14/11): extrair mexe num arquivo de 7.803 linhas com 4 blocos `@media print` e um `@page`, para ganhar o que o corpo domina — fecha aqui |
| 2026-11-14 · decisão do operador | `tools/` (A1) | o `pre-push` versionado: obrigaria o portão (~46 s) em todo push, inclusive de documentação, e pede `core.hooksPath` em cada clone | **deixar como está** (operador, 14/11): os hooks rodam neste proot (medido, git 2.43), mas o rito já roda o portão antes do commit; se o push sem portão voltar, um hook só com a Sanidade se paga |
| 2026-11-14 · higienização A (sem versão; `docs/`, `tools/` e o contrato) | `EFICIENCIA` #2, #9 | a fixture `DIAG` do `registro.test.mjs` sem `via`/`interfaces`/`midia`/`ultimo`; não há `tools/versao.mjs` | **fechado** — a fixture ganhou os quatro campos e o `farolEstado` (a linha do Alcance passa a nascer no oráculo); o `tools/versao.mjs` nasceu com `--conferir`, recusa de forma e de versão que não subiu, e três asserções no `ferramentas.test.mjs` · `212accdf` |
| 2026-11-14 · higienização A | `docs/ORACULOS.md:44` | a linha do `ferramentas.test.mjs` dizia "as QUATRO casas da versão" | **fechado** — "as três casas", que é o que o oráculo cobra (`ferramentas.test.mjs:49`) · `212accdf` |
| 2026-11-14 · higienização A | `docs/ESTRUTURA.md:5-7` e `:17` | atribuía ao `CLAUDE.md` uma contagem de Kotlin que ele não tem (e o esboço tem oito linhas, não seis); a árvore do `notas.json` teria ganhado um nível | **fechado** — a contagem ficou só na ESTRUTURA e o esboço em "oito linhas"; o `:17` foi MEDIDO e **não é defeito**: a coluna dos comentários bate na 33, e o `│   │` é o `assets/web` seguindo para o próximo filho · `212accdf` |
| 2026-11-14 · higienização A | `docs/ARQUITETURA-WEB.md:56-66`, `:114` e `CLAUDE.md:223-235` | o rito em três casas (o `BUILD.md` é a fonte única) e "a TERCEIRA exceção" quando a próxima é a segunda | **fechado** — o rito ficou só no BUILD (o hub aponta), "segunda exceção", e o bloco do `CLAUDE.md` ganhou o `--vizinho` que o `TETO=8` do portão exige · `212accdf` |
| 2026-11-14 · higienização A | `CLAUDE.md:233` | o contrato mostrava só `tools/portao.sh <arquivos do lote>`, e um lote de 9+ arquivos reprova por omissão | **fechado** — o `--vizinho` entrou na mesma linha (o mesmo conserto da linha acima) · `212accdf` |
| 2026-11-14 · higienização A | `docs/HISTORICO.md:34` e `:796` | duas medidas velhas: o corpo do guia tem 918.125 B (não 838 kB) e o `CLAUDE.md` fechou em 368 linhas | **fechado** — 918 kB e 368 linhas, nos dois pontos e na nota do Pacote 27 · `212accdf` |
| 2026-11-14 · higienização A | `tools/docs-coerentes.test.mjs:338-344` | a checagem "a versão está no RESIDUOS" era satisfeita pelo exemplo da regra | **fechado** — a régua recorta da seção Aberto até a Refutado: o exemplo do topo não a satisfaz mais · `212accdf` |
| 2026-11-14 · higienização A | `tools/portao.sh:153` | o passo 2 pulava oráculo puro só MENCIONADO na Sanidade, inclusive em comentário | **fechado** — só conta linha que EXECUTA `node … tools/x.test.mjs`; comentário e `echo` não pulam mais · `212accdf` |
| 2026-11-14 · higienização A | `tools/estado.sh:64-65` e `:30-31` | a régua do shell não somava o não rastreado (o `apk.yml` soma) e o `set --` sem guarda abortava sob `set -u` | **fechado** — `git ls-files --others` entra na conta e o `rev-list` é guardado por `if`, com `${1:-?}` · `212accdf` |
| 2026-11-14 · higienização A | `tools/reverter.sh:5` | o cabeçalho mandava a regra "a reversão se desfaz com uma cópia" ao `CLAUDE.md`, que não a tem | **fechado** — o ponteiro é o `docs/BUILD.md` · `212accdf` |
| 2026-11-14 · higienização A | `tools/revisao-cobertura.mjs:125` | o `--tabela` imprimia `\/` e a cópia do `REVISAO-GERAL.md` usa `/` | **fechado** — a saída normaliza a barra: a cópia passa a ser mecânica · `212accdf` |
| 2026-11-14 · higienização A | `docs/revisao/REVISAO-2026-11-14.md:30-38` | o §0 do dossiê não tinha a tabela de ids que o fecho cobra | **fechado** — os 17 ids, um por linha, com o estado de cada um · `212accdf` |
| 2026-11-14 · higienização A | `docs/PEDIDOS-EM-ESPERA.md:68` × `:147` | o Pacote 13 tinha nota "—" numa tabela e 4 na outra | **fechado** — 4 nas duas · `212accdf` |
| 2026-11-14 · higienização B (v1.14.17) | `tools/tour.test.mjs` | `s.configuracoes` é chave que não existe: duas asserções e um `delete` que passavam por vacuidade | **fechado** — o bloco G cobra a lista FECHADA das seções `s.cfg-` (as duas que restaram); o F e o L não citam mais a chave morta · `2eae83bb` |
| 2026-11-14 · higienização B (v1.14.17) | `tools/tour.test.mjs:271` | pré-marcava todas as chaves antes de abrir Configurações, então a asserção passaria com a seção de volta | **fechado** — marca só as chaves do principal: um tour de raiz que voltasse abriria e reprovaria · `2eae83bb` |
| 2026-11-14 · higienização B (v1.14.17) | `tools/tour.test.mjs` | `FOLGA`/`ANEL` escritos à mão (o padrão do achado T7) | **fechado** — `AVTour.FOLGA`/`ANEL` publicados e lidos pelo oráculo; nenhum 6/2 digitado · `2eae83bb` |
| 2026-11-14 · higienização B (v1.14.17) | `tools/tour.test.mjs:94` | o oráculo media a peça com a MESMA regra do `elementos()` | **fechado** — a peça vem de `AVTour.alvos()` e a régua cobra UM alvo por seletor (todos com `todos`), com a contagem e o pertencimento no lugar da escolha · `2eae83bb` |
| 2026-11-14 · higienização B (v1.14.17) | `tour.js:68` e `:251` | os passos "Cronograma e Favoritos" e "Seg e 12h" explicam duas peças e ficaram sem `todos` na v1.14.16; o `:298` punha o re-sortear no destaque; o `:59-60` era o comentário do schema velho | **fechado** — `todos` nos três passos (o do Sorteio inclusive), o re-sortear fora do halo (`:not(.sorteio-sortear)`) e o comentário do schema nomeando `todos` · `2eae83bb` |
| 2026-11-14 · higienização B (v1.14.17) | `tools/tour.test.mjs:94-100` + `docs/arquitetura/CONTROLE-TOUR.md:132` | o oráculo espelhava a seleção do `elementos()` e o capítulo dono não conhecia `todos`/uma-peça-por-seletor | **fechado** — o capítulo ganhou a seção do `alvo`/`todos` e o oráculo descrito pelo que mede · `2eae83bb` |
| 2026-11-14 · higienização C (v1.14.18) | `controle.js`, `controle.css` | 14 comentários "lápide" (`saiu na vX`) anteriores ao intervalo | **fechado** — a história e a citação morta saíram, a REGRA viva ficou; o diff sem comentários contra o `HEAD` saiu vazio nos dois arquivos e o `pares-de-comentario` aprovou os 3.628 blocos do JS e os 880 do CSS (−39 linhas) · `e1b6406e` |
| 2026-11-14 · higienização C (v1.14.18) | `controle.js` `:5705` | `naoResta()` e as duas frases dela, inalcançáveis | **fechado** — a função saiu e ficou `if (v == null) return;`: os dois chamadores saem com `disabled = drawGoApagado()`, a MESMA conta, e as duas frases continuam na tela como `title` deles · `e1b6406e` |
| 2026-11-14 · higienização C (v1.14.18) | `controle.js` (resíduo de `:8884`) | `hymnResultRow` reabre a gaveta montada sem repor `destExecutor`/`destMarcados`/`songMenuFor` | **fechado** — a gaveta guarda o que deixou no slot (`donoDaGaveta`) e repõe no toque; bloco F novo no `destinos-diretos`, com a reversão MEDIDA (`devolveu:false, aindaB:true` antes do conserto) · `e1b6406e` |
| 2026-11-14 · higienização C (v1.14.18) | `java/` e `assets/web/` (16 arquivos) | 19 referências mandam ao `CLAUDE.md` por conteúdo que mora no `NUCLEO-TECNICO.md` desde a A2 | **fechado** — 20 no total (recontadas): 17 repontadas para o capítulo dono (`NUCLEO`, `CIFRA`, `DIVERGENCIAS`, `CAMADA-DE-TEXTO`) e 3 confirmadas legítimas · `e1b6406e` |
| 2026-11-14 · higienização C (v1.14.18) | `controle.js:22110-22111` + `HISTORICO.md:1629` | o comentário (e a nota que o repete) dizem que a rotina do acervo chama `serieSemanaReavaliar` e que a rodada volta em todo `visibilitychange` | **fechado** — agora dizem o que o código faz: o acervo chama `manterSeriesDaSemana` e sai antes com mídia no ar; quem chama `serieSemanaReavaliar` são `pararMidia` e `resetAfterEnd` · `e1b6406e` |

## Lotes que declararam "nenhum"

A linha "nenhum" é obrigação, não formalidade: é o que separa "não deixou nada"
de "ninguém olhou".

| quando | lote | vistoria |
|---|---|---|
| 2026-11-14 | o método da revisão (`RESIDUOS.md`, `REVISAO-GERAL.md`, `tools/revisao-cobertura.mjs`) | nenhum resíduo de código. **A ferramenta não estava pronta:** a revisão de 14/11 achou nela três defeitos — o telão e a tela espelho caíam no marco do shell, a citação por nome solto dava o site por coberto, e sem `--dossie` ela anunciava cobertura. Os três — e um quarto, de uso, na citação — foram corrigidos, e a ferramenta foi provada nos dois sentidos (acusa o marco roçado, cala quando o dossiê cita) |
| 2026-11-14 | o Pacote 26 (o processo de revisão) | nenhum resíduo de código: só docs e `tools/`. A migração B4 levou os abertos das auditorias para a tabela acima e carimbou o estado final em cada uma; os itens NÃO VERIFICADOS da auditoria de 09-11 ficam como registro daquela data, sem virarem fila |

| 2026-11-14 | v1.14.17 — o tour (só web) | nenhum resíduo NOVO: o lote fechou os seis do tour; os que sobram da lista já estavam declarados (as lápides, o `naoResta`, o `hymnResultRow`, o `:22110` e as referências de `java/`) |
| 2026-11-15 | v1.14.24 — os Pacotes 7, 21 e 28 num lote só (só web) | nenhum: a checagem nova só lê a fotografia do OTA e abre o diálogo que já existia; a engrenagem reusa `montarAcoesDaLinha` e a adoção de `itinAdotarCue`; o aviso só arma a rodada que o `pararMidia` já chamava. Nenhum arquivo do shell tocado; a única linha nova de vistoria é a do A5 (acima), que é de fonte da máquina |
| 2026-11-15 | v1.14.25 — os Pacotes 22 e 23 num lote só (só web) | nenhum: o `+2` da leitura saiu com a faixa de `@container` de 18em que só existia para ele, e a margem do editor era herança de Configurações e saiu inteira. Nenhum arquivo do shell tocado |
| 2026-11-15 | v1.14.26 — a seta de voltar nas Ferramentas (só web) | nenhum: a seta é o `#toolsVoltar` na trilha 1 que a grade já reservava, o ✕ e a animação são os de sempre, e o voltar do Android só ganhou a condição. Nenhum arquivo do shell tocado |
| 2026-11-15 | v1.14.27 — o alerta do Cronograma à esquerda (Pacote 20, só web) | nenhum: o alerta mudou de lugar no DOM, e o `padding-right` que devolve o nome ao eixo é a MESMA largura que ele já ocupava (`--hit` + vão) — não há número novo de layout. Nenhum arquivo do shell tocado |
## Refutado — medido e não é resíduo

Registrado para ninguém gastar a sessão duas vezes na mesma suspeita.

| quando | o que parecia resíduo | a medição |
|---|---|---|
| 2026-11-14 | extrair os 587 kB de desenho do guia para um sprite | o guia tem 943 kB CRUS e **206 kB comprimidos**; o ganho seria ~110 kB só a partir da 2ª visita, e `<use>` externo não funciona nos navegadores |
| 2026-11-14 | o link `../../releases` do `README.md` | é convenção do GitHub; o `docs-coerentes` a exclui por `DO_GITHUB` |
| 2026-11-14 | `.pag-col-e`/`.pag-col-d` do guia, "mortas" | o JS as monta em `colunaNova()` (`'pag-col pag-col-' + l`) |
| 2026-11-14 | `#shareAppTile { grid-column: 1 }` no CSS | a regra **não existe**; parecia existir porque um capítulo e um comentário de oráculo a citavam |
| 2026-11-14 · revisão geral B | o workflow `web-ota` e a "guarda que aceita versão IGUAL" | não existem: o workflow é `apk.yml` e a comparação é `>` estrita (`apk.yml:228`) — o defeito que fica é o da régua contra a tag, e ele está na linha aberta |
