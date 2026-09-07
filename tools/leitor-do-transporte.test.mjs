#!/usr/bin/env node
// ============================================================================
// O BOTÃO DO TRANSPORTE ABRE A FOLHA DA CENA — a porta pela qual o operador entra
//
// ## O defeito que ele trava
//
// Relato do operador (v1.2.19): *"o sistema não identifica que há letra nenhuma
// para o auxiliar de leitura"*.
//
// A v1.2.14 deu parâmetros ao `openLyricsPopup(item, fonte)` para a Biblioteca
// poder abrir a folha de uma música que NÃO está no ar. O ouvinte do botão do
// transporte continuou registrado **por referência**:
//
//     lyricsViewBtnEl.addEventListener('click', openLyricsPopup);
//
// e `addEventListener` chama o ouvinte com o EVENTO. O `PointerEvent` virou o
// `item`, e como ele não é o `currentItem` virou `lvAlvo` — o desvio deliberado
// que a v1.2.14 criou, apontado para um objeto que não é música nenhuma:
//
//   · `lvItem().lyrics` é `undefined` → a fonte `lyrics` some;
//   · `cifraCabe(evento)` recusa      → a fonte `cifra` some;
//   · `lvNaCena()` passa a ser falso  → some também a RESERVA da Bíblia.
//
// As três fontes de uma vez, e a folha abrindo com *"Nada em exibição com letra
// ou texto bíblico"* para toda música. **Nada erra alto:** `lyricsViewSources`
// continua certa, o console fica limpo, e só a tela denuncia.
//
// ## Por que ele CLICA em vez de chamar a função
//
// É o ponto inteiro. Os três oráculos que já abriam esta folha
// (`cifra-rolagem`, `cifra-teclado`) chamam `openLyricsPopup()` direto — o
// único caminho que continuava funcionando. Um defeito no OUVINTE é invisível
// para quem não passa por ele: aqui o clique é a asserção.
//
// ## As DUAS metades
//
//  1. **o botão abre a CENA** — fonte `lyrics`, sem alvo, com as linhas da letra
//     desenhadas;
//  2. **a Biblioteca continua desviando** — `openLyricsPopup(item, 'cifra')`
//     aponta a folha para outra música. Sem ela, apagar os parâmetros do
//     `openLyricsPopup` "consertaria" a primeira metade e devolveria a folha
//     presa ao que está no ar, que é o recurso que a v1.2.14 entregou.
//
//   node tools/leitor-do-transporte.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

// A ponte de mentira. `cifraHtml` responde uma FOLHA para a segunda metade ter
// o que desenhar — sem ela a aba de cifra existiria e mostraria "buscando", e a
// asserção de desvio mediria uma tela em trânsito.
const PONTE = `(() => {
  const FOLHA = '<pre><b>C</b>      <b>G</b>\\nlinha de cifra do ensaio</pre>';
  const B = {
    shellVersion: () => 50,
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    cifraHtml: (id) => {
      setTimeout(() => {
        try { window.__avResolve(id, { status: 200, html: FOLHA }); } catch (_) {}
      }, 0);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal','castTarget',
    'cifraDiag','deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply',
    'otaCheck','otaDiag','otaPending','pickDoc','pickFolder','requestMic','systemVolume',
    'temaClaro','ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte',
    'ytFetchAudio','ytPlaylist','ytSearch','ytStream','areaTransferencia','atualizacaoEstado',
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
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = 'http://localhost:' + servidor.address().port;

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  // O critério do watchdog do OTA: o `init()` é assíncrono e termina DEPOIS do
  // `load`. Plantar `currentItem` antes disso é correr contra a inicialização,
  // que o zera com toda a razão — e o cenário evapora sem erro nenhum.
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );

  // ── 0. A BADGE DE "HÁ O QUE LER" (v1.4.31) ──────────────────────────────
  //
  // Pedido do operador: *"crie uma badge nesse botão de auxiliar de leitura
  // para indicar que ele está com alguma função disponível quando houver alguma
  // mídia que disponibiliza uma das funções dele"*.
  //
  // Ela nasce da mudança de casa do botão: sobre a preview, "não há o que ler"
  // se lia no palco a dois centímetros dali — o wallpaper no ar responde
  // sozinho. Na sétima célula do deck não há esse contexto.
  //
  // As duas metades falham CALADAS, em direções opostas: apagada com o que ler,
  // o operador conclui que o recurso não existe para aquela música; acesa sem
  // nada, ele abre a folha para achá-la vazia — e volta a não confiar nela,
  // que é o estado anterior ao lote. Daí medir as DUAS, e medir o RENDERIZADO
  // (`hidden`), não uma classe: a badge sem a regra de CSS passaria num teste
  // de classe e continuaria invisível na tela.
  //
  // E QUEM A ACENDE É O CAMINHO REAL (`renderNowPlaying`), não a função da
  // badge chamada à mão: o defeito provável não é ela calcular errado — é
  // ninguém a chamar quando a cena muda.
  const badgeVazia = await pg.evaluate(() => {
    setAppMode('full');
    currentItem = null;
    renderNowPlaying();
    // O VIZINHO ACESO é a régua do tom: o número do `--op-inativo` pode mudar,
    // a DISTÂNCIA entre disponível e indisponível é que não pode sumir.
    const viz = [...document.querySelectorAll('.t-btn')].find((b) => !b.disabled);
    return {
      escondida: lvBadgeEl.hidden,
      desenhada: getComputedStyle(lvBadgeEl).display,
      titulo: lyricsViewBtnEl.title,
      fontes: lyricsViewSources(),
      desabilitado: lyricsViewBtnEl.disabled,
      opacidade: +getComputedStyle(lyricsViewBtnEl).opacity,
      opacidadeVizinho: viz ? +getComputedStyle(viz).opacity : null,
      // A ORDEM DE TABULAÇÃO responde à TENTATIVA, nunca ao `tabIndex`: um
      // `<button disabled>` mantém a propriedade em 0 e mesmo assim não recebe
      // foco, então ler o número aprovaria as duas versões.
      focavel: (() => { lyricsViewBtnEl.focus();
        const ok = document.activeElement === lyricsViewBtnEl;
        lyricsViewBtnEl.blur(); return ok; })(),
      caixa: +lyricsViewBtnEl.getBoundingClientRect().width.toFixed(1),
    };
  });
  checar(badgeVazia.escondida && badgeVazia.desenhada === 'none' && !badgeVazia.fontes.length,
    'sem nada em exibição a badge fica APAGADA — um ponto aceso sobre uma folha '
    + 'vazia ensina o operador a não olhar para ele', badgeVazia);
  checar(/nada em exibição/i.test(badgeVazia.titulo),
    'e o rótulo diz por quê: a badge responde SE há, o `title` responde O QUE há',
    badgeVazia.titulo);
  // ===== E O BOTÃO FICA INDISPONÍVEL (v1.8.36) =============================
  //
  // Pedido do operador: *"desative o botão (modo cinza mais claro, sem toque)
  // de auxiliar de leitura quando não há nenhum conteúdo a ser exibido nele,
  // como na abertura do app"*. A badge já dizia SE há — mas um ponto apagado
  // sobre um botão ACESO continua sendo um botão aceso, e o toque abria a folha
  // para ler "Nada em exibição".
  //
  // A CAIXA ENTRA NA ASSERÇÃO, e não é zelo: o app abre no MODO FÁCIL, onde
  // este botão existe no documento e mede 0×0 — todo hit-test ali responde
  // sobre o véu daquele modo. MEDIDO na escrita deste bloco: sem o
  // `setAppMode('full')` acima, um `elementFromPoint` no centro do botão
  // devolvia `#simpleVeil`, e a asserção mediria outra tela.
  //
  // REVERSÃO: tirar o `lyricsViewBtnEl.disabled = !fontes.length` do
  // `renderLeitorBadge` reprova as três abaixo.
  checar(badgeVazia.caixa > 0 && badgeVazia.desabilitado,
    '  ↳ e o BOTÃO fica indisponível: sem o que ler, o toque abria a folha só '
    + 'para dizer que não há nada — não oferecer é melhor que explicar',
    badgeVazia);
  checar(badgeVazia.opacidade < badgeVazia.opacidadeVizinho,
    '  ↳ e ele fica mais claro que um irmão ACESO da mesma barra — a régua é a '
    + 'distância entre disponível e indisponível, não o número do token',
    badgeVazia);
  checar(badgeVazia.focavel === false,
    '  ↳ e sai da ordem de tabulação: `disabled` e não uma classe, para o nó '
    + 'não continuar alcançável por quem navega sem tocar na tela',
    badgeVazia);
  // E O TOQUE NÃO ABRE A FOLHA. É a asserção que carrega o pedido — "sem
  // toque" —, e ela não pode ser um hit-test: o Chromium hit-testa um botão
  // desabilitado (MEDIDO: `elementFromPoint` devolve o `<use>` de dentro dele),
  // e quem engole o evento é o navegador, no despacho. Só o DESFECHO distingue.
  // E ELA LIMPA O QUE MEDIU: na REVERSÃO o clique ABRE a folha, e uma folha
  // aberta esquecida aqui derruba os blocos de baixo por uma razão que não é a
  // deles — o que sai é um `TimeoutError` no lugar de um placar, e quem
  // reexecutar a reversão lê "o oráculo quebrou" em vez de "estas quatro
  // reprovaram".
  const toqueVazio = await pg.evaluate(async () => {
    const antes = lyricsPopupEl.classList.contains('open');
    lyricsViewBtnEl.click();
    await new Promise((r) => setTimeout(r, 150));
    const depois = lyricsPopupEl.classList.contains('open');
    if (depois) closeLyricsPopup();
    return { antes, depois };
  });
  checar(toqueVazio.antes === false && toqueVazio.depois === false,
    '  ↳ e o toque nele NÃO abre a folha — é o "sem toque" do pedido, e o '
    + 'desfecho é a única régua: o nó continua no hit-test, quem engole o '
    + 'evento é o navegador', toqueVazio);

  // ── 1. O BOTÃO DO TRANSPORTE ────────────────────────────────────────────
  // SEM `window.`: `currentItem` e `lvSource` são `let` no topo de um script
  // clássico — vínculo léxico, não propriedade de `window`.
  const preparado = await pg.evaluate(() => {
    // O MODO AVANÇADO, porque é lá que o botão mora: o app abre no Modo Fácil e
    // a barra de transporte inteira nasce `display: none`. Um oráculo que
    // clicasse sem isto reprovaria por uma razão que não é a dele.
    setAppMode('full');
    currentItem = {
      id: 'cena', name: 'Louvor Em Cena', kind: 'audio', seconds: 200,
      lyrics: [{ cover: true }, { text: 'primeira estrofe' }, { text: 'segunda estrofe' }],
    };
    lvSource = null;
    // A folha é desenhada pelo CLIQUE; se ela já estivesse aberta, o oráculo
    // mediria um desenho anterior e o ouvinte poderia nem ser exercitado.
    return lyricsPopupEl.classList.contains('open');
  });
  checar(preparado === false, 'o cenário começa com a folha FECHADA', preparado);

  const badgeCheia = await pg.evaluate(() => {
    renderNowPlaying();
    return {
      escondida: lvBadgeEl.hidden,
      desenhada: getComputedStyle(lvBadgeEl).display,
      cor: getComputedStyle(lvBadgeEl).backgroundColor,
      titulo: lyricsViewBtnEl.title,
      fontes: lyricsViewSources(),
      desabilitado: lyricsViewBtnEl.disabled,
      opacidade: +getComputedStyle(lyricsViewBtnEl).opacity,
    };
  });
  checar(!badgeCheia.escondida && badgeCheia.desenhada !== 'none',
    'com uma música com letra em cena a badge ACENDE — é o único sinal de que o '
    + 'botão tem função agora, longe da preview que respondia isso sozinha',
    badgeCheia);
  checar(/rgb\(/.test(badgeCheia.cor) && !/rgba\(0, 0, 0, 0\)/.test(badgeCheia.cor),
    'e ela é PINTADA de verdade: a classe sem a regra de CSS passaria numa '
    + 'asserção de classe e continuaria invisível na tela', badgeCheia.cor);
  checar(badgeCheia.fontes.every((f) => new RegExp(f === 'lyrics' ? 'letra' : f, 'i')
    .test(badgeCheia.titulo)),
    'o rótulo NOMEIA o que há, e os nomes saem das próprias abas (`data-lvsrc`) '
    + '— uma tabela de nomes aqui seria a terceira lista da mesma pergunta',
    badgeCheia);
  // A METADE QUE IMPEDE O CONSERTO LARGO DEMAIS (v1.8.36): desabilitar o botão
  // para sempre passa em todas as asserções da cena VAZIA, e o recurso morre.
  // O clique logo abaixo é a prova viva — sem ele, o resto do arquivo não roda.
  checar(badgeCheia.desabilitado === false && badgeCheia.opacidade === 1,
    'e com uma cena no ar o botão VOLTA a ficar disponível, no tom cheio — sem '
    + 'esta, desabilitá-lo para sempre passaria nas asserções da cena vazia',
    badgeCheia);

  await pg.click('#lyricsViewBtn');
  await pg.waitForFunction(() => lyricsPopupEl.classList.contains('open'), null, { timeout: 5000 });

  const cena = await pg.evaluate(() => ({
    fonte: lvActiveSource(),
    naCena: lvNaCena(),
    alvoEhEvento: !!(lvAlvo && typeof Event !== 'undefined' && lvAlvo instanceof Event),
    linhas: lyricsViewBodyEl.querySelectorAll('.lv-row').length,
    vazio: (lyricsViewBodyEl.querySelector('.empty') || {}).textContent || '',
    titulo: lyricsPopupTitleEl.textContent,
  }));
  checar(cena.fonte === 'lyrics',
    'o botão do transporte abre a folha na LETRA da música em cena', cena.fonte);
  checar(cena.alvoEhEvento === false,
    'e o EVENTO do clique não vira o alvo da folha — é o defeito, isolado', cena);
  checar(cena.naCena === true,
    'a folha do transporte segue a CENA (sem alvo): é dela o destaque e o relógio', cena.naCena);
  checar(cena.vazio === '',
    'nada de "Nada em exibição com letra ou texto bíblico" com uma música com letra', cena.vazio);
  checar(cena.linhas === 3,
    'e as três linhas da letra estão desenhadas (a capa conta como posição)', cena.linhas);
  checar(cena.titulo === 'Louvor Em Cena',
    'o título da folha é o da música em cena', cena.titulo);

  // ── 1b. AS ABAS PREENCHEM A FAIXA, E EM PARTES IGUAIS (v1.4.39) ─────────
  //
  // Relato do operador: elas *"estão com pouca largura, considerando que
  // deveria ter a largura adaptável para preencher a largura total
  // disponível… sendo reduzidos apenas nos casos em que haveria bíblia ou
  // slides sendo exibidos juntos, que nesse caso o espaço disponível seria
  // novamente distribuído igualmente"*.
  //
  // A causa era um REPARENTAMENTO. A v1.4.28 reordena as abas pela pilha, e
  // anexava em `lyricsViewSegEl` — que é o `.lyricsview-seg`, o bloco com o
  // respiro; os botões moram um nível abaixo, dentro da `.fit-seg`. Fora do
  // contêiner flex o `flex: 1` do `.fit-opt` fica INERTE, e cada botão volta a
  // ser `inline-block` do tamanho do próprio rótulo. MEDIDO a 430px: a faixa
  // tem 401px e as duas abas saíam com 44,8 e 42,7.
  //
  // Falha CALADA: a ordem que o pedido da v1.4.28 queria continuou certa (o
  // `appendChild` reordena do mesmo jeito) e nada lança — só a largura se
  // perdeu.
  //
  // As DUAS metades, e nenhuma basta: o PAI (o mecanismo, que é o que quebrou)
  // e o RENDERIZADO (a largura, que é o que o operador vê). Sem a segunda, um
  // `flex: 1` apagado do `.fit-opt` passaria; sem a primeira, larguras
  // acertadas à mão passariam.
  //
  // ===== E A CONTA DE ABAS ESPERA A CIFRA CHEGAR (v1.8.28) ================
  //
  // A aba de cifra deixou de sair de um predicado puro: ela depende do DESFECHO
  // da procura (`cifraTemFolha`), que chega por uma Promise — disco em
  // milissegundos, rede em segundos. Medir no mesmo quadro da abertura conta as
  // abas ANTES da resposta, e o que sai é `1` onde se esperava `2`.
  //
  // MEDIDO: passou duas vezes nesta máquina e REPROVOU no runner, que é a
  // assinatura de um oráculo medindo o agendador. A espera é pelo FATO (o
  // estado no cache), nunca por um prazo, e o predicado é SÍNCRONO — um `async`
  // aqui devolve uma Promise, que é *truthy*, e a espera passaria no primeiro
  // quadro aprovando justamente o que veio verificar.
  //
  // Não é tautologia: o que se espera é a INGESTÃO (a procura terminando), e o
  // que se afirma é o PAI e a LARGURA das abas que resultam dela.
  await pg.waitForFunction(
    () => !cifraCabe(lvItem())
      || (cifraEstado(lvItem()) || {}).estado !== 'buscando',
    null, { timeout: 15000 },
  );

  const abas = (n) => pg.evaluate((quantas) => {
    bibleSession = quantas >= 3
      ? { projecting: true, verses: [{ ref: 'Sl 23:1', text: 'O Senhor é o meu pastor' }], idx: 0 }
      : null;
    renderLyricsView();
    const seg = document.getElementById('lyricsViewSeg');
    const fit = seg.querySelector('.fit-seg');
    const vis = [...seg.querySelectorAll('.fit-opt')].filter((b) => !b.hidden);
    const larguras = vis.map((b) => +b.getBoundingClientRect().width.toFixed(1));
    const vao = parseFloat(getComputedStyle(fit).gap) || 0;
    return {
      quantas: vis.length,
      naFaixa: vis.every((b) => b.parentElement === fit),
      faixa: +fit.getBoundingClientRect().width.toFixed(1),
      larguras,
      // Uma linha só: com quatro abas a 320px a mais comprida ("Páginas") não
      // pode quebrar nem estourar a caixa.
      umaLinha: vis.every((b) => b.getBoundingClientRect().height < 40
        && b.scrollWidth <= b.clientWidth + 1),
      soma: +(larguras.reduce((a, c) => a + c, 0) + (larguras.length - 1) * vao).toFixed(1),
    };
  }, n);
  for (const n of [2, 3]) {
    const a = await abas(n);
    checar(a.quantas === n && a.naFaixa,
      `com ${n} abas, todas estão DENTRO da \`.fit-seg\` — é o contêiner flex, e é `
      + 'de lá que o reordenamento as tirava', a);
    checar(Math.abs(a.soma - a.faixa) < 1.5,
      `e elas PREENCHEM a largura disponível (${n} abas)`, a);
    checar(Math.max(...a.larguras) - Math.min(...a.larguras) < 0.6,
      `em partes IGUAIS — entrando ou saindo uma fonte, o espaço se redistribui `
      + `sozinho (${n} abas)`, a);
    checar(a.umaLinha, `e nenhuma quebra ou estoura a caixa (${n} abas)`, a);
  }
  await pg.evaluate(() => { bibleSession = null; renderLyricsView(); });

  // ── 2. A PORTA DA BIBLIOTECA CONTINUA DESVIANDO (v1.2.14) ───────────────
  // A metade que impede a correção acima de virar "a folha é sempre a cena" —
  // isto é, de desfazer o recurso que a v1.2.14 entregou a quem toca.
  await pg.evaluate(() => {
    closeLyricsPopup();
    openLyricsPopup({
      id: 'ensaio', name: 'Louvor Do Ensaio', kind: 'audio', seconds: 180,
      hymnAlbum: 'Hinário Adventista 2022',
      lyrics: [{ text: 'letra do ensaio' }],
    }, 'cifra');
  });
  const ensaio = await pg.evaluate(() => ({
    naCena: lvNaCena(),
    alvo: lvAlvo ? lvAlvo.name : null,
    item: lvItem().name,
    cena: currentItem ? currentItem.name : null,
    fonte: lvActiveSource(),
  }));
  checar(ensaio.naCena === false && ensaio.alvo === 'Louvor Do Ensaio',
    'a Biblioteca aponta a folha para OUTRA música, sem projetar nada', ensaio);
  checar(ensaio.item === 'Louvor Do Ensaio' && ensaio.cena === 'Louvor Em Cena',
    'e o `currentItem` não foi tocado — o alvo é leitura, não projeção', ensaio);
  checar(ensaio.fonte === 'cifra',
    'e o pedido de quem abriu vence: a Biblioteca abre na CIFRA', ensaio.fonte);

  // ── 3. E O ALVO MORRE COM A FOLHA ───────────────────────────────────────
  // Sem isto, a próxima abertura pelo transporte mostraria a música do ensaio
  // no lugar da que está no ar, e nada na tela explicaria por quê.
  await pg.evaluate(() => closeLyricsPopup());
  await pg.click('#lyricsViewBtn');
  await pg.waitForFunction(() => lyricsPopupEl.classList.contains('open'), null, { timeout: 5000 });
  const devolta = await pg.evaluate(() => ({ naCena: lvNaCena(), titulo: lyricsPopupTitleEl.textContent }));
  checar(devolta.naCena === true && devolta.titulo === 'Louvor Em Cena',
    'fechada a folha, o botão do transporte volta a mostrar a CENA', devolta);
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
