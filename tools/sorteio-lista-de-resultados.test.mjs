// ============================================================================
// A PLAYLIST AUTOMÁTICA MOSTRA A LISTA, E A MARCA É O LOTE (v1.8.85)
//
// Pedido do operador, verbatim nas partes que decidem:
//
//   *"as marcações de check devem ficar selecionadas, apenas o número de itens
//   selecionado para o filtro atual, o resto da lista segue desmarcado, mas
//   ainda segue sendo listado, listando todas as opções disponíveis. Inclusive,
//   ajuste para que ao tocar no check para ativar ou desativar, se altere o
//   número selecionado para 'quantas', pois ele é literalmente isso, mas
//   selecionando de forma manual."*
//
//   *"remova o ícone e deixe apenas o número no botão de número de resultados
//   disponíveis."*
//
//   *"sobre o scroll, mantenha as opções dos filtros sempre visíveis e deixe
//   apenas a lista dos resultados como scroll."*
//
// ## O que cada bloco trava, e por que a medida é a que é
//
// **A · A MARCA É O LOTE.** Exatamente `quantos` linhas marcadas, no topo e com
// a posição preenchida; o resto LISTADO e desmarcado. Isto REVOGA a v1.8.84,
// que marcava todas — lá a caixa respondia *"entra na consideração?"* e o lote
// era o preenchimento. Duas perguntas, dois sinais, e o operador leu uma só.
//
// **B · MARCAR É ESCOLHER "QUANTAS".** Desmarcar baixa o número, marcar sobe —
// e o SELETOR de quantidade acompanha, que é a metade do pedido que só se
// enxerga olhando para as pílulas: com quatro marcadas nenhuma acende, e é
// assim que o operador vê que a escolha passou a ser dele. **E a lista NÃO se
// reorganiza**: a linha marcada na posição 9 fica na posição 9.
//
// **C · O LOTE SAI DEPOIS DE USADO**, e o próximo já nasce marcado, do mesmo
// tamanho. Medido pelo NOME das linhas antes e depois: uma medida por contagem
// passaria com o baralho reembaralhado, que é o defeito oposto.
//
// **D · A ORDEM SOBREVIVE AO REDESENHO.** É a metade que o pedido não diz e sem
// a qual nada dele funciona: a folha é redesenhada a cada tecla, a cada pílula e
// a cada marca, e reembaralhar em qualquer uma trocaria debaixo do dedo as
// músicas que o operador acabou de ler. **E o "Tocar agora" toca o que está na
// tela** — era `AVSorteio.sortear` no toque, isto é, um sorteio NOVO: o operador
// lia cinco nomes e ouvia outros cinco.
//
// **E · CADA ABERTURA É UM SORTEIO NOVO**, com o lote semeado outra vez pela
// pílula guardada — *"para que não aconteça de bloquear uma música desejada sem
// saber em outra sessão"* (v1.8.84).
//
// **F · SÓ A LISTA ROLA**, os filtros ficam. E a ROLAGEM SOBREVIVE a uma marca:
// sem isso, marcar a linha 300 devolvia a lista ao topo e tirava da tela
// justamente a linha que o dedo acabou de tocar.
//
// **G · A PÍLULA DA CONTA É SÓ O NÚMERO** — o ícone saiu, e com ele 27px que o
// rótulo do primário não tinha.
//
// REVERSÃO MEDIDA, uma peça de cada vez — NOVE, com o número de asserções que
// cada uma derruba:
//
//   a caixa marcada em TODAS (a v1.8.84 de volta)      → 7  (A, B, E)
//   o `sorteioSemear` fora do toque da pílula          → 5  (A, D)
//   o `acertarPilulasDeQuantidade` fora do toque       → 1  (B, o seletor)
//   sem o piso de uma marcada no `sorteioAlternar`     → 1  (B, o piso)
//   sem o `sorteioConsumir`                            → 2  (C)
//   a impressão do pool sempre diferente               → 7  (B, C, D) — **A passa**
//   `.sorteio-res` sem o pai no seletor (0,1,0)        → 2  (F)
//   sem guardar o `scrollTop` no caminho leve          → 1  (F, a rolagem)
//   o ícone de volta na pílula                         → 1  (G)
//
// A LINHA DA IMPRESSÃO É A QUE PROVA O RESTO. Com o baralho refeito a cada
// passada, o bloco A continua verde INTEIRO: ele mede o DESENHO de uma passada,
// e uma passada sozinha nunca acusa a persistência.
//
// E AS DUAS ÚLTIMAS SÃO O PAR QUE F PRECISA: a especificidade derruba as duas
// asserções (sem a caixa certa não há rolagem que sobreviver a nada), e o
// `scrollTop` derruba só a segunda. Medir uma sozinha aprovaria a outra.
//
//   node tools/sorteio-lista-de-resultados.test.mjs
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, checar, falhas, RAIZ_WEB } from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;

try {
  const pg = await ctx.newPage();
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(t);
  });
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.AVDB && window.AVSorteio && typeof window.__avBack === 'function',
    null, { timeout: 30000 });
  await esperarCortina(pg);

  // OITO faixas, e o número é escolhido: com "Quantas = 3" sobram cinco abaixo do
  // lote, o bastante para provar que os de baixo SOBEM depois de um lote sair e
  // ainda restar fila. As cinco primeiras estão no aparelho e as três últimas
  // não — é o que faz a partição do baralho (`perto` antes de `longe`) ser
  // observável na ordem.
  await pg.evaluate(async () => {
    setAppMode('full');
    const arquivo = async (id, nome) => AVDB.fileAdd({
      id, folder: 'x', name: nome, srcName: nome, type: 'audio/mpeg', kind: 'audio',
      size: 8, lyrics: [], blob: new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
    });
    const nomes = ['Alfa', 'Beta', 'Gama', 'Delta', 'Épsilon', 'Zeta', 'Eta', 'Teta'];
    const songs = [];
    for (let i = 0; i < nomes.length; i++) {
      const baixado = i < 5;
      if (baixado) await arquivo('f' + i, nomes[i]);
      songs.push({
        id_music: 'h' + i, track: i + 1, name: nomes[i], duration: '3:00',
        has_instrumental_music: false, fileIdFull: baixado ? 'f' + i : null, fileIdPlayback: null,
      });
    }
    collState['hymnal-2022'] = { songs };
    albumCatalog = { categories: [], albums: [] };
    await ensureLyricIndex();
  });

  // ABRIR PEDINDO UMA QUANTIDADE, PELO CAMINHO DO OPERADOR: a pílula. Desde a
  // v1.8.85 escrever `sorteioPrefs.quantos` não muda o lote — ele é a MARCA, e
  // a pílula é o atalho que semeia. Um oráculo que escrevesse a preferência
  // mediria o lote do bloco anterior.
  const abrir = async (quantos) => {
    await pg.evaluate(async (q) => {
      if (!sorteioPopupEl.classList.contains('open')) await abrirSorteio();
      const pil = [...document.querySelectorAll('.sorteio-linha--quantas .misc-chip')]
        .find((b) => Number(b.dataset.valor) === q);
      if (!pil) throw new Error('não há pílula de quantidade ' + q);
      pil.click();
    }, quantos);
    await pg.waitForTimeout(250);
  };
  // QUAL PÍLULA DE QUANTIDADE ESTÁ ACESA (nenhuma é um estado legítimo).
  const quantasAcesas = () => pg.evaluate(() =>
    [...document.querySelectorAll('.sorteio-linha--quantas .misc-chip')]
      .filter((b) => b.classList.contains('active')).map((b) => b.textContent));
  // O QUE SE MEDE: o nome de cada linha, se ela está marcada, se está no lote e
  // a posição que ela anuncia. As quatro, porque um conserto que acertasse a
  // ordem e errasse a marca passaria em qualquer uma sozinha.
  const ler = () => pg.evaluate(() => [...document.querySelectorAll('#sorteioList .sorteio-res-btn')]
    .map((b) => ({
      nome: b.querySelector('.song-menu-label').textContent,
      sub: b.querySelector('.song-menu-sub').textContent,
      marcada: !!b.querySelector('.song-menu-check.on'),
      vai: b.classList.contains('vai'),
      pos: b.querySelector('.sorteio-res-pos').textContent,
    })));
  const tocar = (nome) => pg.evaluate((n) => {
    const b = [...document.querySelectorAll('#sorteioList .sorteio-res-btn')]
      .find((x) => x.querySelector('.song-menu-label').textContent === n);
    b.click();
  }, nome);

  // =======================================================================
  // A · A LISTA INTEIRA, COM O LOTE NO TOPO
  // =======================================================================
  await abrir(3);
  const a = await ler();
  checar(a.length === 8,
    'A · a lista mostra TODOS os disponíveis, não só o lote', a.length);
  checar(a.slice(0, 3).every((l) => l.marcada) && a.slice(3).every((l) => !l.marcada),
    'A · e SÓ o lote vem marcado (v1.8.85, revogando a v1.8.84): a caixa deixou '
    + 'de responder "entra na consideração?" e passou a responder "vai tocar?", '
    + 'que é a única pergunta que o operador leu ali',
    a.map((l) => l.nome + (l.marcada ? '*' : '')));
  checar(a.slice(0, 3).every((l) => l.vai) && a.slice(3).every((l) => !l.vai),
    'A · e o preenchimento diz a MESMA coisa que a caixa — duas marcas para um '
    + 'fato só é o que este lote fechou', a.map((l) => l.nome + (l.vai ? '*' : '')));
  checar(a.slice(0, 3).map((l) => l.pos).join(',') === '1,2,3'
    && a.slice(3).every((l) => l.pos === ''),
    'A · e cada uma do lote diz a POSIÇÃO em que vai tocar — com "Quantas = 10" '
    + 'dez linhas cheias não contam em que ordem elas saem', a.map((l) => l.pos));
  checar((await quantasAcesas()).join(',') === '3',
    'A · e a pílula de quantidade acesa é a do TAMANHO DO LOTE — ela deixou de '
    + 'ser o estado e virou um atalho que semeia', await quantasAcesas());
  // A PARTIÇÃO DO BARALHO É OBSERVÁVEL: o que está no aparelho vem primeiro, e
  // por isso o lote toca na hora em vez de esperar download. É a propriedade que
  // faz a ordem da lista significar alguma coisa.
  const primeiroRemoto = a.findIndex((l) => /vai baixar/.test(l.sub));
  checar(primeiroRemoto === 5,
    'A · o que está NO APARELHO vem antes do que precisa baixar — é o que faz o '
    + 'topo da lista ser o que toca na hora', { primeiroRemoto, subs: a.map((l) => l.sub) });

  // =======================================================================
  // B · MARCAR É ESCOLHER "QUANTAS"
  // =======================================================================
  // A SÉTIMA, e o índice é escolhido: fora do lote de três e fora da fronteira
  // dele, para que marcar não se confunda com "a seguinte subiu".
  const laDeBaixo = a[6].nome;
  await tocar(a[1].nome);          // desmarca a SEGUNDA do lote
  await pg.waitForTimeout(150);
  const b = await ler();
  checar(b.filter((l) => l.marcada).length === 2,
    'B · desmarcar TIRA do lote, e não traz a seguinte — a v1.8.84 trazia, '
    + 'porque lá quem mandava era o seletor; hoje a marca É o número',
    b.filter((l) => l.marcada).map((l) => l.nome));
  checar((await quantasAcesas()).length === 0,
    'B · e NENHUMA pílula de quantidade fica acesa com duas marcadas — 2 não é '
    + 'preset, e é assim que a folha diz que a escolha agora é manual',
    await quantasAcesas());
  checar(b.map((l) => l.nome).join(',') === a.map((l) => l.nome).join(','),
    'B · e nenhuma linha TROCA DE LUGAR: o que muda é a marca, não a ordem — '
    + 'uma lista que se reorganiza sob o dedo é a que o operador não consegue '
    + 'ler', { antes: a.map((l) => l.nome), depois: b.map((l) => l.nome) });
  checar(b.filter((l) => l.marcada).map((l) => l.pos).join(',') === '1,2',
    'B · e a POSIÇÃO se renumera sobre quem ficou — ela conta o lote, não a '
    + 'linha', b.map((l) => l.pos));

  // MARCAR UMA LÁ DE BAIXO: o número sobe e ela NÃO sobe.
  await tocar(laDeBaixo);
  await pg.waitForTimeout(150);
  const b2 = await ler();
  checar(b2.filter((l) => l.marcada).length === 3
    && (await quantasAcesas()).join(',') === '3',
    'B · marcar uma fora do topo devolve o número a três, e a pílula acende de '
    + 'novo — o seletor segue a marca nos DOIS sentidos',
    { marcadas: b2.filter((l) => l.marcada).map((l) => l.nome), acesa: await quantasAcesas() });
  checar(b2.map((l) => l.nome).join(',') === a.map((l) => l.nome).join(',')
    && b2.find((l) => l.nome === laDeBaixo).pos === '3',
    'B · e ela fica ONDE ESTAVA, com a posição 3 do lote — subir a marcada para '
    + 'o topo reorganizaria a lista debaixo do dedo, que é o que o baralho '
    + 'existe para não fazer', { ordem: b2.map((l) => l.nome), pos: b2.map((l) => l.pos) });

  // O PISO: a última marcada não se desmarca.
  await pg.evaluate(() => { sorteioMarcadas = new Set([...sorteioMarcadas].slice(0, 1)); atualizarContaSorteio(); acertarPilulasDeQuantidade(); });
  await pg.waitForTimeout(120);
  const soUma = (await ler()).find((l) => l.marcada);
  await tocar(soUma.nome);
  await pg.waitForTimeout(150);
  checar((await ler()).filter((l) => l.marcada).length === 1,
    'B · e a ÚLTIMA marcada não se desmarca — uma folha com zero marcadas deixa '
    + 'o primário aceso sem nada a fazer, e a régua da v1.8.50 diz o contrário '
    + 'disso; o caminho de "nenhuma" é fechar a folha',
    (await ler()).filter((l) => l.marcada).map((l) => l.nome));
  await abrir(3);   // devolve o cenário ao lote de três

  // =======================================================================
  // D · A ORDEM SOBREVIVE AO REDESENHO, E O TOQUE TOCA O QUE ESTÁ NA TELA
  // =======================================================================
  const antesDoRender = (await ler()).map((l) => l.nome);
  await pg.evaluate(() => { renderSorteio(); renderSorteio(); });
  await pg.waitForTimeout(150);
  checar((await ler()).map((l) => l.nome).join(',') === antesDoRender.join(','),
    'D · dois redesenhos não reembaralham nada — a folha é redesenhada a cada '
    + 'tecla e a cada pílula, e um baralho novo em qualquer uma trocaria debaixo '
    + 'do dedo o que o operador acabou de ler', antesDoRender);

  const lote = (await ler()).filter((l) => l.vai).map((l) => l.nome);
  const tocou = await pg.evaluate(async () => {
    sorteioPrefs.soNoAparelho = true;   // sem rede neste arnês
    renderSorteio();
    const nomes = [...document.querySelectorAll('#sorteioList .sorteio-res-btn.vai .song-menu-label')]
      .map((x) => x.textContent);
    await executarSorteio(document.querySelector('#sorteioPopup .song-menu-go'), 'tocar');
    await new Promise((r) => setTimeout(r, 500));
    const fila = await AVDB.listItems('playlist');
    return { nomes, fila: fila.map((i) => i.name) };
  });
  // O NOME do registro carrega o número da faixa ("1. Alfa"); a comparação é por
  // CONTINÊNCIA, que é o que sobrevive a essa diferença de rótulo sem afrouxar a
  // asserção — três nomes distintos não casam por acaso.
  checar(tocou.nomes.length === 3
    && tocou.nomes.every((n) => tocou.fila.some((f) => f.includes(n.replace(/^\d+\.\s*/, '')))),
    'D · e o "Tocar agora" toca EXATAMENTE o lote que estava na tela — era '
    + '`AVSorteio.sortear` no toque, isto é, um sorteio NOVO: o operador lia '
    + 'cinco nomes e ouvia outros cinco', tocou);

  // =======================================================================
  // C · O LOTE USADO SAI DA LISTA, E OS DE BAIXO SOBEM
  // =======================================================================
  // O FILTRO ENTRA ANTES DA LEITURA, e isto é o oráculo respeitando o mecanismo
  // que ele veio medir: o baralho é reembaralhado quando o POOL muda (é a
  // impressão que o guarda), então mexer num filtro entre ler a lista e usá-la
  // mede um sorteio novo em vez da consumação. Medir a consumação exige o pool
  // parado dos dois lados da ação — que é também o que o operador faz: ele
  // escolhe, lê, e só então toca.
  await pg.evaluate(async () => {
    await abrirSorteio();
    sorteioPrefs.soNoAparelho = true;   // sem rede neste arnês
    renderSorteio();
  });
  await abrir(3);
  const c0 = await ler();
  const usadas = c0.filter((l) => l.vai).map((l) => l.nome);
  const sobrando = c0.filter((l) => !l.vai).map((l) => l.nome);
  await pg.evaluate(async () => {
    // O DESTINO que NÃO fecha a folha: é ele que deixa a consequência visível.
    await executarSorteio(document.querySelector('#sorteioPopup .sorteio-dest[data-dest="favoritos"]'), 'favoritos');
    await new Promise((r) => setTimeout(r, 600));
  });
  await pg.waitForTimeout(300);
  const c1 = await ler();
  checar(c1.every((l) => !usadas.includes(l.nome)),
    'C · o lote guardado SAI da lista — *"após jogar para tocar, essa lista '
    + 'marcada é removida"*', { usadas, agora: c1.map((l) => l.nome) });
  checar(c1.filter((l) => l.vai).map((l) => l.nome).join(',') === sobrando.slice(0, 3).join(','),
    'C · e os de baixo SOBEM na ordem em que já estavam, formando o próximo lote '
    + '— um reembaralhamento aqui passaria numa contagem e trocaria a lista que '
    + 'o operador estava lendo', { sobrando, novoLote: c1.filter((l) => l.vai).map((l) => l.nome) });
  checar(c1.filter((l) => l.marcada).length === Math.min(3, c1.length),
    'C · e o próximo lote já nasce MARCADO, do mesmo tamanho — *"criando a '
    + 'próxima lista selecionada para playlist"*. O tamanho é o do lote que '
    + 'saiu, não a pílula guardada: tirar uma na mão antes de tocar é pedir '
    + 'quatro, não cinco', c1.map((l) => l.nome + (l.marcada ? '*' : '')));

  // =======================================================================
  // E · CADA ABERTURA É UM SORTEIO NOVO, COM AS MARCAS ZERADAS
  // =======================================================================
  // A LISTA SOBREVIVE AO LOTE, e isto é asserção e não pressuposto: com o
  // baralho ATRAVESSANDO a abertura (o `sorteioBaralhoChave` não zerado no
  // `abrirSorteio`), o consumo do bloco D chega aqui somado ao de C e a lista
  // termina VAZIA — sem esta linha o oráculo estoura no `c1[0]` e a reprovação
  // vira uma exceção sem nome.
  checar(c1.length > 0,
    'E · ponto de partida: sobrou linha depois do lote — um baralho que atravessa '
    + 'a abertura chega aqui já consumido', c1.map((l) => l.nome));
  // O CENÁRIO É UMA MARCA FEITA NA MÃO, e ela é por REMOÇÃO porque neste ponto
  // do percurso o lote já ocupa a lista inteira: o bloco C consumiu três das
  // cinco que o filtro "só no aparelho" deixa, e as duas que sobraram nasceram
  // marcadas. Tirar uma é a única alteração manual possível aqui — e serve
  // igual, porque o que E mede é a marca NÃO atravessar a abertura.
  const marcadasC = c1.filter((l) => l.marcada);
  if (marcadasC.length > 1) {
    await tocar(marcadasC[0].nome);
    await pg.waitForTimeout(150);
    checar((await ler()).filter((l) => l.marcada).length === marcadasC.length - 1,
      'E · ponto de partida: uma marca a menos, feita na mão',
      (await ler()).filter((l) => l.marcada).map((l) => l.nome));
  }
  await pg.evaluate(async () => {
    sorteioPrefs.soNoAparelho = false;
    fecharSorteio();
    await new Promise((r) => setTimeout(r, 120));
    await abrirSorteio();
  });
  await pg.waitForTimeout(300);
  const e = await ler();
  checar(e.length === 8,
    'E · reabrir devolve a lista INTEIRA — o baralho consumido volta junto, '
    + 'porque abrir a folha é pedir um sorteio', e.length);
  checar(e.filter((l) => l.marcada).length === 3
    && (await quantasAcesas()).join(',') === '3',
    'E · e o lote volta ao tamanho da PÍLULA GUARDADA, não aos quatro da mão — '
    + 'a marca é efêmera por pedido do operador (*"esse check é resetado entre '
    + 'aberturas da janela"*), e é por isso que só a pílula é gravada',
    { marcadas: e.filter((l) => l.marcada).map((l) => l.nome), acesa: await quantasAcesas() });

  // =======================================================================
  // F · SÓ A LISTA ROLA, E A ROLAGEM SOBREVIVE A UMA MARCA
  // =======================================================================
  //
  // *"Mantenha as opções dos filtros sempre visíveis e deixe apenas a lista dos
  // resultados como scroll."* O acervo é PLANTADO MAIOR aqui de propósito: com
  // oito faixas nada transborda, e as duas asserções passariam por vácuo sobre
  // uma folha que cabe inteira na tela.
  await pg.evaluate(async () => {
    const songs = collState['hymnal-2022'].songs.slice();
    for (let i = songs.length; i < 60; i++) {
      songs.push({
        id_music: 'x' + i, track: i + 1, name: 'Extra ' + i, duration: '3:00',
        has_instrumental_music: false, fileIdFull: null, fileIdPlayback: null,
      });
    }
    collState['hymnal-2022'] = { songs };
    sorteioPrefs.soNoAparelho = false;
    renderSorteio();
  });
  await pg.waitForTimeout(300);
  const rolagem = await pg.evaluate(() => {
    const folha = document.getElementById('sorteioList');
    const res = document.querySelector('#sorteioList .sorteio-res');
    const barra = document.querySelector('#sorteioList .sorteio-barra');
    return {
      linhas: document.querySelectorAll('#sorteioList .sorteio-res-btn').length,
      folhaRola: folha.scrollHeight > folha.clientHeight + 1,
      resRola: res.scrollHeight > res.clientHeight + 1,
      barra: +barra.getBoundingClientRect().top.toFixed(1),
    };
  });
  checar(rolagem.linhas > 40 && rolagem.resRola && !rolagem.folhaRola,
    'F · quem rola é a LISTA, e a folha não — os filtros, a quantidade e a barra '
    + 'de ação ficam onde estão. A cena é obrigada a transbordar: sobre uma '
    + 'folha que cabe, as duas metades passam sem medir nada',
    JSON.stringify(rolagem));
  // E A ROLAGEM SOBREVIVE A UMA MARCA. O caminho leve redesenha a lista inteira
  // a cada toque; sem guardar o `scrollTop`, marcar a linha 40 devolvia a lista
  // ao topo e tirava da tela justamente a linha que o dedo acabou de tocar.
  const marcou = await pg.evaluate(async () => {
    const res = () => document.querySelector('#sorteioList .sorteio-res');
    res().scrollTop = 200;
    await new Promise((r) => setTimeout(r, 80));
    const antes = res().scrollTop;
    const alvo = [...document.querySelectorAll('#sorteioList .sorteio-res-btn')]
      .find((b) => b.getBoundingClientRect().top > res().getBoundingClientRect().top + 10);
    alvo.click();
    await new Promise((r) => setTimeout(r, 200));
    const barra = document.querySelector('#sorteioList .sorteio-barra');
    return { antes, depois: res().scrollTop, barra: +barra.getBoundingClientRect().top.toFixed(1) };
  });
  checar(marcou.antes > 100 && marcou.depois === marcou.antes,
    'F · e a rolagem da lista SOBREVIVE a uma marca — o caminho leve remonta a '
    + 'lista, e sem guardar o `scrollTop` o toque na linha 40 a devolvia ao topo',
    JSON.stringify(marcou));
  checar(marcou.barra === rolagem.barra,
    'F · e a barra de ação não se move em nenhum dos dois — ela é o primário '
    + 'desta folha, e perdê-lo de vista é perder o recurso',
    { antes: rolagem.barra, depois: marcou.barra });

  // =======================================================================
  // G · A PÍLULA DA CONTA É SÓ O NÚMERO
  // =======================================================================
  const pilula = await pg.evaluate(() => {
    const p = document.querySelector('#sorteioList .sorteio-pilula');
    const go = document.querySelector('#sorteioList .sorteio-barra .song-menu-go');
    return {
      texto: p.textContent.trim(),
      desenho: p.querySelectorAll('svg, .msym, img').length,
      titulo: p.title,
      larg: +p.getBoundingClientRect().width.toFixed(1),
      goLarg: +go.getBoundingClientRect().width.toFixed(1),
    };
  });
  checar(/^\d+$/.test(pilula.texto) && pilula.desenho === 0,
    'G · a pílula da conta é SÓ O NÚMERO — *"remova o ícone e deixe apenas o '
    + 'número"*. A medida é o NÓ e não a largura: um ícone com `display: none` '
    + 'devolveria a largura e continuaria na árvore de acessibilidade',
    JSON.stringify(pilula));
  checar(/músicas?/.test(pilula.titulo) && /baixad/.test(pilula.titulo),
    'G · e a frase inteira fica no `title`/`aria-label` — o número sozinho não '
    + 'diz de que ele é, e é ele que um leitor de tela anuncia', pilula.titulo);

  checar(erros.length === 0, 'nenhum erro de console', erros);
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
