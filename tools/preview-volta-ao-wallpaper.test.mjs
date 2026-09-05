// A PREVIEW VOLTA AO WALLPAPER QUANDO A MÍDIA ACABA — COM TELÃO NO AR.
//
// Relato do operador (v1.7.3): *"ao encerrar o tempo de uma música, a imagem no
// telão se encerra normalmente, e volta para o wallpaper, mas na preview, ele
// está parando em uma tela preta e não volta para o wallpaper. (Testado em modo
// de espelhamento de tela direto para tv, não por conexão de navegador)"*.
//
// ## O defeito que ele trava
//
// A preview NUNCA chegava a ouvir o `ended` do `<video>` dela. Com telão no ar
// ela é ILUSTRAÇÃO e segue o `display-status`:
//
//   1. o `<video>` do telão chega ao fim e dispara `pause` ANTES de `ended` —
//      é a ordem do HTML, e o `onTime` do `display.js` escuta os dois;
//   2. o `display-status` que sai do `pause` chega ao Controle com
//      `playing: false` e `currentTime === duration`;
//   3. `resyncPreviewToDisplay` traduz isso em `preview.seek(duration)` +
//      `preview.pause()` — no instante em que o `<video>` da preview estava a
//      milissegundos do fim dele;
//   4. um `<video>` PAUSADO não emite `ended`. Sem `ended`, o `computeCover()`
//      do `stage.js` responde `false` e a cortina do wallpaper nunca fecha.
//
// O que fica na tela é o quadro parado em `currentTime === duration`, onde não
// há quadro decodificável: PRETO. E é PERMANENTE — nada reavalia depois.
//
// SEM TV O CASO NÃO EXISTE, e é por isso que o relato nomeia o espelhamento: ali
// a preview É a projeção, ninguém a pausa, e o `ended` dela chega sozinho. É a
// armadilha que o `fundo-da-letra.test.mjs` já pagou uma vez — *ler cada lado
// isolado aprova os dois*.
//
// ## Por que ele mede TRÊS coisas, e nenhuma basta sozinha
//
//   1. **O `media-ended` do telão cobre a preview.** É o caminho EXATO, e o do
//      relato.
//   2. **O status PARADO NO FIM também cobre**, sem `media-ended` nenhum. É a
//      rede de segurança que cobre as TELAS DA REDE — lá o `media-ended` morre
//      no DRENO de propósito (N telas dariam N avanços de playlist), e sem TV a
//      tela da rede É a projeção. Sem esta metade o mesmo quadro preto volta por
//      uma porta que o operador não testou.
//   3. **Uma pausa NO MEIO não cobre.** É a REGRESSÃO que as duas metades acima
//      introduzem se a régua for só "não está tocando": o operador que pausa o
//      louvor para a oração veria a preview trocar a cena pelo wallpaper. Sem
//      esta terceira, "cobrir sempre que pausar" passaria nas duas primeiras.
//
//   node tools/preview-volta-ao-wallpaper.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

// Uma faixa de 4 s. CURTA de propósito: o cenário precisa levar o `<video>` da
// preview até perto do fim de verdade, e não fabricar um estado.
//
// `kind: 'video'` E NÃO `'audio'`, e isso é a regra do app e não conveniência:
// `semVisual()` faz `computeCover()` responder SEMPRE `true` para um áudio sem
// letra — o wallpaper já é o certo ali, e o defeito seria invisível. O relato
// nomeia a IMAGEM (*"a imagem no telão se encerra normalmente"*), que é o caso
// em que a cortina tem de FECHAR e não fechava. Os bytes são um WAV: o
// `<video>` o toca e reporta `duration` (é o `kind` que decide a cena, não o
// contêiner — a mesma regra que faz o telão manter o wallpaper num áudio).
const SEMEAR = `
  const wav = (secs) => {
    const sr = 8000, n = sr * secs;
    const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
    const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    wr(36, 'data'); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
    return new Blob([buf], { type: 'audio/wav' });
  };
  const id = 'faixa-curta';
  const caminho = 'folders/teste/' + id + '.wav';
  await AVDB.opfsWriteFile(caminho, wav(4));
  await AVDB.fileAdd({
    id, folder: 'teste', opfsPath: caminho, srcName: id,
    name: 'FAIXA CURTA', type: 'audio/wav', kind: 'video', size: 1, mtime: 1,
    thumb: null, blob: null, url: null, addedAt: 1, lyrics: null,
  });
  await AVDB.listAdd('imports', id);
`;

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);

try {
  const pg = await ctx.newPage();
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 20000 });
  await esperarCortina(pg);
  await pg.evaluate(new Function('return (async () => { setAppMode("full");' + SEMEAR + 'await load(); })()'));

  // O TELÃO DE MENTIRA fala pelo MESMO barramento que o de verdade — um
  // `BroadcastChannel` de outra janela (o iframe), como no `cena.test.mjs`.
  // Falar por `__AVBus`/`onCommand` daqui pularia justamente o caminho de
  // recepção que se quer exercitar.
  await pg.evaluate(() => {
    const f = document.createElement('iframe');
    f.style.display = 'none';
    document.body.appendChild(f);
    window.__telao = (m) => f.contentWindow.eval(
      'new BroadcastChannel("av-iasd").postMessage(' + JSON.stringify(m) + ')');
  });

  // A CORTINA É LIDA DO ELEMENTO, e não de `preview.shouldCover()`: a pergunta
  // é o que o operador VÊ. `shouldCover` é a regra; o `display` do `#pvWall` é
  // o desfecho dela, e é o desfecho que estava errado.
  const cortina = () => pg.evaluate(() => {
    const w = document.getElementById('pvWall');
    const v = document.getElementById('pvVideo');
    return {
      wallpaper: getComputedStyle(w).display,
      videoOculto: !!v.hidden,
      tempo: +(v.currentTime || 0).toFixed(2),
      duracao: +(v.duration || 0).toFixed(2),
    };
  });

  // A CORTINA FECHANDO é o FATO que os dois primeiros casos esperam.
  const esperarCortinaFechar = async (p) => {
    try {
      await p.waitForFunction(
        () => getComputedStyle(document.getElementById('pvWall')).display !== 'none',
        null, { timeout: 6000 });
    } catch (_) { /* o `checar` abaixo relata o estado real */ }
  };

  // Projeta e deixa o áudio andar até perto do fim, como num culto.
  const projetar = async () => {
    await pg.evaluate(async () => {
      await send('faixa-curta');
      await new Promise((f) => setTimeout(f, 400));
    });
    // Espera pelo FATO (a cortina abriu e há duração), nunca por um prazo fixo.
    await pg.waitForFunction(() => {
      const w = document.getElementById('pvWall');
      const v = document.getElementById('pvVideo');
      return getComputedStyle(w).display === 'none' && v.duration > 0;
    }, null, { timeout: 15000 });
  };

  // O TELÃO ASSUME A REFERÊNCIA: sem um `display-status` antes, `displayActive()`
  // é falso e o Controle nem trata a preview como ilustração — o cenário seria
  // o de SEM TV, que é justamente o que não reproduz o defeito.
  const telaoTocando = async () => pg.evaluate(async () => {
    window.__telao({ type: 'display-status', mediaId: 'faixa-curta', playing: true, currentTime: 1, duration: 4 });
    await new Promise((f) => setTimeout(f, 200));
  });

  // ---- 1 · O `media-ended` DO TELÃO COBRE A PREVIEW ---------------------
  await projetar();
  await telaoTocando();
  const antes1 = await cortina();
  await pg.evaluate(async () => {
    const d = document.getElementById('pvVideo').duration;
    // A ORDEM DO HTML, verbatim: `pause` (que vira o `display-status` que PAUSA
    // a preview) e só então `ended` (que vira o `media-ended`). Invertê-la
    // esconderia o defeito — é a pausa chegando PRIMEIRO que impede o `ended`
    // da preview de acontecer.
    window.__telao({ type: 'display-status', mediaId: 'faixa-curta', playing: false, currentTime: d, duration: d });
    await new Promise((f) => setTimeout(f, 120));
    window.__telao({ type: 'media-ended', mediaId: 'faixa-curta' });
  });
  // ESPERA PELO FATO. A cortina só fecha depois do fade de saída
  // (`createStage.FADE`, 600 ms) MAIS os 400 ms de carência que o `stage.js`
  // dá ao avanço de playlist para assumir a cena — um prazo fixo aqui mediria
  // o agendador, e o estouro sai como FRASE e não como veredito.
  const fim1 = await esperarCortinaFechar(pg).then(cortina);
  checar(antes1.wallpaper === 'none' && fim1.wallpaper !== 'none' && fim1.videoOculto,
    '1 · o `media-ended` do telão devolve a preview ao WALLPAPER: antes ela '
    + 'mostrava a mídia, depois a cortina cobre e o vídeo sai de cena — em vez '
    + 'do quadro preto de `currentTime === duration`',
    JSON.stringify({ antes: antes1, fim: fim1 }));

  // ---- 2 · O STATUS PARADO NO FIM COBRE SOZINHO ------------------------
  //
  // Sem `media-ended` nenhum. É o caso das TELAS DA REDE, onde ele morre no
  // dreno — e sem TV a tela da rede É a projeção.
  await pg.evaluate(() => stopClear());
  await pg.waitForFunction(() => getComputedStyle(document.getElementById('pvWall')).display !== 'none',
    null, { timeout: 10000 });
  await projetar();
  await telaoTocando();
  const antes2 = await cortina();
  await pg.evaluate(async () => {
    const d = document.getElementById('pvVideo').duration;
    window.__telao({ type: 'display-status', mediaId: 'faixa-curta', playing: false, currentTime: d, duration: d });
  });
  const fim2 = await esperarCortinaFechar(pg).then(cortina);
  checar(antes2.wallpaper === 'none' && fim2.wallpaper !== 'none',
    '2 · e o STATUS parado no fim cobre sozinho, sem `media-ended` — a rede de '
    + 'segurança das telas da rede, onde ele morre no dreno de propósito',
    JSON.stringify({ antes: antes2, fim: fim2 }));

  // ---- 3 · UMA PAUSA NO MEIO NÃO COBRE --------------------------------
  //
  // A REGRESSÃO que as duas metades acima introduzem se a régua for só "não
  // está tocando". O operador pausa o louvor para a oração o tempo todo, e a
  // preview trocar a cena pelo wallpaper ali seria um defeito maior que o
  // relatado — sem TV é a própria projeção que apagaria.
  await pg.evaluate(() => stopClear());
  await pg.waitForFunction(() => getComputedStyle(document.getElementById('pvWall')).display !== 'none',
    null, { timeout: 10000 });
  await projetar();
  await telaoTocando();
  await pg.evaluate(async () => {
    window.__telao({ type: 'display-status', mediaId: 'faixa-curta', playing: false, currentTime: 1.5, duration: 4 });
    await new Promise((f) => setTimeout(f, 900));
  });
  const fim3 = await cortina();
  checar(fim3.wallpaper === 'none',
    '3 · mas uma pausa NO MEIO não cobre nada: a cena pausada continua na tela. '
    + '"Cobrir sempre que pausar" passaria nos dois casos acima e apagaria o '
    + 'louvor pausado para a oração', JSON.stringify(fim3));
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\nFALHOU (' + falhas.length + '):');
  falhas.forEach((f) => console.log(' - ' + f));
  process.exit(1);
}
console.log('\nTodos passaram.');
