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
          padBottom: r.bottom - parseFloat(c.borderBottomWidth),
          recuoTopo: parseFloat(c.paddingTop), recuoEsq: parseFloat(c.paddingLeft),
          transborda: el.scrollHeight - el.clientHeight > 2,
          extraX: el.scrollWidth - el.clientWidth };
      }, sel);
      if (!cx || !cx.transborda) continue;
      const img = lerPng(await pg.screenshot());
      const mag = (c) => !!c && c[0] > 200 && c[1] < 80 && c[2] > 200;
      const xm = Math.round((cx.padLeft + cx.padRight) / 2);
      let topo = null, fundo = null, esq = null, dir = null;
      for (let y = Math.floor(cx.padTop) - 6; y < Math.ceil(cx.padBottom) + 6; y++) {
        if (mag(pixel(img, xm, y))) { topo = y; break; }
      }
      for (let y = Math.ceil(cx.padBottom) + 6; y > Math.floor(cx.padTop) - 6; y--) {
        if (mag(pixel(img, xm, y))) { fundo = y; break; }
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
    checar(geo.cabecalho === 12.8 && geo.rodape === 12.8
      && geo.pagina[0] === geo.tela && geo.pagina[1] === geo.tela,
      'M · e nada mais se mexe: cabeçalho e rodapé ficam onde estavam e a PÁGINA '
      + 'não ganha rolagem horizontal — o transbordo de 12,8px do `.list-body` é '
      + 'recortado por `main { overflow: hidden }`', JSON.stringify(geo));
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

  // ── N. A TIRA ALCANÇA A BORDA PINTÁVEL, MESMO COM BARRA RESERVANDO ─────
  //
  // Relato do operador: *"a sombra não indo até a borda"*. A medição fechou o
  // caso em duas metades, e as duas precisam estar ditas:
  //
  //  1. **A CALHA É INALCANÇÁVEL.** Onde a barra RESERVA largura, ela sai do
  //     padding box, e o retângulo de recorte de um scroller é o padding box
  //     MENOS a calha: nada que seja filho dele pinta ali, por margem nenhuma.
  //     MEDIDO — somar a calha à margem negativa deixa o vão em 10,0px, igual.
  //     A tentativa foi revertida no mesmo lote (ver o comentário no CSS).
  //  2. **NO APARELHO A CALHA É ZERO.** No Android a barra é SOBREPOSTA e não
  //     reserva um pixel — 18 de 18 scrollers no modelo overlay —, então lá a
  //     tira já vai à borda. O bloco J mede exatamente isso, no motor do arnês.
  //
  // O QUE SOBRA PARA GUARDAR é o que o app decide: mesmo com uma barra comendo
  // a caixa, a tira tem de alcançar a última coluna PINTÁVEL. Sem o `--veu-dir`
  // ela pararia `padding-right` antes disso — 11,2px a mais de faixa clara, em
  // cima do que a barra já leva. Este é o único bloco do repositório que liga
  // `comBarraDeRolagem`: o Playwright passa `--hide-scrollbars` em headless, e
  // todos os outros medem um motor em que a calha é ZERO. Uma asserção de barra
  // escrita com o arnês cru passa sem medir nada.
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
        // O CRONOGRAMA: desde este lote ele tem recuo PRÓPRIO de 12,8px, e é
        // esse número que o `--veu-dir` cancela. Sobre um scroller de recuo
        // zero a asserção passaria com e sem o conserto.
        const el = document.getElementById('library');
        el.scrollTop = Math.floor(el.scrollHeight / 3);
        await z(350);
      });
      const cx = await pg.evaluate(() => {
        const el = document.getElementById('library');
        const c = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const calha = +(el.offsetWidth - el.clientWidth
          - parseFloat(c.borderLeftWidth) - parseFloat(c.borderRightWidth)).toFixed(2);
        return { calha, recuo: parseFloat(c.paddingRight),
          lida: el.style.getPropertyValue('--veu-dir'),
          topo: +r.top.toFixed(2),
          // A última coluna que o scroller pode pintar: a borda direita menos a
          // borda e menos a calha que a barra levou.
          pintavel: +(r.right - parseFloat(c.borderRightWidth) - calha).toFixed(2) };
      });
      const img = lerPng(await pg.screenshot());
      const mag = (c) => !!c && c[0] > 200 && c[1] < 80 && c[2] > 200;
      const y = Math.round(cx.topo) + 8;
      let dir = null;
      for (let x = img.w - 1; x >= 0; x--) if (mag(pixel(img, x, y))) { dir = x; break; }
      checar(cx.calha >= 8 && cx.recuo >= 9,
        'N · a barra RESERVA largura nesta execução (' + cx.calha + 'px) e o '
        + 'scroller tem recuo próprio (' + cx.recuo + 'px) — sem os dois a '
        + 'asserção abaixo passa com e sem o conserto, que é a tautologia que '
        + '`--hide-scrollbars` produzia calada', JSON.stringify(cx));
      checar(parseFloat(cx.lida) === cx.recuo,
        'N · e o `--veu-dir` continua sendo o recuo LIDO do layout, não um '
        + 'número escrito à mão', JSON.stringify(cx));
      checar(dir != null && Math.abs(cx.pintavel - dir - 1) <= 1.5,
        'N · a tira PINTADA alcança a última coluna que o scroller pode pintar '
        + '(vão ' + (dir == null ? 'sem tira' : (cx.pintavel - dir - 1).toFixed(1))
        + 'px). A CALHA em si é inalcançável — o recorte de um scroller é o '
        + 'padding box MENOS ela, medido —, e no Android ela é zero; o que este '
        + 'bloco guarda é que o recuo PRÓPRIO continua cancelado',
        JSON.stringify({ dir, ...cx }));
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
    checar(p.distintos.length === 1 && /^thin \|/.test(p.distintos[0]),
      'P · e TODO scroller marcado computa a MESMA barra, `thin` com o acento: '
      + 'a declaração subiu para a marca `.rola` e as três locais saíram. '
      + p.fora.length + ' fora do padrão', JSON.stringify(p));
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
    checar(/^\.rola \{ scrollbar-width: thin; scrollbar-color: var\(--accent\) transparent; \}$/m.test(cssP),
      'P2 · e a declaração é UMA, na marca — um segundo `scrollbar-color` num '
      + 'seletor de mesma especificidade decide por ORDEM na folha, que é o '
      + 'acoplamento invisível que este lote existe para não deixar nascer');
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
