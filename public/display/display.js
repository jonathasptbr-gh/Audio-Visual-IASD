const wallpaperEl = document.getElementById('wallpaper');
const imgEl = document.getElementById('img');
const videoEl = document.getElementById('video');
const youtubeEl = document.getElementById('youtube');
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

function tryRestoreAudio() {
  if (!audioBlocked) return;
  if (yt) {
    if (yt.muted) { endAudioRecovery(); return; } // operador deixou mudo
    ytPost('unMute');
    ytPost('setVolume', [Math.round(yt.volume * 100)]);
    ytPost('playVideo');
    setTimeout(() => {
      if (!audioBlocked) return;
      if (yt && yt.info.playerState === 1 && yt.infoMuted === false) {
        yt.mutedFallback = false;
        endAudioRecovery();
      } else {
        if (yt && yt.info.playerState !== 1 && yt.info.playerState !== 3) {
          ytPost('mute'); ytPost('playVideo'); // volta ao modo mudo tocando
        }
        scheduleAudioRetry(5000);
      }
    }, 900);
  } else {
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
}

// Qualquer gesto real no Display (toque, tecla de um controle remoto) concede
// a ativação do navegador — religa o áudio na hora.
function onUserGesture() {
  if (yt) {
    if (yt.mutedFallback || (!yt.muted && yt.infoMuted)) {
      yt.mutedFallback = false;
      ytPost('unMute');
      ytPost('setVolume', [Math.round(yt.volume * 100)]);
      ytPost('playVideo');
    }
  } else if (audioBlocked) {
    stage.setMute(false);
    stage.play();
  }
  endAudioRecovery();
}
document.addEventListener('pointerdown', onUserGesture);
document.addEventListener('keydown', onUserGesture);

// ===== YouTube: player oficial (youtube.com/embed) com ponte postMessage =====
// O embed padrão do youtube.com compartilha a sessão logada do navegador
// (conta Premium ⇒ sem anúncios) e expõe a API de widget: comandos via
// postMessage e status via infoDelivery — transporte, volume, seek, view e
// fim de vídeo ficam integrados ao protocolo do sistema.
const YT_ORIGIN = 'https://www.youtube.com';
let yt = null;   // estado do player ativo (null = sem YouTube em cena)
let ytSeq = 0;   // guarda sequencial: descarta fades/loads assíncronos obsoletos

function ytPost(func, args) {
  if (!youtubeEl.contentWindow) return;
  try {
    youtubeEl.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func, args: args || [] }), YT_ORIGIN);
  } catch (_) {}
}

// Handshake da API de widget: pede o fluxo de eventos até a primeira resposta.
function ytListen() {
  if (!youtubeEl.contentWindow) return;
  try {
    youtubeEl.contentWindow.postMessage(
      JSON.stringify({ event: 'listening', id: 'av-display', channel: 'widget' }), YT_ORIGIN);
  } catch (_) {}
}

function ytStatus() {
  if (!yt) return;
  const i = yt.info;
  AVDB.sendCommand({
    type: 'display-status',
    mediaId: yt.mediaId,
    view: yt.view,
    muted: yt.muted,
    volume: yt.volume,
    playing: i.playerState === 1 || i.playerState === 3, // playing | buffering
    currentTime: i.currentTime || 0,
    duration: i.duration || 0,
    audioBlocked,
  });
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
  if (!yt) return;
  clearInterval(yt.rampTimer);
  const steps = Math.max(2, Math.round(dur * 20));
  let i = 0;
  yt.rampTimer = setInterval(() => {
    i++;
    const v = Math.min(1, Math.max(0, from + (to - from) * (i / steps)));
    ytPost('setVolume', [Math.round(v * 100)]);
    if (i >= steps) clearInterval(yt.rampTimer);
  }, (dur * 1000) / steps);
}

// Revela o player (crossfade sobre o wallpaper). Só é chamado quando o vídeo
// está de fato REPRODUZINDO (estado 1) — antes disso o embed mostra título/
// botão grande, que nunca devem aparecer no telão.
function ytShow() {
  if (!yt || yt.shown || yt.view !== 'visual') return;
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
    clearInterval(yt.listenTimer);
    clearInterval(yt.rampTimer);
    clearTimeout(yt.showTimer);
    clearTimeout(yt.fadeTimer);
    clearTimeout(yt.blockTimer);
    clearTimeout(yt.endTimer);
    yt = null;
  }
  ytShield(false);
  youtubeEl.hidden = true;
  youtubeEl.removeAttribute('src');
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
  const seq = ++ytSeq;
  if (yt) {
    // YouTube → YouTube: esmaece o player atual antes de trocar o src.
    await ytFadeOutPlayer();
    if (seq !== ytSeq) return;
    ytDrop();
  } else {
    // Mídia comum sai com a transição do próprio stage (fade até o wallpaper,
    // que cobre o tempo de carregamento do player — depende de rede).
    stage.handle({ type: 'clear' });
  }
  yt = {
    mediaId: rec.id,
    view: v === 'wallpaper' ? 'wallpaper' : 'visual',
    muted: !!m,
    volume: typeof vol === 'number' ? vol : 1,
    ready: false, shown: false, endedSent: false, mutedFallback: false,
    infoMuted: undefined,
    info: { playerState: -1, currentTime: 0, duration: 0 },
    listenTimer: null, showTimer: null, fadeTimer: null,
    blockTimer: null, endTimer: null, rampTimer: null,
  };
  // Player "limpo": sem barra de controles (controls=0), sem anotações
  // (iv_load_policy=3), sem teclado (disablekb=1) e sem botão de fullscreen
  // (fs=0) — todo o transporte vem do Controle via ponte postMessage. Junto
  // com pointer-events:none no iframe (CSS) e o escudo anti-UI, nenhum
  // overlay do YouTube aparece no telão: só o vídeo.
  const params = new URLSearchParams({
    autoplay: '1',
    enablejsapi: '1',
    playsinline: '1',
    controls: '0',
    disablekb: '1',
    fs: '0',
    iv_load_policy: '3',
    rel: '0',
    origin: location.origin,
  });
  // O iframe fica oculto (wallpaper em cena) até o vídeo REPRODUZIR — os
  // estados de carregamento/cued do embed mostram título e botão grande.
  youtubeEl.hidden = true;
  ytClearFadeStyle();
  // Segurança: se o handshake do widget falhar (nenhum evento chegou),
  // revela mesmo assim — melhor player com UI do que telão vazio. Com o
  // handshake vivo, quem revela é o estado 1 (reproduzindo).
  yt.showTimer = setTimeout(() => {
    if (yt && !yt.ready && yt.info.playerState === -1) ytShow();
  }, 5000);
  youtubeEl.src = YT_ORIGIN + '/embed/' + encodeURIComponent(rec.youtubeId) + '?' + params.toString();
  yt.listenTimer = setInterval(ytListen, 350);
}

// stop/clear com YouTube ativo: esmaece e derruba o player (volta ao wallpaper).
async function stopYoutube() {
  const seq = ++ytSeq;
  await ytFadeOutPlayer();
  if (seq !== ytSeq) return;
  ytDrop();
}

function ytReady() {
  if (!yt || yt.ready) return;
  yt.ready = true;
  ytPost(yt.muted ? 'mute' : 'unMute');
  ytPost('setVolume', [Math.round(yt.volume * 100)]);
  ytPost('playVideo');
  // Autoplay com som bloqueado pelo browser? (segundos após o ready ainda em
  // unstarted/cued) → inicia MUDO (sempre permitido: o vídeo aparece no
  // telão sem toque) e deixa a recuperação automática religar o áudio.
  yt.blockTimer = setTimeout(() => {
    if (!yt) return;
    const st = yt.info.playerState;
    if (st === -1 || st === 5) {
      yt.mutedFallback = true;
      ytPost('mute');
      ytPost('playVideo');
      if (!yt.muted) beginAudioRecovery();
    }
  }, 2500);
}

function ytState(st) {
  if (!yt) return;
  yt.info.playerState = st;
  if (st === 1) { // reproduzindo: revela (1ª vez) e libera replays de 'ended'
    ytShow();
    ytShield(false);
    yt.endedSent = false;
  }
  if (st === 0 && !yt.endedSent) { // fim do vídeo → avanço de playlist no Controle
    yt.endedSent = true;
    // cobre a tela final de "vídeos relacionados" enquanto o player cai
    ytShield(true);
    AVDB.sendCommand({ type: 'media-ended', mediaId: yt.mediaId });
    // Sem 'load' de avanço automático em seguida (repeat off / Controle
    // fechado), derruba o player — fim natural volta ao wallpaper.
    const cur = yt;
    cur.endTimer = setTimeout(() => {
      if (yt === cur && yt.info.playerState === 0) stopYoutube();
    }, 400);
  }
}

window.addEventListener('message', (e) => {
  if (e.origin !== YT_ORIGIN || !yt || e.source !== youtubeEl.contentWindow) return;
  let data = null;
  try { data = JSON.parse(e.data); } catch (_) { return; }
  if (!data || typeof data !== 'object') return;

  // primeira resposta do widget: handshake concluído
  if (yt.listenTimer) { clearInterval(yt.listenTimer); yt.listenTimer = null; }

  if (data.event === 'onReady') {
    ytReady();
  } else if (data.event === 'initialDelivery' || data.event === 'infoDelivery') {
    // Se o onReady se perdeu (handshake tardio), a primeira entrega de info
    // também confirma o player pronto — garante o playVideo do autoplay.
    ytReady();
    if (!yt) return;
    const info = data.info || {};
    if (typeof info.currentTime === 'number') yt.info.currentTime = info.currentTime;
    if (typeof info.duration === 'number') yt.info.duration = info.duration;
    if (typeof info.muted === 'boolean') yt.infoMuted = info.muted;
    if (typeof info.volume === 'number') yt.volume = info.volume / 100;
    if (typeof info.playerState === 'number') ytState(info.playerState);
    if (!yt) return;
    ytStatus();
  } else if (data.event === 'onStateChange') {
    ytState(typeof data.info === 'number' ? data.info : -1);
    if (yt) ytStatus();
  }
});

// Transporte/volume/view com YouTube ativo, via ponte postMessage.
function ytHandle(cmd) {
  switch (cmd.type) {
    case 'play':
      ytPost('playVideo');
      break;
    case 'pause':
      // padrão de player normal: quadro congelado (a UI nativa que o
      // YouTube desenhar na pausa é aceita — sem tela preta)
      ytPost('pauseVideo');
      break;
    case 'seek':
      if (isFinite(cmd.time)) ytPost('seekTo', [cmd.time, true]);
      break;
    case 'volume':
      if (typeof cmd.volume === 'number') {
        yt.volume = cmd.volume;
        clearInterval(yt.rampTimer); // operador manda: cancela rampa em curso
        ytPost('setVolume', [Math.round(cmd.volume * 100)]);
      }
      break;
    case 'mute':
      yt.muted = !!cmd.muted;
      yt.mutedFallback = false; // operador assumiu o controle do mudo
      if (yt.muted) endAudioRecovery();
      ytPost(yt.muted ? 'mute' : 'unMute');
      break;
    case 'view': ytSetView(cmd.view === 'wallpaper' ? 'wallpaper' : 'visual'); break;
  }
}

// Visual on/off para YouTube: esconde/revela o player com fade; o iframe
// permanece carregado, então o áudio continua com o visual desligado.
async function ytSetView(v) {
  if (!yt || yt.view === v) return;
  yt.view = v;
  const cur = yt;
  if (v === 'wallpaper') {
    if (fadeCfg.out && !youtubeEl.hidden) {
      clearTimeout(yt.fadeTimer);
      youtubeEl.style.transition = 'opacity ' + fadeCfg.time + 's ease';
      youtubeEl.style.opacity = '0';
      await new Promise((r) => setTimeout(r, fadeCfg.time * 1000));
      if (yt !== cur || yt.view !== 'wallpaper') return;
    }
    youtubeEl.hidden = true;
    ytShield(false); // o escudo não pode cobrir o wallpaper
    ytClearFadeStyle();
  } else if (cur.shown) {
    youtubeEl.hidden = false;
    if (fadeCfg.in) {
      youtubeEl.style.transition = 'none';
      youtubeEl.style.opacity = '0';
      void youtubeEl.offsetWidth;
      youtubeEl.style.transition = 'opacity ' + fadeCfg.time + 's ease';
      youtubeEl.style.opacity = '1';
      yt.fadeTimer = setTimeout(ytClearFadeStyle, fadeCfg.time * 1000 + 60);
    }
  }
  // se o player ainda não foi revelado (nunca tocou), ytShow cuida depois
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
