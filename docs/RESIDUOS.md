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
| 2026-11-14 · revisão de 14/11 | `tools/tour.test.mjs` | `s.configuracoes` é chave que não existe: duas asserções e um `delete` que passam por vacuidade | higienização | fora da cerca do lote do tour |
| 2026-11-14 · revisão de 14/11 | `tools/tour.test.mjs:271` | pré-marca todas as chaves antes de abrir Configurações, então a asserção passaria com a seção de volta | higienização | precisa da reversão para provar |
| 2026-11-14 · revisão de 14/11 | `tools/tour.test.mjs` | `FOLGA`/`ANEL` escritos à mão (o padrão do achado T7) | higienização | idem |
| 2026-11-14 · revisão de 14/11 | `controle.js`, `controle.css` | 14 comentários "lápide" (`saiu na vX`) anteriores ao intervalo | higienização | fora do escopo das duas revisões |
| 2026-11-14 · v1.14.16 | `site/sonoplastia/index.html` | a captura da lista de Ferramentas mostra seis e o app tem sete ("Editar mídia") | operador | refazer a captura pede o app em tela — **na fila: Pacote 29** (14/11) |
| 2026-11-14 · revisão de 14/11 | `YoutubeGrab.kt` | os campos `initIni/initFim/idxIni/idxFim/codec` da `Faixa`, sem leitor desde que o `dash` saiu (~24 linhas, KDoc junto) | CI | não há compilador aqui; a remoção só se prova no Gradle |
| 2026-11-14 · v1.14.16 | `controle.js:22564` | o aviso do card promete que a série "desce quando ela sair", mas a rodada só é armada por `manterSeriesDaSemana` — com um card aberto na projeção a saída da mídia não baixa | operador | mexe no contrato do `serieAutoImpedimento` — **na fila: Pacote 28** (14/11) |
| 2026-11-14 · v1.14.16 | `tools/tour.test.mjs:94` | o oráculo mede a peça com a MESMA regra do `elementos()`: não distingue a peça certa da primeira casada | higienização | só o G novo tem régua independente |
| 2026-11-14 · Pacote 24 | `~/.dsh-github/uso.mjs` | a remedição do custo com o preço do modelo ATUAL não saiu (não há preço publicado confiável na máquina); as tabelas do medidor são de 10/11 e ele aceita `--preco novo cache saida` | medição | preço do modelo atual não medido |
| 2026-11-14 · revisão de 14/11 | `ESTABILIDADE-AV` C2, D2 | pedem medição em aparelho | medição | não há aparelho nesta máquina |
| 2026-11-14 · revisão de 14/11 | `EFICIENCIA` #2, #9 | o #2: a fixture `DIAG` do `registro.test.mjs` sem `via`/`interfaces`/`midia`/`ultimo`; o #9: não há `tools/versao.mjs` | higienização | aberto desde 2026-09 |
| 2026-11-14 · Pacote 25 | `apk.yml` | a regra "base web mudou ⇒ versão sobe" é contra a última TAG: um segundo lote de web sem subir, depois de um que subiu, passa | CI | o certo é comparar com o canal, e o `sha256` do zip muda a cada empacotamento — pede o hash da árvore |
| 2026-11-14 · Pacote 26 (migração B4) | `controle.js` `:5705` | `naoResta()` e as duas frases dela, inalcançáveis: `doDraw` só chega lá com `drawRemaining() <= 0`, e os dois caminhos passam por botões com `disabled = drawGoApagado()` | higienização | veio da auditoria de agosto (A4); fora da cerca de toda etapa |
| 2026-11-14 · Pacote 26 (migração B4) | `controle.js` (resíduo de `:8884`) | `hymnResultRow` reabre a gaveta montada sem repor `destExecutor`/`destMarcados`/`songMenuFor`; vale também para o ramo de episódio (`openYtMenu`) | higienização | veio da auditoria de agosto (A4); fora da cerca de toda etapa |
| 2026-11-14 · Pacote 27 | `java/` e `assets/web/` (16 arquivos) | 19 referências mandam ao `CLAUDE.md` por conteúdo que mora no `NUCLEO-TECNICO.md` desde a A2 (2026-10-30): as invariantes numeradas, a regra do diagnóstico, o Hinário, o `nowPlaying` — contagem recontada na revisão geral B | higienização | tocar `java/` ou a base web obriga `shellTag` + Release, e este lote é só texto |
| 2026-11-14 · Pacote 26 (B9) | `configuracoes-sem-subtitulo` D3, `ferramentas-folha` V, `sorteio-tela` O | os três oráculos cujos números nasceram da FONTE do runner (DejaVu/pixel): reprovam no Chromium desta máquina e passam no runner — o §4 do `ACHADOS-EM-ABERTO` migrou para cá | CI | não se conserta mexendo no app: é a campanha de fontes do CI |
| 2026-11-14 · revisão geral B | `controle.js:22110-22111` + `HISTORICO.md:1629` | o comentário (e a nota que o repete) dizem que "a rotina do acervo chama `serieSemanaReavaliar`" e que a rodada "volta em todo `visibilitychange`": o acervo chama `manterSeriesDaSemana` e sai antes com mídia no ar (`:17473`) | higienização | toca base web ⇒ pede versão própria |
| 2026-11-14 · revisão geral B | `tour.js:68` e `:251` | os passos "Cronograma e Favoritos" e "Seg e 12h" explicam duas peças e ficaram sem `todos` na v1.14.16 — regressões da v1.14.15; `:298` põe o re-sortear no destaque e `:59-60` é o comentário do schema velho | higienização | base web ⇒ versão própria |
| 2026-11-14 · revisão geral B | `tools/tour.test.mjs:94-100` + `docs/arquitetura/CONTROLE-TOUR.md:132` | o oráculo espelha a seleção do `elementos()` e não pega os dois passos acima; o capítulo dono não conhece `todos`/uma-peça-por-seletor | higienização | a régua independente só existe para a LINHA |
| 2026-11-14 · revisão geral B | `docs/ORACULOS.md:44` | a linha do `ferramentas.test.mjs` diz "as QUATRO casas da versão"; ele cobra três (`ferramentas.test.mjs:49`) | higienização | é o mesmo achado do M8-3 do dossiê B |
| 2026-11-14 · revisão geral B | `docs/ESTRUTURA.md:5-7` e `:17` | atribui ao `CLAUDE.md` uma contagem de Kotlin que ele não tem (e o esboço tem 8 linhas, não 6); a árvore do `notas.json` ganhou um nível `│   │` | higienização | só docs |
| 2026-11-14 · revisão geral B | `docs/ARQUITETURA-WEB.md:56-66`, `:114` e `CLAUDE.md:223-235` | o rito em três casas (o `BUILD.md` é a fonte única) e "a TERCEIRA exceção" quando a próxima é a segunda | higienização | tocar no contrato pede cuidado, mas é texto |
| 2026-11-14 · revisão geral B | `docs/HISTORICO.md:34` e `:796` | duas medidas: o corpo do guia tem 918.125 B (não 838 kB) e os ~206 kB são a página comprimida; o `CLAUDE.md` fechou em 368 linhas, não 369 | higienização | medida datada, corrigir só o número |
| 2026-11-14 · revisão geral B | `tools/docs-coerentes.test.mjs:338-344` | a checagem "a versão do lote está no RESIDUOS" é satisfeita pelo exemplo da regra (`RESIDUOS.md:12`): um lote que só renumere o exemplo passa sem linha no Aberto | higienização | guarda que se satisfaz com o próprio texto |
| 2026-11-14 · revisão geral B | `tools/portao.sh:153` | o passo 2 pula oráculo puro só MENCIONADO na Sanidade (inclusive em comentário), não o executado: um `# ver tools/tokens.test.mjs` tira o oráculo do portão | higienização | latente hoje (`comm -23` vazio) |
| 2026-11-14 · revisão geral B | `tools/estado.sh:64-65` e `:30-31` | a régua "o shell mudou desde a última tag" não soma `git ls-files --others` (o `apk.yml:211` soma); e `set -- $(...)` sem aspas aborta sob `set -u` se o `git rev-list` falhar | higienização | a régua duplicada é o defeito de fundo |
| 2026-11-14 · revisão geral B | `tools/reverter.sh:5` | o cabeçalho manda a regra "a reversão se desfaz com uma cópia" ao `CLAUDE.md`; ela mora em `docs/BUILD.md:499` (`grep -c reverter CLAUDE.md` = 0) | higienização | ponteiro falso no script reescrito |
| 2026-11-14 · revisão geral B | `tools/revisao-cobertura.mjs:125` | o `--tabela` imprime `p.source` com `\/` e a cópia do `REVISAO-GERAL.md:78-87` usa `/`: a doc diz que a tabela "sai da ferramenta", mas a cópia não é mecânica | higienização | regex equivalentes, é cosmético |
| 2026-11-14 · revisão geral B | `CLAUDE.md:233` | o contrato mostra só `tools/portao.sh <arquivos do lote>`; com `TETO=8` (`portao.sh:131`) o lote que toca o `controle.js` reprova por padrão e exige `--vizinho`, que só o `BUILD.md:436` documenta | higienização | contrato e rito divergem |
| 2026-11-14 · revisão geral B | `docs/revisao/REVISAO-2026-11-14.md:30-38` | o §0 do dossiê A não tem a tabela de ids que o item 4 do fecho cobra (`REVISAO-GERAL.md:162-164`, já vigente em `ea612559`); os 17 ids estão nas seções | higienização | formal: nenhum id omitido |
| 2026-11-14 · revisão geral B | `docs/PEDIDOS-EM-ESPERA.md:68` × `:147` | o Pacote 13 tem nota "—" na tabela "Os pacotes, em uma linha" e 4 no índice | higienização | é leitura da fila; alinhar as duas tabelas |

## Fechado/decidido

O que a decisão do operador fechou, ou o que se decidiu deixar como está. Não é
trabalho: é o registro da decisão, para o mesmo assunto não voltar como
resíduo. (B8)

| quando · lote | onde | o que era | a decisão |
|---|---|---|---|
| 2026-11-14 · revisão de 14/11 | `controle.css` | a pílula de volume da tela cheia deitada (C8): a 740×360 o número sai da tela | **deixar como está** (operador, 14/11) |
| 2026-11-14 · revisão de 14/11 | `capturas/entrada/` | 3,7 MB de JPEG de origem, já convertidos para `site/telas/` | **deixar como está** (operador, 14/11) |
| 2026-11-14 · decisão do operador | `site/sonoplastia/index.html` | 671 linhas de CSS e 1.320 de JS inline, nada cacheável (~33 kB comprimidos de ~206 kB; o corpo é 838 kB dos 966 kB) | **deixar como está** (operador, 14/11): extrair mexe num arquivo de 7.803 linhas com 4 blocos `@media print` e um `@page`, para ganhar o que o corpo domina — era o 12.3.2 da fila, e fecha aqui |
| 2026-11-14 · decisão do operador | `tools/` (A1) | o `pre-push` versionado: obrigaria o portão (~46 s) em todo push, inclusive de documentação, e pede `core.hooksPath` em cada clone | **deixar como está** (operador, 14/11): os hooks rodam neste proot (medido, git 2.43), mas o rito já roda o portão antes do commit; se o push sem portão voltar, um hook só com a Sanidade se paga |

## Lotes que declararam "nenhum"

A linha "nenhum" é obrigação, não formalidade: é o que separa "não deixou nada"
de "ninguém olhou".

| quando | lote | vistoria |
|---|---|---|
| 2026-11-14 | o método da revisão (`RESIDUOS.md`, `REVISAO-GERAL.md`, `tools/revisao-cobertura.mjs`) | nenhum resíduo de código. **A ferramenta não estava pronta:** a revisão de 14/11 achou nela três defeitos — o telão e a tela espelho caíam no marco do shell, a citação por nome solto dava o site por coberto, e sem `--dossie` ela anunciava cobertura. Os três — e um quarto, de uso, na citação — foram corrigidos, e a ferramenta foi provada nos dois sentidos (acusa o marco roçado, cala quando o dossiê cita) |
| 2026-11-14 | o Pacote 26 (o processo de revisão) | nenhum resíduo de código: só docs e `tools/`. A migração B4 levou os abertos das auditorias para a tabela acima e carimbou o estado final em cada uma; os itens NÃO VERIFICADOS da auditoria de 09-11 ficam como registro daquela data, sem virarem fila |

## Refutado — medido e não é resíduo

Registrado para ninguém gastar a sessão duas vezes na mesma suspeita.

| quando | o que parecia resíduo | a medição |
|---|---|---|
| 2026-11-14 | extrair os 587 kB de desenho do guia para um sprite | o guia tem 943 kB CRUS e **206 kB comprimidos**; o ganho seria ~110 kB só a partir da 2ª visita, e `<use>` externo não funciona nos navegadores |
| 2026-11-14 | o link `../../releases` do `README.md` | é convenção do GitHub; o `docs-coerentes` a exclui por `DO_GITHUB` |
| 2026-11-14 | `.pag-col-e`/`.pag-col-d` do guia, "mortas" | o JS as monta em `colunaNova()` (`'pag-col pag-col-' + l`) |
| 2026-11-14 | `#shareAppTile { grid-column: 1 }` no CSS | a regra **não existe**; parecia existir porque um capítulo e um comentário de oráculo a citavam |
| 2026-11-14 · revisão geral B | o workflow `web-ota` e a "guarda que aceita versão IGUAL" | não existem: o workflow é `apk.yml` e a comparação é `>` estrita (`apk.yml:228`) — o defeito que fica é o da régua contra a tag, e ele está na linha aberta |
