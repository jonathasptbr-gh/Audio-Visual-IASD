# O celular como ponto de acesso — PLANO, não implementação

> # ⚠ NADA DISTO EXISTE NO APP.
>
> **Este arquivo descreve um lote que NÃO foi escrito.** Ele está aqui para não
> se perder e para a investigação não ser refeita — não para descrever o que o
> app faz. Se você está tentando entender o comportamento atual, feche este
> arquivo e leia `docs/TELAO-POR-COMANDOS.md` e a seção "Telão por comandos" do
> `CLAUDE.md`.
>
> **Estado: parado, esperando DUAS MEDIÇÕES em aparelho** (§3). A segunda
> derruba o desenho inteiro se falhar. Decisão do operador em 2026-08-28:
> registrar o plano e não implementar até medir.

---

## §1 O QUE VALE HOJE

O telão por comandos exige que **o celular seja CLIENTE de uma rede Wi-Fi**.
Não exige internet.

| caso | hoje |
|---|---|
| celular no Wi-Fi da igreja (com ou **sem** uplink) | **funciona** |
| celular num roteador próprio, nada ligado na WAN | **funciona** |
| o COMPUTADOR cria o ponto de acesso e o celular entra nele | **funciona** |
| **o CELULAR é o ponto de acesso** | **recusado**, ver §2 |

**O "sem internet" não é acidente, é decisão escrita duas vezes.**
`NET_CAPABILITY_VALIDATED` fica deliberadamente fora do filtro, no KDoc de
`wifiDe` (`EspelhoServidor.kt:2047` — *"é ele que falta numa igreja sem uplink,
e exigi-lo reintroduziria o defeito com outro nome"*) e no `NetworkRequest` de
`observarRede` (`:1250`). O filtro inteiro é `ehWifiLimpa` (`:2069`):
`TRANSPORT_WIFI && !VPN && !CELLULAR`, e nada mais.

**A terceira linha da tabela é o pedido invertido, e ela resolve o caso sem uma
linha de código:** Windows 10/11 "Ponto de acesso móvel", macOS "Compartilhamento
de Internet". O celular vira cliente, `ehWifiLimpa` aprova, e a tela é o próprio
notebook.

## §2 POR QUE O CELULAR COMO PONTO DE ACESSO É RECUSADO

**Dois portões independentes.** Consertar um só não devolve o recurso.

| # | onde | o quê |
|---|---|---|
| 1 | `MainActivity.kt:1454` → `EspelhoServidor.kt:2059` | `redeDaWifi` procura em `cm.allNetworks` uma rede `TRANSPORT_WIFI` sem VPN e sem celular. **O soft AP não é um `Network`** — o downstream do tethering é montado direto no netd, sem `NetworkAgent`, e sempre viveu num eixo que devolve NOME DE INTERFACE (`ap0`, `swlan0`, `wlan1`), nunca objeto `Network`. Sobra o upstream celular, recusado por nome. Desfecho: `Recusa("sem Wi-Fi — o espelho so liga em Wi-Fi")` (`:2021`) |
| 2 | `EspelhoServidor.kt:207/213` | o socket **não** escuta em `0.0.0.0`: `ServerSocket()` mais `bind(InetSocketAddress(ipv4, porta))` explícito, com a allowlist de `Host` derivada daquele IP |

**E com a projeção NO AR o desfecho não é recusa, é QUEDA:** em aparelho de rádio
único, ligar o ponto de acesso desassocia a Wi-Fi → `onLost` → `conferir()`
(`:1288`) → `suspeitarDaRede("a Wi-Fi sumiu")` → 6 s → `queda`. O Registro
descreve a causa imediata e esconde a ação que a provocou.

## §3 AS DUAS MEDIÇÕES — elas vêm ANTES da primeira linha

Este seria o primeiro caminho do `EspelhoServidor` **sem oráculo possível**: o
JUnit cobre a regra pura (§4.1) e mais nada.

| # | a suposição | o teste | se falhar |
|---|---|---|---|
| 1 | a interface do AP aparece em `getNetworkInterfaces()` com o IPv4 dela, em modo tethering | APK de debug com um botão que imprime a leitura crua (nome, `isUp`, endereços) no Registro; ligar o hotspot; conferir num Android 8 e num 12+, e num Samsung e num não-Samsung (o nome varia) | o desenho cai; sobra a §1 |
| 2 | **um bind NAQUELE endereço aceita conexão de um cliente tethered** | o mesmo APK sobe o servidor no endereço achado; um notebook conectado ao hotspot abre a URL | **o desenho cai inteiro** |
| 3 | `getNetworkInterfaces()`/`isUp()` não lançam em builds OEM (há relatos de `SocketException` no Android 11) | o botão do item 1 num aparelho de cada fabricante à mão | `try/catch` por interface já é a defesa; muda o quanto se confia nela |
| 4 | ligar o hotspot derruba a Wi-Fi STA — e possivelmente o Miracast (mesmo rádio) | com a transmissão no ar e a TV conectada, ligar o hotspot e ver o que cai | decide a FRASE da folha de conexão |

**Teste de custo zero, antes de qualquer APK:** ligar o ponto de acesso, conectar
o computador e ver o **gateway padrão** dele — esse endereço É o do celular na
rede do hotspot. Ele responder a ping resolve boa parte de (1) e (2).

> **Regra de calendário deste projeto:** a primeira ligada em rede de verdade é
> **numa terça-feira, não no culto.**

## §4 O PLANO

### 4.0 Lote SÓ-WEB (vale sozinho, e sai antes)

Ele não resolve o ponto de acesso — resolve o operador não saber o que fazer.
Hoje ele lê *"sem Wi-Fi — o espelho só liga em Wi-Fi"*: verdade como veredito,
inútil como instrução, e o próximo movimento que ela sugere (ligar o hotspot) é
exatamente o que piora o caso. A resposta certa está escrita **num comentário de
código** (`controle.js:18136`), que o operador nunca lê.

| # | arquivo | o quê |
|---|---|---|
| 1 | `controle/index.html:1462` | `<p class="mirror-lead" id="castEnsino" hidden>` **depois** do `#castMsg`. Nó próprio: aquele é `role="status" aria-live="polite"` e existe para anunciar a MUDANÇA; o ensino é estático, e no mesmo nó faria o leitor de tela reler tudo a cada recusa |
| 2 | `controle.js:23034` | no ramo `if (r.erro)`: manter `r.erro` VERBATIM (o veredito é de quem decidiu) e escrever o ensino no nó novo, **só** quando a recusa é de REDE — teste por PALAVRA (`/wi-?fi/i`), nunca por igualdade com o literal. A recusa de porta ocupada (`:216`) não a contém, e é a única com conserto diferente |
| 3 | `controle.js:23040`, `:23061`, `:23095`, `desligarEspelho` | limpar o `#castEnsino` junto com `texto2(castMsgEl, '')` — senão o ensino de uma recusa fica de pé sob um endereço que já está servindo |
| 4 | `controle.js:23286` | promover o AP isolation do Registro para a FOLHA: com `ligado`, nenhuma tela e `servidor.semConexaoMs > 120000` (`EspelhoServidor.kt:1517`), trocar "Nenhuma tela conectada ainda." pela frase que hoje só o Registro tem (`controle.js:18141`). Usa `espelhoDiag()`, **que já existe com a forma que já existe — zero degrau**. Guardas: só com a folha à vista, piso próprio de ~15 s (a enquete da folha é de 2,5 s e o `espelhoDiag` monta o anel de 60 linhas a cada chamada). **Manter o condicional** ("se alguém abriu o endereço, …"), senão o app acusa o roteador por causa de um operador que ainda não foi até o computador |
| 5 | `tools/recusa-transmissao.test.mjs` (novo) + `apk.yml` | três metades: recusa de rede mostra veredito **e** ensino; recusa de PORTA mostra veredito e **não** mostra ensino (sem esta, "ensinar sempre" passaria); sucesso não deixa ensino de pé. Mais a metade que lê o próprio `.kt` e afirma que as recusas de rede contêm "Wi-Fi" e a de porta não — a técnica do `tipos-que-sobem.test.mjs`, e pelo mesmo motivo: duas listas sem oráculo divergem no primeiro esquecimento, e aqui a divergência é MUDA |
| 6 | `CLAUDE.md`, `docs/TELAO-POR-COMANDOS.md`, `site/` | a regra: **a transmissão não precisa de internet; precisa que o celular seja cliente de uma Wi-Fi.** No `site/`, uma linha (caminho relativo) — "um roteador comum serve, mesmo sem internet" é decisão de COMPRA que a igreja toma antes de baixar o app |

### 4.1 Lote APK+WEB — `SHELL_VERSION` 56→57, `minShell: 57`, `shellTag`

> **O número:** `v1.4` já é tag publicada. O próximo é `1.4.1`, depois `1.4.2` —
> **nunca `1.4.0`**, que é a MESMA versão que `1.4` para o `compareVersions` e
> seria ignorada em silêncio. E não é INCREMENTAL: não há seção nova, é a mesma
> folha de conexão.

**A regra pura e o JUnit vêm ANTES de qualquer linha que toque no servidor.**

**1. `EspelhoInterfaces.kt` (NOVO) — PURO**, zero import de Android, irmão de
`EspelhoHttp`/`EspelhoPares`/`EspelhoMidiaCache`.

```
enum Tipo { PONTO_DE_ACESSO, CABO, DESCONHECIDO }
data class Bruta(nome, noAr, loopback, pontoAPonto, ipv4: List<String>)
data class Achado(nome, ip, tipo)
data class Recusada(nome, motivo)
fun escolher(brutas: List<Bruta>, reivindicadas: Map<String,String>): Leitura
```

Sete recusas, **nesta ordem**, com o motivo em cada `Recusada`:
(a) fora do ar · (b) loopback · (c) ponto-a-ponto · (d) família que nunca é AP —
`rmnet*`, `ccmni*`, `pdp*`, `v4-rmnet*`, `clat*`, `tun*`, `ppp*`, `ipsec*`,
`wg*`, `sit*`, `dummy*` e **`p2p*`** · (e) reivindicada por um `Network` ·
(f) sem IPv4 · (g) IPv4 fora de RFC1918 (10/8, 172.16/12, 192.168/16 — **CGNAT
100.64/10 fica de fora de propósito**).

Só então a classificação: `ap|softap|swlan|uap|wlan[1-9]`, e `wlan*` não
reivindicada → `PONTO_DE_ACESSO`; `eth|usb|rndis|ncm` → `CABO`; resto →
`DESCONHECIDO`.

**Ela classifica; ela não filtra por política.** Quem admite só
`PONTO_DE_ACESSO` é o chamador — uma linha visível, e não um efeito colateral da
ordem da enumeração.

**O DISCRIMINADOR NÃO É O NOME**, e é isso que faz a regra durar: a pergunta é
*"que interface está no ar, com IPv4 privado, e que NENHUM `Network` reivindica?"*
— e a do soft AP é, por construção, a única com essa forma, porque não é uma
rede que este aparelho USA, é uma que ele SERVE. O segundo argumento sai de
`cm.allNetworks × LinkProperties.getInterfaceName()`, API pública desde a 21. O
nome entra só na classificação, **depois** de três filtros independentes.

**2. `EspelhoInterfacesTest.kt` (NOVO) — JUnit em PARES**, molde do
`TrilhaAudioTest`. Entram: `ap0`/192.168.43.1 · `swlan0`/192.168.43.1 ·
`wlan1`/192.168.174.1 (o Android 11+ **sorteia** a /24) · `wlan0`/192.168.43.1
não reivindicada. **Não podem ter entrado junto:** `wlan0`/192.168.1.50
reivindicada como wifi · `rmnet_data0`/10.20.30.40 (privado — **só a família o
recusa**, e é o caso que prova por que a família existe) · `rmnet_data0`/100.64.3.7 ·
**`p2p-wlan0-0`/192.168.49.1** · `tun0`/10.8.0.2 · `lo` · `ap0` sem IPv4.
`eth0`/192.168.0.9 sai como `CABO`, nunca `PONTO_DE_ACESSO`. Mais a ORDEM:
`ap0` antes de `eth0`.

**3.** `EspelhoServidor.kt:1809` — `data class Rede` ganha `iface` e
`via: Via` (`WIFI` | `PONTO_DE_ACESSO`).

**4.** `EspelhoServidor.kt:2017` — `redeParaServir(ctx): List<Rede>` ao lado de
`redeDaWifi`, que fica **intacta byte a byte** como degrau 1 (zero regressão na
igreja que já funciona). Degrau 2 só quando ela recusa: adaptador Android
(`getNetworkInterfaces()` → `Bruta`; `allNetworks × interfaceName × capabilities`
→ `reivindicadas`), tudo em `try/catch` **por interface** (`isUp()` pode lançar
sozinho) e o degrau inteiro degradando para o comportamento de hoje. Dedup por
IP, STA primeiro.

**5.** `EspelhoServidor.kt:200-203` — a reconferência do `ligar()` hoje compara
contra `redeDaWifi` e **recusaria qualquer endereço de AP**: um endereço achado
corretamente morreria aqui. Passa a exigir que o `ipv4` pedido esteja na lista do
`redeParaServir`. **As linhas 207-213 do bind NÃO MUDAM UMA LETRA** — escrever
isso no KDoc, porque o revisor vai procurar por elas.

**6.** `EspelhoServidor.kt:2088` — `ipAindaEDaWifi` → `ipAindaEServivel`.
**O passo cuja ausência derruba o lote:** ele pergunta ao ConnectivityManager,
que em modo AP responde sempre não. CM primeiro (como hoje), depois "este IP
ainda está numa interface que a regra aceita?".

**7.** `EspelhoServidor.kt:1208` — a enquete no `vigiar()`. O laço de 1 s que já
existe passa a conferir, a cada ~5 s e **só quando `via == PONTO_DE_ACESSO`**, se
o `ipServido` ainda está numa interface viva; sumiu → `suspeitarDaRede("o ponto
de acesso foi desligado")`. Ele não decide nada: alimenta a graça de 6 s +
`confirmarRede` que já existem.

> **O risco real, medido no código, porque as quatro propostas o descreveram
> errado.** Em AP **puro** (sem STA nenhuma) o callback de `TRANSPORT_WIFI` de
> `observarRede:1255` nunca dispara, `redeSuspeitaDesde` fica 0 e
> `confirmarRede:1354` retorna na primeira linha — **não há morte em 6 s ali**;
> há coisa pior: **nada vigia o AP caindo**, e o servidor fica para sempre num
> socket amarrado a um endereço morto. A morte em 6 s é real no caso de rádio
> único (§2). Os dois pedem o mesmo conserto.

**8.** `EspelhoServidor.kt:1255` — `observarRede` fica como está, com um KDoc
dizendo por que o callback não cobre o AP e apontando para a enquete — senão o
próximo leitor a apaga como redundante.

**9.** `EspelhoServidor.kt:1370` — `confirmarRede`, **uma linha**:
`redeDaWifi(app).ip` → `redeParaServir(app)` restrito à MESMA `via` que está
servindo (não migrar de AP para Wi-Fi sozinho: seria ligar por conta própria, e o
contrato diz AUXILIAR). Com isso o hotspot ligado no meio do culto RELIGA em vez
de derrubar. **Rever a frase de `:1441`** ("religado, sem perder o pareamento"):
em modo AP ela é conforto falso — se o AP reiniciou, as telas perderam o SSID.

**10.** `MainActivity.kt:1448` (`startMirror`) e `:1586` (`mirrorJson`): o passo
1 usa `redeParaServir` e honra o `ip` pedido quando há um; a frase de fallback
deixa de ser "o espelho só liga em Wi-Fi". `mirrorJson` ganha `via` e
`redes: [{ip, tipo, rotulo, iface, servindo}]`. **Nenhuma frase nasce aqui** —
invariante 5.

**11.** `NativeBridge.kt:878` — `espelhoLigarEm(callId, ip)` **ADITIVO** (o
`espelhoLigar` de hoje fica), guardado por `host != null` como os outros —
**invariante 9: este método abre um servidor na rede da igreja.**
`SHELL_VERSION` 56 → 57.

**12.** `shared/native.js`: `espelhoLigar: (ip) => ip ? call(id =>
B.espelhoLigarEm(id, String(ip))) : call(id => B.espelhoLigar(id))`.
`espelhoEstado` já passa o objeto adiante, então `via` e `redes` chegam sozinhos
— **mas `tools/ponte.test.mjs` tem de cobrar os dois**: ele é o único oráculo que
pega campo remontado esquecido.

**13.** `controle/controle.js`: `renderCast` lê `via` e escreve a instrução certa
abaixo do endereço; a escolha entre redes só é desenhada com **`redes.length > 1`**
(escolha que aparece sozinha no caso raro não cobra nada no caso comum), com
rótulo que nomeia a coisa — "a Wi-Fi da igreja" × "o ponto de acesso deste
celular". O `blocoEspelho` **para de cravar `', ligado à Wi-Fi)'` em `:18021`** e
passa a sair de `via` — no instante em que este lote sair, aquela string vira
mentira no artefato que existe para ser copiado e lido a distância. O Registro
ganha as interfaces vistas e o motivo de cada recusa, verbatim do Kotlin: é a
única forma de diagnosticar a distância um nome de interface de fabricante.

**14.** `version.json`, `WEB_VERSION`, `#appVersion`, `CLAUDE.md`,
`docs/TELAO-POR-COMANDOS.md` §2.3/§8. Na documentação, **corrigir a REGRA**, não
acrescentar parágrafo: "bind explícito ao IPv4 da Wi-Fi" vira "ao IPv4 SERVÍVEL —
RFC1918, de uma interface que a regra aceita, nunca reivindicada pelo
ConnectivityManager".

**15.** `AndroidManifest.xml` — **NADA.** Nenhuma permissão nova, e isso é
resultado, não acaso: é o que separa este caminho do `TetheringManager`. Uma
linha de comentário para ninguém "consertar" depois acrescentando
`ACCESS_WIFI_STATE`.

## §5 INVESTIGADO E RECUSADO — para não ser refeito

| o quê | por que não |
|---|---|
| **`WifiManager.startLocalOnlyHotspot()`** (o app CRIAR a rede) | alcançável (API 26, cabe no minSdk) e mesmo assim não: cobra `ACCESS_FINE_LOCATION` (permissão perigosa; o app hoje tem UMA sensível, `RECORD_AUDIO`) mais localização LIGADA no sistema até a API 32; **SSID e senha são sorteados pelo sistema a cada sessão** — o operador redigitaria uma senha aleatória de 8 caracteres em até três TVs TODO SÁBADO; desassocia a Wi-Fi do mesmo jeito; e ainda assim **não devolve um `Network`** para o bind, então sobraria a mesma enumeração |
| **`TetheringManager` · `getWifiApConfiguration()` · `isWifiApEnabled()` · `getTetheredIfaces()`** | `@hide`/`@SystemApi`; `TETHER_PRIVILEGED` é `signature|privileged`; com `targetSdk = 35` a barreira de interfaces não-SDK fecha a reflexão |
| **Wi-Fi Direct (`WifiP2pManager`)** | o navegador de um computador comum não entra num grupo Wi-Fi Direct |
| **bind em `0.0.0.0`** | o pareamento perdeu o código na v5.189: **quem alcança a porta PAREIA**. O teto de 3 e o castigo medem OCUPAÇÃO, não admissão; a allowlist de `Host` barra DNS rebinding e mais nada. A única membrana do recurso é o bind — e no cenário que motiva o pedido (igreja sem Wi-Fi = celular em dados móveis) o wildcard abre exatamente `rmnet`. **E nem paga o que promete:** para imprimir o endereço ainda seria preciso enumerar interfaces |
| **`p2p*` na allowlist** | o Group Owner do Wi-Fi Direct serve `192.168.49.1` — RFC1918, sem `Network` que o reivindique, **no ar durante todo culto com Miracast**. O servidor subiria no fio do dongle e nenhuma tela da rede o alcançaria. `p2p*` entra na lista de RECUSA, e o par vira caso de JUnit obrigatório |
| **denylist de nomes como guarda primária** | `eth0`/`usb0`/`rndis0` de um dock, ou um OEM desconhecido com IPv4 privado, seriam ACEITOS. Falhar ABERTO em nome desconhecido é o oposto do que a primeira fronteira de rede do projeto pode fazer |
| **não registrar `observarRede` em modo AP** | retirar condicionalmente um mecanismo existente. Ele fica: em AP puro nunca dispara (inofensivo), e um `onAvailable` de Wi-Fi alheia só chama `redeVoltou()`, que retorna cedo com `redeSuspeitaDesde == 0` |
| **`espelhoAbrirPontoDeAcesso()`** (o app abrir a tela de Ajustes) | boa ideia, ADIADA: segunda cadeia de intents não documentados mais um bloco `<queries>`, com a mesma armadilha que `pickCastIntent` já documenta |

## §6 O CUSTO, DITO

**O que fica pior.** Ligar o ponto de acesso **derruba a Wi-Fi do celular** em
aparelho de rádio único — e com ela a internet por Wi-Fi durante a transmissão
(a celular sobrevive: `ytFetch`, OTA e `apkProcurar` seguem pelo chip). **Pode
derrubar o Miracast junto**, porque softAP e Wi-Fi Direct disputam o mesmo rádio:
o recurso resolve a igreja sem Wi-Fi e pode custar a TV. Isso tem de estar na
folha de conexão, não ser descoberto às 9h20 de sábado.

**O que passa a poder falhar.** Um caminho de rede novo sem oráculo de ponta a
ponta, no arquivo que é a primeira fronteira de rede do projeto. Um mecanismo de
sobrevivência a mais. E a regra depende de nomes de interface que OEM muda sem
avisar — **aqui não há OTA que conserte, porque é Kotlin**. A defesa é falhar
FECHADA: nome desconhecido custa o recurso e uma frase, nunca um socket no lugar
errado. Se alguém simplificar a regra para "nome começa com ap" para fazê-la
funcionar num aparelho, ela quebra no próximo — **e quebra dizendo "sem ponto de
acesso" com o hotspot ligado**.

**O que o operador tem de entender que antes não precisava.** Que existem duas
redes possíveis e que ele pode ter de ESCOLHER — e que a certa nem sempre é a que
o app acha primeiro: numa igreja com AP isolation o celular está associado à
Wi-Fi, o servidor sobe, o endereço aparece, e **nada chega**. Que ligar o hotspot
pode tirar a TV do ar. E que o hotspot **se desliga sozinho** por ociosidade em
vários fabricantes — com nenhuma tela conectada por alguns minutos, a transmissão
cai por decisão do sistema; a enquete do item 7 nomeia, mas não impede.

**O que este lote NÃO custa, e vale dizer:** nenhuma permissão nova, nenhum
diálogo de localização, nenhuma API escondida, nenhuma dependência, e nenhuma
linha do bind, da allowlist de `Host`, do `EspelhoPares` ou do `EspelhoHttp`. A
exposição de rede **ENCOLHE**: no ponto de acesso, quem alcança a porta é quem
digitou a senha WPA2 — conjunto menor e melhor definido que a LAN da igreja, onde
qualquer visitante já está dentro.

## §7 ISOLAMENTO DE CLIENTE — o que nenhum lote resolve

Isolamento **dentro do próprio hotspot** é indetectável do app: o servidor sobe,
o endereço aparece, e as telas não chegam. Não há frase honesta possível além da
do desfecho ("nenhuma tela conectou"), que já existe (`EspelhoServidor.kt:1517`,
`controle.js:18141`).
