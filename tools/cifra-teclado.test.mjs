#!/usr/bin/env node
// ============================================================================
// O TECLADO DO SISTEMA NÃO PODE DERRUBAR O CAMPO DE BUSCA DA CIFRA
//
// ## O defeito que ele trava
//
// O seletor de cifra (v1.1.25) tem um `<input>` para o operador procurar por
// outro nome. A quebra de linha da folha é NOSSA e é medida em caracteres na
// fonte renderizada, então a v1.1.20 pendurou um `resize` em `cifraRemedir`,
// que redesenha a aba.
//
// **O teclado virtual é um `resize`.** Tocar no campo abre o teclado, a janela
// encolhe, `cifraRemedir` refaz a aba inteira, e o `<input>` que tinha o foco
// deixa de existir — um campo sem foco fecha o teclado, e o fechamento é OUTRO
// `resize`. Da tela sai um teclado que pisca e some, sem erro em lugar nenhum,
// e o recurso inteiro fica inalcançável: não dá para digitar no seletor.
//
// Não é hipótese: foi relatado por quem opera, na primeira vez que o seletor
// chegou a um aparelho.
//
// ## Por que ele é de CHROMIUM, e não de Node
//
// A regra é sobre FOCO, e foco não existe fora de um documento. O que se afirma
// aqui é o comportamento observável — depois de um `resize`, o campo continua
// sendo o `activeElement` e continua com o que foi digitado —, que é a única
// forma de a asserção não virar uma segunda escrita da mesma regra.
//
// ## E POR QUE ELE INJETA UMA PONTE DE MENTIRA
//
// A primeira versão deste oráculo montava o seletor à mão num nó solto e
// passava **com a guarda removida** — porque `cifraRemedir` desiste antes de
// desenhar quando o popup não está aberto ou a fonte ativa não é a cifra, e sem
// `__AVBridge` a cifra nem é uma fonte possível (`cifraCabe` exige a ponte).
// Ele media a si mesmo: o campo sobrevivia por um motivo que não era o do app.
//
// Aqui o cenário é o de verdade — ponte presente, popup ABERTO, fonte ativa
// `cifra`, seletor aberto pelo mesmo caminho que o operador usa. **A prova de
// que ele serve é a REVERSÃO**: tirar `if (cifraDigitando()) return;` do
// `cifraRemedir` tem de deixá-lo vermelho.
//
//   node tools/cifra-teclado.test.mjs
// ============================================================================
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

// A PONTE DE MENTIRA, reduzida ao que este caso precisa: as quatro leituras
// síncronas que o `native.js` faz na carga, o relay do barramento, e um
// `cifraHtml` que devolve uma página de busca com dois resultados. Todo o resto
// resolve `null` — o que basta, porque nada mais é exercitado aqui.
const PONTE = `(() => {
  const RESULTADOS = '<a href="/artista-de-marcador/musica-de-marcador/">Musica De Marcador</a>'
    + '<a href="/outro-marcador/outra-musica-marcador/">Outra Musica Marcador</a>';
  const B = {
    shellVersion: () => 49,
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    // A BUSCA responde; a PÁGINA de uma música responde 404. É o cenário em que
    // o seletor aparece sozinho — que é onde o campo de busca vive.
    cifraHtml: (id, url) => {
      const busca = /[?]q=/.test(String(url));
      setTimeout(() => {
        try { window.__avResolve(id, { status: busca ? 200 : 404, html: busca ? RESULTADOS : '' }); }
        catch (_) {}
      }, 0);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','castTarget',
    'cifraDiag','deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply',
    'otaCheck','otaDiag','otaPending','pickDoc','pickFolder','requestMic','systemVolume',
    'temaClaro','ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte',
    'ytFetchAudio','ytPlaylist','ytSearch','ytStream','areaTransferencia','atualizacaoEstado'];
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

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = `http://localhost:${porta}`;

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  // ESPERAR O APP FICAR DE PÉ, e não só o `__avBack` existir. O `init()` é
  // assíncrono e termina DEPOIS do `load`: plantar `currentItem` antes disso é
  // correr contra a inicialização, que o zera com toda a razão ao terminar — e
  // o sintoma é o cenário evaporar sem erro nenhum, com o oráculo esperando por
  // um campo que nunca vai existir. O critério é o do watchdog do OTA: um `<li>`
  // na playlist só aparece quando o `init()` acabou.
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );

  // O CENÁRIO DE VERDADE: uma música em cena, o popup de letra ABERTO e a fonte
  // ativa sendo a CIFRA. É o que faz `cifraRemedir` chegar ao redesenho — sem
  // isso ele desiste antes, e o teste aprovaria o defeito.
  const pronto = await pg.evaluate(async () => {
    // SEM `window.`: `currentItem` e `lvSource` são `let` no topo de um script
    // clássico, e isso cria vínculo no escopo léxico global — NÃO uma
    // propriedade de `window`. Escrever `window.currentItem` cria outra coisa,
    // com o mesmo nome, que o app nunca lê. Foi assim que a primeira tentativa
    // deste cenário "montou" um item que `cifraCabe` nunca viu.
    currentItem = {
      id: 'marcador', name: 'Musica De Marcador', kind: 'audio',
      lyrics: [{ text: 'linha de marcador' }],
    };
    if (!cifraCabe(currentItem)) return 'cifraCabe recusou o item';
    lvSource = 'cifra';
    openLyricsPopup();
    return lvActiveSource();
  });
  checar(pronto === 'cifra', 'a aba de CIFRA é a fonte ativa (o cenário do app)', pronto);
  checar(await pg.evaluate(() => lyricsPopupEl.classList.contains('open')),
    'e o popup está aberto — as duas condições de que o redesenho depende');

  // O SELETOR APARECE SOZINHO, e é assim que ele aparece no app desde a v1.3.2:
  // a ponte de mentira responde 404 na PÁGINA e 200 na BUSCA, então a procura
  // termina em falha e o ramo de `estado !== 'ok'` desenha o seletor abaixo da
  // frase. Até a v1.3.1 este caso chamava `cifraEscolherMostrar(true)` — a porta
  // do botão "Trocar", que saiu; cutucar a função interna era, além disso,
  // exercitar um caminho que o operador não percorre.
  //
  // A CHAVE É CONFERIDA AQUI, e não só lá embaixo: se a inicialização tiver
  // zerado o `currentItem`, é este caso que diz isso — o `waitForSelector`
  // seguinte só saberia dizer "esperei 15 s".
  const chave = await pg.evaluate(() => cifraChave(currentItem));
  checar(chave !== '|' && chave.length > 1, 'a música plantada continua em cena', chave);
  await pg.waitForSelector('.lv-cifra-campo', { timeout: 15000 });
  checar(true, 'o seletor desenha o campo de busca');

  await pg.focus('.lv-cifra-campo');
  await pg.type('.lv-cifra-campo', 'Outro Nome De Marcador');
  const antes = await pg.evaluate(() => ({
    foco: document.activeElement && document.activeElement.className,
    valor: document.activeElement && document.activeElement.value,
  }));
  checar(/lv-cifra-campo/.test(antes.foco || ''), 'o campo recebe o foco', antes.foco);

  // O TECLADO, como o navegador o entrega: um `resize` da janela. Não há como
  // abrir um teclado de sistema aqui, e é exatamente este evento que a guarda
  // escuta — o mesmo que o Android dispara ao subir e ao descer o teclado.
  await pg.evaluate(() => {
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('orientationchange'));
  });
  await pg.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

  const depois = await pg.evaluate(() => ({
    foco: document.activeElement && document.activeElement.className,
    valor: document.activeElement && document.activeElement.value,
    existe: !!document.querySelector('.lv-cifra-campo'),
  }));
  checar(depois.existe, 'o campo continua no documento depois do resize', depois);
  checar(/lv-cifra-campo/.test(depois.foco || ''),
    'e continua com o FOCO — é a perda dele que fecha o teclado', depois.foco);
  checar(depois.valor === antes.valor,
    'e com o que já tinha sido digitado', { antes: antes.valor, depois: depois.valor });

  // A GUARDA NÃO PODE VALER SEMPRE: fora de um campo, remedir é o que mantém a
  // quebra de linha certa ao girar o aparelho. Sem esta metade, "nunca
  // redesenhar" passaria em tudo acima e quebraria o recurso que o `resize`
  // existe para servir.
  const semFoco = await pg.evaluate(() => {
    document.activeElement.blur();
    return cifraDigitando();
  });
  checar(semFoco === false, 'sem campo focado, o redesenho volta a ser permitido', semFoco);
} finally {
  await navegador.close();
  servidor.close();
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
