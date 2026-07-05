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
    let fadeCleanupTimer = null; // limpeza pós fade-in (cancelável por um fade-out)

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

    // Esmaece a mídia visível; resolve ao terminar (imediatamente se fade-out
    // desligado ou nada visível). toWallpaper=true revela o wallpaper por trás
    // (saída: stop/clear/view/ended); false esmaece até o preto (troca de mídia).
    // rampAudio=false mantém o áudio intocado (view→wallpaper: só o visual sai).
    function runFadeOut(toWallpaper, rampAudio) {
      return new Promise((resolve) => {
        const el = fadeOut ? visibleEl() : null;
        if (!el) { resolve(); return; }
        // um fade-in recém-terminado não pode limpar os estilos no meio deste fade-out
        clearTimeout(fadeCleanupTimer);
        // Fixa o fundo correto atrás da mídia que esmaece — inclusive se um
        // crossfade de entrada interrompido deixou o wallpaper à mostra, a
        // troca de mídia esmaece até o preto, nunca até o wallpaper.
        wallpaper.style.display = toWallpaper ? 'flex' : 'none';
        el.style.transition = 'opacity ' + fadeTime + 's ease';
        el.style.opacity = '0';
        if (rampAudio !== false && el === video && !video.muted) rampVolume(video.volume, 0, fadeTime);
        setTimeout(resolve, fadeTime * 1000);
      });
    }

    // Fade-in em duas fases: prepFadeIn fixa a mídia invisível (antes de
    // esperar decode/primeiro frame); startFadeIn dispara a transição.
    function prepFadeIn(el) {
      clearTimeout(fadeCleanupTimer);
      el.style.transition = 'none';
      el.style.opacity = '0';
      void el.offsetWidth; // força reflow para a transição valer
    }
    function startFadeIn(el) {
      el.style.transition = 'opacity ' + fadeTime + 's ease';
      el.style.opacity = '1';
      // pós-fade: limpa estilos e re-esconde o wallpaper (fim do crossfade)
      fadeCleanupTimer = setTimeout(() => { clearFadeStyle(el); applyView(); }, fadeTime * 1000 + 60);
    }

    // Resolve quando o elemento tem conteúdo pronto para pintar (imagem
    // decodificada / primeiro frame do vídeo). Sem isso o fade-in corre sobre
    // a camada preta e o conteúdo "pipoca" no meio da transição. Timeout de
    // segurança para mídia que demora/falha em carregar.
    function mediaReady(el) {
      return new Promise((resolve) => {
        let done = false;
        let t = null;
        const finish = () => { if (!done) { done = true; clearTimeout(t); resolve(); } };
        t = setTimeout(finish, 2500);
        if (el === img) {
          if (img.complete && img.naturalWidth) finish();
          else if (img.decode) img.decode().then(finish, finish);
          else img.addEventListener('load', finish, { once: true });
        } else if (video.readyState >= 2) {
          finish();
        } else {
          video.addEventListener('loadeddata', finish, { once: true });
        }
      });
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
      // Só é bloqueio de autoplay de fato quando o erro é NotAllowedError — um
      // play() interrompido por um pause()/load() seguinte (AbortError, comum
      // em toda troca normal de mídia) não é bloqueio e não deve disparar a
      // recuperação de áudio (isso travava a fluidez, mutando/tentando religar
      // o som a cada troca de mídia sem motivo real).
      if (p && p.catch) p.catch((err) => {
        if (opts.onBlocked && !muted && err && err.name === 'NotAllowedError') opts.onBlocked();
      });
    }
    function pause() { video.pause(); }
    function stop() { video.pause(); video.currentTime = 0; }
    // stop com fade-out; descartado se um load/clear mais novo chegar durante o fade.
    async function stopFaded() {
      const seq = ++loadSeq;
      await runFadeOut(true);
      if (seq !== loadSeq) return;
      stop();
      // 'stop' volta ao wallpaper (protocolo): ended tira a mídia de cena
      // mantendo current — play() recarrega a visão e reproduz do início.
      ended = true;
      clearFadeStyle(video); clearFadeStyle(img);
      if (!forceMuted) video.volume = volume;
      applyView();
    }
    function seek(t) { if (isFinite(t)) video.currentTime = t; }
    function setView(v) { view = v; applyView(); }
    // Troca de view com transição: visual→wallpaper esmaece; wallpaper→visual revela.
    // Só o VISUAL transiciona — o áudio (que continua tocando com o visual
    // desligado) fica intocado, sem rampa que terminaria num salto de volume.
    async function setViewFaded(v) {
      if (v === view) return;
      if (v === 'wallpaper') {
        const seq = ++loadSeq;
        await runFadeOut(true, false);
        if (seq !== loadSeq) return;
        view = v;
        clearFadeStyle(video); clearFadeStyle(img);
        applyView();
      } else {
        view = v;
        applyView();
        const el = visibleEl();
        if (el && fadeIn) {
          // Crossfade: o wallpaper permanece por baixo enquanto a mídia entra;
          // o cleanup pós fade-in o esconde (applyView).
          prepFadeIn(el);
          wallpaper.style.display = 'flex';
          startFadeIn(el);
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
      // Troca de mídia: esmaece a atual até o PRETO (wallpaper continua oculto);
      // a próxima entra em seguida com fade-in a partir do preto.
      const willFade = fadeOut && !!visibleEl();
      // Entrada a partir do wallpaper (nada em cena): o fade-in vira um
      // crossfade — o wallpaper fica por baixo até a mídia cobrir a tela.
      const fromWallpaper = wallpaper.style.display !== 'none' && !willFade;
      await runFadeOut(false);
      if (seq !== loadSeq) return;
      ended = false;
      if (willFade) {
        // Esconde as camadas ainda esmaecidas ANTES de restaurar a opacidade
        // (evita a mídia antiga reaparecer durante o getMedia); o wallpaper
        // permanece oculto, então o intervalo até a nova mídia fica preto.
        img.hidden = true; img.removeAttribute('src');
        video.pause(); video.removeAttribute('src'); video.load();
        clearFadeStyle(video); clearFadeStyle(img);
      }
      const rec = await AVDB.getMedia(id);
      if (seq !== loadSeq) return;
      if (!rec) { clear(); return; }
      current = rec;

      _revokeUrl();

      img.hidden = true; img.removeAttribute('src');
      video.pause(); video.removeAttribute('src'); video.load();
      // Nenhum estilo de fade anterior pode sobrar na mídia que vai entrar
      // (ex: opacity 0 de um fade-in descartado com a config já alterada).
      clearFadeStyle(video); clearFadeStyle(img);

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
        prepFadeIn(shown);
        // Saída do wallpaper com fade: ele permanece visível por baixo durante
        // o crossfade; o cleanup pós fade-in o esconde (applyView).
        if (fromWallpaper) wallpaper.style.display = 'flex';
        // Só inicia a transição com a mídia pronta para pintar.
        await mediaReady(shown);
        if (seq !== loadSeq) return;
        startFadeIn(shown);
        if (shown === video && !video.muted) rampVolume(0, volume, fadeTime);
      }
    }

    function clear() {
      current = null;
      ended = false;
      clearInterval(rampTimer);
      clearTimeout(fadeCleanupTimer);
      img.hidden = true; img.removeAttribute('src');
      clearFadeStyle(video); clearFadeStyle(img);
      video.pause(); video.removeAttribute('src'); video.load();
      _revokeUrl();
      applyView();
    }

    // clear com fade-out (até o wallpaper); descartado se um load mais novo
    // chegar durante o fade.
    async function clearFaded() {
      const seq = ++loadSeq;
      await runFadeOut(true);
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

    // Fim natural → wallpaper. Com fade-out ativo, esmaece até o wallpaper;
    // o 'load' do avanço automático da playlist (disparado por onEnded, logo
    // abaixo) interrompe o fade via loadSeq e assume a transição — assim o
    // wallpaper NÃO pisca entre os itens da playlist.
    video.addEventListener('ended', async () => {
      if (fadeOut && visibleEl() === video) {
        const seq = ++loadSeq;
        await runFadeOut(true, false);
        if (seq !== loadSeq) return;
        ended = true;
        video.currentTime = 0;
        clearFadeStyle(video);
        applyView();
      } else {
        ended = true;
        video.currentTime = 0;
        applyView();
      }
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
