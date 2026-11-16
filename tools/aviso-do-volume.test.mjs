#!/usr/bin/env node
// ============================================================================
// O AVISO DA ABERTURA: O PISO DE 60% CONTA O QUE FEZ E OFERECE AS DUAS SAÍDAS
//
// Pedido do operador: *"um popup rápido notificando que o aplicativo aumentou o
// volume do aparelho até 60% quando aberto e de um botão nesse popup para mutar
// ou colocar o aparelho no modo não perturbe (sem toque, mas com som)"*.
//
// O piso da v1.13.65 subia o volume de mídia do sistema em silêncio. Este aviso
// é a metade que faltava do controle, e ele falha CALADO de quatro jeitos:
//
//  A. o cartão NÃO aparece quando o piso agiu — o operador continua sem saber
//     que o app mexeu no som do telefone (e o `systemVolumeDefinir` pode ter
//     sido chamado sem ninguém ver, que é o defeito original);
//  B. o cartão aparece quando o piso NÃO agiu — um aviso a cada abertura, e o
//     número 60% mentiria sobre um volume que já estava lá;
//  C. o botão MUDAR não muta o app (o comando é o MESMO `#muteToggle`: uma
//     segunda verdade sobre o mudo nasceria aqui);
//  D. o botão NÃO PERTURBE liga sem a autorização de "Acesso a Não perturbe":
//     o `setInterruptionFilter` é um no-op SILENCIOSO, e o botão prometeria o
//     que o Android ignorou. É o desfecho que mais parece um sucesso.
//
// O QUE ESTE ARQUIVO NÃO PROVA: o Android de verdade. O `setStreamVolume` com
// flags 0, a tela de acesso especial e o filtro `ALARMS` só se conferem no
// aparelho — aqui a ponte é de mentira, e o que se mede é a CONVERSA.
//
//   node tools/aviso-do-volume.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, checar, falhas } from './arnes.mjs';

// O SISTEMA FALSO: dez degraus, e o `cur` é o que o app encontra na abertura.
// `acesso` é a autorização de Não perturbe; `semPonte` simula um casco 88, em
// que os métodos novos não existem e o `native.js` degrada na hora.
const PONTE = (opts) => `(() => {
  const o = ${JSON.stringify(opts)};
  window.__sis = { cur: o.cur, max: 10 };
  window.__acesso = o.acesso !== false;
  window.__dndLigado = o.dnd === true;
  window.__chamadas = { definir: [], dnd: [], acesso: 0 };
  const B = {
    shellVersion: () => ${opts.semPonte ? 88 : 89},
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: (id) => { setTimeout(() => { try { window.__avResolve(id, ''); } catch (_) {} }, 0); },
    busPost: () => {}, otaConfirm: () => {},
  };
  if (o.semPonte) {
    B.systemVolumeAtual = (id) => setTimeout(() => { try { window.__avResolve(id, null); } catch (_) {} }, 0);
  } else {
    B.systemVolumeAtual = (id) => setTimeout(() => {
      try { window.__avResolve(id, { atual: window.__sis.cur, max: window.__sis.max }); } catch (_) {}
    }, 0);
    B.systemVolumeDefinir = (f) => {
      window.__chamadas.definir.push(f);
      window.__sis.cur = Math.round(window.__sis.max * f);
    };
    B.naoPerturbe = (id) => setTimeout(() => {
      try { window.__avResolve(id, { acesso: window.__acesso, ligado: window.__dndLigado, filtro: 0 }); } catch (_) {}
    }, 0);
    B.naoPerturbeDefinir = (on, id) => {
      window.__chamadas.dnd.push(!!on);
      window.__dndLigado = !!on;
      setTimeout(() => { try { window.__avResolve(id, { ok: true }); } catch (_) {} }, 0);
    };
    B.abrirAcessoNaoPerturbe = () => { window.__chamadas.acesso++; };
  }
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal','castTarget','saidaDeAudioAlvo',
    'cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages','displays',
    'espelhoCertApagar','espelhoCertEstado','espelhoCertImportar','espelhoDerrubar',
    'espelhoDesligar','espelhoDiag','espelhoLigar','keepAlive','listFolder',
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

// Uma abertura = um contexto NOVO: o `acertarPisoDoVolumeDoSistema` roda UMA
// vez por carga, e reaproveitar a página mediria a abertura anterior.
async function abrir(opts) {
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.addInitScript(PONTE(opts));
  await pg.goto('http://localhost:' + servidor.address().port + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function',
    null, { timeout: 30000 },
  );
  return { ctx, pg };
}
const cartao = (pg) => pg.evaluate(() => {
  const el = document.getElementById('volAvisoPop');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    hidden: el.hidden,
    texto: el.textContent.replace(/\s+/g, ' ').trim(),
    topo: +r.top.toFixed(1),
    esq: +r.left.toFixed(1),
    dir: +r.right.toFixed(1),
    dnd: document.getElementById('volAvisoPopDnd').hidden,
  };
});
const chamadas = (pg) => pg.evaluate(() => JSON.parse(JSON.stringify(window.__chamadas)));

try {
  // ── A · O PISO AGIU: O CARTÃO CONTA, E CONTA O NÚMERO REAL ───────────────
  {
    const { ctx, pg } = await abrir({ cur: 2 });   // 20% do sistema, abaixo do piso
    await pg.waitForSelector('#volAvisoPop:not([hidden])', { timeout: 10000 });
    const c = await cartao(pg);
    const ch = await chamadas(pg);
    checar(ch.definir.length === 1 && Math.abs(ch.definir[0] - 0.6) < 1e-9,
      'A · com o sistema abaixo do piso, o app define 60% (o piso de sempre)', JSON.stringify(ch.definir));
    checar(!c.hidden && /60\s*%/.test(c.texto),
      'A · e o cartão aparece dizendo 60% — o número que o aparelho passou a ter', c);
    checar(c.topo >= 0 && c.topo < 200,
      'A · no TOPO da tela: ali não cobre o transporte, e a lista da base não o recorta', c);
    await ctx.close();
  }

  // ── B · O MUDO É O DO APP, PELO MESMO COMANDO ─────────────────────────────
  {
    const { ctx, pg } = await abrir({ cur: 2 });
    await pg.waitForSelector('#volAvisoPop:not([hidden])', { timeout: 10000 });
    await pg.click('#volAvisoPopMutar');
    await pg.waitForFunction(() => document.getElementById('muteToggle').classList.contains('muted'),
      null, { timeout: 5000 });
    checar(true, 'B · o botão Mutar muta o APP (`.muted` no `#muteToggle`, o mesmo comando de sempre)');
    await ctx.close();
  }

  // ── C · O NÃO PERTURBE, COM A AUTORIZAÇÃO DADA ────────────────────────────
  {
    const { ctx, pg } = await abrir({ cur: 2 });
    await pg.waitForSelector('#volAvisoPop:not([hidden])', { timeout: 10000 });
    await pg.waitForFunction(() => !document.getElementById('volAvisoPopDnd').hidden, null, { timeout: 5000 });
    await pg.click('#volAvisoPopDnd');
    await pg.waitForFunction(() => window.__chamadas.dnd.length === 1, null, { timeout: 5000 });
    const ch = await chamadas(pg);
    checar(ch.dnd.length === 1 && ch.dnd[0] === true,
      'C · com "Acesso a Não perturbe" autorizado, o botão liga o filtro (`naoPerturbeDefinir(true)`)', ch);
    checar(ch.acesso === 0,
      'C · e NÃO abre a tela de acesso — ela só existe para quem ainda não autorizou', ch);
    await ctx.close();
  }

  // ── D · SEM A AUTORIZAÇÃO: ABRE A TELA, NÃO FINGE QUE LIGOU ───────────────
  {
    const { ctx, pg } = await abrir({ cur: 2, acesso: false });
    await pg.waitForSelector('#volAvisoPop:not([hidden])', { timeout: 10000 });
    await pg.waitForFunction(() => !document.getElementById('volAvisoPopDnd').hidden, null, { timeout: 5000 });
    await pg.click('#volAvisoPopDnd');
    await pg.waitForFunction(() => window.__chamadas.acesso === 1, null, { timeout: 5000 });
    const ch = await chamadas(pg);
    checar(ch.acesso === 1 && ch.dnd.length === 0,
      'D · sem a autorização, o toque abre a tela de acesso e NÃO chama o definir (o no-op silencioso é o defeito que se evita)', ch);
    const c = await cartao(pg);
    checar(!c.hidden && /Autorize/i.test(c.texto),
      'D · o cartão não some: ele diz o que fazer para o botão passar a valer', c);
    await ctx.close();
  }

  // ── E · O PISO NÃO AGIU: NENHUM AVISO (E NENHUMA ESCRITA) ────────────────
  {
    const { ctx, pg } = await abrir({ cur: 6 });   // 60%: já está no piso
    await pg.waitForTimeout(1200);
    const c = await cartao(pg);
    const ch = await chamadas(pg);
    checar(ch.definir.length === 0,
      'E · com o sistema já em 60%, o app NÃO mexe no volume', ch.definir);
    checar(c.hidden,
      'E · e o cartão não aparece — um aviso a cada abertura mentiria sobre um volume que já estava lá', c);
    await ctx.close();
  }

  // ── F · CASCO ANTIGO (88): DEGRADA, NÃO TRAVA ─────────────────────────────
  {
    const { ctx, pg } = await abrir({ cur: 2, semPonte: true });
    await pg.waitForTimeout(1200);
    const c = await cartao(pg);
    checar(c === null || c.hidden,
      'F · num casco 88 o aviso não nasce: os métodos novos não existem e o `native.js` resolve `null` na hora', c);
    await ctx.close();
  }

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) { console.log('\n' + falhas.length + ' FALHA(S)'); process.exit(1); }
console.log('\nTodos passaram.');
process.exit(0);
