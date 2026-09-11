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
import {
  servirEstatico, abrirNavegador, esperarCortina, checar, falhas,
  lerPng, pixel, luminancia,
} from './arnes.mjs';

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
    const censo = await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      const out = { semMarca: [], comMarca: [], carrossel: [] };
      // O PAINEL DE MENSAGENS ENTRA NO CENSO, e ele é o caso que faltava: só a
      // ferramenta ATIVA é montada, e a cena abre no Sorteio. MEDIDO, o
      // `#msgWrap` veste `.misc-panel` (que carrega a marca) e computa
      // `overflow-y: hidden` — uma marca sobre quem não rola, exatamente o que
      // a segunda asserção deste bloco existe para policiar e nunca via.
      miscTool = 'msg'; refreshDiversos(); await z(250);
      const varrer = () => {
      for (const n of document.querySelectorAll('*')) {
        const cs = getComputedStyle(n);
        const rolavel = /auto|scroll/.test(cs.overflowY);
        const nome = n.id || (n.className || '').toString().split(' ')[0];
        const soHorizontal = n.scrollWidth - n.clientWidth > 2
          && n.scrollHeight - n.clientHeight <= 2;
        if (rolavel && soHorizontal) out.carrossel.push(nome);
        else if (rolavel && !n.classList.contains('rola')) out.semMarca.push(nome);
        if (n.classList.contains('rola') && !out.comMarca.some((m) => m.nome === nome)) {
          out.comMarca.push({ nome, oy: cs.overflowY,
            grade: /grid/.test(cs.display), semVeu: n.classList.contains('sem-veu') });
        }
      }
      };
      varrer();
      miscTool = 'draw'; refreshDiversos(); await z(250);
      varrer();
      return out;
    });
    checar(censo.semMarca.length === 0,
      'A · ' + tema + ': TODO elemento que rola na vertical tem a sombra. Um scroller '
      + 'novo sem a marca é um buraco MUDO — nada na tela diz que falta',
      JSON.stringify(censo.semMarca));
    const inertes = censo.comMarca.filter((x) => !/auto|scroll/.test(x.oy) && !x.semVeu);
    checar(censo.comMarca.length >= 12 && inertes.length === 0,
      'A · ' + tema + ': e o inverso — uma marca sobre quem NÃO ROLA carrega `sem-veu` '
      + '(' + censo.comMarca.length + ' marcados). Uma regra pode tirar a rolagem por '
      + 'baixo da marca — é o `.misc-panel--msg { overflow: hidden }` — e uma sombra '
      + 'sobre caixa que não rola descreve algo que não existe',
      JSON.stringify(inertes));
    checar(censo.carrossel.length >= 1,
      'A · ' + tema + ': e a cena TEM um carrossel horizontal desenhado — sem ele a '
      + 'exclusão do censo passa sem nunca ser exercida', JSON.stringify(censo.carrossel));
    const fora = censo.comMarca.filter((x) =>
      x.semVeu !== (x.grade || !/auto|scroll/.test(x.oy)));
    checar(fora.length === 0,
      'A · ' + tema + ': e `sem-veu` acompanha o `display` e o `overflow-y` COMPUTADOS '
      + 'de cada marcado, nos DOIS sentidos — quem é grade ou não rola tem, e mais '
      + 'ninguém tem', JSON.stringify(fora));

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
      // A PONTA DE BAIXO É A FRONTEIRA VISÍVEL, não a base da caixa (v1.8.61).
      // No Cronograma as três portas FLUTUAM sobre a lista, e a caixa dela passa
      // por baixo delas: um ponto em `q.bottom - 8` cai no botão de Ferramentas,
      // que é o comportamento certo (a porta tem de receber o toque) e não diz
      // nada sobre a tira. O que a tira vela é a fronteira acima das portas, e é
      // ali que o toque tem de chegar na LINHA.
      const foot = document.getElementById('listFoot');
      const fr = foot && !foot.hidden ? foot.getBoundingClientRect() : null;
      const base = fr && fr.top < q.bottom ? fr.top : q.bottom;
      return { cima: alvo(q.top + 8), baixo: alvo(base - 8) };
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


  // ── J. A TIRA ENCOSTA NA FRONTEIRA — O DEFEITO Nº 4 ───────────────────
  //
  // Relato do operador sobre a v1.8.58: *"as sombras estão identificando errado
  // onde é a fronteira e onde fica a sombra, deixando zonas claras entre a
  // sombra e a fronteira"*. Ele está certo, e o desvio tem FÓRMULA: **o vão é
  // exatamente o `padding` do próprio scroller**, nos três lados que não eram
  // compensados. MEDIDO em doze dos dezenove — `#simpleConn` 13,9 no topo e
  // 14,4 nos lados · `#lyricsViewBody` 11,0 e 12,6 · `#playlist` 8,0 e 11,0 ·
  // `.fade-opts` 5,0 e 14,0. Onde o recuo é zero a tira já encostava.
  //
  // A CAUSA é a mesma que este repositório já tinha medido, por outro caminho:
  // um `sticky` em `top: 0` para no topo do CONTENT box, não do padding box —
  // está escrito no comentário de `.popup-sheet--lib .popup-list` desde a
  // v1.5.15, e a resposta daquele lote foi zerar o `padding-top` de UMA lista.
  // A tira nasceu herdando o mesmo problema em catorze, e no eixo horizontal
  // além do vertical (o pseudo é item flex: a largura dele é a do content box).
  //
  // ESTE BLOCO EXISTE PORQUE A SUÍTE NÃO MEDIA POSIÇÃO NENHUMA. Ela media
  // existência, extensão, toque e censo — e nada disso vê uma tira fora do
  // lugar: plantando `top: 40px` à força, os blocos B, C e D passavam VERBATIM.
  // A régua aqui é o PIXEL, e não a string de um `calc()`.
  for (const tema of ['dark', 'light']) {
    const ctx = await navegador.newContext({
      viewport: { width: 390, height: 900 }, hasTouch: true, colorScheme: tema, deviceScaleFactor: 1,
    });
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    await pg.goto(base, { waitUntil: 'load' });
    await esperarCortina(pg);
    await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      setAppMode('full'); await z(150);
      for (let i = 0; i < 40; i++) {
        await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
          { name: 'Louvor ' + i, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      }
      const ids = await AVDB.listIds('imports');
      for (const id of ids) await AVDB.listAdd('playlist', id);
      plItems = await AVDB.listItems('playlist');
      await load(); await z(300);
      // A TINTA É TROCADA, A CAIXA NÃO: fundo opaco no lugar do degradê. Nenhuma
      // das duas propriedades move a tira, e é a caixa dela que se mede.
      const s = document.createElement('style');
      s.textContent = '.rola::before,.rola::after{background:#ff00ff!important;background-image:none!important}';
      document.head.appendChild(s);
      currentItem = { id: 'm', name: 'Louvor de prova', kind: 'audio', seconds: 200,
        lyrics: Array.from({ length: 40 }, (_, i) => ({ text: 'Estrofe ' + (i + 1) })) };
    });
    const CASOS = [
      ['#library', () => {}],
      ['#playlist', () => { document.getElementById('plBtn').click(); }],
      ['#lyricsViewBody', () => { openLyricsPopup(); }],
    ];
    const medidos = [];
    for (const [sel, abrir] of CASOS) {
      await pg.evaluate(abrir);
      await pg.waitForTimeout(450);
      const cx = await pg.evaluate(async (q) => {
        const z = (ms) => new Promise((f) => setTimeout(f, ms));
        const el = document.querySelector(q);
        if (!el || !el.clientHeight) return null;
        el.scrollTop = Math.floor(el.scrollHeight / 3);
        await z(350);
        const r = el.getBoundingClientRect();
        const c = getComputedStyle(el);
        return { padTop: r.top + parseFloat(c.borderTopWidth),
          padLeft: r.left + parseFloat(c.borderLeftWidth),
          padRight: r.right - parseFloat(c.borderRightWidth),
          // A BORDA DE BAIXO VOLTOU A SER A DA CAIXA (v1.8.62, revogando a
          // v1.8.61). Aquele lote descontou a altura das portas daqui porque a
          // regra do app descontava a mesma coisa da tira; o operador pediu o
          // contrário — a tira na fronteira, com as portas POR CIMA dela —, e
          // esta medida acompanha a do app. O que muda junto é a COLUNA do
          // rastreio (ver `flutua`, abaixo): no meio da tela a tira agora está
          // atrás de tinta opaca, e procurá-la ali acharia a tira DE CIMA.
          padBottom: r.bottom - parseFloat(c.borderBottomWidth),
          // Há rodapé FLUTUANTE sobre este scroller?
          flutua: !!(el.parentElement
            && el.parentElement.querySelector(':scope > #listFoot:not([hidden])')),
          recuoTopo: parseFloat(c.paddingTop), recuoEsq: parseFloat(c.paddingLeft),
          transborda: el.scrollHeight - el.clientHeight > 2,
          extraX: el.scrollWidth - el.clientWidth };
      }, sel);
      if (!cx || !cx.transborda) continue;
      const img = lerPng(await pg.screenshot());
      const mag = (c) => !!c && c[0] > 200 && c[1] < 80 && c[2] > 200;
      const xm = Math.round((cx.padLeft + cx.padRight) / 2);
      // A COLUNA DE BAIXO NÃO É A DO MEIO ONDE HÁ RODAPÉ FLUTUANTE (v1.8.62):
      // as três portas são OPACAS e pintam acima da tira, então no meio da tela
      // não há magenta nenhum a achar — o rastreio de baixo para cima cairia na
      // tira DE CIMA e devolveria um "vão" de 500px. A moldura de 12,8px que
      // elas não cobrem é onde a tira sobrevive, e é lá que ela é medida.
      const xb = cx.flutua ? Math.round(cx.padLeft) + 2 : xm;
      let topo = null, fundo = null, esq = null, dir = null;
      for (let y = Math.floor(cx.padTop) - 6; y < Math.ceil(cx.padBottom) + 6; y++) {
        if (mag(pixel(img, xm, y))) { topo = y; break; }
      }
      for (let y = Math.ceil(cx.padBottom) + 6; y > Math.floor(cx.padTop) - 6; y--) {
        if (mag(pixel(img, xb, y))) { fundo = y; break; }
      }
      if (topo != null) {
        const yy = topo + 6;
        const x0 = Math.max(0, Math.floor(cx.padLeft) - 8);
        const x1 = Math.min(img.w - 1, Math.ceil(cx.padRight) + 8);
        for (let x = x0; x <= x1; x++) if (mag(pixel(img, x, yy))) { esq = x; break; }
        for (let x = x1; x >= x0; x--) if (mag(pixel(img, x, yy))) { dir = x; break; }
      }
      medidos.push({ sel, recuoTopo: cx.recuoTopo, recuoEsq: cx.recuoEsq, extraX: cx.extraX,
        topo: topo == null ? null : +(topo - cx.padTop).toFixed(1),
        base: fundo == null ? null : +(cx.padBottom - fundo - 1).toFixed(1),
        esq: esq == null ? null : +(esq - cx.padLeft).toFixed(1),
        dir: dir == null ? null : +(cx.padRight - dir - 1).toFixed(1) });
    }
    // A CENA TEM DE CONTER UM SCROLLER COM RECUO DE VERDADE. Sobre um de recuo
    // ZERO a asserção passa com e sem o conserto — é a tautologia que o bloco
    // inteiro existe para não ser.
    const comRecuo = medidos.filter((m) => m.recuoTopo >= 6 && m.recuoEsq >= 9);
    checar(comRecuo.length >= 2,
      'J · ' + tema + ': a cena mede pelo menos DOIS scrollers com recuo próprio ('
      + comRecuo.length + ') — sobre recuo zero a tira encosta com e sem o conserto, '
      + 'e a asserção abaixo aprovaria qualquer coisa', JSON.stringify(medidos));
    const fora = medidos.filter((m) => [m.topo, m.base, m.esq, m.dir]
      .some((v) => v == null || Math.abs(v) > 1.5));
    checar(fora.length === 0,
      'J · ' + tema + ': a tira PINTADA encosta nas quatro bordas do padding box, '
      + 'em todos os medidos — o vão era exatamente o `padding` do scroller, e o '
      + 'que se via era uma faixa clara entre a fronteira e a sombra',
      JSON.stringify(fora));
    checar(medidos.every((m) => m.extraX <= 1),
      'J · ' + tema + ': e alargar a tira até o padding box NÃO cria rolagem '
      + 'horizontal — a margem negativa a leva à borda, nunca além dela',
      JSON.stringify(medidos.map((m) => m.sel + ':' + m.extraX)));

    // ── L. O CANTO SEGUE O ARCO ─────────────────────────────────────────
    //
    // Relato do operador: *"em diversas caixas, elas possuem os cantos
    // arredondados, e a sombra fica dentro desse topo arredondado"*. MEDIDO, a
    // sombra nunca foi COMIDA pelo arco (a cunha era zero nos dezenove): o que
    // se via era o canto de 90° da tira RECUADA, parado dentro da curva — *"não
    // parece sombra de borda; parece uma barra desenhada solta dentro da
    // caixa"*. Encostada, quem arredonda a tira é o recorte do próprio scroller.
    //
    // A régua é o PERFIL: coluna a coluna a partir da borda, a tira tem de
    // começar mais TARDE perto do canto e nivelar depois do raio. Um perfil
    // chapado é o canto quadrado de volta.
    const perfil = await (async () => {
      const cx = await pg.evaluate(async () => {
        const z = (ms) => new Promise((f) => setTimeout(f, ms));
        const el = document.getElementById('lyricsViewBody');
        el.scrollTop = 300; await z(300);
        const r = el.getBoundingClientRect(); const c = getComputedStyle(el);
        return { padTop: r.top + parseFloat(c.borderTopWidth),
          padLeft: r.left + parseFloat(c.borderLeftWidth),
          raio: parseFloat(c.borderTopLeftRadius) };
      });
      const img = lerPng(await pg.screenshot());
      const mag = (c) => !!c && c[0] > 200 && c[1] < 80 && c[2] > 200;
      const col = [];
      for (let d = 0; d <= 12; d++) {
        const x = Math.round(cx.padLeft) + d;
        let y0 = null;
        for (let y = Math.floor(cx.padTop) - 4; y < Math.floor(cx.padTop) + 30; y++) {
          if (mag(pixel(img, x, y))) { y0 = y - cx.padTop; break; }
        }
        col.push(y0 == null ? null : Math.round(y0));
      }
      return { raio: cx.raio, col };
    })();
    checar(perfil.raio >= 6 && perfil.col[0] != null && perfil.col[0] >= 3
      && perfil.col[12] === 0 && perfil.col.every((v, i, a) => i === 0 || (v != null && v <= a[i - 1])),
      'L · ' + tema + ': no scroller de canto ARREDONDADO (raio ' + perfil.raio + 'px) a '
      + 'tira segue a curva — ela começa mais tarde no canto e nivela depois do raio, '
      + 'porque encostada ela é RECORTADA pelo arco em vez de parar quadrada dentro dele',
      JSON.stringify(perfil));
    await ctx.close();
  }

  // ── K. A SOMBRA ALCANÇA A BARRA DA COLEÇÃO — O DEFEITO Nº 5 ───────────
  //
  // Relato do operador: *"a sombra parece estar escurecendo muito mais o fundo
  // do que os cards das coleções. veja se não está mal localizada a camada da
  // sombra"*. Ele está certo. MEDIDO na mesma linha de pixel, a 26px de
  // distância: a `.coll-group-bar` lia razão **1,0000** (delta ZERO, nos dois
  // temas) e o fundo ao lado dela lia 1,1553 — porque ela é `sticky` com
  // `z-index: 4` e a tira era 2.
  //
  // A v1.5.16 pôs a tira embaixo DE PROPÓSITO, para que ela se calasse sob uma
  // tampa grudada. O que derruba aquele argumento é que `z-index` é propriedade
  // do ELEMENTO e não do estado "colada": a barra é z 4 no meio da lista e na
  // borda de baixo, onde não exerce papel de tampa nenhum. Numa lista feita de
  // barras, a sombra só alcançava os VÃOS.
  {
    const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
    await semRedeExterna(ctx);
    await ctx.addInitScript(() => { try { localStorage.setItem('av.appMode', 'full'); } catch (_) { /* modo padrão */ } });
    const pg = await ctx.newPage();
    await pg.goto(base, { waitUntil: 'load' });
    await esperarCortina(pg);
    await pg.waitForFunction(() => window.AVDB && !!document.querySelector('.lib-bar'), null, { timeout: 30000 });
    const alvo = await pg.evaluate(async () => {
      const faixas = (n, pre) => Array.from({ length: n }, (_, i) => ({
        id_music: pre + (i + 1), track: i + 1, name: 'Faixa ' + (i + 1),
        duration: '3:00', has_instrumental_music: false }));
      collState['hymnal-2022'] = { indexSyncedAt: Date.now(), isHymnal: true, songs: faixas(120, 'h') };
      albumCatalog.categories = [{ name: 'Álbuns', albums: [{ id_album: 77, name: 'Álbum' }] }];
      albumCatalog.albums = [{ id_album: 77, name: 'Álbum' }];
      collState['album-77'] = { indexSyncedAt: Date.now(), songs: faixas(20, 'a') };
      grupoAberto = 'Álbuns';
      ui('album-77').expanded = true; ui('album-77').shown = 1000;
      openHymnSearch(false);
      hymnResultsEl.innerHTML = '';
      renderCollectionsList(hymnResultsEl, () => {}, { semTotal: true });
      await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
      const el = document.getElementById('hymnResults');
      el.scrollTop = Math.floor(el.scrollHeight / 2);
      await new Promise((f) => setTimeout(f, 400));
      const r = el.getBoundingClientRect();
      const y = Math.round(r.top + 8);
      const x = Math.round(r.left + r.width / 2);
      const topo = document.elementsFromPoint(x, y)[0];
      return { x, y, quem: (topo && topo.className || '').toString().split(' ')[0],
        z: topo ? getComputedStyle(topo.closest('.coll-group-bar, .coll-bar') || topo).zIndex : 'auto',
        rola: el.scrollHeight - el.clientHeight > 2 };
    });
    const foto = async () => lerPng(await pg.screenshot());
    const comTira = await foto();
    await pg.addStyleTag({ content: '.rola::before,.rola::after{display:none!important}' });
    await pg.waitForTimeout(200);
    const semTira = await foto();
    const razao = (x, y) => {
      const a = luminancia(pixel(semTira, x, y)); const b = luminancia(pixel(comTira, x, y));
      return +((a + 0.05) / (b + 0.05)).toFixed(4);
    };
    const naBarra = razao(alvo.x, alvo.y + 2);
    const controle = razao(alvo.x, alvo.y + 300);
    checar(alvo.rola && /coll-group-bar|coll-bar|row-name|hymn/.test(alvo.quem) && Number(alvo.z) >= 3,
      'K · a faixa da tira de cima cai sobre uma BARRA de coleção `sticky` com '
      + 'z-index próprio — sem isso a asserção abaixo não mede camada nenhuma',
      JSON.stringify(alvo));
    checar(controle === 1,
      'K · o CONTROLE fora da faixa não muda (razão ' + controle + ') — sem ele, '
      + 'qualquer diferença entre as duas capturas passaria por sombra',
      JSON.stringify({ controle }));
    checar(naBarra > 1.05,
      'K · e a barra da coleção ESCURECE sob a tira (razão ' + naBarra + '). Ela lia '
      + '1,0000 enquanto a tira era `z-index: 2`, abaixo dos 3/4 das barras `sticky` '
      + '— numa lista feita de barras a sombra só alcançava os vãos',
      JSON.stringify({ naBarra, controle, alvo }));
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


  // ── M. O CRONOGRAMA VAI ATÉ A BORDA DA TELA (v1.8.60) ───────────────────
  //
  // Relato do operador: *"no cronograma, verifique a largura da caixa do
  // scroll, que não está indo até as bordas da tela"*. A tira é filha do
  // scroller e `overflow-y: auto` COMPUTA `overflow-x: auto`: a margem negativa
  // que a alarga é RECORTADA pela caixa dele, e por isso a tira SÓ alcança a
  // borda se o scroller alcançar. Este bloco mede a caixa e o PIXEL da tira,
  // porque medir só `--veu-esq`/`--veu-dir` aprovaria o candidato que já foi
  // recusado por medição (forçá-los a 12,8 não move um pixel).
  //
  // E ele mede a SEGUNDA metade junto: com uma folha aberta a tira se cala. As
  // folhas cobrem o Cronograma menos a moldura de 12,8px, e a tira alargada
  // passava a pintar exatamente ali — 1004px de tira ao lado de uma folha que
  // já responde por tudo que está sob ela.
  {
    const ctx = await navegador.newContext({
      viewport: { width: 390, height: 900 }, hasTouch: true, colorScheme: 'dark',
    });
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    await pg.goto(base, { waitUntil: 'load' });
    await esperarCortina(pg);
    await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      setAppMode('full'); await z(150);
      for (let i = 0; i < 40; i++) {
        await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
          { name: 'Louvor ' + i, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      }
      await load(); await z(350);
      const s = document.createElement('style');
      s.textContent = '.rola::before,.rola::after{background:#ff00ff!important;background-image:none!important}';
      document.head.appendChild(s);
      const el = document.getElementById('library');
      el.scrollTop = Math.floor(el.scrollHeight / 3);
      await z(350);
    });
    const geo = await pg.evaluate(() => {
      const el = document.getElementById('library');
      const r = el.getBoundingClientRect();
      const linha = el.querySelector('.row');
      const lr = linha ? linha.getBoundingClientRect() : null;
      return { esq: +r.left.toFixed(2), dir: +(innerWidth - r.right).toFixed(2),
        largura: +r.width.toFixed(2), tela: innerWidth,
        transborda: el.scrollHeight - el.clientHeight > 2,
        linhaEsq: lr ? +lr.left.toFixed(2) : null,
        linhaLarg: lr ? +lr.width.toFixed(2) : null,
        cabecalho: +document.querySelector('.list-header').getBoundingClientRect().left.toFixed(2),
        rodape: +document.getElementById('listFoot').getBoundingClientRect().left.toFixed(2),
        pagina: [document.body.scrollWidth, document.documentElement.scrollWidth] };
    });
    const mag = (c) => !!c && c[0] > 200 && c[1] < 80 && c[2] > 200;
    const imgM = lerPng(await pg.screenshot());
    // A linha da tira de cima: 8px abaixo do topo da caixa, no meio dela.
    const yTira = await pg.evaluate(() =>
      Math.round(document.getElementById('library').getBoundingClientRect().top) + 8);
    let tEsq = null, tDir = null;
    for (let x = 0; x < imgM.w; x++) if (mag(pixel(imgM, x, yTira))) { tEsq = x; break; }
    for (let x = imgM.w - 1; x >= 0; x--) if (mag(pixel(imgM, x, yTira))) { tDir = x; break; }
    checar(geo.transborda && geo.linhaEsq === 12.8,
      'M · a cena tem o Cronograma TRANSBORDANDO e a LINHA continua recuada '
      + '(12,8px) — sem as duas o bloco não mede o conserto, mede outra coisa',
      JSON.stringify(geo));
    checar(geo.esq === 0 && geo.dir === 0 && geo.largura === geo.tela,
      'M · a caixa do Cronograma vai de borda a borda da tela — ela rolava de '
      + '12,80 a 377,20 com os 12,8px vindo do `padding` do `<main>`, enquanto a '
      + 'Biblioteca e a playlist já carregavam o recuo como padding próprio',
      JSON.stringify(geo));
    checar(tEsq === 0 && tDir === imgM.w - 1,
      'M · e a TIRA PINTADA vai com ela, medida em pixel — forçar `--veu-esq`/'
      + '`--veu-dir` sem mover o scroller não move a tira um pixel (medido: '
      + '13..376, idêntica), porque a margem negativa é recortada pela caixa dele',
      JSON.stringify({ tEsq, tDir, largura: imgM.w, yTira }));
    // O CABEÇALHO SAIU DOS 12,8 NA v1.8.61, E ISSO É DECISÃO DECLARADA, não um
    // número a corrigir de passagem. A v1.8.60 escreveu por extenso que ele
    // ficava onde estava enquanto a CAIXA da lista ia à borda; o relato seguinte
    // pediu que ele virasse *"uma barra de mesma cor da seção dos controles,
    // para que o corte do scroll faça sentido"*, e uma barra que começa 12,8px
    // depois da borda não descreve a fronteira de uma lista que vai de 0 a `w`.
    // Ele passou a 0 pelo mesmo movimento do `#library`: margem negativa e o
    // recuo devolvido como `padding`. O RODAPÉ continua em 12,8 — ele é a faixa
    // das três portas, não uma fronteira.
    checar(geo.cabecalho === 0 && geo.rodape === 12.8
      && geo.pagina[0] === geo.tela && geo.pagina[1] === geo.tela,
      'M · o CABEÇALHO acompanha a caixa e vai de borda a borda (a barra da '
      + 'v1.8.61), o rodapé das portas continua recuado, e a PÁGINA não ganha '
      + 'rolagem horizontal — o transbordo de 12,8px do `.list-body` é recortado '
      + 'por `main { overflow: hidden }`', JSON.stringify(geo));
    // A SEGUNDA METADE: com a folha aberta, a tira se cala.
    const comFolha = await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      abrirFerramentas(); await z(400);
      const el = document.getElementById('library');
      return { antes: getComputedStyle(el, '::before').display,
        depois: getComputedStyle(el, '::after').display,
        folhaAberta: !document.getElementById('toolsSheet').hidden };
    });
    const semFolha = await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      __avBack(); await z(450);
      const el = document.getElementById('library');
      el.scrollTop = Math.floor(el.scrollHeight / 3); await z(300);
      return { depois: getComputedStyle(el, '::after').display,
        folhaAberta: !document.getElementById('toolsSheet').hidden };
    });
    checar(comFolha.folhaAberta && comFolha.antes === 'none' && comFolha.depois === 'none',
      'M · com uma FOLHA aberta a tira do Cronograma se cala — alargada e sem '
      + 'esta guarda ela pinta 1004px ao LADO da folha, na moldura de 12,8px que '
      + 'a folha não cobre', JSON.stringify(comFolha));
    checar(!semFolha.folhaAberta && semFolha.depois === 'block',
      'M · e ela VOLTA ao fechar a folha — sem esta metade a guarda passaria '
      + 'apagando a tira para sempre, que é o oposto do lote',
      JSON.stringify(semFolha));
    await ctx.close();
  }

  // ── N. NÃO HÁ BARRA DE ROLAGEM, E ISSO É MEDIDO ONDE ELA APARECERIA ────
  //
  // A v1.8.60 padronizou a barra; a v1.8.61 a tirou, a pedido do operador
  // (*"simplesmente deixe sem nenhuma barra de rolagem"*), depois de medir que a
  // sombra só cobre o polegar a partir de FORA do scroller — 240 de 240 linhas,
  // contra 149 de 240 de dentro, e `z-index: 2147483647` não move um pixel.
  // Levar a tira para fora custaria o recorte do arco (o acabamento pedido na
  // v1.8.59) e geometria em JS em 11 dos 15 scrollers, por um efeito visível em
  // 1,6% das posições de rolagem.
  //
  // ESTE BLOCO É O ÚNICO DO REPOSITÓRIO QUE LIGA `comBarraDeRolagem`, e continua
  // sendo por uma armadilha de método: o Playwright passa `--hide-scrollbars` em
  // headless, então nos outros 101 oráculos NENHUMA barra é desenhada e nenhuma
  // reserva um pixel. Uma asserção de "não há barra" escrita com o arnês cru
  // passaria sem medir nada — ela diria que o runner não desenha, não que o app
  // não pede. Aqui a barra é ligada no MOTOR, e é o app que tem de calá-la.
  {
    const nav2 = await abrirNavegador({ comBarraDeRolagem: true });
    try {
      const ctx = await nav2.newContext({
        viewport: { width: 390, height: 900 }, hasTouch: true, colorScheme: 'dark',
      });
      await semRedeExterna(ctx);
      const pg = await ctx.newPage();
      await pg.goto(base, { waitUntil: 'load' });
      await esperarCortina(pg);
      await cena(pg);
      const n = await pg.evaluate(() => {
        const rolas = [...document.querySelectorAll('.rola')];
        const rec = rolas.map((el) => {
          const c = getComputedStyle(el);
          return {
            id: el.id || el.className.split(' ')[0],
            calha: +(el.offsetWidth - el.clientWidth
              - parseFloat(c.borderLeftWidth) - parseFloat(c.borderRightWidth)).toFixed(2),
            transborda: el.scrollHeight - el.clientHeight > 2,
            largura: c.scrollbarWidth,
          };
        });
        // A CENA PRECISA TER SCROLLER QUE TRANSBORDA, senão não há barra a
        // desenhar e o zero abaixo sairia por vacuidade.
        return { n: rolas.length, transbordando: rec.filter((r) => r.transborda).length,
          comCalha: rec.filter((r) => r.calha > 0.5), fora: rec.filter((r) => r.largura !== 'none') };
      });
      // O CONTROLE DO MOTOR: com a barra ligada, um scroller SEM a marca tem de
      // reservar calha. Sem esta linha, um `--hide-scrollbars` que voltasse
      // faria o bloco inteiro passar dizendo o contrário do que mediu.
      const motor = await pg.evaluate(async () => {
        const d = document.createElement('div');
        d.style.cssText = 'position:fixed;left:-9999px;width:200px;height:100px;overflow-y:scroll';
        d.innerHTML = '<div style="height:400px"></div>';
        document.body.appendChild(d);
        await new Promise((f) => requestAnimationFrame(f));
        const calha = d.offsetWidth - d.clientWidth;
        d.remove();
        return calha;
      });
      checar(motor >= 8,
        'N · o MOTOR desta execução desenha barra de rolagem (calha ' + motor + 'px '
        + 'numa caixa sem a marca) — sem isso o zero abaixo mediria o '
        + '`--hide-scrollbars` do runner, não o app', JSON.stringify({ motor }));
      checar(n.transbordando >= 3,
        'N · e a cena tem scroller TRANSBORDANDO de verdade (' + n.transbordando
        + ' de ' + n.n + ') — sobre listas que cabem não há barra a calar',
        JSON.stringify(n));
      checar(n.comCalha.length === 0 && n.fora.length === 0,
        'N · NENHUM scroller marcado desenha barra nem reserva calha, com o motor '
        + 'desenhando: a barra saiu inteira na v1.8.61 e a sombra ficou como '
        + 'indicador único', JSON.stringify(n));
      await ctx.close();
    } finally { await nav2.close(); }
  }

  // ── O. A GRADE DE LIVROS DA BÍBLIA DEIXOU DE SER O SCROLLER (v1.8.60) ───
  //
  // Ela escrevia `tem-abaixo` e não pintava nada: era `display: grid`, e o
  // `sem-veu` (bloco F) a excluía com razão — o pseudo de uma grade é ITEM
  // dela. O app já sabia que havia livro escondido e não tinha como dizer.
  // MEDIDO a 360×640, a medida clássica do Android: 24 dos 66 livros fora da
  // dobra, sem um pixel de aviso.
  //
  // O bloco mede as TRÊS coisas que separam o conserto aprovado dos dois
  // recusados: a tira PINTA, a grade NÃO SE MEXE (dar `grid-column: 1/-1` ao
  // pseudo desce a primeira célula de y=0 para y=32) e a rolagem NÃO CRESCE
  // (aquele mesmo candidato cobrava 10px de rolagem fantasma).
  {
    const ctx = await navegador.newContext({
      viewport: { width: 360, height: 640 }, hasTouch: true, colorScheme: 'dark',
    });
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    await pg.goto(base, { waitUntil: 'load' });
    await esperarCortina(pg);
    const b = await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      setAppMode('full'); await z(150);
      const s = document.createElement('style');
      s.textContent = '.rola::before,.rola::after{background:#ff00ff!important;background-image:none!important}';
      document.head.appendChild(s);
      abrirBiblia(); await z(700);
      const rolo = document.querySelector('.bible-books-rolo');
      const grade = document.querySelector('.bible-grid--books');
      if (!rolo || !grade) return { erro: 'sem rolo ou sem grade', rolo: !!rolo, grade: !!grade };
      const rr = rolo.getBoundingClientRect();
      const c0 = grade.children[0].getBoundingClientRect();
      return {
        marcaNoRolo: rolo.classList.contains('rola'),
        marcaNaGrade: grade.classList.contains('rola'),
        semVeu: rolo.classList.contains('sem-veu'),
        temAbaixo: rolo.classList.contains('tem-abaixo'),
        depois: getComputedStyle(rolo, '::after').display,
        esconde: rolo.scrollHeight - rolo.clientHeight,
        fantasma: rolo.scrollHeight - grade.getBoundingClientRect().height,
        primeira: [+(c0.left - rr.left).toFixed(1), +(c0.top - rr.top).toFixed(1)],
        porLinha: [...grade.children]
          .filter((c) => Math.abs(c.getBoundingClientRect().top - c0.top) < 2).length,
        total: grade.children.length,
        caixa: { esq: +rr.left.toFixed(2), dir: +rr.right.toFixed(2),
          base: +rr.bottom.toFixed(2) },
      };
    });
    const imgO = lerPng(await pg.screenshot());
    const magO = (c) => !!c && c[0] > 200 && c[1] < 80 && c[2] > 200;
    let pintou = 0;
    if (!b.erro) {
      const yy = Math.round(b.caixa.base) - 8;
      for (let x = Math.round(b.caixa.esq); x < Math.round(b.caixa.dir); x++) {
        if (magO(pixel(imgO, x, yy))) pintou++;
      }
    }
    checar(!b.erro && b.esconde > 40 && b.temAbaixo && b.total === 66,
      'O · a cena esconde livro de verdade (' + b.esconde + 'px de ' + b.total
      + ') e o app JÁ escreve `tem-abaixo` — é essa a contradição do achado: o '
      + 'veredito existia e não pintava nada', JSON.stringify(b));
    checar(b.marcaNoRolo && !b.marcaNaGrade && !b.semVeu && b.depois === 'block',
      'O · quem rola é o ENVELOPE e a marca `rola` mora nele; a grade fica grade '
      + 'e o pseudo volta a ser filho de um flex, então `sem-veu` não a alcança',
      JSON.stringify(b));
    checar(pintou > 200,
      'O · e a tira PINTA de verdade na base (' + pintou + 'px de largura) — a '
      + 'asserção é de PIXEL porque a de classe já passava antes do conserto',
      JSON.stringify({ pintou, caixa: b.caixa }));
    checar(b.primeira[0] === 0 && b.primeira[1] === 0 && b.porLinha === 6
      && Math.abs(b.fantasma) <= 1,
      'O · e a grade NÃO SE MEXE nem cobra rolagem: primeira célula em (0,0), '
      + 'seis por linha, zero de rolagem fantasma. Os dois candidatos de CSS '
      + 'falhavam aqui — o pseudo com `grid-column: 1/-1` descia a primeira '
      + 'célula 32px e cobrava 10px', JSON.stringify(b));
    await ctx.close();
  }

  // ── P. A BARRA DE ROLAGEM É UMA SÓ (v1.8.60) ────────────────────────────
  //
  // Relato do operador: *"também temos o problema de não estar padronizado, tem
  // caixas sem o scroll. como a tela principal do cronograma"*. Três scrollers
  // declaravam a barra visível cada um por si e os dezesseis restantes ficavam
  // no `auto` — MEDIDO no tema escuro, polegar 18,26,33 sobre fundo 33,47,61 =
  // **1,29:1**, contra 6,63:1 no leitor de letra ao lado. Um fator 5,1× de
  // contraste entre duas listas do mesmo app.
  //
  // A asserção é do ESTILO COMPUTADO e não da fonte: uma regra escrita na
  // ordem errada revoga a de outro seletor calada (a pista `--panel` da Bíblia
  // era o caso vivo), e só o computado responde por quem venceu.
  {
    const ctx = await navegador.newContext({
      viewport: { width: 390, height: 900 }, hasTouch: true, colorScheme: 'dark',
    });
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    await pg.goto(base, { waitUntil: 'load' });
    await esperarCortina(pg);
    await cena(pg);
    const p = await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      abrirBiblia(); await z(700);
      const rolas = [...document.querySelectorAll('.rola')];
      const rec = rolas.map((el) => {
        const c = getComputedStyle(el);
        return { id: el.id || el.className.split(' ')[0],
          v: c.scrollbarWidth + ' | ' + c.scrollbarColor };
      });
      return { n: rolas.length, distintos: [...new Set(rec.map((r) => r.v))],
        fora: rec.filter((r) => r.v !== rec[0].v),
        biblia: rec.filter((r) => /bible/.test(r.id)).length };
    });
    checar(p.n >= 14 && p.biblia >= 1,
      'P · a cena tem os scrollers desenhados, a Bíblia entre eles (' + p.n
      + ' marcados) — as três declarações que divergiam moravam justamente na '
      + 'Bíblia, no leitor de letra e no Modo Fácil', JSON.stringify(p));
    // O VALOR MUDOU NA v1.8.61, e a asserção continua sendo a MESMA pergunta:
    // *todo scroller diz a mesma coisa?*. A v1.8.60 padronizou em `thin` com o
    // acento para acabar com 1,29:1 contra 6,63:1 na mesma tela; o relato
    // seguinte pediu a barra SOB a sombra e, medido que de dentro do scroller
    // isso não se faz (149 de 240 linhas contra 240 de 240 por um elemento de
    // fora), escolheu o desfecho que ele mesmo nomeou: *"simplesmente deixe sem
    // nenhuma barra de rolagem"*. A sombra ficou como indicador único.
    checar(p.distintos.length === 1 && /^none \|/.test(p.distintos[0]),
      'P · e TODO scroller marcado computa a MESMA barra — `none` desde a '
      + 'v1.8.61, quando ela saiu inteira. ' + p.fora.length + ' fora do padrão',
      JSON.stringify(p));
    await ctx.close();
  }

  // ── P2. E OS `::-webkit-scrollbar` MORTOS SAÍRAM DA FONTE ───────────────
  //
  // Eram dez regras que não pintavam nada: o Chromium DESLIGA os pseudos
  // `::-webkit-scrollbar*` quando `scrollbar-width` ou `scrollbar-color` tem
  // valor diferente de `auto`, e as quatro folhas que os traziam declaravam o
  // par. MEDIDO com barra clássica no leitor de letra: a calha sai 10px — o
  // valor de `thin` — e não os 7px que o pseudo pedia; devolvendo o par a
  // `auto` ela cai para 7px, que é o pseudo assumindo.
  //
  // A asserção é da FONTE porque o defeito é da fonte: uma regra morta não tem
  // efeito para medir, e é exatamente por isso que ela sobreviveu a vários
  // lotes com um comentário que a creditava pelo efeito de outra coisa.
  {
    const cssP = fs.readFileSync(path.join(RAIZ, 'controle', 'controle.css'), 'utf8');
    // O corte é pelo SELETOR seguido de `{`, nunca por conter a palavra: as
    // linhas de COMENTÁRIO deste mesmo lote citam o pseudo por extenso, e um
    // `[^/*]` de começo de linha casa o ESPAÇO de indentação delas.
    const regras = cssP.split('\n')
      .filter((l) => /^\s*[.#a-zA-Z][^{}]*::-webkit-scrollbar[a-z-]*\s*\{/.test(l));
    checar(regras.length === 0,
      'P2 · nenhuma REGRA `::-webkit-scrollbar` sobrou em controle.css — elas '
      + 'estão desligadas pelo par `scrollbar-*` que as acompanhava, e o '
      + 'comentário que as creditava pelo fim do modo overlay saiu com elas',
      JSON.stringify(regras));
    checar(/^\.rola \{ scrollbar-width: none; \}$/m.test(cssP),
      'P2 · e a declaração é UMA, na marca — um segundo `scrollbar-width` num '
      + 'seletor de mesma especificidade decidiria por ORDEM na folha, que é o '
      + 'acoplamento invisível que a v1.8.60 existiu para não deixar nascer');
  }

  // ── Q. AS TRÊS PORTAS FLUTUAM, E A LISTA CORRE POR BAIXO (v1.8.61) ──────
  //
  // Pedido do operador: *"ajuste os 3 botões de bíblia, importar e ferramentas,
  // para que sejam botões flutuantes sobre o cronograma … mas tenha um cuidado,
  // a lista do cronograma deve ter uma margem adicionada ao seu final dentro do
  // scroll, para que ao rolar a lista até o fim, o último item na base não fique
  // abaixo desses botões"*.
  //
  // AS TRÊS ASSERÇÕES SÃO O PEDIDO INTEIRO, e a do meio é de PIXEL porque só ela
  // vê o cuidado: com a lista estendida e o recuo de antes, 58 a 61% da última
  // linha ficam COBERTOS — e a geometria não denuncia isso, porque a linha
  // continua "dentro" da caixa.
  {
    const ctx = await navegador.newContext({
      viewport: { width: 390, height: 900 }, hasTouch: true, colorScheme: 'dark',
    });
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    await pg.goto(base, { waitUntil: 'load' });
    await esperarCortina(pg);
    await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      setAppMode('full'); await z(150);
      for (let i = 0; i < 40; i++) {
        await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
          { name: 'Louvor ' + i, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      }
      await load(); await z(400);
    });
    const geo = await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      const lib = document.getElementById('library');
      const foot = document.getElementById('listFoot');
      const corpo = document.querySelector('.list-body');
      lib.scrollTop = lib.scrollHeight; await z(400);
      const l = lib.getBoundingClientRect(), f = foot.getBoundingClientRect();
      const c = document.querySelector('.bottombar').getBoundingClientRect();
      const linhas = [...lib.querySelectorAll('.row')];
      const ult = linhas[linhas.length - 1].getBoundingClientRect();
      return {
        posicao: getComputedStyle(foot).position,
        // A LISTA ALCANÇA A BARRA, e desde a v1.8.63 a régua é o TOPO DELA e
        // não a base do `.list-body`: *"essa margem é onde está o fim do scroll
        // do cronograma, no caso alinhado com a base dos botões flutuantes e
        // não no topo da barra de buscas"*. Os dois números coincidiam até
        // aquele lote, e o que os separava eram os 5,59px do `--vao-barra`.
        alcanca: +(c.top - l.bottom).toFixed(2),
        // E as portas continuam onde estavam.
        footTop: +f.top.toFixed(2), footH: +f.height.toFixed(2),
        // O recuo do fim é LIDO do rodapé, nunca transcrito.
        rodapeH: corpo.style.getPropertyValue('--rodape-h'),
        recuo: getComputedStyle(lib).paddingBottom,
        // ...e desde a v1.8.63 ele é MARGEM DO ÚLTIMO ITEM, não `padding` do
        // scroller — é essa troca que tira o clamp do `sticky` (ver o bloco U).
        margemUltimo: getComputedStyle(lib.lastElementChild).marginBottom,
        folga: +(f.top - ult.bottom).toFixed(2),
        ultima: [Math.round(ult.left), Math.round(ult.top),
          Math.round(ult.right), Math.round(ult.bottom)],
      };
    });
    checar(geo.posicao === 'absolute' && Math.abs(geo.alcanca) <= 1,
      'Q · o rodapé das três portas FLUTUA e a lista corre por baixo dele até o '
      + 'TOPO DA BARRA DE BUSCAS (vão ' + geo.alcanca + 'px) — era a base das '
      + 'portas, 5,59px acima, e aquela faixa de `--bg` era o que o operador via',
      JSON.stringify(geo));
    checar(parseFloat(geo.rodapeH) === geo.footH && geo.recuo === '0px'
      && parseFloat(geo.margemUltimo) > geo.footH,
      'Q · e a folga do fim é MARGEM DO ÚLTIMO ITEM, não `padding` do scroller '
      + '(v1.8.63) — continua LIDA da altura do rodapé, e é essa troca de lugar '
      + 'que tira o clamp do `sticky`. `--hit-foot` é um piso de 42px e o rodapé '
      + 'o excede com o corpo de fonte do sistema (46,59 com a raiz em 24px)',
      JSON.stringify(geo));
    // A ASSERÇÃO DE PIXEL: nenhum ponto da última linha muda quando as portas
    // somem — isto é, nenhum pixel dela está debaixo delas.
    const comPortas = lerPng(await pg.screenshot());
    await pg.addStyleTag({ content: '#listFoot { visibility: hidden !important; }' });
    await pg.waitForTimeout(250);
    const semPortas = lerPng(await pg.screenshot());
    let cobertos = 0, amostras = 0;
    for (let y = geo.ultima[1] + 1; y < geo.ultima[3] - 1; y++) {
      for (let x = geo.ultima[0] + 1; x < geo.ultima[2] - 1; x += 3) {
        const a = pixel(comPortas, x, y), b = pixel(semPortas, x, y);
        if (!a || !b) continue;
        amostras++;
        if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) cobertos++;
      }
    }
    checar(amostras > 500 && cobertos === 0,
      'Q · e a ÚLTIMA LINHA fica INTEIRA à vista: zero de ' + amostras + ' pixels '
      + 'dela mudam quando as portas somem. Com o recuo de antes eram 58 a 61% — '
      + 'e a geometria não acusa, porque a linha continua dentro da caixa',
      JSON.stringify({ cobertos, amostras, folga: geo.folga }));
    await ctx.close();
  }

  // ── R. O CABEÇALHO É UMA BARRA, E O CORTE ENCOSTA NELA (v1.8.61) ────────
  //
  // Pedido do operador: *"ajuste o cabeçalho do cronograma, para que ele seja
  // uma barra de mesma cor da seção dos controles. para que o corte do scroll do
  // cronograma faça sentido. pode deixar esse layout apenas para o modo
  // avançado"*.
  //
  // A COR É MEDIDA NO RENDERIZADO e comparada com a caixa de controles — ler o
  // nome do token provaria que alguém escreveu `--bar`, não que as duas pintam
  // igual. E o `.deck` não pinta nada (`rgba(0,0,0,0)`): quem carrega a cor da
  // caixa é a `.bottombar` em volta dela, e foi assim que o token foi achado.
  for (const tema of ['dark', 'light']) {
    const ctx = await navegador.newContext({
      viewport: { width: 390, height: 900 }, hasTouch: true, colorScheme: tema,
    });
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    await pg.goto(base, { waitUntil: 'load' });
    await esperarCortina(pg);
    await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      setAppMode('full'); await z(150);
      for (let i = 0; i < 40; i++) {
        await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
          { name: 'Louvor ' + i, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      }
      await load(); await z(400);
      document.getElementById('library').scrollTop = 300; await z(300);
    });
    const r = await pg.evaluate(() => {
      const cab = document.querySelector('.list-header');
      const c = cab.getBoundingClientRect();
      const lib = document.getElementById('library');
      const l = lib.getBoundingClientRect();
      // AS AMOSTRAS SÃO NA MOLDURA, e não no meio: no meio da barra mora o
      // título ("CRONOGRAMA") e no meio da caixa de controles mora o transporte
      // — ali o pixel mede a FONTE, com franja de antialias, e não a superfície.
      // Os dois recuos laterais são de 12,8px, então x=4 está dentro do recuo
      // dos dois e fora de qualquer conteúdo.
      return { x: 4, yCab: Math.round(c.bottom - 4),
        yBarra: Math.round(document.querySelector('.bottombar').getBoundingClientRect().top + 6),
        esq: +c.left.toFixed(2), larg: +c.width.toFixed(2), tela: innerWidth,
        // A BORDA DE BAIXO DA BARRA É A BORDA DO SCROLLPORT: é isso que faz o
        // corte "fazer sentido" — a linha some encostada nela, e não no meio de
        // uma faixa de fundo.
        vao: +(l.top - c.bottom).toFixed(2),
        simple: document.body.classList.contains('mode-simple') };
    });
    const img = lerPng(await pg.screenshot());
    const cor = pixel(img, r.x, r.yCab);
    const corControles = pixel(img, r.x, r.yBarra);
    const igual = cor && corControles
      && Math.abs(cor[0] - corControles[0]) <= 1
      && Math.abs(cor[1] - corControles[1]) <= 1
      && Math.abs(cor[2] - corControles[2]) <= 1;
    checar(igual,
      'R · ' + tema + ': o cabeçalho pinta a MESMA cor RENDERIZADA da caixa de '
      + 'controles — medido em pixel, não pelo nome do token (o `.deck` não pinta '
      + 'nada; quem carrega a cor é a barra em volta)',
      JSON.stringify({ cabecalho: cor, controles: corControles }));
    checar(r.esq === 0 && r.larg === r.tela && Math.abs(r.vao) <= 1,
      'R · ' + tema + ': e ela é uma BARRA — de borda a borda da tela, com a '
      + 'lista começando encostada nela (vão ' + r.vao + 'px). Uma barra que '
      + 'começa 12,8px depois da borda não descreve a fronteira de uma lista que '
      + 'vai de 0 a `w`', JSON.stringify(r));
    await ctx.close();
  }

  // ── S. A FOLHA DA PLAYLIST AUTOMÁTICA NÃO MUDA DE TAMANHO (v1.8.61) ─────
  //
  // Pedido do operador: *"integre isso nas opções de quantidade, afinal a única
  // diferença é quantidade. assim também resolvemos o problema do tamanho da
  // janela ficar se alterando… elas devem ter tamanho fixo sempre que possível,
  // para não ficar movendo a posição relativa de seus botões na tela,
  // atrapalhando o toque"*.
  //
  // ERAM QUATRO MOTORES, e fundir o modo na quantidade sozinho PIORAVA o
  // problema: a linha "Quantas" ausente funcionava como CONTRAPESO dos outros
  // três, e sem ela a diferença aparecia inteira (medido, 3,4× pior a 430×932
  // com a fonte a 1,5× e a biblioteca não baixada). Os quatro: a linha "Quantas"
  // (44,4px), a nota do segmento (39,1px), a conta a três linhas (17,7px) e o
  // rótulo do primário quebrando em duas (16,0px).
  //
  // A ASSERÇÃO VARRE A FONTE DO SISTEMA porque três dos quatro só aparecem com
  // ela: uma medição a 1× diria zero sobre uma folha que pula.
  for (const [w, h] of [[320, 740], [390, 900], [430, 900]]) {
    const ctx = await navegador.newContext({
      viewport: { width: w, height: h }, hasTouch: true, colorScheme: 'dark',
    });
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    await pg.goto(base, { waitUntil: 'load' });
    await esperarCortina(pg);
    const r = await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      setAppMode('full'); await z(200);
      // O ACERVO É PLANTADO, e sem ele este bloco tem um ponto cego: a CONTA é
      // um dos quatro motores do pulo, e as frases dela dependem de quantas
      // faixas estão baixadas ("todas já baixadas — toca na hora" contra
      // "nenhuma baixada ainda — vai baixar antes de tocar"). Com o pool vazio
      // todas as onze células dizem "nada casa" e a conta não varia — a
      // asserção passaria por VÁCUO sobre o motor que ela veio medir.
      collState['hymnal-2022'] = { songs: Array.from({ length: 12 }, (_, i) => ({
        id_music: 'h' + i, track: i + 1, name: 'Louvor de Natal ' + i,
        duration: '3:00', has_instrumental_music: true,
        fileIdFull: i < 4 ? 'f-h' + i : null, fileIdPlayback: null,
      })) };
      albumCatalog = { categories: [], albums: [] };
      await abrirSorteio(); await z(600);
      const folha = () => +document.querySelector('#sorteioPopup .popup-sheet')
        .getBoundingClientRect().height.toFixed(1);
      const rodape = () => +document.querySelector('#sorteioPopup .popup-fecho')
        .getBoundingClientRect().top.toFixed(1);
      // O RÓTULO DO PRIMÁRIO, medido nas MESMAS células (v1.8.62): ele é um só
      // ("Tocar agora") e a pergunta é se ele CABE — o par curto que ele
      // substitui existia por causa da largura.
      const rotulo = () => {
        const el = document.querySelector('#sorteioPopup .song-menu-go .song-menu-label');
        return { txt: el.textContent, corta: el.scrollWidth > el.clientWidth + 0.5 };
      };
      const rotulos = [];
      const porEscala = {};
      for (const fs of [16, 20.8, 24]) {
        document.documentElement.style.fontSize = fs + 'px';
        const alturas = [], topos = [];
        for (const q of AVSorteio.QUANTIDADES) {
          sorteioPrefs.quantos = q; renderSorteio(); await z(90);
          alturas.push(folha()); topos.push(rodape());
          rotulos.push({ fs, ...rotulo() });
        }
        for (const v of [AVSorteio.VARIANTE_CANTADA, AVSorteio.VARIANTE_PLAYBACK]) {
          sorteioPrefs.variante = v; renderSorteio(); await z(90);
          alturas.push(folha()); topos.push(rodape());
          rotulos.push({ fs, ...rotulo() });
        }
        // E A PALAVRA TEMA, que é o QUARTO motor: a conta troca de frase a cada
        // tecla, e a 320px ela vai a TRÊS linhas sem palavra nenhuma. O
        // `min-height` dela reservava DUAS desde a v5.306, com a razão escrita
        // (*"sem altura fixa os botões de fecho subiriam e desceriam embaixo do
        // dedo"*) — o reservado é que estava abaixo do medido.
        for (const t of ['', 'natal', 'zzzznadaaqui']) {
          sorteioPrefs.tema = t; renderSorteio(); await z(90);
          alturas.push(folha()); topos.push(rodape());
          rotulos.push({ fs, ...rotulo() });
        }
        sorteioPrefs.tema = '';
        porEscala[fs] = { folha: +(Math.max(...alturas) - Math.min(...alturas)).toFixed(2),
          rodape: +(Math.max(...topos) - Math.min(...topos)).toFixed(2) };
      }
      document.documentElement.style.fontSize = '';
      // E a faixa de fecho tem UMA altura só.
      const fecho = document.querySelector('#sorteioPopup .popup-fecho');
      const bs = [...fecho.querySelectorAll('button')]
        .map((b) => +b.getBoundingClientRect().height.toFixed(1));
      return { porEscala, alturasBotoes: bs, n: bs.length, rotulos };
    });
    const piores = Object.values(r.porEscala);
    checar(piores.every((p) => p.folha <= 1 && p.rodape <= 1),
      'S · ' + w + 'px: a folha NÃO muda de tamanho entre os onze estados que o '
      + 'operador alcança, nas TRÊS escalas de fonte — e o rodapé dela não se '
      + 'move. Media 101 a 140px de deslocamento',
      JSON.stringify(r.porEscala));
    checar(r.n === 4 && new Set(r.alturasBotoes).size === 1,
      'S · ' + w + 'px: e os QUATRO botões da faixa de fecho têm a mesma altura — '
      + 'o primário tinha CINCO alturas diferentes conforme a fonte e o rótulo, '
      + 'contra os 42,4px fixos dos quadrados',
      JSON.stringify(r.alturasBotoes));
    // ── O RÓTULO É UM SÓ, E CABE (v1.8.62) ────────────────────────────────
    //
    // Pedido do operador: *"ajuste o botão de 'sortear' e 'tocar' para que seja
    // uma única versão, pois literalmente faz a mesma coisa 'Tocar agora'"*. O
    // par `fila ? 'Tocar' : 'Sortear'` dizia com duas palavras o que o campo
    // "Quantas" logo acima já diz com um número.
    const nomes = [...new Set(r.rotulos.map((x) => x.txt))];
    checar(nomes.length === 1 && nomes[0] === 'Tocar agora',
      'S · ' + w + 'px: o primário tem UM rótulo só em todas as ' + r.rotulos.length
      + ' células — "Tocar agora", o mesmo verbo da faixa de fecho de uma mídia '
      + 'comum', JSON.stringify(nomes));
    // ELE É MAIOR QUE O PAR QUE SUBSTITUI, e por isso a asserção é de LARGURA e
    // não de texto. MEDIDO: 95px a 1×, 123 a 1,3× e 142 a 1,5×, contra os 121,8
    // que sobram ao primário a 320×1,3 — o limite fica declarado, e ele é o
    // MESMO 320px que a v1.8.61 já declarava para "Sortear", um degrau de fonte
    // abaixo. Foi para 390 e 430 caberem nas três escalas que o recuo
    // horizontal do primário saiu (ver a regra da faixa com irmãos).
    const cortadas = r.rotulos.filter((x) => x.corta);
    if (w >= 390) {
      checar(cortadas.length === 0,
        'S · ' + w + 'px: e ele NÃO reticencia em nenhuma das ' + r.rotulos.length
        + ' células, nas TRÊS escalas de fonte do sistema — media 11 a 1,5×',
        JSON.stringify(cortadas.slice(0, 3)));
    } else {
      checar(cortadas.every((x) => x.fs > 16),
        'S · ' + w + 'px: ele cabe inteiro com a fonte do sistema em 1× — acima '
        + 'dela os três quadrados crescem com a raiz e o rótulo reticencia, que é '
        + 'o limite DECLARADO desta largura', JSON.stringify(cortadas.map((x) => x.fs)));
    }
    await ctx.close();
  }

  // ── T. AS PORTAS SÃO O DENIM CHEIO, E CADA UMA TEM SOMBRA PRÓPRIA (v1.8.62) ─
  //
  // Pedido do operador, em duas metades: *"quero eles em azul, o mesmo azul de
  // ativado dos botões das configurações, cuide que eles lá são semi
  // transparentes, mas aqui devem ser sólidos"* e *"coloque sombra individual
  // para cada botão, para aumentar a sensação de sobreposição desses botões"*.
  //
  // TRÊS ASSERÇÕES, e a terceira é de PIXEL porque a sombra é a única das três
  // que a folha de estilo não prova: `box-shadow` declarado é `box-shadow`
  // declarado, e um valor com a DIREÇÃO errada (a do resto do app, para baixo)
  // cairia inteiro fora da tela — abaixo das portas está a fronteira com os
  // controles, e não há um pixel para escurecer.
  for (const tema of ['dark', 'light']) {
    const ctx = await navegador.newContext({
      viewport: { width: 390, height: 900 }, hasTouch: true, colorScheme: tema,
    });
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    await pg.goto(base, { waitUntil: 'load' });
    await esperarCortina(pg);
    const r = await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      setAppMode('full'); await z(150);
      for (let i = 0; i < 40; i++) {
        await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
          { name: 'Louvor ' + i, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      }
      await load(); await z(400);
      const lib = document.getElementById('library');
      lib.scrollTop = 200; await z(400);
      const foot = document.getElementById('listFoot');
      const portas = [...foot.querySelectorAll('.lib-foot-btn, .import-btn, .tools-btn')];
      const raiz = getComputedStyle(document.documentElement);
      const corpo = document.querySelector('.list-body').getBoundingClientRect();
      const meio = portas[1].getBoundingClientRect();
      return {
        n: portas.length,
        token: raiz.getPropertyValue('--surface-porta').trim(),
        // O TILE ACESO, RENDERIZADO — a régua da cor desde a v1.8.63.
        tile: (() => {
          const e = document.getElementById('temaTile');
          return e && e.classList.contains('qs-on')
            ? { bg: getComputedStyle(e).backgroundColor, cor: getComputedStyle(e).color } : null;
        })(),
        fundos: [...new Set(portas.map((b) => getComputedStyle(b).backgroundColor))],
        tracos: [...new Set(portas.map((b) => getComputedStyle(b).color))],
        sombras: [...new Set(portas.map((b) => getComputedStyle(b).boxShadow))],
        // A tira e a fronteira, para a asserção U.
        tiraBase: getComputedStyle(lib, '::after').bottom,
        tiraAlt: getComputedStyle(lib, '::after').height,
        temAbaixo: lib.classList.contains('tem-abaixo'),
        corpoBottom: +corpo.bottom.toFixed(1),
        barTop: +document.querySelector('.bottombar').getBoundingClientRect().top.toFixed(1),
        veuBase: getComputedStyle(lib).getPropertyValue('--veu-base').trim(),
        libLeft: +lib.getBoundingClientRect().left.toFixed(1),
        padLeft: parseFloat(getComputedStyle(lib).paddingLeft),
        libBottom: +lib.getBoundingClientRect().bottom.toFixed(1),
        meio: [Math.round(meio.left), Math.round(meio.top), Math.round(meio.right)],
      };
    });
    const rgb = (c) => c.match(/\d+/g).slice(0, 3).map(Number);
    const contraste = (a, b) => {
      const [x, y] = [luminancia(rgb(a)), luminancia(rgb(b))].sort((p, q) => q - p);
      return +((x + 0.05) / (y + 0.05)).toFixed(2);
    };
    // O AZUL É O DO TILE, e a régua é o TILE RENDERIZADO (v1.8.63, revogando a
    // v1.8.62, que exigia o denim cheio). O operador: *"eu queria o azul mais
    // claro, o mesmo nos cards de tema, rotação, exportar"*. O token é um ALIAS
    // (`var(--btn-accent)`) porque os dois temas têm valores OPOSTOS — um
    // literal digitado aqui daria a cor certa num tema e um bloco branco no
    // outro. A identidade COMPOSTA mora no 9-B do `ferramentas-folha`; aqui
    // basta a declarada, que é o que o token entrega.
    checar(r.n === 3 && r.fundos.length === 1 && !!r.tile
      && r.fundos[0] === r.tile.bg,
      'T · ' + tema + ': as TRÊS portas vestem o MESMO azul do `.qs-tile.qs-on`, '
      + 'lido do tile e não escrito aqui',
      JSON.stringify(r.fundos) + ' vs ' + (r.tile && r.tile.bg) + ' · ' + r.token);
    checar(r.tracos.length === 1 && !!r.tile && r.tracos[0] === r.tile.cor
      && contraste(r.fundos[0], r.tracos[0]) >= 4.5,
      'T · ' + tema + ': e o traço é o MESMO do tile (`--accent`), com '
      + contraste(r.fundos[0], r.tracos[0]) + ':1 — o `--on-accent` da v1.8.62 é '
      + 'o par do DENIM e mede 1,21:1 sobre o azul claro',
      JSON.stringify(r.tracos) + ' vs ' + (r.tile && r.tile.cor));
    // A SOMBRA, POR PIXEL: ela tem de ESCURECER a faixa logo ACIMA da porta.
    const img = lerPng(await pg.screenshot());
    const xm = Math.round((r.meio[0] + r.meio[2]) / 2);
    const base0 = luminancia(pixel(img, xm, r.meio[1] - 18));
    const perto = luminancia(pixel(img, xm, r.meio[1] - 2));
    checar(r.sombras.length === 1 && /-2px 8px/.test(r.sombras[0]) && perto < base0,
      'T · ' + tema + ': cada porta tem a PRÓPRIA sombra, e ela aponta para CIMA '
      + '— é lá que está o que elas cobrem. Medido no meio da porta do meio: '
      + perto.toFixed(4) + ' colado nela contra ' + base0.toFixed(4) + ' a 18px',
      JSON.stringify(r.sombras));

    // ── U. E A TIRA VOLTOU PARA A FRONTEIRA, COM AS PORTAS POR CIMA (v1.8.62) ─
    //
    // *"você colocou a sombra de corte do scroll acima desses botões, mas ela
    // deve ficar abaixo, na borda com os controles/barra de busca. assim os
    // botões flutuantes ficam sobre a sombra"* — a revogação da v1.8.61.
    //
    // A ASSERÇÃO É GEOMÉTRICA E DE PIXEL, e as duas juntas: o `bottom` provar
    // que a regra saiu não prova que a tira aparece, e é nos dois cotos de
    // 12,8px da moldura que ela sobrevive às portas opacas.
    const fim = Math.round(r.libBottom);
    const pertoDaBorda = luminancia(pixel(img, 2, fim - 2));
    const acimaDaTira = luminancia(pixel(img, 2, fim - 30));
    checar(r.temAbaixo && r.veuBase === '0px' && r.tiraBase === '0px'
      && parseFloat(r.tiraAlt) === 22 && Math.abs(r.libBottom - r.barTop) <= 1,
      'U · ' + tema + ': a tira pousa no padding box, que desde a v1.8.63 vai até '
      + 'o TOPO DA BARRA — e o `--veu-base` é ZERO, porque a folga do fim virou '
      + 'margem do último item. A string `-61,2px` da v1.8.62 era a TRANSCRIÇÃO '
      + 'de um mecanismo que saiu',
      JSON.stringify({ veuBase: r.veuBase, tiraBase: r.tiraBase, libBottom: r.libBottom, barTop: r.barTop }));
    checar(pertoDaBorda < acimaDaTira,
      'U · ' + tema + ': e ela APARECE, na moldura de 12,8px que as portas não '
      + 'cobrem — ' + pertoDaBorda.toFixed(4) + ' a 2px da fronteira contra '
      + acimaDaTira.toFixed(4) + ' acima dela',
      JSON.stringify({ pertoDaBorda, acimaDaTira }));

    // ── A TIRA NO FIM DA ROLAGEM (v1.8.63) ────────────────────────────────
    //
    // ESTA É A ASSERÇÃO QUE FALTAVA, e a ausência dela é o que deixou um salto
    // de 57px nascer sob 63 oráculos verdes: o bloco J mede a tira em
    // `scrollHeight/3`, o MEIO da rolagem, onde o clamp do `sticky` não existe.
    // Relato do operador: *"isso faz ela subir da base no fim da lista"*.
    //
    // A JANELA DE SUBIDA ERA IGUAL AO `padding-bottom` DO SCROLLER (61,2px), e
    // por isso ela varre o RESTO de rolagem, não a posição: resto 3 é a última
    // parada antes de o `acertarVeu` desligar `tem-abaixo` (o limiar é 2px).
    // REVERSÃO MEDIDA (a folga do fim de volta ao `padding` do scroller): os
    // sete valores saem 57,4 · 54,4 · 48,4 · 35,4 · 15,4 · 0,4 · 0,4 e a
    // asserção reprova; com o conserto são sete zeros.
    const vaos = [];
    for (const resto of [3, 6, 12, 25, 45, 70, 200]) {
      await pg.evaluate(async (q) => {
        const z = (ms) => new Promise((f) => setTimeout(f, ms));
        const lib = document.getElementById('library');
        lib.scrollTop = lib.scrollHeight - lib.clientHeight - q;
        await z(220);
      }, resto);
      const foto = lerPng(await pg.screenshot());
      const x = Math.round(r.libLeft) + 2;
      let base = null;
      for (let y = Math.ceil(r.libBottom) + 4; y > 120; y--) {
        const c = pixel(foto, x, y);
        // A TIRA É ESCURA CONTRA O QUE ESTÁ EMBAIXO: a moldura é `--bg` puro, e
        // a sombra é a ÚNICA coisa que pinta ali. A régua é a luminância contra
        // o `--bg` lido 30px acima, e não uma cor plantada: pintar a tira de
        // magenta mede o seletor, não o que a tela mostra.
        if (c && luminancia(c) < acimaDaTira * 0.97) { base = y; break; }
      }
      vaos.push(base == null ? null : +(r.libBottom - base - 1).toFixed(1));
    }
    checar(vaos.every((v) => v != null && v <= 1.5),
      'U · ' + tema + ': e ela NÃO SOBE no fim da rolagem — vão até a fronteira '
      + 'em resto 3/6/12/25/45/70/200px. Media 57,4px no último degrau, porque '
      + 'um `sticky` é recortado pelo bloco contêiner e a folga do fim morava no '
      + '`padding` do scroller', JSON.stringify(vaos));
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
