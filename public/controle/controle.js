const galleryEl = document.getElementById('gallery');
const fileEl = document.getElementById('file');
const hideEl = document.getElementById('hide');
const statusEl = document.getElementById('status');

let currentId = null;

async function render() {
  const media = await AVDB.getAllMedia();
  const state = await AVDB.getState('current');
  currentId = state && state.mediaId ? state.mediaId : null;

  galleryEl.innerHTML = '';

  if (media.length === 0) {
    galleryEl.innerHTML =
      '<p class="empty">Nenhuma imagem ainda.<br>Toque em “Adicionar imagem”.</p>';
    return;
  }

  for (const item of media) {
    const url = URL.createObjectURL(item.blob);

    const card = document.createElement('div');
    card.className = 'card' + (item.id === currentId ? ' active' : '');

    const img = document.createElement('img');
    img.src = url;
    img.alt = item.name;
    img.addEventListener('click', () => show(item.id));

    const del = document.createElement('button');
    del.className = 'card-del';
    del.textContent = '×';
    del.title = 'Remover';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      removeItem(item.id);
    });

    card.appendChild(img);
    card.appendChild(del);
    galleryEl.appendChild(card);
  }
}

async function show(id) {
  await AVDB.setState('current', { mediaId: id, at: Date.now() });
  AVDB.sendCommand({ type: 'show', mediaId: id });
  currentId = id;
  flashStatus('exibindo');
  render();
}

async function hide() {
  await AVDB.setState('current', { mediaId: null, at: Date.now() });
  AVDB.sendCommand({ type: 'clear' });
  currentId = null;
  flashStatus('oculto');
  render();
}

async function removeItem(id) {
  const wasCurrent = id === currentId;
  await AVDB.deleteMedia(id);
  if (wasCurrent) await hide();
  render();
}

let statusTimer = null;
function flashStatus(text) {
  statusEl.textContent = text;
  statusEl.classList.add('on');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusEl.classList.remove('on');
    statusEl.textContent = 'pronto';
  }, 1500);
}

fileEl.addEventListener('change', async () => {
  const file = fileEl.files[0];
  if (!file) return;
  await AVDB.addMedia(file, { name: file.name });
  fileEl.value = '';
  render();
});

hideEl.addEventListener('click', hide);

// O display avisa quando abre/está pronto.
AVDB.onCommand((cmd) => {
  if (cmd && cmd.type === 'display-ready') flashStatus('display conectado');
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/controle/sw.js');
}

render();
