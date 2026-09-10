// ============================================================================
// A SOMBRA DAS BORDAS DE UM SCROLL (v1.8.58)
// ============================================================================
//
// Pedido do operador, verbatim: *"Nos diversos lugares onde temos scroll de
// listagem, precisamos de um efeito de sombra nas fronteiras superiores e
// inferiores quando o conteúdo rolar para baixo delas, demonstrando que aquela
// fronteira está se sobrepondo a um conteúdo. Isso vale para o cronograma,
// playlist, biblioteca, favoritos auxiliar de leitura e qualquer outro scroll.
// Faça esse o padrão de efeito para os scrolls"*.
//
// O efeito EXISTIA para uma lista só desde a v1.5.16, e o que o prendia lá
// estava escrito: *"o `.open` no seletor não é escopo: é custo"*. Ele usava
// `backdrop-filter`, que obriga a compor o que está atrás — DUAS camadas por
// tira, não uma. Uma sombra é `linear-gradient`: tinta, zero camada. Foi a
// escolha do operador (*"sombra de verdade, e pode aplicar ela na biblioteca
// também"*) que derrubou o argumento, e o bloco G guarda isso — um
// `backdrop-filter` de volta na regra reacende o custo em silêncio.
//
// ---------- OS TRÊS DEFEITOS QUE ESTE ARQUIVO EXISTE PARA IMPEDIR ----------
// Os três foram MEDIDOS antes de uma linha ser escrita, e nenhum dos três é
// pego por "a sombra aparece":
//
//  1. A RECONFERÊNCIA (bloco E). Um render que troca o conteúdo sem mexer na
//     caixa e sem rolar — a forma de quase todo render deste app — não dispara
//     `scroll` NEM `ResizeObserver`. MEDIDO: a lista foi de 511 para 1707 de
//     altura rolável com `tem-abaixo` FALSO, isto é, sem sombra sobre uma lista
//     que passou a esconder conteúdo.
//  2. A GRADE (bloco F). O `#simpleLyrics` vira `display: grid` em runtime
//     (`.lv-grade`, a letra como apresentação), e o pseudo-elemento de um
//     contêiner de grade É UM ITEM DELA: a tira toma a célula 1 e empurra a
//     página 1 do deck para a segunda coluna, no meio do culto. O bloco mede a
//     COLUNA nos dois estados — com a exclusão e com ela desfeita à força —,
//     porque medir só o estado publicado aprovaria uma grade de uma coluna.
//  3. O CARROSSEL (bloco H). `overflow-x: auto` COMPUTA `overflow-y: auto`, e
//     um censo por estilo computado marcaria o histórico do sorteio — que rola
//     na HORIZONTAL — com uma sombra vertical que não descreve nada.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, checar, falhas } from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port + '/controle/index.html';
const navegador = await abrirNavegador();

// A CENA: acervo plantado e TODA folha com scroller aberta, para que os catorze
// estejam DESENHADOS — e três deles TRANSBORDANDO de verdade, cada um de uma
// família diferente (a janela da Biblioteca, o bottom-sheet da playlist, o
// popup do leitor de letra). Um scroller de caixa zero mede igual com e sem a
// tira, e aprovaria o bloco B sem medir nada.
//
// O histórico do sorteio entra aqui de propósito: ele é o carrossel HORIZONTAL,
// e é no censo do bloco A que a exclusão dele precisa estar sob medição.
async function cena(pg) {
  return pg.evaluate(async () => {
    const z = (ms) => new Promise((f) => setTimeout(f, ms));
    setAppMode('full'); await z(150);
    for (let i = 0; i < 30; i++) {
      await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
        { name: 'Louvor ' + i, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
    }
    const ids = await AVDB.listIds('imports');
    for (const id of ids) await AVDB.listAdd('playlist', id);
    plItems = await AVDB.listItems('playlist');
    await load(); await z(300);
    // A folha de Ferramentas monta só a ferramenta ATIVA — o `.draw-hist` só
    // existe com o Sorteio na frente E com algo já sorteado.
    miscTool = 'draw';
    draw.used = ['7', '12', '3', '21', '9', '33', '41', '2', '18', '27', '5', '14'];
    abrirFerramentas(); await z(300);
    document.getElementById('plBtn').click(); await z(250);
    // `currentItem` é `let` no topo de um script clássico: vínculo léxico, não
    // propriedade de `window`.
    currentItem = { id: 'marcador', name: 'Louvor de prova', kind: 'audio', seconds: 200,
      lyrics: Array.from({ length: 40 }, (_, i) => ({ text: 'Estrofe ' + (i + 1) + ' — linha de letra' })) };
    openLyricsPopup(); await z(400);
  });
}

// Fecha o que a cena abriu e devolve a Biblioteca ao topo, sobre a lista de
// imports — os blocos C, D e E medem o hit-test e o render DELA, e um popup por
// cima responderia por ele.
async function focarBiblioteca(pg) {
  return pg.evaluate(async () => {
    const z = (ms) => new Promise((f) => setTimeout(f, ms));
    for (let i = 0; i < 4; i++) { __avBack(); await z(180); }
    await z(200);
    const el = document.getElementById('library');
    return { aberta: el.clientHeight > 100, transborda: el.scrollHeight - el.clientHeight > 2 };
  });
}

try {
  for (const tema of ['dark', 'light']) {
    const ctx = await navegador.newContext({
      viewport: { width: 390, height: 900 }, hasTouch: true, colorScheme: tema,
    });
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    await pg.goto(base, { waitUntil: 'load' });
    await esperarCortina(pg);
    await cena(pg);

    // ── A. O CENSO, NOS DOIS SENTIDOS ───────────────────────────────────
    //
    // Quem rola e não tem sombra é um buraco; quem tem sombra e não rola é uma
    // marca que ficou para trás. A ÚNICA exclusão é MEDIDA, não nomeada: quem
    // transborda na horizontal e não na vertical é carrossel — e um scroller
    // vertical de verdade nunca cai nela, porque ele transborda em Y. Uma lista
    // de ids aqui seria a lista que se edita para calar o teste.
    const censo = await pg.evaluate(() => {
      const out = { semMarca: [], comMarca: [], carrossel: [] };
      for (const n of document.querySelectorAll('*')) {
        const cs = getComputedStyle(n);
        const rolavel = /auto|scroll/.test(cs.overflowY);
        const nome = n.id || (n.className || '').toString().split(' ')[0];
        const soHorizontal = n.scrollWidth - n.clientWidth > 2
          && n.scrollHeight - n.clientHeight <= 2;
        if (rolavel && soHorizontal) out.carrossel.push(nome);
        else if (rolavel && !n.classList.contains('rola')) out.semMarca.push(nome);
        if (n.classList.contains('rola')) {
          out.comMarca.push({ nome, oy: cs.overflowY,
            grade: /grid/.test(cs.display), semVeu: n.classList.contains('sem-veu') });
        }
      }
      return out;
    });
    checar(censo.semMarca.length === 0,
      'A · ' + tema + ': TODO elemento que rola na vertical tem a sombra. Um scroller '
      + 'novo sem a marca é um buraco MUDO — nada na tela diz que falta',
      JSON.stringify(censo.semMarca));
    checar(censo.comMarca.length >= 12 && censo.comMarca.every((x) => /auto|scroll/.test(x.oy)),
      'A · ' + tema + ': e o inverso — nenhuma marca sobra num elemento que deixou de '
      + 'rolar (' + censo.comMarca.length + ' marcados)',
      JSON.stringify(censo.comMarca.filter((x) => !/auto|scroll/.test(x.oy))));
    checar(censo.carrossel.length >= 1,
      'A · ' + tema + ': e a cena TEM um carrossel horizontal desenhado — sem ele a '
      + 'exclusão do censo passa sem nunca ser exercida', JSON.stringify(censo.carrossel));
    const grades = censo.comMarca.filter((x) => x.grade !== x.semVeu);
    checar(grades.length === 0,
      'A · ' + tema + ': e `sem-veu` acompanha o `display` COMPUTADO de cada marcado, '
      + 'nos dois sentidos — quem é grade tem, quem não é não tem',
      JSON.stringify(grades));

    // ── B. A TIRA SOME DA CONTA DE ROLAGEM ──────────────────────────────
    //
    // Sem as margens negativas que a cancelam, cada lista ganha 44px de rolagem
    // FANTASMA no fim. As duas medidas que as alimentam (`gap` e recuo) são
    // LIDAS do layout e não declaradas — a primeira escrita deste lote as
    // transcreveu à mão e MEDIDO errou quatro das catorze, sem o `scrollHeight`
    // acusar nenhuma, porque aquelas quatro listas não transbordavam.
    const alt = await pg.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('.rola')) {
        const com = el.scrollHeight;
        el.classList.remove('rola');
        const sem = el.scrollHeight;
        el.classList.add('rola');
        const cs = getComputedStyle(el);
        out.push({ nome: el.id || el.className, sem, com,
          transborda: el.scrollHeight - el.clientHeight > 2,
          vao: cs.getPropertyValue('--veu-vao').trim(),
          vaoReal: cs.rowGap === 'normal' ? '0px' : cs.rowGap,
          base: cs.getPropertyValue('--veu-base').trim(), baseReal: cs.paddingBottom });
      }
      return out;
    });
    const crescidos = alt.filter((x) => x.sem !== x.com);
    const cheios = alt.filter((x) => x.transborda);
    checar(cheios.length >= 3,
      'B · ' + tema + ': a cena tem TRÊS scrollers que transbordam de verdade ('
      + cheios.length + ') — medir a altura de uma lista que cabe aprova sem medir '
      + 'nada, porque `scrollHeight` de quem não transborda é o `clientHeight`',
      JSON.stringify(alt.map((x) => x.nome + (x.transborda ? '*' : ''))));
    checar(crescidos.length === 0,
      'B · ' + tema + ': e a tira não acrescenta um pixel de rolagem a nenhum deles',
      JSON.stringify(crescidos));
    const errados = alt.filter((x) => x.vao !== x.vaoReal || x.base !== x.baseReal);
    checar(errados.length === 0,
      'B · ' + tema + ': e as duas medidas de cada scroller são as do LAYOUT, lidas e '
      + 'não transcritas', JSON.stringify(errados));

    const foco = await focarBiblioteca(pg);
    checar(foco.aberta && foco.transborda,
      'B · ' + tema + ': a Biblioteca fica no topo e TRANSBORDANDO para os blocos '
      + 'seguintes — sobre uma lista que cabe, C, D e E aprovam qualquer coisa',
      JSON.stringify(foco));

    // ── C. NOS EXTREMOS ELA NÃO EXISTE ──────────────────────────────────
    // A leitura é do PIXEL, não da classe: a classe é o veredito do JS, e a
    // regra que a consome mora no CSS. Medir só a classe aprova o dia em que o
    // seletor dos extremos sair da folha — a sombra ficaria acesa nas duas
    // pontas com o JS perfeitamente certo.
    const ext = await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      const el = document.getElementById('library');
      const ler = () => ({
        acima: getComputedStyle(el, '::before').display !== 'none',
        abaixo: getComputedStyle(el, '::after').display !== 'none',
        classes: (el.classList.contains('tem-acima') ? 'A' : '-')
          + (el.classList.contains('tem-abaixo') ? 'B' : '-'),
      });
      el.scrollTop = 0; await z(120); const topo = ler();
      el.scrollTop = 300; await z(120); const meio = ler();
      el.scrollTop = el.scrollHeight; await z(120); const fim = ler();
      el.scrollTop = 300; await z(120);
      return { topo, meio, fim };
    });
    checar(ext.topo.acima === false && ext.topo.abaixo === true
      && ext.meio.acima === true && ext.meio.abaixo === true
      && ext.fim.acima === true && ext.fim.abaixo === false,
      'C · ' + tema + ': no TOPO não há sombra DESENHADA em cima e no FIM não há '
      + 'embaixo — uma sombra ali é o app dizendo que há mais quando não há',
      JSON.stringify(ext));

    // ── D. ELA NÃO COME O TOQUE ─────────────────────────────────────────
    //
    // Sem `pointer-events: none` são 22px MORTOS em cada ponta — e a de cima é
    // exatamente onde o cabeçalho grudento vive, a de baixo onde o último item
    // repousa.
    const toque = await pg.evaluate(() => {
      const el = document.getElementById('library');
      const q = el.getBoundingClientRect();
      const alvo = (y) => {
        const e = document.elementFromPoint(q.left + q.width / 2, y);
        if (!e) return { tag: null, dentro: false };
        return { tag: (e.className || e.tagName).toString().split(' ')[0],
                 dentro: el.contains(e) && e !== el };
      };
      return { cima: alvo(q.top + 8), baixo: alvo(q.bottom - 8) };
    });
    checar(toque.cima.dentro && toque.baixo.dentro,
      'D · ' + tema + ': o toque ATRAVESSA a sombra nas duas pontas e chega numa LINHA '
      + 'de dentro da lista, não no scroller nem numa tira', JSON.stringify(toque));

    // ── E. A RECONFERÊNCIA — O DEFEITO Nº 1 ─────────────────────────────
    //
    // O render encolhe a lista e volta a enchê-la. A CAIXA não muda (o scroller
    // é `flex: 1` de uma janela de altura fixa) e ninguém rola: `scroll` e
    // `ResizeObserver` ficam os dois calados, e o que sobra é o
    // `MutationObserver` de `childList`.
    const recon = await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      const el = document.getElementById('library');
      el.scrollTop = 0; await z(150);
      const ids = await AVDB.listIds('imports');
      await AVDB.listSet('imports', ids.slice(0, 2));
      await load(); await z(400);
      const vazio = { sh: el.scrollHeight, ch: el.clientHeight,
                      abaixo: el.classList.contains('tem-abaixo') };
      await AVDB.listSet('imports', ids);
      await load(); await z(400);
      return { vazio,
        cheio: { sh: el.scrollHeight, ch: el.clientHeight,
                 abaixo: el.classList.contains('tem-abaixo') },
        semRolar: el.scrollTop === 0 };
    });
    checar(recon.semRolar && recon.vazio.abaixo === false && recon.cheio.abaixo === true
      && recon.cheio.sh > recon.vazio.sh && recon.cheio.ch === recon.vazio.ch,
      'E · ' + tema + ': um render que ENCHE a lista sem mexer na caixa e sem rolar '
      + 'acende a sombra de baixo — `scroll` e `ResizeObserver` não disparam aí, e '
      + 'sem o `MutationObserver` a lista fica sem sombra sobre o que ela esconde',
      JSON.stringify(recon));
    await ctx.close();
  }

  // ── F. A GRADE — O DEFEITO Nº 2 ───────────────────────────────────────
  //
  // A grade é a do APP (`.simple-lyrics.lv-grade`, duas colunas), não uma
  // inventada aqui, e o que o bloco mede é o MECANISMO: `sem-veu` é o veredito
  // do `display` computado, reescrito a cada passada. As quatro medidas são um
  // ciclo fechado — flex tem tira, grade não tem, o CONTROLE prova que a tira
  // moveria a página, e voltar a flex devolve a tira. Sem a última, um veredito
  // GUARDADO passaria: ele erra só na volta.
  {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    await pg.goto(base, { waitUntil: 'load' });
    await esperarCortina(pg);
    const grade = await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      setAppMode('simple'); await z(250);
      const el = document.getElementById('simpleLyrics');
      // A CLASSE E O RENDER ANDAM JUNTOS, como no app: `refreshSimpleLyrics`
      // faz `classList.toggle('lv-grade', !!deck)` e em seguida monta as
      // linhas. É o RENDER que o observador do documento vê — uma troca de
      // classe sozinha é mutação de ATRIBUTO, e o observador não a escuta, de
      // propósito (escutá-la seria escutar as próprias escritas desta
      // varredura). Trocar a classe sem montar nada aqui mediria um caminho que
      // o app não tem.
      const montar = (comGrade) => {
        el.classList.toggle('lv-grade', comGrade);
        el.innerHTML = '';
        for (let i = 0; i < 40; i++) {
          const p = document.createElement('div');
          p.className = 'lv-row lv-row--slide';
          p.textContent = 'página ' + (i + 1);
          el.appendChild(p);
        }
      };
      const ler = () => ({
        display: getComputedStyle(el).display,
        semVeu: el.classList.contains('sem-veu'),
        transborda: el.scrollHeight - el.clientHeight > 2,
        abaixo: el.classList.contains('tem-abaixo'),
        tira: getComputedStyle(el, '::after').display,
        coluna: Math.round(el.firstElementChild.getBoundingClientRect().left
          - el.getBoundingClientRect().left),
      });
      montar(false); await z(200);
      const flex = ler();
      montar(true); await z(200);
      const emGrade = ler();
      const colunas = getComputedStyle(el).gridTemplateColumns.split(' ').length;
      // O CONTROLE: desfaz a exclusão à força, sobre o seletor que ela usa.
      const folha = document.createElement('style');
      folha.textContent = '.rola.sem-veu::before, .rola.sem-veu::after { display: block; }';
      document.head.appendChild(folha);
      await z(200);
      const forcado = ler();
      folha.remove();
      montar(false); await z(200);
      const devolta = ler();
      return { flex, emGrade, colunas, forcado, devolta };
    });
    checar(grade.flex.semVeu === false && grade.flex.transborda && grade.flex.abaixo
      && grade.flex.tira !== 'none',
      'F · em FLEX o `#simpleLyrics` TRANSBORDA e tem a tira, como qualquer scroller — '
      + 'sobre uma lista que cabe as três medidas abaixo dariam `none` pelo motivo '
      + 'errado (o extremo), e não pela grade', JSON.stringify(grade.flex));
    checar(grade.colunas === 2 && grade.forcado.coluna > 100,
      'F · o CONTROLE do bloco morde: com a exclusão desfeita à força a tira toma a '
      + 'célula 1 e a página 1 vai para a segunda coluna (' + grade.forcado.coluna
      + 'px) — sem esta medida a asserção abaixo aprovaria até uma grade de uma '
      + 'coluna, onde a tira não teria para onde empurrar nada', JSON.stringify(grade));
    checar(/grid/.test(grade.emGrade.display) && grade.emGrade.semVeu === true
      && grade.emGrade.tira === 'none' && grade.emGrade.coluna < 40,
      'F · virando GRADE ele ganha `sem-veu` e perde a tira: um pseudo-elemento de um '
      + 'contêiner de grade é um ITEM dela, e a página 1 do deck fica na coluna 1',
      JSON.stringify(grade.emGrade));
    checar(grade.devolta.semVeu === false && grade.devolta.abaixo
      && grade.devolta.tira !== 'none',
      'F · e voltando a FLEX a tira volta — o veredito é RELIDO a cada passada, nunca '
      + 'guardado: um cache erra exatamente aqui, na volta, e calado',
      JSON.stringify(grade.devolta));

    // ── G. E NUNCA MAIS UM `backdrop-filter` ───────────────────────────
    const custo = await pg.evaluate(() => {
      const el = document.getElementById('library');
      const b = getComputedStyle(el, '::before');
      return { bd: b.backdropFilter || b.webkitBackdropFilter || 'none',
               fundo: b.backgroundImage.slice(0, 60) };
    });
    checar(custo.bd === 'none' && /gradient/.test(custo.fundo),
      'G · a sombra é TINTA (`linear-gradient`), nunca `backdrop-filter`: aquele '
      + 'obriga a compor o que está atrás — DUAS camadas por tira, medidas — e foi '
      + 'o custo dele que prendeu o efeito a uma lista só da v1.5.16 até aqui',
      JSON.stringify(custo));

    // ── H. O CARROSSEL HORIZONTAL — O DEFEITO Nº 3 ─────────────────────
    const horiz = await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      setAppMode('full'); await z(150);
      miscTool = 'draw';
      draw.used = ['7', '12', '3', '21', '9', '33', '41', '2', '18', '27', '5', '14'];
      abrirFerramentas(); await z(300);
      const h = document.querySelector('.draw-hist');
      if (!h) return { ausente: true };
      const cs = getComputedStyle(h);
      return { rola: h.classList.contains('rola'), oy: cs.overflowY, ox: cs.overflowX,
               transbordaX: h.scrollWidth - h.clientWidth > 2,
               transbordaY: h.scrollHeight - h.clientHeight > 2 };
    });
    checar(!horiz.ausente && horiz.transbordaX && !horiz.transbordaY,
      'H · o carrossel HORIZONTAL do histórico do sorteio está DESENHADO e '
      + 'transbordando em X — ausente, a asserção abaixo não mede nada',
      JSON.stringify(horiz));
    checar(horiz.rola === false && horiz.oy === 'auto',
      'H · e ele NÃO recebe sombra vertical, apesar de o estilo computado dizer '
      + '`overflow-y: auto` — `overflow-x: auto` COMPUTA o eixo cruzado, e um censo '
      + 'por estilo o marcaria com uma sombra que não descreve nada',
      JSON.stringify(horiz));
    await ctx.close();
  }

  // ── I. NA FONTE: A COR MORA EM tokens.css ─────────────────────────────
  const css = fs.readFileSync(path.join(RAIZ, 'controle', 'controle.css'), 'utf8');
  const tok = fs.readFileSync(path.join(RAIZ, 'shared', 'tokens.css'), 'utf8');
  checar(/--sombra-rolagem:\s*rgba\(/.test(tok) && !/--sombra-rolagem\s*:/.test(css),
    'I · a cor da sombra é um TOKEN e mora em tokens.css, no bloco COMPARTILHADO — '
    + 'ela é alfa, não uma cor de base, e é isso que a faz servir os dois temas e a '
    + 'alternância papel → poço da Biblioteca com uma tinta só');
  // O corte é pelo SELETOR em começo de linha, nunca por `indexOf` da string: a
  // primeira ocorrência de `[data-tema="claro"]` no arquivo é um COMENTÁRIO de
  // cabeçalho, e cortar ali punha o arquivo inteiro dentro do "tema claro".
  const claro = tok.search(/^:root\[data-tema="claro"\]/m);
  checar(claro > 0 && !/--sombra-rolagem/.test(tok.slice(claro)),
    'I · e ela NÃO é redeclarada no tema claro: MEDIDO, .30 lê 1,51:1 nos DOIS — no '
    + 'escuro quem escurece é o texto claro, no claro é a superfície branca');

} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
