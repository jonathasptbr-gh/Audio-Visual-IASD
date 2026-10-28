#!/usr/bin/env node
// ============================================================================
// AS SEÇÕES DE CONFIGURAÇÕES — Tela, Transferir, Editar mídia, Histórico e
// Verificação (janelas desde a v1.11.7, SEÇÕES desde a v1.12.48).
//
// ## Por que este oráculo existe
//
// Pedido do operador (v1.12.48): *"ao invés das opções de configurações abrirem
// em uma nova janela na base da tela, faça com que seus conteúdos abram dentro
// da janela original das configurações, abaixo dos botões … mas acima dos
// botões de versão e pedir ajuda"*, com o fechar de cada uma sem disputar com o
// ✕ de Configurações e as trocas ANIMADAS. As falhas que isto trava são todas
// MUDAS:
//
//  1. **DUAS ABERTAS.** Uma por vez é a regra; uma troca que esquecesse de
//     recolher a anterior empilharia as duas e a folha dobraria de altura.
//  2. **O VOLTAR FECHA CONFIGURAÇÕES POR CIMA DA SEÇÃO.** Ela foi aberta depois,
//     e o voltar a recolhe primeiro (`__avBack`); fechar Configurações a recolhe.
//  3. **UM SEGUNDO ✕.** O único ✕ grande é o da folha; cada seção recolhe por
//     um chevron SEM CAIXA no cabeçalho dela.
//  4. **A TROCA SECA.** Abrir, trocar e recolher animam a ALTURA da caixa das
//     seções (a folha vai junto) — e com `prefers-reduced-motion` não animam.
//  5. **A LISTAGEM DO IMPORTAR e O TRABALHO SEM SINAL** (os blocos D a G): a
//     lista do Transferir já está à vista quando a seção abre, e com ela
//     recolhida o tile da grade é o sinal do trabalho (`pacoteSinal()`).
//  6. **A BASE DA FOLHA** (o bloco H, v1.12.49): a faixa de fecho de borda a
//     borda (a tira do scroller aparecia nas calhas ao lado dela), sem pular no
//     fim da rolagem, com a sombra de "há mais abaixo" na borda dela; o estado da
//     Verificação acima da barra e o ritmo vertical; e o teto da folha acima dos
//     80%. Desde a v1.12.50: a versão (texto) e o pedir ajuda (ícone) no
//     cabeçalho da folha, e o cabeçalho da seção grudado no topo.
//  7. **A GRADE SOME** (v1.12.50, bloco B): com uma seção aberta o `#cfgTopo` sai
//     do layout e sobe para fora animado; recolher o devolve.
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
import { servirEstatico, abrirNavegador, esperar, esperarDb, esperarCortina, porque, checar, falhas, lerPng, pixel } from './arnes.mjs';

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
// Configurações fica ABERTA: as seções moram nela, e o tile só se toca com a
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

// Toca no tile da grade e espera a seção abrir E a caixa assentar.
async function abrirJanela(pg, tile, secao) {
  await tocar(pg, tile);
  const r = await esperar(pg, (i) => document.getElementById(i).classList.contains('open'), secao, 10000);
  await assentar(pg, ['#cfgSecoes', '#cfgSecoes .cfg-sec', '#fadePopup .popup-sheet']);
  return r;
}

try {
  // =========================================================================
  // A · A GRADE: NOVE TILES, NA ORDEM, E O QUE É SÓ DO APP NÃO EXISTE NO NAVEGADOR
  // =========================================================================
  const ORDEM = ['temaTile', 'telaTile', 'saidaAudioTile', 'dadosMoveisTile',
    'edicaoTile', 'histOpenRow', 'testeTile', 'shareAppTile', 'pacoteTile'];
  const lerGrade = (pg) => pg.evaluate(() => {
    // `#fadePopup .qs-grade`: a grade das seções é OUTRA classe
    // (`.qs-grade-folha`), e o `.qs-grade` solto tem de achar esta.
    const g = document.querySelector('#fadePopup .qs-grade');
    return {
      ids: [...g.children].map((n) => n.id),
      escondidos: [...g.children].filter((n) => n.hidden).map((n) => n.id),
      primeiraGrade: (document.querySelector('.qs-grade') || {}).parentElement
        && document.querySelector('.qs-grade').closest('.popup-backdrop').id,
      colunasDaJanela: ['tela', 'pacote'].map((nome) => {
        trocarSecao(nome, { animar: false });
        return getComputedStyle(document.querySelector('#' + nome + 'Secao .qs-grade-folha'))
          .gridTemplateColumns.split(' ').length;
      }),
      recolheu: (recolherSecao({ animar: false }), secaoAberta === ''),
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
    'A · a PRIMEIRA `.qs-grade` do documento é a de Configurações — as seções '
    + 'usam `.qs-grade-folha`, senão o `querySelector(".qs-grade")` de meia dúzia '
    + 'de oráculos mediria a grade de uma seção', gNativa.primeiraGrade);
  checar(gNativa.colunasDaJanela.every((n) => n === 2) && gNativa.recolheu,
    'A · e a grade das duas seções tem DUAS colunas — quatro tiles fecham 2x2, '
    + 'três deixariam um órfão', JSON.stringify(gNativa.colunasDaJanela));

  // ===== QUEM MORA DENTRO DE QUEM =====
  const SECOES = ['telaSecao', 'pacoteSecao', 'edicaoSecao', 'histSecao', 'testeSecao'];
  const casas = await app.pg.evaluate((secoes) => {
    const dentro = (id, sec) => {
      const n = document.getElementById(id);
      return !!n && !!n.closest('#' + sec) && !n.closest('.qs-grade');
    };
    const grade = document.querySelector('#fadePopup .qs-grade');
    const rodape = document.querySelector('#fadePopup .popup-footer');
    const SEGUE = Node.DOCUMENT_POSITION_FOLLOWING;
    return {
      tela: ['fitTile', 'wallTile', 'lyricsBgTile', 'rotBtn'].map((i) => [i, dentro(i, 'telaSecao')]),
      pacote: ['pacoteExportarTile', 'pacoteImportarTile'].map((i) => [i, dentro(i, 'pacoteSecao')]),
      naGrade: ['fitTile', 'wallTile', 'lyricsBgTile', 'rotBtn', 'pacoteExportarTile', 'pacoteImportarTile']
        .filter((i) => document.querySelector('#fadePopup .qs-grade #' + i)),
      // ENTRE A GRADE E O RODAPÉ, dentro da parte que rola de Configurações.
      lugar: secoes.map((s) => {
        const n = document.getElementById(s);
        return [s, !!n && !!n.closest('#fadePopup .fade-opts')
          && !!(grade.compareDocumentPosition(n) & SEGUE)
          && !!(n.compareDocumentPosition(rodape) & SEGUE)];
      }),
      // As folhas de antes não existem mais.
      folhasVelhas: ['telaPopup', 'pacotePopup', 'edicaoPopup', 'histPopup', 'testePopup']
        .filter((i) => document.getElementById(i)),
    };
  }, SECOES);
  checar(casas.tela.every(([, ok]) => ok),
    'A · Preenchimento, Wallpaper, Fundo da letra e Girar no telão estão DENTRO de '
    + '#telaSecao — e fora da grade', JSON.stringify(casas.tela));
  checar(casas.pacote.every(([, ok]) => ok),
    'A · Exportar e Importar estão DENTRO de #pacoteSecao — e fora da grade',
    JSON.stringify(casas.pacote));
  checar(casas.naGrade.length === 0,
    'A · e NENHUM dos seis sobrou na grade', JSON.stringify(casas.naGrade));
  checar(casas.lugar.every(([, ok]) => ok) && casas.folhasVelhas.length === 0,
    'A · as CINCO seções moram DENTRO de Configurações, depois da grade (e antes do '
    + 'rodapé, que desde a v1.12.49 só existe com a atualização adiada ou no navegador) — '
    + 'e as cinco folhas de baixo de antes não existem mais',
    JSON.stringify(casas));
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
  // B · A SEÇÃO ABRE DENTRO DE CONFIGURAÇÕES, UMA POR VEZ, E A GRADE SOME
  // =========================================================================
  //
  // Desde a v1.12.50 a grade (`#cfgTopo`) SAI DO LAYOUT com uma seção aberta e o
  // cabeçalho da seção fica logo abaixo do cabeçalho da folha — *"faça com que a
  // zona dos botões originais das configurações seja oculta"*. O VIEWPORT É BAIXO
  // (440) DE PROPÓSITO: com a grade de pé a seção nasceria abaixo da dobra, e é aí
  // que "o cabeçalho no topo" separa grade escondida de grade apenas rolada.
  const b = await aparelho({}, null, { width: 430, height: 440 });
  await abrirConfiguracoes(b.pg);
  const estadoB = () => b.pg.evaluate(() => ({
    aberta: secaoAberta,
    abertas: [...document.querySelectorAll('#cfgSecoes .cfg-sec')].filter((s) => !s.hidden).map((s) => s.id),
    expandidos: [...document.querySelectorAll('#fadePopup .qs-grade [aria-expanded="true"]')].map((n) => n.id),
    config: document.getElementById('fadePopup').classList.contains('open'),
    // A GRADE: fora do layout (o `hidden` do `#cfgTopo` e caixa zero), não só rolada.
    gradeFora: document.getElementById('cfgTopo').hidden
      && document.querySelector('#fadePopup .qs-grade').getClientRects().length === 0,
  }));
  const TILES = [['Tela', '#telaTile', 'telaSecao', 'tela'], ['Transferir', '#pacoteTile', 'pacoteSecao', 'pacote'],
    ['Editar mídia', '#edicaoTile', 'edicaoSecao', 'edicao'], ['Histórico', '#histOpenRow', 'histSecao', 'hist'],
    ['Verificação', '#testeTile', 'testeSecao', 'teste']];
  for (const [nome, tile, secao, chave] of TILES) {
    const antes = await estadoB();
    checar(!antes.gradeFora && antes.aberta === '',
      'B · ' + nome + ' · PREMISSA: a grade está à vista antes do toque', JSON.stringify(antes));
    const abriu = await abrirJanela(b.pg, tile, secao);
    const e = await estadoB();
    checar(abriu === true && e.aberta === chave && e.abertas.length === 1 && e.abertas[0] === secao,
      'B · ' + nome + ' · tocar no tile abre a seção — e SÓ ela', JSON.stringify(e));
    checar(e.config === true && e.expandidos.length === 1 && e.expandidos[0] === tile.slice(1),
      'B · ' + nome + ' · Configurações continua aberta e o tile diz `aria-expanded` (o aberto '
      + 'não é cor — é o corpo à vista)', JSON.stringify(e));
    checar(e.gradeFora === true,
      'B · ' + nome + ' · com a seção aberta a GRADE SAI DO LAYOUT (o modo e os tiles), não só rola',
      JSON.stringify(e));
    // O CABEÇALHO DA SEÇÃO É O PRIMEIRO À VISTA, colado ao cabeçalho da folha, e o
    // toque nele chega à própria seção.
    const vista = await b.pg.evaluate((s) => {
      const cab = document.querySelector('#' + s + ' .cfg-sec-cab').getBoundingClientRect();
      const topo = document.querySelector('#fadePopup .popup-header').getBoundingClientRect();
      const el = document.elementFromPoint(cab.left + cab.width / 2, cab.top + cab.height / 2);
      return { cab: cab.top, folha: topo.bottom,
        dono: el && el.closest('.cfg-sec') ? el.closest('.cfg-sec').id : null };
    }, secao);
    checar(Math.abs(vista.cab - vista.folha) <= 1 && vista.dono === secao,
      'B · ' + nome + ' · o cabeçalho da seção fica logo abaixo do cabeçalho de Configurações, e o '
      + 'toque nele chega à própria seção', JSON.stringify(vista));
    // RECOLHER DEVOLVE A GRADE: o chevron, e na Verificação (cujo chevron some
    // enquanto ela anda) o voltar.
    if (chave === 'teste') await b.pg.evaluate(() => window.__avBack());
    else await tocar(b.pg, '#' + secao + ' .cfg-sec-recolher');
    await assentar(b.pg, ['#cfgSecoes', '#cfgSecoes .cfg-sec', '#cfgTopo']);
    const r = await estadoB();
    checar(r.aberta === '' && r.abertas.length === 0 && !r.gradeFora && r.config,
      'B · ' + nome + ' · recolher (' + (chave === 'teste' ? 'voltar' : 'chevron')
      + ') devolve a GRADE, e Configurações fica', JSON.stringify(r));
  }

  // ---- NENHUM ✕ DENTRO DAS SEÇÕES ----
  const fechos = await b.pg.evaluate(() => ({
    xSecoes: document.querySelectorAll('#cfgSecoes .popup-close').length,
    xFolha: document.querySelectorAll('#fadePopup .popup-close').length,
    chevrons: [...document.querySelectorAll('#cfgSecoes .cfg-sec')].map((s) => !!s.querySelector(':scope > .cfg-sec-cab > .cfg-sec-recolher')),
    // O chevron NÃO tem caixa: fundo transparente, ao contrário do ✕ da folha.
    fundoChevron: getComputedStyle(document.querySelector('#cfgSecoes .cfg-sec-recolher')).backgroundColor,
    fundoX: getComputedStyle(document.getElementById('fadePopupClose')).backgroundColor,
  }));
  checar(fechos.xSecoes === 0 && fechos.xFolha === 1 && fechos.chevrons.every(Boolean)
      && /rgba\(0, 0, 0, 0\)|transparent/.test(fechos.fundoChevron) && fechos.fundoChevron !== fechos.fundoX,
    'B · o ÚNICO ✕ é o de Configurações: cada seção recolhe por um chevron SEM CAIXA no '
    + 'cabeçalho dela — não disputa com o ✕ da folha', JSON.stringify(fechos));

  // ---- A TROCA ANIMA, E NUNCA HÁ DUAS ----
  await b.pg.evaluate(() => { document.querySelector('#fadePopup .fade-opts').scrollTop = 0; });
  await abrirJanela(b.pg, '#telaTile', 'telaSecao');
  // A TROCA não tem porta na tela (os tiles somem com a grade), mas a conta existe
  // (`trocarSecao` com outra aberta): ela só cruza as seções, e a grade NÃO volta.
  const troca = await b.pg.evaluate(async () => {
    const box = document.getElementById('cfgSecoes');
    trocarSecao('hist');
    const gradeNaTroca = [];
    const animando = box.getAnimations().some((a) => a.effect && a.effect.getKeyframes().some((k) => 'height' in k));
    const amostras = [];
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      amostras.push([...box.querySelectorAll('.cfg-sec')].filter((s) => !s.hidden && !s.classList.contains('saindo')).length);
      gradeNaTroca.push(document.getElementById('cfgTopo').hidden);
    }
    await Promise.all(box.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {})));
    return { animando, amostras, gradeNaTroca, saindo: box.querySelectorAll('.saindo').length,
      visiveis: [...box.querySelectorAll('.cfg-sec')].filter((s) => !s.hidden).map((s) => s.id) };
  });
  checar(troca.animando === true,
    'B · trocar de seção ANIMA a altura da caixa (WAAPI em `height`)', JSON.stringify(troca));
  checar(troca.amostras.every((n) => n === 1) && troca.saindo === 0 && troca.visiveis.length === 1 && troca.visiveis[0] === 'histSecao',
    'B · e durante a troca há UMA seção de pé a cada quadro (a que sai é `.saindo`, absoluta '
    + 'por cima), e no fim só a nova', JSON.stringify(troca));
  checar(troca.gradeNaTroca.every(Boolean),
    'B · e a troca entre seções NÃO devolve a grade em quadro nenhum', JSON.stringify(troca.gradeNaTroca));

  // ---- O VOLTAR RECOLHE ANTES DE FECHAR ----
  const volta = await b.pg.evaluate(() => {
    const um = window.__avBack();
    const depoisUm = { secao: secaoAberta, config: document.getElementById('fadePopup').classList.contains('open'),
      grade: !document.getElementById('cfgTopo').hidden };
    const dois = window.__avBack();
    return { um, depoisUm, dois, configFim: document.getElementById('fadePopup').classList.contains('open') };
  });
  checar(volta.um === true && volta.depoisUm.secao === '' && volta.depoisUm.config === true && volta.depoisUm.grade
      && volta.dois === true && volta.configFim === false,
    'B · o voltar RECOLHE a seção primeiro (Configurações fica) e só o segundo fecha a folha',
    JSON.stringify(volta));

  // ---- FECHAR CONFIGURAÇÕES RECOLHE A SEÇÃO ----
  await abrirConfiguracoes(b.pg);
  await assentar(b.pg, ['#fadePopup .popup-sheet']);
  await abrirJanela(b.pg, '#telaTile', 'telaSecao');
  await b.pg.evaluate(() => { document.querySelector('#fadePopup .fade-opts').scrollTop = 0; });
  await tocar(b.pg, '#fadePopupClose');
  const folhaFechou = await esperar(b.pg, () => !document.getElementById('fadePopup').classList.contains('open'), null, 5000);
  const aposFechar = await b.pg.evaluate(() => ({ secao: secaoAberta,
    abertas: [...document.querySelectorAll('#cfgSecoes .cfg-sec')].filter((s) => !s.hidden).length,
    grade: !document.getElementById('cfgTopo').hidden }));
  checar(folhaFechou === true && aposFechar.secao === '' && aposFechar.abertas === 0 && aposFechar.grade,
    'B · fechar Configurações pelo ✕ recolhe a seção aberta — a próxima abertura começa na grade',
    JSON.stringify(aposFechar));
  await b.ctx.close();

  // ---- ABRIR ANIMA: A GRADE SOBE PARA FORA E A FOLHA ACOMPANHA ----
  // A 900 de altura, longe do teto: a folha vai da altura da grade à da seção
  // passando por alturas intermediárias, e a grade sai por `margin-top` negativo
  // (sobe), em vez de sumir num quadro.
  const alta = await aparelho({}, null, { width: 430, height: 900 });
  await abrirConfiguracoes(alta.pg);
  await assentar(alta.pg, ['#fadePopup .popup-sheet']);
  const cresce = await alta.pg.evaluate(async () => {
    const folha = document.querySelector('#fadePopup .popup-sheet');
    const topo = document.getElementById('cfgTopo');
    const f0 = folha.getBoundingClientRect().height;
    const t0 = topo.getBoundingClientRect().top;
    document.getElementById('telaTile').click();
    const box = document.getElementById('cfgSecoes');
    const meio = [];
    const topos = [];
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      meio.push(folha.getBoundingClientRect().height);
      topos.push(topo.hidden ? null : topo.getBoundingClientRect().top);
    }
    await Promise.all([...box.getAnimations({ subtree: true }), ...topo.getAnimations()].map((a) => a.finished.catch(() => {})));
    return { f0, t0, meio, topos, f1: folha.getBoundingClientRect().height, fim: topo.hidden };
  });
  const lo = Math.min(cresce.f0, cresce.f1), hi = Math.max(cresce.f0, cresce.f1);
  checar(Math.abs(cresce.f1 - cresce.f0) > 50 && cresce.meio.some((h) => h > lo + 1 && h < hi - 1),
    'B · a folha muda de altura com a seção (da grade para a seção) passando por alturas '
    + 'intermediárias — acompanha a animação, não salta', JSON.stringify(cresce));
  checar(cresce.topos.some((t) => t !== null && t < cresce.t0 - 1) && cresce.fim === true,
    'B · e a GRADE SOBE para fora (o topo dela anda para cima durante a animação) antes de sair do layout',
    JSON.stringify(cresce));
  await alta.ctx.close();

  // ---- SEM MOVIMENTO, NÃO ANIMA ----
  const quieto = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true, reducedMotion: 'reduce' });
  await semRedeExterna(quieto);
  const qpg = await quieto.newPage();
  await qpg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(qpg);
  await abrirConfiguracoes(qpg);
  const semAnim = await qpg.evaluate(() => {
    document.getElementById('telaTile').click();
    const n1 = document.getElementById('cfgSecoes').getAnimations({ subtree: true }).length;
    document.getElementById('histOpenRow').click();
    const n2 = document.getElementById('cfgSecoes').getAnimations({ subtree: true }).length;
    return { n1, n2, secao: secaoAberta, abertas: [...document.querySelectorAll('#cfgSecoes .cfg-sec')].filter((s) => !s.hidden).length,
      topo: document.getElementById('cfgTopo').getAnimations().length, grade: document.getElementById('cfgTopo').hidden };
  });
  checar(semAnim.n1 === 0 && semAnim.n2 === 0 && semAnim.topo === 0 && semAnim.grade && semAnim.secao === 'hist' && semAnim.abertas === 1,
    'B · com `prefers-reduced-motion` a seção abre e troca SEM animação, no mesmo estado final',
    JSON.stringify(semAnim));
  await quieto.close();

  // =========================================================================
  // C · O WALLPAPER CONTINUA SENDO UM `<label>` — o invariante 6 do shell
  // =========================================================================
  const c = await aparelho({});
  await abrirConfiguracoes(c.pg);
  await abrirJanela(c.pg, '#telaTile', 'telaSecao');
  const forma = await c.pg.evaluate(() => {
    const w = document.getElementById('wallTile');
    const i = document.getElementById('wallFile');
    return { tag: w.tagName, filho: !!i && i.parentElement === w, tipo: i && i.type,
      dentro: !!w.closest('#telaSecao') };
  });
  checar(forma.tag === 'LABEL' && forma.filho && forma.tipo === 'file' && forma.dentro,
    'C · o Wallpaper é um <label> com o <input type=file> DENTRO dele, dentro da '
    + 'seção: é a ativação nativa do rótulo que abre o `onShowFileChooser` do '
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
    + 'rótulo atravessa a seção', 'nenhum seletor abriu');
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
  // a lista DEPOIS do toque em cada botão (uma folha por cima da seção).
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
  await abrirJanela(novo.pg, '#pacoteTile', 'pacoteSecao');
  const abriuVazia = await esperar(novo.pg, () => !!document.querySelector('#pacoteLista li'), null, 20000);
  checar(abriuVazia === true,
    'D · a seção abre JÁ com a lista desenhada — sem toque nenhum', porque(abriuVazia));
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
    + 'que vinha antes dele é a própria seção', porque(seguiu) || await pickDocs(novo.pg));
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
  await abrirJanela(com.pg, '#pacoteTile', 'pacoteSecao');
  // PREMISSA: as linhas aparecem SEM nenhum toque — é o pedido inteiro.
  const apareceu = await esperar(com.pg, () => !!document.querySelector('#pacoteLista .song-menu-grupo'), null, 20000);
  checar(apareceu === true,
    'D · com coleções no aparelho a lista aparece sozinha, assim que a seção abre',
    porque(apareceu));
  const fechada = await lerLista(com.pg);
  checar(fechada.secoes === 1 && fechada.marcadas === fechada.caixas && fechada.caixas > 0,
    'D · a seção da Biblioteca nasce FECHADA e com TUDO marcado — o que se faz '
    + 'aqui é tirar', JSON.stringify(fechada));
  checar(/^Exportar leva até /.test(fechada.nota) && /só acrescenta/.test(fechada.nota),
    'D · e a nota acima dos botões diz o PESO do que vai ("até X", o teto) e a '
    + 'promessa do Importar', fechada.nota);
  await tocar(com.pg, '#pacoteLista .pacote-seta');
  // ESPERAR PELAS DUAS LINHAS SEMEADAS, e LER o desfecho da espera. Os álbuns
  // moram no corpo da seção, que só existe depois do toque na seta (acordeão
  // animado); a espera antiga era "≥ 2 linhas no corpo" com 10 s e o resultado
  // DESCARTADO — no runner a seção não estava aberta a tempo, a lista foi lida com o
  // corpo ainda vazio (só os hinários e as séries, que são linhas soltas) e a
  // falha saiu como exceção no `li.querySelector` abaixo (run 40759983512).
  const linhasDosAlbuns = await esperar(com.pg, () => {
    const t = [...document.querySelectorAll('#pacoteLista .pacote-grupo-corpo .pacote-linha')]
      .map((li) => li.textContent || '');
    return t.some((x) => /Álbum Um/.test(x)) && t.some((x) => /Álbum Dois/.test(x));
  }, null, 20000);
  const cheia = await lerLista(com.pg);
  checar(linhasDosAlbuns === true && cheia.textos.some((t) => /Álbum Um/.test(t)) && cheia.textos.some((t) => /Álbum Dois/.test(t)),
    'D · a lista nomeia cada coleção do aparelho, uma linha por coleção',
    porque(linhasDosAlbuns) || JSON.stringify(cheia.textos));
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
    if (li) li.querySelector('button').click();
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
    const fecho = ex.closest('.popup-fecho');
    const sc = document.querySelector('#fadePopup .fade-opts').getBoundingClientRect();
    return {
      mesmoFecho: !!ex.closest('.popup-fecho') && ex.closest('.popup-fecho') === im.closest('.popup-fecho'),
      foraDaLista: !lista.contains(ex) && !lista.contains(im),
      // ABAIXO DA LISTA, ou GRUDADO na base da folha com a lista passando por
      // baixo (`sticky`, v1.12.48) — nos dois casos à vista e fora dela.
      abaixoDaLista: +Math.min(re.top, ri.top).toFixed(1) - +rl.bottom.toFixed(1) >= 0
        || (!!fecho && Math.abs(fecho.getBoundingClientRect().bottom - sc.bottom) <= 1),
      ladoALado: Math.abs(re.top - ri.top) < 1 && re.left < ri.left,
      mesmaAltura: Math.abs(re.height - ri.height) < 1,
      naTela: re.bottom <= sc.bottom + 1 && ri.bottom <= sc.bottom + 1 && re.top >= sc.top - 1 && re.height > 0,
      rotulos: [(ex.querySelector('.qs-titulo') || {}).textContent, (im.querySelector('.qs-titulo') || {}).textContent],
    };
  });
  checar(baseJ.mesmoFecho && baseJ.foraDaLista && baseJ.abaixoDaLista && baseJ.naTela,
    'D · Exportar e Importar são os dois botões da BASE: no `.popup-fecho`, FORA '
    + 'da lista, abaixo dela ou grudados na base da folha — com o acervo inteiro à vista '
    + 'eles não somem rolando',
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
    'E · com um pacote pronto o TILE DA GRADE diz isso com a seção recolhida: '
    + 'data-estado "pronto-para-enviar" e o desenho de compartilhar (`qs-alt`)',
    JSON.stringify(tilePronto));
  checar(tilePronto.desenho.length === 1 && tilePronto.desenho[0] === '#icoCompartilhar',
    'E · medido no `display` computado dos <use>, que é onde o estado mora',
    JSON.stringify(tilePronto.desenho));
  checar(/pronto/.test(tilePronto.aria) && /\d/.test(tilePronto.aria),
    'E · e o `aria-label` diz o tamanho', tilePronto.aria);
  await abrirJanela(pronto.pg, '#pacoteTile', 'pacoteSecao');
  const rotulo = await pronto.pg.evaluate(
    () => (document.querySelector('#pacoteImportarTile .qs-titulo') || {}).textContent.trim());
  checar(rotulo === 'Descartar',
    'E · e dentro da seção o irmão é o DESCARTAR', rotulo);
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
    // Direto, sem a seção: sem lista aberta a função marca TUDO (o padrão).
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
      janela: document.getElementById('pacoteSecao').classList.contains('open'),
      exportando: pacoteExportando };
  });
  const comPct = await esperar(f.pg, () => /\d+%/.test(
    (document.querySelector('#pacoteTile .qs-titulo') || {}).textContent || ''), null, 30000);
  const sinal = await lerSinal();
  checar(sinal.janela === false && sinal.exportando === true,
    'F · PREMISSA: a exportação está em curso e a seção está RECOLHIDA',
    JSON.stringify(sinal));
  checar(sinal.aro === true && sinal.estado === 'ocupado',
    'F · o tile da grade mostra o ARO de trabalho (`qs-trabalhando`, data-estado '
    + '"ocupado") — sem o sinal um trabalho de minutos fica mudo com a seção '
    + 'fechada, e o que resta é a notificação', JSON.stringify(sinal));
  checar(sinal.aroPintado !== 'none' && sinal.aroPintado !== 'normal',
    'F · e o aro é PINTADO (`::after` com conteúdo), não só uma classe',
    sinal.aroPintado);
  checar(comPct === true && /\d+%/.test(sinal.titulo),
    'F · e o título do tile carrega o PERCENTUAL, emprestado como o dos botões',
    porque(comPct) || sinal.titulo);

  // RECOLHER A SEÇÃO NO MEIO NÃO CANCELA: o trabalho é do módulo, não da seção.
  await abrirJanela(f.pg, '#pacoteTile', 'pacoteSecao');
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
  await tocar(f.pg, '#pacoteSecao .cfg-sec-recolher');
  await esperar(f.pg, () => !document.getElementById('pacoteSecao').classList.contains('open'), null, 10000);
  const depoisDeFechar = await lerSinal();
  const cancelou = await f.pg.evaluate(() => window.__chamadas.includes('cancelar'));
  checar(depoisDeFechar.exportando === true && depoisDeFechar.aro === true && !cancelou,
    'F · abrir e recolher a seção no meio NÃO cancela a exportação — cancelar é '
    + 'tocar no botão que trabalha, nunca recolher uma seção',
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
  // (`pacoteMedindo`): o tile da grade já o dizia, mas `aoAbrirPacote` chama
  // `pacoteRenderTiles` e o ramo ocioso do `pacoteRenderPar` apagava o aro e o
  // percentual do Exportar — a seção discordava da grade ao lado.
  // O estado é posto como o início da medição o põe (`exportarPacote`), e a seção
  // é aberta DEPOIS: é a reabertura que se mede.
  await repouso.pg.evaluate(() => {
    pacoteEmCurso = true; pacoteMedindo = true; pacotePercentualDito = -1;
    pacoteExportarTileEl.classList.add('qs-trabalhando');
    pacoteSinal();
    pacoteFalarPercentual(pacoteExportarTileEl, 0.37);
  });
  await abrirJanela(repouso.pg, '#pacoteTile', 'pacoteSecao');
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
    'G · reabrir a seção DURANTE A MEDIÇÃO mantém o ARO e o percentual no Exportar '
    + '(indisponível: não há o que cancelar) — o ramo ocioso os apagava',
    JSON.stringify(medindo));
  checar(medindo.importar.aro === false && medindo.importar.off === true,
    'G · e o Importar fica parado e indisponível, sem aro — ele não trabalha', JSON.stringify(medindo));
  checar(medindo.grade.aro === true && medindo.grade.estado === 'ocupado' && /37%/.test(medindo.grade.titulo),
    'G · e o tile da GRADE não perde o número: a seção e a grade dizem a MESMA coisa',
    JSON.stringify(medindo));
  await repouso.ctx.close();


  // =========================================================================
  // H · A BASE DA FOLHA, A VERIFICAÇÃO E O TETO (v1.12.49)
  // =========================================================================
  //
  // Pedido do operador: *"Coloque o texto 'verificando...' E 'tudo certo' acima da
  // barra"*, *"muito amontoados verticalmente"*, *"os botões de versão e pedir
  // ajuda, dentro apenas da seção de verificação"*, *"vi bugs visuais na área do
  // histórico … a sombra de fronteiras de lista e o espaçamento da base antes dos
  // botões do rodapé"* e *"permita essa janela de configurações ficar maior em
  // altura"*. A CÉLULA É 360×740: é a que o operador usa, e o Histórico de trinta
  // linhas transborda nela com folga.
  const h = await aparelho({}, null, { width: 360, height: 740 });
  await abrirConfiguracoes(h.pg);
  const sonda = (pg, expr) => pg.evaluate((e) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;visibility:hidden;height:' + e;
    document.body.appendChild(d);
    const v = d.getBoundingClientRect().height; d.remove(); return v;
  }, expr);
  const sp6 = await sonda(h.pg, 'var(--sp-6)');
  const baseFolha = await sonda(h.pg, '.9rem');

  // ---- H1 · A VERSÃO E O PEDIR AJUDA SÃO DO CABEÇALHO DA FOLHA (v1.12.50), E O RODAPÉ SOME ----
  // *"colocar o botão de versão no topo, ao lado do título de configurações, mas não
  // torne ele um botão explícito, mas apenas as letras … ao lado do botão de fechar
  // configurações, coloque um botão de apenas ícone, com ícone de mensagem"*.
  const casa = await h.pg.evaluate(() => {
    const ft = document.querySelector('#fadePopup .popup-footer');
    const cab = document.querySelector('#fadePopup .popup-header');
    const v = document.getElementById('versaoBtn');
    const c = document.getElementById('contatoBtn');
    const x = document.getElementById('fadePopupClose');
    const t = cab.querySelector('.popup-title');
    const cs = getComputedStyle(v);
    const vr = v.getBoundingClientRect(), tr = t.getBoundingClientRect(), cr = c.getBoundingClientRect(), xr = x.getBoundingClientRect();
    const svg = c.querySelector('svg');
    return {
      versao: !!cab.querySelector('#versaoBtn #appVersion'),
      ajuda: !!cab.querySelector('#contatoBtn'),
      naVerificacao: !!document.querySelector('#testeSecao #versaoBtn, #testeSecao #contatoBtn, #testeSecao .versao-faixa'),
      noRodape: !!ft.querySelector('#versaoBtn, #contatoBtn, #appVersion'),
      rodape: getComputedStyle(ft).display,
      // A VERSÃO É SÓ AS LETRAS: sem fundo, sem borda, menor e mais apagada que o título.
      fundo: cs.backgroundColor, borda: cs.borderTopWidth + ' ' + cs.borderTopStyle,
      corV: cs.color, corT: getComputedStyle(t).color,
      fonteV: parseFloat(cs.fontSize), fonteT: parseFloat(getComputedStyle(t).fontSize),
      // ao LADO do título (depois dele, na mesma faixa vertical do cabeçalho)
      aoLado: vr.left >= tr.right - 1 || vr.top >= tr.bottom - 1,
      // O PEDIR AJUDA É O BALÃO COM A PALAVRA "AJUDA" AO LADO (v1.12.52), logo antes do ✕.
      ajudaTexto: c.textContent.trim(), ajudaIcone: svg ? svg.querySelector('use').getAttribute('href') : null,
      ajudaW: svg ? +svg.getBoundingClientRect().width.toFixed(1) : null,
      ajudaPalavra: (() => {
        const sp = c.querySelector('span'); if (!sp || !svg) return null;
        const a = svg.getBoundingClientRect(), b = sp.getBoundingClientRect();
        return { w: b.width, depois: b.left >= a.right - 0.5, mesmaLinha: Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 4,
          fonte: parseFloat(getComputedStyle(sp).fontSize), cor: getComputedStyle(sp).color };
      })(),
      ajudaAltura: cr.height,
      vizinhoDoX: c.nextElementSibling === x && cr.right <= xr.left + 1,
      ajudaRotulo: c.getAttribute('aria-label') + ' | ' + c.title,
      // A ATUALIZAÇÃO ADIADA FICA NO RODAPÉ, e com ela à vista ele volta a existir.
      comOta: (() => {
        const o = document.getElementById('otaRow'); o.hidden = false;
        const d = getComputedStyle(ft).display; o.hidden = true; return d;
      })(),
    };
  });
  checar(casa.versao && casa.ajuda && !casa.naVerificacao && !casa.noRodape,
    'H1 · a versão (com o `#appVersion` dentro) e o pedir ajuda moram no CABEÇALHO de Configurações — '
    + 'fora da Verificação e do rodapé', JSON.stringify(casa));
  checar(/rgba\(0, 0, 0, 0\)|transparent/.test(casa.fundo) && /^0px/.test(casa.borda)
      && casa.fonteV < casa.fonteT && casa.corV !== casa.corT && casa.aoLado,
    'H1 · a versão é SÓ AS LETRAS ao lado do título: sem fundo, sem borda, menor e em outra cor (mais '
    + 'apagada)', JSON.stringify(casa));
  checar(casa.ajudaTexto === 'Ajuda' && casa.ajudaIcone === '#icoContato' && casa.ajudaW === 20
      && casa.vizinhoDoX && /Pedir ajuda/.test(casa.ajudaRotulo),
    'H1 · o pedir ajuda é o balão (20px) com a palavra "Ajuda", logo antes do ✕, e diz "Pedir ajuda" ao '
    + 'leitor de tela', JSON.stringify(casa));
  checar(casa.ajudaPalavra && casa.ajudaPalavra.w > 0 && casa.ajudaPalavra.depois && casa.ajudaPalavra.mesmaLinha
      && casa.ajudaPalavra.fonte === casa.fonteV && casa.ajudaPalavra.cor === casa.corV && casa.ajudaAltura >= 33.5,
    'H1 · "Ajuda" está À VISTA, ao lado do balão, na régua da versão (mesmo tamanho e cor) — e a caixa de toque '
    + 'mantém a altura de um botão', JSON.stringify(casa.ajudaPalavra) + ' h=' + casa.ajudaAltura);
  checar(casa.rodape === 'none',
    'H1 · e sem atualização adiada o rodapé da folha NÃO EXISTE',
    JSON.stringify(casa));
  checar(casa.comOta !== 'none',
    'H1 · mas com a atualização adiada à vista o rodapé APARECE — quem adiou a encontra sem abrir seção',
    JSON.stringify(casa));

  // ---- H2 · O ESTADO ACIMA DA BARRA, E O RITMO VERTICAL ----
  // O resultado é ESCRITO, e não rodado: o que se mede é o desenho de um fim com
  // problemas, e a rodada de verdade é do `verificacao-do-sistema`.
  await abrirJanela(h.pg, '#testeTile', 'testeSecao');
  const ritmo = await h.pg.evaluate(async () => {
    cancelarVerificacao();
    testeRodando = false; testeEmCurso = null;
    testeResultado = { em: Date.now(), itens: [
      { id: 'internet', area: 'Rede', titulo: 'Há internet agora', v: TESTE_FALHOU, nota: 'sem saída' },
      { id: 'cores', area: 'Tela', titulo: 'As cores', v: TESTE_MUDO, nota: 'não respondeu' },
    ] };
    desenharTesteJa();
    await new Promise((f) => setTimeout(f, 50));
    const R = (sel) => document.querySelector(sel).getBoundingClientRect();
    const cab = R('#testeSecao .cfg-sec-cab'), res = R('#testeResumo'), bar = R('#testeAnel');
    const erros = [...document.querySelectorAll('#testeList > li')].map((n) => n.getBoundingClientRect());
    const ordem = document.getElementById('testeResumo')
      .compareDocumentPosition(document.getElementById('testeAnel')) & Node.DOCUMENT_POSITION_FOLLOWING;
    return {
      texto: document.getElementById('testeResumo').textContent, n: erros.length, ordem: !!ordem,
      cabResumo: +(res.top - cab.bottom).toFixed(2), resumoBarra: +(bar.top - res.bottom).toFixed(2),
      barraErros: erros.length ? +(erros[0].top - bar.bottom).toFixed(2) : null,
      entreErros: erros.length > 1 ? +(erros[1].top - erros[0].bottom).toFixed(2) : null,
    };
  });
  checar(ritmo.ordem && ritmo.texto && ritmo.resumoBarra >= 0 && ritmo.n === 2,
    'H2 · o estado ("' + ritmo.texto + '") vem ACIMA da barra, no documento e na tela',
    JSON.stringify(ritmo));
  checar(ritmo.cabResumo >= sp6 - 0.5 && ritmo.resumoBarra >= sp6 - 0.5,
    'H2 · e há `--sp-6` (' + sp6.toFixed(2) + 'px) do cabeçalho ao estado e do estado à barra — '
    + 'eram 4 e 8px, *"muito amontoados"*', JSON.stringify(ritmo));
  checar(ritmo.barraErros >= 2 * sp6 - 0.5 && ritmo.entreErros >= sp6 / 2,
    'H2 · e o DOBRO entre blocos de assunto diferente: da barra aos problemas', JSON.stringify(ritmo));

  // ---- H3 · A FAIXA DE FECHO: DE BORDA A BORDA, SEM PULO, SEM COBRIR A LISTA ----
  // (e o cabeçalho da seção GRUDADO no topo, v1.12.50)
  await h.pg.evaluate(() => { window.__avBack(); });
  await assentar(h.pg, ['#cfgSecoes', '#cfgSecoes .cfg-sec', '#cfgTopo']);
  await h.pg.evaluate(() => {
    historico = [{ inicio: Date.now() - 7200000, itens: Array.from({ length: 30 },
      (_, i) => ({ id: 'h' + i, nome: 'Louvor ' + i, sub: '', hora: Date.now() - i * 60000, vezes: 1, rec: null })) }];
  });
  await abrirJanela(h.pg, '#histOpenRow', 'histSecao');
  const medirFaixa = () => h.pg.evaluate(async () => {
    const sc = document.querySelector('#fadePopup .fade-opts');
    const f = document.getElementById('histClearFaixa');
    const btn = document.getElementById('histClear');
    const l = document.getElementById('histList');
    const r = sc.getBoundingClientRect(), fr = f.getBoundingClientRect(), br = btn.getBoundingClientRect();
    return {
      scEsq: r.left, scDir: r.left + sc.clientWidth, scBase: r.bottom,
      fEsq: fr.left, fDir: fr.right, fTopo: fr.top, fBase: fr.bottom,
      sobBotao: +(r.bottom - br.bottom).toFixed(2), listaFim: l.getBoundingClientRect().bottom,
      // A tira EXISTE quando o pseudo tem conteúdo E está à vista — `display` sozinho
      // diz `block` para um pseudo sem `content`, que não pinta nada.
      sombra: /^(none|normal)$/.test(getComputedStyle(f, '::before').content) ? 'sem conteúdo'
        : getComputedStyle(f, '::before').display, abaixo: sc.classList.contains('tem-abaixo'),
      // O CABEÇALHO DA SEÇÃO: colado ao da folha, de borda a borda, opaco, e com a
      // sombra de "há mais acima" na borda de baixo dele.
      cabTopo: document.querySelector('#histSecao .cfg-sec-cab').getBoundingClientRect().top,
      cabEsq: document.querySelector('#histSecao .cfg-sec-cab').getBoundingClientRect().left,
      cabDir: document.querySelector('#histSecao .cfg-sec-cab').getBoundingClientRect().right,
      cabFundo: getComputedStyle(document.querySelector('#histSecao .cfg-sec-cab')).backgroundColor,
      folhaBase: document.querySelector('#fadePopup .popup-header').getBoundingClientRect().bottom,
      cabSombra: (() => { const cs = getComputedStyle(document.querySelector('#histSecao .cfg-sec-cab'), '::after');
        return /^(none|normal)$/.test(cs.content) ? 'sem conteúdo' : cs.display; })(),
      acima: sc.classList.contains('tem-acima'),
      folha: document.querySelector('#fadePopup .popup-sheet').getBoundingClientRect().height,
      vh: innerHeight,
    };
  });
  // NO TOPO, e depois NO MEIO (a faixa grudada).
  await h.pg.evaluate(() => { document.querySelector('#fadePopup .fade-opts').scrollTop = 0; });
  await h.pg.waitForTimeout(150);
  const hTopo = await medirFaixa();
  await h.pg.evaluate(() => {
    const sc = document.querySelector('#fadePopup .fade-opts');
    sc.scrollTop = (sc.scrollHeight - sc.clientHeight) / 2;
  });
  await h.pg.waitForTimeout(150);
  const meio = await medirFaixa();
  // O PIXEL DA CALHA: ao lado da faixa, rente à borda da folha. Com a faixa do
  // tamanho do content box, a tira de baixo do scroller aparecia ali (MEDIDO: 187
  // contra 255 no tema claro); de borda a borda, a calha é o fundo da faixa.
  const png = lerPng(await h.pg.screenshot());
  const yCalha = Math.round(meio.scBase - 4);
  const calha = pixel(png, Math.round(meio.scEsq + 3), yCalha);
  const miolo = pixel(png, Math.round((meio.scEsq + meio.scDir) / 2), yCalha);
  // NO FIM.
  await h.pg.evaluate(() => { document.querySelector('#fadePopup .fade-opts').scrollTop = 99999; });
  await h.pg.waitForTimeout(150);
  const hFim = await medirFaixa();
  checar(meio.abaixo && Math.abs(meio.fBase - meio.scBase) <= 0.5,
    'H3 · PREMISSA: no meio a folha tem o que rolar e a faixa está GRUDADA na base', JSON.stringify(meio));
  checar(Math.abs(meio.fEsq - meio.scEsq) <= 0.5 && Math.abs(meio.fDir - meio.scDir) <= 0.5,
    'H3 · a faixa vai de BORDA A BORDA da folha (o padding box do scroller), e não só o recuo',
    JSON.stringify(meio));
  checar(calha && miolo && calha.join() === miolo.join(),
    'H3 · e a tira de baixo do scroller NÃO aparece na calha ao lado da faixa — o pixel rente à '
    + 'borda é o fundo da faixa', JSON.stringify({ calha, miolo }));
  checar(meio.sombra === 'block' && hFim.sombra === 'none',
    'H3 · a sombra de "há mais abaixo" mora na borda de CIMA da faixa grudada, e some no fim',
    JSON.stringify([meio.sombra, hFim.sombra]));
  checar(Math.abs(meio.sobBotao - hFim.sobBotao) <= 0.5 && Math.abs(hFim.sobBotao - baseFolha) <= 0.5,
    'H3 · e o botão fica à MESMA distância da base (`.9rem`, ' + baseFolha.toFixed(2) + 'px) grudado e no '
    + 'fim — o `padding` do scroller entrava debaixo da faixa no último gesto e a fazia pular 16px',
    JSON.stringify({ meio: meio.sobBotao, fim: hFim.sobBotao }));
  checar(!hFim.abaixo && hFim.listaFim <= hFim.fTopo + 0.5,
    'H3 · no fim a última linha da lista fica INTEIRA acima da faixa — nada escondido atrás dela',
    JSON.stringify(hFim));

  // O CABEÇALHO DA SEÇÃO NO TOPO, COM A LISTA ROLADA ATÉ O FIM (v1.12.50).
  checar(Math.abs(hFim.cabTopo - hFim.folhaBase) <= 1 && Math.abs(hFim.cabEsq - hFim.scEsq) <= 0.5
      && Math.abs(hFim.cabDir - hFim.scDir) <= 0.5 && !/rgba\(0, 0, 0, 0\)/.test(hFim.cabFundo),
    'H3 · com a lista rolada até o FIM o cabeçalho da seção continua colado ao de Configurações, de borda '
    + 'a borda e opaco', JSON.stringify(hFim));
  checar(hTopo.cabSombra === 'none' && !hTopo.acima && hFim.acima && hFim.cabSombra === 'block',
    'H3 · e a sombra de "há mais acima" é DELE (na borda de baixo), só com a lista rolada — a tira do '
    + 'scroller ficaria escondida atrás de um cabeçalho opaco', JSON.stringify([hTopo.cabSombra, hFim.cabSombra]));

  // ---- H4 · A FOLHA PASSA DOS 80% QUANDO O CONTEÚDO PEDE ----
  checar(hFim.folha > 0.8 * hFim.vh + 1 && hFim.folha < hFim.vh - 40,
    'H4 · com o Histórico longo a folha passa dos 80% (' + (hFim.folha / hFim.vh * 100).toFixed(1)
    + '%) — e ainda deixa scrim à vista embaixo, onde o toque a fecha', JSON.stringify(hFim));
  await h.ctx.close();

  checar(erros.length === 0, 'nenhum erro de console', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
