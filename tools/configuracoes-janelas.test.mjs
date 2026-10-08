#!/usr/bin/env node
// ============================================================================
// AS DUAS JANELAS DE CONFIGURAÇÕES — "Tela" e "Transferir" (v1.11.7).
//
// ## Por que este oráculo existe
//
// Pedido do operador: a grade de Configurações tinha 13 tiles e passou a ter 8.
// Quatro deles (Preenchimento, Wallpaper, Fundo da letra, Girar no telão) moram
// agora numa JANELA aberta pelo tile "Tela"; Exportar e Importar moram noutra,
// aberta pelo tile "Transferir" — e a janela do Transferir mostra o que o
// aparelho já tem ANTES de pedir o arquivo. Mover um nó de lugar não deixa
// sintoma nenhum: tudo continua existindo, e as quatro falhas abaixo são todas
// MUDAS.
//
//  1. **A JANELA NASCE ATRÁS.** `#telaPopup` e `#pacotePopup` vêm ANTES de
//     `#fadePopup` no documento, e todo `.popup-backdrop` tem o mesmo degrau de
//     `z-index`: sem o `205` deles quem decide é a ORDEM DO DOCUMENTO, e a
//     janela abre debaixo de Configurações — o toque no tile "funciona" e a
//     tela não muda. A prova é HIT-TEST, nunca o `z-index` lido de volta.
//  2. **O VOLTAR E O ✕ DEIXAM DE VALER.** Quem os dá é UMA linha da tabela
//     `POPUPS`; sem ela a janela abre, não fecha por ✕, e o `__avBack` fecha
//     Configurações por baixo dela.
//  3. **A LISTAGEM DO IMPORTAR.** Ela é um passo ANTES do seletor de arquivos,
//     e o defeito é o seletor abrir direto — nada falha, a listagem só não
//     existe. A metade que impede o conserto largo demais: desistir (✕) NÃO
//     pode abrir o seletor, e o aparelho vazio tem de dizer que está vazio.
//  4. **O TRABALHO SEM SINAL.** Exportar leva minutos e a janela pode estar
//     FECHADA: o feedback dos dois botões (aro, percentual) mora num nó dentro
//     de `.popup-backdrop:not(.open)`, que não se vê. O tile da GRADE é o sinal,
//     e quem o pinta é `pacoteSinal()`, chamado por `pacoteRenderTiles()`.
//
// E o invariante 6 do shell, que o movimento do Wallpaper pode quebrar: ele
// continua sendo um `<label>` com o `<input type=file>` DENTRO — é a ativação
// nativa do rótulo que abre o `onShowFileChooser`.
//
//   node tools/configuracoes-janelas.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperar, esperarCortina, porque, checar, falhas } from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

// A PONTE, no padrão do `pacote-compartilhar`: toda chamada que o `native.js`
// faz por `call()` precisa estar na allowlist, ou prende o app pelos 60 s do
// CALL_TIMEOUT_MS sem dizer nada. `__chamadas` guarda a ORDEM do que o app
// pediu; `__segurar` segura o ACK da escrita — é o que deixa a exportação EM
// CURSO por tempo suficiente para medir o tile com a janela fechada.
// SEM CRASE NEM DOLAR-CHAVE NESTES COMENTARIOS: o texto mora dentro de um
// template literal.
const ponte = (opts) => `(function () {
  window.__saida = [];
  window.__chamadas = [];
  window.__espaco = ${(opts && opts.espaco) || 0};
  window.__prontoNoShell = ${JSON.stringify((opts && opts.prontoNoShell) || null)};
  const canal = {
    postMessage(m) {
      if (typeof m === 'string') {
        setTimeout(() => canal.onmessage({ data: JSON.stringify({ ok: true }) }), 0);
        return;
      }
      window.__saida.push(new Uint8Array(m));
      let total = 0;
      for (const p of window.__saida) total += p.length;
      const responder = () => canal.onmessage({ data: JSON.stringify({ r: total }) });
      if (window.__segurar) { (window.__presos = window.__presos || []).push(responder); return; }
      setTimeout(responder, 0);
    },
    onmessage: null,
  };
  window.__avPacote = canal;

  const vazio = { displays: [], listFolder: [], otaPending: '', otaDiag: '',
    espelhoEstado: { ligado: false, telas: [], redes: [] }, espelhoDiag: {},
    castTarget: { label: '' }, apkProcurar: {}, ytDiag: '', cifraDiag: '',
    farolEstado: { conta: true, ultimo: 0, diag: 'de teste' } };
  const comCallId = new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','castTarget','saidaDeAudioAlvo',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','apkProcurar','otaPending','otaApply',
    'otaCheck','otaDiag','ytDiag','cifraDiag','farolEstado','ytCanalPlaylists','ytPlaylist',
    'ytDetalhes','areaTransferencia','salvarTexto','cifraHtml','apkInstalar','espelhoCertImportar',
    'espelhoCertApagar','pacoteConsumirOrigem']);
  const bytesEscritos = () => {
    let t = 0;
    for (const p of (window.__saida || [])) t += p.length;
    return t;
  };
  const B = {
    shellVersion: () => 77,
    role: () => 'controle',
    appVersion: () => '9.99-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    compartilharTexto: () => {},
    bgProgress: () => {},
    pacoteCancelar: () => { window.__chamadas.push('cancelar'); },
    pacoteEspaco: (id) => {
      window.__chamadas.push('espaco');
      setTimeout(() => window.__avResolve(id, window.__espaco), 0);
    },
    pacoteCriar: (id) => {
      window.__chamadas.push('criar');
      setTimeout(() => window.__avResolve(id, 'acervo-pelo-saf.avpkg'), 0);
    },
    pacoteCriarLocal: (id) => {
      window.__chamadas.push('criarLocal');
      setTimeout(() => window.__avResolve(id, 'acervo-local.avpkg'), 0);
    },
    pacoteFechar: (id) => {
      window.__chamadas.push('fechar');
      setTimeout(() => window.__avResolve(id, bytesEscritos()), 0);
    },
    pacoteCompartilhar: (id) => {
      window.__chamadas.push('compartilhar');
      setTimeout(() => window.__avResolve(id, bytesEscritos()), 0);
    },
    pacoteDescartarPronto: () => { window.__chamadas.push('descartarPronto'); },
    pacoteProntoEstado: (id) => {
      setTimeout(() => window.__avResolve(id, window.__prontoNoShell || null), 0);
    },
    pacoteDiag: (id) => { setTimeout(() => window.__avResolve(id, 'de teste'), 0); },
    // O SELETOR DE ARQUIVOS: contar quantas vezes ele abre e a metade que
    // separa "listou antes" de "abriu direto".
    pickDoc: (id) => {
      window.__chamadas.push('pickDoc');
      setTimeout(() => window.__avResolve(id, []), 0);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','captureVolumeKeys','castTarget','saidaDeAudioAlvo',
    'deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar','espelhoCertEstado',
    'espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado','espelhoLigar',
    'keepAlive','listFolder','nowPlaying','openCast','abrirSaidaDeAudio','openExternal','otaApply','otaCheck',
    'otaDiag','otaPending','pickFolder','systemVolume','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio',
    'ytPlaylist','ytSearch','ytStream','farolEstado','projecaoLocal','cifraHtml',
    'cifraDiag','areaTransferencia','salvarTexto','ytDetalhes',
  ];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      if (!comCallId.has(n)) return undefined;
      const id = args[0];
      setTimeout(() => window.__avResolve(id, (n in vazio) ? vazio[n] : null), 0);
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

// Um aparelho. `opts === null` é o NAVEGADOR (sem ponte, sem `__NATIVE__`).
// Configurações fica ABERTA: as janelas nascem dela, e o tile só se toca com a
// folha à vista (um tile de folha fechada está fora da viewport).
async function aparelho(opts, antesDaCarga, viewport = { width: 430, height: 900 }) {
  const ctx = await navegador.newContext({ viewport, hasTouch: true });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(t);
  });
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  if (opts !== null) await pg.addInitScript(ponte(opts));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  if (antesDaCarga) await antesDaCarga(pg);
  return { ctx, pg };
}

async function abrirConfiguracoes(pg) {
  await pg.evaluate(() => { document.getElementById('simpleSettingsBtn').click(); });
  return esperar(pg, () => document.getElementById('fadePopup').classList.contains('open'), null, 10000);
}

// A TRANSIÇÃO de cada folha PRECISA ter assentado antes de medir — a régua do
// `verificacao-do-sistema` (I2): `getAnimations()` + `finished`, nunca duas
// amostras iguais em quadros seguidos.
const assentar = (pg, seletores) => pg.evaluate(async (sels) => {
  await Promise.all(sels.flatMap((s) => [...document.querySelectorAll(s)]
    .flatMap((n) => n.getAnimations().map((a) => a.finished.catch(() => {})))));
}, seletores);

// Um toque que não alcança o alvo é REPROVAÇÃO, não exceção: sem isto, uma
// reversão que impede a listagem de abrir derrubaria o processo num `click`
// sem mensagem útil em vez de dizer qual asserção reprovou.
async function tocar(pg, sel) {
  try { await pg.click(sel, { timeout: 8000 }); return true; } catch (e) {
    checar(false, 'o toque em ' + sel + ' alcança o alvo', e.message.split('\n')[0]);
    return false;
  }
}

const aberta = (pg, id) => pg.evaluate((i) => document.getElementById(i).classList.contains('open'), id);

// Toca no tile da grade e espera a janela abrir E assentar.
async function abrirJanela(pg, tile, popup) {
  await tocar(pg, tile);
  const r = await esperar(pg, (i) => document.getElementById(i).classList.contains('open'), popup, 10000);
  await assentar(pg, ['#' + popup + ' .popup-sheet', '#fadePopup .popup-sheet']);
  return r;
}

// QUEM ESTÁ POR CIMA no centro do cabeçalho da folha `sel`: o id do backdrop
// dono do nó que o hit-test devolve.
const donoDoCabecalho = (pg, sel) => pg.evaluate((s) => {
  const cab = document.querySelector(s + ' .popup-header');
  const r = cab.getBoundingClientRect();
  const fr = document.querySelector('#fadePopup .popup-sheet').getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const el = document.elementFromPoint(cx, cy);
  const dono = el && el.closest('.popup-backdrop');
  return { dono: dono ? dono.id : null, dentroDeConfig: cy < fr.bottom && cy > fr.top };
}, sel);

try {
  // =========================================================================
  // A · A GRADE: NOVE TILES, NA ORDEM, E O QUE É SÓ DO APP NÃO EXISTE NO NAVEGADOR
  // =========================================================================
  const ORDEM = ['temaTile', 'telaTile', 'saidaAudioTile', 'dadosMoveisTile',
    'edicaoTile', 'histOpenRow', 'testeTile', 'shareAppTile', 'pacoteTile'];
  const lerGrade = (pg) => pg.evaluate(() => {
    // `#fadePopup .qs-grade`, e não `.qs-grade` solto: as janelas vêm ANTES de
    // Configurações no documento, e é por isso que a classe delas é OUTRA.
    const g = document.querySelector('#fadePopup .qs-grade');
    return {
      ids: [...g.children].map((n) => n.id),
      escondidos: [...g.children].filter((n) => n.hidden).map((n) => n.id),
      primeiraGrade: (document.querySelector('.qs-grade') || {}).parentElement
        && document.querySelector('.qs-grade').closest('.popup-backdrop').id,
      colunasDaJanela: ['telaPopup', 'pacotePopup'].map((i) => getComputedStyle(
        document.querySelector('#' + i + ' .qs-grade-folha')).gridTemplateColumns.split(' ').length),
    };
  });

  const app = await aparelho({});
  await abrirConfiguracoes(app.pg);
  const gNativa = await lerGrade(app.pg);
  checar(JSON.stringify(gNativa.ids) === JSON.stringify(ORDEM),
    'A · a grade de Configurações tem os NOVE tiles, nesta ordem: preferências e '
    + 'telas primeiro, o grupo do APARELHO (compartilhar, transferir) por último',
    JSON.stringify(gNativa.ids));
  checar(gNativa.escondidos.length === 0,
    'A · e no app nenhum está escondido', JSON.stringify(gNativa.escondidos));
  checar(gNativa.primeiraGrade === 'fadePopup',
    'A · a PRIMEIRA `.qs-grade` do documento é a de Configurações — as janelas '
    + 'usam `.qs-grade-folha`, senão o `querySelector(".qs-grade")` de meia dúzia '
    + 'de oráculos mediria a grade da janela', gNativa.primeiraGrade);
  checar(gNativa.colunasDaJanela.every((n) => n === 2),
    'A · e a grade das duas janelas tem DUAS colunas — quatro tiles fecham 2x2, '
    + 'três deixariam um órfão', JSON.stringify(gNativa.colunasDaJanela));

  // ===== QUEM MORA DENTRO DE QUEM =====
  const casas = await app.pg.evaluate(() => {
    const dentro = (id, popup) => {
      const n = document.getElementById(id);
      return !!n && !!n.closest('#' + popup) && !n.closest('#fadePopup');
    };
    return {
      tela: ['fitTile', 'wallTile', 'lyricsBgTile', 'rotBtn'].map((i) => [i, dentro(i, 'telaPopup')]),
      pacote: ['pacoteExportarTile', 'pacoteImportarTile'].map((i) => [i, dentro(i, 'pacotePopup')]),
      naGrade: ['fitTile', 'wallTile', 'lyricsBgTile', 'rotBtn', 'pacoteExportarTile', 'pacoteImportarTile']
        .filter((i) => document.querySelector('#fadePopup .qs-grade #' + i)),
      sobrePopups: [...document.body.children].filter((n) => /^(telaPopup|pacotePopup)$/.test(n.id)).length,
    };
  });
  checar(casas.tela.every(([, ok]) => ok),
    'A · Preenchimento, Wallpaper, Fundo da letra e Girar no telão estão DENTRO de '
    + '#telaPopup — e fora de Configurações', JSON.stringify(casas.tela));
  checar(casas.pacote.every(([, ok]) => ok),
    'A · Exportar e Importar estão DENTRO de #pacotePopup — e fora de Configurações',
    JSON.stringify(casas.pacote));
  checar(casas.naGrade.length === 0,
    'A · e NENHUM dos seis sobrou na grade', JSON.stringify(casas.naGrade));
  checar(casas.sobrePopups === 2,
    'A · as duas janelas são irmãs diretas do `<body>` — dentro de `<main>` o '
    + 'Modo Fácil as esconderia junto (`body.mode-simple main { display: none }`)',
    casas.sobrePopups);
  await app.ctx.close();

  // O NAVEGADOR: sem ponte, três tiles não existem (não há o que chamar) — e as
  // outras janelas e o que ela guarda continuam alcançáveis.
  const nav = await aparelho(null);
  await abrirConfiguracoes(nav.pg);
  const gNav = await lerGrade(nav.pg);
  checar(JSON.stringify(gNav.ids) === JSON.stringify(ORDEM),
    'A · no navegador a ordem é a MESMA (o que muda é quem aparece)', JSON.stringify(gNav.ids));
  checar(JSON.stringify(gNav.escondidos.slice().sort())
      === JSON.stringify(['pacoteTile', 'saidaAudioTile', 'shareAppTile']),
    'A · sem ponte ficam escondidos Saída de áudio, Compartilhar e Transferir — '
    + 'SEIS tiles visíveis, e um tile que chamasse a ponte sem ela seria um '
    + 'botão que não faz nada', JSON.stringify(gNav.escondidos));
  checar((await nav.pg.evaluate(() => !!window.__NATIVE__)) === false,
    'A · PREMISSA: esta página NÃO tem ponte', 'tem');
  await nav.ctx.close();

  // =========================================================================
  // B · A JANELA ABRE SOBRE CONFIGURAÇÕES, E É ALCANÇÁVEL
  // =========================================================================
  //
  // O VIEWPORT É DE 440 DE ALTURA DE PROPÓSITO, e é a reversão que o escolheu:
  // Configurações mede 390 de altura e a janela do Transferir 134 — a 900 de
  // altura as duas folhas NÃO se sobrepõem em pixel nenhum (a janela fica na base,
  // Configurações no topo), o hit-test devolve a janela com ou sem `z-index`, e a
  // asserção passaria com o defeito. A 440 as duas disputam os mesmos pixels,
  // que é o único lugar onde a ordem das camadas aparece.
  const b = await aparelho({}, null, { width: 430, height: 440 });
  await abrirConfiguracoes(b.pg);
  for (const [nome, tile, popup, fecha] of [
    ['Tela', '#telaTile', 'telaPopup', '#telaPopupClose'],
    ['Transferir', '#pacoteTile', 'pacotePopup', '#pacotePopupClose'],
  ]) {
    const abriu = await abrirJanela(b.pg, tile, popup);
    checar(abriu === true, 'B · ' + nome + ' · tocar no tile abre a janela', porque(abriu));
    const conf = await aberta(b.pg, 'fadePopup');
    checar(conf === true,
      'B · ' + nome + ' · e Configurações CONTINUA aberta por baixo — a janela é '
      + 'uma folha de dentro dela, como o Histórico e a Verificação', String(conf));

    // ---- A CAMADA: HIT-TEST ----
    const camada = await donoDoCabecalho(b.pg, '#' + popup);
    checar(camada.dentroDeConfig === true,
      'B · ' + nome + ' · PREMISSA: o ponto medido está DENTRO da área de '
      + 'Configurações — senão a medição não prova nada sobre a disputa das duas '
      + 'camadas', JSON.stringify(camada));
    checar(camada.dono === popup,
      'B · ' + nome + ' · a janela PINTA POR CIMA de Configurações: o toque no '
      + 'cabeçalho dela alcança a PRÓPRIA folha. Sem o `z-index: 205` quem decide '
      + 'é a ordem do documento, e a janela vem ANTES de `#fadePopup`', JSON.stringify(camada));

    // ---- O VOLTAR (o degrau que a tabela POPUPS dá) ----
    const volta = await b.pg.evaluate((p) => {
      window.__avBack();
      return {
        janela: document.getElementById(p).classList.contains('open'),
        config: document.getElementById('fadePopup').classList.contains('open'),
      };
    }, popup);
    checar(!volta.janela && volta.config,
      'B · ' + nome + ' · o voltar fecha a JANELA e devolve Configurações, de onde '
      + 'ela nasceu — a tabela POPUPS é percorrida de trás para a frente',
      JSON.stringify(volta));

    // ---- O ✕ ----
    await abrirJanela(b.pg, tile, popup);
    await tocar(b.pg, fecha);
    const fechou = await esperar(b.pg, (i) => !document.getElementById(i).classList.contains('open'), popup, 10000);
    checar(fechou === true && (await aberta(b.pg, 'fadePopup')),
      'B · ' + nome + ' · o ✕ fecha só a janela', porque(fechou));

    // ---- O TOQUE NO FUNDO ----
    await abrirJanela(b.pg, tile, popup);
    // Alto da tela, longe das duas folhas: o que está sob o ponto é o BACKDROP
    // da janela (205), não o de Configurações.
    await b.pg.mouse.click(215, 3);
    const fundo = await esperar(b.pg, (i) => !document.getElementById(i).classList.contains('open'), popup, 10000);
    checar(fundo === true && (await aberta(b.pg, 'fadePopup')),
      'B · ' + nome + ' · o toque no fundo fecha só a janela — é a mesma linha da '
      + 'tabela que dá o ✕, o fundo e o voltar', porque(fundo));
  }
  await b.ctx.close();

  // =========================================================================
  // C · O WALLPAPER CONTINUA SENDO UM `<label>` — o invariante 6 do shell
  // =========================================================================
  const c = await aparelho({});
  await abrirConfiguracoes(c.pg);
  await abrirJanela(c.pg, '#telaTile', 'telaPopup');
  const forma = await c.pg.evaluate(() => {
    const w = document.getElementById('wallTile');
    const i = document.getElementById('wallFile');
    return { tag: w.tagName, filho: !!i && i.parentElement === w, tipo: i && i.type,
      dentro: !!w.closest('#telaPopup') };
  });
  checar(forma.tag === 'LABEL' && forma.filho && forma.tipo === 'file' && forma.dentro,
    'C · o Wallpaper é um <label> com o <input type=file> DENTRO dele, dentro da '
    + 'janela: é a ativação nativa do rótulo que abre o `onShowFileChooser` do '
    + 'WebView — um botão chamando `.click()` no input perderia o seletor',
    JSON.stringify(forma));
  // SEM IMAGEM PRÓPRIA: o toque deixa o rótulo abrir o seletor. Esta é a metade
  // que impede o conserto largo demais (cancelar SEMPRE).
  const [seletor] = await Promise.all([
    c.pg.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null),
    tocar(c.pg, '#wallTile'),
  ]);
  checar(!!seletor,
    'C · sem imagem própria o toque ABRE o seletor de arquivos — a ativação do '
    + 'rótulo atravessa a janela', 'nenhum seletor abriu');
  // COM IMAGEM PRÓPRIA: o toque VOLTA AO PADRÃO, e para isso o `preventDefault`
  // cancela a ativação do rótulo (senão o seletor abriria por cima do reset).
  const reset = await c.pg.evaluate(() => {
    customWallpaper = true;
    window.__resets = 0;
    window.setWallpaper = (arg) => { window.__resets++; window.__resetArg = arg; };
    window.__prevenido = null;
    document.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('#wallTile')) window.__prevenido = e.defaultPrevented;
    });
    return true;
  });
  let abriuSeletorComImagem = false;
  c.pg.once('filechooser', () => { abriuSeletorComImagem = true; });
  await tocar(c.pg, '#wallTile');
  const resetou = await esperar(c.pg, () => window.__resets >= 1 && window.__prevenido !== null, null, 10000);
  const estado = await c.pg.evaluate(() => ({ resets: window.__resets, arg: window.__resetArg,
    prevenido: window.__prevenido }));
  checar(resetou === true && estado.resets === 1 && estado.arg === null,
    'C · com imagem própria no ar o toque VOLTA AO PADRÃO (`setWallpaper(null)`), '
    + 'uma vez', JSON.stringify([reset, estado]));
  checar(estado.prevenido === true && !abriuSeletorComImagem,
    'C · e a ativação do rótulo é CANCELADA (`preventDefault`): sem isso o seletor '
    + 'abriria por cima do reset', JSON.stringify([estado, abriuSeletorComImagem]));
  await c.ctx.close();

  // =========================================================================
  // D · O TRANSFERIR: A LISTA JÁ ESTÁ À VISTA, E OS DOIS BOTÕES MORAM NA BASE
  // =========================================================================
  // Pedido do operador (v1.11.9), verbatim: *"inicialmente visível a lista de
  // coletâneas, e abaixo as duas opções de exportar/salvar e importar … em
  // ambos os casos a lista será vista, então já pode tornar ela visível
  // diretamente e ter apenas os dois botões de ações na base"*. A v1.11.7 abria
  // a lista DEPOIS do toque em cada botão (uma folha por cima da janela).
  const pickDocs = (pg) => pg.evaluate(() => window.__chamadas.filter((x) => x === 'pickDoc').length);
  const lerLista = (pg) => pg.evaluate(() => {
    const ul = document.getElementById('pacoteLista');
    const linhas = [...ul.querySelectorAll('.pacote-linha')];
    return {
      linhas: linhas.length,
      secoes: ul.querySelectorAll('.song-menu-grupo').length,
      caixas: ul.querySelectorAll('.song-menu-check').length,
      marcadas: ul.querySelectorAll('.song-menu-check.on').length,
      textos: linhas.map((l) => l.textContent),
      icones: linhas.map((l) => {
        const ic = l.querySelector('.song-menu-icon');
        // A linha de seleção (`songMenuItem`) recebe o `msym` e o PROMOVE a
        // `.song-menu-icon`: o ícone é o próprio <span>, não um filho dele.
        return { filho: !!(ic && (ic.classList.contains('msym') || ic.querySelector(':scope > .msym'))), texto: ic ? ic.textContent : '' };
      }),
      vazio: (ul.querySelector('li.empty') || {}).textContent || '',
      nota: (document.getElementById('pacoteNota') || {}).textContent || '',
      folhaAntigaAberta: document.getElementById('songMenuPopup').classList.contains('open'),
    };
  });
  const linhaPeloNome = (pg, nome) => pg.evaluate((n) => {
    const li = [...document.querySelectorAll('#pacoteLista li')]
      .find((x) => ((x.querySelector('.song-menu-label') || {}).textContent || '') === n);
    return !!li;
  }, nome);

  // ---- D1 · APARELHO NOVO: A LISTA DIZ QUE ESTÁ VAZIA, E OS DOIS BOTÕES ESTÃO LÁ ----
  const novo = await aparelho({});
  await abrirConfiguracoes(novo.pg);
  await abrirJanela(novo.pg, '#pacoteTile', 'pacotePopup');
  const abriuVazia = await esperar(novo.pg, () => !!document.querySelector('#pacoteLista li'), null, 20000);
  checar(abriuVazia === true,
    'D · a janela abre JÁ com a lista desenhada — sem toque nenhum', porque(abriuVazia));
  const vazia = await lerLista(novo.pg);
  checar(vazia.caixas === 4 && vazia.marcadas === 4
      && vazia.textos.slice(0, 2).every((t) => /sem vídeo da semana baixado/.test(t) && !/nada baixado/.test(t))
      && vazia.textos.slice(2).every((t) => /nada baixado neste aparelho/.test(t)),
    'D · um aparelho NOVO — o caso de uso do importar — mostra as coleções de BASE e TODAS '
    + 'marcadas: as SÉRIES com "sem vídeo da semana baixado" (a linha delas é o vídeo da semana, '
    + 'não a lista completa — v1.11.14) e os hinários com "nada baixado neste aparelho". A '
    + 'seleção vale também para IMPORTAR (v1.11.12), e uma lista em branco não deixaria marcar '
    + 'nada', JSON.stringify(vazia));
  checar(/ainda não tem biblioteca baixada/.test(vazia.nota) && /traz só o que estiver marcado/.test(vazia.nota)
      && !/Exportar leva/.test(vazia.nota),
    'D · e a nota abaixo da lista fala só do que serve a um aparelho novo '
    + '(a promessa do Importar, com a seleção), sem peso nenhum a exportar', JSON.stringify(vazia));
  checar(vazia.folhaAntigaAberta === false && (await pickDocs(novo.pg)) === 0,
    'D · e nada mais abriu: a folha "O que levar" e o seletor de arquivos não '
    + 'existem antes de um toque', JSON.stringify(vazia));

  // IMPORTAR É UM TOQUE SÓ, direto no seletor de arquivos — a listagem já foi vista.
  await tocar(novo.pg, '#pacoteImportarTile');
  const seguiu = await esperar(novo.pg, () => window.__chamadas.includes('pickDoc'), null, 20000);
  const antiga = await novo.pg.evaluate(() => document.getElementById('songMenuPopup').classList.contains('open'));
  checar(seguiu === true && (await pickDocs(novo.pg)) === 1 && antiga === false,
    'D · tocar em Importar abre o seletor de arquivos NA HORA, UMA vez — a lista '
    + 'que vinha antes dele é a própria janela', porque(seguiu) || await pickDocs(novo.pg));
  await novo.ctx.close();

  // ---- D2 · COM COLEÇÕES: AS LINHAS ESTÃO NA JANELA, COM CAIXA, E A NOTA DIZ O PESO ----
  // O catálogo de álbuns mora no `state` e é dele que `allCollections()` monta
  // a lista: semear pelo caminho de verdade, e recarregar para ele ser lido.
  const com = await aparelho({}, async (pg) => {
    await pg.evaluate(async () => {
      await AVDB.setState('albumCatalog', { categories: [],
        albums: [{ id_album: 'um', name: 'Álbum Um' }, { id_album: 'dois', name: 'Álbum Dois' }] });
    });
    await pg.reload({ waitUntil: 'domcontentloaded' });
    await esperarCortina(pg);
    await pg.evaluate(async () => {
      for (const [id, v] of [['um', 1], ['dois', 2]]) {
        await AVDB.opfsWriteFile('folders/album-' + id + '/faixa.m4a',
          new Blob([new Uint8Array(9000).fill(v)], { type: 'audio/mp4' }));
        await AVDB.fileAdd({ id: 'do-' + id, folder: 'album-' + id,
          opfsPath: 'folders/album-' + id + '/faixa.m4a', name: 'Faixa ' + id,
          type: 'audio/mp4', kind: 'audio', size: 9000, thumb: null, blob: null, url: null, addedAt: 1 });
      }
    });
  });
  await abrirConfiguracoes(com.pg);
  await abrirJanela(com.pg, '#pacoteTile', 'pacotePopup');
  // PREMISSA: as linhas aparecem SEM nenhum toque — é o pedido inteiro.
  const apareceu = await esperar(com.pg, () => !!document.querySelector('#pacoteLista .song-menu-grupo'), null, 20000);
  checar(apareceu === true,
    'D · com coleções no aparelho a lista aparece sozinha, assim que a janela abre',
    porque(apareceu));
  const fechada = await lerLista(com.pg);
  checar(fechada.secoes === 1 && fechada.marcadas === fechada.caixas && fechada.caixas > 0,
    'D · a seção da Biblioteca nasce FECHADA e com TUDO marcado — o que se faz '
    + 'aqui é tirar', JSON.stringify(fechada));
  checar(/^Exportar leva até /.test(fechada.nota) && /só acrescenta/.test(fechada.nota),
    'D · e a nota acima dos botões diz o PESO do que vai ("até X", o teto) e a '
    + 'promessa do Importar', fechada.nota);
  await tocar(com.pg, '#pacoteLista .pacote-seta');
  await esperar(com.pg, () => document.querySelectorAll('#pacoteLista .pacote-grupo-corpo .pacote-linha').length >= 2, null, 10000);
  const cheia = await lerLista(com.pg);
  checar(cheia.textos.some((t) => /Álbum Um/.test(t)) && cheia.textos.some((t) => /Álbum Dois/.test(t)),
    'D · a lista nomeia cada coleção do aparelho, uma linha por coleção',
    JSON.stringify(cheia.textos));
  checar(cheia.textos.filter((t) => !/nada baixado|sem vídeo da semana/.test(t)).every((t) => /até /.test(t)),
    'D · com o peso por linha em "até X", o teto', JSON.stringify(cheia.textos));
  // O ÍCONE É UM ELEMENTO, não um texto: `msym()` devolve um <span>, e atribuí-lo
  // a `innerHTML` o converte em "[object HTMLSpanElement]".
  checar(cheia.icones.length >= 2 && cheia.icones.every((i) => i.filho && !/object/i.test(i.texto)),
    'D · cada linha traz o ÍCONE (um `.msym` que veste `.song-menu-icon`) e nunca '
    + 'o texto "[object HTMLSpanElement]"', JSON.stringify(cheia.icones));
  checar(cheia.textos.every((t) => !/\[object/.test(t)),
    'D · e o texto da linha não contém "[object …]" em ponto nenhum', JSON.stringify(cheia.textos));
  // TIRAR UMA COLEÇÃO MUDA A NOTA: é a pergunta "cabe no cartão?" respondida a
  // cada toque, e sem ela a nota seria uma frase fixa.
  const notaAntes = cheia.nota;
  await com.pg.evaluate(() => {
    const li = [...document.querySelectorAll('#pacoteLista .pacote-linha')]
      .find((x) => ((x.querySelector('.song-menu-label') || {}).textContent || '') === 'Álbum Dois');
    li.querySelector('button').click();
  });
  const mudou = await esperar(com.pg, (antes) => document.getElementById('pacoteNota').textContent !== antes, notaAntes, 10000);
  const depois = await lerLista(com.pg);
  checar(mudou === true && depois.marcadas < cheia.marcadas,
    'D · desmarcar uma coleção MUDA o peso da nota — ela acompanha a escolha',
    porque(mudou) || JSON.stringify([notaAntes, depois.nota]));

  // ---- D3 · OS DOIS BOTÕES MORAM NA BASE, FORA DO SCROLLER, LADO A LADO ----
  const baseJ = await com.pg.evaluate(() => {
    const lista = document.getElementById('pacoteLista');
    const ex = document.getElementById('pacoteExportarTile');
    const im = document.getElementById('pacoteImportarTile');
    const re = ex.getBoundingClientRect(), ri = im.getBoundingClientRect(), rl = lista.getBoundingClientRect();
    return {
      mesmoFecho: !!ex.closest('.popup-fecho') && ex.closest('.popup-fecho') === im.closest('.popup-fecho'),
      foraDaLista: !lista.contains(ex) && !lista.contains(im),
      abaixoDaLista: +Math.min(re.top, ri.top).toFixed(1) - +rl.bottom.toFixed(1) >= 0,
      ladoALado: Math.abs(re.top - ri.top) < 1 && re.left < ri.left,
      mesmaAltura: Math.abs(re.height - ri.height) < 1,
      naTela: re.bottom <= innerHeight + 1 && ri.bottom <= innerHeight + 1 && re.height > 0,
      rotulos: [(ex.querySelector('.qs-titulo') || {}).textContent, (im.querySelector('.qs-titulo') || {}).textContent],
    };
  });
  checar(baseJ.mesmoFecho && baseJ.foraDaLista && baseJ.abaixoDaLista && baseJ.naTela,
    'D · Exportar e Importar são os dois botões da BASE: no `.popup-fecho`, FORA '
    + 'do scroller da lista e abaixo dela — com o acervo inteiro à vista eles não rolam',
    JSON.stringify(baseJ));
  checar(baseJ.ladoALado && baseJ.mesmaAltura && baseJ.rotulos[0] === 'Exportar' && baseJ.rotulos[1] === 'Importar',
    'D · lado a lado, na mesma altura (uma faixa de fecho com dois botões tem UMA '
    + 'altura), e com os rótulos de sempre', JSON.stringify(baseJ));

  // EXPORTAR É UM TOQUE SÓ, e leva o que está marcado: nenhuma folha abre por cima.
  await tocar(com.pg, '#pacoteExportarTile');
  const exportou = await esperar(com.pg,
    () => window.__chamadas.includes('criar') || window.__chamadas.includes('criarLocal'), null, 60000);
  const antigaExp = await com.pg.evaluate(() => document.getElementById('songMenuPopup').classList.contains('open'));
  checar(exportou === true && antigaExp === false,
    'D · tocar em Exportar começa a exportação NA HORA, sem folha por cima: a '
    + 'escolha é a marca que a lista já mostra', porque(exportou));
  await com.ctx.close();

  // =========================================================================
  // E · COM UM PACOTE PRONTO, O IMPORTAR É O DESCARTAR E NÃO ABRE A LISTAGEM
  // =========================================================================
  // A guarda da v1.8.42, copiada para o toque novo: o ouvinte permanente roda
  // JUNTO com o `onclick` que a coreografia instala no irmão, e sem
  // `pacotePronto` na guarda um toque em "Descartar" abriria a listagem POR
  // CIMA da confirmação.
  const pronto = await aparelho({ prontoNoShell: { nome: 'acervo-de-antes.avpkg', bytes: 4096 } });
  await esperar(pronto.pg, () => window.pacotePronto !== null, null, 15000);
  await abrirConfiguracoes(pronto.pg);
  const tilePronto = await pronto.pg.evaluate(() => {
    const t = document.getElementById('pacoteTile');
    return { estado: t.dataset.estado, alt: t.classList.contains('qs-alt'),
      trabalhando: t.classList.contains('qs-trabalhando'), aria: t.getAttribute('aria-label') || '',
      desenho: [...t.querySelectorAll('use')].filter((u) => getComputedStyle(u).display !== 'none')
        .map((u) => u.getAttribute('href')) };
  });
  checar(tilePronto.estado === 'pronto-para-enviar' && tilePronto.alt === true && !tilePronto.trabalhando,
    'E · com um pacote pronto o TILE DA GRADE diz isso com a janela fechada: '
    + 'data-estado "pronto-para-enviar" e o desenho de compartilhar (`qs-alt`)',
    JSON.stringify(tilePronto));
  checar(tilePronto.desenho.length === 1 && tilePronto.desenho[0] === '#icoCompartilhar',
    'E · medido no `display` computado dos <use>, que é onde o estado mora',
    JSON.stringify(tilePronto.desenho));
  checar(/pronto/.test(tilePronto.aria) && /\d/.test(tilePronto.aria),
    'E · e o `aria-label` diz o tamanho', tilePronto.aria);
  await abrirJanela(pronto.pg, '#pacoteTile', 'pacotePopup');
  const rotulo = await pronto.pg.evaluate(
    () => (document.querySelector('#pacoteImportarTile .qs-titulo') || {}).textContent.trim());
  checar(rotulo === 'Descartar',
    'E · e dentro da janela o irmão é o DESCARTAR', rotulo);
  await tocar(pronto.pg, '#pacoteImportarTile');
  const perguntou = await esperar(pronto.pg,
    () => document.getElementById('appDialog').classList.contains('open'), null, 20000);
  const listou = await aberta(pronto.pg, 'songMenuPopup');
  checar(perguntou === true && listou === false && (await pickDocs(pronto.pg)) === 0,
    'E · tocar nele PERGUNTA se descarta — e NÃO abre a listagem nem o seletor '
    + '(a guarda do `importarPacote`)', JSON.stringify([porque(perguntou), listou]));
  await pronto.pg.click('#appDialogCancel');
  await pronto.ctx.close();

  // =========================================================================
  // F · COM A JANELA FECHADA, O TRABALHO TEM SINAL NO TILE DA GRADE
  // =========================================================================
  const f = await aparelho({ espaco: 50 * 1024 * 1024 * 1024 });
  await f.pg.evaluate(async () => {
    await AVDB.opfsWriteFile('folders/x/a.m4a',
      new Blob([new Uint8Array(400000).fill(7)], { type: 'audio/mp4' }));
    // Um registro na pasta: sem ele o aparelho não tem biblioteca, a lista é a
    // frase de vazio, e não há linha nenhuma para a trava alcançar.
    await AVDB.fileAdd({ id: 'f-x', folder: 'x', opfsPath: 'folders/x/a.m4a', name: 'a',
      type: 'audio/mp4', kind: 'audio', size: 400000, thumb: null, blob: null, url: null, addedAt: 1 });
    window.__segurar = true;
    // Direto, sem a janela: sem lista aberta a função marca TUDO (o padrão).
    window.__fim = exportarPacote();
  });
  await esperar(f.pg, () => (window.__presos || []).length > 0, null, 30000);
  await abrirConfiguracoes(f.pg);
  // A JANELA NUNCA FOI ABERTA: os dois botões estão dentro de um backdrop sem
  // `.open`, onde o pulso recusa e a frase emprestada não se vê.
  const lerSinal = () => f.pg.evaluate(() => {
    const t = document.getElementById('pacoteTile');
    return { aro: t.classList.contains('qs-trabalhando'), estado: t.dataset.estado,
      titulo: (t.querySelector('.qs-titulo') || {}).textContent || '',
      aroPintado: getComputedStyle(t, '::after').content,
      janela: document.getElementById('pacotePopup').classList.contains('open'),
      exportando: pacoteExportando };
  });
  const comPct = await esperar(f.pg, () => /\d+%/.test(
    (document.querySelector('#pacoteTile .qs-titulo') || {}).textContent || ''), null, 30000);
  const sinal = await lerSinal();
  checar(sinal.janela === false && sinal.exportando === true,
    'F · PREMISSA: a exportação está em curso e a janela está FECHADA',
    JSON.stringify(sinal));
  checar(sinal.aro === true && sinal.estado === 'ocupado',
    'F · o tile da grade mostra o ARO de trabalho (`qs-trabalhando`, data-estado '
    + '"ocupado") — sem o sinal um trabalho de minutos fica mudo com a janela '
    + 'fechada, e o que resta é a notificação', JSON.stringify(sinal));
  checar(sinal.aroPintado !== 'none' && sinal.aroPintado !== 'normal',
    'F · e o aro é PINTADO (`::after` com conteúdo), não só uma classe',
    sinal.aroPintado);
  checar(comPct === true && /\d+%/.test(sinal.titulo),
    'F · e o título do tile carrega o PERCENTUAL, emprestado como o dos botões',
    porque(comPct) || sinal.titulo);

  // FECHAR A JANELA NO MEIO NÃO CANCELA: o trabalho é do módulo, não da janela.
  await abrirJanela(f.pg, '#pacoteTile', 'pacotePopup');
  // COM TRABALHO ANDANDO A LISTA SÓ SE OLHA (v1.11.9): as caixas apagam
  // (INDISPONÍVEL) e as linhas de marcar não respondem — mudar a escolha de
  // uma exportação que já está escrevendo seria uma mentira da tela.
  await esperar(f.pg, () => !!document.querySelector('#pacoteLista .pacote-linha'), null, 20000);
  const travada = await f.pg.evaluate(() => {
    const ul = document.getElementById('pacoteLista');
    const botoes = [...ul.querySelectorAll('.pacote-linha > button')];
    const cx = ul.querySelector('.song-menu-check');
    return { classe: ul.classList.contains('travada'), botoes: botoes.length,
      todosOff: botoes.every((b) => b.disabled),
      opacidade: cx ? +getComputedStyle(cx).opacity : -1 };
  });
  checar(travada.classe && travada.botoes > 0 && travada.todosOff && travada.opacidade < 0.5,
    'F · com a exportação andando a lista TRAVA: as linhas de marcar ficam '
    + '`disabled` e as caixas apagam (--op-inativo)', JSON.stringify(travada));
  await tocar(f.pg, '#pacotePopupClose');
  await esperar(f.pg, () => !document.getElementById('pacotePopup').classList.contains('open'), null, 10000);
  const depoisDeFechar = await lerSinal();
  const cancelou = await f.pg.evaluate(() => window.__chamadas.includes('cancelar'));
  checar(depoisDeFechar.exportando === true && depoisDeFechar.aro === true && !cancelou,
    'F · abrir e fechar a janela no meio NÃO cancela a exportação — cancelar é '
    + 'tocar no botão que trabalha, nunca fechar uma janela',
    JSON.stringify([depoisDeFechar, cancelou]));

  // O FIM: o aro apaga e o tile vira o PRONTO.
  await f.pg.evaluate(() => {
    window.__segurar = false;
    for (const r of (window.__presos || [])) r();
    window.__presos = [];
  });
  const terminou = await esperar(f.pg, () => {
    const t = document.getElementById('pacoteTile');
    return t.dataset.estado === 'pronto-para-enviar';
  }, null, 60000);
  const fim = await lerSinal();
  const fimAlt = await f.pg.evaluate(() => document.getElementById('pacoteTile').classList.contains('qs-alt'));
  const aindaTravada = await f.pg.evaluate(
    () => document.getElementById('pacoteLista').classList.contains('travada'));
  checar(aindaTravada === true,
    'F · e com o pacote PRONTO a lista continua travada: a escolha é a do pacote '
    + 'que espera para ser enviado, e só descartá-lo a devolve', String(aindaTravada));
  checar(terminou === true && fim.aro === false && fimAlt === true,
    'F · ao terminar o aro APAGA e o tile vira o pronto (desenho de compartilhar) '
    + '— os três estados do tile da grade: ocioso, ocupado, pronto',
    porque(terminou) || JSON.stringify([fim, fimAlt]));
  await f.ctx.close();

  // O estado OCIOSO é o de repouso: sem aro, sem alt.
  const repouso = await aparelho({});
  await abrirConfiguracoes(repouso.pg);
  const rep = await repouso.pg.evaluate(() => {
    const t = document.getElementById('pacoteTile');
    return { estado: t.dataset.estado, aro: t.classList.contains('qs-trabalhando'),
      alt: t.classList.contains('qs-alt'), oculto: t.hidden };
  });
  checar(rep.estado === 'ocioso' && !rep.aro && !rep.alt && !rep.oculto,
    'F · sem nada em curso o tile está OCIOSO — sem aro, sem desenho de compartilhar',
    JSON.stringify(rep));

  // =========================================================================
  // G · REABRIR A JANELA DURANTE A MEDIÇÃO NÃO APAGA O SINAL
  // =========================================================================
  // A medição leva segundos num acervo grande, e é TRABALHO ANDANDO
  // (`pacoteMedindo`): o tile da grade já o dizia, mas `openPacotePopup` chama
  // `pacoteRenderTiles` e o ramo ocioso do `pacoteRenderPar` apagava o aro e o
  // percentual do Exportar — a janela discordava da grade ao lado.
  // O estado é posto como o início da medição o põe (`exportarPacote`), e a janela
  // é aberta DEPOIS: é a reabertura que se mede.
  await repouso.pg.evaluate(() => {
    pacoteEmCurso = true; pacoteMedindo = true; pacotePercentualDito = -1;
    pacoteExportarTileEl.classList.add('qs-trabalhando');
    pacoteSinal();
    pacoteFalarPercentual(pacoteExportarTileEl, 0.37);
  });
  await abrirJanela(repouso.pg, '#pacoteTile', 'pacotePopup');
  const medindo = await repouso.pg.evaluate(() => {
    const ex = document.getElementById('pacoteExportarTile');
    const im = document.getElementById('pacoteImportarTile');
    const gr = document.getElementById('pacoteTile');
    const t = (el) => (el.querySelector('.qs-titulo') || {}).textContent || '';
    return {
      exportar: { aro: ex.classList.contains('qs-trabalhando'), titulo: t(ex), off: ex.disabled },
      importar: { aro: im.classList.contains('qs-trabalhando'), off: im.disabled },
      grade: { aro: gr.classList.contains('qs-trabalhando'), titulo: t(gr), estado: gr.dataset.estado },
    };
  });
  checar(medindo.exportar.aro === true && /37%/.test(medindo.exportar.titulo) && medindo.exportar.off === true,
    'G · reabrir a janela DURANTE A MEDIÇÃO mantém o ARO e o percentual no Exportar '
    + '(indisponível: não há o que cancelar) — o ramo ocioso os apagava',
    JSON.stringify(medindo));
  checar(medindo.importar.aro === false && medindo.importar.off === true,
    'G · e o Importar fica parado e indisponível, sem aro — ele não trabalha', JSON.stringify(medindo));
  checar(medindo.grade.aro === true && medindo.grade.estado === 'ocupado' && /37%/.test(medindo.grade.titulo),
    'G · e o tile da GRADE não perde o número: a janela e a grade dizem a MESMA coisa',
    JSON.stringify(medindo));
  await repouso.ctx.close();

  checar(erros.length === 0, 'nenhum erro de console', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
