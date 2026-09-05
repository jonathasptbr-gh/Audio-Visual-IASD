#!/usr/bin/env node
// ============================================================================
// O CLONE CELULAR A CELULAR — a LIGAÇÃO entre os dois aparelhos.
//
// ## Por que este oráculo existe
//
// O `pacote.test.mjs` prende a REGRA (o que falta, o que é chave de decisão, o
// que é um índice válido); este prende a LIGAÇÃO, e ela falha de outro jeito:
// a regra continua certa e o acervo não chega. São dois pela razão de sempre
// neste repositório — *ler cada lado isolado aprova os dois*.
//
// E ele existe porque as três promessas do recurso são MUDAS quando quebram:
//
//  1. **O que não atravessa não avisa.** Um item que fique para trás, a imagem
//     de fundo de estrofe que o catálogo não nomeia, um `stream` que atravessa
//     — a cópia termina sem erro nenhum e o operador descobre no sábado.
//  2. **"Retomável" é a promessa INTEIRA deste recurso**, e ela não tem
//     sintoma: uma segunda passada que rebaixe tudo de novo *funciona* — só
//     leva horas. O que se mede aqui é o número de PEDIDOS.
//  3. **A faixa vai na QUERY.** É a invariante 8: com um cabeçalho `Range` o
//     WebView aplicaria o deslocamento uma segunda vez, e o que chegaria ao
//     acervo do destino seriam bytes deslocados — sem erro em lugar nenhum.
//
// O CENÁRIO É O REAL: dois CONTEXTOS de navegador, com armazenamentos
// separados, como dois celulares. O primeiro semeia e CEDE (monta o índice e
// responde aos pedidos, que é o que o `cloneAtenderPedido` faz no aparelho); o
// servidor deste arquivo faz o papel das rotas `/acervo/` e do `AcervoProxy`; o
// segundo CLONA. Nada é comparado contra o que a origem "achou que mandou": o
// que se afirma é o que o SEGUNDO aparelho tem depois.
//
// ## O que ele NÃO cobre, dito
//
// A DESCOBERTA (mDNS) e o PAREAMENTO ficam de fora: os dois moram inteiros no
// Kotlin (`AcervoDescoberta.kt`, `AcervoCessao.kt`), e o que sobra deles no
// lado web é uma lista desenhada e um `estado` lido. O que este arquivo mede é
// o percurso dos BYTES, que é onde a corrupção silenciosa mora.
//
//   node tools/clone-de-outro-celular.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperar, checar, falhas } from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const PEDACO = 4 * 1024 * 1024;   // o `CLONE_PEDACO` do `controle.js`
const GRANDE = 6 * 1024 * 1024;   // um item acima do pedaço, para o bloco 2

// ---------------------------------------------------------------------------
// O OUTRO CELULAR — as rotas `/acervo/` mais o proxy, num servidor só
//
// Ele fala o MESMO contrato do par `EspelhoServidor` + `AcervoProxy`: a faixa
// vem em `?r=<ini>-<fim>`, a resposta é um **200 seco** (nunca 206), e o
// tamanho total viaja no `X-Av-Total`. Um servidor de mentira mais permissivo
// que o de verdade aprovaria um leitor que o aparelho recusa — foi a lição do
// `tela-rede.test.mjs`, que já entregou o HTML sem a CSP.
// ---------------------------------------------------------------------------
let cedente = null;        // a página do aparelho que CEDE
let indiceServido = null;  // o JSON que ela publicou
let pedidos = [];          // { n, ini, fim } — o diário dos blocos 3 e 5
let semFaixa = 0;          // quem pediu um item sem `?r=` (o `resp.blob()` de volta)
let quebrar409 = -1;       // o item em que o servidor finge um índice remontado
let quebrarRede = -1;      // o item em que ele finge uma queda
const zerarDiario = () => { pedidos = []; semFaixa = 0; quebrar409 = -1; quebrarRede = -1; };

// A DECISÃO DE ROTA É SÍNCRONA, e isso não é estilo: o `servirEstatico` do
// arnês pergunta `if (antes(req, res)) return`, e uma função `async` devolve
// uma **Promise**, que é sempre *truthy* — o servidor engoliria TODA
// requisição, inclusive os arquivos da base, e a página nem carregaria. É a
// mesma armadilha do predicado `async` num `waitForFunction`, num lugar
// diferente. Quem decide devolve `true`/`false`; quem trabalha é o [atender],
// chamado SEM `await`.
const servidor = servirEstatico(RAIZ, (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (!u.pathname.startsWith('/clone/')) return false;
  atender(u, res);
  return true;
});

async function atender(u, res) {
  if (u.pathname === '/clone/indice') {
    if (!indiceServido) { res.writeHead(503).end('{"estado":"montando"}'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(indiceServido);
    return;
  }
  const m = /^\/clone\/item\/([A-Za-z0-9_-]+)\/(\d+)$/.exec(u.pathname);
  if (!m) { res.writeHead(404).end('rota invalida'); return; }
  const sessao = m[1];
  const n = Number(m[2]);
  if (n === quebrarRede) { res.destroy(); return; }
  if (n === quebrar409) { res.writeHead(409).end('{"estado":"indice-trocado"}'); return; }
  const faixa = /^(\d+)-(\d+)$/.exec(u.searchParams.get('r') || '');
  if (!faixa) { semFaixa++; res.writeHead(416).end('sem faixa'); return; }
  const ini = Number(faixa[1]);
  const fim = Number(faixa[2]);
  // O CORPO SAI DA PÁGINA QUE CEDE, e é isso que faz deste oráculo uma prova da
  // LIGAÇÃO: quem monta os bytes é o `cloneCorpoDoItem` de verdade, o mesmo que
  // o `cloneAtenderPedido` chama quando o shell pede.
  let b64 = null;
  try {
    b64 = await cedente.evaluate(async ([sess, idx]) => {
      if (sess !== cloneSessao) return null;
      const blob = await cloneCorpoDoItem(idx);
      if (!blob) return null;
      const u8 = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < u8.length; i += 8192) {
        s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
      }
      return btoa(s);
    }, [sessao, n]);
  } catch (e) { b64 = null; }
  if (b64 == null) { res.writeHead(409).end('{"estado":"indice-trocado"}'); return; }
  const corpo = Buffer.from(b64, 'base64');
  pedidos.push({ n, ini, fim });
  // O ITEM VAZIO RESPONDE 416, como o de verdade: um item com zero bytes torna
  // TODA faixa insatisfazível (RFC 7233), e é isso que o `EspelhoHttp.alcanceDe`
  // devolve. Servir um corpo vazio com 200 aqui seria o servidor de mentira
  // mais permissivo que o de verdade — a lição do `tela-rede.test.mjs`.
  if (corpo.length === 0) { res.writeHead(416).end('vazio'); return; }
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Cache-Control': 'no-store',
    'X-Av-Total': String(corpo.length),
  });
  res.end(corpo.subarray(ini, Math.min(corpo.length, fim + 1)));
}

// ---------------------------------------------------------------------------
// A PONTE de mentira — só o que o clone toca
// ---------------------------------------------------------------------------
const PONTE = `(function () {
  const vazio = { displays: [], listFolder: [], otaPending: '', otaDiag: '',
    espelhoEstado: { ligado: false, telas: [], redes: [] }, espelhoDiag: {},
    castTarget: { label: '' }, apkProcurar: {}, ytDiag: '', cifraDiag: '',
    acervoEstado: { cessao: { cedendo: false }, achados: [], descoberta: {} },
    farolEstado: { conta: true, ultimo: 0, diag: 'de teste' } };
  const comCallId = new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','requestMic','castTarget',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','apkProcurar','otaPending','otaApply',
    'otaCheck','otaDiag','ytDiag','cifraDiag','farolEstado','ytCanalPlaylists','ytPlaylist',
    'ytDetalhes','micDiag','areaTransferencia','salvarTexto','acervoEstado','acervoCeder',
    'acervoPublicar','acervoParear','pacoteCriar','pacoteFechar']);
  const B = {
    shellVersion: () => 65,
    role: () => 'controle',
    appVersion: () => '9.99-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','castTarget',
    'deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar','espelhoCertEstado',
    'espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado','espelhoLigar',
    'keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply','otaCheck',
    'otaDiag','otaPending','pickFolder','pickDoc','requestMic','systemVolume','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio',
    'ytPlaylist','ytSearch','ytStream','farolEstado','projecaoLocal','micDiag','cifraHtml',
    'cifraDiag','areaTransferencia','salvarTexto','ytDetalhes','compartilharTexto',
    'pacoteCriar','pacoteFechar','pacoteCancelar','acervoCeder','acervoPararCessao',
    'acervoPublicar','acervoResponder','acervoProcurar','acervoParear','acervoSoltar',
    'acervoEstado'];
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

/** A mesma pergunta que o `AVPacote.indiceValido` faz, escrita AQUI de
 *  propósito: julgar o app pela função do próprio app é uma tautologia. */
function indiceBemFormado(i) {
  return !!i && (i.v | 0) === 1 && /^[A-Za-z0-9_-]{8,32}$/.test(i.sessao || '')
    && Array.isArray(i.itens) && i.itens.length > 0
    && i.itens.every((x) => x && ['l', 'm', 'o'].includes(x.t) && typeof x.k === 'string');
}

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const base = `http://localhost:${porta}`;
const navegador = await abrirNavegador();

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY|ERR_FAILED/;
async function aparelho() {
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(t);
  });
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperar(pg, () => !document.getElementById('splash'), null, 30000);
  return { ctx, pg };
}

/** Uma passada inteira do laço de cópia, do lado do destino. */
function sincronizar(pg) {
  return pg.evaluate(async () => {
    const contagem = { media: 0, arquivos: 0, chaves: 0, opfs: 0, repetidos: 0 };
    let erro;
    try { erro = await cloneSincronizar(contagem); } catch (e) { erro = (e && e.message) || 'exceção'; }
    return { erro, contagem };
  });
}

try {
  // =========================================================================
  // 1 · O APARELHO QUE CEDE: semear e montar a lista
  // =========================================================================
  const a = await aparelho();
  cedente = a.pg;

  // A SEMENTE cobre as naturezas que o clone carrega, e cada uma está aqui por
  // um motivo:
  //
  //  · uma MÍDIA com bytes, miniatura e letra — o item da biblioteca, mais o
  //    `stream`, que é o campo que NÃO pode atravessar;
  //  · um arquivo do OPFS que o CATÁLOGO NOMEIA — a faixa de uma coleção;
  //  · um arquivo do OPFS que o catálogo NÃO nomeia — a imagem de fundo de uma
  //    estrofe. É ele que prova que a varredura é do DISCO;
  //  · um arquivo GRANDE, acima do pedaço: sem ele, "leu em fatias" e "leu de
  //    uma vez" dão o mesmo resultado;
  //  · uma PREFERÊNCIA, uma LISTA de ids, e uma chave que NÃO viaja.
  await a.pg.evaluate(async (grande) => {
    const bytes = (n, v) => new Blob([new Uint8Array(n).fill(v)], { type: 'audio/mp4' });
    await AVDB.mediaAdd({
      id: 'item-de-teste', name: 'Louvor de teste', kind: 'audio', type: 'audio/mp4',
      blob: bytes(3000, 7), thumb: new Blob([new Uint8Array(40).fill(9)], { type: 'image/jpeg' }),
      url: null, pages: null, videos: null, cue: null, data: null,
      youtubeId: null, height: null, seconds: 12, canal: null,
      stream: { video: { url: 'https://appassets.androidplatform.net/stream/abc' } },
      lyrics: [{ time: 0, text: 'primeira estrofe' }],
      createdAt: 1,
    });
    await AVDB.opfsWriteFile('folders/colecao/001.m4a', bytes(1200, 3));
    await AVDB.fileAdd({
      id: 'arq-de-teste', folder: 'colecao', opfsPath: 'folders/colecao/001.m4a',
      srcName: '001', name: '001 — Faixa', type: 'audio/mp4', kind: 'audio',
      size: 1200, thumb: new Blob([new Uint8Array(20).fill(1)], { type: 'image/jpeg' }),
      blob: null, url: null, addedAt: 1,
    });
    await AVDB.opfsWriteFile('folders/colecao/001-fundo.jpg',
      new Blob([new Uint8Array(500).fill(5)], { type: 'image/jpeg' }));
    await AVDB.opfsWriteFile('folders/colecao/002-grande.m4a', bytes(grande, 11));
    await AVDB.setState('playlist', ['item-de-teste']);
    await AVDB.setState('tema', 'claro');
    // A CHAVE QUE NÃO VIAJA: ela descreve AQUELE aparelho, e chegar ao destino
    // faria o app de lá agir sozinho.
    await AVDB.setState('ota-intencao', { versao: '9.9.9', em: Date.now() });
  }, GRANDE);

  const ind = await a.pg.evaluate(async () => {
    const i = await cloneMontarIndice();
    return { i, receitas: cloneReceitas.length };
  });
  indiceServido = JSON.stringify(ind.i);

  checar(indiceBemFormado(ind.i), '1 · a lista montada é um índice bem formado',
    JSON.stringify(ind.i).slice(0, 200));
  checar(ind.receitas === ind.i.itens.length,
    '1 · e há uma RECEITA para cada item — a posição É o endereço, e duas listas '
    + 'de tamanhos diferentes entregariam o arquivo errado sem erro nenhum',
    ind.receitas + ' × ' + ind.i.itens.length);
  const chaves = ind.i.itens.map((x) => x.t + ':' + x.k);
  checar(chaves.includes('m:item-de-teste'), '1 · a mídia entrou', chaves.join(' '));
  checar(chaves.includes('o:folders/colecao/001.m4a')
    && chaves.includes('o:folders/colecao/001-fundo.jpg'),
    '1 · e os DOIS arquivos do OPFS, inclusive o que o catálogo não nomeia — é '
    + 'ele que prova que a varredura é do disco', chaves.join(' '));
  checar(ind.i.itens.some((x) => x.t === 'l'),
    '1 · e o lote dos LEVES existe: as chaves de `state` não viram um pedido '
    + 'cada — a Bíblia sozinha são 1189 por versão', chaves.join(' '));

  // =========================================================================
  // 2 · O APARELHO QUE CLONA: a cópia inteira
  // =========================================================================
  const b = await aparelho();
  zerarDiario();
  const r1 = await sincronizar(b.pg);
  checar(r1.erro === '', '2 · a cópia termina sem frase de erro', JSON.stringify(r1));
  checar(semFaixa === 0,
    '2 · e NENHUM item foi pedido sem `?r=` — a faixa na query é a invariante 8: '
    + 'com um cabeçalho `Range` o WebView aplicaria o deslocamento duas vezes',
    semFaixa);

  const tem = await b.pg.evaluate(async () => {
    const rec = await AVDB.getMedia('item-de-teste');
    const f = await AVDB.fileGet('arq-de-teste');
    const opfs = {};
    for (const c of ['folders/colecao/001.m4a', 'folders/colecao/001-fundo.jpg',
      'folders/colecao/002-grande.m4a']) {
      try { opfs[c] = (await AVDB.opfsGetFile(c)).size; } catch (_) { opfs[c] = 0; }
    }
    return {
      midia: !!rec,
      bytes: rec && rec.blob ? rec.blob.size : 0,
      thumb: rec && rec.thumb ? rec.thumb.size : 0,
      letra: rec && Array.isArray(rec.lyrics) ? rec.lyrics.length : 0,
      stream: rec ? (rec.stream || null) : 'sem registro',
      catalogo: !!f,
      catThumb: f && f.thumb ? f.thumb.size : 0,
      opfs,
      playlist: await AVDB.getState('playlist'),
      tema: await AVDB.getState('tema'),
      intencao: await AVDB.getState('ota-intencao'),
    };
  });
  checar(tem.midia && tem.bytes === 3000 && tem.thumb === 40 && tem.letra === 1,
    '2 · a MÍDIA chegou inteira — bytes, miniatura e letra', JSON.stringify(tem));
  checar(tem.stream === null,
    '2 · e o `stream` NÃO atravessou: ele é o manifesto de uma transmissão com '
    + 'URLs que expiram em horas e tokens de um proxy que só existe na origem',
    JSON.stringify(tem.stream));
  checar(tem.catalogo && tem.catThumb === 20,
    '2 · o registro de catálogo veio COLADO no arquivo dele — um registro cujo '
    + 'arquivo não chega é uma faixa que aparece na Biblioteca e não toca',
    JSON.stringify(tem));
  checar(tem.opfs['folders/colecao/001.m4a'] === 1200
    && tem.opfs['folders/colecao/001-fundo.jpg'] === 500,
    '2 · os dois arquivos do OPFS chegaram, o nomeado e o que ninguém nomeia',
    JSON.stringify(tem.opfs));
  checar(tem.opfs['folders/colecao/002-grande.m4a'] === GRANDE,
    '2 · e o GRANDE chegou inteiro, montado dos pedaços', tem.opfs['folders/colecao/002-grande.m4a']);
  checar(JSON.stringify(tem.playlist) === '["item-de-teste"]' && tem.tema === 'claro',
    '2 · as chaves de `state` chegaram', JSON.stringify(tem));
  checar(tem.intencao === undefined,
    '2 · e a `ota-intencao` NÃO — ela faria o destino agir sozinho',
    JSON.stringify(tem.intencao));

  // =========================================================================
  // 3 · A RETOMADA — a promessa inteira do recurso, e ela é MUDA
  // =========================================================================
  //
  // Uma segunda passada que rebaixasse tudo de novo *funciona*: o acervo fica
  // certo, e ninguém percebe — só leva horas. O que prova a retomada é o número
  // de PEDIDOS, e a razão de ele cair é que a lista do que falta é DERIVADA do
  // disco a cada passada, nunca guardada.
  zerarDiario();
  const r2 = await sincronizar(b.pg);
  checar(r2.erro === '', '3 · a segunda passada termina sem erro', JSON.stringify(r2));
  const deNovo = [...new Set(pedidos.map((p) => p.n))].map((n) => ind.i.itens[n]).filter(Boolean);
  checar(deNovo.length > 0 && deNovo.every((x) => x.t === 'l'),
    '3 · e ela só pede os LEVES de novo: mídia e arquivos que o disco já tem não '
    + 'voltam a ser baixados (e o `l` volta SEMPRE, porque `state` MESCLA — '
    + '"já tenho a chave" não responde "já tenho o conteúdo dela")',
    JSON.stringify(deNovo.map((x) => x.t + ':' + x.k)));
  checar(deNovo.length < ind.i.itens.length,
    '3 · a lista do que falta ENCOLHEU — é a propriedade que torna o recurso '
    + 'retomável, e ela vem de perguntar ao disco em vez de anotar o progresso',
    deNovo.length + ' de ' + ind.i.itens.length);

  // E A RETOMADA DE UMA CÓPIA INTERROMPIDA. O que ela mede é diferente da
  // asserção acima: ali o acervo já estava completo, aqui ele ficou pela
  // metade — e o que o operador precisa é que a segunda tentativa TERMINE.
  const c = await aparelho();
  zerarDiario();
  quebrarRede = ind.i.itens.findIndex((x) => x.k === 'folders/colecao/002-grande.m4a');
  const r3 = await sincronizar(c.pg);
  checar(r3.erro !== '', '3 · uma queda no meio PARA a cópia com uma frase', JSON.stringify(r3));
  zerarDiario();
  const r4 = await sincronizar(c.pg);
  checar(r4.erro === '', '3 · e a passada seguinte termina', JSON.stringify(r4));
  const chegouDepois = await c.pg.evaluate(async () => {
    try { return (await AVDB.opfsGetFile('folders/colecao/002-grande.m4a')).size; } catch (_) { return 0; }
  });
  checar(chegouDepois === GRANDE,
    '3 · o arquivo que caiu na primeira tentativa chegou na segunda', chegouDepois);

  // =========================================================================
  // 4 · O 409 — o índice remontado do outro lado
  // =========================================================================
  //
  // A página do aparelho que cede pode recarregar no meio (OTA aplicado,
  // renderer remontado), e aí ela monta OUTRA lista. Continuar pedindo por
  // POSIÇÃO entregaria o arquivo de uma coleção sob o caminho de outra — sem
  // erro em lugar nenhum, aparecendo só no sábado seguinte. O 409 é o que
  // impede isso, e ele NÃO é retentável.
  const d = await aparelho();
  zerarDiario();
  quebrar409 = ind.i.itens.findIndex((x) => x.t === 'o');
  const r5 = await sincronizar(d.pg);
  checar(/mudou/i.test(r5.erro || ''),
    '4 · um índice remontado PARA a cópia e diz isso — a frase é a única coisa '
    + 'que separa "insista" de "comece de novo"', JSON.stringify(r5));
  checar(pedidos.filter((p) => p.n === quebrar409).length === 0,
    '4 · e ele não é retentado: insistir pediria a posição de uma lista que já '
    + 'não existe', pedidos.length);

  // =========================================================================
  // 4-B · O ITEM QUE SUMIU do outro aparelho no meio da cópia
  // =========================================================================
  //
  // O índice é uma FOTOGRAFIA, e entre ele e o pedido o operador de lá pode ter
  // apagado uma coleção. O item chega com zero bytes, e aí toda faixa é
  // insatisfazível — 416 pela RFC, que é a resposta certa. **Ele não pode
  // derrubar a cópia inteira**: um registro a menos vira um item pulado, e o
  // resto continua chegando. Sem esta asserção, um acervo de milhares de itens
  // pararia no primeiro que alguém removesse.
  const e = await aparelho();
  // O ARQUIVO SAI DO DISCO DE `a` DEPOIS de o índice ter sido montado — que é
  // exatamente a janela real: o índice é uma FOTOGRAFIA, e o operador de lá
  // pode apagar uma coleção enquanto a cópia anda.
  await a.pg.evaluate(() => AVDB.opfsDeleteFile('folders/colecao/001-fundo.jpg'));
  zerarDiario();
  const r6 = await sincronizar(e.pg);
  checar(r6.erro === '', '4-B · um item que sumiu no meio NÃO derruba a cópia',
    JSON.stringify(r6));
  const sobrou = await e.pg.evaluate(async () => {
    const abre = async (c) => { try { return (await AVDB.opfsGetFile(c)).size; } catch (_) { return 0; } };
    return {
      sumido: await abre('folders/colecao/001-fundo.jpg'),
      resto: await abre('folders/colecao/001.m4a'),
      midia: !!(await AVDB.getMedia('item-de-teste')),
    };
  });
  checar(sobrou.sumido === 0 && sobrou.resto === 1200 && sobrou.midia === true,
    '4-B · e o que existe continua chegando — o item some, o resto não',
    JSON.stringify(sobrou));

  // =========================================================================
  // 4-C · O TIPO QUE ESTE APP NÃO CONHECE
  // =========================================================================
  //
  // Um aparelho mais atualizado pode oferecer uma natureza de item que este não
  // sabe receber. As duas saídas fáceis são erradas: recusar o índice inteiro
  // deixa o operador sem clone nenhum, e ignorar em silêncio faz a tela anunciar
  // "tudo copiado" sobre uma cópia incompleta. Ele é PULADO, CONTADO, e vira
  // uma frase — no diálogo de SUCESSO, porque a cópia de fato terminou.
  const comFuturo = JSON.parse(indiceServido);
  comFuturo.itens.push({ t: 'z', k: 'de-uma-versao-nova', b: 1 });
  indiceServido = JSON.stringify(comFuturo);
  const f = await aparelho();
  zerarDiario();
  const r7 = await sincronizar(f.pg);
  checar(r7.erro === '',
    '4-C · um tipo desconhecido não derruba a cópia — o resto entra', JSON.stringify(r7));
  checar(r7.contagem.desconhecidos === 1,
    '4-C · e ele é CONTADO, para a tela não anunciar "tudo copiado" sobre uma '
    + 'cópia incompleta', JSON.stringify(r7.contagem));
  const pediuOFuturo = pedidos.some((p) => p.n === comFuturo.itens.length - 1);
  checar(pediuOFuturo === false,
    '4-C · e nem chega a ser pedido: o app não saberia o que fazer com os bytes',
    JSON.stringify(pedidos.map((p) => p.n)));
  indiceServido = JSON.stringify(ind.i);

  // =========================================================================
  // 5 · A FAIXA — nenhum pedido acima do pedaço combinado
  // =========================================================================
  const maior = pedidos.concat([{ ini: 0, fim: -1 }])
    .reduce((m, p) => Math.max(m, p.fim - p.ini + 1), 0);
  checar(maior <= PEDACO,
    '5 · nenhuma janela passa do pedaço combinado — é ele que mantém o corpo '
    + 'dentro do teto do proxy, que lê a resposta INTEIRA em memória', maior);
  checar(erros.length === 0, '5 · e nada foi ao console', erros.slice(0, 3).join(' | '));

  await a.ctx.close();
  await b.ctx.close();
  await c.ctx.close();
  await d.ctx.close();
  await e.ctx.close();
  await f.ctx.close();
} catch (e) {
  falhas.push('exceção: ' + (e && e.message));
  console.log('FALHOU  exceção: ' + (e && e.stack));
}

await navegador.close();
servidor.close();

if (falhas.length) {
  console.log('\nFALHAS (' + falhas.length + '):');
  for (const f of falhas) console.log('  - ' + f);
  process.exit(1);
}
console.log('\nTodos passaram.');
