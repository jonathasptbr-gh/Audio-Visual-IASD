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
saído na v1.13.50. O rastro está ao fim. **Os Pacotes 1, 2 e 3 saíram** — o 1 na v1.13.51, o 2 na v1.13.52 (2026-11-09) e o 3 na v1.13.56; os que
ficam MANTÊM a numeração — renumerar de novo custaria mais que o buraco, e o
"Mapa da numeração antiga" continua valendo para as referências velhas.

**Regra do arquivo:** ele ESVAZIA. Um pacote entregue sai daqui (a nota vai ao
`docs/HISTORICO.md`, como sempre); um pedido revogado sai com uma linha dizendo
quem revogou. Não é log, e não é `docs/ACHADOS-EM-ABERTO.md` (lá moram defeitos
CONFIRMADOS por auditoria; aqui, pedidos).

**Contexto da entrega:** medido por `tools/estado.sh` — **não escreva número de versão aqui**; ele envelhece em horas (este parágrafo dizia v1.13.51 quando a base já era a 1.13.55). O operador pediu economia:
*"não temos tokens então toda ação deve ser fracionada e controlada"* — um pacote
por vez, cada um com o rito de entrega completo.

---

## Os pacotes, em uma linha

**Leia SÓ o pacote escolhido** — esta tabela responde "qual"; o resto
do arquivo responde "o quê". `tools/estado.sh` imprime a mesma lista.
Nada aqui está autorizado: **pergunte ao operador qual seguir**.

| pacote | nota | tipo | área |
|---|---|---|---|
| **5** — Itinerário: a abertura antes do primeiro evento | 8 (I4×U2) | pedido | só web, depois de planejar |
| **6** — Link do YouTube: os detalhes no oferecimento | 6 (I3×U2) | pedido | Kotlin + web (APK/Release) |
| **7** — Verificação: procurar atualização | 6 (I3×U2) | pedido | só web |
| **8** — CI: os oráculos instáveis (residual) | 6 (I3×U2) | resíduo | só `tools/` + workflow |
| **9** — Folha do vídeo: o teto e o botão "Detalhes" | 4 (I2×U2) | pedido | só web |
| **12** — Limpeza e otimização do repositório (residual) | 2 (I2×U1) | pedido | só docs |
| **13** — Estudos (não são fila de execução) | — | estudo | nenhuma entrega |
| **15** — Guia IASD: a especialização (estudo) | — | estudo | nenhuma entrega |
| **16** — O cronograma pronto: o organizador entrega o culto ao sonoplasta | 8 (I4×U2) | pedido | planejamento → Kotlin + web |

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

## O índice — 2026-11-13

| # | pacote · pedido | tipo | I | U | nota | entrega |
|---|---|---|---|---|---|---|
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
| **12** | **Limpeza e otimização do repositório (residual)** | pedido | 2 | 1 | **2** | docs |
| 12.1 | a lista dos mortos da auditoria de eficiência | | 2 | 1 | 2 | docs |
| **13** | **Estudos — não são fila de execução** | estudo | 4 | 1 | **4** | decisão |
| 13.1 | controle de slides + compartilhar itinerário/cronograma | | 4 | 1 | 4 | estudo |
| 13.2 | transmissão ao vivo | | 3 | 1 | 3 | estudo |
| 13.3 | layout de paisagem (o app no Windows saiu) | | 3 | 1 | 3 | estudo |
| **15** | **Guia IASD: a especialização (estudo)** | estudo | — | — | **—** | decisão |
| **16** | **O cronograma pronto: o organizador entrega o culto** | pedido | 4 | 2 | **8** | planejamento |

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

**Promovido em 2026-11-13:** o eixo (b) deste estudo virou o **Pacote 16** — o
operador deu o caso de uso (o líder de desbravadores e o cronograma da
cerimônia) e pediu planejamento. O (a), o passador Bluetooth, continua só
estudo.

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

### 13.3 O layout de paisagem

Estudo (2026-10-31). **O app no Windows saiu do projeto** — decisão do operador
em 2026-11-13, depois do estudo: não haverá segunda casca nativa. O que sobra
nesta linha de fila é o pedaço que nunca dependeu dele.

O Controle é **retrato fixo** (manifesto `portrait`) com uma coluna. Serve
tablet Android, celular deitado e qualquer tela larga. Estudo: um
`@media (orientation: landscape) and (min-width: …)` em DUAS colunas
(Biblioteca/Cronograma à esquerda, prévia + transporte + letra à direita), sem
duplicar DOM; folhas viram painéis laterais. Riscos: a escada de camadas, as
folhas que "não mudam de tamanho entre estados", e os **76 oráculos que medem
geometria** — eles partem do viewport de 430×900 do arnês (`tools/arnes.mjs`),
que é a forma de um celular em pé; cada um ganha a célula de paisagem. Liberar a
rotação no Android é Release; o CSS é OTA.

---

## Pacote 15 — Guia IASD: a especialização (estudo)

**Nota — · estudo · nenhuma entrega de código (a entrega é a DECISÃO do operador)**

Pedido do operador (2026-11-12): especializar o Guia de sonoplastia IASD para a
Igreja Adventista do Sétimo Dia — exemplos e comentários adventistas, referências
a manuais oficiais, os programas da igreja (Escola Sabatina, Desbravadores,
ofertório, culto JA…), seções dedicadas ao hinário adventista (novo E antigo),
referências de cantores adventistas, o básico de teoria de música na igreja e uma
seção dedicada ao LOUVOR JA (projeção/coletânea multimídia). **A entrega é o
ESTUDO** `docs/ESTUDO-GUIA-IASD.md` (2026-11-12); a aplicação ao guia — que mora
em `site/sonoplastia/index.html` — só acontece depois da DECISÃO do operador
sobre o estudo. Nada aqui está autorizado.

---

## Pacote 16 — O cronograma pronto: o organizador entrega o culto

**Nota 8 (I4 × U2) · pedido · planejamento PRIMEIRO, depois Kotlin + web**

Pedido do operador (2026-11-13). Este pacote **promove** o estudo 13.1(b): o
compartilhamento de cronograma deixa de ser hipótese e vira o caminho de um
caso de uso concreto.

**O caso que o pediu:** *um líder de desbravadores organiza a cerimônia
inteira — as mídias, a ordem, os tempos — e precisa entregá-la ao sonoplasta.
Hoje isso é link por link no WhatsApp, ou um pendrive na mão.*

**O que "pronto" significa:** o destinatário toca no link e recebe o culto
montado — cronograma, itinerário, elementos e as mídias conforme a organização
do responsável —, sem procurar arquivo nem pedir nada a ninguém.

**O que já existe e não resolve sozinho:**

| peça | o que faz | por que não basta |
|---|---|---|
| `.avpkg` ([`PACOTE.md`](recursos/PACOTE.md)) | leva o acervo inteiro de um aparelho a outro | é um arquivo de gigabytes: não atravessa o WhatsApp, e não carrega a ORGANIZAÇÃO do culto |
| link de app (App Links em `audiovisualiasd.com.br`) | abre o app num endereço nosso | leva a lista, não a mídia |
| o Cronograma e o Itinerário | já existem como estrutura | não há como exportá-los como uma unidade entregável |

**O problema central:** a mídia é pesada e o link é leve. A saída provável é o
pacote **pequeno** — a organização, os ids re-baixáveis (YouTube e LouvorJA já
são re-baixáveis por id) e as impressões digitais do que precisa viajar — e o
app do destinatário completa o que falta. A mídia PRÓPRIA do organizador é o
caso difícil: sem servidor, os dois aparelhos precisam estar online juntos.

**O que decidir ANTES de codar** (é a etapa de planejamento, e a entrega é a
decisão):

1. **Servidor ou não.** A arquitetura não tem nenhum, e o operador já perguntou
   "talvez precisamos de um servidor?". Sem ele, o link sozinho não move bytes —
   e a resposta muda o custo de tudo.
2. **Quem é o dono do cronograma.** O organizador pode não ter o app. A autoria
   pelo site é uma via? Se for, o site deixa de ser só página de download.
3. **O que viaja.** A organização sempre; a mídia só quando não é re-baixável.
4. **O que NÃO viaja nunca.** Privacidade — ver
   [`MEDICAO-DE-ALCANCE.md`](MEDICAO-DE-ALCANCE.md).
5. **O consentimento.** Receber um cronograma não pode ser um comando remoto:
   o destinatário vê o que vai entrar e confirma antes. (É a mesma decisão de
   porta de ENTRADA que o 13.1 já levantou para o controle remoto de slides.)

**A regra que este pacote herda e não pode esquecer:** *importar só acrescenta*
(`PACOTE.md`); nada que já esteja no aparelho do sonoplasta é substituído.

---

## O que saiu desta lista (rastro, não log)

**v1.14.7 (2026-11-13), só web:** o **Pacote 10** inteiro — o "Editar mídia"
agora é uma linha da lista de Ferramentas (com o voltar do Android e o rascunho)
e o tile "Saída de áudio" saiu. Entraram no mesmo lote os três pedidos do dia: o
**10.3** (o tour vira quadrado on/off, no molde do "Dados móveis"), o **10.4** (a
pílula de volume a 12 px da borda) e o **10.5** (o recorte do tour preso à área
visível, com margem de halo nos quatro lados, e o balão a 16 px). Nota em
`docs/HISTORICO.md`; oráculos `tour`, `edicao-de-midia`, `ferramentas`,
`ferramentas-folha`, `configuracoes-janelas`, `abertura-e-transferencia`,
`saida-de-audio-e-economia` e `volume-troca`. Os números dos outros não se movem.

**2026-11-13 (só `site/`):** o **8.2** — o guia aberto pelo app a 320 px sem a rolagem lateral de 18 px (a grade de atalhos do D9 e o endereço longo, medidos com a fonte do runner), e o `guia-no-app` saindo 1 com FALHOU. Nota em `docs/HISTORICO.md`; o 8.1 continua.

**2026-11-12 (só `site/`):** o pacote do **Guia de sonoplastia** (anotado como "Pacote 14" por engano — o número já tinha saído na v1.13.61). A introdução (D0 e I0) entrou com o texto do operador, e as Perguntas e respostas foram **revogadas pelo operador**: *"Sobre as perguntas e respostas pode remover"*.

**v1.13.68 (2026-11-11):** o **Pacote 11** inteiro — o `⋮` sempre na linha do favorito, com o arrastar do Cronograma no lugar do ↑↓ (11.1), e a lista do acervo por partes, que evolui o conserto da gaveta (v1.13.67). Notas em `docs/HISTORICO.md`; oráculos `favoritos-menu-na-linha` e `lista-por-partes`. Os números dos outros não se movem.

**v1.13.67 (2026-11-11):** o defeito da **gaveta que fechava** sozinha ao abrir o Provai e Vede/Informativo (entrou como 11.2 e saiu no mesmo dia — a verificação da semana redesenhava a lista sem o guarda). Nota em `docs/HISTORICO.md`, oráculo `serie-gaveta-aberta`.

**v1.13.61 (2026-11-10):** o **Pacote 14** — a barra da Liturgia na coluna do texto (título em 85 px, alinhado com o nome das linhas). O pedido foi feito para ficar na fila e o operador decidiu executá-lo na hora.

**v1.13.57 (2026-11-10), o lote seguinte:** o **Pacote 4** — a pílula de volume única nos dois modos, as coleções do Modo Fácil em duas (CDs do ano e "Diversas"), os dois lugares de elemento fixo depois dos vídeos da semana, a terceira tecla do Modo Fácil virando tela cheia e as Configurações dele enxutas. A nota está em `docs/HISTORICO.md`; os oráculos são o `controles-layout`, o `video-tela-cheia`, o `modo-simples-teclas` e o bloco novo do `acervo`.

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
| 2 — Modo Fácil | 16 e 26 | 4 (saiu na v1.13.57) |
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
mais: o operador abandonou o projeto da janela da Samsung em 2026-10-30, o tile
passou a abrir a API pública na v1.13.16 e SAIU do app na v1.14.7.
