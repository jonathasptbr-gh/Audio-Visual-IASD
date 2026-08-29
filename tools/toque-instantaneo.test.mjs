#!/usr/bin/env node
// ============================================================================
// O "TOCAR AGORA" DE UM VÍDEO RESPONDE NO INSTANTE DO TOQUE
//
// ## O defeito que ele trava
//
// Relato do operador: *"após a seleção, ele leva algum tempo para reagir e
// sequer aparecer o spinner do carregamento do vídeo… nem que tenha mais tempo
// de carregamento, mas o feedback deve ser instantâneo. Por exemplo, a mídia
// atual deve ser instantaneamente interrompida para indicar que há outra mídia
// sendo colocada no ar, independente dela estar carregando"*.
//
// A janela era real e longa: `tentarTransmitir` começa por um `ytStream`, que é
// uma EXTRAÇÃO DE REDE de segundos, e só depois dela vem o `send` que muda
// alguma coisa na tela. No meio-tempo o único sinal era o `setYtEstado`, que
// acende uma LINHA da Biblioteca — a mesma que o `closeHymnSearch` acabou de
// fechar. E o caminho do DOWNLOAD já tinha o cartão de espera sobre a preview;
// o da TRANSMISSÃO nunca teve.
//
// ## Por que ele mede o MEIO, e não o desfecho
//
// É a lição do `aviso-de-importacao`: **um teste do desfecho passa nas duas
// versões.** Com a correção ou sem ela, o vídeo entra em cena quando os bytes
// chegam — o que muda é o que acontece ANTES disso, e por isso a ponte de
// mentira SEGURA o `ytStream` até o oráculo mandar soltar. É essa janela, e
// só ela, que é o recurso.
//
// ## As quatro metades
//
//  1. **A cena atual SAI**, e sai antes de o manifesto existir. É o
//     reconhecimento do toque.
//  2. **O comando chega ao BARRAMENTO** (`clear`), e não só à preview: o telão
//     e as telas da rede são quem a congregação vê.
//  3. **O cartão de espera aparece** — a metade que diz o que está havendo, no
//     lugar em que a mídia vai aparecer.
//  4. **Guardar numa lista NÃO interrompe nada.** Sem esta metade, a correção
//     viraria um defeito maior que o que ela conserta: mandar um vídeo para o
//     Cronograma derrubaria o louvor no ar.
//
//   node tools/toque-instantaneo.test.mjs
// ============================================================================
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

// A ponte de mentira, com o `ytStream` SEGURO: ele só resolve quando o oráculo
// escreve `window.__soltarStream`. É o que cria a janela que este arquivo mede
// — sem ela, a extração resolveria no mesmo tique e não haveria "antes".
const PONTE = `(() => {
  window.__streamPedido = 0;
  const B = {
    shellVersion: () => 60,
    role: () => 'controle',
    appVersion: () => '1.99-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    ytStream: (id) => {
      window.__streamPedido++;
      const espera = () => {
        if (window.__soltarStream) {
          try { window.__avResolve(id, null); } catch (_) {}
          return;
        }
        setTimeout(espera, 20);
      };
      espera();
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal','castTarget',
    'cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','espelhoLigarEm','espelhoDerrubar','farolContar','farolEstado','keepAlive',
    'listFolder','micDiag','nowPlaying','openCast','openExternal','otaApply','otaCheck','otaDiag',
    'otaPending','pickDoc','pickFolder','requestMic','salvarTexto','systemVolume','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio',
    'ytPlaylist','ytSearch','areaTransferencia','atualizacaoEstado'];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      const id = args[0];
      if (typeof id === 'string') setTimeout(() => { try { window.__avResolve(id, null); } catch (_) {} }, 0);
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

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

// WAV de 20 s: uma faixa que acabe no meio do teste responderia "parada" por ter
// TERMINADO — indistinguível de interrompida, que é justamente o que se mede.
const SEMEAR = `
  const sr = 8000, n = sr * 20;
  const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  wr(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
  const emCena = await AVDB.addMedia(new Blob([buf], { type: 'audio/wav' }),
    { name: 'Louvor Em Cena', type: 'audio/wav', kind: 'audio', list: 'imports' });
`;

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

await new Promise((r) => servidor.listen(0, r));
const navegador = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const ctx = await navegador.newContext({ viewport: { width: 412, height: 892 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = 'http://localhost:' + servidor.address().port;

// Põe um louvor no ar e devolve quando ele está DE FATO tocando — não quando o
// `send` retorna: a cena que este oráculo interrompe precisa existir primeiro.
async function porNoAr() {
  // O `new Function` montado AQUI e passado ao `evaluate` é o padrão do
  // `excluir-em-cena`: o corpo semeado é uma string, e embuti-la numa arrow
  // faria o `await` de dentro dela rodar noutro escopo.
  const id = await pg.evaluate(new Function('return (async () => {'
    + 'setAppMode("full");' + SEMEAR + 'await load(); await send(emCena.id);'
    + 'return emCena.id; })()'));
  await pg.waitForFunction(() => midiaNoAr === true, null, { timeout: 10000 });
  return id;
}

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );

  // ── 1 a 3. O TOQUE, e o que acontece ANTES de o manifesto existir ────────
  await porNoAr();
  const antes = await pg.evaluate(() => ({ midia: midiaNoAr, pedidos: window.__streamPedido }));
  checar(antes.midia === true && antes.pedidos === 0,
    'o cenário começa com um louvor NO AR e nenhuma extração pedida', antes);

  // O barramento é escutado a partir daqui: o que interessa é o comando que sai
  // NESTA janela, e não os do `send` que montou a cena.
  await pg.evaluate(() => {
    window.__cmds = [];
    // ESPIA O `sendCommand`, e não o `onCommand`: o barramento não devolve ao
    // Controle o que ele mesmo emite (não há eco, por construção), então um
    // ouvinte aqui nunca veria o comando que este oráculo existe para afirmar.
    const orig = AVDB.sendCommand.bind(AVDB);
    AVDB.sendCommand = (m) => { if (m && m.type) window.__cmds.push(m.type); return orig(m); };
    // O toque, sem `await`: é justamente a janela ANTES de ele resolver que se
    // mede, e esperar aqui seria esperar o desfecho.
    window.__acao = ytAcao({ id: 'vid1', url: 'https://www.youtube.com/watch?v=vid1', name: 'Louvor Novo' },
      ['tocar'], null, false, -1);
  });
  // Espera pelo FATO (a cena saindo), nunca por um prazo: um `waitForTimeout`
  // aqui mediria a máquina, e o que se afirma é que isto acontece SEM esperar a
  // rede — o que o `__streamPedido` logo abaixo prova.
  await pg.waitForFunction(() => midiaNoAr === false, null, { timeout: 5000 });

  const meio = await pg.evaluate(() => ({
    midia: midiaNoAr,
    cmds: window.__cmds.slice(),
    cartao: !!document.getElementById('pvBusy'),
    // O `ytStream` continua PENDENTE: é isso que prova que a interrupção não
    // esperou a rede.
    soltou: !!window.__soltarStream,
  }));
  checar(meio.midia === false,
    'a CENA ATUAL SAI no instante do toque — a interrupção é o reconhecimento do '
    + 'comando, e ela acontece com a extração ainda pendente', meio);
  checar(meio.soltou === false,
    'e a extração de rede AINDA NÃO RESOLVEU: é a janela inteira do defeito, e é '
    + 'nela que o oráculo mede', meio.soltou);
  checar(meio.cmds.some((t) => t === 'clear' || t === 'media-clear'),
    'o comando sai no BARRAMENTO (`clear`), e não só na preview — quem precisa '
    + 'reagir é o telão e as telas da rede, que é o que a congregação vê',
    meio.cmds);

  await pg.waitForFunction(() => {
    const el = document.getElementById('pvBusy');
    return !!el && el.classList.contains('on');
  }, null, { timeout: 5000 });
  const cartao = await pg.evaluate(() => ({
    cap: (document.getElementById('pvBusyCap') || {}).textContent || '',
    nome: (document.getElementById('pvBusyLabel') || {}).textContent || '',
  }));
  checar(/Preparando/i.test(cartao.cap) && /Louvor Novo/.test(cartao.nome),
    'e o CARTÃO DE ESPERA aparece sobre a preview, com o nome do que está vindo — '
    + 'o caminho do download já tinha isto, o da transmissão não tinha', cartao);

  // Solta a extração e deixa o fluxo terminar: o cartão tem de SAIR, senão a
  // correção troca um silêncio por um cartaz preso.
  await pg.evaluate(() => { window.__soltarStream = true; });
  await pg.evaluate(() => window.__acao.catch(() => {}));
  await pg.waitForFunction(() => {
    const el = document.getElementById('pvBusy');
    return !!el && !el.classList.contains('on');
  }, null, { timeout: 15000 });
  checar(true,
    'e ele SAI quando o fluxo termina — o `finally` do invólucro cobre as meia '
    + 'dúzia de saídas do `ytAcao`, e uma sem ele prenderia o cartão para sempre');

  // ── 4. GUARDAR numa lista NÃO interrompe ────────────────────────────────
  // Sem esta metade a correção viraria um defeito maior que o que conserta.
  await porNoAr();
  await pg.evaluate(() => {
    window.__soltarStream = true;
    window.__acao2 = ytAcao({ id: 'vid2', url: 'https://www.youtube.com/watch?v=vid2', name: 'Outro' },
      ['cronograma'], null, false, -1);
  });
  await pg.waitForTimeout(400);
  const guardando = await pg.evaluate(() => midiaNoAr);
  checar(guardando === true,
    'mandar um vídeo para o CRONOGRAMA não derruba o louvor no ar: a interrupção '
    + 'é do "Tocar agora", e só dele', guardando);
  await pg.evaluate(() => window.__acao2.catch(() => {}));

  // ── 5. O SUBTEXTO do "Tocar agora" com "Online" ─────────────────────────
  const subs = await pg.evaluate(() => {
    const ler = () => {
      const it = [...songMenuListEl.querySelectorAll('.song-menu-btn')]
        .find((b) => /Tocar agora/.test(b.textContent));
      return it ? (it.querySelector('.song-menu-sub') || {}).textContent || '' : null;
    };
    const r = { id: 'vidX', url: 'https://www.youtube.com/watch?v=vidX', name: 'Louvor' };
    openYtMenu(r);
    songMenuFor.alt = -1;            // Online
    openYtMenu(r);
    const online = ler();
    songMenuFor.alt = 1080;
    openYtMenu(r);
    const mil = ler();
    closeSongMenu();
    return { online, mil };
  });
  checar(/qualidade varia/i.test(subs.online) && /conex/i.test(subs.online),
    'com "Online" o "Tocar agora" DIZ que toca direto da internet e que a '
    + 'qualidade varia conforme a conexão', subs.online);
  checar(subs.mil !== subs.online && !!subs.mil,
    'e nos tetos fixos ele volta a dizer o que aquela linha não guarda — a frase '
    + 'é da situação, não do botão', subs);
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
