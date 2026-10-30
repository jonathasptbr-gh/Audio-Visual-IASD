# Diagnóstico — a Verificação do Sistema e o Registro

As regras de diagnóstico do app, com os casos medidos que as criaram: a
Verificação do Sistema (os quatro desfechos, o que uma checagem nunca faz, a
exceção do download de teste), as rotinas de massa, os campos de endereço de
terceiro, o backfill, e o Registro (uma porta só, sobre o culto, o veredito e o
dado cru). O `CLAUDE.md` guarda o resumo; a mecânica de cada bloco está no
capítulo do Controle (`arquitetura/CONTROLE-COLECOES.md`, "A Verificação do Sistema").

> **Movido do `CLAUDE.md` na revisão A2 (2026-10-30), sem mudança de texto** (só os links relativos e o nível dos títulos). No núcleo ficou um resumo com o link para cá. "Acima", "abaixo", "esta seção" e as invariantes numeradas falam do `CLAUDE.md`, de onde este texto veio.

- **A VERIFICAÇÃO DO SISTEMA TEM QUATRO DESFECHOS, E O QUARTO É O QUE A MANTÉM
  VIVA** (v1.10.0). O tile *"Verificar"* de Configurações roda 41 checagens em
  NOVE áreas e lista `funcionou` · `não funcionou` · `não respondeu` ·
  `não se aplica`. **E O APARELHO É A ÚLTIMA PALAVRA** (v1.10.5): a primeira
  rodada num Android de verdade derrubou TRÊS linhas que nenhum oráculo
  alcançava — uma sonda de rede em modo `cors` sobre uma rota sem CORS
  (vermelho com a internet funcionando), a marca de persistência que um
  WebView não recebe (vermelho permanente sobre uma biblioteca intacta) e a
  varredura do disco que não cabe no prazo num acervo de 2,6 GB. **Linha nova
  só é dada por boa depois de uma cópia do Registro DELE.** **E O VERMELHO É
  SOBRE O QUE O OPERADOR USA, com a nota mandando a ação que FECHA o estado**
  (v1.10.7): a Bíblia reprova pela versão EM USO (a emparedada fora de uso é
  aviso), e a pasta que "mostra a mais" manda EXCLUIR de novo — sincronizar ali
  trazia de volta o que ele acabou de tirar. O detalhe está no capítulo do
  Controle, "A Verificação do Sistema". Os
  três primeiros o operador pediu; **o quarto é o que impede a parede
  vermelha** — sem ele um celular sem TV reprova todo o telão e um aparelho
  novo reprova toda a Biblioteca, e em duas rodadas ele aprende que o vermelho
  daquela folha não quer dizer nada. É a regra `semFonte` da v5.134 aplicada a
  um diagnóstico. **E "não respondeu" nunca vira "não funcionou":** um
  `TypeError` do `fetch` é ninguém do outro lado, um status de erro é resposta,
  e as duas causas pedem ações opostas — trocá-las foi o defeito da v1.9.14.
  **CHECAGEM NOVA É UMA LINHA na tabela `TESTES`** e já ganha prazo, captura de
  exceção, ordem, contagem e entrada no Registro; ela nasce respondendo a três
  perguntas: *pode dar falso vermelho num aparelho normal?* (então tem ramo
  `na`), *pode dar falso verde?* (então não vale a linha) e *pode ser vista num
  culto?* — porque o botão está a dois toques da projeção. **O QUE UMA CHECAGEM
  NUNCA FAZ:** mudar a cena, chamar `play()` (pede foco de áudio, e o Chromium
  PAUSA o telão), ligar o servidor das telas, pedir permissão, abrir tela do
  sistema, ler a área de transferência (o aviso do Android 12+ é VISÍVEL, e um
  teste que aparece não é teste), baixar megabytes ou deixar rastro — a sonda de
  escrita apaga o que criou no `finally`. **A EXCEÇÃO ÚNICA AO "NÃO BAIXA
  MEGABYTES" É A VERIFICAÇÃO COMPLETA** (v1.12.27, pedida pelo operador): a
  leve (a tabela `TESTES`) NUNCA baixa nada; desde a v1.12.44 a linha
  `TESTE_DL` roda no fim de TODA verificação, sem botão, por cima da leve — baixa um episódio ANTERIOR do
  Provai e Vede fora do aparelho, mede cada fase e o APAGA. Ela baixa pelo MESMO caminho do "Tocar
  agora" (`ytBaixarNativo` no teto do operador) e as outras regras continuam
  valendo nela: não começa com mídia no ar, com outro download ou na rede que
  o operador não liberou; se cancela se uma mídia ENTRA no ar; não muda a cena
  nem chama `play()` (a duração sai dos metadados); e a limpeza roda num
  `finally` em todo desfecho e é CONFERIDA — o que sobrar é falha. Uma segunda
  exceção precisa de um pedido do operador do mesmo jeito. **O único comando que ela emite é
  `diag-ask`**, e isso é ASSERÇÃO: o oráculo espiona `AVDB.sendCommand` durante
  a rodada inteira. **Com mídia no ar ela cede A VEZ, não a rodada:** as
  marcadas `cena` saem `na` com o motivo e o resto roda, porque um toque que não
  faz nada é o pior desfecho de um botão. **O resultado é UM objeto**, lido pela
  tela e pelo bloco do Registro — uma segunda contagem divergiria no primeiro
  ajuste, e o que sairia é uma tela que discorda do arquivo que o operador
  mandou (a completa SOMA a linha dela a esse objeto, nunca cria outro). **A
  TELA E O REGISTRO DIZEM COISAS DE TAMANHO DIFERENTE, do mesmo objeto**
  (v1.12.44): a tela é um ANEL com feitas/total enquanto anda e, no fim, SÓ os
  problemas — "não funcionou", depois "não respondeu" (que não é falha do app e
  tem cor própria) —; o que funcionou e o que não se aplica não aparecem (o
  operador: *"listar o que está funcionando não me é informação nenhuma"*). O
  Registro segue com a lista inteira e as QUATRO contas. **A rodada é UMA** (a
  leve e o download de teste encadeados, sem botão) **e recolher a seção dela SÓ A
  OCULTA** (v1.12.52; até a v1.12.51 recolher cancelava) — o Ocultar da faixa, o
  chevron, o voltar e fechar Configurações deixam a rodada seguir, e o tile
  "Verificar" mostra o aro e o percentual e, no fim, o desfecho até a seção abrir
  (`pintarTileDoTeste`, `testeNaoVisto`); reabrir com resultado não visto o mostra
  SEM rodar. **Só o Cancelar vermelho interrompe**, e o resultado de uma rodada
  cancelada não é guardado. **E a limpeza do download de teste confere também o
  cache do SHELL** (v1.12.52): um arquivo DESTE vídeo na `sobraNoCache` da medida
  dele é falha.
- **UMA ROTINA DE MASSA CONTA O QUE CHEGOU AO DISCO, NUNCA O QUE ELA TENTOU**
  (v1.9.13). O laço de `syncCollection` move a barra por `done`, que conta
  TENTATIVAS — e enquanto `downloadCollectionSong` devolvia `undefined` em toda
  falha abaixo do metadado (o `catch (_) { return null }` de
  `downloadCollectionFile`), uma sincronização em que NADA foi gravado era
  indistinguível de uma que deu certo: barra até o fim, *"Atualizado (N
  baixado(s))"*, *"Completo"* no grupo — e o botão de baixar intacto, porque
  nenhum `fileIdFull` tinha sido escrito. **Um trabalho de massa que falha e se
  anuncia como sucesso é o pior artefato que este projeto sabe produzir**, e ele
  custa o sábado: o operador vai embora convencido de que o acervo está no
  aparelho. **A senha é a cadeia de retorno INTEIRA** — quem engole a falha
  devolve o desfecho, e o desfecho sobe até quem escreve a frase. O irmão no
  mesmo despacho (`downloadSerieItem`) sempre acertou, e é o modelo.
- **UM CONTADOR DE DESFECHOS TEM DE FECHAR A CONTA, e o que não é resposta do
  outro lado também é desfecho** (v1.11.6). O diário das cifras contava os cinco
  desfechos que o SITE dá e ignorava a rede que não respondeu, a música adiada
  por uma mídia e a exceção engolida: uma passada INTEIRA sem rede saía como
  *"968 tentadas, 0 achadas, 0 sem cifra, 0 sem página"* — a mesma linha de uma
  passada que nem rodou, e cada uma sobrescrevia a anterior com zeros. A soma
  dos desfechos com `tentadas` tem de fechar sem sobra; quando não fecha, o
  resto é impresso, nunca calado. **E uma linha que mede TEMPO imprime o tempo
  da que respondeu devagar**: *"OK"* e *"OK, mas levou 8 s"* são a diferença
  entre rede boa e rede que quase não respondeu.
- **UM CAMPO DE ENDEREÇO DE TERCEIRO ACEITA AS DUAS FORMAS, E TRAVA O HOST**
  (v1.9.14). O LouvorJA devolvia CAMINHO em `url_music`/`url_image` e passou a
  devolver a URL INTEIRA; a concatenação seca de `fileUrl` dobrou o prefixo, e
  **o parser de URL não reclama** — no PATH STATE do WHATWG o `:` e o `//` não
  são separadores, então o pedido sai BEM-FORMADO, chega ao host certo e a fonte
  responde 404 para 100% dos arquivos. Três regras ficam: **aceitar as DUAS
  formas** (a origem pode desfazer a mudança, e um app que só aceite a de hoje
  quebra pelo mesmo caminho silencioso); **travar no DOMÍNIO da origem**, porque
  aceitar URL absoluta é deixar o JSON dizer para onde o `fetch` do orígin
  privilegiado vai (endereço de fora falha FECHADA); e **nunca re-encodar** — o
  `fetch` já percent-encoda pelo path percent-encode set, e `encodeURI` sobre um
  caminho já codificado produz `%25` e quebra até o que funciona. **E o que o
  parser ENGOLE fica medido sem conserto:** `?` e `#` num nome de arquivo truncam
  a URL sem erro nenhum, e sanear é adivinhar — o que se entrega é a CONTAGEM.
  **A TRAVA É NO DOMÍNIO E NÃO NUM HOST EXATO** (v1.9.15, corrigindo a v1.9.14):
  a origem serve áudio e imagem por campos do MESMO JSON e nada a obriga a
  servi-los pelo mesmo subdomínio — travado no host exato, o `url_image` em outro
  host da origem virava caminho, respondia 404, e o desfecho era o áudio
  chegando e o FUNDO da letra não. **O PONTO ANCORA A COMPARAÇÃO:** sem ele,
  `endsWith('louvorja.com.br')` aceita `evillouvorja.com.br`, que qualquer um
  registra — a invariante 2 do shell pelo outro lado do string. E o domínio é
  DERIVADO do endereço, nunca digitado à parte. **E A TRAVA CRIA UMA CAUSA que
  ela mesma precisa nomear:** falhar fechada produz um 404 do NOSSO host,
  indistinguível de *"o arquivo não existe"* — duas causas OPOSTAS com a mesma
  linha mandam procurar no lugar errado. Daí o contador `foraDoServidor`,
  separado de `recusadas` (o pedido nem sai; somá-los faria a distribuição de
  status descrever uma resposta que ninguém deu) e com o ÚLTIMO endereço junto,
  que é o que diz se a trava precisa alcançar aquele host.
  Oráculo: `louvorja-url.test.mjs`.
- **A EXTENSÃO SAI DO NOME DO ARQUIVO, NUNCA DA URL INTEIRA** (v1.9.15).
  `url.split('.').pop()` bastava enquanto o campo era CAMINHO; com ele virando
  URL absoluta o HOST entra na conta, e host tem ponto — MEDIDO,
  `https://api.louvorja.com.br/file/imagens/123` devolvia **`br/file/imagens/123`**
  como "extensão". Ela vira CAMINHO no OPFS (`splitPath` quebra por `/`): o
  arquivo se espalha por diretórios inventados, e a soma de peso da pasta — que
  lê só o primeiro nível — deixa de contá-lo, sem erro em lugar nenhum. Recorta-se
  o ÚLTIMO SEGMENTO, e o resultado é **VALIDADO**, não só recortado (um ponto no
  meio do nome não é extensão). **E a asserção mede o CAMINHO GRAVADO, nunca a
  função:** chamá-la direto prova que ela existe, não que alguém a usa — medido,
  passa com o consumidor revertido.
- **UM CONSERTO QUE SÓ VALE NO MOMENTO DO DOWNLOAD NÃO ALCANÇA A BIBLIOTECA QUE
  JÁ EXISTE — E ELA É A QUE O OPERADOR USA** (v1.9.15). Os slides de letra
  guardam `imageOpfsPath` resolvido na hora do download, e `ensureSongVariant`
  devolve cedo para todo registro que já tenha `lyrics`: a faixa baixada num dia
  em que as imagens falhavam fica sem fundo **para sempre**, e re-sincronizar não
  reconstrói nada — a régua diz que ela está completa, e está, porque o áudio
  chegou. A única saída seria excluir a coleção e rebaixar o hinário. **Todo lote
  que conserta um campo DERIVADO no download traz o backfill junto** — é a mesma
  lição do preenchimento de `hymnAlbum` (v5.220), noutro campo. O backfill
  (`syncImagensColecao`) reabre **só** a letra (`refazerLetra`), **nunca baixa
  áudio** (variante que nunca desceu volta intacta: uma rotina rotulada *"Fundos
  da letra"* não puxa megabytes), **pula o que o mesmo toque acabou de tentar**
  (senão cada faixa é buscada duas vezes e o censo conta duas falhas por uma
  tentativa) e **conta pelo DISCO, não pelo retorno** — aquele responde pelo
  ÁUDIO e diria `true` sobre uma faixa que continua sem fundo. O par disso é
  **"a origem não publica imagem" como ESTADO** (`semImagem`, a regra `semFonte`
  da v5.134 aplicada ao fundo), que se APAGA quando a origem passa a ter.
- **UM CONSERTO CUJA ÚNICA PORTA É UM BOTÃO TEM DE CONFERIR QUE O BOTÃO EXISTE
  NO ESTADO EM QUE O DEFEITO MORA** (v1.10.6). A porta do backfill era o toque em
  sincronizar, e o botão de baixar só é desenhado com a coleção INCOMPLETA — o
  defeito do fundo mora na COMPLETA. O operador respondeu por extenso: *"Não há
  um botão de sincronizar as coleções"*. Hoje ele corre SOZINHO
  (`syncFundosAcervo`, no fio das letras e depois delas: as duas pedem
  `music_{id}` ao mesmo host), e o que torna isso possível é o que a v1.9.15 já
  nomeava — **um veredito POR MÚSICA gravado com data** (`fundos:<coll>`, por
  MESCLA): `tem` vale sempre enquanto os IDS dos arquivos forem os mesmos, a
  ausência vale seis dias, e **só se grava veredito quando o metadado chegou**
  (`metaOk`, um objeto POR FAIXA; sem rede a pergunta nem foi feita), **quando
  a FOTO respondeu** (a que o `fetch` nem trouxe de volta marca
  `fotoSemResposta` e não vira ausência: um 404 é a fonte respondendo, a rede
  caindo não é — v1.10.7) **e quando o registro foi VISTO** (`estadoDoFundo` tem três desfechos: `'?'` — registro
  sem `lyrics`, leitura que lançou — nunca vira `tem: true`, que seria
  permanente). **NÃO HÁ TETO POR PASSADA** (v1.10.7, revogando os 60 da
  v1.10.6 a pedido do operador: *"se ele achar necessário, ele verifica e
  atualiza toda a biblioteca baixada"*): o que limita é o que NÃO é trabalho
  necessário — o veredito (o que já respondeu não é reperguntado), o prazo da
  ausência, e o DISJUNTOR da fonte muda (`FUNDO_FONTE_MUDA`: doze faixas sem
  resposta — do banco OU do servidor de fotos — ou RECUSADAS pela fonte, e
  nenhuma com resposta, a passada para e o Registro diz qual dos dois). **Um
  404/410 no METADADO é resposta sobre a FAIXA**, não mudez da fonte: ganha a
  ausência de seis dias (`metaStatus`) — contado como mudez, ele abria o
  disjuntor nas MESMAS faixas a cada passada e o resto do acervo nunca era
  refeito. Os outros status (401, 403, 429, 5xx) são a fonte inteira
  recusando: alimentam o disjuntor, sem veredito, e a frase diz *"recusou"*. Piso de 30 min entre passadas — **a passada que cede a vez
  não arma o piso, e a CORTADA o devolve** (o que ela aprendeu já está no
  disco). **E ELA SE RELIGA SOZINHA COM O APP À VISTA** (`religarFundos`, a cada
  `FUNDO_RELIGA_MS`, v1.10.7): religada só pela abertura e pelo
  `visibilitychange`, uma música tocando na abertura a calava enquanto o
  operador continuasse no app — MEDIDO, a cena saiu e um minuto de app parado e
  à vista não produziu um pedido, e *"durante meus testes"* é exatamente isso.
  Minimizado o tique não parte. Ela só corre num **Wi-Fi CONFIRMADO** (a regra
  do episódio da semana) e cede também a um download PEDIDO (`bgWorkPedido`);
  o impedimento sai no Registro e na Verificação pela MESMA função da porta
  (`fundosImpedimento`). As letras e os fundos cedem uma à outra por bandeira
  (`lyricSyncRunning`, `fundosPassadaRodando`): o encadeamento na abertura só
  serializa a primeira chamada. Só a passada automática LÊ o veredito; o toque
  à mão o ignora e o grava.
- **A PORTA DE UM BLOCO DO REGISTRO PERGUNTA PELO QUE ELE DESCREVE, NUNCA POR UM
  CONTADOR DE UM DOS CAMINHOS QUE ELE COBRE** (v1.9.16). O bloco "Download do
  acervo" abria por `if (!c.tentadas) return ''`, e `tentadas` conta só
  VARIANTES DE ÁUDIO — com o áudio já no disco, o backfill do fundo roda,
  `ensureSongVariant` resolve pelo ramo do registro existente sem buscar arquivo
  nenhum, e **o bloco inteiro sumia do Registro com mil capas tendo falhado**.
  Era o caminho do hinário completo, isto é, o único em que aquele bloco
  importa. **Um diagnóstico que some justamente no caso que ele existe para
  explicar é pior que não existir:** quem copia o Registro conclui que não há
  nada a ver ali. Caminho novo que alimente um bloco entra na PORTA dele no
  mesmo lote. **E todo contador de falha carrega o DENOMINADOR**
  (`capasPedidas` × `capasPerdidas`): *zero perdidas* lê-se como "está tudo
  bem" tanto onde as mil chegaram quanto onde **nenhuma foi pedida**, e as duas
  imprimiam as mesmas linhas.
- **UM BLOCO DO REGISTRO NÃO PODE SE CONTRADIZER NA PRÓPRIA ALTURA** (v1.9.15).
  O fecho *"nenhuma falha de download nesta sessão"* saía quatro linhas abaixo de
  `1028× a imagem de fundo não veio`, porque a soma que o decide ignorava duas
  colunas. As CONTAS ficam separadas (uma capa perdida custa outra coisa que um
  áudio perdido); o que soma é a pergunta *"houve alguma?"*. **E a asserção que
  mede isso zera o censo como premissa declarada** — ele acumula pela sessão
  inteira, e contra um censo sujo ela passa com e sem o conserto.
- **UMA FALHA DE REDE DA FONTE NÃO É A REDE DE QUEM OPERA** (v1.9.14). O toque
  individual dizia *"sem internet para baixar"* sobre um HTTP 404 — texto FIXO
  de quando a rede era a única falha imaginável naquele ponto. **Um diagnóstico
  que acusa a coisa errada manda o operador consertar o que não está quebrado**,
  e ele volta dizendo que conferiu. A frase sai do CENSO (`motivoDoCartao`), com
  o NÚMERO junto, **e o ramo "sem internet" FICA** para onde ele é verdade:
  quando o metadado não vem, nenhum arquivo chega a ser pedido e o censo não se
  move. **Vale para toda afirmação de AUSÊNCIA:** *"esta música não tem letra"*
  é sobre a MÚSICA, e a letra vem no mesmo metadado que o áudio — só se afirma
  a ausência quando a busca chegou ao FIM.
- **E A FRASE FINAL NOMEIA A CAUSA, nunca "não deu"** — a mesma regra dos cinco
  motivos da cifra, e pelo mesmo argumento: cada causa pede uma AÇÃO diferente de
  quem lê. No download do acervo são TRÊS (`sem rede` · `recusada(s) pela fonte`
  · `sem espaço no aparelho`), e *"N sem rede"* diante de um disco cheio manda
  esperar um Wi-Fi que não resolve nada. **Misturadas, a frase não escolhe:**
  eleger a maior esconde a outra numa linha de três palavras — quem as separa é
  o Registro, que tem espaço e traz as contagens. E o texto de FALHA fica à vista
  mais tempo que o de sucesso (12 s contra 4): o de sucesso não pede nada de
  ninguém; o de falha é a única coisa na tela que explica o botão que continua ali.
- **DUAS RÉGUAS PARA A MESMA PERGUNTA DIVERGEM NOS DOIS SENTIDOS, e os dois
  sentidos aparecem na Biblioteca.** `songVariantsNeeded` (o que BAIXAR) pergunta
  ao IndexedDB; `levantarColecao` (se o botão SOME) pergunta ao campo
  `fileIdFull` do índice. Um id que não resolve mais faz a primeira dizer
  *pendente* e a segunda dizer *feita* — **o botão some sobre uma faixa que não
  toca**, que é o oposto do relato da v1.9.13 e igualmente ruim. Quem as mantém
  de acordo é o `ensureSongVariant`, que APAGA do índice o id sem registro. E o
  cabeçalho de um grupo responde pela MESMA função do botão (`grupoCompleto`),
  nunca por uma contagem própria de álbuns que falharam: com metade das faixas
  no disco o álbum devolve `ok:true` e o cabeçalho escrevia *"Completo"* com o
  botão de baixar na linha de baixo.
- **Kotlin devolve JSON; quem monta a FRASE é o `controle.js`.** É a invariante 5,
  e no espelho é o que mantém a sanitização do texto vindo da rede num ponto só.
  Um arquivo Kotlin que formata parágrafos é UI escrita do lado errado.
  Corolário: **toda linha do bloco é opcional** — o que o shell não souber
  responder não aparece, nunca "undefined" num log que vai ser repassado.
- **DESLIGAR DIZ POR QUÊ.** `desmontarEspelho(motivo)` exige a frase, e os
  três chamadores a escrevem (o operador, o app fechado, o serviço encerrado
  pelo Android). Ele era mudo, e o Registro saía com a última
  linha em *"cessao da biblioteca ligada"* sobre um estado *"servidor:
  desligado"* — as causas pedem ações OPOSTAS e nenhuma era dizível a
  distância. Caminho novo que derrube um recurso de rede nasce com a frase.
- **O diagnóstico é UM só, e mora no "Registro" de Configurações.** Diagnóstico
  novo entra como mais um BLOCO ali, nunca como faixa nova em outro canto.
  **NÃO HÁ VISOR:** o `<pre>` saiu na v5.207, e desde então o Registro existe só
  para ser COPIADO e lido num computador. Isso muda o que é caro: **comprimento
  não custa tela nenhuma — o que custa é ENTERRAR**. Daí a linha do tempo ter
  parado de truncar (ela descartava até 84 das 100 linhas que já estavam na mão,
  incluindo as 60 que o `diag-ask` foi buscar no telão) e o que encurta ser o
  colapso da repetição CONSECUTIVA (`visibilidade ×7`), que não apaga nada.
  **E daí a ORDEM importar:** a linha do tempo vem logo depois do cabeçalho e
  ANTES de todo bloco de verificação por recurso — ela era o último dos oito, e
  num Registro real começava na linha ~150. Bloco novo entra DEPOIS dela.
  **E ela é MONTADA NA HORA DE DESENHAR** (v1.2.7), nunca guardada pronta: o anel
  do celular continua crescendo depois do último `diag-dump`, e continua
  crescendo mesmo SEM TELÃO — caso em que o `diag-ask` nem chega a sair.
  Montá-la no `juntarDiag` congelava a lista no instante da última resposta do
  telão, e ela seguia parecendo completa.
- **UM NÚMERO RESPONDE "COM QUE FREQUÊNCIA?"; UMA LINHA RESPONDE "DA ÚLTIMA
  VEZ?"** (v1.4.13). São perguntas diferentes, e um diagnóstico que só guarda a
  última ocorrência não alcança uma falha INTERMITENTE — MEDIDO: três Registros
  da mesma semana deram três respostas sobre a extração do YouTube, e a leitura
  que saiu delas ("é sempre") foi uma generalização de duas amostras que a
  terceira derrubou. Onde o desfecho pode variar entre uma vez e outra, o bloco
  leva CONTADOR DE SESSÃO ao lado da linha: o `ytCenso` é o de hoje, e ele conta
  a QUALIDADE LIMITADA (quantas vezes e a menor altura que foi ao ar) — o
  contador de pedidos saiu com a transmissão direta, na v1.8.82. (O censo de travamentos da transmissão direta saiu com
  ela na v1.8.82.) **Contador, não log:** guardar QUAIS vídeos responderia mais
  e custaria tamanho, privacidade do que se copia e uma segunda fonte de
  verdade. E **só sai depois de acontecer** — uma linha de zeros é mais uma para
  ler em toda cópia.
- **O REGISTRO É SOBRE O CULTO, não sobre o catálogo** (v1.1.19). Ele responde a
  quatro perguntas, e é por elas que se decide o que entra: *o que eu toquei
  antes disso?* (ações do operador) · *quando a conexão mudou?* (TV e telas, em
  TRANSIÇÕES — o cabeçalho já diz o estado AGORA) · *o que quebrou?*
  (estabilidade) · *quem eu sou?* (o cabeçalho). Uma varredura de catálogo
  responde a uma quinta pergunta, de quem AJUSTA A REGRA meses depois — ela cabe,
  resumida, mas não pode empurrar as outras quatro para baixo.
- **Um bloco guarda o VEREDITO, nunca uma segunda opinião.** O texto sai da MESMA
  função que decidiu (`AVSerie.avaliarPlaylist` devolve `{ mes, motivo }`, e
  `mesDaPlaylist` é a metade dela que a regra usa). Uma segunda escrita das
  mesmas perguntas envelhece à parte no primeiro ajuste, e o que sai é **um log
  que discorda do aparelho** — o pior artefato que este projeto sabe produzir,
  porque é lido A DISTÂNCIA por quem não tem como conferir. **E registra o dado
  CRU:** um rótulo já formado prova que a regra rodou; só a entrada dela diz por
  que ela produziu aquilo.
- **O REGISTRO TEM UMA PORTA SÓ: A VERIFICAÇÃO** (v1.12.29; seção de
  Configurações desde a v1.12.48). O
  botão do rodapé de Configurações (`#diagSave`) saiu a pedido do operador —
  *"agora vamos usar expressamente o método via verificador"* —, e o
  `#testeSalvar` — desde a v1.12.44 "Compartilhar registro", visível só com a
  verificação terminada, e entregando o arquivo ao seletor de compartilhamento
  (`compartilharArquivoTexto`) — leva o `diagTexto`,
  com o nome de `nomeDoRegistro` e o resultado da verificação lá dentro como um
  bloco. A regra da v1.10.3 que sobrevive é a do ARQUIVO ÚNICO: **porta nova é
  porta para o mesmo arquivo**, nunca um recorte próprio. Quem salva **monta o
  texto antes** (`await renderDiag()`) e **recusa o vazio** — `diagTexto` nasce
  string vazia e só é escrito ao montar, e um arquivo de zero byte que o
  operador manda achando que mandou o Registro é o pior desfecho que este botão
  sabe produzir. **E o carimbo da verificação diz as DUAS horas** quando a
  completa somou a linha dela (`em` da leve, `emCompleta` do download).
- **Todo campo de LOG nasce com uma PORTA DE SAÍDA** — sem ela a alternativa é
  transcrever números à mão ou fotografar a tela. **Qual porta depende do
  TAMANHO**, e é o que a v1.4.44 separou: um valor CURTO que se digita noutro
  aparelho (o endereço da transmissão) sai pela área de transferência
  (`.log-copy` + `copiarTexto`); o REGISTRO sai por ARQUIVO (`salvarTexto`), e o
  copiar dele saiu a pedido do operador — *"o registro está cada vez maior e
  mais completo e acaba por ele ficar longo de mais para compartilhar via chat
  de texto"*. A área de transferência é o caminho que **corta o texto no meio
  sem avisar**, e foi esse relato que criou o salvar em arquivo na v1.2.16.
  **E o arquivo é aberto com `"wt"`, nunca `"w"`** (v1.8.5): sem o `t` o provedor
  de documentos escreve por cima do começo e deixa a CAUDA do arquivo antigo —
  e o que sobra é conteúdo PLAUSÍVEL, blocos inteiros descrevendo um estado que
  já não existe. Num artefato lido A DISTÂNCIA por quem não confere nada, isso é
  o log que discorda do aparelho.
