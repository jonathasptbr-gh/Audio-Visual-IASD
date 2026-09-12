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

# A aba de cifra (acordes ao lado da letra)

A folha de letra do Controle ganhou uma **terceira fonte**, ao lado de *Letra* e
*Bíblia*: a **cifra** do hino em cena — acordes sobre a letra, com transposição
por meio tom. Ela é para quem **toca**, e por isso **nunca vai ao telão**: o que
a congregação vê continua sendo a letra, pelo caminho de sempre.

```
 folha de letra              AVNative.cifraHtml         www.cifraclub.com.br
  [Letra][Bíblia][Cifra] ──► CifraFonte (host travado) ──► GET da página
                              devolve o HTML CRU              │
        ◄── controle/cifra.js: slug · folha · transposição ◄──┘
             (PURO, com oráculo Node — nada em Kotlin lê HTML)
```

### As decisões que precisam estar ditas

- **A ABA SÓ EXISTE COM FOLHA NA MÃO** (v1.8.28). Pedido do operador: *"que ele
  não apresente o botão da aba de cifra se não houver uma cifra de verdade para
  ser apresentada. não quero acesso a essa seção se não tem esse conteúdo."*
  São DUAS perguntas, e enquanto houve só a primeira a aba aparecia para TODA
  faixa de áudio do acervo: `cifraCabe` responde *"vale a pena PROCURAR?"* (por
  conteúdo musical), `cifraTemFolha` responde *"há o que MOSTRAR?"* (pelo
  desfecho, no cache). MEDIDO: cerca de dois terços dos álbuns não estão sob
  endereço deduzível nenhum, e o que o toque abria era a frase de "não
  encontrei". É o MICROFONE SEM TV (v1.2.20/v1.2.21) pela terceira vez:
  **não oferecer é melhor que explicar.**
  - **A LISTA É UMA, e é ela que governa as três coisas:** a aba, a badge do
    transporte (`renderLeitorBadge`) e a precedência de abertura saem todas de
    `lyricsViewSources`. O caso que a badge cobre sozinha é a faixa de ÁUDIO SEM
    LETRA, cuja única fonte possível é a cifra: com a folha FECHADA nada
    redesenha a folha, e por isso o desfecho da procura chama as duas
    superfícies (`cifraDesfechoNaTela`).
  - **A ESPERA SÓ APARECE PARA QUEM JÁ ESTÁ NA ABA.** `buscando` é o estado em
    que a resposta ainda não existe, e ele dura de milissegundos (cifra lida do
    disco) a segundos (a cadeia inteira). Escondê-lo de todo mundo é o certo — a
    aba nasce quando há folha —, mas escondê-lo de quem ESCOLHEU a cifra tiraria
    a aba de baixo do dedo do músico a cada troca de faixa, para devolvê-la um
    segundo depois. `lvSource` é o que separa os dois.
  - **E A PROCURA PASSOU A COMEÇAR TAMBÉM NA ABERTURA DA FOLHA.** O gatilho é a
    música entrar em cena (v1.1.17), e o ALVO DA BIBLIOTECA não tem cena: até a
    v1.8.27 quem o cobria era o `cifraGarantir` de dentro do `lvBuildCifra`, e
    com a aba dependendo do desfecho aquele ponto deixou de ser alcançável antes
    de haver desfecho. Sem a linha nova em `openLyricsPopup` a aba nunca
    apareceria num ensaio — a procura que a faria aparecer só rodava depois de
    ela aparecer.
  - **AS CINCO FRASES DE FALHA SAÍRAM** do `lvBuildCifra`: sem cifra não há aba,
    logo não há superfície onde elas caibam. O diagnóstico continua inteiro no
    bloco "Cifra (última busca)" do Registro, que é onde este projeto o guarda.
    O que sobra ali é a ESPERA e uma frase curta para o estado impossível — um
    `return` mudo deixaria uma caixa vazia com a fila de controles em cima.
  - **O preço, dito:** quem quiser saber POR QUE um hino não tem aba de cifra
    não descobre pela tela; descobre pelo Registro. Foi a troca que o pedido
    fez, e é a mesma da v1.2.21.
- **SOB DEMANDA é o contrato, não uma otimização.** Nada é baixado em lote,
  **nada entra no bundle do OTA e nada é gravado em disco**. O cache é um `Map`
  em memória, morto ao fechar o app. Trocá-lo por IndexedDB mudaria o recurso de
  natureza: o app deixaria de LER conteúdo de terceiro no aparelho do operador e
  passaria a DISTRIBUIR uma cópia dele. As duas coisas não são degraus da mesma
  escada.
- **O GATILHO é a música ENTRAR EM CENA, não a aba abrir** (v1.1.17). Uma
  requisição por música projetada, disparada no `send` — o ponto por onde todos
  os caminhos passam. Isso tira a rede do caminho crítico: quem abre a aba está
  com o instrumento na mão e a música tocando, e é o pior momento para esperar
  um GET a um site de terceiro. Não muda o contrato acima — continua sendo uma
  música por vez, sem lote e sem disco —, muda QUANDO ele acontece.

  **Quem decide se cabe é `cifraCabe`, e ela é UMA para os dois consumidores**
  (a aba, que decide se se oferece; o `send`, que decide se busca). O corte é
  por conteúdo musical (`kind: 'audio'` ou item com letra), não por nome: um
  episódio de série é um testemunho em vídeo, e ali a busca é uma requisição
  garantidamente perdida — e uma aba oferecida que só sabe dizer que não achou.
- **A busca sai do Kotlin porque não há alternativa, e só o TRANSPORTE sai.** Os
  WebViews rodam em `appassets.androidplatform.net` e um site de terceiro não
  manda `Access-Control-Allow-Origin` — o `fetch()` da página morre antes de
  sair, e o `<iframe>` cai no `X-Frame-Options` (o mesmo muro que já recusou
  embutir a busca do YouTube). O `CifraFonte.kt` faz **um `GET` e mais nada**;
  quem lê o HTML é `controle/cifra.js`. É a divisão das SÉRIES aplicada de novo,
  e pelo motivo mais forte que existe aqui: a marcação de um site muda quando o
  dono dele quiser, e nesse dia o conserto tem de chegar **por OTA em minutos** —
  em Kotlin custaria um degrau de `SHELL_VERSION` e uma Release por vírgula.
- **DUAS tentativas, nessa ordem.** Para uma coleção do catálogo
  (`AVCifra.CATALOGO`: os dois hinários) a URL é DEDUZÍVEL do nome do hino — uma
  requisição, sem ranking de ninguém escolhendo por nós. Só falhando ela entra a
  **busca genérica**, que é o "qualquer música" e também cobre o hino cujo nome
  no acervo não bate com o do site.
- **AS CIFRAS FICAM GUARDADAS NO APARELHO, PARA TODA A BIBLIOTECA BAIXADA**
  (v1.1.28 nos hinários, v1.2.14 no acervo inteiro). A folha abre **sem rede** —
  que é o problema real: o Wi-Fi da igreja no sábado de manhã.
  - **O que separa um hinário de um álbum é o CUSTO, não o direito**
    (`cifraDeduzivel` × `cifraGuardavel`). No hinário o endereço sai do catálogo
    e a música custa UMA requisição; num álbum custa a cadeia deduzível inteira
    (álbum-como-artista + artistas padrão). Confundir as duas perguntas foi o
    que manteve o arquivo preso aos dois hinários por seis versões.
  - **O CATÁLOGO É AUTORIDADE SOBRE O HINÁRIO** (v1.2.15). Um `sem-cifra` no
    endereço do catálogo ENCERRA a procura: aquela É a página daquele hino no
    site. MEDIDO: `Teu Divinal Amor` gastava mais três requisições (o
    álbum-como-artista e os dois artistas padrão), todas 404, para chegar ao
    mesmo veredito — vezes as ~300 do Hinário 2022 ainda por varrer. **Só na
    coleção do catálogo**: num álbum o `sem-cifra` de um endereço não fecha a
    pergunta, porque a música pode estar cifrada sob outro artista.
  - **E o nome de um hinário NUNCA é adivinhado como artista.** MEDIDO:
    `/hinario-adventista-2022/` não existe no site — 404 certo, uma vez por hino
    num acervo de 601. Onde o endereço já é deduzível de uma tabela, adivinhá-lo
    de novo pelo nome do álbum só pode errar.
  - **O Registro NOMEIA os hinos que faltaram**, e só nos hinários
    (`CIFRA_FALTANDO_MAX`): ali toda música existe no site, então cada nome é a
    NOSSA regra de slug errando — conserto de uma linha no `cifra.js`. Num álbum
    a ausência é o caso normal (MEDIDO: 35% de acerto contra 95% no hinário), e
    listar centenas de nomes enterraria o Registro sem dizer nada novo.
  - **A VARREDURA PULA A BUSCA DO SITE** (`semBusca`). MEDIDO no acervo: toda
    linha `busca …` devolveu `0 resultado(s)` — os resultados são desenhados por
    JavaScript. Ela custa duas requisições por música e, em massa, dobraria a
    varredura para não achar nada. Na aba ela FICA: lá é a última carta da
    música que está na frente do operador, e custa duas requisições UMA vez.
  - **A AUSÊNCIA TEM PRAZO, e é ela que torna o acervo varrível**
    (`CIFRA_REVISITA_MS`, 30 dias). No hinário toda música existe no site, e
    "não achei" era sempre defeito nosso: nada era gravado. **No acervo de
    álbuns a conta se inverte** — MEDIDO, cerca de dois terços não estão sob
    nenhum endereço deduzível, e sem memória isso são milhares de requisições a
    um site de terceiro EM TODA ABERTURA. A resposta não é gravar para sempre
    (um Wi-Fi ruim não pode custar um buraco permanente) nem não gravar: é
    gravar **com data**. Uma FOLHA não vence; uma ausência volta para a fila em
    30 dias. `sem-rede`, `recusou` e `ilegivel` continuam não gravando nada — os
    dois primeiros não são resposta do site, e o terceiro é defeito do parser.
  - **E a ausência guardada RESPONDE**, em vez de refazer a cadeia: sem isso a
    aba gasta quatro requisições para chegar à mesma frase que a varredura já
    tinha escrito, com o instrumento na mão. Quem a contorna é o PRAZO — passados
    30 dias ela volta para a fila —, e desde a v1.3.3 não há mais nada além dele:
    a escolha à mão saiu.
  - **QUEM BAIXA É O APARELHO, e essa é a decisão inteira.** Nada disto entra no
    bundle do OTA nem no repositório: o `.zip` do canal é público e servido em
    nome de quem publica, e um acervo ali dentro é o app DISTRIBUINDO obra de
    terceiro — outra coisa, não um grau a mais de ler sob demanda. Cada aparelho
    busca o que vai usar, como já fazia uma música por vez; muda o QUANDO (no
    download do hinário) e o ONDE (IndexedDB, não a memória da sessão). De
    quebra: a cifra fica sempre atual, o repositório não incha, e não nasce uma
    segunda fonte de verdade para divergir.
  - **E O GATILHO É O DELE TAMBÉM** (v1.2.1). A primeira versão pendurou a busca
    no fim do `syncCollection`, e ela nunca alcançou quem MAIS precisa dela: um
    hinário já completo faz aquela função retornar em "Já completo offline"
    muito antes do gancho. MEDIDO em dois Registros seguidos, `0 de 601` depois
    de o operador sincronizar. Hoje `syncCifrasAcervo` roda na abertura, ao
    lado do `syncLyrics` — informação padrão do acervo, uma vez por sessão, em
    segundo plano —, e o download deixou de ser a única porta (tocar em
    sincronizar num hinário completo também dispara).
  - **A forma é a do `syncLyrics`**, de propósito: mesma fila, mesma proteção de
    segundo plano, mesma notificação, gravação em LOTES, nada em dados móveis. E
    a regra que mais importa é a mesma — **falha de rede não grava nada**: num
    acervo em que toda música existe no site, uma ausência gravada é um buraco
    permanente causado por um Wi-Fi que oscilou. Retomável por construção (o que
    está guardado não é pedido de novo).
  - **A GRAVAÇÃO MESCLA; ELA NUNCA SUBSTITUI** (`cifraDiscoMesclar`, v1.2.10).
    A primeira versão gravava o mapa INTEIRO com `setState`, a partir de um slot
    de módulo (`cifraDisco`) cuja identidade mora noutra variável
    (`cifraDiscoColl`) — o ler-calcular-gravar que este arquivo proíbe para o
    `state`, com o agravante de o que ia ao disco poder ser o mapa de OUTRA
    coleção, ou `{}`. **MEDIDO num aparelho: `275 de 601` virou `0 de 601`**, e a
    cada abertura o app recomeçava o download do zero. A correção é estrutural,
    não um remendo no interleaving: uma substituição pode produzir zero a partir
    de 275, **uma mescla não pode**. `updateState` numa transação só, com a `fn`
    SÍNCRONA, e a fila de pendentes esvaziada só depois do commit. Oráculo:
    `cifra-offline.test.mjs`, provado por reversão.
  - **A leitura é a tentativa que não toca na rede**, entre a escolha do operador
    (que vale mais, é uma correção à mão) e o catálogo. O oráculo
    (`tools/cifra-offline.test.mjs`) NÃO afirma "a folha apareceu" — afirma que
    **`cifraHtml` não foi chamado**, com a ponte respondendo "sem rede" a tudo:
    com rede, uma leitura de disco que não acontecesse produziria a mesma folha
    pela porta errada, e ninguém veria diferença até o dia em que a rede não
    estivesse lá.
- **A CIFRA É SÓ AUTOMÁTICA** (v1.3.3). Houve uma busca À MÃO aqui, da v1.1.24 à
  v1.3.2: a aba desenhava a lista de resultados do site (inclusive o que a regra
  RECUSOU), abria qualquer um em PRÉVIA, e o endereço escolhido era FIXADO para
  aquela música — a tentativa 0 das aberturas seguintes, guardada entre sessões
  em `cifraEscolhas`. Saiu inteira a pedido do operador: lista, prévia, campo de
  consulta, atalhos (`+ <álbum>`, `+ Ministério Jovem`), a escolha fixada, o
  "Esquecer a escolhida" e o botão "Trocar" do rodapé (este na v1.3.2).
  - **O QUE ISSO CUSTA**, para quem for reintroduzi-la saber o que reintroduz: a
    regra ADIVINHA a partir de um nome, e quando ela erra — uma versão
    simplificada, um homônimo — **não há mais correção dentro do app**. Resta o
    link "Ver no Cifra Club", no rodapé da folha. MEDIDO à época: na maioria das
    falhas o resultado certo ESTAVA na página de busca, só não era o que a regra
    elegeu. É essa a distância que se aceitou pagar.
  - **A cadeia automática é o recurso inteiro agora:** guardada no aparelho →
    catálogo → álbum-como-artista → artistas padrão → busca do site. A busca do
    site FICA — ela é o último degrau do AUTOMÁTICO, não a manual —, e continua
    escolhendo por PARENTESCO, nunca por posição.
  - **`cifraBuscarNoSite(consulta, alvo, artista)` mantém os TRÊS papéis**: o que
    vai no `?q=`, o que o PARENTESCO compara e o DESEMPATE. Eles seguem distintos
    porque o segundo tento cola o álbum na consulta e o parentesco continua sendo
    contra o nome da música — juntá-los foi um defeito real, e volta a ser um.
  - **Os cinco motivos continuam existindo; as cinco FRASES não** (v1.8.28).
    Elas foram a resposta inteira desta aba da v1.3.3 até lá — sem tela de
    correção atrás delas —, e saíram quando a aba deixou de existir sem cifra.
    Quem separa os motivos hoje é o Registro, e é lá que a distinção continua
    valendo: `sem-rede` e `nao-tem` pedem ações opostas de quem lê.
  - **A guarda de TECLADO saiu junto, e é a única baixa que pode voltar a doer.**
    Ela existia porque o teclado do sistema é um `resize`, o `resize` remede a
    folha (`cifraRemedir` → `renderLyricsView`), o redesenho destrói o `<input>`
    com foco, e um campo sem foco fecha o teclado — que é outro `resize`. Da tela
    saía um teclado que piscava e sumia, sem erro em lugar nenhum. **Se um campo
    voltar a esta aba, a guarda tem de voltar com ele**; o `cifra-teclado.test.mjs`
    saiu neste lote e está no histórico do repositório com a forma dela.
  - **Um resto fica no aparelho, de propósito:** a chave `cifraEscolhas` do
    `state` continua gravada em quem já usou o recurso. Ninguém a lê, não custa
    nada, e apagá-la exigiria uma migração para devolver bytes que não fazem
    falta.
- **O REGISTRO GUARDA A ESTRUTURA DA PÁGINA QUE NÃO ABRIU**
  (`AVCifra.radiografia`). `ilegivel` responde *"não entendi"*, não *"o que
  era"* — e a distância entre as duas é uma sessão de adivinhação a distância.
  **É UMA POR ENDEREÇO, não uma por procura** (v1.2.6): uma procura tenta vários,
  e enquanto o slot foi único a última escrita apagava as anteriores — sempre
  deixando a página menos interessante. MEDIDO três vezes: o download em massa
  do hinário apagando o diagnóstico do operador, e a recusa anti-robô de um
  motor de busca (`HTTP 202`) com a estrutura dela sobrescrita pela busca que
  rodou em seguida. Um Registro não tem pressão de tamanho — ele existe
  para ser COPIADO —, então guarda-se todas e imprime-se todas.
  A radiografia devolve FORMA: quantos `<pre>` e de que tamanho, quantos `<b>`
  no maior deles, quantos links de música, `<title>`/`<h1>`/`<h2>`, o tom, e uma
  amostra curta de endereços — **a dos que passaram, ou, quando NENHUM passou, a
  do que havia** (`amostraEhCrua`). Amostrar só o que passa deixa o Registro mudo
  no caso em que ele é a única pista: MEDIDO, "38 link(s) de 2 segmentos, 0 com
  forma de música" e nenhum dos 38 à vista. **Nenhum pedaço de letra ou de acorde sai** — não
  é economia de bytes, é o contrato: um Registro existe para ser copiado para
  FORA, e o app lê conteúdo de terceiro sem distribuí-lo. O oráculo cobra as
  duas metades, e a segunda (o conteúdo NÃO sair) é a que protege o contrato de
  um campo novo acrescentado sem pensar. Só o caso `ilegivel` a grava: no
  caminho feliz ela sobrescreveria a página que interessa.
- **O NOME DO ÁLBUM É O ARTISTA DO SITE** (`AVCifra.urlDoAlbum`, v1.2.5), e esta
  é a tentativa deduzível de melhor custo-benefício do recurso. MEDIDO:
  "Usa-me", do álbum **Adoradores 5**, mora em `/adoradores-5/usa-me/`. Ela não
  precisa de catálogo para manter nem de rodízio fixo — **sai do dado que já
  está no item**, e é uma requisição. Vem antes dos artistas padrão porque é
  mais específica. Nem todo álbum tem página ("Nunca Mais as Lágrimas" está sob
  `cd-jovem-2018`, não sob "Fé e Ação"): errar custa um 404 e o resto da cadeia
  roda como sempre.
- **OS CDs OFICIAIS TÊM ENDEREÇO DEDUZÍVEL TAMBÉM** (`AVCifra.ARTISTAS_PADRAO`).
  Os álbuns do acervo são dezenas ("Missão", "Salmos", "Adoradores"…) e no site
  caem todos sob a coleção **Ministério Jovem** — a mesma forma do `CATALOGO`,
  sem uma coleção do acervo para mapear. Vale uma tentativa PRÓPRIA, entre o
  catálogo e a busca, pela razão que ordena as três: ali a URL sai do nome da
  música, e é **uma requisição sem ranking de ninguém escolhendo por nós**.
  Errar custa um 404 — a busca roda em seguida como sempre, nenhum caminho
  regride —, e o Registro imprime a tentativa verbatim, então um slug que o site
  renomeie aparece em toda música e se conserta por OTA. O mesmo artista entra
  como **desempate** na busca: um resultado sob ele é, por definição, de um CD
  oficial, e isso não depende de o nome do álbum do acervo bater com nada.
- **A BUSCA DO PRÓPRIO SITE NÃO EXISTE, E O BUSCADOR EXTERNO TAMBÉM NÃO
  RESOLVEU** (shell 52, v1.2.8). MEDIDO num aparelho: `cifraclub.com.br/?q=`
  responde 425 kB, sabe qual foi a consulta (ela está no `<title>`) e os únicos
  links de duas partes na página são o índice A–Z e o "Academy" — **os
  resultados são desenhados por JavaScript**, que o `cifraHtml` não executa. A
  v1.2.2 respondeu a isso perguntando ao endpoint HTML do DuckDuckGo, com
  `site:` na consulta; MEDIDO de novo, ele responde **`HTTP 202`** — a recusa
  anti-robô —, e uma recusa lida como página vazia é uma requisição por procura
  para não devolver nada. O motor saiu, e o host dele saiu do `CifraFonte`
  junto.
  - **O que passou a achar as músicas são os endereços DEDUZÍVEIS**: o catálogo
    do hinário, o álbum-como-artista e os artistas padrão — uma requisição cada,
    sem ranking de ninguém escolhendo por nós. É neles que o esforço vale, e é
    isso que a varredura mostra no Registro.
  - **A busca interna FICA, em último lugar.** Ela custa a requisição que já
    custava e hoje devolve zero; se o site voltar a desenhar no servidor, volta
    a funcionar sozinha, e o Registro segue acumulando a resposta dela.
  - **TODO MOTOR TENTADO VIRA UMA LINHA do Registro, com o STATUS** (v1.2.5). A
    primeira versão reportava só o ÚLTIMO, e um Registro real saiu com duas
    linhas `busca` e nenhuma do motor que tinha sido consultado. Não se
    diagnostica um motor que o diário não menciona, e `HTTP 0` (não respondeu) e
    `HTTP 403` (recusou o agente) pedem consertos opostos. A regra fica de pé
    com um motor só — ela é sobre o diário, não sobre a quantidade.
  - **Trocar de motor NUNCA troca o critério.** O que um motor devolve entra na
    mesma forma do `lerBusca`, e quem julga continua sendo o `ordenarBusca` — o
    parentesco com o nome da música decide, venha o candidato de onde vier. Só
    entra endereço do Cifra Club, conferido por HOST (invariante 2): um
    resultado patrocinado apontando para `cifraclub.com.br.exemplo.com` viraria
    a folha do culto se a conferência fosse por prefixo.
- **A BUSCA ESCOLHE POR PARENTESCO, NUNCA POR POSIÇÃO** (`AVCifra.ordenarBusca`).
  Pegar o primeiro link de dois segmentos da página de resultados é errado por
  duas razões independentes: a NAVEGAÇÃO do site também é link de dois segmentos,
  e ela mora no cabeçalho — portanto vem ANTES de qualquer resultado no HTML —,
  e a ordem do documento não é a ordem do ranking (cabeçalho, rodapé e blocos de
  sugestão saem no mesmo HTML). MEDIDO num aparelho: "Em Oração" devolveu 27
  resultados e o escolhido foi `/letra/A/`, o índice alfabético. A defesa **não é
  uma lista de rotas do site** (ela envelhece sozinha, e a lista `SECOES` é só o
  corte barato): é exigir que o texto do resultado tenha relação com o que se
  procurou — mesmo título, um contendo o outro, ou ao menos uma palavra forte em
  comum. **Zero parentesco é RECUSA, não último lugar** — é o zero que faz uma
  página só de navegação virar "não achei" em vez de abrir qualquer coisa. E a
  contenção exige CORPO (4 caracteres): sem o piso, `'emoracao'.includes('a')`
  devolve exatamente o link que a regra existe para recusar.
- **O ÁLBUM DESEMPATA; ele não filtra, e não abre a consulta.** O álbum do acervo
  não é o artista do site — "Em Oração" está no álbum "Missão" e quem gravou pode
  ser qualquer um. Filtrar por ele derrubaria a música certa toda vez que os dois
  não coincidissem; e pô-lo na PRIMEIRA consulta pode ENCOLHER o resultado em vez
  de afiná-lo, porque é busca de texto. Ele entra como bônus de ordenação, e como
  SEGUNDO tento de consulta — que só acontece quando o primeiro não devolveu
  nenhum parente, ali não há o que encolher. **Até três páginas são tentadas**
  (`CIFRA_CANDIDATOS`): o ranking do site não é o nosso, e cada tentativa entra
  no Registro, então três `ilegivel` seguidos continuam dizendo "o site mudou de
  formato" — mais alto, não mais baixo.
- **`ilegivel` NÃO cai na busca.** Ali a página existe e o parser é que não a
  entendeu; repetir a leitura por outro caminho troca o motivo certo por um
  errado, e apaga a única pista de que o site mudou.
- **Falhar VAZIO é proibido.** `lerPagina` devolve `null` para *"respondeu e eu
  não entendi"*, e isso é diferente de *"não tem"*. Achatar os dois numa frase só
  faz uma mudança de marcação do site ficar indistinguível de uma música ausente
  — e ninguém investigaria. São **cinco motivos** (`sem-rede`, `nao-tem`,
  `recusou`, `ilegivel`, `sem-cifra`), porque cada um pede uma ação diferente de
  quem lê. Desde a v1.8.28 quem os separa é o REGISTRO: a aba não existe sem
  cifra, então não há mais cinco frases na folha.
- **`sem-cifra` É A METADE QUE FALTAVA DO `ilegivel`** (`AVCifra.varianteSemCifra`,
  v1.2.12, generalizado na v1.2.20). MEDIDO numa varredura: ~12 das 85 falhas eram endereços que EXISTEM,
  respondendo 200 com centenas de kB e nenhum `<pre>` — o site tem a LETRA
  daquela música e não a cifra. Chamar isso de "não entendi" é falso nos dois
  sentidos: manda investigar um parser que está certo, e faz o download do
  hinário rebater a mesma música toda sessão, para sempre.
  - **Ela exige um marcador POSITIVO, e essa é a decisão inteira.** Responder
    pela AUSÊNCIA (`sem <pre>` ⇒ sem cifra) seria o defeito mais caro que este
    recurso pode produzir: no dia em que o site trocar a marcação, TODA página
    vira "sem cifra" — e este veredito é GRAVADO, então o acervo inteiro ganharia
    um buraco permanente. São duas condições independentes: nenhuma folha **e**
    o site anunciando a página como letra. Uma mudança de marcação derruba a
    primeira e não inventa a segunda, e o desfecho volta a ser `ilegivel`.
  - **A segunda linha de defesa é o PRAZO**, e não um teto por passada. Houve
    um (`CIFRA_SO_LETRA_TETO`, v1.2.12), e ele saiu na v1.2.21 — ver o bloco
    "por que não há mais um teto por passada" logo abaixo. O que sobra são as
    duas defesas que não têm esse defeito: o marcador POSITIVO acima e a
    revisita em 30 dias (`CIFRA_REVISITA_MS`).
  - **O CIFRA CLUB SERVE VARIANTES NO MESMO ENDEREÇO**, e é isso que o
    `sem-cifra` reconhece (`AVCifra.varianteSemCifra`). MEDIDO em duas páginas
    reais, CONFERIDAS À MÃO pelo operador: `/novo-hinario-adventista/
    teu-divinal-amor/` responde a LETRA (aquele hino não tem cifra no site), e
    `/ministerio-jovem/meu-senhor-minha-vida/` responde "partituras para
    teclado" — 449 kB, `<h1>` com o nome certo da música, ZERO `<pre>`. As duas
    são a MESMA resposta: *"esta música está aqui, e não há cifra para ela"*.
    Tratar a segunda como `ilegivel` mandava investigar um parser certo e fazia
    a varredura rebatê-la toda sessão.
    - **O marcador é POSITIVO**: sem folha **e** o `<title>` anunciando a
      variante. Uma mudança de marcação do site derruba a primeira condição e
      não inventa a segunda — o desfecho volta a ser `ilegivel` e nada é
      gravado. **Só variantes MEDIDAS entram na lista:** "simplificada" É uma
      cifra e traz folha, e incluí-la por simetria carimbaria como ausente uma
      página que o parser lê perfeitamente.
    - **NÃO HÁ TETO POR PASSADA** (removido na v1.2.21). Houve um — uma passada
      dominada por `sem-cifra` não gravava nada, na suspeita de que o site
      tivesse mudado. Ele custou caro e não protegia: MEDIDO, o Hinário 2022
      fechou `309 tentadas · 0 achadas · 309 recusadas` e a varredura recomeçava
      do zero a cada abertura, para sempre — e a suspeita era FALSA, como a
      conferência à mão provou. Ele também é estruturalmente errado: a passada
      só cobre o que FALTA, então a proporção de ausências tende a 100% num
      acervo saudável. Quem protege são as duas defesas acima: o marcador
      positivo e o prazo de 30 dias.
  - **O DIÁRIO GUARDA EXEMPLOS** (`CIFRA_EXEMPLOS_MAX`): nome (com o NÚMERO do
    hino), veredito e o ENDEREÇO tentado. É abrindo aquela página no navegador
    que se separa "o endereço que montamos está errado" de "o site não tem cifra
    desta música" — um nome sozinho não responde nem uma nem outra, e foi
    exatamente assim que as duas hipóteses acima se resolveram.
  - **`sem-cifra` NÃO interrompe a cadeia** (só o `ilegivel` interrompe): diz
    que AQUELE endereço não tem cifra, não que a música não exista no site.
    **Mas sobrevive até o fim** — sem essa memória, um `sem-cifra` seguido de
    dois 404 sairia como "nenhum endereço tinha a página", a resposta menos
    informativa das três e a única que manda continuar procurando o que já foi
    achado.
- **A ESCADA DO A+/A− GOVERNA TODO O TEXTO DA FOLHA, cabeçalho incluído**
  (v1.8.32). O título da obra e o tom vestiam `--fs-xl`/`--fs-lg`, a escala
  tipográfica FIXA do app, e só os ESPAÇOS em volta escalavam (eles saem de
  `--cifra-linha`). MEDIDO nos seis degraus e nas duas casas: título 15,2px e
  tom 14,4px PARADOS enquanto a folha ia de 11,84 a 28,42px — **do terceiro
  degrau em diante o cabeçalho fica MENOR que o texto que ele encabeça**, e no
  topo é 0,53× a folha. Quem sobe a fonte faz isso para ler de longe, que é
  exatamente quando o título e o tom saem de alcance. Os fatores
  (`--lv-fonte * .95` e `* .9`) reproduzem o desenho de antes AO PIXEL no degrau
  base — `--lv-fonte` vale 1rem ali, e os dois tokens eram 0.95/0.9rem —, e o
  que muda é que agora eles ANDAM, com a razão contra a folha constante.
- **UMA MARGEM DO RETRATO NÃO É NEUTRA NA COLUNA DA TELA CHEIA** (v1.8.30).
  `margin-right: auto` empurra a fila para a esquerda numa LINHA, que é o
  trabalho dela no retrato; numa COLUNA a mesma declaração age no eixo
  TRANSVERSAL, onde margem `auto` **vence o `align-items` do pai** e encosta a
  caixa num lado. MEDIDO em três paisagens: 11,2px entre a fila dos cinco
  controles e o A+/A− do pé, numa trilha de 66px. O CSS já desfazia isso para o
  `.lv-cheia-btn` (*o respiro da saída troca de eixo com a fila*) e não para a
  própria fila. **Regra: todo bloco que vira coluna em `:fullscreen` confere as
  margens que o retrato deixou.**
- **A TRANSPOSIÇÃO PRESERVA A COLUNA.** Um acorde vale por estar sobre a sílaba
  em que a harmonia troca. Um `replace` ingênuo empurra todos os acordes
  seguintes quando um deles cresce (`C` → `C#`), e depois de três trocas a folha
  está fora de sincronia com a letra logo abaixo — **parecendo certa**, que é o
  pior desfecho possível. O passo é guardado na entrada do cache: voltar a um
  hino devolve o tom em que o operador o deixou, e trocar de hino não arrasta o
  passo do anterior.
- **A GRAFIA VEM DA ARMADURA DO TOM DE DESTINO** (v1.8.93), e vale para a folha
  INTEIRA. Meio tom acima de D é `Eb`, não `D#`. A regra anterior — *a grafia
  segue a ORIGEM*, raiz sem bemol sobe em sustenido — se justificava por uma
  afirmação **falsa**: *"transpor não muda a armadura"*. Muda: Fá maior tem um
  bemol e, dois semitons acima, Sol maior tem um sustenido. Ela produzia tons
  que não existem (`D#`, `G#`, `A#` são 9, 8 e 10 sustenidos) e linhas
  **internamente inconsistentes**, porque decidia acorde a acorde: `Bb Cm Eb F`
  subindo três semitons saía `Db D#m Gb G#`.
  - **E a régua NÃO é "prefira bemol".** Dentro de Mi maior, `G#m` e `D#m` são a
    grafia certa (quatro sustenidos), e `Abm` ali seria erro — uma tabela fixa
    de bemóis estragaria o caso mais comum de hinário (folha em Ré subindo um
    tom), que a regra velha acertava por acidente.
  - **O MODO inverte três graus**, e por isso são DUAS tabelas: o grau 1 é `Db`
    em maior (5 bemóis) e `C#m` em menor (4 sustenidos contra os 8 de `Dbm`);
    idem nos graus 6 e 8. Uma lista única de doze nomes devolvia `Dbm`, que é o
    defeito velho pelo outro lado.
  - **O tom deixou de ser só informação de cabeçalho**: `grafiaDaFolha` o lê
    como ENTRADA. Não lido, o proxy é a PRIMEIRA raiz da folha — hino abre no
    tônico, e errar ali custa a grafia de um enarmônico, nunca a altura de um
    acorde.
  - **ENTRADA ≠ SAÍDA:** a gramática continua ACEITANDO `D#7M` e `A#m7`, que é
    como o site às vezes escreve. Recusá-los deixaria o acorde parado no tom
    original com a folha andando à volta dele — o defeito da v1.1.13.
  - **Zero semitom não regrafa**: a folha no tom original continua idêntica à
    página. E a divergência com a grafia do Cifra Club nos tons pretos é
    **escolhida**: quem lê esta aba está tocando, e `A#` não é um tom.
- **A gramática do acorde erra para os DOIS lados, e os dois são mudos.** Larga
  demais ("maiúscula seguida de qualquer coisa"), ela classifica uma linha de
  letra como acordes e a letra **some da aba**. Estreita demais, o acorde que
  não casar volta INTACTO da transposição e fica parado no tom original com a
  folha inteira andando à volta dele — foi o defeito da v1.1.13, em que `7M`
  (sétima maior, a notação brasileira mais comum num hinário) não estava na
  lista. Daí a forma atual: a extensão é uma sequência de PEÇAS conhecidas
  (`maj min dim aug sus add M m º ° + - # b`, dígitos e parênteses), nenhuma
  exigindo dígito depois de si. O oráculo cobra os dois lados em pares, e é a
  metade das RECUSAS que impede a correção de um lado de estragar o outro.
- **A marcação é a fonte; o formato é a rede.** Quem diz "esta linha é de
  acordes" é o `<b>` da página. `pareceAcorde` só entra quando não há marcação
  nenhuma, e o preço está declarado no código: a palavra portuguesa "A" é também
  um acorde.
- **A FOLHA NÃO É MAIS DE QUEM ESTÁ NO AR** (`lvAlvo`, v1.2.14). Ela nasceu
  presa ao `currentItem` — era o auxiliar de leitura da CENA —, e por isso ler
  uma música exigia PROJETÁ-LA. Quem toca quer o contrário: abrir a cifra no
  ensaio sem a congregação ver nada. Na gaveta da Biblioteca é o **"Ver a
  letra"** que aponta o MESMO leitor para aquela faixa (v1.2.25 — antes ele
  revelava uma caixa de texto ali dentro, que era uma segunda leitura sem cifra,
  sem tom, sem corpo de fonte e sem rolagem; o botão de abrir a folha era um
  terceiro, ao lado dela). Num VÍDEO o mesmo botão continua sendo o interruptor
  do detalhe (miniatura, duração, estado no aparelho): quem decide é
  `temLetra(coll)`, nunca `ehSerie`.
  - **Reusar o leitor, nunca reconstruí-lo na gaveta.** É a regra do
    `cifraCabe` e do `cifraProcurar`: uma segunda folha divergiria da primeira
    no primeiro ajuste, e quem tocasse por ela veria a versão de ontem.
  - **E ELA ABRE POR CIMA DA BIBLIOTECA** (`#lyricsPopup { z-index: 205 }`,
    v1.2.26). Todo `.popup-backdrop` é 200, e com o mesmo degrau quem decide é a
    ORDEM DO DOCUMENTO — o `#lyricsPopup` está declarado ANTES do
    `#hymnSearchPopup`, então a folha abria ATRÁS da tela que a chamou. A tabela
    `POPUPS` já dizia a ordem certa (o leitor depois da Biblioteca, porque o
    voltar a percorre de trás para a frente): **as duas dizem a mesma ordem, e
    mudar uma sem a outra é o acaso que já cobriu um popup por inteiro aqui.**
  - **Nada projeta.** O alvo não toca em `currentItem`, não emite comando e não
    passa pelo `send` — o oráculo afirma ZERO comandos no barramento, que é a
    metade que falharia sem deixar rastro na tela de quem abriu a folha.
  - **O RELÓGIO E O DESTAQUE SÃO DA CENA, e só dela** (`lvNaCena`). Com o alvo
    apontando para outra música, seguir o `authoritativeTime()` faria a folha
    andar no compasso de OUTRO louvor — e isso não erra alto: *parece*
    funcionar. Sem relógio o `auto` cai no LIVRE, que é o que um ensaio quer, e
    nenhuma estrofe é destacada.
  - **A ABA escolhida sobrevive à reabertura e NÃO à troca de alvo** — são duas
    coisas: quem escolheu "cifra" no transporte quer continuar nela; carregá-la
    para outra música abriria a folha de um louvor na aba escolhida para outro.
    Quem abre pela Biblioteca não pede fonte nenhuma desde a v1.2.25: o botão
    de lá é **"Ver a letra"**, e a folha nasce na primeira fonte disponível, que
    é a letra. O parâmetro `fonte` de `openLyricsPopup` **SAIU na v1.8.78** —
    desde a v1.2.25 nenhum chamador o supria, e o que o mantinha de pé era um
    oráculo. O ALVO morre ao fechar: é o desvio de UMA leitura.
- **A aba é a ÚLTIMA da lista de fontes**, e isso é a precedência inteira: sem
  escolha do operador, `lvActiveSource` abre a primeira, que é a camada mais à
  frente do que está sendo VISTO. **A cifra não é uma camada** — ela é o auxiliar
  de quem TOCA a mídia no ar —, e por isso nunca abre sozinha enquanto houver o
  que está sendo visto. Desde a v1.4.26 a lista é a PILHA do que está em
  exibição (a Bíblia por cima de um louvor de fundo oferece as três e abre na
  Bíblia); a exclusividade da v1.1.11 valia como PRECEDÊNCIA, e era só isso que
  ela precisava valer — ver o capítulo do Controle.
- **A QUEBRA DE LINHA É NOSSA, e ela quebra o PAR** (`AVCifra.quebrarPares`). O
  CSS quebra cada linha INDEPENDENTEMENTE, e acorde e letra são uma unidade: com
  `pre-wrap` uma folha larga saía como duas linhas de acorde seguidas de duas de
  letra, e a segunda metade do acorde ficava a duas linhas da sílaba a que
  pertence — não é alinhamento imperfeito, é o par desfeito. Aqui o corte é o
  MESMO ÍNDICE nas duas linhas (e o mesmo recuo sai das duas), então o
  alinhamento se preserva por construção. O ponto de corte recua até não partir
  token: uma palavra cortada fica feia, mas um acorde cortado (`Am` → `A`) vira
  OUTRO acorde, e um que soa. **A largura é INJETADA** — o módulo é puro e não
  olha o DOM; quem a mede é `cifraColunas`, que renderiza uma amostra de 40
  caracteres na fonte de verdade e divide, porque a monoespaçada que o Android
  escolhe varia de aparelho e o corpo segue o A+/A−. Medida inútil (0, o popup
  ainda fechado) devolve a folha INTACTA: sem régua confiável, uma rolagem
  lateral é melhor que uma folha mentindo. Remedir é evento, nunca enquete —
  a folha abrindo, o A+/A−, `resize` e `orientationchange`. O respiro vai ENTRE
  os pares (`.lv-cifra-letra + .lv-cifra-acordes`), nunca dentro deles: é a
  proximidade do acorde com a letra que diz a qual sílaba ele pertence.
- **A ROLAGEM AUTOMÁTICA É UM RITMO TIRADO DA MÚSICA, e não a POSIÇÃO dela**
  (v1.5.6). Velocidade fixa em px/s não tem como estar certa: a mesma folha serve
  a um hino de 2 min e a um de 6, e quem decide o ritmo da leitura é a gravação.
  Daí o `auto` — mas o que ele toma da música é só a **DURAÇÃO TOTAL**, e o que
  ele integra é o relógio de parede a partir de onde a folha ESTÁ
  (`AVCifra.ritmoDaRolagem`, PURA, com oráculo: `rolável ÷ (t1 − t0)`).

  **Isto REVOGA o desenho da v1.1.20**, em que a folha era uma FUNÇÃO da posição
  da música. Pedido do operador, e **as três vantagens daquele desenho eram os
  três defeitos que ele relatou**, vistas do outro lado — é por isso que a
  correção é uma troca de premissa e não um remendo:

  | a v1.1.20 dizia | o operador viu |
  |---|---|
  | pausar a música PARA a folha | *"se a música não está tocando, ele não anda"* |
  | um seek LEVA a folha ao ponto | *"ele fica voltando para onde a mídia estaria"* |
  | um quadro perdido não acumula erro | (só isto sobrevive — e o teto de delta cobre) |

  O `cifraDesvio` daquele lote era o remendo sobre a premissa errada: um
  deslocamento somado ao alvo para dar ao dedo um lugar na briga com a música.
  Saiu, com o alvo teórico e a perseguição suave — não há mais briga. **A folha
  era da MÚSICA; ela passou a ser de quem lê.**

  **O que sobrevive da janela é o FECHO** (`AVCifra.janelaDeRolagem`), e
  sobrevive por construção: percorrer o rolável em `t1 − t0` segundos põe a
  última linha na tela no instante `t1` — o fim da cifra lido bem antes do fim
  da música, que é a parte que mais se erra. **A ABERTURA saiu**, e saiu porque
  perdeu o referente: ela era *"a música acabou de começar"*, e não há mais
  começo nenhum. A `fracaoDaRolagem` fica no módulo, **sem consumidor e com
  oráculo**, para quem quiser reintroduzir o posicional ter a função e a razão da
  saída. A duração vem da **barra de progresso**, a única fonte que cobre todos
  os tipos de mídia, pela mesma razão que o `pushNowPlaying`.

  **MAS O COMEÇO TEM UMA RAMPA DE ARRANQUE, por outro motivo.** Pedido do
  operador na v1.5.20: ligar "Rolar sozinho" movia a folha NA HORA, sem dar
  tempo de ler a introdução durante um instrumental — *"o objetivo não é ter a
  linha a ser lida no topo, mas no centro… o sistema deve esperar o usuário
  'ler até chegar no ponto médio' antes de se preocupar em mover
  automaticamente"*. **Isto não é a ABERTURA que saiu acima** — aquela era uma
  fração da POSIÇÃO da música (o referente que sumiu com a v1.5.6); esta é
  RELÓGIO DE PAREDE contado a partir do TOQUE.

  **A PRIMEIRA RESPOSTA FOI UMA ESPERA PARADA, e ela foi REVOGADA na v1.6.2**
  (ver o bloco *"IMOBILIDADE NÃO É ESPERA, É UM BOTÃO QUEBRADO"*): o objetivo
  estava certo e o meio, errado — o operador leu a folha imóvel como falta de
  resposta, e a v1.6.1 teve de acrescentar uma NOTA só para explicá-la. Hoje a
  folha **ANDA desde o primeiro quadro** e ACELERA até o compasso cheio, com o
  mesmo atraso permanente que a espera produzia: `AVCifra.rampaInicialDaRolagem(altura, pxPorS)`
  diz quanto a rampa dura e `AVCifra.ritmoDaRampa(decorridoMs, rampaMs, pxPorS)`
  diz a que px/s ela corre NESTE instante (as duas PURAS, com oráculo em
  `cifra.test.mjs`; piso de 4 px/s, expoente 3, teto de 25 s). Não há mais
  espera, nota nem `.dl-ring` sobre o pause — o `cifra.test.mjs` cobra
  `esperaInicialDaRolagem === undefined` e o `cifra-rolagem.test.mjs` cobra a
  ausência do anel.

  **A FOLHA NUNCA MEXE NO TEMPO DA MÍDIA**, e o operador pediu isso por extenso.
  Sempre foi verdade e nunca teve oráculo; hoje tem, porque uma ausência não tem
  sintoma — o dia em que alguém ligar os dois eixos "para sincronizar", um
  arrasto para reler uma estrofe volta o louvor na frente da congregação.

  **Sem duração há o modo LIVRE** (ensaio sem tocar a gravação, item sem linha
  do tempo): px/s constante, `requestAnimationFrame` com delta REAL — no degrau
  mais lento são 11 px/s, menos de um pixel por quadro, e um passo fixo ou
  arredonda para zero (não anda) ou para um (voa); o acumulador de fração
  resolve os dois, e o delta tem TETO (250 ms) porque a página estrangulada em
  segundo plano voltaria dando um salto. Os dois modos são **UM LAÇO SÓ**: a única
  diferença é de onde sai o px/s. **`Auto` sem duração cai no fixo e DIZ isso**
  no `title` do botão: o rótulo mostra a ESCOLHA, a frase mostra o que
  está acontecendo — sem ela, *"por que a folha não acompanha a música?"* não
  tem resposta em lugar nenhum.

  **E "há relógio?" é `midiaNoAr`, nunca a barra sozinha** (`cifraDuracaoNoAr`,
  v1.2.2).
  A barra responde *"este ITEM tem linha do tempo?"*, que é outra pergunta:
  `renderNowPlaying` termina em `seekEl.disabled = !isTimed`, com `isTimed`
  saindo do `kind` do item ATUAL — e `currentItem` sobrevive de propósito ao
  Parar, ao fim da faixa e a uma letra avulsa. A barra ficava habilitada, com o
  `max` da faixa, sobre um telão vazio, e o `auto` ancorava a folha no ponto
  daquela música fantasma. **Com o ritmo da v1.5.6 o desfecho ficou mais brando**
  — a folha anda, só que no compasso da duração errada —, e a pergunta continua
  sendo a mesma: duração é da CENA, não do item que sobrou selecionado.
  Oráculo: `tools/cifra-rolagem.test.mjs`.

  **A posição é NOSSA, em fração de pixel** (`cifraPos`). No ritmo de leitura são
  ~0,37 px por quadro: escrevendo `scrollTop` inteiro, a folha anda 1 px a cada
  três quadros e fica parada nos outros dois — e é esse liga-desliga que se lê
  como TREMOR. Não é jitter de relógio, é quantização. Escrita com a fração, quem
  suaviza é o compositor do navegador, que rola em subpixel; reler o `scrollTop`
  para acumular perderia a fração a cada quadro (ele volta arredondado), que é o
  mesmo defeito por outro caminho — daí `cifraEscrito`, a cópia do que
  escrevemos, ser a régua que distingue a nossa escrita de um arrasto do
  operador. E o CSS do corpo declara `scroll-behavior: auto` **de propósito**:
  `smooth` faria o navegador animar cada uma das nossas escritas por cima da
  nossa, duas animações no mesmo eixo.

  **OS CONTROLES FICAM FORA DA CAIXA QUE ROLA** (`#lyricsViewBar`). Dentro dela
  eles rolavam com o texto: com a rolagem ligada, o pausar saía de cena em
  segundos, e alcançá-lo exigia rolar de volta ao topo — brigando com a rolagem
  que se queria parar. **Um controle que some é um controle que não existe no
  momento em que ele importa.** A barra é da cifra e de mais ninguém, e é limpa
  num ponto só (`renderLyricsView`), senão trocar de fonte deixaria os controles
  da folha de pé sobre a Bíblia.

  **O dedo não briga e não desliga.** O avanço é relativo nos DOIS modos desde a
  v1.5.6, então um arrasto só muda a origem — para trás ou para frente, *"vale
  tanto para volta como para avanços"* —, e a rolagem continua dali. É uma linha
  só: `cifraPos` reassume o `scrollTop` sempre que alguém que não fomos nós o
  escreveu. `pointercancel` entra junto do `pointerup`: um arrasto que vira gesto
  do sistema não emite o segundo, e sem ele a folha travaria para sempre com o
  botão dizendo que rola.

  Ela para sozinha em quatro casos: o fim da folha (**nos dois modos** desde a
  v1.5.6 — o `auto` "descansava" no fim esperando o relógio, e não há mais
  relógio a esperar), a aba deixando de ser a cifra, o popup fechando, e a
  MÚSICA
  TROCANDO — esta pela chave da rolagem, senão o louvor seguinte já entrava
  rolando do meio de uma folha que ninguém mandou andar. A escada tem sete
  degraus e CICLA (a forma do botão de girar a mídia) e é PERSISTIDA: depende de
  como a igreja canta, não da sessão. **O estado vive FORA do DOM** porque
  `renderLyricsView` refaz a folha inteira a cada transposição; os botões nascem
  a cada render e vêm perguntar como se pintar. E o degrau guardado é adotado
  por FUNÇÃO hoisted (`cifraAdotarVelocidade`), não por atribuição direta: o
  estado mora no fim do arquivo e o `load()` que hidrata roda muito antes na
  leitura — um `let` alcançado de cima é uma zona morta esperando a ordem de
  chamada mudar.
- **"Ver no Cifra Club" é um LINK no rodapé**, não um botão de corpo inteiro. Ele
  é a ação menos principal da aba (quem a abre quer LER a cifra) e, com peso de
  botão, cobrava altura de uma caixa cuja única função é mostrar texto.
- **Ela não existe no navegador.** Sem ponte não há como buscar a página, e uma
  aba que só sabe explicar por que não funciona é pior que aba nenhuma — o
  seletor do topo só aparece com duas fontes, e esta apareceria em toda música.
- **O Registro tem as DUAS metades** (`Cifra (última busca)`): os ENDEREÇOS que
  o web tentou e o que o parser entendeu de cada um, mais o status que o shell
  recebeu. O caso que só as duas juntas resolvem é `HTTP 200` + `ilegivel` — a
  página está lá, a rede está boa, e o `cifra.js` é que precisa de um lote novo.

> **O que o oráculo NÃO cobre, dito:** as fixtures do `cifra.test.mjs` são
> SINTÉTICAS (nenhum conteúdo de terceiro entra neste repositório), então elas
> provam a **gramática** do parser, não que ela case com o HTML de hoje do site.
> Essa segunda metade só se prova contra uma página real — e é exatamente a
> metade que, quando quebrar, se conserta por OTA. **A âncora que existe** é o
> slug: `urlDoHino('hymnal-2022', '001. Santo, Santo, Santo')` tem de produzir a
> URL real conferida à mão, e sem ele nada mais é exercitado.

---
