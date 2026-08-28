// O FILTRO DE PLATAFORMA DA PÁGINA — o download some para quem não é Android.
//
// Este oráculo existe porque as DUAS metades falham CALADAS, e em direções
// opostas:
//
//  - de MENOS: a classificação para de reconhecer o iPhone (a Apple muda a
//    forma do `userAgent`, alguém mexe na expressão), o download volta a
//    aparecer ali, e a página continua linda. Ninguém relata "baixei e não
//    abriu" para o repositório — a pessoa conclui que o app está quebrado e
//    vai embora;
//
//  - de MAIS: a classificação passa a recusar um Android de verdade. **Este é
//    o caro**, e é o motivo de o desenho FALHAR ABERTO: sem classe no `<html>`
//    nada é escondido. A última asserção mede exatamente essa propriedade, e
//    ela não tem sintoma nenhum — um Android sem botão de baixar é uma página
//    que abre, rola e não oferece nada.
//
// A prova é sobre o que se VÊ (`isVisible`), nunca sobre a marcação: um link
// dentro de um bloco `display:none` continua no HTML, e um teste que
// procurasse o `href` aprovaria as duas versões.
//
//   node tools/plataforma.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

// A PÁGINA É SERVIDA COM OS PLACEHOLDERS JÁ TROCADOS, como o `pages.yml` a
// publica. Servir o arquivo cru mediria uma página que ninguém recebe — e o
// `{{URL_APK}}` viraria um `href` relativo que o navegador resolve para o
// próprio site, escondendo um botão que não leva a lugar nenhum.
const TROCA = { '{{VERSAO}}': '1.4.3', '{{TAMANHO}}': '4,2 MB', '{{URL_APK}}': 'https://exemplo.invalido/app.apk' };

const servidor = http.createServer((rq, rs) => {
  let f = decodeURIComponent(rq.url.split('?')[0]);
  if (f.endsWith('/')) f += 'index.html';
  try {
    let b = fs.readFileSync(path.join(RAIZ, f));
    if (f.endsWith('.html')) {
      let s = b.toString('utf8');
      for (const [k, v] of Object.entries(TROCA)) s = s.split(k).join(v);
      b = Buffer.from(s, 'utf8');
    }
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

// AS QUATRO CADEIAS SÃO VERBATIM, e isso é a mesma regra do `serie.test.mjs`:
// um `userAgent` imaginado prova só que a expressão concorda com quem a
// escreveu. O do iPad é o de um iPadOS 13+, que se anuncia como Macintosh — o
// caso que uma leitura ingênua de `/iPad/` deixa passar.
const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 13; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

const navegador = await chromium.launch();

// Abre a página com um `userAgent` e, quando pedido, com o toque de um iPad —
// é `maxTouchPoints` que separa o iPadOS 13+ do Mac, e os dois mandam a MESMA
// cadeia. Sem forjá-lo, o caso do iPad não existe.
async function abrir(ua, toques) {
  const ctx = await navegador.newContext({ userAgent: ua, viewport: { width: 900, height: 900 } });
  await semRedeExterna(ctx);
  if (toques) {
    await ctx.addInitScript(`Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });`);
  }
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push(String(e.message)));
  await pg.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  return { ctx, pg, erros };
}

const ver = async (pg, sel) => await pg.locator(sel).first().isVisible();

try {
  // =================================================================
  // ANDROID — a página inteira, como sempre foi
  // =================================================================
  for (const [nome, ua] of [['Chrome', UA.android], ['Firefox', UA.androidFirefox]]) {
    const { ctx, pg, erros } = await abrir(ua);
    const classe = await pg.evaluate(() => document.documentElement.className);
    checar(classe === 'plat-android', `${nome} no Android é classificado como Android`, classe);
    checar(await ver(pg, '#guia'), `${nome}: o guia de instalação aparece`);
    checar(await ver(pg, '.baixar'), `${nome}: o botão de baixar aparece`);
    checar(!(await ver(pg, '.aviso-ios')) && !(await ver(pg, '.aviso-outro')),
      `${nome}: e nenhum aviso de plataforma aparece`);
    // O TAMANHO DO ARQUIVO é atributo do download, e anda com ele.
    checar(/MB/.test(await pg.locator('.meta').innerText()),
      `${nome}: e a faixa da marca anuncia o tamanho do arquivo`);
    checar(erros.length === 0, `${nome}: nenhum erro de página`, erros);
    await ctx.close();
  }

  // O VÃO DE TOPO: `section + section` conta irmãos NO DOM, e um irmão
  // `display:none` continua contando. Sem o `margin-top:0`, o guia nasce com o
  // vão de uma seção inteira entre ele e a faixa da marca — um respiro grande
  // demais, que ninguém relata e ninguém explica.
  {
    const { ctx, pg } = await abrir(UA.android);
    const m = await pg.$eval('#guia', (e) => getComputedStyle(e).marginTop);
    checar(m === '0px', 'no Android o guia abre o `main` sem vão de topo herdado dos avisos ocultos', m);
    await ctx.close();
  }

  // =================================================================
  // iOS — iPhone e o iPadOS que se diz Macintosh
  // =================================================================
  for (const [nome, ua, toques] of [['iPhone', UA.iphone, false], ['iPad (iPadOS 13+)', UA.ipad, true]]) {
    const { ctx, pg, erros } = await abrir(ua, toques);
    const classe = await pg.evaluate(() => document.documentElement.className);
    checar(classe === 'plat-ios', `${nome} é classificado como iOS`, classe);
    // A ASSERÇÃO É SOBRE O QUE SE VÊ. O `<a>` continua no HTML; o que não
    // existe é um caminho até ele — `display:none` o tira da árvore de
    // acessibilidade e da ordem de tabulação junto.
    checar(!(await ver(pg, '#guia')), `${nome}: o guia de instalação NÃO aparece`);
    checar(!(await ver(pg, '.baixar')), `${nome}: nenhum botão de baixar aparece`);
    checar(await ver(pg, '.aviso-ios'), `${nome}: o aviso de iOS aparece`);
    checar(!(await ver(pg, '.aviso-outro')), `${nome}: e só ele — o do computador fica fora`);
    const txt = await pg.locator('.aviso-ios').innerText();
    // A frase tem de dizer as DUAS coisas: por que não dá, e o que fazer.
    // Um aviso que só recusa deixa a pessoa sem passo seguinte.
    checar(/App Store/i.test(txt) && /Android/i.test(txt),
      `${nome}: e ele diz POR QUE não dá e O QUE fazer`, txt.slice(0, 160));
    checar(!/MB/.test(await pg.locator('.meta').innerText()),
      `${nome}: e o TAMANHO do arquivo some junto — ele é atributo do download`);
    checar(erros.length === 0, `${nome}: nenhum erro de página`, erros);
    await ctx.close();
  }

  // =================================================================
  // COMPUTADOR — Windows e macOS sem toque
  // =================================================================
  for (const [nome, ua] of [['Windows', UA.windows], ['macOS', UA.mac]]) {
    const { ctx, pg, erros } = await abrir(ua);
    const classe = await pg.evaluate(() => document.documentElement.className);
    checar(classe === 'plat-outro', `${nome} é classificado como "outro"`, classe);
    checar(!(await ver(pg, '#guia')), `${nome}: o guia de instalação NÃO aparece`);
    checar(!(await ver(pg, '.baixar')), `${nome}: nenhum botão de baixar aparece`);
    checar(await ver(pg, '.aviso-outro'), `${nome}: o aviso do computador aparece`);
    checar(!(await ver(pg, '.aviso-ios')), `${nome}: e o de iOS fica fora`);
    const m = await pg.$eval('.aviso-outro', (e) => getComputedStyle(e).marginTop);
    checar(m === '0px', `${nome}: o aviso abre o \`main\` sem vão herdado do irmão oculto`, m);
    // O ENDEREÇO SAI DO `location`, nunca do HTML: o site vive sob um prefixo
    // de caminho hoje e pode migrar para um domínio próprio. Um literal
    // continuaria bonito e passaria a apontar para um 404.
    const end = await pg.locator('.aviso-outro .endereco').innerText();
    checar(end === new URL(BASE).host + '/', `${nome}: o endereço a digitar sai do \`location\``, end);
    checar(!/MB/.test(await pg.locator('.meta').innerText()),
      `${nome}: e o TAMANHO do arquivo some junto — ele é atributo do download`);
    checar(erros.length === 0, `${nome}: nenhum erro de página`, erros);
    await ctx.close();
  }

  // O RESTO DA PÁGINA CONTINUA DE PÉ. Esconder o guia é a única coisa que o
  // filtro faz: as funções, as telas e os modos de uso são verdade em qualquer
  // aparelho, e uma página que se apaga inteira não explica nada a ninguém.
  {
    const { ctx, pg } = await abrir(UA.windows);
    const h2 = await pg.locator('main h2:visible').allInnerTexts();
    checar(h2.includes('Tudo o que o culto precisa') && h2.includes('Como é na prática'),
      'no computador o resto da página continua à vista', h2);
    checar(await ver(pg, '.telas img'), 'inclusive as telas do app');
    await ctx.close();
  }

  // =================================================================
  // A FALHA É ABERTA — e esta é a asserção que carrega o arquivo
  // =================================================================
  //
  // Sem classe no `<html>` (script bloqueado, JS desligado, uma exceção que
  // não previmos) NADA é escondido. É a escolha do desenho, e é o único modo
  // de errar que não se pode pagar: um Android de verdade sem botão de baixar
  // e sem uma frase dizendo por quê.
  {
    const { ctx, pg } = await abrir(UA.windows);
    checar(!(await ver(pg, '.baixar')), 'no computador o download está escondido — o ponto de partida');
    await pg.evaluate(() => { document.documentElement.className = ''; });
    checar(await ver(pg, '#guia') && await ver(pg, '.baixar'),
      'e SEM a classe no `<html>` o guia e o download voltam: o filtro FALHA ABERTO');
    checar(!(await ver(pg, '.aviso-ios')) && !(await ver(pg, '.aviso-outro')),
      'e nenhum aviso é afirmado sem classificação — nada é adivinhado');
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
