#!/usr/bin/env node
// ============================================================================
// O SERVIDOR DA BIBLIOTECA INDISPONÍVEL (v1.12.43)
//
// Pedido do operador: *"Precisamos de um sistema de 'o servidor está em
// manutenção', mas esse sistema não deve interferir em quem já tem as listagens
// ou os arquivos offline … deve ser diferenciado de um aviso de 'sem internet',
// pois são coisas diferentes."*
//
// O que este arquivo trava (cada célula falha CALADA sem ele):
//  A. INSTALAÇÃO NOVA, servidor ABORTANDO e internet de pé → veredito
//     `servidor`, o aviso "Servidor da biblioteca indisponível" na Biblioteca
//     (Modo Fácil, como tela principal, e avançado), os botões de baixar
//     APAGADOS com o porquê no `title`, e o download sob demanda nem parte.
//  B. Servidor respondendo 503 (com CORS) → o mesmo veredito, com o status.
//  C. Servidor que NÃO RESPONDE (pendurado) → `servidor` pelo prazo.
//  D. SEM INTERNET (o aparelho offline, e também todos os hosts mudos) → o
//     aviso "Sem internet", DIFERENTE do do servidor.
//  E. INSTALAÇÃO COM A BIBLIOTECA → servidor fora, nada de aviso grande: as
//     coleções listadas, a música baixada resolve sem rede, a Bíblia completa
//     abre o capítulo; só o botão de baixar do que falta fica apagado.
//  F. NADA MAIS É BARRADO: a busca no YouTube continua oferecida, uma mídia
//     local entra no ar.
//  G. O SERVIDOR VOLTA → "Tentar de novo" limpa o aviso, acende os botões e
//     dispara a primeira listagem; a rechecagem automática desliga.
//  H. O Registro e a Verificação dizem o mesmo que a tela.
//
//   node tools/servidor-indisponivel.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperar, esperarCortina, porque, checar, falhas, RAIZ_WEB,
  comModoAvancado,
} from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;
const navegador = await abrirNavegador();
const erros = [];

// O ESTADO DA "REDE" de cada contexto, mudado pelo oráculo no meio do caminho.
//   louvorja: 'abort' | 'pendura' | '503' | 'ok'
//   internet: true (as sondas independentes respondem) | false
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Api-Token',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
};
function respostaOk(url) {
  const nome = (/json_db\/([^?]+)/.exec(url) || [])[1] || '';
  const hino = (id, n) => ({ id_music: id, track: id, name: n, duration: '03:00' });
  let corpo = [];
  if (nome === 'config') corpo = { version_number: 1 };
  else if (nome === 'pt_hymnal') corpo = [hino(101, 'Hino de teste um'), hino(102, 'Hino de teste dois')];
  else if (nome === 'pt_hymnal_1996') corpo = [hino(201, 'Hino antigo')];
  else if (nome === 'pt_categories') {
    corpo = [{ id_category: 1, name: 'Coletânea de teste', order: 1, albums: [{ id_album: 9, name: 'Álbum de teste', order: 1 }] }];
  } else if (nome === 'album_9') corpo = { musics: [hino(901, 'Faixa do álbum')] };
  return { status: 200, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS), body: JSON.stringify(corpo) };
}

async function aparelho(rede, opts = {}) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true });
  await semRedeExterna(ctx);
  if (opts.avancado) await comModoAvancado(ctx);
  const pendurados = [];
  await ctx.route(/louvorja\.com\.br|r2\.dev/, (rota) => {
    const req = rota.request();
    if (rede.louvorja === 'abort') return rota.abort();
    if (rede.louvorja === 'pendura') { pendurados.push(rota); return undefined; }
    if (req.method() === 'OPTIONS') return rota.fulfill({ status: 204, headers: CORS });
    if (rede.louvorja === '503') return rota.fulfill({ status: 503, headers: CORS, body: 'manutencao' });
    return rota.fulfill(respostaOk(req.url()));
  });
  await ctx.route(/youtube\.com|audiovisualiasd\.com\.br/, (rota) => (rede.internet
    ? rota.fulfill({ status: 204, body: '' }) : rota.abort()));
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  if (opts.semente) {
    // A SEMENTE vai ao banco de verdade e o app é recarregado: é a instalação
    // que JÁ tem a biblioteca, lida do disco pelo `init()` como no aparelho.
    await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
    await esperarCortina(pg);
    await pg.evaluate(opts.semente);
    await pg.reload({ waitUntil: 'domcontentloaded' });
  } else {
    await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  }
  await esperarCortina(pg);
  // OFFLINE DEPOIS DA CARGA: o servidor estático do oráculo também é rede, e o
  // `setOffline` antes do `goto` não deixaria a página nem chegar. O que o app
  // vê é o mesmo — `navigator.onLine` falso — e a próxima apuração o lê.
  if (opts.offline) {
    await ctx.setOffline(true);
    // E A APURAÇÃO DA ABERTURA PRIMEIRO: ainda em voo (ela partiu ONLINE), o
    // `apurarFonte` devolve ELA, e o desfecho é o de online — `servidor`, que só
    // a rechecagem de 60 s desfaria (run 2248, sob carga).
    await pg.evaluate(async () => { while (fonteApuracao) await fonteApuracao; await apurarFonte('teste'); });
  }
  return { ctx, pg, pendurados };
}

const veredito = (pg) => pg.evaluate(() => Object.assign({}, fonteVeredito));
const esperarVeredito = (pg, estado, prazo = 25000) => esperar(pg, (e) => fonteVeredito.estado === e, estado, prazo);

// A TELA PRINCIPAL do Modo Fácil (uma tela "conectada", como o `modo-simples-corpo`)
// ou a Biblioteca do avançado.
async function abrirBiblioteca(pg, avancado) {
  if (avancado) await pg.evaluate(() => openHymnSearch(false));
  else await pg.evaluate(() => { webDisplayWin = { closed: false }; renderSimpleCast(); });
  await esperar(pg, () => document.getElementById('hymnSearchPopup').classList.contains('open'), null, 15000);
  await pg.evaluate(() => new Promise((r) => setTimeout(r, 500)));
}
const lerBiblioteca = (pg) => pg.evaluate(() => {
  const aviso = document.querySelector('#fonteAvisoLib');
  const r = aviso ? aviso.getBoundingClientRect() : null;
  const centro = r ? document.elementFromPoint(r.left + r.width / 2, r.top + 12) : null;
  const dls = [...document.querySelectorAll('#hymnResults .coll-bar-dl:not(.coll-bar-rm), #hymnResults .coll-group-btn')];
  return {
    aviso: !!aviso,
    titulo: aviso ? aviso.querySelector('.fonte-aviso-tit').textContent : '',
    texto: aviso ? aviso.querySelector('.fonte-aviso-txt').textContent : '',
    rede: aviso ? aviso.classList.contains('fonte-aviso--rede') : null,
    visivel: !!r && r.height > 0 && r.top < window.innerHeight && r.bottom > 0,
    alcanca: !!centro && aviso.contains(centro),
    fundo: aviso ? getComputedStyle(aviso).backgroundColor : '',
    contorno: aviso ? getComputedStyle(aviso).outlineStyle + '/' + getComputedStyle(aviso).borderTopStyle : '',
    dls: dls.map((b) => ({ desligado: b.disabled, title: b.title, opacidade: getComputedStyle(b).opacity })),
    cards: document.querySelectorAll('#hymnResults .hymnal-card').length,
  };
});

try {
  // ---------------- A · INSTALAÇÃO NOVA, SERVIDOR ABORTANDO ----------------
  let corA;
  {
    const rede = { louvorja: 'abort', internet: true };
    const { ctx, pg } = await aparelho(rede);
    const ok = await esperarVeredito(pg, 'servidor');
    checar(ok === true, 'A1 · instalação nova, servidor abortando e internet de pé → veredito `servidor`',
      porque(ok) || JSON.stringify(await veredito(pg)));
    await abrirBiblioteca(pg, false);
    const l = await lerBiblioteca(pg);
    corA = l.fundo;
    checar(l.aviso && /Servidor da biblioteca indisponível/.test(l.titulo) && !l.rede,
      'A2 · Modo Fácil, Biblioteca como tela principal: o aviso "Servidor da biblioteca indisponível"',
      JSON.stringify(l));
    checar(/não é a internet deste aparelho/i.test(l.texto) && /YouTube/.test(l.texto) && /já está baixado/.test(l.texto),
      'A3 · o texto diz que não é a internet do aparelho e que YouTube, importados e o baixado continuam',
      l.texto);
    checar(l.visivel && l.alcanca, 'A4 · o aviso está À VISTA na tela principal e nada o cobre', JSON.stringify(l));
    checar(l.contorno === 'none/none', 'A5 · sem contorno (a regra da paleta)', l.contorno);
    checar(l.dls.length > 0 && l.dls.every((d) => d.desligado && /Servidor da biblioteca indisponível/.test(d.title)
      && Math.abs(parseFloat(d.opacidade) - 0.35) < 0.01),
    'A6 · os botões de baixar/listar estão APAGADOS (`disabled` + `--op-inativo`) com o porquê no `title`',
    JSON.stringify(l.dls));
    // O DOWNLOAD SOB DEMANDA NEM PARTE: nenhuma ida ao servidor de arquivos.
    const sob = await pg.evaluate(async () => {
      const coll = FIXED_COLLECTIONS[0];
      const s = { id_music: 555, name: 'x', fileIdFull: null, fileIdPlayback: null };
      collState[coll.id] = { indexSyncedAt: 0, songs: [s] };
      const pedidos = [];
      const real = Louvorja.fetchList;
      Louvorja.fetchList = (f) => { pedidos.push(f); return real(f); };
      const id = await resolveSongMediaId(coll, s, 'full');
      Louvorja.fetchList = real;
      collState[coll.id] = { indexSyncedAt: 0, songs: [] };
      return { id, pedidos, motivo: motivoDoCartao() };
    });
    checar(sob.id === null && !sob.pedidos.some((f) => /^music_/.test(f)),
      'A7 · tocar uma música não baixada não pede nada ao servidor fora do ar', JSON.stringify(sob));
    checar(/servidor da biblioteca indisponível/.test(sob.motivo) && /não é a sua internet/.test(sob.motivo),
      'A8 · e a frase do cartão nomeia o servidor, não a internet', sob.motivo);
    const timer = await pg.evaluate(() => !!fonteRechecaTimer);
    checar(timer, 'A9 · com o veredito ruim a rechecagem automática está armada', timer);

    // O AVANÇADO, no mesmo aparelho: a mesma Biblioteca, o mesmo aviso.
    await pg.evaluate(() => { webDisplayWin = null; setAppMode('advanced'); });
    await abrirBiblioteca(pg, true);
    const adv = await lerBiblioteca(pg);
    checar(adv.aviso && /Servidor da biblioteca indisponível/.test(adv.titulo) && adv.visivel,
      'A10 · no avançado a Biblioteca traz o mesmo aviso', JSON.stringify(adv));

    // NUMA BUSCA O AVISO SAI (o YouTube responde ali), e volta com o acervo.
    const busca = await pg.evaluate(async () => {
      document.getElementById('hymnSearchInput').value = 'amor';
      renderSearchResults('amor');
      const naBusca = !!document.getElementById('fonteAvisoLib');
      const yt = document.querySelector('#hymnResults .yt-search-btn, #hymnResults .yt-head');
      document.getElementById('hymnSearchInput').value = '';
      renderSearchResults('');
      return { naBusca, yt: !!yt, volta: !!document.getElementById('fonteAvisoLib') };
    });
    checar(!busca.naBusca && busca.yt && busca.volta,
      'A12 · numa busca o aviso sai e o YouTube segue oferecido; no acervo ele volta', JSON.stringify(busca));

    // A BÍBLIA, numa instalação nova: o capítulo não vem, e o aviso entra no
    // lugar da nota; a lista de versões (vazia) também o traz.
    await pg.evaluate(() => closeHymnSearch());
    const bib = await pg.evaluate(async () => {
      abrirBiblia();
      bibleScreen = 'chapters';
      bibleSel.bookIdx = 0; bibleSel.chapter = 1;
      await loadBibleChapter();
      renderBible();
      const pane = document.querySelector('#bibleBody .fonte-aviso');
      openBibleVerPopup();
      const lista = document.querySelector('#bibleVerList .fonte-aviso');
      closeBibleVerPopup();
      fecharBiblia();
      return { erro: bibleChapterError, pane: pane ? pane.querySelector('.fonte-aviso-tit').textContent : '',
        lista: lista ? lista.querySelector('.fonte-aviso-tit').textContent : '' };
    });
    checar(/Servidor da biblioteca indisponível/.test(bib.pane) && /Servidor da biblioteca indisponível/.test(bib.lista),
      'A11 · na Bíblia sem nada baixado o aviso aparece no capítulo e na lista de versões', JSON.stringify(bib));

    // H · REGISTRO e VERIFICAÇÃO dizem o mesmo
    const reg = await pg.evaluate(async () => { await renderDiag(); return diagTexto; });
    checar(/Servidor da biblioteca \(LouvorJA\)/.test(reg) && /agora: INDISPONÍVEL/.test(reg)
      && /não respondeu|CORS/.test(reg) && /mudanças nesta sessão/.test(reg),
    'H1 · o Registro tem o bloco do servidor: o veredito, a causa e as transições',
    (reg.match(/Servidor da biblioteca[\s\S]{0,400}/) || [''])[0]);
    checar(/servidor da biblioteca \(LouvorJA\): indisponível/.test(reg),
      'H2 · e a transição está na linha do tempo', (reg.match(/servidor da biblioteca \(LouvorJA\)[^\n]*/) || [''])[0]);
    const verif = await pg.evaluate(async () => {
      const c = TESTES.find((x) => x.id === 'fonte-banco');
      const net = TESTES.find((x) => x.id === 'internet');
      return { banco: await rodarUmaChecagem(c), internet: await rodarUmaChecagem(net), estado: fonteVeredito.estado };
    });
    checar(verif.banco.v === 'mudo' && /servidor da LouvorJA não respondeu, e a internet funciona/.test(verif.banco.nota)
      && verif.estado === 'servidor',
    'H3 · a Verificação diz "o servidor não respondeu e a internet funciona" — o mesmo veredito da tela',
    JSON.stringify(verif));
    checar(verif.internet.v === 'ok',
      'H4 · e "Há internet agora" passa: a sonda dela não é a LouvorJA', JSON.stringify(verif.internet));
    await ctx.close();
  }

  // ---------------- B · SERVIDOR RESPONDENDO 503 ----------------
  {
    const rede = { louvorja: '503', internet: true };
    const { ctx, pg } = await aparelho(rede);
    const ok = await esperarVeredito(pg, 'servidor');
    const v = await veredito(pg);
    checar(ok === true && v.status === 503,
      'B1 · o servidor que responde 503 é `servidor`, com o status guardado', JSON.stringify(v));
    await abrirBiblioteca(pg, false);
    const l = await lerBiblioteca(pg);
    checar(l.aviso && /Servidor da biblioteca indisponível/.test(l.titulo) && l.dls.every((d) => d.desligado),
      'B2 · o mesmo aviso e os mesmos botões apagados', JSON.stringify(l));
    const um404 = await pg.evaluate(async () => {
      // UM 404 é sobre UM item: o servidor respondeu.
      const real = window.fetch;
      window.fetch = async () => new Response('', { status: 404 });
      try { await apurarFonte('teste'); } finally { window.fetch = real; }
      return Object.assign({}, fonteVeredito);
    });
    checar(um404.estado === 'ok',
      'B3 · um 404 do banco é o servidor NO AR (não derruba ninguém)', JSON.stringify(um404));
    await ctx.close();
  }

  // ---------------- C · SERVIDOR PENDURADO (sem resposta) ----------------
  {
    const rede = { louvorja: 'pendura', internet: true };
    const { ctx, pg } = await aparelho(rede);
    const ok = await esperarVeredito(pg, 'servidor', 40000);
    const v = await veredito(pg);
    checar(ok === true && /não respondeu em 8 s/.test(v.causa),
      'C1 · o servidor que não responde é `servidor` pelo PRAZO, e a causa diz isso', JSON.stringify(v));
    await ctx.close();
  }

  // ---------------- D · SEM INTERNET ----------------
  {
    const rede = { louvorja: 'abort', internet: true };
    const { ctx, pg } = await aparelho(rede, { offline: true });
    const ok = await esperarVeredito(pg, 'sem-internet');
    checar(ok === true, 'D1 · o aparelho offline é `sem-internet`', porque(ok) || JSON.stringify(await veredito(pg)));
    await abrirBiblioteca(pg, false);
    const l = await lerBiblioteca(pg);
    checar(l.aviso && l.titulo === 'Sem internet' && l.rede === true && /não está conectado à internet/.test(l.texto),
      'D2 · o aviso é "Sem internet", com outra cara', JSON.stringify(l));
    checar(l.fundo !== corA, 'D3 · e não veste a cor do aviso do servidor: são duas coisas', l.fundo + ' × ' + corA);
    checar(l.dls.every((d) => d.desligado && /Sem internet/.test(d.title)),
      'D4 · os botões de baixar dizem "Sem internet"', JSON.stringify(l.dls));
    await ctx.close();
  }
  {
    // Online pela interface, mas NENHUM host responde (o Wi-Fi sem saída).
    const rede = { louvorja: 'abort', internet: false };
    const { ctx, pg } = await aparelho(rede);
    const ok = await esperarVeredito(pg, 'sem-internet');
    checar(ok === true, 'D5 · com a interface "online" e nenhum host respondendo, também é `sem-internet`',
      porque(ok) || JSON.stringify(await veredito(pg)));
    await ctx.close();
  }

  // ---------------- E/F · A BIBLIOTECA JÁ NO APARELHO ----------------
  {
    const rede = { louvorja: 'abort', internet: true };
    const semente = async () => {
      const h = (id, n, f) => ({ id_music: id, track: id, name: n, duration: '03:00', fileIdFull: f || null, fileIdPlayback: null });
      await AVDB.fileAdd({ id: 'f-semente', folder: 'hymnal-2022', name: 'Hino baixado', type: 'audio/mpeg', lyrics: [] });
      await AVDB.setState('coll:hymnal-2022', { indexSyncedAt: Date.now(), songs: [h(1, 'Hino baixado', 'f-semente'), h(2, 'Hino que falta')] });
      await AVDB.setState('coll:hymnal-1996', { indexSyncedAt: Date.now(), songs: [h(3, 'Hino antigo')] });
      await AVDB.setState('albumCatalog', {
        categories: [{ id_category: 1, name: 'Coletânea', order: 1, albums: [{ id_album: 9, subtitle: '', order: 1 }] }],
        albums: [{ id_album: 9, name: 'Álbum de teste' }],
      });
      await AVDB.setState('coll:album-9', { indexSyncedAt: Date.now(), songs: [h(901, 'Faixa')] });
      await AVDB.setState('bibleVersions', [{ id: 7, name: 'Versão de teste' }]);
      await AVDB.setState('bibleVersion', 7);
      await AVDB.setState('bibleComplete:7', true);
      // A VERSÃO INTEIRA (1189 capítulos): a bandeira "completa" é conferida
      // contra o disco na abertura, e uma versão de um capítulo só não passa.
      const grava = [];
      Bible.BOOKS.forEach((b, i) => {
        for (let c = 1; c <= b.chapters; c++) {
          grava.push(AVDB.setState('bible:7_' + (i + 1) + '_' + c,
            { verses: [{ n: 1, text: i === 0 && c === 1 ? 'No princípio' : 'v' }], syncedAt: Date.now() }));
        }
      });
      await Promise.all(grava);
    };
    const { ctx, pg } = await aparelho(rede, { semente, avancado: true });
    const ok = await esperarVeredito(pg, 'servidor');
    checar(ok === true, 'E1 · PREMISSA: o servidor está fora (o tráfego da abertura o descobre)',
      porque(ok) || JSON.stringify(await veredito(pg)));
    await abrirBiblioteca(pg, true);
    // O render que o veredito pede é coalescido: dá-lhe o tempo dele.
    await pg.evaluate(() => new Promise((r) => setTimeout(r, 600)));
    const l = await lerBiblioteca(pg);
    checar(!l.aviso && l.cards >= 2,
      'E2 · quem já tem a listagem vê as coleções e NENHUM aviso grande', JSON.stringify(l));
    checar(l.dls.length > 0 && l.dls.every((d) => d.desligado),
      'E3 · só o botão de baixar o que falta fica apagado (a indicação passiva)', JSON.stringify(l.dls));
    const uso = await pg.evaluate(async () => {
      const coll = FIXED_COLLECTIONS[0];
      const s = collSongs(coll.id).find((x) => x.fileIdFull === 'f-semente');
      const id = s ? await resolveSongMediaId(coll, s, 'full') : 'sem-faixa';
      abrirBiblia();
      bibleSel.bookIdx = 0; bibleSel.chapter = 1;
      await loadBibleChapter();
      return { id, versos: (bibleChapterData && bibleChapterData.verses.length) || 0, erro: bibleChapterError,
        avisoBiblia: !!document.querySelector('#bibleBody .fonte-aviso') };
    });
    checar(uso.id === 'f-semente', 'E4 · a música BAIXADA resolve sem o servidor', JSON.stringify(uso));
    checar(uso.versos === 1 && !uso.erro && !uso.avisoBiblia,
      'E5 · a Bíblia completa abre o capítulo sem aviso nenhum', JSON.stringify(uso));
    const ver = await pg.evaluate(() => {
      openBibleVerPopup();
      return { aviso: !!document.querySelector('#bibleVerList .fonte-aviso'),
        semFonte: document.querySelectorAll('#bibleVerList .sem-fonte').length };
    });
    checar(!ver.aviso && ver.semFonte === 0,
      'E6 · e a lista de versões (toda completa) não ganha aviso nem linha apagada', JSON.stringify(ver));
    await pg.evaluate(() => closeBibleVerPopup());
    await pg.evaluate(() => fecharBiblia());

    // F · NADA MAIS É BARRADO
    const f = await pg.evaluate(async () => {
      document.getElementById('hymnSearchInput').value = 'amor';
      renderSearchResults('amor');
      await new Promise((r) => setTimeout(r, 300));
      const yt = document.querySelector('#hymnResults .yt-search-btn, #hymnResults .yt-head');
      const rec = await AVDB.addMedia(new Blob([new Uint8Array(64)], { type: 'video/mp4' }), {
        name: 'Vídeo local', type: 'video/mp4', kind: 'video', list: 'imports',
      });
      await load();
      await send(rec.id);
      return { yt: !!yt, ytDesligado: !!(yt && yt.disabled), noAr: midiaNoAr,
        avisoNaBusca: !!document.querySelector('#fonteAvisoLib') };
    });
    checar(f.yt && !f.ytDesligado && !f.avisoNaBusca,
      'F1 · a busca continua oferecendo o YouTube, sem aviso por cima', JSON.stringify(f));
    checar(f.noAr === true, 'F2 · uma mídia local entra no ar com o servidor fora', JSON.stringify(f));
    await ctx.close();
  }

  // ---------------- G · O SERVIDOR VOLTA ----------------
  {
    const rede = { louvorja: 'abort', internet: true };
    const { ctx, pg } = await aparelho(rede, { avancado: true });
    await esperarVeredito(pg, 'servidor');
    await abrirBiblioteca(pg, true);
    const antes = await lerBiblioteca(pg);
    checar(antes.aviso, 'G1 · PREMISSA: o aviso está na Biblioteca', JSON.stringify(antes));
    rede.louvorja = 'ok';
    await pg.click('#fonteAvisoLib .fonte-aviso-btn');
    const ok = await esperarVeredito(pg, 'ok');
    checar(ok === true, 'G2 · "Tentar de novo" com o servidor de volta → `ok`', porque(ok));
    const sumiu = await esperar(pg, () => !document.querySelector('#fonteAvisoLib'), null, 10000);
    checar(sumiu === true, 'G3 · o aviso SOME sozinho', porque(sumiu));
    const listou = await esperar(pg, () => collSongs('hymnal-2022').length === 2 && albumCatalog.albums.length === 1,
      null, 15000);
    checar(listou === true, 'G4 · e a primeira listagem acontece na volta (hinários e álbuns)', porque(listou));
    const depois = await pg.evaluate(() => ({ timer: !!fonteRechecaTimer }));
    await pg.evaluate(() => new Promise((r) => setTimeout(r, 600)));
    const l = await lerBiblioteca(pg);
    checar(!depois.timer, 'G5 · a rechecagem automática desliga', JSON.stringify(depois));
    checar(l.dls.every((d) => !d.desligado), 'G6 · os botões de baixar voltam a acender', JSON.stringify(l.dls));
    // A RECHECAGEM SOZINHA: derruba e levanta de novo SEM toque, pelo tique dela.
    rede.louvorja = 'abort';
    await pg.evaluate(() => apurarFonte('teste'));
    await esperarVeredito(pg, 'servidor');
    rede.louvorja = 'ok';
    const sozinho = await pg.evaluate(async () => {
      // O tique do relógio (60 s) é o que chama isto; aqui ele é chamado direto.
      fonteUltimaApuracao = 0;
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r) => setTimeout(r, 50));
      if (fonteApuracao) await fonteApuracao;
      return fonteVeredito.estado;
    });
    checar(sozinho === 'ok', 'G7 · a volta ao app (retomada) pergunta de novo e limpa sozinho', sozinho);
    await ctx.close();
  }

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
