// O BOOT COMO O APP O FAZ — a base web com a PONTE presente.
//
// ## Por que ele existe
//
// O `smoke.mjs` sobe a base web num Chromium sem `__AVBridge`, e isso é
// deliberado: ali se verifica o que vale nos dois contextos. O preço, que
// ninguém tinha cobrado até a v5.195, é que **todo caminho guardado por
// `window.__NATIVE__` nunca é executado por teste nenhum** — e esses caminhos
// são exatamente os que só rodam no aparelho, onde não há console para olhar.
//
// A v5.195 saiu com um `const` lido na CARGA do módulo e declarado 14 mil
// linhas abaixo. A leitura mora dentro de `if (espelhoDisponivel())`, que é
// FALSO num navegador — então o `smoke.mjs` passou verde, o bundle foi para o
// OTA, e o aparelho abriu em PRETO: `ReferenceError` por zona morta temporal,
// `controle.js` abortado, o watchdog do OTA descartando o bundle no lançamento
// seguinte e o app caindo no embutido do APK. Três sintomas em sequência
// (tela preta → tela pela metade → a versão antiga de volta) para uma causa só,
// e nenhum teste tinha como vê-la.
//
// Este arquivo fecha esse buraco pelo caminho mais barato que existe: injeta um
// `__AVBridge` DE MENTIRA antes de a página carregar e pergunta a mesma coisa
// que o watchdog do OTA pergunta — **o app ficou de pé?** (`otaAppIsUp`, em
// `shared/native.js`). Se ficou, o bundle boota no aparelho; se não, ele
// abriria em preto lá.
//
// ## O que ele NÃO é
//
// Não é teste dos recursos nativos: a ponte responde valores vazios e
// plausíveis, não simula Presentation, download, nem servidor. O que se afirma
// aqui é só o boot — que é precisamente o que o watchdog decide, e o que custa
// um culto quando falha.
//
//   node tools/boot-nativo.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arquivo = path.join(RAIZ, p);
  if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404); res.end('nao'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
});

const falhas = [];
function checar(cond, msg) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg); falhas.push(msg); }
}

// A PONTE DE MENTIRA. A lista de métodos sai de um `grep` em `shared/native.js`
// (todo `B.<nome>(`) — um método novo lá que este arquivo não conheça responde
// `undefined`, que é o mesmo que um shell antigo faria, e o `try` do
// `native.js` já trata. O contrato do lado Kotlin é assíncrono por `callId`:
// quem chama espera `window.__avResolve(id, json)`, então os métodos com
// `callId` resolvem sozinhos no próximo tique.
const ponteCom = (espelho, telas) => `(() => {
  const vazio = { displays: ${JSON.stringify(telas || [])}, listFolder: [], pickDoc: [], ytSearch: [],
    espelhoEstado: ${JSON.stringify(espelho)}, espelhoDiag: {},
    espelhoCertEstado: { temCert: false }, castTarget: { label: 'Tela de teste' } };
  const comCallId = new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','requestMic','castTarget',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','espelhoCertImportar','espelhoCertApagar',
    'apkProcurar','apkInstalar','otaPending','otaApply','otaCheck','otaDiag','ytDiag']);
  const B = {
    shellVersion: () => 40,
    role: () => 'controle',
    appVersion: () => '1.93-teste',
    takeShare: () => '',
    busPost: (t) => { try { (window.__enviados = window.__enviados || []).push(JSON.parse(t)); } catch (_) {} },
    otaConfirm: () => {},
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','castTarget',
    'deckDiscard','deckExportUrl','deckPages','displays','espelhoAprovar','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply',
    'otaCheck','otaDiag','otaPending','pickDoc','pickFolder','requestMic','systemVolume',
    'temaClaro','ytCancel','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio','ytSearch',
    'ytStream'];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      if (!comCallId.has(n)) return undefined;
      // O primeiro argumento é o \`callId\` nas chamadas com Promise.
      const id = args[0];
      if (typeof id === 'string') {
        const v = Object.prototype.hasOwnProperty.call(vazio, n) ? vazio[n] : null;
        setTimeout(() => { try { window.__avResolve(id, v); } catch (_) {} }, 0);
      }
      return undefined;
    };
  }
  // O CANAL DE MÍDIA da tela (o shell o injeta quando a transmissão sobe): é a
  // única condição de que o reenvio de preferências depende de verdade.
  window.__avTelaMidia = { postMessage: () => {} };
  window.__AVBridge = B;
})();`;

// O DESLIGADO é o estado de partida; o segundo cenário é o do OPERADOR.
const PONTE = ponteCom({ ligado: false, telas: [] }, []);

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
const pg = await ctx.newPage();
const base = `http://localhost:${porta}`;

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;
pg.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
  erros.push(t);
});
pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });

  checar(await pg.evaluate(() => window.__NATIVE__ === true),
    'a base entra em MODO APP (a ponte foi vista)');
  checar(await pg.evaluate(() => (window.__SHELL_VERSION__ | 0) >= 32),
    'e enxerga um shell que tem o espelho — é este ramo que o navegador nunca executa');

  // A MESMA PERGUNTA DO WATCHDOG. `otaAppIsUp` é o que decide, no aparelho, se
  // um bundle baixado é carimbado como bom ou descartado no lançamento
  // seguinte: papel `controle`, os três módulos compartilhados, o `__avBack` do
  // fim do `controle.js` e um `<li>` na playlist (que só existe depois de o
  // `init()` assíncrono terminar). Reusá-la é não inventar um segundo critério
  // que envelheceria à parte do primeiro.
  let deuPe = false;
  try {
    await pg.waitForFunction(
      () => window.AVDB && window.AVStream && window.createStage
        && typeof window.__avBack === 'function'
        && !!document.querySelector('#playlist li'),
      null, { timeout: 25000 },
    );
    deuPe = true;
  } catch (_) { deuPe = false; }
  checar(deuPe, 'O APP FICOU DE PÉ com a ponte presente (o critério do watchdog do OTA)');

  // E o bloco de conexão do Modo Fácil, que é o caminho que a v5.195 quebrou:
  // com shell >= 32 ele mostra as DUAS formas de conectar, não só o espelhar.
  const conn = await pg.evaluate(() => {
    const c = document.getElementById('castConn');
    const rede = document.getElementById('castNetRow');
    const sm = document.getElementById('simpleMode');
    const busca = document.getElementById('simpleSearchBtn');
    const bb = busca && busca.getBoundingClientRect();
    return {
      achou: !!c,
      pai: c && c.parentElement ? (c.parentElement.id || c.parentElement.className) : '',
      redeVisivel: !!rede && !rede.hidden,
      semTela: sm.classList.contains('sem-tela'),
      // O BLOQUEIO, medido pelo que o operador vê e não por uma classe: a
      // cortina está no ar e cobre a tela inteira, e a busca — que ela esconde —
      // não está desenhada. (A v5.199 afirmava aqui exatamente o contrário; ver
      // o comentário de `renderSimpleGate` sobre por que ela caiu e voltou.)
      cortinaNoAr: (() => {
        const v = document.getElementById('simpleVeil');
        if (!v || v.hidden) return false;
        const r = v.getBoundingClientRect();
        return r.width >= innerWidth - 1 && r.height >= innerHeight - 1;
      })(),
      buscaVisivel: !!bb && bb.width > 2 && bb.height > 2,
    };
  });
  checar(conn.achou && conn.semTela && conn.pai === 'simpleConn',
    'sem tela, o bloco de conexão é o que fica legível (pai: ' + conn.pai + ')');
  checar(conn.redeVisivel,
    'e ele oferece as DUAS formas — espelhar para a TV e transmitir para navegador');
  // O BLOQUEIO (v5.203, de volta a pedido do operador). Sem tela este modo não
  // projeta nada — nem imagem nem som —, e a cortina é o que diz isso.
  checar(conn.cortinaNoAr && !conn.buscaVisivel,
    'SEM TELA A TELA FICA BLOQUEADA: a cortina cobre tudo e a busca sai de cena');

  // ---- SEM TELA NENHUMA, O SOM SAI DESTE APARELHO (v5.215) --------------
  //
  // A regra vive num ramo que o `smoke.mjs` não alcança: sem ponte não há
  // `lastDisplays` nem transmissão, e é a CONEXÃO que decide. O que se mede é o
  // efeito, não a variável sozinha — `pvVideo.muted` é o que o alto-falante
  // obedece, e é ele que a `setForceMuted` acerta.
  //
  // O segundo caso é o portão de MODO: voltar ao Modo Fácil emudece, porque lá
  // sem tela a cortina já cobre tudo (o caso acima) e som atrás dela seria a
  // única coisa acontecendo. Ele também devolve o `localStorage` ao
  // simplificado — é dele que a página seguinte parte.
  const somSemTela = await pg.evaluate(() => {
    const v = document.getElementById('pvVideo');
    setAppMode('full');
    const avancado = { local: somLocal, mudo: v.muted };
    setAppMode('simple');
    const facil = { local: somLocal, mudo: v.muted };
    return { avancado, facil };
  });
  checar(somSemTela.avancado.local && !somSemTela.avancado.mudo,
    'NO AVANÇADO SEM TELA a preview deixa de ser muda — o som é deste aparelho');
  checar(!somSemTela.facil.local && somSemTela.facil.mudo,
    'e no Modo Fácil ela volta a ser muda (lá a cortina cobre tudo)');

  // ---- E A OUTRA METADE DA REGRA: uma tela ENTRANDO fecha a folha (v5.193) --
  //
  // O par do caso de baixo, e o que impede a correção da v5.217 de virar "a
  // folha nunca mais fecha sozinha": quem acabou de conectar terminou o que
  // veio fazer ali. A tela entra num turno só, com a folha já aberta — é a
  // BORDA que a regra sempre quis descrever.
  const fechaAoEntrar = await pg.evaluate(() => {
    setAppMode('full');
    abrirCast();
    const abriu = document.getElementById('castPopup').classList.contains('open');
    mirrorEstado = { ligado: true, telas: [{ rotulo: 'tela B', pronta: true }] };
    renderSimpleGate();
    const fechou = !document.getElementById('castPopup').classList.contains('open');
    mirrorEstado = null;
    fecharCast();
    setAppMode('simple');   // devolve o `localStorage` — a página seguinte parte daqui
    return { abriu, fechou };
  });
  checar(fechaAoEntrar.abriu && fechaAoEntrar.fechou,
    'uma tela ENTRANDO com a folha aberta continua fechando-a (a borda, não o nível)');

  // ---- O ESTADO EM QUE O OPERADOR DE FATO OPERA -------------------------
  //
  // Transmissão LIGADA, telas na rede recebendo, e NENHUMA TV. É a
  // configuração normal desta igreja desde a v5.187 (sem TV, as telas da rede
  // SÃO a projeção) — e é uma combinação que o primeiro percurso não cobre: lá
  // o espelho nasce desligado, então metade do `renderCast`, o
  // `acertarEnqueteDeFundo` e o caminho DESTRAVADO do Modo Fácil nunca correm.
  //
  // Uma página NOVA, e não um `mirrorEstado = …` na de cima: o que se quer
  // provar é que o bundle SOBE assim, com o estado presente desde o primeiro
  // instante — que é como o aparelho o encontra ao abrir com a transmissão já
  // no ar. Mexer no estado de uma página já de pé provaria outra coisa.
  const pg2 = await ctx.newPage();
  const erros2 = [];
  pg2.on('pageerror', (e) => erros2.push('pageerror: ' + e.message));
  pg2.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros2.push(t);
  });
  await pg2.addInitScript(ponteCom(
    { ligado: true, endereco: 'http://192.168.0.14:8787',
      telas: [{ rotulo: 'tela A', conectadaMs: 90000, pronta: true }] },
    [],
  ));
  await pg2.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  let deuPe2 = false;
  try {
    await pg2.waitForFunction(
      () => window.AVDB && window.AVStream && window.createStage
        && typeof window.__avBack === 'function'
        && !!document.querySelector('#playlist li'),
      null, { timeout: 25000 },
    );
    deuPe2 = true;
  } catch (_) { deuPe2 = false; }
  checar(deuPe2, 'O APP FICA DE PÉ com a transmissão JÁ LIGADA e telas na rede');

  // E a célula da preview tem de ser a PREVIEW, não a conexão: sem TV, as telas
  // da rede são a projeção (v5.193), então há tela e não há o que conectar.
  const comTela = await pg2.evaluate(() => ({
    semTela: document.getElementById('simpleMode').classList.contains('sem-tela'),
    connEscondido: document.getElementById('simpleConn').hidden,
    cortinaNoAr: !document.getElementById('simpleVeil').hidden,
    modo: appMode,
  }));
  checar(!comTela.semTela && comTela.connEscondido && !comTela.cortinaNoAr,
    'e a tela DESTRAVA: sem TV, as telas da rede contam como tela');

  // E O SOM CONTINUA SENDO DAS TELAS (v5.215). É a metade que protege o
  // desfecho que a mesa de som produzia: cada tela da rede toca o próprio
  // arquivo no `<video>` dela, e um celular somando a própria saída seria o
  // mesmo louvor duas vezes na sala — fora do compasso, porque são dois
  // decodificadores. Vale mesmo no modo avançado, que é onde o som local
  // existe.
  const somComTela = await pg2.evaluate(() => {
    const v = document.getElementById('pvVideo');
    setAppMode('full');
    return { local: somLocal, mudo: v.muted, tela: algumaTelaConectada() };
  });
  checar(somComTela.tela && !somComTela.local && somComTela.mudo,
    'COM TELA DA REDE RECEBENDO este aparelho fica mudo, inclusive no avançado');

  // ---- A FOLHA DE CONEXÃO ABRE COM TELA JÁ CONECTADA (v5.217) -----------
  //
  // O relato: com o ícone de cast no estado CONECTADO (vermelho), tocar nele
  // não abria nada. Ele abria — e a folha se fechava sozinha em milissegundos,
  // porque o fecho automático da v5.193 era um teste de NÍVEL ("há tela?") e
  // não de BORDA ("uma tela entrou?"). O próprio `abrirCast` liga a enquete,
  // a enquete chama `renderSimpleGate`, e o nível é verdadeiro o tempo todo
  // enquanto houver tela.
  //
  // A espera é maior que um ciclo da enquete (`MIRROR_POLL_MS` = 2,5 s) de
  // propósito: o defeito precisa de uma leitura do estado para se manifestar,
  // e afirmar "abriu" no instante do clique passaria com ele no lugar.
  // O clique e a leitura no MESMO turno: entre dois `evaluate` cabe o
  // `setTimeout(0)` com que a ponte de mentira resolve o `espelhoEstado`, e a
  // primeira metade do defeito passaria a depender de quem ganha essa corrida.
  const abriuNaHora = await pg2.evaluate(() => {
    document.getElementById('pvCastBtn').click();
    return document.getElementById('castPopup').classList.contains('open');
  });
  await pg2.waitForTimeout(3200);
  const continuaAberta = await pg2.evaluate(() => ({
    aberta: document.getElementById('castPopup').classList.contains('open'),
    conectado: document.getElementById('pvCastBtn').classList.contains('connected'),
  }));
  checar(abriuNaHora, 'o toque no ícone de cast ABRE a folha de conexão');
  checar(continuaAberta.conectado && continuaAberta.aberta,
    'e ela CONTINUA aberta com tela conectada — a enquete não a fecha sozinha');
  checar(erros2.length === 0,
    'nenhum erro de console no percurso com a transmissão ligada'
    + (erros2.length ? ':\n        ' + erros2.join('\n        ') : ''));
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

// ---------------------------------------------------------------------------
// A METADE CONSUMIDORA DO `__tela` (v5.222)
//
// Uma tela da rede não tem o IndexedDB do celular: wallpaper, fundo da letra e
// preenchimento têm de ser REENVIADOS a ela quando conecta, e quem faz isso é
// `telaReenviarPreferencias`, disparado por `if (msg.__tela)` no
// `display-ready`. O produtor do campo é o `tela.js` e está travado no
// `tela-rede.test.mjs`; esta é a outra ponta.
//
// As duas existem porque foi a DIVERGÊNCIA entre elas que passou despercebida
// desde a v5.188: o consumidor exigia o campo, o produtor nunca o mandava, e
// não havia erro em lugar nenhum — só três preferências que não chegavam.
// Travar um lado só deixaria o par livre para divergir de novo.
try {
  const pg3 = await ctx.newPage();
  await pg3.addInitScript(ponteCom(
    { ligado: true, endereco: 'http://192.168.0.9:8787', erro: '',
      telas: [{ rotulo: 'A', comando: true, conectadaMs: 5000, telaAcesaMin: 0,
                aviso: '', eventos: 2, pronta: true, fila: 0 }] }, []));
  await pg3.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg3.waitForFunction(() => !!window.__avBack, null, { timeout: 20000 });
  // O operador tem "imagens" ligado, persistido de um culto anterior.
  await pg3.evaluate(() => window.AVDB.setState('lyricsBg', 'image'));
  await pg3.reload({ waitUntil: 'domcontentloaded' });
  await pg3.waitForFunction(() => !!window.__avBack, null, { timeout: 20000 });
  await pg3.waitForTimeout(600);

  // Uma tela da rede se anuncia — exatamente como o `tela.js` a anuncia.
  await pg3.evaluate(() => {
    window.__enviados = [];
    new BroadcastChannel('av-iasd').postMessage(
      { type: 'display-ready', __de: 'tela-1', __tela: 'tela-1', __mid: 'bn:1' });
  });
  await pg3.waitForTimeout(1200);
  const mandados = await pg3.evaluate(() => (window.__enviados || []).map((m) => m.type));
  checar(mandados.includes('lyricsbg'),
    'o display-ready com __tela faz o Controle reenviar o fundo da letra',
    'emitiu: ' + JSON.stringify(mandados));

  // E o CONTRÁRIO: o telão de verdade (sem `__tela`) não recebe esse reenvio —
  // ele lê tudo do IndexedDB sozinho, e mandar de novo seria ruído na conexão.
  await pg3.evaluate(() => {
    window.__enviados = [];
    new BroadcastChannel('av-iasd').postMessage(
      { type: 'display-ready', __de: 'telao-1', __mid: 'bn:2' });
  });
  await pg3.waitForTimeout(1000);
  const semTela = await pg3.evaluate(() => (window.__enviados || []).map((m) => m.type));
  checar(!semTela.includes('lyricsbg'),
    'e o display-ready SEM __tela (o telão de verdade) não dispara o reenvio',
    'emitiu: ' + JSON.stringify(semTela));
  await pg3.close();
} catch (e) {
  checar(false, 'o percurso do __tela terminou sem exceção (' + (e && e.message) + ')');
}

checar(erros.length === 0, 'nenhum erro de console' + (erros.length ? ':\n        ' + erros.join('\n        ') : ''));

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
