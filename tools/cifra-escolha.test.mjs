#!/usr/bin/env node
// ============================================================================
// GUARDAR TODAS AS CIFRAS É UMA ESCOLHA, E AS DO CRONOGRAMA VÃO SOZINHAS (v1.12.60)
//
// ## O que ele trava
//
// A varredura de cifras do acervo inteiro rodava em toda abertura com Wi-Fi,
// para todo mundo. Desde a v1.12.60 ela é uma ESCOLHA, DESLIGADA por padrão, e o
// que sobra sem escolha nenhuma é o que quem toca usa:
//
//  A. DESLIGADA POR PADRÃO: a abertura não pede a cifra de nenhuma música fora
//     do Cronograma — e a do Cronograma vai para o aparelho.
//  B. O CRONOGRAMA É GATILHO: acrescentar um item e TROCAR de cronograma levam a
//     cifra dele ao aparelho, sem pedir as do resto do acervo.
//  C. A MÚSICA ABERTA é procurada na hora e o desfecho é GRAVADO — ela abre sem
//     rede na próxima vez.
//  D. A Verificação não reprova o acervo com a escolha desligada, e o Registro
//     diz em que estado ela está.
//  E. LIGAR PELA ABA DE CIFRA grava a escolha, começa a varredura do acervo e
//     sobrevive a uma recarga.
//
// A régua é o que FOI À REDE (`cifraHtml`, contado por endereço) e o que ficou
// no DISCO (`cifras:hymnal-2022`) — nunca a tela, que mostraria a mesma folha
// vinda pela porta errada.
//
//   node tools/cifra-escolha.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperar, esperarDb, porque, checar, falhas, RAIZ_WEB,
} from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;
const navegador = await abrirNavegador();

// A PONTE: `cifraHtml` anota o endereço e responde uma folha para o catálogo do
// hinário (404 no resto); TODO outro método que recebe um id de chamada é
// resolvido com `null` na hora — nada fica pendurado nos 60 s do `call()`.
// SEM CRASE NEM DOLAR-CHAVE AQUI: o bloco é um template literal.
const PONTE = `(function () {
  window.__urls = [];
  window.__semRede = false;
  const folha = '<h1>X</h1><pre><b>C</b>\\nlinha de marcador\\n</pre>';
  const B = new Proxy({
    shellVersion: () => 82, role: () => 'controle', appVersion: () => '9.99-teste',
    takeShare: () => '', busPost: () => {}, otaConfirm: () => {}, bgProgress: () => {},
    cifraHtml: (id, url) => {
      window.__urls.push(url);
      const r = window.__semRede ? { status: 0, html: '' }
        : (/\\/novo-hinario-adventista\\//.test(url) ? { status: 200, html: folha } : { status: 404, html: '' });
      setTimeout(() => { try { window.__avResolve(id, r); } catch (_) {} }, 0);
    },
  }, {
    get(alvo, n) {
      if (n in alvo) return alvo[n];
      if (typeof n !== 'string') return undefined;
      return (...args) => {
        const id = args[0];
        if (typeof id === 'string' && /^[a-z0-9]+:[0-9]+$/.test(id)) {
          setTimeout(() => { try { window.__avResolve(id, null); } catch (_) {} }, 0);
        }
        return undefined;
      };
    },
    has() { return true; },
  });
  window.__AVBridge = B;
})();`;

const NOMES = [
  '001. Hino Um Do Acervo', '002. Hino Dois Aberto', '003. Hino Tres Do Cronograma',
  '004. Hino Quatro Acrescentado', '005. Hino Cinco Trocado', '006. Hino Seis Do Acervo',
];

const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
await pg.addInitScript(PONTE);

const abrir = async () => {
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && (!!document.querySelector('#playlist li') || document.getElementById('plBtn').disabled),
    null, { timeout: 30000 },
  );
};

// As músicas cuja cifra foi PEDIDA, pelo slug do nome.
const pedidas = () => pg.evaluate((nomes) => nomes.filter((n) => {
  const slug = AVCifra.slug(AVCifra.semNumero(n));
  return window.__urls.some((u) => u.indexOf('/' + slug + '/') >= 0);
}), NOMES);
// As músicas com resposta GUARDADA no aparelho.
const noDisco = (nome) => pg.evaluate(async (n) => {
  const d = (await AVDB.getState('cifras:hymnal-2022')) || {};
  const v = d[cifraChaveNoDisco(n)];
  return !!(v && v.pagina);
}, nome);
// A rotina parada: nenhuma passada em voo e o gatilho do `load()` já disparado.
const parada = () => esperar(pg, () => cifraAcervoVoo === null && !cifraSyncRodando && !cifraCronoTimer, null, 15000);

try {
  await abrir();

  // ── O CENÁRIO: um hinário com SEIS músicas baixadas e UMA no Cronograma. ──
  const coll = await pg.evaluate(async (nomes) => {
    const c = allCollections().find((x) => x.id === 'hymnal-2022');
    await AVDB.setState('coll:hymnal-2022', {
      indexSyncedAt: Date.now(),
      songs: nomes.map((n, i) => ({ id_music: 'm' + i, name: n, track: i + 1, fileIdFull: 'f' + i })),
    });
    await AVDB.setState('cifras:hymnal-2022', {});
    const item = (i) => ({ id: 'crono-' + i, folder: 'hymnal-2022', name: nomes[i] + ' (Cantado)',
      hymnName: nomes[i], hymnAlbum: c.name, hymnTrack: i + 1, kind: 'audio', type: 'audio/mpeg' });
    for (const i of [2, 3, 4]) await AVDB.fileAdd(item(i));
    await AVDB.listAdd('imports', 'crono-2');
    return { nome: c.name, padrao: await AVDB.getState('cifraAcervoInteiro') };
  }, NOMES);
  checar(coll.padrao == null, 'A0 · PREMISSA: a escolha nunca foi gravada neste aparelho', coll.padrao);

  // ── A. A ABERTURA, com a escolha no padrão. ──────────────────────────────
  await abrir();
  const desligada = await pg.evaluate(() => cifraAcervoInteiro);
  checar(desligada === false, 'A1 · a escolha nasce DESLIGADA', desligada);
  const guardou3 = await esperarDb(pg, async (n) => {
    const d = (await AVDB.getState('cifras:hymnal-2022')) || {};
    const v = d[cifraChaveNoDisco(n)];
    return !!(v && v.pagina);
  }, NOMES[2], 15000);
  checar(guardou3 === true,
    'A2 · a música do CRONOGRAMA tem a cifra guardada no aparelho já na abertura, com a escolha desligada',
    porque(guardou3));
  // A asserção seguinte é uma AUSÊNCIA: o que fecha a janela é a rotina parada
  // e mais uma volta do gatilho coalescido do `load()`.
  await parada();
  await pg.waitForTimeout(1800);
  await parada();
  const abertura = await pedidas();
  checar(abertura.length === 1 && abertura[0] === NOMES[2],
    'A3 · e a abertura NÃO pede a cifra de nenhuma outra música do acervo — só a do Cronograma', abertura);

  // ── B. O CRONOGRAMA É GATILHO: acrescentar e trocar. ─────────────────────
  await pg.evaluate(async () => {
    window.__urls = [];
    await AVDB.listAdd('imports', 'crono-3');
    await load();
  });
  const guardou4 = await esperarDb(pg, async (n) => {
    const d = (await AVDB.getState('cifras:hymnal-2022')) || {};
    const v = d[cifraChaveNoDisco(n)];
    return !!(v && v.pagina);
  }, NOMES[3], 15000);
  checar(guardou4 === true, 'B1 · o item ACRESCENTADO ao Cronograma tem a cifra guardada', porque(guardou4));
  await parada();
  const aoAcrescentar = await pedidas();
  checar(aoAcrescentar.length === 1 && aoAcrescentar[0] === NOMES[3],
    'B2 · e só ele foi à rede: as do Cronograma já guardadas são um no-op, e o acervo não é varrido',
    aoAcrescentar);

  const troca = await pg.evaluate(async () => {
    window.__urls = [];
    const b = await AVDB.cronoCriar();          // o novo vira o ativo, vazio
    await AVDB.listAdd('imports', 'crono-4');   // e recebe o hino 5 SEM `load()`
    // O id do PRIMEIRO só existe depois da criação: até ali ele é provisório.
    const a = (await AVDB.cronoLer()).itens.find((x) => x.id !== b.id).id;
    const voltou = await AVDB.cronoTrocar(a);   // volta ao primeiro: o 5 fica guardado em B
    if (!voltou) throw new Error('a troca de volta ao primeiro cronograma não aconteceu');
    await load();
    return { b: b.id };
  });
  await parada();
  checar((await pedidas()).length === 0,
    'B3 · PREMISSA: o hino 5 ainda não foi pedido — ele está num cronograma guardado, não no ativo',
    await pedidas());
  await pg.evaluate((b) => trocarCronograma(b), troca.b);
  const guardou5 = await esperarDb(pg, async (n) => {
    const d = (await AVDB.getState('cifras:hymnal-2022')) || {};
    const v = d[cifraChaveNoDisco(n)];
    return !!(v && v.pagina);
  }, NOMES[4], 15000);
  checar(guardou5 === true, 'B4 · TROCAR para o cronograma com o hino 5 guarda a cifra dele', porque(guardou5));
  await parada();
  const aoTrocar = await pedidas();
  checar(aoTrocar.length === 1 && aoTrocar[0] === NOMES[4],
    'B5 · e só a dele foi pedida', aoTrocar);

  // ── C. A MÚSICA ABERTA é procurada na hora e GRAVADA. ────────────────────
  const aberta = await pg.evaluate(async (arg) => {
    window.__urls = [];
    const item = { id: 'ensaio', name: arg.nome, hymnName: arg.nome, kind: 'audio', hymnAlbum: arg.coll };
    cifraCache.clear();
    cifraGarantir(item);
    for (let i = 0; i < 100; i++) {
      const e = cifraCache.get(cifraChave(item));
      if (e && e.estado !== 'buscando') return { estado: e.estado, rede: window.__urls.length };
      await new Promise((r) => setTimeout(r, 50));
    }
    return { estado: 'nunca resolveu' };
  }, { nome: NOMES[1], coll: coll.nome });
  checar(aberta.estado === 'ok' && aberta.rede > 0,
    'C1 · PREMISSA: a música aberta (fora do Cronograma) foi procurada na rede e achou a folha', aberta);
  const guardou2 = await esperarDb(pg, async (n) => {
    const d = (await AVDB.getState('cifras:hymnal-2022')) || {};
    const v = d[cifraChaveNoDisco(n)];
    return !!(v && v.pagina);
  }, NOMES[1], 5000);
  checar(guardou2 === true, 'C2 · e o desfecho dela foi GRAVADO no aparelho', porque(guardou2));
  const offline = await pg.evaluate(async (arg) => {
    window.__urls = []; window.__semRede = true;
    cifraDiscoColl = ''; cifraDisco = null; cifraCache.clear();
    const item = { id: 'ensaio', name: arg.nome, hymnName: arg.nome, kind: 'audio', hymnAlbum: arg.coll };
    cifraGarantir(item);
    let estado = 'nunca resolveu';
    for (let i = 0; i < 100; i++) {
      const e = cifraCache.get(cifraChave(item));
      if (e && e.estado !== 'buscando') { estado = e.estado; break; }
      await new Promise((r) => setTimeout(r, 50));
    }
    window.__semRede = false;
    return { estado, rede: window.__urls.length };
  }, { nome: NOMES[1], coll: coll.nome });
  checar(offline.estado === 'ok' && offline.rede === 0,
    'C3 · na próxima vez ela abre SEM REDE, sem uma requisição', offline);

  // ── D. A Verificação e o Registro, com a escolha desligada. ──────────────
  const verif = await pg.evaluate(async () => {
    const achada = TESTES.find((c) => c.id === 'cifra-acervo');
    const gs = AVDB.getState;
    // O mapa que REPROVARIA com a escolha ligada: 40 hinos respondidos, nenhuma folha.
    const hinos = Array.from({ length: 40 }, (_, i) => ({ name: 'Hino ' + (i + 1) }));
    const cs = window.collSongs; const cd = window.countDownloaded;
    window.collSongs = () => hinos; window.countDownloaded = () => 40;
    const mapa = {};
    for (const h of hinos) mapa[cifraChaveNoDisco(h.name)] = { semCifra: true, em: Date.now() };
    AVDB.getState = async (k) => (String(k).startsWith('cifras:') ? mapa : gs(k));
    const off = await rodarUmaChecagem(achada);
    cifraAcervoInteiro = true;
    const on = await rodarUmaChecagem(achada);
    cifraAcervoInteiro = false;
    AVDB.getState = gs; window.collSongs = cs; window.countDownloaded = cd;
    await renderDiag();
    const linha = diagTexto.split('\n').find((l) => /guardar todas as cifras:/.test(l)) || '';
    const crono = diagTexto.split('\n').find((l) => /^Cronograma: /.test(l)) || '';
    return { off, on, linha, crono };
  });
  checar(verif.on.v === 'falhou',
    'D0 · PREMISSA: o mesmo acervo, com a escolha LIGADA, reprova (zero folhas em 40)', JSON.stringify(verif.on));
  checar(verif.off.v === 'na' && /desligado/.test(verif.off.nota),
    'D1 · com a escolha DESLIGADA a linha sai NÃO SE APLICA, dizendo por quê', JSON.stringify(verif.off));
  checar(/DESLIGADO/.test(verif.linha),
    'D2 · e o bloco de cifras do Registro diz que guardar todas está desligado', verif.linha);
  checar(/Cronograma: 1 música\(s\) com cifra possível · 1 com resposta guardada/.test(verif.crono),
    'D3 · e conta as do Cronograma ativo', verif.crono);

  // ── E. LIGAR PELA ABA DE CIFRA. ──────────────────────────────────────────
  const aba = await pg.evaluate(async (arg) => {
    window.__urls = [];
    openLyricsPopup({ id: 'ensaio2', name: arg.nome, hymnName: arg.nome, kind: 'audio', hymnAlbum: arg.coll });
    for (let i = 0; i < 100 && !cifraTemFolha(lvItem()); i++) await new Promise((r) => setTimeout(r, 50));
    lvSource = 'cifra';
    renderLyricsView();
    const box = document.querySelector('#lyricsPopup .lv-cifra-acervo');
    const btn = box && box.querySelector('button');
    return { estado: box && box.dataset.estado, texto: btn && btn.textContent };
  }, { nome: NOMES[2], coll: coll.nome });
  checar(aba.estado === 'desligado' && /Deixar todas as cifras disponíveis sem internet/.test(aba.texto || ''),
    'E1 · a aba de cifra oferece o convite, com a escolha desligada', aba);
  await pg.click('#lyricsPopup .lv-cifra-acervo button');
  const gravou = await esperarDb(pg, async () => (await AVDB.getState('cifraAcervoInteiro')) === true, null, 5000);
  checar(gravou === true, 'E2 · o toque GRAVA a escolha', porque(gravou));
  const todas = await esperarDb(pg, async (nomes) => {
    const d = (await AVDB.getState('cifras:hymnal-2022')) || {};
    return nomes.every((n) => { const v = d[cifraChaveNoDisco(n)]; return !!(v && v.pagina); });
  }, NOMES, 15000);
  checar(todas === true, 'E3 · e a varredura do acervo INTEIRO começa: as seis músicas ficam no aparelho',
    porque(todas));
  const ligado = await pg.evaluate(() => {
    const box = document.querySelector('#lyricsPopup .lv-cifra-acervo');
    return { estado: box && box.dataset.estado, texto: box && box.textContent };
  });
  checar(ligado.estado === 'ligado' && /Desligar/.test(ligado.texto || ''),
    'E4 · ligada, a aba mostra o estado e o jeito de desligar', ligado);
  await abrir();
  const depois = await pg.evaluate(() => cifraAcervoInteiro);
  checar(depois === true, 'E5 · e a escolha sobrevive à recarga', depois);
} finally {
  await navegador.close();
  servidor.close();
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
