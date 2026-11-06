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
//  D. (v1.13.36) As opções de um favorito atrás de um `⋮` na fileira de destinos,
//     substituindo-os ao toque; num vídeo sem letra, nada de "Ver a letra".
//  E. (v1.13.36) Uma gaveta aberta por vez na Biblioteca inteira.
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

  // ── D. AS OPÇÕES DE UM FAVORITO ATRÁS DO `⋮`, NA MESMA FILEIRA (v1.13.36) ─
  //
  // O `⋮` é quadrado, fica na ponta direita da fileira de destinos, e tocá-lo
  // SUBSTITUI os destinos pela faixa (excluir · renomear · ↑↓) — e a pergunta
  // de excluir nasce ali dentro. Duas células, e num VÍDEO (sem letra) o "Ver a
  // letra" não aparece: o `⋮` encosta à direita sozinho.
  const medirD = (escala, largura, video) => pg.evaluate(async ({ escala, largura, video }) => {
    document.documentElement.style.fontSize = (16 * escala) + 'px';
    setAppMode('full');
    const m = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: video ? 'video/mp4' : 'audio/mpeg' }),
      { name: video ? 'QUERO OFERTAR' : 'Louvor', kind: video ? 'video' : 'audio', list: 'favs' });
    const m2 = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
      { name: 'Outro', kind: 'audio', list: 'favs' });
    const item = await AVDB.getMedia(m.id);
    // A letra no REGISTRO (o que o `renderItemMenu` lê), como a de uma faixa do acervo.
    if (!video) item.lyrics = [{ time: 0, text: 'Primeira estrofe' }];
    const ul = document.createElement('ul');
    ul.className = 'fav-itens';
    ul.style.cssText = 'position:fixed;top:0;left:0;width:' + largura + 'px;z-index:250';
    document.getElementById('hymnResults').appendChild(ul);
    const li = linhaDeItem(item, { lista: 'favs', pos: 0, total: 2, destinos: ['playlist', 'cronograma'] });
    ul.appendChild(li);
    li.querySelector('.row').click();
    await new Promise((r) => setTimeout(r, 400));
    const fileira = li.querySelector('.dest-botoes');
    const fr = fileira.getBoundingClientRect();
    const visiveis = () => [...fileira.children].filter((b) => b.offsetWidth > 0);
    const mais = fileira.querySelector('.dest-opcoes');
    const mr = mais.getBoundingClientRect();
    const antes = {
      ordem: visiveis().map((b) => b.dataset.dest || b.className.split(' ').pop()),
      quadrado: Math.abs(mr.width - mr.height) <= 0.5 && mr.width >= 34,
      aDireita: Math.abs(mr.right - fr.right) <= 1,
      semFileiraPropria: !li.querySelector('.fav-acoes-row'),
      faixaEscondida: fileira.querySelector('.fav-acoes').offsetWidth === 0,
      cabem: visiveis().every((b) => b.scrollWidth <= b.clientWidth + 0.5),
    };
    mais.click();
    await new Promise((r) => setTimeout(r, 100));
    const faixa = fileira.querySelector('.fav-acoes');
    const fx = faixa.getBoundingClientRect();
    const depois = {
      visiveis: visiveis().map((b) => b.className),
      faixaNaFileira: fx.width > 0 && Math.abs(fx.top - mr.top) <= 1,
      destinosSairam: [...fileira.querySelectorAll('.dest-btn:not(.dest-opcoes), .dest-largo')].every((b) => b.offsetWidth === 0),
      botoes: [...faixa.querySelectorAll('.row-btn')].map((b) => (b.className.match(/row-(excluir|renomear|ordem)/) || [''])[0]),
      maisLigado: li.classList.contains('acoes-abertas'),
    };
    faixa.querySelector('.row-excluir').click();
    await new Promise((r) => setTimeout(r, 150));
    const par = [...faixa.querySelectorAll('.linha-confirma-btn')];
    depois.perguntaNaFileira = par.length === 2
      && par.every((b) => Math.abs(b.getBoundingClientRect().top - mr.top) <= 6 && b.offsetWidth > 0);
    fecharAcoesDaLinha();
    ul.remove();
    await AVDB.listRemove('favs', m.id); await AVDB.listRemove('favs', m2.id);
    document.documentElement.style.fontSize = '';
    return { antes, depois };
  }, { escala, largura, video });
  for (const [escala, largura, nome, video] of [[1.25, 360, '360×1,25×'], [1, 430, '430×1×'],
    [1.25, 360, '360×1,25× · vídeo', true]]) {
    const d = await medirD(escala, largura, video);
    checar(d.antes.semFileiraPropria && d.antes.faixaEscondida && d.antes.quadrado && d.antes.aDireita && d.antes.cabem,
      'D · ' + nome + ' · o favorito tem o botão de OPÇÕES quadrado na ponta direita da fileira de destinos, '
      + 'sem a fileira própria de baixo, e nada cortado', d.antes);
    checar(d.antes.ordem.join(' | ') === (video ? 'tocar | cronograma | playlist | dest-opcoes'
      : 'tocar | cronograma | playlist | leitura | dest-opcoes'),
      'D · ' + nome + ' · ' + (video ? 'num VÍDEO sem letra não há "Ver a letra" apagado' : 'com letra, o "Ver a letra" fica antes dele'),
      d.antes.ordem);
    checar(d.depois.maisLigado && d.depois.destinosSairam && d.depois.faixaNaFileira
      && d.depois.botoes.join(',') === 'row-excluir,row-renomear,row-ordem,row-ordem',
      'D · ' + nome + ' · tocar em opções SUBSTITUI os destinos pela faixa (excluir · renomear · ↑ · ↓) na mesma fileira', d.depois);
    checar(d.depois.perguntaNaFileira,
      'D · ' + nome + ' · e a pergunta de excluir nasce ali, no lugar da fileira', d.depois);
  }

  // ── E. UMA GAVETA ABERTA POR VEZ NA BIBLIOTECA INTEIRA (v1.13.36) ──────
  //
  // O episódio deste sábado mora numa lista PRÓPRIA (o destaque), e o acordeão
  // fechava só as irmãs da mesma `<ul>`: abrir um episódio comum deixava o do
  // sábado aberto. Três listas no `#hymnResults` — o destaque, os episódios e os
  // Favoritos —, e a cada abertura só UMA gaveta fica aberta.
  const e = await pg.evaluate(async () => {
    setAppMode('full');
    const host = document.getElementById('hymnResults');
    const c = { id: 'serie-teste', kind: 'serie', name: 'Série de teste' };
    const ep = (n) => ({ id_music: 'v' + n, name: 'Episódio ' + n, ytUrl: 'https://youtu.be/v' + n, serieData: { mes: 1, dia: n } });
    const dest = document.createElement('ul'); dest.className = 'coll-songs serie-destaque-lista';
    const lista = document.createElement('ul'); lista.className = 'coll-songs';
    const favs = document.createElement('ul'); favs.className = 'fav-itens';
    host.append(dest, lista, favs);
    const a = hymnResultRow(c, ep(1), null, true, { destaque: true }); dest.appendChild(a);
    const b = hymnResultRow(c, ep(2), null, true); lista.appendChild(b);
    const m = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }), { name: 'F', kind: 'audio', list: 'favs' });
    const f = linhaDeItem(await AVDB.getMedia(m.id), { lista: 'favs', pos: 0, total: 1, destinos: ['playlist', 'cronograma'] });
    favs.appendChild(f);
    const espera = () => new Promise((r) => setTimeout(r, 300));
    const abertas = () => [a, b, f].map((x) => x.classList.contains('expanded'));
    a.querySelector('.row').click(); await espera(); const r1 = abertas();
    b.querySelector('.row').click(); await espera(); const r2 = abertas();
    f.querySelector('.row').click(); await espera(); const r3 = abertas();
    a.querySelector('.row').click(); await espera(); const r4 = abertas();
    dest.remove(); lista.remove(); favs.remove();
    await AVDB.listRemove('favs', m.id);
    return { r1, r2, r3, r4 };
  });
  checar(JSON.stringify(e) === JSON.stringify({ r1: [true, false, false], r2: [false, true, false],
    r3: [false, false, true], r4: [true, false, false] }),
    'E · abrir o episódio deste sábado, depois um comum, depois um favorito e de novo o do sábado deixa '
    + 'sempre UMA gaveta aberta na Biblioteca — o destaque e os Favoritos são listas próprias', e);

  await ctx.close();
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
