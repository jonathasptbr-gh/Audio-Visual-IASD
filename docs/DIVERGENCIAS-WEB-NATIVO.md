# Divergências entre o caminho web e o nativo

Cada ponto em que o app nativo difere do navegador, com o porquê, os nomes e as
medidas — e as seções de compartilhamento, microfone, botão voltar, teclas de
volume, espelhamento × Cast e som do espelhamento. O `CLAUDE.md` guarda a tabela
curta e as regras que se quebram sem abrir este arquivo.

> **Movido do `CLAUDE.md` na revisão A2 (2026-10-30), sem mudança de texto** (só os links relativos e o nível dos títulos). No núcleo ficou um resumo com o link para cá. "Acima", "abaixo", "esta seção" e as invariantes numeradas falam do `CLAUDE.md`, de onde este texto veio.

## A regra de escrita e a tabela

**Regra de escrita:** toda guarda é `if (!window.__NATIVE__) { …web… }`, nunca o
inverso como caminho principal. O navegador é o padrão; o nativo é a exceção que
se declara. É assim que a base continua rodando nos dois contextos — e é assim
que ela é desenvolvida e testada fora do aparelho.

> As colunas dizem **o que difere**. O *porquê* de cada escolha está no lote que
> a criou: `grep -n "<termo>" docs/HISTORICO.md`.

| Ponto | Navegador | App nativo |
|---|---|---|
| Service worker (`sw.js`) | — | **não existe no bundle** (v5.48). Assets já são locais; recarregar o WebView do telão em culto é o que não pode acontecer. Atualizar é papel do OTA |
| `#startBtn` "Ligar Sistema" | destrava autoplay | **oculto** (`mediaPlaybackRequiresUserGesture = false`; TV não recebe toque). **Oculto também no papel `tela`**, pela razão oposta: lá há política de gesto, mas o gesto é do "Ativar esta tela" — este só se esconde, e gastá-lo perde o único toque. Quem o desliga é `display.js`, pelo PAPEL e em TODA carga (a regra morava no `montarEntrada()` do `tela.js`, que a recarga com sessão viva não chama) |
| Áudio bloqueado | segue mudo + retentativas | **recuperação desativada no `onBlocked`** — sem política de gesto, `NotAllowedError` só pode ser falso positivo |
| Pastas do dispositivo | `showDirectoryPicker()` | **SAF** — a File System Access API não existe no Android |
| Compartilhamento | **não existe** (vinha do `share_target` + SW, ambos removidos) | **`intent-filter`** (`ShareIntake.kt`), só `content://` — ver abaixo |
| Link do YouTube COPIADO | **não existe** (`navigator.clipboard.readText()` pede permissão e exige gesto — o oposto do que este caminho é) | **oferecido na abertura e na retomada** (`areaTransferencia`, shell 48). COPIAR NÃO É UM PEDIDO, então há uma PERGUNTA antes e só o "sim" entrega o link ao `importShare` — que dali em diante é o mesmo código do share. A pergunta é o que torna isto seguro no Modo Fácil, onde um link compartilhado vira transmissão SEM perguntar. O aviso do sistema do Android 12+ é pago **uma vez por link copiado**, nunca por retomada: o shell compara o CARIMBO da descrição antes de ler |
| Link do YouTube compartilhado | vira item de LINK, que só o app resolve | avançado: as MESMAS quatro escolhas da busca (tocar · playlist · Cronograma · Favoritos + vídeo/só-áudio + teto). Simplificado: sem pergunta, **download e projeta** — ali o link É um "tocar agora" (era transmissão direta até a v1.7.2). Falhando: item de LINK, resolvido no toque seguinte (`resolverLinkYoutube`, que também baixa) — um link compartilhado nunca se perde |
| Destino de um item | uma escolha por vez | **VÁRIOS destinos de uma vez**, método único: toda opção da folha (as três listas **e** o "Tocar agora") é selecionável de corpo inteiro, e um confirmar sempre visível executa. Um vídeo do YouTube é baixado UMA vez para dois destinos. Importação e share abrem a mesma folha com o Cronograma já marcado; desistir entra no Cronograma. Ver `docs/ARQUITETURA-WEB.md`, "UM item, VÁRIOS destinos" |
| Onde o share aterrissa | idem (mesmo `importShare`) | **`focarImportado`**: fecha popups e seleção; projeta na hora no simplificado (item vai para a prateleira `avulsos`, que não tem lista visível) ou vai ao Cronograma no avançado. A preview em tela cheia só é encerrada se houver telão |
| Estado do telão (Configurações) | atalho `window.open('../display/')` | **indicador ao vivo**, desabilitado como botão |
| Botão de cast da preview | oculto | `AVNative.openCast()` → seletor de espelhamento (ver abaixo) |
| **Escolher a saída de áudio** | **não existe** — o navegador não tem como abrir tela de sistema nenhuma | tile **"Saída de áudio"** em Configurações (shell 73): `abrirSaidaDeAudio` → o seletor do SISTEMA. **ELE ABRE, NÃO ROTEIA**, e o `title` diz isso: escolher o aparelho de saída é `@SystemApi` atrás de `MODIFY_AUDIO_ROUTING` (`signature|privileged|role`) — ver o espelhamento, que já levantou isso. Pedido do operador **sabendo** que a notificação de mídia já traz o seletor (*"o que eu quero é um atalho mesmo no próprio app, nas configurações, assim fica claro as opções"*): a porta que existe é invisível para quem não a conhece. A cadeia é a do `pickCastIntent` — do específico ao genérico, alvo não documentado — e difere dele em DOIS pontos: o último candidato é constante PÚBLICA (`ACTION_SOUND_SETTINGS`), então ela tem PISO; e ela **tenta TODOS**, em vez de escolher um e desistir, porque um candidato que RESOLVA mas RECUSE derrubaria a cadeia inteira. **O primeiro é a API PÚBLICA `MediaRouter2.showSystemOutputSwitcher()`** (API 34, v1.13.16: o MESMO diálogo, pelo caminho que o sistema oferece a terceiros, conferido pelo foco e lembrado por candidato como o broadcast). **O segundo é um BROADCAST** (o diálogo do SystemUI, a lista que o ícone da notificação de mídia abre) — a v1.9.9 só sabia `startActivity` e por isso caía no painel de volume. **E ELE É CONFERIDO PELO FOCO DA JANELA, 800 ms depois** (v1.9.11): `sendBroadcast` não devolve desfecho, quem recebe pode ENGOLIR em silêncio, e foi o que aconteceu — a existência do receptor responde *"há quem receba?"*, não *"a janela abriu?"*. Com o foco ainda no app, a cadeia segue do candidato seguinte, e o tile deixa de poder ficar mudo. **E O ENGOLIDO É LEMBRADO POR `versionCode`** (v1.9.12): onde o desfecho já foi medido a espera é pura, e o operador a pagava em todo toque — um APK novo re-mede UMA vez, senão um aparelho que passasse a permitir ficaria excluído para sempre. O bloqueio sai no Registro em DUAS linhas (a do candidato e a do último toque), senão *"o app deixou de tentar"* seria estado invisível. O alvo escolhido vai ao REGISTRO e só lá — e desde a v1.9.10 a **CADEIA INTEIRA** vai junto, um candidato por linha com a ação, o tipo e o componente (ou *"não existe neste aparelho"*): saber qual PEGOU não é a mesma pergunta que quais EXISTEM, e sem a segunda um aparelho que abre a tela errada não é diagnosticável a distância. **E com o espelhamento no ar ele não resolve o vazamento**: o áudio do Miracast é `REMOTE_SUBMIX`, a mistura do aparelho inteiro, e a combinação não foi medida em aparelho |
| **Recolher a prévia** | idem (é `assets/web/` inteira) | **uma SETA no topo da própria prévia** (v1.11.7; era o tile "Imagem da prévia" de Configurações, v1.9.9) que recolhe a prévia em **MAIS UMA LINHA DO DECK** (v1.13.10, pedido do operador: *"o colapso da preview vai simplesmente se transformar em uma outra linha, com os botões que antes estavam na preview"*) e carrega junto a economia de processamento de um celular fraco. **A GRADE É A DO TRANSPORTE:** a prévia ocupa a coluna do meio do deck, que mede exatamente `5·--deck-col + 4·--deck-gap`, então cinco colunas `1fr` dão cinco células de `--deck-col` sobre a playlist, ⏮, ▶, ⏭ e o parar — MUDO · CORTINA · SETA · CAST · TELA CHEIA, coluna FIXA (sem cast, no navegador, a quarta fica vazia). **O BOTÃO É O `.t-btn`** (`--surface`, `--radius-btn`, `--text`, ícone `--icon-md`, sem as sombras do palco, `--press` do deck) e o estado vira superfície (cortina/mudo `--btn-danger` + `--danger-strong`, bloqueio `--btn-warn` + `--warn`, cast `--ok-fill` + `--ok`). **O SELO DE CAMADAS E O DESFAZER DO GIRO NÃO ENTRAM NA LINHA:** no lugar, um PONTO `--danger-strong` no canto da seta (o tamanho da `.lv-badge`) quando um dos dois estaria à vista — a pergunta é a deles, `:has(:is(#pvCamadaBtn, #pvGiroBtn):not([hidden]))`, sem JS; expandida, os dois seguem como sempre. **E ANIMA:** só o TOQUE (`setEconomiaPreview` mede antes e anima depois; abertura e troca de destino assentam no ato) — WAAPI na `height`, no fundo/moldura/raio da prévia e no fundo/cor de cada botão, mais o deslocamento contado da ÂNCORA do botão (no Y a do aberto, topo ou base; no X a da linha, borda esquerda, direita ou centro), e desvanecer das camadas; `--dur-lenta`, sem movimento com `prefers-reduced-motion` ou em tela cheia. `pv-animando` estica a trilha única e prende cada botão à borda dele enquanto a altura corre. **Oráculo que clica a seta e mede NO ATO abre o contexto com `reducedMotion: 'reduce'`** (ou espera as animações assentarem, como o `controles-layout`); o caminho animado é do `previa-animacao`. **TRÊS coisas, e as duas últimas não são a mesma régua**: a MARCAÇÃO (`economiaPreview`, do banco), a GEOMETRIA (`pv-recolhida`, que segue a marcação no ato, também sem TV) e o VEREDITO da decodificação (`economiaAtiva` = a marcação **e** `haDestinoDeProjecao()` **e** não estar em tela cheia, que é o que pára o `<video>` pelo `stage.setSuspenso`). Sem destino a prévia É a projeção: a decodificação não pára e a seta continua clicável (v1.10.10) — o `title` diz que só vale com TV ou computador conectado. **O CSS recolhido fica de fora da TELA CHEIA e do CARTÃO DE ESPERA** (`:not(:fullscreen)`, `:not(:has(.pv-busy.on))`): sem a primeira o telão em tela cheia sem TV fica em branco, e o cartão (a única porta de cancelar um download) não cabe numa linha de botão. **O Modo Fácil NÃO TEM PRÉVIA (v1.11.11)**: a seta não é desenhada lá (ver a linha seguinte). **No avançado ela SAI da frente do cartão** (`visibility: hidden` enquanto `.pv-busy.on`: no centro do topo ela cobria o texto do download), e o cartão sai SEM fade quando a prévia volta a recolher. Tempo, barra, letra, transporte, `MediaSession`, o comando ao telão e o avanço da fila ficam INTEIROS; os três caminhos do avanço seguem cobertos e nenhum é a prévia (`media-ended` do telão, a rede de segurança do `tela-status` da v1.8.48, e sem os dois a economia não está ativa) |
| Retomada do telão ao reconectar | idem (`resendSceneToDisplay`) | **só reenvia o que ESTAVA no ar** — a pergunta é `midiaNoAr`, nunca `currentId` (que sobrevive ao stop de propósito, para o ▶ repetir a faixa). Telão vazio também é estado: restaurá-lo é não mandar nada |
| Girar a mídia | idem (comando `rotate`) | tile **"Girar no telão"** em Configurações, 90° por toque — o nome diz ONDE, porque "Girar" sozinho se lê como o giro da INTERFACE (v1.4.41). O motor TROCA O EIXO da caixa antes de girar, para o `object-fit` medir o retângulo em que a mídia vai de fato aparecer |
| **Modo Fácil: a TELA PRINCIPAL** | idem (é `assets/web/` inteira) | **SEM PRÉVIA E SEM "Buscar música"** (v1.11.11), **E A BARRA DE BUSCA SEMPRE À VISTA** (v1.11.12). Pedidos do operador: *"a própria tela conectada já será o visor"* · *"mantenha a barra de buscas da biblioteca sempre visível … o foco na caixa de buscas muda a tela principal do auxiliar de leitura para a biblioteca"*. **É a MESMA janela `#hymnSearchPopup`** (fixa), pousada sobre o espaço `#simpleBarra` (altura `--lib-bar-h`) entre o cabeçalho e a zona de leitura, e com tela conectada (`body.simples-barra`) ela tem TRÊS estados, escolhidos pela pergunta do Parar — `simplesBibliotecaDocada()` = Modo Fácil + com tela + `!haOQueParar()` (pausar não troca de tela; cena de roteiro conta como "no ar"): **PRINCIPAL** sem mídia no ar **OU com mídia que não usa o auxiliar de leitura — sem letra e sem páginas: vídeo, imagem, áudio sem letra (v1.11.21, `simplesSemLeitura`, a MESMA pergunta que desenha a placa, `leituraDoModoFacil`)** (`simples-principal`: aberta, cobrindo espaço + leitura, que fica escondida por baixo; sem ✕, sem foco, o voltar do Android NÃO a fecha, e `closeHymnSearch` REINICIA em vez de fechar — o corpo não pode ficar vazio durante um download); **FECHADA** com mídia no ar (a camada tem a altura da barra e o resto é recortado — a barra e o campo à vista, a leitura abaixo); **ABERTA SOBRE A LEITURA** (o foco no campo chama o `openHymnSearch` de sempre; o ✕ e o voltar a fecham). As quatro medidas saem do layout (`medirCorpoSimples` → `--simple-barra-topo`, `--simple-corpo-*`, nunca escritas no CSS) e só o `bottom` da camada anima. **A ESCOLHA É UMA COREOGRAFIA** (v1.11.12): a linha tocada fica marcada (`.selecionando`) por `SIMPLE_FEEDBACK_MS`; o `closeHymnSearch` chamado no instante do toque não fecha nada quando há uma escolha fresca; depois a Biblioteca recolhe para a barra, a leitura ENTRA (`.simple-song.entrando`) e só então o campo é limpo — e se a escolha não vira mídia um vigia desfaz a marca. **A prévia NÃO muda mais de casa**: o nó fica na casa do avançado, escondido, porque o `stage` dele toca o som quando ele é deste aparelho (`tocarNoCelular`). **O que ela levava foi realocado:** o cartão de "Baixando…" (`#pvBusy`, a única porta de CANCELAR um download aqui) mora em `#simpleBusySlot`, e o ícone de cast é o `#simpleCastBtn` do cabeçalho — verde com tela, some sem tela, mesmo `abrirCast`. **O TOPO É CAST · NOME · ENGRENAGEM** (v1.11.15, uma grade de `--hit · 1fr · --hit`: o cast some sem tela e o nome continua no centro, e a badge de versão saiu desta tela); **O NOME DA MÍDIA E A BARRA DE PROGRESSO SÃO UM CARD** (v1.11.16, pedido do operador: *"onde cada seção fica em um card"*; `.simple-nowplaying`, `--panel` como a placa da letra e as teclas — não o recesso do `.nowplaying` do avançado —, **desde a v1.11.21 IRMÃO de `.simple-song` e ABAIXO da zona de leitura** (pedido do operador), fora da medida da Biblioteca, e NÃO EXISTE sem mídia no ar — `.simple:not(.com-midia)`; o vão até a placa é o das seções, `--sp-5`; sem duração a linha do tempo some da vista mas o card MANTÉM a altura, v1.12.11); **AS TECLAS SÃO PARAR · PLAY/PAUSA · NÍVEL** (v1.13.8, pedido do operador: *"fica assim: botão de stop, botão de play/pause e botão de nivel de volume/mute"*): o NÍVEL é o número do volume na cor de tecla das vizinhas e o toque é o `#muteToggle` (mudo riscado no glifo e sem o traço de curso); o − e o + saíram, e no Modo Fácil o ajuste fino é o das teclas físicas. **SEM NADA NO AR A LINHA RECOLHE** (`renderTeclasSimples`, a pergunta do Parar): espera `SIMPLE_TECLAS_ESPERA_MS` (1,5 s, o dedo ainda está ali), sai por opacidade e só então deixa o layout — a Biblioteca, tela principal, ANIMA até a base nova (medida de troca) —; volta animada quando algo entra no ar; seco com `prefers-reduced-motion`. Oráculo: `modo-simples-teclas.test.mjs`. **A+/A− SÃO DOIS FABs REDONDOS** no canto de baixo da placa da letra (`.simple-fabs` dentro de `.simple-song`, A+ em cima, sem moldura; a última estrofe rola para cima deles pela margem do último item); **SEM o botão de playlist automática** (`body.mode-simple #sorteioBtn`), **e com o SORTEIO SIMPLES no lugar dele** (v1.12.53, `#sorteioSimplesBtn`, o quadrado da esquerda da barra): sem folha e sem opções, um toque sorteia um hino CANTADO do Hinário 2022 sem os infantis (a categoria `hinario-2022` do `sorteio.js`) e o toca como uma escolha da Biblioteca (`simpleMarcarEscolha` + `simplePlaySong`); uniforme com rede, só o baixado sem ela, e APAGADO com o motivo quando não há hino que possa tocar. Oráculo: `sorteio-simples.test.mjs`. **VÍDEO SEM LEITURA ABRE A TELA CHEIA DA PRÉVIA** (v1.12.24, ver a linha "Fullscreen da preview"): a prévia não tem casa no Modo Fácil, mas a tela cheia dela é o top layer. **O QUE SE PERDE, e está aceito:** o SELO de camadas (a única saída da camada de cima) não existe no Modo Fácil — o Parar encerra tudo. **Séries:** NÃO são coleção no Modo Fácil (v1.13.15) — a raiz abre com UM bloco "Este sábado" + a data (`blocoSemanasRaiz`, `.bloco-fixo`, fora da repartição da tampa), uma linha por série que é o item virtual "vídeo da semana" e TOCA no toque; no avançado as duas seguem coleções. **A BIBLIOTECA É MAIOR** (v1.13.9, pedido do operador: *"aumentar os itens para aproveitar completamente esse vão … mesmo que saia do padrão do resto do app"*): os tokens de medida são redeclarados em `#hymnResults` (`--lib-esc` da altura da tela, `--lib-esc-fs` limitado pela largura), alvos ≥ 44px, os blocos de raiz preenchem a lista e os nomes quebram em duas linhas; o avançado não muda. Oráculos: `modo-simples-corpo.test.mjs`, `modo-simples-biblioteca-tamanho.test.mjs` |
| Som da preview | com a janela do Display aberta é muda; sem ela toca (sujeito a autoplay) | **sem tela nenhuma conectada, o som sai DESTE aparelho** (`acertarSaidaDeAudio`). No avançado é DERIVADO da conexão (`simpleDisplay` = TV **ou** tela da rede); no Modo Fácil é ESCOLHA (`tocarNoCelular`, o "Tocar neste celular" da folha de conexão), porque lá o padrão é bloquear — escolha de IDA, sem persistência, que se rearma ao fechar o app, ao passar pelo avançado ou quando uma tela entra. Com qualquer tela conectada este aparelho fica mudo nos dois modos — os WebViews dividem o processo e a saída de áudio, e a preview roubava o foco do player do telão. **E PERDER a projeção com mídia no ar PAUSA a mídia** (v1.8.50): a promessa acima vale para quem ABRE o app sem tela, não para quem PERDE a tela com o louvor no ar — o estado final é o mesmo, a intenção não. A régua é a PERDA (escrita como estado, ela pausaria o ensaio de quem nunca conectou nada) e é a perda de um DESTINO — `haDestinoDeProjecao()`, que lê a tela LISTADA e as SESSÕES de tela da rede, e **não** `algumaTelaConectada()`, que responde pela `Presentation`: com aquela, a oscilação do dongle pausaria o louvor a cada piscada do Miracast, que é uma interrupção de culto no lugar de um vazamento de segundos |
| PDF · `.pptx` · Google Apresentações | **PDF não existe**; `.pptx` funciona pelo mesmo caminho do app | **uma IMAGEM POR PÁGINA**. PDF pelo `PdfRenderer` da plataforma (`SlideDeck.kt` + `deckPages`); `.pptx` pelo renderizador de `assets/web/vendor/` (`controle/deck.js`, `import()` dinâmico + `<foreignObject>`/canvas). Daí é mídia comum, com ⏮/⏭ passando página — **e uma CAMADA desde a v1.4.28**: com um áudio no ar, o toque na apresentação a sobrepõe em vez de substituir, pela mesma porta da imagem (`mode:'image'` com um `page`), e o louvor de fundo continua tocando por baixo dos slides. **O FORMATO de cada página é decidido por ela**, nos dois caminhos e pelo mesmo número (`PAGINA_LEVE`, 512 kB): PNG na página chapada, WebP na fotográfica — MEDIDO, uma apresentação de fundo fotográfico dá 100,4 MB em PNG contra 12,3 MB. **Não há botão de "apresentação"** — entra por "Importar arquivos" (`pickDoc`: o PDF precisa que o shell abra o ARQUIVO, e `<input type=file>` só devolve bytes) ou pelo share. `.ppt` legado e `.odp` ficam de fora: ninguém sabe desenhá-los **E O VÍDEO EMBUTIDO TOCA** (v1.6.2): o `pptxzip.js` o tira do zip ANTES de abrir o arquivo — sem isso um `.pptx` com vídeo é RECUSADO (teto de entrada da biblioteca) e, passando, sairia como retângulo PRETO (o `embutirRecursos` não alcança `<video>`). Ele vira mídia presa à PÁGINA em que estava: chegar nela projeta o vídeo, e o fim dele devolve a apresentação no slide SEGUINTE |
| **Tocar agora** de vídeo do YouTube | **não toca**, e a linha do item diz isso | **BAIXA E PROJETA** (v1.7.7): o mesmo `ytArquivo` dos outros destinos, com o cartão sobre a preview e a barra de progresso cobrindo a espera. Foi TRANSMISSÃO DIRETA da v5.212 à v1.7.2, e ela saiu a pedido do operador: *"vamos abandonar o modo online direto, ele é muito instável"*, depois de travamentos a cada um ou dois segundos com o espelhamento no ar. **O preço está aceito e é o que ela existia para evitar: "Tocar agora" agora ESPERA o download** **O PERCENTUAL VAI DO TOQUE À MÍDIA TOCANDO** (v1.12.36): preparo, bytes, junção, cópia, gravação e abertura, com o peso de cada fase aprendido no aparelho (`controle/progresso.js`, `novaBarraYt`); nunca volta, nunca para (velocidade com inércia e piso, v1.12.37; freio no pouso e rede/cauda aprendidas como latência + ritmo e fixo + por MB, v1.12.38) — **exceto com a rede LENTA ou PARADA: durante os bytes ela é PRESA a eles** (v1.12.40, a fatia do download e o ritmo vivo; só um piso anda uma margem além; desde a v1.12.41 só o download ATRASADO contra o plano, `downloadAtrasado`, e a velocidade é refeita pela alvo quando o plano encolhe) —, e 100 só quando a mídia APARECE: **desde a v1.12.39 o `send` ESPERA a barra varrer até 100, no máximo 500 ms** (`revelar`, proporcional ao que falta e nada a partir do 95 — aprovado pelo operador, e o telão espera o mesmo tanto); a miniatura do vídeo saiu do caminho e é extraída DEPOIS do play (`miniaturaDepois`, `AVDB.definirMiniatura`). O que cada download fez vai ao Registro (bloco "Barra do YouTube", com quanto segurou e, desde a v1.12.40, a medida do shell de cada faixa e o veredito da lentidão) |
| **Cifra do hino** | **não existe** — sem ponte não há como buscar a página (CORS), e a aba nem é oferecida | **aba CIFRA no visualizador de letras** (shell 49): `cifraHtml` traz o HTML cru, `controle/cifra.js` o lê, e a folha aparece com transposição por meio tom. **SÓ COM FOLHA NA MÃO** (v1.8.28): sem cifra achada o botão não é desenhado — `cifraCabe` decide se vale PROCURAR, `cifraTemFolha` decide se há o que MOSTRAR. **SOB DEMANDA:** nada é baixado em lote, nada entra no bundle, e fora do acervo guardado o cache é um `Map` que morre com o app |
| Vídeo do YouTube | **não toca** | **baixado PELO APARELHO** (`YoutubeGrab.kt` + `ytFetch`) — a extração sai do IP do chip, que é o que o YouTube não bloqueia. Falhando, vira item de LINK, retentado no toque seguinte |
| Qualidade do download | — | teto escolhido pelo operador: **1080p · 720p · 480p**, no mesmo seletor de Vídeo/Só áudio. **O padrão é 720p e ele é DO OPERADOR** (v1.7.7): escolher um teto o GRAVA (`state` `ytAltura`) e ele vale para o próximo vídeo. As duas metades revogam decisões escritas — o padrão era `YT_ALTURAS[0]` (1080p) e o teto nascia no padrão A CADA ITEM —, e as duas foram pedidas por extenso. 1080p usa o `ytFetch` de sempre; só teto MENOR usa `ytFetchAte`. O degrau **"Online"** (`-1`, que guardava só o link) SAIU junto com a transmissão direta que ele alimentava |
| Resolução do download | — | **até 1080p, montando as duas faixas** — acima de 720p o YouTube entrega vídeo sem som. `MuxMp4.kt` junta com `MediaMuxer` (cópia de amostras, sem recodificar). Pares do MESMO contêiner (mp4+m4a, webm+webm na API 29+): "a melhor de cada lado" daria VP9 em MP4, que o muxer recusa **depois de tudo baixado**. Falhando, o progressivo é o piso. Requer o extrator ≥ v0.26.4 (cliente **visionOS**, que entrega adaptativas sem PO Token); as listas chegam misturadas, daí a **fila de candidatos** — ver `docs/ARQUITETURA-WEB.md` |
| **Só o ÁUDIO** em "Tocar agora" | **não toca** | baixado pelo `ytFetchAudio`, como nos destinos que guardam — a transmissão dele saiu na v1.7.7 junto com a do vídeo. Entra como `kind:'audio'` (o telão mantém o wallpaper) |
| **Só o ÁUDIO** guardado | — | **`ytFetchAudio`** (shell ≥ 23), pelo mesmo seletor Cantada/Playback. `kind:'audio'` e sem miniatura — é o *kind*, não o contêiner, que faz o telão manter o wallpaper. Único caminho sem o teto de 720p do progressivo. Fila de três candidatos na ordem do cliente que funciona, progressivo no fim |
| **Séries do YouTube** | **não existe** | **um álbum por SÉRIE** (shell 41) — ver a seção do recurso. O ITEM é um vídeo do YouTube, não faixa de hinário: mesma folha (sem "Só áudio"), "Tocar agora" transmite, download só nos destinos que guardam. Não há "baixar o álbum" (~300 MB/episódio) |
| **Manter o episódio da SEMANA baixado** | **não existe** — não há rotina de segundo plano nem coletor de referência a que pendurar um detentor | **SEM SELETOR, sempre ligado** (v1.8.87; a caixa de marcação saiu na v1.11.10, a pedido: *"faça com que seja o padrão do app sempre baixar os vídeos da semana"* — a chave `serieAuto` de um aparelho antigo fica no banco e ninguém a lê): o episódio do sábado desce sozinho no **Wi-Fi confirmado, ou com "Dados móveis" ligado nas Configurações** (`redeLiberadaParaBaixar`, não "não é celular" — são ~300 MB que ninguém pediu agora, e por isso o "Dados móveis" nasce DESLIGADO, v1.11.0), na qualidade do operador, e as semanas passadas saem do aparelho. O álbum de série **continua não retendo arquivo**: o que retém é a lista `serie` de `db.js`, um detentor de tamanho UM por série, e **ela só ENCOLHE com o substituto na mão** — a ordem "baixar, depois limpar" não bastava, e com o download falhando (o caso normal de segunda a sexta) a limpeza levava os DOIS episódios. Sem Wi-Fi confirmado e sem "Dados móveis" a rotina não roda, e **a linha de status do card DIZ isso** (`serieAutoAviso`): `connection.type` responde `'unknown'` em boa parte dos aparelhos, e um no-op silencioso seria um recurso que nunca roda, sem nada na tela. **E "Wi-Fi confirmado" é o tipo que o aparelho INFORMA, nada além:** o hotspot de outro celular chega como `wifi`, e o operador decidiu que é assim mesmo (v1.11.6: *"O hotspot está corretamente sendo classificado como wifi comum, deixe assim mesmo"*) — não existe tratamento de rede tarifada, e não se acrescenta um (nem `isActiveNetworkMetered`, que seria `SHELL_VERSION` 78 e Release) sem pedido novo dele |
| Buscar no YouTube | não existe: abre o YouTube numa aba | **busca dentro da Biblioteca** (`ytSearch` → `YoutubeGrab.pesquisar`), resultados na mesma lista e mesma folha de destinos. Em **português**: passar localização ao `NewPipe.init` NÃO resolve (o serviço filtra por uma lista que só tem `en-GB`) — quem resolve é o `forceLocalization` do próprio `Extractor`. Iframe é recusado pelo `X-Frame-Options`; a API oficial exigiria chave com cota |
| Link para fora do app | `window.open` | **`openExternal(url)`** → `ACTION_VIEW` em tarefa própria. O WebView RECUSA navegar para outro origin (invariante 2): sem esse método um link externo não faz nada, nem erro no console |
| Sem tela conectada (simplificado) | mesmo bloqueio, com a janela do Display no lugar da `Presentation` | **modo bloqueado**: cortina embaçada, seção de conexão no centro, saída para o avançado na frente. **Não é incondicional**: o "Tocar neste celular" da folha (`tocarNoCelular`) desbloqueia e manda o som para este aparelho. **Caminho só de IDA e sem persistência**: o bloqueio se rearma ao fechar o app, ao passar pelo modo avançado (`setAppMode`) ou quando uma tela entra — e por isso o botão SOME depois do toque, em vez de oferecer o desfazer. **A EXCEÇÃO (v1.11.19): a ida avançado → simples com mídia no ar e SEM tela LIGA o "tocar neste celular"** (`setAppMode`, só com `midiaNoAr` — a pausada conta —, e valendo só o uso atual): o operador que estava tocando aqui no avançado não tem o som cortado nem a cortina por cima; sem mídia no ar o gate bloqueia como sempre, e com tela a escolha nem é ligada |
| Fullscreen da preview | `requestFullscreen` + Screen Orientation | idem, com trava de paisagem **nativa** (`onShowCustomView`). Os controles são botões que o toque acende e 4 s apagam — não gestos (v1.0.7, ver `docs/arquitetura/CONTROLE.md`) —, e **UM MODELO SÓ NOS DOIS MODOS** (v1.12.42, pedido do operador; era uma coluna na lateral direita): o **play/pause GRANDE no CENTRO** (60 px), o **⏮/⏭ ao lado dele** (só no avançado), o **SAIR no canto INFERIOR direito** e a **CORTINA no SUPERIOR direito** (só no avançado). A camada deles não recebe toque, e os botões só recebem ACESOS (`.pv-fsctl.visivel .pv-fab`): o `.pv-fab` declara `pointer-events: auto`, e sem a regra um toque no meio da tela apagada acionava o play/pause escondido. É uma das duas superfícies em que ⏮/⏭ ainda tem DOIS eixos (a outra é a notificação): aqui não cabe um par de botões de slide, porque sem TV o que se pinta nesta tela a congregação vê **A MUDANÇA DE VOLUME acende uma barra** (`#pvVolume`, v1.12.24, nos dois modos): `mostrarVolumeDaTelaCheia` a partir de `applyVolume` e `peekVolume`, número do APP (o nível na custom property `--nivel`), some em 2 s, tokens do PALCO — **EM PÉ NA BORDA ESQUERDA** (v1.12.41 no Modo Fácil, nos dois desde a v1.12.42: o topo é do título). **OS BOTÕES TÊM DUAS COMPANHEIRAS** (v1.12.41 no Modo Fácil, nos dois desde a v1.12.42): o NOME da mídia numa faixa no topo (`#pvFsTopo`) e a LINHA DO TEMPO numa faixa na base (`#pvFsBase`: decorrido · faixa · duração; tocar salta, arrastar procura, UM `seek` ao soltar — o mesmo `ligarBarraDeTempo` da barra do card, com o `seeking` compartilhado), as duas com a `.visivel` dos botões, o relógio dos 4 s parado durante o arraste, e a linha some sem duração (`renderFsTempo`, nos dois modos). As faixas reservam o recuo do botão do canto (`--fs-recuo`). **NO MODO FÁCIL ela é a tela do VÍDEO** (v1.12.24): um `kind: 'video'` sem leitura entrando pelo `send` a abre (`acertarTelaCheiaDoVideo`) **só SEM destino de projeção** (`haDestinoDeProjecao()`, v1.12.26: com TV ou tela da rede a tela conectada é o visor, e uma que ENTRA com ela aberta a fecha), o fim, o Parar ou a troca por outra mídia a fecham — só a que ela mesma abriu (`fsDoVideo`) —, a tela cheia perde a cortina e o ⏮/⏭, e a `.bottombar` volta a ter caixa enquanto ela dura (ancestral `display: none` deixa o top layer 0×0). O pedido exige ATIVAÇÃO DO USUÁRIO (~5 s, também no WebView): o vídeo que baixa antes de tocar chega tarde — **por isso, NO APP, ela é a TELA INTEIRA (v1.12.34, shell 80)**: a `.preview` em `popover` (top layer, sem ativação) com `.pv-inteira`, e o shell gira para paisagem e esconde as barras (`AVNative.telaInteira`); a API de tela cheia fica para o navegador e para o ⛶ do avançado. A porta de volta é o `#simpleFsBtn`, a coluna da direita do card do nome (ao lado das DUAS linhas) |
| Botões físicos de volume | o navegador não os recebe | **interceptados**, ligados ao fader do deck — e é isso que mantém o painel de volume do Android FORA da projeção (ver abaixo) |
| Captura de áudio ou vídeo | o navegador pergunta | **não existe caminho nenhum** desde a v1.8.89 (ver a seção abaixo): o microfone ao vivo era o único, e a câmera sempre foi **negada, sempre**. O `onPermissionRequest` do `ControleChromeClient` FICOU, negando **com log**: um WebView sem ele nega em silêncio, e o próximo que precisar de mídia aqui descobriria a armadilha do zero |
| Navegação | idem (uma tela e duas folhas) | **UMA TELA e DUAS FOLHAS** (v1.5.0): o Cronograma é a tela única; a Bíblia e as Ferramentas são folhas dele, abertas pelas portas do rodapé (Bíblia · Ferramentas, ícone à esquerda do nome; o Importar mora na trilha 1 da barra do topo desde a v1.13.5, e na LISTA a folha de Ferramentas tem as bordas da porta, não tem cabeçalho e se fecha por uma SETA no lugar exato da porta (v1.13.6), e se alarga ao abrir uma ferramenta, cujo cabeçalho tem o título e o ✕ e nenhum voltar); a Biblioteca é uma JANELA DE TELA CHEIA que sobe levando a barra de busca junto (**no Modo Fácil ela é o CORPO da tela quando não há mídia no ar**, ver a linha "Modo Fácil: a TELA PRINCIPAL"), e a barra é a CABEÇA dela — fechada, ela repousa no TOPO da caixa de controles (v1.5.2), sem pintar nada, com os dois quadrados no tom E na largura dos botões do transporte (v1.5.5) e o campo branco com borda entre eles; aberta, ela para no topo da TELA, e é por isso que o teclado deixou de cobrir o campo. A janela vai do topo até a LINHA DA BARRA (v1.5.4): fora disso não há camada — nem pixel, nem scrim, nem toque —, então os controles continuam à vista e alcançáveis com a Biblioteca aberta, e a barra de status é o DESTINO da abertura, não um recuo que viaja acima da barra ao fechar. Aberta ela é uma JANELA como as folhas de Bíblia e Ferramentas — `--panel`, `--radius-card` e uma FRESTA acima dos controles, para se ver onde a lista acaba (v1.5.7); fechada não tem raio nem fundo, porque ali o que se vê é a barra. **E a camada dela é o CHÃO da pilha, não o teto** (`z-index: 190`, v1.5.6): ela é a única deste app que existe SEMPRE, então empatada em 200 com as outras quem decidia era a ordem do documento — a barra pintava sobre Configurações e sobre a playlist, e o que se abrisse dos controles subia ATRÁS da Biblioteca. **Sem caixa de controles na tela a janela vai até a base** (o teclado com a Biblioteca aberta, e o Modo Fácil): o recorte protege os controles, e sem controles ele só corta. Saíram a faixa de abas, o vazado deslizante, o carrossel horizontal e o `switchTab` |
| Botão voltar | — | **fecha o que estiver aberto** antes de minimizar (ver abaixo) |
| Controles fora do app | — | `MediaSession`: notificação, tela de bloqueio, botões de mídia |
| Download minimizado | a aba continua baixando | **foreground service + wake lock**; sem isso o processo é congelado |
| **Levar a biblioteca para outro aparelho** | **não existe** (não há SAF nem canal de bytes: um `<a download>` sobre um Blob de gigabytes não é caminho) | **um arquivo `.avpkg`** (shell 63) — ver a seção do recurso. **Exportar e Importar são UM tile, "Transferir"** (v1.11.7), que abre uma janela com os dois botões; a LISTA da biblioteca atual já está à vista quando a janela abre (v1.11.9: as caixas escolhem o que o Exportar leva E o que o Importar traz do pacote — v1.11.12: tirar uma marca estreita a importação, e o arquivo é consumido como sempre —, a nota acima dos botões diz o peso, e o aparelho novo lista os hinários ("nada baixado neste aparelho") e as séries ("sem vídeo da semana baixado") para a seleção ter o que marcar; **uma SÉRIE leva só o VÍDEO DA SEMANA** — o episódio que a lista de retenção `serie` guarda, e nunca a pasta do álbum, ver `docs/recursos/PACOTE.md`), os dois botões moram na base da janela (o toque no Exportar é a confirmação; o Importar abre o seletor na hora) e o tile da grade é o SINAL do trabalho com a janela fechada (aro, "pronto para enviar"). Com trabalho andando ou um pacote pronto a lista TRAVA. Exportar abre direto o SELETOR DE COMPARTILHAMENTO (shell 67), que é por onde ele de fato atravessa (Quick Share): o pacote é escrito no armazenamento próprio e oferecido ali. Não cabendo — a conta é `espaco − bytes > 512 MB`, feita pelo WEB —, ele volta ao "Salvar como" do sistema, que é o caminho do cartão. Nos dois, os bytes vão pelo canal `__avPacote`; importar entra por `pickDoc` e lê o arquivo por JANELAS (`/saf/<token>?r=<ini>-<fim>`, shell 64) — nunca inteiro, porque o caminho `/saf/` tem teto de 2 GB e um `resp.blob()` de quinze gigabytes não cabe em lugar nenhum. **Só ACRESCENTA**: nada que já esteja no aparelho é substituído |
| **Compartilhar o link do app** | `navigator.share`, onde o navegador o tiver | **`compartilharTexto`** (shell 63) → `ACTION_SEND` + `createChooser`. O WebView do Android **não** implementa a Web Share API, então este era o único caminho — e sem ele não havia, de dentro do app, forma nenhuma de passá-lo adiante |
| Abertura do app | a página pisca igual, e ninguém tem o que fazer a respeito | **a CORTINA** (`#splash`) mais o `data-tema` escrito no `<head>` antes do primeiro quadro. O prazo que a levanta mora no mesmo script inline, e não no `controle.js`: um bundle que nem chega a ser parseado tem de terminar com o app À VISTA. **E ELA É SEMPRE NO MODO FÁCIL** (v1.11.7, pedido do operador: *"sempre iniciar o app no modo simples"*): o modo mora em `sessionStorage`, que atravessa só a recarga do documento (a atualização aceita, o `location.reload()` da importação) e morre com o app. Consequência dita: um compartilhamento recebido com o app FECHADO cai no ramo do simplificado (link do YouTube vira "tocar agora" sem pergunta; arquivos vão para `avulsos` e projetam) |
| Atualização da base web | recarregar a página | **OTA** |
| Contagem de uso | **não existe** — nada é contado num navegador, e não há chave nenhuma a desenhar | **o farol** (shell 58): uma busca por dia a um asset de contagem, agregada e sem id. Pega carona na ronda do OTA. **SEMPRE ATIVO desde a v1.4.42**: a chave de exclusão saiu (com o `farolContar` da ponte), e o que sobra é o BUILD DEBUGGÁVEL, que acende num contador separado por construção. O preço está no painel — a página de alcance avisa que os números incluem o uso próprio |
| Atualização do APP | — | **o app baixa e instala**; o diálogo do Android é obrigatório e está certo que seja |
| Tema claro × escuro | CSS + `localStorage`; `theme-color` tinge a barra | idem **mais o cromo do sistema**: `temaClaro` vira os ÍCONES das barras e guarda o tema EFETIVO para o `windowBackground` do PRÓXIMO lançamento (recurso de APK é resolvido antes de existir JS) |
| **Telão nas telas da rede** | **não existe** (navegador não abre `ServerSocket`) | servidor HTTP no celular + SSE + `/m/<token>` — ver a seção do recurso. A rede é a Wi-Fi de que o celular é CLIENTE **ou o PONTO DE ACESSO dele mesmo** (v1.4.1): nenhuma das duas precisa de internet |
| `__AV_ROLE__` | `'controle'` / `'display'` | **terceiro valor, `'tela'`** — o mesmo `/web/display/` num navegador da LAN. Seguro por construção: as leituras do papel comparam `!== 'controle'`, e **nenhum caminho testa `=== 'display'`** |

## Compartilhamento: ponto de entrada exportado valida o que recebe

`ACTION_SEND` é público — qualquer app dispara. Três regras em `ShareIntake`:

1. **Só `content://`.** `openInputStream` também atende `file://` e
   `android.resource://`, e a leitura acontece com o uid DESTE app: um app com
   `targetSdk` antigo podia mandar `file:///data/data/br.org.iasd.av/shared_prefs/…`
   e o conteúdo virava item projetável na TV. A autoridade do próprio app também
   cai fora.
2. **O intent é CONSUMIDO depois de lido** (`consumeShareIntent`) e o parse só
   roda com `savedInstanceState == null`. A única saída do app é
   `moveTaskToBack`, então a Activity nunca é finalizada e `getIntent()`
   devolveria o mesmo `ACTION_SEND` para sempre — qualquer recriação (tamanho de
   fonte ou idioma, nenhum dos dois em `android:configChanges`; ou voltar pelo
   Recentes) importaria outra cópia integral do arquivo, sem aviso e sem desfazer.

## O microfone ao vivo SAIU (v1.8.89) — e o que fica é a porta

Pedido do operador: *"remova a opção de microfone direto para o telão, que
temos nas ferramentas"*. Ele era o **ÚNICO caminho de captura do app**, e o
rodapé da folha de Ferramentas era a única porta dele.

**Saíram do WEB:** `renderMic`/`sendMic`/`renderMicUI`, o `blocoMicrofone` e o
`micRegistrar` do Registro, o `haOndeReproduzirMic`, o
`startMic`/`stopMic`/`setMic` do `display.js` (com a escada de três degraus e a
guarda `if (TELA) return`), o `mic-status` nos dois sentidos, e
`requestMic`/`micDiag` do `native.js`. Foram junto o `refreshDiversos()` da
TRANSIÇÃO do telão em `renderDisplayStatus` — ele existia só para o botão
APARECER quando a TV entrava no meio do culto, e nada mais naquela folha depende
de haver projeção — e três tokens da paleta (`--live`, `--on-live`,
`--live-soft`): a barra de push-to-talk era o último consumidor dos três, e era
ela que justificava haver um grau ACIMA do `--live-fill`.

**O KOTLIN FICA, e é o lado seguro:** `MicChromeClient`, os dois
`@JavascriptInterface` e a permissão `RECORD_AUDIO` só saem instalando um APK.
Encolher pelo WEB primeiro não custa nada ao aparelho — é a ordem inversa (base
web nova contra APK velho) que precisa de `shellTag`.

**A ESCADA DE TRÊS DEGRAUS ESTÁ ESCRITA no `tools/sem-captura.test.mjs`**, e
não por nostalgia: com `echoCancellation` o Chromium abre o `AudioRecord` em
`VOICE_COMMUNICATION`, e o Android RECUSA essa sessão quando a saída de áudio
está em outro caminho — o app **com o espelhamento ligado**, isto é, o modo
normal de um culto com TV. Era o SEGUNDO degrau (sem processamento) que a fazia
abrir, o terceiro era `true` cru, e depois deles vinha o pedido pelo `deviceId`
(o `default` do Chromium é uma entrada virtual, e falhar nele não é falhar no
microfone). **Quem trouxer captura de volta traz também a escada, a guarda de
papel e o dreno do `mic-status` — ou traz o defeito de origem junto**, e aquele
oráculo é a porta que o cobra: nenhum `getUserMedia` em arquivo nenhum da base
web.

**A CÂMERA continua negada, sempre** — o `onPermissionRequest` do
`ControleChromeClient` FICOU, negando **com log**: um WebView sem ele nega em
silêncio, e o próximo que precisar de mídia aqui descobriria a armadilha do
zero.


## Botão voltar: fecha antes de minimizar

O voltar **nunca** encerra a Activity — no fim da fila só `moveTaskToBack`, com
sessão e `Presentation` vivas. **Quem decide é o lado web** (`window.__avBack`,
invariante 5); `MainActivity.handleBack()` pergunta e obedece. A ordem é do mais
efêmero ao mais permanente:

1. diálogo modal → **1.7. a gaveta dos cronogramas** (v1.12.54; o menu ⋮ que
dividia o degrau saiu na v1.12.55) → **1.8. a gaveta dos itinerários** (v1.13.2,
a irmã no painel do Itinerário) → 2. bottom-sheet (o de cima; em Configurações, a SEÇÃO aberta
recolhe antes de a folha fechar — v1.12.48) → 2.5. a folha de Ferramentas (com
uma ferramenta aberta, o voltar devolve a LISTA delas antes de fechá-la — v1.13.3; é o
ÚNICO caminho de volta à lista desde a v1.13.6, que tirou o voltar da tela) →
**2.6. a folha da Bíblia** (que SOBE dentro dela — livros ← capítulos ← leitura —
antes de fechar) → 3. preview em tela cheia (que, sem telão, **é** a projeção) →
*(o degrau 4 era o fader do mixer, e saiu na v1.3.8)* → 5. seleção múltipla →
*(os degraus 6 e 7 subiram para o 2.6 na v1.5.0: o `#backBtn` do cabeçalho só
servia à Bíblia, e não há mais "fora do Cronograma" — há uma tela e duas folhas)*
→ 8. nada aberto → `moveTaskToBack`.

- A tabela de popups é **a mesma** que registra o ✕ e o toque no fundo
  (`POPUPS`): um popup novo entra numa linha e já é fechável pelos três
  caminhos. Duas listas divergiriam no primeiro esquecimento.
- **Prazo de 350 ms** (`BACK_JS_TIMEOUT_MS`): `evaluateJavascript` responde por
  callback, e com o renderer morto ou um bundle sem `__avBack` ele nunca chega —
  um voltar que não faz nada é pior que um que minimiza.
- O `AtomicBoolean` garante que `moveTaskToBack` roda **no máximo uma vez** por
  toque. Ele **não** impede minimizar depois de o web já ter fechado um popup: o
  que chega tarde é a RESPOSTA, não a ação. Fechar isso exigiria um token de
  corrida (`__avBack(token)` → `__avResolve`), mudança de contrato da ponte.

## Botões físicos de volume

**O app CONSOME `KEYCODE_VOLUME_UP/DOWN`, e a razão é a PROJEÇÃO.** Quem não
consome deixa o Android desenhar o painel de volume dele — e com espelhamento
ativo esse painel aparece **sobre o que a congregação está vendo**. Consumindo,
nada disso chega ao telão: o que aparece é o fader do celular, por alguns
segundos. `MainActivity.onKeyDown` consome a tecla (e o `onKeyUp`
correspondente, senão o sistema ainda reage à soltura) e entrega o passo a
`window.__avVolumeKey(±1)` → `applyVolume()`.

- **Só intercepta depois que o web pede** (`captureVolumeKeys(true)`, no fim da
  carga do Controle). Interceptar desde o `onCreate` faria uma falha de JS deixar
  o aparelho sem **nenhum** controle de volume.
- **A PASSAGEM (v1.12.18):** no teto do app, cada toque de cima sobe UM degrau do sistema (`AVNative.systemVolumeStep`, que devolve antes/depois/max) e baixa o app o MESMO tanto em % de curso (`volumePassa`), mesmo com o app abaixo de 100% (`volPassagem` em curso). Dois ciclos: até o sistema chegar a 60% (`VOL_SIS_ALVO`), depois só o app sobe, até o teto de novo, e então o sistema vai ao máximo com o app cedendo outra vez (`volumeLimite`). A passagem acaba no limite, se o sistema recusa o degrau ou se o fader mudou por fora; a tecla de baixo mexe só no app, e no zero vai ao sistema. Pedido do operador *"depois que bate 100% no app, cada % que sobe no sistema, desce o mesmo no app … dois ciclos"*. **E ELA SÓ VALE ONDE O VOLUME DO SISTEMA ALCANÇA O SOM** (`passagemAlcancaOSom`, v1.12.22): com o telão no ar (`telaoNoAr`, o campo `telao` — nunca a lista crua) ou sem tela da rede recebendo. Sem TV e com telas da rede (`telasDaRede()`), as telas SÃO a projeção e o comando `volume` desce para elas: no teto a tecla de cima vai ao sistema (`systemVolume(+1)`) SEM o app ceder — cedendo, cada "aumentar" deixava as telas mais baixas.
- **Válvula de escape:** no ZERO do app a tecla de baixo vai ao sistema
  (`systemVolume(-1)` → `adjustStreamVolume` com `FLAG_SHOW_UI`); no TETO, sem a
  passagem (telas da rede sem TV), a de cima vai por `systemVolume(+1)` sem o app
  ceder. Com a passagem valendo, o teto é a passagem acima (`systemVolumeStep`).
- **A tecla ACENDE o fader** por 2,8 s (`peekVolume`) — a ÚNICA porta dele desde
  a v1.3.8, quando o botão de tela que o abria saiu a pedido do operador. Sem
  isso a tecla mexeria num número invisível. Ele ocupa a célula do
  `#slidePrevBtn` e some sozinho; o botão de PASSAR slide, na outra ponta, **não
  some junto** — o par sumia junto até a v1.3.8, e foi disso que o operador
  reclamou. **QUAL dos dois cede é a v1.8.87**, revogando a v1.3.8: *"assim ele
  não interrompe a passagem dos slides"*. Passar slide é o gesto repetido de um
  sermão inteiro; voltar é a correção.
- **O número não é o volume do aparelho:** ele viaja no comando `volume` e
  chega também às **telas da rede**, que são outros aparelhos.
- **O PASSO TEM DOIS TRECHOS** (`volumeProximo`, v1.8.90): 5 acima de 10, **1
  abaixo** — o volume não é linear no ouvido, e é na faixa baixa que se ajusta
  um louvor sob a fala do púlpito. A fronteira é do lado de quem SOBE (9 → 10
  fino, 10 → 15 grosso), e o alvo é ALINHADO À GRADE, nunca `atual ± passo`: o
  fader é arrastável, e de 12 um passo para baixo daria 7 e pularia o 10. Desde
  a v1.13.8 o Modo Fácil não tem ± na tela: as teclas físicas são o único ajuste
  fino dele.

## Espelhamento de tela ≠ Google Cast

O botão precisa abrir o **espelhamento** (Smart View / "Wireless display"), não
o **Google Cast** — o Cast manda uma URL para o dispositivo tocar sozinho.
`Settings.ACTION_CAST_SETTINGS` **cai no Google Cast** em vários aparelhos, então
é o último recurso; e não há API pública para o popup das configurações rápidas
(`Settings.Panel` só cobre internet, wifi, nfc e volume).

`pickCastIntent()` percorre alvos do mais específico ao mais genérico e escolhe o
primeiro que existe **e não resolve para o Play Services** (`com.google.android.gms`)
— é o filtro, não só a ordem, que impede a cadeia de terminar no Cast:

1. *(só Samsung)* activities exportadas do Smart View —
   `com.samsung.android.smartmirroring` e `com.samsung.android.app.smartmirroring`
2. *(só Samsung)* `com.samsung.wfd.LAUNCH_WFD_PICKER`
3. *(qualquer aparelho)* `android.settings.WIFI_DISPLAY_SETTINGS` — a ação legada
   do AOSP, e a que **não** é reivindicada pelo Play Services

- **`isSamsung()` aceita `MANUFACTURER` ou `BRAND`**, sem caixa: uma ROM mexe num
  e esquece o outro, e errar para "não é Samsung" custaria o Smart View no
  aparelho em que o app é operado. A guarda também evita varrer dois pacotes
  ausentes a cada toque e a cada abertura de Configurações.
- **O nome da activity não é adivinhado:** `exportedActivities()` pergunta ao
  `PackageManager` (`GET_ACTIVITIES`). Um nome chutado não resolve, a cadeia cai
  no fallback, e o botão abre o Google Cast — o oposto do pedido.
- **Nada disso é API documentada.** Alvo ausente → `resolveActivity` null /
  `startActivity` lança, e a cadeia segue. Por isso o bloco **`<queries>`** no
  manifest (visibilidade de pacotes do Android 11+): sem ele tudo resolve para
  null e a cadeia cai direto no fallback.
- `describeCastTarget()` devolve o rótulo **com o componente real**, e
  Configurações mostra "Espelhar abre: …" — é essa string que diz qual candidato
  pegou quando o botão abre a tela errada, sem depender de logcat.

### O espelhamento leva o som do APARELHO INTEIRO, e não há como isolá-lo

**O `Presentation` isola a JANELA; ele não isola o SOM, e o Android não tem o
conceito de "áudio deste Display".** A assimetria está no caminho do Wi-Fi
Display: o vídeo nasce de um `SurfaceMediaSource` ligado ao display virtual, o
áudio nasce de `AUDIO_SOURCE_REMOTE_SUBMIX` — um mix global, sem parâmetro de
display. A doc de `TYPE_REMOTE_SUBMIX` descreve o caso literalmente ("playing
from a device in screen mirroring mode").

Consequência, e ela é OPERACIONAL: com o espelhamento no ar, **vídeo ou áudio
tocado em qualquer app deste celular sai nas caixas da igreja**, junto com a
projeção. Toque de chamada e alarme ficam de fora (o audio policy tem guarda
explícita: `// no sonification on remote submix (e.g. WFD)`); som de notificação
depende do aparelho.

**NÃO HÁ CONSERTO NO APP, e é preciso estar escrito para a investigação não ser
refeita.** O que resolveria — `AudioPolicy.setUidDeviceAffinity`,
`setPreferredDeviceForStrategy`, `registerAudioPolicy` — é `@SystemApi` atrás de
`MODIFY_AUDIO_ROUTING` (`signature|privileged|role`). Um APK assinado com a
keystore do projeto nunca as obtém.

**E `requestAudioFocus` no Kotlin seria uma REGRESSÃO, não higiene.** Foco
deixou de ser cooperativo no Android 12 (o sistema faz fade-out e mantém o
perdedor mudo), e quem toca aqui não é o Kotlin — é o WebView, que pede foco por
`<video>` (`kRequestSystemAudioFocus`, ligado por padrão). Um pedido nosso
despejaria o próprio WebView (`propagateFocusLossFromGain_syncAf` não filtra por
uid) e **pausaria o telão no meio do culto**. Vale o mesmo para
`GAIN_TRANSIENT_EXCLUSIVE`. Também descartados: `ALLOW_CAPTURE_BY_NONE` (só
afeta o áudio do PRÓPRIO app, e quem monta os `AudioAttributes` é o WebView) e
`setMode(MODE_IN_COMMUNICATION)` (tiraria o culto da TV junto com o vazamento).

**MAS A PROJEÇÃO SE DEFENDE, e isso não contradiz o parágrafo acima.** MEDIDO em
aparelho: tocar qualquer outra mídia no celular PAUSA a do telão, e na perda
PERMANENTE o Chromium abandona o foco e não volta nunca. Desde a v1.1.11 o
`display.js` reage à pausa espontânea com `stage.play()` — que é o Chromium
re-pedindo foco por conta própria, não um `requestAudioFocus` nosso, e por isso
a regra de cima segue de pé. Três tentativas (1,5 s / 4 s / 10 s) e desistência
até um comando humano; sem teto, dois apps que retomam sozinhos gaguejam para
sempre, e gagueira é pior que pausa. **Ela não garante que a outra mídia pare** —
o framework MUTA o perdedor e desfaz sozinho segundos depois; contra um alarme
(`USAGE_ALARM`, fora das usages esmaecíveis) não faz nada. As guardas são a
entrega, não o `play()`: `TELA` (N telas da rede religando mídia é o oposto do
que o operador controla) e `v.ended` — o fim natural dispara `pause` ANTES de
`ended`, e sem ela o fim de cada louvor religaria a faixa com a playlist
avançando por baixo. **Essa segunda existe DUAS vezes, e o oráculo só reprova
quando as duas somem** (medido por reversão): quem tirar uma vai ver o teste
passar e concluir que ela não servia.

**A saída para o VAZAMENTO continua estrutural: o áudio não nascer no celular** — o telão por comandos,
com o espelhamento DESLIGADO (os dois juntos mantêm a mistura no ar), ou um
aparelho dedicado só para projetar. O operador é avisado disso na folha de
conexão — desde a v1.8.87 atrás de um `?` ao lado do botão de conectar, e só com
TV no ar — e por inteiro no bloco "Áudio do aparelho" do Registro. **As duas
frases divergem de propósito:** a do `?` é a que muda o que ele FAZ (*"exceto as
notificações, todo o som deste aparelho é tocado na tela"*, as palavras do
operador); a do Registro é a estrita, com os três graus do que se sabe. O que o
`?` conserta é o CUSTO DE LER: como linha permanente dentro do botão, a frase
ficava na frente de quem já a leu, em toda abertura da folha durante todo o
culto.

## Andaimes do modelo de dois PWAs, removidos

A base nasceu como dois PWAs instaláveis que se falavam por BroadcastChannel.
Com a `Presentation` no lugar, saíram do bundle: `web/index.html` (o "Abrir
Controle / Abrir Display"), os dois `manifest.json` (WebAPK, `scope`,
`orientation`, `share_target` — nada disso existe num WebView: ícone, nome e
orientação vêm do APK), `controle/icons/` e `display/icons/`, e o `sw.js`.

**Fica** a preview em tela cheia (a projeção quando não há TV, com os gestos
invisíveis) e todas as guardas `if (!window.__NATIVE__)`.

---
