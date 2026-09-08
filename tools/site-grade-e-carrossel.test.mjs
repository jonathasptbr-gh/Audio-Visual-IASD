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
//  D. **OS PONTOS.** Um por print — 14 em toda largura desde a v1.8.52, porque
//     os espaçadores põem a primeira posição em 0 e a última em `max` por
//     construção — e o ÚLTIMO leva ao fim EXATO da faixa.
//  F. **AS DUAS PONTAS SÃO CENTRO, E O PONTO j CENTRA A FIGURA j** (v1.8.52).
//     A segunda metade é a que o oráculo NÃO tinha: medido, ele passava VERDE
//     com o CSS centrado e o `montar()` velho, isto é, com o ponto 7 levando à
//     figura 8 a 1280px. Um indicador que aponta para o vizinho é pior que
//     indicador nenhum, e nada reprovava isso.
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
  // O `>= 12` é folga deliberada: a contagem existe só para provar que o
  // seletor achou os cartões — o que esta asserção guarda é o TETO DE 80
  // CARACTERES. Presa na contagem exata, a próxima remoção reprovaria aqui
  // falando de comprimento de texto, que é o motivo errado.
  checar(cartoes.length >= 12 && acima.length === 0,
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
        // O RÓTULO SAI DO ALVO, não do índice. Com um ponto por print os dois
        // coincidem hoje; a derivação pelo alvo é o que sobrevive ao dia em que
        // uma posição colapsar de novo.
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

    // O DESTINO DO ÚLTIMO PONTO É O ÚLTIMO PRINT CENTRADO, não o `max` (v1.8.52).
    // Até a v1.8.51 os dois eram a mesma coisa: com `scroll-snap-align: start` o
    // último encaixe caía no fim da faixa. Com o centro há o `gap` entre o
    // último print e o espaçador, então a última posição é `max − gap` — e ir a
    // `max` seria justamente o defeito relatado, o print encostado à direita.
    // Por isso a asserção passou a medir o CENTRO: ele é o que o operador pediu,
    // e é verdade nas duas eras (a `start` reprovaria aqui).
    const fim = await p.evaluate(async () => {
      const t = document.querySelector('.telas');
      const bs = [...document.querySelectorAll('.pontos button')];
      bs[bs.length - 1].click();
      await new Promise((f) => setTimeout(f, 1400));
      const figs = [...t.querySelectorAll('figure')];
      const r = figs[figs.length - 1].getBoundingClientRect();
      const c = t.getBoundingClientRect();
      return {
        pos: Math.round(t.scrollLeft), max: Math.round(t.scrollWidth - t.clientWidth),
        desvio: Math.round(Math.abs((r.left + r.width / 2) - (c.left + c.width / 2)) * 10) / 10,
        aceso: bs.findIndex((b) => b.getAttribute('aria-current') === 'true'),
        n: bs.length,
      };
    });
    checar(fim.desvio <= 2 && fim.aceso === fim.n - 1,
      'D · ' + largura + 'px: o ÚLTIMO ponto CENTRA o último print e continua '
      + 'aceso lá — mirar o `max` (o que a era `start` fazia) devolveria o print '
      + 'encostado na direita, que é o relato que abriu este lote',
      JSON.stringify(fim));
    await c.close();
  }

  // ── F. AS DUAS PONTAS SÃO CENTRO, E O PONTO j CENTRA A FIGURA j ─────────
  //
  // Pedido do operador (v1.8.52): *"o carrocel não está com as imagens
  // centralizadas na tela, ele está com a imagem encostada na esquerda de início
  // e no final encostada na direita. Faça com que comece no centro e termine no
  // centro"*, e *"também está visível a barra de rolagem do scroll interno do
  // carrocel, que não precisa mais já que temos a barra de pontos"*.
  //
  // A SEGUNDA ASSERÇÃO É A QUE FALTAVA. MEDIDO: com o CSS centrado e o
  // `montar()` ainda mirando o COMEÇO da figura, este oráculo passava VERDE nas
  // 16 asserções — e a 1280px o ponto 7 levava à figura 8. Um indicador que
  // aponta para o vizinho é pior que indicador nenhum.
  for (const largura of [390, 1280]) {
    const c = await navegador.newContext({ viewport: { width: largura, height: 900 } });
    const p2 = await c.newPage();
    await p2.goto(base, { waitUntil: 'load' });
    await esperar(p2, () => !!document.querySelector('.pontos button'), null, 8000);

    const pontas = await p2.evaluate(async () => {
      const t = document.querySelector('.telas');
      const figs = [...t.children];
      const cx = () => t.getBoundingClientRect();
      t.scrollTo({ left: 0, behavior: 'auto' });
      await new Promise((f) => setTimeout(f, 300));
      const esq = figs[0].getBoundingClientRect().left - cx().left;
      t.scrollTo({ left: 1e6, behavior: 'auto' });
      await new Promise((f) => setTimeout(f, 500));
      const dir = cx().right - figs[figs.length - 1].getBoundingClientRect().right;
      return { esq: +esq.toFixed(1), dir: +dir.toFixed(1), barra: getComputedStyle(t).scrollbarWidth };
    });
    checar(Math.abs(pontas.esq - pontas.dir) <= 2 && pontas.esq > 2,
      'F · ' + largura + 'px: a faixa COMEÇA e TERMINA no centro — as duas '
      + 'pontas medem o mesmo e nenhuma é zero. Era o relato: com o encaixe pelo '
      + 'COMEÇO o primeiro print encostava na borda esquerda (folga 0 a 1280px) '
      + 'e o último na direita', JSON.stringify(pontas));
    checar(pontas.barra === 'none',
      'F · ' + largura + 'px: e a barra de rolagem não é desenhada — a rolagem '
      + 'fica, o desenho sai, porque quem diz onde a faixa está são os pontos',
      pontas.barra);

    const centra = await p2.evaluate(async () => {
      const t = document.querySelector('.telas');
      const bs = [...document.querySelectorAll('.pontos button')];
      const figs = [...t.children];
      const fora = [];
      for (const j of [0, 1, Math.floor(bs.length / 2), bs.length - 1]) {
        bs[j].click();
        await new Promise((f) => setTimeout(f, 900));
        const meio = t.getBoundingClientRect().left + t.clientWidth / 2;
        let melhor = -1, d = Infinity;
        figs.forEach((f, i) => {
          const r = f.getBoundingClientRect();
          const e = Math.abs((r.left + r.width / 2) - meio);
          if (e < d) { d = e; melhor = i; }
        });
        if (melhor !== j || d > 2) fora.push({ ponto: j, figura: melhor, desvio: +d.toFixed(1) });
      }
      return { pontos: bs.length, figuras: figs.length, fora };
    });
    checar(centra.pontos === centra.figuras,
      'F · ' + largura + 'px: há UM ponto por print — com os espaçadores cada '
      + 'print tem uma posição centrada só sua, então nenhuma colapsa na vizinha',
      JSON.stringify(centra));
    checar(centra.fora.length === 0,
      'F · ' + largura + 'px: e o ponto j CENTRA a figura j. É a asserção que '
      + 'faltava: com o CSS centrado e o `montar()` mirando o começo da figura, '
      + 'este oráculo passava verde com o ponto 7 levando à figura 8',
      JSON.stringify(centra.fora));
    await c.close();
  }

  // ── G. O CARTÃO DO PACOTE SAIU ──────────────────────────────────────────
  // Pedido do operador: *"apague o card sobre levar o acervo inteiro. Ele ficou
  // um card impar no design e também é uma função mais interna do que algo feito
  // para o usuário. Pode remover essa menção"*. O recurso CONTINUA no app — isto
  // é decisão de PÁGINA.
  checar(!/acervo inteiro|\.avpkg|noutro celular/i.test(texto.corpo + ' ' + texto.desc + ' ' + texto.og),
    'G · a página não menciona mais levar o acervo para outro celular — o pedido '
    + 'era "remover essa menção", não só o cartão',
    (('' + texto.corpo).match(/acervo inteiro|\.avpkg|noutro celular/i) || [''])[0]);

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
