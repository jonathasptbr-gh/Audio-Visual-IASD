<!-- Parte do capítulo do Controle (o índice das partes está em CONTROLE.md;
     o mapa geral, em docs/ARQUITETURA-WEB.md). Partida do CONTROLE.md na
     revisão A3 (2026-10-30): o texto foi MOVIDO verbatim. -->

## Controle — as coleções de mídia (LouvorJA) e os acordeões

> Parte do capítulo do Controle — o índice das partes e as regras que valem
> para o Controle inteiro estão em [`CONTROLE.md`](CONTROLE.md).

**Nesta parte:** [Coleções de mídia (LouvorJA)](#coleções-de-mídia-louvorja) · [Os acordeões abrem animados](#os-acordeões-abrem-animados) · [O redesenho que o operador NÃO pediu espera a gaveta fechar](#o-redesenho-que-o-operador-não-pediu-espera-a-gaveta-fechar)


### Coleções de mídia (LouvorJA)

Integração com o catálogo público do app **LouvorJA** (`api.louvorja.com.br`,
mesmo backend usado pelo app `app-ja`), para trazer **todo o acervo** como fonte
de mídia offline, sem copiar nenhum código do app-ja (Vue/Vuex) — só o
**protocolo HTTP** dele é reaproveitado, via um cliente próprio e mínimo:
`controle/louvorja.js` (`window.Louvorja`, JS puro, sem dependências).

> 📄 **Referência completa da fonte de dados:**
> [`docs/FONTE-DE-DADOS-LOUVORJA.md`](../FONTE-DE-DADOS-LOUVORJA.md) documenta
> **toda** a estrutura técnica classificatória do banco compartilhado (endpoints,
> token, convenção de nomes dos arquivos `json_db` e o schema de cada tipo —
> `music_{id}`, `album_{id}`, listas de músicas/hinários/coletâneas/bíblia,
> `config`, servidor de arquivos). Consulte-o para pedir **qualquer** arquivo do
> sistema sem precisar abrir o repositório do `app-ja`.


- **`Louvorja.fetchList(file)`** — `GET {url-base}/{file}?{YYYYMMDD}` com
  header `Api-Token`, mesmo formato do `Database.js` do app-ja (URL de
  produção + token embutidos no arquivo — já públicos no bundle do app-ja,
  não é um segredo protegido).
- **`Louvorja.fileUrl(path)`** — resolve um campo de URL do banco (ex:
  `url_music`) para a URL completa de download do arquivo.
- Arquivos consumidos: as **listas** `pt_hymnal`/`pt_hymnal_1996` (hinários) e
  `pt_categories` (catálogo de álbuns → `album_{id}`); o **registro individual**
  `music_{id_music}` (com `url_music`, `url_instrumental_music`, `url_image`,
  letra). Constantes de conveniência: `Louvorja.HYMNAL_2022_FILE`,
  `HYMNAL_1996_FILE`, `CATEGORIES_FILE`.

#### O servidor da LouvorJA fora do ar: um veredito, dois avisos (v1.12.43)

Pedido do operador: *"um sistema de 'o servidor está em manutenção', mas esse
sistema não deve interferir em quem já tem as listagens ou os arquivos offline
… deve ser diferenciado de um aviso de 'sem internet'"*. A instalação nova
depende INTEIRA do servidor para listar e baixar, e ele não é nosso.

**UM veredito** (`fonteVeredito`, a seção "O SERVIDOR DA LOUVORJA" logo depois
de `collSongs`), três desfechos:

| estado | quando |
|---|---|
| `ok` | o banco respondeu — inclusive um status de NÃO-recusa: **um 404 é sobre UM item, e o servidor está no ar** |
| `servidor` | 5xx/401/403/429 (o status fica guardado); ou sem resposta/prazo (`FONTE_PRAZO_MS`, 8 s) com a internet de pé; ou o banco respondendo sem deixar ler (`Louvorja.sondarBanco`, CORS) |
| `sem-internet` | `navigator.onLine` falso, ou nem o banco nem `sondarInternet` responderam |

- **`sondarInternet` NÃO é a LouvorJA**: dois hosts que o app já usa
  (`www.youtube.com/generate_204` e a página do app), `no-cors`, `Promise.any`.
  É a MESMA sonda da linha "Há internet agora" da Verificação, que até a
  v1.12.42 sondava a própria LouvorJA — perguntar ao suspeito se ele está vivo.
- **O tráfego de sempre alimenta o veredito** (`Louvorja.observar`): lista que
  chega → `ok`; recusa → `servidor`; sem resposta → apuração (coalescida). A
  apuração explícita (`apurarFonte`, uma por vez) roda na abertura de quem
  ainda não tem a listagem, no "Tentar de novo", a cada `FONTE_RECHECA_MS`
  (60 s) com o veredito ruim e o app à vista, e ao abrir a Biblioteca, a
  Bíblia ou voltar ao app (`reapurarFonteSePreciso`, piso de 10 s).
- **O que ele barra** (`fonteBloqueada`): os botões de baixar/listar de card e
  de grupo — APAGADOS, com `fonteMotivoCurto` no `title` (o cancelar de um
  download em curso nunca) —, o download sob demanda de uma música
  (`ensureSongDownloaded` re-apura no toque e, ainda ruim, não pede; `motivoDoCartao` nomeia o
  servidor) e a escolha de versão não baixada da Bíblia (a varredura dela tem o freio próprio e não é segurada). **Nada
  mais**: YouTube, reprodução, importados, Cronograma, telão.
- **O aviso GRANDE só onde falta a LISTAGEM** (`fonteDependente`: NADA listado
  — nenhum hinário com índice E o catálogo de álbuns vazio). Quem já tem a listagem vê o que
  tinha, com os botões de baixar apagados e mais nada. O aviso
  (`fonteAvisoEl`, posto por `acertarAvisoDaFonte`) mora **FORA** da lista,
  entre a barra e `#hymnResults`, e só no acervo (numa busca ele sai). Dentro
  dela ele quebrava as contas dos blocos de raiz (a tampa, o vão dos Favoritos,
  "as fechadas empilhadas na base" — MEDIDO em quatro oráculos); fora, a lista
  só fica mais baixa. Na Bíblia ele entra no lugar da nota do capítulo e no topo
  da lista de versões. Duas
  caras: servidor = `--btn-warn` + `--warn-text`; sem internet = `--bg` +
  `--text`/`--muted`. "Tentar de novo" está na lista do `--press`.
- **A volta** (`fonteAoMudar`, de ruim para `ok`) redesenha e dispara a
  primeira listagem (`autoRefreshCollections`, `garantirBibliaBase`).
- O Registro tem o bloco "Servidor da biblioteca (LouvorJA)" logo depois da
  linha do tempo, e cada transição entra na linha do tempo. Oráculo:
  `servidor-indisponivel.test.mjs`.

#### As SEÇÕES TEMÁTICAS do Hinário 2022 (v1.1.12)

O hinário impresso tem 8 blocos e 35 seções — as 28 crenças fundamentais mais os
infantis e os litúrgicos — e o app passa a mostrá-las em dois lugares: um
**índice de temas** no topo do card e **títulos intercalados** na listagem.

**O BANCO NÃO TEM ESSE CAMPO.** `pt_hymnal` traz `id_music`, `track`, `name`,
`duration` e `has_instrumental_music`, e mais nada; `pt_categories` é
coletânea→álbum, não seção de hinário. O que identifica a seção de um hino é a
POSIÇÃO dele — exatamente como já acontecia com a faixa infantil do `sorteio.js`.
Daí a resposta ser uma TABELA DE FAIXAS (`controle/hinario.js`, pura, com
oráculo), transcrita do índice publicado pela CPB.

| peça | onde | o quê |
|---|---|---|
| a tabela | `controle/hinario.js` | 35 faixas, `secaoDe`/`comecaSecao`/`indice`. PURA — não sabe nada de coleção, só traduz NÚMERO em SEÇÃO |
| o índice | `indiceDeSecoes` | a barra no topo do card, **fechada por padrão**, e a grade de chips |
| os títulos | `cabecalhoDeSecao` | um `<li class="hino-secao">` antes do primeiro hino de cada seção |
| o salto | `irParaSecao` | estica a lista até o destino EXISTIR e rola até ele |

**As decisões que precisam estar ditas:**

- **O índice NASCE FECHADO.** São 35 seções: abertas, empurrariam os 600 hinos
  para baixo de um paredão que o operador teria de rolar toda vez que abrisse o
  hinário — inclusive nas nove vezes em dez em que ele já sabe o número que quer.
  Mesma regra da v1.1.4 ("a Biblioteca abre com tudo fechado"), um nível abaixo.
  O estado mora na `ui()` do álbum (`u.indiceAberto`), como todo estado de
  navegação daqui: o card é REMONTADO a cada redesenho, e um estado guardado no
  nó morreria junto com ele.
- **SÓ O HINÁRIO NOVO** (`ehHinarioNovo`, hoje um lugar só — a capacidade do
  `sorteioCap` aponta para a mesma função). Os números são os do 2022; o de 1996
  tem 613 hinos e outra organização, e um "Infantis" sobre o 508 dele é um rótulo
  MENTINDO. É o defeito que este recurso inteiro existe para não ter, e é o que
  ninguém notaria olhando o hinário certo — daí ele ter oráculo próprio.
- **O cabeçalho sai de `comecaSecao`, nunca de "mudou em relação à linha
  anterior".** A lista chega de `COLL_PAGE` em `COLL_PAGE` e a linha anterior nem
  sempre está no DOM: a comparação erraria exatamente na primeira linha de cada
  página, desenhando um cabeçalho a mais no meio de uma seção.
- **A retomada da paginação conta `.hymn-result`, nunca os filhos da lista.** Os
  cabeçalhos moram na MESMA `<ul>`; contá-los faria a página seguinte começar
  adiantada, **pulando um hino por cabeçalho já desenhado** — hinos sumindo do
  meio da lista, sem erro nenhum.
- **O salto GARANTE a linha antes de rolar.** Pedir "Despedida" (592) com 100
  linhas desenhadas rolaria até o fim de uma lista que ainda não tem o destino;
  `irParaSecao` estica o `u.shown` em páginas INTEIRAS (um valor quebrado
  deixaria a paginação seguinte fora do passo) e só então rola.
- **A faixa infantil está escrita nos DOIS arquivos** (`hinario.js` e
  `sorteio.js`), e a duplicação é deliberada: fazer um módulo puro importar outro
  para ler duas constantes trocaria uma duplicação visível por um acoplamento
  invisível. Quem impede a divergência é o oráculo, que compara os dois.

#### Sistema de coleções (genérico)

O que antes era exclusivo do Hinário 2022 virou um **sistema genérico de
coleções**, todo parametrizado por uma `coll = { id, name, kind, source, iconKey }`
(ver `allCollections()`/`FIXED_COLLECTIONS` em `controle.js`). Cada coleção tem
**uma pasta OPFS própria** (`folders/<coll.id>/`) e um **card** no acervo (o
estado padrão da busca; até a v5.43, a aba Álbuns).
Dois tipos:

- **`hymnal`** (fixas): a `source` é um arquivo de **lista** (`pt_hymnal`,
  `pt_hymnal_1996`) que já é o índice completo de hinos. Sempre visíveis; o
  índice leve é atualizado sozinho (`autoRefreshCollections`).
- **`album`** (dinâmicas): descobertas em `pt_categories`
  (`fetchAlbumCatalog` → `state.albumCatalog`, um card por álbum, agrupados
  por categoria). O índice de
  cada álbum vem de `album_{id}.musics` e é buscado **automaticamente**
  (`autoRefreshCollections`, fase 2 — só metadados, sem áudio), com
  concorrência limitada e um TTL (`ALBUM_INDEX_TTL`, 12 h) pra não refazer N
  requisições a cada retomada; álbuns novos/vazios são sempre buscados. **E o
  álbum COM DOWNLOAD no aparelho é relido na abertura mesmo dentro do TTL**
  (`forcarIndice`, v1.1.16): é o que o botão "Verificar" fazia, e é o que faz o
  botão de BAIXAR aparecer sozinho quando o catálogo cresce. UMA VEZ POR SESSÃO
  (`indicesForcados`) — esta função roda a cada `visibilitychange`, e forçar a
  cada volta ao app seria uma rajada de requisições na Wi-Fi da igreja. A SÉRIE
  fica de fora: o índice dela custa uma extração do canal do YouTube. Assim a
  busca do acervo cobre **todas** as músicas de **todos** os álbuns mesmo sem
  nada baixado (tocar num resultado baixa sob demanda — igual ao hinário).
  Álbuns cujo nome parece de hinário são pulados (já têm card dedicado).

O himnário em espanhol e demais idiomas ficam de fora naturalmente — só
consumimos arquivos `pt_*`.

**Estado por coleção**: `state['coll:<id>'] = { indexSyncedAt, songs:[…] }`;
fonte de verdade em memória (`collState`, carregada uma vez no `init` por
`loadCollections()`). **Migração**: o antigo `state.hymnal2022` é copiado para
`coll:hymnal-2022` (mesma pasta OPFS `hymnal-2022` — downloads já feitos
continuam válidos). UI transitória (sync em andamento, status, peso) fica em
`collUI` (não persistida).

**O navegador do acervo** (`renderCollectionsList(alvo, redesenhar, opts)`)
renderiza um card por coleção (`renderCollectionCard`), **agrupados por
categoria** — as quatro coleções fixas soltas no topo (as duas séries, depois os
dois hinários), depois cada categoria do banco. Ele **não tem aba própria**: desde a v5.43 é o estado padrão do popup da
lupa, e desde a v5.44 é o único (ver "O acervo É o estado padrão da busca"). A
função recebe o elemento-alvo e o callback de redesenho justamente por isso —
duas cópias divergiriam no primeiro ajuste de categoria.

O card do Hinário **saiu da tela de pastas** (hoje os **Favoritos**, que voltou
a ser só pastas e pastas do sistema).

> **As pílulas de filtro saíram na v5.70.** Havia uma faixa rolável no topo
> (`.coll-filters`/`.coll-pill`: Todos · Hinários · uma por categoria do banco,
> guardada em `albumFilter`), pensada para cortar caminho até um grupo sem rolar
> a lista. Ela cobrava um recorte antes de mostrar o acervo, e o acervo já vem
> recortado: os cabeçalhos de categoria são o mesmo agrupamento, na mesma ordem
> do banco, e os cards são colapsados — a lista inteira cabe em pouquíssimas
> telas de rolagem. Quem sabe o nome digita, e o campo de busca fica logo acima.
>
> Tirá-las simplificou o render: `albumFilter` era o único motivo de três ramos
> em `renderCollectionsList` (ocultar os hinários, pular categorias, e um
> retorno antecipado que escondia os álbuns órfãos e trocava a mensagem de lista
> vazia), e do parâmetro `showName` do cabeçalho de grupo — que hoje só serve a
> "Todo o acervo", onde o nome já está dentro do botão. A faixa também era uma
> exceção no reconhecedor de deslize do carrossel de abas (um trilho horizontal
> dentro de uma área que troca de aba na horizontal); essa exceção saiu junto.

Os mecanismos abaixo (sincronização/download/letra/Wi-Fi/busca) valem **por
coleção**, exatamente como antes valiam só pro Hinário 2022.

#### Baixar a coleção COMPLETA (`syncGroup`)

O cabeçalho de cada grupo (`.coll-group`) deixou de ser só um rótulo: ele
carrega o **resumo do grupo inteiro** (`baixados/total`, somando todos os
álbuns dali) e o botão que **baixa a coleção completa** — "CDs Oficiais/Ano"
tem uma dúzia de álbuns, e sincronizar um a um pela engrenagem de cada card era
uma dúzia de idas ao popup. Vale para os três tipos de grupo: os hinários, cada
categoria do banco e os álbuns órfãos.

O cabeçalho pode **omitir o nome** e continuar existindo (`showName === false`)
— o que estava lá antes era redundante, o que está lá agora é uma ação. Hoje só
"Todo o acervo" usa isso, porque ali o nome já está dentro do próprio botão;
antes da v5.70 valia também para o grupo que a pílula de filtro selecionada já
nomeava.

- **Um álbum por vez, nunca em paralelo** — e isso não custa velocidade: o
  limite de conexões é por HOST, não por álbum (ver `NET_CONCURRENCY`). Dois
  álbuns com 3 downloads cada dariam exatamente as mesmas 6 conexões que um
  álbum com 6, só que com o progresso fragmentado e mais estado concorrente.
- **A pergunta de rede é feita UMA VEZ para o lote.** Fora do Wi-Fi, um
  diálogo com a contagem de álbuns e a estimativa somada; a resposta é
  repassada a cada `syncCollection` via `opts.allowMobile`, então nenhum deles
  pergunta de novo. Sem isso seriam doze diálogos seguidos, que ninguém lê — e
  a decisão continua sendo do operador, como manda a política de Wi-Fi.
- **O lote inteiro é UMA tarefa de segundo plano** (`withBgWork` em volta do
  laço, não por álbum): senão o `SyncService` seria desligado no fim de cada
  álbum e o processo podia ser congelado justamente entre um e outro — que é o
  cenário normal, já que o operador dispara e sai do app.
- **Cancelável na próxima MÚSICA, não no próximo álbum.** Durante o download o
  botão vira ✕; o toque marca `cancel`, e esse sinal **atravessa o álbum em
  curso** (`opts.cancelled`, lido pelo `worker` de `syncCollection`). Parar só
  entre álbuns era, na prática, não poder parar: há álbuns de centenas de
  faixas, e o operador ficava preso ao lote inteiro depois de mudar de ideia.
  Medido com o código real (600 faixas): o cancelamento custa **6 músicas**, as
  que já estavam no ar.
- Estado transitório em `groupUI`/`gui(key)` (não persistido), com
  `setGroupStatus` espelhando o `setCollStatus` dos cards — logo, o progresso
  também passa pelo re-render coalescido.
- **A notificação do sistema acompanha o LOTE**, não cada álbum: o total é a
  soma das músicas pendentes de todos eles, contada uma vez no começo
  (`bgTaskStart` no `syncGroup`, e `syncCollection` recebe `notifOwned` para
  não abrir uma tarefa própria). Ver "Progresso em segundo plano".
- **Um álbum do LOTE não pode cancelar a si mesmo.** `syncCollection` interpreta
  uma segunda chamada com `syncBusy` ligado como "o operador tocou de novo" e
  **aborta** o download em curso — que é o comportamento certo para o botão, e
  desastroso para o laço: o lote pedia dois downloads e o efeito líquido era
  parar um. `opts.fromGroup` marca a chamada como programática, e aí o lote
  apenas **pula** o álbum que já está baixando por conta própria.
- **Sem rede, o cabeçalho conta as falhas.** `fetchCollectionIndex` lança em
  cada álbum e o laço inteiro termina em segundos sem baixar nada; anunciar
  "Coleção completa" em verde ali mandava o operador embora convencido de que o
  acervo estava no aparelho. O status por álbum existe, mas fica dentro de um
  card colapsado e se autolimpa — o cabeçalho, que é o que ele está olhando,
  agora diz "N álbum(ns) sem rede — tente de novo". Isso só é possível porque
  `syncCollection` passou a **devolver um resultado** (abaixo).

> **"Baixar TODO o acervo" SAIU na v5.258**, a pedido do operador: com as
> séries do YouTube a escala virou dezenas de GB (~15 GB só de um ano de
> episódios), e um botão que baixa tudo deixou de ter significado. `renderAcervoTotal`
> foi apagado junto. Ficam os dois downloads com **tamanho de decisão**: por
> coleção (a barra do card) e por categoria (`montarResumoGrupo`).

#### Concorrência de download (`NET_CONCURRENCY`)

Quantas requisições ficam em voo ao mesmo tempo — usada pelo download de
músicas (`syncCollection`), pela Bíblia e pela atualização de índices.

**6 é o teto de conexões simultâneas por host** do motor do WebView em
HTTP/1.1, medido no Chromium com um servidor de latência (36 arquivos de
400 KB, 250 ms de RTT), mediana de 3 rodadas:

| concorrência | tempo | ganho | pico real de conexões |
|---|---|---|---|
| 3 | 3,24 s | (base) | 3 |
| **6** | **1,77 s** | **+82%** | **6** |
| 8 | 1,71 s | +89% | 6 |
| 12 | 2,05 s | +58% | 6 |
| 24 | 1,77 s | +83% | 6 |

De 3 para 6 o download quase **dobra**; acima de 6 o navegador enfileira e não
há ganho — só mais Blobs em memória ao mesmo tempo. Como cada música é baixada
**sequencialmente** (metadados → capa → Cantado → Playback, com as imagens de
estrofe em série por causa do cache compartilhado `resolveImage`), a
concorrência do laço é exatamente o número de conexões: é este o parâmetro que
importa, e não "quantos álbuns ao mesmo tempo".

Ressalva honesta: se o servidor do LouvorJA falar HTTP/2, o limite de 6 não se
aplica (multiplexação) — mas aí o gargalo passa a ser banda, e mais streams
paralelos também não aumentariam o total. 6 é seguro nos dois cenários. O
protocolo real não pôde ser verificado (a rede de desenvolvimento não alcança
`api.louvorja.com.br`).

#### Progresso em segundo plano (`bgTaskStart`/`bgTaskStep`)

Com o app minimizado — o uso normal durante uma sincronização — a notificação do
`SyncService` é a única janela para o download. Quem sabe o progresso é o lado
web, então é ele que reporta, por
`AVNative.bgProgress({label, done, total, etaMs, items, idleMs, bytes})`.

Instrumentados: `syncCollection` (por música), `syncGroup` (por música, no total
do lote), `ensureBibleVersionDownloaded` (por capítulo) e `syncDeviceFolder` (por
arquivo).

- **A notificação mostra O QUE está baixando.** `bgItemStart`/`bgItemEnd`
  registram os itens em voo por tarefa (`bgItemOnly` para fluxos sequenciais,
  cujos `continue` deixariam nomes presos na lista). "23 de 54" é abstrato;
  "002. Ó Adorai o Senhor" é o que o operador reconhece.
- **A lista é uma FILA (`t.fila`), não um espelho do que está no ar.** A
  concorrência reduz o tempo PROPORCIONAL de cada item: se os 6 juntos levam X,
  cada um custou X/6 — e a exibição segue a mesma conta. É ilustrativa; contador,
  barra e estimativa seguem sendo os números reais. **Fila, nunca rodízio**: o
  rodízio repetia nomes e a lista não avançava (medido com 18 faixas e 6 em
  paralelo: 18/18 exibidos, 0 repetidos, em ordem).
- **O ritmo é MEDIDO** (`bgSpinMs` = `decorrido / concluídos`): mediana de 500 ms
  em tela contra 521 ms de custo amortizado real.
- **Sem o buffer a lista engasgava.** Os 6 workers andam em lockstep: os eventos
  chegam em RAJADA seguida de segundos de silêncio, e sem fila a rajada rendia
  UMA troca de nome — parado até a rajada seguinte, que é a sensação de travado.
- **O compasso PARA quando trava** (`BG_STALL_MS`, 90 s sem evento real): animar
  durante uma queda de rede esconderia o que precisa ser visto. A lista congela e
  o `idleMs` cresce — os dois sinais concordam.
- **`idleMs` separa "travado" de "esta faixa é grande".** Passado o limiar, a
  notificação para de prometer tempo restante (uma ETA sobre um ritmo que já não
  existe é a promessa mais enganosa possível) e passa a "sem resposta há X" — sem
  degraus, porque aqui o número precisa SUBIR a cada atualização.
- **Um freio só (`BG_NOTIF_MIN_MS`, 700 ms), e vale apenas para a ROTINA.** Tudo
  que precisa chegar na hora passa `force`. Quem dá o ritmo do item que entra é o
  compasso (`bgPacerTick`, `BG_TICK_MS` = 250 ms), que envia com `force` sempre
  que o nome troca — um segundo piso curto seria PIOR, porque o primeiro nome de
  uma tarefa nasce a poucos ms da abertura e ficaria retido até o batimento de 2 s.
- **`bgTasks` é um REGISTRO (Map), não um slot único.** Downloads simultâneos
  existem — daí `bgWorkCount` contar em vez de ser booleano — e com um slot só as
  tarefas se sobrescreviam: o `done` de uma saía com o `total` e o relógio da
  outra. A notificação mostra a **dominante** (maior tempo restante) e marca as
  demais com `(+N)`.
- **A estimativa** sai do ritmo médio desde o **primeiro item concluído**, nunca
  desde o `start` (que incluiria o preparo — índice, varredura — e inflaria a
  primeira leitura). Média, não taxa instantânea: faixas têm tamanhos muito
  diferentes. **Suavização assimétrica por constante de tempo** (`ETA_TAU_DOWN`
  2,5 s / `ETA_TAU_UP` 10 s) e arredondamento em degraus no lado nativo. Por
  TEMPO e não por chamada — o compasso de 1 s pede a estimativa muito mais vezes
  que os eventos pediam, e um fator fixo por chamada devolveria o número instável.
- **`bgWorkEnd` é IDEMPOTENTE, e precisa ser.** O `clear()` sozinho deixava o
  compasso ligado para sempre: com o Map já vazio, o `bgTaskEnd` seguinte não
  achava nada, o `delete` devolvia `false`, e nem o `bgPacerSync()` nem o envio
  final rodavam — o `setInterval` de 250 ms vazava pelo resto da sessão, com a
  notificação presa. Hoje ele sincroniza o compasso e envia o estado final ele
  mesmo, e a ordem entre ele e o `bgTaskEnd` deixa de importar.
- No navegador, e num shell anterior ao `SHELL_VERSION` 10, é no-op.
   Playback/instrumental quando existir, mais a capa e as imagens por estrofe,
   gravados no **mesmo catálogo OPFS das pastas sincronizadas** (`AVDB.fileAdd` +
   `AVDB.opfsWriteFile`, pasta `folders/<coll.id>/`). Então listar, buscar, tocar
   e excluir funcionam **sem nenhum código novo** — é só mais uma pasta OPFS, com
   a fonte sendo uma API remota em vez de `showDirectoryPicker()`.

**UI — o card É o álbum, e tocar nele ABRE o álbum** (`renderCollectionCard()` +
`.hymnal-card`). A barra (`.coll-bar`) é uma **linha só**: símbolo + nome (+
subtítulo da categoria) + **peso** (ou o progresso ao vivo) + **baixar/cancelar**
(`.coll-bar-dl`) + a **seta de acordeão**, que é a `.coll-bar-icon` da THUMB
virada por CSS. Sem índice ainda, o toque leva às opções, que é onde está o
sincronizar que resolve isso.

> **O OUVINTE É DO CARD, E NÃO DA BARRA** — e a razão é um defeito que só aparece
> com o dedo. `.coll-bar` está na lista do `:active`, cujo `--press` é
> `scale(.96)`: numa barra de ~395px isso a encolhe ~8px de cada lado. O
> `pointerdown` acerta a barra e dispara o encolhimento; no `pointerup` ela já
> não está ali, e o navegador entrega o `click` ao ANCESTRAL. Medido: até ~7px da
> borda o toque não abre, de 8px em diante abre — e a margem existe nos quatro
> lados. Subir o ouvinte para o card (que não se mexe) fecha a classe inteira.
>
> A **guarda** é o `.coll-open` (o invólucro de tudo que não é a barra): sem ela,
> com o álbum aberto um toque numa faixa borbulharia até aqui e fecharia o álbum
> debaixo do dedo. Ela pergunta pelo INVÓLUCRO e não por uma lista de filhos,
> para o próximo bloco que nascer lá dentro já nascer protegido.
>
> **E A GUARDA PERGUNTA PELO CAMINHO, NÃO PELA ÁRVORE DE AGORA.** Como
> `e.target.closest('.coll-open')` ela fechava o álbum ao se tocar numa caixa de
> marcação: o botão é apagado pelo próprio handler que roda antes (marcar chama
> `renderSongMenu`, que faz `alvo.innerHTML = ''`), então quando o evento chega
> ao card o `e.target` está **desanexado** e `closest` devolve `null`. **Decidir
> pela POSIÇÃO do alvo na árvore é perguntar "onde este nó está agora", e agora é
> depois de todos os handlers que rodaram antes** — `e.composedPath()` é fixado
> no disparo e sobrevive ao apagamento.
>
> **E o `padding` mora em quem PINTA** (a barra e o corpo aberto), nunca no card:
> a barra do álbum ABERTO já desfazia o padding do card com margens negativas
> para grudar como tampa — isto é, com o álbum aberto aquela faixa funcionava e
> com ele fechado não. O mesmo pixel respondendo ou não conforme o estado.

> **Sem molduras, sem seta própria, sem faixa de cor.** Numa lista de dezenas de
> álbuns, com contorno e faixa colorida o que o olho via primeiro eram as linhas,
> não os nomes. O card é **preenchimento sólido**: dentro da folha (`--panel`)
> ele sobe um degrau para `--panel-2` — um cartão da cor do que está atrás dele
> simplesmente não existe aos olhos. **Aberto se diz no NOME**, em accent: um
> segundo degrau de tom não cabia, porque o cartão já gastou um para existir e as
> faixas ocupam o de baixo. O campo `color` continua no catálogo, de graça, se um
> dia a cor voltar como tinta do quadrado do ícone.

**O botão de baixar SAI da barra quando o álbum já está todo no aparelho** (a
condição é `u.syncBusy || !complete`): ele dizia "Baixar esta coleção" para uma
coleção que não tem mais o que baixar — um alvo do tamanho de `--hit` oferecendo
uma ação sem efeito, em cada linha de uma lista de dezenas de álbuns. O que resta
ali é manutenção, e já mora dentro do card aberto. Enquanto o download ROLA o
botão continua, porque ali ele é o cancelar. O botão de GRUPO
(`.coll-group-btn`) **não** segue a regra — ali não existe engrenagem, e sumir
com ele tiraria a única rota de re-sincronizar o grupo.

**O contador da barra é o PESO** (`fracaoPeso`), não a contagem de faixas: ele
responde a pergunta que se faz com o dedo sobre o botão de baixar — *quanto isto
vai me custar*. Quatro faixas podem ser 8 MB ou 80 MB, e é essa diferença que
decide esperar o Wi-Fi ou apagar um álbum para caber outro.

| Estado | Barra |
|---|---|
| sem índice | `não sincron.` |
| nada baixado | `230 MB` — só o que vai custar |
| parcial | `19/249 MB` |
| completo | `2,3 GB`, exato (soma do catálogo) |

O total continua sendo uma ESTIMATIVA (duração × a taxa medida no aparelho); o
que não existe é o `~` que a anunciava — `fmtBytes` já arredonda para uma casa,
então "18 MB" nunca prometeu 18.874.368 bytes, e o til pagava um caractere em
cada contagem da tela mais densa do app.

A contagem de faixas não se perde: ela continua no estado do botão de verificar,
dentro das opções do álbum. E os três contadores da tela — card, cabeçalho de
categoria e "Todo o acervo" — usam a MESMA função: um em faixas e outro em MB
seria a pior das versões. Os de GRUPO ficam mesmo completos: eles somam várias
coleções, e ali o número ainda responde alguma coisa.

**Uma coleção aberta por vez** (abrir uma fecha as demais): duas listas de
centenas de faixas empurrariam o acervo para fora da tela e tirariam do lugar
exatamente o card que o operador estava mirando. Dentro do aberto vem a lista
**inteira** de músicas — sem teto, porque ali se folheia um álbum, e cortar em 60
esconderia o fim de qualquer hinário. As linhas são as mesmas `hymnResultRow` da
busca, com `semColecao` ligado.
#### …mas ela CHEGA em páginas de 100 (v5.74)

"Inteira" é sobre o que está disponível, não sobre o que é montado no toque.
Um hinário tem **613 hinos**, e cada linha é um `<li>` com miniatura, dois
botões e SVG inline dentro deles: montar as 613 de uma vez é um bloco de
JavaScript **síncrono** no meio do toque que abre o card — a animação de
abertura nasce engasgada e o toque parece não ter funcionado. E não é uma vez
só: o card é remontado a cada redesenho do acervo, que o progresso de um
download dispara a cada `COLL_REFRESH_MS`.

`fillSongList(lista, coll, u)` monta `COLL_PAGE` (100) linhas e pendura uma
**sentinela** (`.coll-more`) no fim. Quando ela entra na tela, a página seguinte
é anexada e a sentinela se remuda para o novo fim, até acabarem as faixas.

- **O gatilho é o SCROLL, não um botão.** Quem folheia um hinário está
  procurando um hino, não administrando uma lista: parar para pedir mais é
  atrito num gesto que já é contínuo. A sentinela **também** é um botão, para o
  caso de ela aparecer sem que a rolagem a tenha alcançado (uma lista curta
  demais para rolar dentro do popup) — mas o caminho normal não passa por ele.
- **`IntersectionObserver` com `root: null`.** A viewport resolve sozinha o
  problema de descobrir QUAL elemento rola (hoje `#hymnResults`, amanhã outro):
  a interseção com a viewport já vem recortada pelos `overflow` dos ancestrais,
  então a sentinela só "aparece" quando de fato aparece na tela. O
  `rootMargin: '300px'` adianta a página — o objetivo é que o operador **nunca
  chegue a ver** essa linha.
- **É INCREMENTAL.** A página nova é anexada às linhas que já estão no DOM, sem
  reconstruir as anteriores: reconstruir mexeria no scroll debaixo do dedo que
  acabou de pedir a página.
- **`u.shown` mora no estado de UI do card** (ao lado de `u.expanded`), então um
  redesenho por progresso de download reencontra o mesmo ponto — quem já rolou
  até o hino 400 continua vendo 400.
- **Fechar zera.** Reabrir um hinário que ficou rolado até o fim traria os 613
  de volta de uma vez, que é exatamente o custo que a paginação existe para
  evitar.

#### O canto da barra: a seta que FECHA o álbum

Aberto o card, aquele canto **toma a caixa do botão de baixar** na barra
(`.coll-bar-cfg`, herdando `.coll-bar-dl`): mesma coluna, mesmo alvo, e os dois
nunca fazem falta ao mesmo tempo — fechado, o que se decide é "baixo isto?";
aberto, já se está olhando o conteúdo. Ele já foi uma barra larga rotulada dentro
do card ("Sincronizar e opções": uma linha inteira gasta com o que cabe num canto
que já existia) e uma engrenagem que revelava as opções; com as opções cabendo
SEMPRE que o card está aberto, um botão para revelá-las era cerimônia.

O toque na barra continua alternando: são dois gatilhos para o mesmo
`alternarAcordeao`.

**A exceção é o download EM CURSO.** Ali o botão da barra é o CANCELAR e
continua lá mesmo com o card aberto — um álbum de centenas de faixas, uma vez
começado, precisa poder parar num toque. Nesse estado o álbum se fecha pelo toque
na barra.
### Os acordeões abrem animados

Um acordeão que troca `display` aparece **pronto**, e num toque a lista abaixo
dá um salto — o operador perde de vista onde estava. Animar a altura mostra de
onde o conteúdo saiu, que é a informação que o salto destrói. Vale para os dois
acordeões do acervo: o **card do álbum** e a **gaveta** de cada linha.

- **A altura é MEDIDA e animada em JS** (`expandAccordion`/`collapseAccordion`,
  Web Animations API, `ACC_MS` = 220 ms). `auto` não é animável em CSS, e um
  teto fixo cortaria a letra de um hino de 40 linhas.
- **`offsetHeight`, não `scrollHeight`.** Uma gaveta com teto que role por
  dentro mediria mais do que ocupa: animar até o `scrollHeight` abriria um vão e
  depois recuaria.
- **O `overflow: hidden` é devolvido no fim** (`finish` **e** `cancel`), senão a
  lista fica presa à altura do instante em que a animação foi montada.
- **O card tem um invólucro** (`.coll-open`, com o painel de opções e a lista)
  só para a animação ter UM nó a recortar. O `overflow` não podia ir no card: a
  barra dele é `position: sticky`, e um ancestral com overflow recortado a
  prende. As margens negativas do invólucro repetem as de `.coll-songs` — o
  recorte acontece na borda do padding, e esse par põe a linha de corte
  exatamente na borda do card.
- **A abertura é sinalizada pelo render, não pelo clique**
  (`ui(coll.id).animarAbertura`): o card só existe depois de
  `redesenharAcervo()`, e a bandeira é consumida ali. Só o toque que ABRIU anima
  — um redesenho por outro motivo (o progresso de um download) reencontra o card
  já aberto, e vê-lo "abrir" sozinho leria como se algo tivesse acontecido.
- **Fechar anima ANTES de redesenhar**: o redesenho apaga o nó, e um nó apagado
  não sai deslizando.
- **A gaveta é montada antes de a linha abrir.** Uma caixa vazia mediria zero.
  Quem rola até a linha que casou com a busca é o chamador, depois de abrir —
  `scrollIntoView` numa caixa `display:none` é no-op.
- **`prefers-reduced-motion: reduce` desliga tudo** (`semMovimento()`).

> **Vocabulário: na TELA ela se chama "Biblioteca"** (v5.96). No código e neste
> documento continua sendo o **acervo** (`hymnSearchPopup`, `openHymnSearch`). Cuidado com o outro sentido de "biblioteca" que já existia
> aqui — o IndexedDB/OPFS com tudo o que o operador baixou; nos textos VISÍVEIS
> ele é "os dados do app", para as duas coisas não dividirem a mesma palavra.

**A COLUNA DA DIREITA DA BARRA** (v1.1.16) tem até dois botões, e cada um
responde a uma pergunta diferente:

| botão | responde a | quando aparece |
|---|---|---|
| **baixar / cancelar** (`.coll-bar-dl`) | "há o que baixar?" | independente de aberto ou fechado |
| **remover** (`.coll-bar-rm`) | "o álbum está aberto?" | só com o card aberto |

- **A lixeira é revelada pelo mesmo gesto que revela o que ela apaga.** Fechado,
  o card não oferece destruição nenhuma — e o acervo inteiro é uma lista de
  cards fechados; ali ela seria destruição a um toque de distância, repetida
  linha a linha.
- **O botão de baixar NÃO se esconde com o card aberto.** O `vago` existia
  porque o painel de dentro repetia a ação dois centímetros abaixo; saindo a
  repetição, sai o esconderijo. E a barra é o que gruda no topo (`sticky`)
  enquanto se percorre a lista: um álbum de centenas de faixas precisa poder
  começar (e parar) num toque, de qualquer ponto da rolagem.
- **`countDownloaded` só é chamado com o card ABERTO** — ele varre todas as
  faixas do álbum, e o acervo é redesenhado a cada 400 ms enquanto um download
  corre. O acordeão garante no máximo um card aberto, então a varredura é uma
  por redesenho, não quarenta.
- **A remoção é só a LIXEIRA**: um destrutivo pode ficar sem rótulo porque é
  CONFIRMADO, e o diálogo nomeia o alcance ("o que foi baixado… e a lista
  offline"). A frase segue no `title`/`aria-label`.
- **`stopPropagation` nos dois**, como em toda coisa que vive na barra: sem ele
  o toque borbulha até o card e o FECHA — a lixeira fecharia o álbum debaixo do
  diálogo que ela acabou de abrir.

**A COLUNA DA DIREITA tem DOIS botões possíveis** (eram três de v1.1.21 a v1.12.52),
os dois com a geometria de `.coll-bar-dl` — centros ou tamanhos que discordem
num par colado é a coisa que mais parece defeito numa linha:

| botão | classe | responde a | quando |
|---|---|---|---|
| **baixar / cancelar** | `.coll-bar-dl` | "há o que baixar?" | álbum e hinário, aberto ou fechado |
| **remover** | `.coll-bar-rm` | "o álbum está aberto?" | álbum e hinário, só aberto |

**O TERCEIRO, "Atualizar a lista" (`.coll-bar-at`, só na SÉRIE), SAIU NA v1.12.53**, a
pedido do operador: *"Remover o botão de atualizar e verificar o informativo das
missões e provai e vede, deixe essa ação automática quando o usuário abre as
respectivas coleções … Como são apenas dois, essa pequena verificação dos vídeos
da semana não será um problema … torne isso uma rotina, verificar os vídeos da
semana."* A barra da série não tem botão nenhum, aberta ou fechada; quem verifica
é a ABERTURA do card (`verificarSemanaAoAbrir`, no `alternarAcordeao` e no
`openCollectionOptions`), nos dois modos:

- **O que ela faz é o que o botão fazia, mais o passo seguinte:** refaz a lista
  (`syncCollection(coll, { soIndice: true, rotulo })`, que só extrai o canal e
  NUNCA baixa um episódio) e, com ela de pé, roda `manterSeriesDaSemana` — a
  rotina que baixa o do sábado com as regras de rede dela e solta as passadas.
- **Piso de 5 min** (`SERIE_VERIFICA_PISO_MS`; 1 min depois de uma falha, para
  quem voltou a ter rede tentar logo): abrir e fechar o card num culto não pode
  ser uma extração do canal por toque. **Uma por vez**: com `syncBusy` ela não
  pede outra.
- **CEDE À MÍDIA NO AR** (`rotinaDeAcervoPodeCorrer`), como toda rotina de
  acervo — a extração disputa a fila da ponte com o que está tocando. Adiada, ela
  NÃO arma o piso, o subtítulo diz "Verificação da semana adiada: há mídia no ar",
  e o primeiro desenho do card ABERTO com a mídia já fora do ar a retoma — sem
  pedir ao operador que feche e reabra.
- **O subtítulo da barra é o estado:** "Verificando os vídeos da semana…"
  enquanto corre (o `rotulo` do `syncCollection`), o número de episódios quando
  acaba bem, e "Sem conexão — semana não verificada" quando falha
  (`u.semanaAviso`). Sem o botão, esta linha é a única que conta.
Oráculo: `serie-mantem-a-semana.test.mjs`, bloco K.

- **A lixeira é revelada pelo mesmo gesto que revela o que ela apaga.** Fechado,
  o card não oferece destruição nenhuma — e o acervo inteiro é uma lista de
  cards fechados; ali ela seria destruição a um toque de distância, repetida
  linha a linha.
- **O botão de baixar NÃO se esconde com o card aberto** (o `vago` saiu na
  v1.1.16 com o painel que repetia a ação). A barra é o que gruda no topo
  (`sticky`) enquanto se percorre a lista: um álbum de centenas de faixas precisa
  poder começar (e parar) num toque, de qualquer ponto da rolagem.
- **A SÉRIE não tem os outros dois** (v1.1.21), e a razão é do modelo de dados,
  não da tela: **o álbum de série não retém arquivo**. Um episódio só existe no
  aparelho enquanto está no Cronograma, nos Favoritos ou na playlist. Não há
  acervo do álbum para baixar em lote (~15 GB/ano) nem para remover — "Remover
  do dispositivo" ali apagaria o que está em OUTRA lista, ou nada, e as duas
  leituras são erradas.
- **E a barra da série não anuncia PESO**: `fracaoPeso` devolve, para um acervo
  vazio, "o que vai custar baixar" — gigabytes prometendo um download em lote que
  nunca existiu. Ela diz quantos episódios a lista tem.
- **`countDownloaded` só é chamado com o card ABERTO** — ele varre todas as
  faixas do álbum, e o acervo é redesenhado a cada 400 ms enquanto um download
  corre. O acordeão garante no máximo um card aberto.
- **`stopPropagation` nos três**: sem ele o toque borbulha até o card e o FECHA
  — a lixeira fecharia o álbum debaixo do diálogo que ela acabou de abrir.

**O DESTAQUE DO SÁBADO** (v1.1.21, `blocoDestaque`/`destaqueDaSerie`): acima da
lista, só na série, o episódio desta semana — ou a frase que diz que ele ainda
não saiu.

- **O item destacado SAI da lista** (`faixasDaLista`, usada também pela
  paginação, senão o contador de "restantes" discordaria do que há na tela).
  Deixá-lo nos dois lugares daria duas linhas que fazem exatamente a mesma coisa,
  a dois centímetros uma da outra — e a de baixo, no meio de cinquenta irmãs, é a
  que o operador tocaria por engano procurando outra data. "Separado" é literal.
- **A AUSÊNCIA também é um estado**, e é o caso comum na segunda-feira: sem o
  bloco, um card sem o episódio da semana fica indistinguível de um que ainda não
  carregou. "Aguardando lançamento" responde a pergunta que o operador veio
  fazer, e o cabeçalho ao lado diz de QUE sábado se trata — sem a data, a frase
  valeria para qualquer semana. O bloco tem a mesma altura nos dois estados: ele
  não pode encolher e crescer conforme a semana, senão o topo do card salta toda
  vez que o episódio sai.
- **A linha é a MESMA da lista** (`hymnResultRow` dentro de uma `<ul>` que também
  é `.coll-songs`): o toque, a gaveta de opções, o indicador de download e o
  "Tocar agora" vêm de graça. Um cartão próprio seria uma segunda implementação
  do item mais complexo desta tela.
- **Quem decide é `AVSerie.ehDoSabadoAtual`** (puro, com oráculo), e a janela é a
  **semana adventista — de domingo a sábado**, não o dia exato. A régua deste
  módulo é a data do TÍTULO, e o canal escreve a data que quiser: exigir
  `diasAte === diasAteSábado` faria um episódio datado de sexta desaparecer do
  destaque e a tela dizer "Aguardando lançamento" sobre um vídeo que está na
  lista logo abaixo.

> **O painel `.coll-opts` não existe mais** (v1.1.21). As três ações que ele teve
> terminaram na coluna da direita da barra: o "Verificar" saiu na v1.1.16 (a
> verificação virou automática na abertura — ver `forcarIndice`), o "Baixar" já
> existia na barra e era só repetido, e o "Atualizar a lista" da série virou
> botão puro ao lado dos irmãos — e saiu da barra também na v1.12.53, quando
> abrir o card passou a verificar a semana.

> **A REGRA QUE ESTE PAINEL ENSINOU, DUAS VEZES: nada aqui repete o que a barra
> do card já diz.** Ele já teve três chips, uma linha de status e um chip de
> peso — e o peso está na barra ANTES de abrir (é ele que faz o operador decidir
> abrir), e o "Baixando 2 de 4…" está na barra `sticky` dois centímetros acima.
> Um chip permanente de REDE também saiu: quem decide se a sincronização
> pergunta antes de usar dados móveis é `isConfirmedWifi()`, e ela o diz **na
> hora, no diálogo**.

**Uma coleção SEM índice abre direto nas opções**: `openCollectionOptions` liga
`expanded` e mais nada — ali não há lista para folhear.

**O botão de sincronizar é o mesmo botão de CANCELAR.** Com o download em curso
ele vira ✕ (aviso na BORDA e no texto, porque o fundo é o progresso, e **sem
giro**: um ✕ girando não se lê como "toque para parar"). Sem isso um segundo
toque caía num `return` mudo por `u.syncBusy`. O cancelamento **fecha a fila** —
nada novo entra e o que está no ar termina: abortar no meio deixaria um arquivo
truncado catalogado como completo. `u.cancel` também é conferido na VARREDURA
(`songVariantsNeeded` por música), que num álbum grande já é demorada.

#### "Esta coleção está completa?" — uma pergunta, UMA resposta

**`levantarColecao(id)` é a fonte única**, com três funções finas em cima:

- **`colecaoCompleta(id)`** — a pergunta da tela inteira. Conta VARIANTES
  (Cantado + Playback quando a origem declara `has_instrumental_music`), nunca
  músicas. Sem índice não há resposta: um álbum que nunca sincronizou não está
  completo nem incompleto.
- **`faltamNaColecao(id)`** — quantas variantes faltam, para os diálogos e a
  notificação. Prometer "12 músicas" e baixar 10 é a forma mais barata de
  parecer quebrado.
- **`songsBaixaveis(id)`** — o DENOMINADOR do "N de M músicas".

A pergunta já foi respondida em QUATRO lugares por `countDownloaded(id) >=
collSongs(id).length` — uma conta de MÚSICAS —, enquanto o download busca
VARIANTES: um Playback faltando deixava a barra escrevendo um número EXATO ao
lado de um card que ainda mostrava o botão de baixar. **Duas réguas para a mesma
pergunta divergem sozinhas, na mesma tela.**

**"NÃO EXISTE" não é "não baixei ainda".** Uma música cuja origem não tem o
arquivo (`url_music` vazio) nunca ganha `fileIdFull`, e o efeito era permanente:
a coleção nunca ficava completa e **cada sincronização voltava a buscar o
metadado dela**. `ensureSongVariant` marca (`semAudio`/`semPlayback`) e apaga a
marca se a URL aparecer depois — o índice é reaproveitado in-place pelo
`fetchCollectionIndex`, então a marca sobrevive à atualização de graça. Daí
`levantarColecao` a conta como `semFonte`, `songVariantsNeeded` para de pedir o
metadado, e ela sai **dos dois lados** da fração.

##### A Verificação do Sistema

O tile *"Verificar"* de Configurações abre a seção `#testeSecao` (uma folha
própria até a v1.12.48), que roda a tabela
`TESTES` (40 linhas, nove áreas) e lista o desfecho de cada uma. **Ela nasceu
de uma classe de defeito, não de um defeito**: o download do acervo ficou
quebrado por semanas sem ninguém ver, porque quem já tem o acervo baixado nunca
baixa de novo — o que só é exercitado numa BORDA falha calado.

**CHECAGEM NOVA NASCE PERGUNTANDO O QUE PODE FALTAR, e não o que sempre
existe.** Duas rodadas de revisão adversarial (v1.10.1, v1.10.2) acharam TREZE
linhas que não tinham como reprovar, e todas erravam da mesma forma: mediam uma
peça do NAVEGADOR (`document.fonts.check`, `navigator.mediaSession`,
`Notification.permission`) ou o efeito de um ENVIO MUDO da ponte, em vez do
gancho de cá que o sistema chama. **A régua é a REVERSÃO**: uma asserção que
passa com o conserto desfeito não mede a checagem, mede a linguagem.

**A FOLHA SALVA O REGISTRO, e o arquivo é UM só** (v1.10.3). O botão quadrado
ao lado de *"Verificação completa"* grava o MESMO `diagTexto` do botão de
Configurações, com o MESMO nome (`nomeDoRegistro`) — a verificação já viaja lá
dentro como um bloco. **Porta nova é porta para o mesmo arquivo:** um recorte
próprio faria quem lê a distância perguntar qual dos dois vale, que é o
argumento com que a v1.10.0 recusava este botão e que sobrevive à revogação
porque é ele que decide o COMO. Ele só acende depois da rodada (`disabled` +
`title`, v1.8.50) e **monta o texto antes de gravar**: `dispararTeste` chama
`renderDiag()` sem `await`, então um toque imediato pegaria a montagem anterior
— ou, na primeira abertura, a string vazia com que `diagTexto` nasce.

**E O APARELHO É A ÚLTIMA PALAVRA** (v1.10.5). Três linhas que passaram por
projeto, cético e oráculo caíram na PRIMEIRA cópia do Registro de um Android de
verdade: a sonda de rede ia em modo `cors` sobre uma rota que não manda CORS
(vermelho com a internet respondendo nas três linhas de cima), a marca de
persistência não é concedida a um WebView (vermelho permanente sobre 2,6 GB de
biblioteca intacta) e a varredura do disco não cabe no prazo num acervo de
verdade. **O oráculo não alcança nenhuma das três** — ele roda num Chromium
sem ponte, com OPFS vazio e sem saída para a rede. Linha nova é dada por boa
depois de uma rodada no aparelho, não antes.

**O VERMELHO É SOBRE O QUE O OPERADOR USA, E A NOTA MANDA A AÇÃO QUE FECHA O
ESTADO** (v1.10.7, a terceira revisão adversarial, sobre as sete linhas da
v1.10.4). Quatro das linhas erravam por essas duas regras:

| linha | o que errava | como ficou |
|---|---|---|
| `biblia-completa` | reprovava por QUALQUER versão marcada — e o caso típico é a emparedada FORA de uso, porque o excluir é apagado sobre a em uso | só a versão EM USO reprova; a outra sai como AVISO na linha verde. E a auto-cura (`ensureBibleVersionDownloaded` confere a bandeira contra `bibliaCapitulosLegiveis` uma vez por sessão) dá à nota uma ação só: abrir a Bíblia com internet |
| `cifra-acervo` | só reprovava em ZERO folhas, e a folha nunca vence — as guardadas antes de o site mudar seguravam o verde | (v1.10.7, REVOGADA na v1.10.8) reprovava abaixo de METADE do que o acervo já respondeu — premissa falsa: o operador desmentiu por extenso e o Registro dele mediu ~48% no Hinário 2022, um acervo são. **Hoje (v1.10.8)** o corte por proporção de folhas SAIU inteiro; quem reprova é `semPagina/julgadas >= 0,15` (todo endereço dedutível respondendo 404 — o sinal de catálogo quebrado, medido em 1,7%/5,1% num acervo saudável). A frase segue dizendo os DOIS denominadores |
| `listas-*` | deixavam a PLAYLIST de fora e punham no lugar a prateleira `avulsos`, sem tela onde agir | `LISTAS_DA_VERIFICACAO`: a tríade dos destinos, uma tabela para as duas linhas |
| `pastas-contagem` | uma frase para as duas direções — e na de "mostra a mais" mandar sincronizar TRAZIA DE VOLTA o que o operador acabou de excluir | três direções com três ações, e a conta com denominador. A causa de "a cópia parou" sobre uma cópia inteira era de ORIGEM: `syncDeviceFolder` escrevia a contagem numa referência que o `load()` tinha trocado (`pastaNaLista`). **E a pasta que está sincronizando não pode ser excluída** (`pastaSincronizando`: a lixeira APAGADA e a guarda em `deleteOpfsFolder`, antes e depois da pergunta) — excluída no meio, o laço seguia gravando arquivos e registros sem dono; a contagem é feita ANTES de achar a pasta (sem `await` entre achar e gravar); e a URI nova de um resgate vai para a pasta da lista de agora |
| `acervo-fundos` | dizia *"o app já refaz sozinho"* sobre faixas cuja foto não chegou e que esperam os seis dias — e a resposta vinha do RETRATO da última passada, que a passada seguinte (que pula essas faixas) refaz com zero tentadas | lê o VEREDITO gravado da faixa (`fundoNoDiscoVale` + `!tem`), a mesma fonte do Registro: diz de quantas a foto não chegou e *"tenta de novo em até 6 dias"*; a fonte que RECUSA (HTTP) sai como *"recusou"*. **Desde a v1.10.8 a causa VIAJA NO VEREDITO** (`downloadCollectionImage` grava `causa`/`status`/`url` por faixa) — a nota nomeia a causa direto quando o veredito já a tem, em vez de só prometer que "o Registro diz por quê" numa passada futura |

**E UMA CHECAGEM QUE NUNCA TEM RESPOSTA SAI DA TABELA, não vira `na` fixo.** O
relatório é lido inteiro, e uma linha que só sabe dizer *"não se aplica"* é mais
uma para ler em toda cópia — a mesma regra do Registro, que só imprime um bloco
depois de ele ter o que dizer. Foi o que tirou a linha da notificação (v1.10.2):
quem a autoriza é a permissão do Android, e o web não tem como perguntar.

| peça | onde | o que faz |
|---|---|---|
| a tabela | `TESTES` | um descritor por checagem: `id`, `area`, `titulo`, `prazo`, `cena`, `rede`, `fn` |
| o motor | `rodarUmaChecagem` / `rodarAutoteste` | prazo próprio por linha, captura de exceção, quatro de cada vez, ordem da TABELA |
| a amostra | `amostrarEspalhado` | o teto das varreduras de acervo, esticado sobre a lista INTEIRA e com as duas pontas dentro |
| a tela | `desenharTeste` | lê o MESMO objeto que o Registro escreve |
| o Registro | `blocoAutoteste` | o bloco que o operador manda a distância. O carimbo da COMPLETA diz as duas horas — a da leve (`em`) e a do fim do download (`emCompleta`), v1.12.29 — e a linha "caminho:" do detalhe leva a extração INTEIRA (era cortada em 160 caracteres, no meio de um `{…}`) |
| o salvar | `salvarRegistroDaVerificacao` | a ÚNICA porta do Registro desde a v1.12.29 (o `#diagSave` do rodapé de Configurações saiu), rotulada "Registro" (ícone + palavra, largura do conteúdo, altura `--quad-faixa`) — monta o texto (`await renderDiag()`) e recusa o vazio |

**A RODADA OCULTA** (v1.12.52). Pedido do operador: *"fazer um botão de ocultar
para o processo de verificação sem ser interrompido"*. Recolher a seção — o
Ocultar da faixa, o chevron, o voltar, fechar Configurações — deixou de cancelar;
só o Cancelar interrompe. Oculta, o tile "Verificar" mostra o aro e o percentual
(`pintarTileDoTeste`, a cada tique do anel) e, terminada, o desfecho, até a seção
abrir (`testeNaoVisto`); `aoAbrirTeste` não dispara rodada nova enquanto há uma
andando ou um resultado não visto. O download de teste continua obedecendo às
regras dele (para se uma mídia entra no ar, prazo, limpeza no `finally`).

**O CACHE DO SHELL TAMBÉM É CONFERIDO** (v1.12.52). Um Registro do operador
(17/10) trouxe `sobra no cache do shell: 1 arquivo(s), 24 MB (hevOy4tlhiQ.mp4)`
numa rodada de OUTRO episódio. A conferência da limpeza olhava só o registro e o
`/saf/` do arquivo ENTREGUE — num cancelamento não há entregue, e a sobra do shell
não reprovava nada. Hoje um arquivo DESTE vídeo na `sobraNoCache` da medida do
shell é falha com o nome (`m.limpeza.sobraDoShell`); os de outros vídeos só
aparecem no Registro. O nome `<id>.mp4` (sem `-v`/`-a`) é o de uma SAÍDA pronta
(junção ou progressivo), não o parcial de retomada — e o web não tem como
apagá-la (o `ytDiscard` só alcança o `/saf/` de um resultado entregue). A
origem não foi reproduzida pelo código (todo ramo de cancelamento do
`YoutubeGrab` apaga os seus arquivos); a faxina da pasta é proposta de Kotlin,
com a análise na nota da v1.12.52 do `HISTORICO.md`. E o Cancelar que chega DURANTE a escolha do
episódio (`testeDlCancelar` ainda nulo) passou a ser lido depois dela — antes, a
marca era lida só na entrada e o download partia assim mesmo.

**A LEVE E A COMPLETA** (v1.12.27). Pedido do operador: *"faça que o app baixe
aleatoriamente um dos vídeos anteriores do Provai e Vede que ainda não estão no
sistema, e acompanhe todo o processo registrando tamanho, duração do vídeo,
tempo de download… Após o download, finalize a verificação e então exclua o
arquivo… faça dois botões: leve e completa"*, e na v1.12.28 *"o leve já roda
ao tocar em Verificar, o botão Leve não precisa existir"*. A faixa de fecho é
**Registro · Verificação completa**: a abertura da folha roda a LEVE
(`rodarAutoteste`, a tabela `TESTES`, que NUNCA baixa nada), e a COMPLETA é
`rodarDownloadDeTeste` — SÓ a linha `TESTE_DL` (área *"Download do YouTube"*),
posta no MESMO `testeResultado` da leve (substitui a de uma completa anterior),
com as contas refeitas (`testeContar`) e `completa`/`emCompleta` marcados. O
botão fica APAGADO até a leve terminar e, enquanto a completa anda, vira
*"Cancelar"* (`.teste-cancelar`, o par do `.teste-resumo--ruim`). Reabrir a
folha roda a leve de novo, e o resultado novo não traz a linha do download.

**O ESTADO ACIMA DA BARRA** (v1.12.49). Pedido do operador:
*"Coloque o texto 'verificando...' E 'tudo certo' acima da barra de progresso …
estão muito amontoados verticalmente"* e *"os botões de versão e pedir ajuda,
dentro apenas da seção de verificação, pois é ali que eles são usados"*. A ordem
é: cabeçalho · `#testeResumo` (guarda a linha mesmo vazio, `min-height`) · barra ·
problemas · a faixa de fecho (a `.versao-faixa` que vinha antes dela saiu na
v1.12.50: a versão e o pedir ajuda foram para o cabeçalho de Configurações). O
ritmo é `--sp-6` dentro do bloco (cabeçalho→estado→barra) e `2 × --sp-6` entre
blocos (barra→problemas).

**A LISTA EXISTE DESDE O COMEÇO** (v1.12.28): `montarListaDoTeste` desenha as
linhas da tabela mais a do download ao abrir; durante a leve cada resposta
entra em `testeParcial` e `atualizarLinhaDoTeste` pinta SÓ aquela linha
(`estadoDaLinhaDoTeste` é a única pergunta por linha). Três estados são só da
TELA e nunca entram no resultado: `pendente` (círculo vazio), `curso` (o arco
que gira; o progresso do download na nota e no resumo) e `espera` (a linha do
download antes de a completa ser pedida). **O RESUMO** é *"N funcionaram · M
com falha"* (`desenharResumoDoTeste`) — sem resposta e não se aplica ficam na
própria linha, e o Registro segue com as quatro contas.

**A FONTE QUE RESPONDE E RECUSA** (v1.12.28): as quatro linhas da LouvorJA
levam `fonte: true`. No `TypeError` do `fetchList` (que leva o `Api-Token` e
por isso pré-checagem de CORS) `testeFonteSemResposta` pergunta ao banco em
`no-cors` (`Louvorja.sondarBanco`, 5 s): resolveu → FALHA (o servidor
respondeu e o app não pôde ler: o catálogo, as músicas novas e a Bíblia param);
rejeitou → *"o servidor da LouvorJA não respondeu"*. Era *"a internet não
respondeu"*, ao lado de uma linha de internet verde que sonda o MESMO host.

| peça | o que faz |
|---|---|
| `testeEscolherEpisodio` | sorteia entre os episódios ANTERIORES à semana (`AVSerie.diasAte < -getDay()`) que não estão no aparelho em forma NENHUMA (`mediaByYoutube` sem `kind`: arquivo ou link). O da semana fica de fora (é o que o aparelho guarda sozinho, e a limpeza o apagaria); um já guardado não baixaria. Vazio → `na` com o motivo |
| `testeDownloadCompleto` | as guardas (sem ponte, `midiaNoAr`, `bgWorkPedido()`/`serieAutoRodando`, `redeLiberadaParaBaixar()`), o download e a limpeza num `finally` que roda em TODO desfecho |
| `ytBaixarNativo(…, { medida, semResgate })` | o MESMO caminho do "Tocar agora" da busca no Modo Fácil — teto `ytAlturaPadrao()` (720p → `ytFetchAte`), prateleira `avulsos` — com duas opções novas: `medida` é carimbada em cada fase (`tInicio`, uma amostra `[t, lidos, total]` por megabyte, `tNativo` + o `r` do shell, `tCopia`, `tMiniatura`, `tGravado`) e `semResgate` não grava intenção (um teste levado pelo renderer não volta a baixar na abertura). O aviso é `'nenhum'`: nada vai à prévia |
| `testeDlContas` | PURA: até o 1º byte, baixando (até a primeira amostra com `lidos >= total`), junção/fecho (dali até o shell devolver), cópia, miniatura, gravação, total; Mbit/s médio e por janelas de 2 s (`TESTE_DL_JANELA_MS`), o maior vão, o vão MEDIANO e as paradas — vão ≥ 3× o mediano e ≥ 5 s (v1.12.28: o shell avisa por MB, e a régua fixa contava o compasso como parada); a razão duração ÷ total |
| `testeMetadados` | a DURAÇÃO e as dimensões lidas do arquivo GRAVADO, num `<video>` fora do documento, só metadados — nunca `play()` (pediria foco de áudio, e o Chromium pausaria o telão) |
| `testeArquivoDoShellSumiu` | o `ytDiscard` é dispara-e-esquece: a sonda refaz o `fetch` do `/saf/` do intermediário por até 6 s, abortando o corpo, até ele deixar de responder |
| `blocoDownloadDeTeste` | o detalhe no Registro (episódio, rede no início e no fim, teto × o que veio, caminho lido do `ytDiag` — *juntou* ou *veio* —, tamanho, duração, tempos, velocidade, limpeza) e a linha do que NÃO se mede sem APK |

- **Os desfechos:** veio e foi apagado = `ok`, com a nota em uma olhada
  (*"720p · 132 MB em 1:42 (10,4 Mbit/s) · vídeo de 28:15 · 16,6× a duração ·
  apagado"*); o shell não entregou = falha (com o `motivoDaRecusa`); cancelado
  por quem opera, ou por uma mídia que ENTROU no ar no meio (o vigia de 1 s), =
  `na`; o prazo (`TESTE_DL_PRAZO`, 10 min) = sem resposta. **E O QUE SOBROU É
  FALHA, por cima de qualquer outro desfecho**: o registro na biblioteca ou o
  intermediário no cache do shell.
- **O cancelamento é `ytCancelados` + `AVNative.ytCancel`**, sem a pergunta do
  `cancelarDownload` (é um teste, e quem o pediu está olhando a folha); a marca
  sai no `finally`, senão armaria o próximo download do mesmo vídeo.
- **O que fica sem medir até um APK novo** — e está escrito no Registro para
  ninguém ler o silêncio como "não acontece": a extração separada da conexão (o
  *"até o 1º byte"* soma as duas), quais candidatos o shell tentou antes do que
  pegou, a junção isolada da escrita do arquivo, e o parcial que uma FALHA deixa
  no cache do shell (o cancelamento o apaga, a falha não, e o web não tem como).

**As quatro regras que não se quebram** estão no `CLAUDE.md` (§Diagnóstico); o
que vale saber aqui é onde encostar: **checagem nova é uma linha na tabela**, e
ela já ganha tudo o mais. A `fn` devolve `tOk`/`tFalhou`/`tNa` — ou LANÇA, que o
motor lê como falha com a frase do erro; uma que devolve `undefined` conta como
FALHA, porque o silêncio dela seria um falso verde.

**O prazo é PRÓPRIO e curto** (2,5 s, ou 9 s nas de rede) e não o
`CALL_TIMEOUT_MS` de um minuto da ponte: ali ele transformaria *"o app não
respondeu"* numa espera que o operador abandona antes de ver o resultado.

**E o ouvinte do telão é um CONTADOR, não um ouvinte novo** (`testeDiagRecebidos`,
incrementado no despacho de `diag-dump` que já existe): `AVDB.onCommand` só
EMPILHA e não devolve como sair, então um ouvinte por rodada vazaria um a cada
toque no botão.

**E A MESMA REGRA VALE PARA O FUNDO DA LETRA** (`semImagem`, v1.9.15): a música
cuja origem não publica foto nenhuma sai da fila do backfill de vez, e a marca se
APAGA quando a origem passa a ter — ela diz o que o banco respondeu HOJE, nunca
um veredito permanente.

**O BACKFILL DO FUNDO (`syncImagensColecao`) EXISTE PORQUE OS SLIDES CONGELAM.**
A letra guarda `imageOpfsPath` resolvido NO MOMENTO do download, e
`ensureSongVariant` devolve cedo para todo registro que já tenha `lyrics`: a
faixa baixada num dia em que as imagens falhavam fica sem fundo **para sempre**,
e re-sincronizar não reconstrói nada — a régua diz que ela está completa, e está,
porque o áudio chegou. A porta é `opts.refazerLetra`, que pula essa guarda e faz
o ramo do registro existente regravar a letra **sem rebaixar o áudio** (variante
que nunca desceu volta intacta: uma rotina rotulada *"Fundos da letra"* não puxa
megabytes). Ele roda nos DOIS desfechos do `syncCollection` — inclusive no *"Já
completo offline"*, que é por onde sai o hinário cujo áudio já está todo no disco
—, **pula o que o mesmo toque acabou de tentar** (`pular`, senão cada faixa é
buscada duas vezes e o censo conta duas falhas por uma tentativa) e **conta pelo
DISCO**, nunca pelo retorno de `downloadCollectionSong`, que responde pelo ÁUDIO
e diria `true` sobre uma faixa que continua sem fundo.

**E ELE CORRE SOZINHO DESDE A v1.10.6** (`syncFundosAcervo`), porque a porta
anterior — o toque em sincronizar — não é desenhada numa coleção COMPLETA, que é
onde este defeito mora. O que torna isso barato é o **veredito por música**
(`fundos:<coll>` = `{ [id_music]: { v, ids, em, tem } }`, gravado por MESCLA
com `updateState`, a lição do `275 de 601 → 0` das cifras):

| peça | regra | por quê |
|---|---|---|
| `tem: true` | vale SEMPRE, enquanto `ids` (os arquivos das duas variantes) for o mesmo | errar calando UMA faixa é recuperável (a Verificação lê o DISCO); um "tem" que vence faria o aparelho SADIO reconferir o acervo inteiro periodicamente. Excluir e rebaixar cria arquivos novos, e o veredito deixa de valer sozinho |
| `tem: false` | vale SEIS dias (`FUNDO_REVISITA_MS`) | a falha de um sábado volta à fila na sexta, antes do culto seguinte; o prazo decide a JUSTIÇA da fila, não o custo |
| `metaOk` | só se grava veredito da refeitura se o `music_{id}` CHEGOU — num objeto POR FAIXA | sem rede a pergunta nem foi feita; carimbá-la custaria o prazo inteiro. Compartilhado, a resposta de uma faixa valeria pela vizinha |
| `fotoSemResposta` | a foto cujo `fetch` nem voltou (v1.10.7) também não vira ausência — no mesmo objeto por faixa, marcado por `downloadCollectionImage` | um 404 é a fonte RESPONDENDO; a rede caindo não é. Sem a marca, uma oscilação de Wi-Fi calava a faixa por seis dias |
| `estadoDoFundo` | três desfechos: `'tem'`, `'falta'` e `'?'` (registro sem `lyrics`, leitura que lançou); `'?'` não vira veredito | colapsado em "não falta", ele gravava um `tem` PERMANENTE sem ter visto fundo — e o registro antigo recebe a letra depois, com o mesmo id |
| rede | a passada automática só corre num Wi-Fi CONFIRMADO, e cede a um download PEDIDO | fotos que ninguém pediu agora; o impedimento é DITO (`fundosImpedimento`, a mesma função da porta, do Registro e da Verificação) |
| teto | NENHUM desde a v1.10.7 — a passada refaz tudo o que falta; as CONTAS são do acervo inteiro | pedido do operador (*"se ele achar necessário, ele verifica e atualiza toda a biblioteca baixada"*); o preço é a primeira passada puxar de uma vez as fotos que faltam, num Wi-Fi confirmado |
| fonte muda | doze faixas SEM RESPOSTA (`semResposta`: o metadado que não veio OU a foto que não voltou) ou RECUSADAS (`recusadas`, com o `ultimoStatus`) e nenhuma com resposta: a passada PARA (`FUNDO_FONTE_MUDA`), e o Registro diz *"não respondeu"* ou *"recusou (HTTP N)"* | sem teto, mil faixas com a fonte fora do ar seriam mil falhas a cada passada — e com o servidor de FOTOS mudo e o banco de pé, duas requisições por faixa. E a fonte MISTA (metade responde) NÃO abre: o disjuntor é para quem não responde |
| `metaStatus` | um 404/410 no `music_{id}` é resposta sobre a FAIXA: conta como resposta e grava a ausência de seis dias | contado como mudez, as mesmas faixas negadas abriam o disjuntor em toda passada, na frente da fila, e o resto do acervo nunca era refeito (MEDIDO: 17 pedidos por passada às negadas, 0 às boas) |
| retrato | `fundosUltimaPassada` SÃO as contas vivas da passada (`refeitas` contada por faixa) | uma cópia atualizada só no fim de cada coleção dizia *"0 conferida(s) até aqui"* durante os minutos da refeitura do hinário |
| conferência | SEM teto | é local, e é ela que leva o veredito ao disco — limitá-la atrasaria o estado estável (zero leituras) em dezenas de aberturas |
| piso | 30 min entre passadas; a que CEDE a vez não o arma, e a CORTADA o devolve | o `autoRefreshCollections` roda em todo `visibilitychange`; a cortada já gravou o que aprendeu, e retomá-la custa só o que faltou |
| relógio | `religarFundos` a cada `FUNDO_RELIGA_MS` (1 min), só com o app À VISTA (v1.10.7) | religada só pela abertura e pelo `visibilitychange`, uma música tocando na abertura a calava pela sessão inteira de quem ficasse no app — MEDIDO numa sonda de abertura real. Barato: impedimento, piso e letras no ar a fazem voltar na primeira linha |
| ordem | no fio de `syncLyrics`, DEPOIS dela, e cada uma CEDE à outra por bandeira | mesmo host (`music_{id}`); o encadeamento só serializa a primeira chamada, e uma volta ao app com a outra no ar juntaria as duas |

Só a passada AUTOMÁTICA lê o veredito; o toque à mão ignora e grava. A coleção
em download fica de fora (o `syncCollection` dela já chama o backfill com o
`pular`), a faixa que SAI da coleção no meio da refeitura é abandonada (a lixeira
troca o array do índice; sem isso a capa era regravada numa pasta recém-apagada),
e a refeitura não gera miniatura (o ramo do registro existente não a usa). O
retrato da passada nasce na PARTIDA, com `emCurso` — gravado só no fim e só com
trabalho, o Registro dizia *"nenhuma passada"* no estado estável. O bloco *"Fundos da letra"* do Registro conta pelo veredito (a MESMA
`fundoNoDiscoVale` da fila) e DECLARA isso na primeira linha — quem lê o disco é
a Verificação do Sistema.

**O botão de GRUPO segue a mesma régua** (`grupoCompleto(colls)` =
`colls.every(colecaoCompleta)`, e não uma soma de músicas, que responderia
diferente da linha logo abaixo). O custo do toque ali é maior: `syncGroup`
percorre álbum por álbum buscando índice na REDE — minutos, num acervo grande.

E é `grupoCompleto` que impede o "Baixar toda a biblioteca" de MENTIR num acervo
recém-instalado: o atalho `songs === 0 → "Já completo"` é verdadeiro para um
álbum SEM ÍNDICE, que tem zero variantes faltando **porque não tem lista** — na
janela em que o `autoRefreshCollections` ainda não indexou, o botão de maior
alcance da tela respondia "Já completo" e não fazia nada.

`tools/acervo.test.mjs` prende as três contas num Chromium de verdade: conta
errada não estoura em lugar nenhum, ela só mostra o número errado.

#### A medição do peso

Duas perguntas, e só uma tem resposta exata:

1. **quanto já está no aparelho** — `AVDB.opfsFolderSize(path)` enumera a PASTA
   e soma o `size` real de cada arquivo. EXATO, e cobre tudo que o download traz.
2. **quanto pesa o álbum inteiro** — o que falta ainda não veio, logo ESTIMATIVA.

**MEDIR A PASTA, NUNCA O CATÁLOGO.** O download grava dois tipos de arquivo na
mesma pasta: os áudios, que viram registro em `files`, e as **imagens de fundo da
letra**, que não viram (são referenciadas de dentro dos slides). Somando o
catálogo, essas imagens ficavam fora de TODA conta — num hinário inteiro,
centenas de MB que o operador via sumir do armazenamento sem explicação, e que
nenhuma tela somava; e ficavam fora também do NUMERADOR da taxa, que por isso
subestimava sistematicamente tudo o que projetava. Enumerar a pasta é ainda **mais
barato**: perguntar o tamanho de um arquivo não desserializa nada, enquanto o
`getAll` do catálogo trazia thumbnail e letra inteira de cada faixa para somar um
campo.

**A estimativa é por DURAÇÃO, não por contagem de faixas.** Áudio é bytes por
segundo: num hinário as durações são parecidas e os dois métodos empatam, mas num
álbum com um louvor de 2 min ao lado de um de 9 a média por faixa erra por um
fator de quatro — e erra na pergunta que decide um gasto de dados móveis. A
duração vem do índice (`duration`, "HH:MM:SS").

**A taxa é MEDIDA no aparelho** (bytes no disco ÷ segundos baixados), nunca uma
constante de bitrate: assim ela amortiza o que não é áudio e acompanha o bitrate
real do acervo. A escada vai da fonte mais específica à mais genérica: a taxa
DESTE álbum → a média de tudo o que já foi baixado → 128 kbps (`BPS_PADRAO`).
Sem o último degrau, um álbum vazio não teria tamanho a mostrar — que é
exatamente quando a informação mais importa. (Para VÍDEO a constante é outra,
`BPS_VIDEO_PADRAO`: a escada inteira pressupõe áudio, e numa série vazia ela
prometia ~50 MB para um ano que pesa ~15 GB.)

Duas ressalvas: o **Playback** conta com a duração do Cantado (a lista leve não
traz `instrumental_duration`, e é a mesma música), e uma faixa **sem duração** no
índice entra por `SEG_PADRAO` (3min30) em vez de somar zero, que faria o álbum
parecer menor do que é.

**O peso medido PERSISTE** (`state['coll-bytes']`) — `collUI` é estado de sessão,
e fechar o app apagava o número. A escrita é coalescida (o contador sobe a cada
arquivo baixado; um `setState` por música seria uma transação de IDB por
download).

**O peso NÃO é recalculado durante o render.** Recalcular é IO, e como o valor
mudar dispara outro `refreshCollectionsIfVisible`, sincronizar uma coleção com a
aba aberta executava N recontagens (N = número de cards) a cada música baixada.
Hoje `downloadCollectionFile` e `downloadCollectionImage` **somam o `blob.size`**
ao cache (`ui(id).bytes`) sem tocar o disco, `deleteCollection` zera, e a
recontagem completa roda só onde a conta muda em bloco:

- **`conferirPesoSeFaltar` reconta uma vez por sessão e por álbum, tenha ele peso
  ou não.** Rodando só com o peso ZERADO, um número errado nunca se corrigia: o
  acumulador só sobe, então qualquer divergência ficava gravada em `state` para
  sempre. (O `Set` que ele usa impede o `refreshCollectionsIfVisible` de dentro
  da recontagem de virar laço.)
- **O fim de uma sincronização reconcilia** (`updateCollBytes` no `finally` de
  `syncCollection`): durante o lote o número sobe por acumulação, que dá
  movimento na tela e erra em toda borda (uma faixa que falhou, um download
  repetido, um cancelamento). O fim do lote é o único momento sem IO concorrente.

**E o re-render é coalescido** (`refreshCollectionsIfVisible` agenda,
`renderCollectionsNow` executa; `COLL_REFRESH_MS` = 400 ms): o progresso chama
isso uma vez por música, e sincronizar o Hinário 2022 reconstruía a lista inteira
613 vezes. A resposta ao TOQUE continua imediata — `syncCollection` chama
`renderCollectionsNow()` direto ao ligar o `syncBusy`; só o progresso espera a
janela.

### O redesenho que o operador NÃO pediu espera a gaveta fechar

`renderSearchResults` faz `hymnResultsEl.innerHTML = ''` e remonta a lista, e o
que ABRE uma linha vive no `li` que ele acabou de jogar fora: a classe
`expanded`, a closure `gavetaMontada`, os destinos marcados (zerados por
`destLimpar()`) e a letra já lida. **São DUAS portas para esse mesmo quarto**, e
as duas são disparadas por algo que não foi o toque do operador:

| porta | quem dispara | quem segura |
|---|---|---|
| progresso de download (v1.1.2) | o tique de 400 ms, em modo FOLHEAR | `refreshCollectionsIfVisible` rearma enquanto `interacaoAbertaNoAcervo()` |
| resultado da busca no YouTube (v1.1.8) | `buscarNoYoutube`, em modo BUSCA | `renderBuscaQuandoPuder` rearma pelo mesmo guarda |

- **`interacaoAbertaNoAcervo()` conta `abrindo` como aberta.** Entre o toque e o
  `expanded` há um `await` (a letra sai do IndexedDB), e era ali que o redesenho
  alcançava a linha — o `li` do toque virava órfão e o toque não fazia nada.
- **A segunda porta é PIOR que a primeira em dois pontos.** A auto-busca dispara
  quando a sentinela do rodapé entra em cena, e **abrir a gaveta é justamente o
  que empurra a sentinela para dentro do campo de visão**: o gesto de olhar um
  item era o gesto que agendava a própria interrupção. E a pergunta é lateral —
  a música que o operador quer já está no acervo.
- **Espera o REDESENHO, nunca a busca.** Os bytes chegam no tempo deles.
- **O toque EXPLÍCITO no botão de buscar não espera** (`imediato`): ali quem
  redesenha é o operador, e a ação dele sempre vence — é o mesmo motivo pelo qual
  uma tecla nova redesenha a lista sem perguntar por gaveta nenhuma.
- **Os dois REARMAM** em vez de marcar um pendente: a espera dura exatamente o
  tempo em que há gaveta aberta, e o desfecho sai sozinho, sem depender de alguém
  lembrar de chamar isto de dentro de cada caminho que fecha uma gaveta.
- **A espera é a resposta certa, e não restaurar o estado depois.** Remontar a
  gaveta apagaria os destinos marcados, recarregaria a letra e mexeria no scroll
  debaixo do dedo — três coisas que o operador está usando justamente enquanto
  ela está aberta.

Oráculo: `tools/gaveta-no-download.test.mjs`, com as duas portas e um hazard
próprio para cada. **Ficam no mesmo arquivo de propósito** — separá-las
convidaria a corrigir uma e deixar a outra, que é literalmente o que aconteceu
entre a v1.1.2 e a v1.1.8.

Sincronização é **aditiva e resumível**: interromper e sincronizar de novo só
baixa o que falta (`fileGet` reconfirma que o arquivo catalogado ainda existe de
fato antes de pular — cobre exclusões manuais feitas por dentro da pasta).

**`syncCollection` devolve `{ ok, baixados, falhou }`.** Devolvendo `undefined`,
uma queda de rede era **invisível para o chamador** — o `syncGroup` varria dezenas
de álbuns em segundos sem baixar nada e ainda anunciava sucesso. Convenção:
`ok: false` é "não deu para baixar" (rede, armazenamento, erro); **cancelar ou já
estar completo é `ok: true`**, porque nos dois casos o sistema fez o que devia.
Na mesma linha, `downloadCollectionSong` devolve `false` quando nem os metadados
vieram, e o worker separa `done` (tentativas — é ele que move a barra) de
`falhou`: sem isso o rodapé anunciava "Atualizado (60 baixado(s))" com ZERO bytes
no disco.

**A ordem entre `bgTaskEnd` e `withBgWork` importa**, e é a mesma nos quatro
fluxos de massa (`syncCollection`, `syncGroup`, `ensureBibleVersionDownloaded`,
`syncLyrics`): o `bgTaskEnd` fica **dentro** do `withBgWork`. Um `finally`
externo roda DEPOIS do `finally` do `withBgWork`, e é este que solta o serviço em
primeiro plano e limpa o registro de tarefas — encerrar a tarefa depois disso
chega sempre tarde demais, sem efeito nenhum.
#### Classificação: categoria → álbum (a hierarquia do banco)

O acervo do LouvorJA tem **dois níveis, e só isso: categoria → álbum → música** —
não há grupo acima da categoria nem subcategoria (ver
`docs/FONTE-DE-DADOS-LOUVORJA.md` §5.5). A relação categoria↔álbum é **N:N**, e
`subtitle`/`order` são campos do **pivô**: variam conforme a categoria em que o
álbum é mostrado.

`state.albumCatalog` guarda a hierarquia inteira — `{ categories: [{ id_category,
name, order, albums: [{ id_album, subtitle, order }] }], albums: [{ id_album,
name, color }] }`. `albums` é o índice deduplicado que dá identidade a cada card
(vira `coll.id`); `categories` preserva a classificação.

`renderCollectionsList()` renderiza **cabeçalhos de categoria** (`.coll-group`)
na ordem do banco, com os álbuns de cada uma também na ordem do banco, e as
**quatro coleções fixas como cards da RAIZ, no topo** (v1.0.1 — ver "As coleções
fixas ficam na raiz", abaixo). Como a relação é N:N, **o mesmo álbum
aparece em mais de uma categoria** — de propósito, é assim no banco e no app
original, e o subtítulo muda junto. Álbuns que nenhuma categoria reivindica caem
num grupo "Outros álbuns" em vez de sumirem.

##### As coleções fixas ficam na RAIZ (v1.0.1)

Elas moravam em dois cabeçalhos — **"Arquivos oficiais"** (as séries, v5.260) e
**"Hinários"** —, e o agrupamento cobrava um toque que não pagava por si: quem
abre o Hinário 2022 quase nunca quer o de 1996 na mesma sessão, e quem vai ao
Provai e Vede não vai ao Informativo. Na raiz, o toque que abria o grupo abre a
**lista de faixas** — o card já é o acordeão (`alternarAcordeao`).

- **O que o grupo separava continua separado.** Ele existia para distinguir dois
  MODELOS de item (áudio com letra × vídeo do sábado), e essa distinção é do
  CARD (`tipoDaColecao`), não do cabeçalho que ficava por cima dele.
- **A ORDEM é a do uso**, e é a mesma de antes: as séries primeiro (material
  DATADO do sábado que vem), os hinários depois (acervo PERMANENTE, alcançado
  pela busca, pelo número ou pelo nome).
- **ARMADILHA:** `allCollections()` alimenta as CONTAS (peso, "toda a
  biblioteca", busca), **não** o desenho. Uma coleção fixa nova tem de entrar
  também na lista de `renderCollectionsListMiolo`, ou ela é construída, conta no
  peso e não aparece em lugar nenhum — sem erro.
- **O CARD PASSOU A TER TOM PRÓPRIO** (`--camada: var(--panel-2)` na regra de
  `.hymnal-card`). Lendo o pai ele ficava em `--panel` na raiz e em `--panel-2`
  dentro de uma seção: o MESMO álbum trocando de cor conforme alguém o tivesse
  agrupado, e a escada de dentro dele descendo um degrau junto — medido no
  escuro, a gaveta aberta caía a **1,26:1** da faixa vizinha (piso 1,28), que é
  a queixa que a v5.287 fechou. É a exceção declarada à regra "quem declara o
  tom é o CONTÊINER" — ver `docs/arquitetura/DESIGN-SYSTEM.md`.

**Álbum que é hinário disfarçado** (`isHymnalAlbum`): se `album_{id}.categories`
contém uma string começando com `hymnal.`, aquele "álbum" é na verdade um
hinário — o app-ja redireciona a abertura dele para o módulo do hinário, e como
os dois hinários já têm card fixo aqui, o duplicado é omitido. Esse é o critério
AUTORITATIVO, gravado como `collState[id].isHymnal` quando o índice chega; até lá
vale um palpite pelo nome (`/hin[aá]rio/i`).

**Índices sempre em dia, automaticamente** (`fetchCollectionIndex` /
`autoRefreshCollections`): na abertura e a cada retomada do Controle
(`visibilitychange`), busca (fase 1) os índices leves dos hinários + o catálogo
de álbuns, e (fase 2) o índice leve de CADA álbum (`album_{id}.musics`, só
metadados), com concorrência limitada (`runLimited` com `NET_CONCURRENCY`) e TTL
(`ALBUM_INDEX_TTL`, 12 h — pula os indexados há pouco, sempre busca os
novos/vazios). Ela é **silenciosa**: sem rede, só mantém o que está em cache.
Assim TODO o acervo entra na busca sozinho, baixado ou não.

**O merge é IN-PLACE, mutando os objetos existentes**, e isso não é estilo:
`syncCollection` tira um snapshot do array e grava `fileIdFull`/`fileIdPlayback`
nos objetos DELE conforme baixa. Como esta atualização roda em toda retomada do
app — ou seja, exatamente durante uma sincronização em massa, que é quando o
operador minimiza —, recriar os objetos deixava o snapshot apontando para
órfãos: os bytes iam para o OPFS e para o catálogo, os ids eram descartados no
`setState` seguinte, o card mostrava menos baixados do que existem e a música era
rebaixada. Reaproveitar o objeto preserva de graça qualquer campo extra
(`lyrics`, `_norm`). Complementarmente, `autoRefreshCollections` **pula coleções
com `syncBusy`**.

**Busca/lista — um popup só, e O CAMPO É A CHAVE.** `searchIsBrowsing(q)` é
literalmente `!q`: **campo vazio** = o navegador de coleções (cabeçalhos de
categoria e cards, com as músicas de cada um dentro do próprio acordeão); **com
texto** = a lista de músicas que casam, varrendo TODAS as coleções indexadas. Não
existe "modo coleção" separado — o escopo por coleção (`searchScope`, com título
próprio e um degrau de navegação) foi substituído pelo acordeão do card, que
mostra o álbum **sem perder o acervo de vista em volta**.

`renderSearchResults` monta os resultados dos índices já em memória
(`collState`), então funciona sem rede assim que eles tiverem sido buscados uma
vez; se o popup estiver aberto quando um índice atualiza, a lista se re-renderiza
na hora. Cada resultado carrega sua `coll` para tocar/adicionar/baixar sob
demanda.

**A busca tem teto de 60 resultados**, com uma linha final dizendo quantos
ficaram de fora: ela varre milhares de músicas e renderizar tudo a cada tecla
travaria o campo. Folhear uma coleção INTEIRA não passa por aqui — é o acordeão
do card, que lista tudo (em páginas de 100, ver acima).

**A busca por NÚMERO só vale onde o número identifica** (`collNumbersSongs`).
Num hinário o número É o nome da música ("o 471", e a numeração é a mesma do
hinário impresso); num álbum, `track` é só a posição no disco. Digitar "3" trazia
a faixa 3 de cada álbum indexado, empurrando o hino 3 para o fim da lista.
`songLabel(coll, s, pad)` é o único lugar que monta o rótulo — lista, busca, nome
do arquivo baixado e slide de capa passam todos por ali. Daí `hymnTrack` ser NULO
fora de hinário: é o número NO HINÁRIO, não a faixa do disco, e com isso o slide
de capa, o título do popup de letra e a preview param de numerar sem precisar
conhecer coleção nenhuma (o Display, em especial, só recebe o registro do
arquivo). Uma passagem única corrige o que já está baixado
(`desnumerarAlbunsBaixados`, estado `migSemNumeroAlbuns`) — ela REMOVE o prefixo
`N. ` e zera o `hymnTrack`, em vez de recalcular o nome a partir de `hymnName`,
porque o mesmo registro cobre importados e variantes.

