#!/usr/bin/env node
// ============================================================================
// A DICA DO "NÃO PERTURBE" E A SAÍDA DE MÍDIA NO REGISTRO (v1.13.16)
//
// Pedido do operador (a opção (a) da análise da v1.13.1): com o som saindo por este
// celular, uma notificação abaixa a música — o app SUGERE ligar o "Não Perturbe". O
// shell 83 devolve, no `saidaDeAudioAlvo`, o estado do Não Perturbe e por onde a mídia
// sai. O que este arquivo trava, e cada uma falha CALADA:
//  A. com o Não Perturbe DESLIGADO e o som saindo daqui, o play mostra a dica;
//  B. uma vez por uso do app: o play seguinte não a repete;
//  C. o VOLTAR (que resolve `false`) não vale "Não avisar mais" — reaberto o app, ela volta;
//  D. "Não avisar mais" (o OK) é lembrado: reaberto o app, ela não aparece;
//  E. com o Não Perturbe LIGADO, ou DESCONHECIDO, não há dica;
//  F. com o som NÃO saindo daqui (sem preview audível e sem telão), não há dica;
//  G. o Registro imprime por onde a mídia sai e o estado do Não Perturbe.
//
//   node tools/nao-perturbe.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, checar } from './arnes.mjs';

const ponte = (np) => `(() => {
  const B = {
    shellVersion: () => 83, role: () => 'controle', appVersion: () => '1.13.16-teste',
    takeShare: () => '', busPost: () => {}, otaConfirm: () => {},
    saidaDeAudioAlvo: (id) => { setTimeout(() => { try { window.__avResolve(id, {
      label: 'Seletor de saída (sistema) (MediaRouter2 (API pública))', candidatos: [], desfecho: 'nunca',
      saindoPor: [{ tipo: 8, nome: 'JBL Go' }], naoPerturbe: ${JSON.stringify(np)},
    }); } catch (_) {} }, 0); },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal','castTarget',
    'cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages','displays','espelhoEstado',
    'espelhoCertApagar','espelhoCertEstado','espelhoCertImportar','espelhoDerrubar',
    'espelhoDesligar','espelhoDiag','espelhoLigar','keepAlive','listFolder',
    'nowPlaying','openCast','abrirSaidaDeAudio','openExternal','otaApply','otaCheck','otaDiag',
    'otaPending','pickDoc','pickFolder','temaClaro','farolEstado',
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

async function abrir(ctx, np) {
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.addInitScript(ponte(np));
  await pg.goto(URL, { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  await pg.waitForFunction(() => window.__NATIVE__ === true && typeof setPlaying === 'function', null, { timeout: 30000 });
  return pg;
}
const dicaAberta = (pg) => pg.evaluate(() => appDialogEl.classList.contains('open')
  && /Não Perturbe/.test(appDialogTitleEl.textContent));
// O play com o som saindo DAQUI (a preview audível).
const tocarAqui = (pg) => pg.evaluate(() => { somLocal = true; setPlaying(true); });
// O fato que FECHA a janela de uma ausência: a resposta da ponte já chegou.
const respondeu = (pg) => esperar(pg, () => typeof audioNaoPerturbe === 'string' && audioNaoPerturbe !== 'desconhecido');

try {
  {
    const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
    await semRedeExterna(ctx);
    let pg = await abrir(ctx, 'desligado');
    await tocarAqui(pg);
    const r = await esperar(pg, () => appDialogEl.classList.contains('open'));
    checar(r === true && await dicaAberta(pg), 'A · Não Perturbe desligado e som saindo daqui: o play mostra a dica', String(r));

    // C · o voltar não vale "Não avisar mais"
    const voltou = await pg.evaluate(() => window.__avBack());
    checar(voltou === true && !(await pg.evaluate(() => appDialogEl.classList.contains('open'))),
      'C · o voltar do Android fecha a dica');
    await pg.evaluate(() => { setPlaying(false); setPlaying(true); });
    await pg.waitForTimeout(300); // AUSÊNCIA: a resposta da ponte chega em 0 ms
    checar(!(await dicaAberta(pg)), 'B · uma vez por uso: o play seguinte não repete a dica');
    checar(await pg.evaluate(() => { try { return localStorage.getItem('av.dicaNaoPerturbe'); } catch (_) { return 'erro'; } }) === null,
      'C · e o voltar não gravou "Não avisar mais"');

    // G · o Registro
    const cab = await pg.evaluate(() => cabecalhoDiag());
    checar(/Mídia saindo agora por: Bluetooth "JBL Go"/.test(cab) && /Não Perturbe: desligado/.test(cab),
      'G · o Registro diz por onde a mídia sai e o estado do Não Perturbe', cab.split('\n').filter((l) => /Mídia|Perturbe/.test(l)).join(' | '));
    await pg.close();

    // D · "Não avisar mais" (o OK) é lembrado
    pg = await abrir(ctx, 'desligado');
    await tocarAqui(pg);
    await esperar(pg, () => appDialogEl.classList.contains('open'));
    checar(await dicaAberta(pg), 'C · reaberto o app depois do voltar, a dica volta');
    await pg.evaluate(() => appDialogOkEl.click());
    checar(await pg.evaluate(() => localStorage.getItem('av.dicaNaoPerturbe')) === 'nunca',
      'D · "Não avisar mais" grava a escolha');
    await pg.close();
    pg = await abrir(ctx, 'desligado');
    await tocarAqui(pg);
    await pg.waitForTimeout(300); // AUSÊNCIA
    checar(!(await dicaAberta(pg)), 'D · reaberto o app, a dica não aparece mais');
    await ctx.close();
  }
  for (const np of ['ligado', 'desconhecido']) {
    const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
    await semRedeExterna(ctx);
    const pg = await abrir(ctx, np);
    await tocarAqui(pg);
    if (np === 'ligado') await respondeu(pg); else await pg.waitForTimeout(300);
    checar(!(await dicaAberta(pg)), 'E · com o Não Perturbe ' + np + ' não há dica');
    await ctx.close();
  }
  {
    const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
    await semRedeExterna(ctx);
    const pg = await abrir(ctx, 'desligado');
    await pg.evaluate(() => { somLocal = false; setPlaying(true); });
    await pg.waitForTimeout(300); // AUSÊNCIA
    checar(!(await dicaAberta(pg)) && await pg.evaluate(() => !dicaNaoPerturbeFeita),
      'F · com o som fora deste aparelho não há dica (nem a pergunta à ponte)');
    await ctx.close();
  }
  checar(erros.length === 0, 'sem erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}
