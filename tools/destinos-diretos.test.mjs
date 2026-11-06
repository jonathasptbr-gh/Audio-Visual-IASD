#!/usr/bin/env node
// ============================================================================
// OS DESTINOS EM BOTÕES DIRETOS E AS MINIATURAS SEM "PLAY" (v1.13.34)
//
// Pedido do operador: *"uma linha de botões quadrados, um toque = uma ação, como
// já é no resto do app"* — Tocar agora · Cronograma · playlist · Favoritos ·
// Auxiliar de leitura —, e as miniaturas da lista sem o ▶, que lia como botão.
//
//  A. A FILEIRA: quatro QUADRADOS juntos e o "Ver a letra" LARGO no resto da
//     linha, com o rótulo inteiro, a 360×1,25× e a 430×1× (v1.13.35).
//  B. O QUADRADO DA ESQUERDA DIZ O TIPO: a nota numa música, a fita de filme num
//     vídeo de série — e o item da semana nas listas idem. Nenhum ▶.
//  C. DOIS TOQUES NO MESMO VÍDEO NÃO BAIXAM DUAS VEZES: o `ytArquivo` divide o
//     download em curso (pela forma: vídeo e só-áudio são downloads distintos).
//
//   node tools/destinos-diretos.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperarCortina, checar, falhas, RAIZ_WEB, comModoAvancado,
} from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();

try {
  const ctx = await navegador.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
  await semRedeExterna(ctx);
  await comModoAvancado(ctx);
  const pg = await ctx.newPage();
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 30000 });

  // ── A + B. A GAVETA DE UMA MÚSICA, a 360×1,25× e a 430×1× ───────────────
  //
  // (v1.13.35) Os QUATRO destinos são QUADRADOS e JUNTOS (no `gap` da fileira,
  // sem vão espalhado); o quinto ("Ver a letra") é LARGO, com rótulo, e cresce
  // no resto da linha até a borda da gaveta. O rótulo é medido no BOTÃO (o
  // pai), nunca no span: o span tem o tamanho do próprio texto.
  // QUANDO NÃO CABE AO LADO, ELE DESCE (`flex-wrap`): o rótulo nunca é cortado, e
  // a régua aceita as duas formas — na linha dos quadrados até a borda, OU numa
  // linha só dele de borda a borda. Medido também num VÍDEO, cujo "Ocultar os
  // detalhes" é a frase mais longa da fileira.
  const medirA = (escala, largura, video) => pg.evaluate(async ({ escala, largura, video }) => {
    document.documentElement.style.fontSize = (16 * escala) + 'px';
    setAppMode('full');
    const c = video ? { id: 'serie-teste', kind: 'serie', name: 'Série de teste' }
      : allCollections().find((x) => x.kind === 'hymnal');
    if (!video) collState[c.id] = { indexSyncedAt: Date.now(), isHymnal: true, songs: [
      { id_music: 'd1', name: 'Meu Lugar no Mundo', track: 1, has_instrumental_music: true, duration: '3:47' },
    ] };
    const faixa = video ? { id_music: 'v1', name: 'Episódio', ytUrl: 'https://youtu.be/v1', serieData: { mes: 1, dia: 3 } }
      : collSongs(c.id)[0];
    const lista = document.createElement('ul');
    lista.className = 'coll-songs';
    lista.style.cssText = 'position:fixed;top:0;left:0;width:' + largura + 'px;z-index:250';
    document.body.appendChild(lista);
    const li = hymnResultRow(c, faixa, null, true);
    lista.appendChild(li);
    li.querySelector('.row').click();
    for (let i = 0; i < 40 && !li.querySelector('.dest-botoes'); i++) await new Promise((r) => setTimeout(r, 25));
    await new Promise((r) => setTimeout(r, 400));
    const fileira = li.querySelector('.dest-botoes');
    const fr = fileira.getBoundingClientRect();
    const fcs = getComputedStyle(fileira);
    const dentroDireita = fr.right - (parseFloat(fcs.paddingRight) || 0);
    const dentroEsquerda = fr.left + (parseFloat(fcs.paddingLeft) || 0);
    const gap = parseFloat(fcs.columnGap) || 0;
    const todos = [...fileira.querySelectorAll(':scope > button')];
    const cx = todos.map((b) => b.getBoundingClientRect());
    const quad = cx.slice(0, 4);
    const largo = todos[4]; const lr = cx[4];
    const thumb = li.querySelector('.hymn-play-thumb');
    const r = {
      ordem: todos.map((b) => b.dataset.dest),
      umaLinha: new Set(cx.slice(0, 4).map((q) => Math.round(q.top))).size === 1,
      desceu: !!lr && lr.top >= cx[0].bottom - 0.5,
      quadrados: quad.every((q) => Math.abs(q.width - q.height) <= 0.5 && q.width >= 34),
      quadDeclarados: [...fileira.querySelectorAll('.dest-btn')].length === 4,
      juntos: cx.slice(0, 4).every((q, i) => i === 0 || Math.abs((q.left - cx[i - 1].right) - gap) <= 1)
        && (!lr || lr.top >= cx[0].bottom - 0.5 || Math.abs((lr.left - cx[3].right) - gap) <= 1),
      gap,
      largoLargo: !!lr && lr.width > quad[0].width * 1.5,
      largoAteABorda: !!lr && Math.abs(lr.right - dentroDireita) <= 1
        && (lr.top < cx[0].bottom - 0.5 || Math.abs(lr.left - dentroEsquerda) <= 1),
      mesmaAltura: !!lr && Math.abs(lr.height - quad[0].height) <= 0.5,
      rotulo: largo ? [...largo.querySelectorAll('.song-menu-label > span')].map((x) => x.textContent).join(' / ')
        || largo.textContent.trim() : '',
      // O PAI: o botão não pode estar estourado pelo próprio texto — nos DOIS
      // estados de um vídeo (a frase longa é a de "Ocultar").
      cabe: !!largo && largo.scrollWidth <= largo.clientWidth + 0.5
        && (!video || (largo.click(), largo.scrollWidth <= largo.clientWidth + 0.5)),
      icones: todos.slice(0, 4).map((b) => {
        const i = b.querySelector('svg, .msym');
        return Math.round(i ? i.getBoundingClientRect().width : 0);
      }),
      tipoMusica: { glifo: (thumb.querySelector('.msym') || {}).textContent || '', tipo: thumb.dataset.tipo },
    };
    lista.remove();
    document.documentElement.style.fontSize = '';
    return r;
  }, { escala, largura, video });
  for (const [escala, largura, nome, video] of [[1.25, 360, '360×1,25×'], [1, 430, '430×1×'],
    [1.25, 360, '360×1,25× · vídeo', true], [1, 430, '430×1× · vídeo', true]]) {
    const a = await medirA(escala, largura, video);
    const quinto = video ? 'detalhes' : 'leitura';
    checar(a.ordem.join(' | ') === 'tocar | cronograma | playlist | favoritos | ' + quinto && a.umaLinha,
      'A · ' + nome + ' · a fileira é "Tocar agora" e os três destinos da tabela numa linha, e o quinto por último', a);
    checar(a.quadrados && a.quadDeclarados,
      'A · ' + nome + ' · os QUATRO destinos são QUADRADOS de alvo pleno (sem rótulo, ≥ `--hit`)', a);
    checar(a.juntos,
      'A · ' + nome + ' · e JUNTOS: o vão entre dois botões é o `gap` da fileira (' + a.gap + 'px), sem espalhar', a);
    checar(a.largoLargo && a.largoAteABorda && a.mesmaAltura
      && a.rotulo === (video ? 'Ver os detalhes / Ocultar os detalhes' : 'Ver a letra'),
      'A · ' + nome + ' · o quinto é LARGO, com rótulo, vai até a borda da gaveta (ao lado dos quadrados, ou '
      + 'numa linha só dele, de borda a borda) e tem a altura dos quadrados', a);
    checar(a.cabe,
      'A · ' + nome + ' · e o rótulo dele NÃO é cortado (medido no botão, não no texto)', a);
    checar(a.icones.every((w) => w === 22),
      'A · ' + nome + ' · com o ícone dos quadrados no degrau do transporte (`--icon-md`, 22px)', a.icones);
    if (!video) checar(a.tipoMusica.tipo === 'musica' && a.tipoMusica.glifo === '\ue3a1',
      'B · ' + nome + ' · o quadrado da esquerda de uma MÚSICA é a nota musical — não o ▶, que lia como botão', a.tipoMusica);
  }

  // ── B. NUM VÍDEO DE SÉRIE, E NO ITEM DA SEMANA DAS LISTAS ──────────────
  const b = await pg.evaluate(() => {
    // Uma série SINTÉTICA: sem a ponte o catálogo de séries não existe, e o que
    // se mede é o TIPO, que vem do `kind`.
    const c = { id: 'serie-teste', kind: 'serie', name: 'Série de teste' };
    const s = { id_music: 'v1', name: 'Episódio', ytUrl: 'https://youtu.be/v1', serieData: { mes: 1, dia: 3 } };
    const li = hymnResultRow(c, s, null, true);
    const q = li.querySelector('.hymn-play-thumb');
    document.body.appendChild(li);
    const svg = q.querySelector(':scope > svg');
    const r = {
      tipo: q.dataset.tipo,
      sprite: svg ? svg.querySelector('use').getAttribute('href') : '',
      largura: svg ? Math.round(svg.getBoundingClientRect().width) : 0,
      temPlay: !!q.querySelector('.msym') && q.querySelector('.msym').textContent === '',
    };
    li.remove();
    const t = thumbEl({ id: 'semana-x', kind: 'semana', name: 'X' });
    r.semana = {
      sprite: (t.querySelector('use') || { getAttribute: () => '' }).getAttribute('href'),
      play: [...t.querySelectorAll('.msym')].some((m) => m.textContent === ''),
    };
    return r;
  });
  checar(b.tipo === 'video' && b.sprite === '#icoVideo' && b.largura === 22 && !b.temPlay,
    'B · num VÍDEO de série o quadrado é a fita de filme (`#icoVideo`, 22px), sem ▶', b);
  checar(b.semana.sprite === '#icoVideo' && !b.semana.play,
    'B · e o item da SEMANA nas listas também diz o tipo — a fita, nunca o ▶', b.semana);

  // ── C. O DOWNLOAD EM CURSO É DIVIDIDO ──────────────────────────────────
  const c = await pg.evaluate(async () => {
    const chamadas = [];
    const orig = window.ytBaixarNativo;
    const origYt = AVDB.mediaByYoutube;
    AVDB.mediaByYoutube = async () => null;
    window.ytBaixarNativo = (url, nome, opts) => {
      chamadas.push(!!(opts && opts.somenteAudio));
      return new Promise((ok) => setTimeout(() => ok({ id: 'rec-' + chamadas.length }), 150));
    };
    const alvo = { id: 'vidDup', url: 'https://youtu.be/vidDup', name: 'V' };
    const [r1, r2] = await Promise.all([ytArquivo(alvo, { lista: 'imports' }), ytArquivo(alvo, { lista: 'favs' })]);
    const soVideo = chamadas.length;
    const r3 = await ytArquivo(alvo, { lista: 'imports', somenteAudio: true });
    const depois = await ytArquivo(alvo, { lista: 'imports' });
    window.ytBaixarNativo = orig;
    AVDB.mediaByYoutube = origYt;
    return { soVideo, total: chamadas.length, mesmo: r1 && r2 && r1.id === r2.id, r3: r3 && r3.id, depois: depois && depois.id };
  });
  checar(c.soVideo === 1 && c.mesmo,
    'C · dois toques seguidos no MESMO vídeo (Cronograma e Favoritos) pedem UM download, e os dois '
    + 'recebem o mesmo registro', c);
  checar(c.total === 3 && c.r3 !== c.depois,
    'C · só-áudio é OUTRO download, e acabado o primeiro um pedido novo não fica preso a ele', c);
  await ctx.close();
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
