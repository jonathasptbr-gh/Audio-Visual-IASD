# TELÃO POR COMANDOS — a substituição do espelho de pixels

> **ESTE DOCUMENTO É O CONTRATO E O DIÁRIO DE BORDO deste trabalho.** Ele foi
> escrito para sobreviver a interrupções: qualquer sessão (humana ou de agente)
> que precise retomar o trabalho começa lendo a seção **"§0 COMO RETOMAR"** e a
> tabela de **Estado** dentro dela. Nenhum passo deste projeto vive só na
> memória de quem o executou — se não está aqui ou num commit, não aconteceu.
>
> Os fatos de código citados vêm da varredura E0 (9 leitores paralelos, 229
> fatos com arquivo:linha) — o bruto está em
> `docs/anexo-varredura-command-stream.json`, que será apagado na E7. As linhas
> citadas valem para o commit da varredura (2026-08-13) e envelhecem.
>
> **RECONCILIADO COM A v5.186 (v1.85)**, que entrou em `main` depois da
> varredura e ANTES da E1: a entrada do espelho virou um CÓDIGO de três
> dígitos (nascido em `EspelhoPares.ligar`, mostrado na folha do operador;
> `POST /par {codigo}` → `200 {t}` | `403` na MESMA resposta, sem fila de
> aprovação), o QR e o `av.local`/mDNS SAÍRAM (qr.js, EspelhoMdns*
> apagados), e `SHELL_VERSION` já é **36**. A exigência que governou aquela
> mudança governa esta também: **o botão de conectar gasta o ÚNICO gesto do
> visitante — entra, liga o som e vai a tela cheia**. Toda decisão abaixo
> que citava QR/av.local foi corrigida; a decisão nova de §3.4 (uma página
> só) existe por causa dessa exigência.

---

## §0 COMO RETOMAR ESTE TRABALHO

1. Leia este arquivo inteiro (é a especificação fechada + o plano).
2. Olhe a tabela de Estado: a primeira etapa não-`CONCLUÍDA` é a atual.
3. Cada etapa diz o que entrega, como se prova e o que NÃO pode quebrar. Uma
   etapa só é `CONCLUÍDA` com testes verdes e commit empurrado (branch de
   trabalho **e** `main`, conforme a regra da etapa).
4. Branch de trabalho: `claude/audio-desconexao-transmissao-web-6tbhsq`.
   `main` recebe merge **apenas de etapas inteiras e seguras** — todo push em
   `main` publica a base web por OTA ao aparelho do operador em minutos
   (aplicação automática, v5.151). `main` verde e funcional é lei.
5. Ao concluir qualquer etapa: atualize a tabela de Estado NO MESMO COMMIT.
6. O espelho de pixels segue sendo o caminho ATIVO até a E6. As etapas E1–E5
   são código escuro (aditivo, não ligado à UI). O corte é a E6, atrás de
   constante, com volta. A remoção é a E7 e nunca antes.

### Estado

| Etapa | Descrição curta | Estado |
|---|---|---|
| E0 | Especificação fechada (este documento) | **CONCLUÍDA** (varredura 9/11 leitores; testes-CI e docs supridos pelo CLAUDE.md) |
| E1 | Fundações puras no shell: Range RFC 7233 + framing SSE no `EspelhoHttp` — com JUnit, sem fiação | **CONCLUÍDA** (commit b756d19, CI verde: 128 JUnit, 21 novos) |
| E2 | Servir o bundle à LAN (prefixos `web/display/`, `web/shared/`, `web/espelho/`) + rota SSE `GET /e` + tap de comandos em `busPost` → servidor | **CONCLUÍDA** (aguardou o CI verde do lote E2+E3) |
| E3 | Papel `tela` no lado web (`espelho/tela.js` + `?tela=1`): display rodando num navegador da LAN, TEXTO completo (versículo, mensagem, cronômetro com correção de relógio, sorteio, cortina), dreno de subida, vigília de tela acesa | **CONCLUÍDA** (tela-rede.test 23/23 no Chromium; ligado no apk.yml) |
| E4 | Mídia sob demanda: cache no shell + canal ArrayBuffer OPFS→shell + `GET /m/<token>` com Range + `__rec` no load + wallpaper | **CONCLUÍDA** (JUnit do cache; tela-rede.test 26/26). Pendências DECLARADAS → E4.1: pré-busca da playlist, imagens de fundo da letra, deck por páginas, proxy da transmissão direta (§7) — hoje deck/stream/embed viram o aviso de cena-sem-rede |
| E5 | Status de volta (`tela-status` → ponte → Controle), eleição de referência, snoop da notificação, preview sem atraso | **CONCLUÍDA** (ramo `st` no /r → MessageBus + snoop; eleição no controle.js; preview: telas de comando não entram em `mirrorEstado.telas`, então o atraso já resolve 0 sem pixels). Folha/Registro novos → E6 |
| E6 | Corte: a transmissão liga o caminho novo; raiz `/` → tela; frases da UI; política YouTube sem TV | **CONCLUÍDA** (commit 518f960) — **DESVIO DECLARADO**: a pedido do operador, E6 e E7 saíram num lote só; a "volta por constante" não existe — a volta é o revert do lote |
| E7 | Remoção: EspelhoCodec/EspelhoAudio/EspelhoDisplay/MirrorPresentation/fmp4.js/cliente.js/espelho.css/sonda.html; EspelhoDiag realocado na MainActivity; dreno do papel espelho fora do native.js; testes e CI atualizados; SHELL_VERSION 37; v5.187 | **CONCLUÍDA** (o commit desta linha) |

> Preencher ao concluir: `CONCLUÍDA (commit <hash>, vX.YZZ)`.
>
> **PROJETO CONCLUÍDO (v5.187 / v1.86).** O que fica de fora, declarado:
> E4.1 (pré-busca da playlist, imagens de fundo da letra, deck por páginas),
> §7 (proxy da transmissão direta — hoje ela cai no download quando não há
> TV), e o primeiro culto de VALIDAÇÃO em aparelho — que, pela regra de
> calendário herdada do espelho, acontece numa terça-feira, nunca num
> domingo. O Registro e a folha mostram as telas de comando; o diagnóstico
> fino delas (eco de __mid, atraso medido) é evolução futura sobre o campo
> `eventos`/`pronta` que já viaja.
>
> **v5.189 fechou a §7 e mudou a PORTA.** A transmissão direta do YouTube
> agora chega às telas: o shell serve as mesmas faixas em `/s/<token>` (repasse
> ao googlevideo com o UA que combina, `Range` do cliente subindo cru) e o
> `telaEnriquecer` reescreve o manifesto — com isso o `pularTransmissao` da
> v5.187, que mandava todo "Tocar agora" para o download quando a transmissão
> estava ligada e não havia TV, deixou de ter razão de existir e saiu. E a
> ENTRADA perdeu o código de três dígitos (a porta é o endereço; ver a
> invariante 5 do `EspelhoPares`): o overlay virou UM botão — "Ativar esta
> tela" — que gasta o gesto, e a perda de token passou a reentrar sozinha, sem
> desenhar nada por cima da mídia. Segue de fora: pré-busca da playlist e deck
> por páginas.
>
> **v5.188 fechou duas dívidas da E4.1 e uma lacuna que a E4 nem via:** as
> **imagens de fundo da letra** agora viajam (`imageUrl` por estrofe no
> `__rec`, uma URL `/m/` por imagem distinta, id estável `ly:`+caminho — o
> mesmo hino duas vezes custa zero re-empurrão), e a tela que CONECTA recebe
> as **preferências visuais** que o telão de verdade lê do IDB e ela não tem
> de onde tirar: wallpaper (token REUSADO — o funil não re-cunha comando que
> já chega com `__wp`; remoção viaja como o sentinela `__wp:'padrao'`),
> `lyricsbg` e `fit`, tudo ENDEREÇADO no mesmo `display-ready` do reenvio de
> cena (`telaReenviarPreferencias`). Seguem de fora: pré-busca da playlist,
> deck por páginas e o proxy §7.

---

## §1 A DECISÃO

O espelho de pixels transmite **o resultado** (H.264 ~3 Mbps + AAC por tela,
contínuos, 0,7–2 s de atraso). O telão por comandos transmite **a causa**: o
mesmo JSON do barramento interno, entregue por SSE a navegadores da LAN que
renderizam localmente. O apêndice §10-A do `ESPELHO-DE-PIXELS.md` é o
argumento: quase toda a sua tabela de defeitos (poda, GOP, IDR, deriva de
áudio, borda viva, fila de quadros) só existe porque há vídeo sendo
transmitido.

**A decisão que governa tudo: a tela da rede roda O MESMO `/web/display/`.**
Nenhum renderizador novo — a invariante 5 (não reimplementar o que já existe
em JS) aplicada ao próprio lado web. O celular serve o próprio bundle (o mesmo
que o OTA atualiza — não existe "cliente desatualizado" possível); o que muda
é o TRANSPORTE dos comandos e a FONTE da mídia.

**Fora da equação, por decisão do operador:** o embed do YouTube. Cena de
embed vira aviso "esta cena não vai para a rede". O caminho padrão de YouTube
(download e transmissão direta) segue recebendo manutenção; transmissão
direta na LAN é a fase opcional §7. E a CSP `default-src 'self'` que o
servidor já põe em toda página **força** essa exclusão por construção: a
IFrame API nem carregaria numa tela da rede.

## §2 O QUE FICA E O QUE MORRE

**Fica (infraestrutura de rede):** `EspelhoServidor` (sockets, bind Wi-Fi,
allowlist de Host, religamento, tetos), `EspelhoHttp` (parser puro — GANHA
Range e SSE), `EspelhoPares` (o CÓDIGO de três dígitos da v5.186 — o
protocolo `/par {codigo}` → `200 {t}` | `403` é contrato com JUnit e NÃO
muda), `EspelhoService`, `EspelhoCert`, `EspelhoDiag` (conteúdo novo), e de
`cliente.js`: a escada de reconexão, o `guardado()` do sessionStorage, o
adeus, e o botão único que gasta o gesto (entrar + som + tela cheia) — tudo
isso MIGRA para o `tela.js` (§3.4), porque a página da tela passa a ser o
próprio display.

**Morre (na E7, nunca antes):** `EspelhoCodec`, `EspelhoAudio`,
`EspelhoDisplay`, `MirrorPresentation`, `fmp4.js`, a maquinaria MSE de
`cliente.js` (~72% das 3.033 linhas — medido na varredura), o batimento e o
bloco de áudio do papel `espelho` em `display.js` (linhas 1716–2149), o dreno
do papel `espelho` em `native.js`, `tools/fmp4.test.mjs`, os blocos MSE de
`tools/espelho-cliente.test.mjs`. O filtro `telasExternas` fica (é cinto e
suspensório documentado), mas a exclusão por `displayId` passa a casar com
nada.

**Some como problema:** deriva A/V (cada tela toca o arquivo com a própria
faixa), poda/GOP/IDR/borda viva, térmica do encoder, atraso do pipeline, e o
`previewAtrasoMs` (v5.162) zera sem pixels.

## §3 ARQUITETURA

```
┌───────────────────────── celular ─────────────────────────┐   ┌─── navegador na LAN ───┐
│ Controle ── AVDB.sendCommand (db.js:832) ──► BC + __AVBus │   │ GET / → redirect       │
│   (no load: anexa __rec com URLs /m/ — §5.5)              │   │        │               │
│                    ▼ busPost (NativeBridge:355)           │   │        ▼               │
│ MessageBus ─► telão/TV      └► EspelhoServidor            │   │ UMA página: display +  │
│      ▲                        │                           │   │ overlay do código      │
│      ▲                        ├ GET  /e   SSE ────────────┼───┼─► comandos JSON        │
│      │ injeta tela-status     ├ GET  web/display|shared ──┼───┼─► o próprio bundle     │
│      │ (POST /r "st")         ├ GET  /m/<token>  Range ───┼───┼─► mídia sob demanda    │
│      │                        └ POST /r  ◄────────────────┼───┼── tela.js: dreno de    │
│ Cache de mídia (canal ArrayBuffer web→Kotlin)             │   │   subida + transporte  │
│ WebPathHandler (mesma resolução OTA→APK)                  │   │   + vigília + overlay  │
└───────────────────────────────────────────────────────────┘   └────────────────────────┘
```

As decisões, cada uma com o porquê e com o fato que a sustenta:

1. **SSE por `fetch`+`ReadableStream`, não `EventSource` e não WebSocket.**
   WebSocket: recusado pelo projeto por falta de oráculo (RFC 6455).
   `EventSource`: não envia headers — forçaria o token para a URL, que a
   invariante 2 do `EspelhoPares` proíbe. O cliente ATUAL já faz
   `fetch('/v')` com `Authorization: Bearer` e `AbortController`
   (cliente.js:2429): o SSE herda o transporte, o vigia e a escada de
   reconexão prontos. O framing SSE é três linhas sobre o `chunked` que o
   `EspelhoHttp` já emite.
2. **O tap do relay é no Kotlin, em `NativeBridge.busPost`.** O `cmd()` do
   Controle NÃO é funil único (seis caminhos chamam `AVDB.sendCommand`
   direto — mic, view, audio-retry, diag-ask, wallpaper, resend). Quem vê
   100% dos comandos de todas as páginas é o relay nativo que o db.js já
   alimenta incondicionalmente no app (db.js:832→native.js:331→busPost).
   O servidor ganha um consumidor ali: JSON verbatim → fila SSE de cada
   tela. Zero interpretação no Kotlin (invariante 5). Sem eco: mensagens
   injetadas pelo servidor entram por `MessageBus.post`, que não passa por
   `busPost`.
3. **O Kotlin não interpreta comandos.** Cena inicial de uma tela que
   conecta: a tela emite `display-ready` com `__de` próprio (display.js:24,
   1667), o tap de subida o entrega ao barramento, e
   `resendSceneToDisplay(msg.__de)` (controle.js:16027) devolve a cena
   endereçada com `__para` — o mecanismo da v5.140, intacto. O reenvio já
   leva rotate→load(time/playing)→view→text, na ordem certa.
4. **UMA PÁGINA SÓ: a tela da rede É o `/display/` com o `tela.js` de
   casca.** A raiz `/` da LAN responde um redirect para
   `/display/index.html?tela=1`; NÃO existe página de entrada separada. O
   motivo é a exigência da v5.186: `requestFullscreen()` e sair do `muted`
   exigem ativação transitória, o gesto vale segundos e **não sobrevive a
   uma navegação** — uma página de entrada que navegasse ao display
   perderia o gesto, e a tela entraria muda e em janela. O tela.js desenha
   o overlay de entrada (campo de três dígitos + botão) POR CIMA do display
   ainda vazio; o toque no botão faz, na ordem: `POST /par {codigo}` →
   guarda o token → desmuta o `<video>` do stage → `requestFullscreen` →
   abre o SSE — tudo no mesmo gesto, na mesma página.
   O `tela.js` entra em `display/index.html` ANTES de `db.js` e é ativado
   por query explícita (`?tela=1` — nunca adivinhação de origem: o fluxo
   de desenvolvimento no navegador continua). Ele define `window.__AVBus`
   ANTES de db.js capturá-lo na carga (db.js:801) — a mesma janela do
   native.js. `recv` = eventos do SSE; `post` = o DRENO DE SUBIDA (§5.4).
   Define `__AV_ROLE__='tela'` (nenhum código existente testa
   `=== 'display'`; `ESPELHO` fica false; guardas `!== 'controle'` seguem
   corretas). Neutraliza o `postMessage` do BroadcastChannel como o papel
   espelho fazia (duas abas no mesmo PC não se contaminam). `__NATIVE__`
   fica indefinido: o comportamento "navegador" do display é o correto
   aqui. Fora do papel `tela`, o arquivo é um no-op de uma guarda.
5. **A mídia viaja por `__rec` + `/m/<token>`.** O `load` só carrega
   `mediaId`; TUDO vem de `AVDB.getMedia` no IDB — chamado DUAS vezes
   (display.js:1549 e stage.js:735) — e numa tela da LAN o IDB está vazio e
   o OPFS nem existe (`getDirectory` é secure-context). A solução de menor
   toque: o Controle anexa ao load um registro SANEADO (`__rec`) em que
   toda referência local vira URL servível: `opfsPath/blob` → `url:
   '/m/<token>'`; `pages[i]` → URLs por página; `lyrics[].imageOpfsPath` →
   URL; `stream`/`youtubeId` → nunca chegam (§5.6). Como `rec.url` entra
   DIRETO no `src` (stage.js:785), o stage não muda. O tela.js instala o
   `__rec` num cache local e embrulha `AVDB.getMedia` para respondê-lo —
   UM ponto cobre os dois chamadores. O comando enriquecido também chega ao
   telão de verdade, que o ignora (getMedia local vence).
6. **Tokens de serviço opacos, padrão `SafRegistry`** (128 bits base64url,
   mesmo token para o mesmo recurso, morrem com a sessão de transmissão).
   NÃO são o token de sessão — a regra "o token de sessão nunca viaja numa
   URL" fica intacta; um token de serviço concede UM recurso, na LAN,
   enquanto a transmissão durar. Rota `/m/` anônima (o token é a
   capacidade); bundle (`web/display|shared|espelho`) anônimo por allowlist
   de PREFIXO com contenção por canonicalPath — **nunca `web/controle/`**;
   `/e` e `/r` autenticados por `Authorization` como hoje.
7. **Range de verdade, nosso.** No `ServerSocket` a invariante 8 se inverte:
   quem aplica Range somos nós, com `206`/`Content-Range`/`416` reais —
   copiar o StreamProxy (200 seco, fatia-como-todo) é o erro exato já
   documentado. Parsing puro no `EspelhoHttp` (que hoje DESCARTA o header
   Range), com JUnit. Faixa única. `Connection: close` fica (a premissa
   anti-smuggling não cai): por tela, 1 SSE + 1 mídia + POSTs curtos cabem
   nas 6 conexões do Chromium — os POSTs já têm prazo de 15 s (v5.181).
8. **Heartbeat SSE de 15 s** (`: ping`), e ele paga três contas de uma vez:
   o vigia de fio do cliente (que hoje depende dos bytes contínuos do
   vídeo), o TCP meio-aberto do lado do servidor (escrita falha → tela
   morta), e o **wake lock do EspelhoService**, cuja renovação é por
   progresso real de escrita — sem tráfego, o teto de 2 h venceria no meio
   do culto (fato da varredura).
9. **Status: dreno de subida + eleição no Controle.** N telas emitindo
   `display-status`/`media-ended`/`mic-status` é exatamente o que o dreno
   do papel espelho existe para calar — o problema reaparece na direção
   LAN→celular. O `post` do tela.js é lista de PERMISSÃO: `display-ready`
   (com `__tela`) e `display-status` RENOMEADO `tela-status` (com
   `__tela`); todo o resto morre mudo (media-ended dobraria o repeat-one;
   mic-status 'unsupported' apagaria o microfone real; quem avança playlist
   continua sendo o Controle, como hoje). O Kotlin injeta o `st` verbatim
   no barramento E alimenta o snoop da notificação de mídia (a exceção já
   documentada do `snoopDisplayStatus`: copiar campos que o web calculou).
   Quem ELEGE a referência entre N telas é o Controle (invariante 5) — a
   mais antiga com `mediaId === currentId`; o telão de verdade tem
   precedência pelo relógio de 2,5 s que já existe.
10. **Som opt-in continua** (invariante 10): a tela nasce muda; o gesto
    desmuta `el.v` — agora é um atributo, sem MediaSource, sem torneira.
11. **Microfone nunca sai na rede** — inalterado; numa página http nem há
    `getUserMedia`, e o `mic-status` que isso geraria morre no dreno.
12. **Relógio das telas.** Cronômetro e sorteio viajam por descritor com
    epoch ms (`startAt`, `rollUntil`) e supõem relógio comum — uma Smart TV
    com minutos de desvio contaria errado. O tela.js mede o desvio
    (`Date.now()` da tela − epoch do celular, que o heartbeat SSE carrega;
    mediana de várias amostras, ignorando outliers de rede) e SOMA o offset
    aos campos de epoch dos comandos que chegam. Correção no lado web, por
    tipo de campo conhecido — o Kotlin segue sem interpretar.
13. **Vigília de tela acesa.** O espelho de pixels mantinha a tela da TV
    acesa porque um `<video>` tocava sempre; numa cena de texto por
    comandos não há vídeo, `navigator.wakeLock` não existe em http, e a
    tela apagaria no meio do sermão. O tela.js mantém um `<video>` 1×1
    mudo em loop tocando ("vigília") — o truque clássico, honesto sobre o
    limite: navegador que o ignore vai apagar, e a frase da folha diz para
    desligar a economia de tela do aparelho.
14. **Despedida e adeus, desde o primeiro commit.** O SSE ganha o evento
    `{"m":"adeus"}` no desligar; o cliente reusa a máquina que já existe
    (ADEUS_VOLTA_MS, volta sozinho em 20 s). A lição da v5.154 (código
    morto simétrico) exige o caso no teste de cliente desde a E2.
15. **404 uniforme e queda de token**: mantidos — qualquer 404 nas rotas
    autenticadas derruba o token e volta ao pareamento, como hoje.

## §4 SEQUÊNCIA DE UM CULTO

1. Operador liga a transmissão. Sobe servidor+service — sem tela virtual,
   sem codec, sem janela. A folha mostra o ENDEREÇO (IP) e o CÓDIGO de
   três dígitos (v5.186).
2. Visitante abre `http://<ip>:8787/` → redirect para
   `/display/index.html?tela=1`, servido DO CELULAR (mesmo bundle do OTA).
   O tela.js mostra o overlay: campo de três dígitos + botão.
3. O toque no botão gasta o gesto: `POST /par {codigo}` → token → som +
   tela cheia → SSE aberto → `display-ready` sobe pelo dreno e volta como
   cena endereçada.
4. Cada comando chega em ~10 ms. Texto renderiza vetorial. `load` traz
   `__rec` com `/m/<token>`; o navegador toca com Range e áudio próprio.
5. A tela reporta `tela-status`; o Controle elege a referência para barra,
   MediaSession e preview.
6. Queda de Wi-Fi: a escada de reconexão reabre o SSE, `display-ready` de
   novo, cena com posição — o caminho do dongle. O que estava na tela nem
   pisca durante a queda.

## §5 CONTRATOS

### 5.1 SSE (`GET /e`)
`200`, `Content-Type: text/event-stream`, sem Content-Length, chunked como o
`/v` de hoje. Evento = `data: <json>\n\n`. Heartbeat `: ping <epoch-ms>\n\n`
a cada 15 s (o epoch alimenta a correção de relógio). Auth: `Authorization`
(fetch). Na abertura o servidor manda `{"m":"oi","ms":<epoch>}` e nada mais —
estado vem do reenvio de cena.

### 5.2 Comandos (celular → telas)
JSON do barramento, verbatim, com `__mid` preservado (o dedup do db.js segue
valendo via o `__AVBus` do tela.js). Endereçado (`__para`) vai só à tela dona
— o servidor conhece o `__de`/`__tela` que cada tela anunciou e filtra por
igualdade de string, sem ler mais nada do JSON. Broadcast vai a todas.
Payloads em português passam INTACTOS — o caminho de comandos não passa por
`sanear()` (que é para o Registro e apagaria acentos).

### 5.3 Mídia (`GET /m/<token>`)
Range RFC 7233 faixa única; sem Range → 200 inteiro; malformado → 416/400.
`Accept-Ranges: bytes`, `Content-Type` do registro. Token de serviço opaco
por recurso+sessão. Enquanto o arquivo ainda está sendo empurrado pelo canal
ArrayBuffer, a rota serve o que existe em chunked sem Content-Length e Range
só vale depois de completo (regra simples, declarada; a pré-busca torna o
caso raro).

### 5.4 Subida (`POST /r`)
Ramos novos: `{"st": <tela-status>}` (injetado verbatim no MessageBus +
snoop da notificação; teto 4 KiB; sem sanear no caminho do barramento) e o
`alive` de sempre com telemetria NOVA de tela (§9). O dreno de subida do
tela.js garante que só `display-ready` e `tela-status` sobem.

### 5.5 O registro saneado (`__rec`)
Campos: `id, kind, name, type, url` (→ `/m/<token>`), `seconds, height,
thumb?` (URL ou omitido), `pages?` (URLs), `lyrics?` (slides com
`imageUrl` no lugar de `imageOpfsPath`, mantendo `time/text/auxText/cover/
imagePosition`), `hymnName?, hymnTrack?`. NUNCA: `blob`, `opfsPath`,
`stream`, `youtubeId`. Anexado pelo Controle na emissão do load quando a
transmissão está ligada; o wallpaper vai por `__wp: <url>` no comando
`wallpaper` e no reenvio de cena.

### 5.6 Cenas que não vão para a rede
`kind === 'youtube'` (embed) e `rec.stream` (transmissão direta, fase §7):
o Controle relaya no lugar do load um `{type:'tela-aviso',
texto:'Esta cena não aparece nas telas da rede.'}` + `media-clear`. O
tela.js desenha o aviso; o display limpa. Política E6: com transmissão
ligada e sem TV, "Tocar agora" de YouTube cai no download.

## §6 AS ETAPAS

Cada etapa: testes verdes, Estado atualizado, commit na branch, merge em
`main` (E1–E5 são escuras; E6 é o corte; ver §0.6).

- **E1 — fundações puras.** `EspelhoHttp`: `parsearRange(header, tamanho)`
  → `Faixa|null|Invalida`, `respostaParcial()`, `resposta416()`,
  `respostaSse()`, `eventoSse()`, `pingSse()`; o parser passa a CAPTURAR o
  header `Range` (política de duplicata: recusa, como os quatro campos que
  já lê). JUnit: as formas malformadas, limites, duplicata, e o caso
  `bytes=a-` / `bytes=-n` / além-do-fim. Nada fiado.
- **E2 — bundle + SSE + tap.** Prefixo-allowlist no servidor
  (`web/display/`, `web/shared/`, `web/espelho/` — jamais `web/controle/`)
  usando a resolução do `WebPathHandler` (sessionRoot OTA → assets APK, por
  arquivo); rota `/e` com heartbeat+epoch e adeus; consumidor de barramento
  em `busPost` → `EspelhoServidor.difundirJson` (novo), com filas por tela
  e a conta do `TETO_EM_VOO` refeita (SSE + mídia por tela); renovação do
  wake lock pelos writes do SSE. `SHELL_VERSION` NÃO sobe aqui: o tap não é
  superfície da ponte (o web não o vê), e a regra do repositório manda subir
  só quando a superfície muda — o bump vai na E4, junto com o canal de mídia
  e o `__rec` (a primeira mudança que o web precisa detectar). Prova:
  o CI compila e roda os JUnit (o roteamento é código de socket, fora do
  alcance de teste puro — o padrão da casa: o `EspelhoServidor` nunca teve
  JUnit próprio); o contrato é provado do lado do CLIENTE na E3, quando o
  `tela.js` existir (`tools/tela-rede.test.mjs` contra servidor de mentira,
  o molde do espelho-cliente.test). NOTA da E4: o `SHELL_VERSION` acabou não
  subindo em lugar nenhum — a detecção do canal de mídia é por PRESENÇA
  (`window.__avTelaMidia`, a mesma pergunta que `__AVBridge` sempre
  respondeu), que degrada melhor que número de versão.
- **E3 — papel tela, texto completo.** `espelho/tela.js` (bus, dreno de
  subida, overlay de ENTRADA com o código e o botão de gesto único —
  migrado de cliente.js —, correção de relógio, vigília, overlay de
  aviso); `display/index.html` ganha `<script src="../espelho/tela.js">`
  ANTES de `db.js`, inerte fora do papel. A raiz `/` NÃO muda aqui — o
  cliente de pixels a usa até o corte, e trocá-la agora quebraria o caminho
  ativo (o redirect para `?tela=1` é da E6). Prova: tela-rede.test cobre a entrada
  pelo código (certo e errado), versículo com acento, cronômetro
  com relógio da página adiantado em 90 s (a correção tem de anular),
  sorteio, cortina, text-hide, reconexão→display-ready→cena, dreno (nada
  além de display-ready/tela-status sobe), BC neutralizado.
- **E4 — mídia.** Canal `__avTelaMidia` (ArrayBuffer, molde EspelhoAudio:
  origem exata, isMainFrame, teto por mensagem, fila fora da main);
  `EspelhoMidia.kt` (cache em cacheDir, LRU por bytes, tokens opacos,
  servir-enquanto-cresce); rota `/m/`; `__rec`/`__wp` no Controle;
  pré-busca (ligar a transmissão empurra o item no ar e a playlist do
  Cronograma, em segundo plano, com `bgProgress` se demorar). Prova: JUnit
  do cache e do Range fiado; tela-rede.test toca um vídeo pequeno com
  Range de verdade e um áudio com letra (imageUrl no slide).
- **E5 — status, referência, preview, Registro.** Injeção `st` + snoop;
  eleição no Controle; `recalcularAtrasoPreview` → 0 para telas de
  comando (a condição atual daria 1.200 ms de atraso indevido a telas sem
  `vivo.vfim` — fato da varredura); telemetria nova no alive (último
  `__mid` aplicado + atraso de eco, estado do `<video>`, gesto/som/
  telaAcesaMin) e o bloco do Registro reescrito (§9). Prova: tela-rede.test
  + caso de eleição com duas telas.
- **E6 — o corte.** `ligarEspelho()` passa a subir servidor SEM
  `EspelhoDisplay.ligar` (constante `ESPELHO_PIXELS = false` por um lote,
  com o caminho velho compilado); frases MIRROR_TEXTO/confirmação com TV
  reescritas (os custos que descrevem deixaram de existir); política
  YouTube sem TV; `espelhoEstado()` ganha os campos novos mantendo os
  velhos até a E7. **Liga-se numa terça-feira.** Prova: smoke completo +
  culto de teste do operador.
- **E7 — remoção.** A lista do §2; `EspelhoDiag` realocado (dono passa a
  ser quem liga o servidor); `contexto-seguro.test.mjs` passa a varrer
  também `display/` e `shared/` (a tela roda em http — a varredura provou
  que hoje o escopo é só `espelho/`); `ESPELHO-DE-PIXELS.md` ganha nota de
  aposentadoria apontando para cá; CLAUDE.md reescrito; SHELL_VERSION sobe
  de novo se a superfície da ponte mudar na limpeza.

## §7 FASE OPCIONAL (registrada para não se perder)
Transmissão direta na LAN: rota proxy com a lógica do StreamProxy (UA
casado, upstream googlevideo) mas com **Range de verdade e streaming real**
(o StreamProxy lê o pedaço inteiro em memória — não serve para 3 clientes), e
`__rec.stream` com URLs reescritas para o host do celular. O `mse.js` da
tela consome com header Range (o modo query é só do caminho nativo).

## §8 SEGURANÇA — o que muda de verdade
A inversão da §10 do espelho cresce: com `/m/`, o servidor tem OS ARQUIVOS
que o operador transmitir (não a foto deles), em HTTP claro por padrão. Fica
escrito na folha como as outras inversões; o degrau de TLS é a resposta. O
que não muda: mic nunca sai, token de sessão nunca em URL, allowlist de Host
exata, teto de 3 sessões, 404 uniforme, `web/controle/` jamais servido à
rede, CSP `self` nas páginas servidas.

## §9 DIAGNÓSTICO (Registro)
Morrem: readback, encoder, ritmo, fila de quadros, IDR, csd. Nascem, por
tela: conectada há quanto, último comando aplicado (`__mid` + atraso de
eco), mídia e posição reportadas, gesto/som, telaAcesaMin, bytes servidos de
`/m/`, cache (itens/MB/despejos), heartbeats perdidos. Molde de sempre:
Kotlin devolve JSON, controle.js monta a frase, linha ausente = shell
antigo. O `EspelhoDiag` (anel) sobrevive à troca — realocado na E7.

## §10 FATOS DA VARREDURA — os que moldaram a spec

1. **Funil real de comandos**: `AVDB.sendCommand` (db.js:832) manda TODA
   mensagem por BC + `__AVBus.post` → `busPost` (native.js:331,
   NativeBridge.kt:355) → `MessageBus.post` — o tap Kotlin vê 100%;
   `cmd()` não (seis chamadores diretos de sendCommand).
2. **Dedup**: `__mid` por página (`MID_PREFIX:seq`), Set de 400; o dedup só
   roda quando há `bus` — o tela.js fornece um, então herda a semântica.
3. **Endereçamento**: `__de`/`__para` vivem em display.js:24/1430/1667 e
   controle.js:15943/16027 — prontos para N telas.
4. **`load` resolve tudo do IDB**, `getMedia` chamado 2× (display.js:1549,
   stage.js:735); precedência blob→pages→opfsPath→stream→url; `rec.url`
   entra direto no src (stage.js:785) — daí o `__rec` com URL.
5. **OPFS é secure-context** (db.js:466): telas http não têm; IDB existe
   mas é por-aparelho (vazio na tela). Letra: `rec.lyrics[]` com
   `imageOpfsPath` (display.js:264,341) — precisa de URL. Wallpaper: blob
   no state do IDB, comando não transporta (display.js:752) — daí `__wp`.
6. **Texto viaja completo no comando** (verse/message inline; chrono/draw
   por DESCRITOR com epoch — display.js:462-499) — texto funciona sem
   mídia nenhuma; o epoch exige a correção de relógio.
7. **Auth hoje**: `Authorization: Bearer` ou token nu (EspelhoPares.validar,
   tempo constante); token no corpo do `/par` (`200 {t}`); cliente usa
   fetch+ReadableStream — NÃO EventSource. Cookie não chega ao parser (o
   when descarta) — e não será preciso.
8. **`EspelhoHttp` não tem Range** (KDoc invariante 7 declara; o header é
   descartado) e põe `Cache-Control: no-store` em TUDO (suíte trava) —
   E1/E4 declaram exceções explícitas.
9. **`Connection: close` + 6 conexões do Chromium**: PRAZO_POST_MS=15 s já
   existe; SSE(1)+mídia(1)+POSTs curtos cabem.
10. **Wake lock renovado por escrita real** (EspelhoService.progresso ←
    threads de escrita); vigia do cliente SEM_BYTES_MS=20 s supõe bytes
    contínuos — o heartbeat de 15 s sustenta os dois.
11. **Servidor→Controle não existe** (KDoc deliberado; estado por enquete
    de 2,5 s) — o `st` injetado no MessageBus é o caminho novo; a folha
    continua na enquete.
12. **`snoopDisplayStatus`** (NativeBridge:355) alimenta a notificação com
    o app minimizado — o ramo `st` precisa alimentá-lo também.
13. **Bundle à LAN**: `WebPathHandler.handle` resolve qualquer caminho
    (sessionRoot OTA → APK, por arquivo, contenção canonicalPath) — a
    allowlist de PREFIXO substitui o mapa fixo ESTATICOS para o bundle, e
    o KDoc dele muda junto.
14. **`previewAtrasoMs`**: mediana de `vivo.vfim`; telas SEM vfim caem no
    PADRÃO de 1.200 ms — a condição muda na E5 ou a preview atrasa 1,2 s
    à toa.
15. **Sem vídeo tocando a tela apaga** (o cliente atual documenta que o
    `<video>` cheio segura a tela; wakeLock é secure-context) — a vigília.
16. **`sanear()` apagaria acentos** — o caminho de comandos não passa por
    ele (é ferramenta do Registro).
17. **StreamProxy não é molde para a LAN** (200 seco, fatia-como-todo,
    pedaço inteiro em memória) — Range real é obrigatório e novo.
18. **Canal ArrayBuffer** (EspelhoAudio.instalar): WebViewCompat +
    allowedOriginRules exato + isMainFrame + teto por mensagem + fila fora
    da main — o molde do `__avTelaMidia`.
19. ~~QR/pareamento~~ **SUPERADO pela v5.186**: a entrada é o código de
    três dígitos (`/par {codigo}` → `200 {t}` | `403`, JUnit dos dois
    lados); QR, filas de espera e av.local/mDNS já saíram do código.
20. **Frases da UI do espelho** (MIRROR_TEXTO, confirmação com TV,
    'até três navegadores') descrevem custos de pixels — mentem no mundo
    novo; reescrever na E6.

*(CI e promessas de docs — leitores que caíram no limite de sessão — foram
supridos pelo CLAUDE.md, que descreve o apk.yml passo a passo e as regras
operacionais: OTA×APK, terça-feira, alfa fechado.)*
