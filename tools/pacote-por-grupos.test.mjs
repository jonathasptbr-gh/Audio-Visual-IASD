#!/usr/bin/env node
// ============================================================================
// A EXPORTAÇÃO POR GRUPOS — o que o operador escolhe, e por que ela parou de
// ficar em 0%.
//
// ## Por que este oráculo existe
//
// O `pacote.test.mjs` prende a REGRA do formato e o `pacote-ida-e-volta` prende
// a LIGAÇÃO de um aparelho ao outro. Este prende as duas coisas que a v1.7.2
// acrescentou, e as duas falham CALADAS:
//
//  1. **O LOTE.** Cada bloco que atravessa o canal é uma ida e volta
//     (`postMessage` → thread de escrita → ack), e ela custa o mesmo para 50
//     bytes e para 512 kB. A Bíblia mora em `state` com UMA CHAVE POR CAPÍTULO
//     — 1189 por versão —, e a versão anterior mandava um bloco por cabeçalho e
//     um por corpo: ~7.200 viagens para escrever poucos megabytes. Nada disso
//     dá erro; o que ele produz é *"a exportação está absurdamente lenta"*.
//  2. **O PROGRESSO DURANTE ESSA FASE.** Nenhum registro de `state` reportava
//     bytes, e o plano nem os somava — então a notificação ficava em **0%**
//     durante a parte mais demorada da exportação. É indistinguível de travar,
//     e foi assim que o operador a leu.
//
// E a terceira: **a ESCOLHA precisa cortar bytes de verdade.** Uma folha que
// mostra grupos e exporta tudo do mesmo jeito é pior que folha nenhuma — ela
// promete um arquivo menor e entrega o mesmo.
//
//   node tools/pacote-por-grupos.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperar, porque, checar, falhas } from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

// A PONTE, com o canal de bytes de mentira — a mesma do `pacote-ida-e-volta`,
// mais DUAS sondas que este oráculo precisa: cada bloco vira uma entrada de
// `__saida` (é o número de idas e voltas), e cada `bgProgress` vira uma entrada
// de `__progresso` (é o que a notificação do sistema recebeu).
const PONTE = `(function () {
  window.__saida = [];
  window.__progresso = [];
  const canal = {
    postMessage(m) {
      if (typeof m === 'string') {
        setTimeout(() => canal.onmessage({ data: JSON.stringify({ ok: true }) }), 0);
        return;
      }
      window.__saida.push(new Uint8Array(m));
      let total = 0;
      for (const p of window.__saida) total += p.length;
      setTimeout(() => canal.onmessage({ data: JSON.stringify({ r: total }) }), 0);
    },
    onmessage: null,
  };
  window.__avPacote = canal;

  const vazio = { displays: [], listFolder: [], otaPending: '', otaDiag: '',
    espelhoEstado: { ligado: false, telas: [], redes: [] }, espelhoDiag: {},
    castTarget: { label: '' }, apkProcurar: {}, ytDiag: '', cifraDiag: '',
    farolEstado: { conta: true, ultimo: 0, diag: 'de teste' } };
  const comCallId = new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','requestMic','castTarget',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','apkProcurar','otaPending','otaApply',
    'otaCheck','otaDiag','ytDiag','cifraDiag','farolEstado','ytCanalPlaylists','ytPlaylist',
    'ytDetalhes','micDiag','areaTransferencia','salvarTexto']);
  const B = {
    shellVersion: () => 63,
    role: () => 'controle',
    appVersion: () => '9.99-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    compartilharTexto: () => {},
    bgProgress: (s) => { try { window.__progresso.push(JSON.parse(s)); } catch (e) {} },
    pacoteCancelar: () => { window.__cancelado = (window.__cancelado || 0) + 1; },
    pacoteCriar: (id) => { setTimeout(() => window.__avResolve(id, 'acervo-de-teste.avpkg'), 0); },
    pacoteFechar: (id) => {
      let total = 0;
      for (const p of (window.__saida || [])) total += p.length;
      setTimeout(() => window.__avResolve(id, total), 0);
    },
    pickDoc: (id) => { setTimeout(() => window.__avResolve(id, []), 0); },
  };
  const nomes = ['apkInstalar','apkProcurar','captureVolumeKeys','castTarget',
    'deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar','espelhoCertEstado',
    'espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado','espelhoLigar',
    'keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply','otaCheck',
    'otaDiag','otaPending','pickFolder','requestMic','systemVolume','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio',
    'ytPlaylist','ytSearch','ytStream','farolEstado','projecaoLocal','micDiag','cifraHtml',
    'cifraDiag','areaTransferencia','salvarTexto','ytDetalhes'];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      if (!comCallId.has(n)) return undefined;
      const id = args[0];
      if (typeof id === 'string') {
        const v = Object.prototype.hasOwnProperty.call(vazio, n) ? vazio[n] : null;
        setTimeout(() => { try { window.__avResolve(id, v); } catch (_) {} }, 0);
      }
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;
const navegador = await abrirNavegador();

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY|ERR_FAILED/;

async function aparelho() {
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(t);
  });
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperar(pg, () => !document.getElementById('splash'), null, 30000);
  return { ctx, pg };
}

// A folha de escolha, respondida pelo BOTÃO — como quem opera. `desmarcar` é a
// lista de rótulos a tocar antes de confirmar.
async function escolher(pg, desmarcar) {
  const abriu = await esperar(pg, () => {
    const d = document.getElementById('songMenuPopup');
    return !!d && d.classList.contains('open') && !!d.querySelector('.song-menu-go');
  }, null, 60000);
  if (abriu !== true) return abriu;
  for (const rotulo of (desmarcar || [])) {
    await pg.evaluate((r) => {
      const li = [...document.querySelectorAll('#songMenuList li')]
        .find((x) => (x.querySelector('.song-menu-label') || {}).textContent === r);
      if (li) li.querySelector('.song-menu-btn').click();
    }, rotulo);
  }
  const linhas = await pg.evaluate(() => [...document.querySelectorAll('#songMenuList li')]
    .map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim()));
  await pg.click('#songMenuList .song-menu-go');
  return linhas;
}

async function responderDialogo(pg) {
  const abriu = await esperar(pg, () => {
    const d = document.getElementById('appDialog');
    return !!d && d.classList.contains('open');
  }, null, 60000);
  if (abriu !== true) return abriu;
  const texto = await pg.evaluate(() => document.getElementById('appDialogMsg').textContent);
  await pg.click('#appDialogOk');
  return texto;
}

try {
  // =========================================================================
  // A · O LOTE: milhares de registros minúsculos não são milhares de viagens
  // =========================================================================
  //
  // A semente imita a BÍBLIA, que é a forma real do problema: 400 chaves de
  // `state` de ~200 bytes cada, e NADA MAIS. Sem mídia e sem OPFS, tudo o que
  // este cenário escreve é a fase que ficava em 0%.
  const a = await aparelho();
  // MODO AVANÇADO: no Fácil sem TV a preview não existe (`previewBusy` devolve o
  // no-op), e é no cartão dela que o número aparece. Ali a exportação continua
  // dizendo o que faz — pelo aro do tile e pela notificação —, mas o percentual
  // que este bloco mede tem casa só aqui.
  await a.pg.evaluate(() => setAppMode('full'));
  await a.pg.evaluate(async () => {
    const versiculos = Array.from({ length: 12 }, (_, i) => ({ v: i + 1, t: 'versículo de teste ' + i }));
    for (let i = 0; i < 400; i++) {
      await AVDB.setState('bible:tst_gn_' + i, versiculos);
    }
  });
  await a.pg.evaluate(() => { window.__fim = exportarPacote(); });
  const listaA = await escolher(a.pg, []);
  checar(Array.isArray(listaA), 'A · a folha de escolha abre', porque(listaA));
  const fimA = await responderDialogo(a.pg);
  checar(typeof fimA === 'string' && /acervo-de-teste\.avpkg/.test(fimA),
    'A · e a exportação termina', fimA);

  const medida = await a.pg.evaluate(() => {
    const partes = window.__saida;
    let bytes = 0;
    for (const p of partes) bytes += p.length;
    const prog = window.__progresso || [];
    return {
      blocos: partes.length,
      bytes,
      // O TOTAL e a UNIDADE vêm da NOTIFICAÇÃO, e só eles: eles são ESTADO e
      // chegam com `force`, então não dependem do freio de 700 ms. O `done`
      // NÃO vem daqui — num acervo de teste a exportação inteira cabe dentro
      // do freio, e o que o oráculo mediria seria o freio, não o app.
      total: prog.reduce((m, p) => Math.max(m, p.total || 0), 0),
      bytesNaFaixa: prog.some((p) => p.bytes === true),
      // O PERCENTUAL DO CARTÃO é a outra ponta do mesmo `andou`, e essa não
      // passa por freio nenhum: ele é reescrito a cada bloco.
      cartao: (document.getElementById('pvBusyLabel') || {}).textContent || '',
    };
  });
  // 400 chaves são 400 cabeçalhos + 400 corpos = 800 registros. Sem o lote,
  // eram 800 idas e voltas; com ele, o que atravessa é o número de BLOCOS de
  // 512 kB que os bytes ocupam — aqui, um punhado.
  checar(medida.bytes > 40000,
    'A · o pacote tem os bytes das 400 chaves', medida.bytes);
  checar(medida.blocos <= 8,
    'A · e eles atravessaram o canal em POUCOS blocos: 800 registros minúsculos '
    + 'não são 800 idas e voltas (era isto que fazia a exportação levar minutos)',
    medida.blocos);
  // O PROGRESSO É A OUTRA METADE, e sem ela a de cima não bastaria: uma
  // exportação rápida que continue dizendo 0% ainda é uma exportação que parece
  // travada. Com SÓ chaves de `state` no aparelho, um `done` maior que zero só
  // pode ter vindo delas.
  // "MAIOR QUE ZERO" NÃO BASTA, e isto foi medido escrevendo o arquivo: o
  // cabeçalho humano (`info`) é um corpo como outro qualquer e sozinho já leva o
  // contador acima de zero. A régua é o percentual do FIM — com só chaves de
  // `state` no aparelho, ao terminar o cartão tem de estar em 100%.
  checar(/·\s*100%$/.test(medida.cartao),
    'A · e o progresso ANDOU durante a fase das chaves de `state` — era ela que '
    + 'ficava em 0%, porque nenhum registro dali reportava bytes',
    JSON.stringify(medida));
  checar(medida.total > 1000,
    'A · com um total que inclui essas chaves (o plano não as somava, e a barra '
    + 'nascia contra "1")',
    JSON.stringify(medida));
  checar(medida.bytesNaFaixa === true,
    'A · e a notificação sabe que a unidade é BYTES', medida.bytesNaFaixa);
  await a.ctx.close();

  // =========================================================================
  // B · A ESCOLHA CORTA BYTES DE VERDADE
  // =========================================================================
  const b = await aparelho();
  await b.pg.evaluate(async () => {
    // DUAS coleções de verdade, pelo caminho de verdade: o catálogo de álbuns
    // mora no `state` e é dele que o `allCollections()` monta a lista. Semear a
    // variável de módulo direto pularia justamente a ponte que a folha usa para
    // dar NOME a cada grupo.
    await AVDB.setState('albumCatalog', {
      categories: [],
      albums: [{ id_album: 'um', name: 'Álbum Um' }, { id_album: 'dois', name: 'Álbum Dois' }],
    });
  });
  await b.pg.reload({ waitUntil: 'domcontentloaded' });
  await esperar(b.pg, () => !document.getElementById('splash'), null, 30000);
  await b.pg.evaluate(async () => {
    const bytes = (n, v) => new Blob([new Uint8Array(n).fill(v)], { type: 'audio/mp4' });
    await AVDB.opfsWriteFile('folders/album-um/faixa.m4a', bytes(9000, 1));
    await AVDB.fileAdd({
      id: 'do-um', folder: 'album-um', opfsPath: 'folders/album-um/faixa.m4a',
      name: 'Faixa do Um', type: 'audio/mp4', kind: 'audio', size: 9000,
      thumb: null, blob: null, url: null, addedAt: 1,
    });
    await AVDB.opfsWriteFile('folders/album-dois/faixa.m4a', bytes(9000, 2));
    await AVDB.fileAdd({
      id: 'do-dois', folder: 'album-dois', opfsPath: 'folders/album-dois/faixa.m4a',
      name: 'Faixa do Dois', type: 'audio/mp4', kind: 'audio', size: 9000,
      thumb: null, blob: null, url: null, addedAt: 1,
    });
  });
  await b.pg.evaluate(() => { window.__fim = exportarPacote(); });
  const listaB = await escolher(b.pg, ['Álbum Dois']);
  checar(Array.isArray(listaB) && listaB.some((t) => /Álbum Um/.test(t))
    && listaB.some((t) => /Álbum Dois/.test(t)),
    'B · a folha nomeia cada coleção do aparelho', JSON.stringify(listaB));
  const fimB = await responderDialogo(b.pg);
  checar(typeof fimB === 'string', 'B · e a exportação termina', fimB);

  const conteudo = await b.pg.evaluate(() => {
    const partes = window.__saida;
    let n = 0;
    for (const p of partes) n += p.length;
    const u8 = new Uint8Array(n);
    let o = 0;
    for (const p of partes) { u8.set(p, o); o += p.length; }
    return { texto: new TextDecoder('latin1').decode(u8), bytes: n };
  });
  checar(/folders\/album-um\/faixa\.m4a/.test(conteudo.texto),
    'B · o grupo MARCADO entrou no arquivo', conteudo.bytes);
  checar(!/folders\/album-dois\/faixa\.m4a/.test(conteudo.texto),
    'B · e o DESMARCADO não — a folha corta BYTES, não só a lista da tela');
  // O CATÁLOGO SEGUE OS BYTES, e este é o par que impede o corte de virar um
  // defeito pior que o que ele conserta: um registro de `files` sem o arquivo
  // dele é uma faixa que aparece na Biblioteca do destino e não toca.
  checar(/"do-um"/.test(conteudo.texto),
    'B · o registro de catálogo do grupo marcado entrou');
  checar(!/"do-dois"/.test(conteudo.texto),
    'B · e o do desmarcado NÃO — catálogo sem arquivo é uma faixa que não toca');
  await b.ctx.close();

  checar(erros.length === 0, 'nenhum erro de console', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
