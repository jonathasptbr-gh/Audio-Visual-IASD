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
  // o recorte é a UNIÃO), `titulo` (o nome que está na tela), `texto` (o que é,
  // para que serve e como usar) e `semAlvo` (o texto do balão central quando a
  // peça não está à vista). `opcional`: sem a peça, o passo sai da conta.
  // `abertura`/`fecho`: o passo fica FIXO no começo/fim — ver `ordenar()`.
  const FIM = { fecho: true, titulo: 'Tour do app',
    texto: 'Para rever estas explicações, toque em "Tour do app" nas Configurações. Cada janela também volta a se explicar ao abrir.' };
  const PROJETAR = { alvo: '#miscProjectBtn', titulo: 'Projetar no telão',
    texto: 'Toque para mostrar este cartão na TV agora. O botão vira "Tirar do telão": toque nele para tirar.', opcional: true };
  const GUARDAR = { alvo: '#toolsFoot .cue-save-btn', titulo: 'Cronograma e Favoritos',
    texto: 'Toque num dos dois botões para guardar este cartão no Cronograma ou nos Favoritos e usá-lo na hora certa.', opcional: true };
  const SUBLINHA = { alvo: '#toolsBody input.misc-text', titulo: 'Legenda',
    texto: 'Digite um texto curto para aparecer embaixo do cartão na TV, como "Início do culto". Pode ficar vazio.', opcional: true };

  // OS TOURS PRINCIPAIS — um por estado da tela (`g.qual()`), só as portas.
  const TOURS = {
    conexao: [
      { alvo: '#simpleConn', abertura: true, titulo: 'Conecte uma tela',
        texto: 'Sem uma tela escolhida, o app fica parado nesta página. Escolha abaixo como vai usá-lo hoje; depois a Biblioteca aparece.',
        semAlvo: 'Sem uma tela escolhida, o app fica parado nesta página. Escolha como vai usá-lo hoje; depois a Biblioteca aparece.' },
      { alvo: '#castMirrorBtn', titulo: 'Conectar uma TV',
        texto: 'Toque e escolha na lista do celular a TV ou o adaptador sem fio. Só o que está no ar vai para a TV; os controles ficam no celular.', opcional: true },
      { alvo: '#castNetBtn', titulo: 'Conectar um computador',
        texto: 'Toque e digite, no navegador do computador, o endereço que aparece logo abaixo. Ele precisa estar no mesmo Wi-Fi.', opcional: true },
      { alvo: '#castLocalBtn', titulo: 'Tocar neste celular',
        texto: 'Sem TV hoje? Toque para usar o app só no celular, com o som saindo dele ou da caixa de som ligada a ele.', opcional: true },
    ],
    simples: [
      { alvo: ['#simpleBarra', '#libBar'], titulo: 'Biblioteca',
        texto: 'Digite o número ou o nome do hino e toque nele para pô-lo na TV. Quando tocar, a letra e os botões aparecem nesta tela.',
        semAlvo: 'Na Biblioteca, digite o número ou o nome do hino e toque nele para pô-lo na TV.' },
      { alvo: '#sorteioSimplesBtn', titulo: 'Sortear um hino',
        texto: 'Toque para o app escolher um hino do Hinário 2022 e já tocá-lo. Apagado, ainda não há hino que possa tocar.', opcional: true },
      { alvo: '#volPill', volume: true, titulo: 'Volume',
        texto: 'Aperte os botões de volume do celular: esta barra aparece na borda e mostra o nível. Toque no ícone dela para deixar mudo.',
        semAlvo: 'Aperte os botões de volume do celular: aparece uma barra na borda da tela com o nível do som.' },
      { alvo: '#simpleSettingsBtn', titulo: 'Configurações',
        texto: 'Toque na engrenagem para mudar o tema, o ajuste da TV ou o modo do app, e para abrir a verificação e o guia de sonoplastia.' },
      { alvo: '#simpleCastBtn', titulo: 'Conexão',
        texto: 'Fica colorido quando uma TV ou um computador está recebendo. Toque para trocar de tela ou desconectar.', opcional: true },
      FIM,
    ],
    // O Modo Fácil COM ALGO NO AR (a letra e as teclas à vista).
    tocando: [
      { alvo: '.simple-song', titulo: 'Letra',
        texto: 'A letra acompanha a TV, estrofe por estrofe. Role a lista com o dedo para ler o resto.' },
      { alvo: '.simple-fabs', titulo: 'A+ e A−',
        texto: 'Toque para aumentar ou diminuir a letra aqui no celular. A TV não muda.', opcional: true },
      { alvo: '#simpleSlidesRow', titulo: 'Página',
        texto: 'Toque nas setas para ir à página seguinte ou voltar uma. O número diz em qual página a TV está.', opcional: true },
      { alvo: '.simple-nowplaying', titulo: 'Tocando agora',
        texto: 'O nome do que está no ar e o tempo da música. Arraste a barra para pular para outro trecho.', opcional: true },
      { alvo: '#simpleStop', titulo: 'Parar',
        texto: 'Toque para tirar da TV o que está tocando e voltar à Biblioteca.', opcional: true },
      { alvo: '#simplePlay', titulo: 'Play/Pausa',
        texto: 'Toque para pausar a música e de novo para continuar. Pausar não tira nada da TV.', opcional: true },
      { alvo: '#simpleTela', titulo: 'Tela cheia',
        texto: 'Toque para ver no celular, em tela cheia, o que a TV está mostrando.', opcional: true },
    ],
    avancado: [
      { alvo: '#library', abertura: true, titulo: 'Cronograma',
        texto: 'A lista do culto, na ordem. Toque num item para pô-lo na TV; segure e arraste para mudar a ordem.' },
      { alvo: '#cronoTitulo', titulo: 'Nome do cronograma',
        texto: 'Toque no nome para trocar de cronograma ou criar um novo, para outro culto ou evento.' },
      { alvo: '#cronoImportar', titulo: 'Importar',
        texto: 'Toque para trazer do celular vídeos, músicas, fotos, PDF ou PowerPoint. Eles entram no Cronograma.' },
      { alvo: '#bibleBtn', titulo: 'Bíblia',
        texto: 'Toque para abrir a Bíblia e escolher livro, capítulo e versículo para mostrar na TV.' },
      { alvo: '#toolsBtn', titulo: 'Ferramentas',
        texto: 'Toque para abrir Relógio, Cronômetro, Timer, Itinerário, Mensagens e Sorteio, que aparecem em cartões na TV.' },
      { alvo: '#libBar', titulo: 'Biblioteca',
        texto: 'Toque para abrir a Biblioteca e buscar hinos, álbuns e mídias. Tocando numa música, aparecem as opções dela.',
        semAlvo: 'A Biblioteca fica logo abaixo do Cronograma: toque nela para buscar hinos, álbuns e mídias.' },
      { alvo: '#preview', titulo: 'Prévia',
        texto: 'Mostra no celular, pequeno, o que está na TV agora. As setas dos lados passam a estrofe ou a página.' },
      { alvo: ['#seek', '.transport'], titulo: 'Controles',
        texto: 'Repetir, playlist, anterior, Play/Pausa, próxima e Parar. Arraste a barra de cima para avançar ou voltar no vídeo.' },
      { alvo: '#pvCastBtn', titulo: 'Conectar uma TV',
        texto: 'Toque para escolher a TV ou o computador que vai mostrar o culto.',
        semAlvo: 'Quando nenhuma tela está conectada, aparece sobre a prévia um botão para conectar uma TV ou um computador.' },
      { alvo: '#settingsBtn', titulo: 'Configurações',
        texto: 'Toque na engrenagem para mudar o tema, o ajuste da TV ou o modo do app, e para abrir o histórico e a verificação.' },
      FIM,
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
      { alvo: '#appModeSeg', titulo: 'Modo simples e Modo avançado',
        texto: 'Toque num dos dois para trocar a tela inteira do app. O simples tem o essencial; o avançado, Cronograma, Bíblia e Ferramentas.' },
      { alvo: '#fadePopup .qs-grade', titulo: 'Botões de ajuste',
        texto: 'Toque num quadrado para mudar um ajuste, como o Tema, ou abrir um bloco, como Tela ou Verificar. Cada bloco se explica ao abrir.' },
      { alvo: '#versaoBtn', titulo: 'Número da versão',
        texto: 'Toque no número para ver o que mudou nas últimas atualizações do app.' },
      { alvo: '#contatoBtn', titulo: 'Ajuda',
        texto: 'Toque para falar pelo WhatsApp com quem mantém o app.', opcional: true },
      { alvo: '#fadePopup .cfg-ajuda', titulo: 'Tour do app e Guia de sonoplastia',
        texto: '"Tour do app" repete estas explicações e faz cada janela se explicar de novo. O guia ensina o básico do som, passo a passo.' },
    ] },
    'cfg-tela': { modos: AMBOS, passos: [
      { alvo: '#fitTile', titulo: 'Preenchimento',
        texto: 'Toque para alternar entre a mídia inteira na TV ou preenchendo a tela toda, o que pode cortar as bordas.' },
      { alvo: '#wallTile', titulo: 'Wallpaper', texto: 'Toque para escolher a imagem que cobre a TV quando nada está no ar.', opcional: true },
      { alvo: '#lyricsBgTile', titulo: 'Fundo da letra', texto: 'Toque para pôr ou tirar a imagem de fundo atrás das estrofes na TV.', opcional: true },
      { alvo: '#rotBtn', titulo: 'Girar no telão',
        texto: 'Toque para girar a mídia na TV quando ela aparece deitada. A tela do celular não gira.', opcional: true },
    ] },
    'cfg-hist': { modos: AMBOS, passos: [
      { alvo: '#histSecao', abertura: true, titulo: 'Histórico',
        texto: 'Tudo o que já foi para a TV, do mais recente ao mais antigo. Role para ver o resto.' },
      { alvo: '#histClear', titulo: 'Limpar todo o histórico',
        texto: 'Toque para apagar a lista, bom para começar outro culto. O app pede confirmação antes.', opcional: true },
    ] },
    'cfg-teste': { modos: AMBOS, passos: [
      { alvo: '#testeCorpo', abertura: true, titulo: 'Verificar',
        texto: 'Testa cada parte do app e marca o que não respondeu. Faça antes do culto, para achar um problema a tempo.' },
      { alvo: '#testeRefazer', titulo: 'Refazer', texto: 'Toque para rodar a verificação outra vez, depois de corrigir algo.', opcional: true },
      { alvo: '#testeSalvar', titulo: 'Compartilhar registro',
        texto: 'Toque para enviar o resultado, pelo app que escolher, a quem está ajudando você.', opcional: true },
    ] },
    'cfg-edicao': { modos: AMBOS, passos: [
      { alvo: '#edicaoBusca', titulo: 'Buscar pelo nome',
        texto: 'Digite o nome da mídia que quer cortar no começo ou no fim e toque nela na lista.', opcional: true },
      { alvo: '#edicaoImportar', titulo: 'Importar arquivo',
        texto: 'Toque para abrir um arquivo do celular só para cortar. Ele não entra no Cronograma nem nos Favoritos.', opcional: true },
    ] },
    'cfg-pacote': { modos: AMBOS, passos: [
      { alvo: '#pacoteExportarTile', titulo: 'Exportar',
        texto: 'Toque para salvar a biblioteca e os ajustes num arquivo. Pronto o arquivo, toque de novo para mandá-lo a outro celular.' },
      { alvo: '#pacoteImportarTile', titulo: 'Importar',
        texto: 'Toque para trazer tudo de um arquivo exportado. Só acrescenta: nada do que já existe é apagado.' },
    ] },
    conectar: { modos: AMBOS, passos: [
      { alvo: '#castMirrorBtn', titulo: 'Conectar uma TV',
        texto: 'Toque e escolha na lista do celular a TV ou o adaptador sem fio. Só o que está no ar vai para a TV.' },
      { alvo: '#castNetBtn', titulo: 'Conectar um computador',
        texto: 'Toque e digite, no navegador do computador, o endereço que aparece logo abaixo. Ele precisa estar no mesmo Wi-Fi.', opcional: true },
      { alvo: '#castLocalBtn', titulo: 'Tocar neste celular',
        texto: 'Toque para usar o app só no celular, sem TV. Toque de novo para desligar.', opcional: true },
    ] },
    biblioteca: { modos: ['full'], passos: [
      { alvo: '#hymnSearchInput', titulo: 'Buscar',
        texto: 'Digite o nome, o número ou um trecho da letra. Os resultados aparecem logo abaixo.' },
      { alvo: '#sorteioBtn', titulo: 'Playlist automática',
        texto: 'Toque para o app sortear músicas por um tema e montar uma fila. A janela se explica ao abrir.', opcional: true },
      { alvo: '#hymnSearchPopup .coll-bar-fechar', titulo: 'Álbuns',
        texto: 'Toque na seta de um álbum para abrir ou fechar as músicas dele. Toque numa música para ver as opções.', opcional: true },
      { alvo: '#hymnSearchPopup .coll-bar-dl', titulo: 'Baixar',
        texto: 'Toque para baixar o álbum inteiro e usá-lo sem internet no culto. Durante o download, o mesmo botão cancela.', opcional: true },
      { alvo: '#hymnSearchToggle', titulo: 'Fechar', texto: 'Toque para fechar a Biblioteca e voltar ao Cronograma.', opcional: true },
    ] },
    cronogramas: { modos: ['full'], passos: [
      { alvo: '#cronoGaveta .crono-trocar', titulo: 'Seus cronogramas',
        texto: 'Toque no nome de um cronograma para passar a usá-lo na tela principal.' },
      { alvo: ['#cronoGaveta .crono-renomear', '#cronoGaveta .crono-excluir'], titulo: 'Renomear e apagar',
        texto: 'Toque nos botões ao lado do nome para mudar o nome do cronograma ou apagá-lo.', opcional: true },
      { alvo: '#cronoNovo', titulo: 'Novo cronograma',
        texto: 'Toque para criar uma lista nova, para outro culto ou evento. A atual continua guardada.' },
    ] },
    biblia: { modos: ['full'], passos: [
      { alvo: '#bibleBody', abertura: true, titulo: 'Bíblia',
        texto: 'Toque no livro, depois no capítulo e no versículo para mostrá-lo na TV. As cores separam os grupos de livros.' },
      { alvo: '#bibleClose', titulo: 'Fechar',
        texto: 'Toque para fechar a Bíblia. O voltar do celular sobe um nível de cada vez.' },
    ] },
    ferramentas: { modos: ['full'], passos: [
      { alvo: ['#ferrTile_clock', '#ferrTile_stopwatch', '#ferrTile_timer'], titulo: 'Relógio, Cronômetro e Timer',
        texto: 'Toque num deles para abrir. O tempo aparece num cartão na TV.' },
      { alvo: '#ferrTile_itinerario', titulo: 'Itinerário',
        texto: 'Toque para montar os horários do culto e mostrá-los na TV, adiantando ou atrasando tudo de uma vez.' },
      { alvo: '#ferrTile_msg', titulo: 'Mensagens', texto: 'Toque para escrever avisos e mostrá-los na TV na hora certa.' },
      { alvo: '#ferrTile_draw', titulo: 'Sorteio',
        texto: 'Toque para sortear um número ou um nome de uma lista e mostrar o resultado na TV.' },
      { alvo: '#toolsFechar', titulo: 'Fechar',
        texto: 'Toque para voltar ao Cronograma. Cada ferramenta se explica na primeira vez que abrir.' },
    ] },
    'ferr-clock': { modos: ['full'], passos: [
      { alvo: '#toolsFoot .chrono-opt', titulo: 'Seg e 12h',
        texto: 'Toque em Seg para mostrar os segundos e em 12h para o formato de 12 horas.', opcional: true },
      SUBLINHA, PROJETAR, GUARDAR,
    ] },
    'ferr-stopwatch': { modos: ['full'], passos: [
      { alvo: ['#chronoRun', '#chronoZero'], titulo: 'Iniciar e Zerar',
        texto: 'Toque no botão de iniciar para contar e nele de novo para pausar. O outro botão zera a contagem.' },
      SUBLINHA, PROJETAR, GUARDAR,
    ] },
    'ferr-timer': { modos: ['full'], passos: [
      { alvo: ['#chronoRun', '#chronoZero'], titulo: 'Iniciar e Zerar',
        texto: 'Escolha o tempo nas roletas e toque no botão de iniciar. O outro botão zera e recomeça.' },
      SUBLINHA, PROJETAR, GUARDAR,
    ] },
    'ferr-itinerario': { modos: ['full'], passos: [
      { alvo: '#itinTitulo', titulo: 'Nome do itinerário',
        texto: 'Toque no nome para trocar de itinerário ou criar outro.', opcional: true },
      { alvo: ['#toolsBody .itin-passo', '#toolsBody .itin-zerar'], titulo: 'Adiantar e atrasar',
        texto: 'Toque em −5, −1, +1 ou +5 para mover todos os horários de uma vez. O último botão volta ao previsto.', opcional: true },
      { alvo: '#itinNovoBtn', titulo: 'Adicionar horário',
        texto: 'Toque para incluir uma parte do culto com a hora em que ela começa.', opcional: true },
      { alvo: '#itinHorasBtn', titulo: 'Horários na TV',
        texto: 'Toque no relógio para mostrar ou esconder as horas na TV. Sem elas, aparecem só os títulos.', opcional: true },
      PROJETAR,
    ] },
    'ferr-msg': { modos: ['full'], passos: [
      { alvo: '#msgNovaBtn', titulo: '+ Nova mensagem',
        texto: 'Toque para escrever um aviso. Depois, toque no aviso pronto para mostrá-lo na TV.' },
    ] },
    'ferr-draw': { modos: ['full'], passos: [
      { alvo: '#toolsBody textarea.draw-pool', titulo: 'Opções',
        texto: 'Escreva uma opção por linha, como nomes de pessoas. O sorteio escolhe uma delas.', opcional: true },
      { alvo: '#toolsBody input.misc-num', titulo: 'De e Até',
        texto: 'Digite o menor e o maior número. O sorteio escolhe um número entre os dois.', opcional: true },
      { alvo: '#toolsBody .misc-chip', titulo: 'Números e Não repetir',
        texto: 'Toque em Números para trocar entre números e uma lista de nomes. Com Não repetir ligado, o que saiu não sai de novo.', opcional: true },
      { alvo: ['#drawGoBtn', '#drawResetBtn'], titulo: 'Sortear e Reiniciar',
        texto: 'Toque no botão de sortear para escolher. O botão ao lado reinicia e devolve todos ao sorteio.', opcional: true },
      PROJETAR, GUARDAR,
    ] },
    sorteio: { modos: ['full'], passos: [
      { alvo: '#sorteioPopup input.lib-search', titulo: 'Palavra tema',
        texto: 'Digite uma palavra, como "graça" ou "esperança", para sortear músicas sobre ela.' },
      { alvo: '#sorteioPopup .song-menu-seg', titulo: 'Cantada ou Fundo musical',
        texto: 'Toque para escolher músicas cantadas ou só o fundo musical, sem voz.', opcional: true },
      { alvo: '#sorteioPopup .misc-chip', titulo: 'Álbuns e Só no aparelho',
        texto: 'Toque nos álbuns de onde sortear. "Só no aparelho" usa apenas o que já está baixado.', opcional: true },
      { alvo: '#sorteioPopup .sorteio-acao', titulo: 'Tocar agora e guardar',
        texto: 'Toque em Tocar agora para ouvir já, ou nos botões ao lado para sortear e guardar no Cronograma, na playlist ou nos Favoritos.', opcional: true },
    ] },
    playlist: { modos: ['full'], passos: [
      { alvo: '#plPopup .popup-sheet', abertura: true, titulo: 'Playlist',
        texto: 'Uma fila de músicas que tocam uma depois da outra, separada do Cronograma. Role para ver a fila inteira.' },
      { alvo: ['#plPack', '#plPackFav'], titulo: 'Guardar como pacote',
        texto: 'Toque num dos dois para guardar a fila inteira no Cronograma ou nos Favoritos e tocá-la de novo depois.', opcional: true },
    ] },
    letra: { modos: ['full'], passos: [
      { alvo: '#lyricsPopup .popup-sheet', abertura: true, titulo: 'Letra',
        texto: 'A letra inteira do que está tocando. Role com o dedo para ler e acompanhar o que está na TV.' },
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
    if (!passo.alvo) return [];
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

  // A ORDEM VISUAL (v1.14.3): de cima para baixo e, na mesma faixa, da esquerda
  // para a direita — medida ao ABRIR, porque a geometria muda com a tela e o modo.
  // Faixa: os centros verticais, em ordem, ficam na mesma faixa enquanto cada um
  // dista do anterior até max(LINHA_PX, metade da altura do menor dos dois).
  // Fixos: `abertura` (a moldura que apresenta a tela ou a janela) no começo, na
  // ordem declarada; `fecho` (sem alvo) no fim. Passo com a peça fora de vista
  // (vira balão central) vai para o fim, antes do fecho, na ordem declarada. A
  // pílula do volume, que o próprio passo mostra, ordena pela caixa que ocupa.
  const LINHA_PX = 24;
  function caixaParaOrdem(passo) {
    const r = retangulo(passo);
    if (r || !passo.volume) return r;
    const e = document.querySelector(passo.alvo);
    const q = e && getComputedStyle(e).display !== 'none' ? e.getBoundingClientRect() : null;
    return q && q.width >= 1 && q.height >= 1 ? q : null;
  }
  function ordenar(passos) {
    const ini = [], fim = [], soltos = [], medidos = [];
    passos.forEach((p, k) => {
      if (p.abertura) { ini.push(p); return; }
      if (p.fecho || !p.alvo) { fim.push(p); return; }
      const r = caixaParaOrdem(p);
      if (r) medidos.push({ p, k, r, cy: (r.top + r.bottom) / 2 }); else soltos.push(p);
    });
    medidos.sort((a, b) => a.cy - b.cy || a.r.left - b.r.left || a.k - b.k);
    const faixas = [];
    let ant = null;
    for (const m of medidos) {
      const tol = ant ? Math.max(LINHA_PX, Math.min(ant.r.height, m.r.height) / 2) : 0;
      if (ant && m.cy - ant.cy <= tol) faixas[faixas.length - 1].push(m); else faixas.push([m]);
      ant = m;
    }
    const meio = faixas.flatMap((f) => f.sort((a, b) => a.r.left - b.r.left || a.k - b.k)).map((m) => m.p);
    return ini.concat(meio, soltos, fim);
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
    // E a ordem é a VISUAL, medida agora (`ordenar`).
    const passos = ordenar(todos.filter((p) => !p.opcional || elementos(p).length));
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
    passoAtual: () => (atual ? atual.passos[atual.i] : null),   // o oráculo mede o passo NA ORDEM medida
    LINHA_PX,
    TOURS,
    SECOES,
    chaves,
    CHAVE,
  };
})(window);
