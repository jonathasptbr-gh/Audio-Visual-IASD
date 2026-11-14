# Economia de sessão — o custo é o contexto

**Regra mestra:** a chamada custa o que já está na conversa. Cada passo relê o
contexto inteiro, e o preço acompanha esse tamanho — não o tamanho do que se
escreve.

```
custo ≈ chamadas × contexto médio          (nunca: custo ≈ linhas escritas)
```

**Medido em 2026-11-10, em 2.131 chamadas reais** (24 sessões, 19,6 h de janela
ativa, 09–10/11): **99% dos tokens que entram são cache relido** e o cache foi
**90% da conta**. A saída foi 5% e a entrada nova, 4%. Quem quer cortar gasto
corta PASSO, não texto.

## Os três tetos

| teto | número | evidência |
|---|---|---|
| **sessão** | **150 chamadas** | o passo depois da 400ª custa **5,6×** o da 1ª–25ª (medido em 10/11); uma sessão de 589 chamadas consumiu **44%** do gasto de um dia |
| **resultado de ferramenta** | **10 kB** | carregar resultado de ferramenta foi **34%** da conta; 70% desse texto veio do `bash`. 10 kB esquecidos são relidos em CADA chamada seguinte |
| **leitura de arquivo** | **o trecho, nunca o arquivo** | `read` com `offset`/`limit`, e `grep` antes de abrir. O `CLAUDE.md` se lê uma vez por sessão — nunca de novo |

**No teto, a sessão ACABA.** O pacote publicado fecha a sessão; a próxima
começa com o contexto do repositório (`tools/estado.sh`, o pacote escolhido, o
`CLAUDE.md`), não com o da conversa anterior. Não se perde nada: o estado está
no repositório e no `HISTORICO.md`.

**Teto no MEIO do lote** (regra de 2026-11-14, Pacote 24/C10): meça por volta
das **120 chamadas** (`node ~/.dsh-github/uso.mjs`). Se o lote não fecha antes
de 150, **commita uma nota de passagem** (o que está pronto, o que falta, o
próximo passo) e **peça sessão nova** ao operador — nunca emende o resto na
sessão funda.

**Ordem de grandeza:** um pacote cabe em **~100 chamadas** (medido em 10/11).
O preço em dólar não mora no repositório — o medidor (`uso.mjs`) imprime a
faixa, e o sinal de sessão funda é o **teto de chamadas**, não um valor por
chamada.

## A rotina do pacote

| etapa | a regra | o que se evita |
|---|---|---|
| **1 Planejando** | `tools/estado.sh` + **o pacote escolhido** | varrer a fila inteira; reabrir o `CLAUDE.md` |
| **2 Executando** | varredura e leitura pesada **delegadas**; edição pontual | `cat` de arquivo, `grep` sem `-m`, log inteiro na tela |
| **3 Testando** | `tools/portao.sh <arquivo> > ~/tmp/portao.log` e ler o VERMELHO | despejar 300 linhas de oráculo no contexto |
| **4 Publicando** | nota no `HISTORICO.md` primeiro, commit curto, merge, push | escrever a nota em três lugares |
| **5 Conferindo** | medir e **fechar a sessão** | emendar o dia seguinte na mesma sessão |

**A delegação só compensa quando o trabalho é de leitura.** O subagente começa
com contexto vazio e devolve a conclusão; se a tarefa depende da conversa
inteira, ele re-lê tudo e o ganho some. O critério objetivo e o que o briefing
carrega estão na seção seguinte.

## A entrega delegada

**Toda tarefa de LEITURA nasce delegada** — e o critério é objetivo, não
adjetivo: delega-se quando o trabalho **lê mais de 3 arquivos, ou mais de 200
linhas, ou varre o repositório, ou roda a suíte**. Edição pontual — um trecho já
achado, uma linha, um arquivo já lido — fica na sessão: o briefing de um agente
custa mais que o corte.

**O briefing carrega quatro coisas, e nenhuma é opcional:**

| o que | o padrão |
|---|---|
| **escopo** | os arquivos e o que **NÃO** está na cerca |
| **teto de passos** | **60 chamadas** do subagente; acima disso o trabalho se divide em dois, ou o briefing está grande demais |
| **ponto de parada** | quando o pedido chega como **suspeita** ("defeito a confirmar"): voltar com a causa achada **ANTES** de consertar |
| **saída magra** | `head`/`tail` no que pode ser longo, UM caso do oráculo em vez do arquivo inteiro, log só de erro |

**As chamadas do subagente NÃO entram no teto de 150 da sessão** — ele tem
transcript próprio, e o medidor só vê o da sessão. O que a sessão paga é o
briefing (entra) e o resultado (volta); por isso um briefing longo para uma
tarefa curta é o jeito de delegar caro.

**O que decide o custo é o briefing, não o agente.** No Pacote 3 (2026-11-10) a
suspeita era falsa e o agente escreveu 348 linhas de oráculo no caminho errado —
205 passos e US$ 1,5–3,6 para uma correção de 31 linhas. A saída de ferramenta
é o maior item do contexto e é RELIDA a cada passo: no Pacote 3, 582 kB de
`bash` contra 107 kB de `read`, em 189 chamadas; na medição de 10/11, carregar
resultado foi **34% da conta**.

## A medição

```bash
node ~/.dsh-github/uso.mjs                 # a sessão: passos, tokens, custo, custo/passo
node ~/.dsh-github/uso.mjs --todas         # uma linha por sessão (não conta a retomada)
node ~/.dsh-github/uso.mjs --profundidade  # a curva: quanto custa o passo em cada faixa
```

Ela fecha o relatório do lote: o número (passos, cache lido, faixa) entra no
fecho da sessão, ao operador — **não há arquivo de anexo**. **Sessão retomada não se conta duas vezes:**
o transcript de uma sessão semeada carrega o histórico do pai, e o medidor
ignora as chamadas anteriores à criação dela — sem isso, uma retomada infla o
total em até 26%.

## O que NÃO economiza

| mudança | efeito medido |
|---|---|
| esforço `max` → `high` | nenhum efeito medido (10/11): a diferença não passou do ruído |
| escrever menos | pouco: a saída é 5% da conta |
| trocar de modelo | não há degrau abaixo do `deepseek-flash` neste ambiente |

O que economiza é passo — e passo é decisão de quem conduz a sessão, não uma
configuração do aplicativo.

## O limite

Os números são de **um dia de trabalho** (09–10/11/2026). A proporção — cache
dominando, passo encarecendo com a profundidade — se sustenta; o valor absoluto
muda com preço e câmbio. **Meça antes de citar** (`node ~/.dsh-github/uso.mjs`).
