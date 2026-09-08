#!/usr/bin/env node
// ============================================================================
// A PÁGINA: A GRADE MEDE O CONTEÚDO, E O CARROSSEL ANDA POR ETAPAS
//
// ## Por que ele existe
//
// Até a v1.8.51, NENHUM oráculo afirmava nada sobre `site/index.html` além da
// classificação de plataforma: o `plataforma.test.mjs` mede o filtro Android e
// os dois `<h2>`, e o `registro-alcance.test.mjs` mede `site/registro/`. Um
// `<small>` de 158 caracteres podia voltar amanhã com o CI verde — e foi
// exatamente um `<small>` de 158 que governava a altura da grade inteira.
//
// ## Os três relatos que ele trava
//
//  1. *"O design dos modulos de funções está com seu desgin confuso. Alguns tem
//     muito texto e precisam de mais espaço e outros estão sobrando em seus
//     cards. Precisamos resumir muita coisa."*
//  2. *"sobre as conexões, toda menção de conectar a rede referente ao método do
//     servidor, use apenas termos diretos relacionados a 'conectar a um
//     computador via navegador'… Não quero algo genérico como rede ou aparelho,
//     ou navegador."*
//  3. *"faça com que ele role por etapas, com indicador de pontos aceso, não um
//     Scroll que para em qualquer lugar."*
//
// ## O que ele mede, e por que cada metade existe
//
//  A. **O TETO DOS CARTÕES** (80 caracteres). É a régua de escrita do lote, e
//     sem asserção ela dura até o próximo parágrafo que "só precisa de mais uma
//     frase".
//  B. **A GRADE MEDE CADA FAIXA.** `grid-auto-rows:1fr` dava a TODA faixa a
//     altura da mais alta — 568px de vão morto, medidos. A prova é
//     GEOMÉTRICA e não a ausência da declaração: duas faixas com conteúdos
//     diferentes têm de medir diferente.
//  C. **O TERMO É "COMPUTADOR".** O genérico que o operador recusa não pode
//     voltar ao texto visível.
//  D. **OS PONTOS.** Existem, contam as posições ALCANÇÁVEIS (não os 14 prints
//     — no computador há 12 ou 13 vistas distintas), e o ÚLTIMO leva ao fim
//     EXATO da faixa. Esta última guarda o `Math.min(x, max)` do `montar()`:
//     MEDIDO, as posições de encaixe dos últimos itens caem ALÉM do máximo de
//     rolagem (3179 contra 3070 a 390px), e um ponto apontando para lá mandaria
//     a faixa a um lugar que ela não alcança — nunca acenderia. (O que NÃO é a
//     correção, e chegou a ser escrito como se fosse: `scroll-snap-align:end` no
//     último item. MEDIDO nas duas variantes, a faixa pousa em 3040 de 3040 do
//     mesmo jeito — o navegador já deixa repousar no fim. A reversão daquela
//     linha não reprovava esta asserção, e foi assim que ela foi pega.)
//  E. **A FALHA É ABERTA.** Sem JavaScript não há ponto nenhum — e a faixa
//     continua rolável. Um indicador que não rola é pior que indicador nenhum.
//
//   node tools/site-grade-e-carrossel.test.mjs
// ============================================================================
import { servirEstatico, abrirNavegador, esperar, porque, checar, falhas, RAIZ_SITE } from './arnes.mjs';

const TETO = 80;
const servidor = servirEstatico(RAIZ_SITE);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port + '/index.html';
const navegador = await abrirNavegador();

try {
  // ── A. O TETO DOS CARTÕES ───────────────────────────────────────────────
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  await pg.goto(base, { waitUntil: 'load' });

  const cartoes = await pg.evaluate(() => [...document.querySelectorAll('.grade .item')].map((it) => {
    const s = it.querySelector('small');
    return { rotulo: (it.childNodes[2] || {}).textContent?.trim() || '', chars: s ? s.textContent.length : 0 };
  }));
  const acima = cartoes.filter((c) => c.chars > TETO);
  checar(cartoes.length >= 14 && acima.length === 0,
    'A · todo cartão da grade cabe no teto de ' + TETO + ' caracteres — o limite é a '
    + 'régua de escrita do lote, e sem asserção ela dura até a próxima frase que '
    + '"só precisa ser dita"', JSON.stringify(acima));

  // ── B. A GRADE MEDE CADA FAIXA ──────────────────────────────────────────
  // A prova é GEOMÉTRICA: com `grid-auto-rows:1fr` toda faixa tem a altura da
  // mais alta da grade, então DUAS faixas com conteúdos diferentes medem igual.
  // Perguntar pela declaração aprovaria um `1fr` escrito de outro jeito.
  const faixas = await pg.evaluate(() => {
    const itens = [...document.querySelectorAll('.grade .item')];
    const porTopo = new Map();
    for (const it of itens) {
      const r = it.getBoundingClientRect();
      const k = Math.round(r.top);
      if (!porTopo.has(k)) porTopo.set(k, Math.round(r.height));
    }
    return [...porTopo.values()];
  });
  const distintas = new Set(faixas).size;
  checar(distintas > 1,
    'B · as faixas da grade medem o CONTEÚDO de cada uma, e não a altura da mais '
    + 'alta da página — com `grid-auto-rows:1fr` todas mediriam igual, e o '
    + 'cartão de uma linha ficava com o vão de um de sete',
    JSON.stringify({ alturas: faixas, distintas }));

  // ── C. O TERMO É "COMPUTADOR" ───────────────────────────────────────────
  const texto = await pg.evaluate(() => ({
    corpo: document.body.innerText,
    desc: (document.querySelector('meta[name=description]') || {}).content || '',
    og: (document.querySelector('meta[property="og:description"]') || {}).content || '',
  }));
  const genericos = /telas da rede|outra tela|outras telas/i;
  checar(!genericos.test(texto.corpo),
    'C · o texto visível não chama o recurso de "telas da rede" nem de "outra '
    + 'tela": o operador recusou os genéricos por extenso, e o destino tem nome',
    (texto.corpo.match(genericos) || [''])[0]);
  checar(/computador/i.test(texto.corpo) && /Conectar um computador/.test(texto.corpo),
    'C · e ele se chama "Conectar um computador" — o computador é o SUJEITO que '
    + 'recebe a projeção, e o navegador é o meio', /computador/i.test(texto.corpo));
  checar(/computador/i.test(texto.desc) && /computador/i.test(texto.og),
    'C · as duas descrições dizem o mesmo: a `description` é o que a busca '
    + 'mostra, a `og:description` é o que a prévia de link mostra — e é por link '
    + 'que este app circula', JSON.stringify(texto));

  // ── D. OS PONTOS ────────────────────────────────────────────────────────
  for (const largura of [390, 1280]) {
    const c = await navegador.newContext({ viewport: { width: largura, height: 900 } });
    const p = await c.newPage();
    await p.goto(base, { waitUntil: 'load' });
    const veio = await esperar(p, () => !!document.querySelector('.pontos button'), null, 8000);
    checar(veio === true, 'D · ' + largura + 'px: a linha de pontos é desenhada', porque(veio));

    const antes = await p.evaluate(() => {
      const t = document.querySelector('.telas');
      const bs = [...document.querySelectorAll('.pontos button')];
      return {
        pontos: bs.length, figuras: t.children.length,
        max: Math.round(t.scrollWidth - t.clientWidth),
        aceso: bs.findIndex((b) => b.getAttribute('aria-current') === 'true'),
        alvo: Math.round(bs[0].getBoundingClientRect().height),
        // O RÓTULO SAI DO ALVO, não do índice: são coisas diferentes (13 pontos
        // para 14 prints a 1280px), e derivá-lo do índice faria o último mentir.
        ultimoRotulo: bs[bs.length - 1].getAttribute('aria-label'),
        ultimaLegenda: t.children[t.children.length - 1].querySelector('figcaption b').textContent,
      };
    });
    checar(antes.pontos > 1 && antes.pontos <= antes.figuras && antes.aceso === 0,
      'D · ' + largura + 'px: há um ponto por POSIÇÃO DE ETAPA (nunca mais que '
      + 'prints), e o primeiro nasce aceso — fixar 14 poria dois pontos no mesmo '
      + 'lugar, e um ponto que nunca acende é o indicador mentindo',
      JSON.stringify(antes));
    checar(antes.alvo >= 24,
      'D · ' + largura + 'px: e o alvo de toque tem pelo menos 24px de altura — '
      + 'o desenho tem 8px, o dedo não', antes.alvo);
    checar(antes.ultimoRotulo === antes.ultimaLegenda,
      'D · ' + largura + 'px: o rótulo do ÚLTIMO ponto é o do ÚLTIMO print, e '
      + 'não o do print de índice igual ao dele', JSON.stringify(antes));

    const fim = await p.evaluate(async () => {
      const t = document.querySelector('.telas');
      const bs = [...document.querySelectorAll('.pontos button')];
      bs[bs.length - 1].click();
      await new Promise((f) => setTimeout(f, 1400));
      const max = Math.round(t.scrollWidth - t.clientWidth);
      return {
        pos: Math.round(t.scrollLeft), max,
        aceso: bs.findIndex((b) => b.getAttribute('aria-current') === 'true'),
        n: bs.length,
      };
    });
    checar(Math.abs(fim.pos - fim.max) <= 2 && fim.aceso === fim.n - 1,
      'D · ' + largura + 'px: o ÚLTIMO ponto leva ao fim EXATO da faixa, e '
      + 'continua aceso lá — é o `Math.min(x, max)` do `montar()` que esta '
      + 'asserção guarda: sem ele o último ponto aponta para uma posição de '
      + 'encaixe que cai FORA do alcance da faixa, e nunca acende',
      JSON.stringify(fim));
    await c.close();
  }

  // ── E. A FALHA É ABERTA ─────────────────────────────────────────────────
  // Sem JavaScript não há ponto nenhum — e a faixa CONTINUA rolável. Um
  // indicador que não rola é pior que indicador nenhum, e é por isso que a
  // linha de pontos é desenhada em runtime e não escrita no HTML.
  const semJs = await navegador.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const pj = await semJs.newPage();
  await pj.goto(base, { waitUntil: 'load' });
  const aberto = await pj.evaluate(() => ({
    pontos: document.querySelectorAll('.pontos button').length,
    faixa: !!document.querySelector('.telas'),
    figuras: document.querySelectorAll('.telas figure').length,
  })).catch(() => null);
  const semScript = await pj.$$eval('.pontos button', (e) => e.length).catch(() => 0);
  const faixaViva = await pj.$$eval('.telas figure', (e) => e.length).catch(() => 0);
  checar(semScript === 0 && faixaViva >= 10,
    'E · sem JavaScript não há ponto nenhum, e a faixa continua lá com os prints '
    + '— a linha é desenhada em runtime justamente para poder não existir',
    JSON.stringify({ pontos: semScript, figuras: faixaViva, aberto }));
  await semJs.close();
  await ctx.close();
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
