# TELÃO POR COMANDOS — a substituição do espelho de pixels

> **ESTE DOCUMENTO É O CONTRATO E O DIÁRIO DE BORDO deste trabalho.** Ele foi
> escrito para sobreviver a interrupções: qualquer sessão (humana ou de agente)
> que precise retomar o trabalho começa lendo a seção **"§0 COMO RETOMAR"** e a
> tabela de **Estado** dentro dela. Nenhum passo deste projeto vive só na
> memória de quem o executou — se não está aqui ou num commit, não aconteceu.

---

## §0 COMO RETOMAR ESTE TRABALHO

1. Leia este arquivo inteiro (é a especificação fechada + o plano).
2. Olhe a tabela de Estado abaixo: a primeira etapa não-`CONCLUÍDA` é a atual.
3. Cada etapa diz o que entrega, como se prova (testes) e o que NÃO pode
   quebrar. Uma etapa só é marcada `CONCLUÍDA` com os testes verdes e o commit
   empurrado (branch de trabalho **e** `main`, conforme a regra da etapa).
4. A branch de trabalho é `claude/audio-desconexao-transmissao-web-6tbhsq`.
   `main` recebe merge **apenas de etapas inteiras e seguras** — todo push em
   `main` publica a base web por OTA para o aparelho do operador em minutos
   (aplicação automática, v5.151), então `main` verde e funcional é lei.
5. Ao concluir qualquer etapa: atualize a tabela de Estado NO MESMO COMMIT.

### Estado

| Etapa | Descrição curta | Estado |
|---|---|---|
| E0 | Especificação fechada (este documento) | **EM CURSO** |
| E1 | Fundações puras no shell: Range + SSE no `EspelhoHttp`, cookie no `EspelhoPares` — com JUnit, sem fiação | PENDENTE |
| E2 | Servir o bundle web pela LAN (`GET /display/…`, `/shared/…`) + rota SSE `GET /e` + relay de comandos web→LAN | PENDENTE |
| E3 | Papel `tela` no lado web: `display/` rodando num navegador da LAN, camadas de TEXTO completas (versículo, mensagem, cronômetro, sorteio, cortina, wallpaper de cor) | PENDENTE |
| E4 | Mídia sob demanda: cache no shell (`/m/<id>` com Range), empurrador de bytes OPFS→shell, `load` enriquecido | PENDENTE |
| E5 | Status de volta (`POST /r` → ponte → `espelho-status`), relógio de referência, preview sem atraso artificial | PENDENTE |
| E6 | Corte: espelho de pixels desligado por padrão; telas antigas redirecionadas; Registro/na UI atualizados | PENDENTE |
| E7 | Remoção: EspelhoCodec, EspelhoAudio, EspelhoDisplay, MirrorPresentation, fmp4.js, maquinaria MSE do cliente; docs e testes atualizados | PENDENTE |

> Preencher ao concluir: `CONCLUÍDA (commit <hash>, vX.YZZ)`.

---

## §1 A DECISÃO

O espelho de pixels transmite **o resultado** (H.264 ~3 Mbps + AAC por tela,
contínuos, com 0,7–2 s de atraso). O telão por comandos transmite **a causa**:
o mesmo JSON que já atravessa o barramento interno do app, por SSE, a
navegadores da LAN que renderizam localmente. O apêndice §10-A do
`ESPELHO-DE-PIXELS.md` é o argumento inteiro desta troca: praticamente toda a
sua tabela de defeitos (poda, GOP, IDR, deriva de áudio, borda viva, fila de
quadros) só existe porque há vídeo sendo transmitido.

**A decisão que governa tudo: a tela da rede roda O MESMO `/web/display/`.**
Não se escreve um segundo renderizador. O `display.js` já é o motor de
comandos deste sistema — fades, cortina, Camada de Texto, letra sincronizada,
`load` com posição e estado — e a invariante 5 do projeto (não reimplementar o
que já existe em JS) vale para o próprio lado web: um renderizador novo para a
LAN divergiria do telão de verdade num domingo. O celular serve o próprio
bundle (o mesmo que o OTA atualiza) para os navegadores da rede; o que muda é
o TRANSPORTE dos comandos (SSE em vez de BroadcastChannel) e a FONTE da mídia
(HTTP com Range em vez de OPFS).

O que o celular deixa de fazer: tela virtual, encoder H.264, encoder AAC,
muxer, batimento de 8 Hz, janela `MirrorPresentation`. O que ele passa a
fazer: relay de JSON (desprezível) e servir arquivos de mídia sob demanda
(rajadas, em vez de 3 Mbps contínuos).

**Fora da equação, por decisão do operador:** o embed do YouTube. Cena de
embed é anunciada às telas como "esta cena não vai para a rede" (o quadro de
controle `sem-audio` já tem esse molde). O caminho padrão de YouTube —
download e transmissão direta — é o que segue recebendo manutenção; a
transmissão direta na LAN é a fase opcional §7.

## §2 O QUE FICA E O QUE MORRE

**Fica (infraestrutura de rede, intacta ou ampliada):**

- `EspelhoServidor.kt` — sockets, bind ao IPv4 da Wi-Fi, allowlist de `Host`,
  religamento no IP novo, teto de sessões. Rotas trocam de conteúdo.
- `EspelhoHttp.kt` — o parser puro. GANHA: resposta SSE (`text/event-stream`
  sobre o chunked que já existe) e **Range real** (RFC 7233, faixa única) —
  no `ServerSocket` o Range é NOSSO por contrato (corolário da invariante 8).
- `EspelhoPares.kt` — porta aberta, PIN, QR, prazos, saneamento. GANHA: sessão
  por **cookie** (ver §5.2).
- `EspelhoMdns.kt`/`EspelhoMdnsPacote.kt` — `av.local`, intacto.
- `EspelhoService.kt` — o foreground service `connectedDevice`, intacto.
- `EspelhoCert.kt` — o degrau de TLS, intacto (e mais necessário: ver §8).
- `EspelhoDiag.kt` — o anel; o conteúdo dos fatos muda (ver §9).
- `espelho/qr.js` e o fluxo de pareamento de `cliente.js`.

**Morre (com os pixels), na etapa E7 e nunca antes:**

- `EspelhoCodec.kt`, `EspelhoAudio.kt`, `EspelhoDisplay.kt`,
  `MirrorPresentation.kt` (e o filtro `telasExternas` volta a ter um caso a
  menos), `espelho/fmp4.js`, a maquinaria MSE de `espelho/cliente.js`
  (a maior parte das ~3.000 linhas), o batimento de 8 Hz e o `forceMuted` do
  papel `espelho` em `display.js`, o dreno do papel `espelho` em `native.js`
  (a tela da rede está noutro aparelho e noutra origem — não há barramento
  compartilhado para drenar), `tools/fmp4.test.mjs` e os blocos MSE de
  `tools/espelho-cliente.test.mjs`.

**Some como problema (não precisa de substituto):**

- Deriva A/V do espelho: cada tela toca o arquivo com a própria faixa de
  áudio; a sincronia é do navegador dela.
- Poda/GOP/IDR/borda viva/fila de quadros: não há fluxo de vídeo.
- Térmica e bateria do encoder.
- Dessincronia preview × telas: sem o atraso do pipeline de pixels, a fila
  `previewAtrasoMs` zera quando não houver espelho de pixels ativo.

## §3 ARQUITETURA

```
┌──────────────────────── celular ────────────────────────┐    ┌── navegador na LAN ──┐
│ Controle (/web/controle/)                               │    │ /espelho/ (entrada,  │
│   cmd() ── barramento interno (BC + MessageBus) ──► TV  │    │  pareamento, gesto)  │
│     └─► relay LAN: busPost({__lan:1, …comando})         │    │        │             │
│                    ▼                                    │    │        ▼             │
│ NativeBridge/MessageBus ──► EspelhoServidor             │    │ /display/?tela=1     │
│                               ├─ GET  /e   (SSE) ───────┼────┼─► comandos JSON      │
│                               ├─ GET  /display|/shared  ├────┼─► o próprio bundle   │
│                               ├─ GET  /m/<id> (Range) ──┼────┼─► mídia sob demanda  │
│                               └─ POST /r  (status) ◄────┼────┼── display-status     │
│ WebPathHandler (mesma resolução OTA→APK dos assets)     │    │ renderização LOCAL:  │
│ Cache de mídia (web empurra bytes por WebMessage)       │    │ texto vetorial, fades│
└─────────────────────────────────────────────────────────┘    └──────────────────────┘
```

Decisões, cada uma com o porquê:

1. **SSE, não WebSocket.** O repositório recusou o RFC 6455 por falta de
   oráculo (máscara, fragmentação, ping/pong); SSE é HTTP/1.1 puro — três
   linhas de framing sobre o `chunked` que o `EspelhoHttp` já emite, e
   reconexão automática (`EventSource`) de graça no navegador.
2. **O Kotlin não interpreta comandos** (invariante 5). O servidor relaya o
   JSON verbatim. O estado de cena de uma tela que conecta no meio do culto
   vem pelo mecanismo que JÁ existe: a tela anuncia `display-ready` (com o
   seu `__de`), o relay leva ao Controle, e `resendSceneToDisplay` devolve a
   cena endereçada com `__para` (v5.140). Nenhuma máquina de estado nova.
3. **A mídia é servida pelo celular com Range.** O armazenamento atual (OPFS)
   é ilegível pelo Kotlin, então a etapa E4 usa o precedente do
   `EspelhoAudio`: um canal `WebMessageListener` de `ArrayBuffer` empurra os
   bytes do OPFS para um cache em `cacheDir`, e a rota `/m/<id>` serve dali
   com Range. Quando o armazenamento migrar para um lugar Kotlin-legível
   (decisão futura do projeto), só o abastecedor do cache muda — a rota e o
   contrato ficam. Pré-busca: ao ligar a transmissão e a cada item que entra
   no Cronograma, o Controle empurra em segundo plano.
4. **`load` enriquecido.** A tela da rede não tem o IndexedDB do app. O
   Controle anexa ao comando relayado o REGISTRO da mídia (`__rec`: kind,
   name, rotação, letra sincronizada — os campos exatos saem da varredura de
   E0). No barramento interno nada muda: o anexo só existe na cópia da LAN.
5. **Papel `tela`.** O quarto valor de `__AV_ROLE__`, ativado explicitamente
   por query (`/display/index.html?tela=1`) — nunca por adivinhação de origem,
   porque o fluxo de desenvolvimento no navegador precisa continuar
   funcionando. No papel `tela`: transporte = `EventSource('/e')` para dentro
   + `fetch POST /r` para fora; mídia = `/m/<id>`; sem OPFS, sem microfone,
   sem `espelhoLigar` — a superfície nativa continua sendo privilégio do
   Controle (invariante 9), e aqui nem existe ponte para vazar.
6. **Status e relógio.** Cada tela emite o `display-status` normal do
   `display.js`; o transporte do papel `tela` o envia por `POST /r`; o
   servidor relaya à ponte e o Controle o consome COMO JÁ CONSOME o
   `espelho-status` (v5.173) — renomeado no relay, com o id da tela. Quem
   escolhe a tela de referência é o Controle (a mais antiga com mídia no ar),
   nunca o Kotlin.
7. **Som opt-in continua** (invariante 10 do espelho): a tela nasce muda
   (`muted` no elemento) e o gesto do visitante a desmuta — agora é só um
   atributo, sem remontagem de MediaSource, sem torneira no servidor.
8. **O microfone ao vivo NUNCA sai na rede** — inalterado. No papel `tela` o
   comando `mic` é ignorado (a tela nem tem `getUserMedia` concedível).
9. **Embed do YouTube** → quadro de controle "esta cena não vai para a rede";
   a tela mostra wallpaper + frase. Transmissão direta: fase §7.

## §4 SEQUÊNCIA DE UM CULTO (o fio narrativo)

1. Operador liga "Transmitir pelo site". Sobe o que já sobe hoje (servidor,
   mDNS, service) — MENOS tela virtual, codec e janela.
2. Visitante abre `http://av.local:8787/` (ou o IP). A página de entrada
   (cliente.js enxuto) entra pela porta aberta, recebe **cookie** de sessão e
   navega para `/display/index.html?tela=1`.
3. O display carrega DO CELULAR (mesmo bundle do OTA), detecta o papel
   `tela`, abre `EventSource('/e')` e anuncia `display-ready`.
4. O Controle recebe o anúncio pelo relay e reenvia a cena com `__para` — a
   tela entra exatamente como um dongle que reconectou.
5. Cada comando do operador chega em ~10 ms. Texto renderiza vetorial na
   resolução da tela. `load` de mídia aponta `/m/<id>`; o navegador puxa com
   Range e toca com o áudio da própria faixa.
6. A tela reporta `display-status` a ~1 Hz (e nas trocas de estado); o
   Controle usa a referência para a barra, a MediaSession e a preview.
7. Queda de Wi-Fi: `EventSource` reconecta sozinho, re-anuncia
   `display-ready`, recebe a cena com posição — o mesmo caminho do dongle. O
   que estava na tela (texto, vídeo em loop já baixado) NEM PISCA durante a
   queda, que é a vantagem estrutural sobre pixels.

## §5 CONTRATOS (fechados nesta spec, detalhados com a varredura E0)

### 5.1 SSE (`GET /e`)

- Resposta `200`, `Content-Type: text/event-stream`, sem `Content-Length`,
  `Cache-Control: no-store`. Cada evento: `data: <json>\n\n`. Heartbeat
  `: ping\n\n` a cada 15 s (detector de TCP meio-aberto dos dois lados — a
  lição da §10-A.10/§10-A.11 do espelho, herdada de graça).
- Autenticação por cookie de sessão (ver 5.2) — `EventSource` não põe header,
  e a regra "token nunca viaja numa URL" continua valendo.
- Ao conectar: o servidor NÃO manda estado (não o tem); manda `{"m":"oi"}` e
  relaya o `display-ready` da tela ao Controle.

### 5.2 Sessão por cookie

- O pareamento (porta aberta, PIN ou QR — inalterados no `EspelhoPares`)
  passa a responder `Set-Cookie: av_tela=<token>; HttpOnly; Path=/;
  SameSite=Strict`. O token é o mesmo objeto de sessão de hoje; muda o
  transporte. `Secure` entra junto com o degrau de TLS.
- Rotas autenticadas (`/e`, `/m/`, `/r`, `/display/`, `/shared/`) validam o
  cookie; a página de entrada e o pareamento seguem anônimos como hoje.

### 5.3 Mídia (`GET /m/<id>`)

- Range RFC 7233, faixa única (`bytes=a-b`, `bytes=a-`, `bytes=-n`); sem
  header `Range` → 200 com corpo inteiro; faixa inválida → 416. O parsing é
  função PURA no `EspelhoHttp`, com JUnit — este servidor é a fronteira de
  rede do projeto e um erro aqui é a invariante 8 ao contrário.
- `Content-Type` do registro da mídia; `Accept-Ranges: bytes`.
- O id é opaco por sessão de transmissão (molde do `SafRegistry`): não se
  enumeram ids de acervo pela rede.

### 5.4 Status (`POST /r`)

- O corpo ganha o ramo `{"st": <display-status verbatim>}`. O teto continua o
  da rota (4 KiB autenticado). O relay entrega ao barramento como
  `tela-status` com `__tela: <id>`; o Controle escolhe a referência.

### 5.5 O relay de comandos (web → LAN)

- No funil único de saída do Controle (`cmd()`), a cópia para a LAN sai por
  `busPost` com marca `__lan` — o `MessageBus` entrega ao
  `EspelhoServidor.difundir`, que enfileira o JSON no SSE de cada tela.
  Comando endereçado (`__para`) vai só à tela dona.
- O canal é o MESMO objeto de comando do barramento. Nenhum "protocolo novo"
  — o protocolo é o que o `display.js` já fala.

## §6 AS ETAPAS, COM SEUS CRITÉRIOS

Cada etapa fecha com: testes verdes (JUnit + tools/), tabela de Estado
atualizada, commit na branch, e merge em `main` **somente se** a etapa não
muda comportamento visível sem opt-in (E1–E5 são aditivas e escuras: o
espelho de pixels continua sendo o caminho ativo até E6).

- **E1 — fundações puras.** `EspelhoHttp`: `respostaSse()`, `eventoSse()`,
  `parsearRange()`; `EspelhoPares`: cookie emitir/validar. JUnit para cada
  regra (Range: as nove formas malformadas; cookie: ausente/estranho/vencido).
  Nada chamado em produção ainda. Merge em `main`: sim (código escuro).
- **E2 — bundle + SSE + relay.** Rotas `/display/`, `/shared/`, `/espelho/`
  servidas com a MESMA resolução OTA→APK do `WebPathHandler`; rota `/e`;
  `difundir` de JSON; `busPost` com `__lan` no Controle (guardado por
  `__SHELL_VERSION__ >= 36`). SHELL_VERSION → 36. Prova: teste Chromium novo
  (`tools/tela-rede.test.mjs`) que sobe um servidor de mentira e afirma que a
  página de entrada navega e o display abre o SSE. Merge: sim (escuro — sem
  UI que ligue).
- **E3 — papel `tela`, texto completo.** O transporte no lado web (novo
  `espelho/tela.js`, carregado por `display/index.html` com guarda de papel),
  `display-ready` pelo relay, cena de texto inteira funcionando. Prova:
  `tela-rede.test.mjs` cobre versículo, cronômetro (recalculado por
  `startAt`), cortina, e a reconexão re-anunciando. Merge: sim (ainda escuro:
  a UI do operador continua ligando o espelho de pixels).
- **E4 — mídia.** Cache no shell + empurrador OPFS→shell + `/m/` + `load`
  enriquecido + pré-busca. Prova: JUnit do cache (LRU, id opaco) + teste
  Chromium tocando um vídeo pequeno servido com Range. Merge: sim (escuro).
- **E5 — status/relógio/preview.** `tela-status` → referência no Controle →
  `previewAtrasoMs` = 0 sem pixels. Merge: sim (escuro).
- **E6 — o corte.** A folha "Conectar uma tela" liga o caminho novo;
  `espelhoLigar` ganha o modo (ou um método novo — decidir com a superfície
  na mão); telas antigas que abrirem `/` recebem a página nova
  automaticamente (servida pelo celular — não há cliente desatualizado
  possível). O espelho de pixels vira caminho morto ATRÁS de uma constante,
  por UM lote, para o primeiro culto do novo sistema ter volta. **Regra de
  calendário: liga-se numa terça-feira.** Merge: sim — é o lote do corte.
- **E7 — remoção.** Apaga-se o que a §2 lista, reescrevem-se
  `ESPELHO-DE-PIXELS.md` (nota de aposentadoria apontando para cá),
  `CLAUDE.md` (seção do espelho) e os testes. Merge: sim.

## §7 FASE OPCIONAL (fora do plano, registrada para não se perder)

Transmissão direta do YouTube na LAN: reusar a lógica do `StreamProxy`
(buscar do googlevideo com o UA casado, faixa na query) numa rota
`/m/stream/<token>`, e o `mse.js` — que está no bundle que a tela já roda —
monta o `<video>` como monta no telão. Sem isso, "Tocar agora" de YouTube com
transmissão ligada e sem TV cai no download (política no lado web), e a cena
de embed mostra a frase.

## §8 SEGURANÇA — o que muda de verdade

A inversão da §10 do espelho ("o servidor passa a ter a imagem de tudo que a
igreja projeta") **cresce**: com `/m/`, o servidor passa a ter OS ARQUIVOS
que o operador transmitir, não a foto deles. Em HTTP claro, quem escuta a
rede grava o arquivo. Isso fica escrito na folha do operador como já ficam as
outras inversões; o degrau de TLS (`EspelhoCert`) é a resposta de quem quiser
fechá-la, e continua opcional. O que NÃO muda: mic nunca sai, token nunca em
URL (o cookie substitui até os usos internos), allowlist de `Host` exata,
teto de sessões, aprovação do operador nos modos fechados.

## §9 DIAGNÓSTICO (Registro)

O bloco do espelho troca de perguntas: morrem readback/encoder/ritmo/fila;
nascem, por tela: conectada há quanto tempo, último comando recebido (id e
atraso medido por eco), mídia atual e posição reportada, bytes servidos de
`/m/`, cache (itens, MB, último despejo). O molde não muda: Kotlin devolve
JSON, `controle.js` monta a frase, linha ausente = shell antigo.

## §10 FATOS DA VARREDURA (anexo, preenchido em E0)

*(preenchido ao fim da varredura de código — contratos exatos de
`sendCommand`/`onCommand`, campos do registro de mídia, superfície do
`WebPathHandler`, formato do `display-status`, pontos de guarda de contexto
seguro em `display.js`/`db.js`, e a lista literal do que cada arquivo usa e
que a tela da rede não terá.)*
