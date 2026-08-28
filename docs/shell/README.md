# O shell nativo — mapa dos capítulos

A casca Kotlin que hospeda a base web em dois WebViews e manda **só o Display**
para a TV com `android.app.Presentation`.

> **DOIS MÓDULOS desde a v1.4.5.** O `:core` (`core/src/main/kotlin/`) é JVM
> PURO — doze arquivos que nunca foram Android, agora num módulo onde o
> compilador IMPEDE que uma dependência de plataforma entre neles. O `:app` é a
> casca. A separação é o que permite uma segunda casca hospedar a MESMA lógica
> sem duplicar uma linha; os testes JUnit foram junto, sem uma asserção
> nova, porque **nenhum dos arquivos mudou — só o endereço deles**.
>
> `EspelhoDiag.kt` **não atravessou**, e o motivo está escrito no topo dele:
> `org.json` é API da plataforma Android, não da JVM. *"Sem import de
> `android.*`" não é o mesmo que "portável"* — e foi o compilador do módulo novo
> que disse isso.

> **Este diretório é o irmão de [`../arquitetura/`](../arquitetura/).** Aquele
> cobre a base web (`assets/web/`); este cobre o Kotlin
> (`app/src/main/java/br/org/iasd/av/` mais `core/src/main/kotlin/`). As regras que valem para
> o app inteiro — invariantes, paleta, entrega, divergências web × nativo —
> ficam em [`../../CLAUDE.md`](../../CLAUDE.md), que continua sendo a **leitura
> obrigatória**; aqui está o detalhe que ela aponta.

## Os capítulos

| capítulo | arquivo | quando abrir |
|---|---|---|
| A ponte `AVNative` | [`PONTE.md`](PONTE.md) | usar ou mudar um método nativo; `SHELL_VERSION`; as quatro filas; os tokens `/saf/`; as invariantes 1-4 e 9 |
| O OTA | [`OTA.md`](OTA.md) | publicar; o watchdog de boot; a detecção; `shellTag`; por que a atualização não chegou |
| **A segunda casca** | [`../SEGUNDA-CASCA.md`](../SEGUNDA-CASCA.md) | o programa de **Windows**: o servidor de loopback, a ponte por SSE, a rota `/saf/`, o que falta e o que esta máquina prova. **É o contrato E o diário de bordo** — retomando aquele trabalho, comece pela §0 |

> Os demais subsistemas ainda não têm capítulo próprio: o telão nas telas da
> rede está em [`../TELAO-POR-COMANDOS.md`](../TELAO-POR-COMANDOS.md), e o resto
> (YouTube, serviços em primeiro plano, Activity/WebViews, arquivos do aparelho,
> build/assinatura/backup) vive nas seções correspondentes do `CLAUDE.md` mais o
> KDoc dos arquivos.

## Os arquivos, e onde cada um é explicado

| arquivo | linhas | onde |
|---|---|---|
| `NativeBridge.kt` | 1.731 | [`PONTE.md`](PONTE.md) |
| `WebViewFactory.kt` | 285 | [`PONTE.md`](PONTE.md) — invariantes 1-4 |
| `SafPathHandler.kt` | 99 | [`PONTE.md`](PONTE.md) — o token `/saf/` |
| `WebUpdater.kt` | 1.160 | [`OTA.md`](OTA.md) |
| `ShellUpdater.kt` | 340 | [`OTA.md`](OTA.md) |
| `WebPathHandler.kt` | 88 | [`OTA.md`](OTA.md) |
| `EspelhoHttp.kt` **(:core)** | 922 | [`../TELAO-POR-COMANDOS.md`](../TELAO-POR-COMANDOS.md) |
| `EspelhoServidor.kt` | 2.417 | idem |
| `EspelhoPares.kt` **(:core)** | 630 | idem |
| `EspelhoMidiaCache.kt` **(:core)** | 248 | idem |
| `EspelhoInterfaces.kt` **(:core)** | 193 | idem — **em que interface o socket abre** (é ele que acha o PONTO DE ACESSO) |
| `EspelhoMidiaCanal.kt` | 218 | idem |
| `EspelhoEnergia.kt` | 334 | idem |
| `EspelhoCert.kt` | 298 | idem (TLS opcional; **sem UI desde a v5.196**) |
| `EspelhoDiag.kt` | 116 | idem |
| `YoutubeGrab.kt` | 1.996 | `CLAUDE.md` — "Trabalho em segundo plano" e "Divergências" |
| `StreamProxy.kt` | 511 | `CLAUDE.md` — invariante 8 |
| `MuxMp4.kt` | 190 | `CLAUDE.md` — "Resolução do download" |
| `TrilhaAudio.kt` **(:core)** | 138 | `CLAUDE.md` — "Séries do YouTube" |
| `SessionService.kt` | 916 | `CLAUDE.md` — "Notificação de controles" |
| `SyncService.kt` | 550 | `CLAUDE.md` — "Trabalho em segundo plano" |
| `MainActivity.kt` | 2.005 | `CLAUDE.md` — voltar, volume, cast, fullscreen |
| `StagePresentation.kt` | 188 | `CLAUDE.md` — "Reconexão e morte do renderer" |
| `MicChromeClient.kt` | 81 | `CLAUDE.md` — "Microfone ao vivo" |
| `MicDiag.kt` | 181 | `CLAUDE.md` — "Microfone ao vivo" (o `micDiag` da ponte: POR QUE ele não abre — leitura PURA, não pede nada) |
| `MessageBus.kt` | 54 | `CLAUDE.md` — "Barramento de comandos" |
| `ShareIntake.kt` | 143 | `CLAUDE.md` — "Compartilhamento" |
| `SlideDeck.kt` | 379 | [`../arquitetura/DOCUMENTO-EM-CENA.md`](../arquitetura/DOCUMENTO-EM-CENA.md) |
| `Farol.kt` | 239 | `CLAUDE.md` — "Divergências" e [`../MEDICAO-DE-ALCANCE.md`](../MEDICAO-DE-ALCANCE.md) (a contagem de uso: uma busca por dia, agregada, sem id) |
| `CifraFonte.kt` | 178 | `CLAUDE.md` — "A aba de cifra" (transporte só; quem lê o HTML é `controle/cifra.js`) |
| `NucleoRotas.kt` **(:core)** | 215 | [`../SEGUNDA-CASCA.md`](../SEGUNDA-CASCA.md) — o que uma rota **É** (PURO); a travessia mora aqui |
| `NucleoServidor.kt` **(:core)** | 381 | [`../SEGUNDA-CASCA.md`](../SEGUNDA-CASCA.md) — o socket de loopback; **a porta é a origem** |
| `NucleoPonte.kt` **(:core)** | 274 | [`../SEGUNDA-CASCA.md`](../SEGUNDA-CASCA.md) — o **envelope** da ponte (PURO); três escritas, uma fixture |
| `NucleoDespacho.kt` **(:core)** | 254 | [`../SEGUNDA-CASCA.md`](../SEGUNDA-CASCA.md) — quem responde o quê; **a invariante 9 com oráculo** |
| `NucleoArquivos.kt` **(:core)** | 178 | [`../SEGUNDA-CASCA.md`](../SEGUNDA-CASCA.md) — a rota `/saf/`: a única porta para fora do bundle |
| `NucleoApresentacao.kt` **(:core)** | 33 | [`../SEGUNDA-CASCA.md`](../SEGUNDA-CASCA.md) — a única regra da apresentação que é string |
| `NucleoMain.kt` **(:core)** | 97 | [`../SEGUNDA-CASCA.md`](../SEGUNDA-CASCA.md) — o `nucleo.jar` — o núcleo como programa |

> **Números envelhecem a cada commit.** Meça antes de citá-los:
> `wc -l app/src/main/java/br/org/iasd/av/*.kt`.
