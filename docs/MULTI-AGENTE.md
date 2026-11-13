# Duas sessões no mesmo clone — o protocolo

> **2026-11-13 · regra de interação, não estudo.** Pedido do operador: *"dois
> chats diferentes não se comunicam… a ponto de não saberem como interagir ou
> reagir às interferências de outros"*. Este capítulo é o que falta entre eles.

---

## 0 · O que duas sessões compartilham, e o que não

| compartilham, sem combinarem nada | não compartilham de forma nenhuma |
|---|---|
| o **working tree** (os mesmos arquivos no disco) | o **contexto**: o que cada uma leu, deduziu e decidiu |
| o **HEAD** e o índice do git | a fila de trabalho que o operador combinou com cada uma |
| os **logs e o CI** do repositório | o momento: uma pode estar no passo 3 e a outra no passo 40 |

A consequência é uma só, e é a regra-mãe deste capítulo:

> **O working tree é de todos; o commit é de quem editou.**

O que aconteceu em 2026-11-13, e que este capítulo existe para impedir: a sessão
A mediu o HEAD `94924a02` e começou um estudo; no meio, a sessão B commitou
`316a4ec5` e deixou **13 arquivos sujos** no tree. A sessão A só lia, então nada
aconteceu — mas se tivesse rodado `git add -A`, teria levado o lote alheio para
dentro do próprio commit, e o rito de versão do projeto (as quatro casas, o
`shellTag`, a Release) ficaria partido ao meio entre dois commits.

---

## 1 · As sete regras

### 1. Medir o estado antes de tocar

```bash
git -c safe.directory='*' status --short
git -c safe.directory='*' log --oneline -3
ls -l --time-style=+%H:%M <os arquivos que vai editar>
```

**Arquivo sujo que não é seu = você não é o dono do commit dele.** Saber onde o
outro está é o que separa "editei junto sem perceber" de "editei e avisei".

### 2. Declarar o escopo, uma vez

A primeira fala de cada sessão ao operador diz **qual área ela está tocando**
(`web/controle`, `tools/`, `docs/`, Kotlin). É o que permite ao operador — o
único que fala com as duas — evitar o choque antes dele acontecer.

### 3. Commitar só o que é seu

```bash
git add caminho/do/arquivo      # sempre por caminho
```

**Nunca `git add -A`, nunca `git commit -a`, nunca `git add .`.** O commit de
uma sessão é a fronteira: o que está fora dele não é dela.

### 4. Nunca desfazer trabalho alheio

**Proibidos sem pedido explícito do operador**: `git checkout -- <arq>`,
`git reset --hard`, `git stash`, `git clean`, `git restore`. A armadilha já
está no `AGENTS.md` da máquina: *"`git checkout <arq>` para desfazer apaga o
lote"* — e ele apaga o lote do OUTRO também, em silêncio.

Reverter o próprio trabalho é `cp` do backup em `~/tmp/backup-*`, nunca o git.

### 5. Arquivo compartilhado sujo: editar sim, commitar não

Se o arquivo que a sua tarefa precisa **já está sujo por outra sessão**:

| o que fazer | por quê |
|---|---|
| **reler o trecho antes de editar** (não confie no que você leu antes) | o outro pode ter mudado a linha |
| **editar local e cirurgicamente** (append, uma linha, uma seção) | uma reescrita inteira apaga o trabalho dele |
| **não commitar o arquivo** | o commit levaria a edição dele junto |
| **avisar o operador** em uma linha: "a mudança ficou aplicada e entra no commit da outra sessão" | para não parecer que ficou perdida |

**Nunca** faça isso com `version.json`, `WEB_VERSION`, `#appVersion`,
`SHELL_VERSION` ou `notas.json`: são os arquivos do **rito** — mexer neles pela
metade é o defeito que o CI cobra e que o OTA publica.

### 6. Não disparar o build de outro lote

Todo passo de CI é do lote que está na `main`. Se a árvore tem trabalho alheio,
`dispatch-release`, tag ou *Build APK* podem empacotar um estado que ninguém
terminou de escrever. **Build só com o seu lote commitado e o resto declarado.**

### 7. Conflito: parar e avisar

Se o `pull`/`merge`/`push` conflitar, **não resolva escolhendo um lado**. As
duas sessões podem estar certas em partes diferentes. Pare, diga qual arquivo e
qual trecho, e deixe o operador decidir.

---

## 2 · Como detectar que o outro mexeu

| sinal | o que significa | o que fazer |
|---|---|---|
| o **HEAD mudou** desde que você mediu | a outra sessão commitou | re-`status`; se o seu arquivo continua limpo, siga |
| um **arquivo que você leu mudou** (mtime diferente) | o outro editou o mesmo arquivo | releia antes de editar; se a linha que você ia mudar sumiu, pare |
| o **`git status` mostra arquivo que você não tocou** | trabalho alheio no tree | regra 5 |
| **dois commits** com o mesmo número de versão | as duas sessões tocaram o rito | pare: o rito é de uma só |

---

## 3 · Onde as duas sessões se encontram

O git não é canal de recado. Este é:

**`~/tmp/agents/ATIVO.md`** — fora do repositório (não polui o projeto, não
entra em commit), abaixo do `HOME`, que as duas sessões compartilham.

Formato, uma linha por sessão viva:

```
| desde  | escopo                    | arquivos que vai tocar         |
|--------|---------------------------|--------------------------------|
| 19:50  | docs/PEDIDOS, docs/*.md   | PEDIDOS-EM-ESPERA.md           |
```

**Ao abrir a sessão:** leia o arquivo. **Ao fechar:** apague a sua linha.
Linha de mais de 2 horas sem atualização é sessão morta — apague e siga.

```bash
mkdir -p ~/tmp/agents && cat ~/tmp/agents/ATIVO.md 2>/dev/null
```

Isto **não substitui** a regra 1: o arquivo é cortesia, o `git status` é a
verdade.

---

## 4 · As três áreas e quem cede

| se as duas querem… | cede quem… |
|---|---|
| **o mesmo arquivo** | chegou depois: espera, ou edita sem commitar (regra 5) |
| **a mesma área, arquivos diferentes** | chegou depois **separa o commit** e não roda o portão inteiro por cima |
| **o rito (versão, `SHELL_VERSION`, `notas.json`, Release)** | **sempre a que ainda não começou** — o rito é indivisível e de uma sessão só |

---

## 5 · Como saber que funcionou

Três testes que o operador pode cobrar, sem ler código:

1. **Nenhum commit contém arquivo que a sessão não editou** — `git show --stat`
   de cada commit, um por um.
2. **Nenhum trabalho sumiu** — o que a sessão B deixou no tree continua no tree
   (ou foi commitado por ela), nunca apagado pela A.
3. **O operador não precisou arbitrar** — se ele teve de dizer "não mexe nisso,
   a outra está mexendo", o protocolo falhou antes, na regra 2.
