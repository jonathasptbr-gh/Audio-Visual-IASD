const wallpaperEl = document.getElementById('wallpaper');
const imgEl = document.getElementById('img');
const videoEl = document.getElementById('video');
const youtubeEl = document.getElementById('youtube'); // wrapper; a API cria o iframe real dentro dele
const ytShieldEl = document.getElementById('ytShield');

// Config de transições espelhada localmente (o stage guarda a dele própria)
// para animar o player do YouTube, que vive fora do stage.
let fadeCfg = { in: false, out: false, time: 1 };

function sendStatus() {
  if (yt) return; // com YouTube ativo o status tem fluxo próprio (ytStatus)
  const cur = stage.getCurrent();
  AVDB.sendCommand({
    type: 'display-status',
    mediaId: cur ? cur.id : null,
    view: stage.getView(),
    muted: stage.getMuted(),
    volume: stage.getVolume(),
    playing: stage.isPlaying(),
    currentTime: stage.isTimed() ? stage.getTime() : 0,
    duration: stage.isTimed() ? stage.getDuration() : 0,
    audioBlocked,
  });
}

const stage = createStage({
  wallpaper: wallpaperEl,
  img: imgEl,
  video: videoEl,
  forceMuted: false,
  onTime: sendStatus,
  onBlocked: () => {
    // Autoplay com som bloqueado: segue tocando MUDO (sempre permitido — o
    // vídeo aparece no telão sem toque) e a recuperação religa o áudio.
    stage.setMute(true);
    stage.play();
    beginAudioRecovery();
  },
  onEnded: () => {
    sendStatus();
    const cur = stage.getCurrent();
    AVDB.sendCommand({ type: 'media-ended', mediaId: cur ? cur.id : null });
  },
});

// ===== Áudio sem toque: recuperação automática =====
// A política de autoplay dos navegadores pode bloquear som sem gesto do
// usuário. Em vez de exigir um toque no telão, o vídeo começa mudo e o áudio
// é religado sozinho em retentativas (num PWA instalado costuma liberar na
// primeira). NADA é exibido no telão: o estado vai no campo `audioBlocked`
// do display-status e o Controle avisa o operador. Um toque/tecla no Display
// (se acontecer) resolve na hora.
let audioBlocked = false;
let audioRetryTimer = null;

function pushStatus() { if (yt) ytStatus(); else sendStatus(); }

function beginAudioRecovery() {
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
  if (!audioBlocked || yt) return;
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
  if (!audioBlocked || yt) return;
  stage.setMute(false);
  stage.play();
  endAudioRecovery();
}
document.addEventListener('pointerdown', onUserGesture);
document.addEventListener('keydown', onUserGesture);

// ===== YouTube: IFrame Player API oficial =====
// Antes disso o Display falava diretamente com o protocolo interno (não
// documentado) do embed via postMessage cru — reimplementar esse protocolo à
// mão é frágil (timing de handshake, mensagens do vídeo anterior confundidas
// com o novo). A API oficial (`https://www.youtube.com/iframe_api`) expõe um
// objeto `YT.Player` de verdade: eventos garantidos (onReady/onStateChange),
// métodos reais (playVideo/pauseVideo/seekTo/setVolume/mute/unMute) e
// destroy() para descartar uma instância sem ambiguidade. O embed continua
// usando a sessão logada do navegador (conta Premium ⇒ sem anúncios).
let yt = null;   // estado do player ativo (null = sem YouTube em cena)
let ytSeq = 0;   // guarda sequencial: descarta fades/loads assíncronos obsoletos

// Carrega a API oficial uma única vez (é só um <script>, não uma dependência
// de build — o projeto já depende de rede/youtube.com para tocar o vídeo).
let ytApiPromise = null;
function loadYtApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prevCb = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prevCb) prevCb(); resolve(); };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

// Chama um método do player "com segurança": ignora se o player ainda não
// aceita comandos ou já foi destruído (evita exceções não tratadas).
function ytSafeCall(fn) { try { fn(); } catch (_) {} }

// A API substitui este elemento host pelo <iframe> real que ela cria e
// gerencia — um host novo a cada vídeo garante um iframe/contentWindow novo,
// então nunca há confusão entre eventos de um player e o próximo.
let ytHostSeq = 0;
function createYtHost() {
  const host = document.createElement('div');
  host.id = 'yt-host-' + (++ytHostSeq);
  youtubeEl.appendChild(host);
  return host;
}

function ytStatus() {
  if (!yt || !yt.player) return;
  let state = -1, currentTime = 0, duration = 0;
  try {
    state = yt.player.getPlayerState();
    currentTime = yt.player.getCurrentTime() || 0;
    duration = yt.player.getDuration() || 0;
  } catch (_) { return; }
  AVDB.sendCommand({
    type: 'display-status',
    mediaId: yt.mediaId,
    view: yt.view,
    muted: yt.muted,
    volume: yt.volume,
    playing: state === 1 || state === 3, // playing | buffering
    currentTime,
    duration,
    audioBlocked,
  });
}

// A API oficial não empurra tempo continuamente (só eventos discretos de
// estado) — para a barra de progresso do Controle, fazemos um polling leve
// enquanto este player existir.
function ytStartTimeLoop() {
  const cur = yt;
  clearInterval(cur.timeLoop);
  cur.timeLoop = setInterval(() => { if (yt === cur) ytStatus(); }, 500);
}

function ytClearFadeStyle() {
  youtubeEl.style.transition = '';
  youtubeEl.style.opacity = '';
}

// Escudo anti-UI: usado APENAS no fim do vídeo, para a tela final de
// "vídeos relacionados" nunca chegar ao telão enquanto o player é derrubado.
// Pausa e seek seguem o padrão (quadro congelado + UI nativa do YouTube,
// como um player normal) — sem tela preta.
function ytShield(on) {
  ytShieldEl.classList.toggle('on', !!on);
  if (!on) { ytShieldEl.style.transition = ''; ytShieldEl.style.opacity = ''; }
}

// Rampa de volume do player (fade sonoro) via setVolume, como no stage.
function ytRampVolume(from, to, dur) {
  if (!yt || !yt.player) return;
  const p = yt.player;
  clearInterval(yt.rampTimer);
  const steps = Math.max(2, Math.round(dur * 20));
  let i = 0;
  yt.rampTimer = setInterval(() => {
    i++;
    const v = Math.min(1, Math.max(0, from + (to - from) * (i / steps)));
    ytSafeCall(() => p.setVolume(Math.round(v * 100)));
    if (i >= steps) clearInterval(yt.rampTimer);
  }, (dur * 1000) / steps);
}

// Revela o wrapper do YouTube (DOM + fade-in). Chamado quando o vídeo está de
// fato REPRODUZINDO (estado 1) ou quando o timeout de segurança expira —
// antes disso o player mostra título/botão grande, que nunca devem aparecer
// no telão. Independe da view: quem cobre/revela conforme o wallpaper
// ligado/desligado é a cortina compartilhada do stage (ver stage.coverIn/
// coverOut em ytSetView e onPlayerStateChange) — o wrapper em si só cuida de
// "o vídeo já tem conteúdo pronto pra mostrar", sempre.
function ytShow() {
  if (!yt || yt.shown) return;
  yt.shown = true;
  clearTimeout(yt.showTimer);
  if (fadeCfg.in) {
    youtubeEl.style.transition = 'none';
    youtubeEl.style.opacity = '0';
    youtubeEl.hidden = false;
    void youtubeEl.offsetWidth;
    youtubeEl.style.transition = 'opacity ' + fadeCfg.time + 's ease';
    youtubeEl.style.opacity = '1';
    yt.fadeTimer = setTimeout(ytClearFadeStyle, fadeCfg.time * 1000 + 60);
  } else {
    youtubeEl.hidden = false;
    ytClearFadeStyle();
  }
}

// Derruba o player imediatamente (sem transição).
function ytDrop() {
  if (yt) {
    clearInterval(yt.rampTimer);
    clearInterval(yt.timeLoop);
    clearTimeout(yt.showTimer);
    clearTimeout(yt.fadeTimer);
    clearTimeout(yt.endTimer);
    clearTimeout(yt.startTimer);
    if (yt.player) ytSafeCall(() => yt.player.destroy());
    yt = null;
  }
  ytShield(false);
  youtubeEl.hidden = true;
  // destroy() já remove o iframe que a API criou; innerHTML='' garante que
  // nenhum host residual sobre — o próximo load cria um host (e portanto um
  // iframe/contentWindow) inteiramente novo, então uma mensagem atrasada do
  // player anterior nunca pode ser confundida com o estado do próximo vídeo.
  youtubeEl.innerHTML = '';
  ytClearFadeStyle();
}

// Esmaece o player visível (fade-out ativo) com rampa de volume; quem chama
// decide o que vem depois. O vídeo NÃO é pausado (pausa desenharia a UI do
// YouTube no meio do fade) — o destino é sempre derrubar o player.
function ytFadeOutPlayer() {
  return new Promise((resolve) => {
    if (!yt || !fadeCfg.out || youtubeEl.hidden || !yt.shown) { resolve(); return; }
    clearTimeout(yt.fadeTimer);
    ytRampVolume(yt.volume, 0, fadeCfg.time);
    youtubeEl.style.transition = 'opacity ' + fadeCfg.time + 's ease';
    youtubeEl.style.opacity = '0';
    if (ytShieldEl.classList.contains('on')) {
      // escudo do fim de vídeo esmaece junto, revelando o wallpaper
      ytShieldEl.style.transition = 'opacity ' + fadeCfg.time + 's ease';
      ytShieldEl.style.opacity = '0';
    }
    setTimeout(resolve, fadeCfg.time * 1000);
  });
}

async function loadYoutube(rec, v, m, vol) {
  // O YouTube não usa a recuperação de áudio do stage (ver tryRestoreAudio) —
  // se ela ficou presa em "bloqueado" por causa de um vídeo local anterior,
  // isso não pode vazar para o indicador do mixer durante o YouTube.
  endAudioRecovery();
  const seq = ++ytSeq;
  if (yt) {
    // YouTube → YouTube: esmaece o player atual antes de trocar.
    await ytFadeOutPlayer();
    if (seq !== ytSeq) return;
    ytDrop();
  } else {
    // Mídia comum sai com a transição do próprio stage (fade até o wallpaper,
    // que cobre o tempo de carregamento do player — depende de rede).
    stage.handle({ type: 'clear' });
  }

  await loadYtApi();
  if (seq !== ytSeq) return; // um load mais novo chegou enquanto a API carregava

  // Cobre com a cortina do wallpaper enquanto o vídeo carrega — o clear()
  // acima já faz isso ao trocar de mídia comum para YouTube (current=null);
  // numa troca YouTube → YouTube garantimos aqui, já que esse caminho não
  // passa pelo clear() do stage.
  stage.instantCover(true);

  yt = {
    mediaId: rec.id,
    view: v === 'wallpaper' ? 'wallpaper' : 'visual',
    muted: !!m,
    volume: typeof vol === 'number' ? vol : 1,
    player: null,
    ready: false, shown: false, endedSent: false,
    showTimer: null, fadeTimer: null, endTimer: null, rampTimer: null,
    startTimer: null, timeLoop: null,
  };
  const cur = yt;
  // O wrapper fica oculto (cortina do wallpaper em cena) até o vídeo
  // REPRODUZIR — os estados de carregamento/cued do player mostram título e
  // botão grande.
  youtubeEl.hidden = true;
  ytClearFadeStyle();
  // Segurança: se por algum motivo o player nunca revelar sozinho (nenhum
  // onReady/onStateChange chegou), revela mesmo assim — melhor player com UI
  // do que telão vazio.
  cur.showTimer = setTimeout(() => { if (yt === cur && !cur.shown) ytShow(); }, 5000);

  const host = createYtHost();
  // Player "limpo": sem barra de controles (controls=0), sem anotações
  // (iv_load_policy=3), sem teclado (disablekb=1) e sem botão de fullscreen
  // (fs=0) — todo o transporte vem do Controle via a API. Junto com
  // pointer-events:none no wrapper (CSS) e o escudo anti-UI, nenhum overlay
  // do YouTube aparece no telão: só o vídeo.
  const player = new YT.Player(host, {
    videoId: rec.youtubeId,
    playerVars: {
      autoplay: 1,
      playsinline: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      rel: 0,
      origin: location.origin,
    },
    events: {
      onReady: (e) => { if (yt === cur) onPlayerReady(e); },
      onStateChange: (e) => { if (yt === cur) onPlayerStateChange(e); },
    },
  });
  cur.player = player;
  // allow precisa estar no iframe real (criado pela API) para autoplay com
  // som/fullscreen/PiP funcionarem — garantido aqui em vez de depender do
  // default da API.
  ytSafeCall(() => {
    const frame = player.getIframe();
    if (frame) frame.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
  });
}

// stop/clear com YouTube ativo: esmaece e derruba o player (volta ao wallpaper).
async function stopYoutube() {
  const seq = ++ytSeq;
  await ytFadeOutPlayer();
  if (seq !== ytSeq) return;
  ytDrop();
}

function onPlayerReady(e) {
  if (!yt || yt.ready) return;
  yt.ready = true;
  const p = yt.player;
  ytSafeCall(() => {
    const frame = p.getIframe();
    if (frame) frame.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
  });
  ytSafeCall(() => { if (yt.muted) p.mute(); else p.unMute(); });
  ytSafeCall(() => p.setVolume(Math.round(yt.volume * 100)));
  ytSafeCall(() => p.playVideo());
  ytStartTimeLoop();
  ytWatchStart(0);
}

// Garante que o vídeo realmente comece (o primeiro playVideo() pode chegar
// antes do player interno estar pronto para aceitá-lo — sem retentativa, o
// vídeo fica parado/cued indefinidamente). NUNCA mexe no mudo aqui: isso não
// é detecção de bloqueio de áudio, só um empurrão para o play pegar. Desiste
// sozinho assim que o vídeo entra em reprodução/pausa/buffering, ou após
// algumas tentativas.
function ytWatchStart(attempt) {
  const cur = yt;
  cur.startTimer = setTimeout(() => {
    if (yt !== cur || !cur.player) return;
    let st;
    try { st = cur.player.getPlayerState(); } catch (_) { return; }
    if (st === 1 || st === 2 || st === 3) return; // playing/paused/buffering: já saiu do zero
    if (attempt >= 4) return;
    ytSafeCall(() => cur.player.playVideo());
    ytWatchStart(attempt + 1);
  }, 2000);
}

function onPlayerStateChange(e) {
  if (!yt) return;
  const st = e.data;
  if (st === 1) { // reproduzindo: revela (1ª vez) e libera replays de 'ended'
    ytShow();
    ytShield(false);
    yt.endedSent = false;
    // Se a view atual pedir visual, esconde a cortina (a reprodução em si
    // não espera por isso — só a exibição). Se a view for wallpaper, fica
    // tocando por baixo da cortina; ytSetView('visual') revela depois.
    if (yt.view === 'visual') stage.coverOut();
  }
  if (st === 0 && !yt.endedSent) { // fim do vídeo → avanço de playlist no Controle
    yt.endedSent = true;
    // cobre a tela final de "vídeos relacionados" enquanto o player cai —
    // instantâneo, e já deixa a cortina do wallpaper pronta por baixo do
    // escudo (revelada com fade quando o escudo sumir em ytFadeOutPlayer()).
    ytShield(true);
    stage.instantCover(true);
    AVDB.sendCommand({ type: 'media-ended', mediaId: yt.mediaId });
    // Sem 'load' de avanço automático em seguida (repeat off / Controle
    // fechado), derruba o player — fim natural volta ao wallpaper.
    const cur = yt;
    cur.endTimer = setTimeout(() => {
      let curSt;
      try { curSt = cur.player && cur.player.getPlayerState(); } catch (_) { curSt = null; }
      if (yt === cur && curSt === 0) stopYoutube();
    }, 400);
  }
  ytStatus();
}

// Transporte/volume/view com YouTube ativo, via métodos do YT.Player.
function ytHandle(cmd) {
  if (!yt.player) return;
  const p = yt.player;
  switch (cmd.type) {
    case 'play':
      ytSafeCall(() => p.playVideo());
      break;
    case 'pause':
      // padrão de player normal: quadro congelado (a UI nativa que o
      // YouTube desenhar na pausa é aceita — sem tela preta)
      ytSafeCall(() => p.pauseVideo());
      break;
    case 'seek':
      if (isFinite(cmd.time)) ytSafeCall(() => p.seekTo(cmd.time, true));
      break;
    case 'volume':
      if (typeof cmd.volume === 'number') {
        yt.volume = cmd.volume;
        clearInterval(yt.rampTimer); // operador manda: cancela rampa em curso
        ytSafeCall(() => p.setVolume(Math.round(cmd.volume * 100)));
      }
      break;
    case 'mute':
      yt.muted = !!cmd.muted;
      ytSafeCall(() => { if (yt.muted) p.mute(); else p.unMute(); });
      break;
    case 'view': ytSetView(cmd.view === 'wallpaper' ? 'wallpaper' : 'visual'); break;
  }
}

// Visual on/off para YouTube: liga/desliga a cortina COMPARTILHADA do
// wallpaper (mesma usada pelo stage) — o wrapper do YouTube em si nunca
// esconde/revela por causa da view; ele só cuida de ter conteúdo pronto (ver
// ytShow()). O vídeo continua tocando (áudio incluído) por baixo da cortina
// quando ela está cobrindo.
function ytSetView(v) {
  if (!yt || yt.view === v) return;
  yt.view = v;
  if (v === 'wallpaper') stage.coverIn(false); // sem rampa: só o visual muda
  else stage.coverOut();
  ytStatus();
}

AVDB.onCommand(async (cmd) => {
  if (!cmd) return;

  if (cmd.type === 'fade') {
    fadeCfg = {
      in: !!cmd.fadeIn,
      out: !!cmd.fadeOut,
      time: (typeof cmd.time === 'number' && cmd.time > 0) ? cmd.time : fadeCfg.time,
    };
    stage.handle(cmd);
    return;
  }

  if (cmd.type === 'load') {
    const rec = await AVDB.getMedia(cmd.mediaId);
    if (rec && rec.kind === 'youtube') {
      loadYoutube(rec, cmd.view, cmd.muted, cmd.volume);
      return;
    }
    if (yt) {
      // YouTube → mídia comum: o player esmaece por cima enquanto a nova
      // mídia entra por baixo (crossfade); sem fade, derruba na hora.
      if (fadeCfg.out && !youtubeEl.hidden) stopYoutube();
      else { ++ytSeq; ytDrop(); }
    }
    stage.handle(cmd);
    return;
  }

  if (cmd.type === 'stop' || cmd.type === 'clear') {
    if (yt) stopYoutube();
    stage.handle(cmd);
    return;
  }

  // Operador pediu (botão de mudo do mixer): retentativa imediata de áudio.
  if (cmd.type === 'audio-retry') {
    if (audioBlocked) tryRestoreAudio();
    return;
  }

  if (yt) { ytHandle(cmd); return; }

  stage.handle(cmd);
});

async function restore() {
  // Config de transições (fade) definida no Controle.
  const fade = await AVDB.getState('fade');
  if (fade) {
    fadeCfg = { in: !!fade.in, out: !!fade.out, time: fade.time > 0 ? fade.time : 1 };
    stage.setFade({ fadeIn: fadeCfg.in, fadeOut: fadeCfg.out, time: fadeCfg.time });
  }
  const state = await AVDB.getState('current');
  const view = (state && state.view) || 'visual';
  const muted = !!(state && state.muted);
  const volume = (state && typeof state.volume === 'number') ? state.volume : 1;
  if (state && state.mediaId) {
    const rec = await AVDB.getMedia(state.mediaId);
    if (rec && rec.kind === 'youtube') {
      loadYoutube(rec, view, muted, volume);
    } else {
      await stage.load(state.mediaId, view, muted, volume);
    }
  } else {
    stage.setView(view);
  }
  AVDB.sendCommand({ type: 'display-ready' });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

restore();
