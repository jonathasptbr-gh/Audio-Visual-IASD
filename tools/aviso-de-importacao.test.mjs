// O AVISO DE QUE UM ARQUIVO ESTÁ ENTRANDO (v1.3.12).
//
// ## O defeito
//
// Importar um vídeo do armazenamento leva SEGUNDOS até virar linha: o `fetch`
// do `/saf/` copia o arquivo inteiro, o `prepararMidia` decodifica um quadro
// para a miniatura e mede a duração, e o `addMedia` grava tudo no IndexedDB.
// Nada disso aparecia — a folha de destinos já tinha fechado, a lista
// continuava igual, e do lado de quem opera é indistinguível de o app ter
// travado. Nas palavras do operador: *"eu não soube se ele travou ou se estava
// importando, pois já havia fechado a tela de importação e não houve nenhuma
// mudança"*.
//
// A importação de APRESENTAÇÃO já fazia o certo (ver `deckImportar`); o ramo da
// mídia comum é que tinha ficado sem. O par é o mesmo: linha provisória no
// avançado, cartão sobre a preview no Modo Fácil.
//
// ## Por que ele precisa de um oráculo
//
// A ausência de um aviso NÃO É UM ERRO: nada quebra, nada aparece no console, e
// o item chega ao fim — só chega em silêncio. Um teste que medisse só o
// desfecho ("o item entrou na lista") passa nas duas versões. **O que se mede
// aqui é o MEIO**: enquanto o arquivo ainda está sendo lido, existe uma linha
// com o nome dele na lista.
//
// Daí o arquivo do cenário ser servido AOS PEDAÇOS, com um atraso deliberado:
// sem isso a janela que se quer medir dura menos que uma volta do laço de
// eventos, e o oráculo mediria a máquina em vez do app.
//
//   node tools/aviso-de-importacao.test.mjs
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
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml',
};

// O ARQUIVO LENTO: 12 pedaços com 120 ms entre eles (~1,4 s no total). É a
// janela que o oráculo mede, e ela precisa durar mais que o tempo de uma volta
// do laço de eventos para a medição falar do APP.
const PEDACOS = 12;
const ENTRE_MS = 120;

const servidor = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/lento.bin') {
    res.writeHead(200, { 'Content-Type': 'video/mp4' });
    let n = 0;
    const passo = () => {
      if (n >= PEDACOS) { res.end(); return; }
      n++;
      res.write(Buffer.alloc(8 * 1024, n));
      setTimeout(passo, ENTRE_MS);
    };
    passo();
    return;
  }
  let p = decodeURIComponent(u.pathname);
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

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 412, height: 892 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', (e) => erros.push(e.message));

try {
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function' && !!document.querySelector('#playlist li'),
    null, { timeout: 25000 },
  );
  await pg.evaluate(() => setAppMode('full'));
  await pg.waitForTimeout(150);

  // ── 1. O AVISO EXISTE ENQUANTO O ARQUIVO É LIDO ─────────────────────────
  //
  // A folha de destinos é respondida como o operador a responde — pelo botão de
  // confirmar —, e não desviada: é ela que fecha antes do trabalho começar, e é
  // justamente esse fechamento que deixava a tela sem sinal nenhum.
  await pg.evaluate((url) => {
    window.__imp = importShare({ files: [{ url, name: 'Video Pesado.mp4', type: 'video/mp4' }] });
  }, base + '/lento.bin');
  await pg.waitForSelector('#songMenuList .song-menu-go', { timeout: 10000 });
  await pg.evaluate(() => document.querySelector('#songMenuList .song-menu-go').click());

  // Espera pelo FATO (a linha provisória), não por um prazo.
  const apareceu = await pg.waitForFunction(() => {
    const li = document.querySelector('.lib-item.baixando');
    return li ? li.textContent : null;
  }, null, { timeout: 8000 }).then((h) => h.jsonValue()).catch(() => null);

  checar(!!apareceu, 'enquanto o arquivo é lido existe uma linha provisória na lista', apareceu);
  checar(!!apareceu && apareceu.includes('Video Pesado'),
    'e ela diz QUAL arquivo — um aro anônimo não responde "o que está entrando?"', apareceu);

  // O ARO GIRA, e é ele que separa "está trabalhando" de "travou". Sem
  // percentual de propósito: `fetch().blob()` não reporta progresso, e um
  // número parado em 0% mente mais do que o aro.
  const anatomia = await pg.evaluate(() => {
    const li = document.querySelector('.lib-item.baixando');
    if (!li) return null;
    return { aro: !!li.querySelector('.dl-ring'), pct: (li.querySelector('.dl-pct') || {}).textContent };
  });
  checar(anatomia && anatomia.aro === true,
    'a linha traz o aro que gira, no lugar da miniatura que ela ainda não tem', anatomia);

  // ── 2. E ELE SAI QUANDO O ITEM CHEGA ────────────────────────────────────
  await pg.evaluate(() => window.__imp);
  await pg.waitForTimeout(300);
  const depois = await pg.evaluate(() => ({
    provisorias: document.querySelectorAll('.lib-item.baixando').length,
    itens: [...document.querySelectorAll('.lib-item:not(.baixando) .row-name')].map((e) => e.textContent),
  }));
  checar(depois.provisorias === 0,
    'terminada a importação, a linha provisória sai — um aro que fica é um item fantasma', depois);
  checar(depois.itens.some((n) => n.includes('Video Pesado')),
    'e o item de verdade ocupa o lugar dela', depois);

  // ── 3. O ARQUIVO QUE NÃO ABRE TAMBÉM SOLTA A LINHA ──────────────────────
  //
  // O laço sai por `continue` quando o `fetch` falha, e é por isso que o
  // `soltar()` mora num `finally`: sem ele, um arquivo ilegível deixaria o aro
  // girando na lista para sempre, sem nada que o removesse.
  await pg.evaluate((url) => {
    window.__imp2 = importShare({ files: [{ url, name: 'Nao Existe.mp4', type: 'video/mp4' }] });
  }, base + '/nao-existe.bin');
  await pg.waitForSelector('#songMenuList .song-menu-go', { timeout: 10000 });
  await pg.evaluate(() => document.querySelector('#songMenuList .song-menu-go').click());
  await pg.evaluate(() => window.__imp2);
  await pg.waitForTimeout(300);
  const orfa = await pg.evaluate(() => document.querySelectorAll('.lib-item.baixando').length);
  checar(orfa === 0,
    'um arquivo que não abre também solta a linha — o `soltar()` mora num `finally`', orfa);

  checar(erros.length === 0, 'nenhum erro de página', erros);
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
