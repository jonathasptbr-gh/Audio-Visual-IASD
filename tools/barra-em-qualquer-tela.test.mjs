#!/usr/bin/env node
// ============================================================================
// A BARRA DA BIBLIOTECA EM QUALQUER TELA (v1.5.3)
//
// ## Por que ele existe
//
// Relato do operador, com a hipótese junto: *"o alinhamento da barra está
// completamente errado, está sendo cortado e deslocado em suas animações. a
// possível causa: você pode estar usando números fixos considerando a sua tela
// de testes, mas a tela do smartphone tem variação de tamanho, pixels e espaços
// variáveis"*.
//
// Ele acertou a CLASSE do defeito. Os oráculos deste repositório rodam num
// Chromium de mesa a 430×900, sem entalhe e sem teclado — e a barra da
// Biblioteca é a única peça do app que é um OVERLAY alinhado a uma caixa do
// layout, isto é, a única cujo desenho depende de coisas que aquela tela não
// tem. Os dois defeitos que chegaram ao aparelho passaram por toda a suíte:
//
//  1. **CORTADA.** O app é `viewport-fit=cover`, então a barra de status é área
//     do app e `env(safe-area-inset-top)` vale de verdade — e ZERO aqui. O
//     recorte da folha revelava a faixa `[0, altura da barra]`, mas a barra
//     começa DEPOIS do recuo: no aparelho saía uma faixa vazia em cima e a barra
//     cortada embaixo.
//  2. **DESLOCADA.** O lugar de repouso era uma COORDENADA DE TELA medida uma
//     vez. Ela envelhece por um caminho que ninguém observa: o teclado sobe (no
//     modo em que o navegador não reflui o layout, quem compensa é `--kb`), o
//     app remede com ele no ar, o teclado some — e a barra fica parada onde a
//     caixa estava. MEDIDO aqui: 290px acima do lugar, flutuando sobre a lista.
//
// ## O que ele afirma, e por que essas três coisas
//
// Em CADA configuração de tela: a barra pousa EXATAMENTE na borda de cima da
// caixa de controles; ela aparece INTEIRA (o topo e a base dela recebem o dedo);
// e logo abaixo dela não existe nada da janela — que é a metade que mantém o
// transporte alcançável com a Biblioteca fechada.
//
// A medida do recorte é por HIT-TEST, e não pela string do `clip-path`: o que
// importa é o que o dedo encontra, e uma string com `calc()` não resolvido
// aprova qualquer coisa que se queira ler nela.
//
//   node tools/barra-em-qualquer-tela.test.mjs
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

// ===== AS TELAS, e o que cada uma acrescenta =====
//
// A primeira é a tela dos outros oráculos — ela é o CONTROLE do experimento: se
// só ela passasse, o caso não diria nada de novo. As outras duas são o que ela
// não tem.
//
// O ENTALHE é FINGIDO por um token (`--sa-topo`), e é por isso que o token
// existe: `env(safe-area-inset-top)` não se simula num Chromium de mesa, e um
// valor que só o aparelho conhece é um valor que nenhum oráculo alcança. Com
// nome, as duas fórmulas que dependem dele leem a mesma coisa E um teste pode
// escrevê-la.
const TELAS = [
  { nome: 'a tela dos oráculos (430×900, sem entalhe)', vp: { width: 430, height: 900 } },
  { nome: 'um aparelho comum com entalhe (393×786, 39px)', vp: { width: 393, height: 786 }, sa: '39px' },
  { nome: 'uma tela pequena com entalhe (360×740, 24px)', vp: { width: 360, height: 740 }, sa: '24px' },
  // A SEQUÊNCIA DO TECLADO, que é o defeito 2 escrito como cenário: ele sobe, o
  // app remede com ele no ar, ele some. Nada aqui redimensiona a CAIXA — só
  // move o lugar dela —, e é por isso que o `ResizeObserver` não salva.
  { nome: 'depois de o teclado subir, medir e sumir (430×900)', vp: { width: 430, height: 900 }, teclado: 290 },
];

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;

try {
  for (const tela of TELAS) {
    const ctx = await navegador.newContext({ viewport: tela.vp, hasTouch: true });
    await semRedeExterna(ctx);
    // O modo avançado SEMEADO antes da primeira linha do app: ligá-lo depois da
    // carga é uma corrida contra o `setAppMode(appMode)` do `init()`.
    await ctx.addInitScript(() => {
      try { localStorage.setItem('av.appMode', 'full'); } catch (_) { /* storage bloqueado */ }
    });
    const pg = await ctx.newPage();
    pg.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
      erros.push(tela.nome + ': ' + t);
    });
    pg.on('pageerror', (e) => erros.push(tela.nome + ': pageerror: ' + e.message));

    await pg.goto(`http://localhost:${porta}/controle/`, { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(
      () => window.AVDB && typeof window.__avBack === 'function'
        && !!document.querySelector('#playlist li') && !!document.querySelector('.lib-bar'),
      null, { timeout: 30000 },
    );

    const m = await pg.evaluate(async (tela) => {
      const raiz = document.documentElement;
      if (tela.sa) raiz.style.setProperty('--sa-topo', tela.sa);
      if (tela.teclado) {
        // O teclado sobe, o app remede COM ele no ar, e ele some. É a sequência
        // real: a medida acontece no `openHymnSearch`, que é justamente quando o
        // campo ganha foco e o teclado aparece.
        raiz.style.setProperty('--kb', tela.teclado + 'px');
        await new Promise((r) => requestAnimationFrame(r));
        medirBarraDaBiblioteca();
        await new Promise((r) => requestAnimationFrame(r));
        raiz.style.setProperty('--kb', '0px');
      }
      // ASSENTAR pelo FATO: a translação transiciona, e medir no meio dela
      // responde o ponto de partida.
      const folha = document.querySelector('.popup-sheet--lib');
      for (let i = 0; i < 60; i++) {
        const anims = folha.getAnimations ? folha.getAnimations() : [];
        if (!anims.some((a) => a.playState === 'running')) break;
        await new Promise((r) => requestAnimationFrame(r));
      }
      const bar = document.querySelector('.lib-bar');
      const caixa = document.querySelector('.bottombar');
      const rb = bar.getBoundingClientRect();
      const rc = caixa.getBoundingClientRect();
      // O QUE O DEDO ENCONTRA. Três pontos: dentro do topo da barra, dentro da
      // base dela, e logo abaixo — o recorte tem de deixar passar os dois
      // primeiros e apagar o terceiro.
      const naJanela = (y) => {
        const e = document.elementFromPoint(Math.round(rb.left + rb.width / 2), Math.round(y));
        return !!e && folha.contains(e);
      };
      return {
        barra: [Math.round(rb.top), Math.round(rb.bottom)],
        caixa: [Math.round(rc.top), Math.round(rc.bottom)],
        alinhada: Math.round(rb.top) === Math.round(rc.top),
        topoDaBarra: naJanela(rb.top + 3),
        baseDaBarra: naJanela(rb.bottom - 3),
        abaixoDaBarra: naJanela(rb.bottom + 12),
        alturaDaBarra: Math.round(rb.height),
      };
    }, tela);

    checar(m.alinhada,
      '[' + tela.nome + '] a barra pousa na borda de cima da caixa de controles',
      JSON.stringify(m));
    checar(m.topoDaBarra && m.baseDaBarra,
      '[' + tela.nome + '] e ela aparece INTEIRA: o topo e a base dela recebem o '
      + 'dedo — o recorte da folha começa no recuo da área segura, não no zero',
      JSON.stringify(m));
    checar(!m.abaixoDaBarra,
      '[' + tela.nome + '] e logo abaixo dela não existe nada da janela: o '
      + 'transporte continua alcançável com a Biblioteca fechada',
      JSON.stringify(m));

    await ctx.close();
  }

  checar(erros.length === 0, 'nenhum erro de console', erros.join(' | '));
} catch (err) {
  checar(false, 'o oráculo rodou até o fim', String(err && err.message ? err.message : err));
} finally {
  await navegador.close();
  servidor.close();
}

console.log('');
if (falhas.length) {
  console.log('FALHARAM ' + falhas.length + ':');
  falhas.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('Todos passaram.');
