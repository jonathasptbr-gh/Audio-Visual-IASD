// EDITAR MÍDIA (v1.12.0): o item editado é VIRTUAL — um registro com `edicao`
// que aponta para o original. Este oráculo trava as três metades:
//
//   A · o BANCO: o item resolve para os bytes/tempo/letra do trecho, o original
//       é SEGURADO enquanto o item existir (e só então coletado), e o que não
//       tem como ser editado é recusado;
//   B · o PALCO: o recorte começa em `inicio`, acaba em `fim` com o `ended`
//       (que avança a fila), o tempo reportado é o do TRECHO, e os fades de
//       entrada e saída são marcas do item sobre a duração que a tela já tem;
//   C · a JANELA (v1.12.1): seletor em grupos, faixa de duas pontas, rascunho que
//       PERSISTE (inclusive depois de criar), ajuste fino que gera item NOVO,
//       importar arquivo só para o editor, e o tile também no Modo Fácil.
//
//   node tools/edicao-de-midia.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { abrirNavegador, checar, falhas, esperar, porque, servirEstatico, RAIZ_WEB, comModoAvancado, esperarCortina } from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const DB = fs.readFileSync(path.join(WEB, 'shared', 'db.js'), 'utf8');
const STAGE = fs.readFileSync(path.join(WEB, 'shared', 'stage.js'), 'utf8');

const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext();
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', (e) => erros.push(e.message));
await pg.route('http://av.local/**', (rota) => rota.fulfill({
  status: 200, contentType: 'text/html; charset=utf-8',
  body: '<!doctype html><meta charset="utf-8"><div id="w"></div><img id="i" hidden>'
    + '<video id="v" playsinline hidden></video><script>' + DB + '</script><script>' + STAGE + '</script>',
}));
await pg.goto('http://av.local/', { waitUntil: 'domcontentloaded' });

// Um WAV de 6 s (8 kHz, 8 bits, mono) — o suficiente para o `<video>` tocar de verdade.
await pg.evaluate(() => {
  const n = 8000 * 6;
  const b = new Uint8Array(44 + n).fill(128);
  const dv = new DataView(b.buffer);
  const s = (o, t) => { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); };
  s(0, 'RIFF'); dv.setUint32(4, 36 + n, true); s(8, 'WAVE'); s(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true);
  dv.setUint16(34, 8, true); s(36, 'data'); dv.setUint32(40, n, true);
  window.__wav = () => new Blob([b], { type: 'audio/wav' });
});

// =========================================================================
// A · O BANCO
// =========================================================================
const semeado = await pg.evaluate(async () => {
  const A = window.AVDB;
  const aud = { id: 'aud-letra', blob: window.__wav(), url: null, thumb: null, type: 'audio/wav', kind: 'audio',
    name: 'Louvor', youtubeId: null, seconds: 6, createdAt: Date.now(),
    lyrics: [{ time: 0, text: 'capa' }, { time: 2, text: 'um' }, { time: 4, text: 'dois' }] };
  await A.mediaAdd(aud);
  await A.listAdd('imports', aud.id);
  const vid = await A.addMedia(window.__wav(), { name: 'Clipe', kind: 'video', list: 'imports', seconds: 6 });
  const img = await A.addMedia(new Blob(['x'], { type: 'image/png' }), { name: 'Foto', kind: 'image', list: 'imports' });
  return { aud: aud.id, vid: vid.id, img: img.id };
});

const r1 = await pg.evaluate(async (s) => {
  const e = await window.AVDB.addEdicao({ origem: s.aud, inicio: 1, fim: 5, fadeEntrada: true }, 'avulsos');
  const lido = await window.AVDB.getMedia(e.id);
  const orig = await window.AVDB.getMedia(s.aud);
  return { e, lido, blobIgual: lido.blob && orig.blob && lido.blob.size === orig.blob.size,
    letra: lido.lyrics.map((l) => l.time), origLetra: orig.lyrics.map((l) => l.time) };
}, semeado);
checar(r1.e && r1.lido.id === r1.e.id && r1.lido.name === 'Louvor (editado)',
  'A · o item editado existe com o nome do original + "(editado)"', JSON.stringify(r1.lido && r1.lido.name));
checar(r1.lido.seconds === 4 && r1.lido.edicao.inicio === 1 && r1.lido.edicao.fim === 5 && r1.lido.edicao.fadeEntrada === true,
  'A · a duração é a do TRECHO (fim − início) e as marcas viajam em `edicao`', JSON.stringify(r1.lido.edicao) + ' s=' + r1.lido.seconds);
checar(r1.blobIgual, 'A · os bytes são os do ORIGINAL (nada foi copiado)');
checar(JSON.stringify(r1.letra) === JSON.stringify([0, 1, 3]) && JSON.stringify(r1.origLetra) === '[0,2,4]',
  'A · a letra é deslocada pelo início (a estrofe do ponto de corte vira a primeira) e a do original fica intacta',
  JSON.stringify(r1.letra) + ' / ' + JSON.stringify(r1.origLetra));

const r2 = await pg.evaluate(async (s) => {
  const A = window.AVDB;
  const v = await A.addEdicao({ origem: s.vid, inicio: 0, fim: 3, soAudio: true }, 'avulsos');
  const a = await A.addEdicao({ origem: s.aud, inicio: 0, fim: 3, soAudio: true }, 'avulsos');
  return { vKind: v && v.kind, vSo: v && v.edicao.soAudio, aKind: a && a.kind, aSo: a && a.edicao.soAudio };
}, semeado);
checar(r2.vKind === 'audio' && r2.vSo === true,
  'A · "só o áudio" de um VÍDEO vira item de áudio (o telão mantém o wallpaper)', JSON.stringify(r2));
checar(r2.aKind === 'audio' && r2.aSo === false,
  'A · e num áudio a marca é ignorada', JSON.stringify(r2));

const r3 = await pg.evaluate(async (s) => {
  const A = window.AVDB;
  const ed = await A.addEdicao({ origem: s.aud, inicio: 1 }, 'avulsos');
  return {
    deEditado: await A.addEdicao({ origem: ed.id, inicio: 1 }, 'avulsos'),
    deImagem: await A.addEdicao({ origem: s.img, inicio: 1 }, 'avulsos'),
    vazio: await A.addEdicao({ origem: s.aud, inicio: 3, fim: 3.2 }, 'avulsos'),
    alemDoFim: await A.addEdicao({ origem: s.aud, inicio: 9 }, 'avulsos'),
    sumido: await A.addEdicao({ origem: 'nao-existe', inicio: 1 }, 'avulsos'),
  };
}, semeado);
checar(Object.values(r3).every((v) => v === null),
  'A · recusa o que não tem como ser editado: item já editado, imagem, trecho vazio, início além do fim, original sumido',
  JSON.stringify(r3));

// A RETENÇÃO — é ela que impede "o item continua na lista e não toca".
const r4 = await pg.evaluate(async () => {
  const A = window.AVDB;
  const orig = await A.addMedia(window.__wav(), { name: 'Segurado', kind: 'audio', list: 'imports', seconds: 6 });
  const ed = await A.addEdicao({ origem: orig.id, inicio: 1 }, 'favs');
  await A.listRemove('imports', orig.id);        // sai da última lista própria
  await A.gcOrfaos();
  const origVivo = !!(await A.getMediaCru(orig.id));
  const editadoToca = !!(await A.getMedia(ed.id));
  await A.listRemove('favs', ed.id);              // o último lugar do item editado
  await A.gcOrfaos();
  return { origVivo, editadoToca, edSumiu: !(await A.getMediaCru(ed.id)), origSumiu: !(await A.getMediaCru(orig.id)) };
});
checar(r4.origVivo && r4.editadoToca,
  'A · o ORIGINAL é segurado enquanto o item editado existir em algum lugar (e o item continua tocável)', JSON.stringify(r4));
checar(r4.edSumiu && r4.origSumiu,
  'A · e sem o item editado em lugar nenhum, o original volta a ser coletável — não vaza para sempre', JSON.stringify(r4));

// =========================================================================
// B · O PALCO
// =========================================================================
await pg.evaluate(() => {
  window.__fins = [];
  window.__v = document.getElementById('v');
  window.__stage = window.createStage({
    wallpaper: document.getElementById('w'), img: document.getElementById('i'), video: window.__v,
    onEnded: () => window.__fins.push(window.__v.currentTime),
  });
  window.__stage.setFade({ fadeIn: false, fadeOut: false, time: 1 });
});

const criar = (e) => pg.evaluate(async ([s, e]) => (await window.AVDB.addEdicao(Object.assign({ origem: s.aud }, e), 'avulsos')).id,
  [semeado, e]);

// B1 · recorte 1 → 3 s: dura 2, acaba no corte (o `ended` sai perto de 3 s do ARQUIVO).
const idCorte = await criar({ inicio: 1, fim: 3 });
await pg.evaluate((id) => { window.__fins.length = 0; return window.__stage.handle({ type: 'load', mediaId: id, view: 'visual', muted: false, volume: 1 }); }, idCorte);
const dur = await esperar(pg, () => isFinite(window.__stage.getDuration()) && window.__stage.getDuration() > 0, null, 8000);
const info = await pg.evaluate(() => ({ d: window.__stage.getDuration(), t: window.__stage.getTime(), c: window.__v.currentTime }));
checar(dur === true && Math.abs(info.d - 2) < 0.05,
  'B · a duração do palco é a do TRECHO (2 s), não a do arquivo (6 s)', porque(dur) || JSON.stringify(info));
checar(info.c >= 0.95 && info.t < 1,
  'B · o item ENTRA no início do recorte, e o tempo reportado é relativo a ele', JSON.stringify(info));
const acabou = await esperar(pg, () => window.__fins.length > 0, null, 8000);
const fimNoArquivo = await pg.evaluate(() => window.__fins[0]);
checar(acabou === true && fimNoArquivo >= 2.9 && fimNoArquivo <= 3.5,
  'B · o `ended` (que avança a fila) sai no FIM DO RECORTE (≈ 3 s do arquivo), não aos 6 s',
  porque(acabou) || String(fimNoArquivo));
const aposFim = await esperar(pg, () => window.__stage.hasEnded() && window.__v.paused, null, 8000);
checar(aposFim === true, 'B · e o palco para e marca o fim', porque(aposFim));
const rebobinou = await pg.evaluate(() => window.__v.currentTime);
checar(Math.abs(rebobinou - 1) < 0.1,
  'B · o replay parte do INÍCIO do recorte (1 s), não do zero do arquivo', String(rebobinou));

// B2 · seek no tempo do trecho.
const idSeek = await criar({ inicio: 1, fim: 5 });
await pg.evaluate((id) => window.__stage.handle({ type: 'load', mediaId: id, view: 'visual', muted: false, volume: 1, playing: false }), idSeek);
await esperar(pg, () => isFinite(window.__stage.getDuration()) && window.__stage.getDuration() > 0, null, 8000);
await pg.evaluate(() => window.__stage.seek(0.5));
const sk = await pg.evaluate(() => ({ c: window.__v.currentTime, t: window.__stage.getTime() }));
checar(Math.abs(sk.c - 1.5) < 0.1 && Math.abs(sk.t - 0.5) < 0.1,
  'B · `seek(t)` é em tempo do TRECHO (0,5 → 1,5 s do arquivo)', JSON.stringify(sk));

// B3 · os fades do item, com os fades da tela DESLIGADOS: a marca basta, e a
// duração é a que a tela já tem (1 s).
const idFade = await criar({ inicio: 0, fim: 4, fadeEntrada: true, fadeSaida: true });
await pg.evaluate((id) => {
  window.__vol = [];
  clearInterval(window.__volT);
  window.__volT = setInterval(() => window.__vol.push([window.__v.currentTime, window.__v.volume]), 40);
  return window.__stage.handle({ type: 'load', mediaId: id, view: 'visual', muted: false, volume: 1 });
}, idFade);
const fez = await esperar(pg, () => window.__vol.some(([t]) => t > 3.8), null, 12000);
const vol = await pg.evaluate(() => { clearInterval(window.__volT); return window.__vol; });
const entrada = vol.filter(([t]) => t > 0 && t < 0.6).map(([, v]) => v);
const meio = vol.filter(([t]) => t > 1.6 && t < 2.4).map(([, v]) => v);
const saida = vol.filter(([t]) => t > 3.3 && t < 3.9).map(([, v]) => v);
checar(fez === true && entrada.length && Math.min(...entrada) < 0.8,
  'B · fade de ENTRADA do item: o som sobe, mesmo com o fade da tela desligado', porque(fez) || JSON.stringify(entrada.slice(0, 6)));
checar(meio.length && meio.every((v) => v > 0.95),
  'B · e no meio do trecho o volume está cheio', JSON.stringify(meio.slice(0, 6)));
checar(saida.length && Math.min(...saida) < 0.7,
  'B · fade de SAÍDA do item: o som desce antes do corte (acaba mudo, não cortado no talo)', JSON.stringify(saida.slice(0, 8)));

// B4 · sem a marca e sem fade na tela, nada esmaece (o item não vaza para os outros).
// O item anterior ainda está acabando (a rampa de saída dele): esperar o fim, ou
// as amostras iniciais seriam DELE.
await esperar(pg, () => window.__stage.hasEnded(), null, 12000);
const idSem = await criar({ inicio: 0, fim: 3 });
await pg.evaluate((id) => {
  window.__vol = [];
  clearInterval(window.__volT);
  window.__volT = setInterval(() => window.__vol.push([window.__v.currentTime, window.__v.volume]), 40);
  return window.__stage.handle({ type: 'load', mediaId: id, view: 'visual', muted: false, volume: 1 });
}, idSem);
await esperar(pg, () => window.__vol.some(([t]) => t > 2.8), null, 12000);
const vol2 = await pg.evaluate(() => { clearInterval(window.__volT); return window.__vol; });
checar(vol2.filter(([t]) => t > 0.05).every(([, v]) => v > 0.95),
  'B · item SEM marcas de fade e fade da tela desligado: o volume não se mexe', JSON.stringify(vol2.slice(0, 6)));

// =========================================================================
// C · A JANELA (o app inteiro, no Modo Avançado)
// =========================================================================
const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;
const ctx2 = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
await semRedeExterna(ctx2);
const app = await ctx2.newPage();
app.on('pageerror', (e) => erros.push('app: ' + e.message));
await comModoAvancado(app);
await app.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
await esperarCortina(app);

const wav = await pg.evaluate(async () => {
  const b = window.__wav(); const buf = new Uint8Array(await b.arrayBuffer());
  let s = ''; for (const x of buf) s += String.fromCharCode(x);
  return btoa(s);
});
const ids = await app.evaluate(async (b64) => {
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const rec = await window.AVDB.addMedia(new Blob([u], { type: 'audio/wav' }), { name: 'Hino Cinco', kind: 'audio', list: 'imports', seconds: 6 });
  await window.AVDB.addMedia(new Blob([u], { type: 'audio/wav' }), { name: 'Outro Louvor', kind: 'audio', list: 'imports', seconds: 6 });
  return { rec: rec.id };
}, wav);

const abrir = async (pg2 = app) => {
  await pg2.evaluate(() => (document.getElementById('settingsBtn') || document.getElementById('simpleSettingsBtn')).click());
  await esperar(pg2, () => document.getElementById('fadePopup').classList.contains('open'), null, 10000);
  await pg2.click('#edicaoTile');
  return esperar(pg2, () => document.getElementById('edicaoPopup').classList.contains('open'), null, 10000);
};
// Abre o grupo e toca na linha pelo NOME (o seletor é a lista de grupos da exportação).
const escolher = async (grupo, nome, pg2 = app) => {
  await esperar(pg2, (g) => !!document.querySelector('#edicaoLista [data-grupo="' + g + '"]'), grupo, 10000);
  const aberto = await pg2.evaluate((g) => !!document.querySelector('#edicaoLista [data-grupo="' + g + '"] .pacote-grupo-corpo'), grupo);
  if (!aberto) await pg2.click('#edicaoLista [data-grupo="' + grupo + '"] > .song-menu-grupo');
  await esperar(pg2, (g) => !!document.querySelector('#edicaoLista [data-grupo="' + g + '"] .pacote-linha'), grupo, 10000);
  await pg2.evaluate(([g, n]) => {
    const l = [...document.querySelectorAll('#edicaoLista [data-grupo="' + g + '"] .pacote-linha')]
      .find((x) => x.querySelector('.song-menu-label').textContent === n);
    l.querySelector('.song-menu-btn').click();
  }, [grupo, nome]);
  return esperar(pg2, () => !!document.getElementById('edicaoIni'), null, 10000);
};
const mexer = (pg2, ini, fim) => pg2.evaluate(([a, b]) => {
  if (a != null) { const i = document.getElementById('edicaoIni'); i.value = String(a); i.dispatchEvent(new Event('input', { bubbles: true })); }
  if (b != null) { const f = document.getElementById('edicaoFim'); f.value = String(b); f.dispatchEvent(new Event('input', { bubbles: true })); }
}, [ini, fim]);
const marca = (pg2, rotulo) => pg2.evaluate((r) => {
  const l = [...document.querySelectorAll('#edicaoLista .pacote-linha')].find((x) => x.querySelector('.song-menu-label').textContent === r);
  l.querySelector('.song-menu-btn').click();
}, rotulo);
const nomear = (pg2, txt) => pg2.evaluate((t) => {
  const n = document.querySelector('#edicaoLista .edicao-nome input'); n.value = t; n.dispatchEvent(new Event('input', { bubbles: true }));
}, txt);
const estado = (pg2) => pg2.evaluate(() => {
  const nm = document.querySelector('#edicaoLista .edicao-nome input');
  const on = (r) => { const l = [...document.querySelectorAll('#edicaoLista .pacote-linha')].find((x) => x.querySelector('.song-menu-label').textContent === r); return !!(l && l.querySelector('.song-menu-check.on')); };
  return { ini: document.getElementById('edicaoIni') && document.getElementById('edicaoIni').value,
    fim: document.getElementById('edicaoFim') && document.getElementById('edicaoFim').value,
    nome: nm && nm.value, fi: on('Fade de entrada'), fo: on('Fade de saída'),
    criar: document.getElementById('edicaoCriar').disabled,
    titulo: document.getElementById('edicaoTitulo').textContent };
});
const criarEGuardar = async (pg2) => {
  await pg2.click('#edicaoCriar');
  const folha = await esperar(pg2, () => document.getElementById('songMenuPopup').classList.contains('open'), null, 10000);
  await pg2.evaluate(() => document.querySelector('#songMenuPopup .song-menu-go').click());
  return { folha, criado: await esperar(pg2, () => /Item criado/.test(document.getElementById('edicaoNota').textContent), null, 15000) };
};

// C1 · SEM rascunho a janela abre no SELETOR, com os grupos das listas.
const aberta = await abrir();
await esperar(app, () => !!document.querySelector('#edicaoLista [data-grupo="lst:favs"]'), null, 10000);
const vista = await app.evaluate(() => ({
  titulo: document.getElementById('edicaoTitulo').textContent,
  grupos: [...document.querySelectorAll('#edicaoLista [data-grupo]')].map((e) => e.dataset.grupo),
  voltar: document.getElementById('edicaoVoltar').disabled,
  busca: !document.getElementById('edicaoBuscaCaixa').hidden,
  importar: !!document.getElementById('edicaoImportar') && !document.getElementById('edicaoFechoEscolha').hidden,
}));
checar(aberta === true && vista.titulo === 'Escolher a mídia' && vista.busca && vista.importar && vista.voltar === true
    && ['lst:imports', 'lst:playlist', 'lst:favs'].every((g) => vista.grupos.includes(g)),
  'C · a janela abre no SELETOR em grupos (Cronograma, Playlist, Favoritos…), com busca e "Importar arquivo"',
  porque(aberta) || JSON.stringify(vista));

// C2 · escolher a mídia abre o formulário, com UMA faixa de duas pontas.
const montou = await escolher('lst:imports', 'Hino Cinco');
const faixa = await app.evaluate(() => ({
  faixas: document.querySelectorAll('#edicaoLista .edicao-faixa').length,
  ranges: document.querySelectorAll('#edicaoLista input[type=range]').length,
  max: [+document.getElementById('edicaoIni').max, +document.getElementById('edicaoFim').max],
  criar: document.getElementById('edicaoCriar').disabled,
  fim: document.getElementById('edicaoFim').value,
}));
checar(montou === true && faixa.faixas === 1 && faixa.ranges === 2 && faixa.max[0] === 6 && faixa.max[1] === 6
    && faixa.fim === '6' && faixa.criar === true,
  'C · o corte é UMA faixa com duas pontas (dois controles na mesma barra), cobre os 6 s e "Criar item" fica apagado até ajustar',
  porque(montou) || JSON.stringify(faixa));

// as pontas não se cruzam: o início nunca passa de fim − 1 s
await mexer(app, 5.5, null);
const trava = await estado(app);
checar(+trava.ini <= 5 && +trava.fim === 6, 'C · a ponta de início não passa do fim (sobra ao menos 1 s)', JSON.stringify(trava));

await mexer(app, 2, 5);
await marca(app, 'Fade de saída');
await nomear(app, 'Hino Cinco sem a introdução');
const habil = await esperar(app, () => !document.getElementById('edicaoCriar').disabled, null, 5000);
checar(habil === true, 'C · ajustar qualquer coisa acende "Criar item"', porque(habil));

// C3 · PERSISTÊNCIA do rascunho: fechar e recarregar o app.
await app.waitForTimeout(400);   // o gravar do rascunho é adiado em 250 ms de propósito
await app.click('#edicaoPopupClose');
await app.reload({ waitUntil: 'domcontentloaded' });
await esperarCortina(app);
const voltou = await abrir();
await esperar(app, () => !!document.getElementById('edicaoIni'), null, 10000);
const rasc2 = await estado(app);
checar(voltou === true && rasc2.titulo === 'Editar mídia' && rasc2.ini === '2' && rasc2.fim === '5'
    && rasc2.fo === true && rasc2.fi === false && rasc2.nome === 'Hino Cinco sem a introdução',
  'C · o RASCUNHO persiste: sair, recarregar o app e voltar traz o mesmo item e os mesmos valores',
  porque(voltou) || JSON.stringify(rasc2));

// C4 · CRIAR pergunta o destino e guarda o item; o formulário e o rascunho FICAM.
const c1 = await criarEGuardar(app);
const noCrono = await app.evaluate(async () => {
  const todos = await window.AVDB.listItems('imports');
  const it = todos.find((m) => m.name === 'Hino Cinco sem a introdução');
  const avulsos = await window.AVDB.listIds('avulsos');
  return { achou: !!it, seconds: it && it.seconds, edicao: it && it.edicao, avulsoVazio: !it || !avulsos.includes(it.id) };
});
checar(c1.folha === true && c1.criado === true && noCrono.achou && noCrono.seconds === 3
    && noCrono.edicao.inicio === 2 && noCrono.edicao.fim === 5 && noCrono.edicao.fadeSaida === true,
  'C · "Criar item" pergunta ONDE guardar e cria no Cronograma, com o trecho e a marca de saída', JSON.stringify([c1, noCrono]));
checar(noCrono.avulsoVazio, 'C · o item não fica na prateleira avulsa (só nos destinos escolhidos)');
const depois = await estado(app);
const rascDepois = await app.evaluate(() => window.AVDB.getState('edicaoRascunho'));
checar(depois.ini === '2' && depois.fim === '5' && depois.nome === 'Hino Cinco sem a introdução (2)'
    && rascDepois && rascDepois.origem,
  'C · depois de criar o formulário e o rascunho PERSISTEM (o nome avança), para o próximo ajuste', JSON.stringify([depois, rascDepois]));

// C5 · AJUSTE FINO sobre o item já editado: cria um item NOVO e o primeiro não muda.
await app.click('#edicaoLista .pacote-linha .song-menu-btn');   // a linha da mídia: troca
await esperar(app, () => document.getElementById('edicaoTitulo').textContent === 'Escolher a mídia', null, 10000);
const c5a = await escolher('lst:imports', 'Hino Cinco sem a introdução');
const parte = await estado(app);
checar(c5a === true && parte.ini === '2' && parte.fim === '5' && parte.fo === true && parte.nome === 'Hino Cinco sem a introdução (2)',
  'C · escolher um item JÁ EDITADO parte dos valores dele (ajuste fino), com nome novo', porque(c5a) || JSON.stringify(parte));
await mexer(app, null, 4);
await nomear(app, 'Hino Cinco curto');
const c2 = await criarEGuardar(app);
const dois = await app.evaluate(async () => {
  const todos = await window.AVDB.listItems('imports');
  const a = todos.find((m) => m.name === 'Hino Cinco sem a introdução');
  const b = todos.find((m) => m.name === 'Hino Cinco curto');
  return { a: a && a.edicao, b: b && b.edicao, origemIgual: !!(a && b && a.edicao.origem === b.edicao.origem) };
});
checar(c2.criado === true && dois.a && dois.a.fim === 5 && dois.b && dois.b.fim === 4 && dois.b.inicio === 2 && dois.origemIgual,
  'C · o ajuste gera um item NOVO (fim 4 s) sobre o MESMO original, e o primeiro continua com fim 5 s', JSON.stringify([c2, dois]));

// C6 · IMPORTAR ARQUIVO: entra só no editor — em lista nenhuma — e o rascunho o segura.
await app.click('#edicaoLista .pacote-linha .song-menu-btn');
await esperar(app, () => document.getElementById('edicaoTitulo').textContent === 'Escolher a mídia', null, 10000);
const wavBuf = Buffer.from(wav, 'base64');
const [seletor] = await Promise.all([
  app.waitForEvent('filechooser'),
  app.click('#edicaoImportar'),
]);
await seletor.setFiles({ name: 'Trilha Externa.wav', mimeType: 'audio/wav', buffer: wavBuf });
const importou = await esperar(app, () => !!document.getElementById('edicaoIni')
  && document.getElementById('edicaoTitulo').textContent === 'Editar mídia', null, 20000);
const imp = await app.evaluate(async () => {
  const bases = await window.AVDB.basesDoEditor();
  const b = bases.find((x) => x.name === 'Trilha Externa');
  const emLista = [];
  if (b) for (const l of ['imports', 'playlist', 'favs', 'avulsos']) if ((await window.AVDB.listIds(l)).includes(b.id)) emLista.push(l);
  await window.AVDB.gcOrfaos();
  return { achou: !!b, emLista, segura: !!(b && await window.AVDB.getMediaCru(b.id)),
    nota: document.getElementById('edicaoNota').textContent };
});
checar(importou === true && imp.achou && imp.emLista.length === 0 && imp.segura,
  'C · "Importar arquivo" traz o arquivo SÓ para o editor (fora de toda lista) e o rascunho o segura contra o coletor',
  porque(importou) || JSON.stringify(imp));
// descartado e sem edição, o importado volta a ser coletável
await app.evaluate(() => document.getElementById('edicaoDescartar').click());
await esperar(app, () => document.getElementById('edicaoTitulo').textContent === 'Escolher a mídia', null, 10000);
const solto = await app.evaluate(async () => {
  await window.AVDB.gcOrfaos();
  return (await window.AVDB.basesDoEditor()).some((x) => x.name === 'Trilha Externa');
});
checar(solto === false, 'C · descartar sem criar nada solta o arquivo importado (o coletor o leva, não vaza)', String(solto));

// C7 · BUSCA no seletor
await app.fill('#edicaoBusca', 'curto');
const achados = await app.evaluate(() => [...document.querySelectorAll('#edicaoLista .song-menu-label')].map((e) => e.textContent).filter((t) => /Hino/.test(t)));
checar(achados.length === 1 && achados[0] === 'Hino Cinco curto', 'C · a busca filtra as linhas pelo nome (e abre os grupos que casam)', JSON.stringify(achados));

// C8 · MODO FÁCIL: o tile existe e a janela abre (sem a pergunta de destino).
const ctx4 = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
await semRedeExterna(ctx4);
const facil = await ctx4.newPage();
facil.on('pageerror', (e) => erros.push('facil: ' + e.message));
await facil.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
await esperarCortina(facil);
const modo = await facil.evaluate(() => document.body.classList.contains('mode-simple'));
const visivel = await facil.evaluate(async () => {
  (document.getElementById('settingsBtn') || document.getElementById('simpleSettingsBtn')).click();
  await new Promise((r) => setTimeout(r, 600));
  const t = document.getElementById('edicaoTile');
  return !!t && !t.hidden && t.getBoundingClientRect().width > 0 && getComputedStyle(t).display !== 'none';
});
checar(modo === true && visivel === true, 'C · no MODO FÁCIL o tile "Editar mídia" está à vista em Configurações', JSON.stringify({ modo, visivel }));
await facil.click('#edicaoTile');
const abriuFacil = await esperar(facil, () => document.getElementById('edicaoPopup').classList.contains('open'), null, 10000);
checar(abriuFacil === true, 'C · e abre a janela do editor no Modo Fácil', porque(abriuFacil));
await ctx4.close();


// =========================================================================
// D · O ORIGINAL É SEMPRE VINCULADO — hinário, vídeo baixado, exportação
// =========================================================================
// D1 · o original do CATÁLOGO (hinário/pasta) sobrevive à exclusão da coleção.
const d1 = await app.evaluate(async (b64) => {
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const A = window.AVDB;
  await A.opfsWriteFile('folders/hinD/1.wav', new Blob([u], { type: 'audio/wav' }));
  await A.fileAdd({ id: 'cat-hino-1', folder: 'hinD', opfsPath: 'folders/hinD/1.wav', name: 'Hino 1',
    type: 'audio/wav', kind: 'audio', size: u.length, seconds: 6, blob: null, url: null,
    lyrics: [{ time: 0, text: 'a' }, { time: 3, text: 'b' }] });
  await A.listAdd('imports', 'cat-hino-1');
  const ed = await A.addEdicao({ origem: 'cat-hino-1', inicio: 1, fim: 5 }, 'favs');
  // o que "Excluir a coleção" faz: purge do catálogo + apagar a pasta do OPFS
  const recs = await A.filesByFolder('hinD');
  await window.purgeCatalogRecords(recs);
  await A.opfsDeleteDir('folders/hinD');
  const lido = await A.getMedia(ed.id);
  const emLista = [];
  for (const l of ['imports', 'playlist', 'favs', 'avulsos']) if ((await A.listIds(l)).includes('cat-hino-1')) emLista.push(l);
  const base = await A.getMediaCru('cat-hino-1');
  await window.AVDB.listRemove('favs', ed.id);      // o último lugar do editado
  await A.gcOrfaos();
  return { tocavel: !!(lido && lido.blob && lido.blob.size === u.length), seconds: lido && lido.seconds,
    letra: lido && lido.lyrics.map((l) => l.time), fileSumiu: !(await A.fileGet('cat-hino-1')),
    baseNaMedia: !!(base && base.base && !base.opfsPath), emLista,
    baseColetada: !(await A.getMediaCru('cat-hino-1')) };
}, wav);
checar(d1.fileSumiu && d1.tocavel && d1.seconds === 4,
  'D · excluir a coleção do hinário NÃO tira o original do item editado: ele continua tocável, com os bytes',
  JSON.stringify(d1));
checar(d1.baseNaMedia && d1.emLista.length === 0,
  'D · e o original passa a ser interno: fora de toda lista, invisível para o operador', JSON.stringify(d1));
checar(d1.baseColetada,
  'D · sem o item editado em lugar nenhum, o original interno é coletado (não vaza)', JSON.stringify(d1));

// D2 · o plano do pacote: o original viaja ESCONDIDO com o editado, e não vira "Outros itens".
const d2 = await app.evaluate(async (b64) => {
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const A = window.AVDB;
  const wav = () => new Blob([u], { type: 'audio/wav' });
  await A.opfsWriteFile('folders/hinE/1.wav', wav());
  await A.fileAdd({ id: 'cat-E', folder: 'hinE', opfsPath: 'folders/hinE/1.wav', name: 'Hino E',
    type: 'audio/wav', kind: 'audio', size: u.length, seconds: 6, blob: null, url: null });
  const emLista = await A.addMedia(wav(), { name: 'Na lista', kind: 'audio', list: 'imports', seconds: 6 });
  const escondido = await A.addMedia(wav(), { name: 'Excluido', kind: 'audio', list: 'imports', seconds: 6 });
  const e1 = await A.addEdicao({ origem: 'cat-E', inicio: 1 }, 'favs');
  const e2 = await A.addEdicao({ origem: emLista.id, inicio: 1 }, 'favs');
  const e3 = await A.addEdicao({ origem: escondido.id, inicio: 1 }, 'favs');
  await A.listRemove('imports', escondido.id);          // "excluído" das listas
  const plano = await window.pacotePlano();
  const soFavs = new Set(['lst:favs']);
  const bases = await window.pacoteBases(plano, soFavs);
  const ids = bases.map((b) => b.rec.id).sort();
  const outros = plano.midiaPorGrupo.get('midia');
  const cat = bases.find((b) => b.rec.id === 'cat-E');
  const comImports = await window.pacoteBases(plano, new Set(['lst:favs', 'midia']));
  return {
    ids, esperado: ['cat-E', emLista.id, escondido.id].sort(),
    outrosTemEscondido: !!(outros && outros.has(escondido.id)),
    catForma: cat && { base: cat.rec.base, opfs: cat.rec.opfsPath, tam: cat.corpo && cat.corpo.size, cheio: u.length },
    comImports: comImports.map((b) => b.rec.id).sort(), comImportsNomes: comImports.map((b) => b.rec.name),
    escondidoId: escondido.id, listaId: emLista.id,
  };
}, wav);
checar(JSON.stringify(d2.ids) === JSON.stringify(d2.esperado),
  'D · exportando só os Favoritos, os TRÊS originais vão junto (catálogo, item de lista e item "excluído")',
  JSON.stringify(d2));
checar(d2.catForma && d2.catForma.base === true && d2.catForma.opfs === null && d2.catForma.tam === d2.catForma.cheio,
  'D · o original do catálogo viaja na forma de mídia, com os bytes (o destino não tem a coleção)', JSON.stringify(d2.catForma));
checar(!d2.outrosTemEscondido,
  'D · o original "excluído" não aparece em "Outros itens": para o operador ele não existe', JSON.stringify(d2));
checar(!d2.comImports.includes(d2.listaId),
  'D · com o grupo do original marcado ("Outros itens") ele viaja pelo caminho normal, não duas vezes', JSON.stringify(d2));

// D3 · a importação por marcas: o original escondido entra SE o editado entrou.
const ctx3 = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx3);
const dest = await ctx3.newPage();
dest.on('pageerror', (e) => erros.push('destino: ' + e.message));
await comModoAvancado(dest);
await dest.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
await esperarCortina(dest);
const d3 = await dest.evaluate(async (b64) => {
  const bin = atob(b64); const corpo = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) corpo[i] = bin.charCodeAt(i);
  const P = window.AVPacote;
  const partes = [P.assinatura()];
  const reg = (cab, c) => { partes.push(P.cabecalhoParaBytes(cab)); if (c) partes.push(c); };
  const edit = { id: 'ED1', kind: 'audio', type: 'audio/wav', name: 'Editado', edicao: { origem: 'BASE1', inicio: 1, fim: null } };
  const base = { id: 'BASE1', kind: 'audio', type: 'audio/wav', name: 'Original', base: true };
  const outro = { id: 'OUTRO', kind: 'audio', type: 'audio/wav', name: 'De fora' };
  reg({ t: 'media', rec: edit, bytes: 0, grupos: ['lst:favs'] });
  reg({ t: 'media', rec: outro, bytes: corpo.length, grupos: [] }, corpo);
  reg({ t: 'media', rec: base, bytes: corpo.length, grupos: [], base: true }, corpo);
  reg({ t: 'fim', bytes: 0 });
  const total = partes.reduce((t, x) => t + x.length, 0);
  const u8 = new Uint8Array(total); let o = 0;
  for (const x of partes) { u8.set(x, o); o += x.length; }
  const fonte = { size: u8.length,
    bytes: async (a, b) => u8.slice(a, b),
    blob: async (a, b, tipo) => new Blob([u8.slice(a, b)], { type: tipo || '' }) };
  const filtro = { marcados: new Set(['lst:favs']), ids: new Set(), listas: new Map([['lst:favs', new Set(['ED1'])]]), bases: new Set() };
  const contagem = { media: 0, repetidos: 0, arquivos: 0, opfs: 0, chaves: 0, recusadas: 0 };
  await window.pacoteAplicarFluxo(window.pacoteCursor(fonte), contagem, null, filtro);
  const tem = async (id) => !!(await window.AVDB.getMediaCru(id));
  return { ed: await tem('ED1'), base: await tem('BASE1'), outro: await tem('OUTRO'),
    media: contagem.media, bases: contagem.bases || 0 };
}, wav);
checar(d3.ed && d3.base && !d3.outro && d3.media === 1 && d3.bases === 1,
  'D · importando só os Favoritos entram o editado e o original ESCONDIDO (contado à parte), e o resto fica de fora',
  JSON.stringify(d3));
const d4 = await dest.evaluate(async () => {
  // o mesmo pacote, sem marcar nada: nem o editado nem o original podem entrar
  const A = window.AVDB;
  const lista = await A.listIds('favs');
  return { favs: lista.length, baseVisivel: (await A.listIds('imports')).includes('BASE1') };
});
checar(!d4.baseVisivel, 'D · o original importado não entra em lista nenhuma', JSON.stringify(d4));

checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));

servidor.close();
await navegador.close();
if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
