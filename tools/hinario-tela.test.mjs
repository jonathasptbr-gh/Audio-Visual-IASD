#!/usr/bin/env node
// ============================================================================
// AS SEÇÕES DO HINÁRIO, DA TABELA ATÉ A TELA (v1.1.11)
//
// ## Por que ele existe, ao lado do `hinario.test.mjs`
//
// Aquele trava a REGRA (a tabela cobre 1–600 sem buraco). Este trava a
// LIGAÇÃO, e ela falha de outro jeito: a tabela continua perfeita e o recurso
// não aparece, ou aparece no lugar errado. É a mesma divisão do par
// `sorteio.test.mjs` / `sorteio-tela.test.mjs`.
//
// As metades, e cada uma cobre um modo de errar que não grita:
//
//  1. **O índice nasce FECHADO.** Aberto por padrão, 35 seções empurram os 600
//     hinos para baixo de um paredão — todas as vezes, inclusive nas nove em
//     dez em que o operador já sabe o número que quer.
//  2. **O cabeçalho cai no PRIMEIRO hino da seção, e só nele.** Um cabeçalho a
//     mais no meio de uma seção é um rótulo mentindo, e nada na tela o
//     desmente.
//  3. **A PAGINAÇÃO não escorrega.** Os cabeçalhos moram na MESMA `<ul>` das
//     faixas, e `fillSongList` retoma contando `.hymn-result`. Contar os
//     filhos da lista faria a página 2 começar adiantada — pulando tantos
//     hinos quantos cabeçalhos já existissem. O sintoma seria hinos
//     FALTANDO no meio da lista, sem erro nenhum.
//  4. **O toque numa seção distante GARANTE a linha antes de rolar.** A lista
//     chega de 100 em 100: pedir "Despedida" (592) com 100 linhas desenhadas
//     rolaria até o fim de uma lista que ainda não tem o destino.
//  5. **O hinário de 1996 não recebe NADA.** Os números são os do 2022; o de
//     1996 tem 613 hinos e outra organização. Um "Infantis" sobre o 508 dele
//     seria exatamente o defeito que este recurso existe para não ter — e é o
//     único deles que ninguém notaria olhando a tela do hinário certo.
//
// Roda em Chromium de verdade, no caminho de NAVEGADOR (sem ponte): nada aqui
// depende do shell.
//
//   node tools/hinario-tela.test.mjs
// ============================================================================
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
// Espera pelo FATO; o estouro devolve a FRASE, nunca um veredito sobre o app.
async function esperar(pg, fn, msg, arg, ms = 15000) {
  try { await pg.waitForFunction(fn, arg, { timeout: ms }); checar(true, msg); return true; }
  catch (_) { checar(false, msg, 'PRAZO, não veredito: a condição não chegou em ' + ms + 'ms'); return false; }
}

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
// O modo avançado SEMEADO antes da primeira linha do app: ligá-lo por
// `evaluate` depois da carga é uma corrida contra o `setAppMode(appMode)` do
// `init()`, que chama `closeHymnSearch()`. MEDIDO noutro oráculo deste repo.
await ctx.addInitScript(() => {
  try { localStorage.setItem('av.appMode', 'full'); } catch (_) { /* storage bloqueado */ }
});
const pg = await ctx.newPage();

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
  await pg.goto(`http://localhost:${porta}/controle/`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => (
    window.AVDB && window.AVStream && window.createStage
      && window.Louvorja && window.Bible && window.AVSerie && window.AVSorteio
      && window.AVHinario
      && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li')
      && !!document.querySelector('.tabs')
      && document.querySelector('.tabs').style.getPropertyValue('--tab-w') !== ''
  ), null, { timeout: 30000 });
  checar(true, 'o app sobe com o `AVHinario` publicado — e o watchdog do OTA o exige');

  // ---- Os dois hinários plantados ---------------------------------------
  // 600 faixas no novo e 613 no de 1996, com os campos REAIS de
  // `collState[id].songs`. Sem letra e sem arquivo: nada aqui depende disso, e
  // um acervo mais gordo só deixaria o oráculo mais lento.
  await pg.evaluate(() => {
    const faixas = (n) => Array.from({ length: n }, (_, i) => ({
      id_music: 'h' + (i + 1), track: i + 1, name: 'Hino ' + (i + 1),
      duration: '3:00', has_instrumental_music: false,
      fileIdFull: null, fileIdPlayback: null,
    }));
    collState['hymnal-2022'] = { songs: faixas(600) };
    collState['hymnal-1996'] = { songs: faixas(613) };
  });

  const abrirCard = (nome) => pg.evaluate((n) => {
    const card = [...document.querySelectorAll('#hymnResults .hymnal-card')]
      .find((el) => el.textContent.includes(n));
    if (!card) return false;
    card.querySelector('.coll-bar').click();
    return true;
  }, nome);

  await pg.evaluate(() => { openHymnSearch(); });
  if (!await esperar(pg, () => document.querySelectorAll('#hymnResults .hymnal-card').length >= 2,
    'a Biblioteca desenha os dois cards de hinário')) throw new Error('sem cards');

  checar(await abrirCard('2022'), 'o card do Hinário 2022 abre');
  if (!await esperar(pg, () => !!document.querySelector('#hymnResults .coll-songs .hymn-result'),
    'e lista as faixas')) throw new Error('sem faixas');

  // ---- 1. O ÍNDICE NASCE FECHADO ----------------------------------------
  const inicio = await pg.evaluate(() => {
    const ind = document.querySelector('#hymnResults .hino-indice');
    return {
      existe: !!ind,
      aberto: !!ind && ind.classList.contains('aberto'),
      corpoOculto: !!ind && ind.querySelector('.hino-indice-corpo').hidden,
      chipsVisiveis: ind ? [...ind.querySelectorAll('.hino-indice-chip')]
        .filter((c) => c.offsetParent !== null).length : -1,
      rotulo: ind ? ind.querySelector('.hino-indice-rot').textContent : '',
    };
  });
  checar(inicio.existe, 'o ÍNDICE DE TEMAS existe no topo do card', inicio);
  checar(!inicio.aberto && inicio.corpoOculto && inicio.chipsVisiveis === 0,
    'e ele NASCE FECHADO — 35 seções abertas empurrariam os 600 hinos para baixo '
    + 'de um paredão, todas as vezes', inicio);

  const aberto = await pg.evaluate(async () => {
    document.querySelector('#hymnResults .hino-indice-bar').click();
    await new Promise((r) => setTimeout(r, 120));
    const ind = document.querySelector('#hymnResults .hino-indice');
    return {
      chips: ind.querySelectorAll('.hino-indice-chip').length,
      blocos: ind.querySelectorAll('.hino-indice-bloco').length,
      primeiro: ind.querySelector('.hino-indice-chip-nome').textContent,
      primeiroBloco: ind.querySelector('.hino-indice-bloco').textContent,
      ariaAberto: ind.querySelector('.hino-indice-bar').getAttribute('aria-expanded'),
    };
  });
  checar(aberto.chips === 35 && aberto.blocos === 8,
    'aberto, ele mostra as 35 seções agrupadas nos 8 blocos', aberto);
  checar(/Trindade/.test(aberto.primeiro) && /Doutrina de Deus/.test(aberto.primeiroBloco),
    'na ordem do hinário — o primeiro é "A Trindade", em "A Doutrina de Deus"', aberto);
  checar(aberto.ariaAberto === 'true', 'e a barra anuncia o estado (`aria-expanded`)');

  // ---- 2. O CABEÇALHO CAI NO PRIMEIRO HINO DA SEÇÃO ----------------------
  // A varredura compara a POSIÇÃO de cada cabeçalho com a faixa logo abaixo
  // dele, contra a tabela — que é a pergunta que a tela responde e a regra não.
  const cabecalhos = await pg.evaluate(() => {
    const lista = document.querySelector('#hymnResults .coll-songs');
    const filhos = [...lista.children];
    const r = { pares: [], sobrando: [], total: 0 };
    filhos.forEach((el, i) => {
      if (!el.classList.contains('hino-secao')) return;
      r.total++;
      const prox = filhos[i + 1];
      const num = prox && prox.classList.contains('hymn-result')
        ? Number((prox.dataset.song || '').split(':')[1].replace('h', '')) : null;
      const nome = el.querySelector('.hino-secao-nome').textContent;
      r.pares.push([num, nome]);
      const sec = AVHinario.comecaSecao(num);
      if (!sec || sec.nome !== nome) r.sobrando.push([num, nome]);
    });
    return r;
  });
  checar(cabecalhos.sobrando.length === 0,
    'TODO cabeçalho desenhado está sobre o PRIMEIRO hino da seção que ele nomeia',
    cabecalhos.sobrando);
  // Na primeira página (100 hinos) as seções que começam são as de 1 a 100.
  const esperados = await pg.evaluate(() => AVHinario.SECOES.filter((s) => s.de <= 100).length);
  checar(cabecalhos.total === esperados,
    'e são exatamente os que a tabela prevê para a primeira página — nem um a mais',
    { desenhados: cabecalhos.total, previstos: esperados });

  // ---- 3. A PAGINAÇÃO NÃO ESCORREGA --------------------------------------
  const pagina2 = await pg.evaluate(async () => {
    const lista = document.querySelector('#hymnResults .coll-songs');
    const antes = lista.querySelectorAll('.hymn-result').length;
    const btn = lista.querySelector('.coll-more-btn');
    if (btn) btn.click();
    await new Promise((r) => setTimeout(r, 250));
    const faixas = [...lista.querySelectorAll('.hymn-result')];
    return {
      antes,
      depois: faixas.length,
      // O 101º item da lista tem de ser o hino 101: se a retomada contasse os
      // FILHOS (cabeçalhos incluídos), a página 2 começaria adiantada e os
      // hinos pulados sumiriam da lista sem erro nenhum.
      centesimoPrimeiro: faixas[100]
        ? Number((faixas[100].dataset.song || '').split(':')[1].replace('h', '')) : null,
      // E nenhuma faixa repetida.
      repetidas: faixas.length - new Set(faixas.map((f) => f.dataset.song)).size,
    };
  });
  checar(pagina2.antes === 100 && pagina2.depois === 200,
    'a segunda página traz mais 100 FAIXAS (os cabeçalhos não entram na conta)', pagina2);
  checar(pagina2.centesimoPrimeiro === 101,
    'e a 101ª faixa é o hino 101 — a retomada conta `.hymn-result`, não os filhos '
    + 'da lista; contar os filhos pularia um hino por cabeçalho já desenhado', pagina2);
  checar(pagina2.repetidas === 0, 'sem faixa repetida', pagina2);

  // ---- 4. O TOQUE NUMA SEÇÃO DISTANTE GARANTE A LINHA --------------------
  const salto = await pg.evaluate(async () => {
    const ind = document.querySelector('#hymnResults .hino-indice');
    const chip = [...ind.querySelectorAll('.hino-indice-chip')]
      .find((c) => /Despedida/.test(c.textContent));
    const antes = document.querySelectorAll('#hymnResults .coll-songs .hymn-result').length;
    chip.click();
    await new Promise((r) => setTimeout(r, 400));
    const cab = document.querySelector('#hymnResults .hino-secao[data-secao="592"]');
    return {
      antes,
      depois: document.querySelectorAll('#hymnResults .coll-songs .hymn-result').length,
      temCabecalho: !!cab,
      nome: cab ? cab.querySelector('.hino-secao-nome').textContent : '',
    };
  });
  checar(salto.depois > salto.antes && salto.depois >= 592,
    'tocar em "Despedida" (592) ESTICA a lista até o destino existir — sem isso o '
    + 'toque rolaria até o fim de uma lista que ainda não o tem', salto);
  checar(salto.temCabecalho && salto.nome === 'Despedida',
    'e o cabeçalho da seção está no documento', salto);

  // ---- 5. O HINÁRIO DE 1996 NÃO RECEBE NADA ------------------------------
  await pg.evaluate(() => { closeHymnSearch(); openHymnSearch(); });
  await esperar(pg, () => document.querySelectorAll('#hymnResults .hymnal-card').length >= 2,
    'a Biblioteca reabre');
  checar(await abrirCard('1996'), 'o card do Hinário 1996 abre');
  if (!await esperar(pg, () => !!document.querySelector('#hymnResults .coll-songs .hymn-result'),
    'e lista as faixas dele')) throw new Error('sem faixas 1996');
  const velho = await pg.evaluate(() => ({
    indice: document.querySelectorAll('#hymnResults .hino-indice').length,
    cabecalhos: document.querySelectorAll('#hymnResults .hino-secao').length,
    faixas: document.querySelectorAll('#hymnResults .coll-songs .hymn-result').length,
  }));
  checar(velho.faixas > 0, 'ele lista os hinos normalmente', velho);
  checar(velho.indice === 0 && velho.cabecalhos === 0,
    'e NÃO recebe índice nem cabeçalho: os números são os do 2022, e um "Infantis" '
    + 'sobre o 508 do hinário velho é o defeito que este recurso existe para não ter',
    velho);

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
