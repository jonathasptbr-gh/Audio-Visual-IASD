#!/usr/bin/env node
// ============================================================================
// A VERIFICAÇÃO DA SEMANA NÃO FECHA A GAVETA QUE O OPERADOR ABRIU (v1.13.67)
//
// Relato do operador: *"Assim que eu abro o Provai e Vede ou Informativo Mundial
// das Missões e abro a opção de play, essa opção fecha, provavelmente devido a
// uma atualização visual da lista, que se inicia automaticamente após abrir a
// coleção. [...] só mexa na lista se houver mudança real. (Inclusive acréscimo
// de item não é mudança na lista inteira, só do item adicionado)."*
//
// ## A causa (medida, não suposta)
//
// Abrir o card dispara `verificarSemanaAoAbrir`: refaz o índice e, com ele de pé,
// roda `manterSeriesDaSemana`. Essa rotina terminava SEMPRE com
// `renderCollectionsNow()` — o redesenho direto, sem o guarda
// `interacaoAbertaNoAcervo` — e o início do download do episódio também o
// chamava direto. `renderSearchResults` faz `hymnResultsEl.innerHTML = ''`, e a
// gaveta vive no `li` que ele joga fora.
//
// ## As metades
//
//  A. **O DOWNLOAD DA SEMANA, com a gaveta aberta**: o mesmo `li`, ainda aberto.
//  B. **A ROTINA SEM NADA A FAZER** (episódio no aparelho, retenção igual): nenhum
//     redesenho — era o caso comum, e era o que fechava a gaveta à toa.
//  C. **A VERIFICAÇÃO INTEIRA** (`syncCollection` automática) com a gaveta aberta,
//     com a lista IGUAL e com um item ACRESCENTADO: a gaveta fica; e fechada ela,
//     a lista nova entra (a espera TERMINA — "nunca redesenhar" não passa).
//  D. **O ÍNDICE IGUAL NÃO REDESENHA**; o índice com item novo, sim.
//
// Roda em Chromium de verdade, com a ponte de mentira mínima do
// `serie-mantem-a-semana` (o `ytArquivo` e a extração do canal são interceptados).
//
//   node tools/serie-gaveta-aberta.test.mjs
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

// A SÉRIE MEDIDA é a primeira do catálogo (o Provai e Vede), e a segunda entra
// no bloco B para provar que a marca é POR COLEÇÃO — marcar uma não liga a
// outra.
const SERIE = 'serie-provai-vede-2026';
const OUTRA = 'serie-informativo-missoes-2026';

// OS TRÊS EPISÓDIOS, DATADOS EM VOLTA DO SÁBADO CORRENTE. As datas saem de
// `AVSerie.sabadoDaSemana()` DENTRO da página — a mesma função que o app usa —,
// e não de um calendário escrito aqui: a semana adventista vai de domingo a
// sábado, e uma conta própria no oráculo divergiria da do app exatamente nos
// três dias em que a v1.2.19 já divergiu.
const plantar = () => pg.evaluate((ids) => {
  // `serieData` é `{ mes, dia }` — o ANO vem do catálogo (`serie.ano`), e é por
  // isso que ele não aparece aqui: escrevê-lo faria o oráculo afirmar um
  // formato que o `serie.js` não usa.
  const coll = allCollections().find((c) => c.id === ids.serie);
  const sab = AVSerie.sabadoDaSemana();
  const desloca = (n) => {
    const d = new Date(coll.serie.ano, sab.mes - 1, sab.dia + n);
    return { mes: d.getMonth() + 1, dia: d.getDate() };
  };
  const faixa = (nome, quando) => ({
    id_music: nome, name: nome, ytUrl: 'y/' + nome, seconds: 300,
    canal: 'Provai e Vede | Oficial', serieData: quando,
  });
  collState[ids.serie] = {
    indexSyncedAt: Date.now(), serieDiarioEm: Date.now(),
    songs: [faixa('passada', desloca(-7)), faixa('semana', desloca(0)),
      faixa('seguinte', desloca(7))],
  };
  collState[ids.outra] = { indexSyncedAt: Date.now(), songs: [] };
  // O VEREDITO DO APP sobre cada uma das três, e não uma conta nossa: é ele que
  // a premissa afirma.
  return {
    sabado: sab,
    daSemana: collState[ids.serie].songs
      .filter((s) => AVSerie.ehDoSabadoAtual(s.serieData, coll.serie))
      .map((s) => s.id_music),
  };
}, { serie: SERIE, outra: OUTRA });


const armarDownload = () => pg.evaluate(() => {
  window.__baixados = [];
  window.ytArquivo = async (alvo, opts) => {
    window.__baixados.push(alvo && alvo.id);
    await new Promise((r) => setTimeout(r, 300));
    return await AVDB.addMedia(
      new Blob([new Uint8Array(8)], { type: 'video/mp4' }),
      { name: alvo.name, kind: 'video', type: 'video/mp4', youtubeId: alvo.id,
        list: (opts && opts.lista) || 'imports' });
  };
});

// A EXTRAÇÃO DO CANAL, de mentira: uma playlist aceita pela série, e a lista de
// itens que o teste muda entre uma chamada e outra.
const armarCanal = () => pg.evaluate(() => {
  window.__itens = [
    { id: 'aaaaaaaaaa1', url: 'y/1', name: 'Match point | Provai e Vede 2026 (01/Ago)', seconds: 319 },
    { id: 'aaaaaaaaaa2', url: 'y/2', name: 'Outro | Provai e Vede 2026 (08/Ago)', seconds: 320 },
  ];
  AVNative.ytCanalPlaylists = async () => [
    { name: 'Provai e Vede Agosto 2026', url: 'p/ago', count: window.__itens.length }];
  AVNative.ytPlaylist = async () => ({ name: 'Provai e Vede Agosto 2026',
    author: 'Provai e Vede | Oficial', items: window.__itens.map((i) => ({ ...i })) });
});

const espiar = () => pg.evaluate(() => {
  window.__desenhos = 0; window.__buscas = 0;
  const d = window.renderSearchResults; const b = window.renderBuscaQuandoPuder;
  window.renderSearchResults = (...a) => { window.__desenhos++; return d(...a); };
  window.renderBuscaQuandoPuder = (...a) => { window.__buscas++; return b(...a); };
  window.__desespiar = () => { window.renderSearchResults = d; window.renderBuscaQuandoPuder = b; };
});
const desespiar = () => pg.evaluate(() => window.__desespiar && window.__desespiar());
const contagens = () => pg.evaluate(() => ({ desenhos: window.__desenhos, buscas: window.__buscas }));
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// O estado da primeira linha de episódio do card aberto. O carimbo é o que separa
// "a gaveta continua aberta" de "foi remontada e reaberta".
const estado = () => pg.evaluate(() => {
  const li = document.querySelector('#hymnResults .hymnal-card .hymn-result');
  return { existe: !!li, aberta: !!(li && li.classList.contains('expanded')),
    mesmoNo: !!(li && li.dataset.carimbo === 'oraculo'),
    linhas: document.querySelectorAll('#hymnResults .hymnal-card .hymn-result').length };
});
const abrirGaveta = async () => {
  await pg.evaluate(() => {
    const li = document.querySelector('#hymnResults .hymnal-card .hymn-result');
    li.dataset.carimbo = 'oraculo';
    li.querySelector('.hymn-row').click();
  });
  return esperar(pg, () => {
    const li = document.querySelector('#hymnResults .hymnal-card .hymn-result');
    return !!li && li.classList.contains('expanded');
  });
};
const fecharGaveta = () => pg.evaluate(() => {
  const li = document.querySelector('#hymnResults .hymnal-card .hymn-result.expanded');
  if (li) li.querySelector('.hymn-row').click();
});

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && window.AVSerie
      && typeof window.__avBack === 'function',
    null, { timeout: 30000 },
  );
  await esperarCortina(pg);
  await pg.evaluate(() => setAppMode('full'));
  await pg.evaluate(() => {
    Object.defineProperty(navigator, 'connection', { value: { type: 'wifi' }, configurable: true });
  });
  await pg.evaluate(async () => {
    for (let i = 0; i < 400 && serieAutoRodando; i++) await new Promise((r) => setTimeout(r, 50));
  });

  const datas = await plantar();
  checar(datas.daSemana.length === 1, 'A PREMISSA: há um episódio desta semana na lista plantada', datas);
  await armarDownload();
  await armarCanal();

  await pg.evaluate(() => { openHymnSearch(); });
  await esperar(pg, () => !!document.querySelector('#hymnResults .hymnal-card'),
    null);
  await pg.evaluate(() => {
    const card = [...document.querySelectorAll('#hymnResults .hymnal-card')]
      .find((el) => /Provai e Vede/i.test(el.textContent));
    card.querySelector('.coll-bar').click();
  });
  if (await esperar(pg, () => !!document.querySelector('#hymnResults .hymnal-card .hymn-result'),
    null) !== true) throw new Error('sem episódios');

  // ---- A. O DOWNLOAD DA SEMANA, COM A GAVETA ABERTA ------------------------
  if (await abrirGaveta() !== true) throw new Error('gaveta não abriu');
  await pg.evaluate(async () => {
    for (let i = 0; i < 400 && serieAutoRodando; i++) await new Promise((r) => setTimeout(r, 50));
    await manterSeriesDaSemana();
  });
  let baixados = await pg.evaluate(() => window.__baixados.length);
  checar(baixados === 1, 'A. a rotina baixou o episódio da semana (o que fechava a gaveta)', baixados);
  await pausa(1200);   // mais que o tique de 400 ms
  let e = await estado();
  checar(e.aberta && e.mesmoNo,
    'A. depois do download, a MESMA gaveta continua aberta — o redesenho esperou', e);

  // ---- B. SEM NADA A FAZER, NENHUM REDESENHO --------------------------------
  await fecharGaveta();
  await pausa(900);                  // deixa o redesenho adiado sair
  await espiar();
  await pg.evaluate(async () => { await manterSeriesDaSemana(); });
  await pausa(900);
  let c = await contagens();
  baixados = await pg.evaluate(() => window.__baixados.length);
  checar(baixados === 1 && c.desenhos === 0,
    'B. episódio no aparelho e retenção igual: a rotina não baixa nada e NÃO redesenha a lista', { baixados, ...c });
  await desespiar();

  // ---- C. A VERIFICAÇÃO INTEIRA COM A GAVETA ABERTA -------------------------
  await pg.evaluate(() => { openHymnSearch(); });
  await esperar(pg, () => !!document.querySelector('#hymnResults .hymnal-card .hymn-result'),
    null);
  if (await abrirGaveta() !== true) throw new Error('gaveta não abriu (C)');
  // O índice SEM o cache da assinatura, para a extração de mentira correr de verdade.
  const verificar = () => pg.evaluate(async (id) => {
    collState[id].serieAssinatura = 'forcar';
    const coll = allCollections().find((x) => x.id === id);
    const r = await syncCollection(coll, { soIndice: true, automatica: true,
      rotulo: 'Verificando os vídeos da semana…' });
    await manterSeriesDaSemana();
    return !!(r && r.ok);
  }, SERIE);
  checar(await verificar(), 'C. a verificação automática termina bem (lista igual)');
  await pausa(1200);
  e = await estado();
  checar(e.aberta && e.mesmoNo, 'C. lista IGUAL: a gaveta continua aberta, no mesmo nó', e);

  const linhasAntes = e.linhas;
  await pg.evaluate(() => { window.__itens.push(
    { id: 'aaaaaaaaaa3', url: 'y/3', name: 'Novo | Provai e Vede 2026 (15/Ago)', seconds: 300 }); });
  checar(await verificar(), 'C. a verificação automática termina bem (item acrescentado)');
  await pausa(1200);
  e = await estado();
  checar(e.aberta && e.mesmoNo && e.linhas === linhasAntes,
    'C. item ACRESCENTADO com a gaveta aberta: ela fica, e a lista espera', e);
  await fecharGaveta();
  const entrou = await esperar(pg, (n) => document
    .querySelectorAll('#hymnResults .hymnal-card .hymn-result').length > n, linhasAntes, 8000);
  checar(entrou === true,
    'C. fechada a gaveta, o redesenho adiado sai e a linha nova entra (a espera TERMINA)', porque(entrou));

  // ---- D. O ÍNDICE IGUAL NÃO REDESENHA -------------------------------------
  const indice = () => pg.evaluate(async (id) => {
    collState[id].serieAssinatura = 'forcar';
    await fetchSerieIndex(allCollections().find((x) => x.id === id));
  }, SERIE);
  await pausa(800);
  await espiar();
  await pg.evaluate(() => {
    window.__rf = 0; const f = window.refreshCollectionsIfVisible;
    window.refreshCollectionsIfVisible = (...a) => { window.__rf++; return f(...a); };
    window.__desrf = () => { window.refreshCollectionsIfVisible = f; };
  });
  await indice();
  let d = await pg.evaluate(() => ({ rf: window.__rf, ...{ buscas: window.__buscas } }));
  checar(d.rf === 0 && d.buscas === 0,
    'D. índice IGUAL ao que está na tela: nenhum pedido de redesenho', d);
  await pg.evaluate(() => { window.__itens.push(
    { id: 'aaaaaaaaaa4', url: 'y/4', name: 'Mais um | Provai e Vede 2026 (22/Ago)', seconds: 300 }); });
  await indice();
  d = await pg.evaluate(() => ({ rf: window.__rf, buscas: window.__buscas }));
  checar(d.rf >= 1 && d.buscas >= 1, 'D. índice com item NOVO: pede o redesenho', d);
  await pg.evaluate(() => window.__desrf());
  await desespiar();
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
