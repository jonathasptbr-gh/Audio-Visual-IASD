# Casos medidos — o que criou as regras do portão

> **Apêndice.** O [`CLAUDE.md`](../../CLAUDE.md) guarda a REGRA; este arquivo
> guarda o caso que a criou, com os nomes e os números de então. É para
> consultar por `grep` — nunca para ler inteiro —, e existe separado porque a
> regra de documentação manda a narrativa do achado sair do núcleo.
>
> Cada seção nomeia a regra do `CLAUDE.md` que ela sustenta.

## Os quatro oráculos que rodaram fora do workflow (v1.8.0 → v1.8.8)

Sustenta: *"teste que não está no workflow é documentação, não rede de
segurança"*.

Quatro vezes em nove lotes: a v1.8.0 com o `clone-de-outro-celular.test.mjs`, a
v1.8.2 com o `clone-lista-de-aparelhos.test.mjs`, um terceiro que a varredura da
v1.8.4 achou (`preview-volta-ao-wallpaper.test.mjs`) e, o mais caro deles, a
v1.8.8 com o `kotlin-simbolo-importado.test.mjs`.

**O quarto é o que mostra o custo.** Ele foi escrito para impedir que um símbolo
sem `import` derrubasse a `main` — que é o que a v1.8.6 tinha acabado de fazer —,
ficou fora do workflow, e por um lote inteiro o repositório teve a linha na
tabela, o arquivo no disco, e **nenhuma proteção**.

## O `notas.json` de 127 caracteres (v1.8.51)

Sustenta: *"e os oráculos não são o passo inteiro"*.

Rodar só os oráculos deu **98/98 locais** e o `web-ota` foi PULADO por um item
de 127 caracteres — o teto de 120 é travado pela Sanidade, que é um bloco de
shell dentro do workflow, e não está em `tools/` nenhum.

## As duas tautologias da revisão de 2026-09-07

Sustenta: *"a reversão é um passo"*.

Aconteceu duas vezes no mesmo dia, e uma delas passou porque o prazo de 8 s era
maior que a duração da faixa do cenário: a preview chegava ao fim sozinha e o
app avançava pelo caminho de sempre.

### A célula e a régua (v1.8.65)

Duas tautologias num lote só. Medido: o rodapé de Configurações cabe folgado a
430×1× e a 390×1×, e a asserção do recuo passava ali com e sem o conserto — só a
360×1,25× ela reprova. E a régua erra sozinha: medir `scrollWidth` do `<span>`
para provar que um rótulo não é cortado nunca acusa nada, porque o span é do
tamanho do próprio texto e quem é estourado é o PAI.

### A declaração que não fazia nada

Um `min-width: max-content` foi escrito para segurar o rótulo, ganhou comentário
e asserção, e a reversão mostrou que removê-lo não move um pixel: um item flex
já nasce com `min-width: auto`, e com `white-space: nowrap` isso É o rótulo
inteiro. Saíram a declaração, a asserção e o comentário, os três juntos — um
comentário que credita a peça errada manda o próximo leitor proteger o lugar
errado.

## Os dois oráculos sem sufixo (v1.8.50)

Sustenta: *"a lista do CI não é `tools/*.test.mjs`"*.

Um runner local que filtre por `*.test.mjs` pula o `smoke.mjs` e o
`display-smoke.mjs` em silêncio e devolve um placar cheio. O que ele escondeu foi
uma regra de CSS que subia o corpo de uma coleção por cima da própria barra.

## O `git checkout` que apagou o lote

Sustenta: *"a reversão se desfaz com uma cópia, nunca com o Git"*.

`git checkout <arquivo>` restaurou do HEAD e apagou o trabalho não commitado do
lote inteiro naquele arquivo — custou refazer quatro edições.

## A v5.121 e o `node --check`

Sustenta: *"`node --check` prova forma, não comportamento"*.

A v5.121 saiu com um botão chamando função apagada, sintaxe perfeita e CI verde.
O canal OTA publica direto para a frota, e o watchdog só descarta no lançamento
seguinte: um lançamento quebrado por aparelho, garantido.
