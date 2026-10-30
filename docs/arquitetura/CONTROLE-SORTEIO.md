<!-- Parte do capítulo do Controle (o índice das partes está em CONTROLE.md;
     o mapa geral, em docs/ARQUITETURA-WEB.md). Partida do CONTROLE.md na
     revisão A3 (2026-10-30): o texto foi MOVIDO verbatim. -->

## Controle — a playlist automática (o sorteio temático)

> Parte do capítulo do Controle — o índice das partes e as regras que valem
> para o Controle inteiro estão em [`CONTROLE.md`](CONTROLE.md).

**Nesta parte:** [Playlist automática: o sorteio temático](#playlist-automática-o-sorteio-temático-v5303)


### Playlist automática: o sorteio temático (v5.303)

Pedido do operador: *"um sistema de play aleatório temático, tanto para
música/mídia individual ou para montar playlists automáticas … você escolhe uma
palavra tema (que vai fazer a busca na biblioteca sobre palavras-chave e filtrar
a lista) e então aleatoriamente escolhe uma ou mais para tocar."*

Um botão **abre a barra da Biblioteca** (`#sorteioBtn`, à esquerda do campo de
busca) e leva a uma folha com estas decisões (a tabela é a de HOJE; o segmento
do modo virou a roleta da quantidade na v1.8.61/v1.8.96):

| Controle | Pergunta | Valores |
|---|---|---|
| campo | qual tema? | palavra livre — vazio = o acervo inteiro |
| segmento | o quê? | **Cantada** · **Fundo musical** |
| pílulas | de onde? | uma por COLEÇÃO que existe nos dados — **Hinário 2022** · **Hinário 1996** · **Infantis** · uma por coletânea · **Outros álbuns** — e **Só no aparelho** no fim |
| roleta | quantas? | 1 ao teto (`min(50, disponíveis)`) |

#### Os filtros são INCLUSIVOS (v1.12.53)

Pedido do operador: *"agora ela vai ser inclusiva e não exclusiva. Vamos ter o
hinário 2022, hinário 1996, infantis, músicas jovens... com tantas opções, acabo
tendo de dar vários toques para chegar no tipo de música que quero, por exemplo
quando quero só musicas do hinário, hoje preciso selecionar várias exclusões."*

**A regra é uma frase: nada marcado = tudo entra; marcado = a UNIÃO do que está
marcado.** "Sem hinário" e "Sem infantis" saíram; "só o hinário" é UM toque.

- **As categorias PARTICIONAM o acervo de música** (`AVSorteio.categoriasDaFaixa`),
  e é isso que faz a união não ter sobra nem buraco: o Hinário 2022 SEM a faixa
  508–557, os **Infantis** (a faixa — o antigo "Sem infantis" ligado é hoje
  "Hinário 2022" marcado), o Hinário 1996, uma por **coletânea** do banco
  (`col:<id_category>`) e **Outros álbuns** (o álbum que coletânea nenhuma
  reivindica). Um álbum em duas coletâneas (N:N) entra por qualquer uma delas.
- **As coletâneas são as que a Biblioteca DESENHA** — a mesma leitura dissolvida
  (`AVColetanea.aplicar`) e o mesmo filtro (`categoryCards`, que tira o hinário
  disfarçado de álbum); "Outros álbuns" só existe com órfão, como lá
  (`sorteioCategorias`, `sorteioColetaneas`). Duas listas divergiriam no
  primeiro ajuste, e a folha ofereceria uma seção que a Biblioteca não tem. Os
  "músicas jovens" do pedido são uma dessas coletâneas — o nome é o do banco.
- **Coleção sem faixa carregada fica APAGADA** (`disabled`, `--op-inativo`) com o
  motivo no `title` — e não some: uma pílula que aparece quando o índice chega
  moveria as vizinhas debaixo do dedo. A MARCADA nunca se apaga.
- **"Só no aparelho" fica, por último na mesma fileira.** Ele não é coleção:
  estreita o que as marcas trouxeram, e lê como a frase que é ("Hinário 2022 · só
  no aparelho").
- **A fileira QUEBRA** (`.sorteio-linha--cats`): sete ou oito pílulas não cabem
  numa linha de 360px. Cada uma nasce com a largura do rótulo e cresce para
  fechar a linha em que caiu (`flex: 1 1 auto`).
- **As categorias NÃO são gravadas**: a folha as apaga a cada abertura (a regra da
  v1.8.98, que continua de pé com os filtros de hoje), e um campo que ninguém lê
  não fica velho. Um `sorteioPrefs` antigo com `semHinario`/`semInfantis` chega
  como "tudo".
- **A recusa é NOMEADA** (`MOTIVO_CATEGORIA`, "fora das coleções marcadas" no
  Registro), e o Registro diz o que estava marcado (`· só Hinário 2022 + …`).

#### O sorteio do Modo Fácil: um toque, sem folha (v1.12.53)

Pedido do operador: *"Adicionar o botão de sorteio no modo simples, mas bem
simplificado, no caso ele vai sortear apenas músicas do hinário 2022, sem
infantis e sem opções, apenas tocar o botão de sorteio escolhe uma música dessa
categoria, sempre cantada."*

- **ONDE: o quadrado da ESQUERDA da barra da Biblioteca** (`#sorteioSimplesBtn`).
  É o lugar do `#sorteioBtn` no avançado — a mesma porta, no mesmo canto, nos dois
  modos —, e a barra está à vista em TODO estado do Modo Fácil (principal, fechada
  sobre a leitura, aberta sobre ela). O `#sorteioBtn` continua escondido ali
  (`body.mode-simple #sorteioBtn`, v1.11.15): são dois botões, um por modo, e o do
  simples não existe no avançado. Não foi para as teclas do transporte porque
  elas SAEM durante uma busca (v1.12.51) e porque sortear é escolher o que tocar —
  é pergunta da Biblioteca, não do transporte.
- **A REGRA É A DA FOLHA**, com `categorias: ['hinario-2022']` e a cantada
  (`sorteioSimplesPool`): a categoria já exclui os infantis por construção. Uma
  segunda escrita de "é do hinário novo e não é infantil" divergiria dela.
- **O TOQUE É UMA ESCOLHA DA BIBLIOTECA**: `simpleMarcarEscolha` (a escolha sem
  LINHA tocada — `simpleSelecionarLinha` virou um embrulho dela) e
  `simpleAcompanhar(simplePlaySong(coll, s))`, isto é, o mesmo download, o mesmo
  consentimento e a mesma coreografia de saída.
- **UNIFORME, e isto diverge da folha de propósito.** A folha põe o que já está
  no aparelho na frente de tudo; aqui não há lista à vista nem "Só no aparelho"
  para tornar isso explícito, e com três hinos baixados a preferência absoluta
  sortearia sempre um daqueles três. **Sem rede** (`navigator.onLine === false`
  ou o servidor da biblioteca fora) só entra o que está no aparelho.
- **APAGADO, NUNCA INERTE** (`sorteioSimplesImpedimento`): sem o Hinário 2022
  carregado, ou com nada baixado e sem como baixar, o `title` diz por quê.
  Repintado em `setAppMode`, `renderCollectionsNow`, `fonteAoMudar` e nos eventos
  `online`/`offline`; o toque reconfere antes de sortear.
Oráculo: `sorteio-simples.test.mjs`.

#### A REGRA é um arquivo puro, com oráculo

`controle/sorteio.js` (`window.AVSorteio`) decide **o que pode ser sorteado**, e
não faz mais nada: não toca no DOM, não lê o IndexedDB, não baixa e não projeta.
As três capacidades de que precisa chegam INJETADAS em `cap` — e é isso que
impede o defeito mais caro possível aqui: `normalizeForSearch` é o normalizador
ÚNICO da Biblioteca e `lyricMatch` é o casamento por letra da busca, e uma
segunda escrita de qualquer um dos dois faria **o sorteio achar um conjunto e a
busca achar outro para a mesma palavra, na mesma tela** — com os dois parecendo
certos.

O oráculo é `tools/sorteio.test.mjs`, Node puro, no `apk.yml` **sem
`continue-on-error`**: o operador toca UM botão e a faixa entra em cena, sem tela
intermediária e sem ninguém conferir a lista antes.

#### O que entra no pool, e por construção

| Fica de fora | Como |
|---|---|
| **as séries** | `temLetra(coll)` — a pergunta é pela CAPACIDADE, nunca por `kind === 'serie'`. Um episódio são ~300 MB no lugar do louvor |
| **pastas do aparelho e Favoritos** | eles não são coleções, são LISTAS: `allCollections()` não os conhece |
| **faixa sem a variante pedida** | `semAudio` / `has_instrumental_music && !semPlayback` — sem essa guarda a faixa entra, o download não acha URL, e o cartão responde *"sem internet para baixar"*, que é a frase errada |
| **o que não está nas coleções marcadas** | `avaliarColecao`/`avaliarFaixa` com `categorias` (v1.12.53). Nada marcado = nada fica de fora por isto |

#### A palavra é MOMENTÂNEA; os filtros são AJUSTES (v5.308)

A caixa é **limpa a cada fechamento** e a palavra **não é gravada** — gravados
são a variante, o "Só no aparelho" e a quantidade (as coleções marcadas também
não, desde a v1.12.53: a folha as apaga a cada abertura). A
diferença é o que cada uma significa: aquelas são *como o recurso deve se
comportar*, e a palavra é uma *pergunta*, feita uma vez. Reencontrá-la em
fevereiro é um filtro silencioso sobre o primeiro sorteio de quem só queria
abrir e tocar.

A limpeza mora em `fecharSorteio`, e é ali porque essa é a única função que os
**três** caminhos de fechamento alcançam (o ✕, o toque no fundo e o voltar do
aparelho) — é o que a tabela `POPUPS` garante.

**Vazia, a caixa sorteia do acervo INTEIRO** (dentro das coleções marcadas). *(A
frase de escopo que liderava a conta — "Toda a biblioteca, sem o hinário — 18
músicas" — saiu na v1.8.84 com o cartão; o que fica é o número.)*

A **variante** (Cantada × Playback) fica de fora dessa conta de propósito: ela
não encolhe um acervo, escolhe QUAL faixa de cada música — e o segmento logo
acima já a mostra. **O placeholder é só `Palavra tema` desde a v1.8.96**: ele
trazia o parêntese *"(vazio = toda a biblioteca)"*, e o operador o mandou sair —
ele respondia *"e se eu não escrever nada?"*, pergunta que a CONTA logo abaixo
responde com um número, e a repetia em palavras dentro do campo mais estreito da
folha. **E a conta é CENTRADA** no mesmo lote: ela é a única linha que fala do
CONJUNTO — as de baixo são cada uma sobre uma música —, e alinhada à esquerda
lia como a primeira linha da lista.

**E ELA SAIU DE DENTRO DO SCROLLER** (v1.8.98). Relato do operador: *"o texto de
número de resultados disponíveis está com uma sombra em sua caixa, que parece que
deveria ser da caixa do scroll da lista de resultados, pois ela está sem sombra
de corte por rolagem."* O diagnóstico é aritmético: ela era `sticky` no topo da
lista com `z-index: 3`, e a tira do `.rola` é `z-index: 5` com 22px sobre uma
linha de 19,5 — rolada a lista, a sombra pintava POR CIMA da contagem, e a
fronteira de verdade (a primeira linha cortada, logo abaixo) ficava sem marca.
Hoje ela é o `<li>` ANTERIOR ao scroller, e perdeu com isso o `sticky`, o
`z-index` e o fundo opaco, que só existiam para ela sobreviver à rolagem; uma
margem negativa a cola na lista, porque elas são irmãs numa lista com `gap` e a
contagem RÓTULA a lista. MEDIDO depois: os pixels da contagem sobre `--panel`
limpo, e o gradiente começando no topo do scroller.

**E O RECIBO CALADO NÃO OCUPA NADA** (`.sorteio-fala:empty`, v1.8.98) — MEDIDO,
eram 25,9px entre a barra e a contagem, dos quais 14,7 eram a linha vazia mais os
dois vãos da folha; hoje são 5,6px. **O que a reserva protegia continua
protegido**, e é por isso que ela pôde cair: a regra da v1.8.61 é sobre BOTÃO que
se mexe debaixo do dedo. Desde a v1.11.18 a linha é a de CIMA do `.popup-fecho`,
acima da roleta, e a base da folha é fixa — o recibo cresce PARA CIMA, quem cede
é a lista (`flex: 0 1 auto`), e nem a roleta nem a barra de ação andam um pixel.

**A palavra vale no MESMO toque.** O `debounce` cobria a atribuição também, e
digitar e tocar no botão dentro dos 130 ms sorteava com a palavra ANTERIOR — sem
erro e com a conta mostrando o número certo, porque ela e o sorteio liam a mesma
variável defasada. Hoje só o RECONTAR é adiado.

A palavra tema casa em **DOIS lugares, do mais específico ao mais amplo**: o
TÍTULO da faixa → a LETRA. **O nome do álbum NÃO entra** (v1.12.5, pedido do
operador: *"considere apenas o título da música e a letra … se eu filtro por
'fé', obrigatoriamente a música vai ter fé como assunto"*): era um terceiro lugar
(`CASOU_ALBUM`) que trazia toda faixa de um álbum "Fé e Ação" sem a palavra em
lugar nenhum dela. Diverge de propósito da busca da Biblioteca, onde o álbum é o
que se procura. A letra só é varrida acima do piso do `LYRIC_MIN_Q`, o mesmo da
busca; o `casou` que o Registro conta é `nome` ou `letra`.

#### O que já está no aparelho vem PRIMEIRO, sempre

`AVSorteio.sortear` particiona o pool em baixado × por baixar, embaralha **as
duas** e concatena. Não é otimização: uma fila de dez faixas por baixar é a
congregação esperando a rede da igreja no meio do culto.

A preferência é ABSOLUTA, e o preço está dito na tela: com três faixas baixadas
e nenhum filtro, "sortear uma" sai dessas três até que outras sejam baixadas. Por
isso o contador mostra as **duas metades** ("12 faixas casam · 3 já no aparelho ·
sorteia 5") em vez de um número só, e por isso o chip "Só no aparelho" existe —
ele torna a escolha explícita em vez de deixá-la implícita numa ordenação.

**A segunda partição também embaralha**, e isso não é simetria: sem ela o que
completa a fila sai na ordem do acervo — sempre o mesmo álbum — justamente no
aparelho recém-configurado, onde nada está baixado e ela é a única que
contribui.

#### A espera do índice de letras é OBRIGATÓRIA aqui

Na busca, `ensureLyricIndex()` é disparado e esquecido: o índice chega e a lista
se redesenha (`renderSearchResults` é síncrona, roda a cada tecla e não pode
esperar o IDB). **Aqui não há redesenho que conserte depois** — o toque no botão
manda a faixa para o telão. Sortear com o índice pela metade produziria um
sorteio que IGNORA a palavra tema e projeta mesmo assim.

Por isso `ensureLyricIndex()` passou a **devolver a promessa** (quem a ignora
continua exatamente como antes), `executarSorteio` a espera, e `abrirSorteio` a
dispara ao abrir a folha — o único instante em que a espera não custa nada,
porque o operador ainda está escolhendo o modo.

#### Fundo musical sorteado é SOM DE FUNDO (v5.311, renomeado na v5.313)

Pedido do operador: *"quando for apenas uma música ou playlist de playback,
quero que trate eles como apenas áudio, sem aparecer nada na tela… essa função é
para som de fundo"*.

**A cortina já faz exatamente isso, e é por isso que não há mecanismo novo.**
`view: 'wallpaper'` põe o wallpaper por cima, e o `#lyrics` do Display vive no
MESMO z-index dos layers de mídia — a cortina cobre os dois de graça. O áudio
segue tocando: ela é visual. E **viaja dentro do `load`**, então o telão nunca
chega a desenhar a letra para escondê-la um quadro depois. Nada de campo novo no
barramento, nada de `SHELL_VERSION`, e a tela da rede herda (roda o mesmo
`display.js`).

**A decisão é explícita nos DOIS sentidos** (`cortinaDoSorteio` decide,
`acertarCortinaDoSorteio` aplica), e não só "ligar quando fundo musical": quem
sorteou um fundo musical fica com a cortina posta, e o sorteio seguinte de uma
CANTADA precisa revelá-la — senão o louvor entra sem imagem e sem letra por
causa de uma escolha de dois minutos atrás. **O sorteio diz o estado do telão em
vez de herdá-lo.**

**Os três destinos não mexem na cortina**: eles guardam, não projetam — e por
isso o PACOTE a carrega no descritor (ver abaixo), para aplicá-la no dia em que
for aberto. **Uma música SOLTA não a carrega**, e a assimetria está dita: um id
de mídia numa lista não tem onde guardar decisão nenhuma, e nenhum caminho deste
app jamais guardou cortina junto com uma música avulsa — a gaveta da Biblioteca,
mandando um `playback` ao Cronograma, faz exatamente o mesmo.

A folha **anuncia** o que vai acontecer, e só com o fundo musical escolhido — que
é quando a pergunta existe: *"Fundo musical: toca sem letra e sem nada no
telão."*

##### O rótulo é "Fundo musical", e o VALOR continua `playback` (v5.313)

Pedido do operador: *"ajuste o nome de 'playback' para 'fundo musical' … pois ela
reflete melhor o propósito do filtro"*.

São duas perguntas diferentes, e é por isso que a folha de UMA música continua
dizendo "Playback": lá o rótulo nomeia o **arquivo** que se vai tocar (a gravação
sem voz, ao lado da cantada); aqui ele nomeia o **propósito da fila inteira** —
som por baixo do culto, telão coberto —, que é exatamente o que a cortina faz.

**O valor guardado continua sendo `'playback'`** (`AVSorteio.VARIANTE_PLAYBACK`),
e isso não é descuido: ele é a preferência já gravada nos aparelhos **e** o
argumento de `resolveSongMediaId`, onde qualquer coisa diferente de `'full'`
resolve o `fileIdPlayback`. Renomear o valor junto com o rótulo trocaria a
variante de todo mundo que já escolheu, em silêncio. `sorteio-tela.test.mjs`
trava as duas metades: o rótulo que aparece e o valor que não muda.

#### A faixa de fecho: TOCAR mais os TRÊS destinos (v5.306, v1.8.56)

Eles não são versões da mesma ação, e é isso que justifica os botões ao lado do
primário:

| Botão | O que faz | O que NÃO faz |
|---|---|---|
| **Tocar agora** | `AVDB.listSet('playlist', ids)` + `send` do primeiro — o caminho do `abrirPacote` | — |
| **Cronograma** | acrescenta **UM PACOTE** à lista `imports` (v5.313) | não substitui a fila do player, não projeta, não fecha a folha |
| **Playlist** | acrescenta as FAIXAS ao FIM da fila (`listAdd`, que é append e idempotente) | não substitui a fila, não projeta, não guarda pacote |
| **Favoritos** | o mesmo pacote, na lista `favs` | idem |

Pedido do operador: *"vai direto para a playlist do player, para ser tocada"*
(v5.303), depois *"coloque dois botões, um de tocar agora e outro para
adicionar ao cronograma"* e, na v1.8.56, *"deixe o botão tocar agora, e os dois
botões de add ao cronograma e add aos favoritos disponíveis… pode até adicionar
um terceiro botão, adicionar a playlist, que simplesmente joga… no fim da
playlist atual"*. Montar o louvor da semana numa terça e projetar no domingo são
dois momentos, e antes só o primeiro tinha porta.

Substituir a fila é a mesma semântica de todo "Tocar agora" do acervo, que já
passa por `replacePlaylistWith` — não é uma classe de risco nova. **Os três
destinos nunca substituem nada:** ali a ação só ACRESCENTA.

**A ORDEM é a canônica** (`DESTINOS` — ver "UM item, VÁRIOS destinos"), e os três
são ÍCONES MUDOS com `aria-label`: a 320px quatro rótulos não cabem, e o desenho
é o do rodapé da fila (v1.8.53), com a mesma expressão de tamanho. O `data-dest`
de cada um é o único jeito de achá-los sem texto — inclusive para um oráculo.

Decisões que precisam estar ditas:

- **UMA SÓ TAMBÉM TEM OS TRÊS** (v1.8.56). Até ali o botão era um, e a razão
  escrita era: *"sorteie uma e guarde é o caminho que a Biblioteca já dá pela
  gaveta da linha, com a música escolhida à vista"*. Ela vale para uma música
  ESCOLHIDA — quem sorteia não sabe qual vai sair, e chegar à gaveta dela custa
  fechar esta folha, achar a faixa entre milhares e abri-la: uma busca e três
  toques para o que agora é um. **Eles SORTEIAM**, e é isso que os torna botões
  e não uma folha de destinos: não há resultado à vista antes do toque, e uma
  folha perguntaria *"para onde?"* antes de existir o quê.
- **UMA SÓ ENTRA COMO A LINHA DA MÚSICA, nunca como um pacote de um.** A mesma
  régua do `.avpkg` da fila (*"um pacote guarda uma fila"*, v1.8.53): uma linha
  chamada "Playlist da biblioteca · 1 música" que precisa de um toque a mais
  para revelar o hino que está dentro é pior que a linha do hino.
- **A PLAYLIST RECEBE AS FAIXAS, não o pacote.** É a metade literal do pedido, e
  é a única leitura coerente: a fila é uma fila de MÍDIA, e o toque num pacote a
  SUBSTITUI (`abrirPacote`) — guardá-lo dentro dela seria pôr nela o botão que a
  apaga.
- **NENHUM DELES NO MODO FÁCIL.** Ele não tem Cronograma, nem Favoritos, nem
  fila à vista (`body.mode-simple` esconde o `main` e a barra inteiros), e o que
  fosse guardado ali só reapareceria para quem trocasse de modo.
- **Guardar NÃO fecha a folha.** É o princípio das listas de destino do acervo:
  uma ação que guarda não encerra a conversa, e o segundo sorteio é o uso normal
  (acrescenta cinco, olha a lista, acrescenta mais cinco). Fechar cobraria três
  toques por rodada.
- **Cancelar tem sentidos OPOSTOS entre o primário e os destinos, e está
  certo.** No "Tocar agora" ele descarta: trocar a fila do culto por meia lista
  é uma SUBSTITUIÇÃO pela metade. Nos três destinos ele preserva o que já
  desceu: três de dez é exatamente o que aconteceu, e jogar fora um download que
  já custou rede seria desperdício.

##### O Cronograma (e os Favoritos) recebem UM PACOTE, não N linhas (v5.313)

Pedido do operador: *"ajuste o envio ao cronograma para que ele não envie um por
um, mas sim um item que seja um pacote de playlist"*.

**E ele não é um tipo de item novo:** é o cue `group` que o botão "Guardar
pacote" da fila já cria — mesmo descritor (`{ ids }`), mesmo desenho de linha,
mesmo `abrirPacote` no toque. Invariante 5 aplicada ao lado web: ponteiro novo
para um mecanismo que existe, nunca um segundo mecanismo.

O que isso resolve é a ESCALA. Dez faixas sorteadas eram dez linhas avulsas no
meio do roteiro — para tirá-las, dez perguntas; para saber que eram um lote,
memória. Uma linha diz o que é, sai num toque, e abre a fila inteira na hora dela.

**Vale para os Favoritos desde a v1.8.56**, pelo mesmo `criarCue` (que já sabia
guardar em `favs`; o que faltava era o botão) — e **não vale para a fila**, que
recebe as faixas soltas, nem para o sorteio de UMA, que entra como a linha da
música. Ver a faixa de fecho, acima.

| Decisão | Por quê |
|---|---|
| **o nome não usa a palavra "sorteio"** | ela já é o nome de outra cena de roteiro (`CUES.draw`), e duas linhas homônimas fazendo coisas diferentes só se descobrem no sábado. `nomeDoPacoteSorteado` produz *"Playlist “natal” · 5 músicas"* / *"Fundo musical da biblioteca · 3 músicas"* |
| **a CORTINA viaja no descritor** (`data.view`) | guardar não projeta, então a decisão precisa sobreviver até o dia da abertura — sem ela um pacote chamado "Fundo musical" abriria em setembro com a letra no telão, desmentindo o próprio nome. `abrirPacote` a aplica; **ausente não mexe em nada**, que é o pacote montado à mão pela fila (ele nunca prometeu nada sobre o telão e não pode começar a prometer por causa deste campo) |
| **os `ids` dentro do cue não viram órfãos** | a mídia do sorteio vive no store **`files`** (`resolveSongMediaId` devolve o `fileIdFull`/`fileIdPlayback` do hinário, e `getMedia` cai no `fileGet`), e o coletor lê listas + Favoritos e apaga só do store `media`. Quem manda na vida deles é a coleção que os baixou, como antes |
| **cada sorteio é um pacote NOVO** | antes a dedução era por id e o segundo sorteio só acrescentava o que faltava. Um pacote é o INSTANTÂNEO de uma tirada; dois lotes no roteiro são dois lotes, e continuam saindo num toque cada. `criarCue` ainda avisa quando o conteúdo é idêntico |
| **`f` é passado a `guardarSorteadasNoCronograma`** | e não `sorteioPrefs`: a folha fica aberta durante o download, e mexer num controle ali reescreveria as preferências — o pacote sairia com o nome de uma escolha que ninguém sorteou |

##### A CONTA É UM CARTÃO DE TAMANHO FIXO, E O PULSO CHEGA À TELA (v1.8.83)

Dois relatos do operador no mesmo minuto, sobre a mesma folha — e são o MESMO
defeito por dois ângulos: **ela se redesenhando quando não precisava**.

**(1) O pulso.** *"O feedback de confirmação dos botões na seção de playlist
automática, estão muito rápidos, basicamente não visíveis. Verifique seu tempo de
exposição ou se tem algo atualizando a tela"* — era a segunda hipótese, e o tempo
não tinha nada a ver. O `finally` do `executarSorteio` chamava `renderSorteio()`
só para reabilitar a faixa de fecho, e um redesenho **troca os nós**
(`limparFolha` esvazia a lista e cada botão é criado de novo). MEDIDO: o nó do
botão tocado saía do documento em **23 ms**, e o pulso vivia os 1100 ms do
`PULSO_MS` inteiros **num nó solto — zero milissegundo na tela**.

`acertarTravaSorteio` escreve `disabled` em ponto, que é tudo o que aquele
redesenho tinha a fazer. A unificação achou a **segunda cópia da mesma regra** no
`atualizarContaSorteio`, e ela estava errada por dois motivos: lia só `n === 0`
(ignorando o `sorteioRodando`) e procurava os botões DENTRO da lista, onde eles
não moram desde a v1.8.60 — um laço sobre zero nós, sem erro em lugar nenhum.

> **A armadilha da MEDIDA está no oráculo, e ela é o ponto:**
> `btn.classList.contains('btn-pulso')` responde `true` durante os 1100 ms
> inteiros, nó solto e tudo. O que se mede é `.btn-pulso` **dentro da folha** —
> isto é, um pulso que alguém pode ver.

**(2) A zona de resultados** — e ela foi REESCRITA na v1.8.84, uma versão
depois. Vale registrar as duas, porque a segunda revoga a primeira por uma razão
que a primeira não podia ver.

**v1.8.83, o cartão de tamanho fixo.** *"Seu design está sendo muito variado e
pouco modular, resultando novamente no problema de movimentação da janela… Algo
como um simples card, com texto centralizado… O card sempre terá o mesmo
tamanho"*. O `min-height: 6em` da v1.8.61 reservava QUATRO linhas e o pior caso
são CINCO. MEDIDO em 99 células (3 larguras × 3 escalas da fonte do sistema × 11
estados que o operador alcança tocando nas pílulas e digitando): a caixa ia de
**78,7 a 143,7px** e a FOLHA andava **25,6px** a 360×1,5. A 320×1,5 ela NÃO
andava, e isso era pior em vez de melhor — ali a folha já batia no teto de 80vh e
o crescimento virava rolagem, que é o mesmo defeito escondido atrás de um gesto.

**v1.8.84, a lista.** *"O cartão de resultados repete as informações que já temos
nas seleções acima, como os filtros usados, e etc… Uma ação inútil, pois
literalmente já há a visão das seleções. Nesse resultado, precisamos apenas dos
resultados. Quantos temos, e se está disponível."* Ele estava certo, e o lote
anterior tinha consertado a peça errada: fixar a altura de uma frase que
reescrevia por extenso *"Toda a biblioteca, sem os infantis — 2 músicas"* logo
abaixo das pílulas que dizem "sem infantis" e do campo vazio. **Uma frase que
repete a tela não fica melhor por não se mexer.**

O que sobrou dela se dividiu em dois, por onde cada metade é lida:

| pergunta | onde vive | por quê |
|---|---|---|
| **QUANTOS** | `sorteioPilulaDaConta` — uma pílula à esquerda do primário | é o que se lê de RELANCE, e por isso fica na altura do dedo. Largura FIXA (`min-width: 4ch` + `tabular-nums`), *"cuide para que o botão tenha um tamanho fixo independente do número interno"*. **Só o número desde a v1.8.85** — ver abaixo |
| **QUAIS** | `sorteioListaDeResultados` — a lista, no formato da busca da Biblioteca | é o que o cartão nunca respondeu, e é onde a disponibilidade vira acionável: a linha diz "no aparelho" ou "vai baixar", e dá para desmarcar a que vai baixar |

#### A MARCA É O LOTE, E O LOTE É "QUANTAS" (v1.8.85)

*"As marcações de check devem ficar selecionadas apenas o número de itens
selecionado para o filtro atual, o resto da lista segue desmarcado, mas ainda
segue sendo listado… ajuste para que ao tocar no check para ativar ou desativar,
se altere o número selecionado para 'quantas', pois ele é literalmente isso, mas
selecionando de forma manual."*

**Isto REVOGA as duas marcas da v1.8.84**, que tinha a caixa marcada em TODAS as
linhas (*"esta entra na consideração?"*) e o preenchimento em algumas (*"esta vai
tocar?"*). Duas perguntas, dois sinais — e o operador leu uma pergunta só. Ele
está certo: **marcar é escolher**, que é o vocabulário do resto do app (a folha
de destinos, a seleção múltipla).

| peça | o que é |
|---|---|
| `sorteioMarcadas` | **a única fonte**. O conjunto de chaves marcadas É o lote, e "quantas" é o `size` dele |
| a ROLETA de quantidade | deixou de ser o estado e virou um **atalho**: parar no "5" marca as cinco primeiras do baralho (`sorteioSemear`) |
| `sorteioPrefs.quantos` | continua sendo o que PERSISTE, e só a roleta o escreve |

**ELA É UMA ROLETA HORIZONTAL desde a v1.8.96** (`sorteioQuantidadeLinha`), no
lugar das seis pílulas `[1, 3, 5, 10, 15, 20]` — pedido do operador: *"atualmente
ele possui números fixos, mude isso… uma roleta horizontal, que vai de 1 a 50 (ou
o número máximo de resultados disponíveis)"*. O que as pílulas não davam era
justamente o número do meio: escolher 4 exigia marcar as linhas na mão.

- **Ela NÃO dá a volta**, e é isso que a separa das roletas do Tempo: a faixa tem
  PONTAS de verdade (não existe "zero músicas"), logo não há base repetida, banda
  do meio nem recentragem. Do idioma de seletor sobrevive o resto — sem a marca
  `rola`, máscara nas pontas, `--op-inativo` nas vizinhas, régua vinda do layout.
- **O recuo das duas pontas é MEDIDO** (`--qh-vao`, `(janela − célula) / 2`,
  escrito por `acertarQuantidade` atrás de um `ResizeObserver`): um
  `padding-inline: 50%` com `box-sizing: border-box` zera a caixa de conteúdo e
  as células saem transbordando por baixo do recuo. **E é ele que torna a roleta
  ROLÁVEL com poucos resultados** — com oito células a fileira é mais estreita
  que a janela, e sem o recuo o `scrollLeft` não sai de zero.
- **O teto segue o que EXISTE** (`min(50, disponíveis)`), e a linha só é
  REMONTADA quando ele muda: a palavra tema é redigitada a cada tecla, e remontar
  ali jogaria a roleta de volta ao começo no meio do gesto.
- **`qhAssentou` é IDEMPOTENTE** pelo mesmo motivo do `roletaAssentou`: um
  reposicionamento programático cai nele pelo mesmo `scroll` que um dedo, e é a
  comparação — não uma bandeira — que os separa.
- **O TOQUE NUM NÚMERO À VISTA** (v1.8.98): *"está no 1, mas eu vejo o 3. Se eu
  tocar no 3 ele vai direto para o 3."* O `qhTocar` só ROLA — quem conclui é o
  assentamento de sempre, senão a mesma regra existiria em dois lugares e o
  toque e o arrasto marcariam lotes diferentes no primeiro ajuste. **E o arrasto
  não é um toque:** num aparelho o Chromium engole o `click` depois de um gesto
  que rolou, mas com o PONTEIRO ele não engole, e arrastar terminaria
  selecionando a célula onde o dedo parou. A guarda é uma bandeira zerada no
  `pointerdown` e conferida no `click`.
- **E OS TÍTULOS "FILTROS" E "QUANTAS" SAÍRAM** no mesmo lote: *"use a largura
  toda apenas para distribuir os botões seletores e a roleta da quantidade"*. Com
  o rótulo fora, a fileira DISTRIBUI em vez de se encolher contra ele — e o preço
  apareceu MEDIDO: com `nowrap` + `ellipsis`, "Só no aparelho" é cortado já a
  320×1× e os TRÊS a 320×1,25×. O rótulo passou a QUEBRAR, com `align-items:
  stretch` dando às três pílulas uma altura só. Não é o motor de pulo da v1.8.61:
  o texto destas três não muda de estado nenhum.

- **Guardar os dois — um número e um conjunto — é a divergência escrita.** Um
  toque que atualizasse só um deles faria o seletor discordar da lista, e nenhum
  dos dois erraria sozinho. Daí `quantos` ser DERIVADO na tela: a posição da
  ROLETA é `sorteioMarcadas.size` clampado ao teto, então marcar quatro linhas
  na mão leva a roleta ao 4 — a escolha continua sendo do operador, e agora ela
  é DIZÍVEL (com as seis pílulas, quatro marcadas não acendiam nenhuma).
- **Só a roleta grava**, e nunca a marca: gravar a cada linha tocada escreveria
  no banco a cada toque. *(A razão ANTIGA disto caiu na v1.8.96: era `sanear`
  clampar `quantos` à lista de presets, o que fazia um 4 de marca manual voltar
  como 1 na abertura seguinte. Com a faixa `QUANTIDADE_MIN..QUANTIDADE_MAX` no
  lugar da lista, qualquer inteiro atravessa.)* A marca segue EFÊMERA por pedido
  do operador (v1.8.84: *"esse check é resetado entre aberturas da janela"*).
- **REABRIR REINICIA OS FILTROS** (v1.8.98), a pedido do operador: *"reinicie
  seus filtros sempre que for reaberta. Desmarcando os filtros hinário, sem
  infantis e só no aparelho. Além de limpar a palavra tema."* É o argumento das
  MARCAS (v1.8.84) um nível acima: um filtro que sobrevive fechado tira músicas
  do sorteio sem que ninguém lembre por quê. **Desde a v1.12.53 os filtros são as
  COLEÇÕES marcadas** (inclusivas), e a regra vale igual: `abrirSorteio` zera
  `categorias`, o "Só no aparelho" e a palavra — nada marcado é o acervo inteiro.
  (O "único filtro que nasce ligado", `semInfantis`, saiu com os filtros de
  exclusão.)
- **A LISTA NÃO SE REORGANIZA.** Marcar a linha 9 deixa a linha 9 onde está, com
  a posição 3 do lote: o que numera é a ordem do BARALHO, contando só as
  marcadas. Subir a marcada para o topo seria reorganizar a lista debaixo do
  dedo, que é o que o baralho existe para não fazer.
- **O PISO É UMA MARCADA** (`sorteioAlternar` devolve `false` e o botão pulsa em
  erro). Desmarcar a última deixaria a folha com um primário aceso que não pode
  fazer nada, e a régua da v1.8.50 diz o contrário disso; o caminho de "não quero
  nenhuma" é fechar a folha.
- **O TOQUE NÃO REDESENHA A FOLHA** — `atualizarContaSorteio` mais
  `acertarPilulasDeQuantidade`, os dois em ponto. É o remédio da v1.8.83 pelo
  mesmo motivo, com um agravante novo: desde este lote a lista é o único
  scroller da folha, e um redesenho a devolveria ao TOPO a cada marca. Numa
  lista de mil linhas, um toque na linha 300 tirava a linha 300 da tela.

#### O BARALHO É MANTIDO, NÃO REFEITO (v1.8.86)

*"Ajuste a atualização da lista e opções, para que não re-sorteie a lista em
qualquer interação com os filtros, eles apenas vão cortando as opções do 'fim da
lista'. O sorteio só acontece após realmente 'usar' os itens do topo, no caso,
apenas após tocar ou salvar em algum lugar como cronograma, favoritos ou etc."*

Cada passada faz DUAS operações sobre o baralho, nesta ordem:

1. **quem saiu do pool sai do baralho** — e a ordem do que fica não muda, que é
   o *"apenas vão cortando as opções"* do pedido;
2. **quem entrou vai para o FIM**, embaralhado entre si. Afrouxar um filtro não
   pode empurrar para o topo o que o operador ainda não leu.

- **O EMBARALHAMENTO INICIAL É ESTE MESMO CAMINHO.** Na primeira passada o
  baralho está vazio, todo o pool é "quem entrou", e a lista inteira sai
  embaralhada. Não há dois caminhos, e é por isso que nenhum deles envelhece
  sozinho: quem zera o baralho (`abrirSorteio`) pede um sorteio novo por
  construção.
- **A `sorteioImpressao` SAIU JUNTO.** Ela existia para responder *"o pool
  mudou?"*, e a resposta deixou de decidir alguma coisa. O custo dela era o que
  a justificava (uma string por tecla em vez de 1.100 chaves); hoje a manutenção
  é feita sobre o `Set` que a passada já monta.
- **E ELA COBROU UMA PEÇA NOVA: `sorteioUsadas`.** Guardar uma música não a tira
  do acervo, então na passada seguinte a manutenção a leria como quem acabou de
  entrar no pool — **o lote reaparecendo no fim da lista depois de ter sido
  usado**, que é o oposto do pedido. A memória do que já saiu vale para a
  abertura, e `abrirSorteio` a zera com o resto.
- **O LOTE É AJUSTADO, nunca semeado de novo** (`sorteioAjustarLote`): mantém as
  marcas que sobreviveram ao corte e completa pelo topo até o alvo. Semear
  devolveria ao topo uma marca que o operador acabou de fazer na linha 9, por um
  toque de filtro que não tinha nada com aquilo. O alvo é lido ANTES da poda —
  um filtro que leve embora uma marcada não pode encolher em silêncio o número
  que ele escolheu.
- **`sorteioSemear` continua existindo** para quem de fato pede um lote novo: a
  roleta de quantidade e o consumo.

#### A LISTA CHEGA DE CEM EM CEM, E DEPOIS DE UM RESPIRO (v1.8.100)

Relato do operador: *"estou sentindo um leve travamento na abertura da janela de
playlist automática. Imagino que seja por causa da lista de resultados que já
fica à mostra."* **Ele estava certo, e a medição diz de quanto:** com os 1.100
do hinário a folha desenhava **7.701 nós**, e o `atualizarContaSorteio` — que é
o caminho de TODA marca e de TODA tecla da palavra tema, não só o da abertura —
custava **402 ms**. Depois: **27 ms** para abrir e **19 ms** por toque, com 1.401
nós.

São dois consertos independentes, e cada um resolve uma metade:

- **O AQUECIMENTO** (`sorteioAquecer`, `SORTEIO_AQUECE_MS`) é o pedido literal —
  um aro por um segundo. Ele **não** torna a lista mais barata: tira o custo dela
  de CIMA da animação de entrada, que é onde o travamento se via. **E só existe
  onde há custo:** com o pool cabendo numa página a lista já sai em 19 ms, e um
  aro ali seria espera INVENTADA — pior que o travamento, porque aconteceria
  sempre. O aro é o `.dl-ring` do app inteiro, com a geometria própria e a tinta
  de lá.
- **A PÁGINA** (`SORTEIO_PAGINA`, `sorteioVistos`, `sorteioLinhasEm`) é o que de
  fato tira o peso, e vale para sempre. **O corte é de VISTA:** quem sorteia é o
  pool inteiro (`sorteioLista`), e a contagem acima continua dizendo o total — um
  `slice` que escapasse para o sorteio daria trinta dos cem primeiros com o
  número certo na tela.
- **Ela cresce por APÊNDICE**, no fim da rolagem: remontar para mostrar mais cem
  devolveria a lista ao topo, que é o defeito que a v1.8.85 consertou.
- **A ALTURA É DA FOLHA, nunca da lista** — desde a v1.11.18 ela é FIXA em
  qualquer estado (`#sorteioPopup .popup-sheet { height: 80% }`), e a lista
  aquecendo ganha `flex: 1` só para o aro pousar no meio do lugar que a lista vai
  ocupar. Antes disso a reserva era a marca `aquecendo` no popup
  (`height: 80vh`), que existia só durante o aquecimento; a marca saiu com a
  altura fixa. Um piso escrito na LISTA passaria do que sobra e poria a
  `.popup-list` a rolar, e *"só a lista rola"* é a regra abaixo.
- **A contagem NÃO espera.** Ela é a resposta a *"quantos são?"*, já está na mão,
  e segurá-la deixaria o operador um segundo sem resposta nenhuma.

Oráculo: `sorteio-lista-por-pagina.test.mjs`.

#### SÓ A LISTA ROLA (v1.8.85)

*"Sobre o scroll, mantenha as opções dos filtros sempre visíveis e deixe apenas
a lista dos resultados como scroll."*

A `.popup-list` já é uma coluna flex; o que mudou é **quem cede**: a
`.sorteio-res` é o único item com `flex-shrink: 1`, então tudo o que passa da
altura da folha (80%) é descontado dela e o resto — palavra, variante e filtros
na lista; roleta e barra de ação no `.popup-fecho` — fica onde está.

- **O SELETOR PRECISA NOMEAR O PAI.** `.popup-list > li` declara `flex-shrink: 0`
  e é (0,1,1); `.sorteio-res` sozinho é (0,1,0) e PERDE. MEDIDO: a lista ficava
  com 1323px dentro de uma folha de 720 e quem rolava era a folha inteira — o
  pedido desfeito por um ponto de especificidade, sem erro em lugar nenhum.
- **O PISO (`min-height: 9rem`) É A FALHA ABERTA.** Sem ele, uma folha apertada
  (tela baixa, fonte do sistema grande) esmaga a lista até zero e o operador vê
  os filtros sem nenhum resultado, sem nada dizendo por quê. Com o piso, quem
  transborda é a folha — que nunca deixou de ser um scroller —, e no pior caso
  volta-se ao comportamento de antes deste lote.
- **A `.rola` MUDOU DE DONO**: a sombra das bordas é da lista de resultados, que
  é quem rola. A `.popup-list` continua com a marca e o observador a lê como
  `sem-veu` enquanto ela não rolar, que é o caso normal.
- **(A `.sorteio-barra` foi `sticky` da v1.8.84 à v1.11.17**, como REDE de uma
  barra que morava dentro do scroller. Ela voltou ao `.popup-fecho` e não é mais
  — ver "A BARRA DE AÇÕES VOLTOU À BASE", abaixo.)

- **A PÍLULA NÃO É UM BOTÃO**, e é um `<span>` de propósito. Ela não faz nada, e
  a v1.8.50 diz que o que não tem função agora não fica aceso esperando toque —
  um número desenhado como botão é um botão que se toca e não responde. Ela
  anuncia a FRASE (`role="status"` + `aria-label`), nunca o número solto: um
  leitor de tela lendo "12" no meio de uma barra de botões não diz de que 12 se
  trata.
- **E ELA PERDEU O ÍCONE na v1.8.85** (*"remova o ícone e deixe apenas o número
  no botão de número de resultados disponíveis"*). Ele era a nota musical, e o
  que ele acrescentava — "isto conta músicas" — a lista logo abaixo já diz, item
  por item. **O que ele custava é medível e é o vizinho:** 27px da largura do
  rótulo do primário, numa faixa onde ela é o recurso escasso. O pior caso do
  "Tocar agora" subiu de 6,1px para 34,9 — o que MELHOROU o número e não
  resolveu, e as duas metades ficam escritas porque a primeira convida a
  desfazer a segunda (a quebra da faixa continua obrigatória).
- **A BARRA DE AÇÕES VOLTOU À BASE (v1.11.18)**, e a roleta da quantidade foi
  com ela. Pedido do operador: *"na aba de playlist automática, temos o seletor
  de quantidade e os botões de decisão acima da lista de músicas disponíveis…
  coloque eles na base dessa aba, abaixo do scroll com as opções de músicas"*.
  Isto REVOGA a v1.8.84, que a pusera ACIMA dos resultados (*"mova a barra de
  opções de play para cima dessa sessão de resultados"*) grudada por `sticky`.
  A ordem da folha passou a ser: o que se ESCOLHE no alto (palavra, variante,
  filtros), o que VAI ACONTECER no meio (a lista, a única que rola) e o que se
  DECIDE embaixo (recibo, quantas, barra) — tudo no `.popup-fecho`, irmão do
  scroller, que nasce vazio e que `limparFolha` esvazia junto com a lista.
  - **A FOLHA TEM UMA ALTURA SÓ** (`#sorteioPopup .popup-sheet { height: 80% }`),
    e é isso que paga o pedido: com os botões na base, uma folha que encolhesse
    com a lista (poucos resultados) os levaria para cima, e uma que crescesse
    com o recibo os levaria para baixo — o oposto da v1.8.61. O preço é um vazio
    entre a lista curta e a base, aceito. MEDIDO a 390×800: a barra fica em
    584,8–627,2 nos estados de 300, 3 e 0 resultados e com o recibo à mostra.
  - **O RECIBO É A LINHA DE CIMA DO FECHO**, acima da roleta: cresce para cima e
    a lista cede. O fecho é uma coluna com o vão da lista (`--sp-3`), e o
    `:not(:empty)` impede a regra de id de vencer o `display: none` do fecho
    vazio.
  - **O CAMINHO LEVE ACHA AS TRÊS PEÇAS PELO POPUP**, não pela lista
    (`atualizarContaSorteio`): `.sorteio-sortear`, `.roleta-h` e `.sorteio-fala`
    moram no fecho. Uma busca em `sorteioListEl` não acha nenhuma — o que se vê é
    a roleta que não acompanha o teto e o sortear que não é trocado, sem erro.
  - **O `sticky`, o `z-index` e o fundo próprio da barra saíram**, e com eles a
    entrada dela na lista de R1 (o `--surface` afundado vem do `.popup-sheet`) e
    os três seletores `.sorteio-barra:has(...)` da altura única — o
    `.popup-fecho .song-menu-go-row:has(...)` já a alcança.
  - Oráculos: bloco B do `playlist-automatica-estavel` (a base não anda, a folha
    tem uma altura só, as peças moram no fecho abaixo do scroller), bloco P do
    `sorteio-tela` (o recibo acima da roleta) e bloco S do `sombra-de-rolagem`.
- **TRÊS AJUSTES DE SOMBRA E TAMANHO (v1.11.23).** (1) *"no modo simples durante o bloqueio de tela
  inicial, a sombra inferior do auxiliar de leitura fica sobre o blur do desfoque"*: as tiras de
  `.rola` têm `z-index: 5` e `.simple-song` (`position: relative`) NÃO criava contexto de
  empilhamento, então a tira de baixo da placa concorria com o `.simple-veil` (z 1) na raiz e
  vencia. `.simple-song { isolation: isolate }` prende o índice dentro da zona. Prova de PIXEL (bloco
  M do `modo-simples-corpo`): véu opaco magenta e a base da placa tem de ler magenta. (2) *"o título
  não aumenta proporcionalmente quando se aumenta a fonte"*: `.lv-row--cover`/`.lv-cab--letra`
  usavam `--fs-3xl` fixo; v1.12.4: `calc(var(--lv-fonte) * 1.2)` — SEMPRE maior que a letra, na mesma
  proporção em todo degrau do A+/A− (a v1.12.3 pôs `.82`, que escalava mas seguia MENOR). Bloco L. (3) *"na lista para escolher a mídia para edição, a sombra de corte superior … está sem margem com a
  caixa de texto da busca"*: é o SELETOR do editor (`#edicaoLista`, `.rola`), que começava 5,6px abaixo do
  campo (o `.35rem` do `.sorteio-campo`). `.edicao-busca:not([hidden]) + #edicaoLista { margin-top:
  var(--sp-5) }` — só com o campo à vista; sem ele a lista segue o cabeçalho. Vão campo → lista: 15,2px.
  (Uma primeira leitura aplicou isto à lista da Biblioteca, e foi desfeita: não era a lista do pedido.)
  Bloco C1b do `edicao-de-midia`.
- **O TÍTULO DA MÚSICA É A LINHA DE CAPA, NOS DOIS MODOS (v1.11.22).** Pedido do operador: o
  Modo Fácil *"não ganhou o título dentro da caixa da letra"*, *"duas linhas de espaço entre o
  título e o resto"* e *"remover a palavra 'início' … transfira a formatação atual dessa palavra
  para o título … assim fica claro que o título não é letra da música e sim o topo do texto"*.
  (A v1.11.21 leu "modo simples" como "só o card desce" — leitura errada, corrigida aqui.)
  `lvBuildSong(el, cur, titulo)`: a linha de capa (`slide.cover`) passa a escrever o TÍTULO
  (`lvTituloDaLetra`: `12. Nome`) em vez de "Início" — a mesma linha, o mesmo `data-i` e o mesmo
  destaque durante a introdução, com a formatação de `.lv-row--cover`. Sem linha de capa o título
  entra como `.lv-cab.lv-cab--letra` (mesmo desenho, não é posição; seletor DOBRADO porque o
  `.lv-cab` base vem depois no arquivo). O vão é `max(0, 3 × --lv-fonte − --lv-estrofe-gap)` de
  margem: o `gap` da caixa já põe uma estrofe, e o total é 2 × (corpo × 1,5) = duas linhas da
  letra. Só a LETRA: capítulo da Bíblia e apresentação seguem com o `.lv-cab` da v1.11.21.
  Bloco K do `modo-simples-corpo` (título na caixa, formatação, 2 linhas) com reversões do
  "Início" e do espaço; `leitor-do-transporte` afirma capa = título e ausência de "Início".
- **O AUXILIAR DE LEITURA LEVA O TÍTULO DA OBRA NO CORPO, E O MODO FÁCIL REORDENA A TELA (v1.11.21).**
  Pedidos do operador: título da música DENTRO do auxiliar, no início, e fora do topo da
  janela do avançado (*"pode colocar apenas 'Auxiliar de leitura'"*); no Modo Fácil, o card
  do nome *"abaixo do auxiliar de leitura"*; e, para uma mídia que não usa o auxiliar,
  *"a área do auxiliar pode ser substituída pela exibição aberta da biblioteca"*.
  - **AVANÇADO:** `#lyricsPopupTitle` é estático ("Auxiliar de leitura") e o `renderLyricsView`
    não o escreve mais. O título entra por `lvCabecalhoDaObra` (`.lv-cab`, centrado, corpo e
    peso do título da cifra, segue o A+/A−) como PRIMEIRA linha do corpo que rola — para letra,
    capítulo da Bíblia (`Gênesis 1 · ARA`) e apresentação, não só a letra: um cabeçalho que
    dissesse "Auxiliar de leitura" numa fonte e o capítulo noutra seria inconsistente. A cifra
    já tinha o seu (`.lv-cifra-cab`). **Não mora no `lvBuildSong`**: ele é o construtor
    compartilhado com a zona do Modo Fácil, que não tem título (o nome é o card). Não é
    `.lv-row`, então destaque, `lvScroll` e ⏮/⏭ não o veem.
  - **MODO FÁCIL, O CARD:** `.simple-nowplaying` saiu de dentro de `.simple-song` e é seu IRMÃO,
    depois dele. A Biblioteca mede `.simple-song` (`medirCorpoSimples`), então o card fica
    FORA da medida e continua à vista com ela aberta. `.simple:not(.com-midia)` o esconde
    (`display: none`: sem mídia o corpo é a Biblioteca, e "Nada tocando" embaixo dela é ruído);
    a classe é escrita por `renderSimpleCorpo` pela pergunta do Parar. O `.simple-song.entrando`
    não o anima (ele não é filho).
  - **MODO FÁCIL, A MÍDIA SEM LEITURA:** `leituraDoModoFacil()` é a pergunta única — `{deck, lyrics}`
    — de quem desenha a placa (`refreshSimpleLyrics`) e de `simplesSemLeitura()`.
    `simplesBibliotecaDocada()` passou a ser `simplesComBarra() && (!haOQueParar() ||
    simplesSemLeitura())`, e tudo que dependia dela (não fechar, sem ✕, o voltar não a fecha,
    `closeHymnSearch` REINICIA) vale para os dois casos. Letra que chega à mídia a faz sair
    (a coreografia de sempre); letra que some a faz voltar. **O vigia da escolha** (`simpleAguardarSaida`)
    espera só com LEITURA no ar: com a Biblioteca seguindo como tela depois de escolher outra
    mídia sem letra, é ele que desfaz a marca da linha (antes `haOQueParar()` o calava para
    sempre). **A `currentItem` sobrevive ao Parar** (para o ▶ repetir), mas sem mídia no ar a
    pergunta nem chega a ser feita (curto-circuito).
  - **Oráculos:** bloco J do `modo-simples-corpo` (vídeo sem letra → Biblioteca ocupa a zona,
    card à vista ABAIXO e fora da camada, o voltar não fecha, ida e volta com letra, vigia, card
    ausente sem mídia), com três reversões separadas; `modo-facil-card` (B1/B4/B6/B9 na posição
    nova), `modo-facil-fonte`, `leitor-*` (título no corpo e cabeçalho fixo). **Não testado em
    aparelho.**
- **A LISTA DE RESULTADOS É UM CARTÃO, E O VÃO ABAIXO DELA É O DA FOLHA (v1.11.19).**
  Pedido do operador: *"coloque toda essa lista dentro de um card, para melhor
  demarcar suas fronteiras, tome cuidado para não errar nas sombras de
  fronteiras"* — e, na mesma frase, *"verifique a margem abaixo dessa lista, antes
  da linha de quantidades marcadas, me parece que há espaço extra"*.
  - **O CARTÃO É O PRÓPRIO SCROLLER** (`.popup-list > .sorteio-res:not(.vazio)`):
    `--gaveta-bg` (v1.11.20; a v1.11.19 saiu com `--camada`), `--radius-card` e
    recuo `--sp-3`. **Vazia, a lista não leva cartão**: a frase dela já é um, e dois
    um dentro do outro seriam o nível que a escada proíbe.
  - **O TOM É O POÇO DA GAVETA, E NÃO O `--camada` (v1.11.20).** Relato do operador:
    *"me parece que está ficando pouco contraste entre o corpo do item selecionado e
    o fundo do card da lista"*. MEDIDO: `--sel-fill` × `--camada` (= `--panel-2`) deu
    **1,02:1 no escuro e 1,07:1 no claro** — dois tons de MESMA luminância, e só a
    matiz sobrava. O `--sel-fill` foi desenhado para pousar sobre o `--panel`
    (1,35 · 1,31), e um cartão MAIS CLARO que a folha não serve a ele no escuro: o
    cartão DESCE, como a gaveta da Biblioteca já faz, e as linhas voltam a ser
    botões (`--gaveta-btn`; o `--surface` é um overlay e sobre o tom mais escuro do
    app não dá degrau). Medido (escuro · claro): cartão × linha marcada **1,86 ·
    1,41**, cartão × linha fora do lote **1,38 · 1,85**, folha × cartão **1,38 ·
    1,85**, uma linha × outra **1,35 · 1,31** — todos acima do piso de 1,28. As
    sombras de fronteira seguem visíveis (o bloco R mede por pixel que a tira pinta
    dentro do cartão); o bloco R2 mede os pares nos DOIS temas e a reversão
    reprova com os 1,02 e 1,07.
  - **AS SOMBRAS DE FRONTEIRA SÃO O MOTIVO DE SER O SCROLLER**: as tiras do `.rola`
    moram no padding box de quem rola, e um scroller com raio as recorta pelo arco
    (o acabamento da v1.8.59). Um invólucro com raio por fora deixaria a tira
    pintando sobre a folha, num retângulo que não é o do cartão. MEDIDO por pixel
    (ligada × desligada, no mesmo quadro): os dois cantos são o pixel da folha e a
    tira pinta dentro. **Consequência no oráculo:** a varredura "de borda a borda"
    do bloco O do `sorteio-tela` passou a ser do trecho RETO da borda, entre os
    arcos (os 3–4 pixels de cada canto são recorte, não falha).
  - **O VÃO ABAIXO ERA 22,4px, CONTRA 5,6 DE TODO OUTRO** (`--sp-3`): duas folgas
    empilhadas — o `padding-bottom` da `.popup-list` (`.8rem`) e o `margin-top` do
    `.popup-fecho` (`--sp-5`). Ficou UMA, a da lista (`#sorteioList
    { padding-bottom: --sp-3 }`), e o fecho entra com margem zero. A régua do
    oráculo é o `row-gap` da própria lista, não um número. **Com o recibo à vista o
    vão até a ROLETA é maior de propósito** — a primeira linha do fecho é ele —, e
    por isso o bloco R o cala antes de medir.
- **E CINCO PEÇAS NÃO CABEM NUMA LINHA DE 320px**, que é o que a pílula custou e
  onde este lote gastou a maior parte da medição. Ela vale 68,5px a 1× e 90,8 a
  1,5×, e sem quebra o primário é o único que encolhe (`flex: 1; min-width: 0`):
  MEDIDO, **6,1px a 320×1,5** — não é um rótulo cortado, é um botão que sumiu.
  Três coisas resolvem, e a ordem entre elas é o argumento:

  | peça | o que faz | o que se aprendeu medindo |
  |---|---|---|
  | `flex-wrap: wrap` na faixa | permite a segunda linha | **sozinho não faz nada**: um item que pode encolher até zero nunca força a quebra |
  | `min-width: 11em` no primário | é quem FORÇA a quebra, e quem escolhe quem cede | os três destinos descem, que é a ordem certa — o "Tocar agora" é o botão do culto. Nunca `max-content`: o `overflow: hidden` do rótulo zera o tamanho mínimo automático do item |
  | a regra de altura única da v1.8.61 | ganhou o novo ancestral na v1.8.84 e o perdeu na v1.11.18 | escopada em `.popup-fecho`, ela não alcançava a barra enquanto esta morou na lista — MEDIDO, 53,2px do primário contra 42,4 dos irmãos; com a barra de volta ao fecho, o seletor original a alcança de novo |

  **O número 11em é medido**: é o primeiro degrau com ZERO reticências nas nove
  células (3 larguras × 3 escalas da fonte do sistema), e com ele **cai o limite
  de 320px** que a v1.8.62 declarava. 9em ainda cortava em duas, 10em numa, e
  12em só acrescenta quebras sem ganhar célula nenhuma.

  **E A QUEBRA NÃO CONTRADIZ A ESTABILIDADE**: ela depende da TELA e da fonte do
  sistema, nunca do que o operador acabou de tocar — as cinco peças têm largura
  fixa e o rótulo é um só. MEDIDO, deslocamento ZERO da barra nas 33 células.
- **A FALA FICOU** (`sorteioFala`), e é a única coisa do cartão que não repetia
  a tela: *"5 músicas acrescentadas ao fim da playlist"*, *"todas as 5 já
  estavam"*. A segunda metade não tem outro jeito de ser dita — a lista mostra
  as cinco saindo do baralho, mas não distingue "entraram" de "já estavam lá".
  **A linha é SEMPRE desenhada**, vazia quando não há fala: uma linha que aparece
  e some é um motor de pulo da folha (v1.8.61) — calada (`:empty`) ela não ocupa
  nada, e desde a v1.11.18 ela é a linha de cima do `.popup-fecho`.
- **E o clampe da palavra tema FICOU** (`temaNaFrase`, 24 caracteres), embora o
  cartão que o pedia tenha saído: a frase do VAZIO ainda a carrega, e ela
  continua sendo a única entrada sem limite que chega a uma frase desta folha.

#### O BARALHO: a ordem que sobrevive ao redesenho (v1.8.84)

É a metade que o pedido não descreve e sem a qual nada dele funciona. *"Essa
lista de músicas é aleatória dentro das condições selecionadas, ela mostra todos
os disponíveis, mas o número de itens para a 'playlist' fica marcado e ficam no
topo da lista… E após jogar para tocar, essa lista marcada é removida, e os itens
de baixo são levados para cima."*

**A folha é redesenhada a cada tecla digitada, a cada pílula e a cada marca**, e
`montarPool` refaz os objetos em toda passada — ele é quem responde ao contador
por caractere. Um sorteio por render trocaria debaixo do dedo as músicas que o
operador acabou de ler.

- **Ele guarda CHAVES, nunca os itens** (`chaveDaFaixa`: coleção + id da música).
  Os objetos são novos a cada passada; guardá-los seria guardar uma lista que não
  casa com a próxima.
- **O FILTRO CORTA; ELE NÃO SORTEIA DE NOVO** (v1.8.86), e isto REVOGA a
  v1.8.84, cujo argumento era o oposto (*"mexer num filtro é pedir outro
  sorteio"*). Não é: mexer num filtro é dizer o que NÃO serve, e o que sobrou
  continua servindo na mesma ordem. O preço da versão anterior é o que o
  operador leu na tela — ele lê cinco nomes, tira o hinário da conta e recebe
  cinco OUTROS, como se o filtro tivesse rejeitado o que ele estava
  considerando. Ver a seção abaixo.
- **O "Tocar agora" toca o que está na TELA.** Era `AVSorteio.sortear` no toque,
  isto é, um sorteio NOVO: o operador lia cinco nomes e ouvia outros cinco. O
  lote sai de `sorteioEscolhidos(sorteioLista(…))`, que é a mesma função que
  desenhou a lista.
- **O lote USADO sai do baralho** (`sorteioConsumir`), **depois da ação e nunca
  antes**: um lote que falhou — o consentimento de download recusado, nenhuma
  faixa baixável — apagaria da tela músicas que ninguém ouviu.
- **E a lista se redesenha no ato, por `atualizarContaSorteio`.** Nunca por
  `renderSorteio`: um redesenho troca os nós e apaga o pulso que o
  `guardarSorteadas` acabou de pôr no botão tocado (a lição da v1.8.83). Aquele
  troca só a pílula, a fala e a lista — e o botão do pulso não está em nenhuma
  das três. Sem isto, nos três destinos (que deixam a folha ABERTA) o próximo
  toque sairia por cima do mesmo lote.
- **E o próximo lote já nasce MARCADO, do mesmo tamanho** — *"criando a próxima
  lista selecionada para playlist"*. O tamanho é o do lote que saiu, e não a
  pílula guardada: se o operador tirou uma na mão antes de tocar, ele pediu
  quatro, não cinco.
- **Marcas e baralho ZERAM a cada abertura** (`abrirSorteio`) — *"para que não
  aconteça de bloquear uma música desejada sem saber em outra sessão"*. O baralho
  vai junto pelo mesmo argumento por outro lado: abrir a folha é pedir um
  sorteio, e reencontrar o de meia hora atrás não é "automática".

Oráculo: `sorteio-lista-de-resultados.test.mjs`, e a assimetria dele é o
argumento inteiro — **com o baralho refeito a cada passada, o bloco que mede o
DESENHO passa inteiro**. Uma passada sozinha nunca acusa persistência.

#### O lote de download

- **UM consentimento** (`ensureDownloadConsent`) para a fila inteira, nunca um
  por faixa.
- **UMA tarefa** de notificação (`bgTaskStart` com o total), senão a barra
  reinicia do zero a cada download; tudo dentro de **um** `withBgWork`.
- **Em série, não em paralelo.** Seis downloads simultâneos é o que a
  sincronização de um álbum faz, e ali ninguém espera; aqui a primeira faixa tem
  de tocar o quanto antes.
- **Uma faixa que não desce não derruba a fila** — as outras ainda tocam, e é
  isso que separa "a playlist saiu menor" de "não aconteceu nada".
- **O cancelar** do cartão da preview para a fila **entre** faixas: o download em
  curso termina, porque interrompê-lo no meio deixaria um parcial.

#### Ver antes de acontecer

O botão dispara sem mais nenhuma tela, então tudo o que o operador tem para saber
o que vai acontecer está nesta folha. **Desde a v1.8.84 quem responde é a LISTA**
— cada música que vai tocar, na ordem, com o lote no topo —, e a pílula responde
o total.

> **A LINHA DE DUAS FRASES SAIU COM O CARTÃO.** Ela dizia `28 músicas
> relacionadas a “natal”` sobre `A playlist leva 10 · 1 para baixar` (v5.306,
> pedido do operador: *"mais funcional e menos técnico"* — antes era `12 faixas
> casam · 3 já no aparelho · sorteia 5`, três números no vocabulário de quem
> escreveu a regra). O que a segunda linha respondia — *quanto disso toca
> agora?* — a lista responde por extenso: as que vão tocar estão marcadas e no
> topo, e cada uma diz se está no aparelho ou se vai baixar. O custo continua
> **exato e não uma estimativa**, pelo mesmo motivo de sempre: o baralho põe as
> baixadas antes das que faltam, então o que precisa de rede é o que sobra
> depois das primeiras.

Vazia, a folha diz o **motivo dominante** — sem ele, "nada encontrado" tem cinco
causas que pedem ações opostas (trocar a palavra, desligar um filtro, trocar a
variante, abrir a Biblioteca com internet).

**Nas COLEÇÕES a régua é OUTRA: acionabilidade, nunca contagem**
(`motivoAcionavelDasColecoes`, sobre `pool.colecoesRecusadas`). A ordem é fixa —
`sem-indice` vence sempre, depois `hinario`, e `sem-musica` por último —, e ela
não é gosto: `ehMusica` é o `temLetra`, então TODA série do YouTube é recusada
por `sem-musica`. Num aparelho com duas séries e um hinário ainda sem índice, o
motivo mais NUMEROSO é `sem-musica`, e a tela afirmaria "nenhuma coleção de
música neste aparelho" com o hinário inteiro instalado — falso, e sem ação
possível. `sem-indice` é a única frase que diz ao operador o que fazer.

Antes disso a frase saía do filtro que por acaso estava ligado: com "Sem
hinário" marcado E as coleções recusadas por falta de índice, ela dizia "só há
hinário neste aparelho" — o operador desligava o filtro, continuava vazio, e
nada dizia que faltava carregar a biblioteca. Quem sabe por que cada
coleção ficou de fora é `AVSorteio.avaliarColecao`, e é dela que a frase sai.

**A frase de resposta do "Ao Cronograma" mora em ESTADO, não no nó.** O
`executarSorteio` redesenhava a folha no `finally`, e um texto escrito direto no
span era apagado no mesmo quadro em que nascia — o "adicionadas ao Cronograma"
nunca chegava a ser visto. Guardá-la em `sorteioFala` e deixar quem desenha
consultá-la faz qualquer redesenho preservá-la, inclusive um caminho de render
que ainda não existe. **Ela é a `.sorteio-fala` desde a v1.8.84**, e a regra
sobreviveu à troca do cartão pela lista sem uma linha alterada — que é o que ela
existia para garantir.

Vazia, a frase do sorteio ganha **ênfase, não alarme**: `--muted` → `--text`
com peso 600, e nunca a família do vermelho. "Nada casa a palavra tema" é o
desfecho normal de quem acabou de digitar uma palavra, e "nenhuma coleção com
índice" é um aparelho recém-configurado — nenhum dos dois é "está no ar agora"
nem "ação destrutiva", que é o que o vermelho significa neste app.

O veredito completo vai para o **Registro** (`blocoSorteio`), ao lado do bloco
das séries: coleções vistas × usadas e as recusas por motivo, faixas vistas ×
sorteáveis, onde cada uma casou, e os nomes escolhidos na ordem em que foram para
a fila. Ele guarda a palavra **CRUA e a normalizada** — a diferença entre as duas
já explicou uma busca que "não achava nada".

#### Duas escolhas de desenho que precisam estar ditas

- **"Cantada" e "Playback" são um SEGMENTO, não dois filtros.** O operador
  descreveu os dois como filtros ("músicas cantadas", "apenas áudio
  instrumental"), mas eles são os dois valores da MESMA pergunta: marcar os dois
  não significa nada e não marcar nenhum precisa significar alguma coisa. Como
  segmento a escolha é sempre uma — e é o mesmo par, com os mesmos rótulos, que a
  folha de uma música do acervo já oferece.
- **Ele ABRE a barra, e o ✕ continua fechando-a** (v5.305, pedido do operador).
  A linha passa a ser lida como uma frase: *sortear · procurar · sair*. Entre o
  campo e o ✕ ele era um terceiro elemento no canto em que o app inteiro põe a
  SAÍDA, e a vizinhança dizia "mais um jeito de fechar isto".
- **A cor do ícone é `--field-accent`, NUNCA `--accent`.** O botão vive sobre o
  CAMPO, que é branco literal e **sem tema**; `--accent` é redeclarado por tema e
  no escuro vale `#95b5f4`, o azul claro desenhado para o fundo quase-preto do
  app — sobre este branco, **2,06:1**, abaixo do piso de 3:1 de componente. É a
  mesma armadilha que `--field-text` e `--field-muted` já resolviam para o texto
  e o placeholder; o acento era o terceiro consumidor que faltava. Medido:
  **7,70:1**, ao lado dos 8,86:1 do ✕. O `sorteio-tela.test.mjs` mede a cor
  COMPUTADA nos dois temas — comparar NOMES de token deixaria isto passar por
  baixo.
- **O ícone é um DADO DESENHADO, nunca as setas cruzadas.** As setas já são o
  "Aleatório" do botão de repetição, a três centímetros daqui: dois desenhos
  iguais prometendo coisas diferentes na mesma tela é o defeito que nenhuma
  legenda conserta.

  Ele nasceu como o **glifo** `casino` (e30c) e saiu ao ar **sem desenho
  nenhum** — o subset da fonte tem 31 codepoints e aquele não está entre eles.
  Um codepoint ausente não desenha nada: sem erro no console, sem requisição
  falhando, só um vão do tamanho de um ícone. É a mesma armadilha do `edit`
  (ver `pencilIconSvg`), e a resposta é a mesma: um `<symbol id="icoSorteio">`
  no sprite do `index.html`, com UMA definição e duas referências (a barra e o
  cabeçalho da folha).

  **A partir daqui ela tem oráculo**: `tools/glifos.test.mjs` lê o `cmap` do
  próprio `.woff2` e cobra todo `.msym` do bundle contra ele — Node puro, no
  passo que BARRA o build, porque um ícone invisível chega à frota pelo OTA e
  só é descoberto por quem opera.

