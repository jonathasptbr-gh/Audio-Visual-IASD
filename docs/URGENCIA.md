# Urgência — a revisão das diretrizes de 2026-11-14

O operador pediu uma revisão das diretrizes e metodologias (o contrato, o rito
de entrega, os processos de revisão e as instruções desta máquina). Três
revisores leram tudo e conferiram contra o que os scripts e o CI FAZEM. Saíram
cerca de 50 apontamentos, 12 graves. **Este arquivo é a lista do que consertar**:
resta o Pacote 27 da fila (`PEDIDOS-EM-ESPERA.md`); o 24 (o C), o 25 (o A) e o
26 (o B) saíram em 2026-11-14.

**Como se usa.**

- **Um pacote por sessão.** Leia SÓ o pacote da vez
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
- **Ele ESVAZIA.** Pacote entregue sai daqui e da fila. Quando o D sair,
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

## Pacote D — enxugar e unificar (Pacote 27)

Só texto. Sai por último porque A e B moveram trechos que D corta.

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
