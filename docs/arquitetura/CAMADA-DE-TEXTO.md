<!-- Capítulo de docs/ARQUITETURA-WEB.md. O índice e as regras
     de desenvolvimento ficam lá; este arquivo é só este capítulo. -->

## Camada de Texto (Bíblia · Mensagens · Letra · Imagem)

O sistema serve **conteúdo de tela no telão** por sete provedores que
compartilham um **modelo padronizado** de camada paralela (mesmo padrão do
YouTube: um layer que a **cortina do wallpaper** — sempre por cima de tudo —
cobre/revela "de graça", sem tocar em `stage.js`). São eles:

| Provedor | Driver | Origem do texto | Camada física |
|---|---|---|---|
| **Bíblia** | manual (operador avança versículo) | banco LouvorJA | `#text` / `#pvText` |
| **Mensagens** | manual (operador avança mensagem) | `state.messages` (texto puro) | `#text` / `#pvText` |
| **Letra avulsa** | manual (operador avança estrofe) | acervo de letras (`songLyricStanzas`) | `#text` / `#pvText` |
| **Cronômetro/relógio/timer** | **derivado do relógio** (sem avanço) | o próprio tempo (`chronoReading`) | `#text` / `#pvText` |
| **Sorteio** | **derivado** (rolo até assentar) | faixa numérica ou lista de opções (`drawReading`) | `#text` / `#pvText` |
| **Letra sincronizada** | **temporizado** (segue o `currentTime` do áudio) | música do LouvorJA | `#lyrics` / `#pvLyrics` |
| **Mídia visual sobre o áudio** | manual (o toque na imagem ou na apresentação) | um registro `kind:'image'` — ou `kind:'deck'`, e aí o cartão pinta `pages[page]` | `#text` / `#pvText` (modo `mode-img`) |

> **Mensagens vive na aba Ferramentas** (v5.31), como uma das ferramentas do
> seletor: lista de avisos salvos, "+ Nova mensagem" e — quando há uma
> projetada — "Tirar do telão" (`hideMessage` → `text-hide`, que encerra só a
> Camada de Texto; um áudio de fundo segue tocando). Tocar numa mensagem
> projeta e a linha fica marcada, então passar de um aviso a outro não exige
> reabrir nada — que era o atrito do bottom-sheet anterior. Com a mensagem fora
> do ar mas a sessão viva, os botões de slide só MOVEM a seleção (mesma regra
> da Bíblia).

### Letra avulsa (projetar a letra SEM tocar a música)

`lyricSession = { title, stanzas: [string], idx, projecting }`, aberta pela
folha rápida de uma música do acervo ("**Apenas a letra**" — ver
`hymnResultRow`). Serve o caso em que a congregação canta **ao vivo**
(instrumentistas na frente, ou hino sem gravação no aparelho): o telão precisa
da letra, e não pode ter um áudio tocando por cima nem trocar de estrofe sozinho
no tempo de uma gravação.

- **Não é uma terceira variante de `playSongVariant`.** Uma variante toca um
  arquivo, e aqui não há arquivo nenhum: a letra vem de `songLyricStanzas`, que
  lê o acervo de letras e funciona para músicas **nunca baixadas**.
- **Sem letra no aparelho, o caminho é o MESMO das outras duas opções da folha**
  (v5.64): baixar a música — que traz a letra junto — e tentar de novo, com o
  indicador na preview dizendo "Baixando a letra". Na v5.63 isto era um beco sem
  saída: "Letra ainda não baixada." e nada acontecia, num item que o operador
  acabara de escolher. Se ainda assim não vier letra, aí sim o aviso
  ("Letra indisponível para esta música").
- **Uma estrofe = um slide**, e o comando é `text` com `mode: 'message'` — o
  telão já sabe desenhar um bloco de texto centrado, que é exatamente o que uma
  estrofe é. Um modo novo no protocolo exigiria shell e bundle novos dos dois
  lados sem mudar um pixel do resultado.
- **A passagem é do operador**, pelos mesmos botões de slide que já passam
  mensagem e versículo: `slideTarget()` devolve `'songlyrics'` (à frente de `'message'` e
  `'bible'`), `stepSlide` cai em `lyricStep` e `applySlideLimits` desabilita nos
  extremos. É a **ausência** de passagem automática que o operador está pedindo
  ao escolher esta opção.
- **É texto manual como os outros:** `clearManualText()` a encerra junto com as
  demais, projetar Bíblia/Mensagem/cronômetro/sorteio a substitui, um `load` de
  áudio a mantém e um `load` visual a encerra. `resendSceneToDisplay` a reenvia
  na reconexão do telão, e `pushNowPlaying` conta ela como **cena** (o serviço de
  mídia sobe, e o processo com a `Presentation` deixa de ser descartável).
- O now-playing mostra `<nome da música> · <n>/<total>`: sem o número, duas
  estrofes seguidas dariam o mesmo cabeçalho e o operador perderia a única
  referência de onde está.

**Bíblia e Mensagens são literalmente o MESMO cartão** (`#text` no Display,
`#pvText` na preview) — mesmo comando `text`/`text-hide`, só o campo `mode`
distingue (`'verse'` mostra a referência dourada abaixo do texto; `'message'`
usa fonte maior/mais linhas e sem referência). A **Letra** é o **provedor
temporizado** da mesma família — fica no seu layer dedicado `#lyrics` porque
carrega recursos que o cartão de texto puro não representa (imagem de fundo por
estrofe, slide de capa, texto auxiliar); mesclá-la ao `#text` arriscaria a
sincronização de tempo (o recurso principal), então ela permanece separada,
mas segue o mesmo modelo de cortina/fades.

**Independência do áudio** (o ponto-chave do modelo unificado): a Camada de
Texto é **desacoplada do ciclo de vida da mídia do stage** — `showText`/
`showPvText` **não** chamam `stage.clear()`/`preview.clear()`. Assim é possível
**projetar um versículo (ou mensagem) enquanto um áudio toca em segundo plano**:

- Um comando `text`/`text-hide` nunca para a mídia do stage.
- Com a Camada de Texto ativa, o **transporte** (`play`/`pause`/`seek`/`volume`/
  `mute`) continua indo pro stage — controla o **áudio de fundo** (o texto não é
  afetado); o `view` liga/desliga a cortina por cima do texto.
- Um `load` de **áudio** troca o som de fundo **mantendo** o texto; um `load` de
  **visual** (imagem/vídeo/YouTube), `stop` ou `clear` **encerram** o texto e
  seguem o fluxo normal (o Display checa o `kind` do registro em `load` pra
  decidir; o Controle usa `keepText = pvTextActive && currentItem.kind ==='audio'`).
- A **letra sincronizada não coexiste** com a Camada de Texto manual:
  `showLyrics`/`showPvLyrics` retornam cedo se um texto manual estiver em cena
  (a letra pertence a UMA música tocando; um versículo/mensagem manual tem
  precedência sobre a letra do áudio de fundo).
- **Sair do texto sem nada em cena volta ao WALLPAPER, não ao preto**
  (`restoreSceneAfterText`/`restorePvSceneAfterText`). `showText` abre a
  cortina para o cartão aparecer; se não há mídia carregada — ou a que havia já
  terminou (item só na playlist, ou tocado antes) — ninguém a fechava de volta,
  e o telão ficava preto. Agora, quando não há YouTube tocando e
  `!getCurrent() || hasEnded()`, a cortina sobe (`coverIn(false)`). No Controle
  a fonte disso é o **stage** (`preview.getCurrent()`), não `currentItem`: este
  último é o item SELECIONADO e continua apontando para a música terminada — era
  exatamente ele que fazia a preview achar que ainda havia algo em cena.

### Mídia visual SOBRE o áudio — imagem (v5.312) e apresentação (v1.4.28)

Um aviso, um versículo diagramado, o cartaz da campanha — conteúdo **só
visual** — precisa entrar na tela **sem calar o louvor de fundo**, que é
exatamente o que o versículo já fazia. Até a v5.311 não fazia: tocar numa
imagem com um áudio no ar trocava a cena e o som parava.

**A causa é o slot único do motor.** `stage.js` → `loadInner` faz, sem
condição, `video.pause()` → `removeAttribute('src')` → `video.load()`. Logo,
**todo caminho que emita um `load` mata o que estava tocando** — e não há
"segundo slot" a acrescentar sem mexer no código que roda na frente da
congregação.

**O que sobrevive ao slot único é a Camada de Texto**, e por uma propriedade
que ela já tinha: ela é um cartão opaco ACIMA da mídia (`.text-layer`,
z-index 2) e **não emite `load` nenhum**. Daí a decisão: a imagem é um **MODO**
dela (`{ type:'text', mode:'image', mediaId }`), não um slot novo. O motor não
muda uma linha, e o recurso ganha de graça o `text-hide`, o reenvio de cena, a
cortina e o rodízio de provedor.

**E A APRESENTAÇÃO ENTROU NESTA MESMA CAMADA** (v1.4.28), a pedido do operador:
*"adicione a possibilidade de música atrás dos slides. Atualmente são
concorrentes, mas os slides devem ser tratados como camada, assim como as
imagens ou os textos e mensagens"*. Uma página de deck é **uma imagem opaca
ocupando a tela** — exatamente o que este cartão já pinta —, e o que muda entre
as duas é só QUAL blob do registro sai: `rec.blob` na imagem, `rec.pages[page]`
na apresentação. Por isso o comando continua sendo `mode: 'image'` com um campo
`page` a mais: o telão ganha uma escolha de blob e **nenhum ramo novo**, nenhuma
classe nova, nenhum caminho novo de reenvio nem de `text-hide`. É o mesmo
argumento que tornou a v5.312 segura, aplicado de novo.

| Onde | O quê |
|---|---|
| `send(id, daFila)` | **a decisão**: `!daFila && (alvo.kind === 'image' || isDeck(alvo)) && audioNoAr()` → `projetarVisualSobre`, senão o caminho de sempre |
| `projetarVisualSobre` / `hideVisualSobre` | a sessão `visualSession = { id, nome, rec, projecting }` — a mesma forma das outras cinco, e é isso que a põe de graça no `cenaDeRoteiroNoAr`, no `soUmProvedorDeTexto` e no reenvio. **O nome é `visual` e não `img`** desde que a apresentação entrou: quem lesse um `imgSession` guardando um deck procuraria uma imagem que não está lá |
| `deckSobreProjetando()` / `deckNoAr()` | a única pergunta que separa os dois conteúdos do cartão (um deck tem PÁGINAS) e a resposta ÚNICA para "qual apresentação está no ar" — pela camada, ou como a própria mídia. Duas leituras espalhadas divergiriam no primeiro caminho novo |
| `deckIr(alvo)` | **dois caminhos, um ponto só**: como MÍDIA a página anda por `page` (o slot do motor); como CAMADA, reenviando o `text` com o número novo. Um `page` mandado para a camada não acha deck nenhum no motor e **não faz NADA** — sem erro, com o operador apertando o botão |
| `display.js` → `pintarTextImg` | resolve `cmd.__rec || AVDB.getMedia(mediaId)` → **a página, quando o registro tem `pages`** → blob/OPFS/url → `objectURL` em `#textImg`, com `textImgSeq` contra corrida e `soltarTextImg` revogando |
| `controle.js` → `pintarPvTextImg` | a metade PREVIEW da linha acima, e ela escolhe o blob **por conta própria**: sem a mesma escolha de página, a preview ficaria na página 1 para sempre enquanto o telão passa slides — e **sem TV a preview É a projeção**. A armadilha do `fundo-da-letra`: *ler cada lado isolado aprova os dois* |
| `telaEnriquecer` | anexa o `__rec` saneado (`/m/<token>`) — é o **único** comando de texto que precisa, porque é o único que leva um `mediaId`. Num deck ele empurra as **páginas** (`telaEmpurrarPaginasDeck`), não o item: um deck não tem arquivo único, e o `telaGarantirEnvio` dele morreria calado gastando um giro da fila |

**As decisões que precisam estar ditas:**

- **É `audioNoAr()`, não "está tocando".** Um louvor PAUSADO para a oração
  continua sendo a cena, e pôr o aviso por cima dele é o mesmo gesto. Mesma
  régua do reenvio (`midiaNoAr`).
- **O avanço automático da fila NÃO sobrepõe** (`daFila`): ali a imagem é o
  PRÓXIMO item da sequência. Sobrepor faria a fila parar de andar sozinha, com
  o áudio anterior tocando para sempre sob a imagem nova. **⏮/⏭ passam `daFila`
  pelo mesmo motivo** (`step`): o eixo deles é "trocar de MÍDIA". Sem isso o
  `currentId` ficava no áudio, o índice da fila não andava, e o botão "Próxima
  mídia" — aqui, na notificação e na tela de bloqueio — parava de andar.
- **O `rec` viaja DENTRO da sessão**, e é o que `await0Rec` consulta antes das
  listas: a mídia sobreposta quase sempre vem de `libItems`, que a troca de
  aba zera, e um reenvio de cena horas depois (uma tela da rede que deu F5)
  mandaria o comando sem `__rec` — cartão PRETO sobre a projeção.
- **Sem áudio no ar a imagem projeta NORMAL** (substitui). A sobreposição é a
  exceção; aplicada sempre, uma imagem sozinha entraria como cartão de texto
  sobre nada — sem barra, sem cortina, sem transporte.
- **A linha da lista responde pela IMAGEM** (`visualSobreNaLinha`, consultada
  por `noArAgora`, `linhaNoAr` e `linhaAtiva`). A sobreposição rompe a premissa
  daquelas três funções, que dividem o mundo em CUE e MÍDIA: a imagem
  sobreposta é um item de mídia projetando pela porta da Camada de Texto. Sem
  a guarda o segundo toque caía no `pararMidia` do ramo de mídia — o operador
  tocava na IMAGEM para tirá-la e o que saía era o ÁUDIO.
- **`slideTarget()` devolve `null`** com a imagem em cena, pelo mesmo motivo do
  cronômetro: os botões de slide cairiam na letra do áudio de fundo, que está
  ESCONDIDA atrás do cartão — o operador apertaria "próxima estrofe" e a música
  saltaria sem nada mudar na tela. **A APRESENTAÇÃO É A EXCEÇÃO, e vem antes
  dessa guarda**: o argumento dela é *"este cartão não tem para onde ir"*, e um
  deck TEM — cada toque passa uma página, com o louvor andando por baixo.
- **O título continua sendo o do ÁUDIO** (é o que o ▶ e a barra controlam); o
  que a imagem acrescenta é o subtítulo `'Imagem em cena'` no `pushNowPlaying`,
  e a apresentação, `'Apresentação · 3/27'` — sem o número, duas páginas
  seguidas dariam o mesmo cabeçalho.
- **O auxiliar de leitura passa a oferecer as DUAS camadas** (v1.4.26 + v1.4.28):
  Páginas por cima, a Letra do louvor de fundo por baixo, a Cifra por último. É
  a pilha do `lyricsViewSources` — ver o capítulo do Controle. Ali a fonte
  `deck` sai de `lvDeckRec()`, e não de `lvItem()`: sobreposta, quem está em
  `currentItem` é a MÚSICA, e perguntar páginas a ela devolveria nada.
- **Trocar de modo apaga a `<img>`** (`display.js`: `if (textMode !== 'image')
  soltarTextImg()`). O `mode-img` esconde `.text-content`, então uma `<img>`
  esquecida de pé cobriria o texto novo — cartão mudo, sem erro.

- **A APRESENTAÇÃO SOBREPOSTA ENTRA SEMPRE PELA PRIMEIRA PÁGINA**, e a linha
  mora no `projetarVisualSobre`: o caminho da camada volta antes do
  `deckPagina = 0` do `send`, e sem ela sobrepor um deck ao louvor abriria na
  página em que o deck ANTERIOR parou — um slide aleatório no telão.
- **O reenvio de cena leva a PÁGINA**, pelo mesmo motivo do tempo da mídia: um
  telão que reconecta no meio da pregação não pode voltar ao primeiro slide na
  frente de todo mundo.
- **O GESTO É ASSIMÉTRICO, e de propósito.** A música vem PRIMEIRO e o toque na
  apresentação a cobre; o contrário (deck no ar, toque numa música) SUBSTITUI,
  como sempre substituiu. É a regra que a imagem já tinha, e inventar uma
  segunda para a mesma pergunta é o que este projeto recusa em toda parte.
- **E NADA DISSO ACONTECE NO MODO FÁCIL** (v1.4.32). Pedido do operador:
  *"coloque a limitação de apenas um elemento ativo na mídia, assim no modo
  simples não há sobreposição e nem necessidade de multicontroles"*. A
  sobreposição é uma **cena composta**, e operá-la exige saber qual das duas
  coisas cada controle governa — o ▶ é do áudio de baixo, o ⏭ é da apresentação
  de cima, o Parar tira uma só. Esse é o vocabulário do modo AVANÇADO, e é
  exatamente o que o Modo Fácil existe para não pedir de quem opera: ali o toque
  tem UM significado, *isto vai para o telão*, e o que estava vai embora.

  A guarda é `appMode !== 'simple'` **dentro do `send`**, e as duas metades
  importam: no `send` porque é o ponto por onde TODOS os caminhos passam
  (inclusive o compartilhamento, que naquele modo projeta na hora sem perguntar
  nada — é por ali que uma apresentação de fato entra); e por `appMode` porque a
  pergunta é sobre o vocabulário do modo, não sobre o estado da conexão — ela
  continua valendo com o Modo Fácil destravado por "Tocar neste celular", que é
  quando ele mais se parece com o avançado.

  **A limitação é sobre CRIAR.** Uma cena composta montada no avançado sobrevive
  à troca de modo, e isso está dito porque é o único caso em que o Modo Fácil
  tem duas camadas no ar: colapsá-la na troca mudaria a projeção como efeito
  colateral de um toque em Configurações — ou devolvendo o slide à página 1, ou
  calando a música, os dois na frente da congregação. Ela dura até o próximo
  `send`, e enquanto dura é operável (a zona mostra as páginas e as teclas
  funcionam — ver `modo-facil-slides.test.mjs`).

  Oráculo: `tools/modo-facil-um-elemento.test.mjs`, cuja metade que fecha o lote
  é a REVERSÃO — o avançado continua sobrepondo.

**Oráculos: `tools/imagem-sobre-audio.test.mjs` e `tools/slides-sobre-audio.test.mjs`.**
A regra é uma AUSÊNCIA (nenhum `load` sai deste caminho), e ausência não tem
sintoma de tela nem erro de console. Os dois medem o `currentTime` do `<video>`
em DOIS instantes — "não pausou" é fraco, "andou" é o que prova que o áudio é o
mesmo — nas duas metades: o Controle que decide sobrepor e o telão que pinta. O
segundo acrescenta o que só um deck tem: o eixo do ⏮/⏭ que volta, a página
andando por um caminho diferente, e as TRÊS metades que pintam — a prova de
qual página está na tela é a **COR do pixel**, porque com páginas idênticas
"pintou a 4" e "continuou na 1" são o mesmo resultado.

### O Parar fala de UMA camada só (v1.2.0)

Pedido do operador: *"considerando que o preview tem um botão apenas para
remover as camadas superiores, ajuste o botão de stop para em caso onde há mídia
de fundo e mensagens ou sobreposição de elementos na tela como bíblia e etc… o
botão de stop funciona apenas para a mídia de fundo"*.

O telão empilha DUAS coisas ao mesmo tempo, e cada uma já tinha a própria porta:
o selo `#pvCamadaBtn` sobre a preview (`encerrarCamadaDeCima`) para a de cima, e
`pararMidia('media-clear')` para a de baixo — a mesma divisão que o `retirarDoAr`
da linha faz desde a v5.178. **O `stopClear` era o único controle que não
escolhia nenhuma:** ele mandava `clear` e derrubava as duas de uma vez, e um
louvor de fundo sob um versículo não podia sair sem levar o versículo junto.

| Cena no ar | O que o Parar faz |
|---|---|
| mídia **e** Camada de Texto | `media-clear` — sai só a mídia, o cartão fica |
| só a mídia | `clear` — a cena inteira, como sempre |
| só a Camada de Texto | `clear` — ela é a cena, e o Parar é a saída dela no transporte |

- **A pergunta é `midiaNoAr`, nunca `currentId`.** Este último sobrevive ao
  Parar de propósito (é ele que deixa o ▶ repetir a faixa), então perguntar por
  ele faria o SEGUNDO Parar seguido — o que encerra o versículo — virar no-op
  para sempre. É a mesma régua do reenvio de cena.
- **`clearManualText()` não pode entrar no ramo novo.** Ele é a escrituração que
  zera as SEIS sessões, e sem elas o operador perderia a navegação do versículo
  que continua projetado.
- **A terceira linha da tabela é o que impede a correção de virar regressão.**
  Um Parar que sempre poupasse o texto deixaria a Camada de Texto presa no telão
  sem saída no transporte — o defeito trocado de lado, e igualmente mudo.

**Oráculo: `tools/parar-por-camada.test.mjs`**, e ele mede as três cenas: a regra
é condicional, e uma condicional errada não emite erro em lugar nenhum nos dois
sentidos. A prova da primeira é o `currentTime` do `<video>` em dois instantes
mais o TIPO do comando que saiu ao telão — `clear` e `media-clear` apagam o mesmo
vídeo da preview, e sem essa segunda leitura as duas cenas se leriam igual.

### Botão voltar do aparelho (`__avBack`)

O shell entrega o botão voltar do Android a `window.__avBack()`; devolver `true`
significa "consumi o toque", `false` faz a Activity minimizar (a projeção segue
viva — sair do app por engano num culto derrubaria o telão). A escada completa,
o prazo de resposta e o porquê de a decisão ser do lado web estão em
[`CLAUDE.md`](../CLAUDE.md), seção "Botão voltar: fecha antes de minimizar".

Do lado web importam duas coisas:

- **A tabela `POPUPS` é a fonte única.** Ela já registrava o ✕ e o toque no
  fundo; agora registra também o voltar. Um popup novo entra numa linha e passa
  a ser fechável pelos três caminhos — duas listas divergiriam no primeiro que
  alguém esquecesse de acrescentar na segunda.
- **A hierarquia não é reimplementada.** O degrau de sub-tela chama
  `navigateBack()`, a mesma função do `#backBtn`, que já sabe que a Bíblia sobe
  leitura→capítulos→livros e que a raiz dos Favoritos volta ao Cronograma.

`__avBack` **não** usa `history`: no navegador não há botão voltar do sistema, e
a função simplesmente nunca é chamada lá. A base continua rodando nos dois
contextos sem guarda nenhuma.

### Acervo de LETRAS (baixado no arranque, v5.36)

A letra deixou de depender do áudio: é baixada junto com o índice, como
informação padrão do acervo. Antes, só quem tinha a música no aparelho podia
buscá-la — e quem procura "aquele hino que fala em…" quase nunca tem os 600
baixados.

**Dois acervos, de propósito.** `files[].lyrics` são **slides** (tempo, imagem,
capa) e só existem com áudio baixado — é o que a projeção sincronizada consome.
`state.lyrics:<collId>` é só **texto**, por música, e existe para toda música do
índice — é o que a busca consome. Fundi-los faria a busca carregar tempos e
caminhos de imagem à toa, e faria o download do índice arrastar o peso dos
slides. O índice de busca (`buildLyricIndex`) lê os **dois**, chaveado por
`collId:id_music`, com o acervo de texto tendo precedência.

- **Caminho de graça primeiro.** Se a API mandar `lyric` já no índice do acervo
  (o app-ja busca por esse campo — §5.3 de `FONTE-DE-DADOS-LOUVORJA.md`),
  `fetchCollectionIndex` colhe dali e a música nem entra na fila. Verificado
  contra uma API simulada: com o campo presente, **zero** requisições
  `music_{id}`.
- **Todo o acervo indexado** (v5.38): hinários **e** álbuns, a mesma cobertura
  do índice de músicas. A busca por trecho não teria por que conhecer metade do
  acervo — "aquele hino que fala em…" e "aquela música do álbum que fala em…"
  são a mesma pergunta, e o operador não sabe (nem deveria precisar saber) de
  qual coleção veio o que procura.
- **Hinários primeiro na fila.** São o que mais se busca, e a fila pode levar
  alguns minutos na primeira abertura: se ela for interrompida (app fechado,
  rede caiu), o que já desceu é o que mais importa. Verificado: os 20 primeiros
  pedidos são todos do hinário, com os álbuns já indexados na fila.
- **Agrupado por `id_music`, não por (coleção, música).** A MESMA faixa aparece
  em várias coletâneas, e `music_{id}` é o mesmo documento para todas — uma
  busca por par custaria três requisições para uma faixa em três álbuns. Aqui
  custa uma, e o resultado é distribuído para todas as coleções que a contêm. É
  o que torna varrer o acervo inteiro viável. Medido: 3 álbuns de 10 faixas com
  uma compartilhada + 20 hinos = **48 requisições**, não 50, e nenhuma música
  pedida duas vezes.
- **Adia só em rede móvel CONHECIDA** (`networkType() === 'cellular'`), e a
  assimetria com `syncCollection` é deliberada: lá descem centenas de MB de
  áudio e perguntar é o certo; aqui é JSON de texto, poucos MB no hinário
  inteiro — menos que UMA música que o app baixa com um toque sem perguntar.
  Usar `isConfirmedWifi()` seria pior que inútil: `navigator.connection.type`
  não existe em boa parte dos aparelhos e devolve `'unknown'`, então exigir
  Wi-Fi confirmado faria o recurso **nunca rodar** na maioria deles.
- **Incremental e resumível.** Só busca o que falta; reabrir o app não refaz
  nada. Verificado: 40 requisições na primeira abertura, **0** na segunda, e
  exatamente **2** depois de apagar duas do acervo.
- **`0` marca "não tem letra"**, e é diferente de ausência: sem essa marca,
  toda abertura tentaria de novo as mesmas centenas. Mas **falha de rede não
  marca** — senão um wi-fi que oscilou tiraria o hino da busca para sempre.
- **Gravação em LOTES** (`LYRIC_BATCH`, 25): são centenas de músicas, e
  reescrever o blob inteiro a cada uma tornaria o download quadrático.
- **A lista de sujas é tirada ANTES de gravar, não depois** (v5.41). Os 6
  workers correm juntos: durante o `await` da gravação os outros continuam
  marcando coleções, e o `clear()` que rodava *depois* apagava essas marcas.
  A letra ficava só na memória — e se aquela coleção já tivesse terminado,
  nunca mais era marcada e a gravação final a ignorava. Medido na API
  simulada: **48 de 48 músicas buscadas, 45 de 50 pares no disco**, com um
  álbum inteiro pela metade, em ~1 de cada 6 aberturas. Com hinário só o
  defeito quase não aparecia (uma coleção, sempre com item seguinte para
  remarcá-la); varrer o acervo inteiro (v5.38) — muitas coleções pequenas
  acabando no meio dos flushes — foi o que o trouxe à tona.
- **Indexa TODA linha**, inclusive `aux_lyric` e estrofes sem `show_slide` — ao
  contrário de `buildLyricSlides`, que filtra o que vira slide. Uma estrofe que
  não é projetada continua sendo letra da música, e para buscar isso só ajuda.
- **Guardado por ESTROFE desde a v5.43** — `[{ a: rótulo|null, l: [linhas] }]`.
  O banco já entrega assim: cada entrada de `music_{id}.lyric` **é** uma
  estrofe, com `order` e `aux_lyric` (o rótulo: "Refrão", "1ª Estrofe"). Até a
  v5.42 guardávamos só as linhas achatadas — o formato de que a BUSCA precisa —,
  e a visualização da letra completa herdava esse achatamento: trinta linhas
  seguidas, sem respiro e sem dizer onde entra o refrão, que é exatamente o que
  o operador procura quando abre a letra. Guardar por estrofe não custa nada à
  busca (`lyricFlatLines` achata na hora de indexar, e o rótulo entra junto —
  "refrão" é palavra que se digita); o caminho inverso, inferir estrofes de
  linhas soltas, **não existe**. Por isso a mudança é no armazenamento, e não
  só na tela.
  - `lyricStanzas` normaliza os dois formatos: um registro legado vira UMA
    estrofe sem rótulo — que é exatamente o que ele já era na tela.
  - O legado entra na mesma fila do que nunca foi baixado (`songsMissingLyric`):
    uma passagem única, em segundo plano e só em wi-fi, como a primeira carga.
    `LYRIC_NONE` (0) **não** entra — já sabemos que a música não tem letra, e o
    formato não muda isso.
  - Quem já tem a música BAIXADA nem espera a fila: os slides do arquivo
    (`stanzasFromSlides`) sempre tiveram a divisão, com `auxText` por slide — ela
    só era descartada. Por isso `songLyricStanzas` prefere os slides quando o
    acervo de texto ainda está no formato antigo.
- Roda como fase 3 do `autoRefreshCollections`, fire-and-forget, com o progresso na
  notificação pelo mesmo `withBgWork` do resto do trabalho de massa.

### O acervo É o estado padrão da busca (v5.43)

Com o campo vazio, a busca listava as primeiras 60 músicas de um acervo de
milhares: uma fatia sem critério, que não responde pergunta nenhuma. Quem abre a
lupa **sem saber o nome** quer folhear — e folhear é por coleção, que é o
recorte que o próprio banco dá e que a aba Álbuns desenhava (ela saiu na
v5.44 — ver abaixo).

Então a abertura da busca passou a ser esse navegador: os mesmos cabeçalhos de
categoria e os mesmos cards. **É a mesma função** — `renderCollectionsList(alvo, redesenhar)` ganhou o elemento-alvo e o
callback de redesenho como parâmetros. Duas cópias divergiriam no primeiro
ajuste de categoria, e o operador veria dois acervos diferentes conforme por
onde entrou.

A busca ganha assim **dois níveis**, e isso muda três coisas:

- **Digitar troca o nível.** `searchIsBrowsing(q)` é `!q`: com
  texto, volta a listar músicas exatamente como antes; apagando, o acervo
  retorna. Nenhuma outra regra da busca mudou.
- **Tocar num card abre a coleção NO PRÓPRIO CARD** (acordeão), com o acervo
  inteiro ainda visível em volta. Até a v5.44 era uma segunda tela, com um
  voltar no cabeçalho e um degrau próprio em `__avBack`; entrar e sair para ver
  o que tem dentro de um álbum é caro quando a pergunta é "em qual deles está
  aquela música?". Uma coleção aberta por vez — duas listas de centenas de
  faixas empurrariam o acervo para fora da tela.
  - A lista sai **inteira**, sem teto: quem abriu um álbum quer percorrê-lo.
    O teto de 60 é da BUSCA, que varre milhares de músicas a cada tecla.
  - As linhas são as mesmas `hymnResultRow` da busca, **sem o subtítulo da
    coleção** (`semColecao`) — repetir "Album 1" nas dez faixas é ruído; o card
    em volta já diz de quem elas são.
  - **A engrenagem desceu para dentro do aberto** (`.coll-open-cfg`), larga e
    rotulada. Manutenção — sincronizar, excluir, peso — é o que se procura
    depois de já estar olhando o álbum, não antes; na barra ela era um ícone
    mudo disputando o toque com a própria linha, que agora abre a coleção.
    *(Superado na v5.72: ela voltou para a barra, mas no lugar do botão de
    baixar — que aberto não tem o que decidir. Ver "A engrenagem volta para a
    barra".)*
  - **A barra da coleção aberta GRUDA no topo** (`position: sticky`). Sem isso,
    percorrer as 600 faixas de um hinário empurrava a própria barra — e a seta
    que fecha — para fora da tela: a única seta à vista passava a ser a de
    OUTRO card, e tocá-la abria aquele em vez de fechar este. Do lado de quem
    opera, "toquei na seta e não fechou". Grudada, a seta da coleção em que se
    está fica sempre ao alcance, e o nome dela também.
  - **Baixar/cancelar voltou para a barra** (`.coll-bar-dl`). Com a engrenagem
    dentro do aberto, baixar um hinário passava por expandir 600 linhas —
    caro para a ação mais comum do acervo.
- **O campo pega o foco na abertura, NOS DOIS MODOS** (v5.131). No simplificado
  isso vale desde a v5.90: lá o acervo é aberto por um botão que se chama
  BUSCAR, o modo inteiro existe para encurtar caminho, e quem entra por ali sabe
  o que quer.

  No avançado a regra era o contrário, com um argumento razoável — a abertura é
  um acervo para folhear, e o teclado cobre metade dele. O que a operação
  mostrou é que quem abre a Biblioteca está atrás de UMA música: o preço da
  regra antiga era um toque a mais toda vez, no meio do culto, para alcançar um
  campo que já estava na tela. Folhear continua a um gesto de distância —
  fechar o teclado é o gesto mais conhecido do Android.

  O `focus()` é SÍNCRONO, dentro do gesto do toque: adiado (um `setTimeout`) ele
  sai da interação, e aí o WebView aceita o foco mas **não abre o teclado** — o
  pior resultado possível, porque na leitura do código parece que funcionou.

#### Tela cheia, e a ação de maior alcance no título (v5.45)

- **O popup ocupa a tela toda** (`.popup-sheet--full`, sem cantos
  arredondados). É a tela em que o operador passa mais tempo antes do culto —
  folhear álbuns, abrir letras, decidir o que baixar — e a folha de 80vh
  deixava uma faixa morta no topo enquanto a lista rolava apertada embaixo.
  Cantos retos porque cantos arredondados anunciam "há algo atrás", e aqui não
  há.
- **"Baixar todo o acervo" subiu para o cabeçalho** (`renderAcervoTotal`,
  mesmo `syncGroup` e mesma chave `grp:Todo o acervo`). Dentro da lista ela
  saía de vista ao primeiro rolar — justamente quando o operador está
  decidindo entre baixar tudo e escolher um álbum. `renderCollectionsList`
  ganhou `opts.semTotal` para não desenhá-la duas vezes.
  - **O chip de status do lote é ESTREITO, e as frases têm de caber nele**
    (v5.75). O cabeçalho é uma linha flex de cinco itens (ícone, título,
    status, baixar, ✕) em 390px: sobram ~180px para o texto. `.popup-total`
    tinha `flex-shrink: 0`, então uma frase comprida não encolhia — empurrava
    o **✕ para fora do sheet** e o acervo ficava sem saída. Duas correções, e
    as duas são necessárias:
    - **Estrutural:** `.popup-close` ganhou `flex-shrink: 0` (o ✕ é intocável),
      `.popup-total` passou a `flex: 0 1 auto; min-width: 0` (é ele quem cede,
      e o `.coll-group-count` dentro dele já corta em reticências) e um
      `max-width: 58%` para o TÍTULO não ser a próxima vítima.
    - **Textual:** as frases de `syncGroup` foram encurtadas até caberem sem
      reticências — "Álbum 3/12" (era `… · <nome do álbum>`, largura
      imprevisível e a causa direta do estouro), "OPFS indisponível",
      "Já completo", "3 álbuns sem rede", "Erro no download", "Completo",
      "Aguardando Wi-Fi". O nome do álbum em download não se perdeu: ele está
      no card do próprio álbum e na notificação do sistema.
- **O contador de itens saiu.** Na abertura ele contava coleções e durante a
  busca, resultados: o mesmo número dizendo coisas diferentes, ao lado de um
  título que já explica a tela. O contador que importa é o `N/M` de baixados,
  que está em cada card e agora também no cabeçalho.
- **Os botões de baixar formam UMA coluna** (v5.47). O do cabeçalho de grupo
  não tem seta de acordeão depois dele, então caía ~40px à direita do botão do
  card logo abaixo. `.coll-group` reserva à direita exatamente o que o card
  gasta depois do seu botão — borda (1px), padding (`.7rem`), seta (20px) e o
  gap antes dela (`.55rem`) — e os dois botões passaram a ter o mesmo alvo de
  34px, porque alinhados na coluna eles também precisam do mesmo tamanho,
  senão os centros discordam. Medido: todos com centro em x=351.
- **Os hinários NÃO baixam em lote** (v5.46). São as duas maiores coleções do
  acervo (~1.100 músicas juntas): um botão só disparando as duas é um download
  que ninguém dimensiona antes de tocar, e que não dá para parar pela metade
  sem perder o outro. O cabeçalho "Hinários" mantém o contador (ele informa) e
  perde o botão (`opts.semBotao`); cada hinário baixa pelo botão do próprio
  card. As categorias de álbuns seguem com o download em lote — ali cada álbum
  tem uma dezena de faixas.
- **As opções da coleção abrem ACIMA do acervo** (v5.46). Os dois são
  `.popup-backdrop` com o mesmo `z-index`, então quem vencia era a ordem do
  documento — e o acervo, declarado depois, cobria as opções por inteiro: o
  toque na engrenagem parecia não fazer nada. `#collPopup` ganhou um degrau
  (`z-index: 210`) e foi para o FIM de `POPUPS`, que passou a ser ordenada de
  baixo para cima: o voltar percorre a tabela de trás para a frente, então
  fechar o acervo antes das opções as deixaria órfãs no ar.
  *(O popup em si saiu na v5.72 — as opções viraram um painel dentro do card —,
  mas a ordenação de `POPUPS` que ele motivou ficou, e é a que o `#songMenuPopup`
  e o `#folderPopup` usam hoje.)*

#### A LUPA É A ÚNICA PORTA DO ACERVO

Com o acervo desenhado dentro da busca, uma aba de Álbuns seria uma segunda
porta para a mesma tela — e duas portas para o mesmo lugar, numa barra de quatro
botões, é espaço gasto sem informação nova. `activeTab` nunca vale `'albums'`.

Duas peças acompanharam o acervo quando ele mudou de casa:

- **A linha de uso de disco** (`renderStorageUsage`) ganhou `alvo` e a condição
  `valido()`. Ela mede OPFS + IDB, e quem enche o disco é o download de música:
  o lugar dela é onde se decide baixar — e apagar.
- **O refresh periódico** (`renderCollectionsNow`, que acompanha o progresso de
  um download) redesenha o popup **só quando ele está mostrando o acervo**:
  redesenhar por baixo de uma lista de músicas tiraria do lugar exatamente o que
  o operador está mirando.

### A letra completa dentro do resultado

Tocar num resultado abre a letra completa em acordeão — é o que fecha o ciclo da
busca por trecho: achar o hino e conferir se é ele mesmo, sem tocar nada e sem
sair da lista.

- **Montada só ao ABRIR, e uma vez só.** Montá-la para todos os resultados
  encheria a lista de centenas de nós de texto que ninguém pediu, e a lista é
  reconstruída a cada tecla digitada.
- **A linha que casou com a busca fica marcada** e recebe `scrollIntoView`: o
  operador digitou aquele trecho justamente para achá-lo, e numa letra de 30
  linhas procurá-lo de novo com os olhos é trabalho que o app pode poupar. A
  marca usa FUNDO, não só cor — ela precisa ser achada de relance, com o bloco
  rolando.
- **Rola por dentro**, com teto de `40vh`: solta, uma letra de 40 linhas
  empurraria os resultados seguintes para fora da tela.
- **Sem letra, explica por quê.** A letra cobre todo o acervo, então a ausência
  significa sempre a mesma coisa — a fila do arranque ainda não chegou nesta
  música (ou falhou). A mensagem é única.
- A fonte é `songLyricStanzas`, que lê os dois acervos (texto primeiro, slides do
  arquivo baixado como complemento) e devolve ESTROFES, nunca linhas soltas.

### Busca dentro da LETRA

"Qual é o hino que fala em *firme nas promessas*?" é a pergunta que o operador
faz de verdade. O mesmo campo varre o texto das letras, e **a letra já está no
aparelho** (`buildLyricSlides` a grava no registro do arquivo quando a música é
baixada): o índice sai de UMA leitura do IDB, sem requisição, e funciona offline
— o estado normal no meio de um culto.

- **Alcance: todo o acervo indexado**, hinários e álbuns; não depende de a música
  estar baixada.
- **Título ANTES de letra, sempre.** Quem digita "Firme nas Promessas" quer o
  hino de mesmo nome no topo, não os quinze que citam a expressão numa estrofe.
  São dois grupos concatenados (`porNome` + `porLetra`), e quem casa por título
  **nem chega a consultar** a letra.
- **A linha que casou aparece no resultado** (`.hymn-lyric-hit`, em itálico com
  barra à esquerda, para se ler como citação e não como mais um subtítulo). Sem
  ela o item apareceria sem relação visível com o que foi digitado.
- **Mínimo de 3 caracteres** (`LYRIC_MIN_Q`): com menos, "de"/"ao" casariam em
  quase todo hino e afogariam os resultados por título.
- **A estrofe é quebrada em linhas** na indexação (o `<br>` da API já virou `\n`
  em `normalizeLyricText`), para o trecho exibido ser uma linha e não o bloco.
- **O índice é construído sob demanda e redesenha ao ficar pronto**:
  `renderSearchResults` é síncrona (roda a cada tecla) e não pode esperar o IDB.
  É INVALIDADO (`invalidateLyricIndex`) no ponto exato em que uma letra nova é
  gravada — invalidar em vez de reconstruir evita pagar a leitura no meio de uma
  sincronização em massa.
- **Custo medido**: com 3.000 letras — a escala do acervo inteiro —, **16,5 ms
  por tecla** incluindo o render. A varredura é `String.includes` sobre um texto
  normalizado uma única vez por música.
- **Acento não atrapalha**: índice e consulta passam pelo mesmo
  `normalizeForSearch` (NFD + remoção de diacríticos).

A v5.31 tentou um **acordeão** e ele foi trocado na v5.32: cobrava três
cabeçalhos permanentes de altura para entregar o mesmo resultado, e ainda
deslocava o painel para baixo conforme a posição da ferramenta na pilha — o
Sorteio começava três linhas mais abaixo que as Mensagens. Hoje é um **seletor
no topo** (`.misc-switch`), uma linha só:

- **Uma ferramenta ativa por vez** (`miscTool`), e **só ela é montada** no DOM —
  é o render dela que religa o seu timer de painel. As outras não existem, então
  não há laço batendo em nó invisível.
- **O painel ativo começa sempre no mesmo lugar**, o que importa para a memória
  muscular de quem opera sem olhar.
- **O trilho do seletor é PREENCHIDO no segmento ativo**, ao contrário dos
  segmentados de dentro das ferramentas (Relógio/Cronômetro/Timer,
  Número/Texto), que são contornados. São dois níveis de escolha empilhados na
  mesma tela; parecidos demais, leriam como um só.
- **Ponto vermelho no segmento = aquela ferramenta está projetando.** Trocar de
  ferramenta **não** tira do telão a que estava no ar, e sem o ponto descobrir
  qual é exigiria visitar cada uma. O ponto (`.misc-tab-live`, 7px) é
  `--danger-text`, **não** `--live`: ele é um gráfico que carrega informação
  (piso de 3:1), e o vermelho cheio da paleta — escuro por construção, ver R2 —
  não chegava lá em fundo nenhum. Com o tom claro ele passa nos dois fundos que
  encontra (**7,08:1** sobre o trilho e **3,29:1** sobre o `--accent-fill` do
  segmento ativo), e o anel claro que existia só no segmento ativo saiu: sobre
  um ponto claro ele não separava nada.
- **`#library` não rola nesta aba** (`.lib-misc`): quem administra a altura é o
  seletor + painel, e o painel ativo rola por dentro se precisar. Com a rolagem
  da lista ligada, a página inteira voltaria a rolar e o rodapé sairia da base.
- Verificado nas três ferramentas: **zero rolagem**, horizontal ou vertical.

**O rodapé são as duas ações que MANDAM ALGO PARA A TELA**, lado a lado
(`renderFoot`): o **microfone** e **"Projetar no telão"**. São as únicas com
efeito fora do celular, e tê-las sempre no mesmo ponto vale mais do que a
proximidade com os controles que as configuram — o operador aprende UM lugar em
vez de um por ferramenta. De quebra, o botão de projetar parou de descer
conforme o painel cresce (no sorteio de texto ele ficava abaixo da lista).

- O microfone é uma **barra**, não mais um disco de 132 px: é o único controle
  daqui com urgência real (push-to-talk pode ser preciso no meio de uma frase),
  e como barra custa ~56 px de altura oferecendo área de toque **maior**.
- **"Projetar" age sobre a ferramenta ATIVA** (`miscProjectState`). Em Mensagens
  ele não pode projetar sozinho — falta saber QUAL, e isso se escolhe tocando na
  lista —, então fica **inerte com um `title` que explica**; some não, porque o
  botão é um ponto fixo da tela e sumir faria o microfone pular de largura a
  cada troca. Com uma mensagem já selecionada ele **reexibe** a que ficou: é a
  ação natural depois de um "Tirar do telão", e sem ela o operador teria que
  caçar a linha certa de novo.

> **Vazamento horizontal (v5.31).** A faixa "de/até" do sorteio empurrava a aba
> além da largura da tela. Causa: o padrão de um item flex é `min-width: auto`,
> que o impede de encolher abaixo da largura intrínseca do conteúdo — e um
> `<input type="number">` sem `size` mede ~200 px por conta própria. Dois campos
> de 200 px não cabiam em 394 px. `min-width: 0` nos dois níveis (o campo e o
> wrapper) resolve. É o vazamento clássico de flexbox, e vale para qualquer
> input futuro dentro de uma linha `.misc-row`.

### Ferramentas: cronômetro · relógio · timer

Terceiro provedor da Camada de Texto, na aba **Ferramentas** (junto do microfone).
O que vai ao telão é o **mesmo cartão** da Bíblia e das Mensagens
(`mode: 'chrono'`), e isso não é economia de CSS: herdando o cartão, herda
junto toda a regra de convivência já madura — `load` de **áudio** mantém o
cronômetro no ar (louvor de fundo sob a contagem de abertura é o uso normal),
`load` **visual** o encerra, a cortina do wallpaper o cobre, `text-hide` o tira
sem parar o som. Um layer próprio teria que reimplementar as quatro e
envelheceria separado.

**O comando carrega um DESCRITOR, não um valor.** Quem conta o tempo é cada
lado, localmente, a partir de uma origem comum:

```js
{ type:'text', mode:'chrono', sub:'<legenda>', view:'visual',
  chrono: { mode:'clock'|'stopwatch'|'timer',
            running, startAt:<epoch ms>, baseMs:<acumulado nas pausas>,
            durationMs:<alvo do timer>, secs, h12 } }
```

Mandar o texto pronto a cada segundo colocaria ~3.600 comandos/hora no
barramento só para mexer dois dígitos — e deixaria o telão **parado** se um
deles se perdesse. Os dois WebViews são o mesmo processo no mesmo aparelho,
então `Date.now()` é a mesma base dos dois lados (no navegador, idem).

A consequência que mais importa é a **reconexão**: como o número é derivado do
descritor, `resendSceneToDisplay` reenviar o mesmo objeto devolve o cronômetro
**no segundo certo**, não no ponto em que a conexão caiu — sem estado nenhum a
ressincronizar. É o mesmo princípio do `load` + posição já usado para a mídia.
Verificado recarregando o Display com um timer estourado em cena: volta
exibindo exatamente o mesmo valor do Controle.

- **O relógio nasce em `HH:MM`, 24 h** (v5.31). No telão o que interessa é a
  hora; o dígito dos segundos mudando o tempo todo puxa o olho para um número
  que não informa nada. Quem precisar liga no chip. Preferências gravadas antes
  da v5.31 carregam `secs: true` só porque era o padrão de então — por isso
  `chronoPrefs` ganhou um `v`, e um registro sem ele tem o `secs` ignorado:
  respeitar uma "escolha" que ninguém fez faria a mudança não chegar a ninguém.
- **`baseMs` existe porque pausar precisa congelar o acumulado.** Com `startAt`
  sozinho, retomar perderia todo o trecho anterior.
- **O timer NÃO congela em zero** — passa a contar em negativo, em vermelho
  (`.chrono-over`). Num culto, "estourou por 4 minutos" é a informação que se
  quer; um `00:00` parado não distingue "acabou agora" de "acabou há muito".
- **`tabular-nums` não é enfeite.** Com algarismos de larguras diferentes, a
  linha inteira se desloca a cada segundo (o "1" é bem mais estreito que o "8")
  e o número parece tremer — o defeito clássico de relógio digital em web.
- **A fonte é dimensionada pelo CONTEÚDO** (`--ch`, o número de caracteres, que
  o tick escreve no elemento; o CSS faz `min(24cqmin, calc(86cqw / var(--ch) /
  0.66))`). Um tamanho fixo teria que servir ao pior caso — `12:34:56 PM`, 11
  caracteres, numa tela 4:3 — e aí `09:59` sairia pequeno à toa; generoso
  demais, o pior caso vazaria da tela. Medido em 5 proporções (16:9, 4:3,
  16:10) × 6 strings: nenhum vazamento, e 259 px de corpo em 1080p contra os
  69 px que um valor fixo conservador daria.
- **O laço só existe quando há o que animar**: relógio sempre; cronômetro/timer
  só em marcha. Pausado é um número parado, e `hideText` derruba o laço junto
  com o cartão — fora de cena ele só gastaria bateria reescrevendo um nó
  invisível.
- **O painel do Controle tem laço próprio**, com vida ligada à aba: o operador
  precisa ver a contagem correr **antes** de projetar. Sair da aba não para a
  contagem (ela vive no estado), só o laço do painel.
- **Cronômetro e sorteio dividem UM laço só** no cartão (`liveKind`/`liveDesc`
  no Display, `pvLiveKind`/`pvLiveDesc` no Controle). O cartão é um só, então
  dois timers escrevendo no mesmo nó nunca seriam ambos corretos — bastaria um
  esquecer de parar o outro para o sorteio ser sobrescrito pelo relógio. Com um
  registro único isso é estruturalmente impossível, em vez de depender de
  lembrar. (No PAINEL são dois laços, e ali está certo: são duas seções lado a
  lado, cada uma com o seu próprio nó.)
- **Um provedor por vez.** `projectChrono` encerra Bíblia e Mensagem, e as duas
  encerram o cronômetro — é um cartão só. Enquanto ele está no ar,
  `slideTarget()` devolve `null`: sem essa guarda, os botões de estrofe cairiam
  na letra do áudio de fundo, que está **escondido atrás do cartão** — o
  operador apertaria "próxima estrofe" e a música saltaria sem nada mudar na
  tela.
- **Cronômetro e sorteio CONTAM como cena** para `pushNowPlaying` (o que
  alimenta a sessão de mídia e a notificação nativa — ver `CLAUDE.md`).
  Ficavam de fora: `renderNowPlaying` já os tratava como cena (escreve
  "Cronômetro" no título e chama a função), mas ali `active` dava `false` e o
  Kotlin derrubava a sessão. O efeito não é a projeção cair no meio — uma vez
  que qualquer mídia foi tocada, `currentId` nunca mais volta a `null` e a cena
  segue ativa —, é o caso da sessão **recém-aberta**: projetar a contagem
  regressiva de abertura sem ter selecionado mídia nenhuma **não levantava** o
  serviço em primeiro plano, e o processo (com a `Presentation` junto) seguia
  descartável sob pressão de memória exatamente durante os dez minutos em que o
  operador minimiza o app para esperar.
- **Só as PREFERÊNCIAS persistem** (`state.chronoPrefs`: modo, duração, formato
  do relógio, legenda). Uma contagem em curso não sobrevive ao fechamento do
  app de propósito: restaurar um cronômetro que "correu" com o app fechado
  mostraria um número sem significado.
- A ferramenta vive só no **modo avançado**, como o microfone: o simplificado
  existe para quem quer conectar a tela e tocar um louvor.

### Ferramentas: sorteio

Quarto provedor da Camada de Texto, na mesma aba. Sorteia **número** (faixa
de/até) ou **texto** (lista de opções — nomes, prêmios, perguntas).

**Quem sorteia é só o Controle.** Se cada tela rodasse o próprio `Math.random`,
o telão e a preview anunciariam **ganhadores diferentes** — o pior defeito
possível aqui, e público. O resultado viaja pronto no descritor; o que cada
lado faz sozinho é só a animação até ele.

```js
{ type:'text', mode:'draw', sub:'<legenda>', view:'visual',
  draw: { kind:'number'|'text', value, seed, rollUntil,
          min, max, pool:[<amostra do ruído>] } }
```

- **O rolo é local, e determinístico.** `rollUntil` diz até quando rolar; o
  quadro exibido sai de `rnd32(seed + quadro)` — um PRNG semeado (mulberry32),
  não `Math.random`. É isso que faz telão e preview piscarem **os mesmos
  valores**: a preview existe para mostrar o que o telão mostra, e dois ruídos
  diferentes a tornariam uma tela paralela em vez de um espelho. Medido: 8 de 8
  quadros idênticos durante o rolo.
- **O quadro sai do tempo QUE FALTA**, não do decorrido — assim ele é função
  pura de (descritor, relógio), e um telão que reconecta **no meio do rolo**
  entra no mesmo quadro dos demais e assenta no mesmo ganhador. Verificado
  recarregando o Display durante a animação.
- **Semente nova a cada rodada**: sem ela o ruído seria idêntico toda vez, e um
  sorteio que "roda igual" parece decidido de antemão.
- **A amostra do ruído é limitada** (`DRAW_POOL_CAP`, 40). O que pisca antes de
  assentar não é o sorteio — mandar uma lista de 500 nomes pelo barramento a
  cada rodada seria pagar caro por decoração.
- **"Não repetir" (padrão)** guarda os já sorteados e os exclui das próximas
  rodadas; a lista fica **à vista**, em ordem inversa, porque numa rifa a
  pergunta seguinte é sempre "quem já saiu?" e o contador sozinho não responde.
  Esgotado, o botão desabilita em vez de repetir alguém.
- **Números não materializam a faixa.** Amostragem por rejeição enquanto sobra
  folga, varredura só quando aperta: um "de 1 até 100000" viraria um array de
  100 mil strings a cada sorteio, e no fim (quase tudo já sorteado) a rejeição
  é que ficaria cara. A faixa é limitada a `DRAW_SPAN_CAP` (100000).
- **O resultado e o histórico PERSISTEM** (`state.drawPrefs`), ao contrário do
  cronômetro. Um cronômetro restaurado mostraria um tempo que não correu; um
  sorteio não depende do relógio — e perder "quem já foi sorteado" porque o app
  fechou no meio faria a rodada seguinte repetir alguém, que é exatamente o
  erro que "não repetir" existe para impedir.
- **Trocar número↔texto zera o histórico**: "12" e "Maria" não pertencem ao
  mesmo conjunto, e manter os dois faria o filtro excluir valores que nem podem
  sair.
- **Verificado uniforme**, que é a promessa central: 6.000 sorteios em 1–6 dão
  X² = 9,59 (corte de 1% = 15,09) e 5.000 em cinco nomes dão X² = 5,09 (corte
  13,28).

### Entradas e saídas de camada sempre com fade (`fadeLayerIn`/`fadeLayerOut`)

A mídia do stage e a cortina do wallpaper já têm as próprias transições (ver
`stage.js`). As camadas **paralelas** — letra, texto manual e a imagem de fundo
das estrofes — não passam por lá, e por isso apareciam/sumiam com corte seco.
`fadeLayerIn`/`fadeLayerOut` dão a elas o mesmo tratamento, com
`LAYER_FADE_MS` = 320 ms. **Nada entra ou sai da projeção sem transição.**

As quatro funções (`fadeLayerIn`, `fadeLayerOut`, `fadeContentIn` e o
`findSlideIndex` da letra) vivem em **`shared/stage.js`**, expostas como
propriedades de `createStage` — mesmo padrão já usado por `rampSteps`/
`MUTE_RAMP_TIME`. Elas eram idênticas linha a linha nos dois apps (`pvLayerIn`/
`pvLayerOut`/`pvFadeIn` no Controle) e **não têm calibração própria nenhuma**:
o que difere entre preview e telão é só o CSS, em `cq*` relativo a cada
container. Cada app mantém os aliases locais (`pvLayerIn = createStage.
fadeLayerIn`, etc.) para o resto do código não mudar. As camadas que de fato
carregam calibração continuam duplicadas, de propósito.

- `fadeLayerIn` **não repete o fade** se a camada já estava visível (guarda
  `wasHidden`) — trocar de versículo não faz o cartão inteiro piscar; quem
  anima aí é só o texto (`animateFadeIn`/`pvFadeIn`, 260 ms).
- `fadeLayerOut` só esconde no **término natural** da animação (`onfinish`):
  se um `fadeLayerIn` cancelar o fade no meio (a camada voltou), esconder ali
  apagaria o que acabou de entrar.
- **`hideLyrics(fade)` adia o teardown da imagem de fundo** em `LAYER_FADE_MS`.
  A `<img>` é FILHA da camada: revogar a object URL e escondê-la de imediato
  faria o fundo sumir por trás de um texto ainda esmaecendo. Mesma coisa em
  `hidePvLyrics(fade)`.
  - **AS TRÊS REGRAS ABAIXO VALEM NOS DOIS LADOS, e isso é da v1.3.10.** Elas
    nasceram no telão e a preview ficou sem elas — enquanto o texto aqui já as
    descrevia como se fossem de ambos. O desfecho foi a queixa do operador:
    *"ao pular e voltar slides, em especial no início das músicas, ou usar os
    botões de próxima/anterior música, as imagens da música não aparecem, e se
    reiniciar a música ou reativar as imagens de fundo nas configurações, ela
    volta normal"* — e **sem TV a preview É a projeção**. É a mesma armadilha
    do `__tela` no `display-ready`: *ler cada lado isolado aprova os dois*.
    Oráculo: **`tools/fundo-da-letra.test.mjs`**, com uma metade por regra.
  - **O teardown é cancelado EXPLICITAMENTE quando a letra volta** (o timer
    fica guardado em `lyricTeardownTimer`/`pvLyricTeardownTimer`, e
    `showLyrics`/`showPvLyrics` o limpam). A guarda de
    sequência sozinha **não bastava**: se a estrofe que volta usa a MESMA
    imagem (`key === lyricImgKey` — o caso normal quando um versículo entra e
    sai em menos de `LAYER_FADE_MS`, e também quando dois hinos compartilham o
    mesmo `imageOpfsPath`), `applyLyricsImage` devolve cedo e **não**
    incrementa a sequência; o teardown então disparava com o `seq` ainda
    válido, revogava a object URL em uso e apagava o fundo da letra que acabara
    de reaparecer, deixando-a sobre preto até a próxima troca de estrofe.
  - **A revogação vem ANTES da guarda de sequência**, e de propósito: quando o
    caminho de troca já zerou `lyricImgUrl`, aquela URL não é mais de ninguém —
    nenhum outro caminho vai revogá-la. Deixá-la atrás do guard significava que
    uma imagem nova entrando em menos de `LAYER_FADE_MS` (estrofe seguinte, ou
    o operador religando o fundo pelo comando `lyricsbg`) invalidava o callback
    e **o blob da foto ficava retido** até o WebView morrer — uma vez a cada
    ocorrência, o culto inteiro. Só o `removeAttribute('src')` continua
    atrás do guard, porque aí o `src` já é de outra imagem.
- **`renderLyricSlide` só REGISTRA o índice depois de validá-lo.** Gravá-lo
  antes fazia um índice inexistente (`findSlideIndex` devolvendo -1 num tempo
  anterior ao primeiro slide, ou um `showLyrics` com a lista ainda vazia) ficar
  marcado como "já renderizado" — e se o mesmo índice voltasse a ser pedido, a
  guarda de topo devolvia cedo e o slide certo **nunca era pintado**.
- `hideText`/`hidePvText` **não limpam o texto** ao sair: apagá-lo na hora
  deixaria o cartão vazio visível durante todo o fade. O próximo `showText`
  sobrescreve.
- Chamadas com `fade=false` continuam existindo de propósito: quando algo
  NOVO já assume a cena no mesmo instante, a transição é da mídia que entra.

### Trecho sem letra: a moldura some (`.nolyric`)

Solos, introduções e trechos instrumentais têm slide com tempo mas sem texto a
cantar. `renderLyricSlide`/`renderPvLyricSlide` ligam a classe `.nolyric` em
`.lyrics-content`/`.pv-lyrics-content` quando a linha principal está vazia **e**
o auxiliar está oculto; o CSS esmaece a moldura inteira
(`.lyrics-content.nolyric .lyrics-box { opacity: 0 }`, com `transition` na
própria `.lyrics-box`), deixando só a imagem de fundo. Uma caixa escura vazia
parada no meio do telão durante um solo não comunica nada. Volta esmaecendo
quando houver o que cantar.

### Fim natural: a capa do hino não pode piscar

No fim da faixa o stage zera o `currentTime` (preparando o replay) e continua
emitindo tempo. Seguir isso re-renderizaria o slide 0 — a **capa do hino**
aparecia por um instante antes de o wallpaper cobrir. Duas guardas simétricas:

- **Display**: `sendStatus()` só chama `updateLyricSlide` se `!stage.hasEnded()`
  (`hasEnded` foi adicionado à API pública de `stage.js`); o `onEnded` esmaece
  a camada (`fadeLayerOut(lyricsEl)`) mantendo os slides carregados.
- **Controle**: a flag `pvLyricsEnded` trava `updatePvLyricSlide` — ligada pelo
  `onEnded` da preview **e** pelo `media-ended` remoto (o Display pode chegar ao
  fim primeiro), desligada em `cmd()` no próximo `load`/`play`/`seek`.

Terminada a faixa, a letra congela no último slide; o replay a traz de volta
(`updateLyricSlide`/`updatePvLyricSlide` refazem o `fadeLayerIn` se a camada
estiver escondida).

O restante desta seção detalha o provedor **Bíblia**; as **Mensagens** são um
provedor mínimo (CRUD de texto puro em `state.messages` + `projectMessage`/
`msgStep`, análogos a `startBibleReading`/`bibleStep`), e a **Letra** tem sua
própria seção ("Letra sincronizada").

**Excluir uma mensagem mexe na SESSÃO, não só no array** (`deleteMessage`), e
são dois casos distintos:

- **A projetada** precisa ser **tirada do ar antes** de a sessão morrer:
  `clearMsgSession()` sozinho zerava `msgSession` sem mandar `text-hide`, e o
  aviso apagado continuava projetado no telão e na preview. Como a sessão
  morria junto, o botão "Tirar do telão" ficava **desabilitado** e a linha
  sumia da lista — o operador não tinha mais nenhum caminho na aba para tirar o
  texto do ar, só ⏹ Parar (e desde a v1.2.0 nem ele, se houver mídia por baixo —
  ver "O Parar fala de UMA camada só") ou projetar outra coisa por cima. Hoje é
  `hideMessage()` (que envia o `text-hide`) e **depois** `clearMsgSession()`.
- **Uma ACIMA da projetada** exige reindexar `msgSession.idx`. Sem isso ele
  passava a apontar para a vizinha errada — ou para fora do array: "Mensagem 3"
  numa lista de duas, nenhuma linha marcada como ativa, e "Projetar no telão"
  caindo no guard `idx >= messages.length` de `projectMessage`, ou seja, um
  botão que não faz nada e não explica por quê.
