// O WATCHDOG DO OTA CONFIRMA COM A FILA VAZIA (v1.11.8).
//
// ## O defeito que este arquivo existe para impedir
//
// `shared/native.js` decide, no aparelho, se um bundle baixado é carimbado como
// bom (`B.otaConfirm()`) ou descartado no lançamento seguinte (o app volta ao
// embutido no APK). Da v1.8.54 à v1.11.7 a última condição
// dele foi "há um `<li>` dentro de `#playlist`" — e com a FILA VAZIA a lista não
// desenha nada (a frase de "fila vazia" saiu na v1.8.54, a pedido do operador).
// Resultado, num aparelho de fila vazia: o watchdog NUNCA confirmava, o bundle
// novo era descartado a cada lançamento, o app abria no embutido (v1.11.3) e
// oferecia a MESMA atualização de novo, para sempre — sem erro em lugar nenhum.
//
// Nenhum oráculo via isso porque TODOS os que carregam o Controle com ponte têm
// `otaConfirm: () => {}` (um no-op) e semeiam uma fila; o `boot-nativo` até
// reescrevia a pergunta do watchdog com uma saída própria (`|| plBtn.disabled`),
// que NÃO era a do `native.js`. Aqui o que se mede é o EFEITO: a ponte recebeu
// `otaConfirm`, ou não recebeu.
//
// ## O que se afirma
//
//   A. fila VAZIA → confirma           (o defeito)
//   B. fila com item → confirma        (o que já funcionava: não pode regredir)
//   C. o `init()` NÃO chega ao fim → NÃO confirma, mesmo com tudo o mais de pé e
//      com a fila cheia. É a metade que impede o conserto "preguiçoso" (apagar a
//      condição, ou trocá-la por uma que o HTML já satisfaz): um bundle cuja
//      inicialização trava no meio NÃO pode ser carimbado como bom.
//   D. o `controle.js` abortado → NÃO confirma (o cenário catastrófico do OTA).
//
// Uso:
//   node tools/ota-confirma.test.mjs

import path from 'path';
import { fileURLToPath } from 'url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperar, porque, checar, falhas,
} from './arnes.mjs';

// A PONTE DE MENTIRA, com `otaConfirm` que CONTA. Todo método que o `native.js`
// chama por `call()` precisa estar na allowlist: o que falta não resolve, e o
// `call()` trava 60 s calado.
const PONTE = `(() => {
  window.__confirmou = 0;
  window.__telas = [];
  window.__espelho = { ligado: false, telas: [] };
  const B = {
    shellVersion: () => 77,
    role: () => 'controle',
    appVersion: () => '1.99-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => { window.__confirmou += 1; },
    displays: (id) => {
      setTimeout(() => { try { window.__avResolve(id, window.__telas); } catch (_) {} }, 0);
    },
    espelhoEstado: (id) => {
      setTimeout(() => { try { window.__avResolve(id, window.__espelho); } catch (_) {} }, 0);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal',
    'castTarget','saidaDeAudioAlvo','cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages',
    'espelhoCertApagar','espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag',
    'espelhoEstado','espelhoLigar','espelhoLigarEm','espelhoDerrubar','farolEstado','keepAlive',
    'listFolder','nowPlaying','openCast','abrirSaidaDeAudio','openExternal','otaApply','otaCheck',
    'otaDiag','otaPending','pacoteDiag','pickDoc','pickFolder','salvarTexto','systemVolume',
    'temaClaro','ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte',
    'ytFetchAudio','ytPlaylist','ytSearch','ytStream','areaTransferencia','atualizacaoEstado',
    'compartilharTexto','pacoteDescartarPronto','espacoLivre','r2Imagem',
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

// O `init()` que não chega ao fim: o `<head>` publica `__avSplash` e este gancho
// troca o `pronto()` por um no-op — todo o resto do app sobe (os globais, o
// `__avBack`, a fila), mas a ÚLTIMA linha do `init()` nunca marca o fim. Roda
// antes do script do `<head>`, como o gancho da cortina do arnês (que aqui não é
// usado: este oráculo não espera a cortina).
const INIT_QUE_NAO_TERMINA = () => {
  let v;
  Object.defineProperty(window, '__avSplash', {
    configurable: true,
    get() { return v; },
    set(x) { v = x; if (x) x.pronto = () => {}; },
  });
};

// Uma faixa e a fila com ela, semeadas pelo caminho de verdade (o IndexedDB do
// próprio app) — e o `reload` depois, para o `init()` ler a fila do banco.
const SEMEAR_FILA = `
  const id = 'faixa-da-fila';
  await AVDB.opfsWriteFile('folders/teste/' + id + '.wav',
    new Blob([new Uint8Array(4000).fill(3)], { type: 'audio/wav' }));
  await AVDB.fileAdd({
    id, folder: 'teste', opfsPath: 'folders/teste/' + id + '.wav', srcName: id,
    name: 'FAIXA DA FILA', type: 'audio/wav', kind: 'audio', size: 4000, mtime: 1,
    thumb: null, blob: null, url: null, addedAt: 1, lyrics: null,
  });
  await AVDB.listAdd('playlist', id);
`;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const erros = [];

// Abre o Controle COM a ponte de mentira. `antes` roda como init-script (antes de
// qualquer script da página); `bloquear` aborta um recurso (o cenário D).
const abrir = async ({ antes, bloquear } = {}) => {
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push(String(e && e.message || e)));
  await pg.addInitScript(PONTE);
  if (antes) await pg.addInitScript(antes);
  if (bloquear) await pg.route(bloquear, (r) => r.abort());
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  return { ctx, pg };
};

// O ESTADO DO APP, lido de dentro: a fila, o `__avBack` e o fim do `init()`.
const estado = (pg) => pg.evaluate(() => ({
  filaItens: typeof plItems !== 'undefined' ? plItems.length : -1,
  filaNos: document.querySelectorAll('#playlist > li').length,
  avBack: typeof window.__avBack === 'function',
  terminou: !!(window.__avSplash && window.__avSplash.terminou === true),
  confirmou: window.__confirmou,
}));

try {
  // =========================================================================
  // A · FILA VAZIA — o defeito
  // =========================================================================
  {
    const { ctx, pg } = await abrir();
    // O FIM DO `init()` é medido pelo gancho do ARNÊS (`__avPronto`), e não pelo campo
    // que o conserto acrescentou: a premissa tem de valer na árvore SEM o conserto
    // também, ou a reversão reprovaria a premissa em vez do defeito.
    const subiu = await esperar(pg, () => typeof window.__avBack === 'function'
      && window.__avPronto === true, null, 30000);
    const antes = await estado(pg);
    checar(subiu === true && antes.avBack && antes.filaItens === 0 && antes.filaNos === 0,
      'A0 · PREMISSA: o app subiu até o fim do `init()` com a fila VAZIA — nenhum item, '
      + 'nenhum `<li>` em `#playlist` (a lista vazia não desenha nada, e esse é o estado '
      + 'normal de um aparelho depois do culto)', { ...antes, prazo: porque(subiu) });
    const confirmou = await esperar(pg, () => window.__confirmou > 0, null, 20000);
    checar(confirmou === true,
      'A1 · com a fila VAZIA o watchdog CONFIRMA o bundle (`otaConfirm` chega à ponte) — '
      + 'sem isso o bundle novo é descartado no lançamento seguinte, o app volta ao embutido '
      + 'e oferece a mesma atualização de novo, para sempre',
      { ...(await estado(pg)), prazo: porque(confirmou) });
    await ctx.close();
  }

  // =========================================================================
  // B · FILA COM ITEM — o que já funcionava
  // =========================================================================
  {
    const { ctx, pg } = await abrir();
    await esperar(pg, () => typeof window.__avBack === 'function' && window.__avPronto === true, null, 30000);
    await pg.evaluate(`(async () => { ${SEMEAR_FILA} })()`);
    await pg.reload({ waitUntil: 'load' });
    const subiu = await esperar(pg, () => typeof window.__avBack === 'function'
      && window.__avPronto === true && !!document.querySelector('#playlist > li'), null, 30000);
    const antes = await estado(pg);
    checar(subiu === true && antes.filaItens === 1 && antes.filaNos === 1,
      'B0 · PREMISSA: a fila tem UM item e o `<li>` está desenhado', { ...antes, prazo: porque(subiu) });
    const confirmou = await esperar(pg, () => window.__confirmou > 0, null, 20000);
    checar(confirmou === true,
      'B1 · com a fila CHEIA o watchdog continua confirmando (o conserto não regrediu o que '
      + 'já funcionava)', { ...(await estado(pg)), prazo: porque(confirmou) });
    await ctx.close();
  }

  // =========================================================================
  // C · O `init()` NÃO TERMINA — não pode confirmar, nem com a fila cheia
  // =========================================================================
  {
    // A fila é semeada pelo banco do PRÓPRIO app e a página recarregada com o gancho
    // já instalado: a fila precisa existir quando o app sobe, para que "há um
    // `<li>`" seja VERDADE aqui — é a condição antiga que este cenário reprova.
    const { ctx, pg } = await abrir({ antes: INIT_QUE_NAO_TERMINA });
    await esperar(pg, () => typeof window.__avBack === 'function', null, 30000);
    await pg.evaluate(`(async () => { ${SEMEAR_FILA} })()`);
    await pg.reload({ waitUntil: 'load' });
    const subiu = await esperar(pg, () => typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist > li'), null, 30000);
    const estadoC = await estado(pg);
    checar(subiu === true && estadoC.filaNos === 1 && estadoC.terminou === false,
      'C0 · PREMISSA: tudo o mais está de pé — globais, `__avBack`, a fila com o `<li>` — e o '
      + '`init()` NÃO marcou o fim (o `pronto()` da cortina nunca rodou)',
      { ...estadoC, prazo: porque(subiu) });
    // Uma AUSÊNCIA só se prova esperando o prazo do watchdog passar por ela várias
    // vezes (ele consulta de 250 em 250 ms): 4 s são ~16 consultas.
    await pg.evaluate(() => new Promise((r) => setTimeout(r, 4000)));
    const depois = await estado(pg);
    checar(depois.confirmou === 0,
      'C1 · com o `init()` incompleto o watchdog NÃO confirma — um bundle que trava no meio '
      + 'da inicialização não pode ser carimbado como bom, mesmo com a fila desenhada. É a '
      + 'metade que reprova o conserto preguiçoso (apagar a condição, ou trocá-la por uma que '
      + 'o HTML já satisfaz)', depois);
    await ctx.close();
  }

  // =========================================================================
  // D · O `controle.js` ABORTADO — o cenário catastrófico
  // =========================================================================
  {
    const { ctx, pg } = await abrir({ bloquear: '**/controle/controle.js' });
    await esperar(pg, () => !!window.AVDB, null, 30000);
    await pg.evaluate(() => new Promise((r) => setTimeout(r, 4000)));
    const e = await estado(pg);
    checar(e.avBack === false && e.confirmou === 0,
      'D1 · com o `controle.js` abortado o watchdog NÃO confirma (sem `__avBack`, sem fim do '
      + '`init()`) — o desfecho ruim continua sendo o app quebrado À VISTA', e);
    await ctx.close();
  }

  checar(erros.filter((m) => !/Failed to fetch|net::ERR|aborted/i.test(m)).length === 0,
    'nenhum erro de página inesperado', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
