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

# O pacote de transferência (o acervo num arquivo)

A biblioteca inteira de um aparelho — mídia, arquivos do OPFS, catálogos e
preferências — num arquivo `.avpkg`, para entrar em outro celular por cabo,
Bluetooth ou cartão. Pedido do operador: *"o download e instalação do app é
leve, mas a biblioteca e o resto são pesados … permitir copiar e compartilhar o
arquivo diretamente de um smartphone para o outro é extremamente útil"*.

```
 ┌──────── aparelho A ────────┐                 ┌───── aparelho B ──────┐
 │ controle.js  (IDB + OPFS)  │                 │ pickDoc → /saf/<t>    │
 │   └─ blocos de 512 kB ─────┼─ __avPacote ──► │   + size (shell 64)   │
 │      (ArrayBuffer)         │  PacoteCanal.kt │   └─ JANELAS:         │
 │ AVNative.pacoteCriar()  ───┼─► SAF, destino  │      /saf/<t>?r=a-b   │
 │ AVNative.pacoteFechar() ───┼─► ABERTO        │      (SafJanela.kt)   │
 └────────────────────────────┘                 └───────────────────────┘
```

**E EXPORTAR ABRE O COMPARTILHAMENTO, NÃO O SELETOR DE ARQUIVOS** (v1.8.17).
Pedido do operador: *"Ajuste para que o processo de exportar e importar seja o
mais automático possível: como esportar direto para o compartilhar."* O pacote
existe para atravessar de um celular para o outro, e quem o atravessa é o Quick
Share — pelo seletor de arquivos isso são QUATRO passos (salvar → abrir o
gerenciador → achar o arquivo → compartilhar); direto, é UM.

- **O QUE DECIDE É O ESPAÇO, e a decisão é do WEB.** Compartilhar escreve uma
  SEGUNDA cópia do acervo em `files/pacote/`, e um acervo de quinze gigabytes
  não cabe. O shell responde `pacoteEspaco()` — um NÚMERO — e mais nada; quem
  compara com o tamanho MEDIDO e escolhe é o `controle.js`. Um
  `podeCompartilhar(bytes)` em Kotlin envelheceria à parte da regra.
- **A FOLGA É DO APARELHO, não do pacote** (`PACOTE_FOLGA_BYTES`, 512 MB). Um
  Android sem espaço não devolve um erro claro: ele quebra o IndexedDB, o
  WebView e a projeção, cada um do seu jeito. Encher o aparelho para exportar
  uma biblioteca é o oposto do que o botão promete.
- **O CAMINHO DO SAF CONTINUA DE PÉ**, e é ele que atende justamente o aparelho
  que MAIS precisa exportar — o do acervo grande, que não tem espaço para a
  segunda cópia. Lá o operador escolhe o cartão. É a reversão que o oráculo
  cobra: sem ela, apagar o caminho antigo passaria em tudo o mais.
- **A FRASE SEGUE O CAMINHO**, porque as duas pedem ações diferentes: no
  compartilhar o seletor JÁ ESTÁ na frente do operador e o que falta é o que
  fazer do outro lado; no SAF o que falta é ACHAR o arquivo, e aí o NOME dele é
  o que importa.
- **A FAXINA RODA NA PORTA da exportação seguinte E no `onCreate`**, nunca
  depois de compartilhar: o arquivo tem de SOBREVIVER ao seletor (quem o lê é
  outro app, no tempo dele). Os dois pontos existem porque um só não basta — a
  porta não alcança quem exporta uma vez, e o lançamento não alcança quem
  exporta duas vezes seguidas.
- **`files/` e não `cache/`**: o sistema esvazia o cache quando quer, e o
  arquivo precisa durar entre o seletor abrir e o outro app terminar de lê-lo.
  Ele sai do backup nos DOIS arquivos de regra, e é exposto por um
  `FileProvider` com autoridade PRÓPRIA (`${applicationId}.pacote`) — a do APK
  é outra, e juntá-las faria um `<paths>` só expor as duas raízes de uma vez.

- **O `ClipData` NÃO SE ESCREVE À MÃO, e o seletor não pede tarefa nova**
  (v1.8.21). O `migrateExtraStreamToClipData` que o sistema roda ao sair do
  processo **desiste quando o Intent JÁ TEM `ClipData`** — e, num
  `ACTION_CHOOSER`, ele só copia o `ClipData` e as flags para o CHOOSER *se o
  alvo tiver migrado*. Escrever o `ClipData` no alvo (v1.8.18) desligava
  exatamente a propagação que se queria garantir, e o desfecho foi o seletor não
  abrir. O caminho é o canônico: só o `EXTRA_STREAM` com a flag, e o sistema
  migra. O `FLAG_ACTIVITY_NEW_TASK` fica FORA — copiado do `shareText`, onde é
  inofensivo porque texto não precisa de concessão, ele quebra a corrente aqui,
  porque a concessão é amarrada à TAREFA de quem a dá; é o suspeito do **0 KB**
  da v1.8.17.
- **O PROVEDOR É DE CLASSE PRÓPRIA, e isso não é estilo** (`PacoteProvider.kt`,
  v1.8.22). `ActivityThread` guarda o provedor local num mapa chaveado por
  `ComponentName(pacote, CLASSE)`, **não por autoridade**: duas autoridades
  sobre `androidx.core.content.FileProvider` compartilham a instância — e a
  tabela de caminhos — da PRIMEIRA. Era o "0 KB" no seletor, e ele durou cinco
  lotes porque falha ASSIMÉTRICO e MUDO deste lado: o `getUriForFile` é
  ESTÁTICO e resolve pela AUTORIDADE (a URI sai certa, o seletor abre), o nosso
  lado reporta o tamanho certo (ele lê o `File.length()`, que nunca passa pelo
  provedor), e quem RECUSA é a instância que serve, **no processo do outro
  app**. A autoridade do APK continua funcionando por ser a PRIMEIRA — a metade
  que funciona é a que fazia o defeito parecer impossível. **Autoridade nova =
  classe nova**, e o `manifest-provedores.test.mjs` cobra isso.
- **E O `-1` DIZ POR QUÊ** (`pacoteDiag`, shell 69). Ele colapsa TRÊS causas —
  não há pronto · o arquivo sumiu do disco · o seletor recusou — e o lado web
  não separa nenhuma: TRÊS rodadas de campo se gastaram nessa distinção, feita
  por dedução sobre o código em vez de leitura do aparelho. O diag diz o estado
  do pronto, se ele existe, a URI do provedor (ou a exceção de montá-la) e o
  desfecho do último fecho e do último envio, com o NOME da exceção. **E, desde
  a v1.8.22, quantos bytes o PROVEDOR serve** para a própria URI — um `query`
  daqui, a MESMA chamada que o app receptor faz: é essa linha que separa *"o
  arquivo tem N bytes no disco"* de *"o outro app consegue lê-los"*, e foram
  essas duas que divergiram no "0 KB". LEITURA PURA, e ela não vira veredito —
  um `query` que lançasse por um motivo benigno bloquearia um compartilhamento
  que ia funcionar.
- **E O QUE O CANAL CONTOU NÃO É O QUE O OUTRO APP VAI LER.** `bytes` é o que o
  `PacoteCanal` escreveu; `length()` é o que existe NO CAMINHO agora. Enquanto
  só o primeiro foi conferido, um arquivo vazio saía anunciado como pacote
  inteiro — o diálogo com o tamanho certo e o seletor com zero. Hoje o vazio
  devolve `-1`, que é o desfecho que a tela já sabe explicar.
- **O LANÇAMENTO POUPA O PACOTE RECENTE** (`PACOTE_RECENTE_MS`, 20 min): quem
  recebe lê o arquivo no tempo DELE, com o app já em segundo plano, e voltar ao
  app no meio disso o apagaria debaixo de quem o lê. A PORTA da exportação
  seguinte não tem essa dúvida e leva tudo.

- **FECHAR NÃO É ENVIAR** (v1.8.19). Pedido do operador: *"pode remover o popup
  de 'acervo exportado'. faça com que após a conclusão da preparação do arquivo,
  o botão de exportar fica 100% e permita tocar nele para compartilhar … e
  também permitindo compartilhar o mesmo arquivo pronto, quantas vezes
  quiser"*. Até o shell 67 os dois eram o MESMO instante: o seletor abria
  sozinho no fim da escrita, e o envio valia UMA vez. Hoje `pacoteFechar`
  PROMOVE o arquivo a PRONTO e `pacoteCompartilhar` só abre o seletor — o
  operador manda quando quiser, e quantas vezes quiser.
- **O DIÁLOGO SAIU, E A INFORMAÇÃO DELE NÃO.** Ele dizia duas coisas: o
  tamanho e o que fazer em seguida. O tamanho está no `aria-label` do tile; o
  "o que fazer" virou o PRÓPRIO botão — ele para em **100%** (onde a barra
  parou) e o desenho vira o de compartilhar, que é onde o estado mora neste app
  desde a v1.7.6.
- **O TOQUE LONGO SAIU, E O IRMÃO O SUBSTITUI** (v1.8.29). Ele existiu da
  v1.8.20 até aqui por FALTA DE LUGAR: com um pronto na mão o toque curto
  ENVIA, e quem quisesse fazer outro na mesma sessão ficava sem porta. Hoje o
  botão de IMPORTAR é o DESCARTAR enquanto há um pacote pronto, e um botão
  inteiro dispensa um gesto escondido. **A PERGUNTA fica** — ela é o que
  protege minutos de trabalho, não o tempo do dedo —, e descartar **não
  reexporta**: encadear as duas coisas tira do operador a folha de escolha, que
  é onde ele decide o que levar. O relato que fechou a conta foi outro: com um
  pacote pronto, o tile de importar dizia "Cancelar" (o rótulo emprestado com
  prazo `0` nunca era calado) e agia como importador — um botão que anuncia uma
  coisa e faz outra é pior que qualquer uma das duas.
  - **900 ms, e NÃO os 500 do transporte.** Lá o pior caso de um falso positivo
    é passar uma mídia em vez de uma estrofe; aqui é DESTRUIR um pacote de
    minutos — e foi o que aconteceu no campo, num toque normal.
  - **E O TEMPO SOZINHO NÃO BASTA**: num TOQUE a captura implícita do ponteiro
    mantém os eventos no elemento até a soltura, então arrastar o dedo para fora
    **não emite `pointerleave`** e não existe abortar um toque longo já
    começado. A guarda de verdade é a PERGUNTA, que vem DEPOIS do gesto.
  - **Perguntar não contradiz o pedido que tirou o diálogo:** aquele era um
    AVISO de sucesso, com nada a decidir; este é uma DECISÃO destrutiva, e usa o
    mesmo `appConfirm({ perigo: true })` de excluir uma pasta.
- **O REGISTRO TEM O DIÁRIO DO PACOTE** (`blocoPacote`, v1.8.20). Este caminho
  já produziu duas falhas cujo relato era indistinguível a distância — *"o
  arquivo tem 0kb"* e *"não faz nada"* —, e a pergunta que resolveria as duas
  (*o toque chegou a pedir o envio, e o que o shell respondeu?*) não tinha
  resposta em lugar nenhum. Ele diz o que a sessão preparou, o estado AGORA e o
  desfecho do último envio, e **só sai depois de acontecer**.
- **O PRONTO VIVE EM MEMÓRIA; O ARQUIVO VIVE NO DISCO**, e os dois podem
  discordar (a faxina de um lançamento, o operador limpando o armazenamento).
  Quem tem a verdade é o shell, que confere o `length()` a cada envio e devolve
  `-1` — e aí o botão volta a oferecer "Exportar". Continuar oferecendo o envio
  de um arquivo que não existe seria um toque que não faz nada.

Oráculo: `tools/pacote-compartilhar.test.mjs`, com as reversões medidas — **e
ele cobre a ESCOLHA do destino e o percurso do dedo, não o Intent**. As flags de
concessão e o `length()` do arquivo são Kotlin, e o que os provaria é um
aparelho: está dito aqui porque a metade sem oráculo foi a que voltou do campo
na v1.8.18.

**E O LEITOR NUNCA TEM O ARQUIVO NA MÃO** (v1.7.9). Ele teve, da v1.7.0 até
aqui — `resp.blob()` —, e não sobreviveu ao tamanho: quinze gigabytes não cabem
nem na memória nem no armazenamento de blobs, que é uma SEGUNDA cópia ao lado da
primeira. Junto com isso vinha um teto que ninguém tinha medido: o caminho
`/saf/` para em **2 GB**, porque o Chromium dimensiona toda resposta
interceptada pelo `available()` do `InputStream` — um `int` (a invariante 8,
pelo lado de dentro). Acima disso o web recebe o arquivo CORTADO, sem erro
nenhum, e o cursor tropeça no meio de um registro. Ver `pacoteFonteDaUrl` e o
`SafJanela`, em `SafPathHandler.kt`.

**A REGRA é do web** (`controle/pacote.js`, PURA, com oráculo Node); os BYTES são
do Kotlin (`PacoteCanal.kt`). É a divisão do `pptxzip.js` × `deck.js`, e pelo
mesmo motivo — a regra é o que erra, e a regra se conserta por OTA em minutos.

### As decisões que precisam estar ditas

- **O formato é SEQUENCIAL, não zip.** Um acervo passa de gigabytes, e um zip
  pede o diretório central no fim: quem escreve guarda uma entrada por arquivo
  até o último byte, e quem lê precisa alcançar o fim antes de abrir o primeiro
  item. Aqui os dois lados andam para a frente, um registro por vez
  (`u32` do cabeçalho JSON · JSON · corpo), e a memória usada é a do maior
  BLOCO (1 MiB), nunca a do maior arquivo. **Nada é comprimido**: o que pesa é
  mp4 e m4a, que já são comprimidos.
- **O último registro é `fim`, e ele é OBRIGATÓRIO.** É ele — e não o tamanho do
  arquivo — que separa um pacote inteiro de um que acabou no meio. Meia
  biblioteca importando em silêncio é o pior desfecho que este recurso pode
  produzir, e por isso toda saída de falha da exportação APAGA o parcial
  (`MainActivity.descartarPacote`), inclusive a morte do renderer.
- **A EXTENSÃO É COSMÉTICA.** Quem identifica o arquivo são os oito bytes de
  assinatura; um provedor de documentos do Android pode trocar `.avpkg` por
  `.bin` ao criar, e o pacote continua importando. Mesma disciplina do
  `SafRegistry`: vale o conteúdo, nunca o rótulo.
- **IMPORTAR SÓ ACRESCENTA — nada que já esteja no aparelho é substituído.** Um
  id que já existe é pulado (`AVDB.mediaAdd` usa `add`, não `put`, e é a FALHA
  dele que vira "já está aqui"); um caminho de OPFS que já abre é pulado; uma
  chave de `state` que já existe só ganha o que não tinha — **união** nas listas
  de ids, **mescla RECURSIVA** nos mapas, e o LOCAL vence nas FOLHAS. É essa
  promessa que faz "importar de novo" ser inofensivo, que é o que de fato
  acontece quando alguém não tem certeza se deu certo da primeira vez.
  - **A regra é por FORMA e não por nome de chave**: uma tabela de nomes
    envelheceria em silêncio a cada chave nova, e o modo de falhar dela seria o
    pior — uma chave desconhecida caindo no ramo errado e apagando o que o
    operador tem.
  - **A MESCLA DE MAPAS É RECURSIVA, e a rasa apagava o acervo inteiro**
    (v1.8.23). `Object.assign({}, vindo, local)` decide a chave INTEIRA pelo
    lado de cá: numa chave cujo conteúdo todo mora sob uma chave aninhada,
    "mesclar" degenera em "o local vence inteiro". O caso é o índice de uma
    coleção — `coll:<id> = { indexSyncedAt, songs: [{ …, fileIdFull }] }` —,
    onde `songs` guarda o único PONTEIRO de cada faixa para o arquivo dela. O
    destino já tem esse índice (o `autoRefreshCollections` o busca sozinho em
    todo celular com internet) com `fileIdFull` vazio, então os bytes e os
    registros do catálogo chegavam e **o que apontava para eles ia fora**: a
    importação termina, o hino aparece na Biblioteca, e tocar nele vai à rede.
    Descendo às folhas, `fileIdFull: null` cai na REGRA 1 e o de fora entra —
    **o local não deixa de vencer, ele deixa de vencer com um BURACO.**
  - **Uma lista de objetos é chaveada por `id` OU `id_music`**, e essa lista de
    dois nomes é fechada de propósito: um campo especulativo ali faz uma lista
    comum passar a ser mesclada por engano.
  - **"NADA MUDOU" É DIZÍVEL POR IDENTIDADE**, e não é cosmética: quem decide se
    ESCREVE é `depois !== antes`. Enquanto a mescla devolvia sempre um objeto
    novo, toda chave de mapa era reescrita e contada — e a Bíblia mora em
    `state` com uma chave POR CAPÍTULO (1189 por versão).
  - **O preço, dito:** num aparelho que JÁ TEM biblioteca, uma preferência que
    ele já escolheu não é trocada pela do pacote. O que a recursão acrescenta é
    o VAZIO sendo preenchido, não o preenchido sendo substituído.
- **A VARREDURA DO OPFS É DO DISCO, nunca do catálogo** (`AVDB.opfsTodosOsArquivos`).
  O download de uma coleção grava dois tipos de arquivo na mesma pasta: os
  áudios, que viram registro em `files`, e as IMAGENS DE FUNDO DA LETRA, que
  não. Um pacote montado pelo catálogo chega ao outro aparelho com o hinário
  inteiro e as estrofes sobre preto — o mesmo argumento que já obrigou o
  `opfsFolderSize` a somar o disco.
- **O que NÃO viaja está nomeado em `AVPacote.FORA`**, com o motivo ao lado:
  `ota-intencao` e `yt-intencoes` (fariam o destino AGIR sozinho), `current` e
  `historico` (descrevem aquele aparelho) e **`opfs-folders`** — as pastas do
  aparelho guardam concessões do SAF que não existem no outro celular, e o modo
  de falhar é o pior do app: `listFolder` sobre uma URI que não abre devolve
  lista VAZIA, que o `controle.js` lê como *"a pasta sumiu do aparelho"*. Os
  arquivos delas saem junto (`AVPacote.pastasDoAparelho`), e o corte é por
  SEGMENTO de caminho, nunca por prefixo de texto.
- **O `stream` de um registro é RETIRADO na exportação.** Ele é o manifesto de
  uma transmissão direta: URLs do googlevideo que expiram em horas e tokens de
  um `StreamProxy` que só existe na origem. Sem o campo, o item é o LINK do
  YouTube que ele sempre foi — resolvido no primeiro toque, pelo caminho que já
  existe.
- **O LEITOR NUNCA MATERIALIZA O ARQUIVO** (v1.7.9). Ele lê por JANELAS
  (`pacoteFonteDaUrl` → `/saf/<token>?r=<ini>-<fim>`), e são DUAS operações
  porque elas custam coisas diferentes: `bytes()` para os CABEÇALHOS (dezenas
  de bytes, aos milhares — a Bíblia é uma chave por capítulo) e `blob()` para os
  CORPOS, montado de pedaços de 8 MB para que a memória fique no tamanho do
  PEDAÇO e não no do item.
  - **A CONFERÊNCIA não lê os corpos** (`proximo(false)`): ela percorre o
    arquivo inteiro pelos cabeçalhos, e lê-los junto dobraria a importação de um
    acervo. Sobre um `Blob` isso era de graça — `slice` é preguiçoso —, e é
    justamente o que deixa de ser verdade quando a fonte é uma URL.
  - **A leitura antecipada CRESCE E ENCOLHE**, e foi o oráculo que pegou isso:
    uma janela fixa erra nos dois regimes do formato. A régua é o TAMANHO DO
    SALTO contra a própria janela — continuar a menos de uma janela do fim da
    anterior é a CORRIDA de cabeçalhos (dobra, até 1 MB); saltar mais que isso
    é um corpo pulado (volta a 8 kB).
    **A pergunta NÃO pode ser uma igualdade**, e da v1.7.9 à v1.8.45 ela foi
    (`ini === bufIni + buf.length`): a borda do buffer quase nunca coincide com
    o INÍCIO de uma leitura, então MEDIDO deu **zero** crescimentos em todos os
    regimes e a janela ficou travada no piso para sempre — 19 janelas onde a
    regra de hoje faz 5, e 1.200 onde ela faz 17 num acervo de verdade. Trocar
    a igualdade por "dentro ou no fim do buffer" **não conserta** (medido: os
    mesmos 1.200), porque o salto típico é de alguns bytes ALÉM do fim.
    Oráculo: o bloco 5-B, com as duas reversões — a igualdade de ontem e o
    "cresce sempre", que é o defeito oposto e o mais caro dos dois.
  - **E o `size` vem do `pickDoc`** (shell 64). Sem ele não há como saber onde o
    arquivo acaba — e `-1` ("o provedor não disse") para a importação com frase
    própria, em vez de virar um zero que recusaria um pacote bom como vazio.
- **O NOME SAI DE QUEM CARREGA OS BYTES, E EM ORDEM** (v1.8.25). A v1.8.23
  nomeava os registros de CATÁLOGO, que têm `bytes: 0`: MEDIDO por reversão, o
  ÚLTIMO nome saía em **1% do arquivo** — os 1200 nomes de um hinário passavam
  na fração de segundo dos metadados, e a linha CONGELAVA no último durante a
  cópia dos gigabytes, que é o trabalho inteiro. Hoje quem nomeia é o registro
  `opfs`, que É o byte; o nome vem do catálogo pelo `opfsPath`, que o exportador
  escreve ANTES dos corpos por contrato. E a varredura do OPFS é ORDENADA com
  comparação NUMÉRICA — ela devolve o que o sistema de arquivos entrega, e como
  texto cru "100" vem antes de "010": sem ordenar, um hinário parece um sorteio.
- **UMA CONTAGEM ENGLOBA O PROCESSO INTEIRO** (v1.8.27). Exportar tinha "medir"
  e "escrever" como duas barras de 0 a 100 em sequência; importar tinha
  "conferir" e "aplicar". A primeira sempre MENTIA ao fechar. Hoje cada etapa
  ocupa uma FATIA da barra única (`PACOTE_FATIA_MEDIDA` 5%,
  `PACOTE_FATIA_CONFERE` 15%), e a palavra "Medindo…" saiu — ela era uma etapa
  à parte, e a medição é parte do trabalho. **As fatias são fixas, e as duas
  alternativas estão ditas:** por BYTES LIDOS a conferência valeria ~1% e
  ficaria parada o tempo que leva; MEIO A MEIO a barra correria até 50% e depois
  rastejaria. A fatia não precisa ser exata — precisa ser MONOTÔNICA e nunca
  voltar a zero. Corolário: `bgTaskStep` **não reinicia mais a média** ao trocar
  de etapa (a razão daquilo era cada etapa ter a própria barra).
- **O TILE OCIOSO É O CANCELAR DO IRMÃO** (v1.8.27). O aro é o desenho do
  TRABALHO EM CURSO, e pintá-lo no botão que não está fazendo nada é a tela
  afirmando o que não é. Quem trabalha mostra o aro e o número; o outro oferece
  a saída, com o ✕ no lugar do ícone da função. **Isso revoga a decisão da
  v1.7.3** de a importação não poder ser interrompida: aquele texto provava que
  não dá para DESFAZER, e o que faltava era PARAR — seguro exatamente pela razão
  que ele dá (*o que já entrou está certo*), com a reimportação continuando de
  onde ficou.
- **O ÍCONE DA NOTIFICAÇÃO SEGUE O TRABALHO** (v1.8.27, redesenhado na v1.8.29).
  `bgProgress` leva `icone` — `baixar`, `enviar` ou `processar` —, e o
  `SyncService` desenha a seta para baixo, a seta para cima ou o círculo de duas
  setas. É a regra da v1.4.19 (*o ícone segue a legenda*) na única superfície que
  faltava. **Nome ausente ou desconhecido = `baixar`** — um bundle mais antigo
  que a ponte não manda o campo, e falhar para o lado que já existia é a regra
  deste app. (O booleano `baixando` da v1.8.27 SAIU na v1.8.29: a pergunta era
  "traz bytes da rede?", e a certa é a DIREÇÃO do movimento — importar traz o
  acervo PARA o aparelho venha ele de onde vier.)
- **O RELATÓRIO DO FIM CONTA MÚSICAS, não unidades internas** (v1.8.25). Ele
  dizia *"4 item(ns), 2228 arquivo(s) e 172 ajuste(s)"* — a store de mídia, os
  arquivos do OPFS (um hino tem áudio, playback e as imagens de fundo da letra,
  daí 2228 para 601 hinos) e chaves de `state`. Hoje: *"Hinário Adventista 2022:
  601 de 601 músicas"*. É o ESTADO e não o delta de propósito — importar de novo
  depois de uma queda tem de responder "601 de 601", e um delta diria "0
  entraram" sobre um hinário completo. A conta sai de `countDownloaded`, a MESMA
  que a Biblioteca usa: uma segunda conta divergiria da tela onde se confere.
  - **E ELE É RESUMO, NÃO LISTAGEM** (v1.8.27). Uma frase por coleção, coladas
    num parágrafo, deram um MURO com vinte e três álbuns. A forma é a de todo
    bloco de diagnóstico deste repositório: **o TOTAL responde, e só a EXCEÇÃO é
    nomeada** — *"23 coleções · 312 de 312 músicas"*, com uma linha
    "Incompletas:" só quando há. Vinte linhas de "10 de 10" não são auditoria: a
    informação inteira delas é o total. Uma coleção SOZINHA ganha o nome dela,
    porque ali o nome é a confirmação.
- **OS AJUSTES INDIVIDUAIS NÃO VIAJAM** (v1.8.25). Decisão do operador: *"o
  propósito da exportação não é copiar o app de um usuário … o propósito é para
  dados massivos da biblioteca"*. Doze chaves de preferência entraram no `FORA`,
  a linha "Ajustes e catálogos" saiu da folha (ela nunca foi escolha — nascia
  marcada e sem ouvinte) e a palavra "ajustes" saiu do relatório. **A lista
  continua sendo uma NEGATIVA**, e isso tem asserção própria: uma chave nova
  viaja por padrão, porque uma lista de PERMISSÃO deixaria um dado de acervo
  novo para trás em silêncio — o defeito que a v1.8.23 pagou.
- **A BÍBLIA CONTINUA POR CAPÍTULO, e a medição é a razão** (v1.8.25). Dividi-la
  por LIVRO reduziria as chaves de 1189 para 66, e foi pedido — mas MEDIDO em
  Chromium, ler UM capítulo passaria de **0,19 ms para 4,59 ms** (Salmos),
  porque a leitura teria de desserializar o livro inteiro. A leitura é o caminho
  do CULTO, a cada virada de capítulo no sermão. O ganho que o pedido procura
  estava no outro lado e saiu por LOTE (`AVDB.updateStateLote`): gravar 1189
  capítulos passou de **596 ms para 153 ms**, sem migração e sem tocar na
  leitura.
- **O PONTEIRO QUE NÃO LEVA A LUGAR NENHUM É APAGADO, E QUEM DECIDE É O DESTINO**
  (v1.8.26). O índice de uma coleção é uma chave de `state` e viaja INTEIRO; os
  arquivos são cortados pela folha de escolha. Um pacote só do hinário leva
  junto o índice de todos os OUTROS álbuns, com o `fileIdFull` da origem — e
  `colecaoCompleta` conta `fileIdFull`, então o álbum passa a parecer baixado e
  **o botão de baixar dele some**. Enquanto a mescla era rasa isso não aparecia;
  a v1.8.23 passou a preencher os buracos e o defeito veio junto.
  `pacoteAcertarPonteiros` roda no fim de toda importação **e uma vez na
  abertura** (a marca mora no `FORA`, senão diria a um aparelho quebrado que ele
  já foi consertado). O destino é o único que sabe as duas coisas que importam —
  o que chegou E o que ele já tinha —, e é a regra do `opfsTodosOsArquivos` num
  lugar novo: pergunta-se ao DISCO, não ao catálogo.
- **A FOLHA DE ESCOLHA ABRE ANTES DE MEDIR** (v1.8.26). O esboço
  (`pacotePlanoAproximado`) sai do que já está em memória mais um cursor sobre o
  catálogo (`AVDB.filesResumo`); a varredura do disco corre DEPOIS da escolha,
  onde já existe barra de progresso. O peso arredonda PARA CIMA e leva a palavra
  **"aprox."** (`pacotePeso`) — é o lado certo do erro numa tela cujo consumidor
  é *"cabe no cartão?"*, e quem de fato decide isso é o plano exato, mais
  adiante.
  - **O QUE A FOLHA NÃO CHEGOU A OFERECER ENTRA MARCADO.** Uma coleção que só a
    varredura conhece ficaria de fora EM SILÊNCIO, e deixar bytes para trás é o
    único erro deste caminho que não se recupera.
  - **A MONTAGEM É UMA SÓ** (`pacoteMontarFolha`) para o esboço e para o plano
    exato: duas divergiriam no primeiro ajuste, e a divergência apareceria como
    um grupo que existe na tela e não no arquivo.
- **A NOTIFICAÇÃO DA IMPORTAÇÃO MOSTRA A ETAPA E OS ITENS** (v1.8.23). Ela era
  `bgTaskStart('Importando o acervo', 1)` com o NOME DO ARQUIVO como item único:
  um trabalho de UM item, com uma linha que nunca trocava, e a CONFERÊNCIA — que
  percorre o pacote inteiro pelos cabeçalhos e dura minutos — sem reportar nada.
  Hoje o rótulo diz a ETAPA (*"Conferindo o pacote"* → *"Importando para a
  Biblioteca"*), a conferência anda, e cada `media`/`arquivo` que entra passa o
  NOME para a linha de baixo — que é o que o operador reconhece.
  - **A RÉGUA CONTINUA EM BYTES**, e isso é decisão: o acervo tem 600 hinos de
    megabytes ao lado de milhares de chaves minúsculas da Bíblia, então CONTAR
    ITENS faria a barra saltar para 85% nas chaves e rastejar nos hinos — um
    número que anda mais rápido e mente. O que o pedido quer é a LISTA.
  - **Só `media` e `arquivo` têm nome de gente.** Um caminho de OPFS e uma chave
    de `state` são endereços, e escrevê-los ali trocaria "005. Jubilosos Te
    Adoramos" por "folders/hymnal-2022/5-cantado.mp3".
  - **A FILA DE NOMES TEM TETO** (`BG_FILA_MAX`). Ela nasceu para um DOWNLOAD, em
    que 6 trabalhadores entregam um item a cada segundos; uma importação produz
    milhares de nomes em minutos contra um mostrado a cada `BG_SPIN_MIN`. Sem
    teto a linha passa a mostrar o que entrou MINUTOS atrás — a sensação oposta
    à que ela existe para dar. Quando a produção passa a exibição, o que se
    descarta é o PASSADO.
  - **Trocar de ETAPA recomeça a média e chega na hora** (`bgTaskStep`): o
    rótulo é a mesma classe do primeiro nome e da troca de régua, e carregar o
    tempo da etapa anterior faria a segunda nascer com o dobro do tempo restante.
- **O QUE ERA PURO CUSTO SAIU DO CAMINHO** (v1.8.23) — e o que sobra é trabalho
  real: copiar os bytes para o OPFS. Uma transação por chave de `state` em vez
  de duas (havia um `getState` antes do `updateState` só para decidir se
  contava, com a mescla calculada duas vezes); chave idêntica dos dois lados
  deixa de ser reescrita; e o percentual do botão só toca o DOM quando o inteiro
  muda — ele é chamado por REGISTRO, milhares de vezes num acervo.
- **A IMPORTAÇÃO NÃO RECARREGA MAIS O APP** (v1.8.29). Ela terminava em
  `location.reload()` desde a v1.7.0, com o argumento de que *"não há caminho de
  invalidação que alcance as dezenas de lugares"* — que **nunca foi medido**. A
  lista é curta e enumerável, e são as MESMAS chamadas do `init()`:
  `loadCollections()` (o catálogo, o `collState`, os pesos, a letra) e `load()`
  (as listas do módulo). As outras quatro do `init()` ficam de fora com motivo:
  `desnumerarAlbunsBaixados`/`preencherAlbunsDosHinos` são migrações de
  PASSAGEM ÚNICA já marcadas em estado, `migrarPastasParaFavoritos` e
  `histCarregar` tratam de dados que não viajam (`AVPacote.FORA`), e
  `clearCurrentSelection` **NUNCA** entra — ela esvazia a cena.
  **É essa última que torna a rehidratação melhor e não só mais discreta:** a
  recarga derrubava a projeção junto, então importar durante um culto apagava o
  telão. A recarga fica como saída de FALHA da rehidratação — ali o estado é um
  que ninguém enumerou, e reabrir o documento é o único ponto que reconstrói
  tudo por construção.
- **O ARQUIVO DO PACOTE É CONSUMIDO** (`pacoteConsumirOrigem`, shell 70), e só
  no caminho de sucesso. Um pacote é o acervo INTEIRO: deixá-lo em Downloads
  dobra o que a biblioteca ocupa, e quem mais recebe pacote é o aparelho
  apertado. **Cancelou ou falhou, o arquivo FICA** — ele é o que faz a próxima
  tentativa continuar de onde parou, e é por isso que o consumo não mora no
  `finally`, que é o lugar óbvio. O desfecho é DITO no relatório nos dois
  sentidos: quem pediu o espaço de volta precisa saber quando não deu.
- **O plano guarda IDs e TAMANHOS, nunca registros.** Um acervo tem milhares de
  entradas, cada uma com a letra inteira e uma miniatura; segurá-las todas
  enquanto gigabytes atravessam o canal é um OOM num processo que hospeda dois
  WebViews e a `Presentation`. Ler um registro NÃO lê os bytes do Blob (o IDB o
  guarda por referência), então reler cada um na hora de escrever custa o
  metadado. **A exceção são as chaves de `state`**, que o plano lê e CODIFICA
  uma vez e a escrita reusa: elas são milhares e minúsculas, e o
  `JSON.stringify` delas é o único jeito de saber quanto pesam — ver abaixo.
- **AS CHAVES DE `state` TAMBÉM SÃO UM CURSOR** (`AVDB.stateVarrer`, v1.8.24), e
  pelo mesmo motivo do irmão logo abaixo: o plano fazia um `getState` por chave,
  e a Bíblia mora aqui com uma chave POR CAPÍTULO. MEDIDO em Chromium sobre
  3.600 chaves de tamanho real (11,8 MB de JSON): **525 ms por chave contra
  275 ms por cursor**, com o piso irredutível (só serializar) em **64 ms**.
  **MEDIR NA ABERTURA foi considerado e recusado**: o custo não some, muda para o
  pior instante — o app abre minutos antes do culto, e a regra das rotinas de
  acervo é CEDER a vez ao que está no ar. Um REGISTRO mantido de tamanhos é pior:
  ele é uma segunda fonte de verdade sobre o DISCO, e a varredura é do disco
  justamente porque o catálogo não conhece as imagens de fundo da letra — se as
  duas derivarem, arquivos deixam de viajar em silêncio. O que sobra é a
  varredura do OPFS (**455 ms** para 1.800 arquivos), que é O(arquivos) por
  construção.
- **O RESUMO DO ACERVO É UM CURSOR, não N leituras** (`AVDB.mediaResumo`). O
  plano precisa do peso de cada item; pedi-lo com um `getMedia` por id é uma
  transação por registro, milhares delas em fila. Um cursor percorre a store
  inteira de uma vez e guarda dois campos por item — e não é um `getAll`, que
  materializaria a letra e a miniatura de tudo num array só.

### O 0%, e por que ele não era lentidão de disco (v1.7.2)

Relato do operador: *"ou está absurdamente lento, ou não está funcionando, pois
não sai de 0% de progresso da exportação"*. As duas leituras estavam certas, e a
causa das duas é a mesma: **cada bloco que atravessa o canal é uma IDA E VOLTA**
(`postMessage` → thread de escrita → ack), e ela custa o mesmo para 50 bytes e
para 512 kB.

- **A BÍBLIA MORA EM `state` COM UMA CHAVE POR CAPÍTULO** — 1189 por versão
  (`bible:<v>_<livro>_<cap>`, ver `ensureBibleVersionDownloaded`). Com duas ou
  três versões baixadas são ~3.600 chaves, e a versão anterior mandava um bloco
  por CABEÇALHO e um por CORPO: **~7.200 viagens** para escrever poucos
  megabytes.
- **E NENHUM REGISTRO DE `state` REPORTAVA BYTES** — nem o plano os somava —,
  então a parte mais demorada da exportação acontecia inteira com a notificação
  parada em 0%. Indistinguível de travar.
- **O ESCRITOR JUNTA OS PEQUENOS** (`pacoteEscritor`): os mesmos megabytes viram
  ~20 blocos. Um corpo GRANDE (≥ um bloco) continua indo direto, fatia por
  fatia — passá-lo pelo buffer seria uma cópia de memória a mais por bloco, e é
  ele que responde por quase todo o peso do pacote. **O FORMATO não muda em
  nada:** o arquivo é uma sequência de bytes, e em quantos pedaços ela atravessa
  o canal é assunto deste lado.
- **O progresso conta CORPO, nunca cabeçalho** — é o que o plano soma, e contar
  os cabeçalhos junto faria a barra passar de 100%.
- **E TROCAR A RÉGUA NÃO É ANDAR NELA** (`bgTaskBytes`): a unidade e o
  denominador são ESTADO, e passavam pelo freio de 700 ms da notificação. A
  barra anunciava "0 de 1" por quase um segundo antes de dizer o que ela era —
  num pacote de gigabytes é o primeiro número que o operador lê.

### O que levar: a folha de grupos (v1.7.2)

Pedido do operador: *"pode fazer ele de forma segmentada, por coleção? … caso o
usuário não queira levar toda a biblioteca … permita um popup com um check list
de grupos para a exportação"*.

- **A MEDIÇÃO VEM ANTES DE TUDO, E ELA APARECE.** O plano varre o OPFS inteiro,
  percorre a store de mídia e lê as chaves de `state`; até aqui ele rodava
  DEPOIS do "Salvar como", em silêncio absoluto. Hoje ele roda antes da folha —
  que precisa dos tamanhos de qualquer jeito — com o cartão da preview dizendo
  "Medindo o acervo", e a exportação começa com tudo já conhecido.
- **A FOLHA É A MESMA do seletor de destinos** (`escolherDestinos`): as mesmas
  linhas selecionáveis de corpo inteiro, a mesma caixa como indicador, o mesmo
  confirmar sempre visível — que mostra o PESO do que foi marcado, porque é a
  única pergunta que sobra depois de escolher. Um segundo formato de folha de
  múltipla escolha seria a divergência que a v5.252 gastou um lote para tirar.
- **TUDO NASCE MARCADO:** o caso normal é levar o acervo inteiro, e a folha
  existe para PODER tirar.
- **"TUDO" É UM ALTERNADOR** (v1.7.3), na primeira linha: com tudo marcado ele
  LIMPA, com qualquer coisa fora ele MARCA TUDO, e o rótulo diz qual das duas o
  toque vai fazer. Dois botões seriam um deles sempre inútil.
- **AS COLEÇÕES VÊM AGRUPADAS PELAS SEÇÕES DA BIBLIOTECA** (v1.7.3), e da mesma
  FONTE que ela desenha — as coletâneas do `AVColetanea.aplicar`, com os
  hinários e as séries na raiz e os álbuns sem categoria em "Outros álbuns".
  Uma segunda leitura do catálogo divergiria da tela em que o operador aprendeu
  onde cada coleção mora, que é justamente o que ele pediu para não acontecer.
  `plano.grupos` continua PLANO (é ele que o laço de escrita consome);
  `plano.folha` é a árvore, e existe só para a folha desenhar. **Uma varredura
  no fim recolhe o que a árvore não alcançou** — uma coleção que não apareça na
  folha nunca é marcada, isto é, não entra no arquivo.
- **A BARRA DO GRUPO MARCA; a SETA ABRE.** Na Biblioteca a barra abre, porque
  lá o que se vem fazer é olhar dentro; aqui o que se vem fazer é incluir e
  excluir. São dois alvos e duas coisas, e é por isso que a barra é uma `<div
  role="button">` com um `<button>` dentro — botão dentro de botão é HTML
  inválido, a mesma solução da `.coll-group-bar`.
- **A MARCA DE UM GRUPO TEM TRÊS ESTADOS.** Com dois de cinco álbuns marcados,
  uma caixa de duas posições mente das duas formas: vazia diz que nada vai,
  cheia diz que tudo vai. O traço da `parcial` é o mesmo desenho do ✓ com uma
  borda em vez de duas. E **parcial vai para CHEIO**: o toque numa marca
  parcial é *"quero este grupo"*, e o contrário desfaria o que o operador
  acabou de marcar à mão.
- **"Ajustes e catálogos" NÃO É OPCIONAL**, e a razão é o coletor de lixo do
  destino: as listas do app (`imports`, `playlist`, `favs`) moram em `state`, e
  um item de mídia que chega sem a lista que o referencia é ÓRFÃO — o
  `gcOrfaos` da abertura seguinte o apaga. Um pacote "só a mídia" importaria e
  sumiria sozinho. Ele é uma linha SEM ouvinte (`.song-menu-fixo`), com a marca
  já acesa e o motivo no subtítulo: uma linha com cara de alvo que não responde
  ao toque é pior que uma que nunca prometeu responder.
- **O GRUPO DE UM CAMINHO É REGRA PURA** (`AVPacote.grupoDoCaminho`), porque a
  relação entre o OPFS e as coleções é uma CONVENÇÃO DE CAMINHO
  (`folders/<id>/…`), não um campo. Ela tem o grupo de escape `outros` — uma
  coleção que saiu do catálogo continua com bytes no disco, e sem ele eles
  sairiam do pacote sem aparecer em lista nenhuma.
- **O CATÁLOGO SEGUE OS BYTES, pela MESMA função.** Um registro de `files` cujo
  arquivo não viaja é uma faixa que aparece na Biblioteca do destino e não toca.
- **O `info` DIZ QUE GRUPOS O ARQUIVO TRAZ.** Um pacote parcial é o caso normal
  agora, e *"o que tem aqui dentro?"* passou a ser uma pergunta com resposta.
- **E ELA PODE SER CANCELADA** — o toque no PRÓPRIO BOTÃO que está trabalhando
  (v1.7.3; era o ✕ do cartão sobre a preview), lido pelo escritor a cada bloco:
  a anatomia do `ytCancel`, e pelo mesmo motivo — o laço está ocupado
  justamente com o que se quer parar. Até a v1.7.2, começar era ficar preso até
  o fim ou até uma falha; desistir apaga o parcial pelo caminho de saída que
  toda falha já usava, e não abre diálogo de erro — o operador acabou de tocar
  no botão e o botão responde.

### O feedback mora no botão que começou a ação (v1.7.3)

Pedido do operador: *"o feedback da ui sobre a preparação da exportação … que
seja exibida sobre o próprio botão de exportar, já que a ação acontece ali e não
na tela ou controle"*.

**O APP JÁ TINHA A MECÂNICA** — o `#otaRow` (`falarNoOta`), e o "Guardar como
pacote", que a usou da v5.207 à v1.8.53 e a perdeu ao virar um botão de símbolo
(um símbolo não tem rótulo a emprestar) —, e a regra está na lista de canais de
resposta do `controle.js` desde a v5.207: *"o rótulo do controle empresta a si
mesmo por alguns segundos e volta"*. O cartão sobre a preview é o canal do que
ACONTECERIA NELA; uma exportação não acontece na preview.

- **`falarNoTile(el, texto, ms)`** troca o `.qs-titulo` e o devolve. `0` = fica
  até alguém reescrever ou calar, o mesmo contrato do `falarNoOta`.
- **ISSO NÃO REABRE A SEGUNDA LINHA que a v1.7.2 removeu.** Aquela era
  PERMANENTE e descrevia o estado em repouso; esta é o próprio TÍTULO, por
  alguns segundos. O tile continua com uma linha de texto.
- **O RÓTULO DE ORIGEM MORA NO NÓ** (`data-nome`), e não num `WeakMap` de
  módulo: `pacoteRenderTiles()` roda no TOPO do arquivo, na carga, e o
  `pintarTile` leria a constante antes da linha que a declara — zona morta
  temporal, `ReferenceError`, app parado. É a armadilha que o
  `cifraAdotarVelocidade` documenta, e o atributo a fecha por construção.
- **A ETAPA vai para a NOTIFICAÇÃO**, que é a superfície com espaço e a que
  existe com o app minimizado — que é onde uma exportação de gigabytes de fato
  acontece. No botão cabe o número.
- **O DESFECHO FALA NOS DOIS LUGARES, e não é repetição:** o botão diz que deu
  certo e quanto pesou (a resposta ao toque, onde o toque foi dado), e o
  diálogo diz o que o botão não tem como dizer — o NOME do arquivo e o que
  fazer com ele.

**AS QUATRO GUARDAS DA IMPORTAÇÃO (v1.8.15).** Todas nasceram da mesma
pergunta — *"o app distingue esta falha de um sucesso?"* — e a resposta era não
nas quatro:

- **A FONTE PODE DEVOLVER MENOS DO QUE SE PEDIU, e o `blob()` não conferia.** O
  irmão `bytes()` sempre conferiu; o caminho que traz os CORPOS, não. O
  `SafJanela.ler` corta no que conseguiu, e o caso que torna isso provável é o
  arquivo chegando por compartilhamento: ele APARECE em Downloads antes de
  terminar de ser escrito, o `size` já responde o valor final, e o cursor avança
  pelo `bytes` DECLARADO — um vídeo de 300 MB gravado truncado, sem erro nos dois
  lados. **A conferência não cobre isto**: ela prova o ARQUIVO, e quem mente é a
  FONTE, no meio da leitura. O que a guarda garante é que o item CORTADO não
  entre; os anteriores entraram e está certo que tenham entrado.
- **DISCO CHEIO NÃO É "JÁ ESTAVA AQUI".** O `mediaAdd` usa `add`, e a FALHA dele
  virava o "já está aqui" — mas ele falha por DOIS motivos, e um
  `QuotaExceededError` fazia todo o resto do pacote cair em `repetidos`. O
  diálogo saía VERDE: *"0 entraram, N já estavam aqui e foram mantidos"* — a
  frase mais tranquilizadora possível sobre a falha mais destrutiva possível. A
  pergunta é pelo NOME da exceção (a mensagem é traduzida), e `ConstraintError`
  continua sendo o duplicado de verdade.
- **`chaveViaja` VALE NAS DUAS PONTAS.** Ela tinha um chamador — o plano da
  EXPORTAÇÃO —, e a lista `FORA` valia só na saída. Enquanto o arquivo veio do
  cartão do próprio operador isso era teórico; com o compartilhamento ele passa
  a vir do aparelho de OUTRA pessoa. Um `current` forjado é lido pelo
  `lerDetentores` e prende mídia contra o coletor. **A recusa é CONTADA e sai na
  frase** — recusar em silêncio é o defeito de cima por outro caminho.
- **A MESCLA RECONHECE LISTA DE OBJETOS COM `id`.** `messages` e `folders` são
  `[{id,…}]`: não são lista de strings nem mapa, então caíam na regra 4 e o
  LOCAL vencia inteiro. O recurso só funcionava no aparelho VIRGEM — que é
  justamente onde nenhuma regra de mescla é exercitada.

E duas de fluxo, no mesmo lote: a bandeira `pacoteEmCurso` sobe **antes da
MEDIÇÃO** (entre o toque e o "Salvar como" correm segundos, e um segundo toque
ali fazia o `adotar` fechar o stream VIVO da primeira exportação e trocar o
destino — o parcial dela ficava para sempre); e a **CONFERÊNCIA entrou no
`withBgWork`**, com a mesma tarefa da aplicação: ela percorre o arquivo inteiro
pelos cabeçalhos, e rodava sem serviço, sem wake lock e sem notificação, com a
palavra "Conferindo…" parada — o achado da v1.8.13 repetido do outro lado.

Oráculos: **`pacote.test.mjs`** (a REGRA — assinatura, cursor, recusas,
saneamento, e o grupo de um caminho), **`pacote-ida-e-volta.test.mjs`** (a
LIGAÇÃO — dois contextos de navegador, como dois celulares; é dele o bloco 12,
que prende o PONTEIRO do índice de uma coleção chegando ao destino que JÁ TEM a
coleção — o defeito da v1.8.23, que não tem sintoma nenhum na importação: ela
termina, anuncia os itens, e o hino só falha ao TOCAR —, e o bloco 13, que
prende a ETAPA e os NOMES na notificação) e
**`pacote-por-grupos.test.mjs`** (o LOTE, o PROGRESSO no próprio botão, o
AGRUPAMENTO da folha e a ESCOLHA cortando bytes). Os dois primeiros são dois porque *ler cada lado isolado aprova os
dois*; o terceiro existe porque o que ele mede não tem sintoma — uma exportação
lenta e muda continua produzindo o arquivo certo.

---
