#!/usr/bin/env node
// ============================================================================
// A PASSAGEM DO VOLUME NAS TECLAS FÍSICAS: DOIS CICLOS, O SISTEMA SOBE E O APP CEDE O MESMO (v1.12.18)
//
// Pedido do operador: *"depois que bate 100% no app, cada % que sobe no sistema, desce o mesmo no app,
// até o som do sistema chegar a 60% — aí ele sobe apenas no app até o app chegar em 100% novamente,
// então ele permite o sistema subir até o máximo, ainda baixando o app novamente. Então teria dois
// ciclos."* (a v1.12.17 recuava o app a ~50% a cada degrau e o recuo ia ficando menor). O app LÊ o
// volume do sistema (`systemVolumeStep` → antes/depois/max, shell 78). O que este arquivo trava, e
// cada uma falha CALADA:
//  A. antes dos 100% a tecla só mexe no app, e o sistema não é tocado;
//  B. 1º ciclo: nos 100% cada toque sobe UM degrau do sistema e baixa o app o MESMO tanto (a soma
//     app + sistema fica em 100%), e a passagem SEGUE com o app abaixo do teto, até o sistema chegar a 60%;
//  C. no alvo ela acaba: as teclas voltam a mexer só no app, até o teto;
//  D. 2º ciclo: do teto de novo o sistema sobe até o máximo, com o app cedendo outra vez, e acaba no máximo;
//  E. com o sistema no máximo, ou recusando o degrau, o app NÃO cede (não cai sem o sistema subir);
//  F. mexer no fader no meio da passagem a encerra (o par deixou de valer);
//  G. a tecla de baixo mexe só no app, e no zero vai ao sistema (a válvula de sempre).
//
//   node tools/volume-troca.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, checar } from './arnes.mjs';

const PONTE = `(() => {
  // O sistema falso: 15 degraus. \`fixo\` simula um volume que o app não consegue mexer.
  window.__sis = { cur: 3, max: 15, fixo: false };
  window.__sysCalls = [];
  const passo = (s) => {
    const antes = window.__sis.cur;
    if (!window.__sis.fixo) window.__sis.cur = Math.max(0, Math.min(window.__sis.max, antes + (s > 0 ? 1 : -1)));
    return { antes, depois: window.__sis.cur, max: window.__sis.max };
  };
  const B = {
    shellVersion: () => 78, role: () => 'controle', appVersion: () => '1.98-teste',
    takeShare: () => '', busPost: () => {}, otaConfirm: () => {},
    systemVolume: (s) => { window.__sysCalls.push(s | 0); passo(s | 0); },
    systemVolumeStep: (id, s) => {
      window.__sysCalls.push(s | 0);
      const r = passo(s | 0);
      setTimeout(() => { try { window.__avResolve(id, r); } catch (_) {} }, 0);
    },
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
  const sis = () => pg.evaluate(() => window.__sis.cur);
  const calls = () => pg.evaluate(() => window.__sysCalls.slice());
  // A tecla e a espera pela resposta do sistema (o passo é assíncrono: uma ida e volta da ponte).
  const tecla = async (n) => {
    await pg.evaluate((k) => { window.__avVolumeKey(k); }, n);
    await pg.waitForFunction(() => !volSistemaEmVoo, null, { timeout: 5000 });
  };
  const zerar = (app, cur, fixo = false) => pg.evaluate(([a, c, f]) => {
    applyVolume(a); window.__sis.cur = c; window.__sis.fixo = f; window.__sysCalls.length = 0;
  }, [app, cur, fixo]);

  const estado = () => pg.evaluate(() => ({ app: Math.round(volume * 100), cur: window.__sis.cur, max: window.__sis.max, calls: window.__sysCalls.length }));
  const soma = (e) => e.app + Math.round((e.cur / e.max) * 100);

  // A · antes dos 100% só o app
  await zerar(0.9, 3);
  await tecla(1);
  checar(await pct() === 95 && (await calls()).length === 0,
    'A · com o app em 90% a tecla de cima sobe o APP (95%) e não toca no sistema', JSON.stringify({ app: await pct(), sys: await calls() }));

  // B · 1º ciclo: nove toques levam o sistema de 0 a 60% (9/15) e o app de 100% a 40%, em lockstep
  await zerar(1, 0);
  const ciclo1 = [];
  for (let i = 0; i < 9; i++) { await tecla(1); ciclo1.push(await estado()); }
  const lockstep = ciclo1.every((e) => Math.abs(soma(e) - 100) <= 1);
  checar(lockstep && ciclo1.every((e, i) => e.cur === i + 1),
    'B · em cada toque o sistema sobe UM degrau e o app desce o MESMO tanto (app + sistema = 100%), mesmo com o app abaixo do teto', JSON.stringify(ciclo1.map((e) => [e.app, e.cur])));
  const fim1 = ciclo1[8];
  checar(fim1.cur === 9 && fim1.app === 40,
    'B · no 9º toque o sistema chega a 60% (9/15) e o app a 40% — e a passagem acaba aí', JSON.stringify(fim1));

  // C · de volta ao app: sobe só ele, até o teto
  await tecla(1);
  const c1 = await estado();
  checar(c1.app === 45 && c1.cur === 9 && c1.calls === 9,
    'C · o toque seguinte sobe só o APP (40% → 45%): o sistema fica em 60% e não é tocado', JSON.stringify(c1));
  for (let i = 0; i < 11; i++) await tecla(1);
  const c2 = await estado();
  checar(c2.app === 100 && c2.cur === 9 && c2.calls === 9,
    'C · e o app sobe sozinho até 100%', JSON.stringify(c2));

  // D · 2º ciclo: do teto de novo o sistema sobe até o máximo, e o app cede o mesmo
  const ciclo2 = [];
  for (let i = 0; i < 6; i++) { await tecla(1); ciclo2.push(await estado()); }
  checar(ciclo2.every((e, i) => e.cur === 10 + i) && ciclo2.every((e) => Math.abs(soma(e) - 160) <= 1),
    'D · 2º ciclo: o sistema sobe de 60% ao máximo, um degrau por toque, e o app desce o mesmo (de 100% a 60%)', JSON.stringify(ciclo2.map((e) => [e.app, e.cur])));
  await tecla(1);
  const d1 = await estado();
  checar(d1.app === 65 && d1.cur === 15 && d1.calls === 15,
    'D · e depois do máximo o toque sobe só o APP (60% → 65%)', JSON.stringify(d1));
  for (let i = 0; i < 7; i++) await tecla(1);
  await tecla(1);
  const d2 = await estado();
  checar(d2.app === 100 && d2.cur === 15,
    'E · com o app em 100% e o sistema no máximo o app não cede (o pedido ao sistema é inofensivo: ele já está no máximo)', JSON.stringify(d2));

  // E · degrau recusado
  await zerar(1, 3, true);
  await tecla(1);
  checar(await pct() === 100 && await sis() === 3,
    'E · se o sistema RECUSA o degrau (volume fixo), o app não cede', JSON.stringify({ app: await pct(), sis: await sis() }));
  await pg.evaluate(() => { window.__sis.fixo = false; });
  await tecla(1);
  const e1 = await estado();
  checar(e1.cur === 4 && e1.app === 93,
    'E · e a recusa não deixa passagem pendurada: o toque seguinte começa uma nova (4/15, app 93%)', JSON.stringify(e1));

  // F · fader no meio da passagem
  await zerar(1, 0);
  await tecla(1); await tecla(1);                       // sistema 2/15, app ~87%
  await pg.evaluate(() => { applyVolume(0.5); });       // o operador arrasta o fader
  await tecla(1);
  const f1 = await estado();
  checar(f1.app === 55 && f1.cur === 2,
    'F · se o fader foi mexido no meio da passagem, o toque seguinte sobe só o app (50% → 55%) e o sistema fica onde estava', JSON.stringify(f1));

  // G · a tecla de baixo
  await zerar(0.5, 8);
  await tecla(-1);
  checar(await pct() === 45 && await sis() === 8,
    'G · com o app acima de zero a tecla de baixo mexe só nele (50% → 45%)', JSON.stringify({ app: await pct(), sis: await sis() }));
  await zerar(0, 8);
  await tecla(-1);
  checar(await pct() === 0 && await sis() === 7,
    'G · com o app no zero a tecla de baixo vai ao sistema (8 → 7), como sempre', JSON.stringify({ app: await pct(), sis: await sis() }));
  await zerar(1, 0);
  await tecla(1); await tecla(-1);                      // a de baixo encerra a passagem
  await tecla(1);
  const g1 = await estado();
  checar(g1.cur === 1 && g1.app === 95,
    'G · e a tecla de baixo encerra a passagem: depois dela a de cima sobe só o app (93% → 90% → 95%, sistema parado em 1/15)', JSON.stringify(g1));

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}
