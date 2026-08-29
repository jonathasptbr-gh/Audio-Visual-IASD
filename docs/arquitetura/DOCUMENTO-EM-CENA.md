<!-- Capítulo de docs/ARQUITETURA-WEB.md. O índice e as regras
     de desenvolvimento ficam lá; este arquivo é só este capítulo. -->

## Documento em cena: PDF, PowerPoint, Google Apresentações

O que o operador tem na mão é um PDF, um PowerPoint ou um Google
Apresentações. O que o app guarda é **uma imagem por página** — e é essa
tradução que torna o recurso pequeno: a partir dela a apresentação é mídia
comum, com o fade, a cortina, o telão e a `MediaSession` que já existem há
dezenas de versões.

**Não é um recurso de "apresentação", é um TIPO DE ARQUIVO a mais.** Não há
botão próprio, nem aba, nem fluxo separado (a v5.98 teve um, e ele saiu na
v5.99): o operador escolhe o ARQUIVO, e o app decide o que fazer com ele. Um
PDF comum — um roteiro, uma partitura, um comunicado — entra do mesmo jeito
que um de apresentação, porque para o app não há diferença entre os dois.

**Cada formato pelo caminho que existe para ele:**

- **PDF → o shell.** O Android traz um renderizador de PDF **na plataforma**
  (`PdfRenderer`, API 21+): fidelidade total e zero dependência. Ver
  `SlideDeck.kt`. É também o caminho do **Google Apresentações**, que tem uma
  URL de exportação em PDF (`/presentation/d/<id>/export/pdf`) — o shell a monta
  a partir do link e baixa, sem o operador exportar nada. Precisa estar
  compartilhada por link, que é como um roteiro de culto circula.
- **`.pptx` → o próprio WebView.** Aqui o Android não ajuda: não existe na
  plataforma quem desenhe OOXML. O renderizador é a única dependência do lado
  web (`assets/web/vendor/pptx-renderer.js`, Apache-2.0 — o levantamento que
  justifica a exceção está no `LEIA-ME.md` daquela pasta), e ele entra por
  `import()` **dinâmico**: é 1,5 MB que só interessa a quem importar um `.pptx`,
  e carregá-lo no boot custaria isso a todo culto.
- **`.ppt` (anterior a 2007) e `.odp` ficam de fora**, no `accept` do seletor e
  nos `intent-filter`: ninguém sabe desenhá-los, e aceitar para depois falhar é
  pior do que não aceitar.

**O `.pptx` produz DOM; o app projeta IMAGEM.** A ponte entre os dois é
`controle/deck.js` (`AVDeck`), sem biblioteca nenhuma: o slide vai para dentro
de um `<foreignObject>` de SVG, que o navegador desenha como imagem, e daí para
um canvas.

**Ele mora num arquivo próprio, ao lado de `serie.js`/`cifra.js`/`sorteio.js`/
`hinario.js`, e pelo mesmo motivo**: o `<foreignObject>` é um DOCUMENTO À
PARTE, então tudo que ele não alcança some **sem erro nenhum** — a
apresentação sai completa, com o número de páginas certo, e vazia. Um oráculo
(`tools/apresentacao.test.mjs`) só alcança o que tem porta de entrada, e um
teste do desfecho aprovaria as duas versões. Cada asserção de conteúdo lá tem a
REVERSÃO ao lado.

São **três** coisas que o SVG não alcança, e a primeira apagou 27 slides do
operador:

- **Toda mídia do `.pptx` chega como `blob:`, e uma URL blob não carrega dentro
  do `foreignObject`.** MEDIDO no material do operador (27 slides, "Semana da
  Família 2026"): o arquivo tem **zero `<img>`** — todo fundo é
  `style="background-image: url(blob:…)"` no `<div>` do slide. A versão anterior
  convertia só `<img>`, logo não convertia nada, e as 27 páginas saíam brancas
  com o texto solto no meio. `embutirRecursos` varre os DOIS lugares: o atributo
  (`<img src>`, `<image href>`) e o `url(...)` de qualquer propriedade do
  `style` inline. Os bytes atravessam por `FileReader` — o blob já é o JPEG que
  veio dentro do `.pptx`, e redesenhá-lo num canvas para `toDataURL` (o que a
  versão anterior fazia) reencodava uma fotografia como PNG de vários MB.
- **`cloneNode` copia o `<canvas>` e não o bitmap dele** (`trocarCanvas`): um
  GRÁFICO do PowerPoint sairia como retângulo vazio.
- **A fonte de símbolo não existe no Android** (`trocarSimbolos`). Marcador de
  tópico em PowerPoint é uma LETRA numa fonte do Windows: o `v` do material do
  operador é ❖ em Wingdings, e o `` do Symbol é •. Sem tradução o telão
  mostra a letra `v` — ou, no caso do Symbol, o retângulo vazio da área
  privativa. As tabelas são CURTAS de propósito: o que não estiver nelas é
  deixado como está (traduzir por palpite troca um erro visível por um errado
  que parece certo), com uma exceção — um caractere da área privativa
  (U+F000–U+F0FF) sem tradução vira `•`, porque ali não há como o caractere
  estar certo e um ponto é infinitamente melhor que um retângulo vazio.

Mais duas regras que não são opcionais:

- **A URL do SVG é `data:`, nunca `URL.createObjectURL`.** MEDIDO: um SVG
  carregado de uma `blob:` SUJA o canvas, e o `toBlob` seguinte lança
  `SecurityError` — a apresentação inteira falharia, com uma mensagem que não
  aponta para cá.
- **Fundo branco antes de desenhar**, como no lado nativo: o slide pode não
  pintar o próprio papel, e transparente, no telão, é o preto do palco — o texto
  escuro sumiria.

**O FORMATO É POR PÁGINA, e quem responde é o próprio PNG** (`escolherFormato`,
`PAGINA_LEVE` = 512 kB). Consertar as imagens muda a aritmética inteira —
MEDIDO sobre o material do operador, 1920×1080:

| formato | a apresentação inteira |
|---|---|
| PNG | **100,4 MB** |
| WebP sem perda | 57,7 MB |
| WebP q .9 | **12,3 MB** |

O argumento do PNG continua VERDADEIRO onde ele nasceu — slide é texto sobre
fundo chapado, e é ali que o compressor com perda borra a borda da letra que vai
ser lida de longe. Ele só não vale para a página que é uma FOTOGRAFIA inteira,
que é o pior caso do PNG. As duas coisas convivem porque a pergunta é
respondida por página, e não há sinal mais honesto de "isto é uma fotografia?"
que o tamanho que ela ocupa SEM PERDA: as páginas chapadas do mesmo arquivo
ficaram entre 44 kB e 208 kB, as fotográficas passaram de 3 MB — a separação é
um abismo, não um ajuste fino. O WebP só é encodado quando o PNG já respondeu
que sim, e só vence se for MENOR (um navegador sem WebP devolve o próprio PNG
deste `toBlob`, e a comparação de tamanho absorve isso sem guarda nenhuma).
**`SlideDeck.kt` usa o mesmo número pelo mesmo motivo**: as duas metades do
mesmo recurso produzem `kind: 'deck'` para o mesmo palco, e uma apresentação que
ocupa dez vezes mais conforme a porta de entrada é uma divergência que ninguém
explica olhando a tela.

**O palco é uma caixa de tamanho ZERO, e os slides saem UM A UM.** Ele era um
`position:fixed` de 1920 px por **29.700 px** (as 27 páginas de uma vez) a
99.999 px para a esquerda — duas coisas erradas juntas: o pico de memória de uma
apresentação inteira num processo que hospeda os dois WebViews e a
`Presentation`, e uma região de layout gigante criada e destruída embaixo de um
app cuja altura é `calc(100svh - var(--kb))`. O relato do operador é a segunda
(*"a tela piscou e ocultou o cronograma, subindo os controles para o topo da
tela, e depois retornou o cronograma"* — `main` é `flex: 1` e só encolhe se o
`<body>` encolher). Hoje o palco é `position:fixed` **0×0 com
`overflow:hidden`** e o que é grande mora dentro dele: uma caixa desse tamanho
não acrescenta um pixel de transbordo ao documento. Continua não sendo
`display:none` pelo motivo de sempre — sem layout não há o que rasterizar —, e
o oráculo mede as duas metades (nada muda no documento, e o conteúdo do palco
tem largura de verdade).

**A escala sai da APRESENTAÇÃO, não da caixa medida** (`visor.slideWidth`): o
`.pptx` declara o tamanho do slide e ele não é sempre 16:9 — um material 4:3
medido pela caixa sairia esticado. E o laço **espera o `ready` de cada página**
em vez de dois quadros de `requestAnimationFrame`: o renderizador tem tarefas
assíncronas (metarquivos EMF, gráficos, mídia que só sai do zip depois), e um
relógio não sabe quando elas terminam.

**O teto de páginas é o mesmo do lado nativo** (`MAX_PAGINAS`, 300) e o corte é
DITO pela mesma porta (`falharNoItem`, a nota na linha do item): uma
apresentação cortada em silêncio leria como "o arquivo era assim", e o operador
só descobriria na frente da congregação, na página que não existe.

**As portas de entrada são as mesmas de qualquer arquivo:**

- **"Importar arquivos"**, no rodapé fixo do Cronograma. No app (shell ≥ 21) esse botão
  abre o seletor do SISTEMA (`AVNative.pickDoc`, com a lista de mimes), e não o
  `<input type="file">`: aquele devolve um `File` — bytes já lidos —, e quem
  desenha o PDF é o shell, que precisa do ARQUIVO; devolver os bytes pela ponte
  inverteria o princípio dela ("URLs servíveis, nunca bytes") e faria um vídeo
  de 2 GB passar pela memória do WebView. O seletor do sistema entrega
  `content://` para TUDO — a mesma porta por onde as pastas do dispositivo já
  entram —, então a importação inteira passou a ser uma coisa só. No navegador
  continua o `<input type="file">` de sempre, com o `.pptx`
  no `accept`; ali o PDF é o único que não tem como funcionar.
- **Compartilhar** um PDF, um `.pptx` ou o link do Google com o app.
- **Um arquivo ilegível avisa** (PDF com senha, `.pptx` corrompido): diálogo, e
  não um aviso que some sozinho — o operador acabou de escolher um arquivo, e
  silêncio ali leria como "importou". É o uso do diálogo em modo AVISO
  (`cancelText: null` esconde o botão de cancelar: ele não pergunta nada), e o
  texto é um só (`avisarNaoAbriu`) para as duas portas de entrada.
- **E o aviso diz POR QUE** (v5.100), num parêntese no fim: `deckUltimoErro`
  carrega o motivo do ponto que falhou até o diálogo — inclusive o do lado
  Kotlin, já que `deckPages` passou a devolver `{ erro }` em vez de `null`.
  Sem isso, todo defeito deste caminho chegava como a mesma frase, e a primeira
  causa real (o ramo de `https` que engolia o `/saf/`, ver o CLAUDE.md)
  sobreviveu a duas versões parecendo "PDF com senha". Este código roda no
  aparelho do operador, num domingo de manhã, e quem desenvolve não tem o
  aparelho na mão: o diagnóstico precisa caber na tela.

**O registro** é `kind: 'deck'` com `pages: [Blob]` — as páginas ficam DENTRO
do próprio registro de mídia, não em arquivos soltos no OPFS, para que o gc que
já existe as leve junto quando o item sai da última lista. Páginas no OPFS
pediriam uma faxina paralela, que é o tipo de bookkeeping duplicado que vaza
espaço em silêncio. O IndexedDB guarda Blob por referência: ler o registro não
traz os bytes de dezenas de páginas para a memória.

**O nome e o eixo dos botões descrevem a MESMA cena** — e por isso andam
juntos (v5.101). Tudo o que muda a resposta de `slideTarget()` precisa chamar
`renderSlideNav()`, não só `renderNowPlaying()`. O nome tem muito mais caminhos
de atualização que o eixo, então a divergência aparece sempre igual: cabeçalho
certo, botões errados. Foi o defeito da v5.100 — projetar o **cronômetro** ou o
**sorteio** sobre uma apresentação derruba o alvo para `null`, e ao tirá-los o
nome voltava a dizer "1/9" com ⏮/⏭ apagados. Numa mídia com tempo o pulso de
`timeupdate` repunha os limites sozinho e o defeito passava despercebido; **um
deck é imagem parada**, então nada mais rodava e ele ficava permanente. Só uma
importação consertava, por acidente: ela termina em `load()`, que chama
`renderSlideNav()`.

**A navegação é o par de botões de slide que já passa estrofe**
(`slideTarget()` devolve `'deck'`): cada toque passa uma página, e os botões
desabilitam nos extremos como em qualquer outro alvo de slide. Na tela cheia e
na notificação, onde não há botão de slide, quem faz isso é o ⏮/⏭ no toque
curto — os dois acionam os mesmos `#slidePrevBtn`/`#slideNextBtn`. O comando é um `page` próprio, e não um
`load` novo — recarregar a mídia para trocar uma imagem que já está na mão
faria o telão piscar preto a cada slide. A `MediaSession` acompanha: o rótulo
dos botões diz "(página)" em vez de "(estrofe)" quando é uma apresentação que
está no ar (`slideLabel`).

> **O `slideLabel` só chegou de fato à notificação na v5.102.** Ele nasceu na
> v5.97 no `pushNowPlaying` e o `SessionService` já o lia desde então — mas
> `shared/native.js` monta o objeto da ponte **campo a campo**, e este ficou de
> fora: a notificação escreveu "(estrofe)" durante toda a rodada das
> apresentações, sem erro em lugar nenhum. É a forma de falhar típica dessa
> função — um campo esquecido ali some em silêncio, e o lado nativo lê o
> `optString` vazio como "use o padrão". Ao acrescentar um campo em
> `pushNowPlaying`, acrescente-o também em `AVNative.nowPlaying`.
>
> Na mesma versão a palavra passou a sair da tabela `SLIDE_AXIS_NAME` — a
> mesma que nomeia os botões da tela —, em vez de um ternário local que
> respondia "estrofe" para versículo e para mensagem.

**A reconexão do telão volta na página certa**, pelo mesmo motivo do tempo de
uma mídia: um dongle que cai no meio da pregação não pode devolver o primeiro
slide na frente de todo mundo — o `load` do reenvio leva o `page`.
