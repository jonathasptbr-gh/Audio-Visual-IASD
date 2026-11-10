# O mapa do miolo

**O que é.** A porta de entrada para o `controle/controle.js` — ~46 mil linhas e
2,3 MB, o único arquivo do projeto que ninguém lê inteiro. Este capítulo não
guarda linha nenhuma: ensina a **perguntar antes de abrir**, e o comando
`tools/miolo.mjs` responde com as linhas do arquivo de hoje.

**A regra de uso.** Pergunte aqui primeiro; leia só a faixa que a resposta
apontou. Foi o que o estudo de 2026-11-10 mediu: uma alteração no miolo move ~73
linhas, mas quem edita às cegas lê ~300 para descobrir *onde* e *quem depende* —
e é essa leitura em volta, não o tamanho do arquivo, que enche a sessão.

## Os sete subcomandos

Todos começam com `node tools/miolo.mjs`.

| comando | responde | quando |
|---|---|---|
| `miolo.mjs fatias` | as nove fatias, com linhas, funções e seções | orientar-se antes de procurar |
| `miolo.mjs secoes [--fatia N]` | as seções na ordem, com o título de cada uma | não sei o nome de nada, sei o assunto |
| `miolo.mjs buscar <termo>` | seções e nomes que casam (sem acento, sem caixa) | o termo é vago: "biblioteca", "cifra" |
| `miolo.mjs simbolo <nome>` | onde o nome nasce: tipo, faixa de linhas, seção, quem o usa | o nome é exato |
| `miolo.mjs usa <nome>` | cada referência ao nome, com a linha e a função que a contém | vou MEXER no nome |
| `miolo.mjs estado [termo]` | os nomes de estado de topo, agrupados por fatia | "quem guarda a fila?" |
| `miolo.mjs cortes` | quantos nomes atravessam cada fronteira entre fatias | discutir um corte |

`simbolo` e `usa` são os dois que pagam o custo: eles respondem o que o `grep`
não responde — *o que aquela linha é* e *quem depende dela*. Para alterar uma
função, o roteiro é `simbolo` (achar e ver o tamanho) → `usa` (a lista de quem
chama) → ler só a faixa.

## As nove fatias

O miolo está dividido nas nove fatias que a revisão de 2026-11 já tinha mapeado,
e elas são carregadas **na ordem do arquivo**:

1. abertura, preview, áudio
2. cena, fila, Bíblia, destinos
3. Ferramentas
4. Cronograma, Biblioteca, séries, favoritos
5. cifra, leitura, Modo Fácil, seleção
6. acervo, busca, YouTube
7. downloads, playlist automática, Registro
8. Transferir, share, via nativa, wallpaper
9. Configurações, modos, volume, telão

**As fatias são um MAPA, não um corte.** Hoje elas são um só arquivo; o estudo
`docs/revisao/PARTIR-O-MIOLO.md` mede o que custaria transformá-las em nove
arquivos de verdade — e o que isso NÃO resolve.

## As âncoras, e por que só elas envelhecem

Cada fatia começa numa **função nomeada** (`prepararMidia`, `chronoSetDuration`,
`abrirNaFaixaDaLinha`, …), e a linha sai do arquivo a cada execução. Não há
número de linha escrito à mão em lugar nenhum: um lote pode inserir 300 linhas
acima e o mapa continua certo.

O que pode apodrecer é o NOME. Se um lote renomear a função de âncora, o comando
**recusa e diz qual** — falha alto, em vez de apontar para o lugar errado —, e o
oráculo `tools/miolo.test.mjs` cobra as oito no CI. A correção é de uma linha em
`tools/miolo.mjs`: a função seguinte à fronteira serve.

## O que ele não é

- **Não é oráculo.** Ele descreve; não prova comportamento. Quem prova são os
  ~170 oráculos de `tools/`.
- **Não substitui o `grep`.** Um nome que nasce dentro de uma função não está no
  mapa (só o topo do arquivo está); para esses, `grep` continua sendo o caminho.
- **Não é contrato de corte.** As nove fatias são uma leitura do arquivo, não
  uma promessa de que ele será partido daquele jeito.

## Por que ele precisa do `acorn`, e o que roda sem ele

O comando lê a árvore do `controle.js` com o `acorn` do arnês (já está no
`package.json`; nada disso viaja no APK). O **oráculo** não executa o comando —
os oráculos de Node puro rodam antes do `npm ci`, onde não há `node_modules`
(ver o cabeçalho de `tools/checar.mjs`) — ele cobra as âncoras por texto, que é
exatamente o que pode envelhecer.
