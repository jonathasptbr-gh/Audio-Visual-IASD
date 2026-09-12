// "Palco" de reprodução reutilizável: aplica os mesmos comandos no Display e na
// preview do Controle, garantindo que mostrem a mesma coisa (wallpaper / imagem
// / vídeo + view + mudo + volume + play/seek).
//
// Uso: const stage = createStage({ wallpaper, img, video, camadaImg, forceMuted, onEnded, onTime, onBlocked });
// e depois stage.handle(cmd) para cada comando.
// Suporta blobs locais, OPFS (opfsPath), URL direta (blob=null, url=string) e
// itens youtube (kind='youtube').
//
// MODELO DE CAMADAS: o wallpaper é uma cortina POR CIMA de toda mídia (z-index)
// — img/video tocam e trocam de conteúdo livremente por baixo, sem saber se
// estão visíveis; o wallpaper só liga/desliga a cortina, com fade quando
// configurado. Isso evita a classe de bug em que uma mídia carregada com o
// wallpaper ligado nunca aprendia a se revelar depois: revelar é sempre
// "esconder a cortina", nunca depende do estado em que a mídia foi carregada.

(function (global) {
  'use strict';

  // Rampa curta ao mutar/desmutar (evita corte abrupto de áudio). INTERNA: as
  // duas outras rampas (`ytRampVolume` no Display, `ytPreviewRampVolume` no
  // Controle) saíram na v5.212 com o embed, e hoje há um `<video>` só.
  const MUTE_RAMP_TIME = 0.25;
  // Transições são INERENTES ao sistema: sempre ligadas, duração fixa, sem UI
  // nem state. Fonte ÚNICA (via createStage.FADE) — antes o mesmo objeto estava
  // escrito à mão nos dois apps e podia divergir sem ninguém notar.
  const FADE = { in: true, out: true, time: 0.6 };

  // O PÔSTER VAZIO — 1×1 transparente, e é ele que mata o "retângulo cinza com
  // um play preto gigante".
  //
  // Contrato do WebView (`WebChromeClient.getDefaultVideoPoster`): sem o
  // atributo `poster`, um pôster PADRÃO é usado — o retângulo com o play, que o
  // app não estiliza, só deixa de pedir.
  //
  // O `stage` esconde o `<video>` sem `src` (ver `load()`), e o pôster cobre a
  // outra metade: a janela entre a fonte atribuída e o primeiro quadro.
  //
  // Transparente e não preto: as camadas já pintam `--stage-bg` por baixo, então
  // aparece o preto do palco — sem uma segunda definição de "qual preto".
  const POSTER_VAZIO = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  // Duração dos fades de CAMADA (letra, texto, YouTube): entrar/sair de uma
  // camada paralela, em ms. Também compartilhada pelos dois apps.
  const LAYER_FADE_MS = 320;

  // ---- fades de camada paralela (letra/texto) ----
  // Estas três são idênticas nos dois apps (o Display as usa em #lyrics/#text,
  // o Controle em #pvLyrics/#pvText) e não têm nenhuma calibração própria —
  // por isso vivem aqui, e não duplicadas. As camadas COM calibração própria
  // (tamanhos em cq*) continuam separadas, no CSS de cada app.

  // Fade curto de conteúdo dentro de uma camada já visível (troca de texto).
  function fadeContentIn(el) {
    if (!el || !el.animate || !FADE.in) return;
    try { el.getAnimations().forEach((a) => a.cancel()); } catch (_) {}
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease' });
  }

  // Revela a camada inteira.
  function fadeLayerIn(el) {
    if (!el) return;
    const wasHidden = el.hidden;
    el.hidden = false;
    el.style.opacity = '';
    if (!el.animate) return;
    // Cancela SEMPRE, mesmo que a camada já estivesse visível: pode haver um
    // fadeLayerOut em curso (ela estava saindo e voltou), e deixá-lo correr
    // esconderia no `onfinish` justamente o que acabou de entrar.
    let hadAnim = false;
    try { el.getAnimations().forEach((a) => { hadAnim = true; a.cancel(); }); } catch (_) {}
    if (!FADE.in) return;
    if (!wasHidden && !hadAnim) return; // já em cena e estável: não repete o fade
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: LAYER_FADE_MS, easing: 'ease' });
  }

  // Esconde a camada inteira.
  function fadeLayerOut(el) {
    if (!el || el.hidden) return;
    if (!el.animate || !FADE.out) { el.hidden = true; return; }
    try { el.getAnimations().forEach((a) => a.cancel()); } catch (_) {}
    const anim = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: LAYER_FADE_MS, easing: 'ease' });
    // Só o término natural esconde: se um fadeLayerIn cancelar esta animação no
    // meio (a camada voltou), esconder aqui apagaria o que acabou de entrar.
    anim.onfinish = () => { el.hidden = true; el.style.opacity = ''; };
  }

  // Índice do slide de letra vigente num instante (último com time <= t).
  function findSlideIndex(lyrics, time) {
    let idx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time <= time) idx = i; else break;
    }
    return idx < 0 ? 0 : idx;
  }
  // Passo-a-passo genérico de volume: from→to (0..1) ao longo de `dur` s,
  // chamando apply(v) a cada passo (v já clampado em 0..1). Retorna o id do
  // interval — o chamador guarda para poder cancelar. Compartilhado pelos três
  // "sinks" de áudio do sistema: o <video> do stage, o player do YouTube no
  // Display e o da preview no Controle (todos com a mesma curva/duração).
  function rampSteps(from, to, dur, apply) {
    const steps = Math.max(2, Math.round(dur * 20));
    let i = 0, id;
    id = setInterval(() => {
      i++;
      apply(Math.min(1, Math.max(0, from + (to - from) * (i / steps))));
      if (i >= steps) clearInterval(id);
    }, (dur * 1000) / steps);
    return id;
  }

  function createStage(opts) {
    const wallpaper = opts.wallpaper;
    const img = opts.img;
    const video = opts.video;
    // ===== A MÍDIA TEM DOIS ELEMENTOS, E O ENQUADRAMENTO VALE PARA OS DOIS =====
    //
    // A MESMA foto e a MESMA página de apresentação chegam ao telão por dois
    // caminhos: como CENA (o `img` acima) e como CAMADA por cima de um louvor
    // de fundo (v5.312 para a imagem, v1.4.28 para a apresentação) — e a camada
    // é desenhada pelo DONO do palco, num `<img>` dele (`#textImg` no telão,
    // `#pvTextImg` na preview).
    //
    // MEDIDO na v1.4.41, com o operador tendo escolhido "Preencher" e 90°: o
    // `img` respondia aos dois e a camada ficava presa no `contain` do CSS, sem
    // giro nenhum. É o pior formato de defeito que este painel pode ter — o
    // mesmo controle, o mesmo conteúdo, e funciona ou não conforme haja uma
    // música tocando por baixo, que é a última coisa que alguém relacionaria
    // com o preenchimento.
    //
    // Ele entra AQUI, e não no dono do palco, porque "como a mídia ocupa o
    // telão" é uma decisão só: dois lugares aplicando a mesma regra divergem no
    // primeiro ajuste, e este arquivo já é o dono dela.
    //
    // FICA DE FORA o fundo da estrofe (`#lyricsImg`): ele não é a mídia, é o
    // FUNDO atrás da letra — `cover` sempre, porque uma letra sobre barras
    // pretas não é uma escolha de enquadramento, é um defeito. E fica de fora
    // o wallpaper, pela mesma razão.
    const camadaImg = opts.camadaImg || null;
    // Não é const, e os DOIS papéis que o alternam em tempo real são: o
    // Controle, quando não há tela nenhuma conectada e a preview passa a tocar
    // o som do próprio aparelho (`acertarSaidaDeAudio`), e a tela da rede, que
    // nasce muda e solta o som no gesto do visitante (`__telaSom`). Ver
    // setForceMuted().
    let forceMuted = !!opts.forceMuted;

    let current = null;
    let view = 'visual';
    // A CAMADA POR CIMA DO PALCO, e o stage precisava saber dela.
    //
    // null | 'visual' | 'wallpaper'. Quem a escreve é o Display (`showText` /
    // `hideText` / o ramo de `view` com texto em cena): o cartão de texto vive
    // ACIMA da mídia e ABAIXO do wallpaper, então enquanto ele está no ar quem
    // decide a cortina é ELE.
    //
    // Sem isto o stage reavaliava a cortina em três pontos que não sabiam do
    // cartão — o fim natural da mídia, o `play()` e o fim do `loadInner` — e o
    // wallpaper ENGOLIA o versículo (ou o cronômetro) sem nada mudar do lado do
    // Controle: `textActive` seguia true, o `display-status` seguia dizendo
    // `view: 'visual'`, e a lista seguia desenhando "● No ar". O remendo que
    // existia era pontual (um `instantCover(false)` depois do `view`).
    let overlay = null;
    let muted = false;
    let volume = 1;
    let fit = 'contain'; // object-fit: 'contain' (ajustar) | 'cover' (preencher) | 'fill' (esticar)
    let url = null;
    let isBlobUrl = false;
    let deckIdx = 0;      // página em cena da apresentação (kind 'deck')
    let ended = false;
    let loadSeq = 0;
    // Quantos load() estão EM VOO agora. Existe para o handler de `ended`: o
    // fim natural do vídeo não é uma ação do operador e não pode cancelar um
    // load que ele pediu (ver o comentário do próprio handler, lá embaixo).
    // Contador, e não booleano, porque um load pode começar enquanto outro
    // ainda espera o fade/getMedia — o segundo bump do loadSeq descarta o
    // primeiro, mas a promise dele só se resolve depois.
    let loadsEmVoo = 0;
    let viewSeq = 0; // troca de view (cortina) — independente do loadSeq
    // Transições de entrada/saída (config vem do Controle via comando 'fade').
    let fadeIn = false;
    let fadeOut = false;
    let fadeTime = 1; // segundos
    let rampTimer = null;
    let muteApplyTimer = null;

    // Cortina do wallpaper: única fonte de verdade sobre se ela está cobrindo
    // a mídia agora. Começa cobrindo (nada carregado ainda).
    let coveredNow = true;
    let coverSeq = 0; // descarta fades de cortina obsoletos (interrompidos por outro)


    function setFade(cfg) {
      if (typeof cfg.fadeIn === 'boolean') fadeIn = cfg.fadeIn;
      if (typeof cfg.fadeOut === 'boolean') fadeOut = cfg.fadeOut;
      if (typeof cfg.time === 'number' && cfg.time > 0) fadeTime = cfg.time;
    }

    // Cortina (wallpaper) — instantânea ou com fade. Não mexe em current/
    // ended/view: quem decide QUANDO cobrir/revelar é o chamador (stage ou,
    // no Display, o código do YouTube, que só reaproveita esta cortina
    // compartilhada). rampAudio de coverIn() só se aplica ao <video> do
    // próprio stage — o YouTube nunca deve passar rampAudio=true aqui (sua
    // própria rampa de áudio é feita externamente, no player do YouTube).
    function instantCover(show) {
      coverSeq++;
      coveredNow = show;
      wallpaper.style.transition = '';
      wallpaper.style.opacity = '';
      wallpaper.style.display = show ? 'flex' : 'none';
    }

    // A RAMPA DE SAÍDA DO SOM, num lugar só. Ela vivia DENTRO da animação da
    // cortina, e por isso não acontecia justamente onde ela é a única coisa que
    // o operador percebe: no ÁUDIO SEM LETRA a cortina já está fechada durante
    // toda a reprodução (`semVisual`), então `coverIn` devolvia na hora e o
    // `clear()` cortava o som no talo. Ver `clearFaded`.
    function rampAudioParaZero() {
      if (forceMuted || !current || video.muted) return;
      if (current.kind !== 'video' && current.kind !== 'audio') return;
      rampVolume(video.volume, 0, fadeTime);
    }

    function coverIn(rampAudio) {
      if (coveredNow) return Promise.resolve();
      const seq = ++coverSeq;
      return new Promise((resolve) => {
        if (!fadeOut) { instantCover(true); resolve(); return; }
        wallpaper.style.transition = 'none';
        wallpaper.style.display = 'flex';
        wallpaper.style.opacity = '0';
        void wallpaper.offsetWidth; // força reflow para a transição valer
        wallpaper.style.transition = 'opacity ' + fadeTime + 's ease';
        wallpaper.style.opacity = '1';
        if (rampAudio) rampAudioParaZero();
        setTimeout(() => {
          if (seq !== coverSeq) { resolve(); return; }
          coveredNow = true;
          wallpaper.style.transition = '';
          wallpaper.style.opacity = '';
          resolve();
        }, fadeTime * 1000);
      });
    }

    function coverOut() {
      if (!coveredNow) return Promise.resolve();
      const seq = ++coverSeq;
      return new Promise((resolve) => {
        if (!fadeIn) { instantCover(false); resolve(); return; }
        wallpaper.style.transition = 'opacity ' + fadeTime + 's ease';
        wallpaper.style.opacity = '0';
        setTimeout(() => {
          if (seq !== coverSeq) { resolve(); return; }
          coveredNow = false;
          wallpaper.style.transition = '';
          wallpaper.style.opacity = '';
          wallpaper.style.display = 'none';
          resolve();
        }, fadeTime * 1000);
      });
    }

    /**
     * ÁUDIO PURO NÃO TEM O QUE MOSTRAR (v5.112).
     *
     * Um áudio sem letra sincronizada não põe nada no `<img>` nem no `<video>`
     * (ver `applyMedia`). Sem esta pergunta a cortina ABRIA para ele: o telão
     * saía do wallpaper e ficava no PRETO do palco com o louvor tocando por trás
     * de um retângulo vazio — no meio de um culto isso se lê como projetor
     * apagado.
     *
     * A letra é a exceção que confirma: com letra, a cortina precisa sair da
     * frente, porque a `.lyrics-layer` fica por baixo dela (o wallpaper tem
     * z-index maior — ver display/index.html). Por isso a pergunta é feita ao
     * REGISTRO, que carrega a letra, e não à camada, que o stage não conhece.
     *
     * A Camada de Texto (mensagem/versículo sobre áudio de fundo) não passa por
     * aqui: quem abre a cortina para ela é o `showText` do Display.
     */
    function semVisual() {
      return !!current && current.kind === 'audio'
        && !(Array.isArray(current.lyrics) && current.lyrics.length);
    }

    // A cortina deve cobrir sempre que não há mídia, ela "terminou" (ended:
    // aguardando replay), o operador pediu view='wallpaper' — ou o que entrou
    // não tem imagem nenhuma para mostrar.
    function computeCover() {
      // O OVERLAY TEM PRECEDÊNCIA: com um cartão de texto em cena, a cortina
      // responde à view DELE — nada do que a mídia faça por baixo pode
      // descobrir ou cobrir o palco por conta própria.
      if (overlay) return overlay === 'wallpaper';
      return !current || ended || view === 'wallpaper' || semVisual();
    }

    // Declarado pelo Display quando o cartão de texto entra e sai de cena.
    function setOverlay(v) { overlay = (v === 'visual' || v === 'wallpaper') ? v : null; }

    // A VIEW DO CARTÃO É A VIEW DO STAGE — declarada, não deduzida (v1.8.83).
    //
    // O `showText` do Display move a cortina por conta própria (o fade de
    // entrada do cartão é dele, e o `overlay` acima já lhe dá a precedência em
    // `computeCover`), mas a VIEW continua sendo estado DAQUI. Deixá-la
    // congelada fazia o `view` SEGUINTE cair no `v === view` do `setViewFaded`
    // e voltar mudo: com o telão coberto ANTES do versículo, "cobrir" não
    // cobria mais nada — o cartão ficava preso na frente da congregação (e a
    // PREVIEW obedecia, porque ela move a cortina por fora, então as duas
    // metades discordavam). MEDIDO: a cortina em `display: none` depois do
    // segundo `view: 'wallpaper'`. É o mesmo defeito que o ramo de `view` do
    // `onCommand` já corrigia por delegação, uma porta ao lado.
    //
    // Ela NÃO toca na cortina de propósito: quem chama acabou de decidi-la, e
    // um `instantCover` aqui cortaria o fade dela pela metade.
    function declararView(v) { if (v === 'visual' || v === 'wallpaper') view = v; }

    // Elemento de mídia atualmente visível (alvo do fade de CONTEÚDO, ao
    // trocar de item) — só existe quando a cortina não está cobrindo; se
    // estiver cobrindo, ninguém vê nada, então não há o que esmaecer.
    // O mapeamento kind→elemento é o de `elDe` (fonte única, mais abaixo):
    // duplicá-lo aqui, como era, divergiria no primeiro kind novo.
    function visibleEl() {
      return coveredNow ? null : elDe(current);
    }

    function clearFadeStyle(el) {
      el.style.transition = '';
      el.style.opacity = '';
    }

    // Rampa de volume (fade sonoro) do <video> do próprio stage — usada tanto
    // no fade de CONTEÚDO (troca de item) quanto por coverIn() (parar/limpar).
    function rampVolume(from, to, dur) {
      clearInterval(rampTimer);
      if (forceMuted) return;
      video.volume = Math.min(1, Math.max(0, from));
      rampTimer = rampSteps(from, to, dur, (v) => { video.volume = v; });
    }

    // Esmaece a mídia de CONTEÚDO visível até o preto (troca de item, nada a
    // ver com a cortina do wallpaper); resolve imediatamente se fade-out
    // desligado ou nada visível agora.
    function runFadeOut(rampAudio) {
      return new Promise((resolve) => {
        const el = fadeOut ? visibleEl() : null;
        if (!el) { resolve(); return; }
        el.style.transition = 'opacity ' + fadeTime + 's ease';
        el.style.opacity = '0';
        if (rampAudio !== false && el === video && !video.muted) rampVolume(video.volume, 0, fadeTime);
        setTimeout(resolve, fadeTime * 1000);
      });
    }

    // A ENTRADA do conteúdo, espelhando [runFadeOut] — e ela não existia.
    //
    // A troca de item tinha metade da transição: a mídia velha esmaecia até o
    // preto e a nova ENTRAVA NO TALO, em opacidade cheia.
    //
    // Quem chama espera o [mediaReady] ANTES: sem isso o fade correria sobre a
    // camada ainda vazia e o conteúdo pipocaria no meio dela — o mesmo motivo
    // pelo qual a cortina já esperava.
    function runFadeIn(el) {
      return new Promise((resolve) => {
        if (!fadeIn || !el) { resolve(); return; }
        // O 0 já está escrito desde antes de o elemento ser revelado (ver o
        // `applyMedia` lá embaixo): escrevê-lo só agora daria um quadro em
        // opacidade cheia antes da transição começar, que é exatamente o
        // estouro que se quer evitar.
        el.style.transition = 'opacity ' + fadeTime + 's ease';
        el.style.opacity = '1';
        setTimeout(() => { clearFadeStyle(el); resolve(); }, fadeTime * 1000);
      });
    }

    // O elemento que ESTE registro ocupa em cena. Um só lugar decidindo isso:
    // `visibleEl`, o caminho da cortina e a entrada do conteúdo perguntam
    // todos aqui (a cópia à mão que `visibleEl` carregava já foi absorvida).
    function elDe(rec) {
      if (!rec) return null;
      if (rec.kind === 'image' || rec.kind === 'deck') return img;
      if (rec.kind === 'video' || rec.kind === 'audio') return video;
      return null;
    }

    // Resolve quando o elemento tem conteúdo pronto para pintar (imagem
    // decodificada / primeiro frame do vídeo). Sem isso o fade-in corre sobre
    // a camada preta e o conteúdo "pipoca" no meio da transição. Timeout de
    // segurança para mídia que demora/falha em carregar.
    //
    // Resolve SEM valor: quem chama espera pela janela, não por um veredito —
    // uma imagem quebrada tem de destravar a transição, não contá-la.
    function mediaReady(el) {
      return new Promise((resolve) => {
        let done = false;
        let t = null;
        const finish = () => { if (!done) { done = true; clearTimeout(t); resolve(); } };
        // Um arquivo local vira quadro em milissegundos: o prazo é um socorro
        // para a transição não pendurar, não o tempo esperado.
        t = setTimeout(finish, 2500);
        if (el === img) {
          if (img.complete && img.naturalWidth) finish();
          // `img.decode()` REJEITA numa imagem quebrada, e as DUAS pontas
          // destravam: sem a de erro, a transição esperaria o prazo inteiro por
          // uma imagem que não existe.
          else if (img.decode) img.decode().then(finish, finish);
          else img.addEventListener('load', finish, { once: true });
        } else if (video.readyState >= 2) {
          finish();
        } else {
          video.addEventListener('loadeddata', finish, { once: true });
        }
      });
    }

    // Qual elemento de mídia está ativo (independe da cortina — a mídia toca
    // por baixo normalmente; quem esconde é só o wallpaper por cima). Vídeo
    // também fica oculto quando `ended`: sem isso, o `currentTime=0` do fim
    // natural (preparando o replay) mostraria um salto pro primeiro frame
    // antes da cortina (se for o caso) cobrir — preto é sempre mais correto
    // que esse salto.
    //
    // ÁUDIO NÃO MOSTRA O <video>: ele é só o "sink" de som, não há um único
    // pixel a exibir. Mantê-lo visível fazia o navegador desenhar o
    // placeholder de mídia (retângulo claro com botão de play) por cima do
    // preto — invisível durante o hino, porque a camada de letra o cobria, e
    // aparecendo justamente no FIM, quando a letra esmaece e o descobre. É o
    // mesmo placeholder que já perseguimos na troca de mídia; aqui a fonte era
    // o próprio elemento estar em cena sem nada para mostrar.
    function applyMedia() {
      const kind = current ? current.kind : null;
      // A APRESENTAÇÃO usa o mesmo `<img>`: cada página é uma imagem, e tudo o
      // que vale para imagem (fade, cortina, `object-fit`) vale para ela.
      img.hidden = !(kind === 'image' || kind === 'deck');
      video.hidden = kind !== 'video' || ended;
      video.muted = forceMuted ? true : muted;
      if (!forceMuted) video.volume = volume;
      // O GIRO É REPOSTO AQUI, e não só em `setRotate`: um elemento `hidden` não
      // tem caixa medível (`clientWidth` 0), e `aplicarGiro` desiste quando não
      // consegue medir o palco. Esta é a linha em que ele deixa de estar
      // escondido — é aqui que a medida passa a existir. Sem isto, girar com o
      // telão no wallpaper e só então projetar entregava a mídia sem giro.
      if (rot) aplicarGiroTudo();
    }

    function play() {
      if (!current || (current.kind !== 'video' && current.kind !== 'audio')) return;
      ended = false;
      clearInterval(rampTimer);
      clearTimeout(muteApplyTimer);
      if (!forceMuted) video.volume = volume; // restaura pós fade-out
      applyMedia();
      instantCover(computeCover());
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
    function seek(t) { if (isFinite(t)) video.currentTime = t; }
    function setView(v) { view = v; instantCover(computeCover()); applyMedia(); }
    // Troca de view com transição: visual→wallpaper cobre, wallpaper→visual
    // revela. Só a CORTINA transiciona — o áudio (que segue tocando com o
    // visual desligado) fica intocado, sem rampa que terminaria num salto.
    // A cortina é ORTOGONAL ao conteúdo, daí o contador PRÓPRIO (viewSeq):
    // usar o loadSeq fazia um toque em "visual on/off" durante o load() (0,7 s
    // a 3 s: fade-out + OPFS + mediaReady) descartar o carregamento — a mídia
    // anterior já estava em opacity 0 e volume 0, o src novo nunca era
    // aplicado, e o telão ficava preto e mudo. Só ações exclusivas (load/clear)
    // cancelam um load; trocar a view, não.
    //
    // `cmd.overlay` = quem chamou tem uma camada PRÓPRIA por cima do stage (o
    // cartão de texto do Display), então descobrir revela algo mesmo sem mídia.
    // Sem o aviso o stage só enxerga o que ele mesmo desenha.
    async function setViewFaded(v, overlay) {
      if (v === view) return;
      const seq = ++viewSeq;
      const lseq = loadSeq;
      const antes = computeCover();
      view = v;
      // NADA EM CENA: a cortina cobre nos DOIS valores de view (computeCover
      // devolve true por `!current`/`ended`, independentemente dela), então não
      // há transição a fazer. Fazer uma era o defeito: `coverOut` esmaecia o
      // wallpaper sobre o VAZIO — que é preto — e o `instantCover` do fim o
      // recolocava. Do lado de quem opera, descobrir o telão sem mídia nenhuma
      // "piscava preto e voltava", uma reação forte para um botão que ali não
      // muda nada do que está projetado.
      if (computeCover() === antes && !overlay) return;
      if (v === 'wallpaper') {
        await coverIn(false);
      } else {
        await coverOut();
      }
      // Um setViewFaded mais novo, ou um load/clear que assumiu a cena no meio
      // do fade, mandam mais que este: nos dois casos quem chegou depois já
      // decidiu o estado final da cortina.
      if (seq !== viewSeq || lseq !== loadSeq) return;
      instantCover(computeCover());
    }
    function isPlayingNow() {
      return !!current && (current.kind === 'video' || current.kind === 'audio') && !video.paused;
    }
    // Mutar/desmutar faz uma rampa curta de volume (MUTE_RAMP_TIME) em vez de
    // cortar o áudio na hora — evita o "pop" de um corte abrupto. Ao mutar,
    // a rampa desce até 0 e só então a mídia é de fato marcada como muda
    // (video.muted=true); ao desmutar, desmuta já (senão volume=0 não seria
    // ouvido) e a rampa sobe até o volume alvo. Usa o mesmo rampTimer
    // compartilhado das outras rampas (fade de conteúdo/cortina) — mutuamente
    // exclusivas no tempo, a mais recente sempre cancela a anterior.
    function setMute(m) {
      muted = m;
      if (forceMuted) { video.muted = true; return; } // preview: sempre muda, sem rampa
      clearTimeout(muteApplyTimer);
      const playingNow = !!current && (current.kind === 'video' || current.kind === 'audio') && !video.paused;
      if (!playingNow) { clearInterval(rampTimer); video.muted = muted; return; }
      if (muted) {
        rampVolume(video.muted ? 0 : video.volume, 0, MUTE_RAMP_TIME);
        // Confere `muted` de novo ao aplicar: um load()/setMute() mais recente
        // pode ter mudado a intenção enquanto a rampa corria.
        muteApplyTimer = setTimeout(() => { if (muted) video.muted = true; }, MUTE_RAMP_TIME * 1000);
      } else {
        // A RAMPA PARTE DE ONDE O VOLUME ESTÁ, e não do silêncio (v1.4.17).
        //
        // Ela partia de ZERO sempre — certo saindo do mudo, onde não há o que
        // preservar, e ERRADO em todo o resto, porque escrever zero num
        // elemento que está tocando é o degrau que esta rampa existe para
        // evitar. É o espelho do que o ramo de cima já fazia
        // (`video.muted ? 0 : video.volume`).
        //
        // O caso comum é a REAFIRMAÇÃO: esta é uma função de DECLARAR estado, e
        // quem a chama no Controle é o `load()`, que reaplica a cena inteira a
        // cada troca de aba, a cada redesenho da lista, a cada importação. Com
        // o som já ligado, o que saía no elemento era, MEDIDO no arnês a cada
        // navegação entre o Cronograma e a Bíblia:
        //
        //     volume 1 → 0
        //     volume 0 → 1     (o `setVolume` da linha seguinte cancela a rampa)
        //
        // Em JS o par é atômico e nada se ouve. No aparelho não é: cada escrita
        // atravessa o renderer até o `AudioRendererImpl`, e o retorno de chamada
        // do áudio roda a cada ~10 ms. Caindo entre as duas, ele rende UM buffer
        // em silêncio — o ESTALO que o operador ouviu ao navegar entre as abas
        // com um louvor no ar. A janela se abre justamente na troca de aba, que
        // é quando a thread principal está mais ocupada (a lista nova, o
        // fantasma e as duas animações do carrossel).
        //
        // O outro caso é o TOQUE DUPLO no botão de mudo: desmutar no meio da
        // rampa de mutar, com o volume a meio caminho. É o mesmo degrau por
        // outra porta, e é o que se faz quando se muta por engano.
        //
        // A pergunta é feita ao ELEMENTO, nunca à variável do módulo: `muted`
        // pode estar certa com o `<video>` errado (um elemento recém-montado
        // pelo `resetMediaDom`, uma rampa interrompida), e aí a rampa é
        // legítima e tem de correr.
        const de = video.muted ? 0 : video.volume;
        video.muted = false;
        rampVolume(de, volume, MUTE_RAMP_TIME);
      }
    }
    function setVolume(vol) {
      volume = vol;
      clearInterval(rampTimer); // operador manda: cancela rampa de fade em curso
      clearTimeout(muteApplyTimer); // evita mutar sozinho depois, com o volume já ajustado
      // O CANCELAMENTO NÃO PODE PERDER O MUDO QUE A RAMPA IA APLICAR: com
      // `forceMuted` ligado, o timer é o único que mutaria, e sem esta linha o
      // som ficava no volume em que a rampa parou (a preview soando com a TV
      // no ar). Ver setForceMuted.
      if (!forceMuted) video.volume = vol;
      else video.muted = true;
    }
    // Preenchimento da mídia: 'contain' (ajustar, mostra tudo, pode ter barras)
    // ou 'cover' (preenche o quadro, corta o excesso). Aplicado direto via style
    // (sobrepõe o object-fit do CSS) — mesmo valor pros dois elementos, já que
    // só um está visível por vez.
    //
    // O 'fill' (esticar) SAIU da UI na v5.142 — distorcer a proporção é o
    // defeito que as outras duas existem para evitar. Ele continua sendo aceito
    // aqui de propósito: o valor está PERSISTIDO no banco de quem já o escolheu
    // (`state.fit`), e recusá-lo faria a mídia trocar de preenchimento sozinha
    // na primeira abertura depois da atualização. O Controle migra o estado uma
    // vez (ver `applyFit`); o motor não precisa ter opinião sobre isso.
    function setFit(v) {
      fit = (v === 'cover' || v === 'fill') ? v : 'contain';
      img.style.objectFit = fit;
      video.style.objectFit = fit;
      // A CAMADA NÃO PRECISA DE REPOSIÇÃO como o giro: `object-fit` é estilo
      // simples e gruda no elemento esteja ele visível ou não. Quem escreve
      // aqui vence o `contain` da folha, que passa a ser só o valor de partida.
      if (camadaImg) camadaImg.style.objectFit = fit;
    }

    // ===== GIRAR A MÍDIA (v5.142) =====
    //
    // Vídeo gravado de lado chega DEITADO no telão: a mídia é do operador, não
    // há reencode possível no meio de um culto.
    //
    // A caixa TROCA DE EIXO antes de girar, e é isso que separa este código de
    // um `transform: rotate()` solto. Um `<video>` ocupa o palco inteiro (W×H) e
    // o `object-fit` encaixa a mídia NESSE retângulo; girar só o transform
    // deixaria o encaixe calculado para o retângulo errado — um vídeo retrato
    // girado apareceria minúsculo, com o dobro de barras. Trocando
    // `width`/`height` primeiro, a conta é feita no retângulo em que a mídia vai
    // de fato aparecer, e a rotação só o põe de pé.
    //
    // Por isso depende do TAMANHO do palco, que muda (rotação do aparelho,
    // resolução da TV, a preview trocando de casa) — daí o `ResizeObserver`.
    // Sem ele o giro ficaria certo até a primeira mudança de tamanho.
    let rot = 0;
    function aplicarGiro(el) {
      if (!el) return true;
      if (!rot) {
        el.style.inset = '';
        el.style.width = ''; el.style.height = '';
        el.style.left = ''; el.style.top = '';
        el.style.transform = '';
        return true;
      }
      if (rot === 180) {
        el.style.inset = ''; el.style.width = ''; el.style.height = '';
        el.style.left = ''; el.style.top = '';
        el.style.transform = 'rotate(180deg)';
        return true;
      }
      const caixa = el.parentElement || el.offsetParent;
      const w = caixa ? caixa.clientWidth : 0;
      const h = caixa ? caixa.clientHeight : 0;
      // SEM MEDIDA NÃO HÁ GIRO POSSÍVEL — e quem tenta de novo é o
      // [aplicarGiroTudo], no quadro seguinte. Ver o comentário de lá.
      if (!w || !h) return false;
      el.style.inset = 'auto';
      el.style.width = h + 'px';
      el.style.height = w + 'px';
      el.style.left = '50%';
      el.style.top = '50%';
      el.style.transform = 'translate(-50%, -50%) rotate(' + rot + 'deg)';
      return true;
    }
    // QUEM NÃO PÔDE SER MEDIDO É TENTADO DE NOVO NO QUADRO SEGUINTE (v1.8.36).
    //
    // `aplicarGiro` desiste quando o pai mede 0, e o comentário dele prometia
    // que "o observer abaixo repõe assim que houver". A promessa era FALSA para
    // a CAMADA: o `camadaImg` não mora na caixa do palco, mora dentro da camada
    // de texto (`#pvText` na preview), que é `hidden` — `display:none`, logo
    // `clientWidth` ZERO — até ser revelada. Quem revela chama `reporGiro()` no
    // mesmo passo, e nesse instante o ANCESTRAL ainda pode estar escondido: a
    // medida dá 0, a função volta sem girar, e nada repõe.
    //
    // O OBSERVADOR NÃO RESOLVE, e isto foi MEDIDO em vez de suposto: um
    // `ResizeObserver` sobre `#pvText` dispara UMA vez ao registrar (0x0) e
    // **não dispara** nem ao esconder nem ao revelar. Vigiar mais caixas seria
    // código morto com um comentário afirmando o contrário.
    //
    // O desfecho do defeito é PERMANENTE e não erra alto: a foto entra
    // sobreposta ao louvor, com o preenchimento certo e SEM O GIRO que o
    // operador escolheu — e sem TV a preview É a projeção. Foi assim que o
    // `enquadramento-da-camada` reprovou no runner passando doze vezes aqui: a
    // ordem entre revelar a camada e repor o giro depende da máquina.
    //
    // O TETO existe para uma camada que fique escondida não deixar um
    // `requestAnimationFrame` girando para sempre. Ele não custa nada a quem
    // revela depois: `reporGiro` e `setRotate` zeram a contagem, então cada
    // revelação ganha uma janela nova.
    const GIRO_TENTATIVAS = 60;   // ~1 s a 60 Hz
    let giroTentativa = 0;
    let giroAgendado = false;
    function aplicarGiroTudo() {
      const faltou = [aplicarGiro(img), aplicarGiro(video), aplicarGiro(camadaImg)]
        .indexOf(false) !== -1;
      if (!rot || !faltou) { giroTentativa = 0; return; }
      if (giroAgendado || giroTentativa >= GIRO_TENTATIVAS) return;
      if (!global.requestAnimationFrame) return;
      giroAgendado = true;
      global.requestAnimationFrame(() => {
        giroAgendado = false;
        giroTentativa++;
        aplicarGiroTudo();
      });
    }
    function setRotate(v) {
      const n = ((v | 0) % 360 + 360) % 360;
      rot = (n === 90 || n === 180 || n === 270) ? n : 0;
      giroTentativa = 0;
      aplicarGiroTudo();
    }
    if (global.ResizeObserver) {
      const caixa = (video && video.parentElement) || null;
      if (caixa) {
        try { new ResizeObserver(() => { if (rot) aplicarGiroTudo(); }).observe(caixa); }
        catch (_) { /* sem observer o giro só não reage a redimensionamento */ }
      }
    }
    // Alterna se este stage é forçado a ficar sempre mudo (a preview do
    // Controle espelhando o Display em silêncio, a tela da rede antes do gesto
    // do visitante) ou se passa a tocar áudio de verdade pelo próprio
    // aparelho. A troca não corta o áudio na hora — faz a mesma
    // rampa curta do setMute (MUTE_RAMP_TIME): ao ATIVAR, respeita o mudo do
    // operador e sobe o volume de 0 até o alvo; ao DESATIVAR, desce até 0 e só
    // então muta. Sem mídia tocando, aplica na hora (sem rampa, nada a
    // esmaecer).
    //
    // NA DESATIVAÇÃO, `forceMuted` LIGA JÁ e só o `video.muted` espera a rampa.
    // A intenção não pode viver apenas no `muteApplyTimer`: `play`, `setMute`,
    // `setVolume` e `resetMediaDom` o cancelam, e o pedido sumia — a preview do
    // Controle seguia com som pelo resto da sessão, com a TV no ar. A ORDEM é o
    // que mantém a rampa de pé: `rampVolume` ignora pedido com `forceMuted`
    // ligado, então ele vem DEPOIS dela (o `rampSteps` já em curso não
    // reconsulta a bandeira).
    function setForceMuted(v) {
      const target = !!v;
      clearInterval(rampTimer);
      clearTimeout(muteApplyTimer);
      const playingNow = !!current && (current.kind === 'video' || current.kind === 'audio') && !video.paused;
      if (!playingNow) {
        forceMuted = target;
        applyMedia();
        if (!forceMuted) video.volume = volume;
        return;
      }
      if (target) {
        // EMUDECER: rampa até 0, depois muta (só o `video.muted` espera).
        if (video.muted) { forceMuted = true; return; }
        rampVolume(video.volume, 0, MUTE_RAMP_TIME);
        forceMuted = true;
        muteApplyTimer = setTimeout(() => {
          video.muted = true; video.volume = volume;
        }, MUTE_RAMP_TIME * 1000);
      } else {
        // DAR SOM: som já liberado; respeita o mudo do operador.
        forceMuted = false;
        video.muted = muted;
        if (muted) video.volume = volume;
        else rampVolume(0, volume, MUTE_RAMP_TIME);
      }
    }

    function _revokeUrl() {
      if (url && isBlobUrl) { URL.revokeObjectURL(url); }
      url = null;
      isBlobUrl = false;
    }

    // Reset comum de DOM (sem mexer em current/ended/cortina) — usado por
    // clear() e fadeOutToBlack().
    function resetMediaDom() {
      clearInterval(rampTimer);
      clearTimeout(muteApplyTimer);
      img.hidden = true; img.removeAttribute('src');
      // Idem: esconder o <video> faz parte de limpar a fonte, não é detalhe
      // do applyMedia() que vem depois. Entre esta linha e ele há repaint
      // suficiente para o placeholder (retângulo claro + play) aparecer ao
      // parar ou limpar a mídia.
      video.hidden = true;
      clearFadeStyle(video); clearFadeStyle(img);
      video.pause(); video.removeAttribute('src'); video.load(); video.poster = POSTER_VAZIO;
      _revokeUrl();
    }

    // `startAt`/`autoplay` existem para a RECONEXÃO do telão: até a v5.47 o
    // reenvio de cena mandava só o `load`, então um hino aos 3:20 voltava do
    // zero na frente da congregação e um louvor PAUSADO para a oração voltava
    // tocando.
    // Vêm no PRÓPRIO comando de load, e não como `seek`/`pause` logo depois,
    // porque `onCommand` no Display não serializa: o load é assíncrono
    // (getMedia → opfsGetFile → mediaReady) e um comando seguinte agiria sobre
    // o <video> ANTERIOR, antes de a fonte nova entrar.
    // `page` só existe para a APRESENTAÇÃO (kind 'deck'): a página em que ela
    // entra em cena, no mesmo comando pelo mesmo motivo.
    // O invólucro conta os loads EM VOO. O contador desce em TODAS as saídas
    // (try/finally, cobrindo returns antecipados e getMedia que rejeite): um
    // load esquecido no contador silenciaria o fim natural — e com ele o avanço
    // de playlist — até a página recarregar.
    async function load(id, v, m, vol, startAt, autoplay, page) {
      loadsEmVoo++;
      try {
        return await loadInner(id, v, m, vol, startAt, autoplay, page);
      } finally {
        loadsEmVoo--;
      }
    }

    async function loadInner(id, v, m, vol, startAt, autoplay, page) {
      if (v !== undefined) view = v;
      if (m !== undefined) muted = m;
      if (typeof vol === 'number') volume = vol;

      // Guarda sequencial: se outra chamada load() começar antes desta terminar
      // o fade/getMedia(), descartamos esta para evitar race de URL/current.
      const seq = ++loadSeq;
      // Troca de CONTEÚDO (item já visível dando lugar a outro): esmaece o
      // atual até o preto: sem relação com a cortina do wallpaper, que já
      // está fora de cena nesse caso (visibleEl() só retorna algo se não
      // estiver coberto).
      const willFade = fadeOut && !!visibleEl();
      await runFadeOut(true);
      if (seq !== loadSeq) return;
      ended = false;
      if (willFade) {
        // Esconde as camadas ainda esmaecidas ANTES de restaurar a opacidade
        // (evita a mídia antiga reaparecer durante o getMedia).
        img.hidden = true; img.removeAttribute('src');
        // O <video> tem que ser escondido JUNTO com a remoção da fonte: um
        // elemento de vídeo visível e sem `src` é pintado pelo navegador como
        // um retângulo claro com botão de play. Como o `getMedia`/`opfsGetFile`
        // logo abaixo são assíncronos, essa janela dura o suficiente para o
        // placeholder piscar na tela a cada troca de mídia.
        video.hidden = true;
        // A URL DA CENA QUE SAI MORRE ANTES DA FONTE. O `_revokeUrl` de baixo
        // só roda DEPOIS do `getMedia`, e nesse vão o Blob da mídia anterior
        // continuaria vivo sobre um `<video>` que este `load()` acabou de
        // esvaziar.
        _revokeUrl();
        video.pause(); video.removeAttribute('src'); video.load(); video.poster = POSTER_VAZIO;
        clearFadeStyle(video); clearFadeStyle(img);
      }
      const rec = await AVDB.getMedia(id);
      if (seq !== loadSeq) return;
      if (!rec) { clear(); return; }
      current = rec;

      _revokeUrl();

      img.hidden = true; img.removeAttribute('src');
      // Escondido junto com a fonte (mesmo motivo de cima): sem `src` o
      // <video> visível vira um placeholder claro com botão de play.
      // applyMedia(), no fim deste load, revela conforme o kind que entrar.
      video.hidden = true;
      video.pause(); video.removeAttribute('src'); video.load(); video.poster = POSTER_VAZIO;
      // Nenhum estilo de fade anterior pode sobrar na mídia que vai entrar
      // (ex: opacity 0 de um fade-in descartado com a config já alterada).
      clearFadeStyle(video); clearFadeStyle(img);

      if (rec.kind === 'youtube') {
        // YouTube is handled externally; stage shows thumbnail in img if available
        if (rec.thumb) {
          img.src = rec.thumb;
          img.hidden = false;
        }
        return;
      }

      if (rec.blob) {
        url = URL.createObjectURL(rec.blob);
        isBlobUrl = true;
      } else if (rec.kind === 'deck' && Array.isArray(rec.pages) && rec.pages.length) {
        deckIdx = Math.min(Math.max(page | 0, 0), rec.pages.length - 1);
        const pg = urlDaPagina(rec.pages[deckIdx]);
        url = pg.url;
        isBlobUrl = pg.blob;
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

      if (rec.kind === 'image' || rec.kind === 'deck') {
        img.src = url;
      } else {
        video.src = url;
        video.muted = forceMuted ? true : muted;
        if (!forceMuted) video.volume = volume;
        // A posição só "gruda" depois que a duração é conhecida — escrever
        // currentTime junto com o src é perdido em silêncio. `once` porque
        // isto vale para ESTA fonte; a próxima traz o seu próprio pedido.
        //
        // A CENA RESTAURADA PAUSADA SEMPRE FAZ SEEK, mesmo para o segundo zero
        // (v5.142). Não é sobre a posição: é o seek que desliga o **show poster
        // flag** do HTML e faz o elemento pintar o QUADRO em vez do pôster (ver
        // o comentário do `POSTER_VAZIO` mais abaixo). Sem ele, um vídeo que
        // volta pausado no início ficava no pôster — e, sem atributo de pôster,
        // no retângulo cinza com o play do WebView. Um vídeo que vai TOCAR não
        // precisa disto: o `play()` desliga a bandeira sozinho.
        const precisaSeek = (typeof startAt === 'number' && startAt > 0) || autoplay === false;
        if (precisaSeek) {
          video.addEventListener('loadedmetadata', () => {
            if (seq !== loadSeq) return;   // outro load assumiu durante a espera
            const alvoT = (typeof startAt === 'number' && isFinite(startAt) && startAt > 0) ? startAt : 0;
            try { video.currentTime = alvoT; } catch (_) { /* fonte sem seek */ }
          }, { once: true });
        }
        // `autoplay === false` é a cena que voltou PAUSADA. `undefined` mantém
        // o comportamento de sempre (todo load normal toca), então nenhum outro
        // chamador precisou mudar. Sem `play()` aqui, quem revela a mídia é o
        // `applyMedia()` + a cortina no fim deste mesmo load.
        if (autoplay !== false) play();
        // ENTRADA COM RAMPA, espelhando a saída. Não existia: o volume era
        // escrito direto no alvo e a mídia entrava no talo enquanto o visual
        // ainda esmaecia — audível a cada troca de hino. `play()` restaura o
        // volume alvo (e limpa o rampTimer), então a rampa vem DEPOIS dele; ela
        // mesma escreve o 0 inicial.
        if (fadeIn && !forceMuted && !video.muted && volume > 0) {
          rampVolume(0, volume, fadeTime);
        }
      }
      // A OPACIDADE ZERO É ESCRITA ANTES DE REVELAR. `applyMedia()` tira o
      // `hidden`, e um elemento revelado em opacidade cheia pinta um quadro
      // antes de qualquer transição começar — o estouro que o fade existe para
      // evitar. Só no caminho SEM cortina: quando ela está cobrindo, quem faz a
      // transição é o `coverOut()` e um segundo fade por baixo dela seria uma
      // transição dentro da outra.
      const alvo = elDe(rec);
      const entrada = fadeIn && !coveredNow && !!alvo && !semVisual() && view === 'visual';
      if (entrada) {
        alvo.style.transition = '';
        alvo.style.opacity = '0';
      }
      applyMedia();
      // Revela (esconde a cortina) se a view pedir e ainda estiver coberto —
      // primeiro conteúdo depois do wallpaper, ou depois de ended/stop/clear.
      // Se nada estava cobrindo (já em cena, só trocando de item), coverOut()
      // não faz nada — quem cuidou da troca visual foi o fade de CONTEÚDO
      // acima.
      // `!semVisual()`: um áudio sem letra mantém o wallpaper — abrir a cortina
      // para ele mostraria o preto do palco. Ver `computeCover`.
      if (view === 'visual' && coveredNow && !semVisual()) {
        if (fadeIn && alvo) {
          // ESTE RAMO NÃO É O DO "Tocar agora". Num load com autoplay o
          // `play()` acima já chamou `instantCover(computeCover())` e zerou o
          // `coveredNow`, então quem transiciona ali é o fade de CONTEÚDO. Aqui
          // se chega com `autoplay === false` (cena restaurada PAUSADA) ou com
          // imagem — casos em que a cortina de fato ainda está no ar.
          //
          // A espera pelo primeiro quadro vem ANTES de abrir a cortina: abri-la
          // sobre um elemento ainda vazio revelaria o preto do palco.
          await mediaReady(alvo);
          if (seq !== loadSeq) return;
        }
        await coverOut();
        if (seq !== loadSeq) return;
      } else if (entrada) {
        // A ENTRADA DO CONTEÚDO, quando não há cortina para abrir. Espera o
        // primeiro quadro e só então esmaece de volta ao normal — imagem e som
        // entram juntos (ver `runFadeIn`).
        await mediaReady(alvo);
        if (seq !== loadSeq) return;
        await runFadeIn(alvo);
        if (seq !== loadSeq) return;
      }
      // E o caminho inverso: uma IMAGEM em cena, seguida de um áudio sem letra.
      // Ali a cortina estava aberta (havia o que ver), então ninguém a fecharia
      // — e o telão ficaria no preto do palco em vez de voltar ao wallpaper.
      // `computeCover()` E NÃO `semVisual()`: é a mesma pergunta, com o overlay
      // dentro. Trocar o áudio de fundo com um versículo no ar caía aqui e
      // fechava a cortina sobre ele.
      if (computeCover() && !coveredNow) {
        await coverIn(false);
        if (seq !== loadSeq) return;
      }
    }

    // UMA PÁGINA DA APRESENTAÇÃO, resolvida em URL.
    //
    // As páginas são Blobs no aparelho (`AVDB.addDeck` as guarda assim) e
    // STRINGS numa tela da rede, que recebe o registro saneado com uma `/m/`
    // por página — a mesma distinção que o `rec.blob` × `rec.url` já faz para a
    // mídia principal, aplicada ao único kind cujo conteúdo é uma LISTA. Quem
    // devolve também diz se cabe revogar depois: `URL.createObjectURL` exige
    // `revokeObjectURL`, uma `/m/` não.
    function urlDaPagina(pg) {
      if (typeof pg === 'string') return { url: pg, blob: false };
      return { url: URL.createObjectURL(pg), blob: true };
    }

    // TROCA DE PÁGINA da apresentação em cena. Um `load` novo faria o ciclo
    // inteiro — fade de saída, leitura do IndexedDB, fade de entrada — para
    // trocar uma imagem que já está na mão: passar slide ficaria lento e
    // piscaria o preto entre um e outro. Aqui só a fonte do `<img>` muda.
    function page(n) {
      if (!current || current.kind !== 'deck') return;
      const pages = Array.isArray(current.pages) ? current.pages : [];
      if (!pages.length) return;
      const alvo = Math.min(Math.max(n | 0, 0), pages.length - 1);
      if (alvo === deckIdx) return;
      deckIdx = alvo;
      _revokeUrl();
      const r = urlDaPagina(pages[alvo]);
      url = r.url;
      isBlobUrl = r.blob;
      img.src = url;
    }

    function clear() {
      current = null;
      deckIdx = 0;
      ended = false;
      resetMediaDom();
      instantCover(true); // current=null: cobre sempre, independente da view
      applyMedia();
    }

    // clear com fade-out (cobre com a cortina); descartado se um load mais
    // novo chegar durante o fade. Usado pelo comando 'clear' do operador —
    // aqui o wallpaper É o destino certo (ponto final explícito).
    async function clearFaded() {
      const seq = ++loadSeq;
      // COM A CORTINA JÁ FECHADA o `coverIn` devolve na hora — e é esse o caso
      // do áudio sem letra, o louvor de fundo: a cortina está fechada o tempo
      // todo, a rampa que mora lá dentro nunca rodava, e o `clear()` logo
      // abaixo cortava o som no meio. Aqui a rampa acontece à parte e o
      // `clear()` espera por ela, que é o mesmo tempo (e o mesmo desfecho) de
      // qualquer outra mídia saindo de cena.
      if (coveredNow && fadeOut) {
        rampAudioParaZero();
        await new Promise((r) => setTimeout(r, fadeTime * 1000));
        if (seq !== loadSeq) return;
      }
      await coverIn(true);
      if (seq !== loadSeq) return;
      clear();
    }

    // Esmaece o conteúdo até o PRETO e reseta o stage (current=null), sem
    // tocar na cortina do wallpaper — usado só na troca de TIPO de conteúdo
    // (mídia local ↔ YouTube, que vive fora do stage), nunca pelo comando
    // 'stop'/'clear' do operador (que quer mesmo o wallpaper, ver
    // clearFaded() acima). Se o conteúdo já esmaeceu sozinho (fim natural,
    // `ended`), pula o fade redundante.
    async function fadeOutToBlack() {
      const seq = ++loadSeq;
      if (!ended) {
        await runFadeOut(true);
        if (seq !== loadSeq) return;
      }
      current = null;
      ended = false;
      resetMediaDom();
      applyMedia();
    }

    // Retorna a promise das sub-chamadas assíncronas — a maioria dos
    // chamadores dispara e esquece, mas display.js precisa aguardar o clear()
    // (YouTube) antes de decidir o que mostrar enquanto o vídeo carrega.
    function handle(cmd) {
      switch (cmd.type) {
        case 'load': return load(cmd.mediaId, cmd.view, cmd.muted, cmd.volume, cmd.time, cmd.playing, cmd.page);
        case 'page': page(cmd.page); break;
        case 'view': return setViewFaded(cmd.view, cmd.overlay);
        case 'mute': setMute(cmd.muted); break;
        case 'volume': if (typeof cmd.volume === 'number') setVolume(cmd.volume); break;
        case 'play': play(); break;
        case 'pause': pause(); break;
        case 'seek': seek(cmd.time); break;
        case 'clear': return clearFaded();
        // PARAR SÓ A MÍDIA, sem tocar na cortina (v5.178). É o `fadeOutToBlack`
        // exposto ao Display: com a Camada de Texto em cena, o `clear` acima
        // fecharia o wallpaper POR CIMA do versículo (ou do cronômetro) que
        // continua no ar — o cartão de texto vive por BAIXO da cortina do
        // stage, que é a mesma razão do `instantCover(false)` do ramo de `view`
        // em `display.js`. Quem escolhe entre os dois é o Display, que é quem
        // sabe se há texto ativo.
        case 'clear-media': return fadeOutToBlack();
        case 'fit': setFit(cmd.fit); break;
        case 'rotate': setRotate(cmd.rotate); break;
      }
    }

    // Fim natural → esmaece até o PRETO (nunca a cortina do wallpaper aqui:
    // ainda não se sabe se um próximo item está a caminho). Só cobre com o
    // wallpaper de fato depois de confirmar que ninguém assumiu a cena num
    // instante — evita a marca aparecer brevemente durante o avanço
    // automático de playlist. O 'load' do avanço automático (disparado por
    // onEnded, logo abaixo) chega quase junto e assume via loadSeq antes
    // desse prazo — a cortina não pisca entre os itens da playlist.
    //
    // ELE É CHAMÁVEL DE FORA (`marcarFim`), e essa é a metade que faltava
    // (v1.7.7). Relato do operador: *"ao encerrar o tempo de uma música, a
    // imagem no telão se encerra normalmente, e volta para o wallpaper, mas na
    // preview, ele está parando em uma tela preta e não volta para o
    // wallpaper"* — COM espelhamento para a TV.
    //
    // A PREVIEW NUNCA CHEGAVA A OUVIR O PRÓPRIO `ended`. Com telão no ar ela é
    // ILUSTRAÇÃO e segue o `display-status`: o telão termina, dispara `pause`
    // ANTES de `ended` (é a ordem do HTML), e o status que sai daí faz o
    // `resyncPreviewToDisplay` do Controle chamar `preview.pause()` — no
    // instante em que o `<video>` da preview estava a milissegundos do fim dele.
    // Pausado, ele não emite `ended`; sem `ended`, `computeCover()` responde
    // `false` e a cortina nunca fecha. O que fica na tela é o quadro parado em
    // `currentTime === duration`, isto é, PRETO — não há quadro decodificável
    // ali. Sem TV o caso não existe: a preview É a projeção, ninguém a pausa, e
    // o `ended` dela chega sozinho.
    //
    // UMA IMPLEMENTAÇÃO, DOIS CHAMADORES — o evento do próprio `<video>` e o
    // dono do palco, que sabe pelo barramento que a PROJEÇÃO acabou. Duas
    // escritas da mesma sequência (fade, `ended`, `applyMedia`, cortina)
    // divergiriam no primeiro ajuste, e a metade que divergisse seria
    // justamente a que ninguém vê acontecer.
    async function marcarFimNatural() {
      // JÁ MARCADO: o evento do `<video>` e o aviso de fora podem chegar os
      // dois (a preview termina sozinha logo depois de o telão avisar). O
      // segundo não pode bumpar o `loadSeq` de novo — isso cancelaria a
      // cortina que o primeiro agendou, e o desfecho seria o defeito de volta
      // por um caminho novo. `load` zera esta bandeira, então uma faixa
      // recarregada volta a poder terminar.
      if (ended) return;
      // UM LOAD EM VOO GANHA DO FIM NATURAL. O `++loadSeq` abaixo é uma AÇÃO
      // EXCLUSIVA, e o contrato do loadSeq (ver setViewFaded) é que só ações do
      // OPERADOR (load/clear) cancelam um load em curso. O `ended` não é uma:
      // é o vídeo velho acabando sozinho, e ele vencia o caso real — o operador
      // toca o próximo hino nos últimos ~600 ms, o vídeo termina durante o fade
      // de saída, o bump descartava o load novo em silêncio e, sem repeat, o
      // item pedido nunca entrava. Retornar cedo deixa o load em voo fazer a
      // transição: ele já troca a fonte, reseta `ended` e decide a cortina.
      //
      // O avanço automático de playlist NÃO passa por aqui: no `ended` dele não
      // há load em voo (`loadsEmVoo == 0`) — o load do avanço nasce DEPOIS,
      // quando o `media-ended` chega ao Controle.
      if (loadsEmVoo > 0) return;
      const seq = ++loadSeq;
      await runFadeOut(false);
      if (seq !== loadSeq) return;
      ended = true;
      // PAUSA EXPLÍCITA, e ela só importa para o chamador DE FORA (v1.7.7): no
      // caminho do evento o `<video>` já parou sozinho — `ended` implica
      // `paused` —, mas quem avisa que a PROJEÇÃO acabou pega este elemento
      // ainda TOCANDO, a milissegundos do fim dele. Sem ela o `currentTime = 0`
      // logo abaixo não encerra nada: rebobina, e a faixa recomeça do zero por
      // baixo de uma cortina que está descendo. MEDIDO: `currentTime` em 0,18 s
      // e subindo, com `ended` já verdadeiro.
      try { video.pause(); } catch (_) {}
      video.currentTime = 0;
      clearFadeStyle(video);
      applyMedia();
      setTimeout(() => {
        // `computeCover()` E NÃO `true`: sem mídia a cortina de fato cobre, mas
        // com um cartão de texto em cena (um cronômetro projetado sobre um
        // louvor de fundo — o caso que a independência áudio × texto existe
        // para permitir) o fim natural da música fechava a cortina POR CIMA do
        // cartão, e nada a devolvia.
        if (seq === loadSeq && ended) instantCover(computeCover());
      }, 400);
    }
    video.addEventListener('ended', marcarFimNatural);

    // O PÔSTER VAZIO FICA. PARA SEMPRE. (v5.142)
    //
    // Ele saía no `loadeddata` ("há quadro, então mantê-lo esconderia o quadro
    // congelado da cena restaurada pausada"). A premissa está errada, e era ela
    // que produzia o retângulo cinza com o play.
    //
    // Quem decide o que um `<video>` pinta não é o `poster`, é o SHOW POSTER
    // FLAG: ligado, o elemento mostra o pôster, e ele só desliga quando a
    // reprodução COMEÇA ou quando há um SEEK. Num vídeo restaurado PAUSADO
    // nenhuma das duas acontecia — a bandeira ficava ligada, o atributo tinha
    // sido removido, e sem atributo o WebView desenha o `getDefaultVideoPoster`.
    // Tirar o pôster revelava o placeholder, não o quadro.
    //
    // Com a bandeira desligada o `poster` é IGNORADO por contrato: mantê-lo não
    // custa nada e cobre a janela em que importa. Para o quadro congelado
    // aparecer, falta o seek — que a cena pausada faz abaixo, sempre. (Cada
    // `load` repõe o atributo antes de a fonte nova entrar.)

    // A MESMA guarda do handler interno (acima): com um load em voo, o fim
    // natural é do item que está SAINDO — anunciá-lo (`media-ended`) faria o
    // avanço automático do Controle disparar por cima do load que o operador
    // acabou de pedir, o mesmo defeito visto do outro lado do barramento. No
    // avanço normal `loadsEmVoo == 0` e o aviso sai como sempre.
    if (opts.onEnded) video.addEventListener('ended', (e) => {
      if (loadsEmVoo > 0) return;
      opts.onEnded(e);
    });
    if (opts.onTime) {
      ['timeupdate', 'loadedmetadata', 'play', 'pause', 'ended', 'volumechange'].forEach((ev) =>
        video.addEventListener(ev, opts.onTime));
    }
    if (opts.onError) video.addEventListener('error', opts.onError);

    setFit(fit); // aplica o valor inicial (default 'contain') via style, já na criação

    return {
      handle, load, clear, play, pause, seek, page, setView, setMute, setVolume, setFade, setFit,
      setRotate, getRotate: () => rot,
      // REPOR O GIRO NA CAMADA, e quem chama é o dono do palco no instante em
      // que ele REVELA o `camadaImg`.
      //
      // Não é cerimônia: `aplicarGiro` desiste quando não consegue medir a
      // caixa (`clientWidth` 0), e um elemento escondido não tem caixa — é a
      // mesma razão pela qual `applyMedia` repõe o giro ao tirar o `hidden` do
      // `img`/`video`. A camada não passa por `applyMedia` (quem a mostra é o
      // `showText`/`pintarPvTextImg`), então a reposição dela é PEDIDA.
      //
      // Sem prazo e sem observer: um `ResizeObserver` na própria camada
      // resolveria sozinho, e foi descartado porque `aplicarGiro` MEXE na caixa
      // que ele observaria — um laço que converge, mas cujo aviso do Chromium
      // ("ResizeObserver loop") o `smoke.mjs` lê como erro de console.
      reporGiro: () => { if (rot) { giroTentativa = 0; aplicarGiroTudo(); } },
      setForceMuted,
      coverIn, coverOut, instantCover, fadeOutToBlack, setOverlay, declararView,
      // O FIM DA PROJEÇÃO É UM FIM, E NÃO UMA PAUSA (v1.7.7). Quem sabe que a
      // mídia acabou nem sempre é este `<video>`: com telão no ar a preview é
      // ilustração e é PAUSADA pelo `resyncPreviewToDisplay` antes de chegar ao
      // fim dela, e um `<video>` pausado nunca emite `ended`. Ver
      // `marcarFimNatural` — é a MESMA sequência do evento, não uma segunda.
      marcarFim: marcarFimNatural,
      getCurrent: () => current,
      getView: () => view,
      isPlaying: isPlayingNow,
      // Chegou ao fim natural e está aguardando replay. As camadas paralelas
      // (letra, texto) precisam disso: no fim o stage zera o currentTime para
      // preparar o replay, e quem segue o tempo re-renderizaria o slide 0 —
      // fazendo a capa do hino piscar antes do wallpaper cobrir.
      hasEnded: () => ended,
      // "A cortina deveria estar cobrindo agora?" — a MESMA regra que o stage
      // usa internamente, exposta porque o Display também decide sobre a
      // cortina (ao tirar a Camada de Texto de cena, por exemplo) e não pode
      // reabri-la sobre um áudio que não tem o que mostrar. Duas cópias da
      // regra divergiriam no primeiro caso novo. Ver `computeCover`.
      shouldCover: computeCover,
      isTimed: () => !!current && (current.kind === 'video' || current.kind === 'audio'),
      getTime: () => video.currentTime,
      getDuration: () => video.duration,
      getMuted: () => (forceMuted ? muted : video.muted),
      getVolume: () => volume,
      // `getPage`/`getFit`/`isForceMuted` saíram da superfície: nunca tiveram
      // chamador fora daqui (grep na base inteira + tools/), e superfície
      // pública sem uso é contrato que envelhece sem ninguém vigiar.
    };
  }

  global.createStage = createStage;
  // SEM CONSUMIDOR EXTERNO desde a v5.212 — não leia isto como contrato. Eles
  // existiam para as rampas do embed do YouTube (`ytRampVolume` no Display,
  // `ytPreviewRampVolume` no Controle), removidas junto com ele; hoje há um
  // `<video>` só e a rampa é uma só. Ficam expostos como ponto de extensão.
  createStage.rampSteps = rampSteps;
  createStage.MUTE_RAMP_TIME = MUTE_RAMP_TIME;
  // Transições: config fixa do sistema + os fades de camada paralela, idênticos
  // nos dois apps (ver bloco no topo).
  createStage.FADE = FADE;
  createStage.LAYER_FADE_MS = LAYER_FADE_MS;
  createStage.fadeContentIn = fadeContentIn;
  createStage.fadeLayerIn = fadeLayerIn;
  createStage.fadeLayerOut = fadeLayerOut;
  createStage.findSlideIndex = findSlideIndex;

  // ===== Cronômetro / Relógio / Timer (aba Ferramentas) =====
  // O descritor é um OBJETO PEQUENO E ESTÁVEL, não um fluxo de ticks: quem
  // conta é cada lado, localmente, a partir de uma ORIGEM comum (`startAt`, em
  // epoch ms). Texto pronto a cada segundo seriam ~3.600 comandos/hora no
  // barramento para mexer dois dígitos, e o telão pararia se um se perdesse.
  //
  // Consequência: na RECONEXÃO, `resendSceneToDisplay` reenviando o mesmo
  // objeto devolve o cronômetro no segundo certo, sem estado a ressincronizar.
  // Mesmo princípio do `load` + posição.
  //
  // Os dois WebViews são o MESMO processo no MESMO aparelho, então `Date.now()`
  // é a mesma base dos dois lados (no navegador, duas abas da máquina).
  //
  // Descritor:
  //   { mode:'clock'|'stopwatch'|'timer',
  //     running:bool, startAt:<epoch ms>, baseMs:<acumulado nas pausas>,
  //     durationMs:<alvo do timer>, secs:bool, h12:bool }
  const CHRONO_TICK_MS = 200;   // 5 Hz: o segundo vira sem atraso perceptível

  function pad2(n) { return String(n).padStart(2, '0'); }

  // Duração em ms → texto. Acima de 1 h entra o campo de horas; abaixo fica em
  // MM:SS, que é o formato que o operador lê de relance.
  function formatSpan(ms) {
    const total = Math.floor(Math.max(0, ms) / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ? h + ':' + pad2(m) + ':' + pad2(s) : pad2(m) + ':' + pad2(s);
  }

  // Tempo decorrido do cronômetro/timer. Pausado, o valor é só o acumulado —
  // por isso `baseMs` existe: sem ele, pausar e retomar perderia o trecho
  // anterior (ou exigiria reescrever `startAt`, que é justamente a âncora que
  // torna a reconexão trivial).
  function chronoElapsed(c, now) {
    const base = c.baseMs || 0;
    return c.running ? base + Math.max(0, now - (c.startAt || now)) : base;
  }

  // Leitura pronta para a tela. `over` marca o timer que passou do alvo: ele
  // NÃO congela em zero — continua contando, com sinal negativo. Num culto,
  // "estourou por 4 minutos" é a informação que se precisa; um 00:00 parado
  // não distingue "acabou agora" de "acabou há muito".
  function chronoReading(c, now) {
    if (!c) return { text: '', over: false };
    const t = new Date(now == null ? Date.now() : now);
    if (c.mode === 'clock') {
      let h = t.getHours();
      let suffix = '';
      if (c.h12) {
        suffix = h >= 12 ? ' PM' : ' AM';
        h = h % 12 || 12;
      }
      const hh = c.h12 ? String(h) : pad2(h);
      return { text: hh + ':' + pad2(t.getMinutes())
        + (c.secs === false ? '' : ':' + pad2(t.getSeconds())) + suffix, over: false };
    }
    const elapsed = chronoElapsed(c, now == null ? Date.now() : now);
    if (c.mode === 'timer') {
      const rem = (c.durationMs || 0) - elapsed;
      return { text: (rem < 0 ? '−' : '') + formatSpan(Math.abs(rem)), over: rem < 0 };
    }
    return { text: formatSpan(elapsed), over: false };
  }

  // ===== Sorteio (aba Ferramentas) =====
  // Mesmo desenho do cronômetro: o Controle SORTEIA e manda um descritor; os
  // dois lados apenas derivam o que mostrar. Quem sorteia tem que ser um só —
  // se cada tela rodasse o próprio `Math.random`, o telão e a preview
  // anunciariam ganhadores diferentes, que é o pior defeito possível aqui.
  //
  // O rolar dos números até assentar é local: `rollUntil` (epoch ms) diz até
  // quando rolar, e o quadro exibido é função do tempo restante. Duas
  // consequências: nenhum comando trafega durante a animação, e o telão que
  // reconectar no meio do rolo entra no MESMO quadro em que os outros estão.
  //
  // Descritor:
  //   { kind:'number'|'text', value, seed, rollUntil, min, max, pool:[...] }
  const DRAW_FRAME_MS = 70;    // ~14 quadros/s: rápido o bastante para borrar

  // PRNG determinístico (mulberry32). O ruído do rolo precisa ser IGUAL nos dois
  // lados — a preview existe para mostrar o que o telão está mostrando, e dois
  // ruídos diferentes a tornariam uma tela paralela em vez de um espelho.
  function rnd32(seed) {
    let t = (seed + 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function drawReading(d, now) {
    if (!d || d.value == null || d.value === '') return { text: '—', rolling: false };
    const t = now == null ? Date.now() : now;
    if (!d.rollUntil || t >= d.rollUntil) return { text: String(d.value), rolling: false };
    // O quadro sai do tempo QUE FALTA, não do decorrido: assim ele é uma função
    // pura de (descritor, relógio) e qualquer tela que entre agora — inclusive
    // um telão que acabou de reconectar — cai no mesmo quadro das demais.
    const frame = Math.floor((d.rollUntil - t) / DRAW_FRAME_MS);
    const r = rnd32((d.seed || 0) + frame * 7919);
    if (d.kind === 'text') {
      const pool = Array.isArray(d.pool) && d.pool.length ? d.pool : [String(d.value)];
      return { text: String(pool[Math.floor(r * pool.length)]), rolling: true };
    }
    const min = typeof d.min === 'number' ? d.min : 0;
    const max = typeof d.max === 'number' ? d.max : 99;
    return { text: String(min + Math.floor(r * (max - min + 1))), rolling: true };
  }

  createStage.CHRONO_TICK_MS = CHRONO_TICK_MS;
  createStage.chronoElapsed = chronoElapsed;
  createStage.chronoReading = chronoReading;
  // `formatSpan` deixou de ser exposto: todo uso é interno (chronoReading) —
  // grep na base inteira e em tools/. `chronoElapsed` fica: o Controle o chama
  // ao pausar o cronômetro (acumular o baseMs).
  createStage.DRAW_FRAME_MS = DRAW_FRAME_MS;
  createStage.drawReading = drawReading;
})(this);
