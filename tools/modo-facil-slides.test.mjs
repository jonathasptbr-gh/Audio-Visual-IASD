#!/usr/bin/env node
// ============================================================================
// O MODO FÁCIL OPERA UMA APRESENTAÇÃO (v1.4.30)
//
// Pedido do operador: *"verifique o modo simples e seu auxiliar de leitura. Ele
// deve adquirir as funções para controle de slides também"*.
//
// ## O que a verificação achou, MEDIDO antes de mexer
//
// Com uma apresentação em cena, o Modo Fácil não a operava **de jeito nenhum**:
//
//  - a zona de leitura dizia *"A letra da música aparece aqui."* — a projeção no
//    ar negada pela única superfície daquele modo que deveria descrevê-la;
//  - as teclas eram `play · parar · mudo` e as de volume, e **nada virava
//    página**. O eixo já existia (`slideTarget()` respondia `'deck'`); o que
//    faltava era alguém neste modo ligado a ele.
//
// Uma apresentação entra ali pelo compartilhamento (`focarImportado` projeta na
// hora no simplificado), projeta, e ficava **presa na página 1** até o operador
// ir ao modo avançado — que é justamente o modo que este existe para não exigir.
//
// ## As metades que falham CALADAS
//
//  - **A zona mostrando a letra vazia** não é um erro: é uma frase serena sobre
//    uma cena que não é a que está no ar. Um teste de "não quebrou" passa.
//  - **O LIMITE das teclas.** Elas espelham o `disabled` das âncoras do modo
//    avançado, e uma segunda conta de *"posso avançar?"* divergiria calada — a
//    tecla acesa no fim da apresentação, ou apagada no meio dela.
//  - **AS MINIATURAS REVOGADAS PELA OUTRA COLUNA.** Há dois lugares que
//    desenham páginas (esta zona e a folha do modo avançado), e enquanto a lista
//    de URLs foi uma só, redesenhar um revogava as imagens do outro: a coluna
//    fica com os quadros vazios, **sem erro em lugar nenhum**, porque uma `<img>`
//    com `src` revogado não pinta e não reclama.
//  - **A PÁGINA NA ASSINATURA.** Se ela entrasse, cada toque no ⏭ revogaria e
//    recriaria as miniaturas de uma apresentação inteira no meio do sermão.
//
//   node tools/modo-facil-slides.test.mjs
// ============================================================================
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)),
  '..', 'app', 'src', 'main', 'assets', 'web');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};
const PAGINAS = 6;

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
    console.log('FALHOU  ' + msg
      + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

await new Promise((r) => servidor.listen(0, r));
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = 'http://localhost:' + servidor.address().port;

try {
  pg.on('pageerror', (e) => falhas.push('pageerror: ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );

  const ids = await pg.evaluate(async (n) => {
    setAppMode('simple');
    const pages = [];
    for (let i = 0; i < n; i++) {
      const cv = document.createElement('canvas');
      cv.width = 32; cv.height = 18;
      const c = cv.getContext('2d');
      c.fillStyle = 'hsl(' + (i * 53) + ',70%,50%)';
      c.fillRect(0, 0, 32, 18);
      pages.push(await new Promise((r) => cv.toBlob(r, 'image/png')));
    }
    const d = await AVDB.addDeck(pages, { name: 'Semana da Familia', list: 'imports' });
    const m = await AVDB.addMedia(new Blob(['x'], { type: 'audio/wav' }),
      { name: 'Louvor de Fundo', type: 'audio/wav', kind: 'audio', list: 'imports' });
    return { deck: d.id, audio: m.id };
  }, PAGINAS);

  const olhar = () => pg.evaluate(() => {
    const zona = document.getElementById('simpleLyrics');
    const linhas = [...zona.querySelectorAll('.lv-row')];
    return {
      modo: appMode,
      eixo: slideTarget(),
      slides: zona.querySelectorAll('.lv-row--slide').length,
      estrofes: zona.querySelectorAll('.lv-row--verse, .lv-row').length,
      vazio: !!zona.querySelector('.lv-empty'),
      marcada: linhas.findIndex((l) => l.classList.contains('current')),
      // As TECLAS de página, que não existiam.
      rowVisivel: !document.getElementById('simpleSlidesRow').hidden,
      num: document.getElementById('simpleSlideNum').textContent,
      prevOff: document.getElementById('simpleSlidePrev').disabled,
      nextOff: document.getElementById('simpleSlideNext').disabled,
      pagina: deckPagina,
      urlPrimeira: linhas.length ? (linhas[0].querySelector('.lv-slide') || {}).src || '' : '',
    };
  });

  // ── 1. UMA MÚSICA: o modo continua sendo o que era ────────────────────────
  const musica = await pg.evaluate(async (id) => {
    await send(id);
    currentItem.lyrics = [{ cover: true }, { time: 0, text: 'primeira' }, { time: 5, text: 'segunda' }];
    renderSlideNav();
    return null;
  }, ids.audio);
  const m0 = await olhar();
  checar(m0.slides === 0 && !m0.vazio && !m0.rowVisivel,
    'ponto de partida: com uma MÚSICA a zona é a letra e a linha de páginas não '
    + 'existe — neste modo a estrofe anda sozinha pelo relógio, e um par de '
    + 'teclas que ninguém precisa exercer é o que este app não faz', m0);

  // ── 2. A APRESENTAÇÃO ENTRA ───────────────────────────────────────────────
  await pg.evaluate((id) => send(id), ids.deck);
  await pg.waitForTimeout(300);
  const d0 = await olhar();
  checar(d0.slides === PAGINAS && !d0.vazio,
    'A ZONA DE LEITURA VIRA A COLUNA DE PÁGINAS — antes ela dizia "A letra da '
    + 'música aparece aqui", negando a projeção que estava no ar', d0);
  checar(d0.marcada === 0,
    '  ↳ com a página em cena marcada, como no modo avançado', d0.marcada);
  checar(d0.rowVisivel && d0.num === '1/' + PAGINAS,
    'AS TECLAS DE PÁGINA APARECEM, com o número no meio — a linha nasceu com a '
    + 'geometria da de volume, que é a forma provada do "teclas grandes, nada '
    + 'de arrastar"', d0);
  checar(d0.prevOff && !d0.nextOff,
    '  ↳ e o LIMITE vem das âncoras do modo avançado (`applySlideLimits`), não '
    + 'de uma segunda conta: na página 1 o ⏮ está apagado', d0);

  // ── 3. A TECLA VIRA A PÁGINA ──────────────────────────────────────────────
  await pg.evaluate(() => document.getElementById('simpleSlideNext').click());
  await pg.waitForTimeout(200);
  const d1 = await olhar();
  checar(d1.pagina === 1 && d1.marcada === 1 && d1.num === '2/' + PAGINAS,
    'A TECLA VIRA A PÁGINA, e a coluna e o número acompanham', d1);
  checar(!d1.prevOff,
    '  ↳ e o ⏮ acende ao sair da primeira', d1.prevOff);
  checar(d1.urlPrimeira === d0.urlPrimeira && d1.slides === PAGINAS,
    '  ↳ e a coluna NÃO é remontada: a mesma URL de objeto na primeira '
    + 'miniatura. Com a página na assinatura, cada toque no ⏭ revogaria e '
    + 'recriaria as dezenas de miniaturas no meio do sermão',
    { antes: d0.urlPrimeira, depois: d1.urlPrimeira });

  // ── 4. O TOQUE NUMA PÁGINA PULA PARA ELA ──────────────────────────────────
  // `page.evaluate` passa UM argumento — o `PAGINAS` do Node não existe lá.
  await pg.evaluate((n) => {
    [...document.querySelectorAll('#simpleLyrics .lv-row')][n - 1].click();
  }, PAGINAS);
  await pg.waitForTimeout(200);
  const d2 = await olhar();
  checar(d2.pagina === PAGINAS - 1 && d2.marcada === PAGINAS - 1,
    'O TOQUE NUMA PÁGINA PULA PARA ELA — o mesmo `deckIr` do modo avançado, e '
    + 'não um segundo jeito de saltar', d2);
  checar(d2.nextOff && !d2.prevOff,
    '  ↳ e na última o ⏭ apaga', d2);

  // ── 5. A APRESENTAÇÃO SOBRE UM LOUVOR (v1.4.28) ───────────────────────────
  // A pilha vale aqui também: há UMA zona neste modo, e mostrar a camada de
  // trás seria descrever o que a congregação não está vendo.
  const camada = await pg.evaluate(async (o) => {
    await send(o.audio);
    currentItem.lyrics = [{ cover: true }, { time: 0, text: 'primeira' }];
    await send(o.deck);
    await new Promise((r) => setTimeout(r, 200));
    return {
      camada: deckSobreProjetando(),
      emCena: currentId === o.audio,
      slides: document.querySelectorAll('#simpleLyrics .lv-row--slide').length,
      rowVisivel: !document.getElementById('simpleSlidesRow').hidden,
      num: document.getElementById('simpleSlideNum').textContent,
    };
  }, ids);
  checar(camada.camada && camada.emCena && camada.slides === PAGINAS && camada.rowVisivel,
    'COM A APRESENTAÇÃO SOBRE UM LOUVOR a zona mostra as PÁGINAS e as teclas '
    + 'ficam: é a mesma pilha do auxiliar do modo avançado — quem está na frente '
    + 'vence, e a camada de trás é o que a congregação não está vendo', camada);
  checar(camada.num === '1/' + PAGINAS,
    '  ↳ e aqui o número da página é o ÚNICO lugar do modo que o mostra: o '
    + 'título é o do ÁUDIO, que é o que o ▶ controla', camada.num);

  // ── 6. AS MINIATURAS NÃO SÃO REVOGADAS PELA OUTRA COLUNA ──────────────────
  // Há DOIS desenhistas de páginas, e enquanto a lista de URLs foi uma só,
  // redesenhar um revogava as imagens do outro — quadros vazios, sem erro.
  const convivencia = await pg.evaluate(async () => {
    const antes = document.querySelector('#simpleLyrics .lv-slide').src;
    // A folha do modo avançado desenha a MESMA apresentação e solta as URLs
    // DELA ao fechar.
    openLyricsPopup();
    closeLyricsPopup();
    renderSlideNav();
    await new Promise((r) => setTimeout(r, 150));
    const img = document.querySelector('#simpleLyrics .lv-slide');
    let viva = false;
    try { const r = await fetch(img.src); viva = r.ok; } catch (_) { viva = false; }
    return { antes, depois: img.src, viva };
  });
  checar(convivencia.viva && convivencia.depois === convivencia.antes,
    'AS DUAS COLUNAS CONVIVEM: abrir e fechar a folha do modo avançado não '
    + 'revoga as miniaturas do Modo Fácil — a lista de URLs é de CADA uma. Uma '
    + '`<img>` com `src` revogado não pinta e não reclama', convivencia);

  // ── 7. SAIR DO MODO SOLTA OS BLOBS ────────────────────────────────────────
  const saiu = await pg.evaluate(async (url) => {
    setAppMode('full');
    await new Promise((r) => setTimeout(r, 100));
    let viva = false;
    try { const r = await fetch(url); viva = r.ok; } catch (_) { viva = false; }
    return { viva, zonaVazia: !document.querySelector('#simpleLyrics .lv-row') };
  }, convivencia.depois);
  checar(!saiu.viva && saiu.zonaVazia,
    'SAIR DO MODO SOLTA AS MINIATURAS: `refreshSimpleLyrics` volta cedo fora do '
    + 'simplificado, então ninguém mais passaria por elas — dezenas de Blobs '
    + 'segurados pelo resto da sessão, num processo que já hospeda dois WebViews',
    saiu);

  // ── 8. E VOLTAR AO MODO REDESENHA ─────────────────────────────────────────
  // A assinatura é zerada junto com a limpeza; sem isso a volta encontraria o
  // `sig` igual e não redesenharia nada — a zona ficaria vazia para sempre.
  const voltou = await pg.evaluate(async () => {
    setAppMode('simple');
    await new Promise((r) => setTimeout(r, 200));
    return {
      slides: document.querySelectorAll('#simpleLyrics .lv-row--slide').length,
      rowVisivel: !document.getElementById('simpleSlidesRow').hidden,
    };
  });
  checar(voltou.slides === PAGINAS && voltou.rowVisivel,
    'e VOLTAR ao modo redesenha a coluna — a assinatura foi zerada com a '
    + 'limpeza; sem isso a volta acharia o `sig` igual e a zona ficaria vazia '
    + 'para sempre', voltou);
} finally {
  await ctx.close();
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.error('\n' + falhas.length + ' asserção(ões) reprovada(s).');
  process.exit(1);
}
console.log('\ntudo certo.');
