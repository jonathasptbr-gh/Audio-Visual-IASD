# Pedidos em espera (fila do operador)

Registro dos pedidos do operador **ainda não implementados**, em **pacotes**: um
pacote é o conjunto de pedidos que tocam a MESMA área de código/recurso e **saem
juntos**, num lote só, com o rito de entrega completo. Existe para sobreviver a
uma limpeza de contexto: quem retomar lê este arquivo e pergunta ao operador
**qual pacote seguir** — nada aqui está autorizado para execução sem essa
resposta.

**O resíduo fino NÃO mora aqui.** Comentário falso, asserção vacuosa, seletor
morto: o lote que os encontra fecha no mesmo dia, e o que não deu vai para
[`RESIDUOS.md`](RESIDUOS.md), não para esta fila. A fila é para o que precisa
de decisão do operador.

**Edição de 2026-11-09.** A lista foi relida contra o que já saiu (v1.13.36 a
v1.13.50), **renumerada do zero** (o Pacote 1 é o de maior prioridade) e
**recatalogada por importância × urgência** — o índice é a tabela **Os pacotes, em
uma linha**, e a nota é item a item. Nesta revisão três pedidos saíram inteiros (os antigos 1.1,
1.3 e 1.4), um foi reduzido (o antigo 4.1 virou o 11.1 de hoje), o antigo 11.1
ficou só com o que as revisões não cobriram, e o cache do antigo 9.3 já tinha
saído na v1.13.50. O rastro está ao fim. **Os Pacotes 1, 2 e 3 saíram** — o 1 na v1.13.51, o 2 na v1.13.52 (2026-11-09) e o 3 na v1.13.56; os que
ficam MANTÊM a numeração — renumerar de novo custaria mais que o buraco, e o
"Mapa da numeração antiga" continua valendo para as referências velhas.

**Edição de 2026-11-14.** O operador mandou oito mensagens em sequência (09:13–09:55)
sobre o TOUR dos dois modos, o alerta do Cronograma, a Bíblia, as Mensagens, o
Editor de mídia e uma porta nova para as ferramentas guardadas. Eles entraram
como os **Pacotes 17 a 23**, sem renumeração — os números andam presos às
referências que o `HISTORICO.md`, o `docs/revisao/` e este próprio arquivo já
fazem. A novidade desta edição é o agrupamento por TEMA (a tabela logo abaixo):
a fila continua sendo a coluna da NOTA do índice. **Nenhum pacote foi
executado** — esta edição é só a lista.

**Segunda edição de 2026-11-14 (a revisão das diretrizes).** O operador pediu
uma revisão do contrato, do rito e dos processos de revisão, aprovou os quatro
pacotes de conserto e mandou pô-los num arquivo de urgência: são os **Pacotes
24 a 27**. Eles foram os ÚNICOS pacotes desta fila **já autorizados** — um por
sessão —, e **os quatro saíram em 2026-11-14**, um por commit; o `URGENCIA.md`
esvaziou com o 27 e foi apagado. Os dois itens de decisão que estavam só no
`RESIDUOS.md` viraram os **Pacotes 28 e 29** (*"tudo entra na fila para ser
feito"*).

**Edição de 2026-11-15.** Três mensagens do operador (08:20–08:26): o ⏮/⏭ da
notificação, o "Imprimir" do guia que não abre no app e as anotações nos vazios
do guia impresso. Entraram como os **Pacotes 31 a 33**, mapeados contra o HEAD
`d5c15202` (as linhas citadas valem para ele). Os 32 e 33 saíram no mesmo dia
(v1.14.22) e o 31 na v1.14.23.

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
| **13** — Estudos (não são fila de execução) | 4 | estudo | nenhuma entrega |
| **16** — O cronograma pronto: o organizador entrega o culto ao sonoplasta | 8 (I4×U2) | pedido | planejamento → Kotlin + web |
| **20** — Cronograma: o alerta à esquerda | 4 (I2×U2) | pedido | só web |
| **29** — Guia do site: a captura das sete ferramentas | 2 (I2×U1) | resíduo | só site (pede o app em tela) |
| **30** — Ferramentas: duas arestas que o tour achou | 2 (I2×U1) | resíduo | só web |

---

## Os temas, em uma linha

Os pacotes abertos, agrupados pelo RECURSO que tocam. É a leitura "o que mexe
com o quê" — **não** é a ordem de execução: essa é a coluna da NOTA, no índice.
Um tema não é um lote: dois pacotes do mesmo tema podem sair em semanas
diferentes, e um lote nunca mistura dois temas.

| tema | pacotes | o que sai junto |
|---|---|---|
| **Cronograma e destinos** | 16, 20 | a abertura antes do culto e o alerta de "não baixado" à esquerda |
| **Site** | 29 | a captura da lista de Ferramentas, com as sete |
| **Ferramentas** | 30 | o Timer em zero que ainda projeta e guarda, e o editor de mídia vazio na instalação nova |
| **Fila anterior a 14/11** | 5, 6 | o que já estava na fila, na ordem que ela já tinha |
| **Estudos** | 13 | não são fila de execução: a entrega é a decisão do operador |

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

## O índice — 2026-11-15

| # | pacote · pedido | tipo | I | U | nota | entrega |
|---|---|---|---|---|---|---|
| **5** | **Itinerário: a abertura antes do primeiro evento** | pedido | 4 | 2 | **8** | web |
| 5.1 | contagem regressiva + música + avisos | | 4 | 2 | 8 | web |
| **6** | **Link do YouTube: os detalhes no oferecimento** | pedido | 3 | 2 | **6** | Kotlin + web |
| 6.1 | miniatura, título, duração e canal antes de usar | | 3 | 2 | 6 | Kotlin + web |
| **13** | **Estudos — não são fila de execução** | estudo | 4 | 1 | **4** | decisão |
| 13.1 | controle de slides + compartilhar itinerário/cronograma | | 4 | 1 | 4 | estudo |
| 13.2 | transmissão ao vivo | | 3 | 1 | 3 | estudo |
| 13.3 | layout de paisagem (o app no Windows saiu) | | 3 | 1 | 3 | estudo |
| **16** | **O cronograma pronto: o organizador entrega o culto** | pedido | 4 | 2 | **8** | planejamento |
| **20** | **Cronograma: o alerta à esquerda** | pedido | 2 | 2 | **4** | web |
| 20.1 | o par nome + alerta inverte a ordem | | 2 | 2 | 4 | web |
| **22** | **Bíblia: três versículos no controle** | pedido | 2 | 1 | **2** | web |
| 22.1 | sai o segundo futuro: 1 atrás, o atual e 1 à frente | | 2 | 1 | 2 | web |
| **23** | **Editor de mídia: a margem inferior** | defeito | 2 | 2 | **4** | web |
| 23.1 | a folha com o editor aberto, medida contra as ferramentas de painel | | 2 | 2 | 4 | web |
| **29** | **Guia do site: a captura das sete ferramentas** | resíduo | 2 | 1 | **2** | site |
| **30** | **Ferramentas: duas arestas que o tour achou** | resíduo | 2 | 1 | **2** | web |
| 30.1 | o Timer em 0:00: o ▶ apagado, o projetar e os dois guardar acesos | | 2 | 1 | 2 | web |
| 30.2 | o editor de mídia numa instalação nova: três grupos "0 mídias" e nenhum convite a importar | | 2 | 1 | 2 | web |

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

## Pacote 20 — Cronograma: o alerta à esquerda

**Nota 4 (I2 × U2) · pedido · só web**

**Onde:** `index.html` (o `.crono-par` da barra), `controle.css` (`.crono-par`,
`.crono-titulo` e o `padding-left` simétrico), os oráculos `cronograma-pronto`
e `barra-do-topo-e-titulos`.

Pedido (09:13): *"O icone de alerta sobre itens não baixados no cronograma, ele
atualmente esta na direita, deixe ele na esquerda."*

Hoje o par é `[#cronoTitulo][#cronoAlerta]` dentro do `.crono-par`, centrado na
trilha do meio; o alerta nasce `hidden` e só aparece quando
`faltaParaTocarSemRede` acha item. A troca:

- o `#cronoAlerta` passa a vir ANTES do `#cronoTitulo` no DOM — não dá para ser
  filho do título, porque o título é o botão da gaveta e um botão dentro de
  outro é o defeito que a marcação não desfaz (o próprio comentário do
  `index.html` diz isso);
- o `padding-left` do título compensa a SETA, que fica do lado direito dentro
  dele (o comentário do `controle.css` explica); com o alerta à esquerda, o par
  precisa de compensação simétrica para o NOME continuar no eixo. Medir o eixo
  com o alerta VISÍVEL e escondido: o nome não pode andar em nenhum dos dois;
- o `justify-content` do `.crono-par` continua `center`; o grid do
  `.list-header` (a coluna do importar e a do configurar) não muda.

**Medir:** o `cronograma-pronto` confere que o alerta está ao lado do título; a
barra do topo tem o próprio oráculo (`barra-do-topo-e-titulos`) — o lote
confere os dois e muda a referência no mesmo commit.

---

## Pacote 29 — Guia do site: a captura das sete ferramentas

**Nota 2 (I2 × U1) · resíduo · só site**

**Onde:** `site/sonoplastia/index.html` e `site/telas/`.

Achado M6-1 da revisão de 14/11. A captura da lista de Ferramentas mostra seis,
e o app tem sete (falta "Editar mídia"). Refazer a captura pede **o app em
tela** — não há aparelho nesta máquina: ou o operador manda a captura, ou ela
sai da prévia visual no Chromium.

---

## Pacote 30 — Ferramentas: duas arestas que o tour achou

**Nota 2 (I2 × U1) · resíduo · só web**

**Onde:** `controle/controle.js` (o Timer: `miscProjectState`, `cueSaveDaFerramenta`, `chronoSetDuration`; o editor de mídia: `renderEdicaoEscolha`).

Achados do lote v1.14.20 (2026-11-14), lendo as Ferramentas para o tour. Nenhum é defeito
confirmado: os dois pedem uma **decisão de desenho do operador**.

### 30.1 O Timer em 0:00

Com o tempo em 0:00 o ▶ fica apagado (*"Escolha um tempo nas roletas"*), mas o "Projetar no
telão" e os dois quadrados de guardar ficam acesos: dá para projetar um cartão zerado e guardar
no Cronograma ou nos Favoritos um "Timer 0 min". **A decisão:** apagar os três com o tempo em
zero (como o Itinerário sem horários, onde o `title` diz por quê) ou deixar como está.

### 30.2 O editor de mídia, na instalação nova

A lista de escolha sempre desenha os três grupos Cronograma, Playlist e Favoritos, então o
operador de uma instalação nova vê três linhas "0 mídias" e nenhum convite a importar: o
texto *"Nenhuma mídia… Use “Importar arquivo”"* só aparece depois de uma busca sem resultado.
**A decisão:** o que a escolha mostra quando não há mídia nenhuma (o convite no lugar dos
grupos vazios, ou ao lado deles).

---

## O que saiu desta lista (rastro, não log)

**v1.14.25 (2026-11-15), só web:** os **Pacotes 22 e 23** num lote só, autorizados
juntos pelo operador. O **22** — a leitura da Bíblia no controle fica em TRÊS
versículos (um atrás, o atual e um à frente): sai o `mkSection(2)` e a faixa de
`@container` de 18em que só existia para ele. O **23** — o fecho do editor de
mídia encosta na régua do rodapé das ferramentas de painel (28,8px → 9,6px a
1×). Nota em `docs/HISTORICO.md`; oráculos `biblia-leitura-cabe` e
`edicao-de-midia`.

**v1.14.24 (2026-11-15), só web:** os **Pacotes 7, 21 e 28** num lote só, autorizados
juntos pelo operador. O **7** — a Verificação procura atualização: a 42ª checagem lê o
estado do OTA e, havendo lote, abre o mesmo diálogo do "Atualizar agora" (sem baixar nada;
o momento ruim e o "Deixar para depois" seguem valendo). O **21** — a engrenagem do item
guardado, no Cronograma e nos Favoritos: abre a ferramenta com os dados do item e o que se
edita volta para ele; a Mensagem ganhou o lápis de editar o texto. O **28** — o aviso da
série arma a rodada, e o episódio desce quando a projeção sai. Nota em `docs/HISTORICO.md`;
oráculo novo `engrenagem-do-item` e o cenário N3 no `serie-mantem-a-semana`.

**v1.14.23 (2026-11-15), só web:** o **Pacote 31** — a notificação virou controle de player: ⏮/⏭ dela
(e da tela de bloqueio, do fone e do Bluetooth) passam MÚSICA com letra, versículo, mensagem ou
itinerário no ar; sem música nem fila ficam desenhados e inertes. O eixo duplo ficou só na coluna da
tela cheia, e o `slideMode`/`slideLabel` do cartão vão sempre vazios. Nota em `docs/HISTORICO.md`.

**2026-11-15, revogados pelo operador (sem versão nova):** os **Pacotes 8, 12 e 15** — *"ou já
foram feitos ou são irrelevantes hoje. Pode apagar completamente eles e suas referências"*. Saíram
as seções, as linhas do índice e dos temas, e o estudo `docs/ESTUDO-GUIA-IASD.md` (o do 15). As
menções nos apêndices e nos registros das revisões ficam: são o passado, não fila.

**v1.14.22 (2026-11-15), `java/` + site (Release `v1.14.22`):** os **Pacotes 32 e 33** — o tema
"Guia impresso" inteiro, autorizado pelo operador no mesmo dia (*"conserte o imprimir no app mesmo,
gerando novo APK se necessário"*; a capa sem anotações, o índice com; mínimo título + 4 linhas): o
"Imprimir" do caderno, pelo app, vai no link `avguia://imprimir` que a tela do guia entrega ao
`PrintManager`; as colunas com sobra ganham o bloco "Anotações" sem folha a mais. Nota em
`docs/HISTORICO.md`.

**v1.14.20 (2026-11-14), só web:** os **Pacotes 17, 18 e 19** — o tema "Tour do app" inteiro, num
lote só: o Fácil explica a lista da Biblioteca aberta (Liturgia, coleções, o toque que toca e o
download); o Avançado explica o deck um a um e a cifra; as Ferramentas perderam o "Fechar" e
ganharam o Editar mídia, a roleta do Timer e as três saídas num passo; as Mensagens, o editor de
mídia e a Bíblia em leitura passaram a se explicar por vista. Saiu junto o tour de seção do
Avançado que abria dentro do Fácil. A nota está em `docs/HISTORICO.md`; o que o lote achou e não
decidiu entrou como o **Pacote 30**.

**2026-11-14, Pacotes 24 a 27 (sem versão nova; docs, `tools/` e arquivos da
máquina):** a revisão das diretrizes — as instruções desta máquina consertadas
(24), o rito de entrega (25), o processo de revisão (26) e a dieta do contrato
(27): o `CLAUDE.md` de 47 kB para 25 kB, uma regra de leitura só, a tabela única
das falas ao operador, o critério objetivo da delegação, e o método dos oráculos,
a versão e o rito da Release na fonte única (`docs/BUILD.md`). A nota de cada um
está em `docs/HISTORICO.md`; o `URGENCIA.md` esvaziou com o 27 e foi apagado.

**v1.14.7 (2026-11-13), só web:** o **Pacote 10** inteiro — o "Editar mídia"
agora é uma linha da lista de Ferramentas (com o voltar do Android e o rascunho)
e o tile "Saída de áudio" saiu. Entraram no mesmo lote os três pedidos do dia: o
**10.3** (o tour vira quadrado on/off, no molde do "Dados móveis"), o **10.4** (a
pílula de volume a 12 px da borda) e o **10.5** (o recorte do tour preso à área
visível, com margem de halo nos quatro lados, e o balão a 16 px). Nota em
`docs/HISTORICO.md`; oráculos `tour`, `edicao-de-midia`, `ferramentas`,
`ferramentas-folha`, `configuracoes-janelas`, `abertura-e-transferencia`,
`saida-de-audio-e-economia` e `volume-troca`. Os números dos outros não se movem.

**2026-11-13 (só `site/`):** o **8.2** — o guia aberto pelo app a 320 px sem a rolagem lateral de 18 px (a grade de atalhos do D9 e o endereço longo, medidos com a fonte do runner), e o `guia-no-app` saindo 1 com FALHOU. Nota em `docs/HISTORICO.md`.

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
| 11 — Limpeza | 12 | 12 (revogado em 2026-11-15) |
| 12 — Estudos | 6, 17 e 18 | 13 |
| 13 — CI | 8 | 8 (revogado em 2026-11-15) |

O "Pacote 6" antigo (o estudo de abrir a lista de aparelhos de áudio) NÃO existe
mais: o operador abandonou o projeto da janela da Samsung em 2026-10-30, o tile
passou a abrir a API pública na v1.13.16 e SAIU do app na v1.14.7.
