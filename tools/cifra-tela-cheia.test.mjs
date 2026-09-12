#!/usr/bin/env node
// ============================================================================
// A CIFRA EM TELA CHEIA, DEITADA (v1.6.0)
//
// Pedido do operador: *"gostaria que criasse um sistema para visualização das
// cifras em tela cheia, no modo paisagem. deixe visível em uma coluna vertical
// na direita, os botões de controle de tom, automático, tamanho da fonte e
// etc... e é claro, ao abrir esse modo em tela cheia, pode já deixar
// automaticamente a fonte já um pouco maior"*.
//
// ## Por que ele existe, e o que cada metade pega
//
// O recurso é LAYOUT mais MEDIDA, e as duas falham calado:
//
//  - uma coluna escrita como OVERLAY (a receita da `.pv-fsctl`, que é o
//    precedente óbvio) fica linda e come a última coluna de caracteres da
//    folha: o acorde de fim de linha desaparece atrás dos botões, e nada na
//    tela diz isso;
//  - a fonte maior SEM remedição é uma REGRESSÃO disfarçada de recurso — a
//    folha continua quebrada para os ~37 caracteres do retrato, e o que se
//    ganha em corpo se perde em linha partida. Daí a asserção aritmética:
//    **em tela cheia a folha não pode ter MENOS colunas que no retrato**;
//  - e o par acorde/letra é a coisa que esta aba mais quebra quando se mexe
//    nela com pressa. Um acorde a duas linhas da sílaba que ele rege não é
//    alinhamento imperfeito: é o par desfeito, e ele **parece certo**.
//
// ## O CENÁRIO É O DO APARELHO, em duas etapas
//
// A tela cheia é REAL (`requestFullscreen` a partir de um clique de verdade),
// e a ROTAÇÃO é a segunda etapa: no aparelho quem deita a tela é o
// `onShowCustomView` do `MainActivity`, **depois** e **sem promise** — o
// `screen.orientation.lock` do WebView é decorativo. Aqui isso é
// `setViewportSize` para uma paisagem, que dispara o mesmo `resize` que chega
// lá (MEDIDO: a tela cheia SOBREVIVE à troca de viewport no Chromium).
//
// E O QUE SE ESPERA É O EVENTO `fullscreenchange`, nunca
// `document.fullscreenElement`: MEDIDO no `controles-layout.test.mjs`, o
// Chromium publica a propriedade ANTES de despachar o evento, e a enquete cai
// no vão — reprovando um app que está certo.
//
// ## O QUE A v1.6.1 ACRESCENTOU
//
// O ⛶ SAIU DO CABEÇALHO E FOI PARA A BARRA, no FIM da fila (*"coloque o botão
// de tela, na mesma linha dos botões de rolagem automática e etc... coloque ele
// no fim da lista à direita"*). Três coisas mudaram de natureza com isso:
//
//  - **"ele está à vista?" deixou de ser o `hidden` e passou a ser a ÁRVORE.**
//    A barra é esvaziada em todo `renderLyricsView`, então fora da aba de cifra
//    o nó não está em lugar nenhum do documento — e perguntar `.hidden` ali é
//    ler propriedade de `null`, que derruba o `evaluate` inteiro. A pergunta que
//    sobrou é a do pedido: a POSIÇÃO na fila.
//  - **o fim da fila no retrato é o PÉ da coluna em paisagem**, e isso se mede
//    por GEOMETRIA: a ordem do DOM provaria o `prepend` do `lvBuildCifra`, não
//    onde o dedo vai encontrar o botão depois de o `flex-direction: column`
//    agir.
//  - **a barra passou a nascer ANTES dos dois `return` cedo** do `lvBuildCifra`
//    (bloco 7-C): "procurando" e o erro são alcançáveis COM a tela cheia no ar,
//    e construída depois deles a barra some — sobra uma paisagem deitada com
//    uma frase de erro e nenhuma saída à vista.
//
// E O ARRANQUE DA ROLAGEM NÃO TEM LEGENDA AQUI: o `.dl-ring` da v1.5.20 virou
// uma NOTA na barra (v1.6.1), e ela é SUPRIMIDA em tela cheia — numa trilha de
// 66px a frase vira oito linhas. **A SUPRESSÃO SOBREVIVEU À v1.6.2**: a espera
// parada virou uma RAMPA e a nota trocou de fato junto (ela explica a lentidão,
// não mais a imobilidade), mas a aritmética que a tira daqui é a mesma — e o que
// se perde encolheu, porque agora a folha JÁ SE MEXE, que é mais do que a
// legenda dizia. O que este arquivo afirma dela é a ausência DESENHADA, com o
// `flex-wrap: nowrap` ao lado — numa coluna o wrap não quebra linha, ele abre
// uma segunda coluna.
//
// ## O BOTÃO DE VELOCIDADE FICOU QUADRADO (v1.6.2)
//
// *"diminua a fonte do botão de 1x para que ele seja um botão exatamente do
// mesmo tamanho e quadrado como os seus vizinhos"*. O retrato é medido no
// `cifra-rolagem.test.mjs`, que já percorre a escada inteira com `click()`;
// aqui a promessa é reafirmada na COLUNA DEITADA, que é outro contexto de
// layout (`flex-direction: column`) e o modo em que a folha é lida de longe.
// Ver o bloco 6-B — inclusive para o palpite ERRADO de qual regra a sustenta.
//
//   node tools/cifra-tela-cheia.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

// A PONTE DE MENTIRA. A folha é LONGA (para haver percurso a rolar) e as linhas
// são LARGAS (~92 caracteres) de propósito: com linha curta ela não quebra em
// largura nenhuma, e a asserção de requebra mediria o mesmo dos dois lados.
// `Tom: C` fora do `<pre>` é o que faz o rótulo do tom existir — sem ele o
// botão de transpor não teria o que mudar na tela.
const PONTE = `(() => {
  const ESP = (n) => new Array(n + 1).join(' ');
  const LINHAS = [];
  for (let i = 0; i < 90; i++) {
    LINHAS.push('<b>C</b>' + ESP(21) + '<b>G</b>' + ESP(21) + '<b>Am</b>' + ESP(20) + '<b>F</b>');
    LINHAS.push('marcador ' + i + ' com uma linha de letra bem comprida para forcar a quebra em duas ou tres');
  }
  const FOLHA = '<div>Tom: C</div><pre>' + LINHAS.join('\\n') + '</pre>';
  const B = {
    shellVersion: () => 61,
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
    'otaCheck','otaDiag','otaPending','pickDoc','pickFolder','systemVolume',
    'temaClaro','ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte',
    'ytFetchAudio','ytPlaylist','ytSearch','ytStream','areaTransferencia','atualizacaoEstado',
    'salvarTexto','farolEstado','espelhoDerrubar',
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

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

await new Promise((r) => servidor.listen(0, r));
const navegador = await abrirNavegador();
// RETRATO, como todo o resto da suíte: é daqui que se sai, e é contra esta
// medida que a paisagem é comparada.
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = 'http://localhost:' + servidor.address().port;

// O coletor é do PLAYWRIGHT, nunca uma variável de página: quem lança dentro de
// um ouvinte não escreve em lugar nenhum, e uma lista lida da página aprova o
// silêncio por construção. `EXTERNO` é a rede bloqueada pelo `semRedeExterna`.
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY|ERR_FAILED/;
const erros = [];
pg.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
  erros.push(t);
});
pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && (!!document.querySelector('#playlist li') || document.getElementById('plBtn').disabled),
    null, { timeout: 30000 },
  );

  // O ESPIÃO DO BARRAMENTO fica de pé o arquivo inteiro: a asserção de "nada vai
  // ao telão" só vale se ela cobrir TODOS os toques deste oráculo — entrar,
  // transpor, rolar, sair. Instalado antes do primeiro deles.
  await pg.evaluate(() => {
    window.__vistos = [];
    const orig = AVDB.sendCommand;
    AVDB.sendCommand = (c) => { window.__vistos.push(c && c.type); return orig.call(AVDB, c); };
    window.__fsEventos = 0;
    document.addEventListener('fullscreenchange', () => { window.__fsEventos++; });
  });
  const esperarEvento = (n) => pg.waitForFunction(
    (alvo) => window.__fsEventos >= alvo, n, { timeout: 10000 },
  ).catch(() => {});

  const pronto = await pg.evaluate(() => {
    currentItem = {
      id: 'marcador', name: 'Musica De Marcador', kind: 'audio', seconds: 200,
      lyrics: [{ text: 'linha de marcador' }],
    };
    if (!cifraCabe(currentItem)) return 'cifraCabe recusou o item';
    lvSource = 'cifra';
    openLyricsPopup();
    return lvActiveSource();
  });
  checar(pronto === 'cifra', 'a aba de CIFRA é a fonte ativa (o cenário do app)', pronto);
  await pg.waitForSelector('.lv-cifra-acordes', { timeout: 15000 });
  await pg.waitForFunction(() => cifraColunasAtual > 0, null, { timeout: 10000 });

  // ── A MEDIÇÃO, uma função só, chamada dos dois lados ─────────────────────
  //
  // Uma régua para o retrato e outra para a paisagem seria a segunda opinião
  // que este projeto proíbe: duas contas do mesmo número divergem no primeiro
  // ajuste, e aqui a divergência aprovaria o defeito.
  const medir = () => pg.evaluate(() => {
    const corpo = lyricsViewBodyEl;
    const folha = corpo.querySelector('.lv-cifra-folha');
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, r: b.right, w: b.width, y: b.top, b: b.bottom }; };
    // O x de UM caractere, por `Range`: é o único jeito de perguntar em que
    // COLUNA um glifo caiu. A caixa do `<div>` da linha começa no mesmo lugar
    // nas duas linhas de um par mesmo com a quebra errada — medi-la aprovaria
    // o par desfeito.
    const xDoChar = (el, k) => {
      const t = el && el.firstChild;
      if (!t || t.nodeType !== 3 || t.data.length <= k) return null;
      const rg = document.createRange();
      rg.setStart(t, k); rg.setEnd(t, k + 1);
      return rg.getBoundingClientRect().left;
    };
    // O PRIMEIRO PAR acorde/letra em que as duas linhas alcançam a coluna 12.
    const linhas = [...folha.querySelectorAll('.lv-cifra-linha')];
    let par = null;
    for (let i = 0; i + 1 < linhas.length && !par; i++) {
      if (!linhas[i].classList.contains('lv-cifra-acordes')) continue;
      if (!linhas[i + 1].classList.contains('lv-cifra-letra')) continue;
      const a = xDoChar(linhas[i], 12);
      const b = xDoChar(linhas[i + 1], 12);
      if (a !== null && b !== null) par = { a, b };
    }
    const cs = getComputedStyle(folha);
    return {
      cheia: document.fullscreenElement === lyricsPopupEl,
      corpo: r(corpo),
      corpoUtil: corpo.clientWidth,
      folhaEstoura: folha.scrollWidth > folha.clientWidth + 1,
      colunas: cifraColunasAtual,
      fonte: parseFloat(cs.fontSize),
      nLinhas: linhas.length,
      par,
      janela: window.innerWidth,
      // A COLUNA: os dois blocos que moram nela.
      cabecalho: r(lyricsPopupEl.querySelector('.popup-header')),
      fila: lyricsCifraCtlEl.hidden ? null : r(lyricsCifraCtlEl),
      abas: getComputedStyle(lyricsViewSegEl).display,
      fechar: getComputedStyle(lyricsPopupEl.querySelector('.popup-close')).display,
      // O ⛶ MUDOU DE CASA (v1.6.1): ele NASCE no cabeçalho e MORA na
      // `.lv-cifra-ctl`, no FIM dela. `!btn.hidden` deixou de medir o que quer
      // que fosse — quem responde "ele está à vista?" passou a ser a ÁRVORE (a
      // barra é esvaziada em todo render), e a pergunta do pedido é a POSIÇÃO
      // na fila: *"coloque ele no fim da lista à direita"*.
      cheiaBtn: !!lyricsPopupEl.querySelector('.lv-cifra-ctl > #cifraCheiaBtn:last-child'),
      // O TOM DESCEU PARA DENTRO DA CAIXA (v1.6.3): ele é a segunda linha do
      // cabeçalho da obra, e não mais um rótulo na barra — que saiu junto.
      tom: (lyricsViewBodyEl.querySelector('.lv-cifra-cab-tom') || { textContent: '' }).textContent,
      varEscopada: lyricsPopupEl.style.getPropertyValue('--lv-fonte'),
    };
  });

  const retrato = await medir();
  checar(!retrato.cheia && retrato.cheiaBtn,
    'no retrato a folha é um bottom-sheet e o ⛶ é o ÚLTIMO botão da barra da '
    + 'cifra (v1.6.1) — *"no fim da lista à direita"*',
    { cheia: retrato.cheia, ultimoDaFila: retrato.cheiaBtn });
  checar(retrato.colunas > 20 && retrato.colunas < 60,
    'e ela está quebrada para os ~37 caracteres do retrato', retrato.colunas);

  // ── ENTRAR: o clique de verdade, e depois a rotação ──────────────────────
  await pg.click('#cifraCheiaBtn');
  await esperarEvento(1);
  // A ROTAÇÃO, que no aparelho vem do shell e chega DEPOIS. 800×390 é uma
  // paisagem de celular comum.
  await pg.setViewportSize({ width: 800, height: 390 });
  // Espera pelo FATO (a folha requebrada para a largura nova), nunca por um
  // prazo: a remedição chega por três caminhos independentes.
  await pg.waitForFunction(
    (antes) => cifraColunasAtual > antes, retrato.colunas, { timeout: 10000 },
  ).catch(() => {});
  const cheia = await medir();

  checar(cheia.cheia,
    'o toque no ⛶ põe a FOLHA INTEIRA em tela cheia — o elemento é o '
    + '`#lyricsPopup`, e nada é reparentado', cheia.cheia);

  // ── 1. A COLUNA FICA À DIREITA E NÃO COBRE O TEXTO ───────────────────────
  //
  // Geometria, e não classe: uma coluna escrita como overlay teria as mesmas
  // classes e comeria a última coluna de caracteres da folha.
  const colunaX = Math.min(cheia.cabecalho.x, cheia.barra ? cheia.barra.x : Infinity);
  checar(cheia.barra !== null,
    'a barra da cifra continua desenhada em tela cheia (é ela que leva tom, '
    + 'rolagem e transposição para a coluna)', cheia.barra);
  checar(colunaX >= cheia.corpo.r - 0.5,
    'a coluna começa ONDE A FOLHA ACABA: ela é uma faixa do grid, não um '
    + 'overlay — o texto não é coberto por construção',
    { folhaAcaba: cheia.corpo.r, colunaComeca: colunaX });
  checar(cheia.cabecalho.r <= cheia.janela + 0.5 && cheia.janela - colunaX < 100,
    'e ela mora na DIREITA, encostada na borda',
    { colunaComeca: colunaX, janela: cheia.janela });

  // HIT-TEST: quem recebe o dedo no meio da folha é a folha, e quem o recebe
  // sobre um botão da coluna é o botão. A geometria acima já diz que não há
  // sobreposição; isto diz que a camada não inverteu a resposta ao toque.
  const toque = await pg.evaluate(() => {
    const corpo = lyricsViewBodyEl.getBoundingClientRect();
    const meio = document.elementFromPoint(
      Math.round(corpo.left + corpo.width / 2), Math.round(corpo.top + corpo.height / 2));
    const vel = document.querySelector('.lv-cifra-vel').getBoundingClientRect();
    const naVel = document.elementFromPoint(
      Math.round(vel.left + vel.width / 2), Math.round(vel.top + vel.height / 2));
    return {
      meioNaFolha: !!(meio && meio.closest('#lyricsViewBody')),
      velRecebe: !!(naVel && naVel.closest('.lv-cifra-vel')),
    };
  });
  checar(toque.meioNaFolha && toque.velRecebe,
    'e o dedo cai onde a geometria promete: no meio da folha é a FOLHA, sobre '
    + 'o botão de velocidade é o BOTÃO', toque);

  // ── 2. A FOLHA USA A LARGURA QUE SOBRA ───────────────────────────────────
  checar(cheia.corpoUtil > retrato.corpoUtil * 1.5,
    'a folha passa a usar a largura da paisagem, e não continua com a do '
    + 'retrato', { retrato: retrato.corpoUtil, cheia: cheia.corpoUtil });

  // ── 3. A FONTE ENTRA MAIOR ───────────────────────────────────────────────
  checar(cheia.fonte > retrato.fonte,
    'e a fonte entra MAIOR, que é o objetivo declarado do modo',
    { retrato: retrato.fonte, cheia: cheia.fonte });
  checar(/rem$/.test(cheia.varEscopada.trim()),
    'o corpo é ESCOPADO no `#lyricsPopup` (custom property herda) — o `:root` '
    + 'nunca é tocado, e por isso não há nada a desfazer na saída',
    cheia.varEscopada);

  // ── 4. E A FOLHA FOI REQUEBRADA PARA A LARGURA NOVA ──────────────────────
  //
  // A ASSERÇÃO ARITMÉTICA do lote: uma fonte maior que faz a folha quebrar
  // MAIS é uma regressão vestida de recurso, e é exatamente o que um salto de
  // corpo exagerado (ou uma remedição que não acontece) produz.
  checar(cheia.colunas > retrato.colunas,
    'a folha em tela cheia tem MAIS colunas que a do retrato — a fonte cresceu '
    + 'menos do que a largura', { retrato: retrato.colunas, cheia: cheia.colunas });
  checar(!cheia.folhaEstoura,
    'e nenhuma linha estoura a caixa: a quebra é a da largura ATUAL', cheia);
  checar(cheia.nLinhas < retrato.nLinhas,
    'e o mesmo conteúdo cabe em menos pedaços — é isso que se ganha ao deitar',
    { retrato: retrato.nLinhas, cheia: cheia.nLinhas });

  // ── 5. O PAR ACORDE/LETRA CONTINUA ALINHADO ──────────────────────────────
  //
  // O defeito mais caro desta aba, e o que PARECE certo: um acorde vale por
  // estar sobre a sílaba em que a harmonia troca.
  checar(retrato.par && cheia.par && Math.abs(cheia.par.a - cheia.par.b) < 0.5,
    'e a coluna 12 do acorde cai exatamente sobre a coluna 12 da letra depois '
    + 'da remedição — o par não se desfez', cheia.par);

  // ── 6. OS CONTROLES PEDIDOS ESTÃO NA COLUNA, E FUNCIONAM ─────────────────
  const controles = await pg.evaluate(async () => {
    const corpo = lyricsViewBodyEl.getBoundingClientRect();
    const nomes = {
      sair: '#cifraCheiaBtn',
      menor: '.lv-fonte-menos', maior: '.lv-fonte-mais',
      rolar: '.lv-cifra-rolar', velocidade: '.lv-cifra-vel',
    };
    const fora = [];
    const ausentes = [];
    for (const [nome, sel] of Object.entries(nomes)) {
      const el = lyricsPopupEl.querySelector(sel);
      if (!el) { ausentes.push(nome); continue; }
      const b = el.getBoundingClientRect();
      if (!(b.width > 0 && b.height > 0)) { ausentes.push(nome); continue; }
      if (b.left < corpo.right - 0.5) fora.push(nome);
    }
    // O −½/+½ não tem classe própria: são os `.lv-fonte-btn` da `.lv-cifra-ctl`
    // com o rótulo em texto.
    const meiosTons = [...lyricsPopupEl.querySelectorAll('.lv-cifra-ctl .lv-fonte-btn')]
      .map((b) => b.textContent.trim()).filter((t) => t === '−½' || t === '+½');
    // O DESENHO do ⛶ é reescrito por `innerHTML` a cada troca de estado, e o
    // SVG não leva `width`/`height`: quem manda é a regra de escala do
    // esqueleto só-de-ícone. Fora dela ele nasceria no tamanho padrão de um
    // SVG sem dimensão (300×150), transbordando a coluna sem erro nenhum.
    const ico = lyricsPopupEl.querySelector('#cifraCheiaBtn svg');
    const icoW = ico ? ico.getBoundingClientRect().width : 0;
    // A ORDEM DA COLUNA é GEOMETRIA, e não a ordem do DOM: a ordem do DOM
    // provaria o `prepend` do `lvBuildCifra`, não onde o dedo vai encontrar o
    // botão depois de o `flex-direction: column` da tela cheia agir.
    const cx = (sel) => {
      const el = lyricsPopupEl.querySelector(sel);
      return el ? el.getBoundingClientRect().top : -1;
    };
    // ===== A CAIXA DO BOTÃO DE VELOCIDADE, NA COLUNA DEITADA (v1.6.2) =====
    //
    // Percorrida degrau a degrau: a promessa é sobre a ESCADA, e um botão medido
    // parado prova só o rótulo que calhou de estar em cena.
    const velBtn = lyricsPopupEl.querySelector('.lv-cifra-vel');
    // A ESCADA É PERCORRIDA PELO SLIDER desde a v1.8.80 (a gaveta de botões
    // virou um `<input type=range>`): abrir, arrastar até o degrau `i`, FECHAR e
    // medir o botão — ele só volta a ser o rótulo com a gaveta fechada, porque
    // aberto ele é o ✕. A pergunta é a mesma de sempre (a caixa não depende do
    // rótulo em cena) e ela vale numa coluna flex, que é o ponto deste arquivo.
    const velCaixas = [];
    const sliderDe = () => lyricsCifraCtlEl.querySelector('.lv-cifra-slider');
    for (let i = 0; i < CIFRA_VELOCIDADES.length; i++) {
      velBtn.click();
      const sl = sliderDe();
      sl.value = String(i);
      sl.dispatchEvent(new Event('input', { bubbles: true }));
      velBtn.click();
      const b = velBtn.getBoundingClientRect();
      velCaixas.push({
        rotulo: velBtn.textContent.trim(),
        w: +b.width.toFixed(2), h: +b.height.toFixed(2),
        sw: velBtn.scrollWidth, cw: velBtn.clientWidth,
      });
    }
    // E A GAVETA, na COLUNA (v1.8.80): o slider deitado da v1.8.80 não caberia
    // numa trilha de 66px, então em tela cheia ele é VERTICAL e a gaveta cresce
    // em ALTURA. É o par de regras de CSS que se prova aqui — sem ele, 9rem de
    // largura dentro da coluna.
    const colunaAntes = +lyricsCifraCtlEl.getBoundingClientRect().height.toFixed(2);
    velBtn.click();
    const gav = lyricsCifraCtlEl.querySelector('.lv-cifra-vels');
    // A GAVETA ANIMA (v1.8.80), então a medição espera pelo FIM da transição —
    // nunca por um prazo: medida no quadro do toque, ela lê a altura de PARTIDA
    // (zero) e reprova um app que está certo. O `setTimeout` é a rede de
    // segurança para o caso em que o motor não emite o evento (uma transição de
    // duração zero não emite `transitionend`).
    await new Promise((pronto) => {
      const t = setTimeout(pronto, 800);
      gav.addEventListener('transitionend', () => { clearTimeout(t); pronto(); }, { once: true });
    });
    const gavB = gav.getBoundingClientRect();
    const slB = sliderDe().getBoundingClientRect();
    const velGaveta = {
      w: +gavB.width.toFixed(2), h: +gavB.height.toFixed(2),
      sliderW: +slB.width.toFixed(2), sliderH: +slB.height.toFixed(2),
      modo: getComputedStyle(sliderDe()).writingMode,
      // O play e o seletor FICAM à vista com ela aberta — o pedido, e aqui na
      // coluna também.
      rolarAVista: lyricsPopupEl.querySelector('.lv-cifra-rolar').getClientRects().length > 0,
      velAVista: velBtn.getClientRects().length > 0,
      // E O QUE ELA COBRE (v1.8.83): aqui a saída é o PÉ da coluna, e ela é
      // coberta como o par de tom. A `visibility` não tem eixo, então esta
      // metade não precisou de regra própria — o que precisou foi da MEDIDA,
      // porque "não precisou de regra" é exatamente o que ninguém confere.
      // A CAIXA CONTINUA EXISTINDO — é justamente ela que mantém a coluna do
      // mesmo comprimento —, então a régua é a `visibility`, nunca
      // `getClientRects()`: este responde por caixa, e a caixa está lá.
      saidaCoberta: getComputedStyle(lyricsPopupEl.querySelector('.lv-cheia-btn')).visibility === 'hidden',
      colunaIgual: Math.abs(+lyricsCifraCtlEl.getBoundingClientRect().height.toFixed(2) - colunaAntes) < 0.5,
    };
    velBtn.click();
    return {
      ausentes, fora, meiosTons, icoW,
      hit: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit')),
      velCaixas, velGaveta,
      trilha: +lyricsCifraCtlEl.getBoundingClientRect().width.toFixed(2),
      velIrmao: +lyricsPopupEl.querySelector('.lv-fonte-mais')
        .getBoundingClientRect().width.toFixed(2),
      saidaY: cx('#cifraCheiaBtn'), maisY: cx('.lv-fonte-mais'),
      transporY: [...lyricsPopupEl.querySelectorAll('.lv-cifra-ctl .lv-fonte-btn')]
        .filter((b) => b.textContent.trim() === '+½')
        .map((b) => b.getBoundingClientRect().top)[0],
      // A NOTA SAIU DE VEZ (v1.6.3): o operador mandou remover a frase, e o que
      // responde "a rolagem começou" é a própria folha andando devagar.
      nota: !!lyricsPopupEl.querySelector('.lv-cifra-nota'),
      quebra: getComputedStyle(lyricsPopupEl.querySelector('.popup-header')).flexWrap,
      // OS CENTROS HORIZONTAIS DOS DOIS BLOCOS, e o meio da caixa em que eles
      // vivem — ver a asserção do alinhamento, logo abaixo.
      centros: (() => {
        const meio = (e) => { const r = e.getBoundingClientRect();
          return +(r.left + r.width / 2).toFixed(2); };
        const cab = lyricsPopupEl.querySelector('.popup-header');
        const cs = getComputedStyle(cab);
        const r = cab.getBoundingClientRect();
        const dentro = +(r.left + parseFloat(cs.paddingLeft)
          + (r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) / 2).toFixed(2);
        const botoes = [
          ...lyricsPopupEl.querySelectorAll('.lv-cifra-ctl > *'),
          ...lyricsPopupEl.querySelectorAll('.lv-fonte-ctl > *'),
        ].filter((b) => b.getBoundingClientRect().width > 0);
        return { dentro, meios: botoes.map(meio), quantos: botoes.length };
      })(),
    };
  });
  checar(controles.ausentes.length === 0,
    'a coluna tem rolagem automática, velocidade, tamanho da fonte e a saída — '
    + 'todos desenhados (o TOM desceu para dentro da caixa na v1.6.3)',
    controles.ausentes);
  checar(controles.fora.length === 0,
    'e todos eles moram NA COLUNA (à direita da folha), nenhum por cima do texto',
    controles.fora);
  checar(controles.meiosTons.length === 2,
    'e o par de transposição −½/+½ veio junto', controles.meiosTons);
  checar(controles.icoW > 10 && controles.icoW < 30,
    'e o ícone do ⛶ tem a escala dos irmãos só-de-ícone (o SVG é reescrito por '
    + '`innerHTML` e não carrega dimensão própria)', controles.icoW);
  // A COLUNA TEM DOIS BLOCOS, E O ⛶ É O FIM DO DE CIMA (v1.6.3). A fila mudou
  // de casa — ela mora no CABEÇALHO desde que o tom desceu para dentro da caixa
  // e a barra deixou de existir —, e o cabeçalho ocupa a coluna inteira com
  // `space-between`: a fila no topo, o A+/A− no pé. Os dois extremos são o
  // alcance do polegar de quem segura o aparelho deitado, que é o argumento
  // escrito da `.pv-fsctl`.
  //
  // O QUE SOBREVIVE DO PEDIDO DA v1.6.1 é a ORDEM DENTRO DA FILA: *"coloque ele
  // no fim da lista à direita"* — e deitada, "fim da lista" é abaixo da
  // transposição. REVERSÃO: trocar o `ctl.prepend(...)` do `lvBuildCifra` por
  // `ctl.append(...)` põe o ⛶ acima dos outros quatro e reprova aqui.
  checar(controles.saidaY > controles.transporY,
    'e o ⛶ é o ÚLTIMO da fila também deitado — abaixo da transposição, que é o '
    + 'que "no fim da lista" quer dizer numa coluna', controles);
  // E O A+/A− FICA NO PÉ DA COLUNA, sozinho no outro extremo: é ele que prova
  // que o `space-between` do cabeçalho sobreviveu à mudança de casa. Sem esta,
  // um cabeçalho que empilhasse tudo no topo passaria na de cima.
  // REVERSÃO: tirar o `justify-content: space-between` do `.popup-header` em
  // `:fullscreen` junta os dois blocos e reprova aqui.
  checar(controles.maisY > controles.saidaY,
    'e o A+/A− fica no PÉ da coluna, no outro extremo do alcance do polegar',
    controles);
  // ===== E OS DOIS BLOCOS PARTILHAM UM CENTRO (v1.8.30) ====================
  //
  // As duas asserções acima medem o EIXO Y — quem está acima de quem —, e é
  // por aí que o defeito passou: no X, a fila dos cinco controles ficava
  // 11,2px à esquerda do A+/A−, numa trilha de 66px. Nada lança, todo botão
  // responde ao toque, e um teste de comportamento aprova as duas versões.
  //
  // A CAUSA era uma margem do RETRATO atravessando para a coluna:
  // `.lv-cifra-cabecalho .lv-cifra-ctl { margin-right: auto }` empurra a fila
  // para a esquerda numa LINHA, que é o trabalho dela ali. Numa COLUNA a mesma
  // margem age no eixo TRANSVERSAL, e margem `auto` no transversal VENCE o
  // `align-items` do pai: ela absorve a folga inteira (22,4px) de um lado só.
  // É o mesmo cuidado que a regra do `.lv-cheia-btn` já tomava — *o respiro da
  // saída troca de eixo com a fila* —, que faltou para a própria fila.
  //
  // AS DUAS METADES, e nenhuma basta sozinha:
  //  - UM CENTRO SÓ é o defeito medido, e ele passa também com tudo encostado
  //    à ESQUERDA (`align-items: flex-start` no cabeçalho seria o conserto
  //    barato, e deixaria a coluna torta para o outro lado);
  //  - ESSE CENTRO É O MEIO DA CAIXA fecha essa porta. A régua é a caixa de
  //    CONTEÚDO do cabeçalho e não a trilha: o recuo de área segura da
  //    paisagem é assimétrico de propósito (`-right` maior que o `-left`), e
  //    medir contra a trilha reprovaria o desenho por cumprir a área segura.
  //
  // REVERSÃO: tirar o `margin-right: 0` do bloco `:fullscreen .lv-cifra-ctl`
  // devolve os 11,2px e reprova a primeira. MEDIDO em três paisagens
  // (800×390, 892×412, 740×360) e com a gaveta de velocidade aberta e fechada:
  // o desvio é o mesmo nas seis, isto é, estrutural e não sub-pixel.
  const espalho = controles.centros.meios.length
    ? +(Math.max(...controles.centros.meios) - Math.min(...controles.centros.meios)).toFixed(2)
    : -1;
  checar(controles.centros.quantos >= 6 && espalho < 0.5,
    'e TODOS os controles da coluna partilham UM centro horizontal: a fila dos '
    + 'cinco e o A+/A− do pé, num eixo só', { espalho, ...controles.centros });
  checar(Math.abs(controles.centros.meios[0] - controles.centros.dentro) < 0.5,
    '  ↳ e esse centro é o MEIO da caixa do cabeçalho — sem esta, encostar '
    + 'tudo à esquerda passaria na de cima',
    { centro: controles.centros.meios[0], caixa: controles.centros.dentro });
  // A NOTA NÃO É DESENHADA AQUI, pelo MESMO número que já tirou as abas: a
  // trilha tem 66px e ~56 úteis, a `--fs-sm` mede ~6,3px por caractere, e a
  // frase viraria oito linhas roubando o lugar dos controles que este modo
  // existe para oferecer. `display: none` e não `visibility: hidden`: a coluna
  // é `space-between`, e um filho invisível MAS PRESENTE seria distribuído.
  //
  // A CONTA NÃO MUDOU COM A v1.6.2, e é por isso que a asserção fica: a nota
  // sobreviveu à rampa trocando de FATO (explica a lentidão, não a imobilidade)
  // e a frase mais longa foi de 63 para 65 caracteres — as mesmas ~8 linhas na
  // trilha. O que mudou é o preço: aqui já não se perde a explicação de uma
  // folha PARADA, se perde a de uma folha que anda devagar, e o toque continua
  // reconhecido pelo glifo do pause mais a folha se mexendo.
  //
  // REVERSÃO: recriar o `<small class="lv-cifra-nota">` no `lvBuildCifra`.
  checar(!controles.nota,
    'e a mensagem da rolagem não existe mais em lugar nenhum (v1.6.3) — o '
    + 'operador mandou removê-la, e a folha andando devagar já diz que começou',
    controles);
  // ── 6-B. O BOTÃO DE VELOCIDADE É QUADRADO TAMBÉM DEITADO (v1.6.2) ───────
  //
  // Pedido do operador: *"diminua a fonte do botão de 1x para que ele seja um
  // botão exatamente do mesmo tamanho e quadrado como os seus vizinhos"*.
  //
  // A MEDIÇÃO SE REPETE AQUI porque a trilha deitada é `flex-direction: column`,
  // e numa coluna flex quem decide a largura de um filho não é a mesma coisa que
  // no retrato — uma regra escrita só para a fila horizontal pode não alcançar a
  // vertical, e este é o modo em que a folha é lida de longe.
  //
  // A régua é `--hit`, o que o DESENHO reserva, e não uma fração da trilha: a
  // trilha é medida ao lado só para o `obtido` dizer de quanto era a folga.
  //
  // REVERSÃO NOMEADA: devolver `width: auto; min-width: calc(var(--hit) + 1.2rem)`
  // ao `.lv-cifra-vel` reprova a primeira aqui também — a caixa vai a 53,19px
  // dentro da trilha, e o `align-items: center` do bloco `:fullscreen` a segura
  // ali em vez de esticá-la.
  //
  // E O QUE **NÃO** É A REVERSÃO, dito porque é o palpite óbvio e ele está
  // ERRADO: tirar `align-items: center` daquele bloco não muda nada. MEDIDO com
  // a folha deitada, os cinco filhos e a `.lv-cifra-ctl` medem 34,00px com
  // `center` E com `stretch` — `stretch` só age sobre um filho de largura
  // `auto`, e desde a v1.6.2 os cinco herdam o `width: var(--hit)` do
  // `.lv-fonte-btn`. Aquela linha ficou INERTE neste lote (era o
  // `.lv-cifra-vel` de largura automática que ela existia para segurar), e é a
  // largura explícita que sustenta esta asserção hoje.
  const velFora = controles.velCaixas.filter(
    (c) => Math.abs(c.w - controles.hit) > 0.5 || Math.abs(c.h - controles.hit) > 0.5);
  checar(controles.hit > 0 && velFora.length === 0,
    'o botão de velocidade é QUADRADO e mede `--hit` na COLUNA DEITADA, em todo '
    + 'degrau da escada — a largura não depende do rótulo em cena nem da '
    + 'orientação', { hit: controles.hit, trilha: controles.trilha, fora: velFora });
  checar(Math.abs(controles.velIrmao - controles.hit) < 0.5,
    'e ele mede o MESMO que o A+ ao lado: uma coluna com um botão mais largo que '
    + 'os outros é o que o pedido nomeia',
    { vel: controles.velCaixas[0], irmao: controles.velIrmao });
  // ===== E A GAVETA TROCA DE EIXO COM A FILA (v1.8.80) =====
  //
  // No retrato ela cresce em LARGURA (9rem, à direita do play e do seletor); na
  // coluna deitada isso não caberia — a trilha tem 66px —, então lá ela cresce
  // em ALTURA com o slider na VERTICAL. É o par de regras de `:fullscreen` que
  // se prova aqui, e o modo de falhar dele é geométrico e mudo: 9rem dentro de
  // uma trilha de 66px sai recortado pelo `overflow: hidden` da própria gaveta,
  // com o controle vivo e invisível.
  const gav = controles.velGaveta || {};
  checar(gav.h > 0 && gav.w <= controles.hit + 2,
    'a gaveta da velocidade cresce em ALTURA na coluna deitada, e não passa da '
    + 'trilha', gav);
  checar(gav.sliderH > gav.sliderW,
    'e o slider é VERTICAL ali — deitado, ele seria o controle recortado que a '
    + 'gaveta esconde sem erro nenhum', gav);
  checar(gav.rolarAVista === true && gav.velAVista === true,
    'e o play e o seletor continuam à vista com a gaveta aberta, como no '
    + 'retrato — é o que o pedido do operador nomeia', gav);
  checar(gav.saidaCoberta === true && gav.colunaIgual === true,
    'e a SAÍDA é coberta aqui também, sem a coluna mudar de comprimento (v1.8.83 '
    + '— no retrato era o ✕ do cabeçalho que saía da caixa; aqui seria o A+/A− '
    + 'do pé da coluna)', gav);
  const velEstourando = controles.velCaixas.filter((c) => c.sw > c.cw);
  checar(velEstourando.length === 0,
    'e o rótulo CABE nele aqui também — com `width` fixo, um rótulo grande '
    + 'demais transbordaria por fora sem mexer na caixa nem na trilha',
    velEstourando.length ? velEstourando
      : controles.velCaixas.map((c) => c.rotulo + ' ' + c.sw + '/' + c.cw).join(' · '));

  // E O WRAP DO RETRATO É DESFEITO: numa COLUNA o `flex-wrap` não quebra linha,
  // ele abre uma SEGUNDA COLUNA dentro da trilha — e faria isso calado no dia
  // em que um sexto controle não coubesse.
  checar(controles.quebra === 'nowrap',
    'e a barra não pode QUEBRAR na coluna deitada — ali um wrap vira uma '
    + 'segunda coluna dentro de 66px, não uma segunda linha', controles.quebra);
  checar(cheia.abas === 'none' && cheia.fechar === 'none',
    'as ABAS e o ✕ saem: um segmentado de quatro opções em 66px é ilegível, e '
    + 'uma superfície em tela cheia tem UMA saída', { abas: cheia.abas, fechar: cheia.fechar });

  // FUNCIONAM: transpor meio tom DENTRO da tela cheia muda o tom mostrado.
  checar(/C/.test(retrato.tom),
    'o rótulo do tom existe e diz o tom da folha', retrato.tom);
  const tomDepois = await pg.evaluate(() => {
    [...lyricsPopupEl.querySelectorAll('.lv-cifra-ctl .lv-fonte-btn')]
      .find((b) => b.textContent.trim() === '+½').click();
    return lyricsViewBodyEl.querySelector('.lv-cifra-cab-tom').textContent;
  });
  // ===== OS ESPAÇOS DO CABEÇALHO SÃO A LINHA DA FOLHA (v1.6.3) =====
  //
  // Pedido do operador, ao pé da letra: *"um abaixo do outro com uma linha entre
  // eles e duas entre o início da intro/cifras"*. A régua não é um número
  // escrito aqui — é a altura de linha RENDERIZADA da folha, que é o que faz
  // "uma linha" significar uma linha para quem lê.
  //
  // REVERSÃO: trocar `--cifra-linha` por um `--sp-*` qualquer no CSS reprova as
  // duas, porque nenhum deles coincide com o `line-height` da folha.
  const espacos = await pg.evaluate(() => {
    const linha = parseFloat(getComputedStyle(
      lyricsViewBodyEl.querySelector('.lv-cifra-folha')).lineHeight);
    const tom = lyricsViewBodyEl.querySelector('.lv-cifra-cab-tom');
    const cab = lyricsViewBodyEl.querySelector('.lv-cifra-cab');
    return {
      linha,
      entreTituloETom: parseFloat(getComputedStyle(tom).marginTop) / linha,
      antesDaCifra: parseFloat(getComputedStyle(cab).marginBottom) / linha,
    };
  });
  checar(Math.abs(espacos.entreTituloETom - 1) < 0.02,
    'entre o título e o tom há UMA linha da folha — a régua é o `line-height` '
    + 'dela, não um espaçamento inventado', espacos);
  checar(Math.abs(espacos.antesDaCifra - 2) < 0.02,
    'e entre o tom e o início da cifra há DUAS — é essa margem que impede a '
    + 'rolagem de cortar a intro logo no começo', espacos);

  checar(tomDepois !== cheia.tom && /#|D/.test(tomDepois),
    'e transpor meio tom DENTRO da tela cheia muda o tom mostrado — os '
    + 'controles são os de verdade, não uma segunda implementação',
    { antes: cheia.tom, depois: tomDepois });

  // ===== A GRAFIA É DA FOLHA, E SÓ AQUI ISSO É MEDIDO (v1.8.93) =====
  //
  // A regra mora no `cifra.js` (bloco 3c do `cifra.test.mjs`), mas quem a LIGA é
  // o `cifraDesenharFolha`, e essa ligação não tinha oráculo nenhum. O modo de
  // falhar dela é MUDO: sem o terceiro argumento do `transporLinha`, cada acorde
  // volta a se grafar sozinho e o resultado fica QUASE certo — três dos quatro
  // saem idênticos.
  //
  // O DISCRIMINADOR É O `F`. A fixture é `C G Am F` no tom de C; meio tom acima
  // o tom é Ré bemol maior, e o quarto acorde é `Gb`. Sozinho, aquele `F` viraria
  // `F#`: o grau 6 é o único empate de armadura (seis acidentes de cada lado), e
  // a folha é justamente quem desempata. Um sustenido nesta linha é a ligação
  // desfeita.
  // Lê TODAS as linhas de acordes e junta o conjunto, em vez da primeira: na
  // coluna estreita da tela cheia o `quebrarPares` reparte o par, e a primeira
  // linha sai com três dos quatro acordes — um `[0]` aqui mediria a quebra, não
  // a grafia.
  const acordesDepois = await pg.evaluate(() => {
    const t = [...lyricsViewBodyEl.querySelectorAll('.lv-cifra-acordes')]
      .map((l) => l.textContent).join(' ').trim().split(/\s+/).filter(Boolean);
    return [...new Set(t)].sort().join(' ');
  });
  checar(acordesDepois === 'Ab Bbm Db Gb',
    'a folha inteira sai na grafia do TOM DE DESTINO — o `F` vira `Gb` porque a '
    + 'folha está em Ré bemol, e não `F#` porque cada acorde decidiu sozinho',
    acordesDepois);

  // O A+/A− também é o de verdade, e mexe na escada DA TELA CHEIA.
  const fonteMais = await pg.evaluate(async () => {
    const antesEscopado = lyricsPopupEl.style.getPropertyValue('--lv-fonte');
    const antesRaiz = document.documentElement.style.getPropertyValue('--lv-fonte');
    lyricsPopupEl.querySelector('.lv-fonte-mais').click();
    await new Promise((r) => setTimeout(r, 200));
    return {
      antesEscopado, antesRaiz,
      depoisEscopado: lyricsPopupEl.style.getPropertyValue('--lv-fonte'),
      depoisRaiz: document.documentElement.style.getPropertyValue('--lv-fonte'),
    };
  });
  checar(fonteMais.depoisEscopado !== fonteMais.antesEscopado
    && fonteMais.depoisRaiz === fonteMais.antesRaiz,
    'e o A+ dentro da tela cheia mexe na escada DELA — o corpo do retrato (o '
    + 'token do `:root`, que a zona de letra do Modo Fácil também lê) não anda',
    fonteMais);

  // O TETO DA ESCADA É O DA TELA CHEIA, e este é o modo de falhar mais mudo do
  // par: `aplicarTamanhoDaLetra` desabilita o A+/A− por CLASSE, nas duas casas
  // de uma vez, a partir de UM índice. Lendo `lvTamanho` (o corpo do retrato)
  // com a escada da tela cheia no ar, o botão descreve a escada errada — e o
  // preço se paga DEPOIS: quem batesse no teto aqui sairia com o A+ desabilitado
  // no retrato, e ele simplesmente pararia de responder.
  const teto = await pg.evaluate(async () => {
    const mais = lyricsPopupEl.querySelector('.lv-fonte-mais');
    const menos = lyricsPopupEl.querySelector('.lv-fonte-menos');
    // ABRE UM DEGRAU DE FOLGA ANTES DE SUBIR (v1.6.1). A tela cheia semeia
    // `cifraCheiaIdx` perto do topo — a fonte grande é o objetivo do modo — e o
    // bloco `fonteMais` logo acima já gastou o degrau que sobrava: sem isto o
    // laço nasce com o A+ JÁ desabilitado, `passos` sai ZERO e a asserção
    // reprova um app CERTO.
    //
    // ATÉ A v1.6.0 A FOLGA VINHA DE GRAÇA — E VINHA DO DEFEITO: o `.click()` no
    // `+½` do bloco de transposição acima também ENCOLHIA a letra, porque o
    // ouvinte delegado do par casava `.lv-fonte-btn` e lia todo botão que não
    // fosse `.lv-fonte-mais` como DIMINUIR. **Este oráculo dependia dele**, e
    // por isso reprovou no lote que o corrigiu. Ver `fonte-so-do-par.test.mjs`.
    let recuos = 0;
    if (!menos.disabled) { menos.click(); recuos++; await new Promise((r) => setTimeout(r, 120)); }
    let passos = 0;
    for (let i = 0; i < 8 && !mais.disabled; i++) { mais.click(); passos++; await new Promise((r) => setTimeout(r, 120)); }
    const noTeto = mais.disabled;
    for (let i = 0; i < passos; i++) { menos.click(); await new Promise((r) => setTimeout(r, 120)); }
    return { noTeto, passos, recuos, voltouAoTopoDaEscada: !mais.disabled };
  });
  checar(teto.noTeto && teto.passos > 0 && teto.voltouAoTopoDaEscada,
    'no fim da escada DA TELA CHEIA o A+ se apaga — o estado desabilitado segue '
    + 'a escada que está no ar, não a do retrato', teto);

  // ── 7-B. A TELA CHEIA SAI SOZINHA QUANDO A CIFRA DEIXA DE SER A FONTE ────
  //
  // Trocar de aba, ou a cena virar para uma música sem cifra. Sem a guarda, o
  // layout desenhado para a cifra passa a mostrar a LETRA com o seletor de abas
  // escondido (ele some em tela cheia) e sem o ⛶ (ele só é desenhado na cifra):
  // uma tela cheia deitada e sem saída à vista, no meio do culto.
  const trocouFonte = await pg.evaluate(async () => {
    const antes = document.fullscreenElement === lyricsPopupEl;
    lvSource = 'lyrics';
    renderLyricsView();
    await new Promise((r) => setTimeout(r, 300));
    const depois = !!document.fullscreenElement;
    // A ÁRVORE É A RESPOSTA (v1.6.1): fora da aba de cifra a barra é esvaziada
    // e o nó do ⛶ não está em lugar nenhum do documento — ele sobrevive só
    // pela referência de módulo. Perguntar `.hidden` aqui é ler propriedade de
    // `null`, e o `evaluate` inteiro cai com um `TypeError`.
    const botaoNaLetra = !!lyricsPopupEl.querySelector('#cifraCheiaBtn');
    lvSource = 'cifra';
    renderLyricsView();
    return { antes, depois, botaoNaLetra, fonte: lvActiveSource() };
  });
  checar(trocouFonte.antes && !trocouFonte.depois && trocouFonte.fonte === 'cifra',
    'trocar para a aba de LETRA sai da tela cheia sozinho — o layout é da cifra, '
    + 'e nele nem as abas nem o ⛶ são desenhados', trocouFonte);
  checar(trocouFonte.botaoNaLetra === false,
    'e o ⛶ some fora da aba de cifra: a mesma regra do microfone sem TV — não '
    + 'oferecer é melhor que explicar', trocouFonte);
  // Volta para a tela cheia: os blocos seguintes falam da saída por outras
  // portas, e cada um precisa entrar por sua conta.
  await pg.evaluate(() => { window.__fsEventos = 0; });
  await pg.click('#cifraCheiaBtn');
  await esperarEvento(1);
  await pg.setViewportSize({ width: 800, height: 390 });
  await pg.waitForFunction(
    (antes) => cifraColunasAtual > antes, retrato.colunas, { timeout: 10000 },
  ).catch(() => {});

  // ── 7-C. A BARRA SEMPRE TEM A SAÍDA, DURANTE A ESPERA (v1.6.1) ──────────
  //
  // `lvBuildCifra` tem um `return` cedo — a ESPERA —, e ele é alcançável COM A
  // TELA CHEIA NO AR: basta a cena virar de faixa para a entrada nova nascer em
  // `buscando`, e com a cifra ESCOLHIDA (`lvSource`, que é o caso deste
  // oráculo) ela continua na lista, então `lvActiveSource()` segue devolvendo
  // `'cifra'` e a saída automática do bloco 7-B acima não dispara.
  //
  // Construída DEPOIS do retorno — que é onde ela nasceu, na v1.6.0 —, a barra
  // some e o que sobra é uma paisagem deitada com um anel girando e NENHUMA
  // saída à vista: o ✕, as abas e o toque no fundo já saem em tela cheia por
  // regra escrita, e Esc/F11 não existem num aparelho. Sobraria só o voltar do
  // Android, que é a saída que ninguém vê.
  //
  // O ESTADO É MEXIDO NO CACHE, e o desenho é o do app: `renderLyricsView` é o
  // mesmo caminho que o operador percorre quando a procura ainda está em voo.
  //
  // REVERSÃO: devolver a construção da barra para depois do `return`
  // (a montagem `topo`/`tom`/`ctl` de volta ao ramo `ok`) reprova aqui.
  const naEspera = await pg.evaluate(() => {
    const entrada = cifraCache.get(cifraChave(lvItem()));
    const antes = entrada.estado;
    entrada.estado = 'buscando';
    renderLyricsView();
    const btn = lyricsPopupEl.querySelector('.lv-cifra-ctl > #cifraCheiaBtn:last-child');
    const b = btn ? btn.getBoundingClientRect() : null;
    const corpo = lyricsViewBodyEl.getBoundingClientRect();
    const alvo = b
      ? document.elementFromPoint(Math.round(b.left + b.width / 2),
        Math.round(b.top + b.height / 2))
      : null;
    const r = {
      cheia: document.fullscreenElement === lyricsPopupEl,
      fonte: lvActiveSource(),
      naFila: !!btn,
      desenhado: !!(b && b.width > 0 && b.height > 0),
      naColuna: !!(b && b.left >= corpo.right - 0.5),
      recebeOToque: !!(alvo && alvo.closest('#cifraCheiaBtn')),
    };
    entrada.estado = antes;
    renderLyricsView();
    return r;
  });
  checar(naEspera.cheia && naEspera.fonte === 'cifra' && naEspera.naFila
    && naEspera.desenhado && naEspera.naColuna && naEspera.recebeOToque,
    'com a cifra em `buscando` e a tela cheia no ar, a saída continua na fila, '
    + 'desenhada, na coluna e TOCÁVEL — a barra nasce com o ⛶ antes do retorno '
    + 'cedo, e a espera fica de pé para quem ESCOLHEU a aba', naEspera);

  // ── 7-C'. E A MESMA ESPERA COM A GAVETA ABERTA (v1.8.85) ────────────────
  //
  // A v1.8.83 revogou a invariante do ⛶ ("a fila sempre tem a saída") a pedido
  // do operador: com a gaveta ABERTA, a saída passou a ser o ✕ da própria
  // gaveta, que é o mesmo botão do seletor. Só que a classe `escolhendo` mora
  // no `.lv-cifra-ctl`, que `renderLyricsView` NÃO recria — ela atravessava o
  // render, e um render que caísse na ESPERA varria o ✕ da fila enquanto a
  // regra de tela cheia seguia apagando o ⛶. Sobrava o voltar do Android.
  //
  // REVERSÃO: tirar o `classList.remove('escolhendo')` de antes dos retornos
  // cedo, no `lvBuildCifra`, reprova aqui.
  const gavetaNaEspera = await pg.evaluate(() => {
    const vel = lyricsPopupEl.querySelector('.lv-cifra-vel');
    if (vel) vel.click();                       // abre a gaveta
    const entrada = cifraCache.get(cifraChave(lvItem()));
    const antes = entrada.estado;
    entrada.estado = 'buscando';
    renderLyricsView();
    const ctl = lyricsPopupEl.querySelector('.lv-cifra-ctl');
    const btn = lyricsPopupEl.querySelector('.lv-cifra-ctl > #cifraCheiaBtn:last-child');
    const b = btn ? btn.getBoundingClientRect() : null;
    const alvo = b
      ? document.elementFromPoint(Math.round(b.left + b.width / 2),
        Math.round(b.top + b.height / 2))
      : null;
    const r = {
      cheia: document.fullscreenElement === lyricsPopupEl,
      escolhendo: !!(ctl && ctl.classList.contains('escolhendo')),
      desenhado: !!(b && b.width > 0 && b.height > 0),
      recebeOToque: !!(alvo && alvo.closest('#cifraCheiaBtn')),
    };
    entrada.estado = antes;
    renderLyricsView();
    return r;
  });
  checar(gavetaNaEspera.cheia && gavetaNaEspera.escolhendo === false
    && gavetaNaEspera.desenhado && gavetaNaEspera.recebeOToque,
    'com a GAVETA ABERTA, a espera fecha a gaveta e devolve o ⛶ tocável — a '
    + 'classe `escolhendo` não pode atravessar um render que varre o ✕ dela',
    gavetaNaEspera);

  // ── 7-E. AS PONTAS DO SLIDER SEGUEM O EIXO DELE (v1.8.85) ───────────────
  //
  // O slider da gaveta é `writing-mode: vertical-lr` + `direction: rtl`: o
  // MÍNIMO fica EMBAIXO. A ordem do DOM é `pontaIni("0,5×") · slider ·
  // pontaFim("2×")`, então numa coluna comum os rótulos saem INVERTIDOS em
  // relação ao controle — o músico arrasta o cap para o "0,5×" que lê em cima e
  // a folha acelera para 2× no meio da música.
  //
  // REVERSÃO: trocar `column-reverse` por `column` na regra de tela cheia
  // reprova aqui.
  const eixo = await pg.evaluate(() => {
    const vel = lyricsPopupEl.querySelector('.lv-cifra-vel');
    if (vel) vel.click();
    const vels = lyricsPopupEl.querySelector('.lv-cifra-vels');
    const pontas = [...vels.querySelectorAll('.lv-cifra-vel-ponta')];
    const slider = vels.querySelector('.lv-cifra-slider');
    const r = {
      n: pontas.length,
      primeiroTexto: pontas[0] ? pontas[0].textContent.trim() : '',
      // quem está MAIS EMBAIXO na tela (maior `top`)
      embaixo: pontas.length === 2
        ? (pontas[0].getBoundingClientRect().top > pontas[1].getBoundingClientRect().top
          ? pontas[0].textContent.trim() : pontas[1].textContent.trim())
        : '',
      minEmbaixo: slider ? getComputedStyle(slider).direction === 'rtl' : false,
    };
    if (vel) vel.click();
    return r;
  });
  checar(eixo.n === 2 && eixo.minEmbaixo === true && eixo.embaixo === eixo.primeiroTexto,
    'em tela cheia a ponta do MÍNIMO fica EMBAIXO, do mesmo lado do mínimo do '
    + 'slider (`direction: rtl`) — invertidas, elas mandam o músico arrastar '
    + 'para o lado errado com a música no ar', eixo);

  // ── 7-D. E O DESFECHO SEM FOLHA NÃO CHEGA MAIS À BARRA (v1.8.28) ─────────
  //
  // Este é o outro `return` cedo que 7-C media até a v1.8.27: a frase de erro
  // deitada. Ele deixou de ser alcançável, e não por acidente — a aba sai da
  // lista quando a procura termina sem folha ("não quero acesso a essa seção se
  // não tem esse conteúdo"), e quem devolve o retrato é o `cifraCheiaSair` do
  // `renderLyricsView`, o mesmo caminho do bloco 7-B.
  //
  // A ASSERÇÃO MUDOU DE FORMA, NÃO DE ASSUNTO: o perigo continua sendo uma
  // paisagem deitada sem saída à vista, e a resposta nova é mais forte — em vez
  // de garantir o botão dentro daquela tela, o app não deixa a tela existir.
  //
  // A SAÍDA DA TELA CHEIA É ASSÍNCRONA (`exitFullscreen` resolve depois), então
  // quem responde é o EVENTO, nunca a leitura no mesmo `evaluate` — foi assim
  // que a primeira escrita deste bloco "reprovou" a correção certa.
  await pg.evaluate(() => { window.__fsEventos = 0; });
  const semFolha = await pg.evaluate(() => {
    const entrada = cifraCache.get(cifraChave(lvItem()));
    entrada.estado = 'falha';
    entrada.motivo = AVCifra.MOTIVO_NAO_TEM;
    renderLyricsView();
    return { fontes: lyricsViewSources(), fonte: lvActiveSource() };
  });
  await esperarEvento(1);
  const semFolhaDepois = await pg.evaluate(() => ({
    cheia: !!document.fullscreenElement,
    aberta: lyricsPopupEl.classList.contains('open'),
    botao: !!lyricsPopupEl.querySelector('#cifraCheiaBtn'),
  }));
  checar(!semFolha.fontes.includes('cifra') && semFolha.fonte === 'lyrics'
    && !semFolhaDepois.cheia && semFolhaDepois.aberta && !semFolhaDepois.botao,
    'e a procura que termina SEM FOLHA tira a aba da lista e devolve o retrato '
    + 'sozinha, com a folha aberta na letra — a paisagem sem saída deixa de '
    + 'poder existir em vez de ganhar mais um botão',
    { semFolha, semFolhaDepois });

  // Volta ao estado do bloco: a entrada em `ok` e a tela cheia no ar, que é o
  // que os blocos seguintes medem.
  await pg.evaluate(() => {
    const entrada = cifraCache.get(cifraChave(lvItem()));
    entrada.estado = 'ok';
    entrada.motivo = AVCifra.OK;
    lvSource = 'cifra';
    renderLyricsView();
    window.__fsEventos = 0;
  });
  await pg.click('#cifraCheiaBtn');
  await esperarEvento(1);
  await pg.waitForFunction(
    (antes) => cifraColunasAtual > antes, retrato.colunas, { timeout: 10000 },
  ).catch(() => {});

  // ── 7. A ROLAGEM ATRAVESSA A ENTRADA E A SAÍDA ───────────────────────────
  //
  // A remedição esvazia e reconstrói o corpo: o `scrollTop` volta a zero e o
  // quadro seguinte conclui — com razão — que outro mexeu na folha, adotando o
  // topo. A folha voltava ao começo no meio da música. A posição é preservada
  // em FRAÇÃO do percurso porque a folha MUDA DE COMPRIMENTO na remedição.
  //
  // A POSIÇÃO parte de 40% do percurso — o dedo de quem já leu meia folha —, e
  // não do topo: com a leitura no zero, "voltou ao topo" e "sobreviveu" são o
  // MESMO resultado, e o oráculo aprovaria o defeito.
  const rolagem = await pg.evaluate(async () => {
    // O degrau mais rápido da escada, só para encurtar a rampa — `2×` desde a
    // v1.6.1 (o `3×` saiu a pedido do operador). E o número IMPORTA: um degrau
    // FORA da escada cai no `CIFRA_VEL_PADRAO` pelo `indexOf`, que é o sentinela
    // `'auto'`, e a linha abaixo calcularia `CIFRA_PX_POR_S * 'auto'` = `NaN`;
    // `rampaInicialDaRolagem` devolve 0 diante disso e o oráculo mediria a folha
    // ainda no arranque de 4 px/s, longe do compasso que ela vai seguir.
    cifraAdotarVelocidade(2);
    midiaNoAr = false;
    const el = lyricsViewBodyEl;
    el.scrollTop = (el.scrollHeight - el.clientHeight) * 0.4;
    const pxPorS = CIFRA_PX_POR_S * CIFRA_VELOCIDADES[cifraVelIdx];
    // A RAMPA DE ARRANQUE (v1.6.2) no lugar da espera parada: o número continua
    // saindo da função pura do app, e o que ele passou a significar é o TRECHO
    // em que a folha anda devagar, não o instante em que ela começa a andar.
    const rampaMs = AVCifra.rampaInicialDaRolagem(el.clientHeight, pxPorS);
    cifraRolarAlternar();
    await new Promise((r) => setTimeout(r, rampaMs + 700));
    const rolavel = el.scrollHeight - el.clientHeight;
    return { fracao: rolavel > 0 ? el.scrollTop / rolavel : 0, rolando: cifraRolando };
  });
  checar(rolagem.rolando && rolagem.fracao > 0.35,
    'com a rolagem automática ligada, a folha anda em tela cheia a partir de '
    + 'onde o dedo a deixou', rolagem);

  // ── 8. O VOLTAR DO APARELHO SAI DA TELA CHEIA E DEIXA A FOLHA ABERTA ─────
  //
  // O degrau 1.5. Sem ele o degrau 2 fecharia a FOLHA com a tela cheia ainda
  // de pé: tirar `.open` só muda opacidade e `pointer-events`, e o que sobra é
  // uma superfície invisível com a Activity deitada.
  const consumiu = await pg.evaluate(() => window.__avBack());
  await esperarEvento(2);   // o contador foi zerado na reentrada acima: 1 entrar, 2 sair
  await pg.setViewportSize({ width: 430, height: 900 });
  await pg.waitForFunction(
    (antes) => cifraColunasAtual < antes, cheia.colunas, { timeout: 10000 },
  ).catch(() => {});
  const saiu = await medir();
  const aberta = await pg.evaluate(() => lyricsPopupEl.classList.contains('open'));
  checar(consumiu === true && !saiu.cheia,
    'o voltar do aparelho SAI da tela cheia e consome o toque (degrau 1.5)',
    { consumiu, cheia: saiu.cheia });
  checar(aberta,
    'e a FOLHA continua aberta: a tela cheia é um modo dela, e o toque seguinte '
    + 'é que a fecha', aberta);
  checar(Math.abs(saiu.fonte - retrato.fonte) < 0.5 && saiu.varEscopada.trim() === '',
    'o corpo volta ao do retrato, e volta porque nunca foi embora — a saída é '
    + 'um `removeProperty`, não uma subtração',
    { retrato: retrato.fonte, saiu: saiu.fonte, escopado: saiu.varEscopada });
  checar(saiu.colunas === retrato.colunas && !saiu.folhaEstoura,
    'e a folha é requebrada de volta para a largura do retrato',
    { retrato: retrato.colunas, saiu: saiu.colunas });
  checar(saiu.par && Math.abs(saiu.par.a - saiu.par.b) < 0.5,
    'com o par acorde/letra ainda alinhado na volta', saiu.par);

  // A ROLAGEM SOBREVIVEU AOS DOIS: ela é o único estado da folha que não se
  // reconstrói, e a chave "música nova é folha nova" não pode tê-la derrubado
  // (a tela cheia não muda `lvItem()`).
  const depoisDeSair = await pg.evaluate(async () => {
    const el = lyricsViewBodyEl;
    const rolavel = el.scrollHeight - el.clientHeight;
    const antes = el.scrollTop;
    await new Promise((r) => setTimeout(r, 700));
    const r2 = { rolando: cifraRolando, andou: el.scrollTop - antes, fracao: rolavel > 0 ? antes / rolavel : 0 };
    cifraRolarParar();
    return r2;
  });
  checar(depoisDeSair.rolando === true && depoisDeSair.andou > 1,
    'e a rolagem automática SOBREVIVE à entrada e à saída — ela continua '
    + 'andando do outro lado', depoisDeSair);
  checar(Math.abs(depoisDeSair.fracao - rolagem.fracao) < 0.08,
    'e a POSIÇÃO de leitura sobrevive junto, em FRAÇÃO do percurso (a folha muda '
    + 'de comprimento na remedição, então o pixel não significa nada do outro '
    + 'lado): ela não volta ao topo no meio da música',
    { antes: rolagem.fracao, depois: depoisDeSair.fracao });

  // ── 9. NADA DISSO VAI AO TELÃO ───────────────────────────────────────────
  //
  // A cifra é do operador, por contrato. É uma AUSÊNCIA, e ausência não tem
  // sintoma enquanto vale — mas o dia em que a tela cheia da folha mandar um
  // comando, ela estará operando a projeção no meio do culto.
  const vistos = await pg.evaluate(() => window.__vistos);
  checar(vistos.length === 0,
    'e o modo inteiro não manda comando NENHUM ao barramento: entrar, transpor, '
    + 'rolar e sair são do celular de quem toca', vistos.join(', ') || '(nenhum)');

  // ── 10. FECHAR A FOLHA NUNCA DEIXA UMA TELA CHEIA DE PÉ ──────────────────
  //
  // `closeLyricsPopup` é o ponto único de todas as portas (o ✕, o toque no
  // fundo, o degrau 2 do voltar, o `sairDasCamadas` de um compartilhamento). A
  // invariante mora lá, e não em cada uma delas.
  await pg.evaluate(() => { window.__fsEventos = 0; });
  await pg.click('#cifraCheiaBtn');
  await esperarEvento(1);
  const fechou = await pg.evaluate(async () => {
    const entrou = document.fullscreenElement === lyricsPopupEl;
    closeLyricsPopup();
    await new Promise((r) => setTimeout(r, 300));
    return { entrou, aindaCheia: !!document.fullscreenElement, aberta: lyricsPopupEl.classList.contains('open') };
  });
  checar(fechou.entrou && !fechou.aindaCheia && !fechou.aberta,
    'fechar a folha por qualquer porta sai da tela cheia junto — uma folha '
    + 'fechada nunca deixa a Activity deitada sobre uma camada invisível', fechou);

  await dormir(50);
  checar(erros.length === 0, 'nenhum erro de console', erros);
} finally {
  await navegador.close();
  servidor.close();
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
