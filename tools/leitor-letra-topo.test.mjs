#!/usr/bin/env node
// ============================================================================
// A LETRA ABERTA DA BIBLIOTECA COMEÇA NO TOPO (v1.11.10)
//
// Relato do operador, verbatim: *"Verificar o scroll de uma visualização de
// letra durante uma pesquisa na biblioteca, pois a sua posição está se mantendo
// entre buscas e leituras de diferentes músicas, não voltando para o topo do
// scroll e início da música."*
//
// A causa: o corpo do leitor (`#lyricsViewBody`) é UM nó reaproveitado. O render
// troca o conteúdo (`innerHTML = ''`), mas o navegador só LIMITA o `scrollTop` à
// altura nova — não o zera —, e uma música da Biblioteca não tem estrofe
// corrente: o `lvScroll` sai sem achar `.lv-row.current`. Resultado: a música
// seguinte abre no meio. Não erra alto; só abre no lugar errado.
//
// O que este arquivo trava:
//  1. outra música aberta da Biblioteca começa no TOPO, depois de a anterior ter
//     sido rolada (e a premissa: a anterior de fato rolou);
//  2. a MESMA música reaberta também (é uma leitura nova);
//  3. a música EM CENA continua indo para a estrofe do ar — é o comportamento
//     que a mudança NÃO pode quebrar (guarda de regressão: a reversão "zerar
//     toda abertura" também passa, porque o `lvScrollToCurrent` do rAF
//     reposiciona; a asserção existe para o dia em que ele deixar de fazê-lo).
//
//   node tools/leitor-letra-topo.test.mjs
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

try {
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);

  // Músicas de mentira com letra LONGA (60 estrofes): o corpo precisa rolar.
  await pg.evaluate(() => {
    const fazer = (id, nome) => ({
      id, name: nome, kind: 'audio', seconds: 300,
      lyrics: Array.from({ length: 60 }, (_, i) => ({ time: i * 5, text: nome + ' — estrofe ' + (i + 1) + ' com um texto razoavelmente longo para ocupar a linha' })),
    });
    window.__musicas = { a: fazer('musica-a', 'Música A'), b: fazer('musica-b', 'Música B') };
  });

  const abrir = (qual) => pg.evaluate(async (q) => {
    openLyricsPopup(window.__musicas[q]);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return lyricsViewBodyEl.scrollTop;
  }, qual);
  const rolar = (px) => pg.evaluate(async (y) => {
    lyricsViewBodyEl.scrollTop = y;
    await new Promise((r) => setTimeout(r, 50));
    return { top: lyricsViewBodyEl.scrollTop, rola: lyricsViewBodyEl.scrollHeight - lyricsViewBodyEl.clientHeight };
  }, px);
  const fechar = () => pg.evaluate(async () => {
    closeLyricsPopup();
    await new Promise((r) => setTimeout(r, 50));
  });

  // 1 · outra música da Biblioteca abre no topo
  const aoAbrirA = await abrir('a');
  const rolouA = await rolar(600);
  checar(rolouA.rola > 700 && rolouA.top >= 500,
    'PREMISSA: a letra A é longa e a rolagem de fato foi para o meio dela',
    JSON.stringify(rolouA));
  await fechar();
  const aoAbrirB = await abrir('b');
  checar(aoAbrirA === 0 && aoAbrirB === 0,
    '1 · abrir OUTRA música da Biblioteca, depois de rolar a anterior, começa no '
    + 'TOPO — o corpo é um nó reaproveitado e o navegador só limita o `scrollTop`',
    'A: ' + aoAbrirA + ', B: ' + aoAbrirB + ' (rolagem anterior ' + rolouA.top + ')');

  // 2 · a MESMA música reaberta também é uma leitura nova
  await rolar(600);
  await fechar();
  const reaberta = await abrir('b');
  checar(reaberta === 0,
    '2 · e a MESMA música reaberta começa no topo — fechar e abrir é uma leitura '
    + 'nova, e a folha não lembra onde a anterior parou', String(reaberta));

  // 3 · a música EM CENA continua indo para a estrofe do ar
  await fechar();
  const naCena = await pg.evaluate(async () => {
    currentItem = window.__musicas.a;
    currentId = 'musica-a';
    midiaNoAr = true;
    seekEl.disabled = false; seekEl.max = '300';
    // Estrofe do ar LONGE do topo: o `lvCurrentIndex` pergunta o relógio da cena.
    const orig = window.authoritativeTime;
    window.authoritativeTime = () => 200;
    openLyricsPopup();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 100));
    const linha = lyricsViewBodyEl.querySelector('.lv-row.current');
    const r = { top: lyricsViewBodyEl.scrollTop, temCorrente: !!linha };
    window.authoritativeTime = orig;
    closeLyricsPopup();
    midiaNoAr = false;
    return r;
  });
  checar(naCena.temCorrente === true && naCena.top > 300,
    '3 · (regressão) a música EM CENA continua indo para a estrofe do ar, longe do '
    + 'topo — o posicionamento é do `lvScrollToCurrent`, e a regra do alvo não o toca',
    JSON.stringify(naCena));

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
