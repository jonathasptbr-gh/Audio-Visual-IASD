#!/usr/bin/env node
// ============================================================================
// AS MINIATURAS NÃO PISCAM — a `object-URL` de uma capa é do BLOB, não do render.
//
// ## Por que ele existe
//
// Relato do operador: *"Os itens da lista de favoritos, tem suas thumbnails
// piscando durante processos de download na biblioteca e afins, veja se pode
// deixar isso mais estável visualmente, sem piscar."*
//
// A causa é aritmética. A Biblioteca é redesenhada a cada `COLL_REFRESH_MS`
// (400 ms) enquanto um download corre, e cada passada REVOGAVA as URLs do render
// anterior para criar outras dos MESMOS blobs. Uma `<img>` com `src` inédito não
// tem decodificação em cache: ela nasce vazia e pinta no quadro seguinte — três
// vezes por segundo, em toda linha com capa.
//
// ## O que este arquivo mede, e por que cada metade
//
// **Um teste de "a capa aparece" passa nas duas versões** — ela aparece, só que
// um quadro depois, a cada redesenho. O que distingue as duas é a IDENTIDADE da
// URL entre dois renders, e é isso que a metade A afirma.
//
//  · **A · a URL SOBREVIVE ao redesenho**, e é a mesma string. É a propriedade
//    inteira: mesma capa, mesma URL, e a `<img>` nova nasce com um `src` que o
//    navegador já decodificou. O redesenho medido aqui é o do relato ORIGINAL —
//    `renderCollectionsNow`, o que o progresso de um download dispara a cada
//    400 ms.
//  · **B · e ela continua VÁLIDA.** Uma URL igual e revogada seria o defeito
//    piorado — a capa não voltaria nunca. A prova é um `fetch` nela: uma
//    object-URL revogada rejeita.
//  · **C · o que SAI de cena é RECOLHIDO.** Sem esta metade, "nunca revogar"
//    passaria em A e em B — e uma object-URL viva SEGURA o blob, então o
//    vazamento seria de memória de verdade, não de um punhado de strings.
//  · **D · a PASTA DO APARELHO, que é o caso que o desenho pode quebrar sem
//    sintoma.** O corpo dela é montado por uma função ASSÍNCRONA
//    (`filesByFolder`), isto é, DEPOIS de o balde do render ter sido devolvido:
//    sem um balde próprio, as capas daqueles arquivos caem num conjunto que
//    nenhum host publica, e a varredura seguinte — que revoga o que ninguém
//    desenha — as apaga da tela. É o modo de falhar do balde por host com a
//    chave a menos, e foi encontrado relendo o próprio diff.
//  · **E · o CRONOGRAMA, excluindo OUTRO item** (v1.7.7). É a porta que a
//    v1.7.4 deixou aberta e que ESTE ARQUIVO nomeava por extenso: keada pelo
//    BLOB, a URL sobrevivia ao redesenho que não relê — e um `load()` relê,
//    devolvendo blobs novos para todas as capas de uma vez. `load()` roda em
//    TODA escrita no banco, e excluir um item é uma. A chave passou a ser
//    `id|tamanho|tipo`, que é o que atravessa a releitura.
//
//   node tools/miniaturas-estaveis.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperar, checar, falhas, porque } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)),
  '..', 'app', 'src', 'main', 'assets', 'web');

const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
await ctx.addInitScript(() => {
  try { localStorage.setItem('av.appMode', 'full'); } catch (_) { /* storage bloqueado */ }
});

const erros = [];
try {
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  const dePe = await esperar(pg, () => window.AVDB && typeof window.__avBack === 'function'
    && !!document.querySelector('#playlist li'), null, 30000);
  checar(dePe === true, 'o app ficou de pé', porque(dePe));

  // O CENÁRIO: um item com CAPA em blob, no Cronograma e nos Favoritos. A capa é
  // um PNG de verdade (um `Blob` de outro tipo não decodifica, e o que se mede
  // aqui é justamente a decodificação).
  const semeou = await pg.evaluate(async () => {
    setAppMode('full');
    const png = await new Promise((r) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 8;
      const c = cv.getContext('2d');
      c.fillStyle = '#4af'; c.fillRect(0, 0, 8, 8);
      cv.toBlob(r, 'image/png');
    });
    const bytes = new Blob([new Uint8Array(64)], { type: 'audio/mpeg' });
    const ids = [];
    for (const nome of ['Capa A', 'Capa B']) {
      const rec = await AVDB.addMedia(bytes, {
        name: nome, type: 'audio/mpeg', kind: 'audio', thumb: png, list: 'imports',
      });
      ids.push(rec.id);
      await AVDB.listAdd('favs', rec.id);
    }
    await load();
    return ids;
  });
  checar(semeou.length === 2, 'dois itens com capa entraram no Cronograma e nos Favoritos', semeou);

  // A CASA DO RELATO é a seção de Favoritos DENTRO da Biblioteca: é ela que o
  // `renderCollectionsNow` do progresso redesenha a cada 400 ms.
  const abriuLib = await pg.evaluate(async () => {
    openHymnSearch();
    favAberto = true;
    renderCollectionsNow();
    return !!document.querySelector('[data-fav-corpo]');
  });
  checar(abriuLib === true, 'a Biblioteca abriu com a seção de Favoritos', abriuLib);
  const srcDe = (nome) => pg.evaluate((alvo) => {
    const li = [...document.querySelectorAll('[data-fav-corpo] .fav-itens > .lib-item')]
      .find((x) => ((x.querySelector('.row-name') || {}).textContent || '') === alvo);
    const im = li && li.querySelector('.thumb img');
    return im ? im.getAttribute('src') : null;
  }, nome);

  // =========================================================================
  // A · A URL SOBREVIVE AO REDESENHO
  // =========================================================================
  const antes = await srcDe('Capa A');
  checar(!!antes && antes.startsWith('blob:'),
    'A · a capa nasce com uma object-URL', antes);
  // O REDESENHO DO RELATO: `renderCollectionsNow` é o que o coalescimento de
  // 400 ms chama enquanto um download corre. Três, porque o defeito era por
  // PASSADA e uma só poderia coincidir.
  await pg.evaluate(() => {
    renderCollectionsNow(); renderCollectionsNow(); renderCollectionsNow();
  });
  const depois = await srcDe('Capa A');
  checar(depois === antes,
    'A · e ela é a MESMA depois de três redesenhos — mesmo blob, mesma URL, e a '
    + '`<img>` nova nasce com um `src` que o navegador já decodificou',
    { antes, depois });

  // =========================================================================
  // B · E ELA CONTINUA VÁLIDA
  // =========================================================================
  const viva = await pg.evaluate(async (url) => {
    try { const r = await fetch(url); return r.ok && (await r.blob()).size > 0; }
    catch (_) { return false; }
  }, depois);
  checar(viva === true,
    'B · e a URL continua VÁLIDA: uma igual e revogada seria o defeito piorado — '
    + 'a capa não voltaria nunca', viva);

  // =========================================================================
  // C · O QUE SAI DA LISTA É RECOLHIDO
  // =========================================================================
  //
  // Sem esta metade, "nunca revogar" passaria em A e em B. E o custo de errar
  // aqui é de MEMÓRIA: uma object-URL viva segura o blob inteiro.
  const urlB = await srcDe('Capa B');
  const recolhida = await pg.evaluate(async ({ ids, url }) => {
    if (!url) return { erro: 'a segunda linha não tinha capa' };
    await AVDB.listRemove('imports', ids[1]);
    await AVDB.listRemove('favs', ids[1]);
    await recarregarFavoritos();
    await load();
    renderCollectionsNow();
    let vive = true;
    try { const r = await fetch(url); vive = r.ok; } catch (_) { vive = false; }
    const naTela = [...document.querySelectorAll('[data-fav-corpo] .fav-itens > .lib-item')]
      .some((x) => ((x.querySelector('.row-name') || {}).textContent || '') === 'Capa B');
    return { url, vive, naTela };
  }, { ids: semeou, url: urlB });
  checar(!recolhida.erro && recolhida.naTela === false && recolhida.vive === false,
    'C · e a URL de quem SAIU de cena é revogada — uma object-URL viva segura o '
    + 'blob inteiro, e o vazamento seria de memória e não de strings',
    recolhida);
  // E O QUE ESTÁ NA TELA continua desenhável depois da mesma varredura: ela
  // recolhe o que ninguém desenha, não o que o render anterior criou.
  const aindaViva = await pg.evaluate(async () => {
    const li = [...document.querySelectorAll('[data-fav-corpo] .fav-itens > .lib-item')]
      .find((x) => ((x.querySelector('.row-name') || {}).textContent || '') === 'Capa A');
    const im = li && li.querySelector('.thumb img');
    if (!im) return { vive: false, url: null };
    try {
      const r = await fetch(im.getAttribute('src'));
      return { vive: r.ok, url: im.getAttribute('src') };
    } catch (_) { return { vive: false, url: im.getAttribute('src') }; }
  });
  checar(aindaViva.vive === true,
    'C · e a capa que FICOU continua válida depois da mesma varredura',
    aindaViva);
  // E ELA É A MESMA STRING (v1.7.7). O bloco acima passou por um `load()`, que
  // é onde a chave por BLOB perdia: esta é a metade do relato que fala da
  // BIBLIOTECA, e o bloco E é a que fala do Cronograma. Elas medem a mesma
  // propriedade em dois hosts, porque foi assim que o operador as encontrou —
  // e porque um host tem balde próprio e o outro não.
  checar(aindaViva.url === antes,
    'C · e é a MESMA URL de antes da exclusão — o `load()` da varredura relê o '
    + 'banco, e é aí que a chave por blob trocava a capa de todo mundo',
    { antes, depois: aindaViva.url });

  // =========================================================================
  // D · A PASTA DO APARELHO — o balde que o `await` deixa para trás
  // =========================================================================
  const pasta = await pg.evaluate(async () => {
    const png = await new Promise((r) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 8;
      const c = cv.getContext('2d');
      c.fillStyle = '#fa4'; c.fillRect(0, 0, 8, 8);
      cv.toBlob(r, 'image/png');
    });
    await AVDB.setState('opfs-folders', [{ id: 'p1', name: 'Pasta de teste', count: 1 }]);
    await AVDB.fileAdd({
      id: 'fx-capa.mp3', folder: 'p1', name: 'Com capa.mp3', kind: 'audio',
      type: 'audio/mpeg', thumb: png, size: 64,
    });
    opfsFolders = await AVDB.getState('opfs-folders');
    renderCollectionsNow();
    return true;
  });
  checar(pasta === true, 'D · a pasta do aparelho foi semeada e a Biblioteca abriu', pasta);
  const abriu = await esperar(pg, () => {
    const li = document.querySelector('[data-fav-corpo] .folder-opfs');
    if (!li) return false;
    if (!li.classList.contains('expanded')) { li.querySelector('.row').click(); return false; }
    return !!li.querySelector('.folder-itens .lib-item .thumb img');
  }, null, 15000);
  checar(abriu === true, 'D · e a pasta abriu com o arquivo dentro', porque(abriu));

  const daPasta = await pg.evaluate(() => {
    const im = document.querySelector('[data-fav-corpo] .folder-opfs .folder-itens .thumb img');
    return im ? im.getAttribute('src') : null;
  });
  checar(!!daPasta && daPasta.startsWith('blob:'),
    'D · o arquivo da pasta tem capa', daPasta);
  // A VARREDURA RODA AQUI, e o redesenho escolhido é o do CRONOGRAMA: ele
  // publica o balde do host DELE e recolhe o que ninguém desenha, sem tocar na
  // pasta — que continua na tela, com as capas que uma montagem ASSÍNCRONA pôs
  // lá. Sem o balde próprio da pasta, é esta linha que as apaga.
  await pg.evaluate(() => { renderLibrary(); });
  const sobreviveu = await pg.evaluate(async (url) => {
    try { const r = await fetch(url); return r.ok && (await r.blob()).size > 0; }
    catch (_) { return false; }
  }, daPasta);
  checar(sobreviveu === true,
    'D · e ela SOBREVIVE ao redesenho da Biblioteca: o corpo da pasta é montado '
    + 'depois de o balde do host ter sido devolvido, e sem um balde próprio a '
    + 'varredura seguinte apagaria a capa da tela',
    { url: daPasta, sobreviveu });

  // =========================================================================
  // E · O CRONOGRAMA, EXCLUINDO OUTRO ITEM (v1.7.7)
  // =========================================================================
  //
  // Relato do operador: *"Os mesmos problemas de miniaturas piscando da
  // biblioteca, temos nas miniaturas piscando no cronograma ao excluir outro
  // item."*
  //
  // É a porta que a v1.7.4 deixou aberta, e **o cabeçalho deste arquivo a
  // nomeava por extenso**: a chave era o BLOB, e o blob é o mesmo objeto entre
  // dois redesenhos só porque quem o segura é uma lista em MEMÓRIA. Um `load()`
  // relê o IndexedDB, e um blob relido é OUTRO objeto — toda capa da tela ganha
  // URL nova de uma vez. E `load()` roda em toda escrita no banco: excluir um
  // item é exatamente isso.
  //
  // O QUE MEDE: a URL da capa de quem FICOU, antes e depois. Um teste de "a
  // capa aparece" passa nas duas versões — a diferença é o quadro vazio.
  const cronoSrc = (nome) => pg.evaluate((alvo) => {
    const li = [...document.querySelectorAll('#library > .lib-item')]
      .find((x) => ((x.querySelector('.row-name') || {}).textContent || '') === alvo);
    const im = li && li.querySelector('.thumb img');
    return im ? im.getAttribute('src') : null;
  }, nome);

  const cron = await pg.evaluate(async () => {
    // A Biblioteca sai da frente: o alvo aqui é a lista de baixo.
    closeHymnSearch();
    const png = await new Promise((r) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 8;
      const c = cv.getContext('2d');
      c.fillStyle = '#8c4'; c.fillRect(0, 0, 8, 8);
      cv.toBlob(r, 'image/png');
    });
    const bytes = new Blob([new Uint8Array(64)], { type: 'audio/mpeg' });
    const ids = [];
    for (const nome of ['Crono A', 'Crono B']) {
      const rec = await AVDB.addMedia(bytes, {
        name: nome, type: 'audio/mpeg', kind: 'audio', thumb: png, list: 'imports',
      });
      ids.push(rec.id);
    }
    await load();
    return ids;
  });
  checar(cron.length === 2, 'E · dois itens com capa entraram no Cronograma', cron);

  const cronAntes = await cronoSrc('Crono A');
  const cronBAntes = await cronoSrc('Crono B');
  checar(!!cronAntes && cronAntes.startsWith('blob:'),
    'E · a capa do Cronograma nasce com uma object-URL', cronAntes);

  // O CAMINHO REAL do relato: excluir OUTRO item. Quem o faz de verdade é a
  // gaveta da linha, e ela termina em `listRemove` + `load()` — que é o par
  // medido aqui, porque é ele que relê o banco.
  await pg.evaluate(async (id) => {
    await AVDB.listRemove('imports', id);
    await load();
  }, cron[1]);

  const cronDepois = await cronoSrc('Crono A');
  checar(cronDepois === cronAntes,
    'E · e a capa de quem FICOU mantém a MESMA URL depois de o outro item ser '
    + 'excluído — um `load()` relê o banco, e keada pelo BLOB toda capa da tela '
    + 'ganhava URL nova de uma vez',
    { antes: cronAntes, depois: cronDepois });
  const cronViva = await pg.evaluate(async (url) => {
    try { const r = await fetch(url); return r.ok && (await r.blob()).size > 0; }
    catch (_) { return false; }
  }, cronDepois);
  checar(cronViva === true,
    'E · e ela continua VÁLIDA — a mesma string revogada seria o defeito piorado',
    cronViva);

  // A OUTRA METADE, e sem ela "nunca revogar" passa nas duas acima: a capa de
  // quem SAIU é recolhida. Ela é a mesma IMAGEM da que ficou (o mesmo `png`),
  // e é por isso que a asserção é sobre a URL DELA e não sobre os bytes: a
  // chave é `id|tamanho|tipo`, então dois itens com a mesma capa têm chaves
  // diferentes e morrem separados — que é o que mantém a varredura honesta.
  const cronRecolhida = await pg.evaluate(async ({ url, atual }) => {
    if (url === atual) return { erro: 'as duas linhas dividiam a mesma URL' };
    let vive = true;
    try { const r = await fetch(url); vive = r.ok; } catch (_) { vive = false; }
    const naTela = [...document.querySelectorAll('#library > .lib-item')]
      .some((x) => ((x.querySelector('.row-name') || {}).textContent || '') === 'Crono B');
    return { url, vive, naTela };
  }, { url: cronBAntes, atual: cronDepois });
  checar(!cronRecolhida.erro && cronRecolhida.naTela === false
    && cronRecolhida.vive === false,
    'E · e a de quem SAIU é revogada na mesma passada',
    cronRecolhida);

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
