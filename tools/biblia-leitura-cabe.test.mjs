#!/usr/bin/env node
// ============================================================================
// A FOLHA DE LEITURA DA BÍBLIA CABE — o versículo em destaque e a referência.
//
// ## Por que ele existe
//
// Dois relatos do operador, na mesma captura:
//
//  · *"verifique a disposição do tamanho da fonte no texto em destaque da
//    bíblia, que será exibido, está cortando texto em certas telas"*
//  · *"na base, onde tem o livro capítulo e versículo selecionado, está
//    sobrepondo os elementos na sua direita, por falta de espaço e ajuste de
//    dimensão"*
//
// **Os dois falham CALADOS e os dois dependem da TELA**, que é a razão de um
// oráculo: nada lança, nada aparece no console, e na tela em que o desenho foi
// decidido está tudo certo. MEDIDO antes de mexer, na seção central:
//
// | tela | linhas que cabiam |
// |---|---|
// | 360×640 | **0,79** |
// | 393×786 | 2,87 |
// | 393×786 · fonte do sistema 1,3× | **1,23** |
// | 360×640 · fonte 1,3× | **zero** |
//
// E o `-webkit-line-clamp: 6` nunca engatava — a caixa jamais chegou a seis
// linhas —, então quem cortava era o `overflow` da seção, no MEIO da linha: a
// altura da caixa sobrava de 7 a 26px sobre um múltiplo da linha nos oito
// cenários medidos.
//
// Na barra, com as QUATRO pílulas: ela pede 238px com a fonte padrão e 308px
// com a do sistema em 1,3×, contra 200–286px de linha livre depois dos dois
// botões de guardar — até 108px de transbordo sobre um vão de 7px, isto é, a
// referência pintada por cima de dois botões que continuam tocáveis por baixo.
//
// ## As quatro metades, e por que cada uma
//
//  · **A · o DESTAQUE mostra ao menos duas linhas**, em toda tela. É o pedido
//    inteiro do primeiro relato, e a asserção é contra a `lineHeight`
//    COMPUTADA — nunca contra um número de pixels, que mediria a fonte
//    instalada na máquina junto.
//  · **B · a barra NUNCA pinta por cima dos botões.** Uma desigualdade
//    geométrica (a direita da referência contra a esquerda das ações), e não a
//    ausência de `overflow`: o que o relato descreve é o resultado, e ele
//    continua sendo o resultado seja qual for a métrica da fonte.
//  · **C · e onde CABIA em uma linha, continua em uma linha.** É a reversão que
//    impede o conserto largo demais — `flex-wrap` que quebrasse sempre passaria
//    em A e em B e cobraria uma faixa inteira de altura da leitura em toda tela.
//  · **D · o corte ESMAECE.** A máscara é o que troca a linha serrada por um
//    desvanecer, e uma regra de CSS ausente passa em qualquer teste de classe:
//    a pergunta é o `mask-image` COMPUTADO.
//
//   node tools/biblia-leitura-cabe.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperar, esperarCortina, checar, falhas, porque } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)),
  '..', 'app', 'src', 'main', 'assets', 'web');

// O versículo da captura do operador — longo de propósito: é ele que não cabia.
const VERSICULO = 'os cavaleiros que esporeiam, a espada flamejante, o relampejar '
  + 'da lança e multidão de traspassados, massa de cadáveres, mortos sem fim; '
  + 'tropeça gente sobre os mortos.';

// AS TELAS, e a `fonte` é a escala do sistema Android — que é o que empurra a
// folha para o aperto e o que a máquina de quem escreve não tem por padrão.
const TELAS = [
  { w: 360, h: 640, nome: '360×640' },
  { w: 360, h: 740, nome: '360×740' },
  { w: 393, h: 786, nome: '393×786' },
  { w: 430, h: 900, nome: '430×900' },
  { w: 360, h: 740, fonte: 1.15, nome: '360×740 · fonte 1,15×' },
  { w: 393, h: 786, fonte: 1.30, nome: '393×786 · fonte 1,3×' },
  { w: 360, h: 640, fonte: 1.30, nome: '360×640 · fonte 1,3×' },
];

const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const erros = [];

async function medir(t) {
  const ctx = await navegador.newContext({ viewport: { width: t.w, height: t.h } });
  await semRedeExterna(ctx);
  await ctx.addInitScript(() => {
    try { localStorage.setItem('av.appMode', 'full'); } catch (_) { /* storage bloqueado */ }
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push(t.nome + ' · pageerror: ' + e.message));
  if (t.fonte) {
    await pg.addInitScript((f) => {
      addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.fontSize = (16 * f) + 'px';
      });
    }, t.fonte);
  }
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await esperarCortina(pg);
  await esperar(pg, () => window.AVDB && typeof window.__avBack === 'function', null, 30000);
  const r = await pg.evaluate(async (texto) => {
    setAppMode('full');
    const bookIdx = Bible.BOOKS.findIndex((x) => /Naum/i.test(x.name));
    const vs = [];
    for (let i = 1; i <= 19; i++) {
      vs.push({ n: i, text: i === 3 ? texto
        : 'Versículo ' + i + ' de teste com um texto razoavelmente longo para ocupar linhas nesta folha.' });
    }
    await AVDB.setState('bible:' + bibleVersionId + '_' + bibleBookId(bookIdx) + '_3',
      { verses: vs, syncedAt: Date.now() });
    // A QUARTA PÍLULA só existe com versões carregadas, e sem rede a lista vem
    // vazia: medir com três é medir outra barra — foi assim que a primeira
    // calibração deste arquivo saiu 50px otimista.
    bibleVersions = [{ id: 'ara', name: 'Almeida Revista e Atualizada (ARA)' },
                     { id: 'nvi', name: 'Nova Versão Internacional (NVI)' }];
    bibleVersionId = 'ara';
    abrirBiblia();
    bibleSel = { bookIdx, chapter: 3 };
    bibleChapterData = { verses: vs };
    startBibleReading(2);
    toggleBibleVerse();   // NO AR, que é o estado da captura
    await new Promise((f) => setTimeout(f, 60));
    const cur = document.querySelector('.bible-vsec.cur');
    const txt = cur && cur.querySelector('.bible-vsec-text');
    const nav = document.querySelector('.bible-ref-nav');
    const acoes = document.querySelector('.bible-read-acoes');
    if (!cur || !txt || !nav || !acoes) return { erro: 'a tela de leitura não montou' };
    const cs = getComputedStyle(txt);
    const navB = nav.getBoundingClientRect();
    const acB = acoes.getBoundingClientRect();
    return {
      // A · em LINHAS, contra a `lineHeight` computada — nunca em pixels.
      linhas: +(txt.getBoundingClientRect().height / parseFloat(cs.lineHeight)).toFixed(2),
      fonte: parseFloat(cs.fontSize),
      // B · a geometria do relato.
      navDireita: +navB.right.toFixed(1),
      acoesEsquerda: +acB.left.toFixed(1),
      // C · uma linha ou duas: os topos coincidem quando a barra não quebrou.
      umaLinha: Math.abs(navB.top - acB.top) < 2,
      // E O QUE FOI TRUNCADO — OUTRA pergunta que a da sobreposição: com as
      // pílulas podendo encolher, a barra deixa de transbordar truncando, o que
      // não pinta por cima de ninguém e continua ilegível.
      truncado: [...nav.querySelectorAll('.bible-ref-value')]
        .filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent),
      // O RÓTULO SAIU (v1.8.83) — asserção NEGATIVA, porque foi ele que ditava a
      // largura das três pílulas de número e era ele que forçava a quebra.
      rotulos: nav.querySelectorAll('.bible-ref-label').length,
      // E A BARRA CABE NA BASE: `scrollWidth` contra `clientWidth` na foot, que
      // é a pergunta do operador ("não transborde nunca a largura disponível
      // nessa base"). A geometria dos filhos não a responde — um filho que sai
      // da caixa flex não muda o `scrollWidth` do pai em todo caso.
      transborda: (() => {
        const f = document.querySelector('.bible-read-foot');
        return f ? f.scrollWidth - f.clientWidth : -1;
      })(),
      pilulas: nav.children.length,
      // D · a máscara, no COMPUTADO.
      mascara: (cs.webkitMaskImage || cs.maskImage || 'none') !== 'none',
      // Quantas seções de contexto a folha decidiu caber.
      secoes: [...document.querySelectorAll('.bible-vsec')]
        .filter((e) => getComputedStyle(e).display !== 'none').length,
    };
  }, VERSICULO);
  await ctx.close();
  return r;
}

try {
  const lidas = [];
  for (const t of TELAS) lidas.push({ t, r: await medir(t) });

  const falhou = lidas.filter((x) => x.r.erro);
  checar(falhou.length === 0, 'a folha de leitura montou nas ' + TELAS.length + ' telas',
    JSON.stringify(falhou.map((x) => x.t.nome)));

  checar(lidas.every((x) => x.r.pilulas === 4),
    'e a barra tem as QUATRO pílulas — com três, a medição da largura é de outra barra',
    JSON.stringify(lidas.map((x) => x.t.nome + ':' + x.r.pilulas)));

  // =========================================================================
  // A · O DESTAQUE MOSTRA AO MENOS DUAS LINHAS
  // =========================================================================
  //
  // DUAS e não três: é o piso do que se lê para RECONHECER o versículo (a
  // íntegra vai para o telão), e é o número que a tela mais apertada sustenta.
  // MEDIDO antes da correção: 0,79 linha a 360×640 e ZERO a 360×640 com fonte
  // 1,3×. O `1.9` é a folga contra o arredondamento de uma métrica de fonte
  // diferente da desta máquina — não um alvo mais frouxo.
  const magros = lidas.filter((x) => x.r.linhas < 1.9);
  checar(magros.length === 0,
    'A · o versículo em DESTAQUE mostra ao menos duas linhas em toda tela — '
    + 'ele é o que vai ao telão, e mostrava menos de uma',
    JSON.stringify(lidas.map((x) => x.t.nome + ': ' + x.r.linhas)));

  // E A FONTE NÃO REGRIDE NA TELA GRANDE, que é a reversão desta metade: fazer
  // a fonte seguir a caixa é fácil de exagerar, e o custo seria encolher o
  // texto justamente onde ele cabia.
  const grande = lidas.find((x) => x.t.nome === '430×900');
  const teto = 1.05 * 16; // --fs-2xl
  checar(grande && Math.abs(grande.r.fonte - teto) < 0.6,
    'A · e a 430×900 ela continua no TETO de sempre — a fonte segue a caixa '
    + 'até o tamanho que já era, e não além',
    grande && grande.r.fonte);

  // =========================================================================
  // B · A BARRA NUNCA PINTA POR CIMA DOS BOTÕES
  // =========================================================================
  //
  // A asserção que carrega o relato, e ela é uma DESIGUALDADE: onde a barra
  // divide a linha com os botões, a direita dela fica à esquerda deles; onde
  // ela quebrou, os dois retângulos nem dividem linha. Nos dois casos vale.
  const sobrepoem = lidas.filter((x) => x.r.umaLinha && x.r.navDireita > x.r.acoesEsquerda + 0.5);
  checar(sobrepoem.length === 0,
    'B · a referência NUNCA pinta sobre os dois botões de guardar — eles '
    + 'continuam tocáveis por baixo, e o toque faria outra coisa',
    JSON.stringify(lidas.map((x) => x.t.nome + ': nav→' + x.r.navDireita
      + ' ações→' + x.r.acoesEsquerda + (x.r.umaLinha ? '' : ' (quebrou)'))));

  // E ELA NÃO TRUNCA NADA, que é a metade que a sobreposição não cobre: com as
  // pílulas podendo encolher, a barra deixa de PINTAR POR CIMA e passa a
  // TRUNCAR — B fica verde e o operador continua lendo reticências.
  //
  // O EXTREMO DEIXOU DE SER EXCEÇÃO na v1.8.83. Ele ficava de fora porque a
  // 360×640 com a fonte do sistema em 1,3× a referência pedia 308px e a folha
  // inteira tem 298px — nem a linha sozinha bastava. Quem pedia aqueles 308 era
  // o rótulo em caixa alta; sem ele a barra cabe nas SETE telas, e a exceção
  // sai junto com a causa dela.
  const truncou = lidas.filter((x) => x.r.truncado.length);
  checar(truncou.length === 0,
    'B · e ela não TRUNCA nada, em NENHUMA das sete telas — sem isso a barra '
    + 'para de sobrepor virando reticências, que passa na asserção acima e '
    + 'continua ilegível',
    JSON.stringify(truncou.map((x) => x.t.nome + ': ' + x.r.truncado.join('/'))));

  // =========================================================================
  // C · UMA LINHA, EM TODA TELA — NÃO HÁ MODO DE DUAS LINHAS (v1.8.83)
  // =========================================================================
  //
  // Pedido do operador: *"Essa barra não deve ter um modo de 'duas linhas' que
  // foi adicionado anteriormente por você"*. Até aqui esta asserção media UMA
  // tela (a folgada), porque a quebra era o desenho previsto para as apertadas;
  // hoje ela é o que não pode acontecer em nenhuma, e a altura que a segunda
  // faixa cobrava volta inteira para a leitura.
  const quebrou = lidas.filter((x) => x.r.umaLinha !== true);
  checar(quebrou.length === 0,
    'C · a barra fica numa linha só nas SETE telas, com os botões de guardar ao '
    + 'lado — a segunda faixa cobrava altura da Escritura, que é o conteúdo '
    + 'desta tela', JSON.stringify(quebrou.map((x) => x.t.nome)));

  // E A BARRA NÃO TRANSBORDA A BASE, que é a pergunta do operador por extenso.
  // Ela é diferente de B (pintar por cima) e de C (quebrar): uma barra pode
  // caber numa linha, não pintar sobre ninguém, e ainda assim ser mais larga que
  // a caixa que a hospeda.
  const estourou = lidas.filter((x) => x.r.transborda > 0.5);
  checar(estourou.length === 0,
    'C · e ela não TRANSBORDA a largura disponível na base, em nenhuma das sete',
    JSON.stringify(lidas.map((x) => x.t.nome + ': ' + x.r.transborda)));

  // O RÓTULO SAIU, e a asserção é NEGATIVA porque era ele a causa das três
  // acima: as pílulas de número se dimensionavam por "CAPÍTULO"/"VERSÍCULO" em
  // caixa alta, não pelos valores que elas mostram.
  checar(lidas.every((x) => x.r.rotulos === 0),
    'C · e as pílulas não têm mais o TÍTULO do grupo — quem diz o que cada uma é '
    + 'é a TINTA (a mesma da grade que ela abre, v1.3.14) mais o `title`',
    JSON.stringify(lidas.map((x) => x.t.nome + ':' + x.r.rotulos)));

  // =========================================================================
  // D · O CORTE ESMAECE
  // =========================================================================
  checar(lidas.every((x) => x.r.mascara === true),
    'D · o fim do texto tem MÁSCARA no computado — sem ela a última linha volta '
    + 'a ser serrada pelo `overflow`, e uma regra ausente passa em qualquer '
    + 'teste de classe',
    JSON.stringify(lidas.map((x) => x.t.nome + ':' + x.r.mascara)));

  // E A FOLHA ENCOLHE O CONTEXTO, NÃO O DESTAQUE: quantas seções cabem é uma
  // conta de altura, e a que nunca sai é a central.
  checar(lidas.every((x) => x.r.secoes >= 1 && x.r.secoes <= 4),
    'D · e o número de seções de contexto acompanha a altura da folha',
    JSON.stringify(lidas.map((x) => x.t.nome + ': ' + x.r.secoes)));
  const apertada = lidas.find((x) => x.t.nome === '360×640 · fonte 1,3×');
  checar(apertada && apertada.r.secoes < 4,
    'D · na folha mais apertada ela mostra MENOS seções — quatro ali deixavam a '
    + 'central com zero de altura',
    apertada && apertada.r.secoes);

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
