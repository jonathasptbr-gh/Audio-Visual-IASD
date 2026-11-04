# TELÃO POR COMANDOS — o telão nas telas da rede local

> **ESTE DOCUMENTO É O CONTRATO** do telão nas telas da rede: até três
> navegadores da LAN rodando o MESMO `/web/display/` (papel `tela`), servido
> pelo celular. Ele descreve o que o código faz HOJE, e as duas seções finais
> ("O DRENO do papel `tela`" e "O mapa de hoje") são o resumo para quem vai
> mexer. A CONSTRUÇÃO — a varredura E0, as etapas E1–E7 e as rodadas em aparelho
> da v5.186 à v5.223 — mora no apêndice:
> `grep -n "v5.18[6-9]\|v5.19[0-9]\|v5.2[0-2][0-9]" docs/HISTORICO.md`. O anexo
> bruto da varredura (`docs/anexo-varredura-command-stream.json`) foi apagado,
> como estava previsto.
>
> **O servidor tem UM inquilino.** Da v1.8.0 à v1.8.16 ele hospedou também o
> clone da biblioteca celular a celular (`/acervo/*`), que saiu
> (`grep -n "v1.8.16" docs/HISTORICO.md`); a porta nasce aberta porque o que
> passa por ela é conteúdo público por definição.

---

## §0 ESTADO

**Concluído** na v5.187 (APK v1.86) — o corte e a remoção do espelho de pixels
num lote só — e **confirmado em rede de verdade** na v5.205. Fica de fora,
declarado:

| o quê | estado |
|---|---|
| **pré-busca da playlist** (a E4.1 restante: ligar a transmissão empurraria o item no ar e o Cronograma) | não existe — cada mídia é empurrada no `load` que a projeta (`telaGarantirEnvio`) |
| **a rota `/s/<token>`** (§7) | no Kotlin, SEM CLIENTE desde a v1.8.82 |
| **diagnóstico fino por tela** (eco de `__mid`, atraso medido) | não existe; o Registro lê `eventos`/`pronta`/`fila` (§9) |

---

## §1 A DECISÃO

O espelho de pixels transmitia **o resultado** (H.264 ~3 Mbps + AAC por tela,
contínuos, 0,7–2 s de atraso). O telão por comandos transmite **a causa**: o
mesmo JSON do barramento interno, entregue por SSE a navegadores da LAN que
renderizam localmente. A auditoria do espelho (v5.154 → v5.186 no
`docs/HISTORICO.md`) é o argumento: quase toda a sua tabela de defeitos (poda, GOP, IDR, deriva de
áudio, borda viva, fila de quadros) só existe porque há vídeo sendo
transmitido.

**A decisão que governa tudo: a tela da rede roda O MESMO `/web/display/`.**
Nenhum renderizador novo — a invariante 5 (não reimplementar o que já existe
em JS) aplicada ao próprio lado web. O celular serve o próprio bundle (o mesmo
que o OTA atualiza — não existe "cliente desatualizado" possível); o que muda
é o TRANSPORTE dos comandos e a FONTE da mídia.

**O YouTube atravessa como ARQUIVO.** O embed saiu do app na v5.212; um
`kind: 'youtube'` (o link sem bytes) é resolvido por DOWNLOAD no Controle antes
do `load` (`resolverLinkYoutube`), e o arquivo baixado atravessa pela
`/m/<token>` como qualquer outra mídia. A CSP `default-src 'self'` que o
servidor põe em toda página barraria a IFrame API de qualquer jeito.

## §2 O QUE FICOU E O QUE SAIU

**Ficou (infraestrutura de rede):** `EspelhoServidor` (sockets, bind num IPv4
servível, allowlist de `Host`, religamento, tetos), `EspelhoHttp` (parser puro,
com Range e SSE), `EspelhoPares` (o `/par` anônimo → `200 {t}` | `403`, com
JUnit), `EspelhoEnergia`, `EspelhoCert`, `EspelhoDiag`. Do cliente de pixels
migraram para o `espelho/tela.js` a escada de reconexão, o `guardado()` do
`sessionStorage`, o adeus e o botão único que gasta o gesto.

**Saiu (E7, v5.187):** `EspelhoCodec`, `EspelhoAudio`, `EspelhoDisplay`,
`MirrorPresentation`, o `fmp4.js`, o `cliente.js`, o papel `espelho` do
`display.js` e o dreno dele no `native.js`, e os oráculos
`fmp4.test.mjs`/`espelho-cliente.test.mjs`. O filtro `telasExternas` da
`MainActivity` FICOU, só com o `FLAG_PRIVATE`: a exclusão por `displayId` saiu
com a tela virtual.

**Sumiu como problema:** deriva A/V (cada tela toca o arquivo com a própria
faixa), poda/GOP/IDR/borda viva, térmica do encoder, atraso do pipeline, e o
atraso da preview para telas de comando (`dePixels` em
`recalcularAtrasoPreview` — ver "O mapa de hoje").

> **§2.3 e §2.4 vieram VERBATIM do antigo `ESPELHO-DE-PIXELS.md`** (removido
> na revisão A4; o resto dele está no git, `git show 6db65c4:docs/ESPELHO-DE-PIXELS.md`).
> São as que o código ainda cita: o socket nunca em `0.0.0.0` e o TLS. Onde
> falam do vídeo, é o transporte antigo; a regra vale igual para o telão por comandos.

### §2.3 A rede: onde o socket liga, e por que isso é a linha mais importante da seção

`ServerSocket(8787)` liga em **0.0.0.0** — toda interface do aparelho, inclusive `rmnet`. E o
enunciado deste projeto diz que a igreja pode não ter internet, cujo desfecho normal é o celular em
dados móveis. Operadoras brasileiras entregam **IPv6 globalmente roteável** ao aparelho, sem NAT e
sem firewall implícito. O resultado seria **o culto em H.264 numa porta alcançável do mundo,
protegida por um código curto** — e ninguém no prédio teria como perceber.

**A regra, e ela não é negociável:**

1. O socket é ligado ao **endereço IPv4 da rede ativa**, explicitamente
   (`ServerSocket().bind(InetSocketAddress(ipv4DaWifi, porta), backlog)`), **nunca** pelo construtor
   de porta e **nunca** em `::`. Os endereços IPv6 temporários do Android rotacionam, e um bind em
   `::` reintroduz o problema por outra porta.
2. **Recusa ligar** quando `NetworkCapabilities` não tiver `TRANSPORT_WIFI`, ou tiver
   `TRANSPORT_CELLULAR` ou `TRANSPORT_VPN` — com a frase no Registro, nunca em silêncio.
3. `registerNetworkCallback` → `onLost` / `onCapabilitiesChanged` que perca o Wi-Fi **desliga o
   servidor**. Um endereço que sumiu não pode continuar escutando.

Isto reinstala, com mais rigor, a regra do plano original ("sem Wi-Fi, não desenhar o
endereço nem o QR"), que a versão intermediária tinha perdido.

### §2.4 TLS — o degrau, com as três condições que são do operador

Certificado público para IP privado **não existe e nunca vai existir**: a CA/Browser Forum proibiu
*Reserved IP Addresses* e *Internal Names* em 2015 e mandou revogar os remanescentes em 2016
**(doc — [CA/B Forum](https://cabforum.org/working-groups/server/internal-names/))**. A Let's Encrypt
passou a emitir para IP, **só IP público, só HTTP-01/TLS-ALPN-01**. Autoassinado com CA instalada no
cliente está **descartado**: desde o Android 7 apps com `targetSdk ≥ 24` não confiam em CA de
usuário, o Chrome do Android exige Certificate Transparency (`ERR_CERTIFICATE_TRANSPARENCY_REQUIRED`
numa CA própria), e o navegador de uma smart TV não tem UI para instalar CA. Trocaria uma limitação
silenciosa e previsível por **uma tela vermelha em cada culto, em cada aparelho**.

O que **funciona** é o modelo Plex/Tailscale: **um NOME que o operador controla, com registro `A`
apontando para o IP privado, e certificado emitido por DNS-01** **(prática — `*.plex.direct`,
`*.ts.net`)**. Do lado Kotlin custa ~40 linhas e **zero dependência**: `KeyStore.getInstance("PKCS12")`
→ `KeyManagerFactory` → `SSLContext.getInstance("TLS")`, e daí em diante os `InputStream`/`OutputStream`
são idênticos. O custo de CPU é irrelevante: 3 Mbps = 0,375 MB/s, e AES-GCM com as extensões ARMv8
roda em ~1,2 GB/s por núcleo — **~0,03% de um núcleo**.

**As três condições, e as três são do operador, não do código:**

1. um subdomínio dedicado com **wildcard por DNS-01** (`*.lan.igreja.org.br`), para trocar de IP sem
   reemitir;
2. **uma entrada estática de DNS no roteador da igreja** (`address=/telao.igreja.org.br/192.168.0.42`
   no dnsmasq). Sem ela o nome só resolve com internet, e a proteção contra DNS rebinding — ligada
   por padrão em pfSense e Fritz!Box, e o motivo nº 1 de suporte do próprio Plex — o quebra em
   silêncio;
3. renovação automática. O teto de validade já é **200 dias** e cai para 100 em 2027 e 47 em 2029
   **(doc — [Ballot SC-081v3](https://cabforum.org/2025/04/11/ballot-sc081v3-introduce-schedule-of-reducing-validity-and-data-reuse-periods/))**.

**A chave privada nunca vai no APK** (as Releases são públicas no GitHub) e **nunca vai no backup**
(mesma disciplina de `res/xml/backup_rules.xml` e `data_extraction_rules.xml`, que já existem para o
bundle OTA). O `.p12` chega por importação manual (`pickDoc`, que já existe), **com a senha digitada
à mão pelo operador** — senha no mesmo canal do arquivo anula o `sha256` e o TLS, coisa que o
próprio `WebUpdater.kt:558` já admite por escrito **(código)**.

**E a "placa de rua" NÃO leva credencial no APK.** A ideia de o celular publicar sozinho o IP no
site do operador exige um segredo compartilhado, e o segredo estaria num binário público — qualquer
pessoa reescreveria `igreja.org.br/telao` e a página oficial da igreja passaria a apontar para onde
o atacante quisesse, com o domínio da própria igreja. As duas formas aceitas são: o operador digita
o endereço no site à mão (uma vez por IP novo, e o IP é fixo por reserva de DHCP), ou uma credencial
**por aparelho**, digitada em Configurações — a mesma disciplina da senha do `.p12`. E a página fica
**atrás de login**, não "atrás de login *ou* com valor que expira": expirar não esconde nada de quem
olha durante o culto, que é a janela em que o valor é útil.

## §3 ARQUITETURA

```
┌───────────────────────── celular ─────────────────────────┐   ┌─── navegador na LAN ───┐
│ Controle ── AVDB.sendCommand ──► BC + __AVBus             │   │ GET / → 302            │
│   (no load: anexa __rec com URLs /m/ — §5.5)              │   │        │               │
│                    ▼ NativeBridge.busPost → tapLan        │   │        ▼               │
│ MessageBus ─► telão/TV      └► EspelhoServidor            │   │ UMA página: display +  │
│      ▲                        │                           │   │ entrada (UM botão)     │
│      │                        ├ GET  /e   SSE ────────────┼───┼─► comandos JSON        │
│      │ injeta display-ready/  ├ GET  /display|shared|     │   │                        │
│      │ tela-status            │      espelho ─────────────┼───┼─► o próprio bundle     │
│      │ (POST /r "st")         ├ GET  /m/<token>  Range ───┼───┼─► mídia sob demanda    │
│      │                        └ POST /r  ◄────────────────┼───┼── tela.js: dreno de    │
│ EspelhoMidiaCache (canal ArrayBuffer web→Kotlin)          │   │   subida + transporte  │
│ bundle: sessionRoot OTA → assets do APK, por arquivo      │   │   + vigília + entrada  │
└───────────────────────────────────────────────────────────┘   └────────────────────────┘
```

As decisões, cada uma com o porquê e com o fato que a sustenta:

1. **SSE por `fetch`+`ReadableStream`, não `EventSource` e não WebSocket.**
   WebSocket: recusado pelo projeto por falta de oráculo (RFC 6455).
   `EventSource`: não envia headers — forçaria o token para a URL, que a
   invariante 2 do `EspelhoPares` proíbe. O `tela.js` faz `fetch('/e')` com
   `Authorization: Bearer` e um `AbortController` — **com guarda**
   (`abortador()`): navegador de TV anterior ao Chromium 66 não o tem, e sem a
   guarda o `new AbortController()` lançaria dentro do `conectar()`; sem ele o
   `fetch` vai sem `signal` e o laço de reconexão segue inteiro. O framing SSE
   é três linhas sobre o `chunked` que o `EspelhoHttp` já emite.
2. **O tap do relay é no Kotlin, em `NativeBridge.busPost`.** O `cmd()` do
   Controle NÃO é funil único: o `controle.js` chama `AVDB.sendCommand` direto
   em vários pontos (o reenvio de cena, o wallpaper, o `tela-aviso`…). Quem vê
   100% dos comandos de todas as páginas é o relay nativo que o `db.js` já
   alimenta incondicionalmente no app (`sendCommand` → `__AVBus.post` →
   `B.busPost` no `native.js` → `NativeBridge.busPost`). O consumidor ali é o
   `NativeBridge.tapLan`, que a `MainActivity` aponta para
   `EspelhoServidor.difundirJson` enquanto o servidor está no ar: JSON verbatim
   → fila SSE de cada tela. Zero interpretação no Kotlin (invariante 5). Sem eco
   por construção: mensagens injetadas pelo servidor entram por
   `MessageBus.post(null,…)`, que não passa por `busPost` — um comando vindo
   de uma tela não volta para as telas.
3. **O Kotlin não interpreta comandos.** Cena inicial de uma tela que
   conecta: a tela emite `display-ready` com `__de` próprio (`INSTANCIA` do
   `display.js`), o servidor o injeta no barramento, e
   `resendSceneToDisplay(msg.__de)` devolve a cena endereçada com `__para` — o
   mecanismo da v5.140, intacto. O reenvio leva `rotate` → `load` (com `view`,
   `time`, `playing` e `page` dentro) → o `text` projetado, nessa ordem.
4. **UMA PÁGINA SÓ: a tela da rede É o `/display/` com o `tela.js` de
   casca.** `requestFullscreen()` e sair do `muted` exigem ativação transitória,
   o gesto vale segundos e **não sobrevive a uma navegação** — uma página de
   entrada que navegasse ao display perderia o gesto, e a tela entraria muda e
   em janela. O `tela.js` desenha a entrada (UM botão, "Ativar esta tela") POR
   CIMA do display ainda vazio, e o toque gasta o gesto ANTES da rede
   (`gastarGesto`: `requestFullscreen` → `__telaSom(true)` → vigília) e só
   então faz `POST /par` → guarda o token → abre o SSE — tudo no mesmo gesto, na
   mesma página.

   **O PAPEL VEM DE QUEM SERVE, não da URL.** O servidor injeta
   `<meta name="av-tela">` em toda página que entrega
   (`EspelhoServidor.comMarcaDeTela`), e ele só entrega o display. A raiz `/`
   ainda responde `302` para `/display/index.html?tela=1`, e o `?tela=1` é o
   RECUO (shell antigo sem a marca): a query chega por um redirecionamento que
   um navegador de TV pode não preservar, e enquanto ela era o marcador único a
   tela abria como um `/display/` comum. Nunca adivinhação de origem: o
   `/display/` aberto no navegador de desenvolvimento cai fora do papel.

   O `tela.js` entra em `display/index.html` DEPOIS de `native.js` e ANTES de
   `db.js`: ele define `window.__AVBus` e neutraliza o `postMessage` do
   `BroadcastChannel` antes de o `db.js` capturar os dois na carga. `recv` =
   eventos do SSE; `post` = o DRENO DE SUBIDA (§5.4). Define
   `__AV_ROLE__='tela'` (o `display.js` lê `TELA`; nenhum código testa
   `=== 'display'`; guardas `!== 'controle'` seguem corretas). `__NATIVE__`
   fica indefinido: o comportamento "navegador" do display é o correto aqui.
   Fora do papel `tela`, o arquivo é um no-op de uma guarda.
5. **A mídia viaja por `__rec` + `/m/<token>`.** O `load` só carrega
   `mediaId`; TUDO vem de `AVDB.getMedia` no IDB — chamado DUAS vezes (pelo
   `display.js` e pelo `stage.js`) — e numa tela da LAN o IDB está vazio e o
   OPFS nem existe (`getDirectory` é secure-context). A solução de menor
   toque: o Controle anexa ao `load` um registro SANEADO (`__rec`) em que toda
   referência local vira URL servível: `opfsPath/blob` → `url: '/m/<token>'`;
   `pages[i]` → URLs por página; `lyrics[].imageOpfsPath` → `imageUrl`;
   `stream`/`youtubeId` → nunca chegam (§5.6). Como `rec.url` entra DIRETO no
   `src` (o ramo `rec.url` do `stage.js`, depois de `blob` e `opfsPath`), o
   stage não muda. O `tela.js` instala o `__rec` num cache local (`recCache`)
   ANTES de entregar o comando e embrulha `AVDB.getMedia` para respondê-lo — UM
   ponto cobre os dois chamadores. O comando enriquecido também chega ao telão
   de verdade, que o ignora (getMedia local vence). **`__rec` viaja NO comando,
   não numa consulta:** um "GET /registro/<id>" a cada load seria uma
   ida-e-volta a mais no caminho crítico do culto, e o Controle já tem o
   registro na mão quando emite o `load`.
6. **Tokens de serviço opacos**, cunhados pelo Controle (`telaTokenDe`:
   `crypto.randomUUID()` sem hífens; sem ele, nenhum token e nenhuma mídia na
   rede), estáveis por id (`telaTokens` — a regra "mesmo id + mesmo token =
   mesmo item" do shell), e servidos pelo cache da SESSÃO de transmissão (a
   `MainActivity` cria um `EspelhoMidiaCache` a cada ligada). NÃO são o token
   de sessão — a regra "o token de sessão nunca viaja numa URL" fica intacta;
   um token de serviço concede UM recurso, na LAN, enquanto a transmissão
   durar. Rota `/m/` anônima (o token é a capacidade); bundle
   (`PREFIXOS_BUNDLE`: `/display/`, `/shared/`, `/espelho/`) anônimo, com
   contenção por canonicalPath — **nunca `web/controle/`**; `/e` e `/r`
   autenticados por `Authorization`.
7. **Range de verdade, nosso.** No `ServerSocket` a invariante 8 se inverte:
   quem aplica Range somos nós, com `206`/`Content-Range`/`416` reais —
   copiar o StreamProxy (200 seco, fatia-como-todo, pedaço inteiro em memória)
   é o erro exato. Parsing puro no `EspelhoHttp` (`alcanceDe`), com JUnit.
   Faixa única. `Connection: close` fica (a premissa anti-smuggling não cai):
   por tela, 1 SSE + 1 mídia + POSTs curtos cabem nas 6 conexões do Chromium —
   os POSTs têm prazo de 15 s (`PRAZO_POST_MS` do `tela.js`) e o `tela-status`
   sobe freado (§3.9).
8. **Heartbeat SSE de 15 s** (`PING_SSE_MS`, `: ping <epoch-ms>`), e ele paga
   três contas de uma vez: o vigia de fio do `tela.js` (`PING_SUMIDO_MS`, 35 s
   sem byte = TCP meio-aberto → aborta e volta à escada), a escrita que falha do
   lado do servidor (tela morta), e o **wake lock do `EspelhoEnergia`**, cuja
   renovação é por progresso real de escrita (`EspelhoEnergia.progresso()`) —
   sem tráfego, o teto de 2 h venceria no meio do culto. **E O SINAL DE VIDA
   PEGA CARONA NO FIO** (v5.208): o `alive` sai quando um byte do SSE chega
   (piso de `ALIVE_MS`, 10 s), além do timer e do `visibilitychange` —
   navegador de TV estrangula timer de aba para ~1/min, e o servidor derruba
   quem não relata (`TETO_SEM_RELATO_MS`, 150 s; qualquer `POST /r` conta).
9. **Status: dreno de subida + eleição no Controle.** N telas emitindo
   `display-status`/`media-ended`/`diag-dump` é o que o dreno existe para
   calar. O `post` do `tela.js` é lista de PERMISSÃO: `display-ready` (com
   `__tela`) e `display-status` RENOMEADO `tela-status` (com `__tela`, freado a
   1 Hz e na hora quando `playing`/`mediaId`/`view` muda); todo o resto morre
   mudo (`media-ended` dobraria o repeat-one; `diag-dump` duplo faria o Registro
   mostrar o diário de UM sem dizer qual; quem avança playlist continua sendo o
   Controle). O servidor confere de novo (`TIPOS_QUE_SOBEM`), injeta o `st`
   verbatim no barramento E alimenta o snoop da notificação de mídia
   (`snoopStatusDeFora`, a exceção documentada: copiar campos que o web
   calculou). Quem ELEGE a referência entre N telas é o Controle (invariante 5):
   a primeira vista com `mediaId === currentId`, trocada quando cala por
   `TELA_REF_SILENCIO_MS` (5 s), e o status dela vira `espelho-status`. O telão
   de verdade tem precedência (`telaoAtivo()`; no Kotlin,
   `PRECEDENCIA_TELAO_MS`, 2,5 s).
10. **Som opt-in por tela:** o `display.js` nasce com `forceMuted: TELA`, e o
    gesto chama `window.__telaSom(true)` (`stage.setForceMuted(false)`) — um
    gancho que só existe no papel `tela`.
11. **(Microfone: o recurso SAIU na v1.8.89.** Ele nunca saía na rede; a
    armadilha que deixou para o próximo comando de DESCIDA está em "As inversões
    que precisam estar ditas", no mapa de hoje, ao fim.)
12. **Relógio das telas.** Cronômetro e sorteio viajam por descritor com
    epoch ms (`chrono.startAt`, `draw.rollUntil`) e supõem relógio comum — uma
    Smart TV com minutos de desvio contaria errado. O `tela.js` mede o desvio
    (`Date.now()` da tela − epoch do celular, que o `oi` e cada ping carregam;
    mediana das últimas 5 amostras, `RELOGIO_AMOSTRAS`) e SOMA o offset a esses
    campos nos comandos `text` que chegam (`corrigirRelogio`). O modo RELÓGIO,
    que não tem época na mensagem, lê `window.__avAgora()` (v5.210): a casca
    publica o relógio do celular; nos outros papéis a função não existe e o
    `display.js` cai no `Date.now()`, que ali já é o celular. Correção no lado
    web, por campo conhecido — o Kotlin segue sem interpretar.
13. **Vigília de tela acesa.** Numa cena de texto não há vídeo tocando, e a
    tela da TV apagaria no meio do sermão. Onde há contexto seguro (certificado
    configurado, `localhost`), `navigator.wakeLock` — re-pedido no
    `visibilitychange`, porque a trava morre quando a aba sai de foco; sempre,
    o piso: um `<video>` de 2×2 alimentado por `canvas.captureStream` (que não
    é `[SecureContext]`) tocando mudo. Honesto sobre o limite: navegador que o
    ignore vai apagar, e a saída é desligar a economia de tela do aparelho.
14. **Despedida.** No desligar o servidor esvazia a fila de cada tela e manda
    `{"m":"adeus"}` (com `ADEUS_PRAZO_MS`, 1,5 s, para sair antes de o socket
    cair). A tela trata como token morto: `aoAdeus` → `cairToken` → a reentrada
    silenciosa (`REENTRADA`, 1 s → 30 s), que reconecta sozinha quando o
    operador religar.
15. **404 uniforme e queda de token**: 404/403 no `/e` e 404 no `/r` derrubam o
    token (`cairToken`). Com o gesto já gasto a tela reentra EM SILÊNCIO; antes
    dele, volta a entrada.

## §4 SEQUÊNCIA DE UM CULTO

1. Operador liga a transmissão. Sobe o servidor (a energia é do
   `EspelhoEnergia`; o primeiro plano, do `SessionService`) — sem tela virtual,
   sem codec, sem janela. A folha mostra o ENDEREÇO (IP), e nada mais.
2. Visitante abre `http://<ip>:8787/` → `302` para
   `/display/index.html?tela=1`, servido DO CELULAR (mesmo bundle do OTA, com a
   `<meta name="av-tela">` injetada). O `tela.js` mostra a entrada: UM botão,
   "Ativar esta tela".
3. O toque gasta o gesto (tela cheia + som + vigília) e só então faz
   `POST /par` (anônimo) → token → SSE aberto → o reanúncio do `display-ready`
   sobe e volta como cena endereçada.
4. Cada comando chega em ~10 ms. Texto renderiza vetorial. `load` traz
   `__rec` com `/m/<token>`; o navegador toca com Range e áudio próprio.
5. A tela reporta `tela-status`; o Controle elege a referência para barra,
   MediaSession e preview.
6. Queda de Wi-Fi: a escada de reconexão (`RECONEXAO`, 0,5 s → 8 s) reabre o
   SSE, o `display-ready` sobe de novo, cena com posição — o caminho do dongle.
   O que estava na tela nem pisca durante a queda.

## §5 CONTRATOS

### 5.1 SSE (`GET /e`)
`200`, `Content-Type: text/event-stream`, sem Content-Length, chunked.
Evento = `data: <json>\n\n`. Heartbeat `: ping <epoch-ms>\n\n` a cada 15 s (o
epoch alimenta a correção de relógio). Auth: `Authorization` (fetch). Na
abertura o servidor manda `{"m":"oi","ms":<epoch>}` e nada mais — estado vem do
reenvio de cena. Fila de 256 eventos por tela (`TETO_FILA_SSE`); fila cheia =
tela que não escoa = derrubada (ela reconecta e recebe a cena inteira), nunca
descarte silencioso de comando.

### 5.2 Comandos (celular → telas)
JSON do barramento, verbatim, com `__mid` preservado (o dedup do `db.js` — Set
de 400 por página — segue valendo, porque o `tela.js` fornece um `__AVBus`).
Endereçado (`__para`) vai só à tela dona — o servidor guarda o `__de` que cada
tela anunciou no `display-ready` e filtra por igualdade de string, e só faz o
parse quando a substring `"__para"` existe. Broadcast vai a todas. Payloads em
português passam INTACTOS — o caminho de comandos não passa por `sanear()`
(que é para o Registro e apagaria acentos).

### 5.3 Mídia (`GET /m/<token>`)
Range RFC 7233 faixa única (`EspelhoHttp.alcanceDe`); sem Range → 200 inteiro;
malformado (inclusive `Range` duplicado e multi-faixa) → **IGNORADO, 200
inteiro**, nunca adivinhado e nunca 400 (um 400 quebraria um player legítimo);
só a faixa VÁLIDA que não cabe no recurso (`ini >= tamanho`, sufixo `-0`) → 416.
`Accept-Ranges: bytes`, `Content-Type` do registro. Token de serviço opaco
por recurso+sessão. **Enquanto o arquivo ainda está sendo empurrado** pelo canal
ArrayBuffer, a rota responde COMO SE ESTIVESSE COMPLETO, pelo tamanho anunciado
no `abrir` (`esperado`, o `size` do Blob): 200 com `Content-Length` ou 206 com
`Content-Range`, e a cópia ESPERA o empurrão alcançar cada byte pedido
(`copiarCrescendo`). Desde a v1.13.12 — antes era chunked sem faixa, e MEDIDO no
Chromium a fonte ficava NÃO BUSCÁVEL pela vida da URL: o seek na tela era
ignorado mesmo depois de o item completar ("o vídeo apenas reinicia"). Faltando
bytes no fim (o empurrão morreu), a conexão fecha antes do `Content-Length` e a
tela vê o erro de rede. Só um item SEM tamanho anunciado ainda sai em chunked.
Do lado web, `stage.js` (`precisaRecarregar`) pede a mesma mídia por uma URL
nova quando um seek cai fora do `seekable` — a rede de segurança para um shell
anterior a este.

**O terminador do chunked (o caso sem tamanho) só sai quando os bytes anunciados no `abrir`
chegaram todos**: ele É a afirmação "o recurso acabou aqui", e um empurrão que
morreu no meio (o renderer do Controle caiu) fecha a conexão SEM ele — a tela
vê o erro de rede que de fato houve, em vez de tocar meia mídia e disparar
`ended`. O 404 desta rota vira linha no Registro, e só para token de FORMA
válida: o anel do diário tem 60 linhas e um scanner na rede não pode apagá-lo
com rotas inventadas.

**`Cache-Control: no-store` em TODA resposta** (`EspelhoHttp.CABECALHOS_SEMPRE`),
404 inclusive — é o que torna seguro repetir a MESMA URL numa retentativa: não
há 404 grudado em cache para envenenar a tentativa boa.

### 5.4 Subida (`POST /r`)
Teto do corpo 4 KiB (`TETO_CORPO_RETORNO`). Dois ramos:
`{"do":"st","st":<msg>}` — só os tipos de `TIPOS_QUE_SOBEM` (`display-ready`,
`tela-status`), injetado verbatim no `MessageBus` + snoop da notificação, sem
sanear no caminho do barramento; o `display-ready` registra o `__de` que roteia
o endereçamento — e `{"do":"alive", telaAcesaMin, aviso}`, a telemetria da
tela (§9; o `aviso` é saneado aqui, porque termina no Registro). Qualquer
`POST /r` é sinal de vida. O dreno do `tela.js` garante do lado de lá que só
`display-ready` e `tela-status` sobem; o servidor garante do lado de cá.

### 5.5 O registro saneado (`__rec`)
`telaSanearRec`. Campos: `id, kind, name, type, url` (→ `/m/<token>`),
`seconds, height`, `pages?` (uma URL `/m/` por página — §5.6), `edicao?`
(`inicio/fim/fadeEntrada/fadeSaida`: os bytes são os do original, e quem corta e
esmaece é o `stage.js` da tela), `hymnName?, hymnTrack?, hymnAlbum?`,
`lyrics?` (slides com `imageUrl` no lugar de `imageOpfsPath`, mantendo
`time/text/auxText/cover/imagePosition`). NUNCA: `blob`, `opfsPath`, `stream`,
`youtubeId`. Anexado pelo Controle (`telaEnriquecer`) quando a transmissão está
ligada, em dois comandos: o `load` e o `text` de modo `image` (a imagem sobre o
áudio, v5.312, que leva um `mediaId` que a tela não resolveria). O wallpaper vai
por `__wp: <url>` no comando `wallpaper` e no reenvio de preferências; a remoção
viaja como o sentinela `__wp:'padrao'`.

**As imagens de fundo da letra** viajam como uma `/m/` por imagem DISTINTA, id
estável `ly:`+caminho (o mesmo hino de novo custa zero empurrão), e são
enfileiradas DEPOIS da mídia principal no mesmo canal serializado
(`telaEmpurrarImagensLetra`) — o som não espera as fotos. **Por isso a tela
espera mais que o canal:** a retentativa dela dobra até um platô de 2,5 s com
teto de 45 s, e morre na guarda de sequência quando a estrofe muda. Uma
retentativa tem de durar mais que o processo que ela espera; a ladeira curta
anterior (~2,4 s) desistia antes de os bytes poderem chegar.

### 5.6 Cenas que não vão para a rede
Sobra **uma** guarda: `kind === 'youtube'` (o link sem bytes; o embed saiu na
v5.212 e o Controle resolve o link por download antes do `load`). Se chegar
assim mesmo, o Controle relaya um
`{type:'tela-aviso', texto:'Esta cena não aparece no computador conectado.'}`;
o `tela.js` desenha o aviso (6 s), e o display, que recebeu o `load` sem
`__rec`, não acha o registro no IndexedDB dele e limpa a cena.

O **deck** atravessa desde a v1.1.7: cada página vira uma `/m/`
(`telaDeckUrls`/`telaEmpurrarPaginasDeck` no Controle; `urlDaPagina` no
`stage.js`, que aceita string ou Blob em `pages`). A apresentação é o único kind
cujo conteúdo é uma LISTA, e por isso não cabia no `url` do registro saneado:
`telaDeckUrls` cunha um token por página (id estável `dk:<item>:<i>`, irmão do
`ly:`) e `telaEmpurrarPaginasDeck` os enfileira EM ORDEM — a página 1 chega
primeiro, que é a que a tela busca assim que o `load` pousa. Sem token forte
(`crypto.randomUUID` ausente) a lista INTEIRA é recusada e a cena cai no aviso —
lista com buraco projetaria página em branco no meio do sermão. O mesmo vale
para o deck sobreposto (`text` de modo `image`). Oráculo: a metade CONSUMIDORA no
`tela-rede.test.mjs`; a produtora (o ramo `pages` do `telaEnriquecer`) segue
**sem oráculo**, e isso está dito porque as duas quebram diferente.

## §6 AS ETAPAS (concluídas)

O plano de cada etapa está no apêndice (`grep -n "v5.187" docs/HISTORICO.md`).
O que cada uma deixou no código:

| etapa | o que existe hoje por causa dela |
|---|---|
| **E1** — fundações puras | Range e SSE no `EspelhoHttp`, com JUnit (`EspelhoHttpRangeTest`). Os nomes finais divergiram do plano: `parsearRange` → **`alcanceDe`**, `respostaParcial` → **`cabecalhoParcial`**, `respostaSse` → **`cabecalhoSse`** — as três devolvem o CABEÇALHO e o corpo é escrito em seguida no socket, o que é obrigatório num arquivo em crescimento; `resposta416`, `eventoSse` e `pingSse` saíram com o nome do plano |
| **E2** — bundle + SSE + tap | `PREFIXOS_BUNDLE`, rota `/e` com ping e adeus, `tapLan` → `difundirJson`, renovação do wake lock pelas escritas. O roteamento é código de socket, sem JUnit próprio (o padrão do `EspelhoServidor`); o contrato é provado do lado do CLIENTE, no `tools/tela-rede.test.mjs`, contra servidor de mentira |
| **E3** — papel `tela`, texto completo | `espelho/tela.js` (bus, dreno, entrada, relógio, vigília, aviso), carregado no `display/index.html` |
| **E4** — mídia | `__avTelaMidia` → `EspelhoMidiaCanal` → `EspelhoMidiaCache` → `/m/`; `__rec`/`__wp` no Controle. **Sem degrau de `SHELL_VERSION`:** a detecção do canal é por PRESENÇA (`window.__avTelaMidia`), que degrada melhor que número de versão |
| **E5** — status, referência, preview | o ramo `st` do `/r`, a eleição no `controle.js`, `dePixels` no atraso da preview |
| **E6/E7** — corte e remoção (um lote só, v5.187) | a raiz `/` → tela; o espelho de pixels apagado (§2). A "volta por constante" do plano não existe — a volta seria o revert do lote |

## §7 FASE OPCIONAL — FECHADA na v5.189 e SEM CLIENTE desde a v1.8.82
Transmissão direta na LAN: rota proxy (`/s/<token>`) com a lógica do
`StreamProxy` (UA casado, upstream googlevideo) mas com **Range de verdade e
streaming real**, mais o manifesto reescrito para o host do celular. Ela foi
entregue e usada até a transmissão direta sair do lado web; a rota continua no
Kotlin, sem quem a chame. **Registrada para não se perder**: quem for tirá-la do
shell paga um degrau de `SHELL_VERSION` e uma Release, e quem for trazer a
transmissão de volta não precisa reescrevê-la.

## §7-B O CELULAR COMO PONTO DE ACESSO (v1.4.1)
A transmissão **nunca precisou de internet** — ela precisava que o celular fosse
**cliente** de uma Wi-Fi, e numa igreja sem rede isso não existe. Hoje há duas
vias, e o campo `via` do estado diz qual está servindo.

| via | o que é | como é achada |
|---|---|---|
| `WIFI` | o celular é cliente de uma Wi-Fi (com ou **sem** uplink — `NET_CAPABILITY_VALIDATED` fica deliberadamente fora do filtro) | `redeDaWifi` → `ConnectivityManager`, `ehWifiLimpa`. **Não mudou uma linha** — é o degrau 1, e é o que garante zero regressão na igreja que já funciona |
| `PONTO_DE_ACESSO` | o celular É o roteador | `redeParaServir` degrau 2 → `EspelhoInterfaces.escolher` sobre `NetworkInterface.getNetworkInterfaces()` |

**O soft AP não é um `Network`, e é disso que tudo decorre.** O downstream do
tethering é montado no netd sem `NetworkAgent`: ele nunca apareceu em
`cm.allNetworks` e sempre viveu no eixo que devolve NOME DE INTERFACE (`ap0`,
`swlan0`, `wlan1`). Enquanto a admissão era só o `ConnectivityManager`, o
operador com o hotspot ligado na frente dele lia *"sem Wi-Fi"*.

**O DISCRIMINADOR NÃO É O NOME** — e é isso que faz a regra durar, porque nome de
interface é o que cada OEM muda sem avisar, e **isto é Kotlin: quando erra num
aparelho não há OTA que conserte**. A pergunta é *"que interface está no ar, com
IPv4 RFC1918, e que NENHUM `Network` reivindica?"*, e a do soft AP é a única com
essa forma — **não é uma rede que o aparelho USA, é uma que ele SERVE**. O nome
entra só na CLASSIFICAÇÃO, depois de três filtros independentes.

Sete recusas, nesta ordem (a ordem é contrato: ela decide o motivo que o Registro
imprime): fora do ar · loopback · ponto-a-ponto · **família** (`rmnet`, `ccmni`,
`pdp`, `v4-rmnet`, `clat`, `tun`, `ppp`, `ipsec`, `wg`, **`p2p`**, `sit`,
`dummy`) · reivindicada por um `Network` · sem IPv4 · IPv4 fora de RFC1918
(**o CGNAT `100.64/10` fica de fora de propósito**).

**Duas famílias estão lá por casos que nenhum filtro genérico pega:**

- **`rmnet` com IPv4 privado.** Um CGNAT de operadora entrega `10/8` ao chip: o
  filtro de RFC1918 o aprova e nenhum `Network` precisa reivindicá-lo. Só a
  família o recusa.
- **`p2p`.** O Group Owner do Wi-Fi Direct serve `192.168.49.1` — privado, no ar,
  sem `Network` que o reivindique: **a forma exata que a regra procura**, no ar
  durante **todo culto com Miracast**. Sem esta linha o servidor subiria no fio
  do dongle e nenhuma tela da rede o alcançaria.

**Ela classifica; ela não faz política.** `escolher` devolve tudo que sobrou com
o `Tipo` de cada um (`PONTO_DE_ACESSO` · `CABO` · `DESCONHECIDO`); admitir só o
primeiro é uma linha visível do `redeParaServir`, e não um efeito colateral da
ordem da enumeração. **Falhar FECHADO é o contrato:** nome desconhecido custa o
recurso e uma frase, nunca um socket no lugar errado.

**O bind não mudou uma letra** — continua explícito, num IPv4, nunca `0.0.0.0`.
O que mudou é a resposta a *"quais IPv4 são servíveis?"*. A reconferência do
`ligar()` passou a ser contra `redeParaServir`, e não contra `redeDaWifi`: sem
isso um endereço de AP achado corretamente morreria três linhas depois de a
regra tê-lo aprovado.

**A sobrevivência tem duas metades, porque o callback não cobre o AP.**
`observarRede` assina `TRANSPORT_WIFI`, e em modo AP puro ele **nunca dispara** —
não há `Network` para ganhar nem perder. O desfecho não é uma queda errada
(`redeSuspeitaDesde` fica 0 e `confirmarRede` retorna na primeira linha); é coisa
pior: **nada vigiaria o AP caindo**, e o socket ficaria para sempre amarrado a um
endereço morto. Quem cobre é `vigiarPontoDeAcesso` (5 s, e **só** quando
`via == PONTO_DE_ACESSO`), que levanta a mesma SUSPEITA e deixa o veredito com o
`confirmarRede` de sempre. O caso não é raro: o hotspot **se desliga sozinho por
ociosidade** em vários fabricantes. Pelo mesmo motivo `ipAindaEDaWifi` virou
`ipAindaEServivel` e ganhou um segundo degrau — o `ConnectivityManager` responde
SEMPRE não em modo AP, e sem ele a transmissão morreria na primeira suspeita.

**O `confirmarRede` religa na MESMA via**, nunca na outra: migrar de ponto de
acesso para Wi-Fi sozinho seria ligar por conta própria, e o contrato diz
AUXILIAR (ver "O mapa de hoje", ao fim). E a frase do religamento perdeu o *"sem perder o pareamento"* no
AP — se o hotspot reiniciou, as telas perderam o SSID, e prometer o contrário
num artefato que é lido a distância é o pior que este projeto sabe produzir.

**A escolha entre as duas é do operador, e só aparece quando existem duas.**
`redes.length > 1` desenha os dois botões; com uma só o shell escolhe (ponto de
acesso na frente). Qual delas a tela alcança **não é decidível pelo app** — quem
sabe onde o computador está conectado é a pessoa. A ponte ganhou
`espelhoLigarEm(callId, ip)`, **ADITIVO** (`SHELL_VERSION` 57): o `espelhoLigar`
sem argumento fica, e é o caminho de todo aparelho com uma rede só.

### §7-B.1 O que isto muda no AP ISOLATION (§9)
Isolamento de cliente é a falha muda deste recurso: servidor de pé, porta
escutando, **nenhum SYN chegando**, indistinguível de "ninguém abriu ainda".
Ela bloqueia cliente↔cliente — e **no ponto de acesso o celular é o GATEWAY**: é
dele que o computador tira DHCP e DNS, então esse caminho não pode estar fechado.
**O ponto de acesso é a resposta mais forte a esse defeito, não uma alternativa
qualquer.**

### §7-B.2 O custo, dito
- **Ligar o ponto de acesso derruba a Wi-Fi** em aparelho de rádio único, e
  **pode derrubar o Miracast junto** (softAP e Wi-Fi Direct disputam o mesmo
  rádio). Os dois só doem para quem quer as duas conexões AO MESMO TEMPO; quem
  liga o hotspot *porque não há Wi-Fi* não perde nada. A celular sobrevive:
  `ytFetch`, OTA e `apkProcurar` seguem pelo chip.
- **O hotspot se desliga sozinho por ociosidade** em vários fabricantes. A
  enquete NOMEIA ("o ponto de acesso foi desligado"); ela não impede.
- **A regra depende de nomes de interface, e é Kotlin.** Quando ela errar num
  aparelho, o conserto é uma Release. Por isso o Registro imprime as interfaces
  vistas e o motivo de cada recusa, verbatim: é a única pista a distância.
- **Não custa permissão nenhuma**, e isso é resultado e não acaso — é o que
  separa este caminho do `TetheringManager`.

### §7-B.3 Investigado e RECUSADO — para não ser refeito
| o quê | por que não |
|---|---|
| **`WifiManager.startLocalOnlyHotspot()`** (o app CRIAR a rede) | cobra `ACCESS_FINE_LOCATION` (o app tem UMA permissão sensível, `RECORD_AUDIO`) mais localização LIGADA até a API 32; **SSID e senha são sorteados pelo sistema a cada sessão** — o operador redigitaria uma senha aleatória em até três telas TODO SÁBADO; e ainda assim **não devolve um `Network`**, então sobraria a mesma enumeração |
| **`TetheringManager` · `getWifiApConfiguration()` · `getTetheredIfaces()`** | `@hide`/`@SystemApi`; `TETHER_PRIVILEGED` é `signature\|privileged`; com `targetSdk = 35` a barreira de interfaces não-SDK fecha a reflexão |
| **Wi-Fi Direct (`WifiP2pManager`)** | o navegador de um computador comum não entra num grupo Wi-Fi Direct |
| **bind em `0.0.0.0`** | **quem alcança a porta PAREIA** (o código saiu na v5.189): o teto de 3 e o castigo medem OCUPAÇÃO, não admissão, e a allowlist de `Host` barra DNS rebinding e mais nada. A única membrana do recurso é o bind — e no cenário que motiva o pedido (igreja sem Wi-Fi = celular em dados móveis) o wildcard abre exatamente a `rmnet`. E nem paga o que promete: para imprimir o endereço ainda seria preciso enumerar interfaces |
| **`p2p*` na allowlist** | ver acima: é o fio do dongle, no ar durante todo culto com Miracast |
| **denylist de nomes como guarda PRIMÁRIA** | `eth0`/`usb0` de um dock, ou um OEM desconhecido com IPv4 privado, seriam ACEITOS. Falhar ABERTO em nome desconhecido é o oposto do que a primeira fronteira de rede do projeto pode fazer — daí a família ser o QUARTO filtro, e não o primeiro |
| **não registrar `observarRede` em modo AP** | retirar condicionalmente um mecanismo existente. Ele fica: em AP puro nunca dispara (inofensivo), e um `onAvailable` de Wi-Fi alheia só chama `redeVoltou()`, que retorna cedo com `redeSuspeitaDesde == 0` |

### §7-B.4 O que ainda NÃO foi medido em aparelho
Duas suposições sustentam o degrau 2, e **as duas só se confirmam num aparelho de
verdade** — o JUnit cobre a regra pura, não o sistema:

1. a interface do AP aparece em `getNetworkInterfaces()` com o IPv4 dela, em
   modo tethering (o nome varia por fabricante);
2. **um bind NAQUELE endereço aceita conexão de um cliente do hotspot.**

**Teste de custo zero:** ligar o ponto de acesso, conectar o computador e ver o
**gateway padrão** dele — esse endereço É o do celular na rede do hotspot; se ele
responde a ping, as duas estão essencialmente respondidas. Falhando, o degrau 2
não acha nada, a recusa vem com o ensino, e **o degrau 1 continua intacto** — o
modo de falhar é o comportamento de antes, nunca um socket no lugar errado.

> **Regra de calendário:** a primeira ligada em rede de verdade é **num dia SEM
> culto** — segunda, terça, quinta ou sexta. A agenda é **sábado de manhã** (o
> culto principal), mais **domingo e quarta à noite** (menores, opcionais).
>
> O que a regra protege não é o dia: é ter **folga na frente para desfazer**. Um
> recurso de rede que só falha na igreja falha na frente da congregação, e o
> conserto de uma regra em Kotlin é uma Release.

## §8 SEGURANÇA — o que muda de verdade
A inversão da §10 do espelho cresce: com `/m/`, o servidor tem OS ARQUIVOS
que o operador transmitir (não a foto deles), em HTTP claro. O shell sabe servir
em TLS (`EspelhoCert`; `espelhoCertImportar`/`espelhoCertEstado` seguem na
ponte), mas desde a v5.196 a UI não tem porta para instalar o certificado: na
prática a transmissão serve HTTP. O que não muda: não há captura nenhuma (o
microfone saiu na v1.8.89), token de sessão nunca em URL, allowlist de Host
exata, teto de 3 sessões, 404 uniforme, `web/controle/` jamais servido à
rede, CSP `self` nas páginas servidas.

**E A CSP `self` TEM UM PREÇO QUE PRECISA ESTAR ESCRITO** (aprendido na v5.205,
depois de ela custar quatro versões de investigação): `default-src 'self'` sem
`style-src` **bloqueia estilo embutido**, e um `<style>` criado em runtime é
estilo embutido. O `espelho/tela.js` montava a entrada assim, e o desfecho não
foi um erro visível: o overlay era criado, recebia `display:flex` pelo CSSOM (que
a CSP não barra) e virava um bloco sem posição no fim do `<body>` — **debaixo da
camada fixa do wallpaper**. Invisível e inclicável, com o papel `tela` ativo e
tudo mais funcionando. O `shared/stage.js` tinha o mesmo defeito no indicador de
espera. Os dois viraram folhas (`espelho/tela.css`, `shared/stage.css`); a
segunda saiu na v1.4.8, quando o palco deixou de DESENHAR a espera e passou a
apenas anunciá-la ao dono.

> **A REGRA: nas telas da rede não existe estilo embutido.**
> `element.style.x = y` (CSSOM) continua valendo — a CSP não o alcança.
> `document.createElement('style')` e atributo `style="…"` em HTML injetado,
> **não**. Todo CSS novo do papel `tela` entra numa FOLHA servida do origin.

> **E O HARNESS TEM DE MANDAR A CSP.** O `tela-rede.test.mjs` servia a página sem
> ela, então provava o percurso num ambiente mais permissivo que o do aparelho —
> foi por isso que o defeito acima atravessou o CI. Ele manda a CSP verbatim
> desde a v5.205, e AFIRMA a garantia que ela existe para dar (a IFrame API do
> YouTube barrada). Um servidor de mentira que diverge do de verdade não prova
> nada; é a mesma lição da marca do papel (v5.204), por outra porta.

## §9 DIAGNÓSTICO (Registro)
O que o `espelhoEstado` (`EspelhoServidor.estado()`) entrega, e o
`blocoEspelho` do `controle.js` transforma em frase:

| nível | campos |
|---|---|
| **por tela** (`telas[]`) | o relato da entrada (`ua`, `w`, `h`), `rotulo`, `comando`, `conectadaMs`, `telaAcesaMin` e `aviso` (do `alive`), `eventos`, `pronta` (o `display-ready` já anunciou o `__de`), `fila` |
| **do servidor** | `ligado`, `url`, `ip`, `via`, `iface`, `porta`, `tls`, `noArMs`, `teto` × `sessoes` (sessões vivas × telas conectadas, lado a lado — divergem enquanto uma tela que caiu ocupa a vaga), `origensBloqueadas` (o castigo do derrubar), `conexoesTotais`, `semConexaoMs`, `ultimaSaida`, `recusadas` (por motivo — no fio todas são o mesmo 404), `enlace` (a banda que o Android estima, sem pedir localização) |
| **do cache** (`midia`, SÓ quando há cache) | `itens`, `bytes`, `teto` — publicá-lo zerado com a transmissão desligada diria "cache vazio" onde a verdade é "não há cache" |

Molde de sempre: Kotlin devolve JSON, `controle.js` monta a frase, linha
ausente = shell antigo. O diário é o anel do `EspelhoDiag` (60 linhas), que a
`MainActivity` possui.

**E AS INTERFACES VISTAS, com o motivo de cada recusa** (v1.4.1,
`EspelhoServidor.interfacesJson`). Ela não é conforto: a regra do ponto de acesso
é KOTLIN e depende de nomes que cada fabricante escolhe, então quando ela errar
num aparelho o conserto é uma Release — e ele começa por saber o nome que AQUELE
aparelho deu à interface. Sem esta leitura, "o hotspot está ligado e o app não o
acha" não tem pista nenhuma. O motivo sai VERBATIM de quem decidiu
(`EspelhoInterfaces.escolher`); as recusadas saem TODAS (são poucas, e é
justamente a recusada que explica o caso). A linha do servidor também parou de
cravar *"ligado à Wi-Fi"* — ela lê o `via`, senão o Registro afirmaria a rede
errada para quem está servindo pelo próprio celular.

## O DRENO do papel `tela` — uma lista de PERMISSÃO

Cada tela da rede roda uma **cópia de `/web/display/`** ligada ao MESMO
barramento por SSE. É o mesmo arquivo — e é por ser idêntico que **ele não pode
falar tudo**: a arquitetura inteira supõe UM telão. Drenado tudo passa:
`display-status` sai a ~4 Hz de CADA um (o Controle e o `snoopDisplayStatus`
passariam a ter N fontes alternadas), além do `media-ended` dobrado e do
`diag-dump`/`diag-ask` respondido por vários que a §3.9 já nomeia. (O
`mic-status` era o quarto, e o mais perigoso: 'unsupported' de uma tela — que
**nega `getUserMedia` em silêncio**, por não ter o `MicChromeClient` — apagava o
estado do microfone VERDADEIRO. Ele saiu na v1.8.89 com o recurso, e o dreno não
muda por isso: lista de PERMISSÃO, um emissor a menos não abre porta nenhuma.)

O dreno mora em `espelho/tela.js` (o `__AVBus.post` do papel) e é lista de
**PERMISSÃO** — um tipo de mensagem novo em `display.js` nasce mudo por
construção. `media-ended`, `diag-dump` e todo o resto de uma tela morrem ali. **E
a lista existe nos DOIS lados**: o `EspelhoServidor` só injeta no barramento os
tipos de `TIPOS_QUE_SOBEM` (`display-ready`, `tela-status`) — validação que mora
só no cliente não é validação.

- **`display-ready` passa, com `__tela`.** É esse anúncio que faz o Controle
  reenviar a cena — drenado por inteiro, a tela fica no wallpaper até alguém
  tocar em alguma coisa, exatamente nos três casos em que ela precisa se
  recuperar sozinha: ligada no meio do culto, recarga da página e queda de rede.
  É seguro porque o reenvio é **endereçado** (`__de`/`__para`).

  **E o `__tela` é o que dispara o reenvio das PREFERÊNCIAS** (wallpaper, fundo
  da letra, preenchimento — `telaReenviarPreferencias`), porque é a única coisa
  que distingue uma tela da rede do telão de verdade, que lê tudo do IndexedDB
  sozinho. Quem monta o anúncio é `anuncio()`, **dono ÚNICO do carimbo**: há dois
  pontos que anunciam (o dreno e o `aoConectar` do reanúncio) e o que entrega é
  quase sempre o segundo, porque o `display-ready` nasce antes de existir token.
  **Os dois lados do contrato têm oráculo** — o produtor no `tela-rede.test.mjs`,
  o consumidor no `boot-nativo.test.mjs` —, e são dois porque *ler cada lado
  isolado aprova ambos* (a história: `grep -n "v5.223" docs/HISTORICO.md`).
- **`display-status` sai RENOMEADO para `tela-status`.** **Sem TV as telas da
  rede SÃO a projeção**, e calá-las deixaria o Controle sem referência de tempo
  nenhuma — sobraria a preview, que é o que o Android estrangula quando o app sai
  da frente. Com nome PRÓPRIO, nada que espera "o telão" o recebe por engano: o
  `controle.js` **elege UMA tela** como referência (convertendo o status dela em
  `espelho-status`, que os consumidores já conhecem) e o
  `NativeBridge.snoopStatusDeFora` faz a mesma conta de precedência **e a mesma
  ELEIÇÃO** — o silêncio que troca a eleita é o mesmo dos dois lados, porque
  duas contas com réguas diferentes elegeriam telas diferentes.
- **O `BroadcastChannel` é NEUTRALIZADO NO ENVIO, nunca apagado.** `db.js` escolhe
  o canal perguntando `'BroadcastChannel' in global`: apagar a propriedade
  deixaria a tela com um único caminho de **recepção**, e a redundância dos dois
  é decisão escrita deste projeto. O que morre é só o `postMessage`, por uma
  subclasse do construtor real — e a troca precisa acontecer **antes de `db.js`**,
  que captura o construtor na carga.

## O mapa de hoje: as peças, as decisões e as inversões

O telão inteiro — fades, cortina, Camada de Texto, letra sincronizada e vídeo —
em até **três navegadores da rede da igreja**, sem instalar nada neles e sem
internet. As §1–§9 acima são o contrato por extenso; **esta seção é o mapa**,
para quem vai mexer — as duas foram conferidas contra o código, e onde uma
divergir da outra, quem decide é o código.

```
 ┌────────────── celular ──────────────┐        ┌───── navegador na LAN ─────┐
 │  Controle (/web/controle/)          │        │  o MESMO /web/display/     │
 │   └─ cada comando do barramento ────┼─SSE───►│  (papel `tela`)            │
 │  EspelhoServidor                    │        │   ├─ stage.js de verdade   │
 │   ├─ serve o BUNDLE (OTA→APK)       │◄─POST──│   ├─ mídia por /m/<token>  │
 │   └─ /m/<token>: cache de mídia     │  /r    │   └─ status de volta       │
 └─────────────────────────────────────┘        └────────────────────────────┘
```

**AUXILIAR por contrato:** liga e desliga **só** por ação do operador, pelo
fechamento do app, ou por uma falha nomeada em texto. Uma TV que conecta **não**
derruba a transmissão — sem TV, as telas da rede SÃO o que a congregação vê. As
duas vias (`WIFI` e `PONTO_DE_ACESSO`), a escolha do operador, o religar na MESMA
via e a enquete do AP estão na §7-B.

### As peças, e o que cada uma se recusa a fazer

| Arquivo | O quê |
|---|---|
| `EspelhoHttp.kt` | parser HTTP **+ Range + SSE** — **PURO, zero import de Android**, com JUnit. `alcanceDe` segue a RFC 7233 à risca: faixa malformada é **IGNORADA** (200 inteiro), nunca adivinhada; `Range` duplicado é malformado; fora do tamanho é 416 |
| `EspelhoPares.kt` | porta, tokens, prazo, castigo — **PURO**, com JUnit. **Sem código de entrada**: a porta é o ENDEREÇO na rede, e o controle real é o teto de 3 sessões + o `derrubar` do operador (com castigo de 2 min, sem o qual "Desconectar" não faria nada visível). O token **nunca viaja numa URL**: o SSE vai por `fetch` + `Authorization: Bearer` (não `EventSource`, que não manda cabeçalho) |
| `EspelhoServidor.kt` | sockets, rotas, fan-out. Serve **só** `PREFIXOS_BUNDLE` (display/shared/espelho — **nunca** `web/controle/`); `GET /e` (SSE: fila de 256 por tela, ping de 15 s com o epoch do celular, `adeus` no desligar); `/m/<token>` (completo = 206/416; em crescimento, 206/200 com o tamanho anunciado — ver §5.3); `POST /r` (o `st` injeta o status via `MessageBus.post(null,…)`, que **não** passa pelo `busPost` — **sem eco por construção** — e só os tipos de `TIPOS_QUE_SOBEM`). Bind explícito a um IPv4 **SERVÍVEL** (RFC1918, de uma interface que a regra aceita e que nenhum `Network` reivindica — ver `EspelhoInterfaces.kt`), **nunca** `0.0.0.0`; allowlist de `Host` exata |
| `EspelhoInterfaces.kt` | **EM QUE INTERFACE** o socket pode abrir — **PURO**, com JUnit. Existe porque o ponto de acesso do próprio celular **não é um `Network`**; o discriminador não é o nome, e ele **classifica, não faz política** — a regra inteira está na §7-B |
| `EspelhoMidiaCache.kt` | o cache da rota `/m/` — **PURO**, com JUnit. Token é **capacidade**: a FORMA é validada aqui (`^[A-Za-z0-9_-]{16,64}$`), a entropia é de quem cunha — o Controle, sincronamente, com `crypto.randomUUID`; mesmo id + mesmo token = mesmo item (a regra do `SafRegistry`); id com token novo **substitui**; LRU por **bytes** e só de **completos** (um item em crescimento tem um empurrão vivo do outro lado) |
| `EspelhoMidiaCanal.kt` | o empurrão OPFS → cache, por `WebMessageListener` com `ArrayBuffer` (allowedOriginRules exato, `isMainFrame`, host conferido). Ack por bloco; a oferta na fila é **não-bloqueante** — fila cheia = erro retentável, nunca travar a main thread |
| `EspelhoEnergia.kt` | wake lock, Wi-Fi lock e térmica — **não é um Service**: quem carrega a transmissão em primeiro plano é o `SessionService`. Exige `CHANGE_WIFI_MULTICAST_STATE` no manifest, senão `startForeground` **lança** |
| `EspelhoDiag.kt` | o anel. **Devolve JSON, não texto** — quem monta a frase é o `controle.js` |
| `espelho/tela.js` | a casca do papel `tela`, carregada **no próprio `display/index.html`** entre `native.js` e `db.js`, e no-op de uma guarda fora do papel. Define `__AVBus` (recepção = SSE; envio = o DRENO), neutraliza o `postMessage` do `BroadcastChannel`, corrige o relógio (mediana do epoch dos pings — cronômetro e sorteio chegam como DESCRITOR com instante do celular), embrulha `AVDB.getMedia` para resolver `__rec.url`, e mantém a vigília para a tela não dormir |
| `display.js` (papel `tela`) | `forceMuted` nasce ligado (autoplay sem gesto não existe num navegador de verdade); `window.__telaSom(true)` é o que o botão de entrada chama ao gastar o único gesto; wallpaper por `__wp` (ou o sentinela `'padrao'`), fundo da letra por `imageUrl` na estrofe. **Esconde o `#startBtn` ("Ligar Sistema") pelo PAPEL, em toda carga** — quem declara o elemento é quem o desliga; escondê-lo num caminho de UI do `tela.js` deixava a RECARGA trazê-lo de volta por cima da projeção, gastando o gesto do visitante em nada |
| `controle.js` | **enriquece** cada `load` com `__rec` (registro saneado: id/kind/nome/tipo/url=`/m/<token>`/letra — **nunca** blob, opfsPath ou youtubeId) e dispara o empurrão; **elege** uma tela como referência de tempo; manda a APRESENTAÇÃO por páginas (uma `/m/` por página, `telaDeckUrls` — §5.6); converte o embed do YouTube em `tela-aviso` (o que a tela não sabe tocar, ela DIZ) |

### As decisões que precisam estar ditas

- **UMA página, não duas.** O gesto do visitante (fullscreen + som) **não
  sobrevive a uma navegação**, então não existe "página de entrada que
  redireciona": `tela.js` desenha a entrada como OVERLAY sobre o próprio
  display, e o toque gasta o único gesto em tudo de uma vez — ANTES da rede
  (`gastarGesto`: `requestFullscreen` → `__telaSom(true)` → vigília) e só então
  `POST /par` → token → SSE. Um botão só, "Ativar esta tela", sem código a
  digitar.
- **"O que ainda falta nesta tela?" NÃO pode ser perguntado DENTRO do gesto.**
  `requestFullscreen()` é assíncrono e o clique borbulha até o `document` antes
  de a tela cheia existir (medido: o ouvinte roda com `fullscreenElement=false`
  e o `fullscreenchange` chega 9 ms depois). Perguntar ali responde sempre
  contra o passado, e o que nascia disso era um SEGUNDO botão oferecendo o que o
  toque acabara de fazer. A regra mora no `telaCheia` de `tela.js`: nunca ler
  `document.fullscreenElement` no mesmo turno do pedido para decidir alguma
  coisa; a recusa da Promise é engolida (a tela funciona em janela). O botão de
  canto, o `oQueFalta`/`oferecerGesto` e o guarda `assentando` SAÍRAM na v5.218.
- **Depois de ativada, NADA cobre a tela.** O overlay cheio existe só na primeira
  carga, quando não há nada por baixo. Queda de fio, token vencido e até o
  `adeus` reentram **em silêncio** (um `POST /par` numa escada de 1 s a 30 s,
  `REENTRADA`) — a mídia é local e a letra anda pelo `timeupdate` do próprio
  `<video>`, então a queda leva o fio e mais nada. O gesto perdido volta por
  **dois atalhos e nenhum botão**: TOQUE DUPLO e **F11** (com `preventDefault`,
  senão o navegador entra na tela cheia dele junto com a da API).
- **MAS A RECARGA VOLTA PARA A ENTRADA OFICIAL.** A distinção é entre perder o
  FIO e perder a PÁGINA: numa queda de fio a mídia continua tocando e cobrir a
  tela apagaria uma cena que o problema não atingiu; uma recarga já derrubou
  tudo — inclusive o GESTO. **O token é carregado adiante** ainda assim (o fio só
  abre no toque): `telasSse` é indexado pelo TOKEN, e pedir pareamento novo a
  cada F5 deixaria a sessão anterior ocupando vaga até o vigia notá-la — a
  terceira recarga seguida receberia "lotado".
- **A preview não atrasa para telas de comando** (`dePixels` em
  `recalcularAtrasoPreview`): o atraso media o buffer de MSE do espelho de
  pixels; uma tela por comandos aplica no ato, e o alvo é 0.
- **`snoopStatusDeFora` é UM só, no companion.** `display-status`,
  `espelho-status` e `tela-status` passam pelo MESMO relógio de precedência
  (`ultimoStatusDoTelaoMs`) — a versão por-instância tinha bug latente de
  precedência entre WebViews, e é ele que alimenta a notificação de mídia com o
  app minimizado. **E pela mesma ELEIÇÃO** (`telaRefId`): calado o telão, as até
  três telas alternariam entre si, e `updateFromDisplay` supõe UMA fonte — a
  barra da tela de bloqueio andando para a frente e para trás é o mesmo defeito
  da precedência, um nível abaixo.
- **Detecção por PRESENÇA, não por versão**, onde há objeto injetável:
  `telaAtiva()` é `telaCanal() && espelhoLigado()`, e `telaCanal()` pergunta
  `window.__NATIVE__ && window.__avTelaMidia`.
- **E O `mirrorEstado` É SEMEADO NA ABERTURA** (`lerEspelho()` no `init()`). O
  servidor vive no SHELL e sobrevive ao documento: o OTA aplicado e a morte do
  renderer recarregam o Controle com as telas ainda pareadas. Sem a semente o
  cache nasce `null` e ninguém o relê — `acertarEnqueteDeFundo` só liga o
  relógio de 4 s quando o estado JÁ é conhecido, e a enquete da folha depende do
  bloco de conexão à vista. Aí `telaAtiva()` MENTE: todo `load` sai sem `__rec`,
  a tela não acha o id no IndexedDB dela e a projeção volta ao wallpaper — o
  culto inteiro, sem erro em lugar nenhum. Pelo mesmo cache nulo
  `somLocalDeveEstar()` desmuta a preview por cima das telas.

O tap no `busPost` (§3.2), o `__rec` no comando (§3.5), o embed que não vai à
rede e a apresentação por páginas (§5.6), e a rota `/s/<token>` sem cliente (§7)
estão nas seções da especificação, conferidas na revisão A3.

### As inversões que precisam estar ditas

1. **O áudio é INTEIRO e local.** A tela toca o arquivo (`/m/`) no **`<video>`**
   dela (não há `<audio>` em lugar nenhum do display: é o *kind*, não o elemento,
   que faz o telão manter o wallpaper) — acabaram o AAC parcial, a deriva de eixo
   e o `AudioWorklet`. O som é **opt-in por tela** (o `forceMuted` só sai com o
   gesto do visitante).

   **A ARMADILHA QUE O MICROFONE DEIXOU, e ela vale para o PRÓXIMO comando de
   descida** (o recurso saiu na v1.8.89). O dreno é o filtro de SUBIDA; um
   comando de DESCIDA desce verbatim para toda tela (o `difundirJson` não lê
   tipo, o `entregar()` do `tela.js` também não), então quem precisa barrá-lo
   numa tela é uma GUARDA no consumidor. A do `mic` era `if (TELA) return` no
   topo do `setMic`, e ela existia porque a alternativa era uma proteção
   **EMPRESTADA DO NAVEGADOR**: uma tela roda em `http://`, e `getUserMedia` é
   `[SecureContext]`, logo `navigator.mediaDevices` nem existe ali. Proteção
   assim **se desfaz sozinha** no dia em que a transmissão subir em `https://`, e
   naquele caso o desfecho seria o primeiro push-to-talk pedindo o microfone
   **de cada aparelho da rede**. Comando novo que a tela não deva executar nasce
   com a guarda no consumidor, nunca confiando no ambiente dela.
2. **O que vaza numa rede aberta mudou de natureza:** antes, a imagem contínua de
   tudo que a igreja projeta; agora, os comandos (títulos, referências, letras) e
   as mídias carregadas durante a transmissão, por tokens opacos por sessão (§8).
   A porta nasce aberta (conteúdo público por definição); o teto de 3 sessões e o
   derrubar são o controle real.
3. **A tela executa CÓDIGO nosso, não só decodifica pixels.** O bundle é o mesmo
   do app, então um bundle quebrado quebra as telas junto — **e o watchdog de
   boot do OTA não as cobre**. O que as cobre é o `tela-rede.test.mjs` e o fato
   de o telão de verdade rodar o MESMO `display.js`: quebrar um é quebrar o
   outro, que é o defeito que aparece.

A regra de calendário (a primeira ligada em rede de verdade num dia SEM culto)
está ao fim da §7-B.

---
