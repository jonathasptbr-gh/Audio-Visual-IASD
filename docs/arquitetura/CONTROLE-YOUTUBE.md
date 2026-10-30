<!-- Parte do capítulo do Controle (o índice das partes está em CONTROLE.md;
     o mapa geral, em docs/ARQUITETURA-WEB.md). Partida do CONTROLE.md na
     revisão A3 (2026-10-30): o texto foi MOVIDO verbatim. -->

## Controle — YouTube, downloads, compartilhamento e séries

> Parte do capítulo do Controle — o índice das partes e as regras que valem
> para o Controle inteiro estão em [`CONTROLE.md`](CONTROLE.md).

**Nesta parte:** ["Pesquisar <texto> no YouTube", no fim da busca](#pesquisar-texto-no-youtube-no-fim-da-busca) · [O download vira estado da tela](#o-download-vira-estado-da-tela) · [Compartilhamento](#compartilhamento) · [O contrato do `shouldInterceptRequest` (a invariante 8)](#o-contrato-do-shouldinterceptrequest-a-invariante-8) · [Séries do YouTube — coleções que NÃO vêm do LouvorJA](#séries-do-youtube--coleções-que-não-vêm-do-louvorja-v5228)


### "Pesquisar <texto> no YouTube", no fim da busca

O acervo é o LouvorJA, e ele não tem tudo. `appendYoutubeSearch` leva a busca
PRONTA para o YouTube e devolve o operador ao ponto em que o `intent-filter` de
share já sabe receber o vídeo — sem isso a saída era sair do app, abrir o
YouTube, **digitar tudo de novo** e compartilhar de volta.

- **Em todos os desfechos da busca**, inclusive (e principalmente) "Nada
  encontrado", que é quando a pergunta "e agora?" aparece. Não aparece enquanto
  se FOLHEIA o acervo (sem texto não há o que pesquisar).
- **O texto vai entre aspas** porque é ele que diz que o toque leva ISTO, e não
  abre o YouTube na página inicial. Entra por `textContent`, nunca `innerHTML`:
  é texto digitado pelo operador.
- **Uma LUPA, não o logotipo do YouTube.** O que o botão faz é uma busca;
  desenhar a marca de outro app promete que ele abre lá dentro em algum lugar
  específico.
#### A BUSCA DO YOUTUBE ACONTECE AQUI DENTRO

Num shell ≥ 18 o botão **não sai do app**: `AVNative.ytSearch(termo)` devolve os
resultados e eles entram **na mesma lista**, abaixo do acervo, com miniatura
16:9, título, canal e duração.

- **O pedido sai em PORTUGUÊS, e o caminho não é o óbvio.** A localização padrão
  da biblioteca é **en-GB**, e o YouTube TRADUZ o título quando há tradução —
  uma busca por louvor brasileiro voltava com títulos em inglês de vídeos cujo
  título ORIGINAL é em português.
  - `Localization("pt","BR")` no `NewPipe.init` **não adianta**:
    `StreamingService.getLocalization()` FILTRA o pedido pela lista de idiomas
    suportados, e a do YouTube tem um item só, `"en-GB"` (o resto comentado no
    fonte). Qualquer outro cai no `Localization.DEFAULT`, em silêncio: o código
    PARECE certo. (O país escapa do filtro, então metade do pedido chegava.)
  - A saída é `forceLocalization`/`forceContentCountry` no próprio `Extractor` —
    `getExtractorLocalization()` lê o forçado ANTES da lista. Isso exige montar o
    extrator à mão nos dois caminhos (`getStreamExtractor` e
    `getSearchExtractor`) em vez dos atalhos `getInfo(service, …)`, e no da busca
    **chamar `fetchPage()`**: `SearchInfo.getInfo(extractor)` é o único dos
    `getInfo` que NÃO busca a página sozinho, e sem isso a lista volta vazia, sem
    erro.
  - O código é `"pt"`, não `"pt-BR"`: a lista que a biblioteca guarda como os
    `hl` aceitos tem "pt" e "pt-PT", e com o `gl=BR` "pt" é o do Brasil.
  - `Accept-Language` acompanha no `NpDownloader`: quem manda é o `hl` do corpo
    InnerTube, mas nem toda requisição é InnerTube, e nas páginas HTML é o
    cabeçalho que decide.
  - **Fixo, nunca herdado do `Locale`**: o que se quer é o título ORIGINAL.
- **Quem pesquisa é o Kotlin** (`YoutubeGrab.pesquisar`), não o WebView: ali não
  existe CORS e a requisição sai do IP do aparelho. As alternativas não serviam —
  um `<iframe>` da página de resultados é recusado pelo `X-Frame-Options`, e a
  API oficial exigiria chave embutida no APK com cota dividida pela frota.
- **Só vídeos** no filtro: canal e playlist não têm o que fazer numa lista cujo
  destino é virar arquivo de mídia.
- **O nome do canal sai da frente do título** (`tituloLimpo`). Meio YouTube
  publica como "Arautos do Rei - Firme nas Promessas", e no Cronograma isso vira
  uma lista em que a metade esquerda de toda linha é a mesma palavra. A remoção é
  CONSERVADORA (só corta quando o título começa exatamente com o nome do canal
  seguido de separador, então "Hino 512 - Ao Deus de Abraão" fica inteiro) e o
  sufixo `- Topic` é descontado antes da comparação, senão ela nunca casaria nos
  vídeos de louvor. O canal continua no subtítulo.
- **A miniatura é montada a partir do ID** (`i.ytimg.com/vi/<id>/mqdefault.jpg`)
  em vez de vir da biblioteca: URL estável há mais de uma década, e assim o
  formato das imagens do extrator não pode quebrar a lista.
- **Chegar no fim da lista já pesquisa** (`armarAutoBuscaYt`): rolar até o fim do
  que o acervo tem É o gesto de quem não achou. A espera de 500 ms não é enfeite
  — a lista é reconstruída A CADA TECLA e com poucos resultados a sentinela nasce
  visível: sem ela a busca dispararia com o termo pela metade, uma vez por letra.
- **O cabeçalho de seção (`.yt-head`) faz três papéis**: é a SENTINELA que o
  observador vigia (por isso precisa de altura de verdade — um `li` de altura
  zero é uma aposta na forma como o navegador trata interseção de área nula), é o
  sinal de busca em curso, e é o rótulo que separa acervo de resultados. O
  alinhamento à ESQUERDA e o peso são o que o fazem ler como título de seção.
  Pela mesma razão a negativa do acervo diz o escopo ("Nada encontrado na
  biblioteca"): com o cabeçalho do YouTube abaixo, uma negativa sem escopo parece
  negar a busca inteira.
- **O botão manual continua onde é a única saída**: navegador e shell < 18 (e ali
  a auto-busca não acontece — tirar o operador do app sem ele pedir seria outra
  coisa). Ele exige shell ≥ 15 (`AVNative.openExternal`) e **não é desenhado**
  abaixo disso: o WebView recusa navegar para fora do origin, então o toque não
  faria nada, nem erro no console.
- **O toque num resultado abre a MESMA folha de destinos das músicas do acervo.**
  "Tocar agora" FECHA a Biblioteca (o cartão de progresso mora na preview, atrás
  desta folha); as de "adicionar" a MANTÊM aberta — quem busca vai pegar mais de
  um —, e ali a linha termina marcada como CONCLUÍDA (✓ verde sobre a miniatura)
  em vez de voltar ao estado inicial, que parecia "nada aconteceu".
- **O estado de cada linha vive num Map (`ytEstado`)**, nunca na classe do nó: a
  lista é reconstruída a cada tecla e a marca sumiria com o download correndo (a
  razão do `songRowBusy`). Concluído fica APAGADO, não desabilitado: o mesmo
  vídeo pode ser querido de novo.
- **Cada escolha vai só para o SEU lugar.** A lista de destino é decidida no
  `ytAcao` e entregue ao `addMedia`, que grava registro e entrada na MESMA
  transação — a lista passou a ser ESCOLHIDA, não dispensada, para o registro
  nunca nascer órfão. "Tocar agora" vai para `avulsos`.
- **O mesmo vídeo não baixa duas vezes** (`ytArquivo`): o registro guarda o
  `youtubeId` desde que nasce, então "já tenho isto?" é uma leitura do índice
  (`AVDB.mediaByYoutube`). Só vale para quem tem **blob** — um item de LINK
  carrega o mesmo `youtubeId` e é o que o download existe para substituir.
- **O NOME DO APP VENCE O TÍTULO DO YOUTUBE** (v1.4.10), nos DOIS caminhos —
  o caminho da transmissão (`r.name || man.name`, removido na v1.7.7) e `ytBaixarNativo`
  (`nome || r.name || rotulo`, com o `r.name` do SHELL no meio). A ordem era a
  inversa, e o título extraído chega **segundos depois do toque**: nesse instante
  ele trocava o nome debaixo de tudo — o cartão de espera, a barra do que está
  tocando, a notificação de mídia, a linha da lista. Pior no caminho que mais
  importa: um item de link do Cronograma ou dos Favoritos leva o nome que o
  OPERADOR deu, e o título do canal o apagava. O título fica sendo o que ele
  sempre deveria ter sido — **a resposta para quando não temos nome**, e não uma
  correção do nosso.
  - **Os dois caminhos têm de concordar**, senão o mesmo link renomeia o item ou
    não conforme dê para transmitir.
  - **Nenhum genérico entra antes do título**: o `'Vídeo'` que o
    `resolverLinkInterno` fabricava venceria um título de verdade, que é
    justamente o caso em que ele deve valer. Quem precisa de algo para MOSTRAR
    põe o genérico dele (o `rotulo` do `ytBaixarNativo`).
  - **A correção é do REGISTRO, não do cartão.** Com a legenda certa e o registro
    errado a troca só muda de lugar. Oráculo: as duas últimas metades do
    `tools/toque-instantaneo.test.mjs`, que medem a SEQUÊNCIA de nomes (um teste
    do estado final passa nas duas versões) e o nome NO PONTO DA DECISÃO.
- **O resultado que já está no aparelho nasce marcado** (`marcarYtProntos`): o ✓
  diz as duas coisas. É assíncrono, e o estado mora no `ytEstado`, logo sobrevive
  ao render.
- **No SIMPLIFICADO não há folha: o toque toca.** As outras opções são listas que
  aquela tela não mostra. Vale para tudo o que é compartilhado nesse modo — e a
  prateleira `avulsos` nunca poda o LOTE que acabou de entrar: um share de cinco
  arquivos com o limite aplicado item a item faria o quinto expulsar o primeiro,
  que é justamente o que vai ser projetado. A fixação é UMA por share.
- **Onde o aviso aparece tem TRÊS destinos, não dois.** Tocar: cartão sobre a
  preview. Cronograma: linha provisória na lista. Playlist: **nenhum dos dois** —
  ela mora dentro de uma bandeja fechada, e desenhar a provisória no Cronograma
  prometeria um item que nunca vai aparecer lá.

**Nome normalizado uma vez, não por tecla** (`s._norm`, gravado por
`fetchCollectionIndex` e preenchido sob demanda no filtro): `normalizeForSearch`
faz `normalize('NFD') + replace + toLowerCase` — três alocações de string sobre
um valor que nunca muda, antes repetidas para CADA música do acervo A CADA TECLA.
Os campos de busca também têm **debounce** (`SEARCH_DEBOUNCE_MS` = 130 ms).

**A linha de resultado** (`hymnResultRow`) é `[indicador] [nome / subtítulo]`,
com a fonte maior que a do resto (`.hymn-name`) porque a lista precisa ser
legível de relance no meio do culto. Tocar na LINHA abre a gaveta logo abaixo,
em **acordeão** — abrir uma fecha a anterior: duas abertas ao mesmo tempo
empurrariam a lista e tirariam do lugar o que o operador estava mirando.
#### UMA LINHA, UM TOQUE, UMA GAVETA

```
 ┌────────────────────────┐
 │ [·] Ó Adorai o Senhor    │ ← 83% da linha para o nome
 ├────────────────────────┤
 │  Tocar agora           │
 │  [Cantada|Playback|Letra] │  as OPÇÕES
 │  Adicionar à playlist  │
 │  … + [Ver a letra]     │  → ABRE O LEITOR (numa MÚSICA)
 └────────────────────────┘

 num VÍDEO, a metade de baixo continua:
 ├─────────────────────────────────────────┤
 │  [miniatura] Match point | Provai e …   │  o TÍTULO COMPLETO (identidade)
 │              Provai e Vede | Oficial…   │  o CANAL
 │              Duração 5:19               │
 │              Já no aparelho             │  o estado — SÓ quando há bytes
 │  Um testemunho sobre a fidelidade …     │  a DESCRIÇÃO, INTEIRA
 │  … que decidiu confiar mesmo depois …   │  — a única que vem da REDE
 └─────────────────────────────────────────┘
```

Um alvo só, e a lista inteira do outro lado. Com dois botões na linha (um ▶ e um
`+`, cada um abrindo metade das escolhas), decidir *"o que fazer com este hino?"*
exigia primeiro decidir **qual dos dois era o dono da pergunta** — e essa é uma
pergunta sobre a UI, não sobre o culto.

- **NUMA MÚSICA A GAVETA É SÓ AS OPÇÕES** (v1.2.25), e "Ver a letra" abre o
  **leitor** — a mesma folha do transporte, apontada para aquela faixa
  (`lvItemDaBiblioteca`, ver "A folha não é mais de quem está no ar"). A caixa de
  texto que ficava aqui embaixo era uma SEGUNDA leitura, pior que a que o app já
  tem: sem cifra, sem tom, sem corpo de fonte e sem rolagem — e o caminho para a
  boa era PROJETAR a música, que é justamente o que o operador pediu para não
  precisar fazer. Reusar, nunca reconstruir: uma segunda folha divergiria da
  primeira no primeiro ajuste. Sem fonte forçada — a folha abre na LETRA, com a
  Cifra ao lado; quem veio da gaveta veio de uma lista de músicas, não dos
  acordes.
- **NUM VÍDEO A METADE DE BAIXO FICA:** ali ela é a miniatura, o título
  completo, o canal, a duração e o estado no aparelho — o que responde
  *"é este mesmo?"* num item sem letra —, e o
  mesmo botão continua sendo o interruptor dela ("Ver / Ocultar os detalhes",
  duas frases empilhadas numa grade 1×1 para a largura não mudar sob o dedo).
  Quem decide é `temLetra(coll)`, nunca `ehSerie`. Quem some fechado é o
  ENVELOPE (`.hymn-gaveta`), nunca cada metade: a animação do acordeão mede
  `offsetHeight` de UM elemento, e com duas caixas irmãs aparecendo por conta
  própria a medida seria de meia gaveta.
  - **A ORDEM DAS LINHAS É A DAS PERGUNTAS** (v1.5.21): *o que é isto?* (o
    título) · *de quem?* (o canal) · *quanto dura?* · *já está aqui?* (o
    estado). A identidade vem primeiro porque é ela que decide se o operador
    vai adiante — o resto qualifica o que ele já reconheceu; daí ela ser a única
    em `--text`, contra o `--muted` das outras.
  - **O ESTADO SÓ EXISTE QUANDO ELE É FATO DO ARQUIVO** (v1.6.0). A linha nascia
    sempre, com *"Toca sem baixar"*, e virava *"Já no aparelho"* com bytes no
    disco. Pedido do operador: *"essa informação é útil apenas quando estiver
    escolhendo a qualidade, no caso, não é um 'detalhe do arquivo', mas sim uma
    das características da opção de play"* — e o "Tocar agora", duas linhas
    acima no MESMO card, já diz *"Toca direto da internet…"*. Hoje a linha
    existe só no segundo caso; no comum ela não é desenhada. As classes ficam as
    mesmas (`item-detalhe-estado done`), que é por onde o `smoke.mjs` mede que
    este indicador não é verde e continua em negrito.
  - **O TÍTULO COMPLETO só aparece quando ACRESCENTA alguma coisa.** O rótulo da
    lista é PODADO por construção (a data na frente, o pedaço à esquerda da
    barra — e no `TITULO_SERIE` do Informativo o nome do episódio some inteiro),
    então o cru quase sempre difere; comparar em vez de desenhar sempre é o que
    impede a mesma frase duas vezes na tela.
  - **E NUM LINK ELE VEM DA REDE** (v1.6.0). Relato do operador: *"não estou
    vendo o título completo e original do vídeo do link, ali na página dos
    detalhes"*. A linha sai de `s.nomeOriginal`, que só existe para episódio de
    SÉRIE (a listagem da playlist o grava no índice); um LINK salvo guarda só o
    `name` já tratado, e a linha nunca tinha o que desenhar. O `ytDetalhes` já
    devolvia o `titulo` junto da descrição e ele era descartado no caminho — o
    card passou a guardar o OBJETO em vez do texto, e isso custa ZERO
    requisição a mais. Ele entra por `insertBefore` no TOPO da coluna (chega
    depois dos outros) e leva as MESMAS duas guardas: não desenha se o índice já
    deu a linha, não desenha se for igual ao rótulo logo acima.
  - **O ÍNDICE VALE OFFLINE, e é isso que faz o card valer no sábado de manhã.**
    Canal, duração, miniatura e título de série saem do ÍNDICE
    (`serieFaixaDoItem`) e o estado sai do IndexedDB. Só o que a REDE dá — a
    descrição, e o título de um link — pode faltar. A miniatura é a única
    ilustração: ela sai de cena sozinha se não carregar.
  - **CADA LINHA SÓ EXISTE SE O DADO EXISTIR**, e a guarda é POR CAMPO e nunca
    por versão de bundle: entre o OTA chegar e a varredura refazer o índice há
    uma janela em que o guardado não tem os campos novos. A linha ausente SOME —
    a regra do Registro aplicada a um card.
  - **`textContent`, NUNCA `innerHTML`.** Título, canal e descrição são texto de
    TERCEIRO, e o Controle roda no origin privilegiado, o que injeta
    `__AVBridge`. Na descrição a regra custa caro — é o campo que o YouTube
    entrega em HTML quando há links —, e por isso ela tem uma SEGUNDA metade no
    Kotlin: `YoutubeGrab.detalhes` já achata o HTML, então o que atravessa a
    ponte é texto e a tela não mostra marcação literal.
  - **E A DESCRIÇÃO É A ÚLTIMA LINHA, uma das duas que vêm da REDE** (v1.5.21,
    shell 62 — `AVNative.ytDetalhes`). As do índice valem offline; esta custa
    uma extração POR VÍDEO, e daí as decisões que a cercam:
    - **O gatilho é a REVELAÇÃO, não a abertura da linha.** Quem pede é o toque
      em "Ver os detalhes", uma vez por vídeo OLHADO. Pendurá-la no toque na
      LINHA gastaria uma extração por gaveta aberta — inclusive nas que o
      operador abre só para mandar o episódio ao Cronograma —, e na montagem da
      LISTA gastaria uma por episódio do álbum, que é a varredura que a fila de
      extração do shell proíbe por escrito. **O mesmo pedido traz o título**, e
      é isso que faz a correção do link custar zero.
    - **NADA VAI PARA O DISCO, e o precedente é o da CIFRA, palavra por
      palavra:** um `Map` que morre com o app (`ytDetalhesCache`), nada em
      IndexedDB, nada no bundle do OTA, nada no repositório. Guardar mudaria o
      recurso de NATUREZA — o app deixaria de LER conteúdo de terceiro no
      aparelho do operador e passaria a DISTRIBUIR uma cópia dele.
    - **`null` não é guardado; um campo vazio é.** A ponte separa "não houve
      resposta" de "respondeu e não há descrição" (ver `docs/shell/PONTE.md`), e
      é a mesma disciplina do `sem-rede` da cifra: um Wi-Fi que oscilou não pode
      custar um buraco que só some fechando o app. Desde a v1.6.0 o que o cache
      guarda é o OBJETO (`{ titulo, canal, descricao }`), e a distinção continua
      sendo entre a RESPOSTA e o CAMPO.
    - **ELA VEM INTEIRA, e não há mais regra de truncagem NENHUMA** (v1.6.0).
      Houve um clamp de 4 linhas no CSS com um "Ver mais" ao lado; o operador o
      dispensou (*"já deixe tudo aberto de uma vez"*), e o argumento é o da
      gaveta: ela já é o acordeão que abre e fecha o card inteiro, e um segundo
      grau de revelação lá dentro não respondia pergunta nenhuma. O único teto
      que sobra é o do Kotlin (`DESCRICAO_MAX`, 2 000 caracteres) e é de
      TRANSPORTE, não do que a tela mostra.
    - **Sem rede o card não parece quebrado:** o bloco simplesmente não existe,
      e as linhas do índice continuam inteiras. É a degradação certa, e a mesma
      do navegador, onde não há ponte.
- **Nada de menu foi reimplementado.** `renderSongMenu` e `openYtMenu` ganharam
  PARA ONDE escrever (`songMenuFor.alvo`, que viaja no ESTADO porque cada
  remontagem — o seletor, cada marca de destino — precisa refazer a lista no
  mesmo lugar), e o modo `tudo` empilha tocar e adicionar numa lista só. A folha
  `#songMenuPopup` continua de pé com os dois donos que sobraram: os resultados
  do YouTube e o seletor de destinos da importação.
- **Um episódio de SÉRIE desvia para a lista do YouTube**, como a folha já fazia.
- **O quadrado da esquerda é INDICADOR, não botão.** Ele fica porque hospeda o
  anel de download — a única coisa que aquele canto sempre informou de verdade —
  e porque segura a coluna que alinha a lista. Perdeu o `--accent-soft` e o
  `cursor: pointer`: um alvo que não é alvo, num canto onde o dedo mira, é pior
  que não ter nada.
- **O oráculo do ALVO afirma que TODO ponto da linha leva ao mesmo lugar** —
  cantos, bordas e o quadrado onde o ▶ vivia — e conta `button` sem conhecer
  nomes, para valer contra o próximo que aparecer.
- **No simplificado nada disso aparece:** o toque na linha chama `simplePlaySong`
  direto, que é a decisão que aquele modo poupa.

**O SELETOR DECIDE O QUÊ; AS OPÇÕES, ONDE.** O seletor tem três segmentos
(Cantada · Playback · **Letra**) e aparece SEMPRE — ele já dependeu de haver
playback, e toda música tem letra. Com "Letra" escolhida, "Tocar agora" projeta a
letra e cada lista recebe a CENA de letra (`addLyricCue`, que aceita várias
listas), o que torna "Só a letra, no Cronograma" redundante. Sem essa divisão a
variante aparecia duas vezes, uma como segmento e outra como linha.

**Duas armadilhas que a lista trouxe ao mudar de casa**, e as duas são "algo que
ela deixou de herdar":

| Sintoma | Causa |
|---|---|
| marcadores de lista à esquerda | a `<ul>` nova não herdou `list-style: none` de ninguém (a do popup é `.popup-list`, que já o tinha). Não vinha de regra do app: era a **ausência** de uma |
| o feedback de toque encolhia a gaveta inteira | o `:active` do `.lib-item` satisfeito por um botão DENTRO dele |

**A gaveta é um POÇO, soldado à sua linha.** Medido no tema escuro, com o
`--panel` da folha antiga: `--panel` compõe rgb(44,52,60) e a faixa de uma linha
vizinha compõe rgb(46,54,63) — **1,03:1**, isto é, a seção aberta tinha
literalmente a cor das linhas de baixo, com a margem em volta deixando passar a
faixa da própria linha como moldura (três tons indistinguíveis empilhados).

O tom é um par por tema (`--gaveta-bg`/`--gaveta-btn`), e a inversão é
aritmética:

- **escuro** — só dá para DESCER. Subir levaria a `--panel-2`, que é a cor do
  card do álbum, a que aparece nos vãos entre as linhas. Par: `--bg` × `--panel`.
- **claro** — só dá para SUBIR. Descer para `--bg` deixaria a gaveta a 1,09:1 do
  card. Par: `--panel` (branco) × `--panel-2`.

É o precedente que o `--field-bar` abriu num lugar novo (aquele token saiu na
v1.5.2 com a faixa da barra de busca, mas a regra que ele provou fica): **uma
superfície cuja direção não acompanha a escada precisa de um token próprio em
cada tema.** E os BLOCOS que
descansam nela vestem `--gaveta-btn` em vez do `--surface` de fábrica, porque
aquele é um OVERLAY — dentro de uma seção da Biblioteca ele resolve para o par
SUNK, e preto sobre um poço que já é o tom mais escuro do app não produz degrau.

**A gaveta não tem margens.** Ela é filha do `.lib-item`, que já pinta a linha
inteira e recorta pelo `border-radius` com `overflow: hidden` — coladas, faixa e
gaveta viram UM bloco com o título em cima e o poço embaixo. O respiro vem do
`padding` da lista de opções.

**A caixa de marcação se vê sem estar marcada** (`--check-vazio`): 1,08:1 contra
o botão em que mora → 1,28:1. Token com TEMA e não o `--scrim` compartilhado (no
claro aquele .6 seria uma lápide), e ainda um RECESSO. O teto é do tema escuro:
preto sobre um botão já escuro comprime a razão por construção.

**A largura do "Ver/Ocultar a letra" não muda com o estado.** "Ocultar" é mais
longo que "Ver": o botão crescia ao ser tocado (110px → 143px) e o CONFIRMAR ao
lado encolhia junto. As duas frases ocupam a MESMA célula de uma grade 1×1 — a
largura é a da maior. **`visibility` e não `display`**, porque a escondida
precisa continuar MEDINDO: é ela que reserva o espaço. Um `min-width` em `ch`
seria um número a manter contra a fonte e contra a tradução; isto não tem número.

Tocar (`playSongVariant`) e os três destinos (`addSongToDestinos` →
`adicionarNasListas`) baixam a música na hora se ainda não estiver offline — e o
download é **um só** por toque, mesmo com os três destinos marcados: o caro é
resolver o id, e o item resultante é o MESMO em todas as listas. O funil é um:
`listasDosDestinos` → `adicionarNasListas`. **"Letra"** baixa também, mas só
quando precisa: a letra costuma já estar no acervo de textos.
### O download vira estado da tela

Tocar uma música que ainda não está no aparelho abre um download de dezenas de
segundos, e o toque precisa mudar a tela AGORA. Duas metades:

1. **A resposta é imediata e igual à de uma música já baixada.**
   `closeSongMenu()` e `closeHymnSearch()` ficam no **começo** de
   `playSongVariant` (e de `projectSongLyricsOnly`), ANTES do `await`.
2. **A espera aparece na miniatura da preview** (`previewBusy` → `#pvBusy`): é
   ali que a mídia vai aparecer. Um aviso na tela principal seria mais um cartaz
   avulso a interpretar.

- **É um CARTÃO no meio, não uma cortina.** A preview espelha o telão e precisa
  continuar espelhando enquanto a próxima música baixa. O cartão é opaco por
  conta própria — com véu translúcido a marca do wallpaper atravessava o texto.
- **Só acende depois de `PV_BUSY_DELAY_MS` (180 ms)**: uma música já baixada
  resolve em poucos ms, e um cartão que pisca lê-se como falha.
- **O contador é um número, não um booleano** (`pvBusyCount`): dois downloads
  simultâneos, e o primeiro a terminar não pode apagar o indicador do outro.
- **A ação e o nome são campos separados** (`Baixando` em caixa alta miúda, o
  nome embaixo): numa caixa de ~250px a frase inteira estoura a linha.
- **O cartão desvia das DUAS colunas de `.pv-fab`** (38px de folga de cada lado,
  v1.4.9) e **não aparece na tela cheia**, onde a preview É a projeção e ele iria
  para o telão. A folga é simétrica por duas razões que uma só não atende:
  - **CLAREZA.** As colunas são `z-index: 5` contra 4 — o que invade não é
    coberto, é coberto POR ELAS. A folga existia só à direita, de quando só havia
    a coluna do player; a de OPERAÇÃO entrou à esquerda na v1.3.5 e ninguém refez
    a conta. MEDIDO a 360px com um nome longo: 28px sob ela, com o botão da
    cortina desenhado sobre o aro de espera.
  - **CENTRO.** `justify-content: center` centra no CONTEÚDO, não na caixa: com
    8px de um lado e 38px do outro o cartão nascia **15px à esquerda** do centro
    da preview, em toda largura e com todo nome. Ninguém relata 15px — lê-se como
    desalinho, e não se sabe de quê.

  Oráculo: as duas últimas metades do `tools/controles-layout.test.mjs`, e são
  DUAS porque uma folga simétrica grande demais centra e afasta, e uma pequena
  demais centra e deixa invadir — só a de centro aprovaria a segunda.
- **No simplificado sem tela conectada ele não existe** — a preview não está na
  tela —, e por isso `previewBusy` devolve `{ visivel, soltar }`.
- **A RECUSA DE UM ITEM DE LINK FALA PELO CARTÃO** (`recusarLink`, v1.4.14), e
  não só pela linha. O `notaNoItem` escreve no subtítulo do item — o certo
  quando a linha está à vista —, mas **ela some justamente no caso que mais
  importa**: um episódio de série mora dentro do álbum, e o "Tocar agora" fecha
  a Biblioteca (`closeHymnSearch`) antes de começar. O desfecho era silêncio
  completo depois de segundos de espera, com o relato *"carrega um tempo, não
  toca nada e nem dá mensagem"*. O cartão é a régua de sempre — **o aviso mora
  onde o resultado ia aparecer** —, e o caminho da BUSCA já fazia isso: a
  assimetria era o defeito. O cartão é PRÓPRIO e não o do `cederOPalco`: aquele
  é solto no `finally` logo a seguir, e `falhar()` precisa de um dono que segure
  a mensagem pelo prazo de leitura.
- **E A CAUSA É DITA quando o shell a nomeia** (`motivoDaRecusa`). *"Não foi
  possível baixar"* e *"este vídeo não está disponível"* mandam fazer coisas
  OPOSTAS — tentar de novo × escolher outro. MEDIDO em campo: o Registro trouxe
  `extração falhou: ContentNotAvailableException` e o app dizia a frase
  genérica. Ele lê o `ytDiag()` e procura a marca; **só ESPECIALIZA**, nunca
  inventa — não achando, a frase genérica vale como sempre, e o dia em que o
  nome da exceção mudar isto volta ao comportamento de hoje. Vale nos DOIS
  caminhos (link e busca), senão o mesmo vídeo conta duas histórias conforme
  onde foi tocado. A janela de antecedência da série (`avisoSeFalhar`) continua
  vencendo as duas: ela é a única que diz o que fazer.
- **O cartão tem TRÊS desfechos que falam, não dois** (v1.4.11): `soltar()` (o
  trabalho acabou e não há o que dizer), `falhar(motivo)` (não deu — âmbito
  vermelho, "Não deu") e **`avisar(cap, texto)`** — deu certo, COM uma ressalva.
  Os dois últimos partilham a mecânica (`encerrarCom`): travam sem liberar,
  seguram o cartão pelo prazo de leitura, e um trabalho novo toma a legenda
  antes. O que muda é a cor e a palavra: **âmbar, não vermelho**, porque neste
  app o vermelho é ação destrutiva ou o que está NO AR, e uma ressalva não é
  nenhum dos dois.

#### Adicionar a uma lista: a marca vai para a LINHA

Adicionar também dispara download, e ali a preview é o lugar errado: a Biblioteca
**continua aberta de propósito** (adicionar três músicas seguidas é o uso normal)
e nada vai para a preview. O indicador vai para o quadrado da própria linha.

- **É o MESMO anel** (`.dl-ring`, com `--dl-ring` dando o tamanho): dois
  spinners para a mesma espera fariam o operador perguntar se são coisas
  diferentes.
- **Mas ele são DOIS desenhos, e no cartão da preview a SETA é condicional**
  (v1.4.19). O aro diz *"espere"*; a seta diz *"bytes chegando"*, e só uma delas
  é verdade numa PREPARAÇÃO — a extração de um link, a montagem de uma playlist,
  a rasterização de um PDF, e a própria fase pré-bytes de um download (que nasce
  em "Preparando vídeo" e vira "Baixando vídeo · N%" no primeiro progresso).
  **O ícone segue a LEGENDA** (`pintarSetaDoCartao`), e não uma bandeira a mais
  na assinatura do `previewBusy`: a legenda já carrega a distinção na tela, é
  escrita em DOIS pontos (a criação e o `atualizar`), e derivá-la ali faz o
  desenho e a palavra nunca discordarem. Falha para o lado certo — uma legenda
  nova escrita de outro jeito vira um spinner puro, nunca uma promessa de
  download que não existe. Oráculo: `gaveta-e-cartao.test.mjs`, medindo o
  RENDERIZADO (a classe sem a regra de CSS continuaria desenhando a seta).
  Na miniatura da LINHA a seta fica sempre: ali o indicador só acende com
  download de verdade.
- **Quem acende é `ensureSongDownloaded`**, logo DEPOIS da checagem
  `needsFull || needsPlayback` — o único ponto que já sabe que há download de
  verdade. Acender no chamador exigiria repetir a checagem e piscaria em toda
  música já baixada. Como efeito, **todo caminho que baixa sob demanda ganha a
  marca sem precisar lembrar dela**.
- **O estado vive num `Map`, não na classe do botão** (`songRowBusy`, contado
  por música). A lista é RECONSTRUÍDA durante o download (o progresso redesenha
  a cada 400 ms), e uma classe escrita no nó sumia no redesenho seguinte:
  a linha voltava ao ocioso com o download correndo. `hymnResultRow` relê o Map
  ao montar (a linha carrega `data-song`). Contado, porque adicionar a mesma
  faixa a dois destinos abre dois pedidos.
**Resolução do id de mídia por variante** (`resolveSongMediaId`) é
**offline-first com download sob demanda**: variante já baixada → id do catálogo
OPFS direto (zero-cópia); senão, `ensureSongDownloaded` baixa a música **de
verdade** ali mesmo (a mesma `downloadCollectionSong` da sincronização em massa —
áudio + capa + letra, pronto para tocar offline dali em diante), nunca um
registro temporário. `songDownloadInFlight` (Map por `<coll.id>:<id_music>`,
sessão) evita dois downloads da mesma música em paralelo.

> **Nota de rede**: a API de produção precisa aceitar CORS para a origin em que a
> base roda — no aparelho, `https://appassets.androidplatform.net`. Não
> verificado em produção: a rede das sessões de desenvolvimento não alcança
> `api.louvorja.com.br`. Se o `fetch` falhar por CORS, a sincronização e a busca
> ao vivo param — mas não a busca no índice já baixado, que é toda em memória.

#### Letra sincronizada (slides + temporizador)

Cada variante baixada (registro em `files`, criado por `downloadCollectionFile`)
ganha campos extras, sem exigir bump de `DB_VERSION` (o `files`/`media` guarda
objetos livres de schema):

- `lyrics`: `Array<{ time, text, auxText, cover, imageOpfsPath, imagePosition }>
  | null | undefined` — **sentinela de 3 estados**: `undefined` = nunca
  processado (dispara reprocessamento na próxima sincronização mesmo com o áudio
  já baixado — é o que dá BACKFILL aos hinos sincronizados antes de a
  funcionalidade existir, sem rebaixar áudio); `null` = já processado e sem
  estrofes com tempo utilizável (não tenta de novo à toa); array = o primeiro
  item é sempre o slide de capa (`cover: true`, `text: null`, `time: 0`), os
  demais vêm do mapa `lyric` de `music_{id}` (filtrados por `show_slide`, tempo
  do campo certo — `time` para Cantado, `instrumental_time` para Playback —
  convertido por `parseTimeToSeconds` e ordenado).
- `hymnName`/`hymnTrack`/`hymnAlbum`: título limpo, número do hino e o
  **álbum/coleção de onde a música veio** (`coll.name`) — as três peças do cartão
  de capa. `hymnAlbum` mora no REGISTRO, e não numa consulta na hora de projetar,
  porque quem projeta é o Display: ele só recebe o registro do arquivo e não tem
  acesso a coleção nenhuma. Registro antigo é preenchido na varredura que a
  sincronização já faz (`ensureSongVariant`) e, para a biblioteca que JÁ ESTÁ
  PRONTA, por uma passagem única no lançamento (`preencherAlbunsDosHinos`, no
  molde do `desnumerarAlbunsBaixados`): **os dois pontos de escrita cobrem uma
  biblioteca sendo MONTADA, e nenhum deles alcança a que já existe** — música
  baixada não é baixada de novo, e coleção completa não é re-sincronizada. A
  ligação que a passagem lê já existia (o `folder` de todo registro baixado de
  uma coleção é o id dela), e ela CORRIGE além de preencher, para uma coleção
  renomeada na origem não deixar capas com o nome velho.
  **Não há campo de AUTOR na fonte**: o LouvorJA publica nome, faixa e álbuns —
  e uma linha inventada na frente da congregação é pior que uma linha a menos.
terminar. Ver
"Wi-Fi vs dados móveis" abaixo para a política de quando cada tipo de
download é permitido.

> **Nota de rede**: a API de produção precisa aceitar CORS para a origin em que
> a base roda — no aparelho, `https://appassets.androidplatform.net`, servida
> pelo `WebViewAssetLoader` do shell (ver "Build, distribuição e instalação"); no
> navegador, o que o servidor estático de desenvolvimento usar. Não verificado
> em produção: a rede das sessões de desenvolvimento não alcança
> `api.louvorja.com.br`. Se o `fetch` falhar por CORS, a sincronização e a
> busca ao vivo param de funcionar — mas não a busca no índice já baixado, que
> é toda em memória.

#### Letra sincronizada (slides + temporizador)

Cada variante baixada (registro em `files`, criado por `downloadCollectionFile`)
ganha campos extras, sem exigir bump de `DB_VERSION` (o `files`/`media` do
`shared/db.js` guarda objetos livres de schema):

- `lyrics`: `Array<{ time, text, auxText, cover, imageOpfsPath, imagePosition }> | null | undefined`
  — sentinela de 3 estados: `undefined` = nunca processado (dispara
  reprocessamento na próxima sincronização, mesmo que o áudio já esteja
  baixado — é o que dá **backfill** aos hinos sincronizados antes desta
  funcionalidade existir, sem rebaixar áudio: `ensureSongVariant` só
  recalcula e regrava a letra no registro já existente); `null` = já
  processado, mas o hino não tem estrofes com tempo utilizável (não tenta de
  novo à toa); array = primeiro item é sempre o slide de capa (`cover:true`,
  `text:null`, `time:0`, imagem da música), os demais vêm do mapa `lyric` de
  `music_{id}` (filtrados por `show_slide`, tempo do campo certo — `time`
  para Cantado, `instrumental_time` para Playback — convertido pra segundos
  via `parseTimeToSeconds`, ordenados por tempo).
- `hymnName`/`hymnTrack`/`hymnAlbum`: título limpo, número do hino
  (`s.name`/`s.track`, sem o prefixo/sufixo que `name` carrega pra exibição na
  lista) e o **álbum/coleção de onde a música veio** (`coll.name`, v5.219) — as
  três peças do cartão de capa. `hymnAlbum` mora no REGISTRO, e não numa
  consulta na hora de projetar, porque quem projeta é o Display: ele só recebe
  o registro do arquivo e não tem acesso a coleção nenhuma. Registro antigo é
  preenchido na varredura que a sincronização já faz (uma escrita por registro,
  em `ensureSongVariant`) — e, para a biblioteca que JÁ ESTÁ PRONTA, por uma
  passagem única no lançamento (`preencherAlbunsDosHinos`, v5.220, no molde do
  `desnumerarAlbunsBaixados`): os dois pontos de escrita cobrem uma biblioteca
  sendo MONTADA, e nenhum deles alcança a que já existe — música baixada não é
  baixada de novo, e coleção completa não é re-sincronizada. A ligação que a
  passagem lê já existia: o `folder` de todo registro baixado de uma coleção é
  o id dela. Ela corrige além de preencher, para uma coleção renomeada na
  origem não deixar capas com o nome velho.
  **Não há campo de AUTOR na fonte**: o LouvorJA publica nome, faixa e álbuns
  (ver `docs/FONTE-DE-DADOS-LOUVORJA.md` §5.1), e uma linha inventada na frente
  da congregação é pior que uma linha a menos.

#### O cartão de capa (v5.219)

O primeiro slide de todo louvor sincronizado. Ele era **uma linha** — o título
com o número colado na frente ("147. Ó ADORAI O SENHOR"), pintado em `--brand`,
no lugar exato onde a estrofe apareceria um segundo depois. Hoje são três peças
com pesos diferentes:

```
            ──── 147 ────        ← número, BRANCO, 5,8cqmin, entre dois fios
        Ó ADORAI O SENHOR        ← título, BRANCO, 8,4cqmin, até 3 linhas
        HINÁRIO ADVENTISTA       ← álbum, esmaecido, caixa alta espaçada
```

- **O número é branco, e os FIOS é que levam o acento** (v5.222). Ele nasceu em
  `--stage-accent` — 9,75:1 sobre o preto, aprovado por qualquer régua de
  contraste — e o operador o descreveu como "muito discreto no fundo escuro". As
  duas coisas são verdadeiras ao mesmo tempo, e é o que a régua não pega:
  contraste é razão de luminância, e num telão quem decide é **cor + corpo**. O
  número tinha o menor corpo do cartão somado à única cor não-branca da tela.
  A cor ficou onde não precisa ser lida — os dois fios —, com `background`
  explícito, porque com `currentColor` embranquecer o número teria embranquecido
  os fios junto.

- **O título deixou de ser o elemento colorido da tela.** Num telão de igreja o
  que precisa ser lido do fundo do salão é o NOME, e cor tirada de uma paleta de
  UI nunca rende o que o branco pleno rende (21:1 medidos contra os 9,75:1 do
  acento). O acento ficou nos fios (ver o item seguinte).
- **Cada peça só existe se houver o dado.** Um arquivo importado à mão não tem
  número nem álbum, e a capa dele volta a ser o título centralizado, que é a
  capa de sempre.
- **A caixa da capa CRESCE com o conteúdo** — a única do sistema que faz isso. A
  altura fixa (40cqh) existe para a moldura não pular de tamanho entre estrofes;
  na capa ela produzia o defeito oposto, e ele foi fotografado antes de ser
  corrigido: com o título em duas linhas, `num + título + álbum` somavam mais
  que a caixa, o flex encolhia os itens e a linha do álbum era desenhada POR
  CIMA da segunda linha do título. Aqui não há "próximo slide" com que casar a
  altura, então a caixa se ajusta; o teto de 60cqh e o `overflow: hidden`
  seguem sendo a garantia final, e `flex-shrink: 0` no número e no álbum faz o
  título ser o único a absorver a falta de espaço (ele é o único que sabe se
  cortar).
- **A preview espelha o cartão peça a peça.** É na capa que o operador confere
  se pegou o hino certo — uma capa diferente ali seria uma ilustração errada.
  `tools/display-smoke.mjs` trava as três peças e a saída delas na estrofe
  seguinte.

**Quebras de linha vêm da própria API, como `<br>` literal** dentro de
`lyric`/`aux_lyric` (confirmado no app-ja: ele usa `v-html` pra deixar o
navegador interpretar essas tags como quebra real). `buildLyricSlides`
passa `text`/`auxText` por `normalizeLyricText()`, que troca `<br>` (e
variações `<br/>`/`<br />`) por `\n` real — **não** por `innerHTML`/`v-html`
(sem risco de injeção: é só uma troca de string, o resto do texto continua
literal). O CSS (`.lyrics-line`/`.lyrics-aux` no Display,
`.pv-lyrics-line`/`.pv-lyrics-aux` na preview) usa `white-space: pre-line`
para respeitar esse `\n` — sem isso, a quebra pretendida pelo hino se perde
e o navegador quebra a linha sozinho, do jeito errado (ou mostra o `<br>`
literal na tela, já que `textContent` não interpreta HTML).

Imagens por estrofe (`imageOpfsPath`) são baixadas de verdade pro OPFS
(mesma pasta `folders/<coll.id>/`, `downloadCollectionImage`) — nunca URL
remota direta, preserva o offline. Uma linha sem imagem própria **herda a da
anterior** (fallback "grudento", igual ao app original); imagens iguais
entre linhas/variantes são baixadas uma única vez (`resolveImage`, cache por
URL compartilhado entre Cantado e Playback do mesmo hino, já que costumam
usar as mesmas imagens). Um hino tocado/adicionado antes de qualquer
sincronização em massa passa pelo mesmo `downloadCollectionSong` sob demanda
(ver "Resolução do id de mídia por variante" acima) — já sai dali com letra
sincronizada, igual a um hino baixado em massa.

#### Wi-Fi vs dados móveis

A sincronização em **massa** (`syncCollection`, baixar todas as músicas
pendentes de uma coleção de uma vez) fora do Wi-Fi **não é bloqueada — ela
pergunta**. Baixar um hinário inteiro pode ser bastante coisa, e só o operador
sabe se o plano dele aguenta; o que o app não pode é decidir sozinho por ele,
em nenhuma das duas direções.

Sem Wi-Fi confirmado (`isConfirmedWifi`, Network Information API —
`navigator.connection.type === 'wifi' || 'ethernet'`; sem suporte no navegador
cai em `'unknown'`, tratado como Wi-Fi **não** confirmado, postura
conservadora), a lista leve é atualizada sempre (metadados, barato) e o
download pesado abre um diálogo de duas saídas: **"Usar dados móveis"** ou
**"Só no Wi-Fi"**. A escolha vale **só para aquela sincronização daquele
álbum** — não vira preferência do app, e o próximo álbum pergunta de novo.

O diálogo mostra **quanto** falta: `estimatePendingBytes` devolve o mesmo
número que o painel do álbum (`medirColecao`), que é o ponto — a estimativa que
decide o gasto de dados móveis não pode divergir da que o operador acabou de
ler no card.

Um indicador (`.net-badge`, ícone de Wi-Fi inline — fora do subset da fonte)
aparece nas opções da coleção, atualizado ao vivo
(`connection.addEventListener('change', ...)`).

O download **individual** (tocar/adicionar uma música, `ensureSongDownloaded`)
não pergunta nada e é sempre permitido, em qualquer rede: é exatamente o hino
que o operador acabou de pedir — uma música, não um acervo —, e um diálogo a
cada toque seria só atrito. Na prática,
sem Wi-Fi o hinário vai sendo baixado aos poucos, só com o que de fato for
usado em cada culto, em vez de baixar tudo de uma vez usando dados móveis.

**Display** (`display/`): layer `#lyrics` (imagem de fundo
`object-fit:cover` + uma faixa central — `.lyrics-box`: no padrão visual de
"vídeo de louvor", cantos **retos** (`border-radius: 0`), **sem linha de
borda** (v5.42 — o contorno branco desenhava um retângulo que competia com a
letra; quem separa o texto da foto é a própria faixa escura) e sem
`box-shadow`; o fundo é `--lyrics-frame-bg` e **só existe no modo imagem**
(ver "Moldura só no modo imagem" abaixo), com `width`/`height` como fração do
container (`84cqw`/`40cqh`) — a legibilidade do texto vem da própria faixa,
não de um gradiente cobrindo a tela inteira, então funciona igual
independente da imagem por trás), inserido no DOM entre
`#video` e `#youtube`, mesmo `z-index:1` dos demais layers de mídia — a
cortina do wallpaper (hoje `z-index:3`, acima de toda mídia e do cartão de
texto) cobre/revela esse layer de
graça, **sem nenhuma mudança em `stage.js`** (letra é tratada como camada
paralela, mesmo padrão já usado pela ponte do YouTube). `hideLyrics()` é
chamado incondicionalmente no início do tratamento de `load` (antes do
atalho de YouTube) e em `stop`/`clear` — sem isso, trocar de um hino pra um
vídeo do YouTube não escondia a letra de verdade, só ficava mascarado por
sorte de ordem de pintura no DOM. Depois de `AVDB.getMedia(cmd.mediaId)` (já
existia), se `rec.kind==='audio' && rec.lyrics?.length` → `showLyrics(rec)`.
O avanço de slide reaproveita o `onTime`/`sendStatus()` já existente (sem
timer novo): `updateLyricSlide(t)` acha o último slide cujo `time <= t` e só
mexe no DOM quando o índice muda; a imagem de fundo só é re-resolvida (via
`AVDB.opfsGetFile` + object URL, com guarda de sequência tipo `loadSeq`) se o
`imageOpfsPath` realmente mudou entre um slide e o seguinte. `hymnName`/
`hymnTrack` do item atual ficam guardados à parte (`currentLyricsMeta`, não
só passados como parâmetro do `showLyrics` inicial) — sem isso, o slide de
capa perderia o título ao ser re-renderizado pelo tick de tempo (ex:
operador volta pra estrofe 0 depois de já ter avançado).

**Fundo preto vs. imagens dos slides** (`lyricsBgMode`, state `lyricsBg`,
comando `lyricsbg`): **as imagens são o padrão** — a de cada slide vem baixada
com a música (`resolveImage`, ver acima, que não consulta preferência nenhuma),
e o operador tira-as em **Remover**, no tile **Fundo da letra** do painel
rápido de Configurações (`#lyricsBgTile` → `setLyricsBg`/`renderLyricsBgTile`;
até a v1.4.35 era o segmento `#lyricsBgSeg`, com o rótulo por extenso "Imagens
dos slides (músicas)"). **A leitura
do banco pergunta `=== 'black'`, nunca `=== 'image'`**: ausente é quem nunca
escolheu e cai no padrão; só o "Remover" grava um valor. Pela mesma razão o
reenvio à tela da rede (`telaReenviarPreferencias`) manda o `lyricsbg` **sem
condição** — condicioná-lo ao modo calaria justamente o "Remover". Até a v5.18
isso era um botão do mixer; ele saiu de lá porque é uma preferência de
aparência (como preenchimento e wallpaper, seus vizinhos agora), não um
controle de operação — e o lugar que abriu no mixer virou a **leitura
auxiliar** (ver seção própria). `applyLyricsImage(slide)` centraliza a decisão: calcula a "chave
efetiva" da imagem (`slide.imageOpfsPath` só se `lyricsBgMode==='image'`,
senão `null`) antes de decidir se resolve/revoga a `object URL` — o resto da
lógica (cache por chave, guarda de sequência) não muda. `setLyricsBgMode(m)`
troca o modo ao vivo e reaplica no slide atual (`applyLyricsImage`) sem
precisar esperar uma troca de estrofe. Persistido em `state.lyricsBg`
(lido no `restore()` do Display e no `load()` do Controle) e propagado ao
vivo pelo comando `lyricsbg` — mesmo padrão de `fade`/`fit`, mas tratado à
parte de `stage.handle()` (letra é camada paralela, não um comando do
stage). A preview aplica o mesmo modo em si mesma via `applyPvLyricsBg()`
(chamado direto em `cmd()`, sem esperar o Display confirmar nada).

**Moldura só no modo imagem**: o fundo semitransparente da caixa
(`.lyrics-box`/`.pv-lyrics-box`) só existe para dar contraste/legibilidade
contra uma imagem de fundo de verdade — no modo preto puro seria só uma
zona escura flutuando à toa sobre uma tela já preta, sem função nenhuma.
`applyLyricsBgClass()` (Display) / `applyPvLyricsBgClass()` (Controle)
ligam a classe `.imgbg` em `.lyrics-content`/`.pv-lyrics-content` só quando
o modo é `'image'` — o `background` de `.lyrics-box`/`.pv-lyrics-box`
fica `transparent` por padrão e só recebe `--lyrics-frame-bg` via
`.lyrics-content.imgbg .lyrics-box`/`.pv-lyrics-content.imgbg .pv-lyrics-box`.
Chamado em `setLyricsBgMode()`/`restore()` (Display) e em
`showPvLyrics()`/`applyPvLyricsBg()` (Controle) — cobre tanto a troca ao
vivo do botão quanto o estado inicial ao abrir um item já com o modo salvo.

**Preview do Controle (mesma visualização, em miniatura)**: a preview
**sempre espelha o telão** — já vale pra imagem/vídeo (via `stage.js`
compartilhado) e pra YouTube (segundo player, ver seção própria); letra
sincronizada segue o mesmo princípio universal do sistema. `#pvLyrics`
dentro de `#preview` reproduz a mesma estrutura visual do Display (fundo +
faixa central) com **exatamente os mesmos números**, porque são unidades de
container (`cq*`) e não `vw`/`vh`: relativas ao próprio container, elas são
invariantes de escala e dão a mesma composição na caixinha da preview e no
telão (ver "Redimensionamento por Container Queries" abaixo). O que continua
duplicado é a **folha** — as regras `.pv-*` existem à parte porque o container
é outro —, no mesmo padrão da preview do YouTube.
`showPvLyrics`/`hidePvLyrics`/
`renderPvLyricSlide`/`updatePvLyricSlide` espelham exatamente as funções do
Display, chamadas nos mesmos pontos: `cmd()` (`load`/`stop`/`clear`, em vez
do tratamento de comando do Display) e `previewTick()` (em vez do
`sendStatus()`). Não existe mais uma legenda de texto solta na
`.nowplaying` (`#npLyric`, removida) — a miniatura visual da preview já
mostra a composição real (fundo + posição do texto), tornando a legenda
redundante.

**Controle**: a navegação manual de estrofe é o par de botões que flanqueia a
preview (`#slidePrevBtn`/`#slideNextBtn`, ver "Os dois botões de slide") — o
ponto único de estado e execução, também para a tela cheia e a notificação, que
os acionam por `.click()`. `stepSlide(delta)` reaproveita o
**comando `seek` já existente** (sem novo tipo no protocolo) — pula pro
`time` do slide vizinho, e tanto o Display quanto a própria preview
sincronizam a letra sozinhos ao reagir ao novo tempo.

**Moldura de tamanho FIXO** (`.lyrics-box`/`.pv-lyrics-box`): a caixa não
cresce/encolhe conforme o texto do slide muda — `width`/`height` fixos (não
`max-width` + altura intrínseca), hoje **84cqw × 40cqh**, para a moldura não
pular de tamanho entre uma estrofe e a seguinte.

**E A LETRA NUNCA É CORTADA COM RETICÊNCIAS** (v1.1.8), em nenhum tamanho de
tela. Cortar é a única resposta que um telão não pode dar: o verso que some é o
que a congregação ia cantar, e ninguém no salão tem como saber que faltou. Eram
duas causas somadas — a caixa fora calibrada com a estrofe de DUAS linhas em
mente (76cqw × 32cqh), e o que garantia o encaixe era um `-webkit-line-clamp: 2`
na `.lyrics-line`.

O clamp SAIU. Quem garante que cabe é **`ajustarLetra()`** (`display.js`) e o
espelho dele **`pvAjustarLetra()`** (`controle.js`): medem a altura das peças
visíveis contra a altura útil da caixa e ENCOLHEM o conjunto até caber, por
**busca binária** (sete passadas; um laço decrescente custaria de 1 a 30
releituras de layout, e o pior caso cairia justamente na estrofe mais longa).

- **O que encolhe é a ESCALA DO CONJUNTO** (`--lyrics-escala`, multiplicando
  todas as fontes da caixa), não o corpo de uma peça: encolher só a estrofe
  faria o "Refrão" ficar maior que ela. As proporções calibradas (linha 8cqmin,
  rótulo 4,2, número 5,8) são o desenho e ficam.
- **O caso comum sai sem nenhuma passada**: a estrofe de duas linhas cabe em
  escala 1, e a função retorna na primeira medição.
- **Há um PISO** (`ESCALA_MIN`, 0,34): abaixo dele não se lê do fundo do salão.
  Uma estrofe absurda encosta nele e o `overflow: hidden` da caixa contém o
  resto — é a única saída em que ainda se corta, e ela é ordens de grandeza mais
  rara que o clamp de duas linhas.
- **`ResizeObserver` na caixa**: a tela muda de tamanho sem o slide mudar (o
  dongle entra, a TV troca de resolução, a preview entra em tela cheia). Sem ele
  a escala medida para a caixa anterior ficaria de pé.
- **MEDIDO** em 1280×720, 1920×1080, 960×540 e 800×1280 (retrato), com estrofes
  de 2, 4 e 8 linhas: nenhum corte em nenhum par. A escala depende do TEXTO e
  não da tela (é o que as unidades `cq*` garantem) — 0,69 para quatro linhas e
  0,41 para oito, iguais nas quatro resoluções.

**Redimensionamento por Container Queries (`cq*`), não `vh`/`vw`**:
`.lyrics-content` (Display) e `.pv-lyrics-content` (preview) são
`container-type: size` — tudo dentro deles (moldura, fonte, padding, gap)
usa unidades `cqw`/`cqh`/`cqmin` (relativas ao TAMANHO DO PRÓPRIO
CONTAINER, não ao viewport). Isso resolve dois problemas que a versão
anterior (`vh`/`vw` + pisos/tetos em `rem`/`px`) tinha:
- **Descompasso em telas pequenas**: um piso de fonte em `rem` fixo parava
  de encolher enquanto a caixa (só em `vh`) continuava encolhendo — a fonte
  acabava maior que a caixa, cortando/bugando o texto. Unidades `cq*` puras
  não têm piso/teto absoluto — tudo escala junto, sempre, em qualquer
  tamanho de tela.
- **Fonte grande demais em proporção estreita**: a fonte usa `cqmin` (o
  menor entre a largura e a altura do container — análogo ao `vmin`, mas
  relativo ao container), não `cqh` puro. Só `cqh` cresce com a altura
  mesmo quando a largura é o fator mais apertado (ex: janela redimensionada
  em modo retrato) — a própria linha de texto (não a quebra intencional)
  deixava de caber na largura, e o que era uma linha virava duas. `cqmin`
  encolhe a fonte junto com a dimensão mais apertada, sempre — e hoje isso
  poupa trabalho da escala (`ajustarLetra()`), em vez de evitar um corte: com
  `cqh` puro a estrofe continuaria cabendo, só que num corpo menor do que
  precisaria ser.
- **Padding do container NUNCA é em `cq*`** — e o motivo é mais forte do que
  parecia. Unidades de container escritas NO PRÓPRIO container **não se
  referem a ele**: resolvem contra o ancestral mais próximo que seja container
  e, não havendo nenhum, contra o **viewport**. No Display isso passa
  despercebido (o container preenche o viewport, então os números coincidem);
  na preview do Controle é destrutivo — a caixa tem ~130px de altura dentro de
  uma tela de ~980px, então `7cqh` virava 7% da TELA DO CELULAR, ou seja
  ~137px de padding vertical numa caixa de 128px. O content-box colapsava para
  zero e, com ele, a fonte (que é `cqmin` do container). **Era essa a causa
  real de o versículo aparecer espremido e cortado na preview.**
  A regra era seguida por `.lyrics-content`/`.pv-lyrics-content` mas estava
  violada por `.text-content`/`.pv-text-content`; hoje as quatro seguem o
  mesmo modelo: o container não tem padding percentual, a CAIXA é fração dele
  (`84cqw`/`40cqh` na letra, `86cqw`/`86cqh` no texto) e o que sobra vira
  margem sozinho via `align-items`/`justify-content: center`.

**Proporções calibradas por medição em pixel** de um vídeo de louvor de
referência (moldura ~76-80% da largura da tela / ~27-36% da altura; fonte da
letra com cap-height ~8,3% da altura da tela). Valores atuais: `.lyrics-line`
em `8cqmin`, `.lyrics-aux` em `4.2cqmin`, capa em `8.4cqmin`, caixa **fixa**
em `84cqw`/`40cqh` — todas multiplicadas por `--lyrics-escala`, que a
`ajustarLetra()` escreve. **A preview usa EXATAMENTE os mesmos números**
(ver "Proporção da preview" abaixo): `cq*` é relativo ao container, portanto
invariante de escala — com a mesma proporção, os mesmos valores dão a mesma
composição numa caixa de 280px e num telão de 3120px. A preview já teve
valores próprios (`9.3cqmin`, `92cqw`/`60cqh`…), que eram compensação
empírica para a proporção errada, não uma necessidade. O `overflow: hidden`
do `.lyrics-box`/`.pv-lyrics-box` FICA, mas mudou de papel: não é mais a
garantia de encaixe (essa é a escala) e sim a contenção do caso em que a
escala encosta no piso — ali a estrofe vaza para fora da moldura em vez de
por cima da imagem. **O `-webkit-line-clamp` da estrofe SAIU** (v1.1.8); o
único que sobrou é o de TRÊS linhas do título na CAPA, que é outro problema:
lá o texto é um nome próprio que ninguém canta junto.

**Fundo preto sem ícone de "imagem quebrada"**: no modo preto (padrão), a
`<img>` de fundo (`#lyricsImg`/`#pvLyricsImg`) fica **`hidden`** de
propósito, em vez de só sem `src`. Isso sozinho **não bastava**: o seletor
`.lyrics-bg img`/`.pv-lyrics-bg img` (uma classe + um tipo, mais específico
que a regra `[hidden] { display:none }` da folha de estilo padrão do
navegador) vencia e mantinha `display:block` mesmo com o atributo `hidden`
ligado pelo JS — a `<img>` sem `src` continuava renderizando o ícone/borda
padrão de "imagem quebrada" (aparecia como uma linha branca de margem sobre
o preto), no Display e às vezes na preview. A correção precisa de uma regra
própria com especificidade suficiente: `.lyrics-bg img[hidden] { display:
none; }` / `.pv-lyrics-bg img[hidden] { display: none; }`. `.lyrics-bg`/
`.pv-lyrics-bg` têm `background: var(--stage-bg)` próprio (o preto de
verdade do palco, independente da `<img>`);
`applyLyricsImage`/`applyPvLyricsImage` alternam
`hidden` junto com `src` a cada troca de modo/slide. As duas folhas ganharam
`[hidden] { display: none !important }` no topo, o que torna essas regras
específicas redundantes — mas elas ficam, porque a regra genérica é a proteção
de fundo e a específica documenta o caso concreto que já falhou.

### Compartilhamento

Compartilhar mídia com o app cai direto no **Cronograma**. Quem recebe é o
`intent-filter` nativo (`ShareIntake.kt`), que entrega o share à ponte no
formato `{ files:[{name,type,url}], url, title }` — as URLs são servíveis
(`/saf/<token>`), nunca bytes. Do lado web, `checkPendingShare()` processa no
init (e `window.__avShareArrived()` empurra na hora quando o app já está
aberto):

> Isto substituiu o **Web Share Target** do modelo de PWA: o
> `manifest.json` do Controle declarava `share_target` (POST multipart em
> `share-target`, arquivos no campo `media`), o service worker interceptava o
> POST, gravava `pending-share` no IDB e redirecionava para o app. O formato
> do share e todo o processamento abaixo continuam idênticos — só a entrega
> mudou. (A leitura remanescente da chave `pending-share` no IDB, que nada
> escrevia desde a v5.48, saiu na limpeza da auditoria de agosto/2026.)

- **Arquivos** → importados como `addMedia` (com thumbnail).
- **URL do YouTube** (youtu.be, youtube.com — `watch?v=`, `/shorts/`, `/live/`,
  `/embed/`, `/v/`; ID de 11 chars validado) → `addUrlMedia` com
  `kind:'youtube'`, `youtubeId` e thumb `hqdefault.jpg` — cai direto no
  **Cronograma** (`imports`), pronto para tocar.
- **Outras URLs** → `kind` detectado pela extensão (`video`/`audio`/`image`/`url`).

#### O LINK COPIADO — a mesma folha, precedida de uma pergunta (v1.1.8)

`conferirLinkCopiado()` roda na ABERTURA e em toda RETOMADA
(`visibilitychange`), e no navegador é no-op — `navigator.clipboard.readText()`
pede permissão e exige gesto, que é o oposto do que este caminho quer ser.

**COPIAR NÃO É UM PEDIDO.** Um share é um ato dirigido a este app; um link na
área de transferência pode estar ali por qualquer razão. Daí a PERGUNTA antes:
só o "sim" entrega o link ao `importShare`, que dali em diante é literalmente o
mesmo código desta seção. E é a pergunta que torna o recurso seguro no **Modo
Fácil**, onde um link compartilhado é baixado e projetado sem perguntar nada
(era transmissão direta até a v1.7.2).

**O custo é o aviso de área de transferência do Android 12+, e ele é pago uma vez
por link copiado — nunca por retomada.** Quem garante isso é o CARIMBO,
comparado pelo shell ANTES de ler (ver `docs/shell/PONTE.md`,
`areaTransferencia`). Do lado daqui restam três regras:

- **O carimbo do último conteúdo examinado mora no BANCO** (`clip-carimbo`), não
  em memória: o processo morre, o app reabre, e um carimbo perdido faria a mesma
  pergunta com o aviso junto.
- **Texto que não é do YouTube AVANÇA o carimbo do mesmo jeito** — senão ele
  seria relido (e avisado) em toda retomada por um link que nunca vai ser
  oferecido.
- **Um diálogo já na tela ADIA a pergunta, e o carimbo NÃO avança.**
  `openAppDialog` resolve o anterior como cancelado ao abrir o próximo, e o que
  estaria ali é a pergunta da atualização — recusá-la por baixo, sem ninguém ter
  tocado em nada, é o desfecho que a guarda existe para impedir. O carimbo
  intacto é o que garante que a retomada seguinte ainda tem o que perguntar.

#### O que chegou fica NA FRENTE do operador

Um compartilhamento é um pedido explícito e imediato, e o app pode estar em
qualquer lugar quando ele chega. `focarImportado(id)` roda depois de todo import
bem-sucedido:

1. **Sai do que está por cima**, nos dois modos: `exitSelection()` e o fechamento
   de TODOS os popups abertos, percorrendo a MESMA tabela `POPUPS` que o ✕, o
   toque no fundo e o botão voltar já usam — um popup novo entra numa linha e
   passa a ser fechado também por aqui.
2. **A preview em tela cheia só sai quando há TELÃO.** Sem telão ela É a
   projeção, e derrubá-la para mostrar uma lista tiraria do ar o que estiver em
   cena. Caro demais para um import: ali o item espera no Cronograma.
3. Então cada modo faz o que ele quer dizer: **Simplificado → PROJETA na hora**
   (`send(id)`; a lista sequer aparece nele, então "adicionei ao Cronograma" não
   significaria nada); **Avançado → leva para o Cronograma**
   (`switchTab('imports')`) e deixa a decisão de projetar com o operador, que
   pode estar com outra coisa no ar neste exato segundo.

O alvo é o **primeiro** item que entrou (um share pode trazer vários arquivos),
e para isso `addMedia`/`addUrlMedia` — que já devolviam o registro — têm o
retorno aproveitado; `handleSharedUrl` também devolve o seu.

Ciclo ao tocar no botão 🔁: `off → one → all → shuffle → off` (persistido em
`repeat`). **A ordem mudou na v1.8.80**, a pedido do operador — *"para que ele
mostre primeiro repetir a midia atual e depois o repetir a playlist inteira"* —:
o degrau mais pedido vem primeiro, e os dois primeiros toques vão do mais
restrito ao mais amplo (a mídia, a fila, o sorteio). O desenho é pintado ANTES da
transação do banco: num controle que se toca com a música no ar, o que a mão
espera é o botão mudar no toque.

**E OS QUATRO DEGRAUS VIRARAM SVG DO SPRITE** (v1.8.80), três símbolos para
quatro estados:

| modo | desenho | por quê |
|---|---|---|
| `off` | `#icoRepetir` (o laço puro), sem superfície | é o estado base |
| `one` | `#icoRepetir`, com a superfície de LIGADO | *"o icone de repetir a midia atual deve ser o icone de repetir comum, sem adições"* |
| `all` | `#icoRepetirLista` — o MESMO laço mais a lista no miolo | *"deve ter o mesmo design de repetir, mas deve ter algo que ilustre o objeto 'lista'"* |
| `shuffle` | `#icoAleatorio` | entra por coerência: um glifo de tinta cheia ao lado de dois laços de traço é divergência de peso |

**Em SVG porque o "repetir com lista" não existe no subset da fonte** (31
codepoints): pedi-lo por codepoint desenharia um VÃO, sem erro nenhum. `off` e
`one` DIVIDEM o desenho, e é a superfície (`#repeat.active`) que os separa — a
mesma convivência que `off` e `all` já tinham. MEDIDO contra o glifo que os três
substituíram: `#icoRepetir` pinta 0,93× e `#icoAleatorio` 1,03× da tinta dele, e
o `#icoRepetirLista` 1,25× (a lista é o que ele tem a mais).

**O SELETOR RESPONDE PELO FIM DA FILA, NÃO POR ELA ANDAR** (v1.8.77). Até aquele
lote `off` era o primeiro `return` do `autoAdvance` — o fim de QUALQUER faixa era
fim de cena —, e com isso a única forma de ouvir uma sequência era armar `all`,
que é outra coisa: aquele RECOMEÇA no fim. Relato do operador: *"é normal o
seletor estar desativado, tocar uma playlist automática, mas ele tocar apenas a
primeira e parar, pois o usuário esquece de ativar o automático"*. Quem monta uma
playlist já disse, ao montá-la, o que quer; pedir um segundo gesto para isso é
cobrar duas vezes pela mesma intenção.

| Modo | Comportamento ao fim do item |
|---|---|
| `off` | Avança para o próximo da fila e **para na última** (`resetAfterEnd`); `currentId` permanece para replay manual |
| `all` | Avança para o próximo; ao fim da lista **volta ao início** |
| `one` | Recarrega e reproduz o mesmo item |
| `shuffle` | Avança para item aleatório (nunca repete o atual) |

**A cena que não está na fila não tem "próximo".** Com `idx === -1` — um share
projetado na hora, um item que voltou da prateleira `avulsos` — o `off` encerra a
cena, enquanto o `all` começa a fila pelo topo. A diferença é o que a congregação
vê: abrir um bloco de louvores que ninguém mandou tocar.

**TROCAR A FILA ZERA O SELETOR** (`trocarFila`, v1.8.77) — pedido do operador:
*"ao se tocar um item, seja do cronograma ou o que for, resete o estado do
seletor de repetição… que reflitam a intenção do usuário e não um resquício de
uma opção da mídia passada"*. A pergunta é **"a fila foi REDEFINIDA?"**, e por
isso a zeragem mora no funil e não em cada porta: as três chamadas de
`AVDB.listSet('playlist', …)` com um ARRAY passam por ele — o item avulso
(`replacePlaylistWith`), o pacote (`abrirPacote`) e a playlist automática
(`montarFilaSorteada`). Tocar numa linha da fila EXISTENTE não passa: escolher por
onde começar não desfaz a sequência. O quarto chamador é o `zerarRepeticao`
sozinho, no share do **Modo Fácil** — o único caminho que projeta sem redefinir
fila, e o mais exposto, porque ali `body.mode-simple` esconde a caixa de
controles inteira e um modo herdado não teria por onde ser desfeito.

> **O que isto revoga:** até aqui só o `repeat='one'` caía, sob o argumento de
> que `all`/`shuffle` "são comportamentos da FILA e voltam a valer quando o
> operador acrescentar itens a ela". MEDIDO, o argumento não se sustentava no
> caso dominante: `replacePlaylistWith` deixa a fila com UM item, e sobre uma
> fila de um os dois VIRAM `one` — `all` faz `(0 + 1) % 1 === 0` e o `shuffle`
> tem o ramo `length === 1`. A mídia recém-escolhida tocava em laço, que é
> literalmente o defeito que a queda do `one` existia para evitar.

---

### O contrato do `shouldInterceptRequest` (a invariante 8)

> **O CLIENTE DESTE PROXY ERA A TRANSMISSÃO DIRETA, e ela saiu do lado web na
> v1.8.82.** A regra abaixo NÃO saiu com ela: ela vale para **toda** resposta
> interceptada, e é a próxima coisa deste app que sirva bytes por faixa que vai
> pagá-la de novo. O `StreamProxy.kt` continua no shell, sem quem o chame — ver
> `docs/shell/SEGUNDO-PLANO.md`.

**O `InputStream` devolvido não é "a resposta": o Chromium o lê como o recurso
INTEIRO a partir do byte 0, e é ELE quem aplica o `Range`** — incondicionalmente,
para toda resposta interceptada. A cadeia, na fonte:

```
AndroidStreamReaderURLLoader::Start           → ParseRange(resource_request_.headers)  ← incondicional
AndroidStreamReaderURLLoader::OnInputStreamOpened → InputStreamReader::Seek(byte_range_)
InputStreamReader::Seek                       → VerifyRequestedRange + SkipToRequestedRange
net::HttpByteRange::ComputeBounds             → confere contra InputStream.available()
```

Devolver só a fatia pedida aplica o deslocamento **duas vezes**:

| faixa pedida | o que acontece |
|---|---|
| `bytes=0-…` | pular 0 é no-op → **funciona**, e esconde o resto atrás de si |
| `A ≥ tamanho da fatia` | `ComputeBounds` reprova → `ERR_FAILED` **antes de qualquer cabeçalho** |
| `A < tamanho da fatia` | pula `A` DENTRO da fatia e entrega o offset absoluto `2A` — o `fetch` RESOLVE e o vídeo não toca |

Como todo fragmento de mídia começa a megabytes do início, **só a primeira
requisição de cada faixa podia funcionar**.

**A correção é sair do contrato, não emulá-lo.** Do shell 27 em diante o
cliente pede `/stream/<token>?r=<ini>-<fim>` **sem cabeçalho `Range`
nenhum**: sem cabeçalho, `ParseRange` não acha nada, o seek não acontece, e a
fatia chega inteira. A resposta é um **200 seco** — sem 206, sem
`Content-Range`, sem `Accept-Ranges`, e sem `Content-Length` nosso (o loader
escreve o dele a partir do `available()`).

- **`FatiaComoTodo`** atende o ramo do cabeçalho (bundle antigo em shell novo):
  soma o prefixo que não existe no `available()`, absorve o primeiro `skip` e
  zera o fantasma na primeira leitura real — a maquinaria do WebView produz o
  resultado certo, e se um dia ela deixar de refatiar, a fatia sai crua e
  correta.
- **Erro precisa de corpo NÃO VAZIO.** Com `available() == 0` e faixa fora do
  zero, `ComputeBounds` reprova e a resposta inteira vira erro de rede sem
  status: **toda a tabela de mensagens abaixo é indeliverável** para qualquer
  requisição que não seja a primeira.
- **E a razão é saneada para ASCII:** `WebResourceResponse` lança
  `IllegalArgumentException` para qualquer caractere fora de `0x20..0x7E` —
  `IOException("pedaço acima de 24 MB")` tem cedilha, e estourar o teto produzia
  uma segunda exceção de dentro do `catch` em vez de um 502 legível.
- **O teto de 24 MB é TRAVA, não economia:** existe para o dia em que alguém
  apontar este proxy para uma faixa aberta e um vídeo inteiro tentar caber na
  memória do processo que hospeda os dois WebViews e a `Presentation`. O custo
  normal é a memória de UM pedaço (init: centenas de bytes; índice: poucos kB;
  um fragmento por vez).

`tools/webview-range.test.mjs` **transcreve** a regra do Chromium (com
`arquivo:função` de cada trecho) e roda os dois modelos de `InputStream` contra
ela, sobre um recurso em que o byte `i` vale `i % 251` — primo de propósito: um
deslocamento errado sai como **bytes errados**, não como tamanho errado, que é o
único jeito de enxergar a corrupção silenciosa do terceiro ramo. Se o Chromium
mudar essa regra, o lugar de descobrir é o CI, não o culto.

> **O caminho FELIZ não é testável aqui** (exige um fMP4 de verdade, e não há
> ffmpeg no ambiente). O que se trava é a REGRA, e o `webview-range` a prova.
> O oráculo que media o FIO (a faixa na URL, sem cabeçalho) era do player do lado
> web, e saiu com ele na v1.8.82.

#### O pôster padrão do WebView

Um `<video>` sem `poster` é pintado pelo WebView com **um retângulo cinza e um
play preto gigante** (contrato de `WebChromeClient.getDefaultVideoPoster`) — não
há como estilizá-lo, só como deixar de pedi-lo. O `stage.js` esconde o elemento
enquanto não há `src`, e o pôster cobre a outra metade: a janela entre a fonte
atribuída e o primeiro quadro. A correção é `POSTER_VAZIO` (1×1 transparente),
posto a cada `load` e removido no `loadeddata`:

- **transparente e não preto** — as camadas já pintam `--stage-bg`, e um segundo
  "qual preto" divergiria da paleta;
- **removido no primeiro quadro** porque o *show poster flag* do HTML continua
  LIGADO num vídeo pausado que ainda não tocou.

#### As mensagens de falha SÃO o produto

A regra vale para todo caminho de rede deste app: ele roda no aparelho do
operador, num WebView, e **não há como depurar de fora** — a única coisa que
atravessa essa distância é a linha do Registro, e ela só serve se disser em que
passo morreu e com que resposta.

O que o `StreamProxy` responde (KOTLIN; sem cliente no web desde a v1.8.82):

| Resposta | Significa |
|---|---|
| `404 (token desconhecido)` | o proxy foi alcançado e não achou o token |
| `502 (<texto da exceção>)` | o proxy falhou falando com o CDN |
| `403 (googlevideo: Forbidden)` | o CDN recusou — o proxy chegou lá |
| `404` **sem** razão | o proxy NEM foi consultado (respondeu o asset loader) |

Regras que sustentam isso:

- **`diagnostico` e `diagnosticoStream` são campos SEPARADOS.** `buscar()` começa
  com `diagnostico = resumo(info)`, e como a desistência da transmissão é
  justamente o que dispara o download, o motivo durava até a linha seguinte.
- **`porQueNaoDash` conta, por tipo de faixa, quantas passam em CADA
  pré-requisito** — `vídeo mp4 6 (init 6 · índice 0 · codec 6)`. "Não deu" não
  leva a lugar nenhum; essa linha responde de uma vez se o problema é o YouTube
  não mandar os byte-ranges, a biblioteca não preencher o codec, ou não haver
  faixa mp4.
- **`Faixa.dash` exige init + índice, e NÃO tamanho.** O `contentLength` do
  `ItagItem` nasce em `-1` quando o YouTube não informa, e quem diz onde cada
  fragmento começa é o `sidx` — a transmissão inteira já foi barrada por um campo
  que o player nem usa.
- **Codec recusado imprime as STRINGS testadas** (`video/mp4; codecs="avc1.640028"`)
  e o veredito de cada uma.
- **`PAUSA ESPONTÂNEA` não é vídeo travando**: um `<video>` sem dados emite
  `waiting`, não `pause`. O que emite `pause` é o `video.pause()` no topo do
  `load()` — isto é, mídia NOVA entrando.

### Séries do YouTube — coleções que NÃO vêm do LouvorJA (v5.228)

> **O "VÍDEO DA SEMANA" COMO ITEM (v1.13.13).** O topo do card aberto de uma
> série é a linha "Vídeo da semana (sempre o atual)" (`semanaLinha`, antes do
> destaque, no avançado — no Modo Fácil o item mora na raiz, no bloco "Este sábado",
> e o toque toca, v1.13.15), cuja gaveta põe um item VIRTUAL (`kind: 'semana'`)
> no Cronograma, na playlist ou nos Favoritos. O `send` o resolve antes do `load`
> (`resolverSemana`) e a fila o reconhece pela âncora (`ancoraDaFila`). O detalhe
> está em `docs/recursos/SERIES.md`, "O vídeo da semana como ITEM".

Uma **série** é um canal do YouTube que publica um episódio por semana e
organiza o ano em playlists por período. Ela vira um card da Biblioteca ao lado
dos hinários e dos álbuns, e usa a mesma casca: `collState`, `medirColecao`,
barra de peso, `syncCollection`.

**Há duas no catálogo** (v5.244): o **Provai e Vede 2026**
(`@provaievedeoficial`) e o **Informativo Mundial das Missões 2026**
(`@daniellocutor`). A segunda entrou com uma linha no catálogo e nenhum `if` por
recurso — mas ela **desmentiu três suposições** que só pareciam regras porque
havia uma série só, e as três viraram campo declarado:

| Campo | Provai e Vede | Informativo | Por quê |
|---|---|---|---|
| `periodo` | `mes` — "Provai e Vede - Agosto 2026" | `trimestre` — "Informativo \| 3º Trimestre 2026" | `mesDaPlaylist` devolve o mês em que o PERÍODO começa: ele ordena as playlists e é o PISO de quem não declarar data. Quem dá o mês de cada item é sempre a data do TÍTULO |
| `titulo` | `esquerda` — "Match point \| Provai e Vede 2026 (15/Ago)" | `nenhum` — "Informativo Mundial das Missões \| 15 AGOSTO 2026" | no segundo o título é a série + a data, e a história ("O Sonho de Enoc") vive na MINIATURA. Aplicar o padrão daria 52 linhas idênticas, que é o defeito que o padrão existe para corrigir — ao contrário |
| `futuros` | `esconder` (v1.4.15 — era `mostrar`, sobre uma medição que o campo desmentiu) | `esconder` — o canal sobe o trimestre e libera um sábado por vez | os que faltam ficam como "prioridade para membros": aparecem e não tocam. Corte pela DATA, e a janela é a **semana corrente** (v1.2.19 — o episódio deste sábado nunca é escondido, e é `ehDoSabadoAtual` quem responde), a semana é a régua INTEIRA desde a v1.4.16 (o piso de 3 dias da v5.256 saiu: MEDIDO, ele nunca decidiu nada para um episódio de sábado, e só podia mostrar um da semana seguinte antes da hora); sem data no título, nunca esconde |
| (nenhum) | — | — | o **idioma** virou recusa GLOBAL, não campo: ver `ehOutroIdioma` abaixo |

**O canal do Informativo publica a MESMA série em quatro idiomas**, lado a lado
na aba Playlists: "Informativo \| 3º Trimestre 2026" (PT), "Misiones \| 3º
Trimestre 2026" (ES), "Mission Stories \| 2º Quarter 2026" (EN) e "【聖工消息】
2026 第三季" (ZH). O prefixo separa as **playlists** — e não separa os **vídeos**:
em espanhol eles se chamam "Informativo Mundial **de las Misiones**", isto é,
começam com a mesma palavra. Daí `ehOutroIdioma`, irmão do `ehLibras`, aplicado
nos dois níveis: pela ESCRITA (cirílico, hebraico, árabe, tailandês, CJK,
hangul — um caractere basta, porque "【聖工消息】" não tem sílaba que dê para
procurar) e por MARCA (`misiones`/`mision`, `de las`, `missions?`), tudo contra
o `normalizar`. **É a exceção declarada à regra de ouro** ("o título é só
rótulo"): o erro que ela evita não é recuperável no sábado de manhã — é o
testemunho projetado em espanhol na frente da congregação.

> **O ÁUDIO em português é outra pergunta, e ela é do shell.** O YouTube dubla
> vídeo sozinho, e a dublagem não muda o título: ela é uma faixa a mais dentro
> do MESMO vídeo. Quem escolhe é `TrilhaAudio.kt` (v5.242), que decide pelo
> idioma **antes** do cliente e torna o português exclusivo quando ele existe.
> Nada do lado web tem como ver isso, e por isso nada aqui tenta.

**Mas o ITEM não é uma faixa de hinário — é um vídeo do YouTube** (v5.230). A
casca veio do LouvorJA e trouxe junto a premissa dele, "o toque baixa", que ali
está certa (poucos MB, e o acervo existe para ficar offline) e aqui é falsa por
duas ordens de grandeza: ~300 MB por episódio, ~15 GB no ano, e o vídeo do
sábado é visto uma vez. Então:

| O que | Onde | Como |
|---|---|---|
| toque no item | `openSongMenu` → `openYtMenu(serieComoYoutube(coll, s))` | a folha do YouTube, com `semSoAudio: true` (o seletor Vídeo × Só áudio some) |
| "Tocar agora" | `ytAcao(…, ['tocar'])` | **BAIXA e projeta** — `ytArquivo`, no teto padrão do operador (720p). Era TRANSMISSÃO DIRETA até a v1.7.2 |
| Modo Fácil | `simplePlaySong` desvia para o mesmo `ytAcao` | aquele modo não pergunta nada, e esperar 300 MB com o culto rodando não é opção |
| guardar offline | os destinos da folha (playlist · Cronograma · Favoritos) | um episódio por vez, pelo caminho de download do YouTube |
| card | `renderCollectionCard` | **card da RAIZ** do índice (v1.0.1), acima dos hinários. **NENHUM botão na barra** desde a v1.12.53 (o "Atualizar a lista" da v1.1.21 saiu): abrir o card verifica a semana (`verificarSemanaAoAbrir`) — sem baixar em lote e sem lixeira, porque o álbum não retém arquivo. A barra diz quantos EPISÓDIOS a lista tem, não peso, e o do sábado desta semana fica DESTACADO no topo (`blocoDestaque`). A série sai de "Baixar toda a biblioteca" |

`downloadSerieItem` e o laço de `syncCollection` continuam existindo e corretos
— o que mudou é que nenhum toque de UI os alcança hoje. O que muda em relação a
uma coleção do LouvorJA é **de onde vem o índice e de onde vêm os bytes**.

| Peça | Onde | O quê |
|---|---|---|
| catálogo + REGRA | `controle/serie.js` (`window.AVSerie`) | **PURO**: sem DOM, sem rede, sem conhecer o `controle.js`. Decide quais playlists do canal são da série, recusa as de LIBRAS, extrai a data do título e ordena. Oráculo: `tools/serie.test.mjs` |
| descoberta | `AVNative.ytCanalPlaylists(canal)` | a **aba Playlists** do canal — `[{name,url,count}]` |
| expansão | `AVNative.ytPlaylist(url)` | os vídeos de uma playlist, com o título **CRU** |
| índice | `fetchSerieIndex` (controle.js) | monta `collState[id].songs` com `{ id_music, name, ytUrl, duration }` |
| download | `downloadSerieItem` (controle.js) | `ytFetch` → OPFS → `fileAdd` com `folder: coll.id`, `kind: 'video'` |

**Três pontos de integração que não são óbvios:**

- **`duration` é uma STRING "M:SS"**, e não segundos. É a forma que o LouvorJA
  publica, e adotá-la faz `parseTimeToSeconds`, `medirColecao`, `fracaoPeso` e a
  estimativa de download valerem sem uma linha nova.
- **`has_instrumental_music: false`, sempre.** Um vídeo não tem Playback; sem
  isso o `songVariantsNeeded` pediria uma segunda variante que nunca vai existir
  e o álbum jamais ficaria completo.
- **`lyrics: null` no registro.** `songVariantsNeeded` pergunta
  `fullRec.lyrics === undefined`: um registro sem o campo seria rebaixado a cada
  sincronização, para sempre, sem nada na tela que o explicasse.

**A mutação do índice é IN-PLACE**, pela mesma razão do `fetchCollectionIndex`
do LouvorJA: o `syncCollection` tira um snapshot do array e grava `fileIdFull`
nos objetos DELE conforme baixa. Recriar os objetos deixaria o snapshot
apontando para órfãos — os bytes iriam para o OPFS e os ids seriam descartados
no `setState` seguinte.

**O REGISTRO conta o que a varredura achou** (v5.249). O bloco "Séries do
YouTube (o que a regra achou)", no Registro de Configurações, traz por série os
parâmetros do catálogo, cada playlist da aba do canal com o VEREDITO (aceita,
com o mês do período; ou recusada, com o motivo), cada vídeo recusado, os que
entraram SEM data no título — o achado que não é recusa — e os nomes
resultantes, um por linha. Os nomes vão CRUS: o consumidor é quem ajusta a
regra, a distância — e a primeira varredura real já provou o ponto: ela achou um
episódio em português recusado pelo marcador de inglês (v5.252).

Dois recortes que os números reais impuseram: os canais têm **94 e 145**
playlists, então some da lista o que traz OUTRO ano no nome (contado por motivo,
nunca em silêncio) — um mês do ano corrente renomeado continua aparecendo, que é
o defeito que o bloco existe para achar; e a linha dos vídeos compara o que veio
com o que o canal **anuncia**, porque um episódio que a extração não traz não
erra em lugar nenhum: ele só não existe na lista.

A peça que o torna confiável é `AVSerie.avaliarPlaylist`/`avaliarVideo`: o
motivo sai de quem DECIDE, e `mesDaPlaylist`/`itensDaPlaylist` são consumidores
das mesmas funções. Um diagnóstico que reexplica por conta própria diverge no
primeiro ajuste. A ordem das perguntas virou contrato porque é ela que o texto
mostra; e as duas metades (aba do canal × varredura dos vídeos) trazem datas
próprias, porque a assinatura pula a extração e só uma delas é de agora.

**O preço da antecedência tem remédio** (v5.256): entre o domingo que abre a
semana e o sábado do episódio, o vídeo pode ainda não estar público. `serieComoYoutube` anexa `avisoSeFalhar` (e o card da
série como endereço) enquanto `AVSerie.diasAte(...) > 0`, e o caminho de falha do
`ytAcao` a usa no lugar de "não foi possível baixar" — em dois lugares, porque
"Tocar agora" fecha a Biblioteca e os destinos que guardam não.

**A lista do Informativo é função do DIA** (v5.255), e isso entra em dois
lugares: `indiceVencido` vence o índice na virada do dia (só nas séries com
`futuros: 'esconder'`) e o dia entra na **assinatura** das playlists. Sem o
segundo, a economia devolveria a lista de ontem — sem o episódio de hoje —
carimbada como de hoje, que é o sintoma da v5.233 por outra porta.

**E O ÍNDICE É PROCURADO ENQUANTO FALTAR O EPISÓDIO DESTA SEMANA** (v1.2.22,
`serieTemODaSemana` no `indiceVencido`). Vale para **as duas séries**, e é o que
resgata o Provai e Vede — ele não tem a regra do dia acima, então só o TTL de
12 h o reconferia, e um vídeo publicado na manhã de sábado podia não estar na
lista do culto daquele mesmo sábado.

| guarda | por quê |
|---|---|
| responde `AVSerie.ehDoSabadoAtual` | é a MESMA função do bloco de destaque — uma segunda conta de calendário divergiria dela, que é o defeito da v1.2.19 |
| piso de `SERIE_PROCURA_MIN_MS` (30 min) | `autoRefreshCollections` roda também no `visibilitychange`, e são dezenas de voltas ao app por culto |
| `serieProcuraDaAbertura` | a PRIMEIRA passada da sessão ignora o piso: "quando o app é aberto" é o pedido, e uma carga de página é rara. Desarmada no `autoRefreshCollections`, nunca dentro do predicado |
| `c.serie.ano === ano corrente` | em 2027 nenhum episódio do álbum de 2026 é "o desta semana"; sem ela, um álbum antigo na Biblioteca seria procurado para sempre |

Ela **se desarma sozinha**: achado o episódio, a série volta a custar zero
requisição até o TTL ou a virada da semana. Custa uma extração da aba do canal
por procura — as ~12 das playlists continuam puladas pela assinatura enquanto a
contagem não mudar. **Nada aqui baixa vídeo:** quem roda é `fetchSerieIndex`.
O preço declarado é o episódio publicado SEM data no título: ele nunca satisfaz
a pergunta, e a série segue sendo procurada de meia em meia hora — o conserto
é a leitura da data, e o Registro já o nomeia (`! entrou SEM data`).

**O índice falha com EXCEÇÃO, nunca com lista vazia.** Quem chama já trata isso
como "sem internet — falha ao atualizar" e preserva o índice anterior; devolver
zero itens apagaria da tela a série inteira que o operador já tem baixada, por
uma oscilação de rede.

**A DATA tem DUAS formas, e o mesmo episódio usa as duas** (v5.230): a compacta
entre parênteses ("… 2026 (03/Jan)") e a por extenso ("… 2026 sábado 3
janeiro"). `dataDoVideo` tenta as duas nessa ordem, e `montarData` exige que o
nome **seja** um mês em vez de só começar como um — sem isso "3 marcos" viraria
3 de março. Quando nenhuma casa, o vídeo **entra do mesmo jeito**, sem
identificador de data e no fim do mês: é a regra de ouro em ação, e é o erro
recuperável em vez do episódio ausente.

O Informativo escreve a mesma forma por extenso sem o dia da semana na frente
("15 AGOSTO 2026") — e ela já era lida, sem uma linha nova. **O que ele expôs
foi um defeito de v5.230 que ninguém tinha visto:** o ordinal opcional estava
escrito `[ºo°]?` depois de um `\s*`, então em "03 outubro" ele casava o "o" do
mês como ordinal e entregava "utubro". O regex ACERTAVA — a captura satisfaz
tudo o que ele pede, logo não há retrocesso — e quem recusava era o `montarData`,
lá fora e calado. O `o` do ordinal agora tem de estar **colado no dia** (`3o`), e
a varredura tenta **todos** os candidatos do título em vez de só o primeiro.
Outubro é o único mês que começa com "o", e é o primeiro do 4º trimestre: o mês
inteiro teria entrado sem data e no fim da lista.

O resto — as seis armadilhas de nomenclatura, por que a descoberta é a aba do
canal e não uma busca, e a regra de ouro ("a playlist prova o pertencimento, o
título é só rótulo") — está no topo do `serie.js` e na seção "Séries do YouTube"
do `CLAUDE.md`.

---

---

