# Urgência — a revisão das diretrizes de 2026-11-14

O operador pediu uma revisão das diretrizes e metodologias (o contrato, o rito
de entrega, os processos de revisão e as instruções desta máquina). Três
revisores leram tudo e conferiram contra o que os scripts e o CI FAZEM. Saíram
cerca de 50 apontamentos, 12 graves. **Este arquivo é a lista do que consertar**,
em três pacotes — os Pacotes 25 a 27 da fila (`PEDIDOS-EM-ESPERA.md`); o Pacote
24 (o C) saiu em 2026-11-14.

**Como se usa.**

- **Um pacote por sessão**, na ordem **A → B → D**. Leia SÓ o pacote da vez
  (e "As decisões do operador", logo abaixo).
- **Os quatro estão autorizados** pelo operador (14/11): não é preciso perguntar
  qual seguir, só confirmar que a sessão é a do pacote seguinte.
- **As linhas citadas foram medidas no HEAD `21b28607`** e andam: confirme por
  `grep` antes de editar. Sigla: CL = `CLAUDE.md` · BU = `docs/BUILD.md` ·
  EC = `docs/ECONOMIA.md` · MA = `docs/MULTI-AGENTE.md` · RG =
  `docs/REVISAO-GERAL.md` · RP = `docs/REVISAO-PROFUNDA.md` · RES =
  `docs/RESIDUOS.md` · ACH = `docs/ACHADOS-EM-ABERTO.md` · PED =
  `docs/PEDIDOS-EM-ESPERA.md` · D13/D14 = `docs/revisao/REVISAO-2026-11-13/-14.md`
  · TOOL = `tools/revisao-cobertura.mjs`. Fora do repositório: AG =
  `/root/workspace/AGENTS.md` · PC = `/root/workspace/PACOTE-DE-CONTINUIDADE.md`
  · GL = `~/.dsh/AGENTS.md` (do app, não se edita) · RD = `~/.dsh-github/README.md`.
- **Ele ESVAZIA.** Pacote entregue sai daqui e da fila. Quando o terceiro sair,
  este arquivo é apagado, com as linhas dele no mapa do CL e na `ESTRUTURA.md`.
- Gravidade: **A** = causa erro ou perda · **M** = confunde ou custa · **B** = cosmético.

## As decisões do operador (2026-11-14)

1. **Os quatro pacotes serão feitos.**
2. **A entrega direto em `main` é o fluxo oficial.** Não há ramo de teste. O
   único teste que passa pelo operador antes de publicar é a **prévia visual
   experimental**, no navegador — e **só quando ele pedir** para experimentar um
   design novo. (As conferências automáticas — portão, oráculos, CI — continuam:
   com o ramo fora, o portão é a ÚNICA barreira antes do canal.)
3. **A versão tem TRÊS casas** (`version.json`, `WEB_VERSION`, `#appVersion`).
   A linha do CL deixa de ser casa.
4. **A revisão geral volta a caçar DEFEITO**, não só higiene.
5. **Tudo entra na fila**: os dois itens de decisão que estavam só no RES
   viraram os Pacotes 28 e 29.

---

## Pacote A — a entrega (Pacote 25)

Mexe em `tools/`, no workflow, no CL e no BU. **A decisão 2 muda o fluxo**: A3
é o texto novo, e A1 passa a ser a única barreira.

| # | g | onde | o que está errado | a correção |
|---|---|---|---|---|
| A1 | A | `tools/portao.sh`:20; `tools/reverter.sh`:43-52; `ce8edc1c`, `c48d9c8f` | o portão não é obrigatório nem o ÚLTIMO passo. Os dois consertos pós-push (casa fora de passo; nota acima de 120) são cobertos pelo passo 3 dele. O `--restaurar` copia o arquivo inteiro por cima, sem avisar que ele mudou desde o `--guardar` | escrever: rito de versão → portão → commit; portão DE NOVO depois de qualquer `--restaurar`; o `--restaurar` mostra o diff do que vai sobrescrever; opcional: `pre-push` versionado |
| A2 | A | CL:307; `portao.sh`:52-61 | o exemplo `tools/portao.sh controle/controle.js` aponta caminho que não existe (rc=1). A vizinhança roda TODO `tools/*.mjs` que cita o nome: 38 em série para o `controle.js`, entre eles o TOOL, que sem `--base` sai 2 — "vizinho FALHOU" sempre | vizinho = só `*.test.mjs` + os dois smoke; exemplo com o caminho real; teto ou seleção |
| A3 | A | CL:388-393; `apk.yml`:65-72; BU:45-48 | o texto manda ramo → push → `git checkout main && git merge --no-ff`; a prática são 33 commits seguidos direto em `main`. **Decisão 2:** direto é o oficial | reescrever a seção: commit em `main`, portão, push. Tirar o `checkout`/`merge`. Decidir o destino do gatilho `claude/**`. A prévia visual vira a única via experimental, só a pedido |
| A4 | A | CL:402-424; `apk.yml`:159-170; BU:28-32 | quatro regras de falha MUDA sem máquina: Kotlin mudou ⇒ `shellTag`; web mudou ⇒ versão sobe; superfície mudou ⇒ `SHELL_VERSION` sobe; disparar a Release (manual, e o HOLD é verde para sempre) | um passo no portão e no `verificar`, contra a última tag `v*`: mudou `java/`, `res/` ou manifesto ⇒ exige `shellTag`; mudou `assets/web/` ⇒ exige versão maior |
| A5 | M | CL:644, :657-665, :687-689; `docs-coerentes.test.mjs`:328; `estado.sh`:34, :44, :59; MA:25; AG:43 | "TRÊS lugares" no título × "QUARTA CASA" no corpo. **Decisão 3:** três | apagar a quarta casa do CL e o bloco do oráculo que a cobra; `estado.sh` deixa de ler o "APK anunciado" da prosa (hoje é circular); acertar MA e AG |
| A6 | M | CL:295, 384, 408, 417, 432, 444, 455, 685; BU:45 | não há lista ORDENADA do rito: os passos estão em nove lugares; falta nela o RES "antes do push" e a prévia visual | uma lista numerada única (≤ 15 linhas) no BU; o CL aponta |
| A7 | M | CL:300-301; MA:105 | CI vermelho depois do push: a única regra é "conserta e empurra de novo", sem dizer com que número; a prática é mista | "`verificar` vermelho = bundle não saiu ⇒ conserto no MESMO número; já publicado ⇒ número novo; sem revert nem force em `main`" |
| A8 | M | `docs-coerentes.test.mjs`:287; CL:455-461, :543, :570 | cobrança pela metade: o oráculo aceita índice OU seção no HISTORICO (a regra pede os dois); a linha no RES não tem máquina | exigir os dois, e a versão citada no RES |
| A9 | M | `nome-inexistente.test.mjs`:77; `apk.yml`:607; CL:524; BU:443 | o teste importa `acorn` e roda no passo de Chromium, mas a régua o conta como Node puro; `acorn` é a QUINTA dependência e os textos dizem "quatro exceções" | declarar (ou remover) e tirar do filtro dos puros |
| A10 | M | CL:262, :417-419; BU:25; `apk.yml`:51, :1042; `dados.yml` | duas rotas de Release sem dizer qual é a do rito; `permitir_regressao` e a guarda anti-regressão sem uma menção; `dados.yml` (cron horário, escreve no repositório) não aparece em lugar nenhum | uma rota oficial; os três inputs e os três workflows no BU |
| A11 | B | CL:298; `apk.yml`:254-289 | "~8 s": o portão inteiro levou 46 s, e os puros rodam DUAS vezes (passo 2 + dentro da Sanidade) | passo 2 só com os puros fora do bloco; acertar o número ou tirá-lo |

---

## Pacote B — o processo de revisão (Pacote 26)

Texto (RG, RP, RES, ACH, PED) e o TOOL. **A decisão 4 entra em B5.**

| # | g | onde | o que está errado | a correção |
|---|---|---|---|---|
| B1 | A | RG:88; CL:471-473; RES:46, :50 | item de decisão não chega à fila: M1-2 e M6-1 estavam só no RES (já viraram os Pacotes 28 e 29) | a REGRA: todo resíduo com dono `operador` ganha pacote, ou `estado.sh` imprime essas linhas |
| B2 | A | RG:49-58; TOOL; D14:65, :108; RES:44 | "escopo fixo" não diz se o marco é a área INTEIRA ou só o que mudou: M2 e M5 saíram "LIMPO — sem mudança" | escrever: M1–M8 = o intervalo + o que depende dele; M9 e M10 = integral |
| B3 | A | RG:27; D14:7; D13:295 | a base da próxima revisão não está definida: a de 14/11 mediu até `ea612559` e os consertos dela saíram depois (`21b28607`) — o mesmo buraco do "pós-retrato" de 13/11 | a base seguinte é o HEAD MEDIDO, gravado no topo do dossiê; nunca o commit da faxina |
| B4 | A | RG:57; D14:184; `AUDITORIA-2026-08.md`:39-52 | M9 exige "cada linha" de ACH, AUDITORIA-* e RES; foram reconferidas só as dez do RES. A auditoria de agosto tem sete linhas ABERTO/INCERTO; o K12 (`soltar()`) fala de código que já não existe | migrar UMA vez os abertos das auditorias para o RES, carimbar o estado final nelas, e reduzir M9 a RES + ACH |
| B5 | A | RG:49-58 × RP:83-90, RP:69-72 | a troca de formato perdeu categorias: a coluna "o que se procura" só tem higiene. **Decisão 4:** volta a caçar defeito | uma linha comum a M1–M5: defeito com cenário, culto (prioridade máxima), desempenho, invariantes, cobertura; trazer o método de refutação da RP |
| B6 | M | `portao.sh`, `estado.sh`, `docs-coerentes`, workflows; TOOL:4; RES:10, :62; CL:455 | nada do processo é cobrado por máquina; a v1.14.16 não tem linha identificável (a coluna `versão` saiu em `21b28607`) | `docs-coerentes` exige a versão de cada lote no RES (junto com A8) |
| B7 | M | RG:78; TOOL:168 | o "verde" do fecho não reproduz: no intervalo declarado sai 0 (M6 com 2/19, 17 são `.webp`); na forma do RG sai 1. "Citado" não é "varrido" (M8 ok com 1/7) | fixar `--head` no dossiê, tirar binário da conta, exigir os dez títulos de marco |
| B8 | M | PED:348-350 × RES:45 × D14:36, :207-213; RES:48-49; PED:325; ACH §6; RES:22 | o mesmo item em duas listas com dono diferente; itens DECIDIDOS ainda em "Aberto" | seção "Fechado/decidido" no RES e limpar o PED 12.2 |
| B9 | M | ACH:3 × ACH:285, :308; ACH:264 | o ACH se contradiz ("APK publicado" × "falta o APK") e tem 328 linhas para dizer "nenhum"; o §4 não é defeito e não tem dono | acertar o §5, mover o §4 para o RES (dono CI), os fechados para o HISTORICO |
| B10 | M | CL:710; RP:1-6; RG:12; `REGISTRO.md`:44 | a revisão profunda ainda parece viva | faixa "ENCERRADA em 2026-11-09 — use a REVISAO-GERAL" no topo da RP e no CL |
| B11 | M | RG:43-44, :66, :87-90; CL:466; D14:234-240 | o custo estoura: um agente por marco; a de 14/11 usou 223 passos (teto 150), e a lição dela não entrou no RG | revisão = sessão própria que FECHA no dossiê; conserto = lote seguinte; teto de passos por marco |
| B12 | M | CL:90; RP:29; RG | cinco etapas × dez marcos: não está dito como convivem | uma linha no RG: a revisão é "etapa 2 de 5"; marco não se anuncia; sem conserto não há etapa 4 |
| B13 | M | RG:33 × TOOL:162; RG:49 × TOOL:46; RG:54 × TOOL:77; TOOL:16-18, :25 × :168 | o doc e a ferramenta divergem (nome solto; módulos do `controle/`; `capturas/`; piso de 10%) | a ferramenta imprime a tabela de marcos e o RG a copia |
| B14 | B | RG:57, :62, :75; D14:32-37; RES:20; RG:10-19, :17; CL:473; PED:351-360 | três vocabulários de estado; tabela sem ids; coluna `tamanho` exigida e ausente; lista partida; citação de coluna removida; itens FEITO guardados; faltam critério de parada, gravidade e ordem dos marcos | um vocabulário, colunas `id` e `tamanho`, e as três lacunas escritas |

---

## Pacote D — enxugar e unificar (Pacote 27)

Só texto. Sai por último porque A e B movem trechos que D depois corta.

| # | g | onde | o que está errado | a correção |
|---|---|---|---|---|
| D1 | M | CL:22 × CL:27-28 × AG:32 × PC:23 × EC:22 | "lido inteiro em toda sessão" × "o resto é consulta" × "o trecho, nunca o arquivo"; o CL tem 45,5 kB | regra única: o topo (até "A conversa") + "Regras de desenvolvimento"; o resto por âncora |
| D2 | M | CL:190-253, :254-286, :288-379, :479-502, :537-610, :612-692 | sai sem perda: os 16 tocos "Movido" (viram coluna na tabela do topo); Build; o método dos oráculos; a entrega delegada (→ EC); a poda de comentário; "O NÚMERO" + "A versão" (→ BU) | alvo: CL em 20–25 kB |
| D3 | M | CL:85, :86, :90; MA:45, :78; AG:21-23, :139 | "fala DUAS vezes" × cinco linhas de etapa × "a primeira fala diz a área" × "sem nome de arquivo"; "sem entrega no app não há etapa 4" só existe no AG | uma tabela no CL com as falas permitidas; os outros apontam |
| D4 | M | CL:481, :484 × EC:43 | "toda tarefa substantiva nasce delegada" × "só compensa quando é leitura"; "substantiva" e "teto de passos" sem número; não diz se as chamadas do subagente contam | critério objetivo e teto padrão no briefing |
| D5 | M | CL:285 × BU:322; CL:256 × `apk.yml`:95; CL:385 × `apk.yml`:879-887; CL:444-453 = BU:355-438; CL:523-531 = BU:440-453; CL:683-686 = BU:455-468 | duplicação que JÁ divergiu (backup "três" × "quatro"; o runner; o `if` do OTA) e cópias inteiras | fonte única: CL = regra em uma linha + link; BU = CI, versão e rito; NUCLEO = ponte e OTA |
| D6 | M | BU:148, :150, :201, :257-280, :10, :164, :450; `apk.yml`:544, :573 | contagens velhas: "158 oráculos" (são 179, 37 puros); "127 linhas" (são 295); 9 testes JUnit (são 11); seções citadas que não existem | número fora da prosa: apontar o `estado.sh` |
| D7 | M | `docs/ESTRUTURA.md`:164, :200 | o mapa não tem `tools/`, `site/`, `.github/`, `capturas/`, 12 `docs/*.md` nem `docs/revisao/`; "31 arquivos Kotlin" (são 32); "4 filas" (são seis) | um bloco de ferramentas + a lista de docs; o número sai ou entra no oráculo |
| D8 | B | CL:27, :74, :519, :578-579, :710; CL:500; EC:56 | a ordem do índice não é a do arquivo; manda atualizar a seção "A ponte", que virou toco; `REGISTRO.md` "congelado" × "a fila e o andamento"; "anexo técnico do lote" sem casa | acertar os cinco |

---

## O que a revisão NÃO conferiu

- O estado do CI no HEAD e os logs dos runs vermelhos (inferidos pela mensagem
  dos commits de conserto).
- Se a Release v1.14.13 existe e o que o canal serve.
- Os escopos do token, se o arquivo e o cofre guardam o mesmo valor, e o preço
  do modelo atual.
- O corpo do `HISTORICO.md`, do `ORACULOS.md` e das auditorias datadas.
- Onde mora o `ATIVO.md` (C8).
- Só cinco apontamentos graves foram reconferidos pela sessão principal (C1,
  A2, A3, A5 e a contagem dos 33 commits); os demais se apoiam na evidência dos
  revisores — **confirme cada um antes de consertar**.
