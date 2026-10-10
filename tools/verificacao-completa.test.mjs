#!/usr/bin/env node
// ============================================================================
// A VERIFICAÇÃO COMPLETA — um download DE VERDADE, medido e apagado (v1.12.27).
//
// ## Por que este oráculo existe
//
// Pedido do operador: *"faça que o app baixe aleatoriamente um dos vídeos
// anteriores do Provai e Vede que ainda não estão no sistema, e acompanhe todo
// o processo… Após o download, finalize a verificação e então exclua o arquivo.
// Na aba de verificação, faça dois botões: leve e completa"*.
//
// É a única checagem que BAIXA megabytes, e por isso as falhas que importam
// são as que deixam rastro ou atrapalham o culto — todas MUDAS:
//
//  1. **A LEVE BAIXANDO.** A leve é a de sempre e roda ao abrir a folha; um
//     download nela seria centenas de MB a cada toque em "Verificar".
//  2. **O CAMINHO ERRADO.** O teste vale pelo que o operador vive: o MESMO
//     download do "Tocar agora" (o teto dele, `ytFetchAte` a 720p). Medir o
//     `ytFetch` de 1080p mediria outro app.
//  3. **O EPISÓDIO ERRADO.** O da semana (o aparelho o guarda sozinho, e a
//     limpeza o apagaria) ou um que já está no aparelho (não baixaria nada).
//  4. **O RASTRO.** O registro com os bytes, ou o arquivo intermediário do
//     shell, ficando para trás — em TODO desfecho: sucesso, cancelamento,
//     falha, prazo. E o que sobrar tem de virar FALHA na linha, nunca silêncio.
//  5. **O CULTO.** Começar com mídia no ar, com outro download, ou na rede que
//     o operador não liberou; e não SAIR da frente quando uma mídia entra no ar
//     no meio. Mudar a cena ou tocar alguma coisa.
//  6. **A MEDIDA VAZIA.** Tamanho, duração, tempos e velocidade no resultado e
//     no Registro — sem eles o recurso é só "baixou".
//
//   node tools/verificacao-completa.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperar, esperarCortina, porque, checar, falhas, RAIZ_WEB } from './arnes.mjs';

// O ARQUIVO QUE O "SHELL" ENTREGA: um WAV de 20 s, servido pelo mesmo servidor
// do bundle porque o `ytBaixarNativo` BUSCA a URL devolvida. Cada entrega tem
// um TOKEN, e o `ytDiscard` do stub o apaga AQUI (pelo `/descartar/<t>`): é o
// que deixa a sonda de limpeza medir de verdade se o arquivo do shell sumiu.
function wav(segundos) {
  const sr = 8000, n = sr * segundos;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 20) * 3000), 44 + i * 2);
  return b;
}
const ARQUIVO = wav(20);
const descartados = new Set();
const servidor = servirEstatico(RAIZ_WEB, (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  let m = /^\/shell\/([a-z0-9]+)\.wav$/.exec(p);
  if (m) {
    if (descartados.has(m[1])) { res.writeHead(404); res.end(); return true; }
    res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': ARQUIVO.length });
    res.end(ARQUIVO);
    return true;
  }
  m = /^\/descartar\/([a-z0-9]+)$/.exec(p);
  if (m) { descartados.add(m[1]); res.writeHead(204); res.end(); return true; }
  return false;
});

// A PONTE. `__yt` comanda o "download": quantos passos de progresso, o
// intervalo, se resolve ou falha, se o descarte apaga. `__chamadas` guarda o
// que o app pediu, em ordem. SEM CRASE NEM DOLAR-CHAVE NESTES COMENTARIOS.
const PONTE = `(function () {
  window.__chamadas = [];
  window.__yt = { passos: 6, intervalo: 60, falhar: false, descartaApaga: true, tamanho: ${ARQUIVO.length} };
  let seq = 0;
  let cancelados = new Set();
  const vazio = { displays: [], listFolder: [], otaPending: '', otaDiag: '',
    espelhoEstado: { ligado: false, telas: [], redes: [] }, espelhoDiag: {},
    castTarget: { label: '' }, apkProcurar: {}, ytDiag: '', cifraDiag: '',
    farolEstado: { conta: true, ultimo: 0, diag: 'de teste' } };
  const comCallId = new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','castTarget','saidaDeAudioAlvo',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','apkProcurar','otaPending','otaApply',
    'otaCheck','otaDiag','ytDiag','cifraDiag','farolEstado','ytCanalPlaylists','ytPlaylist',
    'ytDetalhes','areaTransferencia','salvarTexto','cifraHtml','apkInstalar','espelhoCertImportar',
    'espelhoCertApagar','pacoteConsumirOrigem','pacoteEspaco','pacoteProntoEstado','pacoteDiag']);
  function baixar(nome, id, url, teto) {
    window.__chamadas.push({ n: nome, url: url, teto: teto });
    const cfg = window.__yt;
    const total = cfg.tamanho;
    let i = 0;
    const passo = () => {
      if (cancelados.has(url)) { cancelados.delete(url); window.__avResolve(id, null); return; }
      if (i < cfg.passos) {
        i++;
        window.__avYtProgress(id, Math.round(total * i / cfg.passos), total);
        setTimeout(passo, cfg.intervalo);
        return;
      }
      if (cfg.falhar) { window.__avResolve(id, null); return; }
      const t = 'f' + (++seq) + Date.now().toString(36);
      window.__ultimoToken = t;
      window.__avResolve(id, { url: location.origin + '/shell/' + t + '.wav', name: 'do shell',
        size: total, type: 'audio/wav', audioOnly: false, height: 720, seconds: 20 });
    };
    setTimeout(passo, cfg.intervalo);
  }
  const B = {
    shellVersion: () => 78, role: () => 'controle', appVersion: () => '9.99-teste',
    takeShare: () => '', busPost: () => {}, otaConfirm: () => {}, bgProgress: () => {},
    ytFetch: (id, url) => baixar('ytFetch', id, url, 0),
    ytFetchAte: (id, url, teto) => baixar('ytFetchAte', id, url, teto),
    ytFetchAudio: (id, url) => baixar('ytFetchAudio', id, url, 0),
    ytCancel: (url) => { window.__chamadas.push({ n: 'ytCancel', url: url }); cancelados.add(url); },
    ytDiscard: (url) => {
      window.__chamadas.push({ n: 'ytDiscard', url: url });
      if (!window.__yt.descartaApaga) return;
      const m = /\\/shell\\/([a-z0-9]+)\\.wav/.exec(url);
      if (m) fetch('/descartar/' + m[1]);
    },
    // A LINHA DE EXTRAÇÃO É A DE UM REGISTRO REAL, longa e com chaves no meio: o
    // slice(-160) que a cortava no meio de um par de chaves (v1.12.29) só
    // aparece com uma linha maior que o corte.
    ytDiag: (id) => setTimeout(() => window.__avResolve(id,
      'download: áudio 10 [m4a 4, webm 6] {en-US dublado 5, pt-BR 5} · vídeo-só 12 [mp4 6 (1080p), '
      + 'webm 6 (1080p)] · prog 1 [mp4 1 (360p)] · clientes VISIONOS 22, ANDROID 1 → juntou 720p '
      + '(mp4, 136@VISIONOS/V)'), 0),
  };
  const nomes = ['apkInstalar','apkProcurar','captureVolumeKeys','castTarget','saidaDeAudioAlvo',
    'deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar','espelhoCertEstado',
    'espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado','espelhoLigar',
    'keepAlive','listFolder','nowPlaying','openCast','abrirSaidaDeAudio','openExternal','otaApply','otaCheck',
    'otaDiag','otaPending','pickFolder','pickDoc','systemVolume','temaClaro',
    'ytCanalPlaylists','ytPlaylist','ytSearch','ytStream','farolEstado','projecaoLocal','cifraHtml',
    'cifraDiag','areaTransferencia','salvarTexto','ytDetalhes','pacoteEspaco','pacoteProntoEstado','pacoteDiag'];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      if (!comCallId.has(n)) return undefined;
      const id = args[0];
      setTimeout(() => window.__avResolve(id, (n in vazio) ? vazio[n] : null), 0);
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

// O CATÁLOGO DO PROVAI E VEDE, plantado: o da SEMANA (não pode ser sorteado),
// três anteriores livres e um anterior que JÁ ESTÁ no aparelho (como link).
// O ano da série é o de HOJE, para o oráculo não envelhecer: `diasAte` conta
// pelo `serie.ano`, e com 2026 fixo tudo viraria "anterior" em 2027.
const SEMEAR = async () => {
  const serie = AVSerie.SERIES.find((s) => s.prefixo === 'Provai e Vede');
  const hoje = new Date();
  serie.ano = hoje.getFullYear();
  const dia = (delta) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + delta);
    return d.getFullYear() === hoje.getFullYear() ? { mes: d.getMonth() + 1, dia: d.getDate() } : null;
  };
  const ep = (id, delta, nome) => ({ id_music: id, ytUrl: 'https://www.youtube.com/watch?v=' + id,
    name: nome, serieData: dia(delta), canal: 'Provai e Vede' });
  const songs = [
    ep('semanaAAAA1', 0, 'Episódio da semana'),
    ep('anteriorBB1', -14, 'Anterior 1'),
    ep('anteriorBB2', -21, 'Anterior 2'),
    ep('anteriorBB3', -28, 'Anterior 3'),
    ep('guardadoCC1', -35, 'Já guardado'),
  ].filter((s) => s.serieData);
  // A ROTINA DO EPISÓDIO DA SEMANA FICA CALADA: com "Dados móveis" ligado ela
  // baixaria o da semana sozinha, e o oráculo passaria a medir dois downloads.
  window.manterSeriesDaSemana = async () => {};
  collState[serie.id] = { songs, indexSyncedAt: Date.now() };
  await AVDB.addUrlMedia(songs.find((s) => s.id_music === 'guardadoCC1').ytUrl, {
    kind: 'youtube', type: 'video/youtube', name: 'Já guardado', youtubeId: 'guardadoCC1', list: 'imports' });
  permitirDadosMoveis = true;
  window.__cmds = [];
  const real = AVDB.sendCommand;
  AVDB.sendCommand = (m) => { window.__cmds.push(m && m.type); return real.call(AVDB, m); };
  window.__estados = [];
  const up = AVDB.updateState;
  AVDB.updateState = (k, fn) => { window.__estados.push(k); return up.call(AVDB, k, fn); };
  return songs.map((s) => s.id_music);
};

await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;
const navegador = await abrirNavegador();
const erros = [];

async function aparelho(viewport) {
  const ctx = await navegador.newContext({ viewport: viewport || { width: 430, height: 900 } });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  await pg.waitForFunction(() => window.AVDB && typeof window.rodarAutoteste === 'function'
    && typeof window.testeDownloadCompleto === 'function', null, { timeout: 30000 });
  const ids = await pg.evaluate(SEMEAR);
  // O APP ASSENTADO: nenhum trabalho de abertura segurando a fila de download.
  const quieto = await esperar(pg, () => !bgWorkPedido() && !serieAutoRodando, null, 20000);
  checar(quieto === true, 'premissa · o app abre sem download andando', porque(quieto));
  return { ctx, pg, ids };
}

// A rodada completa pelo BOTÃO, esperando o FATO (o resultado completo novo).
// A FOLHA TEM DE TER ASSENTADO antes do toque: ela SOBE por transição, e um
// toque no meio dela cai noutro lugar (a régua do `verificacao-do-sistema`, I2).
const assentar = (pg) => pg.evaluate(async () => {
  await Promise.all([...document.querySelectorAll('#testePopup, #testePopup *')]
    .flatMap((n) => n.getAnimations().map((a) => a.finished.catch(() => {}))));
});
async function rodarCompletaPeloBotao(pg) {
  await assentar(pg);
  await pg.evaluate(() => { window.__antes = Date.now(); });
  await pg.click('#testeCompleta');
  return esperar(pg, () => !testeRodando && testeResultado && testeResultado.completa
    && testeResultado.emCompleta >= window.__antes, null, 60000);
}
const itemDl = (pg) => pg.evaluate(() => {
  const it = testeResultado && testeResultado.itens.find((x) => x.id === 'yt-download');
  return it ? { v: it.v, nota: it.nota } : null;
});
const sobras = (pg, vid) => pg.evaluate(async (v) => {
  const rec = v ? await AVDB.mediaByYoutube(v) : null;
  return { rec: !!rec, avulsos: (await AVDB.listIds('avulsos')).length, cancelados: ytCancelados.size };
}, vid);

try {
  // ---- A: UM BOTÃO SÓ, E A LEVE (que roda ao abrir) NÃO BAIXA NADA -------
  {
    const { ctx, pg } = await aparelho();
    const durante = await pg.evaluate(() => {
      openTestePopup();
      const b = document.getElementById('testeCompleta');
      return { dis: b.disabled, title: b.title };
    });
    checar(durante.dis && /[Ee]spere/.test(durante.title),
      'A0 · enquanto a leve roda, a completa fica APAGADA, com o motivo — ela é "além do que já foi '
      + 'feito", e sem o feito não há o que somar', JSON.stringify(durante));
    const r = await esperar(pg, () => !testeRodando && testeResultado, null, 30000);
    checar(r === true, 'A0 · a folha abre e a rodada LEVE de sempre termina', porque(r));
    const a = await pg.evaluate(() => ({
      leve: !!document.getElementById('testeRodar'),
      botoes: [...document.querySelectorAll('#testePopup .popup-fecho button:not([hidden])')].map((x) => x.id),
      completa: document.getElementById('testeCompleta').textContent.trim(),
      completaAtiva: !document.getElementById('testeCompleta').disabled,
      res: { completa: testeResultado.completa, temDl: testeResultado.itens.some((x) => x.id === 'yt-download') },
      baixou: window.__chamadas.filter((c) => /^ytFetch/.test(c.n)).length,
    }));
    checar(!a.leve && a.completa === 'Verificação completa',
      'A1 · o botão "Leve" SAIU (a leve roda ao abrir) e o que sobra é "Verificação completa"',
      JSON.stringify(a));
    checar(a.res.completa === false && !a.res.temDl && a.baixou === 0,
      'A2 · a rodada que abre a folha é a LEVE: nenhuma linha de download no resultado e nenhum pedido de '
      + 'vídeo à ponte — a leve nunca baixa megabytes', JSON.stringify(a));
    checar(a.completaAtiva, 'A3 · terminada a leve, com a ponte, a Completa é tocável', JSON.stringify(a));
    await ctx.close();
  }

  // ---- A5: A FAIXA A 320 × 1,5 — o rótulo inteiro, uma altura só -----------
  {
    const { ctx, pg } = await aparelho({ width: 320, height: 640 });
    await pg.evaluate(() => { document.documentElement.style.fontSize = '150%'; window.__NATIVE__ = true; });
    await pg.evaluate(() => { document.getElementById('testeSalvar').hidden = false; openTestePopup(); });
    await esperar(pg, () => !testeRodando && testeResultado, null, 30000);
    const f = await pg.evaluate(() => {
      const m = (id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect();
        return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), cortou: e.scrollWidth > e.clientWidth + 1 }; };
      const fx = document.getElementById('testeSalvar').parentElement;
      // LINHAS DE TEXTO por Range: um rótulo que QUEBRA não transborda
      // (`scrollWidth` fica igual), então a régua do corte sozinha aprova a quebra.
      const linhas = (el) => { const rg = document.createRange(); rg.selectNodeContents(el);
        return new Set([...rg.getClientRects()].map((q) => Math.round(q.top))).size; };
      return { salvar: m('testeSalvar'), completa: m('testeCompleta'),
        linhasCompleta: linhas(document.getElementById('testeCompleta')),
        linhasSalvar: linhas(document.getElementById('testeSalvar').querySelector('span')),
        faixaVaza: fx.scrollWidth > fx.clientWidth + 1 };
    });
    checar(!f.completa.cortou,
      'A5 · a 320px com a fonte a 1,5× "Verificação completa" cabe inteiro', JSON.stringify(f));
    checar(Math.abs(f.salvar.h - f.completa.h) < 0.5,
      'A5 · e a faixa tem UMA altura (o "Registro" e o primário)', JSON.stringify(f));
    checar(!f.salvar.cortou && !f.faixaVaza && f.linhasCompleta === 1 && f.linhasSalvar === 1,
      'A5 · e o "Registro" (v1.12.29: ícone E palavra) também cabe inteiro, sem a faixa transbordar e '
      + 'sem nenhum dos dois rótulos quebrar em duas linhas',
      JSON.stringify(f));
    await ctx.close();
  }

  // ---- B: A COMPLETA — o caminho, o episódio, a medida e a limpeza -------
  {
    const { ctx, pg } = await aparelho();
    await pg.evaluate(() => openTestePopup());
    await esperar(pg, () => !testeRodando && testeResultado, null, 30000);
    await pg.evaluate(() => {
      window.__chamadas.length = 0; window.__cmds.length = 0; window.__estados.length = 0;
      window.__leve = { em: testeResultado.em, itens: testeResultado.itens.slice(), n: testeResultado.itens.length };
      window.__rodadas = 0;
      const real = window.rodarUmaChecagem;
      window.rodarUmaChecagem = (c) => { window.__rodadas++; return real(c); };
    });
    const r = await rodarCompletaPeloBotao(pg);
    checar(r === true, 'B0 · a rodada completa termina', porque(r));
    const so = await pg.evaluate(() => ({
      rodadas: window.__rodadas, mesmoEm: testeResultado.em === window.__leve.em,
      mesmas: window.__leve.itens.every((x) => testeResultado.itens.includes(x)),
      n: testeResultado.itens.length, antes: window.__leve.n,
      dl: testeResultado.itens.filter((x) => x.id === 'yt-download').length,
      contas: testeResultado.ok + testeResultado.falhou + testeResultado.mudo + testeResultado.na,
    }));
    checar(so.rodadas === 1 && so.mesmoEm && so.mesmas && so.n === so.antes + 1 && so.dl === 1
      && so.contas === so.n,
      'B0 · a completa roda SÓ a linha do download, por cima da leve: as 41 não rodam de novo, o '
      + 'resultado é o MESMO objeto com UMA linha a mais, e as contas são refeitas com ela', JSON.stringify(so));
    const it = await itemDl(pg);
    checar(it && it.v === 'ok', 'B1 · a linha do download PASSA, com a nota dizendo o que veio', JSON.stringify(it));
    const d = await pg.evaluate(() => {
      const m = testeResultado.download;
      return {
        chamadas: window.__chamadas.map((c) => ({ n: c.n, teto: c.teto, url: c.url })),
        cmds: window.__cmds.slice(), estados: window.__estados.slice(),
        teto: m.teto, ep: m.episodio, bytes: m.bytes, h: m.r && m.r.height,
        seg: m.meta && m.meta.segundos, caminho: m.caminho, rede: !!m.redeInicio && !!m.redeFim,
        contas: m.contas, limpeza: m.limpeza, amostras: m.amostras.length,
        nota: testeResultado.itens.find((x) => x.id === 'yt-download').nota,
        registro: blocoAutoteste(),
        hLeve: new Date(testeResultado.em).toLocaleString(),
        hCompleta: new Date(testeResultado.emCompleta).toLocaleString(),
      };
    });
    const pedidos = d.chamadas.filter((c) => /^ytFetch/.test(c.n));
    checar(pedidos.length === 1 && pedidos[0].n === 'ytFetchAte' && pedidos[0].teto === 720 && d.teto === 720,
      'B2 · o caminho é o do "Tocar agora": UM pedido, pelo `ytFetchAte`, no teto do operador (720p) — '
      + 'medir o ytFetch de 1080p mediria outro app', JSON.stringify(pedidos));
    checar(d.ep && /^anteriorBB[123]$/.test(d.ep.id) && pedidos[0].url.endsWith(d.ep.id),
      'B3 · o episódio sorteado é um ANTERIOR que não está no aparelho — nunca o da semana, nunca o '
      + 'já guardado', JSON.stringify(d.ep));
    checar(d.bytes === ARQUIVO.length && d.h === 720 && d.seg > 19.5 && d.seg < 20.5 && d.caminho === 'juntou',
      'B4 · a medida tem o tamanho, a altura que veio, a DURAÇÃO lida do arquivo gravado e o caminho do shell',
      JSON.stringify({ bytes: d.bytes, h: d.h, seg: d.seg, caminho: d.caminho }));
    const c = d.contas || {};
    checar(d.rede && d.amostras >= 6 && c.total > 0 && c.baixando > 0 && c.mbpsMedia > 0
      && c.ateOPrimeiroByte >= 0 && c.copia >= 0 && c.gravacao >= 0 && c.razao > 0,
      'B5 · e os TEMPOS por fase, a velocidade e a razão duração ÷ tempo saem contados',
      JSON.stringify({ rede: d.rede, amostras: d.amostras, c }));
    checar(/Download de teste — detalhe/.test(d.registro) && /duração do vídeo: 0:20/.test(d.registro)
      && /tempos: até o 1º byte/.test(d.registro) && /velocidade: média/.test(d.registro)
      && /limpeza: registro apagado · arquivo do shell apagado/.test(d.registro)
      && /não medido \(só com APK novo\)/.test(d.registro),
      'B6 · o Registro (o MESMO texto que o "Salvar" grava) traz a medida inteira, a limpeza e o que '
      + 'não se mede sem APK', d.registro.split('\n').filter((l) => /Download|duração|limpeza|tempos/.test(l)).join(' | '));
    // B6b · O CAMINHO VAI INTEIRO (v1.12.29): o corte de 160 caracteres pegava o
    // MEIO de um `{…}` e o Registro saía com "—  dublado 5, pt-BR 5} · …".
    const caminho = d.registro.split('\n').find((l) => /^\s+caminho: /.test(l)) || '';
    checar(/ — áudio 10 \[m4a 4, webm 6\] \{en-US dublado 5, pt-BR 5\} · vídeo-só 12 /.test(caminho)
      && / → juntou 720p \(mp4, 136@VISIONOS\/V\)$/.test(caminho) && !/download:/.test(caminho),
      'B6b · a linha "caminho:" do Registro traz a extração INTEIRA, do começo ao fim, sem o prefixo do diário',
      caminho);
    // B6c · O CARIMBO DIZ AS DUAS HORAS (v1.12.29): a completa soma uma linha à
    // leve, e o `r.em` sozinho a datava com a hora da LEVE.
    const carimbo = d.registro.split('\n')[1] || '';
    checar(carimbo.startsWith('  COMPLETA — leve rodada em ' + d.hLeve + ' · ')
      && carimbo.endsWith(' · download de teste terminado em ' + d.hCompleta),
      'B6c · o carimbo da completa diz a hora da leve E a hora em que o download de teste terminou',
      JSON.stringify({ carimbo, leve: d.hLeve, completa: d.hCompleta }));
    const s = await sobras(pg, d.ep && d.ep.id);
    checar(!s.rec && s.avulsos === 0 && d.limpeza.registro === true && d.limpeza.arquivoDoShell === true,
      'B7 · e NADA fica: nem o registro com os bytes, nem a prateleira, nem o arquivo do shell',
      JSON.stringify({ s, l: d.limpeza }));
    checar(d.chamadas.some((x) => x.n === 'ytDiscard'),
      'B7 · o arquivo intermediário é descartado pela ponte', JSON.stringify(d.chamadas.map((x) => x.n)));
    checar(d.cmds.every((t) => t === 'diag-ask'),
      'B8 · e a cena não muda: nenhum comando ao telão além do `diag-ask` da bateria leve',
      JSON.stringify(d.cmds));
    checar(!d.estados.includes('ytIntencoes'),
      'B9 · e o teste não grava intenção de RESGATE — um teste levado pelo renderer não volta a baixar '
      + 'sozinho na abertura seguinte', JSON.stringify(d.estados));
    checar(/^720p · .* em .* · vídeo de 0:20 · .*× a duração · apagado$/.test(d.nota),
      'B10 · a nota da linha diz em uma olhada: qualidade, tamanho, tempo, velocidade, duração e que foi apagado',
      d.nota);
    await ctx.close();
  }

  // ---- C: CANCELAR — pelo mesmo botão, e a limpeza continua -----------------
  {
    const { ctx, pg } = await aparelho();
    await pg.evaluate(() => { window.__yt.passos = 200; window.__yt.intervalo = 50; openTestePopup(); });
    await esperar(pg, () => !testeRodando && testeResultado, null, 30000);
    await assentar(pg);
    await pg.evaluate(() => { window.__antes = Date.now(); window.__chamadas.length = 0; });
    const antes = await pg.evaluate(() => { const r = document.getElementById('testeCompleta').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
    await pg.click('#testeCompleta');
    const andando = await esperar(pg, () => testeDl && testeDl.amostras.length > 3, null, 30000);
    checar(andando === true, 'C0 · o download de teste começa e o progresso chega', porque(andando));
    const meio = await pg.evaluate(() => {
      const b = document.getElementById('testeCompleta'); const r = b.getBoundingClientRect();
      const linha = document.querySelector('[data-teste="yt-download"]');
      return { txt: b.textContent.trim(), dis: b.disabled, leveDis: true,
        linha: linha && linha.className, nota: linha && linha.querySelector('.teste-nota').textContent,
        rect: [r.x, r.y, r.width, r.height], resumo: document.getElementById('testeResumo').textContent };
    });
    checar(meio.txt === 'Cancelar' && !meio.dis && meio.leveDis,
      'C1 · enquanto anda, a Completa vira "Cancelar"', JSON.stringify(meio));
    checar(/teste-item--curso/.test(meio.linha || '') && /^Download de teste: \d+% · /.test(meio.nota || ''),
      'C1b · e a LINHA do download, que existia desde a abertura, mostra o andamento — pendente → '
      + 'progresso → resultado, no mesmo lugar', JSON.stringify(meio));
    checar(JSON.stringify(meio.rect) === JSON.stringify(antes),
      'C2 · no MESMO lugar e do MESMO tamanho — a faixa não se move', JSON.stringify({ antes, depois: meio.rect }));
    checar(/^Download de teste: \d+% · /.test(meio.resumo),
      'C3 · e o resumo mostra o PROGRESSO do download, não um "Verificando…" parado', meio.resumo);
    await pg.click('#testeCompleta');
    const fim = await esperar(pg, () => !testeRodando && testeResultado.emCompleta >= window.__antes, null, 30000);
    checar(fim === true, 'C4 · cancelado, a rodada termina', porque(fim));
    const it = await itemDl(pg);
    const x = await pg.evaluate(() => ({ chamadas: window.__chamadas.map((c) => c.n), ep: testeResultado.download.episodio.id,
      txt: document.getElementById('testeCompleta').textContent.trim() }));
    checar(it && it.v === 'na' && /cancelado por você/.test(it.nota) && x.chamadas.includes('ytCancel'),
      'C5 · a linha diz que FOI CANCELADO (não é falha), e o pedido de parar chegou ao shell',
      JSON.stringify({ it, x }));
    const s = await sobras(pg, x.ep);
    checar(!s.rec && s.avulsos === 0 && s.cancelados === 0 && x.txt === 'Verificação completa',
      'C6 · e nada fica para trás — nem registro, nem a marca de cancelado que armaria o próximo download '
      + 'deste vídeo —, e o botão volta a ser "Verificação completa"', JSON.stringify({ s, txt: x.txt }));
    await ctx.close();
  }

  // ---- D: FALHA, PRAZO VENCIDO E UMA MÍDIA QUE ENTRA NO AR ---------------
  {
    const { ctx, pg } = await aparelho();
    // D1 · a falha do shell
    let r = await pg.evaluate(async () => { window.__yt.falhar = true; const x = await testeDownloadCompleto(); window.__yt.falhar = false; return x; });
    checar(r.v === 'falhou' && /o vídeo não baixou/.test(r.nota),
      'D1 · o shell que não entrega é FALHA, com o episódio na nota', JSON.stringify(r));
    let s = await sobras(pg, await pg.evaluate(() => testeDl.episodio.id));
    checar(!s.rec && s.cancelados === 0, 'D1 · e a falha também não deixa rastro', JSON.stringify(s));
    // D2 · uma mídia ENTRA no ar no meio: o teste sai da frente
    r = await pg.evaluate(async () => {
      window.__yt.passos = 200; window.__yt.intervalo = 50;
      const p = testeDownloadCompleto();
      while (!(testeDl && testeDl.amostras.length > 2)) await new Promise((x) => setTimeout(x, 20));
      midiaNoAr = true;
      const x = await p;
      midiaNoAr = false;
      return { x, cancel: window.__chamadas.some((c) => c.n === 'ytCancel') };
    });
    checar(r.x.v === 'na' && /mídia entrou no ar/.test(r.x.nota) && r.cancel,
      'D2 · uma mídia que entra no ar no meio CANCELA o teste — centenas de MB disputando a rede com a '
      + 'projeção é o oposto de não atrapalhar', JSON.stringify(r));
    s = await sobras(pg, await pg.evaluate(() => testeDl.episodio.id));
    checar(!s.rec && s.cancelados === 0, 'D2 · e apaga o que tinha', JSON.stringify(s));
    // D3 · O RASTRO VIRA FALHA: o shell que não apaga o intermediário
    r = await pg.evaluate(async () => {
      window.__yt.passos = 3; window.__yt.intervalo = 20; window.__yt.descartaApaga = false;
      const x = await testeDownloadCompleto();
      window.__yt.descartaApaga = true;
      return { x, limpeza: testeDl.limpeza };
    });
    checar(r.x.v === 'falhou' && /arquivo do shell ficou no cache/.test(r.x.nota) && r.limpeza.registro === true,
      'D3 · o que SOBRA é falha com nome — o arquivo do shell que não sumiu não passa calado', JSON.stringify(r));
    await ctx.close();
  }

  // ---- E: AS GUARDAS DE ENTRADA — nada é pedido à ponte -------------------
  {
    const { ctx, pg } = await aparelho();
    const g = await pg.evaluate(async () => {
      const pedidos = () => window.__chamadas.filter((c) => /^ytFetch/.test(c.n)).length;
      const out = {};
      midiaNoAr = true; out.cena = await testeDownloadCompleto(); midiaNoAr = false;
      permitirDadosMoveis = false; out.rede = await testeDownloadCompleto(); permitirDadosMoveis = true;
      bgWorkBegin(); out.fila = await testeDownloadCompleto(); bgWorkEnd();
      out.pedidos = pedidos();
      // pela rodada: com mídia no ar a linha sai "não se aplica" sem chamar a função
      await rodarAutoteste();
      midiaNoAr = true; const res = await rodarDownloadDeTeste(); midiaNoAr = false;
      out.rodada = res.itens.find((x) => x.id === 'yt-download');
      out.pedidos2 = pedidos();
      return out;
    });
    checar(g.cena.v === 'na' && /mídia no ar/.test(g.cena.nota),
      'E1 · com mídia no ar o download de teste NÃO começa', JSON.stringify(g.cena));
    checar(g.rede.v === 'na' && /Dados móveis/.test(g.rede.nota),
      'E2 · sem Wi-Fi confirmado e com "Dados móveis" desligado, ele não começa — e diz qual chave liberaria',
      JSON.stringify(g.rede));
    checar(g.fila.v === 'na' && /download em andamento/.test(g.fila.nota),
      'E3 · com outro download andando ele não começa — mediria a fila, não a rede', JSON.stringify(g.fila));
    checar(g.rodada && g.rodada.v === 'na' && g.pedidos === 0 && g.pedidos2 === 0,
      'E4 · e em nenhum dos casos a ponte recebe pedido de vídeo', JSON.stringify(g));
    await ctx.close();
  }

  // ---- F: O SORTEIO — só anteriores fora do aparelho, e o vazio é dito -----
  {
    const { ctx, pg } = await aparelho();
    const f = await pg.evaluate(async () => {
      // O SORTEIO É `Math.random`: trocá-lo por um instante fixa a ponta.
      const pega = async (v) => {
        const real = Math.random; Math.random = () => v;
        try { return await testeEscolherEpisodio(); } finally { Math.random = real; }
      };
      const a = await pega(0); const b = await pega(0.999);
      const ids = new Set();
      for (let i = 0; i < 40; i++) { const x = await testeEscolherEpisodio(); if (x.s) ids.add(x.s.id_music); }
      // todos guardados
      for (const id of ['anteriorBB1', 'anteriorBB2', 'anteriorBB3']) {
        await AVDB.addUrlMedia('https://www.youtube.com/watch?v=' + id, { kind: 'youtube', type: 'video/youtube',
          name: id, youtubeId: id, list: 'imports' });
      }
      const vazio = await testeEscolherEpisodio();
      return { a: a.s.id_music, b: b.s.id_music, livres: a.livres, anteriores: a.anteriores, ids: [...ids].sort(), vazio: vazio.motivo };
    });
    checar(f.anteriores === 4 && f.livres === 3 && f.a === 'anteriorBB1' && f.b === 'anteriorBB3',
      'F1 · o sorteio vai de ponta a ponta dos ANTERIORES LIVRES: 4 anteriores, 3 fora do aparelho',
      JSON.stringify(f));
    checar(f.ids.every((x) => /^anteriorBB[123]$/.test(x)),
      'F2 · e em 40 sorteios nenhum é o da semana nem o já guardado', JSON.stringify(f.ids));
    checar(/todos os 4 episódios anteriores já estão no aparelho/.test(f.vazio || ''),
      'F3 · sem episódio livre a linha diz por quê (vira "não se aplica", nunca falha)', f.vazio);
    await ctx.close();
  }

  // ---- G: AS CONTAS — janelas, paradas e a razão, de amostras escritas à mão
  {
    const { ctx, pg } = await aparelho();
    const c = await pg.evaluate(() => testeDlContas({
      tInicio: 0, tNativo: 30000, tCopia: 31000, tMiniatura: 31500, tGravado: 32000,
      meta: { segundos: 640 },
      // 1 MB/s por 4 s, PARADA de 6 s, e 2 MB/s por 4 s; o fim da rede em 14 s
      amostras: [[2000, 0, 12e6], [4000, 2e6, 12e6], [6000, 4e6, 12e6], [12000, 4e6, 12e6],
        [14000, 8e6, 12e6], [16000, 12e6, 12e6]],
    }));
    checar(c.ateOPrimeiroByte === 2000 && c.baixando === 14000 && c.juncao === 14000 && c.total === 32000,
      'G1 · as fases saem das marcas certas: 1º byte, rede, junção (até o shell devolver) e total', JSON.stringify(c));
    checar(c.paradas === 1 && c.maiorVao === 6000 && Math.abs(c.mbpsMin - 0) < 1e-9 && Math.abs(c.mbpsMax - 16) < 1e-9,
      'G2 · a parada de 6 s é contada e aparece como a JANELA mais lenta (0 Mbit/s); a mais rápida é 16 Mbit/s',
      JSON.stringify(c));
    checar(Math.abs(c.razao - 20) < 1e-9, 'G3 · e 640 s de vídeo em 32 s de processo é 20× a duração', c.razao);
    // G4 · O COMPASSO DE 1 MB NÃO É PARADA (v1.12.28). O Registro de 10/10:
    // 16 MB em 168 s, um aviso por MB a cada ~9 s, e a régua fixa de 5 s contou
    // "12 paradas" que eram só o compasso. Aqui: 15 vãos de 9 s e UM de 30 s.
    const lento = await pg.evaluate(() => {
      const am = []; let t = 1000;
      for (let i = 0; i <= 16; i++) { am.push([t, i * 1e6, 16e6]); t += (i === 8 ? 30000 : 9000); }
      return testeDlContas({ tInicio: 0, amostras: am });
    });
    checar(lento.paradas === 1 && lento.vaoMediano === 9000,
      'G4 · a um aviso por MB a cada 9 s, só o vão de 30 s é parada — a régua é relativa ao vão mediano '
      + 'daquele download, com o piso de 5 s', JSON.stringify(lento));
    await ctx.close();
  }

  // ---- H: A LISTA EXISTE DESDE O COMEÇO, E CADA LINHA ACENDE QUANDO CHEGA ----
  // Pedido do operador: *"mantenha a lista dos itens a serem verificados
  // visível, dando o check conforme cada um é verificado"*. As linhas nascem
  // pendentes (com a do download à espera) e cada uma troca de marca quando a
  // dela chega. (A rolagem NÃO é asserção: medido pela reversão, recriar a
  // lista inteira a cada resposta também a preserva no Chromium — o layout só
  // roda depois do laço.)
  {
    const { ctx, pg } = await aparelho({ width: 430, height: 640 });
    const h = await pg.evaluate(async () => {
      // UMA checagem LENTA de propósito, para a rodada ter um "meio" medível.
      const lenta = { id: 'z-lenta', area: 'Teste', titulo: 'uma lenta', fn: () => new Promise((r) => setTimeout(() => r(tOk('')), 1500)) };
      TESTES.push(lenta);
      testePopupEl.classList.add('open');
      const p = dispararTeste();
      const lis = () => [...document.querySelectorAll('#testeList [data-teste]')];
      const inicio = { n: lis().length, pend: lis().filter((l) => l.classList.contains('teste-item--pendente')).length,
        dl: (document.querySelector('[data-teste="yt-download"]') || {}).className };
      const ordemInicio = lis().map((l) => l.dataset.teste).join(',');
      // espera o MEIO: algumas já chegaram, a lenta ainda não
      let meio = null;
      for (let i = 0; i < 200 && !meio; i++) {
        await new Promise((r) => setTimeout(r, 20));
        const feitas = lis().filter((l) => !/--pendente|--espera/.test(l.className)).length;
        if (testeRodando && feitas > 3) meio = { feitas, pend: lis().filter((l) => l.classList.contains('teste-item--pendente')).length };
      }
      await p;
      const fim = { n: lis().length, pend: lis().filter((l) => l.classList.contains('teste-item--pendente')).length,
        ordem: lis().map((l) => l.dataset.teste).join(',') === ordemInicio };
      TESTES.pop();
      return { inicio, meio, fim, total: TESTES.length + 1 };
    });
    checar(h.inicio.n === h.total + 1 && h.inicio.pend === h.total && /--espera/.test(h.inicio.dl || ''),
      'H1 · no ato do toque a lista INTEIRA já está na tela, cada linha pendente — e a do download à '
      + 'espera da completa', JSON.stringify(h.inicio));
    checar(h.meio && h.meio.feitas > 3 && h.meio.pend > 0,
      'H2 · no meio da rodada umas já acenderam e outras ainda esperam — o check chega linha a linha',
      JSON.stringify(h.meio));
    checar(h.fim.n === h.inicio.n && h.fim.pend === 0 && h.fim.ordem,
      'H3 · no fim são as MESMAS linhas, na mesma ordem, nenhuma pendente', JSON.stringify(h.fim));
    await ctx.close();
  }

  // ---- I: O RESUMO SÓ DIZ QUANTAS FUNCIONARAM E QUANTAS FALHARAM -----------
  {
    const { ctx, pg } = await aparelho();
    const r = await pg.evaluate(async () => {
      testePopupEl.classList.add('open');
      await dispararTeste();
      return { resumo: testeResumoEl.textContent, mudo: testeResultado.mudo, na: testeResultado.na,
        ok: testeResultado.ok, falhou: testeResultado.falhou,
        linhasNa: document.querySelectorAll('#testeList .teste-item--na, #testeList .teste-item--mudo').length,
        registro: blocoAutoteste().split('\n')[2] };
    });
    checar(r.na + r.mudo > 0,
      'I0 · PREMISSA: a rodada tem linhas "não se aplica" ou "sem resposta" — senão o resumo nada provaria',
      JSON.stringify(r));
    checar(r.resumo === r.ok + ' funcionaram · ' + r.falhou + ' com falha',
      'I1 · o resumo da tela diz SÓ quantas funcionaram e quantas falharam — "não se aplica" e "sem '
      + 'resposta" saíram dele', JSON.stringify(r.resumo));
    checar(r.linhasNa === r.na + r.mudo && /sem resposta · \d+ não se aplica/.test(r.registro),
      'I2 · mas as linhas seguem na lista com a marca delas, e o Registro segue com as QUATRO contas',
      JSON.stringify(r));
    await ctx.close();
  }

  // ---- J: "A INTERNET NÃO RESPONDEU" NÃO É A FRASE DA FONTE ------------------
  // O Registro de 10/10 trouxe as quatro linhas da LouvorJA em "a internet não
  // respondeu" com "Há internet agora" verde, sondando o MESMO servidor.
  {
    const { ctx, pg } = await aparelho();
    const j = await pg.evaluate(async () => {
      const c = TESTES.find((x) => x.id === 'fonte-banco');
      const real = Louvorja.fetchList; const sonda = Louvorja.sondarBanco;
      Louvorja.fetchList = () => Promise.reject(new TypeError('Failed to fetch'));
      Louvorja.sondarBanco = async () => true;
      const responde = await rodarUmaChecagem(c);
      Louvorja.sondarBanco = async () => false;
      const calado = await rodarUmaChecagem(c);
      Louvorja.fetchList = real; Louvorja.sondarBanco = sonda;
      const marcadas = TESTES.filter((x) => x.fonte).map((x) => x.id).sort();
      return { responde, calado, marcadas };
    });
    checar(j.responde.v === 'falhou' && /LouvorJA respondeu/.test(j.responde.nota) && /não baixam/.test(j.responde.nota),
      'J1 · o banco que RESPONDE mas não deixa o app ler (CORS, ou erro sem permissão) é FALHA com nome — '
      + 'é o app inteiro sem catálogo, músicas novas e Bíblia, e não o Wi-Fi', JSON.stringify(j.responde));
    checar(j.calado.v === 'mudo' && /servidor da LouvorJA não respondeu/.test(j.calado.nota),
      'J2 · e o que não responde segue SEM RESPOSTA, nomeando o servidor — nunca "a internet"',
      JSON.stringify(j.calado));
    checar(j.marcadas.join(',') === 'fonte-arquivo,fonte-arquivo-imagem,fonte-banco,fonte-biblia',
      'J3 · as QUATRO linhas da fonte passam pela sonda', JSON.stringify(j.marcadas));
    await ctx.close();
  }

  checar(erros.length === 0, 'nenhum erro de página durante o oráculo', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) { console.error('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
