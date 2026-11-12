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
//  D. o `native.js` não leva à ponte o que não é `https`.
// A forma do navegador (`window.open`) é do `tour.test.mjs` (bloco F).
//
//   node tools/guia-no-app.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, comModoAvancado, checar } from './arnes.mjs';

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
  checar(erros.length === 0, 'sem erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}
