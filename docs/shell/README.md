# O shell nativo — mapa dos capítulos

A casca Kotlin que hospeda a base web em dois WebViews e manda **só o Display**
para a TV com `android.app.Presentation`.

> **Este diretório é o irmão de [`../arquitetura/`](../arquitetura/).** Aquele
> cobre a base web (`assets/web/`); este cobre o Kotlin
> (`app/src/main/java/br/org/iasd/av/`, 27 arquivos). As regras que valem para
> o app inteiro — invariantes, paleta, entrega, divergências web × nativo —
> ficam em [`../../CLAUDE.md`](../../CLAUDE.md), que continua sendo a **leitura
> obrigatória**; aqui está o detalhe que ela aponta.

## Os capítulos

| capítulo | arquivo | quando abrir |
|---|---|---|
| A ponte `AVNative` | [`PONTE.md`](PONTE.md) | usar ou mudar um método nativo; `SHELL_VERSION`; as três filas; os tokens `/saf/`; as invariantes 1-4 e 9 |
| O OTA | [`OTA.md`](OTA.md) | publicar; o watchdog de boot; a detecção; `shellTag`; por que a atualização não chegou |

> Os demais subsistemas ainda não têm capítulo próprio: o telão nas telas da
> rede está em [`../TELAO-POR-COMANDOS.md`](../TELAO-POR-COMANDOS.md), e o resto
> (YouTube, serviços em primeiro plano, Activity/WebViews, arquivos do aparelho,
> build/assinatura/backup) vive nas seções correspondentes do `CLAUDE.md` mais o
> KDoc dos arquivos.

## Os 27 arquivos, e onde cada um é explicado

| arquivo | linhas | onde |
|---|---|---|
| `NativeBridge.kt` | 1.361 | [`PONTE.md`](PONTE.md) |
| `WebViewFactory.kt` | 277 | [`PONTE.md`](PONTE.md) — invariantes 1-4 |
| `SafPathHandler.kt` | 99 | [`PONTE.md`](PONTE.md) — o token `/saf/` |
| `WebUpdater.kt` | 1.059 | [`OTA.md`](OTA.md) |
| `ShellUpdater.kt` | 340 | [`OTA.md`](OTA.md) |
| `WebPathHandler.kt` | 88 | [`OTA.md`](OTA.md) |
| `EspelhoHttp.kt` | 911 | [`../TELAO-POR-COMANDOS.md`](../TELAO-POR-COMANDOS.md) |
| `EspelhoServidor.kt` | 1.968 | idem |
| `EspelhoPares.kt` | 628 | idem |
| `EspelhoMidiaCache.kt` | 241 | idem |
| `EspelhoMidiaCanal.kt` | 218 | idem |
| `EspelhoEnergia.kt` | 323 | idem |
| `EspelhoCert.kt` | 298 | idem (TLS opcional; **sem UI desde a v5.196**) |
| `EspelhoDiag.kt` | 116 | idem |
| `YoutubeGrab.kt` | 1.966 | `CLAUDE.md` — "Trabalho em segundo plano" e "Divergências" |
| `StreamProxy.kt` | 511 | `CLAUDE.md` — invariante 8 |
| `MuxMp4.kt` | 190 | `CLAUDE.md` — "Resolução do download" |
| `TrilhaAudio.kt` | 95 | `CLAUDE.md` — "Séries do YouTube" |
| `SessionService.kt` | 908 | `CLAUDE.md` — "Notificação de controles" |
| `SyncService.kt` | 550 | `CLAUDE.md` — "Trabalho em segundo plano" |
| `MainActivity.kt` | 1.709 | `CLAUDE.md` — voltar, volume, cast, fullscreen |
| `StagePresentation.kt` | 187 | `CLAUDE.md` — "Reconexão e morte do renderer" |
| `MicChromeClient.kt` | 80 | `CLAUDE.md` — "Microfone ao vivo" |
| `MessageBus.kt` | 54 | `CLAUDE.md` — "Barramento de comandos" |
| `ShareIntake.kt` | 143 | `CLAUDE.md` — "Compartilhamento" |
| `SlideDeck.kt` | 321 | [`../arquitetura/DOCUMENTO-EM-CENA.md`](../arquitetura/DOCUMENTO-EM-CENA.md) |
| `CifraFonte.kt` | 167 | `CLAUDE.md` — "A aba de cifra" (transporte só; quem lê o HTML é `controle/cifra.js`) |

> **Números envelhecem a cada commit.** Meça antes de citá-los:
> `wc -l app/src/main/java/br/org/iasd/av/*.kt`.
