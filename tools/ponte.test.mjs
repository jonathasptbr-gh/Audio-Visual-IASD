// O QUE A PONTE DE FATO ENTREGA ao Kotlin.
//
// ## Por que ele existe
//
// `shared/native.js` não repassa os objetos que recebe: ele os REMONTA campo a
// campo antes de serializar. É a forma certa (o outro lado é um
// `@JavascriptInterface` e nada garante que o objeto seja serializável), e tem
// um modo de falhar próprio: **um campo esquecido some em silêncio**. Do lado
// Kotlin, `optBoolean`/`optLong` leem ausente como `false`/`0`, que são valores
// legítimos — não há exceção, não há log, não há nada.
//
// Já aconteceu duas vezes:
//
//  - `slideLabel` ficou de fora do `nowPlaying` da v5.97 à v5.102, e a
//    notificação escreveu "(estrofe)" durante toda a rodada das apresentações,
//    onde ⏮/⏭ passam PÁGINA.
//  - `bytes` ficou de fora do `bgProgress` desde a v5.118 — a versão que o
//    criou. O Kotlin leu `false` e apresentou bytes como se fossem ITENS: um
//    vídeo de 380 MB virava "0 de 398458880" na notificação, que se lê como
//    quatrocentos milhões de músicas. O recurso inteiro nunca funcionou.
//
// E o `| 0` da mesma função tem o defeito irmão: ele trunca para Int32 COM
// SINAL, então qualquer tamanho acima de 2 GB — um vídeo de 1080p — vira
// negativo e o `Math.max(0, …)` o zera.
//
// Este teste roda o `native.js` de verdade contra um `__AVBridge` de mentira e
// confere o JSON que chegaria ao Kotlin.
//
//   node tools/ponte.test.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const NATIVE = fs.readFileSync(path.join(RAIZ, 'shared', 'native.js'), 'utf8');

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + obtido : '')); falhas.push(msg); }
}

const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);

// CONTEXTO PRÓPRIO, e não `navegador.newPage()`: a regra do projeto é
// `semRedeExterna(ctx)` logo depois de CADA `newContext()`, e uma página criada
// no contexto padrão não tem rota de bloqueio nenhuma registrada. Hoje as
// páginas daqui vão para `about:blank`, então não há exposição — mas quem
// ampliar este oráculo para carregar o Controle de verdade herdaria o modo de
// falhar que o `sem-rede.mjs` existe para fechar: na máquina de quem escreve as
// chamadas à LouvorJA morrem e o teste é determinístico POR ACIDENTE; no runner
// elas respondem e o catálogo real desaba sobre a fixture.
const ctx = await navegador.newContext();
await semRedeExterna(ctx);
const pg = await ctx.newPage();

try {
  // O `__AVBridge` DE MENTIRA precisa existir ANTES do script: a IIFE do
  // native.js volta na entrada quando ele falta, e nada é definido.
  await pg.addInitScript(() => {
    window.__recebido = {};
    window.__AVBridge = {
      shellVersion: () => 99,
      role: () => 'controle',
      appVersion: () => 'v9.9',
      bgProgress: (json) => { window.__recebido.bgProgress = json; },
      nowPlaying: (json) => { window.__recebido.nowPlaying = json; },
      otaConfirm: () => {},
    };
  });
  await pg.goto('about:blank');
  await pg.addScriptTag({ content: NATIVE });

  // ---- bgProgress: a UNIDADE viaja? --------------------------------------
  const p = await pg.evaluate(() => {
    AVNative.bgProgress({
      label: 'Baixando vídeo', done: 12_000_000, total: 380_000_000,
      etaMs: 90_000, items: ['Hino 471'], idleMs: 0, bytes: true,
    });
    return JSON.parse(window.__recebido.bgProgress);
  });
  checar(p.bytes === true,
    'bgProgress leva a bandeira `bytes` — sem ela o Kotlin mostra bytes como ITENS',
    JSON.stringify(p));
  checar(p.done === 12_000_000 && p.total === 380_000_000,
    'e os números chegam inteiros', p.done + '/' + p.total);
  checar(p.label === 'Baixando vídeo' && p.items[0] === 'Hino 471' && p.etaMs === 90_000,
    'com rótulo, item e estimativa');

  // Um vídeo de 1080p passa dos 2 GB: é ONDE o `| 0` quebrava.
  const g = await pg.evaluate(() => {
    AVNative.bgProgress({ label: 'x', done: 2_600_000_000, total: 3_100_000_000, bytes: true });
    return JSON.parse(window.__recebido.bgProgress);
  });
  checar(g.done === 2_600_000_000 && g.total === 3_100_000_000,
    'acima de 2 GB os números NÃO viram negativos (o `| 0` é Int32 com sinal)',
    g.done + '/' + g.total);

  // Sem a bandeira, a unidade é ITEM — o caso do lote de músicas.
  const i = await pg.evaluate(() => {
    AVNative.bgProgress({ label: 'Hinário', done: 23, total: 54, items: [] });
    return JSON.parse(window.__recebido.bgProgress);
  });
  checar(i.bytes === false, 'sem a bandeira, a unidade continua sendo ITEM', i.bytes);

  // `idleMs` com valor de verdade: é ele que separa "travado" de "esta faixa é
  // grande" — sumindo, a notificação volta a prometer uma ETA que não existe.
  const t = await pg.evaluate(() => {
    AVNative.bgProgress({ label: 'x', done: 1, total: 54, items: [], idleMs: 95_000 });
    return JSON.parse(window.__recebido.bgProgress);
  });
  checar(t.idleMs === 95_000,
    'bgProgress leva o `idleMs` — sem ele o "sem resposta há X" nunca aparece',
    t.idleMs);

  // ---- espelhoLigar: qual MÉTODO do shell ele chama -----------------------
  //
  // Este é o par do lote do ponto de acesso, e o modo de errar dele é o mesmo
  // da remontagem por campo: silencioso. `espelhoLigar(ip)` tem de ir para o
  // `espelhoLigarEm` — método PRÓPRIO e ADITIVO (shell 57) — e `espelhoLigar()`
  // sem ip tem de continuar indo para o método de sempre.
  //
  // Trocar um pelo outro não daria erro em lugar nenhum: passar o ip para o
  // método antigo o descartaria em silêncio (a escolha do operador sumiria e o
  // shell serviria a outra rede), e chamar o novo sempre quebraria o caminho
  // contra um APK que ainda não o tem — o `call` venceria os 60 s e resolveria
  // `null`, que a folha lê como "a transmissão não respondeu".
  const chamadas = await pg.evaluate(async () => {
    window.__espelho = [];
    window.__AVBridge.espelhoLigar = (id) => {
      window.__espelho.push(['espelhoLigar', null]);
      window.__avResolve(id, { ligado: true });
    };
    window.__AVBridge.espelhoLigarEm = (id, ip) => {
      window.__espelho.push(['espelhoLigarEm', ip]);
      window.__avResolve(id, { ligado: true });
    };
    await AVNative.espelhoLigar();
    await AVNative.espelhoLigar('');
    await AVNative.espelhoLigar('192.168.43.1');
    return window.__espelho;
  });
  checar(chamadas.length === 3, 'as três chamadas de espelhoLigar chegaram ao shell',
    JSON.stringify(chamadas));
  checar(chamadas[0] && chamadas[0][0] === 'espelhoLigar',
    'sem ip, `espelhoLigar()` vai para o método SEM argumento (o caminho de todo aparelho com uma rede só)',
    JSON.stringify(chamadas[0]));
  checar(chamadas[1] && chamadas[1][0] === 'espelhoLigar',
    'ip VAZIO é o mesmo que sem ip — "escolha você", e não uma escolha em branco',
    JSON.stringify(chamadas[1]));
  checar(chamadas[2] && chamadas[2][0] === 'espelhoLigarEm' && chamadas[2][1] === '192.168.43.1',
    'com ip, ele vai para o `espelhoLigarEm` E O IP VIAJA — a escolha do operador',
    JSON.stringify(chamadas[2]));

  // ---- ytDetalhes: o objeto que VOLTA do shell (shell 62) -----------------
  //
  // Ele é remontado campo a campo como o `cifraHtml`, e por isso o modo de
  // falhar da remontagem vale aqui no sentido de VOLTA: um campo esquecido não
  // some em silêncio do lado Kotlin — some da TELA, e o que aparece no card é a
  // linha faltando ou a palavra "undefined".
  //
  // `descricao` é o único deles que exige o método novo (título, canal e
  // duração já vivem no índice da série e valem offline), e é o campo que o
  // YouTube entrega em HTML quando há links: quem o achata é o Kotlin
  // (`YoutubeGrab.detalhes`), e o contrato deste lado é uma frase só — o que
  // chega é TEXTO.
  const det = await pg.evaluate(async () => {
    window.__detalhes = [];
    window.__AVBridge.ytDetalhes = (id, url) => {
      window.__detalhes.push(url);
      window.__avResolve(id, {
        titulo: 'Match point | Provai e Vede 2026 (01/Ago)',
        canal: 'Provai e Vede | Oficial e Adventist Mission',
        seconds: 319,
        descricao: 'Primeira linha.\nSegunda linha, com <b> literal.',
      });
    };
    const r = await AVNative.ytDetalhes('https://youtu.be/aaaaaaaaaa1');
    return { r, urls: window.__detalhes };
  });
  checar(det.urls.length === 1 && det.urls[0] === 'https://youtu.be/aaaaaaaaaa1',
    'ytDetalhes leva a URL ao shell, em string', JSON.stringify(det.urls));
  checar(det.r && det.r.descricao === 'Primeira linha.\nSegunda linha, com <b> literal.',
    'e a DESCRIÇÃO volta inteira, com as quebras de linha do autor',
    JSON.stringify(det.r && det.r.descricao));
  checar(det.r && det.r.titulo === 'Match point | Provai e Vede 2026 (01/Ago)'
    && det.r.canal === 'Provai e Vede | Oficial e Adventist Mission',
    'e o título CRU e o canal — os dois que completam um índice ainda não refeito',
    JSON.stringify(det.r));
  checar(det.r && det.r.seconds === 319,
    'e a duração em segundos', det.r && det.r.seconds);

  // O CAMPO AUSENTE vira VAZIO, nunca `undefined`: é ele que o card imprimiria.
  const detVazio = await pg.evaluate(async () => {
    window.__AVBridge.ytDetalhes = (id) => { window.__avResolve(id, { titulo: 'Só o título' }); };
    return AVNative.ytDetalhes('u');
  });
  checar(detVazio && detVazio.descricao === '' && detVazio.canal === ''
    && detVazio.seconds === 0,
    'um campo que o shell não mandou chega VAZIO, nunca `undefined` no card',
    JSON.stringify(detVazio));

  // ---- e o `null` SOBREVIVE, que é a metade que decide o comportamento ----
  //
  // As duas respostas pedem ações OPOSTAS de quem chama — é a mesma distinção
  // do `status 0` × `404` do `cifraHtml`, um nível acima. `null` é "não houve
  // resposta" (sem rede, prazo vencido, papel `display`) e o `controle.js` NÃO
  // guarda nada: tentar de novo é o certo. Um objeto com `descricao: ''` é
  // "respondeu, e este vídeo não tem descrição", e esse ele guarda — senão toda
  // abertura da gaveta gasta uma extração para chegar à mesma resposta.
  //
  // Achatar o `null` num objeto vazio (o reflexo do `cifraHtml`, que faz
  // exatamente isso) apagaria a distinção: um aparelho sem rede carimbaria
  // "este vídeo não tem descrição" no cache, e a descrição só voltaria fechando
  // o app.
  const detNulo = await pg.evaluate(async () => {
    window.__AVBridge.ytDetalhes = (id) => { window.__avResolve(id, null); };
    return AVNative.ytDetalhes('u');
  });
  checar(detNulo === null,
    'e o `null` do shell continua `null` — "não houve resposta" não é "não há descrição"',
    JSON.stringify(detNulo));

  // ---- nowPlaying: o outro objeto remontado campo a campo -----------------
  const n = await pg.evaluate(() => {
    AVNative.nowPlaying({
      active: true, title: 'Hino 471', subtitle: 'Hinário', playing: true,
      slideMode: true, slideLabel: 'página', wallpaper: false,
      positionMs: 12_000, durationMs: 240_000,
      actions: ['prev', 'playpause', 'next', 'view', 'stop'],
    });
    return JSON.parse(window.__recebido.nowPlaying);
  });
  checar(n.slideLabel === 'página',
    'nowPlaying leva o `slideLabel` — foi ele que ficou de fora da v5.97 à v5.102',
    JSON.stringify(n));
  // O CONJUNTO DE BOTÕES (v5.231), pelo mesmo motivo e no mesmo lugar: é o
  // campo mais novo deste objeto remontado campo a campo, e sem ele o Kotlin lê
  // lista vazia — que é um valor LEGÍTIMO ("use os cinco de sempre"). O
  // esquecimento não daria erro nenhum: daria a notificação de antes, para
  // sempre.
  checar(Array.isArray(n.actions) && n.actions.join(',') === 'prev,playpause,next,view,stop',
    'e leva as `actions` — a lista de botões que o lado web escolheu',
    JSON.stringify(n.actions));
  const semAcoes = await pg.evaluate(() => {
    AVNative.nowPlaying({ active: true, title: 'Cronômetro' });
    return JSON.parse(window.__recebido.nowPlaying);
  });
  checar(Array.isArray(semAcoes.actions) && semAcoes.actions.length === 0,
    'sem a lista, o campo viaja VAZIO — é assim que o shell sabe usar o padrão',
    JSON.stringify(semAcoes.actions));
  checar(n.active === true && n.playing === true && n.slideMode === true,
    'e as três bandeiras de estado');
  checar(n.positionMs === 12_000 && n.durationMs === 240_000,
    'e a posição na linha do tempo', n.positionMs + '/' + n.durationMs);
  checar(n.title === 'Hino 471' && n.subtitle === 'Hinário',
    'e o título e o subtítulo — é o que a notificação e a tela de bloqueio exibem',
    n.title + ' / ' + n.subtitle);
  checar(n.wallpaper === false, 'e a bandeira `wallpaper`', n.wallpaper);

  // O outro estado das bandeiras: `false`/ausente é o que o `optBoolean` lê
  // quando o campo NÃO viaja, então só o par true/false prova que ele viaja.
  const w = await pg.evaluate(() => {
    AVNative.nowPlaying({
      active: true, title: 'Cortina', subtitle: '', playing: false,
      slideMode: false, slideLabel: '', wallpaper: true,
      positionMs: 0, durationMs: 0,
    });
    return JSON.parse(window.__recebido.nowPlaying);
  });
  checar(w.wallpaper === true, 'wallpaper=true também chega (o par completo)', w.wallpaper);

  // Acima de 2³¹ ms: o `| 0` que a v5.137 matou no bgProgress com `inteiro()`
  // sobrevivia aqui — posição/duração viravam negativas e o `Math.max` zerava.
  const l = await pg.evaluate(() => {
    AVNative.nowPlaying({
      active: true, title: 'Maratona', subtitle: '', playing: true,
      positionMs: 2_500_000_000, durationMs: 3_100_000_000,
    });
    return JSON.parse(window.__recebido.nowPlaying);
  });
  checar(l.positionMs === 2_500_000_000 && l.durationMs === 3_100_000_000,
    'acima de 2³¹ ms a linha do tempo NÃO vira negativa (o defeito irmão do bgProgress)',
    l.positionMs + '/' + l.durationMs);

  // ---- o RELAY do barramento, sem dreno nenhum (E7) -----------------------
  //
  // O papel `espelho` morreu com o espelho de pixels (docs/TELAO-POR-COMANDOS.md):
  // não há mais segunda cópia do /display/ no MESMO barramento a calar. O
  // relay volta a ser o simples: toda mensagem sai pelos dois caminhos, em
  // qualquer papel — e o dreno da era nova mora no tela.js da tela da REDE
  // (outro aparelho, outra origem), provado pelo tools/tela-rede.test.mjs.
  async function paginaComPapel(papel) {
    const c = await navegador.newContext();
    await semRedeExterna(c);
    const p = await c.newPage();
    await p.addInitScript((role) => {
      window.__CanalReal = window.BroadcastChannel;
      window.__busPost = [];
      window.__AVBridge = {
        shellVersion: () => 99,
        role: () => role,
        appVersion: () => 'v9.9',
        busPost: (json) => { window.__busPost.push(JSON.parse(json)); },
        otaConfirm: () => {},
      };
    }, papel);
    await p.goto('about:blank');
    await p.addScriptTag({ content: NATIVE });
    return p;
  }

  const percursoDoBarramento = async () => {
    window.__AVBus.post({ type: 'display-ready', __de: 'inst-1' });
    window.__AVBus.post({ type: 'display-status', currentTime: 12 });
    window.__AVBus.post({ type: 'media-ended', id: 'hino-471' });
    window.__AVBus.post({ type: 'mic-status', on: false });
    const canal = new BroadcastChannel('av-iasd');
    const saiu = [];
    const ouvinte = new window.__CanalReal('av-iasd');
    ouvinte.addEventListener('message', (ev) => saiu.push(ev.data));
    canal.postMessage({ type: 'display-status', currentTime: 12 });
    await new Promise((r) => setTimeout(r, 250));
    return {
      papel: window.__AV_ROLE__,
      bus: window.__busPost,
      construtorTrocado: window.BroadcastChannel !== window.__CanalReal,
      vazou: saiu.some((m) => m && m.type === 'display-status'),
    };
  };

  const pgDisplay = await paginaComPapel('display');
  const dsp = await pgDisplay.evaluate(percursoDoBarramento);
  checar(dsp.bus.length === 4,
    'no telão as QUATRO mensagens saem pelo relay — não há mais dreno deste lado',
    JSON.stringify(dsp.bus.map((m) => m.type)));
  checar(dsp.construtorTrocado === false,
    'e o BroadcastChannel não é tocado em papel nenhum', dsp.construtorTrocado);
  checar(dsp.vazou === true,
    'e ele continua emitindo pelo canal (o segundo caminho do relay)', dsp.vazou);
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

await navegador.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
