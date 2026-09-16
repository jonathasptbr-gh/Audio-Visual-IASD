// ============================================================================
// A LETRA SEM MÚSICA, COM A ILUSTRAÇÃO (v1.9.7)
//
// Relato do operador: *"ao selecionar apenas a letra, sem música tocada, a letra
// é apresentada, mas não são exibidos as imagens de fundo de ilustração"*.
//
// A estrofe saía como `mode: 'message'` — o CARTÃO de texto, que não tem fundo
// de imagem. A ilustração é o `imageOpfsPath` de um SLIDE do arquivo baixado, e
// ela era descartada QUATRO vezes antes de poder ser pintada: o achatamento em
// string, o `stanzasFromSlides` (que monta `{a,l}` e larga o resto), a
// preferência do `songLyricStanzas` pelo acervo de TEXTO (que não tem imagem) e,
// no fim, o modo do comando. Agora a letra avulsa entra pela CAMADA DA LETRA — a
// mesma da música cantada —, nos dois lados.
//
// ## O que aqui pode falhar CALADO, e é por isso que cada item tem régua própria
//
//  - **um cartão com uma imagem qualquer atrás passaria por "letra ilustrada".**
//    Daí a régua de (A1/B1) ter DUAS metades: a `<img>` da camada da letra no ar
//    E o `#text`/`#pvText` ESCONDIDO. Sozinha, a primeira aprova qualquer coisa
//    que tenha pintado um pixel; sozinha, a segunda aprova a letra sem fundo,
//    que é exatamente o defeito relatado.
//  - **a estrofe recomeçar do zero.** O `idx` viaja no comando porque o reenvio
//    de cena (`resendSceneToDisplay`) manda o MESMO comando: sem ele, toda queda
//    de dongle voltaria a letra para a estrofe 1 na frente da congregação.
//  - **o relógio de uma música de fundo passar a estrofe por cima do operador.**
//    A letra avulsa é dona da camada enquanto está no ar — é o irmão, um nível
//    abaixo, da precedência que um versículo já tem sobre a letra cantada.
//  - **a preview divergir do telão.** As duas metades são escritas em ARQUIVOS
//    diferentes (`display.js` e `controle.js`); sem TV a preview É a projeção, e
//    com TV ela é o que o operador confere. Cada item mede os dois lados.
//  - **o caminho de OPFS vazar para a rede.** Uma tela da rede não tem o OPFS do
//    celular: o que viaja é a `/m/<token>` de sempre, e o caminho local não pode
//    aparecer no comando (spec §5.5 — `opfsPath` NUNCA atravessa).
//
// ## OS DOIS DEFEITOS QUE ESTE ARQUIVO ACHOU
//
// ### 1 · a marca sobrevivia ao cartão que a substituía (blocos A5/B4)
//
// A marca `letraManual` sobrevivia ao cartão que SUBSTITUÍA a letra avulsa: o
// `showText` de um versículo não a desligava, e o `text-hide` seguinte caía no
// ramo dela e voltava cedo — sem `textActive = false` e sem esmaecer a camada do
// cartão. MEDIDO no telão: depois de *letra avulsa → versículo → tirar do ar*, o
// `#text` continuava VISÍVEL com `textActive` preso em `true`, e nada mais o
// tirava da projeção. O mesmo valia para a preview.
//
// ### 2 · com uma TELA DA REDE pareada, a preview perdia a ilustração (bloco E)
//
// O `telaLetraAvulsa` troca o `imageOpfsPath` de cada estrofe pela `/m/<token>`
// dela, e o comando é UM só: o mesmo objeto que vai ao barramento é o que o
// `cmd()` entrega à preview no mesmo tique. A preview resolve a ilustração pelo
// OPFS e não sabe ler uma rota do espelho — MEDIDO, `pvLyricsImg` escondida e
// `src` nulo: o defeito deste lote de volta pela porta da transmissão. Ela passou
// a ler a SESSÃO, que está no mesmo documento (o idioma do `currentItem` no
// `load`). **O TELÃO fica com o problema**, porque é outro documento e não tem a
// sessão — ver o comentário do `telaLetraAvulsa`, que diz por que consertá-lo
// pede decisão de CONTRATO e não uma linha.
//
//   node tools/letra-avulsa.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, checar, falhas, RAIZ_WEB, esperar, porque, esperarCortina,
} from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;

const navegador = await abrirNavegador();
// Os dois no MESMO contexto — é o que faz o `BroadcastChannel` ligar um ao
// outro, como os dois WebViews do mesmo processo no aparelho.
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY|ERR_ABORTED/;
const ouvir = (pg, quem) => {
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(quem + ': ' + t);
  });
  pg.on('pageerror', (e) => erros.push(quem + ' pageerror: ' + e.message));
};

// 1×1 PNG opaco — o que importa é ser um arquivo de VERDADE no OPFS: os dois
// lados resolvem a ilustração por `AVDB.opfsGetFile`, e um caminho que não
// existe resolve para uma object URL que nunca pinta.
const PNG64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const FOTO = 'lyricimg/avulsa.png';
const SEMEAR_FOTO = async (p) => p.evaluate(async (a) => {
  const png = await (await fetch('data:image/png;base64,' + a.b64)).blob();
  await AVDB.opfsWriteFile(a.caminho, png);
}, { b64: PNG64, caminho: FOTO });

// As DUAS estrofes da cena. Elas não têm `time` — a letra avulsa não corre por
// relógio nenhum —, e é justamente isso que torna o bloco do relógio uma
// asserção de verdade: `findSlideIndex` com `time` ausente devolve sempre 0,
// então uma chamada de `updateLyricSlide` sem a guarda ARRASTA a cena da
// estrofe 2 para a 1 (ver A3/B2).
const SLIDES = [
  { text: 'Primeira estrofe da letra avulsa', auxText: '', imageOpfsPath: FOTO },
  { text: 'Segunda estrofe da letra avulsa', auxText: '', imageOpfsPath: FOTO },
];
const COMANDO = (idx) => ({
  type: 'text', mode: 'songlyrics', view: 'visual',
  idx, title: 'Hino de teste', slides: SLIDES,
});

try {
  // ======================================================================
  // A · O TELÃO
  // ======================================================================
  const tv = await ctx.newPage();
  ouvir(tv, 'telao');
  await tv.setViewportSize({ width: 961, height: 540 });
  await tv.goto(base + '/display/', { waitUntil: 'load' });
  {
    const r = await esperar(tv, () => !!window.AVDB && !!document.getElementById('lyricsLine')
      && !!document.getElementById('textMain'), null, 20000);
    checar(r === true, 'A · PREMISSA: o telão subiu com as DUAS camadas no DOM', porque(r));
  }
  await SEMEAR_FOTO(tv);

  const mandar = (c) => tv.evaluate((o) => {
    const bc = new BroadcastChannel('av-iasd');
    bc.postMessage(o); bc.close();
  }, c);

  // O QUE SE MEDE, nos dois lados: a camada da letra, a ilustração dentro dela,
  // e a camada do CARTÃO — as três no mesmo instante, porque é a combinação
  // delas que separa "letra ilustrada" de "cartão com uma foto atrás".
  const SONDA_TV = () => {
    const camada = document.getElementById('lyrics');
    const img = document.getElementById('lyricsImg');
    const cartao = document.getElementById('text');
    const r = img.getBoundingClientRect();
    return {
      camadaNoAr: !camada.hidden && +getComputedStyle(camada).opacity > 0.5,
      linha: document.getElementById('lyricsLine').textContent,
      imgSrc: img.getAttribute('src') || '',
      imgNoAr: !img.hidden && +getComputedStyle(img).opacity > 0.5 && r.width > 0 && r.height > 0,
      cartaoNoAr: !cartao.hidden,
      cartaoTexto: document.getElementById('textMain').textContent,
      idx: typeof lyricSlideIdx !== 'undefined' ? lyricSlideIdx : null,
      manual: typeof letraManual !== 'undefined' ? letraManual : '(sem acesso)',
      textActive: typeof textActive !== 'undefined' ? textActive : '(sem acesso)',
    };
  };
  const verTv = () => tv.evaluate((s) => eval('(' + s + ')')(), SONDA_TV.toString());
  // Espera pelo FATO (a ilustração no ar), nunca por um prazo: quem resolve o
  // `opfsGetFile` é o disco, e um sono aqui mediria a máquina.
  //
  // E ESPERA O FADE ASSENTAR, o que não é zelo: as camadas entram por
  // `element.animate()`, e amostrar no meio da transição lê uma opacidade
  // intermediária — MEDIDO, a segunda estrofe reprovava com `camadaNoAr: false`
  // sobre uma `<img>` que já tinha o `src` certo. O predicado é o mesmo que a
  // sonda usa depois, e é por isso que ele não é a asserção: o que se afirma são
  // as TRÊS camadas no mesmo instante, não que uma delas chegou.
  const visiveis = (lista) => lista.every((id) => {
    const e = document.getElementById(id);
    return e && !e.hidden && +getComputedStyle(e).opacity > 0.9;
  });
  const esperarVisivel = (pg, ids) => esperar(pg, (a) => a.every((id) => {
    const e = document.getElementById(id);
    return e && !e.hidden && +getComputedStyle(e).opacity > 0.9;
  }), ids, 10000);
  const esperarFoto = (pg) => esperar(pg, (sel) => {
    const im = document.getElementById(sel);
    return !!(im && !im.hidden && im.getAttribute('src'));
  }, 'lyricsImg', 10000);

  // ── A1 · A CAMADA DA LETRA E A ILUSTRAÇÃO ───────────────────────────────
  await mandar(COMANDO(0));
  {
    const r = await esperarFoto(tv);
    checar(r === true, 'A1 · a ilustração da estrofe entrou no telão', porque(r));
  }
  await esperarVisivel(tv, ['lyrics', 'lyricsImg']);
  const a1 = await verTv();
  checar(a1.camadaNoAr && a1.imgNoAr && /^blob:/.test(a1.imgSrc),
    'A1 · a letra AVULSA pinta a CAMADA DA LETRA com a ILUSTRAÇÃO — a `<img>` de '
    + 'fundo está no ar, com uma object URL do arquivo que está no OPFS. É o '
    + 'relato do operador: a letra aparecia, o fundo não',
    JSON.stringify(a1));
  checar(a1.cartaoNoAr === false && a1.manual === true,
    'A1 · e o CARTÃO de texto está escondido: sem esta metade, um `mode: "message"` '
    + 'com uma imagem qualquer atrás passaria pela asserção acima — o que se '
    + 'afirma é que a estrofe trocou de CAMADA, não que pintou um pixel',
    JSON.stringify(a1));
  checar(a1.linha === SLIDES[0].text,
    'A1 · e a linha projetada é a da estrofe pedida', JSON.stringify(a1));

  // ── A2 · A ESTROFE DO `idx`, E NÃO O COMEÇO ─────────────────────────────
  // É o que faz a RECONEXÃO do telão não recomeçar a letra na frente da
  // congregação: o `resendSceneToDisplay` reenvia este mesmo comando.
  await mandar(COMANDO(1));
  {
    const r = await esperar(tv, (t) => document.getElementById('lyricsLine').textContent === t,
      SLIDES[1].text, 5000);
    checar(r === true, 'A2 · a segunda estrofe entrou', porque(r));
  }
  await esperarVisivel(tv, ['lyrics', 'lyricsImg']);
  const a2 = await verTv();
  checar(a2.linha === SLIDES[1].text && a2.idx === 1,
    'A2 · o comando ENTRA NA ESTROFE DO `idx`, não no começo — a lista inteira '
    + 'viaja e o índice escolhe. Sem isto, toda queda de dongle volta a letra '
    + 'para a estrofe 1 no meio do louvor', JSON.stringify(a2));
  checar(a2.imgNoAr && a2.cartaoNoAr === false,
    'A2 · (e a ilustração continua no ar na estrofe nova)', JSON.stringify(a2));

  // ── A3 · A LETRA AVULSA MANDA ───────────────────────────────────────────
  // A cena fica na estrofe 2 de propósito: `findSlideIndex` com `time` ausente
  // devolve 0, então uma passada do relógio SEM a guarda arrasta a cena de volta
  // para a estrofe 1 — o flip que esta asserção precisa poder ver.
  const a3 = await tv.evaluate((s) => {
    showLyrics({ lyrics: [{ text: 'LETRA DA MUSICA DE FUNDO' }], hymnName: 'Fundo' });
    const depoisDoShow = eval('(' + s + ')')();
    updateLyricSlide(9);
    return { depoisDoShow, depoisDoRelogio: eval('(' + s + ')')() };
  }, SONDA_TV.toString());
  checar(a3.depoisDoShow.linha === SLIDES[1].text,
    'A3 · com a letra avulsa no ar, a letra da MÚSICA DE FUNDO não assume a camada '
    + '— é a precedência do operador, um nível abaixo da que um versículo já tem '
    + 'sobre a letra cantada', JSON.stringify(a3.depoisDoShow));
  checar(a3.depoisDoRelogio.linha === SLIDES[1].text && a3.depoisDoRelogio.idx === 1,
    'A3 · e o RELÓGIO da música tocando por baixo também não troca a estrofe: quem '
    + 'passa estrofe aqui é o ⏮/⏭ do operador', JSON.stringify(a3.depoisDoRelogio));

  // ── A4 · `text-hide` DERRUBA A LETRA AVULSA ─────────────────────────────
  // Ela sai pela MESMA porta do cartão (o caminho genérico do
  // `encerrarCamadaDeCima`), e é por isso que o `hideText` a atende.
  await mandar({ type: 'text-hide' });
  {
    const r = await esperar(tv, () => document.getElementById('lyrics').hidden
      && typeof letraManual !== 'undefined' && letraManual === false, null, 5000);
    checar(r === true,
      'A4 · `text-hide` derruba a letra avulsa E devolve a marca a false — sem a '
      + 'segunda metade a camada some e a marca fica, envenenando a cena seguinte',
      porque(r));
  }

  // ── A5 · UM CARTÃO DE VERDADE ASSUME A CAMADA ───────────────────────────
  //
  // O DEFEITO deste bloco: `showText` não desligava a marca, então o `hideText`
  // do `text-hide` caía no ramo da letra avulsa e voltava CEDO — sem
  // `textActive = false` e sem esmaecer o cartão. MEDIDO: o versículo ficava no
  // telão para sempre, e nada mais o tirava de lá.
  await mandar(COMANDO(0));
  {
    const r = await esperar(tv, (t) => document.getElementById('lyricsLine').textContent === t
      && typeof letraManual !== 'undefined' && letraManual === true, SLIDES[0].text, 5000);
    checar(r === true, 'A5 · PREMISSA: a letra avulsa voltou ao ar', porque(r));
  }
  await mandar({ type: 'text', main: 'Porque Deus amou o mundo', sub: 'João 3:16', view: 'visual' });
  {
    const r = await esperar(tv, () => !document.getElementById('text').hidden
      && document.getElementById('textMain').textContent.startsWith('Porque Deus'), null, 5000);
    checar(r === true, 'A5 · PREMISSA: o versículo substituiu a letra avulsa na tela', porque(r));
  }
  const a5 = await verTv();
  checar(a5.manual === false,
    'A5 · um CARTÃO de verdade assume a camada, e a letra avulsa deixa de ser dona '
    + 'dela: a marca desliga no `showText`', JSON.stringify(a5));
  await mandar({ type: 'text-hide' });
  {
    const r = await esperar(tv, () => document.getElementById('text').hidden
      && typeof textActive !== 'undefined' && textActive === false, null, 5000);
    checar(r === true,
      'A5 · e o `text-hide` seguinte TIRA O CARTÃO DO AR. Com a marca sobrevivendo '
      + 'ao versículo, o `hideText` caía no ramo da letra avulsa e voltava cedo — '
      + 'o cartão ficava na projeção para sempre, com `textActive` preso em true',
      porque(r));
  }

  // ======================================================================
  // B · A PREVIEW DO CONTROLE — a mesma cena, no outro arquivo de folha
  // ======================================================================
  const pg = await ctx.newPage();
  ouvir(pg, 'controle');
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  {
    const r = await esperar(pg, () => window.AVDB && typeof window.__avBack === 'function'
      && (!!document.querySelector('#playlist li') || document.getElementById('plBtn').disabled),
    null, 25000);
    checar(r === true, 'B · PREMISSA: o Controle subiu', porque(r));
  }
  await esperarCortina(pg);
  // O MODO AVANÇADO, e é uma armadilha MEDIDA: no Modo Fácil sem tela conectada a
  // projeção fica BLOQUEADA e o `#simpleStage` mede 0×0 — a preview existe no
  // DOM, com a camada da letra e a object URL certas, e não desenha um pixel. A
  // sonda devolvia `imgNoAr: false` sobre uma cena inteiramente correta.
  await pg.evaluate(() => setAppMode('full'));
  await SEMEAR_FOTO(pg);

  const SONDA_PV = () => {
    const camada = document.getElementById('pvLyrics');
    const img = document.getElementById('pvLyricsImg');
    const cartao = document.getElementById('pvText');
    const r = img.getBoundingClientRect();
    return {
      camadaNoAr: !camada.hidden && +getComputedStyle(camada).opacity > 0.5,
      linha: document.getElementById('pvLyricsLine').textContent,
      imgSrc: img.getAttribute('src') || '',
      imgNoAr: !img.hidden && +getComputedStyle(img).opacity > 0.5 && r.width > 0 && r.height > 0,
      cartaoNoAr: !cartao.hidden,
      idx: typeof pvLyricSlideIdx !== 'undefined' ? pvLyricSlideIdx : null,
      manual: typeof pvLetraManual !== 'undefined' ? pvLetraManual : '(sem acesso)',
      textActive: typeof pvTextActive !== 'undefined' ? pvTextActive : '(sem acesso)',
    };
  };
  const verPv = () => pg.evaluate((s) => eval('(' + s + ')')(), SONDA_PV.toString());

  // O CAMINHO É O DO CONTROLE, e não uma chamada à metade de dentro: a sessão é
  // montada como `projectSongLyricsOnly` a monta e quem projeta é
  // `projectLyricStanza`, que é o que o ⏮/⏭ chama. A preview recebe pelo mesmo
  // `cmd()` que fala com o telão.
  const projetar = (idx) => pg.evaluate((a) => {
    soUmProvedorDeTexto('songlyrics');
    lyricSession = { title: 'Hino de teste', slides: a.slides, idx: 0, projecting: true };
    projectLyricStanza(a.idx);
  }, { slides: SLIDES, idx });

  // ── B1 · A PREVIEW ESPELHA O TELÃO (e lê o OPFS) ────────────────────────
  await projetar(1);
  {
    const r = await esperar(pg, () => {
      const im = document.getElementById('pvLyricsImg');
      return !!(im && !im.hidden && im.getAttribute('src'));
    }, null, 10000);
    checar(r === true, 'B1 · a ilustração da estrofe entrou na preview', porque(r));
  }
  await esperarVisivel(pg, ['pvLyrics', 'pvLyricsImg']);
  const b1 = await verPv();
  checar(b1.camadaNoAr && b1.imgNoAr && /^blob:/.test(b1.imgSrc) && b1.cartaoNoAr === false,
    'B1 · a PREVIEW pinta a mesma cena: camada da letra, ilustração resolvida do '
    + 'OPFS e o cartão escondido. Ela roda em OUTRO arquivo de folha e é escrita '
    + 'noutro arquivo de JS — e sem TV ela É a projeção', JSON.stringify(b1));
  checar(b1.linha === SLIDES[1].text && b1.idx === 1,
    'B1 · e ela também entra na ESTROFE DO `idx`', JSON.stringify(b1));

  // ── B2 · A LETRA AVULSA MANDA, TAMBÉM AQUI ──────────────────────────────
  const b2 = await pg.evaluate((s) => {
    showPvLyrics({ lyrics: [{ text: 'LETRA DA MUSICA DE FUNDO' }], hymnName: 'Fundo' });
    const depoisDoShow = eval('(' + s + ')')();
    updatePvLyricSlide(9);
    return { depoisDoShow, depoisDoRelogio: eval('(' + s + ')')() };
  }, SONDA_PV.toString());
  checar(b2.depoisDoShow.linha === SLIDES[1].text,
    'B2 · a letra da MÚSICA DE FUNDO não assume a camada da preview',
    JSON.stringify(b2.depoisDoShow));
  checar(b2.depoisDoRelogio.linha === SLIDES[1].text && b2.depoisDoRelogio.idx === 1,
    'B2 · nem o RELÓGIO dela — o espelho exato do `updateLyricSlide` do telão',
    JSON.stringify(b2.depoisDoRelogio));

  // ── B3 · `text-hide` NA PREVIEW ─────────────────────────────────────────
  await pg.evaluate(() => aplicarNaPreview({ type: 'text-hide' }, null));
  {
    const r = await esperar(pg, () => document.getElementById('pvLyrics').hidden
      && typeof pvLetraManual !== 'undefined' && pvLetraManual === false, null, 5000);
    checar(r === true, 'B3 · `text-hide` derruba a letra avulsa da preview e devolve '
      + 'a marca a false', porque(r));
  }

  // ── B4 · O CARTÃO ASSUME, E SAI ─────────────────────────────────────────
  await projetar(0);
  {
    const r = await esperar(pg, (t) => document.getElementById('pvLyricsLine').textContent === t,
      SLIDES[0].text, 5000);
    checar(r === true, 'B4 · PREMISSA: a letra avulsa voltou ao ar na preview', porque(r));
  }
  await pg.evaluate(() => aplicarNaPreview(
    { type: 'text', main: 'Porque Deus amou o mundo', sub: 'João 3:16', view: 'visual' }, null));
  const b4 = await verPv();
  checar(b4.cartaoNoAr === true && b4.manual === false,
    'B4 · o cartão assume a camada da preview e a marca desliga', JSON.stringify(b4));
  await pg.evaluate(() => aplicarNaPreview({ type: 'text-hide' }, null));
  {
    const r = await esperar(pg, () => typeof pvTextActive !== 'undefined' && pvTextActive === false
      && +getComputedStyle(document.getElementById('pvText')).opacity < 0.5, null, 5000);
    checar(r === true,
      'B4 · e o `text-hide` seguinte tira o cartão da preview — o espelho do A5',
      porque(r));
  }

  // ======================================================================
  // C · A FONTE DOS SLIDES (`lyricSlidesFor`)
  // ======================================================================
  // As DUAS metades, e elas se contradizem de propósito: o ARQUIVO vence quando
  // tem ilustração (ele é a única fonte de imagem, e é o que a congregação vê
  // com a música tocando), e o acervo de TEXTO vence quando não há imagem
  // nenhuma (ele é mais completo, e trocá-lo por nada mudaria a divisão das
  // estrofes de graça).
  const SEMEAR_FONTE = async (comImagem) => pg.evaluate(async (a) => {
    const png = await (await fetch('data:image/png;base64,' + a.b64)).blob();
    await AVDB.opfsWriteFile(a.caminho, png);
    const id = 'arq-' + (a.comImagem ? 'foto' : 'sofoto');
    await AVDB.fileAdd({
      id, folder: 'teste', opfsPath: 'folders/teste/' + id + '.wav', srcName: id,
      name: 'Musica', type: 'audio/wav', kind: 'audio', size: 1, mtime: Date.now(),
      thumb: null, blob: null, url: null, addedAt: Date.now(),
      lyrics: [
        { time: 0, text: null, auxText: null, cover: true, imageOpfsPath: a.comImagem ? a.caminho : null },
        { time: 3, text: 'ARQUIVO estrofe 1', auxText: 'Refrão', imageOpfsPath: a.comImagem ? a.caminho : null },
        { time: 8, text: 'ARQUIVO estrofe 2', auxText: '', imageOpfsPath: a.comImagem ? a.caminho : null },
      ],
    });
    lyricStore.c1 = { m1: [
      { a: 'ACERVO A', l: ['ACERVO estrofe 1'] },
      { a: null, l: ['ACERVO estrofe 2'] },
      { a: null, l: ['ACERVO estrofe 3'] },
    ] };
    return await lyricSlidesFor({ id: 'c1' }, { id_music: 'm1', fileIdFull: id, fileIdPlayback: null });
  }, { b64: PNG64, caminho: FOTO, comImagem });

  const comFoto = await SEMEAR_FONTE(true);
  checar(comFoto.length === 2 && comFoto.every((sl) => sl.imageOpfsPath === FOTO)
    && comFoto[0].text === 'ARQUIVO estrofe 1',
    'C1 · o ARQUIVO vence quando tem ILUSTRAÇÃO, mesmo com o acervo de texto '
    + 'dividido em estrofes de verdade — é a única fonte de imagem, e a letra sem '
    + 'música tem de ser a mesma cena da letra cantada', JSON.stringify(comFoto));
  // A CAPA FICA DE FORA, e o que se mede é o DESFECHO — nunca UMA das guardas.
  // São DUAS peneiras apontando para o mesmo lado, e cada uma basta sozinha: o
  // `sl.cover` explícito e o descarte do slide sem texto NEM rótulo (toda capa
  // nasce com `text: null, auxText: null` — ver `buildLyricSlides`). MEDIDO por
  // reversão: tirar o `sl.cover` reprova ZERO asserções, e tirar o filtro de
  // vazio também — só a remoção das DUAS reprova, e é ela que esta asserção
  // nomeia. O que se afirma é que a cena encolheu de 3 para 2 e que nenhuma
  // ESTROFE EM BRANCO entrou nela: um slide vazio no meio do louvor.
  checar(comFoto.length === 2
    && comFoto.every((sl) => (sl.text || '').trim() || (sl.auxText || '').trim()),
    'C1 · e a CAPA fica de fora (3 slides no arquivo, 2 na cena): quem pede "apenas '
    + 'a letra" pede a primeira estrofe, não um cartão de abertura — e nenhuma '
    + 'estrofe EM BRANCO entra na cena', JSON.stringify(comFoto));

  const semFoto = await SEMEAR_FONTE(false);
  checar(semFoto.length === 3 && semFoto[0].text === 'ACERVO estrofe 1'
    && semFoto.every((sl) => !sl.imageOpfsPath),
    'C2 · e o ACERVO DE TEXTO vence quando não há imagem nenhuma: a preferência de '
    + 'sempre continua valendo, e trocá-la por nada mudaria a divisão das estrofes '
    + 'de graça. Sem esta metade, "o arquivo vence" viraria "o arquivo sempre vence"',
    JSON.stringify(semFoto));
  checar(semFoto[0].auxText === 'ACERVO A',
    'C2 · (e o RÓTULO da estrofe vem junto — a forma é a do SLIDE nos dois caminhos, '
    + 'que é a que `renderLyricSlide` sabe desenhar)', JSON.stringify(semFoto[0]));

  // ======================================================================
  // D · A METADE DA TELA DA REDE (`telaLetraAvulsa`)
  // ======================================================================
  // A FUNÇÃO É EXERCITADA PELO CAMINHO DE DENTRO, e está dito: montar uma tela
  // de verdade exigiria o `EspelhoServidor` (Kotlin) do outro lado. O que se faz
  // aqui é ligar as duas condições de `telaAtiva()` — o CANAL de mídia e o
  // espelho LIGADO — e emitir pelo `projectLyricStanza` de sempre, capturando o
  // que saiu no barramento. O empurrão dos bytes é espionado em vez de
  // executado: quem o consome é o canal do shell.
  //
  // O `__NATIVE__` fica FALSO de propósito: ligá-lo faz todo o resto do Controle
  // procurar a ponte (`acertarProjecaoLocal` estoura em `AVNative`), e o que
  // esta metade mede não é o app inteiro — é o enriquecimento. Por isso quem é
  // trocado é o `telaCanal()`, a metade que responde "há uma tela na rede".
  // A CENA SAI DE VEZ ANTES, e isto é uma armadilha MEDIDA: `applyPvLyricsImage`
  // devolve cedo em `key === pvLyricImgKey`, e o teardown da imagem que sai é
  // ADIADO em `PV_LAYER_FADE_MS`. Herdando o fundo do bloco B, o bloco E media
  // uma `<img>` que ainda estava na tela por inércia — MEDIDO: com a leitura da
  // sessão desfeita ele passava do mesmo jeito.
  await pg.evaluate(() => aplicarNaPreview({ type: 'text-hide' }, null));
  {
    const r = await esperar(pg, () => !document.getElementById('pvLyricsImg').getAttribute('src')
      && (typeof pvLyricImgKey === 'undefined' || pvLyricImgKey === null), null, 5000);
    checar(r === true, 'D · PREMISSA: a preview saiu de cena antes do cenário da tela', porque(r));
  }

  const d = await pg.evaluate((a) => {
    const enviados = [];
    const realSend = AVDB.sendCommand;
    AVDB.sendCommand = (o) => { enviados.push(JSON.parse(JSON.stringify(o))); };
    const empurrados = [];
    const realEmp = telaGarantirEnvio;
    telaGarantirEnvio = (it) => { empurrados.push({ id: it.id, opfsPath: it.opfsPath }); };
    const realCanal = telaCanal;
    const antesMirror = mirrorEstado;
    telaCanal = () => ({ postMessage() {} });
    mirrorEstado = { ligado: true, telas: [] };
    try {
      soUmProvedorDeTexto('songlyrics');
      lyricSession = { title: 'Hino de teste', slides: a.slides, idx: 0, projecting: true };
      projectLyricStanza(1);
      return {
        ativa: telaAtiva(),
        cmd: enviados[enviados.length - 1] || null,
        cru: JSON.stringify(enviados[enviados.length - 1] || {}),
        empurrados,
        sessao: lyricSession.slides.map((sl) => sl.imageOpfsPath),
      };
    } finally {
      AVDB.sendCommand = realSend;
      telaGarantirEnvio = realEmp;
      telaCanal = realCanal;
      mirrorEstado = antesMirror;
    }
  }, { slides: SLIDES });

  checar(d.ativa === true && d.cmd && d.cmd.mode === 'songlyrics' && d.cmd.idx === 1,
    'D · PREMISSA: com uma tela ativa, o comando da letra avulsa saiu no barramento',
    JSON.stringify({ ativa: d.ativa, mode: d.cmd && d.cmd.mode, idx: d.cmd && d.cmd.idx }));
  checar(d.cmd && Array.isArray(d.cmd.slides) && d.cmd.slides.length === 2
    && d.cmd.slides.every((sl) => /^\/m\/[A-Za-z0-9_-]{16,64}$/.test(sl.imageUrl || '')),
    'D · cada estrofe troca o `imageOpfsPath` por uma `/m/<token>` — uma tela da '
    + 'rede não tem o OPFS do celular, e a rota do espelho é a única forma de os '
    + 'bytes chegarem lá', JSON.stringify(d.cmd && d.cmd.slides));
  checar(!/imageOpfsPath/.test(d.cru) && !d.cru.includes(FOTO),
    'D · e O CAMINHO DE OPFS NÃO VAZA: nem a chave nem o caminho aparecem no '
    + 'comando enviado (spec §5.5 — `opfsPath` NUNCA atravessa). Sem esta metade, '
    + 'um enriquecimento ADITIVO passaria na asserção acima e mandaria o caminho '
    + 'local para todo navegador da rede', d.cru.slice(0, 400));
  checar(d.empurrados.length === 1 && d.empurrados[0].id === 'ly:' + FOTO
    && d.empurrados[0].opfsPath === FOTO,
    'D · e os BYTES são enfileirados UMA vez por imagem DISTINTA, com o id estável '
    + '`ly:<caminho>` — as duas estrofes compartilham a foto, e a regra "mesmo id '
    + '+ mesmo token = já tenho" do shell faz a segunda custar zero',
    JSON.stringify(d.empurrados));
  checar(d.sessao.every((p) => p === FOTO),
    'D · e a SESSÃO não é mutada: o `imageOpfsPath` continua na lista do Controle, '
    + 'que é de onde o telão de verdade e a preview leem o OPFS',
    JSON.stringify(d.sessao));

  // ── E · E A PREVIEW NÃO PERDE A ILUSTRAÇÃO POR CAUSA DA TELA ───────────
  //
  // O comando que o bloco D acabou de emitir é o ENRIQUECIDO — as estrofes dele
  // têm `/m/<token>` e não têm `imageOpfsPath` —, e é ele que o `cmd()` entrega
  // à preview no mesmo tique. A preview resolve a ilustração pelo OPFS e não
  // sabe ler uma rota do espelho: lendo o comando, ela ficava SEM FUNDO assim
  // que uma tela fosse pareada — o defeito deste lote de volta pela porta da
  // transmissão. Quem responde é a SESSÃO, que está no mesmo documento (o mesmo
  // idioma do `currentItem` no `load`).
  {
    const r = await esperar(pg, () => {
      const im = document.getElementById('pvLyricsImg');
      return !!(im && !im.hidden && /^blob:/.test(im.getAttribute('src') || ''));
    }, null, 10000);
    checar(r === true,
      'E · com a TELA DA REDE ativa a preview continua com a ILUSTRAÇÃO: ela lê a '
      + 'SESSÃO (que tem o `imageOpfsPath`) e não o comando enriquecido, cujas '
      + 'estrofes carregam a `/m/<token>` que só a tela sabe buscar', porque(r));
  }

  checar(erros.length === 0, 'nenhum erro de página nos dois lados', erros.slice(0, 4));
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
