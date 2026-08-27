const wallpaperEl = document.getElementById('wallpaper');
const imgEl = document.getElementById('img');
const videoEl = document.getElementById('video');
const lyricsEl = document.getElementById('lyrics');
const lyricsImgEl = document.getElementById('lyricsImg');
const lyricsContentEl = document.getElementById('lyricsContent');
const lyricsBoxEl = document.getElementById('lyricsBox');
const lyricsLineEl = document.getElementById('lyricsLine');
const lyricsAuxEl = document.getElementById('lyricsAux');
const lyricsNumEl = document.getElementById('lyricsNum');
const textEl = document.getElementById('text');
const textContentEl = document.getElementById('textContent');
const textMainEl = document.getElementById('textMain');
const textSubEl = document.getElementById('textSub');
const textImgEl = document.getElementById('textImg');

// IDENTIDADE DESTA INSTÂNCIA, por CARREGAMENTO da página. Existe para o
// Controle poder ENDEREÇAR o reenvio de cena a quem acabou de se anunciar, em
// vez de acordar todo mundo que estiver ouvindo o barramento (ver o `__para`
// no `onCommand` lá embaixo). Aleatório, e não um contador, pelo mesmo motivo
// dos ids da ponte: duas páginas que recarregam começariam ambas em "1".
// `padEnd` porque `toString(36)` de uma mantissa que termina em zeros devolve
// menos caracteres do que o `slice` pede — o mesmo cuidado que `shared/native.js`
// tem com a época dele.
const INSTANCIA = 'd' + Math.random().toString(36).slice(2, 10).padEnd(8, '0');

// O TERCEIRO PAPEL (telão por comandos, docs/TELAO-POR-COMANDOS.md): este MESMO
// documento rodando num navegador da LAN, servido pelo celular, com os comandos
// chegando por SSE pela casca `espelho/tela.js`. É o mesmo arquivo, o mesmo
// barramento e a mesma cena do telão de verdade — o que muda é o PAPEL, e toda
// diferença de comportamento pendura NESTA constante.
//
// Ela é falsa no telão e no navegador de desenvolvimento (sem a ponte não há
// `__AV_ROLE__`), que é a regra de escrita do projeto: o comportamento de sempre
// é o padrão, o novo é a exceção que se declara.
//
// (Aqui havia um bloco gêmeo descrevendo um `ESPELHO` — o papel do espelho de
// PIXELS, removido na v5.187 junto com a constante. O comentário ficou de pé e
// passou a afirmar, no presente, um identificador que não existe em lugar
// nenhum. A história dele mora em passado no rodapé deste arquivo e em
// `docs/ESPELHO-DE-PIXELS.md`.)
const TELA = window.__AV_ROLE__ === 'tela';

// Config de transições. INERENTE ao sistema: toda troca visual é animada com
// fade, sempre — não há opção de desligar nem ajustar. Vem de stage.js para não
// existirem duas cópias do mesmo objeto (Display e Controle) podendo divergir.
const fadeCfg = createStage.FADE;

// Fonte única do payload display-status: quem chama só preenche os valores; o
// `type` e o `audioBlocked` ficam num lugar só, evitando que os dois campos
// saiam inconsistentes para o Controle.
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

let saindoDeCena = 0;
// Declarados AQUI, e não junto do `aoCarregar` lá embaixo, porque o
// `aoSairDeCena` logo abaixo os toca: um `let` alcançado de cima é uma zona
// morta esperando a ordem de chamada mudar (a mesma razão do
// `cifraAdotarVelocidade`, no `controle.js`).
let carregando = 0;
let restaurarAoAssentar = false;
function aoSairDeCena(p) {
  saindoDeCena++;
  // A CENA SAINDO CANCELA A RESTAURAÇÃO ADIADA (ver `aoCarregar`). Zerar aqui, e
  // não em cada ramo de `clear`: é por esta função que TODA saída de cena passa,
  // então um caminho novo nasce coberto. Conferir `getCurrent()` no callback do
  // `aoCarregar` NÃO serviria — `clearFaded` faz `++loadSeq` de imediato e o load
  // em voo resolve na hora, mas o `current` só vira `null` depois do fade: no
  // instante em que aquele `.then` roda, ele ainda é o registro ANTIGO, e a
  // letra dele voltaria sobre um palco já esvaziado.
  restaurarAoAssentar = false;
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
  // O ERRO DE MÍDIA DO TELÃO não tinha para onde ir. A PREVIEW já mandava o
  // dela ao Registro (`ERRO DE MÍDIA na preview`); aqui ele terminava num
  // `console.warn` DENTRO de uma Presentation — uma janela sem console, num
  // aparelho que ninguém liga no computador durante o culto. O sintoma na sala
  // é o telão preto, e o Registro não tinha uma linha para explicá-lo.
  onError: (ev) => {
    const el = ev && ev.target;
    const cod = (el && el.error && el.error.code) || '?';
    diag('ERRO DE MÍDIA no telão (código ' + cod + ')', { t2: Math.round(videoEl.currentTime || 0) });
  },
  onStreamErro: (rec, porque) => { diag('transmissão falhou no telão: ' + porque); },
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
// Camada paralela ao stage.js: ele não sabe nada sobre texto/letra, só
// gerencia wallpaper/img/video. O layer #lyrics vive no mesmo z-index dos
// demais layers de mídia, então a cortina do wallpaper (z-index maior, já
// existente) cobre/revela-o de graça.
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
// 'image' (PADRÃO) usa as imagens dos slides atrás do texto; 'black' as ignora
// e mantém o fundo preto. Persistido em state.lyricsBg pelo Controle, aplicado
// ao vivo via comando (ver setLyricsBgMode). No papel `tela` não há IndexedDB do
// app para ler: este valor É o que ela mostra até o `lyricsbg` do reenvio chegar.
let lyricsBgMode = 'image';

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
  // ANTES do fade: a escala é medida com o texto novo já no lugar, e medir
  // durante a transição leria uma caixa a meio caminho.
  ajustarLetra();
  animateFadeIn(lyricsLineEl);
  if (!lyricsAuxEl.hidden) animateFadeIn(lyricsAuxEl);

  applyLyricsImage(slide);
}

/**
 * ===== A LETRA NUNCA É CORTADA COM RETICÊNCIAS (v1.1.8) =====
 *
 * Pedido do operador: *"ela não pode de forma alguma cortar a letra com
 * reticências independente do tamanho da tela"*.
 *
 * Até aqui a garantia era um `-webkit-line-clamp: 2` na `.lyrics-line` — e ele
 * é justamente a resposta que um telão não pode dar: o verso que some é o que a
 * congregação ia cantar, e ninguém no salão tem como saber que faltou. O clamp
 * saiu; o que garante que cabe é esta medição.
 *
 * O QUE ELA AJUSTA É A ESCALA DO CONJUNTO (`--lyrics-escala`), não o corpo de
 * uma peça. Encolher só a estrofe faria o "Refrão" ficar maior que ela, e a
 * hierarquia calibrada (linha 8cqmin, rótulo 4,2, número 5,8) é o desenho —
 * o que este ajuste muda é o tamanho do conjunto inteiro.
 *
 * BUSCA BINÁRIA e não um laço decrescente: sete passadas resolvem qualquer
 * estrofe, e o custo é conhecido. Um laço de −5% por vez faria de 1 a 30
 * releituras de layout conforme o texto — e o pior caso cai justamente na
 * estrofe mais longa, que é quando a troca de slide precisa ser instantânea.
 *
 * O PISO existe (`ESCALA_MIN`) porque tamanho de letra tem um limite abaixo do
 * qual não se lê do fundo do salão: uma estrofe absurda encolhe até ele e o
 * `overflow: hidden` da caixa contém o resto. É a única saída em que ainda se
 * corta — e ela é ordens de grandeza mais rara que o clamp de duas linhas.
 */
const ESCALA_MAX = 1;
const ESCALA_MIN = 0.34;
function cabeNaCaixa() {
  const cs = getComputedStyle(lyricsBoxEl);
  const util = lyricsBoxEl.clientHeight
    - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
  if (util <= 0) return true;   // caixa ainda sem layout: nada a decidir
  const gap = parseFloat(cs.rowGap) || 0;
  // Só as peças VISÍVEIS: o número e o rótulo somem em quase todo slide, e
  // contá-los ocultos reservaria altura que ninguém usa — a estrofe encolheria
  // sem precisar.
  const pecas = [...lyricsBoxEl.children].filter((el) => !el.hidden);
  const alto = pecas.reduce((soma, el) => soma + el.getBoundingClientRect().height, 0)
    + gap * Math.max(0, pecas.length - 1);
  return alto <= util + 0.5;
}
function ajustarLetra() {
  if (!lyricsBoxEl) return;
  const escrever = (v) => lyricsBoxEl.style.setProperty('--lyrics-escala', String(v));
  escrever(ESCALA_MAX);
  // O CASO COMUM SAI AQUI, sem nenhuma passada: a estrofe de duas linhas para a
  // qual a caixa foi calibrada cabe no tamanho cheio.
  if (cabeNaCaixa()) return;
  let cabe = ESCALA_MIN;
  let naoCabe = ESCALA_MAX;
  for (let i = 0; i < 7; i++) {
    const meio = (cabe + naoCabe) / 2;
    escrever(meio);
    if (cabeNaCaixa()) cabe = meio; else naoCabe = meio;
  }
  escrever(cabe);
}
// A TELA MUDA DE TAMANHO SEM O SLIDE MUDAR: o dongle entra, a TV troca de
// resolução, a janela do navegador da tela da rede é redimensionada. Sem isto a
// escala medida para a caixa anterior ficaria de pé — grande demais (voltando a
// cortar) ou pequena demais (letra miúda numa tela que agora cabe tudo).
if (window.ResizeObserver && lyricsBoxEl) {
  new ResizeObserver(() => ajustarLetra()).observe(lyricsBoxEl);
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

let liveKind = '';    // 'chrono' | 'draw' | ''
let liveDesc = null;
let liveTimer = null;

// O RELÓGIO DA ORIGEM — a diferença entre ele e `Date.now()` é uma hora errada
// na frente da congregação.
//
// Cronômetro e sorteio viajam por DESCRITOR ancorado numa época do CELULAR
// (`startAt`, `rollUntil`), e o modo RELÓGIO desenha a hora corrente. Nos dois
// a conta é contra o relógio de QUEM MANDOU: numa tela da rede o segundo é o de
// uma Smart TV, que pode estar minutos fora, e a hora corrente não viaja em
// campo nenhum.
//
// `__avAgora` é publicado pela casca do papel `tela` (`espelho/tela.js`), que
// mede o desvio pela mediana das épocas do ping. No telão e no navegador ele não
// existe e o `Date.now()` de sempre JÁ É a origem — é o mesmo aparelho.

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

// ===== A IMAGEM SOBRE O ÁUDIO (v5.312) =====
//
// Ela é um MODO desta camada, e não uma camada nova, porque a camada já resolve
// o problema inteiro: é um cartão OPACO acima de toda a mídia (`.text-layer`,
// z-index 2), declara `stage.setOverlay` e **não emite `load` nenhum** — por
// isso a mídia por baixo segue tocando, com a posição intacta. Era isso que
// faltava à imagem: projetá-la pelo caminho normal passa pelo `loadInner`, que
// desmonta o `<video>` incondicionalmente (medido: o áudio parava e voltava ao
// segundo zero).
//
// A URL é revogada em UM lugar (aqui e no `hideText`, pelo mesmo helper): um
// objectURL por imagem projetada, num app que fica aberto o culto inteiro, é
// vazamento de memória no processo que também segura os dois WebViews.
let textImgUrl = null;
let textImgSeq = 0;
// Sequencial pelo mesmo motivo do `lyricLoadSeq`: a resolução é assíncrona
// (IDB/OPFS/rede) e um segundo comando pode chegar antes de o primeiro
// terminar — sem a guarda, a imagem ANTERIOR pintaria por cima da atual. O
// degrau mora AQUI, no `soltarTextImg`, e não no começo do `pintarTextImg`:
// tirar o cartão do ar (`hideText`, ou um `text` de outro modo) tem que matar
// junto a ladeira de retentativa lá de baixo, senão ela repinta a imagem sobre
// uma cena que já andou.
function soltarTextImg() {
  ++textImgSeq;
  if (textImgUrl) { URL.revokeObjectURL(textImgUrl); textImgUrl = null; }
  textImgEl.hidden = true;
  textImgEl.removeAttribute('src');
}
async function pintarTextImg(cmd) {
  soltarTextImg();
  const seq = ++textImgSeq;
  let rec = cmd.__rec || null;
  if (!rec && cmd.mediaId) { try { rec = await AVDB.getMedia(cmd.mediaId); } catch (_) { rec = null; } }
  if (seq !== textImgSeq) return;
  if (!rec) return;
  let src = '';
  if (rec.blob) { textImgUrl = URL.createObjectURL(rec.blob); src = textImgUrl; }
  else if (rec.opfsPath) {
    let f = null;
    try { f = await AVDB.opfsGetFile(rec.opfsPath); } catch (_) {}
    if (seq !== textImgSeq) return;
    if (f) { textImgUrl = URL.createObjectURL(f); src = textImgUrl; }
  } else if (rec.url) {
    // TELA DA REDE: a chave É a URL (`/m/<token>`), e os bytes podem ainda
    // estar na fila do empurrão do Controle — um `src` que 404a não retenta
    // NUNCA, e este cartão é OPACO: o que fica sobre a projeção é um retângulo
    // preto até alguém trocar a cena. Ladeira igual à do fundo da letra e à do
    // wallpaper, e pela mesma razão medida (os empurrões são serializados, e um
    // louvor grande na frente atrasa a imagem por minutos): dobra até um platô,
    // teto de TEMPO, morta pelo `textImgSeq`. Sem object URL: nada a revogar.
    const ESPERA_MAX = 2500;   // ms — o platô: não adianta martelar
    const TETO_MS = 45000;     // ms — desiste de vez
    const prazoFinal = Date.now() + TETO_MS;
    let esperaMs = 250;
    const tentar = () => {
      if (seq !== textImgSeq) return;
      const img = new Image();
      img.onload = () => {
        if (seq !== textImgSeq) return;
        textImgEl.src = rec.url;
        textImgEl.hidden = false;
      };
      img.onerror = () => {
        if (seq !== textImgSeq || Date.now() >= prazoFinal) return;
        setTimeout(tentar, esperaMs);
        esperaMs = Math.min(esperaMs * 2, ESPERA_MAX);
      };
      img.src = rec.url;
    };
    tentar();
    return;
  }
  if (!src) return;
  textImgEl.src = src;
  textImgEl.hidden = false;
}

function showText(cmd) {
  const wallpaper = cmd.view === 'wallpaper';
  textMode = cmd.mode === 'message' ? 'message'
    : (cmd.mode === 'chrono' || cmd.mode === 'draw' || cmd.mode === 'image') ? cmd.mode : 'verse';
  textContentEl.classList.toggle('mode-message', textMode === 'message');
  textContentEl.classList.toggle('mode-chrono', textMode === 'chrono');
  textContentEl.classList.toggle('mode-draw', textMode === 'draw');
  textEl.classList.toggle('mode-img', textMode === 'image');
  if (textMode === 'image') {
    // A resolução é assíncrona e a camada entra JÁ: o cartão preto aparece no
    // mesmo quadro e a imagem pinta nele. O contrário — esperar para só então
    // mostrar — deixaria a mídia por baixo à vista durante a leitura do IDB.
    clearLive();
    textMainEl.textContent = '';
    pintarTextImg(cmd);
  } else if (textMode === 'chrono') {
    startLive('chrono', cmd.chrono || {});
  } else if (textMode === 'draw') {
    startLive('draw', cmd.draw || {});
  } else {
    clearLive();
    textMainEl.textContent = cmd.main || '';
  }
  if (textMode !== 'image') soltarTextImg();
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
  soltarTextImg();
  textEl.classList.remove('mode-img');
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

// UM `load` EM VOO ADIA A RESTAURAÇÃO — e a janela não é um fio de navalha.
// `stage.handle({type:'load'})` só troca o `current` depois do fade de saída
// (os ~600 ms de FADE.time, em TODA troca de cena) e do `getMedia`: dentro dela
// `stage.getCurrent()`, `hasEnded()` e `getTime()` ainda são os da mídia
// ANTERIOR, e um `text-hide` que chegue aí remonta a letra do hino VELHO sobre
// a música nova — andando pelo relógio dela, e PARA SEMPRE: nada reavalia
// depois. Adiar, e não adivinhar: assentado o load, a restauração é a de
// sempre. CONTADOR e não booleano (dois loads sobrepostos), com o decremento no
// `then` pelo mesmo motivo do `saindoDeCena` — um load cancelado pelo `loadSeq`
// resolve do mesmo jeito. (A metade PREVIEW do mesmo defeito mora no
// `controle.js`: ler cada lado isolado aprova os dois.)
//
// `carregando`/`restaurarAoAssentar` são declarados lá em cima, junto do
// `saindoDeCena`, porque é ele quem cancela a restauração adiada.
function aoCarregar(p) {
  carregando++;
  Promise.resolve(p).catch(() => {}).then(() => {
    if (--carregando) return;
    if (!restaurarAoAssentar) return;
    restaurarAoAssentar = false;
    // O cartão pode ter VOLTADO durante o load: aí quem manda é ele.
    if (!textActive) restoreSceneAfterText();
  });
}

// Devolve a cena ao estado em que ela estava antes do texto manual entrar.
// Vídeo e imagem não precisam de nada: nunca foram interrompidos e reaparecem
// sozinhos assim que o cartão opaco sai da frente. Só a letra sincronizada
// precisa ser remontada — e no slide certo, não do começo.
function restoreSceneAfterText() {
  if (carregando) { restaurarAoAssentar = true; return; } // ver `aoCarregar`
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

// A cortina do wallpaper é COMPARTILHADA (o stage e a camada de texto mexem
// nela), mas o estado de view é de quem é dono da cena. Este helper só faz a
// cortina obedecer a uma view já decidida — coverIn/coverOut devolvem cedo
// quando ela já está onde deveria, então chamar à toa não custa nem pisca
// nada no telão.
function reconcileCover(view) {
  // `stage.shouldCover()` cobre o caso do ÁUDIO SEM LETRA (v5.112): a view dele
  // é 'visual' como a de qualquer mídia, mas não há o que revelar — abrir a
  // cortina deixaria o telão no preto do palco.
  if (view === 'wallpaper' || stage.shouldCover()) stage.coverIn(false);
  else stage.coverOut();
}

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

let micStream = null;
let micCtx = null;
let micSrc = null;
let micGain = null;
const MIC_RAMP = 0.12; // s — entrada/saída sem estalo

function micStatus(on, error, degraus) {
  const m = { type: 'mic-status', on: !!on, error: error || '' };
  // OS DEGRAUS SÓ VIAJAM NA FALHA: no sucesso o Controle não tem o que fazer com
  // eles, e o `mic-status` sai a cada transição.
  if (degraus && degraus.length) m.degraus = degraus;
  AVDB.sendCommand(m);
}

// OS DISPOSITIVOS DE ENTRADA, com rótulo. O rótulo só existe depois de uma
// permissão concedida — antes disso o navegador o esconde por privacidade —,
// então esta lista é lida DEPOIS das tentativas, quando ela diz algo sobre o
// aparelho em vez de sobre a política do navegador.
async function micDispositivos() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
    const ds = await navigator.mediaDevices.enumerateDevices();
    return ds.filter((d) => d.kind === 'audioinput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label || '' }));
  } catch (_) { return []; }
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
  const seq = ++micSeq;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    micStatus(false, 'unsupported');
    return;
  }
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

  const TENTATIVAS = [
    { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    true,
  ];
  const QUAL = ['com eco', 'sem eco', 'cru'];
  let stream = null;
  let ultimoErro = 'error';
  let ultimaMsg = '';
  let semEco = false;
  const degraus = [];
  for (let i = 0; i < TENTATIVAS.length; i++) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: TENTATIVAS[i], video: false });
      semEco = i > 0;
      degraus.push({ qual: QUAL[i] || String(i), erro: '' });
      break;
    } catch (e) {
      ultimoErro = (e && e.name) || 'error';
      // A MENSAGEM, e não só o nome. `NotReadableError` é o balde genérico do
      // WebRTC; a frase que vem junto é do Chromium e costuma nomear a etapa
      // que falhou. Sem ela o Registro empata em "não abriu" e a investigação
      // vira adivinhação — que foi o que aconteceu por três rodadas.
      ultimaMsg = (e && e.message) ? String(e.message).slice(0, 120) : '';
      degraus.push({ qual: QUAL[i] || String(i), erro: ultimoErro, msg: ultimaMsg });
      // PERMISSÃO NEGADA não melhora com menos processamento: é resposta do
      // sistema (ou do `MicChromeClient`), e insistir só gasta duas chamadas
      // para dar o mesmo erro. Qualquer outra falha é candidata a ser o
      // dispositivo recusando aquela configuração — e essa vale tentar de novo.
      if (ultimoErro === 'NotAllowedError' || ultimoErro === 'SecurityError') break;
      // O operador pode ter soltado o botão entre uma tentativa e outra.
      if (seq !== micSeq || !micWanted) break;
    }
  }
  // O ÚLTIMO RECURSO: pedir o dispositivo PELO ID, em vez de deixar o navegador
  // escolher o "default". Não é a mesma pergunta — o `default` do Chromium é uma
  // entrada virtual que segue o roteamento do sistema, e ela pode falhar
  // enquanto o dispositivo físico abre. Só roda depois de a escada de
  // restrições ter se esgotado, e só se houver um id para pedir.
  if (!stream && ultimoErro !== 'NotAllowedError' && ultimoErro !== 'SecurityError'
      && (seq === micSeq && micWanted)) {
    // O `default` NÃO É PULADO — ver o gêmeo no `controle.js`: num aparelho com
    // UMA entrada, o id dela É `default`, e pular significava não tentar nada.
    for (const d of await micDispositivos()) {
      if (!d.deviceId) continue;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: d.deviceId } }, video: false,
        });
        semEco = true;
        degraus.push({ qual: 'id ' + (d.label || d.deviceId).slice(0, 24), erro: '' });
        break;
      } catch (e) {
        ultimoErro = (e && e.name) || 'error';
        ultimaMsg = (e && e.message) ? String(e.message).slice(0, 120) : '';
        degraus.push({ qual: 'id ' + (d.label || d.deviceId).slice(0, 24), erro: ultimoErro, msg: ultimaMsg });
      }
      if (seq !== micSeq || !micWanted) break;
    }
  }
  if (!stream) {
    diag('microfone recusado: ' + ultimoErro + (ultimaMsg ? ' — ' + ultimaMsg : ''));
    // OS DEGRAUS VÃO JUNTO, e é o que impede o Registro do CELULAR de mentir:
    // ele via um `mic-status` com um erro só e concluía "falhou antes de esgotar
    // a escada" — quando o telão tinha rodado a escada inteira. O consumidor não
    // tinha como saber, porque a informação nunca saiu daqui.
    micStatus(false, ultimoErro, degraus);
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
  // O MICROFONE É DO TELÃO, e esta linha é a única coisa que diz isso.
  //
  // O comando `mic` DESCE para toda tela da rede sem filtro nenhum: o fan-out
  // do `EspelhoServidor.difundirJson` repassa verbatim o que o barramento
  // emitiu (só o `__para` do reenvio endereçado é lido), e o `entregar()` do
  // `tela.js` não olha o tipo. Sem esta guarda, cada tela executa `startMic` e
  // abre o microfone DO APARELHO ONDE O NAVEGADOR RODA — o notebook do saguão,
  // a Smart TV —, devolvendo-o às caixas DAQUELE aparelho. Nenhum áudio
  // atravessa a rede aqui, então o estrago não é "a tela fala com a voz do
  // púlpito": é realimentação local, num aparelho que ninguém está olhando.
  //
  // Hoje isso NÃO ACONTECE, e é por isso que a guarda precisa existir: quem o
  // impede é o ambiente, não o app. Uma tela roda em `http://`, e ali
  // `navigator.mediaDevices` simplesmente não existe (a API é `[SecureContext]`)
  // — a chamada morre na conferência de presença logo abaixo. É uma proteção
  // EMPRESTADA do navegador, e ela se desfaz sozinha no dia em que a transmissão
  // subir em `https://` (o `EspelhoCert` continua inteiro no shell; o que saiu
  // na v5.196 foi só a folha que o alimentava). Nesse dia, sem esta linha, o
  // primeiro push-to-talk pediria microfone em cada tela da igreja.
  //
  // (Onde esta guarda mora era, até aqui, um COMENTÁRIO dizendo que ela existia.
  // Ele descrevia o papel `espelho` — removido na v5.187 — e prometia uma saída
  // antecipada que nenhuma linha implementava.)
  if (TELA) return;
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
// PRÉ-CARREGA com retentativa: o comando com `__wp` pode chegar ANTES de o
// empurrão do Controle abrir o item no cache do celular, e um
// `background-image` que falha não retenta nunca. Um `Image()` cobre a corrida
// nos dois caminhos (troca e herança ao conectar) e só pinta quando há imagem
// de verdade — o gradiente padrão nunca é coberto por nada quebrado.
//
// A ladeira dobra até um platô com teto de TEMPO, a mesma do fundo da letra e
// pela mesma razão medida: os bytes entram na MESMA fila serializada dos
// empurrões de mídia, então com um louvor de 300 MB na frente eles demoram
// minutos. Tentativas fixas somando ~6 s desistiam antes de haver chance.
// `telaWpSeq` mata a retentativa de um wallpaper já substituído.

function telaAplicarWallpaper(url) {
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

// ===== A RETOMADA DEPOIS DE UM ROUBO DE FOCO DE ÁUDIO =====
//
// MEDIDO EM APARELHO: tocar qualquer outra mídia no celular PAUSA a mídia do
// telão. É o Chromium respondendo à perda de foco de áudio — ele pede foco por
// `<video>`, e ao perdê-lo chama `onSuspend()`. Na perda PERMANENTE (o que
// outro app de mídia pede) ele ainda ABANDONA o foco, e aí não volta sozinho
// nunca: o louvor fica parado na frente da congregação até alguém tocar ▶.
//
// O `play()` de volta funciona porque no Chromium NÃO EXISTE "tocar mudo":
// saindo do estado suspenso ele re-pede foco ao Android. Concedido, a mídia
// volta com som e quem tinha o foco recebe a perda — foi o que o operador
// observou ao dar play manualmente, e é tudo o que este código automatiza.
// Negado, `AddPlayer` devolve false e o próprio Chromium pausa de novo. Não há
// um terceiro desfecho em que a barra ande em silêncio.
//
// O QUE ELA NÃO FAZ, e é preciso estar dito para ninguém prometer: ela não
// GARANTE que a outra mídia pare. O framework MUTA o perdedor com um
// `VolumeShaper` e desfaz sozinho alguns segundos depois; parar é decisão do
// outro app. Contra um ALARME não faz nem isso (`USAGE_ALARM` está fora das
// usages que o sistema esmaece), e o desfecho ali é louvor e despertador
// juntos. Quem para de verdade é um app de mídia bem-comportado — que é
// justamente o caso comum.
//
// O TETO E A ESPERA CRESCENTE SÃO O RECURSO, não uma precaução. Não há
// amortecimento nenhum contra ping-pong de foco, nem no Android nem no
// Chromium: sem teto, dois apps que retomam sozinhos gaguejam para sempre — e
// gagueira é PIOR que pausa, porque uma pausa limpa o operador vê e conserta
// com um toque, e som picotado ele lê como aparelho quebrado. A espera cresce
// para que o pior caso audível seja uma falha no começo e depois silêncio.
//
// ESGOTADO O TETO, O SILÊNCIO É DEFINITIVO até um comando humano — nunca até um
// relógio. É essa regra que limita o estrago no caso que não sabemos
// distinguir: uma CHAMADA telefônica é perda TRANSITÓRIA e dura minutos, então
// nenhuma espera curta a separa de um roubo permanente, e ali o Chromium já
// retoma sozinho no fim da ligação. O custo de errar são três tentativas.
const RETOM_ESPERAS = [1500, 4000, 10000];
const RETOM_CONFIRMA_MS = 1200;
// O crédito das tentativas só volta depois de um período LIMPO. Zerá-lo a cada
// retomada bem-sucedida seria o laço que o teto existe para fechar: um roubo
// que se repete a cada 2 s renderia três tentativas por roubo, para sempre.
const RETOM_CREDITO_MS = 30000;
// DOIS ORÇAMENTOS, e confundi-los foi o defeito da v1.1.11: `retomTentativa`
// conta FALHAS CONSECUTIVAS (é ela que faz a espera crescer e que desiste), e
// zera a cada socorro CONFIRMADO. Medido antes do conserto: três socorros que
// DERAM CERTO, espaçados menos de 30 s, esgotavam o teto — e o quarto roubo era
// abandonado justamente quando o mecanismo estava funcionando 3/3.
let retomTimer = 0;
let retomTentativa = 0;
let retomDesistiu = false;
// O SEGUNDO orçamento é o freio de GAGUEIRA: vencer a disputa a cada poucos
// segundos não é serviço, é som picotado. Passando de `RETOM_MAX_SOCORROS`
// recuperações dentro da janela, o telão desiste — o operador prefere uma
// parada limpa que ele conserta com um toque.
const RETOM_MAX_SOCORROS = 3;
let retomSucessos = [];
// O CENSO CONTA EPISÓDIOS, NÃO EVENTOS: sem esta bandeira, cada `play()` nosso
// que fosse negado produzia outra pausa espontânea e o contador subia de novo —
// um único roubo era anunciado como quatro no Registro.
let retomEpisodio = false;
// O carimbo do NOSSO `play()`, para o diário não gravar um `play` que fomos nós
// que causamos: um episódio escrevia 11 linhas e expulsava da linha do tempo
// (16 vagas) justamente o contexto que ela existe para responder.
let retomNosso = 0;
// A INTENÇÃO é um BOOLEANO, não um carimbo de tempo: "alguém mandou pausar há
// pouco" não é a mesma pergunta que "o app QUER isto tocando".
let intencaoTocar = false;
// `jaTocou` recusa retomar o que nunca chegou a tocar; `cenaSeq` invalida um
// timer pendente quando a cena troca — entre agendar e disparar cabem um `load`
// e um `clear` inteiros.
let jaTocou = false;
let cenaSeq = 0;
// OS CONTADORES, porque o anel do diário tem 60 linhas e um episódio gasta
// várias. Sem eles, o culto inteiro não cabe na caixa-preta — e a pergunta que
// importa é "quantas vezes o telão precisou ser socorrido?", que só um número
// responde.
const retom = { espontaneas: 0, recuperadas: 0, desistidas: 0 };

function cancelarRetomada() {
  if (retomTimer) { clearTimeout(retomTimer); retomTimer = 0; }
  retomTentativa = 0;
  retomDesistiu = false;
  retomEpisodio = false;
  retomSucessos = [];
}

// Os fatos SÍNCRONOS que autorizam retomar — lidos ao agendar E ao disparar.
// `pausaComandada` não serve aqui: a janela dele é de TEMPO, e o `video.pause()`
// de um `load` mora depois de um `await AVDB.getMedia(id)`, que é leitura de
// IndexedDB sem teto num processo que divide fio com três WebViews.
//
// `v.ended` É A GUARDA QUE MAIS IMPORTA: o fim natural dispara `pause` antes de
// `ended`, e sem ela o fim de cada louvor RELIGARIA a própria faixa — com a
// playlist avançando por baixo, dois itens no ar ao mesmo tempo.
//
// ELA EXISTE DUAS VEZES, e isso é uma armadilha para quem editar depois: o fim
// natural é barrado aqui E no `!fim` do ouvinte de `pause`. MEDIDO por
// reversão: removendo UMA das duas o oráculo continua VERDE — só a perda das
// DUAS o faz reprovar. Quem tirar uma delas vai ver o teste passar e concluir
// que ela não servia para nada.
//
// E `TELA` é a primeira linha: as telas da rede rodam este MESMO arquivo num
// navegador de outra pessoa, com política de autoplay e som liberado por gesto.
// N telas religando mídia sozinhas é o oposto do que o operador controla.
//
// NÃO HÁ GUARDA DE `__NATIVE__` aqui, de propósito. A regra do projeto é que o
// navegador é o PADRÃO e o nativo é a exceção que se declara — o inverso
// (`if (window.__NATIVE__)` como caminho principal) é o que ela proíbe. E o
// custo seria real: a guarda tornaria este caminho intestável no oráculo do
// telão, que roda sem ponte. Num navegador comum a retomada cai na política de
// autoplay e o `stage.play()` já trata a rejeição pelo `onBlocked` de sempre —
// degrada no comportamento que aquele caminho já tinha.
// Devolve '' quando pode retomar, ou o MOTIVO da recusa. O motivo sai de quem
// DECIDE: a versão anterior devolvia um booleano e o chamador escrevia sempre
// "a cena mudou" — inclusive no único caso que acontece SEM troca de cena
// nenhuma (o Chromium recuperando o foco sozinho), onde a frase era falsa.
function motivoNaoRetomar(v, seq) {
  if (TELA) return 'papel tela';
  if (seq !== cenaSeq) return 'a cena mudou';
  if (!intencaoTocar || !jaTocou) return 'a cena não está tocando';
  if (saindoDeCena) return 'saindo de cena';
  if (v.ended || stage.hasEnded()) return 'a mídia terminou';
  if (v.duration > 0 && v.currentTime >= v.duration - 0.25) return 'a mídia terminou';
  if (!v.paused) return 'já voltou a tocar';
  return '';
}
function podeRetomar(v, seq) { return !motivoNaoRetomar(v, seq); }

function agendarRetomada(v) {
  if (retomTimer) return;
  const seq = cenaSeq;
  if (!podeRetomar(v, seq)) return;

  // O CENSO, uma vez por EPISÓDIO. A linha do Registro afirma "outro app pausou
  // o telão", e afirmar uma CAUSA obriga a contar só o que o app julgou ser
  // essa causa — daqui, depois das guardas, e não a cada evento de pausa.
  if (!retomEpisodio) { retomEpisodio = true; retom.espontaneas++; }

  if (retomDesistiu) return;
  if (retomTentativa >= RETOM_ESPERAS.length) {
    // DESISTIR É UM DESFECHO, e ele vai ao Registro: "o telão parou e não
    // voltou" e "o telão parou, tentou três vezes e o áudio ficou com outro
    // app" pedem ações opostas de quem lê isto a distância.
    retomDesistiu = true;
    retom.desistidas++;
    diag('retomada: DESISTI apos ' + RETOM_ESPERAS.length, { t2: Math.round(v.currentTime) });
    return;
  }
  const espera = RETOM_ESPERAS[retomTentativa];
  retomTentativa++;
  // UMA LINHA POR EPISÓDIO, não por tentativa. A espera vai no TEXTO: o `t2`
  // carrega a POSIÇÃO da mídia em todos os outros produtores do projeto, e o
  // Registro imprime os dois com o mesmo sufixo "s" — quem lê a distância via o
  // louvor "saltar" de 184s para 1.5s e voltar para 186s.
  if (retomTentativa === 1) {
    diag('retomada em ' + (espera / 1000) + 's', { t2: Math.round(v.currentTime) });
  }
  retomTimer = setTimeout(() => {
    retomTimer = 0;
    const porque = motivoNaoRetomar(v, seq);
    if (porque) {
      // O CRÉDITO VOLTA quando a recusa foi "já voltou a tocar": ali não houve
      // disputa nenhuma — o Chromium recuperou o foco sozinho de uma perda
      // transitória curta. Gastar a tentativa faria um roubo REAL nos segundos
      // seguintes começar com a espera de 4 s em vez de 1,5 s.
      if (porque === 'já voltou a tocar' && retomTentativa) retomTentativa--;
      diag('retomada dispensada: ' + porque, { t2: Math.round(v.currentTime) });
      return;
    }
    const antes = v.currentTime;
    // `stage.play()` e nunca `v.play()`: o motor restaura o volume que o fade
    // baixou, reafirma o `applyMedia()` e recalcula a cortina.
    retomNosso = Date.now();
    try { stage.play(); } catch (_) { /* o `pause` seguinte reagenda */ }
    // O SUCESSO É MEDIDO NO RELÓGIO DA MÍDIA, não no `paused`. Um `play()` cujo
    // pedido de foco é negado volta a pausar poucos milissegundos depois;
    // contá-lo como sucesso devolveria o crédito e abriria o laço.
    setTimeout(() => {
      if (seq !== cenaSeq) return;
      if (v.paused || v.currentTime <= antes + 0.3) return;   // falhou: o `pause` reagenda
      retom.recuperadas++;
      diag('retomada OK', { t2: Math.round(v.currentTime) });
      retomTentativa = 0;
      retomEpisodio = false;
      const t = Date.now();
      retomSucessos = retomSucessos.filter((x) => t - x < RETOM_CREDITO_MS);
      retomSucessos.push(t);
      if (retomSucessos.length >= RETOM_MAX_SOCORROS) {
        retomDesistiu = true;
        retom.desistidas++;
        diag('retomada: DESISTI — socorrido ' + retomSucessos.length + 'x em '
          + (RETOM_CREDITO_MS / 1000) + 's', { t2: Math.round(v.currentTime) });
      }
    }, RETOM_CONFIRMA_MS);
  }, espera);
}
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
    // O FIM NATURAL NÃO É UMA PAUSA ESPONTÂNEA, e antes desta linha ele era
    // carimbado como uma — em TODA faixa que terminasse.
    //
    // A ordem é da especificação de HTML: ao chegar ao fim, o elemento levanta
    // a bandeira de `ended`, põe `paused` em true e SÓ ENTÃO dispara `pause` e,
    // depois dele, `ended`. Ou seja, este handler roda com `v.ended` já
    // verdadeiro — e `pausaComandada` não é armado por fim natural, porque não
    // houve comando nenhum. As duas coisas juntas faziam o desfecho mais banal
    // do app produzir a linha reservada ao mais grave.
    //
    // O PREÇO ERA O ARTEFATO INTEIRO. "PAUSA ESPONTÂNEA" existe para responder
    // UMA pergunta — "alguém tirou o telão do ar sem pedir?" — e é lida A
    // DISTÂNCIA, por quem não tem como conferir. Com uma linha dessas por
    // louvor, o Registro respondia "sim" em todo culto normal: quem fosse
    // investigar uma pausa de verdade encontraria o sinal afogado no ruído, e
    // quem procurasse ruído concluiria que o telão vive caindo. Um diagnóstico
    // que responde errado é pior que um que não responde.
    //
    // O teto por `duration` é cinto sobre suspensório: cobre o quadro em que a
    // bandeira ainda não subiu e o aparelho que entrega `duration` com folga.
    const fim = v.ended || (v.duration > 0 && v.currentTime >= v.duration - 0.25);
    const meu = Date.now() - pausaComandada < (fadeCfg.time * 1000 + 400);
    diag(fim ? 'fim natural' : (meu ? 'pausa (comando)' : 'PAUSA ESPONTÂNEA'),
      { t2: Math.round(v.currentTime) });
    if (!fim && !meu) agendarRetomada(v);   // o censo é contado LÁ, por episódio
  });
  v.addEventListener('play', () => {
    jaTocou = true;
    // O `play` que fomos NÓS que causamos não vira linha: ele já está dito pela
    // linha da retomada, e a linha do tempo tem 16 vagas.
    if (Date.now() - retomNosso < 400) return;
    diag('play', { t2: Math.round(v.currentTime) });
  });
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
  // A INTENÇÃO E O CANCELAMENTO, no mesmo ponto que já sabe o que o operador
  // pediu. UM COMANDO HUMANO SEMPRE VENCE uma retomada pendente: sem isto, o ⏸
  // do operador seria desfeito 1,5 s depois por um timer que ninguém vê, e o ▶
  // dele competiria com o nosso `play()`.
  if (cmd.type === 'load' || cmd.type === 'clear' || cmd.type === 'media-clear') {
    cenaSeq++;
    jaTocou = false;
  }
  if (cmd.type === 'play' || cmd.type === 'load' || cmd.type === 'pause'
    || cmd.type === 'clear' || cmd.type === 'media-clear') {
    cancelarRetomada();
    intencaoTocar = cmd.type === 'play'
      || (cmd.type === 'load' && cmd.playing !== false);
  }
  // O Controle pede a caixa-preta ao abrir Configurações.
  if (cmd.type === 'diag-ask') {
    // OS CONTADORES VÃO JUNTO com as linhas: o anel tem 60 e um culto inteiro
    // não cabe nele. Campo novo aqui = campo novo no consumidor (`controle.js`),
    // que hoje lê só `linhas` — a mesma regra da ponte, pelo mesmo motivo.
    AVDB.sendCommand({
      type: 'diag-dump', linhas: diario.slice(-DIAG_MAX), retomada: Object.assign({}, retom),
    });
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
    aoCarregar(stage.handle(cmd));
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
    // `=== 'black'`, e não `=== 'image'`: ausente é quem nunca escolheu, e cai no
    // padrão (imagens). Mesmo raciocínio do `lyricsBg` no controle.js.
    lyricsBgMode = lyricsBg === 'black' ? 'black' : 'image';
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
// borbulha para o listener de recuperação de áudio do stage) libera o autoplay
// COM SOM da mídia da própria origem pelo resto da sessão — é a política do
// navegador, não conteúdo de terceiro (o embed do YouTube saiu na v5.212).
// Some para sempre no primeiro toque.
//
// O Display é independente: este gesto NÃO abre o Controle nem redireciona
// para lugar nenhum.
const startBtnEl = document.getElementById('startBtn');

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
