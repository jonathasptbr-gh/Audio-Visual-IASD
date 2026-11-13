# Estudo — o app no Windows

> **2026-11-13 · ESTUDO, não execução.** Nada foi construído. Este documento é a
> base para o operador DECIDIR se, quando e em que ordem o projeto do app para
> Windows acontece. Ele não autoriza trabalho nenhum.
>
> Antecessor: o verbete **13.3** de [`PEDIDOS-EM-ESPERA.md`](PEDIDOS-EM-ESPERA.md)
> (estudo preliminar de 2026-10-31, uma tabela). Este documento o substitui e o
> aprofunda; o que difere está dito na seção 1.4.
>
> Números medidos nesta sessão vêm de `tools/estado.sh`, de `wc -l` e de `find`
> no clone em `316a4ec5`. Números que não foram medidos não aparecem.

---

## 0 · A pergunta que este estudo responde

O pedido do operador (2026-10-31, e retomado em 2026-11-13): *"uma versão do
nosso app para rodar instalado nativamente no Windows"*. Três perguntas o
decidem, e nenhuma delas é técnica:

| pergunta | por que ela manda |
|---|---|
| **Quem usa o PC?** | se é só o operador em casa preparando o acervo, o custo aceitável é baixo; se é a igreja toda, cada atrito de instalação vira Chamado às 8h30 de sábado |
| **O PC substitui o celular no culto, ou convive com ele?** | substituir pede tudo (YouTube, telão, apresentações, OTA); conviver pode começar só com o telão no segundo monitor |
| **Quantos Windows são instalados?** | decide se o projeto precisa de assinatura de código (US$ 150–300/ano) ou se o instalador manual com um clique em "mais informações → executar assim mesmo" resolve |

Este estudo responde a **"o que custa cada resposta"** — e termina com as
perguntas formuladas para ele escolher.

---

## 1 · O que decide quase tudo

### 1.1 O app não é um app Android que projeta: é uma base web e uma ponte

Medido no clone:

| peça | tamanho | onde |
|---|---|---|
| base web (o app de verdade) | **5,8 MB** em `assets/web/` | `app/src/main/assets/web/` |
| casca Android (Kotlin) | **20.839 linhas**, 32 arquivos `.kt` | `app/src/main/java/br/org/iasd/av/` |
| a ponte | **67 métodos** em `window.AVNative`, **73** em `__AVBridge` | `NativeBridge.kt` (2.453 linhas) + `shared/native.js` |
| guardas web/nativo | **51** `if (!window.__NATIVE__)` | `controle.js`, `display.js`, `native.js` |
| só do papel `display`/telão na rede | **9 arquivos** `Espelho*`, 5.443 linhas — **26% do shell** | `app/src/main/java/br/org/iasd/av/` |

> **A ponte tem 67, não 64.** O [`PONTE.md`](shell/PONTE.md) foi medido na
> revisão X1 (shell 85) e diz 64 · 70. Depois dele entraram **três** métodos:
> `abrirGuia` (shell 87 — o guia numa tela do app), `systemVolumeAtual` e
> `systemVolumeDefinir` (o volume em degraus ganhou leitura e escrita). A conta
> do doc continua fechando pelo outro lado — 67 − 3 callbacks sem par no Kotlin
> (`onShare`, `onRemote`, `onDisplayChange`) = 64 servidos; 73 − 9 internos = 64.
> **Dimensione por 67/73**, e o `PONTE.md` espera uma passada de atualização que
> não é deste lote.

**O port não reescreve o app. Escreve OUTRA casca.** A regra de escrita do
projeto já garante isso: o navegador é o padrão, o nativo é a exceção que se
declara ([`DIVERGENCIAS-WEB-NATIVO.md`](DIVERGENCIAS-WEB-NATIVO.md)). Toda a
inteligência — transporte, playlist, letra sincronizada, Bíblia, Camada de
Texto, fades, Cronograma, apresentações `.pptx` — está em JS e é portável sem
uma linha de mudança.

O que **não** é portável é a casca, e ela é justamente onde moram as decisões
difíceis: acesso a pasta, download do YouTube, telão, atualização.

### 1.2 As invariantes do shell se traduzem, e uma delas desaparece

As nove invariantes ([`NUCLEO-TECNICO.md`](NUCLEO-TECNICO.md#invariantes-do-shell-não-quebrar))
foram escritas para o Android, mas o desenho é o mesmo em qualquer casca
Chromium:

| invariante | no Windows |
|---|---|
| **1** servir por `https://` de um host virtual, nunca `file://` | `SetVirtualHostNameToFolderMapping` dá `https://appassets.local/` — contexto seguro igual |
| **2** um único origin para os dois WebViews | o mesmo virtual host nos dois controles |
| **3** um único processo/perfil de WebView | o mesmo `UserDataFolder` |
| **4** `mediaPlaybackRequiresUserGesture = false` etc. | propriedades equivalentes no `CoreWebView2Settings` |
| **8** o `InputStream` devolvido é o recurso INTEIRO, e o WebView aplica o `Range` | **DESAPARECE**: com o host virtual, quem serve o arquivo é o WebView2, e o `Range` é dele. O interceptor só volta se houver rota custom (`/saf/`) |
| **9** a ponte do telão nasce com `host = null` | tradução direta: o segundo WebView nasce sem host object |

A invariante 8 é a que custou três rodadas de APK
([`WEBVIEW-RANGE.md`](shell/WEBVIEW-RANGE.md)). **No Windows ela não existe** —
uma das poucas partes em que portar é *mais simples* que o original.

### 1.3 O que já existe e o estudo preliminar não pesou: o telão no PC já funciona

O **telão por comandos** ([`TELAO-POR-COMANDOS.md`](TELAO-POR-COMANDOS.md), §0
"Concluído" na v5.187) faz o celular servir o próprio bundle por HTTP na rede
local e mandar os comandos por SSE. Qualquer navegador da LAN abre
`/display/` e vira telão — **sem instalar nada**.

Consequência para este estudo: **"quero mostrar no telão do PC da igreja" já
está resolvido hoje**, com o celular ligado servindo. Se o pedido do operador
fosse só esse, o custo seria zero. O que falta é outra coisa:

| o que o PC daria e hoje não dá | por quê |
|---|---|
| o **acervo** no disco do PC, sem depender do celular | o PC só recebe o que o celular serve |
| **operar** o culto do notebook, sem celular | o papel `controle` depende da ponte |
| o telão no **segundo monitor** do mesmo PC | no Android é `Presentation`; no Windows é uma janela |
| preparar o acervo **em casa**, no PC | idem acervo |

É essa a lista que o projeto de Windows compra. A seção 4 a mede item por item.

### 1.4 O que este estudo corrige do preliminar (13.3)

| 13.3 dizia | este estudo diz |
|---|---|
| três caminhos: PWA, WebView2, Electron | **cinco** — entram a **(D) serviço local + Edge em modo app**, que é a mais barata de todas, e a **(E) só telão**, que é quase de graça (seção 3) |
| a paisagem "vale JÁ" como lote de web | continua verdadeiro, e **não espera este projeto** — ela ficou de fora deste estudo de propósito (seção 9, pergunta 6) |
| "reescrever a ponte em C#: SAF→pastas do disco" | verdadeiro, mas o custo não está na quantidade de métodos: **8 dos 67** (o grupo do espelho de tela) não têm equivalente no Windows e respondem o desfecho inofensivo (seção 5) |

---

## 2 · O que o navegador faz e o app não — e o contrário

A tabela completa é [`DIVERGENCIAS-WEB-NATIVO.md`](DIVERGENCIAS-WEB-NATIVO.md)
(~40 linhas). Agrupada pelo que decide o port:

| grupo | no navegador hoje | no app Android | peso no port |
|---|---|---|---|
| **Acervo em pasta** | `showDirectoryPicker()` **existe** | SAF (não existe no Android) | **médio** — no Windows a pasta é mais fácil que o SAF |
| **YouTube: ouvir/baixar/buscar** | não existe (CORS) | `YoutubeGrab.kt` + NewPipeExtractor | **o mais caro** — seção 5.3 |
| **Cifra** | não existe (CORS) | aba CIFRA, `cifraHtml` | médio — mesma família do YouTube (buscar página) |
| **Séries do YouTube** | não existe | álbum por série | médio — depende do YouTube |
| **Telão** | não existe (`ServerSocket`) | `Presentation` + telão por comandos | **baixo** — no Windows é uma janela |
| **PDF / .pptx** | PDF **não**; `.pptx` sim (JS) | `PdfRenderer` nativo | baixo — `Windows.Data.Pdf` |
| **Compartilhamento do sistema** | não | `intent-filter` | baixo, e é irrelevante no PC |
| **Controles fora do app** | não | `MediaSession` | baixo — as teclas de mídia do Windows |
| **Download em segundo plano** | a aba continua | FGS + wake lock | **desaparece** — o PC não congela processo |
| **Atualização do app** | recarregar | APK + OTA da base web | baixo — instalador + OTA igual |
| **Contagem de uso (farol)** | não existe | ponte | trivial |
| **Tema do cromo do sistema** | `theme-color` | `temaClaro` | trivial |

**A leitura que importa:** o trabalho caro está todo num lugar só — **o YouTube**
(2.767 linhas de Kotlin, com uma dependência Java). O resto ou é trivial, ou é
*mais fácil* no Windows do que no Android.

---

## 3 · As opções

São cinco caminhos. Quatro entregam "o app no Windows" e diferem em **quanto do
app** e **quanto custa manter**; o quinto é o piso que já existe.

### (A) Nada instalado: o PC como telão pelo navegador

O que já existe hoje (seção 1.3). O celular serve, o PC abre uma URL.

- **Custo:** zero.
- **Ganha:** telão no PC da igreja, com a mídia vindo do celular.
- **Não ganha:** operar do PC, acervo no PC, funcionar sem o celular.
- **Veredito:** não é uma opção de projeto; é o **piso** que já está no ar e que
  qualquer uma das outras precisa superar para se justificar.

### (B) Casca nativa com WebView2 (C#/.NET)

O mesmo desenho do Android, em C#. Dois `WebView2` no mesmo perfil, o bundle
servido por um host virtual `https://`, a ponte via `AddHostObjectToScript`, o
telão numa **janela sem borda** posicionada no monitor secundário
(`Screen.AllScreens`) — mais simples que a `Presentation`.

- **Custo:** uma casca WinForms/WinUI (~800–1.200 linhas) + a ponte em C#
  (seção 5) + o que cada fase pedir.
- **Ganha:** o app inteiro, com cromo próprio, sem barra de navegador, sem
  atalhos do Edge, e a janela do telão no segundo monitor.
- **Perde/perde-se:** nada do que o Android tem, exceto o que não existe no
  Windows (captura, Miracast, botões físicos).
- **Risco:** as incógnitas de arquitetura (IDB/OPFS/BroadcastChannel
  compartilhados entre dois `WebView2`) — ver Fase 0, seção 7.
- **Manutenção:** a mais alta de todas: **duas cascas** a cada degrau de
  `SHELL_VERSION` (seção 8).

### (C) Electron / Tauri

- **Electron:** empacota o Chromium (~150 MB), a ponte é Node — o port fica mais
  fácil, mas é uma dependência grande e contra a regra "sem dependências
  externas" do projeto.
- **Tauri:** usa o WebView2 do sistema (não empacota), binário pequeno, ponte em
  Rust. Exige toolchain Rust na cadeia de build.
- **Veredito:** ambas trocam "escrever a casca" por "adotar um ecossistema".
  Para um projeto cujo argumento é *não ter dependências*, é a pior relação
  custo/benefício — a não ser que o operador queira velocidade acima de tudo.

### (D) Serviço local + Edge em modo app  ⚠️ **a mais barata**

Um executável .NET **sem UI** que:

1. sobe um servidor HTTP em `127.0.0.1:<porta>` servindo o bundle da base web
   (o mesmo desenho do `/m/<token>` do `EspelhoHttp`, que já aplica `Range`);
2. expõe a ponte como **endpoints HTTP** (`/api/<método>`), chamados por um
   `native.js` que fala `fetch` em vez de `__AVBridge`;
3. abre o Edge com `--app=http://127.0.0.1:<porta>/controle/` (janela sem barra
   de navegador) e, para o telão, outra janela em `/display/` posicionada no
   segundo monitor.

Por que ela é muito mais barata:

- **`http://127.0.0.1` é contexto seguro** — OPFS e IndexedDB funcionam como no
  `appassets`.
- Duas janelas do mesmo origin compartilham IDB/OPFS/BroadcastChannel **por
  construção** (são abas do mesmo navegador) — some a incógnita da Fase 0.
- O C# escreve **só servidor** — nada de UI, nada de injeção de host object.
- Os eventos nativo→web (`__avVolumeKey`, progresso de download) viram **SSE**,
  que o projeto já domina no telão por comandos.
- As 51 guardas `!window.__NATIVE__` continuam valendo: `native.js` passa a
  montar `AVNative` sobre `fetch`, e para a base web nada muda.

O que ela perde:

- **Depende do Edge instalado** (presente em todo Windows 10/11; ausente em
  Windows Server/LTSC e em instalações mutiladas).
- A janela é do navegador: `F5`, `Ctrl+Shift+I` e o menu do Edge continuam
  alcançáveis — atrito para um voluntário, e um risco de "atualizar a página no
  meio do culto".
- Um servidor HTTP local (só em `127.0.0.1`, com token por sessão) pode acender
  antivírus/firewall na primeira execução.
- A "sensação de app" é menor que a do (B).

### (E) Só telão, nativo: uma janela que é o Display

Um executável mínimo que abre **só** `/display/` em tela cheia no monitor
escolhido, sem Controle, comandado pelo celular pela rede (o protocolo do
telão por comandos já existe).

- **Custo:** umas poucas centenas de linhas.
- **Ganha:** a TV da igreja pode ser um PC velho, sem Edge, sem depender de
  arrastar janela.
- **Não ganha:** nada de controle/acervo.
- **Veredito:** é a **Fase 1 do (B)** vista de outro ângulo — se o operador quiser
  o caminho mais curto até "tem um app instalado no PC", esta é a primeira
  entrega que faz sentido, e ela é útil mesmo que o resto nunca aconteça.

### O quadro

| | custo | entrega | manutenção | incógnita |
|---|---|---|---|---|
| **A** telão pelo navegador | zero (existe) | telão no PC | zero | — |
| **B** WebView2 | alto | app inteiro | duas cascas | Fase 0 |
| **C** Electron/Tauri | médio | app inteiro | duas cascas + ecossistema | baixa |
| **D** serviço + Edge | **médio-baixo** | app inteiro, com arestas | uma casca, em JS/HTTP | baixa |
| **E** só telão | **baixo** | telão nativo | uma casca mínima | nenhuma |

---

## 4 · O que cada opção entrega, do ponto de vista de quem opera

Escrito pelo que o operador VÊ, sem nome de arquivo:

| tarefa no culto | A (hoje) | E (só telão) | B/D (app inteiro) |
|---|---|---|---|
| abrir a letra no telão do PC | ✅ | ✅ | ✅ |
| usar o PC sem o celular ligado | ❌ | ❌ | ✅ |
| o acervo no disco do PC | ❌ | ❌ | ✅ |
| tocar um vídeo do YouTube baixado | ❌ | ❌ | ✅ (com ressalva — 5.3) |
| ver a cifra do hino | ❌ | ❌ | ✅ (com ressalva — 5.4) |
| apresentação em PDF | ❌ | ✅ | ✅ |
| o telão no segundo monitor, sem arrastar janela | arrastando | ✅ | ✅ |
| atualizar sem reinstalar | — | igual ao OTA | ✅ |

---

## 5 · As adaptações, grupo por grupo

Os 67 métodos de `AVNative` (o catálogo, método a método, está em
[`PONTE.md` §catálogo](shell/PONTE.md)) não custam o mesmo. A classificação
abaixo é do **port**, não do método: TRIVIAL = meia hora, MÉDIO = um ou dois
dias, DIFÍCIL = uma fase, NÃO PORTÁVEL = responde o desfecho inofensivo.

| # | grupo | métodos | no Windows vira | classe |
|---|---|---|---|---|
| 1 | **Pasta e arquivo** | `pickFolder` · `pickDoc` · `listFolder` | `FolderBrowserDialog` / `OpenFileDialog` / `Directory.EnumerateFiles`; servir o arquivo por um host virtual por pasta (o `Range` é do WebView2) | **MÉDIO** |
| 2 | **Compartilhar e área de transferência** | `onShare` · `areaTransferencia` · `compartilharTexto` · `compartilharArquivoTexto` · `openExternal` | `Clipboard.GetText`, `Process.Start`, "abrir com" por associação de arquivo | **MÉDIO** (`onShare` não tem par: no PC o compartilhamento é a linha de comando do "Abrir com") |
| 3 | **Telas e projeção** | `displays` · `onDisplayChange` · `openCast` · `castTarget` · `telaInteira` · `projecaoLocal` | `Screen.AllScreens`; janela sem borda no monitor escolhido | **TRIVIAL em 4**, *mais fácil* que a `Presentation`; **`openCast`/`castTarget` NÃO PORTÁVEL** (o Windows tem Win+P; o `projecaoLocal` perde o sentido, que era impedir a suspensão do renderer oculto) |
| 4 | **Áudio do sistema** | `abrirSaidaDeAudio` · `saidaDeAudioAlvo` · `systemVolume` · `systemVolumeStep` · `systemVolumeAtual` · `systemVolumeDefinir` · `captureVolumeKeys` | painel de som do Windows; CoreAudio; teclas de mídia | **MÉDIO, com armadilha**: `systemVolumeStep` devolve o volume em **degraus de `STREAM_MUSIC`** e o web decide por ele; no Windows o volume é do endpoint, com granularidade e curva diferentes — ou o número muda de significado, ou vira no-op silencioso. `abrirSaidaDeAudio`/`saidaDeAudioAlvo` **NÃO PORTÁVEL** (é a cadeia de componentes do Android) |
| 5 | **YouTube** | `ytFetch` · `ytCancel` · `ytDiscard` · `ytMedida` · `ytDiag` · `ytSearch` · `ytCanalPlaylists` · `ytPlaylist` · `ytDetalhes` | **`yt-dlp` como executável externo** (`ytsearch10:`, `--flat-playlist`, `-f`, progresso no stdout) | **DIFÍCIL** — pela manutenção, não pela escrita (5.3) |
| 6 | **Documentos e apresentação** | `deckPages` · `deckExportUrl` · `deckDiscard` | `Windows.Data.Pdf` (WinRT) renderiza página a página; `.pptx` já é JS e não muda | **MÉDIO** (só o PDF) |
| 7 | **Atualização** | `otaCheck` · `otaApply` · `otaDiag` · `atualizacaoEstado` · `apkInstalar` | baixar o zip do canal e trocar a pasta web; instalador MSI/EXE para a casca | **MÉDIO** (é onde a assinatura entra — 5.5) |
| 8 | **Segundo plano e mídia** | `keepAlive` · `bgConcluido` · `bgProgress` · `nowPlaying` · `onRemote` | ícone de bandeja; SMTC (os controles de mídia do Windows) | **TRIVIAL/MÉDIO** (`keepAlive` **desaparece**: o PC não congela processo) |
| 9 | **Espelho de tela** | `espelhoLigar` · `espelhoDesligar` · `espelhoEstado` · `espelhoDiag` · `espelhoDerrubar` · `espelhoCertImportar` · `espelhoCertEstado` · `espelhoCertApagar` | captura de tela existe no Windows, mas o uso é outro (o PC tem HDMI) | **NÃO PORTÁVEL na fase 1** — desfecho inofensivo |
| 10 | **Cifra** | `cifraHtml` · `cifraDiag` | `HttpClient` + o mesmo parser JS | **MÉDIO** |
| 11 | **Pacote de transferência** | `pacoteCriar` · `pacoteFechar` · `pacoteCancelar` · `pacoteEspaco` · `pacoteCriarLocal` · `pacoteCompartilhar` · `pacoteDescartarPronto` · `pacoteProntoEstado` · `pacoteDiag` · `pacoteConsumirOrigem` | gravar em `Downloads`; abrir arquivo pelo `OpenFileDialog` | **MÉDIO** |
| 12 | **Tema e farol** | `temaClaro` · `farolEstado` | cromo da janela; contagem igual | **TRIVIAL** |

**Resumo do esforço:** dos 12 grupos, **3 são triviais**, **7 são médios**, **1 é
difícil** (YouTube) e **1 não vai** na primeira fase (espelho). E há **pedaços
não portáveis dentro de grupos que vão**: o `openCast`/`castTarget` (grupo 3), a
saída de áudio do Android (grupo 4), o `apkInstalar` (grupo 7) e a energia do
telão (`WifiManager`, wake lock). O que assusta no número — 67 métodos — se
dissolve: a maioria é fachada fina sobre uma API do sistema.

### 5.3 O YouTube é o único problema de verdade

São **2.767 linhas** (`YoutubeGrab.kt`, 79 funções) mais o `MuxMp4.kt` e uma
dependência Java (`NewPipeExtractor v0.26.4` + `nanojson`, `app/build.gradle`
linhas 202 e 212) — a única dependência externa de peso do projeto, e ela existe
porque o Android precisa extrair o vídeo **do IP do chip**, que é o que o
YouTube não bloqueia.

No Windows há duas vias, e nenhuma é gratuita:

| via | como | o preço |
|---|---|---|
| **`yt-dlp` externo** | um `.exe` chamado por processo; faz busca, playlist, canal, formato e progresso | **um binário de terceiro no instalador**, que **quebra sozinho** quando o YouTube muda — e a atualização dele vira rotina de manutenção do projeto. Contra a regra "sem dependências externas", então é uma exceção declarada (como o NewPipe já é) |
| **portar a extração para C#** | reimplementar o que o NewPipe faz | fora de cogitação: são anos-homem |

**A recomendação honesta:** na fase 1, **o YouTube fica de fora** e os itens do
YouTube aparecem como LINK (o caminho que o app já tem para "não consegui
baixar"). O culto no PC funciona com o acervo local, LouvorJA, Bíblia, hinário,
apresentações e o telão. O YouTube entra numa fase própria, depois de medido o
custo real do `yt-dlp` em um Windows de verdade.

### 5.4 A cifra é o YouTube em miniatura

`cifraHtml` é só um `GET` de página + o parser que já é JS. Não depende do
NewPipe. Se o HttpClient do C# buscar a página, a cifra **funciona na fase 1** —
é o único recurso "de rede" que sai de graça.

### 5.5 Instalar no Windows: o gargalo não é o código

O Android já resolveu isto: APK assinado, keystore nos secrets, atualização por
cima sem perder a biblioteca. No Windows o equivalente tem um custo que o
projeto não tem hoje:

| caminho | custo | o que o operador vê |
|---|---|---|
| **MSI/EXE sem assinatura** | zero | o SmartScreen bloqueia com "aplicativo não reconhecido"; é preciso "Mais informações → Executar assim mesmo", e em algumas máquinas o Defender apaga o arquivo |
| **certificado autoassinado** | zero | funciona **só** se o certificado for instalado como raiz confiável em cada PC (passo de administrador) — viável para as máquinas da igreja, inviável para distribuição pública |
| **Azure Artifact Signing** | ~US$ 9,99/mês | o caminho barato da Microsoft… **mas o serviço não atende o Brasil**: organizações só EUA/Canadá/UE/Reino Unido; pessoa física só EUA/Canadá ([code signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options), atualizado em 2026-11-10) |
| **certificado OV** | US$ 150–300/ano + token HSM | assina e o Windows confia; o SmartScreen ainda avisa nas primeiras versões até criar reputação |
| **publicar na Microsoft Store** | conta grátis | a Microsoft assina e não há aviso nenhum — mas o app passa por revisão, e a loja não combina com um app de igreja distribuído por link |

**O ponto que decide:** se o app vai para **as máquinas da igreja** (poucas, com
o operador instalando), o certificado autoassinado com instalação manual resolve
com custo zero. Se vai para **qualquer igreja baixar do site**, sem assinatura o
SmartScreen transforma a instalação num obstáculo — e o certificado OV passa a
ser custo recorrente do projeto, em reais, todo ano.

### 5.6 A documentação é parte da entrega, não consequência

O app no Windows **desmente hoje três frases que o projeto publica**:

| onde | o que está escrito | o que passa a ser verdade |
|---|---|---|
| `README.md`, seção Instalar | *"É um `.apk`: não instala em computador, iPhone ou iPad"* | o APK continua não instalando; o app tem um instalação própria |
| `site/` (a página do app) | o guia de instalação é de Android, com capturas de celular | precisa da instalação no PC e de um "qual eu uso?" |
| `docs/ESTUDO-GUIA-IASD.md` / o guia | o capítulo "Windows" (D6) ensina o **programa de projeção** no computador, não o nosso app | o guia passa a ter dois sentidos de "Windows", e o capítulo precisa dizer qual é qual |

E há uma armadilha de manutenção: **o `notas.json` fala com o operador do
Android**. Um app de Windows com novidades próprias pede uma decisão sobre como
o que mudou chega a quem está no PC.

Isso não é trabalho de documentação do fim: é o que decide se a igreja que
baixar o app no PC consegue instalar sozinha.

---

## 6 · O que NÃO vai, e por quê

Declarado desde já, para não virar surpresa depois:

| o que | por quê | o que acontece no app |
|---|---|---|
| **espelhar a tela do PC** | o PC tem HDMI; o espelho de pixels foi abandonado no Android em favor do telão por comandos | os métodos respondem o desfecho inofensivo |
| **câmera e microfone** | o projeto **nega captura por invariante** (`tools/sem-captura.test.mjs` cobra) | idem — e é a mesma regra nos dois sistemas |
| **compartilhar de outro app para este** | no Windows o caminho é "Abrir com", que entra pela linha de comando | `onShare` não dispara; o "Abrir com" cobre |
| **capturar os botões físicos de volume** | no Windows não há "botões do aparelho": as teclas de mídia chegam pelo SMTC, não por um hook | o volume do app passa a ser o do player, e as teclas chegam sem captura |
| **projeção Miracast pelo menu do app** | o Windows tem o Win+P | o app pode abrir o painel do sistema |
| **a contagem de uso (farol) por APK** | o farol conta instalações de APK | no Windows conta instalações do instalador, ou não conta |

**A regra que vale:** método sem par no Windows responde o desfecho inofensivo —
a mesma regra que já governa o papel `display`, que nasce sem ponte
(`NUCLEO-TECNICO`, invariante 9). Nunca um `throw`: o modo de falhar da ponte é
o silêncio, e um erro que ninguém vê é pior que um "não".

---

## 7 · As fases

A ordem abaixo não é a ordem do entusiasmo; é a ordem que **derruba a incógnita
antes de gastar o trabalho**, e que deixa o app utilizável no fim de cada fase.

### Fase 0 — A prova de arquitetura (meio dia a um dia)

A única incógnita técnica grande da opção (B): **dois `WebView2` no mesmo perfil
compartilham IndexedDB, OPFS e `BroadcastChannel`?** No Android isso é garantido
pela invariante 3 (mesmo processo, mesmo origin). No Windows, é o mesmo
`UserDataFolder` e o mesmo host virtual — mas *ninguém neste projeto mediu*.

- **Entregável:** uma janela com dois controles, os dois no mesmo origin
  virtual, que grava um valor no IndexedDB de um lado e lê do outro; um arquivo
  no OPFS visto dos dois; uma mensagem de `BroadcastChannel` recebida do outro
  lado; e um método de ponte respondendo por `AddHostObjectToScript`.
- **Critério de pronto:** os quatro funcionam. Se **qualquer um** falhar, a
  opção (B) cai e a decisão volta para a (D), que compartilha por construção
  (são abas do mesmo navegador).
- **Custo:** baixo, e é o melhor dinheiro do projeto — ele decide entre duas
  arquiteturas antes de qualquer linha de produção.

### Fase 1 — O culto básico (o núcleo)

- Casca com uma janela, servindo o bundle pelo host virtual.
- **Acervo por pasta** (grupo 1) — a importação, o Cronograma e a Biblioteca
  funcionando com arquivos do disco.
- **Telão em janela sem borda no monitor escolhido** (grupo 3) — mais simples
  que a `Presentation`.
- **PDF** (grupo 6, a metade do `Windows.Data.Pdf`); `.pptx` já é JS.
- **OTA da base web** (a metade de download do grupo 7) — sem isto, cada
  correção de letra exige reinstalar, e é o que o projeto evita desde o OTA do
  Android.
- **Fica de fora:** YouTube, espelho, pacote. A **cifra entra se der** — é a única
  de rede que custa só um `GET` (5.4).
- **Critério de pronto:** **um culto inteiro rodado no PC, sem o celular** —
  hinário, Bíblia, LouvorJA, mídia da pasta, apresentação e telão no segundo
  monitor.

### Fase 2 — O YouTube (a cara)

- `yt-dlp` embarcado, com busca, playlist, canal, download, tetos de qualidade e
  a extração (`MuxMp4` vira `ffmpeg` ou remux no próprio `yt-dlp`).
- **Entra também a cifra** (que é barata e provavelmente já caiu na fase 1, por
  ser só um `GET`).
- **Critério de pronto:** baixar um vídeo do YouTube no PC e tocar no telão, com
  a barra de progresso.

### Fase 3 — A vida longa (a distribuição)

- Instalador (MSI/EXE), atualização da casca, ícone de bandeja, SMTC, pacote de
  transferência, e a **decisão de assinatura** (5.5).
- **Critério de pronto:** instalar num PC limpo, atualizar sem reinstalar, e o
  app sobrevive a um reinício do Windows.

### Se o operador quiser só o primeiro passo

A fase que dá "tem um app instalado no Windows" mais rápido é a **(E)**: só o
telão, alguns dias de trabalho, sem depender de nada do resto. Ela não é um
atalho para o app inteiro — é uma entrega que continua útil mesmo que as fases
seguintes nunca aconteçam.

---

## 8 · O custo de manter duas cascas

Este é o número que o estudo preliminar já avisava e que não pode ficar
escondido: **a partir do Windows, cada degrau de `SHELL_VERSION` tem dois
lados**. Hoje o degrau é **87**.

| o que dobra | o que NÃO dobra |
|---|---|
| a superfície da ponte: cada método novo é **duas implementações** (`NativeBridge.kt` e o equivalente em C#) | a base web — **5,8 MB, uma só** |
| cada método cujo retorno muda de forma | os **177 oráculos** (35 de Node puro, 142 em Chromium, medidos por `tools/estado.sh`), que testam a base web — o mesmo Chromium nos dois |
| o rito de entrega: um Release a mais por degrau | a documentação de recurso, que é do app, não da casca |
| o diagnóstico: um caminho de log a mais | as decisões de produto |

**O que segura isso:** a regra do **desfecho inofensivo** (seção 6) — um método
sem par não é um pendência de paridade, é uma decisão declarada. Sem ela, a
paridade vira uma dívida que cresce a cada lote; com ela, a superfície do
Windows é um **subconjunto declarado**, e declarado é auditável.

### 8.1 As três armadilhas de teste que o port cria

Os oráculos não dobram, mas **não passam inteiros**:

| armadilha | por quê | o que custa |
|---|---|---|
| **os 76 oráculos de geometria** | eles medem contra o viewport do arnês, **430×900 retrato** (`tools/arnes.mjs:211`) — a forma de um celular. Uma janela Windows é paisagem | uma segunda matriz de viewport, **não** uma segunda casca. É o mesmo trabalho da paisagem |
| **os 11 JUnit de `app/src/test`** | eles testam o Kotlin (o `EspelhoHttp`, o `EspelhoPares`, o `MuxMp4`) | morrem com o Kotlin; o que sobra de lógica em C# precisa de xUnit, ou de um oráculo de Node puro que não dependa de plataforma |
| **os de Node puro que leem o Kotlin por TEXTO** | `ponte-guarda-host`, `invariantes-shell` e os vizinhos leem `NativeBridge.kt` com regex | reescritos para a nova superfície, ou passam a valer só para o Android |

**A conta que o operador faz:** o Android é hoje o app inteiro, e o Windows
seria sempre o segundo. Se o Windows rodar com os grupos 1–4, 6–8 e 10–12 e as
fases 1–3, ele atende ao culto e não cobra paridade. É o desenho que o estudo
recomenda.

---

## 9 · O que decidir (as seis perguntas)

Nenhuma destas dá para responder sem o operador, e cada uma muda o custo:

1. **Quem usa o PC?** Só ele, preparando o acervo em casa — ou a igreja, no
   culto? *(decide onde a fase 1 termina)*
2. **O PC substitui o celular no culto, ou convive com ele?** Substituir pede o
   YouTube; conviver pode parar na fase 1.
3. **Quantos Windows?** Poucas máquinas com ele instalando, ou qualquer igreja
   baixando do site? *(decide a assinatura: zero ou US$ 150–300/ano — 5.5)*
4. **Aceita que o YouTube chegue depois?** É a fase 2, e é a única parte
   realmente cara.
5. **Casca com cromo próprio (B) ou o caminho barato (D)?** A (B) parece um app
   de verdade; a (D) chega antes e reaproveita o desenho do servidor que já
   existe, mas abre uma janela do Edge.
6. **A paisagem entra junto?** A recomendação deste estudo é **não**: ela é lote
   de web, serve tablet e celular deitado, e não deve esperar o Windows
   (verbete 13.3).

---

## 10 · Riscos

### 10.1 Os que nascem do código (achados na leitura, não no gosto)

| # | risco | gravidade | onde nasce |
|---|---|---|---|
| 1 | **As Promises resolvem por expressão JavaScript montada à mão.** O Android faz `evaluateJavascript("__avResolve(id, <json>)")`; no WebView2 não há esse caminho (`ExecuteScriptAsync` devolve string e não espera). Reimplementar mal ressuscita o defeito histórico: string crua que vira código, e a Promise que **fica pendurada para sempre** quando um campo não sobrevive à ida e volta | **alta** | `NativeBridge.kt:2443-2451`; `PONTE.md:133-155` |
| 2 | **O privilégio do Controle é o `host = null` por WebView.** No Android a ponte injeta em TODA página carregada; no WebView2 o host object é por frame/origem. Se a guarda não for refeita, **o telão ganha `pickFolder` e até `espelhoLigar`** — abre um servidor na rede da igreja | **alta** | `NativeBridge.kt:361,1444,2371`; invariante 9 |
| 3 | **Os handlers dinâmicos não têm host virtual.** O mapeamento do WebView2 é só de pasta; `/saf/<token>` e `/r2img/` viram `WebResourceRequested` — e o `/saf/` tem teto de 2 GB, que o web já contorna com `?r=` | média | `WebViewFactory.kt:43,89-97`; `SafPathHandler.kt:75,118` |
| 4 | **O banco do web guarda uma tree URI do SAF** com permissão persistida. No Windows não há token de permissão: ou a pasta é repedida no primeiro uso, ou os tokens precisam sobreviver ao processo | média | `MainActivity.kt:262,328`; `NativeBridge.kt:2035-2045` |
| 5 | **O `MediaMuxer` não tem equivalente.** O download em 1080p junta duas faixas copiando amostras; no Windows é `ffmpeg -c copy` ou um muxer em JS, com outro contrato de progresso | **alta** (é caminho crítico do YouTube) | `MuxMp4.kt:3-6,107-110` |
| 6 | **A válvula `minShell` recusa tudo em silêncio.** O bundle publicado exige `minShell` igual ao `SHELL_VERSION`; um shell Windows com outro número recusa **todo** bundle para sempre, e a única pista é uma linha do Registro | **alta** | `WebUpdater.kt:930-964`; `PONTE.md:240-266` |
| 7 | **O carimbo de `areaTransferencia` não existe no clipboard do Windows.** O desenho (descrição → carimbo → conteúdo) existe para não disparar o aviso do Android 12; sem um sinal de novidade, o link copiado é relido toda vez | baixa | `MainActivity.kt:2583-2585` |
| 8 | **O `projecaoLocal`** (`KeepVisibleWebView` + `RENDERER_PRIORITY_IMPORTANT`) é específico do Chromium do Android: o comportamento no WebView2 precisa ser **medido, não herdado** | média | `MainActivity.kt:849-890` |

### 10.2 Os que nascem da decisão

| risco | gravidade | mitigação |
|---|---|---|
| **IDB/OPFS/`BroadcastChannel` não se compartilharem entre dois `WebView2`** | **alta** — derruba a arquitetura (B) | a Fase 0 existe para isto; a (D) é o plano B |
| **`yt-dlp` quebrar sozinho** quando o YouTube mudar | alta | é a fase 2, declarada instável; o item vira LINK e o culto não para |
| **o instalador sem assinatura ser bloqueado** | alta | a pergunta 3; certificado autoassinado nas máquinas da igreja |
| **duas cascas apodrecerem** (o Android evolui, o Windows fica atrás) | média | desfecho inofensivo + o Windows como subconjunto assumido (seção 8) |
| **o Edge não estar instalado** (só na opção D) | média | a (B) não depende dele |
| **o voluntário apertar F5 no meio do culto** (só na opção D) | média | a (B) não tem F5 |
| **o projeto morrer no meio** | média | as fases são entregáveis por si; a (E) é útil sozinha |
| **o Windows 10 sair de suporte** (14/10/2025) | baixa | o WebView2 roda no Windows 10; a casca não usa nada exclusivo do 11 |

---

## 11 · O que este estudo NÃO fez

- **Não prototipou nada.** A Fase 0 é a primeira coisa a fazer, e ela é barata.
- **Não mediu o `yt-dlp` num Windows de verdade** — o custo da fase 2 é
  estimado pelo tamanho do código que ele substitui (2.767 linhas), não por uma
  prova.
- **Não estimou horas nem datas.** O projeto não trabalha assim (as estimativas
  envelhecem), e a unidade aqui é a fase com critério de pronto.
- **Não tratou da paisagem** — ela é lote de web independente (verbete 13.3) e
  serve tablet e celular deitado antes de servir o Windows.
- **Não contou quantas pessoas usariam o Windows.** Esse número não existe no
  repositório: o farol conta instalações de APK, e o levantamento teria de vir
  do operador ou do site.
- **Não avaliou publicar na Microsoft Store** além da linha da tabela 5.5.
