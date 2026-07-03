// "Palco" de reprodução reutilizável: aplica os mesmos comandos no Display e
// na pré-visualização do Controle, garantindo que mostrem exatamente a mesma
// coisa (wallpaper / imagem / vídeo + view + mudo + volume + play/seek).
//
// Uso: const stage = createStage({ wallpaper, img, video, forceMuted, onEnded, onTime, onBlocked });
// e depois stage.handle(cmd) para cada comando.
// Suporta blobs locais, arquivos do OPFS (opfsPath), itens de URL direta
// (blob=null, url=string) e itens youtube (kind='youtube').

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
    // Transições de entrada/saída (config vem do Controle via comando 'fade').
    let fadeIn = false;
    let fadeOut = false;
    let fadeTime = 1; // segundos
    let rampTimer = null;

    function setFade(cfg) {
      if (typeof cfg.fadeIn === 'boolean') fadeIn = cfg.fadeIn;
      if (typeof cfg.fadeOut === 'boolean') fadeOut = cfg.fadeOut;
      if (typeof cfg.time === 'number' && cfg.time > 0) fadeTime = cfg.time;
    }

    // Elemento de mídia atualmente visível (alvo do fade-out), ou null.
    function visibleEl() {
      if (!current || ended || view !== 'visual') return null;
      if (current.kind === 'image' && !img.hidden) return img;
      if ((current.kind === 'video' || current.kind === 'audio') && !video.hidden) return video;
      return null;
    }

    function clearFadeStyle(el) {
      el.style.transition = '';
      el.style.opacity = '';
    }

    // Rampa de volume (fade sonoro) para vídeo/áudio.
    function rampVolume(from, to, dur) {
      clearInterval(rampTimer);
      if (forceMuted) return;
      const steps = Math.max(2, Math.round(dur * 20));
      let i = 0;
      video.volume = Math.min(1, Math.max(0, from));
      rampTimer = setInterval(() => {
        i++;
        video.volume = Math.min(1, Math.max(0, from + (to - from) * (i / steps)));
        if (i >= steps) clearInterval(rampTimer);
      }, (dur * 1000) / steps);
    }

    // Esmaece a mídia visível até o wallpaper; resolve ao terminar
    // (imediatamente se fade-out desligado ou nada visível).
    function runFadeOut() {
      return new Promise((resolve) => {
        const el = fadeOut ? visibleEl() : null;
        if (!el) { resolve(); return; }
        wallpaper.style.display = 'flex'; // aparece por trás durante o fade
        el.style.transition = 'opacity ' + fadeTime + 's ease';
        el.style.opacity = '0';
        if (el === video && !video.muted) rampVolume(video.volume, 0, fadeTime);
        setTimeout(resolve, fadeTime * 1000);
      });
    }

    // Revela `el` com fade (deve ser chamado depois de applyView deixá-lo visível).
    function applyFadeIn(el) {
      if (!fadeIn) { clearFadeStyle(el); return; }
      el.style.transition = 'none';
      el.style.opacity = '0';
      void el.offsetWidth; // força reflow para a transição valer
      el.style.transition = 'opacity ' + fadeTime + 's ease';
      el.style.opacity = '1';
      setTimeout(() => clearFadeStyle(el), fadeTime * 1000 + 60);
    }

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
      clearInterval(rampTimer);
      if (!forceMuted) video.volume = volume; // restaura pós fade-out
      applyView();
      const p = video.play();
      // Usa `muted` (intenção interna) e não video.muted: o browser pode forçar
      // video.muted=true antes de rejeitar, ocultando o motivo real do bloqueio.
      if (p && p.catch) p.catch(() => { if (opts.onBlocked && !muted) opts.onBlocked(); });
    }
    function pause() { video.pause(); }
    function stop() { video.pause(); video.currentTime = 0; }
    // stop com fade-out; descartado se um load/clear mais novo chegar durante o fade.
    async function stopFaded() {
      const seq = ++loadSeq;
      await runFadeOut();
      if (seq !== loadSeq) return;
      stop();
      clearFadeStyle(video); clearFadeStyle(img);
      if (!forceMuted) video.volume = volume;
      applyView();
    }
    function seek(t) { if (isFinite(t)) video.currentTime = t; }
    function setView(v) { view = v; applyView(); }
    // Troca de view com transição: visual→wallpaper esmaece; wallpaper→visual revela.
    async function setViewFaded(v) {
      if (v === view) return;
      if (v === 'wallpaper') {
        const seq = ++loadSeq;
        await runFadeOut();
        if (seq !== loadSeq) return;
        view = v;
        clearFadeStyle(video); clearFadeStyle(img);
        if (!forceMuted) video.volume = volume;
        applyView();
      } else {
        view = v;
        applyView();
        const el = visibleEl();
        if (el) {
          applyFadeIn(el);
          if (el === video && !video.muted && isPlayingNow()) rampVolume(0, volume, fadeTime);
        }
      }
    }
    function isPlayingNow() {
      return !!current && (current.kind === 'video' || current.kind === 'audio') && !video.paused;
    }
    function setMute(m) { muted = m; video.muted = forceMuted ? true : muted; }
    function setVolume(vol) {
      volume = vol;
      clearInterval(rampTimer); // operador manda: cancela rampa de fade em curso
      if (!forceMuted) video.volume = vol;
    }

    function _revokeUrl() {
      if (url && isBlobUrl) { URL.revokeObjectURL(url); }
      url = null;
      isBlobUrl = false;
    }

    async function load(id, v, m, vol) {
      if (v !== undefined) view = v;
      if (m !== undefined) muted = m;
      if (typeof vol === 'number') volume = vol;

      // Guarda sequencial: se outra chamada load() começar antes desta terminar
      // o fade/getMedia(), descartamos esta para evitar race de URL/current.
      const seq = ++loadSeq;
      // Troca de mídia: esmaece a atual antes de carregar a próxima.
      await runFadeOut();
      if (seq !== loadSeq) return;
      ended = false;
      clearFadeStyle(video); clearFadeStyle(img);
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
      } else if (rec.opfsPath) {
        // Arquivo sincronizado no OPFS: resolve o File direto do origin,
        // sem permissão e sem cópia para o IDB.
        let file = null;
        try { file = await AVDB.opfsGetFile(rec.opfsPath); } catch (_) {}
        if (seq !== loadSeq) return;
        if (!file) { clear(); return; }
        url = URL.createObjectURL(file);
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
      // Fade de entrada da nova mídia (visual + volume quando aplicável).
      const shown = visibleEl();
      if (shown && fadeIn) {
        applyFadeIn(shown);
        if (shown === video && !video.muted) rampVolume(0, volume, fadeTime);
      }
    }

    function clear() {
      current = null;
      ended = false;
      clearInterval(rampTimer);
      img.hidden = true; img.removeAttribute('src');
      clearFadeStyle(video); clearFadeStyle(img);
      video.pause(); video.removeAttribute('src'); video.load();
      _revokeUrl();
      applyView();
    }

    // clear com fade-out; descartado se um load mais novo chegar durante o fade.
    async function clearFaded() {
      const seq = ++loadSeq;
      await runFadeOut();
      if (seq !== loadSeq) return;
      clear();
    }

    function handle(cmd) {
      switch (cmd.type) {
        case 'load': load(cmd.mediaId, cmd.view, cmd.muted, cmd.volume); break;
        case 'view': setViewFaded(cmd.view); break;
        case 'mute': setMute(cmd.muted); break;
        case 'volume': if (typeof cmd.volume === 'number') setVolume(cmd.volume); break;
        case 'play': play(); break;
        case 'pause': pause(); break;
        case 'stop': stopFaded(); break;
        case 'seek': seek(cmd.time); break;
        case 'clear': clearFaded(); break;
        case 'fade': setFade(cmd); break;
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
    if (opts.onError) video.addEventListener('error', opts.onError);

    return {
      handle, load, clear, play, pause, stop, seek, setView, setMute, setVolume, setFade,
      getCurrent: () => current,
      getView: () => view,
      isPlaying: isPlayingNow,
      isTimed: () => !!current && (current.kind === 'video' || current.kind === 'audio'),
      getTime: () => video.currentTime,
      getDuration: () => video.duration,
      getMuted: () => (forceMuted ? muted : video.muted),
      getVolume: () => volume,
    };
  }

  global.createStage = createStage;
})(this);
