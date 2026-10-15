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
//  D · e antes de a mídia estar gravada o número nunca chega a 100;
//  E · (v1.12.40) a MEDIDA DO SHELL (`ytMedida`) vai com o diagnóstico da barra
//      e o bloco "Barra do YouTube" a imprime: cada faixa (bytes, tempo,
//      pedaços, conexões, o pedaço mais lento, refeitos, retentativas), áudio e
//      vídeo juntos ou em fila, os avisos no tempo, e — num download LENTO — o
//      veredito: UM pedaço preso ou todos lentos por igual (a rede).
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
 let ultimoLink='';
 const MEDIDA=(link)=>({v:1,link,somenteAudio:false,teto:720,conexoes:4,blocoBytes:3145728,extracaoMs:2100,
   faixas:[{papel:'audio',etiqueta:'140@VISIONOS pt-BR',cliente:'VISIONOS',perfil:'V',modo:'pedaços',conexoes:4,blocoBytes:3145728,blocos:1,inicio:2100,primeiroByte:2300,fim:2900,bytes:1100000,ok:true,erro:'',retentativas:0,pedacosRefeitos:0,pedacos:{n:1,msMin:600,msMediano:600,msMax:600,bytes:1100000}},
     {papel:'video',etiqueta:'136@VISIONOS',cliente:'VISIONOS',perfil:'V',modo:'pedaços',conexoes:4,blocoBytes:3145728,blocos:3,inicio:2900,primeiroByte:3100,fim:22300,bytes:6200000,ok:true,erro:'',retentativas:2,pedacosRefeitos:1,pedacos:{n:3,msMin:800,msMediano:900,msMax:18700,bytes:6200000}}],
   juncao:{inicio:22300,fim:23100,ok:true},audioEVideoJuntos:true,desfecho:'juntou',totalMs:23200,sobraNoCache:[]});
 function baixar(id){ let i=0; const tot=${ARQ.length};
   const passo=()=>{ if(i<10){i++; window.__avYtProgress(id,Math.round(tot*i/10),tot); setTimeout(passo,100);return;}
     setTimeout(()=>{ window.__avResolve(id,{url:location.origin+'/shell/x.wav',name:'v',size:tot,type:'video/mp4',audioOnly:false,height:720,seconds:20}); }, 200); };
   setTimeout(passo,200); }
 const B={shellVersion:()=>81,role:()=>'controle',appVersion:()=>'t',takeShare:()=>'',busPost:()=>{},otaConfirm:()=>{},bgProgress:()=>{},
  ytFetch:(id,u)=>{ultimoLink=u;baixar(id);},ytFetchAte:(id,u)=>{ultimoLink=u;baixar(id);},ytFetchAudio:(id,u)=>{ultimoLink=u;baixar(id);},ytCancel:()=>{},ytDiscard:()=>{},
  ytMedida:(id)=>{ setTimeout(()=>window.__avResolve(id,ultimoLink?MEDIDA(ultimoLink):null),0); }};
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
  // E · os vereditos, por um anel PLANTADO com o mesmo resumo e dois desenhos
  // de pedaços: um preso (o da ponte) e todos lentos por igual.
  const ult = Array.isArray(gravado) && gravado.length ? gravado[gravado.length - 1] : null;
  const lento = { caminho: 'novo', bytes: 7 * 1048576, previstoMs: 4800, realMs: 23200, aoConcluir: 93, saltoFinal: 7, platoMs: 1200,
    fases: { download: { previstoMs: 500, realMs: 19400, mostrado: 91 } }, avisosMaiorVaoMs: 3300, piorJanelaBytesPorMs: 300,
    fatiaDownload: { inicio: 53, mostradoNoFim: 91, fim: 92.8 } };
  const preso = ult && ult.shell ? JSON.parse(JSON.stringify(ult.shell)) : null;
  const igual = preso ? JSON.parse(JSON.stringify(preso)) : null;
  if (igual) { const v = igual.faixas.find((f) => f.papel === 'video'); v.ped = { n: 3, min: 5800, med: 6200, max: 6900 }; v.refeitos = 0; v.retentativas = 0; }
  const salvo = ytBarraDiag;
  ytBarraDiag = [{ t: 1, nome: 'sem', rel: lento }, { t: 2, nome: 'igual', rel: lento, shell: igual }, { t: 3, nome: 'preso', rel: lento, shell: preso }];
  const blocoLento = blocoBarraYt();
  ytBarraDiag = salvo;
  return { shell: ult ? ult.shell || null : null, blocoLento, log, pcts, tocandoEm, linhas, temThumb: !!(cru && cru.thumb && cru.thumb.size >= 0 && typeof cru.thumb.type === 'string'),
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
// ---- E · a medida do shell no Registro
checar(r.shell && r.shell.faixas && r.shell.faixas.length === 2 && r.shell.juntos === true && r.shell.extracaoMs === 2100,
  'E · a medida do shell (ytMedida) vai GRAVADA com o diagnóstico da barra, resumida', JSON.stringify(r.shell));
checar(/shell: extração 2,1 s · pedaços de 3,0 MB · áudio e vídeo AO MESMO TEMPO · junção no shell 0,8 s/.test(r.bloco),
  'E · o bloco imprime a extração, o tamanho do pedaço, áudio e vídeo juntos e a junção', r.bloco);
checar(/vídeo 136@VISIONOS \(V\): 5,9 MB em 19,4 s \(0,3 MB\/s\) · 1º byte aos 0,2 s · pedaços \(3, 4 conexões\) · pedaço mais lento 18,7 s \(mediano 0,9 s\) · refeitos 1 · retentativas 2/.test(r.bloco)
  && /áudio 140@VISIONOS pt-BR \(V\): 1,0 MB em 0,8 s/.test(r.bloco),
  'E · e cada faixa: bytes, tempo, ritmo, 1º byte, pedaços e conexões, o pedaço mais lento, refeitos e retentativas', r.bloco);
checar(/maior vão entre avisos [\d,]+ s/.test(r.bloco) && !/lentidão nos bytes/.test(r.bloco),
  'E · os avisos no tempo aparecem, e num download RÁPIDO não há veredito de lentidão', r.bloco);
const blocos = r.blocoLento.split(/\n(?=\d)/);
const de = (nome) => blocos.find((b) => b.includes(nome)) || '';
checar(/lentidão nos bytes: UM pedaço do vídeo travou — o mais lento levou 18,7 s contra 0,9 s do mediano \(refeitos 1, retentativas 2\); não foi a rede inteira/.test(de('preso')),
  'E · num download lento com UM pedaço preso, o veredito diz que foi o pedaço, não a rede', de('preso'));
checar(/lentidão nos bytes: os pedaços do vídeo foram lentos POR IGUAL .* — a rede ou o servidor do YouTube, não um pedaço preso/.test(de('igual')),
  'E · e com todos os pedaços lentos por igual, diz que foi a rede', de('igual'));
checar(/lentidão nos bytes: sem a medida do shell, não dá para dizer/.test(de('sem')) && /maior vão entre avisos 3,3 s · pior janela de 2 s 0,3 MB\/s · fatia dos bytes 53→92%/.test(de('sem')),
  'E · e sem medida ele diz que não dá para separar; os avisos no tempo e a fatia aparecem', de('sem'));
checar(!erros.length, 'sem erro de página', JSON.stringify(erros));

await nav.close(); srv.close();
if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
