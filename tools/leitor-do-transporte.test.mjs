#!/usr/bin/env node
// ============================================================================
// O BOTÃO DO TRANSPORTE ABRE A FOLHA DA CENA — a porta pela qual o operador entra
//
// ## O defeito que ele trava
//
// Relato do operador (v1.2.17): *"o sistema não identifica que há letra nenhuma
// para o auxiliar de leitura"*.
//
// A v1.2.14 deu parâmetros ao `openLyricsPopup(item, fonte)` para a Biblioteca
// poder abrir a folha de uma música que NÃO está no ar. O ouvinte do botão do
// transporte continuou registrado **por referência**:
//
//     lyricsViewBtnEl.addEventListener('click', openLyricsPopup);
//
// e `addEventListener` chama o ouvinte com o EVENTO. O `PointerEvent` virou o
// `item`, e como ele não é o `currentItem` virou `lvAlvo` — o desvio deliberado
// que a v1.2.14 criou, apontado para um objeto que não é música nenhuma:
//
//   · `lvItem().lyrics` é `undefined` → a fonte `lyrics` some;
//   · `cifraCabe(evento)` recusa      → a fonte `cifra` some;
//   · `lvNaCena()` passa a ser falso  → some também a RESERVA da Bíblia.
//
// As três fontes de uma vez, e a folha abrindo com *"Nada em exibição com letra
// ou texto bíblico"* para toda música. **Nada erra alto:** `lyricsViewSources`
// continua certa, o console fica limpo, e só a tela denuncia.
//
// ## Por que ele CLICA em vez de chamar a função
//
// É o ponto inteiro. Os três oráculos que já abriam esta folha
// (`cifra-rolagem`, `cifra-teclado`) chamam `openLyricsPopup()` direto — o
// único caminho que continuava funcionando. Um defeito no OUVINTE é invisível
// para quem não passa por ele: aqui o clique é a asserção.
//
// ## As DUAS metades
//
//  1. **o botão abre a CENA** — fonte `lyrics`, sem alvo, com as linhas da letra
//     desenhadas;
//  2. **a Biblioteca continua desviando** — `openLyricsPopup(item, 'cifra')`
//     aponta a folha para outra música. Sem ela, apagar os parâmetros do
//     `openLyricsPopup` "consertaria" a primeira metade e devolveria a folha
//     presa ao que está no ar, que é o recurso que a v1.2.14 entregou.
//
//   node tools/leitor-do-transporte.test.mjs
// ============================================================================
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

// A ponte de mentira. `cifraHtml` responde uma FOLHA para a segunda metade ter
// o que desenhar — sem ela a aba de cifra existiria e mostraria "buscando", e a
// asserção de desvio mediria uma tela em trânsito.
const PONTE = `(() => {
  const FOLHA = '<pre><b>C</b>      <b>G</b>\\nlinha de cifra do ensaio</pre>';
  const B = {
    shellVersion: () => 50,
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    cifraHtml: (id) => {
      setTimeout(() => {
        try { window.__avResolve(id, { status: 200, html: FOLHA }); } catch (_) {}
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
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = 'http://localhost:' + servidor.address().port;

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  // O critério do watchdog do OTA: o `init()` é assíncrono e termina DEPOIS do
  // `load`. Plantar `currentItem` antes disso é correr contra a inicialização,
  // que o zera com toda a razão — e o cenário evapora sem erro nenhum.
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );

  // ── 1. O BOTÃO DO TRANSPORTE ────────────────────────────────────────────
  // SEM `window.`: `currentItem` e `lvSource` são `let` no topo de um script
  // clássico — vínculo léxico, não propriedade de `window`.
  const preparado = await pg.evaluate(() => {
    // O MODO AVANÇADO, porque é lá que o botão mora: o app abre no Modo Fácil e
    // a barra de transporte inteira nasce `display: none`. Um oráculo que
    // clicasse sem isto reprovaria por uma razão que não é a dele.
    setAppMode('full');
    currentItem = {
      id: 'cena', name: 'Louvor Em Cena', kind: 'audio', seconds: 200,
      lyrics: [{ cover: true }, { text: 'primeira estrofe' }, { text: 'segunda estrofe' }],
    };
    lvSource = null;
    // A folha é desenhada pelo CLIQUE; se ela já estivesse aberta, o oráculo
    // mediria um desenho anterior e o ouvinte poderia nem ser exercitado.
    return lyricsPopupEl.classList.contains('open');
  });
  checar(preparado === false, 'o cenário começa com a folha FECHADA', preparado);

  await pg.click('#lyricsViewBtn');
  await pg.waitForFunction(() => lyricsPopupEl.classList.contains('open'), null, { timeout: 5000 });

  const cena = await pg.evaluate(() => ({
    fonte: lvActiveSource(),
    naCena: lvNaCena(),
    alvoEhEvento: !!(lvAlvo && typeof Event !== 'undefined' && lvAlvo instanceof Event),
    linhas: lyricsViewBodyEl.querySelectorAll('.lv-row').length,
    vazio: (lyricsViewBodyEl.querySelector('.empty') || {}).textContent || '',
    titulo: lyricsPopupTitleEl.textContent,
  }));
  checar(cena.fonte === 'lyrics',
    'o botão do transporte abre a folha na LETRA da música em cena', cena.fonte);
  checar(cena.alvoEhEvento === false,
    'e o EVENTO do clique não vira o alvo da folha — é o defeito, isolado', cena);
  checar(cena.naCena === true,
    'a folha do transporte segue a CENA (sem alvo): é dela o destaque e o relógio', cena.naCena);
  checar(cena.vazio === '',
    'nada de "Nada em exibição com letra ou texto bíblico" com uma música com letra', cena.vazio);
  checar(cena.linhas === 3,
    'e as três linhas da letra estão desenhadas (a capa conta como posição)', cena.linhas);
  checar(cena.titulo === 'Louvor Em Cena',
    'o título da folha é o da música em cena', cena.titulo);

  // ── 2. A PORTA DA BIBLIOTECA CONTINUA DESVIANDO (v1.2.14) ───────────────
  // A metade que impede a correção acima de virar "a folha é sempre a cena" —
  // isto é, de desfazer o recurso que a v1.2.14 entregou a quem toca.
  await pg.evaluate(() => {
    closeLyricsPopup();
    openLyricsPopup({
      id: 'ensaio', name: 'Louvor Do Ensaio', kind: 'audio', seconds: 180,
      hymnAlbum: 'Hinário Adventista 2022',
      lyrics: [{ text: 'letra do ensaio' }],
    }, 'cifra');
  });
  const ensaio = await pg.evaluate(() => ({
    naCena: lvNaCena(),
    alvo: lvAlvo ? lvAlvo.name : null,
    item: lvItem().name,
    cena: currentItem ? currentItem.name : null,
    fonte: lvActiveSource(),
  }));
  checar(ensaio.naCena === false && ensaio.alvo === 'Louvor Do Ensaio',
    'a Biblioteca aponta a folha para OUTRA música, sem projetar nada', ensaio);
  checar(ensaio.item === 'Louvor Do Ensaio' && ensaio.cena === 'Louvor Em Cena',
    'e o `currentItem` não foi tocado — o alvo é leitura, não projeção', ensaio);
  checar(ensaio.fonte === 'cifra',
    'e o pedido de quem abriu vence: a Biblioteca abre na CIFRA', ensaio.fonte);

  // ── 3. E O ALVO MORRE COM A FOLHA ───────────────────────────────────────
  // Sem isto, a próxima abertura pelo transporte mostraria a música do ensaio
  // no lugar da que está no ar, e nada na tela explicaria por quê.
  await pg.evaluate(() => closeLyricsPopup());
  await pg.click('#lyricsViewBtn');
  await pg.waitForFunction(() => lyricsPopupEl.classList.contains('open'), null, { timeout: 5000 });
  const devolta = await pg.evaluate(() => ({ naCena: lvNaCena(), titulo: lyricsPopupTitleEl.textContent }));
  checar(devolta.naCena === true && devolta.titulo === 'Louvor Em Cena',
    'fechada a folha, o botão do transporte volta a mostrar a CENA', devolta);
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
