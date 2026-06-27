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

const viewToggleEl = document.getElementById('viewToggle');
const viewLabelEl = document.getElementById('viewLabel');
const muteToggleEl = document.getElementById('muteToggle');
const volLabelEl = document.getElementById('volLabel');

// Codepoints do subconjunto Material Symbols (ver material-symbols.css).
const ICON = {
  play: '\ue037',      // play_arrow
  pause: '\ue034',     // pause
  up: '\ue316',        // keyboard_arrow_up
  down: '\ue313',      // keyboard_arrow_down
  del: '\ue872',       // delete
  music: '\ue3a1',     // music_note
  broken: '\ue3ad',    // broken_image
  wallpaper: '\ue1bc', // wallpaper
  visual: '\ue251',    // image
  volOn: '\ue050',     // volume_up
  volOff: '\ue04f',    // volume_off
};

let items = [];           // playlist ordenada (mídias)
let currentId = null;
let view = 'visual';      // 'visual' (mídia na tela) | 'wallpaper' (só wallpaper)
let muted = false;        // áudio do display no mudo
let volume = 1;           // 0..1 (informativo, vindo do display)
let playing = false;
let thumbUrls = [];       // object URLs de miniaturas a revogar entre renders

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

function msym(code) {
  const s = document.createElement('span');
  s.className = 'msym';
  s.textContent = code;
  return s;
}

function persistCurrent() {
  return AVDB.setState('current', { mediaId: currentId, view, muted, at: Date.now() });
}

// ---------- miniaturas ----------

function drawThumb(srcEl, w, h) {
  return new Promise((resolve) => {
    const size = 160;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const scale = Math.max(size / w, size / h);
    const dw = w * scale;
    const dh = h * scale;
    ctx.drawImage(srcEl, (size - dw) / 2, (size - dh) / 2, dw, dh);
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.72);
  });
}

function thumbFromImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      const b = await drawThumb(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(url);
      resolve(b);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(); };
    img.src = url;
  });
}

function thumbFromVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.playsInline = true;
    v.onloadeddata = () => {
      try { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); } catch (e) { /* */ }
    };
    v.onseeked = async () => {
      const b = await drawThumb(v, v.videoWidth || 160, v.videoHeight || 160);
      URL.revokeObjectURL(url);
      resolve(b);
    };
    v.onerror = () => { URL.revokeObjectURL(url); reject(); };
    v.src = url;
  });
}

async function makeThumb(file, kind) {
  const gen = kind === 'image' ? thumbFromImage(file)
    : kind === 'video' ? thumbFromVideo(file)
      : null;
  if (!gen) return null;
  // Timeout de segurança para não travar a importação.
  const timeout = new Promise((res) => setTimeout(() => res(null), 4000));
  try {
    return await Promise.race([gen, timeout]);
  } catch (e) {
    return null;
  }
}

// ---------- render ----------

async function load() {
  items = await AVDB.getPlaylist();
  const cur = await AVDB.getState('current');
  currentId = cur && cur.mediaId ? cur.mediaId : null;
  view = (cur && cur.view) || 'visual';
  muted = !!(cur && cur.muted);
  renderControls();
  renderPlaylist();
  renderNowPlaying();
}

function renderControls() {
  // Toggle de visibilidade (Visual <-> Wallpaper)
  viewToggleEl.querySelector('.msym').textContent = view === 'visual' ? ICON.visual : ICON.wallpaper;
  viewLabelEl.textContent = view === 'visual' ? 'Visual' : 'Wallpaper';
  viewToggleEl.classList.toggle('active', view === 'visual');

  // Botão de volume/mudo
  muteToggleEl.querySelector('.msym').textContent = muted ? ICON.volOff : ICON.volOn;
  volLabelEl.textContent = Math.round(volume * 100) + '%';
  muteToggleEl.classList.toggle('muted', muted);
}

function renderPlaylist() {
  thumbUrls.forEach((u) => URL.revokeObjectURL(u));
  thumbUrls = [];
  playlistEl.innerHTML = '';

  if (items.length === 0) {
    playlistEl.innerHTML =
      '<li class="empty">Nenhuma mídia ainda.<br>Toque em “Importar mídia”.</li>';
    return;
  }

  items.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'track' + (item.id === currentId ? ' active' : '');

    // Miniatura (imagem/vídeo) ou ícone (áudio/sem thumb)
    const thumb = document.createElement('div');
    thumb.className = 'track-thumb';
    if (item.thumb) {
      const url = URL.createObjectURL(item.thumb);
      thumbUrls.push(url);
      const im = document.createElement('img');
      im.src = url;
      im.alt = '';
      thumb.appendChild(im);
    } else {
      thumb.appendChild(msym(item.kind === 'audio' ? ICON.music : ICON.broken));
      thumb.classList.add('track-thumb--icon');
    }

    const name = document.createElement('input');
    name.className = 'track-name';
    name.value = item.name;
    name.addEventListener('click', (e) => e.stopPropagation());
    name.addEventListener('change', () => AVDB.renameMedia(item.id, name.value.trim() || 'sem-nome'));

    const actions = document.createElement('div');
    actions.className = 'track-actions';
    const up = mkBtn(ICON.up, 'Subir', (e) => { e.stopPropagation(); move(i, -1); });
    const down = mkBtn(ICON.down, 'Descer', (e) => { e.stopPropagation(); move(i, 1); });
    const play = mkBtn(ICON.play, 'Exibir', (e) => { e.stopPropagation(); send(item.id); });
    const del = mkBtn(ICON.del, 'Remover', (e) => { e.stopPropagation(); remove(item.id); });
    up.disabled = i === 0;
    down.disabled = i === items.length - 1;
    actions.append(up, down, play, del);

    li.append(thumb, name, actions);
    li.addEventListener('click', () => send(item.id));
    playlistEl.appendChild(li);
  });
}

function mkBtn(code, title, onClick) {
  const b = document.createElement('button');
  b.className = 'track-btn';
  b.title = title;
  b.appendChild(msym(code));
  b.addEventListener('click', onClick);
  return b;
}

function renderNowPlaying() {
  const cur = items.find((m) => m.id === currentId);
  npNameEl.textContent = cur ? cur.name : 'Nada em exibição';
  playPauseEl.querySelector('.msym').textContent = playing ? ICON.pause : ICON.play;
  const isTimed = cur && (cur.kind === 'video' || cur.kind === 'audio');
  seekEl.disabled = !isTimed;
  prevEl.disabled = indexOfCurrent() <= 0;
  nextEl.disabled = indexOfCurrent() === -1 || indexOfCurrent() >= items.length - 1;
}

// ---------- ações ----------

async function send(id) {
  currentId = id;
  await persistCurrent();
  AVDB.sendCommand({ type: 'load', mediaId: id, view, muted });
  renderPlaylist();
  renderNowPlaying();
}

async function setView(v) {
  view = v;
  await persistCurrent();
  AVDB.sendCommand({ type: 'view', view });
  renderControls();
}

async function toggleMute() {
  muted = !muted;
  await persistCurrent();
  AVDB.sendCommand({ type: 'mute', muted });
  renderControls();
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
    await persistCurrent();
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
    const kind = AVDB.kindFromType(file.type);
    const thumb = await makeThumb(file, kind);
    await AVDB.addMedia(file, { name: file.name.replace(/\.[^.]+$/, ''), thumb });
  }
  fileEl.value = '';
  load();
});

hideEl.addEventListener('click', async () => {
  currentId = null;
  AVDB.sendCommand({ type: 'clear' });
  await persistCurrent();
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

viewToggleEl.addEventListener('click', () => setView(view === 'visual' ? 'wallpaper' : 'visual'));
muteToggleEl.addEventListener('click', toggleMute);

let seeking = false;
seekEl.addEventListener('pointerdown', () => { seeking = true; });
seekEl.addEventListener('pointerup', () => { seeking = false; });

AVDB.onCommand((cmd) => {
  if (!cmd) return;
  if (cmd.type === 'display-status') {
    playing = !!cmd.playing;
    playPauseEl.querySelector('.msym').textContent = playing ? ICON.pause : ICON.play;
    if (cmd.mediaId && cmd.mediaId !== currentId) {
      currentId = cmd.mediaId;
      renderPlaylist();
    }
    if (typeof cmd.volume === 'number') volume = cmd.volume;
    if (typeof cmd.muted === 'boolean') muted = cmd.muted;
    durTimeEl.textContent = fmtTime(cmd.duration);
    if (!seeking) {
      seekEl.max = isFinite(cmd.duration) && cmd.duration > 0 ? cmd.duration : 0;
      seekEl.value = cmd.currentTime || 0;
      curTimeEl.textContent = fmtTime(cmd.currentTime);
    }
    renderControls();
    renderNowPlaying();
  } else if (cmd.type === 'display-ready') {
    if (currentId) AVDB.sendCommand({ type: 'load', mediaId: currentId, view, muted });
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

load();
