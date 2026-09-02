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
// ## O que ele afirma
//
// Em CADA configuração de tela, com a Biblioteca FECHADA: a barra pousa
// EXATAMENTE na borda de cima da caixa de controles; ela aparece INTEIRA (o topo
// e a base dela recebem o dedo); e logo abaixo dela não existe nada da janela.
//
// E DUAS COISAS SOBRE O MOVIMENTO (v1.5.4), que são o segundo relato do
// operador: *"a barra superior acima da barra de buscas … quando é animada para
// fechamento, se torna uma margem saliente durante o movimento"*.
//
//  · **NADA VIAJA ACIMA DA BARRA.** Aquela margem era o `padding-top` da folha —
//    a área segura escrita como RECUO, que existe nos dois estados e portanto
//    acompanha a coluna no meio do caminho. Hoje a barra é o primeiro pixel da
//    folha e a área segura é o DESTINO da abertura. A asserção é medida NO MEIO
//    da animação, que é o único instante em que ela falha.
//  · **OS CONTROLES CONTINUAM ALCANÇÁVEIS COM A JANELA ABERTA.** A janela
//    terminou de ir da base ao topo e passou a ir do topo até a linha da barra
//    (*"mantendo sempre os controles visíveis"*), e fora do recorte não há
//    camada nenhuma.
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
      const camada = document.getElementById('hymnSearchPopup');
      const rb = bar.getBoundingClientRect();
      const rc = caixa.getBoundingClientRect();
      const daJanela = (x, y) => {
        const e = document.elementFromPoint(Math.round(x), Math.round(y));
        return !!e && camada.contains(e);
      };
      // A COLUNA, não a camada. A camada ocupa legitimamente toda a região acima
      // da linha da barra (é dentro dela que a coluna desliza), então perguntar
      // por ela responde "sim" em todo ponto do percurso — e aprovaria a margem
      // saliente. Quem viaja é a coluna, e a barra é o primeiro pixel dela.
      const daColuna = (x, y) => {
        const e = document.elementFromPoint(Math.round(x), Math.round(y));
        return !!e && folha.contains(e);
      };
      // ===== O MEIO DO MOVIMENTO, que é onde a margem saliente aparecia =====
      // Abre, espera a coluna estar A CAMINHO (nem no lugar de partida, nem no
      // de chegada) e pergunta o que existe LOGO ACIMA da barra. A resposta certa
      // é "nada da janela": a barra é o primeiro pixel dela.
      const noMeio = await (async () => {
        openHymnSearch(false);
        for (let i = 0; i < 90; i++) {
          await new Promise((r) => requestAnimationFrame(r));
          const t = bar.getBoundingClientRect().top;
          if (t < rb.top - 24 && t > 24) {
            return { topo: Math.round(t), acima: daColuna(rb.left + rb.width / 2, t - 6) };
          }
        }
        return { topo: -1, acima: false };
      })();
      // ===== E A JANELA ABERTA NÃO COBRE OS CONTROLES =====
      const folha2 = document.querySelector('.popup-sheet--lib');
      for (let i = 0; i < 90; i++) {
        const anims = folha2.getAnimations ? folha2.getAnimations() : [];
        if (!anims.some((a) => a.playState === 'running')) break;
        await new Promise((r) => requestAnimationFrame(r));
      }
      const aberta = {
        barra: Math.round(bar.getBoundingClientRect().top),
        controles: daJanela(window.innerWidth / 2, rc.top + rc.height / 2) ? 'a janela' : 'o app',
      };
      closeHymnSearch();
      for (let i = 0; i < 90; i++) {
        const anims = folha2.getAnimations ? folha2.getAnimations() : [];
        if (!anims.some((a) => a.playState === 'running')) break;
        await new Promise((r) => requestAnimationFrame(r));
      }
      // O QUE O DEDO ENCONTRA. Três pontos: dentro do topo da barra, dentro da
      // base dela, e logo abaixo — o recorte tem de deixar passar os dois
      // primeiros e apagar o terceiro.
      const naJanela = (y) => {
        const e = document.elementFromPoint(Math.round(rb.left + rb.width / 2), Math.round(y));
        return !!e && folha.contains(e);
      };
      // ===== A LARGURA DOS DOIS QUADRADOS É A DA GRADE DE BAIXO (v1.5.5) =====
      // Pedido do operador: *"verifique os botões de abrir biblioteca e playlist
      // automática, para que tenham suas larguras alinhadas a grade dos botões
      // do próprio controle logo abaixo"*.
      //
      // **É AQUI que este caso mora, e não no `smoke`:** a coluna do transporte
      // é PROPORCIONAL (`--deck-col`, sete colunas da largura da caixa) e a
      // largura antiga era FIXA (`--campo-alt`, 40px). Uma medida fixa alinha
      // com uma grade proporcional em UMA largura de tela — por acidente — e
      // erra em todas as outras: MEDIDO, a coluna dá 53,4px a 430px e 43,4px a
      // 360px. Um oráculo de uma tela só não distingue as duas coisas.
      //
      // A régua é o botão RENDERIZADO, nunca a fórmula: as duas caixas resolvem
      // o `100%` de `--deck-col` contra contêineres diferentes, e o que garante
      // que dê no mesmo é o recuo lateral ser o mesmo — uma condição de layout,
      // que só uma medida prende.
      const btn = document.querySelector('.transport .t-btn');
      const lb = btn.getBoundingClientRect();
      const sorteio = document.getElementById('sorteioBtn').getBoundingClientRect();
      const alternador = document.getElementById('hymnSearchToggle').getBoundingClientRect();
      const ultimo = [...document.querySelectorAll('.deck > *')]
        .map((e) => e.getBoundingClientRect())
        .reduce((a, b) => (b.right > a.right ? b : a));
      const grade = {
        coluna: Math.round(lb.width * 10) / 10,
        sorteio: Math.round(sorteio.width * 10) / 10,
        alternador: Math.round(alternador.width * 10) / 10,
        // E AS PONTAS: largura igual não basta se a linha começar noutro lugar.
        esquerdas: Math.abs(sorteio.left - lb.left) <= 1,
        direitas: Math.abs(alternador.right - ultimo.right) <= 1,
      };
      return {
        grade,
        barra: [Math.round(rb.top), Math.round(rb.bottom)],
        caixa: [Math.round(rc.top), Math.round(rc.bottom)],
        alinhada: Math.round(rb.top) === Math.round(rc.top),
        topoDaBarra: naJanela(rb.top + 3),
        baseDaBarra: naJanela(rb.bottom - 3),
        abaixoDaBarra: naJanela(rb.bottom + 12),
        alturaDaBarra: Math.round(rb.height),
        noMeio,
        aberta,
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
    checar(m.noMeio.topo > 0 && !m.noMeio.acima,
      '[' + tela.nome + '] NO MEIO do movimento nada viaja acima da barra — a '
      + 'área segura é o DESTINO da abertura, não um recuo que acompanha a '
      + 'coluna (v1.5.4)', JSON.stringify(m.noMeio));
    checar(Math.abs(m.grade.sorteio - m.grade.coluna) <= 1
      && Math.abs(m.grade.alternador - m.grade.coluna) <= 1,
      '[' + tela.nome + '] os dois quadrados têm a LARGURA da coluna do '
      + 'transporte — a grade é proporcional, e uma medida fixa só acerta numa '
      + 'largura de tela (v1.5.5)', JSON.stringify(m.grade));
    checar(m.grade.esquerdas && m.grade.direitas,
      '[' + tela.nome + '] e as PONTAS batem: a linha começa e acaba onde a '
      + 'fileira de baixo começa e acaba', JSON.stringify(m.grade));
    checar(m.aberta.controles === 'o app',
      '[' + tela.nome + '] e ABERTA ela não cobre os controles: a janela vai do '
      + 'topo até a linha da barra, e fora do recorte não há camada',
      JSON.stringify(m.aberta));

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
