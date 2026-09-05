// A NAVEGAÇÃO DO APP: UMA TELA E DUAS FOLHAS (v1.3.10 → v1.5.0).
//
// Este arquivo nasceu para as FERRAMENTAS virando folha e cresceu no lote em
// que a faixa de abas saiu inteira: o Cronograma é a tela ÚNICA, a Bíblia é a
// folha irmã desta, e a porta da Biblioteca é a barra que ocupa o lugar da
// faixa. As três coisas se medem juntas porque elas são UMA decisão — quem
// mexer numa mexe no que sobrou das outras.
//
// Mensagens, Tempo, Sorteio e o microfone ao vivo eram uma ABA, ao lado do
// Cronograma e da Bíblia. A faixa passou a ter só os dois LUGARES do culto — o
// roteiro e a Bíblia — mais a porta da Biblioteca, e as ferramentas viraram uma
// folha que sobe de dentro do Cronograma.
//
// A mudança não é de navegação, é de PARENTESCO: toda ferramenta daqui produz
// uma CENA que entra no roteiro (a mensagem vira cue, o cronômetro e o sorteio
// são projetados no meio da ordem do culto). A aba escondia essa relação atrás
// de um passo lateral.
//
// ## O que falha calado aqui
//
//  - **a folha cobrindo a tela toda.** É o pedido literal ("não na tela toda"),
//    e não é gosto: quem projeta um cronômetro precisa do TRANSPORTE e da
//    PREVIEW na frente enquanto o ajusta. Uma folha de corpo inteiro continua
//    funcionando, continua bonita, e cobra do operador um fechar-e-abrir por
//    ajuste. Por isso a asserção é GEOMÉTRICA: a folha não pode invadir o
//    cabeçalho nem a caixa de controles.
//  - **O operador SAIR do Cronograma.** Se a folha trocasse a tela, o rodapé
//    do Cronograma (onde mora a porta dela) deixaria de ser desenhado, o
//    carrossel perderia o destino e o voltar não teria para onde voltar. Nada
//    disso dá erro: dá uma tela que responde estranho.
//  - **as duas folhas se empilharem.** Elas são as portas do MESMO rodapé, e
//    uma sobre a outra teria dois títulos e dois ✕ na mesma caixa.
//  - **o alternador da Biblioteca mostrar os DOIS desenhos.** Seta quando
//    fechada, ✕ quando aberta — e a folha do documento não atravessa a
//    árvore-sombra de um `<use>`, então um `<symbol>` com os dois dentro
//    desenha os dois, empilhados, para sempre. É a armadilha que o
//    `controles-layout.test.mjs` já pagou uma vez.
//  - **o voltar do Android pulá-la.** Sem o degrau, o gesto que todo mundo usa
//    para "fechar isto" minimiza o app no meio do culto.
//  - **o DESENHO das três portas** (v1.5.19, bloco 9). Elas são a navegação
//    inteira do app e vivem sobre a página o culto todo: a faixa voltar a ter um
//    destaque, a discrição virar desaparecimento, o rodapé PULAR ao entrar na
//    seleção múltipla, e a `.selbar` ser "padronizada" junto — nenhum dos quatro
//    dá erro, e o terceiro é um defeito LATENTE que este lote fecha.
//
//   node tools/ferramentas-folha.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

await new Promise((r) => servidor.listen(0, r));
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 412, height: 892 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', (e) => erros.push(e.message));

try {
  await pg.goto('http://localhost:' + servidor.address().port + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function' && !!document.querySelector('#playlist li'),
    null, { timeout: 25000 },
  );
  await pg.evaluate(() => setAppMode('full'));
  await pg.waitForTimeout(200);

  // ── 1. A FAIXA DE ABAS SAIU INTEIRA (v1.5.0) ────────────────────────────
  //
  // Ela teve três formas nesta linha do tempo: quatro abas, depois duas mais a
  // busca (v1.3.10, quando as Ferramentas viraram esta folha) e agora nenhuma —
  // o Cronograma é a tela ÚNICA, a Bíblia virou uma folha irmã desta, e o que
  // ocupa o lugar da faixa é a barra da Biblioteca.
  const faixa = await pg.evaluate(() => ({
    abas: document.querySelectorAll('.tabs .tab, .tab').length,
    faixaAntiga: !!document.querySelector('.tabs'),
    // A máquina inteira foi junto: sem ela, um resto do carrossel roubaria o
    // eixo horizontal da lista sem nada na tela dizendo por quê.
    ordem: typeof TAB_ORDER !== 'undefined',
    deslize: typeof SWIPE_TABS !== 'undefined',
    troca: typeof switchTab !== 'undefined',
    // E o que ocupa o lugar dela.
    barra: !!document.querySelector('.lib-bar'),
    campo: !!document.querySelector('.lib-bar #hymnSearchInput'),
    alternador: !!document.querySelector('.lib-bar #hymnSearchToggle'),
    // As TRÊS portas do rodapé, na ordem do pedido.
    portas: [...document.querySelectorAll('.import-row > *')].map((e) => e.id || e.className),
  }));
  checar(faixa.abas === 0 && !faixa.faixaAntiga,
    'a faixa de abas não existe mais: o app tem UM lugar e duas folhas', faixa);
  checar(!faixa.ordem && !faixa.deslize && !faixa.troca,
    'e a máquina dela foi junto — nem `TAB_ORDER`, nem `SWIPE_TABS`, nem '
    + '`switchTab`', faixa);
  checar(faixa.barra && faixa.campo && faixa.alternador,
    'o que ocupa o lugar dela é a barra da Biblioteca, com o campo e o alternador',
    faixa);
  checar(faixa.portas.length === 3 && faixa.portas[0] === 'bibleBtn'
    && faixa.portas[2] === 'toolsBtn',
    'e o rodapé do Cronograma tem as TRÊS portas, na ordem do pedido: Bíblia · '
    + 'Importar · Ferramentas', JSON.stringify(faixa.portas));

  // ── 2. A PORTA É NO CRONOGRAMA, À DIREITA DA IMPORTAÇÃO ─────────────────
  const porta = await pg.evaluate(() => {
    const b = document.getElementById('toolsBtn');
    const imp = document.querySelector('.import-row .import-btn');
    if (!b || !imp) return { faltando: !b ? 'toolsBtn' : 'import-btn' };
    const rb = b.getBoundingClientRect();
    const ri = imp.getBoundingClientRect();
    return {
      naMesmaLinha: b.parentElement === imp.parentElement,
      aDireita: rb.left >= ri.right - 1,
      // A altura é a da LINHA: um botão mais baixo que o irmão lê como um
      // acessório dele, e não como a segunda porta da mesma faixa.
      mesmaAltura: Math.abs(rb.height - ri.height) < 2,
    };
  });
  checar(porta.naMesmaLinha && porta.aDireita,
    'a porta das Ferramentas está NA LINHA da importação, à DIREITA dela', porta);
  checar(porta.mesmaAltura, 'e com a mesma caixa do irmão', porta);

  // ASSENTAR É `getAnimations()` + `finished`, NUNCA UM PRAZO. As duas folhas
  // entram animadas (`tools-sobe`), e os dois blocos abaixo medem a CAIXA delas:
  // uma leitura no meio do deslize devolve um retângulo que ainda não chegou, e
  // a asserção reprova falando do app. MEDIDO: com o `waitForTimeout(400)` que
  // estava aqui, 1 reprovação em 4 rodadas da suíte em PARALELO — e ZERO em 14
  // execuções isoladas a 4× de carga, porque a janela é a do AGENDADOR e não a
  // da CPU. É a primeira classe da tabela do CLAUDE.md: prazo lido como
  // veredito.
  const assentar = (pg2, sel) => pg2.evaluate(async (s2) => {
    const el = document.querySelector(s2);
    if (!el) return false;
    await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {})));
    return true;
  }, sel);

  // ── 3. A FOLHA SOBE DENTRO DO CRONOGRAMA, NÃO SOBRE A TELA ──────────────
  await pg.click('#toolsBtn');
  await assentar(pg, '#toolsSheet');
  const dentro = await pg.evaluate(() => {
    const f = document.getElementById('toolsSheet');
    const cab = document.querySelector('.list-header').getBoundingClientRect();
    const barra = document.querySelector('.bottombar').getBoundingClientRect();
    const r = f.getBoundingClientRect();
    return {
      aberta: !f.hidden,
      // NADA de `elementFromPoint` no cabeçalho: o que se mede é a CAIXA, que
      // é o que o desenho promete.
      invadeCabecalho: r.top < cab.bottom - 1,
      invadeControles: r.bottom > barra.top + 1,
      // E ela ocupa a lista de fato — uma folha de 20px de altura passaria nas
      // duas de cima sem servir para nada.
      cobreALista: (() => {
        const l = document.getElementById('library').getBoundingClientRect();
        return r.top <= l.top + 1 && r.bottom >= l.bottom - 1;
      })(),
      biblia: bibliaAberta(),
      ferramentas: !!document.querySelector('.misc-switch'),
    };
  });
  checar(dentro.aberta && dentro.ferramentas,
    'o toque na porta abre a folha com o seletor de ferramentas dentro', dentro);
  checar(!dentro.invadeCabecalho && !dentro.invadeControles,
    'ela NÃO cobre o cabeçalho nem a caixa de controles — quem projeta um '
    + 'cronômetro precisa do transporte e da preview na frente', dentro);
  checar(dentro.cobreALista, 'e cobre a lista inteira, que é o território dela', dentro);
  checar(dentro.biblia === false,
    'o operador continua NO CRONOGRAMA: a folha é uma camada dele, não outra tela', dentro);

  // ── 4. O VOLTAR DO ANDROID A FECHA ──────────────────────────────────────
  const voltou = await pg.evaluate(() => {
    const consumiu = window.__avBack();
    // O `.saindo` é o que separa "fechou" de "não fez nada": a folha leva os
    // 220 ms da animação para deixar a árvore, e ler o `hidden` no ato mediria
    // a animação, não o degrau.
    return {
      consumiu,
      saindo: document.getElementById('toolsSheet').classList.contains('saindo'),
      biblia: bibliaAberta(),
    };
  });
  checar(voltou.consumiu === true && voltou.saindo,
    'o voltar do aparelho FECHA a folha e consome o toque — sem o degrau ele '
    + 'minimizaria o app no meio do culto', voltou);
  checar(voltou.biblia === false, 'e deixa o operador onde ele estava', voltou);
  await pg.waitForFunction(
    () => document.getElementById('toolsSheet').hidden, null, { timeout: 4000 },
  ).catch(() => {});

  // ── 5. AS DUAS FOLHAS NÃO SE EMPILHAM (v1.5.0) ──────────────────────────
  // Era "trocar de aba fecha a folha"; com a Bíblia virando folha, a regra é a
  // mesma por outro caminho — elas são as duas portas do MESMO rodapé, e uma
  // sobre a outra teria duas barras de título na mesma caixa e dois ✕ dizendo
  // coisas diferentes.
  await pg.click('#toolsBtn');
  await pg.waitForTimeout(200);
  const trocou = await pg.evaluate(() => {
    abrirBiblia();
    // MEDIDO NO ATO: a folha COMEÇA a sair no mesmo turno. Ela leva os 220 ms da
    // animação para deixar a árvore (ver `TOOLS_ANIM_MS`), e afirmar só o fim
    // não separaria "fechou" de "nunca fechou" — os dois acabam iguais depois
    // de um prazo generoso.
    return {
      saindo: document.getElementById('toolsSheet').classList.contains('saindo'),
      biblia: bibliaAberta(),
    };
  });
  checar(trocou.saindo && trocou.biblia,
    'abrir a Bíblia fecha as Ferramentas — as duas são portas do MESMO rodapé, e '
    + 'uma sobre a outra teria dois títulos e dois ✕ na mesma caixa', trocou);

  // E ELA DE FATO SAI DA ÁRVORE. O `hidden` é o estado; a animação é só o
  // caminho até ele. Uma folha "fora" por estar transladada continuaria
  // capturando toque sobre a lista.
  const saiu = await pg.waitForFunction(
    () => document.getElementById('toolsSheet').hidden, null, { timeout: 4000 },
  ).then(() => true).catch(() => false);
  const depoisDeSair = await pg.evaluate(() => ({
    hidden: document.getElementById('toolsSheet').hidden,
    saindo: document.getElementById('toolsSheet').classList.contains('saindo'),
    // O corpo é esvaziado junto: os laços dos painéis (cronômetro, sorteio)
    // morrem com ele, e nós órfãos sendo reescritos a 5 Hz é o vazamento
    // clássico desta família.
    corpoVazio: document.getElementById('toolsBody').children.length === 0,
  }));
  checar(saiu && !depoisDeSair.saindo,
    'e ela sai da árvore no fim da animação, sem deixar a classe da saída para trás',
    depoisDeSair);
  checar(depoisDeSair.corpoVazio,
    'e o corpo dela é esvaziado, para os laços dos painéis não sobrarem', depoisDeSair);

  // ── 5-A. A FOLHA DA BÍBLIA É O MESMO MOLDE (v1.5.0) ─────────────────────
  //
  // (O bloco do FANTASMA do carrossel saiu com o carrossel. O que ele guardava —
  //  que o deslize ficava sobre a LISTA e não sobre o cabeçalho — deixou de ter
  //  sujeito: não há mais deslize entre telas.)
  //
  // Pedido do operador: *"a bíblia vai ser uma janela igual o que é hoje a seção
  // de ferramentas, no mesmo molde"*. "Mesmo molde" é medível: a mesma caixa
  // (não cobre o cabeçalho nem a caixa de controles, e cobre a lista inteira) e
  // a mesma mecânica de saída. O que ela tem A MAIS é o VOLTAR, porque a Bíblia
  // tem navegação dentro dela.
  await pg.waitForFunction(
    () => !!document.querySelector('.bible-grid--books .bible-cell'), null, { timeout: 8000 },
  ).catch(() => {});
  // A grade de livros pode aparecer ANTES de a folha terminar de subir — o
  // conteúdo e a animação são duas coisas —, e o que se mede aqui é a CAIXA.
  await assentar(pg, '#bibleSheet');
  const bib = await pg.evaluate(() => {
    const f = document.getElementById('bibleSheet');
    if (!f || f.hidden) return { erro: 'a folha da Bíblia não abriu' };
    const r = f.getBoundingClientRect();
    const cab = document.querySelector('.list-header').getBoundingClientRect();
    const barra = document.querySelector('.bottombar').getBoundingClientRect();
    const l = document.getElementById('library').getBoundingClientRect();
    return {
      invadeCabecalho: r.top < cab.bottom - 1,
      invadeControles: r.bottom > barra.top + 1,
      cobreALista: r.top <= l.top + 1 && r.bottom >= l.bottom - 1,
      // O host é PRÓPRIO: a Bíblia desenhava dentro do `#library`, o mesmo
      // `<ul>` do Cronograma, e é por isso que `renderLibrary` tinha um desvio
      // por aba no topo.
      hostProprio: !!document.querySelector('#bibleBody .bible-wrap')
        && !document.querySelector('#library .bible-wrap'),
      // E o Cronograma continua desenhado POR BAIXO: a folha cobre, não
      // substitui.
      cronogramaAtras: document.querySelectorAll('#library li').length > 0
        || !!document.querySelector('#library .empty'),
      voltarNaFolha: !!document.getElementById('bibleBack'),
      voltarDoApp: document.getElementById('backBtn').hidden,
      titulo: (document.getElementById('bibleTitle') || {}).textContent,
      tituloDoApp: document.getElementById('listTitle').textContent,
    };
  });
  checar(!bib.erro && !bib.invadeCabecalho && !bib.invadeControles && bib.cobreALista,
    'a folha da Bíblia é o MESMO molde da de Ferramentas: cobre a lista inteira '
    + 'e nada além dela', bib);
  checar(!bib.erro && bib.hostProprio && bib.cronogramaAtras,
    'e ela tem host PRÓPRIO — a Bíblia deixou de disputar o `<ul>` do Cronograma, '
    + 'que continua desenhado por baixo', bib);
  checar(!bib.erro && bib.voltarNaFolha && bib.voltarDoApp
    && bib.titulo === 'Bíblia' && bib.tituloDoApp === 'Cronograma',
    'o nome e o voltar DELA moram na barra da folha, e o cabeçalho do app '
    + 'continua dizendo "Cronograma"', bib);
  await pg.evaluate(() => fecharBiblia());
  await pg.waitForTimeout(400);

  // ── 5-B. A SAÍDA TEM PAR (v1.3.13) ──────────────────────────────────────
  //
  // Pedido do operador: *"verifique o fechamento da seção de ferramentas, para
  // fechar com animação igual é feito na abertura"*. Ela subia deslizando e
  // sumia no talo — duas coisas diferentes para o olho, e a segunda lendo como
  // um erro justamente porque a primeira já ensinou a esperar o contrário.
  //
  // O que se afirma é o PAR e a MESMA duração, não a curva desenhada: quem
  // desenha é o CSS, e medir pixels de uma animação seria medir o compositor.
  await pg.waitForSelector('#toolsBtn', { timeout: 8000 });
  const par = await pg.evaluate(async () => {
    const f = document.getElementById('toolsSheet');
    document.getElementById('toolsBtn').click();
    const entrando = getComputedStyle(f).animationName;
    const dEntra = getComputedStyle(f).animationDuration;
    fecharFerramentas();
    const saindo = getComputedStyle(f).animationName;
    const dSai = getComputedStyle(f).animationDuration;
    await new Promise((r) => setTimeout(r, 400));
    return { entrando, saindo, dEntra, dSai };
  });
  checar(par.entrando === 'tools-sobe' && par.saindo === 'tools-desce',
    'a folha DESCE por onde subiu — a saída tem par, e não é o mesmo desenho', par);
  checar(par.dEntra === par.dSai,
    'e com a mesma duração: dois tempos divergiriam no primeiro ajuste', par);

  // ── 6. A PORTA EXISTE SEMPRE (v1.5.0) ───────────────────────────────────
  //
  // Ela sumia fora do Cronograma, e isso era certo enquanto havia um "fora":
  // ela é o rodapé DELE, não um controle global. Com o Cronograma virando a
  // tela única a regra continua valendo e a consequência inverteu — o rodapé
  // está sempre desenhado, inclusive com uma folha por cima, porque a folha
  // COBRE a lista e não a substitui.
  const sempre = await pg.evaluate(() => {
    abrirBiblia();
    const comFolha = !!document.getElementById('toolsBtn')
      && !!document.getElementById('bibleBtn');
    fecharBiblia();
    return comFolha;
  });
  checar(sempre,
    'e as portas do rodapé continuam desenhadas com uma folha por cima: ela cobre '
    + 'a lista, não a substitui');
  await pg.waitForTimeout(400);

  // ── 7. O ALTERNADOR DA BIBLIOTECA TROCA DE DESENHO (v1.5.0) ─────────────
  //
  // Um botão, dois estados: SETA quando a Biblioteca está fechada (ele abre) e
  // ✕ quando está aberta (ele fecha). Dois botões no mesmo canto, um por estado,
  // seriam duas caixas para uma alternância.
  //
  // A ASSERÇÃO É QUAL DESENHO ESTÁ NO AR, medida no RENDERIZADO — não a
  // contagem de nós, que é a armadilha do `<use>`: a folha do documento não
  // atravessa a árvore-sombra, então um `<symbol>` com os dois desenhos dentro
  // carrega, não erra e desenha OS DOIS, empilhados, para sempre.
  const alternador = await pg.evaluate(async () => {
    const b = document.getElementById('hymnSearchToggle');
    if (!b) return { erro: 'o alternador não existe' };
    const vis = (sel) => {
      const e = b.querySelector(sel);
      return !!e && getComputedStyle(e).display !== 'none';
    };
    const sonda = () => ({ seta: vis('.ico-base'), x: vis('.ico-alt'), titulo: b.title });
    closeHymnSearch();
    await new Promise((r) => setTimeout(r, 500));
    const fechada = sonda();
    b.click();
    await new Promise((r) => setTimeout(r, 600));
    const aberta = sonda();
    const abriu = document.getElementById('hymnSearchPopup').classList.contains('open');
    b.click();
    await new Promise((r) => setTimeout(r, 600));
    const fechou = !document.getElementById('hymnSearchPopup').classList.contains('open');
    return { fechada, aberta, abriu, fechou };
  });
  checar(!alternador.erro && alternador.fechada.seta && !alternador.fechada.x
    && !alternador.aberta.seta && alternador.aberta.x,
    'o botão da Biblioteca troca de DESENHO: seta quando fechada, ✕ quando aberta '
    + '— e um só de cada vez, que é o que a árvore-sombra de um `<use>` não '
    + 'entregaria', JSON.stringify(alternador));
  checar(!alternador.erro && alternador.abriu && alternador.fechou,
    'e o MESMO botão abre e fecha — é um alternador, não dois botões no mesmo canto');
  checar(!alternador.erro && /Abrir/.test(alternador.fechada.titulo)
    && /Fechar/.test(alternador.aberta.titulo),
    'com o `title` dizendo a AÇÃO de cada estado — o desenho mostra o estado, a '
    + 'frase diz o que o toque faz',
    alternador.fechada.titulo + ' / ' + alternador.aberta.titulo);

  // ── 8. O VOLTAR SOBE DENTRO DA BÍBLIA ANTES DE FECHÁ-LA (v1.5.0) ────────
  //
  // Ela tem navegação DENTRO (livros → capítulos → leitura), e o voltar do
  // Android percorre essa hierarquia antes de fechar a folha — era o que o
  // `#backBtn` do cabeçalho carregava enquanto a Bíblia era uma aba. O botão
  // mudou de casa; a regra não. Sem este degrau, um toque no voltar com um
  // capítulo aberto fecharia a Bíblia inteira.
  const subida = await pg.evaluate(async () => {
    abrirBiblia();
    for (let i = 0; i < 60; i++) {
      if (document.querySelector('.bible-grid--books .bible-cell')) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    const cel = document.querySelector('.bible-grid--books .bible-cell');
    if (!cel) return { erro: 'a grade de livros não foi desenhada' };
    const naRaiz = document.getElementById('bibleBack').hidden;
    cel.click();
    await new Promise((r) => setTimeout(r, 300));
    const dentro = {
      voltarAceso: !document.getElementById('bibleBack').hidden,
      tela: bibleScreen,
    };
    const consumiu1 = window.__avBack();
    await new Promise((r) => setTimeout(r, 300));
    const depoisDoVoltar = { tela: bibleScreen, aberta: bibliaAberta() };
    const consumiu2 = window.__avBack();
    await new Promise((r) => setTimeout(r, 400));
    const depoisDoSegundo = bibliaAberta();
    return { naRaiz, dentro, consumiu1, depoisDoVoltar, consumiu2, depoisDoSegundo };
  });
  checar(!subida.erro && subida.naRaiz === true && subida.dentro.voltarAceso === true,
    'o VOLTAR da folha só existe fora da raiz: na tela de livros não há para onde '
    + 'voltar que não seja fechar, e fechar é o ✕ ao lado', JSON.stringify(subida));
  checar(!subida.erro && subida.consumiu1 === true
    && subida.depoisDoVoltar.tela === 'books' && subida.depoisDoVoltar.aberta === true,
    'e o voltar do aparelho SOBE dentro dela primeiro — sem este degrau um toque '
    + 'com um capítulo aberto fecharia a Bíblia inteira', JSON.stringify(subida));
  checar(!subida.erro && subida.consumiu2 === true && subida.depoisDoSegundo === false,
    'na raiz, o toque seguinte FECHA a folha — e continua consumindo o gesto, que '
    + 'é o que impede o app de minimizar no meio do culto', JSON.stringify(subida));

  // ── 9. AS TRÊS PORTAS DO RODAPÉ FICAM QUIETAS (v1.5.19) ─────────────────
  //
  // Pedido do operador: *"padronize os botões de biblia, importar e ferramentas
  // da aba de cronograma, para que tenham uma cor mais proxima a cor de fundo,
  // para que não se destaquem … preciso que sejam opções discretas, mescladas
  // ao fundo."*
  //
  // Este arquivo já era o dono das TRÊS PORTAS (o bloco 1 trava que elas são
  // três e a ordem delas), e é por isso que o desenho delas se mede aqui: uma
  // segunda casa para a mesma faixa divergiria desta no primeiro ajuste.
  //
  // ## O que falha calado aqui, e é tudo
  //
  //  - **a faixa voltar a ter um destaque.** O `--btn-accent` da do meio não
  //    era um resíduo: ele nasceu de um argumento escrito (*"quem ENTRA com
  //    conteúdo é a do meio, e ela é a única ação desta faixa"*) que caiu
  //    sozinho quando as três ganharam rótulo. Um lote futuro que reabra esse
  //    argumento não erra alto — ele devolve UMA cor a UM botão, e a palavra do
  //    pedido ("padronize") morre sem nada na tela dizendo por quê.
  //  - **a discrição virar desaparecimento.** "Mesclado ao fundo" tem um piso,
  //    e o piso é a linguagem do INDISPONÍVEL deste app (`--op-inativo`). Uma
  //    caixa mais quieta que um controle desabilitado deixa de ser encontrável
  //    — e continua tocável, que é o pior par possível.
  //  - **o rodapé PULAR ao entrar na seleção.** É um defeito LATENTE que este
  //    lote fecha: MEDIDO antes dele, `#listFoot` ia de 51,77px (as portas) para
  //    44,00 (a `.selbar`) — 7,77px de pulo debaixo do dedo que segura um item,
  //    exatamente o que o comentário do `--hit-foot` promete por escrito que não
  //    acontece. Ninguém relata isso: ele acontece no mesmo quadro em que a
  //    lista inteira troca de aparência.
  //  - **a `.selbar` ser "padronizada" junto.** Ela é a outra inquilina da
  //    fatia, e os `.sel-btn` moram EM CIMA dela: sobre uma superfície quieta o
  //    par habilitado × desabilitado cai abaixo do limiar de percepção, e o app
  //    perde a distinção entre disponível e INDISPONÍVEL na barra que hospeda o
  //    EXCLUIR.
  //  - **o ícone das três divergir.** Hoje eles coincidem por ACIDENTE (o
  //    atributo `width="20"` que o `botaoDoRodape` escreve vale exatamente
  //    `--icon-sm`), e a divergência é MUDA duas vezes: a `.import-row` é
  //    `align-items: stretch`, então a altura nunca denuncia.
  //  - **a fonte da porta do meio**, que só diverge NO APP: ali ela é um
  //    `<button>` (`usaSeletorNativo`) e a folha do agente de usuário entrega a
  //    família. Nenhum oráculo enxerga isso rodando no navegador, onde ela é um
  //    `<label>` — é a armadilha do `__tela` num lugar novo, e a resposta é
  //    criar aqui o `<button>` que o app cria.
  //
  // ## As réguas
  //
  // COR é medida por CANVAS e nunca por regex: a superfície nova COMPUTA como
  // `color(srgb 1 1 1 / 0.085098)` (medido), e uma regex de números sobre essa
  // string devolve (1, 1, 1) — o oráculo passaria a medir preto quase puro e
  // reprovaria com um número plausível.
  //
  // E a cor é a COMPOSTA, não a declarada: `--surface` é branco com ALFA, e
  // `backgroundColor` devolve o alfa, não o que se vê.
  const lin = (v) => { const n = v / 255; return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const razao = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // ΔE00 (CIEDE2000) — e ele existe porque a LUMINÂNCIA não responde a pergunta
  // deste lote. MEDIDO no tema CLARO, o `--btn-accent` mede 1,07:1 contra o
  // fundo e as laterais mediam 1,20:1: em luminância a do meio já era a mais
  // mesclada das três. O que a fazia saltar era o CROMA, que é o que a paleta
  // assinou em "a superfície de uma ação é opaca" — e é por isso que uma
  // correção só de luminância não resolveria o relato.
  const lab = ([R, G, B]) => {
    const [r, g, b] = [lin(R), lin(G), lin(B)];
    const X = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
    const Y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
    const Z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
    const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
    const fx = f(X / 0.95047); const fy = f(Y); const fz = f(Z / 1.08883);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  };
  const RAD = Math.PI / 180;
  const dE00 = (c1, c2) => {
    const [L1, a1, b1] = lab(c1); const [L2, a2, b2] = lab(c2);
    const C1 = Math.hypot(a1, b1); const C2 = Math.hypot(a2, b2); const Cb = (C1 + C2) / 2;
    const G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))));
    const A1 = (1 + G) * a1; const A2 = (1 + G) * a2;
    const P1 = Math.hypot(A1, b1); const P2 = Math.hypot(A2, b2);
    const ang = (y, x) => { if (y === 0 && x === 0) return 0; const h = Math.atan2(y, x) / RAD; return h < 0 ? h + 360 : h; };
    const h1 = ang(b1, A1); const h2 = ang(b2, A2);
    const dL = L2 - L1; const dC = P2 - P1;
    let dh = 0;
    if (P1 * P2 !== 0) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
    const dH = 2 * Math.sqrt(P1 * P2) * Math.sin((dh * RAD) / 2);
    const Lb = (L1 + L2) / 2; const Cbp = (P1 + P2) / 2;
    let hb;
    if (P1 * P2 === 0) hb = h1 + h2;
    else if (Math.abs(h1 - h2) <= 180) hb = (h1 + h2) / 2;
    else hb = h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2;
    const T = 1 - 0.17 * Math.cos((hb - 30) * RAD) + 0.24 * Math.cos(2 * hb * RAD)
      + 0.32 * Math.cos((3 * hb + 6) * RAD) - 0.20 * Math.cos((4 * hb - 63) * RAD);
    const dTh = 30 * Math.exp(-Math.pow((hb - 275) / 25, 2));
    const RC = 2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)));
    const SL = 1 + (0.015 * Math.pow(Lb - 50, 2)) / Math.sqrt(20 + Math.pow(Lb - 50, 2));
    const SC = 1 + 0.045 * Cbp; const SH = 1 + 0.015 * Cbp * T;
    const RT = -Math.sin(2 * dTh * RAD) * RC;
    return Math.sqrt(Math.pow(dL / SL, 2) + Math.pow(dC / SC, 2) + Math.pow(dH / SH, 2)
      + RT * (dC / SC) * (dH / SH));
  };
  const n2 = (x) => Math.round(x * 100) / 100;

  // A SONDA DE COR mora NA PÁGINA e a matemática mora aqui: o que atravessa a
  // ponte é `[r, g, b]` composto, que é o único formato que não depende de qual
  // sintaxe o Chromium escolheu para computar a declaração.
  await pg.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const rgba = (c) => {
      g.globalCompositeOperation = 'copy'; g.fillStyle = c; g.fillRect(0, 0, 1, 1);
      const d = g.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const pilhar = (el, comVeu) => {
      const p = []; let e = el; let veu = 1;
      while (e) {
        const cs = getComputedStyle(e);
        if (comVeu && e === el) veu = parseFloat(cs.opacity) || 1;
        const v = rgba(cs.backgroundColor);
        if (v[3] > 0) p.push(v);
        if (v[3] === 1) break;
        e = e.parentElement;
      }
      let o = p.pop() || [255, 255, 255, 1];
      while (p.length) {
        const t = p.pop();
        o = [0, 1, 2].map((i) => t[3] * t[i] + (1 - t[3]) * o[i]).concat([1]);
      }
      return [o, veu];
    };
    // O VÉU DO PRÓPRIO ELEMENTO entra na conta: um `:disabled` deste app é
    // `opacity: var(--op-inativo)`, e o que ele PINTA é a superfície dele
    // composta contra o pai. Sem isto o piso da asserção C seria a superfície
    // CHEIA de um botão apagado — a cor que ele não tem na tela.
    window.__efetivo = (el) => {
      if (!el) return null;
      const [o, veu] = pilhar(el, true);
      let cor = o;
      if (veu < 1 && el.parentElement) {
        const pai = pilhar(el.parentElement, false)[0];
        cor = [0, 1, 2].map((i) => o[i] * veu + pai[i] * (1 - veu));
      }
      return cor.slice(0, 3);
    };
    // A SONDA DO "ANTES" pousa na MESMA fileira: `--surface` não tem valor
    // único (a regra R1 o troca por `--surface-sunk` dentro de quem pinta
    // `--panel`), então medi-lo fora do habitat mediria outro token.
    // Layout-neutra de propósito — `.import-row` é flex, e um quarto filho de
    // largura real repartiria a faixa e mudaria o que se veio medir.
    window.__sonda = (css) => {
      const row = document.querySelector('.import-row');
      if (!row) return null;
      const d = document.createElement('div');
      d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;' + css;
      row.appendChild(d);
      const c = window.__efetivo(d);
      d.remove();
      return c;
    };
  });

  // UM ITEM DE VERDADE NO CRONOGRAMA, porque a seleção múltipla é o segundo
  // inquilino da fatia e não existe sem lista. `fileAdd` + `listAdd` é a MESMA
  // forma que o download de coleção grava — `addMedia` é a porta do IMPORT.
  // REVERSÃO: semear sem o `listAdd('imports', …)` — a lista fica vazia, a
  // seleção não tem em que entrar e o D deixa de medir o que promete.
  const itens = await pg.evaluate(new Function(`return (async () => {
    const sr = 8000, n = sr * 5;
    const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
    const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    wr(36, 'data'); dv.setUint32(40, n * 2, true);
    // DOIS itens, e o segundo não é enfeite: com UM selecionado nenhum
    // \`.sel-btn\` fica desabilitado (\`selRename.disabled = selected.size !== 1\`),
    // e é o par habilitado × DESABILITADO que o 9-E mede.
    for (const n of [1, 2]) {
      const caminho = 'folders/rodape/porta-' + n + '.wav';
      await AVDB.opfsWriteFile(caminho, new Blob([buf], { type: 'audio/wav' }));
      await AVDB.fileAdd({ id: 'porta-' + n, folder: 'rodape', opfsPath: caminho,
        srcName: 'porta-' + n, name: 'Item ' + n + ' do rodapé', type: 'audio/wav',
        kind: 'audio', size: 1, mtime: Date.now(), thumb: null, lyrics: null,
        blob: null, url: null, addedAt: Date.now() });
      await AVDB.listAdd('imports', 'porta-' + n);
    }
    await load();
    return document.querySelectorAll('#library li').length;
  })()`));
  checar(itens >= 2,
    'ponto de partida: há dois itens no Cronograma — um para a seleção tomar a '
    + 'fatia do rodapé, dois para ela DESABILITAR um `.sel-btn`', itens);

  const temaOriginal = await pg.evaluate(() => document.documentElement.getAttribute('data-tema'));

  for (const tema of ['escuro', 'claro']) {
    const m = await pg.evaluate((t) => {
      document.documentElement.setAttribute('data-tema', t);
      const bib = document.getElementById('bibleBtn');
      const imp = document.querySelector('.import-row .import-btn');
      const fer = document.getElementById('toolsBtn');
      const row = document.querySelector('.import-row');
      const cs = (e) => getComputedStyle(e);
      const tres = [bib, imp, fer];
      return {
        cores: tres.map((e) => window.__efetivo(e).map((v) => Math.round(v * 100) / 100)),
        // A MESMA COR, SEM ARREDONDAR: `cores` é arredondado para a comparação
        // de igualdade do 9-A (e para caber no log), e a aritmética de contraste
        // do 9-B/9-C não pode usá-lo — as sondas do "antes" vêm cruas, e um
        // centésimo de diferença entre as duas réguas transformava um EMPATE
        // (que é o que a reversão do 9-B produz) num "passou" por acidente.
        base: window.__efetivo(bib),
        cru: tres.map((e) => cs(e).backgroundColor),
        alturas: tres.map((e) => Math.round(e.getBoundingClientRect().height * 100) / 100),
        raios: tres.map((e) => cs(e).borderRadius),
        fontes: tres.map((e) => cs(e).fontFamily),
        icones: tres.map((e) => cs(e.querySelector('svg')).width),
        // O fundo em que elas de fato pousam, e não um token digitado aqui.
        fundo: window.__efetivo(row),
        hit: parseFloat(cs(document.documentElement).getPropertyValue('--hit')),
        // O "ANTES" deste lote, medido no habitat: `--surface` puro é o que as
        // LATERAIS tinham, `--btn-accent` é o que a do MEIO tinha.
        antesLateral: window.__sonda('background: var(--surface)'),
        antesMeio: window.__sonda('background: var(--btn-accent)'),
        // O PISO: a linguagem do INDISPONÍVEL deste app — a superfície padrão
        // de um controle sob `opacity: var(--op-inativo)` (`.sel-btn:disabled`,
        // `.t-btn:disabled`). Ele é MEDIDO, e não escrito: um número copiado
        // para cá envelheceria na primeira troca de alfa da paleta.
        inativo: window.__sonda('background: var(--surface); opacity: var(--op-inativo)'),
      };
    }, tema);

    // ── 9-A · AS TRÊS SÃO IGUAIS ────────────────────────────────────────
    //
    // É a palavra do pedido ("padronize"), e ela é medível em cinco eixos. Em
    // COR ela é o que morde: as outras quatro já eram verdade antes do lote.
    // REVERSÃO: devolver `background: var(--btn-accent)` à `.import-btn` (a
    // regra agrupada de que ela saiu neste lote) — as laterais ficam na
    // superfície quieta e a do meio volta a saltar.
    const iguais = (v) => JSON.stringify(v[0]) === JSON.stringify(v[1])
      && JSON.stringify(v[1]) === JSON.stringify(v[2]);
    checar(iguais(m.cores),
      '[' + tema + '] A · as três portas pintam a MESMA cor COMPOSTA — a palavra '
      + 'do pedido é "padronize", e a do meio era a que saltava', m.cores);
    // A altura é quase tautológica (`.import-row` é `align-items: stretch`, e
    // as três esticam para a mais alta) e está aqui para o dia em que alguém
    // der `align-self` a uma delas: um botão mais baixo que os irmãos lê como
    // acessório de um deles, não como a terceira porta da mesma faixa.
    checar(iguais(m.alturas) && iguais(m.raios) && iguais(m.icones),
      '[' + tema + '] A · e a mesma altura, o mesmo raio e o mesmo ícone',
      JSON.stringify([m.alturas, m.raios, m.icones]));
    // NO NAVEGADOR a do meio é um `<label>` e herda de qualquer forma — esta
    // metade morde nas duas LATERAIS, que são `<button>`. O caso do APP é o
    // 9-I, logo abaixo.
    checar(iguais(m.fontes),
      '[' + tema + '] A · e a mesma família de fonte', m.fontes);

    // ── 9-B · ELAS SÃO DISCRETAS, COM NÚMERO ────────────────────────────
    //
    // A RÉGUA É UMA PORTA SÓ, e de propósito: o 9-A já provou que as três
    // pintam a mesma cor. Medir as três aqui faria a reversão do 9-A reprovar
    // este bloco junto, e cada asserção tem de ter a sua.
    //
    // DUAS PROPRIEDADES, porque nenhuma delas vale sozinha nos dois temas:
    //
    //  1. em LUMINÂNCIA, a superfície nova é mais quieta que a que as LATERAIS
    //     tinham (`--surface` puro). É a reversão exata deste lote — sem o
    //     `color-mix` a razão sobe — e ela vale nos dois temas.
    //  2. em ΔE00, ela é mais quieta que a que a do MEIO tinha
    //     (`--btn-accent`). A luminância NÃO serve para este par: MEDIDO, no
    //     tema claro o azul media 1,07:1 contra o fundo e as laterais 1,20:1 —
    //     ele já era o mais mesclado dos três em luminância, e o que o fazia
    //     saltar era o CROMA. Afirmar "abaixo do `--btn-accent` em razão de
    //     contraste, nos dois temas" seria escrever uma asserção FALSA no
    //     claro; a régua honesta ali é a diferença perceptual.
    //
    // Mais uma FAIXA, e não um valor: 1,23 (escuro) e 1,14 (claro) são o mix de
    // hoje, e um ajuste legítimo de 50% a 85% tem de continuar passando.
    // REVERSÃO: apagar a linha `background: color-mix(in srgb, var(--surface)
    // 70%, transparent)` da regra `.tools-btn, .lib-foot-btn, .import-btn` —
    // sobra o `--surface` puro (a falha aberta declarada), e a razão sobe para
    // 1,39 no escuro e 1,20 no claro.
    const rPorta = razao(m.base, m.fundo);
    const rLateral = razao(m.antesLateral, m.fundo);
    const eMeio = dE00(m.antesMeio, m.fundo);
    const ePorta = dE00(m.base, m.fundo);
    checar(rPorta < rLateral,
      '[' + tema + '] B · a superfície das portas é mais quieta EM LUMINÂNCIA do '
      + 'que a que as laterais tinham (`--surface` puro)',
      n2(rPorta) + ' < ' + n2(rLateral));
    checar(ePorta < eMeio,
      '[' + tema + '] B · e mais quieta EM ΔE00 do que a que a do meio tinha '
      + '(`--btn-accent`) — no claro o azul já era o mais mesclado em '
      + 'luminância, e quem o fazia saltar era o CROMA',
      n2(ePorta) + ' < ' + n2(eMeio));
    checar(rPorta >= 1.05 && rPorta <= 1.35,
      '[' + tema + '] B · e a razão fica na faixa que um ajuste de mix entre 50% '
      + 'e 85% não estoura — o oráculo trava a PROPRIEDADE, não o valor de hoje',
      n2(rPorta));

    // ── 9-C · MAS ELAS NÃO SOMEM ────────────────────────────────────────
    //
    // O PISO É MEDIDO, e não escrito: ele é o tom que este app usa para dizer
    // INDISPONÍVEL — a mesma caixa, a mesma superfície, sob
    // `opacity: var(--op-inativo)`. Uma porta mais quieta que um controle
    // desabilitado deixa de ser encontrável e continua tocável, que é o pior
    // par que esta faixa pode produzir.
    // REVERSÃO: `color-mix(in srgb, var(--surface) 30%, transparent)` — MEDIDO,
    // a razão cai para 1,08 (escuro) e 1,06 (claro), abaixo do piso nos DOIS.
    const rInativo = razao(m.inativo, m.fundo);
    checar(rPorta > rInativo,
      '[' + tema + '] C · e mesmo assim elas ficam ACIMA do tom do '
      + '`--op-inativo` — "mesclado ao fundo" tem piso, e o piso é a linguagem '
      + 'do INDISPONÍVEL deste app',
      n2(rPorta) + ' > ' + n2(rInativo));

    // ── 9-G · O ALVO NÃO DESCEU DO PISO ─────────────────────────────────
    //
    // Baixar a faixa foi metade do pedido, e o `--hit` é o chão que ela não
    // pode furar. A conta é contra o TOKEN resolvido, nunca contra 34 digitado
    // aqui — um literal envelhece parecendo correto.
    // REVERSÃO: `--hit: 34px` → `44px` em `controle.css`, prendendo a `.sel-btn`
    // em `34px` no mesmo patch. A segunda linha não é cerimônia: `--hit` é a
    // altura da `.sel-btn`, e a fatia do rodapé é COMUM às duas inquilinas —
    // sem prendê-la, subir o piso do app move a `.selbar` e reprova o 9-D
    // junto, que é outra asserção sobre o mesmo número.
    checar(Math.min(...m.alturas) >= m.hit,
      '[' + tema + '] G · as três continuam com pelo menos `--hit` de altura — a '
      + 'faixa ficou mais baixa, não menor que o piso de alvo do app',
      JSON.stringify(m.alturas) + ' vs --hit ' + m.hit);

    // ── 9-D · O RODAPÉ NÃO PULA AO ENTRAR NA SELEÇÃO ────────────────────
    //
    // As duas inquilinas da fatia PRECISAM medir o mesmo — está escrito no
    // comentário do `--hit-foot` —, e MEDIDO antes deste lote elas não mediam:
    // 51,77px de portas contra 44,00 da barra, 7,77px de pulo debaixo do dedo
    // que segura um item. O termo que mandava na altura era o `padding`
    // VERTICAL, e o token ficava INERTE.
    // A entrada é pelo CAMINHO REAL (`enterSelection`, o mesmo que o toque
    // longo chama), e não por um `hidden` mexido à mão: é ele que passa pelo
    // `renderSelbar` → `renderListFoot`, onde a troca de inquilino acontece.
    // REVERSÃO: devolver `padding: .45rem .3rem` às duas regras das portas
    // (`.tools-btn, .lib-foot-btn` e `.import-btn`) — o rodapé volta a 51,77
    // fora da seleção e 42,00 dentro.
    //
    // ── 9-E · A `.selbar` NÃO FICOU DISCRETA ────────────────────────────
    // ── 9-F · O RAIO CONTINUA UM SÓ PARA AS QUATRO ──────────────────────
    const sel = await pg.evaluate(() => {
      const foot = document.getElementById('listFoot');
      const h = () => Math.round(foot.getBoundingClientRect().height * 100) / 100;
      const fora = h();
      const foraRaio = getComputedStyle(document.querySelector('.import-row .import-btn')).borderRadius;
      enterSelection('porta-1');
      const sb = document.getElementById('selbar');
      const r = {
        fora,
        foraRaio,
        dentro: h(),
        naFatia: sb.parentElement === foot && !sb.hidden,
        conta: document.getElementById('selCount').textContent,
        selbarRaio: getComputedStyle(sb).borderRadius,
        selbar: window.__efetivo(sb),
        selbarCru: getComputedStyle(sb).backgroundColor,
      };
      // O SEGUNDO item entra pelo caminho real (`toggleSelect`), que é o toque
      // seguinte do operador: com dois na mão o "Renomear" não faz sentido e o
      // app o desabilita. É esse par que o 9-E mede.
      toggleSelect('porta-2');
      const hab = document.getElementById('selPlaylist');
      const des = document.getElementById('selRename');
      r.conta2 = document.getElementById('selCount').textContent;
      r.habilitado = window.__efetivo(hab);
      r.desabilitado = window.__efetivo(des);
      r.parCoerente = !hab.disabled && des.disabled;
      r.dentroDois = h();
      exitSelection();
      r.depois = h();
      return r;
    });
    checar(sel.naFatia && sel.conta === '1' && sel.conta2 === '2' && sel.parCoerente,
      '[' + tema + '] D · ponto de partida: a seleção múltipla entra pelo caminho '
      + 'real, a `.selbar` toma a fatia do rodapé, e com DOIS itens na mão o '
      + '"Renomear" fica desabilitado', sel);
    checar(Math.abs(sel.dentro - sel.fora) <= 0.5 && Math.abs(sel.dentroDois - sel.fora) <= 0.5
      && Math.abs(sel.depois - sel.fora) <= 0.5,
      '[' + tema + '] D · e o rodapé NÃO PULA: a fatia mede o mesmo com as três '
      + 'portas e com a barra de seleção — era 51,77 → 42,00, um pulo de 7,77px '
      + 'debaixo do dedo que segura um item',
      JSON.stringify([sel.fora, sel.dentro, sel.depois]));
    // O RAIO É GEOMETRIA, não cor, e é por isso que ele ficou na regra agrupada
    // quando o preenchimento se partiu por habitat: a `.selbar` base declara
    // `--radius-card` (10px), e é aquela linha que a põe em `--radius-btn`.
    // REVERSÃO: tirar `.list-foot > .selbar` do grupo do raio — ela volta a
    // 10px, sem erro e sem nada mais na tela mudando.
    checar(sel.selbarRaio === sel.foraRaio && m.raios.every((r) => r === sel.selbarRaio),
      '[' + tema + '] F · o raio é UM SÓ para as quatro inquilinas da fatia (as '
      + 'três portas e a `.selbar`) — a base dela declara `--radius-card`, e '
      + 'quem a puxa para `--radius-btn` é a regra agrupada',
      JSON.stringify([m.raios, sel.selbarRaio]));
    if (tema === 'claro') {
      // ── 9-E · A `.selbar` NÃO FICOU DISCRETA ──────────────────────────
      //
      // O PAR É habilitado × DESABILITADO, e não o botão contra a barra. Os
      // dois são a MESMA superfície (`--surface-2`, branco a .92); o que
      // separa um do outro é o VÉU do `:disabled`, que compõe contra a barra —
      // logo é o tom DA BARRA que decide se o par sobrevive. MEDIDO sob a
      // reversão: o par habilitado × barra fica em 2,96 (acima do limiar, não
      // morde) e o par habilitado × desabilitado cai a 1,91, abaixo dos 2,3.
      // Afirmar o primeiro seria escrever uma asserção que passa nas duas
      // versões.
      //
      // E O TEMA CLARO É O ÚNICO QUE FECHA A CONTA — é o da captura do
      // operador: sobre uma superfície quase branca o véu quase não tem para
      // onde ir. MEDIDO no escuro, o mesmo par vai de 8,06 para 8,42 sob a
      // reversão, isto é, ele nem sente. Afirmar "nos dois temas" seria
      // afirmar onde não morde.
      // REVERSÃO: mover `.list-foot > .selbar` da regra do `--btn-accent` para
      // a regra da superfície discreta (`.tools-btn, .lib-foot-btn,
      // .import-btn`) — a "padronização" que o pedido não pediu.
      const eSel = dE00(sel.habilitado, sel.desabilitado);
      checar(eSel >= 2.3,
        '[claro] E · a `.selbar` NÃO entrou na padronização: sobre ela o par '
        + '`.sel-btn` habilitado × DESABILITADO continua acima do limiar de '
        + 'percepção — é a barra que hospeda o EXCLUIR, e sobre uma superfície '
        + 'quieta o app perderia a distinção entre disponível e INDISPONÍVEL',
        n2(eSel));
    }
  }
  await pg.evaluate((t) => {
    if (t === null) document.documentElement.removeAttribute('data-tema');
    else document.documentElement.setAttribute('data-tema', t);
  }, temaOriginal);

  // ── 9-H · NENHUM RÓTULO SAI COM RETICÊNCIAS ────────────────────────────
  //
  // A pergunta é `scrollWidth <= clientWidth` do `<span>`, e NÃO a largura
  // absoluta do texto: a base pede `system-ui, -apple-system, sans-serif`, então
  // quem responde por quantos pixels "Ferramentas" ocupa é a fonte instalada na
  // máquina. O que se afirma é a RELAÇÃO entre duas medidas do mesmo desenho, e
  // é a mesma pergunta que o `text-overflow: ellipsis` faz.
  //
  // E O QUE ESTE ORÁCULO NÃO PODE AFIRMAR, dito: que o rótulo CABE no terço. A
  // margem a 320px é de 0,2px (MEDIDO: o terço útil vale 83,2 e "Ferramentas"
  // pede 83,0 na fonte desta máquina), então uma asserção de "cabe" viraria
  // medida do runner — a fonte de lá é outra, e ela reprovaria um app correto.
  // O que cabe ou não cabe no aparelho é decisão do `--fs-md` e está MEDIDA no
  // comentário da folha.
  //
  // NA PILHA O `<span>` NUNCA É CLAMPADO — `align-items: center` num flex
  // COLUMN não limita a largura do item, então ele TRANSBORDA em vez de sair
  // cortado. É essa propriedade que a primeira asserção guarda, e ela é o
  // argumento da folha (*"empilhado, a palavra tem a largura inteira do
  // terço"*).
  //
  // E É PRECISO DIZER O QUE ELA **NÃO** GUARDA, senão ela vira uma tautologia
  // que se lê como proteção. MEDIDO forçando o rótulo a crescer a 320px: com
  // `font-size: 4rem` o `<span>` de "Ferramentas" pede **403,34px** dentro de um
  // botão de 92,8 e a faixa transborda 156px — e a asserção do `<span>` PASSA,
  // porque na pilha `clientWidth === scrollWidth` sempre. Ela responde
  // *"o arranjo continua sendo pilha"*, e mais nada.
  //
  // POR ISSO A SEGUNDA, que é a pergunta de verdade: a FAIXA não transborda a
  // caixa dela. Continua sendo uma RELAÇÃO entre duas medidas do mesmo desenho
  // — nenhum número de largura escrito aqui —, mas esta pode reprovar no
  // defeito que nomeia. A margem é apertada e está MEDIDA: a 320px a
  // `.import-row` fecha em **294 × 294**, com ~10px de folga por terço. A fonte
  // do runner não é a do Android, e por isso a margem importa: nesta máquina
  // `system-ui` resolve para DejaVu Sans, que MEDI ser a MAIS LARGA das nove
  // instaladas ("Nada em exibição": DejaVu 136,5 · Liberation 121,6 · WenQuanYi
  // 118,3 · FreeSans 117,5) — uma fonte diferente dá MAIS folga, não menos.
  // REVERSÃO: `flex-direction: column` → `row` nas duas regras das portas — o
  // arranjo anterior à v1.5.0, em que o rótulo divide o eixo principal com o
  // ícone e encolhe. MEDIDO a 320px: "Ferramentas" passa a `clientWidth` 61
  // contra `scrollWidth` 83, isto é, reticências que não dizem qual palavra
  // foi cortada. A da FAIXA reprova com qualquer coisa que a faça transbordar —
  // um `--fs-md` maior, um rótulo mais longo, um recuo horizontal maior.
  for (const largura of [430, 393, 360, 320]) {
    await pg.setViewportSize({ width: largura, height: 892 });
    const corte = await pg.evaluate(() => {
      const q = (sel) => {
        const e = document.querySelector(sel);
        const sp = e.querySelector('span');
        return { texto: sp.textContent, sobra: Math.round((sp.clientWidth - sp.scrollWidth) * 100) / 100 };
      };
      const row = document.querySelector('.import-row');
      return { portas: [q('#bibleBtn'), q('.import-row .import-btn'), q('#toolsBtn')],
        faixa: { scroll: row.scrollWidth, client: row.clientWidth } };
    });
    checar(corte.portas.every((c) => c.sobra >= 0),
      'H · a ' + largura + 'px o arranjo continua sendo PILHA: nenhum rótulo é '
      + 'clampado, logo nenhum sai com reticências — elas são piores que a '
      + 'palavra curta, porque não dizem qual palavra foi cortada',
      JSON.stringify(corte.portas));
    checar(corte.faixa.scroll <= corte.faixa.client,
      'H · e a ' + largura + 'px a FAIXA não transborda a caixa dela — é esta '
      + 'que pode reprovar de verdade: a do `<span>` passa com o rótulo a 403px '
      + 'dentro de um botão de 93, porque na pilha ele nunca é clampado',
      JSON.stringify(corte.faixa));
  }
  await pg.setViewportSize({ width: 412, height: 892 });

  // ── 9-I · A FONTE DA PORTA DO MEIO ─────────────────────────────────────
  //
  // ESTA ASSERÇÃO EXISTE PORQUE O DEFEITO SÓ APARECE NO APP. No navegador a
  // porta do meio é um `<label>`, e um `<label>` herda a família do `body` de
  // graça; no app ela é um `<button>` (`usaSeletorNativo`), e a folha do agente
  // de usuário entrega a família — que o `font-size` sobrescreve e a
  // `font-family` não. É a armadilha do `__tela` num lugar novo: ler o lado que
  // o oráculo alcança aprova os dois.
  // A resposta é criar AQUI o `<button class="import-btn">` que o app cria, na
  // MESMA fileira (a família é herdada, então o lugar é a pergunta).
  // REVERSÃO: tirar `font-family: inherit` da regra `.import-btn` — o botão
  // sonda passa a computar a família do agente de usuário e diverge do
  // `#toolsBtn`, que é `<button>` também e já tinha a linha.
  const fonte = await pg.evaluate(() => {
    const row = document.querySelector('.import-row');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'import-btn';
    b.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    row.appendChild(b);
    const r = {
      sonda: getComputedStyle(b).fontFamily,
      ferramentas: getComputedStyle(document.getElementById('toolsBtn')).fontFamily,
      corpo: getComputedStyle(document.body).fontFamily,
      eBotao: b.tagName,
      noNavegador: document.querySelector('.import-row .import-btn').tagName,
    };
    b.remove();
    return r;
  });
  checar(fonte.noNavegador === 'LABEL' && fonte.eBotao === 'BUTTON',
    'I · ponto de partida: no navegador a porta do meio é um `<label>` (por isso '
    + 'nenhum oráculo via isto), e a sonda é o `<button>` que o app cria', fonte);
  checar(fonte.sonda === fonte.ferramentas && fonte.sonda === fonte.corpo,
    'I · e como `<button>` ela herda a MESMA família das irmãs — sem '
    + '`font-family: inherit` a folha do agente de usuário entrega outra, e o '
    + 'MESMO rótulo muda de largura no aparelho', fonte);

  // ── 9-I2 · A FATIA SEGUE O TOKEN, E ISSO É OUTRA PERGUNTA ──────────────
  //
  // A asserção do PULO (9-D) diz que as duas inquilinas da fatia medem o mesmo.
  // Ela não tem teto: MEDIDO, devolvendo `padding: .45rem .3rem` às portas E
  // subindo `--hit-foot` para 51,77px, o bloco inteiro fica VERDE com a faixa de
  // volta ao tamanho que este lote existiu para derrubar. Isto é: ela guarda
  // *"pararam de pular"* e não *"pararam de ser altas"*.
  //
  // O que falta é a afirmação sobre o TOKEN, e ela é a razão escrita da
  // correção: *"o recuo VERTICAL saiu porque era ele, e não o `--hit-foot`, o
  // termo que mandava na altura — varrê-lo de 48 a 36px não mudava um pixel"*.
  // A régua é a do 9-J: FORÇAR o token e exigir que as quatro peças o sigam.
  // Os valores da sonda ficam ACIMA do piso de `min-content` (37,39px com o
  // ícone em 20 e o rótulo em `--fs-md`), senão a sonda mede o piso e não o
  // token — que é justamente o que acontecia antes do lote.
  // REVERSÃO: `padding: .45rem .3rem` de volta nas duas regras das portas. Com
  // ela o conteúdo volta a mandar e as portas ficam em 51,77 nas duas sondas,
  // enquanto a `.selbar` segue o token — que é o defeito, dito por inteiro.
  const fatia = await pg.evaluate(async () => {
    const de = document.documentElement;
    const li = [...document.querySelectorAll('#library li')].find((n) => n.dataset.id);
    const alturas = () => ['#bibleBtn', '.import-row .import-btn', '#toolsBtn']
      .map((sel) => Math.round(document.querySelector(sel).getBoundingClientRect().height * 100) / 100);
    const daSelbar = () => {
      const sb = document.querySelector('.list-foot > .selbar');
      return sb ? Math.round(sb.getBoundingClientRect().height * 100) / 100 : null;
    };
    const sondar = (v) => {
      de.style.setProperty('--hit-foot', v);
      return { token: v, portas: alturas() };
    };
    const p42 = sondar('42px');
    const p56 = sondar('56px');
    de.style.removeProperty('--hit-foot');
    // A `.selbar` na MESMA sonda: ela é a outra inquilina, e o token só amarra
    // as duas enquanto for o termo que manda dos DOIS lados.
    if (li) enterSelection(li.dataset.id);
    await new Promise((f) => setTimeout(f, 200));
    de.style.setProperty('--hit-foot', '56px');
    const s56 = daSelbar();
    de.style.removeProperty('--hit-foot');
    const sPadrao = daSelbar();
    if (typeof exitSelection === 'function') exitSelection();
    await new Promise((f) => setTimeout(f, 200));
    return { p42, p56, s56, sPadrao, depois: alturas() };
  });
  checar(fatia.p42.portas.every((h) => Math.abs(h - 42) <= 0.5)
    && fatia.p56.portas.every((h) => Math.abs(h - 56) <= 0.5),
    'I2 · as três portas SEGUEM o `--hit-foot`: forçado o token, elas o medem — '
    + 'antes deste lote o termo que mandava era o `padding`, e varrer o token de '
    + '48 a 36px não movia um pixel', JSON.stringify(fatia));
  checar(fatia.s56 !== null && Math.abs(fatia.s56 - 56) <= 0.5,
    'I2 · e a `.selbar` segue o MESMO token — é essa igualdade que faz as duas '
    + 'inquilinas da fatia medirem o mesmo, e é por ela que o rodapé não pula',
    JSON.stringify(fatia));
  checar(fatia.depois.every((h) => Math.abs(h - 42) <= 0.5),
    'I2 · e a folha volta ao valor dela depois da sonda, para o resto do arquivo '
    + 'não medir uma tela adulterada', JSON.stringify(fatia));

  // ── 9-J · O ÍCONE DAS TRÊS SAI DO MESMO LUGAR ──────────────────────────
  //
  // Hoje os três medem 20px, e até este lote isso era ACIDENTE: só a do meio
  // estava na lista `:is()` do `svg`, e as laterais viviam do atributo
  // `width="20"` que o `botaoDoRodape` escreve — que vale exatamente
  // `--icon-sm`. A divergência era MUDA duas vezes: nada na tela muda enquanto
  // o token for 20, e a ALTURA nunca denuncia, porque a `.import-row` é
  // `align-items: stretch` e as três esticam para a mais alta.
  // A régua é FORÇAR o token: é a única pergunta que separa "sai do token" de
  // "coincide com ele".
  // REVERSÃO: tirar `.tools-btn, .lib-foot-btn` da lista `:is()` do `svg` — com
  // `--icon-sm: 26px` a do meio vai a 26 e as laterais ficam em 20.
  const icone = await pg.evaluate(() => {
    const de = document.documentElement;
    const ler = () => ['#bibleBtn', '.import-row .import-btn', '#toolsBtn']
      .map((s) => getComputedStyle(document.querySelector(s).querySelector('svg')).width);
    const padrao = ler();
    de.style.setProperty('--icon-sm', '26px');
    const forcado = ler();
    de.style.removeProperty('--icon-sm');
    return { padrao, forcado, depois: ler() };
  });
  checar(icone.forcado.every((w) => w === '26px'),
    'J · o ícone das três sai de `--icon-sm`: forçado o token, os TRÊS `svg` '
    + 'acompanham — antes deste lote as laterais viviam do atributo `width="20"` '
    + 'e coincidiam por acidente', JSON.stringify(icone));
  checar(icone.depois.join() === icone.padrao.join(),
    'J · e o token volta ao valor da folha depois da sonda, para o resto do '
    + 'arquivo não medir uma tela adulterada', JSON.stringify(icone));

  checar(erros.length === 0, 'nenhum erro de página', erros);
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
