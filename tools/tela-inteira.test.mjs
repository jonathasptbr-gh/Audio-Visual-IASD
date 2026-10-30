#!/usr/bin/env node
// ============================================================================
// A TELA INTEIRA DO VÍDEO SEM A API DE TELA CHEIA (v1.12.34, shell 80)
//
// Pedido do operador: *"não pode simplesmente fazer uma pseudo tela cheia? … qual o melhor
// resultado sem exigir a interação do usuário?"*. No APP o vídeo do Modo Fácil não usa mais
// `requestFullscreen` (que exige toque recente e é recusado quando o vídeo baixa antes de
// tocar): a `.preview` sobe ao top layer por `popover` e o shell gira e esconde as barras
// (`AVNative.telaInteira`). Este arquivo trava, cada uma falha CALADA:
//  A. Com a API de tela cheia RECUSANDO tudo (o caso do download demorado), o vídeo entra na
//     tela inteira mesmo assim: a prévia cobre a janela e o shell recebe `telaInteira(true)`.
//  B. A coluna do Modo Fácil (sair + play/pause) existe nela e acende ao toque; a barra de
//     volume também.
//  C. As saídas — o sair da coluna, o voltar do Android, o fim do vídeo — desfazem tudo e
//     devolvem `telaInteira(false)`; o botão do card reabre sem precisar de gesto.
//  D. Com tela conectada nada disso acontece, e uma tela que ENTRA fecha a tela inteira.
//  B3 (v1.12.41): o título e a linha do tempo do Modo Fácil acendem junto com a coluna.
//
//   node tools/tela-inteira.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperar, esperarCortina, porque, checar, falhas, RAIZ_WEB,
} from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;
const navegador = await abrirNavegador();
const erros = [];

// A PONTE: só o essencial, e `telaInteira` anotada em ordem. SEM CRASE NEM DOLAR-CHAVE AQUI.
const PONTE = `(function () {
  window.__telaInteira = [];
  window.__displays = [];
  const comCallId = new Set(['displays','listFolder','otaPending','otaDiag','espelhoEstado','espelhoDiag',
    'castTarget','saidaDeAudioAlvo','ytDiag','cifraDiag','farolEstado','pacoteEspaco','pacoteProntoEstado',
    'pacoteDiag','areaTransferencia','espelhoCertEstado','apkProcurar']);
  const vazio = { listFolder: [], otaPending: '', otaDiag: '',
    espelhoEstado: { ligado: false, telas: [], redes: [] }, espelhoDiag: {},
    castTarget: { label: '' }, ytDiag: '', cifraDiag: '',
    farolEstado: { conta: true, ultimo: 0, diag: 'de teste' } };
  const B = new Proxy({
    shellVersion: () => 80, role: () => 'controle', appVersion: () => '9.99-teste',
    takeShare: () => '', busPost: () => {}, otaConfirm: () => {}, bgProgress: () => {},
    telaInteira: (on) => { window.__telaInteira.push(!!on); },
  }, {
    get(alvo, n) {
      if (n in alvo) return alvo[n];
      if (typeof n !== 'string') return undefined;
      return (...args) => {
        if (!comCallId.has(n)) return undefined;
        const id = args[0];
        const v = n === 'displays' ? window.__displays : ((n in vazio) ? vazio[n] : null);
        setTimeout(() => window.__avResolve(id, v), 0);
        return undefined;
      };
    },
    has() { return true; },
  });
  window.__AVBridge = B;
})();`;

const plantar = (pg) => pg.evaluate(async () => {
  const v = await AVDB.addMedia(new Blob([new Uint8Array(64)], { type: 'video/mp4' }),
    { name: 'Provai e Vede', type: 'video/mp4', kind: 'video', list: 'imports' });
  return v.id;
});
const ler = (pg) => pg.evaluate(() => {
  const p = document.getElementById('preview');
  const r = p.getBoundingClientRect();
  const topo = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  const vis = (id) => getComputedStyle(document.getElementById(id)).display !== 'none';
  return {
    classe: p.classList.contains('pv-inteira'), aberto: p.matches(':popover-open'),
    fs: !!document.fullscreenElement, w: Math.round(r.width), h: Math.round(r.height),
    vw: innerWidth, vh: innerHeight, cobre: !!topo && p.contains(topo),
    acesa: document.getElementById('pvFsCtl').classList.contains('visivel'),
    exit: vis('fsExit'), play: vis('fsPlay'), prev: vis('fsPrev'), volume: vis('pvVolume'),
    shell: window.__telaInteira.slice(),
  };
});
const dentro = () => document.getElementById('preview').classList.contains('pv-inteira');
const fora = () => !document.getElementById('preview').classList.contains('pv-inteira');

try {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true });
  await semRedeExterna(ctx);
  await ctx.addInitScript(PONTE);
  // A API DE TELA CHEIA RECUSA TUDO: é o vídeo que chega depois dos ~5 s do toque.
  await ctx.addInitScript(() => {
    Element.prototype.requestFullscreen = function () {
      window.__pediuFs = (window.__pediuFs || 0) + 1;
      return Promise.reject(new TypeError('sem ativação'));
    };
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  const premissa = await pg.evaluate(() => ({ nativo: !!window.__NATIVE__, modo: appMode }));
  checar(premissa.nativo && premissa.modo === 'simple', 'premissa · app nativo, no Modo Fácil', JSON.stringify(premissa));
  await pg.evaluate(() => { setTocarNoCelular(true); });
  const id = await plantar(pg);

  // A
  await pg.evaluate((i) => send(i), id);
  const a0 = await esperar(pg, dentro, null, 5000);
  checar(a0 === true, 'A1 · sem a API de tela cheia, o vídeo do Modo Fácil entra na TELA INTEIRA', porque(a0));
  const a = await ler(pg);
  checar(a.aberto && !a.fs && a.w === a.vw && a.h === a.vh && a.cobre,
    'A2 · a prévia está no top layer, cobre a janela inteira e é ela que recebe o toque', JSON.stringify(a));
  checar(a.shell.length === 1 && a.shell[0] === true,
    'A3 · e o shell recebeu UM pedido para girar e esconder as barras', JSON.stringify(a.shell));
  const pediu = await pg.evaluate(() => window.__pediuFs || 0);
  checar(pediu === 0, 'A4 · no app a API de tela cheia nem é chamada para o vídeo', String(pediu));

  // B
  checar(a.exit && a.play && !a.prev && a.volume && a.acesa,
    'B1 · a coluna do Modo Fácil (sair + play/pause, sem ⏮) NASCE ACESA, e a barra de volume existe nela', JSON.stringify(a));
  await pg.evaluate(() => { document.getElementById('pvFsCtl').classList.remove('visivel'); });
  await pg.touchscreen.tap(195, 390);
  const b2 = await pg.evaluate(() => document.getElementById('pvFsCtl').classList.contains('visivel'));
  checar(b2 === true, 'B2 · um toque na tela acende a coluna', String(b2));
  // B3 (v1.12.41) · o TÍTULO e a LINHA DO TEMPO existem também na tela inteira do app e acendem com a
  // coluna. A mídia plantada não tem duração: a premissa a escreve, como o `display-status`.
  // A ESCRITA E A LEITURA NUM `evaluate` SÓ: entre dois, um evento do `<video>` da prévia (sem duração)
  // reescreve o `seekEl` e esconde a linha — no runner foi o que reprovou (run 2243, `display: none`).
  const b3 = await pg.evaluate(() => {
    seekEl.disabled = false; seekEl.max = '90'; seekEl.value = '0'; renderSimpleTime();
    const est = (id) => { const el = document.getElementById(id); const cs = getComputedStyle(el);
      return { vis: el.classList.contains('visivel'), display: cs.display, top: Math.round(el.getBoundingClientRect().top) }; };
    return { topo: est('pvFsTopo'), base: est('pvFsBase'), nome: document.getElementById('pvFsNome').textContent, vh: innerHeight };
  });
  checar(b3.topo.vis && b3.topo.display !== 'none' && b3.topo.top <= 1 && b3.nome === 'Provai e Vede'
    && b3.base.vis && b3.base.display === 'flex' && b3.base.top > b3.vh / 2,
    'B3 · e com ela acendem o NOME da mídia no topo e a LINHA DO TEMPO na base', JSON.stringify(b3));

  // C · o sair da coluna
  await pg.evaluate(() => { document.getElementById('fsExit').click(); });
  const c1 = await esperar(pg, fora, null, 3000);
  const c1b = await ler(pg);
  checar(c1 === true && !c1b.aberto && c1b.shell.at(-1) === false,
    'C1 · o SAIR da coluna desfaz a tela inteira e devolve o retrato ao shell', JSON.stringify(c1b));
  // o botão do card reabre, sem gesto (evaluate não é o que conta aqui: a API recusa tudo)
  const c2a = await pg.evaluate(() => !document.getElementById('simpleFsBtn').hidden);
  checar(c2a === true, 'C2 · fora dela, o botão do card do nome está à vista', String(c2a));
  await pg.evaluate(() => { document.getElementById('simpleFsBtn').click(); });
  const c2 = await esperar(pg, dentro, null, 3000);
  checar(c2 === true, 'C3 · e ele reabre a tela inteira mesmo com a API de tela cheia recusando', porque(c2));
  // o voltar do Android
  const c4 = await pg.evaluate(() => window.__avBack());
  const c4b = await esperar(pg, fora, null, 3000);
  checar(c4 === true && c4b === true, 'C4 · o VOLTAR do Android sai da tela inteira (e não minimiza)', porque(c4b));
  // o fim do vídeo
  await pg.evaluate(() => { document.getElementById('simpleFsBtn').click(); });
  await esperar(pg, dentro, null, 3000);
  await pg.evaluate(() => { autoAdvance(); });
  const c5 = await esperar(pg, fora, null, 3000);
  const c5b = await ler(pg);
  checar(c5 === true && c5b.shell.at(-1) === false, 'C5 · o FIM do vídeo sai da tela inteira', JSON.stringify(c5b.shell));

  // D · com tela conectada não entra, e uma tela que entra a fecha
  await pg.evaluate((i) => send(i), id);
  await esperar(pg, dentro, null, 3000);
  await pg.evaluate(() => { lastDisplays = [{ id: 2, name: 'TV', telao: true }]; renderSimpleGate(); });
  const d1 = await esperar(pg, fora, null, 3000);
  const d1b = await ler(pg);
  checar(d1 === true && d1b.shell.at(-1) === false,
    'D1 · uma tela que ENTRA com a tela inteira aberta a fecha (a tela conectada é o visor)', JSON.stringify(d1b.shell));
  const antes = await pg.evaluate(() => window.__telaInteira.length);
  await pg.evaluate((i) => send(i), id);
  await pg.waitForTimeout(400);   // AUSÊNCIA: nada deve abrir
  const d2 = await pg.evaluate((n) => ({ classe: document.getElementById('preview').classList.contains('pv-inteira'),
    novos: window.__telaInteira.length - n, midia: midiaNoAr }), antes);
  checar(d2.midia && !d2.classe && d2.novos === 0,
    'D2 · com tela conectada o vídeo NÃO abre a tela inteira, e o shell não é chamado', JSON.stringify(d2));
  await ctx.close();

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
