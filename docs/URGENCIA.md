# Urgência — a revisão das diretrizes de 2026-11-14

O operador pediu uma revisão das diretrizes e metodologias (o contrato, o rito
de entrega, os processos de revisão e as instruções desta máquina). Três
revisores leram tudo e conferiram contra o que os scripts e o CI FAZEM. Saíram
cerca de 50 apontamentos, 12 graves. **Este arquivo é a lista do que consertar**:
restam os Pacotes 26 e 27 da fila (`PEDIDOS-EM-ESPERA.md`); o 24 (o C) e o 25
(o A) saíram em 2026-11-14.

**Como se usa.**

- **Um pacote por sessão**, na ordem **B → D** (C e A saíram). Leia SÓ o pacote da vez
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
