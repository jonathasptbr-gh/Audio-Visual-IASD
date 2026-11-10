#!/usr/bin/env node
// ============================================================================
// MODO FÁCIL: TRÊS TECLAS (PARAR · PLAY/PAUSA · TELA CHEIA) E A PÍLULA DO VOLUME
// (v1.13.8 → v1.13.57)
//
// Pedidos do operador, verbatim:
//  · *"Vamos remover o botão de mais e menos de volume e o de mute do modo simples.
//    Adicione a função de mute ao próprio botão que indica o nivel de volume (… cor
//    do botão normal…). Então fica assim: botão de stop, botão de play/pause e botão
//    de nivel de volume/mute"* (v1.13.8 — a tecla de volume na linha nasceu aqui);
//  · *"Esconder play pause e stop no modo simples, após um encerramento de mídia, no
//    caso também vale para quando feito stop pelo usuário. Lembre de animar o
//    recolhimento e com tempo suficiente para não desaparecer debaixo dos dedos do
//    usuário."*
//
// A v1.13.57 DESFEZ a metade "volume" daquela tecla: ela virou TELA CHEIA, e o volume
// do app — que saiu da barra — mora numa pílula flutuante, acesa pela tecla física.
// O que este arquivo trava, e cada uma falha CALADA:
//  A. A COMPOSIÇÃO: três teclas, nesta ordem (no DOM e na tela): Parar · Play/Pausa ·
//     TELA CHEIA. O −, o +, o mudo próprio, a tecla de NÍVEL e o `#simpleFsBtn` do
//     card do nome não existem mais.
//  B. A TELA CHEIA E A PÍLULA: a terceira tecla é a porta da prévia, e é a pergunta do
//     Parar que a apaga — SEM mídia no ar ela está DESABILITADA, apagada, com o motivo
//     no rótulo; com mídia no ar e SEM destino de projeção fica habilitada e o toque
//     abre a tela cheia (com uma tela conectada volta a apagar: o visor é a TV). E o
//     VOLUME mora na `#volPill`, no corpo, com o `#volSlider` e o `#volValue` — o mudo
//     dela aciona o `#muteToggle`, e `peekVolume()` a acende e ela some sozinha.
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
  // `semTela` abre o outro cenário do Modo Fácil — o "tocar neste celular", sem destino de
  // projeção —, e é o ÚNICO em que a tecla de tela cheia pode ficar habilitada (ver B).
  if (!opts.semTela) await pg.evaluate(() => { webDisplayWin = { closed: false }; renderSimpleCast(); });
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
    const esqPorId = {};
    for (const b of teclas) esqPorId[b.id] = Math.round(b.getBoundingClientRect().left);
    const tela = document.getElementById('simpleTela');
    return {
      ids: teclas.map((b) => b.id),
      visiveis: teclas.filter(vis).map((b) => b.id),
      esqPorId,
      fora: ['simpleMute', 'simpleVolUp', 'simpleVolDown', 'simpleVolWrap', 'simpleVolValue',
        'simpleNivel', 'simpleNivelNum', 'simpleFsBtn']
        .filter((x) => document.getElementById(x)),
      volrow: !!document.querySelector('.simple-volrow'),
      fileiras: [...document.querySelectorAll('.simple-remote > *')].filter(vis).length,
      telaDisabled: tela ? tela.disabled : null,
      telaTitle: tela ? tela.title : null,
      telaAria: tela ? tela.getAttribute('aria-label') : null,
    };
  });
  checar(JSON.stringify(a.ids) === JSON.stringify(['simpleStop', 'simplePlay', 'simpleTela'])
    && JSON.stringify(a.visiveis) === JSON.stringify(a.ids),
    'A1 · com mídia no ar a linha tem TRÊS teclas, nesta ordem: Parar · Play/Pausa · Tela cheia', JSON.stringify(a));
  checar(a.esqPorId.simpleStop < a.esqPorId.simplePlay && a.esqPorId.simplePlay < a.esqPorId.simpleTela,
    'A2 · e a ordem é a da TELA, da esquerda para a direita (não só a do DOM)', JSON.stringify(a.esqPorId));
  checar(a.fora.length === 0 && !a.volrow && a.fileiras === 1,
    'A3 · o −, o +, o mudo próprio, a tecla de NÍVEL e o `#simpleFsBtn` não existem mais: uma fileira só',
    JSON.stringify(a));
  // A OUTRA METADE DA PERGUNTA (`!haDestinoDeProjecao()`): com uma tela conectada a tela cheia
  // não é a do celular — quem mostra é a TV, e a tecla tem de dizer isso, não ficar inerte.
  checar(a.telaDisabled === true && a.telaTitle === 'Com tela conectada, o visor é a TV'
    && a.telaAria === a.telaTitle,
    'A4 · com uma TELA conectada a tecla fica DESABILITADA — o visor é a TV, e o motivo está no rótulo',
    JSON.stringify({ telaDisabled: a.telaDisabled, telaTitle: a.telaTitle, telaAria: a.telaAria }));

  // ======================= B · A TELA CHEIA E A PÍLULA DO VOLUME =======================
  // CONTEXTO PRÓPRIO, e o motivo é a pergunta da tecla: `telaCheiaDoModoFacilCabe()` = há o
  // que parar E não há destino de projeção. Com a janela do Display de mentira do `abrir()`
  // a segunda metade é sempre falsa (A4), então o estado HABILITADO só existe no Modo Fácil
  // do "tocar neste celular" — sem destino, quando a tela cheia da prévia É a projeção.
  {
    const r = await abrir({ semTela: true });
    const tela = () => r.pg.evaluate(() => {
      const t = document.getElementById('simpleTela');
      if (!t) return null;
      return { disabled: t.disabled, title: t.title, aria: t.getAttribute('aria-label'),
        opacidade: +getComputedStyle(t).opacity };
    });
    // SEM MÍDIA NO AR: nada a mostrar, e a tecla não pode parecer uma escolha de alguém.
    const b1 = await tela();
    checar(!!b1 && b1.disabled === true && b1.opacidade < 1
      && b1.title === 'A tela cheia abre com uma mídia no ar' && b1.aria === b1.title,
      'B1 · SEM mídia no ar a tecla de TELA CHEIA está DESABILITADA, apagada, com o motivo no rótulo',
      JSON.stringify(b1));
    // DESTRAVAR O MODO não a acende: a pergunta é a do Parar, não a do portão.
    await r.pg.evaluate(() => setTocarNoCelular(true));
    const b2 = await tela();
    checar(!!b2 && b2.disabled === true && b2.title === 'A tela cheia abre com uma mídia no ar',
      'B2 · e destravar o Modo Fácil não a acende: sem nada no ar não há o que mostrar', JSON.stringify(b2));
    await r.pg.evaluate(async (i) => { await send(i); }, r.id);
    await assentar(r.pg);
    const b3 = await tela();
    checar(!!b3 && b3.disabled === false && b3.opacidade === 1
      && b3.title === 'Ver em tela cheia' && b3.aria === b3.title,
      'B3 · com mídia no ar e SEM tela conectada ela fica HABILITADA, e o rótulo passa a dizer a AÇÃO',
      JSON.stringify(b3));
    // O VOLUME DO APP SAIU DA LINHA E MORA NA PÍLULA — e a pílula não pertence a barra nenhuma.
    const b4 = await r.pg.evaluate(() => {
      const pill = document.getElementById('volPill');
      const slider = document.getElementById('volSlider');
      const valor = document.getElementById('volValue');
      const mudo = document.getElementById('volPillMute');
      return {
        pill: !!pill,
        noCorpo: !!pill && pill.parentElement === document.body,
        sliderDentro: !!pill && !!slider && pill.contains(slider),
        valorDentro: !!pill && !!valor && pill.contains(valor),
        mudoDentro: !!pill && !!mudo && pill.contains(mudo),
        foraDaBarra: !!slider && !slider.closest('.simple-remote')
          && !slider.closest('.simple-keys') && !slider.closest('.fader-wrap'),
      };
    });
    checar(b4.pill && b4.noCorpo && b4.sliderDentro && b4.valorDentro && b4.mudoDentro,
      'B4 · o volume do app mora na PÍLULA: `#volPill` no corpo, com o `#volSlider`, o `#volValue` e o mudo dentro',
      JSON.stringify(b4));
    checar(b4.foraDaBarra,
      'B5 · e ele SAIU da barra: o `#volSlider` não está no `.simple-remote` nem no antigo `.fader-wrap`',
      JSON.stringify(b4));
    // O NÚMERO E O FADER SÃO O VOLUME DO APP (o mesmo que vai ao telão e às telas da rede).
    const b6 = await r.pg.evaluate(() => {
      const pill = document.getElementById('volPill');
      return {
        volume: Math.round(volume * 100),
        valor: document.getElementById('volValue').textContent,
        slider: document.getElementById('volSlider').value,
        dentro: !!pill && pill.contains(document.getElementById('volValue'))
          && pill.contains(document.getElementById('volSlider')),
      };
    });
    checar(b6.dentro && b6.valor === String(b6.volume) && b6.slider === String(b6.volume),
      'B6 · e o número e o fader da PÍLULA mostram o MESMO volume do app', JSON.stringify(b6));
    const b7 = await r.pg.evaluate(() => {
      const s = document.getElementById('volSlider');
      s.value = '42';
      s.dispatchEvent(new Event('input', { bubbles: true }));
      const pill = document.getElementById('volPill');
      return {
        volume: Math.round(volume * 100), valor: document.getElementById('volValue').textContent,
        slider: s.value, cmd: window.__cmds.filter((c) => c.type === 'volume').slice(-1)[0] || null,
        acendeu: !!pill && pill.classList.contains('visivel'),
      };
    });
    checar(b7.volume === 42 && b7.valor === '42' && b7.slider === '42'
      && !!b7.cmd && Math.abs(b7.cmd.volume - 0.42) < 0.005 && b7.acendeu,
      'B7 · e mexer nela muda o volume do APP e ACENDE a pílula — o mesmo comando `volume` do barramento',
      JSON.stringify(b7));
    // `peekVolume()` ACENDE a pílula: é ele que a tecla física chama.
    const b8 = await r.pg.evaluate(() => {
      const el = document.getElementById('volPill');
      if (!el) return null;
      window.__pilulaT = performance.now();
      peekVolume();
      return { classe: el.className, vis: getComputedStyle(el).visibility,
        pe: getComputedStyle(el).pointerEvents };
    });
    checar(!!b8 && /\bvisivel\b/.test(b8.classe) && b8.vis === 'visible' && b8.pe === 'auto',
      'B8 · `peekVolume()` ACENDE a pílula (classe `visivel`, visível e tocável)', JSON.stringify(b8));
    await esperar(r.pg, () => {
      const el = document.getElementById('volPill');
      return !!el && +getComputedStyle(el).opacity > 0.9;
    }, null, 1200);
    const b9 = await r.pg.evaluate(() => {
      const pill = document.getElementById('volPill');
      if (!pill) return null;
      const p = pill.getBoundingClientRect();
      const k = document.getElementById('simplePlay').getBoundingClientRect();
      return { topo: p.top, base: p.bottom, larg: p.width, teclasTopo: k.top, vh: innerHeight };
    });
    checar(!!b9 && b9.larg > 0 && b9.topo >= 0 && b9.base <= b9.vh && b9.base <= b9.teclasTopo + 0.6,
      'B9 · e ela pousa ACIMA das teclas, inteira na tela — não cobre botão nenhum', JSON.stringify(b9));
    // O MUDO: o ícone da pílula aciona o MESMO `#muteToggle` do avançado.
    const b10 = await r.pg.evaluate(() => {
      const b = document.getElementById('volPillMute');
      if (!b) return null;
      b.click();
      return { muted, toggle: document.getElementById('muteToggle').classList.contains('muted'),
        cmd: window.__cmds.filter((c) => c.type === 'mute').slice(-1)[0] || null };
    });
    checar(!!b10 && b10.muted === true && b10.toggle === true
      && !!b10.cmd && b10.cmd.muted === true,
      'B10 · o MUDO da pílula aciona o `#muteToggle`: `muted` liga, o botão do avançado marca e o comando sai',
      JSON.stringify(b10));
    const b11 = await r.pg.evaluate(() => {
      const b = document.getElementById('volPillMute');
      if (!b) return null;
      b.click();
      return { muted, cmd: window.__cmds.filter((c) => c.type === 'mute').slice(-1)[0] || null };
    });
    checar(!!b11 && b11.muted === false && !!b11.cmd && b11.cmd.muted === false,
      'B11 · e o segundo toque tira o mudo', JSON.stringify(b11));
    // E ELA SOME SOZINHA: não há botão que a feche.
    const b12 = await r.pg.evaluate(() => {
      if (typeof VOL_PILL_MS !== 'number') return 0;
      window.__pilulaT = performance.now();
      peekVolume();
      return VOL_PILL_MS;
    });
    const sumiu = await esperar(r.pg, () => {
      const el = document.getElementById('volPill');
      return !!el && !el.classList.contains('visivel');
    }, null, 4000);
    const b13 = await r.pg.evaluate(() => ({ ms: performance.now() - (window.__pilulaT || 0) }));
    const escondeu = await esperar(r.pg, () => {
      const el = document.getElementById('volPill');
      return !!el && getComputedStyle(el).visibility === 'hidden';
    }, null, 1500);
    checar(b12 >= 1000,
      'B12 · a pílula acende por pelo menos 1 s antes de se apagar (VOL_PILL_MS)', String(b12));
    checar(b12 >= 1000 && sumiu === true && escondeu === true && b13.ms >= b12 - 20,
      'B13 · e SOME SOZINHA, sem botão que a feche (medido dentro da página: ' + Math.round(b13.ms) + ' ms)',
      JSON.stringify({ b12, b13 }));
    // E A TECLA NÃO É SÓ UM RÓTULO: o toque nela abre a tela cheia da prévia.
    const habilitada = await r.pg.evaluate(() => {
      const t = document.getElementById('simpleTela');
      return !!t && !t.disabled;
    });
    if (habilitada) {
      await r.pg.click('#simpleTela');
      const fs = await r.pg.evaluate(() => ({
        fullscreen: document.fullscreenElement === document.getElementById('preview'),
        previa: previaCheia(),
      }));
      checar(fs.fullscreen && fs.previa,
        'B14 · e o TOQUE nela abre a tela cheia da prévia', JSON.stringify(fs));
    } else {
      checar(false, 'B14 · e o TOQUE nela abre a tela cheia da prévia', 'a tecla não está habilitada');
    }
    await r.ctx.close();
  }

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
