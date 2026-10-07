// EDITAR MÍDIA (v1.12.0): o item editado é VIRTUAL — um registro com `edicao`
// que aponta para o original. Este oráculo trava as três metades:
//
//   A · o BANCO: o item resolve para os bytes/tempo/letra do trecho, o original
//       é SEGURADO enquanto o item existir (e só então coletado), e o que não
//       tem como ser editado é recusado;
//   B · o PALCO: o recorte começa em `inicio`, acaba em `fim` com o `ended`
//       (que avança a fila), o tempo reportado é o do TRECHO, e os fades de
//       entrada e saída são marcas do item sobre a duração que a tela já tem;
//   C · a JANELA: o rascunho PERSISTE (sair, tocar o original, voltar) e criar
//       o item o guarda no destino escolhido.
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

const abrir = async () => {
  await app.evaluate(() => document.getElementById('settingsBtn') ? document.getElementById('settingsBtn').click() : document.getElementById('simpleSettingsBtn').click());
  await esperar(app, () => document.getElementById('fadePopup').classList.contains('open'), null, 10000);
  await app.click('#edicaoTile');
  return esperar(app, () => document.getElementById('edicaoPopup').classList.contains('open')
    && document.querySelectorAll('#edicaoItem option').length > 1, null, 10000);
};
const aberta = await abrir();
checar(aberta === true, 'C · o tile "Editar mídia" abre a janela e ela lista as mídias de áudio/vídeo', porque(aberta));

await app.selectOption('#edicaoItem', ids.rec);
const montou = await esperar(app, () => !document.getElementById('edicaoControles').hidden, null, 10000);
checar(montou === true, 'C · escolher a mídia mostra os controles (sliders, fades)', porque(montou));
const maxSl = await app.evaluate(() => ({ ini: +document.getElementById('edicaoIni').max, fim: +document.getElementById('edicaoFim').max,
  criar: document.getElementById('edicaoCriar').disabled }));
checar(maxSl.ini === 6 && maxSl.fim === 6 && maxSl.criar === true,
  'C · os sliders cobrem a duração (6 s) e "Criar item" está apagado enquanto nada foi ajustado', JSON.stringify(maxSl));

await app.evaluate(() => {
  const ini = document.getElementById('edicaoIni'); ini.value = '2'; ini.dispatchEvent(new Event('input', { bubbles: true }));
  const f = document.getElementById('edicaoFim'); f.value = '5'; f.dispatchEvent(new Event('input', { bubbles: true }));
  const c = document.getElementById('edicaoFadeOut'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true }));
  const n = document.getElementById('edicaoNome'); n.value = 'Hino Cinco sem a introdução'; n.dispatchEvent(new Event('input', { bubbles: true }));
});
const habil = await esperar(app, () => !document.getElementById('edicaoCriar').disabled, null, 5000);
checar(habil === true, 'C · ajustar qualquer coisa acende "Criar item"', porque(habil));

// PERSISTÊNCIA: fechar a janela (e até recarregar o app) e voltar com tudo igual.
await app.waitForTimeout(400);   // o gravar do rascunho é adiado em 250 ms de propósito
await app.click('#edicaoPopupClose');
await app.reload({ waitUntil: 'domcontentloaded' });
await esperarCortina(app);
const voltou = await abrir();
const rasc = await app.evaluate(() => ({
  item: document.getElementById('edicaoItem').selectedOptions[0].textContent,
  ini: document.getElementById('edicaoIni').value, fim: document.getElementById('edicaoFim').value,
  fo: document.getElementById('edicaoFadeOut').checked, fi: document.getElementById('edicaoFadeIn').checked,
  nome: document.getElementById('edicaoNome').value,
}));
await esperar(app, () => !document.getElementById('edicaoControles').hidden, null, 10000);
const rasc2 = await app.evaluate(() => ({
  item: document.getElementById('edicaoItem').selectedOptions[0].textContent,
  ini: document.getElementById('edicaoIni').value, fim: document.getElementById('edicaoFim').value,
  fo: document.getElementById('edicaoFadeOut').checked, fi: document.getElementById('edicaoFadeIn').checked,
  nome: document.getElementById('edicaoNome').value,
}));
checar(voltou === true && /Hino Cinco/.test(rasc2.item) && rasc2.ini === '2' && rasc2.fim === '5'
    && rasc2.fo === true && rasc2.fi === false && rasc2.nome === 'Hino Cinco sem a introdução',
  'C · o RASCUNHO persiste: sair, recarregar o app e voltar traz o mesmo item e os mesmos valores',
  porque(voltou) || JSON.stringify([rasc, rasc2]));

// CRIAR: a pergunta de destino (Cronograma já marcado) e o item aparece na lista.
await app.click('#edicaoCriar');
const folha = await esperar(app, () => document.getElementById('songMenuPopup').classList.contains('open'), null, 10000);
checar(folha === true, 'C · "Criar item" pergunta ONDE guardar (a mesma folha de destinos)', porque(folha));
await app.evaluate(() => document.querySelector('#songMenuPopup .song-menu-go').click());
const criado = await esperar(app, () => /Item criado/.test(document.getElementById('edicaoInfo').textContent), null, 15000);
const noCrono = await app.evaluate(async () => {
  const todos = await window.AVDB.listItems('imports');
  const it = todos.find((m) => m.name === 'Hino Cinco sem a introdução');
  const rasc = await window.AVDB.getState('edicaoRascunho');
  const avulsos = await window.AVDB.listIds('avulsos');
  return { achou: !!it, seconds: it && it.seconds, edicao: it && it.edicao, rasc, avulsoVazio: !it || !avulsos.includes(it.id) };
});
checar(criado === true && noCrono.achou && noCrono.seconds === 3 && noCrono.edicao.inicio === 2 && noCrono.edicao.fim === 5 && noCrono.edicao.fadeSaida === true,
  'C · o item editado é criado no Cronograma, com o trecho e a marca de saída', porque(criado) || JSON.stringify(noCrono));
checar(!noCrono.rasc || !noCrono.rasc.origem,
  'C · e o rascunho é limpo depois de criar (o próximo item parte do zero)', JSON.stringify(noCrono.rasc));
checar(noCrono.avulsoVazio, 'C · o item não fica na prateleira avulsa (só nos destinos escolhidos)');

checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));

servidor.close();
await navegador.close();
if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
