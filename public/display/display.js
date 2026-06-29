const wallpaperEl = document.getElementById('wallpaper');
const imgEl = document.getElementById('img');
const videoEl = document.getElementById('video');
const youtubeEl = document.getElementById('youtube');
const unlockEl = document.getElementById('unlock');

let unlocked = false;
let youtubeActive = false;

function sendStatus() {
  const cur = youtubeActive ? null : stage.getCurrent();
  AVDB.sendCommand({
    type: 'display-status',
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
  forceMuted: false,
  onTime: sendStatus,
  onBlocked: () => { if (!unlocked) unlockEl.classList.add('show'); },
  onEnded: () => {
    sendStatus();
    const cur = stage.getCurrent();
    AVDB.sendCommand({ type: 'media-ended', mediaId: cur ? cur.id : null });
  },
});

function clearYoutube() {
  youtubeEl.removeAttribute('src');
  youtubeEl.hidden = true;
  youtubeActive = false;
}

AVDB.onCommand(async (cmd) => {
  if (!cmd) return;

  if (cmd.type === 'load') {
    const rec = await AVDB.getMedia(cmd.mediaId);
    if (rec && rec.kind === 'youtube') {
      clearYoutube();
      stage.clear();
      youtubeEl.src = `https://www.youtube-nocookie.com/embed/${rec.youtubeId}?autoplay=1&rel=0&modestbranding=1`;
      youtubeEl.hidden = false;
      youtubeActive = true;
      return;
    }
    // Non-youtube: ensure iframe is hidden
    clearYoutube();
    stage.handle(cmd);
    return;
  }

  if (cmd.type === 'stop' || cmd.type === 'clear') {
    clearYoutube();
    stage.handle(cmd);
    return;
  }

  // Ignore transport/volume commands while YouTube is active (can't bridge into iframe)
  if (youtubeActive) return;

  stage.handle(cmd);
});

unlockEl.addEventListener('click', () => {
  unlocked = true;
  unlockEl.classList.remove('show');
  stage.play();
});

async function restore() {
  const state = await AVDB.getState('current');
  const view = (state && state.view) || 'visual';
  const muted = !!(state && state.muted);
  const volume = (state && typeof state.volume === 'number') ? state.volume : 1;
  if (state && state.mediaId) {
    const rec = await AVDB.getMedia(state.mediaId);
    if (rec && rec.kind === 'youtube') {
      youtubeEl.src = `https://www.youtube-nocookie.com/embed/${rec.youtubeId}?autoplay=1&rel=0&modestbranding=1`;
      youtubeEl.hidden = false;
      youtubeActive = true;
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
