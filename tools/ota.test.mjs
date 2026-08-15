// O FLUXO DE ATUALIZAÇÃO, de ponta a ponta (v5.234).
//
// ## Por que ele existe
//
// Este é o único caminho do app cujo defeito **não tem sintoma**: quando a
// atualização não chega, nada quebra, nada erra alto, e o operador continua
// usando a versão de anteontem sem saber. Foi assim por dezenas de versões — a
// v5.151 chegou a REMOVER a pergunta porque ela "nunca aparecia", e a
// justificativa (cena/download/espelho suprimindo o diálogo) só foi
// identificada meses depois. Nenhum teste tocava neste código: nem o
// `smoke.mjs` (que sobe sem ponte, e todo este bloco é `window.__NATIVE__`),
// nem o `boot-nativo.test.mjs` (que prova o boot, não o fluxo).
//
// O que se afirma aqui é o que o operador relatou como quebrado:
//
//  1. havendo só base web, a pergunta aparece com os DOIS desfechos;
//  2. havendo Release junto, ela fala do LOTE e o "Atualizar agora" leva os
//     dois — grava a intenção ANTES de aplicar o OTA;
//  3. a intenção SOBREVIVE À RECARGA e vira a instalação do APK;
//  4. "Deixar para depois" cala o diálogo e NÃO cala o fato (o rótulo marca);
//  5. o ESPELHO LIGADO não segura mais a pergunta — era ele o elo que fazia a
//     v5.151 desistir de perguntar.
//
// E, desde a v5.245 (o segundo relato do operador sobre este mesmo fluxo):
//
//  6. um toque FORA do diálogo não responde por ele — a recusa acidental
//     custava a atualização pelo resto da sessão;
//  7. o BOTÃO de Configurações procura quando não há nada e atualiza quando
//     há, que é o caminho de quem adiou a pergunta ou quem simplesmente foi
//     atrás.
//
//   node tools/ota.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
function checar(cond, msg) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg); falhas.push(msg); }
}

// A PONTE DE MENTIRA — shell 43, com o estado de atualização parametrizado.
//
// Ela REGISTRA as chamadas (`window.__chamadas`) porque metade do que este
// arquivo afirma é sobre o que o app PEDE ao shell, e não sobre o que a tela
// desenha: gravar a intenção antes de aplicar o OTA, e chamar `apkInstalar`
// depois da recarga, são exatamente os dois pontos em que o fluxo já falhou
// calado.
const ponte = ({ web = '', shell = '', bytes = 0, espelho = false, shellName = '1.98' }) => `(() => {
  window.__chamadas = [];
  const estado = { web: ${JSON.stringify(web)}, webAtual: '5.230',
    shell: ${JSON.stringify(shell)}, shellBytes: ${bytes}, shellAtual: ${JSON.stringify(shellName)},
    diag: 'web v5.230 · shell v${shellName} · última busca há 2s: nada novo' };
  const vazio = { displays: [], listFolder: [], pickDoc: [], ytSearch: [],
    espelhoEstado: { ligado: ${espelho}, endereco: '192.168.0.5:8787', telas: [] },
    espelhoDiag: {}, espelhoCertEstado: { temCert: false },
    castTarget: { label: 'Tela de teste' },
    atualizacaoEstado: estado,
    // O \`otaApply\` do aparelho recarrega as duas páginas e esta promise nunca
    // volta. Aqui ela resolve com a versão, que é o desfecho documentado do
    // caso "não havia o que aplicar" — e é o único que deixa a página viva
    // para ser inspecionada.
    otaApply: ${JSON.stringify(web || null)},
    apkInstalar: '',
    otaPending: ${JSON.stringify(web)},
    otaDiag: '', apkProcurar: {} };
  const comCallId = new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','requestMic','castTarget',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','espelhoCertImportar','espelhoCertApagar',
    'apkProcurar','apkInstalar','otaPending','otaApply','otaDiag','ytDiag','atualizacaoEstado',
    'ytCanalPlaylists','ytPlaylist']);
  const B = {
    shellVersion: () => 43,
    role: () => 'controle',
    appVersion: () => ${JSON.stringify(shellName)},
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
  };
  const nomes = ['apkInstalar','apkProcurar','atualizacaoEstado','bgProgress','captureVolumeKeys',
    'castTarget','deckDiscard','deckExportUrl','deckPages','displays','espelhoAprovar',
    'espelhoCertApagar','espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag',
    'espelhoEstado','espelhoLigar','keepAlive','listFolder','nowPlaying','openCast','openExternal',
    'otaApply','otaCheck','otaDiag','otaPending','pickDoc','pickFolder','requestMic','systemVolume',
    'temaClaro','ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte',
    'ytFetchAudio','ytPlaylist','ytSearch','ytStream'];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      window.__chamadas.push(n);
      if (!comCallId.has(n)) return undefined;
      const id = args[0];
      if (typeof id === 'string') {
        const v = Object.prototype.hasOwnProperty.call(vazio, n) ? vazio[n] : null;
        setTimeout(() => { try { window.__avResolve(id, v); } catch (_) {} }, 0);
      }
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const base = `http://localhost:${porta}`;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);

// Sobe a base com a ponte dada e espera o app ficar DE PÉ — o mesmo critério do
// watchdog do OTA. Sem essa espera, tudo o que vier depois mediria uma página
// que ainda está montando, e o resultado dependeria da velocidade do runner.
async function abrir(cfg) {
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  const pg = await ctx.newPage();
  await pg.addInitScript(ponte(cfg));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function',
    null, { timeout: 25000 },
  );
  return { ctx, pg };
}

// O EMPURRÃO, e ele não pode EXPLODIR quando a função não existe.
//
// A primeira versão deste arquivo chamava `window.__avAtualizacao(...)` direto,
// e num bundle que não a tivesse o teste morria de exceção na primeira
// asserção — levando as outras vinte e duas junto, sem placar. É exatamente o
// defeito que a v5.213 tirou do `apk.yml`: um oráculo que aborta esconde tudo o
// que vinha depois dele. Aqui a ausência da função é um RESULTADO, não um
// acidente, e as asserções seguintes continuam rodando.
const empurrar = (pg, e) => pg.evaluate((estado) => {
  if (typeof window.__avAtualizacao !== 'function') return false;
  window.__avAtualizacao(estado);
  return true;
}, { webAtual: '5.230', shellBytes: 0, shellAtual: '1.98', diag: 'x', shell: '', ...e });

// O TOQUE, com a mesma disciplina do empurrão: um clique de verdade (é assim
// que o operador fecha este diálogo), mas só depois de confirmar que há diálogo
// aberto. Sem a guarda, um bundle que não pergunta faz o Playwright esperar
// trinta segundos por um botão coberto e então ABORTAR o arquivo inteiro — o
// oráculo morreria exatamente no caso que ele existe para detectar.
async function tocar(pg, id) {
  if (!(await dialogo(pg))) { checar(false, 'havia um diálogo aberto para tocar em #' + id); return false; }
  await pg.click('#' + id, { timeout: 5000 });
  return true;
}

// O BOTÃO MORA EM CONFIGURAÇÕES, e é assim que o operador chega nele: pela
// engrenagem. Clicar nele com a folha fechada seria clicar num elemento fora do
// viewport — e o Playwright, com razão, recusa.
// Mesma tolerância do `tocar`: sem o botão, isto é um resultado — o arquivo
// segue e as asserções seguintes continuam valendo.
async function tocarBotao(pg) {
  if (!(await pg.evaluate(() => !!document.getElementById('otaRow')))) {
    checar(false, 'havia um botão #otaRow para tocar');
    return false;
  }
  await pg.click('#otaRow', { timeout: 5000 }).catch(() => {});
  return true;
}

async function abrirConfig(pg) {
  await pg.evaluate(() => { try { openFadePopup(); } catch (_) { /* bundle antigo */ } });
  await pg.waitForTimeout(200);
}

const dialogo = (pg) => pg.evaluate(() => {
  const d = document.getElementById('appDialog');
  if (!d || !d.classList.contains('open')) return null;
  return {
    titulo: document.getElementById('appDialogTitle').textContent,
    msg: document.getElementById('appDialogMsg').textContent,
    ok: document.getElementById('appDialogOk').textContent,
    cancelar: document.getElementById('appDialogCancel').textContent,
    temCancelar: !document.getElementById('appDialogCancel').hidden,
  };
});

try {
  // ── 1. SÓ A BASE WEB: a pergunta existe, e ela tem DOIS desfechos ────────
  {
    const { ctx, pg } = await abrir({ web: '5.999' });
    checar(await empurrar(pg, { web: '5.999' }),
      'o shell tem para quem empurrar o estado (`window.__avAtualizacao`)');
    const d = await dialogo(pg);
    checar(!!d, 'só base web: a PERGUNTA aparece (a v5.151 não perguntava)');
    checar(!!d && d.ok === 'Atualizar agora' && d.cancelar === 'Deixar para depois',
      'e ela tem os DOIS desfechos que o operador pediu, com esses nomes');
    checar(!!d && d.temCancelar, 'o "depois" é um botão de verdade, não um diálogo de aviso');
    checar(!!d && d.msg.includes('5.999') && !/app v/.test(d.msg),
      'a frase fala da BASE e não promete um app que não existe neste lote');
    // O "Atualizar agora" leva ao `otaApply`, e a NENHUMA gravação de intenção:
    // sem APK no lote, gravar uma intenção faria a abertura seguinte tentar
    // instalar uma versão que ninguém publicou.
    await tocar(pg, 'appDialogOk');
    await pg.waitForFunction(() => window.__chamadas.includes('otaApply'), null, { timeout: 5000 })
      .catch(() => {});
    checar(await pg.evaluate(() => window.__chamadas.includes('otaApply')),
      'e "Atualizar agora" APLICA a base (otaApply)');
    checar(await pg.evaluate(async () => !(await window.AVDB.getState('ota-intencao'))),
      'sem APK no lote, nenhuma intenção é gravada');
    await ctx.close();
  }

  // ── 2. LOTE COM RELEASE: uma pergunta só, e a intenção ANTES do OTA ──────
  {
    const { ctx, pg } = await abrir({ web: '5.999', shell: '1.99', bytes: 31457280 });
    await empurrar(pg, { web: '5.999', shell: '1.99', shellBytes: 31457280 });
    const d = await dialogo(pg);
    checar(!!d, 'lote com Release: a pergunta aparece');
    checar(!!d && d.msg.includes('5.999') && d.msg.includes('1.99'),
      'e ela fala do LOTE INTEIRO — base E app na mesma frase, uma decisão só');
    checar(!!d && /30 MB/.test(d.msg),
      'com o PESO do app: é a diferença entre esperar meio minuto e esperar o Wi-Fi da igreja');
    checar(!!d && /confirmar a instalação/i.test(d.msg),
      'e ela AVISA que o Android vai pedir confirmação (o custo que o rótulo não diz)');

    await tocar(pg, 'appDialogOk');
    await pg.waitForFunction(() => window.__chamadas.includes('otaApply'), null, { timeout: 5000 })
      .catch(() => {});
    const i = await pg.evaluate(async () => await window.AVDB.getState('ota-intencao'));
    checar(!!i && i.shell === '1.99',
      'a INTENÇÃO é gravada no banco — é o único lugar que sobrevive à recarga do OTA');
    // A ORDEM importa e é testável: a intenção precisa estar no banco ANTES de
    // o `otaApply` matar o documento. Se ela fosse gravada depois, a recarga
    // chegaria primeiro no aparelho e a metade nativa do lote sumiria sem
    // deixar rastro — com tudo PARECENDO ter funcionado.
    checar(await pg.evaluate(() => window.__chamadas.includes('otaApply')),
      'e só então a base é aplicada');
    await ctx.close();
  }

  // ── 3. A INTENÇÃO ATRAVESSA A RECARGA e vira a instalação ────────────────
  {
    const { ctx, pg } = await abrir({ web: '', shell: '1.99', bytes: 31457280 });
    await pg.evaluate(() => window.AVDB.setState('ota-intencao', { shell: '1.99', em: Date.now() }));
    await pg.reload({ waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function',
      null, { timeout: 25000 });
    let retomou = true;
    // 25 s, o mesmo da espera acima: a asserção é sobre a retomada ACONTECER, e
    // não sobre a velocidade dela — a recarga é de verdade e reexecuta a
    // inicialização inteira. Com 15 s ele reprovava uma vez a cada cinco
    // execuções numa máquina ocupada, e teste que reprova por carga ensina a
    // ignorar vermelho (a lição da v5.204).
    await pg.waitForFunction(() => window.__chamadas.includes('apkInstalar'),
      null, { timeout: 25000 }).catch(() => { retomou = false; });
    checar(retomou,
      'depois da recarga o app RETOMA sozinho e baixa o APK (a segunda metade do lote)');
    checar(await pg.evaluate(async () => !(await window.AVDB.getState('ota-intencao'))),
      'e apaga a intenção — insistir a cada abertura seria um instalador aparecendo do nada');
    await ctx.close();
  }

  // ── 3b. A INTENÇÃO JÁ CUMPRIDA não reabre o instalador ───────────────────
  {
    // O aparelho já está na 1.99: a intenção descreve um passado. Sem esta
    // comparação o instalador reabriria a cada abertura oferecendo a versão que
    // está rodando — e o operador não teria como sair do laço.
    const { ctx, pg } = await abrir({ web: '', shell: '', shellName: '1.99' });
    await pg.evaluate(() => window.AVDB.setState('ota-intencao', { shell: '1.99', em: Date.now() }));
    await pg.reload({ waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function',
      null, { timeout: 25000 });
    await pg.waitForTimeout(2500);
    checar(!(await pg.evaluate(() => window.__chamadas.includes('apkInstalar'))),
      'com o APK já instalado, a intenção NÃO reabre o instalador');
    checar(await pg.evaluate(async () => !(await window.AVDB.getState('ota-intencao'))),
      'e ela é apagada, em vez de ficar sendo reavaliada para sempre');
    await ctx.close();
  }

  // ── 4. "DEIXAR PARA DEPOIS" cala o diálogo, não o FATO ───────────────────
  {
    const { ctx, pg } = await abrir({ web: '5.999' });
    const denovo = () => empurrar(pg, { web: '5.999' });
    await denovo();
    checar(!!(await dialogo(pg)), 'a pergunta apareceu');
    await tocar(pg, 'appDialogCancel');
    await denovo();
    checar(!(await dialogo(pg)),
      '"Deixar para depois" cala o diálogo — um aviso que volta a cada dez segundos é ruído');
    checar(!(await pg.evaluate(() => window.__chamadas.includes('otaApply'))),
      'e NADA é aplicado à revelia (o desfecho que a v5.151 tinha tornado impossível recusar)');
    // O FATO continua na tela: sem isto, "depois" apagaria também a informação
    // de que há algo esperando, e o operador não teria como trazê-la de volta.
    // Desde a v5.245 quem carrega esse fato é o BOTÃO, por extenso, e não mais
    // um ponto no rótulo de versão — o botão diz a mesma coisa e é onde se
    // toca, e os dois juntos eram a mesma informação a dois centímetros.
    // Null-safe de propósito: num bundle SEM o botão isto é um RESULTADO
    // ("não há botão"), não um acidente — e um `evaluate` que lança aqui
    // abortaria o arquivo inteiro, escondendo tudo o que vem depois. É a mesma
    // disciplina do `empurrar` e do `tocar`, e a lição da v5.213.
    const botao = await pg.evaluate(() => {
      const e = document.getElementById('otaRow');
      return e ? { txt: e.textContent, oculto: e.hidden, apagado: e.disabled } : null;
    });
    checar(!!botao && !botao.oculto && /Atualizar/.test(botao.txt) && /5\.999/.test(botao.txt),
      'mas o BOTÃO segue dizendo que há atualização esperando, e qual é');
    checar(!!botao && !botao.apagado, 'e ele está tocável — a hora é boa (sem cena, sem download)');
    await ctx.close();
  }

  // ── 4b. O BOTÃO É O CAMINHO DE VOLTA ─────────────────────────────────────
  //
  // "Deixar para depois" cala o diálogo desta sessão; ele não pode calar o
  // operador que voltou para pedir a atualização de propósito. Antes da v5.245
  // esse caminho era um toque no rótulo de versão — uma afordância que não se
  // anuncia; agora é o botão, e ele APLICA direto, sem repetir a pergunta que
  // acabou de ser adiada.
  {
    const { ctx, pg } = await abrir({ web: '5.999' });
    await empurrar(pg, { web: '5.999' });
    checar(!!(await dialogo(pg)), 'a pergunta apareceu');
    await tocar(pg, 'appDialogCancel');
    await abrirConfig(pg);
    await tocarBotao(pg);
    await pg.waitForFunction(() => window.__chamadas.includes('otaApply'), null, { timeout: 5000 })
      .catch(() => {});
    checar(await pg.evaluate(() => window.__chamadas.includes('otaApply')),
      'e o BOTÃO aplica a atualização adiada — "depois" não é "nunca"');
    await ctx.close();
  }

  // ── 4c. O DIÁLOGO NÃO SE PERDE NUM TOQUE FORA (v5.245) ───────────────────
  //
  // O pedido do operador, palavra por palavra: a notificação "pode ser ignorada
  // tocando fora dela, e assim perdendo a atualização". Um toque no fundo
  // resolvia como "Deixar para depois", que silencia a pergunta pela sessão —
  // e ele nem sabia ter respondido. Os dois botões continuam ali; o que deixa
  // de existir é a recusa por acidente.
  {
    const { ctx, pg } = await abrir({ web: '5.999' });
    await empurrar(pg, { web: '5.999' });
    checar(!!(await dialogo(pg)), 'a pergunta apareceu');
    // O toque é no BACKDROP (o próprio `#appDialog`), que é o que o dedo
    // encontra fora da caixa — e é um clique de verdade, no canto da tela.
    await pg.mouse.click(10, 10);
    await pg.waitForTimeout(300);
    checar(!!(await dialogo(pg)),
      'e um toque FORA dela não a fecha — a atualização não se perde num gesto solto');
    checar(!(await pg.evaluate(() => window.__chamadas.includes('otaApply'))),
      'e nada foi aplicado à revelia por causa desse toque');
    // E ela continua respondível: o "Deixar para depois" é a recusa
    // DELIBERADA, e ela não foi tirada de ninguém.
    await tocar(pg, 'appDialogCancel');
    checar(!(await dialogo(pg)), 'o "Deixar para depois" continua fechando — a saída não sumiu');
    await ctx.close();
  }

  // ── 4d. SEM NADA ESPERANDO, O BOTÃO É A PROCURA ──────────────────────────
  {
    const { ctx, pg } = await abrir({ web: '' });
    const inicial = await pg.evaluate(() => {
      const e = document.getElementById('otaRow');
      return e ? { txt: e.textContent, oculto: e.hidden } : null;
    });
    checar(!!inicial && !inicial.oculto && /Procurar atualiza/i.test(inicial.txt),
      'sem nada esperando, o botão é "Procurar atualização"');
    await abrirConfig(pg);
    await tocarBotao(pg);
    await pg.waitForTimeout(200);
    checar(await pg.evaluate(() => window.__chamadas.includes('otaCheck')),
      'e o toque PROCURA de verdade (otaCheck no shell), pulando o piso entre consultas');
    checar(await pg.evaluate(() => /Procurando/i.test(document.getElementById('otaRow').textContent)),
      'e o próprio botão responde — a resposta nasce onde o toque nasceu');
    await ctx.close();
  }

  // ── 5. O ESPELHO LIGADO NÃO SEGURA MAIS A PERGUNTA ───────────────────────
  {
    // ESTA É A REGRESSÃO DO LOTE. Da v5.141 à v5.151 o diálogo era suprimido
    // com o espelho no ar — e o espelho fica ligado o culto inteiro, então a
    // supressão era permanente e a pergunta simplesmente nunca aparecia. Foi
    // por isso que a v5.151 desistiu de perguntar. O espelho custa uma tela da
    // rede com a página antiga em memória até ser recarregada; a cena e o
    // download custam a projeção e o hinário pela metade.
    const { ctx, pg } = await abrir({ web: '5.999', espelho: true });
    await empurrar(pg, { web: '5.999' });
    checar(!!(await dialogo(pg)),
      'com o ESPELHO LIGADO a pergunta continua aparecendo (o elo que travava a v5.151)');
    checar(await pg.evaluate(() => { try {
      return horaRuimParaPerguntar() === false && horaRuimParaAtualizar() === true;
    } catch (_) { return false; } }),
      'e as duas perguntas são distintas: perguntar pode, INSTALAR o APK não');
    await ctx.close();
  }
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
