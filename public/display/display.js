const imageEl = document.getElementById('image');
const placeholderEl = document.getElementById('placeholder');

let currentUrl = null;

async function show(id) {
  const record = await AVDB.getMedia(id);
  if (!record) {
    clear();
    return;
  }
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = URL.createObjectURL(record.blob);
  imageEl.src = currentUrl;
  imageEl.hidden = false;
  placeholderEl.hidden = true;
}

function clear() {
  imageEl.hidden = true;
  imageEl.removeAttribute('src');
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
  placeholderEl.hidden = false;
}

AVDB.onCommand((cmd) => {
  if (!cmd) return;
  if (cmd.type === 'show') show(cmd.mediaId);
  else if (cmd.type === 'clear') clear();
});

// Ao abrir, restaura o último estado definido pelo controle
// (assim o display "reconecta" mostrando o que estava no ar).
async function restore() {
  const state = await AVDB.getState('current');
  if (state && state.mediaId) show(state.mediaId);
  else clear();
  AVDB.sendCommand({ type: 'display-ready' });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/display/sw.js');
}

restore();
