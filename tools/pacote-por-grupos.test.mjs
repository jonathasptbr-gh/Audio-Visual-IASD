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
  window.__concluido = [];
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
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','castTarget',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','apkProcurar','otaPending','otaApply',
    'otaCheck','otaDiag','ytDiag','cifraDiag','farolEstado','ytCanalPlaylists','ytPlaylist',
    'ytDetalhes','areaTransferencia','salvarTexto',
    // Fora da allowlist, um método devolve undefined e prende quem o chamar
    // pelos 60 s do CALL_TIMEOUT_MS, calado. Nenhum destes é tocado aqui —
    // eles entram para que o próximo que os chame não pague o minuto.
    'pacoteDiag','cifraHtml','apkInstalar','espelhoCertImportar','espelhoCertApagar',
    ]);
  const B = {
    shellVersion: () => 63,
    role: () => 'controle',
    appVersion: () => '9.99-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    compartilharTexto: () => {},
    bgProgress: (s) => { try { window.__progresso.push(JSON.parse(s)); } catch (e) {} },
    // O CARTÃO DE CONCLUSÃO. Ele existia com oráculo só de FORMA (o
    // ponte.test.mjs chamava o método à mão) — nada afirmava que a exportação
    // de verdade o chama, e é essa fresta que deixa o check sumir da barra
    // sem nada acusar. SEM CRASE neste comentário: a ponte de mentira é
    // montada dentro de um template literal, e uma crase aqui o fecha.
    bgConcluido: (s) => { try { window.__concluido.push(JSON.parse(s)); } catch (e) {} },
    pacoteCancelar: () => { window.__cancelado = (window.__cancelado || 0) + 1; },
    pacoteCriar: (id) => { setTimeout(() => window.__avResolve(id, 'acervo-de-teste.avpkg'), 0); },
    pacoteFechar: (id) => {
      let total = 0;
      for (const p of (window.__saida || [])) total += p.length;
      // O SINAL DE QUE A ESCRITA ACABOU (v1.8.19). O desfecho da exportação
      // deixou de ser um diálogo, e é por este ponto — a última chamada de
      // ponte do percurso — que o oráculo sabe que pode medir o botão.
      window.__fechou = true;
      setTimeout(() => window.__avResolve(id, total), 0);
    },
    pickDoc: (id) => { setTimeout(() => window.__avResolve(id, []), 0); },
  };
  const nomes = ['apkInstalar','apkProcurar','captureVolumeKeys','castTarget',
    'deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar','espelhoCertEstado',
    'espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado','espelhoLigar',
    'keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply','otaCheck',
    'otaDiag','otaPending','pickFolder','systemVolume','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio',
    'ytPlaylist','ytSearch','ytStream','farolEstado','projecaoLocal','cifraHtml',
    'cifraDiag','areaTransferencia','salvarTexto','pacoteDiag','ytDetalhes',
  ];
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
      dentro: !!li.closest('.pacote-grupo-corpo'),
      seta: !!li.querySelector('.pacote-seta'),
    };
  }));

// Toca no CORPO de uma linha (marca/desmarca) ou na SETA dela (abre a seção) —
// pelo rótulo, que é como o operador a encontra.
const tocar = (pg, rotulo, alvo) => pg.evaluate(([r, a]) => {
  const li = [...document.querySelectorAll('#songMenuList li')]
    .find((x) => ((x.querySelector('.song-menu-label') || {}).textContent || '') === r);
  if (!li) throw new Error('linha não encontrada: ' + r);
  (a === 'seta' ? li.querySelector('.pacote-seta') : li.firstElementChild).click();
}, [rotulo, alvo || 'corpo']);

async function escolher(pg, passos) {
  const abriu = await abriuFolha(pg);
  if (abriu !== true) return abriu;
  for (const [rotulo, alvo] of (passos || [])) await tocar(pg, rotulo, alvo);
  const linhas = await pg.evaluate(() => [...document.querySelectorAll('#songMenuList li')]
    .map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim()));
  await pg.click('#songMenuPopup .song-menu-go');
  return linhas;
}

const pg2linhas = (pg) => pg.evaluate(() => [...document.querySelectorAll('#songMenuList li')]
  .map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim()));

// O FIM DA EXPORTAÇÃO, e ele deixou de ser um DIÁLOGO (v1.8.19). O popup
// "Acervo exportado" saiu a pedido do operador, e quem responde agora é o
// próprio botão: no caminho do SAF — que é o destes cenários, porque a ponte
// de mentira não tem `pacoteEspaco` e a conta cai no zero — ele empresta o
// título para o TAMANHO gravado e volta.
//
// Esperar pela PROMESSA da exportação seria frágil pelo motivo do irmão
// `pacote-compartilhar`: um desfecho que abrisse diálogo nunca a resolveria, e
// o que sairia seria prazo, não veredito. Espera-se pelo `fechar`.
async function fimDaExportacao(pg) {
  const fechou = await esperar(pg, () => window.__chamadas
    ? window.__chamadas.includes('fechar')
    : window.__fechou === true, null, 60000);
  if (fechou !== true) return porque(fechou);
  await pg.evaluate(() => new Promise((r) => setTimeout(r, 60)));
  return pg.evaluate(() => {
    const t = document.querySelector('#pacoteExportarTile .qs-titulo');
    const d = document.getElementById('appDialog');
    return { titulo: (t || {}).textContent || '',
      dialogo: !!d && d.classList.contains('open') };
  });
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
  const fimA = await fimDaExportacao(a.pg);
  checar(fimA && fimA.dialogo === false,
    'A · e a exportação termina SEM diálogo — o "Acervo exportado" saiu na '
    + 'v1.8.19, e quem responde é o próprio botão', JSON.stringify(fimA));
  checar(fimA && /\d/.test(fimA.titulo),
    'A · com o TAMANHO no título do tile, que é onde o toque foi dado',
    JSON.stringify(fimA));

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
  // O BOTÃO É A INTERFACE INTEIRA DESTA AÇÃO (v1.7.3): ele diz quanto já foi e
  // quanto pesou o arquivo. O cartão sobre a preview saiu daqui — a exportação
  // não acontece na preview.
  //
  // A PALAVRA "Medindo…" SAIU (v1.8.27), a pedido: *"não precisa usar 'medindo'
  // após a seleção, apenas inclua isso na contagem de porcentagem do processo.
  // afinal, isso é só parte do processo como um todo"*. A medição não deixou de
  // ser reportada — ela virou a primeira FATIA da mesma barra.
  checar(!medida.rotulos.includes('Medindo…'),
    'A · a palavra "Medindo…" não aparece — a medição é uma fatia da barra, não '
    + 'uma etapa à parte', JSON.stringify(medida.rotulos));
  // E A BARRA É UMA SÓ: ela não pode voltar atrás nem fechar antes do fim, que
  // é o que duas contagens de 0 a 100 em sequência fazem.
  let voltou = 0;
  for (let i = 1; i < pcts.length; i++) if (pcts[i] < pcts[i - 1]) voltou++;
  checar(voltou === 0,
    'A · e a contagem nunca VOLTA ATRÁS — medir e escrever dividem uma régua só',
    voltou + ' recuo(s) em ' + JSON.stringify(pcts));
  checar(pcts.indexOf(100) === pcts.length - 1,
    'A · e ela só chega a 100% no FIM — fechar antes é a falsa sensação de '
    + 'conclusão', JSON.stringify(pcts));
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
  // O CHECK NA BARRA, pelo caminho REAL. Relato do operador: *"após conclusão
  // da exportação ou importação, o ícone na barra de notificação não se torna
  // em um check"*.
  const cartao = await a.pg.evaluate(() => window.__concluido || []);
  checar(cartao.length === 1 && /\S/.test(cartao[0].titulo || ''),
    'A · e ao TERMINAR a exportação chama `bgConcluido` — o cartão do check é '
    + 'postado sob id próprio, e sem esta asserção só a FORMA do método tinha '
    + 'oráculo', JSON.stringify(cartao));

  // -------------------------------------------------------------------------
  // A NOTIFICAÇÃO E O BOTÃO CONTAM O MESMO TRABALHO (v1.8.35)
  //
  // Relato do operador: *"o número do progresso na notificação não está se
  // atualizando corretamente, há muito atraso em relação à realidade, ao menos
  // 5%"*. Não era atraso de RELÓGIO: eram DUAS CONTAS. O botão recebia a fração
  // do processo INTEIRO (a medição é a primeira fatia — `PACOTE_FATIA_MEDIDA`,
  // 5%) e a notificação recebia a fração da ESCRITA CRUA. O desvio é
  // `5% × (1 − f)`: os 5% inteiros no começo, fechando em zero só no fim.
  //
  // A RÉGUA NÃO PODE SER O RELÓGIO. Comparar as duas superfícies AO VIVO mediria
  // o freio de 700 ms (que descarta envios) e a ordem das duas escritas dentro
  // do mesmo passo — as duas coisas dependem da máquina, e é assim que um
  // oráculo passa a reprovar por carga do runner. O que se afirma é a
  // PROPRIEDADE do número que a notificação manda: se ele é a fração do
  // processo inteiro, ele NASCE em 5% e não em zero, porque a medição já
  // aconteceu quando a escrita começa.
  const faixa = await a.pg.evaluate(() => {
    const p = (window.__progresso || []).filter((x) => x.bytes === true && x.total > 1);
    if (!p.length) return null;
    const f = p.map((x) => x.done / x.total);
    let voltou = 0;
    for (let i = 1; i < f.length; i++) if (f[i] < f[i - 1] - 1e-9) voltou++;
    return { n: f.length, min: Math.min(...f), max: Math.max(...f), voltou };
  });
  checar(faixa && faixa.n > 0,
    'A · a notificação reportou a fase da escrita', JSON.stringify(faixa));
  // O 0.049 (e não 0.05) é o arredondamento do `Math.round(fracao * total)`
  // sobre um pacote de teste pequeno, não uma folga de política.
  checar(faixa && faixa.min >= 0.049,
    'A · e o número dela nasce na FATIA da medição, como o do botão — era este '
    + 'o desvio de 5% que o operador via entre as duas telas',
    faixa && faixa.min);
  // A METADE QUE IMPEDE O CONSERTO LARGO DEMAIS: somar 5% a tudo, ou mandar
  // 100% sempre, passaria na asserção de cima.
  checar(faixa && Math.abs(faixa.max - 1) < 1e-6,
    'A · e ela ainda FECHA em 100% — o mapeamento é uma faixa, não um degrau '
    + 'somado', faixa && faixa.max);
  checar(faixa && faixa.voltou === 0,
    'A · e nunca volta atrás', faixa && faixa.voltou);

  // O FREIO ADIA, NUNCA DESCARTA. Ele era um `return` seco: o último passo
  // antes de uma quietação ficava para trás até o batimento de 2 s. Aqui a
  // espera é pelo FATO (a entrada nova no espião), nunca por um prazo fixo —
  // o estouro devolve a FRASE e não um veredito sobre o app.
  //
  // E ELE PRECISA DE UMA TAREFA VIVA. Sem nenhuma, `bgTaskSend` cai no ramo do
  // "nada em curso", que envia SEM passar pelo freio — o teste passaria pelo
  // motivo errado (medido: foi o que ele fez na primeira escrita).
  //
  // E O COMPASSO PRECISA SAIR DE CAMPO. Ele reenvia com `force` a cada
  // `BG_REENVIO_MS` (2 s), então um prazo maior que isso mede O COMPASSO e
  // aprova as duas versões — MEDIDO: a reversão passou. Encurtar o prazo para
  // caber entre os 700 ms e os 2 s seria pior ainda: aí o veredito passaria a
  // depender da carga do runner, que é a regra que este repositório escreve
  // em primeiro lugar. Desligado o compasso, a versão que DESCARTA não envia
  // nunca — o estouro vira um negativo de verdade, e o prazo pode ser folgado.
  const adiou = await a.pg.evaluate(() => {
    const t = bgTaskStart('freio', 1, 'baixar');
    clearInterval(bgPacer); bgPacer = null;
    bgTaskBytes(t, 1, 1000);          // troca de RÉGUA: sai na hora (`force`)
    const antes = window.__progresso.length;
    bgTaskBytes(t, 2, 1000);          // dentro da janela: na versão antiga, morria aqui
    return { tarefa: t, antes, depois: window.__progresso.length };
  });
  checar(adiou.depois === adiou.antes,
    'A · o freio de fato reteve o passo (senão o resto não mede nada)',
    JSON.stringify(adiou));
  const chegou = await esperar(a.pg,
    (d) => window.__progresso.length > d, adiou.depois, 8000);
  checar(chegou === true,
    'A · e o envio retido pelo freio CHEGA quando a janela fecha, em vez de se '
    + 'perder até o batimento de 2 s', porque(chegou));
  await a.pg.evaluate((id) => bgTaskEnd(id), adiou.tarefa);

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

  // ===== NÃO HÁ LINHA DE "TUDO", E TUDO NASCE MARCADO (v1.7.9) =====
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
  await b.pg.click('#songMenuPopup .song-menu-go');
  const fimB = await fimDaExportacao(b.pg);
  checar(fimB && fimB.dialogo === false && /\d/.test(fimB.titulo),
    'B · e a exportação termina no próprio botão, sem diálogo',
    JSON.stringify(fimB));

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

  // =========================================================================
  // A FOLHA ABRE SEM LER O CATÁLOGO (v1.8.30)
  // =========================================================================
  //
  // Relato do operador: *"ele está tendo um delay para abrir o popup das
  // opções, verifique esse delay, ele não deve existir"*.
  //
  // A v1.8.26 tirou a VARREDURA DO DISCO do caminho do toque e deixou para trás
  // um `AVDB.filesResumo()` — um cursor sobre a store `files` INTEIRA. MEDIDO
  // em Chromium com 2.228 registros: **135 ms** (contra 2,3 ms do
  // `mediaResumo`), porque o cursor desserializa cada registro com a miniatura
  // e a letra dentro. Num aparelho é o atraso que se vê entre o dedo e a folha.
  //
  // O ESPIÃO MUDOU DE ALVO NA v1.8.46, e por um motivo que é o próprio assunto
  // deste arquivo: o `filesResumo` foi APAGADO — ninguém o chamava desde aquele
  // lote, e o único consumidor dele no repositório era este espião, afirmando
  // que ele não é chamado. Espiar uma função que não existe mais é a asserção
  // passando por VACUIDADE. O alvo passou a ser o `filesAll`, que é o leitor de
  // store inteira que RESTOU e tem o mesmo perfil de custo.
  //
  // A RÉGUA É A AUSÊNCIA DA CHAMADA, e não o relógio: um limite em
  // milissegundos mede a MÁQUINA, e reprovaria por carga do runner num app que
  // está certo — a regra deste repositório. Aqui a asserção é a mesma do
  // `cifra-offline.test.mjs`: a função que custa caro não foi chamada.
  {
    const a = await aparelho();
    await a.pg.evaluate(async () => {
      // O ESPIÃO fica sobre o `AVDB`, que é por onde o `controle.js` fala com o
      // banco — envolver o IndexedDB seria medir o mecanismo, não o contrato.
      window.__leuCatalogo = 0;
      const real = AVDB.filesAll;
      AVDB.filesAll = function (...args) {
        window.__leuCatalogo++;
        return real.apply(this, args);
      };
      // UM ACERVO com peso guardado, que é como toda coleção baixada chega à
      // abertura seguinte (`carregarPesos` lê a chave `coll-bytes`).
      await AVDB.setState('coll-bytes', { 'album-um': 300000000 });
    });
    await a.pg.evaluate(() => { window.__folha = pacotePlanoAproximado(); });
    const plano = await a.pg.evaluate(() => window.__folha.then((p) => ({
      grupos: (p.grupos || []).length, aprox: !!p.aprox,
    })));
    const leu = await a.pg.evaluate(() => window.__leuCatalogo);
    checar(leu === 0,
      'a folha de exportação abre SEM percorrer a store `files` — o cursor '
      + 'custava 135 ms medidos entre o toque e a folha, e o peso de cada '
      + 'coleção já está em memória desde a abertura', String(leu));
    // A METADE QUE IMPEDE O CONSERTO LARGO DEMAIS: tirar o cursor não pode
    // tirar a folha. Sem ela, um `return { grupos: [] }` passaria na de cima.
    checar(plano.grupos > 0 && plano.aprox === true,
      'e ela continua saindo com os grupos e com a marca de APROXIMADO — o '
      + 'peso vem do que a Biblioteca já sabe', JSON.stringify(plano));
    await a.ctx.close();
  }

  // =========================================================================
  // D · FAVORITOS É UM GRUPO, E OS GRUPOS DE MÍDIA SE SOBREPÕEM (v1.8.38)
  //
  // Pedido do operador: *"analise para termos um dos seletores de coleção para
  // a exportação, o item favoritos, pois em alguns casos, ele pode conter
  // vários arquivos com peso"*. E a semântica é escolha dele: *"o item viaja se
  // QUALQUER grupo que o contém estiver marcado"*.
  //
  // TRÊS coisas falham CALADAS aqui, e nenhuma das três aparece na tela:
  //  1. o grupo não ser DESENHADO — era o estado anterior, e por um guarda que
  //     consultava o mapa dos arquivos do DISCO: `linha('midia')` era um no-op,
  //     o grupo existia no plano, era marcado por padrão e viajava sempre;
  //  2. a seleção ser INTERSEÇÃO em vez de união — desmarcar Favoritos levaria
  //     junto um item que o Cronograma pede, e o pacote chega menor sem erro;
  //  3. o total ser a SOMA — os grupos se sobrepõem, então ele passaria do
  //     tamanho do arquivo, e é esse número que decide "cabe no cartão?".
  // =========================================================================
  {
    const d = await aparelho();
    await d.pg.evaluate(async () => {
      const bytes = (n, v) => new Blob([new Uint8Array(n).fill(v)], { type: 'audio/mp4' });
      const add = async (id, nome, n, v) => {
        await AVDB.mediaAdd({
          id, name: nome, type: 'audio/mp4', kind: 'audio',
          blob: bytes(n, v), thumb: null, addedAt: 1,
        });
      };
      // SÓ nos favoritos; nos DOIS; só no Cronograma.
      await add('so-fav', 'Alfa', 9000, 1);
      await add('nos-dois', 'Beta', 9000, 2);
      await add('so-cron', 'Gama', 9000, 3);
      await AVDB.listAdd('favs', 'so-fav');
      await AVDB.listAdd('favs', 'nos-dois');
      await AVDB.listAdd('imports', 'nos-dois');
      await AVDB.listAdd('imports', 'so-cron');
    });
    await d.pg.evaluate(() => { window.__fim = exportarPacote(); });
    const linhas = await abriuFolha(d.pg);
    checar(linhas === true, 'D · a folha abre', porque(linhas));
    const rotulos = (await lerFolha(d.pg)).map((x) => x.rotulo);
    checar(rotulos.includes('Favoritos'),
      'D · e FAVORITOS é uma linha da folha — antes o grupo da store de mídia '
      + 'existia no plano e nunca era desenhado, então viajava sempre',
      JSON.stringify(rotulos));
    // O CRONOGRAMA E A PLAYLIST SAÍRAM (v1.8.40), a pedido: elas são listas de
    // TRABALHO — se esvaziam e se refazem toda semana —, e escolher se elas
    // viajam não é uma decisão sobre o que o outro aparelho vai TER. Os itens
    // delas continuam viajando pelo grupo de escape.
    checar(!rotulos.includes('Cronograma') && !rotulos.includes('Playlist'),
      'D · e o Cronograma e a Playlist NÃO são grupos: são listas de trabalho, '
      + 'não de acervo', JSON.stringify(rotulos));
    checar(rotulos.includes('Outros itens'),
      'D · o grupo de escape existe — é por ele que o que não é favorito viaja',
      JSON.stringify(rotulos));
    // A SOBREPOSIÇÃO É DITA na própria linha: os dois pesos contam o
    // `nos-dois`, e uma folha que mostra dois números que não somam sem
    // explicar por quê é pior que uma que não os separa.
    const favLinha = (await lerFolha(d.pg)).find((x) => x.rotulo === 'Favoritos');
    checar(favLinha && /outro grupo/.test(favLinha.sub || ''),
      'D · e a linha DIZ que o peso pode contar em outro grupo',
      JSON.stringify(favLinha));
    // A UNIÃO: desmarcar Favoritos NÃO pode tirar o item que o Cronograma pede.
    await tocar(d.pg, 'Favoritos');
    await d.pg.click('#songMenuPopup .song-menu-go');
    const fim = await fimDaExportacao(d.pg);
    checar(fim && fim.dialogo === false, 'D · a exportação termina', JSON.stringify(fim));
    const dentro = await d.pg.evaluate(() => {
      const partes = window.__saida;
      let total = 0;
      for (const p of partes) total += p.length;
      // PELO NOME do registro, e nunca pelo id: o id viaja TAMBÉM dentro da
      // lista `favs`, que é chave de `state` e vai sempre — procurar por ele
      // acharia o item mesmo com o registro dele fora do pacote (medido: foi
      // assim que esta asserção reprovou o app estando certo).
      const junto = new Uint8Array(total);
      let o = 0;
      for (const p of partes) { junto.set(p, o); o += p.length; }
      const texto = new TextDecoder().decode(junto);
      const tem = (n) => texto.indexOf('"name":"' + n + '"') !== -1;
      return { total, temSoFav: tem('Alfa'), temNosDois: tem('Beta'), temSoCron: tem('Gama') };
    });
    // A SEMÂNTICA DE UNIÃO CONTINUA (`pacoteMidiaSelecionada`), e o que mudou é
    // quantos grupos existem: com só os Favoritos, um item favoritado tem UM
    // grupo, e desmarcá-lo o deixa de fora — que é exatamente o que o rótulo
    // promete. O que NÃO é favorito viaja pelo escape, marcado como o resto.
    checar(dentro.temSoCron === true,
      'D · o que não é favorito viaja pelo grupo de escape, com Favoritos '
      + 'desmarcado', JSON.stringify(dentro));
    checar(dentro.temSoFav === false && dentro.temNosDois === false,
      'D · e o que é favorito fica de fora — sem esta, "levar tudo sempre" '
      + 'passaria na de cima', JSON.stringify(dentro));
    await d.ctx.close();
  }

  // =========================================================================
  // E · A ORDEM DA BIBLIOTECA, A ALFABÉTICA, O RELATÓRIO AGRUPADO E O PESO QUE
  //     ERRA PARA CIMA (v1.8.40)
  //
  // Quatro pedidos do operador, e os quatro falham CALADOS — a folha continua
  // abrindo, a exportação continua produzindo o arquivo certo, e o que muda é
  // só onde o operador procura e o que ele lê:
  //
  //  1. **A ORDEM.** *"Cuide para que a ordem dos elementos dessa lista para
  //     exportação esteja na mesma ordem que temos na biblioteca."* Uma folha
  //     que agrupa certo e ordena diferente é a mesma árvore embaralhada.
  //  2. **A ALFABÉTICA.** *"Os grupos de 'diversos' e 'cantores' devem ter seus
  //     álbuns listados em ordem alfabética tanto na biblioteca como ali no
  //     exportar."* Ela vale nas DUAS telas porque sai de UMA função
  //     (`categoryCards`) — e é isso que este bloco prova do lado da folha; o
  //     lado da Biblioteca tem oráculo próprio no `boot-nativo`.
  //  3. **O RELATÓRIO.** *"Os resultados devem vir sobre os itens que o usuário
  //     conhece, em uma ordem que ele já vê dos grupos maiores."* Ele listava
  //     as COLEÇÕES do banco; passou a listar as NOSSAS coletâneas.
  //  4. **O PESO.** *"Mesmo com o arredondamento para cima ele está
  //     apresentando um número bem menor que a realidade … se ele fosse errar,
  //     que erre para cima."* Um número menor que o arquivo é o único defeito
  //     desta tela que custa uma exportação abortada no meio, e a régua não é
  //     um valor: é a DESIGUALDADE contra o que o arquivo de fato pesou.
  // =========================================================================
  {
    const e = await aparelho();
    // O CATÁLOGO pelo caminho de verdade — o `state`, que é de onde o
    // `allCollections()` e o `AVColetanea.aplicar` leem. Duas coletâneas: uma
    // ALFABÉTICA pelo nome (`Diversas`) e uma que NÃO é (`Adoradores`), para a
    // asserção da ordenação não passar por vacuidade.
    await e.pg.evaluate(async () => {
      await AVDB.setState('albumCatalog', {
        categories: [
          { id_category: 1, name: 'Adoradores', order: 1,
            albums: [{ id_album: 'zeta', order: 1 }, { id_album: 'alfa', order: 2 }] },
          { id_category: 2, name: 'Diversas', order: 2,
            albums: [{ id_album: 'omega', order: 1 }, { id_album: 'beta', order: 2 }] },
        ],
        albums: [
          { id_album: 'zeta', name: 'Zeta' }, { id_album: 'alfa', name: 'Alfa' },
          { id_album: 'omega', name: 'Omega' }, { id_album: 'beta', name: 'Beta' },
        ],
      });
    });
    await e.pg.reload({ waitUntil: 'domcontentloaded' });
    await esperar(e.pg, () => !document.getElementById('splash'), null, 30000);
    const PESO = await e.pg.evaluate(async () => {
      const bytes = (n, v) => new Blob([new Uint8Array(n).fill(v)], { type: 'audio/mp4' });
      let escrito = 0;
      for (const [id, nome] of [['zeta', 'Zeta'], ['alfa', 'Alfa'],
        ['omega', 'Omega'], ['beta', 'Beta']]) {
        const cam = 'folders/album-' + id + '/faixa.m4a';
        await AVDB.opfsWriteFile(cam, bytes(9000, 1));
        escrito += 9000;
        await AVDB.fileAdd({
          id: 'f-' + id, folder: 'album-' + id, opfsPath: cam,
          name: 'Faixa de ' + nome, type: 'audio/mp4', kind: 'audio', size: 9000,
          thumb: null, blob: null, url: null, addedAt: 1,
        });
        // O ÍNDICE da coleção — é dele que o relatório tira "N de M músicas".
        await AVDB.setState('coll:album-' + id,
          { songs: [{ id_music: 1, fileIdFull: 'f-' + id }] });
      }
      // AS DUAS PONTAS DA ORDEM: um FAVORITO (a primeira seção da Biblioteca) e
      // um item em lista nenhuma (o grupo de escape, que a Biblioteca não tem).
      // Sem eles a asserção de posição é VACUOSA — a folha sai só com as duas
      // coletâneas no meio, e qualquer ordem passa.
      await AVDB.mediaAdd({
        id: 'fav-1', name: 'Um favorito', type: 'audio/mp4', kind: 'audio',
        blob: bytes(9000, 7), thumb: null, addedAt: 1,
      });
      await AVDB.mediaAdd({
        id: 'solto-1', name: 'Um solto', type: 'audio/mp4', kind: 'audio',
        blob: bytes(9000, 8), thumb: null, addedAt: 1,
      });
      await AVDB.listAdd('favs', 'fav-1');
      // CHAVES DE `state` EM QUANTIDADE, que é o caso que o peso não via: a
      // Bíblia mora aqui com uma POR CAPÍTULO, e elas eram somadas como ZERO.
      const lote = [];
      for (let i = 0; i < 200; i++) {
        lote.push({ chave: 'bible:x_' + i, valor: { t: 'x'.repeat(3000) } });
      }
      await AVDB.updateStateLote(lote, (_atual, novo) => novo);
      return { escrito };
    });
    await e.pg.evaluate(() => { window.__fim = exportarPacote(); });
    const abriuE = await abriuFolha(e.pg);
    checar(abriuE === true, 'E · a folha abre', porque(abriuE));

    // ===== A ORDEM =====
    // A Biblioteca monta, nesta sequência: FAVORITOS, a raiz (séries e
    // hinários), as coletâneas, "Outros álbuns". A folha acrescenta no fim o
    // que não existe na Biblioteca — os itens sem lista e os arquivos sem
    // coleção. A régua é a ordem em que as SEÇÕES aparecem, e não a lista
    // inteira: os nomes das coleções dentro delas são do fixture.
    const folhaE = await lerFolha(e.pg);
    const secoes = folhaE.filter((l) => l.grupo).map((l) => l.rotulo);
    checar(JSON.stringify(secoes) === JSON.stringify(['Adoradores', 'Diversas']),
      'E · as seções saem na ORDEM DA BIBLIOTECA — as coletâneas na ordem do '
      + 'catálogo, e nada entre elas', JSON.stringify(secoes));
    // AS DUAS PONTAS, e elas dizem a regra inteira: os FAVORITOS vão na FRENTE
    // (na Biblioteca eles são a primeira seção) e o que a Biblioteca não tem —
    // os itens em lista nenhuma — vai DEPOIS de tudo que ela tem. A asserção é
    // posicional, e é a ORDEM COMPLETA da folha, sem o confirmar.
    const ordem = folhaE.filter((l) => !/^Salvar/.test(l.rotulo)).map((l) => l.rotulo);
    checar(JSON.stringify(ordem)
      === JSON.stringify(['Favoritos', 'Adoradores', 'Diversas', 'Outros itens']),
      'E · com os FAVORITOS na frente (a primeira seção da Biblioteca) e o que '
      + 'ela NÃO tem no fim — a folha inteira na ordem em que o operador '
      + 'aprendeu a procurar', JSON.stringify(ordem));

    // ===== O DESENHO É O DA BIBLIOTECA, E A RÉGUA É A BIBLIOTECA =====
    //
    // Pedido do operador, em duas rodadas. A primeira (v1.8.40): *"os grupos
    // estão iguais às listas de itens dentro deles, não deixando identificar o
    // que é topo e o que é item"* — um 1,00:1 medido. A segunda (v1.8.41), com
    // o degrau já no lugar: *"a seta de abertura do acordeão está diferente, as
    // cores entre o dono e os itens de sua lista também … eu quero o mesmo
    // design da biblioteca, cores e ícones — o padrão da biblioteca já temos"*.
    //
    // A RÉGUA MUDOU POR CAUSA DA SEGUNDA, e é ela que carrega este bloco: um
    // degrau MEDIDO contra um piso prova que a folha tem hierarquia, e não que
    // ela tem A hierarquia da Biblioteca. Aqui os dois desenhos são medidos NA
    // MESMA PÁGINA e comparados um com o outro — bloco × seção, linha × card,
    // seta × seta. Um número escrito no oráculo envelheceria à parte do app na
    // primeira vez que a Biblioteca mudasse de tom, e a divergência voltaria
    // sem nada reprovar.
    //
    // MEDIDO COM AS LINHAS DESMARCADAS, e é obrigatório: a folha nasce com tudo
    // marcado, e ATÉ A v1.8.40 o preenchimento de escolhido (`--sel-fill`)
    // cobria o tom em todas elas — medindo assim, as três asserções liam a
    // mesma cor de estado (`rgb(46, 66, 98)` nas três) e não diziam nada sobre
    // a hierarquia. Ele saiu nesta folha (ver o bloco de baixo); a medição
    // continua sendo feita desmarcada porque é ali que o tom é o que se vê.
    const marcada = await e.pg.evaluate(() => {
      const li = [...document.querySelectorAll('#songMenuList li')]
        .find((x) => ((x.querySelector('.song-menu-label') || {}).textContent || '') === 'Favoritos');
      return getComputedStyle(li.querySelector('.song-menu-btn')).backgroundColor;
    });
    await tocar(e.pg, 'Diversas');
    await tocar(e.pg, 'Favoritos');
    await tocar(e.pg, 'Diversas', 'seta');
    const par = await e.pg.evaluate(() => {
      const cs = (el) => el && getComputedStyle(el);
      const cor = (el) => (cs(el) || {}).backgroundColor;
      const rot = (x) => ((x.querySelector('.song-menu-label') || {}).textContent || '');
      // ---- A FOLHA ----
      const li = [...document.querySelectorAll('#songMenuList li')];
      // PELO RÓTULO, e nunca "o primeiro `.pacote-grupo`": a folha tem duas
      // seções e a aberta é a segunda (medido: com o índice, o oráculo lia o
      // bloco FECHADO e a linha de dentro vinha nula).
      const bloco = li.find((x) => x.classList.contains('pacote-grupo') && rot(x).indexOf('Diversas') === 0);
      const barra = bloco && bloco.querySelector('.song-menu-grupo');
      const dentro = bloco && bloco.querySelector('.pacote-grupo-corpo .song-menu-btn');
      const raiz = li.find((x) => x.classList.contains('pacote-linha') && rot(x) === 'Favoritos');
      const seta = bloco && bloco.querySelector('.pacote-seta');
      // ---- A BIBLIOTECA, MONTADA NA MESMA PÁGINA ----
      // Ela é desenhada num `<ul>` fora da tela pelo caminho de verdade
      // (`renderCollectionsList`), que é o mesmo que a janela usa: um desenho
      // reconstruído à mão aqui provaria que o oráculo concorda consigo mesmo.
      const ul = document.createElement('ul');
      ul.className = 'hymnal-list';
      ul.style.cssText = 'width:390px;position:absolute;left:-9999px;top:0';
      document.body.appendChild(ul);
      const des = () => { ul.innerHTML = ''; renderCollectionsList(ul, des, { semTotal: true }); };
      const antes = grupoAberto;
      grupoAberto = 'Adoradores'; des();
      const sec = [...ul.querySelectorAll('[data-grupo]')].find((n) => n.dataset.grupo === 'Adoradores');
      const secBar = sec && sec.querySelector('.coll-group-bar');
      const card = sec && sec.querySelector('.coll-group-corpo .hymnal-card');
      const secIcone = sec && sec.querySelector('.coll-group-icon');
      const cardIcone = card && card.querySelector('.coll-bar-icon');
      const caixa = (el) => {
        if (!el) return null;
        const c = cs(el);
        return {
          w: Math.round(el.getBoundingClientRect().width),
          bg: c.backgroundColor, cor: c.color, raio: c.borderRadius,
        };
      };
      const r = {
        folha: {
          bloco: cor(bloco), barra: cor(barra), dentro: cor(dentro), raiz: cor(raiz.querySelector('.song-menu-btn')),
          seta: caixa(seta),
          icone: caixa(dentro && dentro.querySelector('.song-menu-icon')),
          // O RECUO de quem está dentro, contra o nome da seção — a distância
          // que o bloco cobrava por conter, e que a v1.8.41 devolveu.
          recuo: bloco.querySelector('.pacote-grupo-corpo .song-menu-label').getBoundingClientRect().x
            - barra.querySelector('.song-menu-label').getBoundingClientRect().x,
        },
        lib: {
          bloco: cor(sec), barra: cor(secBar), dentro: cor(card),
          seta: caixa(secIcone),
          icone: caixa(cardIcone),
          recuo: card.querySelector('.coll-bar-name').getBoundingClientRect().x
            - secBar.querySelector('.coll-group-name').getBoundingClientRect().x,
        },
      };
      ul.remove(); grupoAberto = antes;
      return r;
    });
    checar(par.folha.bloco === par.lib.bloco && par.folha.dentro === par.lib.dentro
      && par.folha.bloco !== par.folha.dentro,
      'E · o BLOCO e a linha DE DENTRO vestem AS MESMAS superfícies que a seção '
      + 'e o card da Biblioteca — e são duas, que é o relato do operador ("não '
      + 'dá para identificar o que é topo e o que é item")', JSON.stringify(par));
    checar(par.folha.barra === par.folha.bloco,
      'E · a BARRA veste o tom do próprio BLOCO, como a `.coll-group-bar` de '
      + 'lá: um tom PRÓPRIO ali seria um segundo degrau DENTRO do bloco, e a '
      + 'escada voltaria um nível abaixo', JSON.stringify(par));
    checar(par.folha.raiz === par.folha.bloco,
      'E · e uma linha da RAIZ veste o MESMO tom do bloco: a hierarquia é uma '
      + 'ALTERNÂNCIA (o que está na raiz é agrupamento), nunca uma escada de '
      + 'três degraus — sem esta metade um terceiro tom passaria',
      JSON.stringify(par));
    // ===== A SETA É A DA BIBLIOTECA, MEDIDA CONTRA A DA BIBLIOTECA =====
    // MEDIDO antes: 24px transparente, raio 0 e traço 2 aqui; 34px em
    // `--btn-accent`, raio 8px e traço 2,4 lá. Nenhum eixo em comum.
    checar(JSON.stringify(par.folha.seta) === JSON.stringify(par.lib.seta),
      'E · e a SETA do acordeão é a MESMA da Biblioteca em tamanho, tinta, cor '
      + 'e raio — não uma parecida: a classe é a `.coll-group-icon` dela, e uma '
      + 'segunda descrição do mesmo objeto divergiria no primeiro ajuste',
      JSON.stringify({ folha: par.folha.seta, lib: par.lib.seta }));
    // ===== E O QUADRADO DO ÍCONE TAMBÉM =====
    // Na Biblioteca os DOIS níveis têm o quadrado de `--hit` em `--btn-accent`
    // — é ele que põe o nome de uma seção e o de um álbum na mesma coluna. Aqui
    // a seção já ganhou o dela (a seta); sem este, a linha ficava com um glifo
    // solto de 24px transparente sob uma seta de 34 (MEDIDO), e os nomes fora
    // de prumo. A régua é a caixa DE LÁ, pelo motivo do bloco inteiro. A COR do
    // traço fica de fora: o desenho de dentro é outro (um chevron contra um
    // glifo de mídia), e o que se compara é a CAIXA.
    checar(!!par.folha.icone && par.folha.icone.w === par.lib.icone.w
      && par.folha.icone.bg === par.lib.icone.bg
      && par.folha.icone.raio === par.lib.icone.raio,
      'E · e o QUADRADO do ícone de uma linha é o do card da Biblioteca — '
      + 'tamanho, tinta e raio', JSON.stringify({ folha: par.folha.icone, lib: par.lib.icone }));

    // ===== O RECUO DE QUEM ESTÁ DENTRO É O DE LÁ =====
    // Ele era 39,2px contra 6,4px: o bloco passou a dizer "dentro" por CONTER,
    // e o recuo de texto que dizia isso antes virou a segunda cópia da resposta.
    checar(Math.abs(par.folha.recuo - par.lib.recuo) < 4,
      'E · e o RECUO de quem está dentro é o da Biblioteca — o bloco diz '
      + '"dentro" por CONTER, e o recuo de texto que dizia isso antes empurrava '
      + 'o nome seis vezes mais longe',
      JSON.stringify({ folha: par.folha.recuo, lib: par.lib.recuo }));

    // ===== A MARCA É O ✓, E ELA NÃO TROCA A SUPERFÍCIE (v1.8.41) =====
    //
    // O `--sel-fill` está CERTO onde nasceu: na folha de DESTINOS nada começa
    // marcado, e ali o preenchimento É a resposta. Aqui tudo nasce marcado — o
    // trabalho desta folha é TIRAR —, então ele pintava 100% das linhas e o que
    // apagava era a hierarquia inteira. É a regra da v5.151 num lugar novo:
    // *uma condição quase sempre verdadeira não ADIA a pergunta, ela a APAGA*.
    checar(!!marcada && marcada === par.folha.raiz,
      'E · uma linha MARCADA veste a MESMA superfície de uma desmarcada — quem '
      + 'carrega a marca é o ✓, e o preenchimento de escolhido pintava 100% '
      + 'das linhas desta folha', JSON.stringify({ marcada, desmarcada: par.folha.raiz }));
    const check = await e.pg.evaluate(() => {
      const li = [...document.querySelectorAll('#songMenuList li')]
        .find((x) => ((x.querySelector('.song-menu-label') || {}).textContent || '') === 'Favoritos');
      const c = li.querySelector('.song-menu-check');
      return { on: c.classList.contains('on'), tinta: getComputedStyle(c, '::before').backgroundColor };
    });
    // A METADE QUE IMPEDE O CONSERTO LARGO DEMAIS, e são duas. (1) O ✓ tem de
    // continuar RESPONDENDO: sem ela, apagar a marca inteira passa na de cima.
    checar(check.on === false,
      'E · e o ✓ responde: desmarcada, ele está apagado', JSON.stringify(check));
    // (2) A FOLHA DE DESTINOS NÃO PERDEU O PREENCHIMENTO. A regra que o tira é
    // escopada pelas classes desta folha, e a prova é uma linha CRUA — sem
    // `.pacote-*` — montada na mesma lista: ali o `--sel-fill` continua sendo a
    // resposta, porque lá nada começa marcado.
    const outraFolha = await e.pg.evaluate(() => {
      const ul = document.getElementById('songMenuList');
      const li = document.createElement('li');
      li.innerHTML = '<button class="song-menu-btn song-menu-sel">'
        + '<span class="song-menu-check on"></span></button>';
      ul.appendChild(li);
      const c = getComputedStyle(li.firstElementChild).backgroundColor;
      li.remove();
      return c;
    });
    checar(outraFolha !== par.folha.raiz,
      'E · e a folha de DESTINOS continua com o preenchimento de escolhido — a '
      + 'regra é escopada pelas classes desta folha, e sem esta metade apagar o '
      + '`--sel-fill` do app inteiro passaria em tudo o mais',
      JSON.stringify({ destinos: outraFolha, exportacao: par.folha.raiz }));
    // DE VOLTA AO ESTADO EM QUE A FOLHA NASCEU: as asserções de baixo exportam,
    // e o que elas medem é o pacote INTEIRO.
    await tocar(e.pg, 'Diversas', 'seta');
    await tocar(e.pg, 'Diversas');
    await tocar(e.pg, 'Favoritos');

    // ===== ABRIR E FECHAR ANIMA, COMO NA BIBLIOTECA (v1.8.42) =====
    //
    // Pedido do operador: *"na biblioteca temos animações de abertura e
    // fechamento das listas e grupos, faça essa animação ali no exportar
    // também"*.
    //
    // A RÉGUA É A `Animation` EM CURSO, e não o desfecho: o corpo aparece nas
    // duas versões, e "a seção abriu" passa com e sem animação. Quem separa as
    // duas é haver uma animação RODANDO no quadro seguinte ao toque.
    //
    // E O FECHAR É A METADE QUE FALHA CALADA: ali o redesenho APAGA o nó, e um
    // nó apagado não desliza — é a assimetria da `alternar` da Biblioteca (anima
    // ANTES de remontar). Sem ela o corpo simplesmente some, e nada na tela diz
    // que faltou alguma coisa.
    {
      const abrir = await e.pg.evaluate(async () => {
        const li = [...document.querySelectorAll('#songMenuList li')]
          .find((x) => ((x.querySelector('.song-menu-label') || {}).textContent || '') === 'Adoradores');
        li.querySelector('.pacote-seta').click();
        await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
        const novo = [...document.querySelectorAll('#songMenuList li')]
          .find((x) => ((x.querySelector('.song-menu-label') || {}).textContent || '') === 'Adoradores');
        const corpo = novo && novo.querySelector('.pacote-grupo-corpo');
        const anims = corpo ? corpo.getAnimations().filter((a) => a.playState === 'running') : [];
        return {
          temCorpo: !!corpo,
          rodando: anims.length,
          // A ALTURA é o que a animação percorre: uma que anime só a opacidade
          // faria a lista PULAR e depois desbotar, que é o que a Biblioteca não
          // faz. A propriedade é lida do próprio `KeyframeEffect`.
          altura: anims.some((a) => {
            const k = a.effect && a.effect.getKeyframes ? a.effect.getKeyframes() : [];
            return k.some((q) => 'height' in q);
          }),
        };
      });
      checar(abrir.temCorpo === true, 'E · a seção abre e o corpo dela existe',
        JSON.stringify(abrir));
      checar(abrir.rodando > 0 && abrir.altura === true,
        'E · e ela DESLIZA: há uma animação de ALTURA em curso no corpo, a mesma '
        + 'do acordeão da Biblioteca — "a seção abriu" passa com e sem animação, '
        + 'e é por isso que a régua é a `Animation`', JSON.stringify(abrir));
      // FECHAR: o corpo tem de CONTINUAR no documento logo depois do toque, e
      // animando. Sem a metade que anima ANTES de remontar, o redesenho o apaga
      // no mesmo quadro e o que se mede é a ausência.
      const fechar = await e.pg.evaluate(async () => {
        const li = [...document.querySelectorAll('#songMenuList li')]
          .find((x) => ((x.querySelector('.song-menu-label') || {}).textContent || '') === 'Adoradores');
        const corpo = li.querySelector('.pacote-grupo-corpo');
        li.querySelector('.pacote-seta').click();
        await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
        const anims = corpo.isConnected
          ? corpo.getAnimations().filter((a) => a.playState === 'running') : [];
        return { vivo: corpo.isConnected, rodando: anims.length };
      });
      checar(fechar.vivo === true && fechar.rodando > 0,
        'E · e FECHAR anima ANTES de remontar — o redesenho apaga o nó, e um nó '
        + 'apagado não tem como sair deslizando: é a assimetria da `alternar` '
        + 'da Biblioteca', JSON.stringify(fechar));
      // E ELE SOME NO FIM: sem esta, "nunca remontar" passaria na de cima e a
      // seção ficaria aberta para sempre.
      const sumiu = await esperar(e.pg, () => {
        const li = [...document.querySelectorAll('#songMenuList li')]
          .find((x) => ((x.querySelector('.song-menu-label') || {}).textContent || '') === 'Adoradores');
        return !!li && !li.querySelector('.pacote-grupo-corpo');
      }, null, 4000);
      checar(sumiu === true,
        'E · e o corpo SOME quando a animação termina — sem esta, "nunca '
        + 'remontar" passaria na de cima', porque(sumiu));
    }

    // ===== A ALFABÉTICA, NAS DUAS COLETÂNEAS =====
    // `Diversas` está na lista do `ehAlfabetica` e `Adoradores` não: as duas
    // foram semeadas fora de ordem, e só uma delas se conserta. Sem o par, uma
    // ordenação aplicada a TODAS passaria na primeira metade.
    // UMA SEÇÃO ABERTA POR VEZ — é o rodízio da Biblioteca, e a folha o herda.
    // Ler as duas de uma passada devolveria a segunda e uma lista VAZIA para a
    // primeira (medido: foi assim que esta asserção reprovou o app estando
    // certo). Cada uma é aberta e lida na vez dela.
    const dentroDe = async (nome) => {
      await tocar(e.pg, nome, 'seta');
      const l = await lerFolha(e.pg);
      const i = l.findIndex((x) => x.grupo && x.rotulo === nome);
      const out = [];
      for (let k = i + 1; k < l.length && l[k].dentro; k++) out.push(l[k].rotulo);
      return out;
    };
    const naDiversas = await dentroDe('Diversas');
    const naAdoradores = await dentroDe('Adoradores');
    checar(JSON.stringify(naDiversas) === JSON.stringify(['Beta', 'Omega']),
      'E · e os álbuns de uma coletânea ALFABÉTICA saem por NOME, não pela '
      + 'ordem do banco — semeados "Omega, Beta", a folha mostra "Beta, Omega"',
      JSON.stringify(naDiversas));
    checar(JSON.stringify(naAdoradores) === JSON.stringify(['Zeta', 'Alfa']),
      'E · e uma coletânea que NÃO está na lista mantém a ordem do catálogo — '
      + 'sem esta metade, ordenar TUDO passaria na de cima e apagaria a '
      + 'curadoria de quem a tem', JSON.stringify(naAdoradores));

    // ===== O PESO ERRA PARA CIMA =====
    // A régua é a DESIGUALDADE contra o arquivo que sai, e não um número: o que
    // o operador precisa é que o que ele leu na folha nunca seja menor que o
    // que ele vai escrever. MEDIDO antes do lote: com `bytesEstado: 0` a folha
    // mostrava 14,7% da realidade neste mesmo cenário.
    const prometido = await e.pg.evaluate(() => {
      const t = (document.querySelector('#songMenuPopup .song-menu-go') || {}).textContent || '';
      const m = /([\d.,]+)\s*(B|KB|MB|GB)/.exec(t);
      if (!m) return -1;
      const u = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 }[m[2]];
      return Number(String(m[1]).replace('.', '').replace(',', '.')) * u;
    });
    checar(prometido > 0,
      'E · o confirmar da folha diz um peso', String(prometido));
    await e.pg.click('#songMenuPopup .song-menu-go');
    const fimE = await fimDaExportacao(e.pg);
    checar(fimE && fimE.dialogo === false, 'E · a exportação termina', JSON.stringify(fimE));
    const escreveu = await e.pg.evaluate(() => {
      let n = 0;
      for (const p of window.__saida) n += p.length;
      return n;
    });
    checar(prometido >= escreveu,
      'E · e o PESO PROMETIDO NUNCA É MENOR que o que o arquivo pesou — é o '
      + 'pedido inteiro: "questão de espaço deve ser algo que tem certeza de '
      + 'caber". REVERSÃO: com `bytesEstado: 0` (o estado valendo zero) o '
      + 'prometido cai abaixo do escrito e esta linha reprova',
      JSON.stringify({ prometido, escreveu, razao: (prometido / escreveu).toFixed(2) }));
    // A METADE QUE IMPEDE O CONSERTO LARGO DEMAIS: multiplicar o número por dez
    // também passaria na de cima. O teto é FROUXO de propósito — ele não afirma
    // uma precisão, afirma que a estimativa continua sendo uma estimativa e não
    // um número inventado.
    checar(prometido <= escreveu * 3,
      'E · e ele continua NA ORDEM DE GRANDEZA do arquivo — sem esta, "prometa '
      + 'sempre o dobro" passaria na de cima e a folha deixaria de informar '
      + 'qualquer coisa',
      JSON.stringify({ prometido, escreveu }));

    // ===== O RELATÓRIO DA IMPORTAÇÃO FALA EM COLETÂNEAS =====
    // Ele é montado sobre o banco DESTE aparelho a partir da contagem que a
    // importação devolve, e é isso que o oráculo exercita: o operador não
    // conhece "album-omega", conhece "Diversas".
    const rel = await e.pg.evaluate(() => pacoteRelatorio(
      { colecoes: ['album-zeta', 'album-alfa', 'album-omega', 'album-beta'], media: 0 }, ''));
    const linhasRel = String(rel).split('\n').filter((x) => x.trim());
    checar(/Adoradores/.test(rel) && /Diversas/.test(rel),
      'E · o relatório da importação NOMEIA as coletâneas — os grupos que o '
      + 'operador vê na Biblioteca', rel);
    checar(!/album-/.test(rel) && !/Alfa|Beta|Omega|Zeta/.test(rel),
      'E · e NÃO nomeia os álbuns um a um: quatro coleções viraram duas linhas, '
      + 'que é o pedido — e com vinte e três seriam duas do mesmo jeito', rel);
    // A ORDEM DO RELATÓRIO É A DA BIBLIOTECA, pelo mesmo argumento da folha: o
    // operador procura o grupo onde ele já sabe que ele está.
    checar(linhasRel.findIndex((l) => /Adoradores/.test(l))
      < linhasRel.findIndex((l) => /Diversas/.test(l)),
      'E · e na ORDEM DA BIBLIOTECA — "incompletas primeiro" mandava o operador '
      + 'procurar um grupo onde ele não está', JSON.stringify(linhasRel));
    await e.ctx.close();
  }

  // ── F. O "SALVAR" NÃO ROLA COM A LISTA (v1.8.60) ────────────────────────
  //
  // Relato do operador sobre a v1.8.59, verbatim: *"verifique também o scroll
  // do exportar, que está com o botão de salvar dentro do scroll, ao invés de
  // ficar fora, fixo na base, com suas margens corretamente"*.
  //
  // A `.song-menu-go-row` era o ÚLTIMO `<li>` da `.popup-list`. Nesta folha
  // isso é o defeito inteiro: a lista é o acervo agrupado, ela rola de
  // verdade, e o "Salvar 3,4 GB" é o desfecho e o único botão que a folha tem.
  //
  // A ASSERÇÃO É DE POSIÇÃO NA ÁRVORE **E** DE PIXEL. Só a primeira aprovaria
  // um rodapé que existe e sai da tela; só a segunda aprovaria um botão que
  // ainda vive na lista mas que a rolagem do cenário não chegou a esconder.
  {
    const f = await aparelho();
    await f.pg.evaluate(() => setAppMode('full'));
    // A LISTA PRECISA TRANSBORDAR, e é a RECEITA DO CENÁRIO E que a produz:
    // catálogo de álbuns, um arquivo no OPFS por álbum e o índice da coleção.
    // Doze deles enchem a folha a 430×900. Sem transbordo o botão está à vista
    // com e sem o conserto, e o bloco aprovaria qualquer coisa.
    const ALBUNS = Array.from({ length: 12 }, (_, i) => 'p' + i);
    await f.pg.evaluate(async (ids) => {
      // UMA CATEGORIA POR ÁLBUM: a folha agrupa por categoria e desenha a
      // SEÇÃO fechada, então doze álbuns numa categoria só dão UMA linha.
      await AVDB.setState('albumCatalog', {
        categories: ids.map((id, i) => ({ id_category: i + 1, name: 'Coletânea ' + i,
          order: i + 1, albums: [{ id_album: id, order: 1 }] })),
        albums: ids.map((id, i) => ({ id_album: id, name: 'Álbum ' + i })),
      });
    }, ALBUNS);
    await f.pg.reload({ waitUntil: 'domcontentloaded' });
    await esperar(f.pg, () => !document.getElementById('splash'), null, 30000);
    await f.pg.evaluate(() => setAppMode('full'));
    await f.pg.evaluate(async (ids) => {
      for (const id of ids) {
        const cam = 'folders/album-' + id + '/faixa.m4a';
        await AVDB.opfsWriteFile(cam, new Blob([new Uint8Array(4000).fill(1)], { type: 'audio/mp4' }));
        await AVDB.fileAdd({ id: 'f-' + id, folder: 'album-' + id, opfsPath: cam,
          name: 'Faixa de ' + id, type: 'audio/mp4', kind: 'audio', size: 4000,
          thumb: null, blob: null, url: null, addedAt: 1 });
        await AVDB.setState('coll:album-' + id, { songs: [{ id_music: 1, fileIdFull: 'f-' + id }] });
      }
    }, ALBUNS);
    await f.pg.evaluate(() => { window.__fimF = exportarPacote(); });
    const abriu = await abriuFolha(f.pg);
    checar(abriu === true, 'F · a folha de grupos abriu', porque(abriu));
    const pos = await f.pg.evaluate(async () => {
      const z = (ms) => new Promise((r) => setTimeout(r, ms));
      const lista = document.getElementById('songMenuList');
      const go = document.querySelector('#songMenuPopup .song-menu-go');
      if (!go) return { erro: 'sem botão de salvar' };
      // ROLA ATÉ O TOPO: é o estado em que o defeito aparece — com a lista no
      // fim o botão estava à vista mesmo antes do conserto.
      lista.scrollTop = 0; await z(300);
      const lr = lista.getBoundingClientRect();
      const gr = go.getBoundingClientRect();
      return {
        naLista: lista.contains(go),
        noFecho: !!go.closest('.popup-fecho'),
        transborda: lista.scrollHeight - lista.clientHeight,
        // O botão está inteiro ABAIXO da base da lista, isto é, no rodapé.
        abaixoDaLista: +(gr.top - lr.bottom).toFixed(2),
        visivel: gr.height > 0 && gr.bottom <= innerHeight + 1 && gr.top >= 0,
        alturaFolha: +document.querySelector('#songMenuPopup .popup-sheet')
          .getBoundingClientRect().height.toFixed(2),
      };
    });
    checar(!pos.erro && pos.transborda > 40,
      'F · e a lista de grupos TRANSBORDA de verdade (' + pos.transborda + 'px) — '
      + 'sobre uma lista que cabe inteira o botão está à vista com e sem o '
      + 'conserto, e a asserção abaixo aprovaria qualquer coisa', JSON.stringify(pos));
    checar(!pos.erro && !pos.naLista && pos.noFecho,
      'F · o "Salvar" mora no `.popup-fecho`, FORA do scroller — ele era o '
      + 'último `<li>` da lista, e só aparecia depois de rolar o acervo inteiro',
      JSON.stringify(pos));
    checar(!pos.erro && pos.abaixoDaLista >= 0 && pos.visivel,
      'F · e com a lista NO TOPO ele continua na tela, abaixo dela ('
      + pos.abaixoDaLista + 'px) — a posição na árvore sozinha aprovaria um '
      + 'rodapé que sai da folha', JSON.stringify(pos));
    await f.ctx.close();
  }

  checar(erros.length === 0, 'nenhum erro de console', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
