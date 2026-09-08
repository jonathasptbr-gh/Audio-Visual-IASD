#!/usr/bin/env node
// ============================================================================
// UM BOTÃO SEM FUNÇÃO FICA APAGADO — e o eixo de slide exige CENA
//
// ## Os dois relatos que ele trava
//
//  1. *"enquanto uma música está em stop, os botões de anterior e próximo slide
//     ficam ativos (isso está errado), e interagir com eles faz com que a
//     próxima música pule slides já na sua abertura como se os toques anteriores
//     fossem para ela"*.
//  2. *"verifique botões que deveriam ter sua função inativa ao toque em
//     situações em que ele não deveria ser usado. Como é o caso de uma playlist
//     vazia… o botão de stop se não tem nada em play e etc… Isso evita bugs por
//     tentar fazer algo que não seria possível"*.
//
// ## O defeito do primeiro, e por que ele é sutil
//
// `slideTarget()` decidia o eixo por `currentItem` — e o `currentItem`
// **sobrevive ao stop de propósito**: é ele que faz o ▶ repetir a faixa. Parado,
// o item continuava sendo o último tocado, o par de botões continuava aceso, e
// cada toque emitia um `seek` para um palco VAZIO. A pergunta certa já existe no
// app e é `midiaNoAr` — a bandeira que o `send` acende e o stop apaga.
//
// O SINTOMA que o operador viu é a JUSANTE disso (a estrofe da faixa seguinte
// abrindo adiantada, pelos `seek` acumulados); este oráculo corta na NASCENTE,
// que é o único ponto em que a correção pode ser afirmada sem depender de
// quantos toques houve nem de qual faixa entrou depois.
//
// ## O que ele mede, e por que a terceira metade existe
//
//  1. **APAGADO SEM FILA E SEM CENA.** ⏮/⏭ do transporte com a playlist vazia,
//     ⏹ sem nada no ar — os três já eram INERTES, e inerte não é apagado: um
//     botão aceso que não faz nada é indistinguível de um quebrado.
//  2. **SEM CENA NÃO HÁ EIXO.** Parado, `slideTarget()` é `null`, os dois botões
//     de slide ficam `disabled`, e `stepSlide()` não emite comando NENHUM.
//  3. **PAUSADO CONTINUA VALENDO.** É a REGRESSÃO que a régua errada produz:
//     escrita como `playing`, ela mataria o caso mais comum do culto — o louvor
//     PAUSADO para a oração, com a letra na tela e o operador passando estrofe.
//  4. **O ▶ E O PARAR NÃO SÃO APAGADOS JUNTO.** O ▶ fica aceso com a mídia
//     parada (é `currentId` que faz ele repetir a faixa), e o ⏹ volta a acender
//     assim que há cena. Sem esta metade, "apagar o que não faz nada" levaria
//     dois recursos junto.
//
//   node tools/transporte-sem-cena.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, porque, checar, falhas } from './arnes.mjs';

// Duas faixas de 20 s COM LETRA: a fila precisa ter dois itens para os ⏮/⏭
// valerem, e a letra é o que dá eixo de slide ao par ao lado da preview.
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
  const letra = [{ time: 0, cover: true }, { time: 4, text: 'primeira' },
    { time: 9, text: 'segunda' }, { time: 14, text: 'terceira' }];
  for (const id of ['hino-um', 'hino-dois']) {
    const caminho = 'folders/teste/' + id + '.wav';
    await AVDB.opfsWriteFile(caminho, wav(20));
    await AVDB.fileAdd({
      id, folder: 'teste', opfsPath: caminho, srcName: id,
      name: id.toUpperCase(), type: 'audio/wav', kind: 'audio', size: 1, mtime: 1,
      thumb: null, blob: null, url: null, addedAt: 1, lyrics: letra,
    });
  }
`;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();

// O ESTADO DOS BOTÕES é lido do DOM, não da regra: `disabled` é o que o
// navegador usa para engolir o toque, e `.t-btn:disabled` é o que o operador vê.
const botoes = () => pg.evaluate(() => {
  const q = (id) => document.getElementById(id);
  const ler = (id) => ({ off: !!q(id).disabled, title: q(id).title });
  return {
    prev: ler('prev'), next: ler('next'), stop: ler('stop'), play: ler('playpause'),
    slidePrev: ler('slidePrevBtn'), slideNext: ler('slideNextBtn'),
    alvo: slideTarget(), midia: !!midiaNoAr, id: currentId || '',
  };
});

// O QUE SAI NO BARRAMENTO quando o par de slide é acionado. `stepSlide` é o
// handler dos dois botões — chamá-lo direto prova a guarda mesmo para quem
// chegar por outra porta (a notificação de mídia aciona os botões por `.click()`).
const oQueSai = (delta) => pg.evaluate((d) => {
  const vistos = [];
  const original = window.cmd;
  window.cmd = (c) => { vistos.push(c.type); };
  try { stepSlide(d); } finally { window.cmd = original; }
  return vistos;
}, delta);

try {
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 30000 });
  await esperarCortina(pg);
  await pg.evaluate(new Function('return (async () => { setAppMode("full");' + SEMEAR + 'await load(); })()'));

  // ── 1. NADA NA FILA, NADA NO AR ─────────────────────────────────────────
  const frio = await botoes();
  checar(frio.prev.off === true && frio.next.off === true,
    'PLAYLIST VAZIA apaga os ⏮/⏭ do transporte — eles já voltavam na primeira '
    + 'linha do `step()`, e inerte não é a mesma coisa que apagado', frio);
  checar(/fila est[áa] vazia/i.test(frio.next.title),
    'e o `title` diz POR QUÊ: é o que um botão apagado deve a quem o encontra',
    frio.next.title);
  checar(frio.stop.off === true && /nada no ar/i.test(frio.stop.title),
    'e o PARAR sem nada no ar também', frio.stop);
  checar(frio.slidePrev.off === true && frio.slideNext.off === true && frio.alvo === null,
    'sem cena não há eixo de slide, e o par ao lado da preview nasce apagado', frio);

  // ── 2. O LOUVOR ENTRA ───────────────────────────────────────────────────
  await pg.evaluate(async () => {
    await AVDB.listAdd('playlist', 'hino-um');
    await AVDB.listAdd('playlist', 'hino-dois');
    await load();
    await send('hino-um');
  });
  const tocando = await esperar(pg, () => !!midiaNoAr && !document.getElementById('pvVideo').paused,
    null, 8000);
  checar(tocando === true, 'o louvor entra em cena e toca', porque(tocando));

  const noAr = await botoes();
  checar(noAr.prev.off === false && noAr.next.off === false && noAr.stop.off === false,
    'COM FILA E COM CENA os três acendem — o apagado é estado, não decoração', noAr);
  checar(noAr.alvo === 'lyrics' && noAr.slideNext.off === false,
    'e o eixo de slide é a LETRA, com para onde ir', noAr);
  const saiuTocando = await oQueSai(1);
  checar(saiuTocando.includes('seek'),
    'passar estrofe com a mídia no ar emite o `seek` de sempre', saiuTocando);

  // ── 3. PAUSADO CONTINUA VALENDO ─────────────────────────────────────────
  // A régua escrita como `playing` mataria o caso mais comum do culto: o louvor
  // pausado para a oração segue EM CENA, com a letra na tela.
  await pg.evaluate(() => { cmd({ type: 'pause' }); renderSlideNav(); });
  const pausado = await botoes();
  checar(pausado.midia === true && pausado.alvo === 'lyrics' && pausado.slideNext.off === false,
    'PAUSADO NÃO É PARADO: `midiaNoAr` é "carregada", não "tocando" — a letra '
    + 'continua na tela e passar estrofe ali é o que o operador faz', pausado);
  const saiuPausado = await oQueSai(1);
  checar(saiuPausado.includes('seek'),
    'e o comando sai igual com a mídia pausada', saiuPausado);

  // ── 4. O STOP TIRA O EIXO ───────────────────────────────────────────────
  await pg.evaluate(() => stopClear());
  await esperar(pg, () => midiaNoAr === false, null, 5000);
  const parado = await botoes();
  checar(parado.midia === false && parado.id === 'hino-um',
    'o stop apaga `midiaNoAr` e MANTÉM o `currentId` — é esse par que o defeito '
    + 'confundia', parado);
  checar(parado.alvo === null && parado.slidePrev.off === true && parado.slideNext.off === true,
    'PARADO NÃO TEM EIXO: os dois botões de slide ficam apagados, em vez de '
    + 'aceitarem toques para um palco vazio', parado);
  const saiuParado = await oQueSai(1);
  checar(saiuParado.length === 0,
    'e NENHUM comando sai por eles — é aqui que os `seek` se acumulavam e '
    + 'reapareciam na abertura da faixa seguinte', saiuParado);

  // ── 5. O QUE NÃO FOI APAGADO JUNTO ──────────────────────────────────────
  checar(parado.play.off === false,
    'o ▶ FICA ACESO com a mídia parada: `currentId` sobrevive ao stop de '
    + 'propósito, e é ele que faz o ▶ repetir a faixa — apagá-lo tiraria um '
    + 'recurso', parado.play);
  checar(parado.prev.off === false && parado.next.off === false,
    'e os ⏮/⏭ do transporte também: a fila continua cheia, e trocar de mídia '
    + 'com o palco vazio é o caminho normal', parado);
  checar(parado.stop.off === true,
    'o PARAR volta a apagar — e a pergunta é `cenaDeRoteiroNoAr()`, não '
    + '`cenaNoAr()`: esta começa por `!!currentId`, que sobrevive ao stop, e '
    + 'deixaria o botão aceso para sempre depois da primeira mídia do dia',
    parado.stop);
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
