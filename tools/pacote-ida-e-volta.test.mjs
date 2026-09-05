#!/usr/bin/env node
// ============================================================================
// O PACOTE DE TRANSFERÊNCIA, DE IDA E VOLTA — de um aparelho para outro.
//
// ## Por que este oráculo existe
//
// O `pacote.test.mjs` prende a REGRA do formato; este prende a LIGAÇÃO, e ela
// falha de outro jeito: a regra continua certa e o acervo não chega. São dois
// arquivos porque *ler cada lado isolado aprova os dois* — é a lição do `__tela`
// e a do `fundo-da-letra`.
//
// E ele existe porque a promessa deste recurso não tem sintoma quando quebra:
//
//  1. **O que não atravessa não avisa.** Um `blob` que fique para trás, uma
//     imagem de fundo de estrofe que o catálogo não nomeia, uma lista que não
//     se soma — o pacote importa sem erro nenhum, e o operador descobre no
//     sábado que o hinário tem a letra e não tem o som.
//  2. **"Importar só ACRESCENTA" é uma promessa, e promessa sem oráculo é
//     documentação.** Um `put` no lugar de um `add` passa por cima do que já
//     estava no aparelho, em silêncio — e o que se perde é o acervo de quem
//     importou.
//
// O CENÁRIO É O REAL: dois CONTEXTOS de navegador, com armazenamentos
// separados, como dois celulares. O primeiro semeia e exporta; os bytes voltam
// para o Node e entram no segundo, que importa. Nada é comparado contra o que a
// exportação "achou que escreveu": o que se afirma é o que o SEGUNDO aparelho
// tem depois.
//
//   node tools/pacote-ida-e-volta.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperar, esperarDb, checar, falhas } from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

// ---------------------------------------------------------------------------
// A PONTE, com o CANAL DE BYTES de mentira
//
// Ele é o `PacoteCanal.kt` reduzido ao que o lado web enxerga: recebe
// `ArrayBuffer`, acumula, e responde `{r: total}` — que é o ACK que libera o
// bloco seguinte. Sem responder, o empurrão para no primeiro bloco e o oráculo
// mediria o próprio arnês.
// ---------------------------------------------------------------------------
const PONTE = `(function () {
  window.__saida = [];
  const canal = {
    postMessage(m) {
      if (typeof m === 'string') {
        setTimeout(() => canal.onmessage({ data: JSON.stringify({ ok: true }) }), 0);
        return;
      }
      window.__saida.push(new Uint8Array(m));
      let total = 0;
      for (const p of window.__saida) total += p.length;
      setTimeout(() => canal.onmessage({ data: JSON.stringify({ r: total }) }), 0);
    },
    onmessage: null,
  };
  window.__avPacote = canal;

  const vazio = { displays: [], listFolder: [], otaPending: '', otaDiag: '',
    espelhoEstado: { ligado: false, telas: [], redes: [] }, espelhoDiag: {},
    castTarget: { label: '' }, apkProcurar: {}, ytDiag: '', cifraDiag: '',
    farolEstado: { conta: true, ultimo: 0, diag: 'de teste' } };
  const comCallId = new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','requestMic','castTarget',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','apkProcurar','otaPending','otaApply',
    'otaCheck','otaDiag','ytDiag','cifraDiag','farolEstado','ytCanalPlaylists','ytPlaylist',
    'ytDetalhes','micDiag','areaTransferencia','salvarTexto']);
  const B = {
    shellVersion: () => 63,
    role: () => 'controle',
    appVersion: () => '9.99-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    compartilharTexto: () => {},
    pacoteCancelar: () => { window.__cancelado = (window.__cancelado || 0) + 1; },
    pacoteCriar: (id) => {
      setTimeout(() => window.__avResolve(id, 'acervo-de-teste.avpkg'), 0);
    },
    pacoteFechar: (id) => {
      let total = 0;
      for (const p of (window.__saida || [])) total += p.length;
      setTimeout(() => window.__avResolve(id, total), 0);
    },
    // O ARQUIVO ESCOLHIDO na importação. Ele chega como uma \`/saf/<token>\`
    // servível no aparelho; aqui é um \`blob:\` do próprio documento — o que o
    // lado web faz com ele é o mesmo \`fetch\` + \`Blob.slice()\` nos dois casos.
    pickDoc: (id) => {
      const bytes = window.__entrada || null;
      const url = bytes
        ? URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' }))
        : '';
      setTimeout(() => window.__avResolve(id, url ? [{ url, name: 'acervo-de-teste.avpkg', type: '' }] : []), 0);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','castTarget',
    'deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar','espelhoCertEstado',
    'espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado','espelhoLigar',
    'keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply','otaCheck',
    'otaDiag','otaPending','pickFolder','requestMic','systemVolume','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio',
    'ytPlaylist','ytSearch','ytStream','farolEstado','projecaoLocal','micDiag','cifraHtml',
    'cifraDiag','areaTransferencia','salvarTexto','ytDetalhes'];
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

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const base = `http://localhost:${porta}`;
const navegador = await abrirNavegador();

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY|ERR_FAILED/;
async function aparelho(entrada) {
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
  if (entrada) await pg.addInitScript(`window.__entrada = ${JSON.stringify(entrada)};`);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperar(pg, () => !document.getElementById('splash'), null, 30000);
  return { ctx, pg };
}

// O diálogo do fim é MODAL e a Promise dele só resolve num toque. Quem opera
// aperta "Entendi"; aqui o oráculo faz o mesmo, pelo botão de verdade.
async function responderDialogo(pg) {
  const abriu = await esperar(pg, () => {
    const d = document.getElementById('appDialog');
    return !!d && d.classList.contains('open');
  }, null, 60000);
  if (abriu !== true) return abriu;
  const texto = await pg.evaluate(() => document.getElementById('appDialogMsg').textContent);
  await pg.click('#appDialogOk');
  return texto;
}

try {
  // =========================================================================
  // 1 · O APARELHO DE ORIGEM: semear e exportar
  // =========================================================================
  const a = await aparelho(null);

  // A SEMENTE cobre as QUATRO prateleiras que o pacote carrega, e cada uma
  // está aqui por um motivo:
  //
  //  · uma MÍDIA com bytes e miniatura — o item da biblioteca;
  //  · um arquivo do OPFS que o CATÁLOGO NOMEIA — a faixa de uma coleção;
  //  · um arquivo do OPFS que o catálogo NÃO nomeia — a imagem de fundo de uma
  //    estrofe. É ele que prova que a varredura é do DISCO: um pacote montado
  //    pelo catálogo chega ao destino com o hinário e as estrofes sobre preto;
  //  · uma PREFERÊNCIA e uma LISTA de ids.
  await a.pg.evaluate(async () => {
    const bytes = (n, v) => new Blob([new Uint8Array(n).fill(v)], { type: 'audio/mp4' });
    await AVDB.mediaAdd({
      id: 'item-de-teste', name: 'Louvor de teste', kind: 'audio', type: 'audio/mp4',
      blob: bytes(3000, 7), thumb: new Blob([new Uint8Array(40).fill(9)], { type: 'image/jpeg' }),
      url: null, pages: null, videos: null, cue: null, data: null,
      youtubeId: null, height: null, seconds: 12, canal: null,
      // O `stream` É SEMEADO de propósito: ele é o campo que NÃO pode
      // atravessar, e sem ele aqui a asserção lá embaixo não teria dente.
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
    await AVDB.setState('lyricsFont', 'grande-de-teste');
    await AVDB.setState('favs', ['item-de-teste']);
    // A PASTA DO APARELHO, com um arquivo dentro. Ela é o corte declarado do
    // recurso — as concessões do SAF não existem no outro celular —, e sem ela
    // semeada aqui a asserção do corte não teria o que recusar.
    await AVDB.setState('opfs-folders', [{ id: 'pasta-do-celular', name: 'Vídeos', uri: 'content://x' }]);
    await AVDB.opfsWriteFile('folders/pasta-do-celular/culto.mp4',
      new Blob([new Uint8Array(700).fill(2)], { type: 'video/mp4' }));
  });

  await a.pg.evaluate(() => { window.__fim = exportarPacote(); });
  const resumo = await responderDialogo(a.pg);
  checar(typeof resumo === 'string' && /acervo-de-teste\.avpkg/.test(resumo),
    '1 · a exportação termina dizendo o NOME e o tamanho do arquivo', resumo);

  const saida = await a.pg.evaluate(() => {
    const partes = window.__saida;
    let n = 0;
    for (const p of partes) n += p.length;
    const u8 = new Uint8Array(n);
    let o = 0;
    for (const p of partes) { u8.set(p, o); o += p.length; }
    return Array.from(u8);
  });
  checar(saida.length > 4000, '1 · e os bytes de verdade saíram pelo canal', saida.length);
  await a.ctx.close();

  // =========================================================================
  // 2 · O APARELHO DE DESTINO: importar num armazenamento VAZIO
  // =========================================================================
  const b = await aparelho(saida);

  const antes = await b.pg.evaluate(async () => (await AVDB.mediaChaves()).length);
  checar(antes === 0, '2 · o aparelho de destino começa VAZIO — contextos separados são celulares separados', antes);

  // A importação termina num `location.reload()`, e ele é parte do recurso (as
  // listas do módulo foram lidas uma vez, no `init()`). O oráculo espera pela
  // NAVEGAÇÃO, não por um prazo.
  const recarregou = b.pg.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await b.pg.evaluate(() => { window.__fim = importarPacote(); });
  const conta = await responderDialogo(b.pg);
  checar(typeof conta === 'string' && /entraram neste aparelho/.test(conta),
    '2 · a importação termina contando o que entrou', conta);
  await recarregou;
  await esperar(b.pg, () => !document.getElementById('splash'), null, 30000);

  // ── O ACERVO CHEGOU ────────────────────────────────────────────────────
  const chegou = await b.pg.evaluate(async () => {
    const rec = await AVDB.getMedia('item-de-teste');
    const lerOpfs = async (p) => { try { return (await AVDB.opfsGetFile(p)).size; } catch (_) { return -1; } };
    return {
      nome: rec && rec.name,
      blob: rec && rec.blob ? rec.blob.size : -1,
      thumb: rec && rec.thumb ? rec.thumb.size : -1,
      letra: rec && Array.isArray(rec.lyrics) ? rec.lyrics.length : -1,
      stream: rec ? (rec.stream === undefined ? 'ausente' : 'presente') : '?',
      arquivo: await lerOpfs('folders/colecao/001.m4a'),
      fundo: await lerOpfs('folders/colecao/001-fundo.jpg'),
      pastaDoCelular: await lerOpfs('folders/pasta-do-celular/culto.mp4'),
      catalogo: (await AVDB.fileGet('arq-de-teste'))?.name || '',
      pref: await AVDB.getState('lyricsFont'),
      favs: await AVDB.getState('favs'),
      pastas: await AVDB.getState('opfs-folders'),
    };
  });

  checar(chegou.nome === 'Louvor de teste' && chegou.blob === 3000,
    '2 · a MÍDIA chegou com os bytes — não o registro sozinho', chegou);
  checar(chegou.thumb === 40, '2 · e com a MINIATURA, que viaja num registro próprio depois dela', chegou.thumb);
  checar(chegou.letra === 1, '2 · e com a LETRA, que é o que faz a faixa valer no destino', chegou.letra);
  checar(chegou.arquivo === 1200 && chegou.catalogo === '001 — Faixa',
    '2 · o arquivo do OPFS e o registro do catálogo que o nomeia chegaram juntos', chegou);
  // A ASSERÇÃO QUE JUSTIFICA A VARREDURA SER DO DISCO. Um pacote montado pelo
  // catálogo chegaria com o hinário inteiro e as estrofes sobre preto — e nada
  // erraria, em lugar nenhum.
  checar(chegou.fundo === 500,
    '2 · e a IMAGEM DE FUNDO da estrofe também, que NENHUM registro do catálogo nomeia', chegou.fundo);
  checar(chegou.pref === 'grande-de-teste' && String(chegou.favs) === 'item-de-teste',
    '2 · a preferência e a lista de favoritos vieram junto', chegou);

  // ── E O QUE NÃO PODE CHEGAR, NÃO CHEGOU ────────────────────────────────
  checar(chegou.stream === 'ausente',
    '2 · o `stream` NÃO atravessou: é um manifesto expirado com tokens de um proxy do outro aparelho',
    chegou.stream);
  checar(chegou.pastaDoCelular === -1 && !chegou.pastas,
    '2 · e a PASTA DO APARELHO ficou para trás, com os arquivos dela — as concessões do SAF '
    + 'não existem aqui, e uma pasta que não pode ser relida o app lê como "sumiu do aparelho"',
    { arquivo: chegou.pastaDoCelular, catalogo: chegou.pastas });

  // =========================================================================
  // 3 · IMPORTAR DE NOVO NÃO PODE APAGAR NADA
  // =========================================================================
  //
  // É a promessa inteira do recurso, e ela existe porque importar duas vezes é
  // o que de fato acontece quando alguém não tem certeza se deu certo da
  // primeira. A prova é feita com o LOCAL DIFERENTE do pacote: se o `add`
  // virasse `put`, o registro renomeado e a preferência trocada voltariam ao
  // que estão no arquivo — em silêncio.
  await b.pg.evaluate(async () => {
    await AVDB.renameMedia('item-de-teste', 'Nome que o operador deu');
    await AVDB.setState('lyricsFont', 'escolha-de-quem-importou');
    await AVDB.setState('favs', ['outro-item']);
  });
  const recarregou2 = b.pg.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await b.pg.evaluate(() => { window.__fim = importarPacote(); });
  await responderDialogo(b.pg);
  await recarregou2;
  await esperar(b.pg, () => !document.getElementById('splash'), null, 30000);

  const depois = await b.pg.evaluate(async () => ({
    nome: (await AVDB.getMedia('item-de-teste')).name,
    pref: await AVDB.getState('lyricsFont'),
    favs: await AVDB.getState('favs'),
    quantos: (await AVDB.mediaChaves()).length,
  }));
  checar(depois.nome === 'Nome que o operador deu',
    '3 · o registro RENOMEADO no destino sobrevive a uma segunda importação — `add`, nunca `put`',
    depois.nome);
  checar(depois.pref === 'escolha-de-quem-importou',
    '3 · e a preferência de quem importou também: numa chave que já existe, o LOCAL vence',
    depois.pref);
  checar(String(depois.favs) === 'outro-item,item-de-teste',
    '3 · mas a LISTA de ids se SOMA, na ordem local primeiro — a playlist de quem importa '
    + 'não é reordenada por um arquivo', depois.favs);
  checar(depois.quantos === 1, '3 · e nada é duplicado', depois.quantos);

  await b.ctx.close();

  // =========================================================================
  // 4 · UM PACOTE CORTADO NO MEIO É RECUSADO INTEIRO
  // =========================================================================
  //
  // É a asserção que a CONFERÊNCIA À FRENTE existe para tornar verdadeira. Sem
  // ela, o arquivo truncado seria APLICADO até onde os bytes vão e a recusa
  // chegaria depois — com meia biblioteca dentro e a tela dizendo "não deu para
  // importar". A prova é feita num aparelho VAZIO: nada pode ter entrado.
  {
    const cortado = saida.slice(0, Math.floor(saida.length * 0.6));
    const c = await aparelho(cortado);
    await c.pg.evaluate(() => { window.__fim = importarPacote(); });
    const frase = await responderDialogo(c.pg);
    checar(typeof frase === 'string' && /incompleto/.test(frase),
      '4 · um pacote cortado no meio é RECUSADO, e a frase diz por quê', frase);
    const entrou = await c.pg.evaluate(async () => ({
      media: (await AVDB.mediaChaves()).length,
      pref: await AVDB.getState('lyricsFont'),
    }));
    checar(entrou.media === 0 && entrou.pref === undefined,
      '4 · e NADA entrou — a conferência roda antes de a primeira linha ser gravada', entrou);
    await c.ctx.close();
  }

  checar(erros.length === 0, 'nenhum erro de console', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
