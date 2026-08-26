// O FUNDO DA LETRA NA PREVIEW — a imagem que sumia ao trocar de música.
//
// ## O defeito
//
// A imagem de fundo da estrofe é FILHA da camada da letra, e por isso o
// desmonte dela é ADIADO: `hidePvLyrics(true)` esmaece a camada e agenda um
// teardown para `PV_LAYER_FADE_MS` depois — senão o fundo sumiria por trás de um
// texto ainda esmaecendo. Quando a letra VOLTA antes desse prazo (é o que todo
// `load` de música faz: `hidePvLyrics(true)` e, no mesmo tique, `showPvLyrics`),
// alguém precisa CANCELAR o teardown.
//
// A guarda de sequência não cancela nada: ela só descarta o teardown quando
// `pvLyricLoadSeq` andou. E ele NÃO anda quando a estrofe que volta usa a MESMA
// imagem da que saiu — `applyPvLyricsImage` devolve cedo em `key ===
// pvLyricImgKey`. Esse é o caso NORMAL, não o raro: o fallback "grudento" do
// sync faz as estrofes de um hino compartilharem uma imagem só, e hinos do mesmo
// hinário compartilham a arte do álbum.
//
// Resultado: o teardown dispara com o seq ainda válido, REVOGA A OBJECT URL EM
// USO e apaga o fundo que acabara de reaparecer. Do lado de fora é a queixa do
// operador: *"ao pular e voltar slides, em especial no início das músicas, ou
// usar os botões de próxima/anterior música, as imagens da música não
// aparecem"* — "no início" porque a janela é justamente os
// `PV_LAYER_FADE_MS` seguintes ao `load`.
//
// **O telão tem essa guarda; a preview não tinha.** E sem TV a preview É a
// projeção — o que este arquivo mede é a metade que a congregação vê.
//
// ## As três metades
//
//  1. o fundo SOBREVIVE à troca de música quando a imagem é a mesma (o
//     `clearTimeout` de `showPvLyrics`);
//  2. `renderPvLyricSlide` com índice inexistente NÃO envenena `pvLyricSlideIdx`
//     — gravá-lo antes de validar marca como "já renderizado" um slide que nunca
//     foi pintado, e a guarda de cima passa a recusar o índice certo;
//  3. a object URL da imagem que sai é REVOGADA mesmo quando outra assume dentro
//     do fade — atrás da guarda de sequência ela ficava retida até o WebView
//     morrer, uma vez por ocorrência, o culto inteiro.
//
//   node tools/fundo-da-letra.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arquivo = path.join(RAIZ, p);
  if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404); res.end('nao'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
});

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

// DUAS músicas que compartilham a MESMA imagem de fundo — o caso normal de um
// hinário, não um arranjo de laboratório. WAV de 20 s pelo motivo de sempre: uma
// faixa que acabe no meio do teste responde como se tivesse sido interrompida.
const SEMEAR = `
  const sr = 8000, secs = 20, n = sr * secs;
  const wav = () => {
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
  const png = await (await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')).blob();
  const CAPA = 'lyricimg/capa.png';
  await AVDB.opfsWriteFile(CAPA, png);
  const estrofes = (nome) => ([
    { time: 0, text: null, auxText: null, cover: true, imageOpfsPath: CAPA },
    { time: 3, text: nome + ' — primeira estrofe', auxText: null, imageOpfsPath: CAPA },
    { time: 8, text: nome + ' — segunda estrofe', auxText: null, imageOpfsPath: CAPA },
  ]);
  // Um hino do acervo é um registro do catálogo OPFS (fileAdd + listAdd), a
  // MESMA forma que downloadCollectionFile grava — addMedia é a porta do
  // IMPORT, e ela nao tem campo de letra porque letra nasce do sync.
  const comLetra = async (nome, faixa) => {
    const id = 'hino-' + faixa;
    const caminho = 'folders/teste/' + id + '.wav';
    await AVDB.opfsWriteFile(caminho, wav());
    await AVDB.fileAdd({
      id, folder: 'teste', opfsPath: caminho, srcName: id,
      name: nome, hymnName: nome, hymnTrack: faixa, hymnAlbum: 'Hinario',
      type: 'audio/wav', kind: 'audio', size: 1, mtime: Date.now(),
      thumb: null, lyrics: estrofes(nome),
      blob: null, url: null, addedAt: Date.now(),
    });
    await AVDB.listAdd('imports', id);
    return { id };
  };
  const um = await comLetra('Hino um', 1);
  const dois = await comLetra('Hino dois', 2);
`;

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  args: ['--autoplay-policy=no-user-gesture-required'],
});
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
    erros.push('controle: ' + t);
  });
  pg.on('pageerror', (e) => erros.push('controle pageerror: ' + e.message));

  // O ESPIÃO DAS REVOGAÇÕES entra ANTES de qualquer script da página: a metade 3
  // mede uma chamada que não deixa rastro nenhum no DOM.
  await pg.addInitScript(() => {
    window.__revogadas = [];
    const real = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (u) => { window.__revogadas.push(String(u)); return real(u); };
  });
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 20000 });

  const ids = await pg.evaluate(new Function('return (async () => {'
    + 'setAppMode("full");' + SEMEAR + 'await load(); return { um: um.id, dois: dois.id }; })()'));

  // O que se mede: a `<img>` de fundo da preview está NO AR com uma fonte?
  const fundo = () => pg.evaluate(() => {
    const im = document.getElementById('pvLyricsImg');
    return {
      noAr: !!(im && !im.hidden && im.getAttribute('src')),
      src: im ? im.getAttribute('src') : null,
      chave: typeof pvLyricImgKey !== 'undefined' ? pvLyricImgKey : '(sem acesso)',
      url: typeof pvLyricImgUrl !== 'undefined' ? pvLyricImgUrl : '(sem acesso)',
      idx: typeof pvLyricSlideIdx !== 'undefined' ? pvLyricSlideIdx : null,
    };
  });

  // ======================================================================
  // 1 — O FUNDO SOBREVIVE À TROCA DE MÚSICA
  // ======================================================================
  await pg.evaluate((id) => send(id), ids.um);
  // Espera pelo FATO (a imagem no ar), não por um prazo: quem resolve o
  // `opfsGetFile` é o disco, e um `waitForTimeout` aqui mediria a máquina.
  await pg.waitForFunction(() => {
    const im = document.getElementById('pvLyricsImg');
    return !!(im && !im.hidden && im.getAttribute('src'));
  }, null, { timeout: 10000 }).catch(() => {});
  const a = await fundo();
  checar(a.noAr, 'a imagem de fundo da primeira música entra em cena (ponto de partida)', a);

  const urlAntiga = a.url;
  await pg.evaluate((id) => send(id), ids.dois);
  // O prazo do teardown é `PV_LAYER_FADE_MS` (320 ms). Mede-se DEPOIS dele —
  // é ele que revogava a URL em uso.
  await pg.waitForTimeout(900);
  const b = await fundo();
  checar(b.noAr,
    'o fundo CONTINUA no ar depois de trocar de música com a MESMA imagem'
    + ' — o teardown adiado foi cancelado', b);
  checar(b.chave === 'lyricimg/capa.png',
    'e a chave da imagem continua apontando para o que está na tela', b);

  // ======================================================================
  // 2 — PULAR SLIDE LOGO DEPOIS DO LOAD (a janela do fade)
  // ======================================================================
  // É a outra metade da queixa, e a mesma janela: o operador carrega a música e
  // já passa slide. Sem o cancelamento, o teardown do `load` alcança a estrofe
  // que o `seek` acabou de pintar.
  //
  // E o que se mede é o PISCA, não o estado final: o teardown zera a chave, então
  // a estrofe SEGUINTE resolve a imagem de novo e conserta sozinha. Ler o fim
  // aprova o defeito — o fundo volta, depois de uma estrofe inteira no preto.
  //
  // O CENÁRIO É REARMADO À MÃO (religar o fundo), e não herdado da metade
  // anterior: com o defeito de volta, a metade 1 deixa a imagem FORA do ar, e um
  // `load` a partir dali passa pelo caminho são (chave nula ⇒ a sequência anda
  // ⇒ o teardown é descartado). Sem o rearme, esta metade aprovaria o defeito.
  await pg.evaluate(async () => { await setLyricsBg('black'); await setLyricsBg('image'); });
  await pg.waitForFunction(() => {
    const im = document.getElementById('pvLyricsImg');
    return !!(im && !im.hidden && im.getAttribute('src'));
  }, null, { timeout: 10000 }).catch(() => {});

  await pg.evaluate((id) => send(id), ids.um);
  await pg.waitForTimeout(60);
  const piscou = await pg.evaluate(async () => {
    stepSlide(1);
    let sumiu = false;
    const ate = Date.now() + 1200;   // cobre o fade (320 ms) com folga larga
    while (Date.now() < ate) {
      const im = document.getElementById('pvLyricsImg');
      if (!im || im.hidden || !im.getAttribute('src')) sumiu = true;
      await new Promise((r) => setTimeout(r, 20));
    }
    return sumiu;
  });
  checar(!piscou,
    'passar slide nos primeiros milissegundos da música não apaga o fundo — nem por um instante',
    { piscou });

  // ======================================================================
  // 3 — O ÍNDICE SÓ É REGISTRADO DEPOIS DE VALIDADO
  // ======================================================================
  const idx = await pg.evaluate(() => {
    if (!pvLyrics) return { erro: 'sem letra na preview' };
    const antes = pvLyricSlideIdx;
    renderPvLyricSlide(99);          // índice que não existe na lista
    return { antes, depois: pvLyricSlideIdx };
  });
  checar(idx.antes >= 0 && idx.depois === idx.antes,
    'um índice inexistente NÃO vira `pvLyricSlideIdx` — senão o slide certo'
    + ' nunca mais seria pintado', idx);

  // ======================================================================
  // 4 — A OBJECT URL QUE SAI É REVOGADA
  // ======================================================================
  // Desligar e religar o fundo dentro do fade: a primeira passada solta a URL
  // antiga (`pvLyricImgUrl = null`) e a segunda põe outra no lugar. Quem revoga
  // a primeira é o `setTimeout` do caminho vazio — e ele só a alcança se a
  // revogação vier ANTES da guarda de sequência.
  const antesDaTroca = (await fundo()).url;
  await pg.evaluate(async () => {
    await setLyricsBg('black');
    await setLyricsBg('image');
  });
  await pg.waitForTimeout(900);
  const d = await fundo();
  const revogadas = await pg.evaluate(() => window.__revogadas.slice());
  checar(revogadas.includes(antesDaTroca),
    'a object URL da imagem que saiu foi revogada, mesmo com outra assumindo dentro do fade',
    { antesDaTroca, revogadas: revogadas.length });
  checar(d.noAr, 'e o fundo está no ar de novo depois do religa', d);

  checar(erros.length === 0, 'nenhum erro de console', erros);
} finally {
  await ctx.close();
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\ntudo certo.');
