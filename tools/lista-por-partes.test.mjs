#!/usr/bin/env node
// ============================================================================
// A LISTA DO ACERVO ATUALIZA EM PARTES, SEM ATRAPALHAR QUEM A USA (v1.13.68)
//
// Pedido do operador, depois do conserto da v1.13.67 (que só fazia o redesenho ESPERAR a
// gaveta fechar): *"o modelo de lista mais complexa, que atualiza em partes, de forma correta
// e sem atrapalhar o usuário"* — e, antes: *"só mexa na lista se houver mudança real.
// (Inclusive acréscimo de item não é mudança na lista inteira, só do item adicionado)"*.
//
// ## O que se prova (cada nó leva um CARIMBO de dataset: "mesmo nó" ≠ "remontado")
//
//  1. lista IGUAL: nenhum nó trocado (linhas, barra, card) e nenhum `renderSearchResults`;
//  2. item ACRESCENTADO com a gaveta aberta: a linha entra NA HORA, na posição que a lista do
//     app manda, a gaveta fica no mesmo nó e as outras linhas nem são tocadas;
//  3. item REMOVIDO que não é o da gaveta: some só ele;
//  4. item ALTERADO: o rosto muda; se a linha está aberta, no lugar (mesmo nó, gaveta aberta);
//  5. o SUBTÍTULO/progresso ("Verificando os vídeos da semana…", "Baixando…") e a contagem de
//     episódios mudam NO LUGAR com a gaveta aberta — a barra é o mesmo nó;
//  6. item REMOVIDO que É o da gaveta: ela fecha — e só nesse caso;
//  7. PAGINAÇÃO: item no topo de uma lista paginada empurra o último para fora, e o rodapé
//     "Carregando mais…" acompanha;
//  8. o DESTAQUE do sábado (fora da lista) é reconciliado também;
//  9. o FALLBACK: estrutura que muda (card fechado por fora) e pedido COMPLETO (sem `partes`)
//     continuam pelo guarda — esperam a gaveta fechar e depois redesenham tudo.
//
// Para ver o oráculo REPROVAR sem o recurso: rode-o contra um `controle.js` anterior (ele só usa
// o que existia: `refreshCollectionsIfVisible`, `setCollStatus`) ou com `SEM_PARTES=1`, que
// desliga `reconciliarAcervo` em memória.
//
//   node tools/lista-por-partes.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, porque, checar, falhas } from './arnes.mjs';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');

// A PONTE DE MENTIRA, MÍNIMA. Este oráculo não exercita a extração do canal: ele
// PLANTA a lista de episódios, porque o que ele mede são as datas em volta do
// sábado corrente — e uma fixture de canal fixa envelheceria a cada semana. O
// percurso canal → lista tem oráculo próprio (`boot-nativo`), e a regra pura
// tem o `serie.test.mjs`.
//
// `ytFetch` e os outros de download NÃO são stubados aqui: quem é interceptado é
// o `ytArquivo` do app (ver `armarDownload`). A razão é a mesma que faz o
// `transporte-sem-cena` interceptar o `cmd` — o que se afirma é a DECISÃO da
// rotina, e um download de mentira atravessando o `ytBaixarNativo` inteiro
// provaria o arnês.
const PONTE = `(() => {
  const comCallId = new Set(['apkInstalar','espelhoLigar','displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','castTarget','saidaDeAudioAlvo',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','apkProcurar','otaPending','otaApply',
    'otaCheck','otaDiag','ytDiag','farolEstado','ytCanalPlaylists','ytPlaylist','ytDetalhes',
    'areaTransferencia','pacoteDiag','cifraHtml','espelhoRedes']);
  const vazio = { displays: [], listFolder: [], pickDoc: [], ytSearch: [],
    espelhoEstado: { ligado: false, telas: [] }, espelhoDiag: {},
    espelhoCertEstado: { temCert: false }, castTarget: { label: 'Tela de teste' },
    farolEstado: { conta: true, ultimo: 0, diag: 'de teste' } };
  const B = {
    shellVersion: () => 72,
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: (id) => { setTimeout(() => window.__avResolve(id, ''), 0); },
    busPost: () => {},
    otaConfirm: () => {},
  };
  const nomes = Object.keys(vazio).concat([...comCallId], ['apkInstalar','bgProgress',
    'bgConcluido','captureVolumeKeys','deckDiscard','espelhoDesligar','espelhoLigar','keepAlive',
    'nowPlaying','openCast','abrirSaidaDeAudio','openExternal','systemVolume','temaClaro','ytCancel','ytDiscard',
    'projecaoLocal','compartilharTexto','salvarTexto','copiarTexto']);
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
const errosPg = [];
pg.on('pageerror', (e) => errosPg.push(String(e)));
const SERIE = 'serie-provai-vede-2026';
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const CARD = '#hymnResults .hymnal-card[data-coll="serie-provai-vede-2026"]';
const LISTA = '#hymnResults .hymnal-card[data-coll="serie-provai-vede-2026"] .coll-songs:not(.serie-destaque-lista)';

// A lista da série: 4 episódios passados (+ o do sábado corrente, que o app tira da lista e põe
// no destaque; ATENÇÃO: QUALQUER data da semana corrente vira o destaque, por isso as outras ficam
// em semanas anteriores). Datas saem de `AVSerie.sabadoDaSemana()`, como nos outros oráculos de série.
const plantar = (extra) => pg.evaluate((ids) => {
  const coll = allCollections().find((c) => c.id === ids.serie);
  const sab = AVSerie.sabadoDaSemana();
  const dia = (n) => {
    const d = new Date(coll.serie.ano, sab.mes - 1, sab.dia + n);
    return { mes: d.getMonth() + 1, dia: d.getDate() };
  };
  const faixa = (id, nome, n) => ({ id_music: id, name: nome, ytUrl: 'y/' + id, seconds: 300,
    canal: 'Provai e Vede | Oficial', serieData: dia(n) });
  const songs = [faixa('x1', 'Um', -7), faixa('x2', 'Dois', -14), faixa('x3', 'Tres', -21),
    faixa('x4', 'Quatro', -28), faixa('dest', 'Do sabado', 0)];
  for (let i = 0; i < ids.extra; i++) songs.push(faixa('p' + i, 'Pag ' + i, -35 - i));
  collState[ids.serie] = { indexSyncedAt: Date.now(), serieDiarioEm: Date.now(), songs };
  const u = ui(ids.serie);
  u.semanaProxima = Date.now() + 3600e3;   // a verificação da abertura não mexe na lista de mentira
}, { serie: SERIE, extra: extra || 0 });

// Muda a lista de mentira e pede o tique EM PARTES — o mesmo pedido que o índice novo faz.
const mexer = (fn, partes = true) => pg.evaluate(([f, p]) => {
  const st = collState[f.serie];
  // eslint-disable-next-line no-new-func
  new Function('st', 'faixa', f.corpo)(st, (id, nome, n) => {
    const coll = allCollections().find((c) => c.id === f.serie);
    const sab = AVSerie.sabadoDaSemana();
    const d = new Date(coll.serie.ano, sab.mes - 1, sab.dia + n);
    return { id_music: id, name: nome, ytUrl: 'y/' + id, seconds: 300, canal: 'Provai e Vede | Oficial',
      serieData: { mes: d.getMonth() + 1, dia: d.getDate() } };
  });
  if (p) refreshCollectionsIfVisible({ partes: true }); else refreshCollectionsIfVisible();
}, [{ serie: SERIE, corpo: fn }, partes]);

const carimbar = () => pg.evaluate(() => {
  let n = 0;
  document.querySelectorAll('#hymnResults .hymnal-card, #hymnResults .coll-group, #hymnResults .coll-bar,'
    + ' #hymnResults .hymn-result, #hymnResults .serie-destaque').forEach((el) => { el.dataset.car = 'c' + (n++); });
  return n;
});
const chaves = () => pg.evaluate((sel) => [...document.querySelectorAll(sel + ' > li[data-song]')]
  .map((l) => l.dataset.song.split(':')[1]), LISTA);
const ordemDoApp = () => pg.evaluate((id) => faixasDaLista(allCollections().find((c) => c.id === id))
  .slice(0, ui(id).shown || COLL_PAGE).map((s) => s.id_music), SERIE);
const linha = (id) => pg.evaluate(([sel, k]) => {
  const l = document.querySelector(sel + ' > li[data-song$=":' + k + '"]')
    || document.querySelector('#hymnResults .serie-destaque-lista > li[data-song$=":' + k + '"]');
  return l ? { car: l.dataset.car || null, aberta: l.classList.contains('expanded'),
    nome: (l.querySelector('.hymn-name') || {}).textContent } : null;
}, [LISTA, id]);
const barra = () => pg.evaluate(() => {
  const b = document.querySelector('#hymnResults .hymnal-card[data-coll="serie-provai-vede-2026"] .coll-bar');
  const s = b && b.querySelector('.coll-bar-sync');
  return { car: b && b.dataset.car, texto: s ? s.textContent : '', busy: !!(s && s.classList.contains('busy')) };
});
const abrirLinha = async (id) => {
  await pg.evaluate(([sel, k]) => {
    const l = document.querySelector(sel + ' > li[data-song$=":' + k + '"]')
      || document.querySelector('#hymnResults .serie-destaque-lista > li[data-song$=":' + k + '"]');
    l.querySelector('.hymn-row').click();
  }, [LISTA, id]);
  return esperar(pg, ([sel, k]) => {
    const l = document.querySelector(sel + ' > li[data-song$=":' + k + '"]')
      || document.querySelector('#hymnResults .serie-destaque-lista > li[data-song$=":' + k + '"]');
    return !!l && l.classList.contains('expanded');
  }, [LISTA, id]);
};
const espiar = () => pg.evaluate(() => {
  window.__desenhos = 0; window.__guarda = 0; window.__rec = 0;
  const d = window.renderSearchResults; const g = window.interacaoAbertaNoAcervo; const r = window.reconciliarAcervo;
  window.renderSearchResults = (...a) => { window.__desenhos++; return d(...a); };
  window.interacaoAbertaNoAcervo = (...a) => { window.__guarda++; return g(...a); };
  if (r) window.reconciliarAcervo = (...a) => { const v = r(...a); if (v) window.__rec++; return v; };
});
const contagens = () => pg.evaluate(() => ({ desenhos: window.__desenhos, guarda: window.__guarda, rec: window.__rec }));
const gavetas = () => pg.evaluate(() => document.querySelectorAll('#hymnResults .hymn-result.expanded').length);

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && window.AVSerie && typeof window.__avBack === 'function',
    null, { timeout: 30000 },
  );
  await esperarCortina(pg);
  await pg.evaluate(() => setAppMode('full'));
  await pg.evaluate(async () => {
    for (let i = 0; i < 400 && serieAutoRodando; i++) await new Promise((r) => setTimeout(r, 50));
  });
  if (process.env.SEM_PARTES) await pg.evaluate(() => { window.reconciliarAcervo = () => false; });

  await plantar();
  await pg.evaluate(() => { openHymnSearch(); });
  await esperar(pg, () => !!document.querySelector('#hymnResults .hymnal-card'));
  await pg.evaluate(() => {
    [...document.querySelectorAll('#hymnResults .hymnal-card')]
      .find((el) => /Provai e Vede/i.test(el.textContent)).querySelector('.coll-bar').click();
  });
  if (await esperar(pg, (s) => document.querySelectorAll(s + ' > li[data-song]').length >= 4, LISTA) !== true) {
    throw new Error('sem episódios');
  }
  checar((await chaves()).join() === 'x1,x2,x3,x4', 'PREMISSA: a lista tem os 4 episódios (o do sábado vai para o destaque)', await chaves());
  checar(!!(await linha('dest')), 'PREMISSA: o episódio do sábado está no destaque');
  await espiar();

  // ---- 1. LISTA IGUAL: NENHUM NÓ TROCADO -----------------------------------
  // Drena pedidos COMPLETOS que ficaram da abertura (o catálogo, a fonte…): eles são pegajosos de
  // propósito, e este oráculo mede o tique que SÓ pede partes.
  await pg.evaluate(() => { renderCollectionsNow(); });
  await pausa(700);
  await espiar();
  const total = await carimbar();
  await mexer('', true);
  await pausa(1100);
  const sobrou = await pg.evaluate(() => document.querySelectorAll('#hymnResults [data-car]').length);
  let c = await contagens();
  checar(sobrou === total && c.desenhos === 0,
    '1. lista IGUAL: nenhum nó trocado (' + total + ' carimbados) e nenhum redesenho completo', { total, sobrou, ...c });
  checar(c.rec >= 1 || process.env.SEM_PARTES, '1. o tique passou pela reconciliação em partes', c);

  // ---- 2. ITEM ACRESCENTADO, GAVETA ABERTA ---------------------------------
  checar(await abrirLinha('x3') === true, '2. a gaveta do episódio x3 abre');
  await carimbar();
  await mexer("st.songs.splice(1, 0, faixa('novo', 'Novinho', -10));");
  let r = await esperar(pg, (s) => !!document.querySelector(s + ' > li[data-song$=":novo"]'), LISTA, 4000);
  checar(r === true, '2. a linha NOVA aparece na hora, com a gaveta aberta (não espera ela fechar)', porque(r));
  const ordem = await chaves();
  checar(ordem.join() === (await ordemDoApp()).join() && ordem.indexOf('novo') === 1,
    '2. ...na posição certa (a que a lista do app manda, e não no fim)', ordem);
  let x3 = await linha('x3');
  checar(x3 && x3.aberta && x3.car, '2. a gaveta continua aberta, NO MESMO NÓ', x3);
  const outras = await Promise.all(['x1', 'x2', 'x4'].map(linha));
  checar(outras.every((o) => o && o.car), '2. as outras linhas não foram tocadas (mesmos nós)', outras);
  const card = await pg.evaluate(() => {
    const k = document.querySelector('#hymnResults .hymnal-card[data-coll="serie-provai-vede-2026"]');
    return { car: k.dataset.car, n: (k.querySelector('.coll-bar-sync') || {}).textContent };
  });
  checar(card.car && /6 epis/.test(card.n || ''), '2. a contagem na barra acompanha, no mesmo card', card);

  // ---- 3. REMOVIDO QUE NÃO É O DA GAVETA ----------------------------------
  await mexer("st.songs = st.songs.filter((s) => s.id_music !== 'x4');");
  r = await esperar(pg, (s) => !document.querySelector(s + ' > li[data-song$=":x4"]'), LISTA, 4000);
  checar(r === true, '3. o item removido some', porque(r));
  x3 = await linha('x3');
  checar(x3 && x3.aberta && x3.car && (await gavetas()) === 1,
    '3. a gaveta de OUTRO item fica aberta, no mesmo nó', x3);
  checar((await chaves()).join() === (await ordemDoApp()).join(), '3. a ordem segue a do app', await chaves());

  // ---- 4. ITEM ALTERADO -----------------------------------------------------
  await mexer("st.songs.find((s) => s.id_music === 'x3').name = 'Tres RENOMEADO';"
    + "st.songs.find((s) => s.id_music === 'x2').name = 'Dois RENOMEADO';");
  r = await esperar(pg, (s) => /RENOMEADO/.test((document.querySelector(s + ' > li[data-song$=":x3"] .hymn-name') || {}).textContent || '')
    && /RENOMEADO/.test((document.querySelector(s + ' > li[data-song$=":x2"] .hymn-name') || {}).textContent || ''), LISTA, 4000);
  checar(r === true, '4. o nome novo aparece nas duas linhas', porque(r));
  x3 = await linha('x3');
  checar(x3 && x3.aberta && x3.car, '4. a linha alterada que está ABERTA é atualizada no lugar (mesmo nó, gaveta aberta)', x3);
  const x1 = await linha('x1');
  checar(x1 && x1.car, '4. a linha que não mudou segue intocada', x1);

  // ---- 5. SUBTÍTULO / PROGRESSO COM A GAVETA ABERTA -------------------------
  const b0 = await barra();
  await pg.evaluate((id) => {
    ui(id).syncBusy = true;
    setCollStatus(id, 'Verificando os vídeos da semana…');
  }, SERIE);
  r = await esperar(pg, () => /Verificando os v/.test((document.querySelector('#hymnResults .hymnal-card[data-coll="serie-provai-vede-2026"] .coll-bar-sync') || {}).textContent || ''), null, 4000);
  let b1 = await barra();
  checar(r === true && b1.busy && b1.car === b0.car,
    '5. "Verificando os vídeos da semana…" aparece com a gaveta aberta, na MESMA barra', { b0, b1 });
  await pg.evaluate((id) => setCollStatus(id, 'Baixando 45%'), SERIE);
  r = await esperar(pg, () => /45%/.test((document.querySelector('#hymnResults .hymnal-card[data-coll="serie-provai-vede-2026"] .coll-bar-sync') || {}).textContent || ''), null, 4000);
  checar(r === true && (await gavetas()) === 1, '5. o progresso anda com a gaveta aberta', porque(r));
  await pg.evaluate((id) => { ui(id).syncBusy = false; setCollStatus(id, ''); }, SERIE);
  r = await esperar(pg, () => /epis/.test((document.querySelector('#hymnResults .hymnal-card[data-coll="serie-provai-vede-2026"] .coll-bar-sync') || {}).textContent || ''), null, 4000);
  b1 = await barra();
  checar(r === true && !b1.busy && b1.car === b0.car && (await gavetas()) === 1,
    '5. ao terminar, a barra volta à contagem — mesmo nó, gaveta ainda aberta', { b1, r: porque(r) });

  // ---- 6. REMOVIDO QUE É O DA GAVETA: FECHA, E SÓ NESSE CASO ----------------
  await mexer("st.songs = st.songs.filter((s) => s.id_music !== 'x3');");
  r = await esperar(pg, (s) => !document.querySelector(s + ' > li[data-song$=":x3"]'), LISTA, 4000);
  const fim = await pg.evaluate(() => ({ g: document.querySelectorAll('#hymnResults .hymn-result.expanded').length,
    guarda: interacaoAbertaNoAcervo(), card: document.querySelector('#hymnResults .hymnal-card[data-coll="serie-provai-vede-2026"]').dataset.car }));
  checar(r === true && fim.g === 0 && !fim.guarda && fim.card,
    '6. a linha da gaveta saiu da lista: ela fecha, e o card segue o mesmo nó', { r: porque(r), fim });
  const x1b = await linha('x1');
  checar(x1b && x1b.car, '6. e as outras linhas continuam intocadas', x1b);

  // ---- 7. O DESTAQUE DO SÁBADO ---------------------------------------------
  checar(await abrirLinha('dest') === true, '7. a gaveta do episódio do sábado (destaque) abre');
  await carimbar();
  await mexer("st.songs.push(faixa('tardio', 'Tardio', -50));");
  r = await esperar(pg, (s) => !!document.querySelector(s + ' > li[data-song$=":tardio"]'), LISTA, 4000);
  let d = await linha('dest');
  checar(r === true && d && d.aberta && d.car,
    '7. item novo na lista: a gaveta do DESTAQUE continua aberta, no mesmo nó', { r: porque(r), d });
  await mexer("st.songs = st.songs.filter((s) => s.id_music !== 'dest');");
  r = await esperar(pg, () => !document.querySelector('#hymnResults .serie-destaque-lista > li[data-song]'), null, 4000);
  checar(r === true && (await gavetas()) === 0,
    '7. o episódio do sábado sai: o destaque esvazia e a gaveta dele fecha', porque(r));

  // ---- 8. PAGINAÇÃO ---------------------------------------------------------
  await plantar(130);
  await pg.evaluate(() => { renderCollectionsNow(); });
  const pag = await pg.evaluate(() => COLL_PAGE);
  r = await esperar(pg, ([s, n]) => document.querySelectorAll(s + ' > li[data-song]').length === n, [LISTA, pag], 6000);
  checar(r === true && !!(await pg.evaluate((s) => document.querySelector(s + ' > .coll-more'), LISTA)),
    '8. PREMISSA: a lista paginada mostra ' + pag + ' linhas e o rodapé "mais"', porque(r));
  const rodape0 = await pg.evaluate((s) => document.querySelector(s + ' > .coll-more').textContent, LISTA);
  await carimbar();
  const ultimo0 = (await chaves()).slice(-1)[0];
  await mexer("st.songs.splice(0, 0, faixa('topo', 'No topo', -9));");
  r = await esperar(pg, (s) => !!document.querySelector(s + ' > li[data-song$=":topo"]'), LISTA, 4000);
  const ch = await chaves();
  const rodape1 = await pg.evaluate((s) => (document.querySelector(s + ' > .coll-more') || {}).textContent, LISTA);
  checar(r === true && ch.length === pag && ch.includes('topo') && !ch.includes(ultimo0) && ch.join() === (await ordemDoApp()).join(),
    '8. item novo numa lista paginada: entra, o último sai da página, a conta de linhas é a mesma', { r: porque(r), topo: ch.indexOf('topo'), n: ch.length, fim: ch.slice(-2) });
  checar(rodape1 && rodape1 !== rodape0 && (await linha('x1')).car,
    '8. o rodapé acompanha o total e as linhas que ficaram seguem intocadas', { rodape0, rodape1 });
  await plantar(0);
  await pg.evaluate(() => { renderCollectionsNow(); });
  await esperar(pg, (s) => document.querySelectorAll(s + ' > li[data-song]').length === 4, LISTA, 6000);

  // ---- 9. O FALLBACK CONTINUA PELO GUARDA ----------------------------------
  // 9a. pedido COMPLETO (sem `partes`) com a gaveta aberta: ESPERA, e depois redesenha.
  await abrirLinha('x2');
  await carimbar();
  await espiar();
  await mexer("st.songs.push(faixa('espera', 'Espera', -60));", false);
  await pausa(1500);
  c = await contagens();
  checar(!(await pg.evaluate((s) => document.querySelector(s + ' > li[data-song$=":espera"]'), LISTA)) && c.guarda >= 2 && c.desenhos === 0,
    '9a. pedido COMPLETO com a gaveta aberta: consulta o guarda e ESPERA (a linha ainda não entrou)', c);
  await pg.evaluate(() => document.querySelector('#hymnResults .hymn-result.expanded .hymn-row').click());
  r = await esperar(pg, (s) => !!document.querySelector(s + ' > li[data-song$=":espera"]'), LISTA, 6000);
  checar(r === true && (await linha('x1')).car === null,
    '9a. fechada a gaveta, o redesenho completo SAI (a espera termina) e remonta as linhas', porque(r));
  // 9b. estrutura que mudou por fora (o card foi fechado) mesmo com `partes`: não se garante → guarda.
  await abrirLinha('x1');
  await carimbar();
  await espiar();
  await pg.evaluate((id) => { ui(id).expanded = false; refreshCollectionsIfVisible({ partes: true }); }, SERIE);
  await pausa(1500);
  c = await contagens();
  checar(c.guarda >= 2 && c.desenhos === 0 && (await gavetas()) === 1,
    '9b. estrutura mudou (card fechado por fora): a reconciliação desiste e o guarda segura a gaveta', c);
  await pg.evaluate(() => document.querySelector('#hymnResults .hymn-result.expanded .hymn-row').click());
  r = await esperar(pg, () => !document.querySelector('#hymnResults .hymnal-card .coll-open'), null, 6000);
  checar(r === true, '9b. fechada a gaveta, o redesenho completo fecha o card', porque(r));

  checar(errosPg.length === 0, 'nenhum erro de página', errosPg);
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
