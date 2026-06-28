// ===== refs =====
const prevEl = document.getElementById('prev');
const playPauseEl = document.getElementById('playpause');
const stopEl = document.getElementById('stop');
const nextEl = document.getElementById('next');
const repeatEl = document.getElementById('repeat');

const npNameEl = document.getElementById('npName');
const seekEl = document.getElementById('seek');
const curTimeEl = document.getElementById('curTime');
const durTimeEl = document.getElementById('durTime');

const viewToggleEl = document.getElementById('viewToggle');
const muteToggleEl = document.getElementById('muteToggle');
const volSliderEl = document.getElementById('volSlider');

const pvWallEl = document.getElementById('pvWall');
const pvImgEl = document.getElementById('pvImg');
const pvVideoEl = document.getElementById('pvVideo');

const plToggleEl = document.getElementById('plToggle');
const plCountEl = document.getElementById('plCount');
const playlistEl = document.getElementById('playlist');

const fileEl = document.getElementById('file');
const tabsEl = document.querySelector('.tabs');
const libraryEl = document.getElementById('library');

const topbarEl = document.getElementById('topbar');
const deckEl = document.getElementById('deck');
const deckWrapEl = document.getElementById('deckWrap');
const collapseBtnEl = document.getElementById('collapseBtn');
const topCollapsedEl = document.getElementById('topCollapsed');
const ccNameEl = document.getElementById('ccName');

const selbarEl = document.getElementById('selbar');
const selCountEl = document.getElementById('selCount');
const selCancelEl = document.getElementById('selCancel');
const selRenameEl = document.getElementById('selRename');
const selDeleteEl = document.getElementById('selDelete');

const ICON = {
  prev: '', // skip_previous
  play: '', // play_arrow
  pause: '', // pause
  stop: '', // stop
  next: '', // skip_next
  viewOn: '',  // image (visual ativo)
  viewOff: '', // image_not_supported (wallpaper/off)
  volOn: '', // volume_up
  volOff: '', // volume_off
  music: '', // music_note
  broken: '', // broken_image
  del: '', // delete
  import: '', // folder_open
  clear: '', // visibility_off
  repeatAll: '', // repeat
  repeatOne: '', // repeat_one
  shuffle: '', // shuffle
  drag: '', // drag_indicator
  expand: '', // expand_more
  edit: '', // edit
  close: '', // close
  star: '', // star
  plAdd: '', // playlist_add
  plRemove: '', // playlist_remove
  queue: '', // queue_music
  check: '', // check_circle
};

const REPEATS = ['off', 'all', 'one', 'shuffle'];

// ===== estado =====
let plItems = [];          // mídias da playlist (ordenadas)
let libItems = [];         // mídias da aba ativa
let favSet = new Set();
let plSet = new Set();
let currentId = null;
let view = 'visual';
let muted = false;
let volume = 1;
let playing = false;
let repeat = 'all';
let activeTab = 'imports';
let collapsed = true;
let topCollapsed = false;
let selectionMode = false;
const selected = new Set();
let thumbUrls = [];

// ===== preview (espelho do display) =====
// Mostra exatamente o que o display mostra; sempre mudo. Recebe os MESMOS
// comandos enviados ao display e ainda comanda a barra de progresso/avanço.
const preview = createStage({
  wallpaper: pvWallEl, img: pvImgEl, video: pvVideoEl, forceMuted: true,
  onTime: previewTick,
  onEnded: () => autoAdvance(),
});

// Envia o comando ao display E aplica na preview (espelho).
function cmd(obj) { AVDB.sendCommand(obj); preview.handle(obj); }

function previewTick() {
  playing = preview.isPlaying();
  playPauseEl.querySelector('.msym').textContent = playing ? ICON.pause : ICON.play;
  const dur = preview.getDuration();
  durTimeEl.textContent = fmtTime(dur);
  seekEl.disabled = !preview.isTimed();
  if (!seeking) {
    seekEl.max = isFinite(dur) && dur > 0 ? dur : 0;
    seekEl.value = preview.getTime() || 0;
    curTimeEl.textContent = fmtTime(preview.getTime());
  }
}

// ===== util =====
function fmtTime(s) {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
}
function msym(code) {
  const s = document.createElement('span');
  s.className = 'msym';
  s.textContent = code;
  return s;
}
function persistCurrent() {
  return AVDB.setState('current', { mediaId: currentId, view, muted, volume, at: Date.now() });
}

// ===== miniaturas =====
function drawThumb(srcEl, w, h) {
  return new Promise((resolve) => {
    const size = 160;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const scale = Math.max(size / w, size / h);
    const dw = w * scale, dh = h * scale;
    ctx.drawImage(srcEl, (size - dw) / 2, (size - dh) / 2, dw, dh);
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.72);
  });
}
function thumbFromImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => { const b = await drawThumb(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(url); resolve(b); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(); };
    img.src = url;
  });
}
function thumbFromVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true; v.preload = 'auto'; v.playsInline = true;
    v.onloadeddata = () => { try { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); } catch (e) { /* */ } };
    v.onseeked = async () => { const b = await drawThumb(v, v.videoWidth || 160, v.videoHeight || 160); URL.revokeObjectURL(url); resolve(b); };
    v.onerror = () => { URL.revokeObjectURL(url); reject(); };
    v.src = url;
  });
}
async function makeThumb(file, kind) {
  const gen = kind === 'image' ? thumbFromImage(file) : kind === 'video' ? thumbFromVideo(file) : null;
  if (!gen) return null;
  const timeout = new Promise((res) => setTimeout(() => res(null), 4000));
  try { return await Promise.race([gen, timeout]); } catch (e) { return null; }
}

// ===== carregar + render =====
async function load() {
  const cur = await AVDB.getState('current');
  currentId = cur && cur.mediaId ? cur.mediaId : null;
  view = (cur && cur.view) || 'visual';
  muted = !!(cur && cur.muted);
  volume = (cur && typeof cur.volume === 'number') ? cur.volume : 1;
  repeat = (await AVDB.getState('repeat')) || 'off';
  const col = await AVDB.getState('plCollapsed');
  collapsed = col === undefined ? true : !!col;
  topCollapsed = !!(await AVDB.getState('topCollapsed'));

  plItems = await AVDB.listItems('playlist');
  plSet = new Set(plItems.map((m) => m.id));
  favSet = new Set(await AVDB.listIds('favorites'));
  libItems = await AVDB.listItems(activeTab);

  renderControls();
  renderNowPlaying();
  renderRepeat();
  renderTabs();
  renderPlaylist();
  renderLibrary();
  renderSelbar();
  renderTop();

  // mantém a preview alinhada (sem recarregar a mídia)
  preview.setView(view); preview.setMute(muted); preview.setVolume(volume);
}

function renderControls() {
  viewToggleEl.querySelector('.msym').textContent = view === 'visual' ? ICON.viewOn : ICON.viewOff;
  viewToggleEl.classList.toggle('active', view === 'visual');
  muteToggleEl.querySelector('.msym').textContent = muted ? ICON.volOff : ICON.volOn;
  muteToggleEl.classList.toggle('muted', muted);
  if (!volSeeking) volSliderEl.value = Math.round(volume * 100);
}

function renderRepeat() {
  const icon = repeat === 'one' ? ICON.repeatOne : repeat === 'shuffle' ? ICON.shuffle : ICON.repeatAll;
  const label = repeat === 'off' ? 'Repetição desativada'
    : repeat === 'one' ? 'Repetir 1' : repeat === 'shuffle' ? 'Aleatório' : 'Repetir tudo';
  repeatEl.querySelector('.msym').textContent = icon;
  repeatEl.title = label;
  repeatEl.classList.toggle('active', repeat !== 'off');
}

function renderNowPlaying() {
  const cur = [...plItems, ...libItems].find((m) => m.id === currentId);
  npNameEl.textContent = cur ? cur.name : 'Nada em exibição';
  ccNameEl.textContent = cur ? cur.name : 'Controles';
  playPauseEl.querySelector('.msym').textContent = playing ? ICON.pause : ICON.play;
  const isTimed = cur && (cur.kind === 'video' || cur.kind === 'audio');
  seekEl.disabled = !isTimed;
}

function renderTabs() {
  tabsEl.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === activeTab));
}

// ---- thumb element ----
function thumbEl(item) {
  const t = document.createElement('div');
  t.className = 'thumb';
  if (item.thumb) {
    const url = URL.createObjectURL(item.thumb);
    thumbUrls.push(url);
    const im = document.createElement('img'); im.src = url; im.alt = '';
    t.appendChild(im);
  } else {
    t.appendChild(msym(item.kind === 'audio' ? ICON.music : ICON.broken));
    t.classList.add('thumb--icon');
  }
  return t;
}

// ---- Playlist (sequência) ----
function renderPlaylist() {
  plCountEl.textContent = String(plItems.length);
  plToggleEl.setAttribute('aria-expanded', String(!collapsed));
  plToggleEl.querySelector('.pl-caret').textContent = ICON.expand;
  plToggleEl.querySelector('.pl-caret').style.transform = collapsed ? '' : 'rotate(180deg)';
  playlistEl.hidden = collapsed;
  if (collapsed) return;

  playlistEl.innerHTML = '';
  if (plItems.length === 0) {
    playlistEl.innerHTML = '<li class="empty">Playlist vazia.<br>Deslize um item para a esquerda para adicionar.</li>';
    return;
  }
  plItems.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'row-item' + (item.id === currentId ? ' active' : '');
    li.dataset.id = item.id;

    const row = document.createElement('div');
    row.className = 'row';
    const name = document.createElement('span'); name.className = 'row-name'; name.textContent = item.name;
    const rm = document.createElement('button'); rm.className = 'row-btn'; rm.title = 'Tirar da playlist';
    rm.appendChild(msym(ICON.plRemove));
    rm.addEventListener('click', async (e) => { e.stopPropagation(); await AVDB.listRemove('playlist', item.id); load(); });
    const handle = document.createElement('button'); handle.className = 'row-handle'; handle.title = 'Arraste para reordenar';
    handle.appendChild(msym(ICON.drag));

    row.append(name, rm, handle); // playlist: só nome, excluir e reordenar
    li.appendChild(row);
    row.addEventListener('click', (e) => { if (!e.target.closest('.row-btn,.row-handle')) send(item.id); });
    attachHandle(handle, item.id, 'playlist');
    playlistEl.appendChild(li);
  });
}

// ---- Biblioteca (Importados / Favoritos) ----
function renderLibrary() {
  thumbUrls.forEach((u) => URL.revokeObjectURL(u));
  thumbUrls = [];
  libraryEl.innerHTML = '';

  if (libItems.length === 0) {
    libraryEl.innerHTML = activeTab === 'favorites'
      ? '<li class="empty">Sem favoritos.<br>Deslize um item para a direita para favoritar.</li>'
      : '<li class="empty">Nenhuma mídia.<br>Toque em “Importar mídia”.</li>';
    return;
  }

  libItems.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'lib-item' + (item.id === currentId ? ' active' : '') + (selected.has(item.id) ? ' selected' : '');
    li.dataset.id = item.id;

    // fundo de ação do swipe
    const bg = document.createElement('div'); bg.className = 'swipe-bg';
    const left = document.createElement('div'); left.className = 'swipe-hint left'; left.appendChild(msym(ICON.star));   // deslizar p/ direita -> favoritos
    const right = document.createElement('div'); right.className = 'swipe-hint right'; right.appendChild(msym(ICON.plAdd)); // deslizar p/ esquerda -> playlist
    bg.append(left, right);

    const row = document.createElement('div'); row.className = 'row';

    // marca de seleção / estrela de favorito
    const mark = document.createElement('span'); mark.className = 'row-mark';
    if (selectionMode) mark.appendChild(msym(ICON.check));
    else if (activeTab === 'imports' && favSet.has(item.id)) { mark.appendChild(msym(ICON.star)); mark.classList.add('is-fav'); }

    const name = document.createElement('span'); name.className = 'row-name'; name.textContent = item.name;
    const handle = document.createElement('button'); handle.className = 'row-handle'; handle.title = 'Arraste para reordenar';
    handle.appendChild(msym(ICON.drag));

    row.append(mark, thumbEl(item), name, handle);
    li.append(bg, row);
    attachRowGestures(row, item);
    attachHandle(handle, item.id, activeTab);
    libraryEl.appendChild(li);
  });
}

function renderSelbar() {
  selbarEl.hidden = !selectionMode;
  if (!selectionMode) return;
  selCountEl.textContent = String(selected.size);
  selRenameEl.disabled = selected.size !== 1;
}

// ===== ações de reprodução / sequência =====
async function send(id) {
  currentId = id;
  await persistCurrent();
  cmd({ type: 'load', mediaId: id, view, muted, volume });
  // re-render leve de estados ativos
  document.querySelectorAll('.lib-item,.row-item').forEach((el) => el.classList.toggle('active', el.dataset.id === id));
  renderNowPlaying();
}

function step(delta) {
  if (plItems.length === 0) return;
  const idx = plItems.findIndex((m) => m.id === currentId);
  const target = idx === -1 ? 0 : (idx + delta + plItems.length) % plItems.length;
  send(plItems[target].id);
}

function resetAfterEnd() {
  // stage.js já voltou ao wallpaper internamente (ended flag);
  // apenas atualiza a UI sem limpar currentId (replay possível com play)
  playing = false;
  playPauseEl.querySelector('.msym').textContent = ICON.play;
  seekEl.value = 0;
  curTimeEl.textContent = '0:00';
  seekEl.disabled = false;
  durTimeEl.textContent = fmtTime(preview.getDuration());
}

function autoAdvance() {
  if (repeat === 'off') { resetAfterEnd(); return; }
  if (repeat === 'one') { if (currentId) send(currentId); return; }
  if (plItems.length === 0) return;
  if (repeat === 'shuffle') {
    if (plItems.length === 1) { send(plItems[0].id); return; }
    let i; do { i = Math.floor(Math.random() * plItems.length); } while (plItems[i].id === currentId);
    send(plItems[i].id);
    return;
  }
  // all
  const idx = plItems.findIndex((m) => m.id === currentId);
  const target = idx === -1 ? 0 : (idx + 1) % plItems.length;
  send(plItems[target].id);
}

async function cycleRepeat() {
  repeat = REPEATS[(REPEATS.indexOf(repeat) + 1) % REPEATS.length];
  await AVDB.setState('repeat', repeat);
  renderRepeat();
}

async function setView(v) {
  view = v; await persistCurrent();
  cmd({ type: 'view', view });
  renderControls();
}
async function toggleMute() {
  muted = !muted; await persistCurrent();
  cmd({ type: 'mute', muted });
  renderControls();
}

// Parar = limpar o display (volta ao wallpaper) e zera o atual.
async function stopClear() {
  currentId = null;
  cmd({ type: 'clear' });
  await persistCurrent();
  load();
}

async function toggleTop() {
  topCollapsed = !topCollapsed;
  await AVDB.setState('topCollapsed', topCollapsed);
  renderTop();
}
function renderTop() {
  deckWrapEl.classList.toggle('collapsed', topCollapsed);
  collapseBtnEl.classList.toggle('is-collapsed', topCollapsed);
  topCollapsedEl.hidden = !topCollapsed;
  const cur = [...plItems, ...libItems].find((m) => m.id === currentId);
  ccNameEl.textContent = cur ? cur.name : 'Controles';
}

// ===== gestos da biblioteca =====
const SWIPE = 72, MOVE = 10, LONGPRESS = 450;

function attachRowGestures(row, item) {
  let startX = 0, startY = 0, startT = 0, dx = 0, mode = null, lp = null, pid = null;
  const li = row.closest('li') || row.parentElement;

  row.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.row-handle')) return;
    pid = e.pointerId; startX = e.clientX; startY = e.clientY; startT = Date.now(); dx = 0; mode = null;
    lp = setTimeout(() => { mode = 'long'; enterSelection(item.id); }, LONGPRESS);
  });
  row.addEventListener('pointermove', (e) => {
    if (pid === null) return;
    const ddx = e.clientX - startX, ddy = e.clientY - startY;
    if (mode === null) {
      if (Math.abs(ddx) > MOVE && Math.abs(ddx) > Math.abs(ddy)) { mode = 'swipe'; clearTimeout(lp); try { row.setPointerCapture(pid); } catch (_) {} }
      else if (Math.abs(ddy) > MOVE) { clearTimeout(lp); pid = null; return; }
    }
    if (mode === 'swipe') {
      dx = ddx; row.style.transform = `translateX(${dx}px)`;
      li.classList.toggle('show-left', dx < 0);
      li.classList.toggle('show-right', dx > 0);
    }
  });
  function finish(e) {
    if (pid === null) return;
    clearTimeout(lp);
    const dt = Date.now() - startT;
    if (mode === 'swipe') {
      row.style.transform = '';
      li.classList.remove('show-left', 'show-right');
      if (dx <= -SWIPE) addTo('playlist', item);
      else if (dx >= SWIPE) addTo('favorites', item);
    } else if (mode !== 'long') {
      const moved = Math.abs((e.clientX || startX) - startX) > MOVE || Math.abs((e.clientY || startY) - startY) > MOVE;
      if (!moved && dt < LONGPRESS) onTap(item);
    }
    pid = null; mode = null;
  }
  row.addEventListener('pointerup', finish);
  row.addEventListener('pointercancel', () => { clearTimeout(lp); row.style.transform = ''; li.classList.remove('show-left', 'show-right'); pid = null; mode = null; });
}

function onTap(item) {
  if (selectionMode) toggleSelect(item.id);
  else send(item.id);
}

async function addTo(listName, item) {
  const had = await AVDB.listHas(listName, item.id);
  await AVDB.listAdd(listName, item.id);
  flash(listName === 'playlist' ? (had ? 'Já na playlist' : 'Adicionado à playlist') : (had ? 'Já nos favoritos' : 'Favoritado'));
  load();
}

// ===== arrastar para reordenar =====
function attachHandle(handle, id, listName) {
  let pid = null, startY = 0, li = null;
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    pid = e.pointerId; startY = e.clientY; li = handle.closest('li');
    li.classList.add('dragging');
    try { handle.setPointerCapture(pid); } catch (_) {}
  });
  handle.addEventListener('pointermove', (e) => {
    if (pid === null) return;
    li.style.transform = `translateY(${e.clientY - startY}px)`;
    showDropLine(li.parentElement, li, e.clientY);
  });
  async function drop(e) {
    if (pid === null) return;
    const ul = li.parentElement;
    const target = dropIndex(ul, li, e.clientY);
    li.style.transform = ''; li.classList.remove('dragging');
    hideDropLine(ul);
    pid = null;
    await reorder(listName, id, target);
  }
  handle.addEventListener('pointerup', drop);
  handle.addEventListener('pointercancel', () => { if (li) { li.style.transform = ''; li.classList.remove('dragging'); hideDropLine(li.parentElement); } pid = null; });
}

function dropIndex(ul, draggedLi, y) {
  const lis = [...ul.querySelectorAll('li')].filter((l) => l !== draggedLi);
  let idx = lis.length;
  for (let i = 0; i < lis.length; i++) {
    const r = lis[i].getBoundingClientRect();
    if (y < r.top + r.height / 2) { idx = i; break; }
  }
  return idx;
}

// linha-guia azul mostrando onde o item vai cair
function showDropLine(ul, draggedLi, y) {
  let line = ul.querySelector('.drop-line');
  if (!line) { line = document.createElement('div'); line.className = 'drop-line'; ul.appendChild(line); }
  const lis = [...ul.querySelectorAll('li')].filter((l) => l !== draggedLi);
  const ulTop = ul.getBoundingClientRect().top;
  let top;
  let before = null;
  for (const el of lis) {
    const r = el.getBoundingClientRect();
    if (y < r.top + r.height / 2) { before = el; break; }
  }
  if (before) top = before.getBoundingClientRect().top - ulTop;
  else if (lis.length) { const r = lis[lis.length - 1].getBoundingClientRect(); top = r.bottom - ulTop; }
  else top = 0;
  line.style.top = (top + ul.scrollTop) + 'px';
}
function hideDropLine(ul) {
  const line = ul && ul.querySelector('.drop-line');
  if (line) line.remove();
}

async function reorder(listName, id, toIndex) {
  const ids = await AVDB.listIds(listName);
  const from = ids.indexOf(id);
  if (from === -1) return;
  ids.splice(from, 1);
  ids.splice(toIndex, 0, id);
  await AVDB.listSet(listName, ids);
  load();
}

// ===== seleção múltipla =====
function enterSelection(id) {
  selectionMode = true;
  selected.clear();
  selected.add(id);
  renderLibrary(); renderSelbar();
}
function toggleSelect(id) {
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  if (selected.size === 0) exitSelection();
  else { renderLibrary(); renderSelbar(); }
}
function exitSelection() {
  selectionMode = false; selected.clear();
  renderLibrary(); renderSelbar();
}
async function deleteSelected() {
  for (const id of selected) await AVDB.listRemove(activeTab, id);
  exitSelection(); load();
}
async function renameSelected() {
  if (selected.size !== 1) return;
  const id = [...selected][0];
  const item = libItems.find((m) => m.id === id);
  const name = prompt('Novo nome:', item ? item.name : '');
  if (name && name.trim()) await AVDB.renameMedia(id, name.trim());
  exitSelection(); load();
}

// ===== feedback rápido =====
let flashTimer = null;
function flash(text) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = text; el.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('show'), 1300);
}

// ===== eventos =====
fileEl.addEventListener('change', async () => {
  const files = Array.from(fileEl.files || []);
  for (const file of files) {
    const kind = AVDB.kindFromType(file.type);
    const thumb = await makeThumb(file, kind);
    await AVDB.addMedia(file, { name: file.name.replace(/\.[^.]+$/, ''), thumb });
  }
  fileEl.value = '';
  if (activeTab !== 'imports') activeTab = 'imports';
  load();
});

playPauseEl.addEventListener('click', () => cmd({ type: playing ? 'pause' : 'play' }));
stopEl.addEventListener('click', stopClear);
prevEl.addEventListener('click', () => step(-1));
nextEl.addEventListener('click', () => step(1));
repeatEl.addEventListener('click', cycleRepeat);

collapseBtnEl.addEventListener('click', toggleTop);
topCollapsedEl.addEventListener('click', toggleTop);

seekEl.addEventListener('input', () => { curTimeEl.textContent = fmtTime(parseFloat(seekEl.value)); });
seekEl.addEventListener('change', () => cmd({ type: 'seek', time: parseFloat(seekEl.value) }));

viewToggleEl.addEventListener('click', () => setView(view === 'visual' ? 'wallpaper' : 'visual'));
muteToggleEl.addEventListener('click', toggleMute);

let volSeeking = false;
volSliderEl.addEventListener('pointerdown', () => { volSeeking = true; });
volSliderEl.addEventListener('pointerup', () => { volSeeking = false; });
volSliderEl.addEventListener('input', () => {
  volume = parseInt(volSliderEl.value, 10) / 100;
  if (volume > 0 && muted) { muted = false; cmd({ type: 'mute', muted }); }
  cmd({ type: 'volume', volume });
  renderControls();
});
volSliderEl.addEventListener('change', () => { volSeeking = false; persistCurrent(); });

plToggleEl.addEventListener('click', async () => {
  collapsed = !collapsed;
  await AVDB.setState('plCollapsed', collapsed);
  renderPlaylist();
});

tabsEl.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab || tab.dataset.tab === activeTab) return;
  activeTab = tab.dataset.tab;
  if (selectionMode) exitSelection();
  load();
});

selCancelEl.addEventListener('click', exitSelection);
selDeleteEl.addEventListener('click', deleteSelected);
selRenameEl.addEventListener('click', renameSelected);

let seeking = false;
seekEl.addEventListener('pointerdown', () => { seeking = true; });
seekEl.addEventListener('pointerup', () => { seeking = false; });

// A preview (local) comanda a barra de progresso e o avanço automático.
// Aqui só tratamos a (re)sincronização de um display recém-aberto.
AVDB.onCommand((msg) => {
  if (!msg) return;
  if (msg.type === 'display-ready' && currentId) {
    AVDB.sendCommand({ type: 'load', mediaId: currentId, view, muted, volume });
  }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

(async function init() {
  await load();
  // carrega a mídia atual na preview (uma vez, na abertura)
  if (currentId) preview.load(currentId, view, muted, volume);
})();
