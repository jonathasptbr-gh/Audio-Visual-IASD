/*
 * O TOUR GUIADO (v1.14.0) — um véu com um recorte na peça e um balão curto.
 *
 * UM TOUR POR ESTADO DA TELA, e cada um só roda no próprio estado:
 *   `conexao`  — Modo Fácil com a cortina "sem tela" (só as opções de conexão);
 *   `simples`  — Modo Fácil destravado (os controles);
 *   `avancado` — Modo Avançado (a tela inteira).
 * Quem diz o estado é o `controle.js` (`AVTour.ligar({ qual, ocupado, ... })`);
 * este arquivo só lê a geometria do DOM. Ele NUNCA projeta, toca ou abre nada do
 * app: o único efeito colateral é a pílula de volume, mostrada pelo gancho
 * `volume(true)` no passo dela e escondida ao sair dele (o "desfazer" do tour).
 *
 * AUTOMÁTICO UMA VEZ POR TOUR. A marca mora em `localStorage` (`av.tour`), como a
 * `av.dicaNaoPerturbe`: é deste aparelho, lida em síncrono, e não viaja no pacote
 * de transferência. Só dispara depois de a tela ficar LIVRE (`ocupado()` falso:
 * sem cortina de abertura, diálogo, folha, gaveta ou tela cheia) por `LIVRE_MS`
 * seguidos — o diálogo de atualização e o "O que mudou" chegam um pouco depois
 * do boot. Se algo abrir no meio do tour, ele fecha e DESMARCA (volta depois).
 *
 * A CAMADA É 600: acima dos diálogos (500) e abaixo da prévia inteira e da cortina
 * de abertura — que de todo modo contam como ocupado.
 */
(function (global) {
  'use strict';

  const CHAVE = 'av.tour';
  const LIVRE_MS = 1200;
  const VIGIA_MS = 250;
  const FOLGA = 6;      // o recorte passa a peça por esta margem
  const MARGEM = 12;    // o balão nunca encosta na borda da tela
  const VAO = 10;       // entre o recorte e o balão

  // Cada passo: `alvo` (seletor ou lista — o recorte é a UNIÃO dos visíveis),
  // `titulo`, `texto`, e `semAlvo` (o texto do balão central quando a peça não
  // está à vista). `opcional`: sem a peça, o passo some da conta.
  const TOURS = {
    conexao: [
      { alvo: '#simpleConn', titulo: 'Conecte a tela',
        texto: 'Para começar, ligue o app à TV da igreja. As formas de conectar ficam aqui.',
        semAlvo: 'Para começar, ligue o app à TV da igreja pelas opções de conexão desta tela.' },
      { alvo: '#castMirrorBtn', titulo: 'Conectar uma TV',
        texto: 'Toque aqui e escolha a TV ou o adaptador na lista do celular.', opcional: true },
      { alvo: '#castNetBtn', titulo: 'Conectar um computador',
        texto: 'Mostra a tela num computador ligado ao mesmo Wi-Fi, pelo navegador.', opcional: true },
      { alvo: '#castLocalBtn', titulo: 'Tocar neste celular',
        texto: 'Sem TV hoje? Use o app só no celular, com o som saindo dele.', opcional: true },
    ],
    simples: [
      { alvo: ['#simpleBarra', '#libBar'], titulo: 'Biblioteca',
        texto: 'Procure o hino pelo número ou pelo nome e toque nele para pôr na TV.',
        semAlvo: 'A Biblioteca fica no alto da tela: procure o hino pelo número ou pelo nome.' },
      { alvo: '#sorteioSimplesBtn', titulo: 'Sortear um hino',
        texto: 'Sorteia um hino do Hinário — bom para quando pedem "um hino qualquer".', opcional: true },
      { alvo: '.simple-song', titulo: 'A letra',
        texto: 'Enquanto um hino toca, a letra aparece aqui, acompanhando o que está na TV.',
        semAlvo: 'Quando um hino estiver tocando, a letra aparece no lugar da Biblioteca, acompanhando a TV.' },
      { alvo: '.simple-keys', titulo: 'Parar, Play e Tela cheia',
        texto: 'Parar tira da TV, Play pausa ou continua, e Tela cheia mostra a TV aqui no celular.',
        semAlvo: 'Com algo tocando, aparecem embaixo os botões Parar, Play/Pausa e Tela cheia.' },
      { alvo: '#volPill', volume: true, titulo: 'Volume',
        texto: 'Use os botões de volume do celular: esta barra aparece na lateral para ajustar.',
        semAlvo: 'Use os botões de volume do celular: aparece uma barra na lateral para ajustar.' },
      { alvo: '#simpleSettingsBtn', titulo: 'Configurações',
        texto: 'Na engrenagem ficam o tema, a tela, a verificação, o guia de sonoplastia e este tour.' },
      { alvo: '#simpleCastBtn', titulo: 'Conexão',
        texto: 'Mostra a tela conectada. Toque para conectar outra ou desconectar.', opcional: true },
    ],
    avancado: [
      { alvo: '#library', titulo: 'Cronograma',
        texto: 'Esta é a lista do culto: o que vai para a TV, na ordem.' },
      { alvo: '#cronoTitulo', titulo: 'Trocar de cronograma',
        texto: 'Toque no nome para abrir outro cronograma ou criar um novo.' },
      { alvo: '#cronoImportar', titulo: 'Importar',
        texto: 'Traga do celular vídeos, músicas, fotos, PDF ou PowerPoint.' },
      { alvo: '#bibleBtn', titulo: 'Bíblia',
        texto: 'Procure livro, capítulo e versículo para mostrar o texto na TV.' },
      { alvo: '#toolsBtn', titulo: 'Ferramentas',
        texto: 'Relógio, Cronômetro, Timer, Itinerário, Mensagens e Sorteio ficam aqui.' },
      { alvo: '#libBar', titulo: 'Biblioteca',
        texto: 'Busque hinos e mídias e mande para o Cronograma.',
        semAlvo: 'A Biblioteca fica logo abaixo do Cronograma: busque hinos e mídias por ali.' },
      { alvo: '#preview', titulo: 'Prévia',
        texto: 'Mostra aqui o que está na TV agora.' },
      { alvo: ['#seek', '.transport'], titulo: 'Controles',
        texto: 'Repetir, playlist, anterior, Play/Pausa, próxima e Parar. A barrinha acima avança no vídeo.' },
      { alvo: '#pvCastBtn', titulo: 'Conectar uma tela',
        texto: 'Toque aqui para conectar uma TV ou um computador.',
        semAlvo: 'Sem tela conectada, aparece sobre a prévia um botão para conectar uma TV ou um computador.' },
      { alvo: '#settingsBtn', titulo: 'Configurações',
        texto: 'Na engrenagem ficam o tema, a tela, a verificação, o guia de sonoplastia e este tour.' },
    ],
  };

  let g = null;            // os ganchos do controle.js
  let autoTimer = null;
  let livreDesde = 0;
  let vigia = null;
  let raiz = null, recorte = null, balao = null, contEl = null, tituloEl = null, textoEl = null;
  let voltarEl = null, proximoEl = null;
  let atual = null;        // { qual, passos, i, foco, volume }
  let quadro = 0;
  let ro = null;

  function vistos() {
    try { return JSON.parse(localStorage.getItem(CHAVE) || '{}') || {}; } catch (_) { return {}; }
  }
  function marcar(qual, visto) {
    const v = vistos();
    if (visto) v[qual] = 1; else delete v[qual];
    try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch (_) { /* armazenamento bloqueado */ }
  }
  const todosVistos = () => { const v = vistos(); return Object.keys(TOURS).every((k) => v[k]); };

  function visivel(el) {
    if (!el || !el.isConnected || el.closest('[hidden]')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false;
    // fora da tela por inteiro (a folha da Biblioteca recolhida mora abaixo da borda)
    const vh = window.innerHeight, vw = window.innerWidth;
    return r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
  }
  function elementos(passo) {
    const lista = Array.isArray(passo.alvo) ? passo.alvo : [passo.alvo];
    return lista.map((s) => document.querySelector(s)).filter(visivel);
  }
  function retangulo(passo) {
    const els = elementos(passo);
    if (!els.length) return null;
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const e of els) {
      const q = e.getBoundingClientRect();
      l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
    }
    return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
  }

  function montar() {
    if (raiz) return;
    raiz = document.createElement('div');
    raiz.className = 'tour';
    raiz.id = 'tour';
    raiz.hidden = true;
    raiz.innerHTML =
      '<div class="tour-recorte" aria-hidden="true"></div>'
      + '<div class="tour-balao" role="dialog" aria-modal="true" aria-labelledby="tourTitulo" aria-describedby="tourTexto" tabindex="-1">'
      + '<div class="tour-cab"><span class="tour-cont" aria-live="polite"></span>'
      + '<button type="button" class="tour-pular">Pular</button></div>'
      + '<div class="dialog-title" id="tourTitulo"></div>'
      + '<div class="dialog-msg" id="tourTexto"></div>'
      + '<div class="dialog-actions">'
      + '<button type="button" class="dialog-btn tour-voltar">Voltar</button>'
      + '<button type="button" class="dialog-btn primary tour-proximo">Próximo</button>'
      + '</div></div>';
    document.body.appendChild(raiz);
    recorte = raiz.querySelector('.tour-recorte');
    balao = raiz.querySelector('.tour-balao');
    contEl = raiz.querySelector('.tour-cont');
    tituloEl = raiz.querySelector('#tourTitulo');
    textoEl = raiz.querySelector('#tourTexto');
    voltarEl = raiz.querySelector('.tour-voltar');
    proximoEl = raiz.querySelector('.tour-proximo');
    raiz.querySelector('.tour-pular').addEventListener('click', () => fechar());
    voltarEl.addEventListener('click', () => ir(-1));
    proximoEl.addEventListener('click', () => ir(1));
    raiz.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); fechar(); return; }
      if (e.key !== 'Tab') return;
      const f = [...balao.querySelectorAll('button:not([disabled])')];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      const n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i + 1) % f.length;
      e.preventDefault(); f[n].focus();
    });
    if (typeof ResizeObserver === 'function') ro = new ResizeObserver(() => agendar());
  }

  function agendar() {
    if (!atual || quadro) return;
    quadro = requestAnimationFrame(() => { quadro = 0; posicionar(); });
  }

  function posicionar() {
    if (!atual) return;
    const passo = atual.passos[atual.i];
    const vw = window.innerWidth;
    const vh = window.visualViewport ? Math.min(window.innerHeight, window.visualViewport.height) : window.innerHeight;
    const r = retangulo(passo);
    textoEl.textContent = r || !passo.semAlvo ? passo.texto : passo.semAlvo;
    raiz.classList.toggle('tour--centro', !r);
    const w = Math.min(340, vw - 2 * MARGEM);
    balao.style.width = w + 'px';
    balao.style.maxHeight = (vh - 2 * MARGEM) + 'px';
    const h = balao.offsetHeight;
    let left, top;
    if (!r) {
      recorte.hidden = true;
      left = (vw - w) / 2; top = Math.max(MARGEM, (vh - h) / 2);
    } else {
      const l = Math.max(0, r.left - FOLGA), t = Math.max(0, r.top - FOLGA);
      const rr = Math.min(vw, r.right + FOLGA), bb = Math.min(vh, r.bottom + FOLGA);
      recorte.hidden = false;
      recorte.style.left = l + 'px'; recorte.style.top = t + 'px';
      recorte.style.width = Math.max(0, rr - l) + 'px'; recorte.style.height = Math.max(0, bb - t) + 'px';
      const cx = (l + rr) / 2;
      left = Math.min(Math.max(MARGEM, cx - w / 2), vw - MARGEM - w);
      const abaixo = vh - MARGEM - (bb + VAO), acima = t - VAO - MARGEM;
      if (h <= abaixo) top = bb + VAO;
      else if (h <= acima) top = t - VAO - h;
      else top = abaixo >= acima ? vh - MARGEM - h : MARGEM;
      top = Math.min(Math.max(MARGEM, top), Math.max(MARGEM, vh - MARGEM - h));
    }
    balao.style.left = Math.round(left) + 'px';
    balao.style.top = Math.round(top) + 'px';
  }

  function observar() {
    if (!ro) return;
    ro.disconnect();
    ro.observe(balao);
    for (const e of elementos(atual.passos[atual.i])) ro.observe(e);
  }

  function mostrarPasso() {
    const passo = atual.passos[atual.i];
    const quer = !!passo.volume;
    if (quer !== atual.volume) { atual.volume = quer; try { g.volume && g.volume(quer); } catch (_) { /* segue */ } }
    contEl.textContent = (atual.i + 1) + ' de ' + atual.passos.length;
    tituloEl.textContent = passo.titulo;
    voltarEl.disabled = atual.i === 0;
    voltarEl.title = atual.i === 0 ? 'Este é o primeiro passo' : '';
    proximoEl.textContent = atual.i === atual.passos.length - 1 ? 'Concluir' : 'Próximo';
    const els = elementos(passo);
    const vh = window.innerHeight;
    // Peça cortada pela borda (dentro de uma lista que rola): traz para a vista.
    if (els[0]) {
      const q = els[0].getBoundingClientRect();
      if (q.top < 0 || q.bottom > vh) { try { els[0].scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) { /* segue */ } }
    }
    posicionar();
    observar();
    try { proximoEl.focus({ preventScroll: true }); } catch (_) { balao.focus(); }
  }

  function ir(d) {
    if (!atual) return;
    const n = atual.i + d;
    if (n < 0) return;
    if (n >= atual.passos.length) { fechar(); return; }
    atual.i = n;
    mostrarPasso();
  }

  function aoMudar() { agendar(); }

  function abrir(qual, auto) {
    if (!TOURS[qual] || !g) return false;
    montar();
    if (atual) fechar({ manter: true });
    // `opcional` sem a peça sai da conta antes de contar "N de M".
    const passos = TOURS[qual].filter((p) => !p.opcional || elementos(p).length);
    if (!passos.length) return false;
    atual = { qual, passos, i: 0, foco: document.activeElement, volume: false, auto: !!auto };
    marcar(qual, true);
    raiz.hidden = false;
    raiz.dataset.tour = qual;
    window.addEventListener('resize', aoMudar);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', aoMudar);
    document.addEventListener('transitionend', aoMudar, true);
    document.addEventListener('scroll', aoMudar, true);
    vigia = setInterval(vigiar, VIGIA_MS);
    mostrarPasso();
    return true;
  }

  // `desmarcar`: fechou por COLISÃO (algo abriu por cima) — o automático volta depois.
  function fechar(opts) {
    if (!atual) return false;
    const o = opts || {};
    const era = atual;
    atual = null;
    if (era.volume) { try { g.volume && g.volume(false); } catch (_) { /* segue */ } }
    if (o.desmarcar && era.auto) marcar(era.qual, false);
    clearInterval(vigia); vigia = null;
    if (quadro) { cancelAnimationFrame(quadro); quadro = 0; }
    if (ro) ro.disconnect();
    window.removeEventListener('resize', aoMudar);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', aoMudar);
    document.removeEventListener('transitionend', aoMudar, true);
    document.removeEventListener('scroll', aoMudar, true);
    if (o.manter) return true;
    raiz.hidden = true;
    delete raiz.dataset.tour;
    try { if (era.foco && era.foco.isConnected && era.foco.focus) era.foco.focus({ preventScroll: true }); } catch (_) { /* segue */ }
    armar();
    return true;
  }

  function vigiar() {
    if (!atual) return;
    let qual = null, ocupado = false;
    try { qual = g.qual(); ocupado = g.ocupado(); } catch (_) { /* segue */ }
    if (ocupado) { fechar({ desmarcar: true }); return; }
    if (qual !== atual.qual) { fechar(); return; }
    posicionar();
  }

  function tique() {
    if (atual) return;
    if (todosVistos()) { clearInterval(autoTimer); autoTimer = null; return; }
    let qual = null, ocupado = true;
    try { qual = g.qual(); ocupado = g.ocupado(); } catch (_) { /* segue */ }
    if (!qual || ocupado || vistos()[qual]) { livreDesde = 0; return; }
    const agora = Date.now();
    if (!livreDesde) { livreDesde = agora; return; }
    if (agora - livreDesde >= LIVRE_MS) { livreDesde = 0; abrir(qual, true); }
  }

  function armar() {
    if (!g || autoTimer || todosVistos()) return;
    livreDesde = 0;
    autoTimer = setInterval(tique, 300);
  }

  // O botão de Configurações: refaz o tour do estado ATUAL. Quem o chama já
  // mandou fechar a folha; aqui se espera a tela ficar livre (até 3 s).
  function refazer() {
    if (!g) return;
    const ate = Date.now() + 3000;
    (function tentar() {
      let ocupado = true;
      try { ocupado = g.ocupado(); } catch (_) { /* segue */ }
      if (!ocupado) { abrir(g.qual()); return; }
      if (Date.now() < ate) setTimeout(tentar, 100);
    })();
  }

  function ligar(ganchos) {
    g = ganchos;
    armar();
  }

  global.AVTour = {
    ligar,
    refazer,
    abrir,
    fechar: () => fechar(),
    aberto: () => !!atual,
    estado: () => (atual ? { qual: atual.qual, passo: atual.i, total: atual.passos.length } : null),
    TOURS,
    CHAVE,
  };
})(window);
