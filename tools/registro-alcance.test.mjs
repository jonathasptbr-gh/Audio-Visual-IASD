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
    // `v1.5` está na AMOSTRA com zero downloads e NÃO na marca d'água — é a
    // versão recém-publicada, e a marca d'água só guarda contagem maior que
    // zero. Sem a união das duas fontes ela some do quadro, e o operador
    // publica sem ver a própria versão.
    { t: dia(0) + 'T23:17:00Z', apk: { 'audio-visual-iasd-v1.5.apk': 0 }, web: { '1.4': 9 }, manifesto: 1480, farol: 18, farolDev: 1, visita: 55, visitaDev: 2 },
  ],
  // NOVE APKs — acima do corte de seis, para o rolo-up do passado disparar.
  // As contagens são escolhidas para a soma do passado (3+4+5 = 12) EMPATAR
  // com a maior barra individual: é o caso em que uma régua mal escolhida
  // estoura a caixa.
  visto: {
    'audio-visual-iasd-v1.4.2.apk': 12,
    'audio-visual-iasd-v1.4.1.apk': 2,
    'audio-visual-iasd-v1.4.apk': 1,
    'audio-visual-iasd-v1.3.12.apk': 1,
    'audio-visual-iasd-v1.3.0.apk': 3,
    'audio-visual-iasd-v1.2.17.apk': 2,
    'audio-visual-iasd-v1.2.4.apk': 3,
    'audio-visual-iasd-v1.1.apk': 4,
    'audio-visual-iasd.apk': 5,
    'web-1.4': 9,
  },
};
const TOTAL_APK = 12 + 2 + 1 + 1 + 3 + 2 + 3 + 4 + 5;   // 33

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
    // Da MARCA D'ÁGUA (`visto`) e não da última amostra: é ela que sobrevive à
    // faxina do `web-ota` — e, desde a v1.4.3, às Releases antigas apagadas à
    // mão. **E ela soma TUDO**, inclusive as versões que o gráfico abaixo
    // agrupa: esconder um número é uma coisa, deixar de contá-lo é outra, e a
    // segunda faria o painel mentir.
    checar(kpis[0] === String(TOTAL_APK),
      'o total soma TUDO — inclusive o que o gráfico agrupa em "anteriores"', kpis[0]);
    // 18 − 13 = 5 aparelhos no último dia.
    checar(kpis[1] === '5', 'aparelhos no dia = a DIFERENÇA do contador entre dois dias', kpis[1]);
    // 55 − 47 = 8 visitas.
    checar(kpis[2] === '8', 'e o mesmo para as visitas', kpis[2]);

    // ---- as barras: geometria RENDERIZADA, não o HTML ----
    const larguras = await pg.$$eval('.barra-f', (es) => es.map((e) => Math.round(e.getBoundingClientRect().width)));
    // seis versões + a linha do passado
    checar(larguras.length === 7, 'seis versões ganham barra, e o passado vira UMA linha', larguras);
    const porRotulo = await pg.$$eval('.barra', (es) => {
      const o = {};
      es.forEach((e) => {
        o[e.querySelector('.barra-t').textContent.trim()] =
          Math.round(e.querySelector('.barra-f').getBoundingClientRect().width);
      });
      return o;
    });
    checar(porRotulo['v1.4.2'] > porRotulo['v1.4.1'] + 8,
      'a barra de 12 é VISIVELMENTE maior que a de 2 — `<span>` inline ignora `width`', porRotulo);
    // ZERO DESENHA UM TRAÇO, não o nada: a linha existe (a versão foi
    // publicada) e a barra tem de dizer que ela não teve download nenhum.
    checar(porRotulo['v1.5'] > 0 && porRotulo['v1.5'] < 8,
      'e a versão em zero desenha um traço mínimo, não uma barra e não o vazio', porRotulo);
    const cor = await pg.$eval('.barra-f', (e) => getComputedStyle(e).backgroundColor);
    checar(cor === 'rgb(46, 109, 231)', 'e ela está pintada (bluejay), não só o trilho', cor);

    // ---- a ordem é por VERSÃO, e a mais nova vem primeiro ----
    const rotulos = await pg.$$eval('.barra-t', (es) => es.map((e) => e.textContent.trim()));
    // A RECÉM-PUBLICADA APARECE MESMO EM ZERO. Ela vive só na amostra, não na
    // marca d'água — e um painel que a omite não tem como responder "onde está
    // a versão que acabei de publicar?".
    checar(rotulos[0] === 'v1.5',
      'a versão recém-publicada aparece mesmo com ZERO download', rotulos[0]);
    checar(rotulos[1] === 'v1.4.2',
      'e a ordem segue por versão, não por contagem', rotulos[1]);
    checar(/^4 anteriores$/.test(rotulos[rotulos.length - 1]),
      'e a última linha nomeia quantas versões ela agrupa', rotulos[rotulos.length - 1]);

    // ---- o passado agrupado SOMA, e a régua o comporta ----
    // 3 + 4 + 5 = 12, o mesmo da maior barra: as duas têm de sair do mesmo
    // tamanho, e nenhuma pode estourar a caixa.
    // com a `v1.5` entrando na frente, o passado agrupa 2+3+4+5 = 14
    const nums = await pg.$$eval('.barra-n', (es) => es.map((e) => e.textContent.trim()));
    checar(nums[nums.length - 1] === '14', 'a linha do passado SOMA as versões que ela esconde', nums);
    const maior = Math.max.apply(null, larguras);
    checar(larguras[larguras.length - 1] <= maior + 1,
      'e a régua a comporta — a soma do passado não estoura a caixa', larguras);

    // ---- a marca do operador ----
    const marcado = await pg.evaluate(() => localStorage.getItem('avRegistroOperador'));
    checar(marcado === '1', 'abrir o Registro marca ESTE navegador como o do operador', marcado);

    // ======================================================================
    // O INTERRUPTOR "ESTE APARELHO" (v1.4.41)
    //
    // A marca sempre existiu e era ESCRITA EM SILÊNCIO, valia para sempre e não
    // tinha volta: um navegador que a ganhasse por engano (um computador
    // emprestado, uma aba aberta para mostrar o painel a alguém) saía da
    // contagem pública sem que ninguém soubesse. Agora ela é visível e
    // reversível.
    //
    // TRÊS METADES, e a terceira é a que carrega o lote:
    //
    //  1. a seção EXISTE e diz o estado — sem ela não há o que operar;
    //  2. desmarcar GRAVA `'0'`, que é o que o farol de visita lê;
    //  3. e a escolha SOBREVIVE À RECARGA. É a que falha calada e é a razão de
    //     o valor ter três estados em vez de dois: com dois, a página reescreve
    //     `'1'` em toda abertura e o interruptor se desfaz sozinho — pior que
    //     não ter interruptor, porque ensina a não confiar na tela.
    //
    // E ela vive FORA do `#pag`: aquele nó é reescrito por inteiro pelo desenho
    // da série e pelo `erro()` do 404, e esta chave não tem nada a ver com a
    // série. A asserção mede a seção com a página JÁ desenhada, que é o estado
    // em que ela some se alguém a prender lá dentro.
    // ======================================================================
    const chave = await pg.evaluate(() => {
      const sec = document.getElementById('esteAparelho');
      const cx = document.getElementById('opContar');
      return {
        secao: !!sec && !sec.hidden,
        foraDoPag: !!sec && !document.getElementById('pag').contains(sec),
        marcada: cx ? cx.checked : null,
        // O RÓTULO É "CONTAR", o oposto da marca guardada: com o rótulo
        // invertido a caixa mentiria sobre o próprio estado, e um teste que só
        // olhasse o `localStorage` aprovaria isso.
        descreve: (document.getElementById('opContarDesc') || {}).textContent || '',
      };
    });
    checar(chave.secao && chave.foraDoPag,
      'a seção "Este aparelho" está à vista e vive FORA do `#pag`, que o desenho '
      + 'da série reescreve por inteiro', chave);
    checar(chave.marcada === false && /contador separado|de teste/i.test(chave.descreve),
      '  ↳ e ela mostra o estado atual: este navegador NÃO conta no número público',
      chave);

    const desmarcou = await pg.evaluate(() => {
      const cx = document.getElementById('opContar');
      cx.checked = true;
      cx.dispatchEvent(new Event('change'));
      return {
        guardado: localStorage.getItem('avRegistroOperador'),
        descreve: document.getElementById('opContarDesc').textContent,
      };
    });
    checar(desmarcou.guardado === '0',
      'marcar a caixa devolve este navegador à contagem pública (`\'0\'`, que é o '
      + 'que o farol de visita lê)', desmarcou);
    checar(/junto com as de todo mundo/i.test(desmarcou.descreve),
      '  ↳ e a frase acompanha, em vez de descrever o estado anterior', desmarcou.descreve);

    await pg.reload({ waitUntil: 'load' });
    await pg.waitForFunction(() => {
      const s2 = document.getElementById('esteAparelho');
      return !!s2 && !s2.hidden;
    }, null, { timeout: 10000 });
    const apos = await pg.evaluate(() => ({
      guardado: localStorage.getItem('avRegistroOperador'),
      marcada: document.getElementById('opContar').checked,
    }));
    checar(apos.guardado === '0' && apos.marcada === true,
      'e a escolha SOBREVIVE À RECARGA — com dois estados a página reescrevia a '
      + 'marca em toda abertura e o interruptor se desfazia sozinho', apos);
    // Devolve o cenário como ele estava: as asserções seguintes deste arquivo
    // (e a metade do `site/index.html`) leem a marca do operador.
    await pg.evaluate(() => localStorage.setItem('avRegistroOperador', '1'));

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
