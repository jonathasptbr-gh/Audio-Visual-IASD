#!/usr/bin/env node
// ============================================================================
// MODO FÁCIL: DURANTE UMA BUSCA AS TECLAS SAEM, E O ENTER FECHA O TECLADO (v1.12.51)
//
// Pedido do operador, verbatim: *"Ocultar os botões de play, stop, e volumes no modo simples,
// durante uma busca na caixa de texto da biblioteca. Também aceite o enter/pesquisar do teclado
// para fechar o teclado e permitir exibir os resultados de forma a ter mais espaço visual. Isso foi
// porque em alguns aparelhos de menor resolução de tela, ou por tamanho de teclados diversos, a
// seção de resultados não tem mais de 20% de tela disponível"*.
//
// A CAUSA (medida antes do conserto): onde o navegador ENCOLHE a viewport com o teclado, `--kb` dá
// zero, o `.simple` (fixo) encolhe junto e as teclas, o volume e o card do nome ficam logo acima do
// teclado — a lista tinha o que sobrava: 3 a 35% da área visível (10 px a 360×640 com teclado de
// 55%). O teclado é simulado nos DOIS mundos que o app precisa acertar:
//   · `honra`  — a viewport de LAYOUT encolhe (`setViewportSize`): o hint
//                `interactive-widget=resizes-content` ou o `adjustResize` do Android;
//   · `ignora` — só a viewport VISUAL encolhe (o `visualViewport` falso do `smoke.mjs`): o WebView
//                em edge-to-edge do Android 15+, onde quem desconta o teclado é `--kb`.
//
// O que este arquivo trava, e cada uma falha CALADA:
//  A. COM MÍDIA NO AR: o foco no campo tira as teclas e o card do nome, e a janela vai até a base;
//     o Enter (o `keydown` ou a submissão do formulário do campo) tira o foco e MANTÉM o texto, os
//     resultados e as teclas fora; o ✕ do campo com o
//     campo perdendo o foco devolve as teclas (com o fade); o voltar devolve as teclas.
//  B. COMO TELA PRINCIPAL: o foco tira as teclas; a ESCOLHA de uma linha não as devolve sob o dedo,
//     mas devolve quando o feedback assenta, mesmo com o texto ainda no campo; o foco volta a
//     tirá-las durante o download.
//  C. COM TECLADO (os dois mundos, três telas pequenas, fonte 1× e 1,3×): a lista vai do campo ao
//     topo do teclado — nunca atrás dele, nunca parando antes. E depois do Enter, sem teclado, ela
//     vai até o fim da tela.
//  D. NO AVANÇADO o Enter só tira o foco: nada é escondido, e a caixa de controles volta.
//  E. O FADE da volta não existe com `prefers-reduced-motion`.
//
//   node tools/modo-simples-busca.test.mjs
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

// O TECLADO DO MUNDO `ignora` — a mesma troca de OBJETO do `smoke.mjs`: o `keyboardShift` lê
// `window.visualViewport` como leria no aparelho, e sem `__teclado` o falso espelha a viewport real.
const TECLADO_FALSO = () => {
  const alvo = new EventTarget();
  const falso = {
    height: 0, width: 0, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1,
    addEventListener: (...a) => alvo.addEventListener(...a),
    removeEventListener: (...a) => alvo.removeEventListener(...a),
  };
  const espelhar = () => {
    if (window.__kbAberto) return;
    falso.height = window.innerHeight; falso.width = window.innerWidth; falso.offsetTop = 0;
  };
  window.addEventListener('resize', () => { espelhar(); alvo.dispatchEvent(new Event('resize')); });
  Object.defineProperty(window, 'visualViewport', { get: () => { espelhar(); return falso; }, configurable: true });
  window.__teclado = (px) => {
    window.__kbAberto = px > 0;
    falso.width = window.innerWidth; falso.height = window.innerHeight - px; falso.offsetTop = 0;
    alvo.dispatchEvent(new Event('resize'));
    alvo.dispatchEvent(new Event('scroll'));
  };
};

const LETRA = { id: 'm-letra', name: 'Louvor de Fundo', kind: 'audio',
  lyrics: [{ cover: true }, { time: 0, text: 'primeira' }, { time: 5, text: 'segunda' }] };

async function abrir(opts = {}) {
  const ctx = await navegador.newContext({
    viewport: opts.viewport || { width: 390, height: 780 }, hasTouch: true,
    ...(opts.reduced ? { reducedMotion: 'reduce' } : {}),
  });
  await semRedeExterna(ctx);
  await ctx.addInitScript(TECLADO_FALSO);
  if (opts.avancado) await comModoAvancado(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  if (opts.fonte) await pg.evaluate((f) => { document.documentElement.style.fontSize = (16 * f) + 'px'; }, opts.fonte);
  if (!opts.avancado) {
    await pg.evaluate(() => { webDisplayWin = { closed: false }; renderSimpleCast(); });
    if (opts.midia) {
      await pg.evaluate((it) => {
        currentItem = it; midiaNoAr = true; npNameInnerEl.textContent = it.name;
        renderSimple(); renderTransporteHabilitado();
      }, LETRA);
    }
    await quadros(pg);
  }
  return { ctx, pg };
}
// A janela anima só o `bottom` (`--pop-anim`, 0,28 s) e o fade das teclas dura 0,26 s.
const quadros = (pg) => pg.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 450));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
});
const ler = (pg) => pg.evaluate(() => {
  const cx = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }; };
  const exibido = (el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
  const remote = document.querySelector('.simple-remote');
  const card = document.querySelector('.simple-nowplaying');
  const campo = document.getElementById('hymnSearchInput');
  return {
    buscando: document.getElementById('simpleMode').classList.contains('buscando'),
    voltando: document.getElementById('simpleMode').classList.contains('teclas-voltando'),
    teclas: exibido(remote), card: exibido(card),
    aberta: document.getElementById('hymnSearchPopup').classList.contains('open'),
    foco: document.activeElement === campo,
    valor: campo.value,
    camada: cx(document.getElementById('hymnSearchPopup')),
    song: cx(document.querySelector('.simple-song')),
    acervo: !!document.querySelector('#hymnResults .hymnal-card, #hymnResults .coll-group'),
    resultados: document.getElementById('hymnResults').children.length,
    innerHeight: window.innerHeight,
  };
});

try {
  // ======================= A · COM MÍDIA NO AR =======================
  {
    const { ctx, pg } = await abrir({ midia: true });
    const a0 = await ler(pg);
    checar(a0.teclas && a0.card && !a0.buscando && !a0.aberta,
      'A0 · PREMISSA: com mídia no ar e a janela fechada, as teclas e o card do nome estão à vista', JSON.stringify(a0));
    await pg.click('#hymnSearchInput');
    await esperar(pg, () => document.getElementById('hymnSearchPopup').classList.contains('open'), null, 10000);
    await quadros(pg);
    const a1 = await ler(pg);
    checar(a1.buscando && !a1.teclas && !a1.card,
      'A1 · o foco no campo tira as teclas (play, parar, mudo, volume) e o card do nome', JSON.stringify(a1));
    checar(Math.abs(a1.camada.bottom - a1.song.bottom) <= 2 && a1.song.bottom > a0.song.bottom + 100,
      'A2 · e a janela vai até a base da zona de leitura, que cresceu para o lugar delas',
      JSON.stringify({ camada: a1.camada, song: a1.song, songAntes: a0.song }));

    await pg.keyboard.type('zzzzqq');
    await esperar(pg, () => !document.getElementById('hymnSearchLimpar').hidden, null, 10000);
    await pg.keyboard.press('Enter');
    await quadros(pg);
    const a3 = await ler(pg);
    checar(a3.foco === false,
      'A3 · o Enter tira o foco do campo — é o que faz o teclado descer', JSON.stringify(a3));
    checar(a3.valor === 'zzzzqq' && a3.aberta && !a3.acervo && a3.resultados > 0,
      'A4 · e a busca fica: o texto, a janela aberta e os resultados do termo (não o acervo)', JSON.stringify(a3));
    checar(a3.buscando && !a3.teclas && !a3.card,
      'A5 · sem foco e com texto as teclas CONTINUAM fora: o espaço que o teclado liberou é da lista', JSON.stringify(a3));

    // O OUTRO CAMINHO DO ENTER: o teclado que manda a tecla de ação como 229 "Unidentified" não
    // dispara o `keydown` de Enter, e quem a pega é a submissão implícita do formulário do campo.
    await pg.focus('#hymnSearchInput');
    const a5b = await pg.evaluate(() => {
      const campo = document.getElementById('hymnSearchInput');
      const antes = document.activeElement === campo;
      campo.form.requestSubmit();
      return { antes, foco: document.activeElement === campo, valor: campo.value, url: location.pathname,
        buscando: document.getElementById('simpleMode').classList.contains('buscando') };
    });
    checar(a5b.antes && !a5b.foco && a5b.valor === 'zzzzqq' && a5b.url === '/controle/' && a5b.buscando,
      'A5b · a submissão do formulário do campo (a tecla "Pesquisar" sem `keydown` de Enter) faz o mesmo, sem navegar',
      JSON.stringify(a5b));

    // O ✕ do campo limpa e devolve o foco (ainda buscando); o campo perdendo o foco vazio encerra.
    await pg.click('#hymnSearchLimpar');
    await quadros(pg);
    const a6 = await ler(pg);
    checar(a6.valor === '' && a6.foco && a6.buscando && !a6.teclas,
      'A6 · o ✕ do campo apaga e devolve o foco: ainda é uma busca, e as teclas seguem fora', JSON.stringify(a6));
    await pg.evaluate(() => document.getElementById('hymnSearchInput').blur());
    const a7 = await ler(pg);
    checar(!a7.buscando && a7.teclas && a7.voltando,
      'A7 · o campo VAZIO perdendo o foco devolve as teclas, com o fade da volta', JSON.stringify(a7));
    await quadros(pg);
    const a8 = await ler(pg);
    checar(Math.abs(a8.camada.bottom - a8.song.bottom) <= 2 && a8.song.bottom < a1.song.bottom - 100 && !a8.voltando,
      'A8 · e a janela volta a terminar na base da leitura, acima delas (e o fade acaba)',
      JSON.stringify({ camada: a8.camada, song: a8.song, voltando: a8.voltando }));

    // O voltar do Android fecha a janela aberta sobre a leitura — e a busca com ela.
    await pg.click('#hymnSearchInput');
    await pg.keyboard.type('abc');
    await pg.keyboard.press('Enter');
    await quadros(pg);
    const a9a = await ler(pg);
    const voltar = await pg.evaluate(() => window.__avBack());
    await quadros(pg);
    const a9 = await ler(pg);
    checar(a9a.buscando && voltar === true && !a9.aberta && !a9.buscando && a9.teclas && a9.card,
      'A9 · o voltar fecha a Biblioteca e as teclas e o card voltam', JSON.stringify({ antes: a9a.buscando, voltar, a9 }));
    await ctx.close();
  }

  // ======================= B · COMO TELA PRINCIPAL =======================
  {
    const { ctx, pg } = await abrir({ midia: false });
    const b0 = await ler(pg);
    checar(b0.aberta && b0.teclas && !b0.buscando,
      'B0 · PREMISSA: sem mídia a Biblioteca é a tela principal, aberta SEM foco, e as teclas estão à vista',
      JSON.stringify(b0));
    await pg.click('#hymnSearchInput');
    await pg.keyboard.type('louvor');
    await quadros(pg);
    const b1 = await ler(pg);
    checar(b1.buscando && !b1.teclas && Math.abs(b1.camada.bottom - b1.song.bottom) <= 2 && b1.song.bottom > b0.song.bottom + 100,
      'B1 · como tela principal o foco também tira as teclas, e a janela vai até a base', JSON.stringify(b1));
    // A ESCOLHA: o toque numa linha tira o foco do campo (o texto fica). Linha de mentira — o que se
    // mede é a regra, não o download; e a escolha é marcada como a caminho, como a de verdade.
    const b2 = await pg.evaluate(async () => {
      const li = document.createElement('li'); li.className = 'lib-item hymn-result'; li.dataset.song = 'x:1';
      li.innerHTML = '<div class="row hymn-row"><div class="hymn-info"><span class="row-name hymn-name">001 — Louvor</span></div></div>';
      document.getElementById('hymnResults').prepend(li);
      document.getElementById('hymnSearchInput').blur();
      simpleSelecionarLinha(li);
      simpleAcompanhar(new Promise(() => {}));
      // UM PULSO no meio do feedback (o `display-status` chama isto a ~4 Hz com TV): é ele que
      // devolveria as teclas sob o dedo se a escolha contasse já no toque.
      renderTransporteHabilitado();
      return document.getElementById('simpleMode').classList.contains('buscando');
    });
    checar(b2 === true,
      'B2 · a escolha NÃO devolve as teclas no toque — elas apareceriam sob o dedo, o "piscar" da v1.11.12', String(b2));
    const b3 = await esperar(pg, () => !document.getElementById('simpleMode').classList.contains('buscando'), null, 3000);
    const b3l = await ler(pg);
    checar(b3 === true && b3l.teclas && b3l.valor === 'louvor',
      'B3 · quando o feedback assenta as teclas voltam, mesmo com o termo ainda no campo (o download não as segura)',
      porque(b3) || JSON.stringify(b3l));
    await pg.click('#hymnSearchInput');
    const b4 = await ler(pg);
    checar(b4.buscando && !b4.teclas,
      'B4 · e o foco de volta ao campo durante o download é busca de novo: as teclas saem', JSON.stringify(b4));
    await ctx.close();
  }

  // ======================= C · COM TECLADO =======================
  // Folga de 24 px nas duas pontas: o recuo de baixo do `.simple` (12 px) e o respiro entre a barra e
  // a lista — nunca uma medida que dependa da largura de um texto.
  const FOLGA = 24;
  for (const [w, h] of [[360, 640], [360, 740], [320, 568]]) {
    for (const fonte of [1, 1.3]) {
      for (const mundo of ['honra', 'ignora']) {
        const { ctx, pg } = await abrir({ viewport: { width: w, height: h }, fonte, midia: true });
        await pg.click('#hymnSearchInput');
        await pg.keyboard.type('a');
        const kb = Math.round(h * 0.55);
        if (mundo === 'ignora') await pg.evaluate((px) => window.__teclado(px), kb);
        else await pg.setViewportSize({ width: w, height: h - kb });
        await quadros(pg);
        const m = await pg.evaluate((mundo) => {
          const vis = mundo === 'ignora' ? window.visualViewport.height : window.innerHeight;
          const r = document.getElementById('hymnResults').getBoundingClientRect();
          const c = document.getElementById('hymnSearchInput').getBoundingClientRect();
          return { vis: Math.round(vis), topo: Math.round(r.top), base: Math.round(r.bottom), campo: Math.round(c.bottom),
            fracao: +((Math.min(r.bottom, vis) - r.top) / vis).toFixed(2) };
        }, mundo);
        const nome = `${w}×${h}, fonte ${fonte}×, teclado ${kb}px, viewport que ${mundo === 'honra' ? 'encolhe' : 'não encolhe'}`;
        checar(m.topo >= m.campo - 1 && m.topo - m.campo <= FOLGA && m.base <= m.vis + 1 && m.vis - m.base <= FOLGA,
          `C · ${nome}: a lista vai do campo ao topo do teclado (${Math.round(m.fracao * 100)}% da área visível)`,
          JSON.stringify(m));
        // O ENTER tira o teclado: no mundo `ignora` a viewport visual volta inteira.
        if (mundo === 'ignora' && fonte === 1) {
          await pg.keyboard.press('Enter');
          await pg.evaluate(() => window.__teclado(0));
          await quadros(pg);
          const e = await pg.evaluate(() => {
            const r = document.getElementById('hymnResults').getBoundingClientRect();
            return { base: Math.round(r.bottom), innerHeight: window.innerHeight,
              kb: getComputedStyle(document.documentElement).getPropertyValue('--kb').trim(),
              teclas: getComputedStyle(document.querySelector('.simple-remote')).display };
          });
          checar(e.innerHeight - e.base <= FOLGA && e.teclas === 'none',
            `C · ${w}×${h}: depois do Enter, sem teclado, a lista vai até o fim da tela e as teclas seguem fora`,
            JSON.stringify(e));
        }
        await ctx.close();
      }
    }
  }

  // ======================= D · NO AVANÇADO =======================
  {
    const { ctx, pg } = await abrir({ avancado: true });
    await pg.evaluate(() => openHymnSearch(true));
    await esperar(pg, () => document.activeElement === document.getElementById('hymnSearchInput'), null, 5000);
    await pg.keyboard.type('zzzzqq');
    await pg.evaluate(() => window.__teclado(320));
    await quadros(pg);
    const d0 = await pg.evaluate(() => getComputedStyle(document.querySelector('.bottombar')).display);
    await pg.keyboard.press('Enter');
    await pg.evaluate(() => window.__teclado(0));
    await quadros(pg);
    const d = await pg.evaluate(() => ({
      foco: document.activeElement === document.getElementById('hymnSearchInput'),
      valor: document.getElementById('hymnSearchInput').value,
      aberta: document.getElementById('hymnSearchPopup').classList.contains('open'),
      barra: getComputedStyle(document.querySelector('.bottombar')).display,
      buscando: document.getElementById('simpleMode').classList.contains('buscando'),
    }));
    checar(d0 === 'none' && !d.foco && d.valor === 'zzzzqq' && d.aberta && d.barra !== 'none' && !d.buscando,
      'D · no avançado o Enter só tira o foco: o texto e a janela ficam, e a caixa de controles (que saiu com o '
      + 'teclado) volta', JSON.stringify({ comTeclado: d0, ...d }));
    await ctx.close();
  }

  // ======================= E · SEM MOVIMENTO =======================
  {
    const cena = async (reduced) => {
      const { ctx, pg } = await abrir({ midia: true, reduced });
      await pg.click('#hymnSearchInput');
      await quadros(pg);
      const r = await pg.evaluate(() => {
        document.getElementById('hymnSearchInput').blur();
        return {
          voltando: document.getElementById('simpleMode').classList.contains('teclas-voltando'),
          anim: getComputedStyle(document.querySelector('.simple-remote')).animationName,
        };
      });
      await ctx.close();
      return r;
    };
    const comMov = await cena(false);
    const semMov = await cena(true);
    checar(comMov.voltando && comMov.anim === 'simple-teclas-voltam',
      'E1 · PREMISSA: a volta das teclas tem o fade', JSON.stringify(comMov));
    checar(semMov.voltando && semMov.anim === 'none',
      'E2 · e com `prefers-reduced-motion` não tem', JSON.stringify(semMov));
  }

  // ======================= F · A TECLA DIZ "PESQUISAR" =======================
  {
    const { ctx, pg } = await abrir({ midia: false });
    const f = await pg.evaluate(() => {
      const c = document.getElementById('hymnSearchInput');
      return { hint: c.getAttribute('enterkeyhint'), modo: c.getAttribute('inputmode'), tipo: c.type,
        form: c.form && c.form.id };
    });
    checar(f.hint === 'search' && f.modo === 'search' && f.tipo === 'search' && f.form === 'hymnBuscaForm',
      'F · o campo declara `enterkeyhint="search"` (a tecla diz "Pesquisar"), o modo de busca e o formulário', JSON.stringify(f));
    await ctx.close();
  }

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}
falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
