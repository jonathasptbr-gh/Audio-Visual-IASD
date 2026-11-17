#!/usr/bin/env node
// ============================================================================
// A ORDEM DA ABERTURA: VOLUME → OK → A JANELA DO TOUR → O TOUR
//
// O Pacote 45 juntou duas peças que nunca tinham conversado: o cartão do volume
// da abertura (que agora nasce na BASE, sobre um véu, e só sai pelo OK) e o tour
// automático (que nascia sozinho 1,2 s depois da tela livre). Sem uma ordem
// declarada, o tour abria POR CIMA do cartão — e o operador via o passeio do app
// antes de responder o que fazer com o som do aparelho.
//
// A REGRA QUE ESTE ARQUIVO TRAVA, medida no Chromium com um sistema falso de dez
// degraus e o aparelho NOVO (`comTour: true`, `av.tour` vazio):
//
//   A. com o volume em 20% o cartão abre, e o tour NÃO abre nem pergunta —
//      nem 2,5 s depois (o `LIVRE_MS` já teria vencido);
//   B. o véu é o que segura: no centro da peça que o tour usaria
//      (`#simpleConn`), o `elementFromPoint` devolve o VÉU, não a peça;
//   C. o OK fecha o cartão e o véu, e aí — e só aí — a JANELA DO TOUR aparece
//      ("Quer fazer o tour?" com "Fazer o tour" e "Agora não");
//   D. "Fazer o tour" abre o tour do estado, e ele é o da CONEXÃO;
//   E. "Agora não" grava a MESMA marca `av.tour` (a chave do estado), não abre
//      nada, e uma SEGUNDA abertura com o volume ainda baixo não pergunta de
//      novo — mas o cartão do volume volta, porque a marca dele não existe;
//   F. o voltar do Android fecha o cartão (ele está na fila `POPUPS`).
//
// As três reversões provadas no lote (o tour que não espera, o timer que volta e
// o "Agora não" que não marca) estão nomeadas no `docs/HISTORICO.md`.
//
//   node tools/ordem-da-abertura.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, checar, falhas } from './arnes.mjs';

// O SISTEMA FALSO: dez degraus, e o app encontra 2 (20%) na abertura — abaixo
// do piso de 60%, que é a condição do cartão. A ponte responde o Não perturbe
// com autorização, para o cartão nascer completo.
const PONTE = `(() => {
  window.__sis = { cur: 2, max: 10 };
  window.__chamadas = { definir: [], dnd: [], acesso: 0 };
  const B = {
    shellVersion: () => 89,
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: (id) => { setTimeout(() => { try { window.__avResolve(id, ''); } catch (_) {} }, 0); },
    busPost: () => {}, otaConfirm: () => {},
    systemVolumeAtual: (id) => setTimeout(() => {
      try { window.__avResolve(id, { atual: window.__sis.cur, max: window.__sis.max }); } catch (_) {}
    }, 0),
    systemVolumeDefinir: (f) => {
      window.__chamadas.definir.push(f);
      window.__sis.cur = Math.round(window.__sis.max * f);
    },
    naoPerturbe: (id) => setTimeout(() => {
      try { window.__avResolve(id, { acesso: true, ligado: false, filtro: 0 }); } catch (_) {}
    }, 0),
    naoPerturbeDefinir: (on, id) => {
      window.__chamadas.dnd.push(!!on);
      setTimeout(() => { try { window.__avResolve(id, { ok: true }); } catch (_) {} }, 0);
    },
    abrirAcessoNaoPerturbe: () => { window.__chamadas.acesso++; },
  };
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

const servidor = servirEstatico(new URL('../app/src/main/assets/web', import.meta.url).pathname);
await new Promise((r) => servidor.listen(0, r));
const navegador = await abrirNavegador({ comTour: true });
const erros = [];

async function abrir() {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.addInitScript(PONTE);
  await pg.goto('http://localhost:' + servidor.address().port + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  await pg.waitForFunction(() => window.__NATIVE__ === true && window.AVTour && typeof window.__avBack === 'function',
    null, { timeout: 30000 });
  return { ctx, pg };
}
const estado = (pg) => pg.evaluate(() => (window.AVTour ? AVTour.estado() : null));
const cartaoNaTela = (pg) => pg.evaluate(() => !document.getElementById('volAvisoPop').hidden);
const dialogo = (pg) => pg.evaluate(() => {
  const d = document.getElementById('appDialog');
  return {
    aberto: d.classList.contains('open'),
    titulo: document.getElementById('appDialogTitle').textContent.trim(),
    ok: document.getElementById('appDialogOk').textContent.trim(),
    cancelar: document.getElementById('appDialogCancel').hidden ? null : document.getElementById('appDialogCancel').textContent.trim(),
  };
});
const marcas = (pg) => pg.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('av.tour') || '{}'); } catch (_) { return null; }
});

try {
  // ── A/B/C/D · A SEQUÊNCIA COMPLETA: CARTÃO → OK → JANELA → TOUR ───────────
  {
    const { ctx, pg } = await abrir();
    await pg.waitForSelector('#volAvisoPop:not([hidden])', { timeout: 10000 });
    checar(await estado(pg) === null, 'A · com o cartão do volume na tela, o tour não abriu', JSON.stringify(await estado(pg)));

    // 2,5 s é mais que o `LIVRE_MS` (1,2 s) do tour: sem o bloqueio, ele já
    // teria aberto ou perguntado.
    await pg.waitForTimeout(2500);
    const depois = await estado(pg);
    const d1 = await dialogo(pg);
    checar(depois === null && !d1.aberto && await cartaoNaTela(pg),
      'A · e nem 2,5 s depois ele abre ou pergunta: o guia ESPERA o cartão', JSON.stringify({ tour: depois, dialogo: d1.aberto }));

    // B · O VÉU É O QUE SEGURA: no centro da peça que o tour usaria, quem
    // recebe o dedo é o véu — a peça do tour não é tocável enquanto ele está
    // de pé. É a mesma pergunta que o `elementFromPoint` faz.
    const hit = await pg.evaluate(() => {
      const alvo = document.getElementById('simpleConn');
      const r = alvo.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { alvo: el ? (el.id || el.className || el.tagName) : null, dentro: !!el && alvo.contains(el), peca: [r.left, r.top, r.width, r.height] };
    });
    checar(hit.alvo === 'volAvisoVeu' && !hit.dentro,
      'B · o véu recebe o toque no lugar da peça do tour (`elementFromPoint` no `#simpleConn`)', hit);

    // C · O OK FECHA O CARTÃO, E SÓ ENTÃO A JANELA DO TOUR APARECE.
    await pg.click('#volAvisoPopFechar');
    await pg.waitForFunction(() => document.getElementById('volAvisoPop').hidden && document.getElementById('volAvisoVeu').hidden,
      null, { timeout: 3000 });
    await esperar(pg, () => document.getElementById('appDialog').classList.contains('open'), null, 6000);
    const d2 = await dialogo(pg);
    checar(d2.aberto && d2.titulo === 'Quer fazer o tour?' && d2.ok === 'Fazer o tour' && d2.cancelar === 'Agora não',
      'C · fechado o cartão, a janela do tour aparece com "Fazer o tour" e "Agora não"', d2);
    checar(await estado(pg) === null, 'C · e o tour AINDA não abriu: a janela vem antes dele');

    // D · "FAZER O TOUR" ABRE O TOUR DO ESTADO (a cortina sem tela = `conexao`).
    await pg.click('#appDialogOk');
    await esperar(pg, () => {
      const e = window.AVTour && AVTour.estado();
      return !!e && e.qual === 'conexao' && !document.getElementById('tour').hidden;
    }, null, 6000);
    const e = await estado(pg);
    checar(!!e && e.qual === 'conexao' && e.passo === 0,
      'D · respondida a janela, o tour da CONEXÃO abre no primeiro passo', JSON.stringify(e));
    await pg.evaluate(() => AVTour.fechar());
    await ctx.close();
  }

  // ── E · "AGORA NÃO" GRAVA A MARCA E NÃO PERGUNTA DE NOVO ─────────────────
  {
    const { ctx, pg } = await abrir();
    await pg.waitForSelector('#volAvisoPop:not([hidden])', { timeout: 10000 });
    await pg.click('#volAvisoPopFechar');
    await esperar(pg, () => document.getElementById('appDialog').classList.contains('open'), null, 6000);
    await pg.click('#appDialogCancel');
    await pg.waitForTimeout(600);
    const v = await marcas(pg);
    checar(!!v && v.conexao === 1, 'E · "Agora não" grava a marca `av.tour` do estado (`conexao`)', v);
    checar(await estado(pg) === null && !(await dialogo(pg)).aberto,
      'E · e não abre o tour nem deixa a janela aberta');
    await pg.waitForTimeout(1600);
    checar(await estado(pg) === null && !(await dialogo(pg)).aberto,
      'E · passado o tempo do automático, ele não insiste');
    checar(await cartaoNaTela(pg) === false,
      'E · o cartão do volume ficou fechado (o OK dele já foi dado)');

    // A SEGUNDA ABERTURA, mesmo aparelho e volume ainda baixo: o cartão do
    // volume VOLTA (não há marca dele), e a janela do tour NÃO.
    await pg.reload({ waitUntil: 'domcontentloaded' });
    await esperarCortina(pg);
    await pg.waitForFunction(() => window.__NATIVE__ === true && window.AVTour, null, { timeout: 30000 });
    await pg.waitForSelector('#volAvisoPop:not([hidden])', { timeout: 10000 });
    checar(true, 'E · na segunda abertura com o volume baixo o cartão do volume volta');
    await pg.click('#volAvisoPopFechar');
    await pg.waitForTimeout(2500);
    const v2 = await marcas(pg);
    checar(await estado(pg) === null && !(await dialogo(pg)).aberto && v2.conexao === 1,
      'E · e a janela do tour NÃO volta: a marca do estado vale para esta tela', JSON.stringify({ tour: await estado(pg), marcas: v2 }));
    await ctx.close();
  }

  // ── F · O CARTÃO ESTÁ NA FILA `POPUPS`: O VOLTAR TAMBÉM O FECHA ───────────
  {
    const { ctx, pg } = await abrir();
    await pg.waitForSelector('#volAvisoPop:not([hidden])', { timeout: 10000 });
    const voltar = await pg.evaluate(() => window.__avBack());
    const fechou = await pg.evaluate(() => document.getElementById('volAvisoPop').hidden && document.getElementById('volAvisoVeu').hidden);
    checar(voltar === true && fechou,
      'F · o voltar do Android fecha o cartão (e o véu) — ele entra na fila `POPUPS` como os outros popups', { voltar, fechou });
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
