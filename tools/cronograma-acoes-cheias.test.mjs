#!/usr/bin/env node
// ============================================================================
// SEM LUGAR AO LADO DA CAPA, A FAIXA DE OPÇÕES TOMA A LINHA INTEIRA (v1.12.53)
//
// Pedido do operador: *"Em telas menores permita as opções individuais do item no
// cronograma, sobreporem a thumbnail, mas de forma completa, aproveitando e
// distribuindo corretamente o espaço disponível. Atualmente em telas menores, ele
// sobrepõe apenas parte da thumbnail, ficando estranho"*.
//
// O que este arquivo trava, e cada uma falha CALADA:
//  A. LARGO (430×1): os botões cabem entre a capa e o `⋮` — a capa fica à vista,
//     intocada, e a faixa começa DEPOIS dela (nada muda em relação a antes);
//  B. ESTREITO (360×1 e 320×1,25): não cabem — a capa SAI DE VISTA, a faixa vai da
//     borda do cartão ao `⋮`, e os botões se DISTRIBUEM por ela (o primeiro onde a
//     capa começava, o último colado à borda direita da faixa). A 320×1,25 nem a
//     linha inteira comporta seis quadrados de 40px: eles descem ao piso de 34px
//     (`.acoes-justas`) e continuam todos dentro da faixa;
//  C. NUNCA PELA METADE: em toda célula, ou a faixa não toca a capa, ou a capa está
//     escondida — a meia capa debaixo de um botão é o defeito do relato;
//  D. a CONFIRMAÇÃO de excluir devolve a capa (é nela que mora a lixeira) e a faixa
//     ao piso de sempre.
// A decisão é MEDIDA pelo app (`acertarFaixaDaLinha`), e este oráculo mede o
// DESENHO que sai dela — nunca repete a conta.
//
//   node tools/cronograma-acoes-cheias.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, porque, checar, falhas, comModoAvancado } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port + '/controle/index.html';
const navegador = await abrirNavegador();
const erros = [];
try {
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  await semRedeExterna(ctx);
  await comModoAvancado(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base, { waitUntil: 'load' });
  await esperarCortina(pg);

  // TRÊS linhas: com uma só, os botões de ORDEM (↑↓) não existem e a fileira sai
  // com dois a menos que a de um culto de verdade. A do MEIO é a medida.
  const ids = await pg.evaluate(async () => {
    setAppMode('full');
    activeTab = 'imports';
    const out = [];
    for (let i = 0; i < 3; i++) {
      const m = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
        { name: 'Louvor da faixa ' + i, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      out.push(m.id);
    }
    await load();
    return out;
  });

  // ABRE A FAIXA da linha do meio pelo `⋮` (o toque do operador) e mede quando os
  // botões assentaram — eles ENTRAM deslizando (`transform`), e medir no meio da
  // entrada leria a posição de partida.
  const medir = async (largura, escala) => {
    await pg.setViewportSize({ width: largura, height: 900 });
    await pg.evaluate((e) => {
      fecharAcoesDaLinha();
      document.documentElement.style.fontSize = (16 * e) + 'px';
    }, escala);
    await pg.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await pg.evaluate((id) => {
      document.querySelector('#library .lib-item[data-id="' + id + '"] .row-mais').click();
    }, ids[1]);
    const ok = await esperar(pg, (id) => {
      const li = document.querySelector('#library .lib-item[data-id="' + id + '"]');
      const cx = li && li.querySelector('.row-acoes');
      return !!cx && li.classList.contains('acoes-abertas') && cx.getBoundingClientRect().width > 0
        && cx.getAnimations({ subtree: true }).every((a) => a.playState !== 'running');
    }, ids[1], 8000);
    return pg.evaluate((a) => {
      const li = document.querySelector('#library .lib-item[data-id="' + a.id + '"]');
      const caixa = li.querySelector('.row-acoes');
      const capa = li.querySelector(':scope > .row > .thumb');
      const card = li.getBoundingClientRect();
      const cb = caixa.getBoundingClientRect();
      const tb = capa.getBoundingClientRect();
      const botoes = [...caixa.children].filter((el) => el.offsetWidth > 0).map((el) => el.getBoundingClientRect());
      const r1 = (n) => Math.round(n * 10) / 10;
      return {
        prazo: a.ok,
        cheia: li.classList.contains('acoes-cheias'),
        capaVisivel: getComputedStyle(capa).visibility === 'visible',
        n: botoes.length,
        // A FAIXA × A CAPA: quanto da capa a faixa cobre (0 = nada).
        sobreposicao: r1(Math.max(0, Math.min(cb.right, tb.right) - Math.max(cb.left, tb.left))),
        capa: { esq: r1(tb.left), dir: r1(tb.right) },
        faixa: { esq: r1(cb.left), dir: r1(cb.right) },
        cartao: { esq: r1(card.left) },
        primeiro: botoes.length ? r1(botoes[0].left) : null,
        ultimo: botoes.length ? r1(botoes[botoes.length - 1].right) : null,
        menor: botoes.length ? r1(Math.min(...botoes.map((b) => Math.min(b.width, b.height)))) : 0,
        // NINGUÉM SAI DA FAIXA.
        foraDaFaixa: botoes.filter((b) => b.left < cb.left - 0.5 || b.right > cb.right + 0.5).length,
      };
    }, { id: ids[1], ok });
  };

  // A · LARGO: tudo como antes.
  const largo = await medir(430, 1);
  checar(largo.prazo === true && largo.n >= 6,
    'A · PREMISSA: a faixa da linha do meio abriu, com a fileira de um culto de verdade (6+ botões)',
    JSON.stringify(largo));
  checar(!largo.cheia && largo.capaVisivel && largo.sobreposicao === 0 && largo.faixa.esq >= largo.capa.dir,
    'A · a 430 os botões cabem ao lado da capa: ela continua à vista e a faixa começa DEPOIS dela',
    JSON.stringify(largo));

  // B · ESTREITO: a faixa toma a linha.
  for (const [w, e] of [[360, 1], [320, 1.25]]) {
    const r = await medir(w, e);
    checar(r.prazo === true && r.cheia && !r.capaVisivel,
      'B · a ' + w + '×' + e + ' os botões não cabem ao lado da capa: a CAPA SAI DE VISTA',
      JSON.stringify(r));
    checar(r.faixa.esq <= r.capa.esq + 0.5 && r.foraDaFaixa === 0,
      'B · e a faixa vai da borda do cartão (onde a capa começava) até o `⋮`, com todos os botões dentro dela',
      JSON.stringify(r));
    checar(Math.abs(r.primeiro - r.faixa.esq) <= 1 && Math.abs(r.ultimo - r.faixa.dir) <= 1,
      'B · e os botões se DISTRIBUEM pela largura toda: o primeiro na ponta esquerda, o último na direita',
      JSON.stringify(r));
    checar(r.menor >= 33.5,
      'B · e nenhum quadrado fica abaixo do PISO de toque (34px) — com seis botões, nem a 320×1,25',
      JSON.stringify(r));
    // C · nunca pela metade
    checar(r.sobreposicao === 0 || !r.capaVisivel,
      'C · a ' + w + '×' + e + ' a capa nunca fica PELA METADE debaixo de um botão', JSON.stringify(r));
  }
  checar(largo.sobreposicao === 0 || !largo.capaVisivel,
    'C · e a 430 também não', JSON.stringify(largo));

  // D · a confirmação devolve a capa (a lixeira mora nela).
  const conf = await pg.evaluate(async (id) => {
    const li = document.querySelector('#library .lib-item[data-id="' + id + '"]');
    li.querySelector('.row-acoes .row-excluir').click();
    await new Promise((r) => setTimeout(r, 120));
    const capa = li.querySelector(':scope > .row > .thumb');
    const caixa = li.querySelector('.row-acoes');
    const cb = caixa.getBoundingClientRect();
    const tb = capa.getBoundingClientRect();
    const r = {
      confirmando: caixa.classList.contains('confirmando'),
      capaVisivel: getComputedStyle(capa).visibility === 'visible',
      sobreposicao: Math.max(0, Math.min(cb.right, tb.right) - Math.max(cb.left, tb.left)),
    };
    fecharAcoesDaLinha();
    return r;
  }, ids[1]);
  checar(conf.confirmando && conf.capaVisivel && conf.sobreposicao === 0,
    'D · na CONFIRMAÇÃO de excluir a capa volta (é nela que a lixeira aparece) e a faixa não a cobre',
    JSON.stringify(conf));

  await pg.evaluate(() => { document.documentElement.style.fontSize = ''; });
  checar(erros.length === 0, 'nenhum erro de página', erros.slice(0, 3));
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
