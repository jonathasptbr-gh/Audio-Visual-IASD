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
//       PERSISTE (inclusive depois de criar), importar arquivo só para o editor, e o
//       tile também no Modo Fácil. v1.12.6: o fecho é "Confirmar" + os quadrados dos
//       destinos; o X vermelho do card cancela; e escolher um item JÁ EDITADO o edita
//       NO LUGAR (o mesmo id, em todas as listas onde ele está).
//
//   node tools/edicao-de-midia.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { abrirNavegador, checar, falhas, esperar, esperarDb, porque, servirEstatico, RAIZ_WEB, comModoAvancado, esperarCortina } from './arnes.mjs';

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
  const lisa = await A.addMedia(window.__wav(), { name: 'Sem letra', kind: 'audio', list: 'avulsos', seconds: 6 });
  const l = await A.addEdicao({ origem: lisa.id, inicio: 0, fim: 3, soAudio: true }, 'avulsos');
  return { vKind: v && v.kind, vSo: v && v.edicao.soAudio, aKind: a && a.kind, aSo: a && a.edicao.soAudio,
    aLetra: a && a.lyrics, vLetra: v && v.lyrics && v.lyrics.length, lSo: l && l.edicao.soAudio };
}, semeado);
checar(r2.vKind === 'audio' && r2.vSo === true,
  'A · "só o áudio" de um VÍDEO vira item de áudio (o telão mantém o wallpaper)', JSON.stringify(r2));
checar(r2.aKind === 'audio' && r2.aSo === true && r2.aLetra === null,
  'A · "só o áudio" de um ÁUDIO COM LETRA (hinário) tira a letra e o fundo: o telão fica no wallpaper', JSON.stringify(r2));
checar(r2.lSo === false, 'A · e num áudio SEM letra a marca é ignorada (não há o que tirar)', JSON.stringify(r2));

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

// B5 · o corte com os fades REAIS do app (o `FADE` fixo: entrada e saída, 0,6 s) e SEM a marca de
// saída no item (v1.12.22). O fim natural espera o fade de saída do palco antes de marcar `ended`; o
// `<video>` segue tocando nesse meio-tempo, e cada `timeupdate` achava `resta < 0` e despachava OUTRO
// `ended` — MEDIDO, ~17 avisos (cada um avançando a fila) até o fim do ARQUIVO. Um aviso só.
await pg.evaluate(() => window.__stage.setFade({ fadeIn: true, fadeOut: true, time: 0.6 }));
const idReal = await criar({ inicio: 0, fim: 2 });
await pg.evaluate((id) => { window.__fins.length = 0; return window.__stage.handle({ type: 'load', mediaId: id, view: 'visual', muted: false, volume: 1 }); }, idReal);
const parou = await esperar(pg, () => window.__fins.length > 0 && window.__stage.hasEnded() && window.__v.paused, null, 12000);
const finsReal = await pg.evaluate(() => ({ n: window.__fins.length, em: window.__fins.map((t) => +t.toFixed(2)), c: window.__v.currentTime }));
checar(parou === true && finsReal.n === 1,
  'B · com os fades reais da tela (0,6 s) e sem a marca de saída, o corte dá UM `ended` só — não um por `timeupdate` durante o fade',
  porque(parou) || JSON.stringify(finsReal));
await pg.evaluate(() => window.__stage.setFade({ fadeIn: false, fadeOut: false, time: 1 }));

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
  await window.AVDB.addMedia(new Blob([u], { type: 'audio/wav' }), { name: 'Louvor com um nome tão comprido que jamais caberia na largura do card do item', kind: 'audio', list: 'imports', seconds: 6 });
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
    criar: document.getElementById('edicaoConfirmar').disabled,
    titulo: document.getElementById('edicaoTitulo').textContent };
});
const criarEGuardar = async (pg2) => {
  await pg2.click('#edicaoConfirmar');
  const folha = await esperar(pg2, () => document.getElementById('songMenuPopup').classList.contains('open'), null, 10000);
  await pg2.evaluate(() => document.querySelector('#songMenuPopup .song-menu-go').click());
  return { folha, criado: await esperar(pg2, () => [...document.querySelectorAll('#edicaoLista .edicao-rotulo')].some((e) => e.textContent === 'Nome do item'), null, 15000) };
};

// C1 · SEM rascunho a janela abre no SELETOR, com os grupos das listas.
const aberta = await abrir();
await esperar(app, () => !!document.querySelector('#edicaoLista [data-grupo="lst:favs"]'), null, 10000);
const vista = await app.evaluate(() => ({
  titulo: document.getElementById('edicaoTitulo').textContent,
  grupos: [...document.querySelectorAll('#edicaoLista [data-grupo]')].map((e) => e.dataset.grupo),
  semVoltar: !document.getElementById('edicaoVoltar') && !document.getElementById('edicaoDescartar') && !document.getElementById('edicaoCriar'),
  busca: !document.getElementById('edicaoBuscaCaixa').hidden,
  importar: !!document.getElementById('edicaoImportar') && !document.getElementById('edicaoFechoEscolha').hidden,
}));
checar(aberta === true && vista.titulo === 'Escolher a mídia' && vista.busca && vista.importar && vista.semVoltar === true
    && ['lst:imports', 'lst:playlist', 'lst:favs'].every((g) => vista.grupos.includes(g)),
  'C · a janela abre no SELETOR em grupos (Cronograma, Playlist, Favoritos…), com busca e "Importar arquivo" — e SEM o botão "Voltar" (nem os antigos Descartar/Criar item)',
  porque(aberta) || JSON.stringify(vista));

// C1b · A SOMBRA DE CIMA DA LISTA TEM FOLGA DA CAIXA DE BUSCA (v1.12.3). Relato do operador: *"na lista
// para escolher a mídia para edição, a sombra de corte superior da fronteira da lista está sem margem
// com a caixa de texto da busca; a sombra está colando na caixa"* — a tira mora no topo do scroller, e
// o scroller começava 5,6px abaixo do campo.
const folgaBusca = await app.evaluate(() => {
  const campo = document.querySelector('#edicaoBuscaCaixa .lib-search-campo').getBoundingClientRect();
  const lista = document.getElementById('edicaoLista').getBoundingClientRect();
  return { campoAteLista: +(lista.top - campo.bottom).toFixed(1) };
});
checar(folgaBusca.campoAteLista >= 14,
  'C · a lista do seletor começa ≥ 14px abaixo do CAMPO de busca (eram 5,6px, e a sombra de cima colava nele)',
  JSON.stringify(folgaBusca));

// C1c · "Importar arquivo" é um botão BAIXO, do tamanho dos botões do fecho do formulário (v1.12.7): ícone
// e texto LADO A LADO, não empilhados na altura de uma linha de lista.
const impBotao = await app.evaluate(() => {
  const b = document.getElementById('edicaoImportar').getBoundingClientRect();
  const svg = document.querySelector('#edicaoImportar svg').getBoundingClientRect();
  const lab = document.querySelector('#edicaoImportar .song-menu-label').getBoundingClientRect();
  return { h: +b.height.toFixed(1), mesmaLinha: Math.abs((svg.top + svg.height / 2) - (lab.top + lab.height / 2)) < 3 && svg.right <= lab.left + 1 };
});
checar(impBotao.h <= 46 && impBotao.mesmaLinha === true,
  'C · "Importar arquivo" é um botão baixo (≤ 46px) com o ícone ao LADO do texto, como os botões do formulário', JSON.stringify(impBotao));

// C2 · escolher a mídia abre o formulário, com UMA faixa de duas pontas.
const montou = await escolher('lst:imports', 'Hino Cinco');
const faixa = await app.evaluate(() => ({
  faixas: document.querySelectorAll('#edicaoLista .edicao-faixa').length,
  ranges: document.querySelectorAll('#edicaoLista input[type=range]').length,
  max: [+document.getElementById('edicaoIni').max, +document.getElementById('edicaoFim').max],
  criar: document.getElementById('edicaoConfirmar').disabled,
  fim: document.getElementById('edicaoFim').value,
}));
checar(montou === true && faixa.faixas === 1 && faixa.ranges === 2 && faixa.max[0] === 6 && faixa.max[1] === 6
    && faixa.fim === '6' && faixa.criar === true,
  'C · o corte é UMA faixa com duas pontas (dois controles na mesma barra), cobre os 6 s e "Confirmar" fica apagado até ajustar',
  porque(montou) || JSON.stringify(faixa));

// C2b · sem a linha "Original: …" na base, e a faixa de corte com MARGEM LATERAL (v1.12.7): colada na
// borda, o gesto de voltar do Android (deslizar da borda) disputava o arrasto da ponta.
const lateral = await app.evaluate(() => {
  const ini = document.getElementById('edicaoIni').getBoundingClientRect();
  return { nota: !!document.getElementById('edicaoNota'), esq: +ini.left.toFixed(1), dir: +(window.innerWidth - ini.right).toFixed(1) };
});
checar(lateral.nota === false && lateral.esq >= 28 && lateral.dir >= 28,
  'C · sem texto de estado no rodapé (nem "Original", nem "Lendo…") e com ≥ 28px de margem entre a faixa de corte e as bordas da tela', JSON.stringify(lateral));

// C2c · acabamento do formulário (v1.12.7): sem o recado "fica com…" na faixa, o tempo de cada ponta À
// DIREITA do rótulo (uma linha só), "Trecho" centrado e o rótulo do nome alinhado ao texto do campo.
const acab = await app.evaluate(() => {
  const L = document.getElementById('edicaoLista');
  const r = (e) => e.getBoundingClientRect();
  const tit = L.querySelector('.edicao-tit'); const bloco = tit.closest('.edicao-bloco');
  const pontas = [...L.querySelectorAll('.edicao-ponta')].map((w) => {
    const rot = r(w.querySelector('.edicao-rotulo')); const val = r(w.querySelector('.edicao-valor'));
    return { mesmaLinha: Math.abs((rot.top + rot.height / 2) - (val.top + val.height / 2)) < 6, aDireita: val.left >= rot.right - 1 };
  });
  const rn = L.querySelector('.edicao-rotulo-nome'); const campo = L.querySelector('.edicao-nome input');
  return {
    fica: /fica com/.test(L.textContent),
    centroTit: +((r(tit).left + r(tit).right) / 2 - (r(bloco).left + r(bloco).right) / 2).toFixed(1),
    pontas,
    nomeRecuo: +(r(rn).left + parseFloat(getComputedStyle(rn).paddingLeft) - r(campo).left).toFixed(1),
  };
});
checar(acab.fica === false && Math.abs(acab.centroTit) <= 2 && acab.pontas.length === 2
    && acab.pontas.every((p) => p.mesmaLinha && p.aDireita) && acab.nomeRecuo >= 10,
  'C · sem "fica com…", tempo À DIREITA do rótulo, "Trecho" centrado e o rótulo do nome com recuo (não colado à borda do card)',
  JSON.stringify(acab));

// as pontas não se cruzam: o início nunca passa de fim − 1 s
await mexer(app, 5.5, null);
const trava = await estado(app);
checar(+trava.ini <= 5 && +trava.fim === 6, 'C · a ponta de início não passa do fim (sobra ao menos 1 s)', JSON.stringify(trava));

await mexer(app, 2, 5);
await marca(app, 'Fade de saída');
await nomear(app, 'Hino Cinco sem a introdução');
const habil = await esperar(app, () => !document.getElementById('edicaoConfirmar').disabled, null, 5000);
checar(habil === true, 'C · ajustar qualquer coisa acende "Confirmar"', porque(habil));
// O FECHO é o "Confirmar" que cresce + os três quadrados, na ordem da tabela de destinos.
const fecho = await app.evaluate(() => {
  const f = document.getElementById('edicaoFechoForm');
  const c = document.getElementById('edicaoConfirmar').getBoundingClientRect();
  const q = [...f.querySelectorAll('.sorteio-dest')];
  const r = q.map((b) => b.getBoundingClientRect());
  return { dest: q.map((b) => b.dataset.dest), desabilitado: q.map((b) => b.disabled),
    quadrados: r.every((x) => Math.abs(x.width - x.height) < 1.5), larg: r.map((x) => Math.round(x.width)),
    direita: r.every((x) => x.left >= c.right - 1), confirmaMaior: c.width > 2 * r[0].width,
    rotulo: document.querySelector('#edicaoConfirmar .song-menu-label').textContent };
});
checar(fecho.dest.join() === 'cronograma,playlist,favoritos' && fecho.quadrados && fecho.direita && fecho.confirmaMaior
    && fecho.rotulo === 'Confirmar' && fecho.desabilitado.every((d) => d === false),
  'C · o fecho é "Confirmar" (que cresce) + os quadrados Cronograma · playlist · favoritos À DIREITA, acesos com a edição',
  JSON.stringify(fecho));

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
  'C · "Confirmar" (item novo) pergunta ONDE guardar e cria no Cronograma, com o trecho e a marca de saída', JSON.stringify([c1, noCrono]));
checar(noCrono.avulsoVazio, 'C · o item não fica na prateleira avulsa (só nos destinos escolhidos)');
const depois = await estado(app);
const rascDepois = await app.evaluate(() => window.AVDB.getState('edicaoRascunho'));
checar(depois.ini === '2' && depois.fim === '5' && depois.nome === 'Hino Cinco sem a introdução'
    && rascDepois && rascDepois.origem && rascDepois.editandoId,
  'C · depois de criar o formulário e o rascunho PERSISTEM, agora sobre o item NOVO (rascunho com `editandoId`): o próximo "Confirmar" o atualiza',
  JSON.stringify([depois, rascDepois]));

// C5 · EDITAR UM ITEM JÁ EDITADO É NO LUGAR (v1.12.6): o mesmo item, em TODAS as listas onde está.
const idEditado = await app.evaluate(async () => {
  const it = (await window.AVDB.listItems('imports')).find((m) => m.name === 'Hino Cinco sem a introdução');
  await window.AVDB.listAdd('favs', it.id);                    // o mesmo item no Cronograma E nos Favoritos
  return it.id;
});
await app.click('#edicaoLista .pacote-linha .song-menu-btn');   // o card: troca de mídia
await esperar(app, () => document.getElementById('edicaoTitulo').textContent === 'Escolher a mídia', null, 10000);
const c5a = await escolher('lst:imports', 'Hino Cinco sem a introdução');
const parte = await estado(app);
const emEdicao = await app.evaluate(() => ({
  rotuloNome: document.querySelector('#edicaoLista .edicao-bloco .edicao-rotulo:last-of-type') && null,
  nomeLabel: [...document.querySelectorAll('#edicaoLista .edicao-rotulo')].map((e) => e.textContent).filter((t) => /Nome/.test(t))[0],
  confirmar: document.getElementById('edicaoConfirmar').disabled,
  card: document.querySelector('#edicaoLista .edicao-card .song-menu-label').textContent,
}));
checar(c5a === true && parte.ini === '2' && parte.fim === '5' && parte.fo === true && parte.nome === 'Hino Cinco sem a introdução'
    && emEdicao.nomeLabel === 'Nome do item' && emEdicao.confirmar === true && emEdicao.card === 'Hino Cinco sem a introdução',
  'C · escolher um item JÁ EDITADO o abre PARA EDITAR (com o nome dele, "Confirmar" apagado até mudar algo)', porque(c5a) || JSON.stringify([parte, emEdicao]));
await mexer(app, null, 4);
await nomear(app, 'Hino Cinco curto');
const nada = await app.evaluate(() => document.getElementById('edicaoConfirmar').disabled);
await app.click('#edicaoConfirmar');
const salvou = await esperarDb(app, async (id) => { const m = await window.AVDB.getMediaCru(id); return !!m && m.edicao && m.edicao.fim === 4; }, idEditado, 15000);
const noLugar = await app.evaluate(async (id) => {
  const imp = await window.AVDB.listItems('imports');
  const fav = await window.AVDB.listItems('favs');
  const a = imp.find((m) => m.id === id), b = fav.find((m) => m.id === id);
  return { mesmoId: !!a && !!b, nomeA: a && a.name, nomeB: b && b.name, fimA: a && a.edicao.fim, fimB: b && b.edicao.fim,
    secA: a && a.seconds, antigo: imp.some((m) => m.name === 'Hino Cinco sem a introdução'),
    quantos: imp.filter((m) => m.edicao).length,
    outrosFavs: fav.filter((m) => m.edicao).length };
}, idEditado);
checar(nada === false && salvou === true && noLugar.mesmoId && noLugar.nomeA === 'Hino Cinco curto' && noLugar.nomeB === 'Hino Cinco curto'
    && noLugar.fimA === 4 && noLugar.fimB === 4 && noLugar.secA === 2 && !noLugar.antigo && noLugar.quantos === 1 && noLugar.outrosFavs === 1,
  'C · "Confirmar" num item JÁ EDITADO o atualiza NO LUGAR: o mesmo id muda no Cronograma E nos Favoritos (fim 4 s, nome novo) e NENHUM item novo nasce',
  porque(salvou) || JSON.stringify([nada, noLugar]));
await esperar(app, () => { const l = document.querySelector('#edicaoLista .edicao-card .song-menu-label'); return !!l && l.textContent === 'Hino Cinco curto' && document.getElementById('edicaoConfirmar').disabled; }, null, 10000);
const aposSalvar = await app.evaluate(() => ({ confirmar: document.getElementById('edicaoConfirmar').disabled,
  card: document.querySelector('#edicaoLista .edicao-card .song-menu-label').textContent }));
checar(aposSalvar.confirmar === true && aposSalvar.card === 'Hino Cinco curto',
  'C · depois de salvar o formulário segue no item (card com o nome novo) e o "Confirmar" apaga de novo', JSON.stringify(aposSalvar));

// C5b · O ITEM SUMIU: o "Confirmar" não inventa — avisa e passa a criar um novo.
const sumiu = await app.evaluate(async (id) => {
  const A = window.AVDB;
  const r = await A.atualizarEdicao('id-que-nao-existe', { inicio: 1, fim: 3 });
  const dobra = await A.atualizarEdicao(id, { inicio: 3, fim: 3.2 });          // trecho vazio
  const cru = await A.getMediaCru(id);
  return { r, dobra, intacto: cru.edicao.inicio === 2 && cru.edicao.fim === 4 };
}, idEditado);
checar(sumiu.r === null && sumiu.dobra === null && sumiu.intacto,
  'C · `atualizarEdicao` recusa id inexistente e trecho vazio — e nada é gravado', JSON.stringify(sumiu));

// (o item sai dos Favoritos: os blocos abaixo contam o que há nos Favoritos)
await app.evaluate((id) => window.AVDB.listRemove('favs', id), idEditado);

// C5c · O X VERMELHO NO CARD cancela a edição: à direita do próprio card, e o toque no card NÃO cancela.
const xi = await app.evaluate(() => {
  const card = document.querySelector('#edicaoLista .edicao-card').getBoundingClientRect();
  const x = document.querySelector('#edicaoLista .edicao-card .edicao-x');
  const r = x.getBoundingClientRect();
  const cor = getComputedStyle(x);
  return { dentro: r.right <= card.right + 0.5 && r.left > card.left + card.width / 2, centrado: Math.abs((r.top + r.bottom) / 2 - (card.top + card.bottom) / 2) < 1.5,
    quadrado: Math.abs(r.width - r.height) < 1, fundo: cor.backgroundColor, tinta: cor.color,
    semDescartar: !document.getElementById('edicaoDescartar') };
});
const tintaVermelha = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c); return !!m && +m[1] > +m[2] + 20 && +m[1] > +m[3] + 20; };
checar(xi.dentro && xi.centrado && xi.quadrado && tintaVermelha(xi.tinta) && xi.semDescartar,
  'C · o X vermelho mora no CANTO DIREITO do card do item (quadrado, centrado), e o botão "Descartar" não existe mais', JSON.stringify(xi));

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
  return { achou: !!b, emLista, segura: !!(b && await window.AVDB.getMediaCru(b.id)) };
});
checar(importou === true && imp.achou && imp.emLista.length === 0 && imp.segura,
  'C · "Importar arquivo" traz o arquivo SÓ para o editor (fora de toda lista) e o rascunho o segura contra o coletor',
  porque(importou) || JSON.stringify(imp));
// descartado e sem edição, o importado volta a ser coletável
// clique e leitura no MESMO turno síncrono: o spinner dura ~1 s e, em dois turnos, um runner lento já o tinha tirado
const cargaTudo = await app.evaluate(async () => {
  document.querySelector('#edicaoLista .edicao-card .edicao-x').click();
  // o spinner entra um quadro depois do clique: leitura quadro a quadro, no instante em que ele aparece
  const ate = performance.now() + 1500;
  while (!document.querySelector('#edicaoLista .edicao-carga .edicao-spin') && performance.now() < ate) {
    await new Promise((r) => requestAnimationFrame(r));
  }
  const c = document.querySelector('#edicaoLista .edicao-carga');
  const sp = c && c.querySelector('.edicao-spin');
  return {
    spinner: !!document.querySelector('#edicaoLista .edicao-carga .edicao-spin'),
    vazio: !!document.querySelector('#edicaoLista .empty'),
    texto: c ? c.textContent.trim() : null,
    w: sp ? Math.round(sp.getBoundingClientRect().width) : 0,
  };
});
const carga = { spinner: cargaTudo.spinner, vazio: cargaTudo.vazio };
const cargaMed = { texto: cargaTudo.texto, w: cargaTudo.w };
checar(cargaMed.texto === '' && cargaMed.w >= 56,
  'C · o spinner da carga não leva texto explicativo e é grande (≥ 56px; eram 32)', JSON.stringify(cargaMed));
checar(carga.spinner && !carga.vazio,
  'C · voltando ao seletor pelo X do card, aparece o SPINNER de carga e não a lista vazia piscando', JSON.stringify(carga));
const listou = await esperar(app, () => !document.querySelector('#edicaoLista .edicao-carga')
  && !!document.querySelector('#edicaoLista [data-grupo="lst:imports"]'), null, 10000);
checar(listou === true, 'C · e passada a carga a lista dos grupos aparece', porque(listou));
await app.click('#edicaoLista [data-grupo="lst:imports"] > .song-menu-grupo').catch(() => {});
const semCheck = await app.evaluate(() => document.querySelectorAll('#edicaoLista .pacote-grupo-corpo .song-menu-check').length);
checar(semCheck === 0, 'C · as linhas do seletor NÃO têm caixa de marcação (é escolha de um item, toque e pronto)', String(semCheck));
const solto = await app.evaluate(async () => {
  await window.AVDB.gcOrfaos();
  return (await window.AVDB.basesDoEditor()).some((x) => x.name === 'Trilha Externa');
});
checar(solto === false, 'C · descartar sem criar nada solta o arquivo importado (o coletor o leva, não vaza)', String(solto));

// C2d · ALTURA E CARD ESTÁVEIS (v1.12.9): a folha tem a altura do FORMULÁRIO (sem vão sobrando abaixo do
// campo de nome), o seletor a reusa, e o card do item NÃO muda de altura com um título comprido — o texto
// rola em ping-pong em vez de quebrar a linha.
await esperar(app, () => !!document.querySelector('#edicaoLista [data-grupo="lst:imports"]'), null, 10000);
const curtoCard = await app.evaluate(() => document.querySelector('#edicaoLista .edicao-card') ? document.querySelector('#edicaoLista .edicao-card').getBoundingClientRect().height : 0);
const alturaLista = await app.evaluate(() => document.querySelector('#edicaoPopup .popup-sheet').getBoundingClientRect().height);
const longoNome = 'Louvor com um nome tão comprido que jamais caberia na largura do card do item';
const longoOk = await escolher('lst:imports', longoNome);
const longo = await app.evaluate(() => {
  const L = document.getElementById('edicaoLista');
  const card = L.querySelector('.edicao-card').getBoundingClientRect();
  const nome = L.querySelector('.edicao-bloco:last-of-type').getBoundingClientRect();
  const fecho = document.querySelector('#edicaoPopup .popup-fecho').getBoundingClientRect();
  const folha = document.querySelector('#edicaoPopup .popup-sheet').getBoundingClientRect();
  const lab = L.querySelector('.edicao-card .song-menu-label');
  const ro = L.querySelector('.edicao-card .edicao-rolante');
  return { card: +card.height.toFixed(1), vao: +(fecho.top - nome.bottom).toFixed(1), folha: +folha.height.toFixed(1),
    rolando: !!(ro && ro.classList.contains('edicao-rolando')), animado: ro ? getComputedStyle(ro).animationName : '', uma: lab.getBoundingClientRect().height < 40 };
});
checar(longoOk === true && longo.rolando === true && longo.animado === 'np-marquee' && longo.uma === true && Math.abs(longo.card - 53.2) < 6,
  'C · com um título comprido o card segue de UMA linha (mesma altura) e o texto ROLA em ping-pong', porque(longoOk) || JSON.stringify(longo));
checar(longo.vao <= 40, 'C · a folha acompanha o formulário: sem espaço sobrando entre o campo de nome e a base (≤ 40px)', JSON.stringify(longo));
await app.evaluate(() => document.querySelector('#edicaoLista .edicao-card .edicao-x').click());
await esperar(app, () => !document.querySelector('.edicao-carga') && !!document.querySelector('#edicaoLista [data-grupo]'), null, 10000);
const lista2 = await app.evaluate(() => document.querySelector('#edicaoPopup .popup-sheet').getBoundingClientRect().height);
checar(Math.abs(lista2 - longo.folha) <= 2,
  'C · o seletor tem a MESMA altura do formulário (os botões da base não andam entre as vistas)', JSON.stringify({ lista2, form: longo.folha, antes: alturaLista, curtoCard }));

// C7 · BUSCA no seletor
await esperar(app, () => !document.querySelector('.edicao-carga') && !!document.querySelector('#edicaoLista [data-grupo]'), null, 10000);
await app.fill('#edicaoBusca', 'curto');
const achados = await app.evaluate(() => [...document.querySelectorAll('#edicaoLista .song-menu-label')].map((e) => e.textContent).filter((t) => /Hino/.test(t)));
checar(achados.length === 1 && achados[0] === 'Hino Cinco curto', 'C · a busca filtra as linhas pelo nome (e abre os grupos que casam)', JSON.stringify(achados));

// C7b · "Só o áudio" também para um item da BIBLIOTECA (áudio com letra): tira a letra e o fundo.
await app.evaluate(async (b64) => {
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const A = window.AVDB;
  await A.opfsWriteFile('folders/hinC/1.wav', new Blob([u], { type: 'audio/wav' }));
  await A.fileAdd({ id: 'cat-letra', folder: 'hinC', opfsPath: 'folders/hinC/1.wav', name: 'Hino Letra',
    type: 'audio/wav', kind: 'audio', size: u.length, seconds: 6, blob: null, url: null,
    lyrics: [{ time: 0, text: 'a' }, { time: 3, text: 'b' }] });
}, wav);
await app.fill('#edicaoBusca', '');
await app.evaluate(() => document.getElementById('edicaoPopupClose').click());
await abrir();
await esperar(app, () => !document.querySelector('.edicao-carga') && !!document.querySelector('#edicaoLista [data-grupo="col:hinC"]'), null, 10000);
const c7 = await escolher('col:hinC', 'Hino Letra');
const soA = await app.evaluate(() => [...document.querySelectorAll('#edicaoLista .song-menu-label')].some((e) => e.textContent === 'Só o áudio'));
checar(c7 === true && soA, 'C · um item da biblioteca com letra oferece "Só o áudio"', porque(c7));
await marca(app, 'Só o áudio');
await nomear(app, 'Hino Letra cantado');
await criarEGuardar(app);
const semLetra = await app.evaluate(async () => {
  const todos = await window.AVDB.listItems('imports');
  const it = todos.find((m) => m.name === 'Hino Letra cantado');
  return it && { lyrics: it.lyrics, so: it.edicao.soAudio };
});
checar(semLetra && semLetra.so === true && semLetra.lyrics === null,
  'C · e o item criado projeta só o áudio: sem letra e sem fundo', JSON.stringify(semLetra));

// C7c · OS QUADRADOS DE DESTINO: enviam direto, sem a pergunta de destino.
//  · sobre um item JÁ EDITADO (o que acabou de ser criado): põe o MESMO item na lista — nenhum item novo;
//  · sobre o ORIGINAL (item novo): cria o item e o põe SÓ naquela lista.
const quad = await app.evaluate(async () => {
  document.querySelector('#edicaoFechoForm .sorteio-dest[data-dest="playlist"]').click();
  await new Promise((r) => setTimeout(r, 800));
  const A = window.AVDB;
  const pl = await A.listItems('playlist');
  const imp = await A.listItems('imports');
  const it = imp.find((m) => m.name === 'Hino Letra cantado');
  return { naPlaylist: pl.filter((m) => m.name === 'Hino Letra cantado').length, mesmoId: !!it && pl.some((m) => m.id === it.id),
    folha: document.getElementById('songMenuPopup').classList.contains('open'),
    quantos: imp.filter((m) => m.name === 'Hino Letra cantado').length };
});
checar(quad.naPlaylist === 1 && quad.mesmoId && quad.quantos === 1 && quad.folha === false,
  'C · o quadrado "playlist" sobre um item JÁ EDITADO põe o MESMO item na playlist (sem pergunta de destino e sem item novo)', JSON.stringify(quad));
await app.evaluate(() => document.querySelector('#edicaoLista .edicao-card .edicao-x').click());
await esperar(app, () => !document.querySelector('.edicao-carga') && !!document.querySelector('#edicaoLista [data-grupo="col:hinC"]'), null, 10000);
const c7d = await escolher('col:hinC', 'Hino Letra');
await marca(app, 'Fade de entrada');
await nomear(app, 'Hino Letra só nos favoritos');
await app.evaluate(() => document.querySelector('#edicaoFechoForm .sorteio-dest[data-dest="favoritos"]').click());
const quad2 = await esperar(app, () => [...document.querySelectorAll('#edicaoLista .edicao-rotulo')].some((e) => e.textContent === 'Nome do item'), null, 15000);
const so = await app.evaluate(async () => {
  const A = window.AVDB; const onde = [];
  for (const l of ['imports', 'playlist', 'favs', 'avulsos']) {
    if ((await A.listItems(l)).some((m) => m.name === 'Hino Letra só nos favoritos')) onde.push(l);
  }
  return { onde, nomeLabel: [...document.querySelectorAll('#edicaoLista .edicao-rotulo')].map((e) => e.textContent).filter((t) => /Nome/.test(t))[0] };
});
checar(c7d === true && quad2 === true && so.onde.join() === 'favs' && so.nomeLabel === 'Nome do item',
  'C · o quadrado "favoritos" sobre o ORIGINAL cria o item SÓ nos favoritos, e o formulário passa a editar esse item', porque(quad2) || JSON.stringify(so));
// (limpa o que os dois blocos acima deixaram nos Favoritos: o bloco D conta o que há neles)
await app.evaluate(async () => {
  const A = window.AVDB;
  for (const m of await A.listItems('favs')) if (m.edicao) await A.listRemove('favs', m.id);
  for (const m of await A.listItems('playlist')) if (m.edicao) await A.listRemove('playlist', m.id);
});

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
const semQuad = await facil.evaluate(() => {
  edicaoAtualizarBotoes(null);              // o que o desenho do formulário faz a cada passada
  const q = [...document.querySelectorAll('#edicaoFechoForm .sorteio-dest')];
  return { n: q.length, escondidos: q.every((b) => b.hidden === true) };
});
checar(semQuad.n === 3 && semQuad.escondidos,
  'C · no Modo Fácil os quadrados de destino NÃO aparecem (não há Cronograma nem favoritos à vista): só o "Confirmar"', JSON.stringify(semQuad));
await ctx4.close();


// =========================================================================
// D · O ORIGINAL É SEMPRE VINCULADO — hinário, vídeo baixado, exportação
// =========================================================================
// D1 · o original do CATÁLOGO (hinário/pasta) sobrevive à exclusão da coleção — e com os BYTES
// LEGÍVEIS (v1.12.22): o `File` do OPFS gravado no IndexedDB vai POR REFERÊNCIA, e apagada a pasta o
// `size` continua certo enquanto o `arrayBuffer()` lança `NotFoundError`. Por isso aqui se LÊ.
const d1 = await app.evaluate(async (b64) => {
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const A = window.AVDB;
  // Os bytes como o palco os acha: blob, ou o arquivo do `opfsPath`. `null` = ilegível.
  const ler = async (r) => {
    try {
      const c = r && (r.blob || (r.opfsPath ? await A.opfsGetFile(r.opfsPath) : null));
      if (!c) return null;
      const ab = new Uint8Array(await c.arrayBuffer());
      return ab.length === u.length && ab.every((x, i) => x === u[i]);
    } catch (e) { return null; }
  };
  const existe = async (caminho) => { try { await A.opfsGetFile(caminho); return true; } catch (_) { return false; } };
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
  const legivel = await ler(lido);
  const emLista = [];
  for (const l of ['imports', 'playlist', 'favs', 'avulsos']) if ((await A.listIds(l)).includes('cat-hino-1')) emLista.push(l);
  const base = await A.getMediaCru('cat-hino-1');
  // a exportação do pacote: o original viaja com bytes LEGÍVEIS (não o blob morto)
  const plano = await window.pacotePlano();
  const exp = (await window.pacoteBases(plano, new Set(['lst:favs']))).find((b) => b.rec.id === 'cat-hino-1');
  const exportaLegivel = exp ? await ler({ blob: exp.corpo }) : 'não exportou';
  const caminhoBase = base && base.opfsPath;
  const outrosTemBase = [...plano.porGrupo.values()].some((g) => g.arquivos.some((a) => a.caminho === caminhoBase));
  await window.AVDB.listRemove('favs', ed.id);      // o último lugar do editado
  await A.gcOrfaos();
  const arquivoNaCarencia = caminhoBase ? await existe(caminhoBase) : null;
  // passada a carência de uma adoção em curso (o relógio do coletor adiantado dois minutos)
  const relogio = Date.now;
  Date.now = () => relogio() + 120000;
  try { await A.gcOrfaos(); } finally { Date.now = relogio; }
  return { legivel, seconds: lido && lido.seconds,
    letra: lido && lido.lyrics.map((l) => l.time), fileSumiu: !(await A.fileGet('cat-hino-1')),
    baseNaMedia: !!(base && base.base && !base.folder), emLista, caminhoBase,
    exportaLegivel, outrosTemBase,
    baseColetada: !(await A.getMediaCru('cat-hino-1')), arquivoNaCarencia,
    arquivoColetado: caminhoBase ? !(await existe(caminhoBase)) : null };
}, wav);
checar(d1.fileSumiu && d1.legivel === true && d1.seconds === 4,
  'D · excluir a coleção do hinário NÃO tira o original do item editado: ele continua tocável, e os bytes se LEEM depois de a pasta sumir',
  JSON.stringify(d1));
checar(d1.exportaLegivel === true && !d1.outrosTemBase,
  'D · e o pacote exporta o original adotado com bytes legíveis, só pelo vínculo (não como "arquivo sem coleção")', JSON.stringify(d1));
checar(d1.baseNaMedia && d1.emLista.length === 0,
  'D · e o original passa a ser interno: fora de toda lista, invisível para o operador', JSON.stringify(d1));
checar(d1.baseColetada && d1.arquivoNaCarencia === true && d1.arquivoColetado === true,
  'D · sem o item editado em lugar nenhum, o original interno é coletado — o registro e, pelo MESMO `gcOrfaos`, o ARQUIVO dele no OPFS (passada a carência)',
  JSON.stringify(d1));

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
