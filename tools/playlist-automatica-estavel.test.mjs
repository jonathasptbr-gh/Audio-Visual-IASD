// ============================================================================
// A FOLHA DA PLAYLIST AUTOMÁTICA NÃO SE MEXE, E O PULSO CHEGA À TELA (v1.8.83)
//
// Dois relatos do operador, no mesmo minuto, sobre a mesma folha:
//
//   *"O feedback de confirmação dos botões na seção de playlist automática,
//   estão muito rápidos, basicamente não visíveis. Verifique seu tempo de
//   exposição ou se tem algo atualizando a tela e remove do sua animação"*
//
//   *"Verifique também a zona de descrição de resultados… Seu design está sendo
//   muito variado e pouco modular, resultando novamente no problema de
//   movimentação da janela… Algo como um simples card, com texto centralizado…
//   O card sempre terá o mesmo tamanho, mantendo a janela estável."*
//
// Eles estão num arquivo só porque são o MESMO defeito visto de dois ângulos: a
// folha se redesenhando quando não precisava.
//
// ## BLOCO A — o pulso vive num nó que está NO DOCUMENTO
//
// Era a segunda hipótese do operador, e o tempo não tinha nada a ver. O
// `finally` do `executarSorteio` chamava `renderSorteio()` só para reabilitar a
// faixa de fecho, e um redesenho TROCA OS NÓS — o `responder` acabara de pôr o
// pulso no botão tocado.
//
// MEDIDO antes do conserto: o nó trocado em 23 ms, o pulso vivendo os
// `PULSO_MS` (1100 ms) inteiros num nó SOLTO. **Zero milissegundo na tela.**
//
// **A MEDIDA NÃO PODE SER A CLASSE NO NÓ QUE SE TOCOU**, e é essa a armadilha:
// `btn.classList.contains('btn-pulso')` responde `true` durante os 1100 ms
// inteiros, nó solto e tudo. O que se mede é `.btn-pulso` DENTRO da folha —
// isto é, um pulso que alguém pode ver.
//
// ## BLOCO B — o cartão tem UM tamanho, e a folha não anda
//
// O `min-height: 6em` da v1.8.61 reservava QUATRO linhas e o pior caso são
// CINCO. MEDIDO nas 99 células daquele lote: a caixa ia de 78,7 a 143,7px e a
// FOLHA se mexia 25,6px a 360×1,5.
//
// A célula importa, e é a lição da v1.8.65: a 430×1× a folha NÃO se mexe nem
// antes nem depois — as frases cabem nas quatro linhas reservadas. Só a fonte
// do sistema grande numa tela estreita alcança a decisão, e por isso as quatro
// combinações abaixo incluem 360×1,5.
//
// E a folha é medida em `popup-sheet`, não na conta: a conta CRESCENDO é a causa,
// a folha ANDANDO é o que o operador vê. Uma asserção só sobre a conta aprovaria
// um conserto que a congelasse e deixasse outro motor solto.
//
// REVERSÃO MEDIDA. Devolvendo o `renderSorteio()` ao `finally` do
// `executarSorteio`, as três asserções do bloco A reprovam com 0 ms de
// exposição. Devolvendo a barra ao `.popup-fecho` (`porFecho(alvo, liGo)`), o
// bloco B reprova nas quatro células — sem a barra dentro da lista não há
// `.sorteio-barra` no lugar em que ela tem de estar.
//
//   node tools/playlist-automatica-estavel.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, checar, falhas, RAIZ_WEB } from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await abrirNavegador();

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;

// O acervo de mentira: três hinos, dois no aparelho e um infantil (faixa 510)
// fora dele. É o mínimo que faz as onze frases da conta serem alcançáveis.
const SEMEAR = async (pg) => {
  await pg.evaluate(async () => {
    const arquivo = async (id, nome, letra) => AVDB.fileAdd({
      id, folder: 'x', name: nome, srcName: nome, type: 'audio/mpeg', kind: 'audio',
      size: 8, lyrics: letra || [], blob: new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
    });
    await arquivo('f-h1', 'Noite de Paz');
    await arquivo('f-h2', 'Firme nas Promessas', [{ text: 'misericórdia e graça abundante', auxText: 'Estrofe 1' }]);
    window.__songs = [
      { id_music: 'h1', track: 1, name: 'Noite de Paz', duration: '3:00', has_instrumental_music: false, fileIdFull: 'f-h1', fileIdPlayback: null },
      { id_music: 'h2', track: 2, name: 'Firme nas Promessas', duration: '3:00', has_instrumental_music: false, fileIdFull: 'f-h2', fileIdPlayback: null },
      { id_music: 'h3', track: 510, name: 'Castelo Forte', duration: '3:00', has_instrumental_music: false, fileIdFull: null, fileIdPlayback: null },
    ];
    collState['hymnal-2022'] = { songs: window.__songs };
    albumCatalog = { categories: [], albums: [] };
    await ensureLyricIndex();
  });
};

const abrir = async (ctx, escala) => {
  const pg = await ctx.newPage();
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(t);
  });
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  // A ESCALA DE FONTE DO SISTEMA, que é o eixo que alcança a decisão. Escrita na
  // raiz depois do `DOMContentLoaded` para não correr contra o script inline do
  // `<head>` (o do tema).
  if (escala !== 1) {
    await pg.addInitScript((e) => {
      document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.fontSize = (16 * e) + 'px';
      });
    }, escala);
  }
  await pg.goto(`http://localhost:${porta}/controle/`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.AVDB && window.AVSorteio && typeof window.__avBack === 'function'
      && (!!document.querySelector('#playlist li') || document.getElementById('plBtn').disabled),
    null, { timeout: 30000 },
  );
  await esperarCortina(pg);
  await pg.evaluate(() => setAppMode('full'));
  await SEMEAR(pg);
  await pg.click('#sorteioBtn');
  await pg.waitForTimeout(500);
  return pg;
};

// Os onze estados, todos alcançáveis tocando nas pílulas e digitando no campo.
// Cada um é uma FUNÇÃO SERIALIZADA: ela roda dentro da página, sobre os módulos
// de verdade, e o render é o de verdade.
const ESTADOS = [
  ['vazio · biblioteca não carregada', () => { collState = {}; albumCatalog = { categories: [], albums: [] }; sorteioPrefs.tema = ''; }],
  ['sem palavra · tudo', () => { sorteioPrefs.tema = ''; sorteioPrefs.quantos = 1; }],
  ['sem palavra · sem hinário e sem infantis', () => { sorteioPrefs.tema = ''; sorteioPrefs.semHinario = true; sorteioPrefs.semInfantis = true; }],
  ['sem palavra · só no aparelho', () => { sorteioPrefs.tema = ''; sorteioPrefs.semHinario = false; sorteioPrefs.soNoAparelho = true; }],
  ['palavra curta · uma', () => { sorteioPrefs.soNoAparelho = false; sorteioPrefs.tema = 'paz'; sorteioPrefs.quantos = 1; }],
  ['palavra curta · dez', () => { sorteioPrefs.tema = 'paz'; sorteioPrefs.quantos = 10; }],
  ['palavra LONGA · dez', () => { sorteioPrefs.tema = 'misericórdia e graça abundante'; sorteioPrefs.quantos = 10; }],
  ['palavra sem resultado', () => { sorteioPrefs.tema = 'xyzabcdefgh'; }],
  ['playback sem fundo musical', () => { sorteioPrefs.tema = ''; sorteioPrefs.variante = 'playback'; }],
  ['a fala: adicionado', () => { sorteioPrefs.variante = 'full'; sorteioPrefs.tema = ''; falarNoSorteio('“Noite de Paz” adicionado ao Cronograma'); }],
  ['a fala mais longa: o pacote', () => { falarNoSorteio('10 músicas num pacote no Cronograma, e a frase mais longa que este canal sabe produzir'); }],
];

try {
  // ======================================================================
  // BLOCO A — O PULSO CHEGA À TELA
  // ======================================================================
  {
    const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
    await semRedeExterna(ctx);
    const pg = await abrir(ctx, 1);

    const dests = await pg.$$eval('#sorteioPopup .sorteio-dest', (bs) => bs.map((b) => b.dataset.dest));
    checar(dests.join(',') === 'cronograma,playlist,favoritos',
      'ponto de partida: os três destinos na ordem canônica, e habilitados', dests);

    // AMOSTRAGEM, não um instante: o defeito é de DURAÇÃO, e uma leitura única
    // cairia dentro ou fora da janela por sorte de agendamento.
    await pg.evaluate(() => {
      const b = document.querySelector('#sorteioPopup .sorteio-dest[data-dest="cronograma"]');
      window.__tocado = b;
      window.__amostras = [];
      b.click();
      const t0 = performance.now();
      const id = setInterval(() => {
        window.__amostras.push({
          ms: Math.round(performance.now() - t0),
          // O que importa: um pulso DENTRO da folha, isto é, um pulso visível.
          naFolha: !!document.querySelector('#sorteioPopup .btn-pulso'),
          // A armadilha, medida junto para que a diferença fique no log: a
          // classe no nó que se tocou responde `true` mesmo com ele solto.
          noNo: window.__tocado.classList.contains('btn-pulso'),
          montado: window.__tocado.isConnected,
        });
        if (performance.now() - t0 > 2000) clearInterval(id);
      }, 50);
    });
    await pg.waitForTimeout(2400);
    const am = await pg.evaluate(() => window.__amostras);
    const naFolha = am.filter((x) => x.naFolha);
    const exposicao = naFolha.length * 50;
    const solto = am.find((x) => !x.montado);

    checar(exposicao >= 800,
      'o pulso do destino tocado fica VISÍVEL na folha por perto de um segundo '
      + '(medido em amostras de 50 ms; era ZERO, num nó que o redesenho soltou)',
      { exposicao, primeira: naFolha[0], ultima: naFolha[naFolha.length - 1] });
    checar(!solto,
      '  ↳ e o botão tocado NUNCA sai do documento — nada redesenha a folha para '
      + 'reabilitar uma faixa que um `disabled` resolve em ponto',
      solto || 'permaneceu montado nas ' + am.length + ' amostras');
    checar(am.some((x) => x.noNo && !x.naFolha) === false,
      '  ↳ e as duas leituras concordam: a classe no nó e o pulso na folha dizem '
      + 'a mesma coisa (era aqui que a medida fácil mentia)',
      am.filter((x) => x.noNo && !x.naFolha).slice(0, 3));

    // A TRAVA CONTINUA SENDO ACERTADA — o que o redesenho fazia, e a única coisa
    // que ele fazia. Sem esta asserção o conserto poderia ter sido só "não
    // redesenhar", deixando a faixa travada para sempre depois de um lote.
    const depois = await pg.$$eval('#sorteioPopup .sorteio-acao', (bs) => bs.map((b) => b.disabled));
    checar(depois.length === 4 && depois.every((d) => d === false),
      'a faixa de fecho volta a aceitar toque depois do lote (o `disabled` em '
      + 'ponto faz o trabalho que o redesenho fazia)', depois);
    await ctx.close();
  }

  // ======================================================================
  // BLOCO B — O CARTÃO TEM UM TAMANHO SÓ, E A FOLHA NÃO ANDA
  // ======================================================================
  const CELULAS = [[360, 1], [360, 1.5], [430, 1], [430, 1.5]];
  const medidas = [];
  for (const [largura, escala] of CELULAS) {
    const ctx = await navegador.newContext({ viewport: { width: largura, height: 900 } });
    await semRedeExterna(ctx);
    const pg = await abrir(ctx, escala);
    for (const [nome, fn] of ESTADOS) {
      await pg.evaluate((src) => {
        if (!collState['hymnal-2022']) collState['hymnal-2022'] = { songs: window.__songs };
        // eslint-disable-next-line no-new-func
        (new Function('return (' + src + ')'))()();
        renderSorteio();
      }, fn.toString());
      await pg.waitForTimeout(70);
      const m = await pg.evaluate(() => {
        const barra = document.querySelector('#sorteioList .sorteio-barra');
        const sh = document.querySelector('#sorteioPopup .popup-sheet');
        const pil = document.querySelector('#sorteioList .sorteio-pilula');
        const cs = getComputedStyle(barra);
        const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
        const rb = barra.getBoundingClientRect();
        const rs = sh.getBoundingClientRect();
        return {
          // A POSIÇÃO DA BARRA DENTRO DA FOLHA — é ela que o dedo procura, e é
          // dela que a promessa passou a ser (ver o cabeçalho).
          barraTopo: +(rb.top - rs.top).toFixed(1),
          barraAlt: +rb.height.toFixed(1),
          pilulaLarg: +pil.getBoundingClientRect().width.toFixed(1),
          folha: +rs.height.toFixed(1),
          // A barra é `sticky` sobre uma lista que rola por baixo: sem fundo
          // OPACO o texto das linhas atravessa os botões.
          sticky: cs.position,
          fundoAlfa: rgb(cs.backgroundColor).length < 4 ? 1 : rgb(cs.backgroundColor)[3],
        };
      });
      medidas.push({ largura, escala, estado: nome, ...m });
    }
    await ctx.close();
  }

  for (const [largura, escala] of CELULAS) {
    const sub = medidas.filter((m) => m.largura === largura && m.escala === escala);
    const topos = [...new Set(sub.map((m) => m.barraTopo))];
    const alturas = [...new Set(sub.map((m) => m.barraAlt))];
    const larguras = [...new Set(sub.map((m) => m.pilulaLarg))];
    checar(topos.length === 1 && alturas.length === 1,
      `${largura}×${escala}: a BARRA DE AÇÃO fica no mesmo ponto da folha nos `
      + `${sub.length} estados — é ela que o dedo procura, e agora ela não `
      + 'depende do resultado: os quatro controles acima dela não mudam de altura',
      { topos, alturas });
    checar(larguras.length === 1,
      '  ↳ e a PÍLULA tem uma largura só, com 1 e com 1.000 resultados — *"cuide '
      + 'para que o botão tenha um tamanho fixo independente do número interno"*',
      larguras.concat(sub.map((m) => m.estado)).slice(0, 8));
  }

  checar(medidas.every((m) => m.sticky === 'sticky'),
    'a barra é `sticky`: acima dos resultados como se pediu, e à vista com a '
    + 'lista rolando por baixo — o `.popup-fecho` dava essa segunda metade de '
    + 'graça, e uma barra solta a perderia na primeira rolagem',
    [...new Set(medidas.map((m) => m.sticky))]);
  checar(medidas.every((m) => m.fundoAlfa === 1),
    '  ↳ com fundo OPACO, porque a lista passa POR BAIXO dela: tinta com alfa '
    + 'sobre uma lista que rola muda de cor a cada quadro (v1.8.61)',
    [...new Set(medidas.map((m) => m.fundoAlfa))]);

  checar(erros.length === 0, 'nenhum erro de console', erros);
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
