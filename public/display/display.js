const wallpaperEl = document.getElementById('wallpaper');
const imgEl = document.getElementById('img');
const videoEl = document.getElementById('video');
const unlockEl = document.getElementById('unlock');

let unlocked = false;

function sendStatus() {
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

AVDB.onCommand((cmd) => { if (cmd) stage.handle(cmd); });

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
    await stage.load(state.mediaId, view, muted, volume);
  } else {
    stage.setView(view);
  }
  AVDB.sendCommand({ type: 'display-ready' });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

restore();
