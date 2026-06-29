// "Palco" de reprodução reutilizável: aplica os mesmos comandos no Display e
// na pré-visualização do Controle, garantindo que mostrem exatamente a mesma
// coisa (wallpaper / imagem / vídeo + view + mudo + volume + play/seek).
//
// Uso: const stage = createStage({ wallpaper, img, video, forceMuted, onEnded, onTime, onBlocked });
// e depois stage.handle(cmd) para cada comando.
// Suporta itens de URL direta (blob=null, url=string) e itens youtube (kind='youtube').

(function (global) {
  'use strict';

  function createStage(opts) {
    const wallpaper = opts.wallpaper;
    const img = opts.img;
    const video = opts.video;
    const forceMuted = !!opts.forceMuted;

    let current = null;
    let view = 'visual';
    let muted = false;
    let volume = 1;
    let url = null;
    let isBlobUrl = false;
    let ended = false;
    let loadSeq = 0;

    function applyView() {
      const kind = current ? current.kind : null;
      // youtube kind is handled externally (display.js); stage only manages image/video/audio
      const visible = !!current && !ended && view === 'visual' && (kind === 'image' || kind === 'video' || kind === 'audio');
      img.hidden = !(visible && kind === 'image');
      video.hidden = !(visible && (kind === 'video' || kind === 'audio'));
      wallpaper.style.display = visible ? 'none' : 'flex';
      video.muted = forceMuted ? true : muted;
      if (!forceMuted) video.volume = volume;
    }

    function play() {
      if (!current || (current.kind !== 'video' && current.kind !== 'audio')) return;
      ended = false;
      applyView();
      const p = video.play();
      // Usa `muted` (intenção interna) e não video.muted: o browser pode forçar
      // video.muted=true antes de rejeitar, ocultando o motivo real do bloqueio.
      if (p && p.catch) p.catch(() => { if (opts.onBlocked && !muted) opts.onBlocked(); });
    }
    function pause() { video.pause(); }
    function stop() { video.pause(); video.currentTime = 0; }
    function seek(t) { if (isFinite(t)) video.currentTime = t; }
    function setView(v) { view = v; applyView(); }
    function setMute(m) { muted = m; video.muted = forceMuted ? true : muted; }
    function setVolume(vol) { volume = vol; if (!forceMuted) video.volume = vol; }

    function _revokeUrl() {
      if (url && isBlobUrl) { URL.revokeObjectURL(url); }
      url = null;
      isBlobUrl = false;
    }

    async function load(id, v, m, vol) {
      if (v !== undefined) view = v;
      if (m !== undefined) muted = m;
      if (typeof vol === 'number') volume = vol;
      ended = false;

      // Guarda sequencial: se outra chamada load() começar antes desta terminar
      // o getMedia(), descartamos esta para evitar race de URL/current.
      const seq = ++loadSeq;
      const rec = await AVDB.getMedia(id);
      if (seq !== loadSeq) return;
      if (!rec) { clear(); return; }
      current = rec;

      _revokeUrl();

      img.hidden = true; img.removeAttribute('src');
      video.pause(); video.removeAttribute('src'); video.load();

      if (rec.kind === 'youtube') {
        // YouTube is handled externally; stage shows thumbnail in img if available
        if (rec.thumb) {
          img.src = rec.thumb;
          img.hidden = false;
        }
        wallpaper.style.display = rec.thumb ? 'none' : 'flex';
        return;
      }

      if (rec.blob) {
        url = URL.createObjectURL(rec.blob);
        isBlobUrl = true;
      } else if (rec.url) {
        url = rec.url;
        isBlobUrl = false;
      } else {
        clear(); return;
      }

      if (rec.kind === 'image') {
        img.src = url;
      } else {
        video.src = url;
        video.muted = forceMuted ? true : muted;
        if (!forceMuted) video.volume = volume;
        play();
      }
      applyView();
    }

    function clear() {
      current = null;
      ended = false;
      img.hidden = true; img.removeAttribute('src');
      video.pause(); video.removeAttribute('src'); video.load();
      _revokeUrl();
      applyView();
    }

    function handle(cmd) {
      switch (cmd.type) {
        case 'load': load(cmd.mediaId, cmd.view, cmd.muted, cmd.volume); break;
        case 'view': setView(cmd.view); break;
        case 'mute': setMute(cmd.muted); break;
        case 'volume': if (typeof cmd.volume === 'number') setVolume(cmd.volume); break;
        case 'play': play(); break;
        case 'pause': pause(); break;
        case 'stop': stop(); break;
        case 'seek': seek(cmd.time); break;
        case 'clear': clear(); break;
      }
    }

    // Reset to wallpaper on end; opts.onEnded fires after so it can decide what to play next.
    video.addEventListener('ended', () => {
      ended = true;
      video.currentTime = 0;
      applyView();
    });

    if (opts.onEnded) video.addEventListener('ended', opts.onEnded);
    if (opts.onTime) {
      ['timeupdate', 'loadedmetadata', 'play', 'pause', 'ended', 'volumechange'].forEach((ev) =>
        video.addEventListener(ev, opts.onTime));
    }

    return {
      handle, load, clear, play, pause, stop, seek, setView, setMute, setVolume,
      getCurrent: () => current,
      getView: () => view,
      isPlaying: () => !!current && (current.kind === 'video' || current.kind === 'audio') && !video.paused,
      isTimed: () => !!current && (current.kind === 'video' || current.kind === 'audio'),
      getTime: () => video.currentTime,
      getDuration: () => video.duration,
      getMuted: () => (forceMuted ? muted : video.muted),
      getVolume: () => volume,
    };
  }

  global.createStage = createStage;
})(this);
