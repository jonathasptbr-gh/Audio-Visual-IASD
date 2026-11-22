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
//   I · a ETAPA do envio na linha (`cultoAvisar`): com o canal segurado, antes do fim, a conta
//       vira a etapa, a linha tem `.enviando` e "Gravando… N%" com `--pct` acima do início;
//       no fim volta a "N itens". Foto a 360×640 em ~/tmp/enviando-360.png.
//   Q · o envio de UMA mídia e a chegada dela: sem capa (`capas: 0`, nenhum `info` de capa) e
//       `info.midiaUnica { id, nome }`; no destino, a folha de importação de uma mídia comum
//       (Tocar agora · Cronograma · Playlist · Favoritos), SEM cronograma novo nem ativação.
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
let pacoteAtraso = 0;   // ms por pedido: segura a importação para a foto do PROGRESSO (bloco L)
const servidor = servirEstatico(RAIZ, (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname !== '/pacote-de-teste') return false;
  if (!pacoteServido) { res.writeHead(404).end('sem pacote'); return true; }
  const m = /^(\d+)-(\d+)$/.exec(u.searchParams.get('r') || '');
  if (!m) { res.writeHead(416).end('sem faixa'); return true; }
  const fatia = pacoteServido.subarray(Number(m[1]), Math.min(pacoteServido.length, Number(m[2]) + 1));
  const responder = () => {
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(Buffer.from(fatia));
  };
  if (pacoteAtraso) setTimeout(responder, pacoteAtraso); else responder();
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
    takeShare: (id) => R(id, (window.__shares && window.__shares.shift()) || ''),
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
    pacoteProntoEstado: (id) => R(id, window.__prontoNoShell || null),
    pacoteConsumirOrigem: (id) => { window.__chamadas.push('consumir'); R(id, ''); },
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

async function importar(pg, bytes, opts) {
  pacoteServido = bytes;
  await pg.evaluate(() => { window.__fim = importarPacote(); });
  return seguir(pg, opts);
}
const dialogoAberto = (pg) => esperar(pg, () => {
  const d = document.getElementById('appDialog');
  return !!d && d.classList.contains('open');
}, null, 60000);
// O QUE A PRÉVIA MOSTRA, e o que o banco tem ENQUANTO ela está aberta (nada gravado ainda).
const lerPrevia = (pg) => pg.evaluate(async () => {
  const imgs = [...document.querySelectorAll('#appDialogCapasTrilho img')];
  await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
  const t = (id) => (document.getElementById(id) || {}).textContent || '';
  const c = await AVDB.getState('cronogramas');
  return {
    titulo: t('appDialogTitle'), msg: t('appDialogMsg'), ok: t('appDialogOk'), cancel: t('appDialogCancel'),
    cancelVisivel: !document.getElementById('appDialogCancel').hidden,
    capas: imgs.map((i) => [i.naturalWidth, i.naturalHeight]),
    conta: document.getElementById('appDialogCapasConta').hidden ? '' : t('appDialogCapasConta'),
    guardados: c ? c.itens.length : 0, imports: (await AVDB.listIds('imports')).length,
    midA: !!(await AVDB.getMediaCru('mid-a')),
  };
});
const ehPrevia = (pg) => pg.evaluate(() => document.querySelector('#appDialog .dialog-card').classList.contains('previa-culto'));
// Segue uma importação em curso: a PRÉVIA (se vier) e o relatório. `cancelar` toca Cancelar na prévia.
async function seguir(pg, opts) {
  const o = opts || {};
  let abriu = await dialogoAberto(pg);
  let previa = null;
  if (abriu === true && await ehPrevia(pg)) {
    previa = await lerPrevia(pg);
    if (o.antesDeTocar) await o.antesDeTocar(pg);
    await pg.click(o.cancelar ? '#appDialogCancel' : '#appDialogOk');
    if (o.cancelar) {
      await pg.evaluate(() => window.__fim).catch(() => {});
      return { abriu, previa, cancelado: true };
    }
    if (o.durante) await o.durante(pg);
    // 16.a: a MESMA folha vira progresso e termina no fim curto (barra oculta, o OK de volta); um erro
    // fecha a folha e abre o aviso (sem a classe da prévia).
    abriu = await esperar(pg, () => {
      const d = document.getElementById('appDialog');
      if (!d.classList.contains('open')) return false;
      if (!d.querySelector('.dialog-card').classList.contains('previa-culto')) return true;
      return document.getElementById('appDialogBarra').hidden
        && document.getElementById('appDialogOk').textContent === 'OK';
    }, null, 60000);
  }
  const msg = await pg.evaluate(() => (document.getElementById('appDialogMsg') || {}).textContent || '');
  const titulo = await pg.evaluate(() => (document.getElementById('appDialogTitle') || {}).textContent || '');
  if (o.antesDoOk) await o.antesDoOk(pg);
  if (abriu === true) await pg.click('#appDialogOk');
  await pg.evaluate(() => window.__fim).catch(() => {});
  return { abriu, msg, titulo, previa };
}
const estadoCronos = (pg) => pg.evaluate(async () => ({
  lido: await AVDB.getState('cronogramas'),
  gaveta: await AVDB.cronoLer(),
  imports: await AVDB.listIds('imports'),
}));

const fotos360 = [];
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
    // A LINHA (Pacote 16, 16.e): nome · ENVIAR · ⋮, e a faixa das opções (`.row-acoes`) atrás do ⋮.
    const filhos = [...li.children].map((x) => x.className.split(' ').find((c) => c.startsWith('crono-') || c === 'row-acoes' || c === 'row-mais'));
    return {
      nome: nm.textContent, filhos, disabled: env.disabled, hidden: env.hidden,
      title: env.title, aria: env.getAttribute('aria-label'), svg: !!env.querySelector('svg use[href="#icoCompartilhar"]'),
      larguraNome: r('.crono-trocar').width, cortado: nm.scrollWidth > nm.clientWidth + 1,
      ordem: r('.crono-trocar').right <= r('.crono-enviar').left + 0.5
        && r('.crono-enviar').right <= r(':scope > .row-mais').left + 0.5,
      quadrado: Math.abs(r('.crono-enviar').width - r(':scope > .row-mais').width) < 0.5
        && Math.abs(r('.crono-enviar').height - r(':scope > .row-mais').height) < 0.5,
      icone: r('.crono-enviar svg').width,
    };
  }));
  const linha = (n) => gav.find((x) => x.nome === n) || {};
  checar(gav.length === 3 && gav.every((l) => l.filhos.join(',') === 'crono-trocar,crono-enviar,row-acoes,row-mais'),
    'F · cada linha da gaveta: nome+conta | ENVIAR | ⋮ (as opções atrás dele)', JSON.stringify(gav.map((l) => l.filhos)));
  checar(!linha('Culto Sábado').disabled && !linha('Outro').disabled && linha('Vazio').disabled
    && gav.every((l) => !l.hidden && l.svg),
  'F · o enviar aparece (app nativo) com o desenho de compartilhar, e está DESABILITADO só no cronograma vazio',
  JSON.stringify(gav.map((l) => [l.nome, l.disabled, l.hidden, l.svg])));
  checar(linha('Culto Sábado').title === 'Enviar “Culto Sábado”' && linha('Culto Sábado').aria === linha('Culto Sábado').title
    && linha('Vazio').title === 'O cronograma está vazio',
  'F · title/aria-label "Enviar “<nome>”" (e o vazio diz por que está apagado)', JSON.stringify(gav.map((l) => l.title)));
  checar(gav.every((l) => l.ordem && l.quadrado && l.icone >= 16 && l.larguraNome >= 120 && !l.cortado),
    'F · a 360 px: sem se sobrepor, o enviar do tamanho do ⋮, ícone visível, e o '
    + 'miolo do nome com ≥ 120 px sem cortar "Culto Sábado"', JSON.stringify(gav));

  // ===== A + B · O ENVIO PELO TOQUE, COM A CAPA =====
  await A.pg.evaluate(() => {
    const li = [...document.querySelectorAll('#cronoLista .crono-item')]
      .find((x) => x.querySelector('.crono-item-nome').textContent === 'Culto Sábado');
    li.querySelector('.crono-enviar').click();
  });
  const enviou = await esperar(A.pg, () => window.__chamadas.includes('compartilhar'), null, 60000);
  checar(enviou === true, 'B · (APK velho, sem os métodos do shell 90) o toque no enviar escreve o pacote e ABRE O COMPARTILHAR de um arquivo', String(enviou));
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
    window.__capaReal = window.__capaReal || window.AVCapa;
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

  // ===== G · SHELL 90: o culto num arquivo PRÓPRIO e as capas AO LADO (ACTION_SEND_MULTIPLE) =====
  // A ponte ganha os três métodos opcionais NA HORA (o `native.js` pergunta `typeof` a cada
  // chamada). As 3 páginas são do AVCapa REAL (1080×1920) — o pacote serve também às fotos.
  await A.pg.evaluate(() => {
    window.__saida = []; window.__chamadas = []; window.__capasAoLado = {};
    const R = (id, v) => setTimeout(() => window.__avResolve(id, v), 0);
    const total = () => { let t = 0; for (const p of window.__saida) t += p.length; return t; };
    Object.assign(window.__AVBridge, {
      pacoteCriarCulto: (id, nome) => { window.__chamadas.push('criarCulto:' + nome); R(id, nome); },
      pacoteCapa: (id, pagina, b64) => {
        const bin = atob(b64);
        window.__capasAoLado[pagina] = { tam: bin.length, png: bin.charCodeAt(0) === 0x89 && bin.slice(1, 4) === 'PNG' };
        window.__chamadas.push('capa:' + pagina);
        R(id, bin.length);
      },
      pacoteCompartilharCulto: (id) => { window.__chamadas.push('compartilharCulto'); R(id, total()); },
    });
    const real = window.__capaReal;
    window.__tamanhos = null;
    window.AVCapa = { desenharPaginas: async (d) => {
      const bs = [await real.desenhar(d), await real.desenhar(Object.assign({}, d, { nome: d.nome + ' — 2' })),
        await real.desenhar(Object.assign({}, d, { nome: d.nome + ' — 3' }))];
      window.__tamanhos = bs.map((b) => b.size);
      return bs;
    } };
    // UM ACERVO PRONTO no shell: com o culto à parte ele NÃO é perguntado nem apagado.
    pacotePronto = { nome: 'acervo-av-20261118-1530.avpkg', bytes: 99 };
  });
  await A.pg.evaluate(() => { window.__fimG = exportarCulto('cr-a'); });
  const foiG = await esperar(A.pg, () => window.__chamadas.includes('compartilharCulto')
    || document.getElementById('appDialog').classList.contains('open'), null, 60000);
  await A.pg.evaluate(() => window.__fimG);
  const g = await A.pg.evaluate(() => ({ cham: window.__chamadas.slice(), aoLado: window.__capasAoLado,
    tam: window.__tamanhos, pronto: pacotePronto,
    dialogo: document.getElementById('appDialog').classList.contains('open') }));
  checar(foiG === true && !g.dialogo && g.cham.find((c) => /^criar/.test(c)) === 'criarCulto:Culto Sábado ' + dd + '.avpkg'
    && !g.cham.some((c) => /^criarLocal|^compartilhar$/.test(c))
    && JSON.stringify(g.cham.filter((c) => /^capa:|^compartilharCulto|^fechar/.test(c)))
      === '["fechar","capa:1","capa:2","capa:3","compartilharCulto"]',
  'G · com o shell 90: pacoteCriarCulto (sem perguntar pelo acervo pronto), fechar, as 3 páginas AO LADO '
  + 'em ordem e o compartilhar do culto — nunca o criarLocal/compartilhar de um arquivo', JSON.stringify(g));
  checar(g.tam && [1, 2, 3].every((i) => g.aoLado[i] && g.aoLado[i].png && g.aoLado[i].tam === g.tam[i - 1]),
    'G · cada capa chega ao shell com os MESMOS bytes do Blob (PNG cru, sem recomprimir)', JSON.stringify(g));
  checar(g.pronto && g.pronto.nome === 'acervo-av-20261118-1530.avpkg',
    'G · o pronto do ACERVO continua de pé (o culto não o leva na porta)', JSON.stringify(g.pronto));
  const tresReais = await saidaDe(A.pg);
  checar(capasDe(registros(tresReais)).length === 3, 'G · o pacote leva as 3 capas reais dentro também');

  // ===== H · O CANCELAR do envio: o MESMO botão, enquanto prepara =====
  const h = await A.pg.evaluate(async () => {
    window.__saida = []; window.__chamadas = [];
    const btn = () => [...document.querySelectorAll('#cronoLista .crono-item')]
      .find((x) => x.querySelector('.crono-item-nome').textContent === 'Culto Sábado').querySelector('.crono-enviar');
    const p = exportarCulto('cr-a');
    const b = btn();
    const durante = { title: b.title, disabled: b.disabled, x: !!b.querySelector('.msym') };
    b.click();
    await p;
    return { durante, cham: window.__chamadas.slice(), depois: btn().title,
      dialogo: document.getElementById('appDialog').classList.contains('open') };
  });
  checar(h.durante.title === 'Cancelar o envio de “Culto Sábado”' && !h.durante.disabled && h.durante.x
    && h.cham.includes('cancelar') && !h.cham.includes('compartilharCulto') && !h.cham.includes('fechar')
    && !h.dialogo && h.depois === 'Enviar “Culto Sábado”',
  'H · enquanto prepara, o enviar vira o ✕ "Cancelar o envio": o toque apaga o parcial (pacoteCancelar), '
  + 'não fecha nem compartilha, e não abre diálogo de erro', JSON.stringify(h));

  // ===== I · A ETAPA DO ENVIO na linha (`cultoAvisar`): o operador vê andar, não um app travado =====
  // O CANAL SEGURA os blocos binários num portão que o teste abre: enquanto ele está fechado
  // o envio NÃO PODE terminar (o `fim`, o `fechar` e o compartilhar vêm depois), e o que a linha
  // mostra é o MEIO. Um MutationObserver anota cada etapa; `waitForFunction` amostra o estado.
  await A.pg.setViewportSize({ width: 360, height: 640 });
  if (!(await A.pg.evaluate(() => document.getElementById('cronoGaveta').classList.contains('aberta')))) {
    await A.pg.click('#cronoTitulo');
    await esperar(A.pg, () => document.getElementById('cronoGaveta').classList.contains('aberta'));
  }
  await A.pg.waitForTimeout(350);
  const iIni = await A.pg.evaluate(() => {
    window.__saida = []; window.__chamadas = []; window.__retidos = 0; window.__etapas = [];
    const canal = window.__avPacote;
    window.__postOriginal = canal.postMessage;
    let abrir;
    const portao = new Promise((r) => { abrir = r; });
    window.__abrirPortao = abrir;
    canal.postMessage = function (m) {
      if (typeof m === 'string') return window.__postOriginal.call(canal, m);
      window.__retidos++;
      portao.then(() => window.__postOriginal.call(canal, m));
    };
    const anotar = () => {
      const el = document.getElementById('cronoEtapa');
      const t = el ? el.textContent : '';
      if (t && window.__etapas.at(-1) !== t) window.__etapas.push(t);
    };
    window.__obs = new MutationObserver(anotar);
    window.__obs.observe(document.getElementById('cronoLista'), { subtree: true, childList: true, characterData: true });
    const li = [...document.querySelectorAll('#cronoLista .crono-item')]
      .find((x) => x.querySelector('.crono-item-nome').textContent === 'Culto Sábado');
    li.querySelector('.crono-enviar').click();
    const el = document.getElementById('cronoEtapa');
    const linha = el && el.closest('.crono-item');
    return { texto: el ? el.textContent : null, enviando: !!linha && linha.classList.contains('enviando'),
      pct: linha ? parseFloat(linha.style.getPropertyValue('--pct')) : NaN };
  });
  const ETAPAS = /^(Juntando as mídias…|Desenhando as capas…|Preparando o arquivo…|Gravando… \d+%|Abrindo o compartilhar…)$/;
  checar(ETAPAS.test(iIni.texto || '') && iIni.enviando && iIni.pct >= 0,
    'I · no toque, #cronoEtapa já mostra uma ETAPA no lugar da conta e a linha ganha `.enviando`', JSON.stringify(iIni));
  let viuGravando = true;
  try {
    await A.pg.waitForFunction(() => {
      const el = document.getElementById('cronoEtapa');
      return window.__retidos > 0 && !!el && /^Gravando… \d+%$/.test(el.textContent);
    }, null, { timeout: 15000, polling: 50 });
  } catch (_) { viuGravando = false; }
  const iMeio = await A.pg.evaluate(() => {
    const el = document.getElementById('cronoEtapa');
    const linha = el && el.closest('.crono-item');
    return { texto: el ? el.textContent : null, enviando: !!linha && linha.classList.contains('enviando'),
      pct: linha ? parseFloat(linha.style.getPropertyValue('--pct')) : NaN,
      nome: linha ? linha.querySelector('.crono-item-nome').textContent : null,
      barra: linha ? getComputedStyle(linha).backgroundImage : '',
      retidos: window.__retidos, cham: window.__chamadas.slice(), etapas: window.__etapas.slice() };
  });
  if (viuGravando) await A.pg.screenshot({ path: path.join(process.env.HOME, 'tmp', 'enviando-360.png') });
  checar(viuGravando && iMeio.nome === 'Culto Sábado' && iMeio.enviando && /^Gravando… \d+%$/.test(iMeio.texto)
    && iMeio.pct > iIni.pct && /gradient/.test(iMeio.barra)
    && !iMeio.cham.includes('fechar') && !iMeio.cham.some((c) => /^compartilhar/.test(c)),
  'I · ANTES DO FIM (canal segurado, nada fechado nem compartilhado): a linha mostra "Gravando… N%", '
  + 'tem `.enviando` com a barra, e o `--pct` passou do do início', JSON.stringify({ viuGravando, iIni, iMeio }));
  await A.pg.evaluate(() => window.__abrirPortao());
  const iFim = await esperar(A.pg, () => window.__chamadas.includes('compartilharCulto')
    && !document.getElementById('cronoEtapa'), null, 60000);
  const iDepois = await A.pg.evaluate(() => {
    window.__obs.disconnect();
    window.__avPacote.postMessage = window.__postOriginal;
    const li = [...document.querySelectorAll('#cronoLista .crono-item')]
      .find((x) => x.querySelector('.crono-item-nome').textContent === 'Culto Sábado');
    return { qtd: li.querySelector('.crono-item-qtd').textContent, enviando: li.classList.contains('enviando'),
      etapa: !!document.getElementById('cronoEtapa'), etapas: window.__etapas.slice(),
      dialogo: document.getElementById('appDialog').classList.contains('open') };
  });
  checar(iFim === true && /^\d+ itens$/.test(iDepois.qtd) && !iDepois.enviando && !iDepois.etapa && !iDepois.dialogo,
    'I · no fim a linha volta a "N itens", sem `.enviando` nem #cronoEtapa', JSON.stringify({ iFim, iDepois }));
  checar(iDepois.etapas.every((t) => ETAPAS.test(t)) && iDepois.etapas.indexOf('Desenhando as capas…') >= 0
    && iDepois.etapas.findIndex((t) => /^Gravando/.test(t)) > iDepois.etapas.indexOf('Desenhando as capas…'),
  'I · as etapas anotadas são só as do envio, e "Gravando…" vem depois de "Desenhando as capas…"',
  JSON.stringify(iDepois.etapas));
  // Envio individual nativo: originais de media E files, sem o culto ativo.
  await A.pg.evaluate(async () => {
    await AVDB.mediaAdd({ id: 'cat-edit', name: 'Hino do catálogo editado', kind: 'audio', type: 'audio/mp4',
      edicao: { origem: 'arq-hino', inicio: 1, fim: 5, fadeEntrada: true } });
    await AVDB.listAdd('imports', 'cat-edit');
  });
  let pacoteMidiaEdit = null;
  for (const alvo of ['mid-edit', 'mid-a', 'cat-edit']) {
    const botoes = await A.pg.evaluate(async (id) => {
      window.__saida = []; window.__chamadas = [];
      const item = await AVDB.getMedia(id);
      await AVDB.listAdd('favs', id);
      await load();
      const crono = [...document.querySelectorAll('.lib-item')].find((li) => li.dataset.id === id);
      const fav = linhaDeItem(item, { lista: 'favs', total: 1 });
      const a = crono && crono.querySelector('.row-compartilhar');
      const b = fav.querySelector('.row-compartilhar');
      if (b) b.click();
      return { crono: !!a, fav: !!b };
    }, alvo);
    await dialogoAberto(A.pg);
    const mensagem = await A.pg.locator('#appDialogMsg').textContent();
    await A.pg.click('#appDialogOk');
    const enviou = await esperar(A.pg, () => window.__chamadas.includes('compartilharCulto') && !pacoteEmCurso, null, 60000);
    const unicoBytes = await saidaDe(A.pg);
    const unico = registros(unicoBytes);
    if (alvo === 'mid-edit') pacoteMidiaEdit = unicoBytes;
    const medias = unico.filter((r) => r.cab.t === 'media');
    const estado = unico.filter((r) => r.cab.t === 'state');
    const arqs = unico.filter((r) => r.cab.t === 'arquivo').map((r) => r.cab.rec.id);
    const recipiente = estado.length === 1 ? JSON.parse(txt(estado[0].corpo)) : null;
    const infoUnico = JSON.parse(txt(unico[0].corpo));
    const capaInfos = unico.filter((r) => r.cab.t === 'info' && r.cab.capa);
    const chamUnico = await A.pg.evaluate(() => window.__chamadas.slice());
    const edit = medias.find((r) => r.cab.rec.id === 'mid-edit');
    const cat = medias.find((r) => r.cab.rec.id === 'cat-edit');
    checar(unico[0].cab.t === 'info' && !unico[0].cab.capa && infoUnico.capas === 0
      && capaInfos.length === 0 && !chamUnico.some((c) => /^capa:/.test(c))
      && infoUnico.midiaUnica && infoUnico.midiaUnica.id === alvo
      && typeof infoUnico.midiaUnica.nome === 'string' && infoUnico.midiaUnica.nome.length > 0
      && chamUnico.includes('compartilharCulto') && !chamUnico.includes('compartilhar'),
    'Q1 · a mídia sozinha sai SEM capa nenhuma (`capas: 0`, nenhum `info` de capa, nenhum '
    + 'pacoteCapa) e o `info` a identifica em `midiaUnica { id, nome }` — o culto inteiro continua com capa',
    JSON.stringify({ info: { capas: infoUnico.capas, midiaUnica: infoUnico.midiaUnica },
      capaInfos: capaInfos.length, cham: chamUnico }));
    checar(botoes.crono && botoes.fav && enviou === true && /avpkg/.test(mensagem)
      && recipiente && recipiente.itens.length === 1 && recipiente.itens[0].ids.join() === alvo
      && medias.length === (alvo === 'mid-edit' ? 2 : 1)
      && medias.some((r) => r.cab.rec.id === alvo)
      && (alvo !== 'mid-edit' || (edit && edit.cab.rec.edicao.origem === 'mid-orig'
        && edit.cab.rec.edicao.inicio === 0 && edit.cab.rec.edicao.fim === 5
        && medias.some((r) => r.cab.rec.id === 'mid-orig' && r.cab.base && r.corpo.length === 2500)))
      && (alvo !== 'cat-edit' || (cat && cat.cab.rec.edicao.origem === 'arq-hino'
        && cat.cab.rec.edicao.inicio === 1 && cat.cab.rec.edicao.fim === 5
        && cat.cab.rec.edicao.fadeEntrada === true
        && arqs.includes('arq-hino') && !medias.some((r) => r.cab.rec.id === 'arq-hino'))),
    'Q · compartilhar ' + alvo + ' nas opções leva somente o alvo e suas dependências, sem o culto atual',
    JSON.stringify({ botoes, enviou, ids: medias.map((r) => r.cab.rec.id), arqs, recipiente }));
  }
  await A.ctx.close();

  // ===== Q2 · UMA MÍDIA RECEBIDA: SEM CRONOGRAMA, NA TELA DE DESTINO DA MÍDIA COMUM =====
  // O MESMO `.avpkg` do envio individual (o do editado, que traz o original em `base`). O destino
  // não pode criar cronograma nem ativá-lo: a folha é a da importação de uma mídia comum.
  const U = await aparelho(pacoteMidiaEdit);
  pacoteServido = pacoteMidiaEdit;
  await U.pg.evaluate(() => { window.__fim = importarPacote(); });
  const apareceu = await esperar(U.pg, () => {
    const m = document.getElementById('songMenuPopup');
    const d = document.getElementById('appDialog');
    return (!!m && m.classList.contains('open')) || (!!d && d.classList.contains('open'));
  }, null, 60000);
  const veioDestino = apareceu && await U.pg.evaluate(
    () => document.getElementById('songMenuPopup').classList.contains('open'));
  const antesDestino = await U.pg.evaluate(async () => {
    const raw = await AVDB.getMediaCru('mid-edit');
    return {
      dialogo: document.getElementById('appDialog').classList.contains('open'),
      titulo: document.getElementById('songMenuTitle').textContent,
      destinos: [...document.querySelectorAll('#songMenuPopup .dest-btn')].map((b) => b.dataset.dest),
      cronos: await AVDB.getState('cronogramas'),
      lido: await AVDB.cronoLer(),
      midia: raw && { name: raw.name, edicao: raw.edicao },
      base: !!(await AVDB.getMediaCru('mid-orig')),
      imports: await AVDB.listIds('imports'),
    };
  });
  checar(veioDestino === true && !antesDestino.dialogo && antesDestino.titulo === 'Importar'
    && JSON.stringify(antesDestino.destinos) === '["tocar","cronograma","playlist","favoritos"]'
    && !antesDestino.cronos && antesDestino.lido.ativo === 'cr-atual'
    && !antesDestino.lido.itens.some((x) => x.nome === 'Trecho editado')
    && antesDestino.imports.length === 0 && antesDestino.midia
    && antesDestino.midia.name === 'Trecho editado' && antesDestino.midia.edicao
    && antesDestino.midia.edicao.origem === 'mid-orig' && antesDestino.midia.edicao.inicio === 0
    && antesDestino.midia.edicao.fim === 5 && antesDestino.base,
  'Q2 · o pacote de UMA mídia não cria nem ativa cronograma: ele abre a MESMA folha da mídia '
  + 'comum (Tocar agora · Cronograma · Playlist · Favoritos), com o item já gravado, o nome e a '
  + 'edição (e o original base) preservados', JSON.stringify(antesDestino));
  const escolheu = veioDestino ? await U.pg.evaluate(() => {
    const b = document.querySelector('#songMenuPopup .dest-btn[data-dest="cronograma"]');
    if (!b) return false;
    b.click();
    return true;
  }) : false;
  if (veioDestino) await U.pg.evaluate(() => window.__fim).catch(() => {});
  const depoisDestino = await U.pg.evaluate(async () => ({
    fechou: !document.getElementById('songMenuPopup').classList.contains('open'),
    cronos: await AVDB.getState('cronogramas'),
    lido: await AVDB.cronoLer(),
    imports: await AVDB.listIds('imports'),
    midia: await AVDB.getMediaCru('mid-edit').then((r) => r && { name: r.name, edicao: r.edicao }, () => null),
    cham: window.__chamadas.slice(),
  }));
  checar(escolheu && depoisDestino.fechou && !depoisDestino.cronos
    && depoisDestino.lido.ativo === 'cr-atual'
    && !depoisDestino.lido.itens.some((x) => x.nome === 'Trecho editado')
    && JSON.stringify(depoisDestino.imports) === '["mid-edit"]'
    && depoisDestino.cham.includes('consumir') && depoisDestino.midia
    && depoisDestino.midia.name === 'Trecho editado'
    && depoisDestino.midia.edicao.origem === 'mid-orig' && depoisDestino.midia.edicao.fim === 5,
  'Q2 · escolhido o Cronograma, o item entra na lista pelo id que veio no pacote, SEM cronograma '
  + 'novo, e o arquivo do pacote é consumido', JSON.stringify(depoisDestino));
  await U.ctx.close();

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
  // OS MOMENTOS OCULTOS ANTES (19/11): o culto recebido chega com os momentos À VISTA.
  await B.pg.evaluate(() => itinMomentosOcultar(true));
  const ocultoB = await B.pg.evaluate(() => itin.momentosOcultos === true);
  const antesB = await estadoCronos(B.pg);
  const impB = await importar(B.pg, comCapa);
  const visB = await B.pg.evaluate(async () => ({
    mem: itin.momentosOcultos, gravado: (await AVDB.getState('itinerario') || {}).momentosOcultos,
    linhas: document.querySelectorAll('#library li.momento').length,
  }));
  checar(ocultoB && visB.mem === false && visB.gravado === false && visB.linhas === 1,
    '16.b · com os momentos OCULTOS, o culto importado chega com eles À VISTA (a linha do momento na lista)',
    JSON.stringify({ ocultoB, visB }));
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
  const pv = impB.previa || {};
  checar(pv.titulo === 'Culto Sábado' && /^4 itens · /.test(pv.msg) && /4 vêm junto · 0 já no aparelho/.test(pv.msg)
    && pv.ok === 'Importar' && pv.cancel === 'Cancelar' && pv.cancelVisivel
    && pv.capas.length === pags.length && pv.capas.every((c) => c[0] === 1080 && c[1] === 1920),
  'P · a PRÉVIA abre antes de gravar: a capa (1080×1920), o nome, "4 itens · X" e "4 vêm junto · 0 já no '
  + 'aparelho", com Importar (primário) e Cancelar', JSON.stringify(pv));
  checar(pv.imports === 0 && !pv.midA && pv.guardados === (antesB.lido ? antesB.lido.itens.length : 0),
  'P · com a prévia aberta NADA foi gravado (nem cronograma, nem lista, nem mídia)', JSON.stringify({ pv, antesB }));
  checar(impB.abriu === true && impB.titulo === 'Culto Sábado'
    && impB.msg === '“Culto Sábado” entrou e está em uso.\nO arquivo recebido foi apagado.'
    && !/músicas|Total/.test(impB.msg),
    '16.a · o fim é a frase CURTA na mesma folha ("entrou e está em uso"), sem o censo das coleções',
    JSON.stringify(impB));
  checar(guardB && guardB.id === depoisB.gaveta.ativo && rawB && depoisB.imports.length === 4
    && antesB.imports.length === 0 && depoisB.gaveta.itens.length === 2,
  '16.b · aparelho limpo: o culto entra com os 4 itens e fica SELECIONADO e ATIVO (a lista à vista é ele)',
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
  const meuC = depoisC.lido.itens.find((x) => x.id === 'cr-c');
  checar(impC.abriu === true && novoC && novoC.id !== 'cr-c' && depoisC.lido.ativo === novoC.id
    && depoisC.imports.length === 4 && /“Culto Sábado \(2\)” entrou e está em uso/.test(impC.msg),
    'C · com outro ativo: o culto entra como "Culto Sábado (2)" com os 4 itens e fica ATIVO — as '
    + 'marcas do Transferir não o filtram', JSON.stringify({ impC, itens: depoisC.lido.itens }));
  checar(JSON.stringify(antesC.imports) === '["c-item"]' && meuC && JSON.stringify(meuC.ids) === '["c-item"]'
    && velhoC && velhoC.nome === 'Culto Sábado' && JSON.stringify(velhoC.ids) === '["c-item"]'
    && depoisC.lido.itens.length === 3,
  'C · nada substituído: o que estava em uso ("Meu culto") vira guardado COM o conteúdo dele, e o '
  + 'guardado de mesmo nome fica intocado', JSON.stringify({ antesC, depoisC }));
  // Importar o MESMO arquivo de novo não duplica.
  const deNovoImp = await importar(C.pg, comCapa);
  const deNovo = await estadoCronos(C.pg);
  checar(deNovoImp.previa && /0 vêm junto · 4 já no aparelho/.test(deNovoImp.previa.msg),
    'P · de novo: a prévia conta "0 vêm junto · 4 já no aparelho"', JSON.stringify(deNovoImp.previa));
  checar(deNovo.lido.itens.length === 3 && deNovo.lido.ativo === novoC.id && deNovo.imports.length === 4
    && /já estava no aparelho e está em uso/.test(deNovoImp.msg),
    'C · importar o MESMO arquivo de novo não cria outro guardado, e o fim diz que ele já estava e está em uso',
    JSON.stringify({ itens: deNovo.lido.itens.map((x) => x.nome), msg: deNovoImp.msg }));
  await C.ctx.close();

  // ===== P · A PRÉVIA COM 3 CAPAS (as fotos), o CANCELAR, e a ENTREGA POR VIEW =====
  const Pv = await aparelho(tresReais);
  await Pv.pg.setViewportSize({ width: 360, height: 640 });
  pacoteServido = tresReais;
  await Pv.pg.evaluate(() => { window.__fim = importarPacote(); });
  const fotos = await seguir(Pv.pg, { cancelar: true, antesDeTocar: async (pg) => {
    await pg.waitForTimeout(400);
    await pg.screenshot({ path: path.join(process.env.HOME, 'tmp', 'previa-360.png') });
    const geo360 = await pg.evaluate(() => {
      const c = document.querySelector('#appDialog .dialog-card').getBoundingClientRect();
      const b = document.getElementById('appDialogOk').getBoundingClientRect();
      return { cartao: c.height, ok: b.bottom <= innerHeight && b.top >= 0 };
    });
    await pg.setViewportSize({ width: 430, height: 900 });
    await pg.waitForTimeout(400);
    await pg.screenshot({ path: path.join(process.env.HOME, 'tmp', 'previa-430.png') });
    const tr = '#appDialogCapasTrilho';
    await pg.evaluate((s) => { const t = document.querySelector(s); t.scrollLeft = t.clientWidth; }, tr);
    await pg.waitForTimeout(250);
    const conta2 = await pg.evaluate(() => document.getElementById('appDialogCapasConta').textContent);
    await pg.evaluate((s) => { document.querySelector(s).scrollLeft = 0; }, tr);
    fotos360.push(geo360, conta2);
  } });
  checar(fotos.previa && fotos.previa.capas.length === 3 && fotos.previa.capas.every((c) => c[0] === 1080 && c[1] === 1920)
    && fotos.previa.conta === '1 de 3' && fotos360[1] === '2 de 3' && fotos360[0].ok,
  'P · 3 capas reais na prévia, "1 de 3" → rolando, "2 de 3"; a 360×640 o Importar fica na tela',
  JSON.stringify({ previa: fotos.previa, fotos360 }));
  const posCancel = await Pv.pg.evaluate(async () => ({ c: await AVDB.getState('cronogramas'),
    imports: await AVDB.listIds('imports'), mid: !!(await AVDB.getMediaCru('mid-a')),
    cham: window.__chamadas.slice(), emCurso: pacoteEmCurso,
    dialogo: document.getElementById('appDialog').classList.contains('open') }));
  checar(fotos.cancelado && !posCancel.mid && posCancel.imports.length === 0
    && (!posCancel.c || posCancel.c.itens.every((x) => x.nome !== 'Culto Sábado'))
    && !posCancel.cham.includes('consumir') && !posCancel.emCurso && !posCancel.dialogo,
  'P · CANCELAR na prévia não grava nada, não consome o arquivo, não abre diálogo e solta o Transferir',
  JSON.stringify(posCancel));

  // A ENTREGA POR VIEW: o que o shell faz ao tocar no arquivo — a fila dos shares com `pacote`, e o
  // empurrão `__avShareArrived`. Com um ACERVO pronto no shell: pela porta, ele não barra.
  await Pv.pg.evaluate((tam) => {
    window.__chamadas = [];
    pacotePronto = { nome: 'acervo-av-20261118-1530.avpkg', bytes: 99 };
    window.__shares = [{ files: [], url: null, title: null, ts: 1,
      pacote: { url: '/pacote-de-teste', name: 'Culto Sábado 18-11.avpkg', size: tam } }];
    window.__avShareArrived();
  }, tresReais.length);
  const porView = await seguir(Pv.pg);
  const posView = await Pv.pg.evaluate(async () => ({ c: await AVDB.getState('cronogramas'),
    mid: !!(await AVDB.getMediaCru('mid-a')), cham: window.__chamadas.slice() }));
  checar(porView.previa && porView.previa.titulo === 'Culto Sábado' && porView.previa.capas.length === 3
    && porView.titulo === 'Culto Sábado' && /entrou e está em uso/.test(porView.msg) && posView.mid
    && posView.c && posView.c.itens.some((x) => x.nome === 'Culto Sábado' && x.id === posView.c.ativo)
    && !posView.cham.includes('consumir'),
  'P · pela PORTA (VIEW → takeShare { pacote }): a prévia abre mesmo com um acervo pronto, o Importar grava '
  + 'como hoje, e o arquivo da conversa NÃO é consumido', JSON.stringify({ porView, posView }));
  // O PRONTO DE UM CULTO (APK velho) não vira o pronto do acervo — não bloqueia o Importar.
  const prontos = await Pv.pg.evaluate(async () => {
    const r = [];
    for (const nome of ['Culto Sábado 18-11.avpkg', 'Culto_S_bado_18-11.avpkg', 'acervo-av-20261118-1530.avpkg']) {
      pacotePronto = null;
      window.__prontoNoShell = { nome, bytes: 500 };
      await lerPacotePronto();
      r.push(pacotePronto ? pacotePronto.nome : null);
    }
    pacotePronto = null; window.__prontoNoShell = null;
    return r;
  });
  checar(JSON.stringify(prontos) === '[null,null,"acervo-av-20261118-1530.avpkg"]',
    'P · lerPacotePronto ignora o pronto com nome de CULTO (os dois saneamentos) e adota o do acervo',
    JSON.stringify(prontos));
  await Pv.ctx.close();


  // ===== L · SÓ O LINK (16.d) e a FOLHA VIVA (16.a): prévia → progresso → fim, fotos a 360 =====
  // O YouTube (baixado) e a faixa de coleção viajam SEM bytes; a foto do aparelho, com. No destino, os
  // dois chegam "para baixar depois" e o aviso do cronograma (`itensQueNaoTocamSemRede`) os acusa.
  const foto = (n) => path.join(process.env.HOME, 'tmp', n);
  const L = await aparelho(null);
  await L.pg.evaluate(async () => {
    const bl = (n, v, t) => new Blob([new Uint8Array(n).fill(v)], { type: t });
    const base = { url: null, pages: null, videos: null, cue: null, data: null, height: null, seconds: 30,
      canal: null, createdAt: 1, thumb: bl(40, 9, 'image/jpeg') };
    await AVDB.mediaAdd(Object.assign({}, base, { id: 'yt-1', name: 'Vídeo do YouTube', kind: 'video',
      type: 'video/mp4', blob: bl(4000, 1, 'video/mp4'), youtubeId: 'abcdefghijk' }));
    await AVDB.mediaAdd(Object.assign({}, base, { id: 'foto-1', name: 'Foto do aparelho', kind: 'image',
      type: 'image/jpeg', blob: bl(3000, 2, 'image/jpeg'), youtubeId: null }));
    await AVDB.opfsWriteFile('folders/hinario-cat/010.m4a', bl(1500, 3, 'audio/mp4'));
    await AVDB.fileAdd({ id: 'arq-cat', folder: 'hinario-cat', opfsPath: 'folders/hinario-cat/010.m4a',
      srcName: '010-Cantado', name: '010 — Hino do catálogo', type: 'audio/mp4', kind: 'audio', size: 1500,
      thumb: null, blob: null, url: null, addedAt: 1 });
    for (const id of ['yt-1', 'foto-1', 'arq-cat']) await AVDB.listAdd('imports', id);
    await AVDB.setState('cronogramas', { ativo: 'cr-l', itens: [{ id: 'cr-l', nome: 'Culto com links', ids: [], usado: 0 }] });
  });
  await recarregar(L.pg);
  // SEM REDE o catálogo do LouvorJA não carrega: `hinario-cat` passa a ser uma coleção conhecida.
  await L.pg.evaluate(() => {
    const o = allCollections;
    window.allCollections = () => o().concat([{ id: 'hinario-cat', name: 'Hinário de teste' }]);
    window.__saida = []; window.__chamadas = [];
    exportarCulto(cronos.ativo);
  });
  await esperar(L.pg, () => window.__chamadas.some((c) => /^compartilhar/.test(c)), null, 60000);
  const soLink = await saidaDe(L.pg);
  await L.ctx.close();
  const rL = registros(soLink);
  const infoL = JSON.parse(txt(rL[0].corpo));
  const mL = (id) => rL.find((r) => r.cab.t === 'media' && r.cab.rec.id === id);
  const arqL = rL.filter((r) => r.cab.t === 'arquivo').map((r) => r.cab.rec);
  const opfsL = rL.filter((r) => r.cab.t === 'opfs').map((r) => r.cab.caminho);
  checar(mL('yt-1') && mL('yt-1').cab.bytes === 0 && mL('yt-1').cab.rec.youtubeId === 'abcdefghijk'
    && mL('foto-1') && mL('foto-1').cab.bytes === 3000,
  '16.d · o vídeo do YouTube vai SÓ como registro (0 bytes, com o youtubeId); a foto do aparelho vai com os bytes',
  JSON.stringify(rL.filter((r) => r.cab.t === 'media').map((r) => [r.cab.rec.id, r.cab.bytes])));
  checar(arqL.length === 1 && arqL[0].id === 'arq-cat' && arqL[0].opfsPath === 'folders/hinario-cat/010.m4a'
    && opfsL.length === 0,
  '16.d · a faixa de coleção vai só como catálogo (com o caminho de lá), sem os bytes', JSON.stringify({ arqL, opfsL }));
  checar(JSON.stringify((infoL.baixarDepois || []).slice().sort()) === '["arq-cat","yt-1"]',
    '16.d · o `info` diz o que chega sem bytes (`baixarDepois`)', JSON.stringify(infoL));

  const L2 = await aparelho(soLink);
  await L2.pg.setViewportSize({ width: 360, height: 640 });
  let duranteL = null;
  pacoteAtraso = 250;
  const impL = await importar(L2.pg, soLink, {
    antesDeTocar: async (pg) => { await pg.waitForTimeout(300); await pg.screenshot({ path: foto('folha-1-previa-360.png') }); },
    durante: async (pg) => {
      await esperar(pg, () => !document.getElementById('appDialogBarra').hidden
        && /^\d+%$/.test(document.getElementById('appDialogMsg').textContent), null, 30000);
      await pg.waitForTimeout(400);
      duranteL = await pg.evaluate(() => ({
        aberta: document.getElementById('appDialog').classList.contains('open'),
        mesma: document.querySelector('#appDialog .dialog-card').classList.contains('previa-culto'),
        capas: !document.getElementById('appDialogCapas').hidden,
        titulo: document.getElementById('appDialogTitle').textContent,
        msg: document.getElementById('appDialogMsg').textContent,
        rodape: document.getElementById('appDialogRodape').textContent,
        ok: document.getElementById('appDialogOk').textContent,
        cancelOculto: document.getElementById('appDialogCancel').hidden,
        largura: document.getElementById('appDialogBarra').getBoundingClientRect().width,
      }));
      await pg.screenshot({ path: foto('folha-2-progresso-360.png') });
    },
    antesDoOk: async (pg) => { await pg.waitForTimeout(250); await pg.screenshot({ path: foto('folha-3-fim-360.png') }); },
  });
  pacoteAtraso = 0;
  const pvL = impL.previa || {};
  checar(/^3 itens · /.test(pvL.msg) && /1 vem junto · 2 para baixar depois · 0 já no aparelho/.test(pvL.msg),
    '16.d · a prévia conta à parte: "1 vem junto · 2 para baixar depois · 0 já no aparelho"', JSON.stringify(pvL));
  checar(duranteL && duranteL.aberta && duranteL.mesma && duranteL.capas && duranteL.titulo === 'Culto com links'
    && /^\d+%$/.test(duranteL.msg) && duranteL.ok === 'Parar' && duranteL.cancelOculto && duranteL.largura > 100,
  '16.a · depois do Importar a MESMA folha (as capas e o título) vira progresso: a barra, o "N%" e o "Parar"',
  JSON.stringify(duranteL));
  const posL = await L2.pg.evaluate(async () => ({
    ativo: (await AVDB.cronoLer()).ativo, nomes: (await AVDB.cronoLer()).itens.map((x) => x.nome),
    falta: (await itensQueNaoTocamSemRede()).map((x) => x.item.id + ':' + x.tipo).sort(),
    alerta: !document.getElementById('cronoAlerta').hidden,
    fotoBytes: ((await AVDB.getMediaCru('foto-1')) || {}).blob ? 3000 : 0,
    topo: (() => {
      document.getElementById('itinBarBtn').hidden = false;
      const R = (id) => document.getElementById(id).getBoundingClientRect();
      return { itin: R('itinBarBtn').right, alerta: R('cronoAlerta').left, titulo: R('cronoTitulo').right,
        gear: R('settingsBtn').left };
    })(),
    siglas: [cultoMarcaDoHinario({ folder: 'hymnal-2022' }), cultoMarcaDoHinario({ cue: 'songlyrics',
      data: { collId: 'hymnal-1996' } }), cultoMarcaDoHinario({ folder: 'hymnal-1996' })],
  }));
  checar(posL.topo.alerta >= posL.topo.itin && posL.topo.titulo <= posL.topo.gear,
    '16 · a 360, com um nome longo e o alerta à vista, o alerta NÃO cobre a porta do itinerário e o '
    + 'nome não passa da engrenagem (o par preso na trilha)', JSON.stringify(posL.topo));
  checar(JSON.stringify(posL.siglas) === '[""," (1996)"," (1996)"]',
    '16 · na capa o hinário NOVO fica só com o número e o de 1996 ganha " (1996)" — pela faixa ou pela cena de letra',
    JSON.stringify(posL.siglas));
  checar(impL.msg === '“Culto com links” entrou e está em uso.\n2 itens vêm para baixar: toque no aviso do cronograma.'
    + '\nO arquivo recebido foi apagado.',
    '16.a · o fim é curto e diz quantos itens ficam para baixar pelo aviso', JSON.stringify(impL.msg));
  checar(JSON.stringify(posL.falta) === '["arq-cat:hino","yt-1:video"]' && posL.alerta && posL.fotoBytes === 3000,
    '16.d · no destino o aviso do cronograma acusa o vídeo e a faixa (conferida no DISCO); a foto toca',
    JSON.stringify(posL));
  await L2.ctx.close();

  // ===== Q · PACOTE SEM ESCOPO DE CULTO: o import de hoje, sem prévia =====
  const semEscopo = (() => {
    const partes = [P.assinatura()];
    registros(comCapa).forEach((r, i) => {
      if (r.cab.t === 'info' && r.cab.capa) return;
      let corpo = r.corpo;
      let cab = r.cab;
      if (i === 0) {
        const inf = JSON.parse(txt(corpo));
        delete inf.escopo; delete inf.culto; delete inf.capas;
        corpo = new TextEncoder().encode(JSON.stringify(inf));
        cab = Object.assign({}, cab, { bytes: corpo.length });
      }
      partes.push(P.cabecalhoParaBytes(cab), corpo);
    });
    const n = partes.reduce((t, u) => t + u.length, 0);
    const out = new Uint8Array(n);
    let o = 0;
    for (const u of partes) { out.set(u, o); o += u.length; }
    return out;
  })();
  const Qv = await aparelho(semEscopo);
  const impQ = await importar(Qv.pg, semEscopo);
  checar(impQ.abriu === true && !impQ.previa && /Acervo importado/.test(impQ.titulo),
    'Q · um pacote SEM `escopo: culto` não tem prévia: o Importar de hoje vai direto ao relatório',
    JSON.stringify(impQ));
  await Qv.ctx.close();

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
