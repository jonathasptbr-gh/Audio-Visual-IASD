# Partir o miolo — o que custa e o que rende

**Medido em 2026-11-10** sobre `controle/controle.js` com **46.303 linhas / 2,27
MB** (HEAD `32095623`, v1.13.58). É o estudo que a X4 devia ao operador: ela foi
retirada da fila em 2026-11-09 para virar *"uma revisão focada em eficiência,
como elemento único"* — este é o terreno que ficou escrito lá, medido.

> **O número que não se mede aqui não se cita neste documento.** Toda linha
> abaixo sai de uma leitura do arquivo de hoje, e o anexo diz como refazer.

## O que se mediu, e como

Leitura da árvore do arquivo (`acorn`, o mesmo parser do arnês) mais a ordem real
dos `<script>` do `controle/index.html`. Três perguntas, e cada uma tem uma
resposta que muda a decisão:

1. **O corte quebra o carregamento?** — içar funções, zona morta temporal,
   ordem de execução no `load`.
2. **O corte faz módulos?** — quantos nomes cada fatia usa de fora dela.
3. **Quanto ainda dá para extrair por pureza?** — a regra que o projeto já usa
   para os onze módulos de `controle/`.

## 1. O miolo em números

| grandeza | valor |
|---|---|
| linhas / tamanho | 46.303 / 2,27 MB — **8,1×** os onze módulos puros somados (286 kB) |
| nomes de topo | 2.291 (1.341 funções — 1.323 declaradas e 18 setas — e 950 de estado) |
| seções marcadas (`// ===== … =====`) | 252 |
| blocos que **executam** no carregamento (fora de declaração) | 166 |
| leitores que abrem o arquivo como texto | **17** (16 com `readFileSync` em `tools/`, mais o `tools/estado.sh` por Python) |
| mudança recente típica | **73 linhas** (as 8 últimas que tocaram o miolo, 385+ / 201−) |

O último número é o que desarma a intuição: **não se carrega o arquivo ao
editá-lo.** Carrega-se a vizinhança — e a média paga é de ~300 linhas para
descobrir onde e quem depende. O que o tamanho rouba é outra coisa, e ela está no
§3.

## 2. O corte é seguro? Sim — se a ordem for a mesma

A hipótese que assusta é a de sempre: uma função de cima chamar, na CARGA, uma
função declarada embaixo. Hoje isso funciona porque o arquivo inteiro é lido
antes de qualquer linha rodar (içar de função). Partido em arquivos, o de cima
roda antes do de baixo, e aquela chamada vira `ReferenceError`.

**Medido:** há **26 referências tardias** (um bloco de carga que cita algo
declarado depois dele). **Dezenove só rodam depois da carga** — estão dentro de
ouvinte, `setTimeout` ou `requestAnimationFrame`, que disparam quando todos os
arquivos já foram lidos. As outras **sete executam na hora** (três IIFEs — a
vigilância da prévia, a dos gestos e o `init()` do OTA — e o
`if (window.__NATIVE__)`), e **todas as sete chamam funções da própria fatia**.
Nos oito cortes propostos, **zero** quebram:

| corte | referências síncronas quebradas |
|---|---|
| as oito fronteiras (1→2 … 8→9) | **0** |

Essas sete moram todas na **mesma fatia** do que chamam, então o corte as
preserva de graça.

O resto do mecanismo também já está pronto, e isto foi a surpresa boa:

- **Redeclaração não existe**: os 2.291 nomes são únicos no arquivo hoje; dois
  `<script>` clássicos compartilham o escopo lexical global, e nomes distintos
  continuam distintos.
- **A CI não precisa aprender nada**: a Sanidade já faz `node --check` em *cada*
  `.js` da pasta (`apk.yml:125`), e o zip do OTA já leva a árvore inteira
  (`apk.yml:1102`).
- **O servidor não cadastra arquivo**: o `WebPathHandler` serve qualquer caminho
  do bundle.
- **O watchdog escala**: `otaAppIsUp()` exige o global de cada script, então um
  arquivo novo entra na lista e passa a ser vigiado — é o desenho, não um
  obstáculo (§4).

**O que quebra de verdade é escrituração, e é o §4.**

## 3. O corte NÃO faz módulos — e é aqui que a intuição erra

Nove arquivos carregados na mesma ordem **não são nove módulos**: são nove
pedaços de um mesmo escopo global, sem `import`, sem fronteira, sem interface.
Nada impede a fatia 7 de ler o estado da fatia 4, e nada avisa quem lê a fatia 7
que ele depende de 169 nomes que moram fora.

**Medido — a auto-contenção de cada fatia** (dos nomes que ela referencia,
quantos nascem dentro dela):

| fatia | nomes que usa | de fora | auto-contenção |
|---|---|---|---|
| 1 · abertura, preview, áudio | 304 | 57 | **81%** |
| 2 · cena, fila, Bíblia, destinos | 350 | 212 | 39% |
| 3 · Ferramentas | 291 | 113 | 61% |
| 4 · Cronograma, Biblioteca, séries | 378 | 234 | 38% |
| 5 · cifra, leitura, Modo Fácil | 324 | 155 | 52% |
| 6 · acervo, busca, YouTube | 344 | 149 | 57% |
| 7 · downloads, playlist, Registro | 369 | 169 | 54% |
| 8 · Transferir, share, wallpaper | 431 | 138 | 68% |
| 9 · Configurações, modos, volume, telão | 357 | 210 | 41% |

**1.638 pares (nome, fronteira)** atravessam as nove fatias, e **70 dos 72
pares ordenados de fatias** se citam (só 2→7 e 3→9 nunca se tocam). A forma do arquivo é um núcleo com
o estado (a fatia 1 guarda 405 dos 950 nomes de estado) e oito satélites que
apontam para ele.

Duas consequências que decidem o desenho:

- **A fronteira 1|2 é a cara**: 268 nomes nascem na fatia 1 e são usados na 2.
  A 2|3 custa 118. As outras seis custam entre 29 e 71. Isto é a assinatura de
  um arquivo cujo estado mora no topo — **não há corte barato antes da fatia 3**.
- **Quem lê uma fatia continua precisando de metade do resto.** A fatia 4 (38%)
  é a pior: dois de cada três nomes que ela menciona estão em outro arquivo.

Ou seja: o corte entrega **gaveta, não cerca** — e a gaveta já existe, de graça,
no mapa (§7). Cerca de verdade é `import`/`export`, que é outra obra: refazer
1.341 funções e 950 nomes de estado, um por um, sem build no meio.

## 4. O custo de verdade: doze frentes de escrituração

Tudo abaixo é mecânico e verificável — e nada disso é opcional, porque cada item
falha **calado** (o modo de falhar que este projeto paga mais caro):

| # | frente | o que muda |
|---|---|---|
| 1 | `controle/index.html` | +8 `<script src>`, todos antes do `controle.js` (15 → 23) |
| 2 | `shared/native.js` `otaAppIsUp()` | +8 globais na lista; arquivo novo fora dela = bundle **nunca confirmado** e descartado no lançamento seguinte |
| 3 | fim de cada arquivo novo | 8 globais novos, um por arquivo (a convenção que o watchdog lê) |
| 4 | `tools/watchdog-modulos.test.mjs` | a premissa "`controle.js` é o último" e o mapa global-por-arquivo |
| 5 | `.github/workflows/apk.yml:182` | a regex do `WEB_VERSION` abre `controle/controle.js` por caminho — passa a procurar na pasta |
| 6 | `tools/estado.sh:40` | a mesma regex, no script que abre toda sessão |
| 7 | `controle.js:30941` (`partes-do-bundle`) | a autoverificação busca 18 caminhos fixos |
| 8 | `controle.js:30973` (`modulos`) | exige 13 globais; `verificacao-do-sistema.test.mjs` afirma "os **treze** módulos de pé" |
| 9 | os 17 leitores (§1) | **4 quebram** (`watchdog-modulos`, `funcao-sem-chamador`, `pares-de-comentario` e o próprio `miolo.mjs`), **10 pedem ajuste**, 3 sobrevivem sozinhos |
| 10 | `abertura-e-transferencia` e `ota-confirma` | usam "abortar `controle.js`" como sinônimo de "o app não carrega" — depois do corte, bloquear 1 pedaço deixa o resto subir |
| 11 | `docs/ARQUITETURA-WEB.md` | `docs-coerentes` exige **todo** `.js` da pasta documentado: +8 linhas |
| 12 | docs com faixa de linha | `REGISTRO.md` tem as nove cercas (somam ~48,8 mil linhas contra 46,3 mil de hoje — **já defasadas em ~2,5 mil**), mais `AUDITORIA-2026-08`, `REVISAO-PROFUNDA`, e ~35 comentários do próprio arquivo que dizem "ver mais abaixo/ no fim do arquivo" (3 deles com número absoluto) |

**A frente 10 é a que ninguém espera**: dois oráculos de comportamento medem "o
app não carrega" bloqueando *um* arquivo. Depois do corte eles passam a medir
outra coisa — e um oráculo que mede outra coisa é pior que oráculo nenhum.

**A frente 9 tem a sua própria surpresa, e ela custa caro**: dois oráculos
classificam arquivo por NOME. O `funcao-sem-chamador` trata "todo `.js` de
`controle/` que não é `controle.js`" como módulo puro — as nove fatias caem
nesse filtro e passam a ser cobradas como módulos (`global.X = { … }`), que não
são. E o `sombra` mede nomes de topo POR ARQUIVO: com nove arquivos ele fica cego
às colisões entre fatias, que são exatamente o risco novo que o corte cria. O
`miolo.mjs` (o mapa do §7) também assume um arquivo só — ele teria de passar a
ler a ordem de carga.

**E a frente 12 é o argumento mais forte contra escrever linha em documento**:
as cercas por linha da revisão de 2026-11 já não batem com o arquivo. Por isso
`docs/arquitetura/MIOLO.md` não tem número nenhum — o `tools/miolo.mjs` os
imprime da fonte.

## 5. Quanto ainda dá para virar módulo puro

A regra do projeto (e a que produziu os onze módulos de `controle/`) é *extrair
o que é puro*: sem DOM, com oráculo em Node. A pergunta é se ainda há carne.

**Medido, com a contaminação propagada por chamada** (quem chama quem toca o DOM
também toca):

| classe | funções | linhas |
|---|---|---|
| tocam o DOM, direto ou por chamada | 814 | 24.093 |
| sem DOM | 509 | 4.669 |
| **sem DOM e sem estado do módulo** | **210** | **1.537** |

As maiores candidatas têm 48, 46, 45, 37 e 37 linhas (`serieFaixaDoItem`,
`serieComoYoutube`, `telaSanearRec`, `buildLyricSlides`,
`pacoteAcertarPonteiros`). **O caminho de extrair por pureza está quase
esgotado**: 5% do miolo é puro, e em pedaços de 20–50 linhas. O resto (84%) é
cola de DOM, e cola de DOM não vira módulo sem interface — que é o §3 de novo.

## 6. Os quatro desenhos, com o custo medido

| desenho | o que é | ganho | custo |
|---|---|---|---|
| **A · nove fatias** | nove arquivos na ordem, escopo compartilhado | abrir uma fatia inteira (2,2–7,3 mil linhas); nome por assunto; diff menor | as doze frentes do §4; auto-contenção média 54% |
| **B · três pedaços** | [1+2+3] · [4+5] · [6..9] — só nos vãos baratos (§3) | idem, com menos fronteiras caras | idem, e o primeiro arquivo fica com 25% do miolo |
| **C · não cortar** | o mapa (§7) + extrair por pureza quando mexer na área | o mesmo "onde está o quê", sem tocar no carregamento | ~1 lote (feito) |
| **D · módulos de verdade** | `import`/`export` nas 1.341 funções | as duas coisas: gaveta e cerca | refazer o arquivo inteiro, sem build, sob 17 leitores do texto |

D não é loucura para sempre, mas é o único que muda o **modo de programar** deste
repositório (hoje: scripts clássicos, escopo global, `window.__avBack`) — e esse
modo é o que faz a ponte e o watchdog funcionarem.

## 7. O mapa, que é o pedaço barato

O que se ganha com A sem cortar nada: **`tools/miolo.mjs`** responde *onde* (sete
subcomandos), e `docs/arquitetura/MIOLO.md` é a porta de entrada. Ele custou um
lote, não toca no app, não sobe versão, e as nove fatias já estão lá dentro —
medidas, não escritas.

Se depois de alguns lotes com o mapa a dor de editar continuar, o corte começa
com um número na mão: quantas vezes a sessão precisou abrir uma fatia inteira.

## 8. O que o corte NÃO resolve

- **Não reduz o contexto por edição.** A leitura em volta continua a mesma; o que
  muda é o tamanho máximo do que se pode abrir de uma vez.
- **Não encapsula nada** (§3). Sem `import`, "módulo" é só um nome de arquivo.
- **Não acelera o app.** A abertura já foi medida (X3: 153/167 ms no Chromium do
  CI) e o parse de 2,3 MB não está no caminho crítico.
- **Não apaga o estado do topo.** Os 950 nomes de estado continuam globais, e a fatia 1
  continua sendo o hub.

## 9. Recomendação

1. **Agora: C.** O mapa está de pé e não custou o app. Use-o por alguns lotes.
2. **Se for cortar, A** — não B: o valor de A é o NOME por assunto, e B junta
   três assuntos no arquivo que mais se lê. As fronteiras caras do §3 não são
   defeito (o carregamento não se importa com elas); só não prometa módulo.
3. **Antes do corte, um lote de preparação** (um leitor único em `tools/`, a
   nascer): um leitor
   único que devolve o texto do miolo na ORDEM de carga. Os 17 leitores passam a
   ler dele, e as linhas continuam idênticas com um arquivo ou com nove. A frente
   9 (a mais cara) some, e o corte vira um `git mv` verificável.
4. **A decisão é do operador, e o critério é o §7**: se o mapa resolveu, não
   corte; se a sessão continua abrindo 40 mil linhas, corte.

---

## Anexo — como refazer a medição

- As fatias, as linhas e as seções: `node tools/miolo.mjs fatias`.
- O que cada fronteira cruza: `node tools/miolo.mjs cortes`.
- As referências tardias e a pureza: a leitura da árvore com `acorn`, contando
  (a) bloco de carga que cita nome declarado depois dele, separando o que está
  dentro de ouvinte/`setTimeout` do que roda na hora; e (b) função que toca o
  DOM direto ou por chamada, com a contaminação propagada até não mudar.
- A mudança típica: `git log --numstat -8 -- app/src/main/assets/web/controle/controle.js`.

**O que este estudo NÃO mediu:** tempo de sessão gasto por edição (não há
instrumento para isso aqui), e o ganho humano de um arquivo com nome — que é
real e não tem unidade.
