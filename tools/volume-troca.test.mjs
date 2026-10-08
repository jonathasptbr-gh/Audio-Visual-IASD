#!/usr/bin/env node
// ============================================================================
// A TROCA DO VOLUME NAS TECLAS FÍSICAS: DEPOIS DOS 100% DO APP, O SISTEMA SOBE E O APP CEDE (v1.12.15)
//
// Pedido do operador: *"ao chegar em 100% no app, ele começa a aumentar o volume do sistema … se
// ambos estão em 0, ele vai para 100% do app e começa a aumentar o do sistema. O ideal é o volume do
// sistema estar na média e o do app ser o único modificado … Tem como, após chegar nos 100% do app,
// e eu estiver aumentando o volume do sistema, ele ao mesmo tempo ir baixando o volume do app?"*
//
// O app não LÊ o volume do sistema (a ponte só o ajusta), então a troca conta os degraus que ELA
// deu. O que este arquivo trava, e cada uma falha CALADA:
//  A. antes dos 100% a tecla só mexe no app, e o sistema não é tocado;
//  B. nos 100% a tecla sobe um degrau do sistema E baixa o app;
//  C. a troca continua enquanto houver degraus, e o app para no PISO (o sistema segue subindo);
//  D. descendo desfaz o par, degrau por degrau, e volta ao comportamento de sempre;
//  E. mexer no fader entre as teclas ZERA a troca (o par deixou de valer);
//  F. no zero do app, sem troca, a tecla de baixo continua indo ao sistema (a válvula).
//
//   node tools/volume-troca.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, checar } from './arnes.mjs';

const PONTE = `(() => {
  window.__sysCalls = [];
  const B = {
    shellVersion: () => 77, role: () => 'controle', appVersion: () => '1.98-teste',
    takeShare: () => '', busPost: () => {}, otaConfirm: () => {},
    systemVolume: (s) => { window.__sysCalls.push(s | 0); },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal','castTarget','saidaDeAudioAlvo',
    'cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages','displays',
    'espelhoCertApagar','espelhoCertEstado','espelhoCertImportar','espelhoDerrubar',
    'espelhoDesligar','espelhoDiag','espelhoEstado','espelhoLigar','keepAlive','listFolder',
    'nowPlaying','openCast','abrirSaidaDeAudio','openExternal','otaApply','otaCheck','otaDiag',
    'otaPending','pickDoc','pickFolder','salvarTexto','temaClaro',
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
const navegador = await abrirNavegador();
const erros = [];
try {
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.addInitScript(PONTE);
  await pg.goto('http://localhost:' + servidor.address().port + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  await pg.waitForFunction(() => window.__NATIVE__ === true && typeof window.__avVolumeKey === 'function', null, { timeout: 30000 });

  const pct = () => pg.evaluate(() => Math.round(volume * 100));
  const sys = () => pg.evaluate(() => window.__sysCalls.slice());
  const tecla = (n) => pg.evaluate((k) => { window.__avVolumeKey(k); }, n);
  const zerar = (v) => pg.evaluate((x) => { applyVolume(x); window.__sysCalls.length = 0; volTrocaN = 0; }, v);

  // A · antes dos 100% só o app
  await zerar(0.9);
  await tecla(1);
  checar(await pct() === 95 && (await sys()).length === 0,
    'A · com o app em 90% a tecla de cima sobe o APP (95%) e não toca no sistema', JSON.stringify({ app: await pct(), sys: await sys() }));

  // B · nos 100% a tecla sobe o sistema E baixa o app
  await zerar(1);
  await tecla(1);
  checar(await pct() === 95 && JSON.stringify(await sys()) === '[1]',
    'B · com o app em 100% a tecla de cima sobe UM degrau do sistema e baixa o app para 95%',
    JSON.stringify({ app: await pct(), sys: await sys() }));

  // C · continua trocando, e o app para no piso
  await tecla(1); await tecla(1);
  checar(await pct() === 85 && (await sys()).length === 3,
    'C1 · a troca CONTINUA nos toques seguintes: 3 degraus de sistema, app em 85% (e não volta a subir o app)',
    JSON.stringify({ app: await pct(), sys: await sys() }));
  for (let i = 0; i < 20; i++) await tecla(1);
  checar(await pct() === 25 && (await sys()).length === 23,
    'C2 · o app cede só até o PISO (25%) e o sistema segue subindo a cada toque', JSON.stringify({ app: await pct(), sys: (await sys()).length }));

  // D · descendo desfaz o par
  await tecla(-1);
  const d1 = { app: await pct(), sys: (await sys()).slice(-1) };
  checar(d1.app === 30 && JSON.stringify(d1.sys) === '[-1]',
    'D1 · a tecla de baixo DESFAZ um par: o sistema desce um degrau e o app sobe 5%', JSON.stringify(d1));
  for (let i = 0; i < 22; i++) await tecla(-1);
  const d2 = await sys();
  checar(await pct() === 100 && d2.filter((x) => x > 0).length === 23 && d2.filter((x) => x < 0).length === 23,
    'D2 · voltando tudo, o app está em 100% e o sistema desceu exatamente os degraus que subiu (sem passar)',
    JSON.stringify({ app: await pct(), subiu: d2.filter((x) => x > 0).length, desceu: d2.filter((x) => x < 0).length }));
  await tecla(-1);
  checar(await pct() === 95, 'D3 · e depois disso a tecla de baixo volta a mexer só no app', String(await pct()));

  // E · mexer no fader entre as teclas zera a troca
  await zerar(1);
  await tecla(1); await tecla(1);                       // app 90, sistema +2
  await pg.evaluate(() => { applyVolume(0.6); window.__sysCalls.length = 0; });   // o operador arrasta o fader
  await tecla(-1);
  checar(await pct() === 55 && (await sys()).length === 0,
    'E · depois de mexer no fader a tecla de baixo mexe só no app (a troca foi esquecida): 60% → 55%, sistema intocado',
    JSON.stringify({ app: await pct(), sys: await sys() }));

  // F · a válvula do zero continua
  await zerar(0);
  await tecla(-1);
  checar(await pct() === 0 && JSON.stringify(await sys()) === '[-1]',
    'F · com o app no zero e sem troca a tecla de baixo vai ao sistema, como sempre', JSON.stringify({ app: await pct(), sys: await sys() }));

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}
