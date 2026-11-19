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
 * O TOUR SE DESLIGA POR INTEIRO (v1.14.5): `av.tour.off` = '1'. Desligado, nenhum
 * tour abre sozinho (os principais e os de seção); só `refazer()` e `abrir()` à mão.
 * Quem desliga é o "Pular tour" do balão e o quadrado "Tour do app" de
 * Configurações (`desativar()`/`refazer()`); ele avisa a mudança pelo evento
 * `av-tour-ativo`.
 *
 * AUTOMÁTICO UMA VEZ POR TOUR. A marca mora em `localStorage` (`av.tour`), como a
 * `av.dicaNaoPerturbe`: é deste aparelho, lida em síncrono, e não viaja no pacote
 * de transferência. Só dispara depois de a tela ficar LIVRE (`ocupado()` falso:
 * sem cortina de abertura, diálogo, folha, gaveta ou tela cheia) por `LIVRE_MS`
 * seguidos — o diálogo de atualização e o "O que mudou" chegam um pouco depois
 * do boot. Se algo abrir no meio do tour, ele fecha e DESMARCA (volta depois).
 *
 * A PERGUNTA VEM ANTES (Pacote 45): o automático não abre o tour — ele PEDE, pelo
 * gancho `perguntar(qual)`, que o `controle.js` resolve com a janela do app
 * ("Fazer o tour" / "Agora não"). "Fazer o tour" abre o tour; "Agora não" grava a
 * MESMA marca `av.tour` e a janela não pergunta de novo naquele estado, como o
 * tour não se repete. É uma pergunta por estado, e ela é o único caminho do
 * automático: `refazer()` e `abrir()` à mão não perguntam.
 *
 * A CAMADA É 600 (`.tour` no `controle.css`): acima dos diálogos (`.dialog-backdrop`,
 * 300) e da cortina de abertura (`#splash`, 500), abaixo da prévia inteira
 * (2147483000, popover no top layer). A cortina e a prévia contam como ocupado: o
 * tour nunca abre por cima delas.
 */
(function (global) {
  'use strict';

  const CHAVE = 'av.tour';
  const CHAVE_OFF = 'av.tour.off';   // '1' = o operador desligou o tour por inteiro
  const LIVRE_MS = 1200;
  const SECAO_MS = 700;   // a janela acabou de abrir: espera ela assentar
  const VIGIA_MS = 250;
  const FOLGA = 6;      // o recorte passa a peça por esta margem
  const MARGEM = 16;    // o balão nunca encosta na borda da tela
  const ANEL = 2;       // a espessura do anel azul (`box-shadow: 0 0 0 2px`), desenhada POR FORA
  const VAO = 10;       // entre o recorte e o balão

  // A ÁREA VISÍVEL é a do `visualViewport` quando ele existe: com o teclado ou a
  // barra do navegador, a janela de layout não é o que o olho vê, e o recorte e o
  // balão têm de caber no que está à vista. Sem ele, a janela.
  function areaVisivel() {
    const vv = window.visualViewport;
    return {
      w: Math.round(vv && vv.width ? Math.min(window.innerWidth, vv.width) : window.innerWidth),
      h: Math.round(vv && vv.height ? Math.min(window.innerHeight, vv.height) : window.innerHeight),
    };
  }

  // Cada passo: `alvo` (seletor ou lista; UMA peça por seletor, e `todos: true`
  // quando o passo explica o conjunto inteiro — aí o recorte é a UNIÃO), `titulo`
  // (o nome que está na tela), `texto` (o que é, para que serve e como usar) e
  // `semAlvo` (o texto do balão central quando a peça não está à vista).
  // `opcional`: sem a peça, o passo sai da conta.
  // `abertura`/`fecho`: o passo fica FIXO no começo/fim — ver `ordenar()`.
  const FIM = { fecho: true, titulo: 'Tour do app',
    texto: 'Para rever estas explicações, desligue e ligue de novo o quadrado "Tour do app" nas Configurações. "Pular tour" desliga o tour de vez.' };
  // AS TRÊS SAÍDAS DO RODAPÉ DAS FERRAMENTAS num passo só (v1.14.20): o "Projetar no telão" e os
  // dois quadrados de guardar (Cronograma e Favoritos) são a mesma fileira, e o recorte é a união
  // deles (`todos`). Um texto para as ferramentas que têm rodapé (Relógio, Cronômetro, Timer e Sorteio); cada tour acrescenta o que
  // é dele.
  const SAIDAS = { alvo: ['#miscProjectBtn', '#toolsFoot .cue-save-btn'], todos: true, titulo: 'Telão, Cronograma e Favoritos',
    texto: 'Toque em "Projetar no telão" para mostrar este cartão na TV agora; o botão vira "Tirar do telão". Os dois quadrados ao lado guardam o cartão no Cronograma ou nos Favoritos, para usar na hora certa.', opcional: true };
  const SUBLINHA = { alvo: '#toolsBody input.misc-text', titulo: 'Legenda',
    texto: 'Digite um texto curto para aparecer embaixo do cartão na TV, como "Início do culto". Pode ficar vazio.', opcional: true };
  // AS TRÊS PORTAS DE CONEXÃO: as mesmas peças na cortina "sem tela" do Fácil
  // (`TOURS.conexao`) e na janela de conexão (`SECOES.conectar`). Cada tour acrescenta
  // o que muda com o lugar: o texto do "Tocar neste celular" (na cortina ele é a
  // saída sem TV; na janela, um interruptor) e o `opcional` da TV.
  const PORTA_TV = { alvo: '#castMirrorBtn', titulo: 'Conectar uma TV',
    texto: 'Toque e escolha na lista do celular a TV ou o adaptador sem fio. Só o que está no ar vai para a TV; os controles ficam no celular.' };
  const PORTA_PC = { alvo: '#castNetBtn', titulo: 'Conectar um computador',
    texto: 'Toque e digite, no navegador do computador, o endereço que aparece logo abaixo. Ele precisa estar no mesmo Wi-Fi.', opcional: true };
  const PORTA_CELULAR = { alvo: '#castLocalBtn', titulo: 'Tocar neste celular', opcional: true };

  // OS TOURS PRINCIPAIS — um por estado da tela (`g.qual()`), só as portas.
  const TOURS = {
    conexao: [
      { alvo: '#simpleConn', abertura: true, titulo: 'Conecte uma tela',
        texto: 'Sem uma tela escolhida, o app fica parado nesta página. Escolha abaixo como vai usá-lo hoje; depois a Biblioteca aparece.',
        semAlvo: 'Sem uma tela escolhida, o app fica parado nesta página. Escolha como vai usá-lo hoje; depois a Biblioteca aparece.' },
      Object.assign({}, PORTA_TV, { opcional: true }),
      PORTA_PC,
      Object.assign({}, PORTA_CELULAR, {
        texto: 'Sem TV hoje? Toque para usar o app só no celular, com o som saindo dele ou da caixa de som ligada a ele.' }),
    ],
    simples: [
      { alvo: ['#simpleBarra', '#libBar'], titulo: 'Biblioteca',
        texto: 'A Biblioteca fica aberta nesta tela. Digite o número ou o nome do hino, ou escolha nas listas abaixo, e toque nele para pô-lo na TV. Quando tocar, a letra e os botões aparecem aqui.',
        semAlvo: 'Na Biblioteca, digite o número ou o nome do hino e toque nele para pô-lo na TV.' },
      // A JANELA ABERTA (v1.14.20): a lista que ela mostra tem passo por seção — a Liturgia do
      // sábado, o cartão de coleção, as barras do catálogo e a seta de download. Todos `opcional`:
      // a Liturgia só existe no app, as barras vêm da rede e a seta some com a coleção completa. O
      // tour não abre nada (os cartões nascem fechados): cada passo aponta o que já está à vista, e
      // o toque que toca e o download de uma música avulsa vão no texto dos passos que têm peça em
      // qualquer instalação (o cartão e a seta).
      { alvo: '#hymnResults .semana-raiz', titulo: 'Liturgia',
        texto: 'Os itens fixos do culto deste sábado: vídeos da semana e hinos, na ordem. Toque numa linha e ela toca na TV na hora.', opcional: true },
      { alvo: '#hymnResults .hymnal-card > .coll-bar', titulo: 'Coleções',
        texto: 'Cada cartão é uma coleção, como o Hinário Adventista 2022. Toque na seta para abrir as músicas; tocar numa delas a põe na TV na hora, sem abrir opções (no modo Avançado, o toque abre as opções).', opcional: true },
      { alvo: '#hymnResults .coll-group-bar', todos: true, titulo: 'Seções',
        texto: 'Cada barra reúne álbuns de um mesmo tipo. Toque nela para abri-la (só uma fica aberta por vez). A seta de download, quando aparece, baixa todos os álbuns da barra.', opcional: true },
      { alvo: '#hymnResults .coll-bar-dl:not(.coll-bar-rm)', titulo: 'Baixar',
        texto: 'A seta de download de um cartão baixa a coleção inteira, para ouvir sem internet; enquanto baixa, o mesmo botão cancela. Uma música avulsa baixa quando você toca nela (na primeira vez o app pergunta antes).', opcional: true },
      { alvo: '#hymnResults .lib-importar-btn', titulo: 'Buscar na galeria',
        texto: 'O botão no fim da lista: toque para escolher uma foto, um vídeo ou uma música do celular. Ele vai direto para a TV.', opcional: true },
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
      { alvo: '#itinBarBtn', titulo: 'Itinerário',
        texto: 'Os momentos do culto ficam na lista, com a hora de cada um; arraste as mídias para debaixo deles. Toque aqui para abrir as opções: mostrar a lista na TV, ocultar os momentos da lista, esconder as horas, adiantar ou atrasar tudo de uma vez e adicionar um momento.',
        opcional: true },
      { alvo: '#bibleBtn', titulo: 'Bíblia',
        texto: 'Toque para abrir a Bíblia e escolher livro, capítulo e versículo para mostrar na TV.' },
      { alvo: '#toolsBtn', titulo: 'Ferramentas',
        texto: 'Toque para abrir Relógio, Cronômetro, Timer, Mensagens e Sorteio, que aparecem em cartões na TV.' },
      { alvo: '#libBar', titulo: 'Biblioteca',
        texto: 'Toque para abrir a Biblioteca e buscar hinos, álbuns e mídias. Tocando numa música, aparecem as opções dela. No fim dela, o botão Importar arquivo traz do celular vídeos, músicas, fotos, PDF ou PowerPoint.',
        semAlvo: 'A Biblioteca fica logo abaixo do Cronograma: toque nela para buscar hinos, álbuns e mídias.' },
      // OS CONTROLES, UM A UM (v1.14.20): eram um passo só ("Controles"). A barra de progresso, a
      // prévia com as duas setas, o grupo de tocar e os exclusivos do Avançado, cada um com o balão
      // dele. O grupo de tocar NÃO leva o repetir nem a playlist: eles abrem a mesma fileira, e a
      // união de todos recortaria os dois por baixo. Nenhum é `opcional`: são HTML estático do deck e
      // só ficam apagados sem mídia (`visivel()` não conta `disabled`).
      { alvo: '.np-seek', titulo: 'Barra de progresso',
        texto: 'Mostra em que ponto está a música ou o vídeo, com o tempo de cada lado. Arraste para avançar ou voltar; fica apagada enquanto nada toca.' },
      { alvo: ['#slidePrevBtn', '#preview', '#slideNextBtn'], titulo: 'Prévia e setas',
        texto: 'A prévia mostra, pequeno, o que está na TV agora. As setas dos lados passam a estrofe, a página ou o versículo.' },
      { alvo: ['#prev', '#playpause', '#next', '#stop'], titulo: 'Anterior, Play/Pausa, Próxima e Parar',
        texto: 'Anterior e Próxima trocam de mídia na fila, Play/Pausa pausa e continua, e Parar tira da TV o que está no ar.' },
      { alvo: '#plBtn', titulo: 'Playlist',
        texto: 'Abre a fila de músicas que tocam uma depois da outra. O número no botão diz quantas há.' },
      { alvo: '#repeat', titulo: 'Repetição',
        texto: 'Cada toque troca o modo: sem repetição, repetir esta mídia, repetir a playlist inteira ou aleatório.' },
      { alvo: '#lyricsViewBtn', titulo: 'Auxiliar de leitura',
        texto: 'Abre a letra, a cifra ou a Bíblia do que está no ar, só para ler no celular. Fica apagado quando não há nada para ler.' },
      { alvo: '#viewToggle', titulo: 'Cobrir o telão',
        texto: 'Esconde o que está na TV e mostra o papel de parede no lugar. Toque de novo para mostrar a mídia outra vez.' },
      { alvo: '#muteToggle', titulo: 'Mutar',
        texto: 'Silencia o som da TV; toque de novo para tirar o mudo. O número é o volume de agora.' },
      { alvo: '#pvFullBtn', titulo: 'Tela cheia',
        texto: 'Abre a prévia em tela cheia no celular, na horizontal.' },
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
    // A RAIZ DE CONFIGURAÇÕES NÃO TEM TOUR (v1.14.10). Pedido do operador:
    // *"Desative o tour na primeira aba das configurações … Pode aplicar o tour
    // novamente apenas nas seções complexas das configurações, como o histórico e
    // a transferência."* Saíram com ela o da Tela e o da Verificação — as três
    // eram janelas de ajuste simples, e o tour a cada abertura virava ruído. O
    // que fica é o que tem o que ensinar: o Histórico e o Transferir.
    'cfg-hist': { modos: AMBOS, passos: [
      { alvo: '#histSecao', abertura: true, titulo: 'Histórico',
        texto: 'Tudo o que já foi para a TV, do mais recente ao mais antigo. Role para ver o resto.' },
      { alvo: '#histList .row-item .row-btn', titulo: 'Adicionar ao Cronograma',
        texto: 'Este + leva o item do histórico para o Cronograma, para tocar de novo no culto. O toque na linha só projeta: não guarda nada.', opcional: true },
      { alvo: '#histClear', titulo: 'Limpar todo o histórico',
        texto: 'Toque para apagar a lista, bom para começar outro culto. O app pede confirmação antes.', opcional: true },
    ] },
    // O EDITOR DE MÍDIA é uma FERRAMENTA: a chave da seção é a do painel da folha
    // de Ferramentas (`'ferr-' + ferramentaAtual()`). Só existe no AVANÇADO — a
    // lista das Ferramentas do Fácil não tem o quadrado dele —, então o `refazer()`
    // do Fácil não zera esta marca.
    // AS DUAS VISTAS TÊM SEÇÃO PRÓPRIA (v1.14.20): a "escolha" (a lista, a busca e o importar) é
    // `ferr-edicao`; o formulário (a mídia, o trecho, o confirmar e os destinos) é
    // `ferr-edicao-form`, e o `secaoDoTour()` escolhe pela vista. Com uma seção só, a marca gravava
    // na primeira abertura — que nasce na escolha — e o formulário nunca se explicava.
    'ferr-edicao': { modos: ['full'], passos: [
      { alvo: '#edicaoLista', titulo: 'Escolher a mídia',
        texto: 'A lista mostra os áudios e vídeos do aparelho em grupos: Cronograma, Playlist, Favoritos e, na Biblioteca, um grupo por coleção baixada. Toque num grupo para abri-lo e numa mídia para escolhê-la.', opcional: true },
      { alvo: '#edicaoBusca', titulo: 'Buscar pelo nome',
        texto: 'Digite o nome da mídia que quer cortar no começo ou no fim e toque nela na lista.', opcional: true },
      { alvo: '#edicaoImportar', titulo: 'Importar arquivo',
        texto: 'Toque para abrir um arquivo do celular só para cortar. Ele não entra no Cronograma nem nos Favoritos.', opcional: true },
    ] },
    'ferr-edicao-form': { modos: ['full'], passos: [
      { alvo: '#edicaoLista .edicao-card', abertura: true, titulo: 'Mídia escolhida',
        texto: 'É a mídia que você está cortando. Toque na linha para escolher outra; o X vermelho cancela esta edição e volta à lista.' },
      { alvo: ['#edicaoLista .edicao-faixa', '#edicaoLista .edicao-pontas'], titulo: 'Trecho',
        texto: 'Arraste as duas pontas da faixa para escolher onde a mídia começa e onde termina. Os botões −1 s e +1 s acertam o segundo.', opcional: true },
      { alvo: '#edicaoLista .pacote-linha:not(.edicao-card)', todos: true, titulo: 'Fades',
        texto: 'Marque Fade de entrada ou Fade de saída para o trecho começar ou terminar suavemente.', opcional: true },
      { alvo: '#edicaoConfirmar', titulo: 'Confirmar',
        texto: 'Toque para guardar o corte; o arquivo original não muda. Fica apagado até você mexer no trecho ou numa marca.', opcional: true },
      { alvo: '#edicaoFechoForm .sorteio-dest', todos: true, titulo: 'Cronograma, playlist e Favoritos',
        texto: 'Os três quadrados guardam o corte direto no Cronograma, na playlist ou nos Favoritos, sem perguntar. O editor não mostra nada na TV.', opcional: true },
    ] },
    'cfg-pacote': { modos: AMBOS, passos: [
      // O QUE VAI NO ARQUIVO, A SELEÇÃO E O PESO (v1.14.10). Pedido do operador:
      // *"na transferência, tente explicar sobre os itens selecionados e o pesos
      // de adicionar ou remover uma seleção."* Nenhum passo abre nem projeta: só
      // mostra onde se marca, o que a marca faz e o que ela muda no tamanho.
      { alvo: '#pacoteLista', abertura: true, titulo: 'O que vai no arquivo',
        texto: 'A lista é o acervo deste aparelho, agrupado como na Biblioteca. O que está marcado é o que o arquivo leva — e ele já abre com tudo marcado.' },
      { alvo: '#pacoteLista .pacote-linha', titulo: 'Marcar e desmarcar',
        texto: 'Toque na marca de uma linha para tirar aquele álbum do arquivo, e de novo para devolvê-lo. A barra de uma seção marca ou desmarca tudo o que está dentro dela.', opcional: true },
      { alvo: '#pacoteLista .song-menu-sub', titulo: 'O peso de cada escolha',
        texto: 'O número ao lado do nome é quanto aquela parte ocupa no arquivo. Marcar aumenta o total e desmarcar diminui — é o que responde se o pacote cabe no cartão.', opcional: true },
      // OS DOIS QUADROS SÓ EXISTEM COM A PONTE (`pacoteRenderPar` os esconde no
      // navegador): `opcional` é o que deixa o passo sair quando não há o que
      // recortar, em vez de um balão central sobre nada.
      { alvo: '#pacoteExportarTile', titulo: 'Exportar',
        texto: 'Toque para salvar a biblioteca e os ajustes num arquivo. Pronto o arquivo, toque de novo para mandá-lo a outro celular.', opcional: true },
      { alvo: '#pacoteImportarTile', titulo: 'Importar',
        texto: 'Toque para trazer tudo de um arquivo exportado. Só acrescenta: nada do que já existe é apagado.', opcional: true },
    ] },
    conectar: { modos: AMBOS, passos: [
      PORTA_TV,
      PORTA_PC,
      Object.assign({}, PORTA_CELULAR, { texto: 'Toque para usar o app só no celular, sem TV. Toque de novo para desligar.' }),
    ] },
    biblioteca: { modos: ['full'], passos: [
      { alvo: '#hymnSearchInput', titulo: 'Buscar',
        texto: 'Digite o nome, o número ou um trecho da letra. Os resultados aparecem logo abaixo.' },
      { alvo: '#sorteioBtn', titulo: 'Playlist automática',
        texto: 'Toque para o app sortear músicas por um tema e montar uma fila. A janela se explica ao abrir.', opcional: true },
      { alvo: '#hymnSearchPopup .coll-bar-fechar', titulo: 'Álbuns',
        texto: 'Toque na seta de um álbum para abrir ou fechar as músicas dele. Toque numa música para ver as opções.', opcional: true },
      // `:not(.coll-bar-rm)`: a lixeira de "remover do aparelho" também leva a classe `coll-bar-dl`.
      { alvo: '#hymnSearchPopup .coll-bar-dl:not(.coll-bar-rm)', titulo: 'Baixar',
        texto: 'Toque para baixar o álbum inteiro e usá-lo sem internet no culto. Durante o download, o mesmo botão cancela.', opcional: true },
      { alvo: '#hymnSearchToggle', titulo: 'Fechar', texto: 'Toque para fechar a Biblioteca e voltar ao Cronograma.', opcional: true },
    ] },
    cronogramas: { modos: ['full'], passos: [
      { alvo: '#cronoGaveta .crono-trocar', titulo: 'Seus cronogramas',
        texto: 'Toque no nome de um cronograma para passar a usá-lo na tela principal.' },
      { alvo: '#cronoGaveta .crono-item .row-mais', titulo: 'Opções do cronograma',
        texto: 'Toque nos três pontos para renomear, salvar como modelo ou apagar o cronograma.', opcional: true },
      { alvo: '#cronoNovo', titulo: 'Novo cronograma',
        texto: 'Toque para criar uma lista nova, para outro culto ou evento. A atual continua guardada.' },
      { alvo: '#cronoModelo', titulo: 'Novo a partir de um modelo',
        texto: 'Escolha sábado de manhã, domingo à noite ou quarta à noite: a lista nasce com os momentos do culto, e você põe as mídias debaixo de cada um.' },
    ] },
    // A BÍBLIA TEM DUAS TELAS, E CADA UMA SE EXPLICA UMA VEZ (v1.14.20): a grade de livros e
    // capítulos (`biblia`) e a leitura (`biblia-leitura`; o `secaoDoTour()` escolhe por
    // `bibleScreen`). O "Fechar" não tem passo: é a mesma porta que abriu. A leitura só existe
    // depois de escolher um versículo, e é nela que se projeta, se navega e se guarda.
    biblia: { modos: ['full'], passos: [
      { alvo: '#bibleBody', abertura: true, titulo: 'Bíblia',
        texto: 'Toque no livro, depois no capítulo e no versículo para abrir a leitura. As cores separam os grupos de livros.' },
    ] },
    'biblia-leitura': { modos: ['full'], passos: [
      { alvo: '.bible-vsec.cur', abertura: true, titulo: 'Versículo escolhido',
        texto: 'Toque no versículo do meio para mostrá-lo na TV; toque de novo para tirá-lo.' },
      { alvo: '.bible-vsec.adj', todos: true, titulo: 'Mudar de versículo',
        texto: 'Toque num versículo vizinho para passar a ele; nas pontas do capítulo, a leitura segue para o capítulo ao lado. Se havia um versículo na TV, o novo aparece lá na hora.' },
      { alvo: '.bible-ref-nav', titulo: 'Livro, capítulo, versículo e versão',
        texto: 'Toque no livro, no capítulo ou no versículo para escolher outra passagem. O último botão, quando aparece, troca a versão da Bíblia.' },
      { alvo: '.bible-read-acoes .cue-save-btn', todos: true, titulo: 'Cronograma e Favoritos',
        texto: 'Toque num dos dois botões para guardar este versículo no Cronograma ou nos Favoritos. Fica guardada a indicação do versículo, não o texto.' },
    ] },
    ferramentas: { modos: ['full'], passos: [
      { alvo: ['#ferrTile_clock', '#ferrTile_stopwatch', '#ferrTile_timer'], titulo: 'Relógio, Cronômetro e Timer',
        texto: 'Toque num deles para abrir. O tempo aparece num cartão na TV.' },
      { alvo: '#ferrTile_msg', titulo: 'Mensagens', texto: 'Toque para escrever avisos e mostrá-los na TV na hora certa.' },
      { alvo: '#ferrTile_draw', titulo: 'Sorteio',
        texto: 'Toque para sortear um número ou um nome de uma lista e mostrar o resultado na TV.' },
      { alvo: '#ferrTile_edicao', titulo: 'Editar mídia',
        texto: 'Toque para cortar o começo e o fim de um áudio ou vídeo. O corte vai para o Cronograma, a playlist ou os Favoritos.', opcional: true },
    ] },
    'ferr-clock': { modos: ['full'], passos: [
      { alvo: '#toolsFoot .chrono-opt', todos: true, titulo: 'Seg e 12h',
        texto: 'Toque em Seg para mostrar os segundos e em 12h para o formato de 12 horas.', opcional: true },
      SUBLINHA, SAIDAS,
    ] },
    'ferr-stopwatch': { modos: ['full'], passos: [
      { alvo: ['#chronoRun', '#chronoZero'], titulo: 'Iniciar e Zerar',
        texto: 'Toque no botão de iniciar para contar e nele de novo para pausar. O outro botão zera a contagem.' },
      SUBLINHA, SAIDAS,
    ] },
    'ferr-timer': { modos: ['full'], passos: [
      { alvo: '#chronoRoletas', titulo: 'Escolher o tempo',
        texto: 'Role cada coluna com o dedo, para cima ou para baixo, até aparecer o tempo que quer: horas, minutos e segundos. Só muda com o Timer parado.', opcional: true },
      { alvo: ['#chronoRun', '#chronoZero'], titulo: 'Iniciar e Zerar',
        texto: 'Toque no botão de iniciar para começar a contar. O outro botão zera e recomeça.' },
      SUBLINHA, SAIDAS,
    ] },
    'ferr-msg': { modos: ['full'], passos: [
      // A LISTA existe até vazia (`li.empty`), e a primeira instalação não traz mensagem de exemplo:
      // o passo da formatação aponta o ⋮ da primeira linha e, sem linha, vira balão central
      // (`semAlvo`) — o único jeito de ensinar o que só existe depois de criar um aviso.
      { alvo: '#msgWrap .msg-list', abertura: true, titulo: 'Lista de mensagens',
        texto: 'Seus avisos ficam aqui, um por linha. Toque num aviso para mostrá-lo na TV e toque de novo para tirá-lo.' },
      { alvo: '#msgWrap .msg-list .lib-item .row-mais', titulo: 'Opções do aviso',
        texto: 'Toque no ⋮ do aviso e, no botão com o "A", escolha o tamanho, a fonte e o alinhamento do texto na TV; se ele estiver no ar, muda na hora. Ali também ficam guardar e excluir.',
        semAlvo: 'Com um aviso na lista, toque no ⋮ da linha e, no botão com o "A", escolha o tamanho, a fonte e o alinhamento do texto na TV.' },
      { alvo: '#msgNovaBtn', titulo: '+ Nova mensagem',
        texto: 'Toque para escrever um aviso. Depois, toque no aviso pronto para mostrá-lo na TV.' },
    ] },
    'ferr-draw': { modos: ['full'], passos: [
      { alvo: '#toolsBody textarea.draw-pool', titulo: 'Opções',
        texto: 'Escreva uma opção por linha, como nomes de pessoas. O sorteio escolhe uma delas.', opcional: true },
      { alvo: '#toolsBody input.misc-num', todos: true, titulo: 'De e Até',
        texto: 'Digite o menor e o maior número. O sorteio escolhe um número entre os dois.', opcional: true },
      { alvo: '#toolsBody .misc-chip', todos: true, titulo: 'Números e Não repetir',
        texto: 'Toque em Números para trocar entre números e uma lista de nomes. Com Não repetir ligado, o que saiu não sai de novo.', opcional: true },
      { alvo: ['#drawGoBtn', '#drawResetBtn'], titulo: 'Sortear e Reiniciar',
        texto: 'Toque no botão de sortear para escolher. O botão ao lado reinicia e devolve todos ao sorteio.', opcional: true },
      SAIDAS,
    ] },
    sorteio: { modos: ['full'], passos: [
      { alvo: '#sorteioPopup input.lib-search', titulo: 'Palavra tema',
        texto: 'Digite uma palavra, como "graça" ou "esperança", para sortear músicas sobre ela.' },
      { alvo: '#sorteioPopup .song-menu-seg', titulo: 'Cantada ou Fundo musical',
        texto: 'Toque para escolher músicas cantadas ou só o fundo musical, sem voz.', opcional: true },
      { alvo: '#sorteioPopup .misc-chip', todos: true, titulo: 'Álbuns e Só no aparelho',
        texto: 'Toque nos álbuns de onde sortear. "Só no aparelho" usa apenas o que já está baixado.', opcional: true },
      // A LISTA SORTEADA (v1.14.21, pedido do operador): ela JÁ VEM na primeira abertura — sem tema, o acervo
      // inteiro embaralhado, com as primeiras marcadas. A moldura (a contagem e a lista) existe nos três estados
      // (montando, vazia e cheia), por isso não é `opcional`; a linha pode faltar (lista vazia, ou montando com
      // mais de 100 faixas), e aí o passo vira balão central (`semAlvo`).
      { alvo: ['#sorteioList .sorteio-res-cab', '#sorteioList .sorteio-res'], titulo: 'Músicas sorteadas',
        texto: 'A lista sorteada. A linha de cima diz quantas músicas estão disponíveis e quantas já estão baixadas no aparelho; role para ver todas.' },
      { alvo: '#sorteioList .sorteio-res-btn', titulo: 'Marcar músicas',
        texto: 'Toque numa música para marcar ou desmarcar: só as marcadas, com o número da vez, tocam ou são guardadas. Embaixo do nome aparece "no aparelho" ou "vai baixar".',
        semAlvo: 'Quando houver músicas na lista, toque numa delas para marcar ou desmarcar: só as marcadas tocam ou são guardadas.' },
      { alvo: '#sorteioQuantidade', titulo: 'Quantas',
        texto: 'Deslize os números para escolher quantas músicas ficam marcadas. As primeiras da lista são marcadas sozinhas.', opcional: true },
      // O RE-SORTEAR FICA FORA DO DESTAQUE da saída: ele é outra ação (refazer a lista) e tem passo próprio.
      { alvo: '#sorteioPopup .sorteio-sortear', titulo: 'Sortear de novo',
        texto: 'Toque no botão de embaralhar para sortear outra ordem, com a mesma palavra e os mesmos filtros.', opcional: true },
      { alvo: '#sorteioPopup .sorteio-acao:not(.sorteio-sortear)', todos: true, titulo: 'Tocar agora e guardar',
        texto: 'Toque em Tocar agora para ouvir já as músicas marcadas, ou nos botões ao lado para guardá-las no Cronograma, na playlist ou nos Favoritos.', opcional: true },
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
    // A CIFRA É UMA SEÇÃO À PARTE (v1.14.20): a folha abre na aba "Letra", e a barra da cifra só
    // existe com a aba "Cifra" montada — o `secaoDoTour()` devolve `letra-cifra` quando o ▶ da
    // barra está no DOM. Com uma seção só, a marca gravava na primeira abertura (na Letra) e a
    // cifra nunca se explicava. Sem `opcional`: o gatilho já garante as peças.
    'letra-cifra': { modos: ['full'], passos: [
      { alvo: '#lyricsViewBody', abertura: true, titulo: 'Cifra',
        texto: 'Os acordes sobre a letra, para quem toca. Só você vê esta folha: a TV não muda.' },
      { alvo: ['#lyricsCifraCtl .lv-cifra-rolar', '#lyricsCifraCtl .lv-cifra-vel'], titulo: 'Rolar sozinho',
        texto: 'Toque no ▶ para a folha descer sozinha enquanto você toca; toque de novo para parar. O número ao lado é a velocidade: toque nele para escolher outra.' },
      { alvo: '#lyricsCifraCtl .lv-cifra-tom', todos: true, titulo: 'Tom',
        texto: 'Toque em −½ para descer meio tom e em +½ para subir: os acordes mudam e o Tom aparece no alto da folha.' },
      { alvo: '#cifraCheiaBtn', titulo: 'Tela cheia (deitado)',
        texto: 'Toque para ler a cifra em tela cheia, com o celular deitado; toque de novo para sair.' },
    ] },
  };
  const CHAVE_SECAO = (s) => 's.' + s;

  let g = null;            // os ganchos do controle.js
  let autoTimer = null;
  let livreDesde = 0;
  let perguntando = null;  // o `qual` da pergunta aberta (`perguntar`), se houver
  let vigia = null;
  let raiz = null, recorte = null, balao = null, contEl = null, tituloEl = null, textoEl = null;
  let voltarEl = null, proximoEl = null;
  let atual = null;        // { qual, passos, i, foco, volume }
  let quadro = 0;
  let ro = null;
  // O movimento (v1.14.4): `seq` é a vez da troca de passo — um clique novo a cancela
  // e o ÚLTIMO vence; `animando` segura os reposicionamentos até a troca assentar.
  let seq = 0, animando = false, fimAnim = 0, fimCentro = 0, centroPendente = false, raioBase = 0;
  const ASSENTA_MS = 700;   // teto da espera pela peça parar (rolagem, janela abrindo)

  function vistos() {
    try { return JSON.parse(localStorage.getItem(CHAVE) || '{}') || {}; } catch (_) { return {}; }
  }
  function marcar(qual, visto) {
    const v = vistos();
    if (visto) v[qual] = 1; else delete v[qual];
    try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch (_) { /* armazenamento bloqueado */ }
  }
  // O tour desligado por inteiro (v1.14.5). Padrão: ligado.
  function ativo() {
    try { return localStorage.getItem(CHAVE_OFF) !== '1'; } catch (_) { return true; }
  }
  function definirAtivo(sim) {
    const antes = ativo();
    try { if (sim) localStorage.removeItem(CHAVE_OFF); else localStorage.setItem(CHAVE_OFF, '1'); } catch (_) { /* armazenamento bloqueado */ }
    if (antes !== sim) {
      try { window.dispatchEvent(new CustomEvent('av-tour-ativo', { detail: { ativo: sim } })); } catch (_) { /* segue */ }
    }
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
    const a = areaVisivel();
    return r.bottom > 0 && r.right > 0 && r.top < a.h && r.left < a.w;
  }
  function elementos(passo) {
    if (!passo.alvo) return [];
    const lista = Array.isArray(passo.alvo) ? passo.alvo : [passo.alvo];
    const els = [];
    // UMA PEÇA POR SELETOR, salvo quando o passo pede `todos` (v1.14.16). O
    // recorte é a UNIÃO dos alvos, e a união que vale é entre os SELETORES — a
    // faixa e as duas pontas do mesmo controle — MAIS as ocorrências quando o
    // passo explica um conjunto ("os quatro botões de ajuste", "as categorias").
    // O que não vale é a união acidental entre LINHAS: `#histList .row-item
    // .row-btn` e `#pacoteLista .pacote-linha` destacavam a lista toda em vez da
    // primeira linha, que é a que explica o gesto.
    for (const q of lista) {
      for (const e of document.querySelectorAll(q)) {
        if (!visivel(e)) continue;
        els.push(e);
        if (!passo.todos) break;
      }
    }
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
  // (vira balão central) vai para o fim, antes do fecho, na ordem declarada.
  // A PÍLULA DO VOLUME É UM DESSES (v1.14.20): ela nasce escondida e a caixa dela
  // MUDA quando aparece (no Fácil é uma faixa alta na borda esquerda, por cima da
  // Biblioteca). Ordenar pela caixa escondida e medir a mostrada é o que pôs o
  // passo dela fora de lugar quando a Biblioteca ganhou os passos da lista — então
  // ela não ordena: vai para o fim, antes do fecho, como a peça fora de vista. O
  // `volume: true` fica pelo gancho que a mostra no passo dela.
  const LINHA_PX = 24;
  function caixaParaOrdem(passo) {
    return retangulo(passo);
  }
  // `a` CONTÉM `b`: a caixa de `b` cabe inteira na de `a` (±1,5 px) e `a` é maior.
  function contem(a, b) {
    return b.left >= a.left - 1.5 && b.top >= a.top - 1.5 && b.right <= a.right + 1.5 && b.bottom <= a.bottom + 1.5
      && a.width * a.height > b.width * b.height + 1;
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
    const meio = faixas.flatMap((f) => f.sort((a, b) => a.r.left - b.r.left || a.k - b.k));
    // A MOLDURA ANTES DO QUE ESTÁ DENTRO DELA (v1.14.21): pelo centro, os botões do alto da prévia caíam
    // ANTES da prévia (o centro deles fica acima do dela). O passo cuja peça CONTÉM a de outro sobe para
    // logo antes da primeira peça de dentro — a `abertura` local: a moldura fica no lugar dela na tela.
    for (let i = 1; i < meio.length; i++) {
      const j = meio.findIndex((m, k) => k < i && contem(meio[i].r, m.r));
      if (j >= 0) meio.splice(j, 0, meio.splice(i, 1)[0]);
    }
    return ini.concat(meio.map((m) => m.p), soltos, fim);
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
      + '<button type="button" class="tour-pular" title="Pular e desligar o tour">Pular tour</button></div>'
      + '<div class="dialog-title" id="tourTitulo"></div>'
      + '<div class="dialog-msg" id="tourTexto"></div>'
      + '<div class="dialog-actions">'
      + '<button type="button" class="dialog-btn tour-voltar">Voltar</button>'
      + '<button type="button" class="dialog-btn primary tour-proximo">Próximo</button>'
      + '</div></div>';
    document.body.appendChild(raiz);
    recorte = raiz.querySelector('.tour-recorte');
    raioBase = parseFloat(getComputedStyle(recorte).borderTopLeftRadius) || 12;
    balao = raiz.querySelector('.tour-balao');
    contEl = raiz.querySelector('.tour-cont');
    tituloEl = raiz.querySelector('#tourTitulo');
    textoEl = raiz.querySelector('#tourTexto');
    voltarEl = raiz.querySelector('.tour-voltar');
    proximoEl = raiz.querySelector('.tour-proximo');
    raiz.querySelector('.tour-pular').addEventListener('click', () => desativar());
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

  // O MOVIMENTO (v1.14.4). As durações são os tokens (`--tour-mov`, `--tour-fade`),
  // lidas na raiz: com `prefers-reduced-motion` elas valem 0 e tudo é instantâneo.
  function ms(nome) {
    const v = getComputedStyle(raiz).getPropertyValue(nome).trim();
    const n = parseFloat(v) || 0;
    return /ms$/.test(v) ? n : n * 1000;
  }
  function reduzido() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; }
  }

  // Reposicionar (resize, teclado, rolagem, ResizeObserver, vigia). No meio de uma
  // troca de passo ele espera: o fim da troca reposiciona.
  function agendar() {
    if (!atual || quadro || animando) return;
    quadro = requestAnimationFrame(() => { quadro = 0; posicionar(false); });
  }

  // O raio: o do cartão, ou o da peça mais a folga (uma pílula ganha halo de pílula).
  function raioDe(passo, w, h) {
    const els = elementos(passo);
    let raio = raioBase;
    if (els.length === 1) {
      const v = getComputedStyle(els[0]).borderTopLeftRadius || '';
      const n = parseFloat(v) || 0;
      const er = /%$/.test(v) ? Math.max(0, Math.min(w, h) - 2 * FOLGA) * n / 100 : n;
      if (er > 0) raio = Math.max(raio, er + FOLGA);
    }
    return Math.max(0, Math.min(raio, Math.min(w, h) / 2));
  }

  // Onde tudo VAI ficar: o recorte (ou nenhum) e o canto do balão. Mede a altura
  // NATURAL do balão — quem chama garante que ela não está travada.
  function geometria(passo, r) {
    const { w: vw, h: vh } = areaVisivel();
    const w = Math.min(340, vw - 2 * MARGEM);
    balao.style.width = w + 'px';
    balao.style.maxHeight = (vh - 2 * MARGEM) + 'px';
    const h = balao.offsetHeight;
    let left, top, rec = null;
    if (!r) {
      left = (vw - w) / 2; top = Math.max(MARGEM, (vh - h) / 2);
    } else {
      // O RECORTE ENVOLVE A PEÇA INTEIRA (a união dos alvos + `FOLGA`), sem recuo de
      // conforto: um recuo deixaria a peça de borda a borda pouco coberta e
      // distorceria o foco. O ANEL NÃO FURA A TELA: o anel azul é desenhado 2px POR
      // FORA da caixa, então a caixa é presa a `ANEL` de cada borda da área visível
      // e o anel termina exatamente nela. Numa peça colada à borda a linha aparece
      // inteira, em vez de metade dela sumir para fora da tela. É a MESMA régua do
      // foco dos controles do app: encosta, não fura.
      const preso = (v, max) => Math.min(max - ANEL, Math.max(ANEL, v));
      const l = preso(r.left - FOLGA, vw), t = preso(r.top - FOLGA, vh);
      const rr = preso(r.right + FOLGA, vw), bb = preso(r.bottom + FOLGA, vh);
      rec = { l, t, w: Math.max(0, rr - l), h: Math.max(0, bb - t) };
      rec.raio = raioDe(passo, rec.w, rec.h);
      const cx = (l + rr) / 2;
      left = Math.min(Math.max(MARGEM, cx - w / 2), vw - MARGEM - w);
      const abaixo = vh - MARGEM - (bb + VAO), acima = t - VAO - MARGEM;
      if (h <= abaixo) top = bb + VAO;
      else if (h <= acima) top = t - VAO - h;
      else top = abaixo >= acima ? vh - MARGEM - h : MARGEM;
      top = Math.min(Math.max(MARGEM, top), Math.max(MARGEM, vh - MARGEM - h));
    }
    return { rec, x: Math.round(left), y: Math.round(top), w, h, vw, vh };
  }

  function por(g2) {
    const s = recorte.style;
    s.left = g2.l + 'px'; s.top = g2.t + 'px'; s.width = g2.w + 'px'; s.height = g2.h + 'px';
    s.borderRadius = g2.raio + 'px';
  }

  // Leva recorte e balão até `geo`. As transições do CSS fazem o trajeto; `instante`
  // pula direto (abrir, movimento reduzido).
  function aplicar(geo, instante) {
    if (instante) raiz.classList.add('tour--fixo');
    balao.style.transform = 'translate(' + geo.x + 'px, ' + geo.y + 'px)';
    clearTimeout(fimCentro); centroPendente = false;
    if (geo.rec) {
      if (recorte.hidden) {
        // Saindo do centro: o buraco nasce fechado no meio do balão e abre até a peça.
        raiz.classList.add('tour--fixo', 'tour--centro');
        por({ l: geo.x + geo.w / 2, t: geo.y + geo.h / 2, w: 0, h: 0, raio: 0 });
        recorte.hidden = false;
        raiz.classList.remove('tour--sem-recorte');
        void recorte.offsetWidth;
        if (!instante) raiz.classList.remove('tour--fixo');
      }
      raiz.classList.remove('tour--centro');
      por(geo.rec);
    } else {
      // Para o centro: o buraco encolhe até o meio do balão, o halo apaga, e só então
      // o recorte sai e o véu passa para o fundo da raiz (a mesma cor: sem salto).
      raiz.classList.add('tour--centro');
      if (!recorte.hidden) {
        por({ l: geo.x + geo.w / 2, t: geo.y + geo.h / 2, w: 0, h: 0, raio: 0 });
        const esconder = () => {
          centroPendente = false;
          if (!raiz.classList.contains('tour--centro')) return;
          recorte.hidden = true;
          raiz.classList.add('tour--sem-recorte');
        };
        const d = instante ? 0 : ms('--tour-mov');
        if (d > 0) { centroPendente = true; fimCentro = setTimeout(esconder, d); } else esconder();
      }
    }
    if (instante) { void raiz.offsetWidth; raiz.classList.remove('tour--fixo'); }
  }

  function textoDe(passo, r) { return r || !passo.semAlvo ? passo.texto : passo.semAlvo; }

  function posicionar(instante) {
    if (!atual || animando) return;
    const passo = atual.passos[atual.i];
    const r = retangulo(passo);
    const tx = textoDe(passo, r);
    if (textoEl.textContent !== tx) textoEl.textContent = tx;
    if (!instante) raiz.classList.add('tour--ajuste');
    aplicar(geometria(passo, r), instante);
  }

  function observar() {
    if (!ro) return;
    ro.disconnect();
    ro.observe(balao);
    for (const e of elementos(atual.passos[atual.i])) ro.observe(e);
  }

  function trocarTexto(passo) {
    contEl.textContent = (atual.i + 1) + ' de ' + atual.passos.length;
    tituloEl.textContent = passo.titulo;
  }

  // Espera a peça PARAR (a rolagem do `scrollIntoView`, uma janela ou a pílula
  // entrando com transição): dois quadros seguidos no mesmo lugar, ou o teto.
  // Enquanto isso o recorte fica onde estava — nunca salta para a posição velha.
  function assentar(passo, vez, pronto) {
    const ate = performance.now() + ASSENTA_MS;
    let ant = '';
    (function olhar() {
      if (vez !== seq || !atual) return;
      const r = retangulo(passo);
      const k = r ? [r.left, r.top, r.right, r.bottom].map(Math.round).join() : '-';
      if (k === ant || performance.now() > ate) pronto();
      else { ant = k; requestAnimationFrame(olhar); }
    })();
  }

  // `primeiro`: o passo de abertura, sem trajeto (o tour entra em fade e escala).
  function mostrarPasso(primeiro) {
    const passo = atual.passos[atual.i];
    const quer = !!passo.volume;
    if (quer !== atual.volume) { atual.volume = quer; try { g.volume && g.volume(quer); } catch (_) { /* segue */ } }
    voltarEl.disabled = atual.i === 0;
    voltarEl.title = atual.i === 0 ? 'Este é o primeiro passo' : '';
    proximoEl.textContent = atual.i === atual.passos.length - 1 ? 'Concluir' : 'Próximo';
    const els = elementos(passo);
    const vh = areaVisivel().h;
    // Peça cortada pela borda (dentro de uma lista que rola): traz para a vista.
    if (els[0]) {
      const q = els[0].getBoundingClientRect();
      if (q.top < 0 || q.bottom > vh) { try { els[0].scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) { /* segue */ } }
    }
    observar();
    try { proximoEl.focus({ preventScroll: true }); } catch (_) { balao.focus(); }
    const vez = ++seq;
    clearTimeout(fimAnim);
    if (quadro) { cancelAnimationFrame(quadro); quadro = 0; }
    if (primeiro || reduzido()) {
      animando = false;
      balao.classList.remove('tour-balao--trocando', 'tour-balao--movendo');
      balao.style.height = '';
      trocarTexto(passo);
      posicionar(true);
      return;
    }
    // A troca: o texto some (fade curto) com a altura do balão travada; quando a
    // peça assentou e o fade acabou, `mover` troca o texto e leva tudo junto.
    balao.style.height = balao.offsetHeight + 'px';
    animando = true;
    balao.classList.add('tour-balao--trocando', 'tour-balao--movendo');
    const t0 = performance.now();
    assentar(passo, vez, () => {
      const falta = ms('--tour-fade') - (performance.now() - t0);
      const seguir = () => { if (vez === seq && atual) mover(passo, vez); };
      if (falta > 0) fimAnim = setTimeout(seguir, falta); else seguir();
    });
  }

  function mover(passo, vez) {
    trocarTexto(passo);
    const r = retangulo(passo);
    textoEl.textContent = textoDe(passo, r);
    const hAgora = balao.offsetHeight;
    balao.style.height = '';
    raiz.classList.remove('tour--ajuste');
    const geo = geometria(passo, r);
    // A altura anima da de agora até a natural do texto novo.
    balao.style.height = hAgora + 'px';
    void balao.offsetHeight;
    balao.style.height = geo.h + 'px';
    balao.classList.remove('tour-balao--trocando');
    aplicar(geo, false);
    fimAnim = setTimeout(() => {
      if (vez !== seq || !atual) return;
      animando = false;
      balao.style.height = '';
      balao.classList.remove('tour-balao--movendo');
      posicionar(false);
    }, ms('--tour-mov') + 60);
  }

  // Fechar: uma cópia inerte do que está na tela some em fade; o tour de verdade já
  // fechou (o toque volta ao app na hora, e quem pergunta `#tour` o vê oculto).
  function sombra() {
    const f = raiz.cloneNode(true);
    f.removeAttribute('id');
    delete f.dataset.tour;
    for (const n of f.querySelectorAll('[id]')) n.removeAttribute('id');
    f.setAttribute('aria-hidden', 'true');
    f.inert = true;
    f.classList.remove('tour--entrando');
    f.classList.add('tour--saindo');
    document.body.appendChild(f);
    void f.offsetWidth;
    f.classList.add('tour--sumindo');
    setTimeout(() => f.remove(), ms('--dur-media') + 120);
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
    perguntando = null;
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
    // Abrir: o véu entra em fade e recorte e balão crescem um pouco (`tour--entrando`).
    raiz.classList.remove('tour--ajuste');
    raiz.classList.add('tour--entrando');
    mostrarPasso(true);
    void raiz.offsetWidth;
    raiz.classList.remove('tour--entrando');
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
    seq++; animando = false;
    clearTimeout(fimAnim); clearTimeout(fimCentro); centroPendente = false;
    balao.style.height = '';
    balao.classList.remove('tour-balao--trocando', 'tour-balao--movendo');
    window.removeEventListener('resize', aoMudar);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', aoMudar);
    document.removeEventListener('transitionend', aoMudar, true);
    document.removeEventListener('scroll', aoMudar, true);
    if (o.manter) return true;
    if (!reduzido()) { try { sombra(); } catch (_) { /* segue */ } }
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
    agendar();
  }

  // O candidato de agora: a SEÇÃO aberta por cima (se tiver tour e não foi vista)
  // ou, com a tela livre, o tour principal do estado.
  function candidato() {
    const v = vistos();
    const sec = g.secao();
    if (sec) {
      const k = CHAVE_SECAO(sec);
      const def = SECOES[sec];
      // `modos` É PORTEIRO (v1.14.20), e não só o reset do `refazer()`: no Fácil a Biblioteca aberta por
      // cima da leitura devolve `secaoDoTour() === 'biblioteca'` (a janela do AVANÇADO), e o tour dela
      // abria dentro do Fácil com o texto do Avançado — "voltar ao Cronograma", "ver as opções".
      return def && !v[k] && !g.bloqueio() && def.modos.includes(g.modo()) ? k : null;
    }
    const qual = g.qual();
    return qual && !v[qual] && !g.ocupado() ? qual : null;
  }
  let candidatoAntes = null;
  function tique() {
    if (atual || perguntando) return;
    if (!ativo()) { clearInterval(autoTimer); autoTimer = null; livreDesde = 0; return; }
    const v = vistos();
    if (chaves().every((k) => v[k])) { clearInterval(autoTimer); autoTimer = null; return; }
    let qual = null;
    try { qual = candidato(); } catch (_) { qual = null; }
    if (qual !== candidatoAntes) { candidatoAntes = qual; livreDesde = 0; }
    if (!qual) { livreDesde = 0; return; }
    const agora = Date.now();
    if (!livreDesde) { livreDesde = agora; return; }
    if (agora - livreDesde >= (qual.startsWith('s.') ? SECAO_MS : LIVRE_MS)) { livreDesde = 0; perguntar(qual); }
  }

  // A PORTA DO AUTOMÁTICO (Pacote 45): pergunta antes de abrir. O `perguntar` é
  // do `controle.js` (a janela é do app, e este arquivo não desenha UI); sem o
  // gancho — um controle.js mais velho —, o tour abre como abria, que é a
  // degradação declarada. Enquanto a pergunta está de pé, o `tique` não insiste.
  function perguntar(qual) {
    const abrirAgora = () => abrir(qual, true);
    if (typeof g.perguntar !== 'function') { abrirAgora(); return; }
    perguntando = qual;
    Promise.resolve(g.perguntar(qual)).then((sim) => {
      perguntando = null;
      if (sim) { abrirAgora(); return; }
      // "AGORA NÃO" GRAVA A MESMA MARCA DO TOUR: a janela aparece uma vez por
      // estado, e o silêncio não se repete naquela tela. O tour não é desligado
      // (o quadrado de Configurações continua ligado) — só este estado já foi.
      marcar(qual, true);
      livreDesde = 0;
    }).catch(() => { perguntando = null; livreDesde = 0; });
  }

  function armar() {
    const v = vistos();
    if (!g || autoTimer || !ativo() || chaves().every((k) => v[k])) return;
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
    definirAtivo(true);   // pedir o tour à mão liga o tour
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

  // DESLIGAR por inteiro: fecha o tour aberto e para o automático. Quem chama é o
  // "Pular tour" do balão e o quadrado de Configurações. Não mexe nas marcas de "visto".
  function desativar() {
    definirAtivo(false);
    clearInterval(autoTimer); autoTimer = null; livreDesde = 0;
    fechar();   // o `armar()` do fim dele não arma com o tour desligado
  }

  function ligar(ganchos) {
    g = ganchos;
    armar();
  }

  global.AVTour = {
    ligar,
    refazer,
    desativar,
    ativo,
    armar,   // religa o automático depois de alguém mexer nas marcas (`av.tour`)
    abrir,
    fechar: () => fechar(),
    aberto: () => !!atual,
    estado: () => (atual ? { qual: atual.qual, passo: atual.i, total: atual.passos.length } : null),
    // Nada em movimento: nem troca de passo, nem transição do recorte ou do balão.
    quieto: () => !atual || (!animando && !quadro && !centroPendente
      && !(raiz.getAnimations ? raiz.getAnimations({ subtree: true }) : []).length),
    passoAtual: () => (atual ? atual.passos[atual.i] : null),   // o oráculo mede o passo NA ORDEM medida
    LINHA_PX,
    FOLGA,   // o oráculo mede o recorte com a régua do CÓDIGO, nunca com um 6 digitado
    ANEL,
    // O QUE ESTE PASSO SELECIONOU, e não a regra que o selecionou: o oráculo
    // cobra a SELEÇÃO (um alvo por seletor, todos com `todos`) e a geometria
    // contra ela, sem repetir a escolha do `elementos()` (v1.14.17).
    alvos: () => (atual ? elementos(atual.passos[atual.i]) : []).map((n) => {
      const r = n.getBoundingClientRect();
      return { l: r.left, t: r.top, r: r.right, b: r.bottom };
    }),
    TOURS,
    SECOES,
    chaves,
    CHAVE,
  };
})(window);
