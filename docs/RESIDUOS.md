# Os resíduos declarados

**O problema que este arquivo resolve:** descobrir o que ficou para trás custava
uma varredura inteira, feita dias depois, por quem não estava lá. O agente que
publica o lote sabe — na hora — o que ele viu e não consertou. Esta é a casa
disso.

## A regra

1. **Todo lote que publica declara o seu resíduo AQUI, antes do push** — mesmo
   quando a resposta é "nenhum". Um lote sem linha nesta tabela é um lote sem
   vistoria.
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

## O que é "fino"

Uma linha de resíduo é **fina** quando cabe em uma sessão curta: um comentário
falso, uma asserção vacuosa, um seletor morto, uma contagem velha num capítulo,
uma linha de documentação fora do lugar. Fino **não** quer dizer opcional — quer
dizer que não precisa de decisão de desenho. **O que pede decisão do operador ou
medição em aparelho não é fino.**

## Aberto

| quando | versão | onde | o que ficou | tipo | por que não foi agora |
|---|---|---|---|---|---|
| 2026-11-14 | — | `tools/tour.test.mjs` | `s.configuracoes` é chave que não existe: a asserção e o `delete` passam por vacuidade | fino | fora da cerca do lote do tour |
| 2026-11-14 | — | `tools/tour.test.mjs:271` | pré-marca todas as chaves antes de abrir Configurações, então a asserção passaria com a seção de volta | fino | idem |
| 2026-11-14 | — | `YoutubeGrab.kt` | os campos `initIni/initFim/idxIni/idxFim/codec` da `Faixa`, sem leitor desde que o `dash` saiu (~24 linhas, KDoc junto) | fino | precisa de compilador para provar; é do CI |
| 2026-11-14 | — | `tools/tour.test.mjs` | `FOLGA`/`ANEL` escritos à mão (o mesmo padrão do achado T7) | fino | idem |
| 2026-11-14 | — | `controle.js`, `controle.css` | 14 comentários "lápide" (`saiu na vX`) anteriores ao intervalo | fino | fora do escopo das duas revisões |
| 2026-11-14 | — | `site/sonoplastia/index.html` | 671 linhas de CSS e 1.320 de JS inline, nada cacheável (~33 kB comprimidos) | fino | ganho pequeno, risco de layout |
| 2026-11-14 | — | `controle.css` | a pílula de volume da tela cheia deitada (C8): a 740×360 o número sai da tela | **decisão** | desenho; operador decidiu deixar em 14/11 |
| 2026-11-14 | — | `capturas/entrada/` | 3,7 MB de JPEG de origem, já convertidos para `site/telas/` | **decisão** | operador decidiu deixar em 14/11 |
| 2026-11-14 | — | `ESTABILIDADE-AV` C2, D2 | pedem medição em aparelho | **medição** | não há aparelho nesta máquina |
| 2026-11-14 | — | `EFICIENCIA` #2, #9 | processo, não código | **decisão** | aberto desde 2026-09 |

## Lotes que declararam "nenhum"

A linha "nenhum" é obrigação, não formalidade: é o que separa "não deixou nada"
de "ninguém olhou".

| quando | lote | vistoria |
|---|---|---|
| 2026-11-14 | o método da revisão (`RESIDUOS.md`, `REVISAO-GERAL.md`, `tools/revisao-cobertura.mjs`) | nenhum: o resíduo das sessões anteriores está nas tabelas acima, o fino do dia foi fechado, e a ferramenta foi provada nos dois sentidos (acusa o marco pulado e passa quando o dossiê cita tudo) |

## Refutado — medido e não é resíduo

Registrado para ninguém gastar a sessão duas vezes na mesma suspeita.

| quando | o que parecia resíduo | a medição |
|---|---|---|
| 2026-11-14 | extrair os 587 kB de desenho do guia para um sprite | o guia tem 943 kB CRUS e **206 kB comprimidos**; o ganho seria ~110 kB só a partir da 2ª visita, e `<use>` externo não funciona nos navegadores |
| 2026-11-14 | o link `../../releases` do `README.md` | é convenção do GitHub; o `docs-coerentes` a exclui por `DO_GITHUB` |
| 2026-11-14 | `.pag-col-e`/`.pag-col-d` do guia, "mortas" | o JS as monta em `colunaNova()` (`'pag-col pag-col-' + l`) |
| 2026-11-14 | `#shareAppTile { grid-column: 1 }` no CSS | a regra **não existe**; parecia existir porque um capítulo e um comentário de oráculo a citavam |
