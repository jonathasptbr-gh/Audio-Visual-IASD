#!/usr/bin/env node
// ============================================================================
// MODO FÁCIL: TRÊS TECLAS (PARAR · PLAY/PAUSA · NÍVEL) E A LINHA QUE RECOLHE SEM
// NADA NO AR (v1.13.8)
//
// Pedidos do operador, verbatim:
//  · *"Vamos remover o botão de mais e menos de volume e o de mute do modo simples.
//    Adicione a função de mute ao próprio botão que indica o nivel de volume (… cor
//    do botão normal…). Então fica assim: botão de stop, botão de play/pause e botão
//    de nivel de volume/mute"*;
//  · *"Esconder play pause e stop no modo simples, após um encerramento de mídia, no
//    caso também vale para quando feito stop pelo usuário. Lembre de animar o
//    recolhimento e com tempo suficiente para não desaparecer debaixo dos dedos do
//    usuário."*
//
// O que este arquivo trava, e cada uma falha CALADA:
//  A. A COMPOSIÇÃO: três teclas, nesta ordem (no DOM e na tela), e o −, o + e o mudo
//     próprio não existem mais.
//  B. O NÍVEL: mostra o número do volume na cor de tecla das vizinhas, e o toque MUTA de
//     verdade (`muted`, o comando `mute` no barramento) — e o estado se lê pelo DESENHO
//     (o glifo riscado e o traço de curso que some), não só pela cor.
//  C. O FIM NATURAL (`media-ended` pelo barramento): a linha FICA durante a espera, a
//     saída começa só depois de `SIMPLE_TECLAS_ESPERA_MS` (≥ 1 s), e no fim ela sai do
//     layout — a leitura cresce e a Biblioteca termina na base nova.
//  D. A VOLTA: algo entra no ar e a linha reaparece, animada.
//  E. O PARAR recolhe do mesmo jeito; a PAUSA não recolhe (pausar não tira nada do ar).
//  F. SEM MOVIMENTO (`prefers-reduced-motion`): recolhe sem animação nenhuma.
//  G. A ABERTURA sem nada no ar já nasce recolhida, sem espera e sem animação.
//
// A espera é medida pelo FATO (o instante em que a animação de saída aparece, gravado
// dentro da página), nunca por um sono: o limite de baixo não pode ser violado pela
// carga do runner (um timer não dispara ADIANTADO), e o de cima é só um prazo.
//
//   node tools/modo-simples-teclas.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperar, esperarCortina, porque, checar, falhas,
} from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;
const navegador = await abrirNavegador();
const erros = [];

async function abrir(opts = {}) {
  const ctx = await navegador.newContext({
    viewport: { width: 390, height: 780 }, hasTouch: true,
    ...(opts.reduced ? { reducedMotion: 'reduce' } : {}),
  });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  // A TELA CONECTADA (a janela do Display de mentira): é com ela que a Biblioteca é a tela
  // principal sem nada no ar, e é a caixa dela que a linha recolhida tem de deixar certa.
  await pg.evaluate(() => { webDisplayWin = { closed: false }; renderSimpleCast(); });
  // O ESPIÃO: cada comando do barramento, e o instante em que a linha começa a sair.
  await pg.evaluate(() => {
    window.__cmds = [];
    const orig = AVDB.sendCommand.bind(AVDB);
    AVDB.sendCommand = (c) => { window.__cmds.push(c); return orig(c); };
    window.__saida = null;
    const el = document.querySelector('.simple-remote');
    const olhar = () => {
      if (window.__saida === null && el.getAnimations().length
          && !el.classList.contains('recolhida')) window.__saida = performance.now();
      requestAnimationFrame(olhar);
    };
    requestAnimationFrame(olhar);
    // E A JANELA DA BIBLIOTECA, no instante em que a linha sai do layout: ela tem de ANIMAR até a
    // base nova (a medida de troca), e não pular para lá.
    window.__janelaAnimou = null;
    new MutationObserver(() => {
      if (!el.classList.contains('recolhida')) return;
      window.__janelaAnimou = document.getElementById('hymnSearchPopup').getAnimations()
        .some((x) => x.transitionProperty === 'bottom');
    }).observe(el, { attributes: true, attributeFilter: ['class'] });
  });
  const id = await pg.evaluate(async () => (await AVDB.addMedia(new Blob(['x'], { type: 'audio/wav' }),
    { name: 'Louvor de Fundo', type: 'audio/wav', kind: 'audio', list: 'imports' })).id);
  return { ctx, pg, id };
}
const subir = (pg, id) => pg.evaluate(async (i) => {
  await send(i);
  currentItem.lyrics = [{ cover: true }, { time: 0, text: 'primeira' }, { time: 5, text: 'segunda' }];
  renderSlideNav();
}, id);
const ler = (pg) => pg.evaluate(() => {
  const remote = document.querySelector('.simple-remote');
  const cx = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), w: Math.round(r.width) }; };
  return {
    display: getComputedStyle(remote).display,
    recolhida: remote.classList.contains('recolhida'),
    animacoes: remote.getAnimations().length,
    opacidade: +getComputedStyle(remote).opacity,
    noAr: haOQueParar(),
    aberta: document.getElementById('hymnSearchPopup').classList.contains('open'),
    principal: document.body.classList.contains('simples-principal'),
    camada: cx(document.getElementById('hymnSearchPopup')),
    song: cx(document.querySelector('.simple-song')),
    altura: document.getElementById('simpleMode').clientHeight,
  };
});
// A animação que a janela da Biblioteca faz até a base nova (o `--pop-anim`, 0,28 s).
const assentar = (pg) => esperar(pg, () => {
  const j = document.getElementById('hymnSearchPopup');
  const r = document.querySelector('.simple-remote');
  return !j.getAnimations().some((a) => a.playState === 'running') && !r.getAnimations().length;
}, null, 8000);

try {
  const { ctx, pg, id } = await abrir();

  // ======================= G · A ABERTURA =======================
  const g = await ler(pg);
  checar(!g.noAr && g.recolhida && g.display === 'none' && g.animacoes === 0,
    'G · a abertura sem nada no ar já nasce RECOLHIDA, sem animação (não há dedo a esperar)', JSON.stringify(g));

  // ======================= A · A COMPOSIÇÃO =======================
  await subir(pg, id);
  await assentar(pg);
  const a = await pg.evaluate(() => {
    const vis = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
    const teclas = [...document.querySelectorAll('.simple-keys > button')];
    return {
      ids: teclas.map((b) => b.id),
      visiveis: teclas.filter(vis).map((b) => b.id),
      esq: teclas.map((b) => Math.round(b.getBoundingClientRect().left)),
      fora: ['simpleMute', 'simpleVolUp', 'simpleVolDown', 'simpleVolWrap', 'simpleVolValue']
        .filter((x) => document.getElementById(x)),
      volrow: !!document.querySelector('.simple-volrow'),
      fileiras: [...document.querySelectorAll('.simple-remote > *')].filter(vis).length,
    };
  });
  checar(JSON.stringify(a.ids) === JSON.stringify(['simpleStop', 'simplePlay', 'simpleNivel'])
    && JSON.stringify(a.visiveis) === JSON.stringify(a.ids),
    'A1 · com mídia no ar a linha tem TRÊS teclas, nesta ordem: Parar · Play/Pausa · Nível', JSON.stringify(a));
  checar(a.esq[0] < a.esq[1] && a.esq[1] < a.esq[2],
    'A2 · e a ordem é a da TELA, da esquerda para a direita (não só a do DOM)', JSON.stringify(a.esq));
  checar(a.fora.length === 0 && !a.volrow && a.fileiras === 1,
    'A3 · o −, o + e a tecla de mudo própria não existem mais: uma fileira só', JSON.stringify(a));

  // ======================= B · O NÍVEL =======================
  const b0 = await pg.evaluate(() => {
    const n = document.getElementById('simpleNivel');
    const p = document.getElementById('simpleStop');
    return {
      num: document.getElementById('simpleNivelNum').textContent,
      volume: String(Math.round(volume * 100)),
      bg: getComputedStyle(n).backgroundColor, bgParar: getComputedStyle(p).backgroundColor,
      glifo: n.querySelector('.msym').textContent, volOn: ICON.volOn,
      traco: getComputedStyle(n, '::after').display, muted,
    };
  });
  checar(b0.num === b0.volume && !b0.muted,
    'B1 · o NÍVEL mostra o número do volume (o mesmo `volume` do fader do avançado)', JSON.stringify(b0));
  checar(b0.bg === b0.bgParar,
    'B2 · na COR DE TECLA de sempre: o mesmo fundo do Parar ao lado', JSON.stringify(b0));
  checar(b0.glifo === b0.volOn && b0.traco !== 'none',
    'B3 · com som: o alto-falante inteiro e o traço de curso na base', JSON.stringify(b0));
  await pg.click('#simpleNivel');
  const b1 = await pg.evaluate(() => {
    const n = document.getElementById('simpleNivel');
    return {
      muted, muteMarcado: document.getElementById('muteToggle').classList.contains('muted'),
      cmd: window.__cmds.filter((c) => c.type === 'mute').slice(-1)[0] || null,
      glifo: n.querySelector('.msym').textContent, volOff: ICON.volOff,
      traco: getComputedStyle(n, '::after').display, classe: n.classList.contains('muted'),
      num: document.getElementById('simpleNivelNum').textContent,
    };
  });
  checar(b1.muted === true && b1.muteMarcado && b1.cmd && b1.cmd.muted === true,
    'B4 · o TOQUE no nível MUTA de verdade: `muted`, o botão do avançado e o comando `mute` no barramento',
    JSON.stringify(b1));
  checar(b1.glifo === b1.volOff && b1.traco === 'none' && b1.classe,
    'B5 · e o mudo se lê pelo DESENHO: o alto-falante riscado e o traço de curso some (não só a cor)',
    JSON.stringify(b1));
  checar(b1.num === b0.num,
    'B6 · o número fica — é o volume que volta ao tirar o mudo', JSON.stringify(b1));
  await pg.click('#simpleNivel');
  const b2 = await pg.evaluate(() => ({ muted,
    cmd: window.__cmds.filter((c) => c.type === 'mute').slice(-1)[0] || null }));
  checar(b2.muted === false && b2.cmd && b2.cmd.muted === false,
    'B7 · e o segundo toque tira o mudo', JSON.stringify(b2));

  // ======================= C · O FIM NATURAL =======================
  const espera = await pg.evaluate(() => SIMPLE_TECLAS_ESPERA_MS);
  checar(espera >= 1000, 'C0 · a espera antes de recolher é de pelo menos 1 s', String(espera));
  const fimEm = await pg.evaluate((i) => {
    window.__saida = null;
    // O TELÃO DE MENTIRA fala pelo MESMO barramento que o de verdade.
    const f = document.createElement('iframe');
    f.style.display = 'none';
    document.body.appendChild(f);
    f.contentWindow.eval('new BroadcastChannel("av-iasd").postMessage('
      + JSON.stringify({ type: 'media-ended', mediaId: i }) + ')');
    return performance.now();
  }, id);
  const acabou = await esperar(pg, () => midiaNoAr === false, null, 5000);
  checar(acabou === true, 'C1 · PREMISSA: o `media-ended` derruba o "no ar"', porque(acabou));
  const c2 = await ler(pg);
  const alvoParar = await pg.evaluate(() => {
    const r = document.getElementById('simpleStop').getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!el && !!el.closest('#simpleStop');
  });
  checar(!c2.recolhida && c2.display !== 'none' && c2.opacidade === 1 && alvoParar,
    'C2 · logo depois do fim a linha FICA, inteira e tocável — o dedo ainda pode estar ali', JSON.stringify(c2));
  const recolheu = await esperar(pg, () => document.querySelector('.simple-remote').classList.contains('recolhida'), null, 8000);
  const saida = await pg.evaluate(() => window.__saida);
  checar(recolheu === true, 'C3 · e ela RECOLHE sozinha', porque(recolheu));
  checar(saida !== null && saida - fimEm >= espera - 20 && saida - fimEm >= 1000,
    'C4 · a SAÍDA começa só depois da espera (medido dentro da página: ' + Math.round((saida || 0) - fimEm) + ' ms)',
    JSON.stringify({ saida, fimEm, espera }));
  await assentar(pg);
  const c5 = await ler(pg);
  checar(c5.display === 'none' && c5.principal && c5.aberta,
    'C5 · recolhida ela sai do LAYOUT, com a Biblioteca como tela principal', JSON.stringify(c5));
  const janela = await pg.evaluate(() => window.__janelaAnimou);
  checar(janela === true,
    'C5b · e a Biblioteca ANIMA até a base nova no instante em que a linha sai — não pula', String(janela));
  checar(Math.abs(c5.camada.bottom - c5.song.bottom) <= 2 && c5.altura - c5.song.bottom <= 24,
    'C6 · e a caixa da Biblioteca termina onde a leitura agora termina: na base da tela, sem vão',
    JSON.stringify(c5));

  // ======================= D · A VOLTA =======================
  await subir(pg, id);
  const d1 = await ler(pg);
  checar(d1.noAr && !d1.recolhida && d1.display !== 'none' && d1.animacoes > 0,
    'D1 · algo entra no ar e a linha VOLTA na hora, animada', JSON.stringify(d1));
  await assentar(pg);
  const d2 = await ler(pg);
  checar(d2.opacidade === 1 && d2.display !== 'none',
    'D2 · e assenta inteira', JSON.stringify(d2));

  // ======================= E · O PARAR e A PAUSA =======================
  // A PAUSA não recolhe: espera-se o fato que FECHA a janela (a espera inteira mais a saída).
  await pg.evaluate(() => { window.__saida = null; document.getElementById('simplePlay').click(); });
  const pausa0 = await pg.evaluate(() => ({ playing, noAr: haOQueParar(), t: performance.now() }));
  await pg.waitForTimeout(espera + 700);
  const e1 = await ler(pg);
  checar(pausa0.noAr && !e1.recolhida && e1.display !== 'none' && await pg.evaluate(() => window.__saida === null),
    'E1 · PAUSAR não recolhe: a mídia continua no ar (a pergunta é a do Parar)', JSON.stringify({ pausa0, e1 }));
  const pararEm = await pg.evaluate(() => { window.__saida = null; document.getElementById('simpleStop').click(); return performance.now(); });
  const e2 = await ler(pg);
  checar(!e2.noAr && !e2.recolhida && e2.display !== 'none',
    'E2 · o PARAR tira do ar e a linha fica durante a espera (o dedo que tocou o Parar está ali)', JSON.stringify(e2));
  const recolheuParar = await esperar(pg, () => document.querySelector('.simple-remote').classList.contains('recolhida'), null, 8000);
  const saidaParar = await pg.evaluate(() => window.__saida);
  checar(recolheuParar === true && saidaParar !== null && saidaParar - pararEm >= espera - 20,
    'E3 · e recolhe depois da espera (' + Math.round((saidaParar || 0) - pararEm) + ' ms)',
    porque(recolheuParar) || JSON.stringify({ saidaParar, pararEm }));
  await assentar(pg);
  const e4 = await ler(pg);
  checar(Math.abs(e4.camada.bottom - e4.song.bottom) <= 2 && e4.altura - e4.song.bottom <= 24,
    'E4 · e a caixa da Biblioteca acompanha', JSON.stringify(e4));
  await ctx.close();

  // ======================= F · SEM MOVIMENTO =======================
  {
    const r = await abrir({ reduced: true });
    await subir(r.pg, r.id);
    await r.pg.evaluate(() => { window.__saida = null; });
    const f0 = await ler(r.pg);
    checar(f0.animacoes === 0 && f0.display !== 'none',
      'F1 · com `prefers-reduced-motion` a volta é seca', JSON.stringify(f0));
    await r.pg.evaluate(() => document.getElementById('simpleStop').click());
    const rec = await esperar(r.pg, () => document.querySelector('.simple-remote').classList.contains('recolhida'), null, 8000);
    const f1 = await r.pg.evaluate(() => window.__saida);
    checar(rec === true && f1 === null,
      'F2 · e recolhe sem animação nenhuma — só depois da espera, e seca', porque(rec) || String(f1));
    await r.ctx.close();
  }

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
