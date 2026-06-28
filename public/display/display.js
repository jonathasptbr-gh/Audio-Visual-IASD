const wallpaperEl = document.getElementById('wallpaper');
const imgEl = document.getElementById('img');
const videoEl = document.getElementById('video');
const unlockEl = document.getElementById('unlock');

let current = null;     // registro da mídia atual
let view = 'visual';    // 'visual' (mídia na tela) | 'wallpaper' (só wallpaper)
let muted = false;      // áudio no mudo
let volume = 1;         // 0..1, volume da mídia
let mediaUrl = null;
let unlocked = false;

// ---------- carregar / aplicar ----------

async function loadMedia(id, newView, newMuted, newVolume) {
  if (newView !== undefined) view = newView;
  if (newMuted !== undefined) muted = newMuted;
  if (typeof newVolume === 'number') volume = newVolume;

  const record = await AVDB.getMedia(id);
  if (!record) { clearMedia(); return; }
  current = record;

  if (mediaUrl) URL.revokeObjectURL(mediaUrl);
  mediaUrl = URL.createObjectURL(record.blob);

  imgEl.hidden = true;
  imgEl.removeAttribute('src');
  videoEl.pause();
  videoEl.removeAttribute('src');
  videoEl.load();

  if (record.kind === 'image') {
    imgEl.src = mediaUrl;
  } else {
    // vídeo e áudio usam o mesmo elemento <video>
    videoEl.src = mediaUrl;
    videoEl.muted = muted;
    videoEl.volume = volume;
    tryPlay();
  }

  applyView();
}

function clearMedia() {
  current = null;
  imgEl.hidden = true;
  imgEl.removeAttribute('src');
  videoEl.pause();
  videoEl.removeAttribute('src');
  videoEl.load();
  if (mediaUrl) { URL.revokeObjectURL(mediaUrl); mediaUrl = null; }
  applyView();
  sendStatus();
}

// Define apenas O QUE APARECE (wallpaper x mídia). O áudio é independente.
function applyView() {
  const kind = current ? current.kind : null;
  const visible = !!current && view === 'visual' && (kind === 'image' || kind === 'video');

  imgEl.hidden = !(visible && kind === 'image');
  videoEl.hidden = !(visible && kind === 'video');
  wallpaperEl.style.display = visible ? 'none' : 'flex';

  // O vídeo/áudio continua tocando mesmo quando se mostra o wallpaper;
  // só o mudo controla se há som.
  videoEl.muted = muted;
}

// ---------- reprodução ----------

function tryPlay() {
  if (!current || (current.kind !== 'video' && current.kind !== 'audio')) return;
  const p = videoEl.play();
  if (p && p.catch) {
    p.catch(() => {
      // Autoplay com som bloqueado -> pede um toque para liberar.
      if (!unlocked && !videoEl.muted) unlockEl.classList.add('show');
    });
  }
}

function applyCommand(cmd) {
  switch (cmd.type) {
    case 'load':
      loadMedia(cmd.mediaId, cmd.view, cmd.muted, cmd.volume);
      break;
    case 'view':
      view = cmd.view;
      applyView();
      sendStatus();
      break;
    case 'mute':
      muted = cmd.muted;
      videoEl.muted = muted;
      sendStatus();
      break;
    case 'volume':
      if (typeof cmd.volume === 'number') {
        volume = Math.max(0, Math.min(1, cmd.volume));
        videoEl.volume = volume;
      }
      sendStatus();
      break;
    case 'play':
      tryPlay();
      break;
    case 'pause':
      videoEl.pause();
      break;
    case 'stop':
      videoEl.pause();
      videoEl.currentTime = 0;
      break;
    case 'seek':
      if (isFinite(cmd.time)) videoEl.currentTime = cmd.time;
      break;
    case 'clear':
      clearMedia();
      break;
  }
}

// ---------- status para o controle ----------

function sendStatus() {
  const isVideoLike = current && (current.kind === 'video' || current.kind === 'audio');
  AVDB.sendCommand({
    type: 'display-status',
    mediaId: current ? current.id : null,
    kind: current ? current.kind : null,
    view,
    muted: videoEl.muted,
    volume: videoEl.volume,
    playing: isVideoLike ? !videoEl.paused : false,
    currentTime: isVideoLike ? videoEl.currentTime : 0,
    duration: isVideoLike ? videoEl.duration : 0,
  });
}

videoEl.addEventListener('play', sendStatus);
videoEl.addEventListener('pause', sendStatus);
videoEl.addEventListener('timeupdate', sendStatus);
videoEl.addEventListener('loadedmetadata', sendStatus);
videoEl.addEventListener('volumechange', sendStatus);
videoEl.addEventListener('ended', sendStatus);

// ---------- desbloqueio de autoplay ----------

unlockEl.addEventListener('click', () => {
  unlocked = true;
  unlockEl.classList.remove('show');
  tryPlay();
});

// ---------- inicialização ----------

AVDB.onCommand((cmd) => { if (cmd) applyCommand(cmd); });

async function restore() {
  const state = await AVDB.getState('current');
  view = (state && state.view) || 'visual';
  muted = !!(state && state.muted);
  volume = (state && typeof state.volume === 'number') ? state.volume : 1;
  if (state && state.mediaId) {
    await loadMedia(state.mediaId, view, muted, volume);
  } else {
    applyView();
  }
  AVDB.sendCommand({ type: 'display-ready' });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

restore();
