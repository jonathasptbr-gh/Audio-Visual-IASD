// ============================================================================
// O NOME DO PLAYER COM O ITINERÁRIO NO TELÃO (v1.14.51)
//
// Pedido do operador: *"No player, enquanto houver um itinerário no telão, e eu
// tocar uma mídia, o nome do player deve ser da mídia, pois o progresso também
// já é da mídia."*
//
// O que trava (`renderNowPlaying`, o ramo do itinerário pergunta `midiaNoAr`):
//  1. só o itinerário no ar → o nome é "Itinerário";
//  2. uma mídia tocada por cima → o nome é o DELA, no avançado (`#npNameInner`),
//     no Modo Fácil (`#simpleNpName`) e no título da NOTIFICAÇÃO (o `cena.title`
//     do `pushNowPlaying`, lido com uma ponte falsa); a barra é a dela;
//  3. o Parar (`media-clear`: o cartão fica) → volta "Itinerário";
//  4. o FIM NATURAL de uma faixa curta → volta "Itinerário" (`resetAfterEnd`,
//     que não passa pelo `renderNowPlaying` de resto).
//
// Reversões medidas: tirar o `&& !midiaNoAr` derruba o 2; tirar a chamada em
// `resetAfterEnd` derruba o 4. A espera do 3 é pelo RENDER pós-Parar (o nome de
// volta a "Itinerário"), nunca só pela bandeira `midiaNoAr` — o Parar a escreve
// antes do `persistCurrent` que separa o render (`#2639`): lê-se o nome antigo.
//
//   node tools/nome-do-player-itinerario.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, checar, falhas, RAIZ_WEB, esperar,
  esperarCortina, comModoAvancado,
} from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext({ viewport: { width: 360, height: 800 }, locale: 'pt-BR' });
await semRedeExterna(ctx);
await comModoAvancado(ctx);

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY|Failed to load resource/;

// O nome nas TRÊS casas: o avançado, o Modo Fácil (que copia o avançado) e o
// título que a notificação receberia — `pushNowPlaying` só fala com a ponte
// nativa, então ela é trocada por uma falsa durante a leitura.
const NOMES = () => {
  const avancado = document.getElementById('npNameInner').textContent;
  const facil = document.getElementById('simpleNpName').textContent;
  let notif = null;
  const antes = window.__NATIVE__, ponte = window.AVNative;
  window.AVNative = new Proxy({}, { get: (_, k) => (k === 'nowPlaying' ? (c) => { notif = c.title; } : () => {}) });
  window.__NATIVE__ = true;
  try { lastScene = ''; pushNowPlaying(); } finally { window.__NATIVE__ = antes; window.AVNative = ponte; }
  return { avancado, facil, notif, itin: itinProjecting(), noAr: midiaNoAr, seek: !document.getElementById('seek').disabled };
};

try {
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !EXTERNO.test(m.text())) erros.push(m.text()); });
  await pg.goto(base + '/controle/');
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 30000 });
  await esperarCortina(pg);

  await pg.evaluate(async () => {
    const wav = (secs) => {
      const sr = 8000, n = sr * secs, buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
      const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
      wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
      dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
      dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
      wr(36, 'data'); dv.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
      return new Blob([buf], { type: 'audio/wav' });
    };
    await AVDB.addCue('momento', { min: 540 }, { name: 'Recepção', list: 'imports' });
    await AVDB.addCue('momento', { min: 600 }, { name: 'Louvor', list: 'imports' });
    await AVDB.addMedia(wav(20), { name: 'Hino Longo', type: 'audio/wav', kind: 'audio', list: 'imports' });
    await AVDB.addMedia(wav(2), { name: 'Vinheta Curta', type: 'audio/wav', kind: 'audio', list: 'imports' });
    await load();
    projectItin();
  });
  // O Modo Fácil copia o nome no `renderSimple`, que só escreve com ele ativo:
  // ele é LIGADO para a leitura e o transporte segue o mesmo (`#stop` existe nos dois).
  const idDe = (n) => pg.evaluate((nome) => libItems.find((m) => m.name === nome).id, n);
  const tocar = async (n) => { const id = await idDe(n); await pg.evaluate((x) => send(x), id); };
  const ler = async () => { await pg.evaluate(() => { setAppMode('simple'); renderSimple(); }); const r = await pg.evaluate(NOMES); await pg.evaluate(() => setAppMode('full')); return r; };

  const so = await ler();
  checar(so.itin && so.avancado === 'Itinerário' && so.facil === 'Itinerário' && so.notif === 'Itinerário',
    '1 · só o itinerário no telão: o nome é "Itinerário" no avançado, no Modo Fácil e na notificação', so);

  await tocar('Hino Longo');
  await esperar(pg, () => midiaNoAr && document.getElementById('npNameInner').textContent !== 'Itinerário', null, 10000).catch(() => {});
  const com = await ler();
  checar(com.itin && com.noAr && com.seek && com.avancado === 'Hino Longo' && com.facil === 'Hino Longo' && com.notif === 'Hino Longo',
    '2 · com o itinerário no ar, a mídia tocada vence o NOME (como já vencia a barra): avançado, Modo Fácil e notificação', com);

  await pg.click('#stop');
  // A ESPERA É PELO DRENO NO DOM: `pararMidia` escreve `midiaNoAr = false` antes
  // do `await persistCurrent()`, e quem vira o nome é o `renderNowPlaying()` do
  // `stopClear` depois dele — entre os dois está a janela medida no CI (#2639),
  // onde a leitura pega "Hino Longo" com `noAr:false`. Espera-se o estado
  // pós-Parar RENDERIZADO (o nome de volta a "Itinerário") junto com a bandeira.
  await esperar(pg, () => !midiaNoAr
    && document.getElementById('npNameInner').textContent === 'Itinerário', null, 10000).catch(() => {});
  const parado = await ler();
  checar(parado.itin && !parado.noAr && parado.avancado === 'Itinerário' && parado.facil === 'Itinerário' && parado.notif === 'Itinerário',
    '3 · o Parar tira só a mídia (o cartão fica) e o nome VOLTA a ser "Itinerário"', parado);

  await tocar('Vinheta Curta');
  await esperar(pg, () => document.getElementById('npNameInner').textContent === 'Vinheta Curta', null, 10000).catch(() => {});
  const curta = await pg.evaluate(() => document.getElementById('npNameInner').textContent);
  await esperar(pg, () => !midiaNoAr, null, 15000).catch(() => {});
  const fim = await ler();
  checar(curta === 'Vinheta Curta' && fim.itin && !fim.noAr && fim.avancado === 'Itinerário' && fim.notif === 'Itinerário',
    '4 · o FIM NATURAL da faixa (`resetAfterEnd`) também devolve "Itinerário"', { curta, fim });

  checar(erros.length === 0, 'nenhum erro de console', erros);
} catch (e) {
  checar(false, 'o oráculo rodou até o fim', e && e.stack || String(e));
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
