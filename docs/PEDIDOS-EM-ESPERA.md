# Pedidos em espera (fila do operador)

Registro dos pedidos do operador **ainda não implementados**, agrupados em
PACOTES de trabalho. Existe para sobreviver a uma limpeza de contexto da sessão:
quem retomar lê este arquivo e pergunta ao operador **qual pacote seguir** —
nada aqui está autorizado para execução sem essa resposta.

**Regra do arquivo:** ele ESVAZIA. Um pacote entregue sai daqui (a nota vai ao
`docs/HISTORICO.md`, como sempre); um pedido revogado sai com uma linha dizendo
quem revogou. Não é log, e não é `docs/ACHADOS-EM-ABERTO.md` (lá moram defeitos
CONFIRMADOS por auditoria; aqui, pedidos).

Contexto da entrega: base web **v1.13.14** em `main`, APK v1.13.12,
`SHELL_VERSION` 82 — conferido em 2026-10-30. Pedidos recebidos em **2026-10-24**, com o
horário do relato.
O operador pediu economia: *"não temos tokens então toda ação deve ser fracionada
e controlada"* — um pacote por vez, cada um com o rito de entrega completo.

**Ordem recomendada ao operador (2026-11-06):** **8 PRIMEIRO (urgente, pedido do operador)**, depois 13 (defeitos que o operador viu no culto), 16, 12, 9, 10, 11; o 6, o 17 (lives) e o 18 (Windows/paisagem) seguem como estudo. (Os Pacotes 14 e 15 e o item d do 13 — o vídeo da semana como opção do episódio — saíram na v1.13.34; A saída de áudio pela API pública e a dica do "Não Perturbe" saíram na v1.13.16; O Pacote 7 — a faixa de
álbum no ar destacada — saiu na v1.13.14; o Pacote 5 — o vídeo da semana como item — saiu na v1.13.13; o Pacote 1 — as quatro correções pequenas — saiu na v1.13.11, e a busca no computador foi refeita no servidor na v1.13.12; o Pacote 4 — a lista vertical das Ferramentas e o nome do itinerário no
título da folha — saiu na v1.13.4; o Pacote 2 — o teclado sobrepondo em todo
campo de texto — na v1.13.7; o Pacote 3 — a linha de controles do Modo Fácil —
na v1.13.8. Fora dos pacotes, saíram também as portas do rodapé maiores e em negrito,
na v1.13.7, e a Biblioteca maior do Modo Fácil, na v1.13.9.)

---

## Pedidos de 2026-11-07 (a priorizar)

Dez relatos do operador em 2026-11-07, catalogados nos Pacotes 19–26. Nenhum
tem ordem definida ainda — a resposta de "qual pacote seguir" é do operador.

## Pacote 19 — A Verificação também procura atualização

Pedido do operador (2026-11-07 08:55): *"O verificar deve também procurar por
atualizações, se estiver disponível, oferecer a atualização."*

A Verificação do Sistema ganha uma checagem que lê o estado de atualização do
OTA (`otaPending` / `atualizacaoEstado` da ponte) e, havendo base nova, oferece
o "Atualizar agora" — o MESMO diálogo do OTA (o shell só AVISA, quem aplica é o
web; regra de `docs/shell/OTA.md`). Respeitar `docs/DIAGNOSTICO.md`: uma checagem
não baixa megabytes — ela só aponta para o fluxo que já existe; o desfecho é
`não se aplica` quando não há nada pendente. Só web.

## Pacote 20 — A folha do vídeo: sem o aviso de teto e sem a linha do botão

Pedido do operador (2026-11-07 09:12): *"Remova a mensagem 'teto de qualidade,
vale para o tocar agora e fica como padrão' que temos nos vídeos. Também
verifique se não está desperdiçando espaço criando uma outra linha apenas para o
botão de detalhes... Talvez apenas faça uma versão de título mais curta como
apenas 'Detalhes'."*

Dois ajustes na folha do vídeo:

- **(a)** tirar a mensagem do "teto de qualidade" (o texto que explica que a
  qualidade vale para o "Tocar agora" e fica como padrão) — localizar e remover;
- **(b)** o botão de DETALHES (o quinto botão do vídeo, v1.13.34 —
  `destBotaoDetalhes` / `r.__detalhes`) não pode custar uma linha própria:
  encurtar o rótulo para "Detalhes" e/ou acomodá-lo na linha existente. Conferir
  o oráculo de geometria da folha (regra: uma folha não muda de tamanho entre
  estados).

Só web.

## Pacote 21 — Séries: os meses que faltam e a ordem das coleções

Dois relatos (2026-11-07 10:35) mexem na Biblioteca e em `controle/serie.js`:

| # | relato | a fazer |
|---|---|---|
| a | *"Julho, agosto e setembro do Provai e Vede são os itens faltando na lista"* | conferir a ABA DO CANAL (autoridade; nunca busca por texto) contra a regra de playlist de `serie.js`: os meses jul/ago/set não aparecem. Suspeita: a regra de pertencimento (a playlist prova, o título é rótulo) os derruba, ou o índice chega incompleto. Reproduzir num aparelho (o Registro tem o bloco da varredura) e classificar cada episódio |
| b | *"Altera a ordem na biblioteca, deixe primeiro o informativo e depois o provai e vede na ordem de coleções"* | reordenar as coleções da Biblioteca: Informativo antes de Provai e Vede. Conferir `renderCollectionsList` e o oráculo de desenho da Biblioteca |

Só web. Ler antes `docs/recursos/SERIES.md`. Vizinho do **Pacote 13** (mesma
área, `serie.js`) — conferir se os meses faltando têm a mesma raiz dos índices
daquele pacote.

## Pacote 22 — Favoritos: o botão de opções sempre visível

Pedido do operador (2026-11-07 10:37): *"O botão de opções nos itens dos
favoritos, ficará sempre visível, como no cronograma."*

Na lista de Favoritos, o botão de opções (o `⋮`) fica sempre visível, como já é
no Cronograma. Conferir o alvo de toque da linha (`row-slot`) e o oráculo que
mede a coluna do `⋮`. Só web.

> **A v1.13.36 — as opções do favorito atrás do `⋮` — FOI AO AR em 2026-11-08.**
> Os três oráculos que a seguravam (`smoke.mjs`, `destinos-diretos.test.mjs`,
> `teclado-das-folhas.test.mjs`) foram consertados. O pedido acima agora é sobre
> o `⋮` JÁ NO AR: conferir se "sempre visível, como no cronograma" já é o estado
> atual (o `⋮` do favorito é o mesmo desenho do Cronograma) ou se pede ajuste fino.

## Pacote 23 — A playlist: o item que não entra ao trocar de modo

Pedido do operador (2026-11-07 10:38): *"O problema do item que não entra
limpando a playlist, é quando o item é iniciado no modo simples e depois se vai
para o modo avançado."*

Defeito relatado (a confirmar): um item iniciado no Modo Fácil e, depois da
troca para o Modo Avançado, não entra na playlist ao "limpar" (a substituição da
fila). Suspeita: a troca de modo reconstrói a playlist e o item em curso perde o
vínculo com a fila (caminhos `simple*` × o `send`/fila do avançado). Reproduzir
a sequência exata (iniciar no Fácil → trocar para o Avançado → limpar a playlist
→ o item não aparece) e achar onde a fila é remontada na troca. Oráculo de
Chromium com essa sequência.

## Pacote 24 — O cronograma: segurar move, e sai a seleção múltipla

Pedido do operador (2026-11-07 11:34): *"Vamos remover a seleção múltipla do
cronograma, agora segurar vai servir para mover o item em questão. Assim sendo
mais fluido que os nossos botões de mover, que são muito lentos em organizar os
itens."*

No Cronograma, remover a SELEÇÃO MÚLTIPLA; o toque longo (segurar) passa a
ARRASTAR o item para reordenar, no lugar dos botões ↑↓ (v1.13.2, na faixa do
`⋮`). Conferir o caminho de reordenação e o que a seleção múltipla libera hoje;
medir o gesto de arrastar contra o `row-slot` e o alvo de toque. Só web.

## Pacote 25 — O link do YouTube chega com os detalhes do vídeo

Pedido do operador (2026-11-07 19:00): *"Ao acessar o app com um link do YouTube
copiado, ele oferece para usar o link, mas nesse oferecimento, ele não dá
detalhes sobre o vídeo do link, então ajuste para que nesse oferecimento ele dê
os Detalhes como thumbnail, título, duração e canal."*

No oferecimento do link copiado (`ShareIntake.kt` → a PERGUNTA antes de usar),
mostrar os detalhes do vídeo: miniatura, título, duração e canal. Os detalhes já
existem pela ponte (`ytDetalhes` → `{ titulo, canal, descricao }`, cache
`ytDetalhesCache` / `detalhesDoVideo`); faltam a DURAÇÃO e a MINIATURA, e
desenhá-los na folha do oferecimento. Conferir o que `ytDetalhes` devolve hoje e
estender (Kotlin) se faltar duração/miniatura. Só web se a ponte já devolver
tudo; senão, Kotlin (Release).

## Pacote 26 — Modo Fácil: as coleções e as opções de Configurações

Dois relatos (2026-11-07) sobre o Modo Fácil:

| # | relato | a fazer |
|---|---|---|
| a | *"Revisar quais opções das configurações aparecem no modo simples"* (19:24) | levantar quais tiles/opções de Configurações aparecem no Modo Fácil e cortar o que não cabe (regra: apagado = indisponível, nunca inerte; o que não tem função agora some). Conferir a grade de Configurações no Modo Fácil |
| b | *"No modo simples, além da coleção de cds do ano, o resto ficará na coleção de diversos. Assim terá mais espaço para deixar mais elementos fixos após os vídeos da semana. Coisas como ofertório e abertura para a adoração infantil."* (19:33) | reorganizar as coleções do Modo Fácil: só a coleção dos CDs do ano fica separada; o resto cai em "Diversos". O espaço liberado abre vaga para ELEMENTOS FIXOS depois dos vídeos da semana (ex.: ofertório, abertura para a adoração infantil). Planejar quais elementos fixos e onde moram |

Só web. Vizinho do **Pacote 16** (Modo Fácil). Conferir a ordem de coleções do
Modo Fácil (`simple*` em `controle.js`) e o bloco "Este sábado".

---

## Pacote 8 — URGENTE: os oráculos instáveis do CI

> **Tratado pela etapa A1 da revisão (2026-10-30)** — o relatório e o resíduo (`configuracoes-janelas`, instrumentado) estão em `docs/revisao/REGISTRO.md`.

Pedido do operador (2026-10-30): *"Urgente. Coloque em prioridade."* O lote
v1.13.16 reprovou TRÊS rodadas seguidas, cada uma num oráculo DIFERENTE, todos
de tempo e nenhum tocado pelo lote; todos passam na máquina local (o
`display-smoke` 3 de 3). Cada reprovação segura o bundle e custa ~10 min de
re-run. Os três de hoje:

| oráculo | asserção que reprovou |
|---|---|
| `display-smoke.mjs` | *"o `sendStatus` do meio do fade NÃO VIAJA"* e *"no fim sai UM status, o do palco VAZIO"* |
| `enquadramento-da-camada.test.mjs` | (não lida — o log do run 41075250462 tem a linha) |
| `tela-inteira.test.mjs` | B3 — a linha do tempo da base com `display: none` (sem duração ainda) |

Também reprovaram antes, pelo mesmo padrão: runs 2232 e 2234 (push da v1.13.11
e v1.13.12). **O método é o da campanha de determinismo da v5.316**
(`grep -n "v5.316" docs/HISTORICO.md`): achar em cada um a espera que mede o
RUNNER e trocá-la pelo FATO (`esperar`/`esperarDb`), nunca subir prazo; rodar
sob carga (3 processos + `stress`) até reprovar localmente antes de consertar,
e repetir depois. Levantar os reprovados das últimas ~30 runs do `apk.yml`
antes de começar, para não consertar só os três de hoje.

## Pacote 9 — O editor de mídia vai para as Ferramentas

Pedido do operador (2026-10-30). "Editar mídia" é seção de Configurações
(`#cfgSecoes`, v1.12.48) e passa a ser uma ferramenta da LISTA das Ferramentas
(`FERRAMENTAS`, `abrirFerramenta`). A grade de Configurações perde um tile — é a
vaga que o tile "Saída de áudio" esperava (ver as pendências antigas): os dois
saem no MESMO lote, para a grade não ficar com buraco. Conferir o voltar do
Android (a lista das Ferramentas, degrau 2.5) e o rascunho `edicaoRascunho`.

## Pacote 10 — Alerta de "não está pronto" no nome do Cronograma

Pedido do operador (2026-10-30), recusando um AVISO: *"um ícone de alerta ao
lado do nome do cronograma, que ao tocado avisa e dê a opção de baixar tudo para
deixar pronto"*. O ícone aparece ao lado de `#cronoTitulo` quando algum item do
cronograma ATIVO não toca sem rede (hino sem variante baixada, link do YouTube
sem arquivo, `semana` cujo episódio não está na lista `serie`). Tocar abre uma
folha que diz o que falta (contagem por tipo) e um botão "Baixar tudo", que
reusa os caminhos de download existentes (nada de baixador novo). A pergunta
"toca sem rede?" tem de ser UMA função usada também pelo botão. Sem automação:
nada baixa sozinho.

## Pacote 11 — A abertura antes do primeiro evento do Itinerário

Pedido do operador (2026-10-30): uma OPÇÃO do Itinerário (um interruptor só,
*"com tudo automatizado"*) que, antes do primeiro evento do itinerário ativo,
põe no telão uma tela de espera: contagem regressiva até o primeiro horário,
música de fundo de PLAYBACKS aleatórios do Hinário (a regra do `sorteio.js`,
categoria do hinário, variante playback) e, se houver, avisos. Termina sozinha
no horário do primeiro evento. Itinerário = eventos e títulos; Cronograma =
mídias — não se fundem (o operador recusou a fusão). A planejar: o que conta
como "avisos" (Mensagens? apresentação?), a camada de texto que leva a contagem
(o Itinerário já é provedor por descritor), e o que acontece se o operador tocar
algo no meio.

## Pacote 12 — Otimização e limpeza do repositório

Pedido do operador (2026-10-30): *"realmente estamos a muito tempo sem"*. Abrir
pela `docs/AUDITORIA-EFICIENCIA-2026-09.md` (a lista dos achados mortos
inclusive). O alvo nº 1 segue o `CLAUDE.md`: o bloco *"Versão atual"* voltou a
ser LOG de lote (dezenas de *"A v1.x.y FAZ…"*), contra a regra *"ESTE ARQUIVO
NÃO GUARDA LOG DE LOTE"* — deve ficar a linha do presente e o resto sair (o
conteúdo já mora no `HISTORICO.md`; conferir antes de apagar). Também: a tabela
de divergências (linhas de 2 kB), `ACHADOS-EM-ABERTO.md` (o achado 3 foi
desconsiderado pelo operador e o 1 respondido — sair), e poda de comentário com
as DUAS provas da seção "Documentação".

## Pacote 13 — Séries e vídeo da semana: contagem, retenção e playlist

Três relatos do operador (2026-10-30 18:57; 2026-10-31 10:22 e 10:31) mexem no MESMO
lugar — `controle/serie.js`, `serieEpisodioDaSemana`, `manterSeriesDaSemana`,
`resolverSemana`/`semanaAncora` — e saem JUNTOS. Ler antes
`docs/recursos/SERIES.md`. **Estudo preliminar (2026-11-04), sem medição em
aparelho:**

| # | relato | o que o código sugere | a fazer |
|---|---|---|---|
| a | *"Provai e Vede diz 30 episódios, Informativo 44… quero que conte apenas as versões disponíveis que são mostradas ao usuário"* | a barra do card escreve `total` = `songsBaixaveis(coll.id).length` (`renderCollection`), isto é, TODO item do índice sem `semAudio`; a LISTA desenhada passa por `faixasDaLista` (tira o destaque) e o índice já chega filtrado pela regra de playlist (`serie.js`, espanhol/infantil/Libras). Hipótese: o índice do Informativo guarda itens que a regra aceita mas que não são "um por sábado" (versões curtas, trailers, duplicatas de dublagem) — ou a contagem e a lista leem fontes diferentes. Nenhum dos dois números foi conferido contra o canal | (1) puxar os dois índices num aparelho (o Registro tem o bloco da varredura) e classificar cada item; (2) a contagem passa a ser `faixasDaLista(coll).length` + o destaque — UMA função para lista e número; (3) se sobrar item que não é episódio, a regra entra em `serie.js` com caso no oráculo Node. O número "certo" é o de sábados até hoje no ano corrente — dá para afirmar no oráculo |
| b | *"vi o vídeo sendo baixado e depois… um deles não estava disponível offline"* | o download pelo atalho universal (`resolverSemana` sem arquivo) vai por `ytAcao(…, 'tocar')` e só DEPOIS chama `manterSeriesDaSemana()` com `.catch(() => {})` — falha calada. Suspeitas: (i) o arquivo baixado para TOCAR não entra na lista `serie` de retenção a tempo e uma limpeza o solta; (ii) a rotina semanal decide "qual é o deste sábado" por data e solta o que ela julga passado (fuso/virada de sábado); (iii) o download da rotina cedeu à mídia no ar (`midiaNoAr`) e não foi retomado | reproduzir com o Registro na mão (a linha do tempo deve mostrar baixou → soltou); tirar o `.catch` mudo (vira linha no Registro, regra do `DIAGNOSTICO.md`); oráculo de Chromium: baixar pelo atalho, rodar a rotina, afirmar que o arquivo sobrevive |
| c | *"toquei um Provai e Vede e quando fui adicionar na playlist… não havia o Provai e Vede tocando na lista"* | tocar uma mídia isolada substitui a playlist por ela; o atalho universal toca pelo item VIRTUAL (`kind: 'semana'`) e o arquivo resolvido entra por `send(arquivo.id, …)` com `semanaPendente`. Hipótese forte: a substituição da playlist acontece no caminho do "Tocar agora" de um item comum e o caminho `semanaAcao(…, ['tocar'])` / `resolverSemana` a pula — a fila fica a anterior | conferir em que função mora a "fila vira só esta mídia" e chamá-la também no caminho da semana, com o item VIRTUAL na fila (é ele que `ancoraDaFila` procura); oráculo: tocar o atalho → adicionar outra → a fila tem os dois, nessa ordem |

Só web, salvo se (b) mostrar causa no `YoutubeGrab.kt`. Vizinho do **Pacote 10**
(a pergunta "toca sem rede?" do `semana` usa a mesma lista `serie`) — fazer o
13 antes. (O item d, o seletor "Este sábado"/"Atalho universal", saiu na v1.13.34.)

## Pacote 16 — Modo Fácil: indicador de volume flutuante e o botão de tela cheia

Pedido (2026-10-31 09:02). Hoje o volume só tem retorno visual em parte dos
estados (`mostrarVolumeDaTelaCheia` existe para a tela cheia); na busca da
Biblioteca ou sem nada tocando as teclas físicas não mostram nada. Estudo:

- um indicador FLUTUANTE único (uma pílula opaca com a barra e o número), que
  aparece só quando as teclas físicas são usadas (`__avVolumeKey`) e some
  sozinho em ~1,5 s — o mesmo em toda tela; substitui o indicador atual e o da
  tela cheia (uma peça só). Ele não pode cobrir o transporte; rodapé flutuante é
  opaco (regra da paleta);
- **a pergunta a resolver:** o que a tecla controla sem nada tocando? Hoje ela
  só é capturada depois que o web pede (`captureVolumeKeys(true)`); se a
  captura estiver desligada nesse estado, o painel do sistema aparece e o nosso
  não — decidir se o indicador mostra o volume do APP (preview/telão) ou se a
  captura passa a valer sempre no Modo Fácil (com a válvula no zero e no teto);
- o botão exclusivo de volume da linha de controles do Modo Fácil (Pacote 3,
  v1.13.8) vira **tela cheia** da prévia. **Resposta do operador (2026-11-06):** é
  quando há algo em exibição e se vai para a tela cheia da preview, que ocupa a
  tela toda, com os controles sobre a imagem — o mesmo modelo de controles da tela
  cheia que já existe (play/pause no centro, sair no canto, nome e linha do tempo
  nas faixas; ver `docs/DIVERGENCIAS-WEB-NATIVO.md`, "Fullscreen da preview").
  Sem nada em exibição, o botão fica apagado com o motivo.

Só web, salvo se a captura sempre ligada pedir mudança no `MainActivity`.

## Pacote 17 — ESTUDO: transmissão ao vivo (câmera fixa → YouTube)

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
dentro do processo do telão. Vizinho do Pacote 6 (controle remoto do pregador
pelo mesmo servidor): as duas são PORTAS NOVAS DE SUBIDA e a decisão de
segurança (código de entrada? só no ponto de acesso?) é UMA só para as duas.
Pede Release (Kotlin) e decisão sobre a invariante de captura.

## Pacote 18 — ESTUDO: o app no Windows, e o layout de paisagem

Pedido (2026-10-31). **Estudo preliminar.** O fato que decide quase tudo: a
base web JÁ roda no navegador (o PWA de origem); o que o app Android acrescenta
é a ponte (`window.AVNative`, 64 métodos). Portar = escrever OUTRA casca, não
reescrever o app.

| caminho | como | prós | contras |
|---|---|---|---|
| **(A) PWA no Edge/Chrome** | instalar a base web como app do navegador | zero código; `showDirectoryPicker` existe; arrasta a janela do telão para o 2º monitor | sem YouTube baixado (CORS), sem cifra, sem séries, sem servidor das telas da rede, sem OTA nosso; dois apps/janelas (o modelo antigo) |
| **(B) casca nativa com WebView2** (C#/.NET + WinUI ou WinForms) | o MESMO desenho do Android: `SetVirtualHostNameToFolderMapping` dá um origin `https://` (contexto seguro), dois WebView2 no MESMO perfil compartilham IDB/OPFS/BroadcastChannel; o telão é uma JANELA sem borda posicionada no monitor secundário (`Screen.AllScreens`) — mais simples que a `Presentation` | as invariantes 1–3 se traduzem 1:1; `AddHostObjectToScript` faz o papel do `addJavascriptInterface`; Windows tem 2º monitor por cabo HDMI (sem Miracast) | reescrever a ponte em C#: SAF→pastas do disco (mais fácil), `YoutubeGrab`/`TrilhaAudio` dependem do NewPipeExtractor (Java) — no Windows seria `yt-dlp` (executável externo) ou portar; `MuxMp4`, `EspelhoServidor` (HttpListener), OTA, `SlideDeck` (PDF via `Windows.Data.Pdf`), instalador e assinatura de código |
| (C) Electron/Tauri | casca JS/Rust | menos C# | dependência grande, contra a regra "sem dependências externas" |

**Recomendação do estudo:** (B), em fases — 1) casca + telão no 2º monitor +
pastas (o culto básico); 2) YouTube/séries; 3) telas da rede e OTA. Guarda no web:
continua só `if (!window.__NATIVE__)`; os métodos sem par no Windows respondem o
desfecho inofensivo (a mesma regra do papel `display`). Custo maior: manter DUAS
cascas a cada degrau de `SHELL_VERSION`.

**O layout de paisagem** é o pedaço que vale JÁ, independente do Windows: serve
tablet Android, celular deitado e o Windows. Hoje o Controle é retrato fixo
(manifesto `portrait`) com uma coluna. Estudo: um `@media (orientation:
landscape) and (min-width: …)` em DUAS colunas (Biblioteca/Cronograma à
esquerda, prévia + transporte + letra à direita), sem duplicar DOM; folhas viram
painéis laterais. Riscos: a escada de camadas, as folhas que "não mudam de
tamanho entre estados", e os oráculos geométricos medidos só em retrato (cada um
ganha a célula de paisagem). Liberar a rotação no Android é Release; o CSS é OTA.

## Pacote 6 — Pesquisa, sem implementação

| hora | pedido | o que já se sabe |
|---|---|---|
| 2026-10-30 | *"controle remoto de slides para o pregador, algum link de site, endereço ou código que não requer internet… onde ele pode controlar os slides pelo próprio aparelho dele, seja vendo os slides. Ou… integração com aparelhos de passagem de slides bluetooth"* | ESTUDO. Duas vias. **(a) Passador Bluetooth:** quase todo passador é um TECLADO HID (manda PageDown/PageUp, setas, às vezes B/F5); pareado com o celular, as teclas chegam à `MainActivity.onKeyDown` como chegam as de volume — o caminho já existe (`captureVolumeKeys` → `__avVolumeKey`), e ligar `KEYCODE_PAGE_DOWN/UP`, `DPAD_RIGHT/LEFT` ao ⏮/⏭ de slide é Kotlin pequeno + Release. Medir: quais teclas os passadores comuns mandam, e se o pareado como teclado esconde o teclado virtual. **(b) Pelo celular do pregador:** o servidor das telas da rede (sem internet, Wi-Fi ou ponto de acesso) já serve páginas; uma página de CONTROLE (anterior/próximo, e opcionalmente a página atual em miniatura) por uma rota nova com o mesmo pareamento e teto de sessões. Cuidado: hoje a rota de subida aceita só `TIPOS_QUE_SOBEM` (lista de permissão) — um comando de slide vindo da rede é uma porta nova de CONTROLE, não só de exibição, e pede decisão de segurança (código de entrada? só no ponto de acesso?). Ver `docs/TELAO-POR-COMANDOS.md` |
| 10:34 | *"Vamos estudar e planejar um sistema de compartilhar itinerários e ou cronogramas de forma mais facilitada… compartilhar no whatsapp… um simples link, que ao tocar, abre o app, e busca/baixa oque for necessário inclusive baixando diretamente do aparelho de origem… Talvez precisamos de um servidor? Estude as opções para o menor atrito possível…"* | entregável é um ESTUDO para o operador decidir, não código. Eixos: link de app (App Links no domínio `audiovisualiasd.com.br`, que já é nosso — exige o arquivo de associação de domínio (Digital Asset Links) no `site/` e `intent-filter` no manifesto, logo Release) vs. arquivo `.avpkg` pequeno só com a LISTA; de onde vem a mídia (LouvorJA e YouTube já são re-baixáveis por id; mídia própria do aparelho é o problema difícil — sem servidor, só com os dois aparelhos online ao mesmo tempo); e o que NÃO viajar (privacidade, `docs/MEDICAO-DE-ALCANCE.md`). Comparar com o `.avpkg` atual (`docs/recursos/PACOTE.md`) |

---

## Pendências antigas (anteriores a 2026-10-24)

- **Tirar o tile "Saída de áudio" de Configurações** (decisão do operador,
  2026-10-30): o projeto da janela da Samsung foi ABANDONADO — não há caminho
  documentado (a One UI não expõe a dela; a única via pública,
  `MediaRouter2.showSystemOutputSwitcher`, abre a do Android, e é o que o tile
  faz desde a v1.13.16). O operador usa o atalho do próprio aparelho. **O tile
  FICA até a próxima função nova de Configurações**, que entra NO LUGAR dele para
  a grade não ficar com um buraco. Ao tirar: o tile, `abrirSaidaDeAudio` do web
  (o Kotlin pode ficar órfão, o lado seguro), e manter as linhas *"Mídia saindo
  agora por"* e *"Não Perturbe"* do Registro (o `saidaDeAudioAlvo` continua).
- **Varrer a sobra de ~24 MB do cache do YouTube no shell** — Kotlin; entra
  num lote que já precise de Release, nunca sozinho.
