const wallpaperEl = document.getElementById('wallpaper');
const imgEl = document.getElementById('img');
const videoEl = document.getElementById('video');
const unlockEl = document.getElementById('unlock');

let current = null;   // registro da mídia atual
let mode = 'visual';
let mediaUrl = null;
let unlocked = false;

// ---------- carregar / aplicar ----------

async function loadMedia(id, newMode) {
  if (newMode) mode = newMode;
  const record = await AVDB.getMedia(id);
  if (!record) { clearMedia(); return; }
  current = record;

  if (mediaUrl) URL.revokeObjectURL(mediaUrl);
  mediaUrl = URL.createObjectURL(record.blob);

  // Reseta elementos
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
    // toca automaticamente ao carregar (a menos que esteja em modo wallpaper)
    if (mode !== 'wallpaper') tryPlay();
  }

  applyMode();
}

function clearMedia() {
  current = null;
  imgEl.hidden = true;
  imgEl.removeAttribute('src');
  videoEl.pause();
  videoEl.removeAttribute('src');
  videoEl.load();
  if (mediaUrl) { URL.revokeObjectURL(mediaUrl); mediaUrl = null; }
  applyMode();
  sendStatus();
}

// Define o que aparece e o que toca, conforme o modo + tipo de mídia.
function applyMode() {
  const kind = current ? current.kind : null;

  // A mídia é VISÍVEL quando estamos no modo "visual" e ela tem imagem.
  const visible = !!current && mode === 'visual' && (kind === 'image' || kind === 'video');
  // O áudio TOCA nos modos "visual" e "wallaudio" (apenas vídeo/áudio).
  const audible = !!current && mode !== 'wallpaper' && (kind === 'video' || kind === 'audio');

  // Camada de imagem
  imgEl.hidden = !(visible && kind === 'image');
  // Camada de vídeo (só visível como vídeo no modo visual)
  videoEl.hidden = !(visible && kind === 'video');

  // Wallpaper fica visível sempre que a mídia não está ocupando a tela.
  wallpaperEl.style.display = visible ? 'none' : 'flex';

  // Reprodução de vídeo/áudio
  if (kind === 'video' || kind === 'audio') {
    videoEl.muted = !audible;
    if (mode === 'wallpaper') {
      videoEl.pause();
    }
  }
}

// ---------- reprodução ----------

function tryPlay() {
  const p = videoEl.play();
  if (p && p.catch) {
    p.catch(() => {
      // Autoplay bloqueado -> pede toque para ativar.
      if (!unlocked) unlockEl.classList.add('show');
    });
  }
}

function applyCommand(cmd) {
  switch (cmd.type) {
    case 'load':
      loadMedia(cmd.mediaId, cmd.mode);
      break;
    case 'mode':
      mode = cmd.mode;
      applyMode();
      if (current && (current.kind === 'video' || current.kind === 'audio')) {
        if (mode === 'wallpaper') videoEl.pause();
      }
      sendStatus();
      break;
    case 'play':
      if (current && (current.kind === 'video' || current.kind === 'audio')) tryPlay();
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
    mode,
    playing: isVideoLike ? !videoEl.paused : false,
    currentTime: isVideoLike ? videoEl.currentTime : 0,
    duration: isVideoLike ? videoEl.duration : 0,
  });
}

videoEl.addEventListener('play', sendStatus);
videoEl.addEventListener('pause', sendStatus);
videoEl.addEventListener('timeupdate', sendStatus);
videoEl.addEventListener('loadedmetadata', sendStatus);
videoEl.addEventListener('ended', sendStatus);

// ---------- desbloqueio de autoplay ----------

unlockEl.addEventListener('click', () => {
  unlocked = true;
  unlockEl.classList.remove('show');
  if (current && (current.kind === 'video' || current.kind === 'audio') && mode !== 'wallpaper') {
    tryPlay();
  }
});

// ---------- inicialização ----------

AVDB.onCommand((cmd) => { if (cmd) applyCommand(cmd); });

async function restore() {
  const state = await AVDB.getState('current');
  mode = (state && state.mode) || 'visual';
  if (state && state.mediaId) {
    await loadMedia(state.mediaId, mode);
  } else {
    applyMode();
  }
  AVDB.sendCommand({ type: 'display-ready' });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

restore();
