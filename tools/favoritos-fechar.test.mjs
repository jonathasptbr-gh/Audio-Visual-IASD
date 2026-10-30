#!/usr/bin/env node
// ============================================================================
// OS FAVORITOS ABREM E FECHAM NUM MOVIMENTO SÓ (v1.12.56)
//
// Relato do operador: *"a coleção de favoritos, que ao fechar, encolhe, e dá uma
// pequena travada antes de realmente fechar a sua seção de listagem… uma
// diferença grande entre o funcionamento visual das outras coleções que
// corretamente encolhem de forma fluida"*.
//
// A seção dos Favoritos aberta tem PISO (`min-height: var(--fav-vao)`), e o
// acordeão animava só o CORPO: o bloco parava no vão até o redesenho e então
// caía de uma vez — e as irmãs saltavam de 45 para 66px depois (a tampa delas
// desconta o vão dos Favoritos abertos). Ao abrir, o mesmo salto ao contrário,
// no quadro do toque.
//
// A RÉGUA É O TEMPO, e não um quadro: a altura de cada bloco é amostrada a cada
// `requestAnimationFrame` durante a animação. O que se afirma não depende da
// velocidade do runner:
//
//  · MONÓTONA — o bloco nunca volta (o "passa por 45 antes de 66");
//  · SEM PATAMAR — quanto tempo a altura ficou PARADA antes de chegar ao fim.
//    Num runner lento os quadros espaçam, mas a animação anda por TEMPO, então
//    dois quadros seguidos só repetem a altura se o bloco de fato parou. O
//    defeito para 130 a 220 ms; o teto é 60;
//  · SEM SALTO — o maior passo entre dois quadros não leva o percurso inteiro
//    (o defeito ao abrir: 100% num quadro);
//  · e a coleção comum, medida no mesmo arquivo, é a referência do tempo total.
//
// E O CABEÇALHO NÃO ANDA (v1.12.58, A8/A9): o topo da barra e o do título, a cada quadro,
// não se afastam mais de 0,5px do de antes do toque — nos Favoritos e numa coleção comum.
//
//   node tools/favoritos-fechar.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperar, esperarCortina, porque, checar, falhas,
  comModoAvancado, RAIZ_WEB,
} from './arnes.mjs';

const PATAMAR_MAX_MS = 60;     // o defeito: 130 a 220 ms parado
const SALTO_MAX = 0.85;        // o defeito ao abrir: 1,00 do percurso num quadro

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await abrirNavegador();
const erros = [];

// O que uma série de amostras diz: [t, altura].
function ler(serie, sobe) {
  const ini = serie[0][1];
  const fim = serie[serie.length - 1][1];
  const total = Math.abs(fim - ini);
  let volta = 0;
  let parado = 0;
  let salto = 0;
  let chegou = null;
  for (let i = 1; i < serie.length; i++) {
    const [t0, a] = serie[i - 1];
    const [t1, b] = serie[i];
    const passo = sobe ? b - a : a - b;
    if (passo < -0.5) volta = Math.max(volta, -passo);
    salto = Math.max(salto, Math.abs(b - a));
    // Parado ANTES de chegar ao fim (a 1px dele já é a cauda da curva).
    if (Math.abs(b - a) < 0.5 && Math.abs(a - fim) > 1) parado += t1 - t0;
    if (chegou === null && Math.abs(b - fim) <= 1) chegou = t1;
  }
  return {
    ini, fim, total: +total.toFixed(1), volta: +volta.toFixed(1), parado: Math.round(parado),
    salto: total ? +(salto / total).toFixed(2) : 0, chegou,
  };
}

async function cenario(nFav, opts = {}) {
  const ctx = await navegador.newContext({
    viewport: opts.viewport || { width: 430, height: 900 },
    deviceScaleFactor: opts.dpr || 1,
  });
  await semRedeExterna(ctx);
  await comModoAvancado(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(`http://localhost:${porta}/controle/`, { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  const pronto = await esperar(pg, () => window.AVDB && !!document.querySelector('.lib-bar'), null, 30000);
  if (pronto !== true) throw new Error('o app não subiu: ' + pronto);
  await pg.evaluate(() => openHymnSearch(false));
  const assentou = await esperar(pg, () => {
    const s = document.querySelector('.popup-sheet--lib');
    return s && !s.getAnimations().some((a) => a.playState === 'running')
      && s.getBoundingClientRect().bottom <= window.innerHeight + 1;
  }, null, 10000);
  if (assentou !== true) throw new Error('a Biblioteca não assentou: ' + assentou);
  await pg.evaluate(async ({ n, extras }) => {
    const faixas = (k) => Array.from({ length: k }, (_, i) => ({
      id_music: 'a' + (i + 1), track: i + 1, name: 'Faixa ' + (i + 1),
      duration: '3:00', has_instrumental_music: false,
    }));
    // `extras` seções a mais: com a lista cheia a tampa vai ao PISO (respiro zero), que é o
    // acervo de verdade de um aparelho com hinários, séries e coletâneas (v1.12.59).
    const cats = [{ name: 'Seção de teste', albums: [{ id_album: 77, name: 'Álbum' }] }];
    for (let c = 0; c < extras; c++) cats.push({ name: 'Seção ' + c, albums: [{ id_album: 200 + c, name: 'Álbum ' + c }] });
    albumCatalog.categories = cats;
    albumCatalog.albums = cats.map((c) => c.albums[0]);
    for (const c of cats) collState['album-' + c.albums[0].id_album] = { indexSyncedAt: Date.now(), songs: faixas(5) };
    for (let i = 0; i < n; i++) {
      await AVDB.addMedia(new Blob(['x' + i], { type: 'audio/mpeg' }), { name: 'Favorito ' + i, list: 'favs' });
    }
    await recarregarFavoritos();
    grupoAberto = ''; favAberto = false;
    hymnResultsEl.innerHTML = '';
    renderSearchResults('');
  }, { n: nFav, extras: opts.extras || 0 });
  await esperar(pg, () => document.querySelector('#hymnResults > .coll-group--fav')
    && document.querySelector('#hymnResults > .coll-group--drop[data-grupo="Seção de teste"]'));
  // A TAMPA ASSENTA (ela é medida num `requestAnimationFrame`, e sob carga mais de
  // 150 ms depois): sem isto o `cab0` do primeiro toque é lido ANTES dela, e a
  // tampa assentando no meio da curva sai como o cabeçalho andando — 10,34px no
  // runner (run 2209, tentativa 1), num app que estava certo. O fato é a GEOMETRIA
  // parada: o topo de cada barra igual em dez quadros seguidos.
  await pg.waitForFunction(() => {
    const k = [...document.querySelectorAll('#hymnResults .coll-group-bar')]
      .map((b) => b.getBoundingClientRect().top.toFixed(2)).join();
    window.__assenta = window.__assenta && window.__assenta.k === k
      ? { k, n: window.__assenta.n + 1 } : { k, n: 0 };
    return window.__assenta.n >= 10;
  }, null, { polling: 'raf', timeout: 10000 }).catch(() => {});

  // Toca a seta do bloco e amostra o bloco e a PRIMEIRA irmã fechada até 700 ms.
  // Os nós são reencontrados a cada quadro: o redesenho os substitui.
  const tocar = (sel) => pg.evaluate(async (sel) => {
    const bloco = () => document.querySelector(sel);
    const irma = () => [...hymnResultsEl.children].find((b) => b !== bloco()
      && b.classList.contains('coll-group--drop') && !b.classList.contains('aberto'));
    const alt = (el) => (el ? el.getBoundingClientRect().height : -1);
    // O CABEÇALHO: o topo da barra e o do título, a cada quadro (v1.12.58).
    const cabDe = () => {
      const b = bloco(); const barra = b && b.querySelector('.coll-group-bar');
      const nome = b && b.querySelector('.coll-group-name');
      return barra && nome ? [barra.getBoundingClientRect().top, nome.getBoundingClientRect().top] : null;
    };
    const cab0 = cabDe();
    let desvio = 0;
    const serie = [[0, alt(bloco())]];
    const irmaS = [[0, alt(irma())]];
    const t0 = performance.now();
    bloco().querySelector('.coll-group-icon').click();
    await new Promise((fim) => {
      const f = () => {
        const t = performance.now() - t0;
        serie.push([t, alt(bloco())]);
        irmaS.push([t, alt(irma())]);
        const c = cabDe();
        if (c && cab0) desvio = Math.max(desvio, Math.abs(c[0] - cab0[0]), Math.abs(c[1] - cab0[1]));
        if (t < 700) requestAnimationFrame(f); else fim();
      };
      requestAnimationFrame(f);
    });
    return { serie, irma: irmaS, aberto: bloco().classList.contains('aberto'), cab: +desvio.toFixed(2) };
  }, sel);
  return { ctx, pg, tocar };
}

try {
  const FAV = '#hymnResults > .coll-group--fav';
  const SEC = '#hymnResults > .coll-group--drop[data-grupo="Seção de teste"]';

  // ======================================================================
  // A · POUCOS FAVORITOS (a lista cabe no vão): o caso em que o bloco ficava
  //     parado a animação INTEIRA, e abria num quadro só
  // ======================================================================
  {
    const { ctx, tocar } = await cenario(3);
    const ab = await tocar(FAV);
    const a = ler(ab.serie, true);
    const ai = ler(ab.irma, false);
    checar(ab.aberto && a.total > 100,
      'A0 · o cenário está de pé: os Favoritos abriram e o bloco cresceu até o vão', a);
    checar(a.volta === 0 && a.salto < SALTO_MAX,
      'A1 · ABRIR: o bloco dos Favoritos CRESCE, sem voltar e sem chegar ao vão num quadro só '
      + '(maior passo < ' + SALTO_MAX + ' do percurso)', a);
    checar(ai.volta === 0 && (ai.total < 1 || ai.salto < SALTO_MAX),
      'A2 · ABRIR: a irmã fechada encolhe JUNTO, sem salto', ai);
    await new Promise((r) => setTimeout(r, 300));
    const fe = await tocar(FAV);
    const f = ler(fe.serie, false);
    const fi = ler(fe.irma, true);
    checar(!fe.aberto && f.total > 100,
      'A3 · o cenário está de pé: os Favoritos fecharam', f);
    checar(f.parado <= PATAMAR_MAX_MS,
      'A4 · FECHAR: o bloco dos Favoritos não PARA no caminho (' + f.parado + ' ms parado, teto '
      + PATAMAR_MAX_MS + ') — o defeito ficava no vão a animação inteira', f);
    checar(f.volta === 0,
      'A5 · FECHAR: o bloco só desce — não passa abaixo da altura fechada para depois voltar a ela', f);
    checar(fi.volta === 0 && fi.parado <= PATAMAR_MAX_MS,
      'A6 · FECHAR: a irmã fechada cresce JUNTO, sem esperar o fim e sem saltar depois', fi);

    // A REFERÊNCIA: uma coleção comum, no mesmo contexto.
    const sa = await tocar(SEC);
    await new Promise((r) => setTimeout(r, 300));
    const sf = await tocar(SEC);
    // O CABEÇALHO NÃO ANDA (v1.12.58): o topo da barra e o do título, em todo quadro da
    // curva e no repouso (a amostra vai até 700 ms, muito depois do redesenho).
    checar(ab.cab < 0.25 && fe.cab < 0.25,
      'A8 · o cabeçalho dos FAVORITOS (barra e título) não se desloca ao abrir nem ao fechar, '
      + 'nem durante a curva nem em repouso (maior desvio < 0,25px)', { abrir: ab.cab, fechar: fe.cab });
    checar(sa.cab < 0.25 && sf.cab < 0.25,
      'A9 · e o de uma coleção comum também não', { abrir: sa.cab, fechar: sf.cab });
    // E A SEÇÃO COMUM TERMINA A CURVA NA ALTURA FECHADA (v1.12.58): o recuo de cima do corpo
    // é parte da tampa, e zerá-lo com a altura a deixava 5,6px abaixo, subindo no redesenho.
    const sl = ler(sf.serie, false);
    checar(sl.volta === 0 && sl.parado <= PATAMAR_MAX_MS,
      'A10 · FECHAR uma coleção comum: só desce, e não passa abaixo da altura fechada para subir de volta', sl);
    const s = ler(sf.serie, false);
    checar(sa.aberto && !sf.aberto && f.chegou !== null && s.chegou !== null
      && f.chegou <= s.chegou + 150,
      'A7 · FECHAR: os Favoritos terminam no tempo de uma coleção comum (até 150 ms a mais)',
      { favoritos: f.chegou, colecao: s.chegou });
    await ctx.close();
  }

  // ======================================================================
  // B · MUITOS FAVORITOS (a lista passa do vão): encolhia até o vão e PARAVA
  // ======================================================================
  {
    const { ctx, tocar } = await cenario(20);
    const ab = await tocar(FAV);
    const a = ler(ab.serie, true);
    checar(ab.aberto && a.volta === 0, 'B1 · ABRIR: cresce sem voltar', a);
    await new Promise((r) => setTimeout(r, 300));
    const fe = await tocar(FAV);
    const f = ler(fe.serie, false);
    checar(!fe.aberto && f.total > 500,
      'B2 · o cenário está de pé: a lista passava do vão e fechou', f);
    checar(f.parado <= PATAMAR_MAX_MS && f.volta === 0,
      'B3 · FECHAR: o bloco desce até a altura fechada sem PARAR no vão (' + f.parado + ' ms parado)', f);
    await ctx.close();
  }

  // ======================================================================
  // C · A LISTA CHEIA (a tampa no PISO), NUM CELULAR: O CABEÇALHO NÃO TREME
  // ======================================================================
  // Relato sobre a v1.12.58: *"Ainda está acontecendo nos favoritos, mas está mais reduzido,
  // como uma vibração e não um movimento completo"*. Com a tampa no piso o respiro é zero, o
  // `.35rem` de cima do corpo não cabe na caixa fechada, e o flex da seção centrava o excesso
  // no fim da curva: a barra e o título tremiam 2,8px. A régua aperta para 0,25px.
  for (const cel of [
    { nome: '393×852 @3x, 8 seções', viewport: { width: 393, height: 852 }, dpr: 3, extras: 7 },
    { nome: '360×780 @2,625x, 8 seções', viewport: { width: 360, height: 780 }, dpr: 2.625, extras: 7 },
  ]) {
    const { ctx, pg, tocar } = await cenario(3, cel);
    const piso = await pg.evaluate(() => {
      const fav = document.querySelector('#hymnResults > .coll-group--fav');
      const barra = fav.querySelector('.coll-group-bar').getBoundingClientRect().height;
      const tampa = parseFloat(getComputedStyle(hymnResultsEl).getPropertyValue('--tampa-h')) || 0;
      return { barra: +barra.toFixed(2), tampa };
    });
    checar(Math.abs(piso.tampa - piso.barra) <= 0.5,
      'C0 · PREMISSA (' + cel.nome + '): a tampa está no PISO (a altura da barra)', piso);
    const ab = await tocar(FAV);
    await new Promise((r) => setTimeout(r, 300));
    const fe = await tocar(FAV);
    checar(ab.aberto && !fe.aberto && ab.cab < 0.25 && fe.cab < 0.25,
      'C1 · (' + cel.nome + ') o cabeçalho dos Favoritos não treme nem 0,25px, abrindo ou fechando, '
      + 'em nenhum quadro', { abrir: ab.cab, fechar: fe.cab });
    const f = ler(fe.serie, false);
    checar(f.volta === 0 && f.parado <= PATAMAR_MAX_MS,
      'C2 · (' + cel.nome + ') e o bloco fecha só descendo, sem parar', f);
    await ctx.close();
  }

  checar(erros.length === 0, 'nenhum erro de página', erros);
} finally {
  await navegador.close();
  servidor.close();
}
process.exit(falhas.length ? 1 : 0);
