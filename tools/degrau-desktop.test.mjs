// O DEGRAU DE COMPUTADOR — duas colunas onde há largura, uma onde não há.
//
// ## O defeito que ele trava, e ele é MEDIDO
//
// `controle.css` não tinha nenhuma media query de largura, e o app é uma coluna
// de viewport inteira desenhada para um celular em retrato. Numa tela larga
// isso não fica só feio — **a lista some**:
//
//   viewport      | altura do `main` | altura da lista
//   430x900       | 612px            | 497px   ← o celular, correto
//   1280x800      |  90px            |  10px   ← um notebook
//   1920x1080     | 169px            |  54px   ← um monitor
//
// A causa: `.bottombar` é `flex-shrink: 0` e a preview dentro dela não tem teto
// de altura (de propósito — um `max-height` mentiria sobre a proporção). Num
// celular a coluna mede ~408px e a preview para em ~138px; numa tela larga ela
// vira 897x560, e o `main` (`flex: 1`) é espremido a nada.
//
// ## O que este oráculo mede, e o que ele SE RECUSA a medir
//
// Só **o que o desenho RESERVA**: qual `display` o `body` computa, se as duas
// caixas estão lado a lado, e se a coluna do deck respeita o teto do
// `clamp()`. Nunca a soma renderizada de um texto — a base pede `system-ui`, e
// quem responde por ela é a fonte instalada no runner (o repositório já
// registra uma linha variando de 53px a 55px por causa disso). Uma asserção de
// pixel de texto aqui mediria a máquina, não o app.
//
// ## A metade que mais importa é a TERCEIRA
//
// A guarda tem duas condições (`min-width: 900px` E `min-height: 600px`), e a
// de altura não é enfeite: largura sozinha alcançaria um CELULAR DEITADO — e o
// app entra em paisagem justamente no caminho mais perigoso que tem, a preview
// em tela cheia, que sem TV É a projeção. Um oráculo que só medisse o desktop
// aprovaria a versão sem esse piso.
//
//   node tools/degrau-desktop.test.mjs
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
    console.log('FALHOU  ' + msg
      + (obtido !== undefined ? '\n        obtido: '
        + (typeof obtido === 'string' ? obtido : JSON.stringify(obtido)) : ''));
    falhas.push(msg);
  }
}

await new Promise((r) => servidor.listen(0, r));
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const base = 'http://localhost:' + servidor.address().port;

// Uma medição por viewport, sempre no mesmo ponto do ciclo de vida do app.
async function medir(w, h) {
  const ctx = await navegador.newContext({ viewport: { width: w, height: h } });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.AVDB && window.createStage && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );
  await pg.evaluate(() => setAppMode('full'));
  const m = await pg.evaluate(() => {
    const cx = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) };
    };
    return {
      display: getComputedStyle(document.body).display,
      main: cx('main'),
      barra: cx('.bottombar'),
      deck: cx('.deck'),
      lista: cx('.list-body'),
    };
  });
  await ctx.close();
  return m;
}

try {
  // ── 1. O CELULAR NÃO É TOCADO ──────────────────────────────────────────
  //
  // A asserção é ESTRUTURAL (`display` do body), não geométrica: ela diz que a
  // regra nova NÃO ALCANÇA o aparelho, que é a única garantia que interessa.
  // Uma comparação de pixels contra números anotados à mão envelheceria no
  // primeiro ajuste de respiro.
  const cel = await medir(430, 900);
  checar(cel.display === 'flex',
    'no celular em retrato o app continua sendo UMA coluna (o degrau não alcança)', cel.display);
  checar(cel.main.h > 500,
    'e a lista continua com a altura de sempre', cel.main);

  // ── 2. O CELULAR DEITADO TAMBÉM NÃO ────────────────────────────────────
  //
  // 900x430 é a forma de um aparelho em paisagem — o que acontece quando a
  // preview vai a tela cheia e vira a projeção. Só a largura passaria no
  // `min-width: 900px`; o piso de altura é o que o exclui.
  const deitado = await medir(900, 430);
  checar(deitado.display === 'flex',
    'no celular DEITADO (900x430) o degrau também não alcança — é o piso de altura que o exclui',
    deitado.display);

  // ── 3. NO COMPUTADOR, DUAS COLUNAS ─────────────────────────────────────
  for (const [w, h] of [[1280, 800], [1920, 1080]]) {
    const d = await medir(w, h);
    const rotulo = w + 'x' + h;
    checar(d.display === 'grid', rotulo + ': o app vira uma grade de duas colunas', d.display);
    checar(d.main.r <= d.barra.l,
      rotulo + ': a lista fica à ESQUERDA e o deck à direita, sem sobreposição',
      { main: d.main, barra: d.barra });
    // O DEFEITO, dito como o desenho o reserva: a coluna da lista ocupa a
    // ALTURA da janela. Sem o degrau ela media 90px numa viewport de 800.
    checar(d.main.h >= h * 0.9,
      rotulo + ': a coluna da lista ocupa a altura da janela (era ela que sumia)',
      { altura: d.main.h, viewport: h });
    checar(d.lista.h > 300,
      rotulo + ': e a lista dentro dela tem altura de trabalho', d.lista);
    // O TETO DO `clamp()`: é ele que impede a preview de voltar a crescer sem
    // limite. `--deck-largura` é `clamp(380px, 30vw, 520px)`.
    checar(d.barra.w <= 521 && d.barra.w >= 379,
      rotulo + ': a coluna do deck respeita o piso e o teto de `--deck-largura`', d.barra);
  }
} catch (e) {
  checar(false, 'o oráculo chegou ao fim', String(e && e.message || e));
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' reprovação(ões).');
  process.exit(1);
}
console.log('\nTodos passaram.');
