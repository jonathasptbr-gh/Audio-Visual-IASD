const wallpaperEl = document.getElementById('wallpaper');
const imgEl = document.getElementById('img');
const videoEl = document.getElementById('video');
const lyricsEl = document.getElementById('lyrics');
const lyricsImgEl = document.getElementById('lyricsImg');
const lyricsContentEl = document.getElementById('lyricsContent');
const lyricsLineEl = document.getElementById('lyricsLine');
const lyricsAuxEl = document.getElementById('lyricsAux');
const lyricsNumEl = document.getElementById('lyricsNum');
const textEl = document.getElementById('text');
const textContentEl = document.getElementById('textContent');
const textMainEl = document.getElementById('textMain');
const textSubEl = document.getElementById('textSub');

// IDENTIDADE DESTA INSTÂNCIA, por CARREGAMENTO da página. Existe para o
// Controle poder ENDEREÇAR o reenvio de cena a quem acabou de se anunciar, em
// vez de acordar todo mundo que estiver ouvindo o barramento (ver o `__para`
// no `onCommand` lá embaixo). Aleatório, e não um contador, pelo mesmo motivo
// dos ids da ponte: duas páginas que recarregam começariam ambas em "1".
// `padEnd` porque `toString(36)` de uma mantissa que termina em zeros devolve
// menos caracteres do que o `slice` pede — o mesmo cuidado que `shared/native.js`
// tem com a época dele.
const INSTANCIA = 'd' + Math.random().toString(36).slice(2, 10).padEnd(8, '0');

// ESTE DOCUMENTO É O ESPELHO DE PIXELS? (ver docs/ESPELHO-DE-PIXELS.md)
//
// O espelho é uma SEGUNDA cópia deste mesmo `/display/`, hospedada numa
// `Presentation` sobre um `VirtualDisplay` privado cujo framebuffer é
// codificado e servido na rede local. É o mesmo arquivo, o mesmo origin e o
// mesmo barramento do telão de verdade — o que muda é o PAPEL, e todas as
// diferenças de comportamento penduram nesta constante.
//
// No navegador ela é `false` (não há `__AV_ROLE__` sem a ponte) e no telão de
// verdade também, então tudo o que ela guarda é código morto nos dois casos —
// que é exatamente a regra de escrita do projeto: o comportamento de sempre é
// o padrão, o novo é a exceção que se declara.

// O quarto papel (telão por comandos, docs/TELAO-POR-COMANDOS.md): este MESMO
// documento rodando num navegador da LAN, servido pelo celular, com os
// comandos chegando por SSE pela casca `espelho/tela.js`. Ele é falso no
// telão, no espelho e no navegador de desenvolvimento — a mesma regra de
// escrita do ESPELHO acima: o comportamento de sempre é o padrão.
const TELA = window.__AV_ROLE__ === 'tela';

// Config de transições, usada aqui para animar o player do YouTube (que vive
// fora do stage). INERENTE ao sistema: toda troca visual é animada com fade,
// sempre — não há opção de desligar nem ajustar. Vem de stage.js para não
// existirem duas cópias do mesmo objeto (Display e Controle) podendo divergir.
const fadeCfg = createStage.FADE;

// Fonte única do payload display-status: hoje só o stage o alimenta (a v5.212
// tirou o segundo emissor, que era o do embed do YouTube).
// (YouTube) só preenchem os valores; o `type` e o `audioBlocked` ficam num
// lugar só, evitando que os dois campos saiam inconsistentes para o Controle.
function sendDisplayStatus(fields) {
  AVDB.sendCommand(Object.assign({ type: 'display-status', audioBlocked }, fields));
}

// ===== CAIXA-PRETA DO TELÃO =====
//
// Três versões seguidas tentaram consertar "o vídeo para quando o app é
// minimizado" com HIPÓTESES — e as três erraram, porque ninguém consegue ver o
// que acontece com o telão enquanto o celular está fora da frente: não há
// console, não há logcat, e o Controle está estrangulado justamente nesse
// intervalo.
//
// Este anel resolve isso: o Display anota o que ACONTECE COM ELE, guarda no
// próprio processo, e o Controle pede o despejo quando o operador abre
// Configurações. É pouca coisa e é barato, mas é a diferença entre corrigir e
// adivinhar.
const DIAG_MAX = 60;
const diario = [];
function diag(ev, extra) {
  diario.push(Object.assign({
    t: Date.now(),
    ev,
    oculto: document.visibilityState !== 'visible',
  }, extra || {}));
  if (diario.length > DIAG_MAX) diario.shift();
}

// A visibilidade da PÁGINA é a peça central da investigação: se ela nunca vira
// "oculta" e o vídeo para mesmo assim, a causa é outra (suspensão do renderer,
// Presentation derrubada) — e isso muda inteiramente o que corrigir.
document.addEventListener('visibilitychange', () => diag('visibilidade'));
window.addEventListener('pagehide', () => diag('pagehide'));
window.addEventListener('freeze', () => diag('congelou'));
window.addEventListener('resume', () => diag('descongelou'));

// ===== Microfone ao vivo (push-to-talk) =====
// O operador segura o botão no Controle e a voz sai na PROJEÇÃO, ao vivo.
//
// A captura acontece AQUI, no Display: um `MediaStream` não atravessa o
// BroadcastChannel (não é clonável), então mandar o áudio "pela ponte" não
// existe como opção. O que atravessa é o comando; quem abre o microfone é quem
// vai reproduzi-lo.
//
// Caminho: getUserMedia → MediaStreamSource → GainNode → destination. Menor
// atraso disponível; a latência do WebView (~0,1–0,3 s) é inerente.
//
// REALIMENTAÇÃO: `echoCancellation` fica LIGADO de propósito — num culto um
// ganho realimentado é estrago imediato e público, e vale mais que a fidelidade
// de desligar o processamento. Com a saída no próprio celular (e não na TV) o
// risco continua: é do formato, não do código.
let saindoDeCena = 0;
function aoSairDeCena(p) {
  saindoDeCena++;
  Promise.resolve(p).catch(() => {}).then(() => {
    if (--saindoDeCena) return;
    // E O TELÃO VAZIO É DITO UMA VEZ, agora que ele é verdade. Sem esta linha o
    // último status a viajar seria o do começo do fade — `playing: true` —, e a
    // notificação (que não tem o `midiaNoAr` do Controle para se defender)
    // ficaria com ele. `sendStatus` lê o stage já limpo: `mediaId: null`,
    // `playing: false`.
    sendStatus();
  });
}

function sendStatus() {
  if (saindoDeCena) return; // ver acima: o que ele reportaria aqui é passado
  // No fim natural o stage zera o currentTime (preparando o replay) e continua
  // emitindo tempo: seguir isso re-renderizaria o slide 0 e a CAPA do hino
  // piscava por um instante antes do wallpaper cobrir. Terminado, a letra
  // congela no último slide — e o onEnded a esmaece.
  if (!stage.hasEnded()) updateLyricSlide(stage.isTimed() ? stage.getTime() : 0);
  const cur = stage.getCurrent();
  sendDisplayStatus({
    mediaId: cur ? cur.id : null,
    view: stage.getView(),
    muted: stage.getMuted(),
    volume: stage.getVolume(),
    playing: stage.isPlaying(),
    currentTime: stage.isTimed() ? stage.getTime() : 0,
    duration: stage.isTimed() ? stage.getDuration() : 0,
  });
}

const stage = createStage({
  wallpaper: wallpaperEl,
  img: imgEl,
  video: videoEl,
  // A TELA DA REDE NASCE MUDA, e isso é a falha segura — não uma preferência.
  //
  // O som é OPT-IN POR TELA (invariante 10 do espelho): nenhum navegador toca
  // com som sem gesto do visitante, e mesmo onde tocasse não é o app que decide
  // o volume da sala em que aquela tela está — a do saguão quer imagem cheia e
  // SILÊNCIO, com a PA a 200 ms dali. Quem libera é o gesto do visitante: o
  // botão "Ativar esta tela" do `tela.js`, que chama o gancho `__telaSom` logo
  // abaixo. NUNCA o contrário — uma tela que toca alto por engano é um culto
  // interrompido.
  forceMuted: TELA,
  onTime: sendStatus,
  // O TELÃO NÃO RECUPERA SOZINHO uma transmissão que falhou, e não é omissão:
  // ele não tem a ponte (`host = null`, ver NativeBridge) para pedir um
  // manifesto novo, e duas recuperações independentes para a mesma cena
  // brigariam entre si. Quem conserta é o Controle, cuja preview toca o MESMO
  // registro e vê o mesmo erro no mesmo instante — e que reenvia a cena
  // arrumada pelo caminho de sempre.
  onStreamErro: (rec, porque) => { console.warn('[stream] telão:', porque); },
  onBlocked: () => {
    // A guarda de nativo fica AQUI, e não só dentro de beginAudioRecovery():
    // no APK não há política de gesto (ver #startBtn), então um NotAllowedError
    // só pode ser falso positivo — e mutar o stage antes de descobrir isso
    // deixava o telão sem som sem armar recuperação nenhuma (beginAudioRecovery
    // devolve cedo em __NATIVE__, `audioBlocked` continua false e nem
    // tryRestoreAudio nem o comando 'audio-retry' fazem qualquer coisa). O
    // silêncio durava até o próximo load, e o Controle não recebia sinal: o
    // display-status só carrega `audioBlocked`, que ali é false.
    if (window.__NATIVE__) return;
    // Autoplay com som bloqueado: segue tocando MUDO (sempre permitido — o
    // vídeo aparece no telão sem toque) e a recuperação religa o áudio.
    stage.setMute(true);
    stage.play();
    beginAudioRecovery();
  },
  onEnded: () => {
    sendStatus();
    // A letra sai de cena junto com a música, esmaecendo — ela é uma camada
    // paralela e não participa do fade do stage. Se um próximo item vier em
    // seguida (avanço de playlist), o load dele mostra a letra nova.
    if (currentLyrics) fadeLayerOut(lyricsEl);
    const cur = stage.getCurrent();
    AVDB.sendCommand({ type: 'media-ended', mediaId: cur ? cur.id : null });
  },
});

// O GANCHO DO SOM da tela da rede: o botão de conectar do tela.js gasta o
// gesto do visitante e chama isto para soltar o `forceMuted` — o mesmo
// mecanismo que o áudio do espelho usava (`setForceMuted(false)` depois do
// handshake), agora com o gesto no lugar do handshake. Só existe no papel
// `tela`: em qualquer outro, mexer no forceMuted por fora seria um segundo
// dono para o mesmo estado.
if (TELA) window.__telaSom = (on) => stage.setForceMuted(!on);

// ===== Letra sincronizada (Hinário 2022 — ver CLAUDE.md) =====
// Camada paralela ao stage.js (mesmo padrão da ponte do YouTube): stage.js
// não sabe nada sobre texto/letra, só gerencia wallpaper/img/video. O layer
// #lyrics vive no mesmo z-index dos demais layers de mídia, então a cortina
// do wallpaper (z-index maior, já existente) cobre/revela-o de graça.
let currentLyrics = null; // array de slides do item atual, ou null (sem letra)
let currentLyricsMeta = null; // { hymnName, hymnTrack, hymnAlbum } do item atual — persistido à parte
                               // (não só passado ao showLyrics) pra o slide de capa mostrar o
                               // título certo mesmo quando renderizado de novo pelo tick de
                               // tempo (ex: operador volta pra estrofe 0 depois de já ter
                               // avançado), não só na primeira exibição.
let lyricSlideIdx = -1;
let lyricLoadSeq = 0;     // descarta resoluções de imagem obsoletas (mesmo padrão do loadSeq do stage)
let lyricImgKey = null;   // imageOpfsPath já renderizado agora (evita recriar a object URL à toa)
let lyricImgUrl = null;   // object URL em uso, para revogar quando trocar de fato
let lyricTeardownTimer = null; // desmontagem atrasada da camada (ver hideLyrics/showLyrics)
// 'black' (padrão) ignora as imagens dos slides e mantém o fundo preto atrás
// do texto; 'image' usa as imagens de verdade. Persistido em state.lyricsBg
// pelo Controle, aplicado ao vivo via comando (ver setLyricsBgMode).
let lyricsBgMode = 'black';

// ===== Fades de camada paralela (letra, texto) =====
// A cortina do wallpaper e a mídia do stage já têm as próprias transições; as
// camadas paralelas não passam por lá, e sem estes helpers apareciam/sumiam
// com corte seco. Os quatro vivem em stage.js: são idênticos aos do Controle
// (que os aplica em #pvLyrics/#pvText) e não têm calibração própria nenhuma —
// só o CSS de cada app é que difere. Ver "fades de camada paralela" lá.
const LAYER_FADE_MS = createStage.LAYER_FADE_MS;
const findSlideIndex = createStage.findSlideIndex;
const animateFadeIn = createStage.fadeContentIn;
const fadeLayerIn = createStage.fadeLayerIn;
const fadeLayerOut = createStage.fadeLayerOut;
const chronoReading = createStage.chronoReading;
const CHRONO_TICK_MS = createStage.CHRONO_TICK_MS;
const drawReading = createStage.drawReading;
const DRAW_FRAME_MS = createStage.DRAW_FRAME_MS;

// `fade` = a letra está saindo de cena para o operador ver (fim da música,
// texto manual assumindo). Sem fade quando outra mídia já vai ocupar o lugar
// no mesmo instante — aí a transição é da mídia que entra.
function hideLyrics(fade) {
  currentLyrics = null;
  currentLyricsMeta = null;
  lyricSlideIdx = -1;
  ++lyricLoadSeq; // descarta uma imagem ainda resolvendo (não deve reaparecer)
  const seq = lyricLoadSeq;
  // A imagem de fundo é FILHA da camada: desmontá-la agora faria o fundo sumir
  // de imediato por trás de um texto ainda esmaecendo. Some junto com a camada.
  const teardown = () => {
    if (seq !== lyricLoadSeq) return; // a letra voltou nesse meio tempo
    if (lyricImgUrl) { URL.revokeObjectURL(lyricImgUrl); lyricImgUrl = null; }
    lyricImgKey = null;
    lyricsImgEl.hidden = true;
    lyricsImgEl.removeAttribute('src');
  };
  clearTimeout(lyricTeardownTimer);
  if (fade && !lyricsEl.hidden && lyricsEl.animate && fadeCfg.out) {
    fadeLayerOut(lyricsEl);
    lyricTeardownTimer = setTimeout(teardown, LAYER_FADE_MS);
  } else {
    lyricsEl.hidden = true;
    teardown();
  }
}

function showLyrics(rec) {
  // Um texto manual (Bíblia/mensagem) em cena tem precedência: a música toca de
  // fundo, mas a letra dela não substitui o texto projetado pelo operador.
  if (textActive) return;
  // A letra VOLTOU antes do teardown agendado por hideLyrics: cancela-o de
  // forma explícita. A guarda de sequência sozinha não bastava — se a estrofe
  // que volta usa a MESMA imagem (`key === lyricImgKey`, o caso normal quando
  // um versículo entra e sai em menos de LAYER_FADE_MS, e também quando dois
  // hinos compartilham o mesmo imageOpfsPath), applyLyricsImage devolve cedo e
  // NÃO incrementa lyricLoadSeq: o teardown disparava com o seq ainda válido,
  // revogava a object URL em uso e apagava o fundo da letra que acabara de
  // reaparecer, deixando-a sobre preto até a próxima troca de estrofe.
  clearTimeout(lyricTeardownTimer);
  currentLyrics = rec.lyrics;
  currentLyricsMeta = { hymnName: rec.hymnName, hymnTrack: rec.hymnTrack, hymnAlbum: rec.hymnAlbum };
  lyricSlideIdx = -1;
  fadeLayerIn(lyricsEl);
  renderLyricSlide(0);
}

// Só mexe no DOM quando o índice realmente muda (chamado a cada tick de tempo).
function renderLyricSlide(idx) {
  if (idx === lyricSlideIdx) return;
  const slide = currentLyrics[idx];
  // O índice só é REGISTRADO depois de validado: gravá-lo antes fazia um índice
  // inexistente (findSlideIndex devolvendo -1 num tempo anterior ao 1º slide,
  // ou um showLyrics com a lista ainda vazia) ficar marcado como "já
  // renderizado" — e se o mesmo índice voltasse a ser pedido, a guarda de cima
  // devolvia cedo e o slide certo nunca era pintado.
  if (!slide) return;
  lyricSlideIdx = idx;

  lyricsContentEl.classList.toggle('cover', !!slide.cover);
  if (slide.cover) {
    // A CAPA É UM CARTÃO DE ABERTURA, não uma estrofe com outra cor (v5.218).
    // Três peças em vez de uma frase: o número (que vinha colado na frente do
    // título, gastando a largura da linha que mais precisa dela), o TÍTULO
    // sozinho, e o álbum de onde a música veio.
    //
    // Cada peça só existe se houver o dado — um registro importado à mão não
    // tem número nem álbum, e a capa dele volta a ser o título centralizado,
    // que é a capa de sempre. **Não há campo de AUTOR na fonte** (o LouvorJA
    // publica nome, faixa e álbuns; ver docs/FONTE-DE-DADOS-LOUVORJA.md), e
    // inventar um seria pior que a ausência: uma linha vazia na frente da
    // congregação.
    const meta = currentLyricsMeta || {};
    lyricsNumEl.textContent = meta.hymnTrack ? String(meta.hymnTrack) : '';
    lyricsNumEl.hidden = !lyricsNumEl.textContent;
    lyricsLineEl.textContent = meta.hymnName || '';
    lyricsAuxEl.textContent = meta.hymnAlbum || '';
    lyricsAuxEl.hidden = !lyricsAuxEl.textContent;
  } else {
    lyricsNumEl.hidden = true;
    lyricsLineEl.textContent = slide.text || '';
    lyricsAuxEl.textContent = slide.auxText || '';
    lyricsAuxEl.hidden = !slide.auxText;
  }
  // Trecho sem letra (solo, introdução, instrumental): a moldura esmaece e
  // some, deixando só a imagem de fundo — uma caixa escura vazia no meio da
  // tela não tem função nenhuma. Volta sozinha quando houver o que cantar.
  lyricsContentEl.classList.toggle('nolyric',
    !lyricsLineEl.textContent.trim() && lyricsAuxEl.hidden && lyricsNumEl.hidden);
  animateFadeIn(lyricsLineEl);
  if (!lyricsAuxEl.hidden) animateFadeIn(lyricsAuxEl);

  applyLyricsImage(slide);
}

// Resolve (ou limpa) a imagem de fundo do slide dado, respeitando o modo
// preto/imagens (`lyricsBgMode`) — só troca de fato se a chave efetiva
// mudou (linhas seguidas costumam compartilhar a mesma imagem — fallback
// "grudento" do sync), com guarda de sequência pra descartar resoluções
// obsoletas (mesmo padrão do `loadSeq` do stage).
function applyLyricsImage(slide) {
  if (!slide) return;
  // Na TELA DA REDE o slide não tem `imageOpfsPath` (o OPFS é do celular):
  // vem `imageUrl`, a rota /m/ do próprio celular (v5.188) — servida pelo
  // mesmo origin de onde a página veio, então o src direto basta.
  const chaveDoSlide = slide.imageOpfsPath || slide.imageUrl;
  const key = (lyricsBgMode === 'image' && chaveDoSlide) ? chaveDoSlide : null;
  if (key === lyricImgKey) return;
  const seq = ++lyricLoadSeq;
  if (!key) {
    lyricImgKey = null;
    // Oculta a <img> (não só limpa o src): sem isso, alguns navegadores
    // renderam o ícone/borda padrão de "imagem quebrada" mesmo sem `src`,
    // aparecendo como uma linha branca de margem sobre o preto de
    // `.lyrics-bg`. Escondida, o preto do próprio `.lyrics-bg` fica exposto.
    // Sai esmaecendo: desligar o fundo das músicas é uma troca visível na
    // projeção, não um corte — e por isso a `src` e a object URL só caem
    // DEPOIS do fade (limpá-las agora exporia o ícone de imagem quebrada
    // durante toda a transição, que é exatamente o que se quer evitar).
    const url = lyricImgUrl;
    lyricImgUrl = null;
    fadeLayerOut(lyricsImgEl);
    setTimeout(() => {
      // A revogação vem ANTES da guarda de sequência, e de propósito:
      // `lyricImgUrl` já foi zerada acima, então esta URL não é mais de
      // ninguém — nenhum outro caminho vai revogá-la. Deixá-la atrás do guard
      // significava que uma imagem nova entrando em menos de LAYER_FADE_MS
      // (estrofe seguinte, ou o operador religando o fundo pelo 'lyricsbg')
      // invalidava o callback e o blob da foto ficava retido até o WebView do
      // telão morrer — uma vez a cada ocorrência, o culto inteiro.
      if (url) URL.revokeObjectURL(url);
      if (seq !== lyricLoadSeq) return; // outra imagem já assumiu: o src é DELA
      lyricsImgEl.removeAttribute('src');
    }, LAYER_FADE_MS);
    return;
  }
  if (!slide.imageOpfsPath) {
    // TELA DA REDE: a chave É a URL. Pré-carrega com retentativa — o empurrão
    // da imagem pode ainda estar chegando ao cache do celular, e um src que
    // 404a não retenta nunca. Sem object URL: nada a revogar da nova.
    //
    // A ESPERA PRECISA DURAR MAIS QUE O EMPURRÃO DA MÚSICA, e isso é
    // estrutural: as imagens de fundo são enfileiradas DEPOIS da mídia
    // principal, no MESMO canal serializado (o som não espera as fotos), então
    // os bytes só começam a chegar depois de a música inteira atravessar. Uma
    // ladeira de ~2,4 s desistia antes de haver chance de sucesso e a estrofe
    // ficava no preto PARA SEMPRE (nada reexamina uma já renderizada).
    //
    // A ladeira dobra até um platô, tem teto de tempo e é auto-limitada pela
    // guarda de sequência (a estrofe mudando mata o laço). Repetir a mesma URL
    // é seguro: o servidor manda `Cache-Control: no-store` em toda resposta,
    // 404 inclusive.
    const ESPERA_1 = 400;        // ms — a primeira espera depois da falha inicial
    const ESPERA_MAX = 2500;     // ms — o platô: não adianta martelar
    const TETO_MS = 45000;       // ms — desiste de vez (a estrofe já terá mudado)
    const prazoFinal = Date.now() + TETO_MS;
    let esperaMs = 0;
    const tentar = () => {
      if (seq !== lyricLoadSeq) return;
      const img = new Image();
      img.onload = () => {
        if (seq !== lyricLoadSeq) return;
        const prevUrl = lyricImgUrl;
        lyricImgUrl = null;
        lyricImgKey = key;
        lyricsImgEl.src = key;
        fadeLayerIn(lyricsImgEl);
        if (prevUrl) URL.revokeObjectURL(prevUrl);
      };
      img.onerror = () => {
        // esgotado (ou estrofe trocada): mantém a imagem anterior, como no
        // caminho do OPFS.
        if (seq !== lyricLoadSeq || Date.now() >= prazoFinal) return;
        esperaMs = esperaMs ? Math.min(esperaMs * 2, ESPERA_MAX) : ESPERA_1;
        setTimeout(tentar, esperaMs);
      };
      img.src = key;
    };
    tentar();
    return;
  }
  AVDB.opfsGetFile(key).then((file) => {
    if (seq !== lyricLoadSeq) return; // um slide mais novo já assumiu enquanto isso resolvia
    const url = URL.createObjectURL(file);
    const prevUrl = lyricImgUrl;
    lyricImgUrl = url;
    lyricImgKey = key;
    lyricsImgEl.src = url;
    // Cada imagem de estrofe entra com fade (e a primeira, ao ligar o fundo,
    // também) — a troca seca entre fotos era o corte mais perceptível da
    // letra sincronizada.
    fadeLayerIn(lyricsImgEl);
    if (prevUrl) URL.revokeObjectURL(prevUrl);
  }).catch(() => {
    // falha ao resolver: mantém a imagem anterior em tela (nada pior que
    // ficar sem fundo nenhum por causa de uma falha pontual de leitura)
  });
}

// Troca o modo preto/imagens ao vivo (comando do Controle) e reaplica no
// slide atual, sem precisar de uma troca de estrofe pra isso surtir efeito.
function setLyricsBgMode(mode) {
  lyricsBgMode = mode === 'image' ? 'image' : 'black';
  applyLyricsBgClass();
  if (currentLyrics && lyricSlideIdx >= 0) applyLyricsImage(currentLyrics[lyricSlideIdx]);
}

// A moldura (borda + fundo semitransparente) só faz sentido cobrindo uma
// imagem de fundo de verdade — no modo preto puro ela é uma zona escura
// flutuando sobre uma tela já preta, sem função nenhuma. `.imgbg` liga a
// moldura só quando o modo é 'image' (ver .lyrics-box/.lyrics-content.imgbg
// em display.css).
function applyLyricsBgClass() {
  lyricsContentEl.classList.toggle('imgbg', lyricsBgMode === 'image');
}

// Chamado a cada tick de tempo (sendStatus/onTime) — sem timer novo.
function updateLyricSlide(t) {
  if (!currentLyrics) return;
  // Replay depois do fim: a letra foi esmaecida no onEnded, mas os slides
  // continuam carregados — o tempo voltar a correr a traz de volta.
  if (lyricsEl.hidden) fadeLayerIn(lyricsEl);
  renderLyricSlide(findSlideIndex(currentLyrics, t));
}

// ===== Camada de TEXTO manual (Bíblia + Mensagens — ver "Camada de Texto") =====
// Camada paralela ao stage.js: um cartão de texto por baixo da cortina do
// wallpaper (que fica por cima de TUDO — nada é colocado sobre o wallpaper).
// É INDEPENDENTE do áudio: um som pode seguir tocando por baixo (o <video> do
// stage renderiza preto no áudio-só) e o transporte continua controlando esse
// áudio de fundo. `mode`: 'verse' (referência dourada embaixo) | 'message'.
let textActive = false;
let textView = 'visual';
let textMode = 'verse';

  // ===== TRÊS TENTATIVAS, DA MELHOR PARA A QUE SEMPRE ABRE =====
  //
  // `NotReadableError` NÃO é "outro app está usando o microfone": é o "não
  // consegui abrir o dispositivo" genérico do WebRTC, e no Android a causa comum
  // é o PROCESSAMENTO pedido. Com `echoCancellation` o Chromium abre o
  // `AudioRecord` em `VOICE_COMMUNICATION` (sessão de voz), que o sistema recusa
  // quando a saída de áudio está em outro caminho — o caso deste app com
  // espelhamento ligado. O microfone CRU não passa por ali e abre.
  //
  // A ordem é deliberada: o cancelamento de eco vem primeiro porque uma
  // realimentação num culto é estrago imediato e público. Um push-to-talk com
  // risco de microfonia é melhor que um que não funciona, desde que o operador
  // seja avisado — é o que o `sem-eco` faz.
let liveKind = '';    // 'chrono' | 'draw' | ''
let liveDesc = null;
let liveTimer = null;

// O RELÓGIO DA ORIGEM — e a diferença entre ele e `Date.now()` é uma hora
// errada na frente da congregação.
//
// Cronômetro e sorteio viajam por DESCRITOR ancorado numa época do CELULAR
// (`startAt`, `rollUntil`), e o modo RELÓGIO desenha a hora corrente. Nos dois
// casos a conta precisa ser feita contra o relógio de QUEM MANDOU, não contra o
// de quem desenha: numa tela da rede o segundo é o de uma Smart TV, que pode
// estar minutos fora — e nenhum campo da mensagem daria para corrigir a hora
// corrente, porque ela não viaja.
//
// `__avAgora` é publicado pela casca do papel `tela` (`espelho/tela.js`), que
// mede o desvio pela mediana das épocas do ping. No telão e no navegador de
// desenvolvimento ele não existe, e o `Date.now()` de sempre JÁ É a origem —
// é o mesmo aparelho.
function agoraDaOrigem() {
  const f = window.__avAgora;
  return typeof f === 'function' ? f() : Date.now();
}

function liveReading() {
  // O SORTEIO E O CRONÔMETRO CONTINUAM NO RELÓGIO LOCAL, e isso é deliberado:
  // `rollUntil` e `startAt` são épocas do celular que a casca do papel `tela`
  // JÁ TRADUZ para o referencial desta tela (`corrigirRelogio`). Medir contra a
  // origem aqui corrigiria a mesma diferença duas vezes — foi o que a primeira
  // versão disto fez, e o `tools/tela-rede.test.mjs` a reprovou na hora
  // ("o cronômetro lê ~0 s — o desvio de 90 s foi ANULADO"). O teste estava
  // certo: com o descritor traduzido, o relógio local é o referencial correto.
  if (liveKind === 'draw') return drawReading(liveDesc, Date.now());
  if (liveKind === 'chrono') {
    // O MODO RELÓGIO É A EXCEÇÃO, e é o único caso que a tradução não alcança:
    // ele desenha a HORA CORRENTE, que não viaja em campo nenhum da mensagem —
    // não há o que corrigir. Ele é o único que precisa perguntar as horas a
    // quem mandou, e não ao aparelho que desenha.
    const agora = (liveDesc && liveDesc.mode === 'clock') ? agoraDaOrigem() : Date.now();
    return chronoReading(liveDesc, agora);
  }
  return null;
}

function liveTick() {
  const r = liveReading();
  if (!r) return;
  textMainEl.textContent = r.text;
  // O CSS dimensiona a fonte a partir daqui (ver .mode-chrono em display.css):
  // "09:59" e "12:34:56 PM" não podem sair do mesmo tamanho — o primeiro
  // ficaria pequeno à toa, o segundo vazaria da tela.
  textMainEl.style.setProperty('--ch', r.text.length);
  textContentEl.classList.toggle('chrono-over', !!r.over);
  textContentEl.classList.toggle('draw-rolling', !!r.rolling);
  // O sorteio ASSENTOU: nada mais muda até o próximo comando, e um laço batendo
  // num número parado só gastaria bateria.
  if (liveKind === 'draw' && !r.rolling) stopLiveTimer();
}

function startLive(kind, desc) {
  liveKind = kind; liveDesc = desc || {};
  stopLiveTimer();
  liveTick();
  if (kind === 'draw') {
    // Só rola enquanto há rolo; depois o próprio liveTick se desliga.
    if (liveDesc.rollUntil && Date.now() < liveDesc.rollUntil) {
      liveTimer = setInterval(liveTick, DRAW_FRAME_MS);
    }
    return;
  }
  // O relógio e o timer/cronômetro EM MARCHA precisam de laço; um cronômetro
  // pausado é um número parado, e manter um timer batendo nele só gastaria
  // bateria com o app em cima de uma projeção que não muda.
  if (liveDesc.mode === 'clock' || liveDesc.running) liveTimer = setInterval(liveTick, CHRONO_TICK_MS);
}

function stopLiveTimer() {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
}

function clearLive() {
  stopLiveTimer(); liveKind = ''; liveDesc = null;
  textContentEl.classList.remove('chrono-over', 'draw-rolling');
}

function showText(cmd) {
  const wallpaper = cmd.view === 'wallpaper';
  textMode = cmd.mode === 'message' ? 'message'
    : (cmd.mode === 'chrono' || cmd.mode === 'draw') ? cmd.mode : 'verse';
  textContentEl.classList.toggle('mode-message', textMode === 'message');
  textContentEl.classList.toggle('mode-chrono', textMode === 'chrono');
  textContentEl.classList.toggle('mode-draw', textMode === 'draw');
  if (textMode === 'chrono') {
    startLive('chrono', cmd.chrono || {});
  } else if (textMode === 'draw') {
    startLive('draw', cmd.draw || {});
  } else {
    clearLive();
    textMainEl.textContent = cmd.main || '';
  }
  textSubEl.textContent = cmd.sub || '';
  textSubEl.hidden = !cmd.sub;
  textView = wallpaper ? 'wallpaper' : 'visual';
  // O STAGE PRECISA SABER QUE HÁ UM CARTÃO POR CIMA DELE. Sem isto ele
  // reavalia a cortina sozinho no fim natural da mídia, no `play()` e no fim de
  // um `load`, e o wallpaper engole o texto sem nenhum sinal. Ver `setOverlay`.
  if (stage.setOverlay) stage.setOverlay(textView);
  if (textActive) {
    // Já em cena (troca de versículo/mensagem): fade-in do texto, sem mexer na moldura.
    animateFadeIn(textMainEl); if (!textSubEl.hidden) animateFadeIn(textSubEl);
    stage.instantCover(wallpaper);
    return;
  }
  // O cartão é OPACO e fica acima de toda a mídia (.text-layer, z-index 2):
  // nada precisa ser interrompido para ele aparecer. A mídia segue tocando
  // intacta por baixo — áudio audível, vídeo rodando, posição preservada — e
  // reaparece exatamente onde estava quando o texto sair (hideText).
  //
  // A letra sincronizada é a única exceção: ela É texto, então sai de cena
  // enquanto o texto manual está no ar (precedência do operador). Volta em
  // hideText, no slide correspondente ao instante atual da música.
  hideLyrics(true);
  textActive = true;
  fadeLayerIn(textEl);
  // Revela conforme a view (wallpaper mantém a cortina por cima).
  if (wallpaper) stage.instantCover(true); else stage.coverOut();
}

// `restore` = a cena anterior deve voltar. Verdadeiro no 'text-hide' (o
// operador só tirou o texto do ar); falso quando algo NOVO já vai assumir a
// cena logo em seguida (load de visual, stop, clear) — restaurar ali faria a
// letra piscar por um instante antes de ser substituída.
function hideText(restore = true) {
  if (!textActive) return;
  textActive = false;
  // ANTES do `restoreSceneAfterText`: ele decide a cortina por `shouldCover()`,
  // que é o mesmo `computeCover` — deixá-lo com o overlay ainda declarado faria
  // a cena voltar sem a cortina que a mídia pede.
  if (stage.setOverlay) stage.setOverlay(null);
  // O laço do texto vivo para JUNTO com o cartão: fora de cena ele só gastaria
  // bateria reescrevendo um nó invisível. O descritor fica (o texto também não
  // é limpo — ver abaixo), então o valor segue certo durante o fade.
  stopLiveTimer();
  // Sai esmaecendo — e o texto NÃO é limpo aqui: apagá-lo agora deixaria o
  // cartão vazio visível durante todo o fade. O próximo showText sobrescreve.
  fadeLayerOut(textEl);
  if (restore) restoreSceneAfterText();
}

// Devolve a cena ao estado em que ela estava antes do texto manual entrar.
// Vídeo/imagem/YouTube não precisam de nada: nunca foram interrompidos e
// reaparecem sozinhos assim que o cartão opaco sai da frente. Só a letra
// sincronizada precisa ser remontada — e no slide certo, não do começo.
function restoreSceneAfterText() {
  const cur = stage.getCurrent();
  // NADA de fato em cena — nenhuma mídia carregada, ou a que havia já terminou
  // (só na playlist, ou tocada antes). O ponto de repouso do telão é o
  // WALLPAPER, não o preto: `showText` abriu a cortina para o cartão aparecer,
  // e sem isto ela ficava aberta sobre o vazio quando o texto saía.
  if (!cur || stage.hasEnded()) { stage.coverIn(false); return; }
  if (cur.kind === 'audio' && Array.isArray(cur.lyrics) && cur.lyrics.length) {
    showLyrics(cur);
    updateLyricSlide(stage.getTime());
  }
  // Última coisa, e para TODOS os tipos de mídia (antes só a letra era
  // remontada e os demais devolviam cedo): `showText` mexeu na cortina por
  // conta própria para o cartão aparecer, então sair de cena tem que devolvê-la
  // ao que a view vigente manda. Sem isto, um versículo tirado do ar com o
  // telão coberto deixava a cortina cobrindo uma mídia cuja view é 'visual' —
  // e o toque seguinte no botão de visual não fazia nada, porque para o stage
  // nada havia mudado.
  reconcileCover(stage.getView());
}

// A cortina do wallpaper é COMPARTILHADA (stage, YouTube e a camada de texto
// mexem nela), mas o estado de view é de quem é dono da cena. Este helper só
// faz a cortina obedecer a uma view já decidida — coverIn/coverOut devolvem
// cedo quando ela já está onde deveria, então chamar à toa não custa nem
// pisca nada no telão.
function reconcileCover(view) {
  // `stage.shouldCover()` cobre o caso do ÁUDIO SEM LETRA (v5.112): a view dele
  // é 'visual' como a de qualquer mídia, mas não há o que revelar — abrir a
  // cortina deixaria o telão no preto do palco. Só vale quando a cena é do
  if (view === 'wallpaper' || stage.shouldCover()) stage.coverIn(false);
  else stage.coverOut();
}

// ===== Texto VIVO: cronômetro/relógio/timer e sorteio =====
// É o MESMO cartão da Bíblia e das Mensagens (`mode: 'chrono'` | `'draw'`), e
// não por economia de CSS: herdando o cartão herda a regra de convivência já
// madura — `load` de áudio o mantém, `load` visual o encerra, a cortina do
// wallpaper o cobre, `text-hide` o tira sem parar o som de fundo. Um layer novo
// reimplementaria as quatro e envelheceria separado.
//
// O que muda em relação a um versículo é só a ORIGEM do texto: DERIVADO a cada
// tick de um descritor (chronoReading/drawReading em stage.js).
//
// Os dois modos vivos dividem UM laço só: o cartão é um só, e dois timers
// escrevendo no mesmo nó nunca seriam ambos corretos. Com registro único isso é
// estruturalmente impossível.
let micStream = null;
let micCtx = null;
let micSrc = null;
let micGain = null;
const MIC_RAMP = 0.12; // s — entrada/saída sem estalo

function micStatus(on, error) {
  AVDB.sendCommand({ type: 'mic-status', on: !!on, error: error || '' });
}

// Token da captura EM VOO. `micStream` sozinho não servia como guarda: ele só
// existe DEPOIS de o getUserMedia resolver, e o primeiro push-to-talk da sessão
// demora (permissão + onPermissionRequest do WebView). Um on→off→on nesse
// intervalo — o operador aperta, não ouve nada, solta e aperta de novo —
// disparava um SEGUNDO getUserMedia com o primeiro ainda pendente; quando os
// dois resolviam, o segundo sobrescrevia micStream/micSrc/micGain e o primeiro
// ficava com as trilhas vivas e o ganho ligado ao destination, sem ninguém
// para pará-lo: microfone aberto no telão (e o indicador de gravação do
// Android aceso) até o WebView do telão ser recriado.
let micSeq = 0;

async function startMic() {
  if (micStream) return; // já no ar
  // O ESPELHO NÃO ABRE MICROFONE, e a razão não é economia: ele é uma SEGUNDA
  // instância de `/display/`, e o comando `mic` chega às duas por broadcast.
  // A janela do espelho é montada sem o `MicChromeClient` de propósito (dois
  // `getUserMedia` no mesmo microfone é realimentação na caixa de som do
  // templo), então o WebView NEGA em silêncio — e a rejeição cairia no
  // `micStatus(false, …)` daqui, que o Controle aplica sem olhar de quem veio.
  // Ou seja: o espelho APAGARIA o estado do microfone real, no meio de um
  // push-to-talk. Sair antes de qualquer status é o que mantém o telão dono
  // dessa informação.
  const seq = ++micSeq;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    micStatus(false, 'unsupported');
    return;
  }
  // PARAR SÓ A MÍDIA — a outra metade da independência áudio × texto (v5.178).
  //
  // `clear` é o Parar do transporte e encerra a CENA INTEIRA. Faltava o
  // desligamento POR CAMADA na direção oposta ao `text-hide`: com louvor de
  // fundo sob a contagem regressiva, tirar a música levava o cronômetro junto.
  //
  // O ramo vem ANTES do bloco de `textActive`: lá dentro `clear` é o que chama
  // `hideText`, e cair no fluxo comum levaria o comando a um `stage.handle` que
  // não o conhece — nada aconteceria, sem erro nenhum.
  //
  // Quem decide entre as duas saídas é o DISPLAY: `textActive` é estado dele, e
  // duplicar a leitura do outro lado é garantir divergência num domingo.
  const TENTATIVAS = [
    { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    true,
  ];
  let stream = null;
  let ultimoErro = 'error';
  let semEco = false;
  for (let i = 0; i < TENTATIVAS.length; i++) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: TENTATIVAS[i], video: false });
      semEco = i > 0;
      break;
    } catch (e) {
      ultimoErro = (e && e.name) || 'error';
      // PERMISSÃO NEGADA não melhora com menos processamento: é resposta do
      // sistema (ou do `MicChromeClient`), e insistir só gasta duas chamadas
      // para dar o mesmo erro. Qualquer outra falha é candidata a ser o
      // dispositivo recusando aquela configuração — e essa vale tentar de novo.
      if (ultimoErro === 'NotAllowedError' || ultimoErro === 'SecurityError') break;
      // O operador pode ter soltado o botão entre uma tentativa e outra.
      if (seq !== micSeq || !micWanted) break;
    }
  }
  if (!stream) {
    diag('microfone recusado: ' + ultimoErro);
    micStatus(false, ultimoErro);
    return;
  }
  if (semEco) diag('microfone SEM cancelamento de eco (o modo com eco foi recusado)');
  // O operador pode ter soltado o botão (ou apertado de novo, começando outra
  // captura) enquanto a permissão era resolvida: nos dois casos este stream já
  // nasceu obsoleto e não pode virar áudio no telão — quem manda é a última
  // intenção, e o token diz se esta ainda é ela.
  if (seq !== micSeq || !micWanted) {
    stream.getTracks().forEach((t) => t.stop());
    // O Controle precisa saber que ISTO não virou microfone: o stopMic de
    // quem soltou o botão saiu cedo (micStream ainda era null — não havia o
    // que derrubar) e não emitiu nada, então sem esta linha o indicador do
    // botão ficava no último estado. Só quando o operador SOLTOU: se ele
    // apertou de novo (`micWanted` ainda true), a captura mais nova é quem
    // vai anunciar o próprio desfecho — um `false` daqui poderia chegar
    // DEPOIS do `true` dela e apagar um microfone que está no ar.
    if (!micWanted) micStatus(false);
    return;
  }
  micStream = stream;
  try {
    micCtx = micCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (micCtx.state === 'suspended') { try { await micCtx.resume(); } catch (_) {} }
    // O resume é OUTRO await, e um stopMic() aqui no meio já teria passado
    // batido: ele derruba as trilhas, mas não existiria micSrc/micGain para
    // desconectar — e a continuação abaixo ligaria a fonte ao destination
    // depois de o operador ter soltado o botão. Reconfere antes de conectar.
    if (seq !== micSeq || !micWanted) {
      stream.getTracks().forEach((t) => t.stop());
      if (micStream === stream) micStream = null;
      return;
    }
    micSrc = micCtx.createMediaStreamSource(micStream);
    micGain = micCtx.createGain();
    micGain.gain.value = 0;
    micSrc.connect(micGain);
    micGain.connect(micCtx.destination);
    micGain.gain.linearRampToValueAtTime(1, micCtx.currentTime + MIC_RAMP);
    micStatus(true);
  } catch (e) {
    stopMic();
    micStatus(false, (e && e.name) || 'audio-error');
  }
}

function stopMic() {
  // Invalida a captura em voo ANTES da saída antecipada: com `micStream` ainda
  // null (permissão não resolveu) esta função não tinha nada a derrubar, mas
  // precisa mesmo assim registrar que o operador soltou o botão — senão o
  // getUserMedia pendente vira um microfone aberto que nenhum comando desliga.
  ++micSeq;
  if (!micStream) return;
  const stream = micStream, src = micSrc, gain = micGain;
  micStream = null; micSrc = null; micGain = null;
  // Desliga em rampa e só então derruba a fonte — cortar no meio de uma
  // palavra produz um estalo bem audível numa caixa de som.
  const drop = () => {
    try { if (src) src.disconnect(); } catch (_) {}
    try { if (gain) gain.disconnect(); } catch (_) {}
    stream.getTracks().forEach((t) => t.stop());
    // SUSPENDE o contexto, não fecha: fechado exigiria criar outro no aperto
    // seguinte, e é justamente esse custo (e a latência de abertura) que se
    // quer evitar num push-to-talk. Suspenso, ele para de segurar a saída de
    // áudio. Só se ninguém tiver reaberto o microfone nesse meio tempo —
    // startMic religa com o resume que já existe lá.
    if (micCtx && !micStream) { try { micCtx.suspend(); } catch (_) {} }
  };
  if (gain && micCtx) {
    try {
      gain.gain.cancelScheduledValues(micCtx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, micCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0, micCtx.currentTime + MIC_RAMP);
    } catch (_) {}
    setTimeout(drop, MIC_RAMP * 1000 + 40);
  } else {
    drop();
  }
  micStatus(false);
}

// Intenção do operador (o botão está pressionado?). Guardada à parte de
// `micStream` porque a captura é assíncrona: sem isso, soltar o botão antes de
// a permissão resolver deixaria o microfone aberto sozinho.
let micWanted = false;

function setMic(on) {
  micWanted = !!on;
  if (micWanted) startMic(); else stopMic();
}

// ===== Wallpaper personalizado =====
// A cortina do telão aceita uma imagem escolhida pelo operador no lugar do
// gradiente padrão. A imagem vem do state `wallpaper` (blob), gravada pelo
// Controle; o comando `wallpaper` só avisa que ela mudou — o Display lê do
// IDB, que é compartilhado. Sem imagem, volta ao gradiente e à marca.
let wallpaperUrl = null;

// O wallpaper da TELA DA REDE — só a URL, sem IDB. A marca some pela mesma
// regra do applyWallpaper: wallpaper de verdade cobre a marca.
function telaWallpaperPadrao() {
  telaWpSeq++;                       // mata retentativas de uma imagem antiga
  try {
    wallpaperEl.style.backgroundImage = '';
  } catch (e) { /* já era o padrão */ }
}

let telaWpSeq = 0;
function telaAplicarWallpaper(url) {
  // PRÉ-CARREGA com retentativa: o comando com `__wp` pode chegar ANTES de o
  // empurrão do Controle ter aberto o item no cache do celular, e um
  // `background-image` que falha não retenta nunca. Um `Image()` com
  // retentativa cobre a corrida nos dois caminhos (troca de wallpaper e a
  // herança ao conectar), e só pinta o fundo quando há imagem de verdade — o
  // gradiente padrão nunca é coberto por nada quebrado.
  //
  // A LADEIRA DOBRA ATÉ UM PLATÔ, com teto de TEMPO — a mesma do fundo da letra
  // (`ESPERA_MAX`/`TETO_MS` acima) e pela mesma razão medida: os bytes do
  // wallpaper entram na MESMA fila serializada dos empurrões de mídia, então com
  // um louvor de 300 MB na frente eles só começam a chegar minutos depois.
  // Tentativas fixas somando ~6 s desistiam ANTES de existir possibilidade de
  // sucesso. `telaWpSeq` mata a retentativa de um wallpaper que outro já
  // substituiu, e é ele que mantém isto barato.
  const seq = ++telaWpSeq;
  const ESPERA_MAX = 2500;   // ms — o platô: não adianta martelar
  const TETO_MS = 45000;     // ms — desiste de vez
  const inicio = Date.now();
  let espera = 250;
  const tentar = () => {
    if (seq !== telaWpSeq) return;
    const img = new Image();
    img.onload = () => {
      if (seq !== telaWpSeq) return;
      try {
        wallpaperEl.style.backgroundImage = 'url(' + JSON.stringify(url) + ')';
      } catch (e) { /* fica o desenho padrão */ }
    };
    img.onerror = () => {
      if (seq !== telaWpSeq || Date.now() - inicio > TETO_MS) return;
      setTimeout(tentar, espera);
      espera = Math.min(espera * 2, ESPERA_MAX);
    };
    img.src = url;
  };
  tentar();
}

async function applyWallpaper() {
  let blob = null;
  try { blob = await AVDB.getState('wallpaper'); } catch (_) { /* segue no padrão */ }
  if (wallpaperUrl) { URL.revokeObjectURL(wallpaperUrl); wallpaperUrl = null; }
  if (blob instanceof Blob) {
    wallpaperUrl = URL.createObjectURL(blob);
    wallpaperEl.style.backgroundImage = 'url("' + wallpaperUrl + '")';
  } else {
    wallpaperEl.style.backgroundImage = '';
  }
}

// ===== Áudio sem toque: recuperação automática =====
// A política de autoplay dos navegadores pode bloquear som sem gesto do
// usuário. Em vez de exigir um toque no telão, o vídeo começa mudo e o áudio
// é religado sozinho em retentativas (num PWA instalado costuma liberar na
// primeira). NADA é exibido no telão: o estado vai no campo `audioBlocked`
// do display-status e o Controle avisa o operador. Um toque/tecla no Display
// (se acontecer) resolve na hora.
let audioBlocked = false;
let audioRetryTimer = null;

function pushStatus() { sendStatus(); }

function beginAudioRecovery() {
  // No app nativo não existe bloqueio de autoplay (ver #startBtn abaixo):
  // qualquer "bloqueio" detectado aqui seria falso positivo, e o efeito
  // visível seria o indicador âmbar de "sem áudio" aceso no mixer do
  // Controle sem motivo real.
  if (window.__NATIVE__) return;
  if (audioBlocked) return;
  audioBlocked = true;
  pushStatus();
  scheduleAudioRetry(1500);
}

function endAudioRecovery() {
  clearTimeout(audioRetryTimer);
  if (!audioBlocked) return;
  audioBlocked = false;
  pushStatus();
}

function scheduleAudioRetry(ms) {
  clearTimeout(audioRetryTimer);
  audioRetryTimer = setTimeout(tryRestoreAudio, ms);
}

// Este mecanismo de recuperação é exclusivo do stage (vídeo/áudio locais).
// O YouTube não usa detecção de bloqueio de autoplay: num PWA instalado o
// autoplay com som é liberado normalmente, e a antiga tentativa de detecção
// gerava falsos positivos (buffering demorado confundido com bloqueio),
// deixando o vídeo mutando/desmutando e reiniciando em loop.
function tryRestoreAudio() {
  if (!audioBlocked) return;
  const cur = stage.getCurrent();
  if (!cur || (cur.kind !== 'video' && cur.kind !== 'audio')) { endAudioRecovery(); return; }
  if (videoEl.paused) { scheduleAudioRetry(5000); return; } // não está tocando agora
  stage.setMute(false);
  setTimeout(() => {
    if (!audioBlocked) return;
    if (videoEl.paused) {
      // o navegador pausou ao desmutar: ainda bloqueado — segue mudo
      stage.setMute(true);
      stage.play();
      scheduleAudioRetry(5000);
    } else if (!videoEl.muted) {
      endAudioRecovery();
    } else {
      scheduleAudioRetry(5000);
    }
  }, 350);
}

// Qualquer gesto real no Display (toque, tecla de um controle remoto) concede
// a ativação do navegador — religa o áudio na hora (só se aplica ao stage).
function onUserGesture() {
  if (!audioBlocked) return;
  stage.setMute(false);
  stage.play();
  endAudioRecovery();
}
document.addEventListener('pointerdown', onUserGesture);
document.addEventListener('keydown', onUserGesture);

// ===== YouTube: SEM PLAYER DE TERCEIRO =====
//
// A IFrame Player API saiu (v5.212), com `YT.Player`/`ytHandle`/`ytStatus` e
// ~540 linhas de máquina de estados. Quem toca YouTube é o caminho próprio:
// transmissão direta (`ytStream` → `shared/mse.js` → `<video>` comum) e, se
// falhar, o arquivo baixado (`ytFetch`).
//
// POR QUE SAIU: `addJavascriptInterface` injeta em TODAS as frames, iframes de
// outra origem inclusive. No telão a ponte nasce `host = null` (invariante 9),
// mas o MESMO embed era criado no CONTROLE, para a preview, onde a ponte é a
// completa — a invariante 9 protegia a metade errada. Some junto: um segundo
// motor de transporte, um segundo emissor de status, uma máquina de mudo que
// ignorava o `forceMuted`, uma cortina própria, `if (yt)` em quinze pontos,
// dependência de rede em cena e a cena MUDA para as telas da rede.
//
// `kind: 'youtube'` (link sem bytes) não chega mais aqui como cena tocável:
// quem resolve é o Controle antes do `load` (`resolverLinkYoutube`). Chegando
// assim mesmo (bundle antigo), o palco esvazia e volta ao wallpaper.

// Um `pause` que o app não pediu é o EVENTO que interessa: é ele que o
// operador vê como "o vídeo parou". `pausaComandada` é armado por quem manda
// pausar de verdade, e zerado logo depois.
let pausaComandada = 0;
(function vigiarVideo() {
  const v = document.getElementById('video');
  if (!v) return;
  v.addEventListener('pause', () => {
    // A JANELA TEM DE COBRIR O FADE. O `pausaComandada` é armado quando o
    // COMANDO chega, e o `video.pause()` correspondente só acontece depois da
    // saída de cena — `clear` esmaece por `fadeCfg.time` antes de parar o
    // elemento. Com 400 ms fixos contra um fade de 600 ms, TODA parada pedida
    // pelo operador era carimbada "PAUSA ESPONTÂNEA" no Registro, que é o
    // artefato lido a distância justamente para separar as duas coisas.
    const meu = Date.now() - pausaComandada < (fadeCfg.time * 1000 + 400);
    diag(meu ? 'pausa (comando)' : 'PAUSA ESPONTÂNEA', { t2: Math.round(v.currentTime) });
  });
  v.addEventListener('play', () => diag('play', { t2: Math.round(v.currentTime) }));
  v.addEventListener('stalled', () => diag('travou'));
  v.addEventListener('emptied', () => diag('esvaziou'));
})();

AVDB.onCommand(async (cmd) => {
  // A guarda vem PRIMEIRO: ela estava três linhas abaixo, depois de dois
  // acessos a `cmd.type` — ou seja, o comando nulo que ela existe para barrar
  // já teria derrubado o handler antes de chegar nela. Hoje `deliverCommand`
  // filtra o nulo antes daqui, então isto é cinto e suspensório; a ordem
  // errada é que não podia ficar, porque quem lê conclui que o caso está
  // coberto.
  if (!cmd) return;
  // COMANDO ENDEREÇADO: o barramento é broadcast, mas a resposta a um
  // `display-ready` é para UMA instância. Sem esta linha, uma segunda página
  // do Display (uma aba aberta para depurar, uma restaurada pelo navegador, e
  // amanhã uma tela na rede local) fazia a TV rodar um `load` inteiro — fade,
  // releitura, re-seek — por um evento que era de outra. Comando sem `__para`
  // é para todos, que é o caso de TODOS os comandos de operação: só o reenvio
  // de cena endereça.
  if (cmd.__para && cmd.__para !== INSTANCIA) return;
  // `media-clear` ENTRA: ele é o "tirar a mídia do ar" com a Camada de Texto em
  // cena (v5.178), e por não estar nesta lista toda parada por ele saía como
  // espontânea.
  if (cmd.type === 'pause' || cmd.type === 'clear' || cmd.type === 'media-clear'
    || cmd.type === 'load') pausaComandada = Date.now();
  // O Controle pede a caixa-preta ao abrir Configurações.
  if (cmd.type === 'diag-ask') {
    AVDB.sendCommand({ type: 'diag-dump', linhas: diario.slice(-DIAG_MAX) });
    return;
  }

  // Preenchimento (object-fit): vai direto pro stage. (O desvio explícito
  // nasceu para não cair no `ytHandle` do embed, que ignorava 'fit'; com o
  // embed fora — v5.212 — ele continua sendo o caminho mais curto e o mais
  // legível, então fica.)
  if (cmd.type === 'fit') {
    stage.setFit(cmd.fit);
    return;
  }

  // Giro da mídia (v5.142): mesmo desvio explícito do `fit`.
  if (cmd.type === 'rotate') {
    stage.setRotate(cmd.rotate);
    return;
  }

  // Fundo da letra sincronizada (preto/imagens dos slides) — não é um
  // comando do stage.js, letra é camada paralela (ver setLyricsBgMode).
  if (cmd.type === 'lyricsbg') {
    setLyricsBgMode(cmd.mode);
    return;
  }

  // Texto manual (Bíblia/Mensagem): camada paralela (ver showText). Um novo
  // 'text' mostra/atualiza o cartão; 'text-hide' encerra sem tocar na mídia.
  if (cmd.type === 'text') { showText(cmd); return; }
  if (cmd.type === 'text-hide') { hideText(); return; }
  // Wallpaper trocado no Controle: a imagem já está no state compartilhado.
  if (cmd.type === 'wallpaper') {
    // NA TELA DA REDE a imagem não está no IDB (que é por-aparelho): ela vem
    // pela URL /m/ que o Controle anexou ao próprio comando (telão por
    // comandos, E4). No telão e no espelho, o caminho de sempre.
    if (TELA) {
      // SEM `__wp` A TELA NÃO FAZ NADA — e antes ela APAGAVA. O caminho de
      // baixo lê o wallpaper do IndexedDB, que é POR APARELHO: no navegador da
      // rede ele está vazio, então `applyWallpaper()` ali só pode desfazer o
      // inline que o `__wp` tinha acabado de pintar. E o Controle emite os dois:
      // `setWallpaper` manda o aviso NU ("mudou, releiam o estado") e o
      // enriquecimento manda o `__wp` num segundo tempo, depois de ler o blob —
      // então toda troca de wallpaper piscava o desenho padrão nas telas da
      // rede, e ficava NELE se o segundo comando se perdesse.
      if (!cmd.__wp) return;
      // `'padrao'` é o sentinela de "voltou ao padrão": a tela desfaz o
      // inline e o desenho padrão do CSS volta a valer (v5.188).
      if (cmd.__wp === 'padrao') telaWallpaperPadrao(); else telaAplicarWallpaper(cmd.__wp);
      return;
    }
    applyWallpaper();
    return;
  }
  // Microfone ao vivo: camada de ÁUDIO independente — não toca na mídia, no
  // texto nem na cortina. Convive com qualquer coisa em cena.
  if (cmd.type === 'mic') { setMic(cmd.on); return; }

// No app nativo o overlay "Ligar Sistema" NÃO EXISTE
// (`mediaPlaybackRequiresUserGesture = false`: não há política de gesto, e
// exigir um toque numa TV seria beco sem saída).
//
// E NO PAPEL `tela` também não, pela razão OPOSTA: ali há política de gesto,
// mas o gesto é do "Ativar esta tela" do `tela.js`, que gasta a ativação
// transitória em pareamento + som + tela cheia. Este só se esconde. Dois
// overlays de gesto na mesma página são armadilha: o visitante gasta o toque no
// que estiver na frente, e era este (`inset: 0`, pílula no centro).
//
// A REGRA VIVE AQUI, no documento que DECLARA o botão: morando no `tela.js` ela
// tinha buraco — era escondida dentro de `montarEntrada()`, que a recarga com
// sessão viva nunca chama, e um F5 trazia o botão de volta sobre a projeção.
  if (cmd.type === 'media-clear') {
    hideLyrics(true);
    aoSairDeCena(stage.handle({ type: textActive ? 'clear-media' : 'clear' }));
    return;
  }
  // Enquanto o texto manual está em cena, ele é um OVERLAY independente:
  //  - 'view' liga/desliga a cortina do wallpaper por cima do texto;
  //  - transporte (play/pause/seek/volume/mute) segue pro stage — controla o
  //    ÁUDIO DE FUNDO (o texto não é afetado);
  //  - 'load' de ÁUDIO troca o som de fundo mantendo o texto; 'load' de VISUAL
  //    (vídeo/imagem) e 'clear' encerram o texto e seguem o fluxo.
  if (textActive) {
    if (cmd.type === 'view') {
      const v = cmd.view === 'wallpaper' ? 'wallpaper' : 'visual';
      textView = v;
      // A cortina passa a ser do CARTÃO enquanto ele estiver no ar.
      if (stage.setOverlay) stage.setOverlay(v);
      // Delega ao DONO do estado (o stage) em vez de mexer na cortina por fora:
      // mover a cortina direto deixava `stage.view` congelado, e o `view`
      // seguinte concluía "nada mudou" e retornava — botão de cobrir morto. Na
      // direção oposta, o `play` seguinte reavaliava computeCover() e
      // DESCOBRIA o telão sozinho.
      // `overlay: true`: o cartão de texto está acima do stage, então descobrir
      // revela algo mesmo sem mídia. Sem o aviso o stage pularia a transição
      // (sem mídia a cortina cobre nos dois valores de view) e o versículo
      // apareceria seco.
      await stage.handle({ type: 'view', view: v, overlay: true });
      // O cartão de texto é INDEPENDENTE da mídia — um versículo no ar sem
      // nada carregado é o caso mais comum na pregação. Para o stage, porém,
      // "sem mídia" (ou mídia terminada) quer dizer cortina fechada
      // (computeCover), e o instantCover final de setViewFaded reengoliria o
      // versículo logo depois do fade. Reafirma a cortina aberta agora que o
      // estado interno da view já foi atualizado, que é o que o delegar acima
      // veio buscar. `textActive` é reconferido porque o fade dura 0,6 s: se
      // nesse meio tempo o texto saiu de cena, quem manda é
      // restoreSceneAfterText.
      if (textActive && textView === 'visual') stage.instantCover(false);
      return;
    }
    if (cmd.type === 'clear') hideText(false);
    // O 'load' com texto em cena é decidido no bloco principal, logo abaixo,
    // com UMA leitura do registro — este bloco fazia um `getMedia` próprio e o
    // principal repetia a MESMA leitura duas linhas depois, um IDB pago em
    // dobro a cada troca de mídia durante a pregação.
    // demais comandos (play/pause/seek/volume/mute) caem no fluxo normal abaixo.
  }

  if (cmd.type === 'load') {
    // Esconde a letra incondicionalmente ANTES de qualquer coisa (mesmo
    // padrão do loadSeq do stage.js): sem isso, trocar de um hino direto pra
    // um vídeo do YouTube nunca escondia o layer de letra de verdade — só
    // ficava mascarado por sorte de ordem de pintura no DOM.
    hideLyrics(true);
    const rec = await AVDB.getMedia(cmd.mediaId);
    // Texto manual em cena: 'load' VISUAL o encerra, 'load' de áudio o mantém
    // (o som de fundo troca por baixo do cartão). Sem restaurar a cena: o
    // próprio load abaixo monta a nova (restaurar aqui faria a antiga piscar).
    if (textActive && (!rec || rec.kind !== 'audio')) hideText(false);
    // O ITEM DE LINK NÃO TOCA MAIS AQUI (v5.212).
    //
    // Quem o resolve — por transmissão direta ou download — é o Controle,
    // ANTES de emitir o `load` (`resolverLinkYoutube`). Um `kind: 'youtube'`
    // que chegue assim mesmo é um registro que este documento não sabe
    // desenhar: bundle antigo do outro lado, ou um item guardado antes desta
    // versão. A resposta honesta é esvaziar o palco — o telão volta ao
    // wallpaper, que é o ponto de repouso e diz "não há nada em cena" — em vez
    // de deixar congelada a cena ANTERIOR, que mentiria sobre o que o operador
    // acabou de pedir. Nada de `media-ended` daqui: ele avançaria a playlist
    // sozinho, e um item que não toca viraria um laço.
    if (rec && rec.kind === 'youtube') {
      diag('link do YouTube nao tocavel neste papel', { s: String(cmd.mediaId || '') });
      aoSairDeCena(stage.handle({ type: 'clear' }));
      return;
    }
    if (rec && rec.kind === 'audio' && Array.isArray(rec.lyrics) && rec.lyrics.length) showLyrics(rec);
    stage.handle(cmd);
    return;
  }

  // Passar SLIDE da apresentação: só a imagem do palco troca (ver `page` no
  // stage.js). Não passa pelo `load` de propósito — recarregar a mídia para
  // trocar uma página que já está na mão faria o telão piscar preto a cada
  // slide, na frente da congregação.
  if (cmd.type === 'page') {
    stage.handle(cmd);
    return;
  }

  if (cmd.type === 'clear') {
    hideLyrics(true);
    aoSairDeCena(stage.handle(cmd));
    return;
  }

  // Operador pediu (botão de mudo do mixer): retentativa imediata de áudio.
  if (cmd.type === 'audio-retry') {
    if (audioBlocked) tryRestoreAudio();
    return;
  }

  stage.handle(cmd);
});

async function restore() {
  // (SAIU NA v5.212: o prefetch do script da IFrame Player API. Ele já era
  //  guardado por `!window.__NATIVE__`, justamente porque injetar script de
  //  terceiro no origin privilegiado era o custo que ninguém queria pagar em
  //  toda sessão. Com o embed fora dos dois papéis, não há o que adiantar.)
  // Config de transições (fade) definida no Controle — preferência visual,
  // não é "tocar" nada.
  // Transições são INERENTES ao sistema (sempre ligadas, duração fixa — ver
  // fadeCfg acima): não há mais config salva nem ajustável; aplica o valor fixo.
  stage.setFade({ fadeIn: fadeCfg.in, fadeOut: fadeCfg.out, time: fadeCfg.time });
  // As preferências visuais ficam num try/finally porque ANUNCIAR-SE não pode
  // depender delas. Toda a reconexão do sistema pende do 'display-ready' (é ele
  // que dispara o resendSceneToDisplay do Controle): se uma leitura do IDB
  // rejeitasse — upgrade bloqueado, armazenamento despejado, transação
  // abortada —, a Presentation recriada depois de um blip do espelhamento
  // ficava parada no wallpaper, sem nada no Controle explicando e sem outra
  // saída além de reiniciar o app. Perder o fundo da letra ou o wallpaper é
  // um defeito visível e recuperável; perder a reconexão, não.
  try {
    // Fundo da letra sincronizada (preto/imagens dos slides) — preferência
    // visual, igual ao fade/fit.
    const lyricsBg = await AVDB.getState('lyricsBg');
    lyricsBgMode = lyricsBg === 'image' ? 'image' : 'black';
    applyLyricsBgClass();
    // Preenchimento da mídia (ajustar/preencher/esticar) — preferência visual,
    // igual ao fade acima.
    const fit = await AVDB.getState('fit');
    if (fit) stage.setFit(fit);
    // Giro da mídia — a mesma preferência visual persistida, lida no arranque
    // pelo mesmo motivo: o telão pode ser recriado (queda do dongle) no meio de
    // uma projeção girada, e voltar ao zero desfaria o ajuste na frente de todo
    // mundo. O reenvio de cena do Controle o repete; esta leitura é o piso para
    // o instante entre o `display-ready` e a resposta dele.
    const rot = await AVDB.getState('rotate');
    if (rot) stage.setRotate(rot);
    // Wallpaper escolhido pelo operador — preferência visual, igual às acima.
    await applyWallpaper();
  } catch (_) {
    // Segue nos padrões (preto na letra, 'contain' no fit, gradiente no fundo).
  } finally {
    // NÃO recarrega nem toca a última mídia sozinho: abrir o Display nunca
    // deve iniciar reprodução por conta própria — fica no wallpaper (ponto
    // inicial) até um comando explícito chegar. O Controle, ao receber
    // 'display-ready', decide (baseado no que ELE sabe que estava tocando,
    // não em algo persistido pelo próprio Display) se reenvia um 'load' para
    // retomar.
    diag('telão pronto');
    // `__de` é a ASSINATURA do pedido: o Controle reenvia a cena só para quem
    // se anunciou (ver `resendSceneToDisplay`). Sem ela — bundle antigo do lado
    // do Controle — o reenvio continua sendo broadcast, como sempre foi.
    AVDB.sendCommand({ type: 'display-ready', __de: INSTANCIA });
  }
}

// Toque único ao abrir ("Ligar Sistema"): o gesto real (pointerdown, que já
// borbulha para o listener de recuperação de áudio do stage) libera autoplay
// com som em conteúdo de terceiros (iframe do YouTube) pelo resto da sessão.
// Some para sempre no primeiro toque — se um YouTube já tiver sido restaurado
// (restore() abaixo) antes do toque, o clique dá um empurrão imediato
// (play + som); mesmo sem isso, ytWatchStart() e o resync de mudo em
// ytStartTimeLoop() convergiriam sozinhos em até alguns segundos. Além de
// ativar o Display, o mesmo gesto abre o Controle (mesma ressalva do botão
// "Abrir Display" do Controle: sem API web garantida para lançar outro PWA
// instalado, pode cair numa aba comum do Chrome como fallback).
const startBtnEl = document.getElementById('startBtn');

// ===== O TELÃO QUE ESTÁ SAINDO DE CENA NÃO REPORTA =====
//
// `clear`/`media-clear` esmaecem antes de sair (~0,6 s) e o `<video>` continua
// tocando (a rampa é de volume, não de pausa), então cada `display-status` do
// fade contava uma cena encerrada com `playing: true` e o tempo antigo. No
// Controle isso repunha a barra e o ícone que o Parar zerou (o "só funciona no
// segundo toque"); na NOTIFICAÇÃO era pior, porque ali não há segundo toque —
// o `snoopDisplayStatus` lê este mesmo status. Corrigir na FONTE fecha os dois
// consumidores sem APK.
//
// É um CONTADOR, nunca booleano: dois clears sobrepostos fariam o primeiro a
// terminar liberar o segundo. Um `load` durante o fade cancela o clear pelo
// `loadSeq`, mas a promise resolve do mesmo jeito — daí o decremento morar no
// `then`, nunca num ponto de sucesso.
if (window.__NATIVE__ || TELA) startBtnEl.hidden = true;
// "Ligar Display" APENAS ativa o Display (gasta o gesto real que o navegador
// exige para tocar com som). O Display é INDEPENDENTE — não abre o Controle
// nem redireciona pra lugar nenhum.
startBtnEl.addEventListener('click', () => {
  // Feedback de toque (pill "confirma" antes de sumir) — sem isso o overlay
  // desaparece no mesmo instante do clique e o toque parece não ter feito nada.
  startBtnEl.classList.add('confirming');
  setTimeout(() => { startBtnEl.hidden = true; }, 300);
}, { once: true });

// NÃO há auto-atualização por service worker aqui. Havia um bloco que
// registrava `sw.js` e recarregava a página no `controllerchange` (adiando até
// o telão ficar idle), mas o `sw.js` saiu do bundle junto com os andaimes dos
// dois PWAs instaláveis: no navegador o register devolvia 404 e a promise era
// engolida pelo .catch, e no app nativo o bloco nem chegava a rodar. Ou seja,
// código morto nos dois contextos, sugerindo ao próximo leitor uma atualização
// que não existia. Quem atualiza a base web agora é o OTA do shell, aplicado
// no PRÓXIMO lançamento — justamente para nunca recarregar o WebView do telão
// no meio de um culto.

// ===== O papel `espelho` (o ESPELHO DE PIXELS) foi REMOVIDO (E7) =====
//
// O bloco inteiro do áudio do espelho (AudioWorklet → __avEspelhoAudio →
// AAC) e o batimento de 8 Hz que forçava o SurfaceFlinger a recompor viviam
// aqui — eram a metade web do pipeline de pixels. O substituto é o TELÃO
// POR COMANDOS (docs/TELAO-POR-COMANDOS.md): as telas da rede rodam este
// MESMO documento no papel `tela` e tocam a mídia com a própria faixa de
// som — a sincronia A/V é do navegador de cada uma, e não há mais nada a
// capturar, codificar ou pulsar deste lado.

restore();
