# Pedidos em espera (fila do operador)

Registro dos pedidos do operador **ainda não implementados**, agrupados por
**ÁREA** (o lugar do app/código que cada um toca). Existe para sobreviver a uma
limpeza de contexto da sessão: quem retomar lê este arquivo e pergunta ao
operador **qual área seguir** — nada aqui está autorizado para execução sem essa
resposta.

**Regra do arquivo:** ele ESVAZIA. Uma área entregue sai daqui (a nota vai ao
`docs/HISTORICO.md`, como sempre); um pedido revogado sai com uma linha dizendo
quem revogou. Não é log, e não é `docs/ACHADOS-EM-ABERTO.md` (lá moram defeitos
CONFIRMADOS por auditoria; aqui, pedidos).

**Regra nova de agrupamento (2026-11-08):** pedidos que mexem na MESMA área de
código/recurso moram no MESMO bloco e **saem juntos** — um lote por área, cada um
com o rito de entrega completo. É a resposta a *"todos os pedidos como uma lista
só, reagrupando por categorias e pacotes que tocam a mesma área, para poder ser
atualizada junta"*. A contagem dos vídeos da semana/séries e os meses faltando
do Provai e Vede são o MESMO defeito (o índice chega errado/incompleto) e foram
fundidos na Área 1.

Contexto da entrega: base web **v1.13.36** em `main`, APK **v1.13.16**,
`SHELL_VERSION` **83** — conferido em 2026-11-08. O operador pediu economia:
*"não temos tokens então toda ação deve ser fracionada e controlada"* — uma área
por vez, cada uma com o rito de entrega completo.

**O que já saiu (nota de rastro — não é log de trabalho):** a v1.13.36 levou as
opções do favorito atrás do `⋮`; a v1.13.34, os destinos em botões diretos, a
miniatura de tipo, o vídeo da semana na gaveta do episódio, a posição no acervo e
o item d do antigo Pacote 13 (o seletor "Este sábado"/atalho universal); a
v1.13.16, a saída de áudio pela API pública e a dica do "Não Perturbe"; a
v1.13.14, a faixa de álbum no ar destacada; a v1.13.13, o vídeo da semana como
item; a v1.13.11, as quatro correções pequenas (e a busca no computador refeita
no servidor na v1.13.12); a v1.13.9, a Biblioteca maior do Modo Fácil; a
v1.13.8, a linha de controles do Modo Fácil; a v1.13.7, o teclado sobrepondo e
as portas do rodapé maiores/em negrito; a v1.13.4, a lista vertical das
Ferramentas e o nome do itinerário no título da folha.

---

## Mapa das áreas

| área | o que cobre | pedidos originais |
|---|---|---|
| 1 | Séries, vídeo da semana e as coleções da Biblioteca | Pacotes 13 e 21 |
| 2 | Modo Fácil | Pacotes 16 e 26 |
| 3 | Cronograma | Pacotes 10 e 24 |
| 4 | Favoritos | Pacote 22 |
| 5 | Folha do vídeo | Pacote 20 |
| 6 | Playlist | Pacote 23 |
| 7 | Link do YouTube (oferecimento) | Pacote 25 |
| 8 | Verificação / Diagnóstico | Pacote 19 |
| 9 | Configurações e Ferramentas | Pacote 9 + pendências antigas |
| 10 | Itinerário | Pacote 11 |
| 11 | Limpeza e otimização do repositório | Pacote 12 |
| 12 | Estudos (sem implementação decidida) | Pacotes 6, 17 e 18 |
| 13 | CI / oráculos (residual) | Pacote 8 |

**Ordem sugerida ao operador:** Área 1 primeiro (ela alimenta a Área 3 — o
alerta do Cronograma usa a mesma lista `serie`), depois 2, 3, 4–8 (ajustes de
interface pequenos, na ordem que o operador preferir), 9, 10, 11. As Áreas 12 e
13 seguem à parte: 12 é estudo para decidir, 13 é residual da revisão A1.

---

## Área 1 — Séries, vídeo da semana e as coleções da Biblioteca

Tudo em torno de `controle/serie.js`, `serieEpisodioDaSemana`,
`manterSeriesDaSemana`, `resolverSemana`/`semanaAncora` e `renderCollectionsList`.
Ler antes `docs/recursos/SERIES.md`. Sai num lote só.

### 1.1 A contagem e os meses que faltam (MESMO defeito)

Dois relatos, uma raiz — o **índice da série chega errado/incompleto**, e a
contagem e a lista leem dele:

- *"Provai e Vede diz 30 episódios, Informativo 44… quero que conte apenas as
  versões disponíveis que são mostradas ao usuário"* (2026-10-31).
- *"Julho, agosto e setembro do Provai e Vede são os itens faltando na lista"*
  (2026-11-07 10:35).

**O que o código sugere (estudo 2026-11-04, sem medição em aparelho):** a barra
do card escreve `total` = `songsBaixaveis(coll.id).length` (`renderCollection`),
isto é, TODO item do índice sem `semAudio`; a LISTA desenhada passa por
`faixasDaLista` (tira o destaque) e o índice já chega filtrado pela regra de
playlist (`serie.js`, espanhol/infantil/Libras). Hipótese: o índice guarda itens
que a regra aceita mas que não são "um por sábado" (versões curtas, trailers,
duplicatas de dublagem) — ou a contagem e a lista leem fontes diferentes. Para
os meses faltando, a suspeita é a mesma regra de pertencimento (a playlist
prova, o título é rótulo) derrubando os episódios, ou o índice chegando
incompleto.

**A fazer:** (1) puxar os dois índices num aparelho (o Registro tem o bloco da
varredura) e classificar cada item; a descoberta é a **ABA DO CANAL**, nunca
busca por texto (autoridade). (2) a contagem passa a ser `faixasDaLista(coll).length`
+ o destaque — **UMA função** para lista e número. (3) se sobrar item que não é
episódio, a regra entra em `serie.js` com caso no oráculo Node. O número "certo"
é o de sábados até hoje no ano corrente — dá para afirmar no oráculo.

### 1.2 O episódio baixado que some do offline

*"vi o vídeo sendo baixado e depois… um deles não estava disponível offline"*
(2026-10-31 10:22). O download pelo atalho universal (`resolverSemana` sem
arquivo) vai por `ytAcao(…, 'tocar')` e só DEPOIS chama `manterSeriesDaSemana()`
com `.catch(() => {})` — falha calada. Suspeitas: (i) o arquivo baixado para
TOCAR não entra na lista `serie` de retenção a tempo e uma limpeza o solta; (ii)
a rotina semanal decide "qual é o deste sábado" por data e solta o que ela julga
passado (fuso/virada de sábado); (iii) o download da rotina cedeu à mídia no ar
(`midiaNoAr`) e não foi retomado.

**A fazer:** reproduzir com o Registro na mão (a linha do tempo deve mostrar
baixou → soltou); tirar o `.catch` mudo (vira linha no Registro, regra do
`DIAGNOSTICO.md`); oráculo de Chromium: baixar pelo atalho, rodar a rotina,
afirmar que o arquivo sobrevive. Só web, salvo se a causa estiver no
`YoutubeGrab.kt`.

### 1.3 O item da semana na playlist

*"toquei um Provai e Vede e quando fui adicionar na playlist… não havia o Provai
e Vede tocando na lista"* (2026-10-31 10:31). Tocar uma mídia isolada substitui a
playlist por ela; o atalho universal toca pelo item VIRTUAL (`kind: 'semana'`) e
o arquivo resolvido entra por `send(arquivo.id, …)` com `semanaPendente`.
Hipótese forte: a substituição da playlist acontece no caminho do "Tocar agora"
de um item comum e o caminho `semanaAcao(…, ['tocar'])`/`resolverSemana` a pula —
a fila fica a anterior.

**A fazer:** conferir em que função mora a "fila vira só esta mídia" e chamá-la
também no caminho da semana, com o item VIRTUAL na fila (é ele que `ancoraDaFila`
procura); oráculo: tocar o atalho → adicionar outra → a fila tem os dois, nessa
ordem.

### 1.4 A ordem das coleções da Biblioteca

*"Altera a ordem na biblioteca, deixe primeiro o informativo e depois o provai e
vede na ordem de coleções"* (2026-11-07 10:35). Reordenar as coleções da
Biblioteca: Informativo antes de Provai e Vede. Conferir `renderCollectionsList`
e o oráculo de desenho da Biblioteca.

---

## Área 2 — Modo Fácil

Tudo em `simple*` de `controle.js` e no bloco "Este sábado". Sai num lote só.
Vizinho da Área 1 (as coleções do Modo Fácil) — conferir a ordem de coleções
simples junto com a 1.4.

### 2.1 As opções de Configurações no Modo Fácil

*"Revisar quais opções das configurações aparecem no modo simples"*
(2026-11-07 19:24). Levantar quais tiles/opções de Configurações aparecem no Modo
Fácil e cortar o que não cabe (regra: apagado = indisponível, nunca inerte; o que
não tem função agora some). Conferir a grade de Configurações no Modo Fácil.

### 2.2 As coleções em "Diversos" e os elementos fixos

*"No modo simples, além da coleção de cds do ano, o resto ficará na coleção de
diversos. Assim terá mais espaço para deixar mais elementos fixos após os vídeos
da semana. Coisas como ofertório e abertura para a adoração infantil."*
(2026-11-07 19:33). Reorganizar as coleções do Modo Fácil: só a coleção dos CDs
do ano fica separada; o resto cai em "Diversos". O espaço liberado abre vaga para
ELEMENTOS FIXOS depois dos vídeos da semana (ex.: ofertório, abertura para a
adoração infantil). Planejar quais elementos fixos e onde moram.

### 2.3 Indicador de volume flutuante e o botão de tela cheia

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

Só web, salvo se a captura sempre ligada pedir mudança no `MainActivity`.

---

## Área 3 — Cronograma

### 3.1 O alerta de "não está pronto"

Pedido do operador (2026-10-30), recusando um AVISO: *"um ícone de alerta ao
lado do nome do cronograma, que ao tocado avisa e dê a opção de baixar tudo para
deixar pronto"*. O ícone aparece ao lado de `#cronoTitulo` quando algum item do
cronograma ATIVO não toca sem rede (hino sem variante baixada, link do YouTube
sem arquivo, `semana` cujo episódio não está na lista `serie`). Tocar abre uma
folha que diz o que falta (contagem por tipo) e um botão "Baixar tudo", que reusa
os caminhos de download existentes (nada de baixador novo). A pergunta "toca sem
rede?" tem de ser UMA função usada também pelo botão. Sem automação: nada baixa
sozinho. **Depende da Área 1** (o `semana` usa a mesma lista `serie`) — fazer a
1 antes.

### 3.2 Remover a seleção múltipla; segurar arrasta

*"Vamos remover a seleção múltipla do cronograma, agora segurar vai servir para
mover o item em questão. Assim sendo mais fluido que os nossos botões de mover,
que são muito lentos em organizar os itens."* (2026-11-07 11:34). No Cronograma,
remover a SELEÇÃO MÚLTIPLA; o toque longo (segurar) passa a ARRASTAR o item para
reordenar, no lugar dos botões ↑↓ (v1.13.2, na faixa do `⋮`). Conferir o caminho
de reordenação e o que a seleção múltipla libera hoje; medir o gesto de arrastar
contra o `row-slot` e o alvo de toque. Só web.

---

## Área 4 — Favoritos

### 4.1 O botão de opções sempre visível

*"O botão de opções nos itens dos favoritos, ficará sempre visível, como no
cronograma."* (2026-11-07 10:37). Na lista de Favoritos, o botão de opções (o
`⋮`) fica sempre visível, como já é no Cronograma. Conferir o alvo de toque da
linha (`row-slot`) e o oráculo que mede a coluna do `⋮`. Só web.

> A v1.13.36 — as opções do favorito atrás do `⋮` — FOI AO AR em 2026-11-08. Os
> três oráculos que a seguravam foram consertados. O pedido acima agora é sobre o
> `⋮` JÁ NO AR: conferir se "sempre visível, como no cronograma" já é o estado
> atual (o `⋮` do favorito é o mesmo desenho do Cronograma) ou se pede ajuste fino.

---

## Área 5 — Folha do vídeo

### 5.1 Sem o aviso de teto e sem a linha do botão

*"Remova a mensagem 'teto de qualidade, vale para o tocar agora e fica como
padrão' que temos nos vídeos. Também verifique se não está desperdiçando espaço
criando uma outra linha apenas para o botão de detalhes... Talvez apenas faça uma
versão de título mais curta como apenas 'Detalhes'."* (2026-11-07 09:12). Dois
ajustes na folha do vídeo:

- **(a)** tirar a mensagem do "teto de qualidade" (o texto que explica que a
  qualidade vale para o "Tocar agora" e fica como padrão) — localizar e remover;
- **(b)** o botão de DETALHES (o quinto botão do vídeo, v1.13.34 —
  `destBotaoDetalhes` / `r.__detalhes`) não pode custar uma linha própria:
  encurtar o rótulo para "Detalhes" e/ou acomodá-lo na linha existente. Conferir
  o oráculo de geometria da folha (regra: uma folha não muda de tamanho entre
  estados).

Só web.

---

## Área 6 — Playlist

### 6.1 O item que não entra ao trocar de modo

*"O problema do item que não entra limpando a playlist, é quando o item é
iniciado no modo simples e depois se vai para o modo avançado."*
(2026-11-07 10:38). Defeito relatado (a confirmar): um item iniciado no Modo
Fácil e, depois da troca para o Modo Avançado, não entra na playlist ao "limpar"
(a substituição da fila). Suspeita: a troca de modo reconstrói a playlist e o
item em curso perde o vínculo com a fila (caminhos `simple*` × o `send`/fila do
avançado). Reproduzir a sequência exata (iniciar no Fácil → trocar para o
Avançado → limpar a playlist → o item não aparece) e achar onde a fila é
remontada na troca. Oráculo de Chromium com essa sequência.

---

## Área 7 — Link do YouTube (oferecimento)

### 7.1 Os detalhes do vídeo no oferecimento

*"Ao acessar o app com um link do YouTube copiado, ele oferece para usar o link,
mas nesse oferecimento, ele não dá detalhes sobre o vídeo do link, então ajuste
para que nesse oferecimento ele dê os Detalhes como thumbnail, título, duração e
canal."* (2026-11-07 19:00). No oferecimento do link copiado (`ShareIntake.kt` →
a PERGUNTA antes de usar), mostrar os detalhes do vídeo: miniatura, título,
duração e canal. Os detalhes já existem pela ponte (`ytDetalhes` →
`{ titulo, canal, descricao }`, cache `ytDetalhesCache` / `detalhesDoVideo`);
faltam a DURAÇÃO e a MINIATURA, e desenhá-los na folha do oferecimento. Conferir
o que `ytDetalhes` devolve hoje e estender (Kotlin) se faltar duração/miniatura.
Só web se a ponte já devolver tudo; senão, Kotlin (Release).

---

## Área 8 — Verificação / Diagnóstico

### 8.1 A Verificação também procura atualização

*"O verificar deve também procurar por atualizações, se estiver disponível,
oferecer a atualização."* (2026-11-07 08:55). A Verificação do Sistema ganha uma
checagem que lê o estado de atualização do OTA (`otaPending` /
`atualizacaoEstado` da ponte) e, havendo base nova, oferece o "Atualizar agora" —
o MESMO diálogo do OTA (o shell só AVISA, quem aplica é o web; regra de
`docs/shell/OTA.md`). Respeitar `docs/DIAGNOSTICO.md`: uma checagem não baixa
megabytes — ela só aponta para o fluxo que já existe; o desfecho é `não se
aplica` quando não há nada pendente. Só web.

---

## Área 9 — Configurações e Ferramentas

### 9.1 O editor de mídia vai para as Ferramentas

Pedido do operador (2026-10-30). "Editar mídia" é seção de Configurações
(`#cfgSecoes`, v1.12.48) e passa a ser uma ferramenta da LISTA das Ferramentas
(`FERRAMENTAS`, `abrirFerramenta`). A grade de Configurações perde um tile — é a
vaga que o tile "Saída de áudio" esperava (ver 9.2): os dois saem no MESMO lote,
para a grade não ficar com buraco. Conferir o voltar do Android (a lista das
Ferramentas, degrau 2.5) e o rascunho `edicaoRascunho`.

### 9.2 Tirar o tile "Saída de áudio" (pendência antiga)

Decisão do operador (2026-10-30): o projeto da janela da Samsung foi ABANDONADO —
não há caminho documentado (a One UI não expõe a dela; a única via pública,
`MediaRouter2.showSystemOutputSwitcher`, abre a do Android, e é o que o tile faz
desde a v1.13.16). O operador usa o atalho do próprio aparelho. O tile FICA até a
próxima função nova de Configurações — que é o 9.1, saindo JUNTO. Ao tirar: o
tile, `abrirSaidaDeAudio` do web (o Kotlin pode ficar órfão, o lado seguro), e
manter as linhas *"Mídia saindo agora por"* e *"Não Perturbe"* do Registro (o
`saidaDeAudioAlvo` continua).

### 9.3 Varrer o cache do YouTube (~24 MB)

Kotlin (`YoutubeGrab.kt`); varrer a sobra de ~24 MB do cache do YouTube no shell.
Entra num lote que já precise de Release, nunca sozinho — cabe com qualquer
entrega de Área que já exija Kotlin (7.1, 12.1), ou com um degrau de
`SHELL_VERSION`.

---

## Área 10 — Itinerário

### 10.1 A abertura antes do primeiro evento

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

## Área 11 — Limpeza e otimização do repositório

### 11.1 Poda de documentação e do histórico

Pedido do operador (2026-10-30): *"realmente estamos a muito tempo sem"*. Abrir
pela `docs/AUDITORIA-EFICIENCIA-2026-09.md` (a lista dos achados mortos
inclusive). O alvo nº 1 segue o `CLAUDE.md`: o bloco *"Versão atual"* voltou a
ser LOG de lote (dezenas de *"A v1.x.y FAZ…"*), contra a regra *"ESTE ARQUIVO
NÃO GUARDA LOG DE LOTE"* — deve ficar a linha do presente e o resto sair (o
conteúdo já mora no `HISTORICO.md`; conferir antes de apagar). Também: a tabela
de divergências (linhas de 2 kB), `ACHADOS-EM-ABERTO.md` (o achado 3 foi
desconsiderado pelo operador e o 1 respondido — sair), e poda de comentário com
as DUAS provas da seção "Documentação".

---

## Área 12 — Estudos (sem implementação decidida)

Três estudos preliminares; nada sai para código sem decisão do operador.

### 12.1 Controle remoto de slides e compartilhamento de itinerários

| hora | pedido | o que já se sabe |
|---|---|---|
| 2026-10-30 | *"controle remoto de slides para o pregador, algum link de site, endereço ou código que não requer internet… onde ele pode controlar os slides pelo próprio aparelho dele, seja vendo os slides. Ou… integração com aparelhos de passagem de slides bluetooth"* | ESTUDO. Duas vias. **(a) Passador Bluetooth:** quase todo passador é um TECLADO HID (manda PageDown/PageUp, setas, às vezes B/F5); pareado com o celular, as teclas chegam à `MainActivity.onKeyDown` como chegam as de volume — o caminho já existe (`captureVolumeKeys` → `__avVolumeKey`), e ligar `KEYCODE_PAGE_DOWN/UP`, `DPAD_RIGHT/LEFT` ao ⏮/⏭ de slide é Kotlin pequeno + Release. Medir: quais teclas os passadores comuns mandam, e se o pareado como teclado esconde o teclado virtual. **(b) Pelo celular do pregador:** o servidor das telas da rede (sem internet, Wi-Fi ou ponto de acesso) já serve páginas; uma página de CONTROLE (anterior/próximo, e opcionalmente a página atual em miniatura) por uma rota nova com o mesmo pareamento e teto de sessões. Cuidado: hoje a rota de subida aceita só `TIPOS_QUE_SOBEM` (lista de permissão) — um comando de slide vindo da rede é uma porta nova de CONTROLE, não só de exibição, e pede decisão de segurança (código de entrada? só no ponto de acesso?). Ver `docs/TELAO-POR-COMANDOS.md` |
| 10:34 | *"Vamos estudar e planejar um sistema de compartilhar itinerários e ou cronogramas de forma mais facilitada… compartilhar no whatsapp… um simples link, que ao tocar, abre o app, e busca/baixa oque for necessário inclusive baixando diretamente do aparelho de origem… Talvez precisamos de um servidor? Estude as opções para o menor atrito possível…"* | entregável é um ESTUDO para o operador decidir, não código. Eixos: link de app (App Links no domínio `audiovisualiasd.com.br`, que já é nosso — exige o arquivo de associação de domínio (Digital Asset Links) no `site/` e `intent-filter` no manifesto, logo Release) vs. arquivo `.avpkg` pequeno só com a LISTA; de onde vem a mídia (LouvorJA e YouTube já são re-baixáveis por id; mídia própria do aparelho é o problema difícil — sem servidor, só com os dois aparelhos online ao mesmo tempo); e o que NÃO viajar (privacidade, `docs/MEDICAO-DE-ALCANCE.md`). Comparar com o `.avpkg` atual (`docs/recursos/PACOTE.md`) |

### 12.2 Transmissão ao vivo (câmera fixa → YouTube)

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
dentro do processo do telão. Vizinho do 12.1 (controle remoto do pregador pelo
mesmo servidor): as duas são PORTAS NOVAS DE SUBIDA e a decisão de segurança
(código de entrada? só no ponto de acesso?) é UMA só para as duas. Pede Release
(Kotlin) e decisão sobre a invariante de captura.

### 12.3 O app no Windows, e o layout de paisagem

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
de paisagem). Liberar a rotação no Android é Release; o CSS é OTA.

---

## Área 13 — CI / oráculos (residual)

### 13.1 Os oráculos instáveis do CI

> **Tratado pela etapa A1 da revisão (2026-10-30)** — o relatório e o resíduo
> (`configuracoes-janelas`, instrumentado) estão em `docs/revisao/REGISTRO.md`.
> Fica aqui só como residual, não como trabalho aberto em primeiro plano.

Pedido do operador (2026-10-30): *"Urgente. Coloque em prioridade."* O lote
v1.13.16 reprovou TRÊS rodadas seguidas, cada uma num oráculo DIFERENTE, todos
de tempo e nenhum tocado pelo lote; todos passam na máquina local. O método de
conserto é o da campanha de determinismo da v5.316
(`grep -n "v5.316" docs/HISTORICO.md`): achar em cada um a espera que mede o
RUNNER e trocá-la pelo FATO (`esperar`/`esperarDb`), nunca subir prazo; rodar sob
carga (3 processos + `stress`) até reprovar localmente antes de consertar, e
repetir depois.
