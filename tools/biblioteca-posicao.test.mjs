#!/usr/bin/env node
// ============================================================================
// A POSIÇÃO NA BIBLIOTECA: a margem ao abrir e a barra depois da tela cheia (v1.13.34)
//
// Dois relatos do operador, os dois de POSIÇÃO no acervo:
//
//  A. *"a coleção aberta fica colada na borda"* — o alinhamento ao abrir uma
//     seção (`alinharGrupoNoTopo`) levava o TOPO do bloco à borda da lista. Hoje
//     para com a BASE do bloco de cima na borda: o desconto é o VÃO real entre os
//     dois, lido do layout, e nunca menor que a sombra de rolagem (`--veu-h`) —
//     um vão mais baixo que ela some embaixo dela. Medido em duas telas.
//  B. *"a barra de busca volta no lugar errado depois da tela cheia e depois se
//     corrige com um salto"* — nos quadros entre a saída da tela cheia e a
//     rotação de volta, a janela ainda é a deitada, e a barra era desenhada ali.
//     Hoje ela sai de cena (`lib-assentando`) até a rotação, e volta no lugar.
//     A ORDEM é a do aparelho: a saída com a janela deitada, a rotação depois. A
//     tela cheia é EMULADA (`document.fullscreenElement` de mentira): o Playwright
//     recusa redimensionar uma janela em tela cheia de verdade.
//
//   node tools/biblioteca-posicao.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperarCortina, esperar, checar, falhas, RAIZ_WEB, comModoAvancado,
} from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();

// O ACERVO DE TESTE: seis coletâneas (seis SEÇÕES na raiz), cada uma com álbuns
// bastantes para a lista rolar com a seção aberta.
async function montarBiblioteca(pg) {
  await pg.evaluate(() => {
    setAppMode('full');
    const nomes = ['Coletânea A', 'Coletânea B', 'Coletânea C', 'Coletânea D', 'Coletânea E', 'Coletânea F'];
    albumCatalog.categories = nomes.map((n, i) => ({
      name: n, albums: Array.from({ length: 8 }, (_, k) => ({ id_album: 900 + i * 10 + k, name: 'Álbum ' + n + ' ' + k })),
    }));
    albumCatalog.albums = albumCatalog.categories.flatMap((c) => c.albums);
    for (const a of albumCatalog.albums) {
      collState['album-' + a.id_album] = { indexSyncedAt: Date.now(),
        songs: [{ id_music: 'x' + a.id_album, track: 1, name: 'Faixa', duration: '3:00' }] };
    }
    const orig = window.alinharGrupoNoTopo;
    window.__alinhou = 0;
    window.alinharGrupoNoTopo = function (...a) { orig.apply(this, a); window.__alinhou++; };
    openHymnSearch(false);
  });
  await esperar(pg, () => {
    const el = document.getElementById('hymnResults');
    const s = document.querySelector('.popup-sheet--lib');
    return !!el && !!s && !s.getAnimations().some((a) => a.playState === 'running')
      && el.querySelectorAll(':scope > .coll-group--drop:not(.coll-group--fav)').length >= 6;
  }, null, 15000);
}

try {
  // ── A. A MARGEM ACIMA DA SEÇÃO ABERTA ────────────────────────────────────
  for (const tela of [{ width: 360, height: 740 }, { width: 430, height: 900 }]) {
    // `reducedMotion`: a rolagem do alinhamento sai `auto` (`semMovimento`), e o
    // que se mede é ONDE ela para, não a curva até lá.
    const ctx = await navegador.newContext({ viewport: tela, hasTouch: true, reducedMotion: 'reduce' });
    await semRedeExterna(ctx);
    await comModoAvancado(ctx);
    const pg = await ctx.newPage();
    await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
    await esperarCortina(pg);
    await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 30000 });
    await montarBiblioteca(pg);
    const nome = tela.width + '×' + tela.height;
    // A QUARTA seção: tem vizinho em cima, e o conteúdo abaixo dela basta para rolar.
    await pg.evaluate(() => {
      const el = document.getElementById('hymnResults');
      const secs = [...el.querySelectorAll(':scope > .coll-group--drop:not(.coll-group--fav)')];
      window.__alvo = secs[3];
      window.__alinhou = 0;
      secs[3].querySelector('.coll-group-bar').click();
    });
    // O FATO: o alinhamento RODOU e a rolagem PAROU (dois quadros sem mexer).
    await esperar(pg, () => window.__alinhou > 0, null, 8000);
    await pg.waitForFunction(() => new Promise((ok) => {
      const el = document.getElementById('hymnResults');
      const a = el.scrollTop;
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => ok(el.scrollTop === a))));
    }), null, { timeout: 8000, polling: 100 });
    const m = await pg.evaluate(() => {
      const el = document.getElementById('hymnResults');
      const s = [...el.children].find((n) => n.dataset && n.dataset.grupo === window.__alvo.dataset.grupo);
      const ant = s.previousElementSibling;
      const topo = el.getBoundingClientRect().top + parseFloat(getComputedStyle(el).paddingTop || 0);
      const veu = parseFloat(getComputedStyle(el).getPropertyValue('--veu-h')) || 0;
      return {
        rola: el.classList.contains('rola'),
        veu,
        vao: +(s.getBoundingClientRect().top - ant.getBoundingClientRect().bottom).toFixed(2),
        acimaDaBorda: +(s.getBoundingClientRect().top - topo).toFixed(2),
        baseDeCima: +(ant.getBoundingClientRect().bottom - topo).toFixed(2),
        noFim: el.scrollTop >= el.scrollHeight - el.clientHeight - 1,
        scrollTop: el.scrollTop,
      };
    });
    checar(m.rola && m.veu > 0 && !m.noFim && m.scrollTop > 0,
      'A · ' + nome + ' · PREMISSA: a lista é `.rola`, tem sombra, e a seção aberta ROLOU sem bater no fim', m);
    const esperado = Math.max(m.vao, m.veu);
    checar(Math.abs(m.acimaDaBorda - esperado) <= 1.5,
      'A · ' + nome + ' · a seção aberta para ' + esperado + 'px abaixo da borda (o maior entre o vão real, '
      + m.vao + 'px, e a sombra de rolagem, ' + m.veu + 'px) — e não colada nela', m);
    checar(m.baseDeCima <= 0.5 + Math.max(0, m.veu - m.vao),
      'A · ' + nome + ' · e o bloco de CIMA fica com a base na borda (ou sob a sombra, nunca à vista)', m);
    await ctx.close();
  }

  // ── B. A BARRA NÃO APARECE ENTRE A SAÍDA DA TELA CHEIA E A ROTAÇÃO ───────
  {
    const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
    await semRedeExterna(ctx);
    await comModoAvancado(ctx);
    // A TELA CHEIA DE MENTIRA, e o ResizeObserver no-op (o shell esconde o
    // Controle durante a tela cheia: ele não vê a volta — a premissa do aparelho).
    await ctx.addInitScript(() => {
      window.__fs = null;
      Object.defineProperty(Document.prototype, 'fullscreenElement', { get() { return window.__fs; }, configurable: true });
      window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    });
    const pg = await ctx.newPage();
    await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
    await esperarCortina(pg);
    await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 30000 });
    await pg.evaluate(() => { setAppMode('full'); window.dispatchEvent(new Event('resize')); });
    await pg.waitForFunction(() => document.body.classList.contains('lib-pronta'), null, { timeout: 5000 });
    // ENTRA na tela cheia (emulada) e GIRA para a paisagem.
    await pg.evaluate(() => { window.__fs = document.getElementById('preview'); document.dispatchEvent(new Event('fullscreenchange')); });
    await pg.setViewportSize({ width: 900, height: 430 });
    await pg.waitForTimeout(300);
    await pg.evaluate(() => {
      window.__quadros = [];
      const folha = document.querySelector('.popup-sheet--lib');
      const barra = document.getElementById('libBar');
      const laco = () => {
        window.__quadros.push({
          larg: innerWidth, alt: innerHeight, fs: !!document.fullscreenElement,
          visivel: getComputedStyle(folha).visibility !== 'hidden',
          barraTopo: +barra.getBoundingClientRect().top.toFixed(1),
        });
        requestAnimationFrame(laco);
      };
      requestAnimationFrame(laco);
    });
    // A SAÍDA PRIMEIRO (janela ainda deitada), a rotação 150 ms depois.
    await pg.evaluate(() => { window.__fs = null; document.dispatchEvent(new Event('fullscreenchange')); });
    await pg.waitForTimeout(150);
    await pg.setViewportSize({ width: 430, height: 900 });
    await pg.waitForTimeout(800);
    const q = await pg.evaluate(() => window.__quadros);
    const deitados = q.filter((x) => x.larg > x.alt && !x.fs);
    const emPe = q.filter((x) => x.larg < x.alt && !x.fs);
    checar(deitados.length >= 3 && emPe.length >= 10,
      'B · PREMISSA: o arnês viu quadros fora da tela cheia nas duas orientações ('
      + deitados.length + ' deitados, ' + emPe.length + ' em pé)', { deitados: deitados.length, emPe: emPe.length });
    checar(deitados.length > 0 && deitados.every((x) => !x.visivel),
      'B · com a janela ainda DEITADA depois da saída, a barra da Biblioteca NÃO aparece — ali a posição '
      + 'dela descreve outra tela, e era de lá que ela saltava', deitados.slice(0, 3));
    const final = emPe.length ? emPe[emPe.length - 1].barraTopo : null;
    checar(emPe.length > 0 && emPe.every((x) => x.visivel) && emPe.every((x) => Math.abs(x.barraTopo - final) <= 1),
      'B · e do PRIMEIRO quadro em retrato ela está à vista e já no lugar final (' + final + 'px), sem salto',
      emPe.slice(0, 4));
    // A REDE DE SEGURANÇA: o aparelho que de fato FICA deitado volta a ver a barra.
    await pg.evaluate(() => { window.__fs = document.getElementById('preview'); document.dispatchEvent(new Event('fullscreenchange')); });
    await pg.setViewportSize({ width: 900, height: 430 });
    await pg.waitForTimeout(200);
    await pg.evaluate(() => { window.__fs = null; document.dispatchEvent(new Event('fullscreenchange')); });
    await pg.waitForTimeout(1900);
    const ficou = await pg.evaluate(() => ({
      classe: document.body.classList.contains('lib-assentando'),
      visivel: getComputedStyle(document.querySelector('.popup-sheet--lib')).visibility !== 'hidden',
    }));
    checar(!ficou.classe && ficou.visivel,
      'B · e quem FICA deitado volta a ver a barra pela rede de segurança (1,5 s) — ela não some para sempre', ficou);
    await ctx.close();
  }
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
