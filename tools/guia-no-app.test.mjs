#!/usr/bin/env node
// ============================================================================
// O GUIA DE SONOPLASTIA DENTRO DO APP (v1.14.2, shell 87)
//
// O botão "Guia de sonoplastia" (Configurações) pede ao shell que abra a página
// numa tela do próprio app (`AVNative.abrirGuia` → `__AVBridge.abrirGuia`, um
// WebView sem ponte). Casco antigo não tem o método e cai no `openExternal`. O
// que este arquivo trava, com a ponte SIMULADA:
//  A. com `abrirGuia` na ponte: o botão o chama com a URL do modo — `#dia` no
//     Fácil, o começo no avançado — e NÃO chama o `openExternal`;
//  B. sem `abrirGuia` (casco 86 e antes): cai no `openExternal`, com a mesma URL;
//  C. com `abrirGuia` RECUSANDO (`false`, a cerca do Kotlin): cai no `openExternal`;
//  D. o `native.js` não leva à ponte o que não é `https`;
//  E. A PÁGINA DO SITE aberta pelo app (`?app=1`, o marcador que o shell 1.14.6
//     passa): some o "voltar ao site" do topo e do rodapé, a esquerda fica
//     reservada ao "fechar" nativo, a âncora `#dia` permanece e o marcador sai
//     da barra de endereço (para não viajar no link de compartilhar). Sem o
//     marcador, o "voltar ao site" continua à vista.
// A forma do navegador (`window.open`) é do `tour.test.mjs` (bloco F).
//
//   node tools/guia-no-app.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, comModoAvancado, checar, falhas, RAIZ_SITE } from './arnes.mjs';

// `guia`: 'aceita' (o shell 87 abre), 'recusa' (devolve false) ou 'ausente' (casco antigo).
const ponte = (guia) => `(() => {
  window.__chamadas = [];
  const B = {
    shellVersion: () => ${guia === 'ausente' ? 86 : 87}, role: () => 'controle', appVersion: () => '1.14.2-teste',
    takeShare: (id) => { setTimeout(() => window.__avResolve(id, ''), 0); }, busPost: () => {}, otaConfirm: () => {},
    openExternal: (u) => { window.__chamadas.push(['openExternal', u]); },
  };
  if (${JSON.stringify(guia)} !== 'ausente') {
    B.abrirGuia = (u) => { window.__chamadas.push(['abrirGuia', u]); return ${guia === 'aceita'}; };
  }
  const nomes = ['apkInstalar','bgProgress','captureVolumeKeys','projecaoLocal','castTarget',
    'cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages','displays','espelhoEstado',
    'espelhoCertApagar','espelhoCertEstado','espelhoCertImportar','espelhoDerrubar',
    'espelhoDesligar','espelhoDiag','espelhoLigar','keepAlive','listFolder',
    'nowPlaying','openCast','abrirSaidaDeAudio','otaApply','otaCheck','otaDiag',
    'otaPending','pickDoc','pickFolder','temaClaro','farolEstado','saidaDeAudioAlvo',
    'ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio',
    'ytPlaylist','ytSearch','ytStream','areaTransferencia','atualizacaoEstado',
  ];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      const id = args[0];
      if (typeof id === 'string') setTimeout(() => { try { window.__avResolve(id, null); } catch (_) {} }, 0);
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const URL = 'http://localhost:' + servidor.address().port + '/controle/';
const servidorSite = servirEstatico(RAIZ_SITE);
await new Promise((r) => servidorSite.listen(0, r));
const SITE = 'http://localhost:' + servidorSite.address().port;
const navegador = await abrirNavegador();
const erros = [];
const GUIA = 'https://audiovisualiasd.com.br/sonoplastia/';

async function tocar(guia, avancado) {
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
  await semRedeExterna(ctx);
  if (avancado) await comModoAvancado(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.addInitScript(ponte(guia));
  await pg.goto(URL, { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  await pg.waitForFunction(() => window.__NATIVE__ === true && typeof appMode === 'string', null, { timeout: 30000 });
  const r = await pg.evaluate(() => {
    window.open = (u) => { window.__chamadas.push(['window.open', u]); return null; };
    document.getElementById('guiaSomBtn').click();
    return { modo: appMode, chamadas: window.__chamadas.slice() };
  });
  return { ctx, pg, ...r };
}

try {
  for (const [avancado, url, rotulo] of [[false, GUIA + '#dia', 'Fácil'], [true, GUIA, 'avançado']]) {
    let t = await tocar('aceita', avancado);
    checar(t.modo === (avancado ? 'full' : 'simple') && JSON.stringify(t.chamadas) === JSON.stringify([['abrirGuia', url]]),
      `A · ${rotulo}, shell 87: o botão abre o guia DENTRO do app (abrirGuia com ${url}) e não chama openExternal`,
      JSON.stringify({ modo: t.modo, chamadas: t.chamadas }));
    await t.ctx.close();

    t = await tocar('ausente', avancado);
    checar(JSON.stringify(t.chamadas) === JSON.stringify([['openExternal', url]]),
      `B · ${rotulo}, casco sem abrirGuia: cai no openExternal com ${url}`, JSON.stringify(t.chamadas));
    await t.ctx.close();

    t = await tocar('recusa', avancado);
    checar(JSON.stringify(t.chamadas) === JSON.stringify([['abrirGuia', url], ['openExternal', url]]),
      `C · ${rotulo}, o shell recusou (false): cai no openExternal`, JSON.stringify(t.chamadas));
    if (!avancado) {
      const d = await t.pg.evaluate(() => {
        window.__chamadas = [];
        const r = AVNative.abrirGuia('http://audiovisualiasd.com.br/sonoplastia/');
        return { r, chamadas: window.__chamadas };
      });
      checar(d.r === false && d.chamadas.length === 0, 'D · o native.js não leva à ponte um endereço sem https', JSON.stringify(d));
    }
    await t.ctx.close();
  }

  // ── E. A PÁGINA DO SITE ABERTA PELO APP ────────────────────────────────
  async function abrirPagina(url, largura = 430) {
    const ctx = await navegador.newContext({ viewport: { width: largura, height: 900 } });
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    const errosDaPagina = [];
    pg.on('pageerror', (e) => errosDaPagina.push(e.message));
    await pg.goto(url, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('.topo-volta', { state: 'attached' });
    return { ctx, pg, errosDaPagina };
  }

  let p = await abrirPagina(SITE + '/sonoplastia/?app=1#dia');
  const noApp = await p.pg.evaluate(() => ({
    classe: document.documentElement.classList.contains('no-app'),
    volta: getComputedStyle(document.querySelector('.topo-volta')).display,
    voltaRodape: getComputedStyle(document.querySelector('.rodape-volta')).display,
    recuo: getComputedStyle(document.querySelector('.topo-in')).paddingLeft,
    consulta: location.search,
    ancora: location.hash,
    tituloEsq: document.querySelector('.topo-meio').getBoundingClientRect().left,
    sobra: document.documentElement.scrollWidth - window.innerWidth,
  }));
  checar(noApp.classe && noApp.volta === 'none' && noApp.voltaRodape === 'none',
    'E · aberto pelo app: o "voltar ao site" some do topo e do rodapé', JSON.stringify(noApp));
  checar(Math.abs(parseFloat(noApp.recuo) - 52) < 1,
    'E · a esquerda fica reservada ao "fechar" nativo (52 px)', noApp.recuo);
  checar(noApp.consulta === '' && noApp.ancora === '#dia',
    'E · o marcador não fica na barra de endereço, e a âncora do Fácil permanece',
    JSON.stringify({ consulta: noApp.consulta, ancora: noApp.ancora }));
  checar(noApp.tituloEsq >= 52,
    'E · o título começa depois da caixa do "fechar" nativo (52 px)', String(noApp.tituloEsq));
  checar(noApp.sobra <= 1, 'E · aberto pelo app, o guia não ganha rolagem horizontal', String(noApp.sobra));
  checar(p.errosDaPagina.length === 0, 'E · a página do guia abre sem erro de JavaScript', p.errosDaPagina.join(' | '));

  // O índice cobre a tela inteira; o "fechar" nativo segue por cima, então o
  // cabeçalho da folha também tem de sair da frente dele.
  await p.pg.click('#btn-indice');
  await p.pg.waitForSelector('#folha:not([hidden])');
  const folha = await p.pg.evaluate(() => ({
    aberta: !document.getElementById('folha').hidden,
    recuo: getComputedStyle(document.querySelector('.folha-cab')).paddingLeft,
  }));
  checar(folha.aberta && Math.abs(parseFloat(folha.recuo) - 52) < 1,
    'E · o índice aberto também reserva a esquerda ao "fechar" nativo', JSON.stringify(folha));
  await p.ctx.close();

  // A 320 px (o menor celular comum) o recuo e as duas pílulas ainda cabem.
  p = await abrirPagina(SITE + '/sonoplastia/?app=1#dia', 320);
  const estreito = await p.pg.evaluate(() => ({
    tituloEsq: document.querySelector('.topo-meio').getBoundingClientRect().left,
    sobra: document.documentElement.scrollWidth - window.innerWidth,
  }));
  checar(estreito.tituloEsq >= 52 && estreito.sobra <= 1,
    'E · a 320 px o guia no app também não estoura nem cobre o título', JSON.stringify(estreito));
  await p.ctx.close();

  p = await abrirPagina(SITE + '/sonoplastia/');
  const semApp = await p.pg.evaluate(() => ({
    classe: document.documentElement.classList.contains('no-app'),
    volta: getComputedStyle(document.querySelector('.topo-volta')).display,
    voltaRodape: getComputedStyle(document.querySelector('.rodape-volta')).display,
  }));
  checar(!semApp.classe && semApp.volta !== 'none' && semApp.voltaRodape !== 'none',
    'E · no navegador, o "voltar ao site" continua à vista (topo e rodapé)', JSON.stringify(semApp));
  await p.ctx.close();

  checar(erros.length === 0, 'sem erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
  servidorSite.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
