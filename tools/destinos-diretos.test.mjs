#!/usr/bin/env node
// ============================================================================
// OS DESTINOS EM BOTÕES DIRETOS E AS MINIATURAS SEM "PLAY" (v1.13.33)
//
// Pedido do operador: *"uma linha de botões quadrados, um toque = uma ação, como
// já é no resto do app"* — Tocar agora · Cronograma · playlist · Favoritos ·
// Auxiliar de leitura —, e as miniaturas da lista sem o ▶, que lia como botão.
//
//  A. A FILEIRA CABE a 360 px com a fonte do sistema a 1,25×: cinco quadrados
//     numa linha só, dentro da gaveta, sem se tocar.
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

  // ── A + B. A GAVETA DE UMA MÚSICA, A 360×1,25× ─────────────────────────
  const a = await pg.evaluate(async () => {
    document.documentElement.style.fontSize = (16 * 1.25) + 'px';
    setAppMode('full');
    const c = allCollections().find((x) => x.kind === 'hymnal');
    collState[c.id] = { indexSyncedAt: Date.now(), isHymnal: true, songs: [
      { id_music: 'd1', name: 'Meu Lugar no Mundo', track: 1, has_instrumental_music: true, duration: '3:47' },
    ] };
    const lista = document.createElement('ul');
    lista.className = 'coll-songs';
    lista.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:250';
    document.body.appendChild(lista);
    const li = hymnResultRow(c, collSongs(c.id)[0], null, true);
    lista.appendChild(li);
    li.querySelector('.row').click();
    await new Promise((r) => setTimeout(r, 400));
    const gav = li.querySelector('.hymn-gaveta').getBoundingClientRect();
    const bs = [...li.querySelectorAll('.dest-btn')];
    const cx = bs.map((b) => b.getBoundingClientRect());
    const thumb = li.querySelector('.hymn-play-thumb');
    const r = {
      ordem: bs.map((b) => b.dataset.dest),
      dentro: cx.every((q) => q.left >= gav.left - 0.5 && q.right <= gav.right + 0.5),
      umaLinha: new Set(cx.map((q) => Math.round(q.top))).size === 1,
      quadrados: cx.every((q) => Math.abs(q.width - q.height) <= 0.5 && q.width >= 34),
      semToque: cx.every((q, i) => i === 0 || q.left >= cx[i - 1].right + 1),
      icones: bs.map((b) => {
        const i = b.querySelector('svg, .msym');
        const q = i ? i.getBoundingClientRect() : { width: 0 };
        return Math.round(q.width);
      }),
      tipoMusica: { glifo: (thumb.querySelector('.msym') || {}).textContent || '', tipo: thumb.dataset.tipo },
    };
    lista.remove();
    document.documentElement.style.fontSize = '';
    return r;
  });
  checar(a.ordem.join(' | ') === 'tocar | cronograma | playlist | favoritos | leitura',
    'A · a fileira é "Tocar agora", os três destinos na ordem da tabela e o auxiliar de leitura', a.ordem);
  checar(a.dentro && a.umaLinha && a.semToque,
    'A · a 360 px com a fonte a 1,25× os cinco cabem numa LINHA SÓ, dentro da gaveta e sem se tocar', a);
  checar(a.quadrados,
    'A · e são QUADRADOS de alvo pleno (sem rótulo, as duas dimensões declaradas, ≥ `--hit`)', a);
  checar(a.icones.every((w) => w === 22),
    'A · com o ícone no degrau do transporte (`--icon-md`, 22px) — o svg do auxiliar inclusive', a.icones);
  checar(a.tipoMusica.tipo === 'musica' && a.tipoMusica.glifo === '\ue3a1',
    'B · o quadrado da esquerda de uma MÚSICA é a nota musical — não o ▶, que lia como botão', a.tipoMusica);

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
