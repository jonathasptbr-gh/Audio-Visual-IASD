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

const plBtnEl = document.getElementById('plBtn');
const plCountEl = document.getElementById('plCount');
const playlistEl = document.getElementById('playlist');
const plPopupEl = document.getElementById('plPopup');
const plPopupCountEl = document.getElementById('plPopupCount');
const plPopupCloseEl = document.getElementById('plPopupClose');

const fileEl = document.getElementById('file');
const tabsEl = document.querySelector('.tabs');
const libraryEl = document.getElementById('library');
const listTitleEl = document.getElementById('listTitle');

const deckEl = document.getElementById('deck');

const selbarEl = document.getElementById('selbar');
const selCountEl = document.getElementById('selCount');
const selCancelEl = document.getElementById('selCancel');
const selFavToggleEl = document.getElementById('selFavToggle');
const selFolderEl = document.getElementById('selFolder');
const selRenameEl = document.getElementById('selRename');
const selDeleteEl = document.getElementById('selDelete');

const backBtnEl = document.getElementById('backBtn');
const tabImportEl = document.getElementById('tabImport');
const tabNewFolderEl = document.getElementById('tabNewFolder');
const folderPopupEl = document.getElementById('folderPopup');
const folderPickerListEl = document.getElementById('folderPickerList');
const folderPopupCloseEl = document.getElementById('folderPopupClose');
const newFolderInPickerBtnEl = document.getElementById('newFolderInPickerBtn');

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
  folder: '',    // folder
  folderNew: '', // create_new_folder
  back: '',      // arrow_back
};

const REPEATS = ['off', 'all', 'one', 'shuffle'];

// ===== estado =====
let plItems = [];          // mídias da playlist (ordenadas)
let libItems = [];         // mídias da aba ativa
let currentItem = null;    // registro da mídia atual (mesmo que não esteja na aba visível)
let favSet = new Set();
let plSet = new Set();
let currentId = null;
let view = 'visual';
let muted = false;
let volume = 1;
let playing = false;
let repeat = 'all';
let activeTab = 'imports';
let selectionMode = false;
const selected = new Set();
let thumbUrls = [];
let currentFolder = null; // null | {id, name} — pasta aberta
let folders = [];          // [{id, name}, ...]
let folderCounts = {};     // {folderId: count}

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
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try { resolve(await drawThumb(img, img.naturalWidth, img.naturalHeight)); }
      catch (e) { resolve(null); }
      finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
function thumbFromVideo(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    let settled = false;
    function finish(blob) {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(blob);
    }
    v.muted = true; v.preload = 'auto'; v.playsInline = true;
    v.onloadeddata = () => {
      try { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); }
      catch (e) { finish(null); }
    };
    v.onseeked = async () => {
      try { finish(await drawThumb(v, v.videoWidth || 160, v.videoHeight || 160)); }
      catch (e) { finish(null); }
    };
    v.onerror = () => finish(null);
    v.src = url;
    // Garante limpeza caso onseeked nunca dispare (ex: vídeo com duração=0).
    setTimeout(() => finish(null), 3500);
  });
}
async function makeThumb(file, kind) {
  if (kind !== 'image' && kind !== 'video') return null;
  return kind === 'image' ? thumbFromImage(file) : thumbFromVideo(file);
}

// ===== carregar + render =====
async function load() {
  const cur = await AVDB.getState('current');
  currentId = cur && cur.mediaId ? cur.mediaId : null;
  view = (cur && cur.view) || 'visual';
  muted = !!(cur && cur.muted);
  volume = (cur && typeof cur.volume === 'number') ? cur.volume : 1;
  repeat = (await AVDB.getState('repeat')) || 'off';

  plItems = await AVDB.listItems('playlist');
  plSet = new Set(plItems.map((m) => m.id));
  favSet = new Set(await AVDB.listIds('favorites'));
  folders = (await AVDB.getState('folders')) || [];
  folderCounts = {};
  for (const f of folders) {
    const ids = (await AVDB.getState('folder_' + f.id)) || [];
    folderCounts[f.id] = ids.length;
  }
  if (activeTab === 'folders') {
    libItems = currentFolder ? await loadFolderMediaItems(currentFolder.id) : [];
  } else {
    libItems = await AVDB.listItems(activeTab);
  }

  // Cache do item atual para renderNowPlaying mesmo quando não está na aba visível.
  currentItem = currentId ? (await AVDB.getMedia(currentId)) || null : null;

  renderControls();
  renderNowPlaying();
  renderRepeat();
  renderTabs();
  renderListTitle();
  renderPlaylist();
  renderLibrary();
  renderSelbar();

  // mantém a preview alinhada (sem recarregar a mídia)
  preview.setView(view); preview.setMute(muted); preview.setVolume(volume);
}

function renderControls() {
  viewToggleEl.querySelector('.msym').textContent = view === 'visual' ? ICON.viewOn : ICON.viewOff;
  viewToggleEl.classList.toggle('view-blocked', view === 'wallpaper');
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
  // Prioriza plItems/libItems (já carregados); usa currentItem como fallback
  // para o caso de o item estar somente em outra aba (ex: apenas em favoritos).
  const cur = [...plItems, ...libItems].find((m) => m.id === currentId) || currentItem;
  npNameEl.textContent = cur ? cur.name : 'Nada em exibição';
  playPauseEl.querySelector('.msym').textContent = playing ? ICON.pause : ICON.play;
  const isTimed = cur && (cur.kind === 'video' || cur.kind === 'audio');
  seekEl.disabled = !isTimed;
}

function renderTabs() {
  tabsEl.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === activeTab));
  tabImportEl.hidden = activeTab !== 'imports';
  tabNewFolderEl.hidden = activeTab !== 'folders';
}

function renderListTitle() {
  const inFolder = activeTab === 'folders' && currentFolder !== null;
  backBtnEl.hidden = !inFolder;
  const titles = { imports: 'Importados', folders: 'Pastas' };
  listTitleEl.textContent = inFolder ? currentFolder.name : (titles[activeTab] || '');
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
  const count = plItems.length;
  plCountEl.textContent = count > 0 ? String(count) : '';
  plPopupCountEl.textContent = String(count);
  plBtnEl.classList.toggle('has-items', count > 0);

  playlistEl.innerHTML = '';
  if (count === 0) {
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

    row.append(name, rm, handle);
    li.appendChild(row);
    row.addEventListener('click', (e) => { if (!e.target.closest('.row-btn,.row-handle')) send(item.id); });
    attachHandle(handle, item.id, 'playlist');
    playlistEl.appendChild(li);
  });
}

// ---- Biblioteca (Importados / Pastas) ----
function renderLibrary() {
  thumbUrls.forEach((u) => URL.revokeObjectURL(u));
  thumbUrls = [];
  libraryEl.innerHTML = '';

  if (activeTab === 'folders' && !currentFolder) {
    renderFolderList();
    return;
  }

  if (libItems.length === 0) {
    libraryEl.innerHTML = activeTab === 'folders'
      ? '<li class="empty">Pasta vazia.</li>'
      : '<li class="empty">Nenhuma mídia.<br>Toque em \'Importar mídia\'.</li>';
    return;
  }

  libItems.forEach((item) => {
    const li = document.createElement('li');
    // Bug fix: active highlight only when not in selection mode
    const isActive = !selectionMode && item.id === currentId;
    li.className = 'lib-item' + (isActive ? ' active' : '') + (selected.has(item.id) ? ' selected' : '');
    li.dataset.id = item.id;

    if (activeTab !== 'folders') {
      const bg = document.createElement('div'); bg.className = 'swipe-bg';
      const right = document.createElement('div'); right.className = 'swipe-hint right'; right.appendChild(msym(ICON.plAdd));
      bg.appendChild(right);
      li.appendChild(bg);
    }

    const row = document.createElement('div'); row.className = 'row';

    const mark = document.createElement('span'); mark.className = 'row-mark';
    // Bug fix: check icon only on actually-selected items
    if (selectionMode && selected.has(item.id)) mark.appendChild(msym(ICON.check));
    else if (!selectionMode && activeTab === 'imports' && favSet.has(item.id)) { mark.appendChild(msym(ICON.star)); mark.classList.add('is-fav'); }

    const name = document.createElement('span'); name.className = 'row-name'; name.textContent = item.name;
    const handle = document.createElement('button'); handle.className = 'row-handle'; handle.title = 'Arraste para reordenar';
    handle.appendChild(msym(ICON.drag));

    row.append(mark, thumbEl(item), name, handle);
    li.appendChild(row);
    attachRowGestures(row, item);
    if (activeTab !== 'folders') attachHandle(handle, item.id, activeTab);
    libraryEl.appendChild(li);
  });
}

function renderFolderList() {
  if (folders.length === 0) {
    libraryEl.innerHTML = '<li class="empty">Nenhuma pasta.<br>Toque em "+" para criar.</li>';
    return;
  }
  folders.forEach((folder) => {
    const count = folderCounts[folder.id] || 0;
    const li = document.createElement('li');
    li.className = 'lib-item';

    const row = document.createElement('div'); row.className = 'row';
    const icon = document.createElement('div'); icon.className = 'thumb thumb--icon';
    icon.appendChild(msym(ICON.folder));
    const nameEl = document.createElement('span'); nameEl.className = 'row-name'; nameEl.textContent = folder.name;
    const countEl = document.createElement('span'); countEl.className = 'folder-count'; countEl.textContent = String(count);
    const rmBtn = document.createElement('button'); rmBtn.className = 'row-btn'; rmBtn.title = 'Excluir pasta';
    rmBtn.appendChild(msym(ICON.del));
    rmBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteFolder(folder.id); });

    row.append(icon, nameEl, countEl, rmBtn);
    li.appendChild(row);
    li.addEventListener('click', () => openFolder(folder));
    libraryEl.appendChild(li);
  });
}

function renderSelbar() {
  selbarEl.hidden = !selectionMode;
  tabsEl.hidden = selectionMode;
  if (!selectionMode) return;
  selCountEl.textContent = String(selected.size);
  selRenameEl.disabled = selected.size !== 1;
  const allFav = selected.size > 0 && [...selected].every((id) => favSet.has(id));
  selFavToggleEl.classList.toggle('is-fav', allFav);
}

// ===== ações de reprodução / sequência =====
async function send(id) {
  currentId = id;
  // Atualiza cache do item atual para renderNowPlaying funcionar mesmo fora da aba ativa.
  currentItem = [...plItems, ...libItems].find((m) => m.id === id) || currentItem;
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
    } else if (mode !== 'long') {
      const moved = Math.abs((e.clientX || startX) - startX) > MOVE || Math.abs((e.clientY || startY) - startY) > MOVE;
      if (!moved && dt < LONGPRESS) onTap(item);
    }
    pid = null; mode = null;
  }
  row.addEventListener('pointerup', finish);
  row.addEventListener('pointercancel', () => { clearTimeout(lp); row.style.transform = ''; li.classList.remove('show-left', 'show-right'); pid = null; mode = null; });
}

async function onTap(item) {
  if (selectionMode) { toggleSelect(item.id); return; }
  // Toque direto na biblioteca: define a playlist como este item apenas.
  // Swipe para esquerda continua ADICIONANDO à playlist.
  await AVDB.listSet('playlist', [item.id]);
  plItems = [item];
  plSet = new Set([item.id]);
  renderPlaylist();
  send(item.id);
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
  if (activeTab === 'folders' && currentFolder) {
    const ids = (await AVDB.getState('folder_' + currentFolder.id)) || [];
    await AVDB.setState('folder_' + currentFolder.id, ids.filter((id) => !selected.has(id)));
  } else {
    for (const id of selected) await AVDB.listRemove(activeTab, id);
  }
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

// ===== pastas =====
async function loadFolderMediaItems(folderId) {
  const ids = (await AVDB.getState('folder_' + folderId)) || [];
  const items = await Promise.all(ids.map((id) => AVDB.getMedia(id)));
  return items.filter(Boolean);
}

function openFolder(folder) {
  currentFolder = folder;
  load();
}

function navigateBack() {
  currentFolder = null;
  load();
}

async function createFolder(name) {
  const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
  folders.push({ id, name });
  await AVDB.setState('folders', folders);
  load();
}

async function deleteFolder(folderId) {
  folders = folders.filter((f) => f.id !== folderId);
  await AVDB.setState('folders', folders);
  await AVDB.setState('folder_' + folderId, []);
  if (currentFolder && currentFolder.id === folderId) currentFolder = null;
  load();
}

async function addToFolder(folderId, ids) {
  const existing = (await AVDB.getState('folder_' + folderId)) || [];
  await AVDB.setState('folder_' + folderId, [...new Set([...existing, ...ids])]);
  flash('Salvo na pasta');
  exitSelection();
  load();
}

function openFolderPicker() {
  renderFolderPicker();
  folderPopupEl.classList.add('open');
}

function closeFolderPicker() {
  folderPopupEl.classList.remove('open');
}

function renderFolderPicker() {
  folderPickerListEl.innerHTML = '';
  if (folders.length === 0) {
    folderPickerListEl.innerHTML = '<li class="empty">Nenhuma pasta ainda.<br>Crie uma abaixo.</li>';
    return;
  }
  const selectedIds = [...selected];
  folders.forEach((folder) => {
    const li = document.createElement('li');
    const btn = document.createElement('button'); btn.className = 'folder-pick-btn';
    btn.append(msym(ICON.folder), Object.assign(document.createElement('span'), { textContent: folder.name }));
    btn.addEventListener('click', () => { closeFolderPicker(); addToFolder(folder.id, selectedIds); });
    li.appendChild(btn);
    folderPickerListEl.appendChild(li);
  });
}

async function toggleFavSelected() {
  const allFav = [...selected].every((id) => favSet.has(id));
  for (const id of selected) {
    if (allFav) await AVDB.listRemove('favorites', id);
    else await AVDB.listAdd('favorites', id);
  }
  favSet = new Set(await AVDB.listIds('favorites'));
  flash(allFav ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
  renderSelbar();
  renderLibrary();
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

// ===== popup de playlist =====
function openPlPopup() {
  renderPlaylist();
  plPopupEl.classList.add('open');
}
function closePlPopup() {
  plPopupEl.classList.remove('open');
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


seekEl.addEventListener('input', () => { curTimeEl.textContent = fmtTime(parseFloat(seekEl.value)); });
seekEl.addEventListener('change', () => cmd({ type: 'seek', time: parseFloat(seekEl.value) }));

viewToggleEl.addEventListener('click', () => setView(view === 'visual' ? 'wallpaper' : 'visual'));
muteToggleEl.addEventListener('click', toggleMute);

let volSeeking = false;
volSliderEl.addEventListener('pointerdown', () => { volSeeking = true; });
volSliderEl.addEventListener('pointerup', () => { volSeeking = false; });
volSliderEl.addEventListener('input', () => {
  volume = parseFloat(volSliderEl.value) / 100;
  if (volume > 0 && muted) { muted = false; cmd({ type: 'mute', muted }); }
  cmd({ type: 'volume', volume });
  renderControls();
});
volSliderEl.addEventListener('change', () => { volSeeking = false; persistCurrent(); });

plBtnEl.addEventListener('click', openPlPopup);
plPopupCloseEl.addEventListener('click', closePlPopup);
plPopupEl.addEventListener('click', (e) => { if (e.target === plPopupEl) closePlPopup(); });

tabsEl.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab || tab.dataset.tab === activeTab) return;
  activeTab = tab.dataset.tab;
  currentFolder = null;
  if (selectionMode) exitSelection();
  load();
});

selCancelEl.addEventListener('click', exitSelection);
selFavToggleEl.addEventListener('click', toggleFavSelected);
selFolderEl.addEventListener('click', openFolderPicker);
selDeleteEl.addEventListener('click', deleteSelected);
selRenameEl.addEventListener('click', renameSelected);

backBtnEl.addEventListener('click', navigateBack);

tabNewFolderEl.addEventListener('click', async () => {
  const name = prompt('Nome da nova pasta:');
  if (name && name.trim()) await createFolder(name.trim());
});

folderPopupCloseEl.addEventListener('click', closeFolderPicker);
folderPopupEl.addEventListener('click', (e) => { if (e.target === folderPopupEl) closeFolderPicker(); });

newFolderInPickerBtnEl.addEventListener('click', async () => {
  const name = prompt('Nome da nova pasta:');
  if (name && name.trim()) { await createFolder(name.trim()); renderFolderPicker(); }
});

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
