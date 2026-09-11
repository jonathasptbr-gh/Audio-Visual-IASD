// A PREVIEW VOLTA AO WALLPAPER QUANDO A MÍDIA ACABA — COM TELÃO NO AR.
//
// Relato do operador (v1.7.7): *"ao encerrar o tempo de uma música, a imagem no
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

  // ---- 4 · SEM TV, O STATUS DE UMA TELA DA REDE AVANÇA A PLAYLIST -------
  //
  // O `media-ended` é o caminho EXATO do avanço, e ele NÃO CHEGA de uma tela da
  // rede: o dreno do papel `tela` é lista de PERMISSÃO de dois tipos, e o
  // `media-ended` morre ali de propósito (N telas dariam N avanços). Sem TV a
  // tela da rede É a projeção — e o `onEnded` da PREVIEW não cobre o buraco por
  // dois motivos independentes: ele volta cedo em `displayActive()`, que o
  // `tela-status` mantém aceso, e o `<video>` dela nem chega a emitir `ended`,
  // porque o ramo de `FIM_DA_PROJECAO_S` (o bloco 2 acima) o PAUSA e REBOBINA.
  //
  // O DESFECHO É O CULTO PARANDO: a playlist não anda, a linha fica presa em
  // "● No ar" sobre um telão que já voltou ao wallpaper, e nada erra. Só numa
  // igreja SEM TV — que é a armadilha do *"ler cada lado isolado aprova os
  // dois"*, e a razão de este bloco existir ao lado dos três de cima.
  //
  // A SEGUNDA METADE É A QUE IMPEDE O CONSERTO LARGO DEMAIS, e ela já está
  // escrita: o bloco 2 manda um `display-status` parado no fim e o bloco 1
  // manda o `media-ended`. Se o avanço saísse também do `display-status`, o
  // caminho com TV avançaria DUAS vezes e a playlist pularia uma faixa — por
  // isso a asserção de baixo mede o `currentId` DEPOIS do bloco 2, onde ele tem
  // de estar parado.
  await pg.evaluate(() => stopClear());
  await pg.evaluate(async () => {
    await AVDB.fileAdd({
      id: 'faixa-2', folder: 'teste', opfsPath: 'folders/teste/faixa-curta.wav',
      srcName: 'faixa-2', name: 'SEGUNDA FAIXA', type: 'audio/wav', kind: 'video',
      size: 1, mtime: 1, thumb: null, blob: null, url: null, addedAt: 1, lyrics: null,
    });
    await AVDB.listSet('playlist', ['faixa-curta', 'faixa-2']);
    // `all` EXPLÍCITO, e desde a v1.8.77 ele não é mais o que faz a fila andar:
    // o `off` padrão também avança (o que muda é o FIM da fila, que nele acaba
    // a cena em vez de dar a volta). A linha fica porque este bloco mede o
    // GATILHO — que o status parado de uma tela da rede avança a playlist —, e
    // o modo que não depende da posição na fila é o que mantém a asserção sobre
    // o gatilho e não sobre a borda.
    await AVDB.setState('repeat', 'all');
    await load();
  });
  await projetar();
  // SEM TV: o relógio do telão é zerado à mão porque os blocos de cima o
  // acenderam. `telaoAtivo()` falso é o que faz o `espelho-status` ser a
  // referência — com ele aceso, o handler devolve na primeira linha.
  await pg.evaluate(async () => {
    telaoStatusAt = 0;
    window.__telao({ type: 'espelho-status', mediaId: 'faixa-curta', playing: true, currentTime: 1, duration: 4 });
    await new Promise((f) => setTimeout(f, 200));
  });
  const antes4 = await pg.evaluate(() => currentId);
  await pg.evaluate(async () => {
    telaoStatusAt = 0;
    const d = document.getElementById('pvVideo').duration || 4;
    window.__telao({ type: 'espelho-status', mediaId: 'faixa-curta', playing: false, currentTime: d, duration: d });
    window.__telao({ type: 'espelho-status', mediaId: 'faixa-curta', playing: false, currentTime: d, duration: d });
  });
  // O PRAZO É CURTO DE PROPÓSITO, e sem isso o bloco era uma TAUTOLOGIA — MEDIDO
  // na escrita: com 8 s, a reversão PASSAVA. A preview está em ~0,4 s de uma
  // faixa de 4 s e continua andando em tempo real; passados 2,5 s sem status
  // (`DISPLAY_TIMEOUT`) o `displayActive()` cai, o `<video>` dela chega ao fim
  // sozinho e o `onEnded` DELA avança a playlist — pelo caminho que existe SEM
  // tela nenhuma. A janela tem de fechar antes disso: com a rede de segurança o
  // avanço é síncrono com o status; sem ela, não há avanço nenhum aqui dentro.
  try {
    await pg.waitForFunction(() => currentId === 'faixa-2', null, { timeout: 1200 });
  } catch (_) { /* o `checar` abaixo relata o estado real */ }
  const depois4 = await pg.evaluate(() => currentId);
  checar(antes4 === 'faixa-curta' && depois4 === 'faixa-2',
    '4 · sem TV, o status parado no fim de uma TELA DA REDE avança a playlist — '
    + 'o `media-ended` morre no dreno, e sem esta rede de segurança o culto para '
    + 'em cada faixa', 'antes: ' + antes4 + ' · depois: ' + depois4);


  // ---- 5 · COM TV, O AVANÇO CONTINUA SENDO **UM** ----------------------
  //
  // A metade que impede o conserto largo demais, e ela precisa de TRÊS faixas:
  // com duas, avançar uma vez e avançar duas dão o MESMO item, e a asserção não
  // distingue nada.
  //
  // O QUE ELE PROVA, DITO: que o caminho com TV continua entregando UM avanço,
  // com a rede de segurança no lugar. Ele NÃO reprova a remoção da guarda
  // `!doTelao` — MEDIDO: sem ela sai um avanço a mais, mas `send` zera
  // `fimJaTratado` e o `media-ended` que vem atrás é recusado pela guarda de
  // `mediaId` dele (o id que terminou já não é o `currentId`), então o desfecho
  // volta a ser um. A guarda fica porque com TV o sinal EXATO é o `media-ended`
  // e esta é só a rede para a ausência dele — e porque com `repeat: 'one'` os
  // dois passam a casar de novo. Isto está escrito para ninguém apagá-la
  // achando que o verde daqui a cobre.
  await pg.evaluate(async () => {
    await AVDB.fileAdd({
      id: 'faixa-3', folder: 'teste', opfsPath: 'folders/teste/faixa-curta.wav',
      srcName: 'faixa-3', name: 'TERCEIRA FAIXA', type: 'audio/wav', kind: 'video',
      size: 1, mtime: 1, thumb: null, blob: null, url: null, addedAt: 1, lyrics: null,
    });
    await AVDB.listSet('playlist', ['faixa-curta', 'faixa-2', 'faixa-3']);
    await load();
    await send('faixa-2');
    await new Promise((f) => setTimeout(f, 400));
  });
  await pg.evaluate(async () => {
    const d = 4;
    // O TELÃO NO AR: é o `display-status` que acende `telaoStatusAt`, e é ele
    // que faz `doTelao` verdadeiro no handler.
    window.__telao({ type: 'display-status', mediaId: 'faixa-2', playing: true, currentTime: 1, duration: d });
    await new Promise((f) => setTimeout(f, 100));
    window.__telao({ type: 'display-status', mediaId: 'faixa-2', playing: false, currentTime: d, duration: d });
    window.__telao({ type: 'display-status', mediaId: 'faixa-2', playing: false, currentTime: d, duration: d });
    await new Promise((f) => setTimeout(f, 150));
    window.__telao({ type: 'media-ended', mediaId: 'faixa-2' });
  });
  try {
    await pg.waitForFunction(() => currentId === 'faixa-3', null, { timeout: 1200 });
  } catch (_) { /* o `checar` abaixo relata o estado real */ }
  const depois5 = await pg.evaluate(() => currentId);
  checar(depois5 === 'faixa-3',
    '5 · e com TV o avanço continua sendo UM: o `display-status` parado no fim '
    + 'não avança por conta própria — quem avança é o `media-ended`, e dois '
    + 'avanços pulariam uma faixa', 'currentId: ' + depois5);

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
