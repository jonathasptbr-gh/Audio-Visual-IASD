// A METADE PREVIEW DA RESTAURAÇÃO ADIADA — E O CANCELAMENTO DELA.
//
// O irmão de `restaurar-letra-adiada.test.mjs`, que mede o TELÃO. São dois
// arquivos porque são dois documentos com o mesmo defeito, e *ler cada lado
// isolado aprova os dois*: é a armadilha que o `fundo-da-letra.test.mjs` já
// pagou uma vez ("o telão tinha as três proteções e a preview não tinha", com a
// documentação descrevendo-as como se fossem de ambos).
//
// ## O defeito que ele trava
//
// `restorePvSceneAfterText()` lê `preview.getCurrent()` para saber qual letra
// remontar quando a Camada de Texto sai. Mas `preview.handle({type:'load'})` só
// troca o `current` DEPOIS do fade de saída (os 600 ms de `createStage.FADE`, em
// toda troca de cena) e do `getMedia`: dentro dessa janela `getCurrent()` ainda
// é a mídia ANTERIOR.
//
// O roteiro é humano e comum: louvor A tocando, um AVISO por cima (o cartão
// FICA, porque `keepText = pvTextActive && item.kind === 'audio'`), o operador
// escolhe o louvor B e, enquanto a troca acontece, tira o aviso do ar. Sem o
// adiamento, o `text-hide` remonta a letra de A sobre a música B — e PARA
// SEMPRE: quem montaria a letra de B era o ramo `showPvLyrics(item)` do `load`,
// que já passou, e nada reavalia depois. As estrofes erradas passam a rolar pelo
// relógio da música certa.
//
// SEM TV a preview em tela cheia É a projeção.
//
// ## Por que ele mede TRÊS coisas, e nenhuma basta sozinha
//
//   1. **`text` → `load` → `text-hide` DENTRO do fade** → a letra que volta é a
//      do hino NOVO. É o defeito original.
//   2. **`text` → `text-hide` sem load nenhum** → a restauração continua
//      IMEDIATA. Sem esta, "adiar sempre" passaria na cena 1 e a letra só
//      voltaria no próximo load.
//   3. **`text` → `load` → `text-hide` → Parar** → a letra NÃO volta. É a
//      REGRESSÃO que o adiamento introduz se ninguém o cancelar: o `clear`
//      resolve o load em voo na hora (`clearFaded` faz `++loadSeq`), mas o
//      `current` só vira null depois do fade — o callback do adiamento
//      dispararia com o registro ANTIGO na mão. Não tem sintoma (a cortina
//      cobre): some da tela, fica no estado.
//
//   node tools/restaurar-letra-adiada-preview.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');

const servidor = servirEstatico(RAIZ);

// Dois áudios de 30 s com letras DISTINGUÍVEIS: a asserção inteira é "de quem é
// a estrofe que está na tela", então os textos não podem se parecer. Longos o
// bastante para nenhum terminar durante o teste — uma faixa que acabasse
// responderia como cena vazia, indistinguível do que se quer medir.
// `addMedia` não serve: ele é a porta do IMPORT e não tem campo de letra (ela
// nasce do sync), daí o par `fileAdd` + `listAdd`, a mesma forma que o
// `downloadCollectionFile` grava.
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
  const hino = async (marca, faixa) => {
    const id = 'hino-' + faixa;
    const caminho = 'folders/teste/' + id + '.wav';
    await AVDB.opfsWriteFile(caminho, wav(30));
    await AVDB.fileAdd({
      id, folder: 'teste', opfsPath: caminho, srcName: id,
      name: 'HINO ' + marca, hymnName: 'HINO ' + marca, hymnTrack: faixa, hymnAlbum: 'Hinario',
      type: 'audio/wav', kind: 'audio', size: 1, mtime: Date.now(),
      thumb: null, blob: null, url: null, addedAt: Date.now(),
      lyrics: [
        { time: 0, text: marca + ' estrofe um', auxText: null },
        { time: 15, text: marca + ' estrofe dois', auxText: null },
      ],
    });
    await AVDB.listAdd('imports', id);
    return id;
  };
  const a = await hino('ALFA', 1);
  const b = await hino('BETA', 2);
  messages = [{ id: 'm1', text: 'AVISO DO CULTO' }];
  await saveMessages();
`;

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;

try {
  const pg = await ctx.newPage();
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(t);
  });
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 20000 });
  const ids = await pg.evaluate(new Function('return (async () => {'
    + 'setAppMode("full");' + SEMEAR + 'await load(); return { a, b }; })()'));

  // `letra` é o que a estrofe DIZ; `capa` é de quem o cartão de capa é. Os dois,
  // porque a letra errada e a capa errada vêm do mesmo `showPvLyrics` e ler só
  // um deles deixaria metade do defeito passar.
  const espiar = () => pg.evaluate(() => {
    const el = document.getElementById('pvLyrics');
    return {
      letraOculta: !el || el.hidden,
      letra: (document.getElementById('pvLyricsLine') || {}).textContent || '',
      capa: (typeof pvLyricsMeta === 'object' && pvLyricsMeta) ? pvLyricsMeta.hymnName : '',
      noPalco: preview.getCurrent() ? preview.getCurrent().name : '',
      cartao: !document.getElementById('pvText').hidden,
    };
  });
  const prontoParaTocar = () => pg.waitForFunction(() => {
    const v = document.getElementById('pvVideo');
    return v && v.readyState > 0;
  }, null, { timeout: 15000 });

  // ---- CENA 1: o defeito original ----------------------------------------
  // ALFA no ar com letra → aviso por cima → troca para BETA → `text-hide` DENTRO
  // do fade (150 ms, bem abaixo dos 600 ms de `createStage.FADE.time`).
  await pg.evaluate((id) => send(id), ids.a);
  await prontoParaTocar();
  await pg.evaluate(() => projectMessage(0));
  await pg.waitForTimeout(300);
  await pg.evaluate((id) => send(id), ids.b);
  await pg.waitForTimeout(150);
  await pg.evaluate(() => hideMessage());
  await pg.waitForTimeout(2500);   // muito além do fade: o que estiver aqui é permanente

  const c1 = await espiar();
  checar(!c1.letraOculta && /BETA/.test(c1.letra) && /BETA/.test(c1.capa),
    'CENA 1 — a letra que volta depois do text-hide é a da música NOVA', c1);
  checar(/BETA/.test(c1.noPalco),
    'CENA 1 — e quem está no palco da preview é ela mesma', c1);

  // ---- CENA 2: sem load em voo, a restauração é IMEDIATA -------------------
  await pg.evaluate(() => projectMessage(0));
  await pg.waitForTimeout(300);
  await pg.evaluate(() => hideMessage());
  await pg.waitForTimeout(300);    // curto DE PROPÓSITO: mede que não esperou por load

  const c2 = await espiar();
  checar(!c2.letraOculta && /BETA/.test(c2.letra),
    'CENA 2 — sem load em voo a letra volta na hora, não fica esperando', c2);

  // ---- CENA 3: a saída de cena CANCELA a restauração adiada ---------------
  await pg.evaluate((id) => send(id), ids.a);
  await prontoParaTocar();
  await pg.evaluate(() => projectMessage(0));
  await pg.waitForTimeout(300);
  await pg.evaluate((id) => send(id), ids.b);
  await pg.waitForTimeout(150);
  await pg.evaluate(() => hideMessage());
  await pg.waitForTimeout(80);
  await pg.evaluate(() => document.getElementById('stop').click());
  await pg.waitForTimeout(2500);

  const c3 = await espiar();
  checar(c3.letraOculta,
    'CENA 3 — um Parar durante a restauração adiada NÃO deixa a letra voltar', c3);
  checar(!c3.noPalco,
    'CENA 3 — e o palco da preview continua vazio', c3);

  checar(erros.length === 0, 'nenhum erro de console/página', erros);
} finally {
  await navegador.close();
  servidor.close();
}

console.log('');
if (falhas.length) {
  console.log('REPROVOU: ' + falhas.length + ' asserção(ões).');
  process.exit(1);
}
console.log('Todos passaram.');
