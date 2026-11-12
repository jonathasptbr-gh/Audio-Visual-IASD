/*
 * O TOUR GUIADO (v1.14.0) — um véu com um recorte na peça e um balão curto.
 *
 * UM TOUR PRINCIPAL POR ESTADO DA TELA, e cada um só roda no próprio estado:
 *   `conexao`  — Modo Fácil com a cortina "sem tela" (só as opções de conexão);
 *   `simples`  — Modo Fácil destravado, na Biblioteca (as portas);
 *   `tocando`  — Modo Fácil com algo no ar (a letra e as teclas);
 *   `avancado` — Modo Avançado (as portas da tela inteira).
 * E UM TOUR POR SEÇÃO (`SECOES`): na primeira vez que o operador abre uma janela,
 * folha ou gaveta, ela se explica por dentro. O tour nunca abre nada.
 * Quem diz o estado é o `controle.js` (`AVTour.ligar({ qual, ocupado, secao,
 * bloqueio, modo, volume })`);
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
  const SECAO_MS = 700;   // a janela acabou de abrir: espera ela assentar
  const VIGIA_MS = 250;
  const FOLGA = 6;      // o recorte passa a peça por esta margem
  const MARGEM = 12;    // o balão nunca encosta na borda da tela
  const VAO = 10;       // entre o recorte e o balão

  // Cada passo: `alvo` (seletor ou lista; TODAS as ocorrências visíveis entram —
  // o recorte é a UNIÃO), `titulo`, `texto`, e `semAlvo` (o texto do balão central
  // quando a peça não está à vista). `opcional`: sem a peça, o passo sai da conta.
  const FIM = 'Em Configurações, "Tour do app" mostra isto de novo — e cada janela volta a se explicar.';
  const PROJETAR = { alvo: '#miscProjectBtn', titulo: 'Projetar', texto: 'Mostra este cartão na TV agora.', opcional: true };
  const GUARDAR = { alvo: '#toolsBody .cue-save-btn', titulo: 'Guardar',
    texto: 'Adicione ao Cronograma ou aos Favoritos para usar na hora certa.', opcional: true };
  const SUBLINHA = { alvo: '#toolsBody input.misc-text', titulo: 'Sublinha',
    texto: 'Um texto pequeno que aparece embaixo do cartão na TV.', opcional: true };

  // OS TOURS PRINCIPAIS — um por estado da tela (`g.qual()`), só as portas.
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
        texto: 'Procure o hino pelo número ou pelo nome e toque nele para pôr na TV. Quando tocar, eu mostro a letra e os botões.',
        semAlvo: 'A Biblioteca fica no alto da tela: procure o hino pelo número ou pelo nome.' },
      { alvo: '#sorteioSimplesBtn', titulo: 'Sortear um hino',
        texto: 'Sorteia um hino do Hinário — bom para quando pedem "um hino qualquer".', opcional: true },
      { alvo: '#volPill', volume: true, titulo: 'Volume',
        texto: 'Use os botões de volume do celular: esta barra aparece na lateral para ajustar.',
        semAlvo: 'Use os botões de volume do celular: aparece uma barra na lateral para ajustar.' },
      { alvo: '#simpleSettingsBtn', titulo: 'Configurações',
        texto: 'Tema, tela, verificação e o guia de sonoplastia. ' + FIM },
      { alvo: '#simpleCastBtn', titulo: 'Conexão',
        texto: 'Mostra a tela conectada. Toque para conectar outra ou desconectar.', opcional: true },
    ],
    // O Modo Fácil COM ALGO NO AR (a letra e as teclas à vista).
    tocando: [
      { alvo: '.simple-song', titulo: 'A letra',
        texto: 'A letra acompanha o que está na TV. Role para ler o resto.' },
      { alvo: '.simple-fabs', titulo: 'Tamanho da letra',
        texto: 'Aumente ou diminua a letra aqui no celular (a TV não muda).', opcional: true },
      { alvo: '#simpleSlidesRow', titulo: 'Páginas',
        texto: 'Passe para a página seguinte ou volte uma.', opcional: true },
      { alvo: '.simple-nowplaying', titulo: 'Tocando agora',
        texto: 'O nome do que está no ar e o tempo que falta.', opcional: true },
      { alvo: '#simpleStop', titulo: 'Parar',
        texto: 'Tira da TV o que está tocando e volta para a Biblioteca.', opcional: true },
      { alvo: '#simplePlay', titulo: 'Play/Pausa',
        texto: 'Pausa ou continua, sem tirar da TV.', opcional: true },
      { alvo: '#simpleTela', titulo: 'Tela cheia',
        texto: 'Mostra aqui no celular, em tela cheia, o que está na TV.', opcional: true },
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
        texto: 'Relógio, Cronômetro, Timer, Itinerário, Mensagens e Sorteio. Ao abrir, cada uma se explica.' },
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
        texto: 'Tema, tela, verificação e o guia de sonoplastia. ' + FIM },
    ],
  };
  const MODO_DO_TOUR = { conexao: 'simple', simples: 'simple', tocando: 'simple', avancado: 'full' };

  // OS TOURS DE SEÇÃO — automáticos na PRIMEIRA ABERTURA de cada janela, folha ou
  // gaveta (`g.secao()` diz qual está por cima). O tour nunca abre nada: o gatilho
  // é o operador abrir. `modos`: em que modo a seção existe (o reset do botão
  // zera as do modo atual).
  const AMBOS = ['simple', 'full'];
  const SECOES = {
    configuracoes: { modos: AMBOS, passos: [
      { alvo: '#appModeSeg', titulo: 'Modo do app',
        texto: 'Simples ou avançado: troca a tela inteira do app.' },
      { alvo: '#fadePopup .qs-grade', titulo: 'Atalhos',
        texto: 'Tema, tela, histórico, verificação e mais. Os que abrem um bloco se explicam ao abrir.' },
      { alvo: '#versaoBtn', titulo: 'Versão',
        texto: 'Toque no número para ver o que mudou nas últimas versões.' },
      { alvo: '#contatoBtn', titulo: 'Ajuda',
        texto: 'Fala com quem mantém o app, pelo WhatsApp.', opcional: true },
      { alvo: '#fadePopup .cfg-ajuda', titulo: 'Tour e guia',
        texto: '"Tour do app" mostra os tours de novo; o guia ensina o básico de sonoplastia.' },
    ] },
    'cfg-tela': { modos: AMBOS, passos: [
      { alvo: '#fitTile', titulo: 'Enquadrar', texto: 'Como a mídia ocupa a TV: inteira ou preenchendo a tela.' },
      { alvo: '#wallTile', titulo: 'Fundo', texto: 'A imagem da TV quando nada está no ar.', opcional: true },
      { alvo: '#lyricsBgTile', titulo: 'Fundo da letra', texto: 'Põe ou tira a imagem atrás da letra na TV.', opcional: true },
      { alvo: '#rotBtn', titulo: 'Girar', texto: 'Gira a mídia na TV. Não gira o celular.', opcional: true },
    ] },
    'cfg-hist': { modos: AMBOS, passos: [
      { alvo: '#histSecao', titulo: 'Histórico', texto: 'O que já foi para a TV, do mais recente ao mais antigo.' },
      { alvo: '#histClear', titulo: 'Limpar', texto: 'Apaga o histórico quando começar outro culto.', opcional: true },
    ] },
    'cfg-teste': { modos: AMBOS, passos: [
      { alvo: '#testeCorpo', titulo: 'Verificação', texto: 'Testa cada parte do app e mostra o que não respondeu.' },
      { alvo: '#testeRefazer', titulo: 'De novo', texto: 'Faz a verificação outra vez.', opcional: true },
      { alvo: '#testeSalvar', titulo: 'Compartilhar', texto: 'Manda o registro para quem está ajudando você.', opcional: true },
    ] },
    'cfg-edicao': { modos: AMBOS, passos: [
      { alvo: '#edicaoBusca', titulo: 'Editar mídia', texto: 'Ache a mídia que quer cortar no começo ou no fim.', opcional: true },
      { alvo: '#edicaoImportar', titulo: 'Arquivo de fora', texto: 'Ou traga um arquivo do celular só para cortar.', opcional: true },
    ] },
    'cfg-pacote': { modos: AMBOS, passos: [
      { alvo: '#pacoteExportarTile', titulo: 'Exportar', texto: 'Salva a biblioteca e os ajustes num arquivo, para outro celular.' },
      { alvo: '#pacoteImportarTile', titulo: 'Importar', texto: 'Traz tudo de um arquivo. Só acrescenta: nada do que já existe é apagado.' },
    ] },
    conectar: { modos: AMBOS, passos: [
      { alvo: '#castMirrorBtn', titulo: 'Conectar uma TV', texto: 'Escolha a TV ou o adaptador na lista do celular.' },
      { alvo: '#castNetBtn', titulo: 'Conectar um computador',
        texto: 'Mostra a tela num computador no mesmo Wi-Fi, pelo navegador.', opcional: true },
      { alvo: '#castLocalBtn', titulo: 'Tocar neste celular', texto: 'Usa o app só no celular, sem TV.', opcional: true },
    ] },
    biblioteca: { modos: ['full'], passos: [
      { alvo: '#hymnSearchInput', titulo: 'Buscar', texto: 'Procure pelo nome, pelo número ou por um trecho da letra.' },
      { alvo: '#sorteioBtn', titulo: 'Playlist automática', texto: 'Sorteia músicas por tema. Ao abrir, eu explico.', opcional: true },
      { alvo: '#hymnSearchPopup .coll-bar-fechar', titulo: 'Álbuns',
        texto: 'Toque num álbum para ver as músicas; toque numa música para as opções.', opcional: true },
      { alvo: '#hymnSearchPopup .coll-bar-dl', titulo: 'Baixar',
        texto: 'Baixe um álbum para usar sem internet no culto.', opcional: true },
      { alvo: '#hymnSearchToggle', titulo: 'Fechar', texto: 'Fecha a Biblioteca e volta ao Cronograma.', opcional: true },
    ] },
    cronogramas: { modos: ['full'], passos: [
      { alvo: '#cronoGaveta .crono-trocar', titulo: 'Seus cronogramas', texto: 'Toque num cronograma para usá-lo.' },
      { alvo: ['#cronoGaveta .crono-renomear', '#cronoGaveta .crono-excluir'], titulo: 'Renomear e apagar',
        texto: 'Mude o nome ou apague um cronograma.', opcional: true },
      { alvo: '#cronoNovo', titulo: 'Novo cronograma', texto: 'Cria uma lista à parte, para outro culto ou evento.' },
    ] },
    biblia: { modos: ['full'], passos: [
      { alvo: '#bibleBody', titulo: 'Bíblia',
        texto: 'Toque no livro, depois no capítulo e nos versículos para mostrar na TV. As cores separam os grupos.' },
      { alvo: '#bibleClose', titulo: 'Fechar', texto: 'Fecha a Bíblia. O voltar do celular sobe um nível de cada vez.' },
    ] },
    ferramentas: { modos: ['full'], passos: [
      { alvo: ['#ferrTile_clock', '#ferrTile_stopwatch', '#ferrTile_timer'], titulo: 'Tempo',
        texto: 'Relógio, Cronômetro e Timer, em cartão na TV.' },
      { alvo: '#ferrTile_itinerario', titulo: 'Itinerário', texto: 'Os horários do culto, com atraso ou adiantamento.' },
      { alvo: '#ferrTile_msg', titulo: 'Mensagens', texto: 'Avisos de texto prontos para a TV.' },
      { alvo: '#ferrTile_draw', titulo: 'Sorteio', texto: 'Sorteia números e mostra o resultado na TV.' },
      { alvo: '#toolsFechar', titulo: 'Fechar', texto: 'Volta ao Cronograma. Cada ferramenta se explica ao abrir.' },
    ] },
    'ferr-clock': { modos: ['full'], passos: [
      { alvo: '#toolsBody .chrono-opt', titulo: 'Relógio', texto: 'Mostre os segundos ou use o formato de 12 horas.', opcional: true },
      SUBLINHA, PROJETAR, GUARDAR,
    ] },
    'ferr-stopwatch': { modos: ['full'], passos: [
      { alvo: ['#chronoRun', '#chronoZero'], titulo: 'Cronômetro', texto: 'Iniciar começa a contar; Zerar volta ao começo.' },
      SUBLINHA, PROJETAR, GUARDAR,
    ] },
    'ferr-timer': { modos: ['full'], passos: [
      { alvo: ['#chronoRun', '#chronoZero'], titulo: 'Timer',
        texto: 'Escolha o tempo nas roletas e toque em Iniciar; Zerar recomeça.' },
      SUBLINHA, PROJETAR, GUARDAR,
    ] },
    'ferr-itinerario': { modos: ['full'], passos: [
      { alvo: '#itinTitulo', titulo: 'Itinerário', texto: 'Toque no nome para trocar de itinerário ou criar outro.', opcional: true },
      { alvo: ['#toolsBody .itin-passo', '#toolsBody .itin-zerar'], titulo: 'Atraso',
        texto: 'Adiante ou atrase todos os horários de uma vez, ou volte ao previsto.', opcional: true },
      { alvo: '#itinNovoBtn', titulo: 'Horários', texto: 'Adicione cada parte do culto com a sua hora.', opcional: true },
      { alvo: '#itinHorasBtn', titulo: 'Na TV', texto: 'Mostra ou esconde os horários na TV.', opcional: true },
      PROJETAR,
    ] },
    'ferr-msg': { modos: ['full'], passos: [
      { alvo: '#msgNovaBtn', titulo: 'Mensagens', texto: 'Crie um aviso; depois toque nele para mostrar na TV.' },
    ] },
    'ferr-draw': { modos: ['full'], passos: [
      { alvo: '#toolsBody input.misc-num', titulo: 'De… até…', texto: 'Escolha entre quais números sortear.', opcional: true },
      { alvo: '#toolsBody .misc-chip', titulo: 'Não repetir', texto: 'Ligado, um número sorteado não sai de novo.', opcional: true },
      { alvo: ['#drawGoBtn', '#drawResetBtn'], titulo: 'Sortear', texto: 'Sortear escolhe um número; o botão ao lado recomeça.', opcional: true },
      PROJETAR, GUARDAR,
    ] },
    sorteio: { modos: ['full'], passos: [
      { alvo: '#sorteioPopup input.lib-search', titulo: 'Tema', texto: 'Digite uma palavra tema, como "graça" ou "esperança".' },
      { alvo: '#sorteioPopup .song-menu-seg', titulo: 'Cantada ou fundo', texto: 'Escolha música cantada ou só o fundo musical.', opcional: true },
      { alvo: '#sorteioPopup .misc-chip', titulo: 'De onde sortear', texto: 'Escolha os álbuns e se vale só o que já está baixado.', opcional: true },
      { alvo: '#sorteioPopup .sorteio-acao', titulo: 'O que fazer',
        texto: 'Tocar agora, ou sortear e guardar no Cronograma, na playlist ou nos favoritos.', opcional: true },
    ] },
    playlist: { modos: ['full'], passos: [
      { alvo: '#plPopup .popup-sheet', titulo: 'Playlist', texto: 'Uma fila de músicas para tocar em sequência, à parte do Cronograma.' },
      { alvo: ['#plPack', '#plPackFav'], titulo: 'Guardar a fila', texto: 'Guarde a fila como pacote para usar de novo.', opcional: true },
    ] },
    letra: { modos: ['full'], passos: [
      { alvo: '#lyricsPopup .popup-sheet', titulo: 'Letra', texto: 'A letra completa, para ler e acompanhar o que está na TV.' },
    ] },
  };
  const CHAVE_SECAO = (s) => 's.' + s;

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
  // As chaves de "já visto": o nome do tour principal, ou `s.<seção>`.
  const chaves = () => Object.keys(TOURS).concat(Object.keys(SECOES).map(CHAVE_SECAO));
  const passosDe = (id) => (id.startsWith('s.') ? (SECOES[id.slice(2)] || {}).passos : TOURS[id]);

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
    const els = [];
    for (const q of lista) for (const e of document.querySelectorAll(q)) if (visivel(e)) els.push(e);
    return els;
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

  // `qual` é a chave: o nome do tour principal ou `s.<seção>`.
  function abrir(qual, auto) {
    const todos = passosDe(qual);
    if (!todos || !g) return false;
    montar();
    if (atual) fechar({ manter: true });
    // `opcional` sem a peça sai da conta antes de contar "N de M".
    const passos = todos.filter((p) => !p.opcional || elementos(p).length);
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

  // O estado que vale para o tour aberto: a seção por cima (tour de seção) ou o
  // estado da tela (tour principal). Mudou, ele fecha; algo por cima, fecha e
  // devolve o automático à fila.
  function vigiar() {
    if (!atual) return;
    const secao = atual.qual.startsWith('s.');
    let qual = null, ocupado = false;
    try {
      if (secao) { const s2 = g.secao(); qual = s2 ? CHAVE_SECAO(s2) : null; ocupado = g.bloqueio(); }
      else { qual = g.qual(); ocupado = g.ocupado(); }
    } catch (_) { /* segue */ }
    if (ocupado) { fechar({ desmarcar: true }); return; }
    if (qual !== atual.qual) { fechar(); return; }
    posicionar();
  }

  // O candidato de agora: a SEÇÃO aberta por cima (se tiver tour e não foi vista)
  // ou, com a tela livre, o tour principal do estado.
  function candidato() {
    const v = vistos();
    const sec = g.secao();
    if (sec) {
      const k = CHAVE_SECAO(sec);
      return SECOES[sec] && !v[k] && !g.bloqueio() ? k : null;
    }
    const qual = g.qual();
    return qual && !v[qual] && !g.ocupado() ? qual : null;
  }
  let candidatoAntes = null;
  function tique() {
    if (atual) return;
    const v = vistos();
    if (chaves().every((k) => v[k])) { clearInterval(autoTimer); autoTimer = null; return; }
    let qual = null;
    try { qual = candidato(); } catch (_) { qual = null; }
    if (qual !== candidatoAntes) { candidatoAntes = qual; livreDesde = 0; }
    if (!qual) { livreDesde = 0; return; }
    const agora = Date.now();
    if (!livreDesde) { livreDesde = agora; return; }
    if (agora - livreDesde >= (qual.startsWith('s.') ? SECAO_MS : LIVRE_MS)) { livreDesde = 0; abrir(qual, true); }
  }

  function armar() {
    const v = vistos();
    if (!g || autoTimer || chaves().every((k) => v[k])) return;
    livreDesde = 0;
    autoTimer = setInterval(tique, 300);
  }

  // O botão de Configurações: refaz o tour do estado ATUAL. Quem o chama já
  // mandou fechar a folha; aqui se espera a tela ficar livre (até 3 s).
  //
  // E ZERA O MODO ATUAL: os outros tours principais do modo e TODAS as seções que
  // existem nele voltam a ser "não vistos" — cada janela se explica de novo na
  // próxima vez que for aberta.
  function refazer() {
    if (!g) return;
    const modo = g.modo();
    const v = vistos();
    for (const k of Object.keys(TOURS)) if (MODO_DO_TOUR[k] === modo) delete v[k];
    for (const k of Object.keys(SECOES)) if (SECOES[k].modos.includes(modo)) delete v[CHAVE_SECAO(k)];
    try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch (_) { /* armazenamento bloqueado */ }
    armar();
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
    armar,   // religa o automático depois de alguém mexer nas marcas (`av.tour`)
    abrir,
    fechar: () => fechar(),
    aberto: () => !!atual,
    estado: () => (atual ? { qual: atual.qual, passo: atual.i, total: atual.passos.length } : null),
    TOURS,
    SECOES,
    chaves,
    CHAVE,
  };
})(window);
