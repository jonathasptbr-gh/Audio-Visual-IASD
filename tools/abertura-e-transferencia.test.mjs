#!/usr/bin/env node
// ============================================================================
// A ABERTURA POR TRÁS DOS PANOS, A BADGE E OS TRÊS TILES DE "ESTE APARELHO".
//
// ## Por que este oráculo existe
//
// Ele guarda três coisas da v1.7.0, e nenhuma delas aparece num teste de
// comportamento comum:
//
//  1. **A CORTINA que não levanta.** O `#splash` cobre a tela inteira, e um app
//     que fica atrás dela é um app INUTILIZÁVEL — pior que o piscar que ele
//     veio corrigir. O caminho provável de isso acontecer é justamente o que o
//     watchdog do OTA existe para pegar: um bundle em que o `controle.js` nem
//     chega a ser parseado. É por isso que o prazo é armado no `<head>`, e é
//     esse cenário — o `controle.js` que NUNCA carrega — que o bloco A mede.
//  2. **O NÚMERO DE VERSÃO que diverge de si mesmo.** Ele passou a ser escrito
//     em TRÊS casas por um escritor só; duas casas anunciando versões
//     diferentes é o defeito que o operador repassa como fato ao pedir ajuda.
//     E o índice do SHELL saiu da tela **e ficou no Registro** — tirar dos dois
//     lugares é a regressão silenciosa deste lote.
//  3. **O BLOCO que só existe no app.** Os três tiles dependem da ponte (o
//     chooser do Android, o "Salvar como" do SAF e o canal de bytes), e no
//     navegador eles sabem apenas não funcionar.
//
//   node tools/abertura-e-transferencia.test.mjs
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperar, checar, falhas } from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const VERSAO = JSON.parse(fs.readFileSync(path.join(RAIZ, 'version.json'), 'utf8')).version;
const SHELL_NOME = '9.99-teste';

const servidor = servirEstatico(RAIZ);

// Uma ponte MÍNIMA: só o que a abertura toca, mais os três métodos do lote.
// Ela grava o que recebe (`window.__ponte`), porque é isso que se afirma —
// o efeito de um chooser do Android não existe num navegador, e medi-lo seria
// medir o arnês.
const PONTE = `(function () {
  window.__ponte = { compartilhado: [], pacoteCriado: [], cancelado: 0 };
  const vazio = { displays: [], listFolder: [], pickDoc: [], otaPending: '', otaDiag: '',
    espelhoEstado: { ligado: false, telas: [], redes: [] }, espelhoDiag: {},
    castTarget: { label: '' }, apkProcurar: {}, ytDiag: '', cifraDiag: '',
    farolEstado: { conta: true, ultimo: 0, diag: 'de teste' } };
  const comCallId = new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','requestMic','castTarget',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','apkProcurar','otaPending','otaApply',
    'otaCheck','otaDiag','ytDiag','cifraDiag','farolEstado','ytCanalPlaylists','ytPlaylist',
    'ytDetalhes','micDiag','areaTransferencia','salvarTexto','pacoteCriar','pacoteFechar']);
  const B = {
    shellVersion: () => 63,
    role: () => 'controle',
    appVersion: () => ${JSON.stringify(SHELL_NOME)},
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    compartilharTexto: (t) => { window.__ponte.compartilhado.push(String(t)); },
    pacoteCancelar: () => { window.__ponte.cancelado++; },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','castTarget',
    'deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar','espelhoCertEstado',
    'espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado','espelhoLigar',
    'keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply','otaCheck',
    'otaDiag','otaPending','pickDoc','pickFolder','requestMic','systemVolume','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio',
    'ytPlaylist','ytSearch','ytStream','farolEstado','projecaoLocal','micDiag','cifraHtml',
    'cifraDiag','areaTransferencia','salvarTexto','ytDetalhes','pacoteCriar','pacoteFechar'];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      if (!comCallId.has(n)) return undefined;
      const id = args[0];
      if (typeof id === 'string') {
        const v = Object.prototype.hasOwnProperty.call(vazio, n) ? vazio[n] : null;
        setTimeout(() => { try { window.__avResolve(id, v); } catch (_) {} }, 0);
      }
      return undefined;
    };
  }
  window.__avPacote = { postMessage: () => {} };
  window.__AVBridge = B;
})();`;

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const base = `http://localhost:${porta}`;
const navegador = await abrirNavegador();

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY|ERR_FAILED/;
function vigiar(pg) {
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(t);
  });
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
}

async function abrirApp(opts) {
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  vigiar(pg);
  if (opts && opts.semPonte !== true) await pg.addInitScript(PONTE);
  if (opts && opts.tema) {
    // A ESCOLHA GUARDADA, semeada como o app a guarda: `localStorage`, no MESMO
    // origin. É a única fonte que existe antes de haver JavaScript do app.
    await pg.addInitScript(`try { localStorage.setItem('av.tema', ${JSON.stringify(opts.tema)}); } catch (e) {}`);
  }
  return { ctx, pg };
}

try {
  // =========================================================================
  // A · A CORTINA
  // =========================================================================

  // ── A1. O CENÁRIO CATASTRÓFICO: o `controle.js` NUNCA carrega ───────────
  //
  // É o bundle que o watchdog do OTA descarta no lançamento seguinte, e é o
  // único caminho em que uma cortina mal escrita tranca o app para sempre. As
  // duas metades desta asserção são o lote inteiro: o TEMA já está certo (o
  // script do `<head>` é o único que rodou) e a cortina LEVANTA mesmo assim.
  {
    const { ctx, pg } = await abrirApp({ tema: 'claro' });
    await ctx.route('**/controle/controle.js', (r) => r.abort());
    await pg.clock.install();
    await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });

    checar(await pg.evaluate(() => document.documentElement.dataset.tema),
      'A1 · o TEMA guardado já está no `<html>` com o `controle.js` fora do ar — '
      + 'quem o escreve é o script inline do `<head>`, antes do primeiro quadro');
    checar(await pg.evaluate(() => !!document.getElementById('splash')),
      'A1 · e a cortina está lá, cobrindo a tela pela metade que subiu');
    // O PRAZO. Sem ele, este app estaria trancado — e não haveria erro em
    // lugar nenhum para explicar por quê.
    await pg.clock.fastForward('00:13');
    await pg.clock.fastForward(500);
    checar(await esperar(pg, () => !document.getElementById('splash')) === true,
      'A1 · e ela LEVANTA pelo prazo armado no `<head>`, mesmo sem o `controle.js` — '
      + 'o app volta a ser o app quebrado À VISTA, que é diagnosticável');
    await ctx.close();
  }

  // ── A2. O CAMINHO NORMAL: a cortina sai DO DOM quando o app está pronto ──
  {
    const { ctx, pg } = await abrirApp({});
    await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
    const pronto = await esperar(pg, () => !document.getElementById('splash'), null, 30000);
    checar(pronto === true, 'A2 · a cortina levanta sozinha quando o `init()` termina', pronto);
    // POR REMOÇÃO DO NÓ, e não por opacidade: uma camada `opacity: 0` sobre a
    // tela inteira continua recebendo o toque, e o app abriria INTOCÁVEL. A
    // pergunta é de HIT-TEST, nunca do estilo computado — é o alvo que importa.
    const alvo = await pg.evaluate(() => {
      const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      return el ? (el.id || el.className || el.tagName) : '';
    });
    checar(!String(alvo).includes('splash'),
      'A2 · e o meio da tela responde ao dedo — a cortina saiu do DOM, não ficou transparente por cima',
      alvo);
    await ctx.close();
  }

  // =========================================================================
  // B · A BADGE, E O ÍNDICE DO SHELL
  // =========================================================================
  {
    const { ctx, pg } = await abrirApp({});
    await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
    await esperar(pg, () => !document.getElementById('splash'), null, 30000);

    const textos = await pg.evaluate(() => ({
      simples: (document.getElementById('simpleVersion') || {}).textContent,
      avancado: (document.getElementById('listVersion') || {}).textContent,
      rodape: (document.getElementById('appVersion') || {}).textContent,
    }));
    const esperado = 'v' + VERSAO;
    checar(textos.simples === esperado && textos.avancado === esperado && textos.rodape === esperado,
      'B · as TRÊS casas dizem o MESMO número, e ele é a versão do `version.json` (' + esperado + ') — '
      + 'um escritor só é o que impede duas telas de anunciarem versões diferentes', textos);

    // O PEDIDO, ao pé da letra: *"apenas um número, sem o 'web'"*.
    const juntos = [textos.simples, textos.avancado, textos.rodape].join(' ');
    checar(!/web|shell/i.test(juntos),
      'B · e nenhuma delas escreve "Web" ou "Shell" — é um número, não uma tabela de canais', juntos);
    checar(!juntos.includes(SHELL_NOME),
      'B · nem o índice do SHELL, que era o segundo número da mesma linha', juntos);

    // A METADE QUE IMPEDE A REGRESSÃO: o pedido tirou o índice do shell DA
    // TELA — *"pode estar nos registros"* —, e tirá-lo dos dois lugares é o
    // conserto largo demais. Sem esta asserção, apagar a linha do Registro
    // passaria em tudo o mais e o app perderia a única resposta que existe
    // para *"o OTA chegou e o APK ainda não?"*.
    const registro = await pg.evaluate(async () => {
      await window.renderDiag();
      return typeof diagTexto === 'string' ? diagTexto : '';
    });
    checar(registro.includes(SHELL_NOME),
      'B · mas o REGISTRO continua trazendo o índice do shell — é lá que a distinção '
      + 'entre os dois canais de atualização responde alguma pergunta');
    checar(registro.includes(VERSAO),
      'B · e a versão da base web ao lado dele, na mesma linha');
    await ctx.close();
  }

  // =========================================================================
  // C · OS TRÊS TILES DE "ESTE APARELHO"
  // =========================================================================
  {
    const { ctx, pg } = await abrirApp({});
    await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
    await esperar(pg, () => !document.getElementById('splash'), null, 30000);

    // A FOLHA PRECISA ESTAR ABERTA, e é ela a única porta do bloco: por isso o
    // caminho aqui é o REAL (o toque na engrenagem do Modo Fácil), e não um
    // `classList.add('open')` — um bloco alcançável só por um atalho de teste é
    // um bloco que ninguém alcança no aparelho.
    await pg.click('#simpleSettingsBtn');
    checar(await esperar(pg, () => {
      const f = document.getElementById('fadePopup');
      return !!f && f.classList.contains('open');
    }) === true, 'C · a engrenagem do Modo Fácil abre Configurações');

    const bloco = await pg.evaluate(() => {
      const r = document.getElementById('aparelhoRow');
      return {
        existe: !!r,
        escondido: r ? r.hidden : null,
        tiles: r ? Array.from(r.querySelectorAll('.qs-tile')).map((b) => b.id) : [],
      };
    });
    checar(bloco.existe && bloco.escondido === false,
      'C · no APP o bloco "Este aparelho" está à vista', bloco);
    checar(bloco.tiles.join(',') === 'shareAppTile,pacoteExportarTile,pacoteImportarTile',
      'C · com os três tiles, na ordem: compartilhar · exportar · importar', bloco.tiles);

    // O COMPARTILHAR CHEGA À PONTE COM O ENDEREÇO DENTRO. A asserção é sobre o
    // TEXTO e não sobre "a ponte foi chamada": um chooser aberto com uma frase
    // sem link é exatamente o defeito que ninguém veria daqui.
    await pg.click('#shareAppTile');
    const mandado = await pg.evaluate(() => window.__ponte.compartilhado);
    checar(mandado.length === 1 && /^https:\/\/[a-z0-9.-]+\/.*/i.test(mandado[0].split(' ').pop()),
      'C · tocar em Compartilhar manda UM texto à ponte, terminado no endereço da página', mandado);
    checar(/Áudio Visual IASD/.test(mandado[0] || ''),
      'C · e o texto diz o que é o link — um endereço solto numa conversa não faz ninguém tocar nele',
      mandado[0]);
    await ctx.close();
  }

  // ── C2. A REVERSÃO: sem ponte, o bloco INTEIRO não existe ───────────────
  //
  // Sem ela, revelar o bloco sempre passaria em tudo o mais — e o que sairia
  // no navegador seriam três botões que só sabem não funcionar, mais um rótulo
  // "Este aparelho" sobre nada.
  {
    const { ctx, pg } = await abrirApp({ semPonte: true });
    await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
    await esperar(pg, () => !document.getElementById('splash'), null, 30000);
    const escondido = await pg.evaluate(() => {
      const r = document.getElementById('aparelhoRow');
      return r ? r.hidden : null;
    });
    checar(escondido === true,
      'C2 · sem ponte o bloco inteiro é `hidden` — os três dependem do shell, '
      + 'e um rótulo sozinho é um controle que não existe', escondido);
    await ctx.close();
  }

  checar(erros.length === 0, 'nenhum erro de console', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
