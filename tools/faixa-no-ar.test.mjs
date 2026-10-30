#!/usr/bin/env node
// ============================================================================
// A FAIXA DE ÁLBUM QUE ESTÁ NO AR, DESTACADA (v1.13.14)
//
// Pedido do operador (resposta ao §4 do ACHADOS-EM-ABERTO): *"pode considerar que
// quero que seja destacado também"* — e a identidade decidida: *"acender apenas o
// álbum de onde está tocando o item"*. O defeito tinha DUAS metades, e as duas
// entram aqui:
//
//  A. A CLASSE CHEGA, pela ORIGEM do toque: tocar uma faixa DENTRO de um álbum
//     (pela gaveta, o caminho real) acende ELA — e não a MESMA música noutro
//     álbum, nem uma faixa do hinário. Com selo "● No ar" no nome.
//  B. A COR VENCE nos DOIS temas: a faixa no ar resolve a MESMA tinta da
//     `.lib-item.no-ar` canônica (o favorito no ar) e difere da vizinha neutra.
//  C. OUTRA PORTA NÃO ACENDE: a mesma mídia tocada pelo Cronograma/Favoritos (um
//     `send` sem origem) apaga a faixa; uma linha de RESULTADO DA BUSCA (a mesma
//     música, fora do card) não acende nem com a origem casando.
//  D. NO MODO FÁCIL, o toque na faixa (que toca direto) também acende.
//  E. A FILA MANTÉM: repetir a faixa (`repeat: one`, `send(id, true)`) não apaga.
//
//   node tools/faixa-no-ar.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, comModoAvancado, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
await comModoAvancado(ctx);
const pg = await ctx.newPage();
const SECAO = 'Álbuns de teste';

// A cor EFETIVA, composta camada sobre camada (a técnica do `lista-da-biblioteca`):
// `getComputedStyle` devolve o alfa declarado, não o que se vê.
const COMPOR = `
  window.__efetiva = (el) => {
    if (!el) return 'AUSENTE';
    const pilha = [];
    for (let n = el; n; n = n.parentElement) {
      const m = (getComputedStyle(n).backgroundColor.match(/[\\d.]+/g) || []).map(Number);
      if (m.length < 3) continue;
      const a = m.length > 3 ? m[3] : 1;
      if (a === 0) continue;
      pilha.push([m[0], m[1], m[2], a]);
      if (a === 1) break;
    }
    let c = [0, 0, 0];
    for (let k = pilha.length - 1; k >= 0; k--) {
      const [vr, vg, vb, va] = pilha[k];
      c = [vr * va + c[0] * (1 - va), vg * va + c[1] * (1 - va), vb * va + c[2] * (1 - va)];
    }
    return 'rgb(' + c.map(Math.round).join(', ') + ')';
  };`;
const distancia = (a, b) => {
  if (a === 'AUSENTE' || b === 'AUSENTE') return -1;
  const p = (s) => s.match(/\d+/g).map(Number);
  const [x, y] = [p(a), p(b)];
  return Math.max(Math.abs(x[0] - y[0]), Math.abs(x[1] - y[1]), Math.abs(x[2] - y[2]));
};

try {
  await pg.goto(`http://localhost:${servidor.address().port}/controle/`, { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function'
    && !!document.querySelector('.lib-bar'), null, { timeout: 30000 });
  await pg.evaluate(COMPOR);

  // O CENÁRIO: dois álbuns com a MESMA música (`m3`), o hinário, e um favorito.
  // `resolveSongMediaId` é interceptado (a mídia já "está no aparelho") e o `cmd`
  // também: o que se afirma é a MARCAÇÃO, não o telão.
  const montar = (secao) => pg.evaluate(async (secao) => {
    window.cmd = () => {};
    const faixas = (pre) => Array.from({ length: 5 }, (_, i) => ({
      id_music: i === 2 ? 'm3' : pre + (i + 1), track: i + 1, name: 'Faixa ' + pre + (i + 1),
      duration: '3:00', has_instrumental_music: false,
    }));
    collState['hymnal-2022'] = { indexSyncedAt: Date.now(), isHymnal: true, songs: faixas('h') };
    const albs = [{ id_album: 77, name: 'Álbum A' }, { id_album: 78, name: 'Álbum B' }];
    albumCatalog.categories = [{ name: secao, albums: albs }];
    albumCatalog.albums = albs;
    collState['album-77'] = { indexSyncedAt: Date.now(), songs: faixas('a') };
    collState['album-78'] = { indexSyncedAt: Date.now(), songs: faixas('b') };
    if (!window.__midia) {
      window.__midia = (await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
        { name: 'A música', list: 'favs' })).id;
      await recarregarFavoritos();
    }
    window.resolveSongMediaId = async () => window.__midia;
    grupoAberto = secao; favAberto = true;
    for (const id of ['album-77', 'album-78', 'hymnal-2022']) { ui(id).expanded = true; ui(id).shown = 1000; }
    openHymnSearch(false);
    hymnResultsEl.innerHTML = '';
    renderCollectionsList(hymnResultsEl, () => {}, { semTotal: true });
    await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
    return window.__midia;
  }, secao);

  const faixa = (coll, idx) => `[data-song="${coll}:${idx}"]`;
  const ler = () => pg.evaluate(() => {
    const q = (s) => document.querySelector('#hymnResults ' + s);
    const est = (el) => el ? { noAr: el.classList.contains('no-ar'),
      selo: !!el.querySelector('.hymn-name .row-live') } : null;
    return {
      a3: est(q('[data-song="album-77:m3"]')),
      b3: est(q('[data-song="album-78:m3"]')),
      a1: est(q('[data-song="album-77:a1"]')),
      h3: est(q('[data-song="hymnal-2022:m3"]')),
      total: document.querySelectorAll('#hymnResults .hymn-result.no-ar').length,
    };
  });

  const midia = await montar(SECAO);

  // ── A. TOCAR DENTRO DO ÁLBUM A, PELA GAVETA ─────────────────────────────
  await pg.evaluate(async (sel) => {
    const li = document.querySelector('#hymnResults ' + sel);
    li.querySelector('.hymn-row').click();
    await new Promise((r) => setTimeout(r, 50));
    const go = li.querySelector('.hymn-opcoes .song-menu-go');
    go.click();
  }, faixa('album-77', 'm3'));
  await pg.waitForFunction((id) => midiaNoArId === id, midia, { timeout: 8000 });
  // O REDESENHO também tem de nascer aceso (`hymnResultRow` pinta na montagem).
  const redesenhar = () => pg.evaluate(async (secao) => {
    // O `closeHymnSearch` do toque fecha a Biblioteca e recolhe a seção.
    openHymnSearch(false);
    grupoAberto = secao; favAberto = true;
    for (const id of ['album-77', 'album-78', 'hymnal-2022']) { ui(id).expanded = true; ui(id).shown = 1000; }
    hymnResultsEl.innerHTML = '';
    renderCollectionsList(hymnResultsEl, () => {}, { semTotal: true });
    await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
  }, SECAO);
  await pg.waitForTimeout(400);   // o `closeHymnSearch` do toque assenta antes de reabrir
  await redesenhar();
  const a = await ler();
  checar(a.a3 && a.a3.noAr && a.a3.selo,
    'A · tocar a faixa DENTRO do álbum (pela gaveta) acende ELA, com o selo "● No ar" no nome', a);
  checar(a.b3 && !a.b3.noAr && a.h3 && !a.h3.noAr && a.total === 1,
    'A · e SÓ ela: a MESMA música no outro álbum e no hinário não acende — a origem é o álbum do toque', a);

  // ── B. A COR VENCE NOS DOIS TEMAS ───────────────────────────────────────
  for (const tema of ['escuro', 'claro']) {
    // A troca de tema ANIMA o fundo das linhas: sem transição, a cor lida é a final.
    await pg.evaluate((tema) => {
      if (!document.getElementById('__semTransicao')) {
        const st = document.createElement('style'); st.id = '__semTransicao';
        st.textContent = '*, *::before, *::after { transition: none !important; }';
        document.head.appendChild(st);
      }
      document.documentElement.setAttribute('data-tema', tema);
    }, tema);
    const b = await pg.evaluate(({ tema, id }) => {
      const lit = document.querySelector('#hymnResults [data-song="album-77:m3"]');
      const viz = document.querySelector('#hymnResults [data-song="album-77:a2"]');
      const fav = [...document.querySelectorAll('#hymnResults .fav-itens > .lib-item')].find((n) => n.dataset.id === id);
      return { tema: document.documentElement.dataset.tema, noAr: __efetiva(lit), vizinha: __efetiva(viz),
        canonica: __efetiva(fav), favMarcado: !!(fav && fav.classList.contains('no-ar')),
        nome: getComputedStyle(lit.querySelector('.hymn-name')).color,
        nomeFav: fav ? getComputedStyle(fav.querySelector('.row-name')).color : 'AUSENTE' };
    }, { tema, id: midia });
    checar(b.tema === tema && b.favMarcado, 'B0 · (' + tema + ') PREMISSA: o tema pedido, e o favorito (a mesma mídia) marcado pelo caminho real', b);
    checar(distancia(b.noAr, b.canonica) <= 1,
      'B1 · (' + tema + ') a faixa no ar resolve a MESMA tinta da `.lib-item.no-ar` canônica (o favorito no ar)', b);
    checar(distancia(b.noAr, b.vizinha) >= 8,
      'B2 · (' + tema + ') e difere da vizinha neutra do mesmo álbum', b);
    checar(b.nome === b.nomeFav, 'B3 · (' + tema + ') o nome vai na cor do estado, como no favorito', b);
  }
  await pg.evaluate(() => document.documentElement.setAttribute('data-tema', 'escuro'));

  // ── E. A FILA MANTÉM ────────────────────────────────────────────────────
  await pg.evaluate(async (id) => { await send(id, true); marcarNoAr(); }, midia);
  const e = await ler();
  checar(e.a3 && e.a3.noAr, 'E · repetir a faixa pela fila (`send(id, true)`) mantém a faixa acesa', e);

  // ── C. OUTRA PORTA NÃO ACENDE ───────────────────────────────────────────
  await pg.evaluate(async (id) => { await send(id); marcarNoAr(); }, midia);
  const c = await ler();
  checar(c.total === 0 && c.a3 && !c.a3.noAr,
    'C1 · a MESMA mídia tocada por outra porta (Cronograma/Favoritos: um `send` sem origem) não acende faixa de álbum nenhuma', c);
  const c2 = await pg.evaluate((id) => {
    faixaNoAr = { chave: 'album-77:m3', mediaId: id };
    const coll = allCollections().find((x) => x.id === 'album-77');
    const li = hymnResultRow(coll, collSongs('album-77')[2], null, false);
    hymnResultsEl.appendChild(li);
    marcarNoAr();
    const r = { busca: li.classList.contains('no-ar'),
      album: document.querySelector('#hymnResults .coll-songs [data-song="album-77:m3"]').classList.contains('no-ar') };
    li.remove(); faixaNoAr = null; marcarNoAr();
    return r;
  }, midia);
  checar(c2.album === true && c2.busca === false,
    'C2 · uma linha de RESULTADO DA BUSCA (a mesma música, fora do card) não acende, nem com a origem casando — só a do álbum', c2);

  // ── D. NO MODO FÁCIL ────────────────────────────────────────────────────
  await pg.evaluate(() => { setAppMode('simple'); });
  await montar(SECAO);
  await pg.evaluate(async (sel) => {
    midiaNoAr = false; midiaNoArId = ''; faixaNoAr = null;
    downloadConsent = true;   // a pergunta "Baixar a música?" é de quem ainda não baixou
    document.querySelector('#hymnResults ' + sel + ' .hymn-row').click();
  }, faixa('album-78', 'm3'));
  await pg.waitForFunction((id) => midiaNoArId === id && midiaNoAr, midia, { timeout: 8000 });
  await pg.waitForTimeout(400);
  await redesenhar();
  const d = await pg.evaluate(() => {
    marcarNoAr();
    const q = (s) => document.querySelector('#hymnResults ' + s);
    return { b3: q('[data-song="album-78:m3"]').classList.contains('no-ar'),
      a3: q('[data-song="album-77:m3"]').classList.contains('no-ar') };
  });
  checar(d.b3 && !d.a3, 'D · no MODO FÁCIL o toque na faixa (que toca direto) acende ela, e só ela', d);
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
