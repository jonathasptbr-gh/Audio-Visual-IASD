<!-- Capítulo extraído do `CLAUDE.md` na faxina de 2026-09-07. -->
<!-- O núcleo guarda o RESUMO e o ponteiro; o detalhe mora aqui.  -->

> **Este capítulo saiu do `CLAUDE.md`** (a faxina de 2026-09-07), que era lido
> INTEIRO em toda sessão e por isso cobrava este texto de quem nunca ia abrir
> este assunto. O que ficou lá é o RESUMO — as regras que valem sem abrir
> capítulo nenhum — mais o ponteiro para cá. **O detalhe é este arquivo, e ele
> é a fonte:** uma segunda escrita do mesmo mecanismo divergiria no primeiro
> ajuste, que é o defeito que este repositório mais paga.

**Fora daqui:** [`../../CLAUDE.md`](../../CLAUDE.md) (invariantes, ponte,
barramento, entrega) · [`../HISTORICO.md`](../HISTORICO.md) (o porquê de cada
decisão, por `grep`).

---

# Séries do YouTube (o álbum "Provai e Vede 2026")

Um canal que publica **um episódio por semana** e organiza o ano em **playlists
por período** vira um **álbum da Biblioteca**. O catálogo em
`assets/web/controle/serie.js` guarda `{ canal, prefixo, ano, periodo, titulo,
futuros }` — uma linha a mais dá uma série nova sem código novo. São **duas**:

| Série | Canal | Playlists | Título do vídeo |
|---|---|---|---|
| **Provai e Vede 2026** | @provaievedeoficial | por MÊS — "Provai e Vede - Agosto 2026" | nome do episódio à ESQUERDA da barra |
| **Informativo Mundial das Missões 2026** | @daniellocutor | por TRIMESTRE — "Informativo \| 3º Trimestre 2026" | **não há** nome de episódio: "… \| 15 AGOSTO 2026" |

```
 aba Playlists do canal   ytCanalPlaylists   serie.js      Biblioteca
   · Set 2026 (Libras) ──────────────────►  a REGRA  ──►  card da série
   · Set 2026             ytPlaylist(url)   (PURA)        "15/Ago · …"
   · Ago 2026 ← sem hífen ─────────────────►               syncCollection
```

**A divisão de trabalho é a invariante 5.** O shell entrega listas CRUAS — os
dois métodos não olham para o conteúdo, e o título sai **sem** o `tituloLimpo`
da busca, porque é dele que a regra tira a data e a marca de Libras. A
nomenclatura de um canal muda sem avisar: no web um ajuste chega por OTA em
minutos com oráculo em Node; em Kotlin custaria um degrau de `SHELL_VERSION` e
uma Release por vírgula.

**A regra de ouro: a PLAYLIST prova o pertencimento, o título é só RÓTULO.** Um
vídeo entra por estar numa playlist aceita, jamais por casar um padrão de
título; não casando a data, ele **entra do mesmo jeito**, na ordem em que veio.
Errar para um nome feio é recuperável; errar para um episódio ausente é o
operador descobrindo no sábado que o vídeo do culto não está lá.

**O MÊS DE UM ITEM VEM SEMPRE DA DATA DO TÍTULO, nunca da playlist.** Com
playlists mensais os dois quase sempre concordam; com um trimestre é a diferença
entre 13 episódios ordenados e 13 amontoados em julho. `mesDaPlaylist` devolve
**o mês em que o período começa**, e isso tem dois usos honestos: ordenar as
playlists entre si e ser o PISO de um vídeo sem data.

### As sete armadilhas da nomenclatura

Nenhuma é hipótese — todas foram lidas nas abas Playlists e Vídeos dos canais.

1. **O hífen não é garantido.** Uma playlist é "Provai e Vede Agosto 2026", sem o
   hífen que todas as outras têm. A regra não casa separador: pede o prefixo no
   começo e procura mês e ano **em qualquer posição**.
2. **Espaço duplo.** Tudo passa por `normalizar`.
3. **O marcador de LIBRAS muda de forma entre os níveis:** `(Libras)` na
   playlist, `- Libras` no vídeo. O teste é pela **palavra**, sem acento e sem
   caixa — testar uma das formas literais deixaria a outra passar.
4. **A duração não separa nada:** 4:54 × 4:55 num par, 5:07 × 5:07 noutro.
5. **`uploaderName` não é o canal:** os vídeos vêm como "Provai e Vede | Oficial
   **e Adventist…**" (colaboração). Filtrar por ele derrubaria tudo.
   **MAS ELE É MOSTRADO** desde a v1.5.21 (`canal`, na gaveta de detalhe): a
   armadilha é sobre CRITÉRIO, não sobre exibição — a colaboração é a verdade
   sobre quem publicou, e é a playlist que continua provando o pertencimento. O
   `serie.test.mjs` guarda as duas coisas na MESMA fixture, para ninguém
   "consertar" o canal transformando-o em filtro.
6. **A DATA tem DUAS formas, e o mesmo episódio usa as duas:** compacta entre
   parênteses ("… 2026 (03/Jan)") e por extenso ("… **sábado 3 janeiro**").
   `dataDoVideo` tenta as duas nessa ordem; a extensa aceita o "de" opcional e o
   ordinal ("1º"), e exige que o nome **seja** um mês em vez de só começar como
   um — sem essa guarda, "3 marcos" viraria 3 de março. Supor UMA forma era a
   aposta errada desde o começo.
7. **UM CANAL PUBLICA A MESMA SÉRIE EM VÁRIOS IDIOMAS.** O prefixo separa as
   **playlists** e **não separa os vídeos** — em espanhol eles começam com a
   mesma palavra ("Informativo Mundial **de las Misiones**"). Daí `ehOutroIdioma`,
   irmão do `ehLibras`, nos dois níveis: pela **ESCRITA** (cirílico, hebraico,
   árabe, tailandês, CJK, hangul — um caractere basta, porque "【聖工消息】" não
   tem sílaba que dê para procurar; emoji ficam de fora de propósito) e por
   **MARCA** (espanhol `misiones`/`mision`/`de las`, francês `missionnaire`, e o
   inglês pelo NOME DO PROGRAMA: "Mission Stories", "World Mission", "Mission
   Spotlight"), tudo contra o `normalizar`.
   **Uma marca de idioma tem de ser IMPOSSÍVEL na língua que se quer manter, não
   apenas típica da que se quer recusar** — o inglês era a palavra solta
   `mission` e isso custou um episódio ("Mission Refocus").

A sétima é a **exceção declarada à regra de ouro**: ela recusa pelo TÍTULO. Está
lá porque o erro que evita não é recuperável no sábado de manhã — é o testemunho
projetado em espanhol na frente de todo mundo. O preço está escrito no código: um
episódio em português que CITE "mission"/"misiones" é recusado, e volta à mão
pela busca.

**O ÁUDIO em português é outra pergunta, e é do SHELL.** O YouTube dubla sozinho,
e a dublagem não muda o título — é uma faixa a mais dentro do MESMO vídeo. Quem
escolhe é `TrilhaAudio.kt`: idioma antes do cliente, português EXCLUSIVO quando
existe. Nada no web tem como ver isso, e por isso nada em `serie.js` tenta; o
Registro imprime a trilha escolhida (`140@VISIONOS pt-BR`) para a metade de baixo
ser diagnosticável.

### As decisões que precisam estar ditas

- **A descoberta é a ABA DO CANAL, nunca busca por texto.** É AUTORIDADE: numa
  busca quem escolhe é o ranking do YouTube, e qualquer um pode nomear uma
  playlist "Provai e Vede 2026". Vindo do publicador, o pior caso é uma playlist
  a menos — nunca o vídeo de um desconhecido na projeção do culto.
- **A recusa de Libras existe DUAS vezes**, e a segunda nunca dispara hoje (as
  playlists PT e Libras são espelhos 1:1). Um único vídeo acrescentado por engano
  na playlist oficial iria direto ao telão.
- **O ano é EXPLÍCITO no catálogo** — "o ano corrente" trocaria o conteúdo do
  álbum sozinho na virada de dezembro, no meio da programação de janeiro.
- **A JANELA É A SEMANA CORRENTE, E SÓ ELA** — a data de corte é a virada de
  sábado para domingo, dita pelo operador: *"o domingo é o primeiro dia da
  semana e já oferece a mídia para o sábado de sua semana, e quando acaba
  aquela semana, na virada do sábado para o domingo, já libera a próxima"*.
  `aindaNaoSaiu` **delega** em `ehDoSabadoAtual` e o que sobra dele é só *"está
  no futuro?"*.
  **O piso de 3 dias (`DIAS_DE_ANTECEDENCIA`, v5.256) saiu na v1.4.16**, e a
  remoção é no-op MEDIDO: sobre os 365×365 pares dia × episódio de 2026 ele
  mudava o veredito em 312, e em **zero** deles o episódio caía num sábado — só
  alcançava episódios datados de domingo, segunda ou terça DA SEMANA SEGUINTE.
  Era a única coisa do módulo capaz de mostrar um episódio antes de a semana
  dele abrir, isto é, de contrariar a data de corte. E o pedido que o criou não
  regride: a semana dá SEIS dias de antecedência contra os três dele. Oráculo:
  a propriedade exaustiva do `serie.test.mjs`, escrita **por fora** da
  implementação (o domingo sai da data do EPISÓDIO), provada por reversão —
  quem reintroduzir o piso vê 312 pares reprovarem.
  Enquanto a contagem de dias foi a régua
  inteira, ela e a semana adventista do `sabadoDaSemana` discordavam em **três
  dos sete dias** (domingo, segunda e terça): a lista escondia o episódio que o
  destaque do topo declarava o desta semana, e o topo dizia "Aguardando
  lançamento" sobre um vídeo já liberado. O piso é **contagem**, não dia da
  semana — é ele que sobrevive ao canal que publicar num domingo. Enquanto o
  sábado não chega o vídeo pode não estar público, e falhando o download a
  resposta diz o que fazer ("ainda não liberado pelo canal — tente mais perto de
  22/Ago"), em **dois lugares**, porque são dois fluxos: o cartão sobre a preview
  ("Tocar agora" fecha a Biblioteca) e o card da série (pelo Cronograma ela
  continua aberta). Sem a frase, é indistinguível de queda de rede.
- **E O APP PROCURA o episódio desta semana, em vez de esperar o TTL**
  (`serieTemODaSemana`, no `indiceVencido`). O TTL de 12 h responde *"a lista
  envelheceu?"*; a pergunta do operador ao abrir o app é outra — *"já saiu o
  vídeo deste sábado?"* —, e um índice de onze horas atrás é FRESCO para o
  primeiro e pode ser de antes da publicação. Enquanto o episódio faltar, o
  índice está vencido; **achado, a procura se desarma sozinha** e a série volta
  a custar zero requisição. Quem responde é `AVSerie.ehDoSabadoAtual`, a MESMA
  função do bloco de destaque — duas contas de calendário divergiriam, e foi
  uma divergência dessas que produziu o defeito da v1.2.19. Três guardas, e as
  três são o que a mantém invisível: **piso de 30 min** entre procuras (o
  `visibilitychange` chama o mesmo caminho dezenas de vezes por culto), **a
  primeira passada da SESSÃO ignora o piso** (é o pedido ao pé da letra — uma
  carga de página é rara e é o instante em que se pergunta), e **só o ANO
  CORRENTE** (em 2027 nenhum episódio do álbum de 2026 é "o desta semana", e sem
  a guarda um álbum antigo seria procurado para sempre). Nada aqui baixa vídeo:
  roda `fetchSerieIndex`, que só refaz a LISTA. O preço declarado é o episódio
  publicado SEM data no título — ele nunca satisfaz a pergunta, e a série é
  procurada a cada meia hora até a data entrar no título.
- **O QUE AINDA NÃO SAIU NÃO ENTRA NA LISTA** (campo `futuros`). **Os DOIS canais
  fazem isso** — sobem o período inteiro e liberam um sábado por vez —, e os que
  faltam aparecem na playlist e **não tocam**. A régua é a DATA (único sinal
  deste lado — o item de um vídeo restrito chega idêntico ao de um liberado), o
  corte é INCLUSIVO no dia do culto, e vídeo SEM data nunca é escondido. O DIA
  entra também na ASSINATURA das playlists, senão a economia devolveria a lista
  de ontem no sábado de manhã.
  - **O Provai e Vede entrou na regra na v1.4.15, e a medição que o mantinha de
    fora estava ERRADA.** Ela dizia *"em 15/ago já tinha até 26/set, e aqueles
    tocam"*: a primeira metade era verdade, a segunda nunca foi verificada — o
    que se olhou foi a LISTA, não a reprodução. O campo desmentiu (29/08/2026:
    `ContentNotAvailableException` num episódio de 22/Set).
  - **O campo FICA, embora hoje os dois valores sejam iguais.** Ele separa a
    política do mecanismo; um canal que um dia publique de verdade o mês inteiro
    volta a `mostrar` numa linha. O oráculo prova o MECANISMO com uma série
    sintética (os dois valores sobre a mesma entrada), e não os valores que o
    catálogo tem hoje — que mudam quando um canal muda.
- **O NOME DO ITEM pode não sair do título do vídeo.** No Informativo o título é
  a série mais a data, e "o nome é o que vem antes da barra" daria 52 linhas
  idênticas. São DOIS modos, no campo `titulo` do catálogo:
  `TITULO_ESQUERDA` (o padrão — o nome à esquerda da barra) e `TITULO_SERIE` (o
  rótulo da série mais a data). **O Informativo é `TITULO_SERIE` desde a
  v5.271**, porque o item SAI do álbum (vai para o Cronograma, para a fila) e
  uma data sozinha não o identifica lá fora. **`nomeDoItem` nunca devolve vazio** — sem data e sem
  título ele cai no título CRU, que é feio e longo, e é infinitamente melhor que
  uma linha em branco na lista do culto.
- **A assinatura das playlists evita doze extrações por retomada** (a aba do canal
  já diz quantos vídeos cada uma tem). Um episódio novo muda a contagem e a
  assinatura inteira é refeita — "tudo ou nada" de propósito.
- **E A REGRA ENTRA NESSA ASSINATURA** (`AVSerie.impressao`): o índice guarda os
  nomes JÁ FORMADOS e a ordem JÁ decidida, e a assinatura do canal não sabe nada
  sobre a regra que os produziu — sem a impressão, mudar a regra deixa o índice
  de pé para sempre, e nem limpar o cache resolve (ele mora no IndexedDB). É um
  hash do PRÓPRIO CÓDIGO das funções que decidem, e não um número à mão: quem
  esquecesse de subir o número reproduziria o defeito.
- **O índice falha com EXCEÇÃO, nunca com lista vazia.** `syncCollection` trata
  exceção como "sem internet" e PRESERVA o índice; zero itens apagaria da tela a
  série inteira que o operador já tem baixada, por uma oscilação de rede.
- **`lyrics: null` no registro não é enfeite:** `songVariantsNeeded` pergunta
  `fullRec.lyrics === undefined`, e sem o campo os 52 episódios seriam rebaixados
  a cada sincronização, para sempre e em silêncio.
- **`aportuguesar` em TODO extrator.** No padrão en-GB o YouTube devolve o título
  TRADUZIDO: `(15/Ago)` viraria `(15/Aug)` e a marca de Libras mudaria de
  palavra — as duas coisas de que a regra depende. A paginação sai do MESMO
  extrator (`ex.getPage`), nunca de `getMoreItems(service, …)`, que monta um
  extrator novo por dentro e nasceria sem o `forceLocalization`.
- **UM EPISÓDIO É UM VÍDEO DO YOUTUBE**, não uma faixa de hinário: `openSongMenu`
  desvia para `openYtMenu`, e com isso ganha de graça o caminho do YouTube
  inteiro — o download a pedido, nunca por abrir o álbum (~300 MB por episódio).
  `semSoAudio` tira o seletor Vídeo × Só áudio (um testemunho em vídeo não tem
  versão de áudio que faça sentido projetar).
- **E A LINHA TAMBÉM É A DO VÍDEO.** Quem decide é o TIPO da coleção
  (`tipoDaColecao`, com `temLetra` e `ehLink`), não um `if` por recurso: a gaveta
  que numa música abre a letra abre aqui a MINIATURA, a duração e o estado no
  aparelho — este último é o que decide, porque "Tocar agora" TRANSMITE e um
  episódio já guardado entra do disco. *Desviar as portas de um recurso não
  desvia o que estava atrás delas.*
- **A LETRA nunca é pedida para um vídeo** (`temLetra(coll)`, nos dois
  consumidores). `syncLyrics` varria toda coleção e pedia `music_<id>` ao
  LouvorJA com um id do YouTube; como falha de rede não grava `LYRIC_NONE` de
  propósito, eram ~52 requisições perdidas **por abertura, para sempre**,
  infladas no total da notificação.
- **MANTER O EPISÓDIO DA SEMANA BAIXADO** (v1.8.87). Uma caixa de marcação no
  **topo** do card aberto — acima do destaque do sábado, porque é ela que
  governa o que aquele bloco mostra —, e uma rotina na fase 5 do
  `autoRefreshCollections` (`manterSeriesDaSemana`).

  **O álbum de série continua não retendo arquivo**, e a regra da v1.1.21 não
  mudou: não há botão de baixar em lote, a barra não anuncia peso, e a série
  segue fora de "Baixar toda a biblioteca". O que entra é um detentor NOVO de
  tamanho **UM por série** — a lista `serie` de `shared/db.js`, o quinto membro
  de `LISTS`.

  - **Escrever na lista não é reter.** O que a torna detentora é estar em
    `LISTS`, que é o que o `lerDetentores` varre; fora dela o arquivo nasce
    órfão, o `gcOrfaos` da abertura seguinte o apaga, e o app rebaixa os mesmos
    ~300 MB toda semana com a lista de pé apontando para bytes que não existem.
  - **A limpeza é o `listSet`, não uma varredura.** A lista recalculada solta o
    que saiu e o blob morre na mesma transação, se nenhuma outra lista o
    segurar — o que honra de graça o episódio que o operador mandou ao
    Cronograma.
  - **MAS a lista só ENCOLHE com o substituto na mão** (`serieRetidosDa`). A
    ordem "baixar, depois limpar" não bastava, e isso foi MEDIDO: com o download
    falhando — rede caída, ou o vídeo ainda não liberado pelo canal, que é o
    caso normal de segunda a sexta — a lista saía vazia e o `listSet` matava o
    episódio da semana passada de qualquer jeito. O pior caso passa a ser um
    episódio a mais no aparelho até o download vir.
  - **A guarda de rede é `isConfirmedWifi`**, e não "não é celular" como o
    `syncLyrics`: lá são alguns kB de JSON e "na dúvida, baixa" é o certo; aqui
    são ~300 MB que ninguém pediu agora. **O preço é real, e por isso a LINHA o
    diz:** `connection.type` devolve `'unknown'` em boa parte dos aparelhos, e
    nesses a rotina nunca roda — um no-op silencioso seria a opção marcada com
    nada acontecendo, para sempre.
  - **A qualidade é a do OPERADOR** (`ytAlturaPadrao`), não um teto próprio da
    rotina.
  - **E a folha de um episódio JÁ BAIXADO omite a qualidade** (`semQualidade`),
    pela mesma régua que já a tira no caminho de só-áudio: com bytes no aparelho
    o `ytArquivo` reaproveita o registro e o teto não é consultado.
  - **O nome na frase não é o `coll.name`.** *"Manter o Provai e Vede 2026 da
    semana"* põe duas escalas de tempo na mesma linha; o nome sem o ano é
    `serie.rotulo || serie.prefixo`.

  Oráculo: `serie-mantem-a-semana.test.mjs`.
- **O CARD DA SÉRIE TEM UM BOTÃO SÓ** (v1.1.21), e é o de **atualizar a lista**
  (`syncCollection(coll, { soIndice: true })`) — puro, sem texto, na direita da
  barra. Os outros dois saíram porque **o álbum de série não retém arquivo**: um
  episódio só existe no aparelho enquanto está no Cronograma, nos Favoritos ou na
  playlist, e o coletor o recolhe quando sai de lá. Logo não há o que baixar em
  lote (~15 GB) nem o que remover — "Remover do dispositivo" ali apagaria o que
  está em OUTRA lista, ou nada. A série também sai de "Baixar toda a biblioteca",
  peso incluído, e a barra dela **não anuncia peso**: diz quantos episódios a
  lista tem, porque o peso ali era o custo de um download que não existe.
- **O EPISÓDIO DESTE SÁBADO fica DESTACADO no topo da lista** (v1.1.21,
  `blocoDestaque`), e SAI dela — duas linhas que fazem a mesma coisa, a dois
  centímetros uma da outra, é a de baixo que o operador toca por engano. Quem
  responde "qual é o desta semana?" é `AVSerie.ehDoSabadoAtual` (puro, com
  oráculo): a janela é a **semana adventista**, de domingo a sábado, e não o dia
  exato — a régua deste módulo é a data do TÍTULO, e exigir o dia faria um
  episódio datado de sexta sumir do destaque. Sem ele, o bloco diz **"Aguardando
  lançamento"** com a data do sábado ao lado: sem o bloco, um card sem o vídeo da
  semana fica indistinguível de um que não carregou.
- **O card não é desenhado abaixo do shell 41** — um card que não carrega nada é
  pior que card nenhum.

### O REGISTRO da varredura — o laço de manutenção, fechado

A regra decide a partir de NOMES que um canal muda sem avisar, e os dois modos de
errar são silenciosos por construção: playlist recusada some da Biblioteca sem
erro no console, vídeo aceito sem data entra fora de ordem. O bloco **"Séries do
YouTube (o que a regra achou)"** entra no Registro de Configurações e diz, por
série: o catálogo, a leitura da aba do canal (playlists aceitas e recusadas, com
o MOTIVO), a varredura dos vídeos (vistos, entraram, recusados) e os nomes na
ordem em que a lista mostra.

```
· Informativo Mundial das Missões 2026 — https://www.youtube.com/@daniellocutor
  prefixo "Informativo" · 2026 · playlists por trimestre · rótulo pela data e pelo nome da série
  aba do canal (há 2 min): 5 playlist(s), 2 aceita(s)
    - "Misiones | 3º Trimestre 2026" → não começa com "Informativo"
    + "Informativo | 3º Trimestre 2026" → mês 7 · 13 vídeo(s) no canal
  vídeos (varredura há 2 min): 14 vistos, 13 entraram, 1 recusado(s)
    - "Informativo Mundial de las Misiones | 15 AGOSTO 2026" → está em outro idioma
    ! 1 entrou(entraram) SEM data no título: "… | especial de encerramento"
```

- **O motivo sai de quem DECIDE.** `AVSerie.avaliarPlaylist`/`avaliarVideo`
  devolvem `{ mes, motivo }` e `{ motivo, data }`; `mesDaPlaylist` e
  `itensDaPlaylist` são consumidores delas.
- **A ORDEM das perguntas é o que o texto mostra**, e por isso virou contrato:
  uma playlist em espanhol sai como "não começa com Informativo" — o prefixo já
  a elimina —, e o motivo por IDIOMA fica para os VÍDEOS.
- **Guarda o nome CRU.** Um rótulo já formado prova que a regra rodou; só a
  entrada dela diz por que ela produziu aquilo.
- **DUAS metades com datas próprias**: a aba do canal é lida em toda passada, as
  playlists não (a assinatura pula as ~12 extrações). Um carimbo só anunciaria
  como "de agora" uma lista de três dias atrás.
- **O que ENTROU sem data é um ACHADO, não uma recusa** — é a única coisa deste
  caminho que erra em silêncio **e** continua funcionando.
- **O BLOCO É RESUMO, NÃO LISTAGEM** (v1.1.19). Ele nasceu nominal — cada recusa
  com o nome verbatim, e os nomes formados um por linha — e MEDIDO num aparelho
  isso deu **~140 de ~170 linhas** de uma cópia, com "não começa com Informativo"
  repetido sessenta vezes, **enterrando a linha do tempo**, que é o único bloco
  que responde *"o que aconteceu no culto?"*. Hoje: as ACEITAS saem nominais (são
  poucas e são o que prova que a regra achou), as RECUSADAS saem **contadas por
  motivo** com os primeiros nomes CRUS de cada grupo (`SERIE_NOMES_POR_MOTIVO`) —
  é lendo um nome que se descobre uma renomeação em massa, e é para isso que o
  bloco existe —, e os nomes formados viram as **BORDAS** (`N na lista, de "…" a
  "…"`), porque ordem se confere nas pontas e o defeito do MEIO tem sinal
  próprio: o `! entrou SEM data`, que segue nominal. Nenhum corte é silencioso —
  o que sai continua contado. Oráculo: `boot-nativo.test.mjs`.
- **O diário VENCE o índice.** Índice sem o carimbo `serieDiarioEm` conta como
  vencido (`indiceVencido`) — senão um aparelho que já tinha a lista passaria as
  12 h do TTL dizendo "ainda não varrido" justamente enquanto o operador olha. O
  carimbo é escrito nos **dois** caminhos do `fetchSerieIndex`, senão o canal
  seria extraído a cada abertura.
- **A metade do canal é gravada ANTES do primeiro `throw`**: "nenhuma playlist no
  canal" é o caso em que a pergunta "por quê?" mais importa.

### O tamanho, dito em vez de escondido

~52 episódios/ano de ~300 MB em 1080p: o ano passa de **15 GB**. Por isso **não
existe "baixar o álbum"** — o uso normal é tocar o episódio do sábado, que
TRANSMITE sem baixar nada; guardar offline é mandá-lo ao Cronograma ou aos
Favoritos pela folha, um a um.

---
