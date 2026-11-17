#!/usr/bin/env node
// ============================================================================
// A ORDEM DA ABERTURA: CORTINA → JANELA DO TOUR → TOUR
//
// O Pacote 47 (v1.14.71) apagou o cartão de volume da abertura. Com ele saiu a
// pergunta que segurava o tour por cima do cartão — e a ordem ficou a que o
// operador pediu: a cortina sai, a janela do app pergunta "Quer fazer o tour?",
// e só depois de a resposta existir o tour abre. O que este arquivo trava é
// justamente a AUSÊNCIA dessa peça: **a abertura não mostra mais nada de volume**,
// com qualquer volume do sistema, e o tour não abre nem pergunta antes de a
// cortina sair.
//
// A REGRA, medida no Chromium com um sistema falso de dez degraus e o aparelho
// NOVO (`comTour: true`, `av.tour` vazio):
//
//   A. com a cortina (`#splash`) na tela a janela do tour ainda NÃO abriu;
//   B. a cortina sai e SÓ ENTÃO a janela "Quer fazer o tour?" aparece, com
//      "Fazer o tour" e "Agora não", e o tour segue fechado;
//   C. a janela segura o automático: nem 2,5 s depois (o `LIVRE_MS` é 1,2 s) o
//      tour abre, e o `elementFromPoint` no centro do `#simpleConn` devolve o
//      diálogo, não a peça que o tour usaria;
//   D. "Fazer o tour" abre o tour do estado (a conexão), no primeiro passo;
//   E. "Agora não" grava a MESMA marca `av.tour` do estado, não abre nada, não
//      insiste, e uma SEGUNDA abertura não pergunta de novo;
//   F. nenhum cartão de volume no DOM em nenhuma abertura, com o volume do
//      sistema em 0% E em 100%, e nenhuma escrita no volume (as chaves da seção
//      "Inicialização" nascem desligadas).
//
// As reversões provadas no lote estão nomeadas no `docs/HISTORICO.md`: tirar a
// janela do caminho do automático reprova B e C, e tirar a marca do "Agora não"
// reprova E.
//
//   node tools/ordem-da-abertura.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, checar, falhas } from './arnes.mjs';

// O SISTEMA FALSO: dez degraus, e a abertura encontra o volume que `cur` disser.
// O `naoPerturbe` responde com autorização para a abertura não ter o que
// oferecer; as chaves da seção nascem ausentes, então nenhuma das duas é aplicada.
const PONTE = (cur) => `(() => {
  window.__sis = { cur: ${cur}, max: 10 };
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
const BASE = 'http://localhost:' + servidor.address().port + '/controle/';
const erros = [];

async function abrir(cur) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await semRedeExterna(ctx);
  await ctx.addInitScript(PONTE(cur));
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
  return { ctx, pg };
}
const estado = (pg) => pg.evaluate(() => (window.AVTour ? AVTour.estado() : null));
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
const cartaoNoDom = (pg) => pg.evaluate(() => ({
  pop: !!document.getElementById('volAvisoPop'),
  veu: !!document.getElementById('volAvisoVeu'),
  classe: document.querySelectorAll('.vol-aviso, .vol-veu').length,
}));

try {
  // ── A/B/C/D · A ORDEM COMPLETA: CORTINA → JANELA → TOUR ──────────────────
  {
    const { ctx, pg } = await abrir(0);   // 0%: era a condição do cartão antigo
    // A · a cortina está na tela e a janela ainda não abriu.
    const naCortina = await pg.evaluate(() => ({
      splash: !!document.getElementById('splash'),
      dialogo: document.getElementById('appDialog').classList.contains('open'),
    }));
    checar(naCortina.splash && !naCortina.dialogo,
      'A · com a CORTINA na tela, a janela do tour ainda não abriu', JSON.stringify(naCortina));

    // B · a cortina sai e SÓ ENTÃO a janela aparece.
    await esperarCortina(pg);
    await pg.waitForFunction(() => window.AVTour && typeof window.__avBack === 'function', null, { timeout: 30000 });
    const chegou = await esperar(pg, () => document.getElementById('appDialog').classList.contains('open'), null, 8000);
    const d1 = await dialogo(pg);
    checar(chegou === true && d1.aberto && d1.titulo === 'Quer fazer o tour?'
      && d1.ok === 'Fazer o tour' && d1.cancelar === 'Agora não',
      'B · saída a cortina, a janela do tour aparece com "Fazer o tour" e "Agora não"', JSON.stringify({ chegou, d1 }));
    checar(await estado(pg) === null, 'B · e o tour AINDA não abriu: a janela vem antes dele');

    // C · a janela SEGURA o automático, e é ela que recebe o toque.
    await pg.waitForTimeout(2500);   // mais que o `LIVRE_MS` (1,2 s)
    const hit = await pg.evaluate(() => {
      const alvo = document.getElementById('simpleConn');
      const r = alvo.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        alvo: el ? (el.id || el.className || el.tagName) : null,
        noDialogo: !!el && !!el.closest('#appDialog'),
        dentro: !!el && alvo.contains(el),
      };
    });
    checar(await estado(pg) === null && (await dialogo(pg)).aberto,
      'C · a janela segura o automático: nem 2,5 s depois o tour abre');
    checar(hit.noDialogo && !hit.dentro,
      'C · e o toque no centro do `#simpleConn` cai no DIÁLOGO, não na peça que o tour usaria', hit);

    // D · "Fazer o tour" abre o tour do estado.
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
    const { ctx, pg } = await abrir(0);
    await esperarCortina(pg);
    await pg.waitForFunction(() => window.AVTour && typeof window.__avBack === 'function', null, { timeout: 30000 });
    await esperar(pg, () => document.getElementById('appDialog').classList.contains('open'), null, 8000);
    await pg.click('#appDialogCancel');
    await pg.waitForTimeout(600);
    const v = await marcas(pg);
    checar(!!v && v.conexao === 1, 'E · "Agora não" grava a marca `av.tour` do estado (`conexao`)', v);
    checar(await estado(pg) === null && !(await dialogo(pg)).aberto,
      'E · e não abre o tour nem deixa a janela aberta');
    await pg.waitForTimeout(1600);
    checar(await estado(pg) === null && !(await dialogo(pg)).aberto,
      'E · passado o tempo do automático, ele não insiste');

    // A SEGUNDA ABERTURA, mesmo aparelho: a janela NÃO volta.
    await pg.reload({ waitUntil: 'domcontentloaded' });
    await esperarCortina(pg);
    await pg.waitForFunction(() => window.AVTour, null, { timeout: 30000 });
    await pg.waitForTimeout(2500);
    const v2 = await marcas(pg);
    checar(await estado(pg) === null && !(await dialogo(pg)).aberto && v2.conexao === 1,
      'E · e a janela do tour NÃO volta: a marca do estado vale para esta tela',
      JSON.stringify({ tour: await estado(pg), marcas: v2 }));
    await ctx.close();
  }

  // ── F · NENHUM CARTÃO DE VOLUME, EM VOLUME NENHUM, E NENHUMA ESCRITA ─────
  for (const cur of [0, 10]) {
    const { ctx, pg } = await abrir(cur);
    await esperarCortina(pg);
    await pg.waitForFunction(() => window.AVTour && typeof window.__avBack === 'function', null, { timeout: 30000 });
    await pg.waitForTimeout(1500);
    const c = await cartaoNoDom(pg);
    const ch = await pg.evaluate(() => JSON.parse(JSON.stringify(window.__chamadas)));
    checar(c.pop === false && c.veu === false && c.classe === 0,
      'F · com o sistema em ' + (cur * 10) + '% não existe cartão de volume nem véu no DOM', c);
    checar(ch.definir.length === 0 && ch.dnd.length === 0 && ch.acesso === 0,
      'F · e a abertura não escreve no volume nem no Não perturbe (chaves desligadas)', JSON.stringify(ch));
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
