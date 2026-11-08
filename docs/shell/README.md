# O shell nativo — mapa dos capítulos

A casca Kotlin que hospeda a base web em dois WebViews e manda **só o Display**
para a TV com `android.app.Presentation`.

> **Este diretório é o irmão de [`../arquitetura/`](../arquitetura/).** Aquele
> cobre a base web (`assets/web/`); este cobre o Kotlin
> (`app/src/main/java/br/org/iasd/av/`, 32 arquivos). As regras que valem para
> o app inteiro — invariantes, paleta, entrega, divergências web × nativo —
> ficam em [`../../CLAUDE.md`](../../CLAUDE.md), que continua sendo a **leitura
> obrigatória**; aqui está o detalhe que ela aponta.

## Os capítulos

| capítulo | arquivo | quando abrir |
|---|---|---|
| A ponte `AVNative` | [`PONTE.md`](PONTE.md) | usar ou mudar um método nativo; `SHELL_VERSION`; as quatro filas; os tokens `/saf/`; as invariantes 1-4 e 9 |
| O OTA | [`OTA.md`](OTA.md) | publicar; o watchdog de boot; a detecção; `shellTag`; por que a atualização não chegou |

> Os demais subsistemas ainda não têm capítulo próprio: o telão nas telas da
> rede está em [`../TELAO-POR-COMANDOS.md`](../TELAO-POR-COMANDOS.md), e o resto
> (YouTube, serviços em primeiro plano, Activity/WebViews, arquivos do aparelho,
> build/assinatura/backup) vive nas seções correspondentes do `CLAUDE.md`, no
> [`../BUILD.md`](../BUILD.md) (build, assinatura, backup) e no
> [`../DIVERGENCIAS-WEB-NATIVO.md`](../DIVERGENCIAS-WEB-NATIVO.md), mais o KDoc dos arquivos.

## Os 32 arquivos, e onde cada um é explicado

| arquivo | linhas | onde |
|---|---|---|
| `NativeBridge.kt` | 2.506 | [`PONTE.md`](PONTE.md) |
| `WebViewFactory.kt` | 343 | [`PONTE.md`](PONTE.md) — invariantes 1-4 |
| `SafPathHandler.kt` | 266 | [`PONTE.md`](PONTE.md) — o token `/saf/` e a JANELA `?r=` |
| `WebUpdater.kt` | 1.259 | [`OTA.md`](OTA.md) |
| `ShellUpdater.kt` | 371 | [`OTA.md`](OTA.md) |
| `WebPathHandler.kt` | 88 | [`OTA.md`](OTA.md) |
| `EspelhoHttp.kt` | 935 | [`../TELAO-POR-COMANDOS.md`](../TELAO-POR-COMANDOS.md) |
| `EspelhoServidor.kt` | 2.492 | idem |
| `EspelhoPares.kt` | 630 | idem |
| `EspelhoMidiaCache.kt` | 248 | idem |
| `EspelhoInterfaces.kt` | 196 | idem — **em que interface o socket abre** (é ele que acha o PONTO DE ACESSO) |
| `EspelhoMidiaCanal.kt` | 217 | idem |
| `EspelhoEnergia.kt` | 348 | idem |
| `EspelhoCert.kt` | 298 | idem (TLS opcional; **sem UI desde a v5.196**) |
| `EspelhoDiag.kt` | 116 | idem |
| `YoutubeGrab.kt` | 2.745 | `CLAUDE.md` — "Trabalho em segundo plano"; [`../DIVERGENCIAS-WEB-NATIVO.md`](../DIVERGENCIAS-WEB-NATIVO.md) |
| `StreamProxy.kt` | 560 | `CLAUDE.md` — invariante 8; **latente desde a X1** (a rota `/stream/` não tem produtor — ver `PONTE.md`) |
| `MuxMp4.kt` | 215 | [`../DIVERGENCIAS-WEB-NATIVO.md`](../DIVERGENCIAS-WEB-NATIVO.md) (acima de 720p o YouTube entrega vídeo sem som; o `MediaMuxer` junta as duas faixas por CÓPIA de amostras, sem recodificar, e pares de contêineres diferentes o muxer recusa DEPOIS de tudo baixado) |
| `TrilhaAudio.kt` | 138 | `CLAUDE.md` — "Séries do YouTube" |
| `SessionService.kt` | 991 | `CLAUDE.md` — "Notificação de controles" |
| `SyncService.kt` | 773 | `CLAUDE.md` — "Trabalho em segundo plano" |
| `MainActivity.kt` | 3.346 | [`../DIVERGENCIAS-WEB-NATIVO.md`](../DIVERGENCIAS-WEB-NATIVO.md) — voltar, volume, cast, saída de áudio, fullscreen |
| `StagePresentation.kt` | 188 | [`../arquitetura/DISPLAY.md`](../arquitetura/DISPLAY.md) — "Reconexão e morte do renderer" (resumo no `CLAUDE.md`) |
| `MicChromeClient.kt` | 81 | [`../DIVERGENCIAS-WEB-NATIVO.md`](../DIVERGENCIAS-WEB-NATIVO.md) — "O microfone ao vivo SAIU" (o `onPermissionRequest` segue armado para o dia em que a captura voltar; o `requestMic`/`requestMicPermission` e o `MicDiag` saíram na X1) |
| `PacoteProvider.kt` | 39 | `CLAUDE.md` — "O pacote de transferência" (subclasse VAZIA do `FileProvider`, e ela É a correção do "0 KB": duas autoridades sobre a MESMA classe compartilham a instância — e a tabela de caminhos — da primeira, porque o `ActivityThread` as guarda por `ComponentName`. Oráculo: `manifest-provedores.test.mjs`) |
| `PacoteCanal.kt` | 326 | `CLAUDE.md` — "O pacote de transferência" (o SEGUNDO canal de `ArrayBuffer` do shell; abrir e fechar o destino entram pela ponte, porque envolvem uma PESSOA) |
| `MessageBus.kt` | 54 | `CLAUDE.md` — "Barramento de comandos" |
| `ShareIntake.kt` | 164 | [`../DIVERGENCIAS-WEB-NATIVO.md`](../DIVERGENCIAS-WEB-NATIVO.md) — "Compartilhamento" |
| `SlideDeck.kt` | 455 | [`../arquitetura/DOCUMENTO-EM-CENA.md`](../arquitetura/DOCUMENTO-EM-CENA.md) |
| `Farol.kt` | 258 | [`../MEDICAO-DE-ALCANCE.md`](../MEDICAO-DE-ALCANCE.md) — uma busca por dia, agregada, sem id nenhum |
| `CifraFonte.kt` | 178 | `CLAUDE.md` — "A aba de cifra" (transporte só; quem lê o HTML é `controle/cifra.js`) |
| `R2ImagemFonte.kt` | 249 | [`PONTE.md`](PONTE.md) — o método `r2Imagem`; o desvio de CORS do bucket R2 de fotos (mesma classe do `StreamProxy.kt`; token `/r2img/` consumido uma vez, como o `/saf/`) |

> **Números envelhecem a cada commit.** Meça antes de citá-los:
> `wc -l app/src/main/java/br/org/iasd/av/*.kt`.
