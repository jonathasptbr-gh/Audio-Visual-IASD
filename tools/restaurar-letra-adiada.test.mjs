// A RESTAURAÇÃO DA LETRA É ADIADA POR UM LOAD EM VOO — E CANCELADA PELA SAÍDA
// DE CENA.
//
// ## O defeito que ele trava
//
// `restoreSceneAfterText()` lê `stage.getCurrent()` para saber qual letra
// remontar quando a Camada de Texto sai. Mas `stage.handle({type:'load'})` só
// troca o `current` DEPOIS do fade de saída (os ~600 ms de `FADE.time`, em toda
// troca de cena) e do `getMedia`: dentro dessa janela `getCurrent()` ainda é a
// mídia ANTERIOR. Um `text-hide` que chegue aí remonta a letra do hino VELHO
// sobre a música nova — e PARA SEMPRE, porque nada reavalia depois: as estrofes
// erradas passam a rolar pelo relógio da música certa.
//
// A janela não é um fio de navalha. São os 600 ms fixos de TODA troca de cena,
// e a sequência é humana: escolher o próximo louvor e tirar o aviso do ar.
//
// ## Por que ele mede TRÊS coisas, e nenhuma basta sozinha
//
//   1. **`text` → `load` → `text-hide` DENTRO do fade** → a letra que volta é a
//      do hino NOVO. É o defeito original.
//   2. **`text` → `text-hide` sem load nenhum** → a restauração continua
//      IMEDIATA. Sem esta, "adiar sempre" passaria: a letra voltaria só no
//      próximo load, e a cena de roteiro ficaria sem retorno.
//   3. **`text` → `load` → `text-hide` → `clear`** → a letra NÃO volta.
//      É a REGRESSÃO que o adiamento introduz se ninguém a cancelar: o `clear`
//      resolve o load em voo na hora (`clearFaded` faz `++loadSeq`), mas o
//      `current` só vira `null` depois do fade — então o callback do adiamento
//      dispara com o registro ANTIGO na mão e remonta a letra sobre um palco já
//      esvaziado. Não tem sintoma na projeção (o wallpaper cobre), e é por isso
//      que precisa de oráculo: some da tela, fica no estado.
//
// A metade PREVIEW do mesmo defeito mora no `controle.js`
// (`restorePvSceneAfterText`) e tem oráculo próprio — ler cada lado isolado
// aprova os dois, que é a armadilha que o `fundo-da-letra.test.mjs` já pagou.
//
//   node tools/restaurar-letra-adiada.test.mjs
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
// Um hino do acervo é um registro do catálogo OPFS (`fileAdd` + `listAdd`), a
// MESMA forma que o `downloadCollectionFile` grava — `addMedia` é a porta do
// IMPORT e não tem campo de letra, porque letra nasce do sync.
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
  const estrofes = (marca) => ([
    { time: 0, text: marca + ' estrofe um', auxText: null },
    { time: 15, text: marca + ' estrofe dois', auxText: null },
  ]);
  const hino = async (marca, faixa) => {
    const id = 'hino-' + faixa;
    const caminho = 'folders/teste/' + id + '.wav';
    await AVDB.opfsWriteFile(caminho, wav(30));
    await AVDB.fileAdd({
      id, folder: 'teste', opfsPath: caminho, srcName: id,
      name: 'HINO ' + marca, hymnName: 'HINO ' + marca, hymnTrack: faixa, hymnAlbum: 'Hinario',
      type: 'audio/wav', kind: 'audio', size: 1, mtime: Date.now(),
      thumb: null, lyrics: estrofes(marca),
      blob: null, url: null, addedAt: Date.now(),
    });
    await AVDB.listAdd('imports', id);
    return id;
  };
  const a = { id: await hino('ALFA', 1) };
  const b = { id: await hino('BETA', 2) };
`;

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext({ viewport: { width: 961, height: 540 } });
await semRedeExterna(ctx);

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;

try {
  // Uma segunda página do MESMO origin faz dois papéis: semeia o acervo (o
  // `/display/` grava mídia pelo `AVDB`, e semear pelo Controle traria o
  // `init()` dele para dentro de um teste que é sobre o telão) e EMITE os
  // comandos. O emissor tem de ser outra página porque o `BroadcastChannel` não
  // entrega ao contexto que postou — é a mesma razão do `cena.test.mjs`.
  const emissor = await ctx.newPage();
  await emissor.goto(base + '/display/', { waitUntil: 'load' });
  await emissor.waitForFunction(() => window.AVDB, null, { timeout: 20000 });
  const ids = await emissor.evaluate(new Function('return (async () => {' + SEMEAR + 'return { a: a.id, b: b.id }; })()'));

  const pg = await ctx.newPage();
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(t);
  });
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  await pg.goto(base + '/display/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && window.createStage, null, { timeout: 20000 });

  // Entrega os comandos pelo MESMO caminho que o barramento usa, da página
  // EMISSORA (ver acima). `__mid` novo a cada um: o `deliverCommand` descarta
  // repetido, e sem isso o segundo `load` do roteiro seria engolido.
  let mid = 0;
  const cmd = async (o) => {
    await emissor.evaluate((c) => new BroadcastChannel('av-iasd').postMessage(c),
      { ...o, __mid: 't:' + (++mid) });
    await pg.waitForTimeout(30);   // a entrega é assíncrona entre contextos
  };

  const naTela = () => pg.evaluate(() => {
    const el = document.getElementById('lyrics');
    const linha = el ? (el.innerText || '').trim().split('\n')[0] : '';
    const v = document.querySelector('video');
    return {
      letraOculta: !el || el.hidden,
      linha,
      temSrc: !!(v && v.getAttribute('src')),
      tocando: !!(v && !v.paused),
    };
  });

  const esperar = (ms) => pg.waitForTimeout(ms);

  // ---- CENA 1: o defeito original ----------------------------------------
  // ALFA no ar com letra → cartão de texto por cima → troca para BETA →
  // `text-hide` DENTRO do fade (150 ms, bem abaixo dos 600 ms de FADE.time).
  await cmd({ type: 'load', mediaId: ids.a, view: 'visual' });
  await pg.waitForFunction(() => { const v = document.querySelector('video'); return v && v.readyState > 0; }, null, { timeout: 15000 });
  await cmd({ type: 'text', mode: 'message', lines: ['AVISO DO CULTO'] });
  await esperar(200);
  await cmd({ type: 'load', mediaId: ids.b, view: 'visual' });
  await esperar(150);
  await cmd({ type: 'text-hide' });
  await esperar(2500);   // muito além do fade: o que estiver aqui é permanente

  const c1 = await naTela();
  checar(!c1.letraOculta && /BETA/.test(c1.linha),
    'CENA 1 — a letra que volta depois do text-hide é a da música NOVA',
    c1);

  // ---- CENA 2: sem load em voo, a restauração é IMEDIATA -------------------
  // Sem esta, "adiar sempre" passaria na cena 1 e a letra só voltaria no
  // próximo load — a cena de roteiro ficaria sem retorno.
  await cmd({ type: 'text', mode: 'message', lines: ['SEGUNDO AVISO'] });
  await esperar(200);
  await cmd({ type: 'text-hide' });
  await esperar(300);    // curto DE PROPÓSITO: mede que não esperou por load

  const c2 = await naTela();
  checar(!c2.letraOculta && /BETA/.test(c2.linha),
    'CENA 2 — sem load em voo a letra volta na hora, não fica esperando',
    c2);

  // ---- CENA 3: a saída de cena CANCELA a restauração adiada ---------------
  // A regressão que o adiamento introduz: o `clear` resolve o load em voo de
  // imediato (`++loadSeq`), mas o `current` só vira null depois do fade — o
  // callback do adiamento dispararia com o registro ANTIGO e remontaria a letra
  // sobre um palco já vazio. Invisível na projeção (o wallpaper cobre), e por
  // isso mesmo só um oráculo a pega.
  await cmd({ type: 'load', mediaId: ids.a, view: 'visual' });
  await pg.waitForFunction(() => { const v = document.querySelector('video'); return v && v.readyState > 0; }, null, { timeout: 15000 });
  await cmd({ type: 'text', mode: 'message', lines: ['TERCEIRO AVISO'] });
  await esperar(200);
  await cmd({ type: 'load', mediaId: ids.b, view: 'visual' });
  await esperar(150);
  await cmd({ type: 'text-hide' });
  await esperar(80);
  await cmd({ type: 'clear' });
  await esperar(2500);

  const c3 = await naTela();
  checar(c3.letraOculta,
    'CENA 3 — um clear durante a restauração adiada NÃO deixa a letra voltar',
    c3);
  checar(!c3.temSrc,
    'CENA 3 — e o palco continua vazio',
    c3);

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
