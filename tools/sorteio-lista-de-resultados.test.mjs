// ============================================================================
// A PLAYLIST AUTOMÁTICA MOSTRA A LISTA, E O LOTE SAI DELA (v1.8.84)
//
// Pedido do operador, verbatim nas partes que decidem:
//
//   *"O cartão de resultados repete as informações que já temos nas seleções
//   acima, como os filtros usados, e etc… Uma ação inútil, pois literalmente já
//   há a visão das seleções. Nesse resultado, precisamos apenas dos resultados.
//   Quantos temos, e se está disponível."*
//
//   *"agora ele será a lista dos resultados, listando cada música disponível
//   naquele resultado… Apenas com um diferencial, uma caixa de check em cada item
//   (que já vem marcado) que permite ou não incluir uma música em específico na
//   consideração final ao tocar/salvar. Esse check é resetado entre aberturas da
//   janela… Essa lista de músicas é aleatória dentro das condições selecionadas,
//   ela mostra todos os disponíveis, mas o número de itens para a 'playlist' fica
//   marcado e ficam no topo da lista… E após jogar para tocar, essa lista marcada
//   é removida, e os itens de baixo são levados para cima, criando a próxima
//   lista selecionada para playlist."*
//
// ## O que cada bloco trava, e por que a medida é a que é
//
// **A · A LISTA E O LOTE.** Todas as linhas marcadas, as `quantos` primeiras no
// topo e preenchidas. A medida do lote é a CLASSE `.vai` mais a posição no DOM —
// "está marcado" não distingue as duas coisas, porque a caixa vem marcada em
// todas por construção.
//
// **B · DESMARCAR TIRA DA CONSIDERAÇÃO, NÃO DA CONTA.** É a decisão de desenho
// que o pedido não fixa e que o resto da folha exige: com "Quantas = 3", tirar
// uma tem de trazer a quarta, senão o seletor de quantidade que o operador
// acabou de tocar passa a mentir. **E a que entra é a SEGUINTE, não uma
// sorteada de novo** — a ordem é a que ele está lendo.
//
// **C · O LOTE SAI DEPOIS DE USADO**, e os de baixo sobem. Medido pelo NOME das
// linhas antes e depois: uma medida por contagem passaria com o baralho
// reembaralhado, que é o defeito oposto.
//
// **D · A ORDEM SOBREVIVE AO REDESENHO.** É a metade que o pedido não diz e sem
// a qual nada dele funciona: a folha é redesenhada a cada tecla, a cada pílula e
// a cada marca, e reembaralhar em qualquer uma trocaria debaixo do dedo as
// músicas que o operador acabou de ler. **E o "Tocar agora" toca o que está na
// tela** — era `AVSorteio.sortear` no toque, isto é, um sorteio NOVO: o operador
// lia cinco nomes e ouvia outros cinco.
//
// **E · CADA ABERTURA É UM SORTEIO NOVO**, com as marcas zeradas — *"para que não
// aconteça de bloquear uma música desejada sem saber em outra sessão"*.
//
// REVERSÃO MEDIDA, uma peça de cada vez — CINCO, e cada uma reprova as
// asserções que a nomeiam:
//
//   `AVSorteio.sortear` de volta no `executarSorteio`  → D (o toque) e C
//   sem o `sorteioConsumir`                            → C
//   sem o `atualizarContaSorteio` depois dele          → C
//   sem `sorteioFora = new Set()` no `abrirSorteio`    → E (a reabertura)
//   sem `sorteioBaralhoChave = ''` no `abrirSorteio`   → E (o ponto de partida)
//   a impressão do pool sempre diferente               → B, C e D — **e A passa**
//
// A ÚLTIMA LINHA É A QUE PROVA O RESTO. Com o baralho refeito a cada passada, o
// bloco A continua verde inteiro: ele mede o DESENHO de uma passada, e uma
// passada sozinha nunca acusa a persistência. É por isso que D existe separado
// de A, e por isso a lista aqui é por PEÇA e não por bloco.
//
// E as duas do `abrirSorteio` reprovam em pontos DIFERENTES do bloco E: as
// marcas atravessando a abertura chegam à última asserção com a lista inteira e
// uma linha apagada; o BARALHO atravessando chega à primeira com a lista vazia
// (o consumo de D somado ao de C). Medir só uma delas aprovaria a outra.
//
//   node tools/sorteio-lista-de-resultados.test.mjs
// ============================================================================
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

  const abrir = async (quantos) => {
    await pg.evaluate(async (q) => {
      if (!sorteioPopupEl.classList.contains('open')) await abrirSorteio();
      sorteioPrefs.quantos = q;
      renderSorteio();
    }, quantos);
    await pg.waitForTimeout(250);
  };
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
  checar(a.every((l) => l.marcada),
    'A · e a caixa de cada item já vem MARCADA — é ela que diz "entra na '
    + 'consideração", e o padrão é entrar', a.filter((l) => !l.marcada));
  checar(a.slice(0, 3).every((l) => l.vai) && a.slice(3).every((l) => !l.vai),
    'A · o LOTE são as três primeiras, e elas ficam no TOPO — a marca dele é a '
    + 'classe, não a caixa: a caixa vem marcada em todas', a.map((l) => l.nome + (l.vai ? '*' : '')));
  checar(a.slice(0, 3).map((l) => l.pos).join(',') === '1,2,3'
    && a.slice(3).every((l) => l.pos === ''),
    'A · e cada uma do lote diz a POSIÇÃO em que vai tocar — com "Quantas = 10" '
    + 'dez linhas cheias não contam em que ordem elas saem', a.map((l) => l.pos));
  // A PARTIÇÃO DO BARALHO É OBSERVÁVEL: o que está no aparelho vem primeiro, e
  // por isso o lote toca na hora em vez de esperar download. É a propriedade que
  // faz a ordem da lista significar alguma coisa.
  const primeiroRemoto = a.findIndex((l) => /vai baixar/.test(l.sub));
  checar(primeiroRemoto === 5,
    'A · o que está NO APARELHO vem antes do que precisa baixar — é o que faz o '
    + 'topo da lista ser o que toca na hora', { primeiroRemoto, subs: a.map((l) => l.sub) });

  // =======================================================================
  // B · DESMARCAR TRAZ A SEGUINTE, E NÃO DIMINUI O LOTE
  // =======================================================================
  const quarta = a[3].nome;
  await tocar(a[0].nome);
  await pg.waitForTimeout(150);
  const b = await ler();
  const bFora = b.find((l) => l.nome === a[0].nome);
  checar(bFora && !bFora.marcada && !bFora.vai,
    'B · a desmarcada sai do lote', bFora);
  checar(b.filter((l) => l.vai).length === 3,
    'B · e o lote CONTINUA com três — desmarcar tira da consideração, não da '
    + 'conta: diminuir o lote faria o seletor "Quantas" que o operador acabou de '
    + 'tocar deixar de valer', b.filter((l) => l.vai).map((l) => l.nome));
  checar(b.find((l) => l.nome === quarta).vai === true,
    'B · e quem entra é a SEGUINTE da ordem, não uma sorteada de novo — a ordem '
    + 'é a que ele está lendo', { quarta, vai: b.filter((l) => l.vai).map((l) => l.nome) });
  checar(b.map((l) => l.nome).join(',') === a.map((l) => l.nome).join(','),
    'B · e nenhuma linha TROCA DE LUGAR: o que muda é quem está no lote, não a '
    + 'ordem — uma lista que se reorganiza sob o dedo é a que o operador não '
    + 'consegue ler', { antes: a.map((l) => l.nome), depois: b.map((l) => l.nome) });
  await tocar(a[0].nome);   // devolve
  await pg.waitForTimeout(150);

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
    sorteioPrefs.quantos = 3;
    sorteioPrefs.soNoAparelho = true;   // sem rede neste arnês
    renderSorteio();
  });
  await pg.waitForTimeout(250);
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
  if (c1.length) {
    await tocar(c1[0].nome);   // desmarca uma
    await pg.waitForTimeout(150);
    checar((await ler()).some((l) => !l.marcada), 'E · e ela pode ser desmarcada');
  }
  await pg.evaluate(async () => {
    sorteioPrefs.soNoAparelho = false;
    fecharSorteio();
    await new Promise((r) => setTimeout(r, 120));
    await abrirSorteio();
    sorteioPrefs.quantos = 3;
    renderSorteio();
  });
  await pg.waitForTimeout(300);
  const e = await ler();
  checar(e.length === 8 && e.every((l) => l.marcada),
    'E · reabrir devolve a lista INTEIRA com tudo marcado — *"para que não '
    + 'aconteça de bloquear uma música desejada sem saber em outra sessão"*, e o '
    + 'baralho consumido volta junto: abrir a folha é pedir um sorteio', e.length);

  checar(erros.length === 0, 'nenhum erro de console', erros);
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
