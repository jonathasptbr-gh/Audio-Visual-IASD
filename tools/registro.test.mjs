// O REGISTRO — o diagnóstico que o operador COPIA E REPASSA.
//
// ## Por que ele existe
//
// Este é o único artefato do app cujo consumidor é um HUMANO A DISTÂNCIA. Todo
// o resto falha na frente de quem pode ver: uma tela preta, um botão morto, um
// vídeo que não entra. O Registro falha de outro jeito — ele CONTINUA
// RESPONDENDO, com uma frase errada, e quem a lê vai investigar o que ela diz.
//
// E ele nunca tinha sido carregado por teste nenhum. O `smoke.mjs` abre o
// Controle, o `boot-nativo` confirma o boot com a ponte, e nenhum dos dois
// chega a montar o bloco da transmissão. Foi por aí que passou o defeito que
// esta suíte nasce para travar (v5.206):
//
//   · o `EspelhoDiag` publicava `ritmo` ZERADO — o produtor (`amostra()`, o
//     encoder H.264) morreu na v5.187 e o campo continuou saindo —, e o
//     `blocoEspelho` lê `kbps < 40` como "isto é um retângulo preto". Num culto
//     normal (transmissão ligada, vídeo tocando, cortina aberta) o Registro
//     imprimia `ALARME: ISTO É UM RETÂNGULO PRETO`;
//   · `linhasDaTela(undefined)` devolvia "(esta tela ainda nao relatou medidas
//     — bundle antigo…)", então TODA tela conectada saía acusada de rodar um
//     bundle velho;
//   · `mirrorJson` publicava `modo: "comandos"` e o consumidor comparava com
//     `'video'`, imprimindo "modo: imagem (JPEG)" — um modo removido na v5.156.
//
// Os três têm a mesma forma, e é ela que este arquivo vigia: **um consumidor
// que sobreviveu ao produtor não fica em silêncio — ele lê o valor ausente
// (zero, `undefined`, string vazia) como se fosse resposta.**
//
// ## O que ele faz
//
// Injeta uma ponte cujo `espelhoDiag` devolve EXATAMENTE a forma que o Kotlin
// produz hoje (`MainActivity.mirrorDiag`: o diário do `EspelhoDiag` mais
// `servidor`, `servico` e `ligado`) e abre o Registro. A régua é dupla:
//
//   1. NENHUMA palavra de recurso aposentado aparece no texto;
//   2. o que o operador foi buscar APARECE — endereço, telas, diário.
//
// A régua 2 não é enfeite: sem ela, apagar o bloco inteiro passaria neste
// teste.
//
//   node tools/registro.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

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

// ---------------------------------------------------------------------------
// O QUE O SHELL DE VERDADE DEVOLVE HOJE.
//
// Copiado da forma real, não inventado: `EspelhoDiag.paraJson()` entrega só
// `linhas`; `MainActivity.mirrorDiag` acrescenta `ligado`, `servidor`
// (`EspelhoServidor.estado()`) e `servico` (`EspelhoEnergia.estado()`). Uma
// TELA traz os oito campos de `EspelhoServidor` — `rotulo`, `comando`,
// `conectadaMs`, `telaAcesaMin`, `aviso`, `eventos`, `pronta`, `fila` — e nada
// além disso. Se um dia o Kotlin publicar mais, é AQUI que o espelho da forma
// precisa ser atualizado, e é essa a manutenção que este arquivo cobra.
// ---------------------------------------------------------------------------
const DIAG = {
  ligado: true,
  linhas: [
    { em: 1765000000000, txt: 'transmissao por comandos ligada em http://192.168.0.14:8787' },
    { em: 1765000005000, txt: 'pagina entregue: web/display/index.html' },
    { em: 1765000006000, txt: 'tela A entrou' },
  ],
  servidor: {
    ligado: true, url: 'http://192.168.0.14:8787', ip: '192.168.0.14', porta: 8787,
    tls: false, noArMs: 754000, teto: 3, sessoes: 1,
    origensBloqueadas: 0, conexoesTotais: 4, semConexaoMs: 0, ultimaSaida: null,
    recusadas: {}, enlace: { upKbps: 48000, downKbps: 65000, wifi: true, validada: true, iface: 'wlan0' },
    telas: [{
      rotulo: 'tela A', comando: true, conectadaMs: 612000, telaAcesaMin: 10,
      aviso: '', eventos: 431, pronta: true, fila: 0,
    }],
  },
  servico: { servico: true, wakeLock: true, wifi: true, termico: 1, termicoMax: 2, carregando: false },
};

const ESTADO = {
  ligado: true, endereco: 'http://192.168.0.14:8787', erro: '',
  telas: DIAG.servidor.telas,
};

// A ponte de mentira, no mesmo molde do `boot-nativo.test.mjs`.
const PONTE = `(() => {
  const vazio = { displays: [{ id: 1, name: 'TV do templo', w: 1920, h: 1080, density: 320 }],
    listFolder: [], pickDoc: [], ytSearch: [],
    espelhoEstado: ${JSON.stringify(ESTADO)}, espelhoDiag: ${JSON.stringify(DIAG)},
    espelhoCertEstado: { temCert: false }, castTarget: { label: 'Tela de teste' },
    otaPending: '', otaDiag: 'ultima busca ha 11s: nada novo', ytDiag: '' };
  const comCallId = new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','requestMic','castTarget',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','espelhoCertImportar','espelhoCertApagar',
    'apkProcurar','apkInstalar','otaPending','otaApply','otaCheck','otaDiag','ytDiag']);
  const B = {
    shellVersion: () => 46,
    role: () => 'controle',
    appVersion: () => '1.93-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','castTarget',
    'deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply',
    'otaCheck','otaDiag','otaPending','pickDoc','pickFolder','requestMic','systemVolume',
    'temaClaro','ytCancel','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio','ytSearch',
    'ytStream'];
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
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
await semRedeExterna(ctx);
const pg = await ctx.newPage();

try {
  await pg.addInitScript(PONTE);
  await pg.goto(`http://localhost:${porta}/controle/`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => typeof window.__avBack === 'function'
    && !!document.querySelector('#playlist li'), null, { timeout: 25000 });

  // O REGISTRO é montado por `renderDiag()`, que é assíncrona (ela pergunta ao
  // shell) e roda ao abrir Configurações. Chamá-la direto é o caminho honesto:
  // é a mesma função que o botão aciona, e esperar a caixa parar de crescer
  // seria medir o relógio em vez do conteúdo.
  // O texto do Registro vive numa variável, não num nó do DOM (o visor saiu na
  // v5.207 — ver `renderDiag`). Ler `diagTexto` é ler exatamente o que o botão
  // de copiar entrega ao operador, que é o único consumidor que ele tem.
  const texto = await pg.evaluate(async () => {
    await window.renderDiag();
    return typeof diagTexto === 'string' ? diagTexto : '';
  });

  checar(texto.length > 0, 'o Registro é montado e tem conteúdo');

  // ---- RÉGUA 1: nenhuma palavra de recurso aposentado -----------------------
  //
  // Cada termo aqui é o NOME de uma peça que saiu do app, e ver qualquer um
  // deles no Registro significa que um consumidor sobreviveu ao produtor. A
  // lista é de PALAVRAS e não de linhas inteiras de propósito: a frase muda
  // com a redação, o vocabulário do recurso morto não.
  //
  // Uma ressalva sobre o primeiro, para ninguém confiar demais nele: a palavra
  // "RETÂNGULO PRETO" só sai quando há uma CENA no ar (`cenaComVideoAberto`:
  // vídeo tocando, cortina aberta), e este harness não projeta nada. Quem de
  // fato tranca o defeito é o termo seguinte — `ritmo:`, a linha que carregava
  // o alarme. Ele fica na lista porque é a frase que o operador leria, e um
  // teste que nomeia o sintoma sobrevive melhor a uma reescrita da condição.
  const PROIBIDOS = [
    ['RETÂNGULO PRETO', 'o alarme falso do `ritmo` zerado (v5.187 → v5.206)'],
    ['ritmo:', 'a linha de bitrate/fps do encoder H.264'],
    ['modo: imagem', 'o seletor imagem × vídeo, removido na v5.156'],
    ['tela virtual', 'o `VirtualDisplay` do espelho de pixels'],
    ['readback', 'a sonda de leitura de pixel'],
    ['encoder', 'o `MediaCodec` do espelho de pixels'],
    ['bundle antigo', 'a acusação que `linhasDaTela(undefined)` fazia a toda tela'],
    ['quadro-chave', 'o freio de IDR'],
    ['MSE:', 'o autorrelato do `espelho/cliente.js`'],
    ['pendente(s)', 'a fila de aprovação, removida na v5.185'],
    ['blocos de PCM', 'o `AudioWorklet` do áudio do espelho'],
  ];
  for (const [termo, oque] of PROIBIDOS) {
    checar(!texto.includes(termo), `o Registro não fala de ${oque} ("${termo}")`);
  }

  // `undefined`/`NaN` no texto é a assinatura genérica desta classe de defeito:
  // um campo que o shell não manda mais, concatenado sem guarda. A regra do
  // projeto ("toda linha do bloco é opcional") existe justamente para isto.
  checar(!/\bundefined\b/.test(texto), 'nenhum "undefined" — a regra de toda linha ser opcional vale');
  checar(!/\bNaN\b/.test(texto), 'nenhum "NaN" — nenhuma conta sobre campo ausente');

  // ---- RÉGUA 2: o que o operador foi buscar ESTÁ lá -------------------------
  //
  // Sem esta metade, apagar o bloco inteiro passaria no teste acima.
  checar(texto.includes('Transmissão para navegador'),
    'o bloco tem o título do recurso que existe (e não "Espelho de pixels")');
  checar(texto.includes('192.168.0.14:8787'), 'o ENDEREÇO, que é a porta de entrada das telas');
  checar(texto.includes('tela A'), 'a tela conectada, pelo rótulo que a folha também mostra');
  checar(/1 conectada\(s\) de 3/.test(texto), 'quantas telas de quantas cabem');
  checar(texto.includes('431 comando(s) entregue(s)'),
    'e o que o servidor de fato sabe dela: comandos entregues');
  checar(texto.includes('pronta'),
    '`pronta` — separa a tela cujo /display/ subiu da que só abriu o SSE');
  checar(texto.includes('wlan0'), 'o enlace, que confirma que o socket está na Wi-Fi');
  checar(texto.includes('tela A entrou'), 'e o DIÁRIO, que é o que sobrou do EspelhoDiag');

  // A linha do enlace não promete mais um teto de telas derivado de um bitrate
  // que não existe — ver `blocoEspelho`.
  checar(!/cabem ~\d+ tela/.test(texto),
    'o enlace mostra a banda crua, sem o teto de telas calculado sobre 3 Mbps de encoder');

  // ---- O PLACAR DA RETOMADA: a metade CONSUMIDORA do contrato ---------------
  //
  // O telão manda os contadores no `diag-dump` que já existia, e o `controle.js`
  // os renderiza no bloco "Áudio do aparelho". Sem oráculo aqui, esquecer o
  // segundo argumento de `juntarDiag`, renomear `diagRetomada` ou mover o
  // `linhas.push` para depois do `return` faz a linha SUMIR do Registro sem
  // erro em lugar nenhum — e quem lê a distância interpreta a ausência como
  // "não aconteceu nada", que é a resposta OPOSTA à verdadeira.
  const comPlacar = await pg.evaluate(async () => {
    // Entregue pelo mesmo caminho do telão de verdade: um canal SEPARADO, como
    // a Presentation é. `AVDB.sendCommand` não serviria — um BroadcastChannel
    // não entrega ao próprio objeto que postou, e o handler do app escuta no
    // canal DELE.
    const bc = new BroadcastChannel('av-iasd');
    bc.postMessage({
      type: 'diag-dump', linhas: [],
      retomada: { espontaneas: 4, recuperadas: 3, desistidas: 1 },
      __mid: 'reg:1',
    });
    await new Promise((f) => setTimeout(f, 200));
    bc.close();
    await window.renderDiag();
    return typeof diagTexto === 'string' ? diagTexto : '';
  });
  checar(comPlacar.includes('outro app pausou o telão: 4x'),
    'o placar da retomada CHEGA ao Registro — a metade consumidora do `diag-dump`');
  checar(/retomado 3x/.test(comPlacar) && /desistido 1x/.test(comPlacar),
    'com as três contas, que respondem coisas diferentes (roubos · socorros · desistências)');

  // E UM BUNDLE ANTIGO não manda o campo: a linha some, e NADA sai quebrado —
  // é a regra de que toda linha do bloco é opcional, cobrada onde ela vale.
  const semPlacar = await pg.evaluate(async () => {
    const bc2 = new BroadcastChannel('av-iasd');
    bc2.postMessage({ type: 'diag-dump', linhas: [], __mid: 'reg:2' });
    await new Promise((f) => setTimeout(f, 200));
    bc2.close();
    await window.renderDiag();
    return typeof diagTexto === 'string' ? diagTexto : '';
  });
  checar(!/\bundefined\b/.test(semPlacar) && !/\bNaN\b/.test(semPlacar),
    'e um telão de bundle ANTIGO, sem o campo, não produz "undefined" nem "NaN"');
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
