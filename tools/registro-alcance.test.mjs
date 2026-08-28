// A MEDIÇÃO DE ALCANCE — a tranca, a aritmética e o ROTEAMENTO do farol.
//
// Este oráculo existe por duas razões, e a segunda é a que paga o arquivo.
//
// ## 1. A página desenha errado sem errar
//
// `node --check` aprova um gráfico que mente. MEDIDO neste lote: `.barra-c` e
// `.barra-f` eram `<span>`, que é INLINE — e em elemento inline `width` e
// `height` não fazem nada. As quatro barras saíam do mesmo tamanho, com o
// trilho à vista e o preenchimento invisível: 12, 5, 3 e 1 desenhados
// idênticos. Nada falhou, nada foi ao console, e o defeito só apareceu
// olhando a imagem. Daí a asserção ser sobre a GEOMETRIA renderizada, e não
// sobre o HTML gerado.
//
// ## 2. O ROTEAMENTO do farol falha calado, e é o requisito inteiro
//
// A promessa é "o uso próprio não masca os dados", e ela é cumprida por
// CONSTRUÇÃO: quem audita conta noutro contador. Se o roteamento parar de
// funcionar, nada quebra — a página abre, o gráfico desenha, os números sobem.
// Só que passam a incluir quem mede. Não há sintoma, e o dado fica errado para
// sempre, porque um contador não se corrige depois.
//
// Por isso o teste é sobre a URL que SAI: `v.txt` para um visitante,
// `v-dev.txt` depois de a página do Registro ter sido aberta, e NENHUMA na
// segunda visita do mesmo dia.
//
//   node tools/registro-alcance.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml' };

const servidor = http.createServer((rq, rs) => {
  let f = decodeURIComponent(rq.url.split('?')[0]);
  if (f.endsWith('/')) f += 'index.html';
  try {
    const b = fs.readFileSync(path.join(RAIZ, f));
    rs.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
    rs.end(b);
  } catch { rs.writeHead(404); rs.end('nao'); }
});
await new Promise((r) => servidor.listen(0, r));
const BASE = 'http://127.0.0.1:' + servidor.address().port;

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

// ---- uma série sintética: 3 dias, com o funil visitas > aparelhos ----
// Os valores são escolhidos para a DIFERENÇA ser conferível à mão:
// farol 10 → 13 → 18  dá  3 e 5 aparelhos.
const dia = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const SERIE = {
  amostras: [
    { t: dia(2) + 'T23:17:00Z', apk: {}, web: { '1.4': 2 }, manifesto: 1000, farol: 10, farolDev: 1, visita: 40, visitaDev: 2 },
    { t: dia(1) + 'T23:17:00Z', apk: {}, web: { '1.4': 5 }, manifesto: 1240, farol: 13, farolDev: 1, visita: 47, visitaDev: 2 },
    { t: dia(0) + 'T23:17:00Z', apk: {}, web: { '1.4': 9 }, manifesto: 1480, farol: 18, farolDev: 1, visita: 55, visitaDev: 2 },
  ],
  visto: {
    'audio-visual-iasd-v1.4.apk': 12, 'audio-visual-iasd-v1.0.apk': 3, 'web-1.4': 9,
  },
};

const navegador = await chromium.launch();
try {
  // =================================================================
  // A TRANCA
  // =================================================================
  {
    const ctx = await navegador.newContext();
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    await pg.goto(BASE + '/registro/', { waitUntil: 'domcontentloaded' });
    const txt = (await pg.locator('body').innerText()).trim();
    checar(txt === 'Não encontrado.', 'sem a chave a página não mostra NADA — nem os rótulos', txt);
    const marcado = await pg.evaluate(() => localStorage.getItem('avRegistroOperador'));
    // Sem esta guarda, quem chegasse por engano ao caminho seria marcado como
    // operador e sairia da contagem de visitas para sempre.
    checar(marcado === null, 'e não marca o navegador como o do operador', marcado);
    await ctx.close();
  }

  // =================================================================
  // A ARITMÉTICA E O DESENHO
  // =================================================================
  {
    const ctx = await navegador.newContext({ viewport: { width: 900, height: 900 } });
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    const erros = [];
    pg.on('pageerror', (e) => erros.push(String(e.message)));
    await pg.route('**raw.githubusercontent.com/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SERIE) }));
    await pg.goto(BASE + '/registro/#alcance', { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('.kpi');

    const kpis = await pg.locator('.kpi-n').allInnerTexts();
    // 12 + 3 = 15, da MARCA D'ÁGUA (`visto`) e não da última amostra: é ela que
    // sobrevive à faxina do `web-ota`, que apaga assets — e com eles a contagem.
    checar(kpis[0] === '15', 'os downloads somam a marca d\'água, não só o que ainda existe', kpis[0]);
    // 18 − 13 = 5 aparelhos no último dia.
    checar(kpis[1] === '5', 'aparelhos no dia = a DIFERENÇA do contador entre dois dias', kpis[1]);
    // 55 − 47 = 8 visitas.
    checar(kpis[2] === '8', 'e o mesmo para as visitas', kpis[2]);

    // ---- as barras: geometria RENDERIZADA, não o HTML ----
    const larguras = await pg.$$eval('.barra-f', (es) => es.map((e) => Math.round(e.getBoundingClientRect().width)));
    checar(larguras.length === 2, 'uma barra por APK visto', larguras);
    checar(larguras[0] > larguras[1] + 8,
      'a barra de 12 é VISIVELMENTE maior que a de 3 — `<span>` inline ignora `width`', larguras);
    const cor = await pg.$eval('.barra-f', (e) => getComputedStyle(e).backgroundColor);
    checar(cor === 'rgb(46, 109, 231)', 'e ela está pintada (bluejay), não só o trilho', cor);

    // ---- a marca do operador ----
    const marcado = await pg.evaluate(() => localStorage.getItem('avRegistroOperador'));
    checar(marcado === '1', 'abrir o Registro marca ESTE navegador como o do operador', marcado);

    // ---- o medidor de horas fica FORA quando as amostras são diárias ----
    // Intervalos maiores que 3 h são descartados: entre duas amostras de 24 h
    // não há como saber quanto do contador veio de qual hora, e uma média
    // sobre o dia inteiro seria um número preciso e falso.
    const secs = await pg.locator('h2').allInnerTexts();
    checar(!secs.some((s) => s.includes('Horas de uso')),
      'com amostras de 24 h o medidor de horas NÃO é desenhado', secs);

    checar(erros.length === 0, 'nenhum erro de página', erros);
    await ctx.close();
  }

  // =================================================================
  // O ROTEAMENTO DO FAROL DE VISITA — o requisito que falha calado
  // =================================================================
  {
    const ctx = await navegador.newContext();
    await semRedeExterna(ctx);
    const pedidos = [];
    // DEPOIS do `semRedeExterna`: o Playwright resolve as rotas da mais
    // recente para a mais antiga, então esta vence o corte de rede.
    await ctx.route('**github.com/**/dados-latest/**', (r) => {
      pedidos.push(new URL(r.request().url()).pathname.split('/').pop().split('?')[0]);
      return r.fulfill({ status: 200, body: 'x' });
    });
    const pg = await ctx.newPage();

    await pg.goto(BASE + '/', { waitUntil: 'networkidle' });
    checar(pedidos.join() === 'v.txt', 'um visitante acende o contador PÚBLICO', pedidos.slice());

    // ---- a segunda visita do MESMO dia não conta ----
    // É isso que torna "visitas" a mesma unidade que "aparelhos por dia" e
    // permite as duas dividirem um eixo no gráfico.
    await pg.goto(BASE + '/?de-novo', { waitUntil: 'networkidle' });
    checar(pedidos.length === 1, 'e a segunda visita do mesmo dia NÃO acende de novo', pedidos.slice());

    // ---- depois de abrir o Registro, ele conta noutro lugar ----
    await pg.route('**raw.githubusercontent.com/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SERIE) }));
    await pg.goto(BASE + '/registro/#alcance', { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('.kpi');
    // o dia é apagado para forçar um novo acendimento, que é o que se quer medir
    await pg.evaluate(() => localStorage.removeItem('avVisitaDia'));
    await pg.goto(BASE + '/', { waitUntil: 'networkidle' });
    checar(pedidos.join() === 'v.txt,v-dev.txt',
      'quem auditou a página passa a contar no contador de TESTE — a exclusão é por construção',
      pedidos.slice());
    await ctx.close();
  }
} finally {
  await navegador.close();
  servidor.close();
}

console.log('');
if (falhas.length) {
  console.log('REPROVOU: ' + falhas.length + ' assercao(oes).');
  process.exit(1);
}
console.log('Todos passaram.');
