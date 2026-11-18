#!/usr/bin/env node
// ============================================================================
// O PACOTE DE UM CULTO — "Enviar" na gaveta dos cronogramas (`exportarCulto`)
//
// Chromium com PONTE FALSA (o padrão do `pacote-ida-e-volta`), vários contextos como
// vários celulares. Prova:
//   A · o pacote leva o cronograma (UM, sem `ativo`), os momentos e SÓ as mídias dele:
//       a mídia de outro cronograma não viaja, nem chave de preferência, nem a
//       `itinerario`; o arquivo de coleção leva catálogo + áudio + fundo da letra, e o
//       original escondido de um editado vai como `base`.
//   B · o `info` JSON (`escopo:'culto'`, `capas: n`) e um `info` de CAPA PNG por página,
//       em ordem (AVCapa real; stub de 3 páginas; queda para `desenhar`); sem capa quando
//       ele falha — e o envio não falha por isso.
//   C · importado num aparelho LIMPO e num que já tem OUTRO ativo (e um guardado de mesmo
//       nome, e as marcas do Transferir tiradas): vira um guardado NOVO, o ativo intocado,
//       nada substituído.
//   D · COMPATIBILIDADE: o pacote com os `info` de capa (1 e 3 páginas) passa por `pacoteConferir` +
//       `pacoteAplicarFluxo` crus (o caminho de um app de hoje, que pula `info`).
//   E · `pacoteLerCapa`: `{ info, capas }` com 1 e 3 páginas em ordem, `[]` sem, nulos no lixo.
//   F · o botão na gaveta: entre o nome e o excluir, desabilitado com cronograma vazio,
//       e o nome não espremido a 360 px.
//
//   node tools/pacote-culto.test.mjs
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperar, checar, falhas, comModoAvancado } from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const g_ = { TextEncoder, TextDecoder, Blob };
new Function(fs.readFileSync(path.join(RAIZ, 'controle', 'pacote.js'), 'utf8')).call(g_);
const P = g_.AVPacote;

let pacoteServido = null;
const servidor = servirEstatico(RAIZ, (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname !== '/pacote-de-teste') return false;
  if (!pacoteServido) { res.writeHead(404).end('sem pacote'); return true; }
  const m = /^(\d+)-(\d+)$/.exec(u.searchParams.get('r') || '');
  if (!m) { res.writeHead(416).end('sem faixa'); return true; }
  const fatia = pacoteServido.subarray(Number(m[1]), Math.min(pacoteServido.length, Number(m[2]) + 1));
  res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(Buffer.from(fatia));
  return true;
});

// A PONTE (SEM CRASE dentro do template). O canal guarda os blocos em __saida.
const PONTE = `(function () {
  window.__saida = [];
  window.__chamadas = [];
  const total = () => { let t = 0; for (const p of window.__saida) t += p.length; return t; };
  const canal = {
    postMessage(m) {
      if (typeof m === 'string') {
        setTimeout(() => canal.onmessage({ data: JSON.stringify({ ok: true }) }), 0);
        return;
      }
      window.__saida.push(new Uint8Array(m));
      setTimeout(() => canal.onmessage({ data: JSON.stringify({ r: total() }) }), 0);
    },
    onmessage: null,
  };
  window.__avPacote = canal;
  const vazio = { displays: [], listFolder: [], otaPending: '', otaDiag: '',
    espelhoEstado: { ligado: false, telas: [], redes: [] }, espelhoDiag: {},
    castTarget: { label: '' }, apkProcurar: {}, ytDiag: '', cifraDiag: '',
    farolEstado: { conta: true, ultimo: 0, diag: 'de teste' } };
  const comCallId = new Set(['espelhoLigar','displays','listFolder','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','castTarget','saidaDeAudioAlvo',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','apkProcurar','otaPending','otaApply',
    'otaCheck','otaDiag','ytDiag','cifraDiag','farolEstado','ytCanalPlaylists','ytPlaylist',
    'ytDetalhes','areaTransferencia','salvarTexto','pacoteDiag','cifraHtml','apkInstalar',
    'espelhoCertImportar','espelhoCertApagar']);
  const R = (id, v) => setTimeout(() => window.__avResolve(id, v), 0);
  const B = {
    shellVersion: () => 63,
    role: () => 'controle',
    appVersion: () => '9.99-teste',
    takeShare: (id) => R(id, ''),
    busPost: () => {},
    bgProgress: () => {},
    otaConfirm: () => {},
    compartilharTexto: () => {},
    pacoteCancelar: () => { window.__chamadas.push('cancelar'); },
    pacoteEspaco: (id) => { window.__chamadas.push('espaco'); R(id, 1e12); },
    pacoteCriar: (id, nome) => { window.__chamadas.push('criar:' + nome); R(id, nome); },
    pacoteCriarLocal: (id, nome) => { window.__chamadas.push('criarLocal:' + nome); R(id, nome); },
    pacoteFechar: (id) => { window.__chamadas.push('fechar'); R(id, total()); },
    pacoteCompartilhar: (id) => { window.__chamadas.push('compartilhar'); R(id, total()); },
    pacoteProntoEstado: (id) => R(id, null),
    pacoteConsumirOrigem: (id) => R(id, ''),
    pickDoc: (id) => {
      const tam = window.__tamEntrada;
      R(id, typeof tam === 'number'
        ? [{ url: '/pacote-de-teste', name: 'culto.avpkg', type: '', size: tam }] : []);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','captureVolumeKeys','castTarget','saidaDeAudioAlvo',
    'deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar','espelhoCertEstado',
    'espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado','espelhoLigar',
    'keepAlive','listFolder','nowPlaying','openCast','abrirSaidaDeAudio','openExternal','otaApply','otaCheck',
    'otaDiag','otaPending','pickFolder','systemVolume','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio',
    'ytPlaylist','ytSearch','ytStream','farolEstado','projecaoLocal','cifraHtml',
    'cifraDiag','areaTransferencia','salvarTexto','pacoteDiag','ytDetalhes','pacoteDescartarPronto'];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      if (!comCallId.has(n)) return undefined;
      const id = args[0];
      if (typeof id === 'string') R(id, Object.prototype.hasOwnProperty.call(vazio, n) ? vazio[n] : null);
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY|ERR_FAILED|Failed to load resource/;

async function aparelho(entrada) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
  await semRedeExterna(ctx);
  await comModoAvancado(ctx);
  const pg = await ctx.newPage();
  pg.avisos = [];
  pg.on('console', (m) => {
    if (m.type() === 'warning') pg.avisos.push(m.text());
    if (m.type() !== 'error' || EXTERNO.test(m.text())) return;
    erros.push(m.text());
  });
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.addInitScript(PONTE);
  if (entrada) await pg.addInitScript(`window.__tamEntrada = ${entrada.length};`);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperar(pg, () => !document.getElementById('splash') && !!window.AVDB, null, 30000);
  return { ctx, pg };
}
async function recarregar(pg) {
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await esperar(pg, () => !document.getElementById('splash') && !!window.AVDB, null, 30000);
}
async function saidaDe(pg) {
  return Uint8Array.from(await pg.evaluate(() => {
    const out = [];
    for (const p of window.__saida) for (const b of p) out.push(b);
    return out;
  }));
}
function registros(u8) {
  const out = [];
  let pos = P.ASSINATURA_BYTES;
  while (pos < u8.length) {
    const n = P.tamanhoDoCabecalho(u8.subarray(pos, pos + P.PREFIXO_BYTES));
    const cab = P.cabecalhoDeBytes(u8.subarray(pos + P.PREFIXO_BYTES, pos + P.PREFIXO_BYTES + n));
    const ini = pos + P.PREFIXO_BYTES + n;
    out.push({ cab, corpo: u8.subarray(ini, ini + cab.bytes) });
    pos = ini + cab.bytes;
  }
  return out;
}
const txt = (u8) => new TextDecoder().decode(u8);
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ehPng = (u8) => u8.length > 8 && PNG.every((b, i) => u8[i] === b);

async function importar(pg, bytes) {
  pacoteServido = bytes;
  await pg.evaluate(() => { window.__fim = importarPacote(); });
  const abriu = await esperar(pg, () => {
    const d = document.getElementById('appDialog');
    return !!d && d.classList.contains('open');
  }, null, 60000);
  const msg = await pg.evaluate(() => (document.getElementById('appDialogMsg') || {}).textContent || '');
  const titulo = await pg.evaluate(() => (document.getElementById('appDialogTitle') || {}).textContent || '');
  if (abriu === true) await pg.click('#appDialogOk');
  await pg.evaluate(() => window.__fim).catch(() => {});
  return { abriu, msg, titulo };
}
const estadoCronos = (pg) => pg.evaluate(async () => ({
  lido: await AVDB.getState('cronogramas'),
  gaveta: await AVDB.cronoLer(),
  imports: await AVDB.listIds('imports'),
}));

try {
  // =========================================================================
  // O APARELHO DE ORIGEM: "Culto Sábado" (ativo) com um momento, uma mídia, um hino
  // de coleção (com fundo de letra) e um trecho editado; "Outro" (guardado) com uma
  // mídia que NÃO pode viajar; "Vazio" sem nada; e preferências que também não.
  // =========================================================================
  const A = await aparelho(null);
  const ids = await A.pg.evaluate(async () => {
    const bl = (n, v, t) => new Blob([new Uint8Array(n).fill(v)], { type: t });
    const rec = (id, name, extra) => Object.assign({
      id, name, kind: 'audio', type: 'audio/mp4', blob: bl(3000, 7, 'audio/mp4'),
      thumb: bl(40, 9, 'image/jpeg'), url: null, pages: null, videos: null, cue: null, data: null,
      youtubeId: null, height: null, seconds: 12, canal: null, createdAt: 1,
    }, extra || {});
    await AVDB.mediaAdd(rec('mid-a', 'Hino de abertura'));
    await AVDB.mediaAdd(rec('mid-outro', 'Do outro culto', { blob: bl(5000, 2, 'audio/mp4') }));
    await AVDB.mediaAdd(rec('mid-orig', 'Original escondido', { blob: bl(2500, 4, 'audio/mp4') }));
    await AVDB.mediaAdd(rec('mid-edit', 'Trecho editado', {
      blob: null, thumb: null, edicao: { origem: 'mid-orig', inicio: 0, fim: 5 } }));
    await AVDB.opfsWriteFile('folders/hinario/001.m4a', bl(1200, 3, 'audio/mp4'));
    await AVDB.opfsWriteFile('folders/hinario/001-fundo.jpg', bl(500, 5, 'image/jpeg'));
    await AVDB.opfsWriteFile('folders/hinario/002.m4a', bl(1300, 6, 'audio/mp4'));
    await AVDB.fileAdd({ id: 'arq-hino', folder: 'hinario', opfsPath: 'folders/hinario/001.m4a',
      srcName: '001', name: '001 — Hino', type: 'audio/mp4', kind: 'audio', size: 1200,
      thumb: null, blob: null, url: null, addedAt: 1,
      lyrics: [{ time: 0, text: 'estrofe', imageOpfsPath: 'folders/hinario/001-fundo.jpg' }] });
    await AVDB.fileAdd({ id: 'arq-002', folder: 'hinario', opfsPath: 'folders/hinario/002.m4a',
      srcName: '002', name: '002 — Outro', type: 'audio/mp4', kind: 'audio', size: 1300,
      thumb: null, blob: null, url: null, addedAt: 1 });
    await AVDB.addCue('momento', { min: 600 }, { name: 'Abertura', list: 'imports' });
    for (const id of ['mid-a', 'arq-hino', 'mid-edit']) await AVDB.listAdd('imports', id);
    await AVDB.setState('cronogramas', { ativo: 'cr-a', itens: [
      { id: 'cr-a', nome: 'Culto Sábado', ids: [], usado: 0 },
      { id: 'cr-b', nome: 'Outro', ids: ['mid-outro'], usado: 0 },
      { id: 'cr-v', nome: 'Vazio', ids: [], usado: 0 },
    ] });
    await AVDB.setState('lyricsFont', 'grande-de-teste');
    await AVDB.setState('bibleVersion', 'versao-de-teste');
    await AVDB.setState('itinerario', { v: 3, horas: false, desloc: 15, deslocDia: '2026-11-18' });
    return AVDB.listIds('imports');
  });
  await recarregar(A.pg);
  const momentoId = ids[0];

  // ===== F · O BOTÃO NA GAVETA =====
  await A.pg.setViewportSize({ width: 360, height: 900 });
  await A.pg.click('#cronoTitulo');
  await esperar(A.pg, () => document.getElementById('cronoGaveta').classList.contains('aberta'));
  await A.pg.waitForTimeout(350);
  const gav = await A.pg.evaluate(() => [...document.querySelectorAll('#cronoLista .crono-item')].map((li) => {
    const r = (s) => li.querySelector(s).getBoundingClientRect();
    const env = li.querySelector('.crono-enviar');
    const nm = li.querySelector('.crono-item-nome');
    const filhos = [...li.children].map((x) => x.className.split(' ').find((c) => c.startsWith('crono-')));
    return {
      nome: nm.textContent, filhos, disabled: env.disabled, hidden: env.hidden,
      title: env.title, aria: env.getAttribute('aria-label'), svg: !!env.querySelector('svg use[href="#icoCompartilhar"]'),
      larguraNome: r('.crono-trocar').width, cortado: nm.scrollWidth > nm.clientWidth + 1,
      ordem: r('.crono-renomear').right <= r('.crono-trocar').left + 0.5
        && r('.crono-trocar').right <= r('.crono-enviar').left + 0.5
        && r('.crono-enviar').right <= r('.crono-excluir').left + 0.5,
      quadrado: Math.abs(r('.crono-enviar').width - r('.crono-excluir').width) < 0.5
        && Math.abs(r('.crono-enviar').height - r('.crono-excluir').height) < 0.5,
      icone: r('.crono-enviar svg').width,
    };
  }));
  const linha = (n) => gav.find((x) => x.nome === n) || {};
  checar(gav.length === 3 && gav.every((l) => l.filhos.join(',') === 'crono-renomear,crono-trocar,crono-enviar,crono-excluir'),
    'F · cada linha da gaveta: renomear | nome+conta | ENVIAR | excluir', JSON.stringify(gav.map((l) => l.filhos)));
  checar(!linha('Culto Sábado').disabled && !linha('Outro').disabled && linha('Vazio').disabled
    && gav.every((l) => !l.hidden && l.svg),
  'F · o enviar aparece (app nativo) com o desenho de compartilhar, e está DESABILITADO só no cronograma vazio',
  JSON.stringify(gav.map((l) => [l.nome, l.disabled, l.hidden, l.svg])));
  checar(linha('Culto Sábado').title === 'Enviar “Culto Sábado”' && linha('Culto Sábado').aria === linha('Culto Sábado').title
    && linha('Vazio').title === 'O cronograma está vazio',
  'F · title/aria-label "Enviar “<nome>”" (e o vazio diz por que está apagado)', JSON.stringify(gav.map((l) => l.title)));
  checar(gav.every((l) => l.ordem && l.quadrado && l.icone >= 16 && l.larguraNome >= 120 && !l.cortado),
    'F · a 360 px: os quatro sem se sobrepor, o enviar do tamanho do excluir, ícone visível, e o '
    + 'miolo do nome com ≥ 120 px sem cortar "Culto Sábado"', JSON.stringify(gav));

  // ===== A + B · O ENVIO PELO TOQUE, COM A CAPA =====
  await A.pg.evaluate(() => {
    const li = [...document.querySelectorAll('#cronoLista .crono-item')]
      .find((x) => x.querySelector('.crono-item-nome').textContent === 'Culto Sábado');
    li.querySelector('.crono-enviar').click();
  });
  const enviou = await esperar(A.pg, () => window.__chamadas.includes('compartilhar'), null, 60000);
  checar(enviou === true, 'B · o toque no enviar escreve o pacote e ABRE O COMPARTILHAR', String(enviou));
  const cham = await A.pg.evaluate(() => window.__chamadas.slice());
  const hoje = new Date();
  const dd = String(hoje.getDate()).padStart(2, '0') + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
  checar(cham.includes('criarLocal:Culto Sábado ' + dd + '.avpkg') && !cham.includes('cancelar'),
    'B · o arquivo se chama "<nome> DD-MM.avpkg" (AVPacote.nomeDoCulto) e nada foi cancelado', JSON.stringify(cham));
  const comCapa = await saidaDe(A.pg);
  const regs = registros(comCapa);
  const info = JSON.parse(txt(regs[0].corpo));
  checar(regs[0].cab.t === 'info' && info.escopo === 'culto' && info.culto && info.culto.nome === 'Culto Sábado'
    && /^cr-/.test(info.culto.id) && info.culto.id !== 'cr-a',
  'B · o 1º registro é o `info` JSON com escopo "culto" e culto {id NOVO, nome}', JSON.stringify(info));
  const capasDe = (rs) => rs.slice(1).filter((r, i, a) => r.cab.t === 'info' && r.cab.capa
    && a.slice(0, i).every((x) => x.cab.t === 'info'));
  const pags = capasDe(regs);
  checar(pags.length >= 1 && pags.length <= 6 && info.capas === pags.length
    && pags.every((r, i) => r.cab.capa === 'image/png' && r.cab.tipo === 'image/png' && r.cab.pagina === i + 1
      && r.cab.paginas === pags.length && ehPng(r.corpo) && r.corpo.length === r.cab.bytes),
  'B · logo depois vem a CAPA do AVCapa real: um `info` por página { capa, tipo "image/png", pagina, '
  + 'paginas }, corpo PNG (assinatura), e o 1º `info` diz `capas: n`',
  JSON.stringify({ capas: info.capas, cabs: pags.map((r) => r.cab) }));
  checar(regs.at(-1).cab.t === 'fim' && regs.every((r) => P.TIPOS.includes(r.cab.t)),
    'B · nenhum tipo novo (todo `t` está em AVPacote.TIPOS) e o último é `fim`', JSON.stringify(regs.map((r) => r.cab.t)));

  const estado = regs.filter((r) => r.cab.t === 'state' || r.cab.t === 'state-blob').map((r) => r.cab.chave);
  const cronV = JSON.parse(txt(regs.find((r) => r.cab.chave === 'cronogramas').corpo));
  checar(estado.length === 1 && estado[0] === 'cronogramas',
    'A · da `state` viaja SÓ `cronogramas` — nem preferência, nem Bíblia, nem `itinerario`', JSON.stringify(estado));
  checar(!('ativo' in cronV) && cronV.itens.length === 1 && cronV.itens[0].nome === 'Culto Sábado'
    && cronV.itens[0].id === info.culto.id
    && JSON.stringify(cronV.itens[0].ids) === JSON.stringify([momentoId, 'mid-a', 'arq-hino', 'mid-edit']),
  'A · o valor de `cronogramas` tem UM item (o culto, com os ids do ativo em ordem) e SEM `ativo`', JSON.stringify(cronV));
  const midias = regs.filter((r) => r.cab.t === 'media');
  const mid = (id) => midias.find((r) => r.cab.rec.id === id);
  checar(mid(momentoId) && mid(momentoId).cab.rec.cue === 'momento' && mid(momentoId).cab.rec.data.min === 600
    && mid('mid-a') && mid('mid-a').corpo.length === 3000 && mid('mid-edit') && !mid('mid-edit').cab.base,
  'A · o momento (cue com data.min) e as mídias do culto viajam, com os bytes',
  JSON.stringify(midias.map((r) => [r.cab.rec.id, r.cab.bytes, !!r.cab.base])));
  checar(mid('mid-orig') && mid('mid-orig').cab.base === true && mid('mid-orig').corpo.length === 2500,
    'A · o original escondido do editado vai como `base: true` (pacoteBases)', JSON.stringify(midias.map((r) => r.cab.rec.id)));
  checar(!mid('mid-outro') && midias.length === 4,
    'A · a mídia de OUTRO cronograma não viaja (4 media: momento, mídia, editado, original)',
    JSON.stringify(midias.map((r) => r.cab.rec.id)));
  const arqs = regs.filter((r) => r.cab.t === 'arquivo').map((r) => r.cab.rec.id);
  const opfs = regs.filter((r) => r.cab.t === 'opfs').map((r) => r.cab.caminho);
  checar(JSON.stringify(arqs) === '["arq-hino"]'
    && JSON.stringify(opfs.slice().sort()) === '["folders/hinario/001-fundo.jpg","folders/hinario/001.m4a"]',
  'A · o hino de coleção leva o catálogo dele e os bytes (áudio + fundo da letra) — e SÓ ele',
  JSON.stringify({ arqs, opfs }));

  // ===== B · VÁRIAS PÁGINAS: um stub que devolve 3 PNG de tamanhos distintos =====
  const pngsDoStub = async (pg, so) => pg.evaluate((soDesenhar) => {
    window.__saida = []; window.__chamadas = [];
    const png = (w) => new Promise((r) => {
      const c = document.createElement('canvas'); c.width = w; c.height = 7;
      const x = c.getContext('2d'); x.fillStyle = '#' + (w * 40503).toString(16).slice(-6).padStart(6, '3'); x.fillRect(0, 0, w, 7);
      c.toBlob(r, 'image/png');
    });
    window.__tamanhos = null;
    const paginas = async () => {
      const bs = await Promise.all([11, 37, 90].map(png));
      window.__tamanhos = bs.map((b) => b.size);
      return bs;
    };
    window.AVCapa = soDesenhar
      ? { desenhar: async () => { const b = await png(23); window.__tamanhos = [b.size]; return b; } }
      : { desenharPaginas: paginas, desenhar: async () => { throw new Error('não era para chamar'); } };
  }, so);
  await pngsDoStub(A.pg, false);
  await A.pg.evaluate(() => exportarCulto('cr-a'));
  const tres = await saidaDe(A.pg);
  const regs3 = registros(tres);
  const tam3 = await A.pg.evaluate(() => window.__tamanhos);
  const pags3 = capasDe(regs3);
  const info3 = JSON.parse(txt(regs3[0].corpo));
  checar(info3.capas === 3 && pags3.length === 3 && regs3[4].cab.t !== 'info'
    && pags3.every((r, i) => r.cab.pagina === i + 1 && r.cab.paginas === 3 && ehPng(r.corpo)
      && r.corpo.length === tam3[i]),
  'B · com desenharPaginas → 3 Blobs: 3 `info` de capa logo depois do 1º, NA ORDEM (pagina 1,2,3 com '
  + 'os tamanhos de cada Blob), `capas: 3` no 1º, e nada mais de `info`',
  JSON.stringify({ capas: info3.capas, cabs: pags3.map((r) => r.cab), tam3 }));
  await pngsDoStub(A.pg, true);
  await A.pg.evaluate(() => exportarCulto('cr-a'));
  const regs1 = registros(await saidaDe(A.pg));
  const tam1 = await A.pg.evaluate(() => window.__tamanhos);
  checar(capasDe(regs1).length === 1 && capasDe(regs1)[0].corpo.length === tam1[0]
    && JSON.parse(txt(regs1[0].corpo)).capas === 1 && capasDe(regs1)[0].cab.pagina === 1,
  'B · sem desenharPaginas cai para [desenhar()]: UMA página', JSON.stringify(capasDe(regs1).map((r) => r.cab)));

  // ===== B · SEM AVCapa (ele falha): o pacote sai SEM capa, e o envio não falha =====
  await A.pg.evaluate(() => {
    window.__saida = []; window.__chamadas = [];
    window.AVCapa = { desenhar: () => Promise.reject(new Error('capa de teste quebrada')) };
  });
  await A.pg.evaluate(() => exportarCulto('cr-a'));
  const semCapa = await saidaDe(A.pg);
  const regs2 = registros(semCapa);
  const cham2 = await A.pg.evaluate(() => window.__chamadas.slice());
  checar(regs2[0].cab.t === 'info' && regs2[1].cab.t !== 'info' && regs2.at(-1).cab.t === 'fim'
    && JSON.parse(txt(regs2[0].corpo)).capas === 0
    && cham2.includes('compartilhar') && !cham2.includes('cancelar')
    && A.pg.avisos.some((t) => /capa/.test(t)),
  'B · com o AVCapa falhando o pacote sai com UM `info` só, inteiro, compartilhado — e a falha vai ao console',
  JSON.stringify({ tipos: regs2.slice(0, 3).map((r) => r.cab.t), cham2 }));
  await A.ctx.close();

  // ===== E · pacoteLerCapa =====
  const B = await aparelho(comCapa);
  pacoteServido = comCapa;
  const lerCapas = (pg, tam) => pg.evaluate(async (t) => {
    const r = await pacoteLerCapa(pacoteFonteDaUrl('/pacote-de-teste', t));
    const capas = [];
    for (const b of r.capas) capas.push({ tipo: b.type, tam: b.size, cab: Array.from(new Uint8Array(await b.slice(0, 9).arrayBuffer())) });
    return { info: r.info, capas };
  }, tam);
  const lida = await lerCapas(B.pg, comCapa.length);
  checar(lida.info && lida.info.escopo === 'culto' && lida.capas.length === pags.length
    && lida.capas.every((c, i) => c.tipo === 'image/png' && c.tam === pags[i].cab.bytes && ehPng(Uint8Array.from(c.cab))),
  'E · pacoteLerCapa → { info (escopo culto), capas: [Blob image/png com a assinatura PNG] }', JSON.stringify(lida));
  pacoteServido = tres;
  const lida3p = await lerCapas(B.pg, tres.length);
  checar(lida3p.capas.length === 3 && lida3p.capas.every((c, i) => c.tam === tam3[i] && c.tipo === 'image/png'),
    'E · com 3 páginas: `capas` traz os 3 Blobs NA ORDEM do pacote', JSON.stringify(lida3p.capas));
  pacoteServido = semCapa;
  const lida2 = await B.pg.evaluate(async (tam) => {
    const r = await pacoteLerCapa(pacoteFonteDaUrl('/pacote-de-teste', tam));
    return { escopo: r.info && r.info.escopo, capas: r.capas.length };
  }, semCapa.length);
  pacoteServido = new Uint8Array(64).fill(7);
  const lida3 = await B.pg.evaluate(async () => pacoteLerCapa(pacoteFonteDaUrl('/pacote-de-teste', 64)));
  checar(lida2.escopo === 'culto' && lida2.capas === 0 && lida3.info === null
    && Array.isArray(lida3.capas) && lida3.capas.length === 0,
  'E · sem capa: { info, capas: [] }; num arquivo que não é pacote: { null, [] } sem lançar',
    JSON.stringify({ lida2, lida3 }));

  // ===== C · IMPORTADO NUM APARELHO LIMPO =====
  const antesB = await estadoCronos(B.pg);
  const impB = await importar(B.pg, comCapa);
  const depoisB = await estadoCronos(B.pg);
  const guardB = depoisB.gaveta.itens.find((x) => x.nome === 'Culto Sábado');
  const rawB = depoisB.lido && depoisB.lido.itens.find((x) => x.nome === 'Culto Sábado');
  const temB = await B.pg.evaluate(async () => ({
    mid: !!(await AVDB.getMediaCru('mid-a')), orig: !!(await AVDB.getMediaCru('mid-orig')),
    edit: !!(await AVDB.getMedia('mid-edit')), outro: !!(await AVDB.getMediaCru('mid-outro')),
    hino: !!(await AVDB.fileGet('arq-hino')),
    audio: await AVDB.opfsGetFile('folders/hinario/001.m4a').then((f) => f.size, () => -1),
    fundo: await AVDB.opfsGetFile('folders/hinario/001-fundo.jpg').then((f) => f.size, () => -1),
    lyricsFont: await AVDB.getState('lyricsFont'), bible: await AVDB.getState('bibleVersion'),
    gaveta: [...document.querySelectorAll('#cronoLista .crono-item-nome')].map((x) => x.textContent),
  }));
  checar(impB.abriu === true && /Culto importado/.test(impB.titulo) && /entrou como um cronograma guardado/.test(impB.msg),
    'C · aparelho limpo: o Importar de hoje aceita o pacote do culto e diz que entrou como guardado',
    JSON.stringify(impB));
  checar(guardB && guardB.id !== depoisB.gaveta.ativo && rawB && rawB.ids.length === 4
    && depoisB.imports.length === 0 && antesB.imports.length === 0
    && depoisB.gaveta.itens.length === 2,
  'C · aparelho limpo: vira um GUARDADO novo com os 4 itens; o ativo continua vazio e é outro',
  JSON.stringify({ antesB, depoisB }));
  checar(temB.mid && temB.orig && temB.edit && temB.hino && temB.audio === 1200 && temB.fundo === 500
    && !temB.outro && temB.lyricsFont == null && temB.bible == null,
  'C · as mídias do culto entram e abrem (o editado resolve; o hino com áudio e fundo); a do outro '
  + 'cronograma não; nenhuma preferência chega', JSON.stringify(temB));
  await B.ctx.close();

  // ===== C · NUM APARELHO QUE JÁ TEM OUTRO ATIVO (e um guardado de mesmo nome) =====
  const C = await aparelho(comCapa);
  await C.pg.evaluate(async () => {
    await AVDB.mediaAdd({ id: 'c-item', name: 'Daqui', kind: 'audio', type: 'audio/mp4',
      blob: new Blob([new Uint8Array(900).fill(1)], { type: 'audio/mp4' }), thumb: null, url: null,
      pages: null, videos: null, cue: null, data: null, youtubeId: null, height: null, seconds: 3,
      canal: null, createdAt: 1 });
    await AVDB.listAdd('imports', 'c-item');
    await AVDB.setState('favs', ['c-item']);
    await AVDB.setState('cronogramas', { ativo: 'cr-c', itens: [
      { id: 'cr-c', nome: 'Meu culto', ids: [], usado: 0 },
      { id: 'cr-g', nome: 'Culto Sábado', ids: ['c-item'], usado: 0 },
    ] });
  });
  await recarregar(C.pg);
  // AS MARCAS DO TRANSFERIR TIRADAS: o filtro estrito de hoje cortaria tudo do culto.
  await C.pg.evaluate(() => abrirSecao('pacote'));
  await esperar(C.pg, () => !!document.querySelector('#pacoteLista li') && !!pacoteEsboco, null, 30000);
  const premissa = await C.pg.evaluate(() => { pacoteMarcados.clear(); return pacoteFiltroDeImportacao() !== null; });
  checar(premissa, 'C · PREMISSA: com as marcas tiradas, o filtro de grupos de hoje está ATIVO');
  const antesC = await estadoCronos(C.pg);
  const impC = await importar(C.pg, comCapa);
  const depoisC = await estadoCronos(C.pg);
  const novoC = depoisC.lido.itens.find((x) => x.nome === 'Culto Sábado (2)');
  const velhoC = depoisC.lido.itens.find((x) => x.id === 'cr-g');
  checar(impC.abriu === true && novoC && novoC.ids.length === 4 && novoC.id !== 'cr-c',
    'C · com outro ativo: o culto vira um guardado NOVO "Culto Sábado (2)" com os 4 itens — as '
    + 'marcas do Transferir não o filtram', JSON.stringify({ impC, itens: depoisC.lido.itens }));
  checar(depoisC.lido.ativo === 'cr-c' && JSON.stringify(depoisC.imports) === JSON.stringify(antesC.imports)
    && JSON.stringify(depoisC.imports) === '["c-item"]'
    && velhoC && velhoC.nome === 'Culto Sábado' && JSON.stringify(velhoC.ids) === '["c-item"]'
    && depoisC.lido.itens.length === 3,
  'C · o ativo "Meu culto" e o conteúdo dele INTOCADOS, o guardado de mesmo nome também: nada substituído',
  JSON.stringify({ antesC, depoisC }));
  // Importar o MESMO arquivo de novo não duplica.
  await importar(C.pg, comCapa);
  const deNovo = await estadoCronos(C.pg);
  checar(deNovo.lido.itens.length === 3 && JSON.stringify(deNovo.imports) === '["c-item"]',
    'C · importar o MESMO arquivo de novo não cria outro guardado nem toca no ativo',
    JSON.stringify(deNovo.lido.itens.map((x) => x.nome)));
  await C.ctx.close();

  // ===== D · COMPATIBILIDADE: o caminho CRU de um importador de hoje =====
  for (const [rotulo, bytes] of [['a capa do AVCapa real', comCapa], ['TRÊS páginas de capa', tres]]) {
  const D = await aparelho(bytes);
  pacoteServido = bytes;
  const cru = await D.pg.evaluate(async (tam) => {
    const fonte = pacoteFonteDaUrl('/pacote-de-teste', tam);
    await pacoteConferir(fonte, null, null);
    const contagem = { media: 0, arquivos: 0, chaves: 0, opfs: 0, repetidos: 0, recusadas: 0 };
    const viuFim = await pacoteAplicarFluxo(pacoteCursor(fonte), contagem, null, null);
    const c = await AVDB.getState('cronogramas');
    return { viuFim, contagem: Object.assign({}, contagem, { colecoes: [...contagem.colecoes] }),
      guardados: c ? c.itens.filter((x) => x.id !== c.ativo).map((x) => [x.nome, x.ids.length]) : [] };
  }, bytes.length);
  checar(cru.viuFim && cru.contagem.media === 3 && cru.contagem.bases === 1 && cru.contagem.arquivos === 1
    && cru.contagem.opfs === 2 && cru.contagem.recusadas === 0
    && JSON.stringify(cru.guardados) === '[["Culto Sábado",4]]',
  'D · com ' + rotulo + ', pacoteConferir + pacoteAplicarFluxo (sem filtro, sem pacoteLerCapa — o '
  + 'caminho de um app de hoje, que pula `info`) vão ao `fim` e aplicam tudo: 3 mídias + 1 original, '
  + '1 arquivo, 2 do OPFS, 0 recusadas, 1 guardado', JSON.stringify(cru));
  await D.ctx.close();
  }

  checar(erros.length === 0, 'nenhum erro de console', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
