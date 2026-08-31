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
//
//   node tools/ferramentas-folha.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml',
};
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arquivo = path.join(RAIZ, p);
  if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404); res.end('nao'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
});

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

await new Promise((r) => servidor.listen(0, r));
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
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

  // ── 3. A FOLHA SOBE DENTRO DO CRONOGRAMA, NÃO SOBRE A TELA ──────────────
  await pg.click('#toolsBtn');
  await pg.waitForTimeout(400);   // a entrada é uma animação de 220 ms
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
