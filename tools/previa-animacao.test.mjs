#!/usr/bin/env node
// ============================================================================
// A PRÉVIA RECOLHE ANIMANDO, E OS BOTÕES NÃO PULAM (v1.11.17)
//
// Pedido do operador, verbatim: *"faça uma animação para a colapsação da preview, ao invés
// de piscar e mudar de tamanho. Também nessa preview colapsada, revise a ordem dos botões
// finais, pois na esquerda o botão de mudo não está mantendo a mesma posição relativa de
// antes e depois de colapsar, diferente do botão de tela cheia, que se mantém imóvel."*
//
// O estado final é o de sempre e vale no primeiro quadro (a classe `pv-recolhida` e a geometria
// mudam no ato); o que a animação desenha é o CAMINHO até ele — a altura, o eixo X de cada botão
// e o desvanecer das camadas. O que este arquivo trava, e cada uma falha CALADA (a prévia recolhe
// do mesmo jeito; só o olho nota):
//
//  A1 · o MUDO e a TELA CHEIA ficam IMÓVEIS no recolher: a mesma distância da borda esquerda
//       (mudo) e da direita (tela cheia), nos dois estados — a ordem é do canto, não da fila.
//  A2 · e continuam no mesmo lugar em TODOS os quadros do movimento (não só nas pontas).
//  B1 · a altura corre (vários valores intermediários, sem salto no primeiro quadro, monótona,
//       terminando na altura medida do estado final) — recolhendo E expandindo.
//  B2 · cada botão fica ANCORADO onde estava no eixo Y durante o movimento (o de cima a 2px do
//       topo, o de baixo a 2px da base): sem a classe `pv-animando` a linha única flutuaria no
//       meio de uma caixa que ainda encolhe.
//  B3 · a cortina e o cast ANDAM no eixo X (de onde estavam até a linha única), em vez de pular.
//  B4 · as camadas ficam visíveis e desvanecem (opacidade intermediária), e SOMEM só no fim.
//  B5 · no fim não sobra NADA: nenhuma animação, nenhuma classe de movimento, nenhum `transform`.
//  C1 · só o TOQUE anima: a abertura, a troca de destino e a saída da tela cheia chamam
//       `acertarEconomiaDaPreview` direto e a prévia assenta no ato.
//  C2 · `prefers-reduced-motion` desliga: o primeiro quadro já é o final.
//  D1 · um segundo toque no MEIO do movimento parte de onde a prévia está (sem salto) e assenta.
//  E1 · no fallback estreito (a linha desce) a altura anima, os botões não andam em X, e termina
//       assentado e dentro da prévia.
//
//   node tools/previa-animacao.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperar, esperarCortina, porque, checar, falhas, comModoAvancado,
} from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;
const navegador = await abrirNavegador();
const erros = [];

const IDS = ['viewToggle', 'muteToggle', 'pvCastBtn', 'pvFullBtn', 'pvRecolherBtn', 'pvCamadaBtn', 'pvGiroBtn'];

async function abrir({ largura = 390, reduzido = false, extras = true } = {}) {
  const ctx = await navegador.newContext({
    viewport: { width: largura, height: 780 },
    reducedMotion: reduzido ? 'reduce' : 'no-preference',
  });
  await semRedeExterna(ctx);
  await comModoAvancado(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  // O cast não existe no navegador (`[hidden]`); aqui ele entra à vista para os DOIS cantos terem dono.
  await pg.evaluate((comExtras) => {
    document.getElementById('pvCastBtn').hidden = false;
    if (comExtras) { document.getElementById('pvCamadaBtn').hidden = false; document.getElementById('pvGiroBtn').hidden = false; }
  }, extras);
  await pg.evaluate(() => new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f))));
  return { ctx, pg };
}

// Espera o fato (nenhuma animação FINITA rodando), nunca um relógio.
const assentar = (pg) => pg.evaluate(async () => {
  const q = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await q();
  for (let i = 0; i < 200; i++) {
    const rodando = document.getAnimations().some((a) => a.playState === 'running'
      && a.effect && a.effect.getComputedTiming().iterations !== Infinity);
    if (!rodando) break;
    await q();
  }
});

// A AMOSTRA: o clique na seta e, quadro a quadro, a prévia e cada botão MEDIDOS RELATIVOS à prévia
// (esquerda, direita, topo e base) — o que importa para um botão ancorado é a distância da borda
// dele, e não a posição na tela (a caixa de controles ancora embaixo, então a prévia sobe e desce).
// `intervalo` é o instante (ms) do segundo toque, para o caso D1.
const AMOSTRAR = ({ ids, ms, segundoToqueEm }) => new Promise((resolve) => {
  const pv = document.getElementById('preview');
  const wall = document.getElementById('pvWall');
  const quadros = [];
  const t0 = performance.now();
  const ler = () => {
    const P = pv.getBoundingClientRect();
    const o = { t: performance.now() - t0, h: P.height, wallOp: parseFloat(getComputedStyle(wall).opacity), wallVis: getComputedStyle(wall).visibility, anim: pv.classList.contains('pv-animando') };
    ids.forEach((id) => {
      const b = document.getElementById(id);
      if (!b || b.hidden) return;
      const r = b.getBoundingClientRect();
      o[id] = { x: r.left - P.left, xr: P.right - r.right, y: r.top - P.top, yb: P.bottom - r.bottom };
    });
    return o;
  };
  let segundo = false;
  document.getElementById('pvRecolherBtn').click();
  quadros.push(ler());
  const tick = () => {
    const agora = performance.now() - t0;
    if (segundoToqueEm != null && !segundo && agora >= segundoToqueEm) {
      segundo = true;
      const antes = ler();
      document.getElementById('pvRecolherBtn').click();
      const depois = ler();
      quadros.push({ ...antes, marca: 'antes-do-2o-toque' }, { ...depois, marca: 'depois-do-2o-toque' });
    } else {
      quadros.push(ler());
    }
    if (agora < ms) requestAnimationFrame(tick); else resolve(quadros);
  };
  requestAnimationFrame(tick);
});

const medirFinal = (pg) => pg.evaluate((ids) => {
  const pv = document.getElementById('preview');
  const P = pv.getBoundingClientRect();
  const o = {
    h: P.height, recolhida: pv.classList.contains('pv-recolhida'), baixo: pv.classList.contains('pv-extras-baixo'),
    animando: pv.classList.contains('pv-animando'),
    animacoes: pv.getAnimations({ subtree: true }).filter((a) => a.effect.getComputedTiming().iterations !== Infinity).length,
    wallVis: getComputedStyle(document.getElementById('pvWall')).visibility,
    transformados: [], fora: [],
  };
  ids.forEach((id) => {
    const b = document.getElementById(id);
    if (!b || b.hidden) return;
    const r = b.getBoundingClientRect();
    o[id] = { x: r.left - P.left, xr: P.right - r.right, y: r.top - P.top, yb: P.bottom - r.bottom };
    if (b.style.transform) o.transformados.push(id);
    if (r.left < P.left - 0.5 || r.right > P.right + 0.5 || r.top < P.top - 0.5 || r.bottom > P.bottom + 0.5) o.fora.push(id);
  });
  return o;
}, IDS);

const perto = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;
const monotona = (xs, dir, tol = 0.6) => xs.every((v, i) => i === 0 || (dir < 0 ? v <= xs[i - 1] + tol : v >= xs[i - 1] - tol));
const distintos = (xs, de, ate, passo = 1) => new Set(xs.filter((v) => v > Math.min(de, ate) + passo && v < Math.max(de, ate) - passo).map((v) => Math.round(v))).size;

try {
  // =========================================================================
  // A · B · O RECOLHER E O EXPANDIR, COM TODOS OS BOTÕES À VISTA (linha única a 390px)
  // =========================================================================
  {
    const { ctx, pg } = await abrir();
    const exp0 = await medirFinal(pg);
    checar(exp0.recolhida === false && exp0.animacoes === 0,
      'PREMISSA: a prévia nasce expandida e sem animação nenhuma', { recolhida: exp0.recolhida, animacoes: exp0.animacoes });
    checar(exp0.baixo === false,
      'PREMISSA: a 390 px o selo, a seta, o giro e os dois grupos laterais cabem numa linha só (sem fallback)', exp0.baixo);

    const rec = await pg.evaluate(AMOSTRAR, { ids: IDS, ms: 800 });
    await assentar(pg);
    const rec1 = await medirFinal(pg);
    const H0 = exp0.h, H1 = rec1.h;
    checar(rec1.recolhida === true && H1 < H0 - 20,
      'PREMISSA: o toque recolhe de fato (a altura final é bem menor)', { H0, H1 });

    // ---- A1 · MUDO E TELA CHEIA NO MESMO LUGAR, EXPANDIDA × RECOLHIDA -------------------------
    checar(perto(exp0.muteToggle.x, rec1.muteToggle.x) && perto(exp0.pvFullBtn.xr, rec1.pvFullBtn.xr),
      'A1 · o MUDO fica à mesma distância da borda ESQUERDA e a TELA CHEIA da DIREITA, expandida e recolhida '
      + '— cada um no seu canto, imóveis', { mudo: [exp0.muteToggle.x, rec1.muteToggle.x], cheia: [exp0.pvFullBtn.xr, rec1.pvFullBtn.xr] });
    checar(perto(exp0.muteToggle.yb, rec1.muteToggle.yb) && perto(exp0.pvFullBtn.yb, rec1.pvFullBtn.yb),
      'A1 · e na mesma distância da BASE nos dois estados', { mudo: [exp0.muteToggle.yb, rec1.muteToggle.yb], cheia: [exp0.pvFullBtn.yb, rec1.pvFullBtn.yb] });
    checar(rec1.muteToggle.x < rec1.viewToggle.x && rec1.pvCastBtn.x < rec1.pvFullBtn.x,
      'A1 · recolhida, o mudo é o PRIMEIRO da esquerda (a cortina fica à direita dele) e a tela cheia o ÚLTIMO da direita',
      { mudo: rec1.muteToggle.x, cortina: rec1.viewToggle.x, cast: rec1.pvCastBtn.x, cheia: rec1.pvFullBtn.x });

    // ---- B1 · A ALTURA CORRE ------------------------------------------------------------------
    const hs = rec.map((q) => q.h);
    checar(perto(hs[0], H0, 1.5),
      'B1 · o PRIMEIRO quadro depois do toque ainda tem a altura de antes — nenhum salto', { primeiro: hs[0], antes: H0 });
    checar(monotona(hs, -1) && perto(hs[hs.length - 1], H1, 0.6),
      'B1 · a altura só DESCE e termina na altura medida do estado final', { final: hs[hs.length - 1], esperado: H1 });
    checar(distintos(hs, H0, H1, 2) >= 4,
      'B1 · e passa por VÁRIOS valores intermediários (um fade de dois quadros não é animação)', distintos(hs, H0, H1, 2));
    const comeco = rec.find((q) => q.h < H0 - 0.5), fim = rec.find((q) => perto(q.h, H1, 0.6));
    checar(comeco && fim && fim.t - comeco.t >= 150,
      'B1 · e leva tempo de verdade (>= 150 ms, a `--dur-lenta` do app é 300)', { de: comeco && comeco.t, ate: fim && fim.t });

    // ---- A2 · E B2 · NO MEIO DO MOVIMENTO -----------------------------------------------------
    const todos = (f) => rec.every(f);
    checar(todos((q) => perto(q.muteToggle.x, exp0.muteToggle.x) && perto(q.pvFullBtn.xr, exp0.pvFullBtn.xr)),
      'A2 · o mudo e a tela cheia ficam imóveis em TODOS os quadros do movimento, não só nas pontas',
      rec.map((q) => [+q.muteToggle.x.toFixed(1), +q.pvFullBtn.xr.toFixed(1)]).slice(0, 8));
    checar(todos((q) => perto(q.muteToggle.yb, exp0.muteToggle.yb) && perto(q.pvFullBtn.yb, exp0.pvFullBtn.yb)
        && perto(q.pvCamadaBtn.yb, exp0.pvCamadaBtn.yb) && perto(q.pvGiroBtn.yb, exp0.pvGiroBtn.yb)),
      'B2 · os de BAIXO (mudo, tela cheia, selo, giro) ficam a 2 px da base durante toda a descida',
      rec.map((q) => [+q.muteToggle.yb.toFixed(1), +q.pvCamadaBtn.yb.toFixed(1)]).slice(0, 8));
    checar(todos((q) => perto(q.viewToggle.y, exp0.viewToggle.y) && perto(q.pvCastBtn.y, exp0.pvCastBtn.y)
        && perto(q.pvRecolherBtn.y, exp0.pvRecolherBtn.y)),
      'B2 · e os de CIMA (cortina, cast, seta) a 2 px do topo — acompanham a borda que desce',
      rec.map((q) => [+q.viewToggle.y.toFixed(1), +q.pvRecolherBtn.y.toFixed(1)]).slice(0, 8));

    // ---- B3 · OS BOTÕES ANDAM EM X ------------------------------------------------------------
    const xv = rec.map((q) => q.viewToggle.x);
    checar(perto(xv[0], exp0.viewToggle.x, 1.5) && perto(xv[xv.length - 1], rec1.viewToggle.x) && monotona(xv, 1)
        && distintos(xv, exp0.viewToggle.x, rec1.viewToggle.x, 2) >= 3,
      'B3 · a CORTINA anda de onde estava (o canto) até a linha única, passando por posições intermediárias — não pula',
      { de: exp0.viewToggle.x, ate: rec1.viewToggle.x, passou: distintos(xv, exp0.viewToggle.x, rec1.viewToggle.x, 2) });
    const xc = rec.map((q) => q.pvCastBtn.xr);
    checar(perto(xc[0], exp0.pvCastBtn.xr, 1.5) && perto(xc[xc.length - 1], rec1.pvCastBtn.xr) && monotona(xc, 1)
        && distintos(xc, exp0.pvCastBtn.xr, rec1.pvCastBtn.xr, 2) >= 3,
      'B3 · e o CAST, do canto da direita até ficar ao lado da tela cheia',
      { de: exp0.pvCastBtn.xr, ate: rec1.pvCastBtn.xr });

    // ---- B4 · AS CAMADAS DESVANECEM -----------------------------------------------------------
    checar(rec.slice(0, -1).filter((q) => q.h > H1 + 2).every((q) => q.wallVis === 'visible'),
      'B4 · as camadas ficam VISÍVEIS enquanto a altura corre (o wallpaper encolhe com a prévia, não some de uma vez)',
      rec.map((q) => q.wallVis).slice(0, 6));
    checar(rec.some((q) => q.wallOp > 0.1 && q.wallOp < 0.9),
      'B4 · e a opacidade passa por valores intermediários', rec.map((q) => +q.wallOp.toFixed(2)).slice(0, 12));
    checar(rec1.wallVis === 'hidden',
      'B4 · e no fim elas ficam `visibility: hidden` (a regra de sempre da prévia recolhida)', rec1.wallVis);

    // ---- B5 · NÃO SOBRA NADA ------------------------------------------------------------------
    checar(rec1.animando === false && rec1.animacoes === 0 && rec1.transformados.length === 0,
      'B5 · no fim não sobra animação, classe de movimento nem `transform` em botão nenhum',
      { animando: rec1.animando, animacoes: rec1.animacoes, transformados: rec1.transformados });
    checar(rec1.fora.length === 0, 'B5 · e nenhum botão ficou fora da prévia', rec1.fora);

    // ---- EXPANDIR: O CAMINHO DE VOLTA, SIMÉTRICO ----------------------------------------------
    const vol = await pg.evaluate(AMOSTRAR, { ids: IDS, ms: 800 });
    await assentar(pg);
    const exp1 = await medirFinal(pg);
    const hv = vol.map((q) => q.h);
    checar(exp1.recolhida === false && perto(exp1.h, H0, 1),
      'B1 · o segundo toque EXPANDE de volta à altura que a prévia tinha', { antes: H0, depois: exp1.h });
    checar(perto(hv[0], H1, 1.5) && monotona(hv, 1) && distintos(hv, H1, H0, 2) >= 4,
      'B1 · e a altura SOBE por valores intermediários, sem salto no primeiro quadro', { primeiro: hv[0], passou: distintos(hv, H1, H0, 2) });
    checar(vol.every((q) => perto(q.muteToggle.x, exp0.muteToggle.x) && perto(q.pvFullBtn.xr, exp0.pvFullBtn.xr)
        && perto(q.muteToggle.yb, exp0.muteToggle.yb) && perto(q.pvFullBtn.yb, exp0.pvFullBtn.yb)),
      'A2 · expandindo, o mudo e a tela cheia também não saem do lugar em quadro nenhum');
    checar(vol.every((q) => perto(q.viewToggle.y, exp0.viewToggle.y) && perto(q.pvRecolherBtn.y, exp0.pvRecolherBtn.y)),
      'B2 · e os de cima seguem a borda que sobe');
    checar(vol.some((q) => q.wallOp > 0.1 && q.wallOp < 0.9) && vol.every((q) => q.wallVis === 'visible'),
      'B4 · as camadas voltam desvanecendo, visíveis o tempo todo');
    checar(exp1.animando === false && exp1.animacoes === 0 && exp1.transformados.length === 0,
      'B5 · e a volta também não deixa nada para trás',
      { animando: exp1.animando, animacoes: exp1.animacoes, transformados: exp1.transformados });
    checar(perto(exp1.muteToggle.x, exp0.muteToggle.x) && perto(exp1.viewToggle.x, exp0.viewToggle.x)
        && perto(exp1.pvCastBtn.xr, exp0.pvCastBtn.xr) && perto(exp1.pvRecolherBtn.x, exp0.pvRecolherBtn.x),
      'B5 · e cada botão volta EXATAMENTE ao lugar de antes (a animação não deixa resíduo de posição)');

    // ---- C1 · SÓ O TOQUE ANIMA ----------------------------------------------------------------
    const direto = await pg.evaluate(() => {
      economiaPreview = true;
      acertarEconomiaDaPreview();
      const pv = document.getElementById('preview');
      return {
        animacoes: pv.getAnimations({ subtree: true }).filter((a) => a.effect.getComputedTiming().iterations !== Infinity).length,
        animando: pv.classList.contains('pv-animando'), recolhida: pv.classList.contains('pv-recolhida'),
      };
    });
    checar(direto.recolhida === true && direto.animacoes === 0 && direto.animando === false,
      'C1 · a abertura e a troca de destino (que chamam `acertarEconomiaDaPreview` direto) assentam NO ATO, sem movimento', direto);
    await pg.evaluate(() => { economiaPreview = false; acertarEconomiaDaPreview(); });
    await assentar(pg);

    // ---- D1 · O SEGUNDO TOQUE NO MEIO ---------------------------------------------------------
    const meio = await pg.evaluate(AMOSTRAR, { ids: IDS, ms: 900, segundoToqueEm: 110 });
    await assentar(pg);
    const fimMeio = await medirFinal(pg);
    const iA = meio.findIndex((q) => q.marca === 'antes-do-2o-toque');
    const a = meio[iA], d = meio[iA + 1];
    checar(a && d && a.h < H0 - 5 && a.h > H1 + 5,
      'D1 · PREMISSA: o segundo toque cai com a prévia a MEIO caminho', { h: a && a.h, de: H0, ate: H1 });
    checar(a && d && perto(a.h, d.h, 2.5),
      'D1 · e a prévia PARTE de onde estava (sem salto de altura)', { antes: a && a.h, depois: d && d.h });
    checar(a && d && perto(a.viewToggle.x, d.viewToggle.x, 2.5) && perto(a.pvCastBtn.xr, d.pvCastBtn.xr, 2.5),
      'D1 · e a cortina e o cast partem de onde estavam (sem salto de posição)', { antes: a && a.viewToggle.x, depois: d && d.viewToggle.x });
    checar(fimMeio.recolhida === false && perto(fimMeio.h, H0, 1) && fimMeio.animacoes === 0 && fimMeio.animando === false,
      'D1 · e assenta no estado do SEGUNDO toque, limpo', fimMeio);
    await ctx.close();
  }

  // =========================================================================
  // C2 · PREFERS-REDUCED-MOTION DESLIGA
  // =========================================================================
  {
    const { ctx, pg } = await abrir({ reduzido: true });
    const H0 = (await medirFinal(pg)).h;
    const amostra = await pg.evaluate(AMOSTRAR, { ids: IDS, ms: 300 });
    const fim = await medirFinal(pg);
    checar(fim.recolhida === true && amostra.every((q) => perto(q.h, fim.h, 0.6)),
      'C2 · com `prefers-reduced-motion` o PRIMEIRO quadro já é o final: nenhuma altura intermediária',
      { primeiro: amostra[0].h, final: fim.h, antes: H0 });
    checar(amostra.every((q) => q.anim === false) && fim.animacoes === 0,
      'C2 · e a classe de movimento nem chega a ser escrita', { animacoes: fim.animacoes });
    await ctx.close();
  }

  // =========================================================================
  // E · O FALLBACK ESTREITO (a linha desce): anima a altura, não anda em X
  // =========================================================================
  {
    const { ctx, pg } = await abrir({ largura: 320 });
    const exp0 = await medirFinal(pg);
    checar(exp0.baixo === true,
      'E0 · PREMISSA: a 320 px a linha única NÃO cabe (selo + seta + giro + cast) e o fallback liga', exp0.baixo);
    const rec = await pg.evaluate(AMOSTRAR, { ids: IDS, ms: 800 });
    await assentar(pg);
    const fim = await medirFinal(pg);
    const hs = rec.map((q) => q.h);
    checar(fim.recolhida === true && fim.baixo === true && perto(hs[0], exp0.h, 1.5) && monotona(hs, -1)
        && distintos(hs, exp0.h, fim.h, 2) >= 4 && perto(hs[hs.length - 1], fim.h, 0.6),
      'E1 · no fallback a altura também ANIMA, do estado aberto ao das duas linhas, sem salto',
      { primeiro: hs[0], antes: exp0.h, final: fim.h, passou: distintos(hs, exp0.h, fim.h, 2) });
    checar(fim.animando === false && fim.animacoes === 0 && fim.transformados.length === 0 && fim.fora.length === 0,
      'E1 · e termina assentado, sem resíduo e com todos os botões dentro da prévia',
      { animando: fim.animando, animacoes: fim.animacoes, transformados: fim.transformados, fora: fim.fora });
    await ctx.close();
  }

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
