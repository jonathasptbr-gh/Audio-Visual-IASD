// O BOOT COMO O APP O FAZ — a base web com a PONTE presente.
//
// ## Por que ele existe
//
// O `smoke.mjs` sobe a base web num Chromium sem `__AVBridge`, e isso é
// deliberado: ali se verifica o que vale nos dois contextos. O preço, que
// ninguém tinha cobrado até a v5.195, é que **todo caminho guardado por
// `window.__NATIVE__` nunca é executado por teste nenhum** — e esses caminhos
// são exatamente os que só rodam no aparelho, onde não há console para olhar.
//
// A v5.195 saiu com um `const` lido na CARGA do módulo e declarado 14 mil
// linhas abaixo. A leitura mora dentro de `if (espelhoDisponivel())`, que é
// FALSO num navegador — então o `smoke.mjs` passou verde, o bundle foi para o
// OTA, e o aparelho abriu em PRETO: `ReferenceError` por zona morta temporal,
// `controle.js` abortado, o watchdog do OTA descartando o bundle no lançamento
// seguinte e o app caindo no embutido do APK. Três sintomas em sequência
// (tela preta → tela pela metade → a versão antiga de volta) para uma causa só,
// e nenhum teste tinha como vê-la.
//
// Este arquivo fecha esse buraco pelo caminho mais barato que existe: injeta um
// `__AVBridge` DE MENTIRA antes de a página carregar e pergunta a mesma coisa
// que o watchdog do OTA pergunta — **o app ficou de pé?** (`otaAppIsUp`, em
// `shared/native.js`). Se ficou, o bundle boota no aparelho; se não, ele
// abriria em preto lá.
//
// ## O que ele NÃO é
//
// Não é teste dos recursos nativos: a ponte responde valores vazios e
// plausíveis, não simula Presentation, download, nem servidor. O que se afirma
// aqui é só o boot — que é precisamente o que o watchdog decide, e o que custa
// um culto quando falha.
//
//   node tools/boot-nativo.test.mjs
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
// O TERCEIRO PARÂMETRO É O VALOR OBTIDO, como no `smoke.mjs`, no
// `sorteio-tela.test.mjs` e no `acervo.test.mjs`. Os sítios de chamada aqui já
// o passavam e a assinatura de dois parâmetros o jogava fora — no CI, onde
// ninguém pode abrir o navegador, a reprovação chegava como uma frase e nada
// mais, e diagnosticá-la exigia adivinhar ou publicar um lote só para
// instrumentar.
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg
      + (obtido !== undefined ? '\n        obtido: '
        + (typeof obtido === 'string' ? obtido : JSON.stringify(obtido)) : ''));
    falhas.push(msg);
  }
}

// A VARREDURA DA ABERTURA, ESPERADA — e não um prazo de parede.
//
// `init()` dispara `autoRefreshCollections()` SEM `await`, e a fase 2 dele varre
// as duas séries. Todo bloco daqui para baixo que chama `fetchCollectionIndex`
// da mesma coleção corria em PARALELO com essa varredura — e o que se perde na
// colisão é o DIÁRIO: `serieDiarioGravar` é um read-modify-write, então a
// metade do canal de uma execução, lida antes e gravada depois da metade dos
// vídeos da outra, apaga a segunda. Quem chegasse depois cairia no caminho da
// economia (a assinatura já bate) e não a reescreveria — o diário fica sem
// `quandoVideos` até o dia virar, e as linhas derivadas dele (`nomes (N)`, o
// que o canal anuncia e não veio, os futuros) somem do Registro.
//
// Medido: 5 reprovações em 20 execuções, sempre nesses contadores e nunca nas
// asserções da regra pura. A espera é sobre o FATO — a varredura acabou e não
// sobrou nada para ela fazer nas duas séries —, nunca sobre um `waitForTimeout`
// que "costuma dar".
//
// **Quem responde "sobrou algo?" é `indiceVencido`, a MESMA função do
// `autoRefreshCollections`.** Uma segunda escrita da regra aqui só provaria que
// o oráculo concorda consigo mesmo — e teria a resposta errada na página do
// CORTE, que nasce com o índice que a página principal já gravou no IndexedDB
// (o contexto é o mesmo): ali "as duas séries têm índice" já é verdade antes de
// a varredura começar, e a espera voltava na hora, para dentro da corrida.
const SERIES = ['serie-provai-vede-2026', 'serie-informativo-missoes-2026'];
// ===== A BIBLIOTECA COM A SEÇÃO DOS FAVORITOS ABERTA =====
// Desde a v1.1.4 a Biblioteca abre TODA FECHADA (`resetarBiblioteca`), e uma
// seção fechada **não constrói corpo** — `[data-fav-corpo]` simplesmente não
// existe. Os casos que falam da seção (a pasta do aparelho, a gaveta de um
// favorito, o par ↑↓, o vão) precisam dela ABERTA, e abri-la é montar o CENÁRIO
// deles, não medir o padrão: o padrão tem caso próprio, lido verbatim do estado
// que o módulo carrega.
//
// POR PÁGINA, e não uma vez: alguns blocos abrem documento próprio (`pg6`), e
// uma função pendurada em `window` não atravessa navegação.
//
// Idempotente de propósito: há blocos que herdam a Biblioteca já aberta do
// anterior, e reabri-la passaria pelo `closeHymnSearch` de quem fechou — que
// agora zera o estado.
const instalarCenarioFav = (pagina) => pagina.evaluate(() => {
  window.__bibliotecaComFavoritos = () => {
    if (!hymnSearchPopupEl.classList.contains('open')) openHymnSearch();
    favAberto = true;
    renderSearchResults('');
  };
});

const esperarVarredura = (pagina) => pagina.waitForFunction((ids) => (
  collectionsRefreshing === false
    && ids.every((id) => {
      const st = collState[id];
      if (!st || !st.serieDiarioEm || !(st.songs || []).length) return false;
      return !indiceVencido(allCollections().find((c) => c.id === id), Date.now());
    })
), SERIES, { timeout: 30000 });

// A PONTE DE MENTIRA. A lista de métodos sai de um `grep` em `shared/native.js`
// (todo `B.<nome>(`) — um método novo lá que este arquivo não conheça responde
// `undefined`, que é o mesmo que um shell antigo faria, e o `try` do
// `native.js` já trata. O contrato do lado Kotlin é assíncrono por `callId`:
// quem chama espera `window.__avResolve(id, json)`, então os métodos com
// `callId` resolvem sozinhos no próximo tique.
const ponteCom = (espelho, telas) => `(() => {
  const vazio = { displays: ${JSON.stringify(telas || [])}, listFolder: [], pickDoc: [], ytSearch: [],
    espelhoEstado: ${JSON.stringify(espelho)}, espelhoDiag: {},
    espelhoCertEstado: { temCert: false }, castTarget: { label: 'Tela de teste' },
    // O FAROL. Ele é SÓ LEITURA desde o shell 61 (a chave saiu na v1.4.42), e
    // quem o consome é a linha "Alcance:" do Registro — que é o único bloco que
    // responde *"o farol chegou a acender?"*. Sem a entrada aqui, o genérico
    // devolve \`null\` e o Registro perderia a linha em silêncio.
    farolEstado: { conta: true, ultimo: 0, diag: 'de teste' } };
  const comCallId = new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','requestMic','castTarget',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','espelhoCertImportar','espelhoCertApagar',
    'apkProcurar','apkInstalar','otaPending','otaApply','otaCheck','otaDiag','ytDiag',
    'farolEstado']);
  const B = {
    shellVersion: () => 46,
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: () => '',
    busPost: (t) => { try { (window.__enviados = window.__enviados || []).push(JSON.parse(t)); } catch (_) {} },
    otaConfirm: () => {},
    // AS SÉRIES (shell 41), com resposta POR URL — o genérico abaixo devolve um
    // valor fixo por método, e aqui cada playlist precisa dos itens dela.
    //
    // As strings são VERBATIM do @provaievedeoficial, com as duas armadilhas
    // que o \`serie.js\` documenta: a playlist de agosto SEM o hífen que as
    // outras têm, e o marcador de Libras em duas formas (\`(Libras)\` na
    // playlist, \`- Libras\` no vídeo). Um harness que "limpasse" isso provaria
    // o percurso contra um canal que não existe — a lição da v5.204.
    //
    // E ele responde POR CANAL (v5.244), porque agora há dois. O de baixo é o
    // @daniellocutor, cuja aba Playlists põe a MESMA série em quatro idiomas
    // lado a lado — é essa a armadilha 7, e um stub que devolvesse a mesma
    // lista para os dois canais não teria como exercitá-la.
    ytCanalPlaylists: (id, canal) => {
      const pls = /daniellocutor/.test(String(canal)) ? [
        { name: 'Misiones | 3º Trimestre 2026', url: 'd/es3', count: 6 },
        { name: '【聖工消息】2026 第三季 (3 Quarter 26)', url: 'd/zh3', count: 9 },
        { name: 'Informativo | 4º Trimestre 2026', url: 'd/pt4', count: 1 },
        { name: 'Informativo | 3º Trimestre 2026', url: 'd/pt3', count: 3 },
        { name: 'Mission Stories | 2º Quarter 2026', url: 'd/en2', count: 13 },
      ] : [
        { name: 'Provai e Vede - Agosto 2026 (Libras)', url: 'p/ago-libras', count: 2 },
        // A CONTAGEM DIVERGE DA ENTREGA de propósito: o canal anuncia 4 e a
        // extração traz 3. É o que os dois canais de verdade fazem (39×38 e
        // 51×50 no primeiro registro real) — um vídeo só para membros, um
        // removido —, e é o achado mais silencioso deste caminho: nada erra,
        // nada recusa, e o sábado daquele episódio não existe na lista.
        { name: 'Provai e Vede Agosto 2026', url: 'p/ago', count: 4 },
        { name: 'Provai e Vede - Julho 2026', url: 'p/jul', count: 1 },
        { name: 'Semana de Mordomia Cristã 2026', url: 'p/outra', count: 9 },
        // O ARQUIVO DOS ANOS ANTERIORES. Ele existe aqui porque o canal de
        // verdade tem 94 playlists e a maior parte é isto — listá-las por
        // inteiro afogava as 9 aceitas sob oitenta linhas mortas (v5.252).
        { name: 'Provai e Vede - Dezembro 2025', url: 'p/dez25', count: 4 },
        { name: 'Provai e Vede - Novembro 2025 (Libras)', url: 'p/nov25l', count: 4 },
      ];
      setTimeout(() => { try { window.__avResolve(id, pls); } catch (_) {} }, 0);
    },
    ytPlaylist: (id, url) => {
      // Contador de EXTRAÇÕES: é ele que prova a economia da assinatura — e,
      // do outro lado, que a economia não se transforma em índice preso.
      window.__nPlaylist = (window.__nPlaylist || 0) + 1;
      const porUrl = {
        'p/ago': { name: 'Provai e Vede Agosto 2026', author: 'Provai e Vede | Oficial', items: [
          // A MINIATURA é \`data:\` de propósito: o extrator devolve uma URL do
          // YouTube, e uma imagem remota num teste é uma requisição que sai
          // pela rede do runner — ou ela falha e vira ruído no console, ou ela
          // dá certo e o caso passa a depender de um serviço de fora. O que se
          // afirma aqui é que a gaveta DESENHA a miniatura que o índice
          // guardou, e para isso a origem dos pixels é indiferente.
          { id: 'aaaaaaaaaa1', url: 'y/1', name: 'Match point | Provai e Vede 2026 (01/Ago)', seconds: 319,
            thumb: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' },
          { id: 'aaaaaaaaaa2', url: 'y/2', name: 'Cada centavo conta | Provai e Vede 2026 (08/Ago) - Libras', seconds: 307 },
          { id: 'aaaaaaaaaa3', url: 'y/3', name: 'Cada centavo conta | Provai e Vede 2026 (08/Ago)', seconds: 307 },
        ] },
        'p/jul': { name: 'Provai e Vede - Julho 2026', author: 'Provai e Vede | Oficial', items: [
          { id: 'aaaaaaaaaa4', url: 'y/4', name: 'Chamado em Silêncio | Provai e Vede 2026 (25/Jul)', seconds: 280 },
        ] },
        // O @daniellocutor. O título do vídeo é a SÉRIE + a data, sem nome de
        // episódio — e o vídeo em espanhol começa com a mesma palavra que o em
        // português, que é por que ele está aqui DENTRO da playlist de PT: é o
        // único lugar em que a recusa por idioma pode ser exercitada.
        'd/pt3': { name: 'Informativo | 3º Trimestre 2026', author: 'Daniel Gonçalves', items: [
          { id: 'bbbbbbbbbb1', url: 'd/1', name: 'Informativo Mundial das Missões | 15 AGOSTO 2026', seconds: 155 },
          { id: 'bbbbbbbbbb2', url: 'd/2', name: 'Informativo Mundial de las Misiones | 15 AGOSTO 2026', seconds: 155 },
          { id: 'bbbbbbbbbb3', url: 'd/3', name: 'Informativo Mundial das Missões | 04 JULHO 2026', seconds: 184 },
        ] },
        // AS DATAS DESTE STUB SÃO PASSADAS de propósito: o Informativo esconde o
        // que ainda não saiu (v5.255), e um episódio de outubro seria invisível
        // em agosto — o caso do CORTE tem clock fixo, mais abaixo, e não pode
        // contaminar as asserções de ordem e rótulo daqui. A playlist continua
        // sendo a do 4º trimestre: quem dá o mês do item é a data do TÍTULO.
        'd/pt4': { name: 'Informativo | 4º Trimestre 2026', author: 'Daniel Gonçalves', items: [
          { id: 'bbbbbbbbbb4', url: 'd/4', name: 'Informativo Mundial das Missões | 07 FEVEREIRO 2026', seconds: 170 },
          // SEM DATA no título: ele ENTRA (regra de ouro) e o Registro tem de
          // NOMEÁ-LO — é o achado que a v5.230 custou uma versão para
          // descobrir, e é dele que sai o próximo ajuste da leitura de data.
          { id: 'bbbbbbbbbb5', url: 'd/5', name: 'Informativo Mundial das Missões | especial de encerramento', seconds: 200 },
        ] },
      };
      setTimeout(() => {
        try { window.__avResolve(id, porUrl[url] || null); } catch (_) {}
      }, 0);
    },
  };
  // A ÁREA DE TRANSFERÊNCIA (shell 48). O stub reproduz o GATE, que é o recurso:
  // ele só devolve conteúdo com carimbo MAIOR que o \`desde\` recebido — é assim
  // que o shell evita o aviso do Android 12+ a cada retomada. Um stub que
  // devolvesse sempre o mesmo objeto provaria o percurso e deixaria passar
  // justamente a metade que custa caro no aparelho.
  B.areaTransferencia = (id, desde) => {
    const c = window.__clip;
    const de = Number(desde) || 0;
    const r = (c && c.carimbo > de) ? { texto: c.texto, carimbo: c.carimbo } : null;
    window.__clipLeituras = (window.__clipLeituras || 0) + (r ? 1 : 0);
    setTimeout(() => { try { window.__avResolve(id, r); } catch (_) {} }, 0);
    return undefined;
  };
  // A PROTEÇÃO DA PREVIEW (shell 56). O stub GRAVA, porque o que se mede aqui é
  // o que o app DIZ ao shell — o efeito (um WebView que não é suspenso) não
  // existe num navegador, e afirmar o efeito seria afirmar o arnês.
  window.__projLocal = [];
  B.projecaoLocal = (on) => { window.__projLocal.push(!!on); };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','castTarget',
    'deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply',
    'otaCheck','otaDiag','otaPending','pickDoc','pickFolder','requestMic','systemVolume',
    'temaClaro','ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte',
    'ytFetchAudio','ytPlaylist','ytSearch','ytStream','farolEstado'];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      if (!comCallId.has(n)) return undefined;
      // O primeiro argumento é o \`callId\` nas chamadas com Promise.
      const id = args[0];
      if (typeof id === 'string') {
        const v = Object.prototype.hasOwnProperty.call(vazio, n) ? vazio[n] : null;
        setTimeout(() => { try { window.__avResolve(id, v); } catch (_) {} }, 0);
      }
      return undefined;
    };
  }
  // O CANAL DE MÍDIA da tela (o shell o injeta quando a transmissão sobe): é a
  // única condição de que o reenvio de preferências depende de verdade.
  window.__avTelaMidia = { postMessage: () => {} };
  window.__AVBridge = B;
})();`;

// O DESLIGADO é o estado de partida; o segundo cenário é o do OPERADOR.
const PONTE = ponteCom({ ligado: false, telas: [] }, []);

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = `http://localhost:${porta}`;

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;
pg.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
  erros.push(t);
});
pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });

  checar(await pg.evaluate(() => window.__NATIVE__ === true),
    'a base entra em MODO APP (a ponte foi vista)');
  checar(await pg.evaluate(() => (window.__SHELL_VERSION__ | 0) >= 46),
    'e enxerga o shell MÍNIMO — é este ramo que o navegador nunca executa');

  // A MESMA PERGUNTA DO WATCHDOG. `otaAppIsUp` é o que decide, no aparelho, se
  // um bundle baixado é carimbado como bom ou descartado no lançamento
  // seguinte: papel `controle`, os três módulos compartilhados, o `__avBack` do
  // fim do `controle.js` e um `<li>` na playlist (que só existe depois de o
  // `init()` assíncrono terminar). Reusá-la é não inventar um segundo critério
  // que envelheceria à parte do primeiro.
  let deuPe = false;
  try {
    await pg.waitForFunction(
      () => window.AVDB && window.AVStream && window.createStage
        && typeof window.__avBack === 'function'
        && !!document.querySelector('#playlist li'),
      null, { timeout: 25000 },
    );
    deuPe = true;
  } catch (_) { deuPe = false; }
  checar(deuPe, 'O APP FICOU DE PÉ com a ponte presente (o critério do watchdog do OTA)');

  // ===== A BIBLIOTECA COM A SEÇÃO DOS FAVORITOS ABERTA =====
  // Desde a v1.1.4 a Biblioteca abre TODA FECHADA (`resetarBiblioteca`), e uma
  // seção fechada **não constrói corpo** — `[data-fav-corpo]` simplesmente não
  // existe. Os casos abaixo que falam da seção (a pasta do aparelho, a gaveta de
  // um favorito, o par ↑↓) precisam dela ABERTA, e abri-la é montar o CENÁRIO
  // deles, não medir o padrão: o padrão tem caso próprio, lido verbatim do
  // estado que o módulo carrega.
  //
  // Idempotente de propósito: alguns blocos herdam a Biblioteca já aberta do
  // anterior, e reabri-la ali passaria pelo `closeHymnSearch` de quem fechou,
  // que agora zera o estado.
  await instalarCenarioFav(pg);

  // A VARREDURA DA ABERTURA ASSENTA ANTES DO PRIMEIRO BLOCO DAS SÉRIES: daqui
  // para baixo nada mais compete com ela pelo diário. Ver `esperarVarredura`.
  await esperarVarredura(pg);

  // ── A SÉRIE (v5.228) ───────────────────────────────────────────────────
  // O card só existe com a ponte E com shell >= 41, então este é o ÚNICO teste
  // que pode exercitá-lo — no `smoke.mjs` a série nem chega a ser construída.
  // E o que se afirma aqui é o percurso INTEIRO, do canal até a lista: a regra
  // pura já tem oráculo próprio (`serie.test.mjs`), o que faltava era provar
  // que ela está de fato LIGADA ao provedor de coleção.
  const serie = await pg.evaluate(async () => {
    const c = allCollections().find((x) => x.kind === 'serie');
    if (!c) return { achou: false };
    await fetchCollectionIndex(c);
    const st = collState[c.id];
    return {
      achou: true,
      nome: c.name,
      itens: collSongs(c.id).map((s) => s.name),
      urls: collSongs(c.id).map((s) => s.ytUrl),
      semPlayback: collSongs(c.id).every((s) => s.has_instrumental_music === false),
      assinatura: !!(st && st.serieAssinatura),
    };
  });
  checar(serie.achou, 'com shell 41 o card da SÉRIE existe na Biblioteca');
  checar(serie.nome === 'Provai e Vede 2026', 'e ele se chama "Provai e Vede 2026"', serie.nome);
  checar(serie.itens && serie.itens.length === 3,
    'as 2 playlists em português viram 3 episódios (a de Libras e a outra série ficam fora)',
    JSON.stringify(serie.itens));
  checar(!(serie.itens || []).some((n) => /libras/i.test(n)),
    'NENHUM episódio em Libras entrou — o par dobraria o álbum na projeção');
  checar((serie.itens || []).join(' | ')
      === '25/Jul · Chamado em Silêncio | 01/Ago · Match point | 08/Ago · Cada centavo conta',
    'a lista vem em ordem CRONOLÓGICA e rotulada pela data, que é como se procura o sábado',
    JSON.stringify(serie.itens));
  checar((serie.urls || []).join(',') === 'y/4,y/1,y/3',
    'cada episódio carrega a URL do vídeo — é ela que o download vai buscar', JSON.stringify(serie.urls));
  checar(serie.semPlayback,
    'nenhum episódio pede PLAYBACK: um vídeo não tem, e o álbum nunca ficaria completo');
  checar(serie.assinatura,
    'a assinatura das playlists é guardada — sem ela, toda retomada custa 12 extrações');

  // A ARMADILHA 1 pelo caminho de ponta a ponta: a playlist de agosto do stub
  // é "Provai e Vede Agosto 2026", SEM o hífen que todas as outras têm. Se a
  // regra exigisse o separador, os dois episódios de agosto sumiriam — e a
  // asserção de cima já reprovaria, mas sem dizer POR QUÊ.
  checar((serie.itens || []).filter((n) => /Ago/.test(n)).length === 2,
    'a playlist SEM hífen entrou: os dois episódios de agosto estão na lista',
    JSON.stringify(serie.itens));

  // ── A SEGUNDA SÉRIE (v5.244): o Informativo Mundial das Missões ─────────
  // Ela existe para provar que o catálogo é catálogo — e o que ela de fato
  // prova é que três suposições do Provai e Vede eram suposições: a playlist é
  // do TRIMESTRE, o título não traz nome de episódio, e o canal publica a mesma
  // série em quatro idiomas. A regra pura tem oráculo próprio
  // (`serie.test.mjs`); o que só pode ser afirmado AQUI é que as duas séries
  // convivem no mesmo provedor de coleção — cada uma indo ao SEU canal.
  const info = await pg.evaluate(async () => {
    const c = allCollections().find((x) => x.id === 'serie-informativo-missoes-2026');
    if (!c) return { achou: false };
    await fetchCollectionIndex(c);
    return {
      achou: true,
      nome: c.name,
      itens: collSongs(c.id).map((s) => s.name),
      urls: collSongs(c.id).map((s) => s.ytUrl),
      // As duas séries têm de ter índices INDEPENDENTES: um card sobrescrever o
      // outro no `collState` é o modo de falhar deste lote, e ele seria mudo.
      outra: collSongs('serie-provai-vede-2026').length,
    };
  });
  checar(info.achou, 'o card da SEGUNDA série existe na Biblioteca');
  checar(info.nome === 'Informativo Mundial das Missões 2026',
    'e ele se chama "Informativo Mundial das Missões 2026"', info.nome);
  // v5.271: o rótulo passou a levar a SÉRIE junto da data. Dentro do álbum isso
  // é repetição — e foi por isso que a v5.244 escolheu só a data —, mas o item
  // SAI do álbum: no Cronograma e nos Favoritos ele perde o cabeçalho que dizia
  // qual série é, e "15/Ago · YouTube" não identifica nada. O caso mede a ordem
  // (que não mudou) e a identificação (que é o pedido).
  checar((info.itens || []).slice(0, 3).join(' ~ ')
    === '07/Fev · Informativo Mundial das Missões ~ 04/Jul · Informativo Mundial das Missões'
      + ' ~ 15/Ago · Informativo Mundial das Missões',
    'os episódios vêm em ordem CRONOLÓGICA e cada um DIZ de que série é — a data '
    + 'ordena, a série identifica quando o item sai do álbum', JSON.stringify(info.itens));
  checar((info.itens || [])[3] === 'Informativo Mundial das Missões',
    'o que não declarou data ENTRA, com o nome da série e no fim do trimestre '
    + 'dele — nunca uma linha em branco', JSON.stringify(info.itens));
  checar((info.urls || []).join(',') === 'd/4,d/3,d/1,d/5',
    'cada um carrega a URL do vídeo, que é o que a transmissão vai buscar', JSON.stringify(info.urls));
  checar(!(info.urls || []).includes('d/2'),
    'O VÍDEO EM ESPANHOL NÃO ENTROU — ele estava DENTRO da playlist de português, '
    + 'com o mesmo prefixo no título, e iria ao telão sem nada que o denunciasse');
  checar(info.itens && info.itens.length === 4,
    'as 2 playlists em português dos 5 idiomas do canal viram 4 episódios', JSON.stringify(info.itens));
  checar(info.outra === 3,
    'e o índice da PRIMEIRA série continua de pé: os dois cards não se sobrescrevem', info.outra);

  // ── O REGISTRO DAS SÉRIES (v5.249) ─────────────────────────────────────
  // Pedido do operador: depois de verificar os dois grupos, registrar nomes,
  // achados e dados resultantes — para ele repassar e eu ajustar os filtros.
  //
  // É o único artefato deste recurso cujo consumidor não está no aparelho, e o
  // modo de falhar dele é o do `registro.test.mjs`: ele não quebra, ele
  // CONTINUA RESPONDENDO com uma frase errada — ou muda, que é pior, porque
  // "não achei nada no Registro" se lê como "não há nada de errado". Nenhum
  // teste carregava este texto até aqui.
  const reg = await pg.evaluate(async () => {
    await renderDiag();
    return diagTexto;
  });
  const temLinha = (re) => re.test(reg);
  checar(/Séries do YouTube \(o que a regra achou\)/.test(reg),
    'O REGISTRO GANHOU O BLOCO DAS SÉRIES');
  checar(/Provai e Vede 2026 — https:\/\/www\.youtube\.com\/@provaievedeoficial/.test(reg)
    && /Informativo Mundial das Missões 2026 — https:\/\/www\.youtube\.com\/@daniellocutor/.test(reg),
    'e ele fala dos DOIS grupos, cada um com o canal de onde veio');
  checar(/playlists por mês/.test(reg) && /playlists por trimestre/.test(reg),
    'com os PARÂMETROS de cada série (é neles que o ajuste é feito)');

  // AS RECUSAS, AGRUPADAS POR MOTIVO (v1.1.19) — e o nome cru dos primeiros de
  // cada grupo. O contrato ANTERIOR era "cada recusa com o nome verbatim", e ele
  // custou o Registro inteiro: num aparelho de verdade este bloco ocupou ~140 de
  // ~170 linhas, com "não começa com Informativo" repetido sessenta vezes,
  // enterrando a linha do tempo — o único bloco que responde "o que aconteceu no
  // culto?".
  //
  // O QUE A TROCA NÃO PODE PERDER, e é o que estas asserções cobram: a CONTAGEM
  // por motivo (para o corte não ser silencioso) e ao menos um nome CRU por
  // grupo — é lendo o nome que se descobre uma renomeação em massa, e é para
  // isso que o bloco existe.
  checar(/- \d+× é a versão em Libras/.test(reg)
    && /"Provai e Vede - Agosto 2026 \(Libras\)"/.test(reg),
    'as recusas saem CONTADAS por motivo, com o nome cru dos primeiros de cada grupo');
  checar(/- \d+× não começa com "Provai e Vede"/.test(reg),
    'e o motivo cita a série: "não começa com X" diz o que fazer, "prefixo" não');
  checar(/"Misiones \| 3º Trimestre 2026"/.test(reg)
    && /"【聖工消息】2026 第三季 \(3 Quarter 26\)"/.test(reg),
    'as playlists dos outros idiomas continuam NOMEADAS — é o nome que denuncia a renomeação');
  checar(temLinha(/\+ "Informativo \| 3º Trimestre 2026" → mês 7/),
    'e as ACEITAS seguem uma por linha, nominais: são poucas e são o que prova que a regra achou');

  // O vídeo em espanhol: a recusa que o prefixo NÃO faz, e a que só o Registro
  // torna visível (ele some da lista sem deixar rastro em lugar nenhum).
  checar(/- \d+× está em outro idioma/.test(reg)
    && /"Informativo Mundial de las Misiones \| 15 AGOSTO 2026"/.test(reg),
    'O VÍDEO EM ESPANHOL continua nomeado no registro, com o motivo');
  checar(temLinha(/! 1 entrou\(entraram\) SEM data no título:/)
    && temLinha(/"Informativo Mundial das Missões \| especial de encerramento"/),
    'e o episódio SEM DATA é nomeado como ACHADO — ele entrou, e é dele que sai o próximo ajuste');

  // OS NOMES VIRARAM AS BORDAS. A lista existia para conferir a ORDEM, e ordem
  // se confere nas pontas: cinquenta e duas linhas para conferir duas é o que
  // enterrava o resto. O defeito do MEIO tem sinal próprio — o `! entrou SEM
  // data`, afirmado logo acima e ainda nominal.
  // AFIRMA A FORMA, não um nome: as DUAS séries têm de produzir a linha, com a
  // contagem e as duas pontas entre aspas. Cravar um nome aqui mediria a
  // fixture, e a próxima entrada verbatim do canal quebraria o oráculo sem que
  // nada no app tivesse mudado.
  const bordas = reg.match(/^\s*\d+ na lista, de "[^"]+" a "[^"]+"$/gm) || [];
  checar(bordas.length === 2,
    'os NOMES viram as BORDAS nas duas séries: a contagem e as duas pontas, que é onde a '
    + 'ordem se confere', JSON.stringify(bordas));
  checar(!/na ordem em que a lista mostra/.test(reg),
    'e a listagem nominal completa NÃO volta — era ela que enterrava a linha do tempo');
  checar(/aba do canal \(há \d+ s\)/.test(reg) && /vídeos \(varredura há \d+ s\)/.test(reg),
    'as DUAS metades trazem a própria data — a assinatura pula a extração e só uma delas é de agora');
  checar(!/undefined|NaN|\[object Object\]/.test(reg),
    'e nada de "undefined" no meio de um log que vai ser repassado');

  // ── O RECORTE POR ANO (v5.252) ─────────────────────────────────────────
  // O primeiro registro de verdade veio com 94 e 145 playlists: os canais
  // publicam há anos, e o arquivo enterrava as aceitas sob oitenta linhas
  // dizendo "não é de 2026". As duas metades são inseparáveis — o que some é
  // só o que traz OUTRO ano no nome, e um mês do ano corrente renomeado (o
  // defeito que este bloco existe para achar) continua aparecendo.
  checar(!/"Provai e Vede - Dezembro 2025"/.test(reg)
    && !/"Provai e Vede - Novembro 2025 \(Libras\)"/.test(reg),
    'as playlists de OUTROS ANOS saem da lista — elas não mudam e não decidem nada');
  checar(/\(mais 2 de outros anos: /.test(reg),
    'mas são CONTADAS, por motivo: nenhum corte silencioso', (reg.match(/\(mais [^\n]*/) || [])[0]);
  checar(/"Semana de Mordomia Cristã 2026"/.test(reg),
    'e o que é do ANO CORRENTE fica NOMEADO, mesmo recusado — é ali que uma renomeação apareceria');

  // ── O QUE O CANAL ANUNCIA E A EXTRAÇÃO NÃO TRAZ (v5.252) ───────────────
  // No registro real: 39 anunciados × 38 vistos numa série, 51 × 50 na outra.
  // Nada erra, nada recusa — o vídeo não vem, e o sábado dele não existe na
  // lista. É o achado mais silencioso deste caminho, e a soma das contagens da
  // aba do canal é a única referência externa que ele tem.
  checar(/de \d+ anunciados pelo canal/.test(reg),
    'a linha dos vídeos compara o que veio com o que o canal ANUNCIA',
    (reg.match(/vídeos \(varredura[^\n]*/) || [])[0]);
  checar(temLinha(/! \d+ vídeo\(s\) que o canal conta e a extração NÃO trouxe/),
    'e a diferença vira uma linha própria, não uma conta para quem lê fazer');

  // ── O QUE AINDA NÃO SAIU NÃO CHEGA À LISTA (v5.255) ────────────────────
  // Relato do operador: o canal sobe o trimestre inteiro e libera um sábado por
  // vez; os que faltam ficam como "prioridade para membros" — aparecem na
  // playlist e não tocam. A REGRA tem oráculo próprio (`serie.test.mjs`, com
  // datas fixas); o que só pode ser afirmado AQUI é que ela está LIGADA ao
  // provedor de coleção, isto é, que o `fetchSerieIndex` de fato passa o dia.
  //
  // Página à parte, com RELÓGIO FIXO: sem isso a asserção mudaria de resposta
  // conforme o dia em que rodasse — e um teste que muda sozinho é o que ensina
  // a ignorar vermelho (v5.204). O clock fica preso a esta página para não
  // contaminar nada do que já foi medido acima.
  const corte = await (async () => {
    // CONTEXTO PRÓPRIO, e não `ctx.newPage()` (v1.1.21). MEDIDO: o
    // `clock.setFixedTime` de uma página feita neste contexto CONGELA O
    // CONTEXTO INTEIRO — a página principal continuava rodando, e o relógio
    // dela ficava preso em 15/Ago/2026 de aqui até o fim do arquivo. Nada
    // reprovava: as asserções seguintes ou não olhavam o relógio, ou olhavam
    // duas vezes o mesmo relógio de mentira e concordavam consigo mesmas. Foi o
    // caso do destaque do sábado que topou nisso — ele lê a data e escreve o
    // rótulo, então uma data congelada aparece na tela.
    const ctxC = await navegador.newContext({ viewport: { width: 430, height: 900 } });
    await semRedeExterna(ctxC);
    const pgC = await ctxC.newPage();
    try {
      // DOMINGO 26/JUL/2026, e a data responde a DUAS exigências de uma vez.
      //
      // ANTES do sábado de 15/Ago, que é um episódio que o stub JÁ tem — assim
      // o caso não precisa de um episódio futuro no stub, que ficaria no
      // passado com o tempo e mudaria as asserções da página principal.
      //
      // E DEPOIS de 25/Jul, o primeiro episódio do Provai e Vede (v1.4.15). Ela
      // era 10/Jul, de quando aquela série MOSTRAVA o que ainda não saiu; hoje
      // ela esconde, e em 10/Jul os três episódios do stub estão no futuro — a
      // lista nasce VAZIA e a `esperarVarredura` acima não volta nunca. As datas
      // do stub passaram a sustentar peso: em 26/Jul as duas séries têm conteúdo
      // E o corte do Provai e Vede está à vista (25/Jul e 01/Ago dentro — este é
      // o sábado DESTA semana —, 08/Ago fora).
      await pgC.clock.install({ time: new Date('2026-07-26T12:00:00') });
      await pgC.addInitScript(PONTE);
      await pgC.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
      await pgC.waitForFunction(() => !!window.__avBack, null, { timeout: 25000 });
      // A MESMA espera da página principal, e pelo mesmo motivo: o `ler(true)`
      // abaixo refaz o índice, e a varredura da abertura desta página estaria
      // gravando o diário da mesma série ao lado dele.
      await esperarVarredura(pgC);
      // `limpar` só na PRIMEIRA leitura. A segunda roda com o índice de ontem
      // guardado, que é o caminho da ECONOMIA (a assinatura das playlists) — e é
      // ali que o defeito moraria: o canal não muda de um dia para o outro,
      // então sem o DIA dentro da assinatura a economia devolveria a lista de
      // ontem, sem o episódio de hoje, e carimbaria que ela é de hoje. É o
      // sintoma da v5.233 por outra porta, e apagar o índice aqui esconderia
      // exatamente isso.
      //
      // POR ID desde a v1.4.15: o Provai e Vede passou a esconder o que o canal
      // ainda não liberou, e até aqui este bloco media só o Informativo. Um
      // segundo leitor escrito à parte divergiria do primeiro no primeiro ajuste
      // — é a razão do `mesDaPlaylist`, aplicada ao arnês.
      const ler = async (id, limpar) => pgC.evaluate(async ([cid, zerar]) => {
        const c = allCollections().find((x) => x.id === cid);
        if (zerar) delete collState[c.id];
        await fetchCollectionIndex(c);
        const d = await AVDB.getState('serieDiag:' + c.id);
        return { itens: collSongs(c.id).map((s) => s.name), futuros: (d && d.futuros || []).length };
      }, [id, limpar]);
      const INFO = 'serie-informativo-missoes-2026';
      const PV = 'serie-provai-vede-2026';
      const antes = await ler(INFO, true);
      // O REGISTRO NO DIA CONGELADO (v1.4.16). A linha dos retidos só existe
      // quando há retidos, e no relógio real do runner as datas do stub já são
      // todas passado — lê-la na página principal seria medir o calendário do
      // runner, não o app. Aqui o corte está ativo por construção.
      const regCorte = await pgC.evaluate(async () => {
        await renderDiag();
        return diagTexto;
      });
      // O PROVAI E VEDE NO MESMO DIA (v1.4.15). A regra pura tem oráculo próprio;
      // o que só pode ser afirmado AQUI é que o `futuros` do catálogo daquela
      // série chega ao provedor de coleção — o mesmo que a v5.255 afirmou para o
      // Informativo, e que ninguém tinha afirmado para esta.
      const pvAntes = await ler(PV, true);
      // A FRONTEIRA, medida no percurso inteiro e não só na regra pura. Ela é a
      // VIRADA DA SEMANA: o sábado 08 ainda é a semana anterior, o domingo 09
      // abre a do episódio de 15/Ago. A terça e a quarta ficam porque eram a
      // fronteira de uma régua ANTERIOR (a contagem de 3 dias da v5.256, que a
      // v1.2.19 substituiu e a v1.4.16 removeu) — hoje as duas respondem "está
      // lá" pela SEMANA, e é essa mudança de veredito que o relato do operador
      // comprou: num domingo a lista escondia o episódio que o destaque do topo
      // declarava o desta semana.
      await pgC.clock.setFixedTime(new Date('2026-08-08T12:00:00'));
      const sabadoAntes = await ler(INFO, false);
      await pgC.clock.setFixedTime(new Date('2026-08-09T12:00:00'));
      const noDomingo = await ler(INFO, false);
      await pgC.clock.setFixedTime(new Date('2026-08-11T12:00:00'));
      const naTerca = await ler(INFO, false);
      await pgC.clock.setFixedTime(new Date('2026-08-12T12:00:00'));
      const naQuarta = await ler(INFO, false);
      // O PRÓPRIO SÁBADO do episódio: ele passa a existir, sozinho e sem toque
      // nenhum. É o corte INCLUSIVO, que é o que o operador descreveu.
      await pgC.clock.setFixedTime(new Date('2026-08-15T12:00:00'));
      const noDia = await ler(INFO, false);
      // E O PROVAI E VEDE DEPOIS DA VIRADA: em 15/Ago o episódio de 08/Ago já é
      // passado e volta à lista. Sem esta segunda leitura a primeira provaria só
      // que a lista é curta — e uma lista que nunca cresce é o defeito, não o
      // recurso.
      const pvNoDia = await ler(PV, false);

      // ===== A PROCURA DO EPISÓDIO DESTA SEMANA (v1.2.22) =====
      //
      // O relógio está preso em 15/Ago (sábado), e o índice acabou de ser
      // varrido — as três respostas abaixo saem SÓ da regra nova: o TTL de 12 h
      // está fresco, o dia é o mesmo, e o diário está carimbado.
      const procura = await pgC.evaluate(() => {
        const agora = Date.now();
        const info = allCollections().find((x) => x.id === 'serie-informativo-missoes-2026');
        const st = collState[info.id];
        // Um índice de meia hora atrás: dentro do TTL, fora do PISO. É a única
        // janela em que a regra nova é a que responde.
        st.indexSyncedAt = agora - 31 * 60 * 1000;
        st.serieDiaEm = serieDiaLocal(new Date(agora));
        st.serieDiarioEm = agora;
        const com = indiceVencido(info, agora);
        // Tirar o episódio da semana do índice é o cenário que a regra existe
        // para pegar: o canal ainda não publicou (ou publicou depois da última
        // varredura), e o operador abre o app justamente para saber disso.
        const guardadas = st.songs.slice();
        st.songs = st.songs.filter(
          (x) => !AVSerie.ehDoSabadoAtual(x.serieData, info.serie, new Date(agora)));
        const removidas = guardadas.length - st.songs.length;
        const sem = indiceVencido(info, agora);
        // O PISO: recém-varrido, não procura de novo. Sem ele a pergunta seria
        // feita a cada `visibilitychange` — uma extração do canal por volta ao
        // app, durante o culto inteiro.
        st.indexSyncedAt = agora;
        const semRecemVarrido = indiceVencido(info, agora);
        // E A ABERTURA, que é o pedido ao pé da letra: a PRIMEIRA passada da
        // sessão pergunta mesmo com o índice recém-varrido. O `autoRefresh` da
        // carga desta página já a desarmou, então o caso é rearmá-la — que é o
        // que uma reabertura do app faz.
        st.songs = st.songs.filter(
          (x) => !AVSerie.ehDoSabadoAtual(x.serieData, info.serie, new Date(agora)));
        serieProcuraDaAbertura = true;
        const naAbertura = indiceVencido(info, agora);
        serieProcuraDaAbertura = false;
        st.songs = guardadas;
        st.indexSyncedAt = agora;

        // E O PROVAI E VEDE: em 15/Ago o stub dela tem 25/Jul, 01 e 08/Ago, e
        // nenhum é desta semana (dom 09 a sáb 15). É o caso que a procura existe
        // para resgatar, e a v1.4.15 não o desfez — esconder o que ainda não saiu
        // não publica o episódio que o canal não publicou.
        const pv = allCollections().find((x) => x.id === 'serie-provai-vede-2026');
        const stPv = collState[pv.id] || {};
        const pvTem = (stPv.songs || []).length
          ? serieTemODaSemana(pv, agora) : null;
        return { com, sem, semRecemVarrido, naAbertura, removidas, pvTem };
      });

      // SÓ A DATA entra na comparação (v5.271): estes casos falam da JANELA, e
      // comparar o nome inteiro os faria reprovar a cada ajuste de nomenclatura
      // — foi o que aconteceu quando o rótulo passou a levar a série junto.
      const soData = (o) => Object.assign({}, o,
        { itens: (o.itens || []).map((n) => String(n).split(' · ')[0]) });
      return { antes: soData(antes), sabadoAntes: soData(sabadoAntes),
        noDomingo: soData(noDomingo), naTerca: soData(naTerca),
        naQuarta: soData(naQuarta), noDia: soData(noDia),
        pvAntes: soData(pvAntes), pvNoDia: soData(pvNoDia), procura,
        // Só as linhas dos retidos: o Registro inteiro atravessando o `evaluate`
        // são dezenas de kB que nenhuma asserção daqui olha.
        retidos: (regCorte.match(/^.*ainda não liberado.*$/gm) || []) };
    } finally { await pgC.close(); await ctxC.close(); }
  })();
  checar(!(corte.antes.itens || []).includes('15/Ago'),
    'EM 26/JUL o episódio de 15/Ago NÃO chega à lista — ele ainda não foi liberado',
    JSON.stringify(corte.antes.itens));
  checar((corte.antes.itens || []).includes('04/Jul'),
    'e os que já saíram continuam lá — o corte é uma data, não um apagador',
    JSON.stringify(corte.antes.itens));
  checar(corte.antes.futuros > 0,
    'o diário CONTA os que ficaram de fora, para o Registro poder dizê-lo', corte.antes.futuros);
  checar((corte.noDia.itens || []).includes('15/Ago'),
    'E NO PRÓPRIO SÁBADO ele aparece sozinho: o corte é inclusive no dia do culto',
    JSON.stringify(corte.noDia.itens));
  checar((corte.naQuarta.itens || []).includes('15/Ago'),
    'E JÁ NA QUARTA ANTES DELE, que é quando o roteiro do culto é montado',
    JSON.stringify(corte.naQuarta.itens));
  checar((corte.naTerca.itens || []).includes('15/Ago'),
    'E NA TERÇA também — a janela é a SEMANA dele, e a terça já é dela',
    JSON.stringify(corte.naTerca.itens));
  // A METADE QUE FECHA, e sem ela as três acima aprovariam uma janela infinita:
  // no SÁBADO 08 o episódio de 15/Ago é da semana SEGUINTE e não aparece; no
  // domingo 09, a semana dele começou. É a virada, medida na tela.
  checar(!(corte.sabadoAntes.itens || []).includes('15/Ago'),
    'NO SÁBADO ANTERIOR ele ainda NÃO está na lista — é a semana que vem',
    JSON.stringify(corte.sabadoAntes.itens));
  checar((corte.noDomingo.itens || []).includes('15/Ago'),
    '[relato] e no DOMINGO seguinte ele entra: a semana dele começou',
    JSON.stringify(corte.noDomingo.itens));

  // ── E O MESMO CORTE NO PROVAI E VEDE (v1.4.15) ────────────────────────────
  //
  // Relato do operador: *"ajuste para que tenha o mesmo filtro e organização do
  // informativo mundial das missões. no caso a lista só vai até o sábado da
  // semana atual."* O canal libera um episódio por semana, e a lista mostrava
  // até o fim do mês — um deles falhou em cena com `ContentNotAvailable`.
  //
  // A regra é a MESMA do Informativo e tem oráculo próprio; o que só pode ser
  // afirmado aqui é a LIGAÇÃO, e ela falharia calada: o campo `futuros` mora no
  // catálogo, e um catálogo que o web nunca consultasse devolveria a lista
  // inteira sem erro em lugar nenhum.
  checar(!(corte.pvAntes.itens || []).includes('08/Ago'),
    'EM 26/JUL o episódio de 08/Ago do PROVAI E VEDE fica de fora — o canal ainda não o liberou',
    JSON.stringify(corte.pvAntes.itens));
  checar((corte.pvAntes.itens || []).includes('01/Ago'),
    'e o sábado DESTA semana continua na lista, mesmo faltando seis dias: a janela é a semana, não a contagem',
    JSON.stringify(corte.pvAntes.itens));
  checar((corte.pvAntes.itens || []).includes('25/Jul'),
    'e o que já saiu segue lá — aqui também o corte é uma data, não um apagador',
    JSON.stringify(corte.pvAntes.itens));
  // A METADE QUE FECHA: sem ela as três acima aprovariam uma lista que só
  // encolhe. Em 15/Ago o 08/Ago já é passado, e ele TEM de voltar.
  checar((corte.pvNoDia.itens || []).includes('08/Ago'),
    'E PASSADO O SÁBADO DELE o episódio volta à lista do Provai e Vede',
    JSON.stringify(corte.pvNoDia.itens));

  // ── E O REGISTRO DIZ A DATA DE CORTE, não um número de dias (v1.4.16) ─────
  //
  // Esta linha anunciava *"a lista alcança 3 dia(s) além de <dia>"*, e aqueles
  // três dias eram o piso que a v1.4.16 removeu — MEDIDO, ele nunca decidiu
  // nada para um episódio de sábado. O Registro é lido A DISTÂNCIA, por quem não
  // tem como conferir: uma linha que descreve um corte que o app não aplica é o
  // modo de falhar do `registro.test.mjs` — não quebra, CONTINUA RESPONDENDO
  // com a frase errada.
  //
  // Ela é lida no dia CONGELADO de propósito: no relógio do runner as datas do
  // stub já são passado, não há retido nenhum, e a linha simplesmente não sai —
  // uma asserção na página principal mediria o calendário.
  checar(corte.retidos.length >= 1,
    'com o corte ativo o Registro traz a linha dos episódios retidos',
    JSON.stringify(corte.retidos));
  checar(corte.retidos.every((l) => /a lista vai até o sábado da semana da varredura \(\d\d\/\w+\)/.test(l)),
    'e ela nomeia a DATA DE CORTE — o sábado da semana da varredura, não um número de dias',
    JSON.stringify(corte.retidos));
  checar(!corte.retidos.some((l) => /alcança \d+ dia/.test(l)),
    'a frase do PISO não volta: ela descrevia um corte que o app não fazia',
    JSON.stringify(corte.retidos));

  // ── A PROCURA DO EPISÓDIO DESTA SEMANA (v1.2.22) ──────────────────────────
  //
  // Relato do operador: *"faça o provai e vede e o informativo das missões
  // serem atualizados, em especial buscando apenas o vídeo dessa semana, busca
  // de se atualizar diretamente quando o app é aberto"*.
  //
  // O TTL de 12 h responde "a lista envelheceu?"; a regra nova responde "já
  // saiu o vídeo deste sábado?". As TRÊS metades, porque cada uma sozinha
  // aprovaria um app errado: sem a primeira a regra vira "revarrer sempre"
  // (uma extração do canal por volta ao app); sem a segunda ela não procura
  // nada; sem o piso ela vira a rajada que o `autoRefreshCollections` recusa.
  checar(corte.procura.removidas === 1,
    'o cenário de fato tira UM episódio — o desta semana', corte.procura.removidas);
  checar(corte.procura.com === false,
    'COM o episódio da semana no índice, a série NÃO é revarrida — a procura se desarma sozinha',
    corte.procura.com);
  checar(corte.procura.sem === true,
    '[relato] FALTANDO o episódio desta semana, o índice vence — mesmo fresco pelo TTL e no mesmo dia',
    corte.procura.sem);
  checar(corte.procura.semRecemVarrido === false,
    'e o PISO segura: recém-varrido, não procura de novo (a rajada do visibilitychange)',
    corte.procura.semRecemVarrido);
  checar(corte.procura.naAbertura === true,
    '[relato] mas a ABERTURA do app pergunta assim mesmo — é o piso que vale para as voltas ao app, não para abrir',
    corte.procura.naAbertura);
  checar(corte.procura.pvTem === false,
    'e o PROVAI E VEDE é a série que a procura resgata: em 15/Ago ela não tem o '
    + 'episódio da semana — esconder o que ainda não saiu não publica o que o canal não publicou',
    corte.procura.pvTem);

  // ── O AVISO QUANDO O DOWNLOAD FALHA NA JANELA (v5.256) ─────────────────
  // O preço da antecedência: entre o domingo que abre a semana e o sábado do
  // episódio o vídeo pode ainda não estar público, e o download não vem. Sem uma frase, essa falha é indistinguível
  // de uma queda de rede — o operador tenta de novo, falha de novo, e conclui
  // que o app quebrou justamente no item que ele acabou de ver aparecer.
  //
  // E O RELÓGIO É FIXADO, como no bloco do corte acima. `serieComoYoutube`
  // chama `AVSerie.diasAte` SEM o terceiro argumento (o `hoje`), e o ano da
  // série é 2026 no catálogo: contra o relógio do runner, o "futuro" de 31/Dez
  // vale ZERO em 31/12/2026 e é PASSADO de 2027 em diante. Sem `dias > 0`,
  // `serieComoYoutube` não anexa nem `avisoSeFalhar` nem `avisoOnde`, então
  // as TRÊS asserções que leem `comFuturo` passariam a reprovar sozinhas, sem
  // ninguém ter mexido em nada — e sob portão isso fecharia o canal OTA no meio
  // das festas. (A quarta cobra a AUSÊNCIA da frase e continuaria passando, que
  // é justamente o que tornaria o diagnóstico confuso.)
  const aviso = await pg.evaluate(() => {
    const c = allCollections().find((x) => x.id === 'serie-informativo-missoes-2026');
    const songs = collSongs(c.id);
    // Fixado DENTRO da chamada, e não pela `clock` da página: aqui o percurso
    // já foi medido em volta, e congelar a página inteira mexeria nele. A troca
    // é síncrona do começo ao fim — nada roda entre ela e o `finally` —, então
    // nenhum outro caminho chega a ver o relógio de mentira.
    const Real = Date;
    const FIXO = Real.UTC(2026, 6, 26, 12);   // 26/Jul/2026, o mesmo dia do corte
    class Congelado extends Real {
      constructor(...a) { super(...(a.length ? a : [FIXO])); }
      static now() { return FIXO; }
    }
    window.Date = Congelado;
    try {
      // O que JÁ SAIU e um FUTURO, os dois contra o dia fixado acima: é o par
      // que prova que a frase é da janela, e não um recado grudado em toda
      // falha de série.
      const passado = Object.assign({}, songs[0], { serieData: { dia: 1, mes: 1 } });
      const futuro = Object.assign({}, songs[0], { serieData: { dia: 31, mes: 12 } });
      return {
        comFuturo: serieComoYoutube(c, futuro),
        comPassado: serieComoYoutube(c, passado),
        semData: serieComoYoutube(c, Object.assign({}, songs[0], { serieData: null })),
      };
    } finally { window.Date = Real; }
  });
  checar(/ainda não liberado pelo canal/.test(aviso.comFuturo.avisoSeFalhar || ''),
    'um episódio da JANELA carrega a frase que explica a falha', aviso.comFuturo.avisoSeFalhar);
  checar(/31\/Dez/.test(aviso.comFuturo.avisoSeFalhar || ''),
    'e ela diz ATÉ QUANDO esperar, com a data do episódio', aviso.comFuturo.avisoSeFalhar);
  checar(aviso.comFuturo.avisoOnde === 'serie-informativo-missoes-2026',
    'com o card da série como endereço: mandando ao Cronograma, a Biblioteca fica aberta por cima da preview');
  checar(!aviso.comPassado.avisoSeFalhar && !aviso.semData.avisoSeFalhar,
    'e um episódio que JÁ SAIU não a carrega — ali a falha é falha, e a frase seria uma desculpa falsa');

  // O DIÁRIO É O QUE VENCE O ÍNDICE (v5.249). Um aparelho que já tinha a lista
  // antes desta versão a tem "fresca" pelo TTL de 12 h — e passaria essas 12 h
  // com o bloco dizendo "ainda não varrido" justamente enquanto o operador o
  // procura, porque foi a atualização que o fez olhar. As duas metades: sem
  // carimbo a série entra na varredura, e COM carimbo ela para de entrar (senão
  // seriam extrações do YouTube a cada abertura, para sempre).
  const venc = await pg.evaluate(() => {
    // `indiceVencido` é a MESMA função que o `autoRefreshCollections` chama —
    // reescrevê-la aqui provaria só que o teste concorda consigo mesmo.
    const c = allCollections().find((x) => x.kind === 'serie');
    const st = collState[c.id];
    const agora = Date.now();
    st.indexSyncedAt = agora;               // fresco pelo TTL, que é o caso do relato
    const comCarimbo = !!st.serieDiarioEm && !indiceVencido(c, agora);
    delete st.serieDiarioEm;                // como o índice de quem já tinha a lista
    const semCarimbo = indiceVencido(c, agora);
    st.serieDiarioEm = agora;
    return { comCarimbo, semCarimbo, deNovo: indiceVencido(c, agora) };
  });
  checar(venc.comCarimbo, 'a varredura carimba o índice como "já registrado"');
  checar(venc.semCarimbo,
    'um índice ANTERIOR ao diário conta como vencido — senão o bloco ficaria 12 h mudo');
  checar(!venc.deNovo,
    'e com o carimbo ele para de vencer: nada de extrair o canal a cada abertura');

  // ── O CARD, DESENHADO (v5.229) ─────────────────────────────────────────
  // O relato do operador: "não estou achando nada para acessar esse provai e
  // vede". A v5.228 acrescentou a série ao `allCollections()`, que alimenta as
  // CONTAS — e a lista é desenhada em três grupos (fixas, categorias de álbum,
  // álbuns órfãos), nenhum dos quais a alcançava. O card era construído,
  // entrava no `byId`, contava no peso, e **não aparecia em lugar nenhum**.
  //
  // Todas as asserções acima passavam com esse defeito no lugar: elas mediam o
  // ÍNDICE, e o que faltava era o DESENHO. É por isso que este bloco pergunta
  // ao DOM, e não a uma função.
  // ===== OS DOIS BLOCOS ABAIXO MEDEM O MODO AVANÇADO (v1.0.7) =====
  // O padrão do app é o MODO FÁCIL (`storedAppMode`), e a seção de Favoritos
  // deixou de existir lá — a pedido do operador, porque aquele modo não tem aba
  // nem lista onde o que se GUARDA possa ser visto depois. Sem esta troca, tudo
  // o que estes blocos afirmam sobre os Favoritos passaria a medir o modo em que
  // eles não existem. A AUSÊNCIA tem caso próprio, logo adiante.
  //
  // FORA do `evaluate`, e não dentro: aqueles blocos leem o estado PADRÃO
  // verbatim (`favAberto`, `grupoAberto`) e montam árvores próprias — injetar
  // uma troca de modo no meio deles é mexer no cenário que eles existem para
  // medir.
  await pg.evaluate(() => { window.__modoBiblioteca = appMode; setAppMode('full'); });
  const naTela = await pg.evaluate(() => {
    const lista = document.getElementById('hymnResults');
    // OS GRUPOS NASCEM FECHADOS (v5.237): o índice é a primeira tela, e o card
    // de qualquer coleção só é CONSTRUÍDO quando o grupo dele abre. Este caso
    // fala do card, então ele abre o grupo primeiro — e o passo é, ele próprio,
    // a afirmação de que o grupo existe com esse nome.
    //
    // UMA PASSADA POR GRUPO desde a v5.273: só uma seção fica aberta por vez,
    // e este caso precisa dos cards de DUAS. Os NOMES dos grupos (e a ordem
    // deles) valem em qualquer passada — a barra é desenhada aberta ou fechada.
    //
    // A PERGUNTA MUDOU NA v1.0.1: antes era "em que GRUPO este card vive?", e
    // hoje é "ele vive FORA de qualquer grupo?". Os dois cabeçalhos fixos
    // ("Arquivos oficiais" e "Hinários") saíram, e as quatro coleções subiram
    // para a raiz — o toque que abria o grupo agora abre a LISTA de faixas.
    const naRaiz = (re) => {
      const card = [...lista.querySelectorAll('.hymnal-card')]
        .find((el) => re.test(el.textContent));
      if (!card) return 'AUSENTE';
      return card.closest('.coll-group') ? 'DENTRO DE UM GRUPO' : 'na raiz';
    };
    const guardado = grupoAberto;
    // `renderCollectionsList` ACRESCENTA à lista (a lição da v5.232): sem
    // limpar entre as passadas, a segunda mediria os cards da primeira.
    grupoAberto = '';
    lista.innerHTML = '';
    renderCollectionsList(lista, () => {}, { semTotal: true });
    const grupos = [...lista.querySelectorAll('.coll-group-name')].map((e) => e.textContent.trim());
    // A ORDEM DAS LINHAS DA RAIZ, com o tipo de cada uma: é aqui que se vê se
    // um card é filho do `<ul>` ou de um grupo.
    const linhas = [...lista.children].map((li) => (li.className.includes('coll-group')
      ? 'GRUPO: ' + li.textContent.trim().split('\n')[0]
      : 'card: ' + li.textContent.trim().split('\n')[0]));
    const texto = lista.textContent;
    const serie = naRaiz(/Provai e Vede 2026/);
    const informativo = naRaiz(/Informativo Mundial das Missões 2026/);
    const hinario2022 = naRaiz(/Hinário Adventista 2022/);
    const hinario1996 = naRaiz(/Hinário Adventista 1996/);
    grupoAberto = guardado;
    return {
      texto, grupos, linhas, serie, informativo, hinario2022, hinario1996,
      posSerie: linhas.findIndex((l) => l.includes('Provai e Vede 2026')),
    };
  });
  // E DEVOLVE O MODO. O modo é global: os casos abaixo medem o Modo Fácil
  // BLOQUEADO, e deixá-lo em avançado faria os dois falharem falando de outra
  // coisa. (Medido: foi exatamente isto que aconteceu na primeira tentativa.)
  await pg.evaluate(() => setAppMode(window.__modoBiblioteca || 'simple'));
  checar(/Provai e Vede 2026/.test(naTela.texto),
    'O CARD DA SÉRIE APARECE NA BIBLIOTECA — era este o "não estou achando nada"');

  // ── AS QUATRO COLEÇÕES FIXAS FICAM NA RAIZ (v1.0.1) ────────────────────
  // Pedido do operador: *"ou usa um ou usa o outro... o que obriga a abrir a
  // coleção apenas para o hinário novo. Portanto separe os dois e torne eles
  // diretamente cada qual uma coleção individual, abrindo diretamente sua lista
  // de itens, reduzindo um passo nos toques"*.
  //
  // TRÊS asserções, e nenhuma basta sozinha: tirar os cabeçalhos sem soltar os
  // cards passaria na terceira; soltar um par e esquecer o outro passaria na
  // primeira; e soltá-los na ordem errada passaria nas duas primeiras.
  checar(naTela.serie === 'na raiz' && naTela.informativo === 'na raiz'
    && naTela.hinario2022 === 'na raiz' && naTela.hinario1996 === 'na raiz',
    'as DUAS séries e os DOIS hinários são cards da RAIZ, sem grupo por cima',
    [naTela.serie, naTela.informativo, naTela.hinario2022, naTela.hinario1996].join(' / '));
  checar(!naTela.grupos.includes('Arquivos oficiais') && !naTela.grupos.includes('Hinários'),
    'e os dois cabeçalhos que os agrupavam deixaram de existir',
    JSON.stringify(naTela.grupos));
  // A ORDEM é a do uso: as séries são o material DATADO do sábado que vem; o
  // hinário é o acervo permanente. Medida, e não deduzida — ela só existe na
  // ordem de uma linha do `renderCollectionsListMiolo` e some se alguém a
  // reordenar sem querer.
  checar(/Favoritos/.test(naTela.linhas[0] || '')
    && /Provai e Vede 2026/.test(naTela.linhas[1] || '')
    && /Informativo Mundial/.test(naTela.linhas[2] || '')
    && /Hinário Adventista 2022/.test(naTela.linhas[3] || '')
    && /Hinário Adventista 1996/.test(naTela.linhas[4] || ''),
    'nesta ordem: Favoritos, as duas séries e os dois hinários, antes de qualquer álbum',
    JSON.stringify(naTela.linhas.slice(0, 6)));

  // ── O ÍNDICE NÃO PODE FICAR PRESO NUMA REGRA VELHA (v5.233) ────────────
  // Relato do operador, depois da v5.230: *"tentei limpar o cache e recarregar,
  // mas a listagem ainda mantém o item do provai e vede que não identificava o
  // 3 de janeiro"*. O índice guarda os nomes JÁ FORMADOS, e a assinatura que
  // pula a atualização fala só do que o CANAL publicou — mudar a regra não
  // mudava a assinatura, e o nome errado ficava para sempre (o índice mora no
  // IndexedDB, que limpar o cache não toca).
  //
  // As DUAS metades, e são inseparáveis: a regra nova refaz o índice, e o que
  // não mudou continua sem custar extração nenhuma. Sem a segunda, "refazer
  // sempre" passaria — e seriam doze idas ao YouTube por retomada do app.
  const preso = await pg.evaluate(async () => {
    const c = allCollections().find((x) => x.kind === 'serie');
    const st = collState[c.id];
    const antes = window.__nPlaylist || 0;
    // COMO O APARELHO DO OPERADOR ESTAVA, e a fidelidade aqui é o teste
    // inteiro: a assinatura guardada é a que a versão ANTERIOR escrevia —
    // só o canal, sem impressão nenhuma da regra —, e o canal não mudou uma
    // vírgula desde então. Escrever aqui uma assinatura inventada ("rVELHA…")
    // faria o caso passar nas DUAS versões, porque qualquer lixo difere do que
    // o código calcula: seria uma medição que não discrimina, e foi a primeira
    // versão deste caso.
    st.serieAssinatura = st.serieAssinatura.replace(/^r[0-9a-z]+\|/, '');
    st.songs[0].name = 'NOME DA REGRA VELHA';
    await AVDB.setState('coll:' + c.id, st);
    await syncCollection(c, { soIndice: true });
    const refeito = window.__nPlaylist || 0;
    const nomeDepois = collSongs(c.id)[0].name;
    // E agora, com tudo em dia: a economia tem de continuar de pé.
    //
    // A PAUSA ANTES DA LINHA DE BASE não é cerimônia: o `autoRefreshCollections`
    // da abertura roda SEM `await` e pode ter uma extração em voo, que cairia no
    // intervalo medido e seria lida como "a economia não valeu" — reprovado uma
    // vez em ~11 execuções, sem nenhuma relação com o que o caso afirma. Com o
    // laço assentado, o contador de partida é o de um sistema parado. E a
    // asserção continua discriminando: uma economia quebrada custaria a dúzia
    // de playlists da série, não uma unidade.
    await new Promise((r) => setTimeout(r, 400));
    const base = window.__nPlaylist || 0;
    await syncCollection(c, { soIndice: true });
    return { antes, refeito, base, deNovo: window.__nPlaylist || 0, nomeDepois };
  });
  checar(preso.refeito > preso.antes && !/REGRA VELHA/.test(preso.nomeDepois),
    'a regra nova REFAZ o índice guardado — era isto que deixava o episódio sem '
    + 'data e fora de ordem ("' + preso.nomeDepois + '")');
  checar(preso.deNovo === preso.base,
    'e com a regra e o canal em dia nada é reextraído: a economia continua de pé',
    preso.base + ' → ' + preso.deNovo);

  // ── O EPISÓDIO É UM VÍDEO DO YOUTUBE (v5.230) ──────────────────────────
  // Pedido do operador: as opções de um item da série devem ser as do YouTube
  // (sem "só áudio"), sem download direto, e com transmissão no "Tocar agora".
  // A v5.228 o tratava como faixa de hinário — o toque BAIXAVA ~300 MB.
  //
  // E DESDE A v5.285 ELA NÃO É MAIS UMA FOLHA: as opções abrem no CORPO da
  // linha. O caso passou a percorrer o caminho de verdade — desenhar a lista,
  // tocar na faixa, ler a gaveta — em vez de chamar a função do menu à mão: é a
  // única forma de continuar provando que um episódio recebe as opções do
  // YouTube, agora que quem decide isso é `montarOpcoes`.
  const folha = await pg.evaluate(async () => {
    const c = allCollections().find((x) => x.kind === 'serie');
    const s = collSongs(c.id)[0];
    // O modo é GLOBAL: deixá-lo trocado quebra os casos seguintes (o do Modo
    // Fácil mede a cortina). Restaurado no fim, como os outros casos fazem.
    const modoAntes = appMode;
    setAppMode('full');
    ui(c.id).expanded = true; ui(c.id).shown = 100;
    const lista = document.createElement('ul');
    lista.className = 'hymnal-list';
    lista.style.width = '390px';
    document.body.appendChild(lista);
    const li = hymnResultRow(c, s, null, true);
    lista.appendChild(li);
    li.querySelector('.row').click();
    await new Promise((r) => setTimeout(r, 400));
    const op = li.querySelector('.hymn-opcoes');
    const linhas = [...op.querySelectorAll('.song-menu-btn')]
      .map((b) => b.textContent.trim().split('\n')[0].trim()).filter(Boolean);
    const r = {
      aberta: li.classList.contains('expanded') && !!op && op.children.length > 0,
      naFolha: document.getElementById('songMenuPopup').classList.contains('open'),
      texto: op.textContent,
      linhas,
    };
    lista.remove(); ui(c.id).expanded = false; songMenuFor = null;
    setAppMode(modoAntes);
    return r;
  });
  checar(folha.aberta && !folha.naFolha,
    'tocar num episódio abre as opções NO CORPO da linha, não numa folha (v5.285)',
    JSON.stringify({ gaveta: folha.aberta, folha: folha.naFolha }));
  checar(/Tocar agora/.test(folha.texto),
    'com "Tocar agora" — é ele que TRANSMITE, sem esperar o download', JSON.stringify(folha.linhas));
  checar(/playlist/i.test(folha.texto) && /Cronograma/.test(folha.texto) && /Favoritar/.test(folha.texto),
    'e os três destinos que GUARDAM, como num vídeo do YouTube', JSON.stringify(folha.linhas));
  checar(!/Só áudio/.test(folha.texto),
    'e SEM o seletor de só-áudio — um testemunho em vídeo não tem versão de áudio',
    JSON.stringify(folha.linhas));
  checar(!/Cantada|Playback/.test(folha.texto),
    'nem o seletor Cantada/Playback do acervo — a folha é a do YouTube, não a das músicas');

  // O download EM LOTE não pode existir para a série: são ~52 vídeos.
  //
  // MEDIDO NOS DOIS ESTADOS (v1.2.0): o `aberto` diz se o card da série está
  // expandido quando a barra é desenhada, e é ele que separa as duas metades da
  // regra nova — o botão de atualizar SÓ existe com o álbum aberto. Uma medição
  // só aprovaria as duas leituras opostas, que é o modo de este oráculo passar
  // sem afirmar nada.
  const medirSerie = (aberto) => pg.evaluate((abrir) => {
    const lista = document.getElementById('hymnResults');
    const guardado = grupoAberto;
    grupoAberto = '';  // as fixas ficam na RAIZ desde a v1.0.1 — não há grupo a abrir
    // `renderCollectionsList` ACRESCENTA à lista (a lição da v5.232): sem
    // limpar, a segunda passada mediria o card da primeira — que é justamente o
    // estado OPOSTO ao que ela veio medir.
    lista.innerHTML = '';
    const serie = allCollections().find((c) => /Provai e Vede 2026/.test(c.name || ''));
    if (serie) ui(serie.id).expanded = !!abrir;
    renderCollectionsList(lista, () => {}, { semTotal: true });
    const cards = [...lista.querySelectorAll('.hymnal-card')];
    const card = cards.find((el) => /Provai e Vede 2026/.test(el.textContent));
    const at = card && card.querySelector('.coll-bar .coll-bar-at');
    const r = {
      achou: !!card,
      // O botão de BAIXAR é o `.coll-bar-dl` SEM modificador: os três desta
      // coluna dividem a geometria, e sem o `:not()` esta asserção passaria a
      // medir o de atualizar, que nasceu ali na v1.1.21.
      temBotaoBaixar: !!(card && card.querySelector(
        '.coll-bar .coll-bar-dl:not(.coll-bar-at):not(.coll-bar-rm)')),
      temLixeira: !!(card && card.querySelector('.coll-bar .coll-bar-rm')),
      temAtualizar: !!at,
      // "Botão puro, sem texto": nós de TEXTO, não `textContent` — este traz o
      // codepoint do glifo junto (ver a lixeira, mais abaixo).
      textoAtualizar: at ? [...at.childNodes].filter((n) => n.nodeType === 3)
        .map((n) => n.textContent).join('').trim() : null,
      rotuloAtualizar: at ? (at.getAttribute('aria-label') || at.title || '') : '',
      temPainel: !!(card && card.querySelector('.coll-opts')),
      // O SUBTÍTULO da barra: `fracaoPeso` devolvia, para um acervo vazio, "o
      // que vai custar baixar" — gigabytes prometendo um download em lote que
      // nunca existiu e que agora nem botão tem.
      resumo: card ? ((card.querySelector('.coll-bar-sync') || {}).textContent || '') : '',
    };
    if (serie) ui(serie.id).expanded = false;
    grupoAberto = guardado;
    return r;
  }, aberto);
  const semLote = await medirSerie(false);
  const aberta = await medirSerie(true);
  checar(semLote.achou, 'o card da série está na lista para ser medido');
  // ===== A SÉRIE NÃO GUARDA NADA, E POR ISSO PERDE DOIS BOTÕES (v1.1.21) =====
  // Pedido do operador: os episódios só existem enquanto estão no Cronograma,
  // nos Favoritos ou na playlist — o álbum não retém arquivo. Logo não há o que
  // baixar em lote (~15 GB/ano) nem o que remover: "Remover do dispositivo" ali
  // apagaria o que está em OUTRA lista, ou nada, e as duas leituras são erradas.
  checar(!semLote.temBotaoBaixar,
    'a série NÃO tem o botão de baixar a coleção — "não quero um download direto"');
  checar(!semLote.temLixeira,
    'e NÃO tem a lixeira: o álbum de série não retém arquivo nenhum');
  checar(aberta.temAtualizar && aberta.textoAtualizar === '',
    'o que ela tem é UM botão, puro e sem texto — "atualizar a lista" no lugar '
    + 'onde ficava o excluir', JSON.stringify(aberta.textoAtualizar));
  checar(/Atualizar a lista/.test(aberta.rotuloAtualizar),
    'com a frase no `aria-label`/`title` — quem não vê o ícone continua sabendo '
    + 'o que o toque faz', aberta.rotuloAtualizar);
  // ===== E ELE SÓ EXISTE COM O ÁLBUM ABERTO (v1.2.0) =====
  // Pedido do operador: *"os botões de atualizar lista do provai e vede e do
  // informativo mundial das missões só deve aparecer com o album/grupo
  // aberto"*. É a régua da lixeira (v1.1.16) aplicada ao terceiro botão desta
  // coluna: o gesto que revela a ação é o mesmo que revela a LISTA sobre a qual
  // ela age — e o acervo inteiro é uma lista de cards FECHADOS.
  //
  // As duas metades juntas são a asserção: sem a de baixo, o oráculo aprovaria
  // um botão que aparece sempre; sem a de cima, aprovaria um que sumiu de vez.
  checar(!semLote.temAtualizar,
    'e com o álbum FECHADO ele NÃO existe — o card de uma série fechada não '
    + 'oferece ação nenhuma');
  checar(!semLote.temPainel,
    'e o painel `.coll-opts` não existe mais: as três ações que ele teve '
    + 'terminaram todas na coluna da direita da barra');
  checar(!/\d+(,\d+)?\s?(KB|MB|GB)/.test(semLote.resumo)
    && /epis[óo]dio/.test(semLote.resumo),
    'e a barra dela não anuncia PESO nenhum — diz quantos episódios a lista tem. '
    + 'O peso ali era o custo de um download em lote que não existe',
    JSON.stringify(semLote.resumo));

  // ── A GAVETA DA LINHA É DO TIPO DO ITEM (v5.236) ───────────────────────
  // Relato do operador: *"o toque nele na lista abre ainda a opção de ver a
  // letra, mas ele não tem letra por não ser uma música"*.
  //
  // A v5.230 desviou as duas FOLHAS de um episódio para o caminho do YouTube e
  // parou aí — o toque na LINHA continuou abrindo a caixa da letra, que
  // anunciava "Letra ainda não baixada" para algo que nunca vai ter letra. É o
  // defeito da v5.229 outra vez: desviar as portas não desvia o que estava
  // atrás delas.
  //
  // As DUAS metades, e são inseparáveis: o vídeo deixa de prometer letra **e** a
  // música continua tendo a dela. Sem a segunda, apagar a gaveta inteira
  // passaria — a mesma cobrança de duas metades do `registro.test.mjs`.
  const gaveta = await pg.evaluate(async () => {
    // O MODO AVANÇADO, e ele é pré-requisito da medição inteira: no Modo Fácil
    // o toque na linha TOCA (não abre gaveta nenhuma), então o caso mediria um
    // container vazio e concluiria o que quisesse. A primeira versão deste caso
    // rodou assim e reprovou por isso — a lição da v5.208 numa terceira roupa.
    const modoAntes = document.body.classList.contains('mode-simple') ? 'simple' : 'full';
    setAppMode('full');
    const c = allCollections().find((x) => x.kind === 'serie');
    // O EPISÓDIO QUE TEM MINIATURA. A ordem do álbum é cronológica, e o
    // primeiro item é o de julho, que no harness não tem `thumb` — medir nele
    // reprovaria uma gaveta que está certa.
    const s = collSongs(c.id).find((x) => x.id_music === 'aaaaaaaaaa1');
    // Uma lista PRÓPRIA e VISÍVEL: o `#hymnResults` mora dentro do popup de
    // busca, que está fechado, e num elemento escondido a classe `expanded`
    // desenha o mesmo mas toda medida é zero (a lição da v5.208). Aqui não se
    // medem pixels, mas o `.item-detalhe` só existe no DOM com o `display`
    // resolvido — e é ele que a asserção procura.
    const lista = document.createElement('ul');
    lista.className = 'hymnal-list';
    // COM LARGURA DE CELULAR: a medição do botão lá embaixo é em pixels, e num
    // contêiner sem largura resolvida toda medida é zero — zeros comparados com
    // zeros passam sem medir nada (a lição da v5.208).
    lista.style.width = '390px';
    document.body.appendChild(lista);
    const li = hymnResultRow(c, s, null, true);
    lista.appendChild(li);
    li.querySelector('.hymn-row').click();
    // A montagem é assíncrona (o estado no aparelho vem do IndexedDB): dois
    // turnos bastam, e esperar pelo TEXTO em vez de por um prazo fixo é o que
    // impede o caso de virar intermitente num runner lento.
    for (let i = 0; i < 40
      && !(li.querySelector('.item-detalhe-estado') && li.classList.contains('expanded')); i++) {
      await new Promise((r) => setTimeout(r, 25));
    }
    const det = li.querySelector('.item-detalhe');
    const r = {
      temDetalhe: !!det,
      temCaixaDeLetra: !!li.querySelector('.hymn-lyrics'),
      texto: li.textContent,
      temThumb: !!li.querySelector('.item-detalhe-thumb'),
      duracaoGuardada: s.duration || '',
      // ===== A LARGURA DO BOTÃO NÃO MUDA COM O ESTADO (v5.287) =====
      //
      // "Ocultar" é mais longo que "Ver", então o botão crescia ao ser tocado e
      // o CONFIRMAR ao lado encolhia junto — um toque que muda a largura do
      // vizinho é a coisa que mais parece defeito numa faixa de dois botões. As
      // duas frases entram empilhadas na mesma célula de uma grade 1x1
      // (`.song-menu-letra-cx`), e a largura passa a ser a da MAIOR.
      //
      // A medição mora AQUI desde a v1.2.25: o interruptor de duas frases só
      // existe no VÍDEO — numa música o mesmo botão abre o leitor e tem uma
      // frase só. O `smoke.mjs`, que roda sem ponte, nem chega a ver uma série.
      larguras: (() => {
        const ver = li.querySelector('.song-menu-letra');
        if (!ver) return null;
        const antes = Math.round(ver.getBoundingClientRect().width);
        ver.click();   // no vídeo o ouvinte é síncrono: alterna `vendo-letra`
        const depois = Math.round(
          li.querySelector('.song-menu-letra').getBoundingClientRect().width);
        return { antes, depois, rotulo: ver.textContent };
      })(),
    };
    lista.remove();
    setAppMode(modoAntes);   // o modo é global: deixá-lo trocado quebra os casos seguintes
    return r;
  });
  checar(gaveta.temDetalhe,
    'o toque num EPISÓDIO abre a gaveta de detalhe do vídeo');
  checar(!gaveta.temCaixaDeLetra && !/[Ll]etra/.test(gaveta.texto),
    'e ela NÃO promete letra nenhuma — nem a caixa, nem a palavra',
    JSON.stringify(gaveta.texto.slice(0, 120)));
  checar(gaveta.temThumb,
    'a MINIATURA está lá: num vídeo é ela que responde "é este mesmo?", que é o '
    + 'que a letra responde num hino');
  checar(gaveta.duracaoGuardada && gaveta.texto.includes(gaveta.duracaoGuardada),
    'e a duração também — os dois campos que o extrator entregava e o índice '
    + 'descartava', JSON.stringify(gaveta.duracaoGuardada));
  checar(/Toca sem baixar|Já no aparelho/.test(gaveta.texto),
    'mais o estado no aparelho, que é o que decide: transmitir agora ou ~300 MB',
    JSON.stringify(gaveta.texto.slice(0, 120)));
  checar(!!gaveta.larguras && gaveta.larguras.antes > 0
    && gaveta.larguras.antes === gaveta.larguras.depois,
    'e o botão que a revela tem a MESMA LARGURA nos dois estados: "Ocultar" é '
    + 'mais longo que "Ver", e ele crescia debaixo do dedo levando o confirmar '
    + 'ao lado junto', JSON.stringify(gaveta.larguras));

  // A OUTRA METADE: numa MÚSICA a gaveta é SÓ AS OPÇÕES (v1.2.25). A letra numa
  // caixa de texto aqui dentro era uma segunda leitura, pior que a que o app já
  // tem: quem quer ler abre o LEITOR (cifra, tom, corpo, rolagem), e quem só
  // quer conferir "é este mesmo?" já tem o trecho casado na linha do resultado.
  // Sem coleção do LouvorJA neste harness (não há rede), a faixa é posta à mão
  // — o que se afirma é o desvio de `hymnResultRow`, não o banco de origem.
  const gavetaMusica = await pg.evaluate(async () => {
    const modoAntes = document.body.classList.contains('mode-simple') ? 'simple' : 'full';
    setAppMode('full');
    const c = allCollections().find((x) => x.kind === 'hymnal');
    const estadoAntes = collState[c.id];
    const s = { id_music: 'zz1', name: 'Hino de teste', track: 1, has_instrumental_music: false };
    collState[c.id] = { indexSyncedAt: Date.now(), songs: [s], isHymnal: true };
    lyricStoreFor(c.id)[s.id_music] = [{ a: 'Refrão', l: ['a primeira linha', 'a segunda linha'] }];
    const lista = document.createElement('ul');
    lista.className = 'hymnal-list';
    document.body.appendChild(lista);
    const li = hymnResultRow(c, s, null, true);
    lista.appendChild(li);
    li.querySelector('.hymn-row').click();
    for (let i = 0; i < 40 && !li.classList.contains('expanded'); i++) {
      await new Promise((r) => setTimeout(r, 25));
    }
    const r = {
      abriu: li.classList.contains('expanded'),
      temOpcoes: !!li.querySelector('.hymn-opcoes .song-menu-btn'),
      temCaixaDeLetra: !!li.querySelector('.hymn-lyrics'),
      temDetalhe: !!li.querySelector('.item-detalhe'),
      rotuloDaLetra: (li.querySelector('.song-menu-letra') || {}).textContent || '',
    };
    lista.remove();
    setAppMode(modoAntes);
    // E O ACERVO VOLTA COMO ESTAVA: a faixa de mentira existe para UMA medição,
    // e deixá-la no `collState` faria os casos seguintes medirem um hinário que
    // este harness não tem.
    if (estadoAntes) collState[c.id] = estadoAntes; else delete collState[c.id];
    return r;
  });
  checar(gavetaMusica.abriu && gavetaMusica.temOpcoes,
    'o toque numa MÚSICA abre a gaveta com as OPÇÕES', gavetaMusica);
  checar(!gavetaMusica.temCaixaDeLetra,
    'e SEM a caixa de letra: ela virou o leitor, que tem cifra, tom e rolagem',
    gavetaMusica.temCaixaDeLetra);
  checar(/Ver a letra/.test(gavetaMusica.rotuloDaLetra),
    'o botão continua se chamando "Ver a letra" — o que muda é PARA ONDE ele leva',
    gavetaMusica.rotuloDaLetra);
  checar(!gavetaMusica.temDetalhe,
    'sem a gaveta do vídeo no meio — cada tipo abre a sua, e só a sua');

  // ── A BIBLIOTECA ABRE COMO ÍNDICE (v5.237) ─────────────────────────────
  // Pedido do operador: *"tornar os agrupamentos de coleções… todas as
  // coleções, em colapsados, assim a listagem das seções fica mais curta e a
  // navegação se torna mais ramificada"* e *"coloque os favoritos dentro da
  // biblioteca… no topo da listagem"*.
  //
  // As DUAS metades, e são inseparáveis: fechado NÃO CONSTRÓI card nenhum (senão
  // "colapsado" seria só um `display: none`, e a tela continuaria pagando o DOM
  // de dezenas de álbuns a cada redesenho) **e** o toque no cabeçalho abre.
  // ===== OS DOIS BLOCOS ABAIXO MEDEM O MODO AVANÇADO (v1.0.7) =====
  // O padrão do app é o MODO FÁCIL (`storedAppMode`), e a seção de Favoritos
  // deixou de existir lá — a pedido do operador, porque aquele modo não tem aba
  // nem lista onde o que se GUARDA possa ser visto depois. Sem esta troca, tudo
  // o que estes blocos afirmam sobre os Favoritos passaria a medir o modo em que
  // eles não existem. A AUSÊNCIA tem caso próprio, logo adiante.
  //
  // FORA do `evaluate`, e não dentro: aqueles blocos leem o estado PADRÃO
  // verbatim (`favAberto`, `grupoAberto`) e montam árvores próprias — injetar
  // uma troca de modo no meio deles é mexer no cenário que eles existem para
  // medir.
  await pg.evaluate(() => { window.__modoBiblioteca = appMode; setAppMode('full'); });
  const indice = await pg.evaluate(async () => {
    // O ESTADO PADRÃO, VERBATIM. Ele não é montado aqui de propósito: o que se
    // afirma é o que o app trouxe da carga do módulo — desde a v1.1.4, NADA
    // aberto. Escrevê-lo aqui mediria a suposição do teste, não a decisão do
    // app; e esta leitura ainda serve de guarda de que os casos acima
    // devolveram o que tomaram emprestado.
    const padrao = { fav: favAberto, colecao: grupoAberto };
    // DUAS SEÇÕES DE ÁLBUM, semeadas aqui (v1.0.1). Este caso fala do RODÍZIO
    // — abrir uma fecha a outra —, e ele precisa de duas seções para existir.
    // Até aqui elas vinham de graça dos dois grupos fixos ("Arquivos oficiais"
    // e "Hinários"); com as coleções fixas na RAIZ sobrava só "Favoritos", e o
    // caso passava a medir o vazio. Restauradas no fim.
    const catAntes = albumCatalog.categories;
    const albAntes = albumCatalog.albums;
    albumCatalog.categories = ['Adoradores', 'Diversas'].map((nome, i) => ({
      name: nome, albums: [{ id_album: 700 + i, name: 'Álbum ' + nome }],
    }));
    albumCatalog.albums = albumCatalog.categories.map((c) => c.albums[0]);
    const lista = document.createElement('ul');
    lista.className = 'hymnal-list';
    lista.style.width = '390px';
    document.body.appendChild(lista);
    const desenhar = () => {
      lista.innerHTML = '';
      renderCollectionsList(lista, desenhar, { semTotal: true });
    };
    desenhar();
    const grupos = [...lista.querySelectorAll('.coll-group-name')].map((e) => e.textContent.trim());
    // A SEÇÃO DOS FAVORITOS: fechada por padrão (v1.1.4) e COLAPSÁVEL como as
    // outras — o corpo dela não é construído até alguém tocar.
    const acharFav = () => [...lista.querySelectorAll('.coll-group')]
      .find((g) => /Favoritos/.test((g.querySelector('.coll-group-name') || {}).textContent || ''));
    const gFav = acharFav();
    const corpoFav = gFav && gFav.querySelector('.coll-group-corpo');
    const fav = {
      padrao,
      // A MESMA seta das outras seções, no mesmo lugar (a thumb da barra).
      temSeta: !!(gFav && gFav.querySelector('.coll-group-bar > button.coll-group-icon')),
      corpoVisivel: !!(corpoFav && corpoFav.getBoundingClientRect().height > 0),
    };
    // ELA RESPONDE AO PRÓPRIO TOQUE, e só a ele (v5.276). A v5.273 a tinha feito
    // um no-op — ela era o piso do rodízio, e fechá-la deixaria a tela sem
    // nenhuma seção aberta. Fora do rodízio, o gesto volta a ser o de qualquer
    // outra — e desde a v1.1.4 o primeiro toque ABRE, porque ela nasce fechada.
    // As duas metades continuam sendo necessárias: sem a segunda, "colapsável"
    // seria mão única. A espera é generosa de propósito — o recolhimento é
    // animado (`collapseAccordion`), e ler cedo aprovaria uma seção que fecha
    // meio segundo depois.
    const tocarFav = async () => {
      const seta = (acharFav() || {}).querySelector
        && acharFav().querySelector('.coll-group-bar > button.coll-group-icon');
      if (seta) seta.click();
      await new Promise((r) => setTimeout(r, 400));
    };
    await tocarFav();
    fav.abreNoProprioToque = !!acharFav()
      && acharFav().classList.contains('aberto') && favAberto === true;
    await tocarFav();
    fav.fechaDeVolta = !!acharFav()
      && !acharFav().classList.contains('aberto') && favAberto === false;
    // Daqui para baixo o caso é o do ÍNDICE, que fala dos grupos de coleção. A
    // referência de "fechado" é a tela como ela ABRE: os Favoritos (que não têm
    // card nenhum) e todas as coleções recolhidas.
    desenhar();
    const fechado = {
      grupos,
      // SÓ os cards de GRUPO (v1.0.1): as quatro coleções fixas vivem na raiz
      // e são desenhadas sempre — é o que as tirou de trás de um cabeçalho.
      // A regra que este número guarda continua sendo a mesma: uma SEÇÃO
      // fechada não constrói o conteúdo dela.
      cards: lista.querySelectorAll('.coll-group .hymnal-card').length,
      // A altura do índice inteiro contra a de um grupo aberto: é ela que o
      // pedido chama de "listagem mais curta", e medir o número de nós não
      // diria a mesma coisa.
      altura: lista.getBoundingClientRect().height,
    };
    // O TOQUE num cabeçalho de seção. Ele responde a pergunta da v5.237
    // ("fechado não constrói card, o toque constrói") e, desde a v5.276, a que
    // a substituiu: abrir uma coleção **não** mexe nos Favoritos.
    //
    // OS DOIS ALVOS SÃO DESCOBERTOS, não digitados (v1.0.1): este caso fala do
    // RODÍZIO, não de quais seções existem. Ele mirava "Arquivos oficiais" e
    // "Hinários", que deixaram de ser grupos — e um nome fixo aqui prenderia a
    // regra do acordeão ao catálogo da fixture.
    const tocar = async (nome) => {
      const barra = [...lista.querySelectorAll('.coll-group-bar')]
        .find((b) => b.textContent.trim().startsWith(nome));
      if (barra) barra.click();
      await new Promise((r) => setTimeout(r, 400));
    };
    const doisGrupos = grupos.filter((n) => n !== 'Favoritos').slice(0, 2);
    // A INDEPENDÊNCIA SÓ É OBSERVÁVEL COM A SEÇÃO ABERTA, e desde a v1.1.4 ela
    // não nasce assim. Abri-la aqui MONTA o cenário da regra que vem a seguir
    // (abrir uma coleção não a toca) — não mede o padrão, que já foi afirmado
    // acima contra o estado verbatim da carga.
    await tocarFav();
    await tocar(doisGrupos[0]);
    const aberto = {
      // A MESMA MEDIDA do `fechado`, e ela tem de ser a mesma: contar todos os
      // `.hymnal-card` somaria os quatro da raiz, que existem abertos ou
      // fechados, e o par de números deixaria de falar da seção.
      cards: lista.querySelectorAll('.coll-group .hymnal-card').length,
      construiu: lista.querySelectorAll('.coll-group-corpo .hymnal-card').length > 0,
      altura: lista.getBoundingClientRect().height,
      // O card vive DENTRO do corpo do grupo, não solto na lista: é isso que
      // faz a árvore ser uma árvore.
      dentroDoCorpo: !!lista.querySelector('.coll-group-corpo .hymnal-card'),
      // OS FAVORITOS CONTINUAM ABERTOS (v5.276): eles não estão no rodízio.
      favSegue: !!(acharFav() && acharFav().classList.contains('aberto')),
      abertas: lista.querySelectorAll('.coll-group--drop.aberto').length,
    };
    // E O RODÍZIO VALE ENTRE AS COLEÇÕES: abrir a segunda fecha a primeira,
    // sem tocar nos Favoritos.
    await tocar(doisGrupos[1]);
    const trocou = {
      abertas: lista.querySelectorAll('.coll-group--drop.aberto').length,
      colecao: grupoAberto,
      favSegue: !!(acharFav() && acharFav().classList.contains('aberto')),
    };
    // E FECHAR A COLEÇÃO ABERTA deixa a tela sem nenhuma — que deixou de ser um
    // estado a evitar: quem fechou o hinário está olhando os favoritos.
    await tocar(doisGrupos[1]);
    fav.semColecao = grupoAberto === '' && !!acharFav()
      && acharFav().classList.contains('aberto');
    lista.remove();
    albumCatalog.categories = catAntes; albumCatalog.albums = albAntes;
    // Devolve o estado PADRÃO do app: os casos abaixo desenham a Biblioteca de
    // verdade, e deixá-la noutra seção seria emprestar a este arquivo um
    // comportamento que o app não tem.
    grupoAberto = ''; favAberto = false;
    return { fechado, aberto, trocou, fav, doisGrupos };
  });
  // E DEVOLVE O MODO. O modo é global: os casos abaixo medem o Modo Fácil
  // BLOQUEADO, e deixá-lo em avançado faria os dois falharem falando de outra
  // coisa. (Medido: foi exatamente isto que aconteceu na primeira tentativa.)
  await pg.evaluate(() => setAppMode(window.__modoBiblioteca || 'simple'));
  checar(indice.fechado.grupos.length >= 2 && indice.fechado.cards === 0,
    'A BIBLIOTECA ABRE COMO ÍNDICE: seção fechada não constrói card nenhum',
    JSON.stringify(indice.fechado.grupos) + ' · ' + indice.fechado.cards + ' card(s) de grupo');
  checar(indice.fechado.grupos[0] === 'Favoritos',
    'e o primeiro deles é FAVORITOS, no topo da listagem',
    JSON.stringify(indice.fechado.grupos));
  // ── AS COLEÇÕES FAZEM RODÍZIO; OS FAVORITOS, NÃO (v5.262 → v5.273 → v5.276) ─
  // Pedido do operador: *"agora não mais são concorrentes com os favoritos… o
  // tamanho da seção de favoritos segue sendo o tamanho que sobra… e ela segue
  // sendo a seção aberta de nascença, mas agora ela não se fecha quando outro
  // se abre; as coleções são concorrentes entre si, mas não com os favoritos"*.
  //
  // São CINCO metades, e nenhuma basta sozinha: o padrão (que desde a v1.1.4 é
  // NADA aberto), o toque nela própria que a abre E fecha (senão "colapsável"
  // seria mão única), abrir uma coleção que NÃO a toca, o rodízio valendo entre
  // coleções, e fechar a coleção aberta deixando a tela sem nenhuma — que a
  // v5.273 proibia e agora é o estado normal.
  checar(indice.fav.padrao.fav === false && indice.fav.padrao.colecao === '',
    'o PADRÃO do app é a Biblioteca TODA FECHADA — nem os Favoritos, nem coleção '
    + 'nenhuma', JSON.stringify(indice.fav.padrao));
  checar(!indice.fav.corpoVisivel,
    'e é assim que ela abre: só as barras, empilhadas e compactas');
  checar(indice.fav.temSeta,
    'ela tem a MESMA seta das outras seções, na thumb da barra');
  checar(indice.fav.abreNoProprioToque && indice.fav.fechaDeVolta,
    'o toque NELA a abre — e fecha de volta, senão "colapsável" seria mão única');
  checar(indice.aberto.favSegue && indice.aberto.abertas === 2,
    'abrir uma COLEÇÃO não a fecha: as duas ficam abertas, porque elas não '
    + 'disputam o mesmo interruptor', indice.aberto.abertas + ' aberta(s)');
  checar(indice.trocou.abertas === 2 && indice.trocou.colecao === indice.doisGrupos[1]
    && indice.trocou.favSegue,
    'e o rodízio vale ENTRE as coleções: abrir a segunda fecha a primeira e '
    + 'não toca nos Favoritos', JSON.stringify(indice.trocou));
  checar(indice.fav.semColecao,
    'fechar a coleção aberta deixa a tela sem nenhuma — e os favoritos seguem lá');
  checar(indice.aberto.cards > 0 && indice.aberto.construiu,
    'o toque no cabeçalho abre a seção e os cards aparecem',
    indice.aberto.cards + ' card(s)');

  // ── FECHAR A BIBLIOTECA VOLTA AO ESTADO PADRÃO (v1.1.4) ───────────────────
  // Pedido do operador: *"inclusive toda vez que fechar a biblioteca, reset para
  // o estado padrão"*.
  //
  // O defeito que ele descreve é MUDO: o estado de navegação é de MÓDULO e o nó
  // do popup é o MESMO entre uma abertura e a seguinte (a razão do
  // `scrollTop = 0` do `openHymnSearch`), então a Biblioteca reabria com o
  // hinário de 613 hinos escancarado de uma consulta de meia hora atrás. Nada
  // erra alto — só a tela em que ela abre deixa de ser a tela que ela promete.
  //
  // DUAS METADES, e a primeira é o HAZARD: fechar SEM o reset — literalmente o
  // que `closeHymnSearch` fazia até a v1.1.3 — deixa tudo de pé. Sem ela, a
  // segunda provaria que uma função concorda consigo mesma.
  const reset = await pg.evaluate(async () => {
    const modoAntes = appMode;
    setAppMode('full');
    const catAntes = albumCatalog.categories;
    const albAntes = albumCatalog.albums;
    albumCatalog.categories = [{ name: 'Diversas', albums: [{ id_album: 900, name: 'Álbum X' }] }];
    albumCatalog.albums = [albumCatalog.categories[0].albums[0]];
    openHymnSearch();
    await new Promise((r) => setTimeout(r, 250));
    // SUJAR pelas mesmas variáveis que os toques escrevem: o que este caso mede
    // é o RESET, e montar o cenário por cliques encadeados o faria depender das
    // animações de três acordeões.
    const alvo = allCollections()[0];
    const sujar = () => {
      favAberto = true;
      grupoAberto = 'Diversas';
      const u = ui(alvo.id);
      u.expanded = true; u.shown = 100;
    };
    const ler = () => ({
      fav: favAberto, colecao: grupoAberto, pasta: pastaAberta,
      card: !!ui(alvo.id).expanded, pagina: ui(alvo.id).shown | 0,
    });
    sujar();
    hymnSearchPopupEl.classList.remove('open');   // o fechar de ANTES da v1.1.4
    openHymnSearch();
    await new Promise((r) => setTimeout(r, 250));
    const semReset = ler();
    // E AGORA a porta de verdade.
    sujar();
    closeHymnSearch();
    const comReset = ler();
    openHymnSearch();
    await new Promise((r) => setTimeout(r, 250));
    const aoReabrir = Object.assign(ler(), {
      abertas: hymnResultsEl.querySelectorAll('.coll-group--drop.aberto').length,
      cards: hymnResultsEl.querySelectorAll('.hymnal-card.expanded').length,
    });
    closeHymnSearch();
    albumCatalog.categories = catAntes; albumCatalog.albums = albAntes;
    setAppMode(modoAntes);
    return { semReset, comReset, aoReabrir, achouColecao: !!alvo };
  });
  checar(reset.achouColecao, 'há uma coleção com que medir o estado do card');
  checar(reset.semReset.fav === true && reset.semReset.colecao === 'Diversas'
    && reset.semReset.card === true,
    'HAZARD: fechar sem o reset deixa TUDO de pé — a Biblioteca reabre na forma '
    + 'da consulta anterior', JSON.stringify(reset.semReset));
  checar(reset.comReset.fav === false && reset.comReset.colecao === ''
    && reset.comReset.pasta === null && reset.comReset.card === false
    && reset.comReset.pagina === 0,
    'e `closeHymnSearch` devolve os QUATRO ao padrão: favoritos, coleção, pasta '
    + 'e o card (com a paginação zerada)', JSON.stringify(reset.comReset));
  checar(reset.aoReabrir.abertas === 0 && reset.aoReabrir.cards === 0,
    'de modo que ela reabre desenhada como abre da primeira vez: nenhuma seção '
    + 'e nenhum card expandidos', JSON.stringify(reset.aoReabrir));
  checar(indice.aberto.dentroDoCorpo,
    'dentro do CORPO do grupo — a lista virou árvore, não uma pilha com títulos');
  checar(indice.aberto.altura > indice.fechado.altura,
    'e fechado ocupa MENOS tela que aberto, que é o pedido inteiro ('
    + Math.round(indice.fechado.altura) + 'px contra ' + Math.round(indice.aberto.altura) + 'px)');

  // ── OS FAVORITOS DENTRO DA BIBLIOTECA (v5.237) ─────────────────────────
  // Uma implementação só, duas casas: o grupo é montado pelo MESMO
  // `renderFolderList` da gaveta. O que se afirma é que ele desenha as linhas
  // de verdade — e que a gaveta continua desenhando as dela, senão apontar o
  // host para o lugar novo teria quebrado o antigo em silêncio.
  // MODO AVANÇADO: este bloco INTEIRO é sobre a seção de Favoritos, que não
  // existe no Modo Fácil (v1.0.7) — ver a nota dos blocos acima.
  await pg.evaluate(() => { window.__modoBiblioteca = appMode; setAppMode('full'); });
  const favs = await pg.evaluate(async () => {
    // Um favorito de verdade, para a seção ter o que mostrar.
    const rec = await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
      { name: 'Louvor favorito de teste', list: 'favs' });
    await recarregarFavoritos();
    // A SEÇÃO ABERTA É O CENÁRIO DESTE CASO, não o padrão do app (que desde a
    // v1.1.4 é fechada — ver `resetarBiblioteca`): tudo o que ele mede é o CORPO
    // dela, e uma seção fechada não constrói corpo nenhum.
    grupoAberto = ''; favAberto = true;
    const lista = document.createElement('ul');
    lista.className = 'hymnal-list';
    lista.style.width = '390px';
    document.body.appendChild(lista);
    renderCollectionsList(lista, () => {}, { semTotal: true });
    const grupo = [...lista.querySelectorAll('.coll-group')]
      .find((g) => /Favoritos/.test((g.querySelector('.coll-group-name') || {}).textContent || ''));
    const corpo = grupo && grupo.querySelector('.coll-group-corpo');
    const r = {
      temItem: !!corpo && /Louvor favorito de teste/.test(corpo.textContent),
      temNovaPasta: false, temPastaDoAparelho: false,
      // A LINHA DE USO DO DISCO SAIU (v5.239): `navigator.storage.estimate()`
      // fala do origin inteiro, com padding deliberado, e a cota é o que o
      // navegador ACHA que pode ceder — ela disputava a leitura com os
      // cabeçalhos, que dizem o peso de verdade de cada coleção. A asserção
      // vale para a lista INTEIRA, não só para o corpo da seção: era ali, no
      // rodapé da Biblioteca, que ela morava.
      semLinhaDeDisco: !lista.querySelector('.storage-usage'),
      // O RODAPÉ DA SEÇÃO. `syncDeviceFolder` era o botão do cabeçalho da
      // gaveta, e a gaveta deixou de ter porta própria: sem esta linha a ação
      // ficaria sem lugar nenhum de onde ser alcançada.
      rodape: !corpo ? [] : [...corpo.querySelectorAll('.import-row .import-btn')]
        .map((b) => b.textContent.trim()),
      // O cabeçalho: o que ele mostra em TEXTO (só o nome — o contador saiu) e
      // se o botão de ação está lá.
      cabecalho: !grupo ? '' : (grupo.querySelector('.coll-group-bar') || {}).textContent,
      temAcaoNaBarra: !!(grupo && grupo.querySelector('.coll-group-bar .coll-group-acao')),
      semContagem: !!grupo && !grupo.querySelector('.coll-group-count'),
      // E ESTA É A ÚNICA CASA (v5.294). Até aqui a asserção era "a gaveta
      // continua desenhando a dela — o host é emprestado, não movido"; a
      // gaveta saiu do documento junto com o último caminho que levava a ela,
      // então a pergunta forte passou a ser a inversa: não sobrou nó nenhum
      // do subsistema antigo, e o corpo da seção é o único lugar em que esta
      // lista aparece.
      semGaveta: !document.getElementById('favPopup')
        && !document.getElementById('favList'),
    };
    r.semRodape = r.rodape.length === 0;
    // A AÇÃO DA BARRA FAZ A COISA (v5.254). Ela abria uma folha com duas
    // escolhas; a outra — criar um atalho de pasta — deixou de existir, e uma
    // folha com uma opção é um toque cobrado para não escolher nada. O que se
    // mede é o desfecho: nenhuma folha, e o pedido de pasta do aparelho saiu.
    window.__pediuPasta = 0;
    const syncOrig = window.syncDeviceFolder;
    window.syncDeviceFolder = () => { window.__pediuPasta++; };
    grupo.querySelector('.coll-group-acao').click();
    r.acao = {
      abriuFolha: document.getElementById('songMenuPopup').classList.contains('open'),
      pediuPasta: window.__pediuPasta,
      titulo: (grupo.querySelector('.coll-group-bar .coll-group-acao') || {}).title || '',
    };
    window.syncDeviceFolder = syncOrig;
    closeSongMenu();
    // ── A LISTA É ÚNICA, E A ORDEM É DO OPERADOR (v5.254) ────────────────
    // Sem seções por tipo, e com alça de arrastar em cada item — as duas
    // metades do pedido. A ordem medida é a da lista `favs`, que é ordem de
    // chegada; o que a asserção prova é que ela é REORDENÁVEL.
    const rec2 = await AVDB.addMedia(new Blob(['y'], { type: 'video/mp4' }),
      { name: 'Vídeo favorito de teste', list: 'favs' });
    // UMA PASTA SINCRONIZADA, para a ORDEM ter o que provar (v5.285): sem ela
    // "as pastas vêm primeiro" seria verdade por vacuidade.
    opfsFolders.push({ id: 'pasta-ordem', name: 'Vídeos do culto', count: 9 });
    await recarregarFavoritos();
    const lista3 = document.createElement('ul');
    document.body.appendChild(lista3);
    favHost = lista3;
    try { renderFolderList(); } finally { favHost = null; }
    // ===== A GAVETA É MONTADA AO ABRIR, E DESDE A v5.302 A FAIXA TAMBÉM =====
    // Ela passou a viajar dentro da linha do confirmar (o hook `aoLado`), e essa
    // linha é escrita por `renderItemMenu` — que só roda no primeiro toque, como
    // as opções sempre rodaram. As sondas abaixo perguntam pelos botões DELA,
    // então o percurso tem de ser o do operador: abrir antes de medir.
    for (const li of lista3.querySelectorAll('.fav-itens > .lib-item')) {
      li.querySelector('.row').click();
      await new Promise((f) => setTimeout(f, 60));
    }
    await new Promise((f) => setTimeout(f, 120));
    r.lista = {
      secoes: lista3.querySelectorAll('.fav-section').length,
      // AS SONDAS DOS ITENS SÃO ESCOPADAS À PLACA (`.fav-itens`), e não à lista
      // inteira: desde a v5.285 há uma PASTA no topo, que também é um
      // `.lib-item` e não é um favorito — contá-la aqui mediria outra coisa
      // (ela não tem par ↑↓, nem subtítulo, nem estrela).
      // ===== AS PASTAS VÊM PRIMEIRO (v5.285) =====
      // Pedido do operador. A régua é a POSIÇÃO no documento, e não o índice
      // dentro de uma `<ul>`: desde a v5.284 os itens moram numa placa própria
      // (`.fav-itens`) e as pastas são irmãs dela, então "primeiro" é uma
      // relação entre dois nós de níveis diferentes — que é justamente o que
      // uma comparação de índices não veria.
      pastaAntes: (() => {
        const pasta = lista3.querySelector('.folder-opfs');
        const placa = lista3.querySelector('.fav-itens');
        if (!pasta || !placa) return null;
        return !!(pasta.compareDocumentPosition(placa) & Node.DOCUMENT_POSITION_FOLLOWING);
      })(),
      // Tipos diferentes (áudio e vídeo) na MESMA lista, sem nada entre eles.
      nomes: [...lista3.querySelectorAll('.fav-itens .row-name')].map((e) => e.textContent),
      // O PAR ↑↓ tomou o lugar da alça de arrastar (v5.285). Ele morava dentro
      // do menu `⋮`; desde a v5.287 mora na FAIXA DE AÇÕES da gaveta, que abre
      // ABAIXO da linha em vez de por cima do título. Medir só a presença
      // aprovaria os botões soltos na faixa do nome.
      ordem: [...lista3.querySelectorAll('.fav-itens .row-ordem')]
        .filter((b) => b.closest('.hymn-gaveta .fav-acoes')).length,
      // E AS PONTAS SÃO INERTES: o primeiro item não sobe, o último não desce.
      // Sem isto, dois botões mortos ficariam oferecendo o que não fazem.
      pontas: (() => {
        const ls = [...lista3.querySelectorAll('.fav-itens > .lib-item')];
        if (ls.length < 2) return null;
        const ord = (li) => [...li.querySelectorAll('.row-ordem')].map((b) => b.disabled);
        return { primeiro: ord(ls[0]), ultimo: ord(ls[ls.length - 1]) };
      })(),
      // ===== A FAIXA DO NOME FICOU SEM BOTÃO NENHUM (v5.287) =====
      // O `⋮` era o último, e ele saiu com a faixa que ele abria: o corpo da
      // linha deixou de projetar, então a gaveta tem para onde descer. O que
      // sobra na `.row` é a miniatura (que hospeda o Parar) e o texto.
      semBotaoNaLinha: [...lista3.querySelectorAll('.fav-itens > .lib-item')]
        .every((li) => li.querySelectorAll('.row > button').length === 0
          && !li.querySelector('.row-acoes') && !li.querySelector('.row-mais')),
      // O subtítulo voltou: sem cabeçalho de tipo, é ele que distingue.
      subs: [...lista3.querySelectorAll('.fav-itens .row-sub')]
        .map((e) => getComputedStyle(e).display).filter((d) => d !== 'none').length,
      // O PARAR (v5.259). Nesta lista ele simplesmente NÃO EXISTIA: uma linha de
      // favorito no ar mostrava o selo "● No ar" e não oferecia nada que a
      // tirasse de lá — e foi justamente aqui que o operador viu a faixa de
      // ações por cima do título ("ele estava no ar"). Ele mora na CAPA, e a
      // faixa tem de continuar OPACA nesse estado.
      parar: (() => {
        const li = lista3.querySelector('.fav-itens > .lib-item');
        if (!li) return null;
        li.classList.add('no-ar');
        const stop = li.querySelector('.row-stop');
        const r = {
          naThumb: !!stop && !!stop.parentElement
            && stop.parentElement.classList.contains('thumb'),
          visivel: !!stop && getComputedStyle(stop).display !== 'none',
        };
        li.classList.remove('no-ar');
        return r;
      })(),
    };
    // ===== A LINHA DE FAVORITO ABRE A GAVETA DA BIBLIOTECA (v5.287) =====
    //
    // Pedido do operador, em duas frases: a gaveta de opções não pode abrir
    // SOBRE o título, e a lista tem de ter *"o mesmo sistema de opções de play
    // que temos no resto da biblioteca, ao invés de tratar ela como toque
    // direto no player"*.
    //
    // As duas são medidas juntas porque a segunda é o que torna a primeira
    // possível: enquanto o toque projetava, a gaveta não tinha para onde descer.
    // Daí as asserções serem TRÊS e não uma — que ela abriu, que ela abriu
    // ABAIXO da faixa do nome, e que o toque NÃO projetou (a playlist não foi
    // trocada, que é o efeito observável do caminho antigo).
    {
      const li = lista3.querySelector('.fav-itens > .lib-item');
      const plAntes = (await AVDB.listIds('playlist')).join(',');
      li.querySelector('.row').click();
      await new Promise((res) => setTimeout(res, 400));
      const gav = li.querySelector('.hymn-gaveta');
      const cx = li.querySelector('.row').getBoundingClientRect();
      const cg = gav ? gav.getBoundingClientRect() : null;
      r.gaveta = {
        abriu: li.classList.contains('expanded'),
        // A régua da SOBREPOSIÇÃO: o topo da gaveta não pode entrar na faixa do
        // nome. A faixa de ações antiga era `position: absolute` COM `top: 0` —
        // ela media exatamente o contrário disto.
        abaixo: !!cg && cg.top >= cx.bottom - 1 && cg.height > 0,
        // Só as MARCÁVEIS: o confirmar mora na mesma `<ul>` e tem o mesmo
        // rótulo de classe, e contá-lo aqui somaria uma "opção" que não é uma.
        opcoes: [...gav.querySelectorAll('.hymn-opcoes .song-menu-sel .song-menu-label')]
          .map((e) => e.textContent),
        marcaveis: gav.querySelectorAll('.hymn-opcoes .song-menu-check').length,
        confirmar: ((gav.querySelector('.song-menu-go .song-menu-label') || {}).textContent) || '',
        // O PADRÃO, antes de qualquer toque (v1.1.8): "Tocar agora" nasce
        // marcado, e SÓ ele.
        jaMarcadas: gav.querySelectorAll('.hymn-opcoes .song-menu-check.on').length,
        rotuloMarcado: ([...gav.querySelectorAll('.hymn-opcoes .song-menu-sel')]
          .find((e) => e.querySelector('.song-menu-check.on')) || {}).textContent || '',
        confirmarNasceAtivo: !(gav.querySelector('.song-menu-go') || {}).disabled,
        acoesNaGaveta: !!gav.querySelector('.fav-acoes .row-ordem')
          && !!gav.querySelector('.fav-acoes .row-excluir'),
        // ===== UMA SAÍDA SÓ, E ELA PERGUNTA (v5.288) =====
        // Pedido do operador: *"remova ou a opção de excluir ou a opção de
        // desfavoritar, pois tecnicamente ambas fazem a mesma coisa"*. Nesta
        // lista faziam — as duas terminam num `listRemove('favs', id)`. Fica a
        // LIXEIRA, porque aqui a estrela é um alternador de uma direção só
        // (todo item já é favorito) e porque ela pergunta antes.
        semEstrela: !gav.querySelector('.fav-btn') && !li.querySelector('.fav-btn'),
        naoProjetou: (await AVDB.listIds('playlist')).join(',') === plAntes,
      };
      // E O CONFIRMAR FAZ O QUE DIZ: marcar "Cronograma" e confirmar põe o item
      // na lista. Sem esta metade, uma gaveta bonita e inerte passaria.
      const alvoCrono = [...gav.querySelectorAll('.hymn-opcoes .song-menu-btn')]
        .find((b) => /Cronograma/.test(b.textContent));
      if (alvoCrono) alvoCrono.click();
      await new Promise((res) => setTimeout(res, 60));
      const go = gav.querySelector('.song-menu-go');
      r.gaveta.confirmarAtivo = !!go && !go.disabled;
      if (go && !go.disabled) go.click();
      await new Promise((res) => setTimeout(res, 300));
      r.gaveta.foiPraCrono = (await AVDB.listIds('imports')).includes(li.dataset.id);
      await AVDB.listRemove('imports', li.dataset.id);
    }
    lista3.remove();
    opfsFolders.length = 0;
    // E O REORDENAR de verdade, pelo BOTÃO: o segundo item sobe uma casa.
    await moverNaLista('favs', rec2.id, -1);
    r.lista.ordemDepois = (await AVDB.listIds('favs')).indexOf(rec2.id);
    await AVDB.listRemove('favs', rec2.id);
    await recarregarFavoritos();
    // E O VAZIO: uma frase só. Medido com a lista de favoritos esvaziada.
    const guardados = favItems.slice();
    favItems = [];
    const lista2 = document.createElement('ul');
    document.body.appendChild(lista2);
    favHost = lista2;
    try { renderFolderList(); } finally { favHost = null; }
    const vazio = lista2.querySelector('.empty');
    r.vazioTexto = vazio ? vazio.textContent.trim() : '';
    r.vazioUmaLinha = !!vazio && !vazio.querySelector('br')
      && /^Nenhum favorito ainda\.?$/.test(r.vazioTexto)
      && !lista2.querySelector('.import-row');
    lista2.remove();
    favItems = guardados;
    lista.remove();
    grupoAberto = ''; favAberto = false;
    await AVDB.listRemove('favs', rec.id);
    await recarregarFavoritos();
    return r;
  });
  await pg.evaluate(() => setAppMode(window.__modoBiblioteca || 'simple'));

  // ── O MODO FÁCIL NÃO MOSTRA FAVORITOS NEM "AO CRONOGRAMA" (v1.0.7) ───────
  //
  // Pedido do operador. A razão é a mesma nos dois: o Modo Fácil não tem aba nem
  // lista — o que se GUARDA ali não tem onde ser visto depois, e um destino
  // invisível é pior que um botão a menos.
  //
  // ESTE CASO EXISTE PORQUE A REMOÇÃO NÃO ERRA ALTO. Tudo continua funcionando
  // sem ela; o que volta, se alguém desfizer a guarda, é uma seção a mais numa
  // tela que existe para não ter seções — e nada na tela diria que voltou. Os
  // três blocos acima medem a PRESENÇA no avançado; este mede a AUSÊNCIA no
  // Modo Fácil, e é o par deles: um sozinho aprova a metade errada.
  const facil = await pg.evaluate(async () => {
    const antes = appMode;
    setAppMode('simple');
    const lista = document.createElement('ul');
    lista.className = 'hymnal-list';
    lista.style.width = '390px';
    document.body.appendChild(lista);
    renderCollectionsList(lista, () => {}, { semTotal: true });
    const nomes = [...lista.querySelectorAll('.coll-group-name')].map((e) => e.textContent.trim());
    const out = {
      secoes: nomes,
      temFavoritos: nomes.some((n) => /Favoritos/i.test(n)),
      // E O RESTO DA BIBLIOTECA CONTINUA INTEIRO: a guarda tira UMA seção, não
      // a lista. Sem esta metade, apagar a Biblioteca inteira passaria aqui.
      cards: lista.querySelectorAll('.hymnal-card').length,
    };
    lista.remove();
    // A folha do sorteio, em modo PLAYLIST — é só nele que o segundo desfecho
    // existe. `abrirSorteio` reescreve as prefs, então o modo é posto DEPOIS
    // dele e a folha é redesenhada.
    await abrirSorteio();
    sorteioPrefs.modo = AVSorteio.MODO_PLAYLIST;
    renderSorteio();
    out.acoes = [...document.querySelectorAll('#sorteioPopup .sorteio-acao')]
      .map((b) => b.textContent.trim());
    fecharSorteio();
    setAppMode(antes);
    return out;
  });
  checar(!facil.temFavoritos,
    'NO MODO FÁCIL a Biblioteca não desenha a seção de Favoritos',
    JSON.stringify(facil.secoes));
  checar(facil.cards > 0,
    'e o resto dela continua inteiro — a guarda tira UMA seção, não a lista',
    facil.cards + ' card(s)');
  checar(facil.acoes.length === 1 && !facil.acoes.some((t) => /cronograma/i.test(t)),
    'e a playlist automática perde o "Ao Cronograma": ali não há Cronograma para ver',
    JSON.stringify(facil.acoes));
  checar(favs.temItem,
    'OS FAVORITOS SÃO DESENHADOS DENTRO DA BIBLIOTECA, pelo mesmo '
    + '`renderFolderList` da gaveta');
  checar(favs.semLinhaDeDisco,
    'e a Biblioteca não tem mais rodapé de uso do disco — número que a medida '
    + 'não sustenta, disputando com o peso que os cabeçalhos já dizem');
  checar(favs.semGaveta,
    'e não sobrou nó nenhum da gaveta de tela cheia no documento (v5.294): a '
    + 'seção da Biblioteca é a ÚNICA casa desta lista');
  // ── UM BOTÃO, DUAS ORIGENS (v5.239) ────────────────────────────────────
  // Pedido do operador: as ações da seção vão para a BARRA dela, só com ícone,
  // e "Adicionar pasta" se unifica com "buscar no sistema" — um toque, e a
  // folha oferece criar uma pasta ou trazer uma do aparelho.
  //
  // As duas metades: o corpo da lista ficou LIMPO (nenhum botão de texto, e o
  // vazio é uma linha só) **e** as duas origens continuam alcançáveis. Sem a
  // segunda, apagar a linha do rodapé teria passado — e levado a sincronização
  // de pastas junto, sem nada na tela que a explicasse.
  checar(favs.semRodape && favs.semContagem,
    'a seção não tem mais rodapé de botões nem contador — o corpo é só a lista',
    JSON.stringify(favs.rodape) + ' · ' + JSON.stringify(favs.cabecalho));
  checar(favs.temAcaoNaBarra,
    'a ação mora na BARRA da seção, só com ícone', JSON.stringify(favs.cabecalho));
  checar(!favs.acao.abriuFolha && favs.acao.pediuPasta === 1,
    'e o toque nela TRAZ UMA PASTA DO APARELHO direto — sem folha, porque a '
    + 'outra origem (o atalho de pasta) deixou de existir', JSON.stringify(favs.acao));
  checar(/pasta do aparelho/i.test(favs.acao.titulo),
    'e o rótulo dela diz o que ela faz', favs.acao.titulo);
  checar(favs.lista.secoes === 0 && favs.lista.nomes.length === 2,
    'A LISTA DE FAVORITOS É ÚNICA: tipos diferentes juntos, sem subdivisão nenhuma',
    JSON.stringify(favs.lista.nomes));
  checar(favs.lista.pastaAntes === true,
    'AS PASTAS SINCRONIZADAS VÊM NO TOPO da lista de favoritos (v5.285) — no fim '
    + 'elas eram empurradas para longe por cada favorito novo',
    'pasta antes da placa: ' + favs.lista.pastaAntes);
  checar(favs.lista.ordem === favs.lista.nomes.length * 2,
    'e cada item tem o PAR ↑↓ de reordenar, DENTRO do menu `⋮` (v5.285)',
    favs.lista.ordem + ' botão(ões) para ' + favs.lista.nomes.length + ' item(ns)');
  checar(!!favs.lista.pontas && favs.lista.pontas.primeiro[0] === true
    && favs.lista.pontas.ultimo[1] === true
    && favs.lista.pontas.primeiro[1] === false && favs.lista.pontas.ultimo[0] === false,
    'e as PONTAS são inertes: o primeiro não sobe, o último não desce — e os '
    + 'outros dois continuam vivos', JSON.stringify(favs.lista.pontas));
  checar(favs.lista.semBotaoNaLinha,
    'e a faixa do nome ficou SEM BOTÃO NENHUM (v5.287): o `⋮` saiu com a faixa '
    + 'que ele abria, e o nome fica com a linha inteira');
  // ===== A GAVETA DA BIBLIOTECA NA LINHA DE FAVORITO (v5.287) =====
  checar(favs.gaveta.abriu && favs.gaveta.naoProjetou,
    'O TOQUE NA LINHA DE FAVORITO ABRE AS OPÇÕES e não projeta mais nada — '
    + 'a lista mora dentro da Biblioteca, e ali o toque prepara',
    JSON.stringify(favs.gaveta));
  checar(favs.gaveta.abaixo,
    'e a gaveta abre ABAIXO da faixa do nome, nunca por cima dele — era a '
    + 'sobreposição relatada, e ela some por construção quando o corpo da linha '
    + 'deixa de ter outra ação',
    'abaixo: ' + favs.gaveta.abaixo);
  // ===== "TOCAR AGORA" NASCE MARCADO (v1.1.8) =====
  //
  // Pedido do operador: *"nas opções de play, deixe que venha por padrão o check
  // de tocar agora, pois é a opção que normalmente já se tem mais urgência"*. O
  // que ela compra é o caso de DOIS destinos — tocar em "Adicionar ao
  // Cronograma" projeta E guarda no mesmo toque —, e o confirmar nascer ATIVO é
  // a outra metade: a gaveta abre respondível.
  //
  // A regra vale onde a mídia é LOCAL. A folha do YouTube fica de fora de
  // propósito (lá "Tocar agora" TRANSMITE), e é por isso que ela é afirmada
  // aqui, na lista de favoritos, e no `smoke` na gaveta da Biblioteca — as duas
  // casas que a recebem.
  checar(favs.gaveta.jaMarcadas === 1 && /Tocar agora/.test(favs.gaveta.rotuloMarcado),
    'a gaveta do FAVORITO abre com "Tocar agora" já marcado, e só ele',
    favs.gaveta.jaMarcadas + ' marcada(s): ' + JSON.stringify(favs.gaveta.rotuloMarcado));
  checar(favs.gaveta.confirmarNasceAtivo === true,
    'e o CONFIRMAR nasce ativo — sem um toque só para destravar o botão');
  checar(favs.gaveta.opcoes.length === 3
    && /Tocar agora/.test(favs.gaveta.opcoes[0])
    && favs.gaveta.marcaveis === 3
    && /Confirmar/.test(favs.gaveta.confirmar),
    'e são as MESMAS opções marcáveis da Biblioteca — telão, playlist e '
    + 'Cronograma —, com o confirmar sempre visível',
    JSON.stringify(favs.gaveta.opcoes) + ' · ' + favs.gaveta.confirmar);
  checar(favs.gaveta.confirmarAtivo && favs.gaveta.foiPraCrono,
    'e o confirmar FAZ o que diz: marcado o Cronograma, o item entra nele',
    JSON.stringify([favs.gaveta.confirmarAtivo, favs.gaveta.foiPraCrono]));
  checar(favs.gaveta.acoesNaGaveta,
    'e as ações da linha (↑↓, excluir) descem para a faixa de baixo da gaveta, '
    + 'em vez de cobrirem o título');
  checar(favs.gaveta.semEstrela,
    'e a linha de favorito tem UMA saída só (v5.288): a estrela saiu — aqui ela '
    + 'e a lixeira faziam a mesma coisa, e só a lixeira pergunta antes');

  // ===== A PASTA DO APARELHO ABRE INLINE, COMO UM ÁLBUM (v5.290) =====
  //
  // Pedido do operador: *"ajuste o sistema de pastas dos favoritos, para que ele
  // abra a lista de arquivos das pastas de forma visual sem ser um popup, para
  // que abra a lista assim como abrem os álbuns com seus itens"*.
  //
  // O caso mede as DUAS metades: a lista aparece no corpo da própria linha **e**
  // a gaveta de tela cheia não abre. Sem a segunda, desenhar a lista inline e
  // continuar abrindo o popup por cima passaria.
  const pasta = await pg.evaluate(async () => {
    // O MODO É RESTAURADO NO FIM: os casos seguintes medem o Modo Fácil (o
    // bloco de conexão e a cortina), e deixá-los com o avançado ligado os
    // reprovaria por um motivo que não é o deles. A Biblioteca só existe no
    // avançado — `renderSimpleGate` a fecha sem tela conectada.
    const modoAntes = appMode;
    setAppMode('full');
    for (const n of ['B video.mp4', 'A audio.mp3']) {
      await AVDB.fileAdd({ id: 'fx-' + n, name: n, type: 'audio/mpeg', kind: 'audio',
        folder: 'pasta-inline', opfsPath: 'folders/pasta-inline/' + n, size: 4, mtime: 1 });
    }
    await AVDB.setState('opfs-folders', [{ id: 'pasta-inline', name: 'Vídeos do culto', count: 2 }]);
    await load();
    window.__bibliotecaComFavoritos();
    await new Promise((r) => setTimeout(r, 400));
    const corpo = document.querySelector('[data-fav-corpo]');
    const li = corpo && corpo.querySelector('.folder-opfs');
    if (!li) return { erro: 'a pasta não foi desenhada na Biblioteca' };
    const fechada = li.querySelectorAll('.folder-itens .lib-item').length;
    li.querySelector('.row').click();
    await new Promise((r) => setTimeout(r, 450));
    const r = {
      fechada,
      aberta: li.classList.contains('expanded'),
      // ORDENADA POR NOME: a do disco é a de gravação, e não diz nada a quem
      // está montando um culto.
      nomes: [...li.querySelectorAll('.folder-itens > .lib-item .row-name')]
        .map((e) => e.textContent),
      // A METADE QUE IMPORTA: nenhuma gaveta de tela cheia entrou em cena, e a
      // Biblioteca continua aberta por baixo. Desde a v5.294 a gaveta não existe
      // mais no documento — a asserção passa a ser sobre isso, que é a forma
      // mais forte da mesma pergunta.
      popup: !!document.getElementById('favPopup'),
      biblioteca: hymnSearchPopupEl.classList.contains('open'),
    };
    // E cada arquivo abre as MESMAS opções do resto da Biblioteca — com
    // "Favoritar", que numa linha de favorito não existe (lá o item já é um), e
    // SEM excluir nem reordenar: a ordem vem do disco, e apagar aqui seria
    // apagar o arquivo, que tem dono próprio na linha da pasta.
    // NULL-SAFE de propósito: com o comportamento ANTIGO (o popup) não existe
    // `.folder-itens`, e uma exceção aqui abortaria o caso inteiro — as outras
    // asserções sumiriam com ela, e o que sobraria seria "terminou com erro" em
    // vez de "a lista não abriu inline". A lição da v5.245.
    const arq = li.querySelector('.folder-itens > .lib-item');
    if (arq) {
      arq.querySelector('.row').click();
      await new Promise((res) => setTimeout(res, 400));
      r.opcoes = [...arq.querySelectorAll('.hymn-opcoes .song-menu-sel .song-menu-label')]
        .map((e) => e.textContent);
      r.semExcluir = !arq.querySelector('.row-excluir') && !arq.querySelector('.row-ordem');
    } else {
      r.opcoes = []; r.semExcluir = false;
    }
    // E FECHAR é o mesmo toque que abriu.
    li.querySelector('.row').click();
    await new Promise((res) => setTimeout(res, 450));
    r.fechouDeNovo = !li.classList.contains('expanded');
    // (A limpeza mora no bloco seguinte — ele continua nesta mesma tela.)
    window.__modoAntes = modoAntes;
    return r;
  });
  checar(!pasta.erro && pasta.aberta && pasta.popup === false && pasta.biblioteca === true,
    'A PASTA DO APARELHO ABRE INLINE (v5.290): a lista entra no corpo da própria '
    + 'linha, e nenhuma gaveta de tela cheia sobe por cima da Biblioteca',
    JSON.stringify(pasta));
  checar(!pasta.erro && pasta.fechada === 0 && pasta.nomes.length === 2
    && pasta.nomes[0] === 'A audio.mp3',
    'e o corpo só é montado ao ABRIR (fechada não desenha arquivo nenhum), em '
    + 'ordem de NOME', JSON.stringify([pasta.fechada, pasta.nomes]));
  checar(!pasta.erro && pasta.opcoes.length === 4
    && pasta.opcoes[pasta.opcoes.length - 1] === 'Favoritar' && pasta.semExcluir,
    'e cada arquivo abre as MESMAS opções da Biblioteca — com "Favoritar", que é '
    + 'o caminho de promovê-lo, e sem excluir nem reordenar',
    JSON.stringify(pasta.opcoes));
  checar(!pasta.erro && pasta.fechouDeNovo,
    'e o mesmo toque fecha — é o acordeão do álbum, com a mesma gramática');

  // ===== O ANINHAMENTO: uma `.lib-item` dentro de outra (v5.291) =====
  //
  // Relato do operador sobre a v5.290, com prints: *"há diversos bugs, como o
  // posicionamento incorreto do design dos itens da pasta. além de ter novamente
  // o efeito incorreto de encolhimento inteiro do grupo ao tocar em itens
  // individuais. também temos uma falha, que não permite fechar as opções de
  // play dos itens."*
  //
  // As três têm UMA causa: `.folder-opfs` é o primeiro `.lib-item` deste app que
  // CONTÉM outros `.lib-item`, e todo seletor descendente keyado em `.lib-item`
  // vazava para dentro. O caso mede as quatro consequências separadamente —
  // uma regra `>` esquecida reprova só a sua.
  const nin = await pg.evaluate(async () => {
    const li = document.querySelector('[data-fav-corpo] .folder-opfs');
    // GARANTE ABERTA, e não "clica uma vez": um toque que dependa do estado que
    // o caso anterior deixou mede a pasta FECHADA metade das vezes — e com ela
    // fechada as gavetas dos arquivos estão escondidas de qualquer jeito, isto
    // é, a asserção passaria sem medir nada.
    if (!li.classList.contains('expanded')) {
      li.querySelector('.row').click();
      await new Promise((r) => setTimeout(r, 500));
    }
    const itens = [...li.querySelectorAll('.folder-itens > .lib-item')];
    // E GARANTE OS ARQUIVOS FECHADOS, pela MESMA razão da linha acima: a
    // afirmação é sobre a gaveta de um item FECHADO, e herdar do caso anterior
    // um arquivo aberto a faz medir outra coisa — passando ou reprovando
    // conforme a ordem em que os blocos rodaram.
    for (const x of itens) {
      if (!x.classList.contains('expanded')) continue;
      x.querySelector('.row').click();
      await new Promise((r) => setTimeout(r, 450));
    }
    const alt = (el) => Math.round(el.getBoundingClientRect().height);
    const r = {
      // 1. A GAVETA DE UM ITEM FECHADO NÃO APARECE. Era a faixa preta embaixo de
      //    cada arquivo: `.lib-item.expanded .hymn-gaveta` é descendente, e a
      //    PASTA aberta satisfazia o `.expanded`.
      fechadas: itens.map((x) => ({
        exp: x.classList.contains('expanded'),
        disp: getComputedStyle(x.querySelector('.hymn-gaveta')).display,
        h: alt(x.querySelector('.hymn-gaveta')),
      })),
    };
    // (O ALINHAMENTO é medido no bloco final, com o DOM assentado: aqui o corpo
    // da pasta ainda está sendo remontado por uma promessa.)
    const m = await AVDB.addMedia(new Blob([new Uint8Array(4)], { type: 'audio/mpeg' }),
      { name: 'Louvor favorito', type: 'audio/mpeg', kind: 'audio', list: 'favs' });
    window.__favTmp = m.id;
    await recarregarFavoritos();
    return r;
  });
  // 2. O ENCOLHIMENTO: pressão de VERDADE, porque `:active` não se simula com
  //    classe — o que se mede é o `transform` computado da PASTA enquanto o
  //    dedo está sobre um arquivo dela.
  const pressPasta = await (async () => {
    // `recarregarFavoritos` redesenha a seção e o corpo da pasta é remontado por
    // uma promessa (`montarCorpo`): esperar o NÓ, e não um prazo, é o que faz o
    // caso medir em vez de correr contra o relógio.
    await pg.evaluate(async () => {
      const li = document.querySelector('[data-fav-corpo] .folder-opfs');
      if (li && !li.classList.contains('expanded')) {
        li.querySelector('.row').click();
        await new Promise((r) => setTimeout(r, 500));
      }
    });
    await pg.waitForFunction(
      () => !!document.querySelector('[data-fav-corpo] .folder-opfs .folder-itens > .lib-item'),
      null, { timeout: 8000 });
    const pt = await pg.evaluate(() => {
      const a = document.querySelector('[data-fav-corpo] .folder-opfs .folder-itens > .lib-item');
      a.scrollIntoView({ block: 'center' });
      const r2 = a.querySelector('.row').getBoundingClientRect();
      return { x: Math.round(r2.left + r2.width / 2), y: Math.round(r2.top + r2.height / 2) };
    });
    await pg.mouse.move(pt.x, pt.y);
    await pg.mouse.down();
    const dur = await pg.evaluate(() => ({
      pasta: getComputedStyle(document.querySelector('[data-fav-corpo] .folder-opfs')).transform,
      item: getComputedStyle(document.querySelector('[data-fav-corpo] .folder-opfs .folder-itens > .lib-item')).transform,
    }));
    await pg.mouse.up();
    await pg.waitForTimeout(500);
    return dur;
  })();
  // 3. FECHAR AS OPÇÕES: o segundo toque tem de ESCONDER, e não só tirar a
  //    classe — era a pasta que as mantinha visíveis.
  const fechou = await pg.evaluate(async () => {
    const a = document.querySelector('[data-fav-corpo] .folder-opfs .folder-itens > .lib-item');
    const toque = async () => {
      a.querySelector('.row').click();
      await new Promise((r) => setTimeout(r, 500));
    };
    // Parte de FECHADO, sem supor nada: a pressão do bloco anterior é um clique
    // completo, e ela pode ter deixado a gaveta aberta.
    if (a.classList.contains('expanded')) await toque();
    await toque();
    const g = a.querySelector('.hymn-gaveta');
    const abriu = a.classList.contains('expanded')
      && g.getBoundingClientRect().height > 10;
    await toque();
    const r = {
      abriu,
      classe: a.classList.contains('expanded'),
      disp: getComputedStyle(g).display,
      h: Math.round(g.getBoundingClientRect().height),
    };
    // 4. O ALINHAMENTO, agora com tudo assentado: o arquivo da pasta ocupa a
    //    MESMA coluna do favorito logo abaixo. Ele começava colado na borda do
    //    cartão da pasta, com a miniatura na coluna da miniatura DA PASTA.
    const corpo = document.querySelector('[data-fav-corpo]');
    const fav = corpo.querySelector('.fav-itens > .lib-item');
    const cx = (e) => (e ? Math.round(e.getBoundingClientRect().left) : null);
    r.colunas = [cx(a), cx(fav)];
    r.alinhado = !!fav && cx(a) === cx(fav)
      && cx(a.querySelector('.thumb')) === cx(fav.querySelector('.thumb'));
    // Limpeza: a tela volta como estava, para os casos do Modo Fácil que vêm
    // depois não reprovarem por um motivo que não é o deles.
    pastaAberta = null;
    if (window.__favTmp) { await AVDB.listRemove('favs', window.__favTmp); delete window.__favTmp; }
    for (const n of ['B video.mp4', 'A audio.mp3']) await AVDB.fileDelete('fx-' + n);
    await AVDB.setState('opfs-folders', []);
    closeHymnSearch();
    setAppMode(window.__modoAntes);
    await load();
    await new Promise((res) => setTimeout(res, 250));
    return r;
  });
  checar(nin.fechadas.length > 1
    && nin.fechadas.every((x) => !x.exp && x.disp === 'none' && x.h === 0),
    'A GAVETA DE UM ARQUIVO FECHADO NÃO APARECE com a pasta aberta (v5.291) — a '
    + 'faixa preta embaixo de cada item era `.lib-item.expanded .hymn-gaveta` '
    + 'casando com a PASTA, que também é uma `.lib-item`',
    JSON.stringify(nin.fechadas));
  checar(pressPasta.pasta === 'none' && pressPasta.item !== 'none',
    'e pressionar um arquivo NÃO encolhe a pasta inteira — quem responde ao '
    + 'toque é a peça tocada', JSON.stringify(pressPasta));
  checar(fechou.abriu && !fechou.classe && fechou.disp === 'none' && fechou.h === 0,
    'e o segundo toque FECHA as opções de verdade: era a pasta que as mantinha '
    + 'visíveis, então tirar a classe do item não escondia nada',
    JSON.stringify(fechou));
  checar(fechou.alinhado,
    'e o arquivo da pasta ocupa a MESMA coluna do favorito abaixo — ele começava '
    + 'colado na borda do cartão, com a miniatura na coluna da própria pasta',
    JSON.stringify(fechou.colunas));

  // ===== A SEÇÃO NÃO FICA PARA TRÁS DO BANCO (v5.292) =====
  //
  // Relato do operador: *"verifique a atualização da lista de favoritos em
  // relação a excluir itens comuns e a excluir pastas, que não desaparecem
  // apenas fechando e reabrindo a biblioteca"*.
  //
  // `deleteOpfsFolder` e `syncDeviceFolder` terminam em `load()` — o funil onde
  // `favItems`/`favSet`/`opfsFolders` são reaplicados —, e `load()` redesenhava
  // o Cronograma e mais nada. A seção da Biblioteca é desenhada por
  // `renderFolderList` com `favHost`, que ele nunca chamava.
  //
  // O caso mede as DUAS metades, e a segunda é a que impede o conserto de virar
  // um redesenho incondicional: excluir a pasta tira da tela a pasta E o
  // favorito que ela levava junto (`purgeCatalogRecords` mexe em `favs`), **e**
  // uma gaveta ABERTA sobrevive a um `load()` que não mudou a seção — mandar um
  // item ao Cronograma chama `load()`, e refazer a seção ali a fecharia debaixo
  // do dedo.
  const stale = await pg.evaluate(async () => {
    // O MODO É LIDO ANTES de trocar: os casos seguintes medem o Modo Fácil, e
    // restaurar 'full' os reprovaria por um motivo que não é o deles.
    const modoAntes = appMode;
    setAppMode('full');
    await AVDB.fileAdd({ id: 'fw1', name: 'W.mp3', type: 'audio/mpeg', kind: 'audio',
      folder: 'pw1', opfsPath: 'folders/pw1/W.mp3', size: 4, mtime: 1 });
    await AVDB.listAdd('favs', 'fw1');
    const solto = await AVDB.addMedia(new Blob([new Uint8Array(4)], { type: 'audio/mpeg' }),
      { name: 'Favorito solto', type: 'audio/mpeg', kind: 'audio', list: 'favs' });
    await AVDB.setState('opfs-folders', [{ id: 'pw1', name: 'Pasta W', count: 1 }]);
    await load();
    window.__bibliotecaComFavoritos();
    await new Promise((r) => setTimeout(r, 450));
    const corpo = () => document.querySelector('[data-fav-corpo]');
    const nomes = () => [...corpo().querySelectorAll('.fav-itens > .lib-item .row-name')]
      .map((e) => e.textContent);
    const pastas = () => [...corpo().querySelectorAll('.folder-opfs .row-name')]
      .map((e) => e.textContent);
    const antes = { itens: nomes(), pastas: pastas() };
    // ---- excluir a PASTA, pelo botão da linha e pelo diálogo de verdade ----
    corpo().querySelector('.folder-opfs .row-btn:last-child').click();
    await new Promise((r) => setTimeout(r, 250));
    document.getElementById('appDialogOk').click();
    await new Promise((r) => setTimeout(r, 900));
    const depois = {
      itens: nomes(), pastas: pastas(),
      noEstado: ((await AVDB.getState('opfs-folders')) || []).length,
      noBanco: (await AVDB.listIds('favs')).length,
    };
    // ---- e a METADE NEGATIVA, medida no `load()` DIRETO ----
    // Ela é o que impede o conserto de virar um redesenho incondicional. O
    // `load()` é chamado por dezenas de caminhos com a Biblioteca aberta (uma
    // sincronização que termina, o coletor de lixo, uma troca de aba por baixo),
    // e refazer a seção em todos eles fecharia a gaveta que o operador acabou de
    // abrir. Medido no `load()` CRU e não por um caminho de UI: um caminho que
    // não chegue a chamá-lo mediria outra coisa — e foi assim que a primeira
    // versão desta asserção passou sem exercitar nada.
    const alvo = [...corpo().querySelectorAll('.fav-itens > .lib-item')]
      .find((x) => x.querySelector('.row-name').textContent === 'Favorito solto');
    alvo.querySelector('.row').click();
    await new Promise((r) => setTimeout(r, 450));
    const abriu = alvo.classList.contains('expanded');
    await load();
    await new Promise((r) => setTimeout(r, 300));
    const gaveta = {
      abriu,
      continuaAberta: !!document.querySelector('[data-fav-corpo] .fav-itens > .lib-item.expanded'),
      // E o `load()` de fato passou pela seção: sem esta metade, um `load()`
      // que devolvesse cedo por outro motivo faria a asserção passar de graça.
      foi: !!corpo().querySelector('.fav-itens > .lib-item'),
    };
    // limpeza
    await AVDB.listRemove('favs', solto.id);
    await AVDB.setState('opfs-folders', []);
    closeHymnSearch();
    setAppMode(modoAntes);
    await load();
    await new Promise((r) => setTimeout(r, 250));
    return { antes, depois, gaveta };
  });
  checar(stale.antes.pastas.length === 1 && stale.antes.itens.length === 2,
    'o fixture da seção tem a pasta e os dois favoritos na tela',
    JSON.stringify(stale.antes));
  checar(stale.depois.pastas.length === 0 && stale.depois.noEstado === 0,
    'EXCLUIR UMA PASTA A TIRA DA TELA NA HORA (v5.292) — ela só sumia fechando e '
    + 'reabrindo a Biblioteca, porque `load()` redesenhava o Cronograma e não a '
    + 'seção de Favoritos', JSON.stringify(stale.depois));
  checar(stale.depois.itens.length === 1 && stale.depois.noBanco === 1,
    'e o FAVORITO que ela levava junto sai com ela — `purgeCatalogRecords` mexe '
    + 'em `favs`, e a tela tem de dizer o mesmo que o banco',
    JSON.stringify(stale.depois.itens));
  checar(stale.gaveta.abriu && stale.gaveta.continuaAberta && stale.gaveta.foi,
    'mas uma gaveta ABERTA sobrevive a um `load()` que não mudou a seção — um '
    + 'redesenho incondicional a fecharia debaixo do dedo, e `load()` roda por '
    + 'dezenas de caminhos com a Biblioteca aberta', JSON.stringify(stale.gaveta));
  checar(favs.lista.subs === favs.lista.nomes.length,
    'e o subtítulo voltou a aparecer: sem cabeçalho de tipo, é ele que distingue');
  checar(favs.lista.ordemDepois === 0,
    'e o botão MOVE de verdade — uma casa, na lista de verdade');
  checar(!!favs.lista.parar && favs.lista.parar.naThumb && favs.lista.parar.visivel,
    'UM FAVORITO NO AR também oferece o "Tirar do ar", na capa (v5.259) — aqui ele '
    + 'nem existia', JSON.stringify(favs.lista.parar));
  // (A asserção da FAIXA OPACA viveu aqui da v5.259 à v5.286: a `.row-acoes`
  // cobria o título, e com a linha no ar o `--linha` dela tinha alfa — o nome
  // aparecia por trás dos botões. Ela saiu na v5.287 com a faixa: nesta lista
  // não há mais nada por cima do título para ser opaco.)
  // ── OS FAVORITOS SE ATUALIZAM COM A BIBLIOTECA ABERTA (v5.258) ─────────
  //
  // Relato do operador: *"se estou na biblioteca e adiciono algo aos favoritos,
  // ele só aparece na lista após fechar e abrir novamente."* Ele estava certo, e
  // a causa é que os favoritos têm DUAS casas desde a v5.237: quem redesenhava
  // depois de favoritar era o `renderLibrary` — a lista de baixo —, e a seção
  // dentro da Biblioteca é desenhada por `renderSearchResults`, que ninguém
  // chamava. O estado estava em dia; a tela é que não.
  //
  // O teste usa a tela DE VERDADE (o popup aberto), e não um `<ul>` de mentira:
  // o defeito era exatamente a distância entre o estado e aquela tela.
  const favVivo = await pg.evaluate(async () => {
    // NO MODO AVANÇADO, e isto não é cerimônia: no Modo Fácil sem tela
    // conectada o `renderSimpleGate` FECHA a Biblioteca (a cortina a esconde),
    // e a enquete do espelho o chama sozinha durante a espera do pulso. O caso
    // passava por sorte de relógio — e é a mesma armadilha da v5.236: medir uma
    // tela no modo em que ela não vive.
    const modoAntes = appMode;
    setAppMode('full');
    window.__bibliotecaComFavoritos();
    await new Promise((r) => setTimeout(r, 250));
    const secao = () => document.querySelector('#hymnResults [data-fav-corpo]');
    const antes = !!secao() && /Favorito ao vivo/.test(secao().textContent);
    const rec = await AVDB.addMedia(new Blob(['z'], { type: 'audio/mpeg' }),
      { name: 'Favorito ao vivo', list: 'avulsos' });
    // Pelo MESMO caminho do operador: a estrela de uma linha.
    await toggleFav(rec.id, 'Favorito ao vivo', null);
    await new Promise((r) => setTimeout(r, 1400));   // o pulso, e o redesenho depois dele
    const depois = !!secao() && /Favorito ao vivo/.test(secao().textContent);
    // A ROLAGEM não pode ter sido zerada: redesenhar a Biblioteca inteira
    // jogaria o operador de volta ao topo, que é pior que o defeito.
    const lista = document.getElementById('hymnResults');
    lista.scrollTop = 40;
    const rolagemAntes = lista.scrollTop;
    await recarregarFavoritos();
    const rolagemDepois = lista.scrollTop;
    await AVDB.listRemove('favs', rec.id);
    await recarregarFavoritos();
    closeHymnSearch();
    setAppMode(modoAntes);   // o modo é global: deixá-lo trocado quebra os casos seguintes
    return { antes, depois, rolagemAntes, rolagemDepois };
  });
  checar(!favVivo.antes && favVivo.depois,
    'FAVORITAR COM A BIBLIOTECA ABERTA já mostra o item na seção — sem fechar e reabrir',
    JSON.stringify(favVivo));
  checar(favVivo.rolagemAntes === 0 || favVivo.rolagemDepois === favVivo.rolagemAntes,
    'e o redesenho é da SEÇÃO, não da Biblioteca inteira: a rolagem não volta ao topo',
    JSON.stringify(favVivo));

  // ── O VÃO É UM PISO, E A SEÇÃO CRESCE ALÉM DELE (v5.273 → v5.282) ──────
  //
  // Pedido do operador: *"não tenha mais o sistema de ver mais. Agora quando
  // aberta ela mostra toda a listagem"* e *"mantenha o tamanho mínimo dela,
  // mesmo vazia, como o tamanho flexível que ocupa o que sobra das outras
  // coleções… mas agora esse é apenas o tamanho mínimo, que cresce conforme a
  // lista dos favoritos requerir mais que esse espaço disponível"*.
  //
  // Isto REVOGA o caso do botão "Ver todos" (v5.273/v5.276), que media a régua
  // do recorte — quantos itens ficavam de fora da caixa. Não há mais recorte, e
  // é isso que as DUAS metades afirmam, porque nenhuma basta sozinha: com a
  // lista vazia a seção ainda RESERVA o vão (senão a Biblioteca abriria com as
  // coleções coladas no topo, que é o desenho que o operador mandou manter), e
  // com a lista cheia ela PASSA dele sem cortar um item.
  //
  // A medição é na Biblioteca DE VERDADE: o vão é uma consequência de a lista
  // ter altura finita, e num `<ul>` solto no `<body>` não há vão nenhum.
  const vao = await pg.evaluate(async () => {
    const modoAntes = appMode;
    setAppMode('full');
    window.__bibliotecaComFavoritos();
    await new Promise((r) => setTimeout(r, 250));
    // A BIBLIOTECA DO OPERADOR, e a fidelidade aqui é o caso inteiro: são OITO
    // seções nos prints dele, e é isso que torna o vão pequeno o bastante para
    // uma lista de favoritos passar dele. Num fixture com duas seções sobra
    // tela à vontade, a lista nunca alcança o piso, e a metade que importa
    // deste caso seria verdadeira por vacuidade.
    albumCatalog.categories = ['CDs oficiais/ano', 'Adoradores', 'Cantores',
      'Celebra SP', 'Diversas', 'Especiais'].map((nome, i) => ({
      name: nome,
      albums: [{ id_album: 500 + i, name: 'Álbum ' + nome }],
    }));
    albumCatalog.albums = albumCatalog.categories.map((c) => c.albums[0]);
    const corpo = () => document.querySelector('#hymnResults [data-fav-corpo]');
    const secao = () => {
      const c = corpo();
      return c ? c.parentElement : null;
    };
    // O PISO, lido de onde o JS o escreve — a custom property da lista. Comparar
    // a altura contra ele é o que separa "cresceu" de "está grande": um número
    // fixo aqui dependeria da altura da tela do runner.
    const piso = () => parseFloat(
      getComputedStyle(hymnResultsEl).getPropertyValue('--fav-vao')) || 0;
    // ITENS FORA DA CAIXA do corpo. Era a régua do botão; agora é a afirmação
    // de que NADA fica de fora, em nenhum tamanho de lista. `.empty` é a linha
    // de "Nenhum favorito ainda" e não é um item.
    const deFora = () => {
      const c = corpo();
      if (!c) return -1;
      const caixa = c.getBoundingClientRect();
      return [...c.children].filter((el) => {
        if (el.classList.contains('empty')) return false;
        const b = el.getBoundingClientRect();
        return b.bottom > caixa.bottom + 1 || b.top < caixa.top - 1;
      }).length;
    };
    const ler = () => ({
      piso: piso(),
      altura: secao() ? secao().getBoundingClientRect().height : 0,
      deFora: deFora(),
      // O BOTÃO não pode existir em estado nenhum (v5.282).
      temBotao: !!document.querySelector('#hymnResults .coll-group-mais'),
    });
    // A LISTA É ZERADA ANTES (v5.232: `renderCollectionsList` ACRESCENTA). O
    // `openHymnSearch()` acima já desenhou uma vez, com o catálogo VAZIO —
    // sem zerar, a Biblioteca ficava com Favoritos e as coleções fixas em
    // DUPLICATA, e o vão media uma tela que não existe.
    hymnResultsEl.innerHTML = '';
    renderCollectionsList(hymnResultsEl, () => {}, { semTotal: true });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const vazio = {
      ...ler(),
      // QUANTOS BLOCOS a tela tem, e não quantas seções (v1.0.1): é isto que
      // prova que a medição aconteceu na condição do relato, com o vão pequeno.
      // As coleções fixas subiram para a RAIZ e ocupam a lista lado a lado com
      // as seções — contar só `.coll-group--drop` deixaria de fora quatro
      // blocos que apertam o vão exatamente como uma seção fechada aperta.
      blocos: hymnResultsEl.children.length,
    };
    // Favoritos que passam de qualquer tela de celular.
    const ids = [];
    for (let i = 1; i <= 30; i++) {
      const r = await AVDB.addMedia(new Blob(['v' + i], { type: 'audio/mpeg' }),
        { name: 'Favorito de lote ' + i, list: 'favs' });
      ids.push(r.id);
    }
    await recarregarFavoritos();
    // A medição do vão é adiada um quadro de propósito (ver
    // `acertarVaoDosFavoritos`), então a leitura espera dois.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const muitos = {
      ...ler(),
      // E a BIBLIOTECA passa a rolar: a seção que cresceu empurra as fechadas
      // para baixo, que é o que qualquer outra seção aberta já faz. Sem isto,
      // uma seção que crescesse para fora da tela sem a lista rolar passaria.
      rola: hymnResultsEl.scrollHeight > hymnResultsEl.clientHeight + 1,
      // O corpo continua sem rolagem PRÓPRIA (o `overflow: hidden` de que a
      // animação de abertura depende). O operador recusou o scroll interno na
      // v5.280, e a régua é o `overflow-y` COMPUTADO: uma caixa `hidden`
      // continua rolando por SCRIPT, então medir `scrollTop` aprovaria os dois
      // estados — quem não rola aqui é o DEDO.
      overflow: corpo() ? getComputedStyle(corpo()).overflowY : 'AUSENTE',
    };
    albumCatalog.categories = []; albumCatalog.albums = [];
    for (const id of ids) await AVDB.listRemove('favs', id);
    await recarregarFavoritos();
    closeHymnSearch();
    setAppMode(modoAntes);
    return { vazio, muitos };
  });
  checar(vao.vazio.blocos >= 8,
    'a Biblioteca do caso tem os OITO blocos do relato — é o que torna o vão '
    + 'pequeno e a lista de favoritos capaz de passar dele',
    vao.vazio.blocos + ' bloco(s)');
  // A PRIMEIRA METADE: vazia, ela RESERVA o vão. É o desenho de abertura da
  // Biblioteca — coleções empilhadas na base, o que sobra em cima é dos
  // favoritos — e é o que o operador mandou manter.
  checar(vao.vazio.piso > 0 && Math.abs(vao.vazio.altura - vao.vazio.piso) <= 2,
    'sem favorito NENHUM a seção ainda ocupa o vão que sobra das outras: o piso '
    + 'é o tamanho dela (' + Math.round(vao.vazio.altura) + 'px para um vão de '
    + Math.round(vao.vazio.piso) + 'px)');
  // A SEGUNDA: cheia, ela PASSA do vão. Sem ela, um `height` fixo de volta
  // passaria na de cima.
  checar(vao.muitos.altura > vao.muitos.piso + 2,
    'e com mais favoritos do que cabe nele ela CRESCE além do piso — o vão é um '
    + 'mínimo, não uma altura (' + Math.round(vao.muitos.altura) + 'px para um '
    + 'vão de ' + Math.round(vao.muitos.piso) + 'px)');
  checar(vao.muitos.deFora === 0 && vao.vazio.deFora === 0,
    'e a lista inteira aparece: nenhum item fica cortado fora da caixa, em '
    + 'tamanho de lista nenhum',
    'de fora: ' + vao.vazio.deFora + ' (vazia) / ' + vao.muitos.deFora + ' (cheia)');
  checar(vao.muitos.rola,
    'quem rola é a BIBLIOTECA, como em qualquer outra seção aberta');
  checar(!vao.vazio.temBotao && !vao.muitos.temBotao,
    'e não há mais "Ver todos" em estado nenhum: aberta, a seção mostra toda a '
    + 'listagem');
  checar(vao.muitos.overflow === 'hidden',
    'o corpo continua sem rolagem própria — não há um segundo caminho para o '
    + 'fim da lista',
    'overflow-y ' + vao.muitos.overflow);

  // ── A BIBLIOTECA ABRE COM A LISTA NO TOPO (v5.280) ─────────────────────
  //
  // Decisão do operador: *"ao invés de ter um scroll de tela inteira, deixar
  // apenas os itens abaixo da barra de pesquisa ficarem dentro de um scroll, e
  // apenas rolar esse scroll para o topo quando a biblioteca é aberta"*.
  //
  // A rolagem sempre foi só da lista; o que faltava é o reset. `#hymnResults` é
  // o MESMO nó entre uma abertura e a seguinte, então ele guardava a posição da
  // vez anterior e a Biblioteca reabria no meio de um hinário.
  const noTopo = await pg.evaluate(async () => {
    const modoAntes = appMode;
    setAppMode('full');
    openHymnSearch();
    await new Promise((r) => setTimeout(r, 250));
    // Conteúdo que dê o que rolar, e uma rolagem de verdade.
    albumCatalog.categories = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n, i) => ({
      name: 'Categoria ' + n,
      albums: [{ id_album: 900 + i, name: 'Álbum ' + n }],
    }));
    albumCatalog.albums = albumCatalog.categories.map((c) => c.albums[0]);
    // E uma COLEÇÃO ABERTA: com tudo colapsado a lista nunca transborda (o vão
    // dos favoritos é justamente o que sobra), então não haveria rolagem a
    // afirmar — é uma propriedade do desenho, não um detalhe do fixture.
    //
    // QUEM ABRE É UM CARD DA RAIZ (v1.0.1): o grupo "Hinários" não existe mais
    // — as coleções fixas são cards da lista —, e `grupoAberto` com o nome de
    // uma seção que ninguém desenha não abre coisa nenhuma. Sem isso a lista
    // cabia inteira, `scrollTop` ficava em 0 dos dois lados e o caso passava a
    // comparar dois zeros, isto é, deixava de medir o reset.
    const hin = allCollections().find((x) => x.kind === 'hymnal');
    const songs = [];
    for (let i = 1; i <= 40; i++) {
      songs.push({ id_music: 't' + i, name: 'Hino de rolagem ' + i, track: i,
        has_instrumental_music: false, duration: '3:47' });
    }
    collState[hin.id] = { indexSyncedAt: Date.now(), songs, isHymnal: true };
    ui(hin.id).expanded = true; ui(hin.id).shown = 100;
    renderSearchResults('');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    hymnResultsEl.scrollTop = hymnResultsEl.scrollHeight;
    const rolou = hymnResultsEl.scrollTop;
    closeHymnSearch();
    openHymnSearch();
    await new Promise((r) => setTimeout(r, 250));
    const aoReabrir = hymnResultsEl.scrollTop;
    albumCatalog.categories = []; albumCatalog.albums = [];
    delete collState[hin.id]; ui(hin.id).expanded = false;
    grupoAberto = ''; favAberto = false;
    closeHymnSearch();
    setAppMode(modoAntes);
    return { rolou, aoReabrir };
  });
  checar(noTopo.rolou > 0 && noTopo.aoReabrir === 0,
    'A BIBLIOTECA REABRE COM A LISTA NO TOPO — ela guardava a rolagem da vez '
    + 'anterior e voltava no meio de um hinário',
    'rolou ' + Math.round(noTopo.rolou) + 'px, reabriu em ' + noTopo.aoReabrir);

  // ── A COLEÇÃO ABRE PARA BAIXO, ALINHADA PELO TOPO (v5.277) ─────────────
  //
  // Pedido do operador: *"as coleções estão abrindo estendendo para cima, mas
  // elas devem sempre abrir para baixo e rolar/alinhar a tela sempre com o
  // início da lista da coleção, alinhando com o topo dela"*.
  //
  // São DUAS metades, e a segunda é a que o relato descreve: o topo da seção
  // aberta encosta no topo da área visível (a lista rolou até ele), **e** os
  // favoritos não mudaram de tamanho — era o encolhimento deles que fazia o
  // conteúdo subir e a coleção parecer crescer para cima.
  const alinhado = await pg.evaluate(async () => {
    const modoAntes = appMode;
    setAppMode('full');
    openHymnSearch();
    await new Promise((r) => setTimeout(r, 250));
    // As oito seções do relato outra vez: sem elas a lista cabe inteira na tela
    // e não há rolagem nenhuma a afirmar.
    albumCatalog.categories = ['CDs oficiais/ano', 'Adoradores', 'Cantores',
      'Celebra SP', 'Diversas', 'Especiais'].map((nome, i) => ({
      name: nome,
      albums: [{ id_album: 700 + i, name: 'Álbum ' + nome }],
    }));
    albumCatalog.albums = albumCatalog.categories.map((c) => c.albums[0]);
    // Os Favoritos ABERTOS são cenário deste caso (o padrão da v1.1.4 é
    // fechado): a segunda metade da asserção é que a ALTURA deles não muda ao
    // abrir uma coleção, e uma seção fechada não tem altura a comparar.
    grupoAberto = ''; favAberto = true;
    hymnResultsEl.innerHTML = '';   // `renderCollectionsList` ACRESCENTA (v5.232)
    renderCollectionsList(hymnResultsEl, () => renderSearchResults(''), { semTotal: true });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const secao = (nome) => [...hymnResultsEl.children]
      .find((n) => n.dataset && n.dataset.grupo === nome);
    const altFavAntes = secao('Favoritos').getBoundingClientRect().height;
    // A ÚLTIMA seção da lista: é a que mais precisa da rolagem, porque abrir
    // uma coleção lá embaixo cresce para fora da tela.
    const alvo = 'Especiais';
    const barra = secao(alvo).querySelector('.coll-group-bar');
    const desvioAntes = secao(alvo).getBoundingClientRect().top
      - (hymnResultsEl.getBoundingClientRect().top
        + parseFloat(getComputedStyle(hymnResultsEl).paddingTop || 0));
    barra.click();
    // A rolagem é suave: a leitura espera ela assentar.
    await new Promise((r) => setTimeout(r, 700));
    const el = secao(alvo);
    const topoLista = hymnResultsEl.getBoundingClientRect().top
      + parseFloat(getComputedStyle(hymnResultsEl).paddingTop || 0);
    const r = {
      desvio: el.getBoundingClientRect().top - topoLista,
      desvioAntes,
      rolou: hymnResultsEl.scrollTop,
      // O quanto a lista PODE rolar: quando a seção aberta é a última e o que
      // ela abre é curto, não há conteúdo abaixo para levá-la até o topo — e
      // rolar até o fim é o mais perto que existe.
      maximo: hymnResultsEl.scrollHeight - hymnResultsEl.clientHeight,
      altFavAntes,
      altFavDepois: secao('Favoritos').getBoundingClientRect().height,
    };
    albumCatalog.categories = []; albumCatalog.albums = [];
    grupoAberto = ''; favAberto = false;
    closeHymnSearch();
    setAppMode(modoAntes);
    return r;
  });
  // A REGRA tem dois desfechos possíveis, e os dois são o mesmo pedido: o topo
  // da seção encosta no topo da lista, OU a lista rolou até o fim tentando —
  // quando a seção aberta é a última e o que ela abre é curto, não existe
  // conteúdo abaixo que a leve mais para cima. O que não pode acontecer é a
  // lista ficar parada, que era o estado anterior a este lote.
  checar(alinhado.rolou > 0 && alinhado.desvio < alinhado.desvioAntes
    && (Math.abs(alinhado.desvio) <= 2 || alinhado.rolou >= alinhado.maximo - 1),
    'ABRIR UMA COLEÇÃO rola a lista até o topo dela — ela abre para baixo e a '
    + 'tela vai ao início dos itens',
    'rolou ' + Math.round(alinhado.rolou) + 'px de ' + Math.round(alinhado.maximo)
    + ' possíveis; o topo subiu ' + Math.round(alinhado.desvioAntes - alinhado.desvio) + 'px');
  checar(Math.abs(alinhado.altFavDepois - alinhado.altFavAntes) <= 1,
    'e a seção dos Favoritos não muda de tamanho por causa disso — era o '
    + 'encolhimento dela que fazia a coleção parecer crescer para cima',
    Math.round(alinhado.altFavAntes) + 'px → ' + Math.round(alinhado.altFavDepois) + 'px');

  // ── A MIGRAÇÃO DOS ATALHOS DE PASTA (v5.254) ───────────────────────────
  //
  // Esta é a asserção que impede o lote de virar PERDA DE MÍDIA. Um item cujo
  // único detentor era um atalho vira, no instante em que o atalho some, um
  // registro que nenhuma lista aponta — e o coletor de lixo (que existe
  // justamente para isso) o apaga na varredura seguinte. Um vídeo grande
  // sumiria do app e do disco sem nada na tela que o explicasse.
  //
  // O caso reproduz o aparelho do operador: um atalho com um item que NÃO está
  // nos favoritos, e outro que já está (para provar que ele não é duplicado).
  const mig = await pg.evaluate(async () => {
    const so = await AVDB.addMedia(new Blob(['a'], { type: 'audio/mpeg' }),
      { name: 'Só no atalho', list: 'avulsos' });
    const jaFav = await AVDB.addMedia(new Blob(['b'], { type: 'audio/mpeg' }),
      { name: 'No atalho e nos favoritos', list: 'favs' });
    await AVDB.setState('folders', [{ id: 'p1', name: 'Louvores especiais' }]);
    await AVDB.listSet('folder_p1', [so.id, jaFav.id]);
    await migrarPastasParaFavoritos();
    const favsIds = await AVDB.listIds('favs');
    return {
      migrou: favsIds.includes(so.id),
      // O blob SOBREVIVEU: é o que o `folderDrop` teria apagado se a ordem das
      // duas metades estivesse invertida.
      temBytes: !!(await AVDB.getMedia(so.id)),
      // Sem duplicar quem já estava lá.
      vezes: favsIds.filter((x) => x === jaFav.id).length,
      // E o atalho não existe mais, nem o índice dele.
      semPastas: (((await AVDB.getState('folders')) || []).length) === 0,
      semIndice: (await AVDB.listIds('folder_p1')).length === 0,
      // Idempotente: rodar de novo não faz nada e não explode.
      denovo: await (async () => { await migrarPastasParaFavoritos(); return true; })(),
    };
  });
  checar(mig.migrou && mig.temBytes,
    'A MIGRAÇÃO leva o conteúdo do atalho para os favoritos — e a mídia SOBREVIVE '
    + '(sem isso, o gc apagaria o que ficasse sem dono)', JSON.stringify(mig));
  checar(mig.vezes === 1, 'e não duplica o que já estava favoritado');
  checar(mig.semPastas && mig.semIndice, 'e o atalho sai do banco, com o índice dele');
  checar(mig.denovo, 'e rodar de novo é um no-op (ela roda em toda abertura)');

  checar(favs.vazioUmaLinha,
    'e a lista vazia diz uma frase só — "Nenhum favorito ainda"',
    JSON.stringify(favs.vazioTexto));

  // ── "ONLINE": A QUALIDADE QUE NÃO BAIXA (v5.249) ───────────────────────
  // Pedido do operador: uma qualidade "Online" que, mesmo levando ao Cronograma,
  // guarda só o LINK em vez de obrigar o download.
  //
  // As duas metades: ela está no MESMO seletor das resoluções (é a mesma
  // pergunta, com "nada" na ponta da escala) **e** o item que ela guarda é o
  // link — sem bytes, sem download. Sem a segunda, acrescentar o rótulo teria
  // passado.
  const online = await pg.evaluate(async () => {
    // O modo é GLOBAL: deixá-lo trocado quebra os casos seguintes (a lição que
    // este arquivo já aprendeu duas vezes).
    const modoAntes = document.body.classList.contains('mode-simple') ? 'simple' : 'full';
    setAppMode('full');
    const r = { id: 'zzzzzzzzzz9', url: 'https://www.youtube.com/watch?v=zzzzzzzzzz9',
      name: 'Louvor de teste' };
    openYtMenu(r);
    const pop = document.getElementById('songMenuPopup');
    const segs = [...pop.querySelectorAll('.song-menu-seg')].map((s) =>
      [...s.querySelectorAll('button')].map((b) => b.textContent.trim()));
    const qualidade = segs.find((g) => g.some((t) => /1080p/.test(t))) || [];
    // Escolhe "Online" e mede o que a folha passa a dizer.
    const btnOnline = [...pop.querySelectorAll('.song-menu-seg button')]
      .find((b) => /^Online$/.test(b.textContent.trim()));
    btnOnline.click();
    const depois = {
      subs: [...pop.querySelectorAll('.song-menu-sub')].map((e) => e.textContent.trim()),
      // Com Online não há forma a escolher: a faixa Vídeo × Só áudio sai.
      temForma: [...pop.querySelectorAll('.song-menu-seg button')].some((b) => /Só áudio/.test(b.textContent)),
    };
    // E o CRONOGRAMA guarda o link. Desde a v5.252 a linha MARCA e quem executa
    // é o confirmar — a folha virou uma lista de opções com um botão só.
    const linha = [...pop.querySelectorAll('.song-menu-btn')]
      .find((b) => /Adicionar ao Cronograma/.test(b.textContent));
    linha.click();
    pop.querySelector('.song-menu-go').click();
    for (let i = 0; i < 60; i++) {
      const it = await AVDB.listItems('imports');
      const achou = it.find((x) => x.youtubeId === 'zzzzzzzzzz9');
      if (achou) {
        await AVDB.listRemove('imports', achou.id);
        setAppMode(modoAntes);
        return { qualidade, depois,
          guardou: { kind: achou.kind, temBlob: !!achou.blob, url: achou.url } };
      }
      await new Promise((res) => setTimeout(res, 50));
    }
    closeSongMenu();
    setAppMode(modoAntes);
    return { qualidade, depois, guardou: null };
  });
  checar(online.qualidade[0] === 'Online' && online.qualidade.includes('1080p'),
    '"ONLINE" é o primeiro degrau do MESMO seletor de qualidade',
    JSON.stringify(online.qualidade));
  checar(!online.depois.temForma,
    'e com ela escolhida a forma (Vídeo × Só áudio) sai — nada é baixado, então '
    + 'a escolha não mudaria coisa nenhuma');
  checar(online.depois.subs.some((t) => /só o link/i.test(t)),
    'os destinos que GUARDAM dizem o que mudou: "Só o link, sem baixar"',
    JSON.stringify(online.depois.subs));
  checar(!!online.guardou && online.guardou.kind === 'youtube' && !online.guardou.temBlob,
    'e o Cronograma recebe o LINK, sem bytes — era isto que obrigava o download',
    JSON.stringify(online.guardou));

  // ── A FILA DE LETRAS NÃO PERGUNTA POR UM VÍDEO (v5.236) ────────────────
  // `syncLyrics` varria TODA coleção com itens e pedia `music_<id>` ao LouvorJA
  // — e num episódio de série esse id é do YOUTUBE, uma pergunta que aquele
  // banco não tem como responder. Falha de rede não grava `LYRIC_NONE` de
  // propósito, então as ~52 requisições de cada série voltavam a cada abertura
  // do app, para sempre, e ainda entravam no total da notificação "Letras das
  // músicas". Nada disso aparece em lugar nenhum: é um `catch` vazio numa
  // tarefa de segundo plano.
  const letras = await pg.evaluate(async () => {
    const pedidos = [];
    const antes = Louvorja.fetchList;
    Louvorja.fetchList = (nome) => { pedidos.push(nome); return Promise.reject(new Error('sem rede')); };
    // O arranque pode ter deixado uma passada em voo; sem soltar a trava, a
    // chamada abaixo voltaria na hora e o caso mediria zero por não ter rodado.
    lyricSyncRunning = false;
    try { await syncLyrics(); } catch (_) { /* o que interessa é o que ela PEDIU */ }
    Louvorja.fetchList = antes;
    const ids = new Set(collSongs(
      (allCollections().find((x) => x.kind === 'serie') || {}).id).map((s) => s.id_music));
    return { pedidos, deVideo: pedidos.filter((n) => ids.has(String(n).replace(/^music_/, ''))) };
  });
  checar(letras.deVideo.length === 0,
    'a fila de letras NÃO pede letra ao LouvorJA para os vídeos da série',
    JSON.stringify(letras.pedidos.slice(0, 5)));

  // ── AS OPÇÕES DO ÁLBUM SÃO UMA LINHA SÓ (v5.233) ───────────────────────
  // ===== O DESTAQUE DO SÁBADO, NO TOPO DA LISTA DA SÉRIE (v1.1.21) =====
  //
  // Pedido do operador: *"um sistema de destaque que colocasse separado
  // destacado no topo da lista o item referente ao sábado atual; caso não
  // tenha, deixe uma mensagem de Aguardando lançamento"*.
  //
  // **A SÉRIE É SINTÉTICA, e isso é o que impede este caso de medir o RELÓGIO
  // DO RUNNER.** O catálogo tem o ano fixo (2026) e `diasAte` compara contra
  // ele: num runner de outro ano NENHUM episódio cairia na semana corrente, e o
  // caso reprovaria o app por uma data de calendário. Aqui o `ano` da série é o
  // ano de hoje, e a data do episódio vem de `AVSerie.sabadoDaSemana()` — a
  // função do APP, nunca uma segunda escrita da regra dentro do teste.
  //
  // As metades:
  //  1. o episódio do sábado aparece no bloco de destaque;
  //  2. e SAI da lista — deixá-lo nos dois lugares daria duas linhas que fazem
  //     a mesma coisa, e a de baixo, no meio de cinquenta irmãs, é a que o
  //     operador tocaria por engano procurando outra data;
  //  3. sem ele, "Aguardando lançamento" — e o cabeçalho continua dizendo de
  //     QUE sábado se trata, senão a frase valeria para qualquer semana;
  //  4. e um ÁLBUM não recebe destaque nenhum.
  const dest = await pg.evaluate(() => {
    const ID = 'serie-destaque-teste';
    const coll = { id: ID, kind: 'serie', name: 'Série de teste',
      serie: { ano: new Date().getFullYear(), futuros: AVSerie.FUTUROS_MOSTRAR } };
    const sab = AVSerie.sabadoDaSemana();
    const faixa = (nome, data) => ({ id_music: 'e' + nome, name: nome, duration: '20:00',
      has_instrumental_music: false, fileIdFull: null, fileIdPlayback: null,
      ytUrl: 'https://youtu.be/' + nome, serieData: data });
    // Duas datas BEM longe do sábado desta semana, em qualquer direção.
    const longe = (n) => {
      const d = new Date(sab.ano, sab.mes - 1, sab.dia + n);
      return { mes: d.getMonth() + 1, dia: d.getDate() };
    };
    const ler = (bloco) => ({
      existe: !!bloco,
      rotulo: bloco ? ((bloco.querySelector('.serie-destaque-rot') || {}).textContent || '') : null,
      data: bloco ? ((bloco.querySelector('.serie-destaque-data') || {}).textContent || '') : null,
      linhas: bloco ? bloco.querySelectorAll('.hymn-result').length : -1,
      texto: bloco ? bloco.textContent : '',
      vazio: bloco ? ((bloco.querySelector('.serie-destaque-vazio') || {}).textContent || '') : '',
    });
    const r = {};
    // (1) e (2): COM o episódio do sábado.
    collState[ID] = { songs: [
      faixa('Anterior', longe(-14)), faixa('DoSabado', { mes: sab.mes, dia: sab.dia }),
      faixa('Seguinte', longe(14)),
    ] };
    r.com = ler(blocoDestaque(coll));
    r.comData = AVSerie.rotuloData(sab);
    r.listaCom = faixasDaLista(coll).map((x) => x.name);
    // (3): SEM ele.
    collState[ID] = { songs: [faixa('Anterior', longe(-14)), faixa('Seguinte', longe(14))] };
    r.sem = ler(blocoDestaque(coll));
    r.listaSem = faixasDaLista(coll).map((x) => x.name);
    // (4): um ÁLBUM não tem destaque.
    r.album = blocoDestaque({ id: ID, kind: 'album', name: 'Álbum de teste' }) === null;
    delete collState[ID];
    return r;
  });
  checar(dest.com.existe && dest.com.linhas === 1 && /DoSabado/.test(dest.com.texto),
    'o episódio DESTE SÁBADO aparece no bloco de destaque, no topo da lista',
    JSON.stringify(dest.com.linhas));
  checar(dest.com.rotulo === 'Este sábado' && dest.com.data === dest.comData,
    'e o cabeçalho diz de QUE sábado se trata (' + dest.com.data + ')',
    JSON.stringify([dest.com.rotulo, dest.com.data, dest.comData]));
  checar(dest.listaCom.length === 2 && !dest.listaCom.includes('DoSabado'),
    'e ele SAI da lista — "separado" é literal: duas linhas que fazem a mesma '
    + 'coisa, a dois centímetros uma da outra, é a de baixo que o operador toca '
    + 'por engano', JSON.stringify(dest.listaCom));
  checar(dest.sem.existe && dest.sem.linhas === 0
    && /Aguardando lançamento/.test(dest.sem.vazio),
    'sem o episódio da semana, o bloco diz "Aguardando lançamento" — sem ele, um '
    + 'card sem o vídeo do sábado fica indistinguível de um que não carregou',
    JSON.stringify(dest.sem));
  checar(dest.sem.data === dest.comData,
    'e continua nomeando o sábado: a frase sozinha valeria para qualquer semana');
  checar(dest.listaSem.length === 2,
    'e a lista fica inteira quando não há o que separar dela',
    JSON.stringify(dest.listaSem));
  checar(dest.album,
    'um ÁLBUM não recebe destaque nenhum: isto é recurso do CALENDÁRIO de uma '
    + 'série semanal, não do acervo');

  // ===== A VERIFICAÇÃO DE ÁLBUM VIRA AUTOMÁTICA (v1.1.16) =====
  //
  // Pedido do operador: *"agora a verificação é feita de forma automática, no
  // segundo plano toda vez que o app abre… sem efeito de peso significativo de
  // processamento, para não ser notado, e se tiver alguma diferença ele mostra
  // o botão de download"*.
  //
  // O botão "Verificar" saiu, e com ele a única porta manual para pular o TTL
  // de 12 h. Se `forcarIndice` não escolher o que deve, **nada na tela diz
  // isso**: o álbum cresceu na origem, o aparelho continua achando que está
  // completo, e o botão de baixar simplesmente não aparece — pelo tempo que o
  // TTL levar. Não há erro, não há log, não há sintoma.
  //
  // As QUATRO metades, e as duas últimas são as caras:
  //
  //  1. o álbum COM DOWNLOAD e índice FRESCO é relido assim mesmo — é isso que
  //     o botão fazia;
  //  2. o álbum SEM download não é: a conta é proporcional ao que o operador
  //     guardou, nunca ao catálogo inteiro;
  //  3. na RETOMADA nada é forçado de novo. Esta função roda a cada
  //     `visibilitychange`, e o operador troca de app dezenas de vezes num
  //     culto: sem o `indicesForcados`, "toda vez que o app abre" viraria uma
  //     rajada de requisições a cada volta — que é exatamente o "peso
  //     significativo" que o pedido exclui;
  //  4. a SÉRIE fica de fora mesmo com o índice fresco: o índice dela custa uma
  //     extração do canal do YouTube, não um GET de JSON.
  //
  // O espião é instalado sobre a GLOBAL: o `controle.js` é script clássico, e a
  // chamada sem qualificador resolve pela mesma propriedade.
  const auto = await pg.evaluate(async () => {
    const guardado = {};
    // DOIS ÁLBUNS semeados no catálogo: eles vêm do `pt_categories`, e este
    // oráculo roda sem rede externa (`semRedeExterna`), então o catálogo está
    // vazio. Restaurados no `finally`.
    const catAntes = albumCatalog.categories;
    const albAntes = albumCatalog.albums;
    albumCatalog.categories = [{ name: 'Exemplos', albums: [
      { id_album: 901, name: 'Álbum com download' },
      { id_album: 902, name: 'Álbum sem download' },
    ] }];
    albumCatalog.albums = albumCatalog.categories[0].albums;
    const albuns = allCollections().filter((c) => c.kind === 'album');
    const serie = allCollections().find((c) => c.kind === 'serie');
    if (albuns.length < 2 || !serie) {
      albumCatalog.categories = catAntes; albumCatalog.albums = albAntes;
      return { insuficiente: true, albuns: albuns.length, serie: !!serie };
    }
    const [comDl, semDl] = albuns;
    const agora = Date.now();
    const faixa = (baixada) => ({ id_music: 'x1', track: 1, name: 'Faixa', duration: '3:00',
      has_instrumental_music: false, fileIdFull: baixada ? 'f1' : null, fileIdPlayback: null });
    // ÍNDICE FRESCO nos três: é dentro do TTL que a pergunta existe. Vencido,
    // todos entrariam pela regra antiga e o caso não mediria nada.
    for (const c of [comDl, semDl, serie]) guardado[c.id] = collState[c.id];
    collState[comDl.id] = { indexSyncedAt: agora, songs: [faixa(true)] };
    collState[semDl.id] = { indexSyncedAt: agora, songs: [faixa(false)] };
    collState[serie.id] = { indexSyncedAt: agora, songs: [faixa(true)],
      serieDiarioEm: agora, serieDiaEm: serieDiaLocal(new Date(agora)) };
    // O espião. `fetchCollectionIndex` é o que custa rede; devolver na hora
    // mantém o oráculo determinístico.
    const orig = window.fetchCollectionIndex;
    const vistos = [];
    window.fetchCollectionIndex = (c) => { vistos.push(c.id); return Promise.resolve(); };
    // E o resto do que a função faz não interessa aqui — só a ESCOLHA.
    const origCat = window.fetchAlbumCatalog; window.fetchAlbumCatalog = () => Promise.resolve();
    const origLet = window.syncLyrics; window.syncLyrics = () => Promise.resolve();
    try {
      indicesForcados.clear();
      await autoRefreshCollections();
      const abertura = vistos.slice();
      vistos.length = 0;
      // A RETOMADA: a mesma função, o mesmo estado, tudo ainda fresco.
      await autoRefreshCollections();
      return {
        comDl: comDl.id, semDl: semDl.id, serie: serie.id,
        aberturaTemComDl: abertura.includes(comDl.id),
        aberturaTemSemDl: abertura.includes(semDl.id),
        aberturaTemSerie: abertura.includes(serie.id),
        retomadaTemComDl: vistos.includes(comDl.id),
      };
    } finally {
      window.fetchCollectionIndex = orig;
      window.fetchAlbumCatalog = origCat;
      window.syncLyrics = origLet;
      for (const id of Object.keys(guardado)) {
        if (guardado[id]) collState[id] = guardado[id]; else delete collState[id];
      }
      indicesForcados.clear();
      albumCatalog.categories = catAntes;
      albumCatalog.albums = albAntes;
    }
  });
  if (auto.insuficiente) {
    checar(false, 'o cenário da verificação automática tem dois álbuns e uma série',
      JSON.stringify(auto));
  } else {
    checar(auto.aberturaTemComDl,
      'NA ABERTURA, o álbum COM DOWNLOAD é relido mesmo com o índice fresco — é o '
      + 'que o botão "Verificar" fazia, e é o que faz o botão de BAIXAR aparecer '
      + 'quando o catálogo cresce');
    checar(!auto.aberturaTemSemDl,
      'e o álbum SEM download não é: a conta é proporcional ao que o operador '
      + 'guardou, nunca ao catálogo inteiro');
    checar(!auto.aberturaTemSerie,
      'a SÉRIE fica de fora mesmo fresca — o índice dela custa uma extração do '
      + 'canal do YouTube, e é por isso que ela mantém o botão "Atualizar a lista"');
    checar(!auto.retomadaTemComDl,
      'e NA RETOMADA nada é forçado de novo: esta função roda a cada '
      + '`visibilitychange`, e sem o `indicesForcados` cada volta ao app seria uma '
      + 'rajada de requisições na Wi-Fi da igreja');
  }

  // E o bloco de conexão do Modo Fácil, que é o caminho que a v5.195 quebrou:
  // com shell >= 32 ele mostra as DUAS formas de conectar, não só o espelhar.
  const conn = await pg.evaluate(() => {
    const c = document.getElementById('castConn');
    const rede = document.getElementById('castNetBtn');
    const sm = document.getElementById('simpleMode');
    const busca = document.getElementById('simpleSearchBtn');
    const bb = busca && busca.getBoundingClientRect();
    return {
      achou: !!c,
      pai: c && c.parentElement ? (c.parentElement.id || c.parentElement.className) : '',
      redeVisivel: !!rede && !rede.hidden,
      semTela: sm.classList.contains('sem-tela'),
      // O BLOQUEIO, medido pelo que o operador vê e não por uma classe: a
      // cortina está no ar e cobre a tela inteira, e a busca — que ela esconde —
      // não está desenhada. (A v5.199 afirmava aqui exatamente o contrário; ver
      // o comentário de `renderSimpleGate` sobre por que ela caiu e voltou.)
      cortinaNoAr: (() => {
        const v = document.getElementById('simpleVeil');
        if (!v || v.hidden) return false;
        const r = v.getBoundingClientRect();
        return r.width >= innerWidth - 1 && r.height >= innerHeight - 1;
      })(),
      buscaVisivel: !!bb && bb.width > 2 && bb.height > 2,
    };
  });
  checar(conn.achou && conn.semTela && conn.pai === 'simpleConn',
    'sem tela, o bloco de conexão é o que fica legível (pai: ' + conn.pai + ')');
  checar(conn.redeVisivel,
    'e ele oferece as DUAS formas — espelhar para a TV e transmitir para navegador');
  // E COM A TRANSMISSÃO DESLIGADA o botão dela nomeia o DESTINO (v5.224). O par
  // deste caso está na página de baixo, com a transmissão no ar.
  const redeOff = await pg.evaluate(() => ({
    ligado: document.getElementById('castNetBtn').classList.contains('ligado'),
    rotulo: document.getElementById('castNetLabel').textContent,
  }));
  // O rótulo nomeia o APARELHO de destino (v1.3.10) — ele já disse "pela rede"
  // e "para navegador", e o que a asserção guarda é a PROPRIEDADE, não a
  // palavra: desligada, a chamada diz PARA ONDE isto vai, e não o que ela faz.
  checar(!redeOff.ligado && /computador/i.test(redeOff.rotulo),
    'desligada, a transmissão é a chamada preenchida e diz para onde vai ("'
    + redeOff.rotulo + '")');
  // O BLOQUEIO (v5.203, de volta a pedido do operador). Sem tela este modo não
  // projeta nada — nem imagem nem som —, e a cortina é o que diz isso.
  checar(conn.cortinaNoAr && !conn.buscaVisivel,
    'SEM TELA A TELA FICA BLOQUEADA: a cortina cobre tudo e a busca sai de cena');

  // ---- SEM TELA NENHUMA, O SOM SAI DESTE APARELHO (v5.215) --------------
  //
  // A regra vive num ramo que o `smoke.mjs` não alcança: sem ponte não há
  // `lastDisplays` nem transmissão, e é a CONEXÃO que decide. O que se mede é o
  // efeito, não a variável sozinha — `pvVideo.muted` é o que o alto-falante
  // obedece, e é ele que a `setForceMuted` acerta.
  //
  // O segundo caso é o portão de MODO: voltar ao Modo Fácil emudece, porque lá
  // sem tela a cortina já cobre tudo (o caso acima) e som atrás dela seria a
  // única coisa acontecendo. Ele também devolve o `localStorage` ao
  // simplificado — é dele que a página seguinte parte.
  const somSemTela = await pg.evaluate(() => {
    const v = document.getElementById('pvVideo');
    setAppMode('full');
    const avancado = { local: somLocal, mudo: v.muted };
    setAppMode('simple');
    const facil = { local: somLocal, mudo: v.muted };
    return { avancado, facil };
  });
  checar(somSemTela.avancado.local && !somSemTela.avancado.mudo,
    'NO AVANÇADO SEM TELA a preview deixa de ser muda — o som é deste aparelho');
  checar(!somSemTela.facil.local && somSemTela.facil.mudo,
    'e no Modo Fácil ela volta a ser muda (lá a cortina cobre tudo)');

  // ---- A PREVIEW QUE É A PROJEÇÃO NÃO PODE SER SUSPENSA (v1.3.12) --------
  //
  // Sem tela conectada quem toca é o `<video>` da preview, no WebView do
  // Controle — e o Chromium pausa o `<video>` de uma página oculta. Com o app
  // minimizado o louvor calava, que foi o relato do operador. O shell responde
  // ligando neste WebView a proteção que o telão já tem, e quem lhe diz quando
  // é o lado web: `AVNative.projecaoLocal`.
  //
  // O QUE SE MEDE É O QUE O APP DIZ, não o efeito: um WebView que não é
  // suspenso não existe num navegador, e afirmar o efeito seria afirmar o
  // arnês. O stub grava as chamadas.
  //
  // A PERGUNTA TEM DUAS METADES, e as três asserções cobrem as três
  // combinações que importam. A segunda é a que impede a proteção de virar
  // permanente: ligada sem cena, ela custa um renderer que nunca desacelera
  // num aparelho que não está projetando nada.
  const proj = await pg.evaluate(() => {
    const ler = () => (window.__projLocal.length ? window.__projLocal[window.__projLocal.length - 1] : null);
    setAppMode('full');
    // O CENÁRIO É MONTADO, não herdado: as metades anteriores deste arquivo já
    // projetaram coisas, e `currentId` sobrevive de propósito ao Parar. `cena0`
    // vai junto no resultado para o oráculo não afirmar sobre um cenário que
    // não conseguiu montar.
    const salvo = { id: currentId, msg: msgSession, bib: bibleSession };
    currentId = null; msgSession = null; bibleSession = null;
    const cena0 = cenaNoAr();
    acertarProjecaoLocal();
    const semCena = ler();
    // COM CENA, pelo caminho de verdade: `currentId` é o que o veredito lê.
    currentId = 'uma-midia-qualquer';
    acertarProjecaoLocal();
    const comCena = ler();
    currentId = salvo.id; msgSession = salvo.msg; bibleSession = salvo.bib;
    return { semCena, comCena, cena0 };
  });
  checar(proj.comCena === true,
    'SEM TELA E COM CENA o app pede a proteção da preview — é ela que projeta', proj);
  checar(proj.cena0 === false && proj.semCena === false,
    'e sem cena ele NÃO pede: a proteção ligada à toa é um renderer que nunca '
    + 'desacelera num aparelho que não está projetando nada', proj);

  // ---- E A OUTRA METADE DA REGRA: uma tela ENTRANDO fecha a folha (v5.193) --
  //
  // O par do caso de baixo, e o que impede a correção da v5.217 de virar "a
  // folha nunca mais fecha sozinha": quem acabou de conectar terminou o que
  // veio fazer ali. A tela entra num turno só, com a folha já aberta — é a
  // BORDA que a regra sempre quis descrever.
  const fechaAoEntrar = await pg.evaluate(() => {
    setAppMode('full');
    abrirCast();
    const abriu = document.getElementById('castPopup').classList.contains('open');
    mirrorEstado = { ligado: true, telas: [{ rotulo: 'tela B', pronta: true }] };
    renderSimpleGate();
    const fechou = !document.getElementById('castPopup').classList.contains('open');
    mirrorEstado = null;
    fecharCast();
    setAppMode('simple');   // devolve o `localStorage` — a página seguinte parte daqui
    return { abriu, fechou };
  });
  checar(fechaAoEntrar.abriu && fechaAoEntrar.fechou,
    'uma tela ENTRANDO com a folha aberta continua fechando-a (a borda, não o nível)');

  // ---- O ESTADO EM QUE O OPERADOR DE FATO OPERA -------------------------
  //
  // Transmissão LIGADA, telas na rede recebendo, e NENHUMA TV. É a
  // configuração normal desta igreja desde a v5.187 (sem TV, as telas da rede
  // SÃO a projeção) — e é uma combinação que o primeiro percurso não cobre: lá
  // o espelho nasce desligado, então metade do `renderCast`, o
  // `acertarEnqueteDeFundo` e o caminho DESTRAVADO do Modo Fácil nunca correm.
  //
  // Uma página NOVA, e não um `mirrorEstado = …` na de cima: o que se quer
  // provar é que o bundle SOBE assim, com o estado presente desde o primeiro
  // instante — que é como o aparelho o encontra ao abrir com a transmissão já
  // no ar. Mexer no estado de uma página já de pé provaria outra coisa.
  const pg2 = await ctx.newPage();
  const erros2 = [];
  pg2.on('pageerror', (e) => erros2.push('pageerror: ' + e.message));
  pg2.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros2.push(t);
  });
  await pg2.addInitScript(ponteCom(
    { ligado: true, endereco: 'http://192.168.0.14:8787',
      telas: [{ rotulo: 'tela A', conectadaMs: 90000, pronta: true }] },
    [],
  ));
  await pg2.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  let deuPe2 = false;
  try {
    await pg2.waitForFunction(
      () => window.AVDB && window.AVStream && window.createStage
        && typeof window.__avBack === 'function'
        && !!document.querySelector('#playlist li'),
      null, { timeout: 25000 },
    );
    deuPe2 = true;
  } catch (_) { deuPe2 = false; }
  checar(deuPe2, 'O APP FICA DE PÉ com a transmissão JÁ LIGADA e telas na rede');

  // E A LEITURA DA TRANSMISSÃO É ESPERADA, não presumida. `espelhoEstado()` é
  // uma Promise da ponte, lida pela ENQUETE (`lerEspelho`): até ela responder,
  // `mirrorEstado` é nulo, `telasDaRede()` devolve vazio e o app está — com toda
  // a razão — no estado SEM TELA. Tudo o que esta página afirma daqui para
  // baixo lê o que essa leitura produz, e sem esperá-la o oráculo media quem
  // chegou primeiro.
  // MEDIDO: as duas reprovaram juntas na 1ª rodada de uma campanha com a máquina
  // a 2× de carga, e nas duas o app estava certo — o oráculo é que perguntou
  // cedo demais.
  //
  // Espera-se pela INGESTÃO (`mirrorEstado` com a tela dentro), nunca pela
  // resposta derivada (`algumaTelaConectada()`): esperar pelo que se vai afirmar
  // é escrever uma tautologia. O que vem depois de `mirrorEstado = e` em
  // `lerEspelho` — `acertarSaidaDeAudio`, `renderSimpleGate` e os demais — é
  // síncrono, então observá-lo já garante que a tela e o som decidiram.
  await pg2.waitForFunction(
    () => !!mirrorEstado && Array.isArray(mirrorEstado.telas) && mirrorEstado.telas.length > 0,
    null, { timeout: 25000 },
  );

  // E a célula da preview tem de ser a PREVIEW, não a conexão: sem TV, as telas
  // da rede são a projeção (v5.193), então há tela e não há o que conectar.
  const comTela = await pg2.evaluate(() => ({
    semTela: document.getElementById('simpleMode').classList.contains('sem-tela'),
    connEscondido: document.getElementById('simpleConn').hidden,
    cortinaNoAr: !document.getElementById('simpleVeil').hidden,
    modo: appMode,
  }));
  checar(!comTela.semTela && comTela.connEscondido && !comTela.cortinaNoAr,
    'e a tela DESTRAVA: sem TV, as telas da rede contam como tela');

  // E O SOM CONTINUA SENDO DAS TELAS (v5.215). É a metade que protege o
  // desfecho que a mesa de som produzia: cada tela da rede toca o próprio
  // arquivo no `<video>` dela, e um celular somando a própria saída seria o
  // mesmo louvor duas vezes na sala — fora do compasso, porque são dois
  // decodificadores. Vale mesmo no modo avançado, que é onde o som local
  // existe.
  const somComTela = await pg2.evaluate(() => {
    const v = document.getElementById('pvVideo');
    setAppMode('full');
    return { local: somLocal, mudo: v.muted, tela: algumaTelaConectada() };
  });
  checar(somComTela.tela && !somComTela.local && somComTela.mudo,
    'COM TELA DA REDE RECEBENDO este aparelho fica mudo, inclusive no avançado');

  // E A TERCEIRA COMBINAÇÃO: com tela no ar a proteção fica DESLIGADA, mesmo
  // com cena. Ali o Controle é a mesa de comando, o som está lá fora, e ser
  // estrangulado em segundo plano é o comportamento CERTO — é o que o
  // `snoopDisplayStatus` da ponte existe para contornar. Sem esta metade a
  // correção seria "nunca mais economizar bateria", que é outro defeito.
  const projComTela = await pg2.evaluate(() => {
    setAppMode('full');
    const salvo = currentId;
    currentId = 'uma-midia-qualquer';
    acertarProjecaoLocal();
    const r = window.__projLocal.length ? window.__projLocal[window.__projLocal.length - 1] : null;
    currentId = salvo;
    return { ultimo: r, tela: algumaTelaConectada() };
  });
  checar(projComTela.tela && projComTela.ultimo !== true,
    'COM TELA NO AR a proteção da preview fica DESLIGADA, mesmo com cena — ali '
    + 'o Controle é a mesa de comando, e ser estrangulado é o certo', projComTela);

  // ---- A FOLHA DE CONEXÃO ABRE COM TELA JÁ CONECTADA (v5.217) -----------
  //
  // O relato: com o ícone de cast no estado CONECTADO (vermelho), tocar nele
  // não abria nada. Ele abria — e a folha se fechava sozinha em milissegundos,
  // porque o fecho automático da v5.193 era um teste de NÍVEL ("há tela?") e
  // não de BORDA ("uma tela entrou?"). O próprio `abrirCast` liga a enquete,
  // a enquete chama `renderSimpleGate`, e o nível é verdadeiro o tempo todo
  // enquanto houver tela.
  //
  // A espera é maior que um ciclo da enquete (`MIRROR_POLL_MS` = 2,5 s) de
  // propósito: o defeito precisa de uma leitura do estado para se manifestar,
  // e afirmar "abriu" no instante do clique passaria com ele no lugar.
  // O clique e a leitura no MESMO turno: entre dois `evaluate` cabe o
  // `setTimeout(0)` com que a ponte de mentira resolve o `espelhoEstado`, e a
  // primeira metade do defeito passaria a depender de quem ganha essa corrida.
  const abriuNaHora = await pg2.evaluate(() => {
    document.getElementById('pvCastBtn').click();
    return document.getElementById('castPopup').classList.contains('open');
  });
  await pg2.waitForTimeout(3200);
  const continuaAberta = await pg2.evaluate(() => ({
    aberta: document.getElementById('castPopup').classList.contains('open'),
    conectado: document.getElementById('pvCastBtn').classList.contains('connected'),
  }));
  checar(abriuNaHora, 'o toque no ícone de cast ABRE a folha de conexão');
  checar(continuaAberta.conectado && continuaAberta.aberta,
    'e ela CONTINUA aberta com tela conectada — a enquete não a fecha sozinha');

  // ---- LIGADA, A TRANSMISSÃO É O BOTÃO VERMELHO DE DESLIGAR (v5.224) -----
  //
  // O par do caso da página de cima, e o único lugar em que ele pode ser
  // medido: aqui a ponte responde `ligado: true`, então é o `renderCast` — e
  // não uma classe posta à mão pelo teste — quem pinta o botão e escreve o
  // rótulo. É a regra que o interruptor tinha e que o botão precisa manter:
  // quem diz o estado é a LEITURA do shell, nunca o toque.
  const redeOn = await pg2.evaluate(() => {
    const b = document.getElementById('castNetBtn');
    return {
      ligado: b.classList.contains('ligado'),
      rotulo: document.getElementById('castNetLabel').textContent,
      // Nenhum interruptor sobrou na folha: a decisão inteira é o par de botões.
      semTrilho: !document.querySelector('.cast-sw, .cast-sw-row, #castNetToggle'),
    };
  });
  checar(redeOn.ligado && /deslig/i.test(redeOn.rotulo),
    'LIGADA, o botão da transmissão veste o estado e passa a nomear o desligamento ("'
    + redeOn.rotulo + '")');

  // ---- E ENQUANTO O SHELL RESPONDE, O BOTÃO É O RECADO (v5.227) ----------
  //
  // O "Ligando a transmissão…" saía numa linha de 0,78 rem ABAIXO do botão que
  // o operador acabara de tocar — no menor texto da folha, e no exato momento
  // em que a folha se reorganiza. O rótulo é derivado de `mirrorOcupado` mais o
  // estado, pela mesma leitura que pinta a cor: ocupado com o servidor NO AR é
  // "Desligando…"; ocupado sem ele é "Ligando…".
  const emCurso = await pg2.evaluate(() => {
    const ler = () => document.getElementById('castNetLabel').textContent;
    mirrorOcupado = true;
    renderCast();
    const desligando = ler();
    const estadoAntes = mirrorEstado;
    mirrorEstado = { ligado: false, telas: [] };
    renderCast();
    const ligando = ler();
    mirrorEstado = estadoAntes;
    mirrorOcupado = false;
    renderCast();
    return { desligando, ligando, voltou: ler() };
  });
  checar(/deslig/i.test(emCurso.desligando) && /…$/.test(emCurso.desligando),
    'ocupado com o servidor no ar, o próprio botão diz "' + emCurso.desligando + '"');
  checar(/ligando/i.test(emCurso.ligando) && !/deslig/i.test(emCurso.ligando),
    'e ocupado sem ele, "' + emCurso.ligando + '"');
  checar(/deslig/i.test(emCurso.voltou) && !/…$/.test(emCurso.voltou),
    'terminado, ele volta a nomear a ação (nada de recado grudado)', emCurso.voltou);
  checar(redeOn.semTrilho, 'e não sobrou interruptor nenhum na folha de conexão');

  // ---- LIGAR E DESLIGAR NÃO É UM SALTO (v5.226) --------------------------
  //
  // O relato: "há adição ou subtração de conteúdo nesse popup, isso move os
  // elementos irregularmente... os elementos surgem do nada e as coisas mudam
  // de lugar". Duas metades, e as duas se medem sem olhar para um pixel.
  //
  // 1. O BLOCO DO ENDEREÇO abre por CLASSE e não por `hidden` — é isso que
  //    permite animar a altura. Um `hidden` de volta aqui é o salto de volta.
  // 2. A LISTA REAPROVEITA as linhas. Ela era refeita por inteiro a cada
  //    leitura do estado, e o estado é lido de 2,5 em 2,5 s: qualquer animação
  //    de entrada recomeçaria sozinha para sempre, e o botão "Desconectar" era
  //    recriado debaixo do dedo de quem o estava tocando.
  const anim = await pg2.evaluate(() => {
    const bloco = document.getElementById('castLive');
    const ul = document.getElementById('castTelas');
    const out = { porClasse: bloco.classList.contains('aberto') && !bloco.hidden,
      temCasca: !!bloco.querySelector('.cast-live-in') };
    const primeiro = ul.children[0];
    if (primeiro) primeiro.dataset.marca = 'x';
    renderCastTelas([{ rotulo: 'tela A', conectadaMs: 95000, pronta: true }]);
    out.mesmaLinha = !!ul.children[0] && ul.children[0].dataset.marca === 'x';
    renderCastTelas([{ rotulo: 'tela A' }, { rotulo: 'tela B' }]);
    const nova = Array.from(ul.children).find((li) => li.dataset.chave === 'tela B');
    out.entrou = !!nova && nova.classList.contains('entrando');
    renderCastTelas([{ rotulo: 'tela B' }]);
    const velha = Array.from(ul.children).find((li) => li.dataset.chave === '');
    out.saiu = !!velha && velha.classList.contains('saindo');
    return out;
  });
  checar(anim.porClasse && anim.temCasca,
    'o bloco do endereço abre por CLASSE (é o que dá altura animável), não por `hidden`');
  checar(anim.mesmaLinha,
    'a lista REAPROVEITA a linha que já estava lá — a enquete não a recria a cada 2,5 s');
  checar(anim.entrou, 'uma tela nova entra MARCADA para animar');
  checar(anim.saiu, 'e uma que saiu se recolhe antes de ser removida do documento');

  // ===== O MANIFESTO REESCRITO PARA A REDE LEVA A ESCADA JUNTO (shell 60) =====
  //
  // `telaManifestoDaRede` troca `/stream/<token>` (o origin do WebView) por
  // `/s/<token>` (o servidor do celular, relativo). A escada nasceu DEPOIS dessa
  // função, e um `Object.assign` a carregaria adiante INTACTA — com URLs de um
  // host que o navegador da rede não alcança.
  //
  // O desfecho seria pior que não ter escada: a tela mede, decide descer, o
  // fetch do init novo falha quatro vezes e `morrer()` derruba a transmissão.
  // **Uma otimização matando a projeção, e só nas telas** — que é onde ninguém
  // do lado do operador veria o erro.
  const rede = await pg2.evaluate(() => {
    const faixa = (n) => ({
      url: 'https://appassets.androidplatform.net/stream/tok' + n,
      altura: n, size: n * 1000, mime: 'video/mp4; codecs="avc1.4d401f"',
    });
    const cheio = telaManifestoDaRede({
      seconds: 200, video: faixa(1080), audio: faixa(0),
      videos: [faixa(1080), faixa(720), faixa(480)],
    });
    // Um degrau que NÃO se deixa reescrever (URL de outra forma) tem de SAIR da
    // escada, nunca ficar nela: a regra escolheria justamente ele numa rede
    // ruim, que é quando ele importa.
    const torto = telaManifestoDaRede({
      seconds: 200, video: faixa(1080), audio: faixa(0),
      videos: [faixa(1080), { url: 'https://outro.exemplo/x', altura: 720, size: 1 }],
    });
    return {
      urls: (cheio.videos || []).map((v) => v.url),
      alturas: (cheio.videos || []).map((v) => v.altura),
      video: cheio.video.url,
      tortoTemEscada: !!(torto && torto.videos),
    };
  });
  checar(rede.urls.length === 3 && rede.urls.every((u) => u.startsWith('/s/')),
    'a ESCADA é reescrita para `/s/<token>` como o `video` e o `audio` — sem isso '
    + 'a tela da rede busca um host que ela não alcança e a transmissão MORRE por '
    + 'causa da otimização', rede.urls);
  checar(rede.alturas.join(',') === '1080,720,480' && rede.video.startsWith('/s/'),
    'a ordem e as alturas atravessam intactas, e o `video` (o topo) continua '
    + 'reescrito como sempre', rede);
  checar(rede.tortoTemEscada === false,
    'e uma escada que perdeu degraus a ponto de sobrar um só SOME: uma escada com '
    + 'um degrau inalcançável é pior que escada nenhuma', rede.tortoTemEscada);
  checar(erros2.length === 0,
    'nenhum erro de console no percurso com a transmissão ligada'
    + (erros2.length ? ':\n        ' + erros2.join('\n        ') : ''));
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

// ---------------------------------------------------------------------------
// O PADRÃO DE FÁBRICA DAS IMAGENS DOS SLIDES (v1.1.1)
//
// As imagens vêm baixadas com a música (`resolveImage` não consulta preferência
// nenhuma), e até aqui o app nascia ignorando-as: o hino saía em texto sobre
// preto e quem instalava não tinha como saber que existia um segmento chamado
// "Imagens dos slides". Nada erra nesse caminho — nem console, nem Registro —,
// então só um oráculo o segura.
//
// CONTEXTO PRÓPRIO, de propósito: o `ctx` compartilhado recebe um
// `setState('lyricsBg', 'image')` no bloco do `__tela`, logo abaixo, e uma
// asserção sobre o padrão medida depois dele estaria lendo a escrita alheia —
// aprovaria com a leitura do banco invertida, que é justamente o que ela existe
// para reprovar.
//
// As DUAS metades, porque nenhuma basta sozinha: sem a primeira, a leitura do
// banco pode voltar a `=== 'image'` e o padrão se desfaz calado no primeiro
// lançamento; sem a segunda, alguém "conserta" o padrão ignorando o banco e o
// "Remover" do operador deixa de valer.
try {
  const ctxNovo = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  await semRedeExterna(ctxNovo);
  const pgP = await ctxNovo.newPage();
  await pgP.addInitScript(PONTE);
  // ESPERAR PELO CRITÉRIO DO WATCHDOG, não por `__avBack` sozinho: aquele existe
  // assim que o `controle.js` é parseado, e quem marca o segmento é o `load()`,
  // que é assíncrono. Perguntar antes dele lê `.active` como `null` e reprova o
  // app por um relógio. Não é tautologia: dentro do `load()` o
  // `renderLyricsBgTile()` roda ANTES do `renderPlaylist()`, então o `<li>` só
  // aparece depois de o tile já estar pintado.
  const dePe = () => pgP.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 25000 });
  await pgP.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await dePe();

  // 1) APARELHO RECÉM-INSTALADO: nada gravado em `lyricsBg`.
  const zero = await pgP.evaluate(async () => ({
    gravado: await window.AVDB.getState('lyricsBg'),
    // O `data-estado` do TILE (v1.4.38): a folha virou painel rápido, e quem
    // escreve o estado é `pintarTile`. Perguntar pela CLASSE seria perguntar
    // pela aparência; o `data-estado` é o valor em vigor.
    marcado: document.getElementById('lyricsBgTile')?.dataset.estado || null,
  }));
  checar(zero.gravado === undefined || zero.gravado === null,
    'num aparelho recém-instalado nada está gravado em `lyricsBg`',
    JSON.stringify(zero));
  checar(zero.marcado === 'image',
    'e o tile "Fundo da letra" nasce em MOSTRAR — as imagens já vieram '
    + 'baixadas com a música, e escondê-las era esconder material que o aparelho '
    + 'já tinha', 'marcado: ' + JSON.stringify(zero.marcado));

  // 2) E O "REMOVER" DO OPERADOR CONTINUA VALENDO depois de reabrir o app.
  await pgP.evaluate(() => window.AVDB.setState('lyricsBg', 'black'));
  await pgP.reload({ waitUntil: 'domcontentloaded' });
  await dePe();
  const escolhido = await pgP.evaluate(() =>
    document.getElementById('lyricsBgTile')?.dataset.estado || null);
  checar(escolhido === 'black',
    'e quem ESCOLHEU "Remover" continua em Remover na abertura seguinte — o '
    + 'padrão vale para o valor ausente, não por cima de uma escolha',
    'marcado: ' + JSON.stringify(escolhido));
  await pgP.close();
  await ctxNovo.close();
} catch (e) {
  checar(false, 'o padrão das imagens dos slides terminou sem exceção (' + (e && e.message) + ')');
}

// ---------------------------------------------------------------------------
// A METADE CONSUMIDORA DO `__tela` (v5.223)
//
// Uma tela da rede não tem o IndexedDB do celular: wallpaper, fundo da letra e
// preenchimento têm de ser REENVIADOS a ela quando conecta, e quem faz isso é
// `telaReenviarPreferencias`, disparado por `if (msg.__tela)` no
// `display-ready`. O produtor do campo é o `tela.js` e está travado no
// `tela-rede.test.mjs`; esta é a outra ponta.
//
// As duas existem porque foi a DIVERGÊNCIA entre elas que passou despercebida
// desde a v5.188: o consumidor exigia o campo, o produtor nunca o mandava, e
// não havia erro em lugar nenhum — só três preferências que não chegavam.
// Travar um lado só deixaria o par livre para divergir de novo.
try {
  const pg3 = await ctx.newPage();
  await pg3.addInitScript(ponteCom(
    { ligado: true, endereco: 'http://192.168.0.9:8787', erro: '',
      telas: [{ rotulo: 'A', comando: true, conectadaMs: 5000, telaAcesaMin: 0,
                aviso: '', eventos: 2, pronta: true, fila: 0 }] }, []));
  await pg3.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg3.waitForFunction(() => !!window.__avBack, null, { timeout: 20000 });
  // O operador tem "imagens" ligado, persistido de um culto anterior.
  await pg3.evaluate(() => window.AVDB.setState('lyricsBg', 'image'));
  await pg3.reload({ waitUntil: 'domcontentloaded' });
  await pg3.waitForFunction(() => !!window.__avBack, null, { timeout: 20000 });
  await pg3.waitForTimeout(600);

  // Uma tela da rede se anuncia — exatamente como o `tela.js` a anuncia.
  await pg3.evaluate(() => {
    window.__enviados = [];
    new BroadcastChannel('av-iasd').postMessage(
      { type: 'display-ready', __de: 'tela-1', __tela: 'tela-1', __mid: 'bn:1' });
  });
  await pg3.waitForTimeout(1200);
  const mandados = await pg3.evaluate(() => (window.__enviados || []).map((m) => m.type));
  checar(mandados.includes('lyricsbg'),
    'o display-ready com __tela faz o Controle reenviar o fundo da letra',
    'emitiu: ' + JSON.stringify(mandados));

  // E o CONTRÁRIO: o telão de verdade (sem `__tela`) não recebe esse reenvio —
  // ele lê tudo do IndexedDB sozinho, e mandar de novo seria ruído na conexão.
  await pg3.evaluate(() => {
    window.__enviados = [];
    new BroadcastChannel('av-iasd').postMessage(
      { type: 'display-ready', __de: 'telao-1', __mid: 'bn:2' });
  });
  await pg3.waitForTimeout(1000);
  const semTela = await pg3.evaluate(() => (window.__enviados || []).map((m) => m.type));
  checar(!semTela.includes('lyricsbg'),
    'e o display-ready SEM __tela (o telão de verdade) não dispara o reenvio',
    'emitiu: ' + JSON.stringify(semTela));

  // ===== SEM O CANAL DE MÍDIA, AS DUAS PREFERÊNCIAS DE JSON AINDA VIAJAM =====
  //
  // `telaReenviarPreferencias` abria com `if (!telaCanal()) return`, e aquela
  // guarda derrubava as TRÊS. Só o wallpaper depende do canal — ele empurra uma
  // imagem; `lyricsbg` e `fit` são JSON puro no mesmo SSE de todo comando do
  // culto e não movem um byte.
  //
  // O preço da guarda larga era o defeito que este reenvio existe para fechar: a
  // tela não tem o IndexedDB do celular para consultar, então ficava no valor
  // com que NASCEU para sempre — nada reexamina uma estrofe já renderizada.
  //
  // E ele era CALADO: sem canal não há erro, não há linha no Registro, e o
  // padrão do `fit` e do wallpaper é aceitável o bastante para ninguém reparar.
  // Só o fundo da letra aparece, e aparece como "o app perdeu a configuração".
  //
  // Os dois lados da asserção, porque nenhum basta: o `lyricsbg` TEM de sair, e
  // o `wallpaper` NÃO pode — mandar a URL `/m/` de bytes que nunca serão
  // empurrados dá à tela um endereço que responde 404.
  await pg3.evaluate(() => {
    delete window.__avTelaMidia;
    window.__enviados = [];
    new BroadcastChannel('av-iasd').postMessage(
      { type: 'display-ready', __de: 'tela-2', __tela: 'tela-2', __mid: 'bn:3' });
  });
  await pg3.waitForTimeout(1200);
  const semCanal = await pg3.evaluate(() => (window.__enviados || []).map((m) => m.type));
  checar(semCanal.includes('lyricsbg'),
    'e SEM o canal de mídia o fundo da letra ainda viaja — ele é JSON, não bytes',
    'emitiu: ' + JSON.stringify(semCanal));
  checar(!semCanal.includes('wallpaper'),
    'mas o WALLPAPER não: sem canal, a URL /m/ apontaria para bytes que nunca chegam',
    'emitiu: ' + JSON.stringify(semCanal));
  await pg3.close();
} catch (e) {
  checar(false, 'o percurso do __tela terminou sem exceção (' + (e && e.message) + ')');
}

// ── A BÍBLIA BASE, SEM NINGUÉM ABRIR A ABA (v5.242) ──────────────────────
//
// O download da versão INTEIRA sempre existiu — e só era disparado por alguém
// ENTRAR na aba Bíblia. Quem nunca entrou ficava com o caminho sob demanda:
// um capítulo por vez, conforme o uso, com a rede da igreja no meio do culto
// como única rede disponível.
//
// O que se afirma aqui são as DUAS metades, e a segunda é o que impede a
// correção de virar outra coisa: (1) a varredura começa sozinha, sem toque
// nenhum na aba; (2) ela vai para a versão que o app GARANTE (a Almeida
// Revista e Atualizada), não para a que o operador escolheu — quem escolheu
// outra continua com a dele pelo caminho de sempre, e a base não vira refém
// dessa escolha.
//
// O banco é de mentira e as versões vêm com a ARA em SEGUNDO lugar de
// propósito: `pickDefaultBibleVersion` cai na primeira disponível quando não
// acha a ARA, e uma lista com ela na frente aprovaria os dois comportamentos.
try {
  const pg4 = await ctx.newPage();
  const ARA = 9, OUTRA = 7;
  const pedidos = [];
  const responder = (route, corpo) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(corpo),
  }).catch(() => {});
  await pg4.route('**/json_db/pt_bible_version*', (r) => responder(r, [
    { id_bible_version: OUTRA, name: 'Nova Versão Internacional' },
    { id_bible_version: ARA, name: 'Almeida Revista e Atualizada' },
  ]));
  await pg4.route('**/json_db/pt_bible_book*', (r) => responder(r,
    Array.from({ length: 66 }, (_, i) => ({ id_bible_book: i + 1, name: 'Livro ' + (i + 1) }))));
  await pg4.route('**/json_db/bible_*', (r) => {
    const m = /bible_(\d+)_(\d+)_(\d+)/.exec(r.request().url());
    if (m) pedidos.push({ versao: +m[1], livro: +m[2], cap: +m[3] });
    responder(r, { 1: 'No princípio criou Deus os céus e a terra.' });
  });
  // Esperar em Node (o contador é daqui), não na página: uma dúzia de
  // capítulos já prova que a varredura em massa está correndo — completar os
  // 1189 seria pagar meio minuto de roteamento por nada.
  const esperarCapitulos = async (quantos, ms) => {
    const ate = Date.now() + ms;
    while (pedidos.length < quantos && Date.now() < ate) await pg4.waitForTimeout(150);
    return pedidos.length;
  };

  await pg4.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg4.waitForFunction(() => !!window.__avBack, null, { timeout: 20000 });
  const veio = await esperarCapitulos(30, 25000);
  checar(veio >= 30,
    'A BÍBLIA BAIXA SOZINHA NA ABERTURA — sem ninguém abrir a aba (' + veio + ' capítulo(s))');
  checar(pedidos.length > 0 && pedidos.every((p) => p.versao === ARA),
    'e ela é a versão que o app garante (Almeida Revista e Atualizada), não a primeira da lista');
  // A aba nunca foi tocada: é isso que separa este caminho do `enterBibleTab`.
  checar(await pg4.evaluate(() => activeTab !== 'bible'),
    'e nada disso passou pela aba Bíblia — ela continua fechada');

  // A ESCOLHA DO OPERADOR NÃO É A BASE. Ele troca de versão; a base continua
  // sendo garantida, e a dele só desce quando ele abrir a aba.
  await pg4.evaluate((v) => window.AVDB.setState('bibleVersion', v), OUTRA);
  pedidos.length = 0;
  await pg4.reload({ waitUntil: 'domcontentloaded' });
  await pg4.waitForFunction(() => !!window.__avBack, null, { timeout: 20000 });
  const veio2 = await esperarCapitulos(12, 25000);
  // ESPERA A LEITURA DO ESTADO, e isto é um conserto de INSTABILIDADE (v5.252):
  // este caso reprovava em ~1 de cada 6 execuções. `bibleVersionId` é escrito
  // durante o `init()`, que lê o IndexedDB; os capítulos começam a descer no
  // mesmo `init()`, então esperar por eles NÃO garante que a leitura da
  // preferência já tenha acontecido — são duas coisas que correm juntas, e o
  // teste apostava numa ordem entre elas. Um teste que reprova sozinho de vez
  // em quando é pior que teste nenhum: ele ensina a ignorar vermelho, que é a
  // lição da v5.204.
  //
  // A espera falha em silêncio de propósito: se a preferência de fato não for
  // respeitada, quem reprova é a asserção abaixo — com o valor real na mão.
  try {
    await pg4.waitForFunction((v) => bibleVersionId === v, OUTRA, { timeout: 8000 });
  } catch (_) { /* a asserção abaixo dá o veredito */ }
  checar(await pg4.evaluate(() => bibleVersionId) === OUTRA,
    'a versão ESCOLHIDA pelo operador é outra (a seleção dele foi respeitada)');
  checar(veio2 > 0 && pedidos.every((p) => p.versao === ARA),
    'e mesmo assim quem baixa sozinha é a base — nenhum capítulo da escolhida sem abrir a aba');
  await pg4.close();
} catch (e) {
  checar(false, 'o percurso da Bíblia base terminou sem exceção (' + (e && e.message) + ')');
}

// ── O LINK DO YOUTUBE ENTRA NO AR COMO QUALQUER OUTRO ITEM (v5.269) ──────
// Relato do operador: *"um arquivo do tipo YouTube, que seria apenas um link,
// quando está no cronograma ou favoritos, pode ser tocado diretamente online no
// player, mas o respectivo elemento da lista não entra no modo 'no ar'."*
//
// A causa é uma assimetria entre os dois caminhos de `resolverLinkYoutube`
// (v5.212). Pelo DOWNLOAD o arquivo toma o lugar do link EM POSIÇÃO, então a
// linha passa a ter o id da mídia e o `midiaNoArId` de sempre a alcança. Pela
// TRANSMISSÃO DIRETA, não: a mídia é um avulso com id próprio, o link continua
// na lista com o id dele, e nada ligava os dois.
//
// E não era só o realce: `noArAgora` responde pela MESMA pergunta, então o
// SEGUNDO TOQUE (que retira do ar) também não alcançava aquela linha — ela
// reprojetava em vez de retirar, que é o defeito que a v5.165 existiu para
// consertar, reaberto por outra porta. Por isso as duas metades são medidas.
//
// Este caso mora AQUI, e não no `cena.test.mjs`, por uma razão dura:
// `resolverLinkYoutube` devolve na primeira linha quando não há ponte
// (`window.__NATIVE__`), e o `cena` sobe a base sem ela.
//
// O `tentarTransmitir` é SUBSTITUÍDO por um que faz o que o de verdade faz no
// fim — `send(<id do avulso>)` —, porque é justamente essa chamada que zera a
// origem: um teste que pulasse o `send` aprovaria uma ordem de atribuição
// errada, que é o único jeito de errar isto.
try {
  const pg5 = await ctx.newPage();
  await pg5.addInitScript(PONTE);
  await pg5.goto(`http://127.0.0.1:${porta}/controle/`, { waitUntil: 'load' });
  await pg5.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function',
    null, { timeout: 20000 });
  await pg5.evaluate(() => setAppMode('full'));

  const r = await pg5.evaluate(async () => {
    // O AVULSO que a transmissão criaria, e o LINK que fica na lista.
    const avulso = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'video/mp4' }),
      { name: 'Vídeo transmitido', type: 'video/mp4', kind: 'video', list: 'avulsos' });
    // O link é criado como o app o cria (`addUrlMedia`, ver `ytAcao` com
    // `YT_ONLINE`): um registro SEM bytes. Foi essa a primeira versão errada
    // deste caso — `addMedia(null, …)` lê `blob.type` e estoura.
    const link = await AVDB.addUrlMedia('https://www.youtube.com/watch?v=abc12345678', {
      kind: 'youtube', type: 'video/youtube', name: 'Link do YouTube',
      youtubeId: 'abc12345678', list: 'imports',
    });
    await load();
    // eslint-disable-next-line no-func-assign
    window.tentarTransmitir = async () => { await send(avulso.id); return true; };
    const rec = await AVDB.getMedia(link.id);
    await resolverLinkYoutube(rec);
    await new Promise((x) => setTimeout(x, 250));
    const li = document.querySelector('.lib-item[data-id="' + link.id + '"]');
    return {
      linkId: link.id, avulsoId: avulso.id,
      // A mídia no ar é o AVULSO — a origem não pode ter trocado isso.
      noArId: midiaNoArId,
      realce: linhaNoAr(link.id),
      // O segundo toque: ele decide entre projetar e retirar.
      segundoToque: noArAgora(rec),
      classe: !!li && li.classList.contains('no-ar'),
      selo: !!li && !!li.querySelector('.row-live'),
      // E o AVULSO continua sendo o que está no ar de fato.
      avulsoTambem: linhaNoAr(avulso.id),
    };
  });
  checar(r.noArId === r.avulsoId,
    'a mídia no ar continua sendo o AVULSO da transmissão — a origem não troca '
    + 'quem está no telão', r.noArId);
  checar(r.realce && r.classe,
    'e a LINHA DO LINK entra em "no ar", como qualquer outro item que foi ao '
    + 'telão', JSON.stringify({ realce: r.realce, classe: r.classe }));
  checar(r.selo,
    'com o selo "● No ar" junto — o estado que se LÊ, não só a cor');
  checar(r.segundoToque,
    'e o SEGUNDO TOQUE nela retira do ar em vez de reprojetar — sem esta metade '
    + 'o realce diria uma coisa e o gesto faria outra');

  // ---- E A ORIGEM CAI COM A MÍDIA -------------------------------------
  // Sem isto a linha do link ficaria marcada para sempre: `midiaNoArOrigem` só
  // é escrita neste caminho, e quem a limparia é justamente quem tira do ar.
  const depois = await pg5.evaluate(async (x) => {
    await pararMidia('media-clear');
    marcarNoAr();
    const li = document.querySelector('.lib-item[data-id="' + x + '"]');
    return { realce: linhaNoAr(x), classe: !!li && li.classList.contains('no-ar') };
  }, r.linkId);
  checar(!depois.realce && !depois.classe,
    'e ela SAI do ar quando a mídia sai — a marca não sobrevive ao Parar',
    JSON.stringify(depois));

  // ---- E UM PLAY NORMAL NÃO A HERDA -----------------------------------
  // `send` zera a origem, e é ele que todo play atravessa. Sem essa linha, uma
  // música tocada depois deixaria a linha do link marcada como "no ar".
  const outro = await pg5.evaluate(async (x) => {
    const m = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
      { name: 'Outra música', type: 'audio/mpeg', kind: 'audio', list: 'imports' });
    await load();
    await send(m.id);
    await new Promise((r2) => setTimeout(r2, 150));
    return { link: linhaNoAr(x), nova: linhaNoAr(m.id) };
  }, r.linkId);
  checar(!outro.link && outro.nova,
    'e um play NORMAL depois dela não herda a origem — quem está no ar é a '
    + 'mídia nova', JSON.stringify(outro));
  await pg5.close();
} catch (e) {
  checar(false, 'o percurso do link do YouTube terminou sem exceção (' + (e && e.message) + ')');
}

// ── OS FAVORITOS: EXCLUIR NA LINHA, GUIA NO LUGAR, SEM MULTISSELEÇÃO ─────
// Três relatos do operador, e os três moram nesta lista:
//
//   · *"adicione a opção de excluir nas opções nos itens individuais das listas
//     de cronograma e favoritos"*;
//   · *"as linhas de guia para a posição final dos itens está completamente
//     fora de sincronia e posição com a lista"*;
//   · *"ao segurar em um item da lista de favoritos, ele entra no modo de
//     multiseleção, mas as opções aparecem na tela do cronograma"*.
//
// O caso mora aqui porque a lista dos Favoritos é desenhada DENTRO da
// Biblioteca (v5.237), e a Biblioteca é a tela que só existe com a ponte.
try {
  const pg6 = await ctx.newPage();
  await pg6.addInitScript(PONTE);
  await pg6.goto(`http://127.0.0.1:${porta}/controle/`, { waitUntil: 'load' });
  await pg6.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function',
    null, { timeout: 20000 });
  await instalarCenarioFav(pg6);

  const fav = await pg6.evaluate(async () => {
    setAppMode('full');
    const ids = [];
    for (let i = 1; i <= 4; i++) {
      const m = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
        { name: 'Favorito ' + i, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      await AVDB.listAdd('favs', m.id);
      ids.push(m.id);
    }
    await load();
    window.__bibliotecaComFavoritos();
    await new Promise((r) => setTimeout(r, 400));
    const corpo = document.querySelector('[data-fav-corpo]');
    const li = corpo && corpo.querySelector('.lib-item[data-id="' + ids[0] + '"]');
    const ul = li && li.parentElement;
    if (!ul) return { erro: 'a lista dos favoritos não foi desenhada' };

    // ---- O PAR ↑↓ MOVE, E A ORDEM É A DA LISTA (v5.285) ----
    // O caso da LINHA-GUIA do arrasto (v5.272) morava aqui e saiu com ele: não
    // há mais posicionamento absoluto a conferir. O que ficou é a pergunta que
    // importa e que sobrevive à troca de gesto — o item foi para onde o botão
    // prometeu —, medida na lista de VERDADE e pelo botão de verdade.
    // A GAVETA PRECISA ESTAR ABERTA: a faixa de ações é montada por
    // `renderItemMenu` no primeiro toque (v5.302), e é o percurso do operador —
    // ele não alcança o ↓ sem abrir a linha.
    const descer = async () => {
      const alvo2 = corpo.querySelector('.lib-item[data-id="' + ids[0] + '"]');
      if (!alvo2.classList.contains('expanded')) {
        alvo2.querySelector('.row').click();
        await new Promise((f) => setTimeout(f, 200));
      }
      const bs = corpo.querySelector('.lib-item[data-id="' + ids[0] + '"]')
        .querySelectorAll('.row-ordem');
      bs[1].click();
    };
    await descer();
    await new Promise((r) => setTimeout(r, 300));
    const ordemDepois = (await AVDB.listIds('favs')).indexOf(ids[0]);
    // E A GAVETA REABRE no item que se moveu, com o ↓ de novo sob o dedo — sem
    // isto cada casa custaria reabrir o menu à mão, que é o que tornaria uma
    // sequência de toques insuportável. Medido aqui, e não no caso da lista
    // solta: `redesenharFavoritosNaBiblioteca` desiste com a Biblioteca fechada,
    // e é só aqui que ela está aberta de verdade.
    // A REABERTURA é da GAVETA desde a v5.287 (`.expanded`), e não mais da
    // faixa `⋮` (`.acoes-abertas`) — o par ↑↓ mudou de casa junto com o resto
    // das ações da linha.
    await new Promise((r) => setTimeout(r, 200));
    const reaberta = document.querySelector('[data-fav-corpo] .lib-item.expanded');
    const reabriu = !!reaberta && reaberta.dataset.id === ids[0];

    // ---- O TOQUE LONGO não liga modo nenhum ----
    const row = li.querySelector('.row');
    const ev = (t) => row.dispatchEvent(new PointerEvent(t,
      { bubbles: true, clientX: 10, clientY: 10, pointerId: 1 }));
    ev('pointerdown');
    await new Promise((r) => setTimeout(r, 900));   // bem além do LONGPRESS
    const modo = selectionMode;
    ev('pointercancel');

    return {
      ordemDepois, reabriu,
      modo,
      temExcluir: !!li.querySelector('.row-excluir'),
      ids,
    };
  });
  checar(!fav.erro, 'a lista dos Favoritos foi desenhada na Biblioteca', fav.erro);
  checar(fav.ordemDepois === 1,
    'o ↓ da gaveta MOVE o item uma casa na lista de verdade (v5.285)',
    'o primeiro foi para o índice ' + fav.ordemDepois);
  checar(fav.reabriu,
    'e a gaveta REABRE no item que se moveu: o botão continua sob o mesmo dedo '
    + 'para a casa seguinte');
  checar(fav.modo === false,
    'e o toque longo NÃO liga a seleção múltipla aqui: ela nunca se desenhou '
    + 'nesta lista, e a barra dela ia parar na tela do Cronograma');
  checar(fav.temExcluir,
    'o que aquele modo daria — excluir sem sair da lista — está na gaveta, um toque');

  // ---- E O EXCLUIR PERGUNTA NA PRÓPRIA LINHA, sem popup nenhum (v5.301) ----
  //
  // Pedido do operador: *"remova os popups de confirmar exclusão, para que
  // todas essas confirmações sejam inseridas direto na UI… durante o processo
  // de exclusão pode trocar o ícone da thumbnail pela lixeira"*.
  //
  // O percurso é medido em TRÊS tempos, porque são três coisas que podem falhar
  // separadas: a pergunta APARECE (e nada saiu ainda), o CANCELAR devolve a
  // faixa, e só o segundo toque executa. A metade do meio é a que impede o pior
  // desfecho — uma confirmação que só ilustra e exclui do mesmo jeito.
  const saiu = await pg6.evaluate(async (ids) => {
    // O primeiro está SÓ nos favoritos; o segundo está também no Cronograma.
    const alvo = ids[0];
    const corpo = document.querySelector('[data-fav-corpo]');
    const li = corpo.querySelector('.lib-item[data-id="' + alvo + '"]');
    // O EXCLUIR MORA NA GAVETA desde a v5.287 — quem a abre é o corpo da linha,
    // e não mais um `⋮`. (A faixa de ações é montada com a linha, então o botão
    // já existe; abrir é o que o operador de fato faz.)
    li.querySelector('.row').click();
    await new Promise((r) => setTimeout(r, 250));
    li.querySelector('.row-excluir').click();
    await new Promise((r) => setTimeout(r, 200));
    const dlg = document.getElementById('appDialog');
    const lixo = li.querySelector(':scope > .row > .thumb > .row-lixo');
    const capa = [...li.querySelectorAll(':scope > .row > .thumb > *')]
      .filter((n) => !n.classList.contains('row-lixo'))
      .filter((n) => getComputedStyle(n).display !== 'none').length;
    const r = {
      // 1. A PERGUNTA ESTÁ NA FAIXA, e o modal do app NÃO abriu.
      perguntouNaFaixa: !!li.querySelector('.fav-acoes.confirmando > .linha-confirma'),
      semModal: !dlg || !dlg.classList.contains('open'),
      // 2. A MINIATURA VIROU A LIXEIRA, e a capa saiu de baixo dela.
      //    ESTE É O CAMINHO B DO SÍMBOLO (v1.4.27): no Cronograma e na fila ele
      //    passou a morar na COLUNA DO `⋮`, e a capa sai de cena junto. Aqui
      //    não há `⋮` — a gaveta abre pelo corpo da linha e a faixa fica ABAIXO
      //    dela, sem cobrir nada —, então a capa continua sendo a casa dele.
      semMais: !li.querySelector(':scope > .row > .row-mais'),
      lixeiraNaCapa: !!lixo && getComputedStyle(lixo).display !== 'none',
      capaEscondida: capa === 0,
      // 3. As opções da faixa cedem o lugar — sem isto o par apareceria ao lado
      //    dos botões que ele está confirmando.
      opcoesEscondidas: [...li.querySelectorAll('.fav-acoes > .row-btn')]
        .every((b) => getComputedStyle(b).display === 'none'),
      // 4. E NADA SAIU AINDA.
      antesDoSim: (await AVDB.listIds('favs')).includes(alvo),
    };
    // ---- O CANCELAR devolve a faixa e não tira nada ----
    li.querySelector('.linha-nao').click();
    await new Promise((f) => setTimeout(f, 200));
    r.cancelouVoltou = !li.querySelector('.linha-confirma')
      && !li.querySelector('.row-lixo')
      && (await AVDB.listIds('favs')).includes(alvo);
    // ---- E O SEGUNDO TOQUE executa ----
    li.querySelector('.row-excluir').click();
    await new Promise((f) => setTimeout(f, 200));
    li.querySelector('.linha-sim').click();
    await new Promise((f) => setTimeout(f, 400));
    r.naLista = !!document.querySelector('[data-fav-corpo] .lib-item[data-id="' + alvo + '"]');
    r.nosFavs = (await AVDB.listIds('favs')).includes(alvo);
    // Ele estava no Cronograma também (`imports`), e de lá NÃO sai: excluir é
    // desta lista, e o gc só apaga o que não está em mais nenhuma.
    r.noCronograma = (await AVDB.listIds('imports')).includes(alvo);
    return r;
  }, fav.ids);
  checar(saiu.perguntouNaFaixa && saiu.semModal,
    'o excluir da gaveta PERGUNTA na própria faixa (v5.301), e não abre popup '
    + 'nenhum — a pergunta "excluir este item?" feita por cima de uma tela sem '
    + 'o item era respondida de memória', JSON.stringify(saiu));
  checar(saiu.semMais === true && saiu.lixeiraNaCapa && saiu.capaEscondida
    && saiu.opcoesEscondidas,
    'e aqui a MINIATURA vira a lixeira — o CAMINHO B do símbolo (v1.4.27): '
    + 'esta gaveta não tem `⋮` para o processo tomar emprestado, e a faixa fica '
    + 'ABAIXO da linha em vez de cobri-la, então a capa continua sendo a casa '
    + 'dele. No Cronograma e na fila os dois saem de cena juntos',
    JSON.stringify(saiu));
  checar(saiu.antesDoSim === true && saiu.cancelouVoltou === true,
    'o primeiro toque não tira nada e o Cancelar devolve a faixa inteira — sem '
    + 'esta metade a confirmação seria enfeite sobre uma exclusão imediata',
    JSON.stringify(saiu));
  checar(!saiu.naLista && !saiu.nosFavs,
    'o excluir da gaveta tira o item DESTA lista', JSON.stringify(saiu));
  checar(saiu.noCronograma,
    'e NÃO o tira das outras — "excluir" aqui é sair da lista, não apagar os '
    + 'bytes de quem ainda os segura', JSON.stringify(saiu));

  // ===== E O RENOMEAR CHEGOU À FAIXA DOS FAVORITOS (v5.301) =====
  //
  // Pedido do operador: *"adicione o botão de renomear nas opções dos itens
  // individuais dos favoritos"*. Ele existia só na linha do Cronograma
  // (v5.288). Medido pela porta de verdade — a gaveta que o corpo da linha abre
  // —, e nas duas metades: o banco muda e a linha passa a mostrar o nome novo.
  const renFav = await pg6.evaluate(async (ids) => {
    const alvo = ids[1];
    const corpo = document.querySelector('[data-fav-corpo]');
    const li = corpo.querySelector('.lib-item[data-id="' + alvo + '"]');
    if (!li) return { erro: 'a linha do favorito sumiu' };
    if (!li.classList.contains('expanded')) {
      li.querySelector('.row').click();
      await new Promise((f) => setTimeout(f, 250));
    }
    const b = li.querySelector('.hymn-gaveta .fav-acoes .row-renomear');
    if (!b) return { erro: 'sem o lápis na faixa de ações' };
    b.click();
    await new Promise((f) => setTimeout(f, 200));
    // O CAMPO MORA NA PRÓPRIA FAIXA desde a v1.4.25 — e a asserção que carrega
    // isto é a NEGATIVA: um diálogo aberto por baixo continuaria renomeando
    // certo, e o pedido do operador era justamente sobre onde a pergunta mora.
    const campo = li.querySelector('.fav-acoes.confirmando > .linha-renome > .linha-renome-campo');
    const dlg = document.getElementById('appDialog');
    const semModal = !dlg || !dlg.classList.contains('open');
    if (!campo) return { erro: 'o campo não abriu na faixa', semModal };
    const valorInicial = campo.value;
    // ===== O CAMINHO B DO SÍMBOLO (v1.4.27) =====
    // Na v1.4.27 o ✓ do renomear e a lixeira da exclusão mudaram de casa: vão
    // para a COLUNA DO `⋮`, que o processo toma emprestada. **Esta gaveta não
    // tem `⋮`** — ela abre pelo corpo da linha e a faixa fica ABAIXO dela, sem
    // cobrir nada —, e é por isso que o caminho B existe e é medido aqui: sem
    // ele o ✓ simplesmente não seria desenhado, e o campo ficaria sem
    // confirmação em toda a lista dos Favoritos.
    //
    // E ELE VOLTA PARA DENTRO DA FAIXA, à DIREITA do campo. As duas metades
    // caem por motivos diferentes: fora da faixa o botão some da tela; à
    // ESQUERDA ele entra na frente do texto que se está digitando (o `append`
    // do `semSlot` roda ANTES do campo — daí o `prepend` do lado do app).
    const semMais = !li.querySelector(':scope > .row > .row-mais');
    const okFav = li.querySelector('.fav-acoes.confirmando > .linha-renome > .row-slot--ok');
    const okDepoisDoCampo = !!okFav && !!campo
      && (campo.compareDocumentPosition(okFav) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    campo.value = 'Nome de favorito novo';
    li.querySelector('.row-slot--ok').click();
    await new Promise((f) => setTimeout(f, 500));
    const rec = await AVDB.getMedia(alvo);
    const li2 = document.querySelector('[data-fav-corpo] .lib-item[data-id="' + alvo + '"]');
    return {
      semModal, valorInicial, semMais, okNaFaixa: !!okFav, okDepoisDoCampo,
      noBanco: rec && rec.name,
      naTela: li2 ? li2.querySelector('.row-name').textContent : null,
    };
  }, fav.ids);
  checar(renFav.noBanco === 'Nome de favorito novo' && renFav.naTela === 'Nome de favorito novo',
    'e a faixa de ações dos Favoritos ganhou o RENOMEAR (v5.301): o nome muda '
    + 'no banco E na linha', JSON.stringify(renFav));
  checar(renFav.semMais === true && renFav.okNaFaixa === true
    && renFav.okDepoisDoCampo === true,
    'e o CAMINHO B do ✓ (v1.4.27): esta gaveta não tem `⋮` para o processo '
    + 'tomar emprestado, então ele volta para DENTRO da faixa, à direita do '
    + 'campo — sem isso o renomear dos Favoritos ficaria sem confirmação',
    JSON.stringify(renFav));
  checar(renFav.semModal === true,
    'e o campo mora NA FAIXA, sem diálogo de tela cheia (v1.4.25) — renomear é '
    + 'a única ação em que o nome VELHO precisa continuar à vista enquanto o '
    + 'novo é escrito', JSON.stringify(renFav));

  // ===== A FAIXA DIVIDE A LINHA COM O CONFIRMAR (v5.302) =====
  //
  // Pedido do operador: *"ponha o botão de confirmar as escolhas do play dos
  // favoritos para que ele fique lado a lado, à esquerda das opções, ajustado
  // com a altura dos botões"*.
  //
  // Três coisas, e as três podem falhar separadas: ele está NA MESMA LINHA, ele
  // está À ESQUERDA, e todos têm a MESMA ALTURA. A última é medida como
  // IGUALDADE e nunca contra um número escrito aqui — um piso em pixel
  // aprovaria os dois errados juntos no dia em que `--hit` mudar.
  //
  // E a ORDEM da faixa é a mesma do Cronograma, sem os que não existem nesta
  // lista: sem a ESTRELA (aqui ela e a lixeira terminam no mesmo `listRemove`)
  // e sem o botão da PLAYLIST, que aqui é uma LINHA da folha, com caixa.
  const faixa = await pg6.evaluate(async (ids) => {
    const alvo = ids[2];
    const corpo = document.querySelector('[data-fav-corpo]');
    const li = corpo.querySelector('.lib-item[data-id="' + alvo + '"]');
    if (!li) return { erro: 'a linha do favorito sumiu' };
    if (!li.classList.contains('expanded')) {
      li.querySelector('.row').click();
      // ESPERA A ANIMAÇÃO, NÃO UM RELÓGIO. O acordeão anima a altura com
      // `el.animate()` (`expandAccordion`), e medir geometria no meio dela
      // devolve um valor intermediário — o caso reprovava de vez em quando por
      // isso. Um `setTimeout` maior só empurra a corrida para mais longe;
      // `getAnimations()` é o mesmo objeto que o app criou, então a espera
      // acaba exatamente quando o layout parou. Um oráculo que pisca é pior que
      // um que falta: ele ensina a ignorá-lo.
      const gav = li.querySelector('.hymn-gaveta');
      await Promise.all((gav ? gav.getAnimations() : []).map((an) => an.finished.catch(() => {})));
      await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
    }
    const linhaGo = li.querySelector('.song-menu-go-row');
    const go = linhaGo && linhaGo.querySelector('.song-menu-go');
    const fx = linhaGo && linhaGo.querySelector(':scope > .fav-acoes');
    if (!go || !fx) return { erro: 'confirmar ou faixa fora da linha de fecho' };
    const cx = (el) => el.getBoundingClientRect();
    const bs = [...fx.querySelectorAll('.row-btn')];
    const r = {
      // 1. MESMA LINHA — a faixa é irmã do confirmar, não um bloco solto no pé.
      mesmaLinha: true,
      soltaNaGaveta: !!li.querySelector(':scope > .hymn-gaveta > .fav-acoes'),
      // 2. O CONFIRMAR VEM DEPOIS (v5.307 — era antes), e cresce: ele é a
      //    decisão principal, e a que se acha sem mirar é a do CANTO. A medida é
      //    de GEOMETRIA e não de ordem no DOM de propósito: um `order` ou um
      //    `row-reverse` passaria numa checagem de índice e continuaria com a
      //    ordem de FOCO invertida numa faixa que tem um destrutivo.
      confirmarADireita: Math.round(cx(go).left) >= Math.round(cx(bs[bs.length - 1]).right),
      // E A ORDEM DO DOM CONCORDA com a da tela.
      domConcorda: [...linhaGo.children].indexOf(fx) < [...linhaGo.children].indexOf(go),
      confirmarCresce: Math.round(cx(go).width) > Math.round(cx(bs[0]).width),
      // 3. UMA ALTURA SÓ.
      alturaGo: Math.round(cx(go).height),
      alturasBotoes: bs.map((b) => Math.round(cx(b).height)),
      // 4. E A LARGURA DOS QUADRADOS NÃO ENCOLHEU: o pedido era de altura.
      //    Medida contra a CAPA da própria linha, nunca contra um número: a
      //    regra do app é "uma medida para os quadrados da linha (`--thumb`) —
      //    capa, botões e `⋮`", e um piso em pixel aprovaria um encolhimento
      //    silencioso (e ainda imprimiria o número errado na mensagem de ok).
      larguras: bs.map((b) => Math.round(cx(b).width)),
      larguraDaCapa: Math.round(cx(li.querySelector(':scope > .row > .thumb')).width),
      ordem: bs.map((b) => (b.className.match(/row-(excluir|renomear|ordem)/) || [''])[0]),
    };
    // 5. E ELA SOBREVIVE À REMONTAGEM DA FOLHA: `renderItemMenu` refaz a lista a
    //    cada marca, e uma faixa NOVA perderia os ouvintes — e apagaria uma
    //    confirmação de exclusão aberta, deixando a lixeira na miniatura sem
    //    nenhum botão que a explicasse.
    const opcao = [...li.querySelectorAll('.hymn-opcoes .song-menu-btn')]
      .find((b) => /playlist/i.test(b.textContent));
    if (opcao) {
      opcao.click();
      await new Promise((f) => setTimeout(f, 200));
      r.sobreviveuAoRedesenho = !!li.querySelector('.song-menu-go-row > .fav-acoes .row-excluir');
    }
    // 6. ENQUANTO A LINHA PERGUNTA, o confirmar da folha SAI: dois botões de
    //    confirmar lado a lado diriam coisas opostas.
    li.querySelector('.fav-acoes .row-excluir').click();
    await new Promise((f) => setTimeout(f, 250));
    const go2 = li.querySelector('.song-menu-go-row .song-menu-go');
    r.confirmarSomeAoPerguntar = !go2 || getComputedStyle(go2).display === 'none';
    const par = [...li.querySelectorAll('.linha-confirma-btn')];
    r.alturasDoPar = par.map((b) => Math.round(b.getBoundingClientRect().height));
    li.querySelector('.linha-nao').click();
    await new Promise((f) => setTimeout(f, 250));
    const go3 = li.querySelector('.song-menu-go-row .song-menu-go');
    r.confirmarVolta = !!go3 && getComputedStyle(go3).display !== 'none';
    // 7. E O CAMPO DE RENOMEAR TEM A MESMA ALTURA (v1.4.29). Ele nasceu na
    //    v1.4.25 e ficou de fora da regra que a v5.309 escreveu para o par:
    //    MEDIDO, 34px contra os 53,2px do confirmar ao lado — o MESMO pulo de
    //    19px sob o dedo, no caminho que nasceu depois. Medido como IGUALDADE
    //    contra o confirmar, nunca contra um número escrito aqui.
    li.querySelector('.fav-acoes .row-renomear').click();
    await new Promise((f) => setTimeout(f, 250));
    const campoFav = li.querySelector('.linha-renome-campo');
    const okFavAlt = li.querySelector('.row-slot--ok');
    r.alturaCampo = campoFav ? Math.round(campoFav.getBoundingClientRect().height) : null;
    r.alturaOk = okFavAlt ? Math.round(okFavAlt.getBoundingClientRect().height) : null;
    fecharConfirmacaoNaLinha();
    await new Promise((f) => setTimeout(f, 200));
    return r;
  }, fav.ids);
  checar(!faixa.erro && faixa.mesmaLinha && faixa.soltaNaGaveta === false,
    'A FAIXA DE AÇÕES DIVIDE A LINHA COM O CONFIRMAR (v5.302) — ela era um bloco '
    + 'próprio no pé da gaveta, duas faixas empilhadas para o que cabe numa',
    JSON.stringify(faixa));
  checar(!faixa.erro && faixa.confirmarADireita && faixa.domConcorda && faixa.confirmarCresce,
    'com o confirmar À DIREITA dela (v5.307) e crescendo — e a ordem do DOM '
    + 'concordando com a da tela, senão o foco anda ao contrário numa faixa que '
    + 'tem um destrutivo', JSON.stringify(faixa));
  checar(!faixa.erro && faixa.alturasBotoes.length > 0
      && faixa.alturasBotoes.every((h) => h === faixa.alturaGo),
    'e TODOS na mesma altura (' + (faixa.alturaGo || 0) + 'px) — os botões traziam '
    + '`--thumb` fixo e ficariam boiando no meio da linha',
    JSON.stringify(faixa));
  checar(!faixa.erro && faixa.larguras.length > 0
      && faixa.larguras.every((w) => w === faixa.larguraDaCapa),
    'sem encolher a LARGURA deles: cada quadrado mede a CAPA da própria linha ('
    + (faixa.larguraDaCapa || 0) + 'px), que é a regra do app para os quadrados '
    + 'da linha — o pedido era de altura, e estreitar o alvo trocaria um acerto '
    + 'por um erro', JSON.stringify(faixa));
  checar(!faixa.erro && JSON.stringify(faixa.ordem)
      === JSON.stringify(['row-excluir', 'row-renomear', 'row-ordem', 'row-ordem']),
    'e a ORDEM é a mesma do Cronograma sem os que não existem nesta lista: '
    + 'excluir · renomear · ↑ · ↓', JSON.stringify(faixa.ordem));
  checar(!faixa.erro && faixa.sobreviveuAoRedesenho === true,
    'a faixa é o MESMO nó a cada remontagem da folha — uma nova perderia os '
    + 'ouvintes e apagaria uma confirmação de exclusão aberta',
    JSON.stringify(faixa));
  checar(!faixa.erro && faixa.confirmarSomeAoPerguntar === true && faixa.confirmarVolta === true,
    'e enquanto a linha PERGUNTA o confirmar da folha sai de cena: dois botões '
    + 'de confirmar lado a lado diriam coisas opostas (volta inteiro no Cancelar)',
    JSON.stringify(faixa));
  checar(!faixa.erro && faixa.alturaCampo === faixa.alturaGo
      && faixa.alturaOk === faixa.alturaGo,
    'e o CAMPO DE RENOMEAR também (v1.4.29) — ele nasceu na v1.4.25 fora desta '
    + 'regra, com o MESMO pulo de 19px sob o dedo que a v5.309 tinha corrigido '
    + 'para a pergunta da exclusão (' + faixa.alturaCampo + 'px contra '
    + faixa.alturaGo + 'px do confirmar)', JSON.stringify(faixa));
  checar(!faixa.erro && (faixa.alturasDoPar || []).length === 2
      && faixa.alturasDoPar.every((h) => h === faixa.alturaGo),
    'com o par Cancelar/Excluir na altura do botão que ele substitui — sem isso '
    + 'a gaveta dá um pulo sob o dedo ao perguntar. (A CONTAGEM entra na guarda: '
    + 'um `[].every()` é `true`, e sem ela o caso passaria justamente quando o '
    + 'par deixasse de existir.)', JSON.stringify(faixa.alturasDoPar));

  // ===== A FAIXA É DA LINHA DELA, E CONTINUA LÁ (v5.302) =====
  //
  // Os dois percursos abaixo são os que quebraram na primeira escrita deste
  // lote, e nenhum deles é exótico — são as duas coisas que um operador faz
  // numa lista: olhar DOIS itens, e usar o confirmar.
  //
  // A causa era uma só: o irmão do confirmar viajava no slot GLOBAL
  // `songMenuFor`, e quem o consome é o `desenhar()` de UMA linha — um fecho que
  // sobrevive ao global, porque a gaveta é montada uma vez (`gavetaMontada`) e
  // porque `closeSongMenu()` anula o global com a gaveta ainda aberta. Enquanto
  // o irmão era um botão novo a cada chamada ("Ver a letra"), a divergência era
  // invisível; com um NÓ VIVO ligado a um item, ela virou a faixa de uma linha
  // dentro da gaveta de outra — a lixeira de A excluindo o item B.
  const roubo = await pg6.evaluate(async () => {
    // ===== O FIXTURE PARTE DE GAVETAS DESMONTADAS, E ISSO É O CASO =====
    //
    // Os blocos anteriores desta página deixam as gavetas MONTADAS. Com elas
    // montadas, `abrir()` não roda `renderItemMenu` para nenhuma das duas, o
    // slot global nunca reaponta e ele responde certo POR ACIDENTE — o percurso
    // "abrir A → abrir B → reabrir A" não chega a acontecer, e o caso passa a
    // aprovar até a versão defeituosa. Redesenhar a seção joga fora os `li`
    // antigos (e os fechos `gavetaMontada` com eles).
    redesenharFavoritosNaBiblioteca();
    await new Promise((f) => setTimeout(f, 250));
    const corpo = document.querySelector('[data-fav-corpo]');
    const ls = [...corpo.querySelectorAll('.fav-itens > .lib-item')];
    if (ls.length < 2) return { erro: 'faltam favoritos para o caso' };
    const [a, b] = ls;
    if (a.classList.contains('expanded') || b.classList.contains('expanded')) {
      return { erro: 'o fixture não partiu de gavetas fechadas' };
    }
    const abrir = async (li) => {
      if (!li.classList.contains('expanded')) {
        li.querySelector('.row').click();
        const gav = li.querySelector('.hymn-gaveta');
        await Promise.all((gav ? gav.getAnimations() : []).map((an) => an.finished.catch(() => {})));
        await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
      }
    };
    const marcar = async (li, texto) => {
      const o = [...li.querySelectorAll('.hymn-opcoes .song-menu-btn')]
        .find((x) => new RegExp(texto, 'i').test(x.textContent));
      if (!o) return false;
      o.click();
      await new Promise((f) => setTimeout(f, 200));
      return true;
    };
    // ---- 1. ABRIR A → ABRIR B → REABRIR A → mexer em A ----
    await abrir(a); await abrir(b);
    // CARIMBO DE POSSE. Medir PRESENÇA (`querySelector('.fav-acoes')`) não pega
    // o defeito: depois do roubo A TEM uma faixa — a de B. O que distingue é a
    // identidade do nó, e o carimbo é posto agora, com cada faixa ainda na
    // gaveta certa.
    a.querySelector('.fav-acoes').dataset.dono = a.dataset.id;
    b.querySelector('.fav-acoes').dataset.dono = b.dataset.id;
    await abrir(a);
    await marcar(a, 'playlist');
    const faixaDe = (li) => {
      const fx = li.querySelector('.song-menu-go-row > .fav-acoes');
      return fx ? (fx.dataset.dono || '') : null;
    };
    const r = {
      // A faixa de A continua em A, e a de B continua em B. O defeito movia a
      // de B para dentro de A e deixava B sem nenhuma.
      aTemFaixa: faixaDe(a) === a.dataset.id,
      bTemFaixa: faixaDe(b) === b.dataset.id,
      donoEmA: faixaDe(a), donoEmB: faixaDe(b),
      idA: a.dataset.id, idB: b.dataset.id,
      // E a lixeira de A fala do item de A: a prova de que o alvo não trocou é
      // o `aria-label` do botão que executa, que carrega o NOME do item.
      nomeA: a.querySelector('.row-name').textContent,
      dicaDoExcluirDeA: '',
    };
    a.querySelector('.fav-acoes .row-excluir').click();
    await new Promise((f) => setTimeout(f, 220));
    const sim = a.querySelector('.linha-sim');
    r.dicaDoExcluirDeA = sim ? (sim.getAttribute('aria-label') || '') : '';
    r.lixeiraEmA = !!a.querySelector(':scope > .row > .thumb > .row-lixo');
    r.lixeiraEmB = !!b.querySelector(':scope > .row > .thumb > .row-lixo');
    a.querySelector('.linha-nao').click();
    await new Promise((f) => setTimeout(f, 220));
    // ---- 2. CONFIRMAR e depois mexer na MESMA gaveta ----
    // `closeSongMenu()` anula o global; a gaveta do acordeão continua aberta.
    await abrir(a);
    await marcar(a, 'playlist');
    const go = a.querySelector('.song-menu-go');
    if (go && !go.disabled) { go.click(); await new Promise((f) => setTimeout(f, 350)); }
    const a2 = document.querySelector('[data-fav-corpo] .fav-itens > .lib-item');
    await marcar(a2, 'Cronograma');
    const fx2 = a2.querySelector('.song-menu-go-row > .fav-acoes');
    // POSSE de novo, e não presença: a faixa que sobrou tem de ser A DELA.
    r.faixaSobreviveuAoConfirmar = !!fx2 && !!fx2.querySelector('.row-excluir')
      && fx2.dataset.dono === a2.dataset.id;
    return r;
  });
  checar(!roubo.erro && roubo.aTemFaixa === true && roubo.bTemFaixa === true,
    'CADA LINHA FICA COM A FAIXA DELA depois de abrir outra e voltar (v5.302) — '
    + 'o irmão do confirmar viajava num slot global, e o `desenhar()` de uma '
    + 'linha reanexava a faixa de OUTRA', JSON.stringify(roubo));
  checar(!roubo.erro && roubo.lixeiraEmA === true && roubo.lixeiraEmB === false
      && roubo.dicaDoExcluirDeA.includes(roubo.nomeA),
    'e a lixeira dela fala do item DELA: a miniatura que pergunta e o nome no '
    + 'botão que executa são os mesmos — era aqui que um destrutivo apontava '
    + 'para o item errado', JSON.stringify(roubo));
  // ===== A LINHA DE LINK DO YOUTUBE: SETE BOTÕES, E A ORDEM CONTINUA (v5.302) =====
  //
  // Ela é a única com SETE — traz o "baixar o vídeo" —, e por isso é a única
  // para a qual existe regra própria de geometria (`:has(> :nth-child(7))`, que
  // encolhe os quadrados para `--hit`). Nenhum oráculo a abria: o `smoke` roda
  // SEM ponte, e o botão exige `__NATIVE__` mais shell ≥ 16.
  //
  // O que se afirma é a decisão escrita no código: o download não está na
  // sequência que o operador ditou porque só existe nesta linha, e entra DEPOIS
  // dela — para não a partir ao meio.
  const linkYt = await pg6.evaluate(async () => {
    setAppMode('full');
    activeTab = 'imports';
    const ids = [];
    for (let i = 0; i < 2; i++) {
      const m = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
        { name: 'Enchimento yt ' + i, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      ids.push(m.id);
    }
    // Pela porta que o app usa (`addUrlMedia`): um registro SEM bytes.
    // `addMedia(null, …)` lê `blob.type` e estoura — a armadilha já anotada no
    // caso do link do YouTube, algumas centenas de linhas acima.
    const link = await AVDB.addUrlMedia('https://www.youtube.com/watch?v=aaaaaaaaaaa', {
      name: 'Sermão do sábado', kind: 'youtube', type: 'video/youtube',
      youtubeId: 'aaaaaaaaaaa', list: 'imports',
    });
    ids.push(link.id);
    await load();
    const li = document.querySelector('#library .lib-item[data-id="' + link.id + '"]');
    if (!li) return { erro: 'a linha de link não foi desenhada' };
    li.querySelector('.row-mais').click();
    await new Promise((f) => setTimeout(f, 260));
    const caixa = li.querySelector('.row-acoes');
    const bs = [...caixa.querySelectorAll('.row-btn')];
    const cx = (el) => el.getBoundingClientRect();
    const r = {
      n: bs.length,
      ordem: bs.map((b) => (b.className.match(/row-(excluir|renomear|playlist|ordem)|fav-btn/)
        || ['baixar'])[0]),
      // E A GEOMETRIA da regra dos sete: os quadrados encolhem para o PISO de
      // toque do app, e a fileira continua cabendo na caixa.
      larguras: bs.map((b) => Math.round(cx(b).width)),
      soma: Math.round(bs.reduce((t, b) => t + cx(b).width, 0)
        + (bs.length - 1) * (parseFloat(getComputedStyle(caixa).gap) || 0)),
      caixa: Math.round(cx(caixa).width),
    };
    for (const id of ids) await AVDB.listRemove('imports', id);
    await load();
    return r;
  });
  checar(!linkYt.erro && linkYt.n === 7
      && JSON.stringify(linkYt.ordem) === JSON.stringify(['row-excluir', 'row-renomear',
        'fav-btn', 'row-playlist', 'baixar', 'row-ordem', 'row-ordem']),
    'A LINHA DE LINK DO YOUTUBE tem os SETE botões, com o "baixar o vídeo" DEPOIS '
    + 'da sequência ditada — ele só existe nesta linha, e no meio dela a partiria '
    + 'ao meio', JSON.stringify(linkYt.ordem));
  checar(!linkYt.erro && linkYt.soma <= linkYt.caixa
      && linkYt.larguras.every((w) => w === linkYt.larguras[0]) && linkYt.larguras[0] >= 34,
    'e ela CABE na caixa (' + (linkYt.soma || 0) + 'px em ' + (linkYt.caixa || 0)
    + 'px), com os quadrados no piso de toque — é a única linha para a qual a '
    + 'regra dos sete existe, e a única que nenhum oráculo abria',
    JSON.stringify(linkYt));

  checar(!roubo.erro && roubo.faixaSobreviveuAoConfirmar === true,
    'e a faixa sobrevive a um CONFIRMAR seguido de outra marca: `closeSongMenu` '
    + 'anula o global com a gaveta ainda aberta, e sem o irmão vindo do fecho a '
    + 'faixa não era reanexada — excluir, renomear e ↑↓ sumiam da gaveta',
    JSON.stringify(roubo));

  // ===== RENOMEAR NA GAVETA DA LINHA DO CRONOGRAMA (v5.288) =====
  //
  // Pedido do operador: *"adicione renomear nas opções individuais dos itens do
  // cronograma"*. Ele existia só para UM item de cada vez e atrás de quatro
  // gestos (toque longo → seleção → botão do rodapé → diálogo), que é a mesma
  // correção que o excluir recebeu na v5.272.
  //
  // Medido no CRONOGRAMA (`activeTab = 'imports'`), que é a lista do pedido, e
  // pelo caminho de verdade: abrir a gaveta, tocar no lápis, escrever e
  // confirmar. As duas metades — o nome muda no BANCO e a linha o mostra —,
  // porque um rename que só reescrevesse o registro deixaria a tela mentindo
  // até o próximo `load()`.
  const ren = await pg6.evaluate(async () => {
    const m = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
      { name: 'Nome antigo', type: 'audio/mpeg', kind: 'audio', list: 'imports' });
    activeTab = 'imports';
    await load();
    const li = document.querySelector('#library .lib-item[data-id="' + m.id + '"]');
    if (!li) return { erro: 'a linha não foi desenhada no Cronograma' };
    li.querySelector('.row-mais').click();
    await new Promise((r) => setTimeout(r, 200));
    const lapis = li.querySelector('.row-renomear');
    const temLapis = !!lapis;
    // E ELE É UM DESENHO, nunca um glifo da fonte: o subset é ESTÁTICO e `edit`
    // não está nele — um codepoint ausente desenha um retângulo vazio, sem erro
    // nenhum (a armadilha da v5.184 e da v5.200).
    const svg = temLapis && !!lapis.querySelector('svg');
    if (!temLapis) return { erro: 'sem o botão de renomear', temLapis, svg };
    lapis.click();
    await new Promise((r) => setTimeout(r, 250));
    // ===== O CAMPO MORA NA PRÓPRIA FAIXA (v1.4.25) =====
    // Pedido do operador: *"coloque o processo de renomear também dentro do
    // item na lista do cronograma, não como um popup de tela inteira, assim
    // como já é feito no processo de excluir"*. As duas metades caem por
    // motivos diferentes: o campo que não abre na faixa deixa o lápis morto; o
    // MODAL que continua abrindo renomeia certo e desfaz o pedido em silêncio.
    const campo = li.querySelector('.row-acoes.confirmando > .linha-renome > .linha-renome-campo');
    const dlgRen = document.getElementById('appDialog');
    const semModal = !dlgRen || !dlgRen.classList.contains('open');
    if (!campo) return { erro: 'o campo não abriu na faixa da linha', temLapis, svg, semModal };
    // E A LINHA CONTINUA À VISTA enquanto se digita: é a única coisa da tela que
    // diz QUAL dos trinta nomes parecidos está sendo trocado, e era exatamente
    // o que o modal tirava de cena.
    const cx = li.getBoundingClientRect();
    const linhaAVista = cx.height > 0 && cx.width > 0;
    const valorInicial = campo.value;
    campo.value = 'Nome novo';
    li.querySelector('.row-slot--ok').click();
    await new Promise((r) => setTimeout(r, 450));
    const rec = await AVDB.getMedia(m.id);
    const linha = document.querySelector('#library .lib-item[data-id="' + m.id + '"] .row-name');
    const r = {
      temLapis, svg, valorInicial, semModal, linhaAVista,
      noBanco: rec ? rec.name : null,
      naTela: linha ? linha.textContent : null,
      // E NA PASTA DO APARELHO ELE NÃO ENTRA: ali o nome vem do arquivo, e um
      // nome só no registro seria desfeito na varredura seguinte.
      naPasta: null,
    };
    await AVDB.listRemove('imports', m.id);
    // ---- E A PASTA DO APARELHO, com linhas de verdade ----
    // Uma asserção "não achei o lápis" numa lista VAZIA passaria sem medir
    // nada, que é o pior artefato que este repositório sabe produzir. Daí o
    // fixture.
    //
    // PELO CAMINHO DE VERDADE (v5.294). Até aqui ele escrevia `activeTab =
    // 'folders'` e um `currentFolder` à mão — um estado que o app não alcança
    // desde a v5.290 e que deixou de existir na v5.294. Um oráculo que monta um
    // estado impossível prova o comportamento de um app que não existe: agora
    // ele abre a pasta INLINE na Biblioteca, como o operador abre.
    // O FIXTURE É PRÓPRIO desta página: `pg6` nasceu depois dos casos da pasta,
    // e depender do que outra página deixou no banco faria a asserção medir
    // zero linha — que é uma lista VAZIA passando por "não achei o lápis".
    for (const n of ['B video.mp4', 'A audio.mp3']) {
      await AVDB.fileAdd({ id: 'rn-' + n, name: n, type: 'audio/mpeg', kind: 'audio',
        folder: 'pasta-renomear', opfsPath: 'folders/pasta-renomear/' + n, size: 4, mtime: 1 });
    }
    await AVDB.setState('opfs-folders',
      [{ id: 'pasta-renomear', name: 'Vídeos do culto', count: 2 }]);
    await load();
    window.__bibliotecaComFavoritos();
    await new Promise((res) => setTimeout(res, 400));
    const corpoFav = document.querySelector('[data-fav-corpo]');
    const liPasta = corpoFav && corpoFav.querySelector('.folder-opfs');
    if (liPasta && !liPasta.classList.contains('expanded')) {
      liPasta.querySelector('.row').click();
      await new Promise((res) => setTimeout(res, 450));
    }
    const arqPasta = liPasta && liPasta.querySelector('.folder-itens > .lib-item');
    r.linhasPasta = liPasta ? liPasta.querySelectorAll('.folder-itens > .lib-item').length : 0;
    if (arqPasta) {
      // A GAVETA de um arquivo de pasta abre pelo CORPO da linha (v5.285), não
      // por um `⋮`: aquela faixa é do Cronograma e da fila da playlist.
      arqPasta.querySelector('.row').click();
      await new Promise((res) => setTimeout(res, 350));
      r.naPasta = !arqPasta.querySelector('.row-renomear');
      // E a metade NEGATIVA da metade negativa: a gaveta daquela linha ABRIU e
      // tem opções — sem isto, uma gaveta que não abrisse passaria.
      r.pastaTemGaveta = arqPasta.querySelectorAll('.hymn-opcoes .song-menu-sel').length > 0;
    }
    closeHymnSearch();
    await load();
    return r;
  });
  checar(!ren.erro && ren.temLapis && ren.svg,
    'A LINHA DO CRONOGRAMA GANHOU RENOMEAR na gaveta (v5.288), e o ícone é um '
    + 'DESENHO — `edit` não está no subset da fonte, e um codepoint ausente sai '
    + 'como retângulo vazio', JSON.stringify(ren));
  checar(ren.valorInicial === 'Nome antigo',
    'e o campo abre com o nome ATUAL, para trocar uma palavra não custar '
    + 'redigitar a frase', 'campo: ' + JSON.stringify(ren.valorInicial));
  checar(ren.semModal === true && ren.linhaAVista === true,
    'e ele abre NA PRÓPRIA FAIXA, sem popup de tela cheia (v1.4.25): a linha '
    + 'continua à vista, que é a única coisa que diz qual dos trinta nomes '
    + 'parecidos está sendo trocado', JSON.stringify(ren));
  checar(ren.noBanco === 'Nome novo' && ren.naTela === 'Nome novo',
    'e o nome muda NO BANCO e NA TELA — sem a segunda metade a lista mentiria '
    + 'até o próximo redesenho', JSON.stringify([ren.noBanco, ren.naTela]));
  checar(ren.naPasta && ren.pastaTemGaveta,
    'e ele NÃO entra na pasta do aparelho (com ' + ren.linhasPasta + ' linha(s) '
    + 'de verdade na tela e a gaveta aberta): ali o nome vem do arquivo, e um '
    + 'nome só no registro seria desfeito na varredura seguinte',
    JSON.stringify([ren.linhasPasta, ren.naPasta, ren.pastaTemGaveta]));
  await pg6.close();
} catch (e) {
  checar(false, 'o percurso dos Favoritos terminou sem exceção (' + (e && e.message) + ')');
}

// ===== O TAMANHO DA LETRA: O PAR A+/A− E A MEMÓRIA (v1.1.6) =====
//
// Pedido do operador: *"aproveite para criar dois botões de A+ e A− nestas
// seções de letras… sendo é claro o tamanho salvo na memória do app"*.
//
// A metade que falha CALADA é a MEMÓRIA. O botão errado se denuncia no primeiro
// toque; o `setState` que não grava (ou o `getState` que não é lido na abertura)
// não erra em lugar nenhum — o operador escolhe o tamanho, opera o culto
// inteiro, e no sábado seguinte a letra está pequena outra vez sem que nada na
// tela explique. Por isso a segunda página: ela mede a ABERTURA, não a sessão.
//
// PÁGINA NOVA e não `reload`: é o mesmo contexto, logo o mesmo IndexedDB, e o
// que se afirma é o caminho de leitura do `load()` — que é o que roda quando o
// operador abre o app na semana seguinte.
try {
  const pg7 = await ctx.newPage();
  await pg7.addInitScript(PONTE);
  await pg7.goto(`http://127.0.0.1:${porta}/controle/`, { waitUntil: 'load' });
  // ESPERA O `#playlist li`, e não só os módulos: o `load()` LÊ o tamanho
  // guardado e reescreve `lvTamanho`. Sem esta espera, o primeiro passo deste
  // caso corre contra a abertura e é desfeito por ela — MEDIDO, e é a quarta
  // classe da tabela ("o oráculo correndo contra o app") outra vez.
  await pg7.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function'
    && !!document.querySelector('#playlist li'), null, { timeout: 25000 });

  const fonte = await pg7.evaluate(async () => {
    setAppMode('full');
    const ler = () => ({
      token: getComputedStyle(document.documentElement)
        .getPropertyValue('--lv-fonte').trim(),
      valor: lvTamanho,
      menosOff: !!document.querySelector('#lyricsPopup .lv-fonte-menos').disabled,
      maisOff: !!document.querySelector('#lyricsPopup .lv-fonte-mais').disabled,
    });
    const r = { padrao: ler() };
    // AS DUAS CASAS existem: a folha de leitura e a linha do nome do Modo Fácil.
    // Um par só serviria metade dos operadores — e o Modo Fácil não tem a folha.
    r.pares = document.querySelectorAll('.lv-fonte-ctl').length;
    r.naFolha = !!document.querySelector('#lyricsPopup .lv-fonte-ctl');
    r.noSimples = !!document.querySelector('.simple-np-linha .lv-fonte-ctl');
    // UM PASSO, e ele é DISCRETO: o valor seguinte é o da escada, não o anterior
    // vezes um fator.
    await passoTamanhoDaLetra(1);
    r.umAcima = ler();
    // O RESPIRO ACOMPANHA a fonte (o `calc` do CSS): sem isto, o degrau maior
    // empataria a fronteira de estrofe com a entrelinha e ela sumiria.
    const corpo = document.getElementById('lyricsViewBody');
    const px = (v) => parseFloat(v) || 0;
    r.razaoRespiro = px(getComputedStyle(corpo).rowGap)
      / px(getComputedStyle(document.documentElement).fontSize) / lvTamanho;
    // OS FINS DA ESCADA DESABILITAM o botão — sem isso o toque no fim é um
    // no-op mudo, que se lê como travamento.
    for (let i = 0; i < 12; i++) await passoTamanhoDaLetra(1);
    r.teto = ler();
    for (let i = 0; i < 12; i++) await passoTamanhoDaLetra(-1);
    r.piso = ler();
    // E O QUE FICA GUARDADO é o valor final — a página seguinte o lê.
    await passoTamanhoDaLetra(1);
    r.guardado = { valor: lvTamanho, noBanco: await AVDB.getState('lyricsFont') };
    return r;
  });
  checar(fonte.padrao.valor === 1.4 && fonte.padrao.token === '1.4rem',
    'O TAMANHO DA LETRA abre no padrão da v1.1.5 (1.4rem), no token que as duas '
    + 'casas leem', JSON.stringify(fonte.padrao));
  checar(fonte.pares === 2 && fonte.naFolha && fonte.noSimples,
    'e o par A+/A− existe nas DUAS casas — a folha de leitura e a linha do nome '
    + 'do Modo Fácil, que não tem a folha',
    JSON.stringify([fonte.pares, fonte.naFolha, fonte.noSimples]));
  checar(fonte.umAcima.valor === 1.7 && fonte.umAcima.token === '1.7rem',
    'um toque em A+ sobe UM DEGRAU da escada — não um fator, que acumularia erro '
    + 'e produziria medidas que ninguém escolheu', JSON.stringify(fonte.umAcima));
  checar(Math.abs(fonte.razaoRespiro - 0.86) < 0.02,
    'e o respiro entre estrofes acompanha a fonte (razão ~0,86 em qualquer '
    + 'degrau)', fonte.razaoRespiro.toFixed(3));
  checar(fonte.teto.maisOff && !fonte.teto.menosOff,
    'no TETO da escada o A+ desabilita — e só ele',
    JSON.stringify(fonte.teto));
  checar(fonte.piso.menosOff && !fonte.piso.maisOff,
    'no PISO, o A−', JSON.stringify(fonte.piso));
  checar(fonte.guardado.noBanco === fonte.guardado.valor,
    'e a escolha vai para o BANCO no mesmo toque', JSON.stringify(fonte.guardado));

  // A ABERTURA SEGUINTE. É esta metade que o pedido chama de "salvo na memória".
  const pg8 = await ctx.newPage();
  await pg8.addInitScript(PONTE);
  await pg8.goto(`http://127.0.0.1:${porta}/controle/`, { waitUntil: 'load' });
  await pg8.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function'
    && !!document.querySelector('#playlist li'), null, { timeout: 20000 });
  const volta = await pg8.evaluate(() => ({
    valor: lvTamanho,
    token: getComputedStyle(document.documentElement).getPropertyValue('--lv-fonte').trim(),
    naLetra: Math.round(parseFloat(getComputedStyle(
      document.getElementById('lyricsViewBody')).fontSize) * 100) / 100,
  }));
  checar(volta.valor === fonte.guardado.valor && volta.token === fonte.guardado.valor + 'rem',
    'e A ABERTURA SEGUINTE nasce com ela — a metade que falharia calada, sem '
    + 'erro nenhum e só um "voltou ao pequeno" no sábado seguinte',
    JSON.stringify([volta, fonte.guardado.valor]));
  await pg7.close();
  await pg8.close();
} catch (e) {
  checar(false, 'o percurso do tamanho da letra terminou sem exceção (' + (e && e.message) + ')');
}

// ===== O LINK DO YOUTUBE NA ÁREA DE TRANSFERÊNCIA (v1.1.8, shell 48) =====
//
// Este caminho é do APP e só do app: no navegador ele não existe, então sem a
// ponte de mentira ele nunca seria executado por teste nenhum — que é a razão de
// este arquivo existir.
//
// As QUATRO metades, e nenhuma sozinha prova o recurso:
//
//  1. o link copiado VIRA PERGUNTA, e a pergunta mostra o endereço;
//  2. "Agora não" não importa nada — copiar não é um pedido, e a recusa tem de
//     ser o desfecho barato;
//  3. o CARIMBO AVANÇA e a leitura seguinte não lê mais nada. É a metade cara:
//     sem ela, cada retomada relê a área de transferência, e no Android 12+ cada
//     releitura é um aviso do sistema na tela;
//  4. com um DIÁLOGO já na tela ela não pergunta E NÃO AVANÇA o carimbo — o
//     `openAppDialog` resolve o anterior como cancelado ao abrir o próximo, e o
//     que estaria ali é a pergunta da atualização.
try {
  const pg9 = await ctx.newPage();
  await pg9.addInitScript(PONTE);
  await pg9.goto(`http://127.0.0.1:${porta}/controle/`, { waitUntil: 'load' });
  await pg9.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function'
    && !!document.querySelector('#playlist li'), null, { timeout: 25000 });

  const clip = await pg9.evaluate(async () => {
    const r = {};
    const esperarDialogo = async () => {
      for (let i = 0; i < 60; i++) {
        if (appDialogEl.classList.contains('open')) return true;
        await new Promise((res) => setTimeout(res, 50));
      }
      return false;
    };
    // Um link do YouTube, recém-copiado.
    window.__clip = { texto: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', carimbo: 1000 };
    window.__clipLeituras = 0;
    const antes = (await AVDB.listIds('imports')).length;

    conferirLinkCopiado();
    r.perguntou = await esperarDialogo();
    r.mostraOLink = appDialogMsgEl.textContent.includes('dQw4w9WgXcQ');
    r.rotulos = [appDialogOkEl.textContent, appDialogCancelEl.textContent];
    // "Agora não".
    appDialogCancelEl.click();
    await new Promise((res) => setTimeout(res, 250));
    r.naoImportou = (await AVDB.listIds('imports')).length === antes;
    r.carimboGuardado = await AVDB.getState('clip-carimbo');

    // 3. A MESMA área de transferência, uma retomada depois: nada é lido.
    const leituras = window.__clipLeituras;
    await conferirLinkCopiado();
    await new Promise((res) => setTimeout(res, 150));
    r.naoReleu = window.__clipLeituras === leituras;
    r.naoPerguntouDeNovo = !appDialogEl.classList.contains('open');

    // 4. DIÁLOGO NA TELA: não pergunta e não avança o carimbo.
    window.__clip = { texto: 'https://youtu.be/abcdefghijk', carimbo: 2000 };
    const outra = appConfirm({ title: 'Outra pergunta', message: 'x', okText: 'ok' });
    await new Promise((res) => setTimeout(res, 50));
    await conferirLinkCopiado();
    await new Promise((res) => setTimeout(res, 150));
    r.dialogoIntacto = appDialogTitleEl.textContent === 'Outra pergunta';
    r.carimboNaoAndou = (await AVDB.getState('clip-carimbo')) === 1000;
    appDialogCancelEl.click();
    await outra;
    await new Promise((res) => setTimeout(res, 100));

    // E a retomada SEGUINTE ainda tem o que perguntar — é o que o carimbo
    // intacto compra.
    conferirLinkCopiado();
    r.perguntouDepois = await esperarDialogo();
    appDialogCancelEl.click();
    await new Promise((res) => setTimeout(res, 150));

    // 5. TEXTO QUE NÃO É DO YOUTUBE: não pergunta, mas o carimbo AVANÇA — senão
    //    um texto qualquer copiado seria relido (e avisado) em toda retomada.
    window.__clip = { texto: 'https://exemplo.org/algo', carimbo: 3000 };
    await conferirLinkCopiado();
    await new Promise((res) => setTimeout(res, 150));
    r.naoPerguntouPorOutroLink = !appDialogEl.classList.contains('open');
    r.carimboAvancouAssimMesmo = (await AVDB.getState('clip-carimbo')) === 3000;
    return r;
  });

  checar(clip.perguntou && clip.mostraOLink,
    'um link do YouTube copiado vira PERGUNTA, e ela mostra o endereço — copiar '
    + 'não é um pedido, então nada entra sem o "sim"', JSON.stringify(clip.rotulos));
  checar(clip.naoImportou,
    'e "Agora não" não importa nada');
  checar(clip.carimboGuardado === 1000,
    'o CARIMBO fica no banco (não em memória): o processo morre, o app reabre, e '
    + 'um carimbo perdido faria a mesma pergunta com o aviso do sistema junto',
    'carimbo: ' + clip.carimboGuardado);
  checar(clip.naoReleu && clip.naoPerguntouDeNovo,
    'a retomada seguinte NÃO LÊ a área de transferência — é esta metade que '
    + 'impede o aviso do Android 12+ de aparecer em toda vinda ao app',
    JSON.stringify([clip.naoReleu, clip.naoPerguntouDeNovo]));
  checar(clip.dialogoIntacto && clip.carimboNaoAndou,
    'com um DIÁLOGO já na tela ela não pergunta E não avança o carimbo — abrir o '
    + 'próximo resolveria o anterior como cancelado, e o que estaria ali é a '
    + 'pergunta da atualização', JSON.stringify(clip));
  checar(clip.perguntouDepois,
    'e por isso a retomada seguinte ainda tem o que perguntar');
  checar(clip.naoPerguntouPorOutroLink && clip.carimboAvancouAssimMesmo,
    'um link que NÃO é do YouTube não pergunta nada, mas o carimbo avança do '
    + 'mesmo jeito: sem isso ele seria relido (e avisado) em toda retomada',
    JSON.stringify(clip));
  await pg9.close();
} catch (e) {
  checar(false, 'o percurso da área de transferência terminou sem exceção (' + (e && e.message) + ')');
}

// ===== O MICROFONE SEM TELÃO: O BOTÃO NÃO É OFERECIDO (v1.2.20) =====
//
// Quem abre o microfone é o `/display/`, e ele só existe DENTRO da
// `Presentation` — sem TV conectada o `syncPresentation` não cria nenhuma, e
// ninguém consome o comando `mic`. As telas da rede também não servem: elas
// rodam o MESMO `display.js`, e lá o `setMic` sai por `if (TELA) return`.
//
// A HISTÓRIA DESTE BLOCO, em três degraus, porque cada um consertou o anterior:
//
//   até a v1.1.20 ... o botão acendia "No ar" com o `micPressed` local, sem
//                     nada captando. O operador falava para ninguém.
//   v1.1.20 ........ ele passou a RECUSAR o toque e DIZER por quê.
//   v1.2.20 ........ ele deixou de ser desenhado. Explicar é melhor que mentir,
//                    mas não é melhor que não oferecer — a frase chegava com o
//                    dedo no botão, no meio do culto.
//
// A PONTE PADRÃO DESTE ARQUIVO TEM ZERO TELAS (`ponteCom(…, [])`), então a
// ausência é a condição normal aqui. O QUE PRECISA DE CENÁRIO é o contrário:
// a TV ENTRANDO deve fazer o botão aparecer SEM trocar de aba — sem isso ele só
// voltaria na próxima navegação, isto é, a TV conecta no meio do culto e o
// microfone continua ausente, sem nada na tela explicando.
try {
  const pgM = await ctx.newPage();
  await pgM.addInitScript(PONTE);
  // A LISTA DE TELAS VIRA MUTÁVEL, para a TV poder entrar no meio do teste. O
  // `__avDisplaysChanged` do `native.js` reconsulta a ponte, então basta trocar
  // o que ela responde.
  await pgM.addInitScript(`(() => {
    window.__telas = [];
    const arm = () => {
      const B = window.__AVBridge;
      if (!B) { setTimeout(arm, 0); return; }
      B.displays = (id) => {
        setTimeout(() => { try { window.__avResolve(id, window.__telas); } catch (_) {} }, 0);
      };
      B.requestMic = (id) => {
        setTimeout(() => { try { window.__avResolve(id, true); } catch (_) {} }, 0);
      };
    };
    arm();
  })();`);
  await pgM.goto(`http://127.0.0.1:${porta}/controle/`, { waitUntil: 'load' });
  await pgM.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function'
    && !!document.querySelector('#playlist li'), null, { timeout: 25000 });

  const semTv = await pgM.evaluate(async () => {
    // A PORTA DAS FERRAMENTAS É O BOTÃO DO CRONOGRAMA (v1.3.10) — elas deixaram
    // de ser uma aba. Clicar nele, e não chamar `abrirFerramentas()`, é o que
    // mantém o caminho do operador dentro do oráculo.
    setAppMode('full');
    await new Promise((f) => setTimeout(f, 120));
    document.getElementById('toolsBtn').click();
    await new Promise((f) => setTimeout(f, 300));
    const proj = document.getElementById('miscProjectBtn');
    const row = proj && proj.parentElement;
    return {
      temMic: !!document.getElementById('micBtn'),
      temProj: !!proj,
      // A LARGURA É MEDIDA CONTRA A LINHA, nunca contra um número de pixel: a
      // fonte e a densidade são da MÁQUINA, e afirmar "440px" seria medir o
      // runner. O que o desenho promete é que o botão OCUPA A LINHA.
      largura: proj ? Math.round(proj.getBoundingClientRect().width) : 0,
      larguraDaLinha: row ? Math.round(row.getBoundingClientRect().width) : 0,
      irmaos: row ? row.children.length : 0,
    };
  });

  checar(semTv.temMic === false,
    'SEM TV o botão de microfone NÃO É DESENHADO — um controle que só sabe dizer que '
    + 'não funciona é um controle a mais para o operador aprender', JSON.stringify(semTv));
  checar(semTv.temProj === true && semTv.irmaos === 1,
    'e o "Projetar no telão" fica SOZINHO na linha', JSON.stringify(semTv));
  checar(semTv.larguraDaLinha > 0 && semTv.largura >= semTv.larguraDaLinha - 2,
    'OCUPANDO-A DE LADO A LADO: `.misc-foot` é flex e o filho é `flex: 1`, então a '
    + 'largura vem da AUSÊNCIA do irmão, não de uma regra de CSS para o caso',
    JSON.stringify(semTv));

  // A METADE QUE FALHARIA CALADA: a TV ENTRA e o botão precisa aparecer SEM que
  // o operador troque de aba. Quem faz isso é o `refreshDiversos()` disparado
  // pela TRANSIÇÃO de presença no `renderDisplayStatus` — e sem ele nada erra:
  // a aba simplesmente continua sem microfone.
  const comTv = await pgM.evaluate(async () => {
    // `telao: true` NÃO É ENFEITE (shell 59): a lista responde pelo DisplayManager
    // e quem decide microfone e som é a `Presentation`. Uma fixture sem o campo é
    // uma TV conectada com o telão no chão — outro cenário, coberto logo abaixo.
    window.__telas = [{ id: 1, name: 'TV do templo', w: 1920, h: 1080, density: 320, telao: true }];
    window.__avDisplaysChanged();
    await new Promise((f) => setTimeout(f, 500));
    const proj = document.getElementById('miscProjectBtn');
    const row = proj && proj.parentElement;
    return {
      temMic: !!document.getElementById('micBtn'),
      irmaos: row ? row.children.length : 0,
      abaAtiva: !!document.querySelector('[data-tab="mic"].active')
        || !!document.getElementById('miscProjectBtn'),
    };
  });
  checar(comTv.temMic === true,
    'A TV ENTRANDO faz o botão APARECER, sem trocar de aba — sem isso ela conecta no '
    + 'meio do culto e o microfone continua ausente, calado', JSON.stringify(comTv));
  checar(comTv.irmaos === 2,
    'e a linha volta a ter os dois, dividindo a largura', JSON.stringify(comTv));

  // E A TV SAINDO desfaz: a simetria não é elegância, é o caso do dongle que
  // cai — e ali o botão precisa sumir, senão volta a ser o que mentia.
  const saiu = await pgM.evaluate(async () => {
    window.__telas = [];
    window.__avDisplaysChanged();
    await new Promise((f) => setTimeout(f, 500));
    return { temMic: !!document.getElementById('micBtn') };
  });
  checar(saiu.temMic === false,
    'e a TV SAINDO o tira de novo — é o caso do dongle que cai no meio do culto',
    JSON.stringify(saiu));

  await pgM.close();
} catch (e) {
  checar(false, 'o percurso do microfone sem telão terminou sem exceção (' + (e && e.message) + ')');
}

checar(erros.length === 0, 'nenhum erro de console' + (erros.length ? ':\n        ' + erros.join('\n        ') : ''));

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
