#!/usr/bin/env node
// ============================================================================
// NO MODO FÁCIL A TELA SÓ ANDA QUANDO A MÍDIA ESTÁ PRONTA (v1.12.32)
//
// Relato do operador, com o download já rápido (v1.12.31): *"após chegar em 100%
// de download ele fecha a biblioteca como se fosse tocar, mas ainda leva mais uns
// instantes até tocar de verdade … corrija para que as coisas só aconteçam quando
// estiverem prontas"*.
//
// Sem tela conectada ("Tocar neste celular") o cartão de "Baixando…" não existe
// neste modo, e o vigia da escolha só olhava o cartão: aos 4 s ele desfazia a
// marca e reiniciava a Biblioteca no meio do download. E o progresso chegava a
// 100% no fim da REDE, com a junção e a gravação ainda por fazer.
//
//  A · durante o download e a junção, a linha continua marcada e o campo intacto;
//  B · a tela só muda depois de a mídia entrar no ar;
//  C · o percentual mostrado nunca chega a 100 antes do desfecho;
//  D · o Registro guarda o que a barra fez (v1.12.37).
//
//   node tools/modo-simples-espera.test.mjs
// ============================================================================
import { checar, falhas } from './arnes.mjs';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, RAIZ_WEB } from './arnes.mjs';
function wav(seg){const sr=8000,n=sr*seg,b=Buffer.alloc(44+n*2);b.write('RIFF',0);b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(Math.sin(i/20)*3000),44+i*2);return b;}
const ARQ = wav(20);
const srv = servirEstatico(RAIZ_WEB, (req,res)=>{ if(/^\/shell\/x\.wav/.test(req.url)){res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':ARQ.length});res.end(ARQ);return true;} return false;});
const PONTE = `(function(){
 const comCallId=new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch','ytFetchAte','ytFetchAudio','castTarget','saidaDeAudioAlvo','espelhoEstado','espelhoDiag','espelhoCertEstado','apkProcurar','otaPending','otaApply','otaCheck','otaDiag','ytDiag','cifraDiag','farolEstado','ytCanalPlaylists','ytPlaylist','ytDetalhes','areaTransferencia','salvarTexto','cifraHtml','pacoteEspaco','pacoteProntoEstado','pacoteDiag','ytMedida','atualizacaoEstado']);
 const vazio={displays:[],listFolder:[],espelhoEstado:{ligado:false,telas:[],redes:[]},espelhoDiag:{},castTarget:{label:''},apkProcurar:{},ytDiag:'',cifraDiag:'',farolEstado:{conta:true,ultimo:0,diag:''}};
 function baixar(id){ window.__log.push([performance.now()|0,'fetch-inicio']); let i=0; const tot=${ARQ.length};
   const passo=()=>{ if(i<10){i++; window.__avYtProgress(id,Math.round(tot*i/10),tot); if(i===10) window.__log.push([performance.now()|0,'100%']); setTimeout(passo,200);return;}
     setTimeout(()=>{ window.__log.push([performance.now()|0,'shell-resolve']); window.__avResolve(id,{url:location.origin+'/shell/x.wav',name:'v',size:tot,type:'video/mp4',audioOnly:false,height:720,seconds:20}); }, 2500); };
   setTimeout(passo,200); }
 const B={shellVersion:()=>79,role:()=>'controle',appVersion:()=>'t',takeShare:()=>'',busPost:()=>{},otaConfirm:()=>{},bgProgress:()=>{},
  ytFetch:(id)=>baixar(id),ytFetchAte:(id)=>baixar(id),ytFetchAudio:(id)=>baixar(id),ytCancel:()=>{},ytDiscard:()=>{}};
 const nomes=['apkInstalar','apkProcurar','captureVolumeKeys','castTarget','saidaDeAudioAlvo','deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar','espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado','espelhoLigar','keepAlive','listFolder','nowPlaying','openCast','abrirSaidaDeAudio','openExternal','otaApply','otaCheck','otaDiag','otaPending','pickFolder','pickDoc','systemVolume','temaClaro','ytCanalPlaylists','ytPlaylist','ytSearch','ytStream','farolEstado','projecaoLocal','cifraHtml','cifraDiag','areaTransferencia','salvarTexto','ytDetalhes','pacoteEspaco','pacoteProntoEstado','pacoteDiag','ytMedida','ytDiag','atualizacaoEstado','sessionState'];
 for(const n of nomes){ if(B[n])continue; B[n]=(...a)=>{ if(!comCallId.has(n))return undefined; const id=a[0]; setTimeout(()=>window.__avResolve(id,(n in vazio)?vazio[n]:null),0); return undefined; }; }
 window.__log=[]; window.__AVBridge=B; })();`;
await new Promise(r=>srv.listen(0,r));
const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport:{width:430,height:900} });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
pg.on('pageerror',e=>console.log('pageerror',e.message));
await pg.addInitScript(PONTE);
await pg.goto(`http://localhost:${srv.address().port}/controle/`);
await esperarCortina(pg);
await pg.waitForTimeout(1500);
const mode = 'celular';
const r = await pg.evaluate(async (mode) => {
  window.manterSeriesDaSemana = async () => {};
  if (mode === 'celular') { tocarNoCelular = true; acertarSaidaDeAudio && acertarSaidaDeAudio(); renderSimpleGate && renderSimpleGate(); }
  const est = () => ({ open: hymnSearchPopupEl.classList.contains('open'), principal: document.body.classList.contains('simples-principal'),
    barra: document.body.classList.contains('simples-barra'), semTela: simpleModeEl.classList.contains('sem-tela'),
    busy: pvBusyEl.classList.contains('on'), noAr: !!midiaNoAr, campo: hymnSearchInputEl.value, sel: !!simpleSel.em,
    bottom: getComputedStyle(hymnSearchPopupEl).bottom, fs: !!document.fullscreenElement });
  window.__pcts = [];
  const out = []; let ult = '';
  const t0 = performance.now();
  const iv = setInterval(() => { const e = JSON.stringify(est()); if (e !== ult) { out.push([(performance.now()-t0)|0, e]); ult = e; } }, 50);
  hymnSearchInputEl.value = 'arautos';
  const li = document.createElement('li'); li.className='hymn-result'; li.dataset.yt='abcdefghijk'; hymnResultsEl.appendChild(li);
  window.__log.push([performance.now()|0,'toque']);
  simpleSelecionarLinha(li);
  simpleAcompanhar(ytAcao({ id:'abcdefghijk', name:'Video teste', url:'https://www.youtube.com/watch?v=abcdefghijk' }, 'tocar', null, false, 720));
  const espiar = setInterval(() => { const e = ytEstado.get('abcdefghijk'); if (e && typeof e.pct === 'number') window.__pcts.push([(performance.now()-t0)|0, e.estado, e.pct, !!midiaNoAr]); }, 20);
  await new Promise(r => setTimeout(r, 9000));
  clearInterval(espiar);
  clearInterval(iv);
  // D · O DIAGNÓSTICO (v1.12.37): o anel gravado, o bloco do Registro e a linha do tempo.
  await new Promise(r => setTimeout(r, 300));
  const gravado = await AVDB.getState('ytBarraDiag');
  const bloco = blocoBarraYt();
  const linha = diarioC.map((e) => e.ev).filter((e) => /^barra: /.test(e));
  return { out: out.map(o => [o[0], JSON.parse(o[1])]), log: window.__log.map(x=>[(x[0]-t0)|0,x[1]]), pcts: window.__pcts,
    gravado, bloco, linha };
}, mode);
const quando = (n) => (r.log.find((x) => x[1] === n) || [])[0];
const resolve = quando('shell-resolve');
const entrou = (r.out.find((o) => o[1].noAr) || [])[0];
const antes = r.out.filter((o) => o[0] < (entrou ?? Infinity));
checar(resolve > 4200 && entrou > resolve, 'premissa · o download (com a junção) passa dos 4 s do vigia, e a mídia entra depois dele',
  JSON.stringify({ resolve, entrou }));
checar(antes.every((o) => o[1].sel && o[1].campo === 'arautos' && o[1].open),
  'A · até a mídia entrar, a linha escolhida continua marcada e a busca intacta — a Biblioteca não reinicia no meio do download',
  JSON.stringify(antes.map((o) => [o[0], o[1].sel, o[1].campo])));
const fim = r.out[r.out.length - 1];
checar(fim && fim[1].noAr && !fim[1].sel && fim[0] >= entrou, 'B · com a mídia no ar, a escolha se encerra',
  JSON.stringify(fim));
// C · O PERCENTUAL É DO TOQUE À TELA (v1.12.36): ele não chega a 100 antes de a mídia estar no
// ar, nunca volta, e CONTINUA andando depois do fim da rede (a junção e a gravação têm peso) —
// era um 99 parado durante segundos (v1.12.32).
const baixando = r.pcts.filter((p) => p[1] === 'baixando' && p[2] >= 0);
const antesDoAr = baixando.filter((p) => !p[3]);
const maxAntes = Math.max(...antesDoAr.map((p) => p[2]));
checar(antesDoAr.length > 0 && maxAntes <= 99, 'C · o percentual não chega a 100 antes de a mídia entrar no ar',
  JSON.stringify({ n: antesDoAr.length, maxAntes }));
checar(baixando.every((p, i) => i === 0 || p[2] >= baixando[i - 1][2]), 'C · e nunca volta',
  JSON.stringify(baixando.map((p) => p[2])));
const fimRede = quando('100%');
const depoisDaRede = antesDoAr.filter((p) => p[0] > fimRede + 300);
checar(depoisDaRede.length > 2 && depoisDaRede[depoisDaRede.length - 1][2] > depoisDaRede[0][2],
  'C · e depois do fim da rede ele CONTINUA andando até a mídia estar pronta — nada de "99 parado"',
  JSON.stringify(depoisDaRede.map((p) => p[2])));
const ultimo = r.pcts.filter((p) => p[1] === 'baixando').pop();
const pronto = r.pcts.find((p) => p[1] === 'pronto');
checar(!!pronto && ultimo && ultimo[2] >= 97 && ultimo[3] && pronto[0] > ultimo[0],
  'C · e o fim é a mídia no ar: a linha vira "pronto" (o 100) só DEPOIS de ela entrar, com o número no fim da barra',
  JSON.stringify({ ultimo, pronto }));
// D · O REGISTRO DIZ O QUE ACONTECEU (v1.12.37): o anel GRAVADO (um Registro copiado
// depois ainda o traz), o bloco com o previsto, o real e o número ao tocar, e uma
// linha na linha do tempo.
const ult = Array.isArray(r.gravado) ? r.gravado[r.gravado.length - 1] : null;
checar(!!ult && ult.origem === 'tocar' && ult.rel && ult.rel.caminho === 'novo' && ult.rel.realMs > 4000
  && typeof ult.rel.aoConcluir === 'number' && ult.rel.fases && ult.rel.fases.download && ult.rel.fases.abertura,
  'D · o download fica GRAVADO no anel do diagnóstico, com o caminho, o real e as fases', JSON.stringify(ult));
checar(/^Barra do YouTube \(últimos 1\)/.test(r.bloco || '') && /previsto .* real .* mostrava \d+% no fim/.test(r.bloco)
  && /real\/previsto: preparo/.test(r.bloco) && /^Aprendido \(\d+ amostra/m.test(r.bloco),
  'D · e o bloco do Registro diz o previsto, o real, o número no fim, fase a fase, e o aprendido em uso', r.bloco);
checar(r.linha.length === 1 && /mostrava \d+% ao tocar/.test(r.linha[0]), 'D · e a linha do tempo ganha UMA linha por download', JSON.stringify(r.linha));
await nav.close(); srv.close();
if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
