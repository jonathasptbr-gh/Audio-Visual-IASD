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
| **sessão** | **150 chamadas** | o passo custa US$ 0,0027 na 1ª–25ª e US$ 0,0150 depois da 400ª — **5,6×**; uma sessão de 589 chamadas consumiu **44%** do gasto de um dia |
| **resultado de ferramenta** | **10 kB** | carregar resultado de ferramenta foi **34%** da conta; 70% desse texto veio do `bash`. 10 kB esquecidos custam US$ 0,008 a cada 100 chamadas seguintes |
| **leitura de arquivo** | **o trecho, nunca o arquivo** | `read` com `offset`/`limit`, e `grep` antes de abrir. O `CLAUDE.md` se lê uma vez por sessão — nunca de novo |

**No teto, a sessão ACABA.** O pacote publicado fecha a sessão; a próxima
começa com o contexto do repositório (`tools/estado.sh`, o pacote escolhido, o
`CLAUDE.md`), não com o da conversa anterior. Não se perde nada: o estado está
no repositório e no `HISTORICO.md`.

**Ordem de grandeza:** um pacote dentro do teto (~100 chamadas) custa
**US$ 0,4–0,8**. Custo por chamada acima de **US$ 0,01** é o sinal de sessão
funda: publique e feche.

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
inteira, ele re-lê tudo e o ganho some. O briefing é o que decide o custo
dele — ver "A entrega delegada" no `CLAUDE.md`.

## A medição

```bash
node ~/.dsh-github/uso.mjs                 # a sessão: passos, tokens, custo, custo/passo
node ~/.dsh-github/uso.mjs --todas         # uma linha por sessão (não conta a retomada)
node ~/.dsh-github/uso.mjs --profundidade  # a curva: quanto custa o passo em cada faixa
```

Ela fecha o anexo técnico do lote. **Sessão retomada não se conta duas vezes:**
o transcript de uma sessão semeada carrega o histórico do pai, e o medidor
ignora as chamadas anteriores à criação dela — sem isso, uma retomada infla o
total em até 26%.

## O que NÃO economiza

| mudança | efeito medido |
|---|---|
| esforço `max` → `high` | nenhum: US$ 0,0069 contra US$ 0,0072 por chamada |
| escrever menos | pouco: a saída é 5% da conta |
| trocar de modelo | não há degrau abaixo do `deepseek-flash` neste ambiente |

O que economiza é passo — e passo é decisão de quem conduz a sessão, não uma
configuração do aplicativo.

## O limite

Os números são de **um dia de trabalho** (09–10/11/2026). A proporção — cache
dominando, passo encarecendo com a profundidade — se sustenta; o valor absoluto
muda com preço e câmbio. **Meça antes de citar** (`node ~/.dsh-github/uso.mjs`).
