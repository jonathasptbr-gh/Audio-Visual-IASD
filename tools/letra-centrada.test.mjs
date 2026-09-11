#!/usr/bin/env node
// ============================================================================
// A LETRA É CENTRADA, E O DESTAQUE É SÓ A COR (v1.8.33)
//
// Pedido do operador, verbatim:
//
//   *"ajuste o modo de leitura da letra normal, não da cifra, tanto no modo
//   simples quanto no avançado. faça o texto ser centralizado horizontalmente,
//   remova o indicador de posição atual que temos de 'barra lateral' use apenas
//   a coloração do texto atual como indicador."*
//
// ## POR QUE ISTO PRECISA DE ORÁCULO
//
// As três metades falham CALADAS, e em direções diferentes — nenhuma produz
// erro, console sujo ou tela quebrada:
//
//  - **A CENTRALIZAÇÃO** é `text-align` mais a AUSÊNCIA do recuo que a barra
//    reservava. Só o `text-align` deixa o texto 8,8px fora do centro (metade do
//    `padding-left` de .55rem), o que ninguém relata e ninguém explica — a régua
//    aqui é o TEXTO PINTADO por `Range`, nunca a caixa do `<div>`, que ocupa a
//    linha inteira e mede o mesmo centrado ou não.
//  - **A BARRA REMOVIDA** é uma asserção NEGATIVA, e sozinha ela aprova quem
//    apagar a barra do app INTEIRO — inclusive da Bíblia, que o pedido não
//    menciona e onde ela responde outra pergunta (*"onde eu estou?"*, num
//    capítulo de linhas parecidas).
//  - **AS DUAS CASAS.** O construtor é UM (`lvBuildSong`), chamado pela folha do
//    avançado e pela zona do Modo Fácil. Medir uma só aprova uma regra escopada
//    ao host errado, e o pedido nomeia as duas.
//
// E A COR TEM ASSERÇÃO PRÓPRIA: tirar a barra sem deixar o destaque é o defeito
// de MENOS — a linha em cena deixaria de se distinguir das vizinhas, que é
// justamente o que o operador pediu para manter.
//
//   node tools/letra-centrada.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

const PONTE = `(() => {
  const FOLHA = '<pre><b>C</b>      <b>G</b>\\nprimeira linha da cifra\\n'
    + '<b>Am</b>     <b>F</b>\\nsegunda linha da cifra</pre>';
  const B = {
    shellVersion: () => 60, role: () => 'controle', appVersion: () => '1.99-teste',
    takeShare: () => '', busPost: () => {}, otaConfirm: () => {},
    cifraHtml: (id, url) => {
      const nada = String(url || '').includes('sem-cifra');
      setTimeout(() => {
        try {
          window.__avResolve(id, nada ? { status: 404, html: '' }
            : { status: 200, html: FOLHA });
        } catch (_) {}
      }, 0);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal',
    'castTarget','cifraDiag','deckDiscard','deckExportUrl','deckPages','displays',
    'espelhoCertApagar','espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag',
    'espelhoEstado','espelhoLigar','espelhoLigarEm','espelhoDerrubar','farolEstado',
    'keepAlive','listFolder','micDiag','nowPlaying','openCast','openExternal','otaApply','otaCheck',
    'otaDiag','otaPending','pickDoc','pickFolder','requestMic','salvarTexto','systemVolume',
    'temaClaro','ytCancel','ytCanalPlaylists','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio',
    'ytStream','ytPlaylist','ytSearch','ytDiag','areaTransferencia','atualizacaoEstado',
  ];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...a) => {
      const id = a[0];
      if (typeof id === 'string') setTimeout(() => { try { window.__avResolve(id, null); } catch (_) {} }, 0);
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)),
  '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = 'http://localhost:' + servidor.address().port;

try {
  pg.on('pageerror', (e) => falhas.push('pageerror: ' + e.message));
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && (!!document.querySelector('#playlist li') || document.getElementById('plBtn').disabled),
    null, { timeout: 30000 },
  );

  // A RÉGUA, uma só para os dois hosts: duas contas do mesmo número divergiriam
  // no primeiro ajuste, e o que se compara aqui é justamente uma casa contra a
  // outra.
  //
  // O TEXTO PINTADO, por `Range`. A caixa do `<div>` da linha é `stretch` e
  // ocupa a largura toda — ela mede o MESMO centrado ou não, e uma asserção
  // sobre ela passaria nas duas versões.
  await pg.evaluate(() => {
    window.__medir = (host) => {
      const el = document.querySelector(host);
      if (!el) return null;
      const caixa = el.getBoundingClientRect();
      const linhas = [...el.querySelectorAll('.lv-row')].map((r) => {
        const cs = getComputedStyle(r);
        const alvo = r.querySelector('.lv-text') || r;
        const no = [...alvo.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
        let texto = null;
        if (no) {
          const rg = document.createRange();
          rg.selectNodeContents(no);
          const b = rg.getBoundingClientRect();
          if (b.width > 0) texto = +(b.x + b.width / 2).toFixed(1);
        }
        return {
          classe: r.className,
          align: cs.textAlign,
          padLeft: +parseFloat(cs.paddingLeft).toFixed(1),
          // TRÊS estados, e não dois: a barra do versículo nasce TRANSPARENTE
          // (é ela que o `padding-left` reserva) e só ganha cor no `.current`.
          // Um booleano "tem fundo" não separa *reservada* de *pintada*, e é
          // essa distinção que a Bíblia precisa manter e a letra precisa perder.
          barra: cs.backgroundImage === 'none' ? 'nao'
            : (/(rgba?\([^)]*\))\s+0px/.exec(cs.backgroundImage) || [])[1] === 'rgba(0, 0, 0, 0)'
              ? 'reservada' : 'pintada',
          cor: cs.color,
          textoMeio: texto,
        };
      });
      return { hostMeio: +(caixa.x + caixa.width / 2).toFixed(1), linhas };
    };
    window.__accent = () => {
      const p = document.createElement('span');
      p.style.color = 'var(--accent)';
      document.body.appendChild(p);
      const c = getComputedStyle(p).color;
      p.remove();
      return c;
    };
  });

  const LETRA = () => ({
    id: 'm', name: 'Louvor Em Cena', kind: 'audio', seconds: 200,
    lyrics: [{ cover: true }, { text: 'primeira estrofe curta' },
      { text: 'segunda estrofe', auxText: 'Estrofe 2' }],
  });

  // ── 1. O AVANÇADO ─────────────────────────────────────────────────────────
  const avancado = await pg.evaluate((item) => {
    setAppMode('full');
    currentItem = item; currentId = item.id; bibleSession = null;
    lvSource = 'lyrics';
    closeLyricsPopup(); openLyricsPopup();
    lvMarkCurrent(lyricsViewBodyEl, 1);
    return window.__medir('#lyricsViewBody');
  }, LETRA());
  const soLetra = (m) => m.linhas.filter((l) => l.classe.includes('lv-row--letra'));

  checar(soLetra(avancado).length === 3,
    'a folha do AVANÇADO desenhou as três linhas de letra, e elas carregam o '
    + 'modificador `lv-row--letra` — é ele que separa a letra do versículo e da '
    + 'página, que continuam com o desenho delas',
    avancado.linhas.map((l) => l.classe));
  // AS CONTAGENS SÃO POSITIVAS, e isso não é estilo: com um filtro por classe,
  // uma lista VAZIA satisfaz toda asserção de ausência — e ela fica vazia
  // exatamente na versão SEM o modificador, que é a que este arquivo existe
  // para reprovar. `=== 3` exige que as três tenham sido medidas E aprovadas.
  const centradas = soLetra(avancado)
    .filter((l) => l.textoMeio !== null && Math.abs(l.textoMeio - avancado.hostMeio) <= 0.6);
  checar(centradas.length === 3,
    'e o TEXTO PINTADO das três está no centro da caixa (±0,6px) — a régua é o '
    + '`Range` e não o `<div>`, que ocupa a linha inteira e mede o mesmo dos '
    + 'dois jeitos', { hostMeio: avancado.hostMeio, linhas: soLetra(avancado) });
  checar(soLetra(avancado).filter((l) => l.padLeft < 0.1).length === 3,
    '  ↳ e nenhuma reserva o recuo da barra: com ele o texto fica 8,8px fora do '
    + 'centro, que é metade do pedido feita pela metade',
    soLetra(avancado).map((l) => l.padLeft));
  checar(soLetra(avancado).filter((l) => l.barra === 'nao').length === 3,
    'e NENHUMA linha de letra tem barra — nem PINTADA na que está no ar, nem '
    + 'RESERVADA nas outras: é a reserva que tirava o texto do centro',
    soLetra(avancado).map((l) => l.barra));

  // ── 2. O DESTAQUE QUE FICA ────────────────────────────────────────────────
  // Sem esta, tirar a barra E o acento passaria nas asserções acima: a linha em
  // cena deixaria de se distinguir, que é o oposto do pedido.
  const accent = await pg.evaluate(() => window.__accent());
  const naCena = soLetra(avancado).find((l) => l.classe.includes('current'));
  const vizinhas = soLetra(avancado).filter((l) => !l.classe.includes('current'));
  checar(!!naCena && naCena.cor === accent,
    'a linha NO AR fica na cor de acento — é ela o indicador agora, e é o que o '
    + 'pedido manda manter', { naCena, accent });
  checar(vizinhas.every((l) => l.cor !== accent),
    '  ↳ e as vizinhas NÃO: sem esta metade, pintar tudo de acento passaria na '
    + 'de cima e o destaque deixaria de destacar', vizinhas.map((l) => l.cor));

  // ── 3. A SEGUNDA CASA: O MODO FÁCIL ───────────────────────────────────────
  // O construtor é UM (`lvBuildSong`), e é isso que faz o pedido valer nos dois
  // modos de graça. Medir só o avançado aprovaria uma regra escopada ao
  // `#lyricsPopup`, que deixaria a zona do Modo Fácil como estava.
  const simples = await pg.evaluate((item) => {
    closeLyricsPopup();
    currentItem = item; currentId = item.id; bibleSession = null;
    setAppMode('simple');
    setTocarNoCelular(true);
    renderSimple();
    lvMarkCurrent(simpleLyricsEl, 1);
    return window.__medir('#simpleLyrics');
  }, LETRA());
  checar(soLetra(simples).length === 3,
    'a zona do MODO FÁCIL desenhou as mesmas três linhas', simples.linhas.length);
  const simplesOk = soLetra(simples).filter((l) => l.barra === 'nao'
    && l.textoMeio !== null && Math.abs(l.textoMeio - simples.hostMeio) <= 0.6);
  checar(simplesOk.length === 3,
    'e ali a letra também está CENTRADA e SEM barra — o pedido nomeia os dois '
    + 'modos, e um construtor só é o que faz isso valer para os dois',
    { hostMeio: simples.hostMeio, linhas: soLetra(simples) });

  // ── 4. A BÍBLIA NÃO SE MEXEU ──────────────────────────────────────────────
  // A METADE QUE IMPEDE O CONSERTO LARGO DEMAIS. A barra saiu da classe BASE e
  // desceu para o `.lv-row--verse`, que é quem a usa: num capítulo de linhas
  // parecidas ela responde *"onde eu estou?"*, que é outra pergunta da que a
  // letra faz. Apagá-la do app inteiro passaria em tudo acima.
  const biblia = await pg.evaluate(() => {
    setAppMode('full');
    closeLyricsPopup();
    currentItem = null; currentId = null;
    bibleSession = {
      versionId: 'nvi', bookIdx: 18, bookId: 'sal', bookName: 'Salmos', chapter: 23,
      projecting: true, idx: 1,
      verses: [{ n: 1, text: 'O Senhor é o meu pastor' },
        { n: 2, text: 'Deitar-me faz em verdes pastos' }],
    };
    lvSource = 'bible';
    openLyricsPopup();
    lvMarkCurrent(lyricsViewBodyEl, 1);
    return window.__medir('#lyricsViewBody');
  });
  const versos = biblia.linhas.filter((l) => l.classe.includes('lv-row--verse'));
  const versoNoAr = versos.find((l) => l.classe.includes('current'));
  checar(versos.length === 2 && versos.every((l) => l.padLeft > 0.1)
    && !!versoNoAr && versoNoAr.barra === 'pintada'
    && versos.filter((l) => l.barra === 'reservada').length === 1,
    'a BÍBLIA continua com a barra: PINTADA no versículo no ar, RESERVADA no '
    + 'outro, e o recuo que a reserva nos dois. Ela é do versículo agora, e o '
    + 'pedido não a menciona', versos);
  checar(versos.every((l) => l.align !== 'center'),
    '  ↳ e o versículo NÃO foi centrado junto — o número entra na linha do '
    + 'texto como numa Bíblia impressa, e centrar quebraria essa leitura',
    versos.map((l) => l.align));

  // ── 5. A APRESENTAÇÃO NÃO SE MEXEU ────────────────────────────────────────
  // O outro vizinho. A `.lv-row--slide` DESFAZIA o recuo da base (`padding-left:
  // 0`), e com a base deixando de o ter aquela linha saiu por redundante —
  // MEDIDO idêntico antes e depois. A asserção é a GEOMETRIA, não a declaração:
  // a miniatura começa onde a linha começa, que é o que aquele `0` protegia.
  const deck = await pg.evaluate(async () => {
    const pages = [];
    for (let i = 0; i < 3; i++) {
      const cv = document.createElement('canvas');
      cv.width = 160; cv.height = 90;
      const c = cv.getContext('2d');
      c.fillStyle = 'hsl(' + (i * 60) + ',60%,60%)';
      c.fillRect(0, 0, 160, 90);
      pages.push(await new Promise((r) => cv.toBlob(r, 'image/png')));
    }
    closeLyricsPopup();
    bibleSession = null;
    currentItem = { id: 'ap', name: 'Semana', kind: 'deck', pages };
    currentId = 'ap'; deckPagina = 1; lvSource = 'deck';
    renderSlideNav();
    openLyricsPopup();
    await new Promise((r) => setTimeout(r, 150));
    return [...document.querySelectorAll('#lyricsViewBody .lv-row--slide')].map((r) => {
      const b = r.getBoundingClientRect();
      const img = r.querySelector('.lv-slide');
      const ib = img && img.getBoundingClientRect();
      return {
        recuo: +(ib ? ib.x - b.x : -1).toFixed(1),
        barra: getComputedStyle(r).backgroundImage === 'none' ? 'nao' : 'ha',
      };
    });
  });
  checar(deck.length === 3 && deck.every((d) => Math.abs(d.recuo) < 0.6),
    'e a APRESENTAÇÃO continua com a miniatura na borda da linha — o '
    + '`padding-left: 0` dela saiu por não ter mais o que desfazer, e o que ele '
    + 'protegia é isto', deck);
  checar(deck.length === 3 && deck.every((d) => d.barra === 'nao'),
    '  ↳ e nenhuma página tem barra, nem reservada: quem marca a que está no ar '
    + 'é o SELO', deck);
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
