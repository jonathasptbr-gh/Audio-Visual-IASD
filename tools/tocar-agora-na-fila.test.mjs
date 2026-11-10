#!/usr/bin/env node
// ============================================================================
// O "TOCAR AGORA" DE UM VÍDEO VIRA A FILA — E O ITEM EM CURSO APARECE NELA
// (v1.13.56)
//
// ## O relato, e o que ele NÃO era
//
// *"O problema do item que não entra limpando a playlist, é quando o item é
// iniciado no modo simples e depois se vai para o modo avançado."* (2026-11-07)
//
// A suspeita registrada no pacote era a troca de modo REMONTANDO a fila. MEDIDO
// aqui: ela não remonta nada — `setAppMode` escreve classes, o gate, o host da
// preview e os renders do Modo Fácil, e não toca em `plItems` nem no banco. A
// fila que o Avançado mostra é a que já existia quando o operador trocou.
//
// **A causa está no TOQUE, não na troca:** o "Tocar agora" de um vídeo do
// YouTube (o caminho da série no Modo Fácil: a linha TOCA com um toque) baixava,
// fixava o arquivo na prateleira `avulsos` e chamava `send` — sem passar pelo
// funil que todo item comum usa (`projetarItem` → `replacePlaylistWith`). A fila
// ficava a ANTERIOR, o item em curso não estava nela, e o operador só via isso
// no Avançado, que é o único modo que desenha a fila.
//
// **A regra já existia, num vizinho:** a v1.13.37 consertou o "Tocar agora" do
// vídeo da semana exatamente assim (`replacePlaylistWith(reg)` no `semanaAcao`,
// *"o mesmo funil de um item comum"*). O caminho do YouTube ficou de fora.
//
// ## O que este arquivo mede, e por que cada célula é essa
//
// **A · o relato.** O vídeo é iniciado pelo caminho do Modo Fácil de verdade —
// o toque na linha de uma série, que é `simpleAcompanhar(ytAcao(r, 'tocar'))` —
// com uma fila VELHA plantada — o estado do operador, que carrega a sequência do
// último culto. Depois que a mídia entra no ar, a fila tem de ser SÓ ela: as
// três leituras (`plItems`, o banco e o `currentId`) juntas, porque é o par
// banco × memória que o defeito separava.
//
// **B · a sequência exata do relato.** Troca para o Avançado e abre a folha da
// fila: a medida é o DOM, que é o que o operador vê — a linha existe, é a do
// item no ar (`.no-ar`) e a contagem é 1.
//
// **C · o "Limpar" do relato.** Com a fila dona da cena, o Limpar pergunta e
// avisa (*"A mídia no ar será interrompida"*), e confirmar esvazia a fila e
// encerra a cena — o desenho da v1.8.84. O bloco documenta que limpar NÃO é o
// conserto: o conserto é o item ter entrado na fila.
//
// **D · o limite.** O funil de sempre (a música do acervo pelo Modo Fácil,
// `simplePlaySong`) continua pondo o item na fila. Sem este bloco, um conserto
// largo — "põe na fila em qualquer toque" — passaria em A e quebraria o resto.
//
// **E · a exceção que NÃO pode cair junto.** O vídeo da semana JÁ tem o item
// VIRTUAL na fila quando baixa o episódio; o `ytAcao` daquele caminho declara
// `naFila: false`. Sem esse opt-out, o arquivo tomaria o lugar do virtual no
// `listSet` e o `ancoraDaFila` (o "no ar" e o ⏭ do item da semana, v1.13.13)
// perderia a âncora — a regressão silenciosa deste lote.
//
// REVERSÃO MEDIDA, em duas peças e duas assimetrias (o conserto desfeito pelo
// backup, nunca por `git checkout`):
//   · sem o `replacePlaylistWith` do `ytAcaoInterno` → **4 reprovadas, todas em
//     A e B**; C, D e E passam inteiros. É a prova de que A e B medem o relato
//     e de que os outros três medem outra coisa;
//   · sem o `naFila: false` do `resolverSemana` (o conserto presente) → **E
//     reprova** e A–D passam: a fila vira o ARQUIVO do episódio e o virtual sai.
//
// **C passa nas duas versões de propósito**, e é o bloco que documenta o fim da
// sequência: com o item na fila, o Limpar do relato termina como a v1.8.84
// desenhou (avisa e encerra). Sem o conserto o MESMO Limpar interrompe um item
// que nunca esteve na fila — o desfecho que o operador relatou, e que só A e B
// podem acusar. D também passa nas duas: é o controle positivo do funil.
//
//   node tools/tocar-agora-na-fila.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperarCortina, esperar, porque, checar, falhas,
  RAIZ_WEB, wav,
} from './arnes.mjs';

// O vídeo de mentira: bytes de WAV servidos como vídeo, que é o que o
// `modo-simples-espera` já faz — o `<video>` do Chromium o toca, e o que se mede
// aqui é a FILA, não o decodificador.
const ARQ = wav(20);
const servidor = servirEstatico(RAIZ_WEB, (req, res) => {
  if (/^\/shell\/x\.wav/.test(req.url)) {
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': ARQ.length });
    res.end(ARQ);
    return true;
  }
  return false;
});
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;

// A PONTE DE MENTIRA: as chamadas com `callId` resolvem, as demais são no-op, e
// o download do YouTube vai em PASSOs com progresso — o caminho de verdade do
// `ytAcao`, com a barra, a gravação e o `send`.
const PONTE = `(function(){
 const comCallId=new Set(['apkInstalar','deckPages','espelhoCertApagar','espelhoCertImportar','espelhoLigar','displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch','ytFetchAte','ytFetchAudio','castTarget','saidaDeAudioAlvo','espelhoEstado','espelhoDiag','espelhoCertEstado','apkProcurar','otaPending','otaApply','otaCheck','otaDiag','ytDiag','cifraDiag','farolEstado','ytCanalPlaylists','ytPlaylist','ytDetalhes','areaTransferencia','salvarTexto','cifraHtml','pacoteEspaco','pacoteProntoEstado','pacoteDiag','ytMedida','atualizacaoEstado','telaInteira']);
 const vazio={displays:[],listFolder:[],espelhoEstado:{ligado:false,telas:[],redes:[]},espelhoDiag:{},castTarget:{label:''},apkProcurar:{},ytDiag:'',cifraDiag:'',farolEstado:{conta:true,ultimo:0,diag:''}};
 function baixar(id){ let i=0; const tot=${ARQ.length};
   const passo=()=>{ if(i<10){i++; window.__avYtProgress(id,Math.round(tot*i/10),tot); setTimeout(passo,80);return;}
     setTimeout(()=>{ window.__avResolve(id,{url:location.origin+'/shell/x.wav',name:'v',size:tot,type:'video/mp4',audioOnly:false,height:720,seconds:20}); }, 80); };
   setTimeout(passo,80); }
 const B={shellVersion:()=>85,role:()=>'controle',appVersion:()=>'t',takeShare:(id)=>{setTimeout(()=>window.__avResolve(id,''),0);},busPost:()=>{},otaConfirm:()=>{},bgProgress:()=>{},
  ytFetch:(id)=>baixar(id),ytFetchAte:(id)=>baixar(id),ytFetchAudio:(id)=>baixar(id),ytCancel:()=>{},ytDiscard:()=>{}};
 const nomes=['apkInstalar','apkProcurar','captureVolumeKeys','castTarget','saidaDeAudioAlvo','deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar','espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado','espelhoLigar','keepAlive','listFolder','nowPlaying','openCast','abrirSaidaDeAudio','openExternal','otaApply','otaCheck','otaDiag','otaPending','pickFolder','pickDoc','systemVolume','temaClaro','ytCanalPlaylists','ytPlaylist','ytSearch','ytStream','farolEstado','projecaoLocal','cifraHtml','cifraDiag','areaTransferencia','salvarTexto','ytDetalhes','pacoteEspaco','pacoteProntoEstado','pacoteDiag','ytMedida','ytDiag','atualizacaoEstado','telaInteira'];
 for(const n of nomes){ if(B[n])continue; B[n]=(...a)=>{ if(!comCallId.has(n))return undefined; const id=a[0]; setTimeout(()=>window.__avResolve(id,(n in vazio)?vazio[n]:null),0); return undefined; }; }
 window.__AVBridge=B; })();`;

const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY|Failed to load resource/;
pg.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (EXTERNO.test(t)) return;
  erros.push(t);
});
pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

// O estado que interessa, pelas três leituras do defeito.
const espia = () => pg.evaluate(async () => ({
  modo: appMode,
  atual: currentId || null,
  noAr: !!midiaNoAr,
  memoria: plItems.map((m) => ({ id: m.id, nome: m.name })),
  banco: await AVDB.listIds('playlist'),
  ancora: ancoraDaFila ? ancoraDaFila() : null,
}));
const filaNaTela = () => pg.evaluate(() => {
  const aberta = plPopupEl.classList.contains('open');
  return {
    aberta,
    contagem: document.getElementById('plPopupCount').textContent.trim(),
    linhas: [...document.querySelectorAll('#playlist li')].map((li) => ({
      nome: (li.querySelector('.row-name') || li).textContent.trim(),
      noAr: li.classList.contains('no-ar'),
    })),
  };
});
const abrirFila = async () => {
  await pg.evaluate(() => { if (!plPopupEl.classList.contains('open')) plBtnEl.click(); });
  const ok = await esperar(pg, () => plPopupEl.classList.contains('open'), null, 5000);
  if (ok !== true) throw new Error('a folha da fila não abriu: ' + ok);
};
const esperarNoAr = async (nome) => {
  const ok = await esperar(pg, () => midiaNoAr === true && !!currentId, null, 25000);
  if (ok !== true) throw new Error('a mídia não entrou no ar (' + nome + '): ' + ok);
};

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function',
    null, { timeout: 30000 });
  await esperarCortina(pg);
  // A rede fora e a rotina da semana fora: nenhum download por conta própria
  // pode mexer na fila no meio das medidas.
  await pg.evaluate(() => {
    Object.defineProperty(navigator, 'connection', { value: { type: 'cellular' }, configurable: true });
    window.manterSeriesDaSemana = async () => {};
    tocarNoCelular = true;
    acertarSaidaDeAudio(); renderSimpleGate();
  });

  // A FILA VELHA — o estado do operador: a sequência do culto anterior continua
  // lá, e é ELA que aparece no Avançado depois do toque. Sem ela o defeito
  // seria a fila VAZIA, que o oráculo veria como "a folha não abre" e não como
  // "o item não entrou".
  await pg.evaluate(async () => {
    const blob = new Blob([new Uint8Array(64)], { type: 'audio/wav' });
    const velha = await AVDB.addMedia(blob, { name: 'Louvor do culto passado', type: 'audio/wav', kind: 'audio', list: 'playlist' });
    plItems = await AVDB.listItems('playlist');
    renderPlaylist();
    window.__velha = velha.id;
  });
  const a0 = await espia();
  checar(a0.memoria.length === 1 && a0.memoria[0].nome === 'Louvor do culto passado' && !a0.atual,
    'A · ponto de partida: a fila é a do culto PASSADO e não há nada no ar — é este '
    + 'o estado em que o item em curso "não entra"', a0);

  // =======================================================================
  // A · O VÍDEO INICIADO NO MODO FÁCIL ENTRA NA FILA
  // =======================================================================
  await pg.evaluate(() => {
    simpleAcompanhar(ytAcao(
      { id: 'abcdefghijk', name: 'Provaí e Vede — vídeo de teste', url: 'https://www.youtube.com/watch?v=abcdefghijk' },
      'tocar', null, false, 720));
  });
  await esperarNoAr('o vídeo do YouTube');
  const a = await espia();
  checar(a.atual && a.banco.length === 1 && a.banco[0] === a.atual,
    'A · o vídeo do "Tocar agora" iniciado no Modo Fácil VIRA A FILA: o banco fica com UM item, '
    + 'e é o que está no ar — não a sequência do culto passado', a);
  checar(a.memoria.length === 1 && a.memoria[0].id === a.atual,
    'A · e a memória (`plItems`) concorda com o banco — o par que o defeito separava', a.memoria);
  checar(a.banco[0] !== 'abcdefghijk',
    'A · (o item da fila é o ARQUIVO baixado, nunca o id do YouTube — é o registro que '
    + 'toca, e é ele que o transporte percorre)', { fila: a.banco, youtube: 'abcdefghijk' });

  // =======================================================================
  // B · A SEQUÊNCIA DO RELATO: TROCAR PARA O AVANÇADO MOSTRA O ITEM NA FILA
  // =======================================================================
  await pg.evaluate(() => setAppMode('full'));
  await abrirFila();
  const b = await filaNaTela();
  const nomeDoVideo = 'Provaí e Vede — vídeo de teste';
  checar(b.aberta && b.linhas.length === 1 && b.linhas[0].nome === nomeDoVideo,
    'B · no Avançado a folha da fila lista o item EM CURSO — uma linha, a do vídeo que '
    + 'tocou no Modo Fácil (era aqui que ele "não entrava")', b);
  checar(b.linhas[0] && b.linhas[0].noAr === true,
    'B · e a linha está marcada como NO AR: a fila sabe que o item em cena é dela, '
    + 'que é o que o ⏮/⏭ usam para andar', b.linhas);
  checar(b.contagem === '1',
    'B · a contagem da folha é a da lista (1), não a do culto passado', b.contagem);

  // =======================================================================
  // C · O "LIMPAR" DO RELATO: AVISA, ESVAZIA E ENCERRA — o desenho da v1.8.84
  // =======================================================================
  await pg.evaluate(() => document.getElementById('plClear').click());
  const confirmou = await esperar(pg, () => {
    const d = document.getElementById('appDialog');
    return !!d && d.classList.contains('open');
  }, null, 3000);
  const dialogo = await pg.evaluate(() => {
    const d = document.getElementById('appDialog');
    return d && d.classList.contains('open')
      ? { msg: document.getElementById('appDialogMsg').textContent.trim() } : null;
  });
  checar(confirmou === true && dialogo && /será interrompida/i.test(dialogo.msg),
    'C · com a fila dona da cena, o Limpar PERGUNTA e avisa que a mídia no ar será '
    + 'interrompida — a frase que o operador precisa ler antes do toque', porque(confirmou) || dialogo);
  await pg.evaluate(() => {
    const d = document.getElementById('appDialog');
    if (d && d.classList.contains('open')) document.getElementById('appDialogOk').click();
  });
  const cOk = await esperar(pg, () => currentId === null && midiaNoAr === false, null, 8000);
  // O PALCO TEM O FADE DE SAÍDA: o `<video>` da preview só para de fato no fim
  // dele (o `clear` do stage). A espera é pelo FATO, não por um prazo.
  const sumiu = await esperar(pg, () => {
    const v = document.querySelector('#preview video');
    return !v || v.paused;
  }, null, 6000);
  const c = await pg.evaluate(async () => ({
    atual: currentId, noAr: !!midiaNoAr,
    banco: await AVDB.listIds('playlist'), memoria: plItems.length,
    videos: [...document.querySelectorAll('#preview video')].map((v) => ({ pausado: v.paused, t: Math.round(v.currentTime * 10) / 10 })),
  }));
  checar(cOk === true && sumiu === true && c.banco.length === 0 && c.memoria === 0
      && c.atual === null && c.noAr === false,
  'C · e o Limpar esvazia a fila E encerra a cena (o do relato): a faixa para de '
  + 'verdade, e nada fica tocando depois de "limpar a playlist"', porque(cOk) || porque(sumiu) || c);

  // =======================================================================
  // D · O LIMITE: O FUNIL DE SEMPRE CONTINUA PONDO O ITEM NA FILA
  // =======================================================================
  await pg.evaluate(() => setAppMode('simple'));
  const d = await pg.evaluate(async () => {
    // Uma música do acervo, como no `modo-simples`: OPFS + catálogo + um toque.
    const sr = 8000, secs = 30, n = sr * secs;
    const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
    const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    wr(36, 'data'); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
    const blob = new Blob([buf], { type: 'audio/wav' });
    const caminho = 'folders/hymnal-2022/1.wav';
    await AVDB.opfsWriteFile(caminho, blob);
    await AVDB.fileAdd({ id: 'hino-f1', folder: 'hymnal-2022', opfsPath: caminho, srcName: '1', name: 'Hino 1',
      hymnName: 'Hino 1', hymnAlbum: 'Hinário 2022', type: 'audio/wav', kind: 'audio',
      size: blob.size, mtime: Date.now(), thumb: null, lyrics: [], blob: null, url: null, addedAt: Date.now() });
    collState['hymnal-2022'] = { indexSyncedAt: Date.now(), isHymnal: true,
      songs: [{ id_music: '1', track: 1, name: 'Hino 1', fileIdFull: 'hino-f1', has_instrumental_music: false }] };
    await AVDB.listSet('playlist', []);
    plItems = []; renderPlaylist();
    await simplePlaySong(allCollections().find((c) => c.id === 'hymnal-2022'),
      collState['hymnal-2022'].songs[0]);
    return null;
  });
  await esperarNoAr('o hino do acervo');
  const d2 = await espia();
  checar(d2.banco.length === 1 && d2.banco[0] === 'hino-f1' && d2.memoria.length === 1
    && d2.memoria[0].id === 'hino-f1',
  'D · o funil de sempre (a música do acervo pelo Modo Fácil) continua pondo o item na '
  + 'fila — o conserto do vídeo não mexeu nele', { d, d2 });

  // =======================================================================
  // E · A EXCEÇÃO: O VÍDEO DA SEMANA MANTÉM O ITEM VIRTUAL NA FILA
  // =======================================================================
  //
  // O caminho do `resolverSemana`: a fila JÁ tem o virtual, e o download do
  // episódio passa pelo MESMO `ytAcao` com `naFila: false`. Se o arquivo
  // tomasse o lugar do virtual no `listSet`, o `ancoraDaFila` — que é quem
  // responde "esta cena é daquele item" e faz o ⏭ andar — perderia a âncora.
  const semana = await pg.evaluate(async () => {
    const SERIE = 'serie-provai-vede-2026';
    const coll = allCollections().find((c) => c.id === SERIE);
    if (!coll) return { erro: 'a série do catálogo não existe: ' + SERIE };
    const sab = AVSerie.sabadoDaSemana();
    const desloca = (n) => {
      const dt = new Date(coll.serie.ano, sab.mes - 1, sab.dia + n);
      return { mes: dt.getMonth() + 1, dia: dt.getDate() };
    };
    const faixa = (nome, quando) => ({ id_music: nome, name: nome, ytUrl: 'y/' + nome, seconds: 300,
      canal: 'Provai e Vede | Oficial', serieData: quando });
    collState[SERIE] = { indexSyncedAt: Date.now(), serieDiarioEm: Date.now(),
      songs: [faixa('passada', desloca(-7)), faixa('semana', desloca(0))] };
    // O VIRTUAL, pelo construtor do app — o mesmo id fixo por série.
    const reg = semanaRegistro(coll.serie);
    if (!(await AVDB.getMediaCru(reg.id).catch(() => null))) await AVDB.mediaAdd(reg);
    await AVDB.listSet('playlist', [reg.id]);
    plItems = await AVDB.listItems('playlist');
    renderPlaylist();
    window.__vid = reg.id;
    return { vid: reg.id };
  });
  if (semana.erro) {
    checar(false, 'E · a fixture do vídeo da semana montou (' + semana.erro + ')');
  } else {
    await pg.evaluate((id) => send(id), semana.vid);
    const eOk = await esperar(pg, (id) => currentId && currentId !== id && midiaNoAr === true, semana.vid, 25000);
    const e = await espia();
    const tomouOLugar = !e.memoria.some((m) => m.id === semana.vid);
    checar(eOk === true && !tomouOLugar && e.banco.length === 1 && e.banco[0] === semana.vid,
      'E · o vídeo da semana baixa e projeta o ARQUIVO do episódio, mas a fila continua '
      + 'com o item VIRTUAL — é ele que o `ancoraDaFila` procura (v1.13.13)', porque(eOk) || e);
    checar(e.ancora === semana.vid,
      'E · e a âncora do "no ar" aponta o virtual: o ⏭ e o destaque da linha continuam certos', e);
    checar(e.memoria[0] && e.memoria[0].id !== e.atual,
      'E · (o item em cena é o arquivo do episódio; o da fila é o virtual — é o desenho do '
      + '`semanaAncora`, não uma divergência)', { fila: e.memoria, atual: e.atual });
  }

  checar(erros.length === 0, 'nenhum erro de console', erros);
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
