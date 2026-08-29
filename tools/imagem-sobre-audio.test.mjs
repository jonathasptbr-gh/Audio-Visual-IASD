// IMAGEM SOBRE ÁUDIO — o cartão visual que não interrompe o louvor (v5.312).
//
// ## O defeito que ele impede de voltar
//
// O motor de projeção tem UM slot de mídia: `loadInner` faz, sem condição,
// `video.pause()` → `removeAttribute('src')` → `video.load()`. Logo, todo
// caminho que emita um `load` MATA o que estava tocando — e era isso que
// acontecia ao tocar numa imagem com um louvor de fundo no ar. O que sobrevive
// a esse slot único é a CAMADA DE TEXTO, que é um cartão opaco acima da mídia e
// não emite `load` nenhum: é por isso que o versículo já convivia com o áudio,
// e é por isso que a imagem virou um MODO dela em vez de um segundo slot.
//
// A regra inteira é, então, uma AUSÊNCIA — nenhum `load` sai deste caminho — e
// ausência não tem sintoma de tela nem erro de console: ela se prova medindo o
// `<video>` do outro lado. Daí este arquivo medir `currentTime` em DOIS
// instantes: "não pausou" é fraco (um `<video>` sem `src` também responde
// `paused:false` durante um átimo); "andou" é o que prova que o áudio é o
// MESMO e continua correndo por baixo do cartão.
//
// ## E as DUAS metades, porque cada uma falha calada de um jeito
//
//  - **o Controle** decide sobrepor em vez de substituir, e fecha o laço: a
//    linha ganha o selo, o segundo toque tira a IMAGEM (e não o áudio), o
//    ⏮/⏭ não cai na letra escondida atrás do cartão, e a cena volta inteira
//    numa reconexão de dongle;
//  - **o telão** pinta. Ele é a metade que roda na frente da congregação e a
//    que menos rede de segurança tem — o watchdog do OTA não a valida.
//
// Um `mode` que o `display.js` não conheça cai no ramo `verse` e desenha um
// cartão VAZIO: preto na tela, sem erro em lugar nenhum.
//
//   node tools/imagem-sobre-audio.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arquivo = path.join(RAIZ, p);
  if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404); res.end('nao'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
});

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

// O acervo do teste: um WAV de 20 s gerado no navegador e um PNG de 1×1. O WAV
// é longo de propósito — a asserção central compara o `currentTime` em dois
// instantes, e uma faixa que termine no meio do teste responderia `paused:true`
// por ter ACABADO, indistinguível de ter sido interrompida.
const SEMEAR = `
  const sr = 8000, secs = 20, n = sr * secs;
  const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  wr(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
  const png = await (await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')).blob();
  const a = await AVDB.addMedia(new Blob([buf], { type: 'audio/wav' }),
    { name: 'Louvor de fundo', type: 'audio/wav', kind: 'audio', list: 'imports' });
  const i = await AVDB.addMedia(png,
    { name: 'Aviso da secretaria', type: 'image/png', kind: 'image', list: 'imports' });
`;

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
// `--autoplay-policy` porque o app roda num WebView com
// `mediaPlaybackRequiresUserGesture = false`: sem a bandeira o Chromium do
// teste bloqueia o áudio e o que se mediria seria a política do navegador.
const navegador = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;
function ouvir(pg, rotulo) {
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(rotulo + ': ' + t);
  });
  pg.on('pageerror', (e) => erros.push(rotulo + ' pageerror: ' + e.message));
}

try {
  // ======================================================================
  // METADE 1 — O CONTROLE decide sobrepor, e fecha o laço da remoção
  // ======================================================================
  const pg = await ctx.newPage();
  ouvir(pg, 'controle');
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 20000 });

  const ids = await pg.evaluate(new Function('return (async () => {'
    + 'setAppMode("full");' + SEMEAR + 'await load(); return { audio: a.id, imagem: i.id }; })()'));

  // O que se mede a cada passo. `tempo` é o campo que carrega a prova.
  const espiar = () => pg.evaluate(() => {
    const v = document.querySelector('#preview video') || document.querySelector('video');
    const im = document.getElementById('pvTextImg');
    return {
      pausado: v ? v.paused : null,
      tempo: v ? v.currentTime : null,
      cartao: !document.getElementById('pvText').hidden,
      img: !!(im && !im.hidden && im.getAttribute('src')),
      kind: currentItem ? currentItem.kind : null,
      currentId,
      sessao: visualSobreProjetando(),
      eixo: slideTarget(),
    };
  });

  await pg.evaluate((id) => send(id), ids.audio);
  await pg.waitForTimeout(1200);
  const a1 = await espiar();
  checar(!a1.pausado && a1.tempo > 0 && a1.kind === 'audio',
    'o áudio de fundo está tocando (ponto de partida)', a1);

  // ---- O TOQUE NA IMAGEM SOBREPÕE -----------------------------------------
  await pg.evaluate((id) => send(id), ids.imagem);
  await pg.waitForTimeout(700);
  const b1 = await espiar();
  await pg.waitForTimeout(900);
  const b2 = await espiar();

  checar(b1.cartao && b1.img, 'o cartão da imagem entra em cena', b1);
  checar(!b2.pausado && b2.tempo > b1.tempo + 0.4,
    'o áudio NÃO PAROU e CONTINUA ANDANDO por baixo do cartão', { b1: b1.tempo, b2: b2.tempo });
  checar(b2.kind === 'audio' && b2.currentId === ids.audio,
    'a mídia em cena continua sendo o ÁUDIO — nenhum `load` saiu deste caminho', b2);
  checar(b2.sessao === true, 'a sessão da imagem está projetando', b2);
  checar(b2.eixo === null,
    'o ⏮/⏭ não tem eixo: ele cairia na letra do áudio, escondida atrás do cartão', b2);

  // ---- O SEGUNDO TOQUE TIRA A IMAGEM, NÃO O ÁUDIO -------------------------
  // O ramo de mídia do `retirarDoAr` chamaria `pararMidia`: o operador toca na
  // imagem para tirá-la e o LOUVOR é que some, com a imagem de pé.
  const selo = await pg.evaluate((id) => {
    const it = { id, kind: 'image' };
    return { noAr: noArAgora(it), linha: linhaNoAr(id), ativa: linhaAtiva(id) };
  }, ids.imagem);
  checar(selo.noAr && selo.linha && selo.ativa,
    'a linha da imagem responde "● No ar" — é o que faz o segundo toque ter efeito', selo);

  await pg.evaluate((id) => retirarDoAr({ id, kind: 'image' }), ids.imagem);
  await pg.waitForTimeout(600);
  const c1 = await espiar();
  await pg.waitForTimeout(800);
  const c2 = await espiar();
  checar(!c1.cartao && !c1.img, 'o segundo toque na imagem TIRA O CARTÃO', c1);
  checar(!c2.pausado && c2.tempo > c1.tempo + 0.4 && c2.kind === 'audio',
    'e o áudio segue tocando — sai a camada, não a mídia', { c1: c1.tempo, c2: c2.tempo });

  // ---- A RECONEXÃO DO DONGLE DEVOLVE A CENA INTEIRA -----------------------
  // `resendSceneToDisplay` é o único caminho de recuperação do telão. Uma
  // camada que ele não conheça reaparece pela metade: o louvor volta e o aviso
  // não, sem nada na tela do operador que o diga.
  const reenvio = await pg.evaluate(async (id) => {
    await send(id);
    const vistos = [];
    const bc = new BroadcastChannel('av-iasd');
    bc.addEventListener('message', (e) => vistos.push(e.data));
    resendSceneToDisplay('quem-quer-que-seja');
    await new Promise((r) => setTimeout(r, 300));
    bc.close();
    return vistos.filter((c) => c && (c.type === 'load' || c.type === 'text'))
      .map((c) => ({ type: c.type, mode: c.mode, mediaId: c.mediaId }));
  }, ids.imagem);
  const temLoad = reenvio.some((c) => c.type === 'load' && c.mediaId === ids.audio);
  const temImg = reenvio.some((c) => c.type === 'text' && c.mode === 'image' && c.mediaId === ids.imagem);
  checar(temLoad && temImg,
    'o reenvio de cena devolve as DUAS camadas: o áudio e a imagem por cima', reenvio);

  // ---- A TELA DA REDE RECEBE O REGISTRO JUNTO -----------------------------
  // Ela não tem o acervo em IndexedDB: sem `__rec` com uma URL `/m/<token>`, a
  // imagem chega como um id que não resolve — cartão preto no telão da igreja.
  const daRede = await pg.evaluate((id) => {
    // `telaAtiva()` pergunta pelo canal `__avTelaMidia`, que só o shell injeta;
    // o empurrão OPFS→cache pede o mesmo canal. Os dois são substituídos aqui
    // para que o que se meça seja o ENRIQUECIMENTO, e não a ausência de app.
    const atv = window.telaAtiva, env = window.telaGarantirEnvio;
    window.telaAtiva = () => true;
    window.telaGarantirEnvio = () => {};
    const c = { type: 'text', mode: 'image', mediaId: id, sub: '', view: 'visual' };
    try { telaEnriquecer(c); } finally {
      window.telaAtiva = atv; window.telaGarantirEnvio = env;
    }
    return {
      temRec: !!c.__rec,
      id: c.__rec && c.__rec.id,
      url: (c.__rec && c.__rec.url) || '',
      // O saneamento é o que impede um `blob:` do celular ou um `opfsPath` de
      // atravessar a rede — ver `telaSanearRec`.
      vazou: !!(c.__rec && (c.__rec.blob || c.__rec.opfsPath || c.__rec.youtubeId)),
    };
  }, ids.imagem);
  checar(daRede.temRec && daRede.id === ids.imagem && /^\/m\/[A-Za-z0-9_-]{16,64}$/.test(daRede.url) && !daRede.vazou,
    'o comando da imagem vai para as telas da rede COM o registro servível e saneado', daRede);

  // ---- E O REENVIO LEVA O REGISTRO MESMO COM A ABA TROCADA ----------------
  //
  // O DEFEITO: `await0Rec` varria `plItems`/`libItems`/`favItems`, e a imagem
  // sobreposta quase sempre vem de `libItems` — a lista da ABA ATIVA, refeita
  // (e esvaziada) a cada troca de aba. Horas depois do toque, uma tela que dá
  // F5 pede a cena de volta: o `text/mode:image` saía SEM `__rec`, e a tela
  // pintava um cartão PRETO por cima da projeção até alguém tocar em outra
  // coisa. O registro passou a viajar na PRÓPRIA sessão (`visualSession.rec`), o
  // único lugar que sobrevive à troca de aba.
  //
  // E ele falha calado nas duas pontas: no celular nada muda (o telão de
  // verdade resolve o `mediaId` pelo IndexedDB compartilhado) e na tela o preto
  // é indistinguível de uma cena que alguém quis. O caso acima não o pega — lá
  // a imagem ainda está nas listas. Um oráculo que não morde é documentação,
  // não rede de segurança.
  const reenvioRec = await pg.evaluate(async (o) => {
    stopClear();
    await send(o.audio);
    await new Promise((r) => setTimeout(r, 400));
    await send(o.imagem);                 // sobrepõe: o louvor segue por baixo
    await new Promise((r) => setTimeout(r, 400));
    const atv = window.telaAtiva, env = window.telaGarantirEnvio;
    window.telaAtiva = () => true;
    window.telaGarantirEnvio = () => {};
    // O FUNIL DO ENRIQUECIMENTO só é instalado com `window.__NATIVE__` (quem
    // injeta a ponte é o shell), e esta página roda sem ela. O embrulho abaixo
    // é o MESMO de `controle.js` — enriquecer e seguir —, para que quem monte o
    // comando continue sendo o `resendSceneToDisplay` de verdade.
    const enviar0 = AVDB.sendCommand;
    AVDB.sendCommand = function (c) { telaEnriquecer(c); return enviar0(c); };
    // A TROCA DE ABA, ao pé da letra. As outras duas listas são esvaziadas
    // junto para que a única origem possível do registro seja a sessão — com
    // a imagem na playlist, o caso passaria sem exercitar nada.
    const salvas = [plItems, libItems, favItems];
    plItems = []; libItems = []; favItems = [];
    const vistos = [];
    const bc = new BroadcastChannel('av-iasd');
    bc.addEventListener('message', (e) => vistos.push(e.data));
    try {
      resendSceneToDisplay('tela-que-deu-f5');
      await new Promise((r) => setTimeout(r, 300));
    } finally {
      bc.close();
      AVDB.sendCommand = enviar0;
      plItems = salvas[0]; libItems = salvas[1]; favItems = salvas[2];
      window.telaAtiva = atv; window.telaGarantirEnvio = env;
    }
    const c = vistos.find((m) => m && m.type === 'text' && m.mode === 'image');
    return {
      achou: !!c,
      id: c && c.__rec && c.__rec.id,
      url: (c && c.__rec && c.__rec.url) || '',
      vazou: !!(c && c.__rec && (c.__rec.blob || c.__rec.opfsPath || c.__rec.youtubeId)),
    };
  }, ids);
  checar(reenvioRec.achou && reenvioRec.id === ids.imagem
    && /^\/m\/[A-Za-z0-9_-]{16,64}$/.test(reenvioRec.url) && !reenvioRec.vazou,
    'e o REENVIO leva o registro mesmo com as listas zeradas pela troca de aba '
    + '— sem ele a tela da rede pinta um cartão PRETO', reenvioRec);

  // ---- SEM ÁUDIO NO AR, A IMAGEM PROJETA NORMAL ---------------------------
  // A sobreposição é a EXCEÇÃO. Aplicada sempre, uma imagem sozinha entraria
  // como cartão de texto sobre nada — sem barra, sem cortina, sem transporte.
  await pg.evaluate(() => stopClear());
  await pg.waitForTimeout(400);
  await pg.evaluate((id) => send(id), ids.imagem);
  await pg.waitForTimeout(700);
  const d = await espiar();
  checar(d.kind === 'image' && d.currentId === ids.imagem && !d.sessao,
    'sem áudio no ar a imagem projeta NORMAL (substitui), como sempre foi', d);

  // ---- O AVANÇO DA FILA NÃO SOBREPÕE --------------------------------------
  // Ali a imagem é o PRÓXIMO item da sequência: sobrepor faria a fila parar de
  // andar sozinha, com o áudio anterior tocando para sempre sob a imagem nova.
  const fila = await pg.evaluate(async (o) => {
    await send(o.audio);
    await new Promise((r) => setTimeout(r, 300));
    await send(o.imagem, true);
    await new Promise((r) => setTimeout(r, 300));
    return { kind: currentItem ? currentItem.kind : null, sessao: visualSobreProjetando() };
  }, ids);
  checar(fila.kind === 'image' && !fila.sessao,
    'o avanço automático da fila SUBSTITUI, nunca sobrepõe', fila);

  // ---- E O ⏭ ANDA NA FILA, COM A IMAGEM COMO PRÓXIMO ITEM -----------------
  //
  // O DEFEITO: `step()` chamava `send(id)` SEM `daFila`. Com a fila
  // [louvor, aviso.jpg] e o louvor no ar, o ⏭ caía na guarda de imagem sobre
  // áudio: o aviso entrava POR CIMA e `currentId` continuava no louvor. O ⏭
  // seguinte recalculava o MESMO `idx` e o MESMO alvo — e não fazia nada. O
  // botão "Próxima mídia" (aqui, na notificação e na tela de bloqueio) parava
  // de andar na fila.
  //
  // Ele falha calado porque o primeiro toque PARECE certo: a imagem aparece na
  // tela, e o que fica travado é o toque seguinte — indistinguível de "o botão
  // morreu". O caso acima (`send(id, true)` chamado à mão) não o pega: o
  // defeito está em QUEM chama, não no destino. Um oráculo que não morde é
  // documentação, não rede de segurança.
  //
  // O eixo de ⏮/⏭ é "trocar de MÍDIA" — a mesma intenção do avanço automático.
  // A sobreposição continua valendo para o toque na LINHA, que é onde o
  // operador escolhe o cartão.
  const passo = await pg.evaluate(async (o) => {
    stopClear();
    await AVDB.listSet('playlist', [o.audio, o.imagem]);
    await load();
    await send(o.audio);
    await new Promise((r) => setTimeout(r, 400));
    const medir = () => ({
      id: currentId, kind: currentItem ? currentItem.kind : null, sessao: visualSobreProjetando(),
    });
    const partida = medir();
    step(1);
    await new Promise((r) => setTimeout(r, 600));
    const um = medir();
    step(1);
    await new Promise((r) => setTimeout(r, 600));
    return { fila: plItems.length, partida, um, dois: medir() };
  }, ids);
  checar(passo.fila === 2 && passo.partida.id === ids.audio && passo.partida.kind === 'audio',
    'com a fila [louvor, aviso] e o louvor no ar (ponto de partida do ⏭)', passo.partida);
  checar(passo.um.id === ids.imagem && passo.um.kind === 'image' && !passo.um.sessao,
    'o ⏭ ANDA NA FILA: a imagem entra como cena, e não como cartão por cima', passo.um);
  checar(passo.dois.id === ids.audio && passo.dois.kind === 'audio' && !passo.dois.sessao,
    'e o ⏭ seguinte continua andando (dá a volta) — era ele que não fazia nada', passo.dois);

  await pg.close();

  // ======================================================================
  // METADE 2 — O TELÃO pinta, e o áudio dele sobrevive ao cartão
  // ======================================================================
  const tv = await ctx.newPage();
  ouvir(tv, 'display');
  await tv.goto(base + '/display/', { waitUntil: 'load' });
  await tv.waitForFunction(() => !!window.AVDB && !!document.getElementById('textImg'), null, { timeout: 20000 });

  const idsTv = await tv.evaluate(new Function('return (async () => {' + SEMEAR
    + 'return { audio: a.id, imagem: i.id }; })()'));

  // O barramento de verdade: um `BroadcastChannel` novo nesta mesma página. O
  // objeto que POSTA não recebe a própria mensagem, mas o do `db.js` recebe —
  // é o mesmo caminho por onde o comando do Controle chega no aparelho.
  const mandar = (c) => tv.evaluate((cmd) => {
    const bc = new BroadcastChannel('av-iasd');
    bc.postMessage(cmd); bc.close();
  }, c);

  const olhar = () => tv.evaluate(() => {
    const v = document.getElementById('video');
    const im = document.getElementById('textImg');
    return {
      pausado: v ? v.paused : null,
      tempo: v ? v.currentTime : null,
      cartao: !document.getElementById('text').hidden,
      img: !!(im && !im.hidden && im.getAttribute('src')),
      modoImg: document.getElementById('text').classList.contains('mode-img'),
      // O ramo `verse` desenharia um cartão VAZIO — preto na tela, sem erro.
      textoVazio: !document.getElementById('textMain').textContent.trim(),
    };
  });

  await mandar({ type: 'load', mediaId: idsTv.audio, view: 'visual', muted: true, volume: 0 });
  await tv.waitForTimeout(1400);
  const t0 = await olhar();
  checar(!t0.pausado && t0.tempo > 0, 'no TELÃO o áudio está tocando (ponto de partida)', t0);

  await mandar({ type: 'text', mode: 'image', mediaId: idsTv.imagem, sub: '', view: 'visual' });
  await tv.waitForTimeout(700);
  const t1 = await olhar();
  await tv.waitForTimeout(900);
  const t2 = await olhar();
  checar(t1.cartao && t1.img && t1.modoImg && t1.textoVazio,
    'o TELÃO desenha a imagem (e não um cartão de texto vazio)', t1);
  checar(!t2.pausado && t2.tempo > t1.tempo + 0.4,
    'no TELÃO o áudio continua andando por baixo da imagem', { t1: t1.tempo, t2: t2.tempo });

  await mandar({ type: 'text-hide' });
  await tv.waitForTimeout(600);
  const t3 = await olhar();
  await tv.waitForTimeout(800);
  const t4 = await olhar();
  checar(!t3.cartao && !t3.img && !t3.modoImg,
    'o `text-hide` tira a imagem do telão e solta o objectURL', t3);
  checar(!t4.pausado && t4.tempo > t3.tempo + 0.4,
    'e o áudio do telão segue tocando depois disso', { t3: t3.tempo, t4: t4.tempo });

  // Um `text` de outro modo depois da imagem não pode deixar a `<img>` de pé
  // por cima do texto novo — o `mode-img` esconde `.text-content`, e o cartão
  // ficaria mudo.
  await mandar({ type: 'text', mode: 'image', mediaId: idsTv.imagem, sub: '', view: 'visual' });
  await tv.waitForTimeout(500);
  await mandar({ type: 'text', mode: 'message', main: 'ORAÇÃO FINAL', sub: '', view: 'visual' });
  await tv.waitForTimeout(500);
  const t5 = await tv.evaluate(() => {
    const im = document.getElementById('textImg');
    return {
      img: !!(im && !im.hidden && im.getAttribute('src')),
      modoImg: document.getElementById('text').classList.contains('mode-img'),
      texto: document.getElementById('textMain').textContent.trim(),
    };
  });
  checar(!t5.img && !t5.modoImg && t5.texto === 'ORAÇÃO FINAL',
    'trocar de modo APAGA a imagem — senão ela cobriria o texto novo', t5);

  checar(erros.length === 0, 'nenhum erro de console nas duas metades', erros.slice(0, 4));
} finally {
  await navegador.close();
  servidor.close();
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
