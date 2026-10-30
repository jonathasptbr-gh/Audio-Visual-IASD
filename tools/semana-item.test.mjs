#!/usr/bin/env node
// ============================================================================
// O "VÍDEO DA SEMANA" COMO ITEM (v1.13.13)
//
// Pedido do operador: *"um item que automaticamente toca o respectivo vídeo da
// semana… cronograma pode ser atemporal"*. Um registro VIRTUAL por série
// (`kind: 'semana'`) que entra no Cronograma, na playlist e nos Favoritos e, ao
// tocar, resolve para o episódio desta semana.
//
//  A. A LINHA no topo do card da série, nos DOIS modos, com a data de agora.
//  B. Pela linha, ADICIONAR AO CRONOGRAMA: um registro `semana`, sem bytes, de id
//     FIXO por série — mandar de novo é "já está", nunca um segundo item.
//  C. O RÓTULO na lista: o nome da série + "vídeo da semana", e embaixo a DATA
//     do episódio que ele toca agora.
//  D. TOCAR com o episódio BAIXADO: o `load` sai com o ARQUIVO do episódio; a
//     linha virtual fica "no ar" e o avanço da playlist acha o lugar dela.
//  E. TOCAR sem o episódio: o caminho do "Tocar agora" (`ytAcao(…, 'tocar')`).
//  F. AINDA NÃO SAIU: avisa e NÃO toca (nem baixa).
//  G. O item virtual NÃO retém o episódio (o coletor o ignora), e sobrevive ao
//     coletor enquanto estiver numa lista.
//  H. O PACOTE o leva como registro de mídia SEM bytes, no grupo da lista.
//
//   node tools/semana-item.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, checar, falhas } from './arnes.mjs';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');

// A PONTE DE MENTIRA, mínima (a mesma do `serie-mantem-a-semana`): a lista de
// episódios é PLANTADA, e o download é interceptado no `ytAcao` do app.
const PONTE = `(() => {
  const comCallId = new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','castTarget','saidaDeAudioAlvo',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','apkProcurar','otaPending','otaApply',
    'otaCheck','otaDiag','ytDiag','farolEstado','ytCanalPlaylists','ytPlaylist','ytDetalhes',
    'areaTransferencia','pacoteDiag','cifraHtml','espelhoRedes','ytMedida']);
  const vazio = { displays: [], listFolder: [], pickDoc: [], ytSearch: [],
    espelhoEstado: { ligado: false, telas: [] }, espelhoDiag: {},
    espelhoCertEstado: { temCert: false }, castTarget: { label: 'Tela de teste' },
    farolEstado: { conta: true, ultimo: 0, diag: 'de teste' } };
  const B = {
    shellVersion: () => 82, role: () => 'controle', appVersion: () => '1.98-teste',
    takeShare: () => '', busPost: () => {}, otaConfirm: () => {},
  };
  const nomes = Object.keys(vazio).concat([...comCallId], ['apkInstalar','bgProgress',
    'bgConcluido','captureVolumeKeys','deckDiscard','espelhoDesligar','espelhoLigar','keepAlive',
    'nowPlaying','openCast','abrirSaidaDeAudio','openExternal','systemVolume','temaClaro','ytCancel','ytDiscard',
    'projecaoLocal','compartilharTexto','copiarTexto','telaInteira']);
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      if (!comCallId.has(n)) return undefined;
      const id = args[0];
      if (typeof id === 'string') {
        const v = Object.prototype.hasOwnProperty.call(vazio, n) ? vazio[n] : null;
        setTimeout(() => { try { window.__avResolve(id, v); } catch (_) {} }, 0);
      }
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

const servidor = servirEstatico(raiz);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
await semRedeExterna(ctx);
const pg = await ctx.newPage();

const SERIE = 'serie-provai-vede-2026';
const VID = 'semana-provaievedeoficial-provai-e-vede';

// Os episódios, datados em volta do sábado corrente pela PRÓPRIA régua do app.
const plantar = (comASemana) => pg.evaluate((a) => {
  const coll = allCollections().find((c) => c.id === a.serie);
  const sab = AVSerie.sabadoDaSemana();
  const desloca = (n) => {
    const d = new Date(coll.serie.ano, sab.mes - 1, sab.dia + n);
    return { mes: d.getMonth() + 1, dia: d.getDate() };
  };
  const faixa = (nome, quando) => ({ id_music: nome, name: nome, ytUrl: 'y/' + nome, seconds: 300,
    canal: 'Provai e Vede | Oficial', serieData: quando });
  const songs = [faixa('passada', desloca(-7))];
  if (a.comASemana) songs.push(faixa('semana', desloca(0)));
  collState[a.serie] = { indexSyncedAt: Date.now(), serieDiarioEm: Date.now(), songs };
  return { rotulo: AVSerie.rotuloData(desloca(0)), sab: AVSerie.rotuloData(sab) };
}, { serie: SERIE, comASemana });

// O card aberto, montado pela PRÓPRIA `renderCollectionCard` e posto no documento.
const montarCard = (modo) => pg.evaluate((a) => {
  setAppMode(a.modo);
  document.querySelectorAll('.__card-teste').forEach((n) => n.remove());
  const coll = allCollections().find((c) => c.id === a.serie);
  ui(a.serie).expanded = true; ui(a.serie).shown = 100;
  const li = renderCollectionCard(coll);
  const hospede = document.createElement('ul');
  hospede.className = '__card-teste';
  hospede.appendChild(li);
  document.body.appendChild(hospede);
  const aberto = li.querySelector('.coll-open');
  const linha = aberto && aberto.querySelector('.serie-semana');
  return {
    primeiro: aberto && aberto.firstElementChild ? aberto.firstElementChild.className : '',
    nome: linha ? linha.querySelector('.hymn-name').textContent : null,
    sub: linha ? linha.querySelector('.hymn-sub').textContent : null,
  };
}, { modo, serie: SERIE });

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && window.AVSerie && typeof window.__avBack === 'function',
    null, { timeout: 30000 });
  await esperarCortina(pg);
  // A rede fora: a rotina da semana não baixa nada por conta própria no meio do oráculo.
  await pg.evaluate(() => {
    Object.defineProperty(navigator, 'connection', { value: { type: 'cellular' }, configurable: true });
    window.__cmds = [];
    window.cmd = (c) => { window.__cmds.push(c); };
  });
  const datas = await plantar(true);

  // ── A. A LINHA NO TOPO DO CARD, NOS DOIS MODOS ──────────────────────────
  for (const modo of ['full', 'simple']) {
    const c = await montarCard(modo);
    checar(/serie-semana-lista/.test(c.primeiro) && c.nome === 'Vídeo da semana (sempre o atual)',
      'A · (' + modo + ') a PRIMEIRA linha do card da série é "Vídeo da semana (sempre o atual)"', c);
    checar(c.sub === 'Episódio de ' + datas.rotulo,
      'A · (' + modo + ') e embaixo dela a DATA do episódio que ela toca agora', { c, datas });
  }

  // ── B. PELA LINHA, ADICIONAR AO CRONOGRAMA ───────────────────────────────
  await montarCard('full');
  const adicionar = () => pg.evaluate(async () => {
    const linha = document.querySelector('.__card-teste .serie-semana');
    if (!linha.classList.contains('expanded')) linha.querySelector('.hymn-row').click();
    const rotulos = [...linha.querySelectorAll('.hymn-opcoes .song-menu-label')].map((n) => n.textContent);
    const item = [...linha.querySelectorAll('.hymn-opcoes .song-menu-btn')]
      .find((b) => /Cronograma/.test(b.textContent));
    item.click();
    linha.querySelector('.hymn-opcoes .song-menu-go').click();
    return rotulos;
  });
  const rotulos = await adicionar();
  checar(rotulos.slice(0, 4).join(' | ')
      === 'Tocar agora | Adicionar ao Cronograma | Adicionar à playlist | Favoritar',
    'B · a gaveta da linha tem os destinos de sempre, na ORDEM da tabela `DESTINOS`', rotulos);
  await esperar(pg, (id) => libItems.some((m) => m.id === id), VID, 8000);
  const noCrono = await pg.evaluate(async (id) => {
    const rec = await AVDB.getMediaCru(id);
    return { ids: (await AVDB.listIds('imports')).filter((x) => x === id).length,
      kind: rec && rec.kind, blob: rec ? rec.blob : 'sem', chave: rec && rec.semana && rec.semana.chave };
  }, VID);
  checar(noCrono.ids === 1 && noCrono.kind === 'semana' && noCrono.blob === null
      && noCrono.chave === 'provaievedeoficial-provai-e-vede',
    'B · o Cronograma recebe UM registro `semana`, SEM bytes, de id fixo pela série (sem o ano)', noCrono);
  await adicionar();
  await pg.waitForTimeout(300);
  const deNovo = await pg.evaluate((id) => AVDB.listIds('imports').then((l) => l.filter((x) => x === id).length), VID);
  checar(deNovo === 1, 'B · mandar de novo NÃO duplica: é o "já está" de sempre', deNovo);

  // ── C. O RÓTULO NA LISTA ────────────────────────────────────────────────
  const linhaCrono = () => pg.evaluate((id) => {
    const el = [...document.querySelectorAll('.lib-item[data-id]')].find((n) => n.dataset.id === id
      && !n.closest('.__card-teste'));
    return el ? { nome: el.querySelector('.row-name').textContent, sub: el.querySelector('.row-sub').textContent,
      noAr: el.classList.contains('no-ar') } : null;
  }, VID);
  const c = await linhaCrono();
  checar(c && c.nome === 'Provai e Vede — vídeo da semana' && c.sub.includes('Episódio de ' + datas.rotulo),
    'C · na lista o item é "Provai e Vede — vídeo da semana", com a DATA do episódio de agora embaixo',
    { c, datas });

  // ── D. TOCAR COM O EPISÓDIO BAIXADO ─────────────────────────────────────
  const epId = await pg.evaluate(async () => {
    const r = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'video/mp4' }),
      { name: 'semana', kind: 'video', type: 'video/mp4', youtubeId: 'semana', list: 'serie' });
    const outro = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'video/mp4' }),
      { name: 'depois', kind: 'video', type: 'video/mp4', list: 'playlist' });
    window.__outro = outro.id;
    window.__yt = [];
    window.ytAcao = async (r, d) => { window.__yt.push({ id: r && r.id, d }); };
    return r.id;
  });
  await pg.evaluate(async (id) => {
    await AVDB.listSet('playlist', [id, window.__outro]);
    plItems = await AVDB.listItems('playlist');
    renderPlaylist();
    window.__cmds = [];
    await send(id);
    marcarNoAr();
  }, VID);
  const d = await pg.evaluate(() => ({
    loads: window.__cmds.filter((c) => c.type === 'load').map((c) => c.mediaId),
    yt: window.__yt.length, ancora: ancoraDaFila(), currentId,
  }));
  checar(d.loads.length === 1 && d.loads[0] === epId && d.yt === 0,
    'D · tocar o item com o episódio BAIXADO projeta o ARQUIVO do episódio (o `load` nunca leva o virtual), sem baixar',
    { d, epId });
  checar(d.ancora === VID,
    'D · e a fila continua sabendo que quem está no ar é o item VIRTUAL (`ancoraDaFila`)', d);
  const noAr = await linhaCrono();
  checar(noAr && noAr.noAr, 'D · a linha virtual do Cronograma fica "no ar"', noAr);
  await pg.evaluate(() => { window.__cmds = []; autoAdvance(); });
  await esperar(pg, () => window.__cmds.some((c) => c.type === 'load'), null, 5000);
  const avancou = await pg.evaluate(() => window.__cmds.filter((c) => c.type === 'load').map((c) => c.mediaId));
  const outroId = await pg.evaluate(() => window.__outro);
  checar(avancou[0] === outroId,
    'D · e no fim do episódio a playlist AVANÇA para o item seguinte ao virtual', { avancou, outroId });

  // ── E. TOCAR SEM O EPISÓDIO NO APARELHO ─────────────────────────────────
  await pg.evaluate(async () => {
    // O arquivo do episódio SAI do aparelho: a cena no ar e a prateleira avulsa também o seguram.
    await AVDB.setState('current', null);
    await AVDB.listSet('serie', []);
    await AVDB.listSet('avulsos', []);   // o `send` o pôs na prateleira avulsa
    await AVDB.gcOrfaos();
    window.__yt = []; window.__cmds = [];
  });
  await pg.evaluate((id) => send(id), VID);
  const e = await pg.evaluate(() => ({ yt: window.__yt.slice(),
    loads: window.__cmds.filter((c) => c.type === 'load').length }));
  checar(e.yt.length === 1 && e.yt[0].id === 'semana' && e.yt[0].d === 'tocar' && e.loads === 0,
    'E · sem o episódio no aparelho o toque segue o caminho do "Tocar agora" (`ytAcao(…, \'tocar\')`): baixa e projeta',
    e);

  // ── F. AINDA NÃO SAIU ───────────────────────────────────────────────────
  await plantar(false);
  await pg.evaluate(() => {
    window.__yt = []; window.__cmds = []; window.__verif = 0;
    window.syncCollection = async () => { window.__verif++; return { ok: true }; };
  });
  await pg.evaluate((id) => send(id), VID);
  const f = await pg.evaluate((id) => ({
    nota: (falhaItem.get(id) || {}).texto || '', yt: window.__yt.length, verif: window.__verif,
    loads: window.__cmds.filter((c) => c.type === 'load').length,
    sub: subtituloItem({ id, kind: 'semana', semana: { chave: 'provaievedeoficial-provai-e-vede' } }),
  }), VID);
  checar(f.nota === 'O vídeo desta semana do Provai e Vede ainda não saiu.' && f.yt === 0 && f.loads === 0,
    'F · episódio desta semana AINDA NÃO PUBLICADO: avisa com frase clara e NÃO toca nem baixa', f);
  checar(f.verif === 1, 'F · antes de avisar, procura uma vez na lista do canal (ela pode ser de antes da publicação)', f);
  checar(/ainda não saiu/.test(f.sub), 'F · e o rótulo da lista diz que o desta semana ainda não saiu', f);

  // ── G. O VIRTUAL NÃO RETÉM O EPISÓDIO, E SOBREVIVE NA LISTA ─────────────
  const g = await pg.evaluate(async (id) => {
    const ep = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'video/mp4' }),
      { name: 'semana', kind: 'video', type: 'video/mp4', youtubeId: 'semana', list: 'avulsos' });
    await AVDB.listRemove('avulsos', ep.id);
    await AVDB.gcOrfaos();
    return { ep: !!(await AVDB.getMediaCru(ep.id)), virtual: !!(await AVDB.getMediaCru(id)) };
  }, VID);
  checar(g.ep === false && g.virtual === true,
    'G · o coletor apaga o episódio que nenhuma lista segura (o item virtual NÃO o retém) e mantém o virtual, que está no Cronograma',
    g);

  // ── H. NO PACOTE ────────────────────────────────────────────────────────
  const h = await pg.evaluate(async (id) => {
    const midia = await AVDB.mediaResumo();
    const { porGrupo, bytes } = await pacoteGruposDeMidia(midia);
    const grupos = [...porGrupo].filter(([, ids]) => ids.has(id)).map(([k]) => k);
    return { grupos, noGrupo: grupos.length > 0, bytes: bytes.get(id) };
  }, VID);
  checar(h.noGrupo && h.bytes === 0,
    'H · no `.avpkg` ele viaja como registro de mídia SEM bytes, num grupo da seleção (o Cronograma cai em "Outros itens", como qualquer item dele)', h);
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
