# A poda de comentário — as duas provas

> **Lida antes de apagar comentário de código.** A regra que a manda fazer está
> no `CLAUDE.md` ("Documentação", *"APAGAR CÓDIGO É APAGAR O QUE O DESCREVE"*);
> aqui mora o MÉTODO, que é onde a poda erra em silêncio.

**Poda de comentário se PROVA, não se confere de olho — e são DUAS provas.**

## 1 · O código não mudou

Remova os comentários dos dois lados, normalize o espaço em branco e compare com
`git show <ref>:<arquivo>`. É a defesa contra apagar uma linha de código junto
com o parágrafo que a explicava — e ela também prova, no fim do lote, que um
lote de documentação é **só web** e não precisa de Release.

## 2 · Cada comentário continua sobre o que ele explica

```bash
node tools/pares-de-comentario.mjs <arquivo> <ref>
```

Ele casa os blocos pelo cabeçalho e reprova quando um deles passou a encabeçar
outro símbolo.

## Por que as duas, e não uma

**A prova 1 é CEGA à troca de lugar, e por isso a 2 existe.** Remover os
comentários dos dois lados e comparar aprova uma **rotação completa** dos blocos:
foi o que a v5.300 fez com o `display.js` (commits `4ed5061` e `da615b8`), onde
oito blocos andaram uma casa e cada um passou a explicar a função errada — o
bloco do relógio da origem foi parar dentro do `telaAplicarWallpaper`, e o da
pré-carga do wallpaper, sobre o `agoraDaOrigem`. As duas mensagens de commit
afirmavam "código inalterado (verificado por remoção de comentários contra
HEAD)", e estavam certas: o método é que não via.

**Um comentário no lugar errado é pior que um comentário removido: ele responde,
e responde errado.** Para desfazer uma poda errada, `cp` do backup em
`~/tmp/backup-*` — **nunca** `git checkout <arquivo>`, que apaga o lote inteiro
naquele arquivo (`docs/MULTI-AGENTE.md`, regra 4).
