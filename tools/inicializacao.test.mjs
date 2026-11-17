#!/usr/bin/env node
// ============================================================================
// A SEÇÃO "INICIALIZAÇÃO": AS TRÊS DECISÕES DA ABERTURA PERSISTEM E APLICAM
//
// É o oráculo que substituiu o `aviso-do-volume` (v1.14.71, Pacote 47). O cartão
// que PERGUNTAVA o que fazer com o volume na abertura SAIU; quem decide agora é a
// seção nova de Configurações, e o app cumpre a decisão sem perguntar nada:
//
//   · MODO na abertura — a MESMA chave do gesto de 5 s (`av.appModeFixo`), que o
//     script do `<head>` lê e publica em `data-modo-inicial`;
//   · NÃO PERTURBE na abertura — chave nova, DESLIGADA por padrão; ligada, a
//     abertura chama `naoPerturbeDefinir(true)`. SEM a autorização do Android não
//     define e oferece o caminho do sistema — e não repete o pedido;
//   · VOLUME na abertura — chave mestra DESLIGADA por padrão; ligada, a abertura
//     chama `systemVolumeDefinir(<barra>/100)` UMA vez. Desligada, a barra fica
//     inerte e apagada mas GUARDA o número.
//
// O modo de falhar é o pior deste app: um `setStreamVolume` a mais na abertura não
// aparece em erro nenhum (o app "só está sendo prestativo"), um
// `setInterruptionFilter` sem `ACCESS_NOTIFICATION_POLICY` é um no-op SILENCIOSO, e
// uma barra desligada que zera o valor apaga a decisão sem sintoma. Por isso este
// arquivo mede TRÊS coisas: o DOM da seção (estado e geometria), a CONVERSA da
// ponte (uma lista de chamadas por abertura) e o que a abertura seguinte faz.
//
// O QUE ELE NÃO PROVA: o Android de verdade — o `setStreamVolume` com flags 0, a
// tela de acesso especial e o filtro `ALARMS` só se conferem no aparelho. Aqui a
// ponte é de mentira, e o que se mede é a conversa e o DOM.
//
//   node tools/inicializacao.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, checar, falhas } from './arnes.mjs';

// O SISTEMA FALSO: dez degraus, e a abertura encontra o volume que `cur` disser.
// `acesso` é a autorização de Não perturbe; `dnd` é o filtro já em vigor. Cada
// página tem o PRÓPRIO `__chamadas` — a lista é por abertura, e é isso que se lê.
const PONTE = (opts) => `(() => {
  const o = ${JSON.stringify(opts)};
  window.__sis = { cur: o.cur == null ? 10 : o.cur, max: 10 };
  window.__acesso = o.acesso !== false;
  window.__dndLigado = o.dnd === true;
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
      try {
        window.__avResolve(id, { acesso: window.__acesso, ligado: window.__dndLigado, filtro: 0 });
      } catch (_) {}
    }, 0),
    naoPerturbeDefinir: (on, id) => {
      window.__chamadas.dnd.push(!!on);
      window.__dndLigado = !!on;
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

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const navegador = await abrirNavegador();
const BASE = 'http://localhost:' + servidor.address().port + '/controle/';
const erros = [];

async function contexto(opts, viewport) {
  const ctx = await navegador.newContext({ viewport: viewport || { width: 390, height: 844 } });
  await semRedeExterna(ctx);
  await ctx.addInitScript(PONTE(opts));
  return ctx;
}
// UMA ABERTURA = UMA PÁGINA. A nova página do MESMO contexto compartilha o
// `localStorage` (as decisões) e nasce com o `sessionStorage` VAZIO — é a
// definição de "o app foi fechado e aberto de novo" no WebView.
async function abrir(ctx) {
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function',
    null, { timeout: 30000 },
  );
  return pg;
}
async function abrirSecao(pg) {
  const simples = await pg.evaluate(() => document.body.classList.contains('mode-simple'));
  await pg.click(simples ? '#simpleSettingsBtn' : '#settingsBtn');
  await esperar(pg, () => document.getElementById('fadePopup').classList.contains('open'), null, 8000);
  await pg.click('#bootTile');
  await esperar(pg, () => document.getElementById('bootSecao').classList.contains('open'), null, 8000);
  await pg.waitForTimeout(60);
}
const chamadas = (pg) => pg.evaluate(() => JSON.parse(JSON.stringify(window.__chamadas)));
const secao = (pg) => pg.evaluate(() => {
  const raiz = document.getElementById('bootSecao');
  const barra = document.getElementById('bootVolBar');
  const linha = document.getElementById('bootVolLinha');
  const num = document.getElementById('bootVolNum');
  const modo = document.getElementById('bootModoSeg');
  const dnd = document.getElementById('bootDndSeg');
  const vol = document.getElementById('bootVolSeg');
  const r = raiz.getBoundingClientRect();
  const ro = document.querySelector('#fadePopup .fade-opts').getBoundingClientRect();
  const rows = [...raiz.querySelectorAll('.boot-corpo > .fade-row')].map((n) => {
    const b = n.getBoundingClientRect();
    return { topo: +b.top.toFixed(1), esq: +b.left.toFixed(1), dir: +b.right.toFixed(1), alt: +b.height.toFixed(1) };
  });
  const alvo = (el) => { const b = el.getBoundingClientRect(); return { w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
  return {
    visivel: !raiz.hidden && raiz.classList.contains('open'),
    caixa: { esq: +r.left.toFixed(1), dir: +r.right.toFixed(1), largura: +r.width.toFixed(1), topo: +r.top.toFixed(1) },
    rolagem: { esq: +ro.left.toFixed(1), dir: +ro.right.toFixed(1) },
    rows,
    modo: modo.dataset.modo,
    modoAtivo: [...modo.querySelectorAll('.fit-opt')].filter((b) => b.classList.contains('active')).map((b) => b.dataset.mode),
    dnd: dnd.dataset.estado,
    vol: vol.dataset.estado,
    barraValor: barra.value,
    barraDesabilitada: barra.disabled,
    linhaApagada: linha.classList.contains('apagado'),
    num: num.textContent.trim(),
    barraCaixa: alvo(barra),
    numCaixa: alvo(num),
    piso: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit')) || 34,
    // Só o que está PINTADO: o botão do caminho do sistema nasce `hidden` com a
    // autorização dada, e um nó `display: none` mede 0×0 — acusá-lo seria medir a
    // ausência como se fosse um alvo pequeno.
    alvos: [...raiz.querySelectorAll('button')]
      .filter((b) => b.getClientRects().length > 0)
      .map((b) => ({ id: b.id || '', ...alvo(b) })),
    dicaVisivel: !document.getElementById('bootDndNota').hidden,
    acessoVisivel: !document.getElementById('bootDndAcesso').hidden,
    cartaoNoDom: !!document.getElementById('volAvisoPop') || !!document.getElementById('volAvisoVeu'),
    cartaoAntigo: document.querySelectorAll('.vol-aviso, .vol-veu').length,
    larguraJanela: innerWidth,
  };
});
const modoInicial = (pg) => pg.evaluate(() => document.documentElement.dataset.modoInicial || '');
const guardado = (pg) => pg.evaluate(() => ({
  modoFixo: localStorage.getItem('av.appModeFixo'),
  dnd: localStorage.getItem('av.boot.dnd'),
  volOn: localStorage.getItem('av.boot.volume.on'),
  vol: localStorage.getItem('av.boot.volume'),
  oferta: localStorage.getItem('av.boot.dnd.oferta'),
}));

try {
  // ── A · O PADRÃO: NADA LIGADO, NADA APLICADO, E O CARTÃO NÃO EXISTE ─────
  {
    const ctx = await contexto({});
    const pg = await abrir(ctx);
    // A ABERTURA não mexeu em volume nem em DND.
    const ch = await chamadas(pg);
    checar(ch.definir.length === 0 && ch.dnd.length === 0 && ch.acesso === 0,
      'A · num aparelho novo (chaves ausentes) a abertura NÃO chama o volume nem o Não perturbe', JSON.stringify(ch));
    checar(await pg.evaluate(() => document.getElementById('volAvisoPop') === null
      && document.getElementById('volAvisoVeu') === null
      && document.querySelectorAll('.vol-aviso, .vol-veu').length === 0),
      'A · o cartão de volume da abertura NÃO existe mais no DOM (nem o véu dele)');

    await abrirSecao(pg);
    const s = await secao(pg);
    checar(s.visivel && s.modo === 'simple' && s.modoAtivo.join(',') === 'simple',
      'A · a seção abre com o modo da abertura em "simples" (o padrão)', JSON.stringify(s.modoAtivo));
    checar(s.dnd === 'off' && s.vol === 'off',
      'A · as duas chaves nascem DESLIGADAS', JSON.stringify({ dnd: s.dnd, vol: s.vol }));
    checar(s.barraDesabilitada && s.linhaApagada && s.barraValor === '60' && s.num === '60%',
      'A · a barra nasce inerte e apagada, guardando o número padrão (60%)',
      JSON.stringify({ desabilitada: s.barraDesabilitada, apagada: s.linhaApagada, valor: s.barraValor, num: s.num }));
    checar(!s.dicaVisivel && !s.acessoVisivel,
      'A · com a autorização de Não perturbe dada, o caminho do sistema não aparece',
      JSON.stringify({ dica: s.dicaVisivel, acesso: s.acessoVisivel }));

    // A GEOMETRIA a 390×844: a seção dentro da folha, as três linhas empilhadas
    // na ordem do pedido, nada estourando a largura e todo alvo ≥ `--hit`.
    checar(s.caixa.esq >= s.rolagem.esq - 0.5 && s.caixa.dir <= s.rolagem.dir + 0.5,
      'A · a seção cabe na largura útil da folha', JSON.stringify(s.caixa));
    checar(s.rows.length === 3 && s.rows[0].topo < s.rows[1].topo && s.rows[1].topo < s.rows[2].topo,
      'A · as três decisões são três linhas, na ordem modo → Não perturbe → volume', JSON.stringify(s.rows));
    checar(s.rows.every((r) => r.esq >= s.rolagem.esq - 0.5 && r.dir <= s.rolagem.dir + 0.5),
      'A · nenhuma linha passa da largura da folha', JSON.stringify(s.rows));
    checar(s.alvos.every((a) => Math.min(a.w, a.h) >= s.piso - 0.5),
      'A · todo botão da seção respeita o piso de toque (`--hit`)', JSON.stringify(s.alvos));
    checar(s.barraCaixa.w > 100 && s.numCaixa.w > 0,
      'A · a barra de volume ocupa a linha e o número tem caixa', JSON.stringify({ barra: s.barraCaixa, num: s.numCaixa }));
    checar(s.rows.every((r) => r.dir <= s.larguraJanela + 0.5),
      'A · e nada da seção sai da janela a 390×844', JSON.stringify(s.rows));

    // A GEOMETRIA a 360×640: o mesmo desenho no aparelho pequeno.
    await pg.setViewportSize({ width: 360, height: 640 });
    await pg.waitForTimeout(120);
    await pg.evaluate(() => { recolherSecao({ animar: false }); trocarSecao('boot', { animar: false }); });
    await pg.waitForTimeout(80);
    const p = await secao(pg);
    checar(p.rows.length === 3
      && p.rows.every((r) => r.esq >= p.rolagem.esq - 0.5 && r.dir <= p.rolagem.dir + 0.5)
      && p.alvos.every((a) => Math.min(a.w, a.h) >= p.piso - 0.5)
      && p.barraCaixa.w > 100,
      'A · a 360×640 a seção mantém as três linhas, o piso de toque e a barra inteira',
      JSON.stringify({ rows: p.rows, alvos: p.alvos, barra: p.barraCaixa }));
    await ctx.close();
  }

  // ── B · AS TRÊS DECISÕES PERSISTEM E A ABERTURA SEGUINTE AS APLICA ───────
  {
    const ctx = await contexto({});
    const pg = await abrir(ctx);
    await abrirSecao(pg);
    // ESCOLHER: Avançado, Não perturbe ligado e volume ligado em 60%.
    await pg.click('#bootModoSeg .fit-opt[data-mode="full"]');
    await pg.click('#bootDndSeg .fit-opt[data-dnd="on"]');
    await pg.click('#bootVolSeg .fit-opt[data-vol="on"]');
    await pg.evaluate(() => {
      const b = document.getElementById('bootVolBar');
      b.value = '60';
      b.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await pg.waitForTimeout(80);
    const s = await secao(pg);
    const g = await guardado(pg);
    checar(s.modo === 'full' && s.dnd === 'on' && s.vol === 'on' && s.barraValor === '60' && !s.barraDesabilitada,
      'B · a seção pinta as três escolhas na hora (Avançado, Não perturbe e volume ligados)',
      JSON.stringify({ modo: s.modo, dnd: s.dnd, vol: s.vol, barra: s.barraValor }));
    checar(g.modoFixo === 'full' && g.dnd === '1' && g.volOn === '1' && g.vol === '60',
      'B · e as três vão para o armazenamento do aparelho', JSON.stringify(g));

    // A ABERTURA SEGUINTE (mesmo aparelho, sessão nova).
    const pg2 = await abrir(ctx);
    const g2 = await chamadas(pg2);
    checar(await modoInicial(pg2) === 'full',
      'B · reaberto, o app NASCE no avançado (`data-modo-inicial`)', await modoInicial(pg2));
    checar(g2.definir.length === 1 && Math.abs(g2.definir[0] - 0.6) < 1e-9,
      'B · e o volume do sistema é definido UMA vez, em 60%', JSON.stringify(g2.definir));
    checar(g2.dnd.length === 1 && g2.dnd[0] === true,
      'B · e o Não perturbe é ligado UMA vez', JSON.stringify(g2.dnd));
    checar(await pg2.evaluate(() => document.getElementById('volAvisoPop') === null),
      'B · sem nenhum cartão de volume na abertura');

    // A SEÇÃO REABERTA MOSTRA O QUE FICOU.
    await abrirSecao(pg2);
    const s2 = await secao(pg2);
    checar(s2.modo === 'full' && s2.dnd === 'on' && s2.vol === 'on' && s2.num === '60%',
      'B · reabrir a seção devolve as três decisões como ficaram',
      JSON.stringify({ modo: s2.modo, dnd: s2.dnd, vol: s2.vol, num: s2.num }));

    // "Fácil" VOLTA, e a chave do volume desligada GUARDA o número.
    await pg2.click('#bootModoSeg .fit-opt[data-mode="simple"]');
    await pg2.click('#bootVolSeg .fit-opt[data-vol="off"]');
    await pg2.waitForTimeout(80);
    const g3 = await guardado(pg2);
    const s3 = await secao(pg2);
    checar(g3.modoFixo === null && g3.volOn === null && g3.vol === '60' && g3.dnd === '1',
      'B · "Modo simples" apaga a chave do modo; a do volume desliga e NÃO apaga o número',
      JSON.stringify(g3));
    checar(s3.modo === 'simple' && s3.vol === 'off' && s3.barraDesabilitada && s3.linhaApagada && s3.num === '60%',
      'B · e a barra fica inerte e apagada guardando os 60%',
      JSON.stringify({ modo: s3.modo, vol: s3.vol, desab: s3.barraDesabilitada, apagada: s3.linhaApagada, num: s3.num }));

    // A TERCEIRA ABERTURA: modo simples, volume não tocado, DND ainda aplicado.
    const pg3 = await abrir(ctx);
    const g4 = await chamadas(pg3);
    checar(await modoInicial(pg3) !== 'full',
      'B · reaberto depois do "Modo simples", o app nasce no simples', await modoInicial(pg3));
    checar(g4.definir.length === 0,
      'B · com a chave do volume DESLIGADA, a abertura não chama `systemVolumeDefinir` (lista vazia)',
      JSON.stringify(g4.definir));
    checar(g4.dnd.length === 1 && g4.dnd[0] === true,
      'B · e o Não perturbe, que ficou ligado, é aplicado de novo', JSON.stringify(g4.dnd));
    await ctx.close();
  }

  // ── C · SEM A AUTORIZAÇÃO: NÃO DEFINE, NÃO QUEBRA, OFERECE O CAMINHO ─────
  {
    const ctx = await contexto({ acesso: false });
    const pg = await abrir(ctx);
    await abrirSecao(pg);
    await pg.click('#bootDndSeg .fit-opt[data-dnd="on"]');
    await pg.waitForTimeout(120);
    const s = await secao(pg);
    checar(s.dicaVisivel && s.acessoVisivel,
      'C · sem autorização, a PRÓPRIA seção mostra o caminho do sistema (nota + botão)',
      JSON.stringify({ dica: s.dicaVisivel, botao: s.acessoVisivel }));
    checar(await pg.evaluate(() => document.getElementById('bootDndAcesso').textContent.trim()) === 'Autorizar no Android',
      'C · e o botão diz o que faz',
      await pg.evaluate(() => document.getElementById('bootDndAcesso').textContent.trim()));

    // A ABERTURA: o filtro NÃO é definido, o caminho é oferecido UMA vez, e a
    // tela abre normal (a porta de conexão recebe o dedo).
    const pg2 = await abrir(ctx);
    await esperar(pg2, () => window.__chamadas.acesso === 1, null, 8000);
    const c2 = await chamadas(pg2);
    checar(c2.dnd.length === 0,
      'C · sem autorização a abertura NÃO chama `naoPerturbeDefinir` (o no-op silencioso é o defeito que se evita)',
      JSON.stringify(c2.dnd));
    checar(c2.acesso === 1,
      'C · e oferece o caminho do sistema UMA vez na abertura', JSON.stringify(c2));
    const usavel = await pg2.evaluate(() => {
      const b = document.getElementById('simpleConn');
      if (!b) return { ok: false, motivo: 'sem a porta de conexão' };
      const r = b.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { ok: !!el && b.contains(el), alvo: el ? (el.id || el.tagName) : null };
    });
    checar(usavel.ok, 'C · e o app abre usável — nada travado por causa do Não perturbe', usavel);

    // A SEGUNDA ABERTURA NÃO REPETE O PEDIDO.
    const pg3 = await abrir(ctx);
    await pg3.waitForTimeout(1500);
    const c3 = await chamadas(pg3);
    checar(c3.acesso === 0 && c3.dnd.length === 0,
      'C · a abertura seguinte não repete o pedido nem define o filtro', JSON.stringify(c3));
    await ctx.close();
  }

  // ── D · A VOLTA AO ZERO DO VOLUME NÃO RESSUSCITA O CARTÃO ────────────────
  // O volume do SISTEMA em 0% era a condição do cartão antigo. Com a seção no
  // lugar dele, nem o pior caso abre nada: e a chave desligada não escreve.
  {
    const ctx = await contexto({ cur: 0 });
    const pg = await abrir(ctx);
    await pg.waitForTimeout(1500);
    const ch = await chamadas(pg);
    checar(ch.definir.length === 0 && ch.acesso === 0,
      'D · volume do sistema em 0% e chaves desligadas: nenhuma chamada na abertura', JSON.stringify(ch));
    checar(await pg.evaluate(() => document.getElementById('volAvisoPop') === null),
      'D · e nenhum cartão de volume no DOM — a abertura não pergunta mais nada de volume');
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
