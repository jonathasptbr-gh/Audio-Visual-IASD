const playlistEl = document.getElementById('playlist');
const fileEl = document.getElementById('file');
const hideEl = document.getElementById('hide');

const prevEl = document.getElementById('prev');
const playPauseEl = document.getElementById('playpause');
const stopEl = document.getElementById('stop');
const nextEl = document.getElementById('next');

const npNameEl = document.getElementById('npName');
const seekEl = document.getElementById('seek');
const curTimeEl = document.getElementById('curTime');
const durTimeEl = document.getElementById('durTime');
const modesEl = document.getElementById('modes');

const KIND_ICON = { image: '🖼️', video: '🎬', audio: '🎵', other: '📄' };
const MODES = ['wallpaper', 'visual', 'wallaudio'];

let items = [];           // playlist ordenada (mídias)
let currentId = null;
let mode = 'visual';
let playing = false;

// ---------- util ----------

function fmtTime(s) {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
}

function indexOfCurrent() {
  return items.findIndex((m) => m.id === currentId);
}

// ---------- render ----------

async function load() {
  items = await AVDB.getPlaylist();
  const cur = await AVDB.getState('current');
  currentId = cur && cur.mediaId ? cur.mediaId : null;
  mode = (cur && cur.mode) || 'visual';
  renderModes();
  renderPlaylist();
  renderNowPlaying();
}

function renderModes() {
  modesEl.querySelectorAll('.mode-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
}

function renderPlaylist() {
  playlistEl.innerHTML = '';

  if (items.length === 0) {
    playlistEl.innerHTML =
      '<li class="empty">Nenhuma mídia ainda.<br>Toque em “Importar mídia”.</li>';
    return;
  }

  items.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'track' + (item.id === currentId ? ' active' : '');

    const icon = document.createElement('span');
    icon.className = 'track-icon';
    icon.textContent = KIND_ICON[item.kind] || KIND_ICON.other;

    const name = document.createElement('input');
    name.className = 'track-name';
    name.value = item.name;
    name.addEventListener('click', (e) => e.stopPropagation());
    name.addEventListener('change', () => AVDB.renameMedia(item.id, name.value.trim() || 'sem-nome'));

    const actions = document.createElement('div');
    actions.className = 'track-actions';

    const up = mkBtn('▲', 'Subir', (e) => { e.stopPropagation(); move(i, -1); });
    const down = mkBtn('▼', 'Descer', (e) => { e.stopPropagation(); move(i, 1); });
    const play = mkBtn('▶', 'Exibir', (e) => { e.stopPropagation(); send(item.id); });
    const del = mkBtn('🗑', 'Remover', (e) => { e.stopPropagation(); remove(item.id); });
    up.disabled = i === 0;
    down.disabled = i === items.length - 1;

    actions.append(up, down, play, del);
    li.append(icon, name, actions);
    li.addEventListener('click', () => send(item.id));
    playlistEl.appendChild(li);
  });
}

function mkBtn(label, title, onClick) {
  const b = document.createElement('button');
  b.className = 'track-btn';
  b.textContent = label;
  b.title = title;
  b.addEventListener('click', onClick);
  return b;
}

function renderNowPlaying() {
  const cur = items.find((m) => m.id === currentId);
  npNameEl.textContent = cur ? cur.name : 'Nada em exibição';
  playPauseEl.textContent = playing ? '⏸' : '▶';
  const isTimed = cur && (cur.kind === 'video' || cur.kind === 'audio');
  seekEl.disabled = !isTimed;
  prevEl.disabled = indexOfCurrent() <= 0;
  nextEl.disabled = indexOfCurrent() === -1 || indexOfCurrent() >= items.length - 1;
}

// ---------- ações ----------

async function send(id) {
  currentId = id;
  await AVDB.setState('current', { mediaId: id, mode, at: Date.now() });
  AVDB.sendCommand({ type: 'load', mediaId: id, mode });
  renderPlaylist();
  renderNowPlaying();
}

async function setMode(newMode) {
  mode = newMode;
  await AVDB.setState('current', { mediaId: currentId, mode, at: Date.now() });
  AVDB.sendCommand({ type: 'mode', mode });
  renderModes();
}

async function move(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= items.length) return;
  const ids = items.map((m) => m.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  await AVDB.setOrder(ids);
  load();
}

async function remove(id) {
  await AVDB.deleteMedia(id);
  if (id === currentId) {
    currentId = null;
    AVDB.sendCommand({ type: 'clear' });
    await AVDB.setState('current', { mediaId: null, mode, at: Date.now() });
  }
  load();
}

function step(delta) {
  const i = indexOfCurrent();
  const target = i === -1 ? (delta > 0 ? 0 : items.length - 1) : i + delta;
  if (target < 0 || target >= items.length) return;
  send(items[target].id);
}

// ---------- eventos ----------

fileEl.addEventListener('change', async () => {
  const files = Array.from(fileEl.files || []);
  for (const file of files) {
    await AVDB.addMedia(file, { name: file.name.replace(/\.[^.]+$/, '') });
  }
  fileEl.value = '';
  load();
});

hideEl.addEventListener('click', async () => {
  currentId = null;
  AVDB.sendCommand({ type: 'clear' });
  await AVDB.setState('current', { mediaId: null, mode, at: Date.now() });
  load();
});

playPauseEl.addEventListener('click', () => {
  AVDB.sendCommand({ type: playing ? 'pause' : 'play' });
});
stopEl.addEventListener('click', () => AVDB.sendCommand({ type: 'stop' }));
prevEl.addEventListener('click', () => step(-1));
nextEl.addEventListener('click', () => step(1));

seekEl.addEventListener('input', () => {
  curTimeEl.textContent = fmtTime(parseFloat(seekEl.value));
});
seekEl.addEventListener('change', () => {
  AVDB.sendCommand({ type: 'seek', time: parseFloat(seekEl.value) });
});

modesEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-btn');
  if (btn) setMode(btn.dataset.mode);
});

// Status vindo do display (estado de reprodução + tempo).
let seeking = false;
seekEl.addEventListener('pointerdown', () => { seeking = true; });
seekEl.addEventListener('pointerup', () => { seeking = false; });

AVDB.onCommand((cmd) => {
  if (!cmd) return;
  if (cmd.type === 'display-status') {
    playing = !!cmd.playing;
    playPauseEl.textContent = playing ? '⏸' : '▶';
    if (cmd.mediaId && cmd.mediaId !== currentId) {
      currentId = cmd.mediaId;
      renderPlaylist();
    }
    durTimeEl.textContent = fmtTime(cmd.duration);
    if (!seeking) {
      seekEl.max = isFinite(cmd.duration) && cmd.duration > 0 ? cmd.duration : 0;
      seekEl.value = cmd.currentTime || 0;
      curTimeEl.textContent = fmtTime(cmd.currentTime);
    }
    renderNowPlaying();
  } else if (cmd.type === 'display-ready') {
    // Reenvia o estado atual para o display que acabou de abrir.
    if (currentId) AVDB.sendCommand({ type: 'load', mediaId: currentId, mode });
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

load();
