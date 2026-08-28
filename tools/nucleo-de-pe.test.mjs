// O NÚCLEO DE PÉ — o `nucleo.jar` servindo a base web de verdade.
//
// Os outros oráculos deste caminho medem peças: o `NucleoServidorTest` mede o
// servidor com sockets, o `NucleoDespachoTest` mede o despacho, e os três
// oráculos do envelope medem o formato. **Nenhum deles sobe o programa.**
//
// O que só aparece aqui é a JUNÇÃO, e ela tem um contrato de dois lados que
// nenhum teste de unidade alcança: o aperto de mão entre o `NucleoMain`
// (Kotlin) e o `Nucleo.Ligar()` (C#). Se os dois discordarem — do primeiro
// envelope, do enquadramento, da ordem —, o programa não abre **na máquina do
// operador**, que é o único lugar que este repositório não alcança.
//
// Ele também é o primeiro teste do projeto que serve o BUNDLE DE VERDADE por
// HTTP: 120 kB de `controle/index.html`, faixas de bytes reais, e as recusas
// sobre os arquivos que existem ao lado dele.

import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jar = path.join(raiz, 'core/build/libs/nucleo.jar');
const web = path.join(raiz, 'app/src/main/assets/web');
const PORTA = 8477; // não a 8420: um programa de verdade aberto na máquina não é motivo de reprovar
const SES = 'sessao-do-controle';
const TELAO = 'sessao-do-telao-xx';

if (!fs.existsSync(jar)) {
  console.error('não achei ' + jar + ' — rode `./gradlew :core:nucleoJar` antes.');
  process.exit(1);
}

let falhas = 0;
const checar = (ok, o) => { if (ok) { console.log('  . ' + o); } else { falhas++; console.error('  x ' + o); } };

// ---------------------------------------------------------------- o cano
function montar(id, metodo, args) {
  const partes = [Buffer.from(`AV1\n${id}\n${metodo}\n${args.length}\n`, 'utf8')];
  for (const a of args) {
    const b = Buffer.from(a, 'utf8');
    partes.push(Buffer.from(b.length + '\n', 'ascii'), b, Buffer.from('\n', 'ascii'));
  }
  return Buffer.concat(partes);
}

const p = spawn('java', ['-jar', jar, '--raiz', web, '--porta', String(PORTA)]);
p.stderr.on('data', (d) => process.stderr.write('[nucleo] ' + d));

// Um desenquadrador do cano, alimentado por pedaços. Ele é o que a casca em C#
// faz com `LerDoCano`, e por isso a forma tem de bater.
let sobra = Buffer.alloc(0);
const recebidos = [];
const esperando = [];
p.stdout.on('data', (d) => {
  sobra = Buffer.concat([sobra, d]);
  for (;;) {
    const q = sobra.indexOf(0x0a);
    if (q < 0) return;
    const n = Number(sobra.subarray(0, q).toString('ascii'));
    if (!Number.isInteger(n) || sobra.length < q + 1 + n) return;
    const env = sobra.subarray(q + 1, q + 1 + n);
    sobra = sobra.subarray(q + 1 + n);
    const f = esperando.shift();
    if (f) f(env); else recebidos.push(env);
  }
});
const doCano = (msTeto) => new Promise((res) => {
  if (recebidos.length) return res(recebidos.shift());
  const t = setTimeout(() => { const i = esperando.indexOf(f); if (i >= 0) esperando.splice(i, 1); res(null); }, msTeto);
  const f = (e) => { clearTimeout(t); res(e); };
  esperando.push(f);
});
const paraOCano = (id, m, a) => { const e = montar(id, m, a); p.stdin.write(Buffer.from(e.length + '\n', 'ascii')); p.stdin.write(e); };

const url = (c) => `http://127.0.0.1:${PORTA}${c}`;

/** Uma requisição CRUA, byte a byte. O que se quer perguntar não cabe num
 *  cliente HTTP: eles normalizam o caminho antes de mandar. */
const cruDoSocket = (texto) => new Promise((res, rej) => {
  const s = net.connect(PORTA, '127.0.0.1');
  let fora = '';
  s.setTimeout(5000, () => { s.destroy(); rej(new Error('prazo no socket cru')); });
  s.on('connect', () => s.write(texto));
  s.on('data', (d) => { fora += d.toString('utf8'); });
  s.on('close', () => res(fora));
  s.on('error', rej);
});

try {
  // 1. O APERTO DE MÃO. É o contrato Kotlin↔C# que só existe aqui.
  //
  // Prazo generoso e ESPERA PELO FATO: o que vem é o primeiro envelope, não um
  // relógio. Uma JVM fria num runner carregado leva segundos, e um prazo
  // apertado reprovaria um programa que está certo — a armadilha que o
  // `CLAUDE.md` chama de "prazo lido como veredito".
  const aperto = await doCano(30000);
  checar(aperto !== null, 'o núcleo respondeu (PRAZO, não veredito, se falhar)');
  const txt = aperto ? aperto.toString('utf8') : '';
  checar(txt.startsWith('AV1\n-\npronto\n1\n'), 'e o primeiro envelope é `pronto`: ' + JSON.stringify(txt));
  checar(txt.endsWith(`\n${String(PORTA).length}\n${PORTA}\n`), 'com a porta que a casca pediu');

  paraOCano('-', 'sessao', [SES, 'controle']);
  paraOCano('-', 'sessao', [TELAO, 'display']);

  // 2. A BASE WEB DE VERDADE, servida por loopback.
  const r1 = await fetch(url('/controle/'));
  const corpo = await r1.text();
  checar(r1.status === 200 && corpo.includes('<title>'), `/controle/ serve o índice (${corpo.length} bytes)`);
  checar(r1.headers.get('content-type').startsWith('text/html'), 'com o tipo certo');

  const r2 = await fetch(url('/shared/native.js'));
  checar(r2.status === 200 && r2.headers.get('content-type').startsWith('text/javascript'),
    'e `shared/native.js` — a ponte viaja no bundle, como no Android');

  // 3. O RANGE É NOSSO — a inversão da invariante 8. Num `ServerSocket` quem
  // aplica a faixa somos nós, ao contrário do `shouldInterceptRequest`, onde
  // devolver a fatia aplicaria o deslocamento duas vezes.
  const r3 = await fetch(url('/shared/db.js'), { headers: { Range: 'bytes=10-19' } });
  const fatia = Buffer.from(await r3.arrayBuffer());
  const inteiro = fs.readFileSync(path.join(web, 'shared/db.js'));
  checar(r3.status === 206, 'faixa de bytes devolve 206');
  checar(fatia.length === 10 && fatia.equals(inteiro.subarray(10, 20)),
    'e os bytes são os do MEIO do arquivo, não os dez primeiros');
  checar(r3.headers.get('content-range') === `bytes 10-19/${inteiro.length}`, 'com o `Content-Range` certo');

  // 4. O QUE NÃO SAI. A raiz é fechada com duas exceções nomeadas, e um
  // diretório sem índice não confirma sequer que existe.
  for (const [c, esperado] of [['/version.json', 200], ['/notas.json', 200],
                               ['/shared/', 404], ['/vendor/', 404],
                               ['/ponte/call', 404], ['/ponte/e', 404]]) {
    const r = await fetch(url(c), { redirect: 'manual' });
    checar(r.status === esperado, `${c} → ${r.status} (esperado ${esperado})`);
  }

  // 4b. A TRAVESSIA, e ela precisa de um SOCKET CRU.
  //
  // O `fetch` normaliza `..` antes de mandar: pedir por ele mede o cliente do
  // Node, não o servidor — o `..` nunca chega ao outro lado, o teste passa, e
  // o que ele afirma é uma coisa que ninguém testou.
  //
  // **A asserção é a PROPRIEDADE** — *o disco do operador não sai* —, nunca o
  // STATUS. O `EspelhoHttp` recusa `..` como malformado (400) antes de existir
  // rota, e a forma percent-codificada chega à decisão de rota e vira 404: as
  // duas são recusas, e prender um número aqui seria convidar alguém a
  // afrouxar a defesa mais forte das duas para o teste passar.
  for (const cru of ['/shared/../../../../etc/passwd',
                     '/shared/%2e%2e/%2e%2e/%2e%2e/%2e%2e/etc/passwd',
                     '/shared/..%5c..%5c..%5cwindows%5cwin.ini',
                     '/../../etc/passwd']) {
    const resp = await cruDoSocket(`GET ${cru} HTTP/1.1\r\nHost: 127.0.0.1:${PORTA}\r\nConnection: close\r\n\r\n`);
    const status = Number(resp.split(' ')[1]);
    checar(status >= 400 && status < 500 && !resp.includes('root:') && !resp.includes('[fonts]'),
      `travessia recusada (${status}): ${cru}`);
  }

  // 5. O FIO E A CHAMADA, de ponta a ponta.
  const fio = await fetch(url(`/ponte/e?s=${SES}`));
  const leitor = fio.body.getReader();
  const eventos = [];
  const lendo = (async () => {
    let buf = '';
    while (eventos.length < 1) {
      const { value, done } = await leitor.read();
      if (done) break;
      buf += Buffer.from(value).toString('utf8');
      for (const l of buf.split('\n')) if (l.startsWith('data: ')) eventos.push(l.slice(6));
      buf = buf.slice(buf.lastIndexOf('\n') + 1);
    }
  })();
  checar(fio.headers.get('content-type').startsWith('text/event-stream'), 'o fio abre como SSE');

  // `pickDoc` e não `listFolder`: este é o exemplo do que ATRAVESSA o cano,
  // e `listFolder` é do NÚCLEO (é ele que tem o disco e o registro de `/saf/`).
  const rec = await fetch(url(`/ponte/call?s=${SES}`), {
    method: 'POST', body: montar('ab12cd:1', 'pickDoc', ['audio/*']),
  });
  checar((await rec.text()) === '{}', 'o `POST` devolve um RECIBO — o valor volta pelo fio');

  const pedido = await doCano(8000);
  checar(pedido !== null && pedido.toString('utf8') === `AV1\nab12cd:1\npickDoc\n2\n${SES.length}\n${SES}\n7\naudio/*\n`,
    'e o pedido chega à casca com a SESSÃO na frente: ' + JSON.stringify(pedido?.toString('utf8')));

  paraOCano('-', 'resolver', [SES, 'ab12cd:1', '[{"name":"hino.mp3"}]']);
  await lendo;
  checar(eventos[0] === '{"t":"r","id":"ab12cd:1","v":[{"name":"hino.mp3"}]}',
    'e a resposta desce pelo fio, endereçada: ' + eventos[0]);
  leitor.cancel().catch(() => {});

  // 6. A INVARIANTE 9, no servidor. No Android ela é `host = null` mais uma
  // guarda por método, e o `CLAUDE.md` registra que não há oráculo para ela.
  const antes = recebidos.length;
  await fetch(url(`/ponte/call?s=${TELAO}`), { method: 'POST', body: montar('zz:1', 'pickFolder', []) });
  const vazou = await doCano(1200);
  checar(vazou === null, 'o Telão pede `pickFolder` e NADA chega à casca');

  // 6b. A ROTA `/saf/` — O DISCO DO OPERADOR, e a INVARIANTE 9 sobre ele.
  //
  // No Android o WebView do telão é montado SEM o handler `/saf/`: ele não tem
  // como buscar um, nem sabendo o token. Aqui as duas janelas dividem UM
  // socket — a porta é a origem, e um segundo socket seria um segundo
  // IndexedDB —, então a negativa vem da SESSÃO na URL.
  //
  // **O fio abre ANTES do `POST`, sempre.** A resposta é empurrada no instante
  // do despacho: abrir depois é esperar por um evento que já passou, e o que
  // sai disso é um prazo estourado que se lê como defeito do app.
  const perguntar = async (sessao, id, metodo, args) => {
    const f = await fetch(url(`/ponte/e?s=${sessao}`));
    const r = f.body.getReader();
    await fetch(url(`/ponte/call?s=${sessao}`), { method: 'POST', body: montar(id, metodo, args) });
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await r.read();
        if (done) return undefined;
        buf += Buffer.from(value).toString('utf8');
        const l = buf.split('\n').find((x) => x.startsWith('data: ') && x.includes(`"${id}"`));
        if (l) return JSON.parse(l.slice(6)).v;
      }
    } finally { r.cancel().catch(() => {}); }
  };

  const dir = fs.mkdtempSync(path.join(raiz, 'core/build/saf-'));
  try {
    fs.writeFileSync(path.join(dir, '001. Santo.mp3'), '0123456789');
    fs.writeFileSync(path.join(dir, 'louvor.mp4'), 'abc');
    fs.mkdirSync(path.join(dir, 'uma-pasta'));

    const lista = await perguntar(SES, 'ab12cd:3', 'listFolder', [dir]);
    checar(Array.isArray(lista) && lista.length === 2,
      'o `listFolder` lê a pasta e ignora o diretório: ' + JSON.stringify(lista));
    const mp3 = (lista || []).find((x) => x.name === '001. Santo.mp3');
    checar(mp3?.type === 'audio/mpeg' && mp3?.size === 10,
      'com o tipo e o tamanho de verdade — é o `type` que decide o kind da mídia');
    checar(typeof mp3?.url === 'string' && mp3.url.startsWith(`http://127.0.0.1:${PORTA}/saf/${SES}/`),
      'e uma URL SERVÍVEL do nosso origin: ' + mp3?.url);

    const rf = await fetch(mp3.url);
    checar(rf.status === 200 && (await rf.text()) === '0123456789',
      'e ela serve os BYTES do disco do operador');

    // A INVARIANTE 9: a MESMA URL, com a sessão do Telão, não acha nada.
    checar((await fetch(mp3.url.replace(SES, TELAO))).status === 404,
      'o Telão não alcança o mesmo arquivo — a sessão está na URL de propósito');

    // E o Telão nem consegue LISTAR: `listFolder` é privilegiado, e era a
    // EXCEÇÃO do Android (ele lê o `ContentResolver` direto; aqui, o disco).
    checar((await perguntar(TELAO, 'zz:2', 'listFolder', [dir])) === null,
      'e não lista a pasta: o índice inteiro do disco não sai para o Telão');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // 7. O SÍNCRONO — o único método que responde no corpo do `POST`.
  const rs = await fetch(url(`/ponte/call?s=${SES}`), {
    method: 'POST',
    body: montar('=', 'deckExportUrl', ['https://docs.google.com/presentation/d/1aBcDeFgHiJkLmNoPq/edit']),
  });
  checar((await rs.text()) === '{"v":"https://docs.google.com/presentation/d/1aBcDeFgHiJkLmNoPq/export/pdf"}',
    'e a regra que o responde é a MESMA do Android (`:core`)');

  // 8. O NÚCLEO MORRE COM O CANO. Uma JVM órfã seguraria a porta — e a porta é
  // a ORIGEM: a abertura seguinte diria "feche a outra cópia" sem haver uma.
  p.stdin.end();
  const saiu = await new Promise((res) => {
    const t = setTimeout(() => res(null), 10000);
    p.on('exit', (c) => { clearTimeout(t); res(c); });
  });
  checar(saiu === 0, 'fechado o cano, a JVM sai sozinha (código ' + saiu + ')');
} finally {
  try { p.kill(); } catch { /* já saiu */ }
}

if (falhas) { console.error(`\n${falhas} asserção(ões) reprovada(s)`); process.exit(1); }
console.log('\nnucleo-de-pe: tudo certo');
