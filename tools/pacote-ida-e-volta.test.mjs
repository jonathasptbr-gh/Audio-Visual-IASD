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
// ===== O ARQUIVO ESCOLHIDO É SERVIDO POR JANELA (v1.7.9) =====
//
// No aparelho o `.avpkg` chega como uma `/saf/<token>` e o lado web o lê em
// FATIAS (`?r=<ini>-<fim>`), porque o caminho antigo — `resp.blob()` — não
// existe mais: ele materializava o arquivo inteiro, e quinze gigabytes não
// cabem em lugar nenhum.
//
// A ROTA DAQUI FALA O MESMO CONTRATO do `SafJanela.kt`, e é isso que a torna
// uma prova: um servidor de mentira mais permissivo que o de verdade aprovaria
// um leitor que o aparelho recusa. Um `blob:` — que era o que este oráculo
// entregava — não tem query nenhuma, e por ele o leitor novo nem sairia do
// lugar.
let pacoteServido = null;   // Uint8Array — o arquivo que o "aparelho B" escolhe
// O DIÁRIO DA LEITURA. É por ele que o bloco 5 mede o que não tem sintoma:
// quantas janelas foram pedidas, de que tamanho, e se alguém pediu o arquivo
// SEM faixa — que é o `resp.blob()` de volta.
let janelas = [];
let semFaixa = 0;
const zerarDiario = () => { janelas = []; semFaixa = 0; };
const bytesLidos = () => janelas.reduce((t, j) => t + (j.fim - j.ini + 1), 0);

const servidor = servirEstatico(RAIZ, (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname !== '/pacote-de-teste') return false;
  if (!pacoteServido) { res.writeHead(404).end('sem pacote'); return true; }
  const m = /^(\d+)-(\d+)$/.exec(u.searchParams.get('r') || '');
  if (!m) { semFaixa++; res.writeHead(416).end('sem faixa'); return true; }
  const ini = Number(m[1]);
  const fim = Number(m[2]);
  if (fim < ini) { res.writeHead(416).end('faixa invertida'); return true; }
  janelas.push({ ini, fim });
  const fatia = pacoteServido.subarray(ini, Math.min(pacoteServido.length, fim + 1));
  res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(Buffer.from(fatia));
  return true;
});

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
    // O ARQUIVO ESCOLHIDO na importação. No aparelho ele é uma
    // \`/saf/<token>\` que o shell serve POR JANELA; aqui é a rota do próprio
    // servidor do oráculo, que fala o mesmo contrato.
    //
    // O \`size\` ENTROU NO SHELL 64 e é obrigatório: sem ele o leitor não sabe
    // onde o arquivo acaba. \`-1\` é "o provedor não disse", e o app para com
    // frase própria — é o que o bloco 5 mede.
    pickDoc: (id) => {
      const tam = window.__tamEntrada;
      const achou = typeof tam === 'number';
      setTimeout(() => window.__avResolve(id, achou
        ? [{ url: '/pacote-de-teste', name: 'acervo-de-teste.avpkg', type: '', size: tam }]
        : []), 0);
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
  if (entrada) {
    pacoteServido = Uint8Array.from(entrada);
    await pg.addInitScript(`window.__tamEntrada = ${entrada.length};`);
  }
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

// A FOLHA DE ESCOLHA (v1.7.2) abre ANTES do "Salvar como", e ela é uma
// resposta: a Promise do `exportarPacote` fica esperando por ela. O oráculo
// aperta o confirmar de VERDADE, que é o que quem opera faz — e assim o
// caminho da folha entra na cobertura deste percurso de graça.
async function confirmarGrupos(pg) {
  const abriu = await esperar(pg, () => {
    const d = document.getElementById('songMenuPopup');
    return !!d && d.classList.contains('open') && !!d.querySelector('.song-menu-go');
  }, null, 60000);
  if (abriu !== true) return abriu;
  const linhas = await pg.evaluate(() => [...document.querySelectorAll('#songMenuList li')]
    .map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim()));
  await pg.click('#songMenuList .song-menu-go');
  return linhas;
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
    // UM CORPO GRANDE, e ele existe só para o bloco 5: com os corpos dominando
    // o arquivo, "a conferência leu os corpos" e "não leu" são dois números
    // separados por um fator de dois. Com a semente toda em bytes contados, os
    // dois seriam indistinguíveis do ruído dos cabeçalhos.
    await AVDB.opfsWriteFile('folders/colecao/002-grande.m4a',
      new Blob([new Uint8Array(512 * 1024).fill(11)], { type: 'audio/mp4' }));
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
  const grupos = await confirmarGrupos(a.pg);
  checar(Array.isArray(grupos) && grupos.length >= 2,
    '1 · a folha de escolha abre com os grupos e o confirmar', JSON.stringify(grupos));
  // O GRUPO FIXO ESTÁ NA LISTA E DIZ POR QUÊ. As listas do app moram em
  // `state`, e mídia sem a lista que a referencia é órfã no destino — o
  // coletor a apaga na abertura seguinte. É a única linha que não se desmarca,
  // e sem a frase ela seria uma caixa que não responde ao toque.
  checar(Array.isArray(grupos) && grupos.some((t) => /Ajustes e catálogos/.test(t)
    && /sempre vai junto/.test(t)),
    '1 · com "Ajustes e catálogos" fixo e dizendo que vai junto', JSON.stringify(grupos));
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
  zerarDiario();
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
  // 5 · O ARQUIVO É LIDO POR JANELAS, E A CONFERÊNCIA NÃO LÊ OS CORPOS (v1.7.9)
  // =========================================================================
  //
  // Relato do operador: *"Não estou conseguindo importar os dados, 'failed to
  // fetch' era um arquivo de 15GB. Tentei em um arquivo de 3,52GB e ele deu
  // erro como se o arquivo estivesse corrompido."*
  //
  // Eram dois defeitos, e NENHUM dos dois tem sintoma num arquivo pequeno —
  // que é a razão de este bloco medir o COMO e não o desfecho: o percurso
  // inteiro dos blocos 1 a 4 passava com o leitor antigo.
  //
  //  · **`resp.blob()` materializava o arquivo inteiro** antes do primeiro byte
  //    ser lido. A asserção é a AUSÊNCIA de um pedido sem faixa: o leitor de
  //    hoje nunca busca o documento inteiro, e o de ontem só sabia fazer isso.
  //  · **e o `/saf/` tem teto de 2 GB** (o `available()` do Chromium é `int` —
  //    ver o `SafJanela.kt`), então uma janela grande demais devolve o arquivo
  //    CORTADO sem erro nenhum. A asserção é o TAMANHO da maior janela.
  //  · **a conferência percorre o arquivo inteiro** antes de gravar a primeira
  //    linha, e ela lê só cabeçalhos: com os corpos, um pacote de gigabytes
  //    seria lido DUAS vezes. A asserção é aritmética — o total lido fica perto
  //    do tamanho do arquivo, não perto do dobro.
  const maior = janelas.reduce((m, j) => Math.max(m, j.fim - j.ini + 1), 0);
  checar(semFaixa === 0 && janelas.length > 1,
    '5 · o arquivo é lido por JANELAS, e NUNCA de uma vez — um pedido sem faixa '
    + 'é o `resp.blob()` de volta, e ele é o que não cabe em quinze gigabytes',
    { semFaixa, janelas: janelas.length });
  checar(maior > 0 && maior <= 8 * 1024 * 1024,
    '5 · e nenhuma janela passa do PEDAÇO — acima do teto do `SafJanela` o '
    + 'aparelho devolve o arquivo cortado, sem erro nenhum',
    { maior, teto: 8 * 1024 * 1024 });
  checar(bytesLidos() < saida.length * 1.5,
    '5 · e a CONFERÊNCIA não lê os corpos: ela percorre o arquivo inteiro pelos '
    + 'cabeçalhos, e lê-los duas vezes dobraria a importação de um acervo',
    { lidos: bytesLidos(), arquivo: saida.length });

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

  // =========================================================================
  // 6 · SEM O TAMANHO, A IMPORTAÇÃO PARA E DIZ (v1.7.9)
  // =========================================================================
  //
  // O `size` do `pickDoc` entrou no shell 64 e é o que diz ao leitor onde o
  // arquivo acaba. Um provedor de documentos pode não informá-lo, e o que NÃO
  // pode acontecer ali é o leitor seguir mesmo assim: `size` ausente vira `-1`,
  // e `-1` lido como "zero bytes" faria um pacote bom ser recusado como vazio —
  // ou, pior, um laço de janelas sem fim.
  //
  // A ASSERÇÃO É A FRASE, e não só a recusa: "não deu para importar" sem dizer
  // o quê manda o operador repetir a tentativa que acabou de falhar.
  {
    const d = await aparelho(saida);
    await d.pg.evaluate(() => { window.__tamEntrada = -1; window.__fim = importarPacote(); });
    const frase = await responderDialogo(d.pg);
    checar(typeof frase === 'string' && /tamanho/.test(frase),
      '6 · sem o tamanho do arquivo a importação PARA, e a frase nomeia o que '
      + 'faltou', frase);
    const entrou = await d.pg.evaluate(async () => (await AVDB.mediaChaves()).length);
    checar(entrou === 0, '6 · e nada entrou', entrou);
    await d.ctx.close();
  }

  // =========================================================================
  // 7 · UM PACOTE DANIFICADO DIZ ONDE ELE QUEBROU (v1.8.0)
  // =========================================================================
  //
  // O número não diz nada a quem opera, e é justamente ele que diz tudo a quem
  // conserta: um pacote que quebra no byte 0 é outro defeito que um que quebra
  // em 3,4 GB — o primeiro é o arquivo errado, o segundo é o LEITOR. E essa
  // diferença é a única pista que existe quando o relato chega por mensagem de
  // texto, de outro aparelho, dias depois (foi exatamente o que aconteceu com a
  // v1.7.9: *"O pacote está danificado, o app não reconhece o conteúdo dele"*,
  // e não havia como saber onde).
  //
  // A ASSERÇÃO É QUE O NÚMERO É A POSIÇÃO, e não um zero constante — que é como
  // ele nasceria se alguém o lesse do lugar errado.
  {
    const sujo = Uint8Array.from(saida);
    // O ESTRAGO TEM DE CAIR NUM CABEÇALHO, e por isso o oráculo PERCORRE o
    // arquivo em vez de escolher uma fração dele. MEDIDO ao escrever este
    // bloco: 50% do pacote cai dentro do corpo de 3 MB, os bytes trocados são
    // conteúdo de mídia, e a importação termina INTEIRA — a asserção
    // reprovaria por um cenário que não existe.
    //
    // A caminhada é a mesma do cursor, escrita AQUI de propósito: usar o
    // `pacoteCursor` do app para achar onde estragar o app seria uma
    // tautologia.
    const dv = new DataView(sujo.buffer);
    let p = 8;                       // depois da assinatura
    let alvoByte = -1;
    while (p + 4 < sujo.length) {
      const n = dv.getUint32(p, true);
      if (n <= 0 || p + 4 + n > sujo.length) break;
      const cab = JSON.parse(new TextDecoder().decode(sujo.subarray(p + 4, p + 4 + n)));
      // O PRIMEIRO cabeçalho passado de um terço do arquivo: fundo o bastante
      // para o número não poder ser confundido com "o começo".
      if (p > sujo.length / 3) { alvoByte = p; break; }
      p = p + 4 + n + (cab.bytes | 0);
    }
    checar(alvoByte > 0, '7 · o oráculo achou um cabeçalho fundo para estragar', alvoByte);
    for (let i = 0; i < 8; i++) sujo[alvoByte + i] = 0xFF;
    const e = await aparelho(sujo);
    await e.pg.evaluate(() => { window.__fim = importarPacote(); });
    const frase = await responderDialogo(e.pg);
    checar(typeof frase === 'string' && /danificado/.test(frase),
      '7 · um pacote com um cabeçalho estragado é recusado', frase);
    // A UNIDADE NÃO ENTRA NA ASSERÇÃO — quem a escolhe é o `fmtBytes`, e prendê-la
    // aqui faria este bloco reprovar no dia em que ele ganhar um degrau novo. O
    // que se afirma é que há um número DEPOIS de "byte" e que ele não é zero:
    // zero constante é como ele nasceria se alguém o lesse do lugar errado.
    const onde = /parou no byte (.+?)\)/.exec(String(frase));
    checar(!!onde && !/^0\b/.test(onde[1].trim()),
      '7 · e a frase diz em QUE BYTE a leitura parou — zero constante seria o '
      + 'número lido do lugar errado', frase);
    await e.ctx.close();
  }

  checar(erros.length === 0, 'nenhum erro de console', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
