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
//  I. NO MODO FÁCIL (v1.13.15) os cards das duas séries SAEM da raiz e um bloco
//     "Este sábado" com a data mostra o item de cada série; o toque TOCA. No
//     avançado as coleções seguem. O bloco fica fora da repartição da tampa.
//  J. O NOME NOVO do Provai e Vede chega ao que já estava BAIXADO (só ao que
//     ainda tem o nome automático antigo).
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

  // ── A. A LINHA NO TOPO DO CARD (no AVANÇADO: no Modo Fácil o card da série não
  // existe desde a v1.13.15 — ver o bloco I) ─────────────────────────────────
  for (const modo of ['full']) {
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

  // ── I. NO MODO FÁCIL, O ITEM NA RAIZ NO LUGAR DAS DUAS COLEÇÕES ───────────
  await plantar(true);
  const raizDo = (modo) => pg.evaluate((a) => {
    setAppMode(a.modo);
    const lista = document.createElement('ul');
    lista.className = 'popup-list acervo';
    renderCollectionsList(lista, () => {}, { semTotal: true });
    const cards = [...lista.querySelectorAll('.hymnal-card')].map((n) => n.textContent);
    const bloco = lista.querySelector(':scope > .semana-raiz');
    const linhas = bloco ? [...bloco.querySelectorAll('.semana-raiz-item')].map((n) => ({
      nome: n.querySelector('.hymn-name').textContent, sub: n.querySelector('.hymn-sub').textContent })) : [];
    return {
      serieCard: cards.some((t) => /Provai e Vede|Informativo Mundial/.test(t)),
      hinarios: cards.filter((t) => /Hinário Adventista/.test(t)).length,
      primeiro: lista.firstElementChild ? lista.firstElementChild.className : '',
      rot: bloco ? bloco.querySelector('.serie-destaque-rot').textContent : null,
      data: bloco ? bloco.querySelector('.serie-destaque-data').textContent : null,
      linhas,
    };
  }, { modo });
  const iFacil = await raizDo('simple');
  checar(!iFacil.serieCard,
    'I1 · no MODO FÁCIL nenhum card de coleção do Provai e Vede ou do Informativo na raiz', iFacil);
  checar(/semana-raiz/.test(iFacil.primeiro) && iFacil.rot === 'Este sábado' && iFacil.data === datas.sab,
    'I2 · no lugar deles, o PRIMEIRO bloco da raiz diz "Este sábado" e a DATA do sábado', { iFacil, datas });
  checar(iFacil.linhas.length === 2 && iFacil.linhas[0].nome === 'Provai e Vede'
      && iFacil.linhas[1].nome === 'Informativo Mundial das Missões',
    'I3 · com UMA linha por série — o vídeo da semana de cada uma, direto na raiz', iFacil.linhas);
  checar(iFacil.linhas.length === 2 && iFacil.linhas[0].sub === 'Episódio de ' + datas.rotulo
      && iFacil.linhas[1].sub === 'Aguardando lançamento',
    'I4 · e embaixo de cada uma a data do episódio, ou "Aguardando lançamento" quando ele não saiu',
    iFacil.linhas);
  checar(iFacil.hinarios === 2, 'I5 · os dois hinários continuam cards da raiz', iFacil);
  const iAvancado = await raizDo('full');
  checar(iAvancado.serieCard && !/semana-raiz/.test(iAvancado.primeiro) && iAvancado.linhas.length === 0,
    'I6 · no AVANÇADO as duas séries continuam COLEÇÕES, e o bloco da raiz não existe', iAvancado);

  // O TOQUE TOCA: com o arquivo no aparelho, o `load` sai com o arquivo do episódio.
  const epI = await pg.evaluate(async () => {
    const r = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'video/mp4' }),
      { name: 'semana', kind: 'video', type: 'video/mp4', youtubeId: 'semana', list: 'imports' });
    window.__yt = []; window.__cmds = [];
    return r.id;
  });
  const toque = await pg.evaluate(async () => {
    setAppMode('simple');
    const lista = document.createElement('ul');
    lista.className = 'popup-list acervo';
    renderCollectionsList(lista, () => {}, { semTotal: true });
    document.body.appendChild(lista);
    const row = lista.querySelector('.semana-raiz-item .hymn-row');
    const gaveta = !!lista.querySelector('.semana-raiz-item .hymn-gaveta');
    row.click();
    for (let i = 0; i < 50 && !window.__cmds.some((c) => c.type === 'load'); i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    lista.remove();
    return { gaveta, loads: window.__cmds.filter((c) => c.type === 'load').map((c) => c.mediaId),
      yt: window.__yt.length, ancora: ancoraDaFila() };
  });
  checar(!toque.gaveta && toque.loads.length === 1 && toque.loads[0] === epI && toque.yt === 0
      && toque.ancora === VID,
    'I7 · tocar a linha da raiz TOCA o vídeo desta semana na hora (sem gaveta de destinos), pelo item virtual',
    { toque, epI });

  // A TAMPA, NA BIBLIOTECA DE VERDADE (a `#hymnResults` do Modo Fácil com tela conectada, onde
  // ela é a tela principal): o bloco tem a altura do CONTEÚDO, e a sobra vai aos cards fechados.
  // CINCO SEÇÕES de coletâneas: a lista APERTA (a tampa fica abaixo do teto), que é a célula em
  // que contar o bloco fixo na repartição faria os cards crescerem além da sobra — com poucos
  // blocos a tampa bate no teto e a asserção passaria com e sem a regra.
  await pg.evaluate(() => {
    const faixas = (pre) => Array.from({ length: 4 }, (_, i) => ({ id_music: pre + i, track: i + 1,
      name: 'Faixa ' + i, duration: '3:00', has_instrumental_music: false }));
    albumCatalog.categories = Array.from({ length: 5 }, (_, i) => ({ name: 'Coletânea ' + (i + 1),
      albums: [{ id_album: 900 + i, name: 'Álbum ' + i }] }));
    albumCatalog.albums = albumCatalog.categories.map((c) => c.albums[0]);
    for (const c of albumCatalog.categories) {
      collState['album-' + c.albums[0].id_album] = { indexSyncedAt: Date.now(), songs: faixas('a' + c.albums[0].id_album) };
    }
    setAppMode('simple');
    webDisplayWin = { closed: false };
    renderSimpleCast();
    renderSearchResults('');
  });
  await esperar(pg, () => {
    const j = document.getElementById('hymnSearchPopup');
    const l = document.getElementById('hymnResults');
    return j.classList.contains('open') && !j.getAnimations().some((a) => a.playState === 'running')
      && !!l.style.getPropertyValue('--tampa-h') && !!l.querySelector(':scope > .semana-raiz');
  }, null, 10000);
  const tampa = await pg.evaluate(() => {
    const lista = document.getElementById('hymnResults');
    medirTampa(lista);
    const bloco = lista.querySelector(':scope > .semana-raiz');
    const cs = getComputedStyle(bloco);
    const tampaH = parseFloat(lista.style.getPropertyValue('--tampa-h')) || 0;
    const cards = [...lista.children].filter((n) => n.classList.contains('hymnal-card')
      || n.classList.contains('coll-group--drop'));
    const conteudo = [...bloco.children].reduce((n, c) => n + c.getBoundingClientRect().height, 0)
      + (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const linhas = [...bloco.querySelectorAll('.semana-raiz-item .hymn-row')]
      .map((r) => r.getBoundingClientRect().height);
    return {
      bloco: bloco.getBoundingClientRect().height, conteudo, tampaH, linhas,
      cards: cards.map((c) => c.getBoundingClientRect().height),
      topoNoBloco: bloco.style.getPropertyValue('--tampa-topo'),
      transborda: lista.scrollHeight > lista.clientHeight + 1,
      teto: parseFloat(getComputedStyle(lista).getPropertyValue('--lib-teto-px')) || 0,
    };
  });
  checar(Math.abs(tampa.bloco - tampa.conteudo) < 2 && tampa.topoNoBloco === '',
    'I8 · o bloco "Este sábado" tem a altura do CONTEÚDO (fora da repartição da tampa)', tampa);
  checar(tampa.cards.length > 0 && tampa.cards.every((h) => Math.abs(h - tampa.tampaH) < 1) && !tampa.transborda,
    'I9 · e a conta da tampa FECHA: os cards fechados medem a tampa e a lista não transborda', tampa);
  checar(tampa.linhas.length === 2 && tampa.linhas.every((h) => h >= 44),
    'I10 · a linha de cada série é um alvo de pelo menos 44px', tampa);

  // ── J. O NOME NOVO CHEGA AO QUE JÁ ESTAVA BAIXADO ──────────────────────────
  const j = await pg.evaluate(async () => {
    const coll = allCollections().find((c) => c.id === 'serie-provai-vede-2026');
    const ep = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'video/mp4' }),
      { name: '15/Ago · Match point', kind: 'video', type: 'video/mp4', youtubeId: 'mp1', list: 'imports' });
    const meu = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'video/mp4' }),
      { name: 'O do pastor', kind: 'video', type: 'video/mp4', youtubeId: 'mp2', list: 'imports' });
    const faixa = (id, cru) => serieFaixaDoItem({ id_music: id }, AVSerie.itensDaPlaylist(
      [{ id, url: 'y/' + id, name: cru, seconds: 300 }], 8, coll.serie, new Date(coll.serie.ano, 11, 31))[0]);
    const songs = [faixa('mp1', 'Match point | Provai e Vede 2026 (15/Ago)'),
      faixa('mp2', 'Cada centavo conta | Provai e Vede 2026 (22/Ago)')];
    const n = await renomearEpisodiosGuardados(songs);
    return { n, novo: songs[0].name, ep: (await AVDB.getMediaCru(ep.id)).name,
      meu: (await AVDB.getMediaCru(meu.id)).name };
  });
  checar(j.novo === '15/Ago · Provai e Vede 2026',
    'J1 · o nome do episódio do Provai e Vede é a DATA mais "Provai e Vede 2026" (sem o título do episódio)', j);
  checar(j.ep === '15/Ago · Provai e Vede 2026' && j.n === 1,
    'J2 · o episódio JÁ BAIXADO com o nome automático antigo ganha o nome novo', j);
  checar(j.meu === 'O do pastor',
    'J3 · e o que o operador renomeou à mão NÃO é tocado', j);
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
