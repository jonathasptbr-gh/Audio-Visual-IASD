// UMA RESOLUÇÃO DE LINK EM VOO PERDE A VEZ PARA A PROJEÇÃO SEGUINTE (v1.4.18)
//
// ## O relato
//
// *"ao tocar em um item do tipo link, ele começa a carregar, em seguida eu toco
// em uma música normal nativa, a música começa a tocar, mas o link que estava
// carregando não é interrompido, e quando termina de carregar ele vem sobre a
// música que tocou na hora. ou seja, o método de músicas via link não se
// interrompe corretamente ao tocar outra coisa logo em seguida."*
//
// ## Por que ele existe
//
// Resolver um `kind: 'youtube'` é a espera mais longa do app: uma extração de
// rede de SEGUNDOS (`ytStream`) e, falhando ela, um download de MINUTOS. O
// desfecho chegava sem perguntar a ninguém se ainda era esperado — `send` no
// fim, cena trocada, louvor cortado na frente da congregação.
//
// **É a terceira vez que esta base encontra a mesma classe**, e as duas
// anteriores já têm oráculo e nome: o `lyricLoadSeq` (o download do áudio de uma
// letra avulsa) e o `projecaoSeq` (o capítulo da Bíblia que chega tarde). A
// senha aqui é a MESMA daquele — quem projeta qualquer coisa a incrementa.
//
// ## O que só um arnês mede
//
// A JANELA é o recurso inteiro: entre o toque no link e o desfecho há uma
// espera que o oráculo precisa CONTROLAR, senão não existe "meio". A ponte de
// mentira segura o `ytStream` e o `ytFetch` até este arquivo mandar soltar — é
// isso que torna o defeito determinístico em vez de uma corrida.
//
// E o desfecho é PERMANENTE e silencioso: nada quebra, nada aparece no console,
// e o operador só percebe porque o louvor parou. Por isso as asserções medem o
// `currentTime` do `<video>` em dois instantes — "não pausou" é fraco; "andou"
// prova que é o MESMO áudio, ainda correndo por baixo.
//
//   node tools/link-perde-a-vez.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

// A ponte de mentira, com as DUAS esperas seguras: `ytStream` (a extração) e
// `ytFetch` (o download). Sem elas as duas resolveriam no mesmo tique e não
// haveria janela nenhuma para medir.
const PONTE = `(() => {
  window.__streamPedido = 0;
  window.__fetchPedido = 0;
  const segurar = (id, bandeira, valor) => {
    const espera = () => {
      if (window[bandeira]) { try { window.__avResolve(id, valor()); } catch (_) {} return; }
      setTimeout(espera, 20);
    };
    espera();
  };
  const B = {
    shellVersion: () => 60,
    role: () => 'controle',
    appVersion: () => '1.99-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    ytDiag: (id) => { setTimeout(() => { try { window.__avResolve(id, ''); } catch (_) {} }, 0); },
    ytStream: (id) => {
      window.__streamPedido++;
      segurar(id, '__soltarStream', () => window.__manifesto || null);
    },
    ytFetch: (id) => {
      window.__fetchPedido++;
      segurar(id, '__soltarFetch', () => window.__arquivo || null);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal','castTarget',
    'cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','espelhoLigarEm','espelhoDerrubar','farolContar','farolEstado','keepAlive',
    'listFolder','micDiag','nowPlaying','openCast','openExternal','otaApply','otaCheck','otaDiag',
    'otaPending','pickDoc','pickFolder','requestMic','salvarTexto','systemVolume','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDiscard','ytFetchAte','ytFetchAudio',
    'ytPlaylist','ytSearch','areaTransferencia','atualizacaoEstado'];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...a) => {
      const id = a[0];
      if (typeof id === 'string') setTimeout(() => { try { window.__avResolve(id, null); } catch (_) {} }, 0);
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

// O WAV que o "download" entrega. Ele é servido pelo mesmo servidor do bundle
// porque o `ytBaixarNativo` BUSCA a URL que o shell devolve — um arquivo de
// mentira que não existisse faria o caminho falhar por outro motivo.
function wav(segundos) {
  const sr = 8000, n = sr * segundos;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 20) * 3000), 44 + i * 2);
  return b;
}
const BAIXADO = wav(20);

const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/baixado.wav') {
    res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': BAIXADO.length });
    res.end(BAIXADO); return;
  }
  if (p.endsWith('/')) p += 'index.html';
  const arquivo = path.join(RAIZ, p);
  if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404); res.end('nao'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
});

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

// 30 s de propósito: as asserções comparam o `currentTime` em dois instantes, e
// uma faixa que acabasse no meio responderia "parada" por ter TERMINADO.
const SEMEAR = `
  const sr = 8000, secs = 30, n = sr * secs;
  const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  wr(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
  const a = await AVDB.addMedia(new Blob([buf], { type: 'audio/wav' }),
    { name: 'Louvor nativo', type: 'audio/wav', kind: 'audio', list: 'imports' });
  const l1 = await AVDB.addUrlMedia('https://www.youtube.com/watch?v=aaaaaaaaaaa', {
    kind: 'youtube', type: 'video/youtube', name: 'Link do YouTube',
    youtubeId: 'aaaaaaaaaaa', list: 'imports' });
  const l2 = await AVDB.addUrlMedia('https://www.youtube.com/watch?v=bbbbbbbbbbb', {
    kind: 'youtube', type: 'video/youtube', name: 'Outro link',
    youtubeId: 'bbbbbbbbbbb', list: 'imports' });
  const l3 = await AVDB.addUrlMedia('https://www.youtube.com/watch?v=ccccccccccc', {
    kind: 'youtube', type: 'video/youtube', name: 'Terceiro link',
    youtubeId: 'ccccccccccc', list: 'imports' });
`;

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;

try {
  const pg = await ctx.newPage();
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(t);
  });
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 20000 });

  const ids = await pg.evaluate(new Function('return (async () => {'
    + 'setAppMode("full");' + SEMEAR
    + 'await load(); return { audio: a.id, l1: l1.id, l2: l2.id, l3: l3.id }; })()'));

  // O manifesto de mentira é VP9/Opus: o Chromium do Playwright não traz codec
  // proprietário, e um `avc1+aac` seria RECUSADO pelo `AVStream.suportado` — o
  // fluxo cairia no download e o arquivo mediria outra coisa que não o que diz.
  await pg.evaluate((u) => {
    window.__manifesto = {
      name: 'Video do YouTube', seconds: 30, height: 1080,
      video: { mime: 'video/webm; codecs="vp9"', url: u + '/nada.webm', init: [0, 1], index: [0, 1] },
      videos: [],
      audio: { mime: 'audio/webm; codecs="opus"', url: u + '/nada2.webm', init: [0, 1], index: [0, 1] },
    };
    window.__arquivo = { url: u + '/baixado.wav', name: 'Baixado', size: 0,
      type: 'audio/wav', height: 0, seconds: 20 };
  }, base);

  const estado = () => pg.evaluate(() => {
    const v = document.querySelector('#preview video') || document.querySelector('video');
    const c = document.getElementById('pvBusy');
    return {
      currentId, nome: currentItem ? currentItem.name : null,
      kind: currentItem ? currentItem.kind : null,
      tocando: !!v && !v.paused, tempo: v ? +v.currentTime.toFixed(2) : null,
      // A VISIBILIDADE do cartão é a classe `on`, não o `hidden`: o elemento
      // existe sempre, e ler o `textContent` sem a classe descreveria um cartão
      // que não está na tela.
      cartao: c && c.classList.contains('on')
        ? (c.textContent || '').replace(/\s+/g, ' ').trim() : null,
      // QUAL LINHA A LISTA PINTA COMO "no ar". É o que o operador vê, e é a
      // única prova do desfecho que não passa pela cena: um link abandonado que
      // se declarasse no ar acenderia a linha ERRADA sobre uma música certa.
      noAr: [...document.querySelectorAll('.lib-item.no-ar,.row-item.no-ar')]
        .map((e) => e.dataset.id),
    };
  });

  // ======================================================================
  // METADE 1 — A TRANSMISSÃO EM VOO PERDE A VEZ
  // ======================================================================
  await pg.evaluate((id) => { send(id); }, ids.l1);   // sem await: ele fica preso na extração
  await pg.waitForTimeout(600);
  const carregando = await estado();
  checar((await pg.evaluate(() => window.__streamPedido)) === 1 && /Preparando/.test(carregando.cartao || ''),
    'o toque no LINK começa a extração e anuncia "Preparando" (o cenário)', carregando);

  await pg.evaluate((id) => send(id), ids.audio);
  await pg.waitForTimeout(1200);
  const comMusica = await estado();
  checar(comMusica.kind === 'audio' && comMusica.tocando && comMusica.tempo > 0,
    'a MÚSICA NATIVA entra e toca, com o link ainda carregando', comMusica);

  // O CARTÃO SAI NO MESMO TOQUE. Sem isto a tela diz "Preparando <link>" sobre
  // uma música que já está tocando — o app anunciando uma coisa e fazendo outra
  // —, e o cartão fica ali pelos MINUTOS de um download.
  checar(comMusica.cartao === null,
    '[relato] e o cartão "Preparando" do link SAI no mesmo toque — ele não fica '
    + 'sobre a música que já está no ar', comMusica.cartao);

  await pg.evaluate(() => { window.__soltarStream = true; });
  await pg.waitForTimeout(2500);
  const depois = await estado();
  checar(depois.currentId === comMusica.currentId && depois.kind === 'audio',
    '[relato] e quando o link TERMINA de carregar ele NÃO entra em cena',
    { antes: comMusica.nome, depois: depois.nome });
  checar(depois.tocando && depois.tempo > comMusica.tempo + 0.5,
    'a música ANDOU o tempo todo — "não pausou" é fraco, "andou" prova que é o mesmo áudio',
    { de: comMusica.tempo, ate: depois.tempo });

  // E ELE NÃO SE DECLARA NO AR. A cena é a metade que se ouve; esta é a que se
  // VÊ, e ela falha sozinha: `resolverLinkInterno` marcava a origem
  // (`midiaNoArOrigem`) assim que a transmissão dizia ter dado certo, então a
  // linha do LINK acendia como "no ar" sobre uma música que estava tocando.
  // Duas linhas contando histórias diferentes na mesma tela.
  checar(depois.noAr.includes(ids.audio) && !depois.noAr.includes(ids.l1),
    'e a linha marcada como "no ar" é a da MÚSICA — o link abandonado não se '
    + 'declara em cena', { noAr: depois.noAr, musica: ids.audio, link: ids.l1 });

  // ======================================================================
  // METADE 2 — E ELE NÃO CAI NO DOWNLOAD
  // ======================================================================
  //
  // A transmissão que perde a vez não pode escorregar para o passo seguinte da
  // escada: seriam MINUTOS de rede (e o serviço em primeiro plano, e o wake
  // lock) por um toque que o operador já substituiu — e terminaria projetando
  // por cima, que é o defeito inteiro por outra porta.
  checar((await pg.evaluate(() => window.__fetchPedido)) === 0,
    'a transmissão abandonada NÃO escorrega para o download: nenhum byte pedido',
    await pg.evaluate(() => window.__fetchPedido));

  // ======================================================================
  // METADE 3 — SEM INTERRUPÇÃO, O LINK PROJETA
  // ======================================================================
  //
  // Sem ela, "nunca projetar um link" passaria nas duas primeiras — e o recurso
  // inteiro teria sido apagado em nome da correção.
  await pg.evaluate(() => { window.__soltarStream = false; });
  await pg.evaluate((id) => { send(id); }, ids.l2);
  await pg.waitForTimeout(500);
  await pg.evaluate(() => { window.__soltarStream = true; });
  await pg.waitForTimeout(2500);
  const feliz = await estado();
  checar(feliz.kind === 'video' && feliz.currentId !== comMusica.currentId,
    'sem interrupção o link resolve e VAI AO AR, como sempre', feliz);

  // ======================================================================
  // METADE 4 — O DOWNLOAD TAMBÉM PERDE A VEZ, E O ARQUIVO FICA
  // ======================================================================
  //
  // É a espera LONGA — minutos, não segundos —, e por isso o caso mais caro dos
  // dois. E o desfecho é ASSIMÉTRICO de propósito: o arquivo já foi baixado e já
  // tomou o lugar do link na lista do operador (`trocarLinkPeloArquivo`), que é
  // valor durável e foi o que o toque pediu. O que ele não pode é subir ao palco.
  await pg.evaluate(() => { window.__manifesto = null; window.__soltarStream = true; });
  await pg.evaluate((id) => { send(id); }, ids.l3);
  await pg.waitForFunction(() => window.__fetchPedido > 0, null, { timeout: 15000 });
  await pg.evaluate((id) => send(id), ids.audio);
  await pg.waitForTimeout(1200);
  const comMusica2 = await estado();
  checar(comMusica2.kind === 'audio' && comMusica2.tocando,
    'com o DOWNLOAD em curso, a música nativa entra e toca', comMusica2);

  await pg.evaluate(() => { window.__soltarFetch = true; });
  await pg.waitForTimeout(3000);
  const depois2 = await estado();
  checar(depois2.currentId === comMusica2.currentId,
    '[relato] e o DOWNLOAD que termina depois NÃO entra em cena',
    { antes: comMusica2.nome, depois: depois2.nome });
  checar(depois2.tocando && depois2.tempo > comMusica2.tempo + 0.5,
    'e a música ANDOU durante todo o download', { de: comMusica2.tempo, ate: depois2.tempo });

  const contouFetch = await pg.evaluate(() => window.__fetchPedido);
  const naLista = await pg.evaluate(async (linkId) => {
    const ids2 = await AVDB.listIds('imports');
    const recs = await AVDB.listItems('imports');
    return { temOLink: ids2.includes(linkId), kinds: recs.map((r) => r.kind) };
  }, ids.l3);
  checar(!naLista.temOLink && naLista.kinds.includes('audio'),
    'mas O ARQUIVO FICA: ele tomou o lugar do link na lista, e da próxima vez '
    + 'aquela linha toca do disco', naLista);

  // ======================================================================
  // METADE 5 — A OUTRA PORTA: O "TOCAR AGORA" DA BUSCA
  // ======================================================================
  //
  // `ytAcaoInterno` é o caminho da folha de destinos, e ele tem a MESMA espera e
  // o MESMO desfecho — mas não passa pelo `resolverLinkYoutube`, então nenhuma
  // das guardas acima o alcança. Foi assim que a v1.4.6 pôs o reconhecimento do
  // toque numa porta e deixou a outra de fora; a lição está no comentário do
  // `resolverLinkYoutube`, e este caso é ela cobrada.
  await pg.evaluate(() => { window.__soltarFetch = false; window.__manifesto = null; });
  await pg.evaluate((u) => {
    ytAcao({ id: 'ddddddddddd', url: 'https://www.youtube.com/watch?v=ddddddddddd',
      name: 'Da busca' }, ['tocar'], null, false, 1080);
  }, base);
  await pg.waitForFunction((n) => window.__fetchPedido > n, contouFetch, { timeout: 15000 });
  await pg.evaluate((id) => send(id), ids.audio);
  await pg.waitForTimeout(1200);
  const comMusica3 = await estado();
  checar(comMusica3.kind === 'audio' && comMusica3.tocando,
    'com o "Tocar agora" da BUSCA baixando, a música nativa entra e toca', comMusica3);
  await pg.evaluate(() => { window.__soltarFetch = true; });
  await pg.waitForTimeout(3000);
  const depois3 = await estado();
  checar(depois3.currentId === comMusica3.currentId
    && depois3.tocando && depois3.tempo > comMusica3.tempo + 0.5,
    'e o download da BUSCA que termina depois também NÃO entra em cena',
    { antes: comMusica3.nome, depois: depois3.nome, de: comMusica3.tempo, ate: depois3.tempo });

  checar(erros.length === 0,
    'nenhum erro de console no percurso' + (erros.length ? ':\n        ' + erros.join('\n        ') : ''));
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) { console.log('\n' + falhas.length + ' FALHA(S)'); process.exit(1); }
console.log('\nTodos passaram.');
