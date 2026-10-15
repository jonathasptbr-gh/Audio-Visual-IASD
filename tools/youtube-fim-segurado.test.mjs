#!/usr/bin/env node
// ============================================================================
// O "TOCAR AGORA" DO YOUTUBE: A MINIATURA DEPOIS DO PLAY, E O FIM SEGURADO
// (v1.12.39, os dois aprovados pelo operador)
//
// O Registro de 15/10 mostrava a GRAVAÇÃO de 1,5 e 1,9 s em vídeos de 12–14 MB:
// era a miniatura (`makeThumb` decodifica o vídeo) segurando o "Tocar agora", e
// a variação dela movia a barra para longe do fim. E a barra abria o vídeo em
// 61, 73: o operador aceitou SEGURAR a revelação até ~500 ms para ela varrer
// até 100.
//
//  A · o registro é gravado SEM miniatura, e ela só é extraída DEPOIS de a mídia
//      estar tocando — e chega ao registro;
//  B · quem mostra o item (o Cronograma) desenha a caixa VAZIA enquanto ela não
//      chega (não o "imagem quebrada"), e é redesenhado com ela;
//  C · o FIM SEGURADO: com a barra atrás quando a mídia fica pronta, o `send`
//      espera a varredura (até 500 ms), e o último número antes de a mídia
//      entrar é 100; o Registro diz quanto segurou;
//  D · e antes de a mídia estar gravada o número nunca chega a 100.
//
//   node tools/youtube-fim-segurado.test.mjs
// ============================================================================
import { checar, falhas, servirEstatico, abrirNavegador, esperarCortina, comModoAvancado, RAIZ_WEB } from './arnes.mjs';
import { semRedeExterna } from './sem-rede.mjs';

function wav(seg) {
  const sr = 8000; const n = sr * seg; const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 20) * 3000), 44 + i * 2);
  return b;
}
const ARQ = wav(20);
const srv = servirEstatico(RAIZ_WEB, (req, res) => {
  if (/^\/shell\/x\.wav/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': ARQ.length }); res.end(ARQ); return true; }
  return false;
});
// A ponte falsa: o `ytFetch` avisa os bytes em 1 s e resolve logo depois.
const PONTE = `(function(){
 const comCallId=new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch','ytFetchAte','ytFetchAudio','castTarget','saidaDeAudioAlvo','espelhoEstado','espelhoDiag','espelhoCertEstado','apkProcurar','otaPending','otaApply','otaCheck','otaDiag','ytDiag','cifraDiag','farolEstado','ytCanalPlaylists','ytPlaylist','ytDetalhes','areaTransferencia','salvarTexto','cifraHtml','pacoteEspaco','pacoteProntoEstado','pacoteDiag','ytMedida','atualizacaoEstado']);
 const vazio={displays:[],listFolder:[],espelhoEstado:{ligado:false,telas:[],redes:[]},espelhoDiag:{},castTarget:{label:''},apkProcurar:{},ytDiag:'',cifraDiag:'',farolEstado:{conta:true,ultimo:0,diag:''}};
 function baixar(id){ let i=0; const tot=${ARQ.length};
   const passo=()=>{ if(i<10){i++; window.__avYtProgress(id,Math.round(tot*i/10),tot); setTimeout(passo,100);return;}
     setTimeout(()=>{ window.__avResolve(id,{url:location.origin+'/shell/x.wav',name:'v',size:tot,type:'video/mp4',audioOnly:false,height:720,seconds:20}); }, 200); };
   setTimeout(passo,200); }
 const B={shellVersion:()=>81,role:()=>'controle',appVersion:()=>'t',takeShare:()=>'',busPost:()=>{},otaConfirm:()=>{},bgProgress:()=>{},
  ytFetch:(id)=>baixar(id),ytFetchAte:(id)=>baixar(id),ytFetchAudio:(id)=>baixar(id),ytCancel:()=>{},ytDiscard:()=>{}};
 const nomes=['apkInstalar','apkProcurar','captureVolumeKeys','castTarget','saidaDeAudioAlvo','deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar','espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado','espelhoLigar','keepAlive','listFolder','nowPlaying','openCast','abrirSaidaDeAudio','openExternal','otaApply','otaCheck','otaDiag','otaPending','pickFolder','pickDoc','systemVolume','temaClaro','ytCanalPlaylists','ytPlaylist','ytSearch','ytStream','farolEstado','projecaoLocal','cifraHtml','cifraDiag','areaTransferencia','salvarTexto','ytDetalhes','pacoteEspaco','pacoteProntoEstado','pacoteDiag','ytMedida','ytDiag','atualizacaoEstado','sessionState','telaInteira'];
 for(const n of nomes){ if(B[n])continue; B[n]=(...a)=>{ if(!comCallId.has(n))return undefined; const id=a[0]; setTimeout(()=>window.__avResolve(id,(n in vazio)?vazio[n]:null),0); return undefined; }; }
 window.__AVBridge=B; })();`;

await new Promise((r) => srv.listen(0, r));
const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
await comModoAvancado(ctx);
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', (e) => erros.push(e.message));
await pg.addInitScript(PONTE);
await pg.goto(`http://localhost:${srv.address().port}/controle/`);
await esperarCortina(pg);
await pg.waitForTimeout(800);

const r = await pg.evaluate(async () => {
  window.manterSeriesDaSemana = async () => {};
  const t0 = performance.now();
  const ms = () => (performance.now() - t0) | 0;
  const log = [];
  // Um histórico LENTO plantado (o preparo de 30 s): a barra está longe do fim
  // quando a mídia fica pronta — é o caso em que o fim segurado age.
  let h = null;
  for (let i = 0; i < 3; i++) h = AVProgresso.aprender(h, { preparoMs: 30000, aberturaMs: 800 });
  ytTempos = AVProgresso.sanear(h);
  const addOrig = AVDB.addMedia;
  AVDB.addMedia = async (blob, meta) => { log.push([ms(), 'addMedia', meta && meta.thumb ? 'com' : 'sem']); return addOrig(blob, meta); };
  const thumbOrig = makeThumb;
  makeThumb = (...a) => { log.push([ms(), 'makeThumb', a[1]]); return thumbOrig(...a); };
  const sendOrig = send;
  send = (...a) => { log.push([ms(), 'send', (ytEstado.get('abcdefghijk') || {}).pct]); return sendOrig(...a); };
  const pcts = []; let tocandoEm = null; const linhas = [];
  const espiar = setInterval(() => {
    const e = ytEstado.get('abcdefghijk');
    if (e && typeof e.pct === 'number') pcts.push([ms(), e.estado, e.pct, !!midiaNoAr]);
    if (playing && tocandoEm == null) tocandoEm = ms();
    const li = currentId ? libraryEl.querySelector('li[data-id="' + currentId + '"] .thumb') : null;
    if (li) {
      const k = li.querySelector('img') ? 'img' : li.classList.contains('thumb--espera') ? 'espera'
        : li.textContent.trim() ? 'icone' : 'vazia';
      if (!linhas.length || linhas[linhas.length - 1][1] !== k) linhas.push([ms(), k]);
    }
  }, 20);
  ytAcao({ id: 'abcdefghijk', name: 'Video teste', url: 'https://www.youtube.com/watch?v=abcdefghijk' }, ['tocar', 'cronograma'], null, false, 720);
  await new Promise((ok) => setTimeout(ok, 6000));
  clearInterval(espiar);
  const id = currentId;
  const cru = id ? await AVDB.getMediaCru(id) : null;
  const gravado = await AVDB.getState('ytBarraDiag');
  return { log, pcts, tocandoEm, linhas, temThumb: !!(cru && cru.thumb && cru.thumb.size >= 0 && typeof cru.thumb.type === 'string'),
    rel: Array.isArray(gravado) && gravado.length ? gravado[gravado.length - 1].rel : null,
    bloco: blocoBarraYt(), linhaTempo: diarioC.map((e) => e.ev).filter((e) => /^barra: /.test(e)) };
});
const quando = (n) => (r.log.find((x) => x[1] === n) || [])[0];
const tAdd = quando('addMedia');
const tSend = quando('send');
const tThumb = (r.log.find((x) => x[1] === 'makeThumb' && x[2] === 'video') || [])[0];

// ---- A · a miniatura depois do play
checar(tAdd != null && tSend != null && r.tocandoEm != null, 'premissa · o download gravou, o send saiu e a mídia tocou',
  JSON.stringify({ tAdd, tSend, tocando: r.tocandoEm }));
checar((r.log.find((x) => x[1] === 'addMedia') || [])[2] === 'sem', 'A · o registro é gravado SEM miniatura', JSON.stringify(r.log));
checar(tThumb != null && tThumb > r.tocandoEm, 'A · e a miniatura só é extraída DEPOIS de a mídia estar tocando',
  JSON.stringify({ tThumb, tocando: r.tocandoEm }));
checar(r.temThumb, 'A · e ela chega ao registro', r.temThumb);
// ---- B · o Cronograma: caixa vazia enquanto espera, e redesenhado com ela
const kinds = r.linhas.map((x) => x[1]);
checar(kinds.includes('espera') && kinds[kinds.length - 1] === 'img' && !kinds.includes('icone'),
  'B · a linha do Cronograma mostra a caixa VAZIA enquanto a miniatura não chega (nunca o "imagem quebrada"), e depois a imagem',
  JSON.stringify(r.linhas));
// ---- C · o fim segurado
const rel = r.rel || {};
checar(rel.segurouMs > 0 && rel.segurouMs <= 500, 'C · com a barra atrás, o fim segura — no máximo 500 ms', rel.segurouMs);
checar(tSend - tAdd >= rel.segurouMs - 40, 'C · e o send ESPERA a varredura (depois da gravação, pelo menos o tempo segurado)',
  JSON.stringify({ tAdd, tSend, segurou: rel.segurouMs }));
const noSend = (r.log.find((x) => x[1] === 'send') || [])[2];
checar(noSend === 100, 'C · e quando o send sai a barra mostra 100 — a varredura chegou ao fim', JSON.stringify(r.pcts.filter((p) => !p[3]).slice(-6)) + ' send: ' + noSend);
checar(/segurou [\d,]+ s até o 100 antes de abrir/.test(r.bloco) && r.linhaTempo.length === 1 && /segurou [\d,]+ s/.test(r.linhaTempo[0]),
  'C · e o Registro diz quanto segurou (o bloco e a linha do tempo)', r.bloco + ' | ' + r.linhaTempo.join(' | '));
// ---- D · antes de gravar, nunca 100
const antesDeGravar = r.pcts.filter((p) => p[0] < tAdd);
checar(antesDeGravar.length && Math.max(...antesDeGravar.map((p) => p[2])) <= 99,
  'D · antes de a mídia estar gravada o número nunca chega a 100', JSON.stringify(antesDeGravar.slice(-3)));
checar(r.pcts.every((p, i, a) => i === 0 || p[2] >= a[i - 1][2] || a[i - 1][1] !== p[1]), 'D · e nunca volta', null);
checar(!erros.length, 'sem erro de página', JSON.stringify(erros));

await nav.close(); srv.close();
if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
