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

// A folha de escolha, respondida pelos CONTROLES — como quem opera.
const abriuFolha = (pg) => esperar(pg, () => {
  const d = document.getElementById('songMenuPopup');
  return !!d && d.classList.contains('open') && !!d.querySelector('.song-menu-go');
}, null, 60000);

// O que a folha mostra AGORA: cada linha com o rótulo, o estado da caixa e se
// ela está dentro de uma seção.
const lerFolha = (pg) => pg.evaluate(() => [...document.querySelectorAll('#songMenuList li')]
  .map((li) => {
    const b = li.firstElementChild;
    const cx = li.querySelector('.song-menu-check');
    return {
      rotulo: (li.querySelector('.song-menu-label') || {}).textContent || '',
      sub: (li.querySelector('.song-menu-sub') || {}).textContent || '',
      marca: !cx ? '' : cx.classList.contains('on') ? 'todas'
        : cx.classList.contains('parcial') ? 'parte' : 'nenhuma',
      grupo: !!(b && b.classList.contains('song-menu-grupo')),
      dentro: !!(b && b.classList.contains('song-menu-dentro')),
      seta: !!li.querySelector('.song-menu-seta'),
    };
  }));

// Toca no CORPO de uma linha (marca/desmarca) ou na SETA dela (abre a seção) —
// pelo rótulo, que é como o operador a encontra.
const tocar = (pg, rotulo, alvo) => pg.evaluate(([r, a]) => {
  const li = [...document.querySelectorAll('#songMenuList li')]
    .find((x) => ((x.querySelector('.song-menu-label') || {}).textContent || '') === r);
  if (!li) throw new Error('linha não encontrada: ' + r);
  (a === 'seta' ? li.querySelector('.song-menu-seta') : li.firstElementChild).click();
}, [rotulo, alvo || 'corpo']);

async function escolher(pg, passos) {
  const abriu = await abriuFolha(pg);
  if (abriu !== true) return abriu;
  for (const [rotulo, alvo] of (passos || [])) await tocar(pg, rotulo, alvo);
  const linhas = await pg.evaluate(() => [...document.querySelectorAll('#songMenuList li')]
    .map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim()));
  await pg.click('#songMenuList .song-menu-go');
  return linhas;
}

const pg2linhas = (pg) => pg.evaluate(() => [...document.querySelectorAll('#songMenuList li')]
  .map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim()));

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
  // O ESPIÃO DO RÓTULO. O tile EMPRESTA o próprio título (v1.7.3), e o que
  // interessa é a SEQUÊNCIA — um estado final não distingue "andou de 0 a 100"
  // de "pulou direto para o fim". Um `MutationObserver` pega todas as escritas
  // sem depender de quando o oráculo olha, que é o que um `waitForTimeout`
  // faria.
  await a.pg.evaluate(() => {
    window.__rotulos = [];
    const alvo = document.querySelector('#pacoteExportarTile .qs-titulo');
    window.__rotulos.push(alvo.textContent);
    new MutationObserver(() => window.__rotulos.push(alvo.textContent))
      .observe(alvo, { childList: true, characterData: true, subtree: true });
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
      // A SEQUÊNCIA de rótulos que o botão mostrou, do espião acima.
      rotulos: window.__rotulos || [],
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
  // O PROGRESSO É A OUTRA METADE, e sem ela a de cima não bastaria: uma
  // exportação rápida que continue dizendo 0% ainda é uma exportação que parece
  // travada. Com SÓ chaves de `state` no aparelho, um percentual acima de zero
  // só pode ter vindo delas.
  const pcts = medida.rotulos.filter((t) => /^\d+%$/.test(t)).map((t) => parseInt(t, 10));
  checar(pcts.length >= 2 && Math.max(...pcts) === 100,
    'A · e o progresso ANDOU durante a fase das chaves de `state`, NO PRÓPRIO '
    + 'BOTÃO — era ela que ficava em 0%, porque nenhum registro dali reportava '
    + 'bytes', JSON.stringify(medida.rotulos));
  // O BOTÃO É A INTERFACE INTEIRA DESTA AÇÃO (v1.7.3): ele diz que está
  // medindo, quanto já foi, e quanto pesou o arquivo. O cartão sobre a preview
  // saiu daqui — a exportação não acontece na preview.
  checar(medida.rotulos.includes('Medindo…'),
    'A · e a MEDIÇÃO também fala nele: ela leva segundos num acervo grande e '
    + 'acontecia em silêncio', JSON.stringify(medida.rotulos));
  checar(/^\d/.test(medida.rotulos[medida.rotulos.length - 1] || ''),
    'A · e o desfecho é o TAMANHO do arquivo, no mesmo lugar',
    JSON.stringify(medida.rotulos.slice(-3)));
  // E O EMPRÉSTIMO É DEVOLVIDO. Um rótulo que não volta deixa "193 KB" no lugar
  // de "Exportar" para sempre — sem erro, e sem nada que o explique.
  const devolveu = await esperar(a.pg,
    () => document.querySelector('#pacoteExportarTile .qs-titulo').textContent === 'Exportar',
    null, 12000);
  checar(devolveu === true,
    'A · e o botão VOLTA a ser "Exportar" — ele empresta o rótulo, não o troca',
    porque(devolveu));
  checar(await a.pg.evaluate(() => !document.getElementById('pvBusy').classList.contains('on')),
    'A · e o cartão sobre a preview não entrou em cena: a ação não acontece lá');
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
  const abriuB = await abriuFolha(b.pg);
  checar(abriuB === true, 'B · a folha de escolha abre', porque(abriuB));

  // ===== A FOLHA É A ÁRVORE DA BIBLIOTECA (v1.7.3) =====
  // Os dois álbuns não têm categoria, então a Biblioteca os põe em "Álbuns" — e
  // a folha os põe no mesmo lugar. A seção nasce FECHADA: com tudo marcado, a
  // barra do grupo resolve o caso comum sem abrir nada.
  const fechada = await lerFolha(b.pg);
  const secao = fechada.find((l) => l.grupo);
  checar(!!secao && secao.rotulo === 'Álbuns' && secao.marca === 'todas' && secao.seta,
    'B · as coleções vêm AGRUPADAS pelas mesmas seções da Biblioteca, com a '
    + 'marca do grupo e a seta', JSON.stringify(secao));
  checar(!fechada.some((l) => l.dentro),
    'B · e a seção nasce FECHADA — a folha abre com tudo marcado, e o que se faz '
    + 'nela é TIRAR', JSON.stringify(fechada.map((l) => l.rotulo)));
  checar(/2 de 2/.test((secao && secao.sub) || ''),
    'B · com a conta do que está marcado dentro dela', secao && secao.sub);

  // ===== NÃO HÁ LINHA DE "TUDO", E TUDO NASCE MARCADO (v1.7.6) =====
  //
  // Ela existiu da v1.7.3 à v1.7.5 e saiu a pedido: *"o seletor de 'tudo' …
  // está inútil agora que temos o agrupamento … deixe tudo selecionado por
  // padrão e o usuário seleciona/desseleciona os poucos itens"*.
  //
  // AS DUAS METADES, e a segunda é a que impede o conserto largo demais: a
  // linha não existe **e** a folha continua abrindo com tudo marcado. Só a
  // primeira passaria com a folha nascendo VAZIA, que é o estado em que o
  // operador teria de montar a seleção inteira à mão — o oposto do pedido.
  checar(!fechada.some((l) => /Selecionar tudo|Limpar a seleção/.test(l.rotulo)),
    'B · a folha não tem mais a linha de "tudo" — com o agrupamento ela virou '
    + 'toques a mais para chegar ao estado em que a folha já nasce',
    JSON.stringify(fechada.map((l) => l.rotulo)));
  checar(fechada.every((l) => !l.marca || l.marca === 'todas'),
    'B · e TUDO nasce marcado: o que se faz nela é TIRAR as poucas coleções que '
    + 'não vão', JSON.stringify(fechada.map((l) => [l.rotulo, l.marca])));

  // ===== A BARRA DO GRUPO MARCA O GRUPO INTEIRO =====
  await tocar(b.pg, 'Álbuns');
  const semGrupo = await lerFolha(b.pg);
  checar((semGrupo.find((l) => l.grupo) || {}).marca === 'nenhuma',
    'B · a barra de uma seção marcada DESMARCA o grupo inteiro de uma vez',
    JSON.stringify(semGrupo.find((l) => l.grupo)));
  await tocar(b.pg, 'Álbuns');

  // ===== E A MARCA PARCIAL EXISTE =====
  // Uma caixa de duas posições MENTE sobre um grupo com metade escolhida.
  await tocar(b.pg, 'Álbuns', 'seta');
  const aberta = await lerFolha(b.pg);
  checar(aberta.filter((l) => l.dentro).length === 2,
    'B · a seta ABRE a seção, e as coleções dela aparecem recuadas',
    JSON.stringify(aberta.map((l) => [l.rotulo, l.dentro])));
  await tocar(b.pg, 'Álbum Dois');
  const parcial = await lerFolha(b.pg);
  checar((parcial.find((l) => l.grupo) || {}).marca === 'parte',
    'B · e com metade escolhida a marca do grupo fica PARCIAL — cheia ou vazia '
    + 'mentiria sobre o que vai no arquivo',
    JSON.stringify(parcial.find((l) => l.grupo)));

  const listaB = await pg2linhas(b.pg);
  checar(listaB.some((t) => /Álbum Um/.test(t)) && listaB.some((t) => /Álbum Dois/.test(t)),
    'B · a folha nomeia cada coleção do aparelho', JSON.stringify(listaB));
  await b.pg.click('#songMenuList .song-menu-go');
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
