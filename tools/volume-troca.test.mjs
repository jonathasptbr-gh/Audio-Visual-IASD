#!/usr/bin/env node
// ============================================================================
// A PASSAGEM DO VOLUME NAS TECLAS FÍSICAS: NO TETO DO APP, O SISTEMA SOBE UM DEGRAU E O APP CEDE (v1.12.17)
//
// Pedido do operador: *"ao chegar em 100% no app, ele começa a aumentar o volume do sistema … se
// ambos estão em 0, ele vai para 100% do app e começa a aumentar o do sistema. O ideal é o volume do
// sistema estar na média e o do app ser o único modificado"* e, depois: *"o volume do sistema só deve
// ser alterado quando batemos os limites … limitado apenas ao momento em que ele acabou de bater nos
// 100%"*. Com o shell 78 o app LÊ o volume do sistema (`systemVolumeStep` → antes/depois/max), então a
// regra deixou de contar degraus e de estimar janela de tempo. O que este arquivo trava, e cada uma
// falha CALADA:
//  A. antes dos 100% a tecla só mexe no app, e o sistema não é tocado;
//  B. nos 100%, com o sistema abaixo do alvo (60%), a tecla sobe um degrau do sistema E o app cede
//     (a conta é do volume REAL: o som sobe meio degrau, não pula);
//  C. as teclas seguintes mexem só no app — o par acontece só no instante do teto;
//  D. do alvo em diante o sistema sobe sozinho, sem o app ceder (a válvula de sempre);
//  E. um degrau RECUSADO (sistema no máximo, volume fixo) não faz o app ceder — era o defeito da
//     contagem às cegas: o app caía sem o sistema subir;
//  F. no zero do app a tecla de baixo continua indo ao sistema, e com o app acima de zero só mexe nele;
//  G. a subida inteira (sistema e app em 0 → tudo acima) tem o som monotônico e sem salto, e o sistema
//     para na faixa do alvo enquanto o app é o único modificado.
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

  // A · antes dos 100% só o app
  await zerar(0.9, 3);
  await tecla(1);
  checar(await pct() === 95 && (await calls()).length === 0,
    'A · com o app em 90% a tecla de cima sobe o APP (95%) e não toca no sistema', JSON.stringify({ app: await pct(), sys: await calls() }));

  // B · no teto, sistema abaixo do alvo: o sistema sobe um degrau e o app cede o bastante
  await zerar(1, 3);                                   // sistema 3/15 = 20%
  await tecla(1);
  const b = { app: await pct(), sis: await sis(), calls: await calls() };
  checar(b.sis === 4 && b.calls.length === 1 && (b.app === 87 || b.app === 88),
    'B · app em 100% e sistema em 3/15: a tecla sobe o sistema (4/15) e o app cede para ~88% (o som sobe meio degrau)', JSON.stringify(b));
  const luzAntes = (3 / 15) * 1, luzDepois = (4 / 15) * (b.app / 100);
  checar(luzDepois > luzAntes && luzDepois - luzAntes < 0.05,
    'B · e o SOM sobe, devagar: nem cai nem pula (cerca de meio degrau do sistema)', JSON.stringify({ luzAntes, luzDepois }));

  // C · as teclas seguintes mexem só no app
  await tecla(1);
  checar(await pct() === 90 && (await calls()).length === 1 && await sis() === 4,
    'C · a tecla seguinte sobe só o APP (88% → 90%) — o par foi só no instante do teto', JSON.stringify({ app: await pct(), sis: await sis(), calls: await calls() }));

  // D · do alvo em diante o sistema sobe sozinho
  await zerar(1, 9);                                   // 9/15 = 60% = o alvo
  await tecla(1);
  checar(await sis() === 10 && await pct() === 100,
    'D · com o sistema já no alvo (60%) a tecla no teto sobe só o sistema e o app fica em 100%', JSON.stringify({ app: await pct(), sis: await sis() }));

  // E · degrau recusado
  await zerar(1, 3, true);                             // volume fixo: o degrau não acontece
  await tecla(1);
  checar(await pct() === 100 && await sis() === 3,
    'E · se o sistema RECUSA o degrau, o app não cede (fica em 100%)', JSON.stringify({ app: await pct(), sis: await sis() }));
  await zerar(1, 15);                                  // sistema no máximo
  await tecla(1);
  checar(await pct() === 100 && await sis() === 15,
    'E · e com o sistema já no máximo o app também fica em 100%', JSON.stringify({ app: await pct(), sis: await sis() }));

  // F · a válvula do zero
  await zerar(0, 8);
  await tecla(-1);
  checar(await pct() === 0 && await sis() === 7,
    'F · com o app no zero a tecla de baixo vai ao sistema (8 → 7)', JSON.stringify({ app: await pct(), sis: await sis() }));
  await zerar(0.5, 8);
  await tecla(-1);
  checar(await pct() === 45 && await sis() === 8,
    'F · com o app acima de zero a tecla de baixo mexe só nele (50% → 45%)', JSON.stringify({ app: await pct(), sis: await sis() }));

  // G · a subida inteira, do zero ao máximo
  await zerar(0, 0);
  const trilha = [];
  for (let i = 0; i < 80; i++) {
    await tecla(1);
    trilha.push(await pg.evaluate(() => ({ app: volume, cur: window.__sis.cur, max: window.__sis.max })));
  }
  let saltoMax = 0; let desceu = false; let prev = 0;
  for (const t of trilha) {
    const luz = (t.cur / t.max) * t.app;
    if (luz < prev - 1e-9) desceu = true;
    saltoMax = Math.max(saltoMax, luz - prev);
    prev = luz;
  }
  const fim = trilha[trilha.length - 1];
  // o primeiro degrau do sistema (0 → 1) parte do silêncio: o único salto legítimo maior
  checar(!desceu, 'G · subindo tudo o som NUNCA cai no meio do caminho', JSON.stringify(trilha.slice(0, 12)));
  checar(saltoMax < 0.12, 'G · e nenhum toque pula o som (maior salto < 12% do máximo)', String(saltoMax));
  checar(fim.cur === 15 && fim.app === 1, 'G · insistindo, chega ao máximo dos dois (a válvula além do alvo)', JSON.stringify(fim));
  const noAlvo = trilha.find((t) => t.cur >= 9);
  checar(noAlvo && noAlvo.app >= 0.5,
    'G · e ao chegar na faixa do alvo o app está de volta a um volume alto — ele é quem fica sendo mexido', JSON.stringify(noAlvo));

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}
