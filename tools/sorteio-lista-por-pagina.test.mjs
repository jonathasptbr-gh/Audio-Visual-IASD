// A LISTA DE RESULTADOS DA PLAYLIST AUTOMÁTICA: DE CEM EM CEM, E DEPOIS DE UM
// RESPIRO (v1.8.100).
//
// Relato do operador: *"estou sentindo um leve travamento na abertura da janela
// de playlist automática. Imagino que seja por causa da lista de resultados que
// já fica à mostra… utilize um spinner temporário durante a animação e após um
// segundo carregando… então o spinner sai e exibe a lista. Outra coisa… pode
// exibir os resultados de 100 em 100, carregando mais conforme rolar até o fim
// da lista. (É claro que todos os resultados serão incluídos nas opções do
// sorteio, mas apenas a visualização da lista que será limitada)"*.
//
// ## Por que ele é um arquivo à parte
//
// O `sorteio-tela.test.mjs` já mede a folha inteira e leva minutos; este mede
// uma coisa só e precisa de um acervo GRANDE, que é caro de plantar. Separado,
// ele planta 300 faixas uma vez e roda em segundos.
//
// ## O que falha calado aqui
//
//  - **A PÁGINA VIRAR UM TETO.** O corte é de VISTA: quem sorteia é o pool
//    inteiro. Um `slice` que escapasse para o `sorteioLista` faria o operador
//    pedir 30 de um acervo de 1.100 e receber 30 dos 100 primeiros — sem erro,
//    e com a contagem acima dizendo o número certo.
//  - **O ARO VIRAR ESPERA INVENTADA.** Com o pool cabendo numa página a lista
//    sai em milissegundos (MEDIDO: 19 ms), e um segundo de aro ali é pior que o
//    travamento que ele veio cobrir — porque acontece SEMPRE.
//  - **A FOLHA CRESCER quando a lista chega.** O aro é um segundo; se a folha
//    abre curta e cresce depois, o que o conserto de desempenho comprou foi um
//    motor de pulo (a regra da v1.8.61).
//  - **CRESCER REMONTANDO.** Mostrar mais cem redesenhando a lista devolve a
//    rolagem ao topo — o defeito que a v1.8.85 consertou, de volta pela porta
//    dos fundos.
//
//   node tools/sorteio-lista-por-pagina.test.mjs
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, porque } from './arnes.mjs';
import { checar, falhas } from './checar.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..',
  'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 412, height: 892 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', (e) => erros.push(e.message));

// O ACERVO: 300 faixas, TRÊS páginas. Duas não bastam — com duas, "cresce de
// cem em cem" e "mostra tudo depois da primeira rolagem" desenham o mesmo
// número.
const SEMEAR = (n) => pg.evaluate(async (quantas) => {
  const songs = [];
  for (let i = 1; i <= quantas; i++) {
    songs.push({ id_music: 'h' + i, track: i, name: 'Hino ' + i, duration: '3:00',
      has_instrumental_music: false, fileIdFull: null, fileIdPlayback: null });
  }
  collState['hymnal-2022'] = { songs };
  albumCatalog = { categories: [], albums: [] };
  await ensureLyricIndex();
}, n);

const foto = () => pg.evaluate(() => {
  const res = document.querySelector('#sorteioList .sorteio-res');
  const cab = document.querySelector('#sorteioList .sorteio-res-cab');
  const sheet = document.querySelector('#sorteioPopup .popup-sheet');
  const barra = document.querySelector('#sorteioList .sorteio-barra');
  const lista = document.getElementById('sorteioList');   // ele É a `.popup-list`
  return {
    aro: !!(res && res.querySelector('.dl-ring')),
    aquecendo: !!(res && res.classList.contains('aquecendo')),
    linhas: document.querySelectorAll('#sorteioList .sorteio-res-btn').length,
    conta: cab ? cab.textContent : null,
    folha: Math.round(sheet.getBoundingClientRect().height),
    // DENTRO DA FOLHA, e não na tela: a folha ENTRA deslizando, e um retângulo
    // lido no meio da animação mede a animação — MEDIDO, 12px de diferença aos
    // 250 ms. O que a asserção quer saber é se a barra andou em relação ao que
    // a hospeda.
    barraTopo: Math.round(barra.getBoundingClientRect().top
      - sheet.getBoundingClientRect().top),
    // "SÓ A LISTA ROLA" (v1.8.85): a folha não pode passar a rolar durante o
    // aquecimento, que é o que um piso escrito na LISTA produziria.
    folhaRola: Math.round(lista.scrollHeight - lista.clientHeight),
    pool: sorteioPool().itens.length,
  };
});

try {
  await pg.goto('http://localhost:' + servidor.address().port + '/controle/',
    { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.AVDB && window.AVSorteio && typeof window.__avBack === 'function',
    null, { timeout: 30000 });
  await esperarCortina(pg);
  await pg.evaluate(() => setAppMode('full'));

  // ── A. O RESPIRO, COM ACERVO GRANDE ─────────────────────────────────────
  await SEMEAR(300);
  await pg.evaluate(() => abrirSorteio());
  await pg.waitForTimeout(250);
  const durante = await foto();
  checar(durante.pool === 300 && durante.aquecendo && durante.aro
    && durante.linhas === 0,
    'A · com o acervo grande a folha abre com o ARO e nenhuma linha — é o '
    + 'respiro que tira o custo da lista de cima da animação de entrada',
    JSON.stringify(durante));
  // A CONTAGEM NÃO ESPERA. Ela é a resposta a "quantos são?", já está na mão, e
  // segurá-la deixaria o operador um segundo sem resposta nenhuma.
  checar(/^300 resultados/.test(durante.conta || ''),
    'A · e a CONTAGEM já está lá durante o aro: o que aquece é a LISTA, e o '
    + 'número não custa nada', durante.conta);

  const chegou = await esperar(pg,
    () => document.querySelectorAll('#sorteioList .sorteio-res-btn').length > 0,
    null, 6000);
  const depois = await foto();
  checar(chegou === true && !depois.aro && depois.linhas === 100,
    'A · e passado o respiro o aro sai e entram CEM linhas — a primeira página',
    porque(chegou) || JSON.stringify(depois));
  // A FOLHA NÃO MUDA DE TAMANHO entre os dois estados. Ela é a régua que separa
  // "o custo saiu da animação" de "o custo virou um pulo um segundo depois".
  checar(durante.folha === depois.folha && durante.barraTopo === depois.barraTopo
    && durante.folhaRola === 0,
    'A · e a FOLHA mede o mesmo nos dois estados, com a barra de ação parada e '
    + 'sem rolar por fora: a altura é reservada NA FOLHA, e um piso escrito na '
    + 'lista passaria do que sobra e poria a `.popup-list` a rolar',
    JSON.stringify({ durante, depois }));

  // ── B. E A PÁGINA CRESCE NO FIM DA ROLAGEM, SEM REMONTAR ────────────────
  //
  // A ROLAGEM PRESERVADA é a metade que separa "cresceu" de "redesenhou": um
  // rebuild devolve a lista ao topo, e é por isso que a asserção mede o
  // `scrollTop` junto com a contagem de linhas.
  const cresceu = await pg.evaluate(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const res = document.querySelector('#sorteioList .sorteio-res');
    const primeira = document.querySelector('#sorteioList .sorteio-res-btn');
    const nome = primeira.querySelector('.song-menu-label').textContent;
    res.scrollTop = res.scrollHeight; await w(150);
    const duas = document.querySelectorAll('#sorteioList .sorteio-res-btn').length;
    const rolagem = Math.round(res.scrollTop);
    res.scrollTop = res.scrollHeight; await w(150);
    const tres = document.querySelectorAll('#sorteioList .sorteio-res-btn').length;
    res.scrollTop = res.scrollHeight; await w(150);
    const teto = document.querySelectorAll('#sorteioList .sorteio-res-btn').length;
    return { duas, tres, teto, rolagem,
      // A PRIMEIRA LINHA CONTINUA SENDO A MESMA: apendar não reordena.
      primeiraAinda: document.querySelector('#sorteioList .sorteio-res-btn')
        .querySelector('.song-menu-label').textContent === nome };
  });
  checar(cresceu.duas === 200 && cresceu.tres === 300 && cresceu.teto === 300,
    'B · rolar até o fim traz mais CEM, e ela para no total — não há página '
    + 'quatro num acervo de trezentos', JSON.stringify(cresceu));
  checar(cresceu.rolagem > 0 && cresceu.primeiraAinda,
    'B · e ela cresce por APÊNDICE: a rolagem não volta ao topo e a primeira '
    + 'linha continua sendo a mesma — remontar para mostrar mais cem é o defeito '
    + 'que a v1.8.85 consertou, de volta pela porta dos fundos',
    JSON.stringify(cresceu));

  // ── C. O CORTE É DE VISTA, NUNCA DO SORTEIO ─────────────────────────────
  //
  // A CÉLULA É UM LOTE MAIOR QUE A PÁGINA À VISTA no momento do pedido: com a
  // lista em cem linhas, pedir trinta tem de tirar os trinta do pool INTEIRO.
  // Medida pelo `sorteioLista`, que é o que o botão consome.
  const sorteia = await pg.evaluate(() => {
    const f = AVSorteio.sanear({ ...sorteioPrefs, quantos: 30 });
    const lista = sorteioLista(sorteioPool(), f);
    return { doPool: lista.length, aVista: document.querySelectorAll(
      '#sorteioList .sorteio-res-btn').length };
  });
  checar(sorteia.doPool === 300,
    'C · o sorteio enxerga o POOL INTEIRO, e não a página desenhada: o corte é '
    + 'de vista, e um `slice` que escapasse para o `sorteioLista` daria trinta '
    + 'dos cem primeiros com a contagem acima dizendo trezentos',
    JSON.stringify(sorteia));

  // ── D. SEM CUSTO, SEM ARO ───────────────────────────────────────────────
  //
  // A guarda que impede o conserto de virar espera inventada. A célula é um
  // acervo que cabe numa página — ali a lista sai em milissegundos, e um
  // segundo de aro seria pior que o travamento, porque aconteceria SEMPRE.
  await pg.evaluate(() => fecharSorteio());
  await SEMEAR(40);
  await pg.evaluate(() => abrirSorteio());
  await pg.waitForTimeout(200);
  const pequeno = await foto();
  checar(pequeno.pool === 40 && !pequeno.aquecendo && !pequeno.aro
    && pequeno.linhas === 40,
    'D · com o acervo cabendo numa página NÃO há aro nenhum: a lista já está na '
    + 'tela antes do respiro, e esperar por ela seria espera inventada',
    JSON.stringify(pequeno));

  checar(erros.length === 0, 'nenhum erro de página', erros.slice(0, 3));
} finally {
  await navegador.close();
  servidor.close();
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
