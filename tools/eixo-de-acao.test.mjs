#!/usr/bin/env node
// ============================================================================
// O PAR DE AÇÃO: ⏮/⏭ VIRAM ZERAR E INICIAR/SORTEAR (v1.9.4)
//
// Pedido do operador: *"Para o sorteio, cronômetro ou timer, quando eles
// estiverem sendo exibidos no telão, seja pela aba de ferramentas ou direto
// pelo cronograma. Faça com que os botões de próximo slide e slide anterior,
// alterem seus icones e funcionem como: esquerdo, resetar e direito, ação de
// playpause/sortear."*
//
// ## Por que ele existe
//
// Até aqui `slideTarget()` calava o par com uma guarda TRIPLA
// (`chronoProjecting() || drawProjecting() || visualSobreProjetando()`), e o
// que sustentava a decisão era *"este cartão não tem para onde ir"*. Vale para
// a IMAGEM SOBREPOSTA — ali o cartão é opaco e o eixo cairia na letra do áudio
// escondida atrás dele — e não vale para os outros dois: o cronômetro e o
// sorteio TÊM o que acionar, e quem os aciona é o rodapé de uma FOLHA que pode
// nunca ter sido aberta. Uma cena de tempo vinda do Cronograma projeta sem
// montar rodapé nenhum, e o operador ficava sem um único botão na tela.
//
// ## O que falha CALADO aqui, e por isso cada item tem asserção própria
//
//  - **a folha FECHADA.** É o caso que motivou o pedido, e é o único que um
//    oráculo escrito de dentro da folha não alcança: com ela aberta os dois
//    quadrados do rodapé existem, e o par ao lado da preview vira redundância.
//    Daí o bloco A abrir com a PREMISSA `ferramentasAbertas() === false`.
//  - **as DUAS PORTAS.** O pedido nomeia as duas ("seja pela aba de ferramentas
//    ou direto pelo cronograma"), e elas entram por funções diferentes
//    (`projetarTempoCue` × `miscProjectState().act`). A do roteiro ainda ARMA a
//    contagem (`chrono.running = chrono.mode !== 'clock'`), então as duas
//    chegam ao mesmo alvo por estados diferentes — e o bloco B compara o
//    desfecho, não o caminho.
//  - **o RELÓGIO.** Ele não se pausa nem se zera, e um par aceso ali é
//    exatamente o botão inerte que a v1.8.50 existe para não deixar nascer.
//    A régua é o `disabled` MAIS o desenho: um par que voltasse ao chevron e
//    continuasse habilitado passaria por metade.
//  - **DUAS RÉGUAS PARA A MESMA PERGUNTA.** O `disabled` do par e o do
//    `#chronoRun`/`#drawGoBtn`/`#drawResetBtn` respondem à mesma coisa, e o
//    lote os fez ler as MESMAS funções (`chronoRunApagado`, `drawGoApagado`,
//    `drawResetApagado`). Duas contas divergiriam no primeiro ajuste — e
//    divergiriam CALADAS, com um botão aceso de um lado da tela e apagado do
//    outro para a MESMA ação. O bloco E varre nove estados e exige igualdade;
//    ele carrega junto a guarda anti-tautologia (os nove não podem ter dado
//    todos o mesmo par de valores, senão um `false` constante passaria).
//  - **A CAIXA FICA COM O CSS** (a armadilha da v1.8.68). Um `width` de
//    atributo no `<svg>` novo coincidiria com o degrau certo por acidente e
//    deixaria de coincidir no dia em que alguém mexer no token. O bloco F mede
//    o COMPUTADO e, mais que isso, FORÇA `--icon-md` a outro valor: só quem
//    obedece ao token o segue.
//  - **A REPINTURA A CADA PULSO.** `renderTransportAxis` roda dentro do
//    `renderSlideNav`, que o `timeupdate` da preview dispara a ~4 Hz. Sem a
//    guarda `dataset.desenho` o nó do ícone é trocado dezenas de vezes por
//    minuto debaixo do dedo. O bloco G mede a IDENTIDADE do nó — e mede também
//    que ele TROCA quando o estado muda, senão um renderizador que nunca
//    desenha passaria pela metade.
//  - **AS SUPERFÍCIES QUE NÃO PODEM VER O PAR.** A coluna da tela cheia e os
//    ⏮/⏭ da notificação roteiam pelo eixo (`if (slideTarget()) slideBtn()
//    .click()`), e o desenho DELAS é outro — a seta com barra, copiada inline,
//    que não acompanha esta troca. Deixá-las ver `chrono` faria a tela de
//    bloqueio ZERAR a contagem com o desenho de "mídia anterior" na frente.
//    Daí o `eixoForaDoPainel()`, e daí o bloco I.
//  - **DOIS PLAY/PAUSE A DEZ CENTÍMETROS.** Com o cartão no ar e nada de áudio
//    por baixo, o ▶ do transporte sempre foi aceso e inerte (o handler volta na
//    primeira linha). Isso passava despercebido enquanto ele era o único
//    play/pause da tela; com o par ao lado da preview virando o play/pause DO
//    CRONÔMETRO, o estado passou a ser o pior desfecho possível da v1.8.50.
//    O bloco J mede as DUAS metades — porque apagá-lo sempre levaria junto o
//    caso legítimo (o louvor de fundo tocando por baixo do cartão).
//
// ## A régua, em toda parte
//
// **O COMANDO QUE SAI NO BARRAMENTO ou o VALOR COMPUTADO, nunca uma classe.**
// Um `.active` prova que o JS escreveu um atributo, que é o que não está em
// dúvida; o que decide o culto é o `text`/`chrono` que chega ao telão e o pixel
// que o operador vê. O espião é um `BroadcastChannel` de verdade — o MESMO
// canal do `db.js` —, e não um `window.cmd` embrulhado: é o barramento que a
// outra ponta escuta.
//
//   node tools/eixo-de-acao.test.mjs
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperarCortina, checar, falhas, RAIZ_WEB, esperar, porque,
} from './arnes.mjs';

// ===== A PONTE DE MENTIRA =====
//
// O modo avançado é o território deste oráculo, e `pushNowPlaying` volta na
// PRIMEIRA linha sem `__NATIVE__` — o bloco I não teria o que medir.
//
// A LISTA É A SUPERFÍCIE INTEIRA que o `native.js` chama, e isso é regra do
// projeto, não zelo: um método que falte devolve `undefined`, a Promise fica
// pendurada até o `CALL_TIMEOUT_MS` (UM MINUTO) e resolve `null` — o mesmo
// desfecho que a allowlist produziria, só que 60 s depois e sem nada no log.
// A varredura que a mantém em dia:
//   grep -oE 'B\.[a-zA-Z]+\(' shared/native.js | sed 's/^B\.//;s/(//' | sort -u
const PONTE = `(() => {
  window.__np = [];
  const B = {
    shellVersion: () => 72,
    role: () => 'controle',
    appVersion: () => '1.9.4-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    // O QUE O BLOCO I MEDE: o cartão que a notificação de mídia publica. Ele é
    // remontado campo a campo pelo \`native.js\`, então o que chega aqui é o que
    // chegaria ao Kotlin.
    nowPlaying: (s) => { try { window.__np.push(JSON.parse(s)); } catch (_) {} },
  };
  const nomes = ['apkInstalar','areaTransferencia','atualizacaoEstado','bgConcluido','bgProgress',
    'captureVolumeKeys','castTarget','saidaDeAudioAlvo','cifraDiag','cifraHtml','compartilharTexto','deckDiscard',
    'deckExportUrl','deckPages','displays','espelhoCertApagar','espelhoCertEstado',
    'espelhoCertImportar','espelhoDerrubar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','espelhoLigarEm','farolEstado','keepAlive','listFolder','openCast','abrirSaidaDeAudio',
    'openExternal','otaApply','otaCheck','otaDiag','pacoteCancelar','pacoteCompartilhar',
    'pacoteConsumirOrigem','pacoteCriar','pacoteCriarLocal','pacoteDescartarPronto','pacoteDiag',
    'pacoteEspaco','pacoteFechar','pacoteProntoEstado','pickDoc','pickFolder','projecaoLocal',
    'salvarTexto','systemVolume','temaClaro','ytCanalPlaylists','ytCancel','ytDetalhes','ytDiag',
    'ytDiscard','ytFetch','ytFetchAte','ytFetchAudio','ytPlaylist','ytSearch',
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

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;

// `--autoplay-policy` porque o app roda num WebView com
// `mediaPlaybackRequiresUserGesture = false`: sem a bandeira o bloco J mediria
// a política do Chromium no lugar do louvor de fundo.
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY|ERR_ABORTED/;

// O ACERVO DO TESTE. O WAV é longo de propósito (bloco J): uma faixa que acabe
// no meio da medição deixa `preview.getCurrent()` de pé mas o `playing` cai, e
// a metade "com áudio por baixo" passaria a medir outra coisa.
const SEMEAR = `
  const sr = 8000, secs = 30, n = sr * secs;
  const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  wr(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
  const png = await (await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')).blob();
  // O LOUVOR ENTRA PELO ACERVO (\`opfsWriteFile\` + \`fileAdd\` + \`listAdd\`), e não
  // por \`addMedia\`: aquela é a porta do IMPORT e NÃO TEM CAMPO DE LETRA — letra
  // nasce do sync. E a letra é o que faz o bloco H morder: sem estrofe atrás do
  // cartão, \`slideTarget()\` devolveria null pelo caminho de baixo (\`midiaNoAr\`
  // sem letra) e a asserção aprovaria a guarda REMOVIDA.
  const a = { id: 'louvor-de-fundo' };
  await AVDB.opfsWriteFile('folders/teste/louvor.wav', new Blob([buf], { type: 'audio/wav' }));
  await AVDB.fileAdd({
    id: a.id, folder: 'teste', opfsPath: 'folders/teste/louvor.wav', srcName: 'louvor.wav',
    name: 'Louvor de fundo', type: 'audio/wav', kind: 'audio', size: 1, mtime: Date.now(),
    thumb: null, blob: null, url: null, addedAt: Date.now(),
    lyrics: [{ time: 0, text: 'primeira estrofe' }, { time: 10, text: 'segunda estrofe' }],
  });
  await AVDB.listAdd('imports', a.id);
  const i = await AVDB.addMedia(png,
    { name: 'Aviso da secretaria', type: 'image/png', kind: 'image', list: 'imports' });
`;

// A SONDA DO PAR — instalada uma vez, usada por todos os blocos.
//
// Tudo aqui é COMPUTADO ou conteúdo de nó: `use[href]` diz QUAL desenho está no
// ar, `.msym` diz qual GLIFO, e as três medidas de caixa respondem à armadilha
// da v1.8.68. A `marca` é o `dataset.desenho`, que é o que a guarda de
// repintura consulta.
const INSTALAR_SONDA = () => {
  window.__olhar = () => {
    const ler = (btn) => {
      const svg = btn.querySelector('svg');
      const use = svg ? svg.querySelector('use') : null;
      const sym = btn.querySelector('.msym');
      const cs = svg ? getComputedStyle(svg) : null;
      return {
        disabled: btn.disabled,
        title: btn.title,
        rotulo: btn.getAttribute('aria-label'),
        marca: btn.dataset.desenho || '',
        use: use ? use.getAttribute('href') : null,
        glifo: sym ? sym.textContent : null,
        svgLarg: cs ? cs.width : null,
        svgAlt: cs ? cs.height : null,
        symCorpo: sym ? getComputedStyle(sym).fontSize : null,
        // O ATRIBUTO, só para o bloco F: ele existe no chevron do HTML e NÃO
        // pode existir no que o JS desenha.
        attrLarg: svg ? svg.getAttribute('width') : null,
      };
    };
    return { alvo: slideTarget(), fora: eixoForaDoPainel(),
      prev: ler(slidePrevBtnEl), next: ler(slideNextBtnEl) };
  };
  // O ESPIÃO DO BARRAMENTO — o canal de verdade, o mesmo nome do `db.js`.
  window.__bus = [];
  const bc = new BroadcastChannel('av-iasd');
  bc.addEventListener('message', (e) => window.__bus.push(e.data));
  // "Devolva o que entrou no barramento depois do marco N."
  window.__desde = (n, tipo, modo) => window.__bus.slice(n)
    .filter((c) => c && c.type === tipo && (!modo || c.mode === modo));
};

try {
  const pg = await ctx.newPage();
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push('controle: ' + t);
  });
  pg.on('pageerror', (e) => erros.push('controle pageerror: ' + e.message));

  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  {
    const r = await esperar(pg, () => window.__NATIVE__ === true && window.AVDB
      && typeof window.__avBack === 'function'
      && (!!document.querySelector('#playlist li') || document.getElementById('plBtn').disabled),
    null, 30000);
    checar(r === true, 'o Controle subiu no modo nativo', porque(r));
  }
  await pg.evaluate(() => setAppMode('full'));
  await pg.evaluate(INSTALAR_SONDA);

  const ids = await pg.evaluate(new Function('return (async () => {'
    + SEMEAR + 'await load(); return { audio: a.id, imagem: i.id }; })()'));

  // O glifo do ▶ e do ⏸ saem da TABELA DO APP, e não digitados aqui: eles são
  // caracteres de área privativa da fonte de símbolos, e uma cópia neste
  // arquivo é a segunda escrita que diverge no primeiro ajuste.
  const GLIFO = await pg.evaluate(() => ({ play: ICON.play, pause: ICON.pause }));

  // Volta ao ponto morto entre blocos: nada projetando, nada em cena. É o que
  // permite cada bloco descrever o estado dele por inteiro.
  //
  // **A ESPERA PELO `getCurrent()` NULO NÃO É ZELO.** O `stopClear` desmonta a
  // cena com um FADE de saída (~0,6 s), e `current` só cai no fim dele: sem
  // esperar, o bloco J media "sem áudio por baixo" com o louvor do bloco
  // anterior ainda de pé — MEDIDO, ele reprovou por isso na primeira escrita.
  const limpar = () => pg.evaluate(async () => {
    clearManualText();
    stopClear();
    plItems = [];
    chrono.mode = 'clock'; chrono.running = false; chrono.baseMs = 0;
    chrono.startAt = 0; chrono.durationMs = 0;
    draw.kind = 'number'; draw.min = 1; draw.max = 10;
    draw.pool = []; draw.noRepeat = true; draw.used = []; draw.value = null;
    miscTool = 'msg';
    renderSlideNav();
    for (let i = 0; i < 240 && (preview.getCurrent() || midiaNoAr); i++) {
      await new Promise((f) => requestAnimationFrame(f));
    }
    await new Promise((f) => setTimeout(f, 60));
  });

  // ======================================================================
  // A · A CENA VINDA DO CRONOGRAMA, COM A FOLHA DE FERRAMENTAS FECHADA
  // ======================================================================
  // O coração do pedido. Aqui o rodapé da folha NÃO foi montado: não existe
  // `#chronoRun`, não existe `#chronoZero`, e sem o par ao lado da preview o
  // operador não tem um único botão para pausar ou zerar a contagem que já
  // está na frente da congregação.
  await limpar();
  const cue = await pg.evaluate(async () => {
    const c = await AVDB.addCue('chrono',
      { mode: 'timer', durationMs: 300000, label: 'Contagem' },
      { name: 'Contagem regressiva', list: 'imports' });
    await load();
    await send(c.id);
    await new Promise((f) => setTimeout(f, 120));
    return { id: c.id, folha: ferramentasAbertas(), rodape: !!document.getElementById('chronoRun'),
      ...window.__olhar(), running: chrono.running };
  });
  checar(cue.folha === false && cue.rodape === false,
    'A · PREMISSA: a folha de Ferramentas está FECHADA e o rodapé dela não foi '
    + 'montado (`#chronoRun` não existe). Sem esta metade o bloco inteiro mede '
    + 'o caso fácil — com a folha aberta os dois quadrados já respondem, e o par '
    + 'ao lado da preview vira redundância',
    JSON.stringify({ folha: cue.folha, rodape: cue.rodape }));
  checar(cue.alvo === 'chrono',
    'A · e o cue de TEMPO do Cronograma dá eixo de AÇÃO ao par (`slideTarget()` '
    + '=== "chrono"): a guarda tripla que calava os três foi dividida, e só o '
    + 'terço da imagem sobreposta continua valendo', JSON.stringify(cue));
  checar(cue.prev.use === '#icoZerar' && cue.prev.disabled === false
    && cue.prev.title === 'Zerar a contagem',
    'A · o botão da ESQUERDA vira o ZERAR: o desenho é o `#icoZerar` (o mesmo '
    + 'símbolo do `#chronoZero` do rodapé), ele nasce habilitado e o `title` diz '
    + 'a ação', JSON.stringify(cue.prev));
  checar(cue.running === true && cue.next.glifo === GLIFO.pause
    && cue.next.title === 'Pausar a contagem' && cue.next.use === null,
    'A · e o da DIREITA vira o PAUSAR — o cue de roteiro ARMA a contagem '
    + '(`projetarTempoCue` escreve `running = mode !== "clock"`), então o que o '
    + 'par oferece é pausar. O ícone é a AÇÃO, nunca o estado: é a mesma regra '
    + 'do `#chronoRun`', JSON.stringify({ running: cue.running, next: cue.next }));

  // ---- O TOQUE, e o que ele MANDA AO TELÃO -------------------------------
  const toqueDir = await pg.evaluate(async () => {
    const n = window.__bus.length;
    slideNextBtnEl.click();
    await new Promise((f) => setTimeout(f, 150));
    return { cmds: window.__desde(n, 'text', 'chrono').map((c) => c.chrono),
      running: chrono.running, ...window.__olhar() };
  });
  checar(toqueDir.cmds.length === 1 && toqueDir.cmds[0].running === false,
    'A · o toque no botão da DIREITA emite um `text`/`chrono` ao barramento com '
    + '`running: false` — a régua é o COMANDO que chega ao telão, não um estado '
    + 'de memória do Controle', JSON.stringify(toqueDir.cmds));
  checar(toqueDir.next.glifo === GLIFO.play && toqueDir.next.title === 'Iniciar a contagem',
    'A · e o botão ALTERNA no mesmo pulso: pausada a contagem, ele passa a '
    + 'oferecer INICIAR. Quem o repinta é o `renderFoot` que todo mutador do '
    + 'cronômetro já chama — nenhum deles chamava `renderSlideNav`',
    JSON.stringify(toqueDir.next));

  const toqueDir2 = await pg.evaluate(async () => {
    const n = window.__bus.length;
    slideNextBtnEl.click();
    await new Promise((f) => setTimeout(f, 700));
    return { cmds: window.__desde(n, 'text', 'chrono').map((c) => c.chrono),
      baseMs: chrono.baseMs, running: chrono.running };
  });
  checar(toqueDir2.cmds.length === 1 && toqueDir2.cmds[0].running === true
    && toqueDir2.running === true,
    'A · o toque seguinte volta a INICIAR — o par é um play/pause de verdade, e '
    + 'não um botão de mão única', JSON.stringify(toqueDir2.cmds));

  // ---- O ZERAR, medido contra uma contagem que ANDOU ---------------------
  const zerar = await pg.evaluate(async () => {
    chronoPause();                        // congela o acumulado em `baseMs`
    await new Promise((f) => setTimeout(f, 80));
    const antes = chrono.baseMs;
    const n = window.__bus.length;
    slidePrevBtnEl.click();
    await new Promise((f) => setTimeout(f, 150));
    return { antes, depois: chrono.baseMs,
      cmds: window.__desde(n, 'text', 'chrono').map((c) => c.chrono) };
  });
  checar(zerar.antes > 200,
    'A · (a contagem de fato ANDOU antes do zerar — sem isto o `baseMs: 0` '
    + 'abaixo seria o valor que já estava lá, e a asserção aprovaria um botão '
    + 'que não faz nada)', JSON.stringify(zerar));
  checar(zerar.cmds.length === 1 && zerar.cmds[0].baseMs === 0 && zerar.depois === 0,
    'A · o toque no botão da ESQUERDA emite `text`/`chrono` com `baseMs: 0` — a '
    + 'contagem volta ao começo no TELÃO, que é onde ela está sendo lida',
    JSON.stringify(zerar));

  // ======================================================================
  // B · AS DUAS PORTAS CHEGAM AO MESMO PAR
  // ======================================================================
  // *"seja pela aba de ferramentas ou direto pelo cronograma"* — são funções
  // diferentes (`projetarTempoCue` × `miscProjectState().act`), e a do roteiro
  // ainda arma a contagem. O que este bloco afirma é o DESFECHO comum: o mesmo
  // alvo, o mesmo desenho à esquerda, e um botão da direita que aciona.
  await limpar();
  const pelaFolha = await pg.evaluate(async () => {
    document.getElementById('toolsBtn').click();
    await new Promise((f) => setTimeout(f, 300));
    miscTool = 'chrono';
    toolsBodyEl.innerHTML = '';
    renderDiversos();
    chronoSetMode('timer');
    chronoSetDuration(300000);
    await new Promise((f) => setTimeout(f, 60));
    document.getElementById('miscProjectBtn').click();
    await new Promise((f) => setTimeout(f, 150));
    const inicial = window.__olhar();
    const n = window.__bus.length;
    slideNextBtnEl.click();
    await new Promise((f) => setTimeout(f, 150));
    return { folha: ferramentasAbertas(), projetando: chronoProjecting(), inicial,
      cmds: window.__desde(n, 'text', 'chrono').map((c) => c.chrono),
      depois: window.__olhar(), running: chrono.running };
  });
  checar(pelaFolha.folha === true && pelaFolha.projetando === true,
    'B · PREMISSA: a outra porta é o "Projetar no telão" da folha de Ferramentas, '
    + 'e ela está aberta desta vez',
    JSON.stringify({ folha: pelaFolha.folha, projetando: pelaFolha.projetando }));
  checar(pelaFolha.inicial.alvo === 'chrono'
    && pelaFolha.inicial.prev.use === '#icoZerar'
    && pelaFolha.inicial.next.glifo === GLIFO.play
    && pelaFolha.inicial.next.title === 'Iniciar a contagem',
    'B · e ela chega ao MESMO par: eixo "chrono", zerar à esquerda, e o INICIAR à '
    + 'direita (aqui a contagem não vem armada — a folha projeta o que estava '
    + 'parado)', JSON.stringify(pelaFolha.inicial));
  checar(pelaFolha.cmds.length === 1 && pelaFolha.cmds[0].running === true
    && pelaFolha.running === true && pelaFolha.depois.next.glifo === GLIFO.pause,
    'B · e o toque nele INICIA de verdade, pelo mesmo comando de barramento do '
    + 'bloco A — as duas portas divergem no estado inicial e convergem no que o '
    + 'par faz', JSON.stringify({ cmds: pelaFolha.cmds, next: pelaFolha.depois.next }));

  // ======================================================================
  // C · O RELÓGIO FICA SEM EIXO
  // ======================================================================
  // A única exceção da divisão da guarda: ele não se pausa nem se zera, e o
  // rodapé dele traz os dois seletores de FORMATO no lugar do transporte.
  const relogio = await pg.evaluate(async () => {
    chronoSetMode('clock');
    await new Promise((f) => setTimeout(f, 120));
    return { projetando: chronoProjecting(), modo: chrono.mode, ...window.__olhar() };
  });
  checar(relogio.projetando === true && relogio.modo === 'clock',
    'C · PREMISSA: o cronômetro continua PROJETANDO, e o modo é o Relógio — a '
    + 'diferença é só o modo, e é ela que este bloco mede',
    JSON.stringify({ projetando: relogio.projetando, modo: relogio.modo }));
  checar(relogio.alvo === null,
    'C · e o RELÓGIO fica sem eixo: `slideTarget()` volta a null. Um par aceso '
    + 'ali seria o botão inerte que a v1.8.50 existe para não deixar nascer',
    JSON.stringify(relogio));
  checar(relogio.prev.use === '#icoSlidePrev' && relogio.next.use === '#icoSlideNext'
    && relogio.next.glifo === null,
    'C · os dois VOLTAM ao chevron — o desenho é reversível, e o glifo do ▶ sai '
    + 'do nó junto com o eixo', JSON.stringify([relogio.prev.use, relogio.next.use]));
  checar(relogio.prev.disabled === true && relogio.next.disabled === true
    && relogio.prev.title === 'Slide anterior' && relogio.next.title === 'Próximo slide',
    'C · e ficam DESABILITADOS, com o nome genérico: sem as duas metades um par '
    + 'que voltasse ao chevron e continuasse habilitado passaria pela metade',
    JSON.stringify([relogio.prev, relogio.next]));

  // ======================================================================
  // D · O SORTEIO
  // ======================================================================
  await limpar();
  const sorteio = await pg.evaluate(async () => {
    draw.kind = 'text';
    draw.pool = ['Ana', 'Bruno', 'Carla'];
    draw.noRepeat = true; draw.used = []; draw.value = null;
    projectDraw();
    await new Promise((f) => setTimeout(f, 120));
    return { projetando: drawProjecting(), ...window.__olhar() };
  });
  checar(sorteio.projetando === true && sorteio.alvo === 'draw',
    'D · o sorteio projetado dá eixo de AÇÃO ao par', JSON.stringify(sorteio));
  checar(sorteio.next.use === '#icoSorteio' && sorteio.next.disabled === false
    && sorteio.next.title === 'Sortear',
    'D · o botão da DIREITA é o SORTEAR, com o `#icoSorteio` — o mesmo símbolo do '
    + '`#drawGoBtn` do rodapé', JSON.stringify(sorteio.next));
  // O `title` NOMEIA A AÇÃO, e não o motivo do apagado: é a regra da família
  // dele — os dois botões de slide dizem "Slide anterior"/"Próximo slide"
  // desabilitados desde sempre. Quem diz POR QUÊ é o quadrado do RODAPÉ
  // (`#drawResetBtn` → "Nada sorteado ainda"), que é de outra família.
  checar(sorteio.prev.use === '#icoZerar' && sorteio.prev.disabled === true
    && sorteio.prev.title === 'Reiniciar o sorteio',
    'D · e o da ESQUERDA nasce DESABILITADO: sem nada sorteado não há o que '
    + 'reiniciar, e o que não tem função agora é APAGADO, não deixado inerte '
    + '(v1.8.50)', JSON.stringify(sorteio.prev));

  const sorteou = await pg.evaluate(async () => {
    const n = window.__bus.length;
    slideNextBtnEl.click();
    await new Promise((f) => setTimeout(f, 150));
    return { valor: draw.value, usados: draw.used.slice(),
      cmds: window.__desde(n, 'text', 'draw').map((c) => c.draw),
      ...window.__olhar() };
  });
  checar(sorteou.valor && ['Ana', 'Bruno', 'Carla'].includes(sorteou.valor)
    && sorteou.cmds.length === 1 && sorteou.cmds[0].value === sorteou.valor,
    'D · o toque SORTEIA de verdade — o valor sai da lista e viaja no `text`/'
    + '`draw` que vai ao telão', JSON.stringify({ valor: sorteou.valor, cmds: sorteou.cmds }));
  checar(sorteou.next.title === 'Sortear de novo' && sorteou.prev.disabled === false
    && sorteou.prev.title === 'Reiniciar o sorteio',
    'D · e o par se reescreve: o direito passa a dizer "de novo" e o esquerdo '
    + 'ACENDE, porque agora há histórico para reiniciar',
    JSON.stringify([sorteou.prev, sorteou.next]));

  const reiniciou = await pg.evaluate(async () => {
    const n = window.__bus.length;
    slidePrevBtnEl.click();
    await new Promise((f) => setTimeout(f, 150));
    return { valor: draw.value, usados: draw.used.slice(),
      cmds: window.__desde(n, 'text', 'draw').map((c) => c.draw), ...window.__olhar() };
  });
  checar(reiniciou.valor === null && reiniciou.usados.length === 0
    && reiniciou.cmds.length === 1 && !reiniciou.cmds[0].value,
    'D · e o toque na ESQUERDA reinicia: o histórico esvazia e o telão recebe um '
    + '`text`/`draw` sem valor', JSON.stringify(reiniciou.cmds));
  checar(reiniciou.prev.disabled === true && reiniciou.next.title === 'Sortear',
    'D · voltando o par ao estado de estreia — a régua é a MESMA nos dois '
    + 'sentidos', JSON.stringify([reiniciou.prev, reiniciou.next]));

  // ======================================================================
  // E · A RÉGUA É UMA: O PAR E O RODAPÉ APAGAM JUNTOS
  // ======================================================================
  // Nove estados, a folha ABERTA (é o único jeito de os dois quadrados
  // existirem para comparar). O que este bloco impede é a SEGUNDA CONTA: um
  // ajuste em `chronoRunApagado`/`drawGoApagado`/`drawResetApagado` que não
  // chegasse ao par deixaria um botão aceso de um lado da tela e apagado do
  // outro, para a MESMA ação, sem erro em lugar nenhum.
  await limpar();
  const regua = await pg.evaluate(async () => {
    const z = (ms) => new Promise((f) => setTimeout(f, ms));
    document.getElementById('toolsBtn').click();
    await z(300);
    const linhas = [];
    const medir = async (nome, esqId, dirId) => {
      await z(60);
      const esq = document.getElementById(esqId);
      const dir = document.getElementById(dirId);
      linhas.push({ nome,
        rodapeEsq: esq ? esq.disabled : 'ausente',
        parEsq: slidePrevBtnEl.disabled,
        rodapeDir: dir ? dir.disabled : 'ausente',
        parDir: slideNextBtnEl.disabled,
        alvo: slideTarget() });
    };
    // ---- TEMPO ----
    // A ORDEM É A RÉGUA, e ela foi escolhida por REVERSÃO. `chronoRunApagado`
    // pergunta TRÊS coisas (`mode === 'timer'`, `!running`, `durationMs <= 0`),
    // e uma segunda conta que esqueça a PRIMEIRA delas — a escrita ingênua,
    // `!running && durationMs <= 0` — passa em toda medição feita com uma
    // duração já escolhida. A célula que as separa é o CRONÔMETRO PARADO COM O
    // TIMER AINDA EM 0:00, que é o estado de estreia do app (o timer nasce em
    // 0:00 desde a v1.8.95): ali a régua de verdade ACENDE o ▶ e a ingênua o
    // apaga. Por isso os dois estados de cronômetro vêm ANTES do
    // `chronoSetDuration(60000)`, e não depois.
    miscTool = 'chrono'; toolsBodyEl.innerHTML = ''; renderDiversos();
    chronoSetMode('timer');
    projectChrono();
    chronoSetDuration(0);
    await medir('timer vazio (0:00)', 'chronoZero', 'chronoRun');
    chronoSetMode('stopwatch');
    await medir('cronômetro parado, timer ainda em 0:00', 'chronoZero', 'chronoRun');
    chronoStart();
    await medir('cronômetro correndo', 'chronoZero', 'chronoRun');
    chronoPause();
    chronoSetMode('timer');
    chronoSetDuration(60000);
    await medir('timer com 1 min', 'chronoZero', 'chronoRun');
    chronoStart();
    await medir('timer correndo', 'chronoZero', 'chronoRun');
    chronoPause();
    hideChrono();
    clearChronoSession();
    // ---- SORTEIO ----
    miscTool = 'draw'; toolsBodyEl.innerHTML = ''; renderDiversos();
    draw.kind = 'text'; draw.pool = []; draw.noRepeat = true;
    draw.used = []; draw.value = null;
    projectDraw();
    renderDiversos();
    await medir('sorteio de texto sem opções', 'drawResetBtn', 'drawGoBtn');
    draw.pool = ['Ana']; renderDiversos();
    await medir('uma opção, nada sorteado', 'drawResetBtn', 'drawGoBtn');
    doDraw();
    await medir('uma opção, esgotada', 'drawResetBtn', 'drawGoBtn');
    drawReset();
    draw.kind = 'number'; draw.min = 1; draw.max = 5; renderDiversos();
    await medir('faixa numérica de 1 a 5', 'drawResetBtn', 'drawGoBtn');
    hideDraw(); clearDrawSession();
    return linhas;
  });
  const divergem = regua.filter((l) => l.rodapeEsq !== l.parEsq || l.rodapeDir !== l.parDir);
  checar(regua.length === 9 && divergem.length === 0,
    'E · em NOVE estados o `disabled` do par e o dos dois quadrados do rodapé são '
    + 'IGUAIS — não há segunda conta: `chronoRunApagado`, `drawGoApagado` e '
    + '`drawResetApagado` são as MESMAS funções nos dois lados',
    JSON.stringify(divergem.length ? divergem : { medidos: regua.length }));
  // ANTI-TAUTOLOGIA: se os nove estados dessem o mesmo par de valores, um
  // `disabled = false` constante nos dois lados passaria acima sem medir nada.
  const combos = new Set(regua.map((l) => l.parEsq + '|' + l.parDir));
  checar(combos.size >= 3,
    'E · e os nove estados NÃO deram o mesmo par de valores — sem esta metade um '
    + '`disabled` constante dos dois lados aprovaria a asserção acima',
    JSON.stringify([...combos]));
  checar(regua.every((l) => l.alvo === 'chrono' || l.alvo === 'draw'),
    'E · (e todos os nove foram medidos com o par de AÇÃO no ar — um estado que '
    + 'perdesse o eixo cairia no ramo genérico, onde os dois ficam sempre '
    + 'desabilitados e a igualdade é acidente)', JSON.stringify(regua.map((l) => l.alvo)));

  // ======================================================================
  // F · A CAIXA FICA COM O CSS (a armadilha da v1.8.68)
  // ======================================================================
  // Dois desenhos no mesmo botão medindo diferente é a divergência MUDA que a
  // v1.8.68 mediu no `.crono-limpar`: o `<svg>` de lá caía no atributo do HTML
  // e ficava 2px menor que o vizinho, com as CAIXAS dos dois botões iguais.
  //
  // A régua tem DUAS pernas, e a segunda é a que morde:
  //
  //  · o número que o HTML PROMETE. O `#slidePrevBtn` nasce com um `<svg>` de
  //    `width="22"` escrito à mão, e é esse o tamanho que o operador viu até
  //    aqui — o desenho que o JS põe no lugar tem de cair no MESMO pixel, ou o
  //    ícone encolhe ao entrar em cena e ninguém sabe por quê. O número é LIDO
  //    do arquivo, nunca digitado: uma cópia aqui divergiria no primeiro ajuste.
  //  · "os três SEGUEM o token". "Os três medem 22px" passa por acidente
  //    enquanto o token valer 22; forçado a outro valor, só quem obedece ao CSS
  //    muda junto — que é exatamente o que a v1.8.68 mediu para achar o
  //    `.crono-limpar` preso no atributo.
  const htmlFonte = fs.readFileSync(path.join(RAIZ_WEB, 'controle', 'index.html'), 'utf8');
  const chevronHtml = (htmlFonte.split('id="slidePrevBtn"')[1] || '').split('</button>')[0] || '';
  // O `\s` NÃO É ENFEITE: sem ele a expressão casa o `stroke-width="2"` do mesmo
  // `<svg>` e o número vira 2 — MEDIDO, uma reversão que apagou o atributo
  // deixou a premissa VERDE com "2" na mão.
  const largHtml = (chevronHtml.match(/\swidth="(\d+)"/) || [])[1] || '';
  checar(/^\d+$/.test(largHtml),
    'F · (o `#slidePrevBtn` do `index.html` declara um `width` no `<svg>` — sem '
    + 'esta leitura o número abaixo não existiria e a comparação aprovaria '
    + 'qualquer coisa)', JSON.stringify({ largHtml }));
  await limpar();
  const caixa = await pg.evaluate(async () => {
    const z = (ms) => new Promise((f) => setTimeout(f, ms));
    const chevron = window.__olhar();               // o par sem eixo: o desenho do HTML
    chrono.mode = 'timer'; chrono.durationMs = 60000;
    projectChrono();
    await z(120);
    const zerar = window.__olhar();                 // `<svg>` do sprite, sem atributo
    chronoStart();
    await z(120);
    const glifo = window.__olhar();                 // `.msym` (o ⏸)
    const raiz = document.documentElement;
    raiz.style.setProperty('--icon-md', '31px');
    await z(60);
    const forcado = { chevronNao: null, zerar: null, glifo: null };
    forcado.glifo = window.__olhar();
    chronoPause();
    await z(60);
    forcado.zerar = window.__olhar();
    raiz.style.removeProperty('--icon-md');
    await z(60);
    hideChrono(); clearChronoSession();
    return { chevron, zerar, glifo, forcado,
      token: getComputedStyle(raiz).getPropertyValue('--icon-md').trim() };
  });
  const alvoCx = caixa.chevron.next.svgLarg;
  checar(parseFloat(alvoCx) > 0 && alvoCx === largHtml + 'px'
    && caixa.zerar.prev.svgLarg === alvoCx && caixa.zerar.prev.svgAlt === caixa.chevron.next.svgAlt
    && caixa.glifo.next.symCorpo === alvoCx,
    'F · o `<svg>` do zerar e o `.msym` do ⏸ medem o MESMO que o chevron dentro '
    + 'do `.ctl-btn`, e esse mesmo é o número que o `index.html` promete no '
    + 'atributo — medido no COMPUTADO, que é o que o operador vê',
    JSON.stringify({ html: largHtml, chevron: alvoCx, zerar: caixa.zerar.prev.svgLarg,
      glifo: caixa.glifo.next.symCorpo, token: caixa.token }));
  checar(caixa.chevron.next.attrLarg === null && caixa.zerar.prev.attrLarg === null
    && caixa.glifo.next.attrLarg === null,
    'F · e NENHUM desenho escrito pelo JS carrega `width` de atributo — inclusive '
    + 'o chevron, que o primeiro pulso do `renderTransportAxis` já reescreve por '
    + 'cima do que veio no HTML. Um número ali coincide com o degrau certo por '
    + 'acidente e deixa de coincidir no dia em que alguém mexer no token',
    JSON.stringify({ chevron: caixa.chevron.next.attrLarg,
      zerar: caixa.zerar.prev.attrLarg, glifo: caixa.glifo.next.attrLarg }));
  checar(caixa.forcado.zerar.prev.svgLarg === '31px'
    && caixa.forcado.glifo.next.symCorpo === '31px',
    'F · e os dois SEGUEM o token: forçado `--icon-md` a 31px, o `<svg>` e o glifo '
    + 'vão junto. É esta metade — e não o "medem 22px" — que reprova um atributo '
    + 'que hoje coincide',
    JSON.stringify({ svg: caixa.forcado.zerar.prev.svgLarg,
      msym: caixa.forcado.glifo.next.symCorpo }));

  // ======================================================================
  // G · A GUARDA DE REPINTURA
  // ======================================================================
  // `renderTransportAxis` roda dentro do `renderSlideNav`, que o `timeupdate`
  // da preview dispara a ~4 Hz. Trocar o nó a cada passada é trocar o desenho
  // debaixo do dedo dezenas de vezes por minuto, por nada.
  await limpar();
  const repintura = await pg.evaluate(async () => {
    chrono.mode = 'timer'; chrono.durationMs = 60000;
    projectChrono();
    await new Promise((f) => setTimeout(f, 120));
    const noPrev = slidePrevBtnEl.firstElementChild;
    const noNext = slideNextBtnEl.firstElementChild;
    const marca = slideNextBtnEl.dataset.desenho;
    for (let i = 0; i < 12; i++) renderSlideNav();
    const estavel = { prev: slidePrevBtnEl.firstElementChild === noPrev,
      next: slideNextBtnEl.firstElementChild === noNext,
      marca: slideNextBtnEl.dataset.desenho === marca };
    // E QUANDO O ESTADO MUDA, O NÓ TROCA — sem esta metade um renderizador que
    // nunca desenha nada passaria pela asserção de cima.
    chronoStart();
    await new Promise((f) => setTimeout(f, 120));
    const trocou = { next: slideNextBtnEl.firstElementChild !== noNext,
      marca: slideNextBtnEl.dataset.desenho !== marca,
      // O da ESQUERDA não muda de desenho entre os dois estados, e por isso
      // continua sendo o MESMO nó: é a guarda funcionando no caso real.
      prev: slidePrevBtnEl.firstElementChild === noPrev };
    chronoPause(); hideChrono(); clearChronoSession();
    return { estavel, trocou };
  });
  checar(repintura.estavel.prev && repintura.estavel.next && repintura.estavel.marca,
    'G · com o eixo estável, DOZE pulsos de `renderSlideNav()` não trocam o nó do '
    + 'ícone de nenhum dos dois — a guarda é o `dataset.desenho`',
    JSON.stringify(repintura.estavel));
  checar(repintura.trocou.next && repintura.trocou.marca && repintura.trocou.prev,
    'G · e quando o estado MUDA o nó da direita troca (▶ → ⏸) enquanto o da '
    + 'esquerda continua o mesmo: sem esta metade, um renderizador que nunca '
    + 'desenhasse passaria na asserção acima', JSON.stringify(repintura.trocou));

  // ======================================================================
  // H · A IMAGEM SOBREPOSTA CONTINUA SEM EIXO
  // ======================================================================
  // O terço da guarda que NÃO mudou. A cela precisa ter uma LETRA por baixo:
  // sem ela, `slideTarget()` cairia em null pelo caminho de baixo e a asserção
  // aprovaria a guarda removida.
  await limpar();
  const sobreposta = await pg.evaluate(async (id) => {
    await send(id.audio);
    for (let i = 0; i < 120 && !preview.getCurrent(); i++) {
      await new Promise((f) => requestAnimationFrame(f));
    }
    renderSlideNav();
    const antes = { alvo: slideTarget(), midia: !!midiaNoAr,
      letra: !!(currentItem && currentItem.lyrics && currentItem.lyrics.length) };
    const rec = await AVDB.getMedia(id.imagem);
    projetarVisualSobre(rec);
    await new Promise((f) => setTimeout(f, 150));
    return { antes, camada: visualSobreProjetando(), ...window.__olhar() };
  }, ids);
  checar(sobreposta.antes.alvo === 'lyrics' && sobreposta.antes.midia
    && sobreposta.antes.letra,
    'H · PREMISSA: há um louvor COM LETRA no ar, e o eixo é "lyrics". É esta '
    + 'letra que faz a asserção seguinte morder — sem ela o par ficaria sem eixo '
    + 'de qualquer jeito, e a guarda removida passaria', JSON.stringify(sobreposta.antes));
  checar(sobreposta.camada === true && sobreposta.alvo === null,
    'H · e a IMAGEM SOBREPOSTA continua CALANDO o par: ela é um cartão opaco, e o '
    + 'eixo cairia na estrofe escondida atrás dele — o operador tocaria em '
    + '"próxima estrofe" e a música saltaria sem nada mudar na tela',
    JSON.stringify(sobreposta));
  checar(sobreposta.prev.use === '#icoSlidePrev' && sobreposta.next.use === '#icoSlideNext'
    && sobreposta.prev.disabled && sobreposta.next.disabled,
    'H · com os dois no chevron e desabilitados', JSON.stringify([sobreposta.prev, sobreposta.next]));

  // ======================================================================
  // I · O PAR É DO PAINEL, E DE MAIS NINGUÉM
  // ======================================================================
  // A coluna da TELA CHEIA e os ⏮/⏭ da NOTIFICAÇÃO roteiam pelo eixo, e o
  // desenho DELAS é outro — a seta com barra, copiada inline, que não
  // acompanha esta troca. Vendo `chrono`, a tela de bloqueio ZERARIA a contagem
  // com "mídia anterior" desenhado na frente.
  await limpar();
  const foraDoPainel = await pg.evaluate(async () => {
    const z = (ms) => new Promise((f) => setTimeout(f, ms));
    chrono.mode = 'stopwatch';
    projectChrono();
    chronoStart();
    await z(700);
    chronoPause();
    await z(60);
    const acumulado = chrono.baseMs;
    // ---- a TELA CHEIA ----
    let n = window.__bus.length;
    document.getElementById('fsPrev').click();
    document.getElementById('fsNext').click();
    await z(150);
    const daTelaCheia = { fora: eixoForaDoPainel(), alvo: slideTarget(),
      baseMs: chrono.baseMs, running: chrono.running,
      cmds: window.__desde(n, 'text', 'chrono').length };
    // ---- a NOTIFICAÇÃO: o campo que rotula os ⏮/⏭ ----
    window.__np.length = 0;
    lastScene = '';
    pushNowPlaying();
    const comCronometro = window.__np[window.__np.length - 1] || null;
    // O CONTRASTE: uma MENSAGEM continua levando o eixo para fora do painel.
    // Sem ele, um `slideMode` preso em `false` passaria a asserção acima.
    messages.length = 0;
    messages.push({ id: 'or-eixo', text: 'Desliguem o celular' });
    projectMessage(0);
    await z(120);
    window.__np.length = 0;
    lastScene = '';
    pushNowPlaying();
    const comMensagem = window.__np[window.__np.length - 1] || null;
    const foraMensagem = eixoForaDoPainel();
    clearManualText();
    return { acumulado, daTelaCheia, comCronometro, comMensagem, foraMensagem };
  });
  checar(foraDoPainel.acumulado > 200 && foraDoPainel.daTelaCheia.alvo === 'chrono',
    'I · PREMISSA: a contagem ANDOU e está pausada com um acumulado, e o par ao '
    + 'lado da preview TEM eixo. É contra este acumulado que o zerar se mede',
    JSON.stringify({ acumulado: foraDoPainel.acumulado, alvo: foraDoPainel.daTelaCheia.alvo }));
  checar(foraDoPainel.daTelaCheia.fora === null,
    'I · `eixoForaDoPainel()` é null com o cronômetro no ar — é ele, e não '
    + '`slideTarget()`, que a tela cheia e a notificação consultam',
    JSON.stringify(foraDoPainel.daTelaCheia));
  checar(foraDoPainel.daTelaCheia.baseMs === foraDoPainel.acumulado
    && foraDoPainel.daTelaCheia.cmds === 0,
    'I · e o toque no `#fsPrev`/`#fsNext` da TELA CHEIA não zera a contagem nem '
    + 'manda nada ao telão: eles continuam no eixo de MÍDIA, que é o que aquele '
    + 'desenho promete', JSON.stringify(foraDoPainel.daTelaCheia));
  checar(foraDoPainel.comCronometro && foraDoPainel.comCronometro.slideMode === false,
    'I · e a NOTIFICAÇÃO não anuncia eixo de slide (`slideMode: false`) — os '
    + '⏮/⏭ dela passariam a zerar a contagem com o rótulo de mídia',
    JSON.stringify(foraDoPainel.comCronometro));
  checar(foraDoPainel.foraMensagem === 'message'
    && foraDoPainel.comMensagem && foraDoPainel.comMensagem.slideMode === true,
    'I · e o filtro é NOMEADO, não um "sempre null": com uma MENSAGEM no ar o '
    + 'eixo continua saindo do painel e a notificação volta a anunciar '
    + '`slideMode: true`', JSON.stringify(foraDoPainel.comMensagem));

  // ======================================================================
  // J · O ▶ DO TRANSPORTE, AS DUAS METADES
  // ======================================================================
  // Dois play/pause a dez centímetros um do outro, um que age e um que não, é
  // o pior desfecho possível da v1.8.50. Mas apagá-lo SEMPRE levaria junto o
  // caso legítimo — o louvor de fundo tocando por baixo do cartão, que é o que
  // o ▶ de fato controla.
  await limpar();
  const soCartao = await pg.evaluate(async () => {
    chrono.mode = 'timer'; chrono.durationMs = 60000;
    projectChrono();
    await new Promise((f) => setTimeout(f, 150));
    return { cartao: pvTextActive, audio: !!preview.getCurrent(),
      disabled: playPauseEl.disabled, title: playPauseEl.title,
      cena: cenaDeRoteiroNoAr() };
  });
  checar(soCartao.cartao === true && soCartao.audio === false && soCartao.cena === true,
    'J · PREMISSA: um cartão no ar, NENHUM áudio por baixo, e a cena de roteiro '
    + 'contando como cena (é ela que impede o `semNada` de responder por este '
    + 'caso e mascarar a metade nova)', JSON.stringify(soCartao));
  checar(soCartao.disabled === true && soCartao.title === 'Não há mídia para pausar',
    'J · o ▶ do transporte APAGA — a mesma pergunta que o handler dele já faz na '
    + 'primeira linha (`pvTextActive && !preview.getCurrent()`), onde ela já '
    + 'produz um `return`', JSON.stringify(soCartao));

  const comFundo = await pg.evaluate(async (id) => {
    await send(id.audio);
    for (let i = 0; i < 180 && !preview.getCurrent(); i++) {
      await new Promise((f) => requestAnimationFrame(f));
    }
    chrono.mode = 'timer'; chrono.durationMs = 60000;
    projectChrono();
    await new Promise((f) => setTimeout(f, 200));
    return { cartao: pvTextActive, audio: !!preview.getCurrent(),
      disabled: playPauseEl.disabled, title: playPauseEl.title };
  }, ids);
  checar(comFundo.cartao === true && comFundo.audio === true,
    'J · PREMISSA: o MESMO cartão, agora com um louvor de fundo carregado por '
    + 'baixo dele', JSON.stringify(comFundo));
  checar(comFundo.disabled === false && comFundo.title === 'Play/Pause',
    'J · e aí o ▶ CONTINUA ACESO: ele controla o áudio de fundo, e a projeção do '
    + 'texto é independente. Apagá-lo sempre tiraria do operador o único '
    + 'play/pause do louvor que segue tocando atrás do cartão',
    JSON.stringify(comFundo));

  checar(erros.length === 0, 'nenhum erro de página no percurso inteiro', erros.slice(0, 4));
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
