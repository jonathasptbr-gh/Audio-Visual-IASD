// A TELA DA REDE num Chromium DE VERDADE — o papel `tela` do telão por
// comandos (docs/TELAO-POR-COMANDOS.md, E3).
//
// O que este arquivo prova, e por que cada asserção existe:
//
//  1. A ENTRADA gasta o gesto: código errado tem frase, código certo abre o
//     SSE e esconde o overlay — e o display-ready da tela sobe pelo dreno,
//     que é o que faz o Controle reenviar a cena (v5.140).
//  2. O TEXTO chega INTACTO: um versículo com acento atravessa o SSE e
//     aparece no DOM — o caminho de comandos não passa por saneamento nenhum
//     (spec §5.2; o sanear() do Kotlin é do Registro e apagaria acentos).
//  3. A CORREÇÃO DE RELÓGIO anula um desvio de 90 s: o cronômetro viaja por
//     DESCRITOR ancorado em Date.now() do celular, e uma tela com o relógio
//     fora contaria errado na frente de todo mundo. O servidor de mentira
//     mente o relógio de propósito e o teste exige a leitura certa.
//  4. O DRENO DE SUBIDA é lista de permissão: diag-ask chega, o display
//     responde diag-dump, e NADA disso sobe — só display-ready e tela-status.
//     (São os N-telas-emitindo que o dreno do papel espelho já calava, na
//     direção oposta.)
//  5. A RECONEXÃO se reapresenta: fluxo derrubado → novo GET /e → NOVO
//     display-ready (sem ele, a tela reconectada ficaria no wallpaper até o
//     operador tocar em algo).
//  6. O ADEUS não é sentença nem martelo: o overlay volta com a frase do
//     operador e NENHUM GET /e novo sai (o código rotaciona a cada ligar —
//     martelar a porta seria inútil e barulhento).
//  7. O BroadcastChannel está neutralizado NO ENVIO: duas abas no mesmo PC
//     não podem se contaminar.
//
//   PW_CHROMIUM=<caminho> node tools/tela-rede.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + obtido : '')); falhas.push(msg); }
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
// `fn` pode devolver Promise (todo pg.$eval devolve) — e uma Promise é truthy:
// sem o await, o poll "passaria" na primeira volta sem olhar o valor. Foi
// exatamente o defeito da primeira versão deste arquivo.
async function ate(fn, ms = 4000, passo = 50) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await fn()) return true; await espera(passo); }
  return await fn();
}

// ---------------------------------------------------------------------------
// O SERVIDOR DE MENTIRA — o contrato da spec §5, e nada além dele.
//
// O RELÓGIO DELE MENTE DE PROPÓSITO: DESVIO_MS à frente do relógio desta
// máquina. É o cenário da Smart TV com o relógio fora — e é exatamente o que
// a correção de relógio do tela.js existe para anular.
// ---------------------------------------------------------------------------
const TOKEN = 'dGVsYS1kZS1jb21hbmRvcy10';
const DESVIO_MS = 90_000;
const agoraDoCelular = () => Date.now() + DESVIO_MS;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const PREFIXOS = { '/display/': 'display', '/shared/': 'shared', '/espelho/': 'espelho' };

let lotado = false;
let atrasoDaLetraAte = 0;   // a rota /m/ da imagem de letra 404a até este instante
const visto = { volta: [], gets: 0, pares: [], getsPor: {} };
let sse = null;             // a resposta do GET /e em curso
let aoAbrirSse = null;

function json(res, status, obj) {
  const b = Buffer.from(JSON.stringify(obj || {}));
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': b.length, 'Cache-Control': 'no-store' });
  res.end(b);
}
function corpoDe(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => { s += c; });
    req.on('end', () => { try { resolve(JSON.parse(s)); } catch (_) { resolve(null); } });
  });
}

const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');

  for (const [pre, dir] of Object.entries(PREFIXOS)) {
    if (req.method === 'GET' && u.pathname.startsWith(pre)) {
      const alvo = path.join(WEB, dir, u.pathname.slice(pre.length));
      if (!alvo.startsWith(path.join(WEB, dir)) || !fs.existsSync(alvo)) { json(res, 404, {}); return; }
      let b = fs.readFileSync(alvo);
      // A MARCA DO PAPEL `tela`, como o servidor de verdade a injeta
      // (`EspelhoServidor.comMarcaDeTela`). Sem ela aqui, o percurso inteiro
      // seria provado por um caminho — a query — que o aparelho pode não
      // receber: é exatamente essa divergência entre o servidor de mentira e o
      // de verdade que deixou "a tela abre no wallpaper e não conecta" passar
      // pelo CI. `<meta>` e não `<script>`: a CSP da resposta real não permite
      // script embutido.
      if (alvo.endsWith('.html')) {
        b = Buffer.from(b.toString('utf8').replace('<head>', '<head><meta name="av-tela" content="1">'), 'utf8');
      }
      const cab = { 'Content-Type': MIME[path.extname(alvo)] || 'application/octet-stream', 'Content-Length': b.length, 'Cache-Control': 'no-store' };
      // A CSP DA PÁGINA, verbatim do `EspelhoHttp.CABECALHOS_PAGINA`. Ela é o
      // que FORÇA a exclusão do embed do YouTube nas telas da rede — e é uma
      // restrição REAL que o navegador aplica: um harness que não a manda prova
      // o percurso num ambiente mais permissivo que o do aparelho.
      if (alvo.endsWith('.html')) {
        cab['Content-Security-Policy'] = "default-src 'self'; frame-ancestors 'none'; "
          + "base-uri 'none'; img-src 'self' blob: data:; media-src 'self' blob:";
      }
      res.writeHead(200, cab);
      res.end(b);
      return;
    }
  }

  if (req.method === 'POST' && u.pathname === '/par') {
    const c = await corpoDe(req);
    visto.pares.push(c);
    // SEM CÓDIGO (v5.189): a porta é o endereço. O servidor de mentira só
    // recusa quando o teste pede que ele recuse (`lotado`), para o caminho da
    // frase continuar coberto.
    if (lotado) { json(res, 403, { estado: 'lotado' }); return; }
    json(res, 200, { t: TOKEN });
    return;
  }

  if (req.method === 'GET' && u.pathname === '/e') {
    if (req.headers.authorization !== 'Bearer ' + TOKEN) { json(res, 404, {}); return; }
    visto.gets++;
    // ATRIBUIÇÃO POR PÁGINA: o contador global não distingue quem abriu o fio, e
    // a seção 9 precisa afirmar que UMA página específica não reconectou
    // sozinha. O cabeçalho vem do contexto do Playwright (`extraHTTPHeaders`).
    const dePagina = req.headers['x-teste-pagina'] || '?';
    visto.getsPor[dePagina] = (visto.getsPor[dePagina] || 0) + 1;
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'close' });
    res.write('data: ' + JSON.stringify({ m: 'oi', ms: agoraDoCelular() }) + '\n\n');
    sse = res;
    if (aoAbrirSse) { const f = aoAbrirSse; aoAbrirSse = null; f(res); }
    return;
  }

  if (req.method === 'GET' && u.pathname.startsWith('/m/')) {
    // A IMAGEM DE FUNDO DA LETRA CHEGA ATRASADA, e isso é o desenho, não um
    // acidente: `telaEmpurrarImagensLetra` a enfileira DEPOIS da mídia principal
    // no mesmo canal serializado, porque o som não espera as fotos. Até os bytes
    // atravessarem, a rota responde 404. `atrasoDaLetraAte` é o relógio disso.
    if (u.pathname.includes('LENTA') && Date.now() < atrasoDaLetraAte) { json(res, 404, {}); return; }
    // Um PNG de 1×1 — o bastante para provar que a tela busca a mídia na URL
    // servida pelo celular (o resto do Range é provado por JUnit no shell).
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64');
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length, 'Accept-Ranges': 'bytes' });
    res.end(png);
    return;
  }

  if (req.method === 'POST' && u.pathname === '/r') {
    if (req.headers.authorization !== 'Bearer ' + TOKEN) { json(res, 404, {}); return; }
    visto.volta.push(await corpoDe(req));
    json(res, 200, {});
    return;
  }

  json(res, 404, {});
});

function evento(obj) { if (sse) sse.write('data: ' + JSON.stringify(obj) + '\n\n'); }
function ping() { if (sse) sse.write(': ping ' + agoraDoCelular() + '\n\n'); }
const sts = () => visto.volta.filter((c) => c && c.do === 'st').map((c) => c.st);

await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;

const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
const pg = await ctx.newPage();
const errosConsole = [];
// ZERO PEDIDO A TERCEIRO, e a régua ficou mais forte na v5.212.
//
// Até aqui este teste afirmava que a CSP BARRAVA a IFrame API do YouTube — isto
// é, que o `display.js` PEDIA o script e o navegador recusava. A garantia era
// real, mas de segunda ordem: ela dependia de um cabeçalho continuar certo. Com
// o embed removido dos dois papéis, a afirmação passa a ser sobre o que a página
// FAZ: ela não pede. Um `<script>` de terceiro que voltasse ao `display.js`
// falharia aqui mesmo que a CSP o barrasse depois — que é a ordem certa de
// descobrir isso.
const pedidosDeFora = [];
pg.on('request', (r) => {
  let host = '';
  try { host = new URL(r.url()).host; } catch (_) { return; }
  if (host && host !== new URL(base).host) pedidosDeFora.push(host + ' ← ' + r.resourceType());
});
pg.on('console', (m) => {
  const t = m.text();
  if (m.type() !== 'error') return;
  if (/Failed to load resource/.test(t)) return;
  errosConsole.push(t);
});

// ---------------------------------------------------------------------------
// 1. A entrada
// ---------------------------------------------------------------------------
// SEM `?tela=1` NA URL, de propósito: é assim que o aparelho a recebe quando o
// redirecionamento, um favorito ou o navegador da TV comem a query. Quem diz o
// papel é a marca que o servidor injetou (v1.92).
await pg.goto(base + '/display/index.html');
await pg.waitForSelector('#telaEntrada', { state: 'visible' });
checar(true, 'o overlay de entrada aparece por cima do display, SEM query nenhuma');
checar(await pg.evaluate(() => window.__AV_ROLE__ === 'tela'),
  'e o papel é `tela` pela MARCA do servidor, não pela URL');
checar(await pg.$eval('#startBtn', (e) => e.hidden),
  'e o "Ligar Sistema" do display está escondido — um overlay de gesto só');

// LOTADO tem FRASE, não silêncio — e o overlay CONTINUA de pé, porque não há
// nada por baixo dele para proteger.
lotado = true;
await pg.click('#telaEntrar');
await ate(() => visto.pares.length >= 1);
// ESPERAR A FRASE, e não o SERVIDOR. Este teste esperava `visto.pares` — isto
// é, que o servidor de mentira tivesse RECEBIDO o POST — e lia `#telaMsg` no
// instante seguinte. Só que quem escreve a frase é o cliente, DEPOIS de ler a
// resposta: entre uma coisa e a outra há uma volta de rede e um `await`, e o
// teste ganhava a corrida na maioria das vezes. Era essa a instabilidade que
// fazia o arquivo falhar em duas de cada três execuções e passar "na segunda
// tentativa" — com `continue-on-error` no CI, um teste assim não é rede de
// segurança nenhuma, é ruído que ensina a ignorar a cor vermelha.
await ate(async () => /limite de telas/i.test(await pg.$eval('#telaMsg', (e) => e.textContent)));
checar(/limite de telas/i.test(await pg.$eval('#telaMsg', (e) => e.textContent)),
  'lotado tem frase, não silêncio');
checar(await pg.$eval('#telaEntrada', (e) => e.style.display !== 'none'),
  'e o overlay fica de pé — não há nada por baixo para ele cobrir');
checar(!visto.pares.some((c) => c && 'codigo' in c),
  'o pedido de entrada NÃO manda código nenhum — a porta é o endereço (v5.189)');

lotado = false;
await pg.click('#telaEntrar');
await ate(() => visto.gets >= 1, 5000);
checar(visto.gets >= 1, 'o toque em "Ativar esta tela" abre o SSE');
await ate(() => pg.$eval('#telaEntrada', (e) => e.style.display === 'none').catch(() => false), 4000);
checar(await pg.$eval('#telaEntrada', (e) => e.style.display === 'none'),
  'e o overlay some');

// ---------------------------------------------------------------------------
// 1-bis. UM TOQUE, E SÓ UM — e nenhum segundo botão (v5.214 · v5.218)
//
// O botão de entrada gasta o gesto em TUDO de uma vez: pareamento, som e tela
// cheia. O que este bloco trava é o desfecho que o operador relatou — a tela
// ativava por inteiro e um SEGUNDO botão nascia por cima dela oferecendo
// justamente o que aquele mesmo toque acabara de fazer.
//
// A causa (v5.214) era `oferecerGesto()` rodando no clique que gasta o gesto:
// `requestFullscreen()` é assíncrono, o clique borbulha até o `document` antes
// de a tela cheia existir, e a pergunta "o que falta?" era respondida contra o
// passado. Na v5.218 o botão de canto saiu por inteiro — a recarga passou a
// voltar para a entrada oficial, que era a razão de ele existir —, e a regra
// virou a mais simples que existe: **não há segundo botão, em momento nenhum.**
//
// A ASSERÇÃO NÃO DEPENDE DE O NAVEGADOR CONCEDER TELA CHEIA, de propósito — um
// oráculo que exigisse a concessão viraria vermelho num runner que a negue, e
// vermelho ambiental é o que ensina a ignorar vermelho (a lição da v5.204).
// ---------------------------------------------------------------------------
const emCheia = () => pg.evaluate(() => !!(document.fullscreenElement || document.webkitFullscreenElement));
await ate(emCheia, 2500);
checar(await pg.evaluate(() => !document.getElementById('telaCanto')),
  'o toque que ativa a tela NÃO deixa um segundo botão pedindo o que ele já fez');

// O CAMINHO DE VOLTA — sem ele, apagar os atalhos "passaria" no teste acima e
// tiraria a única saída de quem esbarra na tecla errada do controle remoto. São
// os dois gestos que a v5.218 deixou no lugar do botão. Só exercitáveis onde a
// tela cheia foi concedida, e o contrário é DITO em vez de passar em silêncio
// (a lição da v5.213).
if (await emCheia()) {
  await pg.evaluate(() => document.exitFullscreen());
  await ate(async () => !(await emCheia()), 2000);
  await pg.dblclick('body');
  await ate(emCheia, 2500);
  checar(await emCheia(), 'o TOQUE DUPLO devolve a tela cheia');

  await pg.evaluate(() => document.exitFullscreen());
  await ate(async () => !(await emCheia()), 2000);
  await pg.keyboard.press('F11');
  await ate(emCheia, 2500);
  checar(await emCheia(), 'e o F11 faz o mesmo — o atalho de quem opera num computador');
} else {
  console.log('----    os atalhos de volta não foram exercitados: este navegador não concedeu tela cheia');
}

// O token nunca em URL — a regra de sempre, no transporte novo.
checar(!visto.pares.some((c) => JSON.stringify(c).includes(TOKEN)),
  'o token não aparece em nenhum corpo de /par');

await ate(() => sts().some((s) => s && s.type === 'display-ready'), 5000);
const pronto = sts().find((s) => s && s.type === 'display-ready');
checar(!!pronto, 'o display-ready da tela SOBE pelo dreno (é ele que traz a cena de volta)');
checar(!!(pronto && pronto.__de), 'e carrega o __de que endereça a resposta', JSON.stringify(pronto));
// E O `__tela`, que é o campo que o Controle EXIGE para reenviar as
// preferências (`if (msg.__tela) telaReenviarPreferencias(...)`): wallpaper,
// fundo da letra (`lyricsbg`) e preenchimento (`fit`).
//
// Ele faltava desde a v5.188 — a versão que criou aquele reenvio. O
// `tela-status` sempre o anexou; o `display-ready`, nunca. Não havia erro em
// lugar nenhum: a função simplesmente NUNCA RODAVA para uma tela de verdade, e
// as três preferências não existiam nela. O relato que fechou o caso foi o
// fundo dos slides preto com a opção ligada; o wallpaper e o preenchimento
// estavam quebrados do mesmo jeito, calados, porque o padrão deles é aceitável.
//
// Esta asserção é a metade PRODUTORA do contrato; a consumidora (o Controle
// reagindo ao campo) está no `boot-nativo.test.mjs`. As duas juntas, porque foi
// exatamente a divergência entre elas que ninguém viu.
checar(!!(pronto && pronto.__tela),
  'e o __tela — é ele que faz o Controle reenviar wallpaper, fundo da letra e preenchimento',
  JSON.stringify(pronto));

// ---------------------------------------------------------------------------
// 2. Texto intacto, com acento
// ---------------------------------------------------------------------------
evento({ type: 'text', mode: 'verse', main: 'Porque Deus amou o mundo de tal maneira…', sub: 'João 3:16', view: 'visual', __mid: 'm:1' });
await ate(() => pg.$eval('#textMain', (e) => e.textContent.includes('maneira…')).catch(() => false), 4000);
checar(await pg.$eval('#textMain', (e) => e.textContent.includes('Porque Deus amou o mundo de tal maneira…')),
  'o versículo atravessa o SSE INTACTO — acento e reticências incluídos');
checar(await pg.$eval('#textSub', (e) => e.textContent.includes('João 3:16')),
  'com a referência');

// ---------------------------------------------------------------------------
// 3. A correção de relógio — o cronômetro conta certo com o relógio 90 s fora
// ---------------------------------------------------------------------------
evento({ type: 'text', mode: 'chrono', view: 'visual', chrono: { mode: 'stopwatch', running: true, startAt: agoraDoCelular(), baseMs: 0 }, __mid: 'm:2' });
await espera(1200);
{
  const lido = await pg.$eval('#textMain', (e) => e.textContent.trim());
  const m = lido.match(/(\d+):(\d{2})/);
  const segundos = m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : NaN;
  checar(m !== null && segundos <= 5,
    'o cronômetro lê ~0 s — o desvio de 90 s do relógio da tela foi ANULADO', lido);
}

// ---------------------------------------------------------------------------
// 4. Sorteio, cortina e text-hide
// ---------------------------------------------------------------------------
evento({ type: 'text', mode: 'draw', view: 'visual', draw: { kind: 'number', value: 7, min: 1, max: 10 }, __mid: 'm:3' });
await ate(() => pg.$eval('#textMain', (e) => e.textContent.trim() === '7').catch(() => false), 4000);
checar(await pg.$eval('#textMain', (e) => e.textContent.trim() === '7'), 'o sorteio desenha o número');

evento({ type: 'text-hide', __mid: 'm:4' });
await ate(() => pg.$eval('#text', (e) => e.hidden).catch(() => false), 4000);
checar(await pg.$eval('#text', (e) => e.hidden), 'text-hide tira a Camada de Texto de cena');

// ---------------------------------------------------------------------------
// 5. O dreno de subida é lista de PERMISSÃO
// ---------------------------------------------------------------------------
{
  const antes = visto.volta.length;
  evento({ type: 'diag-ask', __mid: 'm:5' });
  await espera(800);
  const novos = visto.volta.slice(antes).filter((c) => c && c.do === 'st');
  checar(!novos.some((c) => c.st && c.st.type === 'diag-dump'),
    'diag-ask chega, o display responde, e o diag-dump MORRE no dreno');
  const tipos = new Set(sts().map((s) => s && s.type));
  for (const t of tipos) {
    checar(t === 'display-ready' || t === 'tela-status',
      'só display-ready e tela-status sobem — subiu: ' + t);
  }
}

// ---------------------------------------------------------------------------
// 5b. A MÍDIA da E4: o __rec aponta para /m/ e a tela busca DO CELULAR
// ---------------------------------------------------------------------------
{
  evento({
    type: 'load', mediaId: 'img1', view: 'visual', muted: true, volume: 1,
    __rec: { id: 'img1', kind: 'image', name: 'Cartaz', type: 'image/png', url: '/m/tokimg111111111111111' },
    __mid: 'm:6',
  });
  await ate(() => pg.$eval('#img', (e) => !e.hidden && e.src.includes('/m/')).catch(() => false), 5000);
  checar(await pg.$eval('#img', (e) => !e.hidden && e.src.includes('/m/tokimg111111111111111')),
    'o load com __rec toca a mídia da URL /m/ — sem IDB, sem OPFS, do celular');
}

// ---------------------------------------------------------------------------
// 5c. O wallpaper por URL e o aviso de cena-sem-rede
// ---------------------------------------------------------------------------
{
  evento({ type: 'wallpaper', __wp: '/m/tokwp1111111111111111', __mid: 'm:7' });
  await ate(() => pg.$eval('#wallpaper', (e) => e.style.backgroundImage.includes('/m/')).catch(() => false), 4000);
  checar(await pg.$eval('#wallpaper', (e) => e.style.backgroundImage.includes('/m/tokwp1111111111111111')),
    'o wallpaper vem pela URL do comando — o IDB da tela está vazio e não importa');

  // E O AVISO NU NÃO APAGA NADA. O Controle emite DOIS comandos a cada troca de
  // wallpaper: `setWallpaper` manda `{type:'wallpaper'}` sem `__wp` ("mudou,
  // releiam o estado") e o enriquecimento manda o `__wp` num segundo tempo,
  // depois de ler o blob. O primeiro caía no caminho do telão de verdade, que
  // lê o IndexedDB — e o da tela da rede está VAZIO por construção: ele só
  // podia desfazer o inline que o `__wp` acabara de pintar. Toda troca piscava
  // o desenho padrão nas telas, e ficava nele se o segundo comando se perdesse.
  evento({ type: 'wallpaper', __mid: 'm:7a' });
  await new Promise((r) => setTimeout(r, 500));
  checar(await pg.$eval('#wallpaper', (e) => e.style.backgroundImage.includes('/m/tokwp1111111111111111')),
    'um comando `wallpaper` SEM `__wp` não apaga o fundo que está em cena na tela da rede');

  // O sentinela 'padrao' (v5.188): o operador voltou ao wallpaper padrão — a
  // tela desfaz o inline e o desenho do CSS (o símbolo oficial) volta a valer.
  evento({ type: 'wallpaper', __wp: 'padrao', __mid: 'm:7b' });
  await ate(() => pg.$eval('#wallpaper', (e) => e.style.backgroundImage === '').catch(() => false), 4000);
  checar(await pg.$eval('#wallpaper', (e) => e.style.backgroundImage === ''),
    "o sentinela 'padrao' devolve o desenho padrão — sem ele a tela ficaria presa na última imagem");

  // A LETRA COM FUNDO (v5.188): o __rec leva `imageUrl` por estrofe (a URL /m/
  // da imagem empurrada) e ele tem de SOBREVIVER ao cache do acervo da tela —
  // é dali que display.js/stage.js releem o registro.
  evento({
    type: 'load', mediaId: 'hino2', muted: true,
    __rec: {
      id: 'hino2', kind: 'audio', name: 'Hino', type: 'audio/mp4', url: '/m/tokhin111111111111111',
      lyrics: [{ time: 0, text: 'Estrofe 1', imageUrl: '/m/tokly1111111111111111' }],
    },
    __mid: 'm:7c',
  });
  await ate(() => pg.evaluate(() => window.AVDB.getMedia('hino2').then((r) => !!r)).catch(() => false), 4000);
  const recLetra = await pg.evaluate(() => window.AVDB.getMedia('hino2'));
  checar(recLetra && recLetra.lyrics && recLetra.lyrics[0].imageUrl === '/m/tokly1111111111111111',
    'o imageUrl da estrofe atravessa o __rec e o getMedia embrulhado — é dele que o fundo da letra sai');

  // ---------------------------------------------------------------------------
  // A IMAGEM DE FUNDO QUE CHEGA ATRASADA (v5.221)
  //
  // O relato: numa tela recém-ativada, a primeira música toca com os slides em
  // PRETO — e desligar e religar "imagens" nas Configurações conserta. O bloco
  // acima só provava que o `imageUrl` sobrevive ao `__rec`; ninguém nunca
  // afirmou que a imagem CHEGA À TELA, e era aí que o defeito morava.
  //
  // A causa não é a preferência (ela viaja certo, e o `lyricsbg` abaixo a
  // reproduz): é que as imagens são enfileiradas DEPOIS da música inteira, no
  // mesmo canal serializado, e a tela desistia de buscá-las em ~2,4 s — antes de
  // existir qualquer possibilidade de sucesso. Desistir cedo demais deixava o
  // slide preto PARA SEMPRE, porque nada reexamina uma estrofe já renderizada.
  //
  // Este caso mede exatamente isso: bytes que só existem depois da janela antiga.
  {
    evento({ type: 'lyricsbg', mode: 'image', __mid: 'm:7d' });
    await espera(150);
    atrasoDaLetraAte = Date.now() + 3000;      // > os ~2,4 s da ladeira antiga
    evento({
      type: 'load', mediaId: 'hino3', muted: true,
      __rec: {
        id: 'hino3', kind: 'audio', name: 'Hino', type: 'audio/mp4', url: '/m/tokhin111111111111111',
        lyrics: [{ time: 0, text: 'Estrofe 1', imageUrl: '/m/tokLENTA11111111111111' }],
      },
      __mid: 'm:7e',
    });
    const temFundo = () => pg.$eval('#lyricsImg',
      (e) => !e.hidden && (e.getAttribute('src') || '').includes('LENTA')).catch(() => false);
    checar(await ate(temFundo, 12000),
      'a imagem de fundo que chega ATRASADA ainda aparece — sem religar a opção',
      'src=' + await pg.$eval('#lyricsImg', (e) => e.getAttribute('src') || '(sem src)'));
    atrasoDaLetraAte = 0;
  }

  evento({ type: 'tela-aviso', texto: 'Esta cena não aparece nas telas da rede.', __mid: 'm:8' });
  await ate(() => pg.$eval('#telaAviso', (e) => e.textContent.includes('não aparece')).catch(() => false), 4000);
  checar(await pg.$eval('#telaAviso', (e) => e.textContent.includes('não aparece')),
    'a cena que não vai para a rede é DITA, nunca uma tela vazia sem explicação');
}

// ---------------------------------------------------------------------------
// 6. Reconexão: o fluxo cai e a tela SE REAPRESENTA
// ---------------------------------------------------------------------------
{
  const getsAntes = visto.gets;
  const prontosAntes = sts().filter((s) => s && s.type === 'display-ready').length;
  sse.end();
  sse = null;
  await ate(() => visto.gets > getsAntes, 6000);
  checar(visto.gets > getsAntes, 'o fluxo derrubado reconecta sozinho');
  await ate(() => sts().filter((s) => s && s.type === 'display-ready').length > prontosAntes, 5000);
  checar(sts().filter((s) => s && s.type === 'display-ready').length > prontosAntes,
    'e a tela REANUNCIA o display-ready — sem ele, a cena não voltaria');
}

// ---------------------------------------------------------------------------
// 7. O adeus
// ---------------------------------------------------------------------------
{
  // A TELA NUNCA MAIS É COBERTA depois de ativada (v5.189). O `adeus` do
  // operador tira o FIO, não a mídia: o `<video>` toca um arquivo local
  // (`/m/`) e a letra anda pelo `timeupdate` dele. Um overlay aqui apagaria
  // uma projeção que continua perfeitamente viva.
  const paresAntes = visto.pares.length;
  const getsAntes = visto.gets;
  lotado = true;                 // o celular não devolve token: transmissão desligada
  evento({ m: 'adeus' });
  await espera(2500);
  checar(await pg.$eval('#telaEntrada', (e) => e.style.display === 'none'),
    'depois do adeus o overlay NÃO volta — a mídia em cena não pode ser coberta');
  checar(visto.gets === getsAntes,
    'e NENHUM GET /e novo sai — nada de martelar uma porta fechada');
  // A reentrada é silenciosa e ESPAÇADA (1 s, 3 s, 8 s…): ela existe para a
  // tela voltar sozinha quando o operador religar, sem ninguém atravessar o
  // salão — e não pode virar uma martelada.
  const tentativas = visto.pares.length - paresAntes;
  checar(tentativas >= 1 && tentativas <= 3,
    'a reentrada tenta sozinha, mas espaçada (' + tentativas + ' pedido(s) em 2,5 s)');
  lotado = false;
}

// ---------------------------------------------------------------------------
// 8. O BroadcastChannel está neutralizado no envio
// ---------------------------------------------------------------------------
{
  const vazou = await pg.evaluate(() => new Promise((resolve) => {
    const ouve = new BroadcastChannel('teste-neutro');
    ouve.onmessage = () => resolve(true);
    new BroadcastChannel('teste-neutro').postMessage({ oi: 1 });
    setTimeout(() => resolve(false), 400);
  }));
  checar(vazou === false, 'postMessage do BroadcastChannel é no-op no papel tela');
}

// ---------------------------------------------------------------------------
// 9. A RECARGA VOLTA PARA A ENTRADA OFICIAL (v5.216 · v5.218)
//
// Este é o caminho que nenhum teste percorria, e foi por ele que passaram os
// dois defeitos do relato:
//
//  • o `#startBtn` ("Ligar Sistema", o overlay da era do navegador) voltava,
//    porque quem o escondia era uma linha dentro de `montarEntrada()` — e essa
//    função só roda na primeira carga. Ele não pareia, não solta o som e não
//    pede tela cheia: só se esconde. O visitante gastava nele o único gesto e a
//    tela ficava conectada, MUDA e em janela;
//  • e a tela reconectava POR TRÁS, sem oferecer a ativação — o gesto tinha
//    morrido com a navegação, e nada na tela dizia como recuperá-lo.
//
// A regra agora é a do operador: **recarregar volta para a entrada oficial**, a
// mesma do primeiro acesso. A asserção mede o que o DEDO encontra
// (`elementFromPoint` no centro), e não só a propriedade `hidden`: é o centro
// da tela que decide para onde vai o toque, e era exatamente ali que o botão
// errado estava.
// ---------------------------------------------------------------------------
{
  // A PÁGINA PRINCIPAL SAI DE CENA PRIMEIRO, e isto é o que torna a medição
  // atribuível: depois do `adeus` da seção 7 ela fica numa escada de reentrada
  // (comportamento correto, e afirmado ali mesmo), então um `GET /e` dela cairia
  // no contador global e seria lido como "a tela recarregada reconectou
  // sozinha". Foi exatamente o falso positivo que a primeira versão desta seção
  // produziu.
  await pg.close();

  // CONTEXTO PRÓPRIO, com um cabeçalho que identifica esta página no servidor de
  // mentira. Sem ele a asserção "não reconectou sozinha" lê um contador global —
  // e a primeira versão desta seção falhou por isso, culpando a página nova por
  // um `GET /e` que era de outra.
  const ctx3 = await navegador.newContext({
    viewport: { width: 1280, height: 720 },
    extraHTTPHeaders: { 'x-teste-pagina': 'recarga' },
  });
  const pg3 = await ctx3.newPage();
  await pg3.goto(base + '/display/index.html');
  await pg3.waitForSelector('#telaEntrada', { state: 'visible' });
  await pg3.click('#telaEntrar');
  // ESPERAR O FIO ABRIR, e não o overlay sumir. `ativar()` esconde o overlay
  // ANTES de `pedirEntrada()` voltar (o gesto não espera a rede), e é a resposta
  // do pareamento que grava o token no sessionStorage. Esperar o overlay era
  // ganhar a corrida por acidente: num runner mais lento a recarga chegava antes
  // do `guardar()`, o token não existia e o toque seguinte pedia vaga nova — a
  // asserção de baixo reprovava culpando o app por uma corrida do teste. O
  // `GET /e` só acontece depois do `guardar()`, então ele é o sinal honesto.
  // (Mesma família da corrida que a v5.204 consertou neste arquivo.)
  await ate(() => (visto.getsPor.recarga || 0) >= 1, 5000);

  const getsAntes = visto.getsPor.recarga || 0;
  await pg3.reload();
  await pg3.waitForSelector('#telaEntrada', { state: 'visible', timeout: 5000 }).catch(() => {});
  const depois = await pg3.evaluate(() => {
    const sb = document.getElementById('startBtn');
    const cs = sb && getComputedStyle(sb);
    const ent = document.getElementById('telaEntrada');
    const meio = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return {
      antigo: !!(sb && !sb.hidden && cs.display !== 'none'),
      entrada: !!(ent && ent.style.display !== 'none'),
      rotulo: (document.getElementById('telaEntrar') || {}).textContent || '',
      meio: meio ? (meio.id || String(meio.className) || meio.tagName) : '?',
    };
  });
  checar(!depois.antigo,
    'recarregar a tela NÃO traz de volta o "Ligar Sistema" da era do navegador');
  checar(depois.entrada && /ativar esta tela/i.test(depois.rotulo),
    'recarregar volta para a ENTRADA OFICIAL — o mesmo botão do primeiro acesso',
    'entrada=' + depois.entrada + ' rótulo="' + depois.rotulo + '"');
  checar(!/start/.test(depois.meio),
    'e o centro da tela não é um botão que gastaria o gesto sem ativar nada',
    'no centro: ' + depois.meio);
  checar((visto.getsPor.recarga || 0) === getsAntes,
    'e ela NÃO reconecta sozinha: o fio só abre quando alguém toca',
    'GET /e novos desta página: ' + ((visto.getsPor.recarga || 0) - getsAntes));

  // E o toque REAPROVEITA A VAGA: `telasSse` é indexado pelo token, então pedir
  // pareamento novo a cada F5 deixaria a sessão anterior ocupando lugar até o
  // vigia notá-la — e a terceira recarga seguida bateria no teto de três telas.
  const paresAntes = visto.pares.length;
  await pg3.click('#telaEntrar');
  await ate(() => (visto.getsPor.recarga || 0) > getsAntes, 5000);
  checar((visto.getsPor.recarga || 0) > getsAntes, 'e o toque reconecta');
  checar(visto.pares.length === paresAntes,
    'reaproveitando o token — sem pedir vaga nova a cada recarga (o teto é 3)',
    'POST /par novos: ' + (visto.pares.length - paresAntes));
  await ctx3.close();
}

checar(pedidosDeFora.length === 0,
  'a tela da rede não pede UM BYTE a origem nenhuma além do celular',
  pedidosDeFora.join(' | '));
checar(errosConsole.length === 0, 'nenhum erro de console no percurso inteiro',
  errosConsole.join(' | '));

await navegador.close();
servidor.close();
if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
