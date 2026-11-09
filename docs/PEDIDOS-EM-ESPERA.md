# Pedidos em espera (fila do operador)

Registro dos pedidos do operador **ainda não implementados**, em **pacotes**: um
pacote é o conjunto de pedidos que tocam a MESMA área de código/recurso e **saem
juntos**, num lote só, com o rito de entrega completo. Existe para sobreviver a
uma limpeza de contexto: quem retomar lê este arquivo e pergunta ao operador
**qual pacote seguir** — nada aqui está autorizado para execução sem essa
resposta.

**Edição de 2026-11-09.** A lista foi relida contra o que já saiu (v1.13.36 a
v1.13.50), **renumerada do zero** (o Pacote 1 é o de maior prioridade) e
**recatalogada por importância × urgência** — o índice é a primeira tabela, e a
nota é item a item. Nesta revisão três pedidos saíram inteiros (os antigos 1.1,
1.3 e 1.4), um foi reduzido (o antigo 4.1 virou o 11.1 de hoje), o antigo 11.1
ficou só com o que as revisões não cobriram, e o cache do antigo 9.3 já tinha
saído na v1.13.50. O rastro está ao fim. **Os Pacotes 1 e 2 saíram** — o 1 na v1.13.51 e o 2 na v1.13.52 (2026-11-09); os que
ficam MANTÊM a numeração — renumerar de novo custaria mais que o buraco, e o
"Mapa da numeração antiga" continua valendo para as referências velhas.

**Regra do arquivo:** ele ESVAZIA. Um pacote entregue sai daqui (a nota vai ao
`docs/HISTORICO.md`, como sempre); um pedido revogado sai com uma linha dizendo
quem revogou. Não é log, e não é `docs/ACHADOS-EM-ABERTO.md` (lá moram defeitos
CONFIRMADOS por auditoria; aqui, pedidos).

**Contexto da entrega:** base web **v1.13.51**, APK **v1.13.50**, `SHELL_VERSION`
**85**, `minShell` **83** — conferido em 2026-11-09. O operador pediu economia:
*"não temos tokens então toda ação deve ser fracionada e controlada"* — um pacote
por vez, cada um com o rito de entrega completo.

---

## Como esta lista se lê

**Tipo.** `defeito` (comportamento errado, relatado), `pedido` (função ou ajuste
que o operador quer), `resíduo` (o que uma revisão deixou pendente) ou `estudo`
(a entrega é uma DECISÃO, não código).

**Nota = I × U**, de 1 a 25. As duas escalas respondem perguntas diferentes:

| | Importância (I) — o que se perde se NÃO fizer | Urgência (U) — o que se perde se ESPERAR |
|---|---|---|
| **5** | falta mídia ou conteúdo no culto: é a promessa do app | pode estragar o PRÓXIMO sábado |
| **4** | atrapalha o preparo da semana, sempre | defeito relatado em produção; pode repetir a qualquer sábado |
| **3** | atrito real, contornável | o operador está esperando para trabalhar melhor |
| **2** | polimento visível, sem atrapalhar | espera um lote tranquilo |
| **1** | manutenção interna, invisível no uso | quando houver folga |

**Faixas:** Agora (20–25) · Próximo (12–19) · Na fila (6–11) · Folga (2–5) ·
Estudo (à parte, não é fila de execução).

**Empate:** defeito antes de pedido, antes de resíduo, antes de estudo; depois o
que destrava outro item; depois o lote menor.

**A nota é julgamento, não medida** — ela olha o que o operador já disse e o que o
código mostra, e os dois vêm datados em cada item. O operador pode inverter a
ordem; a fila é dele.

---

## O índice — 2026-11-09

| # | pacote · pedido | tipo | I | U | nota | entrega |
|---|---|---|---|---|---|---|
| **3** | **Playlist: o item que não entra ao trocar de modo** | defeito | 4 | 3 | **12** | web |
| 3.1 | o item iniciado no Fácil não entra na fila no Avançado | | 4 | 3 | 12 | web |
| **4** | **Modo Fácil: volume, coleções e Configurações** | pedido | 4 | 2 | **8** | web |
| 4.1 | indicador de volume flutuante + botão de tela cheia | | 4 | 2 | 8 | web |
| 4.2 | as coleções em "Diversos" e os elementos fixos | | 3 | 2 | 6 | web |
| 4.3 | revisar as opções de Configurações que aparecem | | 3 | 1 | 3 | web |
| **5** | **Itinerário: a abertura antes do primeiro evento** | pedido | 4 | 2 | **8** | web |
| 5.1 | contagem regressiva + música + avisos | | 4 | 2 | 8 | web |
| **6** | **Link do YouTube: os detalhes no oferecimento** | pedido | 3 | 2 | **6** | Kotlin + web |
| 6.1 | miniatura, título, duração e canal antes de usar | | 3 | 2 | 6 | Kotlin + web |
| **7** | **Verificação: procurar atualização** | pedido | 3 | 2 | **6** | web |
| 7.1 | a checagem que oferece o "Atualizar agora" | | 3 | 2 | 6 | web |
| **8** | **CI: os oráculos instáveis (residual)** | resíduo | 3 | 2 | **6** | tools |
| 8.1 | `configuracoes-janelas` D, instrumentado | | 3 | 2 | 6 | tools |
| **9** | **Folha do vídeo: o teto e o botão "Detalhes"** | pedido | 2 | 2 | **4** | web |
| 9.1 | sem o aviso do teto; o quinto botão sem linha própria | | 2 | 2 | 4 | web |
| **10** | **Configurações e Ferramentas: o editor e o tile** | pedido | 2 | 2 | **4** | web |
| 10.1 | "Editar mídia" vai para a lista das Ferramentas | | 2 | 2 | 4 | web |
| 10.2 | sai o tile "Saída de áudio" (no mesmo lote) | | 2 | 2 | 4 | web |
| **11** | **Favoritos: o `⋮` sempre visível** | pedido | 3 | 1 | **3** | web |
| 11.1 | o `⋮` na linha, sem abrir a gaveta antes | | 3 | 1 | 3 | web |
| **12** | **Limpeza e otimização do repositório (residual)** | pedido | 2 | 1 | **2** | docs |
| 12.1 | a lista dos mortos da auditoria de eficiência | | 2 | 1 | 2 | docs |
| **13** | **Estudos — não são fila de execução** | estudo | 4 | 1 | **4** | decisão |
| 13.1 | controle de slides + compartilhar itinerário/cronograma | | 4 | 1 | 4 | estudo |
| 13.2 | transmissão ao vivo | | 3 | 1 | 3 | estudo |
| 13.3 | app no Windows + layout de paisagem | | 3 | 1 | 3 | estudo |

---

## Pacote 3 — Playlist: o item que não entra ao trocar de modo

**Nota 12 (I4 × U3) · defeito a confirmar · só web**

**Onde:** os caminhos `simple*` × o `send`/fila do modo avançado; a remontagem da
playlist na troca de modo.

### 3.1 O item iniciado no Fácil não entra na fila no Avançado

*"O problema do item que não entra limpando a playlist, é quando o item é
iniciado no modo simples e depois se vai para o modo avançado."* (2026-11-07
10:38).

Defeito relatado (a confirmar): um item iniciado no Modo Fácil e, depois da troca
para o Modo Avançado, não entra na playlist ao "limpar" (a substituição da fila).
Suspeita: a troca de modo reconstrói a playlist e o item em curso perde o vínculo
com a fila. Reproduzir a sequência exata (iniciar no Fácil → trocar para o
Avançado → limpar a playlist → o item não aparece) e achar onde a fila é
remontada na troca. Oráculo de Chromium com essa sequência.

---

## Pacote 4 — Modo Fácil: volume, coleções e Configurações

**Nota 8 (I4 × U2) · pedido · só web, salvo se a captura sempre ligada pedir o
`MainActivity`**

**Onde:** `simple*` de `controle.js` e o bloco "Este sábado".

### 4.1 Indicador de volume flutuante e o botão de tela cheia

Pedido (2026-10-31 09:02). Hoje o volume só tem retorno visual em parte dos
estados (`mostrarVolumeDaTelaCheia` existe para a tela cheia); na busca da
Biblioteca ou sem nada tocando as teclas físicas não mostram nada. Estudo:

- um indicador FLUTUANTE único (uma pílula opaca com a barra e o número), que
  aparece só quando as teclas físicas são usadas (`__avVolumeKey`) e some sozinho
  em ~1,5 s — o mesmo em toda tela; substitui o indicador atual e o da tela cheia
  (uma peça só). Ele não pode cobrir o transporte; rodapé flutuante é opaco
  (regra da paleta);
- **a pergunta a resolver:** o que a tecla controla sem nada tocando? Hoje ela só
  é capturada depois que o web pede (`captureVolumeKeys(true)`); se a captura
  estiver desligada nesse estado, o painel do sistema aparece e o nosso não —
  decidir se o indicador mostra o volume do APP (preview/telão) ou se a captura
  passa a valer sempre no Modo Fácil (com a válvula no zero e no teto);
- o botão exclusivo de volume da linha de controles do Modo Fácil (v1.13.8) vira
  **tela cheia** da prévia. **Resposta do operador (2026-11-06):** é quando há
  algo em exibição e se vai para a tela cheia da preview, que ocupa a tela toda,
  com os controles sobre a imagem — o mesmo modelo de controles da tela cheia que
  já existe (play/pause no centro, sair no canto, nome e linha do tempo nas
  faixas; ver `docs/DIVERGENCIAS-WEB-NATIVO.md`, "Fullscreen da preview"). Sem
  nada em exibição, o botão fica apagado com o motivo.

### 4.2 As coleções em "Diversos" e os elementos fixos

*"No modo simples, além da coleção de cds do ano, o resto ficará na coleção de
diversos. Assim terá mais espaço para deixar mais elementos fixos após os vídeos
da semana. Coisas como ofertório e abertura para a adoração infantil."*
(2026-11-07 19:33).

Reorganizar as coleções do Modo Fácil: só a coleção dos CDs do ano fica separada;
o resto cai em "Diversos". O espaço liberado abre vaga para ELEMENTOS FIXOS
depois dos vídeos da semana (ex.: ofertório, abertura para a adoração infantil).
Planejar quais elementos fixos e onde moram. A ORDEM das coleções simples entra
aqui — a 1.4 antiga fixou só a ordem da Biblioteca.

### 4.3 As opções de Configurações no Modo Fácil

*"Revisar quais opções das configurações aparecem no modo simples"* (2026-11-07
19:24).

Levantar quais tiles/opções de Configurações aparecem no Modo Fácil e cortar o
que não cabe (regra: apagado = indisponível, nunca inerte; o que não tem função
agora some). Conferir a grade de Configurações no Modo Fácil.

---

## Pacote 5 — Itinerário: a abertura antes do primeiro evento

**Nota 8 (I4 × U2) · pedido · só web, depois de planejar**

**Onde:** o Itinerário como provedor por descritor, a Camada de Texto e a regra
do `sorteio.js`.

### 5.1 A contagem regressiva, a música e os avisos

Pedido do operador (2026-10-30): uma OPÇÃO do Itinerário (um interruptor só,
*"com tudo automatizado"*) que, antes do primeiro evento do itinerário ativo, põe
no telão uma tela de espera: contagem regressiva até o primeiro horário, música
de fundo de PLAYBACKS aleatórios do Hinário (a regra do `sorteio.js`, categoria
do hinário, variante playback) e, se houver, avisos. Termina sozinha no horário
do primeiro evento. Itinerário = eventos e títulos; Cronograma = mídias — não se
fundem (o operador recusou a fusão). A planejar: o que conta como "avisos"
(Mensagens? apresentação?), a camada de texto que leva a contagem (o Itinerário
já é provedor por descritor), e o que acontece se o operador tocar algo no meio.

---

## Pacote 6 — Link do YouTube: os detalhes no oferecimento

**Nota 6 (I3 × U2) · pedido · Kotlin + web (APK/Release)**

**Onde:** `ShareIntake.kt` → a PERGUNTA antes de usar; `YoutubeGrab.detalhes` e o
`ytDetalhes` da ponte.

### 6.1 Miniatura, título, duração e canal antes de usar o link

*"Ao acessar o app com um link do YouTube copiado, ele oferece para usar o link,
mas nesse oferecimento, ele não dá detalhes sobre o vídeo do link, então ajuste
para que nesse oferecimento ele dê os Detalhes como thumbnail, título, duração e
canal."* (2026-11-07 19:00).

No oferecimento do link copiado, mostrar os detalhes do vídeo: miniatura, título,
duração e canal. **Medido em 2026-11-09:** o `detalhes` já devolve `titulo`,
`canal`, `seconds` (a DURAÇÃO já vem) e `descricao`; o que falta é a MINIATURA — a
lista de miniaturas que o extrator carrega não é lida hoje (zero ocorrências de
`thumbnails` no Kotlin), e o web não conhece `i.ytimg.com` (zero ocorrências).
Isto é Kotlin pequeno (acrescentar o campo ao `JSONObject`) mais o desenho da
folha do oferecimento — no mesmo lote, com `shellTag`.

---

## Pacote 7 — Verificação: procurar atualização

**Nota 6 (I3 × U2) · pedido · só web**

**Onde:** a Verificação do Sistema; a ponte `atualizacaoEstado` e `otaCheck`; o
diálogo do OTA.

### 7.1 A checagem que oferece o "Atualizar agora"

*"O verificar deve também procurar por atualizações, se estiver disponível,
oferecer a atualização."* (2026-11-07 08:55).

A Verificação do Sistema ganha uma checagem que LÊ o estado do OTA e, havendo
base nova, oferece o "Atualizar agora" — o MESMO diálogo do OTA (o shell só
AVISA, quem aplica é o web; regra de `docs/shell/OTA.md`). **Medido em
2026-11-09:** o `otaPending` que esta lista citava não existe desde a v1.13.47
(órfão removido na X1); o que há é `atualizacaoEstado()` (os quatro campos que a
tela já lê), `otaCheck(forcar)` e `otaApply`. Respeitar `docs/DIAGNOSTICO.md`:
uma checagem não baixa megabytes — ela só aponta para o fluxo que já existe; o
desfecho é `não se aplica` quando não há nada pendente.

---

## Pacote 8 — CI: os oráculos instáveis (residual)

**Nota 6 (I3 × U2) · resíduo · só `tools/` + workflow**
**Gatilho:** só volta ao primeiro plano se o CI reprovar de novo num oráculo de
tempo.

### 8.1 O que a A1 deixou instrumentado

> **Tratado pela etapa A1 da revisão (2026-10-30)** — o relatório está em
> `docs/revisao/REGISTRO.md` (A1, "feita com um resíduo"). Fica aqui como
> residual, não como trabalho aberto em primeiro plano.

Pedido do operador (2026-10-30): *"Urgente. Coloque em prioridade."* O lote
v1.13.16 reprovou TRÊS rodadas seguidas, cada uma num oráculo DIFERENTE, todos de
tempo e nenhum tocado pelo lote; todos passam na máquina local. Cinco foram
consertados; um ficou INSTRUMENTADO, não consertado: `configuracoes-janelas` D
(repasse A5). O método de conserto é o da campanha de determinismo da v5.316
(`grep -n "v5.316" docs/HISTORICO.md`): achar em cada um a espera que mede o
RUNNER e trocá-la pelo FATO (`esperar`/`esperarDb`), nunca subir prazo; rodar sob
carga (3 processos + `stress`) até reprovar localmente antes de consertar, e
repetir depois. Isto protege o canal: um vermelho no `verificar` segura o bundle.

---

## Pacote 9 — Folha do vídeo: o teto e o botão "Detalhes"

**Nota 4 (I2 × U2) · pedido · só web**

**Onde:** `openYtMenu` (a legenda que o `ytSegRow` recebe), `destBotaoDetalhes` e
a régua do rótulo no `destinos-diretos`.

### 9.1 Sem o aviso de teto e sem uma linha só para o quinto botão

*"Remova a mensagem 'teto de qualidade, vale para o tocar agora e fica como
padrão' que temos nos vídeos. Também verifique se não está desperdiçando espaço
criando uma outra linha apenas para o botão de detalhes... Talvez apenas faça uma
versão de título mais curta como apenas 'Detalhes'."* (2026-11-07 09:12).

- **(a)** tirar a legenda do teto: ela é o último argumento do `ytSegRow` em
  `openYtMenu` (`'Teto de qualidade — vale para o "Tocar agora" e fica como
  padrão'`). Conferir a altura da fileira depois — a legenda ocupa uma linha.
- **(b)** o botão de DETALHES (o quinto da fileira, v1.13.34) não pode custar uma
  linha própria: hoje o `destBotaoDetalhes` alterna
  `['Ver os detalhes', 'Ocultar os detalhes']`, e é esse rótulo largo que o
  operador vê descer sozinho numa linha na célula estreita (360×1,25×). Encurtar
  para "Detalhes" nos dois estados, com o aberto/fechado no `on`/`aria-pressed`
  que o botão já alterna. A asserção do `destinos-diretos` A mede o rótulo — muda
  no mesmo lote.

---

## Pacote 10 — Configurações e Ferramentas: o editor e o tile

**Nota 4 (I2 × U2) · pedido · só web**

**Saem juntos:** a saída do editor abre a vaga que o tile ocupava — tirar os dois
no mesmo lote evita a grade com buraco.

### 10.1 O editor de mídia vai para as Ferramentas

Pedido do operador (2026-10-30). "Editar mídia" é seção de Configurações
(`#cfgSecoes`, v1.12.48) e passa a ser uma ferramenta da LISTA das Ferramentas
(`FERRAMENTAS`, `abrirFerramenta`). A grade de Configurações perde um tile — é a
vaga que o tile "Saída de áudio" esperava (ver 10.2). Conferir o voltar do Android
(a lista das Ferramentas, degrau 2.5) e o rascunho `edicaoRascunho`.

### 10.2 Tirar o tile "Saída de áudio"

Decisão do operador (2026-10-30): o projeto da janela da Samsung foi ABANDONADO —
não há caminho documentado (a One UI não expõe a dela; a única via pública,
`MediaRouter2.showSystemOutputSwitcher`, abre a do Android, e é o que o tile faz
desde a v1.13.16). O operador usa o atalho do próprio aparelho. O tile sai JUNTO
com o 10.1: o tile, o `abrirSaidaDeAudio` do web (o Kotlin pode ficar órfão, o
lado seguro), e as linhas *"Mídia saindo agora por"* e *"Não Perturbe"* do
Registro ficam (o `saidaDeAudioAlvo` continua).

---

## Pacote 11 — Favoritos: o `⋮` sempre visível

**Nota 3 (I3 × U1) · pedido · só web**

**Onde:** `linhaDeItem`/`renderItemMenu` (o `dest-opcoes` nasce DENTRO da gaveta)
× a coluna `.row-slot` do Cronograma.

### 11.1 O `⋮` na linha, sem abrir a gaveta antes

*"O botão de opções nos itens dos favoritos, ficará sempre visível, como no
cronograma."* (2026-11-07 10:37).

**O que a v1.13.36 já fez:** a faixa excluir · renomear · ↑↓ saiu da fileira
própria e foi para trás de um `⋮` na fileira de destinos — o mesmo mecanismo do
Cronograma (`alternarAcoesDaLinha`), com o "Ver a letra" só para registro com
letra. **O que falta:** esse `⋮` é criado pelo `renderItemMenu`, então ele só
existe DEPOIS de a gaveta abrir (um toque na linha); no Cronograma o `⋮` é a
coluna `.row-slot` da própria linha, sempre à vista. Subir o `⋮` para a linha do
favorito, abrindo a faixa de ações por cima (o `.acoes-abertas`) sem depender de a
gaveta estar aberta. Conferir o alvo de toque da linha e os oráculos que medem a
coluna do `⋮` (`cronograma-acoes-cheias`, `destinos-diretos` D).

---

## Pacote 12 — Limpeza e otimização do repositório (residual)

**Nota 2 (I2 × U1) · pedido · só docs**

**Onde:** `docs/AUDITORIA-EFICIENCIA-2026-09.md` (a lista dos mortos) e o que as
revisões S/K/C/X não tocaram.

### 12.1 A poda que sobrou

Pedido do operador (2026-10-30): *"realmente estamos a muito tempo sem"*.

**O que já foi feito:** o alvo nº 1 que abriu o pedido — o bloco *"Versão atual"*
do `CLAUDE.md` voltou a ser três linhas (medido em 2026-11-09); o
`ACHADOS-EM-ABERTO.md` está vazio desde 2026-11-09; a tabela de divergências
virou o mapa compacto do `CLAUDE.md` mais o capítulo
`docs/DIVERGENCIAS-WEB-NATIVO.md`; e as revisões S1/S2, K1–K6, C2–C9 e X1–X2
podaram comentário em CSS, Kotlin e `controle.js`.

**O que resta:** a lista dos MORTOS da auditoria de eficiência
(`AUDITORIA-EFICIENCIA-2026-09.md`), a conferência dos `docs/` que nenhuma
revisão tocou, e a poda de comentário com as DUAS provas da seção "Documentação"
do `CLAUDE.md` — no arquivo que ainda não passou por ela.

---

## Pacote 13 — Estudos (não são fila de execução)

Três estudos preliminares; nada sai para código sem decisão do operador. A nota
deles mede o valor da RESPOSTA, não de uma entrega — por isso ficam fora das
faixas.

### 13.1 Controle remoto de slides e compartilhamento de itinerários

| hora | pedido | o que já se sabe |
|---|---|---|
| 2026-10-30 | *"controle remoto de slides para o pregador, algum link de site, endereço ou código que não requer internet… onde ele pode controlar os slides pelo próprio aparelho dele, seja vendo os slides. Ou… integração com aparelhos de passagem de slides bluetooth"* | ESTUDO. Duas vias. **(a) Passador Bluetooth:** quase todo passador é um TECLADO HID (manda PageDown/PageUp, setas, às vezes B/F5); pareado com o celular, as teclas chegam à `MainActivity.onKeyDown` como chegam as de volume — o caminho já existe (`captureVolumeKeys` → `__avVolumeKey`), e ligar `KEYCODE_PAGE_DOWN/UP`, `DPAD_RIGHT/LEFT` ao ⏮/⏭ de slide é Kotlin pequeno + Release. Medir: quais teclas os passadores comuns mandam, e se o pareado como teclado esconde o teclado virtual. **(b) Pelo celular do pregador:** o servidor das telas da rede (sem internet, Wi-Fi ou ponto de acesso) já serve páginas; uma página de CONTROLE (anterior/próximo, e opcionalmente a página atual em miniatura) por uma rota nova com o mesmo pareamento e teto de sessões. Cuidado: hoje a rota de subida aceita só `TIPOS_QUE_SOBEM` (lista de permissão) — um comando de slide vindo da rede é uma porta nova de CONTROLE, não só de exibição, e pede decisão de segurança (código de entrada? só no ponto de acesso?). Ver `docs/TELAO-POR-COMANDOS.md` |
| 10:34 | *"Vamos estudar e planejar um sistema de compartilhar itinerários e ou cronogramas de forma mais facilitada… compartilhar no whatsapp… um simples link, que ao tocar, abre o app, e busca/baixa oque for necessário inclusive baixando diretamente do aparelho de origem… Talvez precisamos de um servidor? Estude as opções para o menor atrito possível…"* | entregável é um ESTUDO para o operador decidir, não código. Eixos: link de app (App Links no domínio `audiovisualiasd.com.br`, que já é nosso — exige o arquivo de associação de domínio (Digital Asset Links) no `site/` e `intent-filter` no manifesto, logo Release) vs. arquivo `.avpkg` pequeno só com a LISTA; de onde vem a mídia (LouvorJA e YouTube já são re-baixáveis por id; mídia própria do aparelho é o problema difícil — sem servidor, só com os dois aparelhos online ao mesmo tempo); e o que NÃO viajar (privacidade, `docs/MEDICAO-DE-ALCANCE.md`). Comparar com o `.avpkg` atual (`docs/recursos/PACOTE.md`) |

### 13.2 Transmissão ao vivo (câmera fixa → YouTube)

Pedido (2026-10-31 11:53): um segundo celular dedicado é a CÂMERA (720p/30 na
tomada); manda o vídeo pela rede local ao celular de CONTROLE, com ~1 s de
buffer; o Controle reenvia por RTMP ao YouTube. **Estudo preliminar, nada
decidido.** Ver antes a auditoria `docs/AUDITORIA-ESTABILIDADE-AV.md` e os
achados do áudio do espelhamento em `docs/ACHADOS-EM-ABERTO.md` (a "escada da
transmissão").

| peça | caminho mais curto | dificuldade |
|---|---|---|
| sinalização câmera ↔ controle | o servidor das telas da rede (`EspelhoServidor`, Wi-Fi ou ponto de acesso) já pareia aparelhos sem internet; a câmera seria um 4º papel (`camera`) ou uma página servida | baixa — mas é porta nova de SUBIDA (hoje só `TIPOS_QUE_SOBEM`) |
| captura na câmera | `getUserMedia` exige contexto seguro: no WebView do app ok (`appassets`), mas o projeto NEGA captura por invariante (`onPermissionRequest` nega com log; `tools/sem-captura.test.mjs` cobra). Ligar a câmera só no papel `camera` é decisão de projeto. Num navegador comum, o certificado do `EspelhoCert` é autoassinado (aviso de segurança) | média |
| WebRTC com 1 s de buffer | possível: `RTCRtpReceiver.jitterBufferTarget` (Chromium) aceita até ~4 s | baixa |
| **reenvio RTMP** | **nenhum navegador fala RTMP.** O vídeo teria de sair do WebView para o Kotlin — e tirar quadros decodificados do WebView para re-codificar é caro e frágil | **alta** |
| alternativa sem re-codificar | a câmera codifica H.264/AAC em Kotlin (`MediaCodec`, como o `MuxMp4` já usa o lado de multiplexação) e manda pela LAN; o Controle só REMULTIPLEXA para FLV/RTMP, sem decodificar. Ou mais simples: a câmera manda RTMP DIRETO ao YouTube e o Controle só VÊ (prévia) e manda (início/fim). Perde: sobrepor letra/slides na live (exige compor e re-codificar) | média; RTMP à mão (handshake + FLV) é ~500 linhas Kotlin, ou uma dependência (seria a 5ª exceção, com justificativa) |
| YouTube | chave de transmissão colada pelo operador (sem OAuth) é o mínimo; criar a transmissão pelo app exige a API do YouTube com OAuth — bem mais | média |
| riscos de culto | aquecimento e bateria dos dois aparelhos por 2 h; uplink da igreja (720p30 ≈ 2,5–4 Mb/s); o Wi-Fi da igreja passa a carregar câmera + telas da rede; o Controle já hospeda dois WebViews e a `Presentation` (memória) | — |

**Recomendação do estudo:** começar pela via "câmera manda RTMP direto, o
Controle comanda e mostra a prévia" — é a única que não põe o vídeo da live
dentro do processo do telão. Vizinho do 13.1 (controle remoto do pregador pelo
mesmo servidor): as duas são PORTAS NOVAS DE SUBIDA e a decisão de segurança
(código de entrada? só no ponto de acesso?) é UMA só para as duas. Pede Release
(Kotlin) e decisão sobre a invariante de captura.

### 13.3 O app no Windows, e o layout de paisagem

Pedido (2026-10-31). **Estudo preliminar.** O fato que decide quase tudo: a base
web JÁ roda no navegador (o PWA de origem); o que o app Android acrescenta é a
ponte (`window.AVNative`, 64 métodos). Portar = escrever OUTRA casca, não
reescrever o app.

| caminho | como | prós | contras |
|---|---|---|---|
| **(A) PWA no Edge/Chrome** | instalar a base web como app do navegador | zero código; `showDirectoryPicker` existe; arrasta a janela do telão para o 2º monitor | sem YouTube baixado (CORS), sem cifra, sem séries, sem servidor das telas da rede, sem OTA nosso; dois apps/janelas (o modelo antigo) |
| **(B) casca nativa com WebView2** (C#/.NET + WinUI ou WinForms) | o MESMO desenho do Android: `SetVirtualHostNameToFolderMapping` dá um origin `https://` (contexto seguro), dois WebView2 no MESMO perfil compartilham IDB/OPFS/BroadcastChannel; o telão é uma JANELA sem borda posicionada no monitor secundário (`Screen.AllScreens`) — mais simples que a `Presentation` | as invariantes 1–3 se traduzem 1:1; `AddHostObjectToScript` faz o papel do `addJavascriptInterface`; Windows tem 2º monitor por cabo HDMI (sem Miracast) | reescrever a ponte em C#: SAF→pastas do disco (mais fácil), `YoutubeGrab`/`TrilhaAudio` dependem do NewPipeExtractor (Java) — no Windows seria `yt-dlp` (executável externo) ou portar; `MuxMp4`, `EspelhoServidor` (HttpListener), OTA, `SlideDeck` (PDF via `Windows.Data.Pdf`), instalador e assinatura de código |
| (C) Electron/Tauri | casca JS/Rust | menos C# | dependência grande, contra a regra "sem dependências externas" |

**Recomendação do estudo:** (B), em fases — 1) casca + telão no 2º monitor +
pastas (o culto básico); 2) YouTube/séries; 3) telas da rede e OTA. Guarda no
web: continua só `if (!window.__NATIVE__)`; os métodos sem par no Windows
respondem o desfecho inofensivo (a mesma regra do papel `display`). Custo maior:
manter DUAS cascas a cada degrau de `SHELL_VERSION`.

**O layout de paisagem** é o pedaço que vale JÁ, independente do Windows: serve
tablet Android, celular deitado e o Windows. Hoje o Controle é retrato fixo
(manifesto `portrait`) com uma coluna. Estudo: um `@media (orientation:
landscape) and (min-width: …)` em DUAS colunas (Biblioteca/Cronograma à esquerda,
prévia + transporte + letra à direita), sem duplicar DOM; folhas viram painéis
laterais. Riscos: a escada de camadas, as folhas que "não mudam de tamanho entre
estados", e os oráculos geométricos medidos só em retrato (cada um ganha a célula
de paisagem). Liberar a rotação no Android é Release; o CSS é OTA. Se o operador
quiser só a paisagem, ela é um lote de web — e não espera o estudo do Windows.

---

## O que saiu desta lista (rastro, não log)

**v1.13.51 (2026-11-09), DEPOIS desta edição:** o **Pacote 1** — o episódio
baixado pelo atalho da semana não se perde mais (`serieReterBaixado` +
`serieAutoRefazer`), com a nota em `docs/HISTORICO.md`. Ele sai do índice e da
seção; os números dos outros não se movem.

**v1.13.52 (2026-11-09), o lote seguinte:** o **Pacote 2** — o alerta de "não
está pronto" com o "Baixar tudo" (`faltaParaTocarSemRede` + `baixarTudoQueFalta`)
e o segurar-arrasta em lugar do par ↑↓, com a seleção múltipla saindo inteira. A
nota está em `docs/HISTORICO.md`; o oráculo é o `cronograma-pronto`.

Saíram entre a edição anterior (2026-11-08) e esta, com a nota em
`docs/HISTORICO.md`:

- **v1.13.37/38 — a Área 1 inteira, menos o episódio offline (o antigo 1.2,
  hoje o Pacote 1):** a contagem do card pela lista
  (`serieTotalVisivel`), a extração das playlists
  `LOCKUP_CONTENT_TYPE_COURSE` (`playlistsDoCanal`), o item virtual do "Tocar
  agora" na fila (`replacePlaylistWith` no `semanaAcao`), a ordem Informativo →
  Provai e Vede (`serieCollections`) e os `.catch` mudos da retenção virando
  linha no Registro.
- **v1.13.50 — a 9.3:** o `varrerCache` do `YoutubeGrab` apaga o que está em
  `cache/yt` sem dono há mais de 1 h, poupando os arquivos que o registro de
  desfechos aponta.
- **v1.13.36 — metade da 4.1:** as opções do favorito foram para trás do `⋮`; o
  que faltava virou o Pacote 11.

O rastro anterior (v1.13.4 a v1.13.36) está no `docs/HISTORICO.md`; esta lista
não o repete.

---

## Mapa da numeração antiga

A numeração foi refeita do zero em 2026-11-09. Para decifrar referências
anteriores (o `docs/REVISAO-PROFUNDA.md` cita "Pacote 8" e "pacotes 9–12"; o
`docs/ACHADOS-EM-ABERTO.md` citava "Pacote 6"):

| até 2026-11-08 (Área) | antes disso (Pacote) | hoje (Pacote) |
|---|---|---|
| 1 — Séries | 13 e 21 | 1 (só o 1.1) |
| 2 — Modo Fácil | 16 e 26 | 4 |
| 3 — Cronograma | 10 e 24 | 2 |
| 4 — Favoritos | 22 | 11 |
| 5 — Folha do vídeo | 20 | 9 |
| 6 — Playlist | 23 | 3 |
| 7 — Link do YouTube | 25 | 6 |
| 8 — Verificação | 19 | 7 |
| 9 — Configurações e Ferramentas | 9 | 10 |
| 10 — Itinerário | 11 | 5 |
| 11 — Limpeza | 12 | 12 |
| 12 — Estudos | 6, 17 e 18 | 13 |
| 13 — CI | 8 | 8 |

O "Pacote 6" antigo (o estudo de abrir a lista de aparelhos de áudio) NÃO existe
mais: o operador abandonou o projeto da janela da Samsung em 2026-10-30, e o
tile passou a abrir a API pública na v1.13.16 — o que sobrou dele é o 10.2.
