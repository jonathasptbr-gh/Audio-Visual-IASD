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
| 3 | A3 | pendente | | | |
| 4 | A4 | pendente | | | |
| 5 | A5 | pendente | | | |
| 6 | A6 | pendente | | | |
| 7 | W1 | pendente | | | |
| 8 | W2 | pendente | | | |
| 9 | W3 | pendente | | | |
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
| A5 | A1 | `tools/configuracoes-janelas.test.mjs` bloco D — reprovou 3× no runner (2213, 2234, 2244: os álbuns semeados não aparecem no corpo da seção em 20 s) e 0 de 9 sob carga local. A A1 não achou a causa e acrescentou ao `obtido` o ESTADO da seção (`aria-expanded` da seta, `pacoteSecaoAberta`, linhas do corpo, grupos do `pacoteEsboco`, `pacoteOcupado`): o próximo vermelho diz se o toque não abriu, se a seção foi remontada fechada ou se os álbuns não entraram no plano. Se o toque não abriu, é defeito do APP (toque perdido) e vai à C8 |
| A5 | A1 | `tools/boot-nativo.test.mjs` — reprovou no run 2253 (commit `90d2977`, que só mexeu no `REGISTRO.md`: não é defeito do lote) e passou nos runs seguintes. Asserção não lida (o log corta). Mesma família dos instáveis da A1: achar a espera que mede o runner |
| W2 | A1 | `shared/stage.js`:`aplicarGiroTudo` — SUSPEITA com cenário: `enquadramento-da-camada` reprovou IDÊNTICO nos runs 2229 e 2242 (`pvTextImg` com `cover` mas sem giro, caixa = palco 669×376). Com a camada (`#pvText`) ainda `hidden` quando o `reporGiro` roda, o reenvio por `requestAnimationFrame` desiste em `GIRO_TENTATIVAS` (60 QUADROS, não tempo): se a revelação vier depois disso (runner lento), a imagem sobreposta fica SEM o giro para sempre — sem TV, isso é a projeção. Medir: forçar a revelação depois de 60 quadros; conserto provável: quem revela a camada chama `reporGiro` DEPOIS de revelar o ancestral, ou um `ResizeObserver` na própria `camadaImg`. O oráculo não foi mexido: esperar pelo giro esconderia o defeito |
| A3 | A2 | Os blocos movidos VERBATIM para `docs/arquitetura/DESIGN-SYSTEM.md` ("As regras da paleta como estavam no núcleo"), `docs/arquitetura/CONTROLE.md` (referência da preview; abertura), `docs/shell/PONTE.md`, `docs/TELAO-POR-COMANDOS.md`, `docs/arquitetura/DISPLAY.md`, `MODELO-DE-DADOS.md` e `MOTOR-STAGE.md` (seções "(do núcleo, revisão A2)" ao fim de cada um) DUPLICAM em parte o que o capítulo já tinha (medido: PONTE.md já cobria ~95% dos símbolos; DESIGN-SYSTEM ~53%). A A2 não deduplicou de propósito (mover sem perder era a cerca); fundir cada seção na casa certa do capítulo é trabalho de capítulo |
| A4 | A2 | `docs/shell/README.md` tem DUAS linhas para o `MuxMp4.kt` (190 e 191 linhas, textos diferentes) — uma deve sair. E a árvore anotada de `docs/ESTRUTURA.md` (verbatim do `CLAUDE.md` antigo) não lista o `R2ImagemFonte.kt`, embora diga 33 arquivos (a árvore condensada do `CLAUDE.md` novo já o lista) |

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
