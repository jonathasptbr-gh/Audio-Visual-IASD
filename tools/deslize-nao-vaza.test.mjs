#!/usr/bin/env node
// ============================================================================
// O DESLIZE DA BÍBLIA NÃO VAZA DA FOLHA.
//
// ## Por que ele existe
//
// Relato do operador: *"um bugs visual de animação, os itens dentro das seções
// da bíblia estão aparecendo horizontalmente em sua animação de entrada e
// saída, saindo da caixa a qual pertecem."*
//
// A navegação DENTRO da Bíblia desliza (`deslizarNaFolha`): um
// `translateX(±100%)` no `#bibleBody`, 220ms. A `.tools-sheet` é um CARTÃO —
// fundo, raio e sombra — e não recortava nada, então durante o movimento a
// grade de livros, os ladrilhos e o cabeçalho pintavam FORA dela, por cima do
// Cronograma em volta. MEDIDO a 393×786 antes da correção: **47,7px** de
// vazamento e 25 nós fora da caixa numa das transições.
//
// **O `<main>` já recortava, e só na LARGURA DA TELA** — era o que segurava o
// deslize da faixa de abas de antes da v1.5.0, uma camada acima. Entre a borda
// da folha e a da tela sobra justamente a moldura em que o vazamento aparecia.
//
// ## Por que ele NÃO é uma asserção do `geometria.test.mjs`
//
// Duas razões, e as duas são de método:
//
//  · **Aquele oráculo ASSENTA as animações antes de medir** (`getAnimations()`
//    + `finished`), e tem de assentar: uma folha medida no meio do movimento
//    devolve uma caixa que não existe. Um defeito que só existe DURANTE o
//    movimento nasce, por construção, fora do alcance dele.
//  · **Geometria não responde a esta pergunta.** `overflow: hidden` recorta a
//    PINTURA, não o layout: com a correção aplicada o
//    `getBoundingClientRect` de cada ladrilho continua devolvendo a caixa
//    inteira, 47,6px fora da folha. Medido por geometria, o antes e o depois
//    são IDÊNTICOS — foi assim que a primeira tentativa deste arquivo
//    "reprovou" a correção que estava certa.
//
// Daí a régua ser o PIXEL: quantas cores distintas aparecem na moldura entre a
// borda da folha e a do `<main>`. Em repouso ela é o fundo do app; se um
// ladrilho da Bíblia pintar ali, o número salta. MEDIDO: **9 cores** em
// repouso e com a correção, **59** sem ela.
//
// ## As duas metades
//
//  · **A · a moldura não muda durante o deslize**, nos DOIS sentidos e nos
//    DOIS lados — a ida entra pela direita e a volta pela esquerda, e uma
//    amostra de um lado só aprova metade do defeito. **O que a reversão MEDE
//    hoje é a volta** (moldura esquerda: 9 → 59): na ida, com o conteúdo da
//    tela de capítulos, nada chega a pintar nos 11px daquela faixa no instante
//    amostrado. A asserção cobre os dois porque o defeito é dos dois; a prova
//    viva é a volta, e está dito para ninguém confundir "não dispara" com
//    "não existe".
//  · **B · a folha continua MOSTRANDO o que é dela.** Um `overflow: hidden`
//    que recortasse demais passaria em A e deixaria a grade cortada — é a
//    reversão que impede o conserto largo demais, e quem a cobre em regime
//    permanente é o `geometria.test.mjs` (T3).
//
//   node tools/deslize-nao-vaza.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperar, esperarCortina, checar, falhas, porque, RAIZ_WEB }
  from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 393, height: 786 } });
await semRedeExterna(ctx);
await ctx.addInitScript(() => {
  try { localStorage.setItem('av.appMode', 'full'); } catch (_) { /* storage bloqueado */ }
});
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', (e) => erros.push(e.message));
await pg.goto(base + '/controle/', { waitUntil: 'load' });
await esperarCortina(pg);
const subiu = await esperar(pg, () => window.AVDB && typeof window.__avBack === 'function', null, 30000);
checar(subiu === true, 'o app sobe', porque(subiu));

await pg.evaluate(async () => {
  setAppMode('full');
  const b = Bible.BOOKS.findIndex((x) => /Naum/i.test(x.name));
  const vs = [];
  for (let i = 1; i <= 19; i++) vs.push({ n: i, text: 'Versículo ' + i + ' de teste.' });
  await AVDB.setState('bible:' + bibleVersionId + '_' + bibleBookId(b) + '_3',
    { verses: vs, syncedAt: Date.now() });
  window.__b = b;
  abrirBiblia();
});
const abriu = await esperar(pg, () => {
  const s = document.getElementById('bibleSheet');
  return s && !s.hidden && !!document.querySelector('.bible-grid--books .bible-cell')
    && ![...document.querySelectorAll('*')].some((n) => n.getAnimations()
      .some((a) => a.playState === 'running'));
}, null, 15000);
checar(abriu === true, 'a Bíblia abre nos livros e assenta', porque(abriu));

// AS DUAS MOLDURAS: a folha é um cartão com vão dos dois lados dentro do
// `<main>`, e cada sentido do deslize pinta no seu.
const molduras = await pg.evaluate(() => {
  const f = document.getElementById('bibleSheet').getBoundingClientRect();
  const m = document.querySelector('main').getBoundingClientRect();
  // As chaves são as do `clip` do Playwright (`width`/`height`), de propósito:
  // um `w`/`h` aqui vira `undefined` lá e a captura lança.
  const alto = { y: Math.round(f.top + 60), height: 120 };
  return {
    esq: { x: Math.round(m.left) + 1, width: Math.max(2, Math.round(f.left - m.left) - 2), ...alto },
    dir: { x: Math.round(f.right) + 1, width: Math.max(2, Math.round(m.right - f.right) - 2), ...alto },
    vao: +(f.left - m.left).toFixed(1),
  };
});
checar(molduras.vao > 4 && molduras.esq.width >= 2 && molduras.dir.width >= 2,
  'existe moldura mensurável dos dois lados da folha (o vão do cartão dentro do `main`)',
  JSON.stringify(molduras));

/** Quantas cores distintas há na moldura — a régua que a geometria não dá. */
async function cores(caixa) {
  const b64 = (await pg.screenshot({ clip: caixa })).toString('base64');
  return pg.evaluate(async (d) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + d;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    const s = new Set();
    for (let i = 0; i < px.length; i += 4) s.add(px[i] + ',' + px[i + 1] + ',' + px[i + 2]);
    return s.size;
  }, b64);
}

const repouso = { esq: await cores(molduras.esq), dir: await cores(molduras.dir) };

// ==========================================================================
// A · A MOLDURA NÃO MUDA DURANTE O DESLIZE, NOS DOIS SENTIDOS
// ==========================================================================
//
// A espera é de RELÓGIO e não tem como não ser: o que se quer medir é o meio de
// uma animação, e esperar pelo fim seria esperar justamente pelo que apaga o
// defeito. 45ms de 220ms é o começo do movimento, onde o desvio é maior; o
// número não é um veredito de tempo — se a amostra cair fora do movimento, o
// resultado é IGUAL ao repouso, isto é, o oráculo passa. Ele só pode errar para
// o lado seguro.
const MEIO_DO_DESLIZE = 45;

async function medirDurante(nome, acao) {
  await pg.evaluate(acao);
  await pg.waitForTimeout(MEIO_DO_DESLIZE);
  const c = { esq: await cores(molduras.esq), dir: await cores(molduras.dir) };
  await pg.waitForTimeout(600);
  return { nome, ...c };
}

const ida = await medirDurante('livros → capítulos',
  () => { bibleSel = { bookIdx: window.__b, chapter: 0 }; gotoBibleScreen('chapters'); });
const volta = await medirDurante('capítulos → livros', () => gotoBibleScreen('books'));

for (const m of [ida, volta]) {
  checar(m.esq === repouso.esq && m.dir === repouso.dir,
    'nada da Bíblia pinta fora da folha durante o deslize ' + m.nome,
    'moldura esquerda ' + m.esq + ' (repouso ' + repouso.esq + ') · '
    + 'direita ' + m.dir + ' (repouso ' + repouso.dir + ')');
}

// ==========================================================================
// B · E A FOLHA CONTINUA MOSTRANDO O QUE É DELA
// ==========================================================================
//
// Sem esta, recortar demais — ou esconder a grade — passaria em A. O
// `geometria.test.mjs` cobre o corte em regime permanente (T3); aqui basta a
// testemunha de que a grade está DESENHADA e dentro da folha depois do deslize.
const dentro = await pg.evaluate(() => {
  const f = document.getElementById('bibleSheet').getBoundingClientRect();
  const cs = [...document.querySelectorAll('.bible-grid--books .bible-cell')];
  const vis = cs.filter((c) => {
    const r = c.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && r.left >= f.left - 1 && r.right <= f.right + 1;
  });
  return { total: cs.length, dentro: vis.length };
});
checar(dentro.total > 60 && dentro.dentro === dentro.total,
  'depois do deslize os 66 livros estão desenhados e DENTRO da folha — o recorte '
  + 'não comeu o conteúdo',
  JSON.stringify(dentro));

checar(erros.length === 0, 'nenhum erro de página', erros.slice(0, 3).join(' · '));

await navegador.close();
servidor.close();

if (falhas.length) { console.error('\n' + falhas.length + ' REPROVADA(S)'); process.exit(1); }
console.log('\ntudo certo');
