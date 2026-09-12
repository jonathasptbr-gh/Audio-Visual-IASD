// A BARRA DO TOPO, O TÍTULO DAS JANELAS E A BASE DA LEITURA DA BÍBLIA (v1.8.80).
//
// ## Os três relatos, na mesma sessão
//
//  1. *"verifique a margem inferior da barra do topo do cronograma… a margem
//     abaixo dos botões de configurações e de limpar cronograma está muito rasa
//     em relação a margem superior. Ou melhor, parece que todos os itens dessa
//     barra estão descentralizados para baixo nessa barra"*;
//  2. *"os botões de opções da bíblia, que mostram o texto, salvar no cronograma
//     e salvar nos favoritos… essa barra de controles não está preenchendo toda
//     a largura disponível dessa base"*;
//  3. *"centralizar o título de cada janela dessas… E tome cuidado para que ele
//     permaneça imóvel mesmo alternando entre telas da mesma janela"*.
//
// ## Por que um oráculo, e por que os três juntos
//
// Os três são GEOMETRIA, e geometria falha calada: nada lança, nada aparece no
// console, e na tela em que o desenho foi decidido está tudo certo. MEDIDO antes
// de mexer, e é este o estado que cada asserção reprova:
//
// | o quê | 430×900 | 360×640 · fonte 1,3× |
// |---|---|---|
// | vão ACIMA dos botões da barra do topo | 9,59px | 12,47px |
// | vão ABAIXO deles | **0** | **0** |
// | sobra de cada lado na base da leitura | **28,7px** | (quebra em duas linhas) |
// | desvio do título de Ferramentas | **−19,8px** | **−20,6px** |
// | quanto o título da Bíblia ANDA ao abrir a leitura | **39,6px** | **41,2px** |
//
// ## A metade que impede o conserto largo demais
//
// A barra do topo não pode CRESCER para ficar simétrica: a altura dela é altura
// de LISTA, que é o conteúdo daquela tela. A asserção confere a caixa contra a
// conta declarada (`--hit` mais UM `--sp-5`, repartido entre os dois lados) — um
// `padding-bottom` acrescentado ao que já havia passaria na simetria e cobraria
// 9,6px do Cronograma, calado.
//
//   node tools/barra-do-topo-e-titulos.test.mjs
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperar, esperarCortina, checar, falhas, RAIZ_WEB } from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();

// AS DUAS CÉLULAS, e elas não são decorativas: a segunda é a que o operador usa
// (fonte do sistema em 1,3×) e a única em que a base da leitura QUEBRA em duas
// linhas — o caso em que "preencher a largura" tem outra resposta.
const TELAS = [
  { w: 430, h: 900, fonte: 1 },
  { w: 360, h: 640, fonte: 1.3 },
];

try {
  for (const t of TELAS) {
    const ctx = await navegador.newContext({ viewport: { width: t.w, height: t.h } });
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    if (t.fonte !== 1) {
      await pg.addInitScript((f) => {
        addEventListener('DOMContentLoaded', () => {
          document.documentElement.style.fontSize = (16 * f) + 'px';
        });
      }, t.fonte);
    }
    const onde = t.w + '×' + t.h + (t.fonte === 1 ? '' : ' · fonte ' + t.fonte + '×');
    await pg.goto(base + '/controle/', { waitUntil: 'load' });
    await esperarCortina(pg);
    await esperar(pg, () => window.AVDB && typeof window.__avBack === 'function', null, 30000);

    // ── 1 · A BARRA DO TOPO DO CRONOGRAMA ────────────────────────────────
    const barra = await pg.evaluate(() => {
      setAppMode('full');
      const h = document.querySelector('.list-header');
      const r = h.getBoundingClientRect();
      const moradores = ['#cronoLimpar', '#listTitle', '.list-header .settings-btn']
        .map((s) => document.querySelector(s)).filter(Boolean)
        .map((e) => e.getBoundingClientRect());
      const raiz = getComputedStyle(document.documentElement);
      return {
        altura: +r.height.toFixed(2),
        hit: parseFloat(raiz.getPropertyValue('--hit')),
        // O RESPIRO INTEIRO, que este lote repartiu em dois: é contra ele que a
        // altura é conferida, e é isso que reprova um conserto que CRESÇA a
        // barra em vez de centralizar o que já havia nela.
        //
        // EM PIXEL, e a conversão é o ponto: o token é declarado em `rem`
        // (`.6rem`), e um `parseFloat` cru devolve **0,6** — um número que
        // nunca bate com altura nenhuma e faria esta asserção reprovar todo
        // app, inclusive o certo. A raiz muda com a fonte do sistema, que é a
        // segunda célula deste arquivo.
        sp5: parseFloat(raiz.getPropertyValue('--sp-5')) * parseFloat(raiz.fontSize),
        // O vão é medido contra o MORADOR MAIS ALTO e o MAIS BAIXO: são os
        // botões que o operador nomeia, e é a caixa deles que encosta.
        acima: +(Math.min(...moradores.map((b) => b.top)) - r.top).toFixed(2),
        abaixo: +(r.bottom - Math.max(...moradores.map((b) => b.bottom))).toFixed(2),
        moradores: moradores.length,
      };
    });
    checar(barra.moradores === 3, onde + ' · (premissa) a barra do topo tem os três moradores', barra);
    checar(Math.abs(barra.acima - barra.abaixo) < 1,
      onde + ' · 1 · a barra do topo do Cronograma respira IGUAL em cima e '
      + 'embaixo — o `padding-bottom` era ZERO, e os três terminavam exatamente '
      + 'na fronteira de baixo', JSON.stringify(barra));
    checar(barra.acima > 2,
      onde + ' · 1 · e o respiro não foi zerado dos dois lados: simetria com vão '
      + 'nenhum é a mesma barra apertada, por outro caminho', barra.acima);
    // A METADE QUE IMPEDE O CONSERTO LARGO DEMAIS: a barra não pode CRESCER para
    // ficar simétrica — a altura dela é altura de LISTA, e a lista é o conteúdo
    // desta tela. A conta é a linha (`--hit`) mais UM respiro (`--sp-5`),
    // repartido entre os dois lados; acrescentar um `padding-bottom` ao que já
    // havia passaria nas duas asserções acima e cobraria 9,6px do Cronograma.
    checar(barra.sp5 > 0 && Math.abs(barra.altura - (barra.hit + barra.sp5)) < 1,
      onde + ' · 1 · e a CAIXA dela não mudou: a altura continua sendo a linha '
      + 'mais um respiro — simetrizar não podia custar altura de lista',
      JSON.stringify({ altura: barra.altura, esperado: barra.hit + barra.sp5 }));

    // ── 3a · O TÍTULO DA FOLHA DE FERRAMENTAS ────────────────────────────
    const ferr = await pg.evaluate(() => {
      abrirFerramentas();
      const head = document.querySelector('#toolsSheet .tools-head');
      const t2 = head.querySelector('.tools-title');
      const hb = head.getBoundingClientRect(), tb = t2.getBoundingClientRect();
      fecharFerramentas();
      return { desvio: +(((tb.left + tb.right) / 2) - ((hb.left + hb.right) / 2)).toFixed(1) };
    });
    checar(Math.abs(ferr.desvio) < 1.5,
      onde + ' · 3 · o título da janela de Ferramentas está no CENTRO da barra '
      + 'dela — com `flex: 1` ele era o espaçador da linha e encostava à '
      + 'esquerda', ferr.desvio);

    // ── 2 e 3b · A BÍBLIA: o título que não anda, e a base que preenche ──
    const bib = await pg.evaluate(async () => {
      const bookIdx = Bible.BOOKS.findIndex((x) => /Naum/i.test(x.name));
      const vs = [];
      for (let i = 1; i <= 19; i++) {
        vs.push({ n: i, text: 'Versículo ' + i + ' de teste, com texto suficiente para ocupar linhas.' });
      }
      await AVDB.setState('bible:' + bibleVersionId + '_' + bibleBookId(bookIdx) + '_3',
        { verses: vs, syncedAt: Date.now() });
      // A QUARTA PÍLULA só existe com versões carregadas, e sem rede a lista vem
      // vazia: medir com três é medir outra barra.
      bibleVersions = [{ id: 'ara', name: 'Almeida Revista e Atualizada (ARA)' },
                       { id: 'nvi', name: 'Nova Versão Internacional (NVI)' }];
      bibleVersionId = 'ara';
      abrirBiblia();
      const head = document.querySelector('#bibleSheet .tools-head');
      const tt = document.getElementById('bibleTitle');
      const medir = () => {
        const hb = head.getBoundingClientRect(), tb = tt.getBoundingClientRect();
        return {
          esq: +tb.left.toFixed(1),
          desvio: +(((tb.left + tb.right) / 2) - ((hb.left + hb.right) / 2)).toFixed(1),
          voltar: !document.getElementById('bibleBack').hidden,
        };
      };
      const naLista = medir();
      bibleSel = { bookIdx, chapter: 3 };
      bibleChapterData = { verses: vs };
      startBibleReading(2);
      await new Promise((f) => setTimeout(f, 80));
      const naLeitura = medir();
      const foot = document.querySelector('.bible-read-foot');
      const nav = document.querySelector('.bible-ref-nav');
      const acoes = document.querySelector('.bible-read-acoes');
      const fb = foot.getBoundingClientRect(), nb = nav.getBoundingClientRect(),
            ab = acoes.getBoundingClientRect();
      return {
        naLista, naLeitura, andou: +(naLeitura.esq - naLista.esq).toFixed(1),
        umaLinha: Math.abs(nb.top - ab.top) < 2,
        sobraEsq: +(nb.left - fb.left).toFixed(1),
        sobraDir: +(fb.right - ab.right).toFixed(1),
        pilulas: nav.children.length,
      };
    });
    checar(bib.naLista.voltar === false && bib.naLeitura.voltar === true,
      onde + ' · 3 · (premissa) o voltar da Bíblia aparece ao entrar na leitura — '
      + 'é ele que fazia o título andar', JSON.stringify(bib));
    checar(Math.abs(bib.andou) < 1.5,
      onde + ' · 3 · e o título da Bíblia NÃO se move entre as telas da mesma '
      + 'janela: a trilha lateral existe com ou sem botão nela',
      JSON.stringify({ andou: bib.andou, lista: bib.naLista, leitura: bib.naLeitura }));
    checar(Math.abs(bib.naLista.desvio) < 1.5 && Math.abs(bib.naLeitura.desvio) < 1.5,
      onde + ' · 3 · e ele está no CENTRO nas duas', JSON.stringify(bib));
    checar(bib.pilulas === 4,
      onde + ' · 2 · (premissa) a base da leitura tem as quatro pílulas', bib.pilulas);
    if (bib.umaLinha) {
      checar(bib.sobraEsq < 1 && bib.sobraDir < 1,
        onde + ' · 2 · a base da leitura PREENCHE a largura disponível — ela era '
        + '`justify-content: center` com dois blocos que não cresciam, e sobravam '
        + '28,7px de cada lado', JSON.stringify(bib));
    } else {
      // A BARRA QUEBROU EM DUAS LINHAS, e aí a pergunta é outra: a linha da
      // referência é que tem de ir de ponta a ponta. Medir a sobra à direita
      // aqui seria medir a SEGUNDA linha (os dois botões quadrados), que é
      // outro conteúdo — e o oráculo diria que o app está errado por caber.
      checar(bib.sobraEsq < 1,
        onde + ' · 2 · com a barra QUEBRADA em duas linhas, a referência ocupa a '
        + 'linha inteira — é o que "preencher a largura" quer dizer quando não '
        + 'cabe tudo numa faixa só', JSON.stringify(bib));
    }
    await ctx.close();
  }
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
