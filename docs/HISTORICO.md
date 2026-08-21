# Histórico de versões — apêndice

**Não é documentação normativa.** O que vale hoje está no `CLAUDE.md` e em
`docs/ARQUITETURA-WEB.md`. Aqui ficam as notas de cada lote, **verbatim**, da
mais nova para a mais antiga.

**Use por busca, nunca por leitura integral:**

| pergunta | comando |
|---|---|
| o que a vX fez? | `grep -n "^## v5.240" docs/HISTORICO.md` |
| que lote mexeu em `foo`? | `grep -n "foo" docs/HISTORICO.md` |
| ler só um bloco | `sed -n "<ini>,<fim>p" docs/HISTORICO.md` |

**Quando abrir:** para responder *"por que isto é assim?"*, *"isto já foi
tentado?"*, *"esta decisão foi revogada?"*. **Nunca** para saber o que o código
faz hoje — para isso leia o código.

**Ao publicar uma versão:** o bloco novo entra logo abaixo do índice e ganha uma
linha no índice. Nada aqui é reescrito depois — uma decisão revogada é anotada
na nota que a revoga, não apagada da que a criou.

---

## Índice

- **v1.0.6** — A ATUALIZAÇÃO DIZ O QUE VEM NELA: uma linha do tempo das mudanças entre a versão e a consequência, lida do `notas.json` do PRÓPRIO bundle baixado — não do manifesto, que é buscado 240 vezes por hora para carregar texto que importa uma vez por semana. Mais o "Tocar neste celular" virando caminho SÓ DE IDA (a v1.0.5 persistia a escolha, e persistir era o defeito que o botão de volta vinha remendar) e a cadeia de conectar TV ganhando a candidata que faltava em quem não é Samsung. `SHELL_VERSION` 47. EXIGE RELEASE
- **v1.0.5** — O MODO FÁCIL DEIXA DE EXIGIR UMA TELA: o bloqueio supunha que quem abre aquele modo sempre quer projetar, e ensaiar o louvor ou ouvir o playback a caminho da igreja não quer. O "Tocar neste celular" da folha de conexão desbloqueia o modo e liga o som daqui — e a escolha SE DESFAZ SOZINHA quando uma tela entra, senão o ensaio de quarta-feira chegaria ao culto de sábado. OTA PURO
- **v1.0.4** — O SELO DE CAMADAS VOLTA A SER UM ÍCONE SOLTO, como os dois vizinhos da preview: o que o separa deles é a COR, e ela vira `--stage-alert` (a paleta recusa o scarlett oficial como traço). O desenho ganha o ✕ — a pilha diz o estado, o ✕ diz o que o toque faz. Conferido nos DOIS modos. OTA PURO
- **v1.0.3** — O SELO DE CAMADAS: com um louvor tocando e um texto por cima, a camada de cima não tinha saída fora da linha que a pôs lá — o Parar levava o louvor junto. Mais o endereço da transmissão que se COPIA, o fundo dos slides que não chegava à tela da rede sem o canal de mídia (guarda larga demais), e o download de um episódio de série que não acendia NADA na lista. OTA PURO
- **v1.0.2** — O BOTÃO DEIXA DE DIZER "ESPELHAR": o que vai para a TV é o telão, não a tela do celular, e o rótulo anunciava o oposto do que o app entrega. A página vira CLARA e só clara, ganha um card de Slides e um de "recebe de tudo", e o guia cai para três passos com o Play Protect como VERIFICAÇÃO, não como susto. O respiro entre a faixa da marca e o primeiro título media ZERO — `.env` vencia o `main` por especificidade. OTA PURO
- **v1.0.1** — O ÍCONE FICA DE PÉ e as COLEÇÕES FIXAS SOBEM PARA A RAIZ (um toque a menos até a lista de faixas). Sai o agrupamento "Arquivos oficiais"/"Hinários"; o card ganha tom PRÓPRIO, porque ler o pai o deixava a 1,26:1 da gaveta na raiz. O vão dos Favoritos passa a contar TODO vizinho. A página de acesso é reescrita para quem não é técnico. E a página servia a Release ANTERIOR: `release: published` nunca dispara para Release criada pelo GITHUB_TOKEN — o `pages.yml` passa a encadear por `workflow_run`. EXIGE RELEASE
- **v1.0** — O SHELL ATUAL VIRA O PISO: `minShell` 2 → 46, saem as 37 guardas de `__SHELL_VERSION__` do lado web e a compatibilidade com bundle antigo do Kotlin. A ponte ENCOLHE (`espelhoLigar()` perde o `modo`, `espelhoAprovar` vira `espelhoDerrubar`). A versão reinicia em **1.0** nos dois canais. EXIGE RELEASE
- **v5.317** — A LIMPEZA QUE O LEVANTAMENTO DE REGRAS AUTORIZOU: sai o `TITULO_NENHUM` (um ramo que nada alcança, no arquivo que recusa ramos que nada alcançam) e a §11 do arquivo do espelho, que prometia um código de três dígitos removido há 128 versões. O que mexe na PONTE fica — e agora está escrito por quê. OTA PURO
- **v5.316** — O PORTÃO FECHA: `continue-on-error` sai dos oráculos de Chromium, e as CINCO classes de oráculo-que-media-o-runner vão à raiz — inclusive DOIS defeitos do app que apareciam como teste instável, um deles na gravação da intenção do OTA. Nasce `AVDB.updateState`. OTA PURO
- **v5.315** — OS 21 ACHADOS CONFIRMADOS, CORRIGIDOS — e os dois que a revisão adversarial pegou em cima da correção (superfície da ponte sem degrau; o manifesto do OTA podendo regredir). `SHELL_VERSION` 45. EXIGE RELEASE
- **v5.314** — A AUDITORIA PROFUNDA: as lápides que a faxina deixou, a ROTAÇÃO de comentários que a prova antiga não via, e os dois oráculos que mediam a si mesmos. Nasce `docs/shell/`. OTA PURO
- **v5.313** — "PLAYBACK" VIRA "FUNDO MUSICAL", e o Cronograma passa a receber UM PACOTE no lugar de N linhas. OTA PURO
- **v5.312** — A IMAGEM ENTRA POR CIMA DO LOUVOR SEM CALÁ-LO: o motor tem UM slot, e quem sobrevive a ele é a Camada de Texto. OTA PURO
- **v5.311** — PLAYBACK SORTEADO É SOM DE FUNDO: toca sem nada no telão, pela cortina que já existia. OTA PURO
- **v5.310** — O TÍTULO PAROU DE ANDAR PARA O LADO E CONTINUOU DESCENDO: a v5.309 reservou as colunas da faixa e não a linha, e o oráculo mediu só o eixo que ela corrigiu. OTA PURO
- **v5.309** — QUATRO AJUSTES PEDIDOS: o título parava de pular, a versão foi para o fim da referência, o par de confirmar divide a faixa ao meio e a fila ganhou um LIMPAR. OTA PURO
- **v5.308** — A PALAVRA TEMA É MOMENTÂNEA, e sem ela o sorteio DIZ que pega o acervo inteiro. OTA PURO
- **v5.307** — O CONFIRMAR DOS FAVORITOS PASSA PARA A DIREITA, e o lado do irmão vira decisão de quem o fornece. OTA PURO
- **v5.306** — DOIS DESFECHOS PARA A FILA SORTEADA, e a conta passa a falar de MÚSICA em vez de varredura. OTA PURO
- **v5.305** — O BOTÃO DA PLAYLIST ABRE A BARRA, e o ícone dele estava a 2,06:1 sobre o campo branco. OTA PURO
- **v5.304** — O BOTÃO DA PLAYLIST AUTOMÁTICA ESTAVA INVISÍVEL — o glifo não existe no subset da fonte, e agora isso tem oráculo. OTA PURO
- **v5.303** — A PLAYLIST AUTOMÁTICA: sortear por tema, uma só ou uma fila — e a regra é um arquivo PURO com dois oráculos. OTA PURO
- **v5.302** — A ORDEM DA FILEIRA, DITADA — e o botão da playlist deixa de ser um recibo para virar um ESTADO. OTA PURO
- **v5.301** — A CONFIRMAÇÃO DE EXCLUIR SAI DO POPUP E VOLTA PARA A LINHA — e a fileira da gaveta, medida a 360px, já estava cheia. OTA PURO
- **v5.298** (APK v2.3) — A REVISÃO PROFUNDA — uma seção inteira do doc de arquitetura descrevia um player apagado, e o espelhoEstado publicava seis medições que n…
- **v5.297** — NÃO HAVIA COR DE TEXTO QUE RESOLVESSE — o defeito era a SUPERFÍCIE, e a Biblioteca inteira estava em MAIÚSCULAS. OTA PURO
- **v5.296** — O NOME DA FAIXA SAÍA NA COR DE UM CABEÇALHO — e no tema claro isso reprovava AA. OTA PURO
- **v5.295** — OS COMENTÁRIOS QUE DESCREVIAM A GAVETA COMO SE ELA EXISTISSE. OTA PURO
- **v5.294** (APK v2.2) — A ABA folders SAI POR INTEIRO, e a fila de IO da ponte vira TRÊS. METADE OTA, METADE APK
- **v5.293** — A REVISÃO PROFUNDA — doze defeitos, e dois deles tinham derrubado um recurso inteiro em silêncio. METADE OTA, METADE APK
- **v5.292** — A SEÇÃO DE FAVORITOS FICAVA PARA TRÁS DO BANCO. OTA PURO
- **v5.291** — UMA .lib-item DENTRO DE OUTRA — todo seletor DESCENDENTE vazou. OTA PURO
- **v5.290** — A PASTA DO APARELHO ABRE COMO UM ÁLBUM — e a gaveta de tela cheia fica sem porta. OTA PURO
- **v5.289** — A GUARDA PERGUNTAVA À ÁRVORE DE AGORA, e o handler já a tinha desmontado. OTA PURO
- **v5.288** — O FEEDBACK DE TOQUE TIRAVA O ALVO DE BAIXO DO DEDO — e mais três. OTA PURO
- **v5.287** — A GAVETA PARA DE SE MESCLAR COM A LISTA, e a linha de favorito ganha o mesmo sistema da Biblioteca. OTA PURO
- **v5.286** — A GAVETA DE OPÇÕES, EM SETE PONTOS — e dois deles são defeitos que a v5.285 introduziu. OTA PURO
- **v5.285** — O ARRASTO SAI DO APP, os botões saem da faixa, e as opções descem para o corpo da linha. OTA PURO
- **v5.284** — A PASTA SINCRONIZADA CONTINUA SENDO UM ÁLBUM — e a estrutura que faltava aparece. OTA PURO
- **v5.283** — UM FAVORITO É UM ITEM, NÃO UM ÁLBUM — a linha passa a pintar a cor da faixa dentro do álbum. OTA PURO
- **v5.282** — OS FAVORITOS VOLTAM A SER UMA SEÇÃO COMO AS OUTRAS — o tom próprio sai, o "Ver todos" sai, e o vão vira um PISO. OTA PURO
- **v5.281** — A BARRA NÃO SE MEXIA — QUEM SE MEXIA ERA A PÁGINA INTEIRA. OTA PURO
- **v5.280** — O CABEÇALHO DA BIBLIOTECA SAI, a camada para de perseguir a viewport, a lista abre no topo, e o scroll interno dos favoritos é revogado.…
- **v5.279** — O CORPO DOS FAVORITOS ROLA POR DENTRO no modo compacto. OTA PURO
- **v5.278** — A BARRA DE CIMA VOLTA A SEGUIR O QUE SE VÊ, o ícone do título sai, e o alvo dos botões da faixa passa a ser a linha inteira. OTA PURO
- **v5.277** — O VÃO DOS FAVORITOS VIRA UMA MEDIDA DE TELA, a coleção rola até o topo dela, o teclado volta a SOBREPOR, e a barra de título vira uma peç…
- **v5.276** — OS FAVORITOS SAEM DO RODÍZIO, a coleção aberta para de inchar, e o "Ver todos" passa a contar ITENS. OTA PURO
- **v5.275** — A BARRA DE BUSCA DA BIBLIOTECA VOLTA AO TOPO. OTA PURO
- **v5.274** — A SEÇÃO ABERTA CENTRAVA E ESPREMIA O QUE HAVIA DENTRO DELA — e a causa foi trocar o display de um elemento. OTA PURO
- **v5.273** — A BIBLIOTECA FICA COM UMA SEÇÃO ABERTA POR VEZ, e a dos Favoritos ocupa o vão que sobra. OTA PURO
- **v5.272** — CINCO RELATOS DA LISTA — e dois deles eram recursos que nunca chegaram a existir. OTA PURO
- **v5.271** — TRÊS AJUSTES DA LISTA — o Parar toma o lugar da capa, o ⋮ para de mexer o cartão, e o LINK do YouTube entra no ar como qualquer outro ite…
- **v5.270** — A BARRA DA BUSCA ESCURECE NO TEMA CLARO, e o ✕ vira o irmão do campo. OTA PURO
- **v5.269** — TIRAR A BORDA NÃO É REMOVER A BORDA — o <button> já vem com uma do navegador. OTA PURO
- **v5.268** — O CAMPO DE BUSCA FICA BRANCO NOS DOIS TEMAS. OTA PURO
- **v5.267** — O CONTORNO SAI DO APP INTEIRO, e a Biblioteca ganha uma escada de camadas de verdade. OTA PURO
- **v5.263** — tinha recusado a troca da folha com um argumento MEDIDO, e ele expirou junto com a paleta:
- **v5.266** — A BARRA DE BUSCA GANHA TOM E SOMBRA — agora que ela flutua, ela precisa se destacar. OTA PURO
- **v5.265** — O "~" SAI DAS CONTAGENS DE PESO. OTA PURO
- **v5.264** — A TELA VEM NUM TEMPO E O TECLADO NO SEGUINTE, e o campo de busca ganha a lupa. OTA PURO
- **v5.263** — A BIBLIOTECA VIRA UMA TELA — o slide sai por inteiro, e o verde sai dos indicadores. OTA PURO
- **v5.262** — A BIBLIOTECA SOBE DA BASE, os Favoritos ganham a seta que faltava, e a escala de títulos passa a ser uma escala. OTA PURO
- **v5.261** — A FOLHA PASSA A SER A FAIXA VISÍVEL — a barra de busca desceu na v5.258 e foi parar ATRÁS do teclado. OTA PURO
- **v5.260** — A BIBLIOTECA SEPARA OS HINÁRIOS DOS ARQUIVOS OFICIAIS. OTA PURO
- **v5.259** — O PARAR VAI PARA A CAPA, e a faixa de ações para de cortar a miniatura e de deixar o título aparecer atrás dela. OTA PURO
- **v5.258** — A LINHA FICA COM UM BOTÃO SÓ — o ⋮ — e a Biblioteca perde o "baixar tudo" e ganha a busca na BASE. OTA PURO
- **v5.259** — O CHECK DO "TOCAR AGORA" NÃO ACENDIA — e o defeito era um argumento esquecido. OTA PURO
- **v5.256** — O EPISÓDIO APARECE NA QUARTA, e a falha dentro da janela DIZ POR QUÊ. OTA PURO
- **v5.255** — O QUE AINDA NÃO SAIU SOME DA LISTA — o canal sobe o trimestre e libera um sábado por vez. OTA PURO
- **v5.254** — OS FAVORITOS VIRAM UMA LISTA SÓ — os atalhos de pasta saem, e a ordem passa a ser do operador. OTA PURO
- **v5.253** — A FOLHA DE DESTINOS VIRA UM MÉTODO ÚNICO — tudo é selecionável, e o confirmar não some. OTA PURO
- **v5.252** — O REGISTRO ACHOU O PRIMEIRO DEFEITO — e ele era MEU. OTA PURO
- **v5.251** — "ONLINE" — a qualidade que não baixa. OTA PURO
- **v5.250** — O MODO FÁCIL GANHA A ENGRENAGEM — e com ela some o último .mode-switch do app. OTA PURO
- **v5.249** — O REGISTRO PASSA A CONTAR O QUE A REGRA DAS SÉRIES ACHOU. OTA PURO
- **v5.248** — O PESO VIRA SUBTÍTULO DO CARD — e o card não cresce por isso. OTA PURO
- **v5.247** — A TROCA DE MODO VIRA UMA SÓ — o botão do cabeçalho sai. OTA PURO
- **v5.246** — A SETA VIRA A THUMBNAIL DAS RAÍZES — ícone só na folha da árvore. OTA PURO
- **v5.245** — A ATUALIZAÇÃO DEIXA DE SE PERDER NUM TOQUE FORA, e ganha um BOTÃO em Configurações. OTA PURO
- **v5.244** — A SEGUNDA SÉRIE — o Informativo Mundial das Missões vira um álbum, e ela desmente três suposições da primeira. OTA PURO
- **v5.243** — A SETA DE FECHAR O ÁLBUM VESTE A THUMB — e a coluna da direita para de se mexer. OTA PURO
- **v5.242** (APK v2.1) — O VÍDEO DO PROVAI E VEDE IA AO TELÃO EM INGLÊS, e a Bíblia passa a vir inteira sozinha. METADE APK, METADE OTA.
- **v5.241** — A BIBLIOTECA PASSA A TER UMA ESCALA DE TONS — dois tons, uma regra, os dois temas. OTA PURO
- **v5.240** — A LINHA DE UMA FAIXA DEIXA DE SER MAIS ALTA QUE O ÁLBUM QUE A CONTÉM. OTA PURO
- **v5.239** — A SEÇÃO DE FAVORITOS FICA SÓ COM A LISTA — as ações sobem para a barra, viram UM ícone, e o rodapé de disco sai. OTA PURO
- **v5.238** — OS FAVORITOS DEIXAM DE TER DUAS PORTAS — a seção não colapsa, e a gaveta vira só a tela de dentro de uma pasta. OTA PURO
- **v5.237** — A BIBLIOTECA VIRA UM ÍNDICE — as seções nascem fechadas e os FAVORITOS são a primeira delas. OTA PURO
- **v5.236** — A BIBLIOTECA PASSA A TER TIPOS — a gaveta de um vídeo deixa de prometer letra, e a fila de letras deixa de perguntar por ele. OTA PURO
- **v5.235** — A LINHA DAS OPÇÕES ENCOLHE DE VERDADE — o estado sai da segunda linha e a remoção vira só a lixeira. OTA PURO
- **v5.234** (APK v2.0) — O SISTEMA DE ATUALIZAÇÃO INTEIRO — os dois canais viram um evento, a detecção fica autoritária e a pergunta volta. EXIGE APK
- **v5.233** — O ÍNDICE DA SÉRIE FICAVA PRESO NA REGRA VELHA — a correção da v5.230 nunca chegou à lista. OTA PURO
- **v5.232** — AS OPÇÕES DO ÁLBUM VIRAM UMA LINHA — o peso sai porque já estava na barra. OTA PURO
- **v5.231** (APK v1.99) — OS BOTÕES DA NOTIFICAÇÃO PASSAM A SER DA CENA, e a transmissão deixa de sumir quando há mídia no ar. EXIGE APK.
- **v5.230** — O EPISÓDIO DE SÉRIE VIRA UM VÍDEO DO YOUTUBE, e a DATA passa a ter DUAS formas. OTA PURO
- **v5.229** — O CARD DA SÉRIE ERA CONSTRUÍDO E NUNCA DESENHADO. OTA PURO
- **v5.228** (APK v1.98) — AS SÉRIES DO YOUTUBE VIRAM ÁLBUNS DA BIBLIOTECA — e o primeiro é o "Provai e Vede 2026". EXIGE APK
- **v5.227** — O "DESLIGANDO…" VIRA O RÓTULO DO PRÓPRIO BOTÃO. OTA PURO
- **v5.226** — LIGAR A TRANSMISSÃO DEIXA DE SER UM SALTO — a folha cresce, e só então o conteúdo entra. OTA PURO
- **v5.225** — A LEITURA DA LETRA TINHA A HIERARQUIA INVERTIDA — duas estrofes mais juntas que o miolo de uma. OTA PURO
- **v5.224** — A TRANSMISSÃO VIRA O BOTÃO IRMÃO DO DE ESPELHAR — o interruptor sai. OTA PURO
- **v5.223** — O display-ready DA TELA NUNCA LEVOU __tela — e sem ele as TRÊS preferências jamais chegaram. OTA PURO
- **v5.222** — O NÚMERO DO HINO ERA AZUL — 9,75:1 e ainda assim discreto. OTA PURO
- **v5.221** — A IMAGEM DE FUNDO DA LETRA DESISTIA ANTES DE PODER CHEGAR. OTA PURO
- **v5.220** — A LINHA DO ÁLBUM NÃO CHEGAVA À BIBLIOTECA QUE JÁ EXISTE — os dois pontos de escrita estavam certos e os dois erravam o alvo. OTA PURO
- **v5.219** — O TÍTULO DO LOUVOR ERA AZUL-ESCURO SOBRE O PRETO — o palco lia tokens de TEMA. E o slide de capa virou um CARTÃO. OTA PURO
- **v5.218** — A RECARGA VOLTA PARA A ENTRADA OFICIAL, e o botão de canto sai. OTA PURO
- **v5.217** — O BOTÃO DE CAST NÃO ABRIA NADA COM UMA TELA JÁ CONECTADA — o fecho automático da folha era um NÍVEL onde a frase dizia BORDA. OTA PURO
- **v5.216** — O "LIGAR SISTEMA" VOLTAVA NA RECARGA — e ele gasta o gesto sem ativar nada. OTA PURO
- **v5.215** — SEM TELA CONECTADA, O SOM SAI DO PRÓPRIO APARELHO. OTA PURO
- **v5.214** — A ATIVAÇÃO DA TELA DA REDE JÁ ERA UNIFICADA — o que sobrava era um segundo botão pedindo o que o primeiro tinha acabado de fazer. OTA PURO
- **v5.213** — OS ORÁCULOS DE CHROMIUM VIRAM DOIS PASSOS — o painel verde escondia um teste caindo. OTA PURO
- **v5.212** (APK v1.97) — O EMBED DO YOUTUBE SAI DOS DOIS WEBVIEWS, e com ele uma ponte privilegiada exposta a terceiro. Mais duas correções de uma auditoria do re…
- **v5.211** (APK v1.96) — A CAPA ARTIFICIAL SAI — fica a COR, sólida. EXIGE APK.
- **v5.210** (APK v1.95) — A NOTIFICAÇÃO VESTE O TEMA, e o MODO RELÓGIO deixa de perguntar as horas ao aparelho errado. EXIGE APK.
- **v5.209** (APK v1.94) — AS TELAS MORRIAM DE 60 EM 60 s porque o sinal de vida era um TIMER. EXIGE APK.
- **v5.208** — O TRANSPORTE DO MODO AVANÇADO ESTAVA BRANCO NO BRANCO. OTA PURO.
- **v5.207** — O ALERTA FLUTUANTE ACABA — a resposta nasce onde o toque nasceu. OTA PURO.
- **v5.206** (APK v1.93) — O REGISTRO MENTIA — o consumidor sobreviveu ao produtor, e o valor ausente virou resposta. EXIGE APK.
- **v5.205** — A CSP BLOQUEAVA O ESTILO DA ENTRADA — o overlay existia, sem posição, DEBAIXO do wallpaper. OTA PURO. CONFIRMADO EM APARELHO:
- **v5.204** (APK v1.92) — O PAPEL tela DEIXA DE DEPENDER DA QUERY — e o teste que devia ter pego isso estava mentindo. EXIGE APK.
- **v5.203** — A CORTINA DO MODO FÁCIL VOLTA — e a v5.199 foi um diagnóstico errado, não uma mudança de gosto. OTA PURO.
- **v5.202** — A CONEXÃO DESCE PARA A ZONA DE BAIXO — o topo é da LETRA, como foi pedido. OTA PURO.
- **v5.201** — O MODO FÁCIL FICA COM A LETRA EM CIMA E O QUE SE OPERA EMBAIXO. OTA PURO.
- **v5.200** (APK v1.91) — O "RESQUÍCIO" ERA O CACHE DO WEBVIEW, e ele tem nome e endereço. EXIGE APK.
- **v5.199** — O BLOQUEIO DO MODO FÁCIL SAI — e é ele que o operador chamava de "o botão de conectar". OTA PURO.
- **v5.198** — O INTERRUPTOR DA REDE PASSA A NOMEAR O DESTINO. OTA PURO.
- **v5.197** — O BOTÃO ÚNICO DE CONECTAR SAI — e ele estava MORTO havia quatro versões. OTA PURO.
- **v5.196** — A FOLHA DE "AJUSTES AVANÇADOS" SAI INTEIRA. OTA PURO.
- **v5.195** — O PENTE NO RESTO DO APP — e a TELA PRETA que ele causou, com o oráculo que faltava. OTA PURO.
- **v5.194** — A FOLHA DE CONECTAR PERDE TRÊS QUARTOS DO TEXTO. OTA PURO.
- **v5.193** — CINCO AJUSTES DE USO, e um deles é a QUARTA correção do mesmo mecanismo. OTA PURO
- **v5.192** (APK v1.89) — A PALETA VIRA A IDENTIDADE OFICIAL DA IASD, E O APP GANHA TEMA CLARO. METADE OTA, METADE APK.
- **v5.191** — O DOWNLOAD PASSA A TER SAÍDA — e a intenção deixa de ressuscitar. OTA PURO.
- **v5.190** (APK v1.88) — UM CARTÃO SÓ NA GAVETA — a transmissão passa a viajar no serviço da sessão de mídia. EXIGE APK, e é Kotlin puro.
- **v5.189** (APK v1.87) — A SEGUNDA RODADA EM APARELHO — a porta abre, o YouTube volta a transmitir e a preview emudece. EXIGE APK.
- **v5.188** — A PRIMEIRA RODADA EM APARELHO DO TELÃO POR COMANDOS — três relatos, uma identidade. OTA PURO
- **v5.187** (APK v1.86) — O TELÃO POR COMANDOS SUBSTITUI O ESPELHO DE PIXELS POR INTEIRO. EXIGE APK — e a primeira ligada em rede de verdade é numa terça-feira.
- **v5.186** (APK v1.85) — A ENTRADA VIRA UM CÓDIGO DE TRÊS DÍGITOS, e o av.local sai. EXIGE APK — é a maior remoção de superfície da história do projeto.
- **v5.185** (APK v1.84) — O EIXO DO SOM ERA UM LAÇO ABERTO — "o som fica para trás, a imagem continua, a tela fica sem áudio". METADE APK.
- **v5.184** — A FOLHA DE CONECTAR LIGAVA O SERVIDOR PARA PODER MOSTRAR O ESTADO — e isso é uma falha de FORMA, não de código. OTA PURO.
- **v5.183** (APK v1.73) — AS TRÊS DE REDE — a metade que faltava, e a mais arriscada. EXIGE APK, e exige ser ligada NUMA TERÇA-FEIRA.
- **v5.182** (APK v1.72) — A ESTABILIDADE DO ESPELHO, SEGUNDA METADE — e esta EXIGE INSTALAR O APK.
- **v5.181** — A ESTABILIDADE DO ESPELHO, PRIMEIRA METADE (a que chega por OTA).
- **v5.180** — O COMANDO ATRASADO LEVAVA O ESTADO DE AGORA
- **v5.179** — O PARAR EXIGIA DOIS TOQUES, e a culpa era do ECO — não das camadas.
- **v5.178** — O STOP VIRA POR CAMADA, e agora as duas portas existem.
- **v5.177** — A PREVIEW ESCONDIDA ESTAVA ROUBANDO O SOM DO ESPELHO.
- **v5.176** — O CARTÃO DO ESPELHO SAIU DA BARRA DE STATUS, e quem passou a avisar é o ÍCONE.
- **v5.175** — A SEÇÃO DE CONEXÃO FORA DO PADRÃO — e o token que não existia.
- **v5.174** — "ATUAL" E "NO AR" ERAM A MESMA MARCA, e não são a mesma coisa.
- **v5.173** — A PREVIEW ERA A RÉGUA, e a régua era a coisa que se deformava.
- **v5.172** — A PORTA ABERTA NUNCA ABRIU — e mais sete.
- **v5.171** — a folha de conectar vira UM DEGRAU.
- **v5.170** — A PORTA NASCE ABERTA.
- **v5.168** — DESFAZ metade da v5.157, e a lição é sobre PISOS.
- **v5.167** — o APK se atualiza DE DENTRO DO APP
- **v5.166** — a pasta era persistida DEPOIS do laço, e por isso uma sincronização interrompida "não salvava progresso nenhum".
- **v5.165** — TOCAR DE NOVO NO QUE ESTÁ NO AR = TIRAR DO AR.
- **v5.164** — dá um NOME ao espelho: av.local. REVOGADA na v5.185
- **v5.163** — acha por que o SOM MORRE, e a causa estava no descarte do servidor.
- **v5.162** — ataca a SENSAÇÃO, não o número — e a leitura do operador estava certa.
- **v5.161** — tira o TRANSITÓRIO DE PARTIDA da conta, e ele estava impedindo a convergência da v5.160.
- **v5.160** — é OTA PURO e ataca o ATRASO, que virou a queixa depois que o travamento saiu.
- **v5.159** — fechou o que a v5.158 deixou de pé, e o achado é do MESMO tipo: KEY_I_FRAME_INTERVAL não é segundos de parede, é CONTAGEM DE QUADROS.
- **v5.158** — achou a causa do travamento, e ela era a PODA.
- **v5.157** — mede o travamento, e a metade que MEDE é APK.
- **v5.154** — é METADE OTA e METADE APK, e a divisão importa para quem for testar em aparelho.
- **v5.155** — é OTA PURO
- **v5.156** — é METADE OTA e METADE APK, de novo.

---

## v1.0.6 — a atualização diz o que vem nela

Pedido do operador, em duas partes: *"organize o sistema de update dentro do
app, para mostrar os dados do que está disponível na atualização … apenas uma
timeline descritiva das mudanças"*, com *"correções de bugs … sempre como
'Corrigido um bug na seção de …'"*; e *"verifique se o sistema de conexão para
TV está funcionando corretamente em aparelhos que não sejam Samsung"*.

### A LINHA DO TEMPO, e onde ela NÃO mora

A pergunta da atualização sabia dizer a versão e a consequência, e nunca o que
mudava. Agora são TRÊS blocos, nesta ordem porque é a ordem da leitura:

| bloco | responde |
|---|---|
| mensagem | o que É — `Base v1.0.6.` · `Base v1.0.6 e app v1.0.2 (4,2 MB).` |
| lista | o que MUDA |
| rodapé | o que ACONTECE ao tocar — a única que a lista nunca responde, e a razão de haver pergunta |

**As notas viajam DENTRO do bundle** (`assets/web/notas.json`), lidas pelo shell
do diretório do bundle BAIXADO (`WebUpdater.notasPendentes`) e entregues já
filtradas para o que aquele aparelho ainda não tem. **Não pelo manifesto**, e as
três razões são independentes:

- **Custo zero na ronda.** O manifesto é buscado a cada 15 s enquanto o processo
  viver — 240 vezes por hora. Pendurar nele alguns kB que importam uma vez por
  semana é pagá-los 240 vezes por hora.
- **Elas não PODEM divergir do que descrevem.** O arquivo entra no zip com o
  código, e é lido do diretório daquele bundle. Não existe o estado "o manifesto
  anuncia mudanças que o bundle baixado não tem".
- **Nada de novo no caminho de rede** — logo, nada de novo que possa falhar
  nele.

O preço está dito no KDoc: **um lote SÓ de APK não tem linha do tempo**, porque
não há bundle novo de onde lê-la. Os lotes deste projeto são quase todos "só
web" ou "web + APK juntos" (é para isso que o `shellTag` existe), e o desfecho do
caso raro é a pergunta de sempre, sem a lista — nunca uma lista errada.

### O AVISO DO QUE SOBROU NÃO PODE MORAR NA LISTA

O teto de linhas é o que mantém isto uma linha do tempo em vez de um texto: seis
(`OTA_MAX_LINHAS`), e o que sobra vira "E mais N mudanças."

Ele morou DENTRO da lista, e o desenho o desmentiu na primeira medição: a lista
tem rolagem, e o último item é o primeiro a ser cortado — o aviso ficava
escondido atrás da rolagem, e o que sobrava era **uma lista truncada afirmando
ser tudo**. Foi para o rodapé, que não rola.

E o teto de ALTURA mudou de dono junto. Com `max-height: 40vh` na lista, um
aparelho de 360×640 a cortava enquanto o cartão ocupava 477px de 640: havia
espaço de sobra e ela se cortava mesmo assim, porque `40vh` não sabe quanto os
irmãos dela estão gastando. O teto foi para o `.dialog-card` (`88vh`) e a lista
ficou com o que sobra — ela só rola quando de fato não há para onde crescer.

Os dois têm oráculo, e os dois foram provados por NEGATIVO: com o teto desligado
e com o aviso de volta na lista, as asserções reprovam.

### CONECTAR UMA TV FORA DA SAMSUNG: uma assimetria de contrato

A cadeia é honesta e degrada bem — `<queries>` completo, filtro de GMS que
impede terminar no Google Cast, e `describeCastTarget()` dizendo o componente
real para diagnóstico a distância. O que a leitura achou foi outra coisa:

**`CAST_SETTINGS` e `DISPLAY_SETTINGS` são constantes PÚBLICAS do `Settings`;
`WIFI_DISPLAY_SETTINGS` é um literal** — ação interna do AOSP, que contrato
nenhum obriga o fabricante a declarar. E num aparelho que não fosse Samsung ela
era a **única** candidata da cadeia filtrada: faltando, `pickCastIntent` devolvia
null e o toque caía no laço CEGO, cuja primeira parada é `DISPLAY_SETTINGS` —
brilho e tempo de tela, que não é seletor de nada.

Aquela ordem foi escolhida contra uma medição EM SAMSUNG, onde o Google Cast
reivindica `CAST_SETTINGS`. Noutras marcas quem a reivindica costuma ser o
próprio app de Configurações, e ali ela É o seletor de tela sem fio. Ela entrou
no FIM da cadeia filtrada, onde o filtro de GMS que já existe responde a pergunta
com o aparelho em vez de com um palpite: dono é o Play Services, o filtro pula e
nada muda (o caso Samsung, medido); dono é o fabricante, abre a tela certa. No
fim da lista de propósito — na Samsung o Smart View continua vindo antes.

**E a KDoc de `openCastPicker` estava PENDURADA:** ela morava entre
`listDisplays` e a KDoc de `openExternalUrl`, sem função nenhuma abaixo. A
explicação da cadeia inteira — o que é espelhamento, por que o Cast é o último
recurso, por que o `<queries>` existe — estava a 47 linhas da função que
descreve. É o defeito de rotação que a v5.300 catalogou, achado dentro do
arquivo que o `pares-de-comentario.mjs` não cobre.

### E O "TOCAR NESTE CELULAR" VIRA CAMINHO SÓ DE IDA

A v1.0.5 (um dia de vida) persistia a escolha e oferecia "Voltar a exigir uma
tela". O operador pediu o contrário: *"não precisa ter um botão de voltar … a
tela de bloqueio é reativada caso o app feche ou caso vá para o modo avançado e
volte … um caminho só de ida, mas apenas para o uso atual"*.

**E persistir era o defeito que o botão de volta vinha remendar.** Guardada, a
decisão de um ensaio de quarta-feira chegava ao culto de sábado, e alguém tinha
de lembrar de desfazê-la — a nota da v1.0.5 escreveu esse risco e respondeu a ele
com um botão. Sem gravar, não há o que desfazer: `tocarNoCelular` é um `let` e
mais nada, e o bloqueio se rearma por três caminhos (o app fecha · ida e volta
pelo avançado, em `setAppMode` · uma tela entra, em `renderSimpleGate`).

Daí o botão SUMIR depois do toque em vez de trocar de rótulo — e daí o estado de
cor `.escolhido` da v1.0.5 sair junto com ele. Um botão que some não precisa
dizer que foi tocado: a tela desbloqueada e o som saindo já dizem.

Medido nos nove passos, incluindo os três rearmes:

```
1. Modo Fácil, sem tela            | oferece | BLOQUEADO | mudo
2. toca em "Tocar neste celular"   | oculto  | livre     | SOM
3. vai ao avançado                 | oculto  | livre     | SOM
4. VOLTA ao Modo Fácil             | oferece | BLOQUEADO | mudo
5. escolhe de novo                 | oculto  | livre     | SOM
6. uma TV entra                    | oculto  | livre     | mudo
7. a TV sai                        | oferece | BLOQUEADO | mudo
8. escolhe outra vez               | oculto  | livre     | SOM
9. o app FECHA e reabre            | oferece | BLOQUEADO | mudo
```

Suíte inteira verde: 25/25.

---

## v1.0.5 — o Modo Fácil deixa de exigir uma tela

Pedido do operador: *"adicione no modo fácil, no popup de seletor das opções de
tela uma opção de 'tocar no celular sem conectar uma tela' que desbloqueia a tela
do modo fácil e libera o som no smartphone"*.

### O BLOQUEIO ESTAVA CERTO SOBRE O MECANISMO E ERRADO SOBRE A PESSOA

Sem tela, o Modo Fácil cobre tudo com a cortina embaçada, e o argumento era bom:
ali a projeção É o telão, não há preview, e a saída de áudio deste aparelho valia
**só no avançado** — um ▶ não produzia absolutamente nada, nem imagem nem som.

O que ele supunha é que quem abre aquele modo sempre quer projetar. Ensaiar o
louvor, conferir a letra ou ouvir o playback a caminho da igreja são usos
legítimos, e para todos eles a resposta certa já existia no app inteiro: o som
saindo deste aparelho, que é o que o modo avançado faz sozinho sem tela nenhuma.
O bloqueio não estava protegendo de nada nesses casos — estava mandando o
operador trocar de modo para ouvir uma faixa.

### A CONDIÇÃO ÚNICA, E POR QUE ELA NÃO VIROU DUAS

`somLocalDeveEstar()` passou de `appMode === 'full' && !algumaTelaConectada()`
para `!algumaTelaConectada() && (appMode === 'full' || tocarNoCelular)`. Os dois
modos entram pela **mesma porta** — o avançado por DERIVAÇÃO, o Modo Fácil por
ESCOLHA — porque a pergunta de baixo é uma só: *há para onde mandar o som?* Um
segundo caminho para o mesmo mudo é o que divergiria no primeiro caso de borda,
e o mudo da preview tem UM ponto de escrita de propósito (`acertarSaidaDeAudio`).

### A ESCOLHA É PERSISTIDA, E POR ISSO PRECISA MORRER SOZINHA

`tocarNoCelular` mora no `state` do banco — sem isso ela não sobreviveria a um
lançamento, e o operador que ensaia toda quarta a refaria toda quarta.

Mas persistir sem desfazer é o defeito: a escolha de um ensaio de quarta-feira
chegaria ao **culto de sábado**, e o culto começaria com o telão no ar e o áudio
no bolso de quem opera. **Ninguém procuraria a causa num botão tocado três dias
antes.** Por isso o próprio `renderSimpleGate` a apaga quando uma tela entra —
escrito direto, e não por `setTocarNoCelular`, porque estamos DENTRO do render e
a chamada de volta seria recursão.

### DUAS ARMADILHAS DE ENCANAMENTO, as duas MEDIDAS

O botão nasceu desenhado pelo `renderCast`, e as duas apareceram na primeira
sondagem:

- **Ele sobrevivia visível no modo avançado.** Trocar de modo não passa por
  `renderCast` — em avançado o `hostCastConn` não o chama.
- **O rótulo não trocava depois do toque.** `renderCast` abre com
  `if (!castConnVisivel()) return`, e LIGADO a escolha desbloqueia o Modo Fácil:
  o bloco de conexão volta para a folha (fechada), a guarda fecha, e o botão
  parava de ser repintado **justamente quando é a única forma de desfazer o que
  acabou de fazer**.

Os dois somem com o mesmo movimento: quem o desenha é `renderCastLocal`, chamado
do `renderSimpleGate` — a função que responde às três coisas de que ele depende
(o modo, as telas e a própria escolha) e que é chamada por todas as três.

### O TERCEIRO ESTADO DE COR, porque os dois de cima já estão falados

A folha já tem `.connected` (verde, "conectado") e `.ligado` (vermelho, "a
transmissão está no ar, e o toque desliga"). Nenhum serve: **verde diria
"conectado" no único botão que significa NÃO conectei nada**, e uma segunda linha
vermelha na mesma folha faria o operador não saber qual delas está servindo a
rede da igreja.

`--sel-fill` é o fundo de estado do SELECIONADO, que é exatamente o que isto é —
o operador escolheu um destino para o som. Medido nos dois temas: 7,64:1 com
`--text` e 4,92:1 com `--accent` no escuro; 6,76:1 e 5,87:1 no claro.

### O que ficou medido

Os cinco estados, com o mudo lido no `<video>` da preview (`applyMedia` faz
`video.muted = forceMuted ? true : muted`, então ele é o observável honesto):

| estado | palco | som | botão |
|---|---|---|---|
| avançado, sem tela | livre | sai daqui | oculto |
| Modo Fácil, sem tela | BLOQUEADO | mudo | "Tocar neste celular" |
| depois do toque | livre | **sai daqui** | "Voltar a exigir uma tela" |
| uma TV entra | livre | mudo (vai para ela) | oculto, escolha desfeita |
| a TV sai | BLOQUEADO | mudo | volta a oferecer |

Suíte inteira verde: 25/25.

---

## v1.0.4 — o selo de camadas veste o desenho da preview

Pedido do operador sobre o selo que a v1.0.3 criou: *"que ele tenha o mesmo
design apenas ícone igual aos outros ícones na própria preview"*, e que o desenho
tenha *"um ✕ para representar que vai fechar a camada"*.

### A PASTILHA SAI — e a v1.0.3 escolheu errado por um bom motivo

Ela era preenchida porque a paleta marca `--live` como **só preenchimento**:
saturado, ele é o par `--live`/`--on-live` de "está no ar agora". O raciocínio
estava certo sobre o token e errado sobre o LUGAR — os três ícones daquela
miniatura são um conjunto, e um deles com pastilha vira o único botão "de
verdade" ali. O desenho da preview é o traço com as três sombras; o que
diferencia este dos outros é a cor, não a forma.

E a paleta já tinha a resposta para vermelho de TRAÇO: o clareado. No PALCO —
que é o território desta miniatura, e é por isso que a `.pv-fab` veste
`--stage-text` e não `--text` — esse valor tem nome próprio: **`--stage-alert`**,
5,8:1 sobre o preto do palco. Mesma família, mesma leitura, e o uso que o token
do preenchimento recusava deixa de acontecer.

### O ✕ ENTRA NO DESENHO

A pilha diz o ESTADO (há algo por cima de algo) e o ✕ diz o que o toque FAZ — a
mesma divisão dos botões da notificação de mídia. Sem ele o selo era um aviso, e
um aviso que responde ao toque é o pior dos dois mundos.

**São DUAS folhas, e não as três do desenho canônico:** a terceira ocuparia o
canto onde o ✕ mora, e a 24px o que sai de um traço em cima do outro não se lê
como nenhum dos dois. Duas já dizem "empilhado". A folha de baixo é truncada à
direita pela mesma razão — ela passaria por baixo do ✕ e voltaria como borrão.

### E ELE APARECE NO MODO FÁCIL

Medido nos dois: em avançado o alvo é 34×34 numa preview de 314×150; no Modo
Fácil, os mesmos 34×34 numa de 199×95. Ele já aparecia — o Modo Fácil não tem
preview própria, ele MOVE a mesma `.preview` para dentro do `#simpleStage`, e o
selo viaja junto.

A primeira medição disse o contrário (preview de 0×0), e não era o selo: sem tela
conectada o Modo Fácil entra no estado BLOQUEADO (`renderSimpleGate`, a cortina
embaçada) e o palco é escondido por CSS. Era o app fazendo o certo e o oráculo
perguntando na condição errada — a mesma classe de erro que o `CLAUDE.md`
cataloga em "um oráculo não pode medir o runner".

Suíte inteira verde: 25/25.

---

## v1.0.3 — o selo de camadas, e três sinais que não chegavam

Quatro pedidos do operador, e três deles eram a mesma família: **algo acontecia e
a tela não dizia**.

### O SELO DE CAMADAS, e ele é a única saída de uma delas

Relato: *"ao tocar um áudio e depois tocar um texto, aviso ou imagem por cima,
não conseguimos remover ela se não tivermos ela no cronograma ou na aba de
mensagens… o botão de stop corta toda a apresentação."*

Ele está descrevendo um buraco real. A Camada de Texto sai por `text-hide`, que
preserva o áudio por baixo — mas o único gesto que a manda é o da LINHA que a pôs
lá (`retirarDoAr`). Projetada de qualquer outra porta, a camada ficava sem saída
própria, e o Parar do transporte encerra a CENA INTEIRA: o operador que só queria
tirar o versículo perdia o louvor junto, na frente da congregação.

Agora um selo aparece sobre a preview, e ele **só existe com as duas coisas no ar
ao mesmo tempo** — camada projetando E mídia por baixo. É o que o faz um SELO e
não mais um botão permanente: enquanto ele está lá, há duas camadas; sumindo, há
uma só e o Parar volta a ser a resposta certa. `midiaNoAr` e não `playing`, pela
régua de sempre: um louvor PAUSADO para a oração é a cena por baixo, e é o caso
em que perder o áudio junto mais dói.

Cada provedor sai pela PRÓPRIA porta (`hideBibleVerse`, `hideMessage`,
`hideChrono`, `hideDraw`, `hideImagemSobre`), o que preserva a sessão dele para
reexibir pela lista; `songlyrics` e `avulso`, que não têm `hide*` próprio, caem
no par `text-hide` + `clearManualText` do ramo de cue.

**PREENCHIDO, e é a regra da paleta.** `--live` é o scarlett oficial marcado como
*só preenchimento*: saturado, ele é o par `--live`/`--on-live` de "está no ar
agora" — o mesmo do microfone aberto. Como TRAÇO seria o uso que aquele token
recusa. Preenchido, ele ainda ganha o que o desenho pedia: os dois vizinhos na
preview são controles de PLAYER (ícone branco sem moldura) e este é um ESTADO.

MEDIDO no caminho: escrita ANTES da `.pv-fab`, a regra de cor perdia por ordem —
as duas medem 0,1,0 — e o selo saía BRANCO, igual aos botões ao lado, isto é, sem
dizer nada.

### O endereço da transmissão se COPIA

Ele é digitado num OUTRO aparelho, e quem o passa adiante manda por mensagem.
Transcrever `http://192.168.x.y:8080` à mão erra um dígito, e o erro só aparece
no navegador do outro lado, como "site não encontrado". O botão é o mesmo do
Registro (`.log-copy`), e o ícone virou símbolo do sprite — duas cópias do mesmo
desenho divergiriam no primeiro ajuste, que é a razão daquele sprite existir.

### O fundo dos slides não chegava à tela da rede sem o canal de mídia

`telaReenviarPreferencias` abria com `if (!telaCanal()) return`, e a guarda
derrubava as TRÊS preferências. Só o WALLPAPER depende do canal — ele empurra uma
imagem; `lyricsbg` e `fit` são JSON puro no mesmo SSE de todo comando do culto e
não movem um byte.

O preço da guarda larga é o defeito que aquele reenvio existe para fechar: a tela
nasce em `lyricsBgMode = 'black'` (ela não tem o IndexedDB do celular para
consultar, ao contrário do telão de verdade) e ficava com o **fundo dos slides
preto com a opção ligada**, para sempre — nada reexamina uma estrofe já
renderizada. E calado: sem canal não há erro, não há linha no Registro, e o
padrão do `fit` e do wallpaper é aceitável o bastante para ninguém reparar.

A guarda desceu para o único bloco que depende dela. O oráculo do `boot-nativo`
ganhou as duas metades — o `lyricsbg` TEM de sair sem canal, e o `wallpaper` NÃO
pode (a URL `/m/` apontaria para bytes que nunca chegam) —, e foi conferido que
ele reprova com a guarda antiga de volta.

> Este é o TERCEIRO defeito desta família (v5.188, o `__tela` que nunca era
> mandado; v5.221, as imagens que chegavam depois da desistência). Os dois
> anteriores continuam travados por oráculo e passam. **Não reproduzi o caso que
> o operador viu**; o que está corrigido aqui é um caminho a menos para o mesmo
> sintoma, achado lendo o código.

### O download de um episódio de série não acendia NADA

Relato: mandar um episódio do Provai e Vede ou do Informativo para o Cronograma
não sinaliza que há download preparado, nem enquanto ele corre.

Um episódio é um vídeo do YouTube, mas ele **não é desenhado por
`ytResultRow`** — a lista dele é a da COLEÇÃO (`hymnResultRow`, com `data-song`),
e o indicador de download de lá é o anel do quadrado à esquerda. `setYtEstado`
pintava só `.yt-result`: nenhum elemento casava, e o único sinal de ~300 MB
baixando era a notificação do sistema, fora do app.

`serieComoYoutube` passa a carimbar a linha de origem — num lugar só, porque é
ali que `coll` e `s` existem juntos —, e `setYtEstado` acende o anel dela pelo
contador que já existe (`setSongRowBusyKey`, extraído de `setSongRowBusy`). Ele
ESPELHA em vez de somar: o `onPct` bate a cada fatia, e um contador incrementado
a cada batida nunca voltaria a zero — o anel giraria para sempre.

Suíte inteira verde: 25/25.

---

## v1.0.2 — o botão deixa de dizer "espelhar", e a página fala com quem ainda não instalou

Lote de AJUSTE, e é OTA puro: nada em `java/`, `res/`, no manifest ou nos
workflows. Sem `shellTag` — não há Release a esperar.

### "Espelhar para TV" vira "Conectar uma TV"

Pedido do operador: *"para não ter a ideia de espelhar"*. E ele está certo pelo
motivo mais forte que existe neste projeto: **o que vai para a TV é o telão, não
a tela do celular** — é a distinção que a `Presentation` existe para fazer e que
sustenta a arquitetura inteira. O rótulo anunciava ao operador exatamente o
oposto do que ele recebe.

O botão abre o seletor de espelhamento do fabricante, e isso não muda: não há
API pública para conectar sozinho. O que muda é que aqui se diz o DESFECHO, e o
nome do mecanismo fica para a tela do Android, que é de quem ele é. O estado
conectado acompanha — "Espelhando em X" vira "Conectado: X" —, e o `title` do
botão de cast da preview vai junto, porque é o mesmo botão noutro lugar.

Fica de fora a linha **"Espelhar abre: …"** do Registro: ela nomeia qual
candidato da cadeia do `pickCastIntent` o aparelho resolveu, isto é, fala do
seletor do Android e não do nosso botão. Renomeá-la tiraria a única pista que
responde "por que o botão abriu a tela errada?".

### A página: um tema só, oito cards e três passos

- **CLARO E SÓ CLARO.** O par escuro seguia o sistema, e com ele a mesma página
  chegava em dois desenhos — só um deles olhado. O app tem dois temas porque é
  operado num salão escuro durante o culto; esta página é lida de dia, por quem
  ainda não instalou nada. `<meta name="color-scheme" content="light">` entra
  junto, senão o navegador desenha campo, barra de rolagem e menu de contexto em
  escuro por cima de um documento claro.
- **O RESPIRO ENTRE A FAIXA E O PRIMEIRO TÍTULO MEDIA ZERO**, e era um defeito de
  especificidade: `main { padding: … }` era engolido inteiro pelo
  `padding: 0 1.15rem` do `.env`, porque uma CLASSE vence um seletor de TIPO
  qualquer que seja a ordem no arquivo. O título nascia colado no denim — mais
  perto dele do que dos próprios cards que ele nomeia. Com `main.env`, 40px
  contra os 18px que o ligam ao conteúdo dele.
- **Os cards passam a nomear o que existe**, com o subtítulo carregando a frase
  inteira em vez de um rótulo: Coletâneas offline (hinários, músicas JA, Provai e
  Vede, Informativo Mundial), Textos bíblicos, Letras das músicas, Cronograma,
  YouTube, **Slides** (card novo — apresentação e passagem de página) e **Recebe
  de tudo** (compartilhar do WhatsApp, do YouTube, da galeria). O card exclusivo
  do Provai e Vede sai: ele era um item das Coletâneas ocupando a mesma escada
  que uma função.
- **O guia cai para TRÊS passos.** "Conecte a TV" não é instalação. A permissão
  passa a falar de **"este navegador"** (é ele que o Android pergunta se pode
  instalar, e "aquele aplicativo" não diz a ninguém qual), e o Play Protect deixa
  de ser um susto condicional — vira **"Verifique com o Play Protect"**, com a
  verificação a aceitar e o Instalar depois dela. O subtítulo "É um arquivo só"
  sai: o botão logo abaixo já diz o tamanho.
- **A tese do topo é a frase do rodapé**, e o rodapé perde a dele. *"Nada do que
  você projeta sai do seu aparelho"* dava a entender que o aparelho não controla
  nem é fonte de nada — quando ele é as duas coisas. No lugar: *"A tela da sua
  igreja 100% controlada por você. Sem anúncios, janelas e distrações para o
  público."*
- **"Grátis" sai do botão** (é subentendido) e **"aplicativo Android" entra no
  `<title>`**, que é onde a busca e a aba leem — a página não dizia em lugar
  nenhum que o download é um app de celular.
- Sai a frase sobre a busca achar por nome, trecho ou tema: é autoexplicativo
  dentro do app.

Suíte inteira verde: 25/25.

---

## v1.0.1 — o ícone de pé, e a Biblioteca com um toque a menos

Primeiro lote depois da 1.0, e o primeiro a exercitar o degrau de CORREÇÃO do
número (`MAIOR.INCREMENTAL.CORREÇÃO`): nada de conceito novo, nada de seção
nova. **Exige Release** — o ícone mora em `res/`.

### O ícone é uma mesa de som DE PÉ

As três trilhas eram horizontais e os cabos de fader eram círculos. Numa mesa de
verdade os faders são VERTICAIS e o cabo é um retângulo baixo e largo — é o que a
mão empurra. O desenho é o mesmo girado 90° em torno do centro, com os círculos
virando retângulos arredondados de área equivalente (198 contra os 201 do círculo
de raio 8): mesma presença visual, forma certa. Nada sai da zona segura de
18..90 em nenhum dos dois eixos.

Os valores vivem em DOIS arquivos com o mesmo `pathData` —
`res/drawable/ic_launcher_foreground.xml` (o APK) e `site/icone.svg` (o favicon
da página). Quem chega pela aba e depois instala tem de reconhecer o mesmo
símbolo na gaveta do sistema; é essa continuidade que justifica a duplicação, e
por isso os dois são greppáveis pelo mesmo texto.

### As coleções fixas saem dos grupos e viram cards da RAIZ

Os dois hinários moravam em "Hinários" e as duas séries em "Arquivos oficiais"
(v5.260). O agrupamento cobrava um toque que não pagava por si: **quem abre o
Hinário 2022 quase nunca quer o de 1996 na mesma sessão**, e quem vai ao Provai e
Vede não vai ao Informativo. Na raiz, o toque que abria o grupo abre a LISTA DE
FAIXAS — o card já é o acordeão.

O que o grupo separava continua separado: ele existia para distinguir dois
MODELOS de item (áudio com letra × vídeo do sábado), e essa distinção é do CARD
(`tipoDaColecao`), não do cabeçalho que ficava por cima dele. A ORDEM é a mesma
de antes — séries primeiro (material DATADO do sábado que vem), hinários depois
(acervo PERMANENTE, alcançado pela busca).

Com os grupos, saiu também o `semBotao` de `grupo()` e o ramo de contagem que só
ele alcançava: eram os dois únicos consumidores.

### O card do álbum ganha TOM PRÓPRIO, e isso é uma exceção declarada

`.hymnal-card` lia `--camada` (o degrau que o pai lhe reserva). Na raiz o pai é a
folha, que reserva `--panel`; dentro de uma seção, `--panel-2`. Resultado: **o
mesmo álbum trocava de cor conforme alguém o tivesse agrupado**, e a escada
inteira de dentro dele descia um degrau junto.

MEDIDO no escuro com o card em `--panel`: a faixa (`--item-fill`, recesso de 24%
sobre a base do card) compunha rgb(33,40,46), e a gaveta aberta — que já está no
CHÃO da paleta (`--gaveta-bg` = `--bg`, e no escuro não há para onde descer) —
ficava a **1,26:1** dela, abaixo do piso de 1,28. Era a volta literal da queixa
que a v5.287 fechou: *"a seção das opções se mesclando com a lista dos outros
itens abaixo"*.

A regra passou a ser do CARD (`--camada: var(--panel-2)` na regra dele): um álbum
é uma PLACA de nível 2 onde quer que esteja filado. Dentro de uma seção o valor é
o mesmo de antes — a regra é no-op ali. Ela **não revoga** "quem declara o tom é
o CONTÊINER": é a exceção de um bloco que quer o MESMO degrau para si e para os
filhos, e nenhum filho veste por engano o que ele reservou (quem lê `--camada` ali
dentro é a tampa do card aberto, que é o próprio card; a `.coll-songs` zera o
degrau seguinte).

### O vão dos Favoritos contava só as SEÇÕES

`medirVaoDosFavoritos` somava a barra de cada `.coll-group--drop` para saber o
que sobra da tela. Com quatro cards fixos na mesma `<ul>`, ele passou a devolver
um vão MAIOR que a tela — pela altura dos cards e pelos vãos entre eles —, e o
efeito era o oposto do que o vão existe para produzir: os Favoritos ficavam
grandes demais e empurravam as seções fechadas para FORA da primeira tela.

A conta passa a ser sobre TODO filho da lista, com a barra procurada pelos dois
nomes (`.coll-group-bar, .coll-bar`) e a altura do próprio bloco como resposta
para quem não tiver nenhuma. Um vizinho novo ali entra sozinho.

### A página de acesso, reescrita para quem não é técnico

Pedido do operador: *"está uma página muito técnica, muito texto e subtexto…
quero uma página leiga, poucos textos, mais prática"*. O que mudou:

- **A tese** diz o ganho pelo que a TV NÃO mostra: sem notificação, sem barra,
  sem anúncio.
- **Oito cartões com subtítulo de uma linha** — e o conteúdo passou a nomear o
  que existe: hinários offline, Provai e Vede e Informativo Mundial, YouTube sem
  anúncio (recebido pelo compartilhar, baixável para uso offline), Cronograma,
  fotos/PDF/slides direto do WhatsApp.
- **"Funciona sem internet"** deixou de ser "funciona sem TV": a projeção chega
  a qualquer tela na mesma rede, pelo Wi-Fi da igreja ou pelo roteador do
  celular.
- **O guia virou QUATRO passos**, com o Play Protect como passo próprio (era um
  parágrafo depois da lista) e o **botão de baixar DENTRO do passo 1** — quem
  chegou até ali não deve ter de subir a página.
- **O tutorial do Modo Fácil saiu.** Ficou a menção de que o app abre nele e de
  que o modo avançado mora em Configurações.

### A PÁGINA SERVIA A RELEASE ANTERIOR, e o gatilho que devia impedir isso nunca disparou

Achado ao publicar este lote. A v1.0.1 saiu às 17:40; a última publicação da
página era das 17:33. Por sete minutos o botão "Baixar grátis" serviu o `.apk`
da v1.0 — sem nada na tela dizendo isso, que é exatamente o modo de falhar que o
`pages.yml` foi escrito para fechar.

**A causa é o guarda de recursão do GitHub.** A Release nasce do
`action-gh-release` com o GITHUB_TOKEN padrão, e evento originado nesse token
não cria execução nova de workflow. Contado na API: `release` disparou **zero**
vezes em 136 execuções do `apk.yml`. O `apk.yml` já sabia disso e contorna com
ORDEM DE JOB — o `web-ota` tem o `apk` no `needs` e consulta a Release já
publicada, no mesmo run; foi por isso que o manifesto do OTA saiu certo. O
`pages.yml` não sabia, e não podia usar o mesmo truque: é outro workflow, e
`needs` não atravessa arquivo.

Quem atravessa é **`workflow_run`** — o mecanismo de encadeamento do próprio
GitHub, e o único que aquele guarda não suprime. O `pages.yml` passou a
disparar no "Build APK" completado, com guarda de `conclusion == 'success'` e
`head_branch == 'main'` (senão uma execução de branch de trabalho poria no ar a
página de um commit que não é o de `main`). A linha `release` fica pelo mesmo
motivo que fica no `apk.yml`: quando a Release nasce de outra mão, ela dispara
de verdade.

**O comentário do `pages.yml` e o do `CLAUDE.md` afirmavam o mecanismo errado** —
os dois foram corrigidos no mesmo lote. Um comentário que descreve um gatilho
que nunca chega é o convite exato para o próximo leitor confiar nele.

### Os oráculos

Três reprovações do `smoke.mjs` e duas do `boot-nativo.test.mjs` vieram deste
lote, e **duas eram defeito do app** (o vão dos Favoritos e o tom do card). As
outras eram fixture: casos que abriam o grupo "Hinários" para ter uma seção,
casos que comparavam a largura de um card da raiz com a de um card de dentro de
uma seção, e um `renderCollectionsList` sem zerar a lista antes — este último um
defeito de fixture que existia desde antes e que só apareceu quando a conta do
vão passou a somar os filhos duplicados.

Suíte inteira verde: 25/25.

---

## v1.0 — a primeira versão pública, e o piso que ela estabelece

O app tem um operador só, e o estado atual passa a ser a base. Este lote é o
corte: a numeração recomeça, e com ela morre toda a tolerância a um shell que
já não existe.

### A versão reinicia nos DOIS canais

`version.json` 5.317 → **1.0**, `WEB_VERSION` e o span do rodapé junto, e o APK
sai como **v1.0**. As 103 tags do esquema anterior (`v1.0`→`v1.99`,
`v2.0`→`v2.4`) são apagadas pelo `limpar-versoes.yml`, um workflow de disparo
manual escrito para este ritual e para ser removido depois dele.

**O preço está dito, e é uma reinstalação manual.** `beginSession` só descarta o
bundle OTA guardado quando a base do APK é MAIOR (`compareVersions(embedded,
installed) >= 0`), e `1.0 < 5.317`: um aparelho que já baixou o bundle 5.317
serviria ele para sempre e recusaria todo 1.x seguinte, em silêncio. A saída
escolhida foi desinstalar e reinstalar uma vez, em vez de um migrador — código
de compatibilidade seria exatamente o que este lote existe para tirar.

**`SHELL_VERSION` NÃO reinicia**, e essa assimetria é deliberada: ele é o
contrato da ponte, não uma versão que alguém lê (o operador vê o `versionName`),
e reiniciar um contador monotônico é como se produz o degrau silencioso. Ele vai
a **46** porque a ponte encolhe aqui.

### A ponte encolhe — os dois argumentos ignorados saem

- `espelhoLigar(modo)` → `espelhoLigar()`. O `modo` era ignorado desde a v5.156.
- `espelhoAprovar(id, sim)` → `espelhoDerrubar(rotulo)`. O `sim` era ignorado
  desde o shell 36, e o NOME mentia: o método só derruba uma tela.

Os dois estavam documentados como "ficam para não custar um degrau". O degrau
chegou, e eles foram junto — atravessando ponte, `BridgeHost` e `MainActivity`.

### As 37 guardas: some a VERSÃO, fica o CONTEXTO

Quase toda guarda tinha a forma `__NATIVE__ && (__SHELL_VERSION__|0) >= N`.
**Apagar a condição inteira em vez de só a metade da versão quebra o navegador**
— onde a base tem de continuar rodando — e o papel `tela`, que é o mesmo
`/display/` num navegador da rede local. A distinção é o lote inteiro.

Três pontos em que a guarda de VERSÃO era, por acidente, a ÚNICA guarda de
contexto — e onde a linha foi TROCADA, nunca apagada: `instalarApk` (que não
tinha `__NATIVE__` nenhum), o `soAudio` e os três `if` do fallback de
`lerAtualizacao`.

Duas condições que moram na mesma linha e NÃO são de shell ficaram: o
`&& !!window.AVSerie` (guarda de MÓDULO CARREGADO, que o watchdog de boot passou
a exigir na v5.315) e o `!r.semSoAudio`.

**A cascata do `mse.js`** é onde a poda ingênua fazia estrago: `faixaNaUrl()`
tem dois consumidores, e é ela que manda o navegador e a tela da rede para o
cabeçalho `Range`. Ela virou `!!__NATIVE__` e CONTINUA existindo. `disponivel()`
colapsava para `true` e saiu, junto do ramo de desistência de `criar()` e da
linha do Registro que mandava "instale o APK novo" — uma frase que, com um shell
só, não descreve ação possível.

### O que ficou de propósito

| o quê | por quê |
|---|---|
| a válvula `minShell` | ela protege o shell atual de um bundle **futuro** — não é tolerância a shell antigo |
| o `try` do `__avBack` | cobre um `controle.js` que abortou no parse, que é o cenário do watchdog de boot |
| `ACOES_PADRAO` | risco assimétrico: o modo de falhar é um cartão de mídia sem transporte no meio do culto |
| a linha "ponte N" do Registro | é ela que denuncia um aparelho rodando um APK que não é o esperado |
| o `?tela=1` do `EspelhoServidor` | é redundância numa rota VIVA (a entrada da tela da rede), não compatibilidade com shell — o ganho seria cosmético e a falha, muda |

### No CI

- **`retag` não podia apagar `web-latest`, e podia.** Nada impedia
  `release_tag: web-latest` com `retag` ligado — e aquela release é o canal OTA,
  com a URL COMPILADA no shell. O dedo errado matava a atualização da base web
  de todo aparelho instalado, para sempre. Agora há guarda explícita, em dois
  pontos do ritual de limpeza e um no `retag`.
- **O teto do `minShell` passa a ser conferido**, lido do `SHELL_VERSION` do
  próprio Kotlin em vez de digitado: um `minShell` acima do teto é um bundle que
  nenhum aparelho aceita, e o sintoma é "a atualização não chega".
- **Um asset de NOME FIXO** (`audio-visual-iasd.apk`) passa a sair ao lado do
  versionado, o que dá um link permanente
  (`…/releases/latest/download/audio-visual-iasd.apk`). Ele fica FORA de `dist/`
  de propósito: a conferência de assinatura faz `ls dist/*.apk`, e um segundo
  arquivo ali passaria a conferir um dos dois.
- O corpo da Release perdeu as duas frases sobre a v1.0 de assinatura de debug
  e a v1.1 — no renumeramento elas ficam falsas e contraditórias.

### A tabela dos degraus da ponte, até aqui

Ela morava no `CLAUDE.md` e passa a morar aqui: com o piso, a lista de degraus é
história do contrato, não regra viva.

| shell | o que mudou |
|---|---|
| **47** | `atualizacaoEstado` ganha `webNotas` — a LINHA DO TEMPO da atualização, lida do `notas.json` do bundle baixado. Não acrescenta poder: acrescenta um campo, e **forma de retorno é superfície** |
| **46** | `espelhoLigar` perde o `modo`; `espelhoAprovar(id, sim)` vira `espelhoDerrubar(rotulo)`. O primeiro degrau em que ENCOLHER foi o objetivo do lote |
| **45** | `espelhoDiag` ganha `midia { itens, bytes, teto }` — o cache da rota `/m/` no Registro. Não muda poder nenhum; o degrau existe porque **forma de retorno é superfície**, e o Registro é lido A DISTÂNCIA |
| **44** | `espelhoEstado` ENCOLHE: cada tela perdeu os seis campos de capacidade (`seguro`, `mse`, `mms`, `fetchStream`, `videoDecoder`, `wakeLock`) — sem produtor desde a v5.187, e `optBoolean` os publicava como `false`, que é valor legítimo |
| 43 | `+ atualizacaoEstado` — os dois canais numa leitura só. Não acrescenta poder, acrescenta **coerência de instante** (três promessas independentes desenhavam o diálogo pela metade) |
| 42 | `+ actions` no `nowPlaying` — os botões do cartão, escolhidos pelo web (invariante 5) |
| 41 | `+ ytCanalPlaylists`, `+ ytPlaylist` — TRANSPORTE puro; quem decide é `controle/serie.js` |
| 40 | ENCOLHE: `espelhoDiag` perde `ritmo`, `espelhoEstado` perde `modo` — restos do espelho de pixels que saíam ZERADOS e eram lidos como medição |
| 39 | `+ temaClaro` — ícones das barras e `windowBackground`, o que o CSS não alcança |
| 38 | ENCOLHE: `espelhoEstado` perde `codigo` (a porta é o endereço); sai `keepAudioAlive` |
| 37 | forma do `espelhoEstado`/`espelhoDiag` vira a do telão por comandos. Nasce o canal `__avTelaMidia`, detectado por **presença**, não por versão |
| 36 | primeiro degrau que ENCOLHE: sai `requestCam`; `espelhoAprovar` passa a só derrubar |
| 35 | `+ apkProcurar`, `+ apkInstalar` |
| 34 | `+` os três métodos do certificado TLS |
| 33 | `+ requestCam` (saiu no 36) |
| 32 | `+` os cinco métodos do espelho |
| 31 | `+ otaCheck`, `+ otaDiag` |
| 30 | **comportamento**: `ytFetch` repetido RECLAMA o desfecho guardado (`YoutubeGrab.resgatar`) |
| 29 | `+ otaPending`, `+ otaApply` |
| 28 | `+ ytCancel` |
| 27 | **contrato**: a faixa de bytes do `ytStream` viaja na QUERY, nunca em `Range` (invariante 8) |
| 26 | `+ ytStream` · 25 `+ ytFetchAte` e `bytes` no `bgProgress` · 23 `+ ytFetchAudio` |
| ≤ 22 | `ytDiag`, `ytSearch`, os três de deck, `pickDoc`, `openExternal`, `ytFetch`/`ytDiscard` |

---

## v5.317 — a limpeza que o levantamento de regras autorizou

Um levantamento das regras explícitas do projeto — as do `CLAUDE.md`, as dos
capítulos de `docs/`, as do KDoc e as do workflow — separou o que ainda governa
alguma coisa do que ficou de pé sem consumidor. Este lote executa **só a parte
que não muda comportamento nenhum**, e o que ficou de fora ficou por um motivo
que passou a estar escrito.

**`TITULO_NENHUM` sai (`controle/serie.js`).** Dos três modos do campo `titulo`
do catálogo, duas séries usam dois: o Provai e Vede é `TITULO_ESQUERDA`, e o
Informativo virou `TITULO_SERIE` na v5.271. O terceiro não era alcançado por
série nenhuma — e o KDoc do MESMO arquivo já recusava um quarto modo (o nome à
DIREITA da barra) com o argumento exato que este contradizia: *"seria um ramo
que nada alcança"*. Saem a constante, o ramo, a exportação, os dois blocos de
KDoc que o descreviam e um braço do ternário do Registro. O parágrafo do KDoc
não foi apagado: passou a documentar o `TITULO_SERIE`, que é o modo que de fato
decide ali e não tinha KDoc nenhum.

**O que ele CUSTA — e é o único efeito visível.** `tituloDoEpisodio` entra na
`AVSerie.impressao()`, que é hash do PRÓPRIO CÓDIGO das funções que decidem:
mexer numa delas invalida o índice guardado, e cada aparelho re-varre as duas
séries uma vez na primeira abertura depois do OTA. Não é dano — é o mecanismo
funcionando, e a razão de a impressão existir (v5.233: mudar a regra não pode
deixar o índice antigo de pé, e limpar o cache não resolveria porque ele mora no
IndexedDB).

**A §11 do `ESPELHO-DE-PIXELS.md` sai, e não por tamanho.** "A frase para o
operador" prometia o **código de três dígitos** — que saiu na v5.189, quando o
`/par` virou anônimo — e avisava que **o som não vai completo** por causa do
player embutido do YouTube, que saiu na v5.212 (hoje a tela toca o arquivo
inteiro, local, e a inversão está escrita no `CLAUDE.md`). Ela não estava velha:
estava AFIRMANDO o contrário do aparelho, dentro do arquivo cujo cabeçalho
promete que "nada aqui descreve código que existe" e que lista as três seções
que sobraram — sem ela entre elas. O que nela continuava valendo (o espelho é
auxiliar; a primeira ligada é numa terça-feira) já vive no `CLAUDE.md` e no
`TELAO-POR-COMANDOS.md`. As citações vivas não foram atingidas: `§2.4` responde
ao `EspelhoCert.kt` e ao `native.js`, e a frase que o `previewAtrasoMs()` cita
está no `§10-A.8`, não na `§11`.

**O QUE NÃO FOI FEITO, E É A PARTE QUE PRECISA FICAR ESCRITA.** O terceiro
candidato do levantamento era a ponte: `espelhoLigar(modo)` ignora o argumento
desde a v5.156, e `espelhoDerrubar` ainda se chama `espelhoAprovar(id, sim)` com
o `sim` ignorado — verificado, nenhum dos dois é lido no corpo do
`MainActivity`. Parece limpeza de graça e **não é**: o web chega por OTA em
minutos e o shell só chega instalando o APK, então uma assinatura encolhida
publica um bundle que chama a forma NOVA para uma frota que ainda tem a VELHA —
e a transmissão para de ligar até o operador instalar, sem nada na tela que
explique. É a assimetria de "um método novo não chega por OTA" vista do outro
lado, e agora está no `CLAUDE.md` ao lado dela: encolher a ponte exige a mesma
pergunta `__SHELL_VERSION__` de sempre, o que ACRESCENTA código em vez de tirar.
Os dois saem quando a frota já estiver no degrau — nunca junto com ele.

Também ficou de fora, e por outro motivo, o TLS do espelho: os três métodos não
têm chamador no web desde que a folha saiu (v5.196), mas `EspelhoCert.material()`
é lido a CADA `espelhoLigar`, e um aparelho que importou um `.p12` enquanto a
folha existia ainda sobe em TLS hoje. Ali "remover" tem desfecho observável — e
muda o endereço que o operador digita, porque com certificado o endereço é o
NOME e não o IP.

## v5.316 — o portão fecha: sai o `continue-on-error` dos oráculos de Chromium

O passo "Oráculos em Chromium" era `continue-on-error: true`. Este lote ataca o
MOTIVO de ele existir, e só então o remove.

**A premissa tinha morrido em duas etapas, e o texto antigo carregava as duas.**
A RAZÃO declarada era INFRAESTRUTURA — *"a justificativa dele sempre foi
INFRAESTRUTURA (download do Chromium, runner sem rede)"* —, mas a frase que a
resumia já concedia o outro lado: *"barrar o canal OTA por um **teste** de
navegador é trocar um risco raro por um bloqueio frequente"*. Ou seja: ela
contemplava um oráculo reprovando de verdade e escolhia absorvê-lo. Na v5.213 a
metade da INFRAESTRUTURA mudou de endereço — virou o passo `Preparar o
Chromium`, que ficou com o `continue-on-error` dela, com o `if` que pula os
oráculos e com o aviso que registra o pulo —, e o passo dos testes ficou com uma
causa só de reprovar. A metade que sobrou nunca foi reexaminada.

**Quem a derruba é a medição, não o argumento.** A troca prometida era "um risco
raro por um bloqueio frequente"; o que se mediu é o inverso em ambos os termos —
o vermelho não era raro (21 dos 23 runs) e quase nada dele era risco (39 de 40
reprovações eram o oráculo medindo o runner, não o app). O que a política
preservava não era um bloqueio evitado: era o RUÍDO que tornava aquelas 39
gratuitas.

**MEDIDO antes de mexer:** 21 dos 23 runs anteriores terminaram VERDES com
oráculo reprovado dentro; 40 reprovações somadas; **uma** delas um defeito de
verdade. O run mais recente (#1012) fechou em 14/15, e a API do GitHub reporta
aquele passo como `conclusion: success` — `continue-on-error` reescreve o
desfecho antes de ele chegar a qualquer painel.

**As outras 39 eram o oráculo medindo o RUNNER.** As cinco classes abaixo são as
que apareceram nas reprovações que este lote conseguiu ler e reproduzir — não um
inventário fechado das 39 —, e nenhuma delas se conserta convivendo com o
`continue-on-error`: ele as PRESERVA, porque tira o custo de tê-las.

| classe | o que estava sendo medido | à raiz |
|---|---|---|
| **prazo lido como veredito** | `waitForFunction(…).catch(() => { ok = false; })`: a asserção seguinte falava do APP quando o que estourou foi o relógio de parede | `ota.test.mjs` ganha `esperar()`, que devolve a FRASE do estouro no terceiro argumento do `checar`, e uma SONDA da intenção — o sinal determinístico que precede a instalação. Era esta a reprovação do run #1012 |
| **medida que depende da MÁQUINA** | igualdade exata de altura: a base pede `system-ui, -apple-system, sans-serif`, e a opção de duas linhas vai de 53px a 55px quando isso resolve para WenQuanYi Zen Hei | `destinos.test.mjs` afirma o que o DESENHO reserva — `conteúdo ≥ --hit` e o mesmo `padding` das opções —, as duas parcelas do piso, nenhuma delas função da fonte |
| **estado que ainda não foi lido** | `mirrorEstado` antes da primeira volta da enquete: o app certo, o oráculo perguntando cedo | `boot-nativo.test.mjs` espera pela INGESTÃO (a tela entrando em `mirrorEstado`), nunca pela resposta derivada — esperar pelo que se vai afirmar é escrever uma tautologia |
| **o oráculo correndo contra o app** | `ota.test.mjs` semeava `ota-intencao` numa página do CONTROLE e navegava. `retomarAtualizacao()` roda na ABERTURA: ela achava a semente e a consumia antes da navegação, e o bloco seguinte reprovava falando de uma regra que nunca chegou a ser exercida (5 reprovações em 8 execuções com a máquina OCIOSA) | a semente vai para uma rota `/semente` que carrega `shared/db.js` **e mais nada** — mesmo origin, banco de verdade, e nenhum app para consumi-la. A navegação seguinte mata aquele documento, que é exatamente o que a asserção afirma que a intenção sobrevive |
| **prazo menor que a CADÊNCIA do app** | quem chama `retomarAtualizacao` é a enquete de dez em dez segundos, e ela desiste de propósito enquanto o manifesto não respondeu — um prazo de 10 s media o compasso, não a regra | o prazo tem de caber o PIOR caminho que o app pode legitimamente tomar; onde há enquete no meio, o prazo é o longo, e o comentário diz por quê |

**E DUAS das instabilidades eram DEFEITO DO APP**, não do teste — as duas na
mesma linha do `db.js`, e nenhuma delas com sintoma no lugar onde acontece:

1. **read-modify-write com duas transações.** `serieDiarioGravar` lia com
   `getState` e gravava com `setState`, e duas varreduras da mesma série (a
   abertura dispara `autoRefreshCollections()` sem `await`; "Atualizar a lista"
   é um toque por cima disso) apagavam uma à outra. O que sumia era a metade dos
   vídeos do diário — e com ela as linhas do Registro que explicam por que um
   episódio não entrou. As INTENÇÕES de download tinham o mesmo par
   (`lembrarIntencao` de um download correndo contra o `esquecerIntencao` do
   `finally` de outro), e ali o item perdido é justamente o que faria o download
   ser reclamado depois de o renderer morrer.
2. **`setState` resolve ANTES do commit** — e este é o mais grave, porque mora
   no caminho do OTA. Ele devolve a promise do REQUEST: quando ela resolve, a
   transação ainda está em voo. `aplicarAtualizacao` gravava `ota-intencao` e
   chamava `otaApply()` na linha seguinte, que RECARREGA as duas páginas — e
   conexão derrubada aborta transação em voo. A intenção sumia, a abertura
   seguinte não achava nada, e a metade nativa do lote desaparecia **com tudo
   parecendo ter funcionado**, que é o desfecho exato que a intenção existe para
   impedir. O espelho disso é a limpeza de `instalarApk`: o diálogo do Android
   pode derrubar o app no instante seguinte, e uma limpeza não commitada reabre
   o instalador na abertura seguinte.

Nasce **`AVDB.updateState(chave, fn)`** — ler, calcular e gravar numa transação
só, com `fn` SÍNCRONA (um `await` lá dentro deixa a transação fechar sozinha), e
**confirmando o commit** (`txDone`). Os dois defeitos acima são as duas razões
dela, e cada uma vale sozinha. Os quatro pontos que mexem em `ota-intencao`, o
diário e as intenções de download passam por ela.

E ele nasce com oráculo próprio, **`tools/db-estado.test.mjs`**, no workflow no
MESMO commit (a lição da v5.145). Ele tem as duas metades: escreve o hazard à
mão — ler, ler, gravar, gravar — e prova que ele PERDE, e só então prova que
`updateState` não perde com a concorrência de verdade. Sem a primeira metade, a
segunda provaria apenas que uma função concorda consigo mesma.

**A prova de que dá para fechar o portão é uma CAMPANHA, não uma execução.** Os
dezesseis oráculos, 4 rodadas, com a máquina a 2× de carga (4 vCPU e 4 processos
ocupando os núcleos — o mesmo formato do runner do GitHub): **64 de 64**. Mais
20 execuções do `ota.test.mjs` a 4× de carga, que é o arquivo onde moravam
quatro das cinco classes: **20 de 20**, e agora todas em 7–9 s (as reprovações
antigas levavam 18–26 s, porque o que elas mediam era o prazo vencendo).

A campanha ANTERIOR, na árvore ainda por corrigir, fechou em 59 de 60 — e a
única reprovação foi o que levou ao terceiro conserto. **É o padrão que a regra
nova descreve:** cada rodada vermelha apontou uma coisa de verdade, e nenhuma
delas era "o teste precisa de mais tempo".

**O que fica no lugar** é uma válvula MANUAL: `ignorar_oraculos`, campo do
disparo de `Build APK`, publica com oráculo reprovado e **grava isso no resumo
do run**, ao lado do placar e dos `::error::`. Nenhum push a alcança. A
diferença para o `continue-on-error` não é de grau: ele decidia por todo mundo,
para sempre e sem registro.

**A assimetria entre os dois passos é a política, e está escrita nos dois
lados:** oráculo REPROVADO segura o canal (é o nosso código); infraestrutura
AUSENTE não segura (é o CDN de outra pessoa). Por isso o passo de aviso do pulo
ganhou peso — sem ele, um `Preparar o Chromium` que passasse a falhar SEMPRE
devolveria o mundo anterior, com um resumo idêntico ao de um run em que tudo
passou.

**O PIN DO ARNÊS VIROU CONTRATO junto com o portão.** Enquanto uma reprovação
era um aviso, reproduzi-la fora do runner era conveniência; com o canal preso
nela, virou requisito — um portão que só fecha e não se abre por inspeção é um
portão que se abre com a válvula, sempre. Daí a regra nova: **subir o pin do
Playwright obriga a repetir a campanha**, porque é o navegador que decide altura
de linha, ordem de evento e quanto tempo uma página leva para assentar. O pin
passa a **1.56.0**, a versão em que a campanha deste lote foi medida.

**O `apk` continua sem `needs: verificar`**, e isso está dito por extenso no
`CLAUDE.md`: o portão fecha o canal OTA (automático, a cada push em `main`, sem
ninguém olhando) e não o APK (manual, com uma pessoa escolhendo a tag). Uma
Release tirada de uma árvore com oráculo vermelho embute a mesma base web — o
preço está declarado, não escondido.

---

## v5.315 — os 21 achados confirmados, corrigidos; e os dois que a revisão adversarial pegou em cima da correção

A auditoria da v5.314 deixou 21 defeitos que MUDAM comportamento em
`docs/ACHADOS-EM-ABERTO.md`. Este lote os fecha, e o arquivo volta a ficar
VAZIO — que é o que ele promete ser.

**O método importa tanto quanto o resultado.** Cada grupo de arquivos foi
corrigido por um agente e depois LIDO por um revisor cético sobre o diff real,
não sobre o relatório. Os revisores acharam duas coisas que teriam ido para a
frota:

- **superfície da ponte sem degrau.** O achado 12 fez `espelhoDiag` publicar
  `midia { itens, bytes, teto }` — e "superfície inclui forma de retorno".
  `SHELL_VERSION` foi a **45**, e o Registro ganhou o CONSUMIDOR que faltava:
  sem ele o campo era produtor sem leitor, e o achado (o operador não saber por
  que uma tela não toca) continuava aberto.
- **o manifesto do OTA podia REGREDIR.** A reestruturação do CI tirou o
  `web-ota` da posição de primeiro job, e ele passou a rodar também no push da
  tag: a ordem de chegada na fila `concurrency` deixou de seguir a ordem dos
  pushes, e o run de uma tag empacota o commit DA TAG. Publicar versão menor por
  cima de maior é o pior modo de falhar deste projeto — o aparelho descarta em
  silêncio. Fecha com uma guarda que lê o manifesto já publicado e pula a
  publicação quando ela rebaixaria, com aviso no resumo do run.

**E uma REGRESSÃO, dentro de uma correção.** O achado 3 usava
`provedorDeTextoNoAr()`, que pergunta quem está PROJETANDO — mas os `hide*`
deixam a sessão de pé com `projecting:false`, de propósito, para o operador
reexibir pela lista. Com o cartão escondido a função devolvia `''`, a troca era
falsa, e reexibir O PRÓPRIO cue apagava o selo dele. Passou a ser
`provedorDoCartao()`, que pergunta quem é DONO da sessão.

**Três correções que estavam pela metade, e as três eram a metade que solta:**

- o coletor (achado 2) prendia a cena e nunca a soltava: `pararMidia` mantém
  `currentId` de propósito, então excluir o que acabou de tocar deixava os bytes
  no aparelho sem lugar visível onde removê-los — o fantasma da v5.87. Agora
  `persistCurrent` grava `noAr` e o coletor só conta a cena que está NO TELÃO.
- a ordem dos cortes do áudio (achado 14) estava certa em produção, mas os
  testes novos a RECOMPUNHAM por fora: invertê-la em produção os deixava verdes.
  A composição virou `TrilhaAudio.noConteiner`, no arquivo puro que tem JUnit.
- a frase do sorteio vazio (achado 18) trocou o motivo por CONTAGEM, e
  `ehMusica` é `temLetra`: toda série do YouTube conta como "sem música". Num
  aparelho com duas séries e um hinário sem índice a tela afirmaria "nenhuma
  coleção de música" com o hinário instalado. A régua virou ACIONABILIDADE.

**O watchdog do OTA fechou o buraco que ele mesmo declarava.** `otaAppIsUp`
ganhou a quinta condição (`Louvorja`/`Bible`/`AVSerie`/`AVSorteio`): um erro de
topo em qualquer um dos quatro não aborta o `controle.js`, então o bundle era
carimbado como bom PARA SEMPRE com o recurso morto. `sorteio.js` mudou em quatro
versões recentes.

**Nada aqui entrou sem prova de MORDIDA.** Cada oráculo novo foi validado
quebrando o código de propósito e vendo reprovar: a ordem invertida no
`TrilhaAudio` (2 falhas), o `noAr` removido do coletor (3 falhas), o
`sorteio.js` com erro de topo (o critério do watchdog reprova), o `step()` sem
`daFila` e o `imgSession.rec` fora do `await0Rec`.

## v5.314 — a auditoria profunda: as lápides que a faxina deixou, a ROTAÇÃO que a prova antiga não via, e os dois oráculos que mediam a si mesmos

Auditoria de 13 frentes sobre os 26 arquivos Kotlin, a base web e a documentação,
com verificação ADVERSARIAL de cada achado (66 confirmados, 15 refutados). O lote
corrige tudo que era documentação, comentário ou oráculo; os 21 que mudam
comportamento viraram `docs/ACHADOS-EM-ABERTO.md`.

**A ROTAÇÃO, e por que ela passou.** A poda da v5.300 deslocou OITO blocos de
comentário do `display.js` uma casa: o bloco do relógio da origem foi parar dentro
do `telaAplicarWallpaper`, o da pré-carga do wallpaper sobre o `agoraDaOrigem`, e
assim por diante num ciclo de seis mais um par trocado. As mensagens daqueles
commits afirmavam "código inalterado (verificado por remoção de comentários contra
HEAD)" e estavam CERTAS — o método é que é cego: remover os comentários dos dois
lados e comparar aprova uma rotação completa. A regra da poda passou a ter DUAS
provas, e nasceu o `tools/pares-de-comentario.mjs` para a segunda. O mesmo defeito
foi achado no `controle.js`, deixado pela v5.312.

**Os dois oráculos que mediam a si mesmos.** O `sombra.test.mjs` tinha a única
lista de arquivos escrita à mão da suíte: ela ainda nomeava `espelho/cliente.js` e
`espelho/fmp4.js` (apagados na v5.187) e NÃO nomeava `espelho/tela.js` nem
`controle/sorteio.js` — e arquivo ausente era um `continue`, então o alcance
encolheu para 9 de 11 em silêncio. Agora varre a árvore (11 arquivos). O
`contexto-seguro.test.mjs` varria `espelho/` e `display/` mas não `shared/`, de
onde o `/display/` das telas da rede carrega quatro arquivos por `http://`;
acrescentá-lo exigiu primeiro reconhecer a detecção de PRESENÇA como guarda
(3 → 7 arquivos).

**O oráculo que um KDoc prometia e não existia.** `tools/tipos-que-sobem.test.mjs`
cobra o par das duas listas de permissão do dreno da tela da rede — o `drenar()`
do `tela.js` e o `TIPOS_QUE_SOBEM` do `EspelhoServidor.kt`. O KDoc dizia que o
`tela-rede.test.mjs` cobrava; ele não cobrava, porque sobe um servidor de mentira
e nunca lê o Kotlin.

**Duas guardas de segurança justificadas por recursos removidos** — a invariante 9
(`WebViewFactory`) e a checagem de origem do microfone (`MicChromeClient`), ambas
apoiadas no embed do YouTube, que saiu na v5.212. É o padrão que o próprio
CLAUDE.md nomeia como "o convite exato para o próximo leitor removê-las". Mais 14
outros pontos do resíduo da v5.212, o `requestCam` (shell 36) com nove linhas de
comentário e nenhum método, o `espelhoAprovar` documentando um PIN de seis dígitos
que não existe, e o `docs/TELAO-POR-COMANDOS.md` — que se declara CONTRATO —
pedindo um código de três dígitos removido na v5.189.

**A seção de threads do CLAUDE.md** descrevia UMA fila de IO "onde roda o download
do YouTube". São TRÊS desde a separação, e a armadilha que ela corrigiu (um
download de 300 MB fazendo `listFolder` vencer os 60 s e devolver lista vazia, que
o `controle.js` lê como "a pasta sumiu do aparelho") era exatamente a que o texto
antigo convidava a repetir.

**E o buraco estrutural:** os 26 arquivos Kotlin não tinham capítulo de arquitetura
nenhum — só o resumo do CLAUDE.md e o KDoc, que foi o alvo da poda. Nasceu
`docs/shell/` com o hub, `PONTE.md` e `OTA.md`.

As três mudanças de COMPORTAMENTO do lote, todas pequenas e locais: a tela da rede
parou de projetar "digite o código de novo" (não há código desde a v5.189); a
`AVSerie.impressao` passou a cobrir `MESES`, `MES_CURTO` e `DIAS_DE_ANTECEDENCIA`,
sem os quais corrigir um nome de mês deixaria o índice guardado de pé para sempre;
e a linha do Registro que classificava o Informativo como "rótulo pelo título" —
justamente a série que IGNORA o título do vídeo.

## v5.313

**A v5.313: "PLAYBACK" VIRA "FUNDO MUSICAL", e o Cronograma passa a receber UM
PACOTE no lugar de N linhas. OTA PURO** (base web, oráculo e docs; sem Release,
`SHELL_VERSION` continua **44**).

Dois pedidos do operador, no mesmo toque.

**O RÓTULO.** *"ajuste o nome de 'playback' para 'fundo musical' … pois ela
reflete melhor o propósito do filtro"*. São duas perguntas diferentes, e é por
isso que a folha de UMA música continua dizendo "Playback": lá o rótulo nomeia o
**arquivo** que se vai tocar (a gravação sem voz, ao lado da cantada); na folha
do sorteio ele nomeia o **propósito da fila inteira** — som por baixo do culto,
telão coberto —, que é exatamente o que a cortina já faz desde a v5.311.

**O VALOR guardado continua `'playback'`**, e isso não é descuido: ele é a
preferência já gravada nos aparelhos **e** o argumento de `resolveSongMediaId`,
onde qualquer coisa diferente de `'full'` resolve o `fileIdPlayback`. Renomear o
valor junto com o rótulo trocaria a variante de todo mundo que já escolheu, em
silêncio — e o oráculo passou a travar as duas metades, o rótulo que aparece e o
valor que não muda.

**O PACOTE.** *"ajuste o envio ao cronograma para que ele não envie um por um,
mas sim um item que seja um pacote de playlist"*. Dez faixas sorteadas eram dez
linhas avulsas no meio do roteiro do culto: para tirá-las, dez perguntas; para
saber que eram um lote, memória.

**E ele não é um tipo de item novo** — é o cue `group` que o botão "Guardar
pacote" da fila já cria: mesmo descritor (`{ ids }`), mesmo desenho de linha,
mesmo `abrirPacote` no toque. Invariante 5 aplicada ao lado web: ponteiro novo
para um mecanismo que existe, nunca um segundo mecanismo.

**A CORTINA PRECISOU VIAJAR NO DESCRITOR.** "Ao Cronograma" guarda e não
projeta — então a decisão que `acertarCortinaDoSorteio` tomava no ato tinha de
sobreviver até o dia da abertura. Sem `data.view`, um pacote chamado "Fundo
musical" abriria em setembro com a letra no telão, desmentindo o próprio nome.
`cortinaDoSorteio` passou a ser a metade que DECIDE (separada da que aplica) e
`abrirPacote` a aplica; **ausente não mexe em nada**, que é o pacote montado à
mão pela fila — ele nunca prometeu nada sobre o telão e não pode começar a
prometer por causa deste campo.

**O QUE FOI PRECISO CONFERIR ANTES DE ESCREVER UMA LINHA:** um cue **não é
detentor** para o coletor (`lerDetentores` lê as listas fixas e os Favoritos, e
mais nada), então guardar ids DENTRO dele normalmente os deixaria órfãos. Aqui
não deixa, e por um motivo que só a leitura do `db.js` dá: a mídia do sorteio
vive no store **`files`** — `resolveSongMediaId` devolve o
`fileIdFull`/`fileIdPlayback` do hinário e `getMedia` cai no `fileGet` —, e o
coletor apaga só do store `media`. Quem manda na vida delas é a coleção que as
baixou, exatamente como antes.

Duas mudanças de comportamento que estão ditas porque são visíveis:

- **cada sorteio é um pacote NOVO.** Antes a dedução era por id e um segundo
  sorteio só acrescentava o que faltava. Um pacote é o INSTANTÂNEO de uma
  tirada; dois lotes no roteiro são dois lotes, e continuam saindo num toque
  cada. `criarCue` ainda avisa quando o conteúdo é idêntico.
- **o nome não usa a palavra "sorteio"** — ela já é o nome de outra cena de
  roteiro (`CUES.draw`), e duas linhas homônimas do mesmo Cronograma fazendo
  coisas diferentes é o tipo de colisão que só aparece no sábado de manhã.

`f` (os filtros SANEADOS da passada que decidiu) passou a ser argumento de
`guardarSorteadasNoCronograma`: a folha fica aberta durante o download, e mexer
num controle ali reescreveria `sorteioPrefs` — o pacote sairia com o nome de uma
escolha que ninguém sorteou. Foi um `ReferenceError` que o oráculo pegou antes
do aparelho.

O `sorteio-tela.test.mjs` ganhou sete asserções, e a que carrega o lote é a que
abre o pacote pelo MESMO caminho da lista (`playCue`) e mede a fila inteira mais
a cortina: **guardar um pacote que não abre é pior que dez linhas soltas, porque
as dez ao menos tocam.**

## v5.312

**A v5.312: A IMAGEM ENTRA POR CIMA DO LOUVOR SEM CALÁ-LO — o motor tem UM
slot, e quem sobrevive a ele é a Camada de Texto. OTA PURO** (base web, oráculo
novo e docs; sem Release, `SHELL_VERSION` continua **44**).

Pedido do operador: *"preciso que imagens, ou arquivos unicamente 'visuais',
possam ser apresentados sobre uma mídia de áudio, sem interromper o áudio,
semelhante ao que já temos com elementos de texto sobre áudio"*. Três escolhas
dele fecharam o desenho: **automático** (o toque na imagem já sobrepõe, sem
pergunta), **tela cheia**, e **agora, neste lote**.

**O DEFEITO, MEDIDO.** Com um louvor tocando, tocar numa imagem parava o som.
Sonda em Chromium, antes: áudio em `paused:true, currentTime:0`. A causa é o
slot único do motor — `stage.js` → `loadInner` faz, sem condição,
`video.pause()` → `removeAttribute('src')` → `video.load()`. **Todo caminho que
emita um `load` mata o que estava tocando**, e é por isso que a independência
áudio × texto sempre funcionou para o versículo: a Camada de Texto **não emite
`load` nenhum**.

**A DECISÃO: a imagem é um MODO da camada, não um segundo slot.** Um segundo
slot no `stage.js` mexeria no código que roda na frente da congregação, para
ganhar o que a camada já tem de graça: cartão opaco acima da mídia
(`.text-layer`, z-index 2), `stage.setOverlay`, saída pelo `text-hide`, reenvio
na reconexão e rodízio de provedor pelo `soUmProvedorDeTexto`. O motor não muda
uma linha. Depois: `paused:false`, `currentTime` andando de 2,11 a 3,02 com o
cartão em cena.

A sessão nasce com a mesma forma das outras cinco (`{ id, nome, projecting }`),
e é isso que a põe de graça em `cenaDeRoteiroNoAr`, no `clearManualText` e no
`resendSceneToDisplay`.

**A METADE QUE FALTAVA ERA A DE VOLTA.** A sobreposição rompe a premissa das
três funções de realce — elas dividem o mundo em CUE (`cueNoArId`) e MÍDIA
(`midiaNoArId`), e a imagem sobreposta não é nenhuma das duas: é um item de
mídia projetando pela porta da Camada de Texto. Sem `imagemSobreNaLinha` a
linha não ganhava selo, não ficava ativa, e o segundo toque caía no
`pararMidia` do ramo de mídia — **o operador tocava na IMAGEM para tirá-la e o
que saía era o ÁUDIO**, com a imagem seguindo na tela. Mesma classe de erro no
`slideTarget()`: sem a guarda, o ⏮/⏭ caía na letra do áudio de fundo, que está
ESCONDIDA atrás do cartão (a música saltaria sem nada mudar na tela) — é a
armadilha que o comentário do cronômetro já descrevia, ao pé da letra.

**O que NÃO sobrepõe, e por quê:**

- **o avanço automático da fila** (`send(id, daFila)`): ali a imagem é o
  PRÓXIMO item da sequência, e sobrepor faria a fila parar de andar sozinha,
  com o áudio anterior tocando para sempre sob a imagem nova;
- **imagem sem áudio no ar**: projeta NORMAL, como sempre. A sobreposição é a
  exceção — aplicada sempre, uma imagem sozinha entraria como cartão de texto
  sobre nada, sem barra, sem cortina e sem transporte;
- **`audioNoAr()` pergunta "no ar", não "tocando"**: um louvor PAUSADO para a
  oração continua sendo a cena. Mesma régua do reenvio.

**A TELA DA REDE precisou do `__rec`.** É o único comando de texto que leva um
`mediaId` — os outros quatro modos carregam o conteúdo dentro do próprio
comando. Sem o enriquecimento, o cartão entraria PRETO nas telas da igreja,
escondendo a cena por baixo sem pôr nada no lugar. O `await0Rec` lê das listas
já carregadas e **nunca do IDB**, porque `telaEnriquecer` roda dentro do
caminho síncrono do `cmd()`: um `await` ali deixaria o comando sair sem
registro e o enriquecimento chegaria tarde, para um comando que já partiu.

**`tools/imagem-sobre-audio.test.mjs`** (20 asserções, Chromium, registrado no
workflow). Ele existe porque **a regra é uma AUSÊNCIA** — nenhum `load` sai
deste caminho —, e ausência não tem sintoma de tela nem erro de console. Daí
medir o `currentTime` do `<video>` em DOIS instantes: *"não pausou"* é fraco
(um `<video>` sem `src` também responde `paused:false` por um átimo), *"andou"*
é o que prova que o áudio é o MESMO e continua correndo por baixo do cartão. E
nas duas metades, porque cada uma falha calada de um jeito diferente: o
Controle que decide sobrepor, e o telão que pinta. Uma asserção é só para o
`mode` desconhecido: o `display.js` cairia no ramo `verse` e desenharia um
cartão VAZIO — preto na tela, sem erro em lugar nenhum.

**E A VERIFICAÇÃO DO PUBLICADO ACHOU OUTRA COISA.** Conferido o canal
(manifesto, `sha256` do zip, conteúdo idêntico ao `main`), o log do run mostrava
**"Oráculos em Chromium: 12/15 passaram"** — `smoke`, `boot-nativo` e
`sorteio-tela` vermelhos, com o passo em `continue-on-error` e o job verde por
cima. O run da v5.311 tinha exatamente os mesmos três: condição pré-existente,
não regressão deste lote (o oráculo novo passou 20/20 no runner).

A causa é uma só, e vale para a suíte inteira: **nenhum oráculo interceptava a
rede externa**. A base web fala com a LouvorJA na carga — `pt_hymnal`,
`pt_hymnal_1996`, `pt_categories`, `pt_bible_version`, `pt_bible_book` e um
`music_<id>` por faixa (medido: seis URLs distintas só no `sorteio-tela`). Numa
máquina sem saída para a internet elas morrem e o oráculo é determinístico **por
acidente**; no runner elas respondem, o hinário real desaba sobre o acervo
plantado pela fixture, e a asserção passa a medir o catálogo da LouvorJA — daí
"1 música relacionada" onde a fixture planta 3 (o casamento por NOME sobrevive,
o por ÁLBUM não).

`tools/sem-rede.mjs` corta a saída de cada `BrowserContext`, chamado nos catorze
oráculos que criam um. **Bloquear é seguro por construção:** os quinze já
passavam onde toda saída externa falha, logo nenhum depende de resposta de
terceiro — o que muda é que agora isso é IGUAL em toda máquina, em vez de
depender de haver internet. As rotas próprias do `boot-nativo` continuam
valendo (o Playwright resolve as de página antes das de contexto). Suíte local:
**15/15**, com o `boot-nativo` passando três vezes seguidas.

O modo de falhar que isto fecha é o pior de todos para uma rede de segurança:
ela não some, ela **grita sem razão** — e uma suíte que grita sem razão é uma
suíte que se aprende a ignorar, que é como um defeito de verdade passa.

## v5.311

**A v5.311: PLAYBACK SORTEADO É SOM DE FUNDO — toca sem nada no telão, pela
cortina que já existia. OTA PURO** (base web, oráculo e docs; sem Release,
`SHELL_VERSION` continua **44**).

Pedido do operador: *"quando for apenas uma música ou playlist de playback,
quero que trate eles como apenas áudio, sem aparecer nada na tela… essa função é
para som de fundo, então não deve ter propósitos de ver letra ou elementos
visuais"*.

**A CORTINA JÁ FAZIA EXATAMENTE ISSO**, e é por isso que este lote não tem
mecanismo novo. `view: 'wallpaper'` põe o wallpaper por cima, e o `#lyrics` do
Display vive no MESMO z-index dos layers de mídia — a cortina cobre os dois de
graça (está escrito no `display.js` desde que a camada de letra nasceu). O áudio
segue tocando, porque ela é visual.

E ela **viaja DENTRO do `load`**, o que resolve o problema de ordem sem uma
linha a mais: o telão nunca chega a desenhar a letra para escondê-la um quadro
depois. Zero campo novo no barramento, zero degrau de `SHELL_VERSION`, e a tela
da rede herda de graça — ela roda o mesmo `display.js`.

**A DECISÃO É EXPLÍCITA NOS DOIS SENTIDOS**, e essa é a metade que não se
percebe pedindo "ligue a cortina no playback": quem sorteou um playback fica com
ela posta, e o sorteio SEGUINTE de uma cantada precisa revelá-la — senão o louvor
entra sem imagem e sem letra por causa de uma escolha de dois minutos atrás. O
sorteio passa a DIZER o estado do telão em vez de herdá-lo.

**"Ao Cronograma" não toca na cortina.** Ele guarda; mexer no telão ali seria o
oposto do que aquele botão promete.

**A FOLHA ANUNCIA**, e só com o playback escolhido — que é quando a pergunta
existe: *"Som de fundo: toca sem letra e sem nada no telão."* Sem ela, a cortina
posta pelo sorteio seria uma mudança de estado do telão que ninguém anunciou. O
Registro também passou a guardá-la (`playback (som de fundo, telão coberto)`).

O oráculo mede o EFEITO em dois lugares que não podem discordar — o estado `view`
do Controle e o `view` que viaja dentro do comando `load` —, e nos quatro
cruzamentos de modo × variante. Provado mordendo.

---

## v5.310

**A v5.310: O TÍTULO PAROU DE ANDAR PARA O LADO E CONTINUOU DESCENDO — a v5.309
reservou as COLUNAS da faixa e não a LINHA, e o oráculo mediu só o eixo que ela
corrigiu. OTA PURO** (base web, oráculo e docs; sem Release, `SHELL_VERSION`
continua **44**).

Relato do operador: *"verifique o título da aba bíblia, pois ele ainda está se
deslocando verticalmente, novamente por causa da seta"*.

**A CORREÇÃO ANTERIOR ESTAVA PELA METADE, E A METADE QUE FALTOU ERA UM EIXO
INTEIRO.** A v5.309 trocou a faixa de flex para grade e declarou
`grid-template-columns`, o que prendeu o eixo horizontal. A altura, porém,
continuou IMPLÍCITA — numa grade sem `grid-template-rows` a linha mede o item
mais alto, e o voltar é `--hit` (34px) contra os 15px do texto do título.

MEDIDO nas três telas, antes:

```
                     faixa    título    lista
Cronograma            15px      y=10     y=36
Bíblia · livros       15px      y=10     y=36
Bíblia · cap+vers     34px      y=19     y=55   ← o voltar entra
```

O título descia 9px **e a lista inteira descia 19px atrás dele** — o que o
operador vê não é só o nome da tela se mexendo, é a tela toda. Com
`grid-template-rows: var(--hit)` as três linhas ficam idênticas (faixa 34px,
título y=19, lista y=55).

**A REGRA, ESCRITA DE UMA VEZ PARA OS DOIS EIXOS:** *a caixa da faixa não pode
depender de quem está dentro dela.* Era isso que a v5.309 já dizia sobre as
colunas, e o que não foi generalizado.

**O PREÇO ESTÁ ASSUMIDO:** reservar `--hit` custa 19px de altura de lista nas
telas em que o voltar não aparece. A alternativa — encolher o botão até a altura
do texto — devolveria ao voltar o **menor alvo de toque do app**, que é
exatamente o que o esqueleto de `--hit` foi criado para impedir (ele já teve
~20px, e a única saída da navegação da Bíblia não pode ser o alvo mais difícil
da tela).

**E O ORÁCULO ERROU JUNTO, POR CONSTRUÇÃO.** O bloco "O NOME DA TELA NÃO SE MEXE"
media `x` e o eixo horizontal da faixa — as duas coisas que a v5.309 corrigiu.
Um oráculo escrito a partir da correção confirma a correção; **o eixo que ele não
mede é o eixo em que o defeito volta**, e aqui ele voltou na primeira tentativa.
Agora ele mede `y`, a ALTURA da faixa e o topo da `#library` nas três telas, e a
lista entra porque o pulo dela é o sintoma maior. Provado pela negativa: sem a
linha declarada, a asserção reprova imprimindo exatamente a tabela acima.

---

## v5.309

**A v5.309: QUATRO AJUSTES PEDIDOS — o título parava de pular, a versão foi para
o fim da referência, o par de confirmar divide a faixa ao meio e a fila ganhou um
LIMPAR. OTA PURO** (base web, oráculos e docs; sem Release, `SHELL_VERSION`
continua **44**).

Pedido do operador, em quatro itens: *"ajuste o título da aba bíblia, que está se
deslocando durante o processo de escolher o capítulo e versículo"*; *"ajuste
também a posição da versão da bíblia na escolha final, hoje ela está mais a
esquerda, coloque ela a direita, após o versículo"*; *"verifique os botões de
cancelar e confirmar exclusão… eles devem ser botões que ocupem toda essa linha
horizontal da gaveta… um na metade esquerda e outro na metade direita"*; *"faça
um botão para limpar toda a playlist tocando agora, deixe esse botão é claro no
popup da playlist"*.

**O TÍTULO PULAVA PORQUE A FAIXA ERA FLEX.** O `#listTitle` era centrado no
espaço que SOBRAVA (`flex: 1` + `text-align: center`), e o `#backBtn` entra e sai
do fluxo conforme a tela da Bíblia — só a de livros não o tem. Entrar num livro
empurrava ~19px para a direita o único texto do app que responde *"onde eu
estou"*, no meio de uma navegação de três telas.

A faixa virou uma **GRADE de três trilhas fixas** (`--hit`, `minmax(0,1fr)`,
`--hit`), com as três posições declaradas uma a uma. É a forma certa aqui porque
numa grade quem ocupa uma trilha é a POSIÇÃO EXPLÍCITA: um item `display: none`
não desloca ninguém, então o `[hidden] { display: none !important }` do topo da
folha segue valendo inteiro e nada precisa lutar com ele. **A correção óbvia era
pela metade:** reservar só a trilha do voltar deixaria o título parado e FORA DO
EIXO em toda a interface — trocaria um deslocamento por um desalinhamento —, daí
o `.list-head-vao` da trilha 3. E as posições são explícitas porque, com
auto-placement, o vão cairia na coluna 1 justamente nas telas em que o voltar não
está lá: o defeito de volta, com outro nome.

**A VERSÃO É A ÚLTIMA COORDENADA.** A `.bible-ref-nav` lia *Versão · Livro ·
Capítulo · Versículo*; passou a *Livro · Capítulo · Versículo · Versão*. As três
primeiras são a referência que se lê em voz alta, na ordem em que ela é dita e na
ordem em que o operador acabou de escolhê-las; a versão não é coordenada do
texto, é em que edição ele está sendo lido, e trocá-la é a decisão mais rara das
quatro. À frente ela abria a barra por uma sigla de três letras e empurrava o
nome do livro — o único campo de largura imprevisível — para as reticências antes
de qualquer outro. O arredondamento das pontas já saía de
`:first-child`/`:last-child`, então acompanhou a ordem nova sem uma segunda
regra.

**O PAR DE CONFIRMAR DIVIDE A FAIXA AO MEIO.** `.linha-confirma-btn` era
`flex: none` e a `.linha-confirma` alinhava à direita: "Cancelar" e "Excluir"
ficavam do tamanho do próprio rótulo, colados um no outro na metade direita de
uma faixa vazia. Dois alvos de um destrutivo a 8px de distância, e metade da
faixa sem dizer nada. Com `flex: 1 1 0` a faixa vira a régua — metade para
desistir, metade para executar —, e vale de uma vez nas três listas (Cronograma,
Favoritos e a fila), porque o par sempre foi um só. `min-width: 0` porque o
padrão de um item flex se recusa a encolher abaixo do conteúdo, mais
`overflow`/reticências como garantia final para um rótulo longo.

**A FILA GANHOU UM LIMPAR, E ELE É O DESTRUTIVO DE MAIOR ALCANCE POR TOQUE DO
APP.** Tirar item a item era o único caminho, e uma fila de culto tem oito ou dez
linhas — cada uma com a própria pergunta. O que o torna aceitável:

- **A semântica é a do excluir de uma linha da fila**, não a de um excluir de
  acervo: `listSet('playlist', () => [])`, sem `retirarDoAr` e sem
  `soltarAvulso`. O que está projetando segue projetando, e o que estiver no
  Cronograma, nos Favoritos, numa pasta ou no slot avulso segue inteiro — o
  `listSet` coleta só o que NENHUMA outra lista aponta, a mesma conta que o
  `listRemove` faz item a item. Limpar dez de uma vez é dez remoções, não uma
  operação nova. A forma com FUNÇÃO, nunca o array: ela roda dentro da transação
  que grava.
- **A pergunta é a mesma das listas** (`pedirConfirmacaoNaLinha` já pergunta ao
  botão quem é o pai dele), e por isso o botão ganhou uma CAIXA só sua
  (`.pl-limpar-faixa`): o par substitui os IRMÃOS dele, e no rodapé inteiro
  levaria o "Guardar como pacote" junto. A ALTURA mora na faixa, não nos dois
  conteúdos — o botão e o par têm receitas diferentes, e sem o número num lugar
  só a folha encolheria sob o dedo no exato instante em que o operador mira um
  destrutivo. `closePlPopup` cancela, como tudo que fecha uma gaveta.
- **Ele é a PORTA de um destrutivo, não a execução dele**, e veste o par discreto
  do "Tirar do ar" (`--surface` + `--danger-text`); o saturado fica para o botão
  que de fato limpa. Dois vermelhos cheios empilhados anunciariam duas ações
  destrutivas onde há uma.
- **Acima do pacote**, porque a folha abre pelo botão da barra de baixo e o dedo
  chega pela borda inferior — a mesma régua que pôs o excluir no começo da
  fileira do `⋮` (v5.288). E **com a fila vazia a caixa inteira sai**: um
  destrutivo inerte ensinaria que tocá-lo é inofensivo.

**OS QUATRO TÊM ORÁCULO**, e o `smoke.mjs` ganhou dois blocos: "O NOME DA TELA
NÃO SE MEXE" (a posição do título nas três telas, mais o eixo da faixa) e "LIMPAR
A FILA INTEIRA" (a pergunta, o par ao meio, a caixa que não muda de altura, o
pacote que fica, o fechamento que cancela e o esvaziamento de fato). A divisão da
faixa entrou no bloco da gaveta da fila que já existia. **Os dois foram provados
pela negativa**: com as correções desfeitas, cinco asserções reprovam — um teste
que não sabe falhar é documentação.

Um efeito colateral bom: o `desvio <= 2` que o bloco da troca de modo já media no
`smoke.mjs` passa a ser guardado por construção, e o comentário dele foi
corrigido — ele dizia que o título só ficava centrado por NÃO haver vizinhos, o
que a partir daqui é falso.

**O lote nasceu como v5.307 e virou v5.309 no merge**: a v5.307 (o confirmar dos
favoritos à direita) e a v5.308 (a palavra do sorteio) saíram enquanto ele era
escrito. As duas mexem na mesma faixa deste lote e o encaixe é limpo — a
inversão delas é do DOM (`data-antes`), a divisão ao meio é do par
(`.linha-confirma-btn`) —, mas o `justify-content: flex-end` da `.fav-acoes`
deixou de pesar no estado `.confirmando`: quem preenche a faixa passou a ser a
`.linha-confirma`, e o comentário de lá foi corrigido no mesmo lote em que
deixou de valer.

---

## v5.308

**A v5.308: A PALAVRA TEMA É MOMENTÂNEA, e sem ela o sorteio DIZ que pega o
acervo inteiro. OTA PURO** (base web, oráculos e docs; sem Release,
`SHELL_VERSION` continua **44**).

Dois pedidos do operador: *"limpe a caixa de referência do sorteio a cada vez
que fechar o popup"* e *"permita (e descreva/identifique) que ao não filtrar por
nenhuma palavra, o sistema considere todo o acervo disponível para sortear (é
claro, considerando os outros filtros e configurações)"*.

**A PALAVRA É UMA PERGUNTA; OS FILTROS SÃO AJUSTES.** A caixa passa a ser limpa
a cada fechamento e a palavra deixa de ser gravada — as outras cinco escolhas
continuam. A diferença é o que cada uma significa: modo, variante, filtros e
quantidade são *como o recurso deve se comportar*; a palavra é feita uma vez.
Reencontrar "natal" no campo em fevereiro é o recurso lembrando de algo que não
é para ser lembrado — pior, é um filtro silencioso sobre o primeiro sorteio de
quem só queria abrir e tocar.

A limpeza mora em `fecharSorteio` e não em `abrirSorteio`: os dois limpariam o
mesmo campo, e só o primeiro vale para os TRÊS caminhos de fechamento que a
tabela `POPUPS` liga a ele — o ✕, o toque no fundo e o botão voltar do aparelho.
O oráculo mede os três.

**SEM PALAVRA, O ACERVO INTEIRO — e agora a frase o DIZ.** A regra já permitia
(`AVSorteio.ondeCasa` devolve `CASOU_SEM_TEMA` com a busca vazia); o que faltava
era dizê-lo. A frase era "28 músicas na biblioteca", que informa o TAMANHO e não
o ESCOPO, e deixava "então ele vai sortear de tudo?" sem resposta na tela.

Ela passou a liderar com o escopo, porque com o campo em branco é o escopo que
está em dúvida — e é HONESTA sobre os dois filtros que encolhem o "tudo":

```
Toda a biblioteca — 58 músicas
Toda a biblioteca, sem o hinário — 18 músicas
Só o que já está no aparelho — 17 músicas
Só o que já está no aparelho, sem o hinário — 5 músicas
```

Dizer "toda a biblioteca" com o hinário fora seria uma frase ERRADA, e frase
errada é pior que nenhuma: ela produz a decisão errada. A VARIANTE fica de fora
dessa conta de propósito — ela não encolhe um acervo, escolhe QUAL faixa de cada
música, e o segmento logo acima já a mostra. E o placeholder responde a mesma
pergunta antes de o operador tocar em nada: *"Palavra tema (vazio = toda a
biblioteca)"* — a única superfície em que ela nasce.

**E UM DEFEITO LATENTE SAIU JUNTO.** O `debounce` do campo cobria a ATRIBUIÇÃO
além da recontagem: digitar "natal" e tocar no botão dentro dos 130 ms sorteava
com a palavra ANTERIOR — sem erro, sem sinal, e com a conta ainda por cima
mostrando o número certo, porque ela e o sorteio liam a mesma variável defasada.
Hoje a palavra é assinada na hora e só o RECONTAR espera (é ele que varre os dois
hinários mais os álbuns, e a letra inteira de cada faixa que não casa pelo
título). O oráculo digita e lê `sorteioPrefs.tema` no mesmo instante.

---

## v5.307

**A v5.307: O CONFIRMAR DOS FAVORITOS PASSA PARA A DIREITA, e o lado do irmão
vira decisão de quem o fornece. OTA PURO** (base web, oráculo e docs; sem
Release, `SHELL_VERSION` continua **44**).

Pedido do operador: *"nos favoritos, o botão de confirmar as opções de play fica
a esquerda dos botões, deixe-o na direita, com as outras opções a esquerda"*.

**A INVERSÃO É DE DOM, NÃO DE CSS.** Um `order` ou um `row-reverse` daria o
mesmo desenho e deixaria a ordem de FOCO ao contrário — numa faixa cujo primeiro
botão é a LIXEIRA de um item. O sinal viaja no próprio nó (`data-antes`, posto
por quem monta a faixa em `linhaDeItem`) e o `destConfirmRow` só o consulta: ele
não conhece nem a faixa de ações de um Favorito nem o "Ver a letra" da
Biblioteca, que continua **depois** do confirmar. O lado é decisão de quem
fornece o irmão, e é por isso que uma das duas mudou sem que a outra se mexesse.

O nó carrega o sinal em vez de um segundo argumento no hook `aoLado` porque é o
NÓ que atravessa as remontagens da lista (`renderItemMenu` refaz a `<ul>` a cada
marca, e o `appendChild`/`insertBefore` apenas o MOVE) — um argumento a mais
seria estado a manter em sincronia com algo que já diz tudo.

O estado `.confirmando` não muda: ali o confirmar sai de cena e a faixa ocupa a
linha inteira, então de que lado ela estava é indiferente.

**O ORÁCULO SEGUIU O PEDIDO, e ganhou uma pergunta.** O
`boot-nativo.test.mjs` afirmava o confirmar à esquerda; agora afirma o
contrário — **e** que a ordem do DOM concorda com a da tela. É essa segunda
metade que faz a regra durar: sem ela, a próxima inversão pode voltar por um
`order` e passar.

---

## v5.306

**A v5.306: DOIS DESFECHOS PARA A FILA SORTEADA, e a conta passa a falar de
MÚSICA em vez de varredura. OTA PURO** (base web, oráculos e docs; sem Release,
`SHELL_VERSION` continua **44**).

Pedido do operador: *"no sistema de montar a playlist, coloque dois botões, um
de tocar agora e outro para adicionar ao cronograma. e dê uma aprimorada na
forma que descreve os resultados. algo como: x músicas relacionadas, x delas já
estão baixadas… mais funcional e menos técnico"*.

**OS DOIS BOTÕES NÃO SÃO DUAS VERSÕES DA MESMA AÇÃO.** Um TOCA (substitui a fila
do player e projeta a primeira) e o outro GUARDA (acrescenta ao Cronograma, sem
tocar em nada do que está no ar). Montar o louvor da semana numa terça e
projetar no domingo são dois momentos, e antes só o primeiro tinha porta.

- **Sorteando UMA SÓ o botão continua sendo um.** "Sorteie uma e guarde" é o
  caminho que a Biblioteca já dá pela gaveta da linha, com a música escolhida à
  vista — aqui seria um destino a mais para uma decisão que o operador toma
  justamente por não querer decidir.
- **Guardar NÃO fecha a folha**, ao contrário de tocar: é o princípio das listas
  de destino do acervo (uma ação que guarda não encerra a conversa), e o segundo
  sorteio é o uso normal — acrescenta cinco, olha a lista, acrescenta mais cinco.
- **Cancelar tem sentidos OPOSTOS nos dois, e está certo.** No "Tocar agora" ele
  descarta, porque trocar a fila do culto por meia lista é uma SUBSTITUIÇÃO pela
  metade. No "Ao Cronograma" ele preserva o que já desceu: três de dez
  acrescentadas é exatamente o que aconteceu, é reversível linha a linha, e jogar
  fora um download que já custou rede seria o desperdício que ninguém pediu.
- A faixa de fecho já sabia hospedar um irmão à direita (o "Ver a letra" da
  gaveta), então **dois botões não custaram CSS novo** além de fazer o segundo
  crescer: "Ao Cronograma" é uma decisão do mesmo porte que "Tocar agora", e não
  uma conferência.

**A CONTA FALA DE MÚSICA, NÃO DE VARREDURA.** Ela saía como `12 faixas casam · 3
já no aparelho · sorteia 5` — três números no vocabulário de quem escreveu a
regra ("casam", "faixas", "no aparelho"), empilhados numa linha só. Passou a
duas linhas com hierarquia, porque as perguntas têm pesos diferentes:

```
28 músicas relacionadas a “natal”          ← --text, peso 600
A playlist leva 10 · 1 para baixar         ← --muted
```

A primeira responde *o tema achou o quê?* e é a que se lê de relance; a segunda é
o custo. Numa linha só as duas disputavam o mesmo peso. **O custo é exato, não
uma estimativa**: o sorteio esgota as baixadas antes de pegar as que faltam,
então quantas precisam de rede é uma subtração. E os números do acervo passam de
mil (os dois hinários somam ~1.100), daí o separador — sem ele, "1243" se lê como
um código.

**A FRASE DE RESPOSTA MORA EM ESTADO, NÃO NO NÓ**, e isso foi um defeito pego
pelo oráculo antes de sair: o `executarSorteio` REDESENHA a folha no `finally`, e
o "adicionadas ao Cronograma" escrito direto no span era apagado no mesmo quadro
em que nascia — o operador nunca o veria. Guardá-la em `sorteioFala` e deixar o
desenho consultá-la faz qualquer redesenho preservá-la, inclusive um caminho de
render que ainda não existe.

**E o `sombra.test.mjs` pegou o outro:** `const tema` dentro da função sombreava
o `tema` de MÓDULO (o claro × escuro), que é a zona morta temporal que já
derrubou o app quatro vezes. Virou `palavra`.

---

## v5.305

**A v5.305: O BOTÃO DA PLAYLIST ABRE A BARRA, e o ícone dele estava a 2,06:1
sobre o campo branco. OTA PURO** (base web, oráculos e docs; sem Release,
`SHELL_VERSION` continua **44**).

Pedido do operador: *"coloque o botão desse sistema de playlist a esquerda da
barra de buscas, e ajuste a cor do ícone dele para ter mais contraste, pois está
fora de padrão de cores"*.

**A POSIÇÃO.** Ele abre a linha; o ✕ continua fechando-a. A barra passa a ser
lida como uma frase — *sortear · procurar · sair*. Entre o campo e o ✕ ele era
um terceiro elemento no canto em que o app inteiro põe a SAÍDA, e a vizinhança
dizia "mais um jeito de fechar isto". A regra do ✕ (*o fim da linha em toda
folha deste app*) fica intacta: ela nunca foi sobre o que vem ANTES dele.

**A COR era um DEFEITO MEDIDO, não uma questão de gosto.** O ícone saiu em
`--accent`, e o botão vive sobre o CAMPO — que é branco literal e **sem tema**.
`--accent` é redeclarado por tema: no escuro ele vale `#95b5f4`, o azul CLARO
desenhado para o fundo quase-preto do app. Sobre branco isso mede **2,06:1**,
abaixo até do piso de 3:1 de componente. No tema claro os mesmos tokens davam
7,70:1 — o defeito existia em METADE dos temas, que é o pior lugar para ele
estar.

É a armadilha que o `CLAUDE.md` já descreve (*"uma superfície sem tema arrasta o
que vive DENTRO dela"*) e que `--field-text` e `--field-muted` já resolviam para
o texto e o placeholder. O acento era o **terceiro consumidor**, e ele apareceu
quando um botão de AÇÃO passou a morar sobre o campo. Daí `--field-accent` no
bloco compartilhado de `tokens.css`, com nome próprio em vez de a folha citar
`--accent-fill`: o nome diz a que superfície ele pertence, e é isso que impede o
próximo controle sobre o campo de repetir a conta.

O valor é o denim OFICIAL (`#2f557f`, o mesmo que `--accent-fill` vale nos dois
temas) — o par para o qual a paleta foi desenhada, porque os dezoito valores
oficiais foram calibrados sobre fundo BRANCO. Medido: **7,70:1**, ao lado dos
8,86:1 do `--field-text` do ✕ e dos 6,08:1 da lupa.

**E ISSO TEM ORÁCULO.** O `sorteio-tela.test.mjs` passou a medir a cor
**COMPUTADA** do ícone contra o fundo computado do botão, **nos dois temas** —
comparar NOMES de token deixaria o defeito passar por baixo, que é a lição que o
`smoke.mjs` já carregava para a escada de camadas. Provado mordendo: com
`--accent` de volta ele reprova imprimindo `{"escuro":2.06,"claro":7.7}`.

A ordem da barra também virou oráculo, e é medida pela POSIÇÃO NA TELA e não
pela ordem no documento: um `order` de flex acrescentado por engano divorciaria
as duas sem que nada reclamasse.

---

## v5.304

**A v5.304: O BOTÃO DA PLAYLIST AUTOMÁTICA ESTAVA INVISÍVEL — o glifo não
existe no subset da fonte, e agora isso tem oráculo. OTA PURO** (base web,
oráculos e docs; sem Release, `SHELL_VERSION` continua **44**).

Relato do operador: *"o botão dele está sem ícone ou texto"*.

**O DEFEITO.** O botão nasceu com o glifo `casino` (`&#xe30c;`), e
`shared/fonts/material-symbols.woff2` é um **subset de 31 codepoints** — aquele
não está entre eles. Um codepoint ausente **não desenha nada**: sem erro no
console, sem requisição falhando, só um vão do tamanho de um ícone. O botão
existia, era tocável, fazia o que prometia, e era invisível.

Não era a primeira vez: `edit`, `folder_open` e `create_new_folder` já tinham
dado o mesmo vão, e a resposta foi desenhá-los à mão (`pencilIconSvg`, o sprite
`#ico*`). O que faltava era a pergunta ser feita por uma MÁQUINA.

**O CONSERTO** é o mecanismo que o projeto já tinha: um `<symbol id="icoSorteio">`
no sprite do `index.html` — UMA definição, DUAS referências (a barra da
Biblioteca e o cabeçalho da folha). Um DADO, e não as setas cruzadas: `shuffle`
já é o "Aleatório" do botão de repetição, a três centímetros dali. As três
pintas são `h.01` com ponta redonda, o truque do `icoCast`, com a espessura
declarada no próprio traço — a largura da moldura (2) some a 19px.

**E AGORA ISSO TEM ORÁCULO.** `tools/glifos.test.mjs` lê o `cmap` do próprio
`.woff2` e cobra todo `.msym` do bundle contra ele. Node puro no passo que
BARRA o build, e não um teste de Chromium, porque a régua é a consequência: um
ícone invisível chega à frota pelo canal OTA e só é descoberto por quem opera —
ali a reprovação seria um aviso.

Ele não precisa de dependência nenhuma: woff2 é cabeçalho + diretório de
tabelas + um blob brotli com as tabelas em sequência, `glyf`/`loca` são as
únicas transformadas, e o `zlib.brotliDecompressSync` vem no Node. A varredura
é da base INTEIRA, não dos dois arquivos que hoje têm glifo — só o Controle usa
`.msym` neste momento, e um oráculo que confia nisso deixa de cobrir o dia em
que deixar de ser verdade. Ele foi provado MORDENDO: com o `casino` de volta,
reprova nomeando o arquivo e a linha.

**E o `sorteio-tela.test.mjs` cobre a outra metade**, que aquele não alcança:
um `<use href="#icoX">` apontando para um símbolo que não existe no sprite dá
exatamente o mesmo vão, e o href é uma string.

**A CONTA VAZIA PERDEU O VERMELHO.** Ela saía em `--danger-strong`, e isso
contraria a gramática de cor do próprio app: vermelho é "está no ar agora"
(saturado) ou "ação destrutiva" (suave). "Nada casa a palavra tema" é o desfecho
normal de quem acabou de digitar uma palavra, e "nenhuma coleção com índice" é
um aparelho recém-configurado. Quem já diz que nada vai acontecer é o confirmar
desabilitado logo abaixo; à linha basta sair do `--muted` para `--text` com peso
600 — ênfase, não alarme.

---

## v5.303

**A v5.303: A PLAYLIST AUTOMÁTICA — sortear por tema, uma só ou uma fila, e a
regra é um arquivo PURO com dois oráculos. OTA PURO** (base web, oráculos e
docs; sem Release, `SHELL_VERSION` continua **44**).

Pedido do operador: *"um sistema de play aleatório temático, tanto para
música/mídia individual ou para montar playlists automáticas … na biblioteca vai
ter um botão de playlist automática, onde ao tocar, você escolhe entre o padrão
de tocar uma só ou tocar playlist. depois você pode escolher uma palavra tema
(que vai fazer a busca na biblioteca sobre palavras-chave e filtrar a lista) e
então aleatoriamente escolhe uma ou mais para tocar em playlist. também pode por
opções de filtros como: musicas cantadas, não tocar do hinário, apenas áudio
instrumental (playbacks sem vídeo). obviamente a coleção de arquivos padrão não
entra nessas listagens."*

Quatro decisões vieram dele em resposta às perguntas do lote: o que fica de
fora são **os Arquivos oficiais e as pastas/Favoritos**; a fila **"vai direto
para a playlist do player, para ser tocada"**; o sorteio **prefere o baixado e
baixa se faltar**; e a palavra tema procura em **nome + letra + álbum**.

**A REGRA É UM ARQUIVO À PARTE, E PURO.** `controle/sorteio.js` decide o que
pode ser sorteado e não faz mais nada — sem DOM, sem IDB, sem rede. É a mesma
razão do `serie.js`: o operador toca UM botão e a faixa entra em cena, sem tela
intermediária e sem ninguém conferir a lista antes.

**As capacidades chegam INJETADAS, e não é cerimônia.** `normalizeForSearch` é o
normalizador ÚNICO da Biblioteca e `lyricMatch` é o casamento por letra da
busca. Uma segunda escrita de qualquer um dos dois faria o sorteio achar um
conjunto e a busca achar outro **para a mesma palavra, na mesma tela** — com os
dois parecendo certos. O módulo, por isso, não normaliza nada: ele pede.

**O QUE FICA DE FORA SAI PELA CAPACIDADE, NUNCA PELA IDENTIDADE.** As séries
saem por `temLetra(coll)`, não por `kind === 'serie'` — é a regra que já governa
a linha e as duas folhas do acervo desde a v5.228, e é ela que abre lugar para o
terceiro modelo de coleção sem um `if` novo. As pastas do aparelho e os
Favoritos nem chegam à varredura: eles não são coleções, são listas, e
`allCollections()` não os conhece. Está escrito no arquivo porque "por que meus
favoritos não entram?" é a primeira pergunta que a tela provoca.

**O QUE JÁ ESTÁ NO APARELHO VEM PRIMEIRO, SEMPRE**, e não é otimização: uma fila
de dez faixas por baixar é a congregação esperando a rede da igreja no meio do
culto. A preferência é ABSOLUTA, e o preço está na tela — com três faixas
baixadas, "sortear uma" sai dessas três até que outras sejam baixadas. Daí o
contador mostrar as duas metades ("12 faixas casam · 3 já no aparelho · sorteia
5") e o chip "Só no aparelho" existir: ele torna a escolha explícita em vez de
deixá-la implícita numa ordenação. **A segunda partição também embaralha** —
sem isso o que completa a fila sai na ordem do acervo, sempre o mesmo álbum,
justamente no aparelho recém-configurado, onde nada está baixado e ela é a única
que contribui.

**`ensureLyricIndex()` PASSOU A DEVOLVER A PROMESSA.** Na busca ele é disparado
e esquecido: o índice chega e a lista se redesenha (`renderSearchResults` é
síncrona, roda a cada tecla e não pode esperar o IDB). Aqui não há redesenho que
conserte depois — o toque manda a faixa para o telão, e sortear com o índice pela
metade produziria um sorteio que IGNORA a palavra tema e projeta mesmo assim.
Quem ignora o retorno continua exatamente como antes.

**"Cantada" e "Playback" viraram um SEGMENTO, não dois filtros.** O operador os
descreveu como filtros, mas eles são os dois valores da MESMA pergunta: marcar
os dois não significa nada e não marcar nenhum precisa significar alguma coisa.
Como segmento a escolha é sempre uma — e é o mesmo par, com os mesmos rótulos,
que a folha de uma música do acervo já oferece. **E o glifo é `casino`, nunca
`shuffle`:** aquele já é o "Aleatório" do botão de repetição, a três centímetros
daqui.

**A PREFERÊNCIA NÃO ENTROU NO `load()`.** Ela chegou lá primeiro, ao lado do
`drawPrefs`, e a medição reprovou: `load()` roda a cada mexida em lista e cada
`getState` dele é uma transação de IndexedDB em série. A leitura a mais empurrou
a reabertura da gaveta depois de uma casa de reordenação — um caso já apertado
no `boot-nativo.test.mjs` — de uma reprovação em três para duas. Ela virou
leitura preguiçosa, na primeira abertura da folha: um dado que só uma folha usa,
lido uma vez por sessão, não se paga em toda a interface.

**DOIS ORÁCULOS, e eles falham de jeitos diferentes.** `tools/sorteio.test.mjs`
(Node puro, **sem `continue-on-error`**) trava a REGRA — os quatro modos de
errar dela são silenciosos: episódio de série no lugar do louvor, faixa que casa
a letra e não aparece, PLAYBACK projetado onde se esperava a voz (o
`resolveSongMediaId` manda para o instrumental tudo que não seja `'full'`), e a
fila cheia do que ainda precisa ser baixado. `tools/sorteio-tela.test.mjs`
(Chromium) trava a LIGAÇÃO, que falha de outro jeito: a regra continua certa e o
recurso não faz nada. As quatro capacidades são ponteiros para funções do
`controle.js`, e um errado devolve um pool plausível e ERRADO.

**E o veredito vai para o Registro** (`blocoSorteio`), ao lado do bloco das
séries e pelo mesmo motivo: a regra decide a partir de nomes e de um índice que
pode não estar pronto, e os dois modos de errar são mudos. Ele guarda a palavra
**crua e a normalizada** — a diferença entre as duas já explicou uma busca que
"não achava nada".

---

## v5.302

**A v5.302: A ORDEM DA FILEIRA, DITADA — e o botão da playlist deixa de ser um
recibo para virar um ESTADO. OTA PURO** (base web, oráculos e docs; sem Release,
`SHELL_VERSION` continua **44**).

Quatro ajustes do operador sobre o lote anterior, e um deles é a correção de um
erro de concepção da v5.301.

**1. A ORDEM AGRUPA POR NATUREZA.** *"Ajuste a ordem dos botões de opções do
cronograma para, da esquerda para a direita: excluir, renomear, favoritar,
adicionar à playlist, subir e descer."*

A anterior era excluir · baixar · favoritar · playlist · renomear · ↑ · ↓ — o
renomear caía entre a playlist e o par de ordem, **separando os dois pares que se
parecem**. A nova põe junto o que mexe no ITEM (excluir, renomear), o que mexe em
ONDE ele está (favoritar, playlist) e o que mexe na POSIÇÃO dele (↑↓). O excluir
continua primeiro pela razão da v5.288 — o mais longe do `⋮`, que é o alvo tocado
repetidamente. O "baixar o vídeo" de uma linha de LINK não está na sequência
porque só existe nela: entra depois da playlist, para não a partir ao meio.

**A MESMA ORDEM NOS FAVORITOS**, *"com a ressalva de não contar com os itens que
não existem naquela lista"*: excluir · renomear · ↑ · ↓. Faltam a ESTRELA (aqui
ela e a lixeira terminam no mesmo `listRemove('favs')`) e o botão da PLAYLIST,
que naquela gaveta é uma LINHA da folha de destinos, com caixa de marcação.

**2. O BOTÃO DA PLAYLIST ERA UM RECIBO, E A PERGUNTA É OUTRA.** *"Faça com que o
estado de adicionado à playlist seja um botão que visualmente responda se aquele
item está ou não na playlist, não apenas a confirmação de 'enviado para
playlist'."*

Ele nasceu na v5.301 como AÇÃO: tocava, respondia com o ✓ do `pulsar` e voltava
ao mesmo desenho. Um segundo depois a linha não dizia mais nada — e a pergunta
que o operador faz montando o culto não é *"eu mandei?"*, é **"está lá?"**. Sem
resposta na linha, conferir custava abrir a fila.

Agora ele é o que a ESTRELA já era: um ALTERNADOR com estado à vista, com a mesma
anatomia, a mesma dupla de cores (`--line` apagado, `--accent` aceso) e a mesma
exceção no fecho da caixa. **O segundo toque TIRA da fila**, e essa é a metade que
faz dele um estado em vez de um contador: um botão que só acende nunca se apaga, e
desfazer exigiria abrir a playlist e procurar a linha lá dentro.

- **A COR NÃO ESTÁ SOZINHA:** o desenho troca `+` por `✓`. Num salão escuro, e
  para quem não separa os dois tons, é o símbolo que responde. SVG inline e nunca
  um glifo — `playlist_add_check` não está no subset de trinta codepoints da
  fonte, e codepoint ausente desenha um retângulo vazio sem erro nenhum.
- **`marcarNaPlaylist` é o irmão do `marcarNoAr`**, e roda na PRIMEIRA linha de
  `renderPlaylist()`: a função volta cedo quando a fila fica vazia, e no fim ela
  não rodaria justamente no caso em que todos os botões precisam apagar. A régua
  é *"todo caminho que REFAZ `plItems`"*, e não "toda escrita na lista": o
  `criarCue` grava direto no banco sem refazer o espelho, mas o que ele grava é
  uma cena de roteiro, e um cue nunca ganha este botão. A fila muda por muitas
  portas e quase nenhuma redesenha a lista — o toque no corpo de uma linha a SUBSTITUI
  (`replacePlaylistWith`), a folha de destinos acrescenta, o "Guardar pacote"
  troca tudo. Sem o repintor, o botão de toda OUTRA linha ficaria dizendo o que
  era verdade antes do último toque, **que é pior que não dizer nada, porque
  agora ele promete um estado**. Ele mora no fim de `renderPlaylist()`, por onde
  todo caminho que escreve em `plItems` passa: a próxima porta já nasce coberta.

**3. O CONFIRMAR DOS FAVORITOS DIVIDE A LINHA COM AS AÇÕES.** *"Ponha o botão de
confirmar as escolhas do play dos favoritos para que ele fique lado a lado, à
esquerda das opções, ajustado com a altura dos botões."*

A faixa era um bloco próprio no pé da gaveta, logo abaixo da linha do confirmar —
duas faixas empilhadas para o que cabe numa, e a gaveta mais alta por isso, num
acordeão cuja regra é manter a decisão sob o dedo. Quem a leva para lá é o hook
**`aoLado`** que a v5.286 abriu para o "Ver a letra": a `.song-menu-go-row` já é
um flex em que o confirmar CRESCE e o irmão fica com o que precisa. **Nenhum
mecanismo novo.**

- **O nó é O MESMO a cada remontagem.** `renderItemMenu` refaz a lista a cada
  marca (`alvo.innerHTML = ''`), e devolver uma faixa NOVA perderia os ouvintes e
  apagaria uma confirmação de exclusão aberta — deixando a lixeira na miniatura
  sem nenhum botão que a explique. Devolvendo o mesmo nó, o `appendChild` o MOVE.
- **E O IRMÃO VEM POR ARGUMENTO, não do global `songMenuFor`** — a correção que
  este lote quase não teve. Ver o bloco abaixo.
- **Uma altura só:** 53px. Os botões traziam `--thumb` fixo (40px) e boiariam no
  meio; `height: auto` desarma o valor fixo e o `stretch` da linha os iguala. A
  LARGURA continua `--thumb` — o pedido era de altura, e estreitar o alvo
  trocaria um acerto por um erro.
- **Enquanto a linha PERGUNTA, o confirmar da folha sai de cena.** Foi o que a
  mudança criou e ninguém pediu: dois botões de confirmar lado a lado dizendo
  coisas opostas — "mande para onde marquei" e "tire da lista". Ele volta inteiro
  no Cancelar, com as marcas onde estavam. E o par Cancelar/Excluir veste a
  receita de altura do botão que substitui (`--hit` mais o padding de um
  `.song-menu-btn`), senão a gaveta encolhe 19px sob o dedo no exato instante em
  que se mira um destrutivo.

**4. O DEFEITO QUE ESTE LOTE QUASE PUBLICOU, e a regra que fica.** A primeira
escrita do item 3 mandava o irmão pelo slot GLOBAL `songMenuFor.aoLado` — que é
como o "Ver a letra" da v5.286 sempre viajou. Uma revisão adversarial do diff, em
Chromium, reproduziu três desfechos, todos por dois caminhos que já existiam no
código:

- a gaveta do acordeão é montada UMA vez (`gavetaMontada`), então REABRIR uma
  linha não reescreve `songMenuFor`;
- `closeSongMenu()` (que o Confirmar chama) ANULA o global com a gaveta ainda
  aberta.

Com isso: **abrir A → abrir B → reabrir A → marcar um destino em A** movia a
faixa de **B** para dentro da gaveta de **A** — a miniatura de A virava lixeira,
o rótulo dizia o nome de A, e quem saía dos Favoritos era **B**. E **confirmar
um destino e marcar outro** apagava a faixa inteira da gaveta aberta, levando
junto uma confirmação de exclusão em curso: a lixeira ficava na miniatura sem
Cancelar nem Excluir — literalmente o desfecho que o comentário do lote citava
como razão de devolver o mesmo nó.

**A regra: um slot global só serve para o que não tem ALVO.** Enquanto o irmão
era uma fábrica de botão descartável, a divergência entre o tempo de vida do
global e o do fecho que o consome era invisível. Um NÓ VIVO ligado a um item
transformou cada divergência em perda de interface ou em destrutivo apontando
para a linha errada. Hoje `destConfirmRow` recebe o irmão por ARGUMENTO, do fecho
de quem desenha; o global ficou só como caminho da Biblioteca, onde ele é fábrica.
Reabrir uma gaveta também reaponta `songMenuFor`, para a invariante que todo
leitor assume — *"ele descreve a gaveta ABERTA"* — voltar a ser verdade.

**A CONSEQUÊNCIA ESTRUTURAL, dita porque quebrou oráculo:** a faixa de ações
passou a ser montada NO PRIMEIRO TOQUE, com o resto da folha — ela é escrita por
`renderItemMenu`, que só roda quando a gaveta abre. Antes existia no DOM desde o
desenho da linha, e três sondas do `boot-nativo` a mediam sem abrir nada. Elas
passaram a percorrer o caminho do operador, que é o que deveriam ter feito desde
sempre: ninguém alcança o ↓ de um favorito sem abrir a linha.

**O que os oráculos passaram a travar:** a sequência inteira da fileira nas duas
listas (afirmada como LISTA, não por posições soltas — o defeito aqui é um botão
que troca de vizinho, e só a sequência o pega); o botão da playlist acendendo,
trocando `+` por `✓`, mudando de rótulo e TIRANDO no segundo toque; o repintor
acompanhando a fila mudada por outra porta, inclusive pelo toque que a substitui;
o confirmar na mesma linha, à esquerda, crescendo, e todos na mesma altura —
medida como IGUALDADE e jamais contra um número escrito no teste; a faixa sendo o
mesmo nó depois de uma remarcação de destino; o confirmar da folha saindo (e
voltando) quando a linha pergunta; e **os dois percursos do item 4** — cada linha
ficando com a faixa DELA depois de abrir outra e voltar (com o nome no botão que
executa provando que o alvo não trocou), e a faixa sobrevivendo a um Confirmar
seguido de outra marca.

**Sobre a espera desses casos:** eles medem GEOMETRIA depois de abrir um acordeão,
e a primeira escrita esperava por relógio — reprovava de vez em quando. Hoje
esperam a própria animação (`getAnimations()`, o mesmo objeto que
`expandAccordion` criou) mais dois quadros. Um `setTimeout` maior só empurra a
corrida para mais longe, e **um oráculo que pisca é pior que um que falta: ele
ensina a ignorá-lo.**

---

## v5.301

**A v5.301: A CONFIRMAÇÃO DE EXCLUIR SAI DO POPUP E VOLTA PARA A LINHA — e a
fileira da gaveta, medida a 360px, já estava cheia. OTA PURO** (base web,
oráculos e docs; sem Release, `SHELL_VERSION` continua **44**).

Seis pedidos do operador num lote só, e o último trouxe junto um defeito de
layout que nenhum oráculo via.

**1. O MODAL TIRAVA O ALVO DE CENA.** *"Remova os popups de confirmar exclusão,
para que todas essas confirmações sejam inseridas direto na UI… no cronograma,
coloque a confirmação na própria gaveta de opções, com um botão de cancelar e
confirmar; durante o processo de exclusão pode trocar o ícone da thumbnail pela
lixeira."*

A pergunta era "excluir este item?" e a tela que a fazia não mostrava mais item
nenhum — o operador confirmava **de memória**, numa lista de trinta linhas com
nomes parecidos. É a mesma correção da v5.207 (*"o feedback mora na interface de
origem"*), aplicada agora à PERGUNTA em vez de à resposta.

`pedirConfirmacaoNaLinha(botao, {ok, dica, aoConfirmar})` é o funil único, e ele
**não conhece nenhuma faixa por nome**: pergunta ao próprio botão quem é o pai
dele. Por isso vale de graça nas três listas — a caixa do `⋮` (Cronograma e fila
da playlist) e a `.fav-acoes` (Favoritos) —, e a próxima que ganhar um excluir já
nasce com a confirmação certa.

- **O par entra no COMEÇO da faixa.** A `.row-acoes` escalona a entrada dos
  botões por `nth-last-child` (v5.269), que conta a partir do FIM: um irmão
  acrescentado depois deles deslocaria o índice de todos, e a animação que o
  operador pediu sairia trocada.
- **A miniatura vira a LIXEIRA** pelo mecanismo que já existia para o "Tirar do
  ar": o conteúdo da capa é escondido por CSS e o desenho novo entra por cima, na
  mesma caixa. Ela é a única parte da linha que a faixa não cobre — logo, a única
  que ainda pode dizer de QUAL item é a pergunta. Vence o `.row-stop` por
  especificidade: uma linha no ar também pode ser excluída.
- **Tudo que fecha a gaveta CANCELA** — o `⋮` outra vez, o toque fora, o
  redesenho da lista, o fechamento da gaveta de um favorito. O erro possível aqui
  é o seguro: perder a pergunta custa um toque, herdar um "sim" pendente não tem
  volta.
- **A frase que o diálogo dizia** ("os arquivos só são apagados se ele não
  estiver em mais nenhuma lista") não cabe nos ~250px da faixa e não sumiu: virou
  o `title`/`aria-label` do botão que executa.
- **O diálogo FICA para o que apaga BYTES** — excluir uma pasta do aparelho ou o
  que foi baixado de um álbum. A régua: o modal é para o destrutivo que precisa
  dizer QUANTOS bytes saem; sair de uma lista se confirma onde a lista está.
- **O excluir passou a NÃO FECHAR a caixa**, e com ele a lista de exceções virou
  `ACOES_QUE_NAO_FECHAM` — uma constante nomeada com a razão de cada entrada, em
  vez de uma cadeia de `||` dentro do `if`. Eram duas (↑↓ e a estrela); são
  quatro.

**2. E A FILEIRA JÁ ESTAVA CHEIA — 222,4px em 222px.** *"Nas opções dos itens do
cronograma, especificamente na gaveta de opções, adicione o botão de 'Adicionar a
playlist'."*

O botão é fácil; o que ele revelou não. A caixa do `⋮` é um retângulo FIXO — a
largura da tela menos duas colunas de 56px —, e os cinco botões que a v5.288
deixou lá ocupam **222,4px** em qualquer aparelho. Com o sexto a fileira passa a
**268px**, e a caixa fixa dava isto, medido por largura de viewport:

| viewport | caixa | com 6 botões |
|---|---|---|
| 360px | 222,4px | avança **37,6px** sobre a capa |
| 384px | 246,4px | avança 13,6px |
| 393px | 255,4px | avança 4,6px |
| 400px | 262,4px | não toca (sobram 2,4px) |
| 412px | 274,4px | não toca (a folga de 8px de sempre) |

**Abaixo de ~400px a fileira não cabia**, e como `.row-btn` é `flex-shrink: 0` o
excedente era desenhado **por cima da miniatura**. Acima disso nada aparece — e é
exatamente essa a armadilha: **os quatro oráculos de Chromium medem a 430px**,
onde cabia, então o defeito publicaria VERDE. Também não é caso de aparelho
antigo: 360px e 384px são larguras correntes de Android, e qualquer aparelho cai
nelas quando o operador aumenta o **tamanho da tela** nas configurações do
sistema.

A caixa passou a **abraçar o conteúdo, entre um piso e um teto**: o `left` virou
`min-width` (a largura de sempre, para um grupo curto continuar cobrindo o título
inteiro — sem ele, metade do nome apareceria à esquerda dos botões, com uma borda
dura no meio da linha) e ela cresce só para a esquerda e só o que precisa, até
`.5rem` da borda do cartão. Do SÉTIMO botão em diante os quadrados caem para
`--hit` (34px), que é o piso de toque deste app e nunca menos — o sétimo é a
linha de LINK DO YOUTUBE, a única que traz o "baixar o vídeo". O escalonamento da
entrada, que ia só até o quinto, foi até o sétimo: sem isso os dois mais à
esquerda (o excluir entre eles) chegavam ANTES dos vizinhos da direita.

O botão em si ACRESCENTA à fila — quem SUBSTITUI é o toque no corpo da linha —, e
**não aparece numa cena de roteiro**: o `onTap` já desvia um cue para longe da
playlist (*"um versículo não é uma fila de reprodução"*), e o Cronograma é
justamente a lista cheia de cues. Ele também não fecha a caixa: a resposta dele é
o ✓ de `responder()` no próprio botão, e `pulsar` pintaria um nó que a caixa
fechada (`visibility: hidden`) já tirou da tela.

**3. A LINHA CONTINUAVA VERMELHA DEPOIS DO FIM DA MÍDIA.** *"Ao encerrar a mídia
no player, a demarcação em vermelho do próprio item no cronograma não desaparece,
parecendo que o item ainda está no ar."*

`resetAfterEnd` zerava `midiaNoAr` e **não repintava a lista**. Era o único dos
caminhos que baixam a bandeira sem chamar `marcarNoAr` — `stopClear` e
`retirarDoAr` sempre chamaram, e `pararMidia` é o corpo dos dois. O estado estava
certo e a tela mentia, o que para quem opera é indistinguível do defeito inteiro.

**Só `marcarNoAr`, e isto é a metade que importa da correção.** `renderNowPlaying`
termina em `seekEl.disabled = !isTimed`, com `isTimed` saindo de um `cur` que pode
ser nulo (item fora das duas listas): chamá-lo aqui desfaria a linha logo acima,
que devolve a barra de propósito para o ▶ poder repetir a faixa.

**4. O CONFIRMAR ERA 17px MAIS BAIXO QUE OS VIZINHOS.** *"Verifique a altura do
botão de confirmar que temos em toda a biblioteca nas opções de play, ele parece
menor que o padrão dos seus botões vizinhos."*

Estava — 36px contra 53px —, e por OMISSÃO. Quem dita a altura de uma linha de
opção não é o `padding` do `.song-menu-btn` (o mesmo para todas), é o
`.song-menu-check`, que reserva `--hit`. O confirmar não tem check (não há o que
marcar nele) nem ícone, então sobrava só a linha de texto. A correção é o MESMO
número dito no mesmo lugar: o conteúdo dele reserva `--hit`. Não um `min-height`
na caixa, que teria de somar o padding à mão e envelheceria junto com ele.

**5. RENOMEAR CHEGOU AOS FAVORITOS.** *"Adicione o botão de renomear nas opções
dos itens individuais dos favoritos."* Ele existia só na linha do Cronograma
(v5.288), e o favorito é onde o nome importa mais: a lista é a que o operador
MONTA para reencontrar coisas, e um arquivo importado chega com o nome que o
aparelho deu a ele. Entra pela mesma porta do excluir — DENTRO do `lista ?`, não
ao lado dele —, e é essa guarda que o mantém fora da pasta do aparelho, onde o
nome vem do arquivo e um nome só no registro seria desfeito na varredura
seguinte.

**6. E A FILA TINHA UMA LIXEIRA SÓ DELA.** *"Na playlist, ajuste o botão de
excluir para que represente o mesmo ícone de excluir que já usamos no resto do
sistema."* Era `playlist_remove`, o único destrutivo do app desenhado por um
símbolo próprio: o mesmo gesto com dois desenhos conforme a lista em que a linha
por acaso morava. Com o ícone veio a confirmação, pela régua que o excluir da
linha já segue — um mesmo desenho com dois alcances conforme a tela é a pior
forma de oferecer um destrutivo. O que NÃO mudou é a semântica: sair da FILA não
é sair de uma lista de acervo, então ali não há `retirarDoAr` (o item pode estar
no Cronograma e seguir projetando, e a linha de lá o explica) nem `soltarAvulso`
— a fila não é detentora de bytes. `ICON.plRemove` saiu da tabela com o último
chamador, que é o contrato escrito nela.

**A LIÇÃO QUE FICA: um oráculo que mede numa só largura não mede layout.** O
excedente da fileira existia abaixo de ~400px — e era invisível nos 430px em que
os quatro oráculos rodam, e também no aparelho do operador, que é mais largo que
o limiar. `smoke.mjs`
passou a redimensionar para 360px e afirmar a SOMA dos botões contra a largura da
caixa, e não um número de pixel escrito no teste: assim ele continua valendo no
dia em que um botão a mais entrar na fileira, que é exatamente quando precisa
valer.

**O que os oráculos passaram a travar:** a pergunta na faixa e a lixeira na
miniatura, com a metade negativa junto (o primeiro toque não tira nada e o
Cancelar devolve a fileira — sem ela, uma confirmação de enfeite sobre uma
exclusão imediata passaria); o renomear na faixa dos Favoritos, nas duas metades
(banco e tela); a fileira que cabe a 360px, o piso de toque de cada quadrado e a
caixa que não invade a coluna do `⋮`; o "à playlist" que acrescenta sem
substituir, não aparece num cue e não fecha a caixa; a lixeira da fila comparada
por CODEPOINT com a das outras listas (nunca contra um literal no teste); a marca
vermelha que sai da linha quando a mídia acaba, com a barra de progresso
continuando habilitada; e a IGUALDADE das alturas na folha de destinos — jamais
um piso em pixel, que aprovaria os dois errados juntos no dia em que `--hit`
mudar.

---

## v5.298 (APK v2.3)

**A v5.298 (v2.3): A REVISÃO PROFUNDA — uma seção inteira do doc de arquitetura
descrevia um player apagado, e o `espelhoEstado` publicava seis medições que
ninguém produzia. METADE OTA, METADE APK** (`SHELL_VERSION` **44**).

Uma varredura do repositório inteiro pedida pelo operador: *"revisando o código
por completo, atualizando a documentação dele que deve estar desatualizada…
pode buscar otimizações, código morto, falhas de padrões ou problemas de
conceito"*.

**O MÉTODO, porque ele é o que se repete da próxima vez.** Cada identificador
citado entre crases — no CLAUDE.md, nos docs e nos COMENTÁRIOS do código — foi
confrontado com a existência dele no projeto, e cada achado foi lido para
separar **lápide** (passado, valiosa, é a disciplina desta base) de **defeito**
(presente, descreve mecanismo que não existe). São 1.331 identificadores no
CLAUDE.md, 1.461 no doc de arquitetura e 145 nos comentários.

**O que a varredura ABSOLVEU, e vale registrar tanto quanto o resto:** a ponte
é simétrica (48 `@JavascriptInterface` × 48 chamadas em `native.js`, nenhum
método sem chamador dos dois lados), os 43 métodos do `AVNative` batem com o
doc, o CSS **não tem uma classe morta** (o primeiro scan acusou 33 e estava
contando nomes dentro dos comentários-lápide — o falso positivo é a prova de
que as lápides funcionam), `eslint --rule no-undef` sobre a base inteira
devolve ZERO erros, o Kotlin não tem função morta, e a seção NORMATIVA do
CLAUDE.md não tem um único identificador obsoleto: os 66 achados dele estão
todos dentro das notas de versão, onde descrever o que saiu é o trabalho.

---

#### A metade APK: o PRODUTOR QUE SOBREVIVEU AO CONSUMIDOR (shell 44)

`EspelhoServidor.relatoDe` lia seis campos que nenhum produtor emite desde a
v5.187 — `seguro`, `mse`, `mms`, `fetchStream`, `videoDecoder`, `wakeLock`.
Eram o autorrelato de CAPACIDADE que o `espelho/cliente.js` mandava no
`POST /par` na era dos pixels ("esta tela tem MSE? aceita `fetch` em stream?
tem `VideoDecoder`?"); aquele arquivo foi apagado com o espelho inteiro, e o
`espelho/tela.js` que o substituiu manda `{ua, w, h}` e mais nada.

**E eles não sumiam: viravam `false`.** `optBoolean` lê campo ausente como
`false`, que é um valor LEGÍTIMO — a armadilha exata que o degrau 40 nomeou —,
então `relatoJson` publicava seis negativas sobre TODA tela conectada, a cada
leitura do estado, com a folha aberta a cada 2,5 s. O CONSUMIDOR delas saiu na
v5.206: era ele que imprimia `tela A · MSE:nao · fetch-stream:nao · seguro:nao
· wakeLock:nao` sobre a única tela que estava funcionando. O produtor ficou
dezesseis versões.

**Por que isto é um degrau e merece uma Release SEM ter sintoma:** não há
defeito visível hoje — ninguém lê aqueles campos —, e é justamente por isso. O
que sobra de um produtor sem consumidor não é ruído inofensivo: é uma leitura
que já vem preenchida, com valor plausível, para quem repuser o consumidor
amanhã. A v5.206 escreveu a regra pela metade ("apagar o produtor e deixar o
consumidor produz um zero"); a outra metade é esta — **apagar o consumidor e
deixar o produtor produz uma medição falsa esperando um leitor**. Remoção de
recurso é remoção dos dois lados do fio, no mesmo lote.

O que encolhe: `EspelhoPares.Relato` (de dez campos para quatro), o `relatoDe`
que o preenche e o `relatoJson` que o publica. **`sanear(Relato)` não mudou uma
linha** — ele já só tocava nos quatro que ficam, o que é a confirmação de que os
seis não valiam nada desde a v5.187. O `EspelhoParesTest` acompanhou. Um bundle
antigo num shell 44 lê `undefined` nos seis (e o único ponto que os desenhava
saiu na v5.206); um bundle novo num shell 43 os recebe e ignora.

---

#### A metade OTA: a documentação que descrevia mecanismos apagados

- **`docs/ARQUITETURA-WEB.md` tinha uma seção INTEIRA — "### YouTube (IFrame
  Player API oficial)", 95 linhas — escrita no presente sobre o player que a
  v5.212 apagou.** `loadYtApi`, `ytApiPromise`, `YT.Player`, `playerVars`,
  `createYtHost`, `ytKillCaptions` com `unloadModule`, o escudo anti-UI e o
  vigia `ytWatchResume`: cada nome ali manda o leitor procurar um símbolo que
  não existe. Mais a **lista de dependências** do topo, que ainda dizia "duas
  exceções" e contava a IFrame API como VIVA — contradizendo o CLAUDE.md e o
  código, que têm uma só (o renderizador de `.pptx`). Ela foi substituída pelo
  que sobrevive: por que o embed saiu (a ponte COMPLETA exposta a script de
  terceiro na preview do Controle — `addJavascriptInterface` injeta em todas as
  frames, e a invariante 9 protegia a metade errada), o que saiu junto, quem
  toca YouTube hoje, e a lição de método das v5.75–v5.77.
- **`MainActivity.kt` descrevia o espelho de PIXELS no presente em treze
  pontos**, e o pior deles era um comentário ÓRFÃO: "A JANELA DO ESPELHO
  RENASCE COM A ACTIVITY… o gatilho é a existência da tela virtual" em cima do
  pedido de permissão de notificação, que não tem nada a ver com ele — a
  chamada que ele explicava (`EspelhoDisplay.sincronizarJanela`) saiu na v5.187
  e o parágrafo ficou. Junto: o KDoc do `startMirror` prometendo a ordem "rede
  → servidor → **tela/encoder** → …" e "nenhum cliente vê nada antes do
  primeiro IDR"; o passo 2 dizendo que "`pedirIdr` fecha o ciclo com o
  encoder"; o `stopMirror` explicando-se por um `EspelhoDisplay.desligar()`; o
  `aoEsquentar` justificando "cai bitrate, nunca resolução" por uma densidade
  de tela virtual; e o `telasExternas` inteiro argumentando com um
  `VirtualDisplay` que este aparelho não cria mais.

  **E uma dessas correções mudou uma REGRA deste documento, não só a redação.**
  A razão escrita para os métodos do espelho rodarem na MAIN THREAD era de
  framework — "uma `Presentation` é um `Dialog`, e um `Dialog` criado na fila
  de IO lança `Looper.prepare()`". Não há mais `Presentation` nenhuma ali. O
  que sustenta a regra hoje são outras duas coisas, e a primeira continua
  valendo inteira: **ficar FORA da fila de IO** (senão "ligar a transmissão" no
  meio de um download vence pelo prazo de 60 s do `native.js` e resolve `null`,
  um erro sem causa) e a serialização de `espelhoSrv`/`espelhoMidia`.
- **`display.js` explicava o mudo inicial por um handshake inexistente:**
  "enquanto o grafo de Web Audio não estiver de pé E o encoder do lado Kotlin
  não tiver confirmado… quem libera é `espelhoAudioIniciar()`, e só depois do
  `{"ok":true}`". Os três saíram na v5.187. A razão que RESTA é suficiente
  sozinha e é a que ficou escrita: o som é **opt-in por tela** — não é o app
  que decide o volume da sala em que aquela tela está.
- **`controle.js`, três:** um comentário afirmando que a gaveta `#favPopup`
  "continua existindo" e citando `openFolder`/`openOpfsFolder` (os três saíram
  entre a v5.254 e a v5.294 — é a v5.295 outra vez, no mesmo arquivo que ela
  varreu); uma citação a um `telaReenviarWallpaper` que se chama
  `telaReenviarPreferencias`; e a justificativa do fechamento por
  `pointerdown` em fase de captura, que argumentava com a ALÇA de arrastar
  removida na v5.285 — a propriedade que a alça apenas exemplificava (um gesto
  que não termina em `click` fecha o menu do mesmo jeito) ficou no lugar dela.

**CÓDIGO MORTO REMOVIDO**, e o primeiro tem uma lição própria:

- **`adicionarNaLista`** — a "forma de UM destino", cujo comentário dizia ser
  "o que a maior parte do app ainda usa" **sem um único chamador**. Quem a
  mantinha viva era o `tools/destinos.test.mjs`, montando o fixture por ela: um
  oráculo que exercita um caminho que o app não percorre não é rede de
  segurança, é uma segunda API mantida por engano. Ele passou a chamar
  `adicionarNasListas`, que é a porta que os dois chamadores reais usam.
- **`refreshOpfsFolderCount`** — zero referências; quem mantém a contagem de
  uma pasta é o `syncDeviceFolder`, no mesmo ponto em que grava o catálogo.
- **`.fade-row--col`** (CSS) — metade de um par cujo irmão `--fit` é o único
  que o HTML escreve.

**E os números que o próprio documento manda medir estavam velhos:** "vinte e
cinco arquivos Kotlin" são **vinte e seis**, e o placar do CI foi fixado como
`N/M` (os dois contados pelo workflow) em vez de `N/12`, que era verdade
quando o parágrafo foi escrito e são treze hoje.

Os 19 oráculos passam, e a remoção de código morto foi verificada por
ISOLAMENTO (com o defeito injetado, o `destinos.test.mjs` reprova em 3). O
Kotlin **não foi compilado** aqui (o ambiente não tem o SDK do Android): o diff
dele são dezoito remoções e uma constante, e quem o compila é o CI.

*(Ela nasceu como v5.296+v5.297 e foi renumerada no merge: uma sessão paralela
publicou outra v5.296 e outra v5.297 em `main` enquanto esta rodava. Os lotes
não se tocam — o de lá é cor e superfície da Biblioteca, o daqui é documentação
e a forma do `espelhoEstado` —, e a suíte inteira foi rodada depois de juntos.)*

---

## v5.297

**A v5.297: NÃO HAVIA COR DE TEXTO QUE RESOLVESSE — o defeito era a
SUPERFÍCIE, e a Biblioteca inteira estava em MAIÚSCULAS. OTA PURO** (CSS,
tokens e oráculo; sem Release).

Relato do operador depois da v5.296, com prints: *"não melhorou a leitura"*.
Ele estava certo, e o lote anterior tinha consertado metade de um vazamento e
tratado o sintoma errado do outro.

**1. A LINHA DE CONTEÚDO SE AFASTA DO TEXTO.** A faixa vestia `--surface`, e
recesso é uma regra sobre PROFUNDIDADE: no escuro ela afasta do texto claro,
no CLARO ela empurra na direção dele. Medido, o fundo compunha
rgb(182,187,194) — **~50% de luminância, o meio-tom exato**, que é o pior caso
para os dois lados: `--text` dava 4,59:1 (passava AA e não se lia) e o branco
que o operador pediu daria **1,93:1**. Não havia cor de texto que resolvesse.

`--item-fill` é a regra escrita como token, com um valor por tema: no escuro
segue o de sempre (nada muda), no claro a linha SOBE até quase o branco — que
é o que uma lista de conteúdo faz em toda UI clara, com o cinza do card
aparecendo entre as linhas. Medido depois: **8,32:1** com o texto e 1,32:1 de
separação contra o card (piso 1,28).

**A aritmética não deixava escolha, e é ela que também derrubou a gaveta.** A
linha precisa de 1,28:1 contra o card, o que a força a ~0,91 de luminância —
isto é, quase branco, não um meio-termo. E a gaveta de opções (v5.287), que
tinha SUBIDO para o branco porque a vizinha era escura, ficou a **1,07:1**
dela: o relato daquele lote reaberto pela porta oposta. Ela desce para um
cinza de verdade (os dois pares que ela precisa satisfazer — contra a linha e
contra o card — deixam L ≤ 0,53), e os botões dela sobem para o branco. **O
oráculo da v5.287 pegou isso no mesmo commit**, que é a única razão de este
lote não ter trocado um relato por outro.

**2. E O QUE O OPERADOR DE FATO VIA: a Biblioteca INTEIRA em MAIÚSCULAS.** O
vazamento da v5.296 era de `color`, e ela desceu só a cor, com o preço
declarado na própria nota. `text-transform: uppercase` e `letter-spacing`
herdam do mesmo bloco e **ninguém os reescreve lá dentro** — caixa alta a 13px
é mais lenta de ler e mais larga, e era ela que truncava
"001. SANTO, SANTO, SANTO! (CANTAD…" numa linha que cabia. A regra do rótulo
foi INTEIRA para a `.coll-group-bar`, que é a peça que ela sempre descreveu.
`font-size` e `font-weight` vêm junto porque a regra é uma só; quem muda de
verdade é o nome de um favorito (`.row-name` não declara peso), que volta ao
400 das outras listas do app.

**A lição, e ela é maior que este arquivo:** *declarar o preço de uma correção
pela metade não é o mesmo que pagá-lo.* A v5.296 nomeou este vazamento no
comentário e o deixou de pé por não ter sido pedido — e ele era metade do que
o operador estava vendo.

**O oráculo ganhou a REGRA, não um valor:** a linha que carrega o texto
contrasta com ele MAIS que o contêiner dela. Ela vale nos dois temas sem um
`if` de tema, e um recesso de volta a reprova no claro e passa no escuro — que
é exatamente a assimetria do defeito. Verificado por ISOLAMENTO, peça a peça:
o recesso de volta reprova **2**, o vazamento de tipografia **2**, a gaveta
branca **1**.

---

## v5.296

**A v5.296: O NOME DA FAIXA SAÍA NA COR DE UM CABEÇALHO — e no tema claro
isso reprovava AA. OTA PURO** (só CSS e o oráculo; sem Release).

Relato do operador: *"verifique a cor do texto dos itens dentro do álbum na
biblioteca, pois no tema claro, o fundo dos cards está escuro mas acredito que
nesse caso o texto deve ser claro, para ter o contraste ideal"*.

**MEDIDO antes de mexer, no tema CLARO: 3,45:1.** O nome de uma faixa dentro
de um álbum saía em `--muted` (#565d66) sobre o recesso da própria faixa
(rgb(182,187,194)), a 13,12px — abaixo do piso de 4,5:1 para texto pequeno. No
ESCURO o mesmo par dá 6,46:1, e é por isso que a queixa é de um tema só.

**A causa é HERANÇA, e é a família da v5.274 por outra porta.** `.coll-group`
é a regra do RÓTULO da seção — uma linha curta, em caixa alta, `--muted` — e
desde que a seção virou o BLOCO que contém a barra e o corpo (v5.237) ela é o
CONTÊINER de tudo o que a Biblioteca desenha. `color` herda: o `--muted` de um
cabeçalho pintava o nome de toda faixa, de todo favorito e de toda pasta lá
dentro. Era **o único lugar do app em que uma linha de lista não é `--text`**,
e era invisível justamente por isso — não havia uma declaração errada a achar,
havia uma declaração certa no elemento errado. A cor desce para a
`.coll-group-bar`, que é a peça que ela sempre descreveu, e o corpo volta a
herdar o `--text` da folha como qualquer outra lista.

**E O REMÉDIO PEDIDO SERIA PIOR, MEDIDO.** O fundo não é escuro: é um
MEIO-TOM (~50% de luminância, o pior caso para os dois lados). Branco sobre
ele dá **1,93:1**, contra os **4,59:1** que o `--text` devolve. A percepção do
operador estava certa — aquele texto não se lê —, e a leitura de que o fundo é
escuro é o que a medição corrige: quem clareia aqui é o texto do tema, não uma
exceção. É o oposto da v5.268, em que a superfície é que saía da escada.

**O ORÁCULO ENTROU ONDE O BURACO ESTAVA.** Os casos da escada de camadas
(v5.241/v5.267) mediam os FUNDOS da Biblioteca nos dois temas, e a escada
estava — e continua — correta; **nenhum deles olhava para a COR DO TEXTO**, e
foi por aí que isto atravessou. Agora eles medem o par, com o fundo COMPOSTO
(a faixa é um overlay: `backgroundColor` devolve o alfa, e comparar o texto
com um preto a 14% diria a mesma coisa com o defeito no lugar). A metade
negativa é o que impede a correção de virar "tudo virou `--text`": o rótulo da
seção continua com cor própria.

Verificado por ISOLAMENTO: devolvendo a cor ao bloco, **3** asserções
reprovam — e a do tema claro imprime o 3,45:1 do relato.

**O QUE NÃO FOI MEXIDO, e está dito em vez de escondido:** a mesma regra
vaza `letter-spacing` e `text-transform: uppercase` para o corpo, e ninguém os
reescreve — o título do álbum e o nome da faixa são desenhados em MAIÚSCULAS
por causa dela. Mexer nisso muda a aparência de toda a Biblioteca, que não é o
que foi pedido. E o SUBTÍTULO de uma linha de favorito (`--muted` explícito,
10,88px) continua em **3,45:1** sobre o mesmo recesso, pelo mesmo motivo
estrutural: `--muted` foi calibrado contra `--panel` (6,66:1) e `--panel-2`
(4,73:1), nunca contra um recesso DENTRO do painel-2, que é a superfície mais
funda da Biblioteca.

---

## v5.295

**A v5.295: OS COMENTÁRIOS QUE DESCREVIAM A GAVETA COMO SE ELA EXISTISSE.
OTA PURO** (nenhuma linha de código; sem Release).

A faxina da v5.294 removeu a gaveta `#favPopup` e deixou de pé quatro
comentários que continuavam falando dela **no presente**: o bloco do
`index.html` que explicava que *"o `activeTab` CONTINUA sendo `'folders'`
enquanto ela está aberta"* e mandava ver `listHost()`, a nota do
`renderListTitle` que apontava para um `renderFavHeader` que não existe mais,
e a lápide do `openOpfsFolder` que remetia a outra lápide (`openFavorites`)
que também tinha saído. Mais os carimbos de versão: as lápides diziam v5.293,
e a faxina saiu na v5.294 — o número de um lote que fez outra coisa.

**Isto é um defeito pela régua deste projeto, e é a mesma da v5.212:** um
comentário que contradiz o código não é ruído, é uma armadilha — ele descreve
um mecanismo plausível, e quem o ler depois vai procurar (ou reintroduzir) o
que ele promete. Aqui o preço seria concreto: o do `index.html` manda ler uma
função apagada para entender onde a lista é desenhada.

**E o lote é um NÚMERO NOVO, não um republicar do 5.294**, de propósito. O
zip do canal OTA é **imutável por versão** desde a v5.234 — foi essa
imutabilidade que fechou a classe inteira de "o manifesto fala de um zip com
outro `sha256` e o OTA fica inerte". Reescrever `web-5.294.zip` no lugar
reabriria exatamente essa janela para um aparelho que tivesse lido o manifesto
anterior. Um número novo custa uma pergunta a mais na tela; o outro caminho
custa a classe de defeito de volta.

---

## v5.294 (APK v2.2)

**A v5.294 (v2.2): A ABA `folders` SAI POR INTEIRO, e a fila de IO da ponte
vira TRÊS. METADE OTA, METADE APK** (a fila é Kotlin — sem a Release ela não
chega ao aparelho).

Os dois lotes que o operador escolheu depois da revisão profunda. Eles não se
tocam, e vieram juntos por serem os dois que sobraram dela.

**1. A FAXINA DA ABA `folders`.** A v5.290 fez a pasta do aparelho abrir
INLINE, dentro da linha, e com isso a gaveta de tela cheia (`#favPopup`) ficou
**sem porta**: `openFavorites` deixou de ter chamador e `currentFolder` nunca
mais recebeu um valor não-nulo — as únicas atribuições que sobraram eram
`= null`. A nota da v5.290 declarou isso e deixou o subsistema de pé, com o
argumento (correto) de que a faxina merecia a própria passada de verificação.
Esta é ela.

Saíram ~170 linhas: o popup `#favPopup` e o `#favList` do documento,
`renderFavHeader`, `garantirGaveta`, `openFavorites`, `closeFavorites`,
`favVoltarPara`, `folderQuery`, `currentFolder`, `listHost()` (as duas casas
viraram uma — `libraryEl`), o `hostSelbar` de duas casas, a entrada da tabela
`POPUPS`, o degrau 1.5 da escada do voltar, e **todos** os ramos de
`activeTab === 'folders'` espalhados por `load`, `renderLibrary`,
`renderTabs`, `scrollKey`, `deleteSelected`, `navigateBack`, `switchTab`,
`temImport` e `addSongToDestinos`. `TAB_ORDER` ficou com três abas, que é o
que o carrossel já percorria.

**O PREÇO ESTÁ DITO, e o operador o aceitou explicitamente:** com a gaveta vão
embora a **busca DENTRO de uma pasta** (`#libSearch` — e ela não tem
substituto, porque a barra da Biblioteca varre `allCollections()`, que não
alcança o catálogo de pastas) e a **seleção múltipla** dentro de uma pasta,
que era onde morava o excluir de ARQUIVO FÍSICO por item. A segunda é menos
perda do que parece: um arquivo apagado de uma pasta sincronizada volta na
varredura seguinte, e quem apaga de verdade é o "Excluir pasta e arquivos
sincronizados" da própria linha.

**E O ORÁCULO FINGIA O ESTADO IMPOSSÍVEL.** O caso do renomear escrevia
`activeTab = 'folders'` e um `currentFolder` à mão para provar que o lápis não
entra na pasta do aparelho — isto é, media o comportamento de um app que não
existe desde a v5.290. Ele passou a abrir a pasta INLINE, como o operador
abre, com fixture PRÓPRIO (`pg6` nasce depois dos casos da pasta, e depender do
que outra página deixou no banco fazia a asserção medir **zero linha**, que é
uma lista vazia passando por "não achei o lápis"). Verificado por ISOLAMENTO:
pondo um `botaoRenomearDaLinha` incondicional no `linhaDeItem`, a asserção
reprova. A asserção da gaveta mudou de pergunta junto — onde ela exigia "a
gaveta continua desenhando a dela", ela passou a exigir que **não sobrou nó
nenhum** do subsistema no documento, que é a forma forte da mesma pergunta.

**2. A FILA DE IO DA PONTE VIRA TRÊS** (`NativeBridge`). Ela era
`newSingleThreadExecutor`, e é dela que saem o download do YouTube (minutos),
o download do APK (minutos), a busca no YouTube, as playlists de um canal, o
manifesto da transmissão, a rasterização de um PDF **e** `listFolder`,
`otaPending`, `otaDiag`, `atualizacaoEstado`, `apkProcurar`.

Uma thread só para tudo isso significa que, com um vídeo de 300 MB baixando,
**toda a outra metade da ponte vence pelo prazo**: o `native.js` desiste em
60 s (`CALL_TIMEOUT_MS`) e resolve `null`. Nenhuma delas ERRA — todas mentem
baixinho: `otaPending` diz que não há atualização, `atualizacaoEstado` não
responde nada, e o pior, `listFolder` devolve lista vazia, que o `controle.js`
lê como *"a pasta sumiu do aparelho"*. É o modo de falhar que este projeto
mais teme, num lugar onde ninguém tinha olhado.

As três, e a divisão é por ORDEM DE GRANDEZA do trabalho:

| fila | o quê | duração |
|---|---|---|
| `av-bridge-io` | `version.json`, estado do OTA, `listFolder` | milissegundos |
| `av-bridge-transf` | download do YouTube, download do APK, `ytDiscard` | minutos |
| `av-bridge-extr` | busca, playlists, manifesto, `deckPages` | segundos |

**Cada uma continua sendo UMA THREAD, e isso é invariante e não economia.** O
resgate de download do `YoutubeGrab` é um slot ÚNICO e o mapa de parciais supõe
**um download por vez** — dois comentários daquele arquivo citam a fila única
da ponte como a garantia disso, e é por isso que `ytDiscard` mora na fila da
transferência: ele mexe nesse mesmo estado, e fora dali poderia apagar o
parcial de um download em curso. As extrações são serializadas entre si pela
mesma razão prática: elas dividem a inicialização global do NewPipe.

**E `garantirInit` virou `@Synchronized`.** O par "testa `pronto`, então
inicializa" não é atômico, e agora há DUAS threads que podem chegar ali ao
mesmo tempo — a da transferência e a da extração. `NewPipe.init` duas vezes
provavelmente não faria mal; "provavelmente" não é o que se quer de uma
inicialização global.

**O que NÃO colide, conferido campo a campo:** `diagnostico` é escrito só pelo
caminho do download e `diagnosticoStream` só pelo do manifesto (é justamente
por isso que eles são dois campos); `adaptativoBloqueadoEm`, `baixandoLink`,
`cancelarLink`, `resgate` e `parciais` vivem inteiros no caminho do download;
os registros de token do `StreamProxy` já são `ConcurrentHashMap`; e o
`NpDownloader` é sem estado. `ytCancel` continua **fora de fila nenhuma**, pelo
motivo de sempre — a fila que ele quer parar é justamente a que está ocupada.

`SHELL_VERSION` **não sobe**: nenhum método da ponte nasceu, saiu ou mudou de
assinatura, e nenhum retorno mudou de forma. O que muda é quando eles
respondem.

---

## v5.293

**A v5.293: A REVISÃO PROFUNDA — doze defeitos, e dois deles tinham derrubado
um recurso inteiro em silêncio. METADE OTA, METADE APK** (as duas correções
Kotlin exigem uma Release; as dez de base web chegam sozinhas e não dependem
delas).

Uma varredura do repositório inteiro pedida pelo operador — *"bugs, código
morto, otimizações e padronizações… e a questão funcional por falhas de
conceito"*, com o aviso que governou o método: **confie no código, não na
documentação**. E foi literal: três dos achados abaixo são comentários que
descrevem um mecanismo que o código não tem mais.

**OS DOIS QUE APAGARAM UM RECURSO, e os dois pelo mesmo modo de falhar:** o
app continuava respondendo, nada errava alto, e o que sumiu foi um caminho
que não se usa todo dia.

- **`ReferenceError` mudo em TODO toque numa linha do Cronograma.** A v5.287
  tirou o parâmetro `semSelecao` de `attachRowGestures` e deixou o
  `if (semSelecao) return` no corpo. Num script clássico, LER um identificador
  não declarado lança — só a atribuição criaria uma global. O `pointerdown`
  estourava ANTES de armar o `setTimeout`, e com ele foram embora o toque
  longo, a **seleção múltipla** e o `deleteSelected`, que é o único excluir em
  lote do app. O toque CURTO continuava projetando (o `pid` já tinha sido
  escrito na linha acima), então nada na tela mudava. Medido em Chromium:
  `Uncaught ReferenceError: semSelecao is not defined`, `selectionMode` nunca
  liga. **`eslint --rule no-undef` sobre a base inteira devolve exatamente UM
  erro**, e era este — vale como portão barato para a próxima vez.
- **A gaveta `⋮` da FILA DA PLAYLIST nunca ficava visível.** As três regras que
  revelam a faixa eram `.lib-item.acoes-abertas …`, e a linha da fila é
  `.row-item`. Como a v5.285 tirou o arrasto e moveu o "Tirar da playlist" e o
  par ↑↓ para DENTRO dessa faixa, a fila do culto ficou sem como ser editada
  nem reordenada: o `⋮` respondia (a classe entrava no `li`) e nada aparecia.
  Medido: `visibility: hidden` e o `elementFromPoint` no meio da faixa
  devolvendo o TÍTULO da linha. **Quem revela a gaveta passa a ser a CLASSE,
  não a lista em que a linha por acaso mora** — assim a próxima lista que
  ganhar a gaveta já nasce funcionando, que é exatamente o que faltou aqui.

**A CAMADA DE TEXTO, em três frentes.** (1) `cenaDeRoteiroNoAr()` testava a
EXISTÊNCIA da sessão, e os quatro `hide*` existem justamente para tirar da tela
SEM matá-la: depois de "Tirar do telão" a linha da cena seguia com o selo
"● No ar" e o toque nela caía em `retirarDoAr` — reprojetar custava dois
toques, e o primeiro não fazia nada visível. (2) Cada projetor limpava as
outras camadas à mão e a conta não fechava: **ninguém limpava a letra avulsa**,
e como `lyricProjecting()` tem precedência no `slideTarget` e no
`renderNowPlaying`, uma `lyricSession` órfã sequestrava ⏮/⏭ e o título da
notificação de mídia. Agora há `soUmProvedorDeTexto(quem)`: cinco listas
mantidas à mão eram cinco lugares para a sexta camada ser esquecida. (3) **A
cortina do wallpaper ENGOLIA o cartão** — o stage reavalia a cortina em três
pontos que não sabiam dele (o fim natural da mídia, o `play()` e o fim de um
`load`), e o wallpaper está ACIMA do texto. O caso é o que a independência
áudio × texto existe para permitir: um louvor de fundo com a contagem
regressiva por cima. A música acabava e o cronômetro sumia, com `textActive`
ainda true e a lista ainda dizendo "● No ar". O remendo que existia era
pontual; agora o stage tem `setOverlay`, declarado por quem põe o cartão no ar.

**E o resto, em uma linha cada:**

- **`mse.js`**: o seek do `startAt` era DESCARTADO quando o índice da faixa
  ainda não tinha chegado (`aoBuscar` começa com `if (!f.segs) return`, e o
  `loadedmetadata` da MSE dispara com o áudio ainda sem `segs`). O vídeo
  reposicionava e o áudio baixava do segundo ZERO — a projeção ficava parada
  até ele percorrer o trecho inteiro. Morde no caminho mais caro que existe: a
  reconexão do telão e a aplicação de um OTA com a cena no ar.
- **`stage.js`**: parar um ÁUDIO SEM LETRA cortava o som no talo. A rampa de
  volume vivia dentro da animação da cortina, e para esse tipo a cortina já
  está fechada o tempo todo (`semVisual`) — `coverIn` devolvia na hora e o
  `clear()` cortava. É o defeito que só se ouve: nenhum pixel muda.
- **A rolagem**: `load()` restaurava `scrollPos` em TODO redesenho, e o único
  produtor daquele mapa é a troca de aba. Acrescentar um item, favoritar ou o
  progresso de um download jogavam a lista de volta para o topo. Agora só a
  NAVEGAÇÃO restaura; um redesenho no lugar mantém o lugar.
- **As miniaturas da Biblioteca** eram criadas no balde de `object-URL` de
  OUTRO host e o `renderLibrary` seguinte (que roda a cada 400 ms durante um
  download) as revogava EM CENA.
- **O funil de destinos** redesenhava favoritos e playlist e deixava o
  Cronograma por conta do chamador — dos dois que existem, só um lembrava.
- **O timer da procura de atualização** apagava o "Deixar para depois" e o
  diálogo modal reabria sozinho oito segundos depois.
- **`bibleGotoChapter`** é o outro ponto que escreve `bibleChapterData` e não
  fazia nada do que `changeBibleVersion` documenta como obrigatório.
- **O preset de sorteio** reescrevia `kind`/`min`/`max`/`pool` sem zerar
  `used`: o roteiro podia abrir um sorteio sem números para sortear.
- **A letra avulsa** não tinha guarda de sequência em volta do download.
- **A sincronização de pasta** redesenhava a Biblioteca inteira uma vez POR
  ARQUIVO, pulando o coalescimento de 400 ms que já existia e tem nome.
- **O wallpaper da tela da rede** desistia em ~6 s, e os bytes dele vêm depois
  da mídia inteira na mesma fila serializada — agora usa a mesma ladeira do
  fundo da letra.
- **A caixa-preta** carimbava "PAUSA ESPONTÂNEA" em toda parada comandada: a
  janela era de 400 ms contra um fade de 600 ms, e `media-clear` não estava na
  lista.
- **O erro de mídia da preview** era engolido sem registro nenhum — e o
  comentário afirmava que ele ia para o Registro. Agora vai.
- **`refFonte`** era escrito a cada status e NENHUMA linha o lia. Virou a linha
  "Referência de tempo" do Registro, com a recência junto (ele não zera
  sozinho, e sem a guarda diria "o telão" com o palco vazio há meia hora).

**KOTLIN (exige Release):** a remontagem por morte de renderer zerava
`backgroundWork` e `captureVolumeKeys` e **não desfazia a TELA CHEIA** — o
WebView novo era acrescentado a um `webContainer` que continuava `GONE`, com a
View órfã por cima. É o culto SEM TV, em que a preview em tela cheia É a
projeção. E `buscarInterno` apagava `cancelarLink` incondicionalmente na
entrada: um cancelamento que chegasse com o download ainda ENFILEIRADO era
descartado no instante em que a vez dele chegava — o operador tocava em
cancelar e os ~300 MB baixavam assim mesmo.

**CÓDIGO MORTO REMOVIDO** (confirmado por `eslint --rule no-unused-vars` mais
conferência à mão): `COLLECTION_LOCALE`, `nowYoutube`, `voiceIconSvg`,
`noteIconSvg`, `lyricsOnlyIconSvg`, `mirrorTvConfirmado`, o construtor de
cabeçalho de grupo `header` (~30 linhas de UI paralela e inerte) e o
`countDownloaded` calculado e descartado em cada card, a cada redesenho.

**O QUE FICA MAPEADO E NÃO FOI MEXIDO, de propósito:** a aba `'folders'` e a
gaveta `#favPopup` são **inalcançáveis** — `openFavorites` não tem chamador e
**`currentFolder` nunca mais recebe valor não-nulo em lugar nenhum do app**
(as únicas atribuições são `= null`). São ~30 ramos, e com eles foram-se, sem
aviso, a BUSCA dentro de uma pasta do aparelho e a seleção múltipla lá dentro.
A faxina merece o próprio lote — e o oráculo que hoje monta `activeTab =
'folders'` à mão prova um comportamento num estado que o app não alcança.

Todos os oráculos passam (19/19), e **cada correção foi verificada por
ISOLAMENTO** — devolvendo o defeito e conferindo que o caso novo reprova. O
Kotlin **não foi compilado** aqui (o ambiente não tem o SDK do Android): quem
o compila é o CI.

(Ela nasceu como v5.292 e foi renumerada no merge: uma sessão paralela
publicou outra v5.292 em `main` enquanto esta rodava. Os dois lotes tocam
`load()` e não se anulam — o de lá acrescenta a sincronização da seção de
Favoritos, o daqui muda a restauração da ROLAGEM e a assinatura. O merge foi
conferido com a suíte inteira depois de juntos.)

---

## v5.292

**A v5.292: A SEÇÃO DE FAVORITOS FICAVA PARA TRÁS DO BANCO. OTA PURO** (sem
Release).

Relato do operador: *"verifique a atualização da lista de favoritos em relação
a excluir itens comuns e a excluir pastas, que não desaparecem apenas fechando
e reabrindo a biblioteca"*.

**A causa é estrutural, e não daquele botão.** `deleteOpfsFolder`,
`syncDeviceFolder` e a limpeza de catálogo terminam em `load()` — o funil onde
`favItems`, `favSet` e `opfsFolders` são reaplicados ao estado do módulo —, e
`load()` redesenhava o Cronograma (`renderLibrary`) e mais nada. A seção de
Favoritos tem DUAS casas desde a v5.237, e desde a v5.290 a de dentro da
Biblioteca é a única alcançável: quem a desenha é `renderFolderList` com
`favHost`, que `load()` nunca chamava. É o mesmo defeito que a v5.258 corrigiu
para o FAVORITAR, numa porta que aquele lote não tinha.

Medido: excluir a pasta a tirava do banco (`opfs-folders` vazio) e a deixava na
tela; o mesmo com o favorito que ela leva junto, porque `purgeCatalogRecords`
mexe em `favs`.

**A guarda é uma ASSINATURA, e não um redesenho incondicional.** `load()` roda
por dezenas de caminhos com a Biblioteca aberta — uma sincronização que
termina, o coletor de lixo, uma troca de aba por baixo —, e refazer a seção em
todos eles fecharia a gaveta de opções que o operador acabou de abrir. Ela só é
reconstruída quando o que ela DESENHA mudou (os ids dos favoritos e os
id:contagem das pastas).

**E o redesenho explícito do `moverNaLista` saiu junto**, porque virou o
SEGUNDO: `reabrirAcoesEm` é consumido pelo primeiro, então o segundo
reconstruía a linha sem a gaveta aberta — o botão saía de baixo do dedo, que é
exatamente o que aquele mecanismo existe para evitar. O oráculo do par ↑↓ pegou
isso na primeira execução.

**E a metade negativa quase passou de graça.** A primeira versão dela mandava o
item ao Cronograma e afirmava que a gaveta sobrevivia — só que aquele caminho
**não chega a chamar `load()`** (a guarda de lá compara chaves de DESTINO com
nomes de LISTA), isto é, ela nunca exercitava o redesenho. Medida no `load()`
cru, ela reprova o redesenho incondicional.

Verificado por ISOLAMENTO: sem a sincronização, **2** asserções reprovam; com
ela incondicional, **1**.

---

## v5.291

**A v5.291: UMA `.lib-item` DENTRO DE OUTRA — todo seletor DESCENDENTE vazou.
OTA PURO** (só CSS e o oráculo; sem Release).

Relato do operador sobre a v5.290, com prints: *"há diversos bugs, como o
posicionamento incorreto do design dos itens da pasta. além de ter novamente o
efeito incorreto de encolhimento inteiro do grupo ao tocar em itens
individuais. também temos uma falha, que não permite fechar as opções de play
dos itens."*

**Três sintomas, UMA causa.** A pasta abrindo inline fez `.folder-opfs` virar o
primeiro `.lib-item` deste app que CONTÉM outros `.lib-item` — e as regras da
gaveta são descendentes, escritas numa época em que esse aninhamento não
existia:

| selector | o que ele passou a alcançar |
|---|---|
| `.lib-item.expanded .hymn-gaveta` | a pasta ABERTA satisfaz o `.expanded`, então a gaveta de TODO arquivo lá dentro virava `display: block` |
| `.lib-item:not(.vendo-letra) :is(.hymn-lyrics, .item-detalhe)` | a pasta nunca tem `.vendo-letra`, então ela escondia o detalhe de um arquivo que TEM |
| `.lib-item:has(.hymn-gaveta :active)` | não alcançava `.folder-itens`, e o `--press` da pasta encolhia com o toque num arquivo |

A primeira linha explica DOIS dos três relatos de uma vez: a faixa preta
embaixo de cada arquivo era a gaveta vazia dele, e fechar as opções tirava a
classe do item **sem esconder nada**, porque quem as mantinha visíveis era a
pasta. Medido: `exp: false, display: block, altura: 19px` nos três arquivos
fechados, e `classe: false, display: block, altura: 293px` depois do segundo
toque.

**A regra que fica, e ela é mais larga que este arquivo: a gaveta é do item que
a POSSUI, então toda regra dela é `>`.** Um seletor descendente responde "existe
algum ancestral assim?", e a resposta muda no dia em que alguém aninha o
componente — sem erro em lugar nenhum, e num lugar que não é o da causa. O
mesmo vale para o feedback de toque, agora escrito de uma vez para os três
blocos que uma linha apenas HOSPEDA (`.row-acoes`, `.hymn-gaveta`,
`.folder-itens`): quem encolhe é a peça tocada.

**E o quarto item do relato era de geometria**, medido: o arquivo começava em
x=18 — colado na borda do cartão da pasta, com a miniatura dele na MESMA coluna
da miniatura da própria pasta, lendo-se como irmão dela em vez de conteúdo. O
favorito ao lado começa em 24. Com o recuo de `.4rem` no corpo, os dois passam
a ocupar a mesma coluna (24 e 24; miniaturas em 32 e 32), que é o que o álbum
já fazia pelo padding do `.coll-open`.

Verificado por ISOLAMENTO, uma regra de cada vez: o seletor descendente de
volta reprova **2** asserções, a guarda do encolhimento **1**, o recuo **1**.

**E o oráculo quase passou pelo motivo errado.** A asserção das gavetas
fechadas clicava na pasta *uma vez* para abri-la, isto é, dependia do estado
que o caso anterior deixou — com ela fechada as gavetas estão escondidas de
qualquer jeito, e a asserção passaria sem medir nada. Ela passou a GARANTIR o
estado (`if (!expanded) click`), e só então o defeito reprova.

---

## v5.290

**A v5.290: A PASTA DO APARELHO ABRE COMO UM ÁLBUM — e a gaveta de tela cheia
fica sem porta. OTA PURO** (sem Release).

Pedido do operador: *"ajuste o sistema de pastas dos favoritos, para que ele
abra a lista de arquivos das pastas de forma visual sem ser um popup, para que
abra a lista assim como abrem os álbuns com seus itens"*.

**Uma pasta é um CONTÊINER de arquivos, exatamente como um álbum é um
contêiner de faixas**, e o app já sabia desenhar isso. Ela abria uma folha de
tela cheia (`#favPopup`) — a única sobrevivente de um modelo em que os
favoritos eram uma gaveta própria — e agora é o mesmo acordeão, no mesmo
lugar, com as mesmas linhas de item. O corpo é montado **uma vez, e só quando
a pasta abre**: uma pasta sincronizada tem centenas de arquivos, e montá-los
para todas elas a cada redesenho da seção seria o trabalho de DOM da tela
inteira por algo que ninguém está vendo (a decisão da v5.237, um nível
acima).

**Uma anatomia só para as duas listas.** `favItemRow` virou `linhaDeItem`, e o
que muda entre um favorito e um arquivo de pasta viaja em `opts` — nada mais:

| | favorito | arquivo da pasta |
|---|---|---|
| `lista` | `'favs'` (↑↓ e excluir) | **nenhuma** — a ordem vem do disco, e apagar aqui seria apagar o ARQUIVO |
| `destinos` | playlist · Cronograma | playlist · Cronograma · **Favoritar** |

A segunda linha é a régua de sempre: numa lista de favoritos "Favoritar" não
muda nada, e numa pasta ela é justamente o caminho de promover o arquivo. Uma
escolha que não faz nada é pior que escolha nenhuma — daí ser parâmetro, e não
um `if` dentro do menu.

**`pastaAberta` é um NOME e não um conjunto**, pela mesma razão do
`grupoAberto` (v5.273): "duas pastas abertas" deixa de ser uma regra que
alguém precisa lembrar e passa a ser uma frase que não dá para escrever. E ele
nasce no topo do arquivo, porque é lido por um caminho de render — a zona
morta temporal que já derrubou o app quatro vezes. Ele existe porque favoritar
um arquivo de dentro da pasta redesenha a seção: sem essa memória, cada ação
fecharia a pasta.

**⚠️ E A GAVETA `#favPopup` FICOU SEM PORTA.** Ela era a tela de DENTRO de uma
pasta e nada mais (a v5.238 já tinha tirado o botão que a abria pela raiz), e
`openOpfsFolder` era o único caminho para lá. O subsistema continua no arquivo
INTEIRO e inerte, com a lápide em `openFavorites`, e isso é uma decisão
declarada: removê-lo alcança ~28 ramos de `activeTab === 'folders'` espalhados
por `load`, `renderListTitle`, `renderLibrary`, `deleteSelected`, `switchTab`,
`hostSelbar`, `listHost`, o carrossel e a pilha do voltar — uma faxina que
merece a própria passada de verificação, e não o mesmo lote de uma mudança de
comportamento. O `activeTab` nunca mais vale `'folders'` (o carrossel já o
pulava), então os ramos são inertes, não perigosos.

**O que a gaveta levava junto, e está dito em vez de escondido:**

- a **BUSCA dentro de uma pasta** (`folderQuery`/`#libSearch`) — e ela não tem
  substituto: a barra da Biblioteca varre `allCollections()`, que não alcança
  o catálogo de pastas;
- a **SELEÇÃO MÚLTIPLA** dentro de uma pasta, que era onde morava o excluir de
  ARQUIVO FÍSICO por item. Esta é menos perda do que parece: um arquivo
  apagado de uma pasta sincronizada volta na sincronização seguinte — o mesmo
  argumento que mantém o renomear fora dali (v5.288) — e quem apaga de
  verdade é o "Excluir pasta e arquivos sincronizados" da própria linha.

Verificado por ISOLAMENTO: devolvendo o toque que abria o popup, **3**
asserções reprovam — e reprovam MEDINDO (a sonda é null-safe de propósito:
sem `.folder-itens` uma exceção abortaria o caso e o que sobraria seria
"terminou com erro" em vez de "a lista não abriu inline").

---

## v5.289

**A v5.289: A GUARDA PERGUNTAVA À ÁRVORE DE AGORA, e o handler já a tinha
desmontado. OTA PURO** (sem Release).

Três coisas: uma REGRESSÃO da v5.288 e dois pedidos do operador.

- **TOCAR NUMA OPÇÃO DE PLAY FECHAVA O ÁLBUM INTEIRO.** Relato, no dia
  seguinte ao lote: *"agora ele está fechando o álbum ao tocar nos botões de
  check das opções de play"*.

  A v5.288 subiu o ouvinte do acordeão para o CARD e o guardou com
  `e.target.closest('.coll-open')` — uma consulta à árvore VIVA. Só que o botão
  de destino é apagado pelo próprio handler que roda antes desta linha: marcar
  uma opção chama `renderSongMenu`, que faz `alvo.innerHTML = ''` e reconstrói
  a lista. Quando o evento chega ao card, o `e.target` está **desanexado** —
  `closest` sobe por um trecho de árvore que não tem mais pai nenhum, devolve
  `null`, a guarda falha e o álbum fecha. Medido: a marca nem chegava a pegar,
  porque o card era reconstruído por baixo.

  **A régua que fica é mais larga que este arquivo:** um ouvinte que decide
  pela POSIÇÃO do alvo na árvore está perguntando "onde este nó está agora", e
  *agora* é depois de todos os handlers que rodaram antes dele. A pergunta que
  ele quer fazer é sobre o CAMINHO — *este clique nasceu dentro do corpo
  aberto?* —, e o caminho é fixado no DISPARO: `e.composedPath()` sobrevive ao
  apagamento; `closest` não.

  Os irmãos que rebuildam do mesmo jeito foram medidos junto e passam: o
  seletor de variante, o "Ver a letra" e as opções do próprio álbum.
- **FAVORITAR NÃO FECHA MAIS A GAVETA DO CRONOGRAMA**, e ela fechava por DOIS
  caminhos independentes — consertar um só teria deixado o defeito de pé. O
  ouvinte de captura da caixa fecha em qualquer botão (a estrela virou exceção,
  ao lado do par ↑↓, pela mesma régua: **a ação que não TERMINA a conversa com
  aquele item** — a estrela é um alternador, e o desfecho dela é o próprio
  botão mudando de desenho sob o dedo); e o `renderLibrary` que `toggleFav`
  agenda depois do pulso reconstrói a linha inteira, apagando o `li` aberto.
  Daí `manterAcoesAbertas()`, que reusa o `reabrirAcoesEm` do par ↑↓ e a CHAVE
  que `montarAcoesDaLinha` passou a carimbar no `li` — sem ela não haveria como
  reencontrar a linha, porque o mesmo item vive em duas listas ao mesmo tempo.
- **O EXCLUIR É O PRIMEIRO DA FAIXA**, isto é, o mais longe do `⋮`. Pedido do
  operador: *"excluir deve ficar o mais longe de um acidente de clique de
  fechar opções"*. O `⋮` fica colado na ponta direita e é o alvo tocado
  repetidamente (abre e fecha) — errá-lo por alguns pixels caía justamente no
  destrutivo. Do outro lado o vizinho é o VAZIO da caixa, que também fecha, e a
  diferença é que ele é uma área larga em que ninguém mira a borda. Isto
  inverte a ordem que valia desde a v5.258 ("o que se usa mais fica mais perto
  do dedo"); ela continua valendo para o resto da fileira.

Verificado por ISOLAMENTO: devolvendo o `closest`, **1** asserção reprova (e é
a que exercita a desanexação de verdade); devolvendo a estrela ao fecho, **1**
— e ela continua reprovando com só metade do conserto (o ouvinte sem o
`manterAcoesAbertas`), que é o que prova que os dois caminhos existem;
devolvendo o excluir ao fim da fileira, **1**. A metade NEGATIVA está travada
junto: um botão que TERMINA a conversa (o renomear) continua fechando — sem
ela, calar o ouvinte inteiro passaria.

---

## v5.288

**A v5.288: O FEEDBACK DE TOQUE TIRAVA O ALVO DE BAIXO DO DEDO — e mais três.
OTA PURO** (sem Release).

Quatro pedidos do operador, e o terceiro é o achado do lote.

- **O CARD DO ÁLBUM NÃO ABRIA PERTO DA BORDA.** Relato: *"nos álbuns há um
  toque em uma margem à esquerda da seta que abre o álbum, que ENCOLHE os
  itens dentro do card, mas não abre o álbum"*.

  **A causa não é o pixel, é o próprio FEEDBACK.** `.coll-bar` está na lista
  do `:active` do app, cujo `--press` é `scale(.96)` — numa barra de ~395px
  isso a encolhe ~8px de cada lado. O `pointerdown` acerta a barra e dispara o
  encolhimento; no `pointerup` ela já não está mais ali, e o navegador entrega
  o `click` ao ancestral que sobrou: o card, que não tinha ouvinte nenhum.
  Medido por varredura, com o card de 395px: **até ~7px da borda o toque não
  abre; de 8px em diante abre** — e a fronteira é exatamente o que a animação
  vaga. A "margem à esquerda da seta" existe também à direita, em cima e
  embaixo.

  A correção não é caçar pixels: o ouvinte sobe para o **CARD**, que é o
  elemento que não se mexe — qualquer retargeting causado pelo encolhimento
  passa a cair em quem sabe responder, e a classe inteira fecha. A GUARDA é o
  `.coll-open` (o invólucro de tudo que não é a barra): sem ela, com o álbum
  aberto um toque numa faixa borbulharia até o card e o fecharia debaixo do
  dedo. Perguntar pelo invólucro, e não por uma lista de filhos, é o que faz o
  próximo bloco que nascer lá dentro já nascer protegido.

  **E o padding saiu do card** (`.hymnal-card { padding: 0 }`), indo para quem
  PINTA — a barra e o corpo aberto. Ele era um resíduo com pista no próprio
  arquivo: a barra do álbum ABERTO já o desfazia com margens negativas para
  grudar como tampa, isto é, **com o álbum aberto aquela faixa funcionava e
  com ele fechado, não** — o mesmo pixel respondendo ou não conforme o estado.
- **RENOMEAR ENTRA NA GAVETA DA LINHA DO CRONOGRAMA.** Ele existia só para UM
  item de cada vez e atrás de quatro gestos (toque longo → seleção múltipla →
  botão do rodapé → diálogo), que é a mesma correção que o excluir recebeu na
  v5.272. **Na pasta do aparelho ele NÃO entra**, com a mesma guarda do
  excluir: ali o nome vem do arquivo, e um nome só no registro seria desfeito
  na varredura seguinte. O lápis é **SVG inline** e nunca um glifo — a fonte é
  um subset estático e `edit` não está nele; codepoint ausente desenha um
  retângulo vazio, sem erro em lugar nenhum (a armadilha da v5.184 e da
  v5.200).

E os dois primeiros pedidos, os dois sobre a estrela em telas diferentes.

- **NOS FAVORITOS, A ESTRELA SAI E A LIXEIRA FICA.** *"Remova ou a opção de
  excluir ou a opção de desfavoritar, pois tecnicamente ambas fazem a mesma
  coisa."* Nesta lista fazem: as duas terminam num `listRemove('favs', id)`, e
  o que se vê é a mesma linha sumindo.

  **Isto REVOGA meia frase da v5.287** — ela dizia "quem o tira de lá é a
  estrela". Três razões, na ordem em que pesam: **(1)** aqui a estrela é um
  alternador de UMA direção — todo item desta lista já é favorito, então ela
  nasce sempre acesa e o único toque possível é o que apaga, isto é, um botão
  de excluir vestido de alternador que nunca chega a dizer "favoritar";
  **(2)** a lixeira PERGUNTA, e a linha some de uma lista que o operador
  montou à mão — o texto do diálogo ainda explica a semântica exata ("os
  arquivos só são apagados se ele não estiver em mais nenhuma"); **(3)** ela
  solta a prateleira invisível (`soltarAvulso`), que é a diferença entre "a
  linha sumiu" e "os bytes saíram" — a estrela não faz isso, porque
  desfavoritar não é uma declaração de intenção de apagar.

  Nas outras listas a estrela continua inteira, e ali ela alterna de verdade.
- **E NO CRONOGRAMA ELA VIRA UM BOTÃO COMO OS OUTROS.** *"Verifique o design
  do favoritar no cronograma, para que seja um botão quadrado igual as outras
  opções."* O `background: transparent` dela tinha um argumento escrito, e ele
  EXPIROU com uma mudança de casa: *"numa linha que já tem miniatura, nome,
  selo e às vezes dois botões, mais um fundo sólido viraria ruído"* — verdade
  quando ela morava NA LINHA. Desde a v5.258 ela mora dentro da gaveta do `⋮`,
  onde todos os vizinhos são `.row-btn` preenchidos: chapada ali, ela era a
  única peça da fileira sem caixa, e a exceção não dizia nada. (O par que o
  argumento citava — a alça de arrastar — nem existe mais desde a v5.285.) O
  ESTADO continua sendo o desenho (preenchida × vazada) mais a cor, que é o
  que a estrela sempre disse.

A régua do oráculo da estrela é a dos VIZINHOS, e não um valor escrito: ele
exige que todos os `.row-btn` da faixa tenham o MESMO fundo e que ele não seja
transparente — um token novo do dia seguinte não pode reprovar isto. E o do
card mede um CLIQUE DE VERDADE (`mouse.click`, porque um `el.click()`
sintético não passa por hit-test nenhum e aprovaria o defeito inteiro), nas
três metades: fechado a borda abre, aberto a mesma borda fecha, e um toque
numa faixa não fecha nada.

Verificado por ISOLAMENTO: devolvendo o `transparent`, **1** asserção reprova;
devolvendo a estrela à faixa dos favoritos, **1**; devolvendo o ouvinte à
barra e o padding ao card, **3**; tirando só a guarda do `.coll-open`, **1**;
tirando o renomear, **4**.

---

## v5.287

**A v5.287: A GAVETA PARA DE SE MESCLAR COM A LISTA, e a linha de favorito
ganha o mesmo sistema da Biblioteca. OTA PURO** (sem Release).

Quatro pedidos do operador, e os dois últimos são o mesmo movimento.

- **A LARGURA DO "VER/OCULTAR A LETRA" NÃO MUDA MAIS COM O ESTADO.**
  "Ocultar" é mais longo que "Ver", então o botão crescia debaixo do dedo e o
  CONFIRMAR ao lado encolhia junto — 110px → 143px, medidos. As duas frases
  passaram a ocupar a MESMA célula de uma grade 1×1 e a troca só alterna qual
  se vê: a largura é a da maior, sempre. `visibility` e não `display`, porque
  a escondida precisa continuar MEDINDO — é ela que reserva o espaço. Um
  `min-width` em `ch` seria um número a manter contra a fonte e contra a
  tradução; isto não tem número nenhum.
- **A GAVETA VIRA UM POÇO, E A DIREÇÃO DELE MUDA COM O TEMA.** Relato:
  *"ainda está pouco o contraste entre os botões e pior, toda a seção das
  opções de play estão se mesclando com a lista dos outros itens abaixo,
  dificultando a percepção da seção e a qual item ela pertence"*.

  **MEDIDO antes de mexer, no tema ESCURO: 1,03:1.** A v5.286 devolveu à
  gaveta o `--panel` da folha antiga — que era a base certa para aqueles
  botões e é a cor errada AQUI: `--panel` compõe rgb(44,52,60) e a faixa de
  uma linha vizinha compõe rgb(46,54,63). A seção aberta tinha, literalmente,
  a cor das linhas de baixo, e os botões dentro dela davam 1,18:1.

  `--gaveta-bg`/`--gaveta-btn` são um par por tema, e a inversão é aritmética:
  no escuro o único caminho é DESCER (subir levaria a `--panel-2`, que é a cor
  do próprio card do álbum — a que aparece nos vãos entre as linhas); no
  claro, descer para `--bg` deixaria a gaveta a 1,09:1 do card, e quem sobe é
  ela. Medido depois — botão × gaveta e gaveta × faixa vizinha: escuro
  **1,49** e **1,54**; claro **1,41** e **1,93**. É o mesmo precedente do
  `--field-bar` (v5.270): uma superfície cuja direção não acompanha a escada
  precisa de um token próprio em cada tema.

  **A SEGUNDA metade da queixa é de FORMA, e ela custa uma linha:** a gaveta
  perdeu as margens. Ela é filha do `.lib-item`, que já pinta a linha inteira
  e recorta pelo `border-radius` com `overflow: hidden` — coladas, faixa e
  gaveta viram UM bloco com o título em cima e o poço embaixo. Com a margem, o
  poço era uma ilha flutuando sobre um frame da cor das linhas de baixo, e
  nada dizia de quem ele era.
- **A LINHA DE FAVORITO ABRE A GAVETA DA BIBLIOTECA, e o `⋮` sai.** Os dois
  últimos pedidos: *"verifique a sobreposição das opções dos itens na lista de
  favoritos, pois estão novamente abrindo a sua gaveta de opções sobre o
  título de cada item"* e *"trate a lista de favoritos com o mesmo sistema de
  opções de play que temos no resto da biblioteca, ao invés de tratar ela como
  toque direto no player"*.

  **O segundo RESOLVE o primeiro, e é por isso que eles vieram juntos.** O `⋮`
  e a faixa que ele abre existem para caber numa linha que responde ao toque
  com OUTRA coisa (no Cronograma, projetar): sem lugar embaixo, a gaveta só
  tinha para onde ir por CIMA do título. Aqui o toque deixa de projetar, o
  corpo da linha fica livre, e a sobreposição deixa de existir por construção
  — não por um reposicionamento.

  **Esta lista mora DENTRO da Biblioteca desde a v5.237**, e é isso que decide
  o lado da regra em que ela cai: a Biblioteca é a tela em que se PREPARA (o
  toque abre opções) e o Cronograma é a lista com que se OPERA (o toque
  projeta). O `⋮` continua inteiro lá, e na fila da playlist.

  **Nada de menu foi reimplementado.** `renderItemMenu` é a mesma maquinaria
  de destinos — `songMenuItem` com `destino`, `destExecutor`, `destRemontar`,
  `destConfirmRow` — apontada para a `<ul>` do corpo da linha. O que ela NÃO
  tem é seletor de variante (o registro já existe; não há cantada × playback a
  escolher) nem "Favoritar" (o item É um favorito, e quem o tira de lá é a
  estrela). As ações da linha — estrela, ↑↓, excluir — descem para uma faixa
  no PÉ da gaveta, com os mesmos botões e os mesmos ouvintes de antes.

  **O PREÇO está dito:** projetar um favorito passou de um toque a três
  (abrir, marcar, confirmar). Em troca, as três listas passam a estar a um
  toque do mesmo lugar — antes, mandar um favorito ao Cronograma era o `+` e
  mandá-lo à playlist não tinha caminho nenhum nesta tela. O **Parar na capa**
  continua sendo um toque direto: tirar do ar é a decisão que não pode custar
  uma gaveta.

**As regras da gaveta deixaram de ser keyadas em `.hymn-result` e passaram a
ser em `.lib-item`** — o mesmo envelope serve as duas listas, e uma segunda
anatomia divergiria da primeira no próximo ajuste. Com ela saiu a opção
`semSelecao` do `attachRowGestures`, que ficou sem chamador.

Verificado por ISOLAMENTO: devolvendo o `--panel` e o `--surface` da v5.286,
**2** asserções reprovam (e imprimem o 1,18 e o 1,03 do relato); devolvendo o
`display: none` no botão da letra, **1**; devolvendo o toque que projeta na
linha de favorito, **4**.

---

## v5.286

**A v5.286: A GAVETA DE OPÇÕES, EM SETE PONTOS — e dois deles são defeitos que
a v5.285 introduziu. OTA PURO** (sem Release).

O operador usou a gaveta nova e devolveu sete apontamentos sobre a mesma peça.
Eles vieram num lote só porque vivem um dentro do outro: um conserto de
qualquer um deles mexe no que o vizinho mede.

**Os dois DEFEITOS, e os dois são meus:**

- **"Verifique o que são esses pontos ou marcadores à esquerda dos cards."**
  São marcadores de LISTA. A `<ul>` das opções nasceu no corpo da linha e não
  herdou `list-style: none` de ninguém — a do popup é `.popup-list`, que já o
  declarava. Eles não vinham de regra nenhuma do app, e é por isso que não
  havia o que procurar: era a **ausência** de uma. (Quadrados, e não bolinhas,
  porque o navegador troca o marcador conforme a profundidade do aninhamento —
  o que os tornava ainda menos reconhecíveis como o que eram.)
- **"O feedback de toque está encolhendo toda a seção de opções."** É o
  `:active` do `.lib-item` sendo satisfeito por um botão DENTRO dele. O app já
  conhecia esta armadilha — a v5.269 a desligou para o `⋮` com o argumento de
  que "o movimento da caixa polui o conjunto" —, e a gaveta a reabriu num
  alcance maior: o que se mexia era a linha MAIS a gaveta, meia tela por causa
  de um toque num botão de 40px.

**Os cinco AJUSTES:**

- **"Tocar agora" vira a primeira opção da lista de check**, e as linhas
  "Tocar música cantada"/"Tocar playback" saem. O operador nomeou a razão:
  *"já que nessa seção de check já temos os alternadores entre cantado e
  playback"* — a variante aparecia DUAS vezes, uma como segmento e outra como
  linha. Agora o seletor responde **o quê** e as quatro opções respondem
  **onde**.
- **E "Letra" é o terceiro segmento**, ao lado de Cantada e Playback. Isso
  torna "Só a letra, no Cronograma" redundante — ela era exatamente `Letra` +
  `Cronograma` —, e a linha saiu. `addLyricCue` passou a aceitar VÁRIAS listas
  (um registro só, como qualquer item multi-destino), porque a cena de letra
  deixou de ser exclusiva do Cronograma. O seletor agora aparece SEMPRE: antes
  ele dependia de haver playback, e toda música tem letra.
- **As caixas de marcação se veem sem estar marcadas** — *"para entender que
  não são botões, mas selecionáveis"*. Medido: o recesso antigo dava
  **1,08:1** contra o botão em que mora, que é o "não dá para ver" do relato;
  `--check-vazio` o leva a **1,28:1**. Ele é um token com TEMA, e não o
  `--scrim` compartilhado: no claro aquele .6 seria uma lápide sobre um botão
  claro. Continua sendo um RECESSO — a regra da v5.267 vale —, e o teto é o do
  próprio tema escuro: preto sobre um botão já escuro comprime a razão por
  construção.
- **O fundo da gaveta volta a ser o da folha antiga** (`--panel`). O pedido
  cobra a consequência de mudar a lista de lugar: na folha ela pousava em
  `--panel` e os botões dela são um RECESSO; trazida para o corpo da linha,
  passou a pousar na faixa, que já é um recesso do card. Recesso sobre recesso,
  e o degrau que separava o botão do fundo encolheu.
- **A letra fica atrás de um botão lado a lado com o confirmar.** Ela é a mais
  alta das duas metades da gaveta, e aberta por padrão empurrava as opções para
  longe do dedo em toda abertura — quando o que se abre a gaveta para fazer é
  DECIDIR. O botão é fornecido pelo dono da lista (`songMenuFor.aoLado`), então
  a folha, que não tem letra nenhuma a esconder, não muda.

**Duas armadilhas de medição no caminho, e as duas são a mesma:** a asserção da
caixa vazia media `backgroundColor` de um `::before` com ALFA — isto é,
comparava PRETO com o botão e passava em qualquer estado. É a armadilha da
v5.283 um nível abaixo, e a correção é a mesma (compor sobre a base). E o
`razao` do arquivo mora dentro do laço de temas; usá-lo fora dele derrubava o
caso inteiro por `ReferenceError`, escondendo tudo o que vinha depois.

Verificado por ISOLAMENTO, peça a peça: os marcadores de volta reprovam **1**,
o fundo antigo **1**, a letra aberta **1**, a caixa antiga **1** (imprimindo o
1,08:1 do relato) e o feedback sem a guarda **1**.

---

## v5.285

**A v5.285: O ARRASTO SAI DO APP, os botões saem da faixa, e as opções descem
para o corpo da linha. OTA PURO** (sem Release).

Quatro pedidos do operador, e os dois últimos são o mesmo movimento.

- **AS PASTAS SINCRONIZADAS VÃO PARA O TOPO** dos Favoritos. Elas ficavam no
  fim desde a v5.254, com o argumento de que *"são a origem bruta, e o que a
  estrela promete são os itens"* — o que continua verdadeiro e não é o que
  decide a ordem: uma pasta é um punhado de arquivos atrás de UMA linha, e a
  lista de favoritos cresce por baixo dela. No fim, cada favorito novo
  empurrava as pastas para longe; no topo elas têm endereço fixo.
- **REORDENAR VIRA UM PAR ↑↓ DENTRO DA GAVETA DO `⋮`**, e o arrasto sai do app
  inteiro — as TRÊS listas (Favoritos, Cronograma e a fila da playlist, esta
  última perguntada e confirmada), para não sobrarem dois idiomas de
  reordenar. Com ele saem `attachHandle`, a medição única do `pointerdown`, a
  linha-guia absoluta (e o bloco contendor que a v5.272 garantia pelo JS), o
  `data-fixa` das pastas e o `reorder` por índice de destino. **A fila da
  playlist ganhou a gaveta do `⋮` no mesmo lote** — ela era a única lista sem
  botão de opções, e tirar o gesto sem dar a gaveta a deixaria sem como
  reordenar.

  O que justifica a troca não é gosto: um arrasto é um gesto CONTÍNUO com
  captura de ponteiro, disputando o eixo vertical com a lista que rola por
  baixo, dentro de uma gaveta que já é um alvo pequeno. **O preço está dito:**
  mover dez posições passou de um gesto a dez toques. É o caso raro, e
  `reabrirAcoesEm` o torna suportável — a lista redesenha entre um toque e o
  outro, e a gaveta volta no item que se moveu, com o botão sob o mesmo dedo.
  **A chave dessa reabertura é `lista:id` e não o id nu**: o mesmo item está em
  duas listas ao mesmo tempo (um favorito que também está no Cronograma é o
  caso normal), e com o id sozinho o redesenho do Cronograma consumiria a marca
  e abriria a gaveta na linha errada, noutra tela.

  E `moverNaLista` **redesenha a seção dos Favoritos à mão**: `renderLibrary`
  só chega ao `renderFolderList` quando a aba é a da pasta do aparelho, e a
  lista `favs` mora dentro da Biblioteca desde a v5.237 — sem essa linha o item
  mudava de lugar no banco e a tela ficava idêntica, que é o pior desfecho
  possível para um botão de reordenar.
- **A FAIXA DA BIBLIOTECA PERDE OS DOIS BOTÕES** (o ▶ e o `+`) e **as opções
  completas descem para o corpo da linha**, onde antes abria só a letra. O que
  o operador desfaz é a DIVISÃO da v5.62: com dois alvos, decidir "o que fazer
  com este hino?" exigia primeiro decidir qual dos dois botões era o dono da
  pergunta — e essa é uma pergunta sobre a UI, não sobre o culto. Medido, o
  nome passou a ocupar **83% da linha**.

  **A gaveta tem duas metades, e a letra FICA** (decisão do operador,
  perguntado): as opções em cima, a letra (ou o detalhe do vídeo) logo abaixo.
  A ordem não é arbitrária — quem abre a gaveta acabou de tocar para DECIDIR, e
  a decisão tem de estar sob o dedo; a letra é a conferência, e ela pode rolar.

  **Nada de menu foi reimplementado.** `renderSongMenu` e `openYtMenu` ganharam
  PARA ONDE escrever (`songMenuFor.alvo`), e o modo `tudo` empilha tocar e
  adicionar numa lista só. A folha `#songMenuPopup` continua de pé com os dois
  donos que sobraram — os resultados do YouTube e o seletor de destinos da
  importação —, e `openSongMenu` saiu por não ter mais chamador. Um episódio de
  série continua desviando para a lista do YouTube, como a folha já fazia desde
  a v5.230; o que muda é o endereço.

**O quadrado da esquerda deixou de ser botão e virou INDICADOR** — ele hospeda
o anel de download, que é a única coisa que aquele canto sempre informou de
verdade, e segura a coluna que alinha a lista. Perdeu o `--accent-soft` (a
marca de "isto é ação") e o `cursor: pointer`: um alvo que não é alvo, num
canto onde o dedo mira, é pior que nada.

**As setas do par ↑↓ são SVG inline, nunca glifo da fonte** — o subset é
estático e um codepoint ausente desenha um retângulo vazio sem erro nenhum,
que é a armadilha da v5.184.

Os oráculos mudaram de pergunta junto, e um deles ficou mais forte: o caso do
ALVO dos botões (v5.278) media se as bordas em volta deles caíam no botão; com
os botões fora, ele passou a afirmar que **todo ponto da linha leva ao mesmo
lugar** — cantos, bordas e o quadrado onde o ▶ vivia —, e conta `button` sem
conhecer os nomes dos que saíram, para valer contra o próximo que aparecer.

Verificado por ISOLAMENTO: devolvendo as pastas ao fim, **1** asserção
reprova; devolvendo um botão à faixa, **1**.

---

## v5.284

**A v5.284: A PASTA SINCRONIZADA CONTINUA SENDO UM ÁLBUM — e a estrutura que
faltava aparece. OTA PURO** (sem Release).

Pedido do operador: *"mantenha apenas as pastas sincronizadas dos favoritos
como cores de álbum"*. Uma pasta guarda muitos arquivos — ela é um CONTÊINER,
como um álbum —, e um favorito é um item. O **"apenas"** é o que faz disto uma
regra em vez de duas cores: o item desce, a pasta não.

**É a v5.283 cobrando o preço de uma peça com dois papéis.** Aquele lote pintou
o CORPO INTEIRO da seção no nível de card para os itens poderem ser um recesso
dele — e ali dentro não sobra como desenhar uma pasta com cor de álbum: ela
ficaria com a cor exata do corpo, **1,00:1**, invisível. A saída não é um `if`
de cor, é a estrutura que faltava, e ela se lê nas duas medições:

- o **ITEM** precisa de uma placa de card atrás dele — sobre o tom da SEÇÃO ele
  mede 1,03:1 no escuro, isto é, some;
- a **PASTA** precisa do tom da seção atrás dela — sobre a placa ela mediria
  1,00:1, que é o mesmo defeito ao contrário.

Duas bases diferentes não cabem numa `<ul>` só. Daí a **placa própria dos
itens** (`.fav-itens`), e com ela o par volta a ser o MESMO do álbum, em dois
elementos: `.hymnal-card` PINTA e `.coll-songs` zera o degrau seguinte. A
v5.283 acumulava os dois papéis numa peça, e o resíduo disso era a armadilha de
"A CAMADA" com a assinatura invertida — o reset tinha de morar na regra da
LINHA, senão venceria na hora de o corpo resolver o próprio `background` e o
bloco sairia transparente. Com a placa, o reset volta ao lugar natural.

**AS PASTAS NÃO GANHARAM REGRA NENHUMA**, e isso é o desenho e não economia:
elas continuam sendo filhas diretas do corpo, que já reserva `--panel-2` para
os filhos dele. A cor de álbum é o PADRÃO ali — o que precisava de regra era o
item. E a placa só nasce quando há item, senão ela seria uma faixa colorida
anunciando uma lista que não existe.

O arrasto não custou uma linha: `attachHandle` mede `li.parentElement`, então
ele passa a operar na placa sozinho, e a linha-guia já garante o bloco
contendor pelo JS desde a v5.272.

**O oráculo mede a cor EFETIVA e a ESTRUTURA dos dois lados** — o item dentro
da placa, a pasta irmã dela —, porque sem a segunda metade uma pasta empurrada
para dentro da placa passaria na medida de cor no dia em que a placa e o corpo
voltassem a ter o mesmo tom. **E a sonda do item não cita a placa de
propósito:** um seletor que só existe na forma nova reprova por "não achei" em
qualquer forma antiga, e uma asserção que falha por seletor ausente não mediu
cor nenhuma — ela diria a mesma coisa com o item pintado certo. Pelo que ele
NÃO é (uma pasta), ela mede em qualquer arranjo.

Verificado por ISOLAMENTO: voltando à forma da v5.283, **4** asserções
reprovam — todas sobre a pasta, e todas medindo (ela sai a 1,00:1 do item ao
lado). As do item continuam passando, que é a leitura certa: a v5.283 acertou o
item e este lote só mexe na pasta.

---

## v5.283

**A v5.283: UM FAVORITO É UM ITEM, NÃO UM ÁLBUM — a linha passa a pintar a
cor da faixa dentro do álbum. OTA PURO** (só CSS e o oráculo; sem Release).

Pedido do operador: *"torne os itens na lista de favoritos, com sua cor de card
igual as cores dos itens individuais dentro dos álbuns, para diferenciar entre
álbum e item"*.

**MEDIDO antes de mexer, nos dois temas: 1,00:1.** A linha de favorito e o card
de álbum pintavam a MESMA cor, literalmente — os dois são filhos diretos do
corpo de uma seção, e o corpo reserva `--panel-2` para os filhos dele. Nada
distinguia "um álbum inteiro" de "um louvor solto" além do que estava escrito
na linha. É a v5.282 cobrando o degrau seguinte: aquele lote tirou o tom
próprio da SEÇÃO com o argumento de que ela é uma seção como as outras, e a
consequência que ele não pesou é que os FILHOS dela não são como os das outras
— lá são álbuns, aqui são itens.

A correção é dar ao favorito a MESMA RECEITA da faixa dentro do álbum: um
RECESSO (`--surface`, que dentro de uma seção da Biblioteca é o par `sunk`)
sobre uma base de nível de card. **As duas metades são inseparáveis, e a
segunda foi imposta pela medição, não escolhida:**

- **Só o recesso, sobre o tom da SEÇÃO, não resolve.** Ele resolve no escuro
  (1,58:1 contra o card) e FALHA no claro, onde a seção é BRANCA e o recesso
  compõe `#dbdbdb`, a **1,02:1** do card — isto é, no tema claro o favorito
  voltaria a ser indistinguível de um álbum, que é o defeito relatado. Isto
  não é hipótese: está exercitado por isolamento, e reprova em 3.
- **Com a base de card por baixo, a composição é a mesma da faixa e o valor
  bate exatamente:** `rgb(46,54,63)` no escuro e `rgb(182,188,194)` no claro, a
  **1,29:1** e **1,37:1** do card nos dois temas.

Daí o corpo da seção PINTAR `var(--camada)` — o `--panel-2` que ele próprio
reserva — e virar o contêiner de nível 2 desta seção, no lugar que num hinário
é ocupado por um card de álbum. Ele é a única peça do arquivo que acumula os
dois papéis que lá são de dois elementos (`.hymnal-card` pinta, `.coll-songs`
zera o degrau seguinte), e **por isso o reset de `--camada` mora na regra da
LINHA e não no corpo**: escrito no corpo, ele venceria na hora de o corpo
resolver o próprio `background` e o bloco sairia transparente — a armadilha que
o cabeçalho de "A CAMADA" descreve, com a assinatura invertida.

**O oráculo mede a COR EFETIVA, e essa distinção é o caso inteiro.** Os
recessos deste app são overlays com ALFA, e `getComputedStyle` devolve o alfa,
não a composição: uma asserção sobre o valor declarado compararia
`rgba(0,0,0,.24)` com um `#3c4753` opaco e diria que eles "diferem" sem ter
medido cor nenhuma — passaria com o defeito no lugar e reprovaria a correção.
Ele sobe a árvore compondo até o primeiro fundo opaco, que é o que o navegador
pinta. E a FAIXA do álbum é desenhada pelo app (`collState` + `expanded`), não
montada à mão pelo teste: marcação inventada num oráculo mede a marcação de
quem o escreveu.

Verificado por ISOLAMENTO: sem a regra inteira (o código anterior), **4**
asserções reprovam, imprimindo o 1,00:1 do relato; com o meio-conserto (o
recesso sem a base), **3**.

---

## v5.282

**A v5.282: OS FAVORITOS VOLTAM A SER UMA SEÇÃO COMO AS OUTRAS — o tom próprio
sai, o "Ver todos" sai, e o vão vira um PISO. OTA PURO** (nenhuma linha de
Kotlin; sem Release).

Três pedidos do operador, e os três desfazem mecanismo meu — o terceiro é o que
torna o segundo possível.

- **O TOM PRÓPRIO SAI** — *"estávamos ajustando para que ela fosse mais
  diferente que os demais, mas não ficou bom. Ajuste as cores dela para que ela
  fique igual as outras coleções"*. O argumento da v5.273 era que a seção não é
  uma coleção e que só ela ocupa o vão; ele continua verdadeiro nas duas
  metades, e **nenhuma delas se lê como COR**: o nome no cabeçalho diz a
  primeira e o vão reservado diz a segunda, sozinho. O que a cor acrescentava
  era um QUARTO tom numa escada de três, e a v5.267 já tinha medido o preço de
  um quarto degrau. Saíram o `--fav-bg` dos dois temas e o `--camada` próprio
  que ele arrastava — **os dois no mesmo lote, porque um nível que muda arrasta
  o de dentro**: repintar só a seção deixaria as linhas num tom que nenhuma
  outra coleção tem, e uma medida da seção sozinha não pegaria isso.
- **O "VER TODOS" SAI** — *"ajuste o funcionamento interno dela para que não
  tenha mais o sistema de ver mais. Agora quando aberta ela mostra toda a
  listagem"*. Com ele foram embora o `favExpandido`, a classe `.expandido`, o
  CSS do botão e a régua de "quantos itens ficaram de fora" com a leitura
  adiada um quadro que ela exigia. É a terceira porta que este mesmo lugar
  perde em quatro versões (a v5.279 abriu o scroll interno, a v5.280 o
  revogou), e agora não sobra nenhuma: **a lista inteira está na tela.**
- **E O VÃO VIRA `min-height`** — *"mantenha o tamanho mínimo dela, mesmo
  vazia, como o tamanho flexível que ocupa o que sobra das outras coleções…
  mas agora esse é apenas o tamanho mínimo, que cresce conforme a lista dos
  favoritos requerir mais que esse espaço disponível"*. É esta linha que
  sustenta a de cima: era o `height` EXATO que produzia o recorte, e do recorte
  vinha o botão. Como piso, a seção continua reservando o vão com a lista vazia
  — o desenho de abertura da Biblioteca, coleções empilhadas na base e o que
  sobra em cima para os favoritos — e passa a crescer com o conteúdo,
  empurrando as fechadas para baixo com a Biblioteca rolando, que é o que
  qualquer outra seção aberta já faz. O `flex-shrink: 0` é o que faz o piso
  valer: um `min-height` num filho que encolhe seria só uma sugestão.

**`medirVaoDosFavoritos` não mudou uma linha, e o registro guarda isso**: a
MEDIDA é a mesma pergunta ("o que sobra da tela depois das outras seções
colapsadas?"); o que mudou é a seção deixar de ser presa a ela. E o padrão
ABERTO continua sendo o `favAberto = true` do topo do arquivo, como desde a
v5.276 — fechá-la segue sendo uma decisão do operador que dura a sessão.

Os oráculos se dividem pela natureza: o `smoke.mjs` mede a COR (nos dois temas,
e por igualdade de string em vez de razão de luminância — "igual" é igual, e um
piso baixo aprovaria dois tons ligeiramente diferentes, que é a queixa) e o
`boot-nativo.test.mjs` mede o TAMANHO, porque é o único que sabe pôr favoritos
no banco. As DUAS metades do piso, e nenhuma basta sozinha: vazia a seção ainda
reserva o vão, cheia ela passa dele sem cortar um item.

Verificado por ISOLAMENTO: devolvendo o `height` no lugar do `min-height`,
**2** asserções reprovam; devolvendo o tom próprio e o degrau de dentro, **4**.

---

## v5.281

**A v5.281: A BARRA NÃO SE MEXIA — QUEM SE MEXIA ERA A PÁGINA INTEIRA. OTA
PURO** (só CSS e o oráculo; sem Release).

Pergunta do operador: *"a barra de pesquisa no topo não fica fixa durante a
rolagem do corpo da biblioteca, você colocou um scroll no corpo deixando a
barra fixa no topo?"*

**Sim, e a estrutura estava certa — foi a primeira coisa medida.** A barra é
irmã da lista, `flex-shrink: 0`, e a lista é `flex: 1; overflow-y: auto`:
rolar `#hymnResults` 116px não move um pixel dela, em Chromium. Se a estrutura
está certa e o operador vê a barra andar, o que se mexe não é a barra.

**É a PÁGINA.** A rolagem que chega ao fim dentro de um scroller **encadeia**
para o contêiner de trás, e do Android 12 em diante o excesso deixou de ser um
brilho na borda e passou a ser o efeito STRETCH — a camada inteira é esticada
e deslocada, barra fixa incluída. O dedo continua dentro da lista e a tela toda
se mexe, que é exatamente a descrição.

`overscroll-behavior: contain` no `.popup-list` corta o encadeamento, e ele não
é novidade nenhuma neste app: `.lib-list`, `.lv-body` e `.simple-lyrics` — os
outros três scrollers — já o têm. **O `.popup-list` era o único que não**, e
ficou sendo desde que a Biblioteca virou uma tela cheia com uma barra fixa em
cima. Mais `overscroll-behavior: none` na raiz, que fecha o caso pelo outro
lado: um gesto que comece FORA de qualquer lista ainda produziria o stretch, e
a página deste app nunca rola — ela é uma coluna de altura fixa com listas que
rolam por dentro.

**O que o oráculo pode e o que não pode.** Um navegador de mesa não reproduz o
stretch do Android, então o caso afirma as duas coisas que ele alcança: a
rolagem de VERDADE não move a barra (a estrutura), e a regra que desliga o
encadeamento está no lugar (a causa). E ele precisou ser medido **depois** de
uma coleção abrir — com tudo colapsado o vão dos favoritos é justamente o que
sobra, a lista cabe inteira e não há rolagem a afirmar. É a segunda vez que
essa propriedade do desenho aparece num caso deste arquivo.

---

## v5.280

**A v5.280: O CABEÇALHO DA BIBLIOTECA SAI, a camada para de perseguir a
viewport, a lista abre no topo, e o scroll interno dos favoritos é revogado.
OTA PURO** (sem Release).

Quatro decisões do operador, e três delas desfazem mecanismo meu.

- **O TÍTULO SAI, e com ele o cabeçalho.** Ele foi encolhendo por partes e
  chegou vazio de função: o "Baixar toda a biblioteca" e o peso total saíram
  na v5.258, o ✕ desceu para a barra no mesmo lote, e o ícone saiu na v5.278.
  O que sobrava era uma faixa inteira repetindo o nome do botão que abre a
  tela — e a barra logo abaixo já diz o que ela é, pela lupa e pelo
  placeholder.
- **A CAMADA PARA DE PERSEGUIR A VIEWPORT VISUAL**, e o operador nomeou o
  método certo: *"ao invés de ter um scroll de tela inteira, deixar apenas os
  itens abaixo da barra de pesquisa ficarem dentro de um scroll, e apenas
  rolar esse scroll para o topo quando a biblioteca é aberta"*. A v5.278 pôs
  `top: var(--vv-top)` no `.popup-backdrop` para a barra não sair pela borda
  quando o navegador rolasse a viewport visual — um conserto para um scroll de
  TELA que não devia existir. Com o cabeçalho fora, a barra é o primeiro
  elemento da folha e a única coisa que rola é a lista: não há o que
  acompanhar. `inset: 0`, e a camada volta a ser a tela.
- **E A LISTA ABRE NO TOPO.** `#hymnResults` é o MESMO nó entre uma abertura e
  a seguinte, então ele guardava a rolagem da vez anterior e a Biblioteca
  reabria no meio de um hinário. Uma linha no `openHymnSearch`.
- **O SCROLL INTERNO DOS FAVORITOS É REVOGADO** — *"não ficou bom, deixe ele
  fixo, e qualquer visualização dos itens completos deve ser pelo botão de ver
  mais"*. A v5.279 tinha aberto uma segunda porta ao lado da que já existia:
  com a rolagem, chegar ao fim da lista tinha DOIS caminhos, e um deles era
  arrastar dentro de uma caixa encaixada numa tela que também rola — o gesto
  ambíguo que o `overscroll-behavior` existia para remendar. O corpo volta a
  ser um recorte imóvel e o caminho é UM.

**O que FICA da v5.279 é a contagem dos dois lados** do botão "Ver todos", e
ela fica com o comentário corrigido: hoje nada pode estar ACIMA da faixa, e
aquela metade nunca dispara. Custa uma comparação e guarda o defeito que a
v5.279 mostrou — com o corpo rolando, uma contagem de um lado só faz o botão
sumir de quem chegou ao fim da lista.

**E o caso da rolagem só discrimina com uma COLEÇÃO ABERTA**, que é uma
propriedade do desenho e não do fixture: com tudo colapsado a lista nunca
transborda, porque o vão dos favoritos é justamente o que sobra.

Verificado por ISOLAMENTO: sem o reset da rolagem, **1** asserção reprova; com
o scroll interno de volta, **1**; com a camada perseguindo a viewport, **1**;
e o cabeçalho de volta reprova o caso da ordem da folha.

---

## v5.279

**A v5.279: O CORPO DOS FAVORITOS ROLA POR DENTRO no modo compacto. OTA PURO**
(sem Release).

Pedido do operador. O vão é uma altura fixa (v5.277) e o que passava dela era
simplesmente CORTADO: para chegar ao quinto favorito era preciso expandir a
lista inteira, isto é, empurrar todas as coleções para fora da tela por causa
de um item.

**Ele NÃO substitui o "Ver todos"**, e as duas coisas respondem a perguntas
diferentes: rolar é folhear alguns atalhos sem mexer no resto da tela;
expandir é abrir mão do índice para ver a lista inteira de uma vez.

**E O BOTÃO QUASE SUMIU JUSTAMENTE DE QUEM PRECISAVA DELE.** A contagem de
itens de fora (v5.276) olhava só para BAIXO — o que era exato enquanto o corpo
era um recorte imóvel. Com a rolagem, no fim da lista não há nada abaixo, e a
régua devolveria zero: o "Ver todos" desapareceria para quem acabou de rolar
até o fim e quer ver tudo. Ela passou a olhar os DOIS lados da faixa visível.

`overscroll-behavior: contain` é o que impede a rolagem de VAZAR para a
Biblioteca ao chegar no fim — sem ele, continuar arrastando dentro dos
favoritos rola a lista de trás e o operador perde de vista a seção em que
estava.

**E o oráculo mediu a coisa errada na primeira versão.** Ele afirmava a
rolagem escrevendo `scrollTop` — e uma caixa `overflow: hidden` **continua
rolando por SCRIPT**: com a regra removida, ele passava (verificado, reprovava
em 0). Quem não rola nela é o DEDO, e é o `overflow-y` COMPUTADO que responde
por isso. Com a régua corrigida, a remoção reprova em 1; e contar um lado só,
em 5.

---

## v5.278

**A v5.278: A BARRA DE CIMA VOLTA A SEGUIR O QUE SE VÊ, o ícone do título sai,
e o alvo dos botões da faixa passa a ser a linha inteira. OTA PURO** (sem
Release).

- **`--kb` E `--vv-top` NÃO SÃO A MESMA CONTA, e a v5.277 tirou as duas de uma
  vez.** Relato: *"ajuste também para que essa barra do topo seja fixa
  independente da rolagem da tela"*. `--kb` ENCOLHE a camada fixa (era o
  *"deslocada inteira para cima"* que ele mandou tirar) e `--vv-top` apenas a
  DESLOCA junto com a viewport visual, que o navegador rola sozinho ao revelar
  o campo em foco. Sem a segunda, medido com uma rolagem de 140px: o cabeçalho
  fica em `top: 0` da viewport de LAYOUT, isto é, **140px acima do que se vê** —
  a barra sai pelo topo da tela. Voltou como `top` + `height: 100%`, e essa
  forma é a decisão: a camada desce inteira, com a MESMA altura. Encolher é o
  que ela não pode fazer — seria o reflow da queixa anterior —, e o pedaço que
  sobra embaixo está debaixo do teclado, que o cobre de qualquer jeito.
- **O ÍCONE DO TÍTULO SAI.** Com o cabeçalho e a barra fundidos numa peça só
  (v5.277), a nota musical virou o terceiro símbolo de uma faixa que já tem a
  lupa dentro do campo e o ✕ ao lado — sem distinguir nada, porque a tela é
  uma só. A grade de três colunas que centrava o título saiu junto: filho
  único num flex centrado já fica no meio.
- **ERRAR POR TRÊS PIXELS NÃO DEVOLVE "NADA ACONTECEU".** Relato: *"é
  extremamente comum tentar clicar em adicionar e acabar tocando no corpo do
  card, abrindo os detalhes da letra"*. O botão tem 40px numa linha de 50 e
  para a 8px da borda: sobram faixas mortas de ~5px acima e abaixo e 8px ao
  lado — e elas não são neutras, porque o corpo da linha tem uma ação PRÓPRIA.
  O alvo cresce por um `::after` até as bordas da linha e **o desenho não muda
  um pixel**: encorpar o botão empurraria o nome, que é a única coisa da linha
  que não se adivinha. Vale para os DOIS botões da faixa — o ▶ tem 38px na
  mesma linha, isto é, a mesma faixa morta e o mesmo desfecho.

**O oráculo do alvo mede o que o DEDO encontra** (`elementFromPoint`), não a
caixa do botão: a queixa é sobre os pixels ao redor dele, e uma asserção de
largura e altura passaria com as faixas mortas intactas. Ele cobra também a
metade negativa — o meio da linha continua abrindo a gaveta da letra —, senão
um alvo que engolisse a linha inteira passaria.

Verificado por ISOLAMENTO: sem a expansão do alvo, **2** asserções reprovam;
sem o `--vv-top` no topo, **1**.

---

## v5.277

**A v5.277: O VÃO DOS FAVORITOS VIRA UMA MEDIDA DE TELA, a coleção rola até o
topo dela, o teclado volta a SOBREPOR, e a barra de título vira uma peça só.
OTA PURO** (sem Release).

Quatro relatos, e os dois primeiros são o mesmo defeito visto de dois ângulos.

- **FLEX REPARTE, e era isso que encolhia os favoritos.** *"Ao abrir uma
  coleção, ele encolhe os favoritos para dar espaço à coleção aberta,
  dividindo os espaços… eu quero que o espaço dos favoritos seja fixo, mas
  seja o espaço proporcional que sobrou após listar as outras coleções
  abaixo."* `flex: 1 1 auto` é uma regra de PARTILHA — dois itens que crescem
  dividem o que sobra —, e a lista de atalhos passava a mudar de tamanho
  conforme o que o operador abrisse noutro lugar da tela. `--fav-vao` é agora
  uma altura em PIXELS, medida em JS a partir das BARRAS das outras seções,
  isto é, do que sobra da tela com todas elas COLAPSADAS: a conta **não
  depende de qual coleção está aberta**, que é a propriedade inteira.
- **E O "ABRINDO PARA CIMA" ERA ESSE ENCOLHIMENTO.** Com o vão fixo, o que
  faltava é a outra metade do pedido: uma coleção aberta no fim da lista
  cresce para fora da tela, e quem a abriu fica olhando a barra dela sem ver um
  item. `alinharGrupoNoTopo` rola a lista até o topo da seção — **depois da
  animação do acordeão**, e essa espera é o achado: durante os 220 ms da
  abertura o conteúdo ainda não existe e a lista não tem para onde rolar. A
  primeira versão usava `requestAnimationFrame`, mediu o layout COLAPSADO e
  rolou **7px de 59 possíveis** (verificado). Quando não há conteúdo abaixo que
  leve a seção até o topo, ela rola até o fim, que é o mais perto que existe.
- **O TECLADO VOLTA A SOBREPOR** — *"a tela está sendo deslocada inteira para
  cima… ajuste apenas para o teclado ficar sobreposto à tela e não deslocar
  ela"*. Isto REVOGA o `inset` da v5.261 no `.popup-backdrop`, e o argumento
  dele morreu junto com a barra na base: ele descia a camada fixa até a faixa
  visível para a busca encostar no teclado em vez de ficar atrás dele. Com a
  barra no topo (v5.275) não há nada embaixo que precise ser revelado, e o que
  sobrava era só o efeito colateral. **O `.dialog-backdrop` FICA com a conta**,
  e a diferença é a razão dela: o `appPrompt` é um cartão CENTRADO com campo de
  texto, e ali a metade de baixo é onde o teclado sobe.
- **O CABEÇALHO E A BARRA VIRAM UMA PEÇA.** Mesmo fundo (`--field-bar`),
  porque duas faixas fixas empilhadas sobre a mesma lista são uma barra só. O
  TÍTULO centra numa grade de três colunas — centrar a linha flex centraria o
  PAR ícone+título e deixaria a palavra 14px fora do meio, medidos. E o ✕ ficou
  QUADRADO por um número com nome (`--campo-alt`, a altura do campo e o lado do
  botão): **`aspect-ratio` não resolve isso dentro de um flex**, porque a
  largura é resolvida ANTES de o `stretch` dar uma altura definida — a primeira
  versão colapsou o botão na largura do glifo, 20px.

Verificado por ISOLAMENTO, uma peça de cada vez: devolvendo o vão ao flex,
**2 + 2** asserções reprovam; sem o alinhamento, **1**; com o teclado
deslocando de novo, **3**; com o cabeçalho e o ✕ antigos, **8**.

---

## v5.276

**A v5.276: OS FAVORITOS SAEM DO RODÍZIO, a coleção aberta para de inchar, e
o "Ver todos" passa a contar ITENS. OTA PURO** (sem Release).

Três correções do mesmo relato, e a terceira é a que mais ensina.

- **O BOTÃO CONTAVA A CAIXA, e a caixa não é a pergunta.** Relato: ele aparece
  *"literalmente sem nenhum item na lista"*. `scrollHeight > clientHeight` é a
  medida certa para "esta caixa transbordou" e a errada para o que o operador
  pediu — *"apenas quando há mais itens do que a altura disponível"*. Numa
  Biblioteca com OITO seções (a dele) o vão é pequeno, a seção dos favoritos é
  a única que encolhe, e o que sobra do corpo recorta até a linha de "Nenhum
  favorito ainda": a caixa transborda com a lista VAZIA. Agora ele conta os
  filhos cujo rodapé passa do corpo, ignorando o `.empty` — com zero itens a
  resposta é zero, e não há medida de caixa que a produza.
- **OS FAVORITOS SAEM DO RODÍZIO** — *"agora não mais são concorrentes com os
  favoritos… as coleções são concorrentes entre si, mas não com os
  favoritos"*. A v5.273 pôs as duas coisas no mesmo nome, e o preço é que
  abrir um hinário custava o atalho que estava aberto, e reabri-lo custava
  fechar o hinário: duas decisões diferentes disputando um interruptor. São
  dois estados agora (`grupoAberto` para as coleções, `favAberto` para eles), e
  o `''` virou um valor legítimo — nenhuma coleção aberta é o estado normal de
  quem está olhando os favoritos. O toque na seção deles volta a fechá-la e a
  reabri-la, que é o que a v5.262 pedia e a v5.273 tinha tirado ao torná-los o
  piso.
- **E SÓ ELES CRESCEM.** *"Coleções com menos itens como o hinário, ou os
  arquivos oficiais… expandem mais do que precisaria em relação à quantidade e
  altura necessária para os itens atuais, pois eles estavam com um tipo de
  altura flex que ao fechar os favoritos ocupa o que sobra"* — dois cards com
  meia tela de fundo vazio embaixo. Uma coleção aberta passou a medir o
  conteúdo dela e nada mais; o vão continua sendo dos Favoritos, que são a
  única seção com razão para tê-lo (uma lista de atalhos vazia ainda é o lugar
  em que o próximo entra).

**O ORÁCULO NÃO PEGAVA O DEFEITO DO BOTÃO, e a razão é a lição do lote:** o
fixture tinha DUAS seções e sobrava tela à vontade, então nada era recortado e
a régua velha dava a mesma resposta que a nova. Ele passou a montar as OITO
seções do relato — é a condição, não o número de favoritos, que produz o
defeito — e a asserção virou uma EQUIVALÊNCIA medida nos três estados: o botão
existe exatamente quando há item de fora, sem lista, com poucos e com muitos.
Com a régua antiga de volta, reprova em 2 (verificado); antes, em 0.

Verificado por ISOLAMENTO nas outras duas: devolvendo os favoritos ao rodízio,
**3** asserções do `boot-nativo.test.mjs` reprovam; fazendo toda seção aberta
crescer, **2** do `smoke.mjs`.

---

## v5.275

**A v5.275: A BARRA DE BUSCA DA BIBLIOTECA VOLTA AO TOPO. OTA PURO** (só HTML,
CSS e os oráculos; sem Release).

Decisão do operador: *"vamos fazer um ajuste e colocar a barra de buscas da
biblioteca no topo novamente, ela na base está dando muitos problemas de
design"*. Isto REVOGA a segunda metade da v5.258.

**O argumento daquele lote continua verdadeiro, e o preço está dito.** Ele era
de ALCANCE — *"eles estão muito longe do teclado e do toque de acesso"* —, e
no topo corrigir a busca com o teclado aberto custa a tela inteira de percurso
do polegar. O que o desmentiu foi o PREÇO DA POSIÇÃO, e ele está escrito neste
arquivo em quatro notas seguidas: **quatro lotes consertando o entorno dela**
— a folha que não via o teclado (v5.261), o teclado subindo durante o fade
(v5.264), o tom e a sombra que faltavam (v5.266) e o degrau do tema claro
(v5.270). Quatro lotes em volta de uma posição são a posição dizendo que não
se paga, que é o mesmo veredito que a v5.263 deu à animação de slide desta
mesma tela. **No topo ela não tem entorno**: nada a empurra, nada a cobre, e
ela não precisa saber onde o teclado está.

**O que FICA da era da base, porque nunca foi sobre estar embaixo:** o ✕
depois do campo (é o fim da linha em toda folha deste app, e o cabeçalho ao
lado não tem mais nenhum), a LUPA dentro do campo (o placeholder some no
primeiro caractere digitado) e o TOM próprio com a SOMBRA. Esta última
**inverte**: ela diz de que lado o conteúdo passa, e a lista deixou de rolar
por cima da barra para rolar por baixo dela. Uma sombra que ficasse apontando
para cima é a marca de quem moveu a peça e esqueceu o que ela dizia — daí ela
ter asserção própria.

**E a área segura trocou de dono.** `#hymnSearchPopup .popup-sheet` zerava o
`padding-bottom` porque quem terminava a folha era a barra, e a conta estava
nela; agora quem termina é a LISTA, e sem devolver a conta à folha o último
item ficaria debaixo da barra de gestos do Android.

Os dois casos do `smoke.mjs` mudaram de lado junto — a ORDEM da folha
(cabeçalho → barra → lista) e a geometria com o teclado de mentira. Eles
continuam travando o que a v5.261 descobriu, que não era sobre a barra: a
folha tem de ser a FAIXA VISÍVEL, senão o que é fixo sai pelo topo da tela.

**Um caso instável foi consertado no caminho, e ele não é deste lote.** O da
assinatura da série (v5.233) reprovava em ~1 de 11 execuções: ele conta
extrações do YouTube, e o `autoRefreshCollections` da abertura roda SEM
`await` — uma extração em voo caía no intervalo medido e era lida como "a
economia não valeu". A linha de base passou a ser tomada com o laço assentado,
e a asserção continua discriminando (uma economia quebrada custaria a dúzia de
playlists da série, não uma unidade). Onze execuções seguidas no verde.

---

## v5.274

**A v5.274: A SEÇÃO ABERTA CENTRAVA E ESPREMIA O QUE HAVIA DENTRO DELA — e
a causa foi trocar o `display` de um elemento. OTA PURO** (só CSS e os
oráculos; sem Release).

Relato do operador sobre a v5.273: *"os cards ficaram com seus elementos
centralizados de forma incorreta, desalinhando e espremendo cabeçalhos e
listas"* — com prints em que "HINÁRIOS 3,2/8,9 GB" aparece centrado na barra e
as linhas do Informativo vazam pelos DOIS lados do card.

**A causa é de uma linha, e ela é a mesma família da v5.269.** `.coll-group`
(a classe base) é `display: flex; align-items: center; gap: .5rem` — e o
`.coll-group--drop` a neutralizava com `display: block`. Pôr a seção ABERTA em
`display: flex` para ela poder crescer **ressuscitou as duas propriedades que
estavam dormindo ali**: `align-items: center` fez cada filho encolher ao
próprio texto e se centrar (a barra), e vazar pelos dois lados quando o texto
era maior que o card (as linhas); o `gap` acrescentou 8px entre a barra e o
corpo. Medido: a barra tinha **204px** e o corpo **251px** dentro de uma seção
de 408. A régua que fica é maior que este defeito: **trocar o `display` de um
elemento não acrescenta um comportamento — ele ATIVA todas as propriedades de
layout que já estavam escritas nele.** Remover uma declaração devolve o valor
de quem estava embaixo (v5.269); trocar o `display` acorda o que estava mudo.

**E o botão "Ver todos" era vítima do mesmo defeito.** Ele mede o transbordo
do corpo (`scrollHeight > clientHeight`), e um corpo cujos filhos vazam pelos
lados e ganham 8px de folga transborda sem ter conteúdo demais — daí ele
aparecer com uma lista que cabia. O caso do oráculo passou a exercitar a régua
no MEIO do caminho (três favoritos, não zero), que é o que o operador
descreveu: *"apenas apareça quando a lista de favoritos for maior que a área
de visualização disponível"*.

**DOIS buracos de cobertura foram fechados no caminho, e o segundo é a lição
do lote.** O primeiro é a asserção que faltava: as LARGURAS dentro da seção
aberta — um filho que se recusa a esticar mede menos que o contêiner, e um que
vaza mede mais, então uma medida só pega os dois. O segundo apareceu porque eu
escrevi a prosa desta nota FORA do comentário de CSS (o `*/` ficou antes
dela): o parser descartou o bloco inteiro, a regra geral da seção aberta
**morreu**, e nenhuma das cinco asserções do lote reprovou — os Favoritos têm
um `flex-grow` PRÓPRIO, então a única seção que o oráculo media continuava
crescendo. Uma regra geral só provada pelo caso que tem exceção própria não
está provada. Agora há uma asserção que abre uma seção QUALQUER e exige que a
lista termine cheia; com a regra morta, ela reprova nos dois temas
(verificado).

---

## v5.273

**A v5.273: A BIBLIOTECA FICA COM UMA SEÇÃO ABERTA POR VEZ, e a dos Favoritos
ocupa o vão que sobra. OTA PURO** (nenhuma linha de Kotlin; sem Release).

Pedido do operador, em quatro partes: *"só permita uma coleção aberta por vez
e sempre deixe uma aberta, no caso a dos favoritos, onde ela só fecha se outra
for aberta. Ajuste para que a seção dos favoritos ocupe a altura que sobra
além do espaço das outras seções no formato colapsado (mesmo que não haja
nenhum favorito)… caso tenha mais itens do que cabe nesse vão, vai ter um
botão na sua base que permite a expansão total da lista. Inclusive aproveite
para: deixar a cor de fundo da coleção dos favoritos em uma cor diferente, um
tom mais escuro. E aproveite também para aumentar ligeiramente o espaço entre
as outras coleções, elas estão muito coladas entre si"*.

*(A v5.276 REVOGOU duas metades desta nota: os Favoritos saíram do rodízio —
abrir uma coleção não os fecha, e o toque neles volta a recolher — e o
crescimento passou a ser só deles, porque uma coleção curta inchava até o
tamanho do vão. E a v5.282 revogou as outras duas: o BOTÃO "Ver todos" e o TOM
PRÓPRIO saíram, com o vão virando um `min-height` — "não ficou bom". O que
fica desta nota é o rodízio ENTRE as coleções, a régua do vão e o espaço entre
seções.)*

- **O ESTADO VIROU UM NOME, e é ele que faz a regra valer.** `gruposAbertos`
  era um `Set`, isto é, sabia escrever exatamente os dois estados que o pedido
  proíbe — duas abertas e nenhuma aberta —, e mantê-los fora do alcance
  exigiria uma guarda em cada ponto que o escreve. Com `grupoAberto` sendo um
  nome só, "duas abertas" deixa de ser uma regra que alguém precisa lembrar:
  é uma frase que não dá para escrever. Fechar a aberta escreve
  `GRUPO_FAVORITOS` e nunca o vazio — o "sempre uma aberta" pelo outro lado —,
  e tocar nos Favoritos abertos é um NO-OP declarado, porque fechá-los para
  reabri-los seria um piscar sem desfecho. **Isto REVOGA a v5.237**
  (*"abrir um grupo não fecha os outros: aqui os grupos são curtos, e comparar
  dois deles é o que se faz numa tela de índice"*) e metade da v5.262 (o toque
  nos Favoritos recolhia). O argumento da v5.237 supunha que a tela cabe; o
  pedido é sobre o que fazer quando ela não cabe.
- **QUEM SE ESTICA É A ABERTA**, e isso é consequência da decisão de cima, não
  uma segunda regra: com uma por vez não há o que escolher — é sempre a única
  com conteúdo, e as fechadas viram barras de altura fixa empilhadas na base.
  `flex-shrink` é ZERO ali: uma seção com mais álbuns do que cabe empurra as
  de baixo e quem rola é a Biblioteca, como sempre foi. **Os Favoritos são a
  exceção** — só eles encolhem, e é dessa exceção que o botão fala.
- **O TRANSBORDO É MEDIDO, nunca deduzido da contagem.** Quantos favoritos
  cabem no vão depende de quantas seções existem, de haver ou não pasta do
  aparelho, da altura da tela e do teclado; um número no código estaria errado
  no primeiro aparelho diferente. `scrollHeight > clientHeight` responde pelo
  que de fato aconteceu no layout — num `requestAnimationFrame`, porque no
  instante em que a lista é montada o `li` ainda não foi disposto e as duas
  medidas seriam iguais (o botão nunca apareceria).
- **O TOM PRÓPRIO VALE ABERTA E FECHADA**, e arrasta o degrau de dentro. As
  medições estão em `tokens.css`; a que decide é 1,30:1 (escuro) e 1,48:1
  (claro) contra o `--panel` das outras seções. `--camada` desce junto porque,
  no tema CLARO, deixar as linhas em `--panel-2` sobre o `--fav-bg` novo daria
  **1,05:1** — elas sumiriam. É a disciplina de sempre: um nível que muda
  arrasta o de dentro.
- **E O `gap` DAS SEÇÕES DEIXOU DE SER O DAS LINHAS** (.6rem contra .35rem):
  uma seção não é uma linha, é um bloco que contém linhas, e usar a mesma
  medida nos dois níveis era o que os fazia se ler como uma pilha só. Escopado
  em `#hymnResults` e nunca na classe — o mesmo `.popup-list` é a fila da
  playlist e o conteúdo de uma pasta.

Verificado por ISOLAMENTO: sem o crescimento, **4** asserções do `smoke.mjs`
reprovam; sem o tom próprio, **2**; sem o espaço, **2**; sem a medição do vão,
**3** do `boot-nativo.test.mjs`; e sem o piso dos Favoritos (fechando-os no
próprio toque), **2**.

**E a primeira versão do caso do vão passava sem medir a regra.** Ela comparava
a altura da seção aberta com a de uma barra fechada — e uma seção aberta é
naturalmente mais alta que uma barra, com ou sem `flex-grow`. O que ela precisa
comparar é o VAZIO que a seção absorveu (altura menos o conteúdo dela) contra
uma seção fechada inteira: com o crescimento removido sobram ~12px de padding
próprio, que é uma folga, não um vão.

---

## v5.272

**A v5.272: CINCO RELATOS DA LISTA — e dois deles eram recursos que nunca
chegaram a existir. OTA PURO** (sem Release).

- **EXCLUIR ENTRA NO `⋮`**, nas duas listas (Cronograma e Favoritos). Até aqui
  excluir era um caminho só, e era o de LOTE: toque longo → seleção múltipla →
  a lixeira do rodapé. Para tirar UM item isso é três gestos e um modo. **A
  semântica é a mesma do lote, e de propósito:** sai da LISTA (`listRemove`) e
  o coletor decide o resto — se o item também estiver noutra lista, ele fica lá
  e os bytes ficam. Duas definições de "excluir" no mesmo app seriam a
  divergência que o `deleteSelected` já evitou uma vez. Na PASTA DO APARELHO
  ele não entra: ali excluir apaga o arquivo físico, e um mesmo ícone com dois
  alcances conforme a tela é a pior forma de oferecer um destrutivo.
- **A LINHA-GUIA DO REORDENAR ESTAVA FORA DE LUGAR NOS FAVORITOS**, e a causa é
  de uma linha: ela é `position: absolute` e mora dentro da `<ul>`, então a
  `<ul>` precisa ser o BLOCO CONTENDOR — o que valia por ACIDENTE, porque o
  Cronograma é uma `.lib-list` (que declara `position: relative` desde sempre)
  e os Favoritos são uma `.popup-list` (que não declara). Lá a guia se
  posicionava contra o `.popup-backdrop` FIXO usando coordenadas medidas em
  relação à lista: *"completamente fora de sincronia e posição"*, palavra por
  palavra. A garantia passou a vir do JS e não de uma regra por lista, porque o
  conjunto de listas que hospedam um arrasto cresce — a v5.237 já acrescentou
  uma terceira, e o modo de falhar é silencioso e só visível com o dedo em cima.
- **AS FAIXAS DO ÁLBUM GANHARAM CORPO** — *"os itens ficam soltos no mesmo
  ambiente, dificultando a visualização de sua área de toque"*. É o degrau que
  a v5.267 não deu: ela tirou o filete e pôs o ESPAÇO no lugar, mas deixou a
  faixa sem fundo, e **um vão da mesma cor dos dois lados não separa nada**. O
  preenchimento é o RECESSO do cartão (overlay, que preserva a direção nos dois
  temas), e não um quarto tom da escada — aquele levaria o nível mais interno a
  onde `--muted` reprova AA.
- **O INFORMATIVO VOLTA A DIZER QUE SÉRIE É.** Relato: os itens saem *"apenas
  com o nome com a data, mas sem a identificação de 'Informativo Mundial das
  Missões'"*. A v5.244 escolheu só a data com um argumento que era verdadeiro
  DENTRO do álbum (o cabeçalho já diz a série; repetir o nome em 52 linhas é a
  metade constante ocupando a lista). **O que ele não viu é que o item SAI do
  álbum:** no Cronograma ou nos Favoritos ele perde o cabeçalho e vira
  "15/Ago · YouTube", sem nada em tela nenhuma que o identifique. Entrou o modo
  `TITULO_SERIE`, com um `rotulo` SEM o ano — o ano já está na data ao lado.
- **E O TOQUE LONGO SAI DOS FAVORITOS.** Relato: *"ao segurar em um item da
  lista de favoritos, ele entra no modo de multiseleção, mas as opções aparecem
  na tela do cronograma"*. Ele está descrevendo um modo que **nunca existiu
  nesta lista**: `enterSelection` liga o estado e chama `renderLibrary()` — que
  redesenha o CRONOGRAMA —, enquanto o `favItemRow` nunca leu `selectionMode`,
  isto é, a linha não ganhava caixa de marcação nem realce. O que aparecia na
  outra tela era a barra de um modo que aqui não tinha o que operar.

  **E o buraco era mais fundo que o desenho:** as ações daquela barra são
  keyadas pelo `activeTab` (ver `deleteSelected`), que aqui aponta para a lista
  ATRÁS da Biblioteca — a lixeira teria apagado itens do Cronograma. Desenhar o
  modo seria consertar a metade que se VÊ de um defeito cuja outra metade
  DESTRÓI. O que ele daria a esta lista — excluir sem sair dela — é o primeiro
  item deste lote, e está a um toque na própria linha.

Verificado por ISOLAMENTO: sem as três correções dos Favoritos, **4** asserções
do `boot-nativo.test.mjs` reprovam; sem o preenchimento da faixa, **2** do
`smoke.mjs`.

**E o `display-smoke` voltou ao verde — ele reprovava um app que estava certo.**
Aquele caso (v5.179) arma a guarda que cala o `sendStatus` do meio do fade,
resolve, e afirmava "viajou UM status". A afirmação supõe que nada mais
estivesse em voo, e havia: o `clear` do passo ANTERIOR tem fade de ~0,6 s e um
`aoSairDeCena` próprio, cujo `then` emite o status final depois de o caso ter
zerado o espião. Chegavam dois, **os dois corretos** (palco vazio,
`playing: false`), e a contagem reprovava. Agora ele espera o fade anterior
assentar (`saindoDeCena === 0`) e mede as DUAS metades no instante de cada uma
— nada viaja durante o fade; um status sai no fim —, o que também diz QUAL
delas quebrou, coisa que uma contagem no fim nunca diz. Verificado nos dois
sentidos: tirando a guarda do `display.js`, as duas reprovam; e cinco execuções
seguidas passam, que era a outra metade do problema (um teste que reprova de
vez em quando ensina a ignorar vermelho). Nenhuma linha da base web mudou —
este conserto é do oráculo, e por isso não há versão nova.

**E o oráculo dos Favoritos quase mediu a lista errada.** Os itens do caso
nascem no Cronograma (é de lá que se favorita), então um `querySelector` de
documento acha a linha DE LÁ — que é posicionada e tem seleção múltipla. Ele
teria passado pelo motivo errado, aprovando o defeito; a busca é escopada ao
`[data-fav-corpo]`.

---

## v5.271

**A v5.271: TRÊS AJUSTES DA LISTA — o Parar toma o lugar da capa, o `⋮` para
de mexer o cartão, e o LINK do YouTube entra no ar como qualquer outro item.
OTA PURO** (sem Release). *(O número saltou o 5.270: um lote paralelo o tomou
enquanto este era escrito — ver a nota abaixo.)*

Os dois primeiros são de desenho e o terceiro é de comportamento — e é ele que
importa mais, porque estava mentindo na tela.

- **O PARAR OCUPA A MINIATURA, e não fica por cima dela.** Pedido do operador:
  *"ele cria por cima dela, faça com que seja apenas o botão de stop sem ser
  por cima, para que fique menos poluído visualmente"*. Ele era um véu preto a
  55% sobre a arte com o glifo em cima — três camadas num quadrado de 40px, e a
  de baixo só atrapalhava: a capa não é legível atrás do véu e não decide nada,
  porque a linha já diz de que item se trata pelo nome e pelo selo. Escondido o
  conteúdo da miniatura, o que sobra é um botão com o MESMO preenchimento dos
  outros da linha (`--surface`, que ali dentro afunda). O véu sai junto com a
  razão dele: sem foto por baixo, não há o que neutralizar. Medido, o glifo dá
  6,02:1 no escuro e 4,09:1 no claro — acima do piso de 3:1 de um ícone.
- **O `⋮` NÃO ENCOLHE MAIS O CARTÃO** — *"como ele abre uma visualização, o
  movimento da caixa polui o conjunto"*. Ele está certo pela régua do próprio
  app: a linha encolhe para dizer "o toque pegou" quando não há outra resposta,
  e aqui HÁ, e ela é grande — uma gaveta que cobre o título inteiro. Duas
  respostas ao mesmo toque, uma mexendo a caixa por baixo da outra que está
  entrando. O BOTÃO continua encolhendo (é ele que foi tocado); o cartão, não.
  **E os botões entram DA DIREITA**, escalonados pelo FIM da lista
  (`nth-last-child`), então o primeiro a chegar é o mais à direita — a borda de
  onde eles vêm — e a regra vale igual com dois botões ou com cinco. Quem
  desliza são os BOTÕES e não a faixa: a faixa é a tampa opaca que cobre o
  título, e movê-la o descobriria durante toda a animação, que é o defeito que
  a v5.259 já corrigiu por outro caminho. De brinde, o `visibility` entrou na
  transição: fora dela a propriedade é discreta e virava `hidden` no primeiro
  quadro, então o FECHAMENTO nunca foi visto em versão nenhuma.
- **O LINK DO YOUTUBE ENTRA NO AR.** Relato: *"um arquivo do tipo YouTube… pode
  ser tocado diretamente online no player, mas o respectivo elemento da lista
  do cronograma ou favorito não entra no modo 'no ar'"*. A causa é uma
  assimetria entre os dois caminhos do `resolverLinkYoutube` (v5.212): pelo
  DOWNLOAD o arquivo toma o lugar do link EM POSIÇÃO, então a linha passa a ter
  o id da mídia; pela TRANSMISSÃO DIRETA, não — a mídia é um avulso com id
  próprio, o link continua na lista com o dele, e nada ligava os dois.

  **E não era só o realce.** `noArAgora` responde pela MESMA pergunta, então o
  SEGUNDO TOQUE (que retira do ar) também não alcançava aquela linha: ela
  reprojetava em vez de retirar — o defeito que a v5.165 existiu para
  consertar, reaberto por outra porta. Um realce que dissesse uma coisa e um
  gesto que fizesse outra seria pior que o defeito inteiro.

  `midiaNoArOrigem` é o campo que faltava, e ele é o mesmo formato do
  `cueNoArId` pela mesma razão: **quem está no ar e quem PÔS no ar podem ser
  dois registros diferentes, e a lista fala do segundo.** Ele é escrito só
  naquele caminho e DEPOIS do `tentarTransmitir` — que termina em `send()`, e é
  o `send` que o zera. Essa ordem é a única forma de errar isto, e é o que o
  oráculo exercita: ele substitui o `tentarTransmitir` por um que faz o que o
  de verdade faz no fim, em vez de pular a chamada.

Os oráculos foram verificados por ISOLAMENTO, uma peça de cada vez: sem a
origem, **3** asserções do `boot-nativo.test.mjs` reprovam; devolvendo o véu e
a capa, o feedback no cartão e o deslize, **4** do `cena.test.mjs`.

**E dois defeitos foram do próprio teste, os dois da mesma família — medir no
turno errado.** O caso do deslize lia o `transform` no mesmo turno em que
acrescentava a classe, e ali o computado ainda é o valor de PARTIDA: ele
aprovaria uma gaveta sem animação nenhuma e reprovaria a que existe. E o caso
da pressão no `⋮` derrubava o caso seguinte, porque um `mouse.down` + `up`
completo É UM CLIQUE — ele abria a gaveta, e o `abrirGaveta` de baixo a
fechava.

---

## v5.270

**A v5.270: A BARRA DA BUSCA ESCURECE NO TEMA CLARO, e o ✕ vira o irmão do
campo. OTA PURO** (só CSS; sem Release).

Pedido do operador, em três partes: *"ajuste o botão de fechar biblioteca para
que tenha a mesma altura da caixa de texto de buscas. e faça com que o fundo
atrás da caixa de texto fique mais escuro no tema claro, aproveitando para pôr
o botão em cor clara também."*

- **A BARRA DEIXA DE SER NÍVEL 1, e isso é o conserto que a v5.268 contornou.**
  Ela vestia `--camada` — e no tema CLARO esse nível É o branco, exatamente a
  cor do campo que ela contém: **1,00:1**. A v5.268 sustentou a distinção pela
  ELEVAÇÃO, que funciona e é meia resposta; o operador pediu o degrau de tom, e
  ele está certo. `--field-bar` é a exceção declarada à escada de camadas: **a
  barra é o único bloco de nível 1 do app que hospeda uma superfície SEM TEMA**,
  logo é o único que não pode ler o tom do nível. Medido no claro: o campo
  passou de 1,00 para **2,51:1** contra ela, e ela dá 1,95:1 contra o corpo (era
  1,29). No ESCURO nada muda — o token repete o valor de hoje, porque ali o
  campo branco já contrastava 12,6:1 e não havia o que consertar.

  O valor do claro é `#97a5b4`, o mesmo de `--line`, e isso é reuso e não
  coincidência: é o cinza estrutural que esta paleta já calibrou para separar
  coisas no tema claro.
- **O ✕ TEM A ALTURA DO CAMPO.** Ele vinha do esqueleto de botão de ícone do
  app (`--hit` quadrado, 34px) e o campo tem 40 — dois vizinhos na mesma linha
  com seis pixels de diferença que ninguém decidiu. `align-self: stretch`, e
  não uma altura escrita: quem manda na linha é o campo, e um número aqui
  divergiria dele no primeiro ajuste de padding ou de fonte. A LARGURA continua
  `--hit` (o alvo horizontal não tem por que crescer) e o raio passa a ser o do
  campo.
- **E ELE É CLARO, como o campo** — a outra metade do mesmo pedido, e ela é
  consequência da primeira: com a barra escurecida, um botão em
  `--surface-2`/`--muted` daria **2,09:1** no glifo. Vestindo `--field-*` ele
  vira o irmão do campo, as duas peças claras sobre a faixa, e o glifo volta a
  8,86:1.

**A elevação da v5.268 FICA**, agora como reforço em vez de único sinal: com o
degrau de tom no lugar, ela é o que faz as duas peças se lerem como papel
pousado na faixa em vez de recortes dela. O oráculo mudou de pergunta junto —
onde ele aceitava "tom OU elevação", ele passou a exigir o TOM (> 1,5:1) e a
cobrar a elevação em separado.

Verificado por ISOLAMENTO: devolvendo a barra ao `--camada`, **1** asserção
reprova (e é a do tema claro, em 1,00:1); devolvendo o ✕ ao esqueleto de 34px e
ao chip translúcido, **5** — entre elas o glifo em 1,75:1.

---

## v5.269

**A v5.269: TIRAR A BORDA NÃO É REMOVER A BORDA — o `<button>` já vem com uma
do navegador. OTA PURO** (só CSS e o oráculo; sem Release). *(O número saltou
o 5.268: um lote paralelo o tomou enquanto este era escrito — ver a nota
abaixo. O relato é sobre a v5.267 no aparelho.)*

Relato do operador, sobre a v5.267 no aparelho: *"os botões agora estão usando
o sistema de sombras nativo padrão do sistema, isso está criando um contorno
bicolor no geral nos botões que foi removido as linha de borda… a exemplo
seriam os botões do controle do modo avançado."*

**Ele está certo, e o diagnóstico dele é literal: aquilo é o desenho nativo.**
A folha do UA dá a todo `<button>` um `border: 2px outset` e a todo
`<input>`/`<textarea>` um `2px inset` — e `outset` é um BISEL, isto é, duas
cores. Ao tirar as ~80 declarações de `border` da v5.267 eu não removi borda
nenhuma daqueles controles: **deixei passar a do navegador.** Medido no
renderizado: `2px outset rgb(0, 0, 0)` no transporte, no mixer, no "Guardar a
fila", no estado do telão, no botão de atualização e nos dois da folha de
conectar. O `appearance: none` que muitos deles já declaravam não cobre isso —
ele desliga o desenho nativo do CONTROLE, não a borda da folha do UA.

A correção é uma linha, e o lugar dela é a decisão: **`border: 0` no reset
universal**, não `border: none` em cada regra. Escrever componente a
componente seria a mesma sincronização manual que este projeto recusa em toda
parte, com um modo de falhar pior — o esquecimento não aparece na folha,
aparece no aparelho, que é exatamente como este chegou. `*` não alcança
pseudo-elemento, então os dois DESENHOS feitos de borda (o aro do `.dl-ring`,
o ✓ do seletor de destinos) sobrevivem sem precisar de exceção.

**E o oráculo que faltava é o do RENDERIZADO.** `tools/tokens.test.mjs` varre
a FONTE e prova que nenhuma regra NOSSA desenha contorno — ele é cego POR
CONSTRUÇÃO para este defeito, porque o defeito é a AUSÊNCIA de uma declaração.
O caso novo do `smoke.mjs` mede a cor e a largura computadas de todo elemento,
e ABRE cada tela em que os controles moram (transporte, mixer, Ferramentas,
Bíblia, Biblioteca, Exibição, Modo Fácil) antes de medir: os botões que o
operador viu e os que só existem numa aba nunca estão na mesma tela, e um caso
que medisse só a tela inicial teria passado com o defeito inteiro no lugar.

A régua que fica, e ela é mais larga que CSS: **remover a nossa declaração de
uma propriedade não a zera — devolve o valor de quem estava embaixo.** É a
mesma família do `optBoolean` lendo campo ausente como `false` e do `ritmo`
zerado da v5.206: a ausência não produz silêncio, produz um padrão que alguém
interpreta.

Verificado por isolamento: tirando só o `border: 0` do reset, a varredura do
renderizado reprova sozinha.

---

## v5.268

**A v5.268: O CAMPO DE BUSCA FICA BRANCO NOS DOIS TEMAS. OTA PURO** (só CSS;
sem Release).

Pedido do operador: *"coloque a caixa de texto em branco, para o tema claro e
o escuro."*

Ele era um OVERLAY — a superfície INVERTIDA de dentro de um bloco, isto é, um
recesso preto a 14%/20%: o desenho de um botão afundado, para a única peça da
tela em que se DIGITA. Branco, ele deixa de ser um degrau da base e passa a ser
uma folha de papel sobre a barra.

**Três metades, e só a primeira está no pedido.**

- **O FUNDO.** `--field-bg`, branco literal, e é a SEGUNDA exceção declarada à
  regra "não escrever branco fora do palco". O argumento daquela regra continua
  de pé e o preço está dito: num salão escuro este é o retângulo mais luminoso
  da tela. Ele é pequeno, só existe com a Biblioteca aberta, e é uma escolha
  explícita de quem opera.
- **O QUE MORA DENTRO DELE, que reprovaria calado.** O texto, o placeholder e a
  lupa. No tema escuro `--text` é um off-white e sobre branco dá **1,17:1** —
  invisível. Então os três param de seguir o tema junto com o fundo:
  `--field-text` e `--field-muted` vivem no bloco COMPARTILHADO de
  `tokens.css`, pelo mesmo motivo que os `--stage-*` — **uma superfície que não
  segue o tema não pode ler tokens que seguem** (a regra da v5.219 num lugar
  novo). Medido nos dois temas: texto 8,86:1, placeholder e lupa 6,08:1.
- **A ELEVAÇÃO, que a v5.267 tornou obrigatória.** Aquele lote fez da barra um
  bloco de nível 1 (`--camada`) — e no tema CLARO esse nível É o branco. Campo
  branco sobre barra branca dá **1,00:1**: o campo não existe. Não há tom que
  resolva sem desfazer uma das duas decisões, e contorno está fora desde que a
  linha saiu do app inteiro. Sobra a profundidade, que é o argumento que esta
  mesma tela já usa duas vezes: a barra tem sombra porque as seções vestem o
  nível dela, e a tampa do álbum aberto tem a dela pelo mesmo motivo. **Duas
  superfícies do mesmo tom se separam por profundidade.** No escuro ela é
  invisível (o campo contrasta 12,6:1 com a barra) e não custa nada.

O oráculo mudou de pergunta junto: onde ele exigia um degrau de tom entre campo
e barra, ele passou a exigir **tom OU elevação** — que é a regra de verdade — e
a cobrar a elevação em separado, senão o "ou" a deixaria opcional.

Verificado por ISOLAMENTO, e os dois últimos casos são os que importam:
devolvendo o recesso, **6** asserções reprovam; pintando **só o fundo** de
branco e deixando as três cores de dentro seguirem o tema, **3** (todas no
escuro, com o texto em 1,33:1); e branco **sem a elevação**, **3** — das quais
duas no tema claro, onde o campo simplesmente some.

---

## v5.267

**A v5.267: O CONTORNO SAI DO APP INTEIRO, e a Biblioteca ganha uma escada de
camadas de verdade. OTA PURO** (nenhuma linha de Kotlin; sem Release).

Pedido do operador, em duas metades que são a mesma metade: *"não tenhamos
itens usando linha de borda, tudo deve ser com preenchimento sólido, e
definição feita por puro e simples contraste entre os elementos"* e
*"reorganizar os degraus de tons em elementos vizinhos ou parentes… problema
que considero prioridade na biblioteca e suas seções, álbuns e listas, onde
elas funcionam em camadas de ramificações que visualmente se parecem muito,
dificultando discernir se estou em uma camada ou subcamada."*

**Elas são a mesma porque quando a linha some, o degrau de tom vira a ÚNICA
coisa que separa duas caixas** — e o degrau que este app tinha foi calibrado
numa época em que ele era reforço. O comentário da escada dizia isso com todas
as letras: *"o par painel × painel-2 fica logo abaixo do piso de 1,3:1 — e é
assumido: ele não carrega o estado sozinho em lugar nenhum. Quem diz
'selecionado' é sempre a BORDA em `--accent`."* Tirar a borda sem mexer no
degrau seria apagar o sinal e deixar o reforço no lugar dele.

**O CONTORNO.** Saíram **82 declarações** de `border`/`outline`. Sobrevivem
dois DESENHOS — os aros que giram (`.dl-ring`, `.av-stage-busy`) e o ✓ do
seletor de destinos —, nomeados um a um no oráculo, porque uma heurística
("anéis podem") deixaria a próxima borda entrar chamando-se desenho. O que
substituiu cada família está tabelado em `docs/ARQUITETURA-WEB.md`; as três
decisões que valem para além do lote:

- **Os fundos de ESTADO viraram opacos** (`--sel-fill`, `--live-fill`,
  `--ok-fill`), e isso é medido, não gosto: `--accent-soft` a 16% sobre o
  painel compõe **#3d4959**, que é o `--panel-2` desta paleta. Uma linha
  SELECIONADA ficava com a cor exata do nível de baixo da árvore, e o que a
  distinguia era só a borda que saiu. Opacos, os três valem o mesmo em qualquer
  nível — um estado SAI da escada em vez de ocupar um degrau dela. E o sinal
  principal deles é a MATIZ: `--live-fill` fica a 1,03:1 do painel de
  propósito, porque uma linha vermelha entre linhas cinzas se acha sem precisar
  ser mais clara, e a matiz é o que sobrevive ao brilho baixo de um salão.
- **A régua do vermelho mudou de eixo.** Era "preenchido × contornado"; virou
  a INTENSIDADE do mesmo preenchimento — saturado é "está no ar agora" e não
  pode ter concorrente na tela, suave é a ação destrutiva.
- **A aresta de 1px do tema claro (`--control-edge`, v5.207) saiu**, e ela era
  exatamente o mecanismo que este lote veio remover. O diagnóstico dela
  continua certo (`--surface` dava 1,14:1 contra o painel branco — um botão
  invisível); o remédio virou outro: os dois overlays afundados foram a
  .14/.20 e devolvem **1,32:1** e **1,51:1** ao mesmo par, por preenchimento.

**A BIBLIOTECA.** O defeito não era só o degrau. A folha dela era `--panel` —
um tom de CARTÃO —, então a árvore começava no nível 1 e gastava na raiz o
degrau que faltaria três níveis adiante; e o corpo da seção ficava com a cor
da FOLHA, de modo que o card de álbum pousava no mesmo fundo em que a barra da
seção pousa, isto é, lia-se como IRMÃO dela. A v5.241 chamou os dois de
"contêiner" e lhes deu o mesmo tom; são contêineres, e não são o MESMO
contêiner — um está dentro do outro.

```
folha de tela cheia   --bg          nível 0   (era --panel)
  └ seção             --panel       nível 1   (barra + corpo, UM bloco sólido)
      └ card do álbum --panel-2     nível 2
          └ faixa     (sem fundo)   separada da vizinha pelo ESPAÇO
```

---

## v5.263

**A v5.263 tinha recusado a troca da folha com um argumento MEDIDO, e ele
expirou junto com a paleta:** *"no tema CLARO `--bg` (#dfe3e7) e `--panel-2`
(#dee2e8) diferem em um ponto por canal, então as barras de seção e os cards
de álbum sumiriam dentro da tela."* Verdade naquela paleta — e hoje a seção
veste `--panel` (1,29:1 contra a página) e o álbum, `--panel-2` (1,41:1 contra
ela): os dois tons daquela frase deixaram de se encostar.

**`--camada` é o mecanismo, e ele existe porque uma lista de seletores
descendentes não sobrevive à próxima tela.** Uma propriedade com um
significado só — *o tom que um bloco filho DESTE contêiner deve vestir* —, que
herda. Quem a declara é o CONTÊINER, nunca quem pinta: uma propriedade escrita
no próprio elemento vence na hora de ELE resolver `var(--camada)`, então um
bloco que reservasse o tom dos filhos em si mesmo passaria a vestir aquele tom.
A primeira versão desta regra pôs a seção na lista e ela passou a vestir a cor
do card — o defeito da v5.241 de volta, pego pelo oráculo nos dois temas.

**A ESCADA PARA EM TRÊS DEGRAUS, e isso é aritmética.** Um quarto tom levaria
o nível mais interno a ~#4c5865 no escuro, onde `--muted` mede 3,59:1 e
`--accent` 3,37:1 — os dois reprovam AA para texto pequeno, que é o tamanho do
texto de uma linha de lista. Quem carrega o quarto nível é o ESPAÇO.

**E o tema claro NÃO pode ser monotônico**, o que o oráculo descobriu contra a
versão correta do desenho: a página é cinza e o nível 1 é branco (a convenção
de toda UI clara), então o primeiro degrau sobe e os seguintes só podem descer.
Folha e card ficam a 1,09:1 e isso não se lê como ambiguidade porque os dois
**nunca se encostam** — entre eles há sempre a moldura branca da seção. A
asserção passou a medir os pares ADJACENTES (piso 1,28) e a exigir apenas que
nenhum par coincida (piso 1,05); a primeira versão dela exigia monotonia e
reprovava um desenho correto.

**DUAS REGRESSÕES FORAM PEGAS POR MEDIÇÃO, e nenhuma teria aparecido lendo o
código.** A primeira: com a folha da Biblioteca virando nível 0, o campo de
busca da barra de baixo voltou a flutuar — `--surface-2` (branco a 92%) sobre
um `--panel` que no tema CLARO é branco puro, **1,00:1** medido. É o defeito
que a v5.207 corrigiu na barra da tela principal, reaberto por outra porta. A
segunda é o `--camada` na seção, acima.

**E o oráculo da escada quase aprovou o defeito que ele existe para pegar:**
`lum()` lê `rgba(0, 0, 0, 0)` como PRETO, então um nível que não pinta nada
entrava na conta como o fundo mais escuro possível e produzia um degrau enorme.
Sem a guarda de opacidade, o caso APROVAVA a folha anterior — verificado. Um
teste que aprova o defeito que ele existe para pegar é pior que teste nenhum.

Verificado por ISOLAMENTO, com os oráculos novos contra a folha anterior: o
`tokens.test.mjs` reprova em **82** contornos e o `smoke.mjs` em **8**
asserções.

---

## v5.266

**A v5.266: A BARRA DE BUSCA GANHA TOM E SOMBRA — agora que ela flutua, ela
precisa se destacar. OTA PURO** (só CSS; sem Release).

Pedido do operador: *"crie um contraste melhor entre a barra de buscas e o
corpo da tela de biblioteca, pois agora que ela é 'flutuante' ela precisa se
destacar."*

Ele está cobrando a consequência de três lotes: a barra desceu para o rodapé
(v5.258), a folha passou a ser a faixa visível para ela encostar no teclado
(v5.261) e a tela deixou de deslizar (v5.263). Ela virou uma barra fixa sobre
a qual a lista rola — e **não tinha fundo nenhum**: herdava o `--panel` da
folha, com um filete de 1px como único separador.

São DOIS sinais, e os dois já existiam neste app:

- **O TOM.** `--panel-2` é o tom de CONTÊINER da Biblioteca (v5.241), e o
  degrau que ele dá contra a folha é **o mesmo que a `.bottombar` usa contra o
  fundo da tela principal**: medido, 1,29:1 no escuro e 1,30:1 no claro, contra
  os 1,32/1,29 de lá. É a régua do próprio app para "separar duas caixas", e é
  nela que o oráculo ancora — um número escrito no teste apodreceria na
  primeira mudança de token.
- **A SOMBRA**, que é o que o tom sozinho não diz: *conteúdo passa por baixo
  daqui*. Mesma receita da tampa do álbum aberto
  (`.hymnal-card.expanded .coll-bar`), invertida — o precedente deste app para
  uma barra sob a qual a lista rola. E ela é necessária MESMO com o tom: as
  barras de seção e os cards de álbum também são `--panel-2`, então um deles
  encostando na barra sem a sombra leria como uma peça só.

**O atalho plausível é errado, e o oráculo o reprova.** `--bar` é o token da
barra de baixo da tela principal — parece ser exatamente isto —, mas ele foi
calibrado contra `--bg`, e no tema CLARO ele é branco puro, **a mesma cor da
folha: 1,00:1**. Verificado: trocando `--panel-2` por `--bar`, 4 asserções
reprovam.

O `border-top` saiu: entre dois tons e com a sombra, o filete é um terceiro
separador na mesma junta — borda somada a sombra é o filete duplo que a v5.261
já tinha tirado do `#favSearchBar`.

**E o CAMPO foi medido junto**, porque a barra mudar de tom podia engoli-lo:
ele é um overlay (`--surface-sunk`, a superfície INVERTIDA de dentro de um
cartão), então clarear a base clareia os dois. Medido, ele não piorou —
1,10 → 1,16:1 no escuro, 1,45 → 1,44:1 no claro —, e o oráculo o cobra ao lado
dos outros três: um destaque que apaga o que a barra existe para conter não é
destaque.

Verificado por ISOLAMENTO: sem fundo e sem sombra (o estado anterior),
**6** asserções reprovam; com `--bar` no lugar do tom, **4**; com o tom mas sem
a sombra, **2**.

---

## v5.265

**A v5.265: O "~" SAI DAS CONTAGENS DE PESO. OTA PURO** (nenhuma linha de
Kotlin; sem Release).

Pedido do operador: *"pode remover o símbolo de aproximado/estimativa que usa
nas contagens de peso dos arquivos e coletâneas da biblioteca."*

**O número continua sendo uma estimativa; o que sai é o símbolo.** O total de
um álbum é calculado por duração × a taxa medida no próprio aparelho, e isso
não mudou — a Biblioteca segue respondendo "quanto isto vai custar" com um
palpite, como sempre respondeu.

O argumento anterior estava escrito no `medirColecao` e era este: *"o `~` na
tela é parte da informação, não enfeite"*. Ele supõe que, sem o til, o número
seja lido como EXATO — e não é: `fmtBytes` arredonda para uma casa decimal por
desenho (o comentário dele diz, com todas as letras, que "148,3 MB é uma
precisão que a medida não tem"). "18 MB" nunca prometeu 18.874.368 bytes. O
til pagava um caractere em cada contagem da tela mais densa do app — e são
três por linha em alguns cabeçalhos — para dizer o que a precisão do próprio
número já diz.

Com ele fora, os dois ramos de `fracaoPeso` (nada baixado × parcial) passaram
a ter a mesma FORMA e a diferir só no número. Isso não afrouxa nada: é
justamente por eles serem indistinguíveis na tela que a definição de
"completo" tinha de ser uma só (`colecaoCompleta`), que é o que aquele bloco
já garantia desde a v5.134.

**E `fmtBytesPar` sumiu por consequência.** Ela recebia o separador em
parâmetro porque as duas formas de "tanto de tanto" diferiam só nele; a forma
por extenso saiu na v5.232 e o "~" saiu agora — sobrou um chamador com um
valor, isto é, uma constante disfarçada de parâmetro. O corpo dela virou o
`fmtFracBytes`.

O oráculo entrou no `acervo.test.mjs`, que é onde as contas da Biblioteca já
moram, e cobra as DUAS metades: o "~" some **e o par de números continua** —
era ele que respondia "quanto já tenho / quanto vai custar" numa leitura só, e
uma remoção que o levasse junto seria uma subtração, não uma limpeza. Reprova
em 3 asserções contra o código anterior.

---

## v5.264

**A v5.264: A TELA VEM NUM TEMPO E O TECLADO NO SEGUINTE, e o campo de busca
ganha a lupa. OTA PURO** (nenhuma linha de Kotlin; sem Release).

- **O TECLADO É PEDIDO DEPOIS DO FADE** — *"coloque um pequeno delay na
  abertura da biblioteca, em um tempo a tela aparece e no segundo tempo o
  teclado. isso vai fazer a tela piscar menos."* O que ele descreve tem causa
  conhecida e ela é a soma de dois lotes: a tela entra por um fade de .25s
  (v5.263) e o teclado, subindo ao mesmo tempo, ENCOLHE a faixa visível
  (`--kb`/`--vv-top`, v5.261) quadro a quadro — a folha é remedida enquanto
  ainda está aparecendo. São dois movimentos sobre a mesma peça, e é isso que
  se lê como piscar. Com o `focus()` adiado em 260 ms (o fade mais um quadro),
  a remedição acontece uma vez, sobre uma tela já opaca e parada.

  **ISTO REVOGA UMA REGRA QUE ESTAVA ESCRITA NO CÓDIGO, e o risco fica dito em
  vez de escondido.** O comentário anterior do `openHymnSearch` dizia:
  *"síncrono e dentro do gesto: `focus()` adiado sai da interação do toque, e
  aí o WebView aceita o foco mas NÃO abre o teclado — o pior resultado
  possível, porque parece que funcionou."* Ele descreve um comportamento
  observado em aparelho, e **nenhum teste deste repositório consegue
  contradizê-lo**: num Chromium de mesa não existe teclado virtual. O que
  sustenta a mudança é que o gatilho do teclado no Chromium é a ativação
  transitória do usuário, cuja janela é de segundos — 260 ms cabem nela com
  folga — e que **o preço de estar errado é conhecido e pequeno**: o campo fica
  focado sem teclado e o operador toca nele uma vez, que é o comportamento
  anterior à v5.131. Se o teclado parar de subir no aparelho, a causa é esta e
  a volta é uma linha, nomeada no próprio comentário.

  **E fechar dentro da janela CANCELA o adiamento.** Sem isso o `focus()`
  cairia num campo já fora de cena e o teclado subiria sozinho por cima do app,
  sem nada na tela que o explicasse — é a asserção que mais importa das três,
  porque é a única cujo defeito não se percebe testando o caminho feliz.
- **A LUPA DENTRO DO CAMPO** — *"isso vai indicar melhor o objetivo da barra"*.
  Com a barra na base, sem cabeçalho por perto e com um ✕ ao lado, o
  placeholder era a única coisa dizendo o que aquela caixa faz — e ele some no
  primeiro caractere digitado. Ela vai **dentro** do campo, não ao lado: ao
  lado seria mais um item da linha flex disputando largura com o campo e com o
  ✕; dentro, ela é do campo, que é o que ela nomeia. É **decoração**
  (`pointer-events: none`), porque um ícone que engole o toque no canto de um
  campo de texto é um ponto morto exatamente onde o dedo mira.

  **E o desenho é UM só:** ele já existia em JS (`searchIconSvg`, o botão de
  pesquisar no YouTube) e virou `<symbol id="icoLupa">` no sprite do
  `index.html`, com as duas pontas referenciando-o. Duas cópias do mesmo ícone
  divergem no primeiro ajuste, e é para isso que aquele sprite existe.

Verificado por ISOLAMENTO: devolvendo o `focus()` síncrono, **2** asserções
reprovam; tirando só o cancelamento do fechar, **1**; tirando a lupa, **3**.

---

## v5.263

**A v5.263: A BIBLIOTECA VIRA UMA TELA — o slide sai por inteiro, e o verde
sai dos indicadores. OTA PURO** (nenhuma linha de Kotlin; sem Release).

Três pedidos, e o primeiro **REVOGA a v5.262**: *"troque a animação de slide
vertical, há muitos problemas com ela por causa do teclado, então faça apenas
um fade in e out para a biblioteca, e faça dela uma tela inteira e não um tipo
de pop up."*

- **O SLIDE SAI, e o operador está encerrando uma sequência de três lotes.** A
  v5.258 desceu a barra de busca para o rodapé, a v5.261 descobriu que a camada
  fixa ignorava o teclado, e a v5.262 inverteu o sentido do movimento — três
  correções em volta de uma animação que só existia para dizer "isto é uma
  folha". **Três lotes seguidos consertando o entorno de uma animação são a
  animação dizendo que não vale o preço**, e ele nunca foi só estético: um
  `transform` na folha a torna o bloco-contêiner de tudo que for
  `position: fixed` lá dentro, e ela é a única superfície do app que hospeda um
  campo de texto colado no teclado. Fica a opacidade do `.popup-backdrop`, que
  já é o fade de todas as camadas deste app — nada de novo; o bloco de CSS
  apenas DESLIGA o resto. O **scrim** sai junto: era invisível (a folha cobre
  100%), mas existia durante os .25s do fade, e era o último tique de popup.
- **MAS O FUNDO CONTINUA `--panel`, e isso é medido.** A leitura natural de
  "tela inteira e não popup" é trocar o fundo pela cor da página; no tema CLARO
  `--bg` (#dfe3e7) e `--panel-2` (#dee2e8) diferem em **um ponto por canal**,
  então as barras de seção e os cards de álbum sumiriam dentro da tela — o
  defeito exato que a v5.241 mediu e corrigiu. A escala de tons da Biblioteca é
  RELATIVA à folha, e a folha precisa continuar um tom acima do que contém.
- **O VERDE SAI DOS INDICADORES** — *"remova a cor verde dos indicadores de
  tamanho das coleções e também dos itens sobre a conclusão das atualizações
  completas."* É a régua que já tirou o peso do painel do álbum (v5.232) e o
  contador dos Favoritos (v5.239): **a mesma coisa dita duas vezes.** "24/24"
  já diz que o álbum está inteiro e "Já no aparelho" já diz que os bytes estão
  aqui; o verde ao lado não acrescenta um bit e gasta a única cor que este app
  reserva para "concluído/conectado". Saíram `.coll-group-count.done`,
  `.coll-opt-estado.done` e a cor de `.item-detalhe-estado.done` — **a ÊNFASE
  fica** (o negrito distingue o resolvido do neutro sem pintar nada), e o verde
  continua onde é o único sinal (a linha de aviso, o pulso, a tela conectada).
  Junto saiu `.coll-bar-dl.done`, CSS morto desde a v5.135, e as quatro
  atribuições de classe que agora não teriam regra.
- **E OS TÍTULOS DAS COLEÇÕES FICARAM MAIORES** (`.8rem` → `.9rem`). A v5.262
  se contentou com "a seção chega perto do álbum", e perto não é uma escala: a
  régua passou a ser **estritamente decrescente para dentro** — 14,4 > 14,08 >
  13,12px —, que é a única leitura que uma árvore oferece de graça.

Verificado por ISOLAMENTO, uma peça de cada vez: devolvendo o slide e o scrim,
**2** asserções reprovam; devolvendo a seção a `.8rem`, **1**; devolvendo o
verde aos três indicadores, **1**. O caso do verde mede por ELEMENTO DE PROVA
e não pelo desenho: os três estados só existem com uma coleção inteira no
aparelho, e um fixture sem isso devolveria a cor herdada do `<body>` nos três
— uma desigualdade que passa sem medir nada (a lição da v5.208).

---

## v5.262

**A v5.262: A BIBLIOTECA SOBE DA BASE, os Favoritos ganham a seta que
faltava, e a escala de títulos passa a ser uma escala. OTA PURO** (nenhuma
linha de Kotlin; sem Release).

Quatro pedidos do operador no mesmo lote, e o último precisou de medição antes
de qualquer linha.

- **A ANIMAÇÃO INVERTEU** — *"que ela seja vertical de baixo para cima"*. Ela
  descia do topo desde sempre, e o argumento estava escrito aqui: *"a bandeja
  fica no topo e os resultados abaixo, sem serem cobertos pelo teclado que sobe
  da base"*. **Esse argumento morreu em dois lotes** — a busca desceu para o
  rodapé (v5.258) e a folha passou a ser a faixa visível (v5.261), então nada
  nela é coberto por nada. O que restava era a única folha do app que se movia
  ao contrário de todas as outras. Subindo, ela chega pelo mesmo lado em que
  estão o dedo, o teclado e a barra de busca. O bloco de CSS **saiu inteiro**:
  ele existia só para sobrescrever o `translateY(100%)` e os cantos retos que o
  `.popup-sheet--full` já argumenta.
- **OS FAVORITOS COLAPSAM, e continuam abrindo abertos.** A v5.238 os fez
  `fixo` — sem seta e sem ouvinte — com o argumento de que *"um atalho atrás de
  um toque a mais deixa de ser atalho"*. Ele continua valendo, e é exatamente o
  que sobrevive: **o padrão é ABERTO**, agora como uma linha de `grupoAberto`
  no topo do arquivo em vez de uma exceção espalhada pelo construtor. (E a
  v5.273 revogou a outra metade: o toque NELA deixou de recolhê-la — ela só
  fecha quando outra seção abre.) O que ele
  não justificava era a seção ser a ÚNICA da tela que não responde ao gesto que
  todas as outras respondem — quem tem trinta favoritos não tinha como
  recolhê-los para chegar aos álbuns. A opção `fixo` saiu do `grupo()`, e com
  ela `.coll-group-icon.vago` e `.coll-group--drop.fixo`. Fechar dura a sessão,
  como em qualquer outro grupo: reabrir sozinha a cada visita faria dela a
  única seção que desfaz o que o operador acabou de fazer.
- **OS ARQUIVOS OFICIAIS VÊM ANTES DOS HINÁRIOS.** A ordem anterior era a da
  IDADE dos dois grupos, não a do uso: o hinário é o acervo permanente, a que
  se chega pela busca, pelo número ou pelo nome; os oficiais são o material
  DATADO do sábado que vem, e é a eles que se volta toda semana.
- **A ESCALA DE TÍTULOS, e aqui a medição desmentiu metade do diagnóstico
  natural.** Relato: *"o título das coleções está pequeno, o dos álbuns maior e
  o dos items diferente… o texto dos itens precisa dar uma leve reduzida para
  garantir a visualização do texto completo."* Medido numa lista de 390px:

  | nível | fonte | espaço | texto |
  |---|---|---|---|
  | seção | 11,84px (700, caixa alta) | 263px | 263px |
  | álbum | 15,20px (700) | 264px | 264px |
  | item | **15,20px** (500) | **238px** | **541px** |

  São duas coisas de uma vez. A hierarquia estava INVERTIDA nas pontas — o
  nível mais externo era o menor e os dois de dentro EMPATAVAM —, e **é o
  empate que faz o item "parecer diferente"**: ele não é maior nem menor que o
  álbum, só tem outro peso, então o olho não lê nível nenhum. E o item é o
  único que de fato corta, com a MENOR largura disponível dos três para o nome
  mais longo do app. A escala passa a ter três degraus deliberados
  (`.8rem · .88rem · .82rem`), e a caixa alta é o que os concilia: um rótulo em
  maiúsculas ocupa opticamente mais que a mesma medida em caixa baixa, então a
  seção sobe em número e fica à altura do álbum sem virar um título. Os dois
  subtítulos viraram **um valor** (`.7rem`): eles diferiam por meio ponto, que
  é a inconsistência que a v5.248 já tinha tirado de dentro da barra do álbum.

  **O preço está dito:** 15,2 → 13,1px leva o exemplo de 541px para 466 — cerca
  de 15% mais caracteres. Ele continua não cabendo em 238px, e nenhum tamanho
  legível faria caber. O que este lote conserta por inteiro é a desproporção; o
  corte de um título de 54 caracteres ele apenas adia.

Os oráculos afirmam RELAÇÕES e nunca pixels — um número escrito ali reprovaria
numa mudança legítima de fonte e, pior, seria verdadeiro sozinho enquanto a
escala continuasse sem sistema, que era o estado anterior. Verificado por
ISOLAMENTO, uma peça de cada vez: a animação antiga reprova **1**, a escala
antiga **4**, os Favoritos fixos **3**, a ordem antiga **1**.

**E um caso do `boot-nativo` passava por sorte de relógio.** O dos favoritos ao
vivo (v5.258) rodava no Modo Fácil, onde o `renderSimpleGate` FECHA a
Biblioteca sem tela conectada — e a enquete do espelho o chama sozinha durante
a espera do pulso. Ele só não reprovava porque a janela era curta; os 800 ms
que este lote acrescentou antes dele bastaram para expor isso. É a armadilha da
v5.236 outra vez: **medir uma tela no modo em que ela não vive.**

---

## v5.261

**A v5.261: A FOLHA PASSA A SER A FAIXA VISÍVEL — a barra de busca desceu na
v5.258 e foi parar ATRÁS do teclado. OTA PURO** (nenhuma linha de Kotlin; sem
Release).

Relato do operador: *"a barra de buscas não está flutuante/fixa na base, logo
acima do teclado… ela deveria ficar sempre visível junto ao teclado. Outro
detalhe: já que a barra não é flutuante, para ela ficar na base junto ao
teclado, você está deslocando todos os itens para cima, ocultando eles por
saírem no topo da tela. Então verifique essas duas questões: da barra de busca
fixa sempre visível na base e junto ao teclado, e a questão de que a listagem
da biblioteca deve começar no topo da tela normal."*

**O elemento já estava no lugar certo, e a folha inteira estava no tamanho
errado.** A v5.258 desceu a barra para o fim do sheet com um argumento
explícito de que isso bastava — *"nenhuma regra de teclado aqui, e isso é o
ponto: o sheet mede 100% de um `<body>` que já desconta `--kb`"*. Ele não mede.
`.popup-backdrop` é `position: fixed`, isto é, está **fora do fluxo do body** e
nunca viu aquela conta, que existe desde sempre e sempre valeu só para a tela
principal.

**Medido**, num viewport de 430×900 com um teclado de 380 px: `body` ia a
520 px e a folha da Biblioteca continuava em **900** — a barra recém-descida
ficava a 380 px atrás do teclado, e 380 px de resultados junto com ela. Descer
a barra sem isto foi trocar "longe do polegar" por "invisível".

**A correção é uma linha, e ela vale para as duas metades do relato.** A camada
fixa deixou de ser a tela e passou a ser a FAIXA VISÍVEL:

```css
inset: var(--vv-top, 0px) 0 var(--kb, 0px) 0;
```

`--kb` já existia (quanto o teclado come embaixo). **`--vv-top` é o que
faltava**: quanto a viewport VISUAL foi rolada para baixo dentro da de layout.
É o navegador revelando o campo em foco — e como fixo é fixo em relação à
viewport de LAYOUT, é ele que arrasta a folha para fora do topo da tela. A
segunda queixa do operador, palavra por palavra.

**E isto não é hipótese sobre um navegador exótico: é o aparelho dele.** Com
`targetSdk` 35 o app é edge-to-edge, e nessa condição o
`android:windowSoftInputMode="adjustResize"` do manifest **deixa de ter
efeito** — a janela do WebView não encolhe, então nem o
`interactive-widget=resizes-content` do meta viewport tem o que encolher. É
exatamente o mundo em que `--kb` foi escrito para servir, e em que ninguém o
tinha ligado às camadas fixas.

Três consequências pequenas, e nenhuma é enfeite:

- **O `.dialog-backdrop` recebeu a mesma linha.** Ele tem o `appPrompt`, que é
  um CAMPO DE TEXTO, e um cartão centrado na tela inteira fica metade atrás do
  teclado que ele próprio abre. Consertar uma das duas camadas fixas e deixar a
  outra seria o defeito da v5.220 outra vez.
- **As áreas seguras passaram a descontar.** `env(safe-area-inset-bottom)` é a
  barra de gestos, e com o teclado aberto ela está ATRÁS dele — sem descontar
  `--kb`, sobra uma faixa morta entre a barra de busca e o teclado. O mesmo em
  cima, com `--vv-top`: uma folha que já começa abaixo da barra de status não
  reserva espaço para ela de novo. E as duas folhas de tela cheia repetiam a
  linha do `padding-top` à mão — agora ela é declarada uma vez.
- **O `#favSearchBar` saiu da regra do rodapé.** Ele divide a classe
  `.hymn-search-bar` e continua no ALTO da gaveta de uma pasta (a base daquela
  folha pertence à barra de seleção múltipla), então herdar o `border-top`
  dava um filete colado no `border-bottom` do cabeçalho — 2px onde o app
  desenha 1 — e um vão de área segura no meio da tela.

**O oráculo é o que faltava para os dois lotes.** `tools/smoke.mjs` ganhou um
TECLADO DE MENTIRA: ele troca `window.visualViewport` por um que encolhe e
rola sob comando, que é **o que o navegador reporta** no mundo em que o hint
não é honrado — o app o lê como leria no aparelho. Sem `__teclado` chamado ele
espelha a viewport de verdade, e por isso é inerte para todo o resto do
arquivo. As cinco asserções afirmam a REGRA e nunca o pixel (um número escrito
ali reprovaria numa mudança legítima de fonte, e a queixa nunca foi sobre um
número). Verificado por ISOLAMENTO: devolvendo `inset: 0`, **3** reprovam;
devolvendo a barra para o alto da folha, **4**.

A régua que fica: **`position: fixed` não vê nenhuma conta de altura que o
`body` faça.** Toda vez que este app aprender alguma coisa sobre onde a tela
realmente está, as camadas fixas precisam ser avisadas à parte — e elas são
justamente as que hospedam os campos de texto.

---

## v5.260

**A v5.260: A BIBLIOTECA SEPARA OS HINÁRIOS DOS ARQUIVOS OFICIAIS. OTA PURO**
(nenhuma linha de Kotlin; sem Release).

Pedido do operador: *"faça uma separação de coletânea entre os hinários e os
Arquivos oficiais (que incluem o provai e vede e informativo mundial das
missões)"*.

**O nome do grupo já denunciava o problema: "Hinários e séries".** Um grupo
que precisa de uma conjunção para se nomear está juntando duas coisas — e o
"e" estava lá desde a v5.229, quando havia UMA série e o cabeçalho foi
remendado para caber nela.

E as duas coisas já divergiam em tudo o que decide um toque (é o `tipoDaColecao`
da v5.236): um hino é ÁUDIO com letra, que se baixa para ficar offline e que a
igreja canta; um episódio é um VÍDEO de ~300 MB que se transmite, se vê uma vez
e vem pronto da denominação. O índice de duas linhas separa as duas perguntas —
*"que hino é?"* e *"qual é o material do sábado?"* — antes de custar um toque,
que é a razão de o índice existir (v5.237).

**"Arquivos oficiais" é o nome do operador, e ele nomeia a ORIGEM** — que
separa melhor que "séries", uma palavra de implementação que não diz nada a
quem opera.

O que NÃO mudou, e é o que mantém o lote pequeno: o construtor de grupo é o
mesmo, chamado duas vezes; os dois continuam nascendo fechados, sem botão de
baixar em lote (nenhum dos dois baixa por lote — são as maiores coleções do
acervo), e o corpo de cada um só é construído quando ele abre. Os nomes
viraram constantes (`GRUPO_HINARIOS`/`GRUPO_OFICIAIS`) porque eles não são
rótulo: são a CHAVE de `grupoAberto`, e um literal repetido entre o
construtor e um chamador divergiria calado — o grupo abriria e o estado ficaria
noutro nome, isto é, o toque deixaria de alternar.

O oráculo pergunta ao DOM em três pontos, e nenhum basta sozinho: as duas
séries vivem em "Arquivos oficiais", o hinário vive em "Hinários", e a ordem é
Favoritos → Hinários → Arquivos oficiais → álbuns. Um cabeçalho novo com os
cards no lugar antigo passaria no primeiro; mover os cards sem separar os
hinários passaria no segundo. Com tudo num grupo só (o estado anterior), 2
asserções reprovam.

---

## v5.259

**A v5.259: O PARAR VAI PARA A CAPA, e a faixa de ações para de cortar a
miniatura e de deixar o título aparecer atrás dela. OTA PURO** (nenhuma linha
de Kotlin; sem Release).

Cinco correções do MESMO relato — a linha da v5.258 em uso de verdade —, e
quatro delas são de pixel porque foi em pixel que ele as viu.

- **"O Parar deve ficar na própria thumbnail do item."** Ele nasceu na
  fileira da direita (v5.177) e passou uma versão dentro do `⋮` (v5.258); os
  dois lugares erram a mesma coisa. Enquanto a linha está no ar, tirá-la de
  lá é a ÚNICA decisão que ela oferece — e ela ficava atrás de um toque, ou
  disputando espaço com ações que ninguém quer ali. Na capa o alvo é o
  quadrado inteiro, não custa um pixel do nome, e fica sobre a única parte da
  linha que já dizia "é este item" — que, com a mídia no ar, é literalmente o
  que está projetado. **Nos Favoritos ele nem existia**, e era ali que o
  operador estava olhando: aquela lista mostrava "● No ar" e não oferecia
  nada que tirasse do ar.
- **A faixa CORTAVA a miniatura.** Ela partia de `--hit` (34px) onde quem
  ocupa o canto esquerdo é a capa (40px): comia 6px dela. A conta agora sai da
  mesma medida nos dois lados.
- **E o título aparecia ATRÁS dos botões.** `background: inherit` copia o
  VALOR do fundo da linha, e o valor de uma linha no ar é `--live-soft`, **que
  tem alfa .22** — a faixa pintava vermelho translúcido por cima do nome.
  Agora a base é opaca e o estado entra como CAMADA, que é exatamente como a
  `.row` se pinta. **A lição é a mesma da v5.192, num lugar novo: `inherit` de
  um valor com alfa não herda a APARÊNCIA, ele repete a tinta.**
- **A mira falhava** (*"acabando tocando no corpo do item e não nos botões"*).
  A miniatura media 40px e os botões vizinhos 34px — dois quadrados lado a
  lado com 6px de diferença que ninguém decidiu, e o alvo no PISO do app
  justamente na lista mais densa que ele tem. `--thumb` é uma medida só para a
  capa, os botões da linha e o `⋮` — e é ela que a faixa usa nas duas bordas,
  porque são as mesmas colunas: errar uma é errar a outra, que foi o defeito
  de cima. A linha não ficou um pixel mais alta (quem dita a altura é a capa).
- **O toque encolhia o MIOLO, não o cartão.** `transform` na `.row`, dentro de
  um `.lib-item` que é quem tem a BORDA: enquanto ela é transparente dá no
  mesmo, com ela visível (no ar, atual, selecionada) o miolo se afastava de
  uma moldura parada e abria uma fresta dos dois lados — *"as margens esquerda
  e direita ficam estranhas"*. Agora encolhe a peça inteira.

Nove asserções novas, e as nove reprovam contra o código anterior (verificado):
a geometria e o feedback no `smoke.mjs`, o Parar na capa no `cena.test.mjs`, e
no `boot-nativo.test.mjs` o caso dos FAVORITOS — que é onde o relato nasceu e
onde o botão não existia.

---

## v5.258

**A v5.258: A LINHA FICA COM UM BOTÃO SÓ — o `⋮` — e a Biblioteca perde o
"baixar tudo" e ganha a busca na BASE. OTA PURO** (nenhuma linha de Kotlin;
sem Release).

Seis pedidos do operador no mesmo lote, e os dois primeiros são o mesmo
problema visto de dois ângulos: **o nome do item não cabe**.

- **"Isole todos os botões de interação em um único botão à direita, que ao
  tocar abre as opções para a sua esquerda sobre o item… pois hoje o título
  disputa com todos os botões de acesso rápido, cortando o título e o
  subtítulo."** A conta que ele descreve: a coluna de texto é `flex: 1` entre
  a miniatura e uma fileira que **cresce com o estado do item** — estrela, `+`,
  alça, o download de um link do YouTube, o Parar quando está no ar. Agora há
  um `⋮` e uma gaveta absoluta que cobre da miniatura até ele. `montarAcoesDaLinha`
  é o funil único das DUAS listas (Cronograma e Favoritos), senão elas
  divergiriam no primeiro ajuste.

  **Duas armadilhas de evento ficaram escritas no código, e as duas são de
  captura.** O fechamento de fora é `pointerdown` na fase de CAPTURA porque a
  alça mora dentro da gaveta e o arrasto captura o ponteiro — ele **nunca
  produz um `click`**, então um ouvinte de clique deixaria o menu aberto por
  cima da linha que acabou de se mover. E o "escolher fecha" também é de
  captura, por um motivo que não é preferência: **todo botão de linha deste
  app chama `stopPropagation`** no próprio `click` (senão o toque nele
  acionaria o corpo da linha atrás), e um ouvinte de bolha na gaveta não veria
  nenhum deles. A alça é a exceção declarada: ela não é uma decisão que
  termina, é um gesto que dura.

  **Isto REVOGA metade da v5.177**: as regras que escondiam a estrela e a alça
  na linha no ar saíram. O argumento delas ("na direita, a milímetros do gesto
  mirado, ninguém quer arrastar nem favoritar o que está na frente da
  congregação") foi atendido de forma mais larga — não há mais nada na direita
  além do `⋮`, e dentro da gaveta o Parar simplesmente se junta aos outros.
- **O SUBTÍTULO passou a dizer o ÁLBUM** ("no caso das músicas, seu álbum",
  no Cronograma e nos Favoritos). É o `hymnAlbum` que a v5.219 criou para o
  slide de capa e a v5.220 passou a preencher no acervo já baixado — **nenhuma
  leitura nova**, que é a regra desta linha desde a v5.118. Numa lista com três
  "Ó Adorai o Senhor" de hinários diferentes, o álbum é literalmente o que
  distingue um do outro.
- **Os FAVORITOS se atualizam com a Biblioteca aberta.** Relato: *"se estou na
  biblioteca e adiciono algo aos favoritos, ele só aparece na lista após fechar
  e abrir novamente."* Eles têm **duas casas** desde a v5.237, e o `toggleFav`
  só redesenhava a de baixo. O conserto redesenha **só o corpo daquela seção**
  (achado por `data-fav-corpo` no próprio nó), e não a tela inteira: quem
  marcou uma estrela no meio de um hinário não pode perder a rolagem por isso.
  O oráculo cobra as duas metades.
- **O ícone de trazer pasta virou "pasta +".** A v5.254 pôs ali as setas
  circulares, que são o desenho de RE-SINCRONIZAR — o que a linha de cada
  pasta já trazida faz. Este botão não repete nada: ele acrescenta a primeira.
- **"Baixar toda a biblioteca" SAIU, com o peso total ao lado** — *"ele ficou
  muito grande e muito inconveniente"*. Um alvo do tamanho do cabeçalho para
  uma ação de dezenas de gigabytes, no topo da tela em que se procura UM
  louvor. Baixar coleção por coleção continua no card de cada uma. Saíram
  `renderAcervoTotal`, `#hymnSearchTotal`, `.popup-total` e o diálogo de
  confirmação que só ele abria.
- **A busca e o ✕ desceram para uma barra na BASE** — *"eles estão muito longe
  do teclado e do toque de acesso"*. Ela é a última coisa do sheet, e o sheet
  mede `100%` de um `<body>` cuja altura já desconta o teclado
  (`calc(100svh - var(--kb))`): **a barra encosta na borda de cima do teclado
  sem uma regra própria** — é o mesmo mecanismo que já mantém o transporte
  visível. O ✕ vem depois do campo, na ponta em que o polegar já está.

Os oráculos se dividem pela natureza: o `smoke.mjs` mede a FORMA (a gaveta
fechada não mostra nada, aberta cobre o título sem invadir o `⋮`, o subtítulo
compõe com o álbum, a barra é o último filho e não há mais total no
cabeçalho), o `boot-nativo.test.mjs` mede o COMPORTAMENTO que só existe com a
ponte (a atualização ao vivo dos favoritos, com a rolagem preservada) e o
`cena.test.mjs` mede o que a v5.177 media, agora na forma nova.

---

## v5.259

**A v5.259: O CHECK DO "TOCAR AGORA" NÃO ACENDIA — e o defeito era um
argumento esquecido. OTA PURO** (sem Release).

Relato do operador: *"o seletivo de tocar agora, na seleção de um provai e
vede, ou talvez em todos, está com uma falha, pois se eu toco apenas nele, ele
não dá o feedback do check"*.

**É meu, da v5.253, e o "talvez em todos" tinha resposta exata: era só ele.**
Marcar uma opção muda o desenho de DUAS coisas — a caixa daquela linha e o
rótulo do confirmar —, e quem as reconstrói é o redesenho da folha, passado
linha a linha num argumento (`aoMudar`). As três listas o recebiam desde a
v5.141; o "Tocar agora" nunca precisou dele, porque até a v5.253 o corpo dele
EXECUTAVA e fechava tudo. Quando aquela linha virou selecionável, o argumento
ficou para trás — o toque marcava o destino e a tela não mudava um pixel.

**O modo de falhar é o pior que este app tem:** nada quebra, nada erra alto, e
o estado interno fica CERTO. Só o desenho não acompanha, e do lado de quem
opera isso se lê como "o check não funciona" — ou, pior, como "não marcou", e
aí o operador toca de novo e desmarca.

**A correção tem duas metades, e a segunda é a que importa.** A primeira é o
argumento que faltava. A segunda é tirá-lo do caminho: o redesenho virou um
HOOK DE MÓDULO (`destRemontar`), definido UMA vez por folha ao lado do
`destExecutor` que já morava lá. Argumento que cada chamador precisa lembrar de
passar é a mesma classe de erro que o `native.js` cobra em outro lugar ("campo
novo no objeto = campo novo no `native.js`, sempre") — como hook, a linha nova
nasce funcionando, e o esquecimento deixa de ser possível. Verificado: com o
argumento explícito removido de propósito, o oráculo continua passando.

`tools/destinos.test.mjs` ganhou o caso, e ele reprova em 2 asserções contra o
código anterior — exatamente as duas que o redesenho reconstrói. A terceira,
"marca-o e mantém a folha aberta", passava ANTES também: é a prova de que o
estado sempre esteve certo e só o desenho ficou para trás.

---

## v5.256

**A v5.256: O EPISÓDIO APARECE NA QUARTA, e a falha dentro da janela DIZ POR
QUÊ. OTA PURO** (nenhuma linha de Kotlin; sem Release).

Pedido do operador, sobre o corte da v5.255: *"a data de corte não pode ser o
próprio dia, pois muitos aproveitam para fazer a organização antes, então pode
deixar para que o acesso ao vídeo já fique disponível na quarta-feira antes do
sábado (caso o download em específico do informativo dê algum erro se feito na
quarta-feira, rode um aviso para que espere que chegue mais perto da data para
tentar novamente)."*

Ele está corrigindo uma premissa minha, e a correção é sobre QUANDO o app é
usado: eu tratei a lista como se ela fosse lida no culto, e ela é lida na
semana. Um corte no próprio dia entrega o episódio no sábado de manhã — depois
de o roteiro estar pronto.

**A janela é uma CONTAGEM de dias, não um dia da semana.** Três dias antes de
um sábado É a quarta-feira, e as duas formas descrevem o mesmo hoje; a
contagem é a que sobrevive ao dia em que o canal publicar num domingo. Ela é
uma constante nomeada (`DIAS_DE_ANTECEDENCIA`), e a conta que a sustenta
(`diasAte`) usa `Date.UTC` nas duas pontas: uma subtração de `Date` local
atravessa o horário de verão e erraria o vizinho exatamente uma vez por ano —
num sábado, sem reproduzir.

**E o preço da janela vem com o remédio no mesmo lote**, que é a segunda
metade do pedido: nesses três dias o vídeo pode ainda não estar público, e o
download não vem. Sem uma frase, essa falha é idêntica a uma queda de rede — o
operador tenta de novo, falha de novo, e conclui que o app quebrou justamente
no item que ele acabou de ver aparecer. Agora a resposta diz o que fazer e até
quando: *"ainda não liberado pelo canal — tente mais perto de 22/Ago"*.

Três decisões pequenas em volta dela:

- **Ela só existe enquanto o sábado não chegou** (`diasAte > 0`, o mesmo
  primitivo da lista com outro limiar). Passado o dia, uma falha ali é uma
  falha de verdade, e a frase seria uma desculpa falsa.
- **Ela aparece em DOIS lugares porque são dois fluxos.** Com "Tocar agora" a
  Biblioteca FECHA e quem responde é o cartão sobre a preview; mandando ao
  Cronograma ela continua aberta por cima da preview, e a resposta tem de
  nascer onde o toque nasceu — ali, o card da própria série (`setCollStatus`).
  É a regra da v5.207 aplicada a um caminho que tinha só metade dela.
- **A DATA do episódio passou a viver no índice** (`serieData`). Ela já era
  lida do título; o que muda é que agora sobrevive — sem ela no registro não
  haveria como saber que aquela falha tem essa causa. Um campo novo no índice
  o obsoleta uma vez, e a impressão digital da regra já cuida disso.

Verificado por isolamento: sem a antecedência (corte no próprio dia) 3+1
asserções reprovam; com ela larga demais (7 dias) 4+1; sem o aviso 3; e com o
aviso em TODO episódio 1. O percurso mede a fronteira nos quatro dias em volta
— terça não, quarta sim —, com relógio FIXO.

---

## v5.255

**A v5.255: O QUE AINDA NÃO SAIU SOME DA LISTA — o canal sobe o trimestre e
libera um sábado por vez. OTA PURO** (nenhuma linha de Kotlin; sem Release).

Relato do operador: *"o informativo mundial das missões só libera apenas o
informativo referente a aquela semana e dos passados. Exemplo: hoje é sábado
15 de agosto, então eu só tenho o 15 de agosto e os anteriores… portanto, pode
fazer um bloqueio na exibição dos vídeos que não estão disponíveis ainda."*

O canal sobe o TRIMESTRE INTEIRO de uma vez e libera um episódio por sábado;
os que ainda não saíram ficam na playlist como **prioridade para membros** —
têm título, miniatura e duração, aparecem na listagem e **não tocam**. Em 15 de
agosto a Biblioteca mostrava até 12 de dezembro: dezessete promessas que ela
não podia cumprir, e a mais cara delas no meio de um culto.

**A régua é a DATA, porque é o único sinal que existe deste lado.** O que
decide de verdade é a liberação no YouTube, e o extrator não a publica: o item
de um vídeo restrito chega idêntico ao de um liberado. Três decisões cercam o
preço disso:

- **É um CAMPO do catálogo, não uma regra global** (`futuros`). O erro é
  assimétrico: esconder cedo demais custa um episódio que já estava liberado —
  e ele volta sozinho no dia seguinte, sem nada a desfazer; mostrar de mais
  custa um item que o operador põe no roteiro e que não toca na hora, com a
  projeção parada na frente da congregação. O **Provai e Vede fica de fora**, e
  isso é medido, não suposto: no registro do aparelho, em 15 de agosto ele já
  tinha até 26 de setembro, e aqueles episódios TOCAM.
- **O corte é INCLUSIVO no dia**, que é o que o operador descreveu: o episódio
  de hoje é o do culto de hoje. A comparação é por DIA (`AAAAMMDD`), nunca por
  instante — um `>` sobre milissegundos o esconderia até a meia-noite.
- **Sem data no título, nunca é escondido.** Ele é o achado da regra de ouro
  (entra sem rótulo, no fim do mês), e esconder o que não se sabe julgar
  trocaria um item feio por um item ausente.

**E o DIA entra em DOIS lugares, senão o recurso não funcionaria no sábado.**
A lista daquela série é função do dia, então: `indiceVencido` passa a vencer o
índice na virada do dia (só nessa série), e o DIA entra na **assinatura** das
playlists. O segundo é o que impede o sintoma da v5.233 por outra porta — o
canal não muda de um dia para o outro, então a assinatura bateria, a economia
devolveria a lista de ontem (sem o episódio de hoje) e o carimbo diria que ela
é de hoje. Custa uma varredura por dia; sem ela o episódio do culto só
apareceria quando o TTL de 12 h vencesse, que pode ser depois do culto.

O Registro conta os escondidos numa linha só — dezessete linhas de recusa
afogariam as recusas de VERDADE, que são uma ou nenhuma — e mostra **o mais
próximo** com o título cru e a data do corte: a pergunta que se faz a esse
bloco é "o app está escondendo o episódio de amanhã?", e a resposta não pode
depender de eu adivinhar o relógio do aparelho.

Verificado por ISOLAMENTO nas quatro peças: sem o corte, 6 asserções do
`serie.test.mjs` e 2 do percurso reprovam; com ele GLOBAL (ignorando o campo),
1 — a que protege o Provai e Vede; com o corte exclusivo em vez de inclusivo,
3 e 7; e sem o dia na assinatura, 1 no percurso. **Esta última só passou a
reprovar depois de o teste parar de apagar o índice antes de cada leitura** —
ele exercitava sempre o caminho da reconstrução, isto é, nunca o caminho em
que o defeito mora. O caso do corte roda numa página com **relógio fixo**: um
oráculo cujo resultado muda com o dia é o que ensina a ignorar vermelho.

---

## v5.254

**A v5.254: OS FAVORITOS VIRAM UMA LISTA SÓ — os atalhos de pasta saem, e a
ordem passa a ser do operador. OTA PURO** (nenhuma linha de Kotlin; sem
Release).

Pedido do operador: *"não vamos mais usar o sistema de atalhos de pastas no
app, apenas a versão de pastas sincronizadas dentro do armazenamento do
aparelho. Todos os salvos nos favoritos vão diretamente para a lista geral com
todos os arquivos juntos por ordem de chegada, mas com a opção de mover eles
de lugar; vamos remover as subdivisões por tipo, manter uma lista única."*

**A parte que não estava no pedido e que decidia o lote: a MIGRAÇÃO.** Apagar
os atalhos e ir embora seria PERDER MÍDIA. Um item cujo único detentor era um
atalho vira, no instante em que ele some, um registro que nenhuma lista aponta
— e o coletor de lixo, que existe justamente para isso, o apaga na varredura
seguinte (que roda na mesma abertura, no `varrerRestos`). Um vídeo grande
sumiria do app **e do disco**, calado. Então `migrarPastasParaFavoritos` sobe
cada item para `favs` e só DEPOIS derruba o atalho pelo `folderDrop`; a ordem
das duas metades é a garantia inteira, e é ela que o oráculo mede.

**O agrupamento por tipo caiu por um argumento que a própria ordenação
desmente.** Ele supunha (v5.104) que a primeira coisa que o operador sabe
sobre o que procura é a CATEGORIA — "era um vídeo". Com o item onde ele mesmo
o pôs, a primeira coisa que ele sabe é o LUGAR, e uma lista que se reorganiza
sozinha em doze seções é justamente o que impede memória de lugar. Os
cabeçalhos ainda custavam altura: num acervo variado eles empurravam metade
dos favoritos para fora da primeira tela.

**A alça de arrastar é a do Cronograma**, não uma segunda — o mesmo
`attachHandle`/`reorder`, a mesma linha-guia, a mesma medição única no
`pointerdown`. O que ela exigiu foi um detalhe com nome: as pastas do aparelho
ficam na MESMA `<ul>` e não pertencem à lista `favs`, então contá-las como
posição deslocaria o índice de destino em relação ao array — a linha leva
`data-fixa`, e o `measureDrag` a pula.

**O preço, medido e dito:** a alça é o terceiro botão da linha, e o nome caiu
de **194px para 152px** numa lista de 368px. Em troca o SUBTÍTULO voltou a
aparecer — ele era escondido por CSS porque o cabeçalho de tipo já dizia o que
ele diz —, e é ele que agora distingue um vídeo de um versículo.

**A folha de duas origens da v5.239 também caiu, e pela regra dela mesma.**
Ela existia porque dois botões respondiam à mesma pergunta ("quero uma pasta
aqui") por caminhos diferentes; com um caminho só, uma folha de uma opção é um
toque cobrado para não escolher nada. A ação da barra passou a FAZER a coisa.

Saíram junto: `folders`/`folder_<id>`, `renderVirtualFolders`, `createFolder`,
`deleteFolder`, `addToFolder`, `loadFolderMediaItems`, `openFolder`,
`promptNewFavorite`, `abrirFolhaDePasta`, `FAV_GRUPOS`, `favGrupo`,
`appendFavSection`, o popup `#folderPopup` inteiro, o `#selFolder` da seleção
múltipla, os glifos `folder`/`create_new_folder` e as classes `.fav-section` e
`.folder-pick-btn`.

Os oráculos: o `boot-nativo.test.mjs` cobra a lista única, a alça, o
reordenar de verdade, a ação que traz a pasta sem folha — e as quatro
asserções da migração (o item sobe, **a mídia sobrevive**, não duplica quem já
estava lá, e rodar de novo é no-op). Reprova em **5 asserções** contra o
código anterior. O par `songMenuPopup`/`folderPopup` saiu da lista de popups
aninhados do `smoke.mjs`, que fica VAZIA de propósito: o próximo popup que
abrir de dentro de outro entra ali numa linha.

---

## v5.253

**A v5.253: A FOLHA DE DESTINOS VIRA UM MÉTODO ÚNICO — tudo é selecionável, e
o confirmar não some. OTA PURO** (sem Release).

Pedido do operador: *"faça um método universal, o botão de confirmar sempre
visível, e todas as outras opções (inclusive o tocar agora) são opções
selecionáveis, não apenas tocando no check, mas de corpo inteiro."*

**A folha tinha DUAS gramáticas na mesma linha.** O corpo EXECUTAVA — aquele
destino mais o que estivesse marcado, fechando tudo — e a caixinha de 20 px na
borda apenas MARCAVA. Duas coisas diferentes a dois centímetros uma da outra, e
a de marcar era o menor alvo da folha: quem quisesse dois destinos tinha de
acertar a CAIXA do primeiro e o CORPO do segundo, nessa ordem. Errar a ordem
mandava o item para um destino só e fechava a folha.

**E o confirmar só nascia depois da primeira marca** — ou seja, era invisível
exatamente para quem ainda não tinha entendido o mecanismo, e a folha parecia
não ter conclusão.

Agora ela é o que sempre pareceu ser: **uma lista de opções que se marcam e um
botão que executa.** A caixa vira INDICADOR (`pointer-events: none`, senão o
toque que cai nos 20 px dela morreria num filho sem ouvinte — um ponto morto
justamente no pedaço que mais parece o alvo), a linha marcada ganha o contorno
em accent que o app usa para "é este", e o confirmar fica sempre na tela:
desabilitado e dizendo "Escolha uma opção" enquanto não há nada.

**"Tocar agora" ganhou caixa junto.** Por dezenas de versões ele não a teve com
um argumento correto — "ele não é uma lista, e uma caixa nele ofereceria marcar
o telão". Com um confirmar único, negá-la seria manter a exceção que o pedido
veio remover. O rótulo do botão acompanhou: "Enviar aos 2 destinos" chamaria o
telão de lista, então ele virou **"Confirmar (N)"**, que é como o próprio
operador nomeou o botão.

**"Só a letra, no Cronograma" também entrou na seleção.** Ela ficava de fora
porque "a letra não é o mesmo item noutra lista, é OUTRO item — misturá-la aos
destinos faria um toque criar duas coisas diferentes de uma vez". Com um
confirmar único isso deixou de ser um toque acidental e passou a ser uma
decisão explícita, então a exceção caiu.

**E o seletor de destinos da IMPORTAÇÃO parou de ter marcação própria.** Ele
montava as linhas dele porque `songMenuItem` executava; agora que ela marca, as
duas folhas convergiram e vinte linhas de marcação duplicada saíram junto —
que é o "método universal" do pedido escrito em código, não só em
comportamento.

**O que NÃO mudou:** a folha de TOCAR de uma música do acervo (cantada ·
playback · apenas a letra) continua sendo três ações imediatas. Ali não há
destino nenhum a acumular — são alternativas, e a primeira escolhida é a
resposta.

`tools/destinos.test.mjs` foi reescrito para o modelo novo e reprova em **7
asserções** contra o anterior: as antigas travavam literalmente a gramática
que saiu (o corpo executando, a caixa parando o borbulhar, o confirmar
ausente).

---

## v5.252

**A v5.252: O REGISTRO ACHOU O PRIMEIRO DEFEITO — e ele era MEU. OTA PURO**
(nenhuma linha de Kotlin; sem Release).

O operador copiou o bloco novo do Registro (v5.249) e o repassou. Na primeira
varredura em aparelho de verdade, com **94 playlists** num canal e **145** no
outro, ele traz uma linha só de recusa de vídeo em toda a série do Provai e
Vede:

```
- "Mission Refocus | Provai e Vede  2026 (27/Jun)" → está em outro idioma
```

**É um episódio EM PORTUGUÊS**, do canal certo, dentro da playlist certa. O
marcador de inglês da v5.244 era a palavra solta `mission`, e o título deste
episódio a tem. O sábado 27 de junho simplesmente não estava na lista: **o
erro que o `serie.js` inteiro existe para evitar**, cometido pela guarda que
eu escrevi — com o custo declarado no KDoc dela como se fosse aceitável.

Não era. "O operador vê na lista e resolve à mão" supõe que ele saiba que
falta alguma coisa, e entre 37 episódios ninguém percebe um ausente. **Quem
mostrou foi o Registro, dois dias depois de existir** — este é exatamente o
laço que ele foi criado para fechar, e ele o fechou na primeira volta.

**A régua que estava errada, e é ela que fica:** uma palavra solta em inglês
não diz o idioma de um título — títulos em português usam palavras em inglês o
tempo todo. O que diz é o NOME DO PROGRAMA ("Mission Stories", "World
Mission", "Mission Spotlight", "Missionnaire"), e essas são expressões que um
título brasileiro não produz por acidente. O espanhol continua por PALAVRA
porque ali elas não se cruzam: "missões" nunca é "misiones", em flexão
nenhuma. **Uma marca de idioma tem de ser impossível na língua que se quer
manter, não apenas típica da que se quer recusar.**

Duas outras coisas que só os números reais ensinaram:

- **O recorte do bloco passou a ser o ANO.** Com 94 e 145 playlists, as 9
  aceitas ficavam enterradas sob oitenta linhas dizendo "não é de 2026", e o
  teto de 60 cortava justamente o fim. Some só o que traz OUTRO ano no nome —
  um mês do ano corrente renomeado ("Provai & Vede - Julho 2026") continua
  aparecendo, e uma playlist sem ano nenhum também, porque é assim que uma
  renomeação se disfarça. O que saiu é contado por motivo, nunca em silêncio.
- **O canal ANUNCIA mais vídeos do que a extração traz** — 39 × 38 numa série,
  51 × 50 na outra. Nada erra, nada recusa: o vídeo não vem (só para membros?
  removido?) e o sábado dele não existe na lista. A soma das contagens da aba
  do canal é a única referência externa que este caminho tem, e agora ela é uma
  linha do bloco.

Os oráculos ganharam **dezessete nomes VERBATIM** dos dois canais, que
nenhuma suposição minha teria alcançado: espaço duplo antes do hífen, "vede"
em minúscula, o ano ANTES do mês ("Provai e Vede 2024 - Março"), o chinês
simplificado, e — a que mais importa — o fato de o @daniellocutor publicar
**o Provai e Vede também**, o que faz o prefixo ser a única coisa que impede
uma série de entrar na outra. Contra o código anterior, 4 asserções reprovam.

---

## v5.251

**A v5.251: "ONLINE" — a qualidade que não baixa. OTA PURO** (sem Release).

Pedido do operador: *"adicione a opção nas qualidades de opções do download,
para que tenha o 'Online' que mesmo ao levar para o cronograma, levaria apenas
o link, ao invés de obrigar a baixar."*

**A razão que obrigava o download estava escrita e era boa — só não era
universal.** O `ytAcao` diz, desde a v5.120, que os três destinos que GUARDAM
não podem transmitir porque "um manifesto de stream EXPIRA em algumas horas".
Verdade sobre o MANIFESTO; falsa sobre o LINK, que é o que um item
`kind: 'youtube'` guarda desde sempre e não expira. Um vídeo visto uma vez, num
culto com internet, não precisa dos ~300 MB no aparelho para entrar no roteiro
de sábado.

**Ela mora no MESMO seletor das resoluções** (decisão do operador), porque é a
mesma pergunta — "quanto deste vídeo eu quero no aparelho?" — com **nada** na
ponta da escala: `Online · 1080p · 720p · 480p`. O sentinela é `-1` e não `0`:
zero já significa "sem teto, o padrão do shell", e reusá-lo faria "Online" e
"melhor qualidade" serem o mesmo valor.

**O recurso não inventou item novo nem caminho novo.** O que ele guarda é o
`kind: 'youtube'` que o compartilhamento já cria quando transmissão e download
falham, e desde a v5.212 tocá-lo RESOLVE no toque (`resolverLinkYoutube`):
transmite, e **transmitir não troca o item** — então o link continua link no
domingo seguinte, que é exatamente o que "Online" promete. A recuperação
também já existia: falhando a transmissão, aquele mesmo caminho baixa e troca
o item na posição em que ele está, sem perder o lugar no Cronograma.

**Duas coisas somem com ela escolhida, e as duas pela mesma régua** (uma
escolha que não muda nada é pior que escolha nenhuma): o seletor Vídeo × Só
áudio, porque a forma da faixa passa a ser decidida na hora de tocar; e a
espera — os três destinos ganham o subtítulo "Só o link, sem baixar", que é o
que eles significam em toda outra qualidade.

**O preço está dito e é um só: sem internet no culto, não há o que projetar.**
Ele não é escondido atrás de um padrão — a qualidade continua nascendo em
1080p a cada item, e "Online" é uma escolha deliberada por vídeo.

O oráculo (`tools/boot-nativo.test.mjs`, o único que sobe a base com a ponte)
cobra as duas metades: o rótulo está no seletor **e** o que chega ao Cronograma
é um registro sem blob, com `kind: 'youtube'`. Sem a segunda, acrescentar a
palavra teria passado.

---

## v5.250

**A v5.250: O MODO FÁCIL GANHA A ENGRENAGEM — e com ela some o último
`.mode-switch` do app. OTA PURO** (nenhuma linha de Kotlin; sem Release).

Pedido do operador, logo depois da v5.247: *"então crie um botão de
configurações no modo simples, que fica onde é hoje o botão de modo
avançado"*.

**É a segunda metade de um movimento, e a ORDEM dele não era acidente.** A
v5.247 tirou a troca de modo do cabeçalho do avançado porque a mesma escolha
mora em Configurações; ela não podia tirar a do Modo Fácil no mesmo lote,
porque daquele modo **não havia como chegar a Configurações** — a engrenagem
vive na coluna do mixer, dentro da `.bottombar`, que aquele modo esconde por
inteiro. Tirar os dois de uma vez teria trancado o operador lá dentro.
Primeiro se cria o caminho, depois se remove o atalho.

Agora o caminho é o mesmo nos dois modos — **engrenagem → "Modo do app"** —, e
ele é o melhor dos três que existiam: é o único que **guarda a escolha entre
aberturas** (v5.66). Os dois botões valiam só para a sessão.

**O Modo Fácil ganhou junto tudo o mais que morava atrás da engrenagem**: o
tema, o wallpaper do telão, o preenchimento e o giro, o estado do telão, o
Registro e o botão de atualização. Aquele modo nunca teve acesso a nada disso
— a única saída dele era virar o app inteiro do avesso.

**A engrenagem é CHAPADA e `--accent`**, e as duas metades são regra do app: o
chapado é "navegação/acesso não é operação" (a mesma receita do `#backBtn` e
da gêmea do mixer), e o accent é o que este app usa para dizer "isto leva a
outro lugar" — era exatamente onde ele vivia no botão que saiu, na seta. Ela
difere da gêmea do mixer no `--muted` porque lá ela é um acesso entre outros e
aqui é o ÚNICO. Fica acima da cortina do modo bloqueado sem regra nova: o
`.simple.sem-tela .simple-head` já iça o cabeçalho inteiro.

**`.mode-switch` saiu inteira** — a classe, as duas menções nas listas
agrupadas de toque e de escala de ícone, e o `.simple-head .mode-switch`. Ela
ficou sem um único elemento no documento.

O oráculo do `tools/smoke.mjs` cresceu para nove asserções e agora percorre o
CAMINHO, não só o DOM: no Modo Fácil a engrenagem está à vista, o toque abre
Configurações, e de lá o operador SAI do modo. Sem essa última, apagar o botão
passaria nas outras e trancaria o operador — que é precisamente o risco desta
sequência de dois lotes. Reprova em **5 asserções** contra o código anterior
(verificado), e a leitura da engrenagem é null-safe pelo motivo de sempre: um
`evaluate` que lança ali levaria junto as asserções seguintes.

---

## v5.249

**A v5.249: O REGISTRO PASSA A CONTAR O QUE A REGRA DAS SÉRIES ACHOU. OTA
PURO** (nenhuma linha de Kotlin; sem Release).

Pedido do operador: *"adicione uma seção inteira nos registros para, após
verificar ambos os grupos de Provai e Vede e de Informativo Mundial das
Missões, ele registrar os nomes, achados e dados resultantes, assim eu posso
lhe repassar e você verificar se precisa ajustar os filtros ou métodos."*

**O que ele descreve é o laço de manutenção deste recurso, e ele estava aberto
de um lado.** A regra decide a partir de nomes que um canal muda sem avisar, e
os dois modos de errar são silenciosos por construção: uma playlist recusada
some da Biblioteca sem erro no console, e um vídeo aceito sem data entra fora
de ordem. O aparelho sabia as duas coisas no instante em que decidia e as
jogava fora — quem opera vê o RESULTADO (uma lista) e nunca o CAMINHO, então
"está faltando julho" e "julho veio com outro nome" chegavam a mim como a
mesma frase. As duas versões anteriores deste recurso são a prova: a v5.229 e
a v5.233 foram diagnosticadas por relato e reprodução, não por leitura.

O desenho inteiro está em "O REGISTRO da varredura", na seção das séries. As
três decisões que valem para além dele:

- **O bloco guarda o VEREDITO, nunca uma segunda opinião.** `mesDaPlaylist`
  virou a metade de `avaliarPlaylist`, que devolve `{ mes, motivo }`; o mesmo
  para `avaliarVideo`. Uma segunda escrita das quatro perguntas — uma para
  decidir, outra para contar o que decidiu — envelheceria à parte no primeiro
  ajuste, e o que sai disso é um log que discorda do aparelho. Virou regra do
  projeto.
- **Ele registra o dado CRU.** O consumidor deste texto não é quem opera: é
  quem AJUSTA a regra, a distância, sem o aparelho e sem o canal na frente. Um
  rótulo já formado ("15/Ago") prova que a regra rodou; só o título que entrou
  nela diz por que ela produziu aquilo.
- **O que ENTROU sem data é um ACHADO, e é o mais valioso dos dois.** Recusa
  se percebe (o item some); o episódio sem data continua lá, funcionando, com
  o rótulo errado — foi assim que a v5.230 atravessou até o operador reparar
  num item fora de ordem no fim de janeiro.

Mais duas peças pequenas e uma armadilha. O diário **vence o índice**
(`indiceVencido`): sem isso, um aparelho que já tinha a lista passaria 12 h com
o bloco dizendo "ainda não varrido" justamente enquanto o operador o procura —
e o carimbo é escrito nos DOIS caminhos do `fetchSerieIndex`, senão o canal
seria extraído a cada abertura. A metade do canal é gravada **antes** do
primeiro `throw`, porque "nenhuma playlist no canal" é o caso em que a pergunta
"por quê?" mais importa. E os nomes saem **um por linha**: os dois separadores
óbvios já são parte dos dados (" · " no rótulo formado, " | " no título cru).

O oráculo entrou no `boot-nativo.test.mjs` — nenhum teste carregava este texto,
e o modo de falhar dele é o do `registro.test.mjs`: ele não quebra, ele
CONTINUA RESPONDENDO com uma frase errada, ou mudo, que é pior ("não achei nada
no Registro" se lê como "não há nada de errado"). Verificado por ISOLAMENTO,
sem erro de referência mascarando nada: sem o bloco **12** asserções reprovam,
sem a lista de recusados **1**, sem o achado de data **1**, sem o carimbo do
diário **1**.

---

## v5.248

**A v5.248: O PESO VIRA SUBTÍTULO DO CARD — e o card não cresce por isso.
OTA PURO** (sem Release).

Pedido do operador: *"ajuste o elemento que descreve o peso dos arquivos e
álbuns e coleções, para que ele seja um subtítulo abaixo do título, pois
atualmente ele está apertando o espaço disponível para o título dos álbuns.
Mas garanta que os cards não fiquem mais altos por causa disso."*

**Medido, e o aperto era grande:** dividindo a linha com o nome, "~1,2 GB"
comia um terço da largura útil de um celular. O título de um álbum ia de
**196 px** para **264 px** (+35%), e no pior caso — o álbum que tem subtítulo
de categoria E "não sincron." — de **150 px** para 264 px, **+76%**. O nome é a
única coisa daquela barra que não se adivinha; o peso é um número curto que
ninguém lê de relance.

**A segunda linha já existia** (o subtítulo do pivô categoria↔álbum), e o peso
entra NELA, não numa terceira: são duas peças do mesmo tipo — metadado curto
sobre a coleção — e uma linha por peça faria o card crescer conforme o
catálogo, que é exatamente o que a segunda metade do pedido proíbe. O ponto
separador vem do CSS, e as reticências caem no subtítulo: o peso é curto e não
deve encolher.

**A altura não mudou: 51,6 px antes e depois.** Quem manda nela é a THUMB
(32 px), e as duas linhas de texto foram presas a esse número — 19,0 + 1 +
11,8 = 31,8 px —, com as alturas de linha explícitas em vez de herdadas.
Foi por essa conta que o subtítulo do pivô desceu para `.7rem`, a mesma escala
do peso ao lado: meio ponto de diferença entre dois irmãos na mesma linha era
a inconsistência que a v5.241 tirou daqui, e era também o meio ponto que
estourava a thumb.

**E o travessão saiu.** Ele era o marcador de "nada a dizer" numa COLUNA que
precisava existir para os cards se alinharem; como subtítulo ele vira um traço
solto embaixo do nome, dizendo menos que o silêncio. Sem ele o card fica com
uma linha só — e não encolhe, porque quem manda na altura continua sendo a
thumb.

O oráculo (`tools/smoke.mjs`) não fixa pixel nenhum: ele compara a largura do
título ENTRE CARDS (com e sem subtítulo o nome tem de ter a mesma linha, que é
literalmente "o metadado não aperta mais o título") e trava a altura contra a
thumb. O caso da v5.243 foi re-ancorado no título, que agora é quem marca a
coluna da direita. Reprova em 3 asserções contra o código anterior.

---

## v5.247

**A v5.247: A TROCA DE MODO VIRA UMA SÓ — o botão do cabeçalho sai. OTA
PURO** (nenhuma linha de Kotlin; sem Release).

Pedido do operador: *"como já temos nas configurações o botão de acesso ao
modo simples, então pode remover o botão que temos no cabeçalho do app"*.

Ele está certo por duas contas e por uma terceira que a medição achou. O
destino é o MESMO (`setAppMode('simple')`), e o de Configurações é o que
**guarda a escolha entre aberturas** (v5.66) — o do cabeçalho não guardava
nada, isto é, dos dois controles o que sobrou é o que decide mais. E o do
cabeçalho ocupava a esquerda de uma faixa com largura de celular para uma
decisão que se toma uma vez por instalação.

**A terceira: o título nunca esteve centrado.** A caixa do botão ficava
RESERVADA mesmo quando ele não aparecia (`.mode-switch--vago`, v5.111) — ela
existia para o título não saltar 60px a cada deslize entre abas —, e o preço
era o título ser empurrado para a direita o tempo todo. Medido numa tela de
430: centro do título em **278px**, contra os 215 do centro da faixa. Sem o
botão não há o que reservar, e ele passa a ficar exatamente no meio, em todas
as abas. O único elemento que ainda o desloca é o voltar da Bíblia (19px), e
essa distância é a mesma de antes.

**A SIMETRIA ACABOU, e ela era assimétrica de verdade.** Este documento
descrevia os dois botões como "o mesmo botão ao contrário", e por isso a
leitura natural do pedido seria tirar os dois. **O `#simpleFullBtn` do Modo
Fácil FICA**, e não por conservadorismo: a engrenagem mora na coluna do mixer,
dentro da `.bottombar`, que o Modo Fácil esconde por inteiro
(`body.mode-simple .bottombar { display: none }`). No avançado o outro caminho
está ali ao lado; no Fácil não existe caminho nenhum, e remover aquele botão
**trancaria o operador naquele modo**. É a razão pela qual a v5.48 o criou, e
ela continua valendo só de um lado.

`tools/smoke.mjs` cobra as duas metades — o botão fora do cabeçalho da lista e
o título centrado, mas a saída do Modo Fácil ainda no cabeçalho dele e os dois
modos ainda em Configurações. Sem essas duas últimas, apagar o cabeçalho
inteiro passaria. Reprova em 2 asserções contra o código anterior (verificado).

Saíram junto o `.mode-switch--vago` (o lugar reservado, sem dono agora) e a
regra de "só no Cronograma" do `renderListTitle`.

---

## v5.246

**A v5.246: A SETA VIRA A THUMBNAIL DAS RAÍZES — ícone só na folha da árvore.
OTA PURO** (sem Release).

Pedido do operador: *"adicione um ícone também como thumbnail e modelo nos
grupos das coleções, assim podemos colocar a mesma seta de colapsar e
descolapsar aqui… pode manter uma seta como 'thumbnail' padrão, pois nas
subdivisões, uma thumbnail é meio inútil, deixe apenas nos arquivos os ícones,
nas raízes mais altas o ideal é a seta, pois ela representa que pode abrir
mais listagens."*

**O argumento é sobre o que um desenho ali pode significar.** A thumb de um
álbum era a mesma nota musical em cada hinário e a mesma fila em cada álbum —
um glifo repetido em toda linha não distingue nada, e o que distingue uma
coleção da outra é o nome ao lado. A seção nem isso tinha: começava com texto
solto. Na folha da árvore o ícone TRABALHA (um áudio, um vídeo, uma imagem,
uma miniatura de verdade), e é lá que ele fica.

Agora a seção e o card do álbum têm o MESMO quadrado, com a MESMA seta: para
baixo fechado, para cima aberto, girada por CSS a partir de um desenho só. A
caixa é declarada uma vez para os dois — duas receitas para o mesmo quadrado
divergiriam no primeiro ajuste.

**E ela desceu da coluna da direita**, onde a v5.237 a tinha posto: é a mesma
razão da v5.243 — a direita é a coluna do peso e do botão de baixar, e uma
seta que aparece ali empurra os números.

**A seção FIXA (os Favoritos) reserva o lugar e não desenha nada.** Ela não
abre nem fecha, e uma seta ali prometeria um gesto que não existe; sem o
espaço, o título dela começaria numa coluna diferente da de todas as outras
seções. É o `visibility`-vago da v5.243 aplicado ao outro lado da barra.

**`iconKey` saiu do catálogo com a thumb que ele alimentava** — ele era o
ÚNICO acesso dinâmico à tabela `ICON`, e sem ele toda leitura daquela tabela
passa a ser por nome literal. Isso não é limpeza cosmética: é o que torna a
tabela varrível, e um nome que ninguém cita vira código morto demonstrável em
vez de um talvez.

O oráculo (`tools/smoke.mjs`) compara a caixa da seção com a do card — a
mesma largura, altura e tom —, exige a seta nos DOIS estados do álbum e mede a
direção do giro. Reprova em 4 asserções contra o código anterior.

---

## v5.245

**A v5.245: A ATUALIZAÇÃO DEIXA DE SE PERDER NUM TOQUE FORA, e ganha um
BOTÃO em Configurações. OTA PURO** (nenhuma linha de Kotlin; sem Release).

Pedido do operador, em duas metades que são o mesmo problema: *"ela pode ser
ignorada tocando fora dela, e assim perdendo a atualização"* — e um botão que
*"sem atualização disponível, ativa a verificação para saber se há uma, e se
houver uma já esperando, o botão vira um botão de atualização"*.

**1. O toque fora deixa de responder** (`appDialogFixo`). O padrão do app é o
do navegador: tocar no fundo cancela, e para quase tudo isso está certo — é a
saída barata de quem abriu a coisa errada. Para a atualização não estava: ela
aparece SOZINHA, no meio do que o operador estava fazendo, e um toque em
qualquer lugar da tela a resolvia como "Deixar para depois", que a silencia
pelo resto da sessão. **A atualização era perdida por um gesto que ele nem
sabia ter dado.** O que NÃO muda, e é o que impede isto de virar uma armadilha:
o "Deixar para depois" continua ali e o Esc/voltar continua valendo — os dois
são a recusa DELIBERADA. O que deixa de existir é a recusa por acidente. A
opção é por diálogo (`fixo: true`), não global: o resto do app continua com o
padrão, que ali é o certo.

**2. O botão é o herdeiro da LINHA DO APK** (v5.167), e o que mudou é o
escopo. Aquela só existia quando havia um APK novo, e a única forma de
PROCURAR era um toque escondido no rótulo de versão — uma afordância que não
se anuncia, ao lado de um botão que aparecia metade das vezes. Eram dois
controles para uma conversa só. Agora é um, sempre visível no app, com dois
estados:

| estado | rótulo | desenho |
|---|---|---|
| nada esperando | "Procurar atualização" | contornado (é uma consulta) |
| algo esperando | "Atualizar: base v… e app v…" | preenchido (é a ação) |

**A hora ruim continua desabilitando, com o motivo escrito** — e as duas
réguas que já existiam continuam distintas: um lote com APK espera os três
(cena, download e transmissão), porque instalar derruba o app inteiro e leva o
servidor das telas junto; um lote só de base web espera dois, porque custa um
piscar.

**E o PONTO do rótulo de versão saiu.** Ele existia porque não havia mais nada
no rodapé para dizer "há algo esperando" depois de a pergunta ser adiada.
Agora o botão diz isso por extenso e é o próprio alvo; um ponto discreto a
dois centímetros dele seria a mesma informação dita duas vezes — a régua que o
operador aplicou ao peso do álbum na v5.232. O rótulo voltou a ser o que ele
é: um indicador. Pelo mesmo motivo caiu a frase "Atualização adiada" que
aparecia por quatro segundos: ela ESCONDIA, no próprio botão, a resposta que
ele já estava dando.

**O oráculo (`tools/ota.test.mjs`) ganhou quatro casos**, e reprova em **9
asserções** contra o código anterior (verificado). Um deles é o toque fora, e
os outros três são o botão nos três momentos em que ele importa: adiada,
aplicando, e sem nada a fazer. As leituras novas são **null-safe de
propósito** — num bundle sem o botão isso é um RESULTADO, não um acidente, e
um `evaluate` que lança ali abortaria o arquivo inteiro, escondendo tudo o que
vem depois. É a mesma disciplina do `empurrar` e do `tocar` do próprio
arquivo, e a lição da v5.213: a primeira versão destes casos abortava, e as
outras vinte e oito asserções sumiam com ela.

---

## v5.244

**A v5.244: A SEGUNDA SÉRIE — o Informativo Mundial das Missões vira um álbum,
e ela desmente três suposições da primeira. OTA PURO** (nenhuma linha de
Kotlin; sem Release).

Pedido do operador: acrescentar, além do Provai e Vede, o **Informativo
Mundial das Missões** do canal `@daniellocutor` — *"você precisa analisar os
nomes para poder seguir a mesma lógica para separar por datas, garantir que o
vídeo é em português brasileiro e o áudio corretamente em português."*

**O catálogo aguentou o peso — e é aí que está a lição.** A série entrou com
uma linha e nenhum `if` por recurso, mas três coisas que pareciam regras
universais eram suposições de quando havia uma série só. Duas viraram CAMPO
declarado, e as duas estão escritas também na linha do Provai e Vede, porque
enquanto ele era o único aquelas escolhas não pareciam escolhas:

- **a playlist é do TRIMESTRE** ("Informativo | 3º Trimestre 2026", 13
  episódios de julho a setembro). `mesDaPlaylist` passou a devolver **o mês em
  que o período começa** — ele ordena as playlists e é o PISO de quem não
  declarar data. **Quem dá o mês de um item é sempre a data do TÍTULO**, e com
  playlists mensais os dois quase sempre concordavam: era por isso que a
  distinção não aparecia. Com um trimestre ela é a diferença entre 13
  episódios ordenados e 13 amontoados em julho.
- **o título não traz nome de episódio.** "Informativo Mundial das Missões |
  15 AGOSTO 2026" é a série mais a data, e a história ("O Sonho de Enoc") vive
  na MINIATURA. Herdar o "o nome é o que vem antes da barra" daria 52 linhas
  idênticas — a metade constante ocupando a lista inteira, que é exatamente o
  defeito que aquela regra existe para corrigir, ao contrário. A linha virou
  "15/Ago", e a gaveta do item (v5.236) responde o resto.

**A terceira não virou campo, e não podia virar: o IDIOMA.** O canal publica a
MESMA série em quatro — "Informativo" (PT), "Misiones" (ES), "Mission Stories"
(EN) e "【聖工消息】" (ZH) —, e o prefixo separa as **playlists** mas **não
separa os vídeos**: em espanhol eles se chamam "Informativo Mundial **de las
Misiones**", isto é, começam com a mesma palavra. `ehOutroIdioma` é o irmão do
`ehLibras` e está pelo mesmo motivo — um único vídeo posto por engano na
playlist de português vai ao telão do culto sem que id, duração, miniatura ou
canal o denunciem. Ele é GLOBAL e não um campo, porque ligá-lo por série seria
escolher, a cada linha nova, se a proteção vale; e a resposta é sempre a
mesma. O @provaievedeoficial passa por ele sem uma recusa, e há oráculo para
essa metade negativa.

**E o ÁUDIO é a outra metade da garantia, do outro lado da ponte.** O YouTube
dubla vídeo sozinho, e a dublagem não muda o título: ela é uma faixa a mais
dentro do MESMO vídeo, que nada do lado web tem como ver. Quem escolhe é o
`TrilhaAudio.kt` (v5.242, já instalado no v2.1) — idioma antes do cliente,
português exclusivo quando existe. As duas metades são independentes de
propósito, e o Registro imprime a trilha escolhida (`140@VISIONOS pt-BR`) para
a de baixo ser diagnosticável a distância.

**O que a segunda série ACHOU de quebrado na primeira, e este é o achado mais
caro do lote:** o ordinal opcional da data por extenso estava escrito
`[ºo°]?` **depois** de um `\s*`, então em "03 outubro" ele casava o "o" do mês
como ordinal e entregava o mês "utubro". O regex ACERTAVA — a captura satisfaz
tudo o que ele pede, logo não há retrocesso — e quem recusava era o
`montarData`, lá fora e calado. O defeito estava lá desde a v5.230 e nunca
apareceu porque nenhum título de outubro do Provai e Vede caiu na forma por
extenso; o Informativo tem um TRIMESTRE inteiro começando em outubro, e o mês
teria entrado sem data e no fim da lista. O `o` agora tem de estar colado no
dia (`3o`), e a varredura tenta **todos** os candidatos do título em vez de só
o primeiro.

**A data em si não custou uma linha**, e isso está registrado porque a leitura
natural diante de um canal novo é supor o contrário: "15 AGOSTO 2026" é a
forma por extenso da v5.230 sem o dia da semana na frente, e o `\b` do dia já
a alcançava. Supor formato foi justamente o erro que a v5.230 corrigiu.

Os dois oráculos foram verificados por ISOLAMENTO, e não por ausência de
símbolo — desligar uma peça de cada vez, sem `ReferenceError` no caminho (a
régua da v5.237): sem a recusa por idioma **6** asserções reprovam, sem o
campo `titulo` **4**, sem o `periodo` **11**, e sem o recuo do `nomeDoItem`
**1**. No percurso de ponta a ponta (`boot-nativo.test.mjs`, o único que sobe
a base COM a ponte) o stub do canal responde **por URL de canal**, com os
quatro idiomas lado a lado e o vídeo em espanhol **dentro** da playlist de
português: é o único lugar em que essa recusa pode ser exercitada.

---

## v5.243

**A v5.243: A SETA DE FECHAR O ÁLBUM VESTE A THUMB — e a coluna da direita
para de se mexer. OTA PURO** (sem Release).

Pedido do operador: *"mova a seta de fechamento do acordeão do álbum para que
ele fique na thumb do álbum quando estiver aberto, não precisando mover os
números referentes ao tamanho do álbum que hoje ficam ao lado dessa seta que
surge."*

**O defeito era assimétrico, e é isso que o tornava difícil de nomear.** A
seta ocupava o mesmo canto do botão de baixar. Num álbum COMPLETO aquele canto
está vazio — então abrir fazia a seta aparecer e empurrar o peso 34 px para a
esquerda. Num álbum INCOMPLETO o canto já tinha o botão de baixar, e a seta
apenas o substituía: nada se mexia. **O mesmo gesto movia ou não movia a tela
conforme o estado do download**, que é a pior forma de um layout ser
imprevisível — não há o que aprender.

**A thumb é o lugar certo por eliminação.** Ela é um quadrado do mesmo tamanho
no lado oposto, e com o álbum aberto é o único elemento da barra sem função: o
ícone identifica uma coleção que o operador já está olhando por dentro. Fechada
ela volta a ser identidade.

**E a coluna da direita passou a ser função de UMA pergunta só** — "há o que
baixar?" —, independente de aberto/fechado. Com o álbum aberto e parado o lugar
é **reservado**, não ocupado (`visibility: hidden`, o idioma do
`.mode-switch--vago`): quem baixa ali é o botão do painel, logo abaixo, que
carrega o estado e o progresso. Reservar mantém a coluna sem oferecer dois
botões para a mesma ação. O CANCELAR continua visível com o card aberto, que é
a exceção que a v5.72 já defendia: a barra gruda no topo, e um álbum de
centenas de faixas precisa poder parar num toque.

Medido nos quatro estados: o peso fica a 11 px da borda num álbum completo e a
54 px num incompleto — **o mesmo número aberto e fechado**, nos dois. O
oráculo (`tools/smoke.mjs`) mede essa distância, que é a coisa que o operador
viu se mexer, e cobra os DOIS pares: reservar o lugar num deles e esquecer o
outro passaria. Reprova em 2 asserções contra o código anterior.

---

## v5.242 (APK v2.1)

**A v5.242 (v2.1): O VÍDEO DO PROVAI E VEDE IA AO TELÃO EM INGLÊS, e a
Bíblia passa a vir inteira sozinha. METADE APK, METADE OTA.** Dois relatos do
operador, e eles não se tocam — o primeiro é Kotlin e exige Release, o segundo
é a base web e chega por OTA.

**1. "Vídeos do Provai e Vede estão sendo escolhidos os com áudio em inglês."**

O YouTube dubla vídeo sozinho, e as dublagens chegam ao extrator **na mesma
lista** de faixas de áudio da trilha original — sem nada na altura, no bitrate
ou no contêiner que as distinga. A escolha era `cliente → contêiner → bitrate`,
e **nenhum desses três sabe de idioma**: bastava a faixa em inglês ter bitrate
maior (ou vir antes num empate) para ela ser a escolhida. Nada erra alto nesse
caminho — o download funciona, o vídeo entra em cena, a barra anda —, e o
operador descobre no sábado.

A correção são DUAS metades, e a segunda é a que fecha o caso:

- **O IDIOMA VEM ANTES DO CLIENTE**, invertendo a ordem que a v1.49
  estabeleceu. A razão é uma assimetria de custo: uma faixa do cliente errado
  é **403** — ela não baixa, e a fila de candidatos existe justamente para
  absorver isso. Uma faixa do idioma errado **baixa perfeitamente**, e vai ao
  telão. Um resultado errado entregue com sucesso é pior que uma tentativa
  perdida.
- **E o português, havendo, é EXCLUSIVO.** Ordenar não bastaria: `TETO_AUDIO`
  é 2, e um 403 na primeira faixa faria a segunda — que pode ser a dublagem —
  descer calada. Não havendo trilha em português (o vídeo é mesmo estrangeiro,
  ou não declara trilha nenhuma), **nada muda em relação a antes** — e essa
  metade negativa é a que impede a correção de virar "só baixa se for
  português", que apagaria da biblioteca todo vídeo estrangeiro.

**A escala tem cinco degraus e o mais sutil é o segundo:** um vídeo SEM
metadado de trilha vem ANTES do ORIGINAL noutro idioma. Vídeo de faixa única é
a esmagadora maioria do acervo, e rebaixá-lo por não se declarar penalizaria
justamente o caminho que sempre funcionou. A DESCRITIVA é a última em qualquer
idioma — inclusive em português, e inclusive para efeito da exclusividade: ela
é a narração dos elementos visuais por cima do áudio, feita para quem não vê a
tela, e deixá-la excluir a original estrangeira trocaria um problema por outro.

**A regra saiu do `YoutubeGrab` para um arquivo PURO** (`TrilhaAudio.kt`, zero
import) pelo mesmo motivo do `EspelhoHttp`: o resto daquele arquivo é rede,
biblioteca de terceiro e `MediaMuxer` — nada disso se testa sem aparelho —, e
o que decide se a congregação ouve português cabe em três funções com JUnit.
São doze casos; contra a regra antiga, **oito reprovam** (verificado).

**E o Registro passou a dizer QUAL trilha veio**, que é a leitura que faltava
para este defeito ser diagnosticável: o resumo da extração ganhou
`{pt-BR 2, en 2 dublado}` e a etiqueta da faixa virou `140@VISIONOS pt-BR`.
Sem isso, a linha de um download em inglês é indistinguível da de um em
português — foi assim que ele atravessou sem sinal nenhum.

**O que NÃO foi verificado, e está dito:** o Kotlin não foi compilado — o
ambiente desta sessão não resolve o plugin do Android (a mesma limitação da
v5.228 e da v5.234). O `TrilhaAudio.kt` e o teste dele foram compilados e
EXECUTADOS à parte (são puros); o `YoutubeGrab.kt` foi conferido só até onde
um compilador sem as dependências alcança — ele parseia, e nenhum erro de
sintaxe restou. Quem compila o resto é o CI, que falha alto. E há uma
incerteza que só o aparelho resolve: se o extrator não devolver metadado de
trilha nenhum para esses vídeos, todas as faixas empatam no degrau 1 e a
escolha volta a ser a de antes — o `{…}` novo do Registro é exatamente o que
diz em qual dos dois casos o aparelho está.

**2. "Faça a Bíblia ser baixada inteira na versão ARA de forma automática."**

O download da versão INTEIRA já existia desde sempre — e **só** era disparado
por alguém ENTRAR na aba Bíblia. Quem nunca entrou ficava com o caminho sob
demanda: um capítulo por vez, conforme o uso, com a rede da igreja no meio do
culto como única rede disponível. Era o relato, palavra por palavra, e o
oposto do que a aba faz assim que é aberta uma vez.

`garantirBibliaBase()` entra no `init()` sem `await`, como o
`autoRefreshCollections`. **A versão é a que o app já escolheria**
(`pickDefaultBibleVersion` — a ARA, e a primeira disponível se ela não estiver
no banco), e **não** a que o operador selecionou: esta é a base que o app
garante, não a preferência de quem opera. Quem trocou de versão continua tendo
a dele pelo caminho de sempre, ao entrar na aba.

**O freio de 25 falhas seguidas nasceu junto, e nasceu porque a automação o
exigiu.** Enquanto a varredura só começava por um toque na aba, insistir até o
fim era barato: havia alguém olhando. Automática na abertura, um lançamento
offline — ou com o Wi-Fi da igreja sem uplink, que este documento descreve
como o ambiente NORMAL — pagaria 1189 requisições fadadas ao erro, com serviço
em primeiro plano, wake lock e notificação, **a cada abertura**. Vinte e cinco
erros seguidos não são uma oscilação (a concorrência é de 6): são a rede fora.

O oráculo entrou no `boot-nativo.test.mjs`, com um banco do LouvorJA de
mentira e a ARA em **segundo** lugar na lista de propósito — com ela na frente
o caso aprovaria os dois comportamentos. Ele cobra as duas metades: a
varredura começa sozinha, sem ninguém tocar na aba, **e** vai para a base
mesmo com outra versão escolhida pelo operador. Três asserções reprovam contra
o código anterior (verificado).

---

## v5.241

**A v5.241: A BIBLIOTECA PASSA A TER UMA ESCALA DE TONS — dois tons, uma
regra, os dois temas. OTA PURO** (CSS mais uma linha de texto; sem Release).

Relato do operador: *"a escolha de cores e temas das versões colapsadas das
coleções, dos álbuns e das músicas/itens do álbum… todo o esquema de cores e
design está inconsistente"*, mais duas queixas nomeadas sobre o painel de
opções.

**Medido antes de mexer, no tema escuro, do fundo para dentro:** a folha do
popup era 44,52,60; a barra de seção **fechada** compunha ~69,76,84 — o objeto
mais claro da tela, sendo o contêiner mais externo —; a MESMA barra **aberta**
virava 44,52,60, isto é, a peça trocava de cor conforme o estado; o card do
álbum dentro dela, 59,69,80; e a faixa dentro do card, 44,52,60 outra vez. A
elevação subia, descia, subia e descia — **44 → 69 → 44 → 59 → 44**, cinco
níveis aninhados. Não havia regra a aprender, e é isso que "imprevisível"
quer dizer.

**A regra que entra é uma só: dentro da folha há DOIS tons, e o aninhamento
nunca inverte a direção.** `--panel-2` é o tom de CONTÊINER — a barra da seção
**e** o card do álbum, os dois —, e ele é o token certo porque muda de direção
sozinho entre os temas (mais claro no escuro, mais escuro no claro). O corpo
aberto é o POÇO, com a cor da folha. E dentro de um contêiner o conteúdo não
ganha caixa: a faixa virou LINHA, separada pelo filete que separa qualquer
lista deste app. Estado (aberta, no ar, selecionada) é overlay, nunca um tom
novo.

**A causa raiz estava escrita em prosa, e metade dela era falsa nos dois
temas.** O comentário do `.hymnal-card` justificava a faixa como caixa: "as
músicas dentro dele (que são `--panel`) passam a se ler como recessos". No
escuro `--panel` (44) sobre `--panel-2` (59) de fato afunda; no CLARO `--panel`
é branco puro (255) sobre 222 — ele **eleva**. A mesma declaração produzia
direções opostas nos dois temas. É a lição da v5.192 aplicada ao aninhamento:
**direção só se preserva por OVERLAY, nunca por token opaco.**

**Por que dois tons e não uma escada de quatro:** uma escada de overlays
levaria o nível mais interno a ~180 no tema claro — mais escuro que a própria
página, um buraco no meio da lista. Dois tons fecham a conta nos dois temas
com a mesma regra.

**O botão de verificação ganhou corpo** — *"o ícone e o texto estão muito
finos e sem preenchimento para encorpar"*. Ele estava em `--surface`, que é o
"botão sobre o FUNDO do app", **dentro de um cartão** — e a regra escrita deste
projeto diz que ali a superfície se INVERTE: era o token errado para aquele
lugar desde sempre. Agora `--accent-soft` (o preenchimento concorda com a cor
do texto e do ícone), peso 600 e traço de 2,4 no SVG. O cancelar volta ao
recesso enquanto roda, senão o progresso em `--warn-soft` seria uma tinta
fraca sobre outra — o mesmo defeito que a v5.232 já tinha corrigido com outras
duas cores.

**E o estado virou só a FRAÇÃO** — *"sem o texto de completo que hoje tem uma
grafia e design completamente diferente do padrão do app"*. Ele está certo por
duas réguas: "✓ completo" trazia um glifo que não é da fonte de ícones do app
e uma palavra em caixa baixa no meio de uma linha de números, e dizia por
extenso o que "24/24" já diz — com o verde ao lado dizendo a mesma coisa pela
terceira vez. Quem carrega estado neste app é a COR; o texto fica com o que a
cor não sabe dizer, que é quanto falta. Numa série o número é a contagem de
episódios, sem a palavra; sem índice não há fração e a linha fica vazia, que
é o certo — o botão ao lado já diz "Baixar", e um botão de baixar num álbum
vazio é a própria mensagem.

O oráculo (`tools/smoke.mjs`) trava as três metades da regra **nos dois
temas** — a barra não troca de cor com o estado, contêiner é um tom só, e a
faixa não tem caixa —, porque a causa raiz era justamente uma direção que se
invertia entre eles. Reprova em 4 asserções contra o CSS anterior.

---

## v5.240

**A v5.240: A LINHA DE UMA FAIXA DEIXA DE SER MAIS ALTA QUE O ÁLBUM QUE A
CONTÉM. OTA PURO** (só CSS; nenhuma linha de Kotlin, sem Release).

Relato do operador: os cards da lista de um álbum estão *"muito volumosos
verticalmente, limitando o número de itens na visualização da lista, e até
mesmo ficando muito diferente do tamanho que já são títulos dos álbuns"*.

**Medido antes de mexer, e ele estava certo por um fator visível:** a barra do
álbum tinha **51,6 px** e a linha de uma faixa DENTRO dela, **66 px** — o item
era 28% mais alto que o cartão que o contém, e o passo de 71,6 px punha 12
faixas numa tela de 900 px. O nome da faixa ainda era desenhado MAIOR que o
título do álbum (1,02rem contra 0,95rem), isto é, a hierarquia estava
invertida nas duas dimensões ao mesmo tempo.

**Quem forçava a altura era o botão de tocar**, 46 px — o tamanho que ele
herdou da miniatura que ele substituiu na v5.62. Num álbum aberto o conteúdo
da linha é UMA linha de texto de 19 px: sobravam 43 px de folga por faixa,
repetidos em 613 hinos.

Agora o ▶ tem 38 px, o padding caiu de .5rem para .3rem e o nome entrou na
escala do título (0,95rem) — o que separa os dois passou a ser o PESO (700 no
álbum, 500 na faixa), que é a distinção certa. Medido depois: **linha de
51,6 px contra barra de 51,6 px** (razão 1,00), passo de 55,6 px, **16 itens
na mesma tela**.

**O piso de toque é a outra metade, e ela não é negociável:** encolher até o
texto trocaria um problema de densidade por um de mira no meio de um culto. O
▶ para em 38 px, acima de `--hit` (34 px), que é exatamente a medida que esse
token existe para proteger.

**A linha da BUSCA cresce com o conteúdo, como sempre:** com subtítulo ela dá
os mesmos 51,6 px (o texto ainda cabe atrás do botão), e com um trecho de
letra casado vai a 67,3 px — ali a altura é do conteúdo, não do enfeite.

O oráculo (`tools/smoke.mjs`) trava a RAZÃO, nunca o pixel: escrever "51,6"
faria ele reprovar numa mudança legítima de fonte, e a queixa nunca foi sobre
um número — foi sobre a linha ser maior que o título. Ele reprova em 3
asserções contra o CSS anterior (verificado).

---

## v5.239

**A v5.239: A SEÇÃO DE FAVORITOS FICA SÓ COM A LISTA — as ações sobem para a
barra, viram UM ícone, e o rodapé de disco sai. OTA PURO** (nenhuma linha de
Kotlin; sem Release).

Quatro podas do operador, e as quatro tiram da tela coisa que não decide nada.

**O contador saiu.** *"Remova o indicador de quantos favoritos temos."* A
seção está sempre aberta e a lista inteira vem logo abaixo: um número dizendo
quantos itens há a dois centímetros deles é a mesma medida dita duas vezes —
o argumento que tirou o peso do painel do álbum na v5.232.

**As ações subiram para a BARRA da seção, só com ícone.** No corpo elas eram
dois botões de texto no rodapé, isto é, duas linhas de lista que não são itens
da lista. Na barra o rótulo do que a ação faz mora na folha que ela abre — e
um cabeçalho com texto de botão dentro deixa de se ler como cabeçalho.

**E OS DOIS BOTÕES VIRARAM UM.** *"Unifique o botão de Adicionar pasta com o
botão de buscar no sistema. Agora ao tocar ele, ele dá a opção de criar uma
pasta, ou trazer uma pasta e seus arquivos que já existem do sistema do
celular."* A unificação é a leitura certa: os dois respondiam à MESMA pergunta
("quero uma pasta aqui") por caminhos diferentes, e lado a lado obrigavam a
ler dois rótulos para descobrir isso. Um alvo só, e a diferença — que é o que
de fato precisa ser lido — vai para a folha, **escrita por extenso**, que é
onde este app põe escolha desde a v5.62. A folha é a MESMA do acervo e do
YouTube (`#songMenuPopup`), pelo motivo de sempre: uma segunda com a mesma
anatomia divergiria no primeiro ajuste. É o precedente do `escolherDestinos`.

**O corpo perdeu a prosa.** O vazio explicava COMO favoritar e COMO criar
pasta, em três linhas. A estrela está em cada linha do app inteiro e a criação
de pasta agora fica a um dedo dali, na barra: **instrução que descreve um
botão visível é ruído, e o botão é a instrução.** Ficou "Nenhum favorito
ainda."

**E O RODAPÉ DE DISCO SAIU DA BIBLIOTECA** — *"esse valor é falso, irreal e
disputa com os cabeçalhos que já dizem o peso atual e total dos arquivos"*. Ele
está certo pela régua da própria medida: `navigator.storage.estimate()` fala do
ORIGIN inteiro e é deliberadamente imprecisa (os navegadores acrescentam
padding ao valor, contra ataques de tempo), e a "cota" é o que o navegador ACHA
que pode ceder — não o que o cartão tem. Ela ocupava o rodapé da tela em que a
pergunta *"quanto isto pesa?"* já é respondida coleção por coleção, com o
número que o app de fato conhece. `renderStorageUsage` saiu com os dois
chamadores; `fmtBytes` fica, porque é o formatador de tamanho do app inteiro.

---

## v5.238

**A v5.238: OS FAVORITOS DEIXAM DE TER DUAS PORTAS — a seção não colapsa, e a
gaveta vira só a tela de dentro de uma pasta. OTA PURO** (nenhuma linha de
Kotlin; sem Release).

Três pedidos do operador, e os três fecham o movimento que a v5.237 começou:
*"mantenha os favoritos como uma seção sempre aberta. E também ajuste esses
favoritos na biblioteca para ter também o sistema de importar pastas que temos
nos favoritos original. E pode remover o botão de acesso ao local e sistemas
antigos dos favoritos, pois tudo agora será dentro da biblioteca."*

**A seção não colapsa, e a razão é a mesma que a pôs no topo.** Os favoritos
são o atalho de quem já procurou antes; um atalho atrás de um toque a mais
deixa de ser atalho. O construtor de grupo ganhou `fixo`: sem seta, sem
ouvinte e sem cursor de toque — **um cabeçalho que parece tocável e não faz
nada é pior que um rótulo**, e essa é a única parte disto que o CSS decide.

**"Pasta do aparelho" desceu do cabeçalho da gaveta para o rodapé da seção**,
ao lado de "Nova pasta". Não é realocação por gosto: aquele botão era ação da
RAIZ da gaveta, e a raiz deixou de ser alcançável — ele ficaria sem lugar
nenhum de onde ser tocado. No rodapé as duas formas de criar pasta se leem
juntas, que é a pergunta que elas de fato respondem ("de onde vem o que eu
quero ter à mão?"), e as duas são `.import-btn` na mesma `.import-row`, que já
era `flex` com `flex: 1` em cada — dividem a linha sem uma regra nova.

**A gaveta sobrevive como a tela de DENTRO, e só isso.** `#favHeadBtn` saiu do
cabeçalho com o CSS dele; `#addDirBtn` saiu da gaveta. O único caminho para lá
é entrar numa pasta (`garantirGaveta`), e por isso **o voltar sempre FECHA**:
subir para uma "raiz" que ninguém mais alcança seria devolver o operador a uma
tela sem porta. A tela de trás é a Biblioteca, que continua aberta embaixo,
com a seção de onde ele veio.

**O que se ganha é o que a v5.193 já tinha cobrado noutro lugar:** duas portas
para a mesma lista são dois lugares para ela divergir — e o cabeçalho tem
largura de celular, com um voltar, uma troca de modo e um título disputando-a.

Os oráculos do `boot-nativo.test.mjs` cobram as duas metades de cada pedido: a
seção está aberta com todos os outros grupos fechados **e** não há como
fechá-la (sem seta, e o clique no cabeçalho não alterna); o rodapé tem as duas
formas de criar pasta **e** a gaveta continua desenhando a lista dela.

---

## v5.237

**A v5.237: A BIBLIOTECA VIRA UM ÍNDICE — as seções nascem fechadas e os
FAVORITOS são a primeira delas. OTA PURO** (nenhuma linha de Kotlin; sem
Release).

Dois pedidos do operador, e eles são o mesmo movimento: *"coloque os favoritos
dentro da biblioteca"* e *"tornar os agrupamentos de coleções, como diversos e
cds do ano e etc… todas as coleções, em colapsados, assim a listagem das
seções fica mais curta e a navegação se torna mais ramificada, para maior
organização. Pode deixar a seção de favoritos no topo da listagem."*

**O que a Biblioteca era: uma pilha com títulos.** Os cabeçalhos de grupo eram
rótulos mudos e todos os cards vinham despejados embaixo, um atrás do outro —
numa igreja com dezenas de álbuns, abrir a Biblioteca era rolar até achar a
SEÇÃO, e só então o álbum. Agora a primeira tela é o índice: meia dúzia de
linhas com nome e contagem, e cada toque desce um nível. Medido no viewport de
um celular: **114 px fechado contra 184 px** com uma única seção aberta, e
essa distância cresce com o tamanho do acervo.

**Fechado NÃO CONSTRÓI os cards, e isso não é otimização de véspera:** o
acervo é redesenhado a cada 400 ms enquanto um download roda
(`COLL_REFRESH_MS`), então montar dezenas de cards que ninguém está vendo era
o grosso do trabalho de DOM da tela. Por isso o construtor de grupo devolve o
corpo **ou `null`** — quem recebe `null` não monta nada, em vez de montar e
esconder com `display: none`.

**Abrir um grupo não fecha os outros**, ao contrário do acordeão de um álbum.
Lá a razão é o tamanho (duas listas de centenas de músicas empurrariam para
fora da tela o card que o operador mira); aqui os grupos são curtos, e
comparar dois — "este álbum ou aquele?" — é o que se faz numa tela de índice.

**Os favoritos têm duas casas e UMA implementação.** O grupo do topo é montado
pelo MESMO `renderFolderList` da gaveta, apontado para outro host (`favHost`,
o padrão que `listHost()` e `renderStorageUsage(alvo)` já usavam neste
arquivo). Duas marcações para a mesma lista divergiriam no primeiro ajuste — e
divergiriam justamente nos gestos (o toque longo que entra na seleção
múltipla), no agrupamento por tipo e na estrela.

**A gaveta continua existindo, e não por esquecimento: ela é a tela de
DENTRO.** Entrar numa pasta abre voltar, busca e seleção múltipla — isso é uma
tela, não uma seção, e reimplementá-la inline seria a duplicação que a decisão
acima existe para evitar. Quem garante a gaveta é `openFolder`/`openOpfsFolder`
(uma função, não um ouvinte por linha), e o `#favPopup` ganhou um degrau de
`z-index`: ele é declarado ANTES da Biblioteca no documento, e sem isso o
toque numa pasta abriria uma gaveta POR BAIXO — a mesma armadilha, com o mesmo
remédio, que o `#folderPopup` já documentava.

**A linha de uso do disco não é repetida** dentro do grupo: ela já é o rodapé
da listagem, e duas no mesmo `<ul>` fariam a segunda apagar a primeira num
`estimate()` fora de ordem.

Os oráculos entraram no `boot-nativo.test.mjs` e cobram as duas metades de
cada pedido: fechado não constrói card **e** o toque abre; os favoritos são
desenhados na Biblioteca **e** a gaveta continua desenhando os dela — sem essa
segunda metade, apontar o host para o lugar novo teria quebrado o antigo em
silêncio. Verificados por ISOLAMENTO, não por ausência de símbolo: com os
grupos nascendo abertos, 2 asserções reprovam; sem o grupo de favoritos, 5.
(A diferença importa — um `ReferenceError` reprova tudo sem discriminar nada,
que é a medição que a v5.233 recusou.)

---

## v5.236

**A v5.236: A BIBLIOTECA PASSA A TER TIPOS — a gaveta de um vídeo deixa de
prometer letra, e a fila de letras deixa de perguntar por ele. OTA PURO**
(nenhuma linha de Kotlin; sem Release).

Pedido do operador: *"atualmente a biblioteca é estruturada para usar vídeos e
músicas, mas ela também vai ser usada para armazenar os materiais de eventos,
vídeos comuns e apresentações futuramente… mas por exemplo, o toque nele na
lista abre ainda a opção de ver a letra, mas ele não tem letra por não ser uma
música"*.

**O diagnóstico é o da v5.229 numa terceira roupa: desviar as PORTAS de um
recurso não desvia o que estava atrás delas.** A Biblioteca nasceu com um
modelo de item só — a música do LouvorJA, que tem áudio, letra e uma segunda
variante —, e tudo o que a lista oferece saiu daí. A v5.230 desviou as duas
FOLHAS de um episódio de série para o caminho do YouTube e parou; a LINHA
continuou sendo a da música, e por isso o toque nela ainda abria a caixa da
letra para anunciar **"Letra ainda não baixada"** — a promessa de uma coisa
que nunca vai chegar.

**O que entra não é um `if` a mais, é o TIPO** (`tipoDaColecao`, com as
capacidades `temLetra` e `ehLink`). Cada afordância passou a perguntar pela
capacidade de que ela depende, nunca por "é série?" — e a diferença é
justamente o que abre lugar para o terceiro modelo que o operador anuncia (os
materiais de evento, os vídeos avulsos e as apresentações): ele entra como mais
um tipo e um punhado de respostas, em vez de mais um `ehSerie` espalhado por
meia dúzia de funções que não se conhecem. **Por COLEÇÃO, e não por item**, e
isso está escrito como escolha: hoje toda coleção é homogênea, e o dia em que
uma não for, o que muda é `tipoDoItem(coll, s)` consultar o `s` primeiro.
Escrever esse desvio agora seria um ramo que nada alcança.

**A gaveta responde a mesma pergunta com a resposta do tipo.** Ela existe para
dizer "é este mesmo?": numa música isso é a LETRA (e é dela que sai o trecho
marcado quando a busca casou no meio de uma estrofe); num vídeo é a
**MINIATURA**, a duração e o estado no aparelho. Os dois primeiros o extrator
já entregava em toda listagem de playlist e o índice **descartava**; o
terceiro é o que decide de verdade no domingo de manhã, porque "Tocar agora"
de um vídeo TRANSMITE e um episódio já guardado entra do disco — ~300 MB de
diferença.

**E guardar um campo novo no índice obrigou a mexer na assinatura**, senão
este lote reproduziria o defeito da v5.233 pela porta de trás: `AVSerie.
impressao` conhece a regra que decide nome e ordem, e quem decide o que o
índice GUARDA é uma função do `controle.js`. Ela virou `serieFaixaDoItem`,
nomeada de propósito — é o CÓDIGO dela que entra na assinatura, e um `map`
anônimo não tem nome para passar. Índice velho é refeito uma vez, sozinho.

**A correção mais cara do lote é a que ninguém veria.** `syncLyrics` varria
TODA coleção com itens e pedia `music_<id>` ao LouvorJA — e num episódio de
série esse id é do **YouTube**, uma pergunta que aquele banco não tem como
responder. Falha de rede não grava `LYRIC_NONE` de propósito, então as ~52
requisições de cada série voltavam **a cada abertura do app, para sempre**, e
ainda entravam no total da notificação "Letras das músicas", que o operador lê.
O modo de falhar é o mais silencioso que este projeto tem: um `catch` vazio
numa tarefa de segundo plano. O índice da busca por trecho varria o mesmo
nada, sem custo de rede.

Os oráculos entraram no `boot-nativo.test.mjs` — o único que sobe a base COM a
ponte, logo o único capaz de exercitar a série — e cobram as DUAS metades: o
vídeo deixa de prometer letra **e** a música continua tendo a dela. Sem a
segunda, apagar a gaveta inteira passaria. Verificados nos dois sentidos: **6
asserções reprovam** contra o código anterior.

**E a primeira versão deles reprovou por um defeito do próprio teste**, que é a
lição da v5.208 numa terceira roupa: ele clicava na linha sem entrar no modo
AVANÇADO, e no Modo Fácil o toque na linha TOCA em vez de abrir gaveta
nenhuma — a medição encontrava um container vazio e teria concluído o que
quisesse. O caso ao lado (a série é ordenada por data) escondia a segunda
armadilha: o primeiro item da lista é o de julho, e medir a miniatura nele
reprovaria uma gaveta que está certa.

---

## v5.235

**A v5.235: A LINHA DAS OPÇÕES ENCOLHE DE VERDADE — o estado sai da segunda
linha e a remoção vira só a lixeira. OTA PURO** (nenhuma linha de Kotlin; sem
Release).

Pedido do operador sobre a v5.232: *"mude de lugar o subtítulo de completo ou
de progresso… não use linha dupla, pois a ideia já é justamente compactar os
elementos dessas opções. Apenas diminua o botão de remover apenas para um
botão de ícone de lixeira. Isso vai liberar mais espaço para o botão de
atualizar."*

Ele está corrigindo uma meia-solução minha. A v5.232 tirou as duas faixas de
chips e pôs o estado DENTRO do botão — só que numa segunda linha, o que
devolvia ao painel a altura que condensá-lo tinha acabado de tirar. Agora o
estado divide a linha com o rótulo e, quando falta largura, é ELE que
encolhe com reticências: some o qualificador, nunca a palavra que diz o que o
toque faz.

**A lixeira sem rótulo é uma decisão sobre CONFIRMAÇÃO, não sobre espaço.** O
que ela perde na tela — "do dispositivo", que dizia o alcance — está inteiro
no diálogo que ela abre ("Excluir o que foi baixado de X (áudios e capas) e a
lista offline?"), e é isso que permite um destrutivo ficar só com o ícone: ele
é confirmado, e a confirmação é quem nomeia o dano. A frase continua no
`title` e no `aria-label`. Medido: 44 px contra 316 px — a linha inteira é do
botão que carrega ação, estado e progresso.

Com isso caiu também o argumento do `flex: 1 1 0` da v5.95 ("a ação destrutiva
não pode ser a maior das duas"): ela agora é, por construção, a menor.

**E O ORÁCULO DA v5.232 ESTAVA MEDINDO ZEROS.** A asserção "os controles
dividem uma linha" comparava os topos dos botões dentro de um painel que, no
Modo Fácil, é `display: none` por regra — e num elemento escondido toda medida
é zero. Zeros comparados com zeros passam: ela aprovava um layout que nunca
tinha olhado. É a lição da v5.208 com outro nome (*"uma medição que não acha
nada parece uma medição que passou"*), e a correção é a mesma: **entrar no
modo em que a peça vive** (`setAppMode('full')`) e desenhar numa lista própria
e VISÍVEL, com a largura de um celular. Agora as quatro asserções novas
reprovam no código anterior (verificado).

**Uma segunda armadilha do mesmo caso, e ela é do tipo que passa despercebido
para sempre:** "o botão não tem rótulo" não pode ser lido do `textContent`. O
ícone é uma LIGADURA da fonte, isto é, um caractere de uso privado dentro do
`<span class="msym">` — `trim()` não o remove e `JSON.stringify` o imprime sem
escapar, então o dump dizia `""` para uma string de comprimento 1. A pergunta
certa é pelos nós de TEXTO diretos do botão, que é o que "rótulo na tela"
significa.

---

## v5.234 (APK v2.0)

**A v5.234 (v2.0): O SISTEMA DE ATUALIZAÇÃO INTEIRO — os dois canais viram
um evento, a detecção fica autoritária e a pergunta volta. EXIGE APK**
(`SHELL_VERSION` **43**).

Pedido do operador, e ele nomeia o defeito melhor do que qualquer diagnóstico
meu: *"a detecção de atualizações disponíveis é extremamente inconstante,
demorada e quase aleatória… precisamos de um sistema autoritário absoluto"*.
Mais o desenho de como ela deve terminar: um popup com "Atualizar agora" ou
"deixar para depois"; e havendo Release nova, *"o sistema aguarda a release
sair, para então liberar o ota, assim o ota já vem com o link da release"*.

**Os DOIS canais passam a ser UM evento.** `shellTag` no `version.json`
declara a Release que o lote exige; o `web-ota` SEGURA a publicação do bundle
até ela existir, e o gatilho `release: [published]` a republica com o bloco
`shell` dentro do manifesto — versão, URL do `.apk` e tamanho. O aparelho lê
tudo numa requisição só e pergunta UMA vez sobre o lote inteiro.

**E é o manifesto que permite a detecção ser rápida.** A ronda foi de 60 s
para **15 s**, o piso de 15 s para 5 s e o back-off de até 90 s para até 30 s.
Perguntar o APK à API do GitHub nessa cadência esgotaria as 60 requisições/hora
em quinze minutos e a detecção passaria a falhar com 403 pelo resto da hora —
mais lenta e mais imprevisível do que os 30 minutos de antes. Um asset de
release não consome limite nenhum.

**Três defeitos de detecção foram achados no caminho, e os três são mudos:**
o piso entre consultas (15 s) era IGUAL à ronda, então uma batida que chegasse
um milissegundo cedo era descartada e a ronda valia 15 s ou 30 s conforme o
jitter do agendador — literalmente "quase aleatória"; a ronda morria em
silêncio para sempre se o `Runnable` lançasse (`scheduleWithFixedDelay`
cancela as execuções seguintes, sem log); e um **`sha256` reprovado era
carimbado como SUCESSO**, então a ronda seguinte rebaixava o mesmo zip,
reprovava o mesmo hash e repetia, megabytes por minuto, para sempre. Este
último tinha causa estrutural conhecida — os dois assets eram substituídos um
a um, sem transação, e o próprio comentário do `concurrency` já dizia que uma
intercalação deixa "o zip de uma com o sha256 da outra". O **nome versionado
do zip** fecha a causa; tratar o sha reprovado como falha retentável fecha o
modo de falhar.

**A pergunta volta, e ela revoga a v5.151 pelo lado certo.** Aquela versão
tirou o diálogo porque ele "nunca aparecia" — era suprimido com cena, download
**ou espelho ligado**, e o espelho fica ligado o culto inteiro. O diagnóstico
estava certo e o remédio era largo demais: aplicar sem perguntar troca a base
no meio do que o operador estiver fazendo. Agora o espelho **não segura mais**
a pergunta (ele custa uma tela da rede com a página antiga em memória; a cena
e o download custam a projeção e o hinário pela metade), e instalar o APK —
que derruba o app inteiro — continua esperando os três.

**A INTENÇÃO é a peça que faz o lote de duas metades funcionar.** `otaApply`
substitui o documento, então nada em memória atravessa esse ponto — e é
justamente depois dele que falta instalar o APK. Ela é gravada no `state` do
banco ANTES de aplicar (o mesmo lugar e o mesmo motivo da intenção de download
do YouTube, v1.59) e relida na abertura, que retoma sozinha. Descartada quando
o `versionName` instalado alcança a versão pedida, senão o instalador
reabriria a cada abertura oferecendo a versão que já está rodando.

**O oráculo que faltava:** `tools/ota.test.mjs`, em Chromium com ponte de
mentira. Este era o único caminho do app cujo defeito **não tem sintoma** —
quando a atualização não chega, nada quebra e o operador só continua na versão
de anteontem sem saber —, e nenhum teste o tocava: o `smoke.mjs` sobe sem
ponte (todo o bloco é `window.__NATIVE__`) e o `boot-nativo` prova o boot, não
o fluxo. Ele reprova em **23 asserções** contra o código anterior (verificado),
e ele próprio quase repetiu o erro do `apk.yml` da v5.213: a primeira versão
abortava na primeira asserção e levava as outras vinte e duas junto.

**O que NÃO foi verificado, e está dito:** o Kotlin não foi compilado — o
ambiente desta sessão não resolve o plugin do Android (a mesma limitação da
v5.228). Quem compila é o CI, que falha alto. As referências cruzadas foram
conferidas à mão, e a lógica do passo novo do workflow foi exercitada nos
**seis** caminhos possíveis com um `gh` de mentira.

---

## v5.233

**A v5.233: O ÍNDICE DA SÉRIE FICAVA PRESO NA REGRA VELHA — a correção da
v5.230 nunca chegou à lista. OTA PURO** (nenhuma linha de Kotlin; sem
Release).

Relato do operador: *"tentei limpar o cache e recarregar, mas a listagem ainda
mantém o item do provai e vede que não identificava o 3 de janeiro… verifique
se ele está atualizando a listagem ou se ele fica preso"*.

**Ele fica preso, e a pergunta dele nomeia o defeito.** O índice da série é
guardado com os nomes JÁ FORMADOS e a ordem JÁ decidida, e a atualização é
pulada quando a assinatura das playlists bate com a guardada — a economia da
v5.228, que evita doze extrações do YouTube por retomada. Só que aquela
assinatura fala do que o **canal** publicou, e o canal não mudou uma vírgula:
a v5.230 mudou a REGRA que transforma títulos em nomes, e nada nessa conta
sabia disso. Toda atualização batia a assinatura e devolvia na hora, com o
índice de antes.

**E limpar o cache não podia ajudar** — o índice mora no IndexedDB, não no
cache do WebView. Não havia caminho nenhum na tela que desfizesse isso.

É a lição da v5.220 num lugar novo: **um valor DERIVADO que sobrevive à
mudança da regra que o derivou é um valor errado com carimbo de atual.**

A correção é a impressão digital da regra entrar na assinatura
(`AVSerie.impressao`): um FNV-1a de 32 bits sobre o código das funções que
decidem, mais o catálogo. Mudou a regra, a impressão muda e o índice é refeito
**uma vez**; não mudou, nada é reextraído e a economia fica intacta. Ela é
tirada do próprio código de propósito — um contador que alguém precise lembrar
de subir é a mesma sincronização manual que este projeto recusa em toda parte,
e quem esquecesse de subi-lo reproduziria exatamente este defeito. O preço
está dito: se um dia a base web passar por um minificador, a impressão muda a
cada build e custa doze extrações por versão.

**O oráculo teve DUAS versões, e a primeira era um falso positivo** — o que
aqui é a parte instrutiva. Ela escrevia uma assinatura inventada
(`"rVELHA|…"`) para simular o aparelho do operador, e qualquer lixo difere do
que o código calcula: ela passava nas DUAS versões, isto é, não media nada. A
que ficou reproduz o estado REAL — a assinatura que a versão anterior
escrevia, só o canal — e por isso reprova no código anterior (verificado). A
segunda metade é inseparável: com a regra e o canal em dia, **nenhuma**
extração acontece; sem ela, "refazer sempre" passaria no teste e custaria doze
idas ao YouTube por retomada.

**No aparelho:** a lista se conserta sozinha na próxima atualização de índice
(o TTL é de 12 h, no abrir do app), e o "Atualizar a lista" do card força na
hora.

---

## v5.232

**A v5.232: AS OPÇÕES DO ÁLBUM VIRAM UMA LINHA — o peso sai porque já estava
na barra. OTA PURO** (nenhuma linha de Kotlin; sem Release).

Pedido do operador: *"o peso já não precisa existir ali, pois já está na barra
principal antes mesmo de abrir. quanto aos outros elementos, preciso ajustá-los
para que fiquem apenas em uma linha, resumindo basicamente a verificação (com o
indicador do progresso e resultado) ou remoção."*

O painel aberto tinha **três linhas para duas ações**: uma faixa de chips
("Sincronizados: 4/4 · Completo offline" e "Peso: 18 MB") e, abaixo, os dois
botões. Agora é uma: `[⟳ Verificar · ✓ completo] [🗑 Remover do dispositivo]`.

**O peso era a mesma medida dita duas vezes, a dois centímetros.** Ele já vive
na barra do card — `fracaoPeso`, o mesmo par de números —, e é justamente por
lê-lo ali que o operador decide abrir. Saíram com ele o `hymnalStat()` e o
`fmtParBytes()`, que não tinham outro chamador. E vale registrar por que ele
sobreviveu tanto: a v5.73 fez esta mesma faxina, e o peso só passou a estar na
BARRA depois (v5.70/v5.93) — ninguém releu o painel contra ela.

**O estado não se perdeu: ele desceu para dentro do botão que qualifica.** A
gramática é a mesma da cortina e do botão de transmitir — **o rótulo nomeia a
AÇÃO, o estado diz onde ela está**: "Verificar · ✓ completo", "Baixar · 12/24",
"Atualizar a lista · 52 episódios". Sozinho, o rótulo anterior ("Verificar
atualizações") não dizia nem que o álbum estava inteiro no aparelho.

**E o progresso virou DESENHO, não uma segunda frase.** Enquanto o download
roda, o botão de cancelar se preenche até `--p`. Escrever "Baixando 2 de 4…"
aqui seria repor exatamente o que a v5.73 tirou deste painel — quem escreve
isso é a barra do card, fixa no topo do aberto e visível daqui. Duas
armadilhas de CSS ficaram escritas na folha: o preenchimento precisa de
`z-index: -1` **e** de `isolation: isolate` no botão (o rótulo é um nó de
TEXTO e não recebe `z-index`, então quem desce é a barra; sem o contexto de
empilhamento o -1 cairia atrás do fundo do próprio botão), e o aviso do
cancelar mudou de papel — era o fundo chapado, virou borda e texto, porque um
preenchimento em `--warn-soft` sobre um fundo `--warn-soft` seria uma barra
invisível.

Os oráculos se dividem pela natureza: o `boot-nativo` mede o ESTADO (o painel
com um filho só, o peso ausente dele e PRESENTE na barra, o resultado dentro
do botão) e o `smoke.mjs` mede a FORMA (o preenchimento é proporcional, fica
atrás do rótulo e não é da cor do fundo). Verificados nos dois sentidos —
4 e 3 reprovados com o código anterior.

**E um falso negativo do próprio teste virou lição, de novo:** a primeira
versão da asserção não achava o painel, e o defeito era do harness —
`renderCollectionsList` **acrescenta** à lista, e o caso anterior já a tinha
desenhado, então o `find` achava o card VELHO, ainda fechado. Medir o primeiro
nó que casa não é medir o que está na tela.

---

## v5.231 (APK v1.99)

**A v5.231 (v1.99): OS BOTÕES DA NOTIFICAÇÃO PASSAM A SER DA CENA, e a
transmissão deixa de sumir quando há mídia no ar. EXIGE APK.**

> **A TAG É A v1.99 E NÃO A v1.98, e o registro fica porque o erro é
> instrutivo:** a v1.98 já tinha sido publicada pelo lote paralelo (as séries,
> shell 41), e disparar a Release com aquele nome não moveu a tag — o
> `action-gh-release` não move tag existente — mas SUBSTITUIU o `.apk` dela por
> um compilado de `main`. Isto é, por alguns minutos a página da v1.98 serviu
> um binário que não era o código da v1.98. A regra que faltava está escrita no
> "Build": **tag nova para binário novo**; mover uma já publicada é o que o
> input `retag` existe para fazer, de propósito atrás de um input próprio.

Duas perguntas do operador, e a primeira precisa de uma correção de premissa
antes da resposta.

**1. "Conseguimos centralizar a transmissão no player, removendo a notificação
individual dela?"** — **ela já é um cartão só desde a v5.190**: o
`EspelhoService` e a notificação dele foram removidos ali, e o que restou foi
UM cartão com DUAS CARAS (player com cena · endereço e telas sem cena). O que
o operador estava vendo como "a notificação exclusiva da transmissão" é a
segunda cara.

O que de fato faltava, e este lote entrega: **com uma cena no ar, a
transmissão sumia**. Punha-se um louvor para tocar e a gaveta deixava de dizer
que havia um servidor no ar — a informação existia e era descartada. Agora ela
é o SUBTEXTO do player (a linha do cabeçalho que o `MediaStyle` desenha), que
não disputa espaço com o título nem com os botões.

**Um player LITERAL em tempo integral não é possível, e a razão é da
plataforma, não de gosto.** Para o cartão sem cena virar `MediaStyle` seria
preciso uma sessão com estado — e a partir do Android 13 os botões saem do
`PlaybackState`, não das `Notification.Action`. Com `STATE_NONE` (o único
honesto sem mídia) o sistema não desenha botão nenhum e o "Desligar
transmissão" sumiria justamente nas versões novas; com um estado PAUSADO ele
apareceria, mas o sistema promoveria a sessão ao painel de mídia das
configurações rápidas — um player fantasma, com transporte morto, para
controlar coisa nenhuma. Duas caras num cartão só é o melhor que a plataforma
permite sem inventar um desses dois defeitos, e está escrito no KDoc do
`SessionService` para a próxima leitura não tentar de novo.

**2. "Conseguimos mudar os botões conforme o estado?"** — sim, e é o outro
lado do lote (`SHELL_VERSION` **42**). O `nowPlaying` ganhou `actions`: a
lista, na ordem, escolhida pelo `controle.js`. As três perguntas que a
`acoesDaNotificacao` faz:

- **play/pause** só existe com mídia que tenha TEMPO (a mesma régua da barra
  de progresso). Imagem, versículo, mensagem e cronômetro não têm o que pausar.
- **⏮/⏭** existem quando há EIXO: uma cena com slides ou uma mídia atual (é o
  que faz o par trocar de item na lista).
- **cortina e parar** existem sempre.

Com o cronômetro de abertura sozinho no ar, o cartão passa a ter DOIS botões
grandes — cobrir e parar — em vez de cinco, três deles mortos ocupando o modo
compacto (que só mostra três).

**A lista vem de fora pela invariante 5**, e não é formalidade: quem sabe se
"próxima estrofe" faz sentido agora é o lado web, e uma cópia dessa regra em
Kotlin envelheceria à parte da de lá. O conjunto entra também na CHAVE de
deduplicação do `pushNowPlaying` — sem isso, uma cena que muda só de eixo (o
cronômetro entrando por cima de uma imagem) seria deduplicada e o cartão
ficaria com os botões da cena anterior. **Um botão que sobrou é pior que um
que faltou: ele responde.**

O conjunto é declarado nos DOIS lugares que o Android lê — o `PlaybackState`
(que desenha do 13 em diante) e as `Notification.Action` (abaixo dele) —,
porque declarar de um lado só é fazer o botão existir em metade dos aparelhos:
é o defeito da v1.17 com outro nome. E o `tools/ponte.test.mjs` afirma que o
campo VIAJA, que é o modo de falhar deste objeto remontado campo a campo (o
`slideLabel` passou cinco versões sem chegar ao Kotlin).

---

## v5.230

**A v5.230: O EPISÓDIO DE SÉRIE VIRA UM VÍDEO DO YOUTUBE, e a DATA passa a
ter DUAS formas. OTA PURO** (nenhuma linha de Kotlin; sem Release).

Dois pedidos do operador, e os dois derrubam uma suposição da v5.228.

**1. "O tratamento dos itens deve ser o mesmo dos vídeos do YouTube (sem a
opção de apenas áudio). Não quero um download direto, e quero a opção de tocar
diretamente em stream pelo link."**

A v5.228 tratou a série como uma coleção do LouvorJA porque **é dali que a
casca do card veio** — e naquele mundo o toque BAIXA, o que está certo para
uma faixa de hinário: poucos MB, e o acervo existe justamente para ficar
offline. Herdar a casca herdou a premissa junto, e aqui ela é falsa por duas
ordens de grandeza: são ~300 MB por episódio, ~15 GB no ano, e o vídeo do
sábado é visto **uma vez**. O "Baixar" do card oferecia isso atrás de uma
palavra de três sílabas.

**O caminho certo já existia inteiro, e era o do YouTube.** `openSongMenu`
desvia para `openYtMenu` antes de montar qualquer coisa, e com um desvio de
uma linha o episódio ganha a **transmissão direta** no "Tocar agora"
(`ytStream` → `shared/mse.js`, sem esperar byte nenhum), o download só nos
destinos que GUARDAM, o cancelamento, o resgate de intenção e o teto de
resolução. Nada disso foi reimplementado — o item foi levado até onde a
resposta mora. No **Modo Fácil** o mesmo, e ali vale ainda mais: aquele modo
existe para não perguntar nada, e a alternativa era o operador esperar 300 MB
com o culto rodando.

A única coisa a MENOS é o seletor Vídeo × Só áudio (`semSoAudio`): um
testemunho em vídeo não tem versão de áudio que faça sentido projetar, e uma
escolha que não muda nada é pior que escolha nenhuma.

**E o card acompanhou, senão a promessa contradiria a folha:** o botão de
baixar da barra some assim que há índice (sem índice ele fica, porque ali ele
não baixa nada — busca a lista), o item de opções virou **"Atualizar a
lista"** (`syncCollection` com `soIndice`, que volta logo depois do índice) e
a série saiu de "Baixar toda a biblioteca", com peso e tudo. Um contador que
promete o que o botão não faz é a pior das duas metades.

**2. "Ele reconheceu o vídeo, mas o nomeou apenas como 'não há órfãos de
deus', sem identificar a data e nem sequer colocar um identificador no padrão
dos outros, deixando o vídeo fora de ordem."**

A sexta armadilha da nomenclatura, e ela é a mais direta de todas: **o mesmo
canal usa DUAS formas de data, no MESMO episódio.** Em 3 de janeiro de 2026 a
versão em Libras saiu como "… 2026 (03/Jan) - Libras" e a de português como
"… 2026 **sábado 3 janeiro**". `dataDoVideo` tenta a compacta e, falhando ela,
a extensa — com o "de" opcional, o ordinal ("1º") consumido, e a guarda que
exige que o nome **seja** um mês em vez de só começar como um, sem a qual
"3 marcos" viraria 3 de março.

**O que salvou o episódio foi a regra de ouro deste arquivo**: quem prova
pertencimento é a PLAYLIST, o título é só rótulo. Por isso o vídeo estava lá —
feio e fora de ordem, que é o erro recuperável — em vez de ausente, que é o
erro que o operador só descobre no sábado.

Os dois oráculos foram verificados nos dois sentidos: o `serie.test.mjs`
reprova em **7 pontos** com o `dataDoVideo` anterior, e o `boot-nativo`
reprova a folha do YouTube e o card sem botão de baixar com o `controle.js`
anterior.

A régua que fica: **herdar a casca de um recurso herda as premissas dele.** O
card veio do LouvorJA e trouxe junto "o toque baixa", que nunca foi uma
decisão sobre séries — era o padrão de um acervo cujos itens custam poucos MB.

---

## v5.229

**A v5.229: O CARD DA SÉRIE ERA CONSTRUÍDO E NUNCA DESENHADO. OTA PURO**
(nenhuma linha de Kotlin; sem Release).

Relato do operador, no dia seguinte à v5.228: *"não estou achando nada para
acessar esse provai e vede. e sim ele deve ficar no topo junto dos
hinários."*

**Ele estava certo, e o card não existia na tela.** A v5.228 acrescentou a
série ao `allCollections()` — e `allCollections()` alimenta as CONTAS (peso,
"toda a biblioteca", busca), não o desenho. A lista da Biblioteca é montada em
TRÊS grupos: as fixas (`FIXED_COLLECTIONS`), as categorias de álbuns e os
álbuns órfãos do catálogo. Uma coleção que não é `FIXED_COLLECTIONS` nem álbum
**não cai em nenhum deles**. O card era construído, entrava no `byId`, contava
no peso do acervo — e não aparecia em lugar nenhum.

**É a lição da v5.220 outra vez, num lugar novo:** *acrescentar ao lugar em
que o dado NASCE não o entrega a quem o MOSTRA.* E o que a torna cara aqui é
que **as doze asserções da v5.228 passavam com o defeito no lugar**: elas
mediam o ÍNDICE (playlists filtradas, ordem, Libras fora, URLs), e o que
faltava era o DESENHO. O oráculo novo pergunta ao DOM, não a uma função, e
reprova nos três pontos quando o grupo do topo volta a ser a lista literal.

A correção não é acrescentar um quarto grupo: é o grupo do topo passar a ser
**"as coleções FIXAS"**, que é o que ele sempre quis dizer, em vez de uma
lista digitada à mão. Com série, o cabeçalho vira "Hinários e séries"; sem
ela — num shell < 41 —, continua "Hinários", e nada muda. **(O cabeçalho único
durou até a v5.260, que separou os dois: "Hinários" e "Arquivos oficiais". O
que continua valendo desta nota é a armadilha — uma coleção fixa que não caia
em nenhum grupo desenhado some da tela sem erro nenhum.)**

**E o defeito escondia um segundo, que só apareceria depois:** o peso da
série era calculado pela escada de bitrate de ÁUDIO. A constante é o
128 kbps do LouvorJA e a média global é dominada por hinário, então uma série
ainda vazia — que é exatamente quando o número importa — seria anunciada a
~16 KB/s para um 1080p que entrega ~600. A tela prometeria **~50 MB para um
ano que pesa ~15 GB**: um erro de 40× na única pergunta que essa conta existe
para responder ("espero o Wi-Fi?"). Agora há `BPS_VIDEO_PADRAO`, e as duas
médias não se misturam nos dois sentidos — um ano de série baixado não infla
a estimativa de todo álbum de louvor, e a média de áudio não desinfla a da
série.

---

## v5.228 (APK v1.98)

**A v5.228 (v1.98): AS SÉRIES DO YOUTUBE VIRAM ÁLBUNS DA BIBLIOTECA — e o
primeiro é o "Provai e Vede 2026". EXIGE APK** (`SHELL_VERSION` **41**).

Pedido do operador: sincronizar os vídeos oficiais do Provai e Vede 2026, em
português, como um álbum da Biblioteca. A seção "Séries do YouTube" tem o
desenho inteiro; aqui ficam as três coisas que a investigação decidiu.

**O LouvorJA não tinha, e não é falta de catálogo — é estrutural.** Pelo
contrato em `docs/FONTE-DE-DADOS-LOUVORJA.md`, o banco tem cinco famílias de
arquivo e **todo campo de mídia é áudio ou imagem** (`url_music`,
`url_instrumental_music`, `url_image`): não existe campo de vídeo em lugar
nenhum. Mesmo que aparecesse um álbum com esse nome, não haveria bytes para
buscar. O portal oficial da DSA (`downloads.adventistas.org`) publica os MP4
por trimestre e foi a alternativa considerada; o operador escolheu o YouTube
— com o argumento certo, de que "playlist vira álbum" é um recurso, e o Provai
e Vede é só a primeira instância dele.

**A descoberta é automática, e ela é pela ABA DO CANAL.** A única constante é
`@provaievedeoficial`; meses e anos saem dos nomes das playlists. A alternativa
— busca por texto — foi recusada por AUTORIDADE, não por dificuldade: ali quem
escolhe o resultado é o ranking do YouTube, e qualquer pessoa pode nomear uma
playlist "Provai e Vede 2026". Num sistema de projeção de culto isso é um
reupload entrando no telão sem nada que o denuncie.

**As cinco armadilhas da nomenclatura foram MEDIDAS nos prints do canal**, não
imaginadas, e duas delas quebrariam a regra óbvia em silêncio: uma playlist
**sem o hífen** que todas as outras têm (um `^Provai e Vede - ` apagaria o mês
inteiro) e o marcador de Libras em **duas formas diferentes** — `(Libras)` na
playlist e `- Libras` no vídeo. Estão as cinco no topo do `serie.js` e as cinco
viraram caso de teste, com as strings verbatim.

**A regra mora no lado WEB, e isso é a invariante 5 com uma razão medida.** O
Kotlin ganhou dois métodos de TRANSPORTE (`ytCanalPlaylists`, `ytPlaylist`) que
devolvem o que o canal publica, verbatim — inclusive o título CRU, sem o
`tituloLimpo` da busca, porque é dele que saem a data e a marca de Libras.
A nomenclatura de um canal muda sem avisar; do lado web um ajuste chega por
OTA em minutos, com oráculo em Node, e em Kotlin custaria um degrau de shell e
uma Release por vírgula.

**Uma armadilha que quase passou:** o `pesquisar` força português no extrator
porque no padrão en-GB o YouTube devolve o título TRADUZIDO. Sem o mesmo
`aportuguesar` aqui, `(15/Ago)` viraria `(15/Aug)` e "Libras" mudaria de
palavra — a regra inteira falharia calada. Pelo mesmo motivo a paginação sai
do MESMO extrator (`ex.getPage`) e não do `getMoreItems(service, …)`, que monta
um extrator novo por dentro: os meses do fim da lista voltariam em inglês
enquanto os do começo vêm em português.

**E uma medida que evita doze extrações por retomada:** a aba do canal já diz
quantos vídeos cada playlist tem, então a assinatura `url:contagem` é guardada
e, batendo, as ~12 chamadas de `ytPlaylist` são puladas. A extração é a peça
frágil deste caminho — a que não convém exercitar à toa.

**O que NÃO foi verificado, e está dito:** o Kotlin não foi compilado (o
ambiente desta sessão não resolve o plugin do Android nem baixa dependências).
Quem compila é o CI, que falha alto. A regra — a parte que decide o que vai ao
telão — não depende disso: são 42 casos em Node puro, verificados nos dois
sentidos, mais o percurso completo no `boot-nativo.test.mjs`.

---

## v5.227

**A v5.227: O "DESLIGANDO…" VIRA O RÓTULO DO PRÓPRIO BOTÃO. OTA PURO**
(nenhuma linha de Kotlin; sem Release).

Pedido do operador: que a informação rápida de "desligando…" não fique
minúscula abaixo do botão, e sim como texto dele.

Ela saía no `#castMsg` — 0,78 rem, o MENOR texto da folha, logo abaixo do
botão que o dedo acabara de tocar, e no exato instante em que a folha inteira
está se reorganizando (v5.226). O olho estava no botão; a resposta aparecia
noutro lugar, no tamanho de uma nota de rodapé.

Agora o rótulo é uma função de `(mirrorOcupado, ligado)`, pela MESMA leitura
de estado que já pintava a cor: ocupado com o servidor no ar → "Desligando…";
ocupado sem ele → "Ligando…"; livre → o rótulo de sempre. Não há um terceiro
lugar guardando "o que eu pedi" — que é justamente o que divergiria numa
resposta lenta do shell.

Duas peças pequenas completam: `ligarEspelho`/`desligarEspelho` chamam
`renderCast()` no instante em que marcam `mirrorOcupado` (a enquete da folha é
de 2,5 s, e uma resposta que chega até 2,5 s depois do toque não é resposta),
e a opacidade do botão desabilitado subiu de .55 para .7 — **um recado a 55%
de opacidade é o defeito deste lote com outro nome**. Continua claramente
inerte; passou a ser legível.

A linha de baixo ficou com o que ela sempre soube dizer melhor: a FALHA
("só liga em Wi-Fi", "sem encoder livre agora"), que é uma frase inteira vinda
do shell e não caberia num botão.

---

## v5.226

**A v5.226: LIGAR A TRANSMISSÃO DEIXA DE SER UM SALTO — a folha cresce, e só
então o conteúdo entra. OTA PURO** (nenhuma linha de Kotlin; sem Release).

Relato do operador: *"tanto para ligar quanto para desligar a transmissão, há
adição ou subtração de conteúdo nesse popup, isso move os elementos
irregularmente… os elementos surgem do nada e as coisas mudam de lugar,
atrapalhando o foco e identificação dos elementos"*.

Ele está descrevendo um `hidden`. O endereço e a lista de telas apareciam e
sumiam num quadro, e com eles a altura da folha inteira — o que estava sob o
polegar mudava de lugar sem aviso.

**A encenação é assimétrica de propósito, e é ela que responde ao pedido:**
abrindo, a linha cresce JÁ e o conteúdo entra 0,2 s depois (o espaço nasce
antes do que vai ocupá-lo); fechando, o conteúdo sai JÁ e a folha se recolhe
0,14 s atrás dele (nada desaparece por baixo de uma borda em movimento).
Medido, quadro a quadro: abrindo, o bloco vai de 24 a 101 px enquanto a
opacidade do conteúdo é ZERO, e só aos ~250 ms — com o espaço já pronto — ele
aparece (0,46 → 1). Fechando, o espelho exato: opacidade a 0 nos primeiros
155 ms com o bloco ainda em 109 px, e o recolhimento depois.

A altura é animada por `grid-template-rows: 0fr → 1fr`, que é a única forma de
transicionar até `auto` **sem medir nada em JS** — daí a casca de dentro
(`.cast-live-in`), que precisa de `min-height: 0` e `overflow: hidden` para
aceitar encolher. `visibility` fecha o que a opacidade não fecha: recolhido, o
bloco ainda teria os botões "Desconectar" no caminho do foco.

**E a LISTA passou a ser um diff por rótulo** — sem isso nada disso valeria. Ela
era refeita por inteiro (`innerHTML = ''`) a cada leitura do estado, e o estado
é lido de 2,5 em 2,5 segundos com a folha aberta: qualquer animação de entrada
recomeçaria sozinha para sempre, e o botão "Desconectar" era recriado debaixo
do dedo de quem o estava tocando, perdendo o `disabled` que o toque acabara de
escrever. Agora uma tela nova entra com a animação, uma que saiu se recolhe
antes de deixar o documento, e as demais só têm o texto atualizado no lugar.

Os oráculos se dividem pela natureza: o `smoke.mjs` mede a FORMA (o bloco vale
zero recolhido, tem altura aberto, e o que muda entre os dois é uma
propriedade ANIMÁVEL — um `display: none` de volta continuaria dando zero e
mataria a transição, então a asserção pergunta pela propriedade também), e o
`boot-nativo.test.mjs` mede o COMPORTAMENTO da lista, que só existe com a
ponte presente.

**A primeira versão do caso do `smoke` reprovou**, e a leitura certa não era
"o teste está errado": ele media a altura no MESMO turno em que ligava a
classe, e a altura é animada — o quadro inicial é zero por definição. A espera
que ele ganhou é, ela própria, a afirmação de que a animação existe.

---

## v5.225

**A v5.225: A LEITURA DA LETRA TINHA A HIERARQUIA INVERTIDA — duas estrofes
mais juntas que o miolo de uma. OTA PURO** (nenhuma linha de Kotlin; sem
Release).

Pergunta do operador, com um print do LouvorJA: dá para aplicar aquele modelo
de estrofes na nossa leitura de letras, nos dois modos, "já que há músicas com
5 linhas, 6 linhas e diversos outros formatos"?

**A resposta é que o modelo já estava aplicado, e a contagem de linhas nunca
foi o problema.** O banco do LouvorJA não entrega linhas soltas: cada entrada
de `music_{id}.lyric` **é uma estrofe**, com `order`, o texto (linhas internas
como `<br>`) e `aux_lyric`, que é o RÓTULO da seção. Guardamos assim desde a
v5.42 (`[{a, l}]`), e os DOIS modos desenham pela mesma função (`lvBuildSong`)
— inclusive tratando um caso que a origem tem e o app dela não separa: dois
blocos de estrofe empacotados numa entrada só (v5.142). Quatro, cinco ou doze
linhas são só o número de `\n` dentro de uma estrofe; não há formato a
adivinhar.

**O que estava errado era o ESPAÇAMENTO, e ele foi medido:** 8,8 px (avançado)
e 8,0 px (simples) entre estrofes DIFERENTES, contra 11,4 px entre dois blocos
da MESMA. Duas estrofes ficavam mais juntas que o miolo de uma — a hierarquia
se lia ao contrário, e por isso a letra não respirava apesar de a estrutura
por baixo estar inteira. É o tipo de defeito que nenhuma leitura de código
acha, porque cada regra isolada parece razoável.

Agora existe `--lv-estrofe-gap` (medida de LAYOUT, logo no `:root` de
`controle.css`, não em `tokens.css`), e o valor não é gosto: **uma linha da
letra** (1.425rem = .95rem × 1.5), que é literalmente o que a fonte codifica
com `<br><br>` e o que o operador vê no app de origem. Ele vale nos TRÊS
lugares em que uma estrofe termina — o `gap` da folha de leitura, o `gap` da
zona de letra do Modo Fácil e o `margin-top` entre blocos dentro de um slide —
porque **uma fronteira de estrofe é uma fronteira de estrofe**: tem de parecer
igual nos três, senão a leitura ganha um ritmo que o texto não tem.

**O oráculo afirma a REGRA, não o pixel** (`tools/smoke.mjs`): entre estrofes
nunca menos que dentro de uma, nunca menos que uma linha, e o mesmo valor nos
dois modos. Escrever o número faria o teste reprovar numa mudança legítima de
fonte; escrever a razão o mantém verdadeiro. Reprova em 5 pontos no CSS
anterior (verificado).

A régua que fica: **estrutura correta não é leitura correta.** Os dados
estavam certos desde a v5.42 e a função desenhava certo desde então — o que
desmentia os dois era um par de medidas que ninguém tinha comparado uma com a
outra.

---

## v5.224

**A v5.224: A TRANSMISSÃO VIRA O BOTÃO IRMÃO DO DE ESPELHAR — o interruptor
sai. OTA PURO** (nenhuma linha de Kotlin; sem Release).

Pedido do operador: que a segunda forma de conectar tenha o mesmo desenho da
primeira, e que ligada ela fique **vermelha, nomeando o desligamento** — a
mesma função de liga-desliga, sem trilho de chave.

**As duas escolhas da folha respondem à MESMA pergunta** ("para onde vai o
telão?"), e respondê-la metade com um botão preenchido e metade com um
interruptor fazia a segunda parecer uma preferência de configuração em vez de
uma porta. Agora são dois `.cast-acao` — mesma anatomia, mesmo alvo de toque,
mesmo lugar do ícone —, e o botão novo ganhou símbolo próprio (`icoNavegador`:
a janela de navegador com as ondas dentro; a moldura é literalmente a palavra
do rótulo, e o irmão já tinha a tela com a seta).

**O que o interruptor dava de graça — dizer o estado parado — o botão diz pela
COR e pelo RÓTULO**, que é a gramática que o irmão já usava: desligado ele é a
chamada preenchida ("Transmitir para navegador"); ligado, perde o
preenchimento, ganha o contorno e passa a nomear a ação ("Desligar
transmissão"). Verde é "resolvido, e o app não mexe nisso" (a TV, que só o
seletor do Android desconecta); vermelho é "está ligado, e o toque desliga".

**O vermelho é CONTORNADO, e isso não é timidez:** pela regra da paleta o
vermelho CHEIO deste app significa "está no ar agora" e pertence à mídia
projetada. Um botão de folha preenchido em `--live` competiria com o que a
congregação está vendo.

A mecânica mudou num ponto só, e ele merece nota: um `change` de caixa de
marcação chega com a posição NOVA, um clique não chega com nada. O que o
operador pediu passou a ser DERIVADO do estado (`!espelhoLigado()`) — a mesma
fonte que o `renderCast` usa para pintar o botão —, então não há duas versões
da verdade para divergirem no meio de uma resposta lenta do shell. O resto da
disciplina é intacto: **quem escreve o estado é sempre a LEITURA**, nunca o
toque, senão uma recusa deixaria o botão vermelho de uma coisa que não
aconteceu.

Dois oráculos, e eles se dividem pela natureza: o `smoke.mjs` mede a FORMA
(desligados os dois são a mesma peça — mesmo raio, mesmo preenchimento; ligada
a transmissão perde o fundo e ganha o contorno em `--danger-strong`), e o
`boot-nativo.test.mjs` mede o ESTADO, que é o único lugar onde ele pode ser
medido de verdade: lá a ponte responde `ligado: true` e quem pinta o botão é o
`renderCast`, não uma classe posta à mão pelo teste. Ele afirma também que
**não sobrou interruptor nenhum** na folha.

---

## v5.223

**A v5.223: O `display-ready` DA TELA NUNCA LEVOU `__tela` — e sem ele as TRÊS
preferências jamais chegaram. OTA PURO** (nenhuma linha de Kotlin; sem
Release).

Relato: numa tela recém-ativada os slides ficam pretos **mesmo com a opção de
imagens ligada**, e agora "nem depois da música tocar completa" — isto é, não
era espera. A v5.221 tinha atacado o sintoma pelo lado errado.

**A causa é um campo que nunca foi escrito.** O Controle decide reenviar
wallpaper, fundo da letra e preenchimento a quem conecta perguntando
`if (msg.__tela)` no `display-ready` — é a única coisa que distingue uma TELA
DA REDE do telão de verdade, que lê tudo do IndexedDB sozinho. O `tela.js`
anexa `__tela` ao `tela-status`… e **nunca anexou ao `display-ready`**. Medido
no fio: `{"type":"display-ready","__de":"dsf1cu9p7","__mid":"70y95c:1"}`.

Ou seja: `telaReenviarPreferencias` — a função que a **v5.188 criou para
exatamente isto** — nunca rodou para uma tela de verdade, em nenhuma versão.
Não havia erro em lugar nenhum; havia três preferências que simplesmente não
existiam do outro lado. O fundo da letra foi o que apareceu porque preto é
visível; o **wallpaper** e o **preenchimento** estavam quebrados do mesmo
jeito, calados, porque o padrão deles é aceitável e ninguém reparou.

**E o conserto teve duas tentativas, o que é a outra metade da lição.** A
primeira carimbou o `__tela` no dreno — e não mudou nada, porque há DOIS
pontos que anunciam a tela e o que de fato entrega é o outro: o
`display-ready` do `display.js` nasce na carga da página, quando ainda não há
token, e o `subir` devolve cedo; quem anuncia é o `aoConectar`, no reanúncio.
**Uma correção aplicada no ponto que não é exercitado é uma correção que nunca
roda** — e ela teria passado num teste que olhasse só o dreno. O carimbo
passou a ter dono único (`anuncio()`), usado pelos dois pontos.

**Os dois lados do contrato ficaram travados, e isso é deliberado.** O
`tela-rede.test.mjs` afirma que o `display-ready` no fio LEVA `__tela` (o
produtor — reprova no código anterior, verificado); o `boot-nativo.test.mjs`
afirma que o Controle reenvia ao receber o campo **e que não reenvia sem ele**
(o consumidor — passa nas duas versões, porque o consumidor sempre esteve
certo). Travar um lado só deixaria o par livre para divergir de novo, que é
precisamente o que aconteceu por dezenas de versões: **o consumidor exigia um
campo que o produtor não mandava, e a documentação descrevia o combinado em
vez do código** — o CLAUDE.md dizia, com todas as letras, "`display-ready`
passa, com `__tela`".

A régua: **quando dois lados combinam um campo, o oráculo tem de olhar o FIO.**
Ler cada lado separadamente aprova os dois — foi o que fiz aqui na primeira
passada, com um probe que mandava o `__tela` à mão e concluía que o Controle
estava certo. Estava; a mensagem é que nunca teve o campo.

---

## v5.222

**A v5.222: O NÚMERO DO HINO ERA AZUL — 9,75:1 e ainda assim discreto. OTA
PURO** (nenhuma linha de Kotlin; sem Release).

Relato do operador, sobre a capa que a v5.219 desenhou: *"o número do hino
está aparecendo em azul no slide, esse azul fica muito discreto no fundo
escuro"*.

**Ele está certo, e a medida não o contradiz — ela responde outra pergunta.**
`--stage-accent` sobre o preto dá 9,75:1, contraste de sobra em qualquer
régua; o oráculo da v5.219 mediu isso e aprovou. Só que **contraste é razão de
luminância, não legibilidade a dez metros**: num telão o que decide é o
conjunto **cor + corpo**, e aquele número tinha o MENOR corpo do cartão
(4,4cqmin contra os 8,4 do título) somado à única cor da tela que não era
branca. Num hinário o número é o que a congregação procura primeiro — ele não
é enfeite, e estava desenhado como se fosse.

Agora ele é o MESMO branco do título (21:1) e maior (5,8cqmin). A cor de
identidade ficou nos FIOS que o flanqueiam, que é onde ela não precisa ser
lida: eles são decoração, e por isso o `background` deles passou a ser
explícito em vez de `currentColor` — sem essa troca, embranquecer o número
teria embranquecido os fios junto, calados.

**O oráculo subiu de piso junto** (`display-smoke.mjs`): ele exigia 7:1 do
número, que é exatamente o que o azul entregava. Agora exige 15:1 **e** que a
cor seja a mesma do título — uma cor de identidade que volte para cá reprova.

A régua que fica: **um piso de contraste aprova o que ele mede, e ele não mede
corpo.** Onde o consumidor é um projetor visto do fundo do salão, a asserção
tem de amarrar as duas coisas.

---

## v5.221

**A v5.221: A IMAGEM DE FUNDO DA LETRA DESISTIA ANTES DE PODER CHEGAR. OTA
PURO** (nenhuma linha de Kotlin; sem Release).

**CORREÇÃO DE ATRIBUIÇÃO, escrita pela v5.223:** o defeito descrito abaixo é
REAL e a correção fica — mas ele **não era a causa** do relato do operador,
e esta nota afirmou que era. A causa estava uma etapa antes: o `lyricsbg`
nunca chegava à tela, porque o `display-ready` dela não levava `__tela`
(v5.222). Com o modo em `black`, `applyLyricsImage` computa `key = null` e
**não chega a buscar imagem nenhuma** — a ladeira curta descrita aqui nunca
chegou a rodar. Por isso a v5.221 não mudou nada no aparelho, e por isso
ela passa a valer só agora, quando a preferência de fato chega.

Relato: numa tela recém-ativada, tocar uma música da biblioteca deixa os
slides em PRETO, **mesmo com a opção de imagens ligada** — e desligar e religar
a opção nas Configurações conserta.

**A preferência não era o problema**, e essa era a pista falsa embutida no
sintoma: `telaReenviarPreferencias` manda o `lyricsbg` no `display-ready` da
tela e ele chega certo. O problema são os BYTES.

As imagens de fundo são enfileiradas **DEPOIS da mídia principal**
(`telaEmpurrarImagensLetra`, logo após `telaGarantirEnvio`), no MESMO canal
serializado — de propósito, e a decisão continua certa: o som não pode esperar
as fotos. Só que a tela buscava a imagem com uma ladeira de **0, 600 e
1800 ms**, desistindo em ~2,4 s. Por construção, os bytes só podem começar a
chegar depois de a música inteira atravessar o canal — segundos para um hino.
**A tela desistia antes de existir qualquer possibilidade de sucesso**, e o
slide ficava preto PARA SEMPRE, porque nada reexamina uma estrofe já
renderizada. Religar a opção troca a chave efetiva e refaz o caminho com os
bytes já no lugar: era esse o conserto que o operador vinha fazendo a cada
música.

Medido, com os bytes chegando aos 4 s: aos 2 s sem `src` (esperado), **aos 6 s
ainda sem `src`** — dois segundos depois de a imagem estar disponível —, e
visível logo após o desliga/religa. Os três estados do relato, reproduzidos.

A ladeira agora dobra até um platô de 2,5 s com teto de 45 s, e é
auto-limitada pelo que já existia: **a guarda de sequência mata o laço no
instante em que a estrofe muda**, que é o caso comum muito antes do teto.
Repetir a mesma URL é seguro porque o servidor manda `Cache-Control: no-store`
em TODA resposta (`EspelhoHttp.CABECALHOS_SEMPRE`), 404 inclusive — não há 404
grudado em cache para envenenar a tentativa boa.

**O oráculo mede o que faltava.** O `tela-rede` já afirmava que o `imageUrl`
sobrevive ao `__rec`; ninguém nunca afirmou que a imagem **chega à tela**, e
era exatamente nessa distância que o defeito vivia. Agora a rota `/m/` da
imagem 404a por 3 s de propósito — mais que a janela antiga — e o teste exige
que ela apareça assim mesmo. Reprova no código anterior (verificado).

A régua que fica: **uma retentativa tem de durar mais que o processo que ela
está esperando.** Aqui o processo era conhecido e estava escrito duas funções
acima — a fila é serializada e a imagem vem depois da música —, e ainda assim
o prazo foi escolhido como se a imagem pudesse chegar sozinha.

---

## v5.220

**A v5.220: A LINHA DO ÁLBUM NÃO CHEGAVA À BIBLIOTECA QUE JÁ EXISTE — os
dois pontos de escrita estavam certos e os dois erravam o alvo. OTA PURO**
(nenhuma linha de Kotlin; sem Release).

Relato do operador: tocando um hino do hinário, a capa não mostra "Hinário
Adventista 2022" — nem o nome de coleção nenhuma.

**O dado nunca chegaria sozinho.** A v5.219 escreve `hymnAlbum` em dois
lugares: no download de uma música nova e na varredura da sincronização. Os
dois são o lugar certo para uma biblioteca que está sendo MONTADA — e nenhum
deles alcança a que já está pronta: a música do operador já está baixada, e
uma coleção completa não é re-sincronizada (é justamente o que o "Completo
offline" existe para dizer). O campo ficava vazio para sempre, e a capa caía
no caso degenerado, que é o título centralizado.

A correção é a passagem que faltava (`preencherAlbunsDosHinos`), no mesmo
molde do `desnumerarAlbunsBaixados` que já morava ao lado: uma vez, marcada em
estado, depois de `loadCollections()` — é de lá que sai o nome. **A ligação já
existia e não estava sendo lida**: o `folder` de todo registro baixado de uma
coleção É o id dela. Ela CORRIGE além de preencher (compara com o nome atual
em vez de olhar só se está vazio), porque uma coleção renomeada na origem
deixaria capas dizendo o nome velho pelo mesmo preço.

O oráculo entrou no `acervo.test.mjs`, que é onde as contas da biblioteca já
moram, e ele mede **o registro** — que é o que o Display vai ler —, não o
retorno da função: a música já baixada ganha o nome, um nome velho é
substituído, e um arquivo de pasta do aparelho (que não é coleção nenhuma)
fica intocado.

A régua que fica: **escrever um campo novo nos caminhos de ESCRITA não o
entrega a quem já tem os dados** — um lote que acrescenta campo a registro
precisa dizer, explicitamente, como ele chega ao acervo existente.

---

## v5.219

**A v5.219: O TÍTULO DO LOUVOR ERA AZUL-ESCURO SOBRE O PRETO — o palco lia
tokens de TEMA. E o slide de capa virou um CARTÃO. OTA PURO** (nenhuma linha
de Kotlin; sem Release).

Relato do operador: os títulos das músicas estão em azul e ficam ilegíveis no
fundo escuro.

**Medido: 2,73:1.** O slide de capa pintava o título com `--brand`, e
`--brand` é um token de TEMA — `#8fb1f3` no escuro (9,75:1 sobre o preto, o
que a TV mostrava) e o denim oficial `#2F557F` no CLARO. A preview do Controle
roda no documento que TEM tema: com o tema claro ligado — que é o que o
operador escolheu na v5.192 — ela desenhava o título em denim escuro sobre o
preto do palco, abaixo até do piso de 3:1 de texto grande.

**É a regra do palco cometida do lado de fora.** Este documento diz, desde a
v5.192, que "o palco não tem tema"; e diz isso dos TOKENS. Os tokens estavam
certos — as REGRAS é que apontavam para tokens de tema, em quatro pontos:
`--brand` (título da capa, referência do versículo, número do sorteio
rolando), `--live-strong` (o cronômetro estourado), `--bg` e `--accent-glow`
(a pílula de entrada). Agora existem `--stage-accent`, `--stage-accent-glow`,
`--stage-on-accent` e `--stage-alert` no bloco compartilhado, e **nada pintado
no palco lê um token redeclarado em `[data-tema]`**.

**O oráculo mudou de pergunta, e é por isso que ele não tinha visto.** O
`smoke.mjs` comparava quatro NOMES de token entre os dois temas; o defeito
passou por baixo porque os nomes estavam certos. Ele passou a comparar a COR
COMPUTADA de cada camada do palco (capa, letra, versículo, cronômetro
estourado, sorteio rolando, fundo) nos dois temas. Verificado nos dois
sentidos: com a regra antiga de volta, ele reprova.

**E o cartão de capa** (o segundo pedido). Era uma linha só — "147. Ó ADORAI O
SENHOR" —, o número colado na frente do título, gastando a largura da linha
que mais precisa dela. Agora são três peças com pesos diferentes: o número no
acento entre dois fios, o TÍTULO em branco pleno (21:1 — num telão a
legibilidade vem de luminância máxima, e o acento fica no que é secundário) e
o ÁLBUM esmaecido embaixo. Cada peça só existe se houver o dado; sem número e
sem álbum, a capa é o título centralizado, que é a capa de sempre.

**Não há AUTOR na fonte, e isso está dito em vez de inventado**: o LouvorJA
publica nome, faixa e álbuns (`docs/FONTE-DE-DADOS-LOUVORJA.md` §5.1). O que
entrou é `hymnAlbum` — a coleção de onde a música veio —, no REGISTRO, porque
quem projeta é o Display e ele não tem acesso a coleção nenhuma; e com
preenchimento na varredura que a sincronização já faz, senão a linha só
apareceria em música baixada depois desta versão, isto é, nunca na biblioteca
que o operador já tem.

**A caixa da capa CRESCE com o conteúdo, e foi um defeito fotografado que
obrigou a isso**: com o título em duas linhas, número + título + álbum somavam
mais que a caixa de altura fixa, o flex encolhia os itens e o álbum era
desenhado POR CIMA da segunda linha do título. Na capa não há "próximo slide"
com que casar a altura — é a primeira coisa em cena —, então ela se ajusta,
com teto e `overflow: hidden` como garantia final.

**A primeira medição de contraste do repositório entrou junto**
(`display-smoke.mjs`): este documento afirmava, desde a v5.47, que não havia
nenhuma. Ela cabe no palco e só nele — ali o piso não é "tela a 30 cm", é um
projetor visto do fundo do salão — e compõe o ALFA sobre o preto em vez de
ignorá-lo, senão `--stage-text-dim` (branco a 72%) sairia como 21:1 quando
rende 10,54:1.

A régua que fica: **um oráculo que compara NOMES não protege o que a tela
PINTA.**

---

## v5.218

**A v5.218: A RECARGA VOLTA PARA A ENTRADA OFICIAL, e o botão de canto sai.
OTA PURO** (nenhuma linha de Kotlin; sem Release).

Decisão do operador depois da v5.216, e ela **revoga metade de uma regra da
v5.189**: *"após qualquer descarregamento da página, pode usar o botão
original de ativar tela, o mesmo que já se usa no primeiro acesso. Inclusive,
remova esse botão específico que desaparece em 5 segundos. Faça apenas a
lógica de aceitar o F11 como atalho, ou os dois cliques na tela."*

**A regra da v5.189 estava certa para o caso dela e errada para este, e a
distinção é entre perder o FIO e perder a PÁGINA.** Numa queda de conexão a
mídia continua tocando — ela é local (`/m/`) e a letra anda pelo `timeupdate`
do próprio `<video>` —, então desenhar a entrada por cima apagaria uma cena
que o problema não tinha atingido; isso **não mudou**, e `cairToken`/
`reentrarSozinho` seguem silenciosos. Uma recarga é outra coisa: ela já
derrubou tudo, inclusive o gesto, porque ativação transitória não sobrevive a
uma navegação. A tela volta muda e em janela de qualquer jeito. **Não havendo
projeção a preservar, não há nada que a entrada esteja cobrindo** — e o que
estava lá no lugar dela era um botão de canto com outro nome ("Ativar som e
tela cheia"), outro desenho e cinco segundos de vida.

**O que saiu:** `mostrarCanto`, `esconderCanto`, os três prazos, `oQueFalta`,
`oferecerGesto`, `emTelaCheia` e o `assentando` da v5.214 — este último era
apenas o guarda daquela pergunta, e some junto com ela. A regra que ele
protegia continua escrita, agora como comentário no `telaCheia`: **não se lê
`document.fullscreenElement` no mesmo turno em que se pede a tela cheia.**

**O que ficou:** os dois gestos que já existem na cabeça de quem está ali — o
TOQUE DUPLO (o que se tenta primeiro num vídeo) e o **F11** (o de quem opera
num computador ligado ao projetor, que é o caso normal deste recurso). O
`preventDefault` no F11 é deliberado: sem ele o navegador entra na tela cheia
DELE ao mesmo tempo em que pedimos a da API, e sair passaria a exigir dois
comandos. Um dono só para o estado.

**O token é carregado adiante na recarga, e isso não é uma exceção à decisão:**
o fio só abre quando alguém toca. O que ele evita é um defeito que a mudança
criaria — `telasSse` é indexado pelo TOKEN (`EspelhoServidor`), então pedir
pareamento novo a cada F5 deixaria a sessão anterior ocupando vaga até o vigia
notá-la, e a **terceira recarga seguida receberia "lotado"**. Com o token
reaproveitado o servidor reconhece a volta ("a mesma tela reabriu a página") e
a vaga é a mesma. Há oráculo para as duas metades.

**E um falso positivo do próprio teste virou lição.** A asserção "não
reconecta sozinha" lia o contador GLOBAL de `GET /e` do servidor de mentira, e
reprovou culpando a página recarregada por um pedido que era de outra (a
principal, na escada de reentrada legítima do `adeus`). Um contador global não
prova uma afirmação sobre UMA página: agora cada contexto manda um cabeçalho
que o identifica, e a contagem é por página. **Medição que não é atribuível
não é medição.**

**E ele reprovou uma SEGUNDA vez, no CI, por uma corrida que a máquina local
escondia** — com o arranjo de dois passos da v5.213 mostrando serviço:
`11/12`, e o reprovado nomeado no resumo do run em vez de sumir atrás de um
painel verde. A asserção do token esperava **o overlay sumir** para então
recarregar, e `ativar()` esconde o overlay ANTES de o pareamento voltar (o
gesto não espera a rede) — quem grava o token é a resposta do `POST /par`. Num
runner mais lento a recarga chegava antes do `guardar()`, o token não existia,
e o teste acusava o app de pedir vaga nova. Reproduzido de propósito com 400 ms
de atraso no servidor de mentira e corrigido esperando o `GET /e`, que só
acontece DEPOIS do `guardar()`. É a segunda vez que este arquivo aprende isto
(a v5.204 foi a primeira): **espere o sinal que prova o que você precisa
afirmar, não um que costuma vir junto.**

---

## v5.217

**A v5.217: O BOTÃO DE CAST NÃO ABRIA NADA COM UMA TELA JÁ CONECTADA — o
fecho automático da folha era um NÍVEL onde a frase dizia BORDA. OTA PURO**
(nenhuma linha de Kotlin; sem Release).

Relato do operador: com o ícone de cast no estado conectado (vermelho), tocar
nele não abre a folha de conexão.

**Ele abria — e se fechava sozinha em milissegundos.** A v5.193 acrescentou ao
`renderSimpleGate` a regra "alguma tela ENTROU com a folha aberta: ela fecha",
e escreveu `if (há tela && a folha está aberta) fecharCast()`. A frase fala de
um EVENTO; o código testa um ESTADO. Com uma tela conectada — que é o estado
normal de um culto — qualquer passagem por aquela função fechava a folha, e o
`abrirCast` **liga a enquete de 2,5 s**, que chama justamente aquela função.
Isto é: o próprio ato de abrir agendava o fecho, e a primeira leitura do
estado (milissegundos depois, pela ponte) o executava.

O que se perdia com isso não era um detalhe de UI: aquela folha é a única
porta para trocar de TV, ligar e desligar a transmissão e derrubar uma tela da
rede. Com tela conectada, nenhuma dessas coisas tinha como ser feita sem antes
desconectar tudo.

A correção é a borda que a frase sempre descreveu (`gateTinhaTela`), **com a
memória re-armada em `abrirCast`** — e é esse re-armar que dá à regra o
significado certo: *enquanto ESTA folha estiver aberta, se uma tela entrar,
ela fecha*. Sem ele, uma folha aberta muito depois herdaria uma borda de horas
atrás, que é a mesma classe de defeito com outro relógio.

**Os dois lados entraram no `boot-nativo.test.mjs` no mesmo commit**, e o
segundo é o que impede a correção de virar "a folha nunca mais fecha sozinha":
com tela conectada ela ABRE e CONTINUA aberta depois de um ciclo inteiro da
enquete; com a folha aberta e uma tela entrando, ela fecha. A primeira metade
é lida no MESMO turno do clique — entre dois `evaluate` cabe o `setTimeout(0)`
com que a ponte de mentira resolve o `espelhoEstado`, e a asserção passaria a
depender de quem ganha essa corrida.

A régua que fica: **"entrou" e "existe" não são a mesma condição, e um
comentário que diz a primeira sobre um código que testa a segunda envelhece
parecendo correto** — foi assim que este atravessou vinte e três versões.

---

## v5.216

**A v5.216: O "LIGAR SISTEMA" VOLTAVA NA RECARGA — e ele gasta o gesto sem
ativar nada. OTA PURO** (nenhuma linha de Kotlin; sem Release).

Segunda metade do relato da v5.214, e desta vez com o passo que faltava:
*"o erro acontece quando o display é recarregado, mostrando um botão antigo de
ativar tela. A tela se conecta, mas o som e nem o fullscreen é ativado."*

**O botão antigo tem nome: é o `#startBtn`, o "Ligar Sistema"** — o overlay da
era dos dois PWAs, que existe para destravar o autoplay num navegador comum.
Ele era escondido no papel `tela` por uma linha dentro de `montarEntrada()`, e
aí está o buraco: **`montarEntrada()` só roda na PRIMEIRA carga.** A recarga
com sessão viva reconecta POR TRÁS, de propósito (v5.189: cobrir a projeção
com um cartaz por causa de um F5 seria trocar um problema por outro) — e sai
pelo `return` antes de qualquer overlay ser montado. Bastava um F5.

Medido, depois de recarregar: `startVisivel: true`, e
`elementFromPoint` no CENTRO da tela devolvendo `start-pill`. O botão certo
("Ativar som e tela cheia") estava lá, em cima na ordem de pilha — mas é
discreto e de canto, enquanto este é `inset: 0` com a pílula no meio. O
visitante toca no óbvio; e tocar nele dá, medido, `tela cheia = false` e
`som pedido = false`: **ele não pareia, não solta o som e não pede tela cheia
— só se esconde.** O único gesto disponível é gasto em nada, e a tela fica
conectada, muda e em janela. Palavra por palavra, o relato.

**A correção muda o DONO, não só a linha.** Quem esconde o botão passa a ser o
`display.js` — o documento que o declara —, pelo PAPEL e em toda carga, ao
lado da decisão gêmea que já existia ali (`window.__NATIVE__`). No papel
`tela` ele não existe pela razão oposta à do app nativo: lá não há política de
gesto para destravar; aqui há, mas o gesto é do OUTRO botão. Decidir isso de
fora, no `tela.js`, é que abria a porta para um caminho de carga esquecer a
decisão — e foi exatamente o que aconteceu.

**O oráculo cobre o caminho que nenhum teste percorria: a RECARGA.** O
`tela-rede.test.mjs` ativava a tela e seguia em frente; ninguém dava F5. As
duas asserções novas reprovam no código anterior (verificado) e uma delas mede
**o que o dedo encontra** — `elementFromPoint` no centro —, não a propriedade
`hidden`: é o centro da tela que decide para onde vai o toque, e era ali que o
botão errado estava.

A régua que fica: **um elemento que só faz sentido em UM papel tem de ser
desligado por quem o declara, no papel — nunca por um caminho de UI que pode
não ser percorrido.**

---

## v5.215

**A v5.215: SEM TELA CONECTADA, O SOM SAI DO PRÓPRIO APARELHO. OTA PURO**
(nenhuma linha de Kotlin, `SHELL_VERSION` intacto em 40; sem Release).

Pedido do operador: no modo avançado, tocar uma mídia sem nenhuma tela
conectada tem de produzir som no celular. Ele fecha um buraco que a v5.189
abriu e que este documento descrevia sem perceber — o argumento de lá ("a
preview é uma ILUSTRAÇÃO, e ilustração não faz som") vale enquanto existe
alguém ilustrando alguma coisa. **Sem display nenhum a projeção É a preview em
tela cheia**, e ali ela não ilustra: ela É a projeção. O louvor simplesmente
não tocava em lugar nenhum.

**A diferença para a "mesa de som" é a única coisa que importa neste lote, e
ela é estrutural: não é um modo, é uma CONSEQUÊNCIA.** Não há botão, não há
preferência, não há nada guardado entre sessões — o estado é uma função da
conexão (`somLocalDeveEstar`), aplicada num ponto só
(`acertarSaidaDeAudio` → `preview.setForceMuted`), com os gatilhos onde a
conexão muda: telas (`renderDisplayStatus`), transmissão (`lerEspelho`), modo
do app (`setAppMode`) e a janela do Display no navegador. É isso que torna
impossível o desfecho que matou a versão manual — o operador esquece a mesa
ligada, conecta a TV, e o `<video>` do Controle rouba o foco de áudio do
Android **interrompendo o player do telão na frente da congregação**. Com
qualquer tela conectada este aparelho está mudo, sempre.

**TELA é a pergunta larga** (`simpleDisplay`, a mesma do Modo Fácil): a TV
**ou** uma tela da rede recebendo. Desde a v5.187 elas são a projeção quando
não há TV e cada uma toca o próprio arquivo — contá-las é o que impede o
celular de somar o mesmo louvor à sala fora de compasso, porque são dois
decodificadores. `telaoConectado()` continua respondendo só pela TV, que é a
pergunta certa para o atraso da preview e para o botão de espelhar.

**Só no modo avançado**, como pedido — e a razão sobrevive à leitura: no Modo
Fácil sem tela a cortina cobre tudo (v5.203), e som atrás de uma tela que diz
"conecte uma tela" seria a única coisa acontecendo ali. A troca entre os dois
mundos é automática nos dois sentidos e não corta o áudio: a rampa curta do
`setForceMuted` desce até 0 antes de mutar, e uma TV que conecta no meio do
louvor assume pelo reenvio de cena com posição e estado que a reconexão já faz.

**A rede de segurança do navegador está dita em vez de suposta:** num
navegador comum a política de autoplay rejeita o `play()` com som sem ativação
do usuário, e o `stage` engole a rejeição — sem tratamento, o preço de ligar o
som seria a preview PARAR DE TOCAR, que é trocar uma ilustração muda por
nenhuma ilustração. O `onBlocked` a devolve ao mudo na hora e cada `load` novo
ganha outra tentativa. No app isso não acontece
(`mediaPlaybackRequiresUserGesture = false`).

**O que NÃO voltou, e é deliberado:** o `AVNative.keepAudioAlive` (shell), que
a versão manual usava para o WebView do Controle atravessar o segundo plano.
Áudio audível já isenta a página do estrangulamento — é o que a nota do
`snoopDisplayStatus` descreve pelo avesso ("ligar o áudio no próprio celular
fazia o defeito sumir") — e o `SessionService` mantém o processo vivo enquanto
houver cena. Repô-lo custaria um degrau de `SHELL_VERSION` e uma Release por
um problema que ainda não foi observado; o endereço da resposta ficou escrito
em `docs/ARQUITETURA-WEB.md`, para o dia em que for.

Dois oráculos travam a regra, e o primeiro é o único que podia: o
`boot-nativo.test.mjs` é o que sobe a base COM a ponte, isto é, o único lugar
em que existe conexão a medir — sem tela a preview deixa de ser muda, no Modo
Fácil volta a ser, e com uma tela da rede recebendo ela fica muda mesmo no
avançado. O `destinos.test.mjs` continua travando a REMOÇÃO (nenhum botão,
nenhum `setStandalone`) e agora afirma também que o estado é derivado.

---

## v5.214

**A v5.214: A ATIVAÇÃO DA TELA DA REDE JÁ ERA UNIFICADA — o que sobrava era um
segundo botão pedindo o que o primeiro tinha acabado de fazer. OTA PURO**
(nenhuma linha de Kotlin; sem Release).

Relato do operador: o "Ativar esta tela" não estaria ativando som e tela cheia
junto com o display, e exigiria uma segunda interação para isso.

**Medido antes de mexer, e o diagnóstico natural estava errado.** Um toque só,
num Chromium de verdade contra o servidor de mentira do `tela-rede`: tela cheia
`true`, overlay fora, `__telaSom(true)` chamado. **As três coisas aconteciam no
primeiro toque** — o gesto sempre foi um só. O que aparecia era um botão de
canto, opaco, escrito "Voltar à tela cheia", que **nunca saía de cena**. Do
lado de quem opera isso é indistinguível de "a ativação não funcionou", e é
exatamente assim que foi relatado.

São dois defeitos, e eles se compõem — nenhum dos dois produz sintoma sozinho:

- **A pergunta era feita DENTRO do gesto.** `oferecerGesto()` roda no ouvinte
  de clique do `document`, e o clique que gasta o gesto borbulha até lá **antes
  de a tela cheia existir**: `requestFullscreen()` é assíncrono. A linha do
  tempo instrumentada mostra o ouvinte rodando com `fullscreenElement=false` e
  o `fullscreenchange` chegando 9 ms depois. Isto é: a única pergunta que esse
  botão existe para responder era feita no único instante em que a resposta é
  garantidamente falsa. Agora quem responde é o próprio pedido — a Promise
  resolve se entrou, rejeita se foi recusada — e entre uma coisa e outra
  `oferecerGesto()` é mudo (`assentando`).
- **E o botão não sabia sair.** `mostrarCanto` agenda a opacidade um quadro
  adiante e o recolhimento em 5 s; `esconderCanto`, chamado no meio disso pelo
  `fullscreenchange`, matava o de 5 s e agendava a saída — e então o quadro
  órfão repunha `opacity: 1`. A saída conferia `opacity === '0'`, encontrava
  `'1'` e desistia. **Opaco, por cima da projeção, sem nenhum prazo vivo para
  recolhê-lo.** Os três prazos passaram a ser cancelados em bloco, que é a
  única regra que um par mostrar/esconder pode ter: o último a ser chamado
  vale.

**O oráculo entrou no mesmo commit** (`tools/tela-rede.test.mjs`, a regra da
v5.145), e a asserção é deliberadamente independente de o navegador CONCEDER
tela cheia — exigir a concessão viraria vermelho num runner que a negue, e
vermelho ambiental é o que ensina a ignorar vermelho (a lição da v5.204). O que
ela afirma vale nos dois ambientes: **nenhum botão pode estar na tela
oferecendo uma coisa que já está feita.** O caminho de VOLTA é travado logo
abaixo — sem ele, apagar o botão de canto passaria no teste de cima e tiraria a
única saída de quem esbarra na tecla errada do controle remoto; e quando o
ambiente não concede tela cheia, o caso não é exercitado e isso é **dito**, não
silenciado (a lição da v5.213).

A régua que fica, e ela é mais larga que este arquivo: **estado que uma API
assíncrona vai escrever não pode ser lido no mesmo turno em que ela é
chamada** — e um par mostrar/esconder com prazos só é honesto se cancelar
todos os seus.

---

## v5.213

**A v5.213: OS ORÁCULOS DE CHROMIUM VIRAM DOIS PASSOS — o painel verde
escondia um teste caindo. OTA PURO** (o único arquivo tocado fora da base é o
workflow; nenhuma linha de Kotlin, sem Release).

Pedido do operador depois da v5.212, sobre uma observação que a auditoria
deixou em aberto. Os doze oráculos de Chromium rodavam num passo só, com
`set -euo pipefail` — então o PRIMEIRO que reprovasse abortava os ONZE
seguintes. Somado ao `continue-on-error` do passo, o desfecho era: **um teste
caiu, os outros nunca rodaram, e o run está verde.** Saber disso exigia abrir
o log e reparar em qual linha ele tinha parado — foi exatamente o que precisei
fazer para conferir a v5.212.

**A separação não é organização, é o que dá sentido ao `continue-on-error`.**
A justificativa dele sempre foi INFRAESTRUTURA (download do Chromium, runner
sem rede), e infraestrutura passou a ser o primeiro passo, sozinho
(`Preparar o Chromium`). O segundo (`Oráculos em Chromium`) ficou com uma
causa só de falhar — defeito de verdade —, roda os doze SEMPRE, emite
`::error::` por reprovado e escreve o placar no **resumo do run**. O `if:
steps.chromium.outcome == 'success'` existe para o caso de o Chromium não
instalar: doze `::error::` de infraestrutura seriam precisamente o ruído que
ensina a ignorar vermelho.

**O que NÃO mudou, e é dito para não parecer esquecimento:** o segundo passo
segue com `continue-on-error`. Barrar o canal OTA por um teste de navegador
continua sendo trocar um risco raro por um bloqueio frequente, e essa é a
política do projeto, não minha. O que mudou é que agora ela é uma linha só — e
a razão que a sustentava mudou de endereço.

Duas medidas pequenas, pela regra de sempre: o placar é `N/12` com o `N`
**contado**, nunca digitado (um número fixo envelheceria no primeiro oráculo
novo, e envelheceria mentindo), e a lógica do passo foi exercitada nos dois
sentidos antes de subir — com dois reprovados no meio, os outros dez rodam,
o resumo os nomeia e o passo sai com 1; com tudo passando, sai com 0.

---

## v5.212 (APK v1.97)

**A v5.212 (v1.97): O EMBED DO YOUTUBE SAI DOS DOIS WEBVIEWS, e com ele uma
ponte privilegiada exposta a terceiro. Mais duas correções de uma auditoria
do repositório inteiro. EXIGE APK.**

- **`POST /r` INJETAVA COMANDO ARBITRÁRIO NO BARRAMENTO.** O ramo `st` do
  canal de volta conferia que `type` não era vazio e mais nada, e então
  chamava `MessageBus.post(null, …)` — que entrega a TODOS os WebViews. O
  dreno documentado ("uma lista de PERMISSÃO de dois itens") existia só no
  `espelho/tela.js`, isto é, **no lado que um desconhecido controla**. E a
  porta do pareamento nasce aberta desde a v5.189 (decisão certa: o conteúdo
  é público), então estar pareado nunca foi credencial. Com uma TV conectada,
  qualquer aparelho no Wi-Fi da igreja podia projetar `text` arbitrário,
  `clear`, `load` — e ligar o `mic`, que abre o microfone do celular na saída
  de som do templo. A metade servidora da lista agora existe
  (`TIPOS_QUE_SOBEM`, em `EspelhoServidor.retorno`), e o par tem de ser
  mantido junto. **A lição é a de sempre, num lugar novo: validação que mora
  no cliente não é validação — é economia de tráfego.**
- **RELIGAR A TRANSMISSÃO DEIXAVA AS TELAS SEM MÍDIA, em silêncio.** O
  `telaEmpurrados` do `controle.js` era uma SEGUNDA fonte de verdade sobre o
  cache do shell, e o cache é DA SESSÃO: `startMirror` constrói um
  `EspelhoMidiaCache` novo (o `init` apaga o diretório) e `desmontarEspelho`
  chama `zerar()`. Bastava desligar e religar — ou a Wi-Fi oscilar além dos
  6 s de graça, que aciona `aoPerderRede = { stopMirror() }` — para o Controle
  seguir afirmando "já empurrei" contra um cache vazio: o `load` ia com
  `__rec.url = '/m/<token>'` e a rota devolvia o 404 idêntico. **Toda mídia já
  tocada antes do religamento ficava invisível**, sem erro em lugar nenhum. O
  LRU de 1,5 GiB produzia o mesmo desencontro por outra porta. O conjunto saiu:
  quem responde "já tenho isto?" é o `abrir` do shell, que já respondia.
- **E O EMBED DO YOUTUBE SAIU DOS DOIS WEBVIEWS** (pedido do operador:
  *"vamos abandonar o sistema nativo do próprio YouTube e seguir apenas com o
  nosso embed"*). O KDoc do `display.js` dizia que o risco de supply-chain
  daquele `<script>` era "ACEITO conscientemente" e que a mitigação "ainda não
  foi feita" — e descrevia METADE do problema. `addJavascriptInterface` injeta
  o objeto em **todas as frames**, iframes de outra origem inclusive (é o que
  a documentação do Android diz, e é por isso que o canal de mídia usa
  `addWebMessageListener`, que tem `allowedOriginRules`). No telão a ponte
  nasce com `host = null` e o estrago seria limitado; **o mesmo embed era
  criado no CONTROLE, para a preview**, e lá a ponte é a completa —
  `pickFolder`, `listFolder`, `pickDoc`, `openExternal`, `espelhoLigar`,
  `apkInstalar`. **A invariante 9 protegia a metade errada**, e atravessou
  dezenas de versões assim porque o texto dela só nomeia o telão.

  Saíram ~540 linhas do `display.js` (`YT.Player`, `ytHandle`, `ytStatus`,
  `ytShield`, a máquina de mudo que "ignora o `forceMuted` do stage por
  completo") e ~180 do `controle.js`, mais as duas camadas de CSS que
  existiam só para esconder a UI de um player alheio. O que some junto é o
  argumento inteiro: um segundo motor de transporte, um segundo emissor de
  status, uma segunda cortina e um `if (yt)` em quinze pontos.

  **Quem toca YouTube agora é o caminho PRÓPRIO, e ele já era o preferido**:
  transmissão direta (`ytStream` → `shared/mse.js`) e, falhando ela, o arquivo
  baixado. Um registro `kind: 'youtube'` (o link sem bytes) deixou de ser
  tocável como link e passa a ser RESOLVIDO no toque, dentro do `send`
  (`resolverLinkYoutube`): transmite, ou baixa e **troca o item na lista em
  posição** (`listSet` com função — `listAdd`+`listRemove` mandaria o item
  para o fim de um Cronograma que alguém montou à mão). A transmissão não
  troca nada, porque um manifesto expira em horas. No navegador não há o que
  fazer, e a linha do item diz isso em vez de projetar nada.

  **O oráculo ficou mais forte, não mais fraco**: o `tela-rede.test.mjs`
  afirmava que a CSP BARRAVA a IFrame API — uma garantia de segunda ordem, que
  dependia de um cabeçalho continuar certo. Agora ele afirma que a tela da
  rede **não pede um byte a origem nenhuma além do celular**, o que falha mesmo
  que a CSP o barrasse depois.
- **E a documentação que contradizia o código foi corrigida junto**, pela
  regra da v5.206: o KDoc do `EspelhoServidor` ainda se chamava "o cano por
  onde os PIXELS saem" e afirmava que "aqui não há `Range` nenhum" — 500 linhas
  acima de uma rota que faz RFC 7233 completo; o do `EspelhoHttp` dizia o mesmo
  e discordava da própria invariante 7, dentro do mesmo arquivo; o `retorno`
  documentava os verbos `key` e `audio` do encoder aposentado; havia um
  `@param pedirIdr` para um parâmetro que não existe, quatro blocos de KDoc
  órfãos sobre constantes apagadas e um `const CABECALHO = 16` morto. E o
  parágrafo que prometia que "**nada** que venha da rede entra no barramento"
  deixara de ser verdade na E5 — ele descrevia a garantia certa, e o código não
  a impunha mais. Era exatamente o defeito de cima, escrito em prosa.

---

## v5.211 (APK v1.96)

**A v5.211 (v1.96): A CAPA ARTIFICIAL SAI — fica a COR, sólida. EXIGE APK.**
Pedido do operador sobre a v5.210, e ele encurta uma decisão que eu tinha
tomado por ele: *"não preciso da capa artificial, apenas da cor. sólida, limpa
e minimalista"*.

**O argumento da v5.210 era sobre o BURACO, e o buraco é menos ruim que o
enchimento.** Um `MediaStyle` sem `largeIcon` deixa um vão do tamanho de uma
capa que cada versão do Android preenche de um jeito, e eu tratei isso como
defeito a corrigir. Só que a capa que eu pus ali não informava nada — era o
mesmo símbolo em todo louvor, todo vídeo e toda mensagem —, e um elemento
constante que não distingue nada é decoração. Num cartão que o operador olha
de relance, no escuro, no meio de um culto, quem carrega a informação é o
TÍTULO e o transporte; **sólido lê mais rápido que ilustrado.** Com
`setColorized(true)` o cartão já é um painel de cor inteiro, e é ele que faz o
trabalho de "isto é o mesmo app".

Saíram o `capaArtificial`, o `capaCache`, o `setLargeIcon` e os dois imports
de `graphics` — o `temaMudou()` e o `corDoTema()` ficam intactos, porque a cor
era o pedido desde o começo. **A regra que a v5.210 escreveu e que continua
valendo é a outra**: a capa não podia seguir o tema (o vetor do ícone está nos
tokens do escuro, e sobre o `app_bg_claro` daria 1,02:1) — quem segue o tema é
o cartão, e agora é a única coisa que segue.

---

## v5.210 (APK v1.95)

**A v5.210 (v1.95): A NOTIFICAÇÃO VESTE O TEMA, e o MODO RELÓGIO deixa de
perguntar as horas ao aparelho errado. EXIGE APK.** Dois pedidos do operador,
mais uma verificação que ele encomendou junto e que não achou defeito nenhum.

- **O CARTÃO PASSA A TER A COR DO APP.** Uma notificação sem `setColor` é
  pintada com o cinza padrão do sistema — que não é nem o claro nem o escuro
  deste app, e fica visivelmente estranho ao lado da tela de onde veio. Agora
  os DOIS cartões (o player e o da transmissão) usam o mesmo `--bg` do tema
  escolhido, lido de `values/colors.xml` pela mesma preferência que pinta o
  `windowBackground` — **é o quarto consumidor daquela cópia à mão, e não há
  escapatória**: recurso de Android não enxerga custom property de CSS.
  `setColorized(true)` é o que faz o sistema usá-la como FUNDO em vez de um
  respingo no ícone, e ele só é honrado em serviço em primeiro plano ou
  `MediaStyle` — que é exatamente o caso dos dois. Trocar de tema **repinta na
  hora** (`SessionService.temaMudou`): sem esse aviso a cor só mudaria no
  próximo `publish()`, que numa cena parada é daqui a um louvor inteiro.
- **E ele ganhou uma CAPA, porque não existe capa de verdade. ~~REVOGADA na
  v5.211~~** a pedido do operador — leia mesmo assim, porque a regra do meio
  (a capa não pode seguir o tema) é o que sobrou de pé. O acervo é
  hino, vídeo e imagem de culto: não há arte de álbum em lugar nenhum, e um
  `MediaStyle` sem `largeIcon` fica com um buraco do tamanho de uma capa que
  cada versão do Android preenche de um jeito. A capa é o símbolo do ícone do
  app sobre o fundo escuro, rasterizado uma vez e cacheado (`publish()` roda a
  cada play/pause e a cada salto de posição). **Ela NÃO segue o tema, e isso é
  a regra do ícone do app pelo mesmo motivo**: o vetor está pintado nos tokens
  do tema ESCURO, e sobre o `app_bg_claro` a trilha daria **1,02:1** — o
  desenho sumiria. Capa é arte, e arte não troca de cor com a moldura; quem
  segue o tema é o cartão.
- **O MODO RELÓGIO lia o relógio DE QUEM DESENHA.** Cronômetro e sorteio
  viajam por DESCRITOR ancorado numa época do celular, e a casca do papel
  `tela` já a traduz para o referencial da tela (`corrigirRelogio`). O modo
  relógio não tem época nenhuma na mensagem — ele desenha a hora corrente — e
  por isso era o único que ficava com o segundo de uma Smart TV, que pode estar
  minutos fora, na frente da congregação. Agora a casca publica
  `window.__avAgora` (a mediana das épocas do ping) e só o modo relógio o
  consulta. **A primeira versão disto aplicou a correção aos três**, e o
  `tools/tela-rede.test.mjs` a reprovou no ato — *"o cronômetro lê ~0 s, o
  desvio de 90 s foi ANULADO"* —, porque medir contra a origem um descritor já
  traduzido corrige duas vezes. O teste estava certo, e o comentário no
  `display.js` guarda o caso para a próxima leitura.
- **A vigília foi verificada e está certa nos dois lados**, sem mudança: no app
  é `FLAG_KEEP_SCREEN_ON` nas duas janelas (a Activity e a `Presentation`), e
  na tela da rede é o `navigator.wakeLock` da v5.209 com o `<video>` de 2×2
  como piso para o `http`.

---

## v5.209 (APK v1.94)

**A v5.209 (v1.94): AS TELAS MORRIAM DE 60 EM 60 s porque o sinal de vida era
um TIMER. EXIGE APK.** O Registro do operador entregou o defeito em duas
linhas — `tela C conectada` às 16:30:56, `tela C desconectada (sem sinal de
vida ha 60 s)` às 16:31:56 — e o mesmo navegador reentrando como tela A, B, C,
D ao longo do culto. **Enquanto ele reentra, o comando não chega**: é o "deixa
de controlar" que o operador vinha relatando.

O `alive` vivia num `setInterval` de 10 s e o servidor derrubava com 60 s de
silêncio — "seis batidas perdidas é uma tela que foi embora". O raciocínio
supõe que o timer bate, e **um navegador de TV com a aba em segundo plano
estrangula timer para ~1 por minuto**. As seis viram uma, que chega na
fronteira, e o vigia executa uma tela perfeitamente viva. As duas metades:
**o sinal pega carona no FIO** (byte que chega não é timer — o `read()` do SSE
resolve porque o servidor escreveu, e o ping dele é de 15 s; o timer fica como
piso e a volta da aba manda um na hora) e **o teto do servidor vai a 150 s**,
onde cabem dez pings e uma tela que de fato saiu ainda cai em menos de três
minutos.

Mais duas da mesma família: a **vigília ganhou a trava de verdade**
(`navigator.wakeLock` quando o contexto é seguro, re-pedida no
`visibilitychange` porque a API a solta ao perder o foco — a guarda entra como
BLOCO, que é a forma que o `tools/contexto-seguro.test.mjs` sabe ler, e ele
reprovou a primeira versão, que usava retorno antecipado); e
**`telaReenviarPreferencias` deixou de perguntar a um CACHE**. A guarda era
`telaAtiva()`, que consulta um estado relido por enquete só quando a folha de
conexão está à vista — mas quem chega ali é um `display-ready` que veio PELO
SSE, e se ele chegou a transmissão está no ar. O cache só podia produzir falso
negativo, e o preço era a tela ficar sem wallpaper, sem fundo de letra e sem
preenchimento, sem nada que o explicasse.

---

## v5.208

**A v5.208: O TRANSPORTE DO MODO AVANÇADO ESTAVA BRANCO NO BRANCO. OTA PURO.**
Medido: **1,00:1** — `rgb(255,255,255)` sobre `rgb(255,255,255)`. A v5.207
consertou os segmentados de Configurações (1,14:1) e eu dei o assunto por
encerrado sem nunca ter TROCADO DE MODO na medição: os botões que o operador
mais usa num culto (▶, ⏹, ⏮, ⏭, cortina, letra, mudo) ficaram de fora, e eram
o pior caso do app inteiro — invisíveis, não "fracos".

No tema claro `--bar` é BRANCO, o mesmo valor de `--panel`, e os controles da
barra pintam `--surface`, que é branco com alfa. Branco a 70% sobre branco é
branco; no escuro o mesmo par funciona, e é por isso que ninguém tinha visto.
A correção é do TEMA e não da folha (`:root[data-tema="claro"] .bottombar`
afunda a superfície): pôr o transporte na lista geral de "afunda" inverteria a
aparência da peça mais usada do app **no escuro** para resolver um problema que
só existe no claro. Mais a aresta de `--control-edge`, pelo mesmo raciocínio da
v5.207. Medido depois: claro 1,00 → 1,25 com aresta visível, escuro inalterado.

**A lição é sobre método:** medir "os botões" sem entrar no modo em que eles
vivem é medir outra tela. O modo avançado exige `setAppMode('full')` — remover
a classe `.open` do simplificado deixa a página em branco, e **uma medição que
não acha nada parece uma medição que passou**.

---

## v5.207

**A v5.207: O ALERTA FLUTUANTE ACABA — a resposta nasce onde o toque nasceu.
OTA PURO.** Três pedidos do operador, e o terceiro é uma regra nova do
projeto: *"precisamos remover todos [os toasts] e colocar todas as mensagens
de alerta na própria interface de origem delas. A informação deslocando do
alvo de foco não é o objetivo."*

**E ele estava descrevendo um toast que o projeto jurava não ter.** O comentário
do `avisar()` dizia, com todas as letras: *"o que ele NÃO é: o toast de volta.
Não flutua (mora no fim da área de lista)"*. O CSS dela era `position: fixed;
top: .5rem; z-index: 400` — uma faixa no TOPO da tela, por cima do que
estivesse ali, respondendo a toques dados no rodapé de Configurações, numa
linha do meio da lista ou dentro de uma folha aberta. **Trinta e cinco pontos
do app falavam por ela.** É a segunda encarnação do mesmo mecanismo (um toast
já tinha sido removido antes), e é por isso que desta vez a regra ficou com
ORÁCULO: `tools/smoke.mjs` afirma que nenhuma camada fixa sobrou por cima da
interface — a régua é estrutural, não de nome, porque o próximo toast pode se
chamar qualquer coisa.

**Os canais que a substituíram**, todos in-place e a maioria já existente:
`pulsar` (o botão tocado), **`notaNoItem`** (a LINHA do item, prefixada ao
subtítulo no mesmo desenho do selo "● No ar" — para tudo que é um fato sobre
um item: falhou ao projetar, foi para tal lista, veio truncada),
**`previewBusy().falhar`** (o mesmo cartão que dizia "Baixando…", sobre a
preview, que é onde a mídia apareceria), **`statusPasta`** (o CONTADOR da
pasta, que é o número que a sincronização está mudando), **`falarNaVersao`** e
**`falarNoPacote`** (o rótulo do próprio controle empresta a si mesmo e
volta), `#castMsg` (a folha de conexão) e `appConfirm` — este último para o
**único caso sem interface de origem**: um compartilhamento que chega de fora,
falha inteiro e não deixa item nem lista em que responder. Um diálogo não é
uma faixa que passa: ele toma o foco e exige um toque.

Saíram junto o `flash()` (no-op havia versões, com três chamadores que
escreviam frases que ninguém via) e o parâmetro `opts.toast` do download de
música — ele existia só para CALAR a faixa quando o cartão da preview já
falava, isto é, era um `if` para escolher entre dois canais para o mesmo fato.

**O REGISTRO PERDEU O VISOR.** A caixa `<pre>` tinha 240px de altura no meio
de Configurações e empurrava para fora da tela as linhas que o operador de
fato ajusta — para exibir, em fonte de 0,68rem, um log cujo consumidor é um
humano A DISTÂNCIA: ele é COPIADO, não lido ali. Ficaram a linha e o botão que
o copia; o texto vive em `diagTexto`, não num nó do DOM. Medido: a folha
deixou de rolar nos dois temas, e o `smoke.mjs` trava isso.

**E O TEMA CLARO GANHOU A ARESTA QUE O `tokens.css` já prometia.** Relato:
"botões com fundo branco no branco". Medido, ele estava certo por um fator
grande: os segmentados de Configurações (`.fit-opt`, oito deles) davam
**1,14:1** contra o painel branco. A causa é estrutural — no escuro um
controle se anuncia por ser MAIS CLARO que a base, e no claro não existe "mais
claro que branco". O cabeçalho do tema claro já dizia que "é a linha em
`--line` que anuncia o controle aqui", e **nenhum controle a desenhava**: era
uma intenção, não uma descrição. Agora `--control-edge` (transparente no
escuro, `--line` no claro) a torna verdadeira, por `box-shadow: inset` para
não mover um pixel de layout em tema nenhum, e os afundados subiram de
.06/.10 para .10/.16.

---

## v5.206 (APK v1.93)

**A v5.206 (v1.93): O REGISTRO MENTIA — o consumidor sobreviveu ao produtor,
e o valor ausente virou resposta. EXIGE APK.** Uma revisão de todo o repositório
com viés para os três últimos dias (v5.184 → v5.205) achou o rastro que a
aposentadoria do espelho de pixels (v5.187) deixou para trás: o Kotlin parou de
PRODUZIR as métricas daquele pipeline e o `controle.js` continuou CONSUMINDO-as.

**O defeito, e por que ele é o pior tipo:** o `EspelhoDiag` publicava `ritmo`
mesmo sem `amostra()` ter um único chamador — zerado —, e o `blocoEspelho` lê
`kbps < 40` como "isto é um retângulo preto". Com a transmissão ligada, um
vídeo tocando e a cortina aberta (um culto normal), o Registro imprimia
**`ALARME: ISTO É UM RETÂNGULO PRETO`**. O Registro é o ÚNICO artefato deste
app cujo consumidor é um humano a distância — ele é feito para ser copiado e
repassado —, e o KDoc daquele mesmo arquivo já dizia, desde que nasceu, que
"diagnóstico que mente é pior que diagnóstico nenhum". Ele mentia havia
dezenove versões. Dois irmãos do mesmo lote: `linhasDaTela(undefined)` acusava
**toda** tela conectada de rodar "bundle antigo", e `modo: "comandos"`
comparado com `'video'` desenhava **"modo: imagem (JPEG)"** — um modo removido
na v5.156.

**A regra que fica**, e ela é o que este lote acrescenta ao projeto: *apagar o
PRODUTOR de uma métrica e deixar o CONSUMIDOR de pé não produz silêncio —
produz um ZERO, e zero é um valor legítimo que o consumidor interpreta.*
Remoção de recurso é remoção dos dois lados do fio, no mesmo lote.

**O que saiu, medido:** ~310 linhas de `SondaClipe`/`SondaPathHandler` (o
instrumento cujo clipe e cuja página foram apagados na v5.187), o anel de
`ritmo` inteiro e o `fato()` do `EspelhoDiag` — o arquivo caiu de 775 para 140
linhas —, nove ramos mortos do `blocoEspelho`, o autorrelato de tela
(`somDaTela`, `linhasDaTela`, `MIRROR_VEREDITO`, `MIRROR_RS`, `MIRROR_NS`,
~155 linhas), a rampa de volume da preview do YouTube (resto da mesa de som da
v5.189, com o comentário que ainda falava dos "três sinks de áudio"),
`.simple-key-sub` e dois `id` órfãos.

**E o oráculo que faltava:** `tools/registro.test.mjs` monta o Registro com a
ponte presente e uma resposta de `espelhoDiag` na forma REAL de hoje, e cobra
as duas metades — nenhuma palavra de recurso aposentado, e o que o operador
foi buscar presente (endereço, telas, diário). Sem a segunda metade, apagar o
bloco inteiro passaria. Rodado contra o código anterior, ele reprova em oito
pontos. Nenhum teste carregava o Registro até aqui, e foi por aí que os três
defeitos passaram.

**Os registros que contradiziam o código** foram corrigidos no mesmo lote — e
o mais caro deles era um comentário: o `espelho/tela.js` ainda ARGUMENTAVA a
favor do `<style>` injetado ("uma folha a mais no `<head>` pesaria nos três
papéis"), com o parêntese da v5.205 anexado embaixo dizendo que as regras
tinham saído. Um argumento plausível e errado, pronto para reverter a correção
que acabara de custar duas versões. Junto: `.simple.locked` (a classe é
`.sem-tela`), o comentário do `#simpleConn` descrevendo o layout no fluxo que a
v5.203 içou para o centro, "O ENDEREÇO E O CÓDIGO" (o código saiu na v5.189), o
KDoc do `mirrorDiag` citando o `EspelhoDisplay.kt` apagado, o do
`WebViewFactory` justificando a subclasse pela mesa de som, o da CSP
justificando `blob:`/`data:` pelo cliente de pixels (as diretivas continuam
necessárias — OPFS e o `POSTER_VAZIO` —, as razões é que eram outras), e o
`?tela=1` como marcador único do papel `tela` (é a `<meta name="av-tela">`
desde a v1.92).

**A paleta foi medida, não relida:** 44 dos 50 pares declarados em
`tokens.css` batem na segunda casa decimal. As seis divergências eram todas de
fundo com ALFA e tinham uma causa só — **toda medição "sobre o soft" usa o soft
composto sobre `--bg`**, e isso não estava escrito. Dentro de um cartão o valor
é outro (`--danger-text` sobre `--danger-soft`: 6,89:1 na página, 5,03:1 no
cartão; os dois passam AA). A base agora está dita no cabeçalho do arquivo.

**E o texto de UI passou:** nenhuma frase estática acima de 70 caracteres e
nenhuma repetição no `index.html` — a poda das v5.194→v5.198 fez o serviço. O
excesso que restava era de COMENTÁRIO, nos blocos mortos acima, descrevendo
readback, perfil de encoder e `FLAG_NEVER_BLANK` no arquivo mais lido do
projeto.

---

## v5.205

**A v5.205: A CSP BLOQUEAVA O ESTILO DA ENTRADA — o overlay existia, sem
posição, DEBAIXO do wallpaper. OTA PURO. CONFIRMADO EM APARELHO:** *"funcionou,
a tela conectou"*. Relato de partida: *"não aparece o botão, cai direto no
wallpaper"*, no v1.92, com a marca do papel já funcionando.

**O papel sempre esteve certo; quem não aparecia era o overlay.** O
`espelho/tela.js` montava a entrada e injetava as regras dela num
`document.createElement('style')`. A página servida às telas da rede leva
`default-src 'self'` **sem `style-src`** (`EspelhoHttp.CABECALHOS_PAGINA`), e
um `<style>` criado em runtime exige `'unsafe-inline'`: o navegador anexa o
elemento e **não aplica nada**. O `#telaEntrada` era criado, recebia
`display:flex` pelo CSSOM (que a CSP não barra) e virava um bloco sem posição
no fim do `<body>` — isto é, embaixo da camada fixa do wallpaper. Invisível e
inclicável.

**É o pior tipo de falha: nada quebra, nada erra alto.** Ela resistiu a duas
correções que mexiam no lugar errado (a query do papel na v5.204 e a marca do
servidor no v1.92) porque o sintoma — "cai no wallpaper" — é idêntico ao de um
`tela.js` que não roda.

**E o CI não tinha como vê-la**, pela mesma razão da v5.204 por outra porta: o
`tela-rede.test.mjs` servia a página **sem a CSP**, então ali o `<style>`
valia. Um harness mais permissivo que o servidor de verdade prova o percurso
num ambiente que não existe. Hoje ele manda a CSP verbatim, e o clique real no
botão (que já estava no teste) é o que falha quando as regras não são
aplicadas — reproduzido antes de consertar.

Junto veio o IRMÃO do mesmo defeito, achado na mesma varredura: o
`shared/stage.js` injetava o CSS do indicador de espera do mesmo jeito, com o
argumento — bom até a v5.187 — de que "a animação é um `@keyframes` injetado
uma vez". Nas telas da rede ele era uma `div` vazia: a tela ficava em preto
durante a espera de um stream sem nada dizendo que o app estava trabalhando,
que é exatamente o que aquele indicador existe para evitar.

Os dois viraram FOLHA — `espelho/tela.css` e `shared/stage.css` —, servidas do
próprio origin, sem relaxar a CSP em nada. **A regra que fica: nas telas da
rede não existe estilo embutido.** `element.style.x = y` (CSSOM) continua
valendo; `<style>` criado em runtime e atributo `style=` em HTML injetado, não.

E o teste passou a AFIRMAR a garantia que a CSP existe para dar: a IFrame API
do YouTube é barrada — zero pixel de terceiro numa tela da rede (spec §1) —, em
vez de essa recusa virar ruído no console.

---

## v5.204 (APK v1.92)

**A v5.204 (v1.92): O PAPEL `tela` DEIXA DE DEPENDER DA QUERY — e o teste que
devia ter pego isso estava mentindo. EXIGE APK.** Relato: *"a tela não está
conectando na rede"* mais *"no navegador ele pula a tela de ativar tela,
diretamente para o wallpaper"*. As duas frases são UM desfecho: sem o papel
`tela`, o `espelho/tela.js` é um no-op de uma guarda — a página abre como um
`/display/` comum, mostra o wallpaper, não desenha a entrada, não pede token e
nunca conecta.

O papel vinha de `?tela=1`, e esse marcador chega por um 302 da rota `/`.
**É uma corrente de elos frágeis**, e basta um ceder: um navegador de TV que
não preserva a query no redirecionamento, o endereço guardado nos favoritos
sem ela, alguém digitando `/display/` direto. Lida a fonte inteira, o 302 é
bem-formado, o endereço publicado é a raiz e o token vencido se recupera
sozinho — não achei o elo que cede no aparelho do operador, e por isso a
correção não é consertar um elo: é **não depender da URL**. Quem serve a
página sabe o que ela é, e este servidor só serve o display
(`web/controle/` nunca entra em `PREFIXOS_BUNDLE`), então ele injeta
`<meta name="av-tela">` em toda página que entrega. É `<meta>` e não
`<script>` porque a CSP daquela resposta é `default-src 'self'` sem
`'unsafe-inline'` — um script embutido seria bloqueado, e em silêncio.
Degrada nos dois sentidos: shell antigo não injeta e a query resolve; bundle
antigo ignora a marca e a query resolve.

**E o `tela-rede.test.mjs` provava o percurso pelo caminho errado.** Ele
carregava a página com `?tela=1` na mão e o servidor de mentira entregava o
HTML cru — isto é, testava um caminho que o aparelho pode não receber, e era
justamente essa divergência entre o servidor falso e o de verdade que deixava
o defeito passar. Agora o harness INJETA a marca como o servidor real, e o
percurso inteiro roda **sem query nenhuma**.

**Junto, a instabilidade dele foi consertada** — ela falhava em duas de cada
três execuções e "passava na segunda tentativa". A corrida era do próprio
teste: ele esperava o servidor RECEBER o `POST /par` e lia a frase de erro no
instante seguinte, quando quem a escreve é o cliente, depois da resposta. Com
`continue-on-error` no CI, um teste assim não é rede de segurança — é ruído
que ensina a ignorar a cor vermelha. Quatro de quatro depois do conserto.

**O Registro passou a dizer onde o pareamento parou:** cada página entregue e
cada `POST /par` **aceito ou recusado** viram linha. Até aqui só a tela que
CONECTAVA deixava rastro, e "a tela não conecta" tinha duas causas
indistinguíveis — nenhum navegador chegou a pedir, ou pediu e foi recusado —
que pedem ações opostas do operador.

**E quatro rotas mortas saíram**: o mapa `ESTATICOS` apontava para
`espelho/index.html`, `cliente.js`, `fmp4.js` e `espelho.css`, os quatro
apagados na v5.187 com o espelho de pixels. Três só sabiam responder "faltou
no bundle" e a quarta (`/`) o `when` já interceptava antes.

---

## v5.203

**A v5.203: A CORTINA DO MODO FÁCIL VOLTA — e a v5.199 foi um diagnóstico
errado, não uma mudança de gosto. OTA PURO.** Pedido do operador: *"lembre que
lhe pedi para voltar a tela de blur do modo simples que bloqueia a tela
enquanto não fizerem a conexão com uma tela"*.

**Ele já tinha dito isso, e eu li errado.** Duas mensagens antes: *"sobre a
tela de blur bloqueada, ESSA PARTE NÃO ERA O PROBLEMA — a questão era que ao
invés de aparecer a seção com opção de conectar TV ou ligar a rede, aparecia
ainda o botão antigo"*. Isto é: o que ele relatava era o `#simpleCastBtn` da
v5.192 reaparecendo (a base embutida no APK, servida por um recuo do watchdog
que não limpava o cache do WebView — a causa real, corrigida na v5.200/v1.91),
e eu tinha lido "o botão de conectar persiste em bloquear a tela" como se o
BLOQUEIO fosse a queixa. A v5.199 derrubou a cortina inteira por causa dessa
leitura, e o "priorizando a conexão" da mensagem seguinte foi lido de novo como
ordem na tela em vez de bloqueio.

**A lição não é sobre CSS.** Quando o operador descreve um sintoma com o nome
de um elemento, o nome pode estar errado e o sintoma nunca está: a resposta é
ir medir o que ele está vendo — foi o que finalmente achou o cache do WebView
—, não redesenhar em cima do nome. E quando ele diz explicitamente "essa parte
não era o problema", isso vale mais que qualquer inferência.

Voltaram: `#simpleVeil`, os tokens `--veil`/`--veil-solid` (nos dois temas), o
içamento de `.simple-actions` para o centro e o `closeHymnSearch()` do
bloqueio. **Não voltou** a liberação de teste de 5 s: a saída legítima é o
"Modo avançado" do cabeçalho, que fica por cima da cortina e é visível e
rotulado — um gesto secreto que destrava a projeção sem dizer que destravou é
pior que não ter saída nenhuma.

O estado DESTRAVADO é o da v5.202 e não mudou: letra no topo, preview +
"Buscar música" lado a lado na zona de baixo, teclado por último.
`tools/boot-nativo.test.mjs` afirma agora as duas metades — com tela a página
destrava, sem tela a cortina cobre a tela inteira e a busca sai de cena.

---

## v5.202

**A v5.202: A CONEXÃO DESCE PARA A ZONA DE BAIXO — o topo é da LETRA, como
foi pedido. OTA PURO.** A v5.201 pôs a seção de conexão ACIMA da letra, e isso
contrariava a própria frase que a encomendou: *"deixe ele na zona de baixo
mesmo, com a parte superior para a letra da música"*. O operador leu a tela,
viu o cartão ocupando o alto e concluiu que **a atualização não tinha
chegado** — e o Registro que ele mandou junto provava o contrário (`Web
v5.201 · Shell v1.91`, "última busca há 11s: nada novo (publicada: v5.201)").
Fica a lição: quando a tela não bate com o pedido, o primeiro suspeito do
operador é o canal de entrega, não a decisão de desenho. Uma leitura errada do
pedido custa a confiança no OTA.

Agora `#simpleConn` mora DENTRO da `.simple-actions`, na célula da preview:
sem tela a faixa vira uma coluna e sai conexão em cima, busca embaixo, as duas
com a largura inteira, logo acima do teclado; com tela ela some por inteiro e a
célula volta a ser a preview. O topo é da letra nos dois casos.

Junto, uma linha do Registro que estava mentindo: o bloco da transmissão se
intitulava **"Espelho de pixels"**, o recurso que a v5.187 aposentou por
inteiro. Ele descreve o telão por comandos há catorze versões, e é lido
justamente quando alguma coisa não conecta — um título que nomeia um recurso
que não existe mais é a pior linha possível num diagnóstico que vai ser
repassado. Passou a ser **"Transmissão para navegador"**, o mesmo nome do
interruptor na folha de conexão.

---

## v5.201

**A v5.201: O MODO FÁCIL FICA COM A LETRA EM CIMA E O QUE SE OPERA EMBAIXO.
OTA PURO.** Pedido do operador, e ele desfaz metade da v5.200: *"pode voltar
ao design de preview + botão de pesquisar músicas, mas deixe ele na zona de
baixo mesmo, com a parte superior para a letra da música"*.

A v5.199 fez a faixa de ações virar coluna sem tela, a v5.200 separou o par de
vez (busca larga embaixo, preview sozinha no alto), e a forma que ficou de pé
é a EMPARELHADA, embaixo:

- **letra no topo** — é o que se lê durante o louvor, e é o que mais cresce;
- **preview + "Buscar música" lado a lado, na zona de baixo** — as duas coisas
  que se OPERAM, a busca a milímetros do ▶ que vem logo depois de escolher;
- **teclado por último**, como sempre.

**Sem tela conectada a seção de conexão vai para o TOPO, acima da letra** — o
"priorizando a conexão" que o operador pediu na v5.199, agora sem disputar
espaço com a faixa de baixo: ali a preview simplesmente some e a grade vira
uma coluna, com a busca inteira. Com o par de volta na linha, o teto de altura
de 20vh da v5.200 saiu junto com a razão dele — quem limita a preview é a
largura da célula outra vez.

---

## v5.200 (APK v1.91)

**A v5.200 (v1.91): O "RESQUÍCIO" ERA O CACHE DO WEBVIEW, e ele tem nome e
endereço. EXIGE APK.** O operador insistiu, e a insistência estava certa: o
que ele via não era a cortina da v5.199 — era **o botão único de conectar da
v5.192**, aquele que só abre o Smart View. Ele existe, com esse rótulo, na
base embutida no **APK v1.90**; e o app serve a embutida sempre que o
`beginSession` recua (watchdog descartando um bundle, ou APK novo atropelando
um OTA antigo). Como as URLs da base não mudam de nome entre versões e o
WebView roda em `LOAD_DEFAULT`, esse recuo montava a página com **metade de
cada bundle** — e a regra "trocou a base, limpa o cache" já estava escrita
neste repositório, aplicada em UM dos dois lugares em que a base troca. O
outro é o lançamento. Detalhes, incluindo por que o defeito se realimenta
(uma página remendada não confirma o boot, e o bundle seguinte também é
descartado), na seção do OTA — "Trocar a base servida OBRIGA a limpar o cache
do WebView".

`SHELL_VERSION` **não sobe**: nenhum método da ponte nasceu, saiu ou mudou de
assinatura. Mas **sem a Release o operador continua com o defeito**, porque a
correção é Kotlin.

Junto vieram dois pedidos de tela, os dois OTA:

- **"Buscar música" desceu para entre a letra e o teclado**, largo, nos DOIS
  estados. Ele nasceu dividindo a faixa do alto com a preview e só apareceu
  com a largura inteira na v5.199, quando aquela faixa virou uma coluna — foi
  essa forma que o operador pediu para ficar. E o lugar é o certo: buscar é o
  começo de OPERAR, então pertence ao teclado, a milímetros do ▶ que vem logo
  depois de escolher, e não ao alto da tela, junto do que se resolve uma vez
  por culto. A faixa de cima ficou com uma decisão só (preview × conexão), e a
  preview ganhou um teto de altura de 20vh: sem o botão ao lado ela tomaria a
  largura inteira, e 16:9 num aparelho de 430px são ~242px tirados da letra.
- **A aba do Cronograma virou um RELÓGIO.** A família do TEMPO é o que separa
  essa lista da playlist em todo o app, mas quem dizia isso era só o
  `more_time` dos botões "Adicionar ao Cronograma"; a aba respondia com uma
  agenda — mesma ideia, outro desenho. Agora é o mesmo mostrador, sem o "+",
  porque a aba é um lugar e não um acréscimo. **SVG inline**, como a aba da
  Bíblia e pelo mesmo motivo: `schedule` (U+E8B5) não está no subset de
  `shared/fonts/material-symbols.woff2` (31 codepoints), e codepoint ausente é
  um retângulo vazio na barra de navegação — a armadilha da v5.184. Auditados
  os 32 codepoints em uso contra o cmap da fonte: nenhum outro falta.

---

## v5.199

**A v5.199: O BLOQUEIO DO MODO FÁCIL SAI — e é ele que o operador chamava de
"o botão de conectar". OTA PURO.** Relato, pela segunda vez depois de a v5.197
ter removido o botão único: *"o botão toque para conectar em uma tela ainda
persiste em existir e ficar bloqueando a tela do modo simples, e ele também
está causando bugs"*.

**Medido no bundle publicado, o elemento não existia** — nem `#simpleCastBtn`
nem a frase "Toque para conectar uma tela" aparecem no v5.197 que o aparelho
estava rodando. **E o operador continuava certo.** O que ele descrevia não era
o elemento: desde a v5.193 quem ocupa aquele centro é a seção de conexão, e o
item dominante dela é o botão de espelhar — preenchido em `--accent-fill`, com
a largura útil da tela, no meio vertical dela, sobre uma cortina embaçada de
tela inteira. Mesma anatomia, mesmo lugar, mesmo efeito. **Trocar um botão
grande centrado por outro botão grande centrado não é remover o botão**, e a
lição é que o que incomodava nunca foi o ELEMENTO: era a tela inteira parar por
causa dele.

O argumento do bloqueio ("sem tela este modo é inútil") vale para PROJETAR e
não para o resto — procurar um hino, montar a lista e conferir a letra são
exatamente o que se faz **antes** de a tela existir, na terça-feira. Agora a
faixa de ações só muda de EIXO: com tela é a grade de duas colunas de sempre
(preview + buscar); sem tela vira uma coluna — conexão em cima, busca embaixo —
no fluxo, no alto, sem cobrir a letra nem o transporte. O preço está dito em
vez de escondido: sem nada conectado o ▶ não produz imagem em lugar nenhum (nem
som, desde que a mesa saiu na v5.189), e quem responde a isso é a seção de
conexão, que é a primeira coisa que se lê na tela.

**Saíram junto**: a cortina `#simpleVeil`, os tokens `--veil`/`--veil-solid`
(ela era o único consumidor que eles já tiveram) e a **liberação de teste de
5 s** — cujo alvo mudou duas vezes em cinco versões (o botão único, a cortina,
nada) e cujo único trabalho era derrotar o bloqueio. Porta sem parede não é
porta.

**E a "busca profunda" achou os dois defeitos que o relato prometia**, os dois
da mesma família — um dono a menos:

- **A ENQUETE DE 2,5 s DO ESPELHO TINHA DOIS ACIONADORES E UM SÓ INTERRUPTOR.**
  Ela nasceu como enquete da FOLHA (`abrirCast` liga, `fecharCast` mata), e a
  v5.193 deu ao bloco uma segunda casa sem lhe dar um dono novo. As duas
  metades erradas: `hostCastConn` a acendia e **nunca** a apagava (uma tela
  entrando devolvia o bloco à folha e deixava a enquete batendo na ponte pelo
  resto da sessão), e `fecharCast` a apagava **mesmo quando quem a acendeu foi
  a TELA** — isto é, abrir e fechar a folha uma vez cegava o Modo Fácil
  justamente para o evento que ele espera, uma tela da rede entrando. Agora o
  dono é um só e é a VISIBILIDADE do bloco (`acertarEnqueteDaConexao`), que é a
  mesma pergunta que o `renderCast` já faz para decidir se vale desenhar.
- **`lastDisplays` e `reconferirTelas` SUBIRAM PARA O TOPO** — a família da
  zona morta temporal, pela quinta vez. Não explodiu, e é esse o ponto: os dois
  são lidos por TRÊS caminhos de render (`telaoConectado`, `simpleDisplay`,
  `renderCastBtn`) e eram declarados 14 mil linhas abaixo; só não quebravam
  porque o `setAppMode(appMode)` que os alcança na carga fica DEPOIS deles no
  arquivo. A corretude dependia da ordem relativa de duas linhas separadas por
  14 mil — que é exatamente a dependência que derrubou o app nas v5.184, v5.193
  e v5.195.

`tools/boot-nativo.test.mjs` passou a afirmar o que o operador relatou, e não
uma classe CSS: **não há cortina no documento e a busca continua desenhada e
clicável sem tela nenhuma.**

---

## v5.198

**A v5.198: O INTERRUPTOR DA REDE PASSA A NOMEAR O DESTINO. OTA PURO.**
"Transmitir pela rede" descrevia o MEIO — por onde a coisa viaja —, e meio
nenhum ajuda a escolher. A opção de cima diz para onde vai ("Espelhar para
TV") e por isso se lê de primeira; esta ficava sem par, e o operador tinha de
deduzir o destino de "rede".

Agora é **"Transmitir para navegador"**, e a palavra é a certa por ser
literalmente o requisito da outra ponta: um computador, um notebook, um tablet
ou a própria TV servem, desde que abram o endereço. É também a palavra que o
rótulo do endereço logo abaixo já usa ("Acesse este endereço no navegador"),
então as duas linhas passaram a completar uma à outra em vez de cada uma
nomear a coisa de um jeito.

---

## v5.197

**A v5.197: O BOTÃO ÚNICO DE CONECTAR SAI — e ele estava MORTO havia quatro
versões. OTA PURO.** O operador viu resquícios dele no Modo Fácil; medido, o
resquício era o botão inteiro.

Ele estava escondido por **DOIS caminhos ao mesmo tempo**, e é por isso que
ninguém notou: `.simple:not(.locked) #simpleCastBtn { display: none }` (com
tela, quem ocupa a célula é a preview — v5.75) e
`.simple.locked #simpleCastBtn { display: none }` (sem tela, quem ocupa a tela
é a seção de conexão inteira — v5.193). Duas regras que juntas cobrem TODOS os
estados são um elemento que nunca aparece; e o CSS de um elemento que nunca
aparece não tem como ser notado errado.

Ainda assim ele carregava rótulo, subtítulo, ícone, `title`, ~25 linhas de CSS
de destaque, três `getElementById` e metade do `renderSimpleCast` — que existia
para pintá-lo e ficou com três linhas depois de ele sair. **A regra que isto
ensina é sobre a forma de esconder**: `display: none` por estado é acumulável,
e dois deles não somam "escondido às vezes", somam "não existe".

**E a barra de progresso do gesto de 5 s foi junto — descobrindo que ela nunca
tinha chegado ao novo dono.** A liberação de teste mudou de alvo na v5.193 (do
botão para a cortina) e a animação ficou para trás: eram **cinco segundos de
nada**, indistinguíveis de um toque que não pegou. Agora ela corre no TOPO da
cortina — embaixo ficaria atrás do teclado de transporte, que é o que a
cortina cobre.

---

## v5.196

**A v5.196: A FOLHA DE "AJUSTES AVANÇADOS" SAI INTEIRA. OTA PURO.**
Pedido do operador: *"nada ali é realmente útil, exceto pelo botão de
desconectar tela"*. Ele tinha razão sobre a folha e estava enganado sobre o
botão — e a diferença importa, porque é ela que decide onde o desconectar vai
parar.

**O botão daquela folha era "Ligar/Desligar o espelho": a TRANSMISSÃO PELA
REDE, não o espelhamento para a TV.** E ele já era o mesmo estado do
interruptor "Transmitir pela rede", a dois centímetros dali, na folha de onde
aquela era aberta. Dois controles para um estado é a forma mais direta de eles
discordarem — some com a folha e o problema some junto.

Foram três coisas, e nenhuma sobreviveu à pergunta "isto muda o que o operador
faz?": o parágrafo de ressalvas (já reduzido a uma linha na v5.194, e a linha
mora na folha de conexão), o botão duplicado, e o **certificado TLS**. Este
último é a única perda real e está dita: ele exige do operador um subdomínio
com wildcard por DNS-01, uma entrada estática de DNS no roteador da igreja e
renovação automática — três coisas que o app não adivinha e que ninguém aqui
montou. **Os três métodos da ponte continuam no shell**, então voltar atrás é
desenhar uma folha, não publicar uma Release.

**E o desconectar foi para onde ele de fato pertence, em dois lugares
diferentes**, porque são duas coisas diferentes:

- **tela da rede** → continua na lista de quem está vendo, com o botão
  "Desconectar" por linha, na folha de conexão;
- **TV** → o app NÃO TEM COMO derrubar um espelhamento (não existe API
  pública), e quem desconecta é o seletor do Android. O botão de espelhar leva
  exatamente para lá nos dois estados; o que mudou é ele **dizer qual TV está
  no ar** ("Espelhando em TV do templo", em verde de conectado). O rótulo NÃO
  vira "Desconectar" de propósito: um botão com esse nome que abre uma lista
  seria uma promessa que a tela seguinte não cumpre.

**Uma armadilha do caminho, dita porque é da mesma família das outras:** o
bloco de ouvintes da seção de conexão era guardado por `if (mirrorOpenBtnEl)`
— o link "Ajustes avançados". Apagá-lo sem trocar a guarda desligaria em
silêncio tudo o que está dentro dela, **inclusive o interruptor da
transmissão**. A guarda passou a ser o botão de espelhar, que existe sempre.

---

## v5.195

**A v5.195: O PENTE NO RESTO DO APP — e a TELA PRETA que ele causou, com o
oráculo que faltava. OTA PURO.**

**Primeiro o defeito, porque ele é a parte que importa.** O app passou a abrir
em PRETO, e o relato do operador descreve a sequência inteira: tela preta →
na segunda abertura o Modo Fácil só com "Espelhar para TV" → na terceira, o
botão grande antigo de volta. Três sintomas, uma causa: `MIRROR_POLL_MS` e
`MIRROR_SHELL` são lidos na CARGA do módulo (pelo `hostCastConn` da v5.193,
alcançado pelo `setAppMode` do fim do arquivo) e nasciam 14 mil linhas abaixo
— zona morta temporal, `ReferenceError`, `controle.js` abortado. O terceiro
sintoma é o watchdog do OTA funcionando exatamente como projetado: sem
confirmação de boot, ele descarta o bundle e o lançamento seguinte serve o
EMBUTIDO NO APK, que é a versão anterior.

**É a terceira vez que esta armadilha morde** (`mirrorEstado` na v5.184,
`mirrorOcupado`/`mirrorTimer` na v5.193) e a primeira em que o CI não tinha
como vê-la: a leitura mora dentro de `if (espelhoDisponivel())`, que é FALSO
num navegador. **O `smoke.mjs` passava verde porque nunca executava a linha.**

**Daí o `tools/boot-nativo.test.mjs`**, e ele é a peça que faltava neste
repositório desde sempre: sobe a base web com um `__AVBridge` DE MENTIRA
injetado antes da carga, e pergunta a MESMA coisa que o watchdog do OTA
pergunta (`otaAppIsUp`) — o app ficou de pé? Todo caminho guardado por
`window.__NATIVE__` — que é dizer: todo caminho que só roda no aparelho, onde
não há console para olhar — passou a ter execução em CI. Ele achou o segundo
TDZ (`MIRROR_SHELL`) na primeira execução, e o stub tem uma fidelidade que
precisa estar dita: o Kotlin resolve `__avResolve(id, VALOR)` com objeto já
pronto, não com string — passar `'[]'` faria `lastDisplays[0]` ser o
caractere `'['`, verdadeiro, e o app acharia que há um telão conectado.

Junto veio uma correção do mesmo lote: o guard do `renderCast` usava
`offsetParent === null` para saber se o bloco estava aparecendo, e
`.popup-backdrop` esconde por **opacidade**, não por `display` — a guarda
nunca barrou nada. Perguntar por ESTADO (`.open` / `hidden`) funciona nas duas
casas do bloco.

**E o pente propriamente dito**, com a régua que a v5.194 estabeleceu — cai o
que repete o rótulo, fica o que diz uma consequência que o rótulo não implica:

- **Os três destinos perderam o subtítulo.** Playlist, Cronograma e Favoritos
  são NOMES DE ABA deste app; escrever embaixo de cada um o que ele é ("A
  lista do culto") é explicar a própria navegação para quem já está navegando
  nela — e era metade da altura da folha.
- **"Tocar agora" MANTEVE o dele**, e é o contraste que mostra a régua: ele é
  o único que não guarda nada, e isso o rótulo não diz ("Sem entrar em lista
  nenhuma"). No caminho de só-áudio o que ele não diz é outra coisa ("Sem
  mexer no telão").
- **"Instrumental, sem a voz"** saiu: playback é o termo que o app usa em toda
  parte, inclusive no seletor Cantada/Playback, que nunca teve explicação.
- **"Sem música e sem passagem automática de slides"** virou "Os slides não
  passam sozinhos" — a primeira metade repetia "Apenas a letra".
- **A linha de confirmação parou de listar os destinos escolhidos**: eles são
  as caixas marcadas, visíveis a três linhas dali. O contador responde
  "quantos?" sem repetir "quais?".
- **O cartão de conectar do Modo Fácil ficou só com o estado.** Ele tinha três
  frases de instrução ("Toque para escolher a tela") que repetiam o rótulo e o
  ícone ao lado — e, desde a v5.193, ele só existe COM tela conectada.
- **"Hinários e álbuns"** saiu do cartão de buscar: não há segunda busca neste
  modo para escolher entre elas.

---

## v5.194

**A v5.194: A FOLHA DE CONECTAR PERDE TRÊS QUARTOS DO TEXTO. OTA PURO.**
Relato do operador: "extremamente poluído e repetido e pouco claro".

Contado, ele estava certo por um fator de quatro. Para DUAS decisões
(espelhar para a TV × transmitir pela rede) a tela trazia: um subtítulo
explicando o que é espelhamento, outro explicando o que é a transmissão, uma
frase mandando abrir o endereço no navegador, uma mensagem de sucesso
mandando a mesma coisa, e — atrás de "Ajustes avançados" — dois parágrafos
dizendo tudo pela quarta vez. **Cinco formas de dizer "abra o endereço no
navegador".**

- **Os subtítulos saíram.** Eles descreviam o recurso para quem já tinha
  decidido usá-lo: ninguém abre "Conectar uma tela" para aprender o que é
  Smart View. O do interruptor era pior — ligado, ele dizia "N tela(s)
  recebendo", que é exatamente o que a LISTA logo abaixo mostra, com nome e
  tempo de cada uma.
- **A instrução virou o RÓTULO do endereço** ("Acesse este endereço no
  navegador"). Era uma linha separada abaixo dele, em duas versões que
  trocavam as palavras de lugar conforme houvesse ou não uma tela conectada. O
  "toque em Ativar esta tela" saiu junto: quem precisa dessa instrução está NA
  OUTRA TELA, e lá ela está escrita no botão — que é onde ela serve.
- **"Abre: Smart View" saiu do botão de espelhar.** Ninguém escolhe entre dois
  caminhos pelo NOME do seletor que vai abrir; quando o botão abre a tela
  errada, a resposta está no Registro, que é o que se copia para diagnosticar.
  O dado continua lá.
- **Os dois parágrafos dos ajustes viraram uma frase** — e eles ainda mandavam
  **digitar o código de três dígitos**, que saiu na v5.189. Texto grande é
  também texto que ninguém revisa. Ficou o que o operador não tem como
  adivinhar e que muda o que ele faz: o roteador pode bloquear isto sozinho, e
  há duas coisas que de propósito não vão para a rede.
- **O sucesso deixou de ter frase.** O endereço aparecendo, com o rótulo que
  diz o que fazer com ele, É o "deu certo". A falha continua falando, porque
  ali não há nada que apareça sozinho.

---

## v5.193

**A v5.193: CINCO AJUSTES DE USO, e um deles é a QUARTA correção do mesmo
mecanismo. OTA PURO** (nenhuma linha de Kotlin; sem Release).

- **O carrossel de abas parou de ignorar a navegação interna.** A guarda mais
  larga que ele tinha era "qualquer SUB-TELA" (botão voltar visível), sob o
  argumento de que ali o eixo horizontal pertence à navegação de dentro.
  Medido, o argumento é falso: com um capítulo da Bíblia aberto — o estado
  normal de quem usa a Bíblia num culto — NADA disputa o eixo horizontal
  (`.bible-half` rola só na vertical, e a folha declara `touch-action: pan-y`
  nela desde a v5.188). Pior, a própria `.bible-half` estava na lista de
  exclusão, proibindo um gesto que ela libera. Esta é a quarta correção deste
  mecanismo, e as três anteriores erraram do mesmo jeito: **mantendo à mão a
  lista do que o eixo não pode atravessar**. Agora a pergunta é medida — entre
  o alvo e a superfície que escuta, existe alguém que de fato ROLE na
  horizontal (`scrollWidth`, `overflow-x`)? Um trilho cheio responde sim; o
  mesmo trilho com três pílulas responde não, e nos dois casos a resposta é a
  verdadeira em vez da que alguém digitou meses atrás. `tools/smoke.mjs` trava
  as duas metades com toque de verdade (CDP) — e o contra-teste só vale porque
  o positivo passa: sem `hasTouch` no contexto, o toque não chega e os dois
  casos "passariam" por não medir nada.
- **Quem está conectado saiu de Configurações.** O rodapé daquela folha dizia
  "Telão conectado: X" e "Espelhar abre: Y" — as duas coisas que a folha de
  "Conectar uma tela" já diz, no lugar em que se decide sobre elas e só quando
  há o que dizer. Estado repetido em duas telas é a mesma classe de
  divergência que a paleta única existe para não ter. O Registro continua com
  as duas linhas, agora lidas de DADO e não do DOM: um diagnóstico que depende
  de um elemento de UI existir emudece no dia em que alguém o esconde.
- **O Modo Fácil sem tela mostra a SEÇÃO DE CONEXÃO, não um botão que a
  abre.** Havia ali um botão do tamanho da tela cujo único efeito era abrir a
  folha — um toque cobrado para chegar às duas escolhas que cabem na própria
  tela bloqueada. O bloco é o MESMO nó, movido entre a folha e a tela
  (`hostCastConn`, o padrão do `hostPreview`), porque duas marcações para a
  mesma decisão divergem no primeiro ajuste. Junto vieram duas correções que
  o pedido do operador expôs: **o bloqueio passou a contar as telas da REDE**
  (desde a v5.187, sem TV elas SÃO a projeção — o bloqueio não tinha
  acompanhado, e quem ligava a transmissão continuava atrás da cortina), e a
  folha **fecha sozinha quando alguma tela conecta**, por qualquer um dos dois
  caminhos. A liberação de teste de 5 s mudou de dono: ela vivia no botão que
  deixou de existir no estado bloqueado, isto é, sumia justamente de onde
  servia — agora é o toque longo na própria cortina.
- **O Modo Fácil não faz manutenção de álbum.** Peso, "Completo offline",
  "Verificar atualizações" e "Remover do dispositivo" respondem perguntas de
  quem ADMINISTRA o acervo; quem está no Modo Fácil procura um louvor para
  tocar agora. Some a INFORMAÇÃO e fica a AÇÃO — o botão de baixar (que
  durante um download é o CANCELAR) permanece. Por CSS, não por um ramo no
  construtor do card: a classe mora no `<body>` e o operador troca de modo com
  a lista já montada.
- **A entrada da tela da rede veste o app.** Ela nasceu na v5.189 como um
  botão de estilo inline com fallbacks escritos à mão — inclusive um
  `var(--accent-fill, #8a6d1d)` cujo valor de emergência é o âmbar que a
  v5.192 aposentou (invisível, porque o token resolvia). Mas o problema maior
  era o que a tela É: a PRIMEIRA coisa que alguém vê num televisor da igreja,
  e ela mostrava um botão solto num retângulo escuro sem dizer de que sistema
  era. Agora veste o wallpaper do telão (o símbolo oficial, fonte única), diz
  o nome do sistema e o que o toque faz, e usa a anatomia dos botões
  principais do app.

**E uma armadilha que mordeu de novo, com a resposta já escrita no arquivo:**
o bloco de conexão ganhar uma segunda casa fez o `setAppMode` do fim do
`controle.js` — que roda durante a carga do módulo — alcançar o `renderCast`,
que lê `mirrorOcupado`, declarado 14 mil linhas abaixo. Zona morta temporal,
`ReferenceError` na carga, página inteira morta. O comentário do `mirrorEstado`
já contava essa história uma vez (v5.184) e o `smoke.mjs` a pegou nas duas.
A regra fica: **estado lido por qualquer caminho de render nasce no topo**,
junto do resto do estado de cena.

---

## v5.192 (APK v1.89)

**A v5.192 (v1.89): A PALETA VIRA A IDENTIDADE OFICIAL DA IASD, E O APP GANHA
TEMA CLARO. METADE OTA, METADE APK.** Pedido do operador: um tema claro e um
escuro trocáveis em Configurações, padronizados pelas cores oficiais da
identidade visual adventista — a mesma fonte de que saiu o símbolo do
wallpaper na v5.188.

- **O âmbar sai, e ele nunca foi oficial.** A v5.47 o adotou como "a marca
  IASD" por um argumento de CONTRASTE: a paleta azul anterior usava UM valor
  para os dois papéis (fundo preenchido e texto), e é esse par que reprovava —
  não o azul. A saída certa era separar os papéis, que é o que
  `--accent`/`--accent-fill`/`--on-accent` já fazem. Com eles no lugar, o
  **denim `#2F557F`** (PMS 302, o núcleo da identidade) entra como
  preenchimento verbatim, com 7,70:1 contra o branco que a própria identidade
  recomenda por cima, e o `bluejay` clareado vira o accent de texto do tema
  escuro (5,86:1 sobre o painel). `scarlett` é o vermelho de atenção,
  `campfire` o aviso, `treefrog` o concluído, `night`/`winter` os neutros.
- **Nem todo token é oficial, e os derivados estão marcados.** Os dezoito
  valores foram desenhados para fundo BRANCO — todos passam AA sobre branco, e
  NENHUM passa como texto sobre o quase-preto do tema escuro. Onde clarear (ou
  escurecer, no claro) foi preciso, `tokens.css` diz de qual oficial o valor
  saiu e preserva a matiz. Nos ladrilhos da Bíblia a conta é estrutural: a
  identidade tem SETE famílias de matiz e a tela de livros precisa de DEZ
  grupos separados por ≥20°, então cinco são oficiais e cinco preenchem os
  vãos — e o `scarlett` fica FORA da escala de propósito, porque vermelho é
  atenção neste app e um grupo de livros vermelho competiria com "está no ar".
- **O PALCO NÃO TEM TEMA, e é isso que faz o recurso valer.** `--stage-*`,
  `--wallpaper`, `--lyrics-frame-bg` e as sombras foram para um bloco
  compartilhado. O Display já ficaria escuro por omissão (ele nunca escreve o
  atributo); o que a separação garante é a PREVIEW do Controle, que roda no
  documento que TEM tema e existe para ESPELHAR o telão. Um telão claro cega a
  congregação, e uma preview clara deixaria de cumprir seu papel exatamente no
  tema em que o operador mais precisa dela.
- **O que o shell faz, e é só isto** (`temaClaro`, `SHELL_VERSION` **39**):
  os ÍCONES das barras de sistema e o `windowBackground`. As duas coisas que
  uma folha de estilo não alcança — com `targetSdk` 35 o Android ignora as
  CORES das barras (quem as pinta é o body, com o token), mas o relógio e os
  botões de navegação continuam sendo desenhados pelo sistema e ficariam
  brancos sobre branco; e o `windowBackground` é um recurso do APK, resolvido
  antes de existir JavaScript, então o shell guarda uma cópia da escolha e a
  aplica no lançamento seguinte. **Trocar de tema tem, portanto, um lançamento
  de atraso no fundo do splash — e só nele.** Num shell 38 o bundle novo
  funciona por inteiro e o app fica com as barras do escuro: é a degradação
  certa, e por isso `minShell` continua em 2.
- **E a v1.90 conserta o que a v1.89 derrubou: o app não abria.**
  `window.insetsController` é, no `PhoneWindow`, um
  `mDecor.getWindowInsetsController()` **sem verificação de nulo**, e o
  `mDecor` só nasce no `installDecor()` — isto é, no `setContentView()`. O
  tipo devolvido é anulável, então o `?.` do Kotlin dá a impressão de que a
  chamada é segura; ela não é, porque **quem lança é o RECEPTOR, não o
  retorno**. Chamada de um `onCreate` antes do `setContentView`, ela era uma
  `NullPointerException` em todo lançamento, com qualquer tema. Três coisas
  fecham o caso: a leitura da preferência e o `setTheme` passaram para ANTES
  do `super.onCreate` (é o único momento em que `setTheme` ainda pinta o
  `windowBackground`, e agora existe um `Theme.AvIasd.Claro` para ele
  apontar), o resto foi para DEPOIS do `setContentView`, e o
  `aplicarCromoDoTema` ganhou a guarda exata — `window.peekDecorView()`, que
  pergunta se a decor view existe sem CRIÁ-la, ao contrário do `decorView`.
  A lição para o próximo: **o CI compila e roda JUnit, não a Activity** — um
  erro de ciclo de vida atravessa build verde, teste verde e Release, e só
  aparece no aparelho.
- **Dois oráculos ficaram mais fortes.** `tools/tokens.test.mjs` passou a
  ignorar COMENTÁRIOS (um `var(--x)` citado na prosa que justifica a regra não
  é um uso) e ganhou um caso novo: **nenhum token pode existir só no tema
  claro**. O claro é um DELTA sobre o escuro, e um token declarado só lá não
  estaria definido no tema padrão — o `var()` computaria para o valor inicial
  da propriedade, sem aviso, e quem escreveu acabaria de ver a cor certa na
  tela porque estava com o claro ligado. `tools/smoke.mjs` trava o efeito
  RENDERIZADO: os dois temas mudam fundo e texto, o palco não muda uma
  vírgula, a superfície afunda dentro do cartão NOS DOIS, e a escolha
  sobrevive à recarga.

---

## v5.191

**A v5.191: O DOWNLOAD PASSA A TER SAÍDA — e a intenção deixa de ressuscitar.
OTA PURO.** Dois relatos do operador, e o segundo é o mais caro.

- **"A notificação sobre o preview não tem forma de cancelar."** Verdade, e
  pior do que parecia: dos TRÊS lugares que mostram um download em curso, só
  a linha do resultado da busca sabia cancelar (v5.131) — e ela é justamente
  a que some quando o operador fecha a busca. O cartão sobre a preview e a
  linha provisória do Cronograma mostravam minutos de download sem oferecer
  saída nenhuma. Agora os dois têm botão, alimentados pela MESMA alça
  (`cancelarDownload`, um núcleo só para os três pontos de toque).
- **"Mesmo depois de fechar o app, e o vídeo já não indo para o player, ele
  fica sempre querendo baixar."** Era o resgate de intenção da v5.133 comendo
  a própria cauda: o `ytArquivo` REGISTRA a intenção ao começar, então cada
  resgate interrompido registrava outra, e o ciclo se repetia por seis horas.
  Três regras o fecham, e são a mesma do coletor de lixo do banco — **o que
  não está em lugar nenhum não é guardado**, aqui nem baixado: intenção sem
  destino VISÍVEL (`imports`/`playlist`/`favs` — a prateleira `avulsos` do
  "Tocar agora" não conta) é descartada e o download é CANCELADO no aparelho;
  há um teto de duas reclamações por intenção; e o cancelamento manual
  esquece a intenção, sem o que "parei o download" durava até o operador
  fechar o app.
- **E o resgate deixou de ser invisível**: ele nascia com `aviso: 'nenhum'`,
  isto é, dez minutos de download sem nada na tela e sem nada para tocar.
  Agora ele desenha a linha provisória na lista de destino — que é onde o
  botão de cancelar mora.

---

## v5.190 (APK v1.88)

**A v5.190 (v1.88): UM CARTÃO SÓ NA GAVETA — a transmissão passa a viajar no
serviço da sessão de mídia. EXIGE APK, e é Kotlin puro.**

Pergunta do operador: *"essa notificação pode ser mais útil com mais
ferramentas e botões? ou melhor ainda, fixar essa atividade à notificação de
player que já acontece durante uma reprodução?"* — e a resposta é sim, com um
ajuste de escopo que vale registrar.

- **O que NÃO dava para fazer: mais botões.** O `MediaStyle` mostra 3 no modo
  compacto e até 5 no expandido, e o cartão já tinha exatamente 5 (⏮,
  play/pause, ⏭, Parar, cortina). Desde o Android 13 quem os desenha é o
  `PlaybackState`, não a notificação — a cicatriz da v1.18. Acrescentar ali é
  TROCAR, não somar.
- **O que dava, e é o pedido de verdade: um cartão só.** Num culto com
  transmissão ligada e mídia no ar a gaveta mostrava DOIS cartões do mesmo
  app — o player e o "Espelho no ar" —, e só um servia para alguma coisa. O
  `EspelhoService` deixou de existir: o `SessionService` virou o ÚNICO serviço
  em primeiro plano do culto, com o tipo `mediaPlayback|connectedDevice`
  (nenhum dos dois tem cota) e **duas razões independentes de viver** — cena
  no ar e transmissão ligada —, parando só quando as duas caem.
- **O cartão tem DUAS CARAS.** Com cena, o player de sempre. Sem cena e com a
  transmissão no ar, o endereço, quantas telas estão recebendo e o botão
  **Desligar transmissão** — que só aparece aí, e de propósito: ao lado do
  transporte, no escuro, ele seria um toque errado derrubando a projeção da
  igreja inteira. Sem cena não há transporte a mostrar, e sobra o espaço
  exato para ele.
- **A regra que isto desafia continua valendo, agora por escrito.** O KDoc do
  serviço antigo dizia "empilhar dono é o caminho para o cartão eterno", e
  estava certo: a fusão só é legítima porque a condição de parada virou um
  `if` explícito num lugar só (`pararSeNadaVivo`), com o `running`, o
  `foregrounded` e o `stopSelf(startId)` intactos. E sem cena a sessão de
  mídia é ZERADA (`STATE_NONE`), senão o sistema promoveria um player
  fantasma ao painel das configurações rápidas.
- **`EspelhoEnergia`** é o que sobrou do serviço: wake lock, Wi-Fi lock e
  térmica — as três coisas que nunca foram sobre notificação. Os canais
  `espelho`/`espelho2` são apagados na subida, para não ficar um interruptor
  órfão nas configurações de notificação do app.

`SHELL_VERSION` **não sobe**: nenhum método da ponte nasceu, saiu ou mudou de
assinatura, e o `espelhoDiag` mantém a mesma FORMA (o campo `servico` passou a
responder "o serviço que carrega a proteção está de pé?", que é o que ele já
queria dizer). A base web não mudou uma linha — a versão sobe junto só para o
rodapé de Configurações não mentir sobre o que está instalado.

---

## v5.189 (APK v1.87)

**A v5.189 (v1.87): A SEGUNDA RODADA EM APARELHO — a porta abre, o YouTube
volta a transmitir e a preview emudece. EXIGE APK.**

- **"Tocar direto um link do YouTube não funciona, ele sempre baixa."** Era
  a política que a própria v5.187 escreveu: `pularTransmissao = espelho
  ligado && sem telão` — e transmissão ligada sem TV é o estado NORMAL do
  operador, então o recurso inteiro parou de acontecer. O motivo era real (o
  manifesto aponta para `/stream/` no origin do WebView, que a tela da rede
  não alcança), e a saída não foi relaxar a guarda: foi **tirar-lhe a razão
  de existir** fechando a dívida §7 do contrato. O servidor passou a servir
  as mesmas faixas em **`/s/<token>`** — um REPASSE ao googlevideo (o
  `Range` do cliente sobe cru, a resposta é espelhada de volta), com o UA que
  combina com a URL, o mesmo registro de token do `StreamProxy` e nenhuma
  segunda extração. O `telaEnriquecer` reescreve o manifesto para a tela.
- **A ENTRADA DA TELA PERDEU O CÓDIGO.** Argumento do operador: cada tela
  precisa do ENDEREÇO deste aparelho nesta rede para chegar aqui, e esse
  endereço já é a credencial — quem não configurou a tela não o tem. O
  overlay virou **um botão só, "Ativar esta tela"**, que gasta o gesto
  (tela cheia + som) e entra. O que segura o recurso continua sendo o teto de
  três sessões e o "Desconectar" do operador (com o castigo de 2 min, sem o
  qual o botão não faria nada visível). Saíram do `EspelhoPares`: o código,
  a rotação, o bloqueio crescente e o contador de recusas — e com eles os
  casos de JUnit que os cobriam, porque o que eles cobriam deixou de existir.
- **A TELA VOLTA A FICAR EM TELA CHEIA SEM RECARREGAR.** Sair da tela cheia
  é um toque na tecla errada de um controle remoto, e até aqui o único ponto
  do sistema que chamava `requestFullscreen` era o botão de entrada. Agora um
  botão discreto de canto aparece quando FALTA tela cheia (ou som), se
  recolhe em 5 s e volta com um toque — e o TOQUE DUPLO em qualquer lugar faz
  a mesma coisa, que é o gesto que todo mundo tenta primeiro num vídeo.
- **A QUEDA DE CONEXÃO NÃO COBRE MAIS A MÍDIA.** O overlay de reentrada
  aparecia por cima do louvor que continuava tocando — e continuava mesmo:
  a mídia da tela é LOCAL (o `<video>` toca o arquivo do `/m/`) e **a letra
  sincronizada anda pelo `timeupdate` dela**, não por comando, então a queda
  leva o fio e nada mais. Sem código a digitar, a reentrada não precisa de
  gente: virou um `POST /par` numa escada (1 s → 30 s), silencioso. O overlay
  cheio só existe na PRIMEIRA carga, quando não há nada por baixo dele.
- **A MESA DE SOM SAIU POR INTEIRO.** O som do sistema é o dos displays (a
  TV pela Presentation, as telas da rede pelo `<video>` delas), e o áudio da
  preview só tinha como disputar o foco de áudio do Android com a projeção —
  o defeito que a v5.141 já contornara escondendo o botão com telão
  conectado. Com o modo, saíram o botão, o `standalone`, o
  `AVNative.keepAudioAlive` e o `setAudioAlive` do shell (um método de ponte
  sem chamador é dívida).

`SHELL_VERSION` **38**: o degrau é um ENCOLHIMENTO duplo — `espelhoEstado`
perdeu `codigo` e a ponte perdeu `keepAudioAlive`. A rota `/s/` não pesa nele
(é do servidor HTTP, não da ponte).

---

## v5.188

**A v5.188: A PRIMEIRA RODADA EM APARELHO DO TELÃO POR COMANDOS — três
relatos, uma identidade. OTA PURO** (nenhuma linha de Kotlin; sem Release).

- **"O carrossel na Bíblia não funciona, e depois as abas exigem DOIS
  toques."** As duas frases são UM defeito, e ele é a lição da v5.61 pela
  terceira vez: `.bible-half` rola sem `touch-action: pan-y`, então o
  WebView tomava o gesto horizontal para si e o fling residual engolia o
  toque seguinte — reproduzido em Chromium com toque real (CDP), não
  deduzido. E havia uma segunda metade de desenho: com um livro aberto (o
  estado normal de quem usa a Bíblia), a guarda de sub-tela matava o
  carrossel até NA FAIXA DE ABAS, onde o eixo horizontal não pertence a
  ninguém além dele — a faixa agora é sempre território do carrossel
  (`tabsEl.contains(target)` em `elegivel`).
- **"O telão não herdou o papel de parede."** O `__wp` só viajava na TROCA:
  quem conectasse depois ficava no padrão para sempre. O `display-ready` de
  uma tela (`__tela`) agora dispara `telaReenviarPreferencias` — wallpaper
  (token REUSADO; o funil não re-cunha comando que já chega com `__wp`),
  `lyricsbg` e `fit`, tudo ENDEREÇADO (`__para`). A remoção viaja como o
  sentinela `__wp:'padrao'` (anexar URL antes de saber se havia blob cunhava
  uma URL sem bytes), e a tela pré-carrega com retentativa curta — o
  comando pode vencer a corrida contra o empurrão dos bytes.
- **"As imagens de fundo dos slides das músicas não aparecem."** Era a
  exclusão declarada da E4.1, agora fechada: cada estrofe com
  `imageOpfsPath` ganha `imageUrl` (`/m/` por imagem DISTINTA, id estável
  `ly:`+caminho — o mesmo hino de novo custa zero re-empurrão), enfileirada
  DEPOIS da mídia principal (o som não espera as fotos), e o
  `applyLyricsImage` do display aceita a URL direto, com retentativa.
- **E o WALLPAPER PADRÃO virou o símbolo oficial da IASD** (pedido do
  operador, com o pacote oficial de SVGs em mãos): branco, cor sólida
  única, sobre denim profundo — as regras do identity.adventist.org. O
  desenho inteiro é UM arquivo (`shared/wallpaper-padrao.svg`), fonte única
  do Display, da preview e das telas da rede; a marca de texto
  "Audio Visual IASD" saiu com o gradiente verde da paleta antiga. No
  seletor, "Padrão" foi para a ESQUERDA. Duas armadilhas ficaram escritas
  nos arquivos: `url()` substituído por `var()` resolve contra a PÁGINA
  (a URL do SVG mora nas folhas consumidoras, não no token), e comentário
  de XML não aceita hífen duplo (um `--token` citado invalida o SVG
  inteiro, sem erro nenhum).

Detalhes por seção: o carrossel em `docs/ARQUITETURA-WEB.md` (deslizar
troca de aba), o wallpaper em "Wallpaper personalizado" (mesmo doc), e as
duas dívidas fechadas no `docs/TELAO-POR-COMANDOS.md` (nota v5.188).

---

## v5.187 (APK v1.86)

**A v5.187 (v1.86): O TELÃO POR COMANDOS SUBSTITUI O ESPELHO DE PIXELS POR
INTEIRO. EXIGE APK — e a primeira ligada em rede de verdade é numa
terça-feira.** Pedido do operador, literalmente: *"não gostei do sistema que
usamos hoje, acho muito inconstante. Vamos trocar absolutamente todo o
sistema para o command stream."*

A tela da rede deixou de receber PIXELS (VirtualDisplay → MediaCodec H.264 →
fMP4 → MSE) e passou a rodar **o próprio `/web/display/`**, servido pelo
celular com a mesma resolução OTA→APK, recebendo **os comandos do barramento
verbatim por SSE** e a **mídia sob demanda por `/m/<token>`** (Range RFC 7233
de verdade — a inversão da invariante 8, agora com oráculo próprio). Todo o
mapa está na seção "Telão por comandos" e no contrato
`docs/TELAO-POR-COMANDOS.md`; o doc do espelho ficou como histórico, com o
aviso de aposentadoria no topo.

O que SAIU do repositório, de uma vez: `EspelhoCodec.kt`, `EspelhoDisplay.kt`,
`EspelhoAudio.kt` (e o JUnit da deriva), `MirrorPresentation.kt`, o
`fmp4.js`, o `cliente.js`, a página própria do espelho e os testes
`fmp4.test.mjs`/`espelho-cliente.test.mjs` — mais ~600 linhas de maquinaria
de pixels dentro do `EspelhoServidor` e o dreno do papel `espelho` no
`native.js` (o dreno novo, de SUBIDA, mora em `espelho/tela.js`). Com eles
saíram por construção as famílias inteiras de defeito do §10-A: deriva de
áudio, GOP × janela, poda de MSE, borda ao vivo, batimento.

O que ENTROU: `EspelhoMidiaCache.kt` + `EspelhoMidiaCanal.kt` (o cache da
rota `/m/` e o empurrão OPFS → cache por `ArrayBuffer`), o Range/SSE no
`EspelhoHttp` (puro, com JUnit), `espelho/tela.js` (a casca do papel `tela`,
carregada no próprio display), o enriquecimento `__rec` + a eleição de
referência no `controle.js`, e `tools/tela-rede.test.mjs` (26 casos em
Chromium de verdade, do código de entrada ao adeus). `SHELL_VERSION` **37**
pela mudança de FORMA do `espelhoEstado`/`espelhoDiag`; o canal de mídia é
detectado por presença. Exclusões declaradas do lote (dívida dita, não
esquecida): prefetch de playlist, imagem de fundo da letra e páginas de deck
não são empurradas ainda (a tela mostra a mídia principal e a letra sem o
fundo), e a rota `/stream/` do proxy não é servida às telas — YouTube sem
telão vai pelo download.

---

## v5.186 (APK v1.85)

**A v5.186 (v1.85): A ENTRADA VIRA UM CÓDIGO DE TRÊS DÍGITOS, e o `av.local`
sai. EXIGE APK — é a maior remoção de superfície da história do projeto.**

O pedido do operador, literalmente: *"vamos remover o uso do endereço com o
localhost, vamos usar apenas o endereço que usa IP. Vamos usar o sistema de
código na página web, um código de 3 dígitos, gerado quando se ativa a
disponibilidade online. E na web, teremos apenas o campo de digitar o código e
o botão de Conectar, pois assim o botão de conectar já vai fazer a função de
liberar o áudio e colocar em tela cheia."*

**A última frase é a que governa tudo o mais.** `requestFullscreen()` e sair do
`muted` exigem *ativação transitória do usuário*, e um gesto vale por poucos
segundos. Para o botão "Conectar" fazer as três coisas, ele precisa gastar o
gesto ANTES de a rede responder — e isso torna impossível qualquer fila de
aprovação: quando o operador aprovasse, o gesto já teria passado, e a tela
entraria muda e em janela, com alguém tendo de atravessar o salão para tocar
nela. Daí a cascata de remoções, e nenhuma delas é oportunismo:

- **a fila de aprovação** (`Pendencia`, `aprovar`, `recusar`, `consultar`,
  `pendentes`, a aprovação automática) — código certo ENTRA, na mesma
  resposta;
- **a porta aberta da v5.170** (`entrarAberto`) — agora há um código, e ele é
  exigido; isto é mais forte que a v5.170, não mais fraco;
- **o pareamento por QR inteiro** (`esperaQr`, `espelho/qr.js`,
  `tools/qr.test.mjs`, o leitor de câmera do Controle, `AVNative.requestCam` e
  a permissão `CAMERA` do manifest) — ele existia para INVERTER quem mostra e
  quem lê o segredo, e a inversão perdeu a razão de ser quando o segredo virou
  três dígitos que a TELA digita;
- **o responder mDNS** (`EspelhoMdns.kt`, `EspelhoMdnsPacote.kt` e o JUnit
  dele) — `av.local` não resolve no Chrome do Android nem na maioria das Smart
  TVs, que são exatamente as telas deste recurso, então o IP sempre foi o
  endereço que de fato funcionava.

**O que SUSTENTA três dígitos não é o tamanho, é o bloqueio CRESCENTE** por
origem: 60 s dobrando a cada bloqueio novo, até 30 min. Com um minuto fixo,
mil combinações saem numa tarde; dobrando, a sétima rodada custa mais que o
culto. O contador de bloqueios **não zera quando o bloqueio vence** (quem
esperou e voltou a martelar é quem a rodada seguinte precisa segurar), e zera
inteiro na primeira tentativa CERTA. Mais o teto de três sessões, mais o fato
de o conteúdo ser o que a congregação já está vendo.

**`CHANGE_WIFI_MULTICAST_STATE` FICA no manifest mesmo sem o mDNS**, e isso
precisa estar escrito porque a leitura natural é o contrário: quem a exige não
é o multicast, é o TIPO do serviço em primeiro plano (`connectedDevice`).
Removê-la faz `startForeground` lançar e derruba o app no instante em que o
operador liga a transmissão.

`SHELL_VERSION` vai a **36** — o primeiro degrau deste contrato que ENCOLHE.

---

## v5.185 (APK v1.84)

**A v5.185 (v1.84): O EIXO DO SOM ERA UM LAÇO ABERTO — "o som fica para trás,
a imagem continua, a tela fica sem áudio". METADE APK.** As três frases do
relato não são três sintomas: são a sequência inteira de um defeito só, e a
última é literalmente o que o `cliente.js` escreve
(`soltarAudio('o som ficou para trás')`).

**Os dois eixos são de naturezas diferentes por desenho** — o vídeo é relógio
monotônico e anda sozinho; o som é CONTAGEM DE AMOSTRAS e só anda quando chega
PCM. O que faltava é o que fecha isso: **nada, em lugar nenhum, conferia uma
coisa contra a outra.** Três produtores de deriva, todos reais, todos
permanentes e todos ACUMULATIVOS: o `AudioWorklet` engasgando (os três
WebViews dividem UM processo — é o fio que a v5.177 documenta sendo roubado),
o relógio do hardware de áudio (dezenas a centenas de ppm são décimos de
segundo por hora, e um culto tem duas), e **PCM perdido dentro do
`alimentar`** — este um defeito de verdade: a regra "o que não coube CONTA
assim mesmo" estava escrita e aplicada em `aoReceberPcm`, e **faltava em cinco
saídas** daquela função, cada uma recuando o eixo permanentemente.

E o desfecho tinha um segundo andar, que é o que transforma "dessincronizado"
em **mudo**: soltar a faixa **não desfaz a deriva**, porque ela está no
celular. A tela remontava, `vigiarAudio` media o MESMO desvio no primeiro giro
e soltava de novo — três vezes em poucos segundos, o teto de remontagens se
esgotava, e renová-lo exige 45 s de som limpo que nunca iam acontecer.

- **No shell (APK)**: `EspelhoAudio.corrigirDeriva` fecha o laço. Abaixo de
  250 ms não mexe em nada (a chegada dos blocos tem jitter próprio, e corrigir
  20 ms a cada bloco trocaria uma deriva por um serrilhado); daí até 3 s
  **insere SILÊNCIO**, que não é reancoragem — o eixo continua sendo contagem
  de amostras, o `buffered` continua colado e o muxer não estica amostra
  nenhuma; acima de 3 s **reancora**, e o limiar não é escolhido: é o
  `AUDIO_MUDO_MS` do cliente, isto é, o ponto em que a tela já soltou a faixa e
  não há continuidade a preservar. **A medida é contra o PCM RECEBIDO, nunca
  contra o consumido** — entre os dois há uma fila de até 64 × ~40 ms, e medir
  do lado do encoder leria um engasgo da main thread como "o som parou de ser
  produzido", enchendo de silêncio um buraco que os blocos empilhados fechariam
  sozinhos e jogando o som À FRENTE do vídeo. Que é o único erro que este
  desenho não tem como desfazer, porque a correção para trás é rebobinar o
  `tfdt`.
- **No web (OTA)**: `voltouOSom` não remonta enquanto o fio ainda mostrar o som
  mais de 1,5 s atrás. Ela não conserta a deriva — impede que os três créditos
  de remontagem sejam queimados ANTES de a correção chegar. `vigiarAudio` não
  servia para isso: ele mede `bv.end - ba.end`, e com a faixa solta não existe
  `ba`; os carimbos crus do fio existem sempre (`desvioDoFio`).
- **E o Registro ganhou a linha que faltava o tempo todo**: `som atrás do
  vídeo: agora N ms · pior M ms`, com as correções e o silêncio inserido. Até
  aqui "o som ficou para trás" era escrito pela TELA e o lado do celular não
  tinha UMA medida que o confirmasse — o operador via `24 blocos de PCM/s`,
  `7424 quadro(s)`, `0 descarte(s)`, tudo saudável, e uma tela muda.

`SHELL_VERSION` **não sobe** — nenhum método da ponte nasceu nem mudou de
assinatura. Num shell antigo `derivaMs` vem `undefined` e a linha do Registro
não é desenhada, como manda a regra do bloco. A regra pura
(`EspelhoAudio.planoDeCorrecao`) tem JUnit, pelo motivo de sempre: o resto do
arquivo é `MediaCodec` e threads, e é a REGRA que decide se o culto fica com
som. Ver `docs/ESPELHO-DE-PIXELS.md` §10-A.13.

---

## v5.184

**A v5.184: A FOLHA DE CONECTAR LIGAVA O SERVIDOR PARA PODER MOSTRAR O
ESTADO — e isso é uma falha de FORMA, não de código. OTA PURO.** As duas
maneiras de conectar eram o mesmo cartão de escolha, e um cartão não sabe
dizer "ligado": daí o `abrirCast` da v5.171 subir um `ServerSocket` na rede da
igreja pelo simples fato de alguém ter aberto a tela para ler o endereço.
Agora são **um botão** (a ação, que sai do app) e **um interruptor** (o
estado, que dura o culto), com os dois endereços de acesso embaixo — e abrir a
folha voltou a ser só ler. Vieram junto três defeitos que a redação achou pelo
caminho, e os três estavam calados: a folha nunca era redesenhada pela enquete
de 2,5 s (uma tela que entrasse depois da abertura não aparecia), os dois
endereços tinham pesos tipográficos opostos ao que vale na prática, e **três
ícones desta UI nunca chegaram a existir na fonte** — codepoint no cmap,
contorno vazio, um vão do tamanho de um ícone e nenhum tofu que o denunciasse.
A seção do espelho tem os cinco itens, e `docs/ESPELHO-DE-PIXELS.md` §10-A.12
tem o porquê de cada um.

---

## v5.183 (APK v1.73)

**A v5.183 (v1.73): AS TRÊS DE REDE — a metade que faltava, e a mais
arriscada. EXIGE APK, e exige ser ligada NUMA TERÇA-FEIRA.** Ela mexe no
único código do projeto que decide **se o socket sobe e onde**.

- **TODA DECISÃO DE REDE PERGUNTAVA PELA REDE PADRÃO.** `getActiveNetwork()`
  é, por definição, a rede por onde o tráfego geral sai. Numa igreja com o AP
  no ar e o link de internet fora — que este documento descreve como o
  ambiente normal —, o Android marca a Wi-Fi como não validada e promove a
  **celular** a padrão, porque dados móveis estão ligados (o download do
  YouTube depende do IP do chip). O preço era duplo e silencioso: o operador
  tocava em "Mostrar numa tela da rede" e lia *"so liga em Wi-Fi — este
  aparelho esta em dados moveis"* com o celular associado à Wi-Fi e o IP na
  mão; e, com o espelho já no ar, a troca de padrão **derrubava a projeção
  inteira com a LAN intacta e o socket funcionando**. A §2.5 promete o oposto,
  com todas as letras. Agora a pergunta é "existe uma Wi-Fi neste aparelho?"
  (`wifiDe`), e o `registerDefaultNetworkCallback` virou um
  `registerNetworkCallback` de `TRANSPORT_WIFI`. **`NET_CAPABILITY_VALIDATED`
  fica DELIBERADAMENTE fora do filtro** — é justamente ele que falta numa
  igreja sem uplink, e exigi-lo seria reintroduzir o defeito com outro nome.
  A propriedade da §2.3 fica intacta: o socket segue ligado a um IPv4 de rede
  Wi-Fi, nunca em `0.0.0.0`, e VPN e celular seguem recusados — mas **a regra
  1 da §2.3 ("rede ativa") precisa ser relida como "rede Wi-Fi"**, senão a
  próxima leitura reintroduz isto. `getAllNetworks()` está deprecado desde a
  API 31 e é usado assim mesmo, com o motivo escrito: não existe substituto
  SÍNCRONO, e esta pergunta é feita no toque do operador, antes de existir
  callback nenhum.
- **O IP MUDANDO NA MESMA REDE DERRUBAVA TUDO.** O roteador reinicia às 19h40,
  ou o lease do DHCP não devolve o mesmo endereço: o código detectava
  **corretamente**, esperava 6 s, confirmava — e desligava servidor, tela
  virtual, encoder, janela, mDNS e serviço. Nenhum pacote se perdeu, o
  aparelho está no mesmo AP, e **as três telas caíam e nunca voltavam, porque
  não havia servidor**. Agora `confirmarRede` separa "trocou de endereço" de
  "sumiu": no primeiro caso `religarNoIp` fecha só o `ServerSocket`, refaz o
  bind no IP novo, **refaz a allowlist de `Host`** (sem isso o IP novo
  receberia o 404 idêntico — a mesma armadilha do `hostTls` e do nome mDNS,
  pela terceira vez) e reanuncia o `av.local`. **Não passa por `ligar()`**:
  aquele chama `desligar()`, que termina em `zerarPares()` — as três telas
  voltariam ao pareamento por uma troca de DHCP que elas nem viram. Teto de
  três religamentos por hora; batido, vale o desligamento de sempre.

  **Isto tangencia o item 25 do §10 ("não deixar o espelho ligar sozinho"), e
  está declarado como inversão em vez de escorregar como conserto de
  esquecimento:** o espelho não *liga* sozinho — ele **continua** ligado por
  uma decisão que o operador já tomou, e cuja premissa (o socket serve a LAN
  deste aparelho) não mudou.
- **A VAGA FICAVA PRESA A UMA TELA FANTASMA POR ~5 MIN.** `ultimoUsoMs` é
  renovado a cada volta do vigia enquanto a conexão existir, então uma TV
  desligada na tomada às 10h00 e fechada pelo `TETO_SEM_RELATO_MS` às 10h01
  fica com carimbo de "1 min atrás" — e o critério de ociosidade só a soltava
  às ~10h05. Nesse intervalo a tela do saguão recebia `{estado:lotado}` **com
  a folha do operador listando duas telas**, e não havia em quem tocar em
  "Desconectar"; pior, a MESMA TV religada era recusada pelo fantasma dela
  própria, porque o token vive em `sessionStorage`. Agora o servidor avisa o
  pareamento (`marcarSemConexao`, no `finally` do fluxo, **com a mesma guarda
  de dois argumentos do `telas.remove`** — senão a thread velha marcaria como
  morta uma sessão cuja reconexão já assumiu) e a vaga abre em 45 s, que é uma
  volta inteira de recuperação do cliente. `marcarComConexao` desfaz a marca
  quando ela volta. Quatro casos de JUnit travam os dois lados.

  E o Registro passou a publicar **sessões × telas conectadas** lado a lado:
  enquanto os dois números pudessem divergir sem aparecer, "lotado" com duas
  telas na lista era uma contradição sem leitura possível.

**`EspelhoService.enderecoMudou` VOLTOU.** Ele saiu na v5.180 por não ter
chamador — e naquele momento a remoção estava certa, porque nenhum caminho
mudava o endereço em curso. O `religarNoIp` criou exatamente esse caminho. A
remoção estava certa e o retorno também: o que mudou foi o mundo, não a regra.

`SHELL_VERSION` **não sobe** — nenhum método da ponte nasceu nem mudou de
assinatura.

---

## v5.182 (APK v1.72)

**A v5.182 (v1.72): A ESTABILIDADE DO ESPELHO, SEGUNDA METADE — e esta
EXIGE INSTALAR O APK.** Três das seis falhas Kotlin da mesma varredura. As
outras três são de REDE e ficaram de fora de propósito: elas mexem no único
código que decide se o socket sobe e onde, e a regra de calendário deste
documento manda testar isso numa terça-feira.

- **O ENCODER MORRENDO DESLIGAVA O ESPELHO PELA METADE.** `EspelhoDisplay` só
  sabe da tela virtual, do encoder e da janela; quem derruba servidor, mDNS,
  pareamento e serviço é o `desmontarEspelho` da `MainActivity`, e os três
  chamadores dele (`stopMirror`, `onDestroy`, `EspelhoService.onGone`) **não
  incluíam nenhum dos SEIS caminhos de auto-desligamento**. O que sobrava, num
  culto sem TV em que as telas da rede SÃO a projeção: socket escutando,
  `av.local` publicado, notificação dizendo "no ar", e três telas com o
  `GET /v` aberto recebendo zero byte — congelam, o vigia aborta aos 20 s,
  reconectam, e o pedido de IDR cai num `codec` nulo. **Telas pretas
  reconectando pelo resto do culto**, e religar falhava no bind porque o
  socket antigo seguia em LISTEN: irrecuperável sem matar o processo. Agora os
  seis passam por um funil (`desligarSozinho`) que avisa a Activity —
  `desmontarEspelho()`, **nunca `stopMirror()`**, que reentraria em
  `desligar()`. O callback é limpo no `onDestroy` porque `EspelhoDisplay` é um
  `object` que sobrevive à Activity: esquecê-lo lá reteria a Activity inteira.
  De brinde, os dois caminhos de falha do `startMirror` deixavam o `av.local`
  publicado apontando para uma porta que não atende.
- **O GOP NÃO TINHA TETO EM SEGUNDOS.** `KEY_I_FRAME_INTERVAL` é **contagem de
  quadros** (o framework o multiplica por `KEY_FRAME_RATE`), então `I_FRAME_S`
  = 2 são 60 quadros — o que só vira "2 segundos" quando a fonte entrega 30
  fps. E a fonte é o batimento do `display.js`, que **muda de cadência
  conforme a cena**: 8 Hz parada (7,5 s) e, desde a v5.168, um quarto disso
  quando há conteúdo apresentando quadros que não mudam pixel nenhum da tela
  virtual — **30 s**, contra a `JANELA_S` de 12 s do cliente. É a aritmética
  da §10-A.5 de volta por outra porta, e a v5.168 é a única mudança do espelho
  sem seção própria na §10-A, que é como ela atravessou. A correção não é
  mexer no batimento (já tentado duas vezes): é **parar de depender dele** —
  `garantirChavePorRelogio` pede uma chave passados 6 s de parede sem
  nenhuma. Em cena com movimento ela nunca dispara; em cena parada ela é o
  único motivo de existir uma chave. E imuniza contra a próxima vez que
  alguém mexer na cadência da fonte.
- **TODA REMONTAGEM DO WEBVIEW INJETAVA DEFASAGEM A/V PERMANENTE, E ELA
  ACUMULAVA.** Os dois eixos são de naturezas diferentes por desenho: o vídeo
  é relógio monotônico (anda sozinho) e o áudio é CONTAGEM DE AMOSTRAS (só
  anda com PCM chegando). Numa remontagem — OOM do renderer, `ERROR_RECLAIMED`
  — o `AudioWorklet` morre por alguns segundos enquanto o vídeo segue
  compondo; a página volta, `ligarEncoder` devolvia "ok" sem tocar em nada, e
  **todo quadro AAC dali em diante saía carimbado N segundos no passado**.
  Como a borda ao vivo do cliente é o MÍNIMO das duas faixas, a projeção
  inteira passava a ser exibida N segundos atrás; um segundo buraco somava, e
  cruzados os 3 s o cliente soltava a faixa, remontava contra a MESMA
  defasagem e ao terceiro desistia — **muda pelo resto do culto, com a imagem
  seguindo**. O KDoc de `ptsAgora` dizia "nunca há reancoragem" e estava certo
  sobre o caso dele (reancorar no MEIO do fluxo abre buraco no `buffered`);
  este é o oposto — o fluxo já foi interrompido, e o `fmp4.js` costura o salto
  esticando a amostra anterior. Os dois comentários que afirmavam o contrário
  (`ptsAgora` e o `pagehide` do `display.js`) foram corrigidos junto, senão a
  próxima leitura desfaz isto.

`SHELL_VERSION` **não sobe**: nenhum método da ponte nasceu nem mudou de
assinatura. O que muda é comportamento nativo interno — e por isso a v5.182
**precisa de Release**, ou o operador fica com o bundle novo e o shell velho.

---

## v5.181

**A v5.181: A ESTABILIDADE DO ESPELHO, PRIMEIRA METADE (a que chega por
OTA).** Uma varredura de 36 agentes sobre o sistema de conexão — sete
revisores por dimensão, dois céticos por achado — devolveu 35 achados, dos
quais 14 foram à verificação adversarial e 9 sobreviveram por unanimidade. Os
três que vivem inteiros no `cliente.js` estão aqui; os outros são Kotlin e
**só chegam instalando o APK**. Os três, e o que cada um custava:

- **O SEGMENTO DE INICIALIZAÇÃO ERA APPENDADO ATRÁS DOS FRAGMENTOS.** A
  retenção do `csd` de áudio mantém a `MediaSource` fechada por até 2,5 s, e o
  caminho de vídeo em `receber` **não pergunta por ela**: passada a guarda de
  `esperandoChave`, todo quadro vira fragmento e entra na fila. Quando a
  `MediaSource` enfim abria, o `push` do init o punha atrás do que já
  esperava — e o primeiro `appendBuffer` era um `moof+mdat` **sem init**, que
  o Chromium recusa. Bastava o `POST /r {do:'audio'}` atrasar 300 ms (uma
  retransmissão de Wi-Fi) para o IDR ganhar a corrida: ligar o som virava
  recomeço, e a três recusas a tela escrevia *"esta tela não está conseguindo
  decodificar o fluxo"* — **mandando o operador trocar a TV por um defeito
  nosso**. Pôr na frente é melhor que limpar a fila: os fragmentos acumulados
  começam no IDR desta conexão e são válidos para o init que entra; limpar
  custaria segundos de preto esperando o quadro-chave seguinte. A ordem virou
  função pura (`porInitNaFrente`) porque é a REGRA, e é ela que o teste afirma.
- **NENHUM `POST` DO CLIENTE TINHA PRAZO.** O `GET /v` sempre teve
  `AbortController` e vigia de fio; o canal de volta não tinha nada, e o
  buraco é o mesmo TCP meio-aberto por outra porta. O dano não é perder um
  relato: **o Chromium abre no máximo 6 conexões por host**, e `postar` usa URL
  relativa — o MESMO grupo de sockets do `fetch('/v')` da reconexão. Uma
  batida a cada 10 s durante o laço de reconexão enche os slots com zumbis e a
  **reconexão fica enfileirada atrás deles**, com a tela dizendo "tentando de
  novo em 0 s" enquanto o AP já voltou. Prazo de 15 s (nunca menos: o
  `PRAZO_LINHA_MS` do servidor é 10 s desde a §10-A.10, e um prazo curto aqui
  reabriria pelo outro lado o caso que aquele fecha) mais guarda de relato em
  voo — o relato é uma fotografia, e a mais nova é a única que interessa.
- **A ESCADA DE RECONEXÃO NÃO EXISTIA PARA OITO DOS NOVE CHAMADORES.**
  `recusasSeguidas` sobe num ponto só (o `error` do `SourceBuffer`); os outros
  oito `recomecar` zeram `tentativa` e não alimentam contador nenhum. Numa
  Smart TV que não dá conta de uma cena a 30 fps a fila de append estoura,
  recomeça em 500 ms, e o ciclo se repete: **pisca-pisca de ~5 s na projeção,
  indefinidamente**. E `tentativa` é estruturalmente incapaz de servir de
  escada ali, porque ela também zera a cada quadro aceito — e nesses casos os
  quadros CHEGAM, é justamente por isso que a fila estoura. Daí
  `recomecosSeguidos`, contado no funil e zerado pelo mesmo trecho longo sem
  incidente. `recusasSeguidas` fica: é ele que escolhe a FRASE, e "este
  navegador não aceita o fluxo" × "esta tela não está dando conta" pedem ações
  opostas do operador.

**O que NÃO entrou, e por quê:** as seis falhas restantes são Kotlin (encoder
que morre desligando o espelho pela metade; IDR sem garantia de relógio de
parede; rede padrão virando a celular numa Wi-Fi sem internet; IP novo
derrubando tudo sem religar; defasagem A/V permanente a cada remontagem do
WebView; vaga presa a uma tela fantasma). Elas exigem APK, e duas delas mexem
no único código que decide se o socket sobe e onde — o que, pela regra de
calendário deste documento, se testa **numa terça-feira, não no culto**.

**E uma lacuna estrutural que a varredura não nomeou e a revisão manual sim:
o laço de controle do espelho é ABERTO.** O servidor conta `descartes`, o
cliente reporta `dq`/`tq`/`vfim`, o Android estima a banda do enlace — e nada
disso é consumido por ninguém: os três só são impressos no Registro. O único
atuador que existe, `ajustarBitrate`, está ligado **exclusivamente ao sensor
térmico**. O produtor emite 3 Mbps fixos × 3 telas sobre um enlace de
capacidade variável, e a única resposta ao congestionamento é descartar quadro
e pedir IDR — que é um quadro **grande**, entregue num enlace que já não dava
conta. É um laço que se realimenta, e é a explicação mais econômica para
"pouco fluído".

---

## v5.180

**A v5.180: O COMANDO ATRASADO LEVAVA O ESTADO DE AGORA** — mais uma revisão
de varredura. A fila da preview (v5.162) atrasa a CÓPIA em até 2,5 s para ela
não responder antes das telas da rede, e `aplicarNaPreview` lia `currentItem`
no instante do **dreno**. Dois toques dentro dessa janela — trocar de música,
ou errar a linha e corrigir, que é o caso comum — faziam o `load` de A ser
aplicado com o item B na mão: a mídia certa entrava (ela vem pelo `mediaId`) e
**letra, YouTube e "mantém o texto?" eram decididos pelo item errado**. Um
comando da fila é do passado por construção; o estado que ele carrega tem de
ser o daquele passado também, então o item viaja COM ele. `pvTextActive`
continua sendo lido no dreno, e de propósito: ele é estado da própria preview,
que já vive na linha do tempo atrasada. Só aparece com o espelho no ar e sem
TV — que é exatamente a configuração de teste do operador. `tools/cena.test.mjs`
trava a regra.

Da mesma varredura, mais três, todos pequenos e todos verificados:

- **`ns` (o `networkState` da tela) atravessava o fio inteiro e ninguém o
  desenhava.** A tela media, o `medidasDe` do servidor o transportava desde a
  v5.156, e o Registro nunca o imprimia — bytes em cada batida de cada tela
  para um número invisível. Ele é a outra metade da pergunta que o `rs` faz:
  `rs` diz quanto dado o `<video>` tem, `ns` diz se ele ainda está ligado numa
  fonte, e `SEM FONTE` com `rs` em `SEM DADO` é a `MediaSource` desprendida —
  outro defeito e outra correção que "faminto". Agora sai ao lado do `rs`; com
  `-1` ("esta tela não informou") a linha some, como manda a regra do bloco.
- **`addSongVariant`** (controle.js) e **`EspelhoService.enderecoMudou`**
  (Kotlin) não tinham chamador nenhum. A primeira era o resto do lote da
  v5.141, que unificou as três funções de destino e removeu só duas; a segunda
  nunca teve caminho que a acionasse — importar um certificado com o espelho
  ligado **não** muda o endereço, porque o socket já está de pé, e a folha diz
  isso ao operador.

E o que a varredura confirmou íntegro, porque também é resultado: a superfície
da ponte é **simétrica nos dois sentidos** (nenhum `@JavascriptInterface` sem
chamador em `native.js`, nenhum `B.x` sem método Kotlin), os objetos que
`native.js` remonta campo a campo (`nowPlaying`, `bgProgress`) batem com os
chamadores, a telemetria do espelho fecha nos três lados (cliente → servidor →
Registro) e a tabela `POPUPS` cobre todos os popups do HTML.

**v5.180 é quase toda OTA**; a única linha de Kotlin é a remoção do método
morto, que não muda comportamento nenhum e não pede Release.

---

## v5.179

**A v5.179: O PARAR EXIGIA DOIS TOQUES, e a culpa era do ECO — não das
camadas.** O relato: no primeiro toque a mídia para, mas a barra fica a meio
caminho e o ▶ não aparece; o segundo toque resolve. A hipótese natural é um
sistema de camadas em que o Parar derruba a de cima primeiro, e ela está
errada — `stopClear` derruba mídia e Camada de Texto no MESMO toque, e o
`cena.test.mjs` já travava isso desde a v5.178.

A causa é a mesma que a v5.142 documentou para o ▶, do outro lado do fio:
**`clear` e `media-clear` ESMAECEM antes de sair de cena** (~0,6 s,
`clearFaded`/`fadeOutToBlack`), e nesse intervalo o `<video>` do telão
**continua tocando** — a rampa é de volume, não de pausa. Cada `display-status`
do fade chegava ao Controle com `playing: true` e o tempo antigo e repintava, a
~4 Hz, exatamente a UI que `pararMidia` acabara de zerar: a barra voltava ao
meio, o seek era reabilitado e o ícone voltava a ⏸. O segundo toque só
"funcionava" porque a essa altura a mídia já saíra e ninguém mais reportava
aquele `mediaId` — o filtro do handler é por `mediaId`, e `currentId` sobrevive
de propósito ao stop.

**O caminho do YouTube já tinha a guarda desde sempre** (`yt.stopping`, cujo
comentário descreve palavra por palavra este defeito); o da mídia local nunca
teve. A correção fecha os dois lados, e é **OTA puro**:

- **na FONTE** (`display.js`): o telão que está saindo de cena não reporta o
  fade, e diz UMA vez que o palco ficou vazio. É o que também conserta a
  **notificação de mídia**, onde não há segundo toque — o `snoopDisplayStatus`
  do Kotlin lê esse mesmo status de passagem e deixava o cartão anunciando
  "tocando" sobre um telão vazio até a cena seguinte.
- **no CONSUMIDOR** (`controle.js`): `midiaNoAr` guarda as **duas** fontes que
  pintam o transporte — o handler de `display-status`/`espelho-status` e o
  `previewTick`, que é quem manda **sem telão nem espelho**, e que sofria do
  mesmo mal porque `preview.getCurrent()` só fica nulo no FIM do fade.

Nada foi tirado do Parar: ele continua sendo o ponto final que leva as duas
camadas, e as saídas por camada (`text-hide` e `media-clear`, v5.173/v5.178)
continuam sendo as portas de cada uma. `tools/cena.test.mjs` trava o lado do
Controle e `tools/display-smoke.mjs` o do telão.

---

## v5.178

**A v5.178: O STOP VIRA POR CAMADA, e agora as duas portas existem.** O botão
de Parar da linha no ar (v5.177) chamava `stopClear()` para uma mídia — que é
o **Parar do transporte**, e ele encerra a CENA INTEIRA. Com um louvor de
fundo sob a contagem regressiva de abertura (o uso normal, e o que a
independência áudio × texto existe para permitir), tirar a música do ar levava
o cronômetro junto, e a única saída era parar tudo e reprojetar a cena na
frente da congregação. Faltava o simétrico exato do `text-hide` que a v5.173
acrescentou: **`media-clear`**. Cada linha do Cronograma fala da **camada
daquela linha** — a da cena sai pela Camada de Texto e não toca na mídia, a da
mídia sai sozinha e não toca no texto —, e o Parar do transporte segue sendo o
ponto final que leva as duas.

**Quem decide entre as duas saídas do palco é o DISPLAY, não o Controle.**
`textActive` é estado dele; duplicar a leitura do outro lado é garantir que os
dois divirjam num domingo. Recebido o `media-clear`, ele escolhe entre
`clear-media` (o `fadeOutToBlack` do `stage.js`, exposto agora: esmaece o
conteúdo **sem tocar na cortina**) e o `clear` de sempre. A distinção não é
estética: o cartão de texto vive **por baixo** da cortina do stage — é a mesma
razão do `instantCover(false)` do ramo de `view` —, então um `clearFaded` com
texto em cena fecharia o wallpaper por cima do versículo que continua no ar.

E o ramo do `media-clear` vem **antes** do bloco de `textActive` em
`display.js`. Lá dentro, `clear` é justamente o que chama `hideText`; cair no
fluxo comum faria o comando atravessar até um `stage.handle` que não o
conhece — sem erro, sem log, com o cronômetro saindo do ar e nada em lugar
nenhum que o explicasse. **OTA puro.** `tools/cena.test.mjs` trava o lado do
Controle e `tools/display-smoke.mjs` o do telão, que é o que roda na frente da
congregação.

---

## v5.177

**A v5.177: A PREVIEW ESCONDIDA ESTAVA ROUBANDO O SOM DO ESPELHO.** O
operador relatou a tela da rede ficando muda com a imagem seguindo, e o
Registro trazia a causa na própria linha do tempo: pares
`📱 play [oculto]` / `📱 PAUSA ESPONTÂNEA [oculto]` a ~4 Hz. Aqueles `📱` são
a **preview do Controle**, não o telão. A v5.173 passou a escutar o
`espelho-status` — que é o certo, porque sem TV o espelho É a projeção — e com
isso `resyncPreviewToDisplay` começou a chamar `preview.play()` numa página
oculta; o Chromium pausa um `<video>` de página escondida, o status seguinte
chega 250 ms depois e recomeça. **Os três WebViews dividem UM processo**, e
essa rotatividade de decodificador rouba justamente o fio que alimenta o
`AudioWorklet` do espelho: do lado da tela da rede isso vence o
`AUDIO_MUDO_MS` e a faixa de som é solta. A regra que faltava é a outra metade
da que a v5.173 já escreveu para o atraso — **com a página escondida não se
toca no transporte da preview** (`preverPodeMexer`): um `play()` que o
navegador desfaz no quadro seguinte não é sincronização, é ruído, e quem
realinha é a retomada, que já é EXATA. Junto veio a metade que faltava do
outro lado: **`soltarAudio` era uma porta de mão única** — a tela ficava muda
até alguém atravessar o salão para tocar nela. Agora, com o AAC voltando a
chegar por 2 s seguidos, o cliente **remonta sozinho** (`voltouOSom`), preso
ao mesmo teto de `REBUILDS_AUDIO`, que só se renova depois de a remontagem ter
dado certo.

**E a tela receptora ganhou DOIS ícones no lugar do botão único.** "Ver em
tela cheia e ouvir" juntava duas decisões que não são a mesma: a tela do
saguão quer imagem cheia e SILÊNCIO (a PA está a 200 ms dali), a da sala anexa
quer som — e quem descobria o eco não tinha como desfazer sem recarregar a
página. Agora são um alto-falante e uma moldura, na mesma anatomia dos
`.pv-fab` da preview (traço, sem moldura, contorno por `drop-shadow`), e eles
**se recolhem sozinhos** depois de 4 s, voltam com um toque e somem com o
toque seguinte — o player de sempre, com uma carência de 400 ms porque num
notebook o ponteiro se mexe ANTES do clique. **O que NÃO dá para tirar, e está
dito em vez de escondido: o PRIMEIRO toque.** `requestFullscreen()` e sair do
`muted` exigem ativação transitória do usuário. O que muda é que o toque passa
a ser NAQUILO que se quer — e, do segundo em diante, o ícone do som é um mudo
de verdade (`muted` no elemento, sem remontar nada e sem falar com o
servidor). O som segue **opt-in** (invariante 10): o ícone nasce riscado.

**E no Cronograma o Parar toma o lugar de mover e favoritar.** O segundo toque
já tirava do ar desde a v5.165 e o selo "● No ar" já dizia o estado, mas a
direita da linha seguia oferecendo arrastar-para-reordenar e favoritar — as
duas coisas que ninguém quer fazer com o item que está na frente da
congregação, a milímetros do gesto que o operador está mirando. Trocá-los é o
que faz QUALQUER toque naquela linha significar a mesma coisa. A troca é por
**classe CSS** (`.lib-item.no-ar`), nunca remontando a linha: quem liga e
desliga o estado é o `marcarNoAr`, que roda a cada `display-status`. **OTA
puro** — nenhuma linha de Kotlin em todo o lote.

---

## v5.176

**A v5.176: O CARTÃO DO ESPELHO SAIU DA BARRA DE STATUS, e quem passou a
avisar é o ÍCONE.** Pedido do operador, e ele tem uma parte que **não dá para
atender**: a notificação do `EspelhoService` não pode ser removida. Um serviço
em primeiro plano é obrigado a publicar uma (`startForeground` sem ela derruba
o app inteiro), e é justamente esse serviço que impede o Android de congelar o
processo com o app minimizado — isto é, o que mantém o espelho no ar durante o
culto. O que dá para fazer é tirá-la da frente: o canal foi para
**`IMPORTANCE_MIN`**, o degrau em que o Android não desenha ícone na barra de
status e recolhe a entrada para o bloco silencioso da gaveta, mais
`FOREGROUND_SERVICE_DEFERRED` (o sistema segura o cartão por ~10 s, então
ligar e desligar para testar não pisca nada). **O canal é um id NOVO
(`espelho2`), e tem de ser**: a importância pertence ao usuário depois de
criada, e `createNotificationChannel` sobre um canal existente ignora a
mudança em silêncio — sem trocar o id, a correção não chegaria a ninguém que
já tivesse usado o recurso. O fato subiu para onde o operador olha: o ícone de
conectar veste `.connected` — **a mesma classe, a mesma cor e o mesmo efeito
do telão** — quando há telas da rede recebendo, e a dica diz quantas. Uma
convenção só para um fato só. Metade APK (o canal), metade OTA (o ícone).

---

## v5.175

**A v5.175: A SEÇÃO DE CONEXÃO FORA DO PADRÃO — e o token que não existia.**
Os DOIS botões principais da folha "Conectar uma tela" pediam
`var(--radius-md)`, um token que **nunca existiu nesta base**. Um `var()`
inválido sem fallback computa para o valor INICIAL da propriedade: eram os
únicos cantos retos de um app inteiro arredondado, na primeira tela do recurso
mais novo, e nada reclamou em lugar nenhum — mesma família do `setInteger`
numa chave `long` e do `bytes` esquecido no `bgProgress`. Agora há um oráculo
(`tools/tokens.test.mjs`, Node puro, **sem `continue-on-error`**) que varre a
base inteira, mais a asserção RENDERIZADA no `smoke.mjs`.

**E a simplificação da v5.156→v5.171 tinha deixado sobras.** O que a revisão
achou, e o que ficou: `.mirror-mode` (o seletor imagem × vídeo, morto desde que
o modo imagem saiu) e `.mirror-hint` eram CSS órfão; `#mirrorRow` era um
`<span hidden>` — a antiga linha de Configurações — que o `renderEspelho`
ainda alimentava a cada leitura com uma frase de estado que ninguém via, e que
ainda servia de SENTINELA de existência para a folha inteira (um elemento de UI
morto como guarda é a pior forma de guarda: parece intencional e some no
primeiro `hidden` que alguém mexer); o ENDEREÇO tinha duas anatomias
(`.cast-addr`/`.cast-url` e `.mirror-addr`/`.mirror-url`, raios, tamanhos e
paddings diferentes) e aparecia nas DUAS folhas; e as telas conectadas eram
listadas duas vezes, também com anatomias diferentes. Agora: a folha de
conectar tem o endereço e quem está vendo; a de Ajustes tem o PIN, o
certificado, a porta e **só a fila de aprovação**. Mais os literais que viraram
token (`999px` → `--radius-pill`, `4px`/`2px` → rem). OTA puro.

---

## v5.174

**A v5.174: "ATUAL" E "NO AR" ERAM A MESMA MARCA, e não são a mesma coisa.**
A lista tinha um contorno em accent só, e ele significava `currentId` — o item
ATUAL, aquele que o ▶ repete e que sobrevive de propósito ao Parar. Depois de
um Parar a linha continuava marcada com o telão vazio; e com uma cena de
roteiro sobre um louvor de fundo (duas camadas no ar ao mesmo tempo) só uma das
duas aparecia. Ou seja: a marca não respondia "o que está sendo projetado?",
que é justamente a pergunta que o segundo toque exige responder antes de ser
tocado. Agora são duas — `.active` (atual) e `.no-ar` (projetando) —, e a
segunda usa **o mesmo desenho de "no ar" do resto do app**, com o selo
**"● No ar"** prefixado ao subtítulo, exatamente como a referência do versículo
central da Bíblia. O par `midiaNoArId`/`cueNoArId` é o que torna isso possível:
`midiaNoAr` dizia que HAVIA mídia no ar e `currentId` dizia qual era o item
atual, e nenhum dos dois dizia QUAL mídia estava no telão. OTA puro.

---

## v5.173

**A v5.173: A PREVIEW ERA A RÉGUA, e a régua era a coisa que se deformava.**
O operador relatou a preview voltando "completamente dessincronizada" depois
de minimizar e reabrir o app. A causa não estava na preview: estava em não
haver mais nada. **Sem TV conectada, o único emissor de `display-status` é o
`/display/` do espelho — e o dreno do papel `espelho` o calava.** Restava a
preview como fonte de tempo, e ela é o único dos três WebViews que o Android
estrangula quando o app sai da frente. O status do espelho passou a sair
RENOMEADO (`espelho-status`, para nada que espera "o telão" recebê-lo por
engano), o telão tem precedência sobre ele nos dois consumidores, e a preview
voltou a ser o que ela é: uma ILUSTRAÇÃO. Ver "A referência da preview". Junto
vieram as três regras do atraso — mirar `projeção − atraso` em vez da projeção
(senão o resync desfaz o atraso a 4 Hz), tolerância de 0,5 s em vez de 1,6 s
(a preview não tem som, um seek não estala nada) e **0,15 s ao retomar**, e a
fila da preview deixou de atrasar com a página escondida. **É OTA puro** para
a sincronização — o `MessageBus` relaia qualquer tipo, então o bundle novo
conserta a preview num shell antigo; só a **notificação de mídia** (que também
congelava, e pelo mesmo motivo) precisa do APK.

**E o SEGUNDO TOQUE do Cronograma passou a existir de verdade.** A v5.165
anunciou "tocar de novo no que está no ar = tirar do ar" e ele não funcionava,
por **três** motivos empilhados, todos silenciosos: (1) `retirarDoAr` chamava
só `clearManualText()`, que é BOOKKEEPING — ele zera a sessão e **não manda um
único comando ao telão**; o versículo continuava projetado. Faltava o
`text-hide`, que é o mesmo "tirar do ar" da Bíblia e da Mensagem e é
justamente o que o `clear` não é (o louvor de fundo segue tocando). (2) A
pergunta "está no ar?" era `item.id === currentId`, e `currentId` é o ÚLTIMO
item enviado: no instante em que o operador põe uma música por baixo do
versículo — o caso que justifica o recurso —, ele deixa de apontar para a
cena. Agora quem responde é `cueNoArId`. (3) `projetarMensagemCue` projetava o
texto guardado **sem sessão nenhuma** quando a mensagem original tinha sido
apagada, e uma cena sem sessão é invisível para todo o resto do app. O realce
da lista passou a marcar as DUAS camadas que podem estar no ar ao mesmo tempo,
porque marcar uma só escondia justamente a linha em que o toque tem efeito.
OTA puro.

---

## v5.172

**A v5.172: A PORTA ABERTA NUNCA ABRIU — e mais sete.** O operador relatou o
espelho "funcionando, mas sem estabilidade nem confiabilidade na conexão", e a
revisão linha a linha achou **oito** defeitos. O primeiro explica sozinho a
maior parte da queixa: o `cliente.js` pedia a entrada assim que a página
abria — um `POST /par` com o relato e mais nada —, e o `when` do
`EspelhoServidor.parear` **não tinha ramo para esse corpo**. Caía no
`else -> 403`. A porta que a v5.170 anunciou e em volta da qual a v5.171
construiu a folha inteira nunca chegou a existir; e o custo maior não era o
atrito da estreia, era a RECUPERAÇÃO — toda queda de rede, toda religada do
espelho e toda expiração de token devolvem a tela ao pareamento, onde ela
ficava mostrando um QR que ninguém ia ler até alguém atravessar o salão.
Os outros sete, com o porquê de cada um, estão em
`docs/ESPELHO-DE-PIXELS.md` §10-A.10; os que mudam decisões deste documento:
**três recomeços trancavam o espelho por seis horas** (uma sessão só saía de
`vivas` por `encerrar`, `recusar` ou o prazo, e uma aba nova pede token novo —
agora a vaga OCIOSA é reaproveitada, o que só faz sessão morrer mais cedo e
deixa a invariante 3 intacta); **"Desconectar" era um botão que não fazia
nada** (a folha manda o RÓTULO da tela e ele ia parar num `recusar` que
procura id de espera — nunca casava, e um rótulo vazio ainda fechava a porta);
**o teto de conexões em voo contava os FLUXOS** (três telas ocupavam três dos
oito slots para sempre, e um navegador abre até seis conexões paralelas só
para carregar a página — a segunda tela a abrir o endereço já era recusada);
**nenhum dos dois lados detectava um TCP meio-aberto** (o `fetch` de `/v` fica
pendurado para sempre — nem `done`, nem erro —, e do lado do servidor a
escrita não trava enquanto o buffer do kernel couber); **uma oscilação da rede
PADRÃO derrubava o espelho inteiro** (`registerDefaultNetworkCallback` fala da
rede padrão, que pisca para a móvel numa revalidação da Wi-Fi — agora suspeita
não é veredito: o vigia confirma 6 s depois); e **o adeus era uma sentença**
(a página ficava morta até alguém recarregá-la à mão; agora ela volta a
oferecer entrada sozinha em 20 s). **Metade é APK e metade é OTA**, e as duas
degradam sozinhas: um bundle novo num shell antigo volta ao QR, e um bundle
antigo num shell novo entra pela porta assim mesmo, porque o corpo nu vale
como pedido. `SHELL_VERSION` **não sobe** — nenhum método da ponte nasceu nem
mudou de assinatura.

---

## v5.171

**A v5.171: a folha de conectar vira UM DEGRAU.** Eram três (cast → espelho →
QR) para ler uma linha de texto. Agora **abrir a folha já liga o servidor**
(ninguém abre "Conectar uma tela" para não conectar, e a ordem "primeiro
ligue, depois leia o endereço" existia por causa de como o recurso é
construído, não por causa de quem o usa), o **endereço é o maior elemento da
tela** (é o único que alguém copia com os olhos para digitar num controle
remoto) e **a lista de quem está vendo sobe para a folha principal, com o
botão de derrubar** — com a porta aberta ela deixou de ser fila de aprovação e
virou o controle de verdade, porque o dano de um curioso é ocupar uma das três
vagas, não ver o que a congregação já vê. O PIN, o certificado e o interruptor
da porta continuam existindo atrás de um link discreto de "Ajustes avançados".

---

## v5.170

**A v5.170: A PORTA NASCE ABERTA.** Quem abrir o endereço do espelho entra —
sem PIN, sem QR e sem o toque do operador. A decisão é sobre o CONTEÚDO: o
espelho transmite a imagem do que está sendo projetado **para a congregação
inteira**, e uma fechadura sobre conteúdo público custava três degraus de tela
e seis dígitos em cartaz durante todo o culto. O que sustenta a inversão
continua no lugar: **o microfone ao vivo nunca sai na rede**, o token nunca
viaja numa URL, a allowlist de `Host` segue exata (DNS rebinding) e o teto de
três sessões segue valendo — e é ele, não o sigilo, o dano real de um curioso
na rede, porque ele toma a vaga da TV do templo. A resposta a isso é o
operador VER quem está conectado e poder derrubar. São **duas metades**: o
`EspelhoPares` nasce aberto e dispensa o PIN nesse modo (APK), e o
`cliente.js` tenta entrar sozinho ao abrir a página (OTA) — sem as duas, nada
muda. QR e PIN continuam inteiros como **plano B**, para quando o operador
fechar a porta.

---

## v5.168

**A v5.168 DESFAZ metade da v5.157, e a lição é sobre PISOS.** O batimento de
8 Hz do papel espelho passou a "ceder a vez ao conteúdo", e o ganho era real
(quadros descartados de 7% para 1,6%) — mas transformou um **piso** numa
**condição**, e um piso com condição não é piso. Em aparelho:
`ritmo: 0 kbps · 0 fps` com o alarme "ISTO É UM RETÂNGULO PRETO", numa cena de
Sorteio. A causa: `requestVideoFrameCallback` dispara por quadro que o
ELEMENTO apresenta, não por mudança na TELA VIRTUAL — um vídeo tocando por
baixo da cortina, do wallpaper ou da Camada de Texto continua apresentando
quadros que não mudam um pixel do que vai ao encoder. Com o vídeo parado o
áudio seguiu sozinho e as duas linhas do tempo abriram **35 segundos** uma da
outra. Perguntar "o conteúdo está visível?" seria empilhar outra aposta sobre
cortina, fade, `object-fit`, rotação e Camada de Texto; a resposta é não
apostar — **o batimento nunca para, ele DIMINUI** (uma batida a cada quatro
com conteúdo em cena). Mantém a fase longe dos 30 fps, que era o ganho, e
mantém o piso, que era o motivo de existir. OTA puro.

**O APP ESTÁ EM ALFA FECHADO.** Um operador, um aparelho, e o APK sai por
Release do GitHub. Isso muda o peso da retrocompatibilidade: **não é preciso
sustentar shell antigo indefinidamente**. Um método novo da ponte pode
pressupor o APK mais recente, `minShell` pode subir quando fizer sentido, e um
caminho de degradação que só existe para uma versão que ninguém roda é código
morto — apague-o. O que NÃO muda: `SHELL_VERSION` continua subindo a cada
mudança de superfície (é ela que impede um bundle novo de rodar num shell que
não o entende), e a janela entre o OTA e o APK continua existindo **dentro de
um mesmo lote**, porque o bundle chega em minutos e o APK depende de o
operador instalar. Degradar por algumas horas, sim; sustentar versões antigas,
não.

---

## v5.167

**A v5.167: o APK se atualiza DE DENTRO DO APP** (`ShellUpdater.kt`, shell 35).
A assimetria era o atrito — um ajuste de JS chegava sozinho e qualquer
mudança de Kotlin obrigava a abrir o navegador, achar a Release e caçar o
`.apk`. A linha só aparece com versão nova, ao lado do rótulo de versão (é a
mesma conversa), e o botão só age quando a hora é boa: aqui o
`horaRuimParaAtualizar()` vale POR INTEIRO — cena, download **e** espelho —,
ao contrário do OTA da base web, cujo custo é um piscar. **A garantia de
segurança é mais forte que a do OTA e é de graça:** o Android recusa instalar
por cima um pacote de outra keystore, então um binário adulterado não instala
— é por isso que o `ShellUpdater` não replica o `sha256`. Host travado e
`https` continuam, porque impedem um campo alterado de apontar o download para
outro servidor. **Ele não instala sozinho**: o diálogo do sistema é
obrigatório e está certo que seja.

**E o OTA da base web passou a ESPERAR o download terminar.** Aplicar recarrega
as duas páginas, e um laço de sincronização (hinário, Bíblia, pasta) morre com
o documento — ele não é um `fetch` que o shell retoma, é um `for` na página.
Foi o que parou o hinário em 300 de 600 numa tarde de várias publicações. **Só
o download segura**, e é deliberado: a v5.151 tirou as travas de cena e espelho
porque elas eram permanentes num culto e faziam a atualização nunca chegar. Um
download acaba.

---

## v5.166

**A v5.166: a pasta era persistida DEPOIS do laço, e por isso uma
sincronização interrompida "não salvava progresso nenhum".** Cada arquivo já
ia para o OPFS e para a store `files` na hora, com `folder: <id>` — mas o
ÍNDICE DE PASTAS (`opfs-folders`) só era gravado no fim. Uma pasta de 600
vídeos interrompida na metade deixava 300 arquivos escritos e **nenhuma pasta
que os apontasse**: órfãos, invisíveis na tela, ocupando gigabytes — e o
coletor de lixo, que existe para recolher registro sem dono, os apagava. Agora
a pasta é gravada ANTES do primeiro arquivo e a contagem tem ponto de controle
a cada 25. O mecanismo de retomada sempre existiu (o laço pula o que está em
dia por tamanho + data); o que faltava era ele ter o que retomar. OTA puro.

---

## v5.165

**A v5.165: TOCAR DE NOVO NO QUE ESTÁ NO AR = TIRAR DO AR.** Era a convenção
da Bíblia, da Mensagem, do cronômetro e do sorteio, e faltava nos itens do
Cronograma — ali a única saída era o **Parar**, que é outra coisa: ele encerra
a CENA INTEIRA. Com um louvor de fundo sob um versículo (o uso normal, que a
independência áudio × texto existe para permitir), tirar o versículo pelo
Parar levava a música junto. Por isso o desligamento é **por camada**: cena de
roteiro sai pela Camada de Texto e **não toca na mídia**; mídia sai pelo mesmo
caminho do Parar, porque ali ela É a cena. `currentId` **não** é zerado — é
ele que deixa o ▶ repetir o item, e quem responde "há algo no telão?" é
`midiaNoAr`. OTA puro.

---

## v5.164

**A v5.164 dá um NOME ao espelho: `av.local`. REVOGADA na v5.185** — o
responder inteiro saiu, porque `.local` não resolve no Chrome do Android nem
na maioria das Smart TVs, que são exatamente as telas deste recurso. O texto
abaixo fica pelo que ele ensina (a allowlist de `Host`, o `MulticastLock`, o
porquê de o `NsdManager` não servir). Dois arquivos novos —
`EspelhoMdnsPacote.kt` (**puro**, com JUnit, porque é o segundo ponto do
projeto que aceita bytes de um desconhecido, e aqui um erro vira **laço
infinito**: ponteiro de compressão de DNS é um grafo) e `EspelhoMdns.kt` (o
socket 5353, o `MulticastLock` sem o qual o Android nunca entrega o pacote, a
sondagem que impede roubar um nome alheio, e a despedida com TTL 0). **O nome
entra na allowlist de `Host`** — sem isso `av.local:8787` receberia o 404
idêntico, que é o modo de falhar mais mudo deste servidor; é a mesma armadilha
do nome do certificado TLS, agora valendo duas vezes. **Duas coisas que ele
NÃO conserta, e estão ditas na folha:** a porta fica na URL (portas < 1024 são
privilegiadas no Linux e nenhum app Android as reivindica — não existe
permissão), e `.local` **não** resolve no Chrome do Android nem na maioria das
Smart TVs, então **o IP continua divulgado ao lado do nome**, nunca no lugar
dele. `NsdManager` não serviria: ele publica um SERVIÇO, e serviço não vira
nome que se digita. **Exige o APK.**

---

## v5.163

**A v5.163 acha por que o SOM MORRE, e a causa estava no descarte do
servidor.** Quando a fila de uma tela enche, `entregar()` fazia `fila.clear()`
— varrendo o **áudio** junto com o vídeo. O cliente solta a faixa de som depois
de 3 s sem um quadro AAC (a MSE não toca sem dado em todas as faixas, e uma
faixa parada congelaria a IMAGEM), remonta, e ao terceiro desiste: **muda pelo
resto do culto**. Medido em aparelho: `12 descarte(s)`, `3 remontagem(ns)`,
`som: PEDIDO e a faixa não nasceu`. E a conta é gritante — o AAC são 96 kbps
contra ~3 Mbps de vídeo, isto é **3% dos bytes**: descartá-lo não alivia
backpressure nenhuma. Agora o estouro joga fora **só vídeo**, que se recupera
sozinho no quadro-chave seguinte. **Exige o APK.** Por OTA vão mais três: o
teto de remontagens de som **se renova** depois de 45 s de som limpo (era um
teto de sessão — cinco reconexões num culto o gastavam e a tela ficava muda por
uma turbulência que já tinha passado); `menor folga já vista` passou a ser da
SESSÃO (ela zerava no salto, que é justamente a consequência que ela existe
para explicar — daí `11 salto(s)` ao lado de um tranquilizador `+1614 ms`); e o
`-99999` de "sem faixa" deixou de ser lido como folga negativa, que fazia toda
tela muda sair do Registro com um "← chegou a secar" falso.

---

## v5.162

**A v5.162 ataca a SENSAÇÃO, não o número — e a leitura do operador estava
certa.** O que estraga não é o atraso em si: é a preview mudar no ato enquanto
a tela da rede muda um segundo depois, e é o botão ficar esse segundo sem
responder (que se lê como "não funcionou", e o operador toca de novo). Duas
correções, as duas OTA: **(1) a preview atrasa junto** — `cmd()` já era o funil
único onde o comando vai ao telão *e* à preview, então a metade da preview
entra numa FILA que escoa `previewAtrasoMs` depois, e ela vira um espelho fiel
e deslocado no tempo (letra, fades, cortina, tudo desliza junto). O atraso é
MEDIDO (a mediana do `vivo.vfim` das telas conectadas), vale **só sem telão
conectado** (com TV, a projeção é ela e chega no ato), e `authoritativeTime()`
soma-o de volta — senão "próxima estrofe", tocado logo depois de a estrofe
virar, devolveria a estrofe que já está no ar. **(2) o ECO**: um anel curto em
accent, delegado por seletor no transporte e nos três do meio do mixer, que
NÃO troca o conteúdo do botão — o `.btn-pulso` esconde o filho para pôr um ✓, e
fazer isso com o ▶ apagaria o ícone que carrega o estado.

---

## v5.161

**A v5.161 tira o TRANSITÓRIO DE PARTIDA da conta, e ele estava impedindo a
convergência da v5.160.** Duas contagens falsas: (1) `posicionar()` entrava no
ponto MAIS ANTIGO que as duas faixas tinham, então o `borda()` seguinte via
atraso acima de `SALTO_S` e saltava — **dois saltos nos primeiros 43 s** de uma
sessão sem defeito, e cada salto devolve a folga adaptativa ao teto; a entrada
passa a ser a borda ao vivo menos o alvo, com `Math.max` mantendo a regra do
som intacta. (2) A espera pelo PRIMEIRO quadro apresentado era contada como
travamento — toda sessão saudável nascia com "1 parada, 1,5 s", e o incidente
falso recuava o alvo logo na partida. Parada é intervalo ENTRE quadros; sem o
primeiro não há intervalo. OTA puro.

---

## v5.160

**A v5.160 é OTA PURO e ataca o ATRASO, que virou a queixa depois que o
travamento saiu.** A folga do cliente é seguro contra soluço do produtor, e
seguro custa atraso: o operador toca um botão e a projeção responde `ALVO_S`
depois — mais o desvio A/V, porque a borda ao vivo é a da faixa mais atrasada
e o som sai ~500 ms atrás da imagem. Somados, os 2 s que o operador mediu no
dedo. Um valor fixo obriga a escolher entre travar e demorar; agora ele
**encolhe um degrau de 100 ms a cada 8 s limpos (1,5 s → 0,7 s) e volta ao
teto de uma vez no primeiro incidente** — a mesma assimetria da suavização da
ETA do download, com o sinal invertido. Cada tela converge para o menor atraso
que ELA aguenta, e uma rede ruim recebe sozinha a folga que uma rede boa não
paga. A leitura é a linha `folga do cursor: video` do Registro, que é
literalmente esse atraso.

---

## v5.159

**A v5.159 fechou o que a v5.158 deixou de pé, e o achado é do MESMO tipo:
`KEY_I_FRAME_INTERVAL` não é segundos de parede, é CONTAGEM DE QUADROS.** O
framework o multiplica por `KEY_FRAME_RATE` (declarado 30), então `5` são 150
quadros — ~16 s no espelho, que entrega ~9 quadros por segundo numa cena
parada. Com a janela do cliente em 12 s, a poda desistia sempre: 65 recusas
seguidas e a janela crescendo até 25,6 s em aparelho. Passa a **2** (60
quadros: ~7,5 s parado, 2,0 s num vídeo a 30 fps — este último é o GOP padrão
de transmissão ao vivo, o que deixa o fluxo pronto para o caminho de
live/podcast). **Exige o APK.** Do lado do cliente, por OTA: o encalhe passa a
exigir o cursor PARADO (fora do buffer ANDANDO é o Chromium pulando buraco
pequeno sozinho — socorrê-lo estala a imagem e foi o que levou os quadros
descartados de 1,6% a 13,7%), e a poda faminta PEDE uma chave, fechando o laço
pelo lado que não precisa de instalação.

---

## v5.158

**A v5.158 achou a causa do travamento, e ela era a PODA.** `SourceBuffer.remove()`
da MSE não apaga só o intervalo pedido: ele continua **até o próximo ponto de
acesso aleatório** (e, não havendo nenhum, até o fim). A janela viva do cliente
era de 5 s e o GOP real numa cena de letra é de **~19 s de parede** — o
`KEY_I_FRAME_INTERVAL` vira CONTAGEM DE QUADROS (150) e o produtor entrega 8
quadros por segundo. A poda apagava o presente; o cursor ficava fora do buffer;
a MSE não toca, não erra e não avisa; e a única saída era o salto de `SALTO_S`,
que precisa de 8 s de borda aberta — **7,1 s**. Os "trava a cada 7 segundos"
nunca foram o defeito: eram o relógio da recuperação. A correção é OTA
(`cliente.js`: poda em cima de quadro-chave, janela 12 s, encalhe detectado no
instante, `ALVO_S` 1,5 s), e os sete campos novos do Registro exigem o APK. Ver
§10-A.4 do doc do espelho — inclusive por que a medida `pq` da v5.157 era
estruturalmente incapaz de ver a parada que existia para medir.

---

## v5.157

**A v5.157 mede o travamento, e a metade que MEDE é APK.** O batimento que cede
a vez ao conteúdo (P3, `display.js`) é OTA puro e vale sozinho. Já os cinco
números do pior caso (`pq`/`nq`/`pc`/`pv`/`pa`) atravessam a **lista fixa** do
`EspelhoServidor.medidasDe` — num shell anterior eles são descartados em
silêncio e a linha simplesmente não é desenhada no Registro, que é a degradação
certa e também o motivo de a Release ser obrigatória: sem ela o operador
continua vendo um log saudável de uma tela que trava. `SHELL_VERSION` **não**
sobe: nenhum método da ponte nasceu ou mudou de assinatura.

---

## v5.154

**A v5.154 é METADE OTA e METADE APK, e a divisão importa para quem for testar
em aparelho.** Os quatro defeitos do cliente do espelho (a sombra que matava o
laço de borda, o buffer do fio que sobrevivia ao recomeço, a faixa de som que
não soltava e o prazo do `csd` que nunca rearmava) vivem em
`assets/web/espelho/cliente.js` e chegam **por OTA, sem instalar nada**. Os
dois do servidor — a despedida que ninguém emitia e a ordem do `csd` no fio —
são Kotlin e **só chegam com o APK novo**. A ponte não mudou, então
`SHELL_VERSION` continua 34 e nada é recusado por versão: num shell antigo o
espelho segue funcionando com as correções do lado web, e sem a despedida.

---

## v5.155

**A v5.155 é OTA PURO** — nenhuma linha de Kotlin, nenhuma Release. As duas
correções dela (a borda ao vivo lida da faixa mais atrasada e a transliteração
do que viaja ao Registro) vivem inteiras no `cliente.js` e chegam sozinhas ao
aparelho que já tem o APK v1.70.

---

## v5.156

**A v5.156 é METADE OTA e METADE APK, de novo.** O modo imagem saindo, a folha
do botão de cast e o relato da tela chegam por OTA. O teto de 4 KiB do
`POST /r`, os contadores do servidor, a janela perguntada, o perfil do encoder
e a memória são Kotlin — **só com o APK novo**. E o bundle degrada sozinho no
shell antigo: o 413 do relato grande faz o cliente voltar ao curto, e um
`espelhoLigar('video')` num shell que ainda conhece `'imagem'` recebe vídeo,
que é o que ele deveria ter pedido. `SHELL_VERSION` continua **34**.

**O ESPELHO DE PIXELS exige o APK novo, e o CLAUDE.md precisa dizer isso em
vez de deixar deduzir:** os cinco métodos da ponte são shell 32, e a linha em
Configurações não é sequer desenhada abaixo disso. O bundle 5.141 chega por
OTA a todo aparelho e é **inerte** num shell antigo — que é exatamente a
degradação certa, e o motivo de o `minShell` continuar em 2.

**E o PAREAMENTO POR QR exige um APK ainda mais novo (shell 33, v5.145).** A
metade que roda na tela chega por OTA e funciona sozinha — o código aparece,
desenhado pelo `qr.js` — mas quem o LÊ é a câmera do Controle, e a permissão
`CAMERA` mora no manifest. Num shell 32 o botão de ler não é desenhado, a tela
mostra um QR que ninguém vai ler, e o operador usa os seis dígitos, como antes.
**Duas coisas do lote não passam pelo OTA de jeito nenhum:** a permissão no
`AndroidManifest.xml` e o `onPermissionRequest` do `ControleChromeClient` —
sem ele o `getUserMedia` do Controle é negado em silêncio, e o botão pareceria
quebrado sem erro nenhum no console.

**A transmissão direta exige o APK v1.55.** A v5.127 corrigiu o defeito que a
mantinha quebrada desde a v5.120 — a faixa de bytes viajava no cabeçalho
`Range` e o WebView aplicava o deslocamento uma segunda vez sobre a fatia (ver
a invariante 8 e, em `docs/ARQUITETURA-WEB.md`, "A segunda requisição que
morria — e o contrato que ninguém tinha lido"). **A correção é metade Kotlin:
o OTA sozinho não a leva.** Num shell < 27 o bundle novo nem tenta transmitir
e vai direto ao download — o que é melhor que o comportamento anterior, em que
ele projetava uma cena que morria, abria a cortina sobre o preto e ainda pagava
uma re-extração antes de baixar. O rodapé de Configurações passou a dizer por
onde a faixa viaja, justamente para essa leitura não depender de adivinhação:
`faixa na URL` (funcionando) × `DESLIGADA: shell N < 27`.

**CONFIRMADO em aparelho** (S24 Ultra, Android 16, WebView 150): `Transmissão:
MediaSource ok (avc1+aac) · faixa na URL` e `transmitindo 1080p
(137@VISIONOS + 140@VISIONOS)` **sem nenhuma linha de falha atrás** — o vídeo
entra no telão sem download. Três rodadas de APK (v1.52 → v1.54) foram gastas
num diagnóstico plausível e errado; o que fechou o caso foi ler a fonte do
Chromium em vez de deduzir por eliminação de mensagens que, como se descobriu,
nem chegavam.

A v5.128 tirou o resto que aparecia na estreia: o `<video>` fica segundos em
cena sem um quadro (init + índice + primeiro fragmento vêm da rede) e o
WebView pintava ali o **pôster padrão** dele — o retângulo cinza com o play
preto gigante. O `stage` já escondia o elemento enquanto não houvesse `src`;
com a transmissão, "sem `src`" virou "sem dados". Agora ele carrega um pôster
1×1 transparente enquanto espera (ver `POSTER_VAZIO` em `shared/stage.js`) e o
devolve ao normal no primeiro quadro.

E a v5.129 fechou o que estava embaixo do placeholder: **a transição de
entrada existia pela metade.** A mídia velha esmaecia até o preto e a nova
entrava no talo — invisível com arquivo local (o corte colava no fim do
esmaecimento), gritante com a transmissão. `runFadeIn` espelha o `runFadeOut`
que já existia, esperando o primeiro quadro e levando a rampa de volume junto.
Ao escrever o teste apareceu o motivo de a cortina nunca ter coberto esse
caso: **para um vídeo ela não esmaece** — `play()` chama
`instantCover(computeCover())` e a arranca instantaneamente —, então o fade de
conteúdo é a única transição de entrada que um vídeo tem. Detalhes em
`docs/ARQUITETURA-WEB.md`.
