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
  const vazio = { acervoEstado: { cessao: { cedendo: false }, achados: [], descoberta: {} }, displays: [], listFolder: [], pickDoc: [], otaPending: '', otaDiag: '',
    espelhoEstado: { ligado: false, telas: [], redes: [] }, espelhoDiag: {},
    castTarget: { label: '' }, apkProcurar: {}, ytDiag: '', cifraDiag: '',
    farolEstado: { conta: true, ultimo: 0, diag: 'de teste' } };
  const comCallId = new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','requestMic','castTarget',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','apkProcurar','otaPending','otaApply',
    'otaCheck','otaDiag','ytDiag','cifraDiag','farolEstado','ytCanalPlaylists','ytPlaylist',
    'ytDetalhes','micDiag','areaTransferencia','salvarTexto','pacoteCriar','pacoteFechar',
    'acervoEstado','acervoCeder','acervoPublicar','acervoParear']);
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
    'cifraDiag','areaTransferencia','salvarTexto','ytDetalhes','pacoteCriar','pacoteFechar',
    // OS OITO DO CLONE (shell 65). Eles entram aqui porque o cloneRetomar
    // roda na abertura de TODO oráculo que sobe o Controle com a ponte: sem o
    // nome, a chamada lança dentro do native.js. Uma ponte de mentira que não
    // conhece um método que o app chama é a divergência que este repositório já
    // pagou uma vez.
    'acervoCeder','acervoPararCessao','acervoPublicar','acervoResponder',
    'acervoProcurar','acervoParear','acervoSoltar','acervoEstado',
  ];
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

  // ── A3. O PISO (v1.7.2): a cortina não pode ser um LAMPEJO ──────────────
  //
  // Pedido do operador: *"ajuste melhor o tempo da splash screen, está muito
  // rápido. Deixe por padrão um tempo mínimo se possível mais longo"*. Num
  // aparelho com o acervo em cache o `init()` termina em algumas centenas de
  // milissegundos, e a marca aparecia e sumia antes de ser lida — a mesma
  // sensação de piscar que a cortina veio consertar, um degrau acima.
  //
  // A MEDIDA É COM O RELÓGIO MOCKADO, e não esperando 1,8 s de verdade: o que
  // se afirma é uma REGRA DE TEMPO, e um oráculo que dorme mede o agendador da
  // máquina junto. A prova é em DUAS PONTAS — antes do piso ela está lá, depois
  // dele ela saiu —, porque só a segunda passa também numa cortina que nunca
  // levanta, e só a primeira passa também num piso de zero.
  //
  // AS DUAS LEITURAS SÃO IMEDIATAS, e não uma `esperar()`: MEDIDO ao escrever
  // este bloco, o relógio instalado do Playwright CONTINUA ANDANDO com o tempo
  // real, então uma espera de 15 s cruza o TETO de 12 s — e a segunda asserção
  // passava pelo motivo errado, aprovando até uma cortina que nunca levanta
  // pelo `pronto()`. Lendo no ponto exato em que o relógio foi posto, o teto
  // fica fora do alcance e o que se mede é só o piso.
  {
    const { ctx, pg } = await abrirApp({});
    await pg.clock.install();
    await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
    // O APP DE PÉ é o gatilho do `pronto()`, e ele é o cenário: sem isso o que
    // se mediria era o TETO de 12 s, que é outra regra.
    await pg.waitForFunction(() => typeof window.__avBack === 'function', null, { timeout: 20000 });
    await pg.evaluate(() => window.__avSplash.pronto());
    await pg.clock.fastForward(400);
    checar(await pg.evaluate(() => !!document.getElementById('splash')),
      'A3 · com o app JÁ de pé, a cortina continua na tela 400 ms depois — ela '
      + 'tem um PISO, e sem ele a abertura é um lampejo');
    // EM FATIAS, e não num salto só: a saída são DOIS temporizadores em
    // sequência — o piso agenda o esmaecimento, e o esmaecimento agenda a
    // remoção do nó. `fastForward` NÃO reprocessa o temporizador que o callback
    // agenda no meio do salto (é a mesma armadilha que o
    // `fome-que-desiste.test.mjs` já mediu), então um `fastForward('00:03')`
    // dispara o primeiro e deixa o segundo pendurado. Somando 3 s em fatias de
    // 500 ms, cada um roda na sua vez — e o total continua bem abaixo dos 12 s
    // do teto.
    for (let i = 0; i < 6; i++) await pg.clock.fastForward(500);
    checar(await pg.evaluate(() => !document.getElementById('splash')),
      'A3 · e ela sai depois dele — o piso ATRASA a saída, não a impede');
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
    // O RODAPÉ LEVA O NOME JUNTO desde a v1.7.2 (*"para que seja 'áudio visual
    // IASD vx.x.x' com o nome do app, para ter um melhor preenchimento do
    // rodapé"*), e o NÚMERO continua sendo o mesmo das duas badges: é ele que
    // esta asserção guarda. As badges do cabeçalho seguem secas — levar o nome
    // para uma pastilha de 40px seria a mesma frase em três tamanhos.
    checar(textos.simples === esperado && textos.avancado === esperado
      && textos.rodape === 'Áudio Visual IASD ' + esperado,
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

    // O RÓTULO "ESTE APARELHO" SAIU na v1.7.2 e os três tiles entraram na grade
    // única, a pedido do operador. O que este bloco guarda não mudou de
    // natureza — eles existem no APP e não no navegador —, mudou de PORTA: a
    // pergunta passou a ser sobre cada tile, porque não há mais um bloco para
    // esconder de uma vez.
    const bloco = await pg.evaluate(() => {
      const ids = ['shareAppTile', 'pacoteExportarTile', 'pacoteImportarTile'];
      const grade = document.querySelector('.qs-grade');
      return {
        escondidos: ids.filter((id) => (document.getElementById(id) || {}).hidden !== false),
        // A ORDEM DENTRO DA GRADE, e não a existência: eles são a ÚLTIMA
        // FILEIRA (v1.7.6) — as seis preferências da PROJEÇÃO em cima, o que se
        // faz com o APP fora dela embaixo. Ler a grade inteira é o que prova
        // que eles não voltaram a morar num bloco à parte.
        grade: grade ? [...grade.children].map((e) => e.id) : [],
      };
    });
    checar(bloco.escondidos.length === 0,
      'C · no APP os três tiles deste aparelho estão à vista', bloco);
    checar(bloco.grade.join(',') === 'temaTile,fitTile,wallTile,histOpenRow,'
      + 'lyricsBgTile,rotBtn,shareAppTile,pacoteExportarTile,pacoteImportarTile,'
      + 'cloneCederTile,cloneReceberTile',
      'C · na MESMA grade dos outros, e na metade de BAIXO — com os dois do '
      + 'CLONE (v1.8.0) ao lado deles, que é a mesma natureza',
      bloco.grade);

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
  // Sem ela, revelar os tiles sempre passaria em tudo o mais — e o que sairia
  // no navegador seriam três botões que só sabem não funcionar.
  {
    const { ctx, pg } = await abrirApp({ semPonte: true });
    await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
    await esperar(pg, () => !document.getElementById('splash'), null, 30000);
    const visiveis = await pg.evaluate(() => ['shareAppTile', 'pacoteExportarTile', 'pacoteImportarTile']
      .filter((id) => (document.getElementById(id) || {}).hidden === false));
    checar(visiveis.length === 0,
      'C2 · sem ponte os três são `hidden`, um a um — eles dependem do shell, e '
      + 'um botão que só sabe não funcionar é pior que botão nenhum', visiveis);
    await ctx.close();
  }

  checar(erros.length === 0, 'nenhum erro de console', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
