// O PARAR FALA DE UMA CAMADA SÓ (v1.2.0).
//
// ## O que ele trava
//
// Pedido do operador: *"considerando que o preview tem um botão apenas para
// remover as camadas superiores, ajuste o botão de stop para em caso onde há
// mídia de fundo e mensagens ou sobreposição de elementos na tela como bíblia
// e etc… o botão de stop funciona apenas para a mídia de fundo"*.
//
// O telão empilha DUAS coisas ao mesmo tempo — a mídia e a Camada de Texto — e
// o app tem uma porta para cada uma: o selo `#pvCamadaBtn` sobre a preview
// (`encerrarCamadaDeCima`) e o Parar do transporte (`pararMidia`). Até a v1.1.27
// o Parar não escolhia: ele derrubava as duas de uma vez, e um louvor de fundo
// sob um versículo não podia sair sem levar o versículo junto.
//
// ## Por que ele precisa de um oráculo, e por que ele mede TRÊS cenas
//
// A regra é CONDICIONAL, e uma condicional errada passa despercebida nos dois
// sentidos: um Parar que sempre poupa o texto deixa a Camada de Texto presa no
// telão sem porta de saída no transporte; um que nunca poupa é o defeito de
// volta. Nenhum dos dois emite erro em lugar nenhum — o que muda é o que a
// congregação vê.
//
// Daí as três cenas, e nenhuma basta sozinha:
//
//   1. **as duas camadas** → sai só a mídia, o cartão FICA (o pedido);
//   2. **só a mídia**      → sai tudo, como sempre (o Parar continua o ponto final);
//   3. **só o texto**      → sai o cartão (senão a cena de roteiro ficaria sem
//                            saída no transporte, que é a regressão que a
//                            correção poderia introduzir).
//
// E a prova da cena 1 é o `currentTime` do `<video>` medido em DOIS instantes,
// pela mesma razão do `imagem-sobre-audio.test.mjs`: "o cartão continua na
// tela" é fraco sozinho — o que se quer saber é que a MÍDIA saiu e o CARTÃO
// não, e são dois fatos independentes.
//
//   node tools/parar-por-camada.test.mjs
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
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

// Um WAV de 20 s: a asserção central compara o `currentTime` em dois instantes,
// e uma faixa que acabasse no meio do teste responderia `paused: true` por ter
// TERMINADO — indistinguível de ter sido interrompida pelo Parar.
const SEMEAR = `
  const sr = 8000, secs = 20, n = sr * secs;
  const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  wr(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
  const a = await AVDB.addMedia(new Blob([buf], { type: 'audio/wav' }),
    { name: 'Louvor de fundo', type: 'audio/wav', kind: 'audio', list: 'imports' });
  messages = [{ id: 'm1', text: 'Culto da Palavra às 19h30' }];
  await saveMessages();
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

  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 20000 });

  const ids = await pg.evaluate(new Function('return (async () => {'
    + 'setAppMode("full");' + SEMEAR + 'await load(); return { audio: a.id }; })()'));

  // O que se mede. `tempo` carrega a prova de que o áudio é o MESMO e continua
  // andando; `cartao`/`camada` dizem se a Camada de Texto está no ar; `noAr` é
  // a bandeira que o resto do app consulta.
  const espiar = () => pg.evaluate(() => {
    const v = document.querySelector('#preview video') || document.querySelector('video');
    return {
      pausado: v ? v.paused : null,
      tempo: v ? v.currentTime : null,
      cartao: !document.getElementById('pvText').hidden,
      camada: cenaDeRoteiroNoAr(),
      provedor: provedorDeTextoNoAr(),
      sessao: provedorDoCartao(),
      noAr: midiaNoAr,
    };
  });
  // O ÚLTIMO comando que saiu ao telão. É ele que separa `clear` (a cena
  // inteira) de `media-clear` (só a mídia) — os dois apagam o vídeo da preview,
  // e sem esta leitura as duas cenas se leriam igual do lado de cá.
  const espionar = () => pg.evaluate(() => {
    window.__vistos = [];
    const antes = AVDB.sendCommand;
    AVDB.sendCommand = (o) => { window.__vistos.push(o && o.type); return antes.call(AVDB, o); };
  });
  const vistos = () => pg.evaluate(() => window.__vistos || []);

  // ======================================================================
  // CENA 1 — AS DUAS CAMADAS: o Parar fala só da de baixo
  // ======================================================================
  await pg.evaluate((id) => send(id), ids.audio);
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => projectMessage(0));
  await pg.waitForTimeout(500);
  const a1 = await espiar();
  checar(!a1.pausado && a1.tempo > 0 && a1.camada && a1.provedor === 'message' && a1.noAr,
    'ponto de partida: o louvor toca E a mensagem está projetada por cima', a1);

  await espionar();
  await pg.evaluate(() => document.getElementById('stop').click());
  await pg.waitForTimeout(900);
  const b1 = await espiar();
  const cmds1 = await vistos();
  checar(b1.camada && b1.provedor === 'message' && b1.cartao,
    'o Parar NÃO derruba a Camada de Texto — a mensagem continua projetada', b1);
  checar(!b1.noAr, 'e a mídia SAIU do ar (`midiaNoAr` baixou)', b1);
  checar(cmds1.includes('media-clear') && !cmds1.includes('clear'),
    'o comando que foi ao telão é `media-clear`, nunca o `clear` da cena inteira', cmds1);

  // ======================================================================
  // CENA 3 — SÓ O TEXTO: aqui o Parar é a saída dele
  // ======================================================================
  // Vem antes da cena 2 porque é a continuação natural desta: o telão já está
  // com a mensagem sozinha. Um segundo Parar precisa encerrá-la — senão a
  // correção teria trocado um defeito por outro, deixando a Camada de Texto sem
  // saída no transporte.
  await espionar();
  await pg.evaluate(() => document.getElementById('stop').click());
  await pg.waitForTimeout(700);
  const c1 = await espiar();
  const cmds3 = await vistos();
  checar(!c1.camada && !c1.cartao && c1.sessao === '',
    'com a mensagem SOZINHA no ar, o Parar seguinte a encerra — ela não fica presa', c1);
  checar(cmds3.includes('clear'),
    'e aí o comando é o `clear` de sempre: a cena inteira acabou', cmds3);

  // ======================================================================
  // CENA 2 — SÓ A MÍDIA: o Parar continua sendo o ponto final
  // ======================================================================
  await pg.evaluate((id) => send(id), ids.audio);
  await pg.waitForTimeout(1000);
  const d0 = await espiar();
  checar(!d0.pausado && d0.noAr && !d0.camada,
    'ponto de partida: o louvor toca, sem camada nenhuma por cima', d0);

  await espionar();
  await pg.evaluate(() => document.getElementById('stop').click());
  await pg.waitForTimeout(900);
  const d1 = await espiar();
  const cmds2 = await vistos();
  checar(!d1.noAr && !d1.camada,
    'sem Camada de Texto, o Parar encerra a cena inteira, como sempre', d1);
  checar(cmds2.includes('clear') && !cmds2.includes('media-clear'),
    'e o comando é `clear`, não `media-clear` — a condicional não vazou para cá', cmds2);

  checar(erros.length === 0, 'nenhum erro de console', erros);
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
