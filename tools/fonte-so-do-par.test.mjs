#!/usr/bin/env node
// ============================================================================
// SÓ O PAR A+/A− MEXE NO TAMANHO DA LETRA
//
// ## O defeito que ele trava — e que estava EM PRODUÇÃO até a v1.6.0
//
// O par de fonte vive em DUAS casas (a folha de leitura e a linha do nome do
// Modo Fácil) e o ouvinte é UM, delegado no documento. Ele casava a classe de
// APARÊNCIA:
//
//     const btn = e.target.closest('.lv-fonte-btn');
//     passoTamanhoDaLetra(btn.classList.contains('lv-fonte-mais') ? 1 : -1);
//
// O `-1` é um `else` sobre um conjunto ABERTO — e `.lv-fonte-btn` veste também
// os QUATRO botões da barra da cifra (rolagem, velocidade, −½ e +½), porque ali
// é o mesmo gesto e a classe é a pintura dele. Resultado: cada toque em
// qualquer um deles ENCOLHIA a letra.
//
// MEDIDO na v1.6.0, com a escada `[1, 1.2, 1.4, 1.7, 2, 2.4]`:
//
//   | toque                    | `--lv-fonte`      |
//   |--------------------------|-------------------|
//   | velocidade               | 1,4rem → 1,2rem   |
//   | −½ (transpor)            | 1,2rem → 1rem     |
//   | +½ (transpor)            | 1rem → 1rem (piso)|
//
// E em TELA CHEIA é pior: lá o passo cai em `passoTamanhoDaCheia`, que mexe na
// escada DAQUELE modo (2rem → 1,7rem) e a GRAVA (`cifraFonteCheia`) — no modo
// cujo objetivo declarado é ler de longe, com o instrumento na mão.
//
// O botão de ROLAR escapava POR ACIDENTE, e o acidente é parcial:
// `cifraPintarRolar` troca o `innerHTML` dele dentro do próprio handler, então
// o `e.target` é um `span.msym` já desligado da árvore. `closest()` COMEÇA POR
// SI MESMO — é isso que fazia os outros três casarem mesmo desligados —, e o
// glifo não casa o seletor nem tem ancestral.
//
// MEDIDO aqui, hit-test de 1px sobre a caixa de 34×34 no corpo padrão: **~60%
// da área cai no glifo e escapa, ~37% cai no `<button>` e ENCOLHE** (o resto é
// a borda fracionária). A proporção depende da fonte de ícones instalada — o
// que não depende dela é a parte que encolhe ser grande. E por TECLADO (Enter
// no botão focado) o alvo é SEMPRE o botão: ali o acidente não cobre nada.
//
// ## Por que ele é um arquivo, e não uma asserção da cifra
//
// A propriedade é da FAMÍLIA de botões, não da cifra: *nada além do par escreve
// no tamanho da letra*. Ela vale no retrato e na tela cheia, nas duas casas do
// par, e — a asserção que carrega o arquivo — para um `.lv-fonte-btn` que ainda
// não existe. Um caso disso dentro do `cifra-rolagem` ou do `cifra-tela-cheia`
// seria uma regra de outro assunto pendurada num arquivo que fala de ritmo e de
// paisagem.
//
// ## Como se espera pelo FATO, sendo a asserção uma AUSÊNCIA
//
// Um oráculo que só afirma "o token não mudou" passa também quando o botão NÃO
// FOI ACIONADO — um seletor errado no próprio teste o aprovaria. Por isso cada
// ativação vem em par: o token PARADO **e** a TESTEMUNHA do botão tendo agido.
// A testemunha é uma só e cobre os quatro alvos, porque cada um move um pedaço
// dela: o rótulo da velocidade, o tom da folha, e o estado da rolagem.
//
// Para o botão DESCARTÁVEL do último bloco não há efeito legítimo nenhum — e
// ali a ausência vira CONTAGEM POSITIVA: clica-se ele e DEPOIS o A−, e exige-se
// que a escada tenha andado EXATAMENTE UM degrau (com o defeito andaria dois).
//
//   node tools/fonte-so-do-par.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

// A PONTE DE MENTIRA: `cifraHtml` devolve uma folha com acordes de verdade —
// sem `<b>` não há `.lv-cifra-acordes`, e sem folha desenhada não existe a
// barra em que os alvos deste arquivo moram. O tom `C` importa: é ele que a
// testemunha da transposição vê mudar.
const PONTE = `(() => {
  const LINHAS = [];
  for (let i = 0; i < 120; i++) {
    LINHAS.push('<b>C</b>      <b>G</b>');
    LINHAS.push('linha de marcador numero ' + i);
  }
  const FOLHA = '<div>Tom: C</div><pre>' + LINHAS.join('\\n') + '</pre>';
  const B = {
    shellVersion: () => 50,
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    cifraHtml: (id, url) => {
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
    'ytFetchAudio','ytPlaylist','ytSearch','ytStream','areaTransferencia','atualizacaoEstado'];
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
const erros = [];
pg.on('pageerror', (e) => erros.push(String(e)));
const base = 'http://localhost:' + servidor.address().port;

// ── O ESTADO QUE ESTE ARQUIVO MEDE ──────────────────────────────────────────
//
// DOIS tokens e um índice, porque são DUAS escadas: a do retrato mora no
// `:root` (e a zona de letra do Modo Fácil a lê), a da tela cheia mora escopada
// no `#lyricsPopup` e é contada por `cifraCheiaIdx`. Um defeito que mexesse só
// numa passaria despercebido lendo a outra.
const lerFonte = () => pg.evaluate(() => ({
  raiz: document.documentElement.style.getPropertyValue('--lv-fonte').trim(),
  escopado: lyricsPopupEl.style.getPropertyValue('--lv-fonte').trim(),
  idxCheia: cifraCheiaIdx,
}));

// A TESTEMUNHA: uma string só, e cada alvo move um pedaço dela. É ela que
// impede a asserção de ausência de passar por ninguém ter acionado nada.
const testemunha = () => pg.evaluate(() => {
  const q = (s) => {
    const el = lyricsPopupEl.querySelector(s);
    return el ? el.textContent.trim() : '(ausente)';
  };
  // O TOM DESCEU PARA DENTRO DA CAIXA na v1.6.3 (`.lv-cifra-cab-tom`), junto do
  // título da obra: a barra que o hospedava saiu, e com ela o `.lv-cifra-tom`.
  // A GAVETA DA VELOCIDADE entrou na testemunha na v1.7.4: o toque no botão de
  // velocidade deixou de trocar o rótulo (ele ABRE a lista), e sem este termo o
  // botão passaria a contar como MUDO — a guarda de "todos agiram" reprovaria um
  // app correto, e o oráculo perderia justamente o alvo que ele veio vigiar.
  const gaveta = lyricsCifraCtlEl.classList.contains('escolhendo') ? 'gaveta' : 'fila';
  return q('.lv-cifra-vel') + ' | ' + q('.lv-cifra-cab-tom')
    + ' | ' + (cifraRolando ? 'rolando' : 'parada') + ' | ' + gaveta;
});

// OS ALVOS SÃO DESCOBERTOS NO DOM VIVO, nunca escritos como lista: é assim que
// o botão que a barra ganhar amanhã já entra sem uma linha editada aqui. O
// seletor é a definição da propriedade — *tudo que veste `.lv-fonte-btn` sem
// ser o par* —, e o `nth(i)` resolve na ORDEM DO DOM, que é a mesma a cada
// remontagem.
// `:not(.lv-cifra-vel-op)` exclui os botões da GAVETA da velocidade (v1.7.4), e
// não porque a propriedade não vale para eles — vale, e o bloco 1-B a cobre. É
// que eles nascem ESCONDIDOS (a gaveta fechada é `display: none`), e dois dos
// três caminhos daqui exigem uma caixa: `boundingBox()` devolve `null` e o
// `focus()` não pousa. Eles entram num bloco próprio, que os revela antes.
const SEL_ALVO = '#lyricsPopup .lv-fonte-btn:not(.lv-fonte-menos):not(.lv-fonte-mais)'
  + ':not(.lv-cifra-vel-op)';
const alvo = (i) => pg.locator(SEL_ALVO).nth(i);
const alvosVivos = () => pg.locator(SEL_ALVO).evaluateAll((els) => els.map((b) => (
  b.className.replace('lv-fonte-btn', '').trim() || b.textContent.trim() || '?'
)));

// PÕE A ESCADA NO MEIO ANTES DE CADA ATIVAÇÃO — e isto não é higiene, é a
// diferença entre pegar o defeito e não pegar. No PISO o passo dele é um no-op
// e o token não anda: MEDIDO, com o seletor antigo de volta, a primeira rodada
// leva a escada de 1,4rem ao piso de 1rem em três toques, e as duas rodadas
// seguintes (o dedo na borda e o teclado) passariam MUDAS sobre um app
// quebrado. Vale para as duas escadas: em tela cheia `passoTamanhoDaLetra`
// delega em `passoTamanhoDaCheia`, então a mesma função serve as duas.
const armar = () => pg.evaluate(async () => {
  const meio = 2;   // 1,4rem: o padrão da escada, com folga para os dois lados
  const idx = () => (cifraCheia ? cifraCheiaIdx : LV_TAMANHOS.indexOf(lvTamanho));
  for (let g = 0; g < 12 && idx() > meio; g++) await passoTamanhoDaLetra(-1);
  for (let g = 0; g < 12 && idx() < meio; g++) await passoTamanhoDaLetra(1);
  return idx();
});

// OS TRÊS CAMINHOS ATÉ O BOTÃO, e eles não são intercambiáveis. O acidente que
// poupava a rolagem cobre só o dedo no MEIO da caixa dela — ali o alvo é o
// `span.msym` que o próprio handler acabou de desligar da árvore —, e o
// SEGUNDO caminho mira justamente a BORDA, que é o resto: ~37% de uma caixa de
// 34×34. O `click()` e o Enter têm o `<button>` por alvo sempre.
//
// TUDO POR LOCALIZADOR, nunca por coordenada calculada AQUI. A barra é refeita
// inteira por `renderLyricsView` (transpor meio tom é um dos alvos), e uma
// coordenada lida num `evaluate` e usada no seguinte é uma aposta na máquina:
// MEDIDO, sob carga o ponto chegava a cair na FOLHA, um bloco abaixo da barra.
// O `locator.click({ position })` re-resolve o elemento e só clica quando a
// caixa dele está ESTÁVEL entre dois quadros — é esperar pelo FATO, e o fato
// aqui é "o botão parou de se mexer".
async function acionar(caminho, i) {
  const loc = alvo(i);
  if (caminho === 'click()') { await loc.evaluate((b) => b.click()); return; }
  if (caminho === 'dedo na borda') {
    // A BORDA, e não o centro: é ali que o dedo acerta o `<button>` em vez do
    // `span.msym` de dentro — os 34,3% da caixa do rolar que o acidente do
    // `closest()` nunca cobriu. O `y` é relativo à caixa DELE.
    const cx = await loc.boundingBox();
    await loc.click({ position: { x: 2, y: Math.round(cx.height / 2) } });
    return;
  }
  await loc.focus();
  await pg.keyboard.press('Enter');
}

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  // O critério do watchdog do OTA: o `init()` é assíncrono e termina DEPOIS do
  // `load`, e é ele que LÊ o tamanho guardado e reescreve `lvTamanho`. Plantar
  // o cenário antes disso é correr contra a abertura, que o desfaz com razão.
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );

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
  const noMeio = await armar();
  checar(noMeio === 2,
    'a escada começa no MEIO (1,4rem): no piso o passo do defeito é um no-op e '
    + 'o token não anda — a versão defeituosa passaria calada', noMeio);

  // ========================================================================
  // BLOCO 1 — NO RETRATO, NENHUM BOTÃO DA BARRA MEXE NA ESCADA DO `:root`
  // ========================================================================
  //
  // REVERSÃO: devolver `'.lv-fonte-btn'` ao seletor do ouvinte delegado
  // (`controle.js`, o `document.addEventListener('click', …)`) reprova aqui —
  // MEDIDO, 1,4rem → 1,2rem em todos os alvos menos o `dedo no meio` do rolar.
  const alvos = await alvosVivos();
  checar(alvos.length >= 4,
    'a barra da cifra tem pelo menos QUATRO botões que vestem `.lv-fonte-btn` '
    + 'sem serem o par — é sobre eles que este arquivo fala', alvos);
  for (const caminho of ['click()', 'dedo na borda', 'teclado (Enter)']) {
    const mexeram = [];
    const mudos = [];
    // A ETIQUETA É REFEITA A CADA ALVO, e não uma vez por rodada: transpor meio
    // tom chama `renderLyricsView`, que REFAZ a barra inteira — os nós etiquetados
    // antes viram lixo, e o alvo seguinte seria procurado num documento onde ele
    // já não existe. O ÍNDICE é que atravessa: a ordem do `querySelectorAll` é a
    // do DOM, e a barra é remontada sempre na mesma.
    for (let i = 0; i < alvos.length; i++) {
      const nome = (await alvosVivos())[i];
      await armar();
      const antes = await lerFonte();
      const t0 = await testemunha();
      await acionar(caminho, i);
      const depois = await lerFonte();
      const t1 = await testemunha();
      if (depois.raiz !== antes.raiz) {
        mexeram.push(nome + ': ' + antes.raiz + ' → ' + depois.raiz);
      }
      if (t0 === t1) mudos.push(nome + ' (' + t0 + ')');
      // A ROLAGEM NÃO PODE FICAR LIGADA entre um alvo e o próximo: ela escreve
      // no `scrollTop` a cada quadro, e o alvo seguinte é medido com a folha
      // andando por baixo. (Não muda o que se afirma; muda o que se depura.)
      //
      // E A GAVETA DA VELOCIDADE TAMPOUCO (v1.7.4), e esta metade não é
      // cosmética: com ela aberta os botões da fila são `display: none`, e o
      // alvo seguinte não tem caixa — `boundingBox()` devolve `null` e o
      // caminho do dedo morre com um TypeError, não com uma reprovação.
      await pg.evaluate(() => {
        if (cifraRolando) cifraRolarParar();
        if (lyricsCifraCtlEl.classList.contains('escolhendo')) cifraVelFilaAlternar();
      });
    }
    checar(mudos.length === 0,
      'no caminho "' + caminho + '" todos os botões da barra de fato AGIRAM — '
      + 'sem isto a asserção de ausência abaixo passaria por ninguém ter '
      + 'acionado nada', mudos);
    checar(mexeram.length === 0,
      'e NENHUM deles mexeu no tamanho da letra por "' + caminho + '": só o par '
      + 'A+/A− escreve nessa escada', mexeram);
  }

  // ========================================================================
  // BLOCO 1-B — E OS BOTÕES DA GAVETA DA VELOCIDADE (v1.7.4)
  // ========================================================================
  //
  // Eles são `.lv-fonte-btn` como os outros — é a PINTURA de um passo numa
  // escada, e é exatamente a classe que o ouvinte delegado casava —, então a
  // propriedade deste arquivo vale para eles: *só o par A+/A− escreve na escada
  // da fonte*. O que os separa do laço acima é serem ESCONDIDOS até alguém
  // abrir a gaveta; aqui ela é aberta antes de cada toque.
  //
  // Os TRÊS caminhos, como lá — e o motivo de não bastar o `click()` é o mesmo:
  // o acidente que poupava um botão era o alvo do evento, e ele muda conforme o
  // dedo cai no `<button>` ou no que estiver dentro dele.
  const SEL_OP = '#lyricsPopup .lv-cifra-vel-op';
  const abrirGaveta = () => pg.evaluate(() => {
    if (!lyricsCifraCtlEl.classList.contains('escolhendo')) cifraVelFilaAlternar();
    return lyricsCifraCtlEl.querySelectorAll('.lv-cifra-vel-op').length;
  });
  const quantasOps = await abrirGaveta();
  checar(quantasOps >= 2,
    'a gaveta da velocidade tem botões a vigiar — eles vestem `.lv-fonte-btn`, '
    + 'que é a classe pela qual o defeito passava', quantasOps);
  for (const caminho of ['click()', 'dedo na borda', 'teclado (Enter)']) {
    const mexeram = [];
    for (let i = 0; i < quantasOps; i++) {
      await armar();
      // `armar()` remede a folha, o que REFAZ a fila — a gaveta fecha junto.
      // Reabri-la aqui é parte do cenário, e por isso vem ANTES da leitura.
      await abrirGaveta();
      const antes = await lerFonte();
      const loc = pg.locator(SEL_OP).nth(i);
      const nome = await loc.evaluate((b) => b.textContent.trim());
      if (caminho === 'click()') await loc.evaluate((b) => b.click());
      else if (caminho === 'dedo na borda') {
        const cx = await loc.boundingBox();
        await loc.click({ position: { x: 2, y: Math.round(cx.height / 2) } });
      } else { await loc.focus(); await pg.keyboard.press('Enter'); }
      const depois = await lerFonte();
      if (depois.raiz !== antes.raiz) {
        mexeram.push(nome + ': ' + antes.raiz + ' → ' + depois.raiz);
      }
      await pg.evaluate(() => { if (cifraRolando) cifraRolarParar(); });
    }
    checar(mexeram.length === 0,
      'e nenhum botão da GAVETA da velocidade mexe na escada da fonte por "'
      + caminho + '" — eles vestem a mesma classe do par, e é por ela que o '
      + 'defeito passava', mexeram);
  }
  await pg.evaluate(() => {
    if (lyricsCifraCtlEl.classList.contains('escolhendo')) cifraVelFilaAlternar();
    cifraAdotarVelocidade('auto');
    cifraPintarRolar();
  });

  // ========================================================================
  // BLOCO 2 — EM TELA CHEIA, NEM NA ESCADA DELA NEM NO QUE ELA GRAVA
  // ========================================================================
  //
  // É a metade CARA do defeito: ali o passo cai em `passoTamanhoDaCheia`, que
  // PERSISTE (`cifraFonteCheia`). Quem tocasse na velocidade dentro do modo de
  // ler de longe saía dele com a fonte menor — e voltava assim na sessão
  // seguinte, sem nada na tela dizendo por quê.
  const raizAntesDeEntrar = (await lerFonte()).raiz;
  await pg.click('#cifraCheiaBtn');
  // ESPERA PELO ESTADO DO APP, nunca por `document.fullscreenElement`: MEDIDO,
  // o Chromium PUBLICA a propriedade antes de despachar o `fullscreenchange`,
  // e é o evento que semeia `cifraCheiaIdx` e escreve o token escopado. Quem
  // perguntasse à propriedade mediria a janela entre as duas coisas — e o que
  // sai de lá é `idxCheia: -1` com o `escopado` vazio, isto é, o oráculo
  // reprovando um app que está certo e ainda não terminou.
  await pg.waitForFunction(
    () => cifraCheia === true && cifraCheiaIdx >= 0
      && lyricsPopupEl.style.getPropertyValue('--lv-fonte') !== '',
    null, { timeout: 10000 },
  );
  await pg.setViewportSize({ width: 800, height: 390 });
  const naCheia = await lerFonte();
  // O ⛶ VESTE `.lv-cheia-btn` E SÓ ELA: dar-lhe `.lv-fonte-btn` "para
  // uniformizar a fila" o transformaria no quinto ofensor — e no pior deles, o
  // botão que ENTRA e SAI do modo. MEDIDO: o desenho é o mesmo sem a classe.
  const saidaLimpa = await pg.evaluate(() => {
    const b = lyricsPopupEl.querySelector('#cifraCheiaBtn');
    return { classes: b.className, dupla: b.matches('.lv-fonte-menos, .lv-fonte-mais') };
  });
  checar(naCheia.raiz === raizAntesDeEntrar && !saidaLimpa.dupla,
    'entrar na tela cheia pelo ⛶ não encosta na escada do retrato — ele não é '
    + 'um passo numa escada e não veste as classes do par',
    { antes: raizAntesDeEntrar, depois: naCheia.raiz, saida: saidaLimpa });
  checar(naCheia.idxCheia >= 0 && naCheia.escopado !== '',
    'e a escada DA TELA CHEIA está no ar (é ela que os alvos abaixo não podem '
    + 'mover)', naCheia);

  for (const caminho of ['click()', 'dedo na borda', 'teclado (Enter)']) {
    const mexeram = [];
    const mudos = [];
    for (let i = 0; i < alvos.length; i++) {
      const nome = (await alvosVivos())[i];
      await armar();
      const antes = await lerFonte();
      const t0 = await testemunha();
      await acionar(caminho, i);
      const depois = await lerFonte();
      const t1 = await testemunha();
      if (depois.escopado !== antes.escopado || depois.idxCheia !== antes.idxCheia) {
        mexeram.push(nome + ': ' + antes.escopado + '/' + antes.idxCheia
          + ' → ' + depois.escopado + '/' + depois.idxCheia);
      }
      if (t0 === t1) mudos.push(nome + ' (' + t0 + ')');
      // A MESMA LIMPEZA do bloco 1, e pelas mesmas duas razões — ver lá.
      await pg.evaluate(() => {
        if (cifraRolando) cifraRolarParar();
        if (lyricsCifraCtlEl.classList.contains('escolhendo')) cifraVelFilaAlternar();
      });
    }
    checar(mudos.length === 0,
      'na tela cheia, no caminho "' + caminho + '", todos os botões da coluna '
      + 'de fato AGIRAM', mudos);
    checar(mexeram.length === 0,
      'e NENHUM deles mexeu na escada da tela cheia por "' + caminho + '" — a '
      + 'que é GRAVADA, no modo cujo objetivo é ler de longe', mexeram);
  }
  const banco = await pg.evaluate(async () => ({
    gravado: await AVDB.getState('cifraFonteCheia'),
    noAr: LV_TAMANHOS[cifraCheiaIdx],
  }));
  checar(banco.gravado === undefined || banco.gravado === null
    || banco.gravado === banco.noAr,
    'e o que está no banco continua sendo o degrau que está no ar — nenhum '
    + 'toque na barra gravou uma fonte menor por baixo', banco);

  // ========================================================================
  // BLOCO 3 — A REVERSÃO: O PAR CONTINUA ANDANDO, NAS DUAS ESCADAS
  // ========================================================================
  //
  // Sem ela, APAGAR o ouvinte delegado passa nos dois blocos acima. Ela mede a
  // escada da tela cheia (que está no ar agora) e, logo abaixo, a do retrato.
  const parNaCheia = await pg.evaluate(async () => {
    const r = { antes: cifraCheiaIdx };
    lyricsPopupEl.querySelector('.lv-fonte-menos').click();
    await new Promise((x) => setTimeout(x, 150));
    r.aposMenos = cifraCheiaIdx;
    lyricsPopupEl.querySelector('.lv-fonte-mais').click();
    await new Promise((x) => setTimeout(x, 150));
    r.aposMais = cifraCheiaIdx;
    return r;
  });
  checar(parNaCheia.aposMenos === parNaCheia.antes - 1
    && parNaCheia.aposMais === parNaCheia.antes,
    'e o par A+/A− CONTINUA andando na escada da tela cheia — um degrau por '
    + 'toque, para os dois lados', parNaCheia);

  await pg.evaluate(() => cifraCheiaSair());
  // O ESPELHO da espera de cima, pela mesma razão: a saída é um
  // `removeProperty` feito no `fullscreenchange`, não na chamada.
  await pg.waitForFunction(
    () => cifraCheia === false && lyricsPopupEl.style.getPropertyValue('--lv-fonte') === '',
    null, { timeout: 10000 },
  );
  await pg.setViewportSize({ width: 430, height: 900 });
  await pg.waitForSelector('.lv-cifra-acordes', { timeout: 15000 });

  // AS DUAS CASAS, e não só a folha: o ouvinte é UM, delegado no documento e
  // casado por CLASSE — a segunda casa (a linha do nome do Modo Fácil) é o
  // motivo de ele ser delegado, e um seletor por id a deixaria de fora. A
  // GEOMETRIA daquela casa é assunto do `modo-facil-fonte.test.mjs`; o que se
  // afirma aqui é que o ouvinte a alcança.
  const duasCasas = await pg.evaluate(async () => {
    const ler = () => document.documentElement.style.getPropertyValue('--lv-fonte').trim();
    const casas = [...document.querySelectorAll('.lv-fonte-ctl')];
    const r = { casas: casas.length, passos: [] };
    for (const casa of casas) {
      const antes = ler();
      casa.querySelector('.lv-fonte-menos').click();
      await new Promise((x) => setTimeout(x, 120));
      const meio = ler();
      casa.querySelector('.lv-fonte-mais').click();
      await new Promise((x) => setTimeout(x, 120));
      r.passos.push({ antes, meio, depois: ler(), naFolha: !!casa.closest('#lyricsPopup') });
    }
    return r;
  });
  checar(duasCasas.casas === 2
    && duasCasas.passos.every((p) => p.meio !== p.antes && p.depois === p.antes),
    'e o par anda nas DUAS casas — a folha de leitura e a linha do nome do Modo '
    + 'Fácil: o ouvinte é delegado por CLASSE, e é essa segunda casa a razão '
    + 'de ele ser delegado', duasCasas);

  // ========================================================================
  // BLOCO 4 — A PROPRIEDADE, E NÃO A LISTA DE QUATRO
  // ========================================================================
  //
  // Um `.lv-fonte-btn` que ainda não existe: é ele que diz que o conjunto do
  // ouvinte é FECHADO, e não que os quatro de hoje foram nomeados um a um.
  //
  // AQUI NÃO HÁ EFEITO LEGÍTIMO para esperar — o botão não faz nada —, e por
  // isso a ausência vira CONTAGEM POSITIVA: clica-se ele e DEPOIS o A−, e a
  // escada tem de ter andado EXATAMENTE UM degrau. Com o defeito andaria dois,
  // e um teste de "mudou?" aprovaria os dois casos.
  const descartavel = await pg.evaluate(async () => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lv-fonte-btn';
    b.textContent = 'X';
    lyricsPopupEl.querySelector('.lv-cifra-ctl').appendChild(b);
    const idx = () => LV_TAMANHOS.indexOf(lvTamanho);
    const antes = idx();
    b.click();
    await new Promise((x) => setTimeout(x, 120));
    const soDele = idx();
    lyricsPopupEl.querySelector('.lv-fonte-menos').click();
    await new Promise((x) => setTimeout(x, 120));
    const comOPar = idx();
    b.remove();
    return { antes, soDele, comOPar };
  });
  checar(descartavel.soDele === descartavel.antes,
    'um `.lv-fonte-btn` CRIADO AGORA, que o ouvinte nunca viu, não mexe na '
    + 'escada — o conjunto dele é fechado por construção, não por uma lista de '
    + 'quatro nomes', descartavel);
  checar(descartavel.comOPar === descartavel.antes - 1,
    'e o A− logo depois anda EXATAMENTE UM degrau: é a contagem que separa '
    + '"ninguém mexeu" de "mexeram dois" — um teste de "mudou?" aprovaria os '
    + 'dois', descartavel);

  checar(erros.length === 0, 'nenhum erro de console', erros);
} finally {
  await navegador.close();
  servidor.close();
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
